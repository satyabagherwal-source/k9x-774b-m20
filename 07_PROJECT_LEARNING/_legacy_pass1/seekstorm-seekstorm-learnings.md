# Forensic Learning Record (Deep Inspection): SeekStorm/SeekStorm

> **Canonical Artifact**: `07_PROJECT_LEARNING/seekstorm-seekstorm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SeekStorm/SeekStorm](https://github.com/SeekStorm/SeekStorm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:34:56.594Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SeekStorm/SeekStorm`
- **Description**: SeekStorm: vector & lexical search - in-process library & multi-tenancy server, in Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 1917 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `seekstorm/src/add_result.rs`
```
use ahash::AHashSet;
use smallvec::{SmallVec, smallvec};
use std::cmp::Ordering;

use crate::{
    geo_search::{decode_morton_2_d, euclidian_distance},
    index::{
        AccessType, CompressionType, FIELD_STOP_BIT_1, FIELD_STOP_BIT_2, FieldType,
        LexicalSimilarity, NgramType, NonUniquePostingListObjectQuery, PostingListObjectQuery,
        SPEEDUP_FLAG, STOP_BIT, Shard, get_document_length_compressed_mmap,
    },
    min_heap,
    search::{FilterSparse, Ranges, ResultType, SearchResult},
    utils::{
        read_f32, read_f64, read_i8, read_i16, read_i32, read_i64, read_u8, read_u16, read_u32,
        read_u64,
    },
};

pub(crate) const K: f32 = 1.2;
pub(crate) const B: f32 = 0.75;
pub(crate) const SIGMA: f32 = 0.0;

pub(crate) struct PostingListObjectSingle<'a> {
    pub rank_position_pointer_range: u32,
    pub pointer_pivot_p_docid: u16,
    pub byte_array: &'a [u8],
    pub p_docid: i32,
    pub idf: f32,

    pub idf_ngram1: f32,
    pub idf_ngram2: f32,
    pub idf_ngram3: f32,
    pub ngram_type: NgramType,
}

#[inline(always)]
pub(crate) fn get_next_position_singlefield(plo: &mut NonUniquePostingListObjectQuery) -> u32 {
    if plo.is_embedded {
        return plo.embedded_positions[plo.p_pos as usize];
    }

    if (plo.byte_array[plo.positions_pointer] & STOP_BIT) != 0 {
        let position = (plo.byte_array[plo.positions_pointer] & 0b0111_1111) as u32;
        plo.positions_pointer += 1;
        position
    } else if (plo.byte_array[plo.positions_pointer + 1] & STOP_BIT) != 0 {
        let position = ((plo.byte_array[plo.positions_pointer] as u32) << 7)
            | (plo.byte_array[plo.positions_pointer + 1] & 0b0111_1111) as u32;
        plo.positions_pointer += 2;
        position
    } else {
        let position = ((plo.byte_array[plo.positions_pointer] as u32) << 13)
            | ((plo.byte_array[plo.positions_pointer + 1] as u32) << 7)
            | (plo.byte_array[plo.positions_pointer + 2] & 0b0111_1111) as u32;
        plo.positions_pointer += 3;
        position
    }
}

#[inline(always)]
pub(crate) fn get_next_position_multifield(plo: &mut NonUniquePostingListObjectQuery) -> u32 {
    if plo.is_embedded {
        return plo.embedded_positions[if plo.p_field == 0 {
            plo.p_pos as usize
        } else {
            plo.field_vec[plo.p_field - 1].1 + plo.p_pos as usize
        }];
    }

    if (plo.byte_array[plo.positions_pointer] & STOP_BIT) != 0 {
        let position = (plo.byte_array[plo.positions_pointer] & 0b0111_1111) as u32;
        plo.positions_pointer += 1;
        position
    } else if (plo.byte_array[plo.positions_pointer + 1] & STOP_BIT) != 0 {
        let position = ((plo.byte_array[plo.positions_pointer] as u32) << 7)
            | (plo.byte_array[plo.positions_pointer + 1] & 0b0111_1111) as u32;
        plo.positions_pointer += 2;
        position
    } else {
        let position = ((plo.byte_array[plo.positions_pointer] as u32) << 13)
            | ((plo.byte_array[plo.positions_pointer + 1] as u32) << 7)
            | (plo.byte_array[plo.positions_pointer + 2] & 0b0111_1111) as u32;
        plo.positions_pointer += 3;
        position
    }
}

/// Post processing after AND intersection candidates have been found
/// Phrase intersection
/// BM25 ranking vs. seekstorm ranking (implicit phrase search, term proximity, field type boost, source reputation)
/// BM25 is default baseline in IR academics, but exhibits inferior relevance for practical use
#[allow(clippy::too_many_arguments)]
#[inline(always)]
pub(crate) fn add_result_singleterm_multifield(
    shard: &Shard,
    docid: usize,
    result_count: &mut i32,
    search_result: &mut SearchResult,

    top_k: usize,
    result_type: &ResultType,
    field_filter_set: &AHashSet<u16>,
    facet_filter: &[FilterSparse],

    plo_single: &PostingListObjectSingle,
    not_query_list: &mut [PostingListObjectQuery],
    block_score: f32,
) {
    if shard.indexed_field_vec.len() == 1 {
        add_result_singleterm_singlefield(
            shard,
            docid,
            result_count,
            search_result,
            top_k,
            result_type,
            field_filter_set,
            facet_filter,
            plo_single,
            not_query_list,
            block_score,
        );
        return;
    }

    if !shard.delete_hashset.is_empty() && shard.delete_hashset.contains(&docid) {
        return;
    }

    for plo in not_query_list.iter_mut() {
        if !plo.bm25_flag {
            continue;
        }

        let local_docid = docid & 0b11111111_11111111;

        match &plo.compression_type {
            CompressionType::Array => {
                while plo.p_docid < plo.p_docid_count
                    && (plo.p_docid == 0 || (plo.docid as usize) < local_docid)
                {
                    plo.docid = read_u16(
                        plo.byte_array,
                        plo.compressed_doc_id_range + (plo.p_docid << 1),
                    ) as i32;
                    plo.p_docid += 1;
                }
                if (plo.docid as usize) == local_docid {
                    return;
                }
            }
            CompressionType::Bitmap
                if (plo.byte_array[plo.compressed_doc_id_range + (local_docid >> 3)]
                    & (1 << (local_docid & 7)))
                    > 0 =>
            {
                return;
            }
            CompressionType::Rle => {
                if local_docid >= plo.docid as usize && local_docid <= plo.run_end as usize {
                    return;
                } else {
                    while (plo.p_run_sum as usize) + ((plo.p_run as usize - 2) >> 2)
                        < plo.p_docid_count
                        && local_docid > plo.run_end as usize
                    {
                        let startdocid = read_u16(
                            plo.byte_array,
                            plo.compressed_doc_id_range + plo.p_run as usize,
                        );
                        let runlength = read_u16(
                            plo.byte_array,
                            plo.compressed_doc_id_range + plo.p_run as usize + 2,
                        );
                        plo.docid = startdocid as i32;
                        plo.run_end = (startdocid + runlength) as i32;
                        plo.p_run_sum += runlength as i32;
                        plo.p_run += 4;

                        if local_docid >= startdocid as usize && local_docid <= plo.run_end as usize
                        {
                            return;
                        }
                    }
                }
            }
            _ => {}
        }
    }

    if !facet_filter.is_empty() && is_facet_filter(shard, facet_filter, docid) {
        return;
    };

    let mut field_vec: SmallVec<[(u16, usize); 2]> = SmallVec::new();
    let mut field_vec_ngram1: SmallVec<[(u16, usize); 2]> = SmallVec::new();
    let mut field_vec_ngram2: SmallVec<[(u16, usize); 2]> = SmallVec::new();
    let mut field_vec_ngram3: SmallVec<[(u16, usize); 2]> = SmallVec::new();

    match *result_type {
        ResultType::Count => {
            if !field_filter_set.is_empty() {
                decode_positions_singleterm_multifield(
                    shard,
                    plo_single,
                    &mut field_vec,
                    &mut field_vec_ngram1,
                    &mut field_vec_ngram2,
                    &mut field_vec_ngram3,
                );

                if field_vec.len() + field_filter_set.len() <= shard.indexed_field_vec.len() {
                    let mut match_flag = false;
                    for field in field_vec.iter() {
                        if field_filter_set.contains(&field.0) {
                            match_flag = true;
                        }
                    }
                    if !match_flag {
                        return;
                    }
                }
   
```

### Core Architecture Module: `seekstorm/src/clustering.rs`
```
use std::cmp::Ordering;

use itertools::Itertools;
use num::integer::Roots;
#[cfg(target_arch = "aarch64")]
use std::arch::aarch64::*;
#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

use crate::{
    index::{Clustering, Shard},
    vector::{Embedding, Quantization},
    vector_similarity::{
        QuerySimd, VectorSimilarity, similarity_embedding, similarity_embedding_simd,
    },
};

#[derive(Clone, Debug)]
pub(crate) struct Centroid {
    pub medoid_index: usize,
    pub child_count: usize,
    pub sum_vector: Vec<f32>,
    pub centroid: Embedding,
    pub medoid_index_new: usize,
    pub query_simd: QuerySimd,
    pub best_similarity: f32,
    pub has_changed: bool,
}

#[derive(Clone, Debug)]
pub(crate) struct Medoid {
    pub medoid_index: usize,
    pub child_count: usize,
}

#[derive(Clone, Copy)]
pub(crate) struct ClusterHeader {
    pub start_index: u32,
    pub child_count: u32,
}

#[derive(Clone)]
pub(crate) struct ParentMedoid {
    pub medoid_index: usize,
    pub is_medoid: bool,
    pub similarity: f32,

    pub doc_id: u16,
    pub field_id: u32,
    pub chunk_id: u32,
    pub embedding: Embedding,
    pub scale: f32,
    pub norm: f32,
    pub zero_point: i16,
    pub sum_q: i32,
}

#[cfg(target_arch = "x86_64")]
unsafe fn accumulate_f32_avx2(sum: &mut [f32], emb: &[f32]) {
    unsafe {
        let len = emb.len();

        let mut i = 0;
        while i + 32 <= len {
            let v0 = _mm256_loadu_ps(emb.as_ptr().add(i));
            let v1 = _mm256_loadu_ps(emb.as_ptr().add(i + 8));
            let v2 = _mm256_loadu_ps(emb.as_ptr().add(i + 16));
            let v3 = _mm256_loadu_ps(emb.as_ptr().add(i + 24));

            let s0 = _mm256_loadu_ps(sum.as_ptr().add(i));
            let s1 = _mm256_loadu_ps(sum.as_ptr().add(i + 8));
            let s2 = _mm256_loadu_ps(sum.as_ptr().add(i + 16));
            let s3 = _mm256_loadu_ps(sum.as_ptr().add(i + 24));

            _mm256_storeu_ps(sum.as_mut_ptr().add(i), _mm256_add_ps(s0, v0));
            _mm256_storeu_ps(sum.as_mut_ptr().add(i + 8), _mm256_add_ps(s1, v1));
            _mm256_storeu_ps(sum.as_mut_ptr().add(i + 16), _mm256_add_ps(s2, v2));
            _mm256_storeu_ps(sum.as_mut_ptr().add(i + 24), _mm256_add_ps(s3, v3));

            i += 32;
        }

        for j in i..len {
            *sum.get_unchecked_mut(j) += *emb.get_unchecked(j);
        }
    }
}

#[cfg(target_arch = "x86_64")]
unsafe fn accumulate_i8_avx2(sum: &mut [f32], emb: &[i8]) {
    unsafe {
        let len = emb.len();

        let mut i = 0;
        while i + 32 <= len {
            let bytes = _mm256_loadu_si256(emb.as_ptr().add(i) as *const __m256i);

            let low128 = _mm256_castsi256_si128(bytes);
            let high128 = _mm256_extracti128_si256(bytes, 1);

            let low_lo = _mm256_cvtepi8_epi32(low128);
            let low_hi = _mm256_cvtepi8_epi32(_mm_srli_si128(low128, 8));
            let high_lo = _mm256_cvtepi8_epi32(high128);
            let high_hi = _mm256_cvtepi8_epi32(_mm_srli_si128(high128, 8));

            let f0 = _mm256_cvtepi32_ps(low_lo);
            let f1 = _mm256_cvtepi32_ps(low_hi);
            let f2 = _mm256_cvtepi32_ps(high_lo);
            let f3 = _mm256_cvtepi32_ps(high_hi);

            let s0 = _mm256_loadu_ps(sum.as_ptr().add(i));
            let s1 = _mm256_loadu_ps(sum.as_ptr().add(i + 8));
            let s2 = _mm256_loadu_ps(sum.as_ptr().add(i + 16));
            let s3 = _mm256_loadu_ps(sum.as_ptr().add(i + 24));

            _mm256_storeu_ps(sum.as_mut_ptr().add(i), _mm256_add_ps(s0, f0));
            _mm256_storeu_ps(sum.as_mut_ptr().add(i + 8), _mm256_add_ps(s1, f1));
            _mm256_storeu_ps(sum.as_mut_ptr().add(i + 16), _mm256_add_ps(s2, f2));
            _mm256_storeu_ps(sum.as_mut_ptr().add(i + 24), _mm256_add_ps(s3, f3));

            i += 32;
        }

        for j in i..len {
            *sum.get_unchecked_mut(j) += emb.get_unchecked(j).to_owned() as f32;
        }
    }
}

#[cfg(target_arch = "x86_64")]
pub(crate) fn accumulate_avx2(sum: &mut [f32], emb: &Embedding) {
    match emb {
        Embedding::I8(emb) => unsafe { accumulate_i8_avx2(sum, emb) },
        Embedding::F32(emb) => unsafe { accumulate_f32_avx2(sum, emb) },
    }
}

#[cfg(target_arch = "aarch64")]
unsafe fn accumulate_f32_neon(sum: &mut [f32], emb: &[f32]) {
    unsafe {
        let len = emb.len();
        let mut i = 0;
        while i + 16 <= len {
            let v0 = vld1q_f32(emb.as_ptr().add(i));
            let v1 = vld1q_f32(emb.as_ptr().add(i + 4));
            let v2 = vld1q_f32(emb.as_ptr().add(i + 8));
            let v3 = vld1q_f32(emb.as_ptr().add(i + 12));
            let s0 = vld1q_f32(sum.as_ptr().add(i));
            let s1 = vld1q_f32(sum.as_ptr().add(i + 4));
            let s2 = vld1q_f32(sum.as_ptr().add(i + 8));
            let s3 = vld1q_f32(sum.as_ptr().add(i + 12));
            vst1q_f32(sum.as_mut_ptr().add(i), vaddq_f32(s0, v0));
            vst1q_f32(sum.as_mut_ptr().add(i + 4), vaddq_f32(s1, v1));
            vst1q_f32(sum.as_mut_ptr().add(i + 8), vaddq_f32(s2, v2));
            vst1q_f32(sum.as_mut_ptr().add(i + 12), vaddq_f32(s3, v3));
            i += 16;
        }
        for j in i..len {
            *sum.get_unchecked_mut(j) += *emb.get_unchecked(j);
        }
    }
}

#[cfg(target_arch = "aarch64")]
unsafe fn accumulate_i8_neon(sum: &mut [f32], emb: &[i8]) {
    unsafe {
        let len = emb.len();
        let mut i = 0;
        while i + 16 <= len {
            let bytes = vld1q_s8(emb.as_ptr().add(i));
            let lo_i16 = vmovl_s8(vget_low_s8(bytes));
            let hi_i16 = vmovl_s8(vget_high_s8(bytes));
            let lo_lo = vcvtq_f32_s32(vmovl_s16(vget_low_s16(lo_i16)));
            let lo_hi = vcvtq_f32_s32(vmovl_s16(vget_high_s16(lo_i16)));
            let hi_lo = vcvtq_f32_s32(vmovl_s16(vget_low_s16(hi_i16)));
            let hi_hi = vcvtq_f32_s32(vmovl_s16(vget_high_s16(hi_i16)));
            let s0 = vld1q_f32(sum.as_ptr().add(i));
            let s1 = vld1q_f32(sum.as_ptr().add(i + 4));
            let s2 = vld1q_f32(sum.as_ptr().add(i + 8));
            let s3 = vld1q_f32(sum.as_ptr().add(i + 12));
            vst1q_f32(sum.as_mut_ptr().add(i), vaddq_f32(s0, lo_lo));
            vst1q_f32(sum.as_mut_ptr().add(i + 4), vaddq_f32(s1, lo_hi));
            vst1q_f32(sum.as_mut_ptr().add(i + 8), vaddq_f32(s2, hi_lo));
            vst1q_f32(sum.as_mut_ptr().add(i + 12), vaddq_f32(s3, hi_hi));
            i += 16;
        }
        for j in i..len {
            *sum.get_unchecked_mut(j) += *emb.get_unchecked(j) as f32;
        }
    }
}

#[cfg(target_arch = "aarch64")]
pub(crate) fn accumulate_neon(sum: &mut [f32], emb: &Embedding) {
    match emb {
        Embedding::I8(emb) => unsafe { accumulate_i8_neon(sum, emb) },
        Embedding::F32(emb) => unsafe { accumulate_f32_neon(sum, emb) },
    }
}

#[inline(always)]
pub(crate) fn accumulate_simd(sum: &mut [f32], emb: &Embedding) {
    #[cfg(target_arch = "x86_64")]
    {
        accumulate_avx2(sum, emb)
    }
    #[cfg(target_arch = "aarch64")]
    {
        accumulate_neon(sum, emb)
    }
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        accumulate(sum, emb)
    }
}

pub(crate) fn accumulate(sum: &mut [f32], emb: &Embedding) {
    match emb {
        Embedding::I8(emb) => sum
            .iter_mut()
            .zip(emb.iter())
            .for_each(|(a, b)| *a += *b as f32),
        Embedding::F32(emb) => sum.iter_mut().zip(emb.iter()).for_each(|(a, b)| *a += *b),
    }
}

impl Shard {
    /// cluster the vectors in the block_vector_buffer, and return the medoids
    pub(crate) async fn cluster_vector_shard(&mut self, sort: bool) -> Vec<Medoid> {
        let non_affine = self.max_vector_value == f32::MIN;

        let vector_count_block = self.block_vector_buffer.len();

        let cluster_number = match self.meta.clustering {
            Clustering::Auto => (vector_count_block.sqrt() * 2).max(1),
            Clu
```

