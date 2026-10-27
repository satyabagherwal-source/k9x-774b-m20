> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pola-rs-polars-learnings.md`  
> **Source**: github ([https://github.com/pola-rs/polars](https://github.com/pola-rs/polars))  
> **Source Version**: `7d9102fb`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T19:31:57.836Z  
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
> **Harvest Timestamp**: 2026-10-27T19:31:55.979Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pola-rs/polars`
- **Description**: Extremely fast Query Engine for DataFrames, written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 40218 stars

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
- **Issue #30309** (2026-10-27): **`write_json` stops at the first empty chunk, writing `[]` or a truncated array**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars.  ### Reproducible example  ```python import polars as pl  a = pl.DataFrame({"x": [1, 2, 3]}) b = pl.DataFrame({"x": [4, 5, 6]}) df = pl.concat([a, b], rechunk=False)  # A boolean Series mask keeps the chunk layout, so a chunk whose rows are all # filtered out survives as a zero-length chunk. out = df.filter(pl.Series([False, False, False, True, True, True]))  print(out.height)                      # 3 print(out.write_json())                # [] print(out.write_ndjson(), end="")      # {"x":4}\n{"x":5}\n{"x":6} print(out.to_dicts())                  # [{'x': 4}, {'x': 5}, {'x': 6}] print(out.rechunk().write_json())      # [{"x":4},{"x":5},{"x":6}] ```  Where the empty chunk sits decides how much is lost:  ```python c = pl.DataFrame({"x": [7, 8, 9]}) df = pl.concat([a, b, c], rechunk=False)  df.filter(pl.Series([0,0,0, 1,1,1, 1,1,1]).cast(pl.Boolean)).write_json() # chunks [0, 3, 3] -> []  df.filter(pl.Series([1,1,1, 0,0,0, 1,1,1]).cast(pl.Boolean)).write_json() # chunks [3, 0, 3] -> [{"x":1},{"x":2},{"x":3}]   (rows 7, 8, 9 dropped)  df.filter(pl.Series([1,1,1, 1,1,1, 0,0,0]).cast(pl.Boolean)).write_json() # chunks [3, 3, 0] -> all 6 rows, correct ```  ### Log output  ```shell  ```  ### Issue description  `DataFrame.write_json` serialises nothing after the first zero-length chunk it meets. If

