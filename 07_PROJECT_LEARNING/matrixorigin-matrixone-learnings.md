# Forensic Learning Record (Deep Inspection): matrixorigin/matrixone

> **Canonical Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:10.734Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matrixorigin/matrixone`
- **Description**: AI-native HTAP database with Git-for-Data and built-in vector search, serving as the data and memory backbone for intelligent agents and applications.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2025 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cgo/arith.c`
```
/* 
 * Copyright 2021 Matrix Origin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "mo_impl.h"

/* 
 * Signed int add with overflow check.
 *
 * The test checks if rt[i] and tmpx have different sign, and rt[i]
 * and tmpy have different sign, therefore, tmpx and tmpy have same 
 * sign but the result has different sign, therefore, it is an overflow.
 *
 * DO NOT use __builtin_add_overflow, which gcc cannot vectorize with SIMD
 * and is actually much much slower.
 */
#define ADD_SIGNED_OVFLAG(TGT, A, B)                 \
    TGT = (A) + (B);                                 \
    opflag |= ((TGT) ^ (A)) & ((TGT) ^ (B))

#define ADD_SIGNED_OVFLAG_CHECK                      \
    if (opflag < 0)    {                             \
        return RC_OUT_OF_RANGE;                      \
    } else return RC_SUCCESS


/*
 * Unsigned int add with overflow check
 *
 * If result is less, we know it wrapped around.
 */
#define ADD_UNSIGNED_OVFLAG(TGT, A, B)              \
    TGT = (A) + (B);                                \
    if ((TGT) < (A)) {                              \
        opflag = 1;                                 \
    } else (void) 0

#define ADD_UNSIGNED_OVFLAG_CHECK                   \
    if (opflag != 0) {                              \
        return RC_OUT_OF_RANGE;                     \
    } else return RC_SUCCESS

/*
 * Float/Double overflow check.
 *
 * At this moment we don't do anything.
 */
#define ADD_FLOAT_OVFLAG(TGT, A, B)                 \
    TGT = (A) + (B)    

#define ADD_FLOAT_OVFLAG_CHECK                      \
    (void) opflag;                                  \
    return RC_SUCCESS

/*
 * Signed int sub with overflow check.
 */
#define SUB_SIGNED_OVFLAG(TGT, A, B)                 \
    TGT = (A) - (B);                                 \
    opflag |= ((A) ^ (B)) & ((TGT) ^ (A))

#define SUB_SIGNED_OVFLAG_CHECK                      \
    if (opflag < 0)    {                             \
        return RC_OUT_OF_RANGE;                      \
    }else return RC_SUCCESS


/*
 * Unsigned int sub with overflow check
 *
 * If A is less than B,, we know it wrapped around.
 */
#define SUB_UNSIGNED_OVFLAG(TGT, A, B)              \
    TGT = (A) - (B);                                \
    if ((A) < (B)) {                                \
        opflag = 1;                                 \
    } else (void) 0

#define SUB_UNSIGNED_OVFLAG_CHECK                   \
    if (opflag != 0) {                              \
        return RC_OUT_OF_RANGE;                     \
    } else return RC_SUCCESS


/*
 * Float/Double overflow check.
 *
 * At this moment we don't do anything.
 */
#define SUB_FLOAT_OVFLAG(TGT, A, B)                 \
    TGT = (A) - (B)

#define SUB_FLOAT_OVFLAG_CHECK                      \
    (void) opflag;                                  \
    return RC_SUCCESS

/*
 * Signed int mul with overflow check.
 */
#define MUL_SIGNED_OVFLAG(TGT, A, B, MAXVAL, MINVAL, ZT ,UPTYPE)               \
    temp = (UPTYPE)(A) * (UPTYPE)(B);                                          \
    TGT = (ZT)temp;                                                            \
    opflag = ((A ^ B) > 0 && temp > MAXVAL) || ((A ^ B) < 0 && temp < MINVAL)

#define MUL_SIGNED_OVFLAG_CHECK                                                \
    if (opflag != 0)    {                                                      \
        return RC_OUT_OF_RANGE;                                                \
    }else return RC_SUCCESS


/*
 * Unsigned int mul with overflow check
 */
#define MUL_UNSIGNED_OVFLAG(TGT, A, B, MAXVAL, MINVAL, ZT, UPTYPE)             \
    temp = (UPTYPE)(A) * (UPTYPE)(B);                                          \
    TGT = (ZT)temp;                                                            \
    opflag = (temp > MAXVAL)

#define MUL_UNSIGNED_OVFLAG_CHECK                                              \
    if (opflag != 0) {                                                         \
        return RC_OUT_OF_RANGE;                                                \
    } else return RC_SUCCESS


/*
 * Float/Double mul overflow check.
 *
 * At this moment we don't do anything.
 */
#define MUL_FLOAT_OVFLAG(TGT, A, B)                 \
    TGT = (A) * (B)

#define MUL_FLOAT_OVFLAG_CHECK                      \
    (void) opflag;                                  \
    return RC_SUCCESS


/*
 * Float/Double div overflow check.
 *
 * At this moment we don't do anything.
 */
#define DIV_FLOAT_OVFLAG(TGT, A, B)                 \
    if ((B) == 0) {                                 \
        opflag = 1;                                 \
    } else TGT = (A) / (B)

#define DIV_FLOAT_OVFLAG_CHECK                      \
    if (opflag == 1) {                              \
        return RC_DIVISION_BY_ZERO;                 \
    } else return RC_SUCCESS

/*
 * Signed int mod with overflow check.
 */
#define MOD_SIGNED_OVFLAG(TGT, A, B)                \
    if ((B) == 0) {                                 \
        opflag = 1;                                 \
    } else TGT = (A) % (B)


#define MOD_SIGNED_OVFLAG_CHECK                     \
    if (opflag == 1) {                              \
        return RC_DIVISION_BY_ZERO;                 \
    } else return RC_SUCCESS


/*
 * Unsigned int mod with overflow check
 */
#define MOD_UNSIGNED_OVFLAG(TGT, A, B)              \
    if ((B) == 0) {                                 \
        opflag = 1;                                 \
    } else TGT = (A) % (B)

#define MOD_UNSIGNED_OVFLAG_CHECK                   \
    if (opflag == 1) {                              \
        return RC_DIVISION_BY_ZERO;                 \
    } else return RC_SUCCESS


/*
 * Float mod overflow check.
 */
#define MOD_FLOAT_OVFLAG(TGT, A, B)                 \
    if ((B) == 0) {                                 \
        opflag = 1;                                 \
    } else TGT = fmodf((A), (B))

#define MOD_FLOAT_OVFLAG_CHECK                      \
    if (opflag == 1) {                              \
        return RC_DIVISION_BY_ZERO;                 \
    } else return RC_SUCCESS


/*
 * Double mod overflow check.
 */
#define MOD_DOUBLE_OVFLAG(TGT, A, B)                \
    if ((B) == 0) {                                 \
        opflag = 1;                                 \
    } else TGT = fmod((A), (B))

#define MOD_DOUBLE_OVFLAG_CHECK                     \
    if (opflag == 1) {                              \
        return RC_DIVISION_BY_ZERO;                 \
    } else return RC_SUCCESS

// MO_ARITH_T: Handle general arithmetic operations
#define MO_ARITH_T(OP, ZT)                                    \
    ZT *rt = (ZT *) r;                                        \
    ZT *at = (ZT *) a;                                        \
    ZT *bt = (ZT *) b;                                        \
    ZT opflag = 0;                                            \
    if ((flag & LEFT_IS_SCALAR) != 0) {                       \
        if (nulls != NULL) {                                  \
            for (uint64_t i = 0; i < n; i++) {                \
                if (!bitmap_test(nulls, i)) {                 \
                    OP(rt[i], at[0], bt[i]);                  \
                }                                             \
            }                                                 \
        } else {                                              \
            for (uint64_t i =
```

### Core Architecture Module: `cgo/bitmap.h`
```
/* 
 * Copyright 2021 Matrix Origin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef _BITMAP_H_
#define _BITMAP_H_

#include <string.h>

/*
 * Null bitmap operations.    Bitmap is an array of unit64_t and nbits of bits, nbits > 0.
 * Each of the nbits is a bit from position pos 0 to pos nbits - 1
 *
 * MUST MATCH GO IMPLEMENTATION.
 */

/* bitmap in number of bytes. */
static inline uint64_t bitmap_nbyte(uint64_t nbits) {
    return (nbits + 7) >> 3; 
}
/* return number of uint64 that can holds nbits */
static inline uint64_t bitmap_size(uint64_t nbits) {
    return (nbits + 63) >> 6;
}
/* return index into array of the bit position */
static inline uint64_t bitmap_pos2idx(uint64_t pos) {
    return pos >> 6;
}
/* return mask of the bit position */
static inline uint64_t bitmap_pos2mask(uint64_t pos) {
    uint64_t mask = 1;
    return mask << (pos & 63);
}

static inline bool bitmap_test(uint64_t *p, uint64_t pos) {
    if (p == NULL) {
        return false;
    }
    return (p[bitmap_pos2idx(pos)] & bitmap_pos2mask(pos)) != 0;
}

/* len - number of uint64 that holds nbits */
static inline bool bitmap_test_with_len(uint64_t *p, uint64_t len, uint64_t pos) {
    if (p == NULL) {
        return false;
    }
    uint64_t idx = bitmap_pos2idx(pos);
    if (idx >= len) {
        return false;
    }
    return (p[bitmap_pos2idx(pos)] & bitmap_pos2mask(pos)) != 0;
}

static inline void bitmap_set(uint64_t *p, uint64_t pos) {
    p[bitmap_pos2idx(pos)] |= bitmap_pos2mask(pos);
}

static inline void bitmap_set_atomic(uint64_t *p, uint64_t pos) {
    __sync_or_and_fetch(&p[bitmap_pos2idx(pos)], bitmap_pos2mask(pos));
}

static inline void bitmap_clear(uint64_t *p, uint64_t pos) {
    p[bitmap_pos2idx(pos)] &= ~bitmap_pos2mask(pos);
}

static inline void bitmap_zeros(uint64_t *p, uint64_t nbits) {
    memset(p, 0, bitmap_nbyte(nbits));
}

static inline void bitmap_ones(uint64_t *p, uint64_t nbits) {
    memset(p, 0xFF, bitmap_nbyte(nbits));
}

static inline void bitmap_copy(uint64_t *dst, uint64_t *src, uint64_t nbits) {
    memcpy(dst, src, bitmap_nbyte(nbits));
}

static inline void bitmap_and(uint64_t *dst, uint64_t *a, uint64_t *b, uint64_t nbits) {
    uint64_t sz = bitmap_size(nbits);
    for (uint64_t i = 0; i < sz; ++i) {
        dst[i] = a[i] & b[i];
    }
}
static inline void bitmap_or(uint64_t *dst, uint64_t *a, uint64_t *b, uint64_t nbits) {
    uint64_t sz = bitmap_size(nbits);
    for (uint64_t i = 0; i < sz; ++i) {
        dst[i] = a[i] | b[i];
    }
}

static inline void bitmap_not(uint64_t *dst, uint64_t *a, uint64_t nbits) {
    uint64_t sz = bitmap_size(nbits);
    for (uint64_t i = 0; i < sz; ++i) {
        dst[i] = ~a[i]; 
    }
}

static inline uint64_t bitmap_lastmask(uint64_t nbits) {
    uint64_t mask = bitmap_pos2mask(nbits - 1);
    /* 
     * For nbits = 0, 64, ...   mask will be 1 << 63. 
     * the following overflowed expression is the correct answer.
     */ 
    return (mask << 1) - 1;
}

static inline uint64_t bitmap_count(uint64_t *p, uint64_t nbits) {
    if (nbits == 0) {
        return 0;
    } else {
        uint64_t sz = bitmap_size(nbits);
        uint64_t mask = bitmap_lastmask(nbits);
        uint64_t cnt = __builtin_popcountll(p[sz - 1] & mask);
        for (uint64_t i = 0; (i + 1) < sz; ++i) {
            cnt += __builtin_popcountll(p[i]);
        }
        return cnt;
    }
}

static inline bool bitmap_empty(uint64_t *p, uint64_t nbits) {
    if (nbits == 0) {
        return true;
    } else {
        uint64_t sz = bitmap_size(nbits);
        uint64_t mask = bitmap_lastmask(nbits);
        if ((p[sz-1] & mask) != 0) {
            return false;
        }
        for (uint64_t i = 0; (i + 1) < sz; ++i) {
            if (p[i] != 0) {
                return false;
            }
        }
        return true;
    }
}

#endif /* _BITMAP_H_ */

```

### Core Architecture Module: `cgo/bloom.c`
```
/* 
 * Copyright 2021 Matrix Origin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "bloom.h"
#include "bitmap.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#define XXH_INLINE_ALL
#include "xxhash.h"

typedef struct {
    uint64_t h1;
    uint64_t h2;
} bloom_hash_t;

#include "varlena.h"

static inline bloom_hash_t bloom_calculate_hash64(uint64_t key, uint64_t seed) {
    bloom_hash_t h;
    XXH128_hash_t xh1 = XXH3_128bits_withSeed(&key, sizeof(uint64_t), seed);
    h.h1 = xh1.low64;
    h.h2 = xh1.high64;
    return h;
}

/*
 * Calculates a 128-bit hash (split into two 64-bit halves) for a given key and seed using XXH3.
 */
static inline bloom_hash_t bloom_calculate_hash(const void *key, size_t len, uint64_t seed) {

    // force cast byte, int16, int32 into int64 so that same value share the same hash value
    switch (len) {
        case 1: // int8
            return bloom_calculate_hash64((int64_t)(*(int8_t*)key), seed);
        case 2: // int16
            return bloom_calculate_hash64((int64_t)(*(int16_t*)key), seed);
        case 4: // int32
            return bloom_calculate_hash64((int64_t)(*(int32_t*)key), seed);
        case 8: // int64 / uint64 / double
            return bloom_calculate_hash64(*(uint64_t*)key, seed);
        default:
            {
                bloom_hash_t h;
                XXH128_hash_t xh1 = XXH3_128bits_withSeed(key, len, seed);
                h.h1 = xh1.low64;
                h.h2 = xh1.high64;
                return h;
            }
            break;
    }

}

/*
 * Calculates the bit position in the bloom filter for a given hash and iteration index.
 * Uses the double hashing technique: (h1 + i * h2) % nbits.
 */
static inline uint64_t bloom_calculate_pos(bloom_hash_t h, int i, uint64_t nbits) {
    return (h.h1 + (uint64_t)i * h.h2) & (nbits-1);
}

/*
 * Sets up the bloom filter structure with the given bit count and number of hash functions.
 */
static void bloomfilter_setup(bloomfilter_t *bf, uint64_t nbits, uint32_t k, uint64_t seed) {
    memcpy(bf->magic, BLOOM_MAGIC, 4);
    bf->nbits = nbits;
    bf->k = k;
    bf->seed = seed;
}

static uint64_t next_pow2_64(uint64_t v) {
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v |= v >> 32;
    return v + 1;
}

bloomfilter_t* bloomfilter_init(uint64_t nbits, uint32_t k) {
    uint64_t new_nbits = next_pow2_64(nbits);
    uint64_t nbytes = bitmap_nbyte(new_nbits);

    if (k > MAX_K_SEED) return NULL;

    bloomfilter_t *bf = (bloomfilter_t *)malloc(sizeof(bloomfilter_t) + nbytes);
    if (!bf) return NULL;

    memset(bf->bitmap, 0, nbytes);
    uint64_t seed = 0;
    for (int j = 0; j < 4; j++) {
        seed = (seed << 16) | (rand() & 0xFFFF);
    }
    bloomfilter_setup(bf, new_nbits, k, seed);
    return bf;
}

bloomfilter_t* bloomfilter_init_with_seed(uint64_t nbits, uint32_t k, uint64_t seed) {
    uint64_t new_nbits = next_pow2_64(nbits);
    uint64_t nbytes = bitmap_nbyte(new_nbits);

    if (k > MAX_K_SEED) return NULL;

    bloomfilter_t *bf = (bloomfilter_t *)malloc(sizeof(bloomfilter_t) + nbytes);
    if (!bf) return NULL;

    memset(bf->bitmap, 0, nbytes);
    bloomfilter_setup(bf, new_nbits, k, seed);
    return bf;
}

void bloomfilter_free(bloomfilter_t *bf) {
    if (bf) {
        free(bf);
    }
}

void bloomfilter_add(bloomfilter_t *bf, const void *key, size_t len) {
    if (bf->nbits == 0) return;

    uint64_t stack_pos[MAX_K_SEED];
    uint64_t *pos = stack_pos;

    bloom_hash_t h = bloom_calculate_hash(key, len, bf->seed);
    for (int i = 0; i < bf->k; i++) {
        pos[i] = bloom_calculate_pos(h, i, bf->nbits);
        bitmap_set((uint64_t *) bf->bitmap, pos[i]);
    }
}

void bloomfilter_add_fixed(bloomfilter_t *bf, const void *key, size_t len, size_t elemsz, size_t nitem, const void *nullmap, size_t nullmaplen) {
    char *k = (char *) key;
    for (int i = 0, j = 0; i < nitem && j < len; i++, j += elemsz, k += elemsz) {
        if (!nullmap || !bitmap_test((uint64_t *) nullmap, i)) {
            bloomfilter_add(bf, k, elemsz);
        }
    }
}

void bloomfilter_add_varlena_4b(bloomfilter_t *bf, const void *key, size_t len, size_t nitem, const void *nullmap, size_t nullmaplen) {
    char *k = (char *) key;
    char *start = k;

    for (int i = 0; i < nitem; i++) {
        if ((size_t)(k - start) + sizeof(uint32_t) > len) break;
        uint32_t elemsz = *((uint32_t*)k);
        k += sizeof(uint32_t);

        if ((size_t)(k - start) + elemsz > len) break;

        if (!nullmap || !bitmap_test((uint64_t *) nullmap, i)) {
             bloomfilter_add(bf, k, elemsz);
        }
        k += elemsz;
    }
}

bool bloomfilter_test(const bloomfilter_t *bf, const void *key, size_t len) {
    if (bf->nbits == 0) return false;

    uint64_t stack_pos[MAX_K_SEED];
    uint64_t *pos = stack_pos;

    bloom_hash_t h = bloom_calculate_hash(key, len, bf->seed);
    for (int i = 0; i < bf->k; i++) {
        pos[i] = bloom_calculate_pos(h, i, bf->nbits);
    }

    bool result = true;
    for (int i = 0; i < bf->k; i++) {
        if (!bitmap_test((uint64_t*)bf->bitmap, pos[i])) {
            result = false;
            break;
        }
    }

    return result;
}

void bloomfilter_test_fixed(const bloomfilter_t *bf, const void *key, size_t len, size_t elemsz, size_t nitem, const void *nullmap, size_t nullmaplen, void *result) {
    char *k = (char *) key;
    bool *br = (bool *) result;

    for (int i = 0, j = 0; i < nitem && j < len; i++, j += elemsz, k += elemsz) {
        if (nullmap && bitmap_test((uint64_t*)nullmap, i)) {
            // null
            br[i] = false;
        } else {
            br[i] = bloomfilter_test(bf, k, elemsz);
        }
    }
}

/*
 * key contain the lists of varlena items.
 * first 4 byte (uint32) contains the size of the content
 * and then follow with the content
 * format of the keys look likes [size0] [data with size0] [size1] [data with size1]...
 */
void bloomfilter_test_varlena_4b(const bloomfilter_t *bf, const void *key, size_t len, size_t nitem, const void *nullmap, size_t nullmaplen, void *result) {
    char *k = (char *) key;
    char *start = k;
    bool *br = (bool *) result;

    for (int i = 0; i < nitem; i++) {
        if ((size_t)(k - start) + sizeof(uint32_t) > len) break;
	    uint32_t elemsz = *((uint32_t*)k);
	    k += sizeof(uint32_t);
        
        if ((size_t)(k - start) + elemsz > len) break;

        if (nullmap && bitmap_test((uint64_t*)nullmap, i)) {
            // null
            br[i] = false;
        } else {
            br[i] = bloomfilter_test(bf, k, elemsz);
        }
        k += elemsz;
    }
}

bool bloomfilter_test_and_add(bloomfilter_t *bf, const void *key, size_t len) {
    if (bf->nbits == 0) return false;

    uint64_t stack_pos[MAX_K_SEED];
    uint64_t *pos = stack_pos;

    bloom_hash_t h = bloom_calculate_hash(key, len, bf->seed);
    for (int i = 0; i < bf->k; i++) {
        pos[i] = bloom_calculate_pos(h, i, bf->nbits);
    }

    bool all_set = true;
    for (int i = 0; i < bf->k; i++) {
        if (!bitmap_test((uint64_t*)bf->bitmap, pos[i])) {
            all_set = false;
            bitmap_set((uint64_t*)bf->bitmap, pos[i]);
        }
    }

    return all_set;
}

void bloomfilter_test_and_add_fixed(bloomfilter_t *bf, const void *key, size_t len, size_t elemsz, size_t nitem,  const void *nullmap, size_t nullmaplen, void *result) {
    char *k = (char *) key;
    bool *br =
```

### Core Architecture Module: `cgo/bloom.h`
```
/* 
 * Copyright 2021 Matrix Origin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef _BLOOM_H_
#define _BLOOM_H_

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#define BLOOM_MAGIC "XXBF"
#define MAX_K_SEED 64

/*
 * Bloom filter structure.
 * magic: magic number "XXBF"
 * nbits: total number of bits in the bitmap
 * seeds: seeds for 3 hash functions
 * bitmap: flexible array member for the bitmap data
 */

typedef struct {
    uint8_t magic[4];
    uint32_t k;
    uint64_t nbits;
    uint64_t seed;
    uint64_t bitmap[1];
} bloomfilter_t;

/*
 * Initializes a new bloom filter.
 * nbits: the number of bits in the bloom filter bitmap.
 * k: the number of hash functions to use.
 * Returns a pointer to the newly allocated bloomfilter_t, or NULL if it fails.
 */
bloomfilter_t* bloomfilter_init(uint64_t nbits, uint32_t k);

/*
 * Initializes a new bloom filter with a given seed.
 * nbits: the number of bits in the bloom filter bitmap.
 * k: the number of hash functions to use.
 * seed: the seed for hash functions.
 * Returns a pointer to the newly allocated bloomfilter_t, or NULL if it fails.
 */
bloomfilter_t* bloomfilter_init_with_seed(uint64_t nbits, uint32_t k, uint64_t seed);

/*
 * Frees the memory allocated for the bloom filter.
 */
void bloomfilter_free(bloomfilter_t *bf);

/*
 * Adds a single key of given length to the bloom filter.
 */
void bloomfilter_add(bloomfilter_t *bf, const void *key, size_t len);

/*
 * Adds multiple fixed-length keys to the bloom filter.
 * key: pointer to the start of keys.
 * len: total length of the key buffer.
 * elemsz: size of each element.
 * nitem: number of items to add.
 * nullmap: optional bitmap indicating which items are NULL.
 * nullmaplen: length of the nullmap.
 */
void bloomfilter_add_fixed(bloomfilter_t *bf, const void *key, size_t len, size_t elemsz, size_t nitem, const void *nullmap, size_t nullmaplen);

/*
 * Tests if a key might be in the bloom filter.
 * Returns true if the key is potentially in the filter, false if it is definitely not.
 */
bool bloomfilter_test(const bloomfilter_t *bf, const void *key, size_t len);

/*
 * Tests multiple fixed-length keys and stores boolean results in the result buffer.
 */
void bloomfilter_test_fixed(const bloomfilter_t *bf, const void *key, size_t len, size_t elemsz, size_t nitem, const void *nullmap, size_t nullmaplen, void *result);

/*
 * Tests multiple variable-length keys and stores boolean results in the result buffer.
 * Keys are expected to be prefixed with a 4-byte length.
 */
void bloomfilter_test_varlena_4b(const bloomfilter_t *bf, const void *key, size_t len, size_t nitem, const void *nullmap, size_t nullmaplen, void *result);

/*
 * Adds multiple variable-length keys to the bloom filter.
 * Keys are expected to be prefixed with a 4-byte length.
 */
void bloomfilter_add_varlena_4b(bloomfilter_t *bf, const void *key, size_t len, size_t nitem, const void *nullmap, size_t nullmaplen);

/*
 * Tests if a key is in the bloom filter and then adds it.
 * Returns true if the key was already potentially in the filter.
 */
bool bloomfilter_test_and_add(bloomfilter_t *bf, const void *key, size_t len);

/*
 * Tests and adds multiple fixed-length keys, storing results in the result buffer.
 */
void bloomfilter_test_and_add_fixed(bloomfilter_t *bf, const void *key, size_t len, size_t elemsz, size_t nitem, const void *nullmap, size_t nullmaplen,void *result);

/*
 * Tests and adds multiple variable-length keys, storing results in the result buffer.
 */
void bloomfilter_test_and_add_varlena_4b(bloomfilter_t *bf, const void *key, size_t len, size_t nitem, const void *nullmap, size_t nullmaplen,void *result);

/*
 * Returns a pointer to the raw bytes of the bloom filter for serialization.
 * len: will be set to the total length of the marshaled data.
 */
uint8_t* bloomfilter_marshal(const bloomfilter_t *bf, size_t *len);

/*
 * Returns a pointer to a bloom filter from a raw byte buffer.
 * No copy is performed.
 */
bloomfilter_t* bloomfilter_unmarshal(const uint8_t *buf, size_t len);

/*
 * Adds multiple variable-length keys to the bloom filter.
 * keys: pointer to the start of Varlena array.
 * area: pointer to the start of area buffer.
 */
void bloomfilter_add_varlena(bloomfilter_t *bf, const void *keys, size_t len, size_t elemsz, size_t nitem, const void *area, size_t area_len, const void *nullmap, size_t nullmaplen);

/*
 * Tests multiple variable-length keys and stores boolean results in the result buffer.
 * keys: pointer to the start of Varlena array.
 * area: pointer to the start of area buffer.
 */
void bloomfilter_test_varlena(const bloomfilter_t *bf, const void *keys, size_t len, size_t elemsz, size_t nitem, const void *area, size_t area_len, const void *nullmap, size_t nullmaplen, void *result);

/*
 * Tests and adds multiple variable-length keys, storing results in the result buffer.
 * keys: pointer to the start of Varlena array.
 * area: pointer to the start of area buffer.
 */
void bloomfilter_test_and_add_varlena(bloomfilter_t *bf, const void *keys, size_t len, size_t elemsz, size_t nitem, const void *area, size_t area_len, const void *nullmap, size_t nullmaplen, void *result);

/*
 * Merge two bloomfilter into dst. nbits, seed and k MUST be same
 */
int bloomfilter_or(bloomfilter_t *dst, const bloomfilter_t *a, const bloomfilter_t *b);

/*
 * Returns the number of bits in the bloom filter.
 */
static inline uint64_t bloomfilter_get_nbits(const bloomfilter_t *bf) {
    return bf->nbits;
}

/*
 * Returns the seed of the bloom filter.
 */
static inline uint64_t bloomfilter_get_seed(const bloomfilter_t *bf) {
    return bf->seed;
}

/*
 * Returns the number of hash functions used by the bloom filter.
 */
static inline uint32_t bloomfilter_get_k(const bloomfilter_t *bf) {
    return bf->k;
}

#endif /* _BLOOM_H_ */

```