### Core Architecture Module: `seekstorm/src/commit.rs`
```
use memmap2::{Mmap, MmapMut, MmapOptions};
use num::FromPrimitive;
use num_format::{Locale, ToFormattedString};
use std::{
    fs::File,
    io::{Seek, SeekFrom, Write},
    path::Path,
};
use tokio::task::JoinSet;

use crate::{
    add_result::{
        B, K, decode_positions_multiterm_multifield, decode_positions_multiterm_singlefield,
        get_next_position_multifield, get_next_position_singlefield,
    },
    compatible::{_blsr_u64, _mm_tzcnt_64},
    compress_postinglist::compress_postinglist,
    index::{
        AccessType, BlockObjectIndex, CompressionType, DOCUMENT_LENGTH_COMPRESSION,
        FACET_VALUES_FILENAME, IndexArc, LevelIndex, MAX_POSITIONS_PER_TERM, NgramType,
        NonUniquePostingListObjectQuery, POSTING_BUFFER_SIZE, PostingListObjectIndex,
        PostingListObjectQuery, ROARING_BLOCK_SIZE, Shard, TermObject,
        update_list_max_impact_score, warmup,
    },
    utils::{
        block_copy, block_copy_mut, read_u8, read_u16, read_u32, read_u64, write_u16, write_u32,
        write_u64,
    },
};

/// Commit moves indexed documents from the intermediate uncompressed data structure (array lists/HashMap, queryable by realtime search) in RAM
/// to the final compressed data structure (roaring bitmap) on Mmap or disk -
/// which is persistent, more compact, with lower query latency and allows search with realtime=false.
/// Commit is invoked automatically each time 64K documents are newly indexed **per shard** as well as on close_index (e.g. server quit).
/// There is no way to prevent this automatic commit by not manually invoking it.
/// But commit can also be invoked manually at any time at any number of newly indexed documents.
/// commit is a **hard commit** for persistence on disk. A **soft commit** for searchability
/// is invoked implicitly with every index_doc,
/// i.e. the document can immediately searched and included in the search results
/// if it matches the query AND the query parameter realtime=true is enabled.
/// **Use commit with caution, as it is an expensive operation**.
/// **Usually, there is no need to invoke it manually**, as it is invoked automatically every 64k documents **per shard** and when the index is closed with close_index.
/// Before terminating the program, always call close_index (commit), otherwise all documents indexed since last (manual or automatic) commit are lost.
/// There are only 2 reasons that justify a manual commit:
/// 1. if you want to search newly indexed documents without using realtime=true for search performance reasons or
/// 2. if after indexing new documents there won't be more documents indexed (for some time),
///    so there won't be (soon) a commit invoked automatically at the next 64k threshold **per shard** or close_index,
///    but you still need immediate persistence guarantees on disk to protect against data loss in the event of a crash.
#[allow(async_fn_in_trait)]
pub trait Commit {
    /// Commit moves indexed documents from the intermediate uncompressed data structure (array lists/HashMap, queryable by realtime search) in RAM
    /// to the final compressed data structure (roaring bitmap) on Mmap or disk -
    /// which is persistent, more compact, with lower query latency and allows search with realtime=false.
    /// Commit is invoked automatically each time 64K documents are newly indexed **per shard** as well as on close_index (e.g. server quit).
    /// There is no way to prevent this automatic commit by not manually invoking it.
    /// But commit can also be invoked manually at any time at any number of newly indexed documents.
    /// commit is a **hard commit** for persistence on disk. A **soft commit** for searchability
    /// is invoked implicitly with every index_doc,
    /// i.e. the document can immediately searched and included in the search results
    /// if it matches the query AND the query parameter realtime=true is enabled.
    /// **Use commit with caution, as it is an expensive operation**.
    /// **Usually, there is no need to invoke it manually**, as it is invoked automatically every 64k documents **per shard** and when the index is closed with close_index.
    /// Before terminating the program, always call close_index (commit), otherwise all documents indexed since last (manual or automatic) commit are lost.
    /// There are only 2 reasons that justify a manual commit:
    /// 1. if you want to search newly indexed documents without using realtime=true for search performance reasons or
    /// 2. if after indexing new documents there won't be more documents indexed (for some time),
    ///    so there won't be (soon) a commit invoked automatically at the next 64k threshold **per shard** or close_index,
    ///    but you still need immediate persistence guarantees on disk to protect against data loss in the event of a crash.
    async fn commit(&self);
}

/// Commit moves indexed documents from the intermediate uncompressed data structure (array lists/HashMap, queryable by realtime search) in RAM
/// to the final compressed data structure (roaring bitmap) on Mmap or disk -
/// which is persistent, more compact, with lower query latency and allows search with realtime=false.
/// Commit is invoked automatically each time 64K documents are newly indexed **per shard** as well as on close_index (e.g. server quit).
/// There is no way to prevent this automatic commit by not manually invoking it.
/// But commit can also be invoked manually at any time at any number of newly indexed documents.
/// commit is a **hard commit** for persistence on disk. A **soft commit** for searchability
/// is invoked implicitly with every index_doc,
/// i.e. the document can immediately searched and included in the search results
/// if it matches the query AND the query parameter realtime=true is enabled.
/// **Use commit with caution, as it is an expensive operation**.
/// **Usually, there is no need to invoke it manually**, as it is invoked automatically every 64k documents **per shard** and when the index is closed with close_index.
/// Before terminating the program, always call close_index (commit), otherwise all documents indexed since last (manual or automatic) commit are lost.
/// There are only 2 reasons that justify a manual commit:
/// 1. if you want to search newly indexed documents without using realtime=true for search performance reasons or
/// 2. if after indexing new documents there won't be more documents indexed (for some time),
///    so there won't be (soon) a commit invoked automatically at the next 64k threshold **per shard** or close_index,
///    but you still need immediate persistence guarantees on disk to protect against data loss in the event of a crash.
impl Commit for IndexArc {
    /// Commit moves indexed documents from the intermediate uncompressed data structure (array lists/HashMap, queryable by realtime search) in RAM
    /// to the final compressed data structure (roaring bitmap) on Mmap or disk -
    /// which is persistent, more compact, with lower query latency and allows search with realtime=false.
    /// Commit is invoked automatically each time 64K documents are newly indexed **per shard** as well as on close_index (e.g. server quit).
    /// There is no way to prevent this automatic commit by not manually invoking it.
    /// But commit can also be invoked manually at any time at any number of newly indexed documents.
    /// commit is a **hard commit** for persistence on disk. A **soft commit** for searchability
    /// is invoked implicitly with every index_doc,
    /// i.e. the document can immediately searched and included in the search results
    /// if it matches the query AND the query parameter realtime=true is enabled.
    /// **Use commit with caution, as it is an expensive operation**.
    /// **Usually, there is no need to invoke it manually**, as it is invoked automatically every 64k documents **per shard** and when the index is closed with close_index.
    /// Before terminating the progra
```

### Core Architecture Module: `seekstorm/src/compatible.rs`
```
#[cfg(target_arch = "x86_64")]
pub use std::arch::x86_64::{_blsr_u64, _lzcnt_u32, _mm_tzcnt_64};

#[cfg(not(target_arch = "x86_64"))]
pub unsafe fn _mm_tzcnt_64(x: u64) -> i64 {
    x.trailing_zeros() as i64
}

#[cfg(not(target_arch = "x86_64"))]
pub unsafe fn _blsr_u64(x: u64) -> u64 {
    if x == 0 {
        x
    } else {
        x & (!(1 << x.trailing_zeros()))
    }
}

#[cfg(not(target_arch = "x86_64"))]
pub unsafe fn _lzcnt_u32(x: u32) -> u32 {
    x.leading_zeros()
}

```

### Core Architecture Module: `seekstorm/src/compress_postinglist.rs`
```
use std::cmp;

use smallvec::SmallVec;

use crate::{
    add_result::{B, K, SIGMA, decode_positions_commit},
    compatible::_lzcnt_u32,
    index::{
        AccessType, CompressionType, DOCUMENT_LENGTH_COMPRESSION, LexicalSimilarity, NgramType,
        STOP_BIT, Shard, hash32, hash64, int_to_byte4,
    },
    search::decode_posting_list_count,
    utils::{
        block_copy, read_u16_ref, read_u32_ref, write_u8_ref, write_u16, write_u16_ref,
        write_u32_ref, write_u64_ref,
    },
};

/// Compress a single postinglist using roaring bitmaps compression for docid https://roaringbitmap.org/about/
pub(crate) fn compress_postinglist(
    shard: &mut Shard,
    key_head_pointer_w: &mut usize,
    roaring_offset: &mut usize,
    key_body_offset: u32,
    key0: &usize,
    key_hash: &u64,
) -> usize {
    let mut posting_count_ngram_1 = 0;
    let mut posting_count_ngram_2 = 0;
    let mut posting_count_ngram_3 = 0;
    let mut posting_count_ngram_1_compressed = 0;
    let mut posting_count_ngram_2_compressed = 0;
    let mut posting_count_ngram_3_compressed = 0;
    {
        let plo = shard.segments_level0[*key0].segment.get(key_hash).unwrap();

        match plo.ngram_type {
            NgramType::SingleTerm => {}
            NgramType::NgramFF | NgramType::NgramFR | NgramType::NgramRF => {
                posting_count_ngram_1_compressed = if plo.term_ngram1.is_empty() {
                    plo.posting_count_ngram_1_compressed
                } else {
                    let term_bytes_1 = plo.term_ngram1.as_bytes();
                    let key0_1 = hash32(term_bytes_1) & shard.segment_number_mask1;
                    let key_hash_1 = hash64(term_bytes_1);
                    let mut posting_count_ngram1 = if shard.meta.access_type == AccessType::Mmap {
                        decode_posting_list_count(
                            &shard.segments_index[key0_1 as usize],
                            shard,
                            key_hash_1,
                            key0_1 < *key0 as u32,
                        )
                        .unwrap_or_default()
                    } else if let Some(plo) = shard.segments_index[key0_1 as usize]
                        .segment
                        .get(&key_hash_1)
                    {
                        plo.posting_count
                    } else {
                        0
                    };

                    if let Some(x) = shard.segments_level0[key0_1 as usize]
                        .segment
                        .get(&key_hash_1)
                    {
                        posting_count_ngram1 += x.posting_count as u32;
                    }
                    int_to_byte4(posting_count_ngram1)
                };

                posting_count_ngram_2_compressed = if plo.term_ngram2.is_empty() {
                    plo.posting_count_ngram_2_compressed
                } else {
                    let term_bytes_2 = plo.term_ngram2.as_bytes();
                    let key0_2 = hash32(term_bytes_2) & shard.segment_number_mask1;
                    let key_hash_2 = hash64(term_bytes_2);

                    let mut posting_count_ngram2 = if shard.meta.access_type == AccessType::Mmap {
                        decode_posting_list_count(
                            &shard.segments_index[key0_2 as usize],
                            shard,
                            key_hash_2,
                            key0_2 < *key0 as u32,
                        )
                        .unwrap_or_default()
                    } else if let Some(plo) = shard.segments_index[key0_2 as usize]
                        .segment
                        .get(&key_hash_2)
                    {
                        plo.posting_count
                    } else {
                        0
                    };

                    if let Some(x) = shard.segments_level0[key0_2 as usize]
                        .segment
                        .get(&key_hash_2)
                    {
                        posting_count_ngram2 += x.posting_count as u32;
                    }
                    int_to_byte4(posting_count_ngram2)
                };

                posting_count_ngram_1 =
                    DOCUMENT_LENGTH_COMPRESSION[posting_count_ngram_1_compressed as usize];
                posting_count_ngram_2 =
                    DOCUMENT_LENGTH_COMPRESSION[posting_count_ngram_2_compressed as usize];
            }
            _ => {
                posting_count_ngram_1_compressed = if plo.term_ngram1.is_empty() {
                    plo.posting_count_ngram_1_compressed
                } else {
                    let term_bytes_1 = plo.term_ngram1.as_bytes();
                    let key0_1 = hash32(term_bytes_1) & shard.segment_number_mask1;
                    let key_hash_1 = hash64(term_bytes_1);
                    let mut posting_count_ngram1 = if shard.meta.access_type == AccessType::Mmap {
                        decode_posting_list_count(
                            &shard.segments_index[key0_1 as usize],
                            shard,
                            key_hash_1,
                            key0_1 < *key0 as u32,
                        )
                        .unwrap_or_default()
                    } else if let Some(plo) = shard.segments_index[key0_1 as usize]
                        .segment
                        .get(&key_hash_1)
                    {
                        plo.posting_count
                    } else {
                        0
                    };

                    if let Some(x) = shard.segments_level0[key0_1 as usize]
                        .segment
                        .get(&key_hash_1)
                    {
                        posting_count_ngram1 += x.posting_count as u32;
                    }
                    int_to_byte4(posting_count_ngram1)
                };

                posting_count_ngram_2_compressed = if plo.term_ngram2.is_empty() {
                    plo.posting_count_ngram_2_compressed
                } else {
                    let term_bytes_2 = plo.term_ngram2.as_bytes();
                    let key0_2 = hash32(term_bytes_2) & shard.segment_number_mask1;
                    let key_hash_2 = hash64(term_bytes_2);

                    let mut posting_count_ngram2 = if shard.meta.access_type == AccessType::Mmap {
                        decode_posting_list_count(
                            &shard.segments_index[key0_2 as usize],
                            shard,
                            key_hash_2,
                            key0_2 < *key0 as u32,
                        )
                        .unwrap_or_default()
                    } else if let Some(plo) = shard.segments_index[key0_2 as usize]
                        .segment
                        .get(&key_hash_2)
                    {
                        plo.posting_count
                    } else {
                        0
                    };

                    if let Some(x) = shard.segments_level0[key0_2 as usize]
                        .segment
                        .get(&key_hash_2)
                    {
                        posting_count_ngram2 += x.posting_count as u32;
                    }
                    int_to_byte4(posting_count_ngram2)
                };

                posting_count_ngram_3_compressed = if plo.term_ngram3.is_empty() {
                    plo.posting_count_ngram_3_compressed
                } else {
                    let term_bytes_3 = plo.term_ngram3.as_bytes();
                    let key0_3 = hash32(term_bytes_3) & shard.segment_number_mask1;
                    let key_hash_3 = hash64(term_bytes_3);

                    let mut posting_count_ngram3 = if shard.meta.access_type == AccessType::Mmap {
                        decode_posting_list_count(
                            &shard.segments_index[key0_3 as usize],
                            shard,
                      
```

