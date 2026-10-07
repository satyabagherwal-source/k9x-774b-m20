# Forensic Learning Record (Deep Inspection): pola-rs/polars

> **Canonical Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:29:38.816Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 39989 stars

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

### Core Architecture Module: `crates/polars-arrow/src/io/avro/read/util.rs`
```
use std::io::Read;

use polars_error::PolarsResult;

use super::super::avro_decode;

pub fn zigzag_i64<R: Read>(reader: &mut R) -> PolarsResult<i64> {
    let z = decode_variable(reader)?;
    Ok(if z & 0x1 == 0 {
        (z >> 1) as i64
    } else {
        !(z >> 1) as i64
    })
}

fn decode_variable<R: Read>(reader: &mut R) -> PolarsResult<u64> {
    avro_decode!(reader)
}

```

### Core Architecture Module: `crates/polars-arrow/src/legacy/bit_util.rs`
```
/// Forked from Arrow until their API stabilizes.
///
/// Note that the bound checks are optimized away.
///
use crate::bitmap::utils::{BitChunkIterExact, BitChunks};

pub fn find_first_true_false_null(
    mut bit_chunks: BitChunks<u64>,
    mut validity_chunks: BitChunks<u64>,
) -> (Option<usize>, Option<usize>, Option<usize>) {
    let (mut true_index, mut false_index, mut null_index) = (None, None, None);
    let (mut true_not_found_mask, mut false_not_found_mask, mut null_not_found_mask) =
        (!0u64, !0u64, !0u64); // All ones while not found.
    let mut offset: usize = 0;
    let mut all_found = false;
    for (truth_mask, null_mask) in (&mut bit_chunks).zip(&mut validity_chunks) {
        let mask = null_mask & truth_mask & true_not_found_mask;
        if mask > 0 {
            true_index = Some(offset + mask.trailing_zeros() as usize);
            true_not_found_mask = 0;
        }
        let mask = null_mask & !truth_mask & false_not_found_mask;
        if mask > 0 {
            false_index = Some(offset + mask.trailing_zeros() as usize);
            false_not_found_mask = 0;
        }
        if !null_mask & null_not_found_mask > 0 {
            null_index = Some(offset + null_mask.trailing_ones() as usize);
            null_not_found_mask = 0;
        }
        if null_not_found_mask | true_not_found_mask | false_not_found_mask == 0 {
            all_found = true;
            break;
        }
        offset += 64;
    }
    if !all_found {
        for (val, not_null) in bit_chunks
            .remainder_iter()
            .zip(validity_chunks.remainder_iter())
        {
            if true_index.is_none() && not_null && val {
                true_index = Some(offset);
            } else if false_index.is_none() && not_null && !val {
                false_index = Some(offset);
            } else if null_index.is_none() && !not_null {
                null_index = Some(offset);
            }
            offset += 1;
        }
    }
    (true_index, false_index, null_index)
}

pub fn find_first_true_false_no_null(
    mut bit_chunks: BitChunks<u64>,
) -> (Option<usize>, Option<usize>) {
    let (mut true_index, mut false_index) = (None, None);
    let (mut true_not_found_mask, mut false_not_found_mask) = (!0u64, !0u64); // All ones while not found.
    let mut offset: usize = 0;
    let mut all_found = false;
    for truth_mask in &mut bit_chunks {
        let mask = truth_mask & true_not_found_mask;
        if mask > 0 {
            true_index = Some(offset + mask.trailing_zeros() as usize);
            true_not_found_mask = 0;
        }
        let mask = !truth_mask & false_not_found_mask;
        if mask > 0 {
            false_index = Some(offset + mask.trailing_zeros() as usize);
            false_not_found_mask = 0;
        }
        if true_not_found_mask | false_not_found_mask == 0 {
            all_found = true;
            break;
        }
        offset += 64;
    }
    if !all_found {
        for val in bit_chunks.remainder_iter() {
            if true_index.is_none() && val {
                true_index = Some(offset);
            } else if false_index.is_none() && !val {
                false_index = Some(offset);
            }
            offset += 1;
        }
    }
    (true_index, false_index)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29788** (2026-10-07): **Filter on a column shadowed by `select(... .alias(same_name))` is pushed into a CSPE cache, giving wrong results**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  base = pl.LazyFrame(     {"Channel": ["Web", "Email"], "Direction": ["Inbound", "Outbound"], "E": ["x", "y"], "a": [1, 2], "b": [3, 4]} ).filter(pl.col("E").is_in(["x", "y"]))  def proj(v):     # Redefines "Channel" in terms of the original "Channel" column.     return base.select(         (pl.col("Channel") + "/" + pl.col("Direction")).alias("Channel"),         pl.col(v).alias("x"),     )  q = pl.concat([proj("a"), proj("b")]).filter(pl.col("Channel") == "Web/Inbound")  print(q.collect()) print(q.collect(optimizations=pl.QueryOptFlags(comm_subplan_elim=False))) ```   ### Log output  ```shell shape: (0, 2) ┌─────────┬─────┐ │ Channel ┆ x   │ │ ---     ┆ --- │ │ str     ┆ i64 │ ╞═════════╪═════╡ └─────────┴─────┘ shape: (2, 2) ┌─────────────┬─────┐ │ Channel     ┆ x   │ │ ---         ┆ --- │ │ str         ┆ i64 │ ╞═════════════╪═════╡ │ Web/Inbound ┆ 1   │ │ Web/Inbound ┆ 3   │ └─────────────┴─────┘ ```  ### Issue description  `base` is shared by both union branches, so CSPE inserts a cache. The filter `col("Channel") == "Web/Inbound"` sits above a `select` that *redefines*`Channel` as `Channel + "/" + Direction`, yet the filter is pushed into the cache, where `Channel` still refers to the original column (`"Web"`). Every row is droppe

- **Issue #29780** (2026-10-07): **Streaming engine: Expr.item() in a group-by/window context raises "expected a single value, got none" when the group's single value is null**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  lf = pl.LazyFrame({"g": [1, 2], "a": [None, 2.0]}) q = lf.group_by("g").agg(pl.col("a").item()).sort("g")  print(q.collect(engine="in-memory"))  # OK print(q.collect(engine="streaming"))  # ComputeError ```   ### Log output  ```shell --------------------------------------------------------------------------- ComputeError                              Traceback (most recent call last) Cell In[11], line 7       3 lf = pl.LazyFrame({"g": [1, 2], "a": [None, 2.0]})       4 q = lf.group_by("g").agg(pl.col("a").item()).sort("g")       5        6 print(q.collect(engine="in-memory"))  # OK ----> 7 print(q.collect(engine="streaming"))  # ComputeError  File /REDACTED/.venv/lib/python3.12/site-packages/polars/_utils/expired.py:114, in removed_parameters.<locals>.decorate.<locals>.wrapper(*args, **kwargs)     108     if name in params_dict:     109         _raise_removed_argument_error(     110             params_dict[name],     111             func_name=function.__qualname__,     112             kwargs=kwargs,     113         ) --> 114 return function(*args, **kwargs)  File /REDACTED/.venv/lib/python3.12/site-packages/polars/lazyframe/frame.py:2225, in LazyFrame.collect(self, engine, background, optimizations, **_kwargs)    2222 engine_ = _select

- **Issue #29758** (2026-10-07): **CSV scans over mixed S3 buckets fail or have incorrect data**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  AI was used to build the MRE.  ```python """MRE: scan_csv over paths in two different S3 buckets (local MinIO, path-style).  Setup: MinIO at http://127.0.0.1:9000 (creds via MINIO_KEY / MINIO_SECRET, default minioadmin). The script creates the buckets and objects itself:      s3://mre-mixed-b1/x.csv -> "a\n1\n"     s3://mre-mixed-b2/y.csv -> "a\n2\n"  Plain `.collect()` is correct ([1, 2]). Anything that downloads the whole file (`select(pl.len())`, `infer_schema_length=None`) resolves the second path against the first path's bucket:      OSError: object-store error: Object at location y.csv not found:     Error performing HEAD http://127.0.0.1:9000/mre-mixed-b1/y.csv ... 404  Worse: if b1 also happens to contain a y.csv, `select(pl.len())` silently counts that object instead of s3://b2/y.csv (test_count_with_decoy). Plain collect and full inference still return the right data in that case.  A fresh POLARS_TEMP_DIR is used so a stale file cache cannot mask this. """ import os import tempfile  os.environ.setdefault("POLARS_TEMP_DIR", tempfile.mkdtemp())  import boto3 import polars as pl  ENDPOINT = "http://127.0.0.1:9000" KEY = os.environ.get("MINIO_KEY", "minioadmin") SECRET = os.environ.get("MINIO_SECRET", "minioadmin") B1, B2 = "mre-mixed-b1", "mre-mixed-b2" PATH

- **Issue #29743** (2026-10-05): **Filtering a `Categorical` column with `is_in` on a list of strings sometimes drops rows**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python # write.py import polars as pl  (     pl.DataFrame({"a": [f"S{i:05d}" for i in range(2_000) for _ in range(2_000)]})     .with_columns(pl.col("a").cast(pl.Categorical), x=pl.int_range(pl.len()))     .write_parquet("data.parquet", row_group_size=10_000) ) ```  ```python # read.py import polars as pl  print(     pl.scan_parquet("data.parquet")     .filter(pl.col("a").is_in([f"S{i:05d}" for i in range(0, 2_000, 40)]))     .select(pl.len())     .collect(engine="streaming")     .item() ) ```  ```sh uv run -q --no-project --with polars==2.0.0rc2 python write.py for i in $(seq 10); do uv run -q --no-project --with polars==2.0.0rc2 python read.py; done | sort | uniq -c #      10 100000 ```  ```sh git checkout 7097198 make .venv make build-fast-release source .venv/bin/python python write.py for i in $(seq 10); do python read.py; done | sort | uniq -c #      3 2000 #      6 4000 #      1 6000 ```  ### Log output  ```shell  ```  ### Issue description  Filtering a `Categorical` column with `is_in` on a list of strings sometimes drops rows. That happens when the data is scanned from parquet in a process that has not seen those categories yet. It does NOT happen on the latest released versions (tested `v1.44.2` and `v2.0.0rc2`), but on the current commit (`7097198` at

- **Issue #29731** (2026-10-07): **`PolarsAllocator` plugins crash on import on macOS with pyo3 0.29.3**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://crates.io/crates/polars) of Polars.  ### Reproducible example  ```toml # Cargo.toml [lib] crate-type = ["cdylib"]  [dependencies] pyo3 = { version = "=0.29.3", features = ["extension-module", "abi3-py310"] } pyo3-polars = "0.28.0" ```  ```rust // src/lib.rs, as in the cookiecutter-polars-plugins template use pyo3::prelude::*; use pyo3_polars::PolarsAllocator;  #[pymodule] fn repro(_py: Python, m: &Bound<PyModule>) -> PyResult<()> {     m.add("__version__", env!("CARGO_PKG_VERSION"))?;     Ok(()) }  #[global_allocator] static ALLOC: PolarsAllocator = PolarsAllocator::new(); ```  ```shell maturin develop python -c "import repro" ```   ### Log output  ```shell Segmentation fault: 11   (exit code 139, no other output) ```  ### Issue description  On macOS, a plugin that uses `PolarsAllocator` and calls `m.add(...)` in its `#[pymodule]` crashes on import when it is built with pyo3 0.29.3. The [cookiecutter template](https://github.com/MarcoGorelli/cookiecutter-polars-plugins) has both. pyo3-polars 0.28.0 accepts `pyo3 ^0.29`, so a fresh lockfile gets 0.29.3. Linux and Windows should not be affected, because there `std::sync::Mutex` does not allocate.  Cause: in pyo3 0.29.3, re-attaching after a detach creates the pyo3 reference pool and locks its `std::sync::Mutex`. `m.add` detaches the first time it interns `__all__`. On macOS the f

- **Issue #29708** (2026-10-05): **`read_database` raises `ImportError` with SQLAlchemy 2.1 when `greenlet` is not installed**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python # pip install polars sqlalchemy>=2.1 pandas pyarrow   (no greenlet) import polars as pl import sqlalchemy as sa  engine = sa.create_engine("sqlite:///:memory:") with engine.connect() as conn:     pl.read_database("SELECT 1 AS x", connection=conn) ```  ### Log output  ```shell Traceback (most recent call last):   File "/Users/kirangadhave/.cache/uv/archive-v0/_SAF7z2QI0yiwio4yNIoD/lib/python3.13/site-packages/sqlalchemy/util/concurrency.py", line 70, in _initialize     from greenlet import getcurrent ModuleNotFoundError: No module named 'greenlet'  The above exception was the direct cause of the following exception:  Traceback (most recent call last):   File "<string>", line 5, in <module>     pl.read_database('SELECT 1 AS x', connection=conn)     ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/Users/kirangadhave/.cache/uv/archive-v0/_SAF7z2QI0yiwio4yNIoD/lib/python3.13/site-packages/polars/io/database/functions.py", line 284, in read_database     with ConnectionExecutor(connection) as cx:          ~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^   File "/Users/kirangadhave/.cache/uv/archive-v0/_SAF7z2QI0yiwio4yNIoD/lib/python3.13/site-packages/polars/io/database/_executor.py", line 95, in __init__     self.cursor = self._normalise_cursor(connection)            

- **Issue #29707** (2026-10-04): **Nested caches drop projection, giving wrong results (regression in 1.43.0)**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the latest version of Polars.  ### Reproducible example  ```python import polars as pl  lf = pl.LazyFrame({"k": [1, 2, 3], "v": [1, 2, 2]}).cache() x = lf.select("k").cache() q = pl.concat([x, x]).join(lf, on="k")  print(q.collect_schema().names()) for engine in ("in-memory", "streaming"):     print(engine, q.collect(engine=engine).columns) ```  ### Log output  ``` ['k', 'v'] in-memory ['k', 'v', 'v_right'] streaming ['k', 'v', 'v_right'] ```  ### Issue description  When caches are nested, the projection between the two caches is lost. In the example, `x = lf.select("k")` is cached, and its input `lf` is also cached and used elsewhere. The union reads the inner cache directly, so `x` yields `["k", "v"]` instead of `["k"]`. The result silently gets an extra column that `collect_schema()` does not report.  In the optimized plan, both union branches and the join's right side read the same cache, with no `select("k")` projection in between.  - Regression: correct on 1.42.1, wrong from 1.43.0 through 1.44.2 and on `main` (0fa19ce2ef). - Affects both engines. - Still wrong with `comm_subplan_elim=False`, but correct with `projection_pushdown=False`. That points at cache handling in projection pushdown. - Other ways to get nested caches hit the same bug:   - Caching only the source (`lf.cache()`, no `.cache()` on `x`) is wrong from 1.44.0. Since #28859, CSPE runs