### Core Architecture Module: `cgo/cbitmap.c`
```
// Copyright 2021 - 2022 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include "cbitmap.h"
#include "bitmap.h"
#include <stdlib.h>
#include <string.h>

// WARNING: HOST-ENDIAN serialization (deliberate, for speed). mo_cbitmap_serialize
// memcpy's the [base][nbits][raw words] payload in the machine's native byte
// order, so a payload is only valid when exchanged between same-endianness MO
// nodes. This differs from the CRoaring filter, which uses CRoaring's PORTABLE
// serialization. All current MO targets are little-endian; this assert turns a
// big-endian build into a loud compile error rather than letting it silently
// emit payloads other nodes would misread. If MO ever runs on a big-endian or
// mixed-endian deployment, port mo_cbitmap_serialize/deserialize to explicit
// little-endian (de)serialization first.
#if defined(__BYTE_ORDER__) && (__BYTE_ORDER__ != __ORDER_LITTLE_ENDIAN__)
#error "cbitmap serialization is host-endian and assumes little-endian; port to portable (de)serialization before building for a big-endian target"
#endif

// A dense bitset over [base, base+nbits). bit i represents value base+i, so the
// structure is sized to the value SPAN, not the max value. When the builder is
// told not to offset, base is 0 and bit i == value i (legacy layout). words
// holds bitmap_size(nbits) uint64s; NULL when nbits == 0 (matches nothing).
typedef struct {
  uint64_t base;
  uint64_t nbits;
  uint64_t *words;
} mo_cbitmap_t;

// Decode elemsz little-endian bytes (1/2/4/8) of a fixed integer into uint64 by
// zero-extension. MUST match mo_decode_uint in croaring.c and rawIntToUint64 in
// Go so the build and probe sides map a value to the same bit.
static inline uint64_t mo_cbm_decode(const unsigned char *p, size_t elemsz) {
  uint64_t x = 0;
  for (size_t b = 0; b < elemsz && b < 8; b++) {
    x |= ((uint64_t)p[b]) << (8 * b);
  }
  return x;
}

int mo_cbitmap_build_fixed(const void *key, size_t len, size_t elemsz,
                           size_t nitem, const void *nullmap,
                           size_t nullmaplen, uint64_t max_bits,
                           int use_offset, void **out) {
  (void)nullmaplen;
  if (!out) return MO_CBITMAP_INVALID_INPUT;
  *out = NULL;
  // A non-empty column must have a supported integer width; reject anything
  // else rather than silently mis-decoding it.
  if (nitem != 0 &&
      elemsz != 1 && elemsz != 2 && elemsz != 4 && elemsz != 8) {
    return MO_CBITMAP_INVALID_INPUT;
  }
  const unsigned char *p = (const unsigned char *)key;

  // Pass 1: find the min and max non-null value. With use_offset the bitset is
  // based at min, so its size is the value SPAN (max-min); otherwise base is 0
  // and it is sized by max (legacy layout).
  uint64_t minv = 0, maxv = 0;
  int any = 0;
  if (elemsz != 0) {
    for (size_t i = 0, j = 0; i < nitem && j < len; i++, j += elemsz) {
      if (nullmap && bitmap_test((uint64_t *)nullmap, i)) continue;
      uint64_t v = mo_cbm_decode(p + j, elemsz);
      if (!any) {
        minv = maxv = v;
        any = 1;
      } else {
        if (v < minv) minv = v;
        if (v > maxv) maxv = v;
      }
    }
  }

  uint64_t base = use_offset ? minv : 0;
  // span = maxv - base (never overflows: maxv >= base); span+1 is the bit count.
  uint64_t span = any ? (maxv - base) : 0;
  // Feasibility gate: bail (caller selects its sparse exact representation)
  // if the bit count would exceed the cap. Checking span >= max_bits also
  // avoids the span+1 overflow for pathological ranges.
  if (any && span >= max_bits) return MO_CBITMAP_RANGE_TOO_LARGE;

  mo_cbitmap_t *f = (mo_cbitmap_t *)malloc(sizeof(mo_cbitmap_t));
  if (!f) return MO_CBITMAP_OOM;
  f->base = base;
  f->nbits = any ? (span + 1) : 0;
  f->words = NULL;
  uint64_t nwords = bitmap_size(f->nbits);  // (nbits+63)>>6; 0 when nbits == 0
  if (nwords) {
    f->words = (uint64_t *)calloc(nwords, sizeof(uint64_t));
    if (!f->words) {
      free(f);
      return MO_CBITMAP_OOM;
    }
  }

  // Pass 2: set a bit per non-null value, offset by base.
  if (elemsz != 0 && f->words) {
    for (size_t i = 0, j = 0; i < nitem && j < len; i++, j += elemsz) {
      if (nullmap && bitmap_test((uint64_t *)nullmap, i)) continue;
      bitmap_set(f->words, mo_cbm_decode(p + j, elemsz) - base);
    }
  }
  *out = f;
  return MO_CBITMAP_OK;
}

void mo_cbitmap_free(void *f) {
  if (!f) return;
  mo_cbitmap_t *b = (mo_cbitmap_t *)f;
  free(b->words);
  free(b);
}

bool mo_cbitmap_contain(void *f, uint64_t val) {
  if (!f) return false;
  mo_cbitmap_t *b = (mo_cbitmap_t *)f;
  if (val < b->base) return false;  // below base also guards the subtraction
  uint64_t idx = val - b->base;
  if (idx >= b->nbits) return false;
  return bitmap_test(b->words, idx);
}

void mo_cbitmap_test_fixed(void *f, const void *key, size_t len, size_t elemsz,
                           size_t nitem, const void *nullmap,
                           size_t nullmaplen, void *result) {
  (void)nullmaplen;
  mo_cbitmap_t *b = (mo_cbitmap_t *)f;
  const unsigned char *p = (const unsigned char *)key;
  uint8_t *out = (uint8_t *)result;
  for (size_t i = 0, j = 0; i < nitem; i++, j += elemsz) {
    if (!b || (nullmap && bitmap_test((uint64_t *)nullmap, i)) || j >= len) {
      out[i] = 0;
      continue;
    }
    uint64_t v = mo_cbm_decode(p + j, elemsz);
    if (v < b->base) {
      out[i] = 0;
      continue;
    }
    uint64_t idx = v - b->base;
    out[i] = (idx < b->nbits && bitmap_test(b->words, idx)) ? 1 : 0;
  }
}

uint8_t *mo_cbitmap_serialize(void *f, size_t *len) {
  mo_cbitmap_t *b = (mo_cbitmap_t *)f;
  uint64_t nwords = bitmap_size(b->nbits);
  // Header: [base u64][nbits u64], then the bitmap words.
  size_t sz = 2 * sizeof(uint64_t) + (size_t)nwords * sizeof(uint64_t);
  uint8_t *buf = (uint8_t *)malloc(sz);
  if (!buf) {
    *len = 0;
    return NULL;
  }
  memcpy(buf, &b->base, sizeof(uint64_t));
  memcpy(buf + sizeof(uint64_t), &b->nbits, sizeof(uint64_t));
  if (nwords) {
    memcpy(buf + 2 * sizeof(uint64_t), b->words,
           (size_t)nwords * sizeof(uint64_t));
  }
  *len = sz;
  return buf;
}

void mo_cbitmap_free_buf(uint8_t *buf) { free(buf); }

size_t mo_cbitmap_serialized_size(void *f) {
  if (!f) return 0;
  mo_cbitmap_t *b = (mo_cbitmap_t *)f;
  uint64_t nwords = bitmap_size(b->nbits);
  return 2 * sizeof(uint64_t) + (size_t)nwords * sizeof(uint64_t);
}

bool mo_cbitmap_serialize_into(void *f, uint8_t *buf, size_t len) {
  if (!f || !buf) return false;
  mo_cbitmap_t *b = (mo_cbitmap_t *)f;
  uint64_t nwords = bitmap_size(b->nbits);
  size_t required = 2 * sizeof(uint64_t) + (size_t)nwords * sizeof(uint64_t);
  if (len != required) return false;
  memcpy(buf, &b->base, sizeof(uint64_t));
  memcpy(buf + sizeof(uint64_t), &b->nbits, sizeof(uint64_t));
  if (nwords) {
    memcpy(buf + 2 * sizeof(uint64_t), b->words,
           (size_t)nwords * sizeof(uint64_t));
  }
  return true;
}

void *mo_cbitmap_deserialize(const uint8_t *buf, size_t len) {
  if (!buf || len < 2 * sizeof(uint64_t)) return NULL;
  uint64_t base = 0, nbits = 0;
  memcpy(&base, buf, sizeof(uint64_t));
  memcpy(&nbits, buf + sizeof(uint64_t), sizeof(uint64_t));

  // Derive the word count from the ACTUAL payload length and require nbits to be
  // exactly consistent with it, rather than trusting nbits to size the read.
  // Computing bitmap_size(nbits) = (nbits+63)>>6 from an untrusted nbits
  // OVERFLOWS for large nbits (e.g. nbits=MaxUint64 -
```

### Core Architecture Module: `cgo/cbitmap.h`
```
// Copyright 2021 - 2022 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Dense doc_id membership bitset, indexed by the doc_id VALUE (one bit per
// possible id), the integer-PK counterpart to cgo/croaring. The *_fixed entry
// points read a fixed-width integer column buffer directly in C (one cgo call
// per vector), mirroring mo_croaring_add_fixed / mo_croaring_test_fixed, so
// there is no per-row Go<->C crossing or Go-side value extraction.
//
// A dense bitset is sized to (max id + 1) bits, so it is only viable when the
// max id is bounded (see max_bits below); for sparse/large id ranges the caller
// selects its sparse exact representation.
#ifndef MO_CBITMAP_H
#define MO_CBITMAP_H

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

// Build status codes for mo_cbitmap_build_fixed. They disambiguate the reasons
// a build produces no filter so the Go caller reacts correctly: RANGE_TOO_LARGE
// -> select the sparse exact representation; OOM / INVALID_INPUT -> surface an
// error (never silently disable filtering, which would drop matching rows).
#define MO_CBITMAP_OK              0  // *out set to a valid filter (may be empty)
#define MO_CBITMAP_RANGE_TOO_LARGE 1  // value span >= max_bits
#define MO_CBITMAP_OOM             2  // allocation failed
#define MO_CBITMAP_INVALID_INPUT   3  // bad arguments (e.g. elemsz not 1/2/4/8, NULL out)

// Build a dense bitset from a fixed-width integer column read directly from the
// vector's data buffer (one cgo call).
//   key:        pointer to the fixed column data (may be NULL when nitem == 0)
//   len:        total bytes of the data buffer
//   elemsz:     bytes per element (1/2/4/8)
//   nitem:      number of rows
//   nullmap:    optional MO null bitmap (uint64 words) or NULL
//   nullmaplen: bytes of nullmap
//   max_bits:   dense-bitset size cap in bits
//   use_offset: when nonzero, base the bitset at min(values) so its size is the
//               value SPAN (max-min) rather than the max value; 0 keeps the
//               legacy value-indexed layout (base 0).
//   out:        on MO_CBITMAP_OK receives the filter handle (an empty input
//               yields a valid empty filter that matches nothing); set to NULL
//               on every non-OK status.
// Returns one of the MO_CBITMAP_* status codes above. The status — not a NULL
// return — tells the caller whether to fall back (RANGE_TOO_LARGE) or to error
// (OOM / INVALID_INPUT); the two must not be conflated.
int mo_cbitmap_build_fixed(const void *key, size_t len, size_t elemsz,
                           size_t nitem, const void *nullmap,
                           size_t nullmaplen, uint64_t max_bits,
                           int use_offset, void **out);
void mo_cbitmap_free(void *f);

// Single membership test (value already decoded to uint64).
bool mo_cbitmap_contain(void *f, uint64_t val);

// Test a fixed-width integer column; result[i] = 1 if present, 0 if absent/null.
void mo_cbitmap_test_fixed(void *f, const void *key, size_t len, size_t elemsz,
                           size_t nitem, const void *nullmap,
                           size_t nullmaplen, void *result);

// Serialize into a freshly malloc'd buffer ([base u64][nbits u64][bitmap
// words]); *len gets the length. Caller frees with mo_cbitmap_free_buf. Returns
// NULL on OOM.
// The format is host-endian and only exchanged between same-architecture MO
// nodes (same as the build/probe data path).
uint8_t *mo_cbitmap_serialize(void *f, size_t *len);
void mo_cbitmap_free_buf(uint8_t *buf);
size_t mo_cbitmap_serialized_size(void *f);
bool mo_cbitmap_serialize_into(void *f, uint8_t *buf, size_t len);

// Deserialize a buffer produced by mo_cbitmap_serialize; returns NULL on error.
void *mo_cbitmap_deserialize(const uint8_t *buf, size_t len);

#endif  // MO_CBITMAP_H

```

### Core Architecture Module: `cgo/compare.c`
```
/*
 * Copyright 2021 Matrix Origin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "mo_impl.h"


#define	Type_BOOL     10
#define	Type_INT8     20
#define	Type_INT16    21
#define	Type_INT32    22
#define	Type_INT64    23
#define	Type_INT128   24
#define	Type_UINT8    25
#define	Type_UINT16   26
#define	Type_UINT32   27
#define	Type_UINT64   28
#define	Type_UINT128  29
#define	Type_FLOAT32  30
#define	Type_FLOAT64  31

// Time
#define Type_DATE       50
#define Type_TIME       51
#define Type_DATETIME   52
#define Type_TIMESTAMP  53



/*
 * Equal operator (=)
 */
#define COMPARE_EQ(TGT, A, B)                                 \
    TGT = ((A) == (B))


/*
 * Not Equal operator (<>)
 */
#define COMPARE_NE(TGT, A, B)                                 \
    TGT = ((A) != (B))


/*
 * great than operator (>)
 */
#define COMPARE_GT(TGT, A, B)                                 \
    TGT = ((A) > (B))


/*
 * great equal operator (>=)
 */
#define COMPARE_GE(TGT, A, B)                                 \
    TGT = ((A) >= (B))


/*
 * less than operator (<)
 */
#define COMPARE_LT(TGT, A, B)                                 \
    TGT = ((A) < (B))


/*
 * less equal operator (<=)
 */
#define COMPARE_LE(TGT, A, B)                                 \
    TGT = ((A) <= (B))


/*
 * bool compare operator
 */
#define COMPARE_BOOL_EQ(TGT, A, B)                                     \
    TGT = (((A) && (B)) || (!(A) && !(B)))

#define COMPARE_BOOL_NE(TGT, A, B)                                     \
    TGT = ((!(A) && (B)) || ((A) && !(B)))

#define COMPARE_BOOL_LE(TGT, A, B)                                     \
    TGT = (!(A) || (B))

#define COMPARE_BOOL_LT(TGT, A, B)                                     \
    TGT = (!(A) && (B))

#define COMPARE_BOOL_GE(TGT, A, B)                                     \
    TGT = ((A) || !(B))

#define COMPARE_BOOL_GT(TGT, A, B)                                     \
    TGT = ((A) && !(B))





#define MO_COMPARE_T(OP, ZT)                                  \
    bool *rt = (bool *) r;                                    \
    ZT *at = (ZT *) a;                                        \
    ZT *bt = (ZT *) b;                                        \
    if ((flag & LEFT_IS_SCALAR) != 0) {                       \
        if (nulls != NULL) {                                  \
            for (uint64_t i = 0; i < n; i++) {                \
                if (!bitmap_test(nulls, i)) {                 \
                    OP(rt[i], at[0], bt[i]);                  \
                }                                             \
            }                                                 \
        } else {                                              \
            for (uint64_t i = 0; i < n; i++) {                \
                OP(rt[i], at[0], bt[i]);                      \
            }                                                 \
        }                                                     \
    } else if ((flag & RIGHT_IS_SCALAR) != 0) {               \
        if (nulls != NULL) {                                  \
            for (uint64_t i = 0; i < n; i++) {                \
                if (!bitmap_test(nulls, i)) {                 \
                    OP(rt[i], at[i], bt[0]);                  \
                }                                             \
            }                                                 \
        } else {                                              \
            for (uint64_t i = 0; i < n; i++) {                \
                OP(rt[i], at[i], bt[0]);                      \
            }                                                 \
        }                                                     \
    } else {                                                  \
        if (nulls != NULL) {                                  \
            for (uint64_t i = 0; i < n; i++) {                \
                if (!bitmap_test(nulls, i)) {                 \
                    OP(rt[i], at[i], bt[i]);                  \
                }                                             \
            }                                                 \
        } else {                                              \
            for (uint64_t i = 0; i < n; i++) {                \
                OP(rt[i], at[i], bt[i]);                      \
            }                                                 \
        }                                                     \
    }



int32_t Numeric_VecEq(void *r, void *a, void  *b, uint64_t n, uint64_t *nulls, int32_t flag, int32_t type)
{
    if (type == Type_INT8) {
        MO_COMPARE_T(COMPARE_EQ, int8_t);
    } else if (type == Type_INT16) {
        MO_COMPARE_T(COMPARE_EQ, int16_t);
    } else if (type == Type_INT32) {
        MO_COMPARE_T(COMPARE_EQ, int32_t);
    } else if (type == Type_INT64) {
        MO_COMPARE_T(COMPARE_EQ, int64_t);
    } else if (type == Type_UINT8) {
        MO_COMPARE_T(COMPARE_EQ, uint8_t);
    } else if (type == Type_UINT16) {
        MO_COMPARE_T(COMPARE_EQ, uint16_t);
    } else if (type == Type_UINT32) {
        MO_COMPARE_T(COMPARE_EQ, uint32_t);
    } else if (type == Type_UINT64) {
        MO_COMPARE_T(COMPARE_EQ, uint64_t);
    } else if (type == Type_FLOAT32) {
        MO_COMPARE_T(COMPARE_EQ, float);
    } else if (type == Type_FLOAT64) {
        MO_COMPARE_T(COMPARE_EQ, double);
    } else if (type == Type_DATE) {
        MO_COMPARE_T(COMPARE_EQ, int32_t);
    } else if (type == Type_TIME) {
        MO_COMPARE_T(COMPARE_EQ, int64_t);
    } else if (type == Type_DATETIME) {
        MO_COMPARE_T(COMPARE_EQ, int64_t);
    } else if (type == Type_TIMESTAMP) {
        MO_COMPARE_T(COMPARE_EQ, int64_t);
    } else if (type == Type_BOOL) {
        MO_COMPARE_T(COMPARE_BOOL_EQ, bool);
    } else {
        return RC_INVALID_ARGUMENT;
    }
    return RC_SUCCESS;
}


int32_t Numeric_VecNe(void *r, void *a, void  *b, uint64_t n, uint64_t *nulls, int32_t flag, int32_t type)
{
    if (type == Type_INT8) {
        MO_COMPARE_T(COMPARE_NE, int8_t);
    } else if (type == Type_INT16) {
        MO_COMPARE_T(COMPARE_NE, int16_t);
    } else if (type == Type_INT32) {
        MO_COMPARE_T(COMPARE_NE, int32_t);
    } else if (type == Type_INT64) {
        MO_COMPARE_T(COMPARE_NE, int64_t);
    } else if (type == Type_UINT8) {
        MO_COMPARE_T(COMPARE_NE, uint8_t);
    } else if (type == Type_UINT16) {
        MO_COMPARE_T(COMPARE_NE, uint16_t);
    } else if (type == Type_UINT32) {
        MO_COMPARE_T(COMPARE_NE, uint32_t);
    } else if (type == Type_UINT64) {
        MO_COMPARE_T(COMPARE_NE, uint64_t);
    } else if (type == Type_FLOAT32) {
        MO_COMPARE_T(COMPARE_NE, float);
    } else if (type == Type_FLOAT64) {
        MO_COMPARE_T(COMPARE_NE, double);
    } else if (type == Type_DATE) {
        MO_COMPARE_T(COMPARE_NE, int32_t);
    } else if (type == Type_TIME){
        MO_COMPARE_T(COMPARE_NE, int64_t);
    } else if (type == Type_DATETIME) {
        MO_COMPARE_T(COMPARE_NE, int64_t);
    } else if (type == Type_TIMESTAMP) {
        MO_COMPARE_T(COMPARE_NE, int64_t);
    } else if (type == Type_BOOL) {
        MO_COMPARE_T(COMPARE_BOOL_NE, bool);
    } else {
        return RC_INVALID_ARGUMENT;
    }
    return RC_SUCCESS;
}


int32_t Numeric_VecGt(void *r, void *a, void  *b, uint64_t n, uint64_t *nulls, int32_t flag, int32_t type)
{
    if (type == Type_INT8) {
        MO_COMPARE_T(COMPARE_GT, int8_t);

```

### Core Architecture Module: `cgo/croaring.c`
```
// Copyright 2021 - 2022 Matrix Origin
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include "croaring.h"
#include "bitmap.h"
#include "roaring.h"
#include <stdlib.h>

// Include the real CRoaring header (the amalgamated roaring.h) so the roaring64
// prototypes we call are the single source of truth: any upstream signature
// change is a compile error here, not a silent ABI mismatch at link. roaring.h
// requires C11 (it uses <stdatomic.h>), which is why the cgo C build is C11.
// No version assert by design: a CRoaring upgrade compiles cleanly as long as
// the signatures we use are unchanged, so bumps stay frictionless and a real
// incompatibility still surfaces as a compile error.

// Decode elemsz little-endian bytes (1/2/4/8) of a fixed integer into uint64
// by zero-extension. Identical decode on build and probe keeps mapping stable.
static inline uint64_t mo_decode_uint(const unsigned char *p, size_t elemsz) {
  uint64_t x = 0;
  for (size_t b = 0; b < elemsz && b < 8; b++) {
    x |= ((uint64_t)p[b]) << (8 * b);
  }
  return x;
}

void *mo_croaring_create(void) { return (void *)roaring64_bitmap_create(); }

void mo_croaring_free(void *r) {
  if (r) roaring64_bitmap_free((roaring64_bitmap_t *)r);
}

// Convert eligible containers to run-length encoding (helps clustered/
// consecutive id sets). Returns true if the representation changed.
bool mo_croaring_run_optimize(void *r) {
  if (!r) return false;
  return roaring64_bitmap_run_optimize((roaring64_bitmap_t *)r);
}

bool mo_croaring_add_fixed(void *r, const void *key, size_t len, size_t elemsz,
                           size_t nitem, const void *nullmap,
                           size_t nullmaplen) {
  (void)nullmaplen;
  if (!r) return false;                        // no bitmap -> caller must error
  if (elemsz == 0 || nitem == 0) return true;  // nothing to add
  const unsigned char *p = (const unsigned char *)key;
  // Bulk-insert in fixed-size batches via a stack buffer: roaring sorts +
  // inserts each batch in one pass (far faster than per-value add) WITHOUT the
  // previous O(nitem) heap temp, whose silent NULL-on-OOM could leave the bitmap
  // empty and then serialize as a valid-looking but membership-empty filter
  // (dropping all matching rows). The stack buffer cannot fail to allocate.
  enum { CHUNK = 2048 };
  uint64_t buf[CHUNK];
  size_t cnt = 0;
  for (size_t i = 0, j = 0; i < nitem && j < len; i++, j += elemsz) {
    if (nullmap && bitmap_test((uint64_t *)nullmap, i)) continue;
    buf[cnt++] = mo_decode_uint(p + j, elemsz);
    if (cnt == CHUNK) {
      roaring64_bitmap_add_many((roaring64_bitmap_t *)r, cnt, buf);
      cnt = 0;
    }
  }
  if (cnt) roaring64_bitmap_add_many((roaring64_bitmap_t *)r, cnt, buf);
  return true;
}

bool mo_croaring_contains(void *r, uint64_t val) {
  if (!r) return false;
  return roaring64_bitmap_contains((const roaring64_bitmap_t *)r, val);
}

void mo_croaring_test_fixed(void *r, const void *key, size_t len, size_t elemsz,
                            size_t nitem, const void *nullmap,
                            size_t nullmaplen, void *result) {
  (void)nullmaplen;
  const roaring64_bitmap_t *b = (const roaring64_bitmap_t *)r;
  const unsigned char *p = (const unsigned char *)key;
  uint8_t *out = (uint8_t *)result;
  for (size_t i = 0, j = 0; i < nitem; i++, j += elemsz) {
    if ((nullmap && bitmap_test((uint64_t *)nullmap, i)) || j >= len) {
      out[i] = 0;
      continue;
    }
    out[i] = roaring64_bitmap_contains(b, mo_decode_uint(p + j, elemsz)) ? 1 : 0;
  }
}

uint8_t *mo_croaring_serialize(void *r, size_t *len) {
  const roaring64_bitmap_t *b = (const roaring64_bitmap_t *)r;
  size_t sz = roaring64_bitmap_portable_size_in_bytes(b);
  uint8_t *buf = (uint8_t *)malloc(sz);
  if (!buf) {
    *len = 0;
    return NULL;
  }
  roaring64_bitmap_portable_serialize(b, (char *)buf);
  *len = sz;
  return buf;
}

void mo_croaring_free_buf(uint8_t *buf) { free(buf); }

size_t mo_croaring_serialized_size(void *r) {
  if (!r) return 0;
  return roaring64_bitmap_portable_size_in_bytes((const roaring64_bitmap_t *)r);
}

bool mo_croaring_serialize_into(void *r, uint8_t *buf, size_t len) {
  if (!r || !buf) return false;
  const roaring64_bitmap_t *b = (const roaring64_bitmap_t *)r;
  size_t required = roaring64_bitmap_portable_size_in_bytes(b);
  if (len != required) return false;
  return roaring64_bitmap_portable_serialize(b, (char *)buf) == required;
}

void *mo_croaring_deserialize(const uint8_t *buf, size_t len) {
  return (void *)roaring64_bitmap_portable_deserialize_safe((const char *)buf,
                                                           len);
}

uint64_t mo_croaring_cardinality(void *r) {
  if (!r) return 0;
  return roaring64_bitmap_get_cardinality((const roaring64_bitmap_t *)r);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29526** (2026-09-30): **fix(cn): wait for admitted query inventory before SQL startup**
  *Symptoms*: ## What type of PR is this?  - [x] BUG - [x] Improvement - [x] Test and CI  ## Which issue(s) this PR fixes:  Fixes #29476  ## What this PR does / why we need it:  CN startup checked raw self registration before bootstrap, then started SQL acceptance before the final ingress-ready heartbeat and admission-aware local inventory converged. `SELECT 1` could succeed while a query requiring the current CN failed placement because the current incarnation was absent from the candidate pool.  Reuse the existing bounded self-readiness loop with explicit raw/query phases. Keep raw registration before bootstrap; start internal query/pipeline endpoints, perform the existing ingress admission handoff, wake the existing heartbeat worker, and require a successfully refreshed admission-aware snapshot containing the current UUID/address/commit/generation before starting SQL acceptance. Keep the bootstrap owner alive until this handoff completes and propagate its failure/cancellation during convergence. Existing admission and placement checks remain authoritative.  No new persistent readiness state, scheduling path, background worker, configuration or wire format. Cost is confined to startup: one additional authoritative refresh plus bounded retries while the ready heartbeat converges; query/DML paths have no added work. SQL sockets are already bound during initialization; accepting connections/handshakes waits for convergence. Startup failure follows existing rollback.  ### Reproduction and li
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29525** (2026-09-30): **fix(plan): normalize native ranges and prune prepared rounding filters**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [x] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  issue #29512  ## What this PR does / why we need it:  Prepared ROUND/TRUNCATE comparisons can miss native block filtering, and reversed native ranges can return wrong rows when scan consumers interpret the operator as column-first. For BIGINT keys 54320/54321/54322, `ROUND(?) <= id` with integer 54321 could return only 54321 instead of 54321 and 54322.  - Recognize the existing unary ROUND/TRUNCATE overloads as precision zero, and extend the existing exact signed-integer proof to scalar-subquery comparisons before scan statistics choose block filters. - Normalize ordered comparison direction through `ConstantTranspose`, `canonicalRangeOp`, and the existing scan-invariant guard. Preserve executable peers and their domains; copy Boolean arguments only when a child changes. - Keep Boolean recursion in a small private direction-only helper. It never invokes legacy arithmetic equality transposition: for DOUBLE `v=1e-17`, `v+1e0=1e0` is true under IEEE rounding, while `v=1e0-1e0` is false. The former traversal incorrectly lost this row under OR. The repair also preserves arithmetic overflow errors. - Remove the ROUND-specific already-native right-column fallback and redundant helper checks. Existing domain-conversion proofs retain post-proof normalization because they expose columns hidden beneath cas
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29521** (2026-09-30): **fix(sql): complete on-demand View metadata consumers and cache dependencies**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [x] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [ ] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Fixes #26227  ## What this PR does / why we need it:  Complete the remaining current-schema View consumers without refreshing persisted View columns:  - Route `SELECT * FROM view LIMIT 0` through normal View binding, including derived tables, CTEs, and UNION siblings. Preserve the ordinary-table shortcut with catalog identity/version evidence. When its minimal schema hits cached statistics, keep hash shuffle unless primary-/cluster-key metadata proves a range key. - Derive `SHOW COLUMN_NUMBER` and `SHOW TABLE_VALUES` columns through the existing isolated description binder; retain source/target dependencies and use safely quoted, database-qualified projections. - Capture catalog dependencies before empty-result optimization removes scans, so ordinary queries and text/binary PREPARE revalidate after source changes, intermediate View replacement, and table/View replacement. - Validate cached scan snapshots, database identity, and publisher/subscription identity. Share duplicate catalog lookups only within one validation request. - Read known historical `information_schema.COLUMNS` templates using snapshot-visible View schemas after the tenant's current template has migrated and the existing protocol gate permits it. Preserve historical projections and do not rewrite historical catalogs.  Raw catal
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 
  > <!--- DO NOT EDIT -*- Mergify Payload -*- {"version": 1, "state": "dequeued", "queue_rule_name": "main", "queued_at": "2026-09-30T16:40:23.180049+00:00", "estimated_time_of_merge": null, "speculative_check_pr": null, "required_conditions": []} -*- Mergify Payload End -*- -->  # Merge Queue Status  - ✅ **Entered queue** — `2026-09-30 16:40 UTC` · Rule: `main` · triggered by rule `Automatic queue on approval for main` - 🟠 **Checks running** · in-place - 🚫 **Left the queue** — `2026-09-30 16:51 UTC` · at `b4f73ccb8d42ebe7aa309257b91419941f195033`  This pull request spent **11 minutes 25 seconds** in the queue, with no time running CI.  ## Reason  Pull request #29521 has been dequeued  Pull request from fork cannot be queued. This pull request comes from a fork, and Mergify needs the author's permission to update its branch.  > The author needs to enable ["Allow edits from maintainers"](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/allowing-

- **Issue #29520** (2026-09-30): **test: reduce race fixture work and strengthen regression coverage**
  *Symptoms*: ## What type of PR is this?  - [ ] API-change - [ ] BUG - [ ] Improvement - [ ] Documentation - [ ] Feature - [x] Test and CI - [ ] Code Refactoring  ## Which issue(s) this PR fixes:  Related to #28538 (assigned to XuPeng-SH; tracks the unsharded race UT embedded-stage hard timeout). This PR reduces repeated embedded-cluster test work, but does not claim to resolve the full-suite timeout or the ten-minute CI target.  ## What this PR does / why we need it:  - Apply test-cluster startup defaults once, before caller overrides; preserve production defaults, readiness conditions, and HAKeeper failure budgets. - Reuse one private cluster for EXCEPT ALL topology coverage, while retaining standalone execution of the two-CN subtest. - Move the session-only long-data wire cases onto the existing shared fixture and remove the now-unused isolated-fixture release helper. - Reduce clone rollback seed data from 5,000 rows to two explicit rows; keep forced object persistence and assert the exact post-rollback rows. - Replace randomized hidden-PK probes with three deterministic rows and persisted hit/miss checks that fail under an intentionally incorrect sorted-PK lookup. - Strengthen auto-PK dedup assertions and make snapshot/database cleanup bounded, failure-tolerant, and owned by the existing SQL cleanup path.  Validation on Go 1.26.4, Darwin arm64, native CGo, `matrixone_test`, single runner:  - Full normal and race runs passed for `pkg/tests/issues`, `pkg/tests/issues/isolated`, `pkg/tes
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29518** (2026-09-30): **[4.2-dev] Backport #29513: composite range pruning and DECIMAL256 safety**
  *Symptoms*: ## What type of PR is this?  - [x] BUG - [x] Improvement - [x] Documentation - [x] Test and CI  ## Which issue(s) this PR fixes:  Related to #29507: first-column range on a composite sort key misses object-level pruning.  Backport of #29513 (merged commit `76862df5c89e8868bed5963c428f65b9eafb34b3`) to `4.2-dev`, validated against base `1a44f3db3056e32975fde86ca0ab69a094996a3f`. This updates the existing backport; it does not close an additional issue.  ## What this PR does / why we need it:  Composite leading-range pruning preserves the SQL row predicate while pruning compound keys. The backport also keeps metadata scan slots separate from physical column identity, resolves partition predicates against the actual partition column, and honors `CannotFold()` so volatile bounds cannot independently evaluate in row and prefix filters.  The repair completes DECIMAL256 support instead of disabling its optimization:  - Use the existing 33-byte DECIMAL256 tuple encoding in `serial`, `serial_full`, `SerialHelper`, extraction, and encoded-length contracts. Keep decimal scales compatible while allowing ordinary integer literals to reach leading-range pruning. - Resolve `serial_full` pack functions lazily after a NULL argument becomes non-NULL, including reuse/reset. Reject negative dynamic extraction indices in both reverse consumers. - Preserve the exact scan qualifier in the existing `ColRef.TblName` field through remapping, copying and protobuf round trips, so aliases and physical co
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 
  > ### P2 — DECIMAL256 的前缀范围优化资格与 4.2 serializer 能力不一致  审查提交：`183d9f17f130e2b7a40142e3b3f7d68bbf0fd4b8`。对照为干净的 `4.2-dev` 基线 `1a44f3db3056e32975fde86ca0ab69a094996a3f`。  **已通过实际 SQL 和 planner/runtime-folding 回归确认：该回移使原本可以执行的查询报错，空表即可复现。建议修复后再合并。**  #### 复现  在已选择的测试数据库中执行：  ```sql CREATE TABLE d(a DECIMAL(40,0), b INT) CLUSTER BY(a,b); SET @x = 1;  EXPLAIN SELECT b FROM d WHERE a > CAST(@x AS DECIMAL(40,0)); SELECT b FROM d WHERE a > CAST(@x AS DECIMAL(40,0));  -- literal CAST 也可复现 SELECT b FROM d WHERE a > CAST(1 AS DECIMAL(40,0)); ```  - **PR 候选**：EXPLAIN 新增 `prefix_in_range(d.__mo_cbkey_001a001b)`；SELECT 报 `ERROR 20101 (HY000): internal error: not supported type DECIMAL256`。 - **干净基线**：同一张空表、同一条 SQL，仅保留原行过滤，SELECT 正常返回空结果。 - 独立诊断测试通过公开 SQL 构建计划，并执行 `ReplaceFoldExpr` / `EvalFoldExpr`；候选因上述错误失败，干净基线通过。未修改 PR 源码。  #### 根因  1. [`compositeRangeOrderPreserving`](https://github.com/matrixorigin/matrixone/blob/183d9f17f130e2b7a40142e3b3f7d68bbf0fd4b8/pkg/sql/plan/expr_opt.go#L416-L424) 将 `T_deci