### Core Architecture Module: `seekstorm/src/doc_store.rs`
```
use memmap2::Mmap;
use serde_json::json;
use std::collections::{HashSet, VecDeque};
use std::fs;
use std::io::{self, Seek, SeekFrom, Write};
use std::path::Path;

use crate::geo_search::euclidian_distance;
use crate::highlighter::{Highlighter, top_fragments_from_field};
use crate::index::{
    AccessType, DistanceField, Document, DocumentCompression, FILE_PATH, FieldType, Index,
    ROARING_BLOCK_SIZE, Shard,
};
use crate::search::FacetValue;
use crate::utils::{read_u32, write_u32};

impl Shard {
    pub(crate) fn get_file_shard(&self, doc_id: usize) -> Result<Vec<u8>, String> {
        let file_path = Path::new(&self.index_path_string)
            .join(FILE_PATH)
            .join(doc_id.to_string() + ".pdf");

        if let Ok(data) = fs::read(file_path) {
            Ok(data)
        } else {
            Err("not found".into())
        }
    }

    pub(crate) fn get_document_shard(
        &self,
        doc_id: usize,
        include_uncommitted: bool,
        highlighter_option: &Option<Highlighter>,
        fields: &HashSet<String>,
        distance_fields: &[DistanceField],
    ) -> Result<Document, String> {
        if !self.delete_hashset.is_empty() && self.delete_hashset.contains(&doc_id) {
            return Err("not found".to_owned());
        }

        if doc_id >= self.indexed_doc_count {
            return Err("not found".to_owned());
        }
        let block_id = doc_id >> 16;

        let is_uncommitted = doc_id >= self.committed_doc_count;
        if is_uncommitted && !(include_uncommitted && self.uncommitted) {
            return Err("not found".to_owned());
        }

        if self.stored_field_names.is_empty() {
            return Err("not found".to_owned());
        }

        let doc_id_local = doc_id & 0b11111111_11111111;

        let mut doc = if self.meta.access_type == AccessType::Ram || is_uncommitted {
            let docstore_pointer_docs = if is_uncommitted {
                &self.compressed_docstore_segment_block_buffer
            } else {
                &self.level_index[block_id].docstore_pointer_docs
            };

            let position = doc_id_local * 4;
            let pointer = read_u32(docstore_pointer_docs, position) as usize;

            let previous_pointer = if doc_id == self.committed_doc_count || doc_id_local == 0 {
                ROARING_BLOCK_SIZE * 4
            } else {
                read_u32(docstore_pointer_docs, position - 4) as usize
            };

            if previous_pointer >= pointer || pointer > docstore_pointer_docs.len() {
                // Equal means an empty slot (e.g. a document with no stored
                // fields, which writes no pointer). Greater, or an end offset
                // past the buffer, is corrupt data; treat it the same instead
                // of slicing an invalid range and panicking.
                return Err("not found".to_owned());
            }

            let compressed_doc = &docstore_pointer_docs[previous_pointer..pointer];

            match self.meta.document_compression {
                DocumentCompression::None => {
                    let doc: Document = serde_json::from_slice(compressed_doc).unwrap();
                    doc
                }
                DocumentCompression::Snappy => {
                    let decompressed_doc = snap::raw::Decoder::new()
                        .decompress_vec(compressed_doc)
                        .unwrap();
                    let doc: Document = serde_json::from_slice(&decompressed_doc).unwrap();
                    doc
                }
                DocumentCompression::Lz4 => {
                    let decompressed_doc =
                        lz4_flex::decompress_size_prepended(compressed_doc).unwrap();
                    let doc: Document = serde_json::from_slice(&decompressed_doc).unwrap();
                    doc
                }
                DocumentCompression::Zstd => {
                    let decompressed_doc = zstd::decode_all(compressed_doc).unwrap();
                    let doc: Document = serde_json::from_slice(&decompressed_doc).unwrap();
                    doc
                }
            }
        } else {
            let level = doc_id >> 16;

            let position =
                self.level_index[level].docstore_pointer_docs_pointer + (doc_id_local * 4);

            let table_base = self.level_index[level].docstore_pointer_docs_pointer;
            let pointer = read_u32(&self.docstore_file_mmap, position) as usize;
            let previous_pointer = if doc_id_local == 0 {
                ROARING_BLOCK_SIZE * 4
            } else {
                read_u32(&self.docstore_file_mmap, position - 4) as usize
            };

            let start = table_base.saturating_add(previous_pointer);
            let end = table_base.saturating_add(pointer);
            if previous_pointer >= pointer || end > self.docstore_file_mmap.len() {
                // See the RAM branch above: equal is an empty slot, greater
                // or past the mapping is corrupt; both must return Err
                // instead of panicking (saturating_add keeps a corrupt
                // offset from wrapping around into a valid range).
                return Err(format!("not found {} {}", previous_pointer, pointer));
            }

            let compressed_doc = &self.docstore_file_mmap[start..end];

            match self.meta.document_compression {
                DocumentCompression::None => {
                    let doc: Document = serde_json::from_slice(compressed_doc).unwrap();
                    doc
                }
                DocumentCompression::Snappy => {
                    let decompressed_doc = snap::raw::Decoder::new()
                        .decompress_vec(compressed_doc)
                        .unwrap();
                    let doc: Document = serde_json::from_slice(&decompressed_doc).unwrap();
                    doc
                }
                DocumentCompression::Lz4 => {
                    let decompressed_doc =
                        lz4_flex::decompress_size_prepended(compressed_doc).unwrap();
                    let doc: Document = serde_json::from_slice(&decompressed_doc).unwrap();
                    doc
                }
                DocumentCompression::Zstd => {
                    let decompressed_doc = zstd::decode_all(compressed_doc).unwrap();
                    let doc: Document = serde_json::from_slice(&decompressed_doc).unwrap();
                    doc
                }
            }
        };

        if let Some(highlighter) = highlighter_option {
            let mut kwic_vec: VecDeque<String> = VecDeque::new();
            for highlight in highlighter.highlights.iter() {
                let kwic =
                    top_fragments_from_field(self, &doc, &highlighter.query_terms_ac, highlight)
                        .unwrap();
                kwic_vec.push_back(kwic);
            }

            for highlight in highlighter.highlights.iter() {
                let kwic = kwic_vec.pop_front().unwrap();
                doc.insert(
                    (if highlight.name.is_empty() {
                        &highlight.field
                    } else {
                        &highlight.name
                    })
                    .to_string(),
                    json!(kwic),
                );
            }
        }

        for distance_field in distance_fields.iter() {
            if let Some(idx) = self.facets_map.get(&distance_field.field)
                && self.facets[*idx].field_type == FieldType::Point
                && let FacetValue::Point(point) =
                    self.get_facet_value_shard(&distance_field.field, doc_id)
            {
                let distance =
                    euclidian_distance(&point, &distance_field.base, &distance_field.unit);

                doc.insert(distance_field.distance.clone(), json!(distance));
            }
        }

        if !fields.is_empty() {
     
```

### Core Architecture Module: `seekstorm/src/geo_search.rs`
```
use std::cmp::Ordering;

#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::{_pdep_u64, _pext_u64};

use crate::{
    index::DistanceUnit,
    search::{Point, SortOrder},
};

#[inline]
fn encode_morton_64_bit(x: u32) -> u64 {
    let mut x = x as u64;
    x = (x | (x << 32)) & 0x00000000ffffffff;
    x = (x | (x << 16)) & 0x0000FFFF0000FFFF;
    x = (x | (x << 8)) & 0x00FF00FF00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F0F0F0F0F;
    x = (x | (x << 2)) & 0x3333333333333333;
    x = (x | (x << 1)) & 0x5555555555555555;
    x
}

/// encode 2D-coordinate (lat/lon) into 64-bit Morton code
/// This method is lossy/quantized as two f64 coordinate values are mapped to a single u64 Morton code!
/// The z-value of a point in multidimensions is simply calculated by interleaving the binary representations of its coordinate values.
#[inline]
pub fn encode_morton_2_d(point: &Point) -> u64 {
    let x_u32 = ((point[0] * 10_000_000.0) as i32) as u32;
    let y_u32 = ((point[1] * 10_000_000.0) as i32) as u32;

    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    {
        if is_x86_feature_detected!("bmi2") {
            return unsafe {
                _pdep_u64(x_u32.into(), 0x5555555555555555)
                    | _pdep_u64(y_u32.into(), 0xAAAAAAAAAAAAAAAA)
            };
        }
    }

    (encode_morton_64_bit(y_u32) << 1) | encode_morton_64_bit(x_u32)
}

#[inline]
fn decode_morton_64_bit(code: u64) -> u64 {
    let mut x = code & 0x5555555555555555;
    x = (x ^ (x >> 1)) & 0x3333333333333333;
    x = (x ^ (x >> 2)) & 0x0F0F0F0F0F0F0F0F;
    x = (x ^ (x >> 4)) & 0x00FF00FF00FF00FF;
    x = (x ^ (x >> 8)) & 0x0000FFFF0000FFFF;
    x = (x ^ (x >> 16)) & 0x00000000FFFFFFFF;
    x
}

/// decode 64-bit Morton code into 2D-coordinate (lat/lon)
/// This method is lossy/quantized as a single u64 Morton code is converted to two f64 coordinate values!
#[inline]
pub fn decode_morton_2_d(code: u64) -> Point {
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    {
        if is_x86_feature_detected!("bmi2") {
            let x_u32 = unsafe { _pext_u64(code, 0x5555555555555555) as u32 };
            let y_u32 = unsafe { _pext_u64(code, 0xAAAAAAAAAAAAAAAA) as u32 };

            return vec![
                (x_u32 as i32) as f64 / 10_000_000.0,
                (y_u32 as i32) as f64 / 10_000_000.0,
            ];
        };
    }

    let x_u32 = decode_morton_64_bit(code) as u32;
    let y_u32 = decode_morton_64_bit(code >> 1) as u32;

    vec![
        (x_u32 as i32) as f64 / 10_000_000.0,
        (y_u32 as i32) as f64 / 10_000_000.0,
    ]
}

#[inline]
fn simplified_distance(point1: &Point, point2: &Point) -> f64 {
    let x = (point2[1] - point1[1]) * f64::cos(DEG2RAD * (point1[0] + point2[0]) / 2.0);
    let y = point2[0] - point1[0];

    x * x + y * y
}

/// Comparison of the distances between two morton encoded positions and a base position
pub fn morton_ordering(
    morton1: u64,
    morton2: u64,
    base_point: &Point,
    order: &SortOrder,
) -> Ordering {
    let point1 = decode_morton_2_d(morton1);
    let point2 = decode_morton_2_d(morton2);

    let distance1 = simplified_distance(&point1, base_point);
    let distance2 = simplified_distance(&point2, base_point);

    if order == &SortOrder::Descending {
        distance1.partial_cmp(&distance2).unwrap_or(Ordering::Equal)
    } else {
        distance2.partial_cmp(&distance1).unwrap_or(Ordering::Equal)
    }
}

const EARTH_RADIUS_KM: f64 = 6371.0087714;
const EARTH_RADIUS_MI: f64 = 3_958.761_315_801_475;
const DEG2RAD: f64 = 0.017_453_292_519_943_295;

/// calculates distance in kilometers or miles between two 2D-coordinates using Euclidian distance (Pythagoras theorem) with Equirectangular approximation.
#[inline]
pub fn euclidian_distance(point1: &Point, point2: &Point, unit: &DistanceUnit) -> f64 {
    let x = DEG2RAD * (point2[1] - point1[1]) * f64::cos(DEG2RAD * (point1[0] + point2[0]) / 2.0);
    let y = DEG2RAD * (point2[0] - point1[0]);

    (if *unit == DistanceUnit::Kilometers {
        EARTH_RADIUS_KM
    } else {
        EARTH_RADIUS_MI
    }) * (x * x + y * y).sqrt()
}

/// Converts a Point and a distance radius into a range of morton_codes for geo search range filtering.
/// The conversion is lossy due to coordinate to Morton code rounding errors and Equirectangular approximation of Euclidian distance.
pub fn point_distance_to_morton_range(
    point: &Point,
    distance: f64,
    unit: &DistanceUnit,
) -> std::ops::Range<u64> {
    let earth_radius = if *unit == DistanceUnit::Kilometers {
        EARTH_RADIUS_KM
    } else {
        EARTH_RADIUS_MI
    };
    let lat_delta = distance / (DEG2RAD * earth_radius);
    let lon_delta = distance / (DEG2RAD * earth_radius * f64::cos(DEG2RAD * point[0]));
    let morton_min = encode_morton_2_d(&vec![point[0] - lat_delta, point[1] - lon_delta]);
    let morton_max = encode_morton_2_d(&vec![point[0] + lat_delta, point[1] + lon_delta]);

    morton_min..morton_max
}

```

