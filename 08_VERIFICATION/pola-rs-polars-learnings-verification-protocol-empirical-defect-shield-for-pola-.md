# Verification Protocol: Verification Protocol: Empirical Defect Shield for pola-rs-polars-learnings

<!-- PROVENANCE_START
{
  "source_repository": "pola-rs-polars-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T17:07:53.406Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pola-rs-polars-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pola-rs-polars-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T17:07:53.406Z`  
> **Learning ID**: `LEARN-EVO-pola-rs-polars-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `pola-rs-polars-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source**: github ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Source Version**: `e02c237a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T17:06:42.780Z  
> **Learning ID**: `learn-github-pola-rs-polars`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): pola-rs/polars

> **Canonical Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T17:06:42.653Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 40385 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/chunk_iterator/chunks_exact.rs`
```
use std::slice::ChunksExact;

use super::{BitChunk, BitChunkIterExact};
use crate::trusted_len::TrustedLen;

/// An iterator over a slice of bytes in [`BitChunk`]s.
#[derive(Debug)]
pub struct BitChunksExact<'a, T: BitChunk> {
    iter: ChunksExact<'a, u8>,
    remainder: &'a [u8],
    remainder_len: usize,
    phantom: std::marker::PhantomData<T>,
}

impl<'a, T: BitChunk> BitChunksExact<'a, T> {
    /// Creates a new [`BitChunksExact`].
    #[inline]
    pub fn new(bitmap: &'a [u8], length: usize) -> Self {
        assert!(length <= bitmap.len() * 8);
        let size_of = size_of::<T>();

        let bitmap = &bitmap[..length.saturating_add(7) / 8];

        let split = (length / 8 / size_of) * size_of;
        let (chunks, remainder) = bitmap.split_at(split);
        let remainder_len = length - chunks.len() * 8;
        let iter = chunks.chunks_exact(size_of);

        Self {
            iter,
            remainder,
            remainder_len,
            phantom: std::marker::PhantomData,
        }
    }

    /// Returns the number of chunks of this iterator
    #[inline]
    pub fn len(&self) -> usize {
        self.iter.len()
    }

    /// Returns whether there are still elements in this iterator
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Returns the remaining [`BitChunk`]. It is zero iff `len / 8 == 0`.
    #[inline]
    pub fn remainder(&self) -> T {
        let remainder_bytes = self.remainder;
        if remainder_bytes.is_empty() {
            return T::zero();
        }
        let remainder = match remainder_bytes.try_into() {
            Ok(a) => a,
            Err(_) => {
                let mut remainder = T::zero().to_ne_bytes();
                remainder_bytes
                    .iter()
                    .enumerate()
                    .for_each(|(index, b)| remainder[index] = *b);
                remainder
            },
        };
        T::from_ne_bytes(remainder)
    }
}

impl<T: BitChunk> Iterator for BitChunksExact<'_, T> {
    type Item = T;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        self.iter.next().map(|x| match x.try_into() {
            Ok(a) => T::from_ne_bytes(a),
            Err(_) => unreachable!(),
        })
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.iter.size_hint()
    }
}

unsafe impl<T: BitChunk> TrustedLen for BitChunksExact<'_, T> {}

impl<T: BitChunk> BitChunkIterExact<T> for BitChunksExact<'_, T> {
    #[inline]
    fn remainder(&self) -> T {
        self.remainder()
    }

    #[inline]
    fn remainder_len(&self) -> usize {
        self.remainder_len
    }
}

```

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/chunk_iterator/merge.rs`
```
use super::BitChunk;

/// Merges 2 [`BitChunk`]s into a single [`BitChunk`] so that the new items represents
/// the bitmap where bits from `next` are placed in `current` according to `offset`.
/// # Panic
/// The caller must ensure that `0 < offset < size_of::<T>() * 8`
/// # Example
/// ```rust,ignore
/// let current = 0b01011001;
/// let next    = 0b01011011;
/// let result = merge_reversed(current, next, 1);
/// assert_eq!(result, 0b10101100);
/// ```
#[inline]
pub fn merge_reversed<T>(mut current: T, mut next: T, offset: usize) -> T
where
    T: BitChunk,
{
    // 8 _bits_:
    // current = [c0, c1, c2, c3, c4, c5, c6, c7]
    // next =    [n0, n1, n2, n3, n4, n5, n6, n7]
    // offset = 3
    // expected = [n5, n6, n7, c0, c1, c2, c3, c4]

    // 1. unset most significants of `next` up to `offset`
    let inverse_offset = size_of::<T>() * 8 - offset;
    next <<= inverse_offset;
    // next    =  [n5, n6, n7, 0 , 0 , 0 , 0 , 0 ]

    // 2. unset least significants of `current` up to `offset`
    current >>= offset;
    // current =  [0 , 0 , 0 , c0, c1, c2, c3, c4]

    current | next
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_reversed() {
        let current = 0b00000000;
        let next = 0b00000001;
        let result = merge_reversed::<u8>(current, next, 1);
        assert_eq!(result, 0b10000000);

        let current = 0b01011001;
        let next = 0b01011011;
        let result = merge_reversed::<u8>(current, next, 1);
        assert_eq!(result, 0b10101100);
    }

    #[test]
    fn test_merge_reversed_offset2() {
        let current = 0b00000000;
        let next = 0b00000001;
        let result = merge_reversed::<u8>(current, next, 3);
        assert_eq!(result, 0b00100000);
    }
}

```

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/chunk_iterator/mod.rs`
```
mod chunks_exact;
mod merge;

pub use chunks_exact::BitChunksExact;
pub(crate) use merge::merge_reversed;

use crate::trusted_len::TrustedLen;
pub use crate::types::BitChunk;
use crate::types::BitChunkIter;

/// Trait representing an exact iterator over bytes in [`BitChunk`].
pub trait BitChunkIterExact<B: BitChunk>: TrustedLen<Item = B> {
    /// The remainder of the iterator.
    fn remainder(&self) -> B;

    /// The number of items in the remainder
    fn remainder_len(&self) -> usize;

    /// An iterator over individual items of the remainder
    #[inline]
    fn remainder_iter(&self) -> BitChunkIter<B> {
        BitChunkIter::new(self.remainder(), self.remainder_len())
    }
}

/// This struct is used to efficiently iterate over bit masks by loading bytes on
/// the stack with alignments of `uX`. This allows efficient iteration over bitmaps.
#[derive(Debug)]
pub struct BitChunks<'a, T: BitChunk> {
    chunk_iterator: std::slice::ChunksExact<'a, u8>,
    current: T,
    remainder_bytes: &'a [u8],
    last_chunk: T,
    remaining: usize,
    /// offset inside a byte
    bit_offset: usize,
    len: usize,
    phantom: std::marker::PhantomData<T>,
}

/// writes `bytes` into `dst`.
#[inline]
fn copy_with_merge<T: BitChunk>(dst: &mut T::Bytes, bytes: &[u8], bit_offset: usize) {
    bytes
        .windows(2)
        .chain(std::iter::once([bytes[bytes.len() - 1], 0].as_ref()))
        .take(size_of::<T>())
        .enumerate()
        .for_each(|(i, w)| {
            let val = merge_reversed(w[0], w[1], bit_offset);
            dst[i] = val;
        });
}

impl<'a, T: BitChunk> BitChunks<'a, T> {
    /// Creates a [`BitChunks`].
    pub fn new(slice: &'a [u8], offset: usize, len: usize) -> Self {
        assert!(offset + len <= slice.len() * 8);

        let slice = &slice[offset / 8..];
        let bit_offset = offset % 8;
        let size_of = size_of::<T>();

        let bytes_len = len / 8;
        let bytes_upper_len = (len + bit_offset).div_ceil(8);
        let mut chunks = slice[..bytes_len].chunks_exact(size_of);

        let remainder = &slice[bytes_len - chunks.remainder().len()..bytes_upper_len];

        let remainder_bytes = if chunks.len() == 0 { slice } else { remainder };

        let last_chunk = remainder_bytes
            .first()
            .map(|first| {
                let mut last = T::zero().to_ne_bytes();
                last[0] = *first;
                T::from_ne_bytes(last)
            })
            .unwrap_or_else(T::zero);

        let remaining = chunks.size_hint().0;

        let current = chunks
            .next()
            .map(|x| match x.try_into() {
                Ok(a) => T::from_ne_bytes(a),
                Err(_) => unreachable!(),
            })
            .unwrap_or_else(T::zero);

        Self {
            chunk_iterator: chunks,
            len,
            current,
            remaining,
            remainder_bytes,
            last_chunk,
            bit_offset,
            phantom: std::marker::PhantomData,
        }
    }

    #[inline]
    fn load_next(&mut self) {
        self.current = match self.chunk_iterator.next().unwrap().try_into() {
            Ok(a) => T::from_ne_bytes(a),
            Err(_) => unreachable!(),
        };
    }

    /// Returns the remainder [`BitChunk`].
    pub fn remainder(&self) -> T {
        // remaining bytes may not fit in `size_of::<T>()`. We complement
        // them to fit by allocating T and writing to it byte by byte
        let mut remainder = T::zero().to_ne_bytes();

        let remainder = match (self.remainder_bytes.is_empty(), self.bit_offset == 0) {
            (true, _) => remainder,
            (false, true) => {
                // all remaining bytes
                self.remainder_bytes
                    .iter()
                    .take(size_of::<T>())
                    .enumerate()
                    .for_each(|(i, val)| remainder[i] = *val);

                remainder
            },
            (false, false) => {
                // all remaining bytes
                copy_with_merge::<T>(&mut remainder, self.remainder_bytes, self.bit_offset);
                remainder
            },
        };
        let mut remainder = T::from_ne_bytes(remainder);
        let mask = (T::one() << self.remainder_len()) - T::one();
        remainder &= mask;
        remainder
    }

    /// Returns the remainder bits in [`BitChunks::remainder`].
    pub fn remainder_len(&self) -> usize {
        self.len - (size_of::<T>() * ((self.len / 8) / size_of::<T>()) * 8)
    }
}

impl<T: BitChunk> Iterator for BitChunks<'_, T> {
    type Item = T;

    #[inline]
    fn next(&mut self) -> Option<T> {
        if self.remaining == 0 {
            return None;
        }

        let current = self.current;
        let combined = if self.bit_offset == 0 {
            // fast case where there is no offset. In this case, there is bit-alignment
            // at byte boundary and thus the bytes correspond exactly.
            if self.remaining >= 2 {
                self.load_next();
            }
            current
        } else {
            let next = if self.remaining >= 2 {
                // case where `next` is complete and thus we can take it all
                self.load_next();
                self.current
            } else {
                // case where the `next` is incomplete and thus we take the remaining
                self.last_chunk
            };
            merge_reversed(current, next, self.bit_offset)
        };

        self.remaining -= 1;
        Some(combined)
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        // it contains always one more than the chunk_iterator, which is the last
        // one where the remainder is merged into current.
        (self.remaining, Some(self.remaining))
    }
}

impl<T: BitChunk> BitChunkIterExact<T> for BitChunks<'_, T> {
    #[inline]
    fn remainder(&self) -> T {
        self.remainder()
    }

    #[inline]
    fn remainder_len(&self) -> usize {
        self.remainder_len()
    }
}

impl<T: BitChunk> ExactSizeIterator for BitChunks<'_, T> {
    #[inline]
    fn len(&self) -> usize {
        self.chunk_iterator.len()
    }
}

unsafe impl<T: BitChunk> TrustedLen for BitChunks<'_, T> {}

```

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/chunks_exact_mut.rs`
```
use super::BitChunk;

/// An iterator over mutable slices of bytes of exact size.
///
/// # Safety
/// The slices returned by this iterator are guaranteed to have length equal to
/// `size_of::<T>()`.
#[derive(Debug)]
pub struct BitChunksExactMut<'a, T: BitChunk> {
    chunks: std::slice::ChunksExactMut<'a, u8>,
    remainder: &'a mut [u8],
    remainder_len: usize,
    marker: std::marker::PhantomData<T>,
}