- **Issue #29513** (2026-09-30): **Optimize leading ranges on composite sort keys**
  *Symptoms*: ## What type of PR is this?  - [x] BUG - [x] Improvement  ## Which issue(s) this PR fixes:  Fixes #29507  ## What this PR does / why we need it:  A range on the first component of a composite primary or cluster key did not produce a hidden sort-key predicate for object pruning. The scan could load metadata for objects whose sort-key zone map already ruled them out.  The planner adds a supplemental hidden-key block filter for compatible bounded ranges, `BETWEEN`, and one-sided comparisons, including reversed operands. The original SQL row predicate remains authoritative. The change uses the existing composite-key serializer, `BlockFilterList`, and readutil's sort-key zone-map fast path. First-component paired bounds stay separate, avoiding a premerge cast that could change bound semantics.  Block filters now retain metadata-only column references without adding those columns to the scan reader. Row-needed columns keep their compact positions; omitted metadata columns receive distinct positions for the combined runtime/block zonemap path. This also removes unnecessary row reads for existing composite-part block filters. The relation's full schema still supplies physical sequence numbers and zonemaps; no new reader, storage format, or persistent state is introduced.  Partition pruning also consumes block filters. It now matches named predicates to the partition column instead of assuming scan-local and stored partition positions are equal. Ambiguous dotted alias/column names con
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29508** (2026-09-30): **fix: preserve prepared ROUND and TRUNCATE value domains**
  *Symptoms*: ## What type of PR is this?  - [x] BUG  ## Which issue(s) this PR fixes:  Closes #29505 Closes #29509 Closes #29471 Closes #29506 Closes #29511 Closes #29512 Closes #29510 Closes #29514 Closes #29515 Closes #29516 Closes #29517  ## What this PR does / why we need it:  - Keep the prepared `ROUND`/`TRUNCATE` value argument's numeric domain open until EXECUTE, while the precision argument retains its integer domain. Rebuild cached expressions with all arguments and preserve explicit CAST and set-operation output domains (#29505). - Keep the prepared generation and snapshot binding when `EXPLAIN ANALYZE FORCE EXECUTE` compiles the executable plan (#29509). - Serialize JSON-to-CHAR expression casts with JSON string quotes while preserving existing assignment behavior (#29471). - For prepared integer-key comparisons, prove that an integral text/float binding can use the native integer domain without changing existing DOUBLE comparison results; preserve fallback at and beyond the signed 2^53 collision boundary, for fractional/malformed/out-of-range values, and for unsigned edge cases. Carry the existing prepared diagnostic proof into executable EXPLAIN so its actual scan uses the block filter (#29506). - For SELECT comparisons between an integer key and a wider or differently signed integer binding, narrow only a proven safe runtime value to the key domain. Preserve the existing fallback for out-of-range, negative-to-unsigned, and 2^53 collision values. Keep DML on its existing type
  **Post-Mortem & Fix Analysis**:
  > ### Qodo reviews are paused for this user.  Troubleshooting steps vary by plan [Learn more →](https://docs.qodo.ai/subscription-plans#what-you%E2%80%99ll-see-when-reviews-are-paused)   **On a Teams plan?** Reviews resume once this user has a paid seat *and* their Git account is linked in Qodo. [Link Git account →](https://docs.qodo.ai/subscription-plans#linking-a-git-account)  **Using GitHub Enterprise Server, GitLab Self-Managed, or Bitbucket Data Center?** These require an Enterprise plan - Contact us [Contact us →](https://docs.qodo.ai/qodo-support#support) 

- **Issue #29502** (2026-09-29): **[Bug]: binary prepared BETWEEN DML rejects text instead of warning and updating**
  *Symptoms*: ## Origin  A separate regression found in the Ubuntu/x86 [coverage UT job for #29462](https://github.com/matrixorigin/matrixone/actions/runs/36567399126/job/109402753871?pr=29462), running commit `386c1434232af5ccf153b7c2d23e1240be90d021`. Tracked as a follow-up under the maintainer's instruction for lower-severity review findings. Distinct from #29501's scalar ABS / derived SUM errors because this is a binary prepared DML warning and predicate result contract.  ## Reproduction and exact-base proof  Existing `TestIssue27443BinaryPreparedDMLAndAggregate/between` prepares:  ```sql UPDATE predicate_dst SET status = 12 WHERE id = 1 AND ? BETWEEN 0 AND 0; ```  Then it executes the **binary prepared statement** with string parameter `"foo"`. The established contract is successful execution, warning 1292 (`Truncated incorrect DOUBLE value`), and `status=12` because the nonnumeric string converts to zero in the numeric predicate.  At the PR head, `stmt.ExecContext(ctx, "foo")` fails before the warning/result checks:  ```text Error 20203 (HY000): invalid argument cast to int, bad value foo ```  CI log: `pkg/tests/issues/issue_27443_test.go:495`. I reran the **same existing focused test** on the exact base `b06ff850d4c54af2aeb920136f6e39d6b88f940b` with the repository CGo-aware wrapper: `TestIssue27443BinaryPreparedDMLAndAggregate/between` **PASS**. The head failure is documented by the linked CI job. This makes it a PR-introduced regression, not a coverage-runner error. The complete `
  **Post-Mortem & Fix Analysis**:
  > Fixed on #29462 at f520258274 by routing prepared text-parameter BETWEEN with numeric bounds through the existing binary comparison coercion owner. The unchanged Issue27443 binary prepared DML/aggregate suite now passes, including BETWEEN, NOT BETWEEN, warning 1292, and DML result assertions. The exact base passed before the fix; the previous PR head failed in CI.

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

### Incident Patch 1: `9990e0e7` (2026-09-30)
**Commit Message**: fix(sql): complete on-demand View metadata consumers and cache dependencies (#29521)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #26227

## What this PR does / why we need it:

Complete the remaining current-schema View consumers without refreshing
persisted View columns:

- Route `SELECT * FROM view LIMIT 0` through normal View binding,
including derived tables, CTEs, and UNION siblings. Preserve the
ordinary-table shortcut with catalog identity/version evidence. When its
minimal schema hits cached statistics, keep hash shuffle unless
primary-/cluster-key metadata proves a range key.
- Derive `SHOW COLUMN_NUMBER` and `SHOW TABLE_VALUES` columns through
the existing isolated description binder; retain source/target
dependencies and use safely quoted, database-qualified projections.
- Capture catalog dependencies before empty-result optimization removes
scans, so ordinary queries and text/binary PREPARE revalidate after
source changes, intermediate View replacement, and table/View
replacement.
- Validate cached scan snapshots, database id

**File**: `pkg/frontend/authenticate.go` (modified, +2/-2)
```diff
@@ -1636,7 +1636,7 @@ const (
 
 	fetchSqlOfSpFormat = `select lang, body, args, sql_mode from mo_catalog.mo_stored_procedure where name = '%s' and db = '%s' order by proc_id;`
 
-	getTableColumnDefFormat = `select attname, atttyp, attnum, attnotnull, att_default, att_is_auto_increment, att_is_hidden from mo_catalog.mo_columns where account_id = %d and att_database = '%s' and att_relname = '%s' order by attnum;`
+	getTableColumnDefFormat = `select col.attname, col.atttyp, col.attnum, col.attnotnull, col.att_default, col.att_is_auto_increment, col.att_is_hidden, tbl.relkind, tbl.rel_id, tbl.rel_version, tbl.reldatabase_id from mo_catalog.mo_columns col join mo_catalog.mo_tables tbl on col.account_id = tbl.account_id and col.att_relname_id = tbl.rel_id where col.account_id = %d and col.att_database = %s and col.att_relname = %s order by col.attnum;`
 )
 
 var (
@@ -2119,7 +2119,7 @@ func privilegeTypeListSQL(objTyp objectType, privId PrivilegeType, includeSysSco
 }
 
 func getTableColumnDefSql(accountId uint64, dbName, tableName string) (string, error) {
-	return fmt.Sprintf(getTableColumnDefFormat, accountId, dbName, tableName), nil
+	return fmt.Sprintf(getTableColumnDefFormat, accountId, escapeSQLString(dbName), escapeSQLString(tableName)), nil
 }
 
 func getSqlForCheckDatabase(_ context.Context, dbName string) (string, error) {
```

**File**: `pkg/frontend/authenticate_test.go` (modified, +3/-2)
```diff
@@ -7071,8 +7071,9 @@ func TestNamedWindowValidationDependencyRequiresSelectPrivilege(t *testing.T) {
 	require.NoError(t, err)
 	queryPlan, err := plan2.BuildPlan(plan2.NewMockCompilerContext(true), stmt, false)
 	require.NoError(t, err)
-	require.Len(t, queryPlan.GetQuery().GetCatalogDependencies(), 1)
-	require.Equal(t, region, queryPlan.GetQuery().GetCatalogDependencies()[0].GetObjName())
+	dependencies := queryPlan.GetQuery().GetCatalogDependencies()
+	require.Len(t, dependencies, 2)
+	require.ElementsMatch(t, []string{nation, region}, []string{dependencies[0].ObjName, dependencies[1].ObjName})
 
 	ctrl := gomock.NewController(t)
 	defer ctrl.Finish()
```

**File**: `pkg/frontend/mysql_cmd_executor.go` (modified, +43/-10)
```diff
@@ -4270,33 +4270,65 @@ func checkModify(plan0 *plan.Plan, resolveFn func(string, string, *plan2.Snapsho
 		return true, nil
 	}
 
+	// Scan nodes and binding-time dependencies often describe the same object.
+	// Resolve each identity/snapshot once per validation, while checking every
+	// captured version against that result. Nothing is retained across requests.
+	type lookupKey struct{ database, table, snapshot string }
+	type resolvedObject struct {
+		ref *plan2.ObjectRef
+		def *plan2.TableDef
+	}
+	resolved := make(map[lookupKey]resolvedObject)
 	checkCatalogObject := func(
 		ref *plan.ObjectRef,
 		name string,
 		snapshot *plan2.Snapshot,
 		version int64,
 		tableID int64,
+		databaseID uint64,
 	) (bool, error) {
 		if ref == nil {
 			return true, nil
 		}
-		_, tableDef, err := resolveFn(plan2.DbNameOfObjRef(ref), name, snapshot)
-		if err != nil {
-			return true, err
+		// An isolated SHOW binder can capture an unpublished publisher source.
+		// A name-only resolver in the subscriber cannot validate it. Rebind the
+		// description rather than resolving a same-named subscriber object.
+		if ref.PubInfo != nil && ref.SubscriptionName == "" {
+			return true, nil
+		}
+		key := lookupKey{database: plan2.DbNameOfObjRef(ref), table: name}
+		if snapshot != nil {
+			key.snapshot = snapshot.String()
 		}
+		object, exists := resolved[key]
+		if !exists {
+			var err error
+			object.ref, object.def, err = resolveFn(key.database, name, snapshot)
+			if err != nil {
+				return true, err
+			}
+			resolved[key] = object
+		}
+		current, tableDef := object.ref, object.def
 		if tableDef == nil {
 			return true, nil
 		}
-		if int64(tableDef.Version) != version || int64(tableDef.TblId) != tableID {
+		if int64(tableDef.Version) != version || int64(tableDef.TblId) != tableID ||
+			(databaseID != 0 && tableDef.DbId != databaseID) {
+			return true, nil
+		}
+		if (ref.PubInfo == nil) != (current.GetPubInfo() == nil) ||
+			(ref.PubInfo != nil && (current.PubInfo.TenantId != ref.PubInfo.TenantId ||
+				current.SubscriptionName != ref.SubscriptionName || current.SchemaName != ref.SchemaName)) {
 			return true, nil
 		}
 		return false, nil
 	}
-	checkFn := func(ref *plan.ObjectRef, def *plan.TableDef) (bool, error) {
+	checkFn := func(ref *plan.ObjectRef, def *plan.TableDef, snapshot *plan2.Snapshot) (bool, error) {
 		if ref == nil || def == nil {
 			return true, nil
 		}
-		return checkCatalogObject(ref, def.Name, nil, int64(def.Version), int64(def.TblId))
+		return checkCatalogObject(ref, def.Name, snapshot, int64(def.Version), int64(def.TblId), def.DbId)
 	}
 	switch p := plan0.Plan.(type) {
 	case *plan.Plan_Query:
@@ -4305,25 +4337,25 @@ func checkModify(plan0 *plan.Plan, resolveFn func(string, string, *plan2.Snapsho
 		}
 		for i := range p.Query.Nodes {
 			if def := p.Query.Nodes[i].TableDef; def != nil {
-				flag, err := checkFn(p.Query.Nodes[i].ObjRef, def)
+				flag, err := checkFn(p.Query.Nodes[i].ObjRef, def, p.Query.Nodes[i].ScanSnapshot)
 				if err != nil || flag {
 					return true, err
 				}
 			}
 			if ctx := p.Query.Nodes[i].InsertCtx; ctx != nil {
-				flag, err := checkFn(ctx.Ref, ctx.TableDef)
+				flag, err := checkFn(ctx.Ref, ctx.TableDef, nil)
 				if err != nil || flag {
 					return true, err
 				}
 			}
 			if ctx := p.Query.Nodes[i].DeleteCtx; ctx != nil {
-				flag, err := checkFn(ctx.Ref, ctx.TableDef)
+				flag, err := checkFn(ctx.Ref, ctx.TableDef, nil)
 				if err != nil || flag {
 					return true, err
 				}
 			}
 			if ctx := p.Query.Nodes[i].PreInsertCtx; ctx != nil {
-				flag, err := checkFn(ctx.Ref, ctx.TableDef)
+				flag, err := checkFn(ctx.Ref, ctx.TableDef, nil)
 				if err != nil || flag {
 					return true, err
 				}
@@ -4336,6 +4368,7 @@ func checkModify(plan0 *plan.Plan, resolveFn func(string, string, *plan2.Snapsho
 				dependency.GetSnapshot(),
 				dependency.GetServer(),
 				dependency.GetObj(),
+				uint64(dependency.GetDb()),
 			)
 			if err != nil || fl
```

**File**: `pkg/frontend/util.go` (modified, +30/-3)
```diff
@@ -34,6 +34,7 @@ import (
 	"github.com/google/uuid"
 	"go.uber.org/zap"
 
+	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/cdc"
 	"github.com/matrixorigin/matrixone/pkg/common/log"
 	"github.com/matrixorigin/matrixone/pkg/common/moerr"
@@ -2843,15 +2844,41 @@ func buildTableDefFromMoColumns(ctx context.Context, accountId uint64, dbName, t
 		return nil, moerr.NewNoSuchTable(ctx, dbName, table)
 	}
 
+	// LIMIT 0 may skip loading a base table's complete engine definition, but
+	// View columns in mo_columns are only a creation-time snapshot. Return the
+	// kind, not those columns, so the planner takes the normal View binding path.
+	kind, err := erArray[0].GetString(ctx, 0, 7)
+	if err != nil {
+		return nil, err
+	}
+	if kind == catalog.SystemViewRel {
+		return &plan.TableDef{Name: table, DbName: dbName, TableType: kind}, nil
+	}
 	cols, err := extractTableDefColumns(erArray, ctx, dbName, table)
 	if err != nil {
 		return nil, err
 	}
 
+	tableID, err := erArray[0].GetUint64(ctx, 0, 8)
+	if err != nil {
+		return nil, err
+	}
+	version, err := erArray[0].GetUint64(ctx, 0, 9)
+	if err != nil {
+		return nil, err
+	}
+	databaseID, err := erArray[0].GetUint64(ctx, 0, 10)
+	if err != nil {
+		return nil, err
+	}
 	return &plan.TableDef{
-		Name:   table,
-		DbName: dbName,
-		Cols:   cols,
+		Name:      table,
+		DbName:    dbName,
+		Cols:      cols,
+		TableType: kind,
+		TblId:     tableID,
+		DbId:      databaseID,
+		Version:   uint32(version),
 	}, nil
 }
 
```

**File**: `pkg/frontend/util_test.go` (modified, +31/-2)
```diff
@@ -2627,8 +2627,21 @@ func Test_BuildTableDefFromMoColumns(t *testing.T) {
 		})
 		bh.sql2result[sql] = mrs
 
-		_, err = buildTableDefFromMoColumns(ctx, uint64(tenant.TenantID), "db1", "t1", ses)
+		actual, err := buildTableDefFromMoColumns(ctx, uint64(tenant.TenantID), "db1", "t1", ses)
 		convey.So(err, convey.ShouldBeNil)
+		convey.So(len(actual.Cols), convey.ShouldEqual, 1)
+		convey.So(actual.TblId, convey.ShouldEqual, 100)
+		convey.So(actual.Version, convey.ShouldEqual, 3)
+		convey.So(actual.DbId, convey.ShouldEqual, 10)
+
+		// A View must be rebound, even if its persisted type blob is invalid.
+		bh.sql2result[sql] = newMrsForTableColumnDef([][]interface{}{{
+			"old", "invalid type", 1, 0, "invalid default", 0, 0, catalog.SystemViewRel,
+		}})
+		actual, err = buildTableDefFromMoColumns(ctx, uint64(tenant.TenantID), "db1", "t1", ses)
+		convey.So(err, convey.ShouldBeNil)
+		convey.So(actual.TableType, convey.ShouldEqual, catalog.SystemViewRel)
+		convey.So(len(actual.Cols), convey.ShouldEqual, 0)
 	})
 }
 
@@ -2670,8 +2683,24 @@ func newMrsForTableColumnDef(rows [][]interface{}) *MysqlResultSet {
 	mrs.AddColumn(col5)
 	mrs.AddColumn(col6)
 	mrs.AddColumn(col7)
+	kind := &MysqlColumn{}
+	kind.SetName("relkind")
+	kind.SetColumnType(defines.MYSQL_TYPE_VARCHAR)
+	mrs.AddColumn(kind)
+	for _, name := range []string{"rel_id", "rel_version", "reldatabase_id"} {
+		column := &MysqlColumn{}
+		column.SetName(name)
+		column.SetColumnType(defines.MYSQL_TYPE_LONGLONG)
+		mrs.AddColumn(column)
+	}
 
 	for _, row := range rows {
+		if len(row) == 7 {
+			row = append(row, catalog.SystemOrdinaryRel)
+		}
+		if len(row) == 8 {
+			row = append(row, uint64(100), uint32(3), uint64(10))
+		}
 		mrs.AddRow(row)
 	}
 
@@ -2692,7 +2721,7 @@ func Test_getTableColumnDefSql(t *testing.T) {
 			accountId: 1,
 			dbName:    "db1",
 			tableName: "tbl1",
-			want:      fmt.Sprintf(getTableColumnDefFormat, 1, "db1", "tbl1"),
+			want:      fmt.Sprintf(getTableColumnDefFormat, 1, "'db1'", "'tbl1'"),
 			wantErr:   false,
 		},
 	}
```

---

### Incident Patch 2: `0d368700` (2026-09-30)
**Commit Message**: fix(cn): wait for admitted query inventory before SQL startup (#29526)

## What type of PR is this?

- [x] BUG
- [x] Improvement
- [x] Test and CI

## Which issue(s) this PR fixes:

Fixes #29476

## What this PR does / why we need it:

CN startup checked raw self registration before bootstrap, then started
SQL acceptance before the final ingress-ready heartbeat and
admission-aware local inventory converged. `SELECT 1` could succeed
while a query requiring the current CN failed placement because the
current incarnation was absent from the candidate pool.

Reuse the existing bounded self-readiness loop with explicit raw/query
phases. Keep raw registration before bootstrap; start internal
query/pipeline endpoints, perform the existing ingress admission
handoff, wake the existing heartbeat worker, and require a successfully
refreshed admission-aware snapshot containing the current
UUID/address/commit/generation before starting SQL acceptance. Keep the
bootstrap owner alive until this handoff completes and propagate its
failure/cancellation during convergence. Existing admission and
placement checks remain authoritative.

No new persistent readiness state, scheduling path, background wo

**File**: `pkg/cnservice/server.go` (modified, +13/-6)
```diff
@@ -446,7 +446,7 @@ func (s *service) Start() (err error) {
 		s.lifecycle = serviceStarted
 	}()
 
-	if err = s.waitForClusterSelfReady(); err != nil {
+	if err = s.waitForClusterSelfReady(false); err != nil {
 		return err
 	}
 	if err = s.bootstrap(); err != nil {
@@ -488,26 +488,33 @@ func (s *service) Start() (err error) {
 
 	s.initSqlWriterFactory()
 
-	if err = s.startFrontendUnlessViewMetadataGenerationRevoked(); err != nil {
-		return err
-	}
 	if err = s.startUnlessViewMetadataGenerationRevoked(s.server.Start); err != nil {
 		return err
 	}
 
 	// Admission authorizes local initialization; it does not make this CN
-	// routable. Revalidate after every remote entry point is listening, then
+	// routable. SQL sockets are bound but do not yet accept connections.
+	// Revalidate after the internal remote entry points are listening, then
 	// linearize authoritative snapshot validation and ingress publication with
 	// heartbeat snapshot storage. Keep the automatic upgrade owner alive until
 	// this final handoff closes.
 	if err = s.waitForViewMetadataIngressAdmission(); err != nil {
 		return err
 	}
-	s.completeBootstrapUpgradeStartupWait()
 	if err = s.checkViewMetadataGenerationRevoked(); err != nil {
 		return err
 	}
 	s.notifyHeartbeat()
+	// Ingress advertisement needs a heartbeat and a local inventory refresh
+	// before query scheduling can use this CN. Keep SQL acceptance closed until
+	// the authoritative admission-aware snapshot contains this incarnation.
+	if err = s.waitForClusterSelfReady(true); err != nil {
+		return err
+	}
+	if err = s.startFrontendUnlessViewMetadataGenerationRevoked(); err != nil {
+		return err
+	}
+	s.completeBootstrapUpgradeStartupWait()
 
 	if err = s.checkViewMetadataGenerationRevoked(); err != nil {
 		return err
```

**File**: `pkg/cnservice/server_cluster.go` (modified, +62/-19)
```diff
@@ -28,11 +28,10 @@ import (
 
 const minClusterReadinessRetryInterval = 100 * time.Millisecond
 
-// waitForClusterSelfReady prevents ingress from opening before this CN's local
-// authoritative cluster snapshot contains the heartbeat generation it just
-// published. Proxy and CN maintain independent snapshots, so a replacement CN
-// can otherwise receive traffic while its own snapshot still predates itself.
-func (s *service) waitForClusterSelfReady() error {
+// waitForClusterSelfReady checks raw self registration before bootstrap, then
+// admission-aware query membership before public SQL acceptance. The latter
+// must follow ingress publication so HAKeeper can make this incarnation routable.
+func (s *service) waitForClusterSelfReady(requireQueryReady bool) error {
 	// Some focused lifecycle tests build only the service dependencies relevant
 	// to their assertion. NewService always initializes moCluster.
 	if s.moCluster == nil {
@@ -43,23 +42,28 @@ func (s *service) waitForClusterSelfReady() error {
 	if timeout <= 0 {
 		timeout = 30 * time.Second
 	}
-	ctx, cancel := context.WithTimeout(context.Background(), timeout)
+	parent := context.Background()
+	if requireQueryReady && s.bootstrapUpgradeContext != nil {
+		parent = s.bootstrapUpgradeContext
+	}
+	ctx, cancel := context.WithTimeout(parent, timeout)
 	defer cancel()
 
 	retryInterval := s.cfg.HAKeeper.HeatbeatInterval.Duration
 	if retryInterval < minClusterReadinessRetryInterval {
 		retryInterval = minClusterReadinessRetryInterval
 	}
-	return s.waitForClusterSelfReadyWithContext(ctx, retryInterval)
+	return s.waitForClusterSelfReadyWithContext(ctx, retryInterval, requireQueryReady)
 }
 
 func (s *service) waitForClusterSelfReadyWithContext(
 	ctx context.Context,
 	retryInterval time.Duration,
+	requireQueryReady bool,
 ) error {
 	select {
 	case <-ctx.Done():
-		return s.clusterSelfReadinessError(ctx, nil)
+		return s.clusterSelfReadinessError(ctx, nil, requireQueryReady)
 	case <-s.hakeeperConnected:
 	}
 
@@ -69,17 +73,39 @@ func (s *service) waitForClusterSelfReadyWithContext(
 			"CN cluster service does not support authoritative refresh")
 	}
 
+	var upgradeResult <-chan error
+	if requireQueryReady {
+		upgradeResult = s.bootstrapUpgradeResult
+	}
+	checkStartup := func() error {
+		if err := s.checkViewMetadataGenerationRevoked(); err != nil {
+			return err
+		}
+		if requireQueryReady {
+			var err error
+			upgradeResult, err = pollBootstrapUpgradeResult(s.bootstrapUpgradeContext, upgradeResult)
+			return err
+		}
+		return nil
+	}
 	var lastRefreshErr error
 	for attempts := 1; ; attempts++ {
+		if err := checkStartup(); err != nil {
+			return err
+		}
 		lastRefreshErr = refresher.Refresh(ctx)
+		if err := checkStartup(); err != nil {
+			return err
+		}
 		if lastRefreshErr == nil {
-			ready, err := s.clusterSnapshotContainsSelf(ctx)
+			ready, err := s.clusterSnapshotContainsSelf(ctx, requireQueryReady)
 			if err != nil {
 				lastRefreshErr = err
 			} else if ready {
 				s.logger.Info("CN is visible in local cluster inventory",
 					zap.String("uuid", s.cfg.UUID),
-					zap.Int("refresh-attempts", attempts))
+					zap.Int("refresh-attempts", attempts),
+					zap.Bool("query-ready", requireQueryReady))
 				return nil
 			}
 		}
@@ -93,25 +119,40 @@ func (s *service) waitForClusterSelfReadyWithContext(
 				default:
 				}
 			}
-			return s.clusterSelfReadinessError(ctx, lastRefreshErr)
+			return s.clusterSelfReadinessError(ctx, lastRefreshErr, requireQueryReady)
+		case err := <-upgradeResult:
+			if !timer.Stop() {
+				select {
+				case <-timer.C:
+				default:
+				}
+			}
+			upgradeResult = nil
+			if err != nil {
+				return err
+			}
 		case <-timer.C:
 		}
 	}
 }
 
-func (s *service) clusterSnapshotContainsSelf(ctx context.Context) (bool, error) {
+func (s *service) clusterSnapshotContainsSelf(ctx context.Context, requireQueryReady bool) (bool, error) {
 	found := false
-	requireGeneration := false
-	if reader, ok := s.
```

**File**: `pkg/cnservice/server_cluster_test.go` (modified, +261/-4)
```diff
@@ -18,18 +18,22 @@ import (
 	"context"
 	"errors"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
 	"github.com/golang/mock/gomock"
 	"github.com/stretchr/testify/require"
 	"go.uber.org/zap"
 
+	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/clusterservice"
 	moruntime "github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/common/stopper"
 	"github.com/matrixorigin/matrixone/pkg/frontend/test/mock_lock"
+	logpb "github.com/matrixorigin/matrixone/pkg/pb/logservice"
 	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/matrixorigin/matrixone/pkg/util/executor"
 	"github.com/matrixorigin/matrixone/pkg/version"
 )
 
@@ -130,7 +134,7 @@ func TestClusterSelfReadinessRequiresCurrentHeartbeatGeneration(t *testing.T) {
 
 	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
 	defer cancel()
-	require.NoError(t, s.waitForClusterSelfReadyWithContext(ctx, time.Millisecond))
+	require.NoError(t, s.waitForClusterSelfReadyWithContext(ctx, time.Millisecond, false))
 	require.Equal(t, 3, cluster.calls())
 }
 
@@ -145,7 +149,7 @@ func TestClusterSelfReadinessHonorsCancellationBeforeHeartbeat(t *testing.T) {
 	ctx, cancel := context.WithCancel(context.Background())
 	cancel()
 
-	err := s.waitForClusterSelfReadyWithContext(ctx, time.Millisecond)
+	err := s.waitForClusterSelfReadyWithContext(ctx, time.Millisecond, false)
 	require.Error(t, err)
 	require.Contains(t, err.Error(), "before startup deadline")
 	require.Zero(t, cluster.calls())
@@ -169,7 +173,7 @@ func TestClusterSelfReadinessReportsAuthoritativeRefreshFailure(t *testing.T) {
 		hakeeperConnected: heartbeatReady,
 	}
 
-	err := s.waitForClusterSelfReadyWithContext(ctx, time.Second)
+	err := s.waitForClusterSelfReadyWithContext(ctx, time.Second, false)
 	require.Error(t, err)
 	require.Contains(t, err.Error(), refreshErr.Error())
 	require.Equal(t, 1, cluster.calls())
@@ -185,7 +189,7 @@ func TestClusterSelfReadinessRejectsNonAuthoritativeCluster(t *testing.T) {
 		hakeeperConnected: heartbeatReady,
 	}
 
-	err := s.waitForClusterSelfReadyWithContext(context.Background(), time.Second)
+	err := s.waitForClusterSelfReadyWithContext(context.Background(), time.Second, false)
 	require.Error(t, err)
 	require.Contains(t, err.Error(), "does not support authoritative refresh")
 }
@@ -257,3 +261,256 @@ func TestServiceStartDoesNotBootstrapBeforeClusterSelfReady(t *testing.T) {
 		require.Equal(t, int32(1), boot.bootstrapCount.Load())
 	})
 }
+
+// Use the real snapshot policy; a mock inventory alone cannot distinguish raw
+// registration from an admission-aware query candidate.
+type readinessClusterClient func(context.Context) (logpb.ClusterDetails, error)
+
+func (f readinessClusterClient) GetClusterDetails(ctx context.Context) (logpb.ClusterDetails, error) {
+	return f(ctx)
+}
+
+func TestClusterQueryReadinessSnapshot(t *testing.T) {
+	moruntime.RunTest(t.Name(), func(moruntime.Runtime) {
+		var details atomic.Pointer[logpb.ClusterDetails]
+		details.Store(&logpb.ClusterDetails{})
+		cluster := clusterservice.NewMOCluster(t.Name(), readinessClusterClient(func(context.Context) (logpb.ClusterDetails, error) { return *details.Load(), nil }), time.Hour)
+		t.Cleanup(cluster.Close)
+		s := &service{cfg: &Config{UUID: t.Name(), ServiceAddress: "127.0.0.1:6002"}, moCluster: cluster, viewMetadataAdmissionGeneration: 11}
+		self := logpb.CNStore{UUID: t.Name(), ServiceAddress: s.pipelineServiceServiceAddr(), CommitID: version.CommitID, ViewMetadataAdmissionGeneration: 11, ViewMetadataAdmissionReady: true}
+		for _, test := range []struct {
+			name                    string
+			mutate                  func(*logpb.CNStore)
+			active, preparing, want bool
+		}{
+			{name: "ready", active: true, want: true},
+			{name: "pending", active: true, mutate: func(c *logpb.CNStore) { c.ViewMetadataAdmissionReady = false }},
+			{name: "preparing ready", preparing: true, want: true},
+			{name
```

**File**: `pkg/embed/startup_query_readiness_test.go` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//      http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package embed
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"testing"
+	"time"
+
+	"github.com/matrixorigin/matrixone/pkg/clusterservice"
+	"github.com/matrixorigin/matrixone/pkg/logservice"
+	"github.com/matrixorigin/matrixone/pkg/pb/metadata"
+	"github.com/stretchr/testify/require"
+)
+
+// A long refresh interval isolates startup from the periodic inventory task.
+// Once admission is enabled, a newly added CN must refresh its own admitted
+// generation before SQL readiness, without SHOW BACKEND SERVERS or query retry.
+func TestStartupQueryReadiness(t *testing.T) {
+	// This scenario needs a fresh inventory configuration. Release the cached
+	// shared fixture through its owner before acquiring exclusive admission.
+	require.NoError(t, CloseSingleCNBaseClusterTests())
+	c, err := StartTestCluster(WithCNCount(2), WithPreStart(func(op ServiceOperator) {
+		if op.ServiceType() == metadata.ServiceType_CN {
+			op.Adjust(func(cfg *ServiceConfig) {
+				cfg.CN.Cluster.RefreshInterval.Duration = time.Hour
+				cfg.CN.AutomaticUpgrade = true
+			})
+		}
+	}))
+	if c != nil {
+		t.Cleanup(func() { require.NoError(t, c.Close()) })
+	}
+	require.NoError(t, err)
+	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
+	defer cancel()
+
+	initial, err := c.GetCNService(0)
+	require.NoError(t, err)
+	client, err := logservice.NewCNHAKeeperClient(ctx, initial.GetServiceConfig().CN.UUID, initial.GetServiceConfig().HAKeeperClient)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, client.Close()) })
+	require.Eventually(t, func() bool {
+		d, e := client.GetClusterDetails(ctx)
+		return e == nil && d.ViewMetadataAdmission != nil && d.ViewMetadataAdmission.Enabled
+	}, 30*time.Second, 100*time.Millisecond)
+	require.NoError(t, c.StartNewCNService(1))
+	cn, err := c.GetCNService(2)
+	require.NoError(t, err)
+	cfg := cn.GetServiceConfig().CN
+	cluster, err := clusterservice.GetMOClusterWithContext(ctx, cfg.UUID)
+	require.NoError(t, err)
+	require.True(t, cluster.(clusterservice.ViewMetadataAdmissionReader).GetViewMetadataAdmission().Enabled)
+	var admitted []string
+	require.NoError(t, clusterservice.GetCNServiceWithoutWorkingStateWithContext(ctx, cluster, clusterservice.NewSelector(), func(cn metadata.CNService) bool {
+		admitted = append(admitted, cn.ServiceID)
+		return true
+	}))
+	db, err := sql.Open("mysql", fmt.Sprintf("dump:111@tcp(127.0.0.1:%d)/?interpolateParams=false", cfg.Frontend.Port))
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, db.Close()) })
+	conn, err := db.Conn(ctx)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, conn.Close()) })
+	var one int
+	require.NoError(t, conn.QueryRowContext(ctx, "select 1").Scan(&one))
+	require.Equal(t, 1, one)
+	for _, stmt := range []string{"create database startup_query_readiness", "use startup_query_readiness", "create table t(id int primary key, v vecf32(3))", "insert into t values (1,'[1,1,1]'),(2,'[2,2,2]'),(3,'[9,9,9]'),(4,'[10,10,10]')", "create index idx using ivfflat on t(v) lists=1 op_type 'vector_l2_ops'"} {
+		_, err = conn.ExecContext(ctx, stmt)
+		require.NoError(t, err, stmt)
+	}
+	rows, err := conn.QueryContext(ctx, "select id from t where l2_distance(v,'[1,1,1]') < 5 order by l2_distance(v,'[1,1,1]') limit 2")
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, rows.Close()) })
+	va
```

---

### Incident Patch 3: `c2abd6a5` (2026-09-30)
**Commit Message**: fix(plan): normalize native ranges and prune prepared rounding filters (#29525)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [x] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #29512

## What this PR does / why we need it:

Prepared ROUND/TRUNCATE comparisons can miss native block filtering, and
reversed native ranges can return wrong rows when scan consumers
interpret the operator as column-first. For BIGINT keys
54320/54321/54322, `ROUND(?) <= id` with integer 54321 could return only
54321 instead of 54321 and 54322.

- Recognize the existing unary ROUND/TRUNCATE overloads as precision
zero, and extend the existing exact signed-integer proof to
scalar-subquery comparisons before scan statistics choose block filters.
- Normalize ordered comparison direction through `ConstantTranspose`,
`canonicalRangeOp`, and the existing scan-invariant guard. Preserve
executable peers and their domains; copy Boolean arguments only when a
child changes.
- Keep Boolean recursion in a small private direction-only helper. It
never invokes legacy arithmetic equality transposition: for DOUBLE
`v=1e-17`, `v+1e

