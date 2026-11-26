# Verification Protocol: Verification Protocol: Empirical Defect Shield for pola-rs-polars-learnings

<!-- PROVENANCE_START
{
  "source_repository": "pola-rs-polars-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T10:19:33.535Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pola-rs-polars-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pola-rs-polars-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T10:19:33.535Z`  
> **Learning ID**: `LEARN-EVO-pola-rs-polars-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `pola-rs-polars-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source**: github ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Source Version**: `e55d90ce`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T10:19:24.115Z  
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
> **Harvest Timestamp**: 2026-11-26T10:19:24.110Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 40519 stars

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
- **Issue #31100** (2026-11-26): **Table display misaligns borders for halfwidth katakana voiced sound marks (U+FF9E, U+FF9F)**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  df = pl.DataFrame({"a": ["ｶﾞ", "ab"]}) print(df) ```   ### Log output  ```shell shape: (2, 1) ┌─────┐ │ a   │ │ --- │ │ str │ ╞═════╡ │ ｶﾞ   │ │ ab  │ └─────┘ ```  ### Issue description  When a string contains the halfwidth katakana voiced sound mark `ﾞ` (U+FF9E) or semi-voiced sound mark `ﾟ` (U+FF9F), the table borders in `print(df)` are shifted one column to the right for each such character.  These two characters have East Asian Width `H` and take one cell in a terminal, but `unicode-width` 0.2.2, which Polars uses through `comfy-table`, returns width 0 for them. This was fixed in `unicode-width` 0.2.3 (unicode-rs/unicode-width#89); Polars' `Cargo.lock` on `main` still pins 0.2.2.  Also verified: - Other halfwidth katakana (e.g. `ｶﾀｶﾅ`) and fullwidth katakana align correctly. - A standalone Rust program using `comfy-table` 7.2.2 with `unicode-width` 0.2.2 shows the same misalignment; with `unicode-width` 0.2.3 the table aligns. - `unicode-width` returns 1 for these characters up to 0.1.11 and 0 from 0.1.12 to 0.2.2. - Reproduced on Polars 2.2.0 and 1.0.0.  This issue was drafted with help from Claude Code; I reviewed, edited and ran everything myself.  ### Expected behavior  The borders should line up, as they do for `ｶ` without th

- **Issue #31076** (2026-11-25): **`round(mode="to_zero")` is documented and typed but refused by the binding**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  df = pl.DataFrame({"x": [0.9, -0.9, 1.29]})  print(df.select(pl.col("x").truncate()))  # 0.0, -0.0, 1.0 print(df.select(pl.col("x").round(0, mode="to_zero")))  # ValueError ```    ### Log output  ```shell total memory: 24.000 GiB (25769803776 bytes) async thread count: 8 blocking thread count: 512 ValueError: `mode` must be one of {'half_to_even', 'half_away_from_zero'}, got to_zero while processing 'mode' ```  ### Issue description  The docstring of `Expr.round` lists `mode : {'half_to_even', 'half_away_from_zero', 'to_zero'}` and describes `to_zero`, and the `RoundMode` type alias includes it. The Rust side has `RoundMode::ToZero`, which `truncate` uses (added in #26677). But passing `mode="to_zero"` raises a `ValueError` listing only the other two modes, so the binding's conversion of `mode` does not accept it. On the main branch, that conversion (`Wrap<RoundMode>` in `crates/polars-python/src/conversion/mod.rs`) still matches only `half_to_even` and `half_away_from_zero`.  *Bug found with Claude and fuzzing/shrinking.   ### Expected behavior  `round(0, mode="to_zero")` gives the same result as `truncate()`: `0.0, -0.0, 1.0`.   ### Installed versions  <details>  ``` --------Version info--------- Polars:              2.1.0 Build:   

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

### Incident Patch 1: `c2bb320e` (2026-11-25)
**Commit Message**: fix: Raise on non-numeric `hist` bins instead of panicking (#31069)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `crates/polars-ops/src/chunked_array/hist.rs` (modified, +5/-0)
```diff
@@ -184,6 +184,11 @@ impl HistBreaks {
     pub fn new(s: &Series, bin_count: Option<usize>, bins: Option<&Series>) -> PolarsResult<Self> {
         let bins = bins
             .map(|bins| {
+                // `Null` is the dtype of empty bins, e.g. `bins=[]` from Python.
+                polars_ensure!(
+                    bins.dtype().is_numeric() || bins.dtype().is_null(),
+                    InvalidOperation: "`hist` bins must be numeric, got dtype `{}`", bins.dtype()
+                );
                 polars_ensure!(bins.null_count() == 0, InvalidOperation: "nulls not supported in 'bins' argument");
                 Ok(bins.cast(&DataType::Float64)?.rechunk())
             })
```

**File**: `py-polars/tests/unit/operations/test_hist.py` (modified, +26/-1)
```diff
@@ -1,10 +1,12 @@
 from __future__ import annotations
 
+from decimal import Decimal
+
 import numpy as np
 import pytest
 
 import polars as pl
-from polars.exceptions import ComputeError
+from polars.exceptions import ComputeError, InvalidOperationError
 from polars.testing import assert_frame_equal
 
 inf = float("inf")
@@ -160,6 +162,29 @@ def test_hist_invalid_bins() -> None:
         s.hist(bins=[1, 0])  # invalid order
 
 
+@pytest.mark.parametrize(
+    "bins",
+    [
+        pl.Series(["a", "1"]),
+        pl.Series(["1", "2"]),
+        pl.Series([True, False]),
+    ],
+)
+def test_hist_non_numeric_bins(bins: pl.Series) -> None:
+    lf = pl.LazyFrame({"x": [1.0, 2.0]})
+    q = lf.select(pl.col("x").hist(bins=pl.lit(bins)))
+    with pytest.raises(InvalidOperationError, match="bins must be numeric"):
+        q.collect()
+
+
+def test_hist_decimal_bins() -> None:
+    lf = pl.LazyFrame({"x": [1.0, 2.0]})
+    bins = pl.Series([Decimal("0.5"), Decimal("1.5")])
+    result = lf.select(pl.col("x").hist(bins=pl.lit(bins))).collect()
+    expected = pl.DataFrame({"x": pl.Series([1], dtype=pl.get_index_type())})
+    assert_frame_equal(result, expected)
+
+
 def test_hist_bin_outside_data() -> None:
     s = pl.Series([-5, 2, 0, 1, 99], dtype=pl.Int32)
     result = s.hist(bins=[-10, -9])
```

---

### Incident Patch 2: `e55d90ce` (2026-11-26)
**Commit Message**: feat: Add memory budget to pl.Config (#31122)

**File**: `py-polars/docs/source/reference/config.rst` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ Config options
     Config.set_fmt_float
     Config.set_fmt_str_lengths
     Config.set_fmt_table_cell_list_len
+    Config.set_memory_budget
     Config.set_streaming_chunk_size
     Config.set_tbl_cell_alignment
     Config.set_tbl_cell_numeric_alignment
```

**File**: `py-polars/src/polars/config.py` (modified, +38/-0)
```diff
@@ -76,6 +76,7 @@
     "POLARS_FMT_TABLE_INLINE_COLUMN_DATA_TYPE",
     "POLARS_FMT_TABLE_ROUNDED_CORNERS",
     "POLARS_IDEAL_MORSEL_SIZE",
+    "POLARS_OOC_MEMORY_BUDGET_MB",
     "POLARS_TABLE_WIDTH",
     "POLARS_VERBOSE",
     "POLARS_MAX_EXPR_DEPTH",
@@ -151,6 +152,7 @@ class ConfigParameters(TypedDict, total=False):
     fmt_float: FloatFmt | None
     fmt_str_lengths: int | None
     fmt_table_cell_list_len: int | None
+    memory_budget: int | None
     streaming_chunk_size: int | None
     tbl_cell_alignment: Alignment | None
     tbl_cell_numeric_alignment: Alignment | None
@@ -178,6 +180,7 @@ class ConfigParameters(TypedDict, total=False):
     set_fmt_float: FloatFmt | None
     set_fmt_str_lengths: int | None
     set_fmt_table_cell_list_len: int | None
+    set_memory_budget: int | None
     set_streaming_chunk_size: int | None
     set_tbl_cell_alignment: Alignment | None
     set_tbl_cell_numeric_alignment: Alignment | None
@@ -957,6 +960,41 @@ def set_streaming_chunk_size(cls, size: int | None) -> type[Config]:
         plr.config_reload_env_var("POLARS_IDEAL_MORSEL_SIZE")
         return cls
 
+    @classmethod
+    @unstable()
+    def set_memory_budget(cls, mb: int | None) -> type[Config]:
+        """
+        Set the memory budget of the streaming engine in megabytes.
+
+        When the streaming engine uses more memory than this budget, it spills
+        data to disk. The effective budget is the smaller of this value and
+        `POLARS_OOC_MEMORY_BUDGET_FRACTION` (default 0.8) times the total memory.
+
+        This can also be triggered by setting the `POLARS_OOC_MEMORY_BUDGET_MB` env var.
+
+        Parameters
+        ----------
+        mb
+            Memory budget in megabytes (1 MB = 1,000,000 bytes). Set to `None`
+            to only use the fraction of the total memory.
+
+        Examples
+        --------
+        >>> pl.Config.set_memory_budget(4_000)  # doctest: +SKIP
+        >>> with pl.Config(memory_budget=4_000):  # doctest: +SKIP
+        ...     lf.collect(engine="streaming")
+        """
+        if mb is None:
+            os.environ.pop("POLARS_OOC_MEMORY_BUDGET_MB", None)
+        else:
+            if mb < 0:
+                msg = "memory budget must be >= 0"
+                raise ValueError(msg)
+
+            os.environ["POLARS_OOC_MEMORY_BUDGET_MB"] = str(mb)
+        plr.config_reload_env_var("POLARS_OOC_MEMORY_BUDGET_MB")
+        return cls
+
     @classmethod
     def set_tbl_cell_alignment(cls, format: Alignment | None) -> type[Config]:
         """
```

**File**: `py-polars/tests/unit/meta/test_config.py` (modified, +14/-0)
```diff
@@ -13,6 +13,7 @@
 from polars._utils.unstable import issue_unstable_warning
 from polars.config import _POLARS_CFG_ENV_VARS
 from polars.exceptions import AttributeRemovedError
+from polars.testing import assert_frame_equal
 
 if TYPE_CHECKING:
     from collections.abc import Iterator
@@ -847,6 +848,18 @@ def test_set_streaming_chunk_size() -> None:
         cfg.set_streaming_chunk_size(0)
 
 
+def test_set_memory_budget() -> None:
+    with pl.Config() as cfg:
+        cfg.set_memory_budget(0)
+        assert os.environ.get("POLARS_OOC_MEMORY_BUDGET_MB") == "0"
+        lf = pl.LazyFrame({"a": [3, 1, 2] * 20, "b": range(60)})
+        out = lf.sort("a", "b").collect(engine="streaming")
+        assert_frame_equal(out, lf.collect().sort("a", "b"))
+
+    with pytest.raises(ValueError), pl.Config() as cfg:
+        cfg.set_memory_budget(-1)
+
+
 def test_set_fmt_str_lengths_invalid_length() -> None:
     with pl.Config() as cfg:
         with pytest.raises(ValueError):
@@ -1001,6 +1014,7 @@ def test_warn_unstable(recwarn: pytest.WarningsRecorder) -> None:
             "1",
         ),
         ("POLARS_IDEAL_MORSEL_SIZE", "set_streaming_chunk_size", 100, "100"),
+        ("POLARS_OOC_MEMORY_BUDGET_MB", "set_memory_budget", 4000, "4000"),
         ("POLARS_TABLE_WIDTH", "set_tbl_width_chars", 80, "80"),
         ("POLARS_VERBOSE", "set_verbose", True, "1"),
         ("POLARS_WARN_UNSTABLE", "warn_unstable", True, "1"),
```

---

### Incident Patch 3: `4fd4e358` (2026-11-26)
**Commit Message**: perf: Stream `drop_nulls` and `drop_nans` over non-elementwise inputs in group-by (#31096)

**File**: `crates/polars-plan/src/dsl/meta.rs` (modified, +3/-2)
```diff
@@ -172,12 +172,13 @@ impl MetaNameSpace {
         Ok(exprs.iter().all(|e| e.is_known_length(&expr_arena)))
     }
 
-    /// Indicate if this expression as a whole is row-separable (see [`is_row_separable_rec`]).
+    /// Indicate if this expression as a whole is row-separable (see [`ExprProperties::is_row_separable`]).
     pub fn is_row_separable(self, schema: Option<&Schema>) -> PolarsResult<bool> {
         let has_schema = schema.is_some();
         let (exprs, expr_arena) = self.into_expr_irs(schema)?;
+        let mut expr_props = ExprProperties::default();
         Ok(exprs.iter().all(|e| {
-            is_row_separable_rec(e.node(), &expr_arena)
+            expr_props.is_row_separable(e.node(), &expr_arena)
                 && (has_schema || !has_unresolved_set_argument(e.node(), &expr_arena))
         }))
     }
```

**File**: `crates/polars-plan/src/plans/aexpr/properties/expr_properties.rs` (added, +358/-0)
```diff
@@ -0,0 +1,358 @@
+use std::ops::ControlFlow;
+
+use polars_utils::aliases::PlIndexMap;
+use polars_utils::idx_vec::UnitVec;
+use polars_utils::scratch_vec::ScratchVec;
+use polars_utils::unitvec;
+
+use super::super::*;
+use super::general::is_input_independent_scalar_top_level;
+use crate::plans::projection_height::{ExprHeightVisitor, ExprProjectionHeight};
+use crate::traversal::edge_provider::NodeEdgesProvider;
+use crate::traversal::visitor::{NodeVisitor, SubtreeVisit};
+
+/// Memoized properties of the expressions in an `Arena<AExpr>`.
+///
+/// A `Node` must keep referring to the same expression for as long as `ExprProperties` is used.
+#[derive(Default)]
+pub struct ExprProperties {
+    is_elementwise: PlIndexMap<Node, bool>,
+    is_row_separable: PlIndexMap<Node, bool>,
+    is_input_independent: PlIndexMap<Node, bool>,
+    is_input_independent_scalar: PlIndexMap<Node, bool>,
+    is_frame_dependent: PlIndexMap<Node, bool>,
+    is_length_preserving: PlIndexMap<Node, bool>,
+    node_scratch: ScratchVec<Node>,
+    height_scratch: ScratchVec<ExprProjectionHeight>,
+}
+
+impl ExprProperties {
+    pub fn with_capacity(capacity: usize) -> Self {
+        Self {
+            is_elementwise: PlIndexMap::with_capacity(capacity),
+            is_row_separable: PlIndexMap::with_capacity(capacity),
+            is_input_independent: PlIndexMap::with_capacity(capacity),
+            is_input_independent_scalar: PlIndexMap::with_capacity(capacity),
+            is_frame_dependent: PlIndexMap::with_capacity(capacity),
+            is_length_preserving: PlIndexMap::with_capacity(capacity),
+            node_scratch: ScratchVec::default(),
+            height_scratch: ScratchVec::default(),
+        }
+    }
+
+    /// Return whether the expression at `node` is elementwise, as [`is_elementwise_rec`].
+    #[recursive::recursive]
+    pub fn is_elementwise(&mut self, node: Node, expr_arena: &Arena<AExpr>) -> bool {
+        if let Some(&ret) = self.is_elementwise.get(&node) {
+            return ret;
+        }
+
+        // `is_elementwise` skips the single-literal right-hand side of `is_in`.
+        let mut inputs = unitvec![];
+        let ret = is_elementwise(&mut inputs, expr_arena.get(node), expr_arena)
+            && inputs.iter().all(|&n| self.is_elementwise(n, expr_arena));
+
+        self.is_elementwise.insert(node, ret);
+        ret
+    }
+
+    /// Return whether the expression at `node` is row-separable: evaluating it on batches of rows
+    /// and concatenating the results gives the same output as evaluating it on the whole frame,
+    /// where a scalar result is broadcast to the frame's height.
+    ///
+    /// Every node must be row-separable, and the inputs it zips must line up within a batch (see
+    /// [`Self::zipped_inputs_line_up`]). A node that isn't elementwise must also have an input that
+    /// reads the frame: `lit([1, 2]).explode()` gives two rows per batch.
+    #[recursive::recursive]
+    pub fn is_row_separable(&mut self, node: Node, expr_arena: &Arena<AExpr>) -> bool {
+        if let Some(&ret) = self.is_row_separable.get(&node) {
+            return ret;
+        }
+
+        let ae = expr_arena.get(node);
+        let mut inputs = unitvec![];
+        ae.inputs_rev(&mut inputs);
+        let ret = ae.is_row_separable_top_level()
+            && inputs.iter().all(|&n| self.is_row_separable(n, expr_arena))
+            && self.zipped_inputs_line_up(&inputs, expr_arena)
+            && (ae.is_elementwise_top_level()
+                || inputs
+                    .iter()
+                    .any(|&n| self.is_frame_dependent(n, expr_arena)));
+
+        self.is_row_separable.insert(node, ret);
+        ret
+    }
+
+    /// Return whether `inputs`, zipped within a batch of rows, line up as they do over the whole
+    /// frame: all are elementwise, or all but one are input-independent scalars.
+    pub fn zipped_inputs_line_up(&mut self, inputs: &[Node], expr_arena: &Arena<AExpr>) -> bool {
+        let non_scalars: UnitVec<Node> = inputs
+            .iter()
+            .copied()
+            .filter(|&n| !self.is_input_independent_scalar(n, expr_arena))
+            .collect();
+        non_scalars.len() <= 1
+            || non_scalars
+                .iter()
+                .all(|&n| self.is_elementwise(n, expr_arena))
+    }
+
+    /// Return whether the expression at `node` reads a column or the frame's length.
+    #[recursive::recursive]
+    fn is_frame_dependent(&mut self, node: Node, expr_arena: &Arena<AExpr>) -> bool {
+        if let Some(&ret) = self.is_frame_dependent.get(&node) {
+            return ret;
+        }
+
+        let ae = expr_arena.get(node);
+        let ret = matches!(ae, AExpr::Column(_) | AExpr::Len) || {
+            let mut inputs: UnitVec<Node> = unitvec![];
+            ae.inputs_rev(&mut inputs);
+            inputs
+                .iter()
+                .any(|&n| self.is_frame_dependent(n, expr_arena))
+        };
+
+    
```

**File**: `crates/polars-plan/src/plans/aexpr/properties/general.rs` (modified, +1/-104)
```diff
@@ -1,4 +1,3 @@
-use polars_utils::aliases::PlIndexMap;
 use polars_utils::idx_vec::UnitVec;
 use polars_utils::unitvec;
 
@@ -242,7 +241,7 @@ pub fn is_input_independent_scalar_rec(node: Node, expr_arena: &Arena<AExpr>) ->
 }
 
 /// Whether `ae` yields an input-independent scalar when all its inputs do.
-fn is_input_independent_scalar_top_level(ae: &AExpr) -> bool {
+pub(super) fn is_input_independent_scalar_top_level(ae: &AExpr) -> bool {
     match ae {
         AExpr::Literal(lv) => lv.is_scalar(),
         AExpr::BinaryExpr { .. } | AExpr::Cast { .. } | AExpr::Ternary { .. } => true,
@@ -251,108 +250,6 @@ fn is_input_independent_scalar_top_level(ae: &AExpr) -> bool {
     }
 }
 
-/// Checks if the top-level expression node is row-separable. If this is the case, then `stack` will
-/// be extended further with any nested expression nodes.
-///
-/// This doesn't check that the inputs it pushes line up within a batch, so walking it with
-/// `property_rec` accepts `a.filter(p) + b.filter(q)`; use [`is_row_separable_rec`] for a whole
-/// expression.
-pub fn is_row_separable(stack: &mut UnitVec<Node>, ae: &AExpr, expr_arena: &Arena<AExpr>) -> bool {
-    is_prop(stack, ae, expr_arena, |ae| ae.is_row_separable_top_level())
-}
-
-/// Whether each expression in `nodes` on its own is row-separable, see [`is_row_separable_rec`].
-/// Public API for downstream crates such as Polars Nanook.
-///
-/// This doesn't check that the outputs of several expressions line up with each other.
-pub fn all_row_separable<'a, N>(nodes: &'a [N], expr_arena: &Arena<AExpr>) -> bool
-where
-    Node: From<&'a N>,
-{
-    let mut memo = PlIndexMap::default();
-    nodes
-        .iter()
-        .all(|n| row_separability(n.into(), expr_arena, &mut memo).row_separable)
-}
-
-/// Whether the expression at `node` as a whole is row-separable, see [`row_separability`].
-pub fn is_row_separable_rec(node: Node, expr_arena: &Arena<AExpr>) -> bool {
-    row_separability(node, expr_arena, &mut PlIndexMap::default()).row_separable
-}
-
-/// The properties of an expression that decide whether it is row-separable.
-#[derive(Clone, Copy, Debug)]
-pub struct RowSeparability {
-    /// Evaluating the expression on batches of rows and concatenating the results gives the same
-    /// output as evaluating it on the whole frame, where a scalar result is broadcast to the
-    /// frame's height.
-    pub row_separable: bool,
-    /// As [`is_elementwise_rec`].
-    pub elementwise: bool,
-    /// As [`is_input_independent_scalar_rec`].
-    pub input_independent_scalar: bool,
-    /// The expression reads a column or the frame's length.
-    pub frame_dependent: bool,
-}
-
-/// Derives the [`RowSeparability`] of the expression at `node`, memoizing it and that of the
-/// subexpressions it visits in `memo`, so that sharing `memo` across calls visits each node once.
-///
-/// Every node must be row-separable, and the inputs it zips must line up within a batch (see
-/// [`zipped_inputs_line_up`]). A node that isn't elementwise must also have an input that reads the
-/// frame: `lit([1, 2]).explode()` gives two rows per batch.
-#[recursive::recursive]
-pub fn row_separability(
-    node: Node,
-    expr_arena: &Arena<AExpr>,
-    memo: &mut PlIndexMap<Node, RowSeparability>,
-) -> RowSeparability {
-    if let Some(&props) = memo.get(&node) {
-        return props;
-    }
-    let ae = expr_arena.get(node);
-    let mut stack = unitvec![];
-    ae.inputs_rev(&mut stack);
-    let inputs: UnitVec<RowSeparability> = stack
-        .iter()
-        .map(|&n| row_separability(n, expr_arena, memo))
-        .collect();
-    let row_separable = ae.is_row_separable_top_level()
-        && inputs.iter().all(|p| p.row_separable)
-        && zipped_inputs_line_up(&inputs)
-        && (ae.is_elementwise_top_level() || inputs.iter().any(|p| p.frame_dependent));
-
-    // `is_elementwise` skips the single-literal right-hand side of `is_in`, as
-    // `is_elementwise_rec` does. Every input it pushes is in `memo` already.
-    stack.clear();
-    let elementwise =
-        is_elementwise(&mut stack, ae, expr_arena) && stack.iter().all(|n| memo[n].elementwise);
-
-    let input_independent_scalar = is_input_independent_scalar_top_level(ae)
-        && inputs.iter().all(|p| p.input_independent_scalar);
-    let frame_dependent =
-        matches!(ae, AExpr::Column(_) | AExpr::Len) || inputs.iter().any(|p| p.frame_dependent);
-
-    let props = RowSeparability {
-        row_separable,
-        elementwise,
-        input_independent_scalar,
-        frame_dependent,
-    };
-    memo.insert(node, props);
-    props
-}
-
-/// Whether `inputs`, zipped within a batch of rows, line up as they do over the whole frame: all
-/// are elementwise, or all but one are input-independent scalars.
-///
-/// This is sufficient, not necessary: two filters on the same predicate line up, but are
-/// rejected.
-pub fn zipped_inputs_line_up(inputs: &[RowSeparability]) -> bool {
-    let mu
```

**File**: `crates/polars-plan/src/plans/aexpr/properties/mod.rs` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
+mod expr_properties;
 mod general;
 
+pub use expr_properties::ExprProperties;
 pub use general::*;
```

**File**: `crates/polars-plan/src/plans/optimizer/join_predicate_fusion.rs` (modified, +3/-3)
```diff
@@ -15,8 +15,8 @@ use crate::dsl::Operator;
 use crate::plans::iterator::ArenaExprIter;
 use crate::plans::options::JoinTypeOptionsIR;
 use crate::plans::{
-    AExpr, ExprIR, ExprPushdownGroup, IR, JoinOptionsIR, JoinType, MintermIter, OutputName,
-    is_row_separable_rec,
+    AExpr, ExprIR, ExprProperties, ExprPushdownGroup, IR, JoinOptionsIR, JoinType, MintermIter,
+    OutputName,
 };
 use crate::utils::{aexpr_to_leaf_names_iter, rename_columns};
 
@@ -58,7 +58,7 @@ pub(super) fn can_fuse_predicate(node: Node, expr_arena: &Arena<AExpr>) -> bool
     group.update_with_expr_rec(expr_arena.get(node), expr_arena, None);
 
     matches!(group, ExprPushdownGroup::Pushable)
-        && is_row_separable_rec(node, expr_arena)
+        && ExprProperties::default().is_row_separable(node, expr_arena)
         && !contains_dynamic_pred(node, expr_arena)
 }
 
```

**File**: `crates/polars-stream/src/physical_plan/lower_expr.rs` (modified, +34/-305)
```diff
@@ -1,11 +1,10 @@
-use std::ops::ControlFlow;
 use std::sync::Arc;
 
 use polars_core::chunked_array::cast::CastOptions;
 use polars_core::datatypes::AnyValue;
 use polars_core::frame::DataFrame;
 use polars_core::prelude::{
-    DataType, Field, IDX_DTYPE, InitHashMaps, PlHashMap, PlHashSet, PlIndexMap, PlIndexSet,
+    DataType, Field, IDX_DTYPE, InitHashMaps, PlHashSet, PlIndexMap, PlIndexSet,
     SortMultipleOptions,
 };
 #[cfg(feature = "rolling_window")]
@@ -20,13 +19,10 @@ use polars_expr::{ExpressionConversionState, create_physical_expr};
 use polars_ops::series::{RLE_LENGTH_COLUMN_NAME, RLE_VALUE_COLUMN_NAME};
 use polars_plan::plans::AExpr;
 use polars_plan::plans::expr_ir::{ExprIR, OutputName};
-use polars_plan::plans::projection_height::{ExprHeightVisitor, ExprProjectionHeight};
 use polars_plan::prelude::*;
-use polars_plan::traversal::visitor::{NodeVisitor, SubtreeVisit};
 use polars_utils::arena::{Arena, Node};
 use polars_utils::itertools::Itertools;
 use polars_utils::pl_str::PlSmallStr;
-use polars_utils::scratch_vec::ScratchVec;
 use polars_utils::slice_enum::Slice;
 use slotmap::DenseSlotMap;
 
@@ -44,32 +40,12 @@ use crate::physical_plan::lower_ir::{
 };
 use crate::unique_column_name;
 
-type ExprNodeKey = Node;
-
-pub(crate) struct ExprCache {
-    is_elementwise: PlHashMap<Node, bool>,
-    is_input_independent: PlHashMap<Node, bool>,
-    is_length_preserving: PlHashMap<Node, bool>,
-}
-
-impl ExprCache {
-    pub fn with_capacity(capacity: usize) -> Self {
-        Self {
-            is_elementwise: PlHashMap::with_capacity(capacity),
-            is_input_independent: PlHashMap::with_capacity(capacity),
-            is_length_preserving: PlHashMap::with_capacity(capacity),
-        }
-    }
-}
-
 pub(crate) struct LowerExprContext<'a> {
     pub(crate) prepare_visualization: bool,
     pub(crate) sortedness: &'a IRPlanSorted,
     pub(crate) expr_arena: &'a mut Arena<AExpr>,
     pub(crate) phys_sm: &'a mut DenseSlotMap<PhysNodeKey, PhysNode>,
-    pub(crate) cache: &'a mut ExprCache,
-    pub(crate) node_scratch: &'a mut ScratchVec<Node>,
-    pub(crate) ae_height_scratch: &'a mut ScratchVec<ExprProjectionHeight>,
+    pub(crate) expr_props: &'a mut ExprProperties,
 }
 
 impl<'a> From<LowerExprContext<'a>> for StreamingLowerIRContext<'a> {
@@ -91,174 +67,6 @@ impl<'a> From<&LowerExprContext<'a>> for StreamingLowerIRContext<'a> {
     }
 }
 
-pub(crate) fn is_elementwise_rec_cached(
-    expr_key: ExprNodeKey,
-    arena: &Arena<AExpr>,
-    cache: &mut ExprCache,
-) -> bool {
-    *cache
-        .is_elementwise
-        .entry(expr_key)
-        .or_insert_with(|| is_elementwise_rec(expr_key, arena))
-}
-
-#[recursive::recursive]
-pub fn is_input_independent_rec(
-    expr_key: ExprNodeKey,
-    arena: &Arena<AExpr>,
-    cache: &mut PlHashMap<ExprNodeKey, bool>,
-) -> bool {
-    if let Some(ret) = cache.get(&expr_key) {
-        return *ret;
-    }
-
-    let ret = match arena.get(expr_key) {
-        // Handled separately in `Eval`.
-        AExpr::Element | AExpr::EvalColumn(_) => unreachable!(),
-        AExpr::StructField(_) => false,
-        AExpr::Explode { expr: inner, .. }
-        | AExpr::Cast {
-            expr: inner,
-            dtype: _,
-            options: _,
-        }
-        | AExpr::Sort {
-            expr: inner,
-            options: _,
-        } => is_input_independent_rec(*inner, arena, cache),
-        AExpr::Column(_) => false,
-
-        AExpr::Literal(_) => true,
-        AExpr::BinaryExpr { left, op: _, right } => {
-            is_input_independent_rec(*left, arena, cache)
-                && is_input_independent_rec(*right, arena, cache)
-        },
-        AExpr::Gather {
-            expr,
-            idx,
-            returns_scalar: _,
-            null_on_oob: _,
-        } => {
-            is_input_independent_rec(*expr, arena, cache)
-                && is_input_independent_rec(*idx, arena, cache)
-        },
-        AExpr::SortBy {
-            expr,
-            by,
-            sort_options: _,
-        } => {
-            is_input_independent_rec(*expr, arena, cache)
-                && by
-                    .iter()
-                    .all(|expr| is_input_independent_rec(*expr, arena, cache))
-        },
-        AExpr::Filter { input, by } => {
-            is_input_independent_rec(*input, arena, cache)
-                && is_input_independent_rec(*by, arena, cache)
-        },
-        AExpr::Agg(agg_expr) => match agg_expr.get_input() {
-            polars_plan::plans::NodeInputs::Leaf => true,
-            polars_plan::plans::NodeInputs::Single(expr) => {
-                is_input_independent_rec(expr, arena, cache)
-            },
-            polars_plan::plans::NodeInputs::Many(exprs) => exprs
-                .iter()
-                .all(|expr| is_input_independent_rec(*expr, arena, cache)),
-        },
-        AExpr::Ternary {
-            predicate,
-            truthy,
-            falsy,
-        } => {
-
```

**File**: `crates/polars-stream/src/physical_plan/lower_group_by.rs` (modified, +71/-76)
```diff
@@ -25,10 +25,9 @@ use polars_utils::pl_str::PlSmallStr;
 use recursive::recursive;
 use slotmap::DenseSlotMap;
 
-use super::{ExprCache, PhysNode, PhysNodeKey, PhysNodeKind, PhysStream, StreamingLowerIRContext};
+use super::{PhysNode, PhysNodeKey, PhysNodeKind, PhysStream, StreamingLowerIRContext};
 use crate::physical_plan::lower_expr::{
     build_hstack_stream, build_select_stream, build_sort_stream, compute_output_schema,
-    is_elementwise_rec_cached, is_input_independent,
 };
 use crate::physical_plan::lower_ir::{
     build_filter_stream, build_row_idx_stream, build_slice_stream,
@@ -126,7 +125,7 @@ fn replace_agg_uniq(
     expr: Node,
     unique_of: Option<Node>,
     canonical_exprs: &mut CanonicalExprMap,
-    expr_cache: &mut ExprCache,
+    expr_props: &mut ExprProperties,
     expr_arena: &mut Arena<AExpr>,
     agg_exprs: &mut Vec<ExprIR>,
     uniq_input_names: &mut PlIndexMap<CanonicalExprId, PlSmallStr>,
@@ -151,7 +150,7 @@ fn replace_agg_uniq(
                         let (Some(x_id), x_col) = replace_elementwise_components(
                             x,
                             canonical_exprs,
-                            expr_cache,
+                            expr_props,
                             expr_arena,
                             uniq_input_names,
                             uniq_elementwise_exprs,
@@ -171,7 +170,7 @@ fn replace_agg_uniq(
                     let (input_id, node) = replace_elementwise_components(
                         *input,
                         canonical_exprs,
-                        expr_cache,
+                        expr_props,
                         expr_arena,
                         uniq_input_names,
                         uniq_elementwise_exprs,
@@ -211,14 +210,14 @@ fn replace_agg_uniq(
 fn replace_elementwise_components(
     expr: Node,
     canonical_exprs: &mut CanonicalExprMap,
-    expr_cache: &mut ExprCache,
+    expr_props: &mut ExprProperties,
     expr_arena: &mut Arena<AExpr>,
     uniq_input_names: &mut PlIndexMap<CanonicalExprId, PlSmallStr>,
     uniq_elementwise_exprs: &mut PlIndexMap<CanonicalExprId, ExprIR>,
     substream_input_ids: &mut PlIndexSet<CanonicalExprId>,
 ) -> (Option<CanonicalExprId>, Node) {
-    if is_elementwise_rec_cached(expr, expr_arena, expr_cache)
-        || (is_input_independent(expr, expr_arena, expr_cache) && is_scalar_ae(expr, expr_arena))
+    if expr_props.is_elementwise(expr, expr_arena)
+        || (expr_props.is_input_independent(expr, expr_arena) && is_scalar_ae(expr, expr_arena))
     {
         let id = canonical_exprs.resolve(expr, expr_arena);
         let name = uniq_input_names
@@ -240,7 +239,7 @@ fn replace_elementwise_components(
             let (input_id, node) = replace_elementwise_components(
                 *input,
                 canonical_exprs,
-                expr_cache,
+                expr_props,
                 expr_arena,
                 uniq_input_names,
                 uniq_elementwise_exprs,
@@ -265,7 +264,7 @@ fn try_lower_elementwise_scalar_agg_expr(
     gbl_kind: GroupByLowerKind,
     input_schema: &Schema,
     canonical_exprs: &mut CanonicalExprMap,
-    expr_cache: &mut ExprCache,
+    expr_props: &mut ExprProperties,
     expr_arena: &mut Arena<AExpr>,
     agg_exprs: &mut Vec<ExprIR>,
     uniq_input_names: &mut PlIndexMap<CanonicalExprId, PlSmallStr>,
@@ -282,7 +281,7 @@ fn try_lower_elementwise_scalar_agg_expr(
                 gbl_kind,
                 input_schema,
                 canonical_exprs,
-                expr_cache,
+                expr_props,
                 expr_arena,
                 agg_exprs,
                 uniq_input_names,
@@ -303,7 +302,7 @@ fn try_lower_elementwise_scalar_agg_expr(
                 $input,
                 $x,
                 canonical_exprs,
-                expr_cache,
+                expr_props,
                 expr_arena,
                 agg_exprs,
                 uniq_input_names,
@@ -314,7 +313,7 @@ fn try_lower_elementwise_scalar_agg_expr(
         };
     }
 
-    if is_input_independent(expr, expr_arena, expr_cache) {
+    if expr_props.is_input_independent(expr, expr_arena) {
         if is_scalar_ae(expr, expr_arena) {
             return Some(expr);
         } else {
@@ -328,7 +327,7 @@ fn try_lower_elementwise_scalar_agg_expr(
 
     // Whether `x` can be the input of a unique reduction.
     let mut unique_reducible = |x: Node, expr_arena: &Arena<AExpr>| {
-        is_elementwise_rec_cached(x, expr_arena, expr_cache)
+        expr_props.is_elementwise(x, expr_arena)
             && expr_arena
                 .get(x)
                 .to_dtype(&ToFieldContext::new(expr_arena, input_schema))
@@ -774,10 +773,10 @@ fn try_lower_agg_input_expr(
     expr: Node,
     expr_arena: &mut Arena<AExpr>,
     phys_sm: &mut DenseSlotMap<PhysNodeKey, PhysNode>,
-    expr_cache: &mut ExprCache,
+    expr_props: &mut ExprProperties,
     ctx: StreamingLowerIRContext<'_>,
 ) -> PolarsR
```

**File**: `crates/polars-stream/src/physical_plan/lower_ir.rs` (modified, +36/-35)
```diff
@@ -54,8 +54,8 @@ use crate::nodes::io_sources::multi_scan::reader_interface::builder::FileReaderB
 use crate::nodes::recursive::{RecursiveInputs, RecursiveStep};
 use crate::physical_plan::ZipBehavior;
 use crate::physical_plan::lower_expr::{
-    ExprCache, LowerExprContext, build_hstack_stream_with_ctx, build_select_stream,
-    input_height_expr, is_elementwise_rec_cached, lower_exprs,
+    LowerExprContext, build_hstack_stream_with_ctx, build_select_stream, input_height_expr,
+    lower_exprs,
 };
 use crate::physical_plan::lower_group_by::build_group_by_stream_with_key_ranges;
 use crate::unique_column_name;
@@ -88,17 +88,15 @@ pub fn build_filter_stream(
     predicate: ExprIR,
     expr_arena: &mut Arena<AExpr>,
     phys_sm: &mut DenseSlotMap<PhysNodeKey, PhysNode>,
-    expr_cache: &mut ExprCache,
+    expr_props: &mut ExprProperties,
     ctx: StreamingLowerIRContext<'_>,
 ) -> PolarsResult<PhysStream> {
     let mut ctx = LowerExprContext {
         expr_arena,
         phys_sm,
-        cache: expr_cache,
+        expr_props,
         prepare_visualization: ctx.prepare_visualization,
         sortedness: ctx.sortedness,
-        node_scratch: &mut Default::default(),
-        ae_height_scratch: &mut Default::default(),
     };
     build_filter_stream_with_ctx(input, predicate, &mut ctx)
 }
@@ -110,7 +108,10 @@ pub(crate) fn build_filter_stream_with_ctx(
 ) -> PolarsResult<PhysStream> {
     let input_schema = input.output_schema(ctx.phys_sm).clone();
 
-    if is_elementwise_rec_cached(predicate.node(), ctx.expr_arena, ctx.cache) {
+    if ctx
+        .expr_props
+        .is_elementwise(predicate.node(), ctx.expr_arena)
+    {
         let kind = PhysNodeKind::Filter {
             input,
             predicate,
@@ -233,7 +234,7 @@ pub fn lower_ir(
     phys_to_ir: &mut SecondaryMap<PhysNodeKey, Node>,
     original_ir_len: usize,
     schema_cache: &mut PlHashMap<Node, Arc<Schema>>,
-    expr_cache: &mut ExprCache,
+    expr_props: &mut ExprProperties,
     cache_nodes: &mut PlHashMap<UniqueId, PhysStream>,
     ctx: StreamingLowerIRContext<'_>,
     disable_morsel_split: Option<bool>,
@@ -248,7 +249,7 @@ pub fn lower_ir(
         phys_to_ir,
         original_ir_len,
         schema_cache,
-        expr_cache,
+        expr_props,
         cache_nodes,
         ctx,
         disable_morsel_split,
@@ -276,7 +277,7 @@ fn lower_ir_inner(
     phys_to_ir: &mut SecondaryMap<PhysNodeKey, Node>,
     original_ir_len: usize,
     schema_cache: &mut PlHashMap<Node, Arc<Schema>>,
-    expr_cache: &mut ExprCache,
+    expr_props: &mut ExprProperties,
     cache_nodes: &mut PlHashMap<UniqueId, PhysStream>,
     ctx: StreamingLowerIRContext<'_>,
     mut disable_morsel_split: Option<bool>,
@@ -296,7 +297,7 @@ fn lower_ir_inner(
                 phys_to_ir,
                 original_ir_len,
                 schema_cache,
-                expr_cache,
+                expr_props,
                 cache_nodes,
                 ctx,
                 disable_morsel_split,
@@ -340,7 +341,7 @@ fn lower_ir_inner(
 
             let phys_input = lower_ir!(*input)?;
             return build_select_stream(
-                phys_input, &selectors, expr_arena, phys_sm, expr_cache, ctx,
+                phys_input, &selectors, expr_arena, phys_sm, expr_props, ctx,
             );
         },
 
@@ -391,7 +392,7 @@ fn lower_ir_inner(
         IR::HStack { input, exprs, .. } | IR::Window { input, exprs, .. } => {
             let exprs = exprs.to_vec();
             let phys_input = lower_ir!(*input)?;
-            return build_hstack_stream(phys_input, &exprs, expr_arena, phys_sm, expr_cache, ctx);
+            return build_hstack_stream(phys_input, &exprs, expr_arena, phys_sm, expr_props, ctx);
         },
 
         IR::Slice { input, slice } => {
@@ -404,7 +405,7 @@ fn lower_ir_inner(
             let predicate = predicate.clone();
             let phys_input = lower_ir!(*input)?;
             return build_filter_stream(
-                phys_input, predicate, expr_arena, phys_sm, expr_cache, ctx,
+                phys_input, predicate, expr_arena, phys_sm, expr_props, ctx,
             );
         },
 
@@ -609,7 +610,7 @@ fn lower_ir_inner(
                     AExprBuilder::col(key[0].clone(), expr_arena).expr_ir(key_name.clone())
                 };
 
-                *s = build_hstack_stream(*s, &[key_expr], expr_arena, phys_sm, expr_cache, ctx)?;
+                *s = build_hstack_stream(*s, &[key_expr], expr_arena, phys_sm, expr_props, ctx)?;
             }
 
             PhysNodeKind::MergeSorted {
@@ -757,7 +758,7 @@ fn lower_ir_inner(
                 }));
                 let trans_exprs;
                 (stream, trans_exprs) =
-                    lower_exprs(stream, &exprs, expr_arena, phys_sm, expr_cache, ctx)?;
+                    lower_exprs(stream, &exprs, expr_arena, phys_sm, expr_props, ctx)?;
                 output_exprs = trans_exprs[..output_exprs.len()].to_vec();
                 trans_expr
```

#### Recent Merged Pull Requests:
- **PR #31122** (2026-11-26): feat: Add memory budget to pl.Config (@ritchie46)
- **PR #31120** (closed): fix: Reject temporal duration bounds in is_between (@faizal4757)
- **PR #31112** (2026-11-26): chore: Bump unicode-width to 0.2.3 (@orlp)
- **PR #31111** (2026-11-26): perf: Improve Polars import time (@orlp)
- **PR #31108** (2026-11-25): fix: Don't mark naive <-> tz-aware datetime cast as lossless (@orlp)
- **PR #31106** (2026-11-25): perf: Use SIMD kernels for nan_min/nan_max, native skew/kurtosis and cheaper integer casts (@ritchie46)

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

## X. Raise on non-numeric `hist` bins instead of panicking

**RULE**:
When implementing operations in `crates/polars-ops/src/chunked_array/hist.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c2bb320e`: Raise on non-numeric `hist` bins instead of panicking. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/polars-ops/src/chunked_array/hist.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                // `Null` is the dtype of empty bins, e.g. `bins=[]` from Python.
                polars_ensure!(
                    bins.dtype().is_numeric() || bins.dtype().is_null(),
                    InvalidOperation: "`hist` bins must be numeric, got dtype `{}`", bins.dtype()
                );
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c2bb320e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