impl<'a, T: BitChunk> BitChunksExactMut<'a, T> {
    /// Returns a new [`BitChunksExactMut`]
    #[inline]
    pub fn new(bitmap: &'a mut [u8], length: usize) -> Self {
        assert!(length <= bitmap.len() * 8);
        let size_of = size_of::<T>();

        let bitmap = &mut bitmap[..length.saturating_add(7) / 8];

        let split = (length / 8 / size_of) * size_of;
        let (chunks, remainder) = bitmap.split_at_mut(split);
        let remainder_len = length - chunks.len() * 8;

        let chunks = chunks.chunks_exact_mut(size_of);
        Self {
            chunks,
            remainder,
            remainder_len,
            marker: std::marker::PhantomData,
        }
    }

    /// The remainder slice
    #[inline]
    pub fn remainder(&mut self) -> &mut [u8] {
        self.remainder
    }

    /// The length of the remainder slice in bits.
    #[inline]
    pub fn remainder_len(&mut self) -> usize {
        self.remainder_len
    }
}

impl<'a, T: BitChunk> Iterator for BitChunksExactMut<'a, T> {
    type Item = &'a mut [u8];

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        self.chunks.next()
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.chunks.size_hint()
    }
}

```

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/fmt.rs`
```
use std::fmt::Write;

use super::is_set;

/// Formats `bytes` taking into account an offset and length of the form
pub fn fmt(
    bytes: &[u8],
    offset: usize,
    length: usize,
    f: &mut std::fmt::Formatter<'_>,
) -> std::fmt::Result {
    assert!(offset < 8);

    write!(f, "Bitmap {{ len: {length}, offset: {offset}, bytes: [")?;
    let mut remaining = length;
    if remaining == 0 {
        f.write_str("] }")?;
        return Ok(());
    }

    let first = bytes[0];
    let bytes = &bytes[1..];
    let empty_before = 8usize.saturating_sub(remaining + offset);
    f.write_str("0b")?;
    for _ in 0..empty_before {
        f.write_char('_')?;
    }
    let until = std::cmp::min(8, offset + remaining);
    for i in offset..until {
        if is_set(first, offset + until - 1 - i) {
            f.write_char('1')?;
        } else {
            f.write_char('0')?;
        }
    }
    for _ in 0..offset {
        f.write_char('_')?;
    }
    remaining -= until - offset;

    if remaining == 0 {
        f.write_str("] }")?;
        return Ok(());
    }

    let number_of_bytes = remaining / 8;
    for byte in &bytes[..number_of_bytes] {
        f.write_str(", ")?;
        f.write_fmt(format_args!("{byte:#010b}"))?;
    }
    remaining -= number_of_bytes * 8;
    if remaining == 0 {
        f.write_str("] }")?;
        return Ok(());
    }

    let last = bytes[std::cmp::min((length + offset).div_ceil(8), bytes.len() - 1)];
    let remaining = (length + offset) % 8;
    f.write_str(", ")?;
    f.write_str("0b")?;
    for _ in 0..(8 - remaining) {
        f.write_char('_')?;
    }
    for i in 0..remaining {
        if is_set(last, remaining - 1 - i) {
            f.write_char('1')?;
        } else {
            f.write_char('0')?;
        }
    }
    f.write_str("] }")
}

```

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/iterator.rs`
```
use polars_utils::slice::load_padded_le_u64;

use super::get_bit_unchecked;
use crate::bitmap::MutableBitmap;
use crate::trusted_len::TrustedLen;

/// An iterator over bits according to the [LSB](https://en.wikipedia.org/wiki/Bit_numbering#Least_significant_bit),
/// i.e. the bytes `[4u8, 128u8]` correspond to `[false, false, true, false, ..., true]`.
#[derive(Debug, Clone)]
pub struct BitmapIter<'a> {
    bytes: &'a [u8],
    word: u64,
    word_len: usize,
    rest_len: usize,
}

impl<'a> BitmapIter<'a> {
    /// Creates a new [`BitmapIter`].
    pub fn new(bytes: &'a [u8], offset: usize, len: usize) -> Self {
        if len == 0 {
            return Self {
                bytes,
                word: 0,
                word_len: 0,
                rest_len: 0,
            };
        }

        assert!(bytes.len() * 8 >= offset + len);
        let first_byte_idx = offset / 8;
        let bytes = &bytes[first_byte_idx..];
        let offset = offset % 8;

        // Make sure during our hot loop all our loads are full 8-byte loads
        // by loading the remainder now if it exists.
        let word = load_padded_le_u64(bytes) >> offset;
        let mod8 = bytes.len() % 8;
        let first_word_bytes = if mod8 > 0 { mod8 } else { 8 };
        let bytes = &bytes[first_word_bytes..];

        let word_len = (first_word_bytes * 8 - offset).min(len);
        let rest_len = len - word_len;
        Self {
            bytes,
            word,
            word_len,
            rest_len,
        }
    }

    /// Consumes and returns the number of `1` / `true` values at the beginning of the iterator.
    ///
    /// This performs the same operation as `(&mut iter).take_while(|b| b).count()`.
    ///
    /// This is a lot more efficient than consecutively polling the iterator and should therefore
    /// be preferred, if the use-case allows for it.
    pub fn take_leading_ones(&mut self) -> usize {
        let word_ones = usize::min(self.word_len, self.word.trailing_ones() as usize);
        self.word_len -= word_ones;
        self.word = self.word.wrapping_shr(word_ones as u32);

        if self.word_len != 0 {
            return word_ones;
        }

        let mut num_leading_ones = word_ones;

        while self.rest_len != 0 {
            self.word_len = usize::min(self.rest_len, 64);
            self.rest_len -= self.word_len;

            unsafe {
                let chunk = self.bytes.get_unchecked(..8).try_into().unwrap();
                self.word = u64::from_le_bytes(chunk);
                self.bytes = self.bytes.get_unchecked(8..);
            }

            let word_ones = usize::min(self.word_len, self.word.trailing_ones() as usize);
            self.word_len -= word_ones;
            self.word = self.word.wrapping_shr(word_ones as u32);
            num_leading_ones += word_ones;

            if self.word_len != 0 {
                return num_leading_ones;
            }
        }

        num_leading_ones
    }

    /// Consumes and returns the number of `0` / `false` values at the start of the iterator.
    ///
    /// This performs the same operation as `(&mut iter).take_while(|b| !b).count()`.
    ///
    /// This is a lot more efficient than consecutively polling the iterator and should therefore
    /// be preferred, if the use-case allows for it.
    pub fn take_leading_zeros(&mut self) -> usize {
        let word_zeros = usize::min(self.word_len, self.word.trailing_zeros() as usize);
        self.word_len -= word_zeros;
        self.word = self.word.wrapping_shr(word_zeros as u32);

        if self.word_len != 0 {
            return word_zeros;
        }

        let mut num_leading_zeros = word_zeros;

        while self.rest_len != 0 {
            self.word_len = usize::min(self.rest_len, 64);
            self.rest_len -= self.word_len;
            unsafe {
                let chunk = self.bytes.get_unchecked(..8).try_into().unwrap();
                self.word = u64::from_le_bytes(chunk);
                self.bytes = self.bytes.get_unchecked(8..);
            }

            let word_zeros = usize::min(self.word_len, self.word.trailing_zeros() as usize);
            self.word_len -= word_zeros;
            self.word = self.word.wrapping_shr(word_zeros as u32);
            num_leading_zeros += word_zeros;

            if self.word_len != 0 {
                return num_leading_zeros;
            }
        }

        num_leading_zeros
    }

    /// Returns the number of remaining elements in the iterator
    #[inline]
    pub fn num_remaining(&self) -> usize {
        self.word_len + self.rest_len
    }

