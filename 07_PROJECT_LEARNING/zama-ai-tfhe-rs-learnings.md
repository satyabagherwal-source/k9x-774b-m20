# Forensic Learning Record (Deep Inspection): zama-ai/tfhe-rs

> **Canonical Artifact**: `07_PROJECT_LEARNING/zama-ai-tfhe-rs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:49:49.760Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zama-ai/tfhe-rs`
- **Description**: TFHE-rs: A Pure Rust implementation of the TFHE Scheme for Boolean and Integer Arithmetics Over Encrypted Data.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 1667 stars

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

/**
 * This structure holds pre-computed LUTs for essential bitwise operations
 * required by the homomorphic AES circuit. Pre-computing these tables allows
 * for efficient application of non-linear functions like AND during the PBS
 * process. It includes LUTs for:
 * - AND: for the non-linear part of the S-Box.
 * - FLUSH: to clear carry bits and isolate the message bit (x -> x & 1).
 * - CARRY: to extract the carry bit for additions (x -> (x >> 1) & 1).
 */
template <typename Torus> struct int_aes_lut_buffers {
  int_radix_lut<Torus> *and_lut;
  int_radix_lut<Torus> *flush_lut;
  int_radix_lut<Torus> *carry_lut;

  int_aes_lut_buffers(CudaStreams streams, const int_radix_params &params,
                      bool allocate_gpu_memory, uint32_t num_aes_inputs,
                      uint32_t sbox_parallelism, uint64_t &size_tracker) {

    constexpr uint32_t AES_STATE_BITS = 128;
    constexpr uint32_t SBOX_MAX_AND_GATES = 18;

    this->and_lut = new int_radix_lut<Torus>(
        streams, params, 1,
        SBOX_MAX_AND_GATES * num_aes_inputs * sbox_parallelism,
        allocate_gpu_memory, size_tracker);
    std::function<Torus(Torus, Torus)> and_lambda =
        [](Torus a, Torus b) -> Torus { return a & b; };

    auto active_streams_and_lut = streams.active_gpu_subset(
        SBOX_MAX_AND_GATES * num_aes_inputs * sbox_parallelism,
        params.pbs_type);
    this->and_lut->generate_and_broadcast_bivariate_lut(
        active_streams_and_lut, {0}, {and_lambda}, LUT_0_FOR_ALL_BLOCKS);

    this->flush_lut = new int_radix_lut<Torus>(
        streams, params, 1, AES_STATE_BITS * num_aes_inputs,
        allocate_gpu_memory, size_tracker);
    std::function<Torus(Torus)> flush_lambda = [](Torus x) -> Torus {
      return x & 1;
    };

    auto active_streams_flush_lut = streams.active_gpu_subset(
        AES_STATE_BITS * num_aes_inputs, params.pbs_type);
    this->flush_lut->generate_and_broadcast_lut(
        active_streams_flush_lut, {0}, {flush_lambda}, LUT_0_FOR_ALL_BLOCKS);

    this->carry_lut = new int_radix_lut<Torus>(
        streams, params, 1, num_aes_inputs, allocate_gpu_memory, size_tracker);
    std::function<Torus(Torus)> carry_lambda = [](Torus x) -> Torus {
      return (x >> 1) & 1;
    };

    auto active_streams_carry_lut =
        streams.active_gpu_subset(num_aes_inputs, params.pbs_type);
    this->carry_lut->generate_and_broadcast_lut(
        active_streams_carry_lut, {0}, {carry_lambda}, LUT_0_FOR_ALL_BLOCKS);
  }

  void release(CudaStreams streams) {
    this->and_lut->release(streams);
    delete this->and_lut;
    this->and_lut = nullptr;

    this->flush_lut->release(streams);
    delete this->flush_lut;
    this->flush_lut = nullptr;

    this->carry_lut->release(streams);
    delete this->carry_lut;
    this->carry_lut = nullptr;
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

/**
 * The operations within an AES round, particularly MixColumns, require
 * intermediate storage for calculations. These buffers are designed to hold
 * temporary values like copies of columns or the results of multiplications,
 * avoiding overwriting data that is still needed in the same round.
 */
template <typename Torus> struct int_aes_round_workspaces {
  CudaRadixCiphertextFFI *mix_columns_col_copy_buffer;
  CudaRadixCiphertextFFI *mix_columns_mul_workspace_buffer;
  CudaRadixCiphertextFFI *vec_tmp_bit_buffer;

  int_aes_round_workspaces(CudaStreams streams, const int_radix_params &params,
                           bool allocate_gpu_memory, uint32_t num_aes_inputs,
                           uint64_t &size_tracker) {

    constexpr uint32_t BITS_PER_BYTE = 8;
    constexpr uint32_t BYTES_PER_COLUMN = 4;
    constexpr uint32_t BITS_PER_COLUMN = BITS_PER_BYTE * BYTES_PER_COLUMN;
    constexpr uint32_t MIX_COLUMNS_MUL_WORKSPACE_BYTES = BYTES_PER_COLUMN + 1;

    this->mix_columns_col_copy_buffer = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0),
        this->mix_columns_col_copy_buffer, BITS_PER_COLUMN * num_aes_inputs,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->mix_columns_mul_workspace_buffer = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0),
        this->mix_columns_mul_workspace_buffer,
        MIX_COLUMNS_MUL_WORKSPACE_BYTES * BITS_PER_BYTE * num_aes_inputs,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->vec_tmp_bit_buffer = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->vec_tmp_bit_buffer,
        num_aes_inputs, params.big_lwe_dimension, size_tracker,
        allocate_gpu_memory);
  }

  void release(CudaStreams streams, bool allocate_gpu_memory) {
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->mix_columns_col_copy_buffer,
                                   allocate_gpu_memory);
    delete this->mix_columns_col_copy_buffer;
    this->mix_columns_col_copy_buffer = nullptr;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->mix_columns_mul_workspace_buffer,
                                   allocate_gpu_memory);
    delete this->mix_columns_mul_workspace_buffer;
    this->mix_columns_mul_workspace_buffer = nullptr;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->vec_tmp_bit_buffer,
                                   allocate_gpu_memory);
    delete this->vec_tmp_bit_buffer;
    this->vec_tmp_bit_buffer = nullptr;
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

/**
 * In CTR mode, a counter is homomorphically added to the encrypted IV. This
 * structure holds the necessary buffers for this 128-bit ripple-carry
 * addition, such as the buffer for the propagating carry bit
 * (`vec_tmp_carry_buffer`) across the addition chain.
 */
template <typename Torus> struct int_aes_counter_workspaces {
  CudaRadixCiphertextFFI *vec_tmp_carry_buffer;
  CudaRadixCiphertextFFI *vec_tmp_sum_buffer;
  CudaRadixCiphertextFFI *vec_trivial_b_bits_buffer;
  Torus *h_counter_bits_buffer;
  Torus *d_counter_bits_buffer;

  int_aes_counter_workspaces(CudaStreams streams,
                             const int_radix_params &params,
                             bool allocate_gpu_memory, uint32_t num_aes_inputs,
                             uint64_t &size_tracker) {

    this->vec_tmp_carry_buffer = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->vec_tmp_carry_buffer,
        num_aes_inputs, params.big_lwe_dimension, size_tracker,
        allocate_gpu_memory);

    this->vec_tmp_sum_buffer = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->vec_tmp_sum_buffer,
        num_aes_inputs, params.big_lwe_dimension, size_tracker,
        allocate_gpu_memory);

    this->vec_trivial_b_bits_buffer = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0),
        this->vec_trivial_b_bits_buffer, num_aes_inputs,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->h_counter_bits_buffer =
        (Torus *)malloc(safe_mul_sizeof<Torus>(num_aes_inputs));
    size_tracker += safe_mul_sizeof<Torus>(num_aes_inputs);
    this->d_counter_bits_buffer = (Torus *)cuda_malloc_with_size_tracking_async(
        safe_mul_sizeof<Torus>(num_aes_inputs), streams.stream(0),
        streams.gpu_index(0), size_tracker, allocate_gpu_memory);
  }

  void release(CudaStreams streams, bool allocate_gpu_memory) {
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->vec_tmp_carry_buffer,
                                   allocate_gpu_memory);
    delete this->vec_tmp_carry_buffer;
    this->vec_tmp_carry_buffer = nullptr;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->vec_tmp_sum_buffer,
                                   allocate_gpu_memory);
    delete this->vec_tmp_sum_buffer;
    this->vec_tmp_sum_buffer = nullptr;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->vec_trivial_b_bits_buffer,
                                   allocate_gpu_memory);
    delete this->vec_trivial_b_bits_buffer;
    this->vec_trivial_b_bits_buffer = nullptr;

    if (allocate_gpu_memory) {
      cuda_drop_async(this->d_counter_bits_buffer, streams.stream(0),
                      streams.gpu_index(0));
    }
    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
    free(this->h_counter_bits_buffer);
  }
};

/**
 * This structure allocates the most significant memory blocks:
 * - `sbox_internal_workspace`: A large workspace for the complex, parallel
 * evaluation of the S-Box circuit.
 * - `main_bitsliced_states_buffer`: Holds the entire set of AES states in a
 * bitsliced layout, which is optimal for parallel bitwise operations on the
 * GPU.
 * - Other buffers are used for data layout transformations (transposition) and
 * for batching small operations into larger, more efficient launches.
 */
