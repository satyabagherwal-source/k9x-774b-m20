# Verification Protocol: Verification Protocol: Empirical Defect Shield for zama-ai-tfhe-rs-learnings

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai-tfhe-rs-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T18:35:07.140Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zama-ai-tfhe-rs-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai-tfhe-rs-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T18:35:07.140Z`  
> **Learning ID**: `LEARN-EVO-zama-ai-tfhe-rs-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `zama-ai-tfhe-rs-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zama-ai-tfhe-rs-learnings.md`  
> **Source**: github ([https://github.com/zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs))  
> **Source Version**: `51c20e76`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T18:34:29.919Z  
> **Learning ID**: `learn-github-zama-ai-tfhe-rs`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zama-ai/tfhe-rs

> **Canonical Artifact**: `07_PROJECT_LEARNING/zama-ai-tfhe-rs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T18:34:29.913Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zama-ai/tfhe-rs`
- **Description**: TFHE-rs: A Pure Rust implementation of the TFHE Scheme for Boolean and Integer Arithmetics Over Encrypted Data.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 1684 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/aes/aes_utilities.h`
```
#ifndef AES_UTILITIES
#define AES_UTILITIES
#include "../integer/integer_utilities.h"

// AES state dimensions

/// @brief Bits per state byte
static constexpr uint32_t AES_BITS_PER_BYTE = 8;
/// @brief State bytes
static constexpr uint32_t AES_STATE_BYTES = 16;
/// @brief State bits, one radix block each once bitsliced
static constexpr uint32_t AES_STATE_BITS = AES_STATE_BYTES * AES_BITS_PER_BYTE;

/// @brief S-box wires (22 a, 68 b, 18 c), sizes the S-box workspace. Kept in
/// sync with the circuit by a static_assert in the S-box
static constexpr uint32_t AES_SBOX_WIRE_SLOTS = 108;

/// @brief ANDs in the widest S-box layer (the c wires), sizes and_lut and the
/// batch staging buffer. Also checked by a static_assert in the S-box
static constexpr uint32_t AES_SBOX_AND_GATES = 18;

/// @brief What an int_aes_encrypt_buffer is for. FULL_ENCRYPTION for the CTR
/// loop, SBOX_ONLY for the key schedule which only needs the S-box
enum class aes_buffer_scope { FULL_ENCRYPTION, SBOX_ONLY };

// state_lut slots. Slot 0 is the resting one, whoever picks another must put
// AES_LUT_FLUSH back before returning

/// @brief Flush, x & 1, resting slot
static constexpr uint32_t AES_LUT_FLUSH = 0;
/// @brief Carry combine of the CTR adder on kill 0, propagate 1, generate 2.
/// With that encoding the symbol is just a + b, no PBS needed to build it
static constexpr uint32_t AES_LUT_CTR_SELECT = 1;
/// @brief Sum bit of the CTR adder, propagate xor carry
static constexpr uint32_t AES_LUT_CTR_SUM = 2;
/// @brief state_lut slots under FULL_ENCRYPTION
static constexpr uint32_t AES_NUM_STATE_LUTS = 3;

// and_lut slots, same resting slot rule

/// @brief AND on a levelled sum, x == 2, resting slot
static constexpr uint32_t AES_ANDLUT_AND = 0;
/// @brief Flush, for batches too wide for state_lut
static constexpr uint32_t AES_ANDLUT_FLUSH = 1;
/// @brief and_lut slots
static constexpr uint32_t AES_NUM_ANDLUT_SLOTS = 2;

/// @brief The two multi slot LUTs every PBS of the encryption goes through.
/// and_lut for the S-box ANDs and wide flushes, state_lut for state wide
/// flushes and the CTR adder.
template <typename Torus> struct int_aes_lut_buffers {
  /// @brief Sized for the widest AND layer, AES_SBOX_AND_GATES *
  /// num_aes_inputs * sbox_parallelism blocks
  int_radix_lut<Torus> *and_lut;
  /// @brief One state worth of blocks, AES_STATE_BITS * num_aes_inputs. Only
  /// the flush slot under SBOX_ONLY
  int_radix_lut<Torus> *state_lut;

  int_aes_lut_buffers(CudaStreams streams, const int_radix_params &params,
                      bool allocate_gpu_memory, uint32_t num_aes_inputs,
                      uint32_t sbox_parallelism, uint64_t &size_tracker,
                      aes_buffer_scope scope) {

    this->and_lut = new int_radix_lut<Torus>(
        streams, params, AES_NUM_ANDLUT_SLOTS,
        AES_SBOX_AND_GATES * num_aes_inputs * sbox_parallelism,
        allocate_gpu_memory, size_tracker);

    std::function<Torus(Torus)> and_lambda = [](Torus x) -> Torus {
      return x == 2 ? 1 : 0;
    };
    std::function<Torus(Torus)> flush_lambda = [](Torus x) -> Torus {
      return x & 1;
    };

    auto active_streams_and_lut = streams.active_gpu_subset(
        AES_SBOX_AND_GATES * num_aes_inputs * sbox_parallelism,
        params.pbs_type());
    this->and_lut->generate_and_broadcast_lut(
        active_streams_and_lut, {AES_ANDLUT_AND, AES_ANDLUT_FLUSH},
        {and_lambda, flush_lambda}, LUT_0_FOR_ALL_BLOCKS);

    const bool needs_ctr_luts = (scope == aes_buffer_scope::FULL_ENCRYPTION);
    this->state_lut = new int_radix_lut<Torus>(
        streams, params, needs_ctr_luts ? AES_NUM_STATE_LUTS : 1,
        AES_STATE_BITS * num_aes_inputs, allocate_gpu_memory, size_tracker);

    auto active_streams_state_lut = streams.active_gpu_subset(
        AES_STATE_BITS * num_aes_inputs, params.pbs_type());
    this->state_lut->generate_and_broadcast_lut(active_streams_state_lut,
                                                {AES_LUT_FLUSH}, {flush_lambda},
                                                LUT_0_FOR_ALL_BLOCKS);

    if (needs_ctr_luts) {
      std::function<Torus(Torus, Torus)> select_lambda =
          [](Torus hi, Torus lo) -> Torus { return hi == 1 ? lo : hi; };

      std::function<Torus(Torus, Torus)> sum_lambda = [](Torus p,
                                                         Torus c) -> Torus {
        return (p == 1 ? 1 : 0) ^ (c == 2 ? 1 : 0);
      };

      this->state_lut->generate_and_broadcast_bivariate_lut(
          active_streams_state_lut, {AES_LUT_CTR_SELECT, AES_LUT_CTR_SUM},
          {select_lambda, sum_lambda}, LUT_0_FOR_ALL_BLOCKS);
    }
  }

  void release(CudaStreams streams) {
    this->and_lut->release(streams);
    delete this->and_lut;
    this->and_lut = nullptr;

    this->state_lut->release(streams);
    delete this->state_lut;
    this->state_lut = nullptr;
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

/// @brief The fixed GF(2) maps of AES as index tables, each one a single
/// levelled launch through host_radix_gather_sum.
///
/// A permutation or a 5 term sum costs the same, one launch and no PBS.
/// Written in bit positions, the table repeats them for every input, so they
/// don't grow with num_aes_inputs.
struct int_aes_linear_tables {
  /// @brief Where the xtime half starts in the MixColumns workspace, i +
  /// XTIME_BASE is bit i doubled
  static constexpr uint32_t XTIME_BASE = AES_STATE_BITS;
  /// @brief Terms per xtime output bit, the shifted bit plus bit 0 where the
  /// modulus folds back
  static constexpr uint32_t XTIME_TERMS = 2;
  /// @brief Terms per MixColumns output bit, 3a = 2a + a expanded
  static constexpr uint32_t MIX_COLUMNS_TERMS = 5;

  /// @brief Owner of the maps below
  radix_index_tables<uint32_t> maps;

  /// @brief ShiftRows, a permutation of the state bits. Round tables only
  radix_index_table<uint32_t> shift_rows;
  /// @brief xtime of every state byte. Round tables only
  radix_index_table<uint32_t> xtime;
  /// @brief MixColumns over [shifted | xtime of shifted], the four columns at
  /// once. Round tables only
  radix_index_table<uint32_t> mix_columns;
  /// @brief Byte major to bit major, so the S-box sees one contiguous run per
  /// bit
  radix_index_table<uint32_t> sbox_gather;
  /// @brief Back from bit major once the S-box is done
  radix_index_table<uint32_t> sbox_scatter;
  /// @brief Copies the IV to every input. Round tables only
  radix_index_table<uint32_t> iv_broadcast;
  /// @brief Bitsliced back to the block order callers expect. Round tables
  /// only
  radix_index_table<uint32_t> to_blocks;

  /// @brief Rows of sbox_gather and sbox_scatter, 8 * sbox_parallelism
  uint32_t sbox_reorder_len;

  /// @brief Whether the round tables were built (FULL_ENCRYPTION)
  bool has_round_tables;

  int_aes_linear_tables(CudaStreams streams, bool allocate_gpu_memory,
                        uint32_t num_aes_inputs, uint32_t sbox_parallelism,
                        uint64_t &size_tracker, aes_buffer_scope scope) {

    const uint32_t N = num_aes_inputs;
    this->sbox_reorder_len = AES_BITS_PER_BYTE * sbox_parallelism;
    this->has_round_tables = (scope == aes_buffer_scope::FULL_ENCRYPTION);

    auto build = [&](radix_index_table<uint32_t> &map, uint32_t num_out_bits,
                     uint32_t num_terms,
                     const std::function<uint32_t(uint32_t, uint32_t)> &src) {
      maps.create(streams, allocate_gpu_memory, size_tracker, map, num_out_bits,
                  num_terms, N, N, src);
    };

    if (has_round_tables) {
      // ShiftRows rotates row r left by r bytes
      //
      //      c=0  c=1  c=2  c=3            c=0  c=1  c=2  c=3
      // r=0 |  0 |  4 |  8 | 12 |     r=0 |  0 |  4 |  8 | 12 |
      // r=1 |  1 |  5 |  9 | 13 |  -> r=1 |  5 |  9 | 13 |  1 |
      // r=2 |  2 |  6 | 10 | 14 |     r=2 | 10 | 14 |  2 |  6 |
      // r=3 |  3 |  7 | 11 | 15 |     r=3 | 15 |  3 |  7 | 11 |
      //
      // Reading the right side column major gives the table below
      //
      build(shift_rows, AES_STATE_BITS, 1, [](uint32_t bit, uint32_t) {
        constexpr uint32_t shift_rows_map[AES_STATE_BYTES] = {
            0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12, 1, 6, 11};
        return shift_rows_map[bit / AES_BITS_PER_BYTE] * AES_BITS_PER_BYTE +
               bit % AES_BITS_PER_BYTE;
      });

      // xtime multiplies by x in GF(2^8). Bits are MSB first and the modulus
      // x^8 + x^4 + x^3 + x + 1 folds bit 0 back onto j = 3, 4, 6, 7
      //
      //   out[j] = a[j + 1]     j < 7
      //   out[j] += a[0]        j = 3, 4, 6, 7
      //
      build(xtime, AES_STATE_BITS, XTIME_TERMS,
            [](uint32_t bit, uint32_t term) {
              uint32_t j = bit % AES_BITS_PER_BYTE, base = bit - j;
              if (term == 0)
                return (j == AES_BITS_PER_BYTE - 1) ? base : base + j + 1;
              const bool reduced = (j == 3 || j == 4 || j == 6);
              return reduced ? base : RADIX_INDEX_NO_TERM;
            });

      // MixColumns multiplies each column by a fixed matrix over GF(2^8)
      //
      //   | b0 |   | 2 3 1 1 |   | a0 |
      //   | b1 | = | 1 2 3 1 | * | a1 |
      //   | b2 |   | 1 1 2 3 |   | a2 |
      //   | b3 |   | 3 1 1 2 |   | a3 |
      //
      // With 3a = 2a + a that's 5 terms per output. The workspace holds
      // [shifted | xtime of it], so a doubled term is just index + XTIME_BASE
      build(mix_columns, AES_STATE_BITS, MIX_COLUMNS_TERMS,
            [](uint32_t bit, uint32_t term) {
              uint32_t byte = bit / AES_BITS_PER_BYTE;
              uint32_t t = bit % AES_BITS_PER_BYTE;
              uint32_t c = byte & ~3u, b = byte & 3u;
              auto orig = [c, t](uint32_t i) {
                return (c + i) * AES_BITS_PER_BYTE + t;
              };
              auto mul2 = [&orig](uint32_t i) { return XTIME_BASE + orig(i); };
              const uint32_t rows[4][MIX_COLUMNS_TERMS] = {
   
```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/integer/compression/compression_utilities.h`
```
#ifndef CUDA_INTEGER_COMPRESSION_UTILITIES_H
#define CUDA_INTEGER_COMPRESSION_UTILITIES_H

#include "../integer_utilities.h"

template <typename Torus> struct int_compression {
  int_radix_params compression_params;
  // Compression
  int8_t *fp_ks_buffer;
  Torus *tmp_lwe;
  Torus *tmp_glwe_array_out;
  bool gpu_memory_allocated;
  uint32_t num_lwes_stored_per_glwe;
  uint32_t max_num_glwes;

  // num_radix_blocks: total number of LWE ciphertexts (radix blocks) to
  // compress num_lwes_stored_per_glwe: max LWEs packed per GLWE (<=
  // polynomial_size), defined by the chosen parameter set
  int_compression(CudaStreams streams, int_radix_params compression_params,
                  uint32_t num_radix_blocks, uint32_t num_lwes_stored_per_glwe,
                  bool allocate_gpu_memory, uint64_t &size_tracker) {
    gpu_memory_allocated = allocate_gpu_memory;
    this->compression_params = compression_params;
    this->num_lwes_stored_per_glwe = num_lwes_stored_per_glwe;

    uint64_t glwe_accumulator_size = (compression_params.glwe_dimension + 1) *
                                     compression_params.polynomial_size;

    // Calculate the actual number of GLWEs needed based on total radix blocks.
    // This ensures we allocate enough memory when num_radix_blocks >
    // num_lwes_stored_per_glwe.
    max_num_glwes = CEIL_DIV(num_radix_blocks, num_lwes_stored_per_glwe);

    tmp_lwe = static_cast<Torus *>(cuda_malloc_with_size_tracking_async(
        safe_mul_sizeof<Torus>(
            (size_t)num_radix_blocks,
            (size_t)(compression_params.small_lwe_dimension + 1)),
        streams.stream(0), streams.gpu_index(0), size_tracker,
        allocate_gpu_memory));
    tmp_glwe_array_out =
        static_cast<Torus *>(cuda_malloc_with_size_tracking_async(
            safe_mul_sizeof<Torus>((size_t)max_num_glwes,
                                   glwe_accumulator_size),
            streams.stream(0), streams.gpu_index(0), size_tracker,
            allocate_gpu_memory));

    size_tracker += scratch_packing_keyswitch_lwe_list_to_glwe<Torus>(
        streams.stream(0), streams.gpu_index(0), &fp_ks_buffer,
        compression_params.small_lwe_dimension,
        compression_params.glwe_dimension, compression_params.polynomial_size,
        num_radix_blocks, allocate_gpu_memory);
  }
  void release(CudaStreams streams) {
    cuda_drop_with_size_tracking_async(
        tmp_lwe, streams.stream(0), streams.gpu_index(0), gpu_memory_allocated);
    tmp_lwe = nullptr;

    cuda_drop_with_size_tracking_async(tmp_glwe_array_out, streams.stream(0),
                                       streams.gpu_index(0),
                                       gpu_memory_allocated);
    tmp_glwe_array_out = nullptr;

    if constexpr (sizeof(Torus) == 8)
      cleanup_cuda_packing_keyswitch_lwe_list_to_glwe_64(
          streams.stream(0), streams.gpu_index(0), &fp_ks_buffer,
          gpu_memory_allocated);
    else
      cleanup_cuda_packing_keyswitch_lwe_list_to_glwe_128(
          streams.stream(0), streams.gpu_index(0), &fp_ks_buffer,
          gpu_memory_allocated);
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

template <typename Torus> struct int_decompression {
  int_radix_params encryption_params;
  int_radix_params compression_params;
  uint32_t num_blocks_to_decompress;

  Torus *tmp_extracted_glwe;
  Torus *tmp_extracted_lwe;
  uint32_t *tmp_indexes_array;

  int_radix_lut<Torus> *decompression_rescale_lut;
  bool gpu_memory_allocated;

  int_decompression(CudaStreams streams, int_radix_params encryption_params,
                    int_radix_params compression_params,
                    uint32_t num_blocks_to_decompress, bool allocate_gpu_memory,
                    uint64_t &size_tracker) {
    gpu_memory_allocated = allocate_gpu_memory;
    this->encryption_params = encryption_params;
    this->compression_params = compression_params;
    this->num_blocks_to_decompress = num_blocks_to_decompress;

    uint64_t glwe_accumulator_size = (compression_params.glwe_dimension + 1) *
                                     compression_params.polynomial_size;
    uint64_t lwe_accumulator_size = (compression_params.glwe_dimension *
                                         compression_params.polynomial_size +
                                     1);

    tmp_extracted_glwe = (Torus *)cuda_malloc_with_size_tracking_async(
        safe_mul_sizeof<Torus>((size_t)num_blocks_to_decompress,
                               glwe_accumulator_size),
        streams.stream(0), streams.gpu_index(0), size_tracker,
        allocate_gpu_memory);
    tmp_indexes_array = (uint32_t *)cuda_malloc_with_size_tracking_async(
        safe_mul_sizeof<uint32_t>((size_t)num_blocks_to_decompress),
        streams.stream(0), streams.gpu_index(0), size_tracker,
        allocate_gpu_memory);
    tmp_extracted_lwe = (Torus *)cuda_malloc_with_size_tracking_async(
        safe_mul_sizeof<Torus>((size_t)num_blocks_to_decompress,
                               lwe_accumulator_size),
        streams.stream(0), streams.gpu_index(0), size_tracker,
        allocate_gpu_memory);

    // rescale is only needed on 64-bit decompression
    if constexpr (std::is_same_v<Torus, uint64_t>) {
      // Rescale is done using an identity LUT
      // Here we do not divide by message_modulus
      // Example: in the 2_2 case we are mapping a 2-bit message onto a 4-bit
      // space, we want to keep the original 2-bit value in the 4-bit space,
      // so we apply the identity and the encoding will rescale it for us.
      decompression_rescale_lut = new int_radix_lut<Torus>(
          streams, encryption_params, 1, num_blocks_to_decompress,
          allocate_gpu_memory, size_tracker);
      auto decompression_rescale_f = [](Torus x) -> Torus { return x; };

      auto effective_compression_message_modulus =
          encryption_params.carry_modulus;
      auto effective_compression_carry_modulus = 1;

      auto active_streams = streams.active_gpu_subset(
          num_blocks_to_decompress,
          decompression_rescale_lut->params.pbs_type());
      decompression_rescale_lut->generate_and_broadcast_lut_with_encoding(
          active_streams, {0}, {decompression_rescale_f},
          effective_compression_message_modulus,
          effective_compression_carry_modulus,
          encryption_params.message_modulus, encryption_params.carry_modulus);
    }
  }
  void release(CudaStreams streams) {
    cuda_drop_with_size_tracking_async(tmp_extracted_glwe, streams.stream(0),
                                       streams.gpu_index(0),
                                       gpu_memory_allocated);

    tmp_extracted_glwe = nullptr;
    cuda_drop_with_size_tracking_async(tmp_extracted_lwe, streams.stream(0),
                                       streams.gpu_index(0),
                                       gpu_memory_allocated);
    tmp_extracted_lwe = nullptr;
    cuda_drop_with_size_tracking_async(tmp_indexes_array, streams.stream(0),
                                       streams.gpu_index(0),
                                       gpu_memory_allocated);
    tmp_indexes_array = nullptr;

    if constexpr (std::is_same_v<Torus, uint64_t>) {
      decompression_rescale_lut->release(streams);
      delete decompression_rescale_lut;
      decompression_rescale_lut = nullptr;
    }
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};
#endif

```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/integer/integer_utilities.h`
```
#ifndef CUDA_INTEGER_UTILITIES_H
#define CUDA_INTEGER_UTILITIES_H

#include "integer.h"
#include "integer/radix_ciphertext.cuh"
#include "integer/radix_ciphertext.h"
#include "keyswitch/keyswitch.h"
#include "pbs/pbs_multibit_utilities.h"
#include "pbs/pbs_utilities.h"
#include "pbs/programmable_bootstrap.cuh"
#include "utils/helper_multi_gpu.cuh"
#include <algorithm>
#include <cmath>
#include <functional>
#include <optional>
#include <queue>
#include <type_traits>

#include <stdio.h>

#include "checked_arithmetic.h"
#include "crypto/keyswitch.cuh"

/// Constant to indicate that all blocks should use LUT index 0
/// (no custom index generation needed).
/// Use this as the index_generator argument to generate_and_broadcast_lut
/// when all blocks should use the same LUT.
constexpr std::nullptr_t LUT_0_FOR_ALL_BLOCKS = nullptr;

/// @brief Computes the survivor count after one reserve-tail-and-absorb PBS
/// round of the kv_store one-hot sum (host_binary_tree_fold_sum).
///
/// Shared by scratch allocation and the host loop so the two cannot drift.
///
/// max_noise M = (message_modulus*carry_modulus-1)/(message_modulus-1) is the
/// max factor of degree-1 inputs summable before a PBS. Each fold level doubles
/// noise, so plain folding allows only L = floor(log2(M)) levels (factor
/// 2^L<M). Reserving a tail of floor(R/M)*(M-2^L) entries at noise 1 and
/// absorbing them one-per-survivor after the L levels lifts each survivor from
/// 2^L to M, reaching the full factor-M reduction. The survivor count equals
/// the front survivors after L levels (absorb does not change their count).
/// When R<M the reservation is skipped and folding stops at one entry.
///
/// @param num_entries      Number of one-hot entries entering this round
inline uint32_t kv_sum_pbs_round_survivors(uint32_t num_entries,
                                           uint32_t message_modulus,
                                           uint32_t carry_modulus) {
  if (num_entries <= 1)
    return num_entries;

  uint32_t max_noise =
      (message_modulus * carry_modulus - 1) / (message_modulus - 1);
  uint32_t fold_levels = log2_int(max_noise);

  uint32_t group_size = num_entries / max_noise;
  uint32_t reserved_tail = group_size * (max_noise - (1u << fold_levels));
  uint32_t remaining = num_entries - reserved_tail;

  for (uint32_t level = 0; level < fold_levels && remaining > 1; level++) {
    uint32_t half = remaining / 2;
    remaining = remaining - half;
  }
  return remaining;
}

/// Generate LUT indexes with a generator, validate them, and copy to any GPU
/// buffer.
///
/// @tparam Torus          Integer type for indexes
/// @tparam IndexGenerator Callable with signature: void(Torus* indexes,
/// uint32_t count)
/// @param streams              CUDA streams for async operations
/// @param generator            Function/lambda that fills the index buffer
/// @param d_lut_indexes        Destination GPU buffer for indexes
/// @param num_indexes          Number of indexes to generate
/// @param num_luts             Number of LUTs (for validation)
/// @param h_buffer             CPU buffer to use for staging. The caller that
/// created this buffer must sync before freeing)
template <typename Torus, typename IndexGenerator>
void generate_lut_indexes(CudaStreams streams, IndexGenerator generator,
                          Torus *d_lut_indexes, uint32_t num_indexes,
                          uint32_t num_luts, Torus *h_buffer,
                          bool gpu_memory_allocated) {
  GPU_ASSERT(h_buffer != nullptr, "h_buffer must be provided");

  // Initialize with sentinel value to detect uninitialized entries
  constexpr Torus sentinel = std::numeric_limits<Torus>::max();
  for (uint32_t i = 0; i < num_indexes; i++) {
    h_buffer[i] = sentinel;
  }

  generator(h_buffer, num_indexes);

  // Validate all indexes were initialized and are within bounds
  for (uint32_t i = 0; i < num_indexes; i++) {
    GPU_ASSERT(h_buffer[i] != sentinel,
               "LUT index not initialized: h_buffer[%u] was not set by "
               "generator",
               i);
    GPU_ASSERT(h_buffer[i] < num_luts,
               "LUT index out of bounds: h_buffer[%u] = %llu >= num_luts (%u)",
               i, (unsigned long long)h_buffer[i], num_luts);
  }

  cuda_memcpy_with_size_tracking_async_to_gpu(
      d_lut_indexes, h_buffer, safe_mul_sizeof<Torus>(num_indexes),
      streams.stream(0), streams.gpu_index(0), gpu_memory_allocated);
}

class NoiseLevel {
public:
  // Constants equivalent to the Rust code
  static const uint64_t NOMINAL = 1;
  static const uint64_t ZERO = 0;
  static const uint64_t UNKNOWN = std::numeric_limits<uint64_t>::max();
};

#if defined(DEBUG) || defined(DEBUG_FAKE_MULTI_GPU)
#define CHECK_NOISE_LEVEL(noise_level_expr, msg_mod, carry_mod)                \
  do {                                                                         \
    if ((msg_mod) == 2 && (carry_mod) == 2) {                                  \
      constexpr int max_noise_level = 3;                                       \
      if ((noise_level_expr) > max_noise_level)                                \
        PANIC("Cuda error: noise exceeds maximum authorized value for 1_1 "    \
              "parameters");                                                   \
    } else if ((msg_mod) == 2 && (carry_mod) == 1) {                           \
      /* Kreyvium Z_4 bit-extraction parameter set */                          \
      constexpr int max_noise_level = 14;                                      \
      const uint64_t nl = (noise_level_expr);                                  \
      if (nl > max_noise_level)                                                \
        PANIC("Cuda error: noise %lu exceeds maximum authorized value 14 "     \
              "for 2_1 parameters",                                            \
              (unsigned long)nl);                                              \
    } else if ((msg_mod) == 4 && (carry_mod) == 4) {                           \
      constexpr int max_noise_level = 5;                                       \
      if ((noise_level_expr) > max_noise_level)                                \
        PANIC(                                                                 \
            "Cuda error: noise %lu exceeds maximum authorized value 5 for 2_2" \
            " parameters",                                                     \
            (unsigned long)(noise_level_expr));                                \
    } else if ((msg_mod) == 8 && (carry_mod) == 8) {                           \
      constexpr int max_noise_level = 9;                                       \
      if ((noise_level_expr) > max_noise_level)                                \
        PANIC("Cuda error: noise exceeds maximum authorized value for 3_3 "    \
              "parameters");                                                   \
    } else if ((msg_mod) == 0 && (carry_mod) == 0) {                           \
      break;                                                                   \
    } else if ((msg_mod) == 4 && (carry_mod) == 32) {                          \
      break;                                                                   \
    } else {                                                                   \
      PANIC("Invalid message modulus or carry modulus")                        \
    }                                                                          \
  } while (0)
#else
#define CHECK_NOISE_LEVEL(noise_level_expr, message_modulus, carry_modulus)    \
  do {                                                                         \
  } while (0)
#endif

/// @brief Rotates the blocks of a radix ciphertext right by a given number of
/// positions.
///
/// Each CUDA block copies one source radix block to the destination position
/// shifted right by value modulo blocks_count, wrapping around the ends. The
/// rotation is out of place, so dst and src must not alias.
///
/// @param dst           Destination buffer receiving the rotated radix blocks
/// @param src           Source buffer holding the radix blocks to rotate
/// @param value         Number of positions to rotate right (taken modulo
///                      blocks_count)
/// @param blocks_count  Number of radix blocks to rotate
/// @param lwe_size      Number of Torus coefficients per block (lwe_dimension
///                      + 1)
template <typename Torus>
__global__ void radix_blocks_rotate_right(Torus *dst, Torus *src,
                                          uint32_t value, uint32_t blocks_count,
                                          uint32_t lwe_size);
/*
 *  generate bivariate accumulator (lut) for device pointer
 *    stream - cuda stream
 *    acc_bivariate - device pointer for bivariate accumulator
 *    ...
 *    f - wrapping function with two Torus inputs
 */
template <typename Torus>
void generate_device_accumulator_bivariate(
    cudaStream_t stream, uint32_t gpu_index, Torus *acc_bivariate,
    uint64_t *degree, uint64_t *max_degree, uint32_t glwe_dimension,
    uint32_t polynomial_size, uint32_t message_modulus, uint32_t carry_modulus,
    std::function<Torus(Torus, Torus)> f, bool gpu_memory_allocated);

template <typename Torus>
void generate_device_accumulator_bivariate_with_factor(
    cudaStream_t stream, uint32_t gpu_index, Torus *acc_bivariate,
    uint64_t *degree, uint64_t *max_degree, uint32_t glwe_dimension,
    uint32_t polynomial_size, uint32_t message_modulus, uint32_t carry_modulus,
    std::function<Torus(Torus, Torus)> f, int factor,
    bool gpu_memory_allocated);

template <typename Torus>
void generate_device_accumulator_with_encoding(
    cudaStream_t stream, uint32_t gpu_index, Torus *acc, uint64_t *degree,
    uint64_t *max_degree, uint32_t glwe_dimension, uint32_t polynomial_size,
    uint32_t input_message_modulus, uint32_t input_carry_modulus,
    uint32_t output_message_modulus, uint32_t output_carry_m
```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/integer/kv_store/kv_store_utilities.h`
```
#ifndef CUDA_INTEGER_KV_STORE_UTILITIES_H
#define CUDA_INTEGER_KV_STORE_UTILITIES_H

#include "../comparison.h"
#include "../vector_find.h"
#include "integer/cmux.cuh"
#include "integer/radix_ciphertext.cuh"

/// Entry-count threshold for the equality-selector algorithm
constexpr uint32_t KV_STORE_EQ_SELECTORS_SMALL_MAP_MAX_ENTRIES = 256;

/// @brief GPU scratch buffer for the few-entries equality-selector algorithm.
///
/// Given one encrypted radix key and num_possible_values block-decomposed
/// clear keys, computes one encrypted boolean per clear key via a grid PBS
/// followed by a batched tree AND-reduction.
///
/// @tparam Torus  Unsigned integer type representing a ciphertext torus element
template <typename Torus> struct int_kv_store_eq_selectors_small_map_buffer {
  int_radix_params params;
  bool allocate_gpu_memory;
  /// PBS LUT stride in torus elements, derived from ciphertext modulus
  uint32_t lut_stride;

  /// Number of cleartext key candidates (entries in the map)
  uint32_t num_possible_values;

  // Grid PBS
  /// Per-digit equality LUTs (one per message_modulus value)
  int_radix_lut<Torus> *comparison_luts;
  /// Grid PBS output: message_modulus x num_blocks equality indicators
  CudaRadixCiphertextFFI tmp_many_luts_output;

  /// Gathered per-candidate comparison blocks
  CudaRadixCiphertextFFI tmp_batched_comparisons;
  /// Device gather-index buffer for align_with_indexes
  Torus *d_map;
  /// Host gather-index buffer, copied to d_map before each use
  Torus *h_map;

  // Tree reduction
  /// Accumulator for tree-level block sums (null for single-block keys)
  CudaRadixCiphertextFFI *tree_accumulator;
  /// PBS output at each tree level (null for single-block keys)
  CudaRadixCiphertextFFI *tree_pbs_output;
  /// LUTs for the is-max-value check at each tree level
  int_radix_lut<Torus> *is_max_value_lut;
  /// Maximum sum before a PBS round: (msg*carry - 1) / (msg - 1)
  uint32_t max_value;
  /// Number of chunks per entry at the first tree level
  uint32_t max_chunks;

  // Per-level precomputed LUT-index buffers for the tree reduction.
  /// Depth of the AND-reduction tree (0 for single-block keys)
  uint32_t num_tree_levels;
  /// Device LUT-index arrays, one per tree level
  Torus **d_level_lut_indexes;

  /// @brief Allocates GPU buffers for the small-map equality-selector
  /// algorithm.
  ///
  /// @param num_possible_values  Number of cleartext key candidates
  /// @param num_blocks           Number of radix blocks per key
  int_kv_store_eq_selectors_small_map_buffer(CudaStreams streams,
                                             int_radix_params params,
                                             uint32_t num_possible_values,
                                             uint32_t num_blocks,
                                             bool allocate_gpu_memory,
                                             uint64_t &size_tracker) {
    this->params = params;
    this->allocate_gpu_memory = allocate_gpu_memory;
    this->num_possible_values = num_possible_values;

    uint32_t ciphertext_modulus = params.message_modulus * params.carry_modulus;
    uint32_t box_size = params.polynomial_size / ciphertext_modulus;
    lut_stride = (ciphertext_modulus / params.message_modulus) * box_size;

    // Grid PBS LUTs: one per possible block value
    this->comparison_luts = new int_radix_lut<Torus>(
        streams, params, 1, num_blocks, params.message_modulus,
        allocate_gpu_memory, size_tracker);

    std::vector<std::function<Torus(Torus)>> fs;
    fs.reserve(params.message_modulus);
    for (uint32_t i = 0; i < params.message_modulus; i++) {
      fs.push_back([i](Torus x) -> Torus { return (x == i); });
    }

    this->comparison_luts->generate_and_broadcast_many_lut(
        streams.active_gpu_subset(num_blocks, params.pbs_type()), {0}, {fs},
        LUT_0_FOR_ALL_BLOCKS);
    fs.clear();

    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), &this->tmp_many_luts_output,
        params.message_modulus * num_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);

    // Gather buffer: row-major layout [entry_0_blk_0, entry_0_blk_1, ...]
    uint64_t total_blocks64 = (uint64_t)num_possible_values * num_blocks;
    GPU_ASSERT(total_blocks64 <= UINT32_MAX,
               "num_possible_values * num_blocks must fit in uint32_t");
    uint32_t total_blocks = (uint32_t)total_blocks64;

    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), &this->tmp_batched_comparisons,
        total_blocks, params.big_lwe_dimension, size_tracker,
        allocate_gpu_memory);

    this->h_map = new Torus[total_blocks];
    this->d_map = (Torus *)cuda_malloc_with_size_tracking_async(
        safe_mul_sizeof<Torus>(total_blocks), streams.stream(0),
        streams.gpu_index(0), size_tracker, allocate_gpu_memory);

    // Tree reduction
    uint32_t total_modulus = params.message_modulus * params.carry_modulus;
    this->max_value = (total_modulus - 1) / (params.message_modulus - 1);
    this->max_chunks =
        (num_blocks > 1) ? CEIL_DIV(num_blocks, this->max_value) : 1;

    // A single-block key needs no AND-reduction: each candidate's one
    // comparison block already is its selector. Leave the tree resources null
    // and skip their allocation.
    if (num_blocks == 1) {
      this->tree_accumulator = nullptr;
      this->tree_pbs_output = nullptr;
      this->is_max_value_lut = nullptr;
      this->num_tree_levels = 0;
      this->d_level_lut_indexes = nullptr;
    } else {
      uint32_t acc_blocks = num_possible_values * this->max_chunks;
      uint32_t max_value = this->max_value;

      this->tree_accumulator = new CudaRadixCiphertextFFI;
      create_zero_radix_ciphertext_async<Torus>(
          streams.stream(0), streams.gpu_index(0), this->tree_accumulator,
          acc_blocks, params.big_lwe_dimension, size_tracker,
          allocate_gpu_memory);

      this->tree_pbs_output = new CudaRadixCiphertextFFI;
      create_zero_radix_ciphertext_async<Torus>(
          streams.stream(0), streams.gpu_index(0), this->tree_pbs_output,
          acc_blocks, params.big_lwe_dimension, size_tracker,
          allocate_gpu_memory);

      std::vector<uint32_t> level_num_chunks;
      std::vector<uint32_t> level_last_chunk_length;
      {
        uint32_t blocks_per_entry = num_blocks;
        while (blocks_per_entry > 1) {
          uint32_t num_chunks = CEIL_DIV(blocks_per_entry, max_value);
          uint32_t last_chunk_length =
              blocks_per_entry - (num_chunks - 1) * max_value;
          level_num_chunks.push_back(num_chunks);
          level_last_chunk_length.push_back(last_chunk_length);
          blocks_per_entry = num_chunks;
        }
      }
      this->num_tree_levels = static_cast<uint32_t>(level_num_chunks.size());

      uint32_t num_luts = 1 + this->num_tree_levels;
      this->is_max_value_lut =
          new int_radix_lut<Torus>(streams, params, num_luts, acc_blocks,
                                   allocate_gpu_memory, size_tracker);

      std::vector<uint32_t> lut_ids;
      std::vector<std::function<Torus(Torus)>> lut_fns;
      lut_ids.reserve(num_luts);
      lut_fns.reserve(num_luts);
      lut_ids.push_back(0);
      lut_fns.push_back(
          [max_value](Torus x) -> Torus { return x == max_value; });
      for (uint32_t L = 0; L < this->num_tree_levels; L++) {
        uint32_t lcl = level_last_chunk_length[L];
        lut_ids.push_back(L + 1);
        lut_fns.push_back([lcl](Torus x) -> Torus { return x == lcl; });
      }

      auto lut_active =
          streams.active_gpu_subset(acc_blocks, params.pbs_type());
      this->is_max_value_lut->generate_and_broadcast_lut(
          lut_active, lut_ids, lut_fns, LUT_0_FOR_ALL_BLOCKS);

      // Precompute one device LUT-index buffer per level. The last chunk of
      // each entry uses the level-specific slot when its length differs from
      // max_value; all other blocks use slot 0.
      this->d_level_lut_indexes = new Torus *[this->num_tree_levels];
      Torus *h_level_indexes = new Torus[acc_blocks];
      for (uint32_t L = 0; L < this->num_tree_levels; L++) {
        uint32_t num_chunks = level_num_chunks[L];
        uint32_t total_chunks = num_possible_values * num_chunks;
        bool special = (level_last_chunk_length[L] != max_value);
        for (uint32_t idx = 0; idx < acc_blocks; idx++) {
          if (special && idx < total_chunks &&
              (idx % num_chunks) == num_chunks - 1) {
            h_level_indexes[idx] = static_cast<Torus>(L + 1);
          } else {
            h_level_indexes[idx] = 0;
          }
        }
        this->d_level_lut_indexes[L] =
            (Torus *)cuda_malloc_with_size_tracking_async(
                safe_mul_sizeof<Torus>(acc_blocks), streams.stream(0),
                streams.gpu_index(0), size_tracker, allocate_gpu_memory);
        if (allocate_gpu_memory) {
          cuda_memcpy_async_to_gpu(this->d_level_lut_indexes[L],
                                   h_level_indexes,
                                   safe_mul_sizeof<Torus>(acc_blocks),
                                   streams.stream(0), streams.gpu_index(0));
        }
      }
      cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
      delete[] h_level_indexes;
    }
  }

  void release(CudaStreams streams) {
    this->comparison_luts->release(streams);
    delete this->comparison_luts;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   &this->tmp_many_luts_output,
                                   this->allocate_gpu_memory);

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   &this->tmp_batched_comparisons,
                                   this->allocate_gpu_memory);

    if (this->tree_accumulator != nullptr) {
      release_radix_ciphertext
```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/integer/rerand_utilities.h`
```
#pragma once

#include "checked_arithmetic.h"
#include "integer_utilities.h"
#include "keyswitch/ks_enums.h"
#include "rerand.h"
#include "zk/expand.cuh"
#include "zk/zk_utilities.h"

template <typename Torus> struct int_rerand_mem {
  int_radix_params params;

  Torus *tmp_expanded_zero_lwes = nullptr;
  Torus *tmp_ksed_expanded_zero_lwes = nullptr;
  Torus *lwe_trivial_indexes = nullptr;
  uint32_t num_lwes;
  RERAND_MODE rerand_mode;

  bool gpu_memory_allocated;

  expand_job<Torus> *d_expand_jobs = nullptr;
  expand_job<Torus> *h_expand_jobs = nullptr;

  int_rerand_mem(CudaStreams streams, int_radix_params params,
                 const uint32_t num_lwes, const RERAND_MODE rerand_mode,
                 const bool allocate_gpu_memory, uint64_t &size_tracker)
      : params(params), num_lwes(num_lwes), rerand_mode(rerand_mode),
        gpu_memory_allocated(allocate_gpu_memory) {

    tmp_expanded_zero_lwes =
        static_cast<Torus *>(cuda_malloc_with_size_tracking_async(
            safe_mul_sizeof<Torus>(num_lwes, params.big_lwe_dimension + 1),
            streams.stream(0), streams.gpu_index(0), size_tracker,
            allocate_gpu_memory));

    d_expand_jobs =
        static_cast<expand_job<Torus> *>(cuda_malloc_with_size_tracking_async(
            safe_mul_sizeof<expand_job<Torus>>(num_lwes), streams.stream(0),
            streams.gpu_index(0), size_tracker, allocate_gpu_memory));

    h_expand_jobs = static_cast<expand_job<Torus> *>(
        malloc(safe_mul_sizeof<expand_job<Torus>>(num_lwes)));
    PANIC_IF_FALSE(h_expand_jobs != nullptr,
                   "host allocation failed for h_expand_jobs");

    if (rerand_mode == RERAND_MODE::RERAND_WITH_KS) {
      tmp_ksed_expanded_zero_lwes =
          static_cast<Torus *>(cuda_malloc_with_size_tracking_async(
              safe_mul_sizeof<Torus>(num_lwes, params.small_lwe_dimension + 1),
              streams.stream(0), streams.gpu_index(0), size_tracker,
              allocate_gpu_memory));

      auto h_lwe_trivial_indexes =
          static_cast<Torus *>(malloc(safe_mul_sizeof<Torus>(num_lwes)));
      PANIC_IF_FALSE(h_lwe_trivial_indexes != nullptr,
                     "host allocation failed for h_lwe_trivial_indexes");
      for (uint32_t i = 0; i < num_lwes; ++i) {
        h_lwe_trivial_indexes[i] = i;
      }
      lwe_trivial_indexes =
          static_cast<Torus *>(cuda_malloc_with_size_tracking_async(
              safe_mul_sizeof<Torus>(num_lwes), streams.stream(0),
              streams.gpu_index(0), size_tracker, allocate_gpu_memory));
      cuda_memcpy_with_size_tracking_async_to_gpu(
          lwe_trivial_indexes, h_lwe_trivial_indexes,
          safe_mul_sizeof<Torus>(num_lwes), streams.stream(0),
          streams.gpu_index(0), allocate_gpu_memory);
      cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
      free(h_lwe_trivial_indexes);
    } else {
      cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
    }
  }

  void release(CudaStreams streams) {
    cuda_drop_with_size_tracking_async(tmp_expanded_zero_lwes,
                                       streams.stream(0), streams.gpu_index(0),
                                       gpu_memory_allocated);
    tmp_expanded_zero_lwes = nullptr;
    cuda_drop_with_size_tracking_async(d_expand_jobs, streams.stream(0),
                                       streams.gpu_index(0),
                                       gpu_memory_allocated);
    d_expand_jobs = nullptr;

    if (rerand_mode == RERAND_MODE::RERAND_WITH_KS) {
      cuda_drop_with_size_tracking_async(
          tmp_ksed_expanded_zero_lwes, streams.stream(0), streams.gpu_index(0),
          gpu_memory_allocated);
      tmp_ksed_expanded_zero_lwes = nullptr;
      cuda_drop_with_size_tracking_async(lwe_trivial_indexes, streams.stream(0),
                                         streams.gpu_index(0),
                                         gpu_memory_allocated);
      lwe_trivial_indexes = nullptr;
    }

    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
    free(h_expand_jobs);
    h_expand_jobs = nullptr;
  }
};

```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/integer/shuffle_utilities.h`
```
#pragma once
#include "checked_arithmetic.h"
#include "comparison.h"
#include "integer_utilities.h"
#include "oprf.h"

/// @brief Forward declaration of the re-randomization scratch buffer.
template <typename Torus> struct int_rerand_mem;

/**
 * @brief Scratch buffer for batched encrypted key comparisons. Holds
 * contiguous lhs/rhs key blocks for all pairs, intermediate packing and
 * tree-reduction buffers, and the precomputed LUTs needed by
 * bitonic_sort_compare_phase_batched.
 */
template <typename Torus> struct int_batched_compare_buffer {
  int_radix_params params;
  /// @brief Number of radix blocks per key; must be >= 3.
  uint32_t key_num_blocks;
  /// @brief Number of packed blocks per key after pair-packing:
  /// ceil(key_num_blocks/2).
  uint32_t packed_per_pair;
  bool gpu_memory_allocated;

  /// @brief Contiguous buffer of all K lhs keys (keys[i], the lower-index
  /// element
  ///        of each pair): K * key_num_blocks blocks.
  CudaRadixCiphertextFFI *lhs_data;
  /// @brief Contiguous buffer of all K rhs keys (keys[i ^
  /// bitonic_subsequence_stride],
  ///        the higher-index element of each pair): K * key_num_blocks blocks.
  CudaRadixCiphertextFFI *rhs_data;

  /// @brief Temporary buffer for pair-packed lhs and rhs blocks: 2 * K *
  /// packed_per_pair blocks.
  CudaRadixCiphertextFFI *tmp_packed;
  /// @brief Per-block comparison verdicts after is_non_zero PBS: K *
  /// packed_per_pair blocks.
  CudaRadixCiphertextFFI *comparisons;
  /// @brief Tree reduction working buffer, current level.
  CudaRadixCiphertextFFI *tree_x;
  /// @brief Tree reduction working buffer, next level.
  CudaRadixCiphertextFFI *tree_y;
  /// @brief Final EQ or IS_SUPERIOR verdict per pair: K blocks.
  CudaRadixCiphertextFFI *comparison_results;

  /// @brief Identity LUT used to refresh noise on packed blocks before
  /// subtraction.
  int_radix_lut<Torus> *identity_lut;
  /// @brief Univariate LUT mapping any non-zero value to 1, zero to 0.
  int_radix_lut<Torus> *is_non_zero_lut;
  /// @brief Bivariate LUT implementing block_selector for inner tree levels:
  ///        returns IS_SUPERIOR if either packed verdict is not EQ.
  int_radix_lut<Torus> *is_any_not_equal_lut;
  /// @brief Univariate variant of is_any_not_equal_lut operating on a
  /// pre-packed
  ///        value; used at the final tree step to save one PBS.
  int_radix_lut<Torus> *is_any_not_equal_packed_lut;

  int_batched_compare_buffer(CudaStreams streams, int_radix_params params,
                             uint32_t max_num_pairs, uint32_t key_num_blocks,
                             bool allocate_gpu_memory, uint64_t &size_tracker) {
    this->params = params;
    this->key_num_blocks = key_num_blocks;
    this->gpu_memory_allocated = allocate_gpu_memory;

    if (params.carry_modulus < params.message_modulus || key_num_blocks < 3 ||
        max_num_pairs == 0)
      PANIC("Cuda error: int_batched_compare_buffer invariant violated "
            "(carry >= message, key_num_blocks >= 3, max_num_pairs > 0)");

    uint32_t M = (key_num_blocks + 1u) / 2u;
    this->packed_per_pair = M;
    uint32_t K = max_num_pairs;
    uint32_t tree_first_blocks = K * ((M + 1u) / 2u);

    lhs_data = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), lhs_data, K * key_num_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);
    rhs_data = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), rhs_data, K * key_num_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    tmp_packed = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), tmp_packed, 2 * K * M,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    comparisons = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), comparisons, K * M,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);
    tree_x = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), tree_x, K * M,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);
    tree_y = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), tree_y, K * M,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);
    comparison_results = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), comparison_results, K,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    uint32_t total_modulus = params.message_modulus * params.carry_modulus;
    auto identity_f = [](Torus x) -> Torus { return x; };
    auto is_non_zero_f = [total_modulus](Torus x) -> Torus {
      return (x % total_modulus) != 0;
    };
    auto num_bits_in_message =
        static_cast<Torus>(log2_int(params.message_modulus));
    auto msg_mod = static_cast<Torus>(params.message_modulus);
    auto block_selector_f = [](Torus msb, Torus lsb) -> Torus {
      return (msb == IS_EQUAL) ? lsb : msb;
    };
    auto last_leaf_f = [block_selector_f, num_bits_in_message,
                        msg_mod](Torus x) -> Torus {
      Torus msb = (x >> num_bits_in_message) & (msg_mod - 1);
      Torus lsb = x & (msg_mod - 1);
      return block_selector_f(msb, lsb);
    };

    identity_lut = new int_radix_lut<Torus>(streams, params, 1, 2 * K * M,
                                            allocate_gpu_memory, size_tracker);
    auto active_id = streams.active_gpu_subset(2 * K * M, params.pbs_type());
    identity_lut->generate_and_broadcast_lut(active_id, {0}, {identity_f},
                                             LUT_0_FOR_ALL_BLOCKS);

    is_non_zero_lut = new int_radix_lut<Torus>(
        streams, params, 1, K * M, allocate_gpu_memory, size_tracker);
    auto active_nz = streams.active_gpu_subset(K * M, params.pbs_type());
    is_non_zero_lut->generate_and_broadcast_lut(active_nz, {0}, {is_non_zero_f},
                                                LUT_0_FOR_ALL_BLOCKS);

    uint32_t tree_inner_blocks = tree_first_blocks > 0 ? tree_first_blocks : K;
    is_any_not_equal_lut =
        new int_radix_lut<Torus>(streams, params, 1, tree_inner_blocks,
                                 allocate_gpu_memory, size_tracker);
    auto active_inner =
        streams.active_gpu_subset(tree_inner_blocks, params.pbs_type());
    is_any_not_equal_lut->generate_and_broadcast_bivariate_lut(
        active_inner, {0}, {block_selector_f}, LUT_0_FOR_ALL_BLOCKS);

    is_any_not_equal_packed_lut = new int_radix_lut<Torus>(
        streams, params, 1, K, allocate_gpu_memory, size_tracker);
    auto active_last = streams.active_gpu_subset(K, params.pbs_type());
    is_any_not_equal_packed_lut->generate_and_broadcast_lut(
        active_last, {0}, {last_leaf_f}, LUT_0_FOR_ALL_BLOCKS);
  }

  void release(CudaStreams streams) {
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   lhs_data, gpu_memory_allocated);
    delete lhs_data;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   rhs_data, gpu_memory_allocated);
    delete rhs_data;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   tmp_packed, gpu_memory_allocated);
    delete tmp_packed;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   comparisons, gpu_memory_allocated);
    delete comparisons;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   tree_x, gpu_memory_allocated);
    delete tree_x;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   tree_y, gpu_memory_allocated);
    delete tree_y;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   comparison_results, gpu_memory_allocated);
    delete comparison_results;
    identity_lut->release(streams);
    delete identity_lut;
    is_non_zero_lut->release(streams);
    delete is_non_zero_lut;
    is_any_not_equal_lut->release(streams);
    delete is_any_not_equal_lut;
    is_any_not_equal_packed_lut->release(streams);
    delete is_any_not_equal_packed_lut;
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

/**
 * @brief Scratch buffer to conditionally swap both keys and data
 * simultaneously.
 */
template <typename Torus> struct int_fused_cmux_buffer {
  int_radix_params params;
  /// @brief Number of radix blocks per key.
  uint32_t key_num_blocks;
  /// @brief Number of radix blocks per data element.
  uint32_t data_num_blocks;
  bool gpu_memory_allocated;

  /// @brief Input buffer holding both branches in layout
  ///        [ keys_is_superior | data_is_superior | keys_is_equal |
  ///        data_is_equal ].
  CudaRadixCiphertextFFI *batch_buffer_in;
  /// @brief Output buffer after the bivariate predicate PBS; same layout as
  /// batch_buffer_in.
  CudaRadixCiphertextFFI *batch_buffer_out;
  /// @brief Comparison result (EQ or IS_SUPERIOR) broadcast across all blocks
  /// of each pair.
  CudaRadixCiphertextFFI *batch_condition;

  /// @brief Bivariate LUT that zeros the losing branch per block: passes b if
  ///        cond == IS_SUPERIOR (is_superior half) or cond != IS_SUPERIOR
  ///        (is_equal half).
  int_radix_lut<Torus> *predicate_lut;
  /// @brief Univariate LUT for message extraction (x -> x % message_modulus)
  /// applied
  ///        after adding the two halves to re-bootstrap before the next
  ///        substep.
  int
```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/kreyvium/fast_kreyvium_utilities.h`
```
#ifndef FAST_KREYVIUM_UTILITIES_H
#define FAST_KREYVIUM_UTILITIES_H
#include "../integer/integer_utilities.h"

// FastKreyvium specific constants
// The batch size is set to 64 to allow efficient parallel processing of 64
// steps at once.
constexpr uint32_t FAST_KREYVIUM_BATCH_SIZE = 64;

// In each Kreyvium step there are 3 register-feedback bits to compute. The
// 1152-cycle warm-up emits no keystream, so it only needs these 3 paths:
// 1. New bit for Register A
// 2. New bit for Register B
// 3. New bit for Register C
// Unlike the standard Kreyvium loop, FastKreyvium fuses each register's
// non-linear AND into a single ZZ_4 bit-extraction PBS, so there is no longer
// a separate AND-gate count: the 3 feedback paths are the 3 PBS per warm-up
// batch.
constexpr uint32_t FAST_KREYVIUM_NUM_FEEDBACK_PATHS = 3;

// In each Kreyvium step there are 4 paths that require a bit-extraction
// to noise-cancel and extract the bit. The keystream phase uses all 4:
// 1. New bit for Register A
// 2. New bit for Register B
// 3. New bit for Register C
// 4. The Output Keystream bit
// Sizing the packed accumulator for all 4 paths covers both phases (the
// warm-up populates only the first 3).
constexpr uint32_t FAST_KREYVIUM_NUM_OUTPUT_PATHS = 4;

constexpr uint32_t FAST_KREYVIUM_REGISTER_A_BITS = 93;
constexpr uint32_t FAST_KREYVIUM_REGISTER_B_BITS = 84;
constexpr uint32_t FAST_KREYVIUM_REGISTER_C_BITS = 111;
constexpr uint32_t FAST_KREYVIUM_KEY_BITS = 128;
constexpr uint32_t FAST_KREYVIUM_IV_BITS = 128;

// Standard Kreyvium warm-up: 1152 cycles before the first keystream bit is
// emitted, processed in batches of FAST_KREYVIUM_BATCH_SIZE.
constexpr uint32_t FAST_KREYVIUM_WARMUP_CYCLES = 1152;
constexpr uint32_t FAST_KREYVIUM_WARMUP_BATCHES =
    FAST_KREYVIUM_WARMUP_CYCLES / FAST_KREYVIUM_BATCH_SIZE;

// During init, c[1..67] are set to 1 per the Kreyvium spec: 66 bits starting
// at offset 1 in the 111-bit C register.
constexpr uint32_t FAST_KREYVIUM_C_ONES_OFFSET = 1;
constexpr uint32_t FAST_KREYVIUM_C_ONES_COUNT = 66;

/// @brief LUT buffer holding the single bit-extraction accumulator used by the
/// ZZ_4 FastKreyvium loop.
///
/// The FastKreyvium algorithm represents every state bit as a ZZ_4-scaled
/// {0,1} ciphertext (body value 0 or Delta, with Delta = q/4). Each round's
/// boolean "XOR-of-many XOR (AND-of-two)" is built as a single linear
/// combination over ZZ_4 whose most significant (padding) bit equals the
/// boolean. That bit is read off with one univariate bit-extraction PBS, so a
/// single LUT replaces the old bivariate AND LUT plus the univariate flush LUT.
///
/// @tparam Torus  Unsigned integer type representing a ciphertext torus element
template <typename Torus> struct int_fast_kreyvium_lut_buffers {
  /// Univariate bit-extraction LUT shared by all 3-or-4 accumulator paths
  int_radix_lut<Torus> *bitext_lut;

  Torus delta;

  /// @brief Builds the raw bit-extraction LUT for the ZZ_4 FastKreyvium loop.
  ///
  /// @param num_inputs  Number of independent keystreams processed in parallel
  int_fast_kreyvium_lut_buffers(CudaStreams streams,
                                const int_radix_params &params,
                                bool allocate_gpu_memory, uint32_t num_inputs,
                                uint64_t &size_tracker) {

    constexpr uint32_t nbits = sizeof(Torus) * 8;
    // Delta = q / (message_modulus * carry_modulus * 2). The extra factor of 2
    // is the padding bit, so the plaintext space below the padding bit holds
    // message_modulus * carry_modulus values. For (2,1) this is Delta = q/4.
    this->delta = (static_cast<Torus>(1) << (nbits - 1)) /
                  (params.message_modulus * params.carry_modulus);

    // The bit-extraction PBS is applied once per accumulator path; the packed
    // launch covers up to FAST_KREYVIUM_NUM_OUTPUT_PATHS paths.
    uint32_t bitext_ops =
        num_inputs * FAST_KREYVIUM_BATCH_SIZE * FAST_KREYVIUM_NUM_OUTPUT_PATHS;

    this->bitext_lut = new int_radix_lut<Torus>(
        streams, params, 1, bitext_ops, allocate_gpu_memory, size_tracker);

    // Raw MSB/padding-bit test polynomial: constant term 0, all other body
    // coefficients -Delta/2. This is NOT a message-space x&1 LUT, so it is
    // generated with use_encoding=false to write the body coefficients
    // verbatim instead of going through the boxed message encoding.
    const Torus neg_half_delta = -(this->delta / 2);
    std::function<Torus(Torus)> bitext_lambda =
        [neg_half_delta](Torus i) -> Torus {
      return (i == 0) ? static_cast<Torus>(0) : neg_half_delta;
    };

    auto active_streams =
        streams.active_gpu_subset(bitext_ops, params.pbs_type());
    this->bitext_lut->generate_and_broadcast_lut(
        active_streams, {0}, {bitext_lambda}, LUT_0_FOR_ALL_BLOCKS,
        /*use_encoding=*/false);

    // The BitExt PBS always outputs a clean
    // {0,Delta} bit. Writes the true degree (1) so the accumulator's degree
    // stays accurate.
    *this->bitext_lut->get_degree(0) = 1;
  }

  void release(CudaStreams streams) {
    this->bitext_lut->release(streams);
    delete this->bitext_lut;
    this->bitext_lut = nullptr;

    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

/// @brief GPU scratch buffers for one ZZ_4 FastKreyvium 64-step batch.
///
/// Registers a/b/c/k/iv are owned by the state and are
/// passed into each call. The packed accumulator holds the 3-or-4 linear
/// combinations side by side so a single bit-extraction PBS covers all of them.
///
/// @tparam Torus  Unsigned integer type representing a ciphertext torus element
template <typename Torus> struct int_fast_kreyvium_workspaces {
  /// Scratch used by shift-and-insert and by Key/IV bit reversal
  CudaRadixCiphertextFFI *shift_workspace;
  /// Packed accumulator input to the bit-extraction PBS (4 paths)
  CudaRadixCiphertextFFI *packed_acc;
  /// Packed bit-extraction PBS output (4 paths)
  CudaRadixCiphertextFFI *packed_out;

  /// @brief Allocates the scratch buffers for the ZZ_4 FastKreyvium loop.
  ///
  /// @param num_inputs  Number of independent keystreams processed in parallel
  int_fast_kreyvium_workspaces(CudaStreams streams,
                               const int_radix_params &params,
                               bool allocate_gpu_memory, uint32_t num_inputs,
                               uint64_t &size_tracker) {
    uint32_t batch_blocks = FAST_KREYVIUM_BATCH_SIZE * num_inputs;
    this->shift_workspace = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->shift_workspace,
        FAST_KREYVIUM_KEY_BITS * num_inputs, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
    this->packed_acc = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_acc,
        FAST_KREYVIUM_NUM_OUTPUT_PATHS * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
    this->packed_out = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_out,
        FAST_KREYVIUM_NUM_OUTPUT_PATHS * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
  }

  void release(CudaStreams streams, bool allocate_gpu_memory) {
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->shift_workspace, allocate_gpu_memory);
    delete this->shift_workspace;
    this->shift_workspace = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_acc, allocate_gpu_memory);
    delete this->packed_acc;
    this->packed_acc = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_out, allocate_gpu_memory);
    delete this->packed_out;
    this->packed_out = nullptr;
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

/// @brief GPU buffer for the ZZ_4 FastKreyvium stream cipher.
///
/// @tparam Torus  Unsigned integer type representing a ciphertext torus element
template <typename Torus> struct int_fast_kreyvium_buffer {
  int_radix_params params;
  bool allocate_gpu_memory;
  uint32_t num_inputs; ///< Number of independent keystreams in parallel
  int_fast_kreyvium_lut_buffers<Torus> *luts; ///< Bit-extraction LUT
  int_fast_kreyvium_workspaces<Torus> *ws;    ///< Per-batch scratch buffers

  /// @brief Allocates the LUT and scratch buffers for the FastKreyvium loop.
  ///
  /// @param num_inputs  Number of independent keystreams processed in parallel
  int_fast_kreyvium_buffer(CudaStreams streams, const int_radix_params &params,
                           bool allocate_gpu_memory, uint32_t num_inputs,
                           uint64_t &size_tracker) {
    this->params = params;
    this->allocate_gpu_memory = allocate_gpu_memory;
    this->num_inputs = num_inputs;
    this->luts = new int_fast_kreyvium_lut_buffers<Torus>(
        streams, params, allocate_gpu_memory, num_inputs, size_tracker);
    this->ws = new int_fast_kreyvium_workspaces<Torus>(
        streams, params, allocate_gpu_memory, num_inputs, size_tracker);
  }

  void release(CudaStreams streams) {
    luts->release(streams);
    delete luts;
    luts = nullptr;
    ws->release(streams, allocate_gpu_memory);
    delete ws;
    ws = nullptr;
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

#endif

```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/kreyvium/kreyvium_utilities.h`
```
#ifndef KREYVIUM_UTILITIES_H
#define KREYVIUM_UTILITIES_H
#include "../integer/integer_utilities.h"

// Kreyvium specific constants
// The batch size is set to 64 to allow efficient parallel processing of 64
// steps at once.
constexpr uint32_t KREYVIUM_BATCH_SIZE = 64;

// In each Kreyvium step, there are exactly 3 non-linear AND operations:
// 1. (c109 & c108)
// 2. (a91 & a90)
// 3. (b82 & b81)
constexpr uint32_t KREYVIUM_NUM_AND_GATES = 3;

// In each Kreyvium step, there are 4 paths that require a "flush"
// to noise-cancel and extract the bit:
// 1. New bit for Register A
// 2. New bit for Register B
// 3. New bit for Register C
// 4. The Output Keystream bit
constexpr uint32_t KREYVIUM_NUM_FLUSH_PATHS = 4;
constexpr uint32_t KREYVIUM_REGISTER_A_BITS = 93;
constexpr uint32_t KREYVIUM_REGISTER_B_BITS = 84;
constexpr uint32_t KREYVIUM_REGISTER_C_BITS = 111;
constexpr uint32_t KREYVIUM_KEY_BITS = 128;
constexpr uint32_t KREYVIUM_IV_BITS = 128;

// Standard Kreyvium warm-up: 1152 cycles before the first keystream bit is
// emitted, processed in batches of KREYVIUM_BATCH_SIZE.
constexpr uint32_t KREYVIUM_WARMUP_CYCLES = 1152;
constexpr uint32_t KREYVIUM_WARMUP_BATCHES =
    KREYVIUM_WARMUP_CYCLES / KREYVIUM_BATCH_SIZE;

// During init, c[1..67] are set to 1 per the Kreyvium spec: 66 bits starting
// at offset 1 in the 111-bit C register.
constexpr uint32_t KREYVIUM_C_ONES_OFFSET = 1;
constexpr uint32_t KREYVIUM_C_ONES_COUNT = 66;

/// Struct to hold the LUTs.
template <typename Torus> struct int_kreyvium_lut_buffers {
  // Bivariate AND Gate LUT:
  // AND operation: f(a, b) = (a & 1) & (b & 1).
  // This is a Bivariate PBS used for the non-linear parts of Kreyvium.
  int_radix_lut<Torus> *and_lut;

  // Univariate Flush/Identity LUT:
  // MESSAGE EXTRACTION operation: f(x) = x & 1.
  // This is a Univariate PBS used to "flush" the state (reset noise/carries).
  int_radix_lut<Torus> *flush_lut;

  int_kreyvium_lut_buffers(CudaStreams streams, const int_radix_params &params,
                           bool allocate_gpu_memory, uint32_t num_inputs,
                           uint64_t &size_tracker) {

    uint32_t and_ops =
        num_inputs * KREYVIUM_BATCH_SIZE * KREYVIUM_NUM_AND_GATES;
    uint32_t flush_ops =
        num_inputs * KREYVIUM_BATCH_SIZE * KREYVIUM_NUM_FLUSH_PATHS;

    // BIVARIATE AND LUT
    //
    this->and_lut = new int_radix_lut<Torus>(streams, params, 1, and_ops,
                                             allocate_gpu_memory, size_tracker);

    std::function<Torus(Torus, Torus)> and_lambda =
        [](Torus lhs, Torus rhs) -> Torus { return (lhs & 1) & (rhs & 1); };

    auto active_streams_and =
        streams.active_gpu_subset(and_ops, params.pbs_type());

    this->and_lut->generate_and_broadcast_bivariate_lut(
        active_streams_and, {0}, {and_lambda}, LUT_0_FOR_ALL_BLOCKS);

    // UNIVARIATE FLUSH LUTS
    //
    std::function<Torus(Torus)> flush_lambda = [](Torus x) -> Torus {
      return x & 1;
    };
    this->flush_lut = new int_radix_lut<Torus>(
        streams, params, 1, flush_ops, allocate_gpu_memory, size_tracker);
    auto active_streams_flush =
        streams.active_gpu_subset(flush_ops, params.pbs_type());

    this->flush_lut->generate_and_broadcast_lut(
        active_streams_flush, {0}, {flush_lambda}, LUT_0_FOR_ALL_BLOCKS);
  }

  void release(CudaStreams streams) {
    this->and_lut->release(streams);
    delete this->and_lut;
    this->and_lut = nullptr;

    this->flush_lut->release(streams);
    delete this->flush_lut;
    this->flush_lut = nullptr;

    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

// Holds the temporary GPU buffers and workspaces required during the
// execution of the Kreyvium cipher. Registers a/b/c/k/iv are owned by the
// caller (the persistent state) and passed in to each call.
//
template <typename Torus> struct int_kreyvium_workspaces {
  CudaRadixCiphertextFFI *shift_workspace;
  CudaRadixCiphertextFFI *temp_a;
  CudaRadixCiphertextFFI *temp_b;
  CudaRadixCiphertextFFI *temp_c;
  CudaRadixCiphertextFFI *packed_and_lhs;
  CudaRadixCiphertextFFI *packed_and_rhs;
  CudaRadixCiphertextFFI *packed_and_out;
  CudaRadixCiphertextFFI *packed_flush_in;
  CudaRadixCiphertextFFI *packed_flush_out;

  int_kreyvium_workspaces(CudaStreams streams, const int_radix_params &params,
                          bool allocate_gpu_memory, uint32_t num_inputs,
                          uint64_t &size_tracker) {
    uint32_t batch_blocks = KREYVIUM_BATCH_SIZE * num_inputs;
    this->shift_workspace = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->shift_workspace,
        KREYVIUM_KEY_BITS * num_inputs, params.big_lwe_dimension, size_tracker,
        allocate_gpu_memory);
    this->temp_a = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->temp_a, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);
    this->temp_b = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->temp_b, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);
    this->temp_c = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->temp_c, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);
    this->packed_and_lhs = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_and_lhs,
        KREYVIUM_NUM_AND_GATES * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
    this->packed_and_rhs = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_and_rhs,
        KREYVIUM_NUM_AND_GATES * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
    this->packed_and_out = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_and_out,
        KREYVIUM_NUM_AND_GATES * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
    this->packed_flush_in = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_flush_in,
        KREYVIUM_NUM_FLUSH_PATHS * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
    this->packed_flush_out = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_flush_out,
        KREYVIUM_NUM_FLUSH_PATHS * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
  }

  void release(CudaStreams streams, bool allocate_gpu_memory) {
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->shift_workspace, allocate_gpu_memory);
    delete this->shift_workspace;
    this->shift_workspace = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->temp_a, allocate_gpu_memory);
    delete this->temp_a;
    this->temp_a = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->temp_b, allocate_gpu_memory);
    delete this->temp_b;
    this->temp_b = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->temp_c, allocate_gpu_memory);
    delete this->temp_c;
    this->temp_c = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_and_lhs, allocate_gpu_memory);
    delete this->packed_and_lhs;
    this->packed_and_lhs = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_and_rhs, allocate_gpu_memory);
    delete this->packed_and_rhs;
    this->packed_and_rhs = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_and_out, allocate_gpu_memory);
    delete this->packed_and_out;
    this->packed_and_out = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_flush_in, allocate_gpu_memory);
    delete this->packed_flush_in;
    this->packed_flush_in = nullptr;
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_flush_out, allocate_gpu_memory);
    delete this->packed_flush_out;
    this->packed_flush_out = nullptr;
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

template <typename Torus> struct int_kreyvium_buffer {
  int_radix_params params;
  bool allocate_gpu_memory;
  uint32_t num_inputs;
  int_kreyvium_lut_buffers<Torus> *luts;
  int_kreyvium_workspaces<Torus> *ws;

  int_kreyvium_buffer(CudaStreams streams, const int_radix_params &params,
                      bool allocate_gpu_memory, uint32_t num_inputs,
                      uint64_t &size_tracker) {
    this->params = params;
    this->allocate_gpu_memory = allocate_gpu_memory;
    this->num_inputs = num_inputs;
    this->luts = new int_kreyvium_lut_buffers<Torus>(
        streams, params, allocate_gpu_memory, num_inputs, size_tracker);
    this->ws = new int_kreyvium_workspaces<Torus>(
        streams, params, allocate_gpu_memory, num_inputs, size_tracker);
  }

  void release(CudaStreams streams) {
    luts->release(streams);
    delete luts;
    luts = nullptr;
    w
```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/pbs/pbs_128_utilities.h`
```
#ifndef CUDA_BOOTSTRAP_128_H
#define CUDA_BOOTSTRAP_128_H

#include "bootstrap_key_params.h"
#include "pbs_enums.h"
#include <stdint.h>

uint64_t scratch_cuda_programmable_bootstrap_128_vector_64(
    void *stream, uint32_t gpu_index, int8_t **pbs_buffer,
    const CudaLweBootstrapKeyParamsFFI &bsk_params,
    uint32_t input_lwe_ciphertext_count, bool allocate_gpu_memory);

#endif // CUDA_BOOTSTRAP_128_H

```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/pbs/pbs_multibit_utilities.h`
```
#ifndef CUDA_MULTI_BIT_UTILITIES_H
#define CUDA_MULTI_BIT_UTILITIES_H

#include "checked_arithmetic.h"
#include "pbs_utilities.h"

template <typename Torus>
bool supports_distributed_shared_memory_on_multibit_programmable_bootstrap(
    uint32_t polynomial_size, uint32_t max_shared_memory);

template <typename Torus>
bool has_support_to_cuda_programmable_bootstrap_tbc_multi_bit(
    uint32_t num_samples, const CudaLweBootstrapKeyParamsFFI &bsk_params,
    uint32_t max_shared_memory);

// The variant the multi-bit scratch selects for num_samples inputs.
template <typename Torus>
PBS_VARIANT
get_multi_bit_pbs_variant(uint32_t gpu_index,
                          const CudaLweBootstrapKeyParamsFFI &bsk_params,
                          uint32_t num_samples);
template <>
PBS_VARIANT get_multi_bit_pbs_variant<uint64_t>(
    uint32_t gpu_index, const CudaLweBootstrapKeyParamsFFI &bsk_params,
    uint32_t num_samples);

#if CUDA_ARCH >= 900
template <typename Torus>
uint64_t scratch_cuda_tbc_multi_bit_programmable_bootstrap(
    void *stream, uint32_t gpu_index, pbs_buffer<Torus, MULTI_BIT> **buffer,
    const CudaLweBootstrapKeyParamsFFI &bsk_params,
    uint32_t input_lwe_ciphertext_count, bool allocate_gpu_memory);

template <typename Torus>
void cuda_tbc_multi_bit_programmable_bootstrap_lwe_ciphertext_vector_async(
    void *stream, uint32_t gpu_index, Torus *lwe_array_out,
    Torus const *lwe_output_indexes, Torus const *lut_vector,
    Torus const *lut_vector_indexes, Torus const *lwe_array_in,
    Torus const *lwe_input_indexes, Torus const *bootstrapping_key,
    pbs_buffer<Torus, MULTI_BIT> *pbs_buffer,
    const CudaLweBootstrapKeyParamsFFI &bsk_params, uint32_t num_samples,
    uint32_t num_many_lut, uint32_t lut_stride);
#endif

template <typename Torus>
uint64_t scratch_cuda_cg_multi_bit_programmable_bootstrap(
    void *stream, uint32_t gpu_index, pbs_buffer<Torus, MULTI_BIT> **pbs_buffer,
    const CudaLweBootstrapKeyParamsFFI &bsk_params,
    uint32_t input_lwe_ciphertext_count, bool allocate_gpu_memory);

template <typename Torus>
void cuda_cg_multi_bit_programmable_bootstrap_lwe_ciphertext_vector_async(
    void *stream, uint32_t gpu_index, Torus *lwe_array_out,
    Torus const *lwe_output_indexes, Torus const *lut_vector,
    Torus const *lut_vector_indexes, Torus const *lwe_array_in,
    Torus const *lwe_input_indexes, Torus const *bootstrapping_key,
    pbs_buffer<Torus, MULTI_BIT> *pbs_buffer,
    const CudaLweBootstrapKeyParamsFFI &bsk_params, uint32_t num_samples,
    uint32_t num_many_lut, uint32_t lut_stride);

template <typename Torus>
uint64_t scratch_cuda_multi_bit_programmable_bootstrap(
    void *stream, uint32_t gpu_index, pbs_buffer<Torus, MULTI_BIT> **pbs_buffer,
    const CudaLweBootstrapKeyParamsFFI &bsk_params,
    uint32_t input_lwe_ciphertext_count, bool allocate_gpu_memory);

template <typename Torus>
void cuda_multi_bit_programmable_bootstrap_lwe_ciphertext_vector_async(
    void *stream, uint32_t gpu_index, Torus *lwe_array_out,
    Torus const *lwe_output_indexes, Torus const *lut_vector,
    Torus const *lut_vector_indexes, Torus const *lwe_array_in,
    Torus const *lwe_input_indexes, Torus const *bootstrapping_key,
    pbs_buffer<Torus, MULTI_BIT> *pbs_buffer,
    const CudaLweBootstrapKeyParamsFFI &bsk_params, uint32_t num_samples,
    uint32_t num_many_lut, uint32_t lut_stride);

template <typename Torus>
uint64_t get_buffer_size_full_sm_multibit_programmable_bootstrap_keybundle(
    uint32_t polynomial_size);
template <typename Torus>
uint64_t get_buffer_size_full_sm_multibit_programmable_bootstrap_step_one(
    uint32_t polynomial_size);
template <typename Torus>
uint64_t get_buffer_size_full_sm_multibit_programmable_bootstrap_step_two(
    uint32_t polynomial_size);
template <typename Torus>
uint64_t get_buffer_size_partial_sm_multibit_programmable_bootstrap_step_one(
    uint32_t polynomial_size);
template <typename Torus>
uint64_t get_buffer_size_full_sm_cg_multibit_programmable_bootstrap(
    uint32_t polynomial_size);
template <typename Torus>
uint64_t get_buffer_size_partial_sm_cg_multibit_programmable_bootstrap(
    uint32_t polynomial_size);
template <typename Torus>
uint64_t get_buffer_size_sm_dsm_plus_tbc_multibit_programmable_bootstrap(
    uint32_t polynomial_size);
template <typename Torus>
uint64_t get_buffer_size_partial_sm_tbc_multibit_programmable_bootstrap(
    uint32_t polynomial_size);
template <typename Torus>
uint64_t get_buffer_size_full_sm_tbc_multibit_programmable_bootstrap(
    uint32_t polynomial_size);

template <typename Torus, class params>
uint64_t get_lwe_chunk_size(uint32_t gpu_index, uint32_t max_num_pbs,
                            const CudaLweBootstrapKeyParamsFFI &bsk_params,
                            uint64_t full_sm_keybundle);
template <typename Torus, class params>
uint64_t get_lwe_chunk_size_128(uint32_t gpu_index, uint32_t max_num_pbs,
                                const CudaLweBootstrapKeyParamsFFI &bsk_params,
                                uint64_t full_sm_keybundle);
template <typename Torus>
struct pbs_buffer<Torus, PBS_TYPE::MULTI_BIT> : public pbs_buffer_base {
  using fft_element_type = typename pbs_fft_traits<Torus>::element_type;

  int8_t *d_mem_keybundle = nullptr;
  int8_t *d_mem_acc_step_one = nullptr;
  int8_t *d_mem_acc_step_two = nullptr;
  int8_t *d_mem_acc_cg = nullptr;
  int8_t *d_mem_acc_tbc = nullptr;
  uint64_t lwe_chunk_size;
  fft_element_type *keybundle_fft = nullptr;
  Torus *global_accumulator = nullptr;
  fft_element_type *global_join_buffer = nullptr;

  PBS_VARIANT pbs_variant;
  bool gpu_memory_allocated;

  uint32_t glwe_dimension;
  uint32_t polynomial_size;
  uint32_t level_count;
  uint32_t input_lwe_ciphertext_count;
  uint32_t max_shared_memory;
  uint32_t max_num_inputs() const override {
    return input_lwe_ciphertext_count;
  }

private:
  // Variant-free part: shared fields plus the buffers every multi-bit variant
  // uses (keybundle scratch, keybundle FFT, accumulator, join buffer).
  pbs_buffer(cudaStream_t stream, uint32_t gpu_index,
             const CudaLweBootstrapKeyParamsFFI &bsk_params,
             uint32_t input_lwe_ciphertext_count, uint64_t lwe_chunk_size,
             bool allocate_gpu_memory, uint64_t &size_tracker)
      : lwe_chunk_size(lwe_chunk_size),
        gpu_memory_allocated(allocate_gpu_memory),
        glwe_dimension(bsk_params.glwe_dimension),
        polynomial_size(bsk_params.polynomial_size),
        level_count(bsk_params.level_count),
        input_lwe_ciphertext_count(input_lwe_ciphertext_count) {
    cuda_set_device(gpu_index);
    max_shared_memory = cuda_get_max_shared_memory(gpu_index);

    uint64_t full_sm_keybundle =
        get_buffer_size_full_sm_multibit_programmable_bootstrap_keybundle<
            Torus>(polynomial_size);
    size_t num_blocks_keybundle = keybundle_block_count();

    if (max_shared_memory < full_sm_keybundle)
      d_mem_keybundle = (int8_t *)cuda_malloc_with_size_tracking_async(
          safe_mul(num_blocks_keybundle, full_sm_keybundle), stream, gpu_index,
          size_tracker, allocate_gpu_memory);

    keybundle_fft = (fft_element_type *)cuda_malloc_with_size_tracking_async(
        safe_mul(pbs_fft_traits<Torus>::coefficient_bytes, num_blocks_keybundle,
                 (size_t)(polynomial_size / 2)),
        stream, gpu_index, size_tracker, allocate_gpu_memory);
    global_accumulator = (Torus *)cuda_malloc_with_size_tracking_async(
        safe_mul_sizeof<Torus>((size_t)input_lwe_ciphertext_count,
                               (size_t)(glwe_dimension + 1),
                               (size_t)polynomial_size),
        stream, gpu_index, size_tracker, allocate_gpu_memory);
    global_join_buffer =
        (fft_element_type *)cuda_malloc_with_size_tracking_async(
            safe_mul(
                pbs_fft_traits<Torus>::coefficient_bytes,
                safe_mul((size_t)level_count, (size_t)(glwe_dimension + 1)),
                (size_t)input_lwe_ciphertext_count,
                (size_t)(polynomial_size / 2)),
            stream, gpu_index, size_tracker, allocate_gpu_memory);
  }

  size_t keybundle_block_count() const {
    return safe_mul(
        (size_t)input_lwe_ciphertext_count, (size_t)lwe_chunk_size,
        safe_mul((size_t)(glwe_dimension + 1), (size_t)(glwe_dimension + 1)),
        (size_t)level_count);
  }

  size_t accumulator_block_count() const {
    return safe_mul((size_t)level_count, (size_t)(glwe_dimension + 1),
                    (size_t)input_lwe_ciphertext_count);
  }

  // Device scratch for an accumulate kernel: full_sm bytes per block when the
  // kernel runs in NOSM mode, partial_sm bytes per block in PARTIALSM mode,
  // nothing when everything fits. minimum_sm is shared memory the kernel needs
  // in every mode (TBC uses it for distributed shared memory), so it raises
  // both thresholds. Returns nullptr when nothing is needed.
  int8_t *allocate_accumulator_scratch(size_t num_blocks, uint64_t partial_sm,
                                       uint64_t full_sm, cudaStream_t stream,
                                       uint32_t gpu_index,
                                       uint64_t &size_tracker,
                                       uint64_t minimum_sm = 0) {
    uint64_t bytes_per_block = 0;
    if (max_shared_memory < partial_sm + minimum_sm)
      bytes_per_block = full_sm;
    else if (max_shared_memory < full_sm + minimum_sm)
      bytes_per_block = partial_sm;
    if (bytes_per_block == 0)
      return nullptr;
    return (int8_t *)cuda_malloc_with_size_tracking_async(
        safe_mul(num_blocks, bytes_per_block), stream, gpu_index, size_tracker,
        gpu_memory_allocated);
  }

public:
  pbs_buffer(cudaStream_t stream, uint32_t gpu_index,
             const CudaLweBootstrapKeyParamsFFI &bsk_params,
             uint32_t input_lwe_ciphertext_count, uint64_t lwe_chunk_size,
             pbs_variant_tag<PBS_VARIANT::DEFAULT>, bool allocate_gpu_memory,
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2083** (2025-02-22): **Signed Division Support on CUDA**
  *Symptoms*: **Describe the bug** In the [GPU acceleration](https://docs.zama.ai/tfhe-rs/guides/run_on_gpu) tutorial, the list of supported operations indicates that signed division is available.  However, when executing a signed division operation on a CUDA device, the operation results in a panic with the message "Division '/' is not yet supported by Cuda devices" in `tfhe/src/high_level_api/integers/signed/ops.rs`.   **To Reproduce** Since I used the C API when working with TFHE-rs, I reproduced this issue through the C API. You can reproduce it with the following code. ```c++     Config* config = nullptr;     ConfigBuilder* config_builder = nullptr;      config_builder_default(&config_builder);     config_builder_build(config_builder, &config);     ClientKey* client_key = nullptr;     client_key_generate(config, &client_key);     CompressedServerKey* compressed_server_key = nullptr;     compressed_server_key_new(client_key, &compressed_server_key);     CudaServerKey* cuda_server_key = nullptr;     compressed_server_key_decompress_to_gpu(compressed_server_key, &cuda_server_key);     set_cuda_server_key(cuda_server_key);     PublicKey* public_key;     public_key_new(client_key, &public_key);      FheInt32* a = nullptr;     FheInt32* b = nullptr;     fhe_int32_try_encrypt_with_public_key_i32(10, public_key, &a);     fhe_int32_try_encrypt_with_public_key_i32(2, public_key, &b);     FheInt32* result = nullptr;     fhe_int32_div(a, b, &result);     fhe_int32_destroy(a);     fhe_int32_destro

- **Issue #2037** (2025-09-18): **Range of Barrett intermediate result**
  *Symptoms*: I have found that the implementation of Barrett reduction can give incorrect results in some cases. Here is an example:  ```rust use concrete_ntt::prime32::Plan;  fn main() {     let p: u32 = 0x7fe0_1001;     let polynomial_size = 1024;     let plan = Plan::try_new(polynomial_size, p).unwrap();      let value = 0x6e63593a;     let mut acc = [0u32; 8];     let input = [value, 0, 0, 0, 0, 0, 0, 0];      plan.mul_accumulate(&mut acc, &input, &input);      let expected = (u64::from(value) * u64::from(value) % u64::from(p)) as u32;     println!("acc[0] = {}", acc[0]);     assert_eq!(acc[0], expected); } ```  The output is: ``` acc[0] = 360086499 thread 'main' panicked at examples/reduction.rs:16:5: assertion `left == right` failed   left: 360086499  right: 364272609 ```  Note that 364272609 - 360086499 = 4186110 = 2 * (0x8000_0000 - 0x7fe0_1001). Performing two conditional subtractions at the conclusion of the algorithm, rather than one, would have given the correct result. (Unfortunately, there are not enough bits in the intermediate result to see that two conditional subtractions are necessary.)  The possible need for two conditional subtractions was noted in Barrett's paper ("Our calculations show that the result x so obtained will always be in the range 0 to 3M - 1") and is also captured in https://eprint.iacr.org/2015/785 ("approximates the result $c = d \bmod n$ by a quasi-reduced number $c + \epsilon n$ where $0 \le \epsilon \le 2$"), but is omitted by the presentation in h
  **Post-Mortem & Fix Analysis**:
  > transferring to the repo where this will be maintained
  > thanks for the report

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

### Incident Patch 1: `51c20e76` (2026-11-24)
**Commit Message**: fix(integer)!: make encrypted rotations behavior consistent (#4191)

Rotations by an encrypted amount (value rot amount)
did a modulo: `amount % next_power_of_two(num_bits(value))`

This was so that the modulo was always a truncation of bits/blocks
thus, really cheap. However it created an inconsistent behavior
when `num_bits(value)` was not a power of two because:

* if is_power_of_two(num_bits(value)) then
        num_bits(value) == next_power_of_two(num_bits(value))
        e.g  FheUint8 << x
        num_bits(value) = 8, 8 is a power of two, so we would
        do modulo x % 8
* else
        num_bits(value) != next_power_of_two(num_bits(value))
        e.g  FheUint6 << x
        num_bits(value) = 6, 6 is a not power of two, its next
        power of two is 8,
        do modulo x % 8 and not x % 6 which means a different result
        depending on x

Now we call scalar_rem to do the modulo on non powers of two to make
the operation consitent

This induces a performance cost for these types/sizes,
there are techniques which should work to do modulo by small
amount (since the reduction amount is a number of bits and so relatively
small) that we should explore later to improve the 

**File**: `tfhe/src/integer/gpu/server_key/radix/tests_signed/legacy_default_tests.rs` (modified, +131/-3)
```diff
@@ -7,8 +7,15 @@
 //! full propagation cannot take blocks at the maximum degree yet. The overflowing scalar tests also
 //! cover scalars that fit the radix blocks but not the signed range, for which the GPU
 //! implementations return the opposite overflow flag: the CPU fix is `ScalarOverflowFlagSource` in
-//! `radix_parallel::scalar_add`, which the GPU can reuse. Once both are addressed point the
-//! GPU wrappers at the harness tests and delete this file.
+//! `radix_parallel::scalar_add`, which the GPU can reuse.
+//!
+//! The rotations by an encrypted amount also differ: the CPU reduces the amount modulo the
+//! number of bits (see `unchecked_rotate_bits_assign` in `radix_parallel::rotate`), the GPU
+//! only reads its low ⌈log₂(num_bits)⌉ bits, i.e. reduces it modulo the next power of two,
+//! which the rotate tests of this file (unchecked ones included) still model.
+//!
+//! Once all are addressed point the GPU wrappers at the harness tests and the CPU unchecked
+//! tests, and delete this file.
 use crate::core_crypto::prelude::SignedNumeric;
 use crate::integer::block_decomposition::{DecomposableInto, RecomposableSignedInteger};
 use crate::integer::keycache::KEY_CACHE;
@@ -20,7 +27,8 @@ use crate::integer::server_key::radix_parallel::tests_signed::{
     signed_right_shift_under_modulus,
 };
 use crate::integer::server_key::radix_parallel::tests_unsigned::{
-    nb_tests_smaller_for_params, panic_if_any_block_is_not_clean_or_trivial, MAX_NB_CTXT, NB_CTXT,
+    nb_tests_for_params, nb_tests_smaller_for_params, panic_if_any_block_is_not_clean_or_trivial,
+    MAX_NB_CTXT, NB_CTXT,
 };
 use crate::integer::{
     BooleanBlock, IntegerKeyKind, RadixCiphertext, RadixClientKey, SignedRadixCiphertext,
@@ -1349,3 +1357,123 @@ where
         }
     }
 }
+
+pub(crate) fn legacy_signed_unchecked_rotate_left_test<P, T>(param: P, mut executor: T)
+where
+    P: Into<TestParameters>,
+    T: for<'a> FunctionExecutor<
+        (&'a SignedRadixCiphertext, &'a RadixCiphertext),
+        SignedRadixCiphertext,
+    >,
+{
+    let param = param.into();
+    let nb_tests = nb_tests_for_params(param);
+    let (cks, sks) = KEY_CACHE.get_from_params(param, IntegerKeyKind::Radix);
+    let cks = RadixClientKey::from((cks, NB_CTXT));
+    let sks = Arc::new(sks);
+
+    let mut rng = rand::thread_rng();
+
+    executor.setup(&cks, sks);
+
+    let modulus = (cks.parameters().message_modulus().0.pow(NB_CTXT as u32) / 2) as i64;
+
+    assert!(modulus > 0);
+    assert!((modulus as u64).is_power_of_two());
+    let nb_bits = modulus.ilog2() + 1; // We are using signed numbers
+
+    for _ in 0..nb_tests {
+        let clear = rng.gen::<i64>() % modulus;
+        let clear_shift = rng.gen::<u32>();
+
+        let ct = cks.encrypt_signed(clear);
+
+        // case when 0 <= rotate < nb_bits
+        {
+            let clear_shift = clear_shift % nb_bits;
+            let shift = cks.encrypt(clear_shift as u64);
+            let ct_res = executor.execute((&ct, &shift));
+            let dec_res: i64 = cks.decrypt_signed(&ct_res);
+            let expected = rotate_left_helper(clear, clear_shift, nb_bits);
+            assert_eq!(expected, dec_res);
+        }
+
+        // case when shift >= nb_bits
+        {
+            let clear_shift = clear_shift.saturating_add(nb_bits);
+            let shift = cks.encrypt(clear_shift as u64);
+            let ct_res = executor.execute((&ct, &shift));
+            panic_if_any_block_is_not_clean_or_trivial(&ct_res, &cks);
+            let dec_res: i64 = cks.decrypt_signed(&ct_res);
+            // When nb_bits is not a power of two
+            // then the behaviour is not the same
+            let true_nb_bits = nb_bits;
+            let mut nb_bits = nb_bits;
+            if !nb_bits.is_power_of_two() {
+                nb_bits = nb_bits.next_power_of_two();
+            }
+            let expected = rotate_left_helper(clear, clear_shift % nb_bits, true_nb_bits);
+            assert_eq!(expected, dec_res);
+        }
+    }
+}
+
+pub(crate) fn legacy_signed_unchecked_rotate_right_test<P, T>(param: P, mut executor: T)
+where
+    P: Into<TestParameters>,
+    T: for<'a> FunctionExecutor<
+        (&'a SignedRadixCiphertext, &'a RadixCiphertext),
+        SignedRadixCiphertext,
+    >,
+{
+    let param = param.into();
+    let nb_tests = nb_tests_for_params(param);
+    let (cks, sks) = KEY_CACHE.get_from_params(param, IntegerKeyKind::Radix);
+    let cks = RadixClientKey::from((cks, NB_CTXT));
+    let sks = Arc::new(sks);
+
+    let mut rng = rand::thread_rng();
+
+    executor.setup(&cks, sks);
+
+    let modulus = (cks.parameters().message_modulus().0.pow(NB_CTXT as u32) / 2) as i64;
+
+    assert!(modulus > 0);
+    assert!((modulus as u64).is_power_of_two());
+    let nb_bits = modulus.ilog2() + 1; // We are using signed numbers
+
+    for _ in 0..nb_tests {
+        let clear = rng.gen::<i64>() % modulus;
+        let clear_shift = rng.gen::<u32>();
+
+        let ct = cks.
```

**File**: `tfhe/src/integer/gpu/server_key/radix/tests_signed/test_rotate.rs` (modified, +3/-5)
```diff
@@ -1,13 +1,11 @@
 use super::legacy_default_tests::{
     legacy_signed_default_rotate_left_test, legacy_signed_default_rotate_right_test,
+    legacy_signed_unchecked_rotate_left_test, legacy_signed_unchecked_rotate_right_test,
 };
 use crate::integer::gpu::server_key::radix::tests_unsigned::{
     create_gpu_parameterized_test, GpuFunctionExecutor,
 };
 use crate::integer::gpu::CudaServerKey;
-use crate::integer::server_key::radix_parallel::tests_signed::test_rotate::{
-    signed_unchecked_rotate_left_test, signed_unchecked_rotate_right_test,
-};
 use crate::shortint::parameters::test_params::*;
 use crate::shortint::parameters::*;
 
@@ -39,7 +37,7 @@ where
     P: Into<TestParameters> + Copy,
 {
     let executor = GpuFunctionExecutor::new(&CudaServerKey::unchecked_rotate_right);
-    signed_unchecked_rotate_right_test(param, executor);
+    legacy_signed_unchecked_rotate_right_test(param, executor);
 }
 
 fn integer_default_rotate_right<P>(param: P)
@@ -55,7 +53,7 @@ where
     P: Into<TestParameters> + Copy,
 {
     let executor = GpuFunctionExecutor::new(&CudaServerKey::unchecked_rotate_left);
-    signed_unchecked_rotate_left_test(param, executor);
+    legacy_signed_unchecked_rotate_left_test(param, executor);
 }
 
 fn integer_default_rotate_left<P>(param: P)
```

**File**: `tfhe/src/integer/gpu/server_key/radix/tests_unsigned/legacy_default_tests.rs` (modified, +118/-2)
```diff
@@ -6,8 +6,14 @@
 //! `test_sum`, `test_neg` and `test_comparison`), which also exercises inputs at the maximum
 //! degree and noise level.
 //! The GPU full propagation cannot take blocks at the maximum degree yet.
-//! Once it is aligned with the CPU one point the GPU wrappers at the harness
-//! tests and delete this file.
+//!
+//! The rotations by an encrypted amount also differ: the CPU reduces the amount modulo the
+//! number of bits (see `unchecked_rotate_bits_assign` in `radix_parallel::rotate`), the GPU
+//! only reads its low ⌈log₂(num_bits)⌉ bits, i.e. reduces it modulo the next power of two,
+//! which the rotate tests of this file (unchecked ones included) still model.
+//!
+//! Once both are aligned with the CPU point the GPU wrappers at the harness tests and the CPU
+//! unchecked tests, and delete this file.
 use crate::core_crypto::prelude::UnsignedNumeric;
 use crate::integer::block_decomposition::{DecomposableInto, RecomposableFrom};
 use crate::integer::ciphertext::{IntegerCiphertext, IntegerRadixCiphertext};
@@ -1153,3 +1159,113 @@ where
         }
     }
 }
+
+pub(crate) fn legacy_unchecked_rotate_left_test<P, T>(param: P, mut executor: T)
+where
+    P: Into<TestParameters>,
+    T: for<'a> FunctionExecutor<(&'a RadixCiphertext, &'a RadixCiphertext), RadixCiphertext>,
+{
+    let param = param.into();
+    let nb_tests = nb_tests_for_params(param);
+    let (cks, sks) = KEY_CACHE.get_from_params(param, IntegerKeyKind::Radix);
+    let sks = Arc::new(sks);
+    let cks = RadixClientKey::from((cks, NB_CTXT));
+
+    let mut rng = rand::thread_rng();
+
+    // message_modulus^vec_length
+    let modulus = cks.parameters().message_modulus().0.pow(NB_CTXT as u32);
+    assert!(modulus.is_power_of_two());
+    let nb_bits = modulus.ilog2();
+
+    executor.setup(&cks, sks);
+
+    for _ in 0..nb_tests {
+        let clear = rng.gen::<u64>() % modulus;
+        let clear_shift = rng.gen::<u32>();
+
+        let ct = cks.encrypt(clear);
+
+        // case when 0 <= rotate < nb_bits
+        {
+            let clear_rotate = clear_shift % nb_bits;
+            let shift = cks.encrypt(clear_rotate as u64);
+            let encrypted_result = executor.execute((&ct, &shift));
+            let decrypted_result: u64 = cks.decrypt(&encrypted_result);
+            let expected = rotate_left_helper(clear, clear_rotate, nb_bits);
+            assert_eq!(expected, decrypted_result);
+        }
+
+        // case when shift >= nb_bits
+        {
+            let clear_rotate = clear_shift.saturating_add(nb_bits);
+            let shift = cks.encrypt(clear_rotate as u64);
+            let encrypted_result = executor.execute((&ct, &shift));
+            let decrypted_result: u64 = cks.decrypt(&encrypted_result);
+            // When nb_bits is not a power of two
+            // then the behaviour is not the same
+            let true_nb_bits = nb_bits;
+            let mut nb_bits = nb_bits;
+            if !nb_bits.is_power_of_two() {
+                nb_bits = nb_bits.next_power_of_two();
+            }
+            let expected = rotate_left_helper(clear, clear_rotate % nb_bits, true_nb_bits);
+            assert_eq!(expected, decrypted_result);
+        }
+    }
+}
+
+pub(crate) fn legacy_unchecked_rotate_right_test<P, T>(param: P, mut executor: T)
+where
+    P: Into<TestParameters>,
+    T: for<'a> FunctionExecutor<(&'a RadixCiphertext, &'a RadixCiphertext), RadixCiphertext>,
+{
+    let param = param.into();
+    let nb_tests = nb_tests_for_params(param);
+    let (cks, sks) = KEY_CACHE.get_from_params(param, IntegerKeyKind::Radix);
+    let sks = Arc::new(sks);
+    let cks = RadixClientKey::from((cks, NB_CTXT));
+
+    let mut rng = rand::thread_rng();
+
+    // message_modulus^vec_length
+    let modulus = cks.parameters().message_modulus().0.pow(NB_CTXT as u32);
+    assert!(modulus.is_power_of_two());
+    let nb_bits = modulus.ilog2();
+
+    executor.setup(&cks, sks);
+
+    for _ in 0..nb_tests {
+        let clear = rng.gen::<u64>() % modulus;
+        let clear_shift = rng.gen::<u32>();
+
+        let ct = cks.encrypt(clear);
+
+        // case when 0 <= rotate < nb_bits
+        {
+            let clear_rotate = clear_shift % nb_bits;
+            let shift = cks.encrypt(clear_rotate as u64);
+            let encrypted_result = executor.execute((&ct, &shift));
+            let decrypted_result: u64 = cks.decrypt(&encrypted_result);
+            let expected = rotate_right_helper(clear, clear_rotate, nb_bits);
+            assert_eq!(expected, decrypted_result);
+        }
+
+        // case when shift >= nb_bits
+        {
+            let clear_rotate = clear_shift.saturating_add(nb_bits);
+            let shift = cks.encrypt(clear_rotate as u64);
+            let encrypted_result = executor.execute((&ct, &shift));
+            let decrypted_result: u64 = cks.decrypt(&encrypted_result);
+            // When nb_bits is not a power of two
+            // then the behaviour is not the sa
```

**File**: `tfhe/src/integer/gpu/server_key/radix/tests_unsigned/test_rotate.rs` (modified, +3/-5)
```diff
@@ -1,13 +1,11 @@
 use super::legacy_default_tests::{
     legacy_default_rotate_left_test, legacy_default_rotate_right_test,
+    legacy_unchecked_rotate_left_test, legacy_unchecked_rotate_right_test,
 };
 use crate::integer::gpu::server_key::radix::tests_unsigned::{
     create_gpu_parameterized_test, GpuFunctionExecutor,
 };
 use crate::integer::gpu::CudaServerKey;
-use crate::integer::server_key::radix_parallel::tests_unsigned::test_rotate::{
-    unchecked_rotate_left_test, unchecked_rotate_right_test,
-};
 use crate::shortint::parameters::test_params::*;
 use crate::shortint::parameters::*;
 
@@ -41,7 +39,7 @@ where
     P: Into<TestParameters> + Copy,
 {
     let executor = GpuFunctionExecutor::new(&CudaServerKey::unchecked_rotate_right);
-    unchecked_rotate_right_test(param, executor);
+    legacy_unchecked_rotate_right_test(param, executor);
 }
 
 fn integer_default_rotate_right<P>(param: P)
@@ -57,7 +55,7 @@ where
     P: Into<TestParameters> + Copy,
 {
     let executor = GpuFunctionExecutor::new(&CudaServerKey::unchecked_rotate_left);
-    unchecked_rotate_left_test(param, executor);
+    legacy_unchecked_rotate_left_test(param, executor);
 }
 
 fn integer_default_rotate_left<P>(param: P)
```

**File**: `tfhe/src/integer/server_key/radix_parallel/rotate.rs` (modified, +82/-3)
```diff
@@ -1,6 +1,7 @@
 use super::shift::BarrelShifterOperation;
+use crate::integer::bigint::{U1024, U2048};
 use crate::integer::ciphertext::{IntegerRadixCiphertext, RadixCiphertext};
-use crate::integer::ServerKey;
+use crate::integer::{ServerKey, U256, U512};
 
 impl ServerKey {
     //======================================================================
@@ -20,7 +21,7 @@ impl ServerKey {
     where
         T: IntegerRadixCiphertext,
     {
-        self.unchecked_shift_rotate_bits_assign(ct, n, BarrelShifterOperation::RightRotate);
+        self.unchecked_rotate_bits_assign(ct, n, BarrelShifterOperation::RightRotate);
     }
 
     /// Computes homomorphically a rotation of bits.
@@ -86,7 +87,85 @@ impl ServerKey {
     where
         T: IntegerRadixCiphertext,
     {
-        self.unchecked_shift_rotate_bits_assign(ct, n, BarrelShifterOperation::LeftRotate);
+        self.unchecked_rotate_bits_assign(ct, n, BarrelShifterOperation::LeftRotate);
+    }
+
+    /// Rotates the bits of `ct` by `amount` reduced modulo the number of bits of `ct`.
+    ///
+    ///
+    /// Inputs must not have carries.
+    fn unchecked_rotate_bits_assign<T>(
+        &self,
+        ct: &mut T,
+        amount: &RadixCiphertext,
+        operation: BarrelShifterOperation,
+    ) where
+        T: IntegerRadixCiphertext,
+    {
+        assert!(matches!(
+            operation,
+            BarrelShifterOperation::LeftRotate | BarrelShifterOperation::RightRotate
+        ));
+
+        let bits_per_block = self.message_modulus().0.ilog2();
+        let num_bits_encrypted_by_ct = ct.blocks().len() as u64 * u64::from(bits_per_block);
+        let num_bits_encrypted_by_amount = amount.blocks.len() as u32 * bits_per_block;
+
+        // For all block sizes, unchecked_shift_rotate_assign uses a barrel shifter,
+        // which truncates the `amount` to only take the ⌈log₂(num_bits)⌉.
+        // This is a modular reduction  only when `num_bits` is a power of two.
+        // For non powers of two, Rotating a radix that encrypts 6 bits, by `8`
+        // would rotate by 0 instead of 2 (8 % 6 = 2, 8 % 2^⌈log₂(6)⌉ = 8 % 8 = 0)
+        //
+        // So to have the consistent modular reduction `amount % nb_bits(ct)`, we will
+        // use a scalar_rem, but for powers of two we can skip it.
+        //
+        // And there's a reason we skip the call to the remainder op:
+        // the remainder op would introduce a PBS, to cut the bits of the last block
+        // when the number of bits to keep is not a multiple of the number of bits in a block.
+        // The truncation of the barrel shifter used in the rotate does it naturally, without
+        // extra cost.
+        // e.g: rot(FheUint32, x), 2_2 params -> num_bits_encrypted_by_ct = 32 -> it is power of 2,
+        // the number of bits to keep is log2(32) = 5, 5 is not a multiple of 2, thus the remainder
+        // op would do a PBS to clear the high bit of the 3rd block, whereas the barrel shifter
+        // already handles this trimming nicely
+        if num_bits_encrypted_by_ct.is_power_of_two() {
+            self.unchecked_shift_rotate_bits_assign(ct, amount, operation);
+            return;
+        }
+
+        // The scalar division requires the scalar type used to have a number of bits >= to the
+        // number of bits the ciphertext encrypts
+        //
+        // The ciphertext we use in the division is the `amount`, so we need to pick a scalar type
+        // that has at least as many bits as what `amount` encrypts. This type is used to
+        // store the number of bits encrypted by the `ct` to be rotated
+        //
+        // So that we can do `amount` % num_bits_encrypted_by_ct
+        //
+        // Currently there's a limit that amount cannot encrypt more than 2048 bits,
+        // but don't be lost, it does not mean amount can encrypt a value in [0, 2048], but
+        // that it can encrypt a value in [0, 2**2048[
+        let amount = if num_bits_encrypted_by_amount <= u64::BITS {
+            self.unchecked_scalar_rem_parallelized(amount, num_bits_encrypted_by_ct)
+        } else if num_bits_encrypted_by_amount <= u128::BITS {
+            self.unchecked_scalar_rem_parallelized(amount, u128::from(num_bits_encrypted_by_ct))
+        } else if num_bits_encrypted_by_amount <= 256 {
+            self.unchecked_scalar_rem_parallelized(amount, U256::from(num_bits_encrypted_by_ct))
+        } else if num_bits_encrypted_by_amount <= 512 {
+            self.unchecked_scalar_rem_parallelized(amount, U512::from(num_bits_encrypted_by_ct))
+        } else if num_bits_encrypted_by_amount <= 1024 {
+            self.unchecked_scalar_rem_parallelized(amount, U1024::from(num_bits_encrypted_by_ct))
+        } else if num_bits_encrypted_by_amount <= 2048 {
+            self.unchecked_scalar_rem_parallelized(amount, U2048::from(num_bits_encrypted_by_ct))
+        } else {
+            panic!(
+                "rotations by an `amount` that encrypts more than
```

**File**: `tfhe/src/integer/server_key/radix_parallel/scalar_bitwise_op.rs` (modified, +15/-2)
```diff
@@ -1,6 +1,7 @@
 use crate::integer::block_decomposition::{BlockDecomposer, DecomposableInto};
 use crate::integer::ciphertext::IntegerRadixCiphertext;
 use crate::integer::ServerKey;
+use crate::shortint::ciphertext::NoiseLevel;
 use rayon::prelude::*;
 
 impl ServerKey {
@@ -26,12 +27,24 @@ impl ServerKey {
             .iter_as::<u8>()
             .collect::<Vec<_>>();
 
+        let all_ones = (message_modulus - 1) as u8;
         lhs.blocks_mut()
             .par_iter_mut()
             .zip(clear_blocks.par_iter().copied())
             .for_each(|(lhs_block, clear_block)| {
-                self.key
-                    .unchecked_scalar_bitand_assign(lhs_block, clear_block);
+                if clear_block == 0 {
+                    self.key.create_trivial_assign(lhs_block, 0);
+                } else if clear_block == all_ones
+                    && lhs_block.carry_is_empty()
+                    && lhs_block.noise_level() <= NoiseLevel::NOMINAL
+                {
+                    // The block is clean (no carry, nominal noise)
+                    // and the corresponding scalar block is a mask on all message bits
+                    // so we can safely skip a PBS here
+                } else {
+                    self.key
+                        .unchecked_scalar_bitand_assign(lhs_block, clear_block);
+                }
             });
 
         let num_clear_blocks = clear_blocks.len();
```

**File**: `tfhe/src/integer/server_key/radix_parallel/scalar_div_mod.rs` (modified, +27/-13)
```diff
@@ -373,8 +373,7 @@ impl ServerKey {
                 .unchecked_scalar_right_shift_parallelized(numerator, divisor.ilog2() as u64);
         }
 
-        let log2_divisor = divisor.ceil_ilog2();
-        if log2_divisor > numerator_bits {
+        if self.divisor_exceeds_numerator(numerator, divisor) {
             return self.create_trivial_zero_radix(numerator.blocks.len());
         }
 
@@ -862,6 +861,11 @@ impl ServerKey {
     where
         T: Reciprocable + ScalarMultiplier + DecomposableInto<u8>,
     {
+        if self.divisor_exceeds_numerator(numerator, divisor) {
+            let quotient = self.create_trivial_zero_radix(numerator.blocks.len());
+            return (quotient, numerator.clone());
+        }
+
         let quotient = self.unchecked_scalar_div_parallelized(numerator, divisor);
         let remainder = if MiniUnsignedInteger::is_power_of_two(divisor) {
             // unchecked_scalar_div would have panicked if divisor was zero
@@ -883,6 +887,10 @@ impl ServerKey {
     where
         T: Reciprocable + ScalarMultiplier + DecomposableInto<u8>,
     {
+        if self.divisor_exceeds_numerator(numerator, divisor) {
+            return numerator.clone();
+        }
+
         if MiniUnsignedInteger::is_power_of_two(divisor) {
             // The remainder is simply the bits that would get 'shifted out'
             return self.scalar_bitand_parallelized(numerator, divisor - T::ONE);
@@ -892,6 +900,20 @@ impl ServerKey {
         remainder
     }
 
+    /// Whether `divisor` is greater than any value `numerator` can hold, in which case the
+    /// division has nothing to reduce: the quotient is 0 and the remainder the numerator.
+    ///
+    /// Works whatever the width of `T` compared to the numerator's.
+    fn divisor_exceeds_numerator<T>(&self, numerator: &RadixCiphertext, divisor: T) -> bool
+    where
+        T: Reciprocable,
+    {
+        let numerator_bits = self.key.message_modulus.0.ilog2() as usize * numerator.blocks.len();
+        // If the divisor type has more bits than the numerator, and that it's bigger than
+        // the max value the numerator can encrypt
+        T::BITS > numerator_bits && divisor > (T::ONE << numerator_bits) - T::ONE
+    }
+
     pub fn scalar_div_assign_parallelized<T>(&self, numerator: &mut RadixCiphertext, divisor: T)
     where
         T: Reciprocable + DecomposableInto<u8>,
@@ -907,10 +929,7 @@ impl ServerKey {
     where
         T: Reciprocable + ScalarMultiplier + DecomposableInto<u8>,
     {
-        if !numerator.block_carries_are_empty() {
-            self.full_propagate_parallelized(numerator);
-        }
-
+        self.clean_inplace_for_default_op(numerator);
         *numerator = self.unchecked_scalar_rem_parallelized(numerator, divisor);
     }
 
@@ -1041,13 +1060,8 @@ impl ServerKey {
     where
         T: Reciprocable + ScalarMultiplier + DecomposableInto<u8>,
     {
-        if numerator.block_carries_are_empty() {
-            self.unchecked_scalar_div_rem_parallelized(numerator, divisor)
-        } else {
-            let mut cloned_numerator = numerator.clone();
-            self.full_propagate_parallelized(&mut cloned_numerator);
-            self.unchecked_scalar_div_rem_parallelized(&cloned_numerator, divisor)
-        }
+        let numerator = self.clean_for_default_op(numerator);
+        self.unchecked_scalar_div_rem_parallelized(&numerator, divisor)
     }
 }
 
```

**File**: `tfhe/src/integer/server_key/radix_parallel/shift.rs` (modified, +8/-22)
```diff
@@ -1,3 +1,4 @@
+use crate::core_crypto::prelude::UnsignedInteger;
 use crate::integer::ciphertext::{IntegerRadixCiphertext, RadixCiphertext};
 use crate::integer::server_key::radix_parallel::bit_extractor::BitExtractor;
 use crate::integer::{BooleanBlock, ServerKey};
@@ -223,15 +224,9 @@ impl ServerKey {
         assert!(carry_bits_per_block >= message_bits_per_block);
 
         let num_bits = ct.blocks().len() * message_bits_per_block as usize;
-        let mut max_num_bits_that_tell_shift = num_bits.ilog2() as u64;
-        // This effectively means, that if the block parameters
-        // give a total_nb_bits that is not a power of two,
-        // then the behaviour of shifting won't be the same
-        // if shift >= total_nb_bits compared to when total_nb_bits
-        // is a power of two, as will 'capture' more bits in `shift_bits`
-        if !num_bits.is_power_of_two() {
-            max_num_bits_that_tell_shift += 1;
-        }
+        // Number of low bits of the amount the shifter reads. Shifts decide overshifts on the
+        // whole amount, rotations reduce the amount modulo `num_bits` beforehand
+        let max_num_bits_that_tell_shift = u64::from(num_bits.ceil_ilog2());
 
         if message_bits_per_block == 1 {
             *ct = self.barrel_shift_bits_1_bit(
@@ -1004,15 +999,9 @@ impl ServerKey {
                 bit_extractor.extract_all_bits()
             },
             || {
-                let mut max_num_bits_that_tell_shift = total_nb_bits.ilog2() as u64;
-                // This effectively means, that if the block parameters
-                // give a total_nb_bits that is not a power of two,
-                // then the behaviour of shifting won't be the same
-                // if shift >= total_nb_bits compared to when total_nb_bits
-                // is a power of two, as will 'capture' more bits in `shift_bits`
-                if !total_nb_bits.is_power_of_two() {
-                    max_num_bits_that_tell_shift += 1;
-                }
+                // Number of low bits of the amount the shifter reads, see
+                // `unchecked_shift_rotate_bits_assign`
+                let max_num_bits_that_tell_shift = u64::from(total_nb_bits.ceil_ilog2());
 
                 // Extracts bits and put them in the bit index 2 (=> bit number 3)
                 // so that it is already aligned to the correct position of the cmux input
@@ -1157,10 +1146,7 @@ impl ServerKey {
         let message_bits_per_block = self.key.message_modulus.0.ilog2() as u64;
         let num_bits = num_blocks as u64 * message_bits_per_block;
 
-        let mut max_num_bits_that_tell_shift = num_bits.ilog2();
-        if !num_bits.is_power_of_two() {
-            max_num_bits_that_tell_shift += 1;
-        }
+        let max_num_bits_that_tell_shift = num_bits.ceil_ilog2();
         let split = (max_num_bits_that_tell_shift as usize)
             .div_ceil(message_bits_per_block as usize)
             .min(amount.blocks.len());
```

---

### Incident Patch 2: `cbd6b4f2` (2026-11-24)
**Commit Message**: chore(ci): remove ci file not used anymore and fix gpu build

* chore(ci): remove ci file not used anymore

* fix: change gpu setup to handle everything in https over http

**File**: `.github/actions/gpu_setup/action.yml` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@ runs:
 
         bash ci/wait_for_apt_lock.sh
 
+        # Outbound port 80 is blocked by the instance security group, fetch apt sources over HTTPS.
+        sudo find /etc/apt -maxdepth 2 -type f \( -name '*.list' -o -name '*.sources' \) \
+          -exec sed -i 's|http://|https://|g' {} +
+
         sudo apt-get update
         sudo apt-get install -y cmake-format libclang-dev
       env:
```

**File**: `.github/workflows/benchmark_gpu_coprocessor.yml` (modified, +4/-0)
```diff
@@ -127,6 +127,10 @@ jobs:
         run: |
           bash ci/wait_for_apt_lock.sh
 
+          # Outbound port 80 is blocked by the instance security group, fetch apt sources over HTTPS.
+          sudo find /etc/apt -maxdepth 2 -type f \( -name '*.list' -o -name '*.sources' \) \
+            -exec sed -i 's|http://|https://|g' {} +
+
           sudo apt-get update
           sudo apt-get install -y git-lfs protobuf-compiler
           git lfs install
```

**File**: `ci/slab.toml` (removed, +0/-338)
```diff
@@ -1,338 +0,0 @@
-[backend.aws.cpu-big]
-region = "eu-west-3"
-image_id = "ami-01c204b15b504da60"
-instance_type = "m6i.32xlarge"
-user = "ubuntu"
-
-[backend.aws.cpu-big_fallback]
-region = "us-east-1"
-image_id = "ami-0c6e54f3be8d03234"
-instance_type = "m6i.32xlarge"
-user = "ubuntu"
-
-[backend.aws.cpu-small]
-region = "eu-west-3"
-image_id = "ami-01c204b15b504da60"
-instance_type = "m6i.4xlarge"
-user = "ubuntu"
-
-[backend.aws.bench]
-region = "eu-west-1"
-image_id = "ami-067f3893108afe8cd"
-instance_type = "hpc7a.96xlarge"
-user = "ubuntu"
-
-[backend.aws.bench-hpc8]
-region = "eu-north-1"
-image_id = "ami-0d7f32ee367bc2a69"
-instance_type = "hpc8a.96xlarge"
-user = "ubuntu"
-
-# Profile used to build CUDA code without the need to get p-like instance.
-[backend.aws.gpu-build]
-region = "us-east-1"
-image_id = "ami-0250f541bc1358116"
-instance_type = "m6i.4xlarge"
-user = "ubuntu"
-
-[backend.aws.single-h100]
-region = "us-east-1"
-image_id = "ami-0250f541bc1358116"
-instance_type = "p5.4xlarge"
-user = "ubuntu"
-
-[backend.aws.single-h100_1stfallback]
-region = "us-east-2"
-image_id = "ami-0c924a8e0a210a709"
-instance_type = "p5.4xlarge"
-user = "ubuntu"
-
-[backend.aws.single-h100_2ndfallback]
-region = "us-west-1"
-image_id = "ami-0fe3273232bc2fb8a"
-instance_type = "p5.4xlarge"
-user = "ubuntu"
-
-[backend.aws.single-h100_3rdfallback]
-region = "us-west-2"
-image_id = "ami-057682b0cfedeaf20"
-instance_type = "p5.4xlarge"
-user = "ubuntu"
-
-[backend.aws.4-l40]
-region = "us-east-1"
-image_id = "ami-0250f541bc1358116"
-instance_type = "g6e.24xlarge"
-user = "ubuntu"
-fallbacks = [ "hyperstack.4-l40", "terraform.scaleway-4-l40" ]
-
-[backend.aws.small-gpu]
-region = "us-east-1"
-image_id = "ami-0250f541bc1358116"
-instance_type = "g6.2xlarge"
-user = "ubuntu"
-
-[backend.hyperstack.gpu-test]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-L40x1"
-user = "ubuntu"
-fallbacks = [ "terraform.scaleway-small-gpu", "hyperstack.rtx-a6000" ]
-
-[backend.hyperstack.gpu-test-sanitizer]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-L40x1"
-user = "ubuntu"
-fallbacks = [ "terraform.scaleway-small-gpu-sanitizer" ]
-
-[backend.hyperstack.single-h100]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-H100x1"
-user = "ubuntu"
-
-# Primary target of gpu_protocol_stress_h100_tests: one H100 PCIe, falling back to a single
-# Scaleway H100 and then to a 2 GPU Scaleway instance. The fallbacks deliberately name the
-# profiles that carry no fallbacks of their own, so the chain stays exactly these three.
-[backend.hyperstack.single-h100-protocol-stress]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-H100x1"
-user = "ubuntu"
-fallbacks = [
-    "terraform.scaleway-single-h100",
-    "terraform.scaleway-2-h100-sxm5",
-]
-
-[backend.hyperstack.2-h100]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-H100x2"
-user = "ubuntu"
-
-[backend.hyperstack.4-h100]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-H100x4"
-user = "ubuntu"
-
-[backend.hyperstack.multi-h100]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-H100x8"
-user = "ubuntu"
-
-[backend.hyperstack.multi-h100-nvlink]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-H100x8-NVLink"
-user = "ubuntu"
-
-[backend.hyperstack.multi-h100-sxm5]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-H100-SXM5x8"
-user = "ubuntu"
-
-[backend.hyperstack.multi-h100-sxm5_fallback]
-environment_name = "us-1"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-H100-SXM5x8"
-user = "ubuntu"
-
-[backend.hyperstack.multi-a100-nvlink]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-A100x8-NVLink"
-user = "ubuntu"
-
-[backend.hyperstack.l40]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-L40x1"
-user = "ubuntu"
-
-[backend.hyperstack.l40_fallback]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-RTX-A6000x1"
-user = "ubuntu"
-
-# Fallback target only.
-[backend.hyperstack.rtx-a6000]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-RTX-A6000x1"
-user = "ubuntu"
-
-[backend.hyperstack.4-l40]
-environment_name = "canada"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-L40x4"
-user = "ubuntu"
-
-[backend.hyperstack.4-l40_fallback]
-environment_name = "norway"
-image_name = "Ubuntu Server 22.04 LTS R570 CUDA 12.8"
-flavor_name = "n3-RTX-A4000x4"
-user = "
```

**File**: `ci/terraform_scripts/nebius/terraform_h100.tf` (removed, +0/-130)
```diff
@@ -1,130 +0,0 @@
-terraform {
-  required_providers {
-    nebius = {
-      source  = "terraform-provider.storage.eu-north1.nebius.cloud/nebius/nebius"
-      version = "~> 0.5"
-    }
-  }
-  required_version = "~> 1.14"
-}
-
-provider "nebius" {
-  domain = "api.nebius.cloud:443"
-
-  service_account = {
-    account_id       = var.nebius_sa_account_id
-    public_key_id    = var.nebius_sa_public_key_id
-    private_key_file = "/app/nebius/slab_ci_service_account_private.pem"
-  }
-}
-
-variable "nebius_sa_account_id" {
-  type        = string
-  description = "Nebius service account used by Slab"
-  default     = "serviceaccount-e00ja4a60pzcaabtm0"
-}
-
-variable "nebius_sa_public_key_id" {
-  type        = string
-  description = "ID of the service account authorized key"
-  default     = "publickey-e00vtny4sn819pm0pg"
-}
-
-variable "nebius_project_id" {
-  type        = string
-  description = "Nebius project ID to attach to"
-  default     = "project-e00g2md3pr003aqkq1v4q0"
-}
-
-variable "nebius_subnet_id" {
-  type        = string
-  description = "Nebius VPC subnet ID to attach the instance to"
-  default     = "vpcsubnet-e00zwv8bkn6dxmk91s"
-}
-
-variable "nebius_security_group_id" {
-  type        = string
-  description = "Nebius VPC security group ID to attach to the instance network interface"
-  default     = "vpcsecuritygroup-e00kvyx503efvsc4br"
-}
-
-# Provided via ci/slab.toml
-variable "instance_type" {
-  type        = string
-  description = "Nebius instance preset to be used (e.g. 1gpu-16vcpu-200gb)"
-}
-
-# Presets are platform specific, a different GPU type needs its own script
-variable "platform" {
-  type        = string
-  description = "Nebius compute platform (GPU type)"
-  default     = "gpu-h100-sxm"
-}
-
-# Provided by Slab server
-variable "instance_label" {
-  type        = string
-  description = "Instance name to display in console"
-}
-
-# Provided by Slab server
-variable "user_data" {
-  type        = string
-  description = "Script that will be run at instance startup"
-  sensitive   = true
-}
-
-resource "nebius_compute_v1_disk" "boot_disk" {
-  parent_id        = var.nebius_project_id
-  name             = "${var.instance_label}-boot-disk"
-  type             = "NETWORK_SSD"
-  size_gibibytes   = 200
-  block_size_bytes = 4096
-
-  # Pinned ubuntu24.04-cuda12 image (CUDA 12.8, driver 570), the family alone would drift between runs
-  source_image_id = "computeimage-e00q003g5k851wjgpn"
-}
-
-resource "nebius_compute_v1_instance" "runner" {
-  parent_id = var.nebius_project_id
-  name      = var.instance_label
-
-  resources = {
-    platform = var.platform
-    preset   = var.instance_type
-  }
-
-  boot_disk = {
-    attach_mode = "READ_WRITE"
-    existing_disk = {
-      id = nebius_compute_v1_disk.boot_disk.id
-    }
-  }
-
-  network_interfaces = [
-    {
-      name              = "eth0"
-      subnet_id         = var.nebius_subnet_id
-      security_groups   = [{ id = var.nebius_security_group_id }]
-      ip_address        = {}
-      public_ip_address = {}
-    }
-  ]
-
-  # Nebius expects a #cloud-config document, so the Slab script is shipped as a file and run from it
-  cloud_init_user_data = <<-EOT
-    #cloud-config
-    write_files:
-      - path: /opt/slab/runner_start.sh
-        permissions: "0755"
-        encoding: b64
-        content: ${base64encode(var.user_data)}
-    runcmd:
-      - /opt/slab/runner_start.sh
-  EOT
-}
-
-output "instance_id" {
-  value       = nebius_compute_v1_instance.runner.id
-  description = "Unique ID of the Nebius instance"
-}
```

**File**: `ci/terraform_scripts/nebius/terraform_l40.tf` (removed, +0/-130)
```diff
@@ -1,130 +0,0 @@
-terraform {
-  required_providers {
-    nebius = {
-      source  = "terraform-provider.storage.eu-north1.nebius.cloud/nebius/nebius"
-      version = "~> 0.5"
-    }
-  }
-  required_version = "~> 1.14"
-}
-
-provider "nebius" {
-  domain = "api.nebius.cloud:443"
-
-  service_account = {
-    account_id       = var.nebius_sa_account_id
-    public_key_id    = var.nebius_sa_public_key_id
-    private_key_file = "/app/nebius/slab_ci_service_account_private.pem"
-  }
-}
-
-variable "nebius_sa_account_id" {
-  type        = string
-  description = "Nebius service account used by Slab"
-  default     = "serviceaccount-e00ja4a60pzcaabtm0"
-}
-
-variable "nebius_sa_public_key_id" {
-  type        = string
-  description = "ID of the service account authorized key"
-  default     = "publickey-e00vtny4sn819pm0pg"
-}
-
-variable "nebius_project_id" {
-  type        = string
-  description = "Nebius project ID to attach to"
-  default     = "project-e00g2md3pr003aqkq1v4q0"
-}
-
-variable "nebius_subnet_id" {
-  type        = string
-  description = "Nebius VPC subnet ID to attach the instance to"
-  default     = "vpcsubnet-e00zwv8bkn6dxmk91s"
-}
-
-variable "nebius_security_group_id" {
-  type        = string
-  description = "Nebius VPC security group ID to attach to the instance network interface"
-  default     = "vpcsecuritygroup-e00kvyx503efvsc4br"
-}
-
-# Provided via ci/slab.toml
-variable "instance_type" {
-  type        = string
-  description = "Nebius instance preset to be used (e.g. 1gpu-16vcpu-200gb)"
-}
-
-# Presets are platform specific, a different GPU type needs its own script
-variable "platform" {
-  type        = string
-  description = "Nebius compute platform (GPU type)"
-  default     = "gpu-l40s-d"
-}
-
-# Provided by Slab server
-variable "instance_label" {
-  type        = string
-  description = "Instance name to display in console"
-}
-
-# Provided by Slab server
-variable "user_data" {
-  type        = string
-  description = "Script that will be run at instance startup"
-  sensitive   = true
-}
-
-resource "nebius_compute_v1_disk" "boot_disk" {
-  parent_id        = var.nebius_project_id
-  name             = "${var.instance_label}-boot-disk"
-  type             = "NETWORK_SSD"
-  size_gibibytes   = 200
-  block_size_bytes = 4096
-
-  # Pinned ubuntu24.04-cuda12 image (CUDA 12.8, driver 570), the family alone would drift between runs
-  source_image_id = "computeimage-e00q003g5k851wjgpn"
-}
-
-resource "nebius_compute_v1_instance" "runner" {
-  parent_id = var.nebius_project_id
-  name      = var.instance_label
-
-  resources = {
-    platform = var.platform
-    preset   = var.instance_type
-  }
-
-  boot_disk = {
-    attach_mode = "READ_WRITE"
-    existing_disk = {
-      id = nebius_compute_v1_disk.boot_disk.id
-    }
-  }
-
-  network_interfaces = [
-    {
-      name              = "eth0"
-      subnet_id         = var.nebius_subnet_id
-      security_groups   = [{ id = var.nebius_security_group_id }]
-      ip_address        = {}
-      public_ip_address = {}
-    }
-  ]
-
-  # Nebius expects a #cloud-config document, so the Slab script is shipped as a file and run from it
-  cloud_init_user_data = <<-EOT
-    #cloud-config
-    write_files:
-      - path: /opt/slab/runner_start.sh
-        permissions: "0755"
-        encoding: b64
-        content: ${base64encode(var.user_data)}
-    runcmd:
-      - /opt/slab/runner_start.sh
-  EOT
-}
-
-output "instance_id" {
-  value       = nebius_compute_v1_instance.runner.id
-  description = "Unique ID of the Nebius instance"
-}
```

**File**: `ci/terraform_scripts/scaleway/terraform.tf` (removed, +0/-75)
```diff
@@ -1,75 +0,0 @@
-terraform {
-  required_providers {
-    scaleway = {
-      source  = "scaleway/scaleway"
-      version = "~> 2.73"
-    }
-  }
-  required_version = "~> 1.14"
-}
-
-provider "scaleway" {
-  zone = "fr-par-2"
-}
-
-# Provided via Slab server env
-variable "project_id" {
-  type        = string
-  description = "Scaleway project ID to attached to"
-}
-
-# Provided via ci/slab.toml
-variable "instance_type" {
-  type        = string
-  description = "Scaleway instance type to be used"
-}
-
-# Provided by Slab server
-variable "instance_label" {
-  type        = string
-  description = "Instance name to display in console"
-}
-
-# Provided by Slab server
-variable "user_data" {
-  type        = string
-  description = "Script that will be run at instance startup"
-  sensitive   = true
-}
-
-resource "scaleway_instance_ip" "github_runner" {
-  project_id = var.project_id
-}
-
-data "scaleway_instance_security_group" "github_runner" {
-  project_id = var.project_id
-  name       = "github-actions-runner"
-}
-
-data "scaleway_instance_image" "gpu_benchmark_image" {
-    name = "tfhe-rs-ubuntu-24-cuda"
-}
-
-resource "scaleway_instance_server" "scaleway_gpu_instance" {
-  project_id = var.project_id
-  image      = data.scaleway_instance_image.gpu_benchmark_image.id
-  type       = var.instance_type
-  name       = var.instance_label
-
-  root_volume {
-    size_in_gb = 200
-  }
-
-  ip_id = scaleway_instance_ip.github_runner.id
-
-  user_data = {
-    "cloud-init" = var.user_data
-  }
-
-  security_group_id = data.scaleway_instance_security_group.github_runner.id
-}
-
-output "instance_id" {
-  value       = scaleway_instance_server.scaleway_gpu_instance.id
-  description = "Unique ID of the Scaleway instance"
-}
```

**File**: `ci/terraform_scripts/scaleway/terraform_sxm_x8.tf` (removed, +0/-75)
```diff
@@ -1,75 +0,0 @@
-# This script is an SXM-8 specific variant for Scaleway instance
-# there is a bug with our current OS image we can't figure out, this uses a base Scaleway image
-terraform {
-  required_providers {
-    scaleway = {
-      source  = "scaleway/scaleway"
-      version = "~> 2.73"
-    }
-  }
-  required_version = "~> 1.14"
-}
-
-provider "scaleway" {
-  zone = "fr-par-2"
-}
-
-# Provided via Slab server env
-variable "project_id" {
-  type        = string
-  description = "Scaleway project ID to attached to"
-}
-
-# Provided via ci/slab.toml
-variable "instance_type" {
-  type        = string
-  description = "Scaleway instance type to be used"
-}
-
-# Provided by Slab server
-variable "instance_label" {
-  type        = string
-  description = "Instance name to display in console"
-}
-
-# Provided by Slab server
-variable "user_data" {
-  type        = string
-  description = "Script that will be run at instance startup"
-  sensitive   = true
-}
-
-resource "scaleway_instance_ip" "github_runner" {
-  project_id = var.project_id
-}
-
-data "scaleway_instance_security_group" "github_runner" {
-  project_id = var.project_id
-  name       = "github-actions-runner"
-}
-
-# trivy:ignore:ZAMA-TF-003 uses the base image label for now
-resource "scaleway_instance_server" "scaleway_gpu_instance" {
-  project_id = var.project_id
-  # Current latest ubuntu GPU OS image from Scaleway (2026/07/28)
-  image      = "ubuntu_noble_gpu_os_13_nvidia"
-  type       = var.instance_type
-  name       = var.instance_label
-
-  root_volume {
-    size_in_gb = 200
-  }
-
-  ip_id = scaleway_instance_ip.github_runner.id
-
-  user_data = {
-    "cloud-init" = var.user_data
-  }
-
-  security_group_id = data.scaleway_instance_security_group.github_runner.id
-}
-
-output "instance_id" {
-  value       = scaleway_instance_server.scaleway_gpu_instance.id
-  description = "Unique ID of the Scaleway instance"
-}
```

#### Recent Merged Pull Requests:
- **PR #4217** (2026-11-24): chore(ci): remove ci file not used anymore (@SouchonTheo)
- **PR #4214** (2026-11-23): chore: move gpu scripts to dedicated dir with gpu team as codewoners (@IceTDrinker)
- **PR #4212** (2026-11-23): chore(data-extractor): bump url to 2.5.9 (@nsarlin-zama)
- **PR #4201** (2026-11-24): fix(zk): handle the identity point in bls12_446 Gt::pairing on the GPU (@pdroalves)
- **PR #4198** (2026-11-23): Ns/chore/transciphering 2 bits (@nsarlin-zama)
- **PR #4197** (2026-11-19): fix(ci): use merge commit parent as backward compat base (@SouchonTheo)

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

## X. integer)!: make encrypted rotations behavior consistent

**RULE**:
When implementing operations in `tfhe/src/integer/gpu/server_key/radix/tests_signed/legacy_default_tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `51c20e76`: integer)!: make encrypted rotations behavior consistent. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `tfhe/src/integer/gpu/server_key/radix/tests_signed/legacy_default_tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! `radix_parallel::scalar_add`, which the GPU can reuse.
//!
//! The rotations by an encrypted amount also differ: the CPU reduces the amount modulo the
//! number of bits (see `unchecked_rotate_bits_assign` in `radix_parallel::rotate`), the GPU
//! only reads its low ⌈log₂(num_bits)⌉ bits, i.e. reduces it modulo the next power of two,
//! which the rotate tests of this file (unchecked ones included) still model.
//!
//! Once all are addressed point the GPU wrappers at the harness tests and the CPU unchecked
//! tests, and delete this file.
    nb_tests_for_params, nb_tests_smaller_for_params, panic_if_any_block_is_not_clean_or_trivial,
    MAX_NB_CTXT, NB_CTXT,

pub(crate) fn legacy_signed_unchecked_rotate_left_test<P, T>(param: P, mut executor: T)
where
    P: Into<TestParameters>,
    T: for<'a> FunctionExecutor<
        (&'a SignedRadixCiphertext, &'a RadixCiphertext),
        SignedRadixCiphertext,
    >,
{
    let param = param.into();
    let nb_tests = nb_tests_for_params(param);
    let (cks, sks) = KEY_CACHE.get_from_params(param, IntegerKeyKind::Radix);
    let cks = RadixClientKey::from((cks, NB_CTXT));
    let sks = Arc::new(sks);

    let mut rng = rand::thread_rng(
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
//! `radix_parallel::scalar_add`, which the GPU can reuse. Once both are addressed point the
//! GPU wrappers at the harness tests and delete this file.
    nb_tests_smaller_for_params, panic_if_any_block_is_not_clean_or_trivial, MAX_NB_CTXT, NB_CTXT,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `51c20e76` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
