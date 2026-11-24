# Domain G — Architecture Intelligence: Architecture Intelligence: pola-rs/polars Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "pola-rs/polars",
  "source_url": "https://github.com/pola-rs/polars",
  "source_version": "83f1675f",
  "license": "MIT",
  "timestamp": "2026-11-24T00:31:38.904Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pola-rs-polars",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pola-rs/polars](https://github.com/pola-rs/polars) (Revision: `83f1675f`).  
> **License**: MIT | **Timestamp**: `2026-11-24T00:31:38.904Z`  
> **Learning ID**: `learn-github-pola-rs-polars`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence)
- **Confidence Rating**: 51%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from pola-rs/polars:

# Forensic Learning Record (Deep Inspection): pola-rs/polars

> **Canonical Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T00:31:37.609Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 40463 stars

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
- **Issue #31005** (2026-11-23): **Segmentation fault or bus error comparing a Null column inside `over(..., mapping_strategy="join")`**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  df = pl.DataFrame(     {"a": pl.Series([None, None, None], dtype=pl.Null), "g": ["x", "y", "x"]} ) e = (     pl.col("g")     .first()     .eq(pl.lit("1d").le(pl.col("a")).is_null())     .over("g", mapping_strategy="join") )  print(df.lazy().select(e).collect(engine="in-memory"))  # works: [false, false] print(df.lazy().select(e).collect())  # Segmentation fault (exit code 139) ```   ### Log output  ```shell shape: (3, 1) ┌────────────────┐ │ g              │ │ ---            │ │ list[bool]     │ ╞════════════════╡ │ [false, false] │ │ [false]        │ │ [false, false] │ └────────────────┘ ----- stderr (log output) total memory: 24.000 GiB (25769803776 bytes) async thread count: 8 blocking thread count: 512 polars-stream: updating graph state updating in-memory-sink, before: [Blocked] [] updating in-memory-sink, after: [Ready] [] (took 333ns) updating select, before: [Blocked] [Ready] updating select, after: [Ready] [Blocked] (took 542ns) updating in-memory-map, before: [Blocked] [Ready] updating in-memory-map, after: [Ready] [Blocked] (took 542ns) updating in-memory-source, before: [] [Ready] updating in-memory-source, after: [] [Ready] (took 2.099625ms) updating in-memory-map, before: [Ready] [Ready] updating in-memory-map, after: [R
  **Post-Mortem & Fix Analysis**:
  > Thanks!  (With AI) Already fixed on main by #30564 (#30518); it will be in the next release. It isn't platform-specific: 2.1.0 crashes on Linux x86 too once `POLARS_MAX_THREADS` is at least the row count.  ```python import os  os.environ["POLARS_MAX_THREADS"] = "3"  # before importing polars import polars as pl  df = pl.DataFrame(     {"a": pl.Series([None, None, None], dtype=pl.Null), "g": ["x", "y", "x"]} ) e = (     pl.col("g")     .first()     .eq(pl.lit("1d").le(pl.col("a")).is_null())     .over("g", mapping_strategy="join") ) print(df.lazy().select(e).collect()) # 2.1.0: exit code 139; main: [[false, false], [false], [false, false]] ``` 

- **Issue #30995** (2026-11-22): **SQL `UNNEST` of an empty or NULL list returns a row with NULL**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  df = pl.DataFrame({"id": [1, 2, 3], "xs": [[10, 11], [], None]})  df.sql("SELECT id, UNNEST(xs) AS x FROM self ORDER BY id, x").rows() # [(1, 10), (1, 11), (2, None), (3, None)]  df.sql(     "SELECT id, count(*) AS n FROM (SELECT id, UNNEST(xs) AS x FROM self) "     "GROUP BY id ORDER BY id" ).rows() # [(1, 2), (2, 1), (3, 1)] ```  ### Log output  ```shell [(1, 10), (1, 11), (2, None), (3, None)] [(1, 2), (2, 1), (3, 1)] ```  ### Issue description  `UNNEST` of an empty or NULL list returns one row with a NULL, so a count per row counts an item that is not there: ids 2 and 3 above have none. `CROSS JOIN UNNEST(xs) AS u(x)` gives the same rows.  ### Expected behavior  No row for an empty or NULL list, as in Postgres:  ```python [(1, 10), (1, 11)] [(1, 2)] ```  A NULL element of a list still gives a row.  ### Installed versions  <details>  Polars 2.1.0 (latest on PyPI), and main at 1dad4e572d.  </details> 

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