template <typename Torus> struct int_aes_main_workspaces {
  CudaRadixCiphertextFFI *sbox_internal_workspace;
  CudaRadixCiphertextFFI *initial_states_and_jit_key_workspace;
  CudaRadixCiphertextFFI *main_bitsliced_states_buffer;
  CudaRadixCiphertextFFI *tmp_tiled_key_buffer;
  CudaRadixCiphertextFFI *batch_processing_buffer;

  int_aes_main_workspaces(CudaStreams 
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
          num_blocks_to_decompress, decompression_rescale_lut->params.pbs_type);
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
#include "pbs/pbs_utilities.h"
#include "pbs/programmable_bootstrap.cuh"
#include "utils/helper_multi_gpu.cuh"
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
    uint32_t output_message_modulus, uint32_t output_carry_modulus,
    std::function<Torus(Torus)> f, bool gpu_memory_al
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
        streams.active_gpu_subset(num_blocks, params.pbs_type), {0}, {fs},
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

      auto lut_active = streams.active_gpu_subset(acc_blocks, params.pbs_type);
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
      release_radix_ciphertext_async(streams
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
    auto active_id = streams.active_gpu_subset(2 * K * M, params.pbs_type);
    identity_lut->generate_and_broadcast_lut(active_id, {0}, {identity_f},
                                             LUT_0_FOR_ALL_BLOCKS);

    is_non_zero_lut = new int_radix_lut<Torus>(
        streams, params, 1, K * M, allocate_gpu_memory, size_tracker);
    auto active_nz = streams.active_gpu_subset(K * M, params.pbs_type);
    is_non_zero_lut->generate_and_broadcast_lut(active_nz, {0}, {is_non_zero_f},
                                                LUT_0_FOR_ALL_BLOCKS);

    uint32_t tree_inner_blocks = tree_first_blocks > 0 ? tree_first_blocks : K;
    is_any_not_equal_lut =
        new int_radix_lut<Torus>(streams, params, 1, tree_inner_blocks,
                                 allocate_gpu_memory, size_tracker);
    auto active_inner =
        streams.active_gpu_subset(tree_inner_blocks, params.pbs_type);
    is_any_not_equal_lut->generate_and_broadcast_bivariate_lut(
        active_inner, {0}, {block_selector_f}, LUT_0_FOR_ALL_BLOCKS);

    is_any_not_equal_packed_lut = new int_radix_lut<Torus>(
        streams, params, 1, K, allocate_gpu_memory, size_tracker);
    auto active_last = streams.active_gpu_subset(K, params.pbs_type);
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
  int_radix_l
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
        streams.active_gpu_subset(bitext_ops, params.pbs_type);
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
        streams.active_gpu_subset(and_ops, params.pbs_type);

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
        streams.active_gpu_subset(flush_ops, params.pbs_type);

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
    ws->r
```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/pbs/pbs_128_utilities.h`
```
#ifndef CUDA_BOOTSTRAP_128_H
#define CUDA_BOOTSTRAP_128_H

#include "pbs_enums.h"
#include <stdint.h>

uint64_t scratch_cuda_programmable_bootstrap_128_vector_64(
    void *stream, uint32_t gpu_index, int8_t **pbs_buffer,
    uint32_t lwe_dimension, uint32_t glwe_dimension, uint32_t polynomial_size,
    uint32_t level_count, uint32_t input_lwe_ciphertext_count,
    bool allocate_gpu_memory, PBS_MS_REDUCTION_T noise_reduction_type);

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
    uint32_t num_samples, uint32_t glwe_dimension, uint32_t polynomial_size,
    uint32_t level_count, uint32_t max_shared_memory);

#if CUDA_ARCH >= 900
template <typename Torus>
uint64_t scratch_cuda_tbc_multi_bit_programmable_bootstrap(
    void *stream, uint32_t gpu_index, pbs_buffer<Torus, MULTI_BIT> **buffer,
    uint32_t glwe_dimension, uint32_t polynomial_size, uint32_t level_count,
    uint32_t input_lwe_ciphertext_count, bool allocate_gpu_memory);

template <typename Torus>
void cuda_tbc_multi_bit_programmable_bootstrap_lwe_ciphertext_vector_async(
    void *stream, uint32_t gpu_index, Torus *lwe_array_out,
    Torus const *lwe_output_indexes, Torus const *lut_vector,
    Torus const *lut_vector_indexes, Torus const *lwe_array_in,
    Torus const *lwe_input_indexes, Torus const *bootstrapping_key,
    pbs_buffer<Torus, MULTI_BIT> *pbs_buffer, uint32_t lwe_dimension,
    uint32_t glwe_dimension, uint32_t polynomial_size, uint32_t grouping_factor,
    uint32_t base_log, uint32_t level_count, uint32_t num_samples,
    uint32_t num_many_lut, uint32_t lut_stride);
#endif

template <typename Torus>
uint64_t scratch_cuda_cg_multi_bit_programmable_bootstrap(
    void *stream, uint32_t gpu_index, pbs_buffer<Torus, MULTI_BIT> **pbs_buffer,
    uint32_t glwe_dimension, uint32_t polynomial_size, uint32_t level_count,
    uint32_t input_lwe_ciphertext_count, bool allocate_gpu_memory);

template <typename Torus>
void cuda_cg_multi_bit_programmable_bootstrap_lwe_ciphertext_vector_async(
    void *stream, uint32_t gpu_index, Torus *lwe_array_out,
    Torus const *lwe_output_indexes, Torus const *lut_vector,
    Torus const *lut_vector_indexes, Torus const *lwe_array_in,
    Torus const *lwe_input_indexes, Torus const *bootstrapping_key,
    pbs_buffer<Torus, MULTI_BIT> *pbs_buffer, uint32_t lwe_dimension,
    uint32_t glwe_dimension, uint32_t polynomial_size, uint32_t grouping_factor,
    uint32_t base_log, uint32_t level_count, uint32_t num_samples,
    uint32_t num_many_lut, uint32_t lut_stride);

template <typename Torus>
uint64_t scratch_cuda_multi_bit_programmable_bootstrap(
    void *stream, uint32_t gpu_index, pbs_buffer<Torus, MULTI_BIT> **pbs_buffer,
    uint32_t glwe_dimension, uint32_t polynomial_size, uint32_t level_count,
    uint32_t input_lwe_ciphertext_count, bool allocate_gpu_memory);

template <typename Torus>
void cuda_multi_bit_programmable_bootstrap_lwe_ciphertext_vector_async(
    void *stream, uint32_t gpu_index, Torus *lwe_array_out,
    Torus const *lwe_output_indexes, Torus const *lut_vector,
    Torus const *lut_vector_indexes, Torus const *lwe_array_in,
    Torus const *lwe_input_indexes, Torus const *bootstrapping_key,
    pbs_buffer<Torus, MULTI_BIT> *pbs_buffer, uint32_t lwe_dimension,
    uint32_t glwe_dimension, uint32_t polynomial_size, uint32_t grouping_factor,
    uint32_t base_log, uint32_t level_count, uint32_t num_samples,
    uint32_t num_many_lut, uint32_t lut_stride);

template <typename Torus>
uint64_t get_buffer_size_full_sm_multibit_programmable_bootstrap_128_keybundle(
    uint32_t polynomial_size);
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
                            uint32_t polynomial_size, uint32_t glwe_dimension,
                            uint32_t level_count, uint64_t full_sm_keybundle);
template <typename Torus, class params>
uint64_t get_lwe_chunk_size_128(uint32_t gpu_index, uint32_t max_num_pbs,
                                uint32_t polynomial_size,
                                uint32_t glwe_dimension, uint32_t level_count,
                                uint64_t full_sm_keybundle);
template <typename Torus>
struct pbs_buffer<Torus, PBS_TYPE::MULTI_BIT> : public pbs_buffer_base {
  int8_t *d_mem_keybundle = NULL;
  int8_t *d_mem_acc_step_one = NULL;
  int8_t *d_mem_acc_step_two = NULL;
  int8_t *d_mem_acc_cg = NULL;
  int8_t *d_mem_acc_tbc = NULL;
  uint64_t lwe_chunk_size;
  double2 *keybundle_fft;
  Torus *global_accumulator;
  double2 *global_join_buffer;

  PBS_VARIANT pbs_variant;
  bool gpu_memory_allocated;

  pbs_buffer(cudaStream_t stream, uint32_t gpu_index, uint32_t glwe_dimension,
             uint32_t polynomial_size, uint32_t level_count,
             uint32_t input_lwe_ciphertext_count, uint64_t lwe_chunk_size,
             PBS_VARIANT pbs_variant, bool allocate_gpu_memory,
             uint64_t &size_tracker) {
    gpu_memory_allocated = allocate_gpu_memory;
    cuda_set_device(gpu_index);

    this->pbs_variant = pbs_variant;
    this->lwe_chunk_size = lwe_chunk_size;
    auto max_shared_memory = cuda_get_max_shared_memory(gpu_index);

    // default
    uint64_t full_sm_keybundle =
        get_buffer_size_full_sm_multibit_programmable_bootstrap_keybundle<
            Torus>(polynomial_size);
    uint64_t full_sm_accumulate_step_one =
        get_buffer_size_full_sm_multibit_programmable_bootstrap_step_one<Torus>(
            polynomial_size);
    uint64_t full_sm_accumulate_step_two =
        get_buffer_size_full_sm_multibit_programmable_bootstrap_step_two<Torus>(
            polynomial_size);
    uint64_t partial_sm_accumulate_step_one =
        get_buffer_size_partial_sm_multibit_programmable_bootstrap_step_one<
            Torus>(polynomial_size);
    // cg
    uint64_t full_sm_cg_accumulate =
        get_buffer_size_full_sm_cg_multibit_programmable_bootstrap<Torus>(
            polynomial_size);
    uint64_t partial_sm_cg_accumulate =
        get_buffer_size_partial_sm_cg_multibit_programmable_bootstrap<Torus>(
            polynomial_size);

    size_t num_blocks_keybundle = safe_mul(
        (size_t)input_lwe_ciphertext_count, (size_t)lwe_chunk_size,
        safe_mul((size_t)(glwe_dimension + 1), (size_t)(glwe_dimension + 1)),
        (size_t)level_count);
    size_t num_blocks_acc_step_one =
        safe_mul((size_t)level_count, (size_t)(glwe_dimension + 1),
                 (size_t)input_lwe_ciphertext_count);
    size_t num_blocks_acc_step_two = safe_mul(
        (size_t)input_lwe_ciphertext_count, (size_t)(glwe_dimension + 1));
    size_t num_blocks_acc_cg =
        safe_mul((size_t)level_count, (size_t)(glwe_dimension + 1),
                 (size_t)input_lwe_ciphertext_count);

#if CUDA_ARCH >= 900
    uint64_t full_sm_tbc_accumulate =
        get_buffer_size_full_sm_tbc_multibit_programmable_bootstrap<Torus>(
            polynomial_size);
    uint64_t partial_sm_tbc_accumulate =
        get_buffer_size_partial_sm_tbc_multibit_programmable_bootstrap<Torus>(
            polynomial_size);
    uint64_t minimum_sm_tbc =
        get_buffer_size_sm_dsm_plus_tbc_multibit_programmable_bootstrap<Torus>(
            polynomial_size);
    size_t num_blocks_acc_tbc = num_blocks_acc_cg;
#endif

    // Keybundle
    if (max_shared_memory < full_sm_keybundle)
      d_mem_keybundle = (int8_t *)cuda_malloc_with_size_tracking_async(
          safe_mul(num_blocks_keybundle, full_sm_keybundle), stream, gpu_index,
          size_tracker, allocate_gpu_memory);

    switch (pbs_variant) {
    case PBS_VARIANT::CG:
      // Accumulator CG
      if (max_shared_memory < partial_sm_cg_accumulate)
        d_mem_acc_cg = (int8_t *)cuda_malloc_with_size_tracking_async(
            safe_mul(num_blocks_acc_cg, full_sm_cg_accumulate), stream,
            gpu_index, size_tracker, allocate_gpu_memory);
      else if (max_shared_memory < full_sm_cg_accumulate)
        d_mem_acc_cg = (int8_t *)cuda_malloc_with_size_tracking_async(
            safe_mul(num_blocks_acc_cg, partial_sm_cg_accumulate), stream,
            gpu_index, size_tracker, allocate_gpu_memory);
      break;
    case PBS_VARIANT::DEFAULT:
      // Accumulator step one
      if (max_shared_memory < partial_sm_accumulate_step_one)
        d_mem_acc_step_one = (int8_t *)cuda_malloc_with_size_tracking_async(
            safe_mul(num_blocks_acc_step_one, full_sm_accumulate_step_one),
            stream, gpu_index, size_tracker, allocate_gpu_memory);
      else if (max_shared_memory < full_sm_accumulate_step_one)
        d_mem_acc_step_one = (int8_t *)cuda_malloc_with_size_tracking_async(
            safe_mul(num_blocks_acc_step_one, partial_sm_accumulate_step_one),
            stream, gpu_index, size_tracker, allocate_gpu_memory);

      // Accumulator step two
      if (max_shared_memory < full_sm_accumulate_step_two)
        d_mem_acc_step_two = (int8_t *)cuda_malloc_with_size_tracking_async(
         
```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/pbs/pbs_utilities.h`
```
#ifndef CUDA_BOOTSTRAP_UTILITIES_H
#define CUDA_BOOTSTRAP_UTILITIES_H

#include "checked_arithmetic.h"
#include "device.h"
#include "pbs_enums.h"
#include "vector_types.h"
#include <stdint.h>

template <typename Torus>
uint64_t get_buffer_size_full_sm_programmable_bootstrap_step_one(
    uint32_t polynomial_size) {
  size_t double_count = (sizeof(Torus) == 16) ? 2 : 1;
  return safe_mul_sizeof<Torus>(polynomial_size) + // accumulator_rotated
         safe_mul_sizeof<double>(double_count,
                                 (size_t)polynomial_size); // accumulator fft
}
template <typename Torus>
uint64_t get_buffer_size_full_sm_programmable_bootstrap_step_two(
    uint32_t polynomial_size) {
  size_t double_count = (sizeof(Torus) == 16) ? 2 : 1;
  return safe_mul_sizeof<Torus>(polynomial_size) + // accumulator
         safe_mul_sizeof<double>(double_count,
                                 (size_t)polynomial_size); // accumulator fft
}

template <typename Torus>
uint64_t
get_buffer_size_partial_sm_programmable_bootstrap(uint32_t polynomial_size) {
  size_t double_count = (sizeof(Torus) == 16) ? 2 : 1;
  return safe_mul_sizeof<double>(double_count,
                                 (size_t)polynomial_size); // accumulator fft
}

template <typename Torus>
uint64_t
get_buffer_size_full_sm_programmable_bootstrap_tbc(uint32_t polynomial_size) {
  return safe_mul_sizeof<Torus>(polynomial_size) +      // accumulator_rotated
         safe_mul_sizeof<Torus>(polynomial_size) +      // accumulator
         safe_mul_sizeof<double2>(polynomial_size / 2); // accumulator fft
}

template <typename Torus>
uint64_t get_buffer_size_partial_sm_programmable_bootstrap_tbc(
    uint32_t polynomial_size) {
  return safe_mul_sizeof<double2>(polynomial_size /
                                  2); // accumulator fft mask & body
}

template <typename Torus>
uint64_t get_buffer_size_sm_dsm_plus_tbc_classic_programmable_bootstrap(
    uint32_t polynomial_size) {
  return safe_mul_sizeof<double2>(polynomial_size / 2); // tbc
}

template <typename Torus>
uint64_t get_buffer_size_full_sm_programmable_bootstrap_tbc_2_2_params(
    uint32_t polynomial_size) {
  // In the first implementation with 2-2 params, we need up to 5 polynomials in
  // shared memory we can optimize this later
  return safe_mul_sizeof<Torus>((size_t)polynomial_size, (size_t)5);
}

template <typename Torus>
uint64_t
get_buffer_size_full_sm_programmable_bootstrap_cg(uint32_t polynomial_size) {
  size_t double_count = (sizeof(Torus) == 16) ? 2 : 1;
  return safe_mul_sizeof<Torus>(polynomial_size) + // accumulator_rotated
         safe_mul_sizeof<Torus>(polynomial_size) + // accumulator
         safe_mul_sizeof<double>((size_t)polynomial_size,
                                 double_count); // accumulator fft
}

template <typename Torus>
uint64_t
get_buffer_size_partial_sm_programmable_bootstrap_cg(uint32_t polynomial_size) {
  size_t double_count = (sizeof(Torus) == 16) ? 2 : 1;
  return safe_mul_sizeof<double>((size_t)polynomial_size,
                                 double_count); // accumulator fft mask & body
}
template <typename Torus>
uint64_t get_buffer_size_full_sm_programmable_bootstrap_128_tbc(
    uint32_t polynomial_size) {
  return safe_mul_sizeof<Torus>(polynomial_size) + // accumulator_rotated
         safe_mul_sizeof<Torus>(polynomial_size) + // accumulator
         safe_mul_sizeof<Torus>(polynomial_size);  // accumulator fft
}

template <typename Torus>
bool supports_distributed_shared_memory_on_classic_programmable_bootstrap(
    uint32_t polynomial_size, uint32_t max_shared_memory);

struct pbs_buffer_base {
  virtual void release(cudaStream_t stream, uint32_t gpu_index) = 0;
  virtual ~pbs_buffer_base() = default;
};

template <typename Torus, PBS_TYPE pbs_type> struct pbs_buffer;

template <typename Torus>
struct pbs_buffer<Torus, PBS_TYPE::CLASSICAL> : public pbs_buffer_base {
  int8_t *d_mem;

  Torus *global_accumulator;
  double2 *global_join_buffer;

  PBS_VARIANT pbs_variant;
  PBS_MS_REDUCTION_T noise_reduction_type;
  bool gpu_memory_allocated;

  pbs_buffer(cudaStream_t stream, uint32_t gpu_index, uint32_t lwe_dimension,
             uint32_t glwe_dimension, uint32_t polynomial_size,
             uint32_t level_count, uint32_t input_lwe_ciphertext_count,
             PBS_VARIANT pbs_variant, bool allocate_gpu_memory,
             PBS_MS_REDUCTION_T noise_reduction_type, uint64_t &size_tracker)
      : noise_reduction_type(noise_reduction_type) {
    gpu_memory_allocated = allocate_gpu_memory;
    cuda_set_device(gpu_index);
    this->pbs_variant = pbs_variant;

    auto max_shared_memory = cuda_get_max_shared_memory(gpu_index);
    switch (pbs_variant) {
    case PBS_VARIANT::DEFAULT: {
      uint64_t full_sm_step_one =
          get_buffer_size_full_sm_programmable_bootstrap_step_one<Torus>(
              polynomial_size);
      uint64_t full_sm_step_two =
          get_buffer_size_full_sm_programmable_bootstrap_step_two<Torus>(
              polynomial_size);
      uint64_t partial_sm =
          get_buffer_size_partial_sm_programmable_bootstrap<Torus>(
              polynomial_size);

      uint64_t partial_dm_step_one = full_sm_step_one - partial_sm;
      uint64_t partial_dm_step_two = full_sm_step_two - partial_sm;
      uint64_t full_dm = full_sm_step_one;

      uint64_t device_mem = 0;
      if (max_shared_memory < partial_sm) {
        device_mem =
            safe_mul(full_dm, (size_t)input_lwe_ciphertext_count,
                     (size_t)level_count, (size_t)(glwe_dimension + 1));
      } else if (max_shared_memory < full_sm_step_two) {
        device_mem = safe_mul(
            partial_dm_step_two +
                safe_mul(partial_dm_step_one, (size_t)level_count),
            (size_t)input_lwe_ciphertext_count, (size_t)(glwe_dimension + 1));
      } else if (max_shared_memory < full_sm_step_one) {
        device_mem =
            safe_mul(partial_dm_step_one, (size_t)input_lwe_ciphertext_count,
                     (size_t)level_count, (size_t)(glwe_dimension + 1));
      }
      // Otherwise, both kernels run all in shared memory
      d_mem = (int8_t *)cuda_malloc_with_size_tracking_async(
          device_mem, stream, gpu_index, size_tracker, allocate_gpu_memory);

      global_join_buffer = (double2 *)cuda_malloc_with_size_tracking_async(
          safe_mul_sizeof<double2>(
              safe_mul((size_t)(glwe_dimension + 1), (size_t)level_count),
              (size_t)input_lwe_ciphertext_count,
              (size_t)(polynomial_size / 2)),
          stream, gpu_index, size_tracker, allocate_gpu_memory);

      global_accumulator = (Torus *)cuda_malloc_with_size_tracking_async(
          safe_mul_sizeof<Torus>((size_t)(glwe_dimension + 1),
                                 (size_t)input_lwe_ciphertext_count,
                                 (size_t)polynomial_size),
          stream, gpu_index, size_tracker, allocate_gpu_memory);
    } break;
    case PBS_VARIANT::CG: {
      uint64_t full_sm =
          get_buffer_size_full_sm_programmable_bootstrap_cg<Torus>(
              polynomial_size);
      uint64_t partial_sm =
          get_buffer_size_partial_sm_programmable_bootstrap_cg<Torus>(
              polynomial_size);

      uint64_t partial_dm = full_sm - partial_sm;
      uint64_t full_dm = full_sm;
      uint64_t device_mem = 0;

      if (max_shared_memory < partial_sm) {
        device_mem =
            safe_mul(full_dm, (size_t)input_lwe_ciphertext_count,
                     (size_t)level_count, (size_t)(glwe_dimension + 1));
      } else if (max_shared_memory < full_sm) {
        device_mem =
            safe_mul(partial_dm, (size_t)input_lwe_ciphertext_count,
                     (size_t)level_count, (size_t)(glwe_dimension + 1));
      }

      // Otherwise, both kernels run all in shared memory
      d_mem = (int8_t *)cuda_malloc_with_size_tracking_async(
          device_mem, stream, gpu_index, size_tracker, allocate_gpu_memory);

      global_join_buffer = (double2 *)cuda_malloc_with_size_tracking_async(
          safe_mul_sizeof<double2>(
              safe_mul((size_t)(glwe_dimension + 1), (size_t)level_count),
              (size_t)input_lwe_ciphertext_count,
              (size_t)(polynomial_size / 2)),
          stream, gpu_index, size_tracker, allocate_gpu_memory);
    } break;
#if CUDA_ARCH >= 900
    case PBS_VARIANT::TBC: {

      bool supports_dsm =
          supports_distributed_shared_memory_on_classic_programmable_bootstrap<
              Torus>(polynomial_size, max_shared_memory);

      uint64_t full_sm =
          get_buffer_size_full_sm_programmable_bootstrap_tbc<Torus>(
              polynomial_size);
      uint64_t partial_sm =
          get_buffer_size_partial_sm_programmable_bootstrap_tbc<Torus>(
              polynomial_size);
      uint64_t minimum_sm_tbc = 0;
      if (supports_dsm)
        minimum_sm_tbc =
            get_buffer_size_sm_dsm_plus_tbc_classic_programmable_bootstrap<
                Torus>(polynomial_size);

      uint64_t partial_dm = full_sm - partial_sm;
      uint64_t full_dm = full_sm;
      uint64_t device_mem = 0;

      // There is a minimum amount of memory we need to run the TBC PBS, which
      // is minimum_sm_tbc. We know that minimum_sm_tbc bytes are available
      // because otherwise the previous check would have redirected
      // computation to some other variant. If over that we don't have more
      // partial_sm bytes, TBC PBS will run on NOSM. If we have partial_sm but
      // not full_sm bytes, it will run on PARTIALSM. Otherwise, FULLSM.
      //
      // NOSM mode actually requires minimum_sm_tbc shared memory bytes.
      if (max_shared_memory < partial_sm + minimum_sm_tbc) {
        device_mem =
            safe_mul(full_dm, (size_t)input_lwe_ciphertext_count,
                     (size_t)level_count, (size_t)(glwe_dimension + 1));
      } else if (max_shared_memory < full_sm + minimum_sm_tbc) {
        device_mem =
            safe_mul(partial_
```

### Core Architecture Module: `backends/tfhe-cuda-backend/cuda/include/trivium/trivium_utilities.h`
```
#ifndef TRIVIUM_UTILITIES_H
#define TRIVIUM_UTILITIES_H
#include "../integer/integer_utilities.h"

constexpr uint32_t TRIVIUM_BATCH_SIZE = 64;
constexpr uint32_t TRIVIUM_NUM_AND_GATES = 3;
constexpr uint32_t TRIVIUM_NUM_FLUSH_PATHS = 4;
constexpr uint32_t TRIVIUM_REGISTER_A_BITS = 93;
constexpr uint32_t TRIVIUM_REGISTER_B_BITS = 84;
constexpr uint32_t TRIVIUM_REGISTER_C_BITS = 111;
constexpr uint32_t TRIVIUM_KEY_BITS = 80;
constexpr uint32_t TRIVIUM_IV_BITS = 80;
// Standard Trivium warm-up: 1152 cycles (4 * 288 state bits) before the first
// keystream bit is emitted, processed in batches of TRIVIUM_BATCH_SIZE.
constexpr uint32_t TRIVIUM_WARMUP_CYCLES = 1152;
constexpr uint32_t TRIVIUM_WARMUP_BATCHES =
    TRIVIUM_WARMUP_CYCLES / TRIVIUM_BATCH_SIZE;

/// Struct to hold the LUTs.
template <typename Torus> struct int_trivium_lut_buffers {
  // Bivariate AND Gate LUT:
  // AND operation: f(a, b) = (a & 1) & (b & 1).
  // This is a Bivariate PBS used for the non-linear parts of Trivium.
  int_radix_lut<Torus> *and_lut;

  // Univariate Identity LUT:
  // MESSAGE EXTRACTION operation: f(x) = x & 1.
  // This is a Univariate PBS used to "flush" the state: it resets the noise
  // after additions and ensures the message stays within the binary message
  // space.
  int_radix_lut<Torus> *flush_lut;

  int_trivium_lut_buffers(CudaStreams streams, const int_radix_params &params,
                          bool allocate_gpu_memory, uint32_t num_trivium_inputs,
                          uint64_t &size_tracker) {

    uint32_t total_lut_ops =
        num_trivium_inputs * TRIVIUM_BATCH_SIZE * TRIVIUM_NUM_AND_GATES;

    this->and_lut = new int_radix_lut<Torus>(streams, params, 1, total_lut_ops,
                                             allocate_gpu_memory, size_tracker);

    std::function<Torus(Torus, Torus)> and_lambda =
        [](Torus a, Torus b) -> Torus { return (a & 1) & (b & 1); };

    auto active_streams_and =
        streams.active_gpu_subset(total_lut_ops, params.pbs_type);
    this->and_lut->generate_and_broadcast_bivariate_lut(
        active_streams_and, {0}, {and_lambda}, LUT_0_FOR_ALL_BLOCKS);

    uint32_t total_flush_ops =
        num_trivium_inputs * TRIVIUM_BATCH_SIZE * TRIVIUM_NUM_FLUSH_PATHS;

    this->flush_lut = new int_radix_lut<Torus>(
        streams, params, 1, total_flush_ops, allocate_gpu_memory, size_tracker);

    std::function<Torus(Torus)> flush_lambda = [](Torus x) -> Torus {
      return x & 1;
    };

    auto active_streams_flush =
        streams.active_gpu_subset(total_flush_ops, params.pbs_type);
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
  }
};

/// Holds the temporary GPU buffers and workspaces required during the
/// execution of the Trivium cipher. Registers a/b/c are owned by the caller
/// (the persistent state) and passed in to each call.
template <typename Torus> struct int_trivium_workspaces {
  CudaRadixCiphertextFFI *shift_workspace;

  // Temporary Update Buffers:
  // Intermediate buffers for the trivium update logic (t1, t2, t3)
  CudaRadixCiphertextFFI *temp_t1;
  CudaRadixCiphertextFFI *temp_t2;
  CudaRadixCiphertextFFI *temp_t3;

  // Buffers to hold the new values for the registers after an update step
  CudaRadixCiphertextFFI *new_a;
  CudaRadixCiphertextFFI *new_b;
  CudaRadixCiphertextFFI *new_c;

  // PBS Packing Buffers:
  // Buffers for packing inputs into the bivariate lookup table (AND gate)
  CudaRadixCiphertextFFI *packed_pbs_lhs;
  CudaRadixCiphertextFFI *packed_pbs_rhs;
  // Buffer for the output of the bivariate PBS
  CudaRadixCiphertextFFI *packed_pbs_out;

  // Flush/Cleanup Packing Buffers:
  // Buffers for the "flush" LUT which cleans up noise after additions
  CudaRadixCiphertextFFI *packed_flush_in;
  CudaRadixCiphertextFFI *packed_flush_out;

  int_trivium_workspaces(CudaStreams streams, const int_radix_params &params,
                         bool allocate_gpu_memory, uint32_t num_inputs,
                         uint64_t &size_tracker) {

    uint32_t batch_blocks = TRIVIUM_BATCH_SIZE * num_inputs;

    this->shift_workspace = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->shift_workspace,
        TRIVIUM_REGISTER_C_BITS * num_inputs, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);

    this->temp_t1 = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->temp_t1, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->temp_t2 = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->temp_t2, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->temp_t3 = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->temp_t3, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->new_a = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->new_a, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->new_b = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->new_b, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->new_c = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->new_c, batch_blocks,
        params.big_lwe_dimension, size_tracker, allocate_gpu_memory);

    this->packed_pbs_lhs = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_pbs_lhs,
        TRIVIUM_NUM_AND_GATES * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);

    this->packed_pbs_rhs = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_pbs_rhs,
        TRIVIUM_NUM_AND_GATES * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);

    this->packed_pbs_out = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_pbs_out,
        TRIVIUM_NUM_AND_GATES * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);

    this->packed_flush_in = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_flush_in,
        TRIVIUM_NUM_FLUSH_PATHS * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);

    this->packed_flush_out = new CudaRadixCiphertextFFI;
    create_zero_radix_ciphertext_async<Torus>(
        streams.stream(0), streams.gpu_index(0), this->packed_flush_out,
        TRIVIUM_NUM_FLUSH_PATHS * batch_blocks, params.big_lwe_dimension,
        size_tracker, allocate_gpu_memory);
  }

  void release(CudaStreams streams, bool allocate_gpu_memory) {
    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->shift_workspace, allocate_gpu_memory);
    delete this->shift_workspace;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->temp_t1, allocate_gpu_memory);
    delete this->temp_t1;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->temp_t2, allocate_gpu_memory);
    delete this->temp_t2;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->temp_t3, allocate_gpu_memory);
    delete this->temp_t3;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->new_a, allocate_gpu_memory);
    delete this->new_a;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->new_b, allocate_gpu_memory);
    delete this->new_b;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->new_c, allocate_gpu_memory);
    delete this->new_c;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_pbs_lhs, allocate_gpu_memory);
    delete this->packed_pbs_lhs;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_pbs_rhs, allocate_gpu_memory);
    delete this->packed_pbs_rhs;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_pbs_out, allocate_gpu_memory);
    delete this->packed_pbs_out;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_flush_in, allocate_gpu_memory);
    delete this->packed_flush_in;

    release_radix_ciphertext_async(streams.stream(0), streams.gpu_index(0),
                                   this->packed_flush_out, allocate_gpu_memory);
    delete this->packed_flush_out;

    cuda_synchronize_stream(streams.stream(0), streams.gpu_index(0));
  }
};

