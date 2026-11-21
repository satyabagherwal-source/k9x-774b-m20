> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source**: github ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Source Version**: `34f40615`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T03:36:37.117Z  
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
> **Harvest Timestamp**: 2026-11-21T03:36:36.937Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 40407 stars

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
- **Issue #30922** (2026-11-20): **is_in with series.implode() doesn't do Parquet row group skipping**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import os os.environ["POLARS_VERBOSE"] = "1" import polars as pl  pl.DataFrame({"job_id": range(100_000)}).write_parquet("data.parquet", row_group_size=10_000)  ids = pl.Series([30_005, 30_500, 31_234]) df = pl.scan_parquet("data.parquet").filter(pl.col("job_id").is_in(ids.implode())).collect() ```    ### Log output  ```shell total memory: 62.691 GiB (67313618944 bytes) _init_credential_provider_builder(): credential_provider_init = None async thread count: 24 blocking thread count: 512 polars-stream: updating graph state updating io-sink[single-file[parquet]], before: [Blocked] [] updating io-sink[single-file[parquet]], after: [Ready] [] (took 70ns) updating in-memory-source, before: [] [Ready] updating in-memory-source, after: [] [Ready] (took 2.816µs) updating io-sink[single-file[parquet]], before: [Ready] [] updating io-sink[single-file[parquet]], after: [Ready] [] (took 50ns) polars-stream: running in-memory-source in subgraph polars-stream: running io-sink[single-file[parquet]] in subgraph io-sink[single-file[parquet]]: start_single_file_sink_pipeline: file_writer_starter: parquet, target_sink_morsel_size: TargetSinkMorselSize { target_num_rows: 10000, target_num_bytes: 18446744073709551615, target_num_bytes_min_rows: 16384, target_num_rows_mode: Ex

- **Issue #30916** (2026-11-20): **`scan_arrow_c_stream` (and `pl.defer`) apply pushed-down predicate before `n_rows`, giving wrong results for `.limit(n).filter(...)`**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  df = pl.DataFrame({"a": [1, 2, 3, 4, 5, 6], "b": ["x", "y", "z", "a", "b", "c"]})  expected = df.lazy().limit(3).filter(pl.col("a") > 2).collect() actual_stream = pl.scan_arrow_c_stream(df).limit(3).filter(pl.col("a") > 2).collect() actual_defer = pl.defer(lambda: df, schema=df.schema).limit(3).filter(pl.col("a") > 2).collect() no_pushdown = (     pl.scan_arrow_c_stream(df)     .limit(3)     .filter(pl.col("a") > 2)     .collect(optimizations=pl.QueryOptFlags(predicate_pushdown=False)) )  print("expected:     ", expected["a"].to_list()) # expected:      [3] print("arrow_stream: ", actual_stream["a"].to_list()) # arrow_stream:  [3, 4, 5] print("defer:        ", actual_defer["a"].to_list()) # defer:         [3, 4, 5] print("no_pushdown:  ", no_pushdown["a"].to_list()) # no_pushdown:   [3]  print() print(pl.scan_arrow_c_stream(df).limit(3).filter(pl.col("a") > 2).explain()) """ PYTHON SCAN [] PROJECT */2 COLUMNS SELECTION: col("a") > 2 SLICE: Positive { offset: 0, len: 3 } """ ```   ### Log output  ```shell total memory: 117.901 GiB (126595493888 bytes) async thread count: 32 blocking thread count: 512 polars-stream: updating graph state updating in-memory-sink, before: [Blocked] [] updating in-memory-sink, after: [Ready] [] (took 270ns)

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

### Incident Patch 1: `70eaa1b9` (2026-11-20)
**Commit Message**: fix: Don't panic on extreme counts in string, binary and list slicing (#30940)

**File**: `crates/polars-arrow/src/legacy/index.rs` (modified, +3/-11)
```diff
@@ -26,18 +26,10 @@ where
     #[inline]
     fn negative_to_usize(self, len: usize) -> Option<usize> {
         if self >= Zero::zero() {
-            if (self.to_usize().unwrap()) < len {
-                Some(self.to_usize().unwrap())
-            } else {
-                None
-            }
+            self.to_usize().filter(|idx| *idx < len)
         } else {
-            let subtract = self.abs().to_usize().unwrap();
-            if subtract > len {
-                None
-            } else {
-                Some(len - subtract)
-            }
+            let subtract = usize::try_from(self.to_i128()?.unsigned_abs()).ok()?;
+            len.checked_sub(subtract)
         }
     }
 }
```