### Incident Patch 1: `60fd1bc3` (2026-11-23)
**Commit Message**: fix: Check Arrow temporal dictionary overflow on import (#31011)

**File**: `py-polars/src/polars/_utils/construction/other.py` (modified, +16/-0)
```diff
@@ -66,6 +66,22 @@ def coerce_arrow(array: pa.Array) -> pa.Array:
             or pa.types.is_int32(array.type.index_type)
         ):
             value_type = array.type.value_type
+            if (
+                pa.types.is_timestamp(value_type) or pa.types.is_duration(value_type)
+            ) and value_type.unit == "s":
+                target = (
+                    pa.timestamp("ms", value_type.tz)
+                    if pa.types.is_timestamp(value_type)
+                    else pa.duration("ms")
+                )
+                # Decode first so only referenced values are checked for overflow.
+                return pa.chunked_array(
+                    [
+                        pc.cast(chunk.dictionary_decode(), target, safe=True)
+                        for chunk in array.iterchunks()
+                    ],
+                    type=target,
+                )
             if pa.types.is_binary(value_type) or _is_pa_type(value_type, "binary_view"):
                 value_type = pa.large_binary()
             elif not _keeps_dictionary_value_type(value_type):
```

**File**: `py-polars/tests/unit/interop/test_interop.py` (modified, +54/-0)
```diff
@@ -212,6 +212,60 @@ def test_arrow_dict_chunks_keep_value_type_30729(
     assert_series_equal(pl.DataFrame({"c": ca})["c"], expected)
 
 
+@pytest.mark.parametrize("value_type", [pa.duration("s"), pa.timestamp("s", "UTC")])
+@pytest.mark.parametrize("overflow", [-(2**63 // 1000) - 1, (2**63 - 1) // 1000 + 1])
+def test_arrow_dict_chunks_temporal_seconds_overflow(
+    value_type: pa.DataType, overflow: int
+) -> None:
+    ca = _two_dict_chunks(pa.int8(), pa.array([1, 2, overflow], value_type))
+    with pytest.raises(pa.ArrowInvalid, match="out of bounds"):
+        pl.from_arrow(ca)
+    with pytest.raises(pa.ArrowInvalid, match="out of bounds"):
+        pl.Series("c", ca)
+    with pytest.raises(pa.ArrowInvalid, match="out of bounds"):
+        pl.DataFrame({"c": ca})
+
+
+@pytest.mark.parametrize(
+    ("value_type", "dtype"),
+    [
+        (pa.duration("s"), pl.Duration("ms")),
+        (pa.timestamp("s", "Europe/Amsterdam"), pl.Datetime("ms", "Europe/Amsterdam")),
+    ],
+)
+def test_arrow_dict_chunks_temporal_seconds_bounds(
+    value_type: pa.DataType, dtype: pl.DataType
+) -> None:
+    min_seconds = -(2**63 // 1000)
+    max_seconds = (2**63 - 1) // 1000
+    ca = pa.chunked_array(
+        [
+            pa.DictionaryArray.from_arrays(
+                pa.array([0, 1, None], pa.int8()),
+                pa.array([min_seconds, None, max_seconds + 1], value_type),
+            ),
+            pa.DictionaryArray.from_arrays(
+                pa.array([None], pa.int8()), pa.array([min_seconds - 1], value_type)
+            ),
+            pa.DictionaryArray.from_arrays(
+                pa.array([0, 1], pa.int8()),
+                pa.array([max_seconds, min_seconds], value_type),
+            ),
+        ]
+    )
+    expected = pl.Series(
+        "c",
+        [min_seconds * 1000, None, None, None, max_seconds * 1000, min_seconds * 1000],
+    )
+    for s in (
+        cast("pl.Series", pl.from_arrow(ca)).alias("c"),
+        pl.Series("c", ca),
+        pl.DataFrame({"c": ca})["c"],
+    ):
+        assert s.dtype == dtype
+        assert_series_equal(s.to_physical(), expected)
+
+
 def test_arrow_dict_chunks_small_index_overflow_30729() -> None:
     # The combined dictionary has more entries than an int8 index can address.
     ca = pa.chunked_array(
```

---

### Incident Patch 2: `e2985639` (2026-11-23)
**Commit Message**: fix: Race condition in spill token waiters bit (#31021)

**File**: `crates/polars-ooc/src/spill_token.rs` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ impl<T: Spillable> SpillTokenInner<T> {
         // while holding the lock to reduce critical section.
         let mut lock = self.lock.lock().unwrap();
         let waiters = core::mem::take(&mut lock.waiters);
-        self.state.fetch_sub(HAS_WAITERS_BIT, Ordering::Relaxed);
+        self.state.fetch_and(!HAS_WAITERS_BIT, Ordering::Relaxed);
         drop(lock);
 
         for w in waiters {
```

---

### Incident Patch 3: `63a0a176` (2026-11-23)
**Commit Message**: fix: Report the failing object path in object-store errors (#29450)

**File**: `crates/polars-io/src/cloud/cloud_writer/internal_writer.rs` (modified, +3/-3)
```diff
@@ -42,12 +42,12 @@ impl InternalCloudWriter {
             let path_ref = &self.path;
             let multipart = PlMultipartUpload::new(
                 self.store
-                    .exec_with_rebuild_retry_on_err(|s| async move {
+                    .exec_with_rebuild_retry_on_err(path_ref, |s| async move {
                         s.put_multipart_opts(path_ref, object_store::PutMultipartOptions::default())
                             .await
                     })
                     .await?,
-                self.store.error_context(),
+                self.store.error_context(path_ref),
             );
 
             let (error_capture, error_handle) = ErrorCapture::new();
@@ -131,7 +131,7 @@ impl InternalCloudWriter {
         let path_ref = &self.path;
         let num_bytes = payload.content_length() as u64;
 
-        let upload_fut = self.store.exec_with_rebuild_retry_on_err(|s| {
+        let upload_fut = self.store.exec_with_rebuild_retry_on_err(path_ref, |s| {
             let payload = payload.clone();
             async move {
                 s.put_opts(path_ref, payload, object_store::PutOptions::default())
```

**File**: `crates/polars-io/src/cloud/glob.rs` (modified, +7/-6)
```diff
@@ -235,7 +235,7 @@ pub async fn glob(
             expansion,
         },
         store,
-    ) = super::build_object_store(url, cloud_options, true).await?;
+    ) = super::build_object_store(url.clone(), cloud_options, true).await?;
     let matcher = &Matcher::new(
         if scheme == "file" {
             // For local paths the returned location has the leading slash stripped.
@@ -246,13 +246,12 @@ pub async fn glob(
         expansion.as_deref(),
     )?;
 
-    let path = Path::from(prefix.as_str());
-    let path = Some(&path);
+    let path = &Path::from(prefix.as_str());
 
     let mut locations = store
-        .exec_with_rebuild_retry_on_err(|store| async move {
+        .exec_with_rebuild_retry_on_err(path, |store| async move {
             store
-                .list(path)
+                .list(Some(path))
                 .try_filter_map(|x| async move {
                     // Keep the LIST-reported byte size alongside the path.
                     let out = (x.size > 0 && matcher.is_matching(x.location.as_ref()))
@@ -262,7 +261,9 @@ pub async fn glob(
                 .try_collect::<Vec<_>>()
                 .await
         })
-        .await?;
+        .await
+        // Name the glob.
+        .map_err(|e| e.wrap_msg(|e| format!("listing glob {url} failed: {e}")))?;
 
     locations.sort_unstable_by(|a, b| a.0.cmp(&b.0));
     Ok(locations
```

**File**: `crates/polars-io/src/cloud/object_store_setup.rs` (modified, +23/-8)
```diff
@@ -238,18 +238,28 @@ pub(crate) struct PolarsObjectStoreBuilder {
 }
 
 impl PolarsObjectStoreBuilder {
+    /// The URL of the request that built the store.
     pub(super) fn path(&self) -> &PlRefPath {
         &self.path
     }
 
+    /// The URL the store is rooted at.
+    pub(super) fn base_url(&self) -> PlRefPath {
+        match self.cloud_type {
+            // The origin, or the full URL for a store tied to one URL.
+            CloudType::Http => self.path.clone(),
+            _ => self.path.sliced(0..self.path.authority_end_position()),
+        }
+    }
+
     pub(crate) fn rate_limit_signal(&self) -> Option<PacingBudget> {
         self.rate_limiter.as_ref().map(|r| r.read_budget())
     }
 
     pub(super) async fn build_impl(
         &self,
-        // Whether to clear cached credentials for Python credential providers.
-        clear_cached_credentials: bool,
+        // On a rebuild, clear cached Python credentials and leave the URL out of build errors.
+        rebuild: bool,
     ) -> PolarsResult<Arc<dyn ObjectStore>> {
         let options = self
             .options
@@ -296,7 +306,8 @@ impl PolarsObjectStoreBuilder {
                     let store = options
                         .build_aws(
                             self.path.clone(),
-                            clear_cached_credentials,
+                            super::ObjectStoreErrorContext::for_build(self.path.clone(), rebuild),
+                            rebuild,
                             self.rate_limiter.as_deref(),
                         )
                         .await?;
@@ -310,7 +321,8 @@ impl PolarsObjectStoreBuilder {
                 {
                     let store = options.build_gcp(
                         self.path.clone(),
-                        clear_cached_credentials,
+                        super::ObjectStoreErrorContext::for_build(self.path.clone(), rebuild),
+                        rebuild,
                         self.rate_limiter.as_deref(),
                     )?;
 
@@ -325,7 +337,8 @@ impl PolarsObjectStoreBuilder {
                     {
                         let store = options.build_azure(
                             self.path.clone(),
-                            clear_cached_credentials,
+                            super::ObjectStoreErrorContext::for_build(self.path.clone(), rebuild),
+                            rebuild,
                             self.rate_limiter.as_deref(),
                         )?;
                         Ok::<_, PolarsError>(Arc::new(store) as Arc<dyn ObjectStore>)
@@ -427,15 +440,15 @@ impl PolarsObjectStoreBuilder {
             let cache = OBJECT_STORE_CACHE.read().await;
 
             if let Some(store) = cache.get(cache_key) {
-                return Ok(store.clone());
+                return Ok(store.clone().with_base_url(self.base_url()));
             }
 
             drop(cache);
 
             let cache = OBJECT_STORE_CACHE.write().await;
 
             if let Some(store) = cache.get(cache_key) {
-                return Ok(store.clone());
+                return Ok(store.clone().with_base_url(self.base_url()));
             }
 
             Some(cache)
@@ -491,12 +504,14 @@ impl PolarsObjectStoreBuilder {
             cell
         };
 
+        let base_url = self.base_url();
+
         cell.get_or_try_init(|| async {
             let store = self.build_impl(false).await?;
             PolarsResult::Ok(PolarsObjectStore::new_from_inner(store, self))
         })
         .await
-        .cloned()
+        .map(|store| store.clone().with_base_url(base_url))
     }
 
     pub(crate) fn is_azure(&self) -> bool {
```

**File**: `crates/polars-io/src/cloud/options.rs` (modified, +6/-8)
```diff
@@ -480,6 +480,7 @@ impl CloudOptions {
     pub(crate) async fn build_aws(
         &self,
         url: PlRefPath,
+        error_cx: ObjectStoreErrorContext,
         clear_cached_credentials: bool,
         rate_limiter: Option<&RateLimiter>,
     ) -> PolarsResult<impl object_store::ObjectStore> {
@@ -660,7 +661,7 @@ impl CloudOptions {
         let out = builder
             .with_unsigned_payload(true)
             .build()
-            .map_err(|e| ObjectStoreErrorContext::new(url).attach_err_info(e))?;
+            .map_err(|e| error_cx.attach_err_info(e))?;
 
         Ok(out)
     }
@@ -682,13 +683,13 @@ impl CloudOptions {
     pub(crate) fn build_azure(
         &self,
         url: PlRefPath,
+        error_cx: ObjectStoreErrorContext,
         clear_cached_credentials: bool,
         rate_limiter: Option<&RateLimiter>,
     ) -> PolarsResult<impl object_store::ObjectStore> {
         use object_store::client::ReqwestConnector;
 
         use super::credential_provider::IntoCredentialProvider;
-        use crate::cloud::ObjectStoreErrorContext;
 
         let verbose = polars_core::config::verbose();
 
@@ -737,9 +738,7 @@ impl CloudOptions {
             None => builder,
         };
 
-        let out = builder
-            .build()
-            .map_err(|e| ObjectStoreErrorContext::new(url).attach_err_info(e))?;
+        let out = builder.build().map_err(|e| error_cx.attach_err_info(e))?;
 
         Ok(out)
     }
@@ -761,6 +760,7 @@ impl CloudOptions {
     pub(crate) fn build_gcp(
         &self,
         url: PlRefPath,
+        error_cx: ObjectStoreErrorContext,
         clear_cached_credentials: bool,
         rate_limiter: Option<&RateLimiter>,
     ) -> PolarsResult<impl object_store::ObjectStore> {
@@ -811,9 +811,7 @@ impl CloudOptions {
             None => builder,
         };
 
-        let out = builder
-            .build()
-            .map_err(|e| ObjectStoreErrorContext::new(url).attach_err_info(e))?;
+        let out = builder.build().map_err(|e| error_cx.attach_err_info(e))?;
 
         Ok(out)
     }
```

**File**: `crates/polars-io/src/cloud/polars_object_store.rs` (modified, +74/-22)
```diff
@@ -24,17 +24,18 @@ use crate::pl_async::{
 
 #[derive(Debug)]
 pub struct PolarsObjectStoreError {
+    /// The URL of the failing object or of the store being built. Empty on a rebuild.
     pub base_url: PlRefPath,
     pub source: object_store::Error,
 }
 
 impl Display for PolarsObjectStoreError {
     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
-        write!(
-            f,
-            "object-store error: {} (path: {})",
-            self.source, self.base_url
-        )
+        write!(f, "object-store error: {}", self.source)?;
+        if !self.base_url.as_str().is_empty() {
+            write!(f, " (path: {})", self.base_url)?;
+        }
+        Ok(())
     }
 }
 
@@ -111,8 +112,10 @@ mod inner {
     use std::sync::Arc;
 
     use object_store::ObjectStore;
+    use object_store::path::Path;
     use polars_core::config;
     use polars_error::{PolarsError, PolarsResult};
+    use polars_utils::pl_path::PlRefPath;
     use polars_utils::relaxed_cell::RelaxedCell;
 
     use crate::cloud::concurrency::{ConcurrencyController, ControllerConfig};
@@ -131,6 +134,8 @@ mod inner {
     #[derive(Clone, Debug)]
     pub struct PolarsObjectStore {
         inner: Arc<Inner>,
+        /// The URL the store is rooted at, as this caller spelled it.
+        base_url: PlRefPath,
         /// Avoid contending the Mutex `lock()` until the first re-build.
         initial_store: std::sync::Arc<dyn ObjectStore>,
         io_metrics: OptIOMetrics,
@@ -148,6 +153,7 @@ mod inner {
             // suffix range there: https://learn.microsoft.com/en-us/rest/api/storageservices/specifying-the-range-header-for-blob-service-operations
             let suffix_range_supported = RelaxedCell::from(!builder.is_azure());
             Self {
+                base_url: builder.base_url(),
                 inner: Arc::new(Inner {
                     store: tokio::sync::RwLock::new(store),
                     builder,
@@ -160,6 +166,11 @@ mod inner {
             }
         }
 
+        pub(crate) fn with_base_url(mut self, base_url: PlRefPath) -> Self {
+            self.base_url = base_url;
+            self
+        }
+
         pub fn set_io_metrics(&mut self, io_metrics: Option<Arc<IOMetrics>>) -> &mut Self {
             self.io_metrics = OptIOMetrics(io_metrics);
             self
@@ -204,7 +215,13 @@ mod inner {
                         .build_impl(true)
                         .await
                         .map_err(|e| {
-                            e.wrap_msg(|e| format!("attempt to rebuild object store failed: {e}"))
+                            let url = self.inner.builder.path();
+                            e.wrap_msg(|e| {
+                                format!(
+                                    "attempt to rebuild object store failed: {e} \
+                                     (store built for: {url})"
+                                )
+                            })
                         })?;
             }
 
@@ -213,8 +230,10 @@ mod inner {
             Ok((*current_store).clone())
         }
 
+        /// `path` is the object `func` addresses.
         pub async fn exec_with_rebuild_retry_on_err<'s, 'f, Fn, Fut, O>(
             &'s self,
+            path: &Path,
             mut func: Fn,
         ) -> PolarsResult<O>
         where
@@ -241,17 +260,18 @@ mod inner {
             }
 
             let store = if rebuild {
-                let store = self
-                    .rebuild_inner(&store)
-                    .await
-                    .map_err(|e| e.wrap_msg(|e| format!("{e}; original error: {orig_err}")))?;
+                let store = self.rebuild_inner(&store).await.map_err(|e| {
+                    // The failing request first, then the rebuild error.
+                    let orig_err = self.error_context(path).attach_err_info(orig_err);
+                    e.wrap_msg(|e| format!("{orig_err}; {e}"))
+                })?;
                 Cow::Owned(store)
             } else {
                 store
             };
 
             func(store).await.map_err(|e| {
-                let e: PolarsError = self.error_context().attach_err_info(e).into();
+                let e: PolarsError = self.error_context(path).attach_err_info(e).into();
 
                 if self.inner.builder.is_azure()
                     && std::env::var("POLARS_AUTO_USE_AZURE_STORAGE_ACCOUNT_KEY").as_deref()
@@ -280,27 +300,59 @@ and use the storage account keys from Azure CLI to authenticate"
             self.inner.suffix_range_supported.store(false);
         }
 
-        pub fn error_context(&self) -> ObjectStoreErrorContext {
-            ObjectStoreErrorContext::new(self.inner.builder.path().clone())
+        /// Context for an error of a request to `path`.
+        pub fn error_context(&self, path: &Path) -> ObjectStoreErrorContext {
+            ObjectStoreErrorContext::new(self.base_url.clone()).with_path(path.clone())
         }
     }
 }
 
 #[derive(Clone)]
 pub struct 
```

**File**: `crates/polars-io/src/path_utils/mod.rs` (modified, +1/-1)
```diff
@@ -348,7 +348,7 @@ async fn expand_path_cloud(
         let prefix_ref = &prefix;
 
         let mut paths = store
-            .exec_with_rebuild_retry_on_err(|s| async move {
+            .exec_with_rebuild_retry_on_err(prefix_ref, |s| async move {
                 let out = s
                     .list(Some(prefix_ref))
                     .try_filter_map(|x| async move {
```

**File**: `crates/polars-python/src/io/iceberg_plugin/v1/host.rs` (modified, +3/-3)
```diff
@@ -281,9 +281,9 @@ unsafe extern "C" fn storage_get(
                 let path = &loc.path;
 
                 loc.store
-                    .exec_with_rebuild_retry_on_err(
-                        |s| async move { s.get(path).await?.bytes().await },
-                    )
+                    .exec_with_rebuild_retry_on_err(path, |s| async move {
+                        s.get(path).await?.bytes().await
+                    })
                     .await
                     .map_err(to_ffi_err)
             };
```

**File**: `py-polars/tests/unit/io/cloud/test_cloud.py` (modified, +22/-0)
```diff
@@ -518,6 +518,28 @@ def test_cloud_timeout_error() -> None:
     assert "operation timed out" in str(exc.value)
 
 
+@pytest.mark.slow
+@pytest.mark.parametrize("op", ["scan", "sink"])
+def test_cloud_error_names_failing_path_29446(s3: CountingS3, op: str) -> None:
+    storage_options = {**s3.storage_options, "max_retries": 0}
+
+    # Builds the bucket's cached store, then removes the object for later tests.
+    df = pl.DataFrame({"x": range(10)})
+    df.lazy().sink_parquet("s3://bucket/a.parquet", storage_options=storage_options)
+    s3.client.delete_object(Bucket="bucket", Key="a.parquet")
+
+    s3.on_request = lambda environ: environ["PATH_INFO"].endswith("/b.parquet") or None
+    url = "s3://bucket/query=B/b.parquet"
+    run = (
+        pl.scan_parquet(url, storage_options=storage_options).collect
+        if op == "scan"
+        else partial(df.lazy().sink_parquet, url, storage_options=storage_options)
+    )
+
+    with pytest.raises(OSError, match=re.escape(f"(path: {url})")):
+        run()
+
+
 @pytest.mark.slow
 @pytest.mark.parametrize(
     "sink",
```

#### Recent Merged Pull Requests:
- **PR #31032** (2026-11-23): build: Revert sharing generic instantiations between crates in release builds (#30960) (@ritchie46)
- **PR #31031** (2026-11-23): fix: Sum a negative constant expression in SQL `SUM` (@kdn36)
- **PR #31030** (2026-11-23): fix: Take the SQL `USING` key from either side of a `FULL` or `RIGHT` join (@kdn36)
- **PR #31029** (2026-11-23): fix(python): Refuse files in Iceberg `add_files` that a scan of the table cannot read (@kdn36)
- **PR #31027** (2026-11-23): fix: Return null for a null `quantile` fraction (@dancsi)
- **PR #31026** (2026-11-23): fix!: Add Expr.bin.find(_many), and return char offsets in Expr.str.find(_many) (@orlp)

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

## X. Check Arrow temporal dictionary overflow on import

**RULE**:
When implementing operations in `py-polars/src/polars/_utils/construction/other.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `60fd1bc3`: Check Arrow temporal dictionary overflow on import. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `py-polars/src/polars/_utils/construction/other.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            if (
                pa.types.is_timestamp(value_type) or pa.types.is_duration(value_type)
            ) and value_type.unit == "s":
                target = (
                    pa.timestamp("ms", value_type.tz)
                    if pa.types.is_timestamp(value_type)
                    else pa.duration("ms")
                )
                # Decode first so only referenced values are checked for overflow.
                return pa.chunked_array(
                    [
                        pc.cast(chunk.dictionary_decode(), target, safe=True)
                        for chunk in array.iterchunks()
                    ],
                    type=target,
                )
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `60fd1bc3` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