template <typename Torus> struct int_trivium_buffer {
  int_radix_params params;
  bool allocate_gpu_memory;
 
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

### Incident Patch 1: `ad00decd` (2026-10-02)
**Commit Message**: chore(deps): update dtolnay/rust-toolchain requirement to 7e38f4b43b4db5c8dd498af069a4f6196df1d067

Updates the requirements on [dtolnay/rust-toolchain](https://github.com/dtolnay/rust-toolchain) to permit the latest version.
- [Release notes](https://github.com/dtolnay/rust-toolchain/releases)
- [Commits](https://github.com/dtolnay/rust-toolchain/commits/7e38f4b43b4db5c8dd498af069a4f6196df1d067)

---
updated-dependencies:
- dependency-name: dtolnay/rust-toolchain
  dependency-version: 7e38f4b43b4db5c8dd498af069a4f6196df1d067
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/aws_data_tests.yml` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ jobs:
           git config --local --unset-all http.https://github.com/.extraheader || rm "${RUNNER_TEMP}"/git-credentials-*.config
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_fast_tests.yml` (modified, +1/-1)
```diff
@@ -161,7 +161,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_integer_tests.yml` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_noise_checks.yml` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_signed_integer_tests.yml` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_tests.yml` (modified, +1/-1)
```diff
@@ -166,7 +166,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_wasm_tests.yml` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ jobs:
           git config --global --add url."https://github.com/".insteadOf "git@github.com:"
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/benchmark_cpu_common.yml` (modified, +1/-1)
```diff
@@ -171,7 +171,7 @@ jobs:
           SHA: ${{ github.sha }}
 
       - name: Install rust
-        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@7e38f4b43b4db5c8dd498af069a4f6196df1d067 # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: nightly
 
```

---

### Incident Patch 2: `cacb7bae` (2026-10-01)
**Commit Message**: fix(bench): Measure sustained Hpu throughput for erc7984

The throughput benches issued one batch of IOps and waited on the last
result before criterion closed the iteration, so the pipeline was drained
on every batch. An Hpu only sustains its rate while IOps keep coming: with
a batch barely larger than the node count, each node ran a single IOp and
then idled through the whole refill, which measures a batch latency rather
than a throughput.

Reissuing the same operands `hpu_rounds` times before the single drain
keeps the queues filled without growing the resident set: operands are
pinned on their node on first use and stay there, so the on-board pool
only has to hold them once.

Also fix the SIMD operand order: the IOp declares its operands as
(from, to, amount) triplets, the bench passed them grouped by role.

**File**: `tfhe-benchmark/benches/high_level_api/erc7984.rs` (modified, +57/-35)
```diff
@@ -281,10 +281,11 @@ where
     FheType: FheHpu,
 {
     use tfhe::tfhe_hpu_backend::prelude::hpu_asm;
+    // The IOp declares its operands per transfer, i.e. as (from, to, amount) triplets, and not
+    // grouped by role (c.f. `erc7984_simd` in zhc_builder)
     let src = HpuHandle {
-        native: vec![from_amount, to_amount, amount]
-            .into_iter()
-            .flatten()
+        native: std::iter::zip(from_amount, std::iter::zip(to_amount, amount))
+            .flat_map(|(from, (to, amount))| [from, to, amount])
             .collect(),
         boolean: vec![],
         imm: vec![],
@@ -294,7 +295,7 @@ where
         hpu_asm::IOpcode::from(hpu_asm::StaticIOp::Erc7984Simd),
         src,
     );
-    // Iop erc_7984 return new_from, new_to
+    // Iop erc_7984_simd return a (new_from, new_to) pair for each transfer
     let res = res_handle.native;
     res
 }
@@ -636,38 +637,49 @@ fn hpu_bench_transfer_throughput<FheType, F>(
     let params = client_key.computation_parameters();
     let params_name = params.name();
 
+    // Size of the inputs set
+    // There is no memory release throughout the test. This enable to play with
+    // number of operation while prevent memory alloaction issue
+    // Number of times the operand set is reissued before the pipeline is drained
+    let input_set = 64;
+
     let mut group = group.benchmark_group(tag.to_string());
-    for num_elems in [10, 100] {
-        group.throughput(Throughput::Elements(num_elems));
+    for rounds in [10, 50, 100] {
+        let real_num_elems = rounds * input_set;
+        group.throughput(Throughput::Elements(real_num_elems));
         let bench_spec = BenchmarkSpec::new_hlapi(
             HlapiBench::Erc7984(erc7984_bench_spec),
             &params_name,
             OperandType::CipherText,
             Some(tag),
             BenchmarkMetric::Throughput,
-            Some(num_elems.try_into().unwrap()),
+            Some(real_num_elems.try_into().unwrap()),
         );
-        group.bench_with_input(bench_spec.to_string(), &num_elems, |b, &num_elems| {
-            let from_amounts = (0..num_elems)
+        group.bench_with_input(bench_spec.to_string(), &input_set, |b, &input_set| {
+            let from_amounts = (0..input_set)
                 .map(|_| FheType::encrypt(rng.gen::<u64>(), client_key))
                 .collect::<Vec<_>>();
-            let to_amounts = (0..num_elems)
+            let to_amounts = (0..input_set)
                 .map(|_| FheType::encrypt(rng.gen::<u64>(), client_key))
                 .collect::<Vec<_>>();
-            let amounts = (0..num_elems)
+            let amounts = (0..input_set)
                 .map(|_| FheType::encrypt(rng.gen::<u64>(), client_key))
                 .collect::<Vec<_>>();
 
             b.iter(|| {
-                let (last_new_from, last_new_to) = std::iter::zip(
-                    from_amounts.iter(),
-                    std::iter::zip(to_amounts.iter(), amounts.iter()),
-                )
-                .map(|(from_amount, (to_amount, amount))| {
-                    transfer_func(from_amount, to_amount, amount)
-                })
-                .last()
-                .unwrap();
+                // Issue every round back to back
+                let (last_new_from, last_new_to) = (0..rounds)
+                    .flat_map(|_| {
+                        std::iter::zip(
+                            from_amounts.iter(),
+                            std::iter::zip(to_amounts.iter(), amounts.iter()),
+                        )
+                    })
+                    .map(|(from_amount, (to_amount, amount))| {
+                        transfer_func(from_amount, to_amount, amount)
+                    })
+                    .last()
+                    .unwrap();
 
                 // Wait on last result to enforce all computation is over
                 last_new_from.wait();
@@ -707,9 +719,15 @@ fn hpu_bench_transfer_throughput_simd<FheType, F>(
     let params = client_key.computation_parameters();
     let params_name = params.name();
 
+    // Size of the inputs set
+    // There is no memory release throughout the test. This enable to play with
+    // number of operation while prevent memory alloaction issue
+    // Number of times the operand set is reissued before the pipeline is drained
+    let input_set = 24;
+
     let mut group = group.benchmark_group(tag.to_string());
-    for num_elems in [2, 8] {
-        let real_num_elems = num_elems * (hpu_simd_n as u64);
+    for rounds in [10, 50, 100] {
+        let real_num_elems = rounds * input_set * (hpu_simd_n as u64);
         group.throughput(Throughput::Elements(real_num_elems));
         let bench_spec = BenchmarkSpec::new_hlapi(
             HlapiBench::Erc7984(erc7984_bench_spec),
@@ -719,22 +737,22 @@ fn hpu_bench_transfer_throughput_simd<FheType, F>(
             BenchmarkMetric::Throughput,
             Some(real_num_elems.try_into().unwrap()),
         );
-      
```

---

### Incident Patch 3: `aefd1438` (2026-09-25)
**Commit Message**: fix(wasm): repair the push value for u32 in worker.js

**File**: `tfhe/web_wasm_parallel_tests/worker.js` (modified, +2/-2)
```diff
@@ -155,15 +155,15 @@ async function compactPublicKeyBench32Bit(params_name) {
   let bench_id = cpk_gen_id(params_name_str, 32);
   bench_results[mean_name(bench_id, cross_origin)] = timing_1;
 
-  let values = [0, 1, 2, 2394, U32_MAX].map(BigInt);
+  let values = [0, 1, 2, 2394, U32_MAX];
 
   // Bench the encryption for bench_loops iterations
   start = performance.now();
   let compact_list;
   for (let i = 0; i < bench_loops; i++) {
     let builder = CompactCiphertextList.builder(publicKey);
     for (let value of values) {
-      builder.push_u256(value);
+      builder.push_u32(value);
     }
     compact_list = builder.build();
   }
```

---

### Incident Patch 4: `0e3c6619` (2026-09-29)
**Commit Message**: chore(ci): refacto around setup and teardown of slab and also fix the teardown condition

**File**: `.github/workflows/aws_tfhe_noise_checks.yml` (modified, +21/-44)
```diff
@@ -27,30 +27,15 @@ permissions:
 jobs:
   setup-instance:
     name: aws_tfhe_noise_checks/setup-instance
-    runs-on: ubuntu-latest
-    outputs:
-      runner-name: ${{ steps.start-remote-instance.outputs.label || steps.start-github-instance.outputs.runner_group }}
-    steps:
-      - name: Start remote instance
-        id: start-remote-instance
-        if: env.SECRETS_AVAILABLE == 'true'
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: start
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          backend: aws
-          # We want an hpc7a more compute, will be faster
-          profile: bench
-
-      # This instance will be spawned especially for pull-request from forked repository
-      - name: Start GitHub instance
-        id: start-github-instance
-        if: env.SECRETS_AVAILABLE == 'false'
-        run: |
-          echo "Cannot run this without secrets"
-          exit 1
+    uses: ./.github/workflows/slab_setup.yml
+    with:
+      backend: aws
+      # We want an hpc7a more compute, will be faster
+      profile: bench
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
 
   noise-checks:
     name: aws_tfhe_noise_checks/noise-checks
@@ -92,24 +77,16 @@ jobs:
 
   teardown-instance:
     name: aws_tfhe_noise_checks/teardown-instance
-    if: ${{ always() && needs.setup-instance.result == 'success' }}
+    if: ${{ always() && needs.setup-instance.outputs.runner-name != '' }}
     needs: [ setup-instance, noise-checks ]
-    runs-on: ubuntu-latest
-    steps:
-      - name: Stop remote instance
-        id: stop-instance
-        if: env.SECRETS_AVAILABLE == 'true'
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: stop
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          label: ${{ needs.setup-instance.outputs.runner-name }}
-
-      - name: Slack Notification
-        if: ${{ !success() }}
-        uses: rtCamp/action-slack-notify@33ca3be66c6f378fe1610fd1d5258632dbed5e58
-        env:
-          SLACK_COLOR: ${{ job.status }}
-          SLACK_MESSAGE: "Instance teardown (noise-checks) finished with status: ${{ job.status }}. (${{ env.ACTION_RUN_URL }})"
+    uses: ./.github/workflows/slab_teardown.yml
+    with:
+      runner-name: ${{ needs.setup-instance.outputs.runner-name }}
+      notification-context: noise-checks
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
+      SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
+      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}
+      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**File**: `.github/workflows/benchmark_cpu_common.yml` (modified, +20/-33)
```diff
@@ -130,20 +130,14 @@ jobs:
   setup-instance:
     name: benchmark_cpu_common/setup-instance
     needs: prepare-matrix
-    runs-on: ubuntu-latest
-    outputs:
-      runner-name: ${{ steps.start-instance.outputs.label }}
-    steps:
-      - name: Start instance
-        id: start-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: start
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          backend: ${{ inputs.backend }}
-          profile: ${{ inputs.profile }}
+    uses: ./.github/workflows/slab_setup.yml
+    with:
+      backend: ${{ inputs.backend }}
+      profile: ${{ inputs.profile }}
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
 
   integer-benchmarks:
     name: benchmark_cpu_common/integer-benchmarks
@@ -295,23 +289,16 @@ jobs:
 
   teardown-instance:
     name: benchmark_cpu_common/teardown-instance
-    if: ${{ always() && needs.setup-instance.result == 'success' }}
+    if: ${{ always() && needs.setup-instance.outputs.runner-name != '' }}
     needs: [ setup-instance, integer-benchmarks ]
-    runs-on: ubuntu-latest
-    steps:
-      - name: Stop instance
-        id: stop-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: stop
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          label: ${{ needs.setup-instance.outputs.runner-name }}
-
-      - name: Slack Notification
-        if: ${{ failure() }}
-        uses: rtCamp/action-slack-notify@33ca3be66c6f378fe1610fd1d5258632dbed5e58
-        env:
-          SLACK_COLOR: ${{ job.status }}
-          SLACK_MESSAGE: "Instance teardown (cpu-benchmarks) finished with status: ${{ job.status }}. (${{ env.ACTION_RUN_URL }})"
+    uses: ./.github/workflows/slab_teardown.yml
+    with:
+      runner-name: ${{ needs.setup-instance.outputs.runner-name }}
+      notification-context: cpu-benchmarks
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
+      SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
+      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}
+      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**File**: `.github/workflows/benchmark_ct_key_sizes.yml` (modified, +20/-33)
```diff
@@ -27,20 +27,14 @@ jobs:
     name: Setup instance (sizes-benchmarks)
     if: github.event_name == 'workflow_dispatch' ||
       (github.event_name == 'schedule' && github.repository == 'zama-ai/tfhe-rs')
-    runs-on: ubuntu-latest
-    outputs:
-      runner-name: ${{ steps.start-instance.outputs.label }}
-    steps:
-      - name: Start instance
-        id: start-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: start
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          backend: aws
-          profile: cpu-big
+    uses: ./.github/workflows/slab_setup.yml
+    with:
+      backend: aws
+      profile: cpu-big
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
 
   sizes-benchmarks:
     name: Execute sizes client benchmarks
@@ -133,23 +127,16 @@ jobs:
 
   teardown-instance:
     name: Teardown instance (sizes-benchmarks)
-    if: ${{ always() && needs.setup-instance.result == 'success' }}
+    if: ${{ always() && needs.setup-instance.outputs.runner-name != '' }}
     needs: [ setup-instance, sizes-benchmarks ]
-    runs-on: ubuntu-latest
-    steps:
-      - name: Stop instance
-        id: stop-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: stop
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          label: ${{ needs.setup-instance.outputs.runner-name }}
-
-      - name: Slack Notification
-        if: ${{ failure() }}
-        uses: rtCamp/action-slack-notify@33ca3be66c6f378fe1610fd1d5258632dbed5e58
-        env:
-          SLACK_COLOR: ${{ job.status }}
-          SLACK_MESSAGE: "Instance teardown (sizes-benchmarks) finished with status: ${{ job.status }}. (${{ env.ACTION_RUN_URL }})"
+    uses: ./.github/workflows/slab_teardown.yml
+    with:
+      runner-name: ${{ needs.setup-instance.outputs.runner-name }}
+      notification-context: sizes-benchmarks
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
+      SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
+      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}
+      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**File**: `.github/workflows/benchmark_gpu_common.yml` (modified, +20/-33)
```diff
@@ -131,20 +131,14 @@ jobs:
   setup-instance:
     name: benchmark_gpu_common/setup-instance
     needs: prepare-matrix
-    runs-on: ubuntu-latest
-    outputs:
-      runner-name: ${{ steps.start-instance.outputs.label }}
-    steps:
-      - name: Start instance
-        id: start-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: start
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          backend: ${{ inputs.backend }}
-          profile: ${{ inputs.profile }}
+    uses: ./.github/workflows/slab_setup.yml
+    with:
+      backend: ${{ inputs.backend }}
+      profile: ${{ inputs.profile }}
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
 
   install-dependencies:
     name: benchmark_gpu_common/install-dependencies
@@ -365,23 +359,16 @@ jobs:
 
   teardown-instance:
     name: benchmark_gpu_common/teardown-instance
-    if: ${{ always() && needs.setup-instance.result == 'success' }}
+    if: ${{ always() && needs.setup-instance.outputs.runner-name != '' }}
     needs: [ setup-instance, cuda-benchmarks, slack-notify ]
-    runs-on: ubuntu-latest
-    steps:
-      - name: Stop instance
-        id: stop-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: stop
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          label: ${{ needs.setup-instance.outputs.runner-name }}
-
-      - name: Slack Notification
-        if: ${{ failure() }}
-        uses: rtCamp/action-slack-notify@33ca3be66c6f378fe1610fd1d5258632dbed5e58
-        env:
-          SLACK_COLOR: ${{ job.status }}
-          SLACK_MESSAGE: "Instance teardown (cuda-${{ inputs.profile }}-benchmarks) finished with status: ${{ job.status }}. (${{ env.ACTION_RUN_URL }})"
+    uses: ./.github/workflows/slab_teardown.yml
+    with:
+      runner-name: ${{ needs.setup-instance.outputs.runner-name }}
+      notification-context: cuda-${{ inputs.profile }}-benchmarks
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
+      SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
+      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}
+      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**File**: `.github/workflows/benchmark_gpu_coprocessor.yml` (modified, +20/-30)
```diff
@@ -83,22 +83,14 @@ jobs:
   setup-instance:
     name: benchmark_gpu_coprocessor/setup-instance
     needs: parse-inputs
-    runs-on: ubuntu-latest
-    permissions:
-      contents: 'read'
-    outputs:
-      runner-name: ${{ steps.start-remote-instance.outputs.label }}
-    steps:
-      - name: Start remote instance
-        id: start-remote-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: start
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          backend: ${{ needs.parse-inputs.outputs.backend }}
-          profile: ${{ needs.parse-inputs.outputs.profile }}
+    uses: ./.github/workflows/slab_setup.yml
+    with:
+      backend: ${{ needs.parse-inputs.outputs.backend }}
+      profile: ${{ needs.parse-inputs.outputs.profile }}
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
 
   benchmark-gpu:
     name: benchmark_gpu_coprocessor/benchmark-gpu (bpr)
@@ -332,18 +324,16 @@ jobs:
 
   teardown-instance:
     name: benchmark_gpu_coprocessor/teardown-instance
-    if: ${{ always() && needs.setup-instance.result == 'success' }}
+    if: ${{ always() && needs.setup-instance.outputs.runner-name != '' }}
     needs: [ setup-instance, benchmark-gpu ]
-    runs-on: ubuntu-latest
-    permissions:
-      contents: 'read'
-    steps:
-      - name: Stop remote instance
-        id: stop-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: stop
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          label: ${{ needs.setup-instance.outputs.runner-name }}
+    uses: ./.github/workflows/slab_teardown.yml
+    with:
+      runner-name: ${{ needs.setup-instance.outputs.runner-name }}
+      notification-context: benchmark-gpu-coprocessor
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
+      SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
+      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}
+      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**File**: `.github/workflows/benchmark_perf_regression.yml` (modified, +20/-33)
```diff
@@ -137,20 +137,14 @@ jobs:
   setup-instance:
     name: benchmark_perf_regression/setup-instance
     needs: prepare-benchmarks
-    runs-on: ubuntu-latest
-    outputs:
-      runner-name: ${{ steps.start-instance.outputs.label }}
-    steps:
-      - name: Start instance
-        id: start-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: start
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          backend: ${{ needs.prepare-benchmarks.outputs.slab-backend }}
-          profile: ${{ needs.prepare-benchmarks.outputs.slab-profile }}
+    uses: ./.github/workflows/slab_setup.yml
+    with:
+      backend: ${{ needs.prepare-benchmarks.outputs.slab-backend }}
+      profile: ${{ needs.prepare-benchmarks.outputs.slab-profile }}
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
 
   install-cuda-dependencies-if-required:
     name: benchmark_perf_regression/install-cuda-dependencies-if-required
@@ -356,23 +350,16 @@ jobs:
 
   teardown-instance:
     name: benchmark_perf_regression/teardown-instance
-    if: ${{ always() && needs.setup-instance.result == 'success' }}
+    if: ${{ always() && needs.setup-instance.outputs.runner-name != '' }}
     needs: [ setup-instance, regression-benchmarks ]
-    runs-on: ubuntu-latest
-    steps:
-      - name: Stop instance
-        id: stop-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: stop
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          label: ${{ needs.setup-instance.outputs.runner-name }}
-
-      - name: Slack Notification
-        if: ${{ failure() }}
-        uses: rtCamp/action-slack-notify@33ca3be66c6f378fe1610fd1d5258632dbed5e58
-        env:
-          SLACK_COLOR: ${{ job.status }}
-          SLACK_MESSAGE: "Instance teardown (regression-benchmarks) finished with status: ${{ job.status }}. (${{ env.ACTION_RUN_URL }})"
+    uses: ./.github/workflows/slab_teardown.yml
+    with:
+      runner-name: ${{ needs.setup-instance.outputs.runner-name }}
+      notification-context: regression-benchmarks
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
+      SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
+      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}
+      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**File**: `.github/workflows/benchmark_tfhe_fft.yml` (modified, +24/-38)
```diff
@@ -21,8 +21,7 @@ on:
       - .github/workflows/benchmark_tfhe_fft.yml
   schedule:
     # Job will be triggered each Thursday at 11p.m.
-    - cron: '0 23 * * 4'
-
+    - cron: "0 23 * * 4"
 
 permissions: {}
 
@@ -34,20 +33,14 @@ jobs:
     if:
       (github.event_name != 'workflow_dispatch' && github.repository == 'zama-ai/tfhe-rs') ||
       github.event_name == 'workflow_dispatch'
-    runs-on: ubuntu-latest
-    outputs:
-      runner-name: ${{ steps.start-instance.outputs.label }}
-    steps:
-      - name: Start instance
-        id: start-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: start
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          backend: aws
-          profile: bench-hpc8
+    uses: ./.github/workflows/slab_setup.yml
+    with:
+      backend: aws
+      profile: bench-hpc8
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
 
   fft-benchmarks:
     name: benchmark_tfhe_fft/fft-benchmarks
@@ -61,7 +54,7 @@ jobs:
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
         with:
           fetch-depth: 0
-          persist-credentials: 'false'
+          persist-credentials: "false"
           token: ${{ secrets.REPO_CHECKOUT_TOKEN }}
 
       - name: Get benchmark details
@@ -108,7 +101,7 @@ jobs:
         with:
           repository: zama-ai/slab
           path: slab
-          persist-credentials: 'false'
+          persist-credentials: "false"
           token: ${{ secrets.REPO_CHECKOUT_TOKEN }}
 
       - name: Send data to Slab
@@ -130,23 +123,16 @@ jobs:
 
   teardown-instance:
     name: benchmark_tfhe_fft/teardown-instance
-    if: ${{ always() && needs.setup-instance.result != 'skipped' }}
-    needs: [ setup-instance, fft-benchmarks ]
-    runs-on: ubuntu-latest
-    steps:
-      - name: Stop instance
-        id: stop-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: stop
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          label: ${{ needs.setup-instance.outputs.runner-name }}
-
-      - name: Slack Notification
-        if: ${{ failure() }}
-        uses: rtCamp/action-slack-notify@33ca3be66c6f378fe1610fd1d5258632dbed5e58
-        env:
-          SLACK_COLOR: ${{ job.status }}
-          SLACK_MESSAGE: "Instance teardown (fft-benchmarks) finished with status: ${{ job.status }}. (${{ env.ACTION_RUN_URL }})"
+    if: ${{ always() && needs.setup-instance.outputs.runner-name != '' }}
+    needs: [setup-instance, fft-benchmarks]
+    uses: ./.github/workflows/slab_teardown.yml
+    with:
+      runner-name: ${{ needs.setup-instance.outputs.runner-name }}
+      notification-context: fft-benchmarks
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
+      SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
+      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}
+      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

**File**: `.github/workflows/benchmark_tfhe_ntt.yml` (modified, +22/-36)
```diff
@@ -23,7 +23,6 @@ on:
     # Job will be triggered each Friday at 11p.m.
     - cron: "0 23 * * 5"
 
-
 permissions: {}
 
 # zizmor: ignore[concurrency-limits] concurrency is managed after instance setup to ensure safe provisioning
@@ -34,20 +33,14 @@ jobs:
     if:
       (github.event_name != 'workflow_dispatch' && github.repository == 'zama-ai/tfhe-rs') ||
       github.event_name == 'workflow_dispatch'
-    runs-on: ubuntu-latest
-    outputs:
-      runner-name: ${{ steps.start-instance.outputs.label }}
-    steps:
-      - name: Start instance
-        id: start-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: start
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          backend: aws
-          profile: bench-hpc8
+    uses: ./.github/workflows/slab_setup.yml
+    with:
+      backend: aws
+      profile: bench-hpc8
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
 
   ntt-benchmarks:
     name: benchmark_tfhe_ntt/ntt-benchmarks
@@ -61,7 +54,7 @@ jobs:
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
         with:
           fetch-depth: 0
-          persist-credentials: 'false'
+          persist-credentials: "false"
           token: ${{ secrets.REPO_CHECKOUT_TOKEN }}
 
       - name: Get benchmark details
@@ -108,7 +101,7 @@ jobs:
         with:
           repository: zama-ai/slab
           path: slab
-          persist-credentials: 'false'
+          persist-credentials: "false"
           token: ${{ secrets.REPO_CHECKOUT_TOKEN }}
 
       - name: Send data to Slab
@@ -130,23 +123,16 @@ jobs:
 
   teardown-instance:
     name: benchmark_tfhe_ntt/teardown-instance
-    if: ${{ always() && needs.setup-instance.result != 'skipped' }}
+    if: ${{ always() && needs.setup-instance.outputs.runner-name != '' }}
     needs: [setup-instance, ntt-benchmarks]
-    runs-on: ubuntu-latest
-    steps:
-      - name: Stop instance
-        id: stop-instance
-        uses: zama-ai/slab-github-runner@d4a5bb6e2a4b8aa19a10f596d7f142006a7e2c21 # v1.6.3
-        with:
-          mode: stop
-          github-token: ${{ secrets.SLAB_ACTION_TOKEN }}
-          slab-url: ${{ secrets.SLAB_BASE_URL }}
-          job-secret: ${{ secrets.JOB_SECRET }}
-          label: ${{ needs.setup-instance.outputs.runner-name }}
-
-      - name: Slack Notification
-        if: ${{ failure() }}
-        uses: rtCamp/action-slack-notify@33ca3be66c6f378fe1610fd1d5258632dbed5e58
-        env:
-          SLACK_COLOR: ${{ job.status }}
-          SLACK_MESSAGE: "EC2 teardown (ntt-benchmarks) finished with status: ${{ job.status }}. (${{ env.ACTION_RUN_URL }})"
+    uses: ./.github/workflows/slab_teardown.yml
+    with:
+      runner-name: ${{ needs.setup-instance.outputs.runner-name }}
+      notification-context: ntt-benchmarks
+    secrets:
+      SLAB_ACTION_TOKEN: ${{ secrets.SLAB_ACTION_TOKEN }}
+      SLAB_BASE_URL: ${{ secrets.SLAB_BASE_URL }}
+      JOB_SECRET: ${{ secrets.JOB_SECRET }}
+      SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
+      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}
+      SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
```

---

### Incident Patch 5: `bb459398` (2026-09-28)
**Commit Message**: chore(ci): fix workflow

**File**: `Makefile` (modified, +2/-8)
```diff
@@ -2628,17 +2628,11 @@ endif
 	--features=integer,gpu,internal-keycache,pbs-stats -p tfhe-benchmark --profile release_lto_off -- '::no_cmux::'
 
 	# ZK