**File**: `pkg/embed/prepared_specialized_domains_test.go` (modified, +66/-0)
```diff
@@ -236,6 +236,72 @@ func TestPreparedSpecializedDomains(t *testing.T) {
 			require.NoError(t, explicitDerived.QueryRowContext(ctx, "2.5").Scan(&explicitGot))
 			require.Equal(t, "3", explicitGot.String)
 		})
+		t.Run("prepared_round_filter_domains", func(t *testing.T) {
+			exec(t, "create table rounding_filters(id bigint)")
+			defer conn.ExecContext(ctx, "drop table rounding_filters")
+			exec(t, "insert into rounding_filters values (null),(-54322),(-54321),(0),(54320),(54321),(54322),"+
+				"(9007199254740991),(9007199254740992),(9007199254740993)")
+			for _, predicate := range []string{
+				"id=round(?)", "id=round((select ?))",
+				"id<round((select ?))", "id<=round((select ?),0)",
+				"id>round((select ?),0)", "id>=round((select ?),0)",
+				"round((select ?))>id", "id<>round((select ?))", "id<=>round((select ?))",
+				"id=truncate(?)", "id<truncate((select ?))", "id>=truncate((select ?),0)",
+			} {
+				t.Run(predicate, func(t *testing.T) {
+					exec(t, "prepare rounding_filter from 'select id from rounding_filters where "+predicate+" order by id'")
+					defer conn.ExecContext(ctx, "deallocate prepare rounding_filter")
+					// Keep the pre-rewrite exact DECIMAL column domain executable as
+					// an independent oracle, including BIGINTs beyond 2^53.
+					control := strings.ReplaceAll(predicate, "id", "cast(id as decimal(38,0))")
+					exec(t, "prepare rounding_control from 'select id from rounding_filters where "+control+" order by id'")
+					defer conn.ExecContext(ctx, "deallocate prepare rounding_control")
+					for _, value := range []string{"'54321.0'", "'54321.5'", "'9007199254740992'", "null", "'-54321.0'", "'54321.0'"} {
+						exec(t, "set @rounding_filter_source="+value)
+						require.Equal(t, query(t, "execute rounding_control using @rounding_filter_source"),
+							query(t, "execute rounding_filter using @rounding_filter_source"), value)
+					}
+				})
+			}
+		})
+		t.Run("prepared_round_reversed_primary_key_ranges", func(t *testing.T) {
+			exec(t, "create table rounding_keys(id bigint primary key)")
+			defer conn.ExecContext(ctx, "drop table rounding_keys")
+			exec(t, "insert into rounding_keys values (54320),(54321),(54322)")
+			for _, fn := range []string{"round", "truncate"} {
+				for _, source := range []string{"?", "(select ?)"} {
+					for _, tc := range []struct {
+						op   string
+						want [][]string
+					}{{"<", [][]string{{"54322"}}}, {"<=", [][]string{{"54321"}, {"54322"}}},
+						{">", [][]string{{"54320"}}}, {">=", [][]string{{"54320"}, {"54321"}}}} {
+						t.Run(fn+"/"+source+"/"+tc.op, func(t *testing.T) {
+							predicate := fn + "(" + source + ")" + tc.op
+							exec(t, "prepare rounding_key from 'select id from rounding_keys where "+predicate+"id order by id'")
+							defer conn.ExecContext(ctx, "deallocate prepare rounding_key")
+							exec(t, "prepare rounding_key_control from 'select id from rounding_keys where "+predicate+"cast(id as decimal(38,0)) order by id'")
+							defer conn.ExecContext(ctx, "deallocate prepare rounding_key_control")
+							for _, value := range []string{"'54321.0'", "54321", "54321.5", "null", "'54321.0'"} {
+								exec(t, "set @rounding_key_source="+value)
+								got := query(t, "execute rounding_key using @rounding_key_source")
+								require.Equal(t, query(t, "execute rounding_key_control using @rounding_key_source"), got, value)
+								if value == "54321" || value == "'54321.0'" {
+									require.Equal(t, tc.want, got, value)
+								}
+							}
+						})
+					}
+				}
+			}
+		})
+		t.Run("nested_float_arithmetic_preserves_rows", func(t *testing.T) {
+			exec(t, "create table floating_filters(id int primary key, v double)")
+			defer conn.ExecContext(ctx, "drop table floating_filters")
+			exec(t, "insert into floating_filters values (1,1e-17),(2,2e0)")
+			want := [][]string{{"1"}, {"2"}}
+			require.Equal(t, want, query(t, "select id from floating_filters where cast(v+1e0 as double)=1e0 or v=2e0 order by i
```

**File**: `pkg/sql/colexec/filter/filter_test.go` (modified, +75/-0)
```diff
@@ -1185,6 +1185,81 @@ func TestConstantTranspose(t *testing.T) {
 		},
 	}
 
+	bind := func(t *testing.T, name string, args ...*plan.Expr) *plan.Expr {
+		t.Helper()
+		expr, err := plan2.BindFuncExprImplByPlanExpr(proc.Ctx, name, args)
+		require.NoError(t, err)
+		return expr
+	}
+	param := &plan.Expr{Typ: colExpr.Typ, Expr: &plan.Expr_P{P: &plan.ParamRef{Pos: 0}}}
+	for _, tc := range []struct{ op, inverse string }{{"<", ">"}, {"<=", ">="}, {">", "<"}, {">=", "<="}} {
+		t.Run("native_range_"+tc.op, func(t *testing.T) {
+			input := bind(t, tc.op, param, colExpr)
+			result, err := plan2.ConstantTranspose(input, proc)
+			require.NoError(t, err)
+			require.Equal(t, bind(t, tc.inverse, colExpr, param), result)
+			require.Equal(t, tc.op, input.GetF().Func.ObjName, "input must stay unchanged")
+			again, err := plan2.ConstantTranspose(result, proc)
+			require.NoError(t, err)
+			require.Same(t, result, again, "normal form needs no replacement")
+		})
+	}
+	t.Run("native_range_nested_boolean", func(t *testing.T) {
+		equality := bind(t, "=", colExpr, makeConstExpr(42))
+		input := bind(t, "or", equality, bind(t, "and", bind(t, "<=", param, colExpr), equality))
+		before := plan2.DeepCopyExpr(input)
+		result, err := plan2.ConstantTranspose(input, proc)
+		require.NoError(t, err)
+		require.Equal(t, bind(t, "or", equality, bind(t, "and", bind(t, ">=", colExpr, param), equality)), result)
+		require.Equal(t, before, input, "Boolean children may be shared")
+	})
+	t.Run("boolean_direction_preserves_float_arithmetic", func(t *testing.T) {
+		floatType := types.T_float64.ToType()
+		col := &plan.Expr{Typ: plan2.MakePlan2Type(&floatType), Expr: &plan.Expr_Col{Col: &plan.ColRef{ColPos: 0}}}
+		one := plan2.MakePlan2Float64ConstExprWithType(1)
+		two := plan2.MakePlan2Float64ConstExprWithType(2)
+		input := bind(t, "or", bind(t, "=", bind(t, "+", col, one), one), bind(t, "<=", two, col))
+		before := plan2.DeepCopyExpr(input)
+		result, err := plan2.ConstantTranspose(input, proc)
+		require.NoError(t, err)
+		require.Equal(t, before, input)
+		require.Equal(t, ">=", result.GetF().Args[1].GetF().Func.ObjName)
+		bat := batch.NewWithSize(1)
+		bat.Vecs[0] = vector.NewVec(floatType)
+		defer bat.Clean(mp)
+		for i, value := range []float64{1e-17, 2, 0, 0} {
+			require.NoError(t, vector.AppendFixed(bat.Vecs[0], value, i == 3, mp))
+		}
+		bat.SetRowCount(4)
+		for _, expr := range []*plan.Expr{before, result} {
+			func() {
+				executor, err := colexec.NewExpressionExecutor(proc, expr)
+				require.NoError(t, err)
+				defer executor.Free()
+				values, err := executor.Eval(proc, []*batch.Batch{bat}, nil)
+				require.NoError(t, err)
+				require.Equal(t, []bool{true, true, true}, vector.MustFixedColWithTypeCheck[bool](values)[:3])
+				require.True(t, values.GetNulls().Contains(3))
+			}()
+		}
+	})
+	target := &plan.Expr{Typ: colExpr.Typ, Expr: &plan.Expr_T{T: &plan.TargetType{}}}
+	wideParam := plan2.DeepCopyExpr(param)
+	wideParam.Typ.Id = int32(types.T_int64)
+	for _, peer := range []*plan.Expr{makeConstExpr(42), makeAddExpr(makeConstExpr(40), makeConstExpr(2)), bind(t, "cast", wideParam, target)} {
+		input := bind(t, "<=", peer, colExpr)
+		result, err := plan2.ConstantTranspose(input, proc)
+		require.NoError(t, err)
+		require.Equal(t, bind(t, ">=", colExpr, peer), result, "peer domain must stay executable")
+	}
+	volatile := bind(t, "cast", bind(t, "rand"), target)
+	wrappedCol := bind(t, "cast", colExpr, &plan.Expr{Typ: wideParam.Typ, Expr: &plan.Expr_T{T: &plan.TargetType{}}})
+	for _, input := range []*plan.Expr{bind(t, "<=", volatile, colExpr), bind(t, "<=", colExpr, colExpr), bind(t, "<=", wideParam, wrappedCol)} {
+		result, err := plan2.ConstantTranspose(input, proc)
+		require.NoError(t, err)
+		require.Same(t, input, result, "only scan-invariant peers beside bare columns qualify")
+	}
+
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
 			input := plan2.DeepCopyExpr(tt.input)
```

**File**: `pkg/sql/plan/expr_opt.go` (modified, +6/-2)
```diff
@@ -251,7 +251,7 @@ func (builder *QueryBuilder) rewriteNumericDomainFilters(nodeID int32) {
 					return nil
 				}
 				fn := current.GetF()
-				if fn == nil || fn.Func == nil || fn.Func.GetObjName() != "=" || len(fn.Args) != 2 {
+				if fn == nil || fn.Func == nil || !isPreparedNumericComparison(fn.Func.GetObjName()) || len(fn.Args) != 2 {
 					return nil
 				}
 				for side := range fn.Args {
@@ -267,7 +267,11 @@ func (builder *QueryBuilder) rewriteNumericDomainFilters(nodeID int32) {
 					if err != nil || !ok {
 						continue
 					}
-					rewritten, err := BindFuncExprImplByPlanExpr(builder.GetContext(), "=", []*plan.Expr{DeepCopyExpr(column), castValue})
+					args := make([]*plan.Expr, 2)
+					args[side], args[1-side] = DeepCopyExpr(column), castValue
+					// Native scan predicates use column-first comparisons, including reversed ranges.
+					name := canonicalRangeOp(&plan.Function{Func: fn.Func, Args: args})
+					rewritten, err := BindFuncExprImplByPlanExpr(builder.GetContext(), name, []*plan.Expr{args[side], args[1-side]})
 					if err == nil {
 						*current = *rewritten
 					}
```

**File**: `pkg/sql/plan/prepared_binding.go` (modified, +4/-2)
```diff
@@ -190,10 +190,12 @@ func preparedNumericValueSpelling(value any) string {
 // normal comparison domain.
 func preparedZeroPrecisionRoundParam(ctx context.Context, expr *Expr) *Expr {
 	fn := expr.GetF()
-	if fn == nil || fn.Func == nil || (fn.Func.GetObjName() != "round" && fn.Func.GetObjName() != "truncate") || len(fn.Args) != 2 {
+	if fn == nil || fn.Func == nil || (fn.Func.GetObjName() != "round" && fn.Func.GetObjName() != "truncate") ||
+		(len(fn.Args) != 1 && len(fn.Args) != 2) {
 		return nil
 	}
-	if !preparedZeroIntegerArgument(ctx, fn.Args[1]) {
+	// Both unary overloads use precision zero; an explicit precision still needs proof.
+	if len(fn.Args) == 2 && !preparedZeroIntegerArgument(ctx, fn.Args[1]) {
 		return nil
 	}
 	value := fn.Args[0]
```

**File**: `pkg/sql/plan/prepared_binding_test.go` (modified, +10/-0)
```diff
@@ -76,6 +76,16 @@ func TestPreparedNumericPredicateFiltering(t *testing.T) {
 		{"nested boolean", "(c=abs(?) or c=abs(?)) and c>=abs(?)", []string{"54321", "54322", "54320"}, true, false},
 		{"mixed unsafe in", "c in (?,?)", []string{"54321", "0.104"}, false, false},
 		{"mixed unsafe between", "c between ? and ?", []string{"54321", "54322.104"}, false, false},
+		{"round default precision", "c=round(?)", []string{"54321.0"}, true, true},
+		{"truncate default precision", "c=truncate(?)", []string{"54321.0"}, true, true},
+		{"round scalar default", "c=round((select ?))", []string{"54321.0"}, true, true},
+		{"round scalar strict lower", "c>round((select ?),0)", []string{"54321.0"}, true, true},
+		{"round scalar inclusive lower", "c>=round((select ?),0)", []string{"54321.0"}, true, true},
+		{"truncate scalar strict upper", "c<truncate((select ?))", []string{"54321.0"}, true, true},
+		{"truncate scalar inclusive upper", "c<=truncate((select ?),0)", []string{"54321.0"}, true, true},
+		{"round scalar reversed range", "round((select ?))>c", []string{"54321.0"}, true, true},
+		{"round scalar fractional fallback", "c>=round((select ?))", []string{"54321.5"}, false, true},
+		{"round scalar collision fallback", "c>=round((select ?))", []string{"9007199254740992"}, false, true},
 		{"round zero precision", "c=round(?,?)", []string{"54321.0", "0"}, true, true},
 		{"truncate zero precision", "c=truncate(?,?)", []string{"54321.0", "0"}, true, true},
 		{"explicit precision cast", "c=round(?,cast(? as signed))", []string{"54321.0", "0"}, true, true},
```

---

### Incident Patch 4: `19e01d26` (2026-09-30)
**Commit Message**: test: reduce race fixture work and strengthen regression coverage (#29520)

## What type of PR is this?

- [ ] API-change
- [ ] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #28538 (assigned to XuPeng-SH; tracks the unsharded race UT
embedded-stage hard timeout). This PR reduces repeated embedded-cluster
test work, but does not claim to resolve the full-suite timeout or the
ten-minute CI target.

## What this PR does / why we need it:

- Apply test-cluster startup defaults once, before caller overrides;
preserve production defaults, readiness conditions, and HAKeeper failure
budgets.
- Reuse one private cluster for EXCEPT ALL topology coverage, while
retaining standalone execution of the two-CN subtest.
- Move the session-only long-data wire cases onto the existing shared
fixture and remove the now-unused isolated-fixture release helper.
- Reduce clone rollback seed data from 5,000 rows to two explicit rows;
keep forced object persistence and assert the exact post-rollback rows.
- Replace randomized hidden-PK probes with three deterministic rows and
persisted hit/miss checks that fail u

**File**: `pkg/embed/cluster.go` (modified, +1/-0)
```diff
@@ -526,6 +526,7 @@ func (c *cluster) createServiceOperators(from int) error {
 			})
 		}
 		if c.options.testing {
+			adjustTestingClusterStartup(s)
 			s.Adjust(applyTestingHAKeeperBackendReadTimeout)
 			if s.serviceType == metadata.ServiceType_CN {
 				s.Adjust(applyTestingTxnTraceBuffer)
```