**File**: `crates/polars-ops/src/chunked_array/binary/namespace.rs` (modified, +2/-2)
```diff
@@ -90,7 +90,7 @@ pub trait BinaryNameSpaceImpl: AsBinary {
     /// element. `n` can be negative, in which case the slice ends `n` bytes from the end.
     fn bin_head(&self, n: &Column) -> PolarsResult<BinaryChunked> {
         let ca = self.as_binary();
-        let n = n.strict_cast(&DataType::Int64)?;
+        let n = crate::chunked_array::count_as_i64(n, ca.len())?;
 
         super::slice::head(ca, n.i64()?)
     }
@@ -101,7 +101,7 @@ pub trait BinaryNameSpaceImpl: AsBinary {
     /// negative, in which case the slice begins `n` bytes from the start.
     fn bin_tail(&self, n: &Column) -> PolarsResult<BinaryChunked> {
         let ca = self.as_binary();
-        let n = n.strict_cast(&DataType::Int64)?;
+        let n = crate::chunked_array::count_as_i64(n, ca.len())?;
 
         super::slice::tail(ca, n.i64()?)
     }
```

**File**: `crates/polars-ops/src/chunked_array/binary/slice.rs` (modified, +16/-12)
```diff
@@ -4,6 +4,8 @@ use polars_core::prelude::arity::{binary_elementwise, ternary_elementwise, unary
 use polars_core::prelude::{BinaryChunked, ChunkFullNull, DataType, Int64Chunked, UInt64Chunked};
 use polars_error::{PolarsResult, polars_ensure};
 
+use crate::chunked_array::saturating_usize;
+
 fn head_binary(opt_bytes: Option<&[u8]>, opt_n: Option<i64>) -> Option<&[u8]> {
     if let (Some(bytes), Some(n)) = (opt_bytes, opt_n) {
         let end_idx = head_binary_values(bytes, n);
@@ -18,11 +20,13 @@ fn head_binary_values(bytes: &[u8], n: i64) -> usize {
         Ordering::Equal => 0,
         Ordering::Greater => {
             // Take first n bytes
-            std::cmp::min(n as usize, bytes.len())
+            std::cmp::min(saturating_usize(n.unsigned_abs()), bytes.len())
         },
         Ordering::Less => {
             // End n bytes from the end
-            bytes.len().saturating_sub((-n) as usize)
+            bytes
+                .len()
+                .saturating_sub(saturating_usize(n.unsigned_abs()))
         },
     }
 }
@@ -43,11 +47,11 @@ fn tail_binary_values(bytes: &[u8], n: i64) -> usize {
         Ordering::Equal => max_len,
         Ordering::Greater => {
             // Start from nth byte from the end
-            max_len.saturating_sub(n as usize)
+            max_len.saturating_sub(saturating_usize(n.unsigned_abs()))
         },
         Ordering::Less => {
             // Start after the nth byte
-            std::cmp::min((-n) as usize, max_len)
+            std::cmp::min(saturating_usize(n.unsigned_abs()), max_len)
         },
     }
 }
@@ -73,21 +77,21 @@ pub fn slice_ternary_offsets_value(bytes: &[u8], offset: i64, length: u64) -> (u
     }
 
     let start_byte_offset = if offset >= 0 {
-        std::cmp::min(offset as usize, bytes.len())
+        std::cmp::min(saturating_usize(offset.unsigned_abs()), bytes.len())
     } else {
         // If `offset` is negative, it counts from the end
-        let abs_offset = (-offset) as usize;
-        if abs_offset > bytes.len() {
+        let abs_offset = offset.unsigned_abs();
+        let len = bytes.len() as u64;
+        if abs_offset > len {
             // Offset is before the start - handle length reduction
-            let length_reduction = abs_offset - bytes.len();
-            let adjusted_length = (length as usize).saturating_sub(length_reduction);
-            return (0, std::cmp::min(adjusted_length, bytes.len()));
+            let adjusted_length = length.saturating_sub(abs_offset - len);
+            return (0, std::cmp::min(adjusted_length, len) as usize);
         }
-        bytes.len() - abs_offset
+        bytes.len() - abs_offset as usize
     };
 
     let remaining = bytes.len() - start_byte_offset;
-    let end_byte_offset = start_byte_offset + std::cmp::min(length as usize, remaining);
+    let end_byte_offset = start_byte_offset + std::cmp::min(length, remaining as u64) as usize;
 
     (start_byte_offset, end_byte_offset)
 }
```