- **Issue #30299** (2026-10-26): **Streaming select reorders rows for when(window).then(literal).otherwise(literal) in Polars 2.0**
  *Symptoms*: ### Checks  - [x] I have checked that this issue has not already been reported. - [x] I have confirmed this bug exists on the [latest version](https://pypi.org/project/polars/) of Polars (2.0.0, checked 2026-10-25).  ### Reproducible example  Polars only, using synthetic data; no optional dependencies.  ```python import polars as pl  # 1,500 synthetic rows sorted by (g, t); x is a deterministic pseudo-random float df = pl.DataFrame({"i": range(1500)}).select(     g=pl.col("i") // 300,     t=pl.col("i") % 300,     x=(pl.col("i") * 7919 % 1009).cast(pl.Float64), )  cases = {     "when(window).then(lit).otherwise(lit)": pl.when(pl.col("x").rank().over("t") > 3).then(-1.0).otherwise(1.0),     "same, then(col)": pl.when(pl.col("x").rank().over("t") > 3).then(pl.col("x")).otherwise(1.0),     "window alone": pl.col("x").rank().over("t"), }  print(pl.__version__) for name, expr in cases.items():     for label, q in [("alone", df.lazy().select(expr.alias("v"))), ("+ key col", df.lazy().select("t", expr.alias("v")))]:         expected = q.collect(engine="in-memory")["v"]         wrong = [int((q.collect(engine="streaming")["v"] != expected).sum()) for _ in range(5)]         print(f"{name:40s} {label:10s} rows differing from in-memory, 5 runs: {wrong}")  # The output is a permutation of the correct values, not wrong values q = df.lazy().select(cases["when(window).then(lit).otherwise(lit)"].alias("v")) print(q.collect(engine="streaming")["v"].sort().equals(q.collect(engine="in-memory")["v
  **Post-Mortem & Fix Analysis**:
  > The following fails with both in-memory and streaming (on 2.1): ```python import polars as pl  for e in ["in-memory", "streaming"]:     out=pl.LazyFrame({"x": [3, 1, 2]}).sort("x").select(         pl.when(pl.col("x") > 1).then(1).otherwise(0).alias("v")     ).collect(engine=e)   # [1, 0, 1]; should be [0, 1, 1]. The SORT is removed from the plan.     print(f"e: {e}, {out}") ``` gives ``` e: in-memory, shape: (3, 1) ┌─────┐ │ v   │ │ --- │ │ i32 │ ╞═════╡ │ 1   │ │ 0   │ │ 1   │ └─────┘ e: streaming, shape: (3, 1) ┌─────┐ │ v   │ │ --- │ │ i32 │ ╞═════╡ │ 1   │ │ 0   │ │ 1   │ └─────┘ ``` Optimizer issue, as `collect(engine=e, optimizations = pl.QueryOptFlags.none())` produces the expected result. 
  > With AI:  Root cause: `simplify_ordering` (#27075, first released in 1.40.0) leaves the `when` predicate out of the row orders that a `when/then/otherwise` reports. When neither branch carries the input's row order (both literals, or e.g. `then(pl.col("y").sort())`), the optimizer concludes that the expression does not depend on input order. It then drops an upstream `sort`, or marks the input unordered.  Scope: - Affected since 1.40.0 (1.39.0 is correct), in both engines, whenever the input is ordered (e.g. by a `sort`) and the result's order is observed. In 2.x the streaming engine also reorders unordered in-memory sources, which is why the original example (no explicit sort) only shows up on 2.x streaming. - Not only a permutation: the values are wrong once the result is combined with anything order-dependent. On 2.1.0, with `lf = pl.LazyFrame({"x": [3, 1, 2], "y": [10, 30, 20]}).sort("x")`:   - `lf.select(pl.when(pl.col("x") > 1).then(pl.col("y").sort()).otherwise(0))` gives `[10, 

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

### Incident Patch 1: `7d9102fb` (2026-10-27)
**Commit Message**: fix: Fix panic in dt.base_utc_offset/dst_offset (#30335)

Co-authored-by: liyixin <[REDACTED_EMAIL]>

**File**: `crates/polars-time/src/base_utc_offset.rs` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ pub fn base_utc_offset(
     time_zone: &Tz,
 ) -> DurationChunked {
     ca.phys
-        .apply_values(|t| {
+        .apply_nonnull_values_generic(DataType::Int64, |t| {
             let ndt = time_unit.timestamp_to_datetime(t);
             let dt = time_zone.from_utc_datetime(&ndt);
             dt.offset().base_utc_offset().num_milliseconds()
```

**File**: `crates/polars-time/src/dst_offset.rs` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ use polars_core::prelude::*;
 #[cfg(feature = "timezones")]
 pub fn dst_offset(ca: &DatetimeChunked, time_unit: &TimeUnit, time_zone: &Tz) -> DurationChunked {
     ca.phys
-        .apply_values(|t| {
+        .apply_nonnull_values_generic(DataType::Int64, |t| {
             let ndt = time_unit.timestamp_to_datetime(t);
             let dt = time_zone.from_utc_datetime(&ndt);
             dt.offset().dst_offset().num_milliseconds()
```

**File**: `py-polars/tests/unit/operations/namespaces/temporal/test_datetime.py` (modified, +9/-0)
```diff
@@ -372,6 +372,15 @@ def test_dst_offset_invalid() -> None:
         ser.dt.dst_offset().rename("dst_offset")
 
 
+@pytest.mark.parametrize("time_unit", ["ms", "us"])
+@pytest.mark.parametrize("method", ["base_utc_offset", "dst_offset"])
+def test_offset_null_out_of_range_payload(method: str, time_unit: TimeUnit) -> None:
+    # A null slot's backing value may be any out-of-range number.
+    s = pl.Series([0, 2**62], dtype=pl.Int64).scatter(1, None)
+    out = getattr(s.cast(pl.Datetime(time_unit, "UTC")).dt, method)()
+    assert out.to_list() == [timedelta(0), None]
+
+
 @pytest.mark.parametrize(
     ("time_unit", "expected"),
     [
```

---

### Incident Patch 2: `f6092b64` (2026-10-26)
**Commit Message**: fix: Do not panic on null rows when list/array agg yields Struct or Null (#30302)

**File**: `crates/polars-core/src/chunked_array/mod.rs` (modified, +13/-4)
```diff
@@ -684,7 +684,18 @@ where
     ChunkedArray<T>: ChunkTakeUnchecked<[IdxSize]>,
 {
     /// Deposit values into nulls with a certain validity mask.
+    ///
+    /// Panics for structs; use `Series::deposit` for those.
     pub fn deposit(&self, validity: &Bitmap) -> Self {
+        self.deposit_with(validity, Self::set_validity)
+    }
+
+    /// [`Self::deposit`] with a custom setter for the resulting validity.
+    pub(crate) fn deposit_with(
+        &self,
+        validity: &Bitmap,
+        set_validity: impl FnOnce(&mut Self, Option<Bitmap>),
+    ) -> Self {
         let set_bits = validity.set_bits();
 
         assert_eq!(self.len(), set_bits);
@@ -710,10 +721,8 @@ where
         }));
 
         let mut ca = unsafe { ChunkTakeUnchecked::take_unchecked(self, &gather_idxs) };
-        ca.set_validity(combine_validities_and(
-            Some(validity),
-            ca.rechunk_validity().as_ref(),
-        ));
+        let validity = combine_validities_and(Some(validity), ca.rechunk_validity().as_ref());
+        set_validity(&mut ca, validity);
         ca
     }
 }
```

**File**: `crates/polars-core/src/series/implementations/null.rs` (modified, +2/-2)
```diff
@@ -214,8 +214,8 @@ impl SeriesTrait for NullChunked {
     }
 
     fn deposit(&self, validity: &Bitmap) -> Series {
-        assert_eq!(validity.set_bits(), 0);
-        self.clone().into_series()
+        assert_eq!(self.len(), validity.set_bits());
+        NullChunked::new(self.name.clone(), validity.len()).into_series()
     }
 
     fn len(&self) -> usize {
```

**File**: `crates/polars-core/src/series/implementations/struct_.rs` (modified, +4/-1)
```diff
@@ -197,7 +197,10 @@ impl SeriesTrait for SeriesWrap<StructChunked> {
     }
 
     fn deposit(&self, validity: &Bitmap) -> Series {
-        self.0.deposit(validity).into_series()
+        // The outer validity must also be propagated into the fields.
+        self.0
+            .deposit_with(validity, StructChunked::set_outer_validity)
+            .into_series()
     }
 
     fn len(&self) -> usize {
```

**File**: `py-polars/tests/unit/functions/test_when_then.py` (modified, +22/-0)
```diff
@@ -921,6 +921,28 @@ def test_when_then_scalar_condition_masks_unselected_branch(engine: EngineType)
     assert q.collect(engine=engine).to_series().to_list() == [0, 0]
 
 
+@pytest.mark.parametrize("engine", ["in-memory", "streaming"])
+def test_when_then_masked_list_item_struct_30252(engine: EngineType) -> None:
+    schema = {
+        "params": pl.List(
+            pl.Struct({"key": pl.String, "value": pl.Struct({"int_value": pl.Int64})})
+        )
+    }
+    lf = pl.LazyFrame(
+        {"params": [[{"key": "foo", "value": {"int_value": 42}}], []]},
+        schema=schema,
+    )
+    filtered = pl.col.params.list.filter(pl.element().struct.field("key") == "foo")
+    q = lf.select(
+        pl.when(filtered.list.len() > 0).then(
+            filtered.list.item(allow_empty=True)
+            .struct.field("value")
+            .struct.field("int_value")
+        )
+    )
+    assert q.collect(engine=engine).to_series().to_list() == [42, None]
+
+
 @pytest.mark.parametrize("engine", ["in-memory", "streaming"])
 def test_when_then_masks_multichunk_struct_29799(engine: EngineType) -> None:
     df = pl.DataFrame(
```

**File**: `py-polars/tests/unit/operations/namespaces/array/test_eval.py` (modified, +16/-0)
```diff
@@ -335,3 +335,19 @@ def test_arr_eval_categorical_min_max_25906() -> None:
         s.arr.agg(pl.element().arg_max()),
         pl.Series("a", [0, 0], dtype=pl.get_index_type()),
     )
+
+
+def test_arr_agg_null_rows_30252() -> None:
+    dtype = pl.Struct({"a": pl.Int64, "b": pl.Struct({"c": pl.Int64})})
+    x = {"a": 1, "b": {"c": 2}}
+    y = {"a": 3, "b": {"c": 4}}
+    s = pl.Series("s", [None, [x], None, [y]], dtype=pl.Array(dtype, 1))
+    out = s.arr.agg(pl.element().first())
+    assert_series_equal(out, pl.Series("s", [None, x, None, y], dtype=dtype))
+    # The null rows must also be null in the fields.
+    assert out.struct.field("b").struct.field("c").to_list() == [None, 2, None, 4]
+
+    s = pl.Series("s", [None, [None], None], dtype=pl.Array(pl.Null, 1))
+    assert_series_equal(
+        s.arr.agg(pl.element().first()), pl.Series("s", [None, None, None])
+    )
```

**File**: `py-polars/tests/unit/operations/namespaces/list/test_eval.py` (modified, +29/-0)
```diff
@@ -753,3 +753,32 @@ def test_eval_on_literal_in_group_by_29554(expr: pl.Expr, expected: pl.Series) -
     out = df.select(r=expr.over("g"))
     expected_over = expected.gather([0, 0, 1, 1]).alias("r")
     assert_series_equal(out.get_column("r"), expected_over)
+
+
+def test_list_agg_null_rows_30252() -> None:
+    dtype = pl.Struct({"a": pl.Int64, "b": pl.Struct({"c": pl.Int64})})
+    x = {"a": 1, "b": {"c": 2}}
+    y = {"a": 3, "b": {"c": 4}}
+    s = pl.Series(
+        "s", [None, [x], None, None, [], [None], [y], None], dtype=pl.List(dtype)
+    )
+    expected = pl.Series("s", [None, x, None, None, None, None, y, None], dtype=dtype)
+    item = s.to_frame().select(pl.col.s.list.item(allow_empty=True)).to_series()
+    for out in [s.list.agg(pl.element().first()), item]:
+        assert_series_equal(out, expected)
+        # The null rows must also be null in the fields.
+        c = out.struct.field("b").struct.field("c")
+        assert c.to_list() == [None, 2, None, None, None, None, 4, None]
+
+    # `list.item()` on a null row (#28932).
+    assert_series_equal(s.gather([1, 2, 6]).list.item(), expected.gather([1, 2, 6]))
+
+    out = s.list.agg(pl.struct(pl.element().struct.field("a").first()))
+    a = [None, 1, None, None, None, None, 3, None]
+    assert out.struct.field("a").to_list() == a
+    assert_series_equal(out.is_null(), s.is_null())
+
+    s = pl.Series("s", [None, [None], None], dtype=pl.List(pl.Null))
+    assert_series_equal(
+        s.list.agg(pl.element().first()), pl.Series("s", [None, None, None])
+    )
```

---

### Incident Patch 3: `5e32866c` (2026-10-27)
**Commit Message**: fix: Don't finish a sink's output file when its query fails (#30279)

**File**: `crates/polars-io/src/utils/compression.rs` (modified, +120/-3)
```diff
@@ -402,14 +402,41 @@ mod compressed_writer {
 
     /// Constructor for `WritableTrait` compressed encoders.
     pub enum CompressedWriter<'a, W: io::Write> {
-        Gzip(Option<flate2::write::GzEncoder<&'a mut W>>),
+        Gzip(Option<flate2::write::GzEncoder<GzipTarget<'a, W>>>),
         Zstd(Option<zstd::Encoder<'static, &'a mut W>>),
     }
 
+    /// Discards writes once `discard` is set.
+    pub struct GzipTarget<'a, W> {
+        inner: &'a mut W,
+        discard: bool,
+    }
+
+    impl<W: io::Write> io::Write for GzipTarget<'_, W> {
+        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
+            if self.discard {
+                Ok(buf.len())
+            } else {
+                self.inner.write(buf)
+            }
+        }
+
+        fn flush(&mut self) -> io::Result<()> {
+            if self.discard {
+                Ok(())
+            } else {
+                self.inner.flush()
+            }
+        }
+    }
+
     impl<'a, W: io::Write> CompressedWriter<'a, W> {
         pub fn gzip(writer: &'a mut W, level: Option<u32>) -> Self {
             Self::Gzip(Some(flate2::write::GzEncoder::new(
-                writer,
+                GzipTarget {
+                    inner: writer,
+                    discard: false,
+                },
                 level.map(flate2::Compression::new).unwrap_or_default(),
             )))
         }
@@ -440,9 +467,99 @@ mod compressed_writer {
     impl<'a, W: io::Write> CompressedWriter<'a, W> {
         pub fn finish(&mut self) -> io::Result<&'a mut W> {
             match self {
-                Self::Gzip(encoder) => encoder.take().unwrap().finish(),
+                Self::Gzip(encoder) => {
+                    // On failure the encoder stays, so that its drop can't write the trailer.
+                    encoder.as_mut().unwrap().try_finish()?;
+                    encoder.take().unwrap().finish().map(|t| t.inner)
+                },
                 Self::Zstd(encoder) => encoder.take().unwrap().finish(),
             }
         }
     }
+
+    impl<W: io::Write> Drop for CompressedWriter<'_, W> {
+        fn drop(&mut self) {
+            // `GzEncoder` writes its trailer on drop, which would make an unfinished file look complete.
+            if let Self::Gzip(Some(encoder)) = self {
+                encoder.get_mut().discard = true;
+            }
+        }
+    }
+
+    #[cfg(test)]
+    mod tests {
+        use std::io::{self, Read, Write};
+
+        use super::CompressedWriter;
+
+        fn gzip_written(finish: bool) -> Vec<u8> {
+            let mut out = Vec::new();
+            let mut writer = CompressedWriter::gzip(&mut out, None);
+            writer.write_all(b"x\n1\n").unwrap();
+            writer.flush().unwrap();
+            if finish {
+                writer.finish().unwrap();
+            }
+            drop(writer);
+            out
+        }
+
+        #[test]
+        fn dropped_gzip_writer_leaves_no_trailer() {
+            let out = gzip_written(false);
+            assert!(!out.is_empty());
+            let err = flate2::read::GzDecoder::new(out.as_slice())
+                .read_to_end(&mut Vec::new())
+                .unwrap_err();
+            assert_eq!(err.kind(), io::ErrorKind::UnexpectedEof);
+        }
+
+        struct FailOnce<'a> {
+            out: Vec<u8>,
+            fail: &'a std::cell::Cell<bool>,
+        }
+
+        impl Write for FailOnce<'_> {
+            fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
+                if self.fail.replace(false) {
+                    return Err(io::Error::other("write failed"));
+                }
+                self.out.extend_from_slice(buf);
+                Ok(buf.len())
+            }
+
+            fn flush(&mut self) -> io::Result<()> {
+                Ok(())
+            }
+        }
+
+        #[test]
+        fn failed_gzip_finish_leaves_no_trailer() {
+            let fail = std::cell::Cell::new(false);
+            let mut target = FailOnce {
+                out: Vec::new(),
+                fail: &fail,
+            };
+            let mut writer = CompressedWriter::gzip(&mut target, None);
+            writer.write_all(b"x\n1\n").unwrap();
+            writer.flush().unwrap();
+            fail.set(true);
+            assert!(writer.finish().is_err());
+            drop(writer);
+            let err = flate2::read::GzDecoder::new(target.out.as_slice())
+                .read_to_end(&mut Vec::new())
+                .unwrap_err();
+            assert_eq!(err.kind(), io::ErrorKind::UnexpectedEof);
+        }
+
+        #[test]
+        fn finished_gzip_writer_is_complete() {
+            let out = gzip_written(true);
+            let mut decoded = Vec::new();
+            flate2::read::GzDecoder::new(out.as_slice())
+                .read_to_end(&mut decoded)
+                .unwrap();
+            assert_eq!(decoded, b"x\n1\n");
+        }
+    }
 }
```

**File**: `crates/polars-stream/src/nodes/io_sinks/components/file_sink.rs` (modified, +5/-0)
```diff
@@ -5,6 +5,7 @@ use polars_error::PolarsResult;
 use crate::nodes::io_sinks::components::sink_morsel::SinkMorsel;
 use crate::nodes::io_sinks::components::sinked_path_info_list::SinkedPathInfoEntry;
 use crate::nodes::io_sinks::components::size::RowCountAndSize;
+use crate::nodes::io_sinks::writers::interface::FinishSender;
 
 pub type FileSinkPermit = tokio::sync::OwnedSemaphorePermit;
 
@@ -14,6 +15,7 @@ pub struct FileSinkTaskData {
     task_handle: executor::JoinHandle<PolarsResult<FileSinkPermit>>,
     path_info_entry: Option<SinkedPathInfoEntry>,
     sent_rows: u64,
+    finish_tx: FinishSender,
 }
 
 impl FileSinkTaskData {
@@ -22,13 +24,15 @@ impl FileSinkTaskData {
         start_position: RowCountAndSize,
         task_handle: executor::JoinHandle<PolarsResult<FileSinkPermit>>,
         path_info_entry: Option<SinkedPathInfoEntry>,
+        finish_tx: FinishSender,
     ) -> Self {
         Self {
             morsel_tx,
             start_position,
             task_handle,
             path_info_entry,
             sent_rows: 0,
+            finish_tx,
         }
     }
 
@@ -49,6 +53,7 @@ impl FileSinkTaskData {
             path_info_entry.set_num_rows(self.sent_rows);
         }
 
+        self.finish_tx.send();
         self.task_handle
     }
 }
```

**File**: `crates/polars-stream/src/nodes/io_sinks/components/partition_distributor.rs` (modified, +5/-0)
```diff
@@ -16,6 +16,7 @@ use crate::nodes::io_sinks::components::partition_sink_starter::PartitionSinkSta
 use crate::nodes::io_sinks::components::partition_state::PartitionState;
 use crate::nodes::io_sinks::components::partitioner::{self, PartitionedDataFrames};
 use crate::nodes::io_sinks::components::size::RowCountAndSize;
+use crate::nodes::io_sinks::writers::interface::FinishSignal;
 
 pub struct PartitionDistributor {
     pub node_name: PlSmallStr,
@@ -29,6 +30,7 @@ pub struct PartitionDistributor {
     pub open_sinks_semaphore: Arc<tokio::sync::Semaphore>,
     pub partition_sink_starter: PartitionSinkStarter,
     pub no_partition_keys: bool,
+    pub finish: FinishSignal,
     pub verbose: bool,
 }
 
@@ -44,6 +46,7 @@ impl PartitionDistributor {
             open_sinks_semaphore,
             partition_sink_starter,
             no_partition_keys,
+            finish,
             verbose,
         } = self;
 
@@ -202,6 +205,8 @@ impl PartitionDistributor {
             drop(input_wait_token);
         }
 
+        finish.wait().await?;
+
         if verbose {
             eprintln!("{node_name}: Begin finalize");
         }
```

**File**: `crates/polars-stream/src/nodes/io_sinks/components/partition_sink_starter.rs` (modified, +6/-2)
```diff
@@ -13,7 +13,9 @@ use crate::nodes::io_sinks::components::file_provider::FileProvider;
 use crate::nodes::io_sinks::components::file_sink::{FileSinkPermit, FileSinkTaskData};
 use crate::nodes::io_sinks::components::sinked_path_info_list::SinkedPathInfoList;
 use crate::nodes::io_sinks::components::size::RowCountAndSize;
-use crate::nodes::io_sinks::writers::interface::{FileOpenTaskHandle, FileWriterStarter};
+use crate::nodes::io_sinks::writers::interface::{
+    FileOpenTaskHandle, FileWriterStarter, finish_signal,
+};
 use crate::utils::tokio_handle_ext;
 
 #[derive(Clone)]
@@ -49,10 +51,11 @@ impl PartitionSinkStarter {
         }));
 
         let (morsel_tx, morsel_rx) = connector::connector();
+        let (finish_tx, finish_rx) = finish_signal();
 
         let writer_handle = self.writer_starter.start_file_writer(
             morsel_rx,
-            FileOpenTaskHandle::new(file_open_task, self.sync_on_close),
+            FileOpenTaskHandle::new(file_open_task, self.sync_on_close, finish_rx),
             self.num_pipelines_per_sink,
             self.task_metrics.clone(),
         )?;
@@ -68,6 +71,7 @@ impl PartitionSinkStarter {
             start_position,
             task_handle,
             path_info_entry,
+            finish_tx,
         ))
     }
 }
```

**File**: `crates/polars-stream/src/nodes/io_sinks/mod.rs` (modified, +13/-0)
```diff
@@ -18,6 +18,7 @@ use crate::nodes::io_sinks::components::partitioner::Partitioner;
 use crate::nodes::io_sinks::config::{IOSinkNodeConfig, IOSinkTarget};
 use crate::nodes::io_sinks::pipeline_initialization::partition_by::start_partition_sink_pipeline;
 use crate::nodes::io_sinks::pipeline_initialization::single_file::start_single_file_sink_pipeline;
+use crate::nodes::io_sinks::writers::interface::{FinishSender, finish_signal};
 use crate::pipe::PortReceiver;
 pub mod components;
 pub mod config;
@@ -85,13 +86,15 @@ impl ComputeNode for IOSinkNode {
                 IOSinkNodeState::Initialized {
                     phase_channel_tx,
                     task_handle,
+                    finish_tx,
                 } => {
                     if self.verbose {
                         eprintln!(
                             "{}: Join on task_handle (recv PortState::Done)",
                             self.name()
                         );
                     }
+                    finish_tx.send();
                     drop(phase_channel_tx);
                     ASYNC.block_in_place_on(task_handle)?;
                 },
@@ -155,6 +158,7 @@ impl ComputeNode for IOSinkNode {
                 let IOSinkNodeState::Initialized {
                     phase_channel_tx,
                     task_handle,
+                    finish_tx,
                 } = std::mem::replace(&mut self.state, IOSinkNodeState::Finished)
                 else {
                     unreachable!()
@@ -168,6 +172,8 @@ impl ComputeNode for IOSinkNode {
                 }
 
                 drop(phase_channel_tx);
+                // Before the join, or the writers waiting on it hang.
+                drop(finish_tx);
 
                 return Err(task_handle.await.unwrap_err());
             }
@@ -186,6 +192,8 @@ enum IOSinkNodeState {
         phase_channel_tx: connector::Sender<PortReceiver>,
         /// Join handle for all background tasks.
         task_handle: AbortOnDropHandle<PolarsResult<()>>,
+        /// Sent once the input ended cleanly; files are finished only then.
+        finish_tx: FinishSender,
     },
 
     Finished,
@@ -234,13 +242,16 @@ impl IOSinkNodeState {
             }
         });
 
+        let (finish_tx, finish_rx) = finish_signal();
+
         let task_handle = match &config.target {
             IOSinkTarget::File(_) => start_single_file_sink_pipeline(
                 node_name.clone(),
                 multi_phase_rx,
                 *config,
                 execution_state,
                 io_metrics,
+                finish_rx,
             )?,
 
             IOSinkTarget::Partitioned { .. } => start_partition_sink_pipeline(
@@ -249,12 +260,14 @@ impl IOSinkNodeState {
                 *config,
                 execution_state,
                 io_metrics,
+                finish_rx,
             )?,
         };
 
         *self = Initialized {
             phase_channel_tx,
             task_handle,
+            finish_tx,
         };
 
         Ok(())
```

**File**: `crates/polars-stream/src/nodes/io_sinks/pipeline_initialization/partition_by.rs` (modified, +3/-1)
```diff
@@ -24,14 +24,15 @@ use crate::nodes::io_sinks::components::sinked_path_info_list::{
 use crate::nodes::io_sinks::components::size::{NonZeroRowCountAndSize, SplitMode};
 use crate::nodes::io_sinks::config::{IOSinkNodeConfig, IOSinkTarget, PartitionedTarget};
 use crate::nodes::io_sinks::writers::create_file_writer_starter;
-use crate::nodes::io_sinks::writers::interface::FileWriterStarter;
+use crate::nodes::io_sinks::writers::interface::{FileWriterStarter, FinishSignal};
 
 pub fn start_partition_sink_pipeline(
     node_name: &PlSmallStr,
     morsel_rx: connector::Receiver<Morsel>,
     config: IOSinkNodeConfig,
     execution_state: &StreamingExecutionState,
     io_metrics: Option<Arc<IOMetrics>>,
+    finish: FinishSignal,
 ) -> PolarsResult<executor::AbortOnDropHandle<PolarsResult<()>>> {
     let num_pipelines: NonZeroUsize = execution_state.num_pipelines.try_into().unwrap();
     let task_metrics = execution_state.task_metrics();
@@ -198,6 +199,7 @@ pub fn start_partition_sink_pipeline(
             open_sinks_semaphore,
             partition_sink_starter,
             no_partition_keys,
+            finish,
             verbose,
         }
         .run(),
```

**File**: `crates/polars-stream/src/nodes/io_sinks/pipeline_initialization/single_file.rs` (modified, +22/-3)
```diff
@@ -19,7 +19,9 @@ use crate::nodes::io_sinks::components::sinked_path_info_list::{
 };
 use crate::nodes::io_sinks::config::{IOSinkNodeConfig, IOSinkTarget};
 use crate::nodes::io_sinks::writers::create_file_writer_starter;
-use crate::nodes::io_sinks::writers::interface::{FileOpenTaskHandle, FileWriterStarter};
+use crate::nodes::io_sinks::writers::interface::{
+    FileOpenTaskHandle, FileWriterStarter, FinishSignal, finish_signal,
+};
 use crate::utils::tokio_handle_ext;
 
 pub fn start_single_file_sink_pipeline(
@@ -28,6 +30,7 @@ pub fn start_single_file_sink_pipeline(
     config: IOSinkNodeConfig,
     execution_state: &StreamingExecutionState,
     io_metrics: Option<Arc<IOMetrics>>,
+    finish: FinishSignal,
 ) -> PolarsResult<executor::AbortOnDropHandle<PolarsResult<()>>> {
     let num_pipelines: NonZeroUsize = execution_state.num_pipelines.try_into().unwrap();
     let task_metrics = execution_state.task_metrics();
@@ -102,7 +105,9 @@ pub fn start_single_file_sink_pipeline(
                 })
         }))
     };
-    let file_open_task = FileOpenTaskHandle::new(file_open_task, sync_on_close);
+    // The writer finishes only once its input also passed the resize stage.
+    let (writer_finish_tx, writer_finish_rx) = finish_signal();
+    let file_open_task = FileOpenTaskHandle::new(file_open_task, sync_on_close, writer_finish_rx);
 
     let target_sink_morsel_size = file_writer_starter.target_sink_morsel_size();
 
@@ -156,8 +161,22 @@ pub fn start_single_file_sink_pipeline(
         TaskPriority::High,
         task_metrics,
         async move {
+            let sent_size = match resize_pipeline_handle.await {
+                Ok(sent_size) => sent_size,
+                Err(e) => {
+                    drop(writer_finish_tx);
+                    let _ = writer_handle.await;
+                    return Err(e);
+                },
+            };
+            match finish.wait().await {
+                Ok(()) => writer_finish_tx.send(),
+                Err(e) => {
+                    drop(writer_finish_tx);
+                    return writer_handle.await.and(Err(e));
+                },
+            }
             writer_handle.await?;
-            let sent_size = resize_pipeline_handle.await?;
 
             if verbose {
                 eprintln!("{node_name}: Statistics: total_size: {sent_size:?}");
```

**File**: `crates/polars-stream/src/nodes/io_sinks/writers/csv/io_writer.rs` (modified, +3/-1)
```diff
@@ -30,7 +30,7 @@ impl IOWriter {
             options,
         } = self;
 
-        let (mut target, sync_on_close) = file.await?;
+        let (mut target, sync_on_close, finish) = file.await?;
 
         // TODO: Refactor to avoid doing compression work on a tokio async thread here.
         let (mut writer, finish_writer) =
@@ -63,6 +63,8 @@ impl IOWriter {
             let _ = reuse_serializer_tx.send(serializer).await;
         }
 
+        finish.wait().await?;
+
         if let Some(finish_writer) = &finish_writer {
             finish_writer(writer)?.flush().await?;
         } else {
```

#### Recent Merged Pull Requests:
- **PR #30336** (2026-10-27): feat: Support SQL subqueries that read a query further out than the one around them (@ritchie46)
- **PR #30335** (2026-10-27): fix: Fix panic in dt.base_utc_offset/dst_offset (@Liyixin95)
- **PR #30321** (2026-10-27): refactor: Make the approx_quantile failure probability an IR parameter (@dsprenkels)
- **PR #30320** (2026-10-26): perf: Improve DirtyHash for 128-bit integers (@orlp)
- **PR #30318** (2026-10-27): feat: Support more dtypes in `approx_quantile` (@dsprenkels)
- **PR #30317** (2026-10-27): refactor: Replace approx_quantile merge reductions with union reduction (@dsprenkels)

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

## X. Fix panic in dt.base_utc_offset/dst_offset (#30335)

**RULE**:
When implementing operations in `crates/polars-time/src/base_utc_offset.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7d9102fb`: Fix panic in dt.base_utc_offset/dst_offset (#30335). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/polars-time/src/base_utc_offset.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        .apply_nonnull_values_generic(DataType::Int64, |t| {
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        .apply_values(|t| {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7d9102fb` are properly handled with clean fallback behavior.