### Core Architecture Module: `seekstorm/src/highlighter.rs`
```
use crate::index::{
    Document, FieldType, IndexArc, Shard, hash64, object_values_to_string_vec_recursive,
};
use crate::min_heap::{self, MinHeap};
use aho_corasick::{AhoCorasick, MatchKind};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Specifies the number and size of fragments (snippets, summaries) to generate from each specified field to provide a "keyword in context" (KWIC) functionality.
/// With highlight_markup the matching query terms within the fragments can be highlighted with HTML markup.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct Highlight {
    /// Specifies the field from which the fragments  (snippets, summaries) are created.
    pub field: String,
    /// Allows to specifiy multiple highlight result fields from the same source field, leaving the original field intact,
    /// Default: if name is empty then field is used instead, i.e the original field is overwritten with the highlight.
    #[serde(default)]
    #[serde(skip_serializing_if = "String::is_empty")]
    pub name: String,
    /// If 0/default then return the full original text without fragmenting.
    #[serde(default)]
    pub fragment_number: usize,
    /// Specifies the length of a highlight fragment.
    /// The default 0 returns the full original text without truncating, but still with highlighting if highlight_markup is enabled.
    #[serde(default)]
    pub fragment_size: usize,
    /// if true, the matching query terms within the fragments are highlighted with HTML markup **\<b\>term\<\/b\>**.
    #[serde(default)]
    pub highlight_markup: bool,
    /// Specifies the markup tags to insert **before** each highlighted term (e.g. \"\<b\>\" or \"\<em\>\"). This can be any string, but is most often an HTML or XML tag.
    /// Only used when **highlight_markup** is set to true.
    #[serde(default = "default_pre_tag")]
    pub pre_tags: String,
    /// Specifies the markup tags to insert **after** each highlighted term. (e.g. \"\<\/b\>\" or \"\<\/em\>\"). This can be any string, but is most often an HTML or XML tag.
    /// Only used when **highlight_markup** is set to true.
    #[serde(default = "default_post_tag")]
    pub post_tags: String,
}

impl Default for Highlight {
    fn default() -> Self {
        Highlight {
            field: String::new(),
            name: String::new(),
            fragment_number: 1,
            fragment_size: usize::MAX,
            highlight_markup: true,
            pre_tags: default_pre_tag(),
            post_tags: default_post_tag(),
        }
    }
}

fn default_pre_tag() -> String {
    "<b>".into()
}

fn default_post_tag() -> String {
    "</b>".into()
}

/// Highlighter object used as get_document parameter for extracting keyword-in-context (KWIC) fragments from fields in documents, and highlighting the query terms within.
#[derive(Debug)]
pub struct Highlighter {
    pub(crate) highlights: Vec<Highlight>,
    pub(crate) query_terms_ac: AhoCorasick,
}

/// Returns the Highlighter object used as get_document parameter for highlighting fields in documents
pub async fn highlighter(
    index_arc: &IndexArc,
    highlights: Vec<Highlight>,
    query_terms_vec: Vec<String>,
) -> Highlighter {
    let index_ref = index_arc.read().await;
    let query_terms = if !index_ref.synonyms_map.is_empty() {
        let mut query_terms_vec_mut = query_terms_vec.clone();
        for query_term in query_terms_vec.iter() {
            let term_hash = hash64(query_term.to_lowercase().as_bytes());

            if let Some(synonyms) = index_ref.synonyms_map.get(&term_hash) {
                for synonym in synonyms.iter() {
                    query_terms_vec_mut.push(synonym.0.clone());
                }
            }
        }
        query_terms_vec_mut
    } else {
        query_terms_vec
    };

    let query_terms_ac = AhoCorasick::builder()
        .ascii_case_insensitive(true)
        .match_kind(MatchKind::LeftmostLongest)
        .build(query_terms)
        .unwrap();

    Highlighter {
        highlights,
        query_terms_ac,
    }
}

pub(crate) fn add_fragment<'a>(
    no_score_no_highlight: bool,
    mut fragment: Fragment<'a>,
    query_terms_ac: &AhoCorasick,
    fragments: &mut Vec<Fragment<'a>>,
    topk_candidates: &mut MinHeap,
    fragment_number: usize,
    fragment_size: usize,
) {
    let mut score = 0.0;
    let mut expected_pattern = usize::MAX;
    let mut expected_index = usize::MAX;

    let mut first_end = 0;
    let mut set = vec![0; query_terms_ac.patterns_len()];
    let mut sequence_length = 1;

    if no_score_no_highlight {
        score = 1.0;
    } else {
        for mat in query_terms_ac.find_iter(fragment.text) {
            if first_end == 0 {
                first_end = mat.end();
            }

            let id = mat.pattern().as_usize();
            score += if id == expected_pattern && expected_index == mat.start() {
                sequence_length += 1;
                set[id] = 1;
                sequence_length as f32 * 5.0
            } else if set[id] == 0 {
                sequence_length = 1;
                set[id] = 1;
                1.0
            } else {
                sequence_length = 1;
                0.3
            };

            expected_pattern = id + 1;
            expected_index = mat.end() + 1;
        }
    }

    if first_end > fragment_size {
        let mut idx = fragment.text.len() - fragment_size;

        while !fragment.text.is_char_boundary(idx) {
            idx -= 1;
        }

        match fragment.text[idx..].find(' ') {
            None => idx = 0,
            Some(value) => idx += value,
        }

        let adjusted_fragment = &fragment.text[idx..];
        fragment.text = adjusted_fragment;
        fragment.trim_left = true;
    } else if fragment.text.len() > fragment_size {
        let mut idx = fragment_size;

        while !fragment.text.is_char_boundary(idx) {
            idx -= 1;
        }

        match fragment.text[idx..].find(' ') {
            None => idx = fragment.text.len(),
            Some(value) => idx += value,
        }

        let adjusted_fragment = &fragment.text[..idx];
        fragment.text = adjusted_fragment;
        fragment.trim_right = true;
    }

    let section_index = fragments.len();

    let mut added = false;
    if score > 0.0 {
        added = topk_candidates.add_topk(
            min_heap::Result {
                doc_id: section_index,
                score,

                ..Default::default()
            },
            fragment_number,
        );
    }
    if fragments.is_empty() || added {
        fragments.push(fragment);
    }
}

const SENTENCE_BOUNDARY_CHARS: [char; 11] =
    ['!', '?', '.', '¿', '¡', '。', '、', '！', '？', '︒', '。'];

pub(crate) struct Fragment<'a> {
    text: &'a str,
    trim_left: bool,
    trim_right: bool,
}
/// Extracts the most relevant fragments (snippets, summaries) from specified fields of the document to provide a "keyword in context" (KWIC) functionality.
/// I.e. the sentences containing the matches of the query terms within the field is displayed and the query term matches are optionally highlighted (e.g. bold) by injecting HTML tags in to the text.
/// Instead of showing the complete text only the relevant fragments containing keyword matches are extracted. The user is provided with concise visual feedback for relevancy of the document regarding to the query.
/// The fragment ranking score takes into account the number of matching terms, their order and proximity (phrase).
/// The score is used for the selection of top-k most relevant fragments, but the order of selected fragments is preserved how they originally appear in the field.
/// The field is fragmented into sentences, using punctuation marks '.?!' as sentence boundaries.
/// If the fragment length exceeds the specified fragment_size, then the fragment is truncated at the right or left side, so that the query term higlight positions are kept within th
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #67** (2026-08-13): **Memory leak: Shard.index_option Arc reference cycle — index never released after drop()/close()**
  *Symptoms*: ## Summary  `Shard.index_option: Option<Arc<RwLock<Index>>>` creates an **Arc reference cycle** (`Index --shard_vec--> Arc<Shard> --index_option--> Arc<Index>`), so an index is **never dropped** once created — even after the caller drops every strong reference and even after `close()`. In embedded-library usage that creates/drops indexes repeatedly (tests, short-lived indexes), memory grows linearly (~55 MB per index on a 8-core machine) and file descriptors are never closed.  This contradicts the documented contract of `Close`:  > `/// Remove index from RAM (Reverse of open_index)` — `src/index.rs:5007`  `close()` does not break the cycle, so RAM is never actually returned.  ## Environment  - seekstorm 3.3.4 (latest, published 2026-08-08; `main` branch is in sync) - Rust edition 2024, Linux x86-64, `default-features = false`  ## Minimal reproduction  ```rust use seekstorm::index::{create_index, AccessType, Clustering, DocumentCompression,     FieldType, FrequentwordType, IndexMetaObject, LexicalSimilarity, NgramSet,     SchemaField, StemmerType, StopwordType, TokenizerType}; use seekstorm::vector::Inference;  #[tokio::main(flavor = "multi_thread", worker_threads = 4)] async fn main() {     let schema = vec![         SchemaField::new("id".into(), true, false, false, FieldType::String16, true, false, 1.0, false, false),         SchemaField::new("title".into(), true, true, false, FieldType::String16, true, false, 3.0, false, false),         SchemaField::new("summary".into(), tr
  **Post-Mortem & Fix Analysis**:
  > @qkun-zh  Thank you for reporting the issue. We will fix it.
  > @qkun-zh [SeekStorm v3.3.5](https://github.com/SeekStorm/SeekStorm/releases/tag/v3.3.5) fixes issue #67. Please let me know if it works for you.
  > Verified fixed in seekstorm 3.3.5. Thank you!  Repro: create index, then open/close/drop 30 times, counting mmap file descriptors on the index path. - With `close()`: fd count stays at baseline (delta=0) — the Arc cycle is broken via `index_option = None`. ✅ - Without `close()` (plain drop): fds still grow (~21 per iteration) — consistent with `close()` being the documented release path (Remove index from RAM, Reverse of open_index).  The `index_option = None` in `Close` resolves the cycle for users who call `close()`. Closing.

- **Issue #66** (2026-08-13): **Empty-query result_count_total includes deleted documents (Count/TopkCount)**
  *Symptoms*: ## Summary  In seekstorm 3.3.4, when searching with an **empty query** (`enable_empty_query = true`) after deleting documents, `result_count_total` (and `result_count` for `ResultType::Count`) **includes the deleted documents**, while `results` correctly excludes them. The two are internally inconsistent: e.g. 4 results but `result_count_total == 6`.  Keyword queries are **not** affected: their counts correctly exclude deleted documents.  ## Steps to reproduce  Minimal example (seekstorm 3.3.4, `default-features = false`):  ```rust use std::path::Path; use seekstorm::commit::Commit; use seekstorm::index::{     create_index, AccessType, Clustering, DeleteDocument, DocumentCompression, FieldType,     FileType, FrequentwordType, IndexDocument, IndexMetaObject, LexicalSimilarity, NgramSet,     SchemaField, StemmerType, StopwordType, TokenizerType, }; use seekstorm::search::{QueryRewriting, QueryType, ResultType, Search, SearchMode}; use seekstorm::vector::Inference;  #[tokio::main] async fn main() {     let dir = Path::new("/tmp/seekstorm_count_bug");     let schema = vec![         SchemaField::new("id".into(), true, false, false, FieldType::String16, true, false, 1.0, false, false),         SchemaField::new("title".into(), true, true, false, FieldType::String16, true, false, 1.0, false, false),     ];     let meta = IndexMetaObject {         id: 0,         name: "bug".into(),         lexical_similarity: LexicalSimilarity::Bm25f,         tokenizer: TokenizerType::UnicodeAlphanume
  **Post-Mortem & Fix Analysis**:
  > @qkun-zh Thank you for reporting the issue. We will fix it.
  > @qkun-zh [SeekStorm v3.3.5](https://github.com/SeekStorm/SeekStorm/releases/tag/v3.3.5) fixes issue #66. Please let me know if it works for you.
  > Verified fixed in seekstorm 3.3.5. Thanks for the quick turnaround!  Tested with the exact repro from this issue (create 2 docs, delete doc_id 0, empty-query search): - `TopkCount` → `results=[1]`, `result_count_total=1` (was 2) ✅ - `Count` → `result_count_total=1` (was 2) ✅ - keyword query still correct (`total=1`) ✅  The `search_iterator_index` change to `current_doc_count()` resolves the internal inconsistency between `results` and `result_count_total`. Closing.

- **Issue #65** (2026-08-08): **commit() hides shard panic and fails to persist lexical-only append after reopening external-vector index**
  *Symptoms*: This bug was found by AI and this report was generated by AI (gpt-5.6-sol, xhigh reasoning, codex).  ## Summary  With an `Inference::External` index that has both lexical fields and a vector field, a document may be indexed without the vector field. The first lexical-only document commits successfully. After closing and reopening the index, appending another lexical-only document causes a Tokio shard worker to panic in `commit_vector_shard()` at `src/vector.rs:987`.  `commit().await` then returns normally because the shard `JoinError` is only printed. The appended document is not present in the committed index.  Even if omitting a vector is not intended to be supported, this should be rejected by the API rather than panicking during a later commit and reporting normal completion.  ## Version and environment  - SeekStorm: `3.3.0` - Cargo features: `default-features = false`, `features = ["gxhash", "vb"]` - Tokio: `1.52.3` - Rust: `rustc 1.95.0 (59807616e 2026-04-14)` - Target: `aarch64-apple-darwin` - OS: macOS 15.7.7 (`24G720`) - Build: debug - Reproduced: consistently, including with `RUST_BACKTRACE=1`  Index configuration:  - `AccessType::Mmap` - `Clustering::Auto` - `Inference::External` - 768 dimensions, F32 input, scalar I8 quantization, cosine similarity  ## Minimal reproducer  `Cargo.toml`:  ```toml [package] name = "seekstorm-lexical-reopen-repro" version = "0.1.0" edition = "2021"  [dependencies] seekstorm = { version = "=3.3.0", default-features = false, features = 
  **Post-Mortem & Fix Analysis**:
  > Here is `main.rs` that I forgot to include above  ```rust use std::path::PathBuf;  use seekstorm::{     commit::Commit,     index::{         create_index, open_index, AccessType, Close, Clustering, Document, DocumentCompression,         FrequentwordType, IndexDocuments, IndexMetaObject, LexicalSimilarity, NgramSet,         SchemaField, StemmerType, StopwordType, TokenizerType,     },     iterator::GetIterator,     vector::{Inference, Precision, Quantization},     vector_similarity::VectorSimilarity, }; use serde_json::json;  fn lexical_document(id: &str, body: &str) -> Document {     serde_json::from_value(json!({         "id": id,         "body": body         // Intentionally no `vector`: some documents are lexical-only.     }))     .unwrap() }  #[tokio::main] async fn main() {     let path = PathBuf::from("target/repro-index");     let _ = std::fs::remove_dir_all(&path);      let schema: Vec<SchemaField> = serde_json::from_value(json!([         {"field":"id","field_type":"String32","
  > @dgllghr Thank you for reporting the issue. I will have a look.
  > [SeekStorm v3.3.4](https://github.com/SeekStorm/SeekStorm/releases/tag/v3.3.4) fixes the issue.

- **Issue #61** (2026-05-13): **Macbook : aarch64 build failing**
  *Symptoms*: **Macbook Apple M5**  bash-3.2$ cargo build --release    Compiling seekstorm v3.1.0 (/opt/search/SeekStorm) error[E0432]: unresolved import `std::arch::x86_64`  --> src/seekstorm/clustering.rs:5:16   | 5 | use std::arch::x86_64::*;   |                ^^^^^^ could not find `x86_64` in `arch`  warning: unnecessary qualification    --> src/seekstorm/intersection_simd.rs:463:28     | 463 |         let vectorlength = mem::size_of::<uint16x8_t>() / mem::size_of::<u16>();     |                            ^^^^^^^^^^^^^^^^^^^^^^^^^^     | note: the lint level is defined here    --> src/seekstorm/lib.rs:467:5     | 467 |     unused_qualifications     |     ^^^^^^^^^^^^^^^^^^^^^ help: remove the unnecessary path segments     | 463 -         let vectorlength = mem::size_of::<uint16x8_t>() / mem::size_of::<u16>(); 463 +         let vectorlength = size_of::<uint16x8_t>() / mem::size_of::<u16>();     |  warning: unnecessary qualification    --> src/seekstorm/intersection_simd.rs:463:59     | 463 |         let vectorlength = mem::size_of::<uint16x8_t>() / mem::size_of::<u16>();     |                                                           ^^^^^^^^^^^^^^^^^^^     | help: remove the unnecessary path segments     | 463 -         let vectorlength = mem::size_of::<uint16x8_t>() / mem::size_of::<u16>(); 463 +         let vectorlength = mem::size_of::<uint16x8_t>() / size_of::<u16>();     |  error: the feature named `avx2` is not valid for this target   --> src/seekstorm/clustering.rs:55:18    | 
  **Post-Mortem & Fix Analysis**:
  > @sbmandava Thank you for reporting the issue. We will fix the support for the AArch64 target.
  > @sbmandava [Release 3.1.1](https://github.com/SeekStorm/SeekStorm/releases/tag/v3.1.1) should fix the issue. Please let me know if it works for you, as I currently have no MacBook to test it.  In vector search, for the AArch64 target, there is no SIMD/NEON support yet. SeekStorm currently uses just a scalar fallback. But in lexical search, there is SIMD support for the AArch64 target as well.

- **Issue #57** (2026-02-04): **new panicked issue when commit**
  *Symptoms*: I'm trying PATCH commit in ver 2.1.0, an then serch or insert and get  _thread 'tokio-runtime-worker' (29988) panicked at src\seekstorm\index_posting.rs:174:25: attempt to subtract with overflow note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace  thread 'tokio-runtime-worker' (23744) panicked at src\seekstorm\doc_store.rs:77:56: slice index starts at 262144 but ends at 0_  After submitting, is restarting the only option?  
  **Post-Mortem & Fix Analysis**:
  > @DragonXYZ Thank you for reporting the issue.  Could you please provide a complete (minimal) example how to replicate the issue?  I created an index via REST API, indexed a document, committed, indexed another document and searched without problem:   ``` ### create index POST http://127.0.0.1:80/api/v1/index HTTP/1.1 apikey: {{api_key}} content-type: application/json  {     "schema":[{         "field": "title",          "field_type": "Text",          "stored": true,          "indexed": true     },         {         "field": "body",         "field_type": "Text",          "stored": true,          "indexed": true,         "longest": true     },     {         "field": "url",          "field_type": "String32",          "stored": true,          "indexed": false     }],      "index_name": "test_index",     "similarity": "Bm25fProximity",     "tokenizer": "UnicodeAlphanumeric" }  ### index document POST http://127.0.0.1:80/api/v1/index/0/doc HTTP/1.1 apikey: {{api_key}} content-type: applicati
  > I test it again with another test even Index will show Error _detect longest field id 1 name body length 157  thread 'tokio-runtime-worker' (33692) panicked at src\seekstorm\tokenizer.rs:597:62: called `Option::unwrap()` on a `None` value note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace_  Maybe  1 : some field too long for type (this 2 projects all have this issue<some field too long>)  2 : I have use  cargo clear  and cargo update  then cargo build. Some new third-party components are causing problems.  I use the old this test solusion you have been tested  [URL](https://www.mediafire.com/file/tw2v4j0fhpypvf1/ConsoleApp1.zip/file)
  > It would be great if SeekStorm provided older .NET versions. _deephn.org_ That would make it very convenient for me to use.😂 

- **Issue #54** (2026-01-18): **find more issues**
  *Symptoms*: I'm trying get indexed doc without query,so I use POST Method `get/api/v1/index/{index_id}/doc/{document_id}` and when document_id bigger than 5 will throw error  _thread 'tokio-runtime-worker' (31192) panicked at src\seekstorm\doc_store.rs:345:23: index out of bounds: the len is 6 but the index is 6_   and more error I found  _thread 'tokio-runtime-worker' (24780) panicked at src\seekstorm\utils.rs:93:28: range start index 260587522 out of range for slice of length 16_  _thread 'tokio-runtime-worker' (39720) panicked at src\seekstorm\index_posting.rs:174:25: attempt to subtract with overflow_
  **Post-Mortem & Fix Analysis**:
  > @DragonXYZ  Thank you for reporting the issue.  > I'm trying get indexed doc without query,so **I use POST Method**  `Get Document` requires the **GET** method.  https://seekstorm.apidocumentation.com/reference#tag/document/get/api/v1/index/{index_id}/doc/{document_id}  The **POST** method is reserved for `Index Document`. https://seekstorm.apidocumentation.com/reference#tag/document/post/api/v1/index/{index_id}/doc  It is not recommended to use `Get Document` **without a prior search** that returns valid ` document_id`.  - `document_id` are **not guaranteed to be continuous and gapless!** - Because of this, valid `document_id`  might be **larger** than the ​` indexed_doc_count​`  number returned by the `Get Index Info​` REST API endpoint.  The reason for this is that the external document_id consists of a shard_id + internal document_id per shard.  It is not guaranteed that all consecutive external `document id` point to an actual document for the following reasons: - due to concurren
  > Sorry, my phrasing was incorrect. It was indeed the `get` method; I probably meant it would be better to have a `POST` method instead. (This GET method does indeed have a bug.)  > Perhaps we can also add an iterator API call over all indexed documents. Would that help? Yes, this would be very useful; I need to implement the function to return some default indexed documents to show.
  > @DragonXYZ  Commit fc16fbc / [release v2.0.0](https://github.com/SeekStorm/SeekStorm/releases/tag/v2.0.0) adds a **document ID iterator API** that fixes issue #54 .  See [REST API documentation](https://seekstorm.apidocumentation.com/reference#tag/document-id) and [test_api.rest](https://github.com/SeekStorm/SeekStorm/blob/main/src/seekstorm_server/test_api.rest) for examples:  ### get first document ID  ``` GET http://127.0.0.1/api/v1/index/0/doc_id/ apikey: {{api_key}} content-type: application/json  //request body {     "document_id": null,     "skip": 0,     "take": 1 } ```  ### get last document ID  ``` GET http://127.0.0.1/api/v1/index/0/doc_id/ apikey: {{api_key}} content-type: application/json  //request body {     "document_id": null,     "skip": 0,     "take": -1 } ```  ### get next document ID  ``` GET http://127.0.0.1/api/v1/index/0/doc_id/ apikey: {{api_key}} content-type: application/json  //request body {     "document_id": 0,     "skip": 1,     "take": 1 } ```  ### get 

- **Issue #39** (2025-12-03): **docker container 0.12.11 & 0.12.15: 100% cpu usage**
  *Symptoms*: After a couple of days of having the docker container around, I found that it now is stuck on 100% CPU all the time (spinning a single core on machine).  Web UI and index functions are all still working, through the container always uses 100% CPU.  ![Image](https://github.com/user-attachments/assets/ca7d351e-9ead-45af-8995-cf6dbdf08ba0)  Docker logs have no indication of problem.  ``` ✗ docker logs -f seekstorm  SeekStorm server v0.12.15 Press CTRL-C or enter 'quit' to shutdown server, enter 'help' for console commands. Ingest path: / Listening on: 127.0.0.1:80 index dir /seekstorm_index master key A6xnQhbz4Vx2HuGl4lXwZ5U2I8iziLRFnhP5eNfIRvQ=   ```   ### steps to reproduce 1. use docker on linux ( debian stable + kernel 6) 2. use this docker compose file   ``` services:   seekstorm:     container_name: seekstorm     image: wolfgarbe/seekstorm_server:v0.12.15     volumes:       - /seekstorm_index     environment:       - MASTER_KEY_SECRET=1234     ports:       - 80:80     deploy:       resources:         limits:           cpus: '4'           memory: 6000M         reservations:           cpus: '1'           memory: 2000M     restart: unless-stopped     command: /seekstorm_server local_ip="127.0.0.1" local_port=80 index_path="/seekstorm_index"  ```  3. start container and watch its CPU usage with `docker stats seekstorm` 4. observe permanent 100% CPU usage   ---  The "ingest path" as "/" seemed problematic, maybe this was scanning the root filesystem of the container for pdfs an
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the issue. Do you run docker with the [-ti parameter](https://www.baeldung.com/linux/docker-run-interactive-tty-options)?  The issue could be related to the [keyboard loop]( https://github.com/SeekStorm/SeekStorm/blob/3947aaeccf09dc440549fa883dfbcface927d205/src/seekstorm_server/server.rs#L37) not working properly in the container when used without the parameters.  As the issue seems to be present solely in a container environment, it should be related to those few parts in code that might work differently in a container environment.  I could add a check [std::io::IsTerminal](https://doc.rust-lang.org/std/io/trait.IsTerminal.html) in before [tokio::spawn(async { commandline(sender_commandline).await });](https://github.com/SeekStorm/SeekStorm/blob/3947aaeccf09dc440549fa883dfbcface927d205/src/seekstorm_server/server.rs#L103)   Also, do you know which processor architecture is used: x86_64 or aarch64 ?
  > docker is ran using [docker compose](https://docs.docker.com/reference/cli/docker/compose/) with above service definition.   here is how to use the docker compose config to run a container on your machine  ``` ➜  repro2 mkdir bug ➜  repro2 cd bug  ➜  bug vim docker-compose.yaml # paste the yml above  ➜  bug cat docker-compose.yaml  services:   seekstorm:     container_name: seekstorm     image: wolfgarbe/seekstorm_server:v0.12.15     volumes:       - /seekstorm_index     environment:       - MASTER_KEY_SECRET=1234     ports:       - 80:80     deploy:       resources:         limits:           cpus: '4'           memory: 6000M         reservations:           cpus: '1'           memory: 2000M     restart: unless-stopped     command: /seekstorm_server local_ip="127.0.0.1" local_port=80 index_path="/seekstorm_index" ➜  bug docker-compose up -d [+] Building 0.0s (0/0)                                                                                                                             
  > > I could add a check [std::io::IsTerminal](https://doc.rust-lang.org/std/io/trait.IsTerminal.html)  Yes that's one way, but then you can't pipe commands into stdin from a script that's not a terminal environment, for example `echo create | ./seekstorm_server ...` in a CI or container  > keyboard loop  so this is infinite looping?   ```rs     for line in std::io::stdin().lines() {         if let Ok(line) = line { ```  ah yes in vscode you see the type annotation  ![Image](https://github.com/user-attachments/assets/0b0d5b39-c5b0-4b1b-a8db-aeda4d79e7de)  so you're ignoring all those errors when they come back with read error, instead of breaking the loop. stdin errors are probably not going to fix by themselves, so sleeping and retrying might not be useful here  so you could do   ```rs     for line in std::io::stdin().lines() {         if let Ok(line) = line {            ...     } else { warn!("stdin read error, closing"); break; }  ```   Otherwise you might also get but 100% when doing 

- **Issue #36** (2025-02-10): **panic at realtime seach**
  *Symptoms*: Find another BUG `thread 'tokio-runtime-worker' panicked at src\seekstorm\realtime_search.rs:1640:33: index out of bounds: the len is 0 but the index is 0`
  **Post-Mortem & Fix Analysis**:
  > @DragonXYZ Thank you for reporting the issue.   To fix the problem I need to be able to replicate it first. To replicate the problem I need more information: the specific index (or the index schema and documents) and the query that caused the panic.   It is a good practice to keep the provided information (index, documents, and code) as small as possible, but still sufficient to reliably reproduce the problem.  If you could provide me with this information, that would be very helpful. Without that information, and without being able to reprocuce the problem, it is difficult for me to know whether the applied changes will really fix the problem.
  > Never mind, I found the problem. Will be fixed with next release!
  > [SeekStorm v0.12.14](https://github.com/SeekStorm/SeekStorm/releases/tag/v0.12.14) should fix the issue.  

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

### Incident Patch 1: `daf33e78` (2026-09-12)
**Commit Message**: Merge pull request #87 from qkun-zh/fix/union-docid3-recall

Finish union_docid_3 subset recursion with a linear fallback at the cap

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ seekstorm/tests/index_get_*/
 seekstorm/tests/index_scan32_*/
 seekstorm/tests/index_union_*/
 seekstorm/tests/index_delete_union*/
+seekstorm/tests/index_docid3_*/
 .vscode/
 .idea
 
```

**File**: `seekstorm/src/min_heap.rs` (modified, +22/-0)
```diff
@@ -1257,4 +1257,26 @@ impl<'a> MinHeap<'a> {
             false
         }
     }
+
+    /// Snapshot (heap size, heap minimum) to detect scoring progress.
+    #[inline(always)]
+    pub(crate) fn heap_progress(&self) -> (usize, f32) {
+        let size = self.current_heap_size;
+        let min = if size > 0 {
+            self._elements[0].score
+        } else {
+            f32::NEG_INFINITY
+        };
+        (size, min)
+    }
+
+    /// Remember every heap entry in docid_hashset so re-scoring a document
+    /// refreshes it instead of duplicating it.
+    #[inline(always)]
+    pub(crate) fn pin_heap(&mut self) {
+        for i in 0..self.current_heap_size {
+            self.docid_hashset
+                .insert(self._elements[i].doc_id, self._elements[i].score);
+        }
+    }
 }
```

**File**: `seekstorm/src/search.rs` (modified, +2/-1)
```diff
@@ -3535,8 +3535,9 @@ impl SearchLexicalShard for ShardArc {
                         &field_filter_set,
                         &facet_filter_sparse,
                         &mut matching_blocks,
-                        0,
+                        0, // recursion_count
                         query_term_count,
+                        0, // empty_streak
                     )
                     .await;
                 } else {
```

**File**: `seekstorm/src/union.rs` (modified, +83/-25)
```diff
@@ -1233,12 +1233,7 @@ pub(crate) async fn union_docid_2<'a>(
     if (search_result.topk_candidates.current_heap_size < top_k)
         || (query_list[0].max_list_score > search_result.topk_candidates._elements[0].score)
     {
-        for i in 0..search_result.topk_candidates.current_heap_size {
-            search_result.topk_candidates.docid_hashset.insert(
-                search_result.topk_candidates._elements[i].doc_id,
-                search_result.topk_candidates._elements[i].score,
-            );
-        }
+        search_result.topk_candidates.pin_heap();
 
         single_blockid(
             shard,
@@ -1259,12 +1254,7 @@ pub(crate) async fn union_docid_2<'a>(
     if (search_result.topk_candidates.current_heap_size < top_k)
         || (query_list[1].max_list_score > search_result.topk_candidates._elements[0].score)
     {
-        for i in 0..search_result.topk_candidates.current_heap_size {
-            search_result.topk_candidates.docid_hashset.insert(
-                search_result.topk_candidates._elements[i].doc_id,
-                search_result.topk_candidates._elements[i].score,
-            );
-        }
+        search_result.topk_candidates.pin_heap();
 
         single_blockid(
             shard,
@@ -1302,13 +1292,45 @@ pub(crate) async fn union_docid_3<'a>(
     matching_blocks: &mut i32,
     recursion_count: usize,
     query_term_count: usize,
+    empty_streak: usize,
 ) {
     let queue_object = query_queue.remove(0);
 
     let mut query_list = queue_object.query_list;
 
     if result_type == &ResultType::Topk || result_type == &ResultType::TopkCount {
-        if query_list.len() >= 3 {
+        let mut streak = empty_streak;
+        // Bail out to the linear fallback after this many intersections with no heap progress.
+        const EMPTY_STREAK_LIMIT: usize = 5;
+        // All terms sparse relative to the collection: intersections are
+        // almost surely empty, so scan the union directly instead of
+        // enumerating empty subsets.
+        let sparse_threshold = shard.indexed_doc_count / 128;
+        if recursion_count == 0
+            && query_list
+                .iter()
+                .all(|plo| (plo.posting_count as usize) < sparse_threshold)
+        {
+            union_blockid(
+                shard,
+                non_unique_query_list,
+                &mut query_list,
+                not_query_list,
+                result_count_arc,
+                search_result,
+                top_k,
+                &ResultType::Topk,
+                field_filter_set,
+                facet_filter,
+            )
+            .await;
+            // union_blockid consumes traversal state; reset it for the recount below.
+            for plo in query_list.iter_mut() {
+                plo.p_block = 0;
+                plo.end_flag_block = false;
+            }
+        } else if query_list.len() >= 3 {
+            let (heap_size_before, heap_min_before) = search_result.topk_candidates.heap_progress();
             intersection_blockid(
                 shard,
                 non_unique_query_list,
@@ -1326,13 +1348,16 @@ pub(crate) async fn union_docid_3<'a>(
             )
             .await;
 
-            for j in 0..search_result.topk_candidates.current_heap_size {
-                search_result.topk_candidates.docid_hashset.insert(
-                    search_result.topk_candidates._elements[j].doc_id,
-                    search_result.topk_candidates._elements[j].score,
-                );
+            {
+                let (heap_size_after, heap_min_after) =
+                    search_result.topk_candidates.heap_progress();
+                let productive = heap_size_after > heap_size_before
+                    || (heap_size_after > 0 && heap_min_after > heap_min_before);
+                streak = if productive { 0 } else { empty_streak + 1 };
             }
 
+            search_result.topk_candidates.pin_heap();
+
             {
               
```

**File**: `seekstorm/tests/union_docid3_fill_recall.rs` (added, +251/-0)
```diff
@@ -0,0 +1,251 @@
+//! Regression tests for the `union_docid_3` WAND recursion cap fix (B1).
+//!
+//! `union_docid_3` (in seekstorm/src/union.rs) enumerates word-combination
+//! subsets via recursive intersection, bounded by `recursion_count < 200`.
+//! For disjoint (or generally sparse, low-idf) terms every intersection is
+//! empty, the WAND pruning never triggers, and the cap truncates the
+//! enumeration: documents owned only by subsets still enqueued are silently
+//! dropped. The fix falls back to a single `union_blockid` linear pass over
+//! the union of the remaining subsets once the cap is hit.
+//!
+//! Oracle for this path cannot reuse the "unbounded length" trick (the cap
+//! truncates even a full ranking), so the ground truth is built out of one
+//! exact single-term top-k per query term (single-term search is exact), and
+//! the union result must be a valid top-k of the merged per-word score
+//! tables. Comparison is the tie-tolerant score-threshold invariant used by
+//! union_topk_fill_ranking.
+//!
+//! Self-contained (own index directory), deterministic, no sleeps.
+
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, DocumentCompression, FrequentwordType, IndexDocuments,
+    IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType, TokenizerType,
+    create_index,
+};
+use seekstorm::search::{QueryRewriting, QueryType, ResultType, Search, SearchMode};
+use seekstorm::vector::Inference;
+use std::{fs, path::Path};
+
+fn meta() -> IndexMetaObject {
+    IndexMetaObject {
+        id: 0,
+        name: "union_docid3_recall".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: DocumentCompression::Snappy,
+        access_type: AccessType::Mmap,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    }
+}
+
+fn schema() -> Vec<seekstorm::index::SchemaField> {
+    serde_json::from_str(
+        r#"[{"field":"title","field_type":"Text","store":true,"index_lexical":true}]"#,
+    )
+    .unwrap()
+}
+
+fn doc(title: &str) -> seekstorm::index::Document {
+    serde_json::from_str(&format!(r#"{{"title":"{title}"}}"#)).unwrap()
+}
+
+async fn search(
+    index: &seekstorm::index::IndexArc,
+    query: &str,
+    length: usize,
+    result_type: ResultType,
+) -> seekstorm::search::ResultObject {
+    index
+        .search(
+            query.into(),
+            None,
+            QueryType::Union,
+            SearchMode::Lexical,
+            false,
+            0,
+            length,
+            result_type,
+            false,
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            QueryRewriting::SearchOnly,
+        )
+        .await
+}
+
+async fn fresh(dir: &str) -> seekstorm::index::IndexArc {
+    let path = Path::new(dir);
+    let _ = fs::remove_dir_all(path);
+    create_index(path, meta(), &schema(), &Vec::new(), 11, true, None)
+        .await
+        .unwrap()
+}
+
+/// Check `topk` is a valid exact top-`k` of the full `score_table`
+/// (unordered (doc_id, score) records). Tie-tolerant threshold invariant.
+fn assert_valid_selection(
+    topk: &[(usize, f32)],
+    score_table: &[(usize, f32)],
+    expected_total: usize,
+) {
+    let k = topk.len();
+    assert_eq!(score_table.len(), expected_total, "ground truth size");
+    assert!(k > 0, "top-k run returned nothing");
+
+    let mut scores: Vec<f32> = score_table.iter().map(|s| s.1).collect();
+    scores.sort_by(|a, b| b.partial_cmp(a).unwrap());
+    let threshold = scores[k - 1];
+    let strictly_better = scores.iter().filter(|s| **s > threshold).cou
```

---

### Incident Patch 2: `5f3208c8` (2026-09-11)
**Commit Message**: Merge pull request #86 from qkun-zh/fix/union-scan32-fill-exemption

Fix union_scan_32 under-filling top-k heap below top_k

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@ seekstorm/tests/index_test/
 seekstorm/tests/index_facet_test/
 seekstorm/tests/index_delete_*/
 seekstorm/tests/index_get_*/
+seekstorm/tests/index_scan32_*/
+seekstorm/tests/index_union_*/
+seekstorm/tests/index_delete_union*/
 .vscode/
 .idea
 
```

**File**: `seekstorm/src/union.rs` (modified, +3/-1)
```diff
@@ -766,7 +766,9 @@ pub(crate) async fn union_scan_32<'a>(
                             plo.blocks[plo.p_block as usize].max_block_score;
                     }
                 }
-                if query_terms_max_score_sum > search_result.topk_candidates._elements[0].score {
+                if search_result.topk_candidates.current_heap_size < top_k
+                    || query_terms_max_score_sum > search_result.topk_candidates._elements[0].score
+                {
                     for (j, query_term) in query_list.iter_mut().take(query_list_len).enumerate() {
                         query_term.bm25_flag = (query_terms_bitset & (1 << j)) > 0;
 
```

**File**: `seekstorm/tests/union_topk_fill_ranking.rs` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+//! Strict regression tests for the `Union` scan fill-exemption fix (B2).
+//!
+//! `union_scan_32` (seekstorm/src/union.rs) had an inner gate
+//! `query_terms_max_score_sum > _elements[0].score` that lacked the
+//! "heap not yet full" (`current_heap_size < top_k`) exemption that every
+//! sibling path (scan_8, docid_2, docid_3) has. Once the heap filled, every
+//! same-score follower was vetoed, so many-term Unions under-filled the heap
+//! (observed: 14/100 on uniform low-score docs, 1/100 on disjoint docid-sorted
+//! corpora).
+//!
+//! Oracle strategy (no reimplementation of BM25): run the exact same engine at
+//! two truncation levels. With `length == total hits`, the heap is never
+//! full, so no candidate is ever vetoed and the result is the precise global
+//! ranking. The truncated `top_k` run must behave like an exact top-`k`
+//! selection over that global ranking: it returns exactly `k` hits, contains
+//! every hit whose score is strictly above the `k`th-best score, and contains
+//! no hit strictly below it. Doc identity at the exact-score tie boundary may
+//! legitimately differ between two deterministic-but-arbitrary tie selections,
+//! so the assertion is deliberately tie-tolerant.
+//!
+//! On top of that, a strictly-distinct-score corpus locks the exact doc set,
+//! because with no ties the top-`k` set is unique.
+//!
+//! Self-contained (own index directories), deterministic, no sleeps.
+
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, DocumentCompression, FrequentwordType, IndexDocuments,
+    IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType, TokenizerType,
+    create_index,
+};
+use seekstorm::search::{QueryRewriting, QueryType, ResultObject, ResultType, Search, SearchMode};
+use seekstorm::vector::Inference;
+use std::{fs, path::Path};
+
+fn meta() -> IndexMetaObject {
+    IndexMetaObject {
+        id: 0,
+        name: "union_topk_fill_ranking".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: DocumentCompression::Snappy,
+        access_type: AccessType::Mmap,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    }
+}
+
+fn schema() -> Vec<seekstorm::index::SchemaField> {
+    serde_json::from_str(
+        r#"[{"field":"title","field_type":"Text","store":true,"index_lexical":true}]"#,
+    )
+    .unwrap()
+}
+
+fn doc(title: &str) -> seekstorm::index::Document {
+    serde_json::from_str(&format!(r#"{{"title":"{title}"}}"#)).unwrap()
+}
+
+async fn search(
+    index: &seekstorm::index::IndexArc,
+    query: &str,
+    offset: usize,
+    length: usize,
+    result_type: ResultType,
+) -> ResultObject {
+    index
+        .search(
+            query.into(),
+            None,
+            QueryType::Union,
+            SearchMode::Lexical,
+            false,
+            offset,
+            length,
+            result_type,
+            false,
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            QueryRewriting::SearchOnly,
+        )
+        .await
+}
+
+async fn fresh(dir: &str) -> seekstorm::index::IndexArc {
+    let path = Path::new(dir);
+    let _ = fs::remove_dir_all(path);
+    create_index(path, meta(), &schema(), &Vec::new(), 11, true, None)
+        .await
+        .unwrap()
+}
+
+/// Assert `topk` equals a valid exact top-`k` of the full ranking `oracle`.
+/// Tie-tolerant: only the score threshold structure is compared.
+fn assert_valid_topk(topk: &ResultObject, oracle: &ResultObject) {
+    let k = topk.results.len();
+    assert!(k > 0, "top_k run returne
```

---

### Incident Patch 3: `8ed920d3` (2026-09-11)
**Commit Message**: Merge pull request #85 from qkun-zh/fix/union-scan32-overflows

Fix union_scan_32 overflows past 32 query terms

**File**: `seekstorm/src/union.rs` (modified, +3/-2)
```diff
@@ -621,7 +621,8 @@ pub(crate) async fn union_scan_32<'a>(
     });
 
     let mut max_score = 0.0;
-    let mut mask = u32::MAX >> (32 - query_list.len());
+    // Bitmask holds at most `union_max` terms; clamp or `32 - len` underflows.
+    let mut mask = u32::MAX >> (union_max - cmp::min(query_list.len(), union_max));
     for plo in query_list.iter_mut().take(union_max).rev() {
         if plo.end_flag {
             continue;
@@ -759,7 +760,7 @@ pub(crate) async fn union_scan_32<'a>(
                     || query_terms_bitset & mask > 0)
             {
                 let mut query_terms_max_score_sum = 0f32;
-                for (j, plo) in query_list.iter().enumerate() {
+                for (j, plo) in query_list.iter().take(query_list_len).enumerate() {
                     if (query_terms_bitset & (1 << j)) > 0 {
                         query_terms_max_score_sum +=
                             plo.blocks[plo.p_block as usize].max_block_score;
```

**File**: `seekstorm/tests/union_topk_many_terms.rs` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+//! `union_scan_32` bitmask holds at most 32 terms; >32-term TopkCount must
+//! not panic (`32 - len` underflow) and must report the exact total.
+
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, DocumentCompression, FrequentwordType, IndexDocuments,
+    IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType, TokenizerType,
+    create_index,
+};
+use seekstorm::search::{QueryRewriting, QueryType, ResultType, Search, SearchMode};
+use seekstorm::vector::Inference;
+use std::{fs, path::Path};
+
+fn meta() -> IndexMetaObject {
+    IndexMetaObject {
+        id: 0,
+        name: "union_topk_many_terms".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: DocumentCompression::Snappy,
+        access_type: AccessType::Mmap,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    }
+}
+
+fn schema() -> Vec<seekstorm::index::SchemaField> {
+    serde_json::from_str(
+        r#"[{"field":"title","field_type":"Text","store":true,"index_lexical":true}]"#,
+    )
+    .unwrap()
+}
+
+fn doc(title: &str) -> seekstorm::index::Document {
+    serde_json::from_str(&format!(r#"{{"title":"{title}"}}"#)).unwrap()
+}
+
+async fn search(
+    index: &seekstorm::index::IndexArc,
+    query: &str,
+    result_type: ResultType,
+) -> seekstorm::search::ResultObject {
+    index
+        .search(
+            query.into(),
+            None,
+            QueryType::Union,
+            SearchMode::Lexical,
+            false,
+            0,
+            100,
+            result_type,
+            false,
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            QueryRewriting::SearchOnly,
+        )
+        .await
+}
+
+/// 40-term union TopkCount: no panic, exact total, top-k hits returned.
+#[tokio::test]
+async fn union_topk_forty_terms() {
+    let dir = "tests/index_union_topk_many_terms/";
+    let path = Path::new(dir);
+    let _ = fs::remove_dir_all(path);
+    let index = create_index(path, meta(), &schema(), &Vec::new(), 11, true, Some(1))
+        .await
+        .unwrap();
+
+    // 40 disjoint terms x 25 docs each = 1000 docs, all in one block.
+    let mut docs = vec![];
+    for t in 0..40 {
+        for i in 0..25 {
+            docs.push(doc(&format!("w{t:02} z{i}")));
+        }
+    }
+    index.index_documents(docs).await;
+    index.commit().await;
+
+    let query = (0..40)
+        .map(|t| format!("w{t:02}"))
+        .collect::<Vec<_>>()
+        .join(" ");
+
+    let count = search(&index, &query, ResultType::Count).await;
+    assert_eq!(count.result_count_total, 1000);
+
+    let topk_count = search(&index, &query, ResultType::TopkCount).await;
+    assert_eq!(topk_count.result_count_total, 1000);
+    assert_eq!(topk_count.result_count_total, count.result_count_total);
+
+    index.close().await;
+}
```

---

### Incident Patch 4: `79f671b4` (2026-09-11)
**Commit Message**: Merge pull request #84 from qkun-zh/fix/union-count-simplify

Simplify union_count counting; drop seed sort

**File**: `seekstorm/src/union.rs` (modified, +20/-50)
```diff
@@ -11,8 +11,8 @@ use crate::{
     search::{FilterSparse, Ranges, ResultType, SearchResult},
     single::{single_blockid, single_docid},
     utils::{
-        block_copy, read_f32, read_f64, read_i8, read_i16, read_i32, read_i64, read_u16, read_u32,
-        read_u64, write_u64,
+        read_f32, read_f64, read_i8, read_i16, read_i32, read_i64, read_u16, read_u32, read_u64,
+        write_u64,
     },
 };
 
@@ -814,13 +814,7 @@ pub(crate) async fn union_count<'a>(
     facet_filter: &[FilterSparse],
     block_id: usize,
 ) {
-    query_list.sort_unstable_by(|a, b| b.p_docid_count.partial_cmp(&a.p_docid_count).unwrap());
-
-    let first_valid_idx = query_list.iter().position(|plo| !plo.end_flag).unwrap_or(0);
-    let mut result_count_local = query_list[first_valid_idx].blocks
-        [query_list[first_valid_idx].p_block as usize]
-        .posting_count as u32
-        + 1;
+    let mut result_count_local = 0u32;
 
     let mut bitmap_0: [u8; 8192] = [0u8; 8192];
     let mut first_valid = true;
@@ -829,53 +823,32 @@ pub(crate) async fn union_count<'a>(
         if plo.end_flag {
             continue;
         }
+        let is_first = first_valid;
+        first_valid = false;
 
         if plo.compression_type == CompressionType::Bitmap {
-            if first_valid {
-                block_copy(
-                    plo.byte_array,
-                    plo.compressed_doc_id_range,
-                    &mut bitmap_0,
-                    0,
-                    8192,
-                );
-                first_valid = false;
-            } else {
-                for i in (0..8192).step_by(8) {
-                    let x1 = read_u64(&bitmap_0, i);
-                    let x2 = read_u64(&plo.byte_array[plo.compressed_doc_id_range..], i);
-                    result_count_local += u64::count_ones(!x1 & x2);
-                    write_u64(x1 | x2, &mut bitmap_0, i);
-                }
+            for i in (0..8192).step_by(8) {
+                let x1 = read_u64(&bitmap_0, i);
+                let x2 = read_u64(&plo.byte_array[plo.compressed_doc_id_range..], i);
+                result_count_local += u64::count_ones(!x1 & x2);
+                write_u64(x1 | x2, &mut bitmap_0, i);
             }
         } else if plo.compression_type == CompressionType::Array {
-            if first_valid {
-                for i in 0..plo.p_docid_count {
-                    let docid =
-                        read_u16(&plo.byte_array[plo.compressed_doc_id_range..], i * 2) as usize;
-                    let byte_index = docid >> 3;
-                    let bit_index = docid & 7;
+            for i in 0..plo.p_docid_count {
+                let docid =
+                    read_u16(&plo.byte_array[plo.compressed_doc_id_range..], i * 2) as usize;
+                let byte_index = docid >> 3;
+                let bit_index = docid & 7;
 
+                if bitmap_0[byte_index] & (1 << bit_index) == 0 {
                     bitmap_0[byte_index] |= 1 << bit_index;
-                }
-                first_valid = false;
-            } else {
-                for i in 0..plo.p_docid_count {
-                    let docid =
-                        read_u16(&plo.byte_array[plo.compressed_doc_id_range..], i * 2) as usize;
-                    let byte_index = docid >> 3;
-                    let bit_index = docid & 7;
-
-                    if bitmap_0[byte_index] & (1 << bit_index) == 0 {
-                        bitmap_0[byte_index] |= 1 << bit_index;
-                        result_count_local += 1;
-                    }
+                    result_count_local += 1;
                 }
             }
         } else {
             let runs_count = read_u16(&plo.byte_array[plo.compressed_doc_id_range..], 0) as i32;
 
-            if first_valid {
+            if is_first {
                 for ii in (1..(runs_count << 1) + 1).step_by(2) {
                     let startdocid = read_u16(
                         &plo.byte_array[plo.compress
```

**File**: `seekstorm/tests/union_count_plus_one.rs` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+//! Same-block overlapping union must count exactly (pins the `+1` encoding).
+
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, DocumentCompression, FrequentwordType, IndexArc, IndexDocuments,
+    IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType, TokenizerType,
+    create_index,
+};
+use seekstorm::search::{QueryRewriting, QueryType, ResultType, Search, SearchMode};
+use seekstorm::vector::Inference;
+use std::{fs, path::Path};
+
+fn meta() -> IndexMetaObject {
+    IndexMetaObject {
+        id: 0,
+        name: "union_count_plus_one".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: DocumentCompression::Snappy,
+        access_type: AccessType::Mmap,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    }
+}
+
+fn schema() -> Vec<seekstorm::index::SchemaField> {
+    serde_json::from_str(
+        r#"[{"field":"title","field_type":"Text","store":true,"index_lexical":true}]"#,
+    )
+    .unwrap()
+}
+
+fn doc(title: &str) -> seekstorm::index::Document {
+    serde_json::from_str(&format!(r#"{{"title":"{title}"}}"#)).unwrap()
+}
+
+async fn search(
+    index: &IndexArc,
+    query: &str,
+    result_type: ResultType,
+) -> seekstorm::search::ResultObject {
+    index
+        .search(
+            query.into(),
+            None,
+            QueryType::Union,
+            SearchMode::Lexical,
+            false,
+            0,
+            100,
+            result_type,
+            false,
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            QueryRewriting::SearchOnly,
+        )
+        .await
+}
+
+#[tokio::test]
+async fn union_count_overlap_same_block() {
+    let dir = "tests/index_union_plus_one/";
+    let path = Path::new(dir);
+    let _ = fs::remove_dir_all(path);
+    let index = create_index(path, meta(), &schema(), &Vec::new(), 11, true, Some(1))
+        .await
+        .unwrap();
+
+    // Overlapping docs: doc2, doc4 contain BOTH alpha and beta.
+    let docs = vec![
+        doc("alpha only item"),
+        doc("beta only item"),
+        doc("alpha beta both item"),
+        doc("alpha only item"),
+        doc("alpha beta both item"),
+        doc("beta only item"),
+    ];
+    index.index_documents(docs).await;
+    index.commit().await;
+
+    // 6 docs total in the same block; all contain at least one of alpha/beta.
+    let count = search(&index, "alpha beta", ResultType::Count).await;
+    let topk_count = search(&index, "alpha beta", ResultType::TopkCount).await;
+
+    let expected = 6;
+    println!("Count result: {}", count.result_count_total);
+    println!("TopkCount result: {}", topk_count.result_count_total);
+    assert_eq!(count.result_count_total, expected);
+    assert_eq!(topk_count.result_count_total, expected);
+
+    index.close().await;
+}
```

---

### Incident Patch 5: `6ace6278` (2026-09-10)
**Commit Message**: Fix union_scan_32 overflows past 32 query terms

The candidate bitmask is u32 (at most union_max terms take part in top-k scoring; totals for longer queries are repaired by union_count), but the initial mask u32::MAX >> (32 - len) underflows for >32-term queries, and the score-sum loop's 1 << j runs past bit 31. Clamp the mask length and cap the loop at query_list_len, matching the takes below.

Add seekstorm/tests/union_topk_many_terms.rs (40-term TopkCount panics without the fix; exact totals with it).

**File**: `seekstorm/src/union.rs` (modified, +3/-2)
```diff
@@ -621,7 +621,8 @@ pub(crate) async fn union_scan_32<'a>(
     });
 
     let mut max_score = 0.0;
-    let mut mask = u32::MAX >> (32 - query_list.len());
+    // Bitmask holds at most `union_max` terms; clamp or `32 - len` underflows.
+    let mut mask = u32::MAX >> (union_max - cmp::min(query_list.len(), union_max));
     for plo in query_list.iter_mut().take(union_max).rev() {
         if plo.end_flag {
             continue;
@@ -759,7 +760,7 @@ pub(crate) async fn union_scan_32<'a>(
                     || query_terms_bitset & mask > 0)
             {
                 let mut query_terms_max_score_sum = 0f32;
-                for (j, plo) in query_list.iter().enumerate() {
+                for (j, plo) in query_list.iter().take(query_list_len).enumerate() {
                     if (query_terms_bitset & (1 << j)) > 0 {
                         query_terms_max_score_sum +=
                             plo.blocks[plo.p_block as usize].max_block_score;
```

**File**: `seekstorm/tests/union_topk_many_terms.rs` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+//! `union_scan_32` bitmask holds at most 32 terms; >32-term TopkCount must
+//! not panic (`32 - len` underflow) and must report the exact total.
+
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, DocumentCompression, FrequentwordType, IndexDocuments,
+    IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType, TokenizerType,
+    create_index,
+};
+use seekstorm::search::{QueryRewriting, QueryType, ResultType, Search, SearchMode};
+use seekstorm::vector::Inference;
+use std::{fs, path::Path};
+
+fn meta() -> IndexMetaObject {
+    IndexMetaObject {
+        id: 0,
+        name: "union_topk_many_terms".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: DocumentCompression::Snappy,
+        access_type: AccessType::Mmap,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    }
+}
+
+fn schema() -> Vec<seekstorm::index::SchemaField> {
+    serde_json::from_str(
+        r#"[{"field":"title","field_type":"Text","store":true,"index_lexical":true}]"#,
+    )
+    .unwrap()
+}
+
+fn doc(title: &str) -> seekstorm::index::Document {
+    serde_json::from_str(&format!(r#"{{"title":"{title}"}}"#)).unwrap()
+}
+
+async fn search(
+    index: &seekstorm::index::IndexArc,
+    query: &str,
+    result_type: ResultType,
+) -> seekstorm::search::ResultObject {
+    index
+        .search(
+            query.into(),
+            None,
+            QueryType::Union,
+            SearchMode::Lexical,
+            false,
+            0,
+            100,
+            result_type,
+            false,
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            QueryRewriting::SearchOnly,
+        )
+        .await
+}
+
+/// 40-term union TopkCount: no panic, exact total, top-k hits returned.
+#[tokio::test]
+async fn union_topk_forty_terms() {
+    let dir = "tests/index_union_topk_many_terms/";
+    let path = Path::new(dir);
+    let _ = fs::remove_dir_all(path);
+    let index = create_index(path, meta(), &schema(), &Vec::new(), 11, true, Some(1))
+        .await
+        .unwrap();
+
+    // 40 disjoint terms x 25 docs each = 1000 docs, all in one block.
+    let mut docs = vec![];
+    for t in 0..40 {
+        for i in 0..25 {
+            docs.push(doc(&format!("w{t:02} z{i}")));
+        }
+    }
+    index.index_documents(docs).await;
+    index.commit().await;
+
+    let query = (0..40)
+        .map(|t| format!("w{t:02}"))
+        .collect::<Vec<_>>()
+        .join(" ");
+
+    let count = search(&index, &query, ResultType::Count).await;
+    assert_eq!(count.result_count_total, 1000);
+
+    let topk_count = search(&index, &query, ResultType::TopkCount).await;
+    assert_eq!(topk_count.result_count_total, 1000);
+    assert_eq!(topk_count.result_count_total, count.result_count_total);
+
+    index.close().await;
+}
```

---

### Incident Patch 6: `ca9b31be` (2026-09-08)
**Commit Message**: Merge pull request #81 from qkun-zh/fix/docstore-successor-after-empty

Fix get_document panic on doc following doc(s) with no stored fields

**File**: `seekstorm/src/doc_store.rs` (modified, +38/-11)
```diff
@@ -65,12 +65,30 @@ impl Shard {
             let position = doc_id_local * 4;
             let pointer = read_u32(docstore_pointer_docs, position) as usize;
 
-            let previous_pointer = if doc_id == self.committed_doc_count || doc_id_local == 0 {
+            let mut previous_pointer = if doc_id == self.committed_doc_count || doc_id_local == 0 {
                 ROARING_BLOCK_SIZE * 4
             } else {
                 read_u32(docstore_pointer_docs, position - 4) as usize
             };
 
+            if previous_pointer < ROARING_BLOCK_SIZE * 4 {
+                // Predecessor slot(s) unwritten: documents without stored
+                // fields write no pointer, leaving stale zeros. Walk back to
+                // the nearest written slot (doc data always starts after the
+                // pointer table), so a valid doc after empty one(s) reads
+                // exactly its own bytes instead of slicing from 0 and
+                // panicking below.
+                previous_pointer = ROARING_BLOCK_SIZE * 4;
+                let mut back = position;
+                while back > 0 {
+                    back -= 4;
+                    let slot = read_u32(docstore_pointer_docs, back) as usize;
+                    if slot > previous_pointer {
+                        previous_pointer = slot;
+                    }
+                }
+            }
+
             if previous_pointer >= pointer || pointer > docstore_pointer_docs.len() {
                 // Equal means an empty slot (e.g. a document with no stored
                 // fields, which writes no pointer). Greater, or an end offset
@@ -111,19 +129,28 @@ impl Shard {
             let position =
                 self.level_index[level].docstore_pointer_docs_pointer + (doc_id_local * 4);
 
-            let (previous_pointer, pointer) = if doc_id_local == 0 {
-                (
-                    ROARING_BLOCK_SIZE * 4,
-                    read_u32(&self.docstore_file_mmap, position) as usize,
-                )
+            let table_base = self.level_index[level].docstore_pointer_docs_pointer;
+            let pointer = read_u32(&self.docstore_file_mmap, position) as usize;
+            let mut previous_pointer = if doc_id_local == 0 {
+                ROARING_BLOCK_SIZE * 4
             } else {
-                (
-                    read_u32(&self.docstore_file_mmap, position - 4) as usize,
-                    read_u32(&self.docstore_file_mmap, position) as usize,
-                )
+                read_u32(&self.docstore_file_mmap, position - 4) as usize
             };
 
-            let table_base = self.level_index[level].docstore_pointer_docs_pointer;
+            if previous_pointer < ROARING_BLOCK_SIZE * 4 {
+                // Same stale-zero predecessor slots as in the RAM branch
+                // above: walk back within this block's table.
+                previous_pointer = ROARING_BLOCK_SIZE * 4;
+                let mut back = position;
+                while back > table_base {
+                    back -= 4;
+                    let slot = read_u32(&self.docstore_file_mmap, back) as usize;
+                    if slot > previous_pointer {
+                        previous_pointer = slot;
+                    }
+                }
+            }
+
             let start = table_base.saturating_add(previous_pointer);
             let end = table_base.saturating_add(pointer);
             if previous_pointer >= pointer || end > self.docstore_file_mmap.len() {
```

**File**: `seekstorm/tests/get_successor_doc.rs` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+//! Repro: get_document on a valid doc following doc(s) with no stored fields.
+//! Stale-zero predecessor slots made it slice from 0 and panic.
+//! Matrix: Ram/Mmap x None/Snappy. Public API only.
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, Document, DocumentCompression, FileType, FrequentwordType,
+    IndexDocument, IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType,
+    TokenizerType, create_index,
+};
+use seekstorm::vector::Inference;
+use std::{collections::HashSet, fs, path::Path};
+
+use futures::FutureExt;
+
+async fn run_case(access: AccessType, compression: DocumentCompression, tag: &str) {
+    let dir = format!("/tmp/repro_succ_{tag}/");
+    let index_path = Path::new(&dir);
+    let _ = fs::remove_dir_all(index_path);
+    let schema_json = r#"
+    [{"field":"title","field_type":"Text","store":true,"index_lexical":true,"longest":true},
+    {"field":"tag","field_type":"Text","store":false,"index_lexical":true}]"#;
+    let schema = serde_json::from_str(schema_json).unwrap();
+    let meta = IndexMetaObject {
+        id: 0,
+        name: "succ".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: compression,
+        access_type: access,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    };
+    let index_arc = create_index(index_path, meta, &schema, &Vec::new(), 11, false, Some(1))
+        .await
+        .unwrap();
+    // doc 0: indexed-only field -> no stored content -> slot stays 0.
+    // doc 1: another empty one (run of empties).
+    // doc 2: stored content right after the empty run.
+    // doc 3: stored baseline (real predecessor).
+    // doc 4: empty again; doc 5: stored content after a MIXED run
+    //   (real, empty, real) -> exercises the backward scan beyond what a
+    //   simple clamp-to-table would fix.
+    for json in [
+        r#"{"tag":"hello"}"#,
+        r#"{"tag":"world"}"#,
+        r#"{"title":"hello world"}"#,
+        r#"{"title":"baseline doc"}"#,
+        r#"{"tag":"again"}"#,
+        r#"{"title":"mixed successor"}"#,
+    ] {
+        let doc: Document = serde_json::from_str(json).unwrap();
+        index_arc.index_document(doc, FileType::None).await;
+    }
+    index_arc.commit().await;
+
+    let index = index_arc.read().await;
+    // Empty docs themselves stay not-found (documented behavior, cf. #72).
+    assert!(
+        index
+            .get_document(0, false, &None, &HashSet::new(), &Vec::new())
+            .await
+            .is_err()
+    );
+    assert!(
+        index
+            .get_document(1, false, &None, &HashSet::new(), &Vec::new())
+            .await
+            .is_err()
+    );
+    // The valid successors must come back with EXACT content, not panic.
+    for (id, want) in [
+        (2, "hello world"),
+        (3, "baseline doc"),
+        (5, "mixed successor"),
+    ] {
+        let doc = index
+            .get_document(id, false, &None, &HashSet::new(), &Vec::new())
+            .await
+            .unwrap_or_else(|e| panic!("BUG [{tag}]: valid doc {id} unreadable: {e}"));
+        let title: String = serde_json::from_value(doc.get("title").unwrap().clone()).unwrap();
+        assert_eq!(title, want, "BUG [{tag}]: wrong content for doc {id}");
+    }
+    drop(index);
+    index_arc.close().await;
+    let _ = fs::remove_dir_all(index_path);
+    println!("CASE {tag}: ok");
+}
+
+#[tokio::test]
+async fn successor_after_empty_matrix() {
+    let mut fails = 0;
+    for (access, compression, tag) in [
+        (AccessType::Ram, DocumentCompression::None, "ram-none"),
+      
```

---

### Incident Patch 7: `380e6945` (2026-09-08)
**Commit Message**: Merge pull request #80 from qkun-zh/fix/frequent-topk-empty-results

Fix empty Topk results for all-frequent multi-term queries

**File**: `seekstorm/src/add_result.rs` (modified, +4/-2)
```diff
@@ -3113,7 +3113,8 @@ pub(crate) fn add_result_multiterm_multifield(
             plo,
             !facet_filter.is_empty(),
             phrase_query,
-            all_terms_frequent && field_filter_set.is_empty(),
+            // count-only shortcut must not skip ranking for Topk/TopkCount
+            all_terms_frequent && field_filter_set.is_empty() && result_type == &ResultType::Count,
         ) {
             facet_count(shard, search_result, docid);
 
@@ -3547,7 +3548,8 @@ pub(crate) fn add_result_multiterm_singlefield(
             plo,
             !facet_filter.is_empty(),
             phrase_query,
-            all_terms_frequent && field_filter_set.is_empty(),
+            // count-only shortcut must not skip ranking for Topk/TopkCount
+            all_terms_frequent && field_filter_set.is_empty() && result_type == &ResultType::Count,
         ) {
             facet_count(shard, search_result, docid);
 
```

**File**: `seekstorm/tests/frequent_topk_consistency.rs` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+//! Repro: multi-term Topk/TopkCount over all-frequent terms must return results,
+//! not an empty heap. Pure public API.
+//! Run: cargo test -p seekstorm --test frequent_topk_consistency
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, Document, DocumentCompression, FileType, FrequentwordType,
+    IndexDocument, IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType,
+    TokenizerType, create_index,
+};
+use seekstorm::search::{QueryRewriting, QueryType, ResultType, Search, SearchMode};
+use seekstorm::vector::Inference;
+use std::{fs, path::Path};
+
+async fn search(
+    index_arc: &seekstorm::index::IndexArc,
+    q: &str,
+    qt: QueryType,
+    rt: ResultType,
+    len: usize,
+) -> seekstorm::search::ResultObject {
+    index_arc
+        .search(
+            q.into(),
+            None,
+            qt,
+            SearchMode::Lexical,
+            false,
+            0,
+            len,
+            rt,
+            false,
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            QueryRewriting::SearchOnly,
+        )
+        .await
+}
+
+#[tokio::test]
+async fn frequent_terms_topk_returns_results() {
+    let index_path = Path::new("/tmp/repro_frequent_topk/");
+    let _ = fs::remove_dir_all(index_path);
+    let schema_json = r#"
+    [{"field":"title","field_type":"Text","store":false,"index_lexical":true,"longest":true}]"#;
+    let schema = serde_json::from_str(schema_json).unwrap();
+    let meta = IndexMetaObject {
+        id: 0,
+        name: "repro".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: DocumentCompression::Snappy,
+        access_type: AccessType::Mmap,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    };
+    // NOTE: keep on the single-shard fast path; multi-shard covered by suite.
+    let index_arc = create_index(index_path, meta, &schema, &Vec::new(), 11, false, Some(1))
+        .await
+        .unwrap();
+
+    // 3000 docs: "common" in all (100%), "half" in evens (50%) -> every query
+    // term covers >=50% (all_terms_frequent); top_k=10 < 3000/256.
+    for i in 0..3000 {
+        let mut t = String::from("common ");
+        if i % 2 == 0 {
+            t.push_str("half ");
+        }
+        let doc: Document = serde_json::from_str(&format!(r#"{{"title":"{t}"}}"#)).unwrap();
+        index_arc.index_document(doc, FileType::None).await;
+    }
+    index_arc.commit().await;
+
+    // Intersection Topk must not come back empty with 1500 matches.
+    let rlo = search(
+        &index_arc,
+        "common half",
+        QueryType::Intersection,
+        ResultType::Topk,
+        10,
+    )
+    .await;
+    assert_eq!(
+        rlo.results.len(),
+        10,
+        "BUG: intersection Topk empty for all-frequent terms"
+    );
+
+    // TopkCount: same results, consistent totals.
+    let rtc = search(
+        &index_arc,
+        "common half",
+        QueryType::Intersection,
+        ResultType::TopkCount,
+        10,
+    )
+    .await;
+    assert_eq!(
+        rtc.results.len(),
+        10,
+        "BUG: intersection TopkCount results empty"
+    );
+    assert_eq!(
+        rtc.result_count_total, 1500,
+        "intersection total must count all matches"
+    );
+
+    // Counts were (and stay) correct — the bug only dropped ranking.
+    let c = search(
+        &index_arc,
+        "common half",
+        QueryType::Intersection,
+        ResultType::Count,
+        10,
+    )
+    .await;
+    assert_eq!(c.result_count_total, 1500);
+
+    index_a
```

---

### Incident Patch 8: `645dc5d0` (2026-09-08)
**Commit Message**: Merge pull request #79 from qkun-zh/fix/server-request-handler-panics

Fix remaining request-handler panics (slice bounds, body read)

**File**: `seekstorm_server/src/http_server.rs` (modified, +73/-15)
```diff
@@ -261,7 +261,11 @@ pub(crate) async fn http_request_handler(
                 return HttpServerError::IndexNotFound.into();
             };
 
-            let request_bytes = req.into_body().collect().await.unwrap().to_bytes();
+            let Ok(collected_body) = req.into_body().collect().await else {
+                return HttpServerError::BadRequest("failed to read request body".to_string())
+                    .into();
+            };
+            let request_bytes = collected_body.to_bytes();
 
             let archived_query_vector =
                 unsafe { access_unchecked::<ArchivedVec<f32>>(&request_bytes) };
@@ -341,7 +345,11 @@ pub(crate) async fn http_request_handler(
             let index_arc_clone = index_arc.clone();
             drop(apikey_list_ref);
 
-            let request_bytes = req.into_body().collect().await.unwrap().to_bytes();
+            let Ok(collected_body) = req.into_body().collect().await else {
+                return HttpServerError::BadRequest("failed to read request body".to_string())
+                    .into();
+            };
+            let request_bytes = collected_body.to_bytes();
 
             let search_request = match serde_json::from_slice::<SearchRequestObject>(&request_bytes)
             {
@@ -472,7 +480,11 @@ pub(crate) async fn http_request_handler(
                     search_mode: SearchMode::Lexical,
                 }
             } else {
-                let request_bytes = req.into_body().collect().await.unwrap().to_bytes();
+                let Ok(collected_body) = req.into_body().collect().await else {
+                    return HttpServerError::BadRequest("failed to read request body".to_string())
+                        .into();
+                };
+                let request_bytes = collected_body.to_bytes();
 
                 match request_bytes.is_empty() {
                     true => {
@@ -512,7 +524,11 @@ pub(crate) async fn http_request_handler(
                 return HttpServerError::RateLimitExceeded.into();
             }
 
-            let request_bytes = req.into_body().collect().await.unwrap().to_bytes();
+            let Ok(collected_body) = req.into_body().collect().await else {
+                return HttpServerError::BadRequest("failed to read request body".to_string())
+                    .into();
+            };
+            let request_bytes = collected_body.to_bytes();
 
             let create_index_request_object =
                 match serde_json::from_slice::<CreateIndexRequest>(&request_bytes) {
@@ -754,7 +770,11 @@ pub(crate) async fn http_request_handler(
                 .to_string();
             let file_path = Path::new(&file_path);
 
-            let request_bytes = req.into_body().collect().await.unwrap().to_bytes();
+            let Ok(collected_body) = req.into_body().collect().await else {
+                return HttpServerError::BadRequest("failed to read request body".to_string())
+                    .into();
+            };
+            let request_bytes = collected_body.to_bytes();
 
             let apikey_list_ref = apikey_list.read().await;
 
@@ -801,7 +821,11 @@ pub(crate) async fn http_request_handler(
             let index_arc_clone = index_arc.clone();
             drop(apikey_list_ref);
 
-            let request_bytes = req.into_body().collect().await.unwrap().to_bytes();
+            let Ok(collected_body) = req.into_body().collect().await else {
+                return HttpServerError::BadRequest("failed to read request body".to_string())
+                    .into();
+            };
+            let request_bytes = collected_body.to_bytes();
             let synonyms = match serde_json::from_slice::<Vec<Synonym>>(&request_bytes) {
                 Ok(create_index_request_object) => create_index_request_object,
                 Err(e) => {
@@ -845,7 +869,11 @@ pub(crate) async fn http_request_handler(
             let index_arc_clone = index_arc.clone();
             drop(apikey_list_ref);
 
-
```

---

### Incident Patch 9: `ef21c9ba` (2026-09-08)
**Commit Message**: Fix get_document panic on doc following doc(s) with no stored fields

Empty docs write no docstore pointer, leaving stale zeros; the successor read sliced from 0 and panicked in decompress/from_slice (Ram + Mmap, all codecs). Walk back to the nearest written predecessor slot (doc data always starts after the pointer table), returning exactly the doc's own bytes. Unwritten-slot and corrupt-offset guards unchanged.

Add seekstorm/tests/get_successor_doc.rs (Ram/Mmap x None/Snappy matrix; all four panic without the fix).

**File**: `seekstorm/src/doc_store.rs` (modified, +38/-11)
```diff
@@ -65,12 +65,30 @@ impl Shard {
             let position = doc_id_local * 4;
             let pointer = read_u32(docstore_pointer_docs, position) as usize;
 
-            let previous_pointer = if doc_id == self.committed_doc_count || doc_id_local == 0 {
+            let mut previous_pointer = if doc_id == self.committed_doc_count || doc_id_local == 0 {
                 ROARING_BLOCK_SIZE * 4
             } else {
                 read_u32(docstore_pointer_docs, position - 4) as usize
             };
 
+            if previous_pointer < ROARING_BLOCK_SIZE * 4 {
+                // Predecessor slot(s) unwritten: documents without stored
+                // fields write no pointer, leaving stale zeros. Walk back to
+                // the nearest written slot (doc data always starts after the
+                // pointer table), so a valid doc after empty one(s) reads
+                // exactly its own bytes instead of slicing from 0 and
+                // panicking below.
+                previous_pointer = ROARING_BLOCK_SIZE * 4;
+                let mut back = position;
+                while back > 0 {
+                    back -= 4;
+                    let slot = read_u32(docstore_pointer_docs, back) as usize;
+                    if slot > previous_pointer {
+                        previous_pointer = slot;
+                    }
+                }
+            }
+
             if previous_pointer >= pointer || pointer > docstore_pointer_docs.len() {
                 // Equal means an empty slot (e.g. a document with no stored
                 // fields, which writes no pointer). Greater, or an end offset
@@ -111,19 +129,28 @@ impl Shard {
             let position =
                 self.level_index[level].docstore_pointer_docs_pointer + (doc_id_local * 4);
 
-            let (previous_pointer, pointer) = if doc_id_local == 0 {
-                (
-                    ROARING_BLOCK_SIZE * 4,
-                    read_u32(&self.docstore_file_mmap, position) as usize,
-                )
+            let table_base = self.level_index[level].docstore_pointer_docs_pointer;
+            let pointer = read_u32(&self.docstore_file_mmap, position) as usize;
+            let mut previous_pointer = if doc_id_local == 0 {
+                ROARING_BLOCK_SIZE * 4
             } else {
-                (
-                    read_u32(&self.docstore_file_mmap, position - 4) as usize,
-                    read_u32(&self.docstore_file_mmap, position) as usize,
-                )
+                read_u32(&self.docstore_file_mmap, position - 4) as usize
             };
 
-            let table_base = self.level_index[level].docstore_pointer_docs_pointer;
+            if previous_pointer < ROARING_BLOCK_SIZE * 4 {
+                // Same stale-zero predecessor slots as in the RAM branch
+                // above: walk back within this block's table.
+                previous_pointer = ROARING_BLOCK_SIZE * 4;
+                let mut back = position;
+                while back > table_base {
+                    back -= 4;
+                    let slot = read_u32(&self.docstore_file_mmap, back) as usize;
+                    if slot > previous_pointer {
+                        previous_pointer = slot;
+                    }
+                }
+            }
+
             let start = table_base.saturating_add(previous_pointer);
             let end = table_base.saturating_add(pointer);
             if previous_pointer >= pointer || end > self.docstore_file_mmap.len() {
```

**File**: `seekstorm/tests/get_successor_doc.rs` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+//! Repro: get_document on a valid doc following doc(s) with no stored fields.
+//! Stale-zero predecessor slots made it slice from 0 and panic.
+//! Matrix: Ram/Mmap x None/Snappy. Public API only.
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, Document, DocumentCompression, FileType, FrequentwordType,
+    IndexDocument, IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType,
+    TokenizerType, create_index,
+};
+use seekstorm::vector::Inference;
+use std::{collections::HashSet, fs, path::Path};
+
+use futures::FutureExt;
+
+async fn run_case(access: AccessType, compression: DocumentCompression, tag: &str) {
+    let dir = format!("/tmp/repro_succ_{tag}/");
+    let index_path = Path::new(&dir);
+    let _ = fs::remove_dir_all(index_path);
+    let schema_json = r#"
+    [{"field":"title","field_type":"Text","store":true,"index_lexical":true,"longest":true},
+    {"field":"tag","field_type":"Text","store":false,"index_lexical":true}]"#;
+    let schema = serde_json::from_str(schema_json).unwrap();
+    let meta = IndexMetaObject {
+        id: 0,
+        name: "succ".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: compression,
+        access_type: access,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    };
+    let index_arc = create_index(index_path, meta, &schema, &Vec::new(), 11, false, Some(1))
+        .await
+        .unwrap();
+    // doc 0: indexed-only field -> no stored content -> slot stays 0.
+    // doc 1: another empty one (run of empties).
+    // doc 2: stored content right after the empty run.
+    // doc 3: stored baseline (real predecessor).
+    // doc 4: empty again; doc 5: stored content after a MIXED run
+    //   (real, empty, real) -> exercises the backward scan beyond what a
+    //   simple clamp-to-table would fix.
+    for json in [
+        r#"{"tag":"hello"}"#,
+        r#"{"tag":"world"}"#,
+        r#"{"title":"hello world"}"#,
+        r#"{"title":"baseline doc"}"#,
+        r#"{"tag":"again"}"#,
+        r#"{"title":"mixed successor"}"#,
+    ] {
+        let doc: Document = serde_json::from_str(json).unwrap();
+        index_arc.index_document(doc, FileType::None).await;
+    }
+    index_arc.commit().await;
+
+    let index = index_arc.read().await;
+    // Empty docs themselves stay not-found (documented behavior, cf. #72).
+    assert!(
+        index
+            .get_document(0, false, &None, &HashSet::new(), &Vec::new())
+            .await
+            .is_err()
+    );
+    assert!(
+        index
+            .get_document(1, false, &None, &HashSet::new(), &Vec::new())
+            .await
+            .is_err()
+    );
+    // The valid successors must come back with EXACT content, not panic.
+    for (id, want) in [
+        (2, "hello world"),
+        (3, "baseline doc"),
+        (5, "mixed successor"),
+    ] {
+        let doc = index
+            .get_document(id, false, &None, &HashSet::new(), &Vec::new())
+            .await
+            .unwrap_or_else(|e| panic!("BUG [{tag}]: valid doc {id} unreadable: {e}"));
+        let title: String = serde_json::from_value(doc.get("title").unwrap().clone()).unwrap();
+        assert_eq!(title, want, "BUG [{tag}]: wrong content for doc {id}");
+    }
+    drop(index);
+    index_arc.close().await;
+    let _ = fs::remove_dir_all(index_path);
+    println!("CASE {tag}: ok");
+}
+
+#[tokio::test]
+async fn successor_after_empty_matrix() {
+    let mut fails = 0;
+    for (access, compression, tag) in [
+        (AccessType::Ram, DocumentCompression::None, "ram-none"),
+      
```

---

### Incident Patch 10: `8f47166e` (2026-09-08)
**Commit Message**: Fix empty Topk results for all-frequent multi-term queries

The all_terms_frequent shortcut in decode_positions_multiterm_* returns count-only (skipping the heap) for Topk/TopkCount too, emptying results whenever every query term covers >=50% of docs and top_k < indexed/256, while counts stay correct and mask the bug.

Gate the shortcut on ResultType::Count at both call sites; Topk takes the full exact decode path. No behavior change for Count or valid queries.

Add seekstorm/tests/frequent_topk_consistency.rs (fails without the fix with 0 vs 10 results).

**File**: `seekstorm/src/add_result.rs` (modified, +4/-2)
```diff
@@ -3113,7 +3113,8 @@ pub(crate) fn add_result_multiterm_multifield(
             plo,
             !facet_filter.is_empty(),
             phrase_query,
-            all_terms_frequent && field_filter_set.is_empty(),
+            // count-only shortcut must not skip ranking for Topk/TopkCount
+            all_terms_frequent && field_filter_set.is_empty() && result_type == &ResultType::Count,
         ) {
             facet_count(shard, search_result, docid);
 
@@ -3547,7 +3548,8 @@ pub(crate) fn add_result_multiterm_singlefield(
             plo,
             !facet_filter.is_empty(),
             phrase_query,
-            all_terms_frequent && field_filter_set.is_empty(),
+            // count-only shortcut must not skip ranking for Topk/TopkCount
+            all_terms_frequent && field_filter_set.is_empty() && result_type == &ResultType::Count,
         ) {
             facet_count(shard, search_result, docid);
 
```

**File**: `seekstorm/tests/frequent_topk_consistency.rs` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+//! Repro: multi-term Topk/TopkCount over all-frequent terms must return results,
+//! not an empty heap. Pure public API.
+//! Run: cargo test -p seekstorm --test frequent_topk_consistency
+use seekstorm::commit::Commit;
+use seekstorm::index::{
+    AccessType, Close, Clustering, Document, DocumentCompression, FileType, FrequentwordType,
+    IndexDocument, IndexMetaObject, LexicalSimilarity, NgramSet, StemmerType, StopwordType,
+    TokenizerType, create_index,
+};
+use seekstorm::search::{QueryRewriting, QueryType, ResultType, Search, SearchMode};
+use seekstorm::vector::Inference;
+use std::{fs, path::Path};
+
+async fn search(
+    index_arc: &seekstorm::index::IndexArc,
+    q: &str,
+    qt: QueryType,
+    rt: ResultType,
+    len: usize,
+) -> seekstorm::search::ResultObject {
+    index_arc
+        .search(
+            q.into(),
+            None,
+            qt,
+            SearchMode::Lexical,
+            false,
+            0,
+            len,
+            rt,
+            false,
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            Vec::new(),
+            QueryRewriting::SearchOnly,
+        )
+        .await
+}
+
+#[tokio::test]
+async fn frequent_terms_topk_returns_results() {
+    let index_path = Path::new("/tmp/repro_frequent_topk/");
+    let _ = fs::remove_dir_all(index_path);
+    let schema_json = r#"
+    [{"field":"title","field_type":"Text","store":false,"index_lexical":true,"longest":true}]"#;
+    let schema = serde_json::from_str(schema_json).unwrap();
+    let meta = IndexMetaObject {
+        id: 0,
+        name: "repro".into(),
+        lexical_similarity: LexicalSimilarity::Bm25f,
+        tokenizer: TokenizerType::UnicodeAlphanumeric,
+        stemmer: StemmerType::None,
+        stop_words: StopwordType::None,
+        frequent_words: FrequentwordType::None,
+        ngram_indexing: NgramSet::SingleTerm as u8,
+        document_compression: DocumentCompression::Snappy,
+        access_type: AccessType::Mmap,
+        spelling_correction: None,
+        query_completion: None,
+        clustering: Clustering::None,
+        inference: Inference::None,
+    };
+    // NOTE: keep on the single-shard fast path; multi-shard covered by suite.
+    let index_arc = create_index(index_path, meta, &schema, &Vec::new(), 11, false, Some(1))
+        .await
+        .unwrap();
+
+    // 3000 docs: "common" in all (100%), "half" in evens (50%) -> every query
+    // term covers >=50% (all_terms_frequent); top_k=10 < 3000/256.
+    for i in 0..3000 {
+        let mut t = String::from("common ");
+        if i % 2 == 0 {
+            t.push_str("half ");
+        }
+        let doc: Document = serde_json::from_str(&format!(r#"{{"title":"{t}"}}"#)).unwrap();
+        index_arc.index_document(doc, FileType::None).await;
+    }
+    index_arc.commit().await;
+
+    // Intersection Topk must not come back empty with 1500 matches.
+    let rlo = search(
+        &index_arc,
+        "common half",
+        QueryType::Intersection,
+        ResultType::Topk,
+        10,
+    )
+    .await;
+    assert_eq!(
+        rlo.results.len(),
+        10,
+        "BUG: intersection Topk empty for all-frequent terms"
+    );
+
+    // TopkCount: same results, consistent totals.
+    let rtc = search(
+        &index_arc,
+        "common half",
+        QueryType::Intersection,
+        ResultType::TopkCount,
+        10,
+    )
+    .await;
+    assert_eq!(
+        rtc.results.len(),
+        10,
+        "BUG: intersection TopkCount results empty"
+    );
+    assert_eq!(
+        rtc.result_count_total, 1500,
+        "intersection total must count all matches"
+    );
+
+    // Counts were (and stay) correct — the bug only dropped ranking.
+    let c = search(
+        &index_arc,
+        "common half",
+        QueryType::Intersection,
+        ResultType::Count,
+        10,
+    )
+    .await;
+    assert_eq!(c.result_count_total, 1500);
+
+    index_a
```

#### Recent Merged Pull Requests:
- **PR #87** (2026-09-12): union_docid_3 subset recursion and fixed cap may cause bug (@qkun-zh)
- **PR #86** (2026-09-11): Fix the bug that there is no exemption for the heap that is not full (@qkun-zh)
- **PR #85** (2026-09-11): Fix union_scan_32 overflows past 32 query terms (@qkun-zh)
- **PR #84** (2026-09-11): Simplify union_count counting; drop seed sort (@qkun-zh)
- **PR #83** (2026-09-08): Cut temp allocs in Shard::index_posting via SmallVec (@qkun-zh)
- **PR #82** (2026-09-08): Write docstore pointer for empty docs (eliminate walk-back loop) (@qkun-zh)
- **PR #81** (2026-09-08): Fix get_document panic on doc following doc(s) with no stored fields (@qkun-zh)
- **PR #80** (2026-09-08): Fix the counting acceleration path was incorrectly applied to topk (@qkun-zh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