**File**: `crates/polars-ops/src/chunked_array/list/get.rs` (modified, +10/-2)
```diff
@@ -33,7 +33,11 @@ pub fn lst_get(ca: &ListChunked, index: &Int64Chunked, null_on_oob: bool) -> Pol
                             let (start, end) = unsafe {
                                 (*offsets.get_unchecked(i), *offsets.get_unchecked(i + 1))
                             };
-                            let offset = if idx >= 0 { start + idx } else { end + idx };
+                            let offset = if idx >= 0 {
+                                start.saturating_add(idx)
+                            } else {
+                                end + idx
+                            };
                             if offset >= end || offset < start || start == end {
                                 if null_on_oob {
                                     Ok(None)
@@ -57,7 +61,11 @@ pub fn lst_get(ca: &ListChunked, index: &Int64Chunked, null_on_oob: bool) -> Pol
                             let (start, end) = unsafe {
                                 (*offsets.get_unchecked(i), *offsets.get_unchecked(i + 1))
                             };
-                            let offset = if idx >= 0 { start + idx } else { end + idx };
+                            let offset = if idx >= 0 {
+                                start.saturating_add(idx)
+                            } else {
+                                end + idx
+                            };
                             if offset >= end || offset < start || start == end {
                                 if null_on_oob {
                                     Ok(None)
```

**File**: `crates/polars-ops/src/chunked_array/mod.rs` (modified, +25/-0)
```diff
@@ -46,3 +46,28 @@ pub use top_k::*;
 
 #[allow(unused_imports)]
 use crate::prelude::*;
+
+/// A count as `usize`; a count beyond `usize::MAX` covers any string or binary value the same way.
+pub(crate) fn saturating_usize(n: u64) -> usize {
+    usize::try_from(n).unwrap_or(usize::MAX)
+}
+
+/// `n` as Int64 counts for `len` values. A UInt64 count beyond the Int64 range is clipped, as
+/// it covers any value. A repeated count is returned once, so that it is applied as a scalar.
+pub(crate) fn count_as_i64(n: &Column, len: usize) -> PolarsResult<Column> {
+    let n = match n.as_scalar_column() {
+        Some(sc) if n.len() == len && len > 1 => &sc.as_single_value_series().into_column(),
+        _ => n,
+    };
+    match n.dtype() {
+        DataType::UInt64 => n.try_apply_unary_elementwise(|n| {
+            Ok(
+                arity::unary_elementwise_values::<_, Int64Type, _>(n.u64()?, |v| {
+                    v.min(i64::MAX as u64) as i64
+                })
+                .into_series(),
+            )
+        }),
+        _ => n.strict_cast(&DataType::Int64),
+    }
+}
```

**File**: `crates/polars-ops/src/chunked_array/strings/namespace.rs` (modified, +2/-2)
```diff
@@ -928,7 +928,7 @@ pub trait StringNameSpaceImpl: AsString {
     /// the end of the string.
     fn str_head(&self, n: &Column) -> PolarsResult<StringChunked> {
         let ca = self.as_string();
-        let n = n.strict_cast(&DataType::Int64)?;
+        let n = crate::chunked_array::count_as_i64(n, ca.len())?;
 
         substring::head(ca, n.i64()?)
     }
@@ -939,7 +939,7 @@ pub trait StringNameSpaceImpl: AsString {
     /// negative, in which case the slice begins `n` characters from the start of the string.
     fn str_tail(&self, n: &Column) -> PolarsResult<StringChunked> {
         let ca = self.as_string();
-        let n = n.strict_cast(&DataType::Int64)?;
+        let n = crate::chunked_array::count_as_i64(n, ca.len())?;
 
         substring::tail(ca, n.i64()?)
     }
```