    /// Collect at most `n` elements from this iterator into `bitmap`
    pub fn collect_n_into(&mut self, bitmap: &mut MutableBitmap, n: usize) {
        fn collect_word(
            word: &mut u64,
            word_len: &mut usize,
            bitmap: &mut MutableBitmap,
            n: &mut usize,
        ) {
            while *n > 0 && *word_len > 0 {
                {
                    let trailing_ones = u32::min(word.trailing_ones(), *word_len as u32);
                    let shift = u32::min(usize::min(*n, u32::MAX as usize) as u32, trailing_ones);
                    *word = word.wrapping_shr(shift);
                    *word_len -= shift as usize;
                    *n -= shift as usize;

                    bitmap.extend_constant(shift as usize, true);
                }

                {
                    let trailing_zeros = u32::min(word.trailing_zeros(), *word_len as u32);
                    let shift = u32::min(usize::min(*n, u32::MAX as usize) as u32, trailing_zeros);
                    *word = word.wrapping_shr(shift);
                    *word_len -= shift as usize;
                    *n -= shift as usize;

                    bitmap.extend_constant(shift as usize, false);
                }
            }
        }

        let mut n = usize::min(n, self.num_remaining());
        bitmap.reserve(n);

        collect_word(&mut self.word, &mut self.word_len, bitmap, &mut n);

        if n == 0 {
            return;
        }

        let num_words = n / 64;

        if num_words > 0 {
            assert!(self.bytes.len() >= num_words * size_of::<u64>());

            bitmap.extend_from_slice(self.bytes, 0, num_words * u64::BITS as usize);

            self.bytes = unsafe { self.bytes.get_unchecked(num_words * 8..) };
            self.rest_len -= num_words * u64::BITS as usize;
            n -= num_words * u64::BITS as usize;
        }

        if n == 0 {
            return;
        }

        assert!(self.bytes.len() >= size_of::<u64>());

        self.word_len = usize::min(self.rest_len, 64);
        self.rest_len -= self.word_len;
        unsafe {
            let chunk = self.bytes.get_unchecked(..8).try_into().unwrap();
            self.word = u64::from_le_bytes(chunk);
            self.bytes = self.bytes.get_unchecked(8..);
        }

        collect_word(&mut self.word, &mut self.word_len, bitmap, &mut n);

        debug_assert!(self.num_remaining() == 0 || n == 0);
    }
}

