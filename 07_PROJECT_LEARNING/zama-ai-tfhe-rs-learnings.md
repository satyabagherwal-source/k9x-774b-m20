> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zama-ai-tfhe-rs-learnings.md`  
> **Source**: github ([https://github.com/zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs))  
> **Source Version**: `eaac04df`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T12:56:39.764Z  
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
> **Harvest Timestamp**: 2026-11-25T12:56:39.759Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zama-ai/tfhe-rs`
- **Description**: TFHE-rs: A Pure Rust implementation of the TFHE Scheme for Boolean and Integer Arithmetics Over Encrypted Data.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 1685 stars

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

### Incident Patch 1: `eaac04df` (2026-11-25)
**Commit Message**: fix(gpu): support more than 512 radix blocks in partial sum index kernels (#4185)

* fix(gpu): support more than 512 radix blocks in partial sum index kernels

* test(gpu): check sum_ciphertexts on more than 512 radix blocks

**File**: `backends/tfhe-cuda-backend/cuda/src/integer/multiplication.cuh` (modified, +91/-55)
```diff
@@ -78,84 +78,100 @@ static __global__ void radix_vec_to_columns(uint32_t *const *const columns,
                                             const uint32_t num_radix_blocks,
                                             const uint32_t num_radix_in_vec) {
 
-  const uint32_t idx = threadIdx.x;
-  size_t cnt = 0;
-  for (int i = 0; i < num_radix_in_vec; i++) {
-    size_t ct_id = i * num_radix_blocks + idx;
-    if (degrees[ct_id] != 0) {
-      columns[idx][cnt] = ct_id;
-      ++cnt;
+  const uint32_t idx = blockIdx.x * blockDim.x + threadIdx.x;
+  if (idx < num_radix_blocks) {
+    size_t cnt = 0;
+    for (int i = 0; i < num_radix_in_vec; i++) {
+      size_t ct_id = i * num_radix_blocks + idx;
+      if (degrees[ct_id] != 0) {
+        columns[idx][cnt] = ct_id;
+        ++cnt;
+      }
     }
+    columns_counter[idx] = cnt;
   }
-  columns_counter[idx] = cnt;
 }
 
+// Runs in a single CUDA block: all message PBS indexes must be assigned
+// (through the shared counter) before the carry ones. Each thread handles the
+// columns threadIdx.x, threadIdx.x + blockDim.x, ... so that more than 1024
+// columns are supported.
 template <typename Torus>
 static __global__ void prepare_new_columns_and_pbs_indexes(
     uint32_t *const *const new_columns, uint32_t *const new_columns_counter,
     Torus *const pbs_indexes_in, Torus *const pbs_indexes_out,
     Torus *const lut_indexes, const uint32_t *const *const columns,
-    const uint32_t *const columns_counter, const uint32_t chunk_size) {
+    const uint32_t *const columns_counter, const uint32_t chunk_size,
+    const uint32_t num_radix_blocks) {
   __shared__ uint32_t counter;
 
   if (threadIdx.x == 0) {
     counter = 0;
   }
   __syncthreads();
 
-  const uint32_t base_id = threadIdx.x;
-  const uint32_t column_len = columns_counter[base_id];
-
-  uint32_t ct_count = 0;
-  for (uint32_t i = 0; i + chunk_size <= column_len; i += chunk_size) {
-    // those indexes are for message ciphertexts
-    // for message ciphertexts in and out index should be same
-    const uint32_t in_index = columns[base_id][i];
-    new_columns[base_id][ct_count] = in_index;
-    const uint32_t pbs_index = atomicAdd(&counter, 1);
-    pbs_indexes_in[pbs_index] = in_index;
-    pbs_indexes_out[pbs_index] = in_index;
-    lut_indexes[pbs_index] = 0;
-    ++ct_count;
-  }
-  __syncthreads();
-
-  if (base_id > 0) {
-    const uint32_t prev_base_id = base_id - 1;
-    const uint32_t prev_column_len = columns_counter[prev_base_id];
-
-    for (uint32_t i = 0; i + chunk_size <= prev_column_len; i += chunk_size) {
-      // those indexes are for carry ciphertexts
-      // for carry ciphertexts input is same as for message
-      // output will be placed to next block in the column
-      const uint32_t in_index = columns[prev_base_id][i];
-      const uint32_t out_index = columns[prev_base_id][i + 1];
-      new_columns[base_id][ct_count] = out_index;
+  for (uint32_t base_id = threadIdx.x; base_id < num_radix_blocks;
+       base_id += blockDim.x) {
+    const uint32_t column_len = columns_counter[base_id];
+    uint32_t ct_count = 0;
+    for (uint32_t i = 0; i + chunk_size <= column_len; i += chunk_size) {
+      // those indexes are for message ciphertexts
+      // for message ciphertexts in and out index should be same
+      const uint32_t in_index = columns[base_id][i];
+      new_columns[base_id][ct_count] = in_index;
       const uint32_t pbs_index = atomicAdd(&counter, 1);
       pbs_indexes_in[pbs_index] = in_index;
-      pbs_indexes_out[pbs_index] = out_index;
-      lut_indexes[pbs_index] = 1;
+      pbs_indexes_out[pbs_index] = in_index;
+      lut_indexes[pbs_index] = 0;
       ++ct_count;
     }
   }
+  __syncthreads();
 
-  const uint32_t start_index = column_len - column_len % chunk_size;
-  for (uint32_t i = start_index; i < column_len; ++i) {
-    new_columns[base_id][ct_count] = columns[base_id][i];
-    ++ct_count;
-  }
+  for (uint32_t base_id = threadIdx.x; base_id < num_radix_blocks;
+       base_id += blockDim.x) {
+    const uint32_t column_len = columns_counter[base_id];
+    // number of message ciphertexts written to this column above
+    uint32_t ct_count = column_len / chunk_size;
+    if (base_id > 0) {
+      const uint32_t prev_base_id = base_id - 1;
+      const uint32_t prev_column_len = columns_counter[prev_base_id];
+
+      for (uint32_t i = 0; i + chunk_size <= prev_column_len; i += chunk_size) {
+        // those indexes are for carry ciphertexts
+        // for carry ciphertexts input is same as for message
+        // output will be placed to next block in the column
+        const uint32_t in_index = columns[prev_base_id][i];
+        const uint32_t out_index = columns[prev_base_id][i + 1];
+        new_columns[base_id][ct_count] = out_index;
+        const uint32_t pbs_index = atomicAdd(&counter, 1);
+        pbs_indexes_in[pbs_index] = in_index;
+        pbs_indexes_out[pbs_index] = out_index;
+        lut_indexes[pbs_index] = 1;
+  
```

**File**: `tfhe/src/integer/gpu/server_key/radix/tests_unsigned/test_add.rs` (modified, +38/-0)
```diff
@@ -3,17 +3,21 @@ use super::legacy_default_tests::{
     legacy_default_sum_ciphertexts_vec_test,
 };
 use crate::core_crypto::gpu::{get_number_of_gpus, CudaStreams};
+use crate::integer::bigint::U4096;
 use crate::integer::gpu::ciphertext::CudaUnsignedRadixCiphertext;
 use crate::integer::gpu::server_key::radix::tests_signed::GpuMultiDeviceFunctionExecutor;
 use crate::integer::gpu::server_key::radix::tests_unsigned::{
     create_gpu_parameterized_test, GpuFunctionExecutor,
 };
 use crate::integer::gpu::CudaServerKey;
+use crate::integer::keycache::KEY_CACHE;
 use crate::integer::server_key::radix_parallel::tests_cases_unsigned::{
     unchecked_add_assign_test, unchecked_add_test,
 };
+use crate::integer::{IntegerKeyKind, RadixClientKey};
 use crate::shortint::parameters::test_params::*;
 use crate::shortint::parameters::*;
+use rand::Rng;
 
 create_gpu_parameterized_test!(integer_unchecked_add {
     PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
@@ -44,6 +48,9 @@ create_gpu_parameterized_test!(multi_device_integer_add {
     TEST_PARAM_GPU_MULTI_BIT_GROUP_3_MESSAGE_2_CARRY_2_KS_PBS_GAUSSIAN_2M64,
 });
 create_gpu_parameterized_test!(integer_sum_ciphertexts_vec);
+create_gpu_parameterized_test!(integer_sum_ciphertexts_many_blocks {
+    PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
+});
 create_gpu_parameterized_test!(integer_default_overflowing_add);
 create_gpu_parameterized_test!(multi_device_integer_default_overflowing_add);
 
@@ -99,6 +106,37 @@ where
     legacy_default_sum_ciphertexts_vec_test(param, executor);
 }
 
+fn integer_sum_ciphertexts_many_blocks<P>(param: P)
+where
+    P: Into<TestParameters>,
+{
+    let param = param.into();
+    let (cks, _) = KEY_CACHE.get_from_params(param, IntegerKeyKind::Radix);
+    let streams = CudaStreams::new_multi_gpu();
+    let sks = CudaServerKey::new(&cks, &streams);
+
+    let mut rng = rand::thread_rng();
+    let num_ctxts = 16;
+    let bits_per_block = param.message_modulus().0.ilog2();
+    for num_blocks in [512, 1024, 2048] {
+        let cks = RadixClientKey::from((cks.clone(), num_blocks));
+        let mask = U4096::MAX >> (U4096::BITS - bits_per_block * num_blocks as u32);
+        let clears: Vec<U4096> = (0..num_ctxts).map(|_| rng.gen::<U4096>() & mask).collect();
+        let d_ctxts: Vec<CudaUnsignedRadixCiphertext> = clears
+            .iter()
+            .map(|&clear| {
+                CudaUnsignedRadixCiphertext::from_radix_ciphertext(&cks.encrypt(clear), &streams)
+            })
+            .collect();
+
+        let d_result = sks.sum_ciphertexts(d_ctxts, &streams).unwrap();
+        let result = d_result.to_radix_ciphertext(&streams);
+        let decrypted: U4096 = cks.decrypt(&result);
+        let expected = clears.iter().fold(U4096::ZERO, |acc, &x| acc + x) & mask;
+        assert_eq!(decrypted, expected, "num_blocks = {num_blocks}");
+    }
+}
+
 fn integer_default_overflowing_add<P>(param: P)
 where
     P: Into<TestParameters>,
```

---

### Incident Patch 2: `4d482447` (2026-11-25)
**Commit Message**: fix(gpu): improve noise squash validations (#4196)

**File**: `tfhe/src/integer/gpu/noise_squashing/keys.rs` (modified, +137/-12)
```diff
@@ -10,6 +10,7 @@ use crate::integer::gpu::ciphertext::squashed_noise::{
 use crate::integer::gpu::ciphertext::{CudaRadixCiphertext, CudaSignedRadixCiphertext};
 use crate::integer::gpu::server_key::CudaBootstrappingKey;
 use crate::integer::gpu::CudaServerKey;
+use crate::integer::noise_squashing::check_blocks_can_be_packed_and_squashed;
 use crate::shortint::parameters::CoreCiphertextModulus;
 
 use crate::shortint::{CarryModulus, MessageModulus};
@@ -29,18 +30,6 @@ impl CudaNoiseSquashingKey {
         streams: &CudaStreams,
     ) -> crate::Result<CudaSquashedNoiseRadixCiphertext> {
         for block in ciphertext.info.blocks.iter() {
-            if src_server_key
-                .max_noise_level
-                .validate(block.noise_level)
-                .is_err()
-            {
-                return Err(crate::error!(
-                        "squash_ciphertext_noise requires the input Ciphertext to have at most {:?} noise \
-                        got {:?}.",
-                        src_server_key.max_noise_level,
-                        block.noise_level
-                    ));
-            }
             if block.message_modulus != self.message_modulus {
                 return Err(crate::error!(
                     "Mismatched MessageModulus between Ciphertext {:?} and NoiseSquashingKey {:?}.",
@@ -57,6 +46,19 @@ impl CudaNoiseSquashingKey {
             }
         }
 
+        // The CUDA backend packs blocks by pairs before the noise squashing PBS, the checks on
+        // carries and noise must be done on the packed chunks, same as on the CPU
+        check_blocks_can_be_packed_and_squashed(
+            ciphertext
+                .info
+                .blocks
+                .iter()
+                .map(|block| (block.degree, block.noise_level)),
+            self.message_modulus,
+            self.carry_modulus,
+            src_server_key.max_noise_level,
+        )?;
+
         Ok(self.unchecked_squash_ciphertext_noise(ciphertext, src_server_key, streams))
     }
 
@@ -128,6 +130,16 @@ impl CudaNoiseSquashingKey {
         ciphertext: &CudaBooleanBlock,
         streams: &CudaStreams,
     ) -> crate::Result<CudaSquashedNoiseBooleanBlock> {
+        let blocks = &ciphertext.as_ref().ciphertext.info.blocks;
+        if blocks.len() != 1 {
+            return Err(crate::error!(
+                "A CudaBooleanBlock must contain exactly 1 block, got {}",
+                blocks.len()
+            ));
+        }
+        // The boolean block is checked as a single, unpacked block by the radix checks: its carry
+        // must be empty as the squashed boolean is decrypted as `value != 0` over the whole
+        // message and carry space
         let squashed_output = self.checked_squash_ciphertext_noise(
             &ciphertext.as_ref().ciphertext,
             src_server_key,
@@ -138,3 +150,116 @@ impl CudaNoiseSquashingKey {
         })
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use crate::core_crypto::gpu::CudaStreams;
+    use crate::integer::gpu::ciphertext::boolean_value::CudaBooleanBlock;
+    use crate::integer::gpu::ciphertext::{CudaSignedRadixCiphertext, CudaUnsignedRadixCiphertext};
+    use crate::integer::gpu::CudaServerKey;
+    use crate::integer::noise_squashing::NoiseSquashingPrivateKey;
+    use crate::integer::{ClientKey, CompressedServerKey, IntegerCiphertext, ServerKey};
+    use crate::shortint::ciphertext::NoiseLevel;
+    use crate::shortint::parameters::test_params::{
+        TEST_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
+        TEST_PARAM_NOISE_SQUASHING_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
+    };
+
+    /// The checked GPU noise squashing must reject the same inputs as the CPU one
+    #[test]
+    fn test_cuda_noise_squashing_rejects_unpackable_inputs() {
+        let param = TEST_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128;
+        let noise_squashing_parameters =
+            TEST_PARAM_NOISE_SQUASHING_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128;
+        let streams = CudaStreams::new_multi_gpu();
+
+        let cks = ClientKey::new(param);
+        let compressed_sks = CompressedServerKey::new_radix_compressed_server_key(&cks);
+        let cuda_sks = CudaServerKey::decompress_from_cpu(&compressed_sks, &streams);
+        let shortint_sks = ServerKey::new_radix_server_key(&cks).into_raw_parts();
+        let max_noise_level = shortint_sks.max_noise_level;
+
+        let nspk = NoiseSquashingPrivateKey::new(noise_squashing_parameters);
+        let cuda_nsk = cks
+            .new_compressed_noise_squashing_key(&nspk)
+            .decompress_to_cuda(&streams);
+
+        // Unclean pair, previously packed to 1 + 4 * 4 = 17 >= 16 (padding bit)
+        {
+            let mut ct = cks.encrypt_signed_radix(1i8, 4);
+            shortint_sks.unchecked_scalar_add_assign(&mut ct.blocks_mut()[1], 4);
+            let d_ct = CudaSignedRadixCiphertext::from_signed_radix_ciphertext(&ct, &streams);
+            assert!(cuda_nsk
+ 
```

**File**: `tfhe/src/integer/gpu/server_key/radix/tests_noise_distribution/dp_ks_pbs_128_packingks.rs` (modified, +7/-0)
```diff
@@ -354,6 +354,13 @@ fn sanity_check_encrypt_dp_ks_standard_pbs128_gpu(
                 params.carry_modulus(),
             );
 
+            // The scalar mul makes the tracked degree go over the message modulus, but the
+            // encrypted value is 0, so set the degree to its actual value to go through the
+            // checked version, which still validates the noise
+            for block in d_ct_input2.ciphertext.info.blocks.iter_mut() {
+                block.degree = crate::shortint::ciphertext::Degree::new(0);
+            }
+
             let squashed = cuda_noise_squashing_key
                 .squash_radix_ciphertext_noise(&cuda_sks, &d_ct_input2.ciphertext, local_streams)
                 .unwrap();
```

**File**: `tfhe/src/integer/noise_squashing/keys.rs` (modified, +11/-0)
```diff
@@ -6,6 +6,7 @@ use crate::integer::ciphertext::{
     BooleanBlock, RadixCiphertext, SignedRadixCiphertext, SquashedNoiseBooleanBlock,
     SquashedNoiseRadixCiphertext, SquashedNoiseSignedRadixCiphertext,
 };
+use crate::integer::noise_squashing::check_blocks_can_be_packed_and_squashed;
 use crate::integer::server_key::ServerKey;
 use crate::integer::ClientKey;
 use crate::named::Named;
@@ -344,6 +345,16 @@ impl NoiseSquashingKey {
         src_server_key: &ServerKey,
         boolean_block: &BooleanBlock,
     ) -> crate::Result<SquashedNoiseBooleanBlock> {
+        // A boolean block goes through the same checks as the last block of a radix with an odd
+        // block count, its carry must be empty as the squashed boolean is decrypted as
+        // `value != 0` over the whole message and carry space
+        check_blocks_can_be_packed_and_squashed(
+            [(boolean_block.0.degree, boolean_block.0.noise_level())],
+            self.key.message_modulus(),
+            self.key.carry_modulus(),
+            src_server_key.key.max_noise_level,
+        )?;
+
         Ok(SquashedNoiseBooleanBlock {
             ciphertext: self
                 .key
```

**File**: `tfhe/src/integer/noise_squashing/mod.rs` (modified, +80/-0)
```diff
@@ -3,3 +3,83 @@ mod keys;
 mod tests;
 
 pub use keys::*;
+
+use crate::shortint::ciphertext::{Degree, MaxNoiseLevel, NoiseLevel};
+use crate::shortint::{CarryModulus, MessageModulus};
+
+/// Checks that a chunk of radix blocks (described by their degree and noise level) can be packed
+/// and then noise squashed.
+///
+/// Integer noise squashing packs blocks by pairs as `low + message_modulus * high` before the
+/// 128 bits PBS, `high` being `None` for the last block of a radix with an odd block count. This
+/// requires:
+/// - room for two messages in a block (carry modulus >= message modulus) when packing a pair;
+/// - empty carries on every block, so that the packed value fits in the message and carry space and
+///   does not reach the padding bit;
+/// - a noise level for the packed block within the max noise level of the source server key.
+///
+/// Boolean blocks are checked as a single unpacked block (`high` is `None`). Their degree may be
+/// above 1, but their carry must be empty as the squashed boolean is decrypted as `value != 0` over
+/// the whole message and carry space.
+///
+/// This is shared between the CPU and GPU backends so both enforce the same invariants.
+pub(crate) fn check_blocks_can_be_packed_and_squashed(
+    blocks: impl IntoIterator<Item = (Degree, NoiseLevel)>,
+    message_modulus: MessageModulus,
+    carry_modulus: CarryModulus,
+    max_noise_level: MaxNoiseLevel,
+) -> crate::Result<()> {
+    // Chunk the blocks by pairs here, so that both backends check the same chunks
+    let mut blocks = blocks.into_iter();
+    while let Some(low) = blocks.next() {
+        check_block_chunk_can_be_packed_and_squashed(
+            low,
+            blocks.next(),
+            message_modulus,
+            carry_modulus,
+            max_noise_level,
+        )?;
+    }
+    Ok(())
+}
+
+fn check_block_chunk_can_be_packed_and_squashed(
+    low: (Degree, NoiseLevel),
+    high: Option<(Degree, NoiseLevel)>,
+    message_modulus: MessageModulus,
+    carry_modulus: CarryModulus,
+    max_noise_level: MaxNoiseLevel,
+) -> crate::Result<()> {
+    if high.is_some() && carry_modulus.0 < message_modulus.0 {
+        return Err(crate::error!(
+            "Cannot pack if carry modulus ({carry_modulus:?}) is smaller than message modulus \
+            ({message_modulus:?})"
+        ));
+    }
+
+    let carry_is_empty = |degree: Degree| degree.get() < message_modulus.0;
+
+    let (low_degree, low_noise) = low;
+    let packed_noise = if let Some((high_degree, high_noise)) = high {
+        if !carry_is_empty(low_degree) || !carry_is_empty(high_degree) {
+            return Err(crate::error!(
+                "Cannot pack blocks: need both carries to be empty \
+                (got degrees {low_degree:?} and {high_degree:?}, \
+                message modulus {message_modulus:?})."
+            ));
+        }
+        high_noise * message_modulus.0 + low_noise
+    } else {
+        if !carry_is_empty(low_degree) {
+            return Err(crate::error!(
+                "Cannot squash block: need carry to be empty \
+                (got degree {low_degree:?}, message modulus {message_modulus:?})."
+            ));
+        }
+        low_noise
+    };
+
+    max_noise_level
+        .validate(packed_noise)
+        .map_err(|e| crate::error!("{}", e))
+}
```

**File**: `tfhe/src/integer/noise_squashing/tests.rs` (modified, +99/-0)
```diff
@@ -141,3 +141,102 @@ fn test_repro_noise_squashing_degree_handling() {
         assert!(should_fail_unsigned.is_err());
     }
 }
+
+#[test]
+fn test_noise_squashing_rejects_unpackable_inputs() {
+    use crate::integer::noise_squashing::{NoiseSquashingKey, NoiseSquashingPrivateKey};
+    use crate::integer::{gen_keys_radix, ClientKey, IntegerCiphertext};
+    use crate::shortint::ciphertext::NoiseLevel;
+    use crate::shortint::parameters::{
+        NOISE_SQUASHING_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128 as NSP,
+        PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128 as P22,
+    };
+
+    let (rck, sks) = gen_keys_radix(P22, 3);
+    let cks: &ClientKey = rck.as_ref();
+    let shortint_sks = sks.clone().into_raw_parts();
+    let max_noise_level = shortint_sks.max_noise_level;
+    let nspk = NoiseSquashingPrivateKey::new(NSP);
+    let nsk = NoiseSquashingKey::new(cks, &nspk);
+
+    // Odd block count: the last block is not packed but its carry must still be empty
+    {
+        let mut ct = cks.encrypt_radix(16u8, 3);
+        shortint_sks.unchecked_scalar_add_assign(&mut ct.blocks_mut()[2], 4);
+        assert!(nsk.squash_radix_ciphertext_noise(&sks, &ct).is_err());
+    }
+    {
+        let mut ct = cks.encrypt_signed_radix(17i8, 3);
+        shortint_sks.unchecked_scalar_add_assign(&mut ct.blocks_mut()[2], 16);
+        let dec: i8 = cks.decrypt_signed_radix(&ct);
+        assert_eq!(dec, 17);
+        assert!(nsk.squash_signed_radix_ciphertext_noise(&sks, &ct).is_err());
+    }
+    // Single block radix
+    {
+        let mut ct = cks.encrypt_radix(1u8, 1);
+        shortint_sks.unchecked_scalar_add_assign(&mut ct.blocks_mut()[0], 4);
+        assert!(nsk.squash_radix_ciphertext_noise(&sks, &ct).is_err());
+    }
+
+    // Clean carries but the noise of the packed block exceeds the max noise level
+    for (low_noise, high_noise) in [
+        (NoiseLevel(1), NoiseLevel(2)),
+        (NoiseLevel(5), NoiseLevel(1)),
+    ] {
+        let mut ct = cks.encrypt_radix(5u8, 2);
+        ct.blocks_mut()[0].set_noise_level(low_noise, max_noise_level);
+        ct.blocks_mut()[1].set_noise_level(high_noise, max_noise_level);
+        assert!(ct.blocks().iter().all(|b| b.carry_is_empty()));
+        assert!(nsk.squash_radix_ciphertext_noise(&sks, &ct).is_err());
+    }
+
+    // BooleanBlock with a non empty carry
+    {
+        let mut b = cks.encrypt_bool(false);
+        shortint_sks.unchecked_scalar_add_assign(&mut b.0, 4);
+        assert!(!cks.decrypt_bool(&b));
+        assert!(nsk.squash_boolean_block_noise(&sks, &b).is_err());
+    }
+    // BooleanBlock with degree 2 but an empty carry: accepted, both decryptions agree
+    {
+        let mut b = cks.encrypt_bool(true);
+        shortint_sks.unchecked_scalar_add_assign(&mut b.0, 1);
+        assert!(b.0.degree.get() > 1 && b.0.carry_is_empty());
+        assert!(cks.decrypt_bool(&b));
+        let squashed = nsk.squash_boolean_block_noise(&sks, &b).unwrap();
+        assert!(nspk.decrypt_bool(&squashed).unwrap());
+    }
+    // BooleanBlock from a list expanded without key keeps the degree of the list blocks
+    // (message_modulus - 1) while holding a value in {0, 1}, it must be accepted
+    {
+        use crate::integer::ciphertext::CompactCiphertextList;
+        use crate::integer::{BooleanBlock, CompactPublicKey};
+
+        let pk = CompactPublicKey::new(cks);
+        let list = CompactCiphertextList::builder(&pk)
+            .push(false)
+            .push(true)
+            .build();
+        let expander = list.expand_without_key().unwrap();
+        for (i, expected) in [false, true].into_iter().enumerate() {
+            let b: BooleanBlock = expander.get(i).unwrap().unwrap();
+            assert!(b.0.degree.get() > 1 && b.0.carry_is_empty());
+            let squashed = nsk.squash_boolean_block_noise(&sks, &b).unwrap();
+            assert_eq!(nspk.decrypt_bool(&squashed).unwrap(), expected);
+        }
+    }
+
+    // Sanity check: clean inputs with odd block counts still work
+    for num_blocks in [1, 3] {
+        let ct = cks.encrypt_radix(2u8, num_blocks);
+        let squashed = nsk.squash_radix_ciphertext_noise(&sks, &ct).unwrap();
+        let d: u8 = nspk.decrypt_radix(&squashed).unwrap();
+        assert_eq!(d, 2);
+
+        let ct = cks.encrypt_signed_radix(-1i8, num_blocks);
+        let squashed = nsk.squash_signed_radix_ciphertext_noise(&sks, &ct).unwrap();
+        let d: i8 = nspk.decrypt_signed_radix(&squashed).unwrap();
+        assert_eq!(d, -1);
+    }
+}
```

**File**: `tfhe/src/shortint/noise_squashing/server_key.rs` (modified, +8/-3)
```diff
@@ -473,9 +473,14 @@ impl<AP: NoiseSquashingAtomicPattern> GenericNoiseSquashingKey<AP> {
         });
 
         // If the number of ciphertexts is odd, the last one is squashed on its own
-        let last = remainder
-            .par_iter()
-            .map(|ct| self.checked_squash_ciphertext_noise(ct, src_server_key));
+        let last = remainder.par_iter().map(|ct| {
+            if !ct.carry_is_empty() {
+                return Err(crate::error!(
+                    "Cannot squash unpaired block: need carry to be empty."
+                ));
+            }
+            self.checked_squash_ciphertext_noise(ct, src_server_key)
+        });
 
         packed.chain(last).collect()
     }
```

---

### Incident Patch 3: `9e4bb422` (2026-11-25)
**Commit Message**: chore: update requests in slab requirements

Co-authored-by: Arthur Meyre <[REDACTED_EMAIL]>

**File**: `ci/slab_send_data_requirements.in` (modified, +1/-1)
```diff
@@ -1 +1 @@
-requests==2.32.4
+requests==2.34.2
```

**File**: `ci/slab_send_data_requirements.txt` (modified, +3/-3)
```diff
@@ -182,9 +182,9 @@ idna==3.20 \
     --hash=sha256:a7db850025b95ded1eae8a46181a1a6c56c92c96f0e2b005d9ff8dc0210cab44 \
     --hash=sha256:ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c
     # via requests
-requests==2.32.4 \
-    --hash=sha256:27babd3cda2a6d50b30443204ee89830707d396671944c998b5975b031ac2b2c \
-    --hash=sha256:27d0316682c8a29834d3264820024b62a36942083d52caf2f14c0591336d3422
+requests==2.34.2 \
+    --hash=sha256:2a0d60c172f83ac6ab31e4554906c0f3b3588d37b5cb939b1c061f4907e278e0 \
+    --hash=sha256:f288924cae4e29463698d6d60bc6a4da69c89185ad1e0bcc4104f584e960b9ed
     # via -r ci/slab_send_data_requirements.in
 urllib3==2.8.0 \
     --hash=sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3 \
```

#### Recent Merged Pull Requests:
- **PR #4218** (2026-11-25): chore(deps): bump requests from 2.32.4 to 2.33.0 in /ci (@dependabot[bot])
- **PR #4217** (2026-11-24): chore(ci): remove ci file not used anymore (@SouchonTheo)
- **PR #4215** (2026-11-24): HPU bench numbers for v1.9 doc (@pgardratzama)
- **PR #4214** (2026-11-23): chore: move gpu scripts to dedicated dir with gpu team as codewoners (@IceTDrinker)
- **PR #4212** (2026-11-23): chore(data-extractor): bump url to 2.5.9 (@nsarlin-zama)
- **PR #4201** (2026-11-24): fix(zk): handle the identity point in bls12_446 Gt::pairing on the GPU (@pdroalves)

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

## X. gpu): support more than 512 radix blocks in partial sum index kernels

**RULE**:
When implementing operations in `backends/tfhe-cuda-backend/cuda/src/integer/multiplication.cuh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eaac04df`: gpu): support more than 512 radix blocks in partial sum index kernels. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `backends/tfhe-cuda-backend/cuda/src/integer/multiplication.cuh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  const uint32_t idx = blockIdx.x * blockDim.x + threadIdx.x;
  if (idx < num_radix_blocks) {
    size_t cnt = 0;
    for (int i = 0; i < num_radix_in_vec; i++) {
      size_t ct_id = i * num_radix_blocks + idx;
      if (degrees[ct_id] != 0) {
        columns[idx][cnt] = ct_id;
        ++cnt;
      }
    columns_counter[idx] = cnt;
// Runs in a single CUDA block: all message PBS indexes must be assigned
// (through the shared counter) before the carry ones. Each thread handles the
// columns threadIdx.x, threadIdx.x + blockDim.x, ... so that more than 1024
// columns are supported.
    const uint32_t *const columns_counter, const uint32_t chunk_size,
    const uint32_t num_radix_blocks) {
  for (uint32_t base_id = threadIdx.x; base_id < num_radix_blocks;
       base_id += blockDim.x) {
    const uint32_t column_len = columns_counter[base_id];
    uint32_t ct_count = 0;
    for (uint32_t i = 0; i + chunk_size <= column_len; i += chunk_size) {
      // those indexes are for message ciphertexts
      // for message ciphertexts in and out index should be same
      const uint32_t in_index = columns[base_id][i];
      new_columns[base_id][ct_count] = in_index;
      pbs_indexes_out[pbs
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  const uint32_t idx = threadIdx.x;
  size_t cnt = 0;
  for (int i = 0; i < num_radix_in_vec; i++) {
    size_t ct_id = i * num_radix_blocks + idx;
    if (degrees[ct_id] != 0) {
      columns[idx][cnt] = ct_id;
      ++cnt;
  columns_counter[idx] = cnt;
    const uint32_t *const columns_counter, const uint32_t chunk_size) {
  const uint32_t base_id = threadIdx.x;
  const uint32_t column_len = columns_counter[base_id];

  uint32_t ct_count = 0;
  for (uint32_t i = 0; i + chunk_size <= column_len; i += chunk_size) {
    // those indexes are for message ciphertexts
    // for message ciphertexts in and out index should be same
    const uint32_t in_index = columns[base_id][i];
    new_columns[base_id][ct_count] = in_index;
    const uint32_t pbs_index = atomicAdd(&counter, 1);
    pbs_indexes_in[pbs_index] = in_index;
    pbs_indexes_out[pbs_index] = in_index;
    lut_indexes[pbs_index] = 0;
    ++ct_count;
  }
  __syncthreads();

  if (base_id > 0) {
    const uint32_t prev_base_id = base_id - 1;
    const uint32_t prev_column_len = columns_counter[prev_base_id];

    for (uint32_t i = 0; i + chunk_size <= prev_column_len; i += chunk_size) {
      // those indexes are for carry ciph
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eaac04df` are properly handled with clean fallback behavior.