- **Issue #29695** (2026-10-02): **LazyFrame rounds all Datetime to µs**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl from pandas import Timestamp  data = {     "__index__": [         Timestamp(t, tz="Pacific/Auckland").as_unit("ns")         for t in [             "2024-06-01 12:34:56.123456",             "2024-06-01 12:34:56.12345670",             "2024-06-01 12:34:56.123457",         ]     ],     "test": [[0, 1], [1, 2], [2, 3]], }  print(data["__index__"][1])  lf = pl.LazyFrame(data) print(lf.collect()) ```   ### Log output  ```shell 2024-06-01 12:34:56.123456700+12:00 shape: (3, 2) ┌─────────────────────────────────┬───────────┐ │ __index__                       ┆ test      │ │ ---                             ┆ ---       │ │ datetime[μs, Pacific/Auckland]  ┆ list[i64] │ ╞═════════════════════════════════╪═══════════╡ │ 2024-06-01 12:34:56.123456 NZS… ┆ [0, 1]    │ │ 2024-06-01 12:34:56.123456 NZS… ┆ [1, 2]    │ │ 2024-06-01 12:34:56.123457 NZS… ┆ [2, 3]    │ └─────────────────────────────────┴───────────┘ ```  ### Issue description  Creating a LazyFrame from data with nanosecond time precision rounds all timestamps to the nearest microsecond. This process should instead set the type to the highest precision source in the input data.  ### Expected behavior  Code should be the same as above, except result in a LazyFrame with pl.Datetime("ns", "Pacif
  **Post-Mortem & Fix Analysis**:
  > https://github.com/pola-rs/polars/issues/28869#issuecomment-5342352221

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