**File**: `crates/polars-ops/src/chunked_array/strings/substring.rs` (modified, +20/-9)
```diff
@@ -4,6 +4,8 @@ use polars_core::prelude::{ChunkFullNull, Int64Chunked, StringChunked, UInt64Chu
 use polars_core::series::IsSorted;
 use polars_error::{PolarsResult, polars_ensure};
 
+use crate::chunked_array::saturating_usize;
+
 #[inline(always)]
 fn is_utf8_codepoint_start(b: u8) -> bool {
     // The top two bits of a continuation byte are 10. Any other value is a
@@ -131,10 +133,11 @@ fn head_binary(opt_str_val: Option<&str>, opt_n: Option<i64>) -> Option<&str> {
 }
 
 fn head_binary_values(str_val: &str, n: i64) -> usize {
+    let count = saturating_usize(n.unsigned_abs());
     if n >= 0 {
-        char_to_byte_idx(str_val, n as usize)
+        char_to_byte_idx(str_val, count)
     } else {
-        rev_char_to_byte_idx(str_val, (-n) as usize)
+        rev_char_to_byte_idx(str_val, count)
     }
 }
 
@@ -148,10 +151,11 @@ fn tail_binary(opt_str_val: Option<&str>, opt_n: Option<i64>) -> Option<&str> {
 }
 
 fn tail_binary_values(str_val: &str, n: i64) -> usize {
+    let count = saturating_usize(n.unsigned_abs());
     if n >= 0 {
-        rev_char_to_byte_idx(str_val, n as usize)
+        rev_char_to_byte_idx(str_val, count)
     } else {
-        char_to_byte_idx(str_val, (-n) as usize)
+        char_to_byte_idx(str_val, count)
     }
 }
 
@@ -190,18 +194,20 @@ pub fn substring_ternary_offsets_value(
             return (0, 0);
         }
 
-        match rev_char_to_byte_idx_or_cp_count(str_val, (-offset) as usize) {
+        let rev_offset = offset.unsigned_abs();
+        match rev_char_to_byte_idx_or_cp_count(str_val, saturating_usize(rev_offset)) {
             Ok(so) => so,
             Err(n_cp) => {
                 // Our offset was so negative it is before the start of our string.
                 // This means our length must be reduced, assuming it is finite.
-                length = length.saturating_sub((-offset) as u64 - n_cp as u64);
+                length = length.saturating_sub(rev_offset - n_cp as u64);
                 0
             },
         }
     };
 
-    let stop_byte_offset = char_to_byte_idx(&str_val[start_byte_offset..], length as usize);
+    let stop_byte_offset =
+        char_to_byte_idx(&str_val[start_byte_offset..], saturating_usize(length));
     (start_byte_offset, start_byte_offset + stop_byte_offset)
 }
 
@@ -311,12 +317,17 @@ pub(super) fn head(ca: &StringChunked, n: &Int64Chunked) -> PolarsResult<StringC
                 return Ok(StringChunked::full_null(ca.name().clone(), len));
             };
 
-            Ok(unsafe {
+            let mut out = unsafe {
                 ca.apply_views(|view, val| {
                     let end = head_binary_values(val, n);
                     update_view(view, 0, end, val)
                 })
-            })
+            };
+            // A prefix keeps the order, removing a suffix does not.
+            if n < 0 {
+                out.set_sorted_flag(IsSorted::Not);
+            }
+            Ok(out)
         },
         // TODO! below should also work on only views
         (1, _) => {
```

**File**: `py-polars/tests/unit/operations/namespaces/list/test_list.py` (modified, +17/-0)
```diff
@@ -1023,6 +1023,23 @@ def test_list_get_null_list_broadcast() -> None:
     assert out.to_series().to_list() == [None, None]
 
 
+@pytest.mark.parametrize("index", [-(2**63), 2**63 - 1])
+def test_list_get_extreme_index(index: int) -> None:
+    df = pl.DataFrame({"a": [[1], None, [], [1, 2]]})
+    out = df.select(
+        scalar=pl.col("a").list.get(index, null_on_oob=True),
+        column=pl.col("a").list.get(pl.repeat(index, 4), null_on_oob=True),
+    )
+    assert out.to_dict(as_series=False) == {
+        "scalar": [None] * 4,
+        "column": [None] * 4,
+    }
+    gets: list[int | pl.Expr] = [index, pl.repeat(index, 4)]
+    for get in gets:
+        with pytest.raises(ComputeError, match="out of bounds"):
+            df.select(pl.col("a").list.get(get))
+
+
 def test_list_get_with_null() -> None:
     df = pl.DataFrame({"a": [None, [1, 2]], "b": [False, True]})
 
```

---