**File**: `pkg/embed/cluster_test.go` (modified, +23/-3)
```diff
@@ -219,7 +219,6 @@ func TestClusterLifecycleAndCNExpansion(t *testing.T) {
 	c, err := NewCluster(
 		WithTesting(),
 		WithPreStart(func(svc ServiceOperator) {
-			adjustClusterStartupRetryIntervals(svc)
 			if svc.ServiceType() == metadata.ServiceType_CN {
 				svc.Adjust(func(config *ServiceConfig) {
 					config.CN.AutomaticUpgrade = true
@@ -268,7 +267,7 @@ func TestClusterLifecycleAndCNExpansion(t *testing.T) {
 
 	// Preserve the original dynamic-expansion coverage with the generated CN
 	// defaults after the first three CNs have exercised automatic upgrade.
-	c.(*cluster).options.preStart = adjustClusterStartupRetryIntervals
+	c.(*cluster).options.preStart = nil
 	require.NoError(t, c.StartNewCNService(1))
 	validCNCanWork(t, c, 3)
 	cn, err = c.GetCNService(3)
@@ -661,7 +660,7 @@ func TestWithTestingBoundsHeartbeatRecoveryInsideStoreLiveness(t *testing.T) {
 	}
 }
 
-func TestTestingTxnTraceBufferPreservesOverrides(t *testing.T) {
+func TestTestingServiceDefaultsPreserveOverrides(t *testing.T) {
 	cfg := newServiceConfig()
 	cfg.CN.Txn.Trace.BufferSize = 4096
 	applyTestingTxnTraceBuffer(&cfg)
@@ -673,6 +672,21 @@ func TestTestingTxnTraceBufferPreservesOverrides(t *testing.T) {
 				opts = append(opts, WithTesting())
 			}
 			opts = append(opts, WithPreStart(func(svc ServiceOperator) {
+				if svc.ServiceType() == metadata.ServiceType_LOG {
+					cfg := svc.GetServiceConfig()
+					wantRTT := uint64(200)
+					wantRetry := time.Second
+					if testingMode {
+						wantRTT = 50
+						wantRetry = basicClusterHAKeeperBootstrapRetryInterval
+					}
+					require.Equal(t, wantRTT, cfg.LogService.RTTMillisecond)
+					require.Equal(t, wantRetry, cfg.LogService.HAKeeperBootstrapRetryInterval.Duration)
+					// This interval also defines the bootstrap failure budget.
+					require.Equal(t, 3*time.Second, cfg.LogService.HAKeeperCheckInterval.Duration)
+					svc.Adjust(func(cfg *ServiceConfig) { cfg.LogService.RTTMillisecond = 75 })
+				}
+
 				if svc.ServiceType() != metadata.ServiceType_CN {
 					return
 				}
@@ -688,6 +702,12 @@ func TestTestingTxnTraceBufferPreservesOverrides(t *testing.T) {
 				t.Cleanup(func() { require.NoError(t, c.Close()) })
 			}
 			require.NoError(t, err)
+			for _, svc := range c.(*cluster).services {
+				if svc.ServiceType() == metadata.ServiceType_LOG {
+					require.Equal(t, uint64(75), svc.GetServiceConfig().LogService.RTTMillisecond)
+				}
+			}
+
 			for i := range 2 {
 				cn, err := c.GetCNService(i)
 				require.NoError(t, err)
```

**File**: `pkg/embed/testing.go` (modified, +6/-21)
```diff
@@ -494,20 +494,6 @@ func init() {
 // is non-nil solely so the caller can retain it and retry Close.
 func StartTestCluster(opts ...Option) (Cluster, error) {
 	opts = append([]Option{WithTesting()}, opts...)
-	// Keep every embedded UT cluster on the short test-only readiness cadence.
-	// Shared base clusters already use this callback, but dedicated scenarios
-	// commonly provide their own pre-start adjustment and would otherwise fall
-	// back to the production one-second polling intervals. Apply the cadence
-	// first so an explicit scenario-specific value can still override it.
-	opts = append(opts, func(c *cluster) {
-		preStart := c.options.preStart
-		c.options.preStart = func(svc ServiceOperator) {
-			adjustClusterStartupRetryIntervals(svc)
-			if preStart != nil {
-				preStart(svc)
-			}
-		}
-	})
 	c, err := NewCluster(opts...)
 	if err != nil {
 		return cleanupClusterOnError(c, err)
@@ -561,8 +547,6 @@ func startBasicCluster(
 }
 
 func adjustBasicClusterService(svc ServiceOperator) {
-	adjustClusterStartupRetryIntervals(svc)
-
 	switch svc.ServiceType() {
 	case metadata.ServiceType_CN:
 		svc.Adjust(
@@ -592,14 +576,15 @@ func adjustBasicClusterService(svc ServiceOperator) {
 	}
 }
 
-// adjustClusterStartupRetryIntervals keeps test-only cluster startup
-// responsive while services are converging. These intervals only affect the
-// polling cadence; readiness is still gated by the same HAKeeper state and
-// shard conditions.
-func adjustClusterStartupRetryIntervals(svc ServiceOperator) {
+// adjustTestingClusterStartup applies local test-cluster Raft timing
+// and readiness polling before scenario overrides. Readiness conditions,
+// store liveness, and bootstrap failure budgets are unchanged.
+func adjustTestingClusterStartup(svc ServiceOperator) {
 	switch svc.ServiceType() {
 	case metadata.ServiceType_LOG:
 		svc.Adjust(func(config *ServiceConfig) {
+			// A single local LOG needs no production network RTT allowance.
+			config.LogService.RTTMillisecond = 50
 			config.LogService.HAKeeperBootstrapRetryInterval.Duration =
 				basicClusterHAKeeperBootstrapRetryInterval
 		})
```

**File**: `pkg/embed/testing_test.go` (modified, +18/-13)
```diff
@@ -129,20 +129,25 @@ func TestWaitBasicClusterTaskServicesReportsReadinessCancellation(t *testing.T)
 }
 
 func TestBasicClusterUsesShortStartupRetryIntervals(t *testing.T) {
-	services := []*operator{
-		{serviceType: metadata.ServiceType_LOG, cfg: newServiceConfig()},
-		{serviceType: metadata.ServiceType_TN, cfg: newServiceConfig()},
-		{serviceType: metadata.ServiceType_CN, cfg: newServiceConfig()},
+	c, err := NewCluster(WithTesting(), WithPreStart(adjustBasicClusterService))
+	if c != nil {
+		t.Cleanup(func() { require.NoError(t, c.Close()) })
 	}
-	for _, service := range services {
-		adjustBasicClusterService(service)
-	}
-
-	assert.Equal(t, time.Second, services[0].cfg.LogService.HAKeeperCheckInterval.Duration)
-	assert.Equal(t, 500*time.Millisecond, services[0].cfg.LogService.HAKeeperBootstrapRetryInterval.Duration)
-	assert.Equal(t, 100*time.Millisecond, services[1].cfg.HAKeeperRunningRetryInterval.Duration)
-	assert.Equal(t, 100*time.Millisecond, services[2].cfg.TNShardReadyRetryInterval.Duration)
-	assert.True(t, services[2].cfg.CN.AutoIncrement.EnableAutoIDCache)
+	require.NoError(t, err)
+	c.ForeachServices(func(service ServiceOperator) bool {
+		cfg := service.GetServiceConfig()
+		switch service.ServiceType() {
+		case metadata.ServiceType_LOG:
+			assert.Equal(t, time.Second, cfg.LogService.HAKeeperCheckInterval.Duration)
+			assert.Equal(t, 500*time.Millisecond, cfg.LogService.HAKeeperBootstrapRetryInterval.Duration)
+		case metadata.ServiceType_TN:
+			assert.Equal(t, 100*time.Millisecond, cfg.HAKeeperRunningRetryInterval.Duration)
+		case metadata.ServiceType_CN:
+			assert.Equal(t, 100*time.Millisecond, cfg.TNShardReadyRetryInterval.Duration)
+			assert.True(t, cfg.CN.AutoIncrement.EnableAutoIDCache)
+		}
+		return true
+	})
 }
 
 type panicTestReporter struct{}
```

**File**: `pkg/tests/dml/dml_test.go` (modified, +8/-12)
```diff
@@ -566,21 +566,18 @@ func runCloneCommitFailureRollbackKeepsSourceFiles(t *testing.T, parentCtx conte
 	require.NoError(t, err)
 	defer removeForceFlush()
 
-	execSQLDB(t, ctx, db, "insert into src select result, result * 10, concat('seed_', cast(result as char)) from generate_series(1,5000) g")
-	require.Equal(t, 5000, queryRowCount(t, ctx, db, "select count(*) from src"))
+	// ForceFlush bypasses the volume threshold; two rows in one object suffice
+	// to detect source loss or corruption after clone rollback.
+	execSQLDB(t, ctx, db, "insert into src values (1,10,'seed_1'),(100,1000,'seed_100')")
+	require.Equal(t, 2, queryRowCount(t, ctx, db, "select count(*) from src"))
 
 	removeCommitFailure, err := objectio.SimpleInject(objectio.FJ_CNCommitAfterWorkspaceDumpFailed)
 	require.NoError(t, err)
 	defer removeCommitFailure()
 
 	conn, err := db.Conn(ctx)
 	require.NoError(t, err)
-	connClosed := false
-	defer func() {
-		if !connClosed {
-			_ = conn.Close()
-		}
-	}()
+	defer conn.Close()
 
 	_, err = conn.ExecContext(ctx, fmt.Sprintf("use `%s`", dbName))
 	require.NoError(t, err)
@@ -593,15 +590,14 @@ func runCloneCommitFailureRollbackKeepsSourceFiles(t *testing.T, parentCtx conte
 	_, err = conn.ExecContext(ctx, "commit")
 	require.Error(t, err)
 	require.Contains(t, err.Error(), "injected commit failure after workspace dump")
-	_ = conn.Close()
-	connClosed = true
+	require.NoError(t, conn.Close())
 
 	removeCommitFailure()
 
 	require.Equal(t, 0, queryRowCount(t, ctx, db,
 		fmt.Sprintf("select count(*) from information_schema.tables where table_schema = '%s' and table_name = 'clone_t'", dbName)))
-	require.Equal(t, 5000, queryRowCount(t, ctx, db, "select count(*) from src"))
-	require.Equal(t, 50, queryRowCount(t, ctx, db, "select count(*) from src where id mod 100 = 0"))
+	require.Equal(t, [][]string{{"1", "10", "seed_1"}, {"100", "1000", "seed_100"}},
+		queryStringRows(t, ctx, db, "select id, value, note from src order by id"))
 }
 
 func runSinglePKWithBase(t *testing.T, parentCtx context.Context, db *sql.DB, dbName string) {
```

---