### Incident Patch 1: `f08617f5` (2026-10-07)
**Commit Message**: fix: Fix SQL FILTER clauses that contain a subquery (#29794)

**File**: `crates/polars-sql/src/context.rs` (modified, +3/-3)
```diff
@@ -264,9 +264,9 @@ pub(crate) struct GroupScope {
     /// Partition column standing for an empty `OVER ()` parsed in such a clause,
     /// until the window is separated from the aggregates.
     whole_frame_partition: Option<PlSmallStr>,
-    /// Placeholders of the scalar subqueries in the value arguments of aggregates, which are
-    /// read once per row (see `broadcast_subqueries_in_inputs`). A subquery in a parameter,
-    /// as the separator of STRING_AGG, is read once.
+    /// Placeholders of the scalar subqueries in the value arguments and the FILTER of
+    /// aggregates, which are read once per row (see `broadcast_subqueries_in_inputs`). A
+    /// subquery in a parameter, as the separator of STRING_AGG, is read once.
     pub(crate) subqueries_read_per_row: PlHashSet<PlSmallStr>,
 }
 
```

**File**: `crates/polars-sql/src/functions.rs` (modified, +66/-19)
```diff
@@ -11,14 +11,15 @@ use polars_defs::expr::{RankMethod, RankOptions};
 use polars_lazy::dsl::Expr;
 #[cfg(feature = "approx_quantile")]
 use polars_lazy::prelude::ApproxQuantileMethod;
-use polars_lazy::prelude::DataTypeExpr;
+use polars_lazy::prelude::{DataTypeExpr, LazyFrame};
 use polars_plan::dsl::functions::{
     coalesce, col, cols, concat_str, element, int_range, len, lit, max_horizontal, min_horizontal,
     when,
 };
 use polars_plan::dsl::{FunctionExpr, SqlBinaryOp, SqlFunction};
 use polars_plan::plans::{DynLiteralValue, LiteralValue, RowEncodingVariant, typed_lit};
 use polars_plan::prelude::StrptimeOptions;
+use polars_utils::aliases::PlHashMap;
 use polars_utils::pl_str::PlSmallStr;
 use sqlparser::ast::helpers::attached_token::AttachedToken;
 use sqlparser::ast::{
@@ -1275,23 +1276,31 @@ impl SQLFunctionVisitor<'_> {
         }
         if let Some(filter_expr) = &function.filter {
             let pred = parse_sql_expr(filter_expr, self.ctx, self.active_schema)?;
+            // The predicate is read once per row.
+            self.read_subqueries_per_row(&pred);
+            let typed_pred = self.with_typed_subqueries(&pred)?;
             // As in WHERE, a condition that reads no input is accepted as any type that casts
             // to boolean.
-            let pred = if is_constant_key(&pred) {
+            let pred = if reads_no_input(&typed_pred) {
                 pred.cast(DataType::Boolean)
             } else {
-                pred
+                // The rows that pass are counted, which needs a boolean.
+                let dtype = self
+                    .active_schema
+                    .and_then(|schema| Some(typed_pred.to_field(schema).ok()?.dtype))
+                    .filter(|dtype| dtype.is_known());
+                match dtype {
+                    Some(dtype) => {
+                        polars_ensure!(
+                            dtype.is_bool(),
+                            InvalidOperation: "filter predicate must be of type `Boolean`, got `{}`", dtype
+                        );
+                        pred
+                    },
+                    // Otherwise `when` checks for a boolean when it runs.
+                    None => when(pred).then(lit(true)).otherwise(lit(false)),
+                }
             };
-            // A constant aggregate counts the rows that pass, which needs a boolean.
-            if let Some(schema) = self.active_schema
-                && let Ok(field) = pred.to_field(schema)
-                && field.dtype.is_known()
-            {
-                polars_ensure!(
-                    field.dtype.is_bool(),
-                    InvalidOperation: "filter predicate must be of type `Boolean`, got `{}`", field.dtype
-                );
-            }
             self.filter = Some(pred);
         }
         self.reads_rows = self.window.is_none() && function_name.is_builtin_aggregate();
@@ -2223,12 +2232,7 @@ impl SQLFunctionVisitor<'_> {
     fn parse_value_arg(&mut self, expr: &SQLExpr) -> PolarsResult<ValueArg> {
         let parsed = parse_sql_expr(expr, self.ctx, self.active_schema)?;
         if self.reads_rows {
-            for e in &parsed {
-                if let Expr::SubPlan(_, names) = e {
-                    let read_per_row = &mut self.ctx.group_scope.subqueries_read_per_row;
-                    read_per_row.extend(names.iter().map(|(name, _)| name.clone()));
-                }
-            }
+            self.read_subqueries_per_row(&parsed);
         }
         Ok(if self.reads_rows && is_constant_key(&parsed) {
             ValueArg::Constant(parsed)
@@ -2237,6 +2241,41 @@ impl SQLFunctionVisitor<'_> {
         })
     }
 
+    /// Record the scalar subqueries in `expr` as read once per row (see
+    /// `GroupScope::subqueries_read_per_row`).
+    fn read_subqueries_per_row(&mut self, expr: &Expr) {
+        for e in expr {
+            if let Expr::SubPlan(_, names) = e {
+                let read_per_row = &mut self.ctx.group_scope.subqueries_read_per_row;
+                read_per_row.extend(names.iter().map(|(name, _)| name.clone()));
+            }
+        }
+    }
+
+    /// `expr` with each subquery, and each read of its result, replaced by a null of its dtype,
+    /// so that it can be typed before the subqueries are resolved.
+    fn with_typed_subqueries(&mut self, expr: &Expr) -> PolarsResult<Expr> {
+        let mut dtypes = PlHashMap::default();
+        for e in expr {
+            if let Expr::SubPlan(lp, names) = e {
+                for (name, select_expr) in names.iter() {
+                    let mut lf = LazyFrame::from((***lp).clone()).select([select_expr.clone()]);
+                    let schema = self.ctx.get_frame_schema(&mut lf)?;
+                    dtypes.insert(name.clone(), schema.get_at_index(0).unwrap().1.clone());
+                }
+            }
+        }
+        if dtypes.is_empty() {
+            return Ok(expr.clone());
+        }
+        let typed_null =
```

**File**: `py-polars/tests/unit/sql/test_filter_clause.py` (modified, +59/-3)
```diff
@@ -6,7 +6,7 @@
 import pytest
 
 import polars as pl
-from polars.exceptions import InvalidOperationError, SQLInterfaceError
+from polars.exceptions import InvalidOperationError, SchemaError, SQLInterfaceError
 from tests.unit.sql import assert_sql_matches
 
 
@@ -177,5 +177,61 @@ def test_filter_clause_with_over_unsupported() -> None:
 @pytest.mark.parametrize("agg", ["SUM(2)", "COUNT(*)", "SUM(x)"])
 def test_filter_clause_non_boolean_error(agg: str) -> None:
     df = pl.DataFrame({"x": [1, 2, 3]})
-    with pytest.raises(InvalidOperationError, match="must be of type `Boolean`"):
-        df.sql(f"SELECT {agg} FILTER (WHERE x) FROM self")
+    for pred in (
+        "x",
+        "x + (SELECT 0)",
+        "x + CAST(x IN (SELECT x FROM self) AS INT)",
+        "x + CAST(x = ANY (SELECT x FROM self) AS INT)",
+    ):
+        with pytest.raises(InvalidOperationError, match="must be of type `Boolean`"):
+            df.sql(f"SELECT {agg} FILTER (WHERE {pred}) FROM self")
+    # Without a schema, the predicate is checked when it runs.
+    for engine in ("in-memory", "streaming"):
+        with pytest.raises(SchemaError, match="`Boolean`"):
+            df.lazy().select(pl.sql_expr(f"{agg} FILTER (WHERE x)")).collect(
+                engine=engine
+            )
+
+
+def test_filter_clause_subquery_non_boolean_cast_error() -> None:
+    df = pl.DataFrame({"x": [1, 2, 3]})
+    with pytest.raises(InvalidOperationError, match="casting from"):
+        df.sql("SELECT COUNT(*) FILTER (WHERE (SELECT 'abc')) FROM self")
+
+
+@pytest.mark.parametrize(
+    "query",
+    [
+        """
+        SELECT
+          SUM(2) FILTER (WHERE (SELECT TRUE)) AS a,
+          COUNT(*) FILTER (WHERE (SELECT TRUE)) AS b,
+          STDDEV(1) FILTER (WHERE (SELECT TRUE)) AS c,
+          SUM(x) FILTER (WHERE x > (SELECT 1)) AS d
+        FROM self
+        """,
+        """
+        SELECT
+          g,
+          SUM(2) FILTER (WHERE (SELECT TRUE)) AS a,
+          COUNT(*) FILTER (WHERE x > (SELECT 1)) AS b
+        FROM self GROUP BY g ORDER BY g
+        """,
+        # A condition that reads no input is cast to boolean.
+        """
+        SELECT
+          COUNT(*) FILTER (WHERE (SELECT NULL)) AS a,
+          COUNT(*) FILTER (WHERE (SELECT 0)) AS b,
+          SUM(2) FILTER (WHERE (SELECT 1)) AS c,
+          SUM(2) FILTER (WHERE 1 + CAST(1 IN (SELECT x FROM self) AS INT)) AS d,
+          SUM(x) FILTER (WHERE 1 + CAST(1 = ANY (SELECT x FROM self) AS INT)) AS e
+        FROM self
+        """,
+    ],
+)
+def test_filter_clause_subquery(query: str) -> None:
+    # The predicate reads a subquery value once per row.
+    df = pl.DataFrame({"g": [1, 1, 2], "x": [1, 2, 3]})
+    assert_sql_matches(
+        df, query=query, compare_with="duckdb", engines=["in-memory", "streaming"]
+    )
```

---

### Incident Patch 2: `157a9f13` (2026-10-07)
**Commit Message**: fix: Don't push filters into a cache past a projection (#29793)

**File**: `crates/polars-plan/src/plans/optimizer/cse/cache_states.rs` (modified, +10/-4)
```diff
@@ -595,11 +595,17 @@ fn get_filter_predicate(parents: TwoParents, lp_arena: &Arena<IR>) -> Option<&Ex
     Some(predicate)
 }
 
+/// The filter directly above the cache, with only a `SimpleProjection` allowed in between. A
+/// filter above any other node may refer to columns that node computes or redefines.
 fn get_filter_node(parents: TwoParents, lp_arena: &Arena<IR>) -> Option<Node> {
-    parents
-        .into_iter()
-        .flatten()
-        .find(|&parent| matches!(lp_arena.get(parent), IR::Filter { .. }))
+    for parent in parents.into_iter().flatten() {
+        match lp_arena.get(parent) {
+            IR::Filter { .. } => return Some(parent),
+            IR::SimpleProjection { .. } => {},
+            _ => return None,
+        }
+    }
+    None
 }
 
 /// Determine whether `predicate` was pushed down when running predicate pushdown on a cache-free
```

**File**: `py-polars/tests/unit/lazyframe/test_cse.py` (modified, +24/-0)
```diff
@@ -2294,3 +2294,27 @@ def test_cspe_narrowing_ignores_a_reader_that_keeps_no_rows(dead: pl.Expr) -> No
         q.collect(optimizations=pl.QueryOptFlags(comm_subplan_elim=False)),
         check_row_order=False,
     )
+
+
+@pytest.mark.parametrize("engine", ["in-memory", "streaming"])
+@pytest.mark.parametrize("method", ["select", "with_columns"])
+def test_cspe_filter_on_redefined_column_not_pushed_into_cache_29788(
+    engine: EngineType, method: str
+) -> None:
+    base = pl.LazyFrame(
+        {"c": ["a", "b"], "d": ["x", "y"], "e": [1, 2], "v": [1, 2], "w": [3, 4]}
+    ).filter(pl.col("e") > 0)
+
+    def proj(v: str) -> pl.LazyFrame:
+        # Redefines "c" in terms of the original "c".
+        exprs = [(pl.col("c") + pl.col("d")).alias("c"), pl.col(v).alias("x")]
+        if method == "select":
+            lf = base.select(exprs)
+        else:
+            lf = base.with_columns(exprs)
+        return lf.select("c", "x")
+
+    q = pl.concat([proj("v"), proj("w")]).filter(pl.col("c") == "ax")
+
+    expected = pl.DataFrame({"c": ["ax", "ax"], "x": [1, 3]})
+    assert_frame_equal(q.collect(engine=engine), expected)
```

---

### Incident Patch 3: `bf215261` (2026-10-07)
**Commit Message**: fix: Phase logic error in merge_sorted (#29781)

**File**: `crates/polars-stream/src/nodes/merge_sorted.rs` (modified, +25/-5)
```diff
@@ -18,6 +18,10 @@ pub struct MergeSortedNode {
 
     maintain_order: bool,
 
+    // Whether the inputs will not produce any more morsels.
+    left_input_done: bool,
+    right_input_done: bool,
+
     // Not yet merged buffers.
     left_unmerged: VecDeque<DataFrame>,
     right_unmerged: VecDeque<DataFrame>,
@@ -32,6 +36,9 @@ impl MergeSortedNode {
 
             maintain_order,
 
+            left_input_done: false,
+            right_input_done: false,
+
             left_unmerged: VecDeque::new(),
             right_unmerged: VecDeque::new(),
         }
@@ -202,10 +209,12 @@ impl ComputeNode for MergeSortedNode {
         // Abstraction: we merge buffer state with port state so we can map
         // to one three possible 'effective' states:
         // no data now (_blocked); data available (); or no data anymore (_done)
-        let left_done = recv[0] == PortState::Done && self.left_unmerged.is_empty();
-        let right_done = recv[1] == PortState::Done && self.right_unmerged.is_empty();
+        self.left_input_done = recv[0] == PortState::Done;
+        self.right_input_done = recv[1] == PortState::Done;
+        let left_done = self.left_input_done && self.left_unmerged.is_empty();
+        let right_done = self.right_input_done && self.right_unmerged.is_empty();
 
-        // We're done as soon as one side is done.
+        // We're done when the output is done or both sides are done.
         if send[0] == PortState::Done || (left_done && right_done) {
             recv[0] = PortState::Done;
             recv[1] = PortState::Done;
@@ -255,6 +264,8 @@ impl ComputeNode for MergeSortedNode {
         let seq = &mut self.seq;
         let starting_nulls = &mut self.starting_nulls;
         let maintain_order = self.maintain_order;
+        let left_input_done = self.left_input_done;
+        let right_input_done = self.right_input_done;
         let left_unmerged = &mut self.left_unmerged;
         let right_unmerged = &mut self.right_unmerged;
 
@@ -407,9 +418,9 @@ impl ComputeNode for MergeSortedNode {
                     // If one of the ports is done and does not have buffered data anymore, we
                     // flush the data on the other side. After this point, this node just pipes
                     // data through.
-                    let pass = if left.is_none() && left_unmerged.is_empty() {
+                    let pass = if left_input_done && left_unmerged.is_empty() {
                         Some((right.as_mut(), &mut *right_unmerged))
-                    } else if right.is_none() && right_unmerged.is_empty() {
+                    } else if right_input_done && right_unmerged.is_empty() {
                         Some((left.as_mut(), &mut *left_unmerged))
                     } else {
                         None
@@ -445,6 +456,15 @@ impl ComputeNode for MergeSortedNode {
                                 }
                             }
                         }
+                    } else {
+                        // One side is blocked and has no buffered data, so nothing more can be
+                        // merged in this phase. Stop the other side and buffer what it produced.
+                        if let Some(p) = &mut left {
+                            buffer_unmerged(p, left_unmerged).await;
+                        }
+                        if let Some(p) = &mut right {
+                            buffer_unmerged(p, right_unmerged).await;
+                        }
                     }
 
                     Ok(())
```

---

### Incident Patch 4: `496a4a99` (2026-10-07)
**Commit Message**: fix: Incorrect length error in streaming group-by item() (#29787)

**File**: `crates/polars-expr/src/reduce/first_last.rs` (modified, +3/-3)
```diff
@@ -177,7 +177,7 @@ where
             a.value = b;
             a.seq = seq_id;
         }
-        P::add_count(&mut a.count, b.is_some() as usize);
+        P::add_count(&mut a.count, 1);
     }
 
     fn reduce_ca(&self, v: &mut Self::Value, ca: &ChunkedArray<Self::Dtype>, seq_id: u64) {
@@ -254,7 +254,7 @@ where
             replace_opt_bytes(&mut a.value, b);
             a.seq = seq_id;
         }
-        P::add_count(&mut a.count, b.is_some() as usize);
+        P::add_count(&mut a.count, 1);
     }
 
     fn reduce_ca(&self, v: &mut Self::Value, ca: &ChunkedArray<Self::Dtype>, seq_id: u64) {
@@ -310,7 +310,7 @@ where
             a.value = b;
             a.seq = seq_id;
         }
-        P::add_count(&mut a.count, b.is_some() as usize);
+        P::add_count(&mut a.count, 1);
     }
 
     fn reduce_ca(&self, v: &mut Self::Value, ca: &ChunkedArray<Self::Dtype>, seq_id: u64) {
```

**File**: `py-polars/tests/unit/operations/aggregation/test_aggregations.py` (modified, +22/-1)
```diff
@@ -1594,7 +1594,6 @@ def test_item_too_many(df: pl.DataFrame) -> None:
     df=dataframes(
         min_size=1,
         max_size=1,
-        allow_null=False,
         excluded_dtypes=[
             # TODO: polars/#24936
             pl.Struct,
@@ -1608,6 +1607,28 @@ def test_item_on_groups(df: pl.DataFrame) -> None:
     assert_frame_equal(q.collect(engine="streaming"), df)
 
 
+@pytest.mark.parametrize("value", [2.0, "x", True])
+def test_item_on_groups_null_29780(value: Any) -> None:
+    dtype = pl.Series([value]).dtype
+    df = pl.DataFrame({"g": [1, 2], "a": [None, value]})
+
+    q = df.lazy().group_by("g").agg(pl.col("a").item()).sort("g")
+    assert_frame_equal(q.collect(), df)
+
+    q = df.lazy().select(pl.col("a").item().over("g"))
+    assert_frame_equal(q.collect(), df.select("a"))
+
+    for values, allow_empty, expected in [
+        ([None, value], False, "a single value"),
+        ([None, None], True, "no or a single value"),
+    ]:
+        lf = pl.LazyFrame({"g": [1, 1], "a": values}, schema_overrides={"a": dtype})
+        q = lf.group_by("g").agg(pl.col("a").item(allow_empty=allow_empty))
+        match = f"aggregation 'item' expected {expected}, got 2 values"
+        with pytest.raises(ComputeError, match=match):
+            q.collect()
+
+
 def test_item_on_groups_empty() -> None:
     df = pl.DataFrame({"col0": [[]]})
     q = df.lazy().select(pl.all().list.item())
```

---

### Incident Patch 5: `7b7a9285` (2026-10-07)
**Commit Message**: refactor(rust): More informative streaming node memory usage pattern (#29786)

**File**: `crates/polars-stream/src/execute.rs` (modified, +20/-22)
```diff
@@ -15,6 +15,7 @@ use tokio::task::JoinHandle;
 
 use crate::graph::{Graph, GraphNode, GraphNodeKey, LogicalPipeKey, PortState};
 use crate::metrics::GraphMetrics;
+use crate::nodes::NodeMemoryUsage;
 use crate::pipe::PhysicalPipe;
 
 #[derive(Clone)]
@@ -56,11 +57,11 @@ impl StreamingExecutionState {
     }
 }
 
-/// Finds all runnable pipeline blockers in the graph, that is, nodes which:
+/// Finds all runnable phase sinks, that is, nodes which:
 ///  - Only have blocked output ports.
 ///  - Have at least one ready input port connected to a ready output port.
-fn find_runnable_pipeline_blockers(graph: &Graph) -> Vec<GraphNodeKey> {
-    let mut blockers = Vec::new();
+fn find_runnable_phase_sinks(graph: &Graph) -> Vec<GraphNodeKey> {
+    let mut phase_sinks = Vec::new();
     for (node_key, node) in graph.nodes.iter() {
         // TODO: how does the multiplexer fit into this?
         let only_has_blocked_outputs = node
@@ -76,10 +77,10 @@ fn find_runnable_pipeline_blockers(graph: &Graph) -> Vec<GraphNodeKey> {
                 && graph.pipes[*i].recv_state == PortState::Ready
         });
         if has_input_ready {
-            blockers.push(node_key);
+            phase_sinks.push(node_key);
         }
     }
-    blockers
+    phase_sinks
 }
 
 /// Given a set of nodes expand this set with all nodes which are inputs to the
@@ -112,27 +113,24 @@ fn expand_ready_subgraph(
 
 /// Finds a part of the graph which we can run.
 fn find_runnable_subgraph(graph: &mut Graph) -> (PlHashSet<GraphNodeKey>, Vec<LogicalPipeKey>) {
-    // Find pipeline blockers, choose a subset with at most one memory intensive
-    // pipeline blocker, and return the subgraph needed to feed them.
-    let blockers = find_runnable_pipeline_blockers(graph);
-    let (expensive, cheap): (Vec<_>, Vec<_>) = blockers.into_iter().partition(|b| {
-        graph.nodes[*b]
-            .compute
-            .is_memory_intensive_pipeline_blocker()
-    });
-
-    // If all expensive pipeline blockers left are sinks (InMemorySink), we're not
-    // gaining anything by only running a subset.
-    let only_expensive_sinks_left = expensive
+    // Find phase sinks, choose a subset with at most one accumulating node, and
+    // return the subgraph needed to feed them.
+    let phase_sinks = find_runnable_phase_sinks(graph);
+    let (accumulating, mut to_run): (Vec<_>, Vec<_>) = phase_sinks
+        .into_iter()
+        .partition(|n| graph.nodes[*n].compute.memory_usage() == NodeMemoryUsage::Accumulating);
+
+    // If all accumulating nodes left are sinks (InMemorySink), we're not gaining
+    // anything by only running a subset.
+    let only_accumulating_sinks_left = accumulating
         .iter()
         .all(|node_key| graph.nodes[*node_key].outputs.is_empty());
 
-    let mut to_run = cheap;
-    if only_expensive_sinks_left {
-        to_run.extend(expensive);
+    if only_accumulating_sinks_left {
+        to_run.extend(accumulating);
     } else {
-        // TODO: choose which expensive pipeline blocker(s) to run more intelligently.
-        let best = expensive.into_iter().max_by_key(|node_key| {
+        // TODO: choose which accumulating node(s) to run more intelligently.
+        let best = accumulating.into_iter().max_by_key(|node_key| {
             // Prefer to run nodes whose outputs are ready to be consumed. Also
             // prefer to run nodes which have outputs over in-memory sinks.
             let num_outputs = graph.nodes[*node_key].outputs.len();
```

**File**: `crates/polars-stream/src/nodes/columnar_function.rs` (modified, +6/-2)
```diff
@@ -121,8 +121,12 @@ impl ComputeNode for ColumnarFunctionNode {
         Ok(())
     }
 
-    fn is_memory_intensive_pipeline_blocker(&self) -> bool {
-        matches!(self, Self::Sink { .. })
+    fn memory_usage(&self) -> NodeMemoryUsage {
+        match self {
+            Self::Sink { .. } => NodeMemoryUsage::Accumulating,
+            Self::Source(src) => src.memory_usage(),
+            Self::Done => NodeMemoryUsage::Bounded,
+        }
     }
 
     fn spawn<'env, 's>(
```

**File**: `crates/polars-stream/src/nodes/dynamic_slice.rs` (modified, +8/-0)
```diff
@@ -88,6 +88,14 @@ impl ComputeNode for DynamicSliceNode {
         Ok(())
     }
 
+    fn memory_usage(&self) -> NodeMemoryUsage {
+        match self {
+            Self::GatheringParams { .. } => NodeMemoryUsage::Bounded,
+            Self::Streaming(node) => node.memory_usage(),
+            Self::Negative(node) => node.memory_usage(),
+        }
+    }
+
     fn spawn<'env, 's>(
         &'env mut self,
         scope: &'s TaskScope<'s, 'env>,
```

**File**: `crates/polars-stream/src/nodes/gather.rs` (modified, +6/-2)
```diff
@@ -77,8 +77,12 @@ impl ComputeNode for GatherNode {
         Ok(())
     }
 
-    fn is_memory_intensive_pipeline_blocker(&self) -> bool {
-        matches!(self.state, GatherState::Sink(_))
+    fn memory_usage(&self) -> NodeMemoryUsage {
+        match self.state {
+            GatherState::Sink(_) => NodeMemoryUsage::Accumulating,
+            GatherState::Gather(_) => NodeMemoryUsage::HoldingUntilDone,
+            GatherState::Done => NodeMemoryUsage::Bounded,
+        }
     }
 
     fn spawn<'env, 's>(
```

**File**: `crates/polars-stream/src/nodes/group_by.rs` (modified, +6/-2)
```diff
@@ -879,8 +879,12 @@ impl ComputeNode for GroupByNode {
         "group-by"
     }
 
-    fn is_memory_intensive_pipeline_blocker(&self) -> bool {
-        matches!(self.state, GroupByState::Sink { .. })
+    fn memory_usage(&self) -> NodeMemoryUsage {
+        match &self.state {
+            GroupByState::Sink(_) => NodeMemoryUsage::Accumulating,
+            GroupByState::Source(src) => src.memory_usage(),
+            GroupByState::Done => NodeMemoryUsage::Bounded,
+        }
     }
 
     fn update_state(
```

**File**: `crates/polars-stream/src/nodes/in_memory_map.rs` (modified, +6/-2)
```diff
@@ -77,8 +77,12 @@ impl ComputeNode for InMemoryMapNode {
         Ok(())
     }
 
-    fn is_memory_intensive_pipeline_blocker(&self) -> bool {
-        matches!(self, Self::Sink { .. })
+    fn memory_usage(&self) -> NodeMemoryUsage {
+        match self {
+            Self::Sink { .. } => NodeMemoryUsage::Accumulating,
+            Self::Source(src) => src.memory_usage(),
+            Self::Done => NodeMemoryUsage::Bounded,
+        }
     }
 
     fn spawn<'env, 's>(
```

**File**: `crates/polars-stream/src/nodes/in_memory_sink.rs` (modified, +2/-2)
```diff
@@ -48,8 +48,8 @@ impl ComputeNode for InMemorySinkNode {
         Ok(())
     }
 
-    fn is_memory_intensive_pipeline_blocker(&self) -> bool {
-        true
+    fn memory_usage(&self) -> NodeMemoryUsage {
+        NodeMemoryUsage::Accumulating
     }
 
     fn spawn<'env, 's>(
```

**File**: `crates/polars-stream/src/nodes/in_memory_source.rs` (modified, +8/-0)
```diff
@@ -77,6 +77,14 @@ impl ComputeNode for InMemorySourceNode {
         Ok(())
     }
 
+    fn memory_usage(&self) -> NodeMemoryUsage {
+        match &self.source {
+            // Finishing only frees the frame if no one else holds a reference to it.
+            Some(df) if Arc::strong_count(df) == 1 => NodeMemoryUsage::HoldingUntilDone,
+            _ => NodeMemoryUsage::Bounded,
+        }
+    }
+
     fn spawn<'env, 's>(
         &'env mut self,
         scope: &'s TaskScope<'s, 'env>,
```

---

### Incident Patch 6: `4ab15e5f` (2026-10-07)
**Commit Message**: refactor(rust): Fix `cut`/`rename` error messages and include offending values in others (#29721)

**File**: `crates/polars-compute/src/approx_quantile.rs` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ impl<T: fmt::Debug + Clone + TotalOrd> FinalizedSketch<T> {
     pub fn estimate_quantile(&self, quantile: f64) -> PolarsResult<Option<&T>> {
         polars_ensure!(
             (0.0..=1.0).contains(&quantile),
-            ComputeError: "`quantile` should be between 0.0 and 1.0",
+            ComputeError: "`quantile` should be between 0.0 and 1.0, got {}", quantile,
         );
         // We round with ties toward ∞ for consistency with the regular quantile.
         let num_items = self.num_items();
```

**File**: `crates/polars-compute/src/cast/mod.rs` (modified, +5/-1)
```diff
@@ -414,7 +414,11 @@ pub fn cast(
     match (from_type, to_type) {
         (Null, _) | (_, Null) => Ok(new_null_array(to_type.clone(), array.len())),
         (Struct(from_fd), Struct(to_fd)) => {
-            polars_ensure!(from_fd.len() == to_fd.len(), InvalidOperation: "Cannot cast struct with different number of fields.");
+            polars_ensure!(
+                from_fd.len() == to_fd.len(),
+                InvalidOperation: "Cannot cast struct with different number of fields ({} vs {}).",
+                from_fd.len(), to_fd.len()
+            );
             cast_struct(array.as_any().downcast_ref().unwrap(), to_type, options).map(|x| x.boxed())
         },
         (Struct(_), _) | (_, Struct(_)) => polars_bail!(InvalidOperation:
```

**File**: `crates/polars-compute/src/decimal.rs` (modified, +2/-2)
```diff
@@ -36,8 +36,8 @@ use polars_error::{PolarsResult, polars_ensure};
 pub const DEC128_MAX_PREC: usize = 38;
 
 pub fn dec128_verify_prec_scale(p: usize, s: usize) -> PolarsResult<()> {
-    polars_ensure!((1..=DEC128_MAX_PREC).contains(&p), InvalidOperation: "precision must be between 1 and 38");
-    polars_ensure!(s <= p, InvalidOperation: "scale must be less than or equal to precision");
+    polars_ensure!((1..=DEC128_MAX_PREC).contains(&p), InvalidOperation: "precision must be between 1 and 38, got {}", p);
+    polars_ensure!(s <= p, InvalidOperation: "scale must be less than or equal to precision, got scale {} and precision {}", s, p);
     Ok(())
 }
 
```

**File**: `crates/polars-core/src/chunked_array/cast.rs` (modified, +2/-1)
```diff
@@ -540,7 +540,8 @@ impl ChunkCast for ArrayChunked {
             Array(child_type, width) => {
                 polars_ensure!(
                     *width == ca.width(),
-                    InvalidOperation: "cannot cast Array to a different width"
+                    InvalidOperation: "cannot cast Array to a different width (from {} to {})",
+                    ca.width(), width
                 );
 
                 match (ca.inner_dtype(), &**child_type) {
```

**File**: `crates/polars-core/src/chunked_array/ops/aggregate/quantile.rs` (modified, +3/-3)
```diff
@@ -74,7 +74,7 @@ fn quantile_slice<T: ToPrimitive + TotalOrd + Copy>(
     method: QuantileMethod,
 ) -> PolarsResult<Option<f64>> {
     polars_ensure!((0.0..=1.0).contains(&quantile),
-        ComputeError: "quantile should be between 0.0 and 1.0",
+        ComputeError: "quantile should be between 0.0 and 1.0, got {}", quantile,
     );
     if vals.is_empty() {
         return Ok(None);
@@ -125,7 +125,7 @@ fn quantiles_slice<T: ToPrimitive + TotalOrd + Copy>(
     for &q in quantiles {
         polars_ensure!(
             (0.0..=1.0).contains(&q),
-            ComputeError: "quantile should be between 0.0 and 1.0"
+            ComputeError: "quantile should be between 0.0 and 1.0, got {}", q
         );
     }
 
@@ -188,7 +188,7 @@ where
     for &q in quantiles {
         polars_ensure!(
             (0.0..=1.0).contains(&q),
-            ComputeError: "`quantile` should be between 0.0 and 1.0",
+            ComputeError: "`quantile` should be between 0.0 and 1.0, got {}", q,
         );
     }
 
```

**File**: `crates/polars-core/src/chunked_array/random.rs` (modified, +2/-1)
```diff
@@ -67,7 +67,8 @@ fn ensure_shape(n: usize, len: usize, with_replacement: bool) -> PolarsResult<()
     polars_ensure!(
         with_replacement || n <= len,
         ShapeMismatch:
-        "cannot take a larger sample than the total population when `with_replacement=false`"
+        "cannot take a larger sample than the total population when `with_replacement=false` (sample size: {}, population: {})",
+        n, len
     );
     Ok(())
 }
```

**File**: `crates/polars-ops/src/series/ops/cut.rs` (modified, +10/-2)
```diff
@@ -149,7 +149,11 @@ pub fn cut(
     }
 
     let cut_labels = if let Some(l) = labels {
-        polars_ensure!(l.len() == breaks.len() + 1, ShapeMismatch: "provide len(quantiles) + 1 labels");
+        polars_ensure!(
+            l.len() == breaks.len() + 1,
+            ShapeMismatch: "expected {} labels (len(breaks) + 1), got {}",
+            breaks.len() + 1, l.len()
+        );
         l
     } else {
         compute_cut_labels(&breaks, left_closed)?
@@ -213,7 +217,11 @@ pub fn qcut(
     }
 
     let cut_labels = if let Some(l) = labels {
-        polars_ensure!(l.len() == qbreaks.len() + 1, ShapeMismatch: "provide len(quantiles) + 1 labels");
+        polars_ensure!(
+            l.len() == qbreaks.len() + 1,
+            ShapeMismatch: "expected {} labels (len(breaks) + 1), got {}",
+            qbreaks.len() + 1, l.len()
+        );
         l
     } else {
         compute_cut_labels(&qbreaks, left_closed)?
```

**File**: `crates/polars-ops/src/series/ops/ewm.rs` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ use polars_compute::ewm::{ewm_std as kernel_ewm_std, ewm_var as kernel_ewm_var};
 use polars_core::prelude::*;
 
 fn check_alpha(alpha: f64) -> PolarsResult<()> {
-    polars_ensure!((0.0..=1.0).contains(&alpha), ComputeError: "alpha must be in [0; 1]");
+    polars_ensure!((0.0..=1.0).contains(&alpha), ComputeError: "alpha must be in [0; 1], got {}", alpha);
     Ok(())
 }
 
```

---

### Incident Patch 7: `d20d75f4` (2026-10-07)
**Commit Message**: fix: NegativeSlice could hold onto more data than necessary (#29779)

**File**: `crates/polars-stream/src/nodes/negative_slice.rs` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ impl ComputeNode for NegativeSliceNode {
                         spill_ctx.register(&sf).await;
                         buffer.frames.push_back(sf);
 
-                        if buffer.total_len - buffer.frames.front().unwrap().height()
+                        while buffer.total_len - buffer.frames.front().unwrap().height()
                             >= max_buffer_needed
                         {
                             buffer.total_len -= buffer.frames.pop_front().unwrap().height();
```

---

### Incident Patch 8: `3def0ce9` (2026-10-07)
**Commit Message**: fix: Fix small bugs in SQL aggregates and in group contexts (#29754)

**File**: `crates/polars-core/src/frame/group_by/aggregations/agg_list.rs` (modified, +6/-0)
```diff
@@ -193,6 +193,12 @@ impl AggList for BinaryChunked {
     }
 }
 
+impl AggList for BinaryOffsetChunked {
+    unsafe fn agg_list(&self, groups: &GroupsType) -> Series {
+        agg_list_by_gather_and_offsets(self, groups)
+    }
+}
+
 impl AggList for ListChunked {
     unsafe fn agg_list(&self, groups: &GroupsType) -> Series {
         agg_list_by_gather_and_offsets(self, groups)
```

**File**: `crates/polars-core/src/series/implementations/binary_offset.rs` (modified, +5/-0)
```diff
@@ -46,6 +46,11 @@ impl private::PrivateSeries for SeriesWrap<BinaryOffsetChunked> {
         IntoGroupsType::group_tuples(&self.0, multithreaded, sorted)
     }
 
+    #[cfg(feature = "algorithm_group_by")]
+    unsafe fn agg_list(&self, groups: &GroupsType) -> Series {
+        self.0.agg_list(groups)
+    }
+
     fn arg_sort_multiple(
         &self,
         by: &[Column],
```

**File**: `crates/polars-core/src/series/mod.rs` (modified, +3/-0)
```diff
@@ -584,6 +584,9 @@ impl Series {
                 })
             },
 
+            // Arrow `LargeBinary` arrays are read into a series as `Binary`.
+            (D::Binary, D::BinaryOffset) => self.cast(&D::BinaryOffset),
+
             (D::Int32, D::Date) => feature_gated!("dtype-date", Ok(self.clone().into_date())),
             (D::Int64, D::Datetime(tu, tz)) => feature_gated!(
                 "dtype-datetime",
```

**File**: `crates/polars-expr/src/expressions/apply.rs` (modified, +6/-4)
```diff
@@ -348,6 +348,8 @@ impl ApplyExpr {
         let mut container = vec![Default::default(); acs.len()];
         let schema = self.get_input_schema(df);
         let field = self.to_field(&schema)?;
+        // Without groups there is no output to take the dtype of a dynamic literal from.
+        let dtype = field.dtype.clone().materialize_unknown(true)?;
 
         // Aggregate representation of the aggregation contexts,
         // then unpack the lists and finally create iterators from this list chunked arrays.
@@ -359,8 +361,8 @@ impl ApplyExpr {
         // Length of the items to iterate over.
         let len = iters[0].size_hint().0;
 
-        let ca = if field.dtype().is_known() {
-            let mut builder = get_list_builder(&field.dtype, len * 5, len, field.name);
+        let ca = if dtype.is_known() {
+            let mut builder = get_list_builder(&dtype, len * 5, len, field.name);
             for _ in 0..len {
                 container.clear();
                 for iter in &mut iters {
@@ -402,8 +404,8 @@ impl ApplyExpr {
         #[cfg(debug_assertions)]
         {
             let inner = ca.dtype().inner_dtype().unwrap();
-            if field.dtype.is_known() {
-                assert_eq!(inner, &field.dtype);
+            if dtype.is_known() {
+                assert_eq!(inner, &dtype);
             }
         }
 
```

**File**: `crates/polars-expr/src/expressions/gather.rs` (modified, +42/-24)
```diff
@@ -62,31 +62,49 @@ impl PhysicalExpr for GatherExpr {
         // - IdxSize, if the idx only contains positive integers.
         // - Int64,   if the idx contains negative numbers.
         // This may give false positives if there are masked out elements.
+        // With `null_on_oob`, the indices are not cast, as a cast could wrap a large index
+        // into the bounds.
         let idx = idx.aggregated_as_list();
-        let idx = idx.apply_to_inner(&|s| match s.dtype() {
-            dtype if dtype == &IDX_DTYPE => Ok(s),
-            dtype if dtype.is_unsigned_integer() => {
-                s.cast_with_options(&IDX_DTYPE, CastOptions::Strict)
-            },
-
-            dtype if dtype.is_signed_integer() => {
-                let has_negative_integers = s.lt(0)?.any();
-                if has_negative_integers && dtype == &DataType::Int64 {
-                    Ok(s)
-                } else if has_negative_integers {
-                    s.cast_with_options(&DataType::Int64, CastOptions::Strict)
-                } else {
-                    s.cast_with_options(&IDX_DTYPE, CastOptions::Overflowing)
-                }
-            },
-            _ => polars_bail!(
-                op = "gather/get",
-                got = s.dtype(),
-                expected = "integer type"
-            ),
-        })?;
-
-        let taken = if idx.inner_dtype() == &IDX_DTYPE {
+        let idx = if self.null_on_oob {
+            idx.into_owned()
+        } else {
+            idx.apply_to_inner(&|s| match s.dtype() {
+                dtype if dtype == &IDX_DTYPE => Ok(s),
+                dtype if dtype.is_unsigned_integer() => {
+                    s.cast_with_options(&IDX_DTYPE, CastOptions::Strict)
+                },
+
+                dtype if dtype.is_signed_integer() => {
+                    let has_negative_integers = s.lt(0)?.any();
+                    if has_negative_integers && dtype == &DataType::Int64 {
+                        Ok(s)
+                    } else if has_negative_integers {
+                        s.cast_with_options(&DataType::Int64, CastOptions::Strict)
+                    } else {
+                        s.cast_with_options(&IDX_DTYPE, CastOptions::Overflowing)
+                    }
+                },
+                _ => polars_bail!(
+                    op = "gather/get",
+                    got = s.dtype(),
+                    expected = "integer type"
+                ),
+            })?
+        };
+
+        let taken = if self.null_on_oob {
+            ac_list
+                .amortized_iter()
+                .zip(idx.amortized_iter())
+                .map(|(s, idx)| {
+                    let s = s?;
+                    let idx = convert_and_bound_index(idx?.as_ref(), s.as_ref().len(), true);
+                    Some(idx.and_then(|idx| s.as_ref().take(&idx)))
+                })
+                .map(|opt_res| opt_res.transpose())
+                .collect::<PolarsResult<ListChunked>>()?
+                .with_name(ac.get_values().name().clone())
+        } else if idx.inner_dtype() == &IDX_DTYPE {
             // Fast path: all indices are positive.
 
             ac_list
```

**File**: `crates/polars-expr/src/expressions/ternary.rs` (modified, +14/-8)
```diff
@@ -130,20 +130,26 @@ impl PhysicalExpr for TernaryExpr {
         });
 
         let masked_df = |names: &[PlSmallStr], mask: &Bitmap| -> PolarsResult<DataFrame> {
-            let columns = names
-                .iter()
+            let columns: Vec<&Column> = names.iter().map(|c| df.column(c).unwrap()).collect();
+            // Common subexpression elimination can add a scalar column of one row to a frame
+            // with another height. A branch that only reads such columns under a scalar
+            // predicate is a scalar too.
+            let height = if mask.len() == 1 && columns.iter().all(|c| c.len() == 1) {
+                1
+            } else {
+                df.height()
+            };
+            let columns = columns
+                .into_iter()
                 .map(|c| {
-                    let c = df.column(c).unwrap();
-                    // Common subexpression elimination can add a scalar column of one row to a
-                    // frame with another height.
-                    if c.len() == 1 && df.height() != 1 {
-                        c.new_from_index(0, df.height()).mask(mask)
+                    if c.len() != height {
+                        c.new_from_index(0, height).mask(mask)
                     } else {
                         c.mask(mask)
                     }
                 })
                 .collect();
-            DataFrame::new(df.height(), columns)
+            DataFrame::new(height, columns)
         };
         let op_truthy = || {
             if self.truthy_mask_columns.is_empty() || false_count == 0 {
```

**File**: `crates/polars-ops/src/chunked_array/cov.rs` (modified, +4/-1)
```diff
@@ -11,7 +11,10 @@ where
     ChunkedArray<T>: ChunkVar,
 {
     if a.len() == 1 || b.len() == 1 {
-        return Some(0.0); // (Broadcasted) constant -> zero covariance.
+        // (Broadcasted) constant -> zero covariance, over the rows where both are valid.
+        let (constant, other) = if a.len() == 1 { (a, b) } else { (b, a) };
+        let n = other.len() - other.null_count();
+        return (constant.null_count() == 0 && n > ddof as usize).then_some(0.0);
     }
     let (a, b) = align_chunks_binary(a, b);
     let mut out = CovState::default();
```

**File**: `crates/polars-ops/src/series/ops/index.rs` (modified, +2/-0)
```diff
@@ -43,6 +43,7 @@ where
                         out.push_unchecked(v_u64 as IdxSize);
                         in_bounds.push_unchecked(v_u64 < len_u64);
                     } else {
+                        out.push_unchecked(0);
                         in_bounds.push_unchecked(false);
                     }
                 }
@@ -61,6 +62,7 @@ where
                         out.push_unchecked(shifted as IdxSize);
                         in_bounds.push_unchecked((v_i64 >= -len_i64) & (v_i64 < len_i64));
                     } else {
+                        out.push_unchecked(0);
                         in_bounds.push_unchecked(false);
                     }
                 }
```

---

### Incident Patch 9: `15d6ec58` (2026-10-07)
**Commit Message**: fix: Fix `clip` not broadcasting length-1 input against full-length bounds (#29666)

Co-authored-by: Taha Kotil <[REDACTED_EMAIL]>

**File**: `crates/polars-ops/src/series/ops/clip.rs` (modified, +16/-9)
```diff
@@ -1,6 +1,7 @@
 use polars_core::prelude::arity::{binary_elementwise, ternary_elementwise, unary_elementwise};
 use polars_core::prelude::*;
 use polars_core::with_match_physical_numeric_polars_type;
+use polars_utils::broadcast::broadcast_len;
 
 #[inline]
 fn clamp<T: PartialOrd>(input: T, min: T, max: T) -> T {
@@ -63,7 +64,7 @@ pub fn clip(s: &Series, min: &Series, max: &Series) -> PolarsResult<Series> {
         let ca: &ChunkedArray<$T> = s.as_ref().as_ref().as_ref();
         let min: &ChunkedArray<$T> = min.as_ref().as_ref().as_ref();
         let max: &ChunkedArray<$T> = max.as_ref().as_ref().as_ref();
-        let out = clip_helper_both_bounds(ca, min, max).into_series();
+        let out = clip_helper_both_bounds(ca, min, max)?.into_series();
         match original_type {
             #[cfg(feature = "dtype-decimal")]
             DataType::Decimal(precision, scale) => {
@@ -99,7 +100,7 @@ pub fn clip_max(s: &Series, max: &Series) -> PolarsResult<Series> {
     with_match_physical_numeric_polars_type!(s.dtype(), |$T| {
         let ca: &ChunkedArray<$T> = s.as_ref().as_ref().as_ref();
         let max: &ChunkedArray<$T> = max.as_ref().as_ref().as_ref();
-        let out = clip_helper_single_bound(ca, max, clamp_max).into_series();
+        let out = clip_helper_single_bound(ca, max, clamp_max)?.into_series();
         match original_type {
             #[cfg(feature = "dtype-decimal")]
             DataType::Decimal(precision, scale) => {
@@ -135,7 +136,7 @@ pub fn clip_min(s: &Series, min: &Series) -> PolarsResult<Series> {
     with_match_physical_numeric_polars_type!(s.dtype(), |$T| {
         let ca: &ChunkedArray<$T> = s.as_ref().as_ref().as_ref();
         let min: &ChunkedArray<$T> = min.as_ref().as_ref().as_ref();
-        let out = clip_helper_single_bound(ca, min, clamp_min).into_series();
+        let out = clip_helper_single_bound(ca, min, clamp_min)?.into_series();
         match original_type {
             #[cfg(feature = "dtype-decimal")]
             DataType::Decimal(precision, scale) => {
@@ -152,12 +153,14 @@ fn clip_helper_both_bounds<T>(
     ca: &ChunkedArray<T>,
     min: &ChunkedArray<T>,
     max: &ChunkedArray<T>,
-) -> ChunkedArray<T>
+) -> PolarsResult<ChunkedArray<T>>
 where
     T: PolarsNumericType,
     T::Native: PartialOrd,
 {
-    match (min.len(), max.len()) {
+    let len = broadcast_len([ca.len(), min.len(), max.len()])?;
+    let ca = &*ca.broadcast_to(len)?;
+    let out = match (min.len(), max.len()) {
         (1, 1) => match (min.get(0), max.get(0)) {
             (Some(min), Some(max)) => clip_unary(ca, |v| clamp(v, min, max)),
             (Some(min), None) => clip_unary(ca, |v| clamp_min(v, min)),
@@ -189,20 +192,23 @@ where
             }),
         },
         _ => clip_ternary(ca, min, max),
-    }
+    };
+    Ok(out)
 }
 
 fn clip_helper_single_bound<T, F>(
     ca: &ChunkedArray<T>,
     bound: &ChunkedArray<T>,
     op: F,
-) -> ChunkedArray<T>
+) -> PolarsResult<ChunkedArray<T>>
 where
     T: PolarsNumericType,
     T::Native: PartialOrd,
     F: Fn(T::Native, T::Native) -> T::Native,
 {
-    match bound.len() {
+    let len = broadcast_len([ca.len(), bound.len()])?;
+    let ca = &*ca.broadcast_to(len)?;
+    let out = match bound.len() {
         1 => match bound.get(0) {
             Some(bound) => clip_unary(ca, |v| op(v, bound)),
             None => ca.clone(),
@@ -212,7 +218,8 @@ where
             (Some(s), None) => Some(s),
             (None, _) => None,
         }),
-    }
+    };
+    Ok(out)
 }
 
 fn clip_unary<T, F>(ca: &ChunkedArray<T>, op: F) -> ChunkedArray<T>
```

**File**: `py-polars/tests/unit/operations/test_clip.py` (modified, +49/-0)
```diff
@@ -229,6 +229,55 @@ def test_clip_mixed_scalar_series_bound_with_nulls_lazy_27086() -> None:
     assert_frame_equal(result, pl.LazyFrame({"a": [None, 5, 7]}))
 
 
+def test_clip_length_one_input_broadcasts_to_bounds_29644() -> None:
+    s = pl.Series([5])
+    bounds = pl.Series([1, 2, 3, 4])
+
+    assert_series_equal(s.clip(upper_bound=bounds), pl.Series([1, 2, 3, 4]))
+    assert_series_equal(s.clip(lower_bound=bounds), pl.Series([5, 5, 5, 5]))
+    assert_series_equal(s.clip(bounds, bounds + 10), pl.Series([5, 5, 5, 5]))
+    assert_series_equal(s.clip(bounds + 3, bounds + 10), pl.Series([5, 5, 6, 7]))
+    assert_series_equal(
+        s.clip(lower_bound=6, upper_bound=bounds), pl.Series([6, 6, 6, 6])
+    )
+    assert_series_equal(
+        s.clip(lower_bound=bounds, upper_bound=3), pl.Series([3, 3, 3, 3])
+    )
+
+    # Null bounds leave the broadcast input untouched.
+    nulls = pl.Series([None, 2, None], dtype=pl.Int64)
+    assert_series_equal(s.clip(upper_bound=nulls), pl.Series([5, 2, 5]))
+    assert_series_equal(s.clip(nulls, nulls), pl.Series([5, 2, 5]))
+
+    # A null input stays null.
+    null_input = pl.Series([None], dtype=pl.Int64)
+    assert_series_equal(
+        null_input.clip(upper_bound=bounds), pl.Series([None] * 4, dtype=pl.Int64)
+    )
+
+    # A length-1 input with length-1 bounds is not broadcast.
+    assert_series_equal(s.clip(pl.Series([1]), pl.Series([3])), pl.Series([3]))
+
+
+def test_clip_length_one_input_broadcasts_to_bounds_lazy_29644() -> None:
+    lf = pl.LazyFrame({"a": [1.0, 2.0, None, 3.0]})
+    q = lf.select(
+        x=pl.lit(5).clip(pl.col("a") + 3, pl.col("a") + 10),
+        y=pl.lit(5).clip(upper_bound=pl.col("a")),
+        z="a",
+    )
+    expected = pl.DataFrame(
+        {
+            "x": [5, 5, 5, 6],
+            "y": [1, 2, 5, 3],
+            "z": [1.0, 2.0, None, 3.0],
+        },
+        schema_overrides={"y": pl.Int32, "x": pl.Int32},
+    )
+    assert_frame_equal(q.collect(engine="in-memory"), expected)
+    assert_frame_equal(q.collect(engine="streaming"), expected)
+
+
 def test_clip_bound_nan() -> None:
     assert_series_equal(
         pl.Series([1.0, 2.0]).clip(float("nan"), float("nan")),
```

---

### Incident Patch 10: `1288c7d3` (2026-10-07)
**Commit Message**: fix(python): Fix scan_lance CancelledError (#29774)

**File**: `py-polars/src/polars/io/lance/_reader.py` (modified, +1/-1)
```diff
@@ -242,7 +242,7 @@ def collect_batches(
                 yield fut.result()
 
             with CX_LOCK:
-                if (exc := self.multi_scan_context.pop(CX_ERROR_KEY, None)) is not None:
+                if (exc := self.multi_scan_context.get(CX_ERROR_KEY)) is not None:
                     raise exc  # noqa: TRY301
 
         except GeneratorExit:
```

---

### Incident Patch 11: `f0102f7a` (2026-10-07)
**Commit Message**: fix: Fix cross join filters on Decimals of different scales (#29776)

**File**: `crates/polars-plan/src/plans/optimizer/predicate_pushdown/join/predicate_pruning.rs` (modified, +185/-63)
```diff
@@ -1,3 +1,5 @@
+use polars_core::chunked_array::cast::CastOptions;
+
 use super::*;
 use crate::plans::aexpr::{ExprPushdownGroup, is_inherently_nondeterministic};
 
@@ -80,6 +82,114 @@ pub(super) fn push_down_join_condition(
     Ok(())
 }
 
+/// Changes that give both sides of a join key the same dtype.
+#[derive(Default)]
+struct JoinKeyCasts {
+    lhs: Option<KeyCast>,
+    rhs: Option<KeyCast>,
+}
+
+#[cfg_attr(not(feature = "dtype-decimal"), allow(dead_code))]
+enum KeyCast {
+    Dtype(DataType),
+    /// Use the raw Int128 value of a Decimal, scaled up by `10^upscale`.
+    #[cfg(all(feature = "dtype-decimal", feature = "round_series"))]
+    DecimalPhysical {
+        upscale: usize,
+    },
+}
+
+impl JoinKeyCasts {
+    /// Comparisons accept Decimals of different scales, but join keys must have the same dtype.
+    /// Returns `None` if the sides can't be given the same dtype.
+    fn new(lhs: &DataType, rhs: &DataType) -> Option<Self> {
+        if lhs == rhs {
+            return Some(Self::default());
+        }
+        match (lhs, rhs) {
+            #[cfg(feature = "dtype-decimal")]
+            (DataType::Decimal(lhs_prec, lhs_scale), DataType::Decimal(rhs_prec, rhs_scale)) => {
+                let scale = *lhs_scale.max(rhs_scale);
+                let prec = (lhs_prec - lhs_scale).max(rhs_prec - rhs_scale) + scale;
+                if prec > polars_compute::decimal::DEC128_MAX_PREC {
+                    // No Decimal holds both sides, so join on the raw values at the larger scale.
+                    #[cfg(feature = "round_series")]
+                    return Some(Self {
+                        lhs: Some(KeyCast::DecimalPhysical {
+                            upscale: scale - lhs_scale,
+                        }),
+                        rhs: Some(KeyCast::DecimalPhysical {
+                            upscale: scale - rhs_scale,
+                        }),
+                    });
+                    #[cfg(not(feature = "round_series"))]
+                    return None;
+                }
+                let dtype = DataType::Decimal(prec, scale);
+                Some(Self {
+                    lhs: (*lhs != dtype).then(|| KeyCast::Dtype(dtype.clone())),
+                    rhs: (*rhs != dtype).then_some(KeyCast::Dtype(dtype)),
+                })
+            },
+            _ => None,
+        }
+    }
+
+    fn apply(self, lhs: &mut Node, rhs: &mut Node, expr_arena: &mut Arena<AExpr>) {
+        for (node, cast) in [(lhs, self.lhs), (rhs, self.rhs)] {
+            let Some(cast) = cast else {
+                continue;
+            };
+            *node = match cast {
+                KeyCast::Dtype(dtype) => expr_arena.add(AExpr::Cast {
+                    expr: *node,
+                    dtype,
+                    options: CastOptions::Overflowing,
+                }),
+                #[cfg(all(feature = "dtype-decimal", feature = "round_series"))]
+                KeyCast::DecimalPhysical { upscale } => {
+                    decimal_physical_key(*node, upscale, expr_arena)
+                },
+            };
+        }
+    }
+}
+
+/// The raw Int128 value of a Decimal, scaled up by `10^upscale`. Values that would need more
+/// than 38 digits are larger than any Decimal on the other side, so they are capped there
+/// instead of overflowing.
+#[cfg(all(feature = "dtype-decimal", feature = "round_series"))]
+fn decimal_physical_key(node: Node, upscale: usize, expr_arena: &mut Arena<AExpr>) -> Node {
+    use polars_compute::decimal::DEC128_MAX_PREC;
+
+    let physical = AExprBuilder::function(
+        vec![ExprIR::from_node(node, expr_arena)],
+        IRFunctionExpr::ToPhysical,
+        expr_arena,
+    );
+    if upscale == 0 {
+        return physical.node();
+    }
+    let bound = 10i128.pow((DEC128_MAX_PREC - upscale) as u32);
+    let min = AExprBuilder::lit_scalar(Scalar::from(-bound), expr_arena);
+    let max = AExprBuilder::lit_scalar(Scalar::from(bound), expr_arena);
+    let factor = AExprBuilder::lit_scalar(Scalar::from(10i128.pow(upscale as u32)), expr_arena);
+    AExprBuilder::function(
+        vec![
+            physical.expr_ir_retain_name(expr_arena),
+            min.expr_ir_retain_name(expr_arena),
+            max.expr_ir_retain_name(expr_arena),
+        ],
+        IRFunctionExpr::Clip {
+            has_min: true,
+            has_max: true,
+        },
+        expr_arena,
+    )
+    .multiply(factor, expr_arena)
+    .node()
+}
+
 #[cfg(feature = "iejoin")]
 /// Removes all inequality filters that can be used as iejoin conditions from `acc_predicates`.
 pub fn take_iejoin_compatible_filters(
@@ -89,8 +199,8 @@ pub fn take_iejoin_compatible_filters(
     schema_right: &Schema,
     output_schema: &Schema,
     suffix: &str,
-) -> PolarsResult<indexmap::map::IntoValues<Node, IEJoinCompatiblePredicate>> {
-    return take_predicates_mut(acc_predicates, expr_arena, |ae, ae_node, expr_arena| {
+) -> PolarsResult<Vec<IEJoinCompatible
```

**File**: `py-polars/tests/unit/operations/test_inequality_join.py` (modified, +45/-0)
```diff
@@ -998,6 +998,51 @@ def test_join_where_decimal_vs_float() -> None:
     }
 
 
+@pytest.mark.parametrize("engine", ["in-memory", "streaming"])
+@pytest.mark.parametrize(
+    "predicate",
+    [
+        pl.col("a") > pl.col("b"),
+        pl.col("b") >= pl.col("a"),
+        pl.col("a") == pl.col("b"),
+    ],
+)
+@pytest.mark.parametrize(
+    ("left_dtype", "right_dtype"),
+    [
+        # Both sides fit in Decimal(38, 4).
+        (pl.Decimal(10, 2), pl.Decimal(38, 4)),
+        # No Decimal holds both sides.
+        (pl.Decimal(38, 2), pl.Decimal(38, 12)),
+        (pl.Decimal(38, 12), pl.Decimal(38, 2)),
+    ],
+)
+def test_cross_join_filter_decimal_scales_29762(
+    engine: EngineType,
+    predicate: pl.Expr,
+    left_dtype: pl.Decimal,
+    right_dtype: pl.Decimal,
+) -> None:
+    def frame(name: str, dtype: pl.Decimal) -> pl.LazyFrame:
+        max_value = "9" * (dtype.precision - dtype.scale) + "." + "9" * dtype.scale
+        values = ["-2.5", "1", "3.25", max_value, f"-{max_value}", None]
+        if dtype.scale >= 4:
+            values.append("3.2501")
+        return pl.LazyFrame({name: values}).cast(dtype)
+
+    q = (
+        frame("a", left_dtype)
+        .join(frame("b", right_dtype), how="cross")
+        .filter(predicate)
+    )
+
+    expected = q.collect(optimizations=pl.QueryOptFlags(predicate_pushdown=False))
+    assert_frame_equal(q.collect(engine=engine), expected, check_row_order=False)
+    plan = q.explain(engine=engine)
+    assert "CROSS JOIN" not in plan
+    assert "NESTED LOOP" not in plan
+
+
 @pytest.mark.parametrize("engine", ["in-memory", "streaming"])
 @pytest.mark.parametrize("with_key", [False, True])
 @pytest.mark.parametrize("empty_left", [False, True])
```

**File**: `py-polars/tests/unit/sql/test_joins.py` (modified, +17/-0)
```diff
@@ -117,6 +117,23 @@ def test_join_cross_11927() -> None:
     assert res.collect().is_empty()
 
 
+@pytest.mark.parametrize("engine", ["in-memory", "streaming"])
+def test_cross_join_filter_decimal_scales_29762(engine: Any) -> None:
+    pv = pl.DataFrame(
+        {"ps_partkey": [1, 2, 3], "value": ["10.50", "2.25", "7.00"]},
+        schema_overrides={"value": pl.Decimal(38, 2)},
+    )
+    src = pl.DataFrame({"v": ["100.00"]}, schema_overrides={"v": pl.Decimal(38, 2)})
+    res = pl.SQLContext(pv=pv, src=src).execute(
+        """
+        WITH gv AS (SELECT SUM(v) * (0.0001 / 30) AS threshold FROM src)
+        SELECT pv.ps_partkey FROM pv CROSS JOIN gv
+        WHERE pv.value > gv.threshold ORDER BY pv.value DESC
+        """
+    )
+    assert res.collect(engine=engine)["ps_partkey"].to_list() == [1, 3, 2]
+
+
 def test_cross_join_unnest_from_table() -> None:
     df = pl.DataFrame({"id": [1, 2], "items": [[100, 200], [300, 400, 500]]})
     assert_sql_matches(
```

---

### Incident Patch 12: `a7fc4d01` (2026-10-07)
**Commit Message**: fix: Use correct bucket for CSV and NDJSON cloud scans (#29772)

**File**: `crates/polars-io/src/file_cache/utils.rs` (modified, +43/-10)
```diff
@@ -2,12 +2,15 @@ use std::sync::{Arc, LazyLock};
 use std::time::UNIX_EPOCH;
 
 use polars_error::{PolarsError, PolarsResult};
+use polars_utils::aliases::PlHashMap;
 use polars_utils::pl_path::{CloudScheme, PlRefPath};
 
 use super::cache::{FILE_CACHE, get_env_file_cache_ttl};
 use super::entry::FileCacheEntry;
 use super::file_fetcher::{CloudFileFetcher, LocalFileFetcher};
-use crate::cloud::{CloudLocation, CloudOptions, build_object_store, object_path_from_str};
+use crate::cloud::{
+    CloudLocation, CloudOptions, PolarsObjectStore, build_object_store, object_path_from_str,
+};
 use crate::path_utils::{POLARS_TEMP_DIR_BASE_PATH, ensure_directory_init};
 
 pub static FILE_CACHE_PREFIX: LazyLock<PlRefPath> = LazyLock::new(|| {
@@ -72,21 +75,51 @@ async fn init_entries_from_uri_list_impl(
         .unwrap_or_else(get_env_file_cache_ttl);
 
     if first_uri.has_scheme() {
-        let shared_object_store = if !matches!(
+        let uri_list: Vec<PlRefPath> = uri_list.collect();
+
+        // Http URIs can differ in origin.
+        let is_http = matches!(
             first_uri.scheme(),
-            Some(CloudScheme::Http | CloudScheme::Https) // Http URIs can differ in origin.
-        ) {
-            let (_, object_store) = build_object_store(first_uri, cloud_options, false).await?;
-            Some(object_store)
+            Some(CloudScheme::Http | CloudScheme::Https)
+        );
+
+        let authorities: Vec<&str> = if is_http {
+            Vec::new()
         } else {
-            None
+            uri_list
+                .iter()
+                .map(|uri| &uri.as_str()[..uri.authority_end_position()])
+                .collect()
         };
 
-        futures::future::try_join_all(uri_list.map(|uri| {
-            let shared_object_store = shared_object_store.clone();
+        // One object store per bucket, held here so that global cache evictions cannot
+        // affect this call.
+        let mut representatives: PlHashMap<&str, &PlRefPath> = PlHashMap::default();
+        for (uri, authority) in uri_list.iter().zip(&authorities) {
+            representatives.entry(authority).or_insert(uri);
+        }
+
+        let shared_object_stores: PlHashMap<&str, PolarsObjectStore> =
+            futures::future::try_join_all(representatives.into_iter().map(
+                |(authority, uri)| async move {
+                    let (_, object_store) =
+                        build_object_store(uri.clone(), cloud_options, false).await?;
+                    PolarsResult::Ok((authority, object_store))
+                },
+            ))
+            .await?
+            .into_iter()
+            .collect();
+
+        futures::future::try_join_all(uri_list.iter().enumerate().map(|(i, uri)| {
+            let uri = uri.clone();
+            let shared_object_store = authorities
+                .get(i)
+                .and_then(|authority| shared_object_stores.get(authority))
+                .cloned();
 
             async move {
-                let object_store = if let Some(shared_object_store) = shared_object_store.clone() {
+                let object_store = if let Some(shared_object_store) = shared_object_store {
                     shared_object_store
                 } else {
                     let (_, object_store) =
```

**File**: `py-polars/tests/unit/io/cloud/test_cloud.py` (modified, +46/-0)
```diff
@@ -9,6 +9,7 @@
 import time
 from functools import partial
 from typing import TYPE_CHECKING, Any
+from uuid import uuid4
 
 import pytest
 
@@ -466,3 +467,48 @@ def record(environ: dict[str, Any]) -> None:
     for df, key in [(small, "small"), (large, "large")]:
         out = scan(f"s3://bucket/{key}", storage_options=s3.storage_options)
         assert_frame_equal(out.collect(), df)
+
+
+@pytest.mark.slow
+@pytest.mark.parametrize("decoy", [False, True])
+def test_scan_csv_mixed_buckets_29758(s3: CountingS3, decoy: bool) -> None:
+    # Unique keys: file cache entries are keyed by URI and persist across runs.
+    x, y = f"x_{uuid4()}.csv", f"y_{uuid4()}.csv"
+    s3.client.create_bucket(Bucket="bucket-2")
+    s3.client.put_object(Bucket="bucket", Key=x, Body=b"a\n1\n")
+    s3.client.put_object(Bucket="bucket-2", Key=y, Body=b"a\n2\n3\n4\n")
+    if decoy:
+        s3.client.put_object(Bucket="bucket", Key=y, Body=b"a\n9\n9\n")
+
+    paths = [f"s3://bucket/{x}", f"s3://bucket-2/{y}"]
+    expected = pl.DataFrame({"a": [1, 2, 3, 4]})
+
+    lf = pl.scan_csv(paths, storage_options=s3.storage_options)
+    assert_frame_equal(lf.collect(), expected)
+    assert lf.select(pl.len()).collect().item() == 4
+
+    lf = pl.scan_csv(
+        paths, infer_schema_length=None, storage_options=s3.storage_options
+    )
+    assert_frame_equal(lf.collect(), expected)
+
+
+@pytest.mark.slow
+def test_scan_ndjson_mixed_buckets_29758(s3: CountingS3) -> None:
+    x, y = f"x_{uuid4()}.ndjson", f"y_{uuid4()}.ndjson"
+    s3.client.create_bucket(Bucket="bucket-2")
+    s3.client.put_object(Bucket="bucket", Key=x, Body=b'{"a":1}\n')
+    s3.client.put_object(Bucket="bucket-2", Key=y, Body=b'{"a":2}\n')
+    s3.client.put_object(Bucket="bucket", Key=y, Body=b'{"a":9}\n')
+
+    paths = [f"s3://bucket/{x}", f"s3://bucket-2/{y}"]
+    expected = pl.DataFrame({"a": [1, 2]})
+
+    lf = pl.scan_ndjson(paths, storage_options=s3.storage_options)
+    assert_frame_equal(lf.collect(), expected)
+    assert lf.select(pl.len()).collect().item() == 2
+
+    lf = pl.scan_ndjson(
+        paths, infer_schema_length=None, storage_options=s3.storage_options
+    )
+    assert_frame_equal(lf.collect(), expected)
```

---

### Incident Patch 13: `74f2263b` (2026-10-07)
**Commit Message**: fix: Re-entrance in PyO3 PolarsAllocator (#29763)

**File**: `pyo3-polars/pyo3-polars/src/alloc.rs` (modified, +14/-13)
```diff
@@ -2,8 +2,7 @@ use std::alloc::{GlobalAlloc, Layout, System};
 use std::ffi::c_char;
 
 use once_cell::race::OnceRef;
-use pyo3::ffi::{PyCapsule_Import, Py_IsInitialized};
-use pyo3::Python;
+use pyo3::ffi::{PyCapsule_Import, PyGILState_Ensure, PyGILState_Release, Py_IsInitialized};
 
 unsafe extern "C" fn fallback_alloc(size: usize, align: usize) -> *mut u8 {
     System.alloc(Layout::from_size_align_unchecked(size, align))
@@ -68,17 +67,19 @@ impl PolarsAllocator {
         // otherwise it will cause infinite recursion.
         self.0.get_or_init(|| {
             let r = (unsafe { Py_IsInitialized() } != 0)
-                .then(|| {
-                    Python::attach(|_| unsafe {
-                        let capsule =
-                            (PyCapsule_Import(ALLOCATOR_CAPSULE_NAME.as_ptr() as *const c_char, 0)
-                                as *const AllocatorCapsule)
-                                .as_ref();
-                        if capsule.is_none() {
-                            pyo3::ffi::PyErr_Clear();
-                        }
-                        capsule
-                    })
+                .then(|| unsafe {
+                    // Use the C API instead of `Python::attach`, which can allocate
+                    // and thus recurse back into this function.
+                    let gstate = PyGILState_Ensure();
+                    let capsule =
+                        (PyCapsule_Import(ALLOCATOR_CAPSULE_NAME.as_ptr() as *const c_char, 0)
+                            as *const AllocatorCapsule)
+                            .as_ref();
+                    if capsule.is_none() {
+                        pyo3::ffi::PyErr_Clear();
+                    }
+                    PyGILState_Release(gstate);
+                    capsule
                 })
                 .flatten();
             #[cfg(debug_assertions)]
```

---

### Incident Patch 14: `22a147de` (2026-10-06)
**Commit Message**: perf: Fix phases ending too soon due to join sampling (#29752)

Co-authored-by: ritchie46 <[REDACTED_EMAIL]>

**File**: `crates/polars-stream/src/nodes/joins/equi_join.rs` (modified, +20/-21)
```diff
@@ -404,6 +404,8 @@ struct SampleState {
     left_len: usize,
     right: Vec<Morsel>,
     right_len: usize,
+    /// The number of rows each side may sample.
+    limits: [Arc<RelaxedCell<usize>>; 2],
     /// The only side being read: the preferred build side of a join with runtime
     /// filters, until it ends or reaches the sample limit. A side that ends is
     /// complete, so its key ranges are published before the other side is read.
@@ -1673,11 +1675,24 @@ impl ComputeNode for EquiJoinNode {
             EquiJoinState::Sample(sample_state) => {
                 send[0] = PortState::Blocked;
                 for (idx, left) in [(0, true), (1, false)] {
+                    // While both sides are sampled, sampling stops once a side has
+                    // `LOPSIDED_SAMPLE_FACTOR` times the rows of the other, done, side.
+                    let lopsided =
+                        sample_state.only_side.is_none() && recv[1 - idx] == PortState::Done;
+                    let limit = if lopsided {
+                        let lopsided_limit = sample_state
+                            .len(!left)
+                            .saturating_mul(LOPSIDED_SAMPLE_FACTOR);
+                        self.params.sample_limit.min(lopsided_limit)
+                    } else {
+                        self.params.sample_limit
+                    };
+                    sample_state.limits[idx].store(limit);
                     if recv[idx] == PortState::Done {
                         continue;
                     }
                     let open = sample_state.is_open(left);
-                    recv[idx] = if open && sample_state.len(left) < self.params.sample_limit {
+                    recv[idx] = if open && sample_state.len(left) < limit {
                         PortState::Ready
                     } else {
                         PortState::Blocked
@@ -1756,30 +1771,15 @@ impl ComputeNode for EquiJoinNode {
         match &mut self.state {
             EquiJoinState::Sample(sample_state) => {
                 assert!(send_ports[0].is_none());
-                // A side without a port is done, unless it is not being read.
-                let final_len = |left: bool| {
-                    let idx = if left { 0 } else { 1 };
-                    let known = recv_ports[idx].is_none() && sample_state.is_open(left);
-                    let len = if known {
-                        sample_state.len(left)
-                    } else {
-                        usize::MAX
-                    };
-                    Arc::new(RelaxedCell::from(len))
-                };
-                let left_final_len = final_len(true);
-                let right_final_len = final_len(false);
-
                 if let Some(left_recv) = recv_ports[0].take() {
                     join_handles.push(scope.spawn_task(
                         TaskPriority::High,
                         sample_sink(
                             left_recv.serial(),
                             &mut sample_state.left,
                             &mut sample_state.left_len,
-                            left_final_len.clone(),
-                            right_final_len.clone(),
-                            self.params.sample_limit,
+                            sample_state.limits[0].clone(),
+                            sample_state.limits[1].clone(),
                         ),
                     ));
                 }
@@ -1790,9 +1790,8 @@ impl ComputeNode for EquiJoinNode {
                             right_recv.serial(),
                             &mut sample_state.right,
                             &mut sample_state.right_len,
-                            right_final_len,
-                            left_final_len,
-                            self.params.sample_limit,
+                            sample_state.limits[1].clone(),
+                            sample_state.limits[0].clone(),
                         ),
                     ));
                 }
```

**File**: `crates/polars-stream/src/nodes/joins/mod.rs` (modified, +9/-12)
```diff
@@ -57,31 +57,28 @@ async fn select_key_columns(
     unsafe { DataFrame::new_unchecked_with_broadcast(df.height(), key_columns) }
 }
 
-/// Buffers the morsels of one side of a join until it ends, the sample limit
-/// is reached, or the other side ended and this side has many times its rows.
+/// Buffers the morsels of one side of a join until its stream ends or it has
+/// `limit` rows. When its stream ends, the other side is limited to
+/// `LOPSIDED_SAMPLE_FACTOR` times its rows: if this input is done, sampling ends
+/// there, and otherwise it continues in the next phase.
 async fn sample_sink(
     mut recv: PortReceiver,
     morsels: &mut Vec<Morsel>,
     len: &mut usize,
-    this_final_len: Arc<RelaxedCell<usize>>,
-    other_final_len: Arc<RelaxedCell<usize>>,
-    join_sample_limit: usize,
+    limit: Arc<RelaxedCell<usize>>,
+    other_limit: Arc<RelaxedCell<usize>>,
 ) -> PolarsResult<()> {
     while let Ok(mut morsel) = recv.recv().await {
         *len += morsel.height();
-        if *len >= join_sample_limit
-            || *len
-                >= other_final_len
-                    .load()
-                    .saturating_mul(LOPSIDED_SAMPLE_FACTOR)
-        {
+        if *len >= limit.load() {
             morsel.source_token().stop();
         }
 
         drop(morsel.take_consume_token());
         morsels.push(morsel);
     }
-    this_final_len.store(*len);
+    let lopsided_limit = len.saturating_mul(LOPSIDED_SAMPLE_FACTOR);
+    other_limit.store(other_limit.load().min(lopsided_limit));
     Ok(())
 }
 
```

**File**: `crates/polars-stream/src/nodes/joins/semi_anti_join.rs` (modified, +20/-21)
```diff
@@ -199,6 +199,8 @@ struct SampleState {
     left_len: usize,
     right: Vec<Morsel>,
     right_len: usize,
+    /// The number of rows each side may sample.
+    limits: [Arc<RelaxedCell<usize>>; 2],
     /// The only side being read: the preferred build side of a join with runtime
     /// filters, until it ends or reaches the sample limit. A side that ends is
     /// complete, so its keys are published before the other side is read.
@@ -1048,11 +1050,24 @@ impl ComputeNode for SemiAntiJoinNode {
             SemiAntiJoinState::Sample(sample_state) => {
                 send[0] = PortState::Blocked;
                 for (idx, left) in [(0, true), (1, false)] {
+                    // While both sides are sampled, sampling stops once a side has
+                    // `LOPSIDED_SAMPLE_FACTOR` times the rows of the other, done, side.
+                    let lopsided =
+                        sample_state.only_side.is_none() && recv[1 - idx] == PortState::Done;
+                    let limit = if lopsided {
+                        let lopsided_limit = sample_state
+                            .len(!left)
+                            .saturating_mul(LOPSIDED_SAMPLE_FACTOR);
+                        self.params.sample_limit.min(lopsided_limit)
+                    } else {
+                        self.params.sample_limit
+                    };
+                    sample_state.limits[idx].store(limit);
                     if recv[idx] == PortState::Done {
                         continue;
                     }
                     let open = sample_state.is_open(left);
-                    recv[idx] = if open && sample_state.len(left) < self.params.sample_limit {
+                    recv[idx] = if open && sample_state.len(left) < limit {
                         PortState::Ready
                     } else {
                         PortState::Blocked
@@ -1129,30 +1144,15 @@ impl ComputeNode for SemiAntiJoinNode {
         match &mut self.state {
             SemiAntiJoinState::Sample(sample_state) => {
                 assert!(send_ports[0].is_none());
-                // A side without a port is done, unless it is not being read.
-                let final_len = |left: bool| {
-                    let idx = if left { 0 } else { 1 };
-                    let known = recv_ports[idx].is_none() && sample_state.is_open(left);
-                    let len = if known {
-                        sample_state.len(left)
-                    } else {
-                        usize::MAX
-                    };
-                    Arc::new(RelaxedCell::from(len))
-                };
-                let left_final_len = final_len(true);
-                let right_final_len = final_len(false);
-
                 if let Some(left_recv) = recv_ports[0].take() {
                     join_handles.push(scope.spawn_task(
                         TaskPriority::High,
                         sample_sink(
                             left_recv.serial(),
                             &mut sample_state.left,
                             &mut sample_state.left_len,
-                            left_final_len.clone(),
-                            right_final_len.clone(),
-                            self.params.sample_limit,
+                            sample_state.limits[0].clone(),
+                            sample_state.limits[1].clone(),
                         ),
                     ));
                 }
@@ -1163,9 +1163,8 @@ impl ComputeNode for SemiAntiJoinNode {
                             right_recv.serial(),
                             &mut sample_state.right,
                             &mut sample_state.right_len,
-                            right_final_len,
-                            left_final_len,
-                            self.params.sample_limit,
+                            sample_state.limits[1].clone(),
+                            sample_state.limits[0].clone(),
                         ),
                     ));
                 }
```

**File**: `py-polars/tests/unit/sql/test_correlated_subqueries.py` (modified, +6/-1)
```diff
@@ -13,6 +13,7 @@
     from pathlib import Path
 
     from polars._typing import EngineType
+    from tests.conftest import PlMonkeyPatch
 
 
 def _frames() -> dict[str, pl.DataFrame]:
@@ -759,10 +760,14 @@ def source(
     return register_io_source(source, schema=df.schema, is_pure=True)
 
 
-def test_correlated_aggregate_unknown_outer_size_not_restricted() -> None:
+def test_correlated_aggregate_unknown_outer_size_not_restricted(
+    plmonkeypatch: PlMonkeyPatch,
+) -> None:
     # A source without a row count could be arbitrarily large, so the aggregate
     # is not restricted to its keys: caching it would read it whole before a
     # LIMIT could stop it.
+    # The join may sample this many rows of the outer before the LIMIT applies.
+    plmonkeypatch.setenv("POLARS_JOIN_SAMPLE_LIMIT", "1000")
     outer = pl.DataFrame({"k": range(2_000_000), "s": range(2_000_000)})
     yielded = 0
 
```

---

### Incident Patch 15: `d1d6ba4b` (2026-10-05)
**Commit Message**: fix: Find SQL aggregates by their function name, and raise on nested aggregate calls (#29751)

**File**: `crates/polars-sql/src/context.rs` (modified, +89/-550)
```diff
@@ -6,8 +6,7 @@ use polars_core::prelude::*;
 use polars_defs::join::{JoinArgs, JoinCoalesce, JoinType, MaintainOrderJoin};
 use polars_lazy::prelude::*;
 use polars_plan::dsl::function_expr::StructFunction;
-use polars_plan::plans::visitor::{TreeWalker, VisitRecursion, Visitor};
-use polars_plan::plans::{ArenaExprIter, ExprToIRContext, is_scalar_ae, to_expr_ir};
+use polars_plan::plans::visitor::TreeWalker;
 use polars_plan::prelude::*;
 use polars_utils::aliases::{PlHashSet, PlIndexSet};
 use polars_utils::format_pl_smallstr;
@@ -26,6 +25,10 @@ use sqlparser::dialect::GenericDialect;
 use sqlparser::parser::{Parser, ParserOptions};
 
 use crate::function_registry::{DefaultFunctionRegistry, FunctionRegistry};
+use crate::group_context::{
+    AggregateOutputs, GroupContextSplitter, OutputNames, has_windows_over_aggregates,
+    is_marked_aggregate, strip_aggregate_marks,
+};
 use crate::grouping_sets::{
     GroupingCall, GroupingSets, canonicalize_keys, contains_grouping_placeholder,
     expand_grouping_sets, new_placeholder,
@@ -245,8 +248,11 @@ pub struct SQLContext {
 /// State of the query block being executed that its `GROUP BY` binds.
 #[derive(Clone, Default)]
 pub(crate) struct GroupScope {
-    /// Whether the inputs of a window function are being parsed. An aggregate there
-    /// is computed per group, before the window (see `WINDOW_AGGREGATE`).
+    /// Whether the aggregate calls being parsed are marked (see `AGGREGATE_MARK`): in the
+    /// clauses that run in the group context of the block. Marked calls cannot be nested.
+    pub(crate) mark_aggregates: bool,
+    /// Whether the inputs of a window function are being parsed. Aggregates there are
+    /// marked too.
     pub(crate) in_window: bool,
     /// `GROUPING()` calls parsed in the block.
     grouping_calls: Vec<GroupingCall>,
@@ -1652,6 +1658,14 @@ impl SQLContext {
         })
     }
 
+    /// Run `f` with the aggregate calls it parses marked (see `GroupScope::mark_aggregates`).
+    fn marking_aggregates<T>(&mut self, f: impl FnOnce(&mut Self) -> T) -> T {
+        let mark_aggregates = std::mem::replace(&mut self.group_scope.mark_aggregates, true);
+        let result = f(self);
+        self.group_scope.mark_aggregates = mark_aggregates;
+        result
+    }
+
     fn contains_grouping_placeholder(&self, expr: &Expr) -> bool {
         contains_grouping_placeholder(
             expr,
@@ -1872,12 +1886,14 @@ impl SQLContext {
 
         let mark_whole_frame_windows =
             std::mem::replace(&mut self.group_scope.mark_whole_frame_windows, true);
-        let mut projections_with_flags = self.column_projections(
-            projection,
-            select_stmt.flavor,
-            &schema,
-            &mut select_modifiers,
-        )?;
+        let mut projections_with_flags = self.marking_aggregates(|ctx| {
+            ctx.column_projections(
+                projection,
+                select_stmt.flavor,
+                &schema,
+                &mut select_modifiers,
+            )
+        })?;
         self.group_scope.mark_whole_frame_windows = mark_whole_frame_windows;
         let mut subquery_names;
         (lf, subquery_names) = self.process_subqueries(
@@ -1890,19 +1906,6 @@ impl SQLContext {
         }
         schema = self.get_frame_schema(&mut lf)?;
 
-        // The alias marking an aggregate in a window must not name the projection.
-        let mut name_schema = None;
-        for (expr, is_explicit_alias) in projections_with_flags.iter_mut() {
-            if !*is_explicit_alias && has_window_aggregate(expr) {
-                let name_schema =
-                    name_schema.get_or_insert_with(|| self.with_placeholder_columns(&schema));
-                let name = map_window_aggregates(expr.clone(), |e| e)
-                    .to_field(name_schema)?
-                    .name;
-                *expr = expr.clone().alias(name);
-            }
-        }
-
         // Placeholder names are generated per execution, so an unaliased projection
         // named after one gets the name given to any other unnamed scalar expression.
         // Matching on the output name rather than the expression shape also catches
@@ -1936,14 +1939,14 @@ impl SQLContext {
                     &select_modifiers.rename,
                     &schema,
                     &self.with_placeholder_columns(&schema),
-                    &subquery_names,
                 );
                 let output_schema = output_names.extend_schema(&schema);
                 let mark_whole_frame_windows =
                     std::mem::replace(&mut self.group_scope.mark_whole_frame_windows, true);
-                let parsed = parse_sql_expr(qualify, self, Some(&output_schema));
+                let parsed = self
+                    .marking_aggregates(|ctx| parse_sql_expr(qualify, ctx, Some(&output_schema)));
                 self.group_scope.mark_whole_frame_windows = mark_whole_frame_windows;
-                let mut qualify
```

**File**: `crates/polars-sql/src/functions.rs` (modified, +24/-0)
```diff
@@ -1212,6 +1212,30 @@ impl PolarsSQLFunctions {
             },
         })
     }
+
+    /// Whether `call`, the parsed call of `function` without OVER, aggregates the rows of a
+    /// group: a SQL aggregate, or a user-defined function that returns one value.
+    pub(crate) fn is_aggregate_call(
+        function: &SQLFunction,
+        ctx: &SQLContext,
+        call: &Expr,
+    ) -> PolarsResult<bool> {
+        use PolarsSQLFunctions::*;
+        Ok(match Self::try_from_sql(function, ctx)? {
+            #[cfg(feature = "approx_quantile")]
+            ApproxQuantile => true,
+            ArrayAgg | Avg | Corr | Count | CovarPop | CovarSamp | First | Last | Max | Median
+            | Min | QuantileCont | QuantileDisc | StdDev | StringAgg | Sum | Total | Variance => {
+                true
+            },
+            // Without OVER, FIRST_VALUE is FIRST.
+            FirstValue => true,
+            Udf(_) => {
+                matches!(call, Expr::AnonymousFunction { options, .. } if options.returns_scalar())
+            },
+            _ => false,
+        })
+    }
 }
 
 impl SQLFunctionVisitor<'_> {
```

**File**: `crates/polars-sql/src/group_context.rs` (added, +306/-0)
```diff
@@ -0,0 +1,306 @@
+//! The group context of a SELECT block: which parts of its expressions are computed per
+//! group, and which run on the aggregated rows.
+
+use std::sync::LazyLock;
+
+use polars_core::prelude::*;
+use polars_lazy::prelude::*;
+use polars_plan::plans::visitor::{TreeWalker, VisitRecursion, Visitor};
+use polars_plan::prelude::*;
+use polars_utils::aliases::PlHashSet;
+use polars_utils::format_pl_smallstr;
+
+use crate::context::is_correlated_result_col;
+use crate::unique_column_name;
+
+/// The expressions computed in the group context, without aggregate marks.
+pub(crate) struct AggregateOutputs {
+    exprs: Vec<Expr>,
+}
+
+impl AggregateOutputs {
+    pub(crate) fn with_capacity(capacity: usize) -> Self {
+        Self {
+            exprs: Vec::with_capacity(capacity),
+        }
+    }
+
+    pub(crate) fn push(&mut self, expr: Expr) {
+        self.exprs.push(strip_aggregate_marks(expr));
+    }
+
+    pub(crate) fn iter(&self) -> impl Iterator<Item = &Expr> {
+        self.exprs.iter()
+    }
+
+    pub(crate) fn into_exprs(self) -> Vec<Expr> {
+        self.exprs
+    }
+
+    /// Reference to the output computing `expr`, reusing an existing aggregate with
+    /// the same expression (from SELECT, or the same aggregate repeated in a window).
+    fn get_or_insert_hoisted(&mut self, expr: Expr) -> Expr {
+        let expr = strip_aggregate_marks(expr);
+        let existing = self.exprs.iter().find_map(|agg| match agg {
+            Expr::Alias(inner, name) if **inner == expr => Some(name.clone()),
+            _ => None,
+        });
+        let name = existing.unwrap_or_else(|| {
+            let name = format_pl_smallstr!("__POLARS_HOISTED_AGG_{}", unique_column_name());
+            self.exprs.push(expr.alias(name.clone()));
+            name
+        });
+        col(name)
+    }
+}
+
+/// Splits post-aggregation expressions from the aggregates they contain.
+pub(crate) struct GroupContextSplitter<'a> {
+    pub(crate) keys: &'a Schema,
+    /// Each group key without its alias, and the column holding it after aggregation.
+    pub(crate) key_exprs: Vec<(Expr, PlSmallStr)>,
+    pub(crate) whole_frame_partition: Option<&'a PlSmallStr>,
+    /// Columns holding the result of a scalar subquery.
+    pub(crate) subquery_names: &'a PlHashSet<PlSmallStr>,
+    pub(crate) aggregates: AggregateOutputs,
+}
+
+impl GroupContextSplitter<'_> {
+    /// Whether `expr` has one value per group without being an aggregate call: a scalar
+    /// subquery, or a correlated column.
+    fn is_group_value(&self, expr: &Expr) -> bool {
+        matches!(expr, Expr::Agg(AggExpr::First(inner)) if matches!(inner.as_ref(), Expr::Column(name)
+            if self.subquery_names.contains(name) || is_correlated_result_col(name)))
+    }
+
+    /// Whether a SELECT projection must be processed in the group context rather
+    /// than passed through as a group key: it contains an aggregate, a window, or a
+    /// function over a non-key column.
+    pub(crate) fn requires_group_processing(&self, expr: &Expr) -> bool {
+        has_expr(expr, |e| match e {
+            _ if is_marked_aggregate(e) => true,
+            Expr::Agg(_) | Expr::Len | Expr::Over { .. } => true,
+            #[cfg(feature = "dynamic_group_by")]
+            Expr::Rolling { .. } => true,
+            Expr::AnonymousFunction { options, .. } => options.returns_scalar(),
+            Expr::Function { function: func, .. }
+                if !matches!(func, FunctionExpr::StructExpr(_)) =>
+            {
+                has_expr(
+                    e,
+                    |e| matches!(e, Expr::Column(name) if !self.keys.contains(name)),
+                )
+            },
+            _ => false,
+        })
+    }
+
+    /// Whether `expr` must run after aggregation: it holds a window, or combines
+    /// an aggregate with a grouped key.
+    pub(crate) fn needs_post_aggregation(&self, expr: &Expr) -> bool {
+        struct Finder<'a, 'b> {
+            splitter: &'a GroupContextSplitter<'b>,
+            has_window: bool,
+            has_group_key: bool,
+            has_aggregate: bool,
+        }
+        impl Visitor for Finder<'_, '_> {
+            type Node = Expr;
+            type Arena = ();
+
+            fn pre_visit(&mut self, node: &Expr, _: &()) -> PolarsResult<VisitRecursion> {
+                // Siblings are still visited so that no aggregate goes unnoticed.
+                Ok(match node {
+                    Expr::Over { .. } => {
+                        self.has_window = true;
+                        VisitRecursion::Skip
+                    },
+                    Expr::Column(name) => {
+                        self.has_group_key |= self.splitter.keys.contains(name);
+                        VisitRecursion::Skip
+                    },
+                    _ if is_marked_aggregate(node) || self.splitter.is_group_value(node) => {
+                        self.has_aggregate = true;
+                   
```

**File**: `crates/polars-sql/src/lib.rs` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 mod context;
 pub mod function_registry;
 mod functions;
+mod group_context;
 mod grouping_sets;
 pub mod keywords;
 mod literal_folding;
```

**File**: `crates/polars-sql/src/sql_expr.rs` (modified, +11/-6)
```diff
@@ -37,7 +37,8 @@ use sqlparser::keywords;
 use sqlparser::parser::{Parser, ParserOptions};
 use sqlparser::tokenizer::Token;
 
-use crate::functions::SQLFunctionVisitor;
+use crate::functions::{PolarsSQLFunctions, SQLFunctionVisitor};
+use crate::group_context::{has_marked_aggregate, mark_aggregate};
 use crate::literal_folding::{
     decimal_lit, fold_scalar, parse_exact_literal, try_fold_decimal_arithmetic,
 };
@@ -1120,11 +1121,15 @@ impl SQLExprVisitor<'_> {
         self.ctx.group_scope.in_window = in_window;
         let expr = expr?;
 
-        if in_window && !is_window {
-            let empty = Schema::default();
-            return self
-                .ctx
-                .mark_aggregate_call(expr, self.active_schema.unwrap_or(&empty));
+        if !is_window
+            && (in_window || self.ctx.group_scope.mark_aggregates)
+            && PolarsSQLFunctions::is_aggregate_call(function, self.ctx, &expr)?
+        {
+            polars_ensure!(
+                !has_marked_aggregate(&expr),
+                SQLSyntax: "aggregate function calls cannot be nested"
+            );
+            return Ok(mark_aggregate(expr));
         }
         Ok(expr)
     }
```

**File**: `crates/polars-sql/tests/udf.rs` (modified, +20/-0)
```diff
@@ -129,5 +129,25 @@ fn test_group_by_aggregate_udfs() -> PolarsResult<()> {
     }?;
     assert!(expected.equals_missing(&res));
 
+    // The UDF is an aggregate in the inputs of a window, and next to one without GROUP BY.
+    let res = ctx
+        .execute("SELECT g, SUM(agg_plugin(v)) OVER () AS w FROM foo GROUP BY g")?
+        .collect()?
+        .sort(["g"], Default::default())?;
+    let expected = df! {
+        "g" => &["x", "y"],
+        "w" => &[6i64, 6],
+    }?;
+    assert!(expected.equals_missing(&res));
+
+    let res = ctx
+        .execute("SELECT agg_plugin(v) AS total, COUNT(*) OVER () AS n FROM foo")?
+        .collect()?;
+    let expected = df! {
+        "total" => &[6i64],
+        "n" => &[1u32],
+    }?;
+    assert!(expected.equals_missing(&res));
+
     Ok(())
 }
```

**File**: `py-polars/tests/unit/sql/test_group_by.py` (modified, +58/-0)
```diff
@@ -132,6 +132,64 @@ def test_group_by_all() -> None:
     assert_frame_equal(expected, res.sort(by="grp"))
 
 
+@pytest.mark.parametrize(
+    "agg", ["CORR(x, y)", "COVAR_POP(x, y)", "QUANTILE_CONT(x, 0.5)"]
+)
+@pytest.mark.parametrize(
+    "query",
+    [
+        "SELECT g, {agg} AS a FROM t GROUP BY ALL ORDER BY g",
+        "SELECT g, {agg} AS a FROM t GROUP BY g ORDER BY {agg}, g",
+    ],
+)
+def test_group_by_aggregates_lowered_to_functions(agg: str, query: str) -> None:
+    # These aggregates lower to plain functions, not to aggregation expressions.
+    df = pl.DataFrame(
+        {
+            "g": [1, 1, 2, 2, 2],
+            "x": [3.0, 1.0, 2.0, 5.0, 4.0],
+            "y": [1.0, 2.0, 2.0, 1.0, 3.0],
+        }
+    )
+    assert_sql_matches(
+        {"t": df},
+        query=query.format(agg=agg),
+        compare_with="duckdb",
+    )
+
+
+@pytest.mark.parametrize(
+    "query",
+    [
+        'SELECT g AS "__POLARS_AGGREGATE" FROM t ORDER BY "__POLARS_AGGREGATE"',
+        'SELECT g, SUM(x) AS "__POLARS_AGGREGATE" FROM t GROUP BY g ORDER BY g',
+        'SELECT SUM(x) AS "__POLARS_AGGREGATE", COUNT(*) OVER () AS n FROM t',
+    ],
+)
+def test_alias_named_like_internal_column(query: str) -> None:
+    df = pl.DataFrame({"g": [1, 2, 2], "x": [1, 2, 3]})
+    assert_sql_matches({"t": df}, query=query, compare_with="duckdb")
+
+
+@pytest.mark.parametrize(
+    "query",
+    [
+        "SELECT g, SUM(MAX(x)) FROM self GROUP BY g",
+        "SELECT SUM(x) + AVG(COUNT(*)) FROM self",
+        "SELECT g FROM self GROUP BY g HAVING SUM(MAX(x)) > 1",
+        "SELECT g FROM self GROUP BY g ORDER BY SUM(MAX(x))",
+        "SELECT g FROM self WHERE g = 1 GROUP BY g ORDER BY SUM(MAX(x))",
+        "SELECT SUM(x) FROM self ORDER BY SUM(MAX(x))",
+    ],
+)
+def test_nested_aggregates_error(query: str) -> None:
+    df = pl.DataFrame({"g": [1, 2, 2], "x": [1, 2, 3]})
+    with pytest.raises(
+        SQLSyntaxError, match="aggregate function calls cannot be nested"
+    ):
+        df.sql(query)
+
+
 def test_group_by_all_multi() -> None:
     dt1 = date(1999, 12, 31)
     dt2 = date(2028, 7, 5)
```

#### Recent Merged Pull Requests:
- **PR #29794** (2026-10-07): fix: Fix SQL FILTER clauses that contain a subquery (@ritchie46)
- **PR #29793** (2026-10-07): fix: Don't push filters into a cache past a projection (@ritchie46)
- **PR #29787** (2026-10-07): fix: Incorrect length error in streaming group-by item() (@orlp)
- **PR #29786** (2026-10-07): refactor(rust): More informative streaming node memory usage pattern (@orlp)
- **PR #29785** (2026-10-07): test(rust): Simplify the `clones_are_reseeded` test (@dsprenkels)
- **PR #29784** (2026-10-07): perf: TopK was holding onto too much data (@orlp)
- **PR #29782** (2026-10-07): perf: Preserve sortedness of computed join keys (@ritchie46)
- **PR #29781** (2026-10-07): fix: Phase logic error in merge_sorted (@orlp)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