-	# Proof is done on CPU node of the instance
+	# Proof and verify are done on GPUs (gpu-zk enables the GPU prover and verifier)
 	RUSTFLAGS="$(RUSTFLAGS)" __TFHE_RS_PARAM_TYPE=$(BENCH_PARAM_TYPE) __TFHE_RS_BENCH_TYPE=$(BENCH_TYPE) __TFHE_RS_BENCH_OP_FLAVOR=fast_default __TFHE_RS_BENCH_BIT_SIZES_SET=fast \
 	cargo $(CARGO_RS_CHECK_TOOLCHAIN) bench \
 	--bench integer-zk-pke \
-	--features=integer,internal-keycache,zk-pok,pbs-stats \
-	-p tfhe-benchmark -- 'tfhe::integer::zk::proof'
-	# Verify is done on GPUs
-	RUSTFLAGS="$(RUSTFLAGS)" __TFHE_RS_PARAM_TYPE=$(BENCH_PARAM_TYPE) __TFHE_RS_BENCH_TYPE=$(BENCH_TYPE) __TFHE_RS_BENCH_OP_FLAVOR=fast_default __TFHE_RS_BENCH_BIT_SIZES_SET=fast \
-	cargo $(CARGO_RS_CHECK_TOOLCHAIN) bench \
-	--bench integer-zk-pke \
-	--features=integer,internal-keycache,gpu,pbs-stats,zk-pok -p tfhe-benchmark --
+	--features=integer,internal-keycache,gpu,gpu-zk,pbs-stats,zk-pok -p tfhe-benchmark --
 
 	# Compression
 	RUSTFLAGS="$(RUSTFLAGS)" __TFHE_RS_PARAM_TYPE=$(BENCH_PARAM_TYPE) __TFHE_RS_BENCH_TYPE=$(BENCH_TYPE) __TFHE_RS_BENCH_BIT_SIZES_SET=FAST \
