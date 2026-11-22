# Verification Protocol: Verification Protocol: Empirical Defect Shield for pola-rs/polars

<!-- PROVENANCE_START
{
  "source_repository": "pola-rs/polars",
  "source_url": "https://github.com/pola-rs/polars",
  "source_version": "7ff0ffa2",
  "license": "MIT",
  "timestamp": "2026-11-22T16:48:07.615Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pola-rs-polars",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pola-rs/polars](https://github.com/pola-rs/polars) (Revision: `7ff0ffa2`).  
> **License**: MIT | **Timestamp**: `2026-11-22T16:48:07.615Z`  
> **Learning ID**: `learn-github-pola-rs-polars`


## 1. Scope & Verification Target
- **Target Repository**: `pola-rs/polars` (Commit: `7ff0ffa2`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): pola-rs/polars

> **Canonical Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T16:48:06.075Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 40433 stars

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
- **Issue #30995** (2026-11-22): **SQL `UNNEST` of an empty or NULL list returns a row with NULL**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  df = pl.DataFrame({"id": [1, 2, 3], "xs": [[10, 11], [], None]})  df.sql("SELECT id, UNNEST(xs) AS x FROM self ORDER BY id, x").rows() # [(1, 10), (1, 11), (2, None), (3, None)]  df.sql(     "SELECT id, count(*) AS n FROM (SELECT id, UNNEST(xs) AS x FROM self) "     "GROUP BY id ORDER BY id" ).rows() # [(1, 2), (2, 1), (3, 1)] ```  ### Log output  ```shell [(1, 10), (1, 11), (2, None), (3, None)] [(1, 2), (2, 1), (3, 1)] ```  ### Issue description  `UNNEST` of an empty or NULL list returns one row with a NULL, so a count per row counts an item that is not there: ids 2 and 3 above have none. `CROSS JOIN UNNEST(xs) AS u(x)` gives the same rows.  ### Expected behavior  No row for an empty or NULL list, as in Postgres:  ```python [(1, 10), (1, 11)] [(1, 2)] ```  A NULL element of a list still gives a row.  ### Installed versions  <details>  Polars 2.1.0 (latest on PyPI), and main at 1dad4e572d.  </details> 

- **Issue #30977** (2026-11-21): **DataFrame.transpose() inflates Decimal values by the column's scale factor**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl df = pl.DataFrame({"company": ["A"], "value": [104011.54]}).with_columns( pl.col("value").cast(pl.Decimal(scale=6)) ) print(df) transposed = df.drop("company").transpose( include_header=True, header_name="measure" ) print(transposed) ```   ### Log output  ```shell  ```  ### Issue description  It looks like after `transpose()` the raw unscaled integer is reinterpreted with the scale applied again, so the value is 10^scale too big. In the example `104011.540000` (`decimal[38,6]`) becomes `104011540000.000000` (`decimal[38,6]`).  Casting to Float64 before calling `.transpose()` avoids the issue entirely, which points at transpose()'s decimal handling specifically rather than anything upstream.  `Unpivot()` works as a workaround.  ### Expected behavior  In the example `104011.540000` (`decimal[38,6]`) stays the same after `transpose()`.  ### Installed versions  <details>  ``` --------Version info--------- Polars:              2.1.0 Build:               7f902bd3ffd27ff82d14278a09a295ff2f7aed92 Index type:          UInt32 Platform:            Windows-11-10.0.26200-SP0 Python:              3.15.2 (tags/v3.15.2:5e58eaa, Oct 25 2026, 17:27:03) [MSC v.1951 64 bit (AMD64)] Runtime:             rt32 ```  </details> 
  **Post-Mortem & Fix Analysis**:
  > Thanks @kdn36 for the quick fix!

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

### Incident Patch 1: `1695451f` (2026-11-21)
**Commit Message**: fix(rust): Give the polars-cli query thread the stack of the main thread (#30988)

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -3156,6 +3156,7 @@ dependencies = [
  "polars",
  "polars-arrow",
  "polars-ooc",
+ "recursive",
  "signal-hook",
  "sqlparser",
  "unicode-width",
```

**File**: `crates/polars-cli/Cargo.toml` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ polars-arrow = { workspace = true, features = ["io_ipc"] }
 polars-ooc = { workspace = true, features = ["fast_alloc"] }
 
 clap = { workspace = true, features = ["env"] }
+recursive = { workspace = true }
 signal-hook = "0.4"
 sqlparser = { workspace = true }
 unicode-width = { workspace = true }
```

**File**: `crates/polars-cli/src/lib.rs` (modified, +4/-0)
```diff
@@ -28,6 +28,9 @@ pub use error::{ErrorRecord, Location};
 pub use printer::{Event, Format, Printer};
 pub use script::{Script, StatementKind};
 
+/// The stack of the threads that plan and run statements, as a main thread on Linux has.
+pub const STACK_SIZE: usize = 8 * 1024 * 1024;
+
 /// The exit codes of the `polars` command.
 pub mod exit_code {
     pub const OK: u8 = 0;
@@ -237,6 +240,7 @@ where
     std::thread::scope(|scope| {
         let engine = std::thread::Builder::new()
             .name("polars-cli-query".to_string())
+            .stack_size(STACK_SIZE)
             .spawn_scoped(scope, move || {
                 catch_polars_abort(AssertUnwindSafe(|| {
                     plan.collect_with_engine(Engine::Streaming)
```

**File**: `crates/polars-cli/src/main.rs` (modified, +7/-5)
```diff
@@ -5,17 +5,19 @@ use std::sync::atomic::{AtomicBool, Ordering};
 
 use clap::error::ErrorKind;
 use clap::{CommandFactory, Parser};
-use polars_cli::{Args, Input, Printer, Script, exit_code, run};
+use polars_cli::{Args, Input, Printer, STACK_SIZE, Script, exit_code, run};
 
 // The allocator of the Python runtime, so that both perform alike.
 #[global_allocator]
 static ALLOC: polars_ooc::Allocator = polars_ooc::Allocator;
 
-/// The stack of the thread that runs the command: the usual size of a main thread on Linux.
-/// The main thread on Windows has 1 MiB, which a debug build of the engine overflows.
-const STACK_SIZE: usize = 8 * 1024 * 1024;
-
 fn main() -> ExitCode {
+    // Debug frames are large, as in the Python package.
+    #[cfg(debug_assertions)]
+    {
+        recursive::set_minimum_stack_size(1024 * 1024);
+        recursive::set_stack_allocation_size(1024 * 1024 * 16);
+    }
     let command = std::thread::Builder::new()
         .name("polars-cli".to_string())
         .stack_size(STACK_SIZE)
```

---

### Incident Patch 2: `8cb3f575` (2026-11-22)
**Commit Message**: fix: Fix scan_database issues (#30910)

Co-authored-by: ritchie46 <[REDACTED_EMAIL]>

**File**: `crates/polars-database/src/database/backend/adbc/mod.rs` (modified, +204/-2)
```diff
@@ -224,6 +224,22 @@ pub fn connect_options(
             },
         }
     }
+    if dialect == DialectName::Trino
+        && let Some(u) = &mut uri
+    {
+        // (the user's `connect_options` are added after the URI, below)
+        let password = options
+            .iter()
+            .any(|(k, _)| k.as_c_str() == ADBC_OPTION_PASSWORD)
+            || spec
+                .connect_options
+                .iter()
+                .any(|(k, _)| is_trino_credential(k))
+            || u.split_once("://")
+                .and_then(|(_, rest)| secret_userinfo_end(rest).map(|at| rest[..at].contains(':')))
+                .unwrap_or(false);
+        *u = trino_ssl_uri(u, password)?;
+    }
     if let Some(uri) = uri {
         options.insert(0, (ADBC_OPTION_URI.to_owned(), cstring(&uri, "uri")?));
     }
@@ -262,6 +278,92 @@ fn cstring(s: &str, what: &str) -> PolarsResult<CString> {
     CString::new(s).map_err(|_| polars_err!(ComputeError: "ADBC {what} contains a NUL byte"))
 }
 
+/// A Trino connection parameter that carries a credential.
+fn is_trino_credential(key: &str) -> bool {
+    ["password", "accessToken", "extra_credentials"]
+        .iter()
+        .any(|k| key.eq_ignore_ascii_case(k))
+}
+
+/// The URI for the ADBC Trino driver, which connects over HTTPS unless the URI says `SSL=false`
+/// (exactly that, or `False`), where the `trino` Python driver connects over HTTP unless `SSL`
+/// is true or the port is 443: made to behave alike. A password (`password`: one in the
+/// URI's userinfo, its parameters or the connect options) or another credential parameter
+/// (`accessToken`, `extra_credentials`) is only sent over HTTPS (as the
+/// Python driver does), whatever `SSL` says. `SSL` takes the booleans the Python driver takes
+/// (and `disabled`, which the ADBC driver once took for `false`); another value, or the key in
+/// another case, is refused rather than read as HTTPS. Without `SSL`, `http_scheme` decides,
+/// else a TLS option (`SSLVerification`, `SSLTrustedCertificatePath`, ...) keeps HTTPS.
+fn trino_ssl_uri(uri: &str, password: bool) -> PolarsResult<String> {
+    let (base, query) = uri.split_once('?').unwrap_or((uri, ""));
+    let mut ssl = None;
+    let mut kept = vec![];
+    let mut password = password;
+    let mut tls_option = false;
+    let mut http_scheme = None;
+    for kv in query.split('&').filter(|kv| !kv.is_empty()) {
+        let (key, value) = kv.split_once('=').unwrap_or((kv, ""));
+        // (the driver decodes the keys)
+        let key = percent_decode(key);
+        if !key.eq_ignore_ascii_case("ssl") {
+            password |= is_trino_credential(&key);
+            tls_option |= key.get(..3).is_some_and(|p| p.eq_ignore_ascii_case("ssl"));
+            if key.eq_ignore_ascii_case("http_scheme") {
+                let scheme = percent_decode(value);
+                http_scheme = Some(match scheme.trim().to_ascii_lowercase().as_str() {
+                    "https" => true,
+                    "http" => false,
+                    _ => polars_bail!(
+                        InvalidOperation:
+                        "URI parameter http_scheme={scheme:?} for trino: expected http or https"
+                    ),
+                });
+            }
+            kept.push(kv.to_string());
+            continue;
+        }
+        polars_ensure!(
+            key == "SSL",
+            InvalidOperation:
+            "URI parameter {key}={value} for trino: the parameter is named `SSL`"
+        );
+        let decoded = percent_decode(value);
+        ssl = Some(match decoded.trim().to_ascii_lowercase().as_str() {
+            "1" | "true" | "yes" | "on" => true,
+            "0" | "false" | "no" | "off" | "disabled" => false,
+            _ => polars_bail!(
+                InvalidOperation:
+                "URI parameter SSL={decoded:?} for trino: expected a boolean (true or false)"
+            ),
+        });
+    }
+    // (HTTPS is the driver's default)
+    let https = match ssl {
+        Some(ssl) => ssl,
+        None => http_scheme.unwrap_or(tls_option || trino_uri_port(base) == Some(443)),
+    };
+    if !(password || https) {
+        kept.push("SSL=false".to_string());
+    }
+    Ok(if kept.is_empty() {
+        base.to_string()
+    } else {
+        format!("{base}?{}", kept.join("&"))
+    })
+}
+
+/// The port of a `scheme://[userinfo@]host[:port]/…` URI, if it has one.
+fn trino_uri_port(uri: &str) -> Option<u16> {
+    let rest = uri.split_once("://")?.1;
+    let rest = &rest[secret_userinfo_end(rest).map_or(0, |at| at + 1)..];
+    let authority = &rest[..rest.find(['/', '?', '#']).unwrap_or(rest.len())];
+    // (after an IPv6 literal's `]`)
+    let host_end = authority.rfind(']').unwrap_or(0);
+    authority[host_end..]
+        .rsplit_once(':')
+        .and_then(|(_, port)| port.parse().ok())
+}
+
 /// The `uri` database option for a connection target.
 fn adbc_uri(spec: &ConnectionSpec, dialect: DialectName) -> Pol
```

**File**: `crates/polars-database/src/database/backend/mod.rs` (modified, +212/-0)
```diff
@@ -164,6 +164,12 @@ pub trait DatabaseSession: Send {
     fn time_with_zone_columns(&self) -> Vec<String> {
         vec![]
     }
+
+    /// A SQL Server session's `SET TEXTSIZE`, where it cuts long values (see
+    /// [`mssql_session_limits`]).
+    fn text_size_limit(&self) -> Option<i64> {
+        None
+    }
 }
 
 /// The batches of a query's result as one frame.
@@ -328,9 +334,135 @@ pub fn open_session(
             }
         }
     }
+    if dialect == DialectName::Mssql && backend.choice().kind.has_sessions() {
+        session = mssql_session_limits(session, spec.opened_by_plugin())?;
+    }
     Ok(session)
 }
 
+/// `SET TEXTSIZE` at which nothing is cut (as `-1` is, which ODBC drivers set).
+const MSSQL_MAX_TEXTSIZE: i64 = i32::MAX as i64;
+
+/// Sets what a SQL Server session the plugin opened reads, or reads what a user's session reads.
+/// `SET ROWCOUNT n` stops every `SELECT` after `n` rows (the read's, and the catalog's own
+/// lookups), and `SET TEXTSIZE n` cuts every `(n)varchar(max)`, `varbinary(max)`, `text`,
+/// `ntext`, `image` or `xml` value after `n` bytes (also one converted to `NVARCHAR(MAX)`): both
+/// without a sign. A session the plugin opened (a URI, an ODBC string) is its own: both are set
+/// to read everything (a FreeTDS `text size` could apply otherwise). A user's session (a live
+/// connection, a factory's or a pool's, whose connect hook may set either) is left as found:
+/// its settings are read once (`DBCC USEROPTIONS`), a row count refuses it, and a text size
+/// stays on the session ([`DatabaseSession::text_size_limit`]), for the reader to refuse a read
+/// whose columns it may cut.
+fn mssql_session_limits(
+    mut session: Box<dyn DatabaseSession>,
+    ours: bool,
+) -> PolarsResult<Box<dyn DatabaseSession>> {
+    if ours {
+        let sql = format!("SET ROWCOUNT 0; SET TEXTSIZE {MSSQL_MAX_TEXTSIZE}");
+        session.execute_update(&sql).map_err(|e| {
+            e.context(format!("session setup '{sql}' failed; the scan relies on it").into())
+        })?;
+        return Ok(session);
+    }
+    let (rowcount, text_size) = mssql_user_options(session.as_mut());
+    if let Some(n) = rowcount.filter(|n| *n != 0) {
+        polars_bail!(
+            InvalidOperation:
+            "this SQL Server session has SET ROWCOUNT {n} in effect: every query would stop \
+            after {n} rows, and the scan would read incomplete data. Run SET ROWCOUNT 0 on the \
+            connection, or remove it from the connection's setup"
+        );
+    }
+    Ok(match text_size {
+        Some(n) if (0..MSSQL_MAX_TEXTSIZE).contains(&n) => Box::new(TextSizeLimited {
+            inner: session,
+            limit: n,
+        }),
+        _ => session,
+    })
+}
+
+/// A session's `SET ROWCOUNT` (0 when it isn't listed) and `SET TEXTSIZE`, from `DBCC
+/// USEROPTIONS` (which every user may run, and a row count doesn't cut); `None` where they
+/// can't be read. Where `DBCC` fails, the text size is read from `@@TEXTSIZE`, and a row count
+/// under 10,000 is found by a query of 10,000 rows.
+fn mssql_user_options(session: &mut dyn DatabaseSession) -> (Option<i64>, Option<i64>) {
+    use super::catalog::cell_str;
+    let number = |s: Option<String>| s.and_then(|s| s.trim().parse::<i64>().ok());
+    match session.catalog_query("DBCC USEROPTIONS") {
+        Ok(df) if df.width() >= 2 => {
+            let value = |name: &str| {
+                (0..df.height())
+                    .find(|&row| {
+                        cell_str(&df, 0, row).is_some_and(|k| k.trim().eq_ignore_ascii_case(name))
+                    })
+                    .map(|row| number(cell_str(&df, 1, row)))
+            };
+            (
+                Some(value("rowcount").map_or(0, |n| n.unwrap_or(-1))),
+                value("textsize").flatten(),
+            )
+        },
+        _ => {
+            let text_size = session
+                .catalog_query("SELECT @@TEXTSIZE AS textsize")
+                .ok()
+                .and_then(|df| number(cell_str(&df, 0, 0)));
+            let digits = "(VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10))";
+            let probe = format!(
+                "SELECT 1 AS x FROM {digits} AS a(x), {digits} AS b(x), {digits} AS c(x), \
+                {digits} AS d(x)"
+            );
+            let rowcount = session
+                .catalog_query(&probe)
+                .ok()
+                .map(|df| df.height())
+                .map(|n| if n < 10_000 { n as i64 } else { 0 });
+            (rowcount, text_size)
+        },
+    }
+}
+
+/// A user's SQL Server session under `SET TEXTSIZE` ([`mssql_session_limits`]).
+struct TextSizeLimited {
+    inner: Box<dyn DatabaseSession>,
+    limit: i64,
+}
+
+impl DatabaseSession for TextSizeLimited {
+    fn execute(&mut self, sql: &str, batch_size: Option<usize>) -> PolarsResult<BatchIter> {
+        self.inner.execute(sql, batch_size)
+    }
+
+    fn execute_update(&mut self, s
```

**File**: `crates/polars-database/src/database/catalog.rs` (modified, +149/-14)
```diff
@@ -530,6 +530,82 @@ fn databricks_collations(info: &mut CatalogInfo) {
         .collect();
 }
 
+/// The static types (`typeof`) of a Trino query's output columns by position, for one that
+/// can't be wrapped (it names two columns alike): an alias list renames them, and the query
+/// itself never runs. `None` if the lookup fails.
+pub fn trino_positional_types(
+    session: &mut dyn DatabaseSession,
+    query: &str,
+    columns: usize,
+) -> Option<Vec<String>> {
+    if columns == 0 {
+        return None;
+    }
+    let sql = format!(
+        "SELECT {} FROM (SELECT 1) pl_d LEFT JOIN ({}) pl_q({}) ON false",
+        (0..columns)
+            .map(|i| format!("typeof(pl_q.\"c{i}\") AS t{i}"))
+            .collect::<Vec<_>>()
+            .join(", "),
+        super::planner::wrappable(query),
+        (0..columns)
+            .map(|i| format!("\"c{i}\""))
+            .collect::<Vec<_>>()
+            .join(", ")
+    );
+    let df = match session.query(&sql) {
+        Ok(df) => df,
+        Err(e) => {
+            if polars_core::config::verbose() {
+                eprintln!("[scan_database]: lookup of the query's types failed: {e}");
+            }
+            return None;
+        },
+    };
+    (0..columns).map(|i| cell_str(&df, i, 0)).collect()
+}
+
+/// The output columns of a SQL Server query, if one has no name (`SELECT count(*)`: a derived
+/// table over it is an error, and drivers name it `''`, `column_1` or nothing): every column
+/// as the server describes it, an unnamed one `column_<position from 0>` (the name
+/// ConnectorX gives it), made unique. `None` if all are named, or the query can't be described
+/// (its columns are then read as the server names them).
+pub fn mssql_unnamed_columns(
+    session: &mut dyn DatabaseSession,
+    sql: &str,
+) -> Option<Vec<PlSmallStr>> {
+    let df = session
+        .catalog_query(&format!(
+            "SELECT name FROM sys.dm_exec_describe_first_result_set(N{}, NULL, 0) \
+            WHERE is_hidden = 0 ORDER BY column_ordinal",
+            DialectName::Mssql.quote_str(sql)
+        ))
+        .ok()?;
+    let names: Vec<Option<String>> = (0..df.height())
+        .map(|i| cell_str(&df, 0, i).filter(|n| !n.is_empty()))
+        .collect();
+    if names.iter().all(Option::is_some) {
+        return None;
+    }
+    let mut out: Vec<String> = vec![];
+    for (i, name) in names.iter().enumerate() {
+        out.push(name.clone().unwrap_or_else(|| format!("column_{i}")));
+    }
+    // a generated name that is a real one too gets a `_`
+    for i in 0..out.len() {
+        if names[i].is_none() {
+            while out
+                .iter()
+                .enumerate()
+                .any(|(j, o)| j != i && o.eq_ignore_ascii_case(&out[i]))
+            {
+                out[i].push('_');
+            }
+        }
+    }
+    Some(out.into_iter().map(Into::into).collect())
+}
+
 /// Looks up the result types of a query source, which decide how the database compares its
 /// columns (they don't change how the columns are read). `from` is the wrapped query
 /// (`(...) pl_q`), `columns` its output columns. Dialects without a lookup, or a failing one,
@@ -1057,7 +1133,7 @@ impl CatalogQueries {
                         "SELECT c.name, CASE WHEN b.name IN ('decimal', 'numeric') \
                         THEN CONCAT(b.name, '(', c.precision, ',', c.scale, ')') \
                         WHEN b.name IN ('datetime2', 'time', 'datetimeoffset') \
-                        THEN CONCAT(b.name, '(', c.scale, ')') ELSE b.name END \
+                        THEN CONCAT(b.name, '(', c.scale, ')') ELSE b.name END AS type_name \
                         FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id \
                         CROSS APPLY (SELECT CASE WHEN t.is_user_defined = 1 \
                         AND t.is_assembly_type = 0 AND t.is_table_type = 0 \
@@ -1067,7 +1143,8 @@ impl CatalogQueries {
                     compare_types: None,
                     declared_sql: None,
                     stats: Some(format!(
-                        "SELECT SUM(row_count), SUM(used_page_count) * 8192 \
+                        "SELECT SUM(row_count) AS row_count, \
+                        SUM(used_page_count) * 8192 AS size_bytes \
                         FROM sys.dm_db_partition_stats WHERE object_id = {object} AND index_id IN (0, 1)"
                     )),
                 }
@@ -1668,10 +1745,12 @@ pub fn view_definition(
             };
         },
         DialectName::Mssql => format!(
-            "SELECT CASE WHEN o.type = 'V' THEN 1 ELSE 0 END, \
-            CASE WHEN o.type = 'V' THEN OBJECT_DEFINITION(o.object_id) END, \
+            "SELECT CASE WHEN o.type = 'V' THEN 1 ELSE 0 END AS is_view, \
+            CASE WHEN o.type = 'V' THEN OBJECT_DEFINITION(o.object_id) END AS definition, \
             CASE WHEN o.type = 'SN' THEN (SELECT s.base_object_name FROM sys.synonyms s \
-            WHERE s.obj
```

**File**: `crates/polars-database/src/database/config.rs` (modified, +14/-0)
```diff
@@ -111,6 +111,11 @@ pub struct DatabaseScanConfig {
     /// float comparisons are pushed only then.
     #[serde(default)]
     pub sqlite_floats_exact: bool,
+    /// A SQL Server query with a column of no name: the derived table the read wraps it in lists
+    /// the schema's names in its alias (`(q) AS "_pl"("a", "column_1")`), as SQL Server refuses
+    /// a derived table with an unnamed column.
+    #[serde(default)]
+    pub unnamed_columns: bool,
     /// Columns the planner found unreadable right, with why: raised when one is read.
     #[serde(default)]
     pub refused_columns: Vec<(PlSmallStr, PlSmallStr)>,
@@ -134,6 +139,15 @@ pub(crate) fn session_setup_runs(connection: &ConnectionSpec, kind: &BackendKind
 pub type BoundsCache = Arc<Mutex<PlHashMap<String, (Option<f64>, Option<f64>)>>>;
 
 impl DatabaseScanConfig {
+    /// The columns the alias of a derived table over the query lists (`unnamed_columns`).
+    pub fn derived_columns(&self) -> Vec<PlSmallStr> {
+        if self.unnamed_columns {
+            self.schema.iter_names().cloned().collect()
+        } else {
+            vec![]
+        }
+    }
+
     pub fn column(&self, name: &str) -> Option<&ColumnMeta> {
         self.columns.iter().find(|c| c.name == name)
     }
```

**File**: `crates/polars-database/src/database/dialect.rs` (modified, +221/-2)
```diff
@@ -65,6 +65,125 @@ pub(crate) fn trino_wide_temporal(t: &str) -> Option<TrinoWide> {
     )
 }
 
+/// The `name` and the type of a `row(..)` field (`x timestamp(3)`, `"a b" integer`, `"a""b"
+/// integer`, or an unnamed `timestamp(3)`).
+fn split_row_field(field: &str) -> (&str, &str) {
+    let end = if field.starts_with('"') {
+        // past the closing quote, a doubled one being part of the name
+        let mut i = 1;
+        loop {
+            match field[i..].find('"') {
+                Some(j) if field[i + j + 1..].starts_with('"') => i += j + 2,
+                Some(j) => break i + j + 1,
+                None => break field.len(),
+            }
+        }
+    } else {
+        field.find([' ', '(']).unwrap_or(field.len())
+    };
+    // an unnamed field is a type (`timestamp(3) ..`, `integer`) on its own
+    if field[end..].starts_with('(') || end == field.len() {
+        ("", field)
+    } else {
+        (&field[..end], field[end..].trim_start())
+    }
+}
+
+/// `expr` of Trino type `ty` with every `timestamp(p) with time zone` it holds as the same
+/// instant in UTC, and the resulting type. `None` if it holds none. A value of that type holds
+/// its zone's name: a named zone's repeated hour reads an hour off in the drivers, and the same
+/// instant in UTC doesn't.
+fn trino_utc_inside(ty: &str, expr: &str, depth: usize) -> Option<(String, String)> {
+    let ty = ty.trim();
+    let lower = ty.to_ascii_lowercase();
+    let inner = |prefix: &str| {
+        lower
+            .starts_with(prefix)
+            .then(|| ty.strip_suffix(')'))
+            .flatten()
+            .map(|t| &t[prefix.len()..])
+    };
+    if lower.starts_with("timestamp(") && lower.ends_with("with time zone") {
+        return Some((format!("{expr} AT TIME ZONE 'UTC'"), ty.to_string()));
+    }
+    if let Some(element) = inner("array(") {
+        let var = format!("pl_x{depth}");
+        let (sql, t) = trino_utc_inside(element, &var, depth + 1)?;
+        return Some((
+            format!("transform({expr}, {var} -> {sql})"),
+            format!("array({t})"),
+        ));
+    }
+    if let Some(kv) = inner("map(") {
+        let [key, value] = super::planner::split_top_level(kv)[..] else {
+            return None;
+        };
+        let (k, v) = (format!("pl_k{depth}"), format!("pl_v{depth}"));
+        let new_value = trino_utc_inside(value, &v, depth + 1);
+        let new_key = trino_utc_inside(key, &k, depth + 1);
+        if new_value.is_none() && new_key.is_none() {
+            return None;
+        }
+        let (mut sql, mut key_type, mut value_type) =
+            (expr.to_string(), key.to_string(), value.to_string());
+        if let Some((e, t)) = new_value {
+            sql = format!("transform_values({sql}, ({k}, {v}) -> {e})");
+            value_type = t;
+        }
+        if let Some((e, t)) = new_key {
+            sql = format!("transform_keys({sql}, ({k}, {v}) -> {e})");
+            key_type = t;
+        }
+        return Some((sql, format!("map({key_type}, {value_type})")));
+    }
+    if let Some(fields) = inner("row(") {
+        let mut found = false;
+        let (mut values, mut types) = (vec![], vec![]);
+        for (i, field) in super::planner::split_top_level(fields)
+            .into_iter()
+            .enumerate()
+        {
+            let (name, field_type) = split_row_field(field);
+            let item = format!("({expr})[{}]", i + 1);
+            let (sql, t) = match trino_utc_inside(field_type, &item, depth + 1) {
+                Some(done) => {
+                    found = true;
+                    done
+                },
+                None => (item, field_type.to_string()),
+            };
+            values.push(sql);
+            types.push(if name.is_empty() {
+                t
+            } else {
+                format!("{name} {t}")
+            });
+        }
+        if !found {
+            return None;
+        }
+        let new_type = format!("row({})", types.join(", "));
+        return Some((
+            format!(
+                "CASE WHEN {expr} IS NULL THEN NULL ELSE CAST(ROW({}) AS {new_type}) END",
+                values.join(", ")
+            ),
+            new_type,
+        ));
+    }
+    None
+}
+
+/// A Trino array, map or row (`db_type`) of `column` with the `timestamp(p) with time zone`
+/// values in it as UTC instants, or `None` if it holds none (see [`trino_utc_inside`]).
+pub(crate) fn trino_nested_utc(db_type: &str, column: &str) -> Option<String> {
+    let lower = db_type.trim().to_ascii_lowercase();
+    if !(lower.starts_with("array(") || lower.starts_with("map(") || lower.starts_with("row(")) {
+        return None;
+    }
+    trino_utc_inside(db_type, column, 0).map(|(sql, _)| sql)
+}
+
 /// How string comparisons behave in the database, relative to Polars' byte-wise comparison.
 #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
 pub struct StringSemantics {
@@ -27
```

**File**: `crates/polars-database/src/database/planner.rs` (modified, +340/-23)
```diff
@@ -37,17 +37,41 @@ fn verbose() -> bool {
 }
 
 /// The `FROM` target of a relation, for the fixed discovery and catalog SQL.
-fn quoted_relation(dialect: DialectName, relation: &DatabaseRelation) -> String {
+fn quoted_relation(
+    dialect: DialectName,
+    relation: &DatabaseRelation,
+    columns: &[PlSmallStr],
+) -> String {
     match relation {
         DatabaseRelation::Table { parts, .. } => parts
             .iter()
             .map(|p| dialect.quote_ident(p))
             .collect::<Vec<_>>()
             .join("."),
-        DatabaseRelation::Query { sql } => format!("({}) pl_q", wrappable(sql)),
+        DatabaseRelation::Query { sql } => {
+            format!(
+                "({}) pl_q{}",
+                wrappable(sql),
+                derived_column_list(dialect, columns)
+            )
+        },
     }
 }
 
+/// The alias's column list (`("a", "b")`) of a derived table over a SQL Server query with a
+/// column of no name (see [`DatabaseScanConfig::unnamed_columns`]); empty without the columns.
+fn derived_column_list(dialect: DialectName, columns: &[PlSmallStr]) -> String {
+    if columns.is_empty() {
+        return String::new();
+    }
+    let names = columns
+        .iter()
+        .map(|c| dialect.quote_ident(c))
+        .collect::<Vec<_>>()
+        .join(", ");
+    format!("({names})")
+}
+
 fn strip_statement_end(sql: &str) -> &str {
     sql.trim().trim_end_matches(';').trim_end()
 }
@@ -207,6 +231,26 @@ fn first_keyword(sql: &str) -> &str {
     &s[..end]
 }
 
+/// The output column names given more than once, as the database tells names apart: Trino
+/// folds every name to lower case (`SELECT 1 AS T, 2 AS t` names two columns `t`), and names
+/// each column of no name apart (`_col0`, `_col1`).
+fn duplicated_output_names(dialect: DialectName, cols: &[PlSmallStr]) -> Vec<PlSmallStr> {
+    let trino = dialect == DialectName::Trino;
+    let mut seen = PlHashSet::with_capacity(cols.len());
+    let mut duplicated = vec![];
+    for c in cols.iter().filter(|c| !(trino && c.is_empty())) {
+        let key: PlSmallStr = if trino {
+            c.to_lowercase().into()
+        } else {
+            c.clone()
+        };
+        if !seen.insert(key.clone()) && !duplicated.contains(&key) {
+            duplicated.push(key);
+        }
+    }
+    duplicated
+}
+
 /// Why a user query can't be wrapped as a derived table, if it can't.
 fn wrap_blocker(facts: &QueryFacts, dialect: DialectName) -> Option<&'static str> {
     if !facts.parses {
@@ -221,15 +265,112 @@ fn wrap_blocker(facts: &QueryFacts, dialect: DialectName) -> Option<&'static str
     if dialect == DialectName::Mssql && facts.top_level_order_by_without_limit {
         return Some("SQL Server does not allow ORDER BY without TOP inside a derived table");
     }
-    if let Some(cols) = &facts.output_columns {
-        let mut seen = PlHashSet::with_capacity(cols.len());
-        if !cols.iter().all(|c| seen.insert(c)) {
-            return Some("the query has duplicate output column names");
-        }
+    if let Some(cols) = &facts.output_columns
+        && !duplicated_output_names(dialect, cols).is_empty()
+    {
+        return Some("the query has duplicate output column names");
     }
     None
 }
 
+/// Trino names an output column of no name `_col<position>` (`SELECT count(*)`), and a query
+/// wrapping it can't refer to that name: such a query is refused.
+fn refuse_trino_unnamed(dialect: DialectName, names: &[PlSmallStr]) -> PolarsResult<()> {
+    let unnamed = dialect == DialectName::Trino
+        && names.iter().any(|n| {
+            n.strip_prefix("_col")
+                .is_some_and(|i| !i.is_empty() && i.bytes().all(|b| b.is_ascii_digit()))
+        });
+    polars_ensure!(
+        !unnamed,
+        InvalidOperation:
+        "the query has a column of no name, which Trino doesn't let a wrapping query refer to; \
+        alias each of its expressions (`SELECT count(*) AS n`)"
+    );
+    Ok(())
+}
+
+/// [`refuse_unwrappable_conversions`] for a scan planned under `schema=` (no I/O then): run
+/// on the first session opened.
+pub fn check_unwrappable_conversions(
+    session: &mut dyn DatabaseSession,
+    config: &DatabaseScanConfig,
+) -> PolarsResult<()> {
+    let DatabaseRelation::Query { sql } = &config.options.relation else {
+        return Ok(());
+    };
+    if !config.user_schema || config.dialect != DialectName::Trino {
+        return Ok(());
+    }
+    let Some(columns) = sql_renderer()
+        .and_then(|r| r.inspect_query(sql, config.dialect))
+        .ok()
+        .and_then(|f| f.output_columns)
+    else {
+        return Ok(());
+    };
+    refuse_unwrappable_conversions(
+        session,
+        &config.options,
+        config.dialect,
+        &columns,
+        &config.backend.kind,
+        config.session_setup_runs(),
+    )
+}
+
+/// Refuses a query that names two output columns alike and has a column read through a conversion.
+pub(crate) fn re
```

**File**: `crates/polars-database/src/database/schema.rs` (modified, +154/-6)
```diff
@@ -12,12 +12,7 @@ pub fn normalize_dtype(dtype: &DataType) -> DataType {
     match dtype {
         DataType::Datetime(tu, Some(tz)) if tz.as_str().is_empty() => DataType::Datetime(*tu, None),
         // The session time zone is UTC; drivers spell it differently.
-        DataType::Datetime(tu, Some(tz))
-            if matches!(
-                tz.as_str(),
-                "Etc/UTC" | "Etc/UCT" | "UCT" | "Universal" | "Etc/Universal" | "Zulu" | "Etc/Zulu"
-            ) =>
-        {
+        DataType::Datetime(tu, Some(tz)) if is_utc_alias(tz.as_str()) => {
             DataType::Datetime(*tu, Some(TimeZone::UTC))
         },
         // Opaque driver types are read as their storage, except ADBC Postgres `NUMERIC`
@@ -51,6 +46,25 @@ pub fn normalize_dtype(dtype: &DataType) -> DataType {
     }
 }
 
+/// A spelling of UTC other than `UTC` itself, which Polars names zones by.
+fn is_utc_alias(tz: &str) -> bool {
+    matches!(
+        tz,
+        "Etc/UTC" | "Etc/UCT" | "UCT" | "Universal" | "Etc/Universal" | "Zulu" | "Etc/Zulu"
+    )
+}
+
+/// Whether a dtype holds a time zone that [`normalize_dtype`] renames (a spelling of UTC).
+fn has_utc_alias(dtype: &DataType) -> bool {
+    match dtype {
+        DataType::Datetime(_, Some(tz)) => is_utc_alias(tz.as_str()),
+        DataType::List(inner) | DataType::Array(inner, _) => has_utc_alias(inner),
+        DataType::Map(key, value) => has_utc_alias(key) || has_utc_alias(value),
+        DataType::Struct(fields) => fields.iter().any(|f| has_utc_alias(f.dtype())),
+        _ => false,
+    }
+}
+
 /// The dtype of a `NUMERIC` without precision, whose values each have their own scale
 /// (read as exact text). A value with more digits than the scale is an error; use
 /// `schema_overrides` for another precision.
@@ -128,6 +142,23 @@ pub fn declared_dtype(dialect: DialectName, db_type: &str) -> Option<DataType> {
             Some(TimeZone::UTC),
         ));
     }
+    // An array of them, also nested: read as UTC instants too (the values are converted,
+    // see `column_conversion`; the driver would plan the zone of the first value it reads).
+    // Wider ones keep the unit the driver reads.
+    if dialect == DialectName::Trino
+        && t.starts_with("array(")
+        && t.ends_with(')')
+        && t.contains("timestamp(")
+        && t.match_indices("timestamp(")
+            .all(|(i, _)| crate::database::dialect::trino_wide_temporal(&t[i..]).is_none())
+    {
+        let inner = &t["array(".len()..t.len() - 1];
+        if let Some(element @ (DataType::Datetime(_, Some(_)) | DataType::List(_))) =
+            declared_dtype(dialect, inner)
+        {
+            return Some(DataType::List(Box::new(element)));
+        }
+    }
     // Postgres `timestamptz` is an instant, read as UTC (a live connection's session zone
     // may be another: see `column_conversion`).
     if matches!(dialect, DialectName::Postgresql | DialectName::Redshift)
@@ -338,6 +369,14 @@ pub fn cast_columns(
         } else {
             col
         };
+        let relabelled;
+        let col = match relabel_utc_zones(col, dtype)? {
+            Some(c) => {
+                relabelled = c;
+                &relabelled
+            },
+            None => col,
+        };
         let converted;
         let col = match duration_to_time(col, dtype)? {
             Some(c) => {
@@ -528,6 +567,46 @@ fn value_kind_changed(from: &DataType, to: &DataType, converted: bool) -> bool {
         })
 }
 
+/// A column with a map (also in lists, arrays and structs) whose time zone names are spellings of UTC
+/// (`Etc/UTC`) where the plan has `UTC`, as the plan. A Map key can't be cast between zone
+/// names (the cast refuses it), so the map is rebuilt from its entries cast on their own.
+fn relabel_utc_zones(col: &Column, to: &DataType) -> PolarsResult<Option<Column>> {
+    if !has_utc_alias(col.dtype()) || normalize_dtype(col.dtype()) != *to {
+        return Ok(None);
+    }
+    Ok(relabel_map_zones(col.as_materialized_series())?.map(Series::into_column))
+}
+
+fn relabel_map_zones(s: &Series) -> PolarsResult<Option<Series>> {
+    let nested =
+        |inner: Series| -> PolarsResult<Series> { Ok(relabel_map_zones(&inner)?.unwrap_or(inner)) };
+    Ok(match s.dtype() {
+        DataType::Map(_, _) => {
+            let normal = normalize_dtype(s.dtype());
+            let storage_dtype = normal.map_storage_dtype().ok_or_else(|| {
+                polars_err!(ComputeError: "can't take the storage dtype of the map type {normal}")
+            })?;
+            // maps inside the entries first: their keys can't be cast either
+            let storage = nested(s.map()?.storage().clone())?
+                .cast_with_options(&storage_dtype, CastOptions::Strict)?;
+            let map = MapChunked::try_from_storage(normal, storage.with_name(s.name().clone()))?;
+            Some(map.into_series())
+        },
+        DataType::List(inner) if inner.contains_map() => {
+   
```

**File**: `crates/polars-database/src/database/sql.rs` (modified, +8/-2)
```diff
@@ -298,8 +298,14 @@ pub enum SqlSelectItem {
 pub enum SqlFrom {
     /// `[catalog.][schema.]name`, unquoted parts.
     Table(Vec<PlSmallStr>),
-    /// A user query, wrapped as a derived table.
-    Subquery(String),
+    /// A user query, wrapped as a derived table. `columns`, if any, are its output columns, named
+    /// in the alias (`(q) AS "_pl"("a", "b")`): a SQL Server query with a column of no name,
+    /// which it refuses in a derived table.
+    Subquery {
+        sql: String,
+        #[serde(default)]
+        columns: Vec<PlSmallStr>,
+    },
 }
 
 #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
```

---

### Incident Patch 3: `66810e33` (2026-11-22)
**Commit Message**: fix: Export Map columns with more than i32::MAX entries as several Arrow arrays (#30865)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: ritchie46 <[REDACTED_EMAIL]>

**File**: `crates/polars-cli/src/printer.rs` (modified, +2/-2)
```diff
@@ -234,8 +234,8 @@ impl<O: Write, E: Write> Printer<O, E> {
                         table.vstack_mut(&rows)?;
                     },
                     ResultWriter::ArrowStream(writer) => {
-                        for batch in rows.iter_chunks(ARROW_COMPAT, true) {
-                            writer.write(&batch, None)?;
+                        for batch in rows.try_iter_chunks(ARROW_COMPAT, true) {
+                            writer.write(&batch?, None)?;
                         }
                     },
                 }
```

**File**: `crates/polars-core/src/frame/chunks.rs` (modified, +33/-19)
```diff
@@ -1,3 +1,5 @@
+use std::ops::Range;
+
 use polars_arrow::record_batch::RecordBatch;
 use rayon::prelude::*;
 
@@ -41,26 +43,31 @@ impl DataFrame {
         // Follows the first column that has chunks (a series, or a dictionary column's codes);
         // scalar columns have none and are sliced.
         let chunk_lengths: Vec<usize> = self.first_col_chunk_lengths().collect();
-        let mut prev_height = 0;
-        (0..chunk_lengths.len()).map(move |i| unsafe {
-            let chunk_size = chunk_lengths[i];
-            let columns = self
-                .columns()
-                .iter()
-                .map(|col| match col {
-                    Column::Series(s) => Column::from(s.select_chunk(i)),
-                    Column::Scalar(_) | Column::Dictionary(_) => {
-                        col.slice((prev_height, chunk_size))
-                    },
-                })
-                .collect::<Vec<_>>();
-
-            prev_height += chunk_size;
-
-            DataFrame::new_unchecked(chunk_size, columns)
+        let mut offset = 0;
+        (0..chunk_lengths.len()).map(move |i| {
+            let rows = offset..offset + chunk_lengths[i];
+            offset += chunk_lengths[i];
+            self.chunk_frame(i, rows)
         })
     }
 
+    /// Chunk `chunk_idx` of this aligned frame, which holds `rows`, as a frame of single chunks.
+    pub(crate) fn chunk_frame(&self, chunk_idx: usize, rows: Range<usize>) -> DataFrame {
+        let columns = self
+            .columns()
+            .iter()
+            .map(|col| match col {
+                // `Column::from` would turn a one-row chunk into a Scalar, which reads the row.
+                Column::Series(s) => Column::Series(s.select_chunk(chunk_idx).into()),
+                // These are sliced by offset.
+                Column::Scalar(_) | Column::Dictionary(_) => col.slice(rows.clone()),
+            })
+            .collect();
+
+        // SAFETY: each column holds the chunk's rows.
+        unsafe { DataFrame::new_unchecked(rows.len(), columns) }
+    }
+
     pub fn split_chunks_by_n(self, n: usize, parallel: bool) -> Vec<DataFrame> {
         let split = _split_offsets(self.height(), n);
 
@@ -74,15 +81,19 @@ impl DataFrame {
         }
     }
 
-    /// Convert the columns of this [DataFrame] to arrow arrays.
+    /// Convert the columns of this [DataFrame] to arrow arrays, one per column.
+    ///
+    /// Use [`DataFrame::try_iter_chunks`] for Map columns that may need several arrays.
     pub fn rechunk_to_arrow(&self, compat_level: CompatLevel) -> Vec<ArrayRef> {
         self.columns()
             .iter()
             .map(|c| c.clone().rechunk_to_arrow(compat_level))
             .collect()
     }
 
-    /// Convert the columns of this [DataFrame] to arrow arrays.
+    /// Convert the columns of this [DataFrame] to arrow arrays, one per column.
+    ///
+    /// Use [`DataFrame::try_iter_chunks`] for Map columns that may need several arrays.
     pub fn rechunk_into_arrow(self, compat_level: CompatLevel) -> Vec<ArrayRef> {
         self.into_columns()
             .into_iter()
@@ -95,6 +106,9 @@ impl DataFrame {
 /// maximum number of rows per chunk to ensure reasonable memory efficiency when
 /// reading the resulting file, and a minimum size per chunk to ensure
 /// reasonable performance when writing.
+///
+/// [`DataFrame::iter_chunks`] can still cut a chunk into several record batches, where its
+/// arrow MAP arrays would overflow their `i32` offsets.
 pub fn chunk_df_for_writing(
     df: &mut DataFrame,
     row_group_size: usize,
```

**File**: `crates/polars-core/src/frame/mod.rs` (modified, +302/-75)
```diff
@@ -55,6 +55,7 @@ use crate::hashing::_df_rows_to_hashes_threaded_vertical;
 use crate::prelude::sort::arg_sort;
 use crate::runtime::RAYON;
 use crate::series::IsSorted;
+use crate::series::arrow_export::{arrow_export_cut, contains_arrow_map, map_spans_fit};
 
 #[derive(Copy, Clone, Debug, PartialEq, Eq, Default, Hash, IntoStaticStr)]
 #[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
@@ -2157,48 +2158,55 @@ impl DataFrame {
 
     /// Iterator over the rows in this [`DataFrame`] as Arrow RecordBatches.
     ///
-    /// # Panics
+    /// A chunk is split into several batches where its arrow MAP arrays would overflow
+    /// their `i32` offsets.
     ///
-    /// Panics if the [`DataFrame`] that is passed is not rechunked.
+    /// The columns' chunks must be aligned ([`DataFrame::should_rechunk`] is false); only debug
+    /// builds check this. Aligning is left to the caller, which can reuse the aligned frame.
     ///
-    /// This responsibility is left to the caller as we don't want to take mutable references here,
-    /// but we also don't want to rechunk here, as this operation is costly and would benefit the caller
-    /// as well.
+    /// # Panics
+    ///
+    /// Panics where [`DataFrame::try_iter_chunks`] yields an error.
     pub fn iter_chunks(
         &self,
         compat_level: CompatLevel,
         parallel: bool,
     ) -> impl Iterator<Item = RecordBatch> + '_ {
-        debug_assert!(!self.should_rechunk(), "expected equal chunks");
-
-        if self.width() == 0 {
-            return RecordBatchIterWrap::new_zero_width(self.height());
-        }
+        self.try_iter_chunks(compat_level, parallel)
+            .map(|batch| batch.unwrap())
+    }
 
+    /// Like [`DataFrame::iter_chunks`], but yields export errors, such as a row with more map
+    /// entries than the `i32` offsets of an arrow MAP can hold.
+    ///
+    /// The columns' chunks must be aligned, as for [`DataFrame::iter_chunks`].
+    pub fn try_iter_chunks(
+        &self,
+        compat_level: CompatLevel,
+        parallel: bool,
+    ) -> impl Iterator<Item = PolarsResult<RecordBatch>> + Send + '_ {
         // If any of the columns is binview and we don't convert `compat_level` we allow parallelism
         // as we must allocate arrow strings/binaries.
-        let must_convert = compat_level.0 == 0;
         let parallel = parallel
-            && must_convert
-            && self.width() > 1
+            && compat_level.0 == 0
             && self
                 .columns()
                 .iter()
                 .any(|s| matches!(s.dtype(), DataType::String | DataType::Binary));
+        RecordBatchIterWrap::new(Cow::Borrowed(self), compat_level, parallel)
+    }
 
-        RecordBatchIterWrap::Batches(RecordBatchIter {
-            df: self,
-            schema: Arc::new(
-                self.columns()
-                    .iter()
-                    .map(|c| c.field().to_arrow(compat_level))
-                    .collect(),
-            ),
-            cursor: ChunkCursor::new(self),
-            compat_level,
-            parallel,
-            offset: 0,
-        })
+    /// Like [`DataFrame::try_iter_chunks`], but the iterator owns the frame, for consumers that
+    /// outlive it, such as an arrow C stream.
+    ///
+    /// With `parallel`, the columns of each batch are exported on the thread pool, whatever their
+    /// dtypes.
+    pub fn into_try_iter_chunks(
+        self,
+        compat_level: CompatLevel,
+        parallel: bool,
+    ) -> impl Iterator<Item = PolarsResult<RecordBatch>> + Send + 'static {
+        RecordBatchIterWrap::new(Cow::Owned(self), compat_level, parallel)
     }
 
     /// Iterator over the rows in this [`DataFrame`] as Arrow RecordBatches as physical values.
@@ -2213,21 +2221,22 @@ impl DataFrame {
     pub fn iter_chunks_physical(&self) -> impl Iterator<Item = RecordBatch> + '_ {
         debug_assert!(!self.should_rechunk());
 
-        if self.width() == 0 {
-            return RecordBatchIterWrap::new_zero_width(self.height());
-        }
-
-        RecordBatchIterWrap::PhysicalBatches(PhysRecordBatchIter {
-            df: self,
-            schema: Arc::new(
-                self.columns()
-                    .iter()
-                    .map(|c| c.field().to_arrow(CompatLevel::newest()))
-                    .collect(),
-            ),
-            cursor: ChunkCursor::new(self),
-            offset: 0,
-        })
+        let iter = if self.width() == 0 {
+            RecordBatchIterWrap::new_zero_width(self.height())
+        } else {
+            RecordBatchIterWrap::PhysicalBatches(PhysRecordBatchIter {
+                df: self,
+                schema: Arc::new(
+                    self.columns()
+                        .iter()
+                        .map(|c| c.field().to_arrow(CompatLevel::newest()))
+                        .collect(),
+                ),
+                cursor: ChunkCursor::new(self),
+                off
```

**File**: `crates/polars-core/src/serde/df.rs` (modified, +3/-2)
```diff
@@ -68,9 +68,10 @@ impl DataFrame {
 
         ipc_writer.start(&schema.to_arrow(CompatLevel::newest()), None)?;
 
-        for batch in chunk_df_for_writing(self, 512 * 512)?.iter_chunks(CompatLevel::newest(), true)
+        for batch in
+            chunk_df_for_writing(self, 512 * 512)?.try_iter_chunks(CompatLevel::newest(), true)
         {
-            ipc_writer.write(&batch, None)?;
+            ipc_writer.write(&batch?, None)?;
         }
 
         ipc_writer.finish()?;
```

**File**: `crates/polars-core/src/series/arrow_export/mod.rs` (modified, +98/-12)
```diff
@@ -11,13 +11,16 @@ macro_rules! bail_unhandled_arrow_conversion_dtype_pair {
 
 #[cfg(feature = "dtype-categorical")]
 pub mod categorical;
+mod split;
 
 use std::borrow::Cow;
 use std::sync::Arc;
 
+use either::Either;
 use polars_compute::cast::cast_unchecked;
 use polars_compute::rebuild_list::rebuild_list_shallow;
 use polars_error::{PolarsError, PolarsResult, polars_ensure, polars_err};
+pub(crate) use split::{arrow_export_cut, contains_arrow_map, map_spans_fit};
 
 use crate::prelude::{
     Array, ArrayRef, ArrowDataType, ArrowField, BinaryViewArray, CompatLevel, DataType, ListArray,
@@ -51,6 +54,11 @@ fn normalize_map_entries(arr: &ListArray<i64>) -> Option<ListArray<i64>> {
         return Some(compacted);
     }
 
+    trim_list_child(arr)
+}
+
+/// Slice the child of `arr` to the elements its offsets span; `None` if it already is.
+fn trim_list_child(arr: &ListArray<i64>) -> Option<ListArray<i64>> {
     let offsets = arr.offsets();
     let first = *offsets.first() as usize;
     let len = offsets.range() as usize;
@@ -78,7 +86,20 @@ fn ensure_no_nulls(array: &dyn Array) -> PolarsResult<()> {
 impl Series {
     /// Export this Series to an arrow array. The dtype of the returned array will be chosen
     /// according to the provided `compat_level`.
+    ///
+    /// # Panics
+    /// Panics if the chunk cannot be exported, see [`Series::try_to_arrow`].
     pub fn to_arrow(&self, chunk_idx: usize, compat_level: CompatLevel) -> ArrayRef {
+        self.try_to_arrow(chunk_idx, compat_level).unwrap()
+    }
+
+    /// Export this Series to an arrow array, or error if the chunk does not fit the arrow
+    /// type, e.g. a Map chunk with more than `i32::MAX` entries.
+    pub fn try_to_arrow(
+        &self,
+        chunk_idx: usize,
+        compat_level: CompatLevel,
+    ) -> PolarsResult<ArrayRef> {
         self.to_arrow_with_field(
             chunk_idx,
             Cow::Owned(
@@ -87,7 +108,58 @@ impl Series {
             ),
             true,
         )
-        .unwrap()
+    }
+
+    /// Export a chunk of this Series as one or more arrow arrays, split at rows so that each
+    /// arrow MAP array fits in `i32` offsets; the pieces are converted as the iterator reaches them.
+    pub fn try_to_arrow_split(
+        &self,
+        chunk_idx: usize,
+        compat_level: CompatLevel,
+    ) -> impl Iterator<Item = PolarsResult<ArrayRef>> + Send + use<> {
+        if !self.dtype().contains_map() {
+            return Either::Left(std::iter::once(self.try_to_arrow(chunk_idx, compat_level)));
+        }
+        let arrow_dtype = self.dtype().to_arrow(compat_level);
+        let chunk = self.chunks()[chunk_idx].as_ref();
+        if !contains_arrow_map(&arrow_dtype)
+            || map_spans_fit(chunk, &arrow_dtype, 0..chunk.len(), 1)
+        {
+            return Either::Left(std::iter::once(self.try_to_arrow(chunk_idx, compat_level)));
+        }
+
+        let chunk = self.select_chunk(chunk_idx);
+        let mut start = 0;
+        Either::Right(std::iter::from_fn(move || {
+            let arr = chunk.chunks()[0].as_ref();
+            let rows = start..arr.len();
+            if rows.is_empty() {
+                return None;
+            }
+            let end = arrow_export_cut(rows, |r| map_spans_fit(arr, &arrow_dtype, r, 1));
+            let piece = chunk
+                .slice(start..end)
+                .try_piece_to_arrow(&arrow_dtype, compat_level);
+            start = end;
+            Some(piece)
+        }))
+    }
+
+    /// Export this single-chunk Series, a piece cut by [`arrow_export_cut`], as `arrow_dtype`.
+    ///
+    /// A one-row piece can still span more map entries than an arrow MAP holds. Its nulls are
+    /// then pushed down to its maps, which drop the entries of their null rows.
+    pub(crate) fn try_piece_to_arrow(
+        &self,
+        arrow_dtype: &ArrowDataType,
+        compat_level: CompatLevel,
+    ) -> PolarsResult<ArrayRef> {
+        if self.len() == 1 && !map_spans_fit(self.chunks()[0].as_ref(), arrow_dtype, 0..1, 1) {
+            if let Some(s) = self.propagate_nulls() {
+                return s.try_to_arrow(0, compat_level);
+            }
+        }
+        self.try_to_arrow(0, compat_level)
     }
 
     /// Export this Series to an arrow array. The dtype of the returned array will match the
@@ -210,8 +282,21 @@ impl ToArrowConverter {
 
                 Box::new(arr)
             },
-            (DataType::List(item_dtype), ArrowDataType::LargeList(_)) => {
+            (DataType::List(item_dtype), ArrowDataType::LargeList(arrow_item_field)) => {
                 let arr: &ListArray<i64> = array.as_any().downcast_ref().unwrap();
+                // A split piece of a list of maps must export only the child it spans, as its
+                // whole child may overflow the `i32` offsets of an arrow MAP.
+                let item_dtype_arrow = arrow_item_field.dtype();
+                let trimmed = (contains_arrow_map(item_dtyp
```

**File**: `crates/polars-core/src/series/arrow_export/split.rs` (added, +423/-0)
```diff
@@ -0,0 +1,423 @@
+use std::ops::Range;
+
+use polars_arrow::array::{Array, FixedSizeListArray, ListArray, StructArray};
+use polars_arrow::datatypes::ArrowDataType;
+
+/// The most entries an arrow MAP array can hold, as its offsets are `i32`.
+const MAX_MAP_ENTRIES: u64 = i32::MAX as u64;
+
+/// Whether exporting to `dtype` builds an arrow MAP, whose offsets are `i32`.
+pub(crate) fn contains_arrow_map(dtype: &ArrowDataType) -> bool {
+    match dtype {
+        ArrowDataType::Map(_, _) => true,
+        ArrowDataType::LargeList(field) | ArrowDataType::FixedSizeList(field, _) => {
+            contains_arrow_map(field.dtype())
+        },
+        ArrowDataType::Struct(fields) => fields.iter().any(|f| contains_arrow_map(f.dtype())),
+        ArrowDataType::Extension(ext) => contains_arrow_map(&ext.inner),
+        _ => false,
+    }
+}
+
+/// The most entries any MAP of `dtype` spans over `rows` of `array`, a Polars physical array laid
+/// out as `ToArrowConverter` expects; reads two offsets per list level.
+///
+/// A span bounds what export keeps, which can be less: a MAP drops the entries of its null rows
+/// (`normalize_map_entries`). An array that `dtype` doesn't describe spans nothing, which leaves
+/// the mismatch for conversion to report.
+fn max_map_span(array: &dyn Array, rows: Range<usize>, dtype: &ArrowDataType) -> u64 {
+    match dtype {
+        ArrowDataType::Map(entries, _) | ArrowDataType::LargeList(entries) => {
+            let Some(arr) = array.as_any().downcast_ref::<ListArray<i64>>() else {
+                return 0;
+            };
+            let offsets = arr.offsets().as_slice();
+            let child_rows = offsets[rows.start] as usize..offsets[rows.end] as usize;
+            let own = match dtype {
+                ArrowDataType::Map(_, _) => child_rows.len() as u64,
+                _ => 0,
+            };
+            own.max(max_map_span(
+                arr.values().as_ref(),
+                child_rows,
+                entries.dtype(),
+            ))
+        },
+        ArrowDataType::FixedSizeList(item, width) => {
+            let Some(arr) = array
+                .as_any()
+                .downcast_ref::<FixedSizeListArray>()
+                .filter(|arr| arr.size() == *width)
+            else {
+                return 0;
+            };
+            let child_rows = rows.start * width..rows.end * width;
+            max_map_span(arr.values().as_ref(), child_rows, item.dtype())
+        },
+        ArrowDataType::Struct(fields) => {
+            let Some(arr) = array.as_any().downcast_ref::<StructArray>() else {
+                return 0;
+            };
+            arr.values()
+                .iter()
+                .zip(fields)
+                .map(|(values, f)| max_map_span(values.as_ref(), rows.clone(), f.dtype()))
+                .max()
+                .unwrap_or(0)
+        },
+        ArrowDataType::Extension(ext) => max_map_span(array, rows, &ext.inner),
+        _ => 0,
+    }
+}
+
+/// Whether every arrow MAP that exporting `rows` of `array` to `dtype` builds fits in `i32`
+/// offsets, with `rows` repeated `repeat` times, as a scalar column repeats its one row.
+pub(crate) fn map_spans_fit(
+    array: &dyn Array,
+    dtype: &ArrowDataType,
+    rows: Range<usize>,
+    repeat: usize,
+) -> bool {
+    max_map_span(array, rows, dtype).saturating_mul(repeat as u64) <= MAX_MAP_ENTRIES
+}
+
+/// The end of the longest range from `rows.start` within `rows` that `fits`, or the single row
+/// at `rows.start`, which conversion must then check.
+///
+/// `fits` must stay false once a range doesn't fit, as spans only grow with the range; this
+/// calls it `log2(rows.len())` times.
+pub(crate) fn arrow_export_cut(rows: Range<usize>, fits: impl Fn(Range<usize>) -> bool) -> usize {
+    if rows.is_empty() || fits(rows.clone()) {
+        return rows.end;
+    }
+    let (mut end, mut hi) = (rows.start + 1, rows.end - 1);
+    while end < hi {
+        let mid = end + (hi - end).div_ceil(2);
+        if fits(rows.start..mid) {
+            end = mid;
+        } else {
+            hi = mid - 1;
+        }
+    }
+    end
+}
+
+#[cfg(all(test, feature = "dtype-map"))]
+mod tests {
+    use std::borrow::Cow;
+
+    #[cfg(feature = "dtype-array")]
+    use polars_arrow::array::FixedSizeListArray;
+    use polars_arrow::array::{BooleanArray, Int32Array, MapArray, NullArray};
+    use polars_arrow::bitmap::Bitmap;
+    use polars_arrow::offset::Offsets;
+
+    use super::arrow_export_cut;
+    use crate::frame::RecordBatchIter;
+    use crate::frame::column::ScalarColumn;
+    use crate::prelude::*;
+
+    fn map_dtype() -> DataType {
+        DataType::Map(Box::new(DataType::Boolean), Box::new(DataType::Null))
+    }
+
+    /// A `Map(Boolean, Null)` chunk with `lens` entries per row; its zeroed keys are allocated
+    /// lazily, so the entries cost no memory until read.
+    fn map_chunk(lens: &[i64], validity: Option<Bitmap>) -> ArrayRef {
+       
```

**File**: `crates/polars-expr/src/dispatch/struct_.rs` (modified, +4/-4)
```diff
@@ -113,11 +113,11 @@ pub(super) fn to_json(col: &Column) -> PolarsResult<Column> {
 
     let s = col.as_materialized_series();
     s.dtype().ensure_json_map_keys()?;
-    let iter = (0..s.n_chunks()).map(|i| {
-        polars_json::json::write::serialize_to_utf8(&*s.to_arrow(i, CompatLevel::newest()))
-    });
+    let iter = (0..s.n_chunks())
+        .flat_map(|i| s.try_to_arrow_split(i, CompatLevel::newest()))
+        .map(|arr| PolarsResult::Ok(polars_json::json::write::serialize_to_utf8(&*arr?)));
 
-    Ok(StringChunked::from_chunk_iter(s.name().clone(), iter).into_column())
+    Ok(StringChunked::try_from_chunk_iter(s.name().clone(), iter)?.into_column())
 }
 
 /// Merge the evaluated fields in `args[1..]` into the input struct `args[0]`.
```

**File**: `crates/polars-ffi/src/version_0.rs` (modified, +10/-6)
```diff
@@ -104,12 +104,16 @@ pub fn export_series(s: &Series) -> SeriesExport {
         .to_arrow_field(s.name().clone(), CompatLevel::newest());
     let schema = Box::new(ffi::export_field_to_c(&field));
 
-    let mut arrays = (0..s.chunks().len())
-        .map(|i| {
-            // Make sure we export the logical type.
-            let arr = s.to_arrow(i, CompatLevel::newest());
-            Box::into_raw(Box::new(ffi::export_array_to_c(arr.clone())))
-        })
+    // A chunk becomes several arrays where an arrow MAP would overflow its `i32` offsets. Only a
+    // single row with more map entries than that panics, as this ABI has no way to return errors.
+    // All pieces convert before any is handed over, so that panic leaks none of them.
+    let arrays = (0..s.chunks().len())
+        .flat_map(|i| s.try_to_arrow_split(i, CompatLevel::newest()))
+        .collect::<PolarsResult<Vec<_>>>()
+        .unwrap();
+    let mut arrays = arrays
+        .into_iter()
+        .map(|arr| Box::into_raw(Box::new(ffi::export_array_to_c(arr))))
         .collect::<Box<_>>();
 
     let len = arrays.len();
```

#### Recent Merged Pull Requests:
- **PR #30998** (closed): fix(python): Fix scan_database reads on Trino, SQL Server, Databricks, Oracle, ClickHouse and MariaDB (@ritchie46)
- **PR #30996** (2026-11-22): fix: Return no rows from SQL `UNNEST` of an empty or NULL list (@kdn36)
- **PR #30993** (closed): Stop streaming NDJSON at the forward slice limit (@CodexDot)
- **PR #30990** (2026-11-21): fix(python): Normalize Windows paths in Iceberg add_files (@ritchie46)
- **PR #30989** (2026-11-22): fix: Compute a SQL `INSERT` or `DELETE` that reads its own table when it runs (@kdn36)
- **PR #30988** (2026-11-21): fix(rust): Give the polars-cli query thread the stack of the main thread (@kdn36)

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

## X. rust): Give the polars-cli query thread the stack of the main thread

**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1695451f`: rust): Give the polars-cli query thread the stack of the main thread. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
 "recursive",
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1695451f` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
