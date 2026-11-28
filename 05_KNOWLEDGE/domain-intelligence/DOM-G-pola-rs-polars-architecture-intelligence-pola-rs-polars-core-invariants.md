# Domain G — Architecture Intelligence: Architecture Intelligence: pola-rs/polars Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "pola-rs/polars",
  "source_url": "https://github.com/pola-rs/polars",
  "source_version": "4ba28fb5",
  "license": "MIT",
  "timestamp": "2026-11-28T12:09:26.329Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pola-rs-polars",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pola-rs/polars](https://github.com/pola-rs/polars) (Revision: `4ba28fb5`).  
> **License**: MIT | **Timestamp**: `2026-11-28T12:09:26.329Z`  
> **Learning ID**: `learn-github-pola-rs-polars`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), H (Technical Construction Intelligence), B (Product Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from pola-rs/polars:

# Forensic Learning Record (Deep Inspection): pola-rs/polars

> **Canonical Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T12:09:24.528Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 40561 stars

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
- **Issue #31158** (2026-11-27): **Rolling aggregations accept inconsistent input dtypes**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python from datetime import date  import polars as pl  df = pl.DataFrame(     {         "bool": [True, False, True],         "decimal": pl.Series([1, 2, 3]).cast(pl.Decimal(10, 2)),         "date": [date(2024, 1, 1), date(2024, 1, 2), date(2024, 1, 3)],         "f16": pl.Series([1.0, 2.0, 3.0], dtype=pl.Float16),     } ) print(" " * 17, *(f"{c:10}" for c in df.columns)) for fn in ["mean", "var", "std", "median", "sum", "min", "max", "skew", "kurtosis"]:     row = []     for col in df.columns:         try:             row.append(str(df.select(getattr(pl.col(col), f"rolling_{fn}")(2)).dtypes[0]).split("(")[0])         except pl.exceptions.InvalidOperationError:             row.append("error")     print(f"rolling_{fn:9}", *(f"{r:10}" for r in row)) ```   ### Log output  ```shell                   bool       decimal    date       f16 rolling_mean      Float64    Float64    Datetime   Float64 rolling_var       Float64    Float64    Float64    Float64 rolling_std       Float64    Float64    Float64    Float64 rolling_median    Float64    Float64    Datetime   Float64 rolling_sum       UInt32     error      error      Float16 rolling_min       Boolean    error      Date       Float16 rolling_max       Boolean    error      Date       Float16 rolling_skew      error    

- **Issue #31156** (2026-11-27): **Multi-file scan_ndjson slice returns the wrong rows when a file has no trailing newline**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the latest version of Polars.  ### Reproducible example  ```python import io  import polars as pl  # The first file has no trailing newline. sources = [     io.BytesIO(b'{"a": 0}\n{"a": 1}\n{"a": 2}'),     io.BytesIO(b'{"a": 3}\n{"a": 4}\n{"a": 5}\n'), ] print(pl.scan_ndjson(sources).slice(3, 1).collect()["a"].to_list()) # [4]  (expected [3]) ```  ### Issue description  When a slice's offset skips a whole file, `RowSkipper::_skip_rows_forward` (`crates/polars-stream/src/nodes/io_sources/ndjson/line_batch_distributor.rs`) only counts lines that end in `\n`. A file without a trailing newline therefore reports one row too few, and the next file is sliced one row too far. With `with_row_index()`, the index still says 3 next to the value 4.  `scan_lines` shares the code: `pl.scan_lines([io.BytesIO(b"a\nb\nc"), io.BytesIO(b"d\ne\n")]).slice(3, 1)` gives `e` instead of `d`.  The same function passes each line to `is_json_line` with its `\n` attached, and `is_json_line` treats only spaces, tabs and `\r` as blank, so a blank line counts as a skipped row, also in a single file: `pl.scan_ndjson(io.BytesIO(b'{"a": 1}\n\n{"a": 2}\n{"a": 3}\n')).slice(2, 1)` gives `a=2` instead of `a=3`.  Negative slices with an offset from the end miscount blank lines too, in `_skip_rows_backward`: `pl.scan_ndjson(io.BytesIO(b'{"a": 1}\n{"a": 2}\n{"a": 3}\n\n\n')).slice(-2, 1)` gives `

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

### Incident Patch 1: `1e27278b` (2026-11-27)
**Commit Message**: fix: Raise `DuplicateError` instead of panicking on duplicate field names in `list.to_struct` and `arr.to_struct` (#31159)

**File**: `crates/polars-plan/src/plans/conversion/dsl_to_ir/functions.rs` (modified, +18/-1)
```diff
@@ -82,6 +82,7 @@ pub(super) fn convert_functions(
                             "arr.to_struct() number of field names provided ({fields_len})
                             does not match width of input ({width})."
                         );
+                        ensure_unique_field_names(&fields)?;
 
                         fields
                     } else {
@@ -241,7 +242,10 @@ pub(super) fn convert_functions(
                 #[cfg(feature = "dtype-array")]
                 L::ToArray(v) => IL::ToArray(v),
                 #[cfg(feature = "list_to_struct")]
-                L::ToStruct(list_to_struct_args) => IL::ToStruct(list_to_struct_args),
+                L::ToStruct(names) => {
+                    ensure_unique_field_names(&names)?;
+                    IL::ToStruct(names)
+                },
                 #[cfg(feature = "dtype-map")]
                 L::ToMap => IL::ToMap,
             })
@@ -1426,6 +1430,19 @@ pub(super) fn convert_functions(
     Ok((ctx.arena.add(ae_function), output_name))
 }
 
+/// Errors if two of the struct field names in `names` are equal.
+#[cfg(any(
+    feature = "list_to_struct",
+    all(feature = "dtype-array", feature = "array_to_struct")
+))]
+fn ensure_unique_field_names(names: &[PlSmallStr]) -> PolarsResult<()> {
+    let mut seen = PlIndexSet::with_capacity(names.len());
+    for name in names {
+        polars_ensure!(seen.insert(name), duplicate_field = name);
+    }
+    Ok(())
+}
+
 /// Checks the fraction given to `quantile` or `approx_quantile`, and returns its non-null values if
 /// it is a literal. `allowed` gives the dtypes the fraction may have. Checking here makes every
 /// engine raise on a bad fraction, even on empty input.
```

**File**: `py-polars/tests/unit/operations/namespaces/test_struct.py` (modified, +16/-0)
```diff
@@ -8,6 +8,7 @@
 import polars as pl
 from polars.exceptions import (
     ColumnNotFoundError,
+    DuplicateError,
     InvalidOperationError,
     StructFieldNotFoundError,
 )
@@ -43,6 +44,21 @@ def test_rename_fields() -> None:
     assert s.struct.fields == ["a", "b", "c"]
 
 
+@pytest.mark.parametrize(
+    ("dtype", "expr"),
+    [
+        (pl.List(pl.Int64), pl.col("a").list.to_struct(["y", "y"])),
+        (pl.Array(pl.Int64, 2), pl.col("a").arr.to_struct(["y", "y"])),
+    ],
+)
+def test_duplicate_field_names_raise_31152(dtype: pl.DataType, expr: pl.Expr) -> None:
+    df = pl.DataFrame({"a": [[1, 2]]}, schema={"a": dtype})
+    with pytest.raises(DuplicateError, match="multiple fields with name 'y' found"):
+        df.select(expr)
+    with pytest.raises(DuplicateError, match="multiple fields with name 'y' found"):
+        df.lazy().select(expr).collect_schema()
+
+
 def test_drop() -> None:
     df = pl.DataFrame({"int": [1, 2], "str": ["a", "b"], "bool": [True, None]})
     s = df.to_struct("my_struct").struct.drop(["str"])
```

---

### Incident Patch 2: `b54171bd` (2026-11-27)
**Commit Message**: fix: Check the input dtype of rolling functions at planning, and return Float16 for Float16 (#31047)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `crates/polars-core/src/series/mod.rs` (modified, +5/-2)
```diff
@@ -647,11 +647,14 @@ impl Series {
         ext.into_series()
     }
 
-    /// Cast numerical types to f64, and keep floats as is.
+    /// Cast numeric, Boolean, Decimal and null Series to f64, and keep f32 and f64 as is.
     pub fn to_float(&self) -> PolarsResult<Series> {
         match self.dtype() {
             DataType::Float32 | DataType::Float64 => Ok(self.clone()),
-            _ => self.cast_with_options(&DataType::Float64, CastOptions::Overflowing),
+            dt if dt.is_numeric() || dt.is_bool() || dt.is_null() => {
+                self.cast_with_options(&DataType::Float64, CastOptions::Overflowing)
+            },
+            dt => polars_bail!(InvalidOperation: "cannot convert dtype `{dt}` to a float"),
         }
     }
 
```

**File**: `crates/polars-expr/src/dispatch/rolling.rs` (modified, +9/-30)
```diff
@@ -1,40 +1,13 @@
-use polars_arrow::temporal_conversions::MICROSECONDS_IN_DAY as US_IN_DAY;
 use polars_core::error::PolarsResult;
 #[cfg(feature = "cov")]
 use polars_core::error::{polars_bail, polars_ensure};
-use polars_core::prelude::{Column, DataType, IntoColumn, RollingOptionsFixedWindow, TimeUnit};
+use polars_core::prelude::{Column, DataType, RollingOptionsFixedWindow};
 use polars_core::series::Series;
 #[cfg(feature = "cov")]
 use polars_plan::dsl::RollingCovOptions;
 use polars_plan::prelude::PlanCallback;
 use polars_time::prelude::SeriesOpsTime;
 
-fn roll_with_temporal_conversion<F: FnOnce(&Series) -> PolarsResult<Series>>(
-    s: &Column,
-    op: F,
-) -> PolarsResult<Column> {
-    let dt = s.dtype();
-    let s = if dt.is_temporal() {
-        &s.to_physical_repr()
-    } else {
-        s
-    };
-
-    // @scalar-opt
-    let out = op(s.as_materialized_series())?;
-
-    Ok(match dt {
-        DataType::Date => (out * US_IN_DAY as f64)
-            .cast(&DataType::Int64)?
-            .into_datetime(TimeUnit::Microseconds, None),
-        DataType::Datetime(tu, tz) => out.cast(&DataType::Int64)?.into_datetime(*tu, tz.clone()),
-        DataType::Duration(tu) => out.cast(&DataType::Int64)?.into_duration(*tu),
-        DataType::Time => out.cast(&DataType::Int64)?.into_time(),
-        _ => out,
-    }
-    .into_column())
-}
-
 pub(super) fn rolling_min(s: &Column, options: RollingOptionsFixedWindow) -> PolarsResult<Column> {
     // @scalar-opt
     s.as_materialized_series()
@@ -50,7 +23,10 @@ pub(super) fn rolling_max(s: &Column, options: RollingOptionsFixedWindow) -> Pol
 }
 
 pub(super) fn rolling_mean(s: &Column, options: RollingOptionsFixedWindow) -> PolarsResult<Column> {
-    roll_with_temporal_conversion(s, |s| s.rolling_mean(options))
+    // @scalar-opt
+    s.as_materialized_series()
+        .rolling_mean(options)
+        .map(Column::from)
 }
 
 pub(super) fn rolling_sum(s: &Column, options: RollingOptionsFixedWindow) -> PolarsResult<Column> {
@@ -64,7 +40,10 @@ pub(super) fn rolling_quantile(
     s: &Column,
     options: RollingOptionsFixedWindow,
 ) -> PolarsResult<Column> {
-    roll_with_temporal_conversion(s, |s| s.rolling_quantile(options))
+    // @scalar-opt
+    s.as_materialized_series()
+        .rolling_quantile(options)
+        .map(Column::from)
 }
 
 pub(super) fn rolling_var(s: &Column, options: RollingOptionsFixedWindow) -> PolarsResult<Column> {
```

**File**: `crates/polars-expr/src/dispatch/rolling_by.rs` (modified, +9/-32)
```diff
@@ -1,37 +1,8 @@
-use polars_arrow::temporal_conversions::MICROSECONDS_IN_DAY as US_IN_DAY;
 use polars_core::error::PolarsResult;
-use polars_core::prelude::{Column, DataType, IntoColumn, TimeUnit};
-use polars_core::series::Series;
+use polars_core::prelude::Column;
 use polars_defs::time::rolling::RollingOptionsDynamicWindow;
 use polars_time::prelude::SeriesOpsTime;
 
-fn roll_by_with_temporal_conversion<F: FnOnce(&Series, &Series) -> PolarsResult<Series>>(
-    s: &[Column],
-    op: F,
-) -> PolarsResult<Column> {
-    let by = &s[1];
-    let dt = &s[0].dtype();
-    let s = if dt.is_temporal() {
-        &s[0].to_physical_repr()
-    } else {
-        &s[0]
-    };
-
-    // @scalar-opt
-    let out = op(s.as_materialized_series(), by.as_materialized_series())?;
-
-    Ok(match dt {
-        DataType::Date => (out * US_IN_DAY as f64)
-            .cast(&DataType::Int64)?
-            .into_datetime(TimeUnit::Microseconds, None),
-        DataType::Datetime(tu, tz) => out.cast(&DataType::Int64)?.into_datetime(*tu, tz.clone()),
-        DataType::Duration(tu) => out.cast(&DataType::Int64)?.into_duration(*tu),
-        DataType::Time => out.cast(&DataType::Int64)?.into_time(),
-        _ => out,
-    }
-    .into_column())
-}
-
 pub(super) fn rolling_min_by(
     s: &[Column],
     options: RollingOptionsDynamicWindow,
@@ -56,7 +27,10 @@ pub(super) fn rolling_mean_by(
     s: &[Column],
     options: RollingOptionsDynamicWindow,
 ) -> PolarsResult<Column> {
-    roll_by_with_temporal_conversion(s, |s, by| s.rolling_mean_by(by, options))
+    // @scalar-opt
+    s[0].as_materialized_series()
+        .rolling_mean_by(s[1].as_materialized_series(), options)
+        .map(Column::from)
 }
 
 pub(super) fn rolling_sum_by(
@@ -73,7 +47,10 @@ pub(super) fn rolling_quantile_by(
     s: &[Column],
     options: RollingOptionsDynamicWindow,
 ) -> PolarsResult<Column> {
-    roll_by_with_temporal_conversion(s, |s, by| s.rolling_quantile_by(by, options))
+    // @scalar-opt
+    s[0].as_materialized_series()
+        .rolling_quantile_by(s[1].as_materialized_series(), options)
+        .map(Column::from)
 }
 
 pub(super) fn rolling_var_by(
```

**File**: `crates/polars-plan/src/dsl/function_expr/rolling.rs` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ impl Display for RollingFunction {
             Min => "min",
             Max => "max",
             Mean => "mean",
-            Sum => "rsum",
+            Sum => "sum",
             Quantile => "quantile",
             Var => "var",
             Std => "std",
```

**File**: `crates/polars-plan/src/plans/aexpr/function_expr/rolling.rs` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ impl Display for IRRollingFunction {
             Min => "min",
             Max => "max",
             Mean => "mean",
-            Sum => "rsum",
+            Sum => "sum",
             Quantile => "quantile",
             Var => "var",
             Std => "std",
```

**File**: `crates/polars-plan/src/plans/aexpr/function_expr/schema.rs` (modified, +63/-34)
```diff
@@ -86,12 +86,31 @@ impl IRFunctionExpr {
             #[cfg(feature = "rolling_window")]
             RollingExpr { function, options } => {
                 use IRRollingFunction::*;
+                let op = function;
                 match function {
-                    Min | Max => mapper.with_same_dtype(),
-                    Mean | Quantile => mapper.moment_dtype(),
-                    Std => mapper.var_dtype("std"),
-                    Var => mapper.var_dtype("var"),
-                    Sum => mapper.sum_dtype(),
+                    // Weighted windows compute in floats.
+                    Min | Max | Sum if options.weights.is_some() => {
+                        mapper.ensure_input(op, |dt| dt.is_numeric() || dt.is_bool())?;
+                        mapper.map_to_float_dtype()
+                    },
+                    Min | Max => {
+                        mapper.ensure_input(op, |dt| {
+                            dt.is_primitive_numeric() || dt.is_bool() || dt.is_temporal()
+                        })?;
+                        mapper.with_same_dtype()
+                    },
+                    Sum => {
+                        mapper.ensure_input(op, |dt| dt.is_primitive_numeric() || dt.is_bool())?;
+                        mapper.sum_dtype()
+                    },
+                    Mean | Quantile => {
+                        mapper.ensure_moment_input(op, true)?;
+                        mapper.moment_dtype()
+                    },
+                    Std | Var => {
+                        mapper.ensure_moment_input(op, false)?;
+                        mapper.moment_dtype()
+                    },
                     Rank => match options.fn_params {
                         Some(RollingFnParams::Rank {
                             method: RollingRankMethod::Average,
@@ -108,20 +127,12 @@ impl IRFunctionExpr {
                         })
                     }),
                     #[cfg(feature = "moment")]
-                    Skew | Kurtosis => mapper.map_to_float_dtype(),
-                    Map(_) => mapper.try_map_field(|field| {
-                        if options.weights.is_some() {
-                            let dtype = match field.dtype() {
-                                #[cfg(feature = "dtype-f16")]
-                                DataType::Float16 => DataType::Float16,
-                                DataType::Float32 => DataType::Float32,
-                                _ => DataType::Float64,
-                            };
-                            Ok(Field::new(field.name().clone(), dtype))
-                        } else {
-                            Ok(field.clone())
-                        }
-                    }),
+                    Skew | Kurtosis => {
+                        mapper.ensure_input(op, |dt| dt.is_primitive_numeric())?;
+                        mapper.map_to_float_dtype()
+                    },
+                    Map(_) if options.weights.is_some() => mapper.map_to_float_dtype(),
+                    Map(_) => mapper.with_same_dtype(),
                 }
             },
             #[cfg(feature = "rolling_window_by")]
@@ -131,12 +142,26 @@ impl IRFunctionExpr {
                 ..
             } => {
                 use IRRollingFunctionBy::*;
+                let op = function_by;
                 match function_by {
-                    MinBy | MaxBy => mapper.with_same_dtype(),
-                    MeanBy | QuantileBy => mapper.moment_dtype(),
-                    StdBy => mapper.var_dtype("std"),
-                    VarBy => mapper.var_dtype("var"),
-                    SumBy => mapper.sum_dtype(),
+                    MinBy | MaxBy => {
+                        mapper.ensure_input(op, |dt| {
+                            dt.is_primitive_numeric() || dt.is_bool() || dt.is_temporal()
+                        })?;
+                        mapper.with_same_dtype()
+                    },
+                    MeanBy | QuantileBy => {
+                        mapper.ensure_moment_input(op, true)?;
+                        mapper.moment_dtype()
+                    },
+                    StdBy | VarBy => {
+                        mapper.ensure_moment_input(op, false)?;
+                        mapper.moment_dtype()
+                    },
+                    SumBy => {
+                        mapper.ensure_input(op, |dt| dt.is_primitive_numeric() || dt.is_bool())?;
+                        mapper.sum_dtype()
+                    },
                     RankBy => match options.fn_params {
                         Some(RollingFnParams::Rank {
                             method: RollingRankMethod::Average,
@@ -706,18 +731,22 @@ impl<'a> FieldsMapper<'a> {
     /// Returns an error if the operation `op` (e.g. "median") doesn't support the input dtype.
     /// It supports null, Boolean, numeric and Decimal input, and temporal input if
     /// `allow_temporal`. An unknown dtype passes, since it can't be checked ye
```

**File**: `crates/polars-time/src/chunkedarray/rolling_window/dispatch.rs` (modified, +124/-77)
```diff
@@ -2,6 +2,7 @@ use std::borrow::Cow;
 
 #[cfg(feature = "dtype-f16")]
 use num_traits::real::Real;
+use polars_arrow::temporal_conversions::MICROSECONDS_IN_DAY;
 use polars_arrow::types::NativeType;
 use polars_compute::rolling::no_nulls::RollingAggWindowNoNulls;
 use polars_compute::rolling::nulls::RollingAggWindowNulls;
@@ -27,6 +28,53 @@ fn check_rolling_quantile(params: Option<&RollingFnParams>) -> PolarsResult<()>
     Ok(())
 }
 
+/// Runs `f` on `s` cast to Float32 or Float64. Float16 is computed in Float64, and the result
+/// narrowed back.
+fn with_float(s: &Series, f: impl FnOnce(&Series) -> PolarsResult<Series>) -> PolarsResult<Series> {
+    let out = f(&s.to_float()?)?;
+    match s.dtype() {
+        DataType::Float16 => out.cast(&DataType::Float16),
+        _ => Ok(out),
+    }
+}
+
+/// Runs `f` on the physical values of a temporal `s`, and casts its float result back to the
+/// temporal dtype. A Date becomes a Datetime, since the result can fall between days.
+fn with_temporal(
+    s: &Series,
+    f: impl FnOnce(&Series) -> PolarsResult<Series>,
+) -> PolarsResult<Series> {
+    let dtype = s.dtype();
+    if !dtype.is_temporal() {
+        return f(s);
+    }
+    let out = f(&s.to_physical_repr())?;
+    match dtype {
+        DataType::Date => (out * MICROSECONDS_IN_DAY as f64)
+            .cast(&DataType::Int64)?
+            .cast(&DataType::Datetime(TimeUnit::Microseconds, None)),
+        // Not `cast`, which drops the time zone without the `timezones` feature.
+        DataType::Datetime(tu, tz) => {
+            Ok(out.cast(&DataType::Int64)?.into_datetime(*tu, tz.clone()))
+        },
+        dt => out.cast(&DataType::Int64)?.cast(dt),
+    }
+}
+
+/// Whether a weighted rolling window over `s` has to cast it to a float first.
+#[cfg(feature = "rolling_window")]
+fn needs_weighted_float(s: &Series, options: &RollingOptionsFixedWindow) -> bool {
+    options.weights.is_some() && !matches!(s.dtype(), DataType::Float32 | DataType::Float64)
+}
+
+fn sqrt_float(mut s: Series) -> Series {
+    with_match_physical_float_polars_type!(s.dtype(), |$T| {
+        let ca: &mut ChunkedArray<$T> = s._get_inner_mut().as_mut();
+        ca.apply_mut(|v| v.sqrt());
+    });
+    s
+}
+
 #[cfg(feature = "rolling_window")]
 #[allow(clippy::type_complexity)]
 fn rolling_agg<T>(
@@ -302,26 +350,32 @@ pub trait SeriesOpsTime: AsSeries {
         by: &Series,
         options: RollingOptionsDynamicWindow,
     ) -> PolarsResult<Series> {
-        let s = self.as_series().to_float()?;
-        with_match_physical_float_polars_type!(s.dtype(), |$T| {
-            let ca: &ChunkedArray<$T> = s.as_ref().as_ref().as_ref();
-            rolling_agg_by::<$T, _, MeanWindow<_>, MeanWindow<_>>(ca, by, options)
+        with_temporal(self.as_series(), |s| {
+            with_float(s, |s| {
+                with_match_physical_float_polars_type!(s.dtype(), |$T| {
+                    let ca: &ChunkedArray<$T> = s.as_ref().as_ref().as_ref();
+                    rolling_agg_by::<$T, _, MeanWindow<_>, MeanWindow<_>>(ca, by, options)
+                })
+            })
         })
     }
     /// Apply a rolling mean to a Series.
     ///
     /// See: [`RollingAgg::rolling_mean`]
     #[cfg(feature = "rolling_window")]
     fn rolling_mean(&self, options: RollingOptionsFixedWindow) -> PolarsResult<Series> {
-        let s = self.as_series().to_float()?;
-        with_match_physical_float_polars_type!(s.dtype(), |$T| {
-            let ca: &ChunkedArray<$T> = s.as_ref().as_ref().as_ref();
-            rolling_agg(
-                ca,
-                options,
-                &rolling::no_nulls::rolling_mean,
-                &rolling::nulls::rolling_mean,
-            )
+        with_temporal(self.as_series(), |s| {
+            with_float(s, |s| {
+                with_match_physical_float_polars_type!(s.dtype(), |$T| {
+                    let ca: &ChunkedArray<$T> = s.as_ref().as_ref().as_ref();
+                    rolling_agg(
+                        ca,
+                        options,
+                        &rolling::no_nulls::rolling_mean,
+                        &rolling::nulls::rolling_mean,
+                    )
+                })
+            })
         })
     }
     /// Apply a rolling sum to a Series based on another Series.
@@ -359,10 +413,11 @@ pub trait SeriesOpsTime: AsSeries {
     /// Apply a rolling sum to a Series.
     #[cfg(feature = "rolling_window")]
     fn rolling_sum(&self, options: RollingOptionsFixedWindow) -> PolarsResult<Series> {
+        if needs_weighted_float(self.as_series(), &options) {
+            return with_float(self.as_series(), |s| s.rolling_sum(options));
+        }
         let mut s = self.as_series().clone();
-        if options.weights.is_some() {
-            s = s.to_float()?;
-        } else if s.dtype() == &DataType::Boolean {
+        if s.dtype() == &DataType::Boolean {
             s = s.cast(&DataType::IDX_DTYPE).unwrap();
         } else if
```

**File**: `py-polars/tests/unit/operations/test_rolling.py` (modified, +91/-0)
```diff
@@ -653,6 +653,97 @@ def test_rolling_unsupported_22065() -> None:
         pl.Series("a", [[None]], pl.List(pl.Null)).rolling_sum(10)
 
 
+@pytest.mark.parametrize(
+    ("values", "expr"),
+    [
+        (["1", "2"], pl.col("x").rolling_mean(2)),
+        (["1", "2"], pl.col("x").rolling_quantile(0.5, window_size=2)),
+        (["1", "2"], pl.col("x").rolling_std(2)),
+        (["1", "2"], pl.col("x").rolling_mean_by("t", window_size="2i")),
+        (["1", "2"], pl.col("x").rolling_sum(2, weights=[1.0, 1.0])),
+        ([[1], [2]], pl.col("x").rolling_std(2)),
+        ([[1], [2]], pl.col("x").rolling_mean(2)),
+        ([date(2020, 1, 1), date(2020, 1, 2)], pl.col("x").rolling_var(2)),
+        ([date(2020, 1, 1), date(2020, 1, 2)], pl.col("x").rolling_std(2)),
+        (
+            [datetime(2020, 1, 1), datetime(2020, 1, 2)],
+            pl.col("x").rolling_std_by("t", window_size="2i"),
+        ),
+        (
+            [date(2020, 1, 1), date(2020, 1, 2)],
+            pl.col("x").rolling_min(2, weights=[1.0, 1.0]),
+        ),
+        (
+            [timedelta(1), timedelta(2)],
+            pl.col("x").rolling_sum(2, weights=[1.0, 1.0]),
+        ),
+        (pl.Series([1, 2], dtype=pl.Decimal(10, 2)), pl.col("x").rolling_sum(2)),
+        (pl.Series([1, 2], dtype=pl.Decimal(10, 2)), pl.col("x").rolling_max(2)),
+        ([True, False], pl.col("x").rolling_skew(2)),
+    ],
+)
+def test_rolling_unsupported_dtype_raises_at_planning(
+    values: Any, expr: pl.Expr
+) -> None:
+    lf = pl.LazyFrame({"x": values, "t": [0, 1]}).select(expr)
+    with pytest.raises(InvalidOperationError, match="operation not supported"):
+        lf.collect_schema()
+    with pytest.raises(InvalidOperationError, match="operation not supported"):
+        lf.collect()
+
+
+@pytest.mark.parametrize(
+    "expr",
+    [
+        pl.col("x").rolling_mean(2),
+        pl.col("x").rolling_median(2),
+        pl.col("x").rolling_var(2),
+        pl.col("x").rolling_std(2),
+        pl.col("x").rolling_mean_by("t", window_size="2i"),
+        pl.col("x").rolling_quantile_by("t", window_size="2i", quantile=0.5),
+        pl.col("x").rolling_var_by("t", window_size="2i"),
+        pl.col("x").rolling_std_by("t", window_size="2i"),
+        pl.col("x").rolling_mean(2, weights=[1.0, 2.0]),
+        pl.col("x").rolling_std(2, weights=[1.0, 2.0]),
+        pl.col("x").rolling_sum(2, weights=[1.0, 2.0]),
+        pl.col("x").rolling_min(2, weights=[1.0, 2.0]),
+        pl.col("x").rolling_max(2, weights=[1.0, 2.0]),
+    ],
+)
+@pytest.mark.parametrize(
+    "dtype", [pl.Float16, pl.Float32, pl.Int64, pl.Boolean, pl.Decimal(10, 2)]
+)
+def test_rolling_dtype_matches_schema(expr: pl.Expr, dtype: pl.DataType) -> None:
+    values = [True, False, True] if dtype == pl.Boolean else [1, 2, 4]
+    lf = pl.LazyFrame({"x": pl.Series(values, dtype=dtype), "t": [0, 1, 2]})
+    lf = lf.select(expr)
+    out = lf.collect()
+    assert lf.collect_schema() == out.schema
+    expected = dtype if dtype in (pl.Float16, pl.Float32) else pl.Float64
+    assert out.schema["x"] == expected
+
+
+@pytest.mark.parametrize(
+    ("values", "expr", "expected"),
+    [
+        # The variance 65536 is out of Float16 range, the standard deviation isn't.
+        ([0, 512], pl.col("x").rolling_std(2, ddof=0), 256.0),
+        ([0, 512], pl.col("x").rolling_std(2, ddof=0, weights=[1.0, 1.0]), 256.0),
+        ([0, 512], pl.col("x").rolling_std_by("t", window_size="2i", ddof=0), 256.0),
+        # The sum 120000 is out of Float16 range, the mean isn't.
+        ([60000, 60000], pl.col("x").rolling_mean(2), 60000.0),
+        ([60000, 60000], pl.col("x").rolling_mean_by("t", window_size="2i"), 60000.0),
+    ],
+)
+def test_rolling_float16_intermediate_out_of_range(
+    values: list[int], expr: pl.Expr, expected: float
+) -> None:
+    lf = pl.LazyFrame({"x": pl.Series(values, dtype=pl.Float16), "t": [0, 1]})
+    out = lf.select(expr).collect().to_series()
+    assert out.dtype == pl.Float16
+    assert out[-1] == expected
+
+
 def test_rolling_mean_f32_22936() -> None:
     arr = np.array(
         [
```

---

### Incident Patch 3: `7cfc2bbd` (2026-11-27)
**Commit Message**: fix: Count blank and unterminated lines in NDJSON slice offsets (#31157)

**File**: `crates/polars-stream/src/nodes/io_sources/ndjson/line_batch_distributor.rs` (modified, +27/-33)
```diff
@@ -331,9 +331,10 @@ impl RowSkipper {
     /// Takes `chunk` which contains N lines and consumes min(N, M) lines, where M is the number of
     /// lines that have not yet been skipped.
     ///
-    /// `chunk` is expected in the form "line_a\nline_b\nline_c(\n)?" regardless of `reverse`.
+    /// `chunk` is expected in the form "line_a\nline_b\nline_c(\n)?" regardless of `reverse`. The
+    /// returned bytes are the remaining whole lines.
     fn skip_rows(&mut self, chunk: Buffer<u8>) -> Buffer<u8> {
-        if self.n_rows_skipped >= self.cfg_n_rows_to_skip {
+        if self.n_rows_skipped >= self.cfg_n_rows_to_skip || chunk.is_empty() {
             return chunk;
         }
 
@@ -346,49 +347,42 @@ impl RowSkipper {
 
     fn _skip_rows_forward(&mut self, chunk: Buffer<u8>) -> Buffer<u8> {
         let len = chunk.len();
-        let mut offset = 0;
+        // The last line of the input may have no `\n`.
+        let unterminated_end = (chunk.last() != Some(&LF)).then_some(len);
+        let mut start = 0;
 
-        while let Some(pos) = memchr::memchr(LF, &chunk[offset..]) {
-            let prev_offset = offset;
-            offset = cmp::min(offset + pos + 1, len);
+        for end in memchr::memchr_iter(LF, &chunk).chain(unterminated_end) {
+            if (self.is_line)(&chunk[start..end]) {
+                self.n_rows_skipped += 1;
 
-            if !(self.is_line)(&chunk[prev_offset..offset]) {
-                continue;
-            }
-
-            self.n_rows_skipped += 1;
-
-            if self.n_rows_skipped >= self.cfg_n_rows_to_skip {
-                return chunk.sliced(offset..len);
+                if self.n_rows_skipped >= self.cfg_n_rows_to_skip {
+                    return chunk.sliced(cmp::min(end + 1, len)..);
+                }
             }
+            start = end + 1;
         }
 
         Buffer::new()
     }
 
     fn _skip_rows_backward(&mut self, chunk: Buffer<u8>) -> Buffer<u8> {
-        let len = chunk.len();
-        let mut offset = len.saturating_sub((chunk.last().copied() == Some(LF)) as usize);
-
-        while let Some(pos) = memchr::memrchr(LF, &chunk[..offset]) {
-            let prev_offset = offset;
-            offset = pos;
-
-            if !(self.is_line)(&chunk[offset..prev_offset]) {
-                continue;
-            }
-
-            self.n_rows_skipped += 1;
-
-            if self.n_rows_skipped >= self.cfg_n_rows_to_skip {
-                return chunk.sliced(0..offset);
+        // A final `\n` ends the last line.
+        let mut end = chunk.len() - (chunk.last() == Some(&LF)) as usize;
+
+        for start in memchr::memrchr_iter(LF, &chunk[..end])
+            .map(|i| i + 1)
+            .chain([0])
+        {
+            if (self.is_line)(&chunk[start..end]) {
+                self.n_rows_skipped += 1;
+
+                if self.n_rows_skipped >= self.cfg_n_rows_to_skip {
+                    return chunk.sliced(0..start);
+                }
             }
-
-            offset = offset.saturating_sub(1);
+            end = start.saturating_sub(1);
         }
 
-        self.n_rows_skipped += !chunk.is_empty() as usize;
-
         Buffer::new()
     }
 }
```

**File**: `py-polars/tests/unit/io/test_lazy_json.py` (modified, +14/-0)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import io
 import re
 from typing import TYPE_CHECKING
 
@@ -10,6 +11,7 @@
 
 if TYPE_CHECKING:
     from pathlib import Path
+    from typing import IO
 
     from polars._typing import NdjsonCompression, PolarsDataType
     from tests.conftest import PlMonkeyPatch
@@ -219,6 +221,18 @@ def test_scan_ndjson_slicing(
         )
 
 
+def test_scan_ndjson_slice_counts_skipped_rows() -> None:
+    # Blank lines aren't rows; a last line without a newline is one.
+    sources: list[IO[bytes]] = [
+        io.BytesIO(b'{"a": 0}\n{"a": 1}\n{"a": 2}'),
+        io.BytesIO(b'{"a": 3}\n{"a": 4}\n'),
+    ]
+    assert pl.scan_ndjson(sources).slice(3, 1).collect()["a"].to_list() == [3]
+    lf = pl.scan_ndjson(b'{"a": 0}\n\n{"a": 1}\n{"a": 2}\n\n\n')
+    assert lf.slice(2, 1).collect()["a"].to_list() == [2]
+    assert lf.slice(-2, 1).collect()["a"].to_list() == [1]
+
+
 @pytest.mark.parametrize(
     "dtype",
     [
```

**File**: `py-polars/tests/unit/io/test_scan_lines.py` (modified, +10/-1)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
-from typing import TYPE_CHECKING, Any
+import io
+from typing import IO, TYPE_CHECKING, Any
 
 import pytest
 
@@ -214,6 +215,14 @@ def test_scan_lines_negative_slice_reversed_read(
     assert q.select(pl.len()).collect().item() == 5000
 
 
+def test_scan_lines_slice_counts_skipped_rows() -> None:
+    # A last line without a newline is a row, and so is an empty line.
+    sources: list[IO[bytes]] = [io.BytesIO(b"a\nb\nc"), io.BytesIO(b"d\ne\n")]
+    assert pl.scan_lines(sources).slice(3, 1).collect().to_series().to_list() == ["d"]
+    lf = pl.scan_lines(b"a\n\nb\n")
+    assert lf.slice(-2, 1).collect().to_series().to_list() == [""]
+
+
 def test_scan_source_shorter_than_compression_magic(tmp_path: Path) -> None:
     path = tmp_path / "a.txt"
     path.write_bytes(b"\n")
```

#### Recent Merged Pull Requests:
- **PR #31159** (2026-11-27): fix: Raise `DuplicateError` instead of panicking on duplicate field names in `list.to_struct` and `arr.to_struct` (@kdn36)
- **PR #31157** (2026-11-27): fix: Count blank and unterminated lines in NDJSON slice offsets (@kdn36)
- **PR #31151** (closed): fix: Raise error for Struct and String input in rolling mean/var/std/quantile/median (@Kevin-Patyk)
- **PR #31149** (2026-11-27): fix: Scalar-only `select` returns one row per chunk and scalar `filter` raises ShapeError (@kdn36)
- **PR #31147** (2026-11-27): feat: Support CALL expire_snapshots on Iceberg catalog tables in SQL (@kdn36)
- **PR #31145** (2026-11-27): ci: Mark more tests as slow (@orlp)

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

## X. Raise `DuplicateError` instead of panicking on duplicate field names in `list.to

**RULE**:
When implementing operations in `crates/polars-plan/src/plans/conversion/dsl_to_ir/functions.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e27278b`: Raise `DuplicateError` instead of panicking on duplicate field names in `list.to_struct` and `arr.to_struct`. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/polars-plan/src/plans/conversion/dsl_to_ir/functions.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                        ensure_unique_field_names(&fields)?;
                L::ToStruct(names) => {
                    ensure_unique_field_names(&names)?;
                    IL::ToStruct(names)
                },
/// Errors if two of the struct field names in `names` are equal.
#[cfg(any(
    feature = "list_to_struct",
    all(feature = "dtype-array", feature = "array_to_struct")
))]
fn ensure_unique_field_names(names: &[PlSmallStr]) -> PolarsResult<()> {
    let mut seen = PlIndexSet::with_capacity(names.len());
    for name in names {
        polars_ensure!(seen.insert(name), duplicate_field = name);
    }
    Ok(())
}

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                L::ToStruct(list_to_struct_args) => IL::ToStruct(list_to_struct_args),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e27278b` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
