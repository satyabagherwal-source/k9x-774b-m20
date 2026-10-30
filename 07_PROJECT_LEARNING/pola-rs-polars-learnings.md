> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source**: github ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Source Version**: `ee5f3e7b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T21:06:25.517Z  
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
> **Harvest Timestamp**: 2026-10-30T21:06:16.509Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 40236 stars

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

    /// Consume and returns the numbers of `1` / `true` values at the beginning of the iterator.
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

    /// Consume and returns the numbers of `0` / `false` values that the start of the iterator.
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
        self.word_len -= n;

        let ret = self.word & 1 != 0;
        self.word >>= 1;
        self.word_len -= 1;
        Some(ret)
    }
}

impl DoubleEndedIterator for BitmapIter<'_> {
    #[inline]
    fn next_back(&mut self) -> Option<bool> {
        if self.rest_len > 0 {
            self.rest_len -= 1;
            Some(unsafe { get_bit_unchecked(self.bytes, self.rest_len) })
        } else if self.word_len > 0 {
            self.word_len -= 1;
            Some(self.word & (1 << self.word_len) != 0)
        } else {
            None
        }
    }
}

unsafe impl TrustedLen for BitmapIter<'_> {}
impl ExactSizeIterator for BitmapIter<'_> {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collect_into_17579() {
        let mut bitmap = MutableBitmap::with_c
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
/// The latter allows specializalizing to when there are no nulls
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
- **Issue #30447** (2026-10-30): **scan_delta returns deleted rows from partitions whose path is percent-encoded**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import tempfile import polars as pl from delta import configure_spark_with_delta_pip from pyspark.sql import SparkSession  spark = configure_spark_with_delta_pip(     SparkSession.builder.master("local[1]")     .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")     .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") ).getOrCreate()  for k in ["a b", "ab"]:     p = tempfile.mkdtemp()     spark.sql(f"CREATE TABLE delta.`{p}` (id BIGINT, k STRING) USING DELTA PARTITIONED BY (k) "               "TBLPROPERTIES ('delta.enableDeletionVectors' = 'true')")     spark.sql(f"INSERT INTO delta.`{p}` VALUES (1, '{k}'), (2, '{k}')")     spark.sql(f"DELETE FROM delta.`{p}` WHERE id = 2")     print(repr(k), pl.scan_delta(p).collect()["id"].to_list())  # 'a b' [1, 2], should be [1] # 'ab' [1] # Spark, duckdb's delta_scan and deltalake's QueryBuilder return [1] for both ```  ### Log output  ```shell  ```  ### Issue description  Currently, `_extract_delta_deletion_vectors` joins the scan paths from `file_uris()` to `deletion_vectors()["filepath"]` by string, but the first is decoded (`k=a b/part-...`) and the second keeps the log's encoding (`k=a%20b/part-...`), so those files get no deletion vector. Partition
  **Post-Mortem & Fix Analysis**:
  > (Drafted with an AI assistant, reviewed by me.)  I reproduced this with your exact Spark steps (pyspark 4.0.1, delta-spark 4.0.0) on polars 2.1.0 / deltalake 1.6.6, and also tried a few more partition values. In every case the two deltalake APIs disagree on the encoding:  ``` space   file_uris()               : ['.../tables/space/k=a b/part-00000-....snappy.parquet']   deletion_vectors filepath : ['file:///.../tables/space/k=a%20b/part-00000-....snappy.parquet'] percent   file_uris()               : ['.../tables/percent/k=50%25/part-00000-....snappy.parquet']   deletion_vectors filepath : ['file:///.../tables/percent/k=50%2525/part-00000-....snappy.parquet'] ```  So `filepath` is one URI-encoding level above `file_uris()`. A small fix in `_extract_delta_deletion_vectors` is to percent-decode `filepath` before the join:  ```diff --- a/py-polars/src/polars/io/delta/_dataset.py +++ b/py-polars/src/polars/io/delta/_dataset.py @@ -4,6 +4,7 @@  from dataclasses import dataclass  from functoo
  > Triage notes  A local Spark table with three rows `id = 1, 2, 3` and partition `k = "a b"`. `DELETE ... WHERE id = 2` stored the deletion as a deletion vector, so the expected result is `[1, 3]`.  `scan_delta` looks up each file's deletion vector by matching its scan path from `file_uris()` against `deletion_vectors()["filepath"]` as strings:  | | | |---|---| | scan path (`file_uris()`) | `<root>/k=a b/part-00000-bfac6324….parquet` | | deletion vector path | `<root>/k=a%20b/part-00000-bfac6324….parquet` | | match? | **no** | | `scan_delta` result | **`[1, 2, 3]`**, the deleted row comes back |  For local tables, deltalake decodes `file_uris()` below the table root, while the deletion vector path keeps the log's percent-encoding.  Found and generated with AI 

- **Issue #30432** (2026-10-30): **`sort` and `n_unique` wrong after a `rolling` `slice` with a per-window offset**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  df = pl.DataFrame({"t": range(5), "v": range(1, 6)}).sort("v") v = df.rolling("t", period="3i").agg(     pl.col("v").slice(pl.col("t").last() % 2, 1).first() )["v"]  print(v.to_list())         # [1, 2, 1, 3, 3] print(v.sort().to_list())  # [1, 2, 1, 3, 3], expected [1, 1, 2, 3, 3] print(v.n_unique())        # 4, expected 3 ```  ### Issue description  The result is not sorted but keeps the sorted flag of `v`, so `sort`, `n_unique` and `unique` on it are wrong. With a constant offset, e.g. `slice(1, 1)`, the result is correct.  ### Expected behavior  `v.sort().to_list() == [1, 1, 2, 3, 3]` and `v.n_unique() == 3`.  ### Installed versions  Reproduces on 2.1.0 and main.  Found and generated with AI 

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