impl Iterator for BitmapIter<'_> {
    type Item = bool;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        if self.word_len == 0 {
            if self.rest_len == 0 {
                return None;
            }

            self.word_len = self.rest_len.min(64);
            self.rest_len -= self.word_len;

            unsafe {
                let chunk = self.bytes.get_unchecked(..8).try_into().unwrap();
                self.word = u64::from_le_bytes(chunk);
                self.bytes = self.bytes.get_unchecked(8..);
            }
        }

        let ret = self.word & 1 != 0;
        self.word >>= 1;
        self.word_len -= 1;
        Some(ret)
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        let num_remaining = self.num_remaining();
        (num_remaining, Some(num_remaining))
    }

    #[inline]
    fn fold<B, F>(self, init: B, mut f: F) -> B
    where
        F: FnMut(B, Self::Item) -> B,
    {
        let mut acc = init;
        let mut word = self.word;
        let mut word_len = self.word_len;
        let mut bytes = self.bytes;
        let mut rest_len = self.rest_len;
        loop {
            for i in 0..word_len {
                acc = f(acc, (word >> i) & 1 != 0);
            }
            if rest_len == 0 {
                return acc;
            }
            word_len = rest_len.min(64);
            rest_len -= word_len;
            unsafe {
                let chunk = bytes.get_unchecked(..8).try_into().unwrap();
                word = u64::from_le_bytes(chunk);
                bytes = bytes.get_unchecked(8..);
            }
        }
    }

    #[inline]
    fn nth(&mut self, mut n: usize) -> Option<Self::Item> {
        if n >= self.word_len + self.rest_len {
            self.word = 0;
            self.word_len = 0;
            self.rest_len = 0;
            return None;
        }

        // Advance words in buffer, skip words as needed
        if n >= self.word_len {
            n -= self.word_len;

            let word_offset = n / 64;
            n -= word_offset * 64;
            self.rest_len -= word_offset * 64;

            self.word_len = self.rest_len.min(64);
            self.rest_len -= self.word_len;

            let byte_offset = 8 * word_offset;

            // Safety: bytes is large enough at construction time.
            debug_assert!(byte_offset + 8 <= self.bytes.len());
            unsafe {
                let chunk = self
                    .bytes
                    .get_unchecked(byte_offset..byte_offset + 8)
                    .try_into()
                    .unwrap();
                self.word = u64::from_le_bytes(chunk);
                self.bytes = self.bytes.get_unchecked(byte_offset + 8..);
            }
        }

        // At this point, n < self.word_len
        debug_assert!(self.word_len > n);

        // Advance index by n and take value at final index
        self.word >>= n;
        sel
```

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/mod.rs`
```
#![allow(unsafe_op_in_unsafe_fn)]
//! General utilities for bitmaps representing items where LSB is the first item.
mod chunk_iterator;
mod chunks_exact_mut;
mod fmt;
mod iterator;
mod slice_iterator;
mod zip_validity;

pub(crate) use chunk_iterator::merge_reversed;
pub use chunk_iterator::{BitChunk, BitChunkIterExact, BitChunks, BitChunksExact};
pub use chunks_exact_mut::BitChunksExactMut;
pub use fmt::fmt;
pub use iterator::BitmapIter;
use polars_utils::slice::load_padded_le_u64;
pub use slice_iterator::SlicesIterator;
pub use zip_validity::{ZipValidity, ZipValidityIter};

use crate::bitmap::aligned::AlignedBitmapSlice;

/// Returns whether bit at position `i` in `byte` is set or not
#[inline]
pub fn is_set(byte: u8, i: usize) -> bool {
    debug_assert!(i < 8);
    byte & (1 << i) != 0
}

/// Sets bit at position `i` in `byte`.
#[inline(always)]
pub fn set_bit_in_byte(byte: u8, i: usize, value: bool) -> u8 {
    debug_assert!(i < 8);
    let mask = !(1 << i);
    let insert = (value as u8) << i;
    (byte & mask) | insert
}

/// Returns whether bit at position `i` in `bytes` is set or not.
///
/// # Safety
/// `i >= bytes.len() * 8` results in undefined behavior.
#[inline(always)]
pub unsafe fn get_bit_unchecked(bytes: &[u8], i: usize) -> bool {
    let byte = *bytes.get_unchecked(i / 8);
    let bit = (byte >> (i % 8)) & 1;
    bit != 0
}

/// Sets bit at position `i` in `bytes` without doing bound checks.
/// # Safety
/// `i >= bytes.len() * 8` results in undefined behavior.
#[inline(always)]
pub unsafe fn set_bit_unchecked(bytes: &mut [u8], i: usize, value: bool) {
    let byte = bytes.get_unchecked_mut(i / 8);
    *byte = set_bit_in_byte(*byte, i % 8, value);
}

/// Returns the number of bytes required to hold `bits` bits.
#[inline]
pub fn bytes_for(bits: usize) -> usize {
    bits.saturating_add(7) / 8
}

/// Returns the number of zero bits in the slice offsetted by `offset` and a length of `length`.
/// # Panics
/// This function panics iff `offset + len > 8 * slice.len()``.
pub fn count_zeros(slice: &[u8], offset: usize, len: usize) -> usize {
    if len == 0 {
        return 0;
    }

    assert!(8 * slice.len() >= offset + len);

    // Fast-path: fits in a single u64 load.
    let first_byte_idx = offset / 8;
    let offset_in_byte = offset % 8;
    if offset_in_byte + len <= 64 {
        let mut word = load_padded_le_u64(&slice[first_byte_idx..]);
        word >>= offset_in_byte;
        word <<= 64 - len;
        return len - word.count_ones() as usize;
    }

    let aligned = AlignedBitmapSlice::<u64>::new(slice, offset, len);
    let ones_in_prefix = aligned.prefix().count_ones() as usize;
    let ones_in_bulk: usize = aligned.bulk_iter().map(|w| w.count_ones() as usize).sum();
    let ones_in_suffix = aligned.suffix().count_ones() as usize;
    len - ones_in_prefix - ones_in_bulk - ones_in_suffix
}

/// Returns the number of zero bits before seeing a one bit in the slice offsetted by `offset` and
/// a length of `length`.
///
/// # Panics
/// This function panics iff `offset + len > 8 * slice.len()``.
pub fn leading_zeros(slice: &[u8], offset: usize, len: usize) -> usize {
    if len == 0 {
        return 0;
    }

    assert!(8 * slice.len() >= offset + len);

    let aligned = AlignedBitmapSlice::<u64>::new(slice, offset, len);
    let leading_zeros_in_prefix =
        (aligned.prefix().trailing_zeros() as usize).min(aligned.prefix_bitlen());
    if leading_zeros_in_prefix < aligned.prefix_bitlen() {
        return leading_zeros_in_prefix;
    }
    if let Some(full_zero_bulk_words) = aligned.bulk_iter().position(|w| w != 0) {
        return aligned.prefix_bitlen()
            + full_zero_bulk_words * 64
            + aligned.bulk()[full_zero_bulk_words].trailing_zeros() as usize;
    }

    aligned.prefix_bitlen()
        + aligned.bulk_bitlen()
        + (aligned.suffix().trailing_zeros() as usize).min(aligned.suffix_bitlen())
}

/// Returns the number of one bits before seeing a zero bit in the slice offsetted by `offset` and
/// a length of `length`.
///
/// # Panics
/// This function panics iff `offset + len > 8 * slice.len()``.
pub fn leading_ones(slice: &[u8], offset: usize, len: usize) -> usize {
    if len == 0 {
        return 0;
    }

    assert!(8 * slice.len() >= offset + len);

    let aligned = AlignedBitmapSlice::<u64>::new(slice, offset, len);
    let leading_ones_in_prefix = aligned.prefix().trailing_ones() as usize;
    if leading_ones_in_prefix < aligned.prefix_bitlen() {
        return leading_ones_in_prefix;
    }
    if let Some(full_one_bulk_words) = aligned.bulk_iter().position(|w| w != u64::MAX) {
        return aligned.prefix_bitlen()
            + full_one_bulk_words * 64
            + aligned.bulk()[full_one_bulk_words].trailing_ones() as usize;
    }

    aligned.prefix_bitlen() + aligned.bulk_bitlen() + aligned.suffix().trailing_ones() as usize
}

/// Returns the number of zero bits before seeing a one bit in the slice offsetted by `offset` and
/// a length of `length`.
///
/// # Panics
/// This function panics iff `offset + len > 8 * slice.len()``.
pub fn trailing_zeros(slice: &[u8], offset: usize, len: usize) -> usize {
    if len == 0 {
        return 0;
    }

    assert!(8 * slice.len() >= offset + len);

    let aligned = AlignedBitmapSlice::<u64>::new(slice, offset, len);
    let trailing_zeros_in_suffix = ((aligned.suffix() << ((64 - aligned.suffix_bitlen()) % 64))
        .leading_zeros() as usize)
        .min(aligned.suffix_bitlen());
    if trailing_zeros_in_suffix < aligned.suffix_bitlen() {
        return trailing_zeros_in_suffix;
    }
    if let Some(full_zero_bulk_words) = aligned.bulk_iter().rev().position(|w| w != 0) {
        return aligned.suffix_bitlen()
            + full_zero_bulk_words * 64
            + aligned.bulk()[aligned.bulk().len() - full_zero_bulk_words - 1].leading_zeros()
                as usize;
    }

    let trailing_zeros_in_prefix = ((aligned.prefix() << ((64 - aligned.prefix_bitlen()) % 64))
        .leading_zeros() as usize)
        .min(aligned.prefix_bitlen());
    aligned.suffix_bitlen() + aligned.bulk_bitlen() + trailing_zeros_in_prefix
}

/// Returns the number of one bits before seeing a zero bit in the slice offsetted by `offset` and
/// a length of `length`.
///
/// # Panics
/// This function panics iff `offset + len > 8 * slice.len()``.
pub fn trailing_ones(slice: &[u8], offset: usize, len: usize) -> usize {
    if len == 0 {
        return 0;
    }

    assert!(8 * slice.len() >= offset + len);

    let aligned = AlignedBitmapSlice::<u64>::new(slice, offset, len);
    let trailing_ones_in_suffix =
        (aligned.suffix() << ((64 - aligned.suffix_bitlen()) % 64)).leading_ones() as usize;
    if trailing_ones_in_suffix < aligned.suffix_bitlen() {
        return trailing_ones_in_suffix;
    }
    if let Some(full_one_bulk_words) = aligned.bulk_iter().rev().position(|w| w != u64::MAX) {
        return aligned.suffix_bitlen()
            + full_one_bulk_words * 64
            + aligned.bulk()[aligned.bulk().len() - full_one_bulk_words - 1].leading_ones()
                as usize;
    }

    let trailing_ones_in_prefix =
        (aligned.prefix() << ((64 - aligned.prefix_bitlen()) % 64)).leading_ones() as usize;
    aligned.suffix_bitlen() + aligned.bulk_bitlen() + trailing_ones_in_prefix
}

#[cfg(test)]
mod tests {
    use rand::RngExt;

    use super::*;
    use crate::bitmap::Bitmap;

    #[test]
    fn leading_trailing() {
        macro_rules! testcase {
            ($slice:expr, $offset:expr, $length:expr => lz=$lz:expr,lo=$lo:expr,tz=$tz:expr,to=$to:expr) => {
                assert_eq!(
                    leading_zeros($slice, $offset, $length),
                    $lz,
                    "leading_zeros"
                );
                assert_eq!(leading_ones($slice, $offset, $length), $lo, "leading_ones");
                assert_eq!(
                    trailing_zeros($slice, $offset, $length),
                    $tz,
                    "trailing_zeros"
                );
                assert_eq!(
                    trailing_ones($slice, $offset, $length),
                    $to,
                    "trailing_ones"
                );
            };
        }

        testcase!(&[], 0, 0 => lz=0,lo=0,tz=0,to=0);
        testcase!(&[0], 0, 1 => lz=1,lo=0,tz=1,to=0);
        testcase!(&[1], 0, 1 => lz=0,lo=1,tz=0,to=1);

        testcase!(&[0b010], 0, 3 => lz=1,lo=0,tz=1,to=0);
        testcase!(&[0b101], 0, 3 => lz=0,lo=1,tz=0,to=1);
        testcase!(&[0b100], 0, 3 => lz=2,lo=0,tz=0,to=1);
        testcase!(&[0b110], 0, 3 => lz=1,lo=0,tz=0,to=2);
        testcase!(&[0b001], 0, 3 => lz=0,lo=1,tz=2,to=0);
        testcase!(&[0b011], 0, 3 => lz=0,lo=2,tz=1,to=0);

        testcase!(&[0b010], 1, 2 => lz=0,lo=1,tz=1,to=0);
        testcase!(&[0b101], 1, 2 => lz=1,lo=0,tz=0,to=1);
        testcase!(&[0b100], 1, 2 => lz=1,lo=0,tz=0,to=1);
        testcase!(&[0b110], 1, 2 => lz=0,lo=2,tz=0,to=2);
        testcase!(&[0b001], 1, 2 => lz=2,lo=0,tz=2,to=0);
        testcase!(&[0b011], 1, 2 => lz=0,lo=1,tz=1,to=0);
    }

    #[ignore = "Fuzz test. Too slow"]
    #[test]
    fn leading_trailing_fuzz() {
        let mut rng = rand::rng();

        const SIZE: usize = 1000;
        const REPEATS: usize = 10_000;

        let mut v = Vec::<bool>::with_capacity(SIZE);

        for _ in 0..REPEATS {
            v.clear();
            let offset = rng.random_range(0..SIZE);
            let length = rng.random_range(0..SIZE - offset);
            let extra_padding = rng.random_range(0..64);

            let mut num_remaining = usize::min(SIZE, offset + length + extra_padding);
            while num_remaining > 0 {
                let chunk_size = rng.random_range(1..=num_remaining);
                v.extend(
                    rng.clone()
                        .sample_iter(rand::distr::slice::Choose::new(&[false, true]).unwrap())
                        .take(chunk_size),
                );
                
```

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/slice_iterator.rs`
```
use crate::bitmap::Bitmap;

/// Internal state of [`SlicesIterator`]
#[derive(Debug, Clone, PartialEq)]
enum State {
    // normal iteration
    Nominal,
    // nothing more to iterate.
    Finished,
}

/// Iterator over a bitmap that returns slices of set regions.
///
/// This is the most efficient method to extract slices of values from arrays
/// with a validity bitmap.
/// For example, the bitmap `00101111` returns `[(0,4), (6,1)]`
#[derive(Debug, Clone)]
pub struct SlicesIterator<'a> {
    values: std::slice::Iter<'a, u8>,
    count: usize,
    mask: u8,
    max_len: usize,
    current_byte: &'a u8,
    state: State,
    len: usize,
    start: usize,
    on_region: bool,
}

impl<'a> SlicesIterator<'a> {
    /// Creates a new [`SlicesIterator`]
    pub fn new(values: &'a Bitmap) -> Self {
        let (buffer, offset, _) = values.as_slice();
        let mut iter = buffer.iter();

        let (current_byte, state) = match iter.next() {
            Some(b) => (b, State::Nominal),
            None => (&0, State::Finished),
        };

        Self {
            state,
            count: values.len() - values.unset_bits(),
            max_len: values.len(),
            values: iter,
            mask: 1u8.rotate_left(offset as u32),
            current_byte,
            len: 0,
            start: 0,
            on_region: false,
        }
    }

    #[inline]
    fn finish(&mut self) -> Option<(usize, usize)> {
        self.state = State::Finished;
        if self.on_region {
            Some((self.start, self.len))
        } else {
            None
        }
    }

    #[inline]
    fn current_len(&self) -> usize {
        self.start + self.len
    }

    /// Returns the total number of slots.
    /// It corresponds to the sum of all lengths of all slices.
    #[inline]
    pub fn slots(&self) -> usize {
        self.count
    }
}

impl Iterator for SlicesIterator<'_> {
    type Item = (usize, usize);

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if self.state == State::Finished {
                return None;
            }
            if self.current_len() == self.max_len {
                return self.finish();
            }

            if self.mask == 1 {
                // at the beginning of a byte => try to skip it all together
                match (self.on_region, self.current_byte) {
                    (true, &255u8) => {
                        self.len = std::cmp::min(self.max_len - self.start, self.len + 8);
                        if let Some(v) = self.values.next() {
                            self.current_byte = v;
                        };
                        continue;
                    },
                    (false, &0) => {
                        self.len = std::cmp::min(self.max_len - self.start, self.len + 8);
                        if let Some(v) = self.values.next() {
                            self.current_byte = v;
                        };
                        continue;
                    },
                    _ => (), // we need to run over all bits of this byte
                }
            };

            let value = (self.current_byte & self.mask) != 0;
            self.mask = self.mask.rotate_left(1);

            match (self.on_region, value) {
                (true, true) => self.len += 1,
                (false, false) => self.len += 1,
                (true, false) => {
                    self.on_region = false;
                    let result = (self.start, self.len);
                    self.start += self.len;
                    self.len = 1;
                    if self.mask == 1 {
                        // reached a new byte => try to fetch it from the iterator
                        if let Some(v) = self.values.next() {
                            self.current_byte = v;
                        };
                    }
                    return Some(result);
                },
                (false, true) => {
                    self.start += self.len;
                    self.len = 1;
                    self.on_region = true;
                },
            }

            if self.mask == 1 {
                // reached a new byte => try to fetch it from the iterator
                match self.values.next() {
                    Some(v) => self.current_byte = v,
                    None => return self.finish(),
                };
            }
        }
    }
}

```

### Core Architecture Module: `crates/polars-arrow/src/bitmap/utils/zip_validity.rs`
```
use crate::bitmap::Bitmap;
use crate::bitmap::utils::BitmapIter;
use crate::trusted_len::TrustedLen;

/// An [`Iterator`] over validity and values.
#[derive(Debug, Clone)]
pub struct ZipValidityIter<T, I, V>
where
    I: Iterator<Item = T>,
    V: Iterator<Item = bool>,
{
    values: I,
    validity: V,
}

impl<T, I, V> ZipValidityIter<T, I, V>
where
    I: Iterator<Item = T>,
    V: Iterator<Item = bool>,
{
    /// Creates a new [`ZipValidityIter`].
    /// # Panics
    /// This function panics if the size_hints of the iterators are different
    pub fn new(values: I, validity: V) -> Self {
        assert_eq!(values.size_hint(), validity.size_hint());
        Self { values, validity }
    }
}

impl<T, I, V> Iterator for ZipValidityIter<T, I, V>
where
    I: Iterator<Item = T>,
    V: Iterator<Item = bool>,
{
    type Item = Option<T>;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        let value = self.values.next();
        let is_valid = self.validity.next();
        is_valid
            .zip(value)
            .map(|(is_valid, value)| is_valid.then(|| value))
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.values.size_hint()
    }

    #[inline]
    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        let value = self.values.nth(n);
        let is_valid = self.validity.nth(n);
        is_valid
            .zip(value)
            .map(|(is_valid, value)| is_valid.then(|| value))
    }

    #[inline]
    fn fold<B, F>(self, init: B, mut f: F) -> B
    where
        F: FnMut(B, Self::Item) -> B,
    {
        let mut values = self.values;
        self.validity
            .fold(init, |acc, is_valid| match values.next() {
                Some(value) => f(acc, is_valid.then_some(value)),
                None => acc,
            })
    }
}

impl<T, I, V> DoubleEndedIterator for ZipValidityIter<T, I, V>
where
    I: DoubleEndedIterator<Item = T>,
    V: DoubleEndedIterator<Item = bool>,
{
    #[inline]
    fn next_back(&mut self) -> Option<Self::Item> {
        let value = self.values.next_back();
        let is_valid = self.validity.next_back();
        is_valid
            .zip(value)
            .map(|(is_valid, value)| is_valid.then(|| value))
    }
}

unsafe impl<T, I, V> TrustedLen for ZipValidityIter<T, I, V>
where
    I: TrustedLen<Item = T>,
    V: TrustedLen<Item = bool>,
{
}

impl<T, I, V> ExactSizeIterator for ZipValidityIter<T, I, V>
where
    I: ExactSizeIterator<Item = T>,
    V: ExactSizeIterator<Item = bool>,
{
}

/// An [`Iterator`] over [`Option<T>`]
/// This enum can be used in two distinct ways:
/// * as an iterator, via `Iterator::next`
/// * as an enum of two iterators, via `match self`
///
/// The latter allows specializing to when there are no nulls
#[derive(Debug, Clone)]
pub enum ZipValidity<T, I, V>
where
    I: Iterator<Item = T>,
    V: Iterator<Item = bool>,
{
    /// There are no null values
    Required(I),
    /// There are null values
    Optional(ZipValidityIter<T, I, V>),
}

impl<T, I, V> ZipValidity<T, I, V>
where
    I: Iterator<Item = T>,
    V: Iterator<Item = bool>,
{
    /// Returns a new [`ZipValidity`]
    pub fn new(values: I, validity: Option<V>) -> Self {
        match validity {
            Some(validity) => Self::Optional(ZipValidityIter::new(values, validity)),
            _ => Self::Required(values),
        }
    }
}

impl<'a, T, I> ZipValidity<T, I, BitmapIter<'a>>
where
    I: Iterator<Item = T>,
{
    /// Returns a new [`ZipValidity`] and drops the `validity` if all values
    /// are valid.
    pub fn new_with_validity(values: I, validity: Option<&'a Bitmap>) -> Self {
        // only if the validity has nulls we take the optional branch.
        match validity.and_then(|validity| (validity.unset_bits() > 0).then(|| validity.iter())) {
            Some(validity) => Self::Optional(ZipValidityIter::new(values, validity)),
            _ => Self::Required(values),
        }
    }
}

impl<T, I, V> Iterator for ZipValidity<T, I, V>
where
    I: Iterator<Item = T>,
    V: Iterator<Item = bool>,
{
    type Item = Option<T>;

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        match self {
            Self::Required(values) => values.next().map(Some),
            Self::Optional(zipped) => zipped.next(),
        }
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        match self {
            Self::Required(values) => values.size_hint(),
            Self::Optional(zipped) => zipped.size_hint(),
        }
    }

    #[inline]
    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        match self {
            Self::Required(values) => values.nth(n).map(Some),
            Self::Optional(zipped) => zipped.nth(n),
        }
    }

    #[inline]
    fn fold<B, F>(self, init: B, mut f: F) -> B
    where
        F: FnMut(B, Self::Item) -> B,
    {
        match self {
            Self::Required(values) => values.fold(init, |acc, value| f(acc, Some(value))),
            Self::Optional(zipped) => zipped.fold(init, f),
        }
    }
}

impl<T, I, V> DoubleEndedIterator for ZipValidity<T, I, V>
where
    I: DoubleEndedIterator<Item = T>,
    V: DoubleEndedIterator<Item = bool>,
{
    #[inline]
    fn next_back(&mut self) -> Option<Self::Item> {
        match self {
            Self::Required(values) => values.next_back().map(Some),
            Self::Optional(zipped) => zipped.next_back(),
        }
    }

    #[inline]
    fn rfold<B, F>(self, init: B, mut f: F) -> B
    where
        F: FnMut(B, Self::Item) -> B,
    {
        match self {
            Self::Required(values) => values.rfold(init, |acc, value| f(acc, Some(value))),
            Self::Optional(zipped) => zipped.rfold(init, f),
        }
    }
}

impl<T, I, V> ExactSizeIterator for ZipValidity<T, I, V>
where
    I: ExactSizeIterator<Item = T>,
    V: ExactSizeIterator<Item = bool>,
{
}

unsafe impl<T, I, V> TrustedLen for ZipValidity<T, I, V>
where
    I: TrustedLen<Item = T>,
    V: TrustedLen<Item = bool>,
{
}

impl<T, I, V> ZipValidity<T, I, V>
where
    I: Iterator<Item = T>,
    V: Iterator<Item = bool>,
{
    /// Unwrap into an iterator that has no null values.
    pub fn unwrap_required(self) -> I {
        match self {
            ZipValidity::Required(i) => i,
            _ => panic!("Could not 'unwrap_required'. 'ZipValidity' iterator has nulls."),
        }
    }

    /// Unwrap into an iterator that has null values.
    pub fn unwrap_optional(self) -> ZipValidityIter<T, I, V> {
        match self {
            ZipValidity::Optional(i) => i,
            _ => panic!("Could not 'unwrap_optional'. 'ZipValidity' iterator has no nulls."),
        }
    }
}

```

### Core Architecture Module: `crates/polars-arrow/src/compute/utils.rs`
```
use std::borrow::Borrow;
use std::ops::{BitAnd, BitOr};

use polars_error::{PolarsResult, polars_ensure};

use crate::array::Array;
use crate::bitmap::{Bitmap, and_not, push_bitchunk, ternary};

pub fn combine_validities_and3(
    opt1: Option<&Bitmap>,
    opt2: Option<&Bitmap>,
    opt3: Option<&Bitmap>,
) -> Option<Bitmap> {
    match (opt1, opt2, opt3) {
        (Some(a), Some(b), Some(c)) => Some(ternary(a, b, c, |x, y, z| x & y & z)),
        (Some(a), Some(b), None) => Some(a.bitand(b)),
        (Some(a), None, Some(c)) => Some(a.bitand(c)),
        (None, Some(b), Some(c)) => Some(b.bitand(c)),
        (Some(a), None, None) => Some(a.clone()),
        (None, Some(b), None) => Some(b.clone()),
        (None, None, Some(c)) => Some(c.clone()),
        (None, None, None) => None,
    }
}

pub fn combine_validities_and(opt_l: Option<&Bitmap>, opt_r: Option<&Bitmap>) -> Option<Bitmap> {
    match (opt_l, opt_r) {
        (Some(l), Some(r)) => Some(l.bitand(r)),
        (None, Some(r)) => Some(r.clone()),
        (Some(l), None) => Some(l.clone()),
        (None, None) => None,
    }
}

pub fn combine_validities_or(opt_l: Option<&Bitmap>, opt_r: Option<&Bitmap>) -> Option<Bitmap> {
    match (opt_l, opt_r) {
        (Some(l), Some(r)) => Some(l.bitor(r)),
        _ => None,
    }
}

pub fn combine_validities_and_not(
    opt_l: Option<&Bitmap>,
    opt_r: Option<&Bitmap>,
) -> Option<Bitmap> {
    match (opt_l, opt_r) {
        (Some(l), Some(r)) => Some(and_not(l, r)),
        (None, Some(r)) => Some(!r),
        (Some(l), None) => Some(l.clone()),
        (None, None) => None,
    }
}

pub fn combine_validities_and_many<B: Borrow<Bitmap>>(bitmaps: &[Option<B>]) -> Option<Bitmap> {
    let mut bitmaps = bitmaps
        .iter()
        .flatten()
        .map(|b| b.borrow())
        .collect::<Vec<_>>();

    match bitmaps.len() {
        0 => None,
        1 => bitmaps.pop().cloned(),
        2 => combine_validities_and(bitmaps.pop(), bitmaps.pop()),
        3 => combine_validities_and3(bitmaps.pop(), bitmaps.pop(), bitmaps.pop()),
        _ => {
            let mut iterators = bitmaps
                .iter()
                .map(|v| v.fast_iter_u64())
                .collect::<Vec<_>>();
            let mut buffer = Vec::with_capacity(iterators.first().unwrap().size_hint().0 + 2);

            'rows: loop {
                // All ones so as identity for & operation
                let mut out = u64::MAX;
                for iter in iterators.iter_mut() {
                    if let Some(v) = iter.next() {
                        out &= v
                    } else {
                        break 'rows;
                    }
                }
                push_bitchunk(&mut buffer, out);
            }

            // All ones so as identity for & operation
            let mut out = [u64::MAX, u64::MAX];
            let mut len = 0;
            for iter in iterators.into_iter() {
                let (rem, rem_len) = iter.remainder();
                len = rem_len;

                for (out, rem) in out.iter_mut().zip(rem) {
                    *out &= rem;
                }
            }
            push_bitchunk(&mut buffer, out[0]);
            if len > 64 {
                push_bitchunk(&mut buffer, out[1]);
            }
            let bitmap = Bitmap::from_u8_vec(buffer, bitmaps[0].len());
            if bitmap.unset_bits() == 0 {
                None
            } else {
                Some(bitmap)
            }
        },
    }
}

// Errors iff the two arrays have a different length.
#[inline]
pub fn check_same_len(lhs: &dyn Array, rhs: &dyn Array) -> PolarsResult<()> {
    polars_ensure!(lhs.len() == rhs.len(), ComputeError:
            "arrays must have the same length"
    );
    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30871** (2026-11-19): **Streaming join on a single List/Array/Struct key finds no matches when both inputs are sorted descending (merge join)**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example   ```python import polars as pl  left = pl.DataFrame({"k": [[3], [2], [2], [1]], "l": ["a", "b", "c", "d"]}).sort("k", descending=True) right = pl.DataFrame({"k": [[3], [2], [0]], "r": ["A", "B", "Z"]}).sort("k", descending=True)  q = left.lazy().join(right.lazy(), on="k") print(q.collect().rows())  # default engine (streaming) print(q.collect(engine="in-memory").rows()) print(left.join(right, on="k").rows())  q.sink_parquet("out.parquet") print(pl.read_parquet("out.parquet").height)  print(left.lazy().join(right.lazy(), on="k", how="left").collect().rows())  # sorted ascending, the same join is correct print(left.sort("k").lazy().join(right.sort("k").lazy(), on="k").collect().height) ```  Output:  ``` [] [([3], 'a', 'A'), ([2], 'b', 'B'), ([2], 'c', 'B')] [([3], 'a', 'A'), ([2], 'b', 'B'), ([2], 'c', 'B')] 0 [([3], 'a', None), ([2], 'b', None), ([2], 'c', None), ([1], 'd', None)] 3 ```  ### Log output  ```shell $ POLARS_VERBOSE=1 python ...   # stderr excerpt for q.collect() above: first graph phase, "updating <node>" lines omitted polars-stream: updating graph state polars-stream: running in-memory-sink in subgraph polars-stream: running with-columns in subgraph polars-stream: running in-memory-source in subgraph polars-stream: running in-memory-source in subgraph

- **Issue #30860** (2026-11-18): **read_csv on an unbuffered io.FileIO pipe fails on Linux with OSError: No such device (os error 19) (regression in 2.x)**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import os import polars as pl  def make_pipe():     r, w = os.pipe()     os.write(w, b"a,b\n1,2\n3,4\n")     os.close(w)     return r  # fails: exact io.FileIO wrapping a pipe with open(make_pipe(), "rb", buffering=0) as f:     print(pl.read_csv(f))  # works: io.BufferedReader wrapping a pipe # with open(make_pipe(), "rb") as f: #     print(pl.read_csv(f)) ```   ### Log output  ```shell total memory: 31.076 GiB (33367142400 bytes) _init_credential_provider_builder(): credential_provider_init = None async thread count: 22 blocking thread count: 512 sourcing csv scan file schema from: 'open-file' OSError: No such device (os error 19) ```  ### Issue description  Results on Linux, Python 3.14.3:  | Source | polars 1.44.2 | polars 2.1.0 | |---|---|---| | `open(pipe_fd, "rb", buffering=0)` (`FileIO`) | OK | **OSError: os error 19** | | `open(pipe_fd, "rb")` (`BufferedReader`) | OK | OK | | `f.read()` (bytes) | OK | OK |  - Error 19 is ENODEV, which is what `mmap()` returns for a pipe. Only Linux is affected; the same code works on Windows. - Likely cause, in `try_get_pyfile` in `crates/polars-python/src/file.rs` (tag `py-2.1.0`):   ```rust   py_f.is_exact_instance(FileIO)       || (is_exact_instance(Buffered*) || is_exact_instance(TextIOWrapper) && ...)        

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

### Incident Patch 1: `60a4ec62` (2026-11-19)
**Commit Message**: fix: Turn panics in Arrow C stream callbacks into stream errors (#30886)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `crates/polars-arrow/src/ffi/stream.rs` (modified, +55/-21)
```diff
@@ -1,5 +1,6 @@
 use std::ffi::{CStr, CString};
 use std::ops::DerefMut;
+use std::panic::AssertUnwindSafe;
 
 use polars_error::{PolarsError, PolarsResult, polars_bail, polars_err};
 
@@ -127,25 +128,61 @@ impl<Iter: DerefMut<Target = ArrowArrayStream>> ArrowArrayStreamReader<Iter> {
 }
 
 struct PrivateData {
-    iter: Box<dyn Iterator<Item = PolarsResult<Box<dyn Array>>>>,
+    iter: Box<dyn Iterator<Item = PolarsResult<Box<dyn Array>>> + Send>,
     field: Field,
     error: Option<CString>,
+    /// Whether a callback panicked, which ends the stream as `iter` is left in an unknown state.
+    panicked: bool,
 }
 
-unsafe extern "C" fn get_next(iter: *mut ArrowArrayStream, array: *mut ArrowArray) -> i32 {
+/// The status of a failed callback, as no status of the interface itself is ever this.
+const CALLBACK_ERROR: i32 = 2001;
+
+fn error_cstring(message: &str) -> CString {
+    CString::new(message.replace('\0', "\\0")).unwrap()
+}
+
+/// Run the body of a stream callback, storing a panic as the stream's error, as unwinding out of
+/// an `extern "C"` function aborts the process.
+unsafe fn catch_callback(
+    iter: *mut ArrowArrayStream,
+    body: impl FnOnce(&mut PrivateData) -> i32,
+) -> i32 {
     if iter.is_null() {
-        return 2001;
+        return CALLBACK_ERROR;
     }
-    let private = &mut *((*iter).private_data as *mut PrivateData);
+    let private = (*iter).private_data as *mut PrivateData;
+    if (*private).panicked {
+        return CALLBACK_ERROR;
+    }
+    match std::panic::catch_unwind(AssertUnwindSafe(|| body(&mut *private))) {
+        Ok(status) => status,
+        Err(payload) => {
+            let message = payload
+                .downcast_ref::<&str>()
+                .copied()
+                .or_else(|| payload.downcast_ref::<String>().map(String::as_str))
+                .unwrap_or("unknown panic");
+            (*private).error = Some(error_cstring(&format!(
+                "panic in an Arrow C stream callback: {message}"
+            )));
+            (*private).panicked = true;
+            CALLBACK_ERROR
+        },
+    }
+}
 
-    match private.iter.next() {
+unsafe extern "C" fn get_next(iter: *mut ArrowArrayStream, array: *mut ArrowArray) -> i32 {
+    catch_callback(iter, |private| match private.iter.next() {
         Some(Ok(item)) => {
             // check that the array has the same dtype as field
             let item_dt = item.dtype();
             let expected_dt = private.field.dtype();
             if item_dt != expected_dt {
-                private.error = Some(CString::new(format!("The iterator produced an item of data type {item_dt:?} but the producer expects data type {expected_dt:?}").as_bytes().to_vec()).unwrap());
-                return 2001; // custom application specific error (since this is never a result of this interface)
+                private.error = Some(error_cstring(&format!(
+                    "The iterator produced an item of data type {item_dt:?} but the producer expects data type {expected_dt:?}"
+                )));
+                return CALLBACK_ERROR;
             }
 
             std::ptr::write(array, export_array_to_c(item));
@@ -154,29 +191,23 @@ unsafe extern "C" fn get_next(iter: *mut ArrowArrayStream, array: *mut ArrowArra
             0
         },
         Some(Err(err)) => {
-            // A NUL would end the C string: without it, `CString::new` can't fail (and a panic
-            // here can't unwind out of this `extern "C"` function).
-            let message = err.to_string().replace('\0', "\\0");
-            private.error = Some(CString::new(message).unwrap());
-            2001 // custom application specific error (since this is never a result of this interface)
+            private.error = Some(error_cstring(&err.to_string()));
+            CALLBACK_ERROR
         },
         None => {
             let a = ArrowArray::empty();
             std::ptr::write_unaligned(array, a);
             private.error = None;
             0
         },
-    }
+    })
 }
 
 unsafe extern "C" fn get_schema(iter: *mut ArrowArrayStream, schema: *mut ArrowSchema) -> i32 {
-    if iter.is_null() {
-        return 2001;
-    }
-    let private = &mut *((*iter).private_data as *mut PrivateData);
-
-    std::ptr::write(schema, export_field_to_c(&private.field));
-    0
+    catch_callback(iter, |private| {
+        std::ptr::write(schema, export_field_to_c(&private.field));
+        0
+    })
 }
 
 unsafe extern "C" fn get_last_error(iter: *mut ArrowArrayStream) -> *const ::std::os::raw::c_char {
@@ -202,14 +233,17 @@ unsafe extern "C" fn release(iter: *mut ArrowArrayStream) {
 }
 
 /// Exports an iterator to the [C stream interface](https://arrow.apache.org/docs/format/CStreamInterface.html)
+///
+/// The iterator must be `Send`, as the consumer may read the stream from any thread.
 pub fn export_iterator(
-    iter: Box<dyn Iterator<Item = PolarsResult<Box<dyn Array>>>>,
+    iter: Box<dyn Iterator<Item = Polars
```

**File**: `crates/polars/tests/it/arrow/ffi/stream.rs` (modified, +29/-0)
```diff
@@ -42,3 +42,32 @@ fn stream_reader_try_new_invalid_argument_error_on_released_stream() {
         _ => panic!("ArrowArrayStreamReader::try_new did not return an InvalidArgumentError"),
     }
 }
+
+#[test]
+fn panic_in_iterator_ends_stream() -> PolarsResult<()> {
+    use std::sync::Arc;
+    use std::sync::atomic::{AtomicUsize, Ordering};
+
+    let array: Box<dyn Array> = Box::new(Int32Array::from(&[Some(1), None]));
+    let field = Field::new("a".into(), array.dtype().clone(), true);
+    let calls = Arc::new(AtomicUsize::new(0));
+    let iter = {
+        let (array, calls) = (array.clone(), calls.clone());
+        std::iter::from_fn(move || match calls.fetch_add(1, Ordering::Relaxed) {
+            0 => Some(Ok(array.clone())),
+            1 => panic!("iterator boom"),
+            _ => Some(Ok(array.clone())),
+        })
+    };
+
+    let stream = Box::new(ffi::export_iterator(Box::new(iter), field));
+    let mut reader = unsafe { ffi::ArrowArrayStreamReader::try_new(stream)? };
+
+    assert_eq!(unsafe { reader.next() }.unwrap()?, array);
+    for _ in 0..2 {
+        let err = unsafe { reader.next() }.unwrap().unwrap_err();
+        assert!(err.to_string().contains("iterator boom"), "{err}");
+    }
+    assert_eq!(calls.load(Ordering::Relaxed), 2);
+    Ok(())
+}
```

**File**: `py-polars/tests/unit/interop/test_interop.py` (modified, +20/-0)
```diff
@@ -27,6 +27,8 @@
 from tests.unit.utils.pycapsule_utils import PyCapsuleArrayHolder, PyCapsuleStreamHolder
 
 if TYPE_CHECKING:
+    from collections.abc import Callable
+
     from tests.conftest import PlMonkeyPatch
 
 
@@ -1903,3 +1905,21 @@ def test_export_arrow_to_c_logical_dtype(s: pl.Series) -> None:
     arr = pa.Array._import_from_c(ctypes.addressof(c_array), ctypes.addressof(c_schema))
     arr.validate(full=True)
     assert arr.equals(s.to_arrow(compat_level=CompatLevel.newest()))
+
+
+@pytest.mark.parametrize(
+    "export",
+    [
+        lambda df: pa.table(df),
+        lambda df: pa.RecordBatchReader.from_stream(df.lazy().collect_batches()),
+    ],
+    ids=["DataFrame", "LazyFrame.collect_batches"],
+)
+def test_arrow_c_stream_raises_on_a_nul_in_a_column_name(
+    export: Callable[[pl.DataFrame], Any],
+) -> None:
+    # Exporting the name panics in the stream's `get_schema` callback.
+    df = pl.DataFrame({"a\0b": [1]})
+
+    with pytest.raises(OSError, match="panic in an Arrow C stream callback"):
+        export(df)
```

---

### Incident Patch 2: `501ba548` (2026-11-19)
**Commit Message**: fix: Lower the cloud connect timeout to 10 seconds (#30897)

**File**: `crates/polars-io/src/cloud/options.rs` (modified, +89/-20)
```diff
@@ -333,33 +333,81 @@ impl CloudType {
 
 pub static USER_AGENT: &str = concat!("polars", "/", env!("CARGO_PKG_VERSION"),);
 
+/// HTTP client timeouts from the environment, in whole seconds. 0 disables a timeout.
 #[cfg(any(feature = "aws", feature = "gcp", feature = "azure", feature = "http"))]
-pub(super) fn get_client_options() -> ClientOptions {
-    use std::num::NonZeroU64;
+struct HttpTimeouts {
+    /// DNS lookup, TCP connect and TLS handshake.
+    connect: Option<std::time::Duration>,
+    /// Wait for the response headers, then each gap between reads of the body. The header
+    /// timer starts when the request is created, so it also limits sending a request body.
+    read: Option<std::time::Duration>,
+    /// One request attempt up to the end of the response body, whatever its progress.
+    request: Option<std::time::Duration>,
+}
+
+#[cfg(any(feature = "aws", feature = "gcp", feature = "azure", feature = "http"))]
+impl HttpTimeouts {
+    fn from_env() -> Self {
+        fn secs(name: &str, default: u64) -> Option<std::time::Duration> {
+            let secs = std::env::var(name).map_or(default, |x| {
+                x.parse::<u64>()
+                    .unwrap_or_else(|_| panic!("invalid value for {name}: {x}"))
+            });
+            (secs > 0).then(|| std::time::Duration::from_secs(secs))
+        }
 
+        Self {
+            connect: secs("POLARS_HTTP_CONNECT_TIMEOUT_SECONDS", 10),
+            read: secs("POLARS_HTTP_READ_TIMEOUT_SECONDS", 0),
+            request: secs("POLARS_HTTP_REQUEST_TIMEOUT_SECONDS", 0),
+        }
+    }
+}
+
+#[cfg(any(feature = "aws", feature = "gcp", feature = "azure", feature = "http"))]
+pub(super) fn get_client_options() -> ClientOptions {
     use reqwest::header::HeaderValue;
 
-    ClientOptions::new()
-        // Disables the time limit for downloading the response body.
-        .with_timeout_disabled()
-        // Set the time limit for establishing the connection.
-        .with_connect_timeout(std::time::Duration::from_secs(
-            std::env::var("POLARS_HTTP_CONNECT_TIMEOUT_SECONDS")
-                .map(|x| {
-                    x.parse::<NonZeroU64>()
-                        .ok()
-                        .unwrap_or_else(|| {
-                            panic!("invalid value for POLARS_HTTP_CONNECT_TIMEOUT_SECONDS: {x}")
-                        })
-                        .get()
-                })
-                .unwrap_or(5 * 60),
-        ))
+    let HttpTimeouts {
+        connect,
+        read,
+        request,
+    } = HttpTimeouts::from_env();
+
+    let opts = ClientOptions::new()
         .with_user_agent(HeaderValue::from_static(USER_AGENT))
         .with_allow_http(true)
         .with_dns_resolver(Arc::new(
             CachingResolver::new(DnsResolverConfig::from_env()),
-        ))
+        ));
+
+    // `ClientOptions::new()` sets a connect and a request timeout of its own.
+    let opts = match connect {
+        Some(v) => opts.with_connect_timeout(v),
+        None => opts.with_connect_timeout_disabled(),
+    };
+    let opts = match read {
+        Some(v) => opts.with_read_timeout(v),
+        None => opts.with_read_timeout_disabled(),
+    };
+    match request {
+        Some(v) => opts.with_timeout(v),
+        None => opts.with_timeout_disabled(),
+    }
+}
+
+/// Logs the timeouts of a client, as set by the environment and `storage_options`.
+#[cfg(any(feature = "aws", feature = "gcp", feature = "azure", feature = "http"))]
+fn log_http_timeouts(get_config_value: impl Fn(object_store::ClientConfigKey) -> Option<String>) {
+    use object_store::ClientConfigKey as K;
+
+    let get = |key| get_config_value(key).unwrap_or_else(|| "disabled".to_string());
+    eprintln!(
+        "object-store http timeouts: connect: {}, read: {}, request: {}",
+        get(K::ConnectTimeout),
+        get(K::ReadTimeout),
+        get(K::Timeout),
+    );
 }
 
 #[cfg(feature = "aws")]
@@ -497,6 +545,10 @@ impl CloudOptions {
             }
         }
 
+        if polars_core::config::verbose() {
+            log_http_timeouts(|key| builder.get_config_value(&AmazonS3ConfigKey::Client(key)));
+        }
+
         if builder
             .get_config_value(&AmazonS3ConfigKey::DefaultRegion)
             .is_none()
@@ -527,8 +579,14 @@ impl CloudOptions {
                             "'(default_)region' not set; polars will try to get it from bucket\n\nSet the region manually to silence this warning."
                         );
                         let result = with_concurrency_budget(1, || async {
-                            reqwest::Client::builder()
+                            // A single HEAD that is not retried.
+                            let mut client = reqwest::Client::builder()
                                 .user_agent(USER_AGENT)
+                                .timeout(std::time::Duration::from_secs(30));
+                            if let Some(v) = HttpTimeouts::from_env().connect {

```

---

### Incident Patch 3: `4d76833f` (2026-11-18)
**Commit Message**: fix!: Make SQL `DELETE` change the registered table in a `SQLContext` (#30869)

**File**: `crates/polars-sql/src/context.rs` (modified, +25/-7)
```diff
@@ -3138,23 +3138,41 @@ impl SQLContext {
             polars_bail!(SQLInterface: "unexpected statement type; expected DELETE")
         };
         let (from, selection) = delete_parts(delete)?;
-        if let TableFactor::Table { name, .. } = &from.relation
-            && let Some((tbl, table)) = self.catalog_change_target(name)?
-        {
+        let TableFactor::Table { name, .. } = &from.relation else {
+            polars_bail!(SQLInterface: "DELETE requires a registered table")
+        };
+        if let Some((tbl, table)) = self.catalog_change_target(name)? {
             polars_bail!(
                 SQLInterface: "DELETE of catalog table '{}' ('{}') must be performed on the catalog (see `SQLContext::catalog_statement`)",
                 tbl, display_name(&table.full_name())
             );
         }
         let lf = self.delete_target(from)?;
-        match selection {
+        let tbl = object_name_to_string(name);
+        polars_ensure!(
+            key_ignoring_case(&self.table_map.read().unwrap(), &tbl)?.is_some(),
+            SQLInterface: "DELETE requires a registered table; '{}' is not one", tbl
+        );
+        let remaining = match selection {
             // no WHERE clause; equivalent to TRUNCATE (drop all rows)
-            None => Ok(lf.clear()),
+            None => lf.clear(),
             // apply constraint as inverted filter (drops rows matching the selection)
             Some(selection) => {
-                self.process_where(lf, Some(selection), FilterMode::RemoveTrue, None)
+                let remaining =
+                    self.process_where(lf, Some(selection), FilterMode::RemoveTrue, None)?;
+                // A missing column fails here, before the table changes (no data is read).
+                LazyFrame::from(remaining.logical_plan.clone()).collect_schema()?;
+                remaining
             },
-        }
+        };
+        // Later statements see the remaining rows, as after TRUNCATE. Locked only now:
+        // resolving the table and its WHERE read the table map.
+        let mut table_map = self.table_map.write().unwrap();
+        let Some(key) = key_ignoring_case(&table_map, &tbl)?.cloned() else {
+            polars_bail!(SQLInterface: "DELETE requires a registered table; '{}' is not one", tbl)
+        };
+        table_map.insert(key, remaining.clone());
+        Ok(remaining)
     }
 
     fn delete_target(&mut self, from: &TableWithJoins) -> PolarsResult<LazyFrame> {
```

**File**: `py-polars/docs/source/reference/sql/table_operations.rst` (modified, +17/-0)
```diff
@@ -378,6 +378,23 @@ DELETE
 Remove specific rows from a table using an (optional) constraint.
 Omitting the constraint deletes *all* rows, equivalent to `TRUNCATE`.
 
+On a registered table, it returns the remaining rows, and later statements in the same
+context see the table without the deleted rows. Source files and the original frame are
+not changed.
+
+The table keeps the condition, not its result. Each read of the table runs the condition
+again on the table's source. A subquery of the condition keeps its tables as registered at
+the time of the ``DELETE``.
+
+- A condition that names a missing column fails at the ``DELETE`` and leaves the table
+  unchanged. Other errors in the condition, such as a string compared with an integer or a
+  cast of a string that is not a number, show when the table is read, on each read until
+  the table is registered again.
+- Collecting the result of a ``DELETE`` computes the remaining rows. Leave the result lazy
+  when only the change is needed.
+- Each ``DELETE`` adds its condition to the table. After many, register the collected rows
+  again: ``ctx.register("t", ctx.execute("SELECT * FROM t", eager=True))``.
+
 On a table of an attached catalog, it deletes the matching rows in one commit, as one
 snapshot. It returns the statement, not the remaining rows. Rows where the condition is NULL
 are kept.
```

**File**: `py-polars/tests/unit/sql/test_catalogs.py` (modified, +11/-0)
```diff
@@ -4485,6 +4485,17 @@ def test_delete_catalog_table_float_condition(lake: CountingCatalog) -> None:
     assert len(table_rows(lake, "tpch", "f")) == 2
 
 
+@pytest.mark.write_disk
+def test_delete_registered_table_shadowing_catalog_table(lake: CountingCatalog) -> None:
+    # a registered table of the name wins: DELETE changes it, not the catalog table
+    ctx = lake_ctx(lake)
+    ctx.register("lineitem", pl.LazyFrame({"k": [1, 2], "v": ["x", "y"]}))
+    ctx.execute("DELETE FROM lineitem WHERE k = 1")
+    assert ctx.execute("SELECT k FROM lineitem", eager=True)["k"].to_list() == [2]
+    res = ctx.execute("SELECT k FROM lake.tpch.lineitem ORDER BY k", eager=True)
+    assert res["k"].to_list() == [1, 2]
+
+
 @pytest.mark.write_disk
 def test_delete_catalog_table_resolution(lake: CountingCatalog) -> None:
     ctx = lake_ctx(lake)
```

**File**: `py-polars/tests/unit/sql/test_table_operations.py` (modified, +141/-0)
```diff
@@ -505,6 +505,7 @@ def test_qualified_table_name_ddl() -> None:
     [
         ("My Table", 'DROP TABLE "My Table"'),
         ("My Table", 'TRUNCATE TABLE "My Table"'),
+        ("My Table", 'DELETE FROM "My Table"'),
         ("frame", "DROP TABLE FRAME"),
     ],
 )
@@ -845,3 +846,143 @@ def test_information_schema_columns(test_frame: pl.LazyFrame) -> None:
         lf = ctx.execute("SELECT column_name FROM information_schema.columns")
         ctx.unregister("df")
         assert lf.collect()["column_name"].to_list() == ["a", "x", "y", "z", "x2", "y"]
+
+
+def test_delete_from_registered_table_30714() -> None:
+    # later statements see the deletion, as after TRUNCATE; DELETE returns the rest
+    with pl.SQLContext({"t": pl.LazyFrame({"a": [1, 2, 3, 4, 5]})}) as ctx:
+        res = ctx.execute("DELETE FROM t WHERE a = 1", eager=True)
+        assert res["a"].to_list() == [2, 3, 4, 5]
+        assert ctx.execute("SELECT a FROM t", eager=True)["a"].to_list() == [2, 3, 4, 5]
+
+        # a lazy execute changes the table too
+        ctx.execute("DELETE FROM t WHERE a = 5")
+        assert ctx.execute("SELECT a FROM t", eager=True)["a"].to_list() == [2, 3, 4]
+
+        # an alias names the same table
+        ctx.execute("DELETE FROM t AS x WHERE x.a = 4")
+        assert ctx.execute("SELECT a FROM t", eager=True)["a"].to_list() == [2, 3]
+
+        # a subquery on the table sees it as before the DELETE
+        ctx.execute("DELETE FROM t WHERE a IN (SELECT min(a) FROM t)")
+        assert ctx.execute("SELECT a FROM t", eager=True)["a"].to_list() == [3]
+        assert ctx.tables() == ["t"]
+
+        # without WHERE, as TRUNCATE
+        ctx.execute("DELETE FROM T")
+        out = ctx.execute("SELECT * FROM t", eager=True)
+        assert out.height == 0
+        assert out.columns == ["a"]
+
+
+@pytest.mark.write_disk
+def test_delete_leaves_sources_unchanged(tmp_path: Path) -> None:
+    df = pl.DataFrame({"a": [1, 2, 3]})
+    path = tmp_path / "t.parquet"
+    df.write_parquet(path)
+    with pl.SQLContext({"scan": pl.scan_parquet(path), "frame": df}) as ctx:
+        ctx.execute("DELETE FROM scan WHERE a = 1")
+        ctx.execute("DELETE FROM frame WHERE a = 2")
+        assert ctx.execute("SELECT a FROM scan", eager=True)["a"].to_list() == [2, 3]
+        # the condition is pushed into the scan
+        assert "SELECTION" in ctx.execute("SELECT a FROM scan").explain()
+        assert ctx.execute("SELECT a FROM frame", eager=True)["a"].to_list() == [1, 3]
+    assert_frame_equal(pl.read_parquet(path), df)
+    assert df["a"].to_list() == [1, 2, 3]
+
+    # `df.sql` runs in its own context
+    assert df.sql("DELETE FROM self WHERE a = 1")["a"].to_list() == [2, 3]
+    assert df["a"].to_list() == [1, 2, 3]
+
+
+def test_delete_in_scope_persists() -> None:
+    # a table registered before the scope keeps the deletion, as after TRUNCATE
+    ctx = pl.SQLContext({"t": pl.LazyFrame({"a": [1, 2]})})
+    with ctx:
+        ctx.execute("DELETE FROM t WHERE a = 1")
+    assert ctx.execute("SELECT a FROM t", eager=True)["a"].to_list() == [2]
+
+    # registering it again restores it
+    ctx.register("t", pl.LazyFrame({"a": [1, 2]}))
+    assert ctx.execute("SELECT count(*) FROM t", eager=True).item() == 2
+
+
+def test_delete_table_name_case() -> None:
+    frames = {
+        "Foo": pl.LazyFrame({"x": ["Foo", "Foo"]}),
+        "FOO": pl.LazyFrame({"x": ["FOO"]}),
+    }
+    with pl.SQLContext(frames) as ctx:
+        # the exact name wins
+        ctx.execute("DELETE FROM FOO")
+        assert ctx.execute("SELECT count(*) FROM FOO", eager=True).item() == 0
+        assert ctx.execute("SELECT count(*) FROM Foo", eager=True).item() == 2
+        with pytest.raises(SQLInterfaceError, match=r"foo.*matches more than one"):
+            ctx.execute("DELETE FROM foo")
+
+
+@pytest.mark.parametrize(
+    ("query", "error"),
+    [
+        (
+            "DELETE FROM (SELECT * FROM t) AS s WHERE a = 1",
+            "DELETE requires a registered table",
+        ),
+        ("DELETE FROM missing", "relation 'missing' was not found"),
+        # refused before its condition is checked
+        ("DELETE FROM v WHERE a = 'x'", "DELETE requires a registered table; 'v'"),
+    ],
+)
+def test_delete_requires_registered_table(query: str, error: str) -> None:
+    with pl.SQLContext({"t": pl.LazyFrame({"a": [1]})}) as ctx:
+        ctx.execute("CREATE VIEW v AS SELECT a FROM t")
+        with pytest.raises(SQLInterfaceError, match=error):
+            ctx.execute(query)
+        assert ctx.execute("SELECT count(*) FROM t", eager=True).item() == 1
+
+
+@pytest.mark.parametrize(
+    ("condition", "error"),
+    [
+        ("missing = 1", pl.exceptions.ColumnNotFoundError),
+        ("a IN (SELECT s FROM u)", pl.exceptions.InvalidOperationError),
+    ],
+)
+def test_delete_failure_leaves_table_unchanged(
+    condition: str, error: type[Exception]
+) -> None:
+    frames = {"t": pl.LazyFrame({"a": [1, 2]}), "u": pl.
```

#### Recent Merged Pull Requests:
- **PR #30902** (2026-11-19): fix: Evaluate the quantile argument per group in `group_by` (@dancsi)
- **PR #30900** (2026-11-19): feat: Report cloud read stats in the in-flight concurrency log (@kdn36)
- **PR #30897** (2026-11-19): fix: Lower the cloud connect timeout to 10 seconds and add env vars (@kdn36)
- **PR #30896** (2026-11-19): fix: Merge a single nested descending key in the right order (@kdn36)
- **PR #30894** (2026-11-19): refactor(rust): Attach the plan of a failed conversion to the error as data (@kdn36)
- **PR #30892** (2026-11-18): fix(python): Use per-account ADLS SAS tokens vended by Iceberg catalogs (@Ferdinanddb)

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

## X. Turn panics in Arrow C stream callbacks into stream errors

**RULE**:
When implementing operations in `crates/polars-arrow/src/ffi/stream.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `60a4ec62`: Turn panics in Arrow C stream callbacks into stream errors. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/polars-arrow/src/ffi/stream.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use std::panic::AssertUnwindSafe;
    iter: Box<dyn Iterator<Item = PolarsResult<Box<dyn Array>>> + Send>,
    /// Whether a callback panicked, which ends the stream as `iter` is left in an unknown state.
    panicked: bool,
/// The status of a failed callback, as no status of the interface itself is ever this.
const CALLBACK_ERROR: i32 = 2001;

fn error_cstring(message: &str) -> CString {
    CString::new(message.replace('\0', "\\0")).unwrap()
}

/// Run the body of a stream callback, storing a panic as the stream's error, as unwinding out of
/// an `extern "C"` function aborts the process.
unsafe fn catch_callback(
    iter: *mut ArrowArrayStream,
    body: impl FnOnce(&mut PrivateData) -> i32,
) -> i32 {
        return CALLBACK_ERROR;
    let private = (*iter).private_data as *mut PrivateData;
    if (*private).panicked {
        return CALLBACK_ERROR;
    }
    match std::panic::catch_unwind(AssertUnwindSafe(|| body(&mut *private))) {
        Ok(status) => status,
        Err(payload) => {
            let message = payload
                .downcast_ref::<&str>()
                .copied()
                .or_else(|| payload.downcast_ref::<String>().map(String::as_str))
         
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    iter: Box<dyn Iterator<Item = PolarsResult<Box<dyn Array>>>>,
unsafe extern "C" fn get_next(iter: *mut ArrowArrayStream, array: *mut ArrowArray) -> i32 {
        return 2001;
    let private = &mut *((*iter).private_data as *mut PrivateData);
    match private.iter.next() {
                private.error = Some(CString::new(format!("The iterator produced an item of data type {item_dt:?} but the producer expects data type {expected_dt:?}").as_bytes().to_vec()).unwrap());
                return 2001; // custom application specific error (since this is never a result of this interface)
            // A NUL would end the C string: without it, `CString::new` can't fail (and a panic
            // here can't unwind out of this `extern "C"` function).
            let message = err.to_string().replace('\0', "\\0");
            private.error = Some(CString::new(message).unwrap());
            2001 // custom application specific error (since this is never a result of this interface)
    }
    if iter.is_null() {
        return 2001;
    }
    let private = &mut *((*iter).private_data as *mut PrivateData);

    std::ptr::write(schema, export_field_to_c(&private.field));
    0
    iter: Box
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `60a4ec62` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