```

**File**: `ci/parse_summary_benches_to_csv.py` (modified, +13/-1)
```diff
@@ -72,6 +72,18 @@ def label(point):
     return label
 
 
+def _zk_proof(point):
+    if "::zk::proof::" not in point["id"]:
+        return False
+    # The zk-pke bench binary has two prover ids: the GPU prover
+    # (`tfhe::integer::zk::proof::cuda::<params>`) and the CPU prover
+    # (`tfhe::integer::zk::proof::<params>`). A GPU summary must only report
+    # the GPU prover.
+    if point["backend"] == "cuda":
+        return "::zk::proof::cuda::" in point["id"]
+    return True
+
+
 RULES = [
     ("Add", lambda p: _unsigned64_ct(p, "::add")),
     ("Mul", lambda p: _unsigned64_ct(p, "::mul")),
@@ -92,7 +104,7 @@ def label(point):
         "Decompress",
         lambda p: "packing_compression" in p["id"] and "unpack_u64" in p["id"],
     ),
-    ("ZKPoK Proof (server)", lambda p: "::zk::proof::" in p["id"]),
+    ("ZKPoK Proof (server)", _zk_proof),
     (
         "ZKPoK Proof (verification)",
         lambda p: "::zk::verify_and_expand::" in p["id"],
```

**File**: `tfhe-benchmark/benches/integer/zk_pke.rs` (modified, +90/-101)
```diff
@@ -554,12 +554,12 @@ mod cuda {
             ShortintKeySwitchingParameters,
             tfhe::shortint::AtomicPatternParameters,
         ) = match get_param_type() {
-            ParamType::Classical => (
+            ParamType::Classical | ParamType::ClassicalDocumentation => (
                 PARAM_PKE_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
                 PARAM_KEYSWITCH_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
                 BENCH_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128.into(),
             ),
-            _ => (
+            ParamType::MultiBit | ParamType::MultiBitDocumentation => (
                 PARAM_PKE_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
                 PARAM_GPU_MULTI_BIT_GROUP_4_KEYSWITCH_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
                 BENCH_PARAM_GPU_MULTI_BIT_GROUP_4_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128.into(),
@@ -874,120 +874,109 @@ mod cuda {
             .sample_size(15)
             .measurement_time(std::time::Duration::from_secs(60));
 
-        let params: [(
-            CompactPublicKeyEncryptionParameters,
-            ShortintKeySwitchingParameters,
-            PBSParameters,
-        ); 2] = [
-            (
-                PARAM_PKE_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
-                PARAM_GPU_MULTI_BIT_GROUP_4_KEYSWITCH_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
-                PARAM_GPU_MULTI_BIT_GROUP_4_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128.into(),
-            ),
-            (
-                BENCH_PARAM_PKE_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
-                BENCH_PARAM_KEYSWITCH_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
-                BENCH_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128.into(),
-            ),
-        ];
+        let (param_pke, param_fhe): (CompactPublicKeyEncryptionParameters, PBSParameters) =
+            match get_param_type() {
+                ParamType::Classical | ParamType::ClassicalDocumentation => (
+                    BENCH_PARAM_PKE_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
+                    BENCH_PARAM_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128.into(),
+                ),
+                ParamType::MultiBit | ParamType::MultiBitDocumentation => (
+                    PARAM_PKE_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128,
+                    PARAM_GPU_MULTI_BIT_GROUP_4_MESSAGE_2_CARRY_2_KS_PBS_TUNIFORM_2M128.into(),
+                ),
+            };
 
-        for (param_pke, _param_ksk, param_fhe) in params.iter() {
-            let param_name = param_fhe.name();
-            let param_name = param_name.as_str();
-            let compact_private_key = CompactPrivateKey::new(*param_pke);
-            let pk = CompactPublicKey::new(&compact_private_key);
+        let param_name = param_fhe.name();
+        let param_name = param_name.as_str();
+        let compact_private_key = CompactPrivateKey::new(param_pke);
+        let pk = CompactPublicKey::new(&compact_private_key);
 
-            // We have a use case with 320 bits of metadata
-            let mut metadata = [0u8; (320 / u8::BITS) as usize];
-            let mut rng = rand::thread_rng();
-            metadata.fill_with(|| rng.gen());
-
-            let scheme = zk_scheme(*param_pke);
-
-            for proof_config in default_proof_config().iter() {
-                let msg_bits =
-                    (param_pke.message_modulus.0 * param_pke.carry_modulus.0).ilog2() as usize;
-                println!("Generating CRS... ");
-                let crs_size = proof_config.crs_size;
-                let crs = CompactPkeCrs::from_shortint_params(
-                    *param_pke,
-                    LweCiphertextCount(crs_size / msg_bits),
-                )
-                .unwrap();
-
-                for bits in proof_config.bits_to_prove.iter() {
-                    assert_eq!(bits % 64, 0);
-                    // Packing, so we take the message and carry modulus to compute our block count
-                    let num_block = 64usize.div_ceil(msg_bits);
-
-                    let fhe_uint_count = bits / 64;
-
-                    for compute_load in compute_load_config() {
-                        let spec = zk_spec(
-                            ZkPkeBench::Proof,
-                            param_name,
-                            proven_list_tag(*bits, crs_size, compute_load, scheme),
-                            get_bench_type(),
-                        );
-                        let bench_id = spec.to_string();
+        // We have a use case with 320 bits of metadata
+        let mut metadata = [0u8; (320 / u8::BITS) as usize];
+        let mut rng = rand::thread_rng();
+        metadata.fill_with(|| rng.gen());
 
-                        match get_bench_type() {
-                            BenchmarkType::Latency => {
-                                bench_group.bench_function(&bench_id, |b| {
-                                    let input_msg = rng.gen::<u64>();
-                                    let messages = vec![inp
```

---

### Incident Patch 6: `1d95abc1` (2026-09-30)
**Commit Message**: chore(deps-dev): bump brace-expansion in /tfhe/web_wasm_parallel_tests

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.16 to 1.1.21.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.16...v1.1.21)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.21
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `tfhe/web_wasm_parallel_tests/package-lock.json` (modified, +3/-8)
```diff
@@ -360,7 +360,6 @@
       "integrity": "sha512-NZyJarBfL7nWwIq+FDL6Zp/yHEhePMNnnJ0y3qfieCrmNvYct8uvtiV41UvlSe6apAfk0fY1FbWx+NwfmpvtTg==",
       "dev": true,
       "license": "MIT",
-      "peer": true,
       "bin": {
         "acorn": "bin/acorn"
       },
@@ -387,7 +386,6 @@
       "integrity": "sha512-PlXPeEWMXMZ7sPYOHqmDyCJzcfNrUr3fGNKtezX14ykXOEIvyK81d+qydx89KY5O71FKMPaQ2vBfBFI5NHR63A==",
       "dev": true,
       "license": "MIT",
-      "peer": true,
       "dependencies": {
         "fast-deep-equal": "^3.1.3",
         "fast-uri": "^3.0.1",
@@ -583,9 +581,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.16",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
-      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -613,7 +611,6 @@
         }
       ],
       "license": "MIT",
-      "peer": true,
       "dependencies": {
         "baseline-browser-mapping": "^2.11.12",
         "caniuse-lite": "^1.0.30001809",
@@ -2250,7 +2247,6 @@
       "integrity": "sha512-gX/dMkRQc7QOMzgTe6KsYFM7DxeIONQSui1s0n/0xht36HvrgbxtM1xBlgx596NbpHuQU8P7QpKwrZYwUX48nw==",
       "dev": true,
       "license": "MIT",
-      "peer": true,
       "dependencies": {
         "@types/eslint-scope": "^3.7.7",
         "@types/estree": "^1.0.8",
@@ -2300,7 +2296,6 @@
       "integrity": "sha512-pIDJHIEI9LR0yxHXQ+Qh95k2EvXpWzZ5l+d+jIo+RdSm9MiHfzazIxwwni/p7+x4eJZuvG1AJwgC4TNQ7NRgsg==",
       "dev": true,
       "license": "MIT",
-      "peer": true,
       "dependencies": {
         "@discoveryjs/json-ext": "^0.5.0",
         "@webpack-cli/configtest": "^2.1.1",
```

---

### Incident Patch 7: `446305f7` (2026-09-30)
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

### Incident Patch 8: `26808e3b` (2026-09-29)
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

### Incident Patch 9: `83b7f451` (2026-09-25)
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
         return analysis.Instruction(self.opcode, self.data.args())
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

### Incident Patch 10: `cdf28659` (2026-09-23)
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
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 138, 130, 1, 192, 232, 146, 128, 41, 0,
-            0, 0, 124, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 129, 20,
-            244, 146, 128, 41, 0, 0, 0, 124, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
-            0, 0, 11, 24, 0, 128, 0, 147, 128, 41, 0, 0, 0, 124, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 128, 12, 147, 128, 41, 0, 0, 0, 124, 0, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 132, 1, 192, 24, 147, 128, 41, 0,
-            0, 0, 124, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 68, 1, 192,
-            36, 147, 128, 41, 0, 0, 0, 124, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
-            0, 0, 141, 5, 131, 20, 48, 147, 128, 41, 0, 0, 0, 124, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 145, 70, 1, 192, 60, 147, 128, 41, 0, 0, 0, 124, 1, 0, 0, 0,
-            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 146, 134, 1, 192, 72, 147, 128, 41, 0,
-
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

### Incident Patch 11: `b8d574c5` (2026-09-16)
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
+                    let (srcs_clear, srcs_enc): (Vec<_>, Vec<_>) = signature
+                        .get_args()
                         .iter()
+                        .filter_map(|ty| match ty {
+                            zhc::builder::Type::Ciphertext(spec) => Some(spec),
+                            zhc::builder::Type::Plaintext(_) => None,
+                        })
                         .enumerate()
-                        .map(|(pos, mode)| {
-                            let (bw, block) = match mode {
-                                hpu_asm::VarMode::Native => (*width, num_block),
-                                hpu_asm::VarMode::Half => (width / 2, num_block / 2),
-                                hpu_asm::VarMode::Bool => (1, 1),
-                            };
+                        .map(|(pos, spec)| {
+                            let bw = spec.int_size() as usize;
+                            let block = bw / hpu_device.params().pbs_params.message_width;
 
                
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
                         fw_entry.iop(),
                         &srcs_enc,
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

**File**: `tfhe/src/core_crypto/hpu/mod.rs` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
 pub mod algorithms;
 pub mod entities;
 pub use entities::*;
+// Expose function used for glwe_lookuptable generation.
+// This function should be easily accessed synced it's required for hpu device instantiation
+pub use entities::glwe_lookuptable::create_hpu_lookuptable;
```

**File**: `tfhe/src/high_level_api/integers/unsigned/tests/hpu.rs` (modified, +6/-2)
```diff
@@ -4,8 +4,12 @@ use tfhe_hpu_backend::prelude::HpuDevice;
 use crate::{set_server_key, ClientKey, CompressedServerKey, Config};
 
 fn setup_hpu(hpu_device_cfg_path: &str) -> ClientKey {
-    let hpu_device =
-        HpuDevice::from_config(hpu_device_cfg_path, false).expect("Hpu device init failed");
+    let hpu_device = HpuDevice::from_config(
+        hpu_device_cfg_path,
+        false,
+        &crate::core_crypto::hpu::create_hpu_lookuptable,
+    )
+    .expect("Hpu device init failed");
 
     let config = Config::from_hpu_device(&hpu_device);
 
```

**File**: `tfhe/src/integer/keycache.rs` (modified, +6/-2)
```diff
@@ -65,8 +65,12 @@ impl IntegerKeyCache {
                 let config_file = ShellString::new(
                     "${HPU_BACKEND_DIR}/config_store/${HPU_CONFIG}/hpu_config.toml".to_string(),
                 );
-                HpuDevice::from_config(&config_file.expand(), false)
-                    .expect("HpuDevice failed to open with required configuration")
+                HpuDevice::from_config(
+                    &config_file.expand(),
+                    false,
+                    &crate::core_crypto::hpu::create_hpu_lookuptable,
+                )
+                .expect("HpuDevice failed to open with required configuration")
             };
             // Check compatibility with key
             let hpu_pbs_params =
```

---

### Incident Patch 12: `b2fb006c` (2026-09-23)
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
+                self.info.len()
+            ));
+        }
         let helper =
             IntegerUnpackingToShortintCastingModeHelper::from_expansion_mode(expansion_mode);
-        let functions = helper.generate_expand_functions(&self.info, self.is_packed())?;
+        let functions =
+            helper.generate_expand_functions(&self.info, self.is_packed(), self.ct_list.len())?;
 
         let casted_blocks = match expansion_mode {
             IntegerCompactCiphertextListExpansionMode::CastAndUnpackIfNecessary(
@@ -860,6 +888,13 @@ impl CompactCiphertextList {
         if self.is_empty() {
             return Ok(CompactCiphertextListExpander::new(vec![], vec![]));
         }
+        if self.ct_list.is_empty() {
+            return Err(crate::error!(
+                "Invalid compact ciphertext list: it holds no ciphertext but its metadata \
+                describes {} items",
+                self.info.len()
+            ));
+        }
         if self.is_packed() {
          
```

---

### Incident Patch 13: `ea588dfd` (2026-09-25)
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

### Incident Patch 14: `5204d866` (2026-09-20)
**Commit Message**: chore(deps): update dtolnay/rust-toolchain requirement to 02cb101ec7c40f2c49e1d9714d64511d8e1b74de

Updates the requirements on [dtolnay/rust-toolchain](https://github.com/dtolnay/rust-toolchain) to permit the latest version.
- [Release notes](https://github.com/dtolnay/rust-toolchain/releases)
- [Commits](https://github.com/dtolnay/rust-toolchain/commits/02cb101ec7c40f2c49e1d9714d64511d8e1b74de)

---
updated-dependencies:
- dependency-name: dtolnay/rust-toolchain
  dependency-version: 02cb101ec7c40f2c49e1d9714d64511d8e1b74de
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/aws_data_tests.yml` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ jobs:
           git config --local --unset-all http.https://github.com/.extraheader || rm "${RUNNER_TEMP}"/git-credentials-*.config
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_fast_tests.yml` (modified, +1/-1)
```diff
@@ -161,7 +161,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_integer_tests.yml` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_noise_checks.yml` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_signed_integer_tests.yml` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_tests.yml` (modified, +1/-1)
```diff
@@ -166,7 +166,7 @@ jobs:
           token: ${{ env.CHECKOUT_TOKEN }}
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/aws_tfhe_wasm_tests.yml` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ jobs:
           git config --global --add url."https://github.com/".insteadOf "git@github.com:"
 
       - name: Install latest stable
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: stable
 
```

**File**: `.github/workflows/benchmark_cpu_common.yml` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ jobs:
           SHA: ${{ github.sha }}
 
       - name: Install rust
-        uses: dtolnay/rust-toolchain@6c977a6ca4077a0ceb28ffbe03f59d46e9ac8772 # zizmor: ignore[stale-action-refs] this action doesn't create releases
+        uses: dtolnay/rust-toolchain@02cb101ec7c40f2c49e1d9714d64511d8e1b74de # zizmor: ignore[stale-action-refs] this action doesn't create releases
         with:
           toolchain: nightly
 
```

---

### Incident Patch 15: `b10b64f3` (2026-09-23)
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

#### Recent Merged Pull Requests:
- **PR #4026** (2026-10-05): fix(hpu): Resolve erc7984 throughput issue in hlapi hpu benchmark (@Bapt-Roux)
- **PR #4025** (2026-10-05): refactor(integer): remove smart_ops used in tests and examples (@tmontaigu)
- **PR #4023** (2026-10-05): chore(deps): bump strum_macros from 0.26.4 to 0.28.0 (@dependabot[bot])
- **PR #4021** (2026-10-05): chore(deps): bump marocchino/sticky-pull-request-comment from 3.0.4 to 3.0.5 in /.github/actions/sticky_report (@dependabot[bot])
- **PR #4020** (2026-10-05): chore(deps): update dtolnay/rust-toolchain requirement to 7e38f4b43b4db5c8dd498af069a4f6196df1d067 (@dependabot[bot])
- **PR #4019** (2026-10-02): chore(ci): update dependabot.yaml to be able to update actions files (@SouchonTheo)
- **PR #4015** (2026-10-02): chore(deps): update strum deps (@SouchonTheo)
- **PR #4013** (2026-10-01): chore: compactPublicKeyBench32/256BitSmall have been removed (@IceTDrinker)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