### Incident Patch 5: `3d222287` (2026-09-30)
**Commit Message**: fix: preserve prepared ROUND and TRUNCATE value domains (#29508)

## What type of PR is this?

- [x] BUG

## Which issue(s) this PR fixes:

Closes #29505
Closes #29509
Closes #29471
Closes #29506
Closes #29511
Closes #29512
Closes #29510
Closes #29514
Closes #29515
Closes #29516
Closes #29517

## What this PR does / why we need it:

- Keep the prepared `ROUND`/`TRUNCATE` value argument's numeric domain
open until EXECUTE, while the precision argument retains its integer
domain. Rebuild cached expressions with all arguments and preserve
explicit CAST and set-operation output domains (#29505).
- Keep the prepared generation and snapshot binding when `EXPLAIN
ANALYZE FORCE EXECUTE` compiles the executable plan (#29509).
- Serialize JSON-to-CHAR expression casts with JSON string quotes while
preserving existing assignment behavior (#29471).
- For prepared integer-key comparisons, prove that an integral
text/float binding can use the native integer domain without changing
existing DOUBLE comparison results; preserve fallback at and beyond the
signed 2^53 collision boundary, for fractional/malformed/out-of-range
values, and for unsigned edge cases. Carry the existing prepared
diagnostic 

**File**: `pkg/embed/prepared_specialized_domains_test.go` (modified, +147/-0)
```diff
@@ -89,6 +89,153 @@ func TestPreparedSpecializedDomains(t *testing.T) {
 				require.Equal(t, [][]string{{tc.want}}, query(t, "execute numeric_sum using @numeric_source"), tc.assignment)
 			}
 		})
+		t.Run("prepared_round_truncate_value_domains", func(t *testing.T) {
+			for _, tc := range []struct {
+				name string
+				fn   string
+			}{
+				{name: "round", fn: "round"},
+				{name: "truncate", fn: "truncate"},
+			} {
+				fractionalResult := "1.4"
+				if tc.fn == "round" {
+					fractionalResult = "1.5"
+				}
+				t.Run(tc.name+"/sql_execute", func(t *testing.T) {
+					stmtName := "numeric_" + tc.name
+					exec(t, "prepare "+stmtName+" from 'select "+tc.fn+"(?,?)'")
+					defer conn.ExecContext(ctx, "deallocate prepare "+stmtName)
+					for _, value := range []struct {
+						assignment string
+						precision  string
+						want       string
+					}{
+						{"'1.46'", "1", fractionalResult + "0"},
+						{"cast(1.46 as decimal(10,2))", "1", fractionalResult + "0"},
+						{"2", "0", "2"},
+						{"null", "1", "NULL"},
+					} {
+						exec(t, "set @numeric_value="+value.assignment+", @numeric_precision="+value.precision)
+						require.Equal(t, [][]string{{value.want}}, query(t,
+							"execute "+stmtName+" using @numeric_value,@numeric_precision"), value)
+					}
+					exec(t, "set @numeric_value='not-a-number', @numeric_precision=1")
+					err := func() error {
+						rows, err := conn.QueryContext(ctx,
+							"execute "+stmtName+" using @numeric_value,@numeric_precision")
+						if rows == nil {
+							return err
+						}
+						defer rows.Close()
+						for rows.Next() {
+						}
+						return rows.Err()
+					}()
+					require.Error(t, err, "invalid text should fail as on the GOOD baseline")
+					exec(t, "set @numeric_value='1.46'")
+					require.Equal(t, [][]string{{fractionalResult + "0"}},
+						query(t, "execute "+stmtName+" using @numeric_value,@numeric_precision"),
+						"a failed execution must not poison the next binding")
+				})
+
+				t.Run(tc.name+"/binary_protocol", func(t *testing.T) {
+					stmt, err := conn.PrepareContext(ctx, "select "+tc.fn+"(?,?)")
+					require.NoError(t, err)
+					defer stmt.Close()
+					for _, value := range []struct {
+						input any
+						want  string
+					}{
+						{"1.46", fractionalResult + "0"},
+						{int64(2), "2"},
+						{float64(1.46), fractionalResult},
+						{[]byte("1.46"), fractionalResult + "0"},
+						{nil, "NULL"},
+					} {
+						var got sql.NullString
+						require.NoError(t, stmt.QueryRowContext(ctx, value.input, 1).Scan(&got), value)
+						gotString := "NULL"
+						if got.Valid {
+							gotString = got.String
+						}
+						require.Equal(t, value.want, gotString, value)
+					}
+				})
+				for _, shape := range []struct {
+					name  string
+					value string
+				}{
+					{"scalar", "(select ?)"},
+					{"derived", "x"},
+				} {
+					t.Run(tc.name+"/"+shape.name, func(t *testing.T) {
+						statement := "select cast(" + tc.fn + "(" + shape.value + ",1) as double)"
+						if shape.name == "derived" {
+							statement += " from (select ? x limit 1) d"
+						}
+						stmt, err := conn.PrepareContext(ctx, statement)
+						require.NoError(t, err)
+						defer stmt.Close()
+						var got sql.NullString
+						require.NoError(t, stmt.QueryRowContext(ctx, "1.46").Scan(&got))
+						require.Equal(t, fractionalResult, got.String)
+						tieStatement := "select cast(" + tc.fn + "(" + shape.value + ",0) as double)"
+						if shape.name == "derived" {
+							tieStatement += " from (select ? x limit 1) d"
+						}
+						tie, tieErr := conn.PrepareContext(ctx, tieStatement)
+						require.NoError(t, tieErr)
+						defer tie.Close()
+						require.NoError(t, tie.QueryRowContext(ctx, "2.5").Scan(&got))
+						if tc.name == "round" {
+							require.Equal(t, "3", got.String)
+						} else {
+							require.Equal(t, "2", got.String)
+						}
+						if shape.name == "derived" {
+							require.Error(t, stmt.QueryRowContext(ctx, "not-a-numbe
```

**File**: `pkg/frontend/computation_wrapper.go` (modified, +6/-1)
```diff
@@ -643,7 +643,12 @@ func (cwft *TxnComputationWrapper) Compile(any any, fill func(*batch.Batch, *per
 		*/
 	} else {
 		var planSnapshotTS *timestamp.Timestamp
-		if cwft.hasPlanSnapshotTS {
+		if cwft.preparedStmt != nil {
+			// Executable EXPLAIN uses the already bound prepared plan. Carry the
+			// binding's diagnostic proof and snapshot into Compile as EXECUTE does.
+			preparedExprRetry = cwft.preparedExecutionRetry()
+			planSnapshotTS = &cwft.preparedStmt.Ts
+		} else if cwft.hasPlanSnapshotTS {
 			planSnapshotTS = &cwft.planSnapshotTS
 		}
 		cwft.compile, err = createCompile(
```

**File**: `pkg/sql/plan/base_binder.go` (modified, +279/-1)
```diff
@@ -1211,7 +1211,7 @@ func (b *baseBinder) bindNumericExprWithContextMode(
 		defer func() { b.numericParamType = paramType }()
 		return b.impl.BindExpr(astExpr, depth, false)
 	}
-	if outer != nil && preparedSourceBindings(b.GetContext()) != nil {
+	if outer != nil && preparedSourceBindings(b.GetContext()) != nil && !functionTarget {
 		if _, direct := unwrapParenExpr(astExpr).(*tree.ParamExpr); direct {
 			// A bare assignment marker is a source value. Its destination cast
 			// must retain string bytes (not arithmetic numeric coercion).
@@ -1501,6 +1501,12 @@ func (b *baseBinder) numericAstTypesInternalWithHint(
 			return numericAstTypeScan{}, err
 		}
 		scan := numericAstTypedOperand(typ)
+		if _, direct := unwrapParenExpr(expr.Expr).(*tree.ParamExpr); direct {
+			// The cast owns the result domain. Looking at the marker's text
+			// spelling here would make a type-stable plan value dependent.
+			scan.hasParam, scan.hasParamRef = true, true
+			return scan, nil
+		}
 		// The explicit cast fixes the resulting type, but its source can still
 		// contain a prepared marker. Preserve that marker for callers that need
 		// to decide whether the value is execution-time supplied.
@@ -3211,6 +3217,28 @@ func (b *baseBinder) bindFuncExpr(astExpr *tree.FuncExpr, depth int32, isRoot bo
 	// the cached plan, and CHAR keeps a numeric context for prepared parameters
 	// without changing the ordinary string-prefix semantics of direct CHAR
 	// calls.
+	if b.builder != nil && (b.builder.isPrepareStatement || preparedSourceBindings(b.GetContext()) != nil) {
+		if (b.numericParamType == nil || b.ctx == nil || len(b.ctx.numericProjectionTypes) == 0) &&
+			isPreparedNumericPrecisionFunction(funcName, len(astExpr.Exprs)) &&
+			!isDirectExplicitNumericCast(astExpr.Exprs[0]) {
+			hasValueParam, err := b.hasPreparedNumericParamExprs(astExpr.Exprs[:1], depth)
+			if err != nil {
+				return nil, err
+			}
+			if hasValueParam {
+				return b.bindPreparedNumericPrecisionFuncExpr(funcName, astExpr.Exprs, depth, nil, -1)
+			}
+			if _, column := unwrapParenExpr(astExpr.Exprs[0]).(*tree.UnresolvedName); column {
+				value, bindErr := b.impl.BindExpr(astExpr.Exprs[0], depth, false)
+				if bindErr != nil {
+					return nil, bindErr
+				}
+				if pos, ok := b.preparedProjectedParamPosition(value); ok {
+					return b.bindPreparedNumericPrecisionFuncExpr(funcName, astExpr.Exprs, depth, value, pos)
+				}
+			}
+		}
+	}
 	if b.builder != nil && b.builder.isPrepareStatement {
 		// GET_LOCK distinguishes DECIMAL timeout conversion from DOUBLE. A bare
 		// marker has no source type at PREPARE time, so use the established
@@ -3256,6 +3284,139 @@ func (b *baseBinder) bindFuncExpr(astExpr *tree.FuncExpr, depth int32, isRoot bo
 	return expr, err
 }
 
+func isPreparedNumericPrecisionFunction(name string, argCount int) bool {
+	return (strings.EqualFold(name, "round") || strings.EqualFold(name, "truncate")) &&
+		(argCount == 1 || argCount == 2)
+}
+
+// bindPreparedNumericPrecisionFuncExpr keeps the value argument's overload
+// open until EXECUTE. ROUND and TRUNCATE also have an integer precision
+// argument, so only the value is bound in the deferred numeric domain.
+func (b *baseBinder) bindPreparedNumericPrecisionFuncExpr(
+	name string,
+	astArgs []tree.Expr,
+	depth int32,
+	projectedValue *Expr,
+	projectedPosition int32,
+) (*plan.Expr, error) {
+	if b.builder == nil || (!b.builder.isPrepareStatement && preparedSourceBindings(b.GetContext()) == nil) ||
+		!isPreparedNumericPrecisionFunction(name, len(astArgs)) {
+		return b.bindFuncExprImplByAstExpr(name, astArgs, depth)
+	}
+
+	doubleType := types.T_float64.ToType()
+	target := makePlan2Type(&doubleType)
+	hasExplicitFloatCast := containsExplicitFloatCast(astArgs[0])
+	var value *Expr
+	var err error
+	if projectedValue != nil {
+		value = projectedValue
+		if !b.builder.isPrepareStatement {
+			binding, bindingErr := preparedSourceBindingAt(b.GetContext(), int(projectedPosition+1))

```

**File**: `pkg/sql/plan/bind_context.go` (modified, +0/-1)
```diff
@@ -75,7 +75,6 @@ func NewBindContext(builder *QueryBuilder, parent *BindContext) *BindContext {
 		bc.snapshot = parent.snapshot
 		bc.remapOption = parent.remapOption
 		bc.numericCteByName = parent.numericCteByName
-		bc.assignmentIgnore = parent.assignmentIgnore
 		if len(parent.viewChain) > 0 {
 			bc.viewChain = append([]string{}, parent.viewChain...)
 		}
```

**File**: `pkg/sql/plan/bind_insert.go` (modified, +28/-21)
```diff
@@ -4697,7 +4697,7 @@ func (builder *QueryBuilder) initInsertReplaceStmt(bindCtx *BindContext, astRows
 		astSelect = astRows
 
 		subCtx := NewBindContext(builder, bindCtx)
-		subCtx.numericProjectionTypes = insertProjectionTypes(insertColumns, tableDef)
+		subCtx.numericProjectionTypes = insertProjectionTypes(insertColumns, tableDef, builder.isInsertIgnore)
 		lastNodeID, err = builder.bindSelect(astSelect, subCtx, false)
 		if err != nil {
 			return 0, nil, nil, -1, err
@@ -4711,7 +4711,7 @@ func (builder *QueryBuilder) initInsertReplaceStmt(bindCtx *BindContext, astRows
 		astSelect = selectImpl.Select
 
 		subCtx := NewBindContext(builder, bindCtx)
-		subCtx.numericProjectionTypes = insertProjectionTypes(insertColumns, tableDef)
+		subCtx.numericProjectionTypes = insertProjectionTypes(insertColumns, tableDef, builder.isInsertIgnore)
 		lastNodeID, err = builder.bindSelect(astSelect, subCtx, false)
 		if err != nil {
 			return 0, nil, nil, -1, err
@@ -5006,13 +5006,29 @@ func isNumericAssignmentTarget(typ Type) bool {
 	return makeTypeByPlan2Type(typ).IsNumeric()
 }
 
-func insertProjectionTypes(insertColumns []string, tableDef *plan.TableDef) []Type {
+// useNumericAssignmentContext keeps IGNORE conversion at the final assignment
+// cast. A destination hint must not insert an ordinary strict cast into its
+// source expression. Functions and aggregates establish their own numeric
+// consumer contexts independently.
+func useNumericAssignmentContext(typ Type, ignore bool) bool {
+	return isNumericAssignmentTarget(typ) && !(ignore && useIgnoreConversionAssignmentCast(typ))
+}
+
+func isPreparedAssignmentParam(builder *QueryBuilder, expr tree.Expr) bool {
+	if builder == nil || !builder.isReusablePlan() {
+		return false
+	}
+	_, ok := unwrapParenExpr(expr).(*tree.ParamExpr)
+	return ok
+}
+
+func insertProjectionTypes(insertColumns []string, tableDef *plan.TableDef, ignore bool) []Type {
 	// only numeric targets may seed the numeric assignment context; a zero
 	// Type keeps the projection binder on the default binding path
 	targets := make([]Type, len(insertColumns))
 	for i, column := range insertColumns {
 		typ := tableDef.Cols[tableDef.Name2ColIndex[column]].Typ
-		if isNumericAssignmentTarget(typ) {
+		if useNumericAssignmentContext(typ, ignore) {
 			targets[i] = typ
 		}
 	}
@@ -5490,7 +5506,7 @@ func (builder *QueryBuilder) buildValueScan(
 						valueBinder = funcBinder
 					}
 					boundWithNumericContext := false
-					if isNumericAssignmentTarget(col.Typ) {
+					if useNumericAssignmentContext(col.Typ, builder.isInsertIgnore) {
 						if builder.isPrepareStatement {
 							// Analyze prepared functions with the target-free binder. The
 							// explicit numeric context below supplies the assignment domain only
@@ -5505,21 +5521,12 @@ func (builder *QueryBuilder) buildValueScan(
 							if err != nil {
 								return 0, nil, err
 							}
-							// A bare marker is the source value of the assignment, not a
-							// numeric expression. Integer assignments must retain that source
-							// until execute-time numeric typing; IGNORE must retain TEXT
-							// until the outer cast_ignore runs. Otherwise the prepare-time
-							// numeric context creates an ordinary cast(? AS INT/DECIMAL), and
-							// malformed values fail before the IGNORE warning/adjustment mode
-							// is reached.  Keep numeric context for compound expressions such
-							// as ? + 1, whose operands genuinely need numeric binding.
-							directPreparedParam := false
-							if _, ok := unwrapParenExpr(r[i]).(*tree.ParamExpr); ok {
-								directPreparedParam = true
-							}
-							if scan.hasParam && !(directPreparedParam &&
-								(types.T(col.Typ.Id).IsInteger() || (builder.isInsertIgnore &&
-									useIgnoreConversionAssignmentCast(targetTyp.Typ)))) {
+							// The target type shapes compound numeric expressions, but a
+							// bare marker is still the assignment source. Preserve it for the
+							// final assi
```

---

### Incident Patch 6: `a36da7f7` (2026-09-29)
**Commit Message**: fix: restore prepared TPCC filter selectivity with per-binding proof (#29462)

## What type of PR is this?

- [x] BUG
- [x] Improvement
- [x] Test and CI
- [x] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #29429
Fixes #29463
Fixes #29464
Fixes #29465
Fixes #29469
Fixes #29470
Fixes #29473

Related: #28907 (existing JSON CONCAT report), #29471 (separate global
JSON CAST/assignment behavior) and #29476 (transient clean-startup IVF
placement failure). The latter two are not fixed here.

## What this PR does / why we need it:

### Root cause

#28851 (`a99db843c7b4630a86883addc9424433d93fc2d2`) protected conversion
diagnostics, but treated a prepared conversion that *might* diagnose as
unsafe for every execution. Integer parameters travel through TEXT
vectors and implicit CASTs. Excluding their predicates before binding
removed reader/block selectivity and prevented JOIN rewrites. Extra
execution work extended lock holding time; the reported lock waits were
a consequence.

The initial fix restored binding-specific proof, but retained late
parameter specialization and two execution templates. Review exposed an
existing correctness defect: specializing after composite-key low

**File**: `docs/design/prepared-filter-diagnostic-performance-review.md` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+# PR #29462 deep review record
+
+Updated: 2026-09-29. The original published head reviewed was `f5b8e9f33588f7e0c7945f305c7d2de2f901a1ae`; this record includes the subsequent source-binding rewrite. Merge base: `a543410f766d2f41237519ed7cc1376c31e03d99`. Current design: [prepared-filter-diagnostic-performance.md](prepared-filter-diagnostic-performance.md).
+
+The user authorized staged GPT-6 Astra / xhigh review. That reviewer approved source binding before optimization and a single runtime cache. The full implementation review found two concrete consumer bugs; both were corrected. Repeated two-CN BVT and performance acceptance passed on the previously reviewed head. Subsequent public-regression review found additional failures at `74d6811d3ddae92e1841efab3892bf841588e16f`; the earlier PASS does not cover the repair described below. New-head CI and a future merge result remain separate from local acceptance.
+
+## Public-regression repair after the prior PASS
+
+Unchanged public prepared-statement tests failed at `74d6811` and passed at merge base `a543410`. Failures included string-source numeric arithmetic, NULL/ANY relational materialization, YEAR→BIT stored-procedure assignment, and prepared-result presentation. The repair keeps NULL markers executable while giving physical result columns concrete types; preserves SQL EXECUTE's visible TEXT spelling without changing inner numeric consumers; applies source-specific casts only at the relevant consumer; and adds YEAR→BIT to the common cast path. It does not add a second execution path or cache. An independent GPT-6 Astra/high read-only review then found two further counterexamples: exact unsigned comparison of integral decimal/scientific string spellings and `CHAR` rounding of explicitly DOUBLE sources. Both received public-protocol regression tests and narrow fixes. The former casts the executable marker through exact DECIMAL before unsigned comparison; the latter restricts lexical inference to string sources. Rebinding from an inexact value/error back to an exact value is tested to challenge stale cache/proof state.
+
+## Change map
+
+| Closure | Contract / owner | Validation |
+| --- | --- | --- |
+| Source binding and keys | Original AST ordinals and actual source domains precede comparison/index lowering; parameters remain references | Typed planner, current-value executor, SQL and binary composite-key controls |
+| Diagnostic proof and optimizer | Each builder captures immutable candidates before rewrites; fresh proof on every cache hit; no child or previous execution can authorize another | Safe/unsafe/safe, guarded diagnostics, unrelated literal and row warnings |
+| Frontend cache and retry | One cache entry; compile success gates publication; retry rebinds and clears stale proof | Frontend full UT, failure/replacement and retry controls |
+| Reader/block/remote | Reusable source immutable; current raw selection renewed and folded at destination | Direct compiler safe/unsafe/safe yields 1/0/1 blocks and matching remote lists |
+| String and scalar consumers | Source metadata, numeric domain and width preserved before consumer selection | Typed and real protocol TIME, JSON, DECIMAL, CHAR, REGEXP and binary state controls |
+| JSON source protocol | Native JSON serialization and binary JSON_DEPTH inputs require v101 through placement, send, receive and persisted expression floor | Protocol boundary tests plus ordinary JSON column execution |
+| EXPLAIN | Common reusable optimizer and original parameter ordinals | `TestIssue26859BinaryPreparedExplain` passes through the current route |
+| Cleanup and engineering | Remove dual templates, late QUERY Fill and unused traits/proof owners | Deleted-test oracles mapped to current typed/retry/public execution tests |
+
+## Ownership and unhappy paths
+
+- A session's PrepareStmt owns one bounded runtime cache entry. Existing session serialization remains the synchronization boundary; no new workers, locks or
```

**File**: `docs/design/prepared-filter-diagnostic-performance.md` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+# Prepared 参数诊断与性能：根因和修复
+
+关联：[性能问题 #29429](https://github.com/matrixorigin/matrixone/issues/29429)、[修复 PR #29462](https://github.com/matrixorigin/matrixone/pull/29462)、[复合键语义问题 #29463](https://github.com/matrixorigin/matrixone/issues/29463)。
+
+## 根因
+
+引入提交为 `a99db843c7b4630a86883addc9424433d93fc2d2`（#28851），直接正常 parent 为 `1575e70c3db676d3ed00abc080aadc029b0e1435`。单 CN 即可复现。
+
+原修改要保证转换告警的执行所有权：下推、常量折叠和 JOIN 改写不能提前或重复发出告警，也不能激活空输入和未选中分支。Prepared 的整数参数经字符串向量传输，计划中同样有 implicit CAST，因此被 `MayDiagnoseStatementParameter` 覆盖。退化来自把 PREPARE 时的“可能产生诊断”直接当作本次 EXECUTE 的最终结论：
+
+1. reader/block 谓词在绑定和折叠前被排除，整数点查失去存储选择性。
+2. JOIN 的诊断屏障阻止关系改写，单独放行扫描不能恢复原计划。
+3. 扫描和中间结果增加，使持锁时间变长；锁等待是放大后的症状。
+4. 最初逐次重新规划虽恢复部分选择性，却增加 frontend CPU。静态 traits 的重复全计划遍历和 `serial(CAST(?), CAST(?))` 在两份模板中的重复隔离求值，又带来额外成本。
+
+## 执行契约
+
+### 计划、绑定与缓存
+
+- 参数化 QUERY 的正常执行和 compile retry 都从原始 AST 进入 `BuildPreparedExecutionPlan`。先绑定协议或 SQL 变量的真实源类型，再选择比较域、函数重载和键/索引改写；PREPARE 计划只承担未绑定阶段的检查，不作为执行后备模板。
+- 原 AST 的参数 ordinal 在优化前固定。执行表达式始终保留 ParamRef，当前值只供诊断探测及确实依赖值的配置消费者使用。
+- 每个 QueryBuilder 在关系改写前复制诊断候选并取得本次证明。子查询证明不能授权父查询；取消、资源和内部错误传播，探测 warning 不发送给客户端。实际 SQL 诊断保留原执行所有权。
+- SQL 优化完成后，非字符串源参数降成已有的 `CAST(TEXT ParamRef AS source)`，兼容旧 CN。字符串域直接保留参数引用及运行时来源元数据，避免额外 CAST 丢失字符/二进制语义。
+- 每个 PREPARE generation 只保留一个类型描述符键、绑定计划、优化前诊断副本和可复用 TP compile。命中时重新证明当前绑定；值相关配置、分页、percentile、EXPLAIN 不进入该缓存。不存在第二份优化模板或 QUERY late-Fill 后备入口。
+- 物理编译成功后才发布缓存；旧 compile 在本次 statement 清理后释放，避免清空共享 Process。schema retry 重建绑定和证明，错误路径恢复上下文。DDL/强制 SET 继续使用其原有物化入口。
+
+### 快速证明的边界
+
+成功的 `ParseExecuteData` 已把固定宽度整数解码成规范文本。直接 implicit `CAST(ParamRef AS integer)` 只在 SHORT/LONG/LONGLONG、目标同符号且不窄化时跳过隔离求值。目标范围以整数 OID 为准。NULL 也先检查来源与目标；long data 按参数位置排除。其他情况继续隔离求值。
+
+`serial`/`serial_full` 仅当每个分量都是上述直接 CAST 时使用同一证明。编码本身不产生 SQL 转换告警；执行仍构造键并传播资源错误。删除了协议解码后重复 parse/format 的校验，不再为手工伪造的“整数类型 + 非整数文本”重复建立协议校验层。
+
+### reader、block 与远端
+
+本次证明只授权登记的参数诊断，literal、row-scoped、volatile 诊断仍按原规则处理。普通 scan 可从获准的 reader 谓词补充可 zonemap 的 block 谓词；`blockFilter=2` 的规划决定保存在既有 `ExtraOptions` 中，非空特殊 scan options 不补全。
+
+可复用的 `Source.node` 保持不可变。`Source.remoteBlockFilters` 保存本次获准的原始谓词：nil 表示懒初始化尚未完成，非 nil 空列表表示本次全部排除。远端收到原始表达式，在自己的 Process 中折叠，不接收协调端 Fold ID。
+
+深审发现旧实现覆盖 `Source.node` 后，safe → unsafe → safe 的 block 数量为 1 → 0 → 0。直接 compiler 回归测试要求恢复为 1 → 0 → 1，并检查每步实际发送的远端列表。
+
+## 深审发现的语义错误
+
+### 复合键 #29463
+
+已在 PR 前的 `a99db843c7` 和 PR head 复现。优化器把分量比较合并为隐藏序列化键比较，随后参数特化错误地把内部编码传播到 DOUBLE 比较域，返回错误行。只阻止外层 DOUBLE 转换仍不充分：分量类型变化会改变编码，小数范围比较和再次绑定合法字符串仍可能错误。
+
+先前按协议类型禁用键改写、逐次重建的原型已撤回：干净 TPCC 实测为 1124.06 对 parent 5542.42 tpmC，无法验收。它还遗漏 VARCHAR 键绑定数值的比较域，不能作为系统性修复。
+
+当前实现将类型选择前移到 AST 表达式绑定：先以真实源类型解析比较，再由普通优化器决定键/索引改写。参数物理 TEXT 传输与 SQL 源类型分开；可复用规划全程保留引用，禁止先填字面量再试图恢复。整数窄化必须对完整来源类型域无损，值相关优化另需本次绑定的证明。不得在 `serial` 或索引规则中新增协议白名单。
+
+2026-09-28/29 GPT-6 Astra / xhigh 独立审查批准前置类型绑定和单缓存路线。frontend 迁移、整包 UT 和真实双 CN 复合键回归已通过；当前版本的重复双 CN BVT（500/500）与代码增量复审已通过，正式配对性能也已通过，结果见下文。`Expr.Typ` 保存 SQL 源类型，执行器复用已有 CAST 处理非字符串 TEXT 传输；不借用 `SyntaxExplicitCast` 或增加包装身份表。
+
+源 AST 的最大参数 ordinal 在 PREPARE 优化前固定，用它初始化归一化映射，优化删除一个参数不能移动剩余参数的执行槽。现有 `FillValues` 使用优化后的列坐标，不能直接搬到绑定阶段。
+
+执行入口遵循以下约束：
+
+- 每个 generation 只保留一个类型描述符键、优化计划、物理 compile 和优化前诊断表达式副本。每次命中重新证明本次绑定；不能只检查优化后仍然存在的谓词。
+- 源描述符来自协议解码或 SQL 变量的真实类型、字符串域及来源，不根据字符串数值前缀推断类型。SEND_LONG_DATA、typed/untyped NULL 和 BIT_COUNT 类型演进不能丢失。
+- 需要当前值才能确定类型或配置的消费者，在自己的绑定/编译阶段解析值。GENERATE_SERIES 的输出 schema 和 geometry SRID 必须在父表达式绑定前确定；percentile 配置在物理聚合编译时求值，不能复用旧物理配置。
+- 普通参数全程保留引用，禁止整条查询填字面量再恢复；失败构建和 schema retry 必须恢复上下文、保持原始 ordinal，并重新取得诊断证明。
+
+原型验证：键改写前的等值/范围/IN 类型域、非恒等参数布局、同一逻辑及物理计划连续换值、TIME/JSON/DECIMAL 比较、UPDATE 写入类型，以及执行器 NULL/掩码/错误后复用均通过。所属包 plan、colexec、parsers/tree 全量测试通过。这些证据不替代 frontend、真实协议和性能验收。
+
+回归 oracle 按 SQL 数值比较定义，包括键值 0、NULL、小数、字符串后缀、等值和范围；不能把旧版本的错误行/内部编码告警写进 golden。
+
+### 浮点协议比较 #29464
+
+普通整数列的 `k > ?` 绑定二进制 FLOAT 2.5，在 PR 前的 a99db843c7 上也会报 cast-to-int 错误。原执行入口只识别 text 比较特化，未识别 FLOAT。曾加入的 FLOAT 参数位置特例随上述原型一并撤回；当前方案在共同的类型绑定阶段修复，不能再增加独立类型分支。
+
+### prepared EXPLAIN
+
+原
```

**File**: `docs/design/temporal-compatibility.md` (modified, +15/-9)
```diff
@@ -287,15 +287,21 @@ including no-match and NULL-key cases. Empty input, inactive CASE, reset and
 free discard pending diagnostics. PERIOD's SQL wrong-arguments error may be
 deferred; cancellation, resource and internal errors remain immediate.
 
-After final parameter binding, isolated evaluation of relevant ON and filter
-operands can prove them diagnostic-free for the current execution. A successful
-proof permits an execution-local replan and physical hash JOIN selection,
-including guarded CASE/COALESCE expressions. Unrelated projection diagnostics
-do not invalidate that scoped proof. Active diagnostics and unproven operands
-retain the conservative plan; resource and internal failures terminate the
-execution. The proof reaches physical compilation and retry, and is renewed on
-each execution. Neither the proof nor the specialized plan is published into
-the reusable prepared-plan cache, and probing publishes no statement warning.
+Issue #29429's earlier execution-local replan and dual-template amendment were
+superseded by the source-domain binding route in #29462. The original PREPARE
+parameter ordinals are fixed before optimization; each QUERY execution and retry
+binds its actual SQL/protocol source types from the original AST before overload,
+comparison, key, and index lowering. Parameter references remain executable.
+Each builder captures diagnostic candidates before rewrites and proves the
+current binding afresh. Active or unproven diagnostics retain their original
+execution owner; cancellation, resource, and internal failures propagate.
+
+Each prepared generation may cache one bounded runtime plan/compile entry keyed
+by source metadata, with value-dependent configurations excluded. The proof is
+never cached. Compile success gates publication, and a displaced compile is
+released after statement cleanup. The current contract and revision-labelled
+performance evidence are in
+`docs/design/prepared-filter-diagnostic-performance.md`.
 
 Keeping all eligible hash keys avoids a potentially quadratic intermediate
 result when a prepared temporal key accompanies a duplicate key. The
```

**File**: `pkg/defines/const.go` (modified, +2/-1)
```diff
@@ -136,7 +136,8 @@ const (
 	MORPCVersion98     int64 = 98  // canonical FORMAT precision and MAKEDATE/MAKETIME integer signatures
 	MORPCVersion99     int64 = 99  // owner-atomic writer-fair row-lock admission
 	MORPCVersion100    int64 = 100 // on-demand View metadata column descriptions
-	MORPCLatestVersion       = MORPCVersion100
+	MORPCVersion101    int64 = 101 // JSON source domains for CONCAT and JSON_DEPTH
+	MORPCLatestVersion       = MORPCVersion101
 )
 
 // DefaultLockWaitTimeoutSeconds is shared by the frontend default and by
```

**File**: `pkg/embed/prepared_specialized_domains_test.go` (modified, +295/-3)
```diff
@@ -75,11 +75,291 @@ func TestPreparedSpecializedDomains(t *testing.T) {
 		exec(t, "create database review29349")
 		exec(t, "use review29349")
 		defer conn.ExecContext(context.Background(), "drop database review29349")
+		t.Run("unassigned_variable_alias", func(t *testing.T) {
+			exec(t, "set @alias_of_unassigned = @never_assigned")
+			require.Equal(t, [][]string{{"NULL"}}, query(t, "select @alias_of_unassigned"))
+		})
+		t.Run("numeric_aggregate_source_transitions", func(t *testing.T) {
+			exec(t, "prepare numeric_sum from 'select cast(sum(?) as signed)'")
+			defer conn.ExecContext(ctx, "deallocate prepare numeric_sum")
+			for _, tc := range []struct{ assignment, want string }{
+				{"2", "2"}, {"'2'", "2"}, {"null", "NULL"}, {"'abc'", "0"}, {"3", "3"},
+			} {
+				exec(t, "set @numeric_source = "+tc.assignment)
+				require.Equal(t, [][]string{{tc.want}}, query(t, "execute numeric_sum using @numeric_source"), tc.assignment)
+			}
+		})
+		t.Run("ntile_null_runtime_error", func(t *testing.T) {
+			exec(t, "create table ntile_source(id int)")
+			exec(t, "insert into ntile_source values (1),(2)")
+			exec(t, "prepare ntile_buckets from 'select ntile(?) over (order by id) from ntile_source'")
+			defer conn.ExecContext(ctx, "deallocate prepare ntile_buckets")
+			exec(t, "set @buckets = 2")
+			require.Equal(t, [][]string{{"1"}, {"2"}}, query(t, "execute ntile_buckets using @buckets"))
+			exec(t, "set @buckets = null")
+			rows, err := conn.QueryContext(ctx, "execute ntile_buckets using @buckets")
+			if rows != nil {
+				defer rows.Close()
+				for rows.Next() {
+				}
+				err = rows.Err()
+			}
+			require.ErrorContains(t, err, "ntile bucket count cannot be NULL")
+		})
+		t.Run("regexp_scalar_mixed_domain_reuse", func(t *testing.T) {
+			exec(t, "create table regexp_source(id int)")
+			exec(t, "insert into regexp_source values (1)")
+			exec(t, `prepare regexp_scalar from 'select regexp_instr(
+				(select ? from regexp_source limit 1),
+				(select ? from regexp_source limit 1), 2)'`)
+			defer conn.ExecContext(ctx, "deallocate prepare regexp_scalar")
+			exec(t, "set @subject=cast(_binary'中中' as varbinary(6)), @pattern=cast(_binary'中' as varbinary(3))")
+			require.Equal(t, [][]string{{"4"}}, query(t, "execute regexp_scalar using @subject,@pattern"))
+			exec(t, "set @subject='中中', @pattern='中'")
+			require.Equal(t, [][]string{{"2"}}, query(t, "execute regexp_scalar using @subject,@pattern"))
+			exec(t, "set @subject=cast(_binary'中中' as varbinary(6)), @pattern='中'")
+			require.Equal(t, [][]string{{"4"}}, query(t, "execute regexp_scalar using @subject,@pattern"))
+			exec(t, `prepare regexp_derived from 'select regexp_instr(
+				(select d.subject from (select ? as subject) d),
+				(select d.pattern from (select ? as pattern) d), 2)'`)
+			defer conn.ExecContext(ctx, "deallocate prepare regexp_derived")
+			exec(t, "set @subject=cast(_binary'中中' as varbinary(6)), @pattern=cast(_binary'中' as varbinary(3))")
+			require.Equal(t, [][]string{{"4"}}, query(t, "execute regexp_derived using @subject,@pattern"))
+			exec(t, "set @subject='中中', @pattern='中'")
+			require.Equal(t, [][]string{{"2"}}, query(t, "execute regexp_derived using @subject,@pattern"))
+		})
+		t.Run("date_interval_scale_reuse", func(t *testing.T) {
+			exec(t, "prepare date_interval from 'select date_add(''2026-01-01'', interval ? second)'")
+			defer conn.ExecContext(ctx, "deallocate prepare date_interval")
+			for _, tc := range []struct{ assignment, literal, want string }{
+				{"3", "3", ""},
+				{"'4'", "", "2026-01-01 00:00:04.000000"},
+				{"null", "", "NULL"},
+				{"5", "5", ""},
+			} {
+				exec(t, "set @interval_value = "+tc.assignment)
+				want := [][]string{{tc.want}}
+				if tc.literal != "" {
+					want = query(t, "select date_add('2026-01-01', interval "+tc.literal+" second)")
+				}
+				require.Equal(t, want, query(t, "execute date_interval using @interval_value"), tc.assignment)
+			}
+		})
+		t.Run("nested_decimal_comm
```

---

### Incident Patch 7: `e5f70bed` (2026-09-29)
**Commit Message**: fix(sql): preserve bound user-variable string domains (#29445)

## What type of PR is this?

- [x] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #27217. **This is the shared-user-variable prerequisite, not
the REGEXP implementation, and does not close the issue.**

## What this PR does / why we need it:

A directly referenced prepared user variable owns its binding, while
later SET statements supply its current value. CI exposed a flaw in the
first implementation: capturing the effective row domain by rewriting
Charset destroyed the variable's static identity.

This revision keeps two independent axes:

- **S:** the original bound static type, used by CHARSET/COLLATION and
static inference.
- **D:** the frozen runtime string-domain override, stored in
`VarRef.bound_string_domain` (tag 4).

For `SET @s = IF(false, X'ff', '你a')`, the existing MO contract remains
**binary/binary + 2/E4BDA0**. The three failing BVT expectations were
not changed. MySQL's different selected-row behavior (**4/E4**) is
explicitly outside this repair.

### Implementation and compatibility bounda

**File**: `docs/design/CLAUDE_USER_VARIABLE_BOUND_DOMAINS_29445_r3.md` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+# 用户变量双轴绑定合同 r3：PR #29445 的 CI 修复设计
+
+> 状态：具体设计已批准，进入实施。2026-09-28，用户在收到本稿及字段/迁移限制摘要后回复“go ahead”。批准快照 SHA-256：`04f9af860ef2e08cb40d09f9cd4fd380ae551c7c6043e487a2da719dc3af80ee`（添加本审批记录前）。这是本次具体方案的批准，不是借用先前的笼统继续授权。
+>
+> 本稿取代 r2 中“把有效求值域写进 Expr.Type.Charset”的实现选择，只覆盖共享用户变量前置修复。不是完整 REGEXP 设计的批准，也不关闭 #27217。
+
+## 1. 身份、范围和门禁
+
+- 实现 PR：https://github.com/matrixorigin/matrixone/pull/29445
+- 关联问题：https://github.com/matrixorigin/matrixone/issues/27217
+- 原 CI head：`d75b8498e06040a430ad29038376c119bf4755c3`。
+- 本次设计基线：合并 `mo/main@d99187d7b3bfda8744088b3ae8cf16739b690aa0` 后的 `3dfe05cd32904f62db948f126dee82b81670303b`。
+- 原前置修复曾按普通 bug fix 分类，不要求独立设计审批。**本次方案扩大到计划 schema 元数据和连接迁移行为，须重新审查这部分范围，不能沿用原豁免。**
+- 保持原有 SQL 功能、session 保存值和 marker 规则；不修改通用 CHARSET/COLLATION 函数、不增加 REGEXP 特判、不改变向量格式、catalog 格式或共享客户端结果序列化。
+- 本文明确需要确认的新边界：VarRef 一个独立字段；连接迁移对有冻结绑定的 prepared statement 采取拒绝迁移策略。不得无记录扩大为完整 prepared-state 迁移框架。
+
+## 2. 问题与证据
+
+### 2.1 已确认的 CI 回归
+
+Run `36397790774`、job `108851328976` 中，`dtype/binary_string_function_semantics.test` 只有三个失败：SET、SELECT INTO、prepared SET 产生的 selected-text 用户变量。
+
+```sql
+SET @s = IF(false, X'ff', '你a');
+SELECT CHARSET(@s), COLLATION(@s), CHAR_LENGTH(@s), HEX(LEFT(@s, 1));
+```
+
+| 观察 | CHARSET / COLLATION | CHAR_LENGTH / LEFT HEX |
+|---|---|---|
+| 仓库原 BVT 合同 | binary / binary | 2 / E4BDA0 |
+| 当前 PR 的 CI 实际结果 | utf8mb4 / utf8mb4_general_ci | 2 / E4BDA0 |
+| 独立 MySQL 8.4.10 实测 | binary / binary | 4 / E4 |
+
+仓库已有“静态共同类型”与“选中行求值域”两个轴。它在后两列上与 MySQL 不同，本文**保留这项既有测试合同，不声称本 PR 消除了这项 MySQL 差异**；不能将前两列的回归改成错误预期来让 CI 通过。
+
+原实现将已选中行的 text override 写入表达式静态 Charset，导致 CHARSET/COLLATION 再也看不到赋值时的 binary 静态身份。不能靠 OID 推回原身份：合法状态可以是 text OID + binary Charset。这已通过一次真实 BVT 否定；试探性 OID 特判已完全撤销，未 push。
+
+### 2.2 绑定代际，而非永远不允许重绑定
+
+新的独立 MySQL 8.4.10 证据 `CLAUDE_R3_ORACLE_27217.log`：
+
+```sql
+CREATE TABLE t(i INT);
+INSERT INTO t VALUES (1);
+SET @s = _binary'你';
+PREPARE p FROM 'SELECT CHARSET(@s), HEX(LEFT(@s,1)) FROM t';
+EXECUTE p;                       -- binary / E4
+SET @s = '你';
+EXECUTE p;                       -- binary / E4
+ALTER TABLE t ADD COLUMN j INT;
+EXECUTE p;                       -- utf8mb4 / E4BDA0
+```
+
+由此限定：普通重复 EXECUTE 不能受 SET 改变绑定；真正重新 PREPARE 或 schema 导致的自动 reprepare 建立新绑定代际。不能为“永久保存原变量类型”去干预既有 schema reprepare 机制。
+
+参考：MySQL 8.4 user variables 与 statement caching 文档，以及上述固定 8.4.10 的实测；MySQL 并不是 MO 现有 selected-row 扩展的依据，二者必须分开报告。
+
+- https://dev.mysql.com/doc/refman/8.4/en/user-variables.html
+- https://dev.mysql.com/doc/refman/8.4/en/statement-caching.html
+
+## 3. 不变量和首个 owner
+
+定义每一个已绑定字符串 VarRef 的合同为 `(S, D)`：
+
+- `S`：赋值静态类型的副本，包括 OID、Charset、Width 等；只归属该表达式，不写回 session。
+- `D`：绑定时冻结的 RuntimeStringDomain，取 INHERIT / TEXT / BINARY。INHERIT 相对于不变的 S，不意味着执行时重新读 session 域。
+- `V(t)`：执行时读取的最新 session 值；允许 SET 更新。
+
+不变量：
+
+1. 同一绑定代际求值使用 `S + D + V(t)`。SET 只影响 V(t)，不改变该表达式的 S/D。
+2. CHARSET/COLLATION 与静态结果推导只看 S；字符串行消费者使用 S 与 D 合成的有效域。
+3. 新 SQL / 新 PREPARE / 正式 reprepare 读取当时赋值的 S/D，旧 prepared 表达式不被回写。
+4. marker 仍走原 per-execution 参数域；数值、BIT/IsBin、参数来源 kind、JSON/array、系统变量按原路径处理。
+5. session 保存的值、类型和 runtime override 不被 binding 改写。
+6. DeepCopy、序列化、远端折叠不能丢掉任何一轴，也不能在复制或构造 executor 时重新向 session 取域。
+
+首个 owner 是 binder 创建的 VarRef；executor 只消费该快照，不拥有重新绑定权限。
+
+## 4. 方案比较
+
+| 方案 | 判断 |
+|---|---|
+| 继续改写 Type.Charset / 修改 BVT 前两列 | 丢失 S，已经证明错误，拒绝 |
+| CHARSET/COLLATION 或 REGEXP 根据变量来源特殊取 session 类型 | 多 owner、不稳定，旧语句会读到新赋值，拒绝 |
+| 全部用户变量只继承静态类型，不保留 selected-row 域 | 可以与本次 MySQL 三例一致，但会改变仓库既有行执行合同；不是本次选定方向 |
+| AuxId / Width / Scale / Charset 高位编码 D | 污染已有字段合同，复制/优化/协议难以验证，拒绝 |
+| executor 首次 Eval / 首次构造才捕获 D | 构造可能晚于 SET，每次 EXECUTE 也可能重新构造，不能证明绑定时冻结，拒绝 |
+| 复用 PreparedNumericMetadata.string_domain_source 放伪表达式 | 该字段已有真实来源表达式的重写语义；增加伪节点/额外读取，不如直接标注 owner，拒绝 |
+| **VarRef 一个明确的标量域字段，S 不变** | 最小可解释的双轴表示，选定 |
+
+## 5. 精确表示和行为
+
+### 5.1 计划 schema
+
+拟在 `proto/plan.proto` 的 `VarRef` 新增 tag 4：
+
+```protobuf
+uint32 bound_string_domain = 4;
+```
+
+明确编码，不借用其他字段，不依赖截断 uint8：
+
```

**File**: `pkg/frontend/computation_wrapper_test.go` (modified, +121/-0)
```diff
@@ -6543,6 +6543,127 @@ func TestInitExecuteStmtParamSpecializesCOMStmtBinaryFunction(t *testing.T) {
 	require.True(t, value.GetIsBinaryStringAt(0))
 }
 
+func TestPreparedUserVariableStringDomainIsBoundPerStatement(t *testing.T) {
+	for _, tc := range []struct {
+		name   string
+		typ    types.Type
+		domain types.RuntimeStringDomain
+		binary bool
+	}{
+		{"text", types.T_text.ToType(), types.RuntimeStringInherit, false},
+		{"binary", types.T_blob.ToType(), types.RuntimeStringInherit, true},
+		{"selected binary", types.T_text.ToType(), types.RuntimeStringBinary, true},
+		{"selected text", types.T_blob.ToType(), types.RuntimeStringText, false},
+		{"selected text on binary varchar", types.NewWithCharset(types.T_varchar, 8, 0, types.CharsetBinary), types.RuntimeStringText, false},
+		{"selected binary retains text collation", types.NewWithCharset(types.T_varchar, 8, 0, types.CharsetUTF8MB4Bin), types.RuntimeStringBinary, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			ses, scratch, cw, execCtx := newPreparedExecuteEnv(t, 124)
+			t.Cleanup(func() {
+				cw.proc.SetPrepareParams(nil)
+				scratch.Close()
+				ses.Close()
+			})
+			assign := func(typ types.Type, domain types.RuntimeStringDomain, value any) {
+				t.Helper()
+				require.NoError(t, ses.setUserDefinedVarWithTypeAndKindAndReplayability(
+					"bound_s", value, "", false,
+					plan.Type{Id: int32(typ.Oid), Charset: uint32(typ.Charset)},
+					vector.PrepareParamNone, false, domain))
+			}
+			bind := func() *plan.Plan {
+				t.Helper()
+				stmt := tree.NewPrepareString("bound_variable", "select char_length(@bound_s), hex(left(@bound_s,1)), ord(@bound_s), @bound_s+0, "+
+					"char_length(coalesce(@bound_s,NULL)), hex(left(case when @bound_s is null then null else @bound_s end,1)), "+
+					"charset(@bound_s), collation(@bound_s)")
+				defer stmt.Free()
+				prepared, err := buildPlan(execCtx.reqCtx, ses, ses.txnCompileCtx, stmt)
+				require.NoError(t, err)
+				return prepared.GetDcl().GetPrepare().Plan
+			}
+			check := func(p *plan.Plan, staticType types.Type, binary, isNull bool) {
+				t.Helper()
+				q := p.GetQuery()
+				projects := q.Nodes[q.Steps[len(q.Steps)-1]].ProjectList
+				require.Len(t, projects, 8)
+				for i, project := range projects {
+					func() {
+						executor, err := colexec.NewExpressionExecutor(cw.proc, project)
+						require.NoError(t, err)
+						defer executor.Free()
+						value, err := executor.Eval(cw.proc, []*batch.Batch{batch.EmptyForConstFoldBatch}, nil)
+						require.NoError(t, err)
+						require.Equal(t, isNull && i < 6, value.GetNulls().Contains(0))
+						if isNull && i < 6 {
+							return
+						}
+						switch i {
+						case 0, 4:
+							want := int64(1)
+							if binary {
+								want = 3
+							}
+							require.Equal(t, want, vector.GetFixedAtNoTypeCheck[int64](value, 0))
+						case 1, 5:
+							want := "E4BDA0"
+							if binary {
+								want = "E4"
+							}
+							require.Equal(t, want, value.GetStringAt(0))
+						case 2:
+							want := int64(0xe4bda0)
+							if binary {
+								want = 0xe4
+							}
+							require.Equal(t, want, vector.GetFixedAtNoTypeCheck[int64](value, 0))
+						case 3:
+							require.Equal(t, float64(0), vector.GetFixedAtNoTypeCheck[float64](value, 0))
+						case 6, 7:
+							want := "binary"
+							if types.StaticStringDomain(staticType) == types.StringDomainText {
+								want = "utf8mb4"
+								if i == 7 {
+									want = "utf8mb4_general_ci"
+									if staticType.Charset == types.CharsetUTF8MB4Bin {
+										want = "utf8mb4_bin"
+									}
+								}
+							}
+							require.Equal(t, want, value.GetStringAt(0))
+						}
+					}()
+				}
+			}
+
+			assign(tc.typ, tc.domain, "你")
+			first := bind()
+			original := first.String()
+			check(first, tc.typ, tc.binary, false)
+			opposite := types.T_blob.ToType()
+			if tc.binary {
+				opposite = types.T_text.ToType()
+			}
+			assign(opposite, types.RuntimeStringInherit, "你")
+			check(first, 
```

**File**: `pkg/frontend/prepared_variable_domain_migration_test.go` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+// Copyright 2026 Matrix Origin
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
+package frontend
+
+import (
+	"context"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/golang/mock/gomock"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
+	"github.com/matrixorigin/matrixone/pkg/container/batch"
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/container/vector"
+	"github.com/matrixorigin/matrixone/pkg/defines"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
+	"github.com/matrixorigin/matrixone/pkg/pb/query"
+	"github.com/matrixorigin/matrixone/pkg/sql/colexec"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/dialect/mysql"
+	"github.com/matrixorigin/matrixone/pkg/sql/parsers/tree"
+	"github.com/stretchr/testify/require"
+)
+
+func TestMigrateConnectionFromPreservesPreparedVariableBinding(t *testing.T) {
+	ses, scratch, cw, execCtx := newPreparedExecuteEnv(t, 125)
+	t.Cleanup(ses.Close)
+	staticType := plan.Type{Id: int32(types.T_varchar), Width: 8, Charset: uint32(types.CharsetBinary)}
+	require.NoError(t, ses.setUserDefinedVarWithTypeAndKindAndReplayability(
+		"bound_s", "你", "", false, staticType, vector.PrepareParamNone, false, types.RuntimeStringText))
+	stmt := tree.NewPrepareString("bound_migration", "select charset(@bound_s), char_length(coalesce(@bound_s, ?))")
+	defer stmt.Free()
+	p, err := buildPlan(execCtx.reqCtx, ses, ses.txnCompileCtx, stmt)
+	require.NoError(t, err)
+	parsed, err := mysql.Parse(execCtx.reqCtx, stmt.Sql, 1)
+	require.NoError(t, err)
+	prepared := &PrepareStmt{
+		Name: "bound_migration", Sql: stmt.Sql, PreparePlan: p, PrepareStmt: parsed[0],
+		NativeMode: ses.sqlModeHasMatrixOneNative(), protocolVersion: currentProtocolVersion(cw.proc),
+		proc: cw.proc, ParamTypes: []byte{byte(defines.MYSQL_TYPE_NULL), 0},
+		params: vector.NewVec(types.T_varchar.ToType()),
+	}
+	require.NoError(t, vector.AppendBytes(prepared.params, nil, true, cw.proc.Mp()))
+	require.NoError(t, ses.SetPrepareStmt(execCtx.reqCtx, prepared.Name, prepared))
+	rt := &Routine{mc: newMigrateController()}
+	rt.setSession(ses)
+	original := p.String()
+
+	for _, value := range []string{"你", "你好"} {
+		// Migration's current snapshot differs from the frozen row domain.
+		require.NoError(t, ses.setUserDefinedVarWithTypeAndKindAndReplayability(
+			"bound_s", value, "", false, staticType, vector.PrepareParamNone, false, types.RuntimeStringBinary))
+		resp := &query.MigrateConnFromResponse{}
+		err := rt.migrateConnectionFrom(resp)
+		require.True(t, moerr.IsMoErrCode(err, moerr.OkExpectedNotSafeToStartTransfer))
+		require.Empty(t, resp.PrepareStmts)
+		require.Equal(t, original, p.String())
+		require.True(t, rt.mc.tryBeginRequest(), "rejected migration must release request admission")
+		func() {
+			defer rt.mc.endRequest()
+			_, runtimePlan, executionStmt, _, owned, err := initExecuteStmtParam(execCtx, ses, cw, nil, prepared.Name)
+			require.NoError(t, err)
+			if owned {
+				defer executionStmt.Free()
+			}
+			q := runtimePlan.GetQuery()
+			projects := q.Nodes[q.Steps[len(q.Steps)-1]].ProjectList
+			for i, expr := range projects {
+				func() {
+					executor, err := colexec.NewExpressionExecutor(cw.proc, expr)
+					require.NoError(t, err)
+					defer executor.Free()
+					v, err := executor.Eval(cw.proc, []*batch.Batch{batch.EmptyForConstFoldBatch}, nil)
+					require.NoError(t, err)
+					if i == 0 {
+						require.Equal(t, "bina
```

**File**: `pkg/frontend/routine.go` (modified, +7/-0)
```diff
@@ -29,6 +29,7 @@ import (
 	"github.com/matrixorigin/matrixone/pkg/config"
 	"github.com/matrixorigin/matrixone/pkg/defines"
 	"github.com/matrixorigin/matrixone/pkg/logutil"
+	"github.com/matrixorigin/matrixone/pkg/pb/plan"
 	"github.com/matrixorigin/matrixone/pkg/pb/query"
 	"github.com/matrixorigin/matrixone/pkg/sql/plan/function"
 	"github.com/matrixorigin/matrixone/pkg/util/metric"
@@ -829,6 +830,12 @@ func (rt *Routine) migrateConnectionFromActionWithCapabilities(
 	resp.LastInsertIDExported = true
 	prepareStmts := ses.GetPrepareStmts()
 	for _, st := range prepareStmts {
+		// Migration replays SQL against the current assignment; it does not
+		// transfer this statement's original static type and row-domain binding.
+		// Keep the connection here until the statement is deallocated.
+		if plan.HasBoundStringVariable(st.PreparePlan) {
+			return moerr.GetOkExpectedNotSafeToStartTransfer()
+		}
 		// A server cursor retains its result and fetch offset only on this CN.
 		// Even an empty cursor remains fetchable until the client closes it.
 		if st.cursor != nil {
```

**File**: `pkg/pb/plan/bound_string_domain.go` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+// Copyright 2026 Matrix Origin
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
+package plan
+
+// HasBoundStringVariable reports whether an expression owner retains a frozen
+// user-variable row domain, including sources retained by folding/rewriting.
+// This is an admission check, not a validator: malformed nonzero bindings must
+// also prevent a lossy migration or remote handoff.
+func HasBoundStringVariable(owner any) bool {
+	found := false
+	var visit func(*Expr) error
+	visit = func(expr *Expr) error {
+		if expr.GetV().GetBoundStringDomain() != 0 {
+			found = true
+		}
+		// VisitExprTree covers executable children and folded literal sources,
+		// but not this planner-only provenance edge.
+		if source := expr.GetPreparedNumeric().GetStringDomainSource(); source != nil && !found {
+			return VisitExprTree(source, visit)
+		}
+		return nil
+	}
+	_ = VisitExpressionsInOwner(owner, func(root *Expr) error {
+		if found {
+			return nil
+		}
+		return VisitExprTree(root, visit)
+	})
+	return found
+}
```

---

### Incident Patch 8: `b06ff850` (2026-09-29)
**Commit Message**: fix(frontend): roll back failed branch hashmap spills (#29475)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Fixes #29252

## What this PR does / why we need it:

- Make each spill bucket append recover its previous file length,
segments, and counters on failure; reject reads if rollback itself
fails.
- Remove in-memory entries only after their bucket append succeeds, and
propagate spill I/O errors instead of treating them as allocator
capacity failures.
- Add deterministic regression tests for failed segment creation,
rollback into an existing segment, and poisoned-shard consumption.

Validation: `databranchutils` package tests and race tests, `go vet`,
and incremental `golangci-lint` pass.

Co-authored-by: mergify[bot] <37929162+mergify[bot]@users.noreply.github.com>

**File**: `pkg/frontend/databranchutils/branch_hashmap.go` (modified, +143/-29)
```diff
@@ -18,6 +18,7 @@ import (
 	"bufio"
 	"bytes"
 	"encoding/binary"
+	"errors"
 	"fmt"
 	"io"
 	"os"
@@ -388,6 +389,9 @@ func (bh *branchHashmap) flushPreparedEntries(shardEntries [][]int, chunk []prep
 	if totalBytes > 0 {
 		buf, deallocator, err = bh.allocateBuffer(uint64(totalBytes))
 		if err != nil {
+			if !moerr.IsMoErrCode(err, moerr.ErrMPoolCapacity) {
+				return err
+			}
 			if len(chunk) <= 1 {
 				if bh.strictCapacity {
 					return err
@@ -451,14 +455,24 @@ func (bh *branchHashmap) flushPreparedEntries(shardEntries [][]int, chunk []prep
 	}
 	defer bh.metaMu.RUnlock()
 
+	remaining := len(entries)
 	for idx, entryIdxs := range shardEntries {
 		if len(entryIdxs) == 0 {
 			continue
 		}
 		shard := bh.shards[idx]
 		shard.lock()
+		if shard.spill != nil && shard.spill.failed != nil {
+			err := shard.spill.failed
+			shard.unlock()
+			for i := 0; i < remaining; i++ {
+				block.release()
+			}
+			return err
+		}
 		for _, entryIdx := range entryIdxs {
 			shard.insertEntryLocked(entries[entryIdx])
+			remaining--
 		}
 		shard.unlock()
 		shardEntries[idx] = entryIdxs[:0]
@@ -563,6 +577,11 @@ func (bh *branchHashmap) PopByVectorsStream(keyVecs []*vector.Vector, removeAll
 		}
 		probesByShard[shard] = append(probesByShard[shard], probe)
 	}
+	for shard := range probesByShard {
+		if err := shard.spillFailure(); err != nil {
+			return 0, err
+		}
+	}
 
 	var totalRemoved int64
 	collectValues := fn != nil
@@ -571,6 +590,11 @@ func (bh *branchHashmap) PopByVectorsStream(keyVecs []*vector.Vector, removeAll
 			continue
 		}
 		shard.lock()
+		if shard.spill != nil && shard.spill.failed != nil {
+			err := shard.spill.failed
+			shard.unlock()
+			return int(totalRemoved), err
+		}
 		var removedTotal int64
 		finishShard := func() {
 			if removedTotal > 0 {
@@ -678,12 +702,24 @@ func (bh *branchHashmap) lookupByVectors(keyVecs []*vector.Vector, removeAll *bo
 		}
 		probesByShard[shard] = append(probesByShard[shard], probe)
 	}
+	if removeAll != nil {
+		for shard := range probesByShard {
+			if err := shard.spillFailure(); err != nil {
+				return nil, err
+			}
+		}
+	}
 
 	for shard, probes := range probesByShard {
 		if shard == nil {
 			continue
 		}
 		shard.lock()
+		if shard.spill != nil && shard.spill.failed != nil {
+			err := shard.spill.failed
+			shard.unlock()
+			return nil, err
+		}
 		var removedTotal int64
 		copyValues := removeAll != nil
 		for _, probe := range probes {
@@ -884,6 +920,11 @@ func (bh *branchHashmap) ForEachShardParallel(fn func(cursor ShardCursor) error,
 	if shardCount == 0 {
 		return nil
 	}
+	for _, shard := range bh.shards {
+		if err := shard.spillFailure(); err != nil {
+			return err
+		}
+	}
 
 	if parallelism <= 0 {
 		parallelism = runtime.NumCPU()
@@ -1255,6 +1296,15 @@ func (hs *hashShard) unlock() {
 	hs.mu.Unlock()
 }
 
+func (hs *hashShard) spillFailure() error {
+	hs.lock()
+	defer hs.unlock()
+	if hs.spill != nil {
+		return hs.spill.failed
+	}
+	return nil
+}
+
 func (hs *hashShard) beginIteration() {
 	hs.mu.Lock()
 	for hs.iterating {
@@ -1332,6 +1382,9 @@ func (hs *hashShard) popRowsByValueDuringIteration(hash uint64, key []byte, valu
 }
 
 func (hs *hashShard) popRowsUnsafe(hash uint64, key []byte, removeAll bool) ([][]byte, error) {
+	if hs.spill != nil && hs.spill.failed != nil {
+		return nil, hs.spill.failed
+	}
 	plan := newRemovalPlan(removeAll)
 	rows, removedBytes, removedCount := hs.mem.collect(hash, key, plan, true, true)
 	if removedBytes > 0 {
@@ -1355,6 +1408,9 @@ func (hs *hashShard) popRowsUnsafe(hash uint64, key []byte, removeAll bool) ([][
 }
 
 func (hs *hashShard) popRowsByValueUnsafe(hash uint64, key []byte, value []byte, removeAll bool) (int, error) {
+	if hs.spill != nil && hs.spill.failed != nil {
+		return 0, hs.spill.failed
+	}
 	matchValue := value
 	if removeAll && len(value) > 0 {
 		matchValue = make([]byte, len(value))
@@ -1394,29 +1450,46 @@ func (hs *hashShard) spillLocked(required uint64) (uint64, error) {
 	if err !=
```

**File**: `pkg/frontend/databranchutils/branch_hashmap_test.go` (modified, +151/-0)
```diff
@@ -19,6 +19,7 @@ import (
 	"fmt"
 	"math/rand"
 	"os"
+	"path/filepath"
 	"runtime"
 	"sync"
 	"sync/atomic"
@@ -302,6 +303,156 @@ func TestBranchHashmapSpillAndRetrieve(t *testing.T) {
 	}
 }
 
+func TestBranchHashmapFailedSpillDoesNotDuplicate(t *testing.T) {
+	var keys [][]byte
+	for i := 0; i < 10000 && len(keys) < 2; i++ {
+		key := []byte(fmt.Sprintf("k%04d", i))
+		if len(keys) == 0 || hashKey(key)%4 == hashKey(keys[0])%4 {
+			keys = append(keys, key)
+		}
+	}
+	require.Len(t, keys, 2)
+	values := [][]byte{[]byte("a"), []byte("b")}
+	initialSize := uint64(len(keys[0]) + len(values[0]) + len(keys[1]) + len(values[1]))
+	bhIface, err := NewBranchHashmap(
+		WithBranchHashmapAllocator(newLimitedAllocator(initialSize)),
+		WithBranchHashmapSpillRoot(t.TempDir()),
+		WithBranchHashmapShardCount(4),
+		WithBranchHashmapSpillBucketCount(1),
+		WithBranchHashmapSpillSegmentMaxBytes(uint64(spillEntryHeaderSize+len(keys[0])+len(values[0]))),
+		withBranchHashmapRawEncodedKeys(),
+	)
+	require.NoError(t, err)
+	bh := bhIface.(*branchHashmap)
+	t.Cleanup(func() { require.NoError(t, bh.Close()) })
+	initial := []preparedEntry{{key: keys[0], value: values[0]}, {key: keys[1], value: values[1]}}
+	require.NoError(t, bh.flushPreparedEntries(make([][]int, bh.shardCount), initial))
+	shard := bh.shards[int(hashKey(keys[0])%uint64(bh.shardCount))]
+	_, err = shard.ensureSpillStore()
+	require.NoError(t, err)
+	blockedPath := filepath.Join(shard.spillDir, "spill-b00000-000001.bin")
+	require.NoError(t, os.Mkdir(blockedPath, 0o700))
+
+	mp := mpool.MustNewZero()
+	t.Cleanup(func() { mpool.DeleteMPool(mp) })
+	trigger := buildInt64Vector(t, mp, []int64{999})
+	t.Cleanup(func() { trigger.Free(mp) })
+	require.Error(t, bh.PutByVectors([]*vector.Vector{trigger}, []int{0}))
+	require.Equal(t, int64(2), bh.ItemCount())
+	for i, key := range keys {
+		got, err := bh.GetByEncodedKey(key)
+		require.NoError(t, err)
+		require.Equal(t, [][]byte{values[i]}, got.Rows)
+	}
+
+	require.NoError(t, os.Remove(blockedPath))
+	require.NoError(t, bh.PutByVectors([]*vector.Vector{trigger}, []int{0}))
+	require.Equal(t, int64(3), bh.ItemCount())
+	for i, key := range keys {
+		got, err := bh.GetByEncodedKey(key)
+		require.NoError(t, err)
+		require.Equal(t, [][]byte{values[i]}, got.Rows)
+	}
+}
+
+func TestSpillStoreAppendEntriesRollbackExistingSegment(t *testing.T) {
+	store, err := newSpillStore(t.TempDir(), 1, 45)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, store.close()) })
+	first := spillEntry{hash: 1, key: []byte("k1"), value: []byte("a")}
+	require.NoError(t, store.appendEntries(0, []spillEntry{first}))
+	bucket := &store.buckets[0]
+	require.Len(t, bucket.segments, 1)
+	oldSize := bucket.segments[0].size
+	blockedPath := filepath.Join(store.dir, "spill-b00000-000001.bin")
+	require.NoError(t, os.Mkdir(blockedPath, 0o700))
+	next := []spillEntry{
+		{hash: 2, key: []byte("k2"), value: []byte("b")},
+		{hash: 3, key: []byte("k3"), value: []byte("c")},
+	}
+	require.Error(t, store.appendEntries(0, next))
+	require.Len(t, bucket.segments, 1)
+	require.Equal(t, oldSize, bucket.segments[0].size)
+	require.Equal(t, uint64(1), bucket.rowCount)
+	require.Equal(t, uint64(1), store.stats.spilledEntries)
+	info, err := os.Stat(bucket.segments[0].path)
+	require.NoError(t, err)
+	require.Equal(t, oldSize, info.Size())
+	var keys []string
+	var scratch []byte
+	require.NoError(t, store.scanBucket(0, scanReasonGet, &scratch, func(_ uint64, key, _ []byte, _ uint64) (bool, error) {
+		keys = append(keys, string(key))
+		return false, nil
+	}))
+	require.Equal(t, []string{"k1"}, keys)
+	require.NoError(t, os.Remove(blockedPath))
+	require.NoError(t, store.appendEntries(0, next))
+	keys = nil
+	require.NoError(t, store.scanBucket(0, scanReasonGet, &scratch, func(_ uint64, key, _ []byte, _ uint64) (bool, error) {
+		keys = append(keys, string(key))
+		return false, nil
+	}))
+	require.Equal(t, []string{"k1", "k2", "k3"}, keys)
+}
+
+func TestSpillS
```

---

### Incident Patch 9: `d5cc084c` (2026-09-29)
**Commit Message**: fix: make View metadata migration idempotent (#29468)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [x] Documentation
- [ ] Feature
- [x] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

Related to #29007 and #26227; intentionally does not auto-close either
issue.

This addresses a demonstrated migration-idempotency defect and adds
lifecycle evidence under the merged on-demand architecture. The obsolete
durable metadata recovery design is not reinstated; full mixed-binary
activation remains outside this PR.

## What this PR does / why we need it:

The 4.0.10 COLUMNS migration compares persisted `rel_createsql` with its
exact template. Its private subscription-view CTE used `SELECT mt.*`,
which CREATE VIEW correctly expanded and reformatted. Consequently, a
successful migration persisted a definition unequal to its own readiness
template and replay rebuilt the view.

- Replace that private star with the eight fields actually consumed
downstream. Keep authorization-before-APPLY, public column semantics,
protocol 100 gating, and exact readiness checks unchanged.
- Add 11 deterministic admission/readiness/failure scenarios and a
real-

**File**: `docs/design/CLAUDE_VIEW_METADATA_LIFECYCLE_CONFORMANCE_29007.md` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+# View 元数据：迁移幂等性、恢复与重启验证
+
+所属：#29007 / #26227。研究基线：`466eb8ff4f65752ad25d7e19274770459f5ef934`。
+本记录描述当前按需实现的修复与证据，不是 v2 激活批准，也不表示 #29007 的全部历史验收已完成。
+
+## 1. 范围与架构依据
+
+#29139 已合入按需描述器。对同一可见快照和绑定上下文，当前 View 列来自语义定义的绑定，而非持久派生列或恢复任务的完成状态。现有设计见 [按需设计](CLAUDE_20260922-view-metadata-on-demand.md)。
+
+#29007 的旧 `required generation → recovery COMPLETE → authority reopened` 序列不再是本任务的实现目标。用户在本次任务中明确同意按现有按需架构调查升级、恢复和兼容缺口，不重新引入旧恢复机制。
+
+完整 v2 合同及其独立审批记录在 [#29456 已审阅精确修订](https://github.com/ck89119/matrixone/blob/371e3c1761dab22dff95d0e830caab31aa46eeeb/docs/design/CLAUDE_20260922-view-metadata-on-demand.md)。该设计区分现有 A（protocol 100 / 4.0.10）与未来 B；本次不启动 B，不接管 #29437–#29444 的全部消费者迁移、性能预算或运行时退役。
+
+## 2. 已证实的缺陷与最小修复
+
+`v4_0_10` 使用持久 `rel_createsql == InformationSchemaColumnsDDL` 判定迁移已完成。这是精确 readiness 检查，不能以“包含新函数名”代替。
+
+旧模板的私有 `__mo_visible_subscription_views` CTE 使用 `SELECT mt.*`。真实 CREATE VIEW 会经 `stableViewSQLWithExpandedStars` 固化该投影并格式化整个 CREATE SQL。因此迁移成功后写入的 SQL 与迁移器自己的模板不同，重放 handler 会再次执行 DROP/CREATE；原来的内存测试直接返回模板字符串，没有覆盖这一点。
+
+真实存储回归先验证 CREATE 失败时 DROP 被回滚，再运行成功迁移；在修复前，持久定义精确相等断言失败。修复只将私有候选 CTE 改为显式投影下游使用的八个字段，保留原授权 predicate、APPLY、输出列及协议门禁。planner 冻结用户 View star 的规则不变。
+
+### 兼容边界
+
+- 不改变公共 I_S 字段、类型或权限规则，不新增协议、状态、锁、后台任务或缓存。
+- 不放松大小写兼容查找或精确定义判定。
+- 旧 4.0.10 模板仍语义可用，已完成升级的租户无需仅因 SQL 表示不同强制重迁移；这不是新能力激活，故不新增版本/offset。
+- 原迁移被重放时，旧表示会更新一次；新模板创建成功后精确匹配，后续重放不再 DDL。
+- 不移除共享 admission、持久表达式 floor、snapshot/账户锁或兼容 catalog 表。
+
+## 3. 变更与证据地图
+
+| 闭包 | 所有者 / 消费者 | 风险与测试 |
+| --- | --- | --- |
+| 私有候选显式投影 | sysview → bootstrap / frontend / subscription 行源 | R2；sysview 所属包、真实订阅 SQL、三处 SHOW CREATE 结果 |
+| 精确 readiness 与能力检查 | v4_0_10 → UpgradeEntry | 11 个确定性内存场景：all-old、mixed、all-new、空响应/RPC 错误、缺失目录、大小写、非精确定义、DROP/CREATE 错误、幂等 |
+| 真实迁移事务 | 既有 Subscription fixture / SQLExecutor | V58 → 注入 CREATE 失败 → 精确恢复 V58 → 成功提交 → 在禁止 CREATE 的 executor 下重放成功 |
+| 源表恢复、跨 CN、重启 | 既有独立 TwoCN fixture | 一表一行、直接和嵌套 View；两 CN 的 DESC/I_S/SELECT、CTAS、远端 prepared SHOW；物理源身份改变、View 身份不变；保留目录及 UUID 的整群停启 |
+| 公共 SQL 回归 | 既有 view BVT / mo-tester | 第二 session prepared SHOW 在源宽度 180→restore 120 后重绑定；I_S/CTAS 同为 120；snapshot 和数据库清理 |
+
+BVT 的结果是独立、明确的宽度/列定义预期；CTAS 是另一消费者，不以描述器生成期望值。原有权限、订阅及历史快照场景保留，不扩展 warning、UDF 或 charset/collation 兼容规则。
+
+测试成本：复用原双 CN fixture，不再建第二套集群；新增 restore/restart 后该测试 normal 从约 17 秒增至约 25 秒。整群重启用于实际目录持久化边界，不能由 mock 代替；这些数字不是产品性能基准。
+
+## 4. 验证记录
+
+执行环境：macOS arm64，Go 1.26.4（go.mod），原生库由当前 worktree 的 `make -j8 cgo` 构建，CGo 测试使用仓库 `mo-cgo-test`。静态检查使用 golangci-lint 2.6.2 / Go 1.26.4，与 CI 工具版本一致。
+
+2026-09-29 执行结果（全部为最终代码语义；后续仅更新文档）：
+
+| 检查 | 终态 / 说明 |
+| --- | --- |
+| 三个所属包 normal | `sysview`、`v4_0_10`、`tests/upgrade` 均 PASS；最终测试 helper 清理后再跑整个 upgrade 包，50.377 秒 PASS |
+| 精确回归选择 | 11 个 `TestColumnsUpgradeAdmission` 子场景、`TestViewDescriptionSubscription`（最终 1.42 秒）、`TestViewDescriptionTwoCN`（最终 normal 20.65 秒）均实际运行并 PASS |
+| 聚焦 race | `^TestViewDescriptionTwoCN$`，测量 T=28.57 秒，B=30 秒，N=1；最终 helper 下单独 `-race -count=1`，命名测试 30.28 秒 PASS，进程退出码 0 |
+| 修改生产语句覆盖 | `predefined.go:302–304` 是一个字符串拼接语句，所在 `282.50–310.2` 块的 10 个语句计数为 1；改动语句 1/1，即 100%，满足 ≥75%。sysview 全包为 69.0%，不混淆为全包达到 75% |
+| 静态检查 | Go 1.26.4 gofmt 无输出；增量 vet 退出码 0；golangci-lint 2.6.2：0 issues |
+| view BVT | mo-tester genrs 后正常比较 3 次，每次 42/42，零失败 |
+| SHOW BVT | `dml/show/show.test` 正常比较 2 次，每次 189/189，零失败 |
+| account BVT | `zz_accesscontrol/account_restricted.sql` 正常比较 2 次，每次 125 成功、1 个既有 ignored、零失败 |
+| teardown | view 两次复跑后立即检查数据库及 snapshot 均为 0；账户用例后相关账户为 0；独占服务收到 TERM 后退出 |
+
+upgrade 包中四个既有框架测试（`TestUpgradeFrameworkInit`、`TestUpgradeFrameworkInitWithHighVersion`、`TestUpgrade`、`TestUpgradeCrossVersions`）仍由原测试跳过；不将其计为本次升级矩阵的有效证据。新修改的命名测试均未跳过。生产没有新增共享状态或生命周期实现；两 CN 测试使用独立集群，race 针对新增停启步骤，不宣称全包 race。
+
+三处 SHOW CREATE 的 `.result` 只保留当前 COLUMNS 模板及返回字符串长度的生成变化，丢弃整文件 genrs 的无关漂移；完整原用例随后正常比较通过。view `.result` 保留 mo-tester 原生列分隔与末列空格，不手工改写预期。
+
+本地日志保留在工作区 `.claude-validation/`（不提交）：`owning-packages.json`、`upgrade-final.json`、`two-cn-race-final.json`、`sysview.c
```

**File**: `pkg/bootstrap/versions/v4_0_10/upgrade_test.go` (modified, +95/-0)
```diff
@@ -23,6 +23,7 @@ import (
 	"github.com/golang/mock/gomock"
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
 	"github.com/matrixorigin/matrixone/pkg/catalog"
+	"github.com/matrixorigin/matrixone/pkg/common/moerr"
 	"github.com/matrixorigin/matrixone/pkg/common/mpool"
 	"github.com/matrixorigin/matrixone/pkg/common/runtime"
 	"github.com/matrixorigin/matrixone/pkg/container/types"
@@ -44,6 +45,100 @@ func TestColumnsUpgradeMetadata(t *testing.T) {
 	require.Equal(t, uint32(1), m.VersionOffset)
 }
 
+// The migration must verify both the exact persisted definition and every CN's
+// capability before its first DDL. A protocol response is a component-level
+// oracle here, not a substitute for a real mixed-binary rollout test.
+func TestColumnsUpgradeAdmission(t *testing.T) {
+	const protocolSQL = "SELECT mo_ctl('cn', 'GetProtocolVersion', '')"
+	entry := upgradeInformationSchemaColumns()
+	injected := errors.New("injected upgrade failure")
+	for _, tc := range []struct {
+		name         string
+		definition   string
+		lowercase    bool
+		protocol     string
+		failSQL      string
+		wantDDL      []string
+		wantProtocol bool
+		wantErr      bool
+	}{
+		{name: "all old", protocol: `{"result":"cn0:99,cn1:99"}`, wantProtocol: true, wantErr: true},
+		{name: "mixed", protocol: `{"result":"cn0:100,cn1:99"}`, wantProtocol: true, wantErr: true},
+		{name: "no response", wantProtocol: true, wantErr: true},
+		{name: "RPC failure", failSQL: protocolSQL, wantProtocol: true, wantErr: true},
+		{name: "missing catalog", protocol: `{"result":"cn0:100,cn1:100"}`, wantProtocol: true,
+			wantDDL: []string{entry.PreSql, entry.UpgSql}},
+		{name: "legacy lowercase", definition: sysview.InformationSchemaColumnsV58DDL(), lowercase: true,
+			protocol: `{"result":"cn0:100,cn1:100"}`, wantProtocol: true,
+			wantDDL: []string{entry.PreSql, entry.UpgSql}},
+		{name: "marker is not exact readiness", definition: sysview.InformationSchemaColumnsDDL + " ",
+			protocol: `{"result":"cn0:100,cn1:100"}`, wantProtocol: true,
+			wantDDL: []string{entry.PreSql, entry.UpgSql}},
+		{name: "canonical uppercase", definition: sysview.InformationSchemaColumnsDDL},
+		{name: "canonical lowercase", definition: sysview.InformationSchemaColumnsDDL, lowercase: true},
+		{name: "drop failure", protocol: `{"result":"cn0:100,cn1:100"}`, failSQL: entry.PreSql,
+			wantProtocol: true, wantErr: true, wantDDL: []string{entry.PreSql}},
+		{name: "create failure", protocol: `{"result":"cn0:100,cn1:100"}`, failSQL: entry.UpgSql,
+			wantProtocol: true, wantErr: true, wantDDL: []string{entry.PreSql, entry.UpgSql}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			runtime.RunTest("", func(runtime.Runtime) {
+				operator := mock_frontend.NewMockTxnOperator(gomock.NewController(t))
+				operator.EXPECT().TxnOptions().Return(pbtxn.TxnOptions{}).AnyTimes()
+				mp := mpool.MustNewZero()
+				defer func() { require.Zero(t, mp.CurrNB()) }()
+				result := func(value string) executor.Result {
+					r := executor.NewMemResult([]types.Type{types.T_varchar.ToType()}, mp)
+					if value != "" {
+						r.NewBatchWithRowCount(1)
+						require.NoError(t, executor.AppendStringRows(r, 0, []string{value}))
+					}
+					return r.GetResult()
+				}
+				var ddl []string
+				var protocolCalls, definitionCalls int
+				txn := executor.NewMemTxnExecutor(func(sql string) (executor.Result, error) {
+					switch {
+					case strings.HasPrefix(sql, "SELECT tbl.rel_createsql"):
+						definitionCalls++
+						if tc.lowercase && strings.Contains(sql, "tbl.relname = 'COLUMNS'") {
+							return result(""), nil
+						}
+						return result(tc.definition), nil
+					case sql == protocolSQL:
+						protocolCalls++
+						require.Empty(t, ddl, "capability check must precede all DDL")
+					default:
+						ddl = append(ddl, sql)
+					}
+					if sql == tc.failSQL {
+						return executor.Result{}, injected
+					}
+					if sql == protocolSQL {
+						return result(tc.protocol), nil
+					}
+		
```

**File**: `pkg/tests/upgrade/view_description_test.go` (modified, +173/-13)
```diff
@@ -17,12 +17,14 @@ package upgrade
 import (
 	"context"
 	"database/sql"
+	"errors"
 	"fmt"
 	"strings"
 	"testing"
 	"time"
 
 	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions"
+	"github.com/matrixorigin/matrixone/pkg/bootstrap/versions/v4_0_10"
 	"github.com/matrixorigin/matrixone/pkg/catalog"
 	"github.com/matrixorigin/matrixone/pkg/container/vector"
 	"github.com/matrixorigin/matrixone/pkg/embed"
@@ -409,21 +411,130 @@ func TestViewDescriptionTwoCN(t *testing.T) {
 	require.NoError(t, err)
 	first := openViewDescriptionDB(t, cn0.GetServiceConfig().CN.Frontend.Port, "dump:111")
 	second := openViewDescriptionDB(t, cn1.GetServiceConfig().CN.Frontend.Port, "dump:111")
-	_, err = first.ExecContext(ctx, "create database view_description_two_cn")
-	require.NoError(t, err)
 	defer func() {
-		_, err := first.ExecContext(ctx, "drop database view_description_two_cn")
+		if first != nil {
+			require.NoError(t, first.Close())
+		}
+		if second != nil {
+			require.NoError(t, second.Close())
+		}
+	}()
+	exec := func(db *sql.DB, statement string) {
+		t.Helper()
+		_, err := db.ExecContext(ctx, statement)
+		require.NoError(t, err, statement)
+	}
+	exec(first, "create database view_description_two_cn")
+	defer func() {
+		// If restart failed, the isolated cluster owns the remaining catalog;
+		// do not issue cleanup SQL through a deliberately closed connection.
+		if first == nil {
+			return
+		}
+		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 30*time.Second)
+		defer cleanupCancel()
+		_, err := first.ExecContext(cleanupCtx, "drop snapshot if exists view_description_restore")
+		require.NoError(t, err)
+		_, err = first.ExecContext(cleanupCtx, "drop database view_description_two_cn")
 		require.NoError(t, err)
 	}()
-	_, err = first.ExecContext(ctx, "create table view_description_two_cn.src (x varchar(5))")
-	require.NoError(t, err)
-	_, err = first.ExecContext(ctx, "create view view_description_two_cn.v as select x from view_description_two_cn.src")
-	require.NoError(t, err)
-	_, err = first.ExecContext(ctx, "alter table view_description_two_cn.src modify column x varchar(60)")
-	require.NoError(t, err)
-	var width int
-	require.NoError(t, second.QueryRowContext(ctx, "select character_maximum_length from information_schema.columns where table_schema='view_description_two_cn' and table_name='v'").Scan(&width))
-	require.Equal(t, 60, width)
+	exec(first, "create table view_description_two_cn.src (x varchar(5))")
+	exec(first, "insert into view_description_two_cn.src values ('saved')")
+	exec(first, "create view view_description_two_cn.v as select x from view_description_two_cn.src")
+	exec(first, "create view view_description_two_cn.nested as select x from view_description_two_cn.v")
+	exec(first, "alter table view_description_two_cn.src modify column x varchar(60)")
+
+	checkShow := func(query func() (*sql.Rows, error), want string) {
+		t.Helper()
+		rows, err := query()
+		require.NoError(t, err)
+		defer rows.Close()
+		require.True(t, rows.Next())
+		var field, typ, nullable, key, defaultValue, extra, comment sql.NullString
+		require.NoError(t, rows.Scan(&field, &typ, &nullable, &key, &defaultValue, &extra, &comment))
+		require.Equal(t, "x", field.String)
+		require.Equal(t, want, typ.String)
+		require.False(t, rows.Next())
+		require.NoError(t, rows.Err())
+	}
+	check := func(width int, value string) {
+		t.Helper()
+		for _, db := range []*sql.DB{first, second} {
+			for _, name := range []string{"v", "nested"} {
+				var gotWidth int
+				require.NoError(t, db.QueryRowContext(ctx,
+					"select character_maximum_length from information_schema.columns "+
+						"where table_schema='view_description_two_cn' and table_name=? and column_name='x'", name).Scan(&gotWidth))
+				require.Equal(t, width, gotWidth)
+				checkShow(func() (*sql.Rows, error) {
+					return db.QueryContext(ctx, "desc view_description_two_cn."+name)
+				}, fmt.Sprintf("VARCHAR(%d)", width))
+				var gotValue strin
```

**File**: `pkg/util/sysview/predefined.go` (modified, +6/-1)
```diff
@@ -296,7 +296,12 @@ func informationSchemaCurrentColumnsDDL() string {
 	userView := "mt.relkind = 'v' AND mt.reldatabase NOT IN ('mo_catalog','information_schema','mysql','system','system_metrics','mo_task','mo_debug')"
 	// Restrict the left side of APPLY before describing publisher Views. A
 	// post-APPLY WHERE cannot prevent invisible Views from consuming budget.
-	prefix += ", __mo_visible_subscription_views AS (SELECT mt.* FROM mo_subscription_tables() mt WHERE mt.relkind = 'v' AND (" +
+	// Keep this projection explicit: CREATE VIEW freezes projection stars and
+	// reformats the entire definition. Upgrade readiness compares the persisted
+	// SQL with this template exactly, so a star would make every retry rebuild it.
+	prefix += ", __mo_visible_subscription_views AS (SELECT mt.account_id, mt.rel_id, mt.relname, " +
+		"mt.reldatabase, mt.relkind, mt.rel_createsql, mt.extra_info, mt.publisher_account_id " +
+		"FROM mo_subscription_tables() mt WHERE mt.relkind = 'v' AND (" +
 		informationSchemaSubscriptionViewAuthorizationPredicate() + ")) "
 	return prefix + local + " AND NOT (" + userView + ") UNION ALL " +
 		viewRows + " AND (" + userView + ") UNION ALL " + branches[1] +
```

**File**: `pkg/util/sysview/predefined_test.go` (modified, +4/-1)
```diff
@@ -380,7 +380,10 @@ func TestInformationSchemaSubscriptionMetadataDDL(t *testing.T) {
 	assert.NotContains(t, InformationSchemaTablesV41DDL, "mo_subscription_tables()")
 	assert.Equal(t, 1, strings.Count(InformationSchemaTablesV41DDL, "internal_auto_increment("))
 	assert.Contains(t, InformationSchemaColumnsDDL,
-		"__mo_visible_subscription_views AS (SELECT mt.* FROM mo_subscription_tables() mt WHERE mt.relkind = 'v' AND (")
+		"__mo_visible_subscription_views AS (SELECT mt.account_id, mt.rel_id, mt.relname, "+
+			"mt.reldatabase, mt.relkind, mt.rel_createsql, mt.extra_info, mt.publisher_account_id "+
+			"FROM mo_subscription_tables() mt WHERE mt.relkind = 'v' AND (")
+	assert.NotContains(t, InformationSchemaColumnsDDL, "mt.*", "migration must persist its exact readiness template")
 	assert.Contains(t, InformationSchemaColumnsDDL, "from __mo_visible_subscription_views mt cross apply "+
 		"mo_subscription_view_columns(mt.publisher_account_id, mt.rel_id)")
 	assert.Contains(t, InformationSchemaColumnsDDL, "mt.owner IN (SELECT role_id FROM __mo_active_roles)")
```

---

### Incident Patch 10: `21739819` (2026-09-29)
**Commit Message**: fix(vector): reject non-finite results from vector conversion functions (#29084) (#29340)

## What type of PR is this?

- [ ] API-change
- [x] BUG
- [ ] Improvement
- [ ] Documentation
- [ ] Feature
- [ ] Test and CI
- [ ] Code Refactoring

## Which issue(s) this PR fixes:

issue #29084

## What this PR does / why we need it:

Two vector conversion entry points skipped the finite check the text
cast and direct insert already enforce, letting `NaN`/`Inf` reach
`VECF32`/`VECF64` columns — where HNSW would index them while IVFFLAT
rejected the same data (inconsistent index-input boundaries):

1. **Vector-to-vector `CAST`** (`arrayToArray`, `func_cast.go`) narrows
through a float32 bridge without checking the result, so a finite source
could produce `+/-Inf` (`VECF64 1e300` → `VECF32`, or a `VECF32`
overflowing `VECF16`/`VECBF16`).
2. **`VEC*_FROM_BASE64`** (`VecFromBase64`, `func_unary.go`) validated
only base64 syntax and length, then stored the raw IEEE-754 bytes — a
`NaN`/`Inf` bit pattern decoded straight into a vector.

**Fix:** both call sites now invoke a shared
`rejectNonFiniteVectorElems` before storing, raising the canonical
`"vector element cannot be NaN or Inf: %v"` error.

**File**: `pkg/sql/plan/function/func_cast.go` (modified, +53/-0)
```diff
@@ -9604,6 +9604,53 @@ func blobToArray[T types.ArrayElement](
 	return nil
 }
 
+// rejectNonFiniteVectorElems rejects a converted or decoded vector whose float element(s) became
+// NaN or +/-Inf, applying the same finite check the text-to-vector path uses (types'
+// rejectNonFiniteArrayElem). It closes the vector-to-vector CAST narrowing and VEC*_FROM_BASE64
+// decode bypasses (#29084). Integer element targets clamp and can never be non-finite, so they are
+// skipped.
+func rejectNonFiniteVectorElems[T types.ArrayElement](out []T) error {
+	// x-x is 0 for every finite x and NaN for +Inf/-Inf/NaN alike (the metric.CheckFinite* test),
+	// catching NaN and Infinity in one comparison. Each element is tested in its NATIVE precision:
+	// narrowing a float64 to float32 first would turn a legitimately finite value (e.g. 1e300 in a
+	// VECF64) into a false +Inf. float16/bf16 have no native arithmetic, so they widen to float32
+	// (exact, preserving finiteness). Integer targets clamp and can never be non-finite -- skipped.
+	fail := func(d float64) error {
+		return moerr.NewInternalErrorNoCtxf("vector element cannot be NaN or Inf: %v", d)
+	}
+	switch v := any(out).(type) {
+	case []float32:
+		for _, x := range v {
+			if x-x != 0 {
+				return fail(float64(x))
+			}
+		}
+	case []float64:
+		for _, x := range v {
+			if x-x != 0 {
+				return fail(x)
+			}
+		}
+	case []types.Float16:
+		// Widen each element in place rather than materializing a whole []float32
+		// (types.ToFloat32Array allocates 4*dimension bytes per row on batch decode) (#29084).
+		for _, e := range v {
+			x := e.ToFloat32()
+			if x-x != 0 {
+				return fail(float64(x))
+			}
+		}
+	case []types.BF16:
+		for _, e := range v {
+			x := e.ToFloat32()
+			if x-x != 0 {
+				return fail(float64(x))
+			}
+		}
+	}
+	return nil
+}
+
 func arrayToArray[I types.ArrayElement, O types.ArrayElement](
 	_ context.Context,
 	from vector.FunctionParameterWrapper[types.Varlena],
@@ -9655,6 +9702,12 @@ func arrayToArray[I types.ArrayElement, O types.ArrayElement](
 			_v := types.BytesToArray[I](v)
 			f32 := types.ToFloat32Array[I](_v)
 			out := types.FromFloat32Array[O](f32)
+			// A finite source can narrow to +/-Inf (e.g. VECF64 1e300 -> VECF32, or a VECF32 that
+			// overflows VECF16/VECBF16). Reject it here so the narrowing CAST enforces the same
+			// finite bound as the text cast and direct insert, instead of persisting Infinity (#29084).
+			if err := rejectNonFiniteVectorElems(out); err != nil {
+				return err
+			}
 			bytes := types.ArrayToBytes[O](out)
 			if err := to.AppendBytes(bytes, false); err != nil {
 				return err
```

**File**: `pkg/sql/plan/function/func_nonfinite_29084_test.go` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+// Copyright 2026 Matrix Origin
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//      http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package function
+
+import (
+	"encoding/base64"
+	"math"
+	"testing"
+
+	"github.com/matrixorigin/matrixone/pkg/container/types"
+	"github.com/matrixorigin/matrixone/pkg/testutil"
+	"github.com/stretchr/testify/require"
+)
+
+// TestRejectNonFiniteVectorElems guards the shared finite check that closes both #29084 bypasses.
+// It must reject NaN/Inf for every float element type, pass finite vectors, and skip integer targets
+// (which clamp and can never be non-finite).
+func TestRejectNonFiniteVectorElems(t *testing.T) {
+	inf := float32(math.Inf(1))
+	nan := float32(math.NaN())
+
+	// float32
+	require.Error(t, rejectNonFiniteVectorElems([]float32{1, inf}))
+	require.Error(t, rejectNonFiniteVectorElems([]float32{nan, 1}))
+	require.NoError(t, rejectNonFiniteVectorElems([]float32{1, -2, 3}))
+
+	// float64
+	require.Error(t, rejectNonFiniteVectorElems([]float64{math.Inf(-1), 1}))
+	require.Error(t, rejectNonFiniteVectorElems([]float64{1, math.NaN()}))
+	require.NoError(t, rejectNonFiniteVectorElems([]float64{1e300, -1e300}))
+
+	// Float16 / BF16: non-finite is only reachable after narrowing, so build it that way.
+	require.Error(t, rejectNonFiniteVectorElems(types.FromFloat32Array[types.Float16]([]float32{inf})))
+	require.NoError(t, rejectNonFiniteVectorElems(types.FromFloat32Array[types.Float16]([]float32{1.5})))
+	require.Error(t, rejectNonFiniteVectorElems(types.FromFloat32Array[types.BF16]([]float32{nan})))
+	require.NoError(t, rejectNonFiniteVectorElems(types.FromFloat32Array[types.BF16]([]float32{1.5})))
+
+	// int8 / uint8 targets clamp and are skipped -- even a value derived from an overflow.
+	require.NoError(t, rejectNonFiniteVectorElems([]int8{-128, 127}))
+	require.NoError(t, rejectNonFiniteVectorElems([]uint8{0, 255}))
+}
+
+// TestRejectNonFiniteVectorElemsF16NoAlloc guards the #29084 P2 optimization: the F16/BF16 finite
+// check must widen each element in place (e.ToFloat32()) rather than materializing a whole []float32
+// per row (types.ToFloat32Array), which added 4*dimension bytes/row on batch CAST / VEC*_FROM_BASE64.
+func TestRejectNonFiniteVectorElemsF16NoAlloc(t *testing.T) {
+	f16 := types.FromFloat32Array[types.Float16](make([]float32, 1536))
+	bf16 := types.FromFloat32Array[types.BF16](make([]float32, 1536))
+	require.Zero(t, testing.AllocsPerRun(100, func() { _ = rejectNonFiniteVectorElems(f16) }),
+		"F16 finite check must not allocate a widened slice (#29084)")
+	require.Zero(t, testing.AllocsPerRun(100, func() { _ = rejectNonFiniteVectorElems(bf16) }),
+		"BF16 finite check must not allocate a widened slice (#29084)")
+}
+
+// TestCastArrayNarrowingRejectsNonFinite guards #29084 bypass 1: a vector-to-vector CAST that
+// narrows a finite source to +/-Inf must be rejected, not persist Infinity. Mirrors the direct text
+// cast, which already rejects the same value.
+func TestCastArrayNarrowingRejectsNonFinite(t *testing.T) {
+	proc := testutil.NewProcess(t)
+	vecf32 := func(w int32) types.Type { return types.New(types.T_array_float32, w, 0) }
+	vecf64 := func(w int32) types.Type { return types.New(types.T_array_float64, w, 0) }
+
+	t.Run("vecf64->vecf32 overflow rejected", func(t *testing.T) {
+		tc := NewFunctionTestCase(proc,
+			[]FunctionTestInput{
+				NewFunctionTestInput(vecf64(2), [][]float64{{1e300, -1e300}}, []bool{false}),
+				NewFunctionTestInput(vecf32(2), [][]float3
```

**File**: `pkg/sql/plan/function/func_unary.go` (modified, +7/-0)
```diff
@@ -9440,6 +9440,13 @@ func VecFromBase64[T types.ArrayElement](parameters []*vector.Vector, result vec
 			return moerr.NewInvalidInputNoCtxf("vec_from_base64: decoded length %d is not a multiple of %d bytes", n, elemSize)
 		}
 
+		// The payload is raw IEEE-754 bytes, so a NaN/Inf bit pattern would otherwise decode straight
+		// into a vector column, bypassing the finite check the text cast and direct insert enforce
+		// (#29084). Reject non-finite decoded elements before storing.
+		if err = rejectNonFiniteVectorElems(types.BytesToArray[T](buf[:n])); err != nil {
+			return err
+		}
+
 		if err = rs.AppendBytes(buf[:n], false); err != nil {
 			return err
 		}
```

**File**: `test/distributed/cases/vector/vector_nonfinite_conversion.result` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+drop database if exists vec_nonfinite;
+create database vec_nonfinite;
+use vec_nonfinite;
+select cast('[1e300,-1e300]' as vecf32(2));
+internal error: error while casting 1e300 to FLOAT
+select cast('[inf]' as vecf32(1));
+internal error: vector element cannot be NaN or Inf: +Inf
+select cast('[nan]' as vecf32(1));
+internal error: vector element cannot be NaN or Inf: NaN
+select cast(cast('[1e300,-1e300]' as vecf64(2)) as vecf32(2));
+internal error: vector element cannot be NaN or Inf: +Inf
+select cast(cast('[1e10,-1e10]' as vecf32(2)) as vecf16(2));
+internal error: vector element cannot be NaN or Inf: +Inf
+select cast(cast('[1e300,-1e300]' as vecf64(2)) as vecbf16(2));
+internal error: vector element cannot be NaN or Inf: +Inf
+select vecf32_from_base64('AACAfw==');
+internal error: vector element cannot be NaN or Inf: +Inf
+select vecf32_from_base64('AADAfw==');
+internal error: vector element cannot be NaN or Inf: NaN
+select vecf64_from_base64('AAAAAAAA8H8=');
+internal error: vector element cannot be NaN or Inf: +Inf
+select vecf64_from_base64('AAAAAAAA+H8=');
+internal error: vector element cannot be NaN or Inf: NaN
+select vecf16_from_base64('AHw=');
+internal error: vector element cannot be NaN or Inf: +Inf
+select vecf16_from_base64('AH4=');
+internal error: vector element cannot be NaN or Inf: NaN
+select vecbf16_from_base64('gH8=');
+internal error: vector element cannot be NaN or Inf: +Inf
+select vecbf16_from_base64('wH8=');
+internal error: vector element cannot be NaN or Inf: NaN
+create table src(id bigint primary key, v vecf64(2));
+insert into src values(1,'[1e300,-1e300]'),(2,'[3e38,-3e38]');
+create table inserted(id bigint primary key, v vecf32(2));
+insert into inserted select id, cast(v as vecf32(2)) from src;
+internal error: vector element cannot be NaN or Inf: +Inf
+select count(*) from inserted;
+➤ count(*)[-5,64,0]  𝄀
+0
+create table ctas as select id, cast(v as vecf32(2)) v from src;
+internal error: vector element cannot be NaN or Inf: +Inf
+create table altered like src;
+insert into altered select * from src;
+alter table altered modify column v vecf32(2);
+internal error: vector element cannot be NaN or Inf: +Inf
+create table b64_generated(
+id bigint primary key,
+payload varchar(32),
+v vecf32(1) as (vecf32_from_base64(payload)) stored
+);
+insert into b64_generated(id,payload) values(1,'AAAAQA==');
+update b64_generated set payload='AACAfw==' where id=1;
+internal error: vector element cannot be NaN or Inf: +Inf
+insert into b64_generated(id,payload) values(2,'AADAfw==');
+internal error: vector element cannot be NaN or Inf: NaN
+select id, v from b64_generated order by id;
+➤ id[-5,64,0]  ¦  v[12,1,0]  𝄀
+1  ¦  [2]
+select cast(cast('[3e38,-3e38]' as vecf64(2)) as vecf32(2)) finite_narrow;
+➤ finite_narrow[12,2,0]  𝄀
+[300000000000000000000000000000000000000, -300000000000000000000000000000000000000]
+select vecf32_from_base64('AAAAQA==') finite_b64_f32;
+➤ finite_b64_f32[12,65535,0]  𝄀
+[2]
+select vecf64_from_base64('nHUAiDzkN34=') finite_big_f64;
+➤ finite_big_f64[12,65535,0]  𝄀
+[1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000]
+drop database vec_nonfinite;
```

**File**: `test/distributed/cases/vector/vector_nonfinite_conversion.sql` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+-- #29084: vector conversion functions must not produce or persist non-finite (NaN/Inf) elements.
+-- Vector-to-vector CAST narrowing and VEC*_FROM_BASE64 decode both bypassed the finite check that
+-- the text cast and direct insert already enforce, letting Infinity/NaN reach VECF32/VECF64 columns
+-- (and HNSW). These now fail with the same "vector element cannot be NaN or Inf" error.
+drop database if exists vec_nonfinite;
+create database vec_nonfinite;
+use vec_nonfinite;
+
+-- Control: direct text-to-target cast already rejects non-finite (unchanged behavior).
+select cast('[1e300,-1e300]' as vecf32(2));
+select cast('[inf]' as vecf32(1));
+select cast('[nan]' as vecf32(1));
+
+-- Bypass 1: narrowing CAST through a legal intermediate must reject the overflow, not return Inf.
+select cast(cast('[1e300,-1e300]' as vecf64(2)) as vecf32(2));
+select cast(cast('[1e10,-1e10]' as vecf32(2)) as vecf16(2));
+select cast(cast('[1e300,-1e300]' as vecf64(2)) as vecbf16(2));
+
+-- Bypass 2: raw IEEE-754 base64 decode must reject NaN/Inf for every float element type.
+select vecf32_from_base64('AACAfw==');
+select vecf32_from_base64('AADAfw==');
+select vecf64_from_base64('AAAAAAAA8H8=');
+select vecf64_from_base64('AAAAAAAA+H8=');
+select vecf16_from_base64('AHw=');
+select vecf16_from_base64('AH4=');
+select vecbf16_from_base64('gH8=');
+select vecbf16_from_base64('wH8=');
+
+-- Persistence paths must all fail (nothing non-finite lands in a column).
+create table src(id bigint primary key, v vecf64(2));
+insert into src values(1,'[1e300,-1e300]'),(2,'[3e38,-3e38]');
+
+create table inserted(id bigint primary key, v vecf32(2));
+insert into inserted select id, cast(v as vecf32(2)) from src;
+select count(*) from inserted;
+
+create table ctas as select id, cast(v as vecf32(2)) v from src;
+
+create table altered like src;
+insert into altered select * from src;
+alter table altered modify column v vecf32(2);
+
+-- Generated column over the base64 decoder: update to +Inf and insert NaN must both fail.
+create table b64_generated(
+  id bigint primary key,
+  payload varchar(32),
+  v vecf32(1) as (vecf32_from_base64(payload)) stored
+);
+insert into b64_generated(id,payload) values(1,'AAAAQA==');
+update b64_generated set payload='AACAfw==' where id=1;
+insert into b64_generated(id,payload) values(2,'AADAfw==');
+select id, v from b64_generated order by id;
+
+-- Finite controls: narrowing within range, a finite base64 payload, and a finite VECF64 value that
+-- overflows float32 (1e300) but is valid in double -- the check runs in native precision, so it must
+-- decode, not falsely reject.
+select cast(cast('[3e38,-3e38]' as vecf64(2)) as vecf32(2)) finite_narrow;
+select vecf32_from_base64('AAAAQA==') finite_b64_f32;
+select vecf64_from_base64('nHUAiDzkN34=') finite_big_f64;
+
+drop database vec_nonfinite;
```

#### Recent Merged Pull Requests:
- **PR #29526** (2026-09-30): fix(cn): wait for admitted query inventory before SQL startup (@XuPeng-SH)
- **PR #29525** (2026-09-30): fix(plan): normalize native ranges and prune prepared rounding filters (@XuPeng-SH)
- **PR #29521** (2026-09-30): fix(sql): complete on-demand View metadata consumers and cache dependencies (@ck89119)
- **PR #29520** (2026-09-30): test: reduce race fixture work and strengthen regression coverage (@XuPeng-SH)
- **PR #29518** (2026-09-30): [4.2-dev] Backport #29513: composite range pruning and DECIMAL256 safety (@XuPeng-SH)
- **PR #29513** (2026-09-30): Optimize leading ranges on composite sort keys (@XuPeng-SH)
- **PR #29508** (2026-09-30): fix: preserve prepared ROUND and TRUNCATE value domains (@XuPeng-SH)
- **PR #29493** (2026-09-30): feat(vector): enable ANN indexes for scalar subquery vectors (@ck89119)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