### Incident Patch 2: `97b951d7` (2026-11-20)
**Commit Message**: fix: Raise instead of panicking on SQL GREATEST, LEAST and COALESCE without arguments (#30933)

**File**: `crates/polars-sql/src/functions.rs` (modified, +16/-10)
```diff
@@ -1759,10 +1759,8 @@ impl SQLFunctionVisitor<'_> {
             // ----
             // Conditional functions
             // ----
-            Coalesce => self.visit_temporal_variadic(coalesce),
-            Greatest => {
-                self.visit_temporal_variadic(|exprs: &[Expr]| max_horizontal(exprs).unwrap())
-            },
+            Coalesce => self.visit_temporal_variadic(|exprs: &[Expr]| Ok(coalesce(exprs))),
+            Greatest => self.visit_temporal_variadic(|exprs: &[Expr]| max_horizontal(exprs)),
             If => {
                 let args = extract_args(function)?;
                 match args.len() {
@@ -1778,21 +1776,21 @@ impl SQLFunctionVisitor<'_> {
             IfNull => {
                 let args = extract_args(function)?;
                 match args.len() {
-                    2 => self.visit_temporal_variadic(coalesce),
+                    2 => self.visit_temporal_variadic(|exprs: &[Expr]| Ok(coalesce(exprs))),
                     _ => {
                         polars_bail!(SQLSyntax: "IFNULL expects 2 arguments (found {})", args.len())
                     },
                 }
             },
-            Least => self.visit_temporal_variadic(|exprs: &[Expr]| min_horizontal(exprs).unwrap()),
+            Least => self.visit_temporal_variadic(|exprs: &[Expr]| min_horizontal(exprs)),
             NullIf => {
                 let args = extract_args(function)?;
                 match args.len() {
                     2 => self.visit_temporal_variadic(|exprs: &[Expr]| {
                         let [l, r] = exprs else { unreachable!() };
-                        when(l.clone().eq(r.clone()))
+                        Ok(when(l.clone().eq(r.clone()))
                             .then(lit(LiteralValue::untyped_null()))
-                            .otherwise(l.clone())
+                            .otherwise(l.clone()))
                     }),
                     _ => {
                         polars_bail!(SQLSyntax: "NULLIF expects 2 arguments (found {})", args.len())
@@ -3026,8 +3024,16 @@ impl SQLFunctionVisitor<'_> {
     /// [`Self::visit_variadic`] for a function whose arguments share one type: a string
     /// literal is read as a value of the common temporal type of the other arguments, as
     /// in `COALESCE(date_col, '2020-01-01')`.
-    fn visit_temporal_variadic(&mut self, f: impl Fn(&[Expr]) -> Expr) -> PolarsResult<Expr> {
+    fn visit_temporal_variadic(
+        &mut self,
+        f: impl Fn(&[Expr]) -> PolarsResult<Expr>,
+    ) -> PolarsResult<Expr> {
         let mut expr_args = self.parse_variadic_args()?;
+        polars_ensure!(
+            !expr_args.is_empty(),
+            SQLSyntax: "{} expects at least 1 argument (found 0)",
+            self.func.name.to_string().to_uppercase()
+        );
         let is_string_literal =
             |e: &Expr| matches!(e, Expr::Literal(lv) if lv.extract_str().is_some());
         if expr_args.iter().any(is_string_literal) {
@@ -3045,7 +3051,7 @@ impl SQLFunctionVisitor<'_> {
                 }
             }
         }
-        self.apply_window_spec(f(&expr_args))
+        self.apply_window_spec(f(&expr_args)?)
     }
 
     fn parse_variadic_args(&mut self) -> PolarsResult<Vec<Expr>> {
```

**File**: `py-polars/tests/unit/sql/test_conditional.py` (modified, +8/-0)
```diff
@@ -180,6 +180,14 @@ def test_greatest_least() -> None:
         )
 
 
+@pytest.mark.parametrize("func", ["GREATEST", "LEAST", "COALESCE"])
+def test_variadic_no_arguments(func: str) -> None:
+    with pytest.raises(
+        SQLSyntaxError, match=f"{func} expects at least 1 argument \\(found 0\\)"
+    ):
+        pl.sql(f"SELECT {func}() AS x").collect()
+
+
 @pytest.mark.parametrize(
     "expr",
     [
```

---

### Incident Patch 3: `b692ad84` (2026-11-20)
**Commit Message**: perf: Abandon stalled cloud reads after a stall timeout (#30966)

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -3437,6 +3437,7 @@ dependencies = [
  "futures",
  "glob",
  "hashbrown 0.17.1",
+ "http-body 1.1.0",
  "itoa",
  "libc",
  "memchr",
```

**File**: `crates/polars-io/Cargo.toml` (modified, +2/-0)
```diff
@@ -34,6 +34,7 @@ flate2 = { workspace = true, optional = true }
 futures = { workspace = true, optional = true }
 glob = { version = "0.3" }
 hashbrown = { workspace = true }
+http-body = { version = "1", optional = true }
 itoa = { workspace = true, optional = true }
 libc = { workspace = true }
 memchr = { workspace = true }
@@ -144,6 +145,7 @@ async = [
 ]
 cloud = [
   "object_store",
+  "dep:http-body",
   "async",
   "serde_json",
   "serde",
```

**File**: `crates/polars-io/src/cloud/http_rate_limit.rs` (modified, +24/-4)
```diff
@@ -45,13 +45,14 @@ use object_store::client::{
 use polars_core::runtime::ASYNC;
 use tokio::sync::oneshot;
 
+use super::stall_timer::{StallStats, StallTimer, TtfbMin};
 use super::token_bucket::TokenBucket;
 use crate::cloud::{CloudDirectionalRateLimitConfig, CloudRateLimitConfig};
 
 // For tracing purposes.
 static CONTROLLER_ID: AtomicU32 = AtomicU32::new(0);
 
-// Verbose.
+// Diagnostics; the format is unstable.
 static LOG_HTTP_RATE_LIMIT: LazyLock<bool> =
     LazyLock::new(|| std::env::var("POLARS_LOG_HTTP_RATE_LIMIT").is_ok());
 
@@ -312,6 +313,7 @@ pub(crate) struct RateState {
     pub admitted: Arc<AtomicU64>,
     // A throttle response was seen.
     pub throttled: Arc<AtomicBool>,
+    pub stall: Arc<StallStats>,
 }
 
 impl RateState {
@@ -321,6 +323,7 @@ impl RateState {
             max_bits: Arc::new(AtomicU64::new(f64::NAN.to_bits())),
             admitted: Arc::new(AtomicU64::new(0)),
             throttled: Arc::new(AtomicBool::new(false)),
+            stall: Arc::default(),
         }
     }
 
@@ -517,6 +520,7 @@ pub(crate) struct PacerSignal {
     // Cumulative HTTP response counters, since epoch.
     resp_succeeded: AtomicU64,
     resp_throttled: AtomicU64,
+    stall: Arc<StallStats>,
 }
 
 #[derive(Debug)]
@@ -561,6 +565,7 @@ impl AdaptiveRateController {
             last_cut_ns: AtomicU64::new(0),
             resp_succeeded: AtomicU64::new(0),
             resp_throttled: AtomicU64::new(0),
+            stall: Arc::clone(&shared.stall),
         };
 
         let state = Mutex::new(AimdState {
@@ -885,10 +890,12 @@ impl AdaptiveRateController {
         // Logging.
         let raises = std::mem::take(&mut state.raises);
         if *LOG_HTTP_RATE_LIMIT {
+            let stall = self.signal.stall.take();
             eprintln!(
                 "[http rate_limit #{}_{} {}] {}: rate: {:.1}, success_rate_ewma: {:.1}, last_max: {:.1}, \
                     elapsed: {:.1}s, win_admit: {}, win_deny: {}, win_success: {}, win_throttle: {},  q_depth: {}, \
-                    demand: {:.1}, raises: {}",
+                    demand: {:.1}, raises: {}, win_stall_hdr: {}, win_stall_body: {}, win_stall_refused: {}, \
+                    stall_t: {:.1}ms",
                 self.id,
                 self.label,
                 Utc::now(),
@@ -904,6 +911,10 @@ impl AdaptiveRateController {
                 self.pacer.queue_depth(),
                 state.demand.unwrap_or_default(),
                 raises,
+                stall.hdr_abandons,
+                stall.body_abandons,
+                stall.refused,
+                stall.t.as_secs_f64() * 1e3,
             );
         }
     }
@@ -1134,6 +1145,7 @@ impl HttpConnector for PacedHttpConnector {
         Ok(HttpClient::new(PacedHttpService {
             inner: client,
             controller: Arc::clone(&self.controller),
+            ttfb_min: TtfbMin::default(),
         }))
     }
 }
@@ -1142,6 +1154,7 @@ impl HttpConnector for PacedHttpConnector {
 pub(crate) struct PacedHttpService {
     inner: HttpClient,
     controller: Arc<RateController>,
+    ttfb_min: TtfbMin,
 }
 
 #[async_trait]
@@ -1154,7 +1167,11 @@ impl HttpService for PacedHttpService {
         // The object_store is responsible for retry.
         verb_pacer.pacer.admit().await?;
 
-        let response = self.inner.execute(req).await;
+        let stall_timer = StallTimer::start(&req, &self.ttfb_min, &verb_pacer.signal.stall);
+        let response = match &stall_timer {
+            Some(timer) => Box::pin(timer.headers(self.inner.execute(req))).await,
+            None => self.inner.execute(req).await,
+        };
         match &response {
             Ok(r) if r.status().as_u16() == 429 || r.status().as_u16() == 503 => {
                 verb_pacer.on_congestion()
@@ -1163,6 +1180,9 @@ impl HttpService for PacedHttpService {
             _ => verb_pacer.on_other(),
         }
 
-        response
+        match stall_timer {
+            Some(timer) => timer.body(response),
+            None => response,
+        }
     }
 }
```

**File**: `crates/polars-io/src/cloud/mod.rs` (modified, +2/-0)
```diff
@@ -31,4 +31,6 @@ mod http_origin_store;
 #[cfg(feature = "cloud")]
 pub mod http_rate_limit;
 #[cfg(feature = "cloud")]
+mod stall_timer;
+#[cfg(feature = "cloud")]
 pub mod token_bucket;
```

**File**: `crates/polars-io/src/cloud/stall_timer.rs` (added, +441/-0)
```diff
@@ -0,0 +1,441 @@
+//! Stall timer for cloud reads.
+//!
+//! A ranged GET or a HEAD that receives no response headers, or no new body data, for longer
+//! than T is abandoned: the attempt ends in a `Timeout` error and its connection is dropped.
+//! object_store then retries the request, or resumes the body from the bytes already received.
+//!
+//! By default T sits just after the sender's second retransmission timeout:
+//! 1.1 x 3 x (200 ms + `ttfb_min`), where `ttfb_min` is the smallest recent time to headers of
+//! successful ranged GETs on the same object store (about 0.7 s in-region). A connection that is
+//! still silent at that point is typically waiting for a lost packet to be resent, which can
+//! take seconds.
+//!
+//! At most 20 attempts per second are abandoned per process; a stalled attempt without a token
+//! keeps waiting. `POLARS_HTTP_STALL_TIMEOUT_MS=0` disables the timer, any other value sets T in
+//! milliseconds. With `POLARS_LOG_HTTP_RATE_LIMIT`, the read controller's log line reports the
+//! abandons per window.
+
+use std::fmt;
+use std::pin::Pin;
+use std::sync::atomic::AtomicU64;
+use std::sync::atomic::Ordering::Relaxed;
+use std::sync::{Arc, LazyLock};
+use std::task::{Context, Poll};
+use std::time::{Duration, Instant};
+
+use bytes::Bytes;
+use http_body::{Body, Frame, SizeHint};
+use object_store::client::{HttpError, HttpErrorKind, HttpRequest, HttpResponse, HttpResponseBody};
+
+// The sender resends a lost packet after its retransmission timeout, which starts at about
+// 200 ms (Linux' minimum) plus the round trip and doubles on every retry. The resends form a
+// ladder of rungs at 1, 3, 7 and 15 times that base: 0.2, 0.6, 1.4 and 3.0 s on a short path,
+// where the silences of slow S3 reads cluster. T waits for the second rung, with a margin.
+const RUNG_BASE: Duration = Duration::from_millis(200);
+/// Cumulative multiple of the base at the second rung (1 + 2).
+const RUNGS: f64 = 3.0;
+const MARGIN: f64 = 1.1;
+/// `ttfb_min` before the first sample.
+const TTFB_DEFAULT: Duration = Duration::from_millis(100);
+const TTFB_BUCKET_US: u64 = 5_000_000;
+/// Per process, with a burst of one second's worth.
+const MAX_ABANDONS_PER_S: u64 = 20;
+
+const ENV_VAR: &str = "POLARS_HTTP_STALL_TIMEOUT_MS";
+
+enum Mode {
+    Off,
+    Auto,
+    Fixed(Duration),
+}
+
+static MODE: LazyLock<Mode> = LazyLock::new(|| match std::env::var(ENV_VAR) {
+    Err(_) => Mode::Auto,
+    Ok(v) => match v.parse::<u64>() {
+        Ok(0) => Mode::Off,
+        Ok(ms) => Mode::Fixed(Duration::from_millis(ms)),
+        Err(_) => panic!("invalid value for {ENV_VAR}: {v}"),
+    },
+});
+
+/// Stall timer counts of one object store, for `POLARS_LOG_HTTP_RATE_LIMIT`.
+#[derive(Debug, Default)]
+pub(crate) struct StallStats {
+    /// Attempts abandoned while waiting for response headers.
+    hdr_abandons: AtomicU64,
+    /// Attempts abandoned while waiting for body data.
+    body_abandons: AtomicU64,
+    /// Expired timers that got no token (`MAX_ABANDONS_PER_S`): the attempt kept waiting.
+    refused: AtomicU64,
+    /// T of the latest timed attempt, in µs.
+    t_us: AtomicU64,
+}
+
+/// `StallStats` since the previous `take`.
+#[derive(Debug)]
+pub(crate) struct StallCounts {
+    pub hdr_abandons: u64,
+    pub body_abandons: u64,
+    pub refused: u64,
+    /// T of the latest timed attempt.
+    pub t: Duration,
+}
+
+impl StallStats {
+    pub(crate) fn take(&self) -> StallCounts {
+        StallCounts {
+            hdr_abandons: self.hdr_abandons.swap(0, Relaxed),
+            body_abandons: self.body_abandons.swap(0, Relaxed),
+            refused: self.refused.swap(0, Relaxed),
+            t: Duration::from_micros(self.t_us.load(Relaxed)),
+        }
+    }
+}
+
+static EPOCH: LazyLock<Instant> = LazyLock::new(Instant::now);
+
+fn now_us() -> u64 {
+    EPOCH.elapsed().as_micros() as u64
+}
+
+/// The process-wide abandon budget, as the time (µs since `EPOCH`) at which the bucket is
+/// full again.
+static ABANDON_BUDGET: AtomicU64 = AtomicU64::new(0);
+
+/// Takes a token from a bucket that refills at `MAX_ABANDONS_PER_S` and holds one second's
+/// worth, kept in one atomic: `full_at`, when the bucket is full again. A token moves
+/// `full_at` one token's worth of time later, and is available while `full_at` stays within
+/// one second of `now`.
+fn take_token(full_at: &AtomicU64, now: u64) -> bool {
+    const COST_US: u64 = 1_000_000 / MAX_ABANDONS_PER_S;
+    let mut cur = full_at.load(Relaxed);
+    loop {
+        let next = cur.max(now) + COST_US;
+        if next > now + 1_000_000 {
+            return false;
+        }
+        match full_at.compare_exchange_weak(cur, next, Relaxed, Relaxed) {
+            Ok(_) => return true,
+            Err(v) => cur = v,
+        }
+    }
+}
+
+/// Takes an abandon token; without one, counts the refusal.
+fn take_abandon_token(stats: &StallStats) -> bool {
+    let ok = take_token(&ABANDON_BUDGET, now_us());
+    if !ok
```

#### Recent Merged Pull Requests:
- **PR #30966** (2026-11-20): perf: Abandon stalled cloud reads after a stall timeout (@kdn36)
- **PR #30963** (2026-11-20): chore: Bump polars-iceberg to 0.1.1 (@nameexhaustion)
- **PR #30958** (2026-11-20): feat: Support SQL `INSERT` and `UPDATE` on registered tables (@kdn36)
- **PR #30952** (2026-11-20): fix(python): Release pooled connections and use the Arrow cursor for Databricks in read_database (@nameexhaustion)
- **PR #30951** (2026-11-20): fix: Bound the wait for DSL resolvers still running after an error (@nameexhaustion)
- **PR #30950** (2026-11-20): feat: Support a pattern per row in `str.replace` and `str.replace_all` (@ritchie46)

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

## X. Don't panic on extreme counts in string, binary and list slicing

**RULE**:
When implementing operations in `crates/polars-arrow/src/legacy/index.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `70eaa1b9`: Don't panic on extreme counts in string, binary and list slicing. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/polars-arrow/src/legacy/index.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            self.to_usize().filter(|idx| *idx < len)
            let subtract = usize::try_from(self.to_i128()?.unsigned_abs()).ok()?;
            len.checked_sub(subtract)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            if (self.to_usize().unwrap()) < len {
                Some(self.to_usize().unwrap())
            } else {
                None
            }
            let subtract = self.abs().to_usize().unwrap();
            if subtract > len {
                None
            } else {
                Some(len - subtract)
            }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `70eaa1b9` are properly handled with clean fallback behavior.