### Incident Patch 1: `3e90bfa0` (2026-10-30)
**Commit Message**: fix: Fix segfaults and leaked references with Object values in group contexts (#30458)

**File**: `crates/polars-core/src/chunked_array/list/iterator.rs` (modified, +20/-1)
```diff
@@ -14,7 +14,7 @@ pub struct AmortizedListIter<'a, I: Iterator<Item = Option<ArrayBox>>> {
     inner: NonNull<ArrayRef>,
     lifetime: PhantomData<&'a ArrayRef>,
     iter: I,
-    // used only if feature="dtype-struct"
+    // used only if feature="dtype-struct" or feature="object"
     #[allow(dead_code)]
     inner_dtype: DataType,
 }
@@ -64,6 +64,25 @@ impl<I: Iterator<Item = Option<ArrayBox>>> Iterator for AmortizedListIter<'_, I>
                         return AmortSeries::new(self.series_container.clone());
                     }
                 }
+                #[cfg(feature = "object")]
+                // lists hold object values in an extension array, which only converts to the
+                // series' object array through `from_chunks_and_dtype_unchecked`; as for structs,
+                // `self.inner` is not used once the container is replaced
+                if matches!(self.inner_dtype, DataType::Object(_)) {
+                    // SAFETY:
+                    // dtype is known
+                    unsafe {
+                        let s = Series::from_chunks_and_dtype_unchecked(
+                            self.series_container.name().clone(),
+                            vec![array_ref],
+                            &self.inner_dtype,
+                        );
+                        let inner = Rc::make_mut(&mut self.series_container);
+                        *inner = s;
+
+                        return AmortSeries::new(self.series_container.clone());
+                    }
+                }
                 // The series is cloned, we make a new container.
                 if Arc::strong_count(&self.series_container.0) > 1
                     || Rc::strong_count(&self.series_container) > 1
```

**File**: `crates/polars-core/src/chunked_array/object/extension/mod.rs` (modified, +13/-10)
```diff
@@ -84,22 +84,25 @@ pub(crate) fn create_extension<I: Iterator<Item = Option<T>> + TrustedLen, T: Si
     for opt_t in iter.into_iter() {
         match opt_t {
             Some(t) => {
-                unsafe {
-                    buf.extend_from_slice(any_as_u8_slice(&t));
-                    // SAFETY: we allocated upfront
-                    validity.push_unchecked(true)
-                }
+                unsafe { buf.extend_from_slice(any_as_u8_slice(&t)) };
+                validity.push(true);
                 mem::forget(t);
             },
             None => {
-                unsafe {
-                    buf.extend_from_slice(any_as_u8_slice(&T::default()));
-                    // SAFETY: we allocated upfront
-                    validity.push_unchecked(false)
-                }
+                // The drop function frees this copy, so the original must not be dropped too.
+                let t = T::default();
+                unsafe { buf.extend_from_slice(any_as_u8_slice(&t)) };
+                validity.push(false);
+                mem::forget(t);
             },
         }
     }
+    // The drop function frees exactly `n_t_vals` values.
+    assert_eq!(
+        validity.len(),
+        n_t_vals,
+        "object iterator did not yield its declared length"
+    );
 
     // We slice the buffer because we want to ignore the padding bytes from here
     // they can be forgotten.
```

**File**: `crates/polars-core/src/frame/group_by/aggregations/agg_list.rs` (modified, +6/-4)
```diff
@@ -220,7 +220,8 @@ impl<T: PolarsObject> AggList for ObjectChunked<T> {
         let mut length_so_far = 0i64;
         offsets.push(length_so_far);
 
-        //  we know that iterators length
+        // The values of every group: `num_elements`, which differs from `self.len()` for groups
+        // that skip or repeat values.
         let iter = {
             groups
                 .iter()
@@ -248,10 +249,11 @@ impl<T: PolarsObject> AggList for ObjectChunked<T> {
                     // we know that offsets has allocated enough slots
                     offsets.push_unchecked(length_so_far);
 
-                    let arr = group_vals.downcast_iter().next().unwrap().clone();
-                    arr.into_iter_cloned()
+                    // A slice can span several chunks.
+                    let arrs = group_vals.downcast_iter().cloned().collect::<Vec<_>>();
+                    arrs.into_iter().flat_map(|arr| arr.into_iter_cloned())
                 })
-                .trust_my_length(self.len())
+                .trust_my_length(groups.num_elements())
         };
 
         let mut pe = create_extension(iter);
```

**File**: `py-polars/tests/unit/datatypes/test_object.py` (modified, +91/-0)
```diff
@@ -1,7 +1,9 @@
 from __future__ import annotations
 
 import io
+import sys
 from pathlib import Path
+from typing import TYPE_CHECKING
 from uuid import uuid4
 
 import numpy as np
@@ -11,6 +13,9 @@
 from polars.exceptions import ComputeError
 from polars.testing import assert_series_equal
 
+if TYPE_CHECKING:
+    from polars._typing import EngineType
+
 
 def test_series_init_instantiated_object() -> None:
     s = pl.Series([object(), object()], dtype=pl.Object())
@@ -309,3 +314,89 @@ def test_implode_object_raises() -> None:
 
     with pytest.raises(pl.exceptions.InvalidOperationError, match="nested objects"):
         df.select(pl.col("obj").implode())
+
+
+@pytest.mark.parametrize("engine", ["in-memory", "streaming"])
+def test_object_groups_skipping_values(engine: EngineType) -> None:
+    # Groups that skip values gather only those, not as many as the column holds.
+    lf = pl.LazyFrame(
+        {
+            "g": [0, 1, 0, 1, 0, 1],
+            "x": [1, -2, 3, 4, -5, 6],
+            "v": pl.Series(["a", "b", None, "d", "e", None], dtype=pl.Object),
+        }
+    )
+    v, x = pl.col.v, pl.col.x
+    out = (
+        lf.group_by("g", maintain_order=True)
+        .agg(filter=v.filter(x > 0).shift(1).last(), head=v.head(2).shift(1).last())
+        .collect(engine=engine)
+    )
+    assert out["filter"].to_list() == ["a", "d"]
+    assert out["head"].to_list() == ["a", "b"]
+
+    out = lf.select(v.filter(x > 0).shift(1).len().over("g")).collect(engine=engine)
+    assert out["v"].to_list() == [2] * 6
+
+
+@pytest.mark.parametrize("engine", ["in-memory", "streaming"])
+def test_object_group_slice_spanning_chunks(engine: EngineType) -> None:
+    a = pl.DataFrame(
+        {"g": [0, 0, 0], "v": pl.Series(["a", None, "c"], dtype=pl.Object)}
+    )
+    b = pl.DataFrame(
+        {"g": [0, 1, 1], "v": pl.Series(["d", "e", None], dtype=pl.Object)}
+    )
+    df = pl.concat([a, b], rechunk=False).with_columns(pl.col.g.set_sorted())
+    out = df.lazy().select(pl.col.v.shift(1).over("g")).collect(engine=engine)
+    assert out["v"].to_list() == [None, "a", None, "c", None, "e"]
+
+
+def test_object_overlapping_windows_references() -> None:
+    # Windows repeat values: every gathered value must be released again.
+    objs = [object() for _ in range(100)]
+    before = [sys.getrefcount(o) for o in objs]
+    df = pl.DataFrame({"t": range(100), "v": pl.Series(objs, dtype=pl.Object)})
+    out = df.rolling("t", period="10i").agg(pl.col.v.gather([0]).first())
+    assert out["v"].to_list() == [objs[max(0, i - 9)] for i in range(100)]
+    del out, df
+    after = [sys.getrefcount(o) for o in objs]
+    assert after == before
+
+
+@pytest.mark.parametrize("engine", ["in-memory", "streaming"])
+@pytest.mark.parametrize("sorted_keys", [False, True])
+def test_object_gather_in_groups(engine: EngineType, sorted_keys: bool) -> None:
+    # Each group's values reach `gather` as an object series, also after the first.
+    g = [0, 0, 0, 1, 1, 1] if sorted_keys else [0, 1, 0, 1, 0, 1]
+    df = pl.DataFrame(
+        {"g": g, "v": pl.Series(["a", None, "c", "d", "e", "f"], dtype=pl.Object)}
+    )
+    if sorted_keys:
+        df = df.with_columns(pl.col.g.set_sorted())
+    v = pl.col.v.gather([1, 0])
+    out = (
+        df.lazy()
+        .group_by("g", maintain_order=True)
+        .agg(first=v.first(), last=v.last())
+        .collect(engine=engine)
+    )
+    if sorted_keys:
+        assert out["first"].to_list() == [None, "e"]
+        assert out["last"].to_list() == ["a", "d"]
+    else:
+        assert out["first"].to_list() == ["c", "d"]
+        assert out["last"].to_list() == ["a", None]
+
+
+def test_object_null_slots_release_none_once() -> None:
+    # Each null slot of an object list is released once; visible before Python 3.12,
+    # where `None` is not immortal and a double release takes references from it.
+    df = pl.DataFrame(
+        {"g": [0, 1] * 500, "v": pl.Series([None] * 1000, dtype=pl.Object)}
+    )
+    before = sys.getrefcount(None)
+    out = df.lazy().select(pl.col.v.shift(1).over("g")).collect()
+    del out
+    after = sys.getrefcount(None)
+    assert after - before > -100
```

---

### Incident Patch 2: `22c1bb73` (2026-10-30)
**Commit Message**: fix: Clear the sorted flag of aggregated literals with empty groups (#30461)

**File**: `crates/polars-core/src/frame/column/mod.rs` (modified, +8/-1)
```diff
@@ -18,6 +18,8 @@ use self::series::SeriesColumn;
 use crate::chunked_array::cast::CastOptions;
 use crate::chunked_array::flags::StatisticsFlags;
 use crate::datatypes::ReshapeDimension;
+#[cfg(feature = "algorithm_group_by")]
+use crate::frame::group_by::aggregations::nulls_at_one_end;
 use crate::prelude::*;
 use crate::series::{BitRepr, IsSorted};
 use crate::utils::Container;
@@ -790,7 +792,12 @@ impl Column {
 
                 // Use dtype-aware validity updates so Struct fields see the nulls.
                 let s = scalar_col.take_materialized_series().rechunk();
-                s.with_validity(validity.into_opt_validity()).into_column()
+                let mut out = s.with_validity(validity.into_opt_validity());
+                // The values are equal, so the result is sorted only if its nulls are at one end.
+                if !nulls_at_one_end(&out) {
+                    out.set_sorted_flag(IsSorted::Not);
+                }
+                out.into_column()
             },
         }
     }
```

**File**: `crates/polars-core/src/frame/group_by/aggregations/dispatch.rs` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ use crate::prelude::row_encode::encode_rows_unordered;
 const N_UNIQUE_SORT_FALLBACK_THRESHOLD: usize = 16384;
 
 /// Whether the nulls of `s`, if any, are all at its start or all at its end.
-fn nulls_at_one_end(s: &Series) -> bool {
+pub(crate) fn nulls_at_one_end(s: &Series) -> bool {
     let null_count = s.null_count();
     if null_count == 0 {
         return true;
```

**File**: `crates/polars-core/src/frame/group_by/aggregations/mod.rs` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ mod string;
 use std::borrow::Cow;
 
 pub use agg_list::*;
+pub(crate) use dispatch::nulls_at_one_end;
 use num_traits::pow::Pow;
 use num_traits::{Bounded, Float, Num, NumCast, ToPrimitive, Zero};
 use polars_arrow::bitmap::{Bitmap, MutableBitmap};
```

**File**: `py-polars/tests/unit/operations/test_group_by.py` (modified, +48/-0)
```diff
@@ -3770,3 +3770,51 @@ def s(e: pl.Expr) -> pl.Expr:
         .agg(pl.col(list(exprs(over=True))))
     )
     assert_frame_equal(out.collect(engine=engine), expected.collect(engine=engine))
+
+
+@pytest.mark.parametrize(
+    "agg",
+    [
+        Expr.first,
+        Expr.last,
+        lambda e: e.first(ignore_nulls=True),
+        lambda e: e.last(ignore_nulls=True),
+        Expr.min,
+        Expr.max,
+        Expr.mean,
+        Expr.median,
+        Expr.bitwise_and,
+        Expr.bitwise_or,
+    ],
+)
+@pytest.mark.parametrize(
+    ("keep", "is_sorted"),
+    [
+        ([True, False, True, False], False),
+        ([False, True, True, False], False),
+        ([True, True, False, False], True),
+        ([False, False, True, True], True),
+    ],
+)
+def test_group_by_literal_agg_empty_groups_sorted_flag_30326(
+    agg: Callable[[Expr], Expr], keep: list[bool], is_sorted: bool
+) -> None:
+    df = pl.DataFrame({"g": [1, 2, 3, 4], "keep": keep}).with_columns(v=pl.lit(5))
+    v = df.group_by("g", maintain_order=True).agg(agg(pl.col("v").filter("keep")))["v"]
+
+    assert v.to_list() == [5 if k else None for k in keep]
+    assert v.flags["SORTED_ASC"] == is_sorted
+    assert v.max() == 5
+    assert v.n_unique() == 2
+    assert v.unique().sort().to_list() == [None, 5]
+
+
+def test_group_by_literal_agg_empty_groups_categorical_30326() -> None:
+    df = pl.DataFrame({"g": [1, 2, 3, 4], "keep": [True, False, True, False]})
+    df = df.with_columns(v=pl.lit("x", dtype=pl.Categorical))
+    out = df.group_by("g", maintain_order=True).agg(pl.col("v").filter("keep").first())
+    v = out["v"]
+
+    # The sorted flag sits on the physical, which `flags` does not show.
+    assert v.n_unique() == 2
+    assert v.unique().len() == 2
```

---

### Incident Patch 3: `0260c775` (2026-10-30)
**Commit Message**: fix(python): Correct `scalar // Series` and `DataFrame` floordiv (#30452)

**File**: `crates/polars-core/src/frame/arithmetic.rs` (modified, +2/-1)
```diff
@@ -107,7 +107,8 @@ impl Rem<&Series> for DataFrame {
 }
 
 impl DataFrame {
-    fn binary_aligned(
+    /// Applies `f` to positionally aligned column pairs, cast to their supertype.
+    pub fn binary_aligned(
         &self,
         other: &DataFrame,
         f: &(dyn Fn(&Series, &Series) -> PolarsResult<Series> + Sync + Send),
```

**File**: `crates/polars-python/src/dataframe/general.rs` (modified, +8/-0)
```diff
@@ -87,6 +87,14 @@ impl PyDataFrame {
         py.enter_polars_df(|| &*self.df.read() / &*s.df.read())
     }
 
+    pub fn floordiv_df(&self, py: Python<'_>, s: &Self) -> PyResult<Self> {
+        py.enter_polars_df(|| {
+            self.df
+                .read()
+                .binary_aligned(&s.df.read(), &polars_ops::prelude::floor_div_series)
+        })
+    }
+
     pub fn rem_df(&self, py: Python<'_>, s: &Self) -> PyResult<Self> {
         py.enter_polars_df(|| &*self.df.read() % &*s.df.read())
     }
```

**File**: `py-polars/src/polars/_plr.pyi` (modified, +1/-0)
```diff
@@ -598,6 +598,7 @@ class PyDataFrame:
     def sub_df(self, s: PyDataFrame) -> PyDataFrame: ...
     def mul_df(self, s: PyDataFrame) -> PyDataFrame: ...
     def div_df(self, s: PyDataFrame) -> PyDataFrame: ...
+    def floordiv_df(self, s: PyDataFrame) -> PyDataFrame: ...
     def rem_df(self, s: PyDataFrame) -> PyDataFrame: ...
     def sample_n(
         self,
```

**File**: `py-polars/src/polars/dataframe/frame.py` (modified, +13/-20)
```diff
@@ -1132,26 +1132,19 @@ def _div(self, other: Any, *, floordiv: bool) -> DataFrame:
             s = _prepare_other_arg(other, length=self.height)
             other = DataFrame([s.alias(f"n{i}") for i in range(self.width)])
 
-        orig_dtypes = other.dtypes
-        # TODO: Dispatch to a native floordiv
-        other = self._cast_all_from_to(other, INTEGER_DTYPES, Float64)
-        df = self._from_pydf(self._df.div_df(other._df))
-
-        df = (
-            df
-            if not floordiv
-            else df.with_columns([s.floor() for s in df if s.dtype.is_float()])
-        )
-        if floordiv:
-            int_casts = [
-                col(column).cast(tp)
-                for i, (column, tp) in enumerate(self.schema.items())
-                if tp.is_integer()
-                and (orig_dtypes[i].is_integer() or orig_dtypes[i] == Null)
-            ]
-            if int_casts:
-                return df.with_columns(int_casts)
-        return df
+        if not floordiv:
+            other = self._cast_all_from_to(other, INTEGER_DTYPES, Float64)
+            return self._from_pydf(self._df.div_df(other._df))
+
+        df = self._from_pydf(self._df.floordiv_df(other._df))
+        int_casts = [
+            col(column).cast(tp)
+            for (column, tp), other_tp in zip(
+                self.schema.items(), other.dtypes, strict=False
+            )
+            if tp.is_integer() and (other_tp.is_integer() or other_tp == Null)
+        ]
+        return df.with_columns(int_casts) if int_casts else df
 
     def _cast_all_from_to(
         self, df: DataFrame, from_: frozenset[PolarsDataType], to: PolarsDataType
```

**File**: `py-polars/src/polars/series/series.py` (modified, +8/-2)
```diff
@@ -1264,13 +1264,19 @@ def __rtruediv__(self, other: Any) -> Series:
             other = float(other)
         if self.dtype != String:
             self = self.cast(Float64)
-        return self.__rfloordiv__(other)
+        return self._arithmetic(other, "div", "div_<>_rhs")
 
     def __rfloordiv__(self, other: Any) -> Series:
         if self.dtype.is_temporal():
             msg = "first cast to integer before dividing datelike dtypes"
             raise TypeError(msg)
-        return self._arithmetic(other, "div", "div_<>_rhs")
+        if isinstance(other, Series):
+            return other // self
+        return (
+            self.to_frame()
+            .select_seq((F.lit(other) // F.col(self.name)).alias(self.name))
+            .to_series()
+        )
 
     def __rmul__(self, other: Any) -> Series:
         if self.dtype.is_temporal() and not isinstance(self.dtype, Duration):
```

**File**: `py-polars/tests/unit/operations/arithmetic/test_arithmetic.py` (modified, +57/-1)
```diff
@@ -1,11 +1,13 @@
 from __future__ import annotations
 
+import math
 import operator
 import re
 from collections import OrderedDict
 from datetime import date, datetime, timedelta
 from decimal import Decimal
 from decimal import Decimal as PyDecimal
+from fractions import Fraction
 from typing import TYPE_CHECKING, Any
 
 import numpy as np
@@ -244,6 +246,30 @@ def test_floor_division_float_int_consistency() -> None:
     )
 
 
+@pytest.mark.parametrize(
+    ("lhs", "values", "dtype"),
+    [
+        (-7, [2, -2, 3, -3], pl.Int64),
+        (7, [2, -2, 3, -3], pl.Int8),
+        (-7, [2, -2, 3, -3], pl.Int128),
+        (-7, [2, 3], pl.UInt8),
+        (-7.5, [2.0, -2.0, 0.5, -4.0], pl.Float64),
+        (7, [2.0, -2.0], pl.Float32),
+        (PyDecimal("-7.25"), [PyDecimal("2"), PyDecimal("-0.5")], pl.Decimal(10, 2)),
+    ],
+)
+def test_series_rfloordiv(lhs: Any, values: list[Any], dtype: PolarsDataType) -> None:
+    s = pl.Series("s", values, dtype=dtype)
+    out = lhs // s
+    assert out.name == "s"
+    assert out.dtype == s.to_frame().select(lhs // pl.col("s")).to_series().dtype
+    expected = [math.floor(Fraction(lhs) / Fraction(v)) for v in values]
+    assert [Fraction(v) for v in out.to_list()] == expected
+
+    # true division is unaffected
+    assert (lhs / s).to_list() == pytest.approx([float(lhs) / float(v) for v in values])
+
+
 def test_truncdiv_int() -> None:
     lf = pl.LazyFrame(
         {
@@ -626,6 +652,32 @@ def test_df_series_division() -> None:
     }
 
 
+def test_df_floordiv() -> None:
+    big = 2**62 + 1
+    df = pl.DataFrame(
+        {
+            "i": [big, -big],
+            "i8": [7, -7],
+            "f": [7.5, -7.5],
+            "d": [PyDecimal("7.5"), PyDecimal("-7.5")],
+        },
+        schema={"i": pl.Int64, "i8": pl.Int8, "f": pl.Float32, "d": pl.Decimal(10, 2)},
+    )
+    expected = {
+        "i": [big // 3, -big // 3],
+        "i8": [2, -3],
+        "f": [2.0, -3.0],
+        "d": [PyDecimal("2"), PyDecimal("-3")],
+    }
+    by_scalar = df // 3
+    by_frame = df // pl.DataFrame({k: [3, 3] for k in "abcd"})
+    for out in (by_scalar, by_frame):
+        assert out.to_dict(as_series=False) == expected
+        assert out.schema["i"] == pl.Int64
+        assert out.schema["i8"] == pl.Int8
+        assert out.schema["d"].is_decimal()
+
+
 @pytest.mark.parametrize(
     "s", [pl.Series([1, 2], dtype=Int64), pl.Series([1, 2], dtype=Float64)]
 )
@@ -648,15 +700,19 @@ def test_arithmetic_series(s: pl.Series) -> None:
 
     # integer division
     assert_series_equal(1 / a, pl.Series([1.0, 0.5]))
-    expected = pl.Series([1, 0]) if s.dtype == Int64 else pl.Series([1.0, 0.5])
+    expected = pl.Series([1, 0]) if s.dtype == Int64 else pl.Series([1.0, 0.0])
     assert_series_equal(1 // a, expected)
+
     # modulo
     assert ((1 % a) == [0, 1]).sum() == 2
     assert ((a % 1) == [0, 0]).sum() == 2
+
     # negate
     assert (-a == [-1, -2]).sum() == 2
+
     # unary plus
     assert (+a == a).all()
+
     # wrong dtypes in rhs operands
     assert ((1.0 - a) == [0.0, -1.0]).sum() == 2
     assert ((1.0 / a) == [1.0, 0.5]).sum() == 2
```

#### Recent Merged Pull Requests:
- **PR #30467** (2026-10-30): feat: Support SQL derived tables that read the relations joined before them (LATERAL) (@ritchie46)
- **PR #30466** (2026-10-30): feat: Support correlated SQL EXISTS with HAVING or with outer-only subquery conditions (@ritchie46)
- **PR #30464** (2026-10-30): fix: Coerce SQL temporal strings, set operation columns, and untyped join keys to a common type (@ritchie46)
- **PR #30463** (2026-10-30): feat: Support SQL `INSERT INTO` and `INSERT OVERWRITE` on attached Iceberg catalog tables (@kdn36)
- **PR #30461** (2026-10-30): fix: Clear the sorted flag of aggregated literals with empty groups (@kdn36)
- **PR #30459** (2026-10-30): feat: Support LIMIT and outer ORDER BY keys in correlated SQL subqueries (@ritchie46)

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

## X. Fix segfaults and leaked references with Object values in group contexts (#30458

**RULE**:
When implementing operations in `crates/polars-core/src/chunked_array/list/iterator.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3e90bfa0`: Fix segfaults and leaked references with Object values in group contexts (#30458). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/polars-core/src/chunked_array/list/iterator.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    // used only if feature="dtype-struct" or feature="object"
                #[cfg(feature = "object")]
                // lists hold object values in an extension array, which only converts to the
                // series' object array through `from_chunks_and_dtype_unchecked`; as for structs,
                // `self.inner` is not used once the container is replaced
                if matches!(self.inner_dtype, DataType::Object(_)) {
                    // SAFETY:
                    // dtype is known
                    unsafe {
                        let s = Series::from_chunks_and_dtype_unchecked(
                            self.series_container.name().clone(),
                            vec![array_ref],
                            &self.inner_dtype,
                        );
                        let inner = Rc::make_mut(&mut self.series_container);
                        *inner = s;

                        return AmortSeries::new(self.series_container.clone());
                    }
                }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    // used only if feature="dtype-struct"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3e90bfa0` are properly handled with clean fallback behavior.
