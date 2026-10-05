# Forensic Learning Record (Deep Inspection): influxdata/influxdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/influxdata-influxdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/influxdata/influxdb](https://github.com/influxdata/influxdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:29:58.487Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `influxdata/influxdb`
- **Description**: Scalable datastore for metrics, events, and real-time analytics
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 31759 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/arrow_util/benches/iter_set_positions.rs`
```
#![expect(unused_crate_dependencies)]

use core::hint::black_box;

use arrow_util::bitset::iter_set_positions_with_offset;
use criterion::{Criterion, criterion_group, criterion_main};

fn run_tests(bytes: &[u8], offset: usize, name: &'static str, c: &mut Criterion) {
    c.bench_function(name, |b| {
        b.iter(|| {
            for i in iter_set_positions_with_offset(bytes, offset) {
                black_box(i);
            }
        })
    });
}

fn short(c: &mut Criterion) {
    let bytes = &[9];
    run_tests(bytes, 0, "short", c);
}

fn short_medium(c: &mut Criterion) {
    let bytes = &[28, 187, 254, 19];
    run_tests(bytes, 3, "short_medium", c);
}

fn medium(c: &mut Criterion) {
    let bytes = &[8, 118, 1, 0, 29, 89, 43, 143];
    run_tests(bytes, 30, "medium", c);
}

fn medium_long(c: &mut Criterion) {
    let bytes = &[28, 0, 197, 36, 62, 191, 84, 71, 76, 34, 117, 29, 66, 8, 80];
    run_tests(bytes, 41, "medium_long", c);
}

fn long(c: &mut Criterion) {
    let bytes = &[
        54, 1, 0, 73, 5, 218, 14, 97, 82, 8, 99, 25, 8, 1, 30, 0, 74, 96, 85, 3, 86, 8, 1, 1, 86,
        25, 78, 32, 11,
    ];
    run_tests(bytes, 120, "long", c);
}

fn all_full(c: &mut Criterion) {
    let bytes = &[0xffu8; 16];
    run_tests(bytes, 13, "all_full", c);
}

fn all_empty(c: &mut Criterion) {
    let bytes = &[0; 16];
    run_tests(bytes, 1, "all_empty", c);
}

criterion_group!(
    benches,
    short,
    short_medium,
    medium,
    medium_long,
    long,
    all_full,
    all_empty
);
criterion_main!(benches);

```

### Core Architecture Module: `core/arrow_util/src/bitset.rs`
```
use arrow::buffer::{BooleanBuffer, Buffer};
use std::ops::Range;

/// An arrow-compatible mutable bitset implementation
///
/// Note: This currently operates on individual bytes at a time
/// it could be optimised to instead operate on usize blocks
#[derive(Debug, Default, Clone, PartialEq)]
pub struct BitSet {
    /// The underlying data
    ///
    /// Data is stored in the least significant bit of a byte first
    buffer: Vec<u8>,

    /// The length of this mask in bits
    len: usize,
}

impl BitSet {
    /// Creates a new BitSet
    pub fn new() -> Self {
        Self::default()
    }

    /// Construct an empty [`BitSet`] with a pre-allocated capacity for `n`
    /// bits.
    pub fn with_capacity(n: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(n.div_ceil(8)),
            len: 0,
        }
    }

    /// Creates a new BitSet with `count` unset bits.
    pub fn with_size(count: usize) -> Self {
        let mut bitset = Self::default();
        bitset.append_unset(count);
        bitset
    }

    /// Reserve space for `count` further bits
    pub fn reserve(&mut self, count: usize) {
        let new_buf_len = (self.len + count).div_ceil(8);
        self.buffer.reserve(new_buf_len);
    }

    /// Appends `count` unset bits
    pub fn append_unset(&mut self, count: usize) {
        self.len += count;
        let new_buf_len = self.len.div_ceil(8);
        self.buffer.resize(new_buf_len, 0);
    }

    /// Appends `count` set bits
    pub fn append_set(&mut self, count: usize) {
        let new_len = self.len + count;
        let new_buf_len = new_len.div_ceil(8);

        let skew = self.len % 8;
        if skew != 0 {
            *self.buffer.last_mut().unwrap() |= 0xFF << skew;
        }

        self.buffer.resize(new_buf_len, 0xFF);

        let rem = new_len % 8;
        if rem != 0 {
            *self.buffer.last_mut().unwrap() &= (1 << rem) - 1;
        }

        self.len = new_len;
    }

    /// Truncates the bitset to the provided length
    pub fn truncate(&mut self, len: usize) {
        let new_buf_len = len.div_ceil(8);
        self.buffer.truncate(new_buf_len);
        let overrun = len % 8;
        if overrun > 0 {
            *self.buffer.last_mut().unwrap() &= (1 << overrun) - 1;
        }
        self.len = len;
    }

    /// Extends this [`BitSet`] by the context of `other`
    pub fn extend_from(&mut self, other: &Self) {
        self.append_bits(other.len, &other.buffer)
    }

    /// Extends this [`BitSet`] by `range` elements in `other`
    pub fn extend_from_range(&mut self, other: &Self, range: Range<usize>) {
        let count = range.end - range.start;
        if count == 0 {
            return;
        }

        let start_byte = range.start / 8;
        let end_byte = range.end.div_ceil(8);
        let skew = range.start % 8;

        // `append_bits` requires the provided `to_set` to be byte aligned, therefore
        // if the range being copied is not byte aligned we must first append
        // the leading bits to reach a byte boundary
        if skew == 0 {
            // No skew can simply append bytes directly
            self.append_bits(count, &other.buffer[start_byte..end_byte])
        } else if start_byte + 1 == end_byte {
            // Append bits from single byte
            self.append_bits(count, &[other.buffer[start_byte] >> skew])
        } else {
            // Append trailing bits from first byte to reach byte boundary, then append
            // bits from the remaining byte-aligned mask
            let offset = 8 - skew;
            self.append_bits(offset, &[other.buffer[start_byte] >> skew]);
            self.append_bits(count - offset, &other.buffer[(start_byte + 1)..end_byte]);
        }
    }

    /// Appends `count` boolean values from the slice of packed bits
    pub fn append_bits(&mut self, count: usize, to_set: &[u8]) {
        assert_eq!(count.div_ceil(8), to_set.len());

        let new_len = self.len + count;
        let new_buf_len = new_len.div_ceil(8);
        self.buffer.reserve(new_buf_len - self.buffer.len());

        let whole_bytes = count / 8;
        let overrun = count % 8;

        let skew = self.len % 8;
        if skew == 0 {
            self.buffer.extend_from_slice(&to_set[..whole_bytes]);
            if overrun > 0 {
                let masked = to_set[whole_bytes] & ((1 << overrun) - 1);
                self.buffer.push(masked)
            }

            self.len = new_len;
            debug_assert_eq!(self.buffer.len(), new_buf_len);
            return;
        }

        for to_set_byte in &to_set[..whole_bytes] {
            let low = *to_set_byte << skew;
            let high = *to_set_byte >> (8 - skew);

            *self.buffer.last_mut().unwrap() |= low;
            self.buffer.push(high);
        }

        if overrun > 0 {
            let masked = to_set[whole_bytes] & ((1 << overrun) - 1);
            let low = masked << skew;
            *self.buffer.last_mut().unwrap() |= low;

            if overrun > 8 - skew {
                let high = masked >> (8 - skew);
                self.buffer.push(high)
            }
        }

        self.len = new_len;
        debug_assert_eq!(self.buffer.len(), new_buf_len);
    }

    /// Sets a given bit
    pub fn set(&mut self, idx: usize) {
        assert!(idx < self.len);

        let byte_idx = idx / 8;
        let bit_idx = idx % 8;
        self.buffer[byte_idx] |= 1 << bit_idx;
    }

    /// Returns if the given index is set
    pub fn get(&self, idx: usize) -> bool {
        assert!(idx < self.len);

        let byte_idx = idx / 8;
        let bit_idx = idx % 8;

        (self.buffer[byte_idx] >> bit_idx) & 1 != 0
    }

    /// Converts this BitSet to a buffer compatible with arrows boolean
    /// encoding, consuming self.
    pub fn into_arrow(self) -> BooleanBuffer {
        let offset = 0;
        BooleanBuffer::new(Buffer::from_vec(self.buffer), offset, self.len)
    }

    /// Returns the number of values stored in the bitset
    pub fn len(&self) -> usize {
        self.len
    }

    /// Returns if this bitset is empty
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Returns the number of bytes used by this bitset
    pub fn byte_len(&self) -> usize {
        self.buffer.len()
    }

    /// Return the raw packed bytes used by this bitset
    pub fn bytes(&self) -> &[u8] {
        &self.buffer
    }

    /// Return `true` if all bits in the [`BitSet`] are currently set.
    pub fn is_all_set(&self) -> bool {
        // An empty bitmap has no set bits.
        if self.len == 0 {
            return false;
        }

        // Check all the bytes in the bitmap that have all their bits considered
        // part of the bit set.
        let full_blocks = self.len / 8;
        if !self.buffer.iter().take(full_blocks).all(|&v| v == u8::MAX) {
            return false;
        }

        // Check the last byte of the bitmap that may only be partially part of
        // the bit set, and therefore need masking to check only the relevant
        // bits.
        let offset = self.len % 8;

        if offset != 0
            && let Some(last) = self.buffer.last()
        {
            *last == !(0xFF << offset) // LSB mask
        } else {
            true
        }
    }

    /// Return `true` if all bits in the [`BitSet`] are currently unset.
    pub fn is_all_unset(&self) -> bool {
        self.buffer.iter().all(|&v| v == 0)
    }

    /// Returns the number of set bits in this bitmap.
    pub fn count_ones(&self) -> usize {
        // Invariant: the bits outside of [0, self.len) are always 0
        self.buffer.iter().map(|v| v.count_ones() as usize).sum()
    }

    /// Returns the number of unset bits in this bitmap.
    pub fn count_zeros(&self) -> usize {
        self.len() - self.count_ones()
    }

    /// Returns true if any bit is set (short circuiting).
    pub fn is_any_set(&self) -> bool {
        self.buffer.iter().any(|&v| v != 0)
    }

    /// Returns a value [`Iterator`] that yields boolean values encoded in the
    /// bitmap.
    pub fn iter(&self) -> Iter<'_> {
        Iter::new(self)
    }
}

/// A value iterator yielding the boolean values encoded in the bitmap.
#[derive(Debug)]
pub struct Iter<'a> {
    /// A reference to the bitmap buffer.
    buffer: &'a [u8],
    /// The index of the next yielded bit in `buffer`.
    idx: usize,
    /// The number of bits stored in buffer.
    len: usize,
}

impl<'a> Iter<'a> {
    fn new(b: &'a BitSet) -> Self {
        Self {
            buffer: &b.buffer,
            idx: 0,
            len: b.len(),
        }
    }
}

impl Iterator for Iter<'_> {
    type Item = bool;

    fn next(&mut self) -> Option<Self::Item> {
        if self.idx >= self.len {
            return None;
        }

        let byte_idx = self.idx / 8;
        let shift = self.idx % 8;

        self.idx += 1;

        let byte = self.buffer[byte_idx];
        let byte = byte >> shift;

        Some(byte & 1 == 1)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let v = self.len - self.idx;
        (v, Some(v))
    }
}

impl ExactSizeIterator for Iter<'_> {}

/// Returns an iterator over set bit positions in increasing order
pub fn iter_set_positions(bytes: &[u8]) -> impl Iterator<Item = usize> + '_ {
    iter_set_positions_with_offset(bytes, 0)
}

/// Returns an iterator over set bit positions in increasing order starting
/// at the provided bit offset
pub fn iter_set_positions_with_offset(
    bytes: &[u8],
    offset: usize,
) -> impl Iterator<Item = usize> + '_ {
    let mut byte_idx = offset / 8;
    let mut in_progress = bytes.get(byte_idx).cloned().unwrap_or(0);

    let skew = offset % 8;
    // `in_progress` is the byte that we're currently looking at, but modified so that the
    // right-most set bit is the next bit we need to inspect. Each time we inspect a bit and return
    // its index, we clear that bit so that we can then move into the next one.

```

### Core Architecture Module: `core/arrow_util/src/dictionary.rs`
```
//! Contains a structure to map from strings to integer symbols based on
//! string interning.
use std::convert::TryFrom;

use arrow::array::{Array, ArrayDataBuilder, DictionaryArray};
use arrow::buffer::NullBuffer;
use arrow::datatypes::{DataType, Int32Type};
use hashbrown::HashMap;
use num_traits::{AsPrimitive, FromPrimitive, Zero};
use snafu::Snafu;

use crate::string::PackedStringArray;

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("duplicate key found {}", key))]
    DuplicateKeyFound { key: String },
}

/// A String dictionary that builds on top of `PackedStringArray` adding O(1)
/// index lookups for a given string
///
/// Heavily inspired by the string-interner crate
#[derive(Debug, Clone)]
pub struct StringDictionary<K> {
    hash: ahash::RandomState,
    /// Used to provide a lookup from string value to key type
    ///
    /// Note: K's hash implementation is not used, instead the raw entry
    /// API is used to store keys w.r.t the hash of the strings themselves
    ///
    dedup: HashMap<K, (), ()>,
    /// Used to store strings
    storage: PackedStringArray<K>,
}

// Not an ideal implementation, but we need to be able to compare these for tests. We can't
// `cfg(test)` gate it since libraries aren't compiled with `cfg(test)`. But the `dedup` and `hash`
// don't really matter, they're just there to help inserting stuff into `storage`, so maybe this is
// fine?
impl<K: PartialEq> PartialEq for StringDictionary<K> {
    fn eq(&self, other: &Self) -> bool {
        // Can't compare `dedup` 'cause it requires `(): BuildHasher` since we have `()` for the
        // second and third parameters for the map
        self.storage == other.storage
    }
}

impl<K: AsPrimitive<usize> + FromPrimitive + Zero> Default for StringDictionary<K> {
    fn default() -> Self {
        Self {
            hash: ahash::RandomState::new(),
            dedup: Default::default(),
            storage: PackedStringArray::new(),
        }
    }
}

impl<K: AsPrimitive<usize> + FromPrimitive + Zero> StringDictionary<K> {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn with_capacity(keys: usize, values: usize) -> Self {
        Self {
            hash: Default::default(),
            dedup: HashMap::with_capacity_and_hasher(keys, ()),
            storage: PackedStringArray::with_capacity(keys, values),
        }
    }

    /// Returns the id corresponding to value, adding an entry for the
    /// id if it is not yet present in the dictionary.
    pub fn lookup_value_or_insert(&mut self, value: &str) -> K {
        use hashbrown::hash_map::RawEntryMut;

        let hasher = &self.hash;
        let storage = &mut self.storage;
        let hash = hash_str(hasher, value);

        let entry = self
            .dedup
            .raw_entry_mut()
            .from_hash(hash, |key| value == storage.get(key.as_()).unwrap());

        match entry {
            RawEntryMut::Occupied(entry) => *entry.into_key(),
            RawEntryMut::Vacant(entry) => {
                let index = storage.append(value);
                let key =
                    K::from_usize(index).expect("failed to fit string index into dictionary key");
                *entry
                    .insert_with_hasher(hash, key, (), |key| {
                        let string = storage.get(key.as_()).unwrap();
                        hash_str(hasher, string)
                    })
                    .0
            }
        }
    }

    /// Returns the ID in self.dictionary that corresponds to `value`, if any.
    pub fn lookup_value(&self, value: &str) -> Option<K> {
        let hash = hash_str(&self.hash, value);
        self.dedup
            .raw_entry()
            .from_hash(hash, |key| value == self.storage.get(key.as_()).unwrap())
            .map(|(&symbol, &())| symbol)
    }

    /// Returns the str in self.dictionary that corresponds to `id`
    pub fn lookup_id(&self, id: K) -> Option<&str> {
        self.storage.get(id.as_())
    }

    pub fn size(&self) -> usize {
        self.storage.size() + self.dedup.len() * std::mem::size_of::<K>()
    }

    pub fn values(&self) -> &PackedStringArray<K> {
        &self.storage
    }

    pub fn into_inner(self) -> PackedStringArray<K> {
        self.storage
    }

    /// Truncates this dictionary removing all keys larger than `id`
    pub fn truncate(&mut self, id: K) {
        let id = id.as_();
        self.dedup.retain(|k, _| k.as_() <= id);
        self.storage.truncate(id + 1)
    }

    /// Clears this dictionary removing all elements
    pub fn clear(&mut self) {
        self.storage.clear();
        self.dedup.clear()
    }
}

fn hash_str(hasher: &ahash::RandomState, value: &str) -> u64 {
    hasher.hash_one(value)
}

impl StringDictionary<i32> {
    /// Convert to an arrow representation with the provided set of
    /// keys and an optional null bitmask
    pub fn to_arrow<I>(&self, keys: I, nulls: Option<NullBuffer>) -> DictionaryArray<Int32Type>
    where
        I: IntoIterator<Item = i32>,
        I::IntoIter: ExactSizeIterator,
    {
        // the nulls are recorded in the keys array, the dictionary itself
        // is entirely non null
        let dictionary_nulls = None;
        let keys = keys.into_iter();

        let array_data = ArrayDataBuilder::new(DataType::Dictionary(
            Box::new(DataType::Int32),
            Box::new(DataType::Utf8),
        ))
        .len(keys.len())
        .add_buffer(keys.collect())
        .add_child_data(self.storage.to_arrow(dictionary_nulls).into_data())
        .nulls(nulls)
        // TODO consider skipping the validation checks by using
        // `build_unchecked()`
        .build()
        .expect("Valid array data");

        DictionaryArray::<Int32Type>::from(array_data)
    }
}

impl<K> TryFrom<PackedStringArray<K>> for StringDictionary<K>
where
    K: AsPrimitive<usize> + FromPrimitive + Zero,
{
    type Error = Error;

    fn try_from(storage: PackedStringArray<K>) -> Result<Self, Error> {
        use hashbrown::hash_map::RawEntryMut;

        let hasher = ahash::RandomState::new();
        let mut dedup: HashMap<K, (), ()> = HashMap::with_capacity_and_hasher(storage.len(), ());
        for (idx, value) in storage.iter().enumerate() {
            let hash = hash_str(&hasher, value);

            let entry = dedup
                .raw_entry_mut()
                .from_hash(hash, |key| value == storage.get(key.as_()).unwrap());

            match entry {
                RawEntryMut::Occupied(_) => {
                    return Err(Error::DuplicateKeyFound {
                        key: value.to_string(),
                    });
                }
                RawEntryMut::Vacant(entry) => {
                    let key =
                        K::from_usize(idx).expect("failed to fit string index into dictionary key");

                    entry.insert_with_hasher(hash, key, (), |key| {
                        let string = storage.get(key.as_()).unwrap();
                        hash_str(&hasher, string)
                    });
                }
            }
        }

        Ok(Self {
            hash: hasher,
            dedup,
            storage,
        })
    }
}

#[cfg(test)]
mod test {
    use std::convert::TryInto;

    use super::*;

    #[test]
    fn test_dictionary() {
        let mut dictionary = StringDictionary::<i32>::new();

        let id1 = dictionary.lookup_value_or_insert("cupcake");
        let id2 = dictionary.lookup_value_or_insert("cupcake");
        let id3 = dictionary.lookup_value_or_insert("womble");

        let id4 = dictionary.lookup_value("cupcake").unwrap();
        let id5 = dictionary.lookup_value("womble").unwrap();

        let cupcake = dictionary.lookup_id(id4).unwrap();
        let womble = dictionary.lookup_id(id5).unwrap();

        let arrow_expected = arrow::array::StringArray::from(vec!["cupcake", "womble"]);
        let arrow_actual = dictionary.values().to_arrow(None);

        assert_eq!(id1, id2);
        assert_eq!(id1, id4);
        assert_ne!(id1, id3);
        assert_eq!(id3, id5);

        assert_eq!(cupcake, "cupcake");
        assert_eq!(womble, "womble");

        assert!(dictionary.lookup_value("foo").is_none());
        assert!(dictionary.lookup_id(-1).is_none());
        assert_eq!(arrow_expected, arrow_actual);
    }

    #[test]
    fn from_string_array() {
        let mut data = PackedStringArray::<u64>::new();
        data.append("cupcakes");
        data.append("foo");
        data.append("bingo");

        let dictionary: StringDictionary<_> = data.try_into().unwrap();

        assert_eq!(dictionary.lookup_value("cupcakes"), Some(0));
        assert_eq!(dictionary.lookup_value("foo"), Some(1));
        assert_eq!(dictionary.lookup_value("bingo"), Some(2));

        assert_eq!(dictionary.lookup_id(0), Some("cupcakes"));
        assert_eq!(dictionary.lookup_id(1), Some("foo"));
        assert_eq!(dictionary.lookup_id(2), Some("bingo"));
    }

    #[test]
    fn from_string_array_duplicates() {
        let mut data = PackedStringArray::<u64>::new();
        data.append("cupcakes");
        data.append("foo");
        data.append("bingo");
        data.append("cupcakes");

        let err = TryInto::<StringDictionary<_>>::try_into(data).expect_err("expected failure");
        assert!(matches!(err, Error::DuplicateKeyFound { key } if &key == "cupcakes"))
    }

    #[test]
    fn test_truncate() {
        let mut dictionary = StringDictionary::<i32>::new();
        dictionary.lookup_value_or_insert("cupcake");
        dictionary.lookup_value_or_insert("cupcake");
        dictionary.lookup_value_or_insert("bingo");
        let bingo = dictionary.lookup_value_or_insert("bingo");
        let bongo = dictionary.lookup_value_or_insert("bongo");
        dictionary.lookup_value_or_insert("bingo");
        dictionary.lookup_value_or_insert("cupcake");

        dictionary.truncate(bingo);

        assert_eq!(dictionary.values().len(), 2);
       
```

### Core Architecture Module: `core/arrow_util/src/display.rs`
```
use arrow::array::{ArrayRef, DurationNanosecondArray, TimestampNanosecondArray};
use arrow::datatypes::{DataType, TimeUnit};
use arrow::error::{ArrowError, Result};
use arrow::record_batch::RecordBatch;

use comfy_table::{Cell, Table};

use chrono::prelude::*;

/// custom version of
/// [pretty_format_batches](arrow::util::pretty::pretty_format_batches)
/// that displays timestamps using RFC3339 format (e.g. `2021-07-20T23:28:50Z`)
///
/// Should be removed if/when the capability is added upstream to arrow:
/// <https://github.com/apache/arrow-rs/issues/599>
pub fn pretty_format_batches(results: &[RecordBatch]) -> Result<String> {
    Ok(create_table(results)?.to_string())
}

/// Convert the value at `column[row]` to a String
///
/// Special cases printing Timestamps in RFC3339 for IOx, otherwise
/// falls back to Arrow's implementation
///
fn array_value_to_string(column: &ArrayRef, row: usize) -> Result<String> {
    match column.data_type() {
        DataType::Timestamp(TimeUnit::Nanosecond, None) if column.is_valid(row) => {
            let ts_column = column
                .as_any()
                .downcast_ref::<TimestampNanosecondArray>()
                .unwrap();

            let ts_value = ts_column.value(row);
            const NANOS_IN_SEC: i64 = 1_000_000_000;
            let secs = ts_value / NANOS_IN_SEC;
            let nanos = (ts_value - (secs * NANOS_IN_SEC)) as u32;
            let ts = DateTime::from_timestamp(secs, nanos).ok_or_else(|| {
                ArrowError::ExternalError(
                    format!("Cannot process timestamp (secs={secs}, nanos={nanos})").into(),
                )
            })?;
            // convert to string in preferred influx format
            let use_z = true;
            Ok(ts.to_rfc3339_opts(SecondsFormat::AutoSi, use_z))
        }
        // TODO(edd): see https://github.com/apache/arrow-rs/issues/1168
        DataType::Duration(TimeUnit::Nanosecond) if column.is_valid(row) => {
            let dur_column = column
                .as_any()
                .downcast_ref::<DurationNanosecondArray>()
                .unwrap();

            let duration = std::time::Duration::from_nanos(
                dur_column
                    .value(row)
                    .try_into()
                    .map_err(|e| ArrowError::InvalidArgumentError(format!("{e:?}")))?,
            );
            Ok(format!("{duration:?}"))
        }
        _ => {
            // fallback to arrow's default printing for other types
            arrow::util::display::array_value_to_string(column, row)
        }
    }
}

/// Convert a series of record batches into a table
///
/// NB: COPIED FROM ARROW
fn create_table(results: &[RecordBatch]) -> Result<Table> {
    let mut table = Table::new();
    table.load_preset("||--+-++|    ++++++");

    if results.is_empty() {
        return Ok(table);
    }

    let schema = results[0].schema();

    let mut header = Vec::new();
    for field in schema.fields() {
        header.push(Cell::new(field.name()));
    }
    table.set_header(header);

    for (i, batch) in results.iter().enumerate() {
        if batch.schema() != schema {
            return Err(ArrowError::SchemaError(format!(
                "Batches have different schemas:\n\nFirst:\n{}\n\nBatch {}:\n{}",
                schema,
                i + 1,
                batch.schema()
            )));
        }

        for row in 0..batch.num_rows() {
            let mut cells = Vec::new();
            for col in 0..batch.num_columns() {
                let column = batch.column(col);
                cells.push(Cell::new(array_value_to_string(column, row)?));
            }
            table.add_row(cells);
        }
    }

    Ok(table)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    use arrow::{
        array::{
            ArrayRef, BooleanArray, DictionaryArray, Float64Array, Int64Array, StringArray,
            UInt64Array,
        },
        datatypes::Int32Type,
    };
    use datafusion::common::assert_contains;

    #[test]
    fn test_formatting() {
        // tests formatting all of the Arrow array types used in IOx

        // tags use string dictionary
        let dict_array: ArrayRef = Arc::new(
            vec![Some("a"), None, Some("b")]
                .into_iter()
                .collect::<DictionaryArray<Int32Type>>(),
        );

        // field types
        let int64_array: ArrayRef =
            Arc::new([Some(-1), None, Some(2)].iter().collect::<Int64Array>());
        let uint64_array: ArrayRef =
            Arc::new([Some(1), None, Some(2)].iter().collect::<UInt64Array>());
        let float64_array: ArrayRef = Arc::new(
            [Some(1.0), None, Some(2.0)]
                .iter()
                .collect::<Float64Array>(),
        );
        let bool_array: ArrayRef = Arc::new(
            [Some(true), None, Some(false)]
                .iter()
                .collect::<BooleanArray>(),
        );
        let string_array: ArrayRef = Arc::new(
            vec![Some("foo"), None, Some("bar")]
                .into_iter()
                .collect::<StringArray>(),
        );

        // timestamp type
        let ts_array: ArrayRef = Arc::new(
            [None, Some(100), Some(1626823730000000000)]
                .iter()
                .collect::<TimestampNanosecondArray>(),
        );

        let batch = RecordBatch::try_from_iter(vec![
            ("dict", dict_array),
            ("int64", int64_array),
            ("uint64", uint64_array),
            ("float64", float64_array),
            ("bool", bool_array),
            ("string", string_array),
            ("time", ts_array),
        ])
        .unwrap();

        let table = pretty_format_batches(&[batch]).unwrap();

        let expected = vec![
            "+------+-------+--------+---------+-------+--------+--------------------------------+",
            "| dict | int64 | uint64 | float64 | bool  | string | time                           |",
            "+------+-------+--------+---------+-------+--------+--------------------------------+",
            "| a    | -1    | 1      | 1.0     | true  | foo    |                                |",
            "|      |       |        |         |       |        | 1970-01-01T00:00:00.000000100Z |",
            "| b    | 2     | 2      | 2.0     | false | bar    | 2021-07-20T23:28:50Z           |",
            "+------+-------+--------+---------+-------+--------+--------------------------------+",
        ];

        let actual: Vec<&str> = table.lines().collect();
        assert_eq!(
            expected, actual,
            "Expected:\n\n{expected:#?}\nActual:\n\n{actual:#?}\n"
        );
    }

    #[test]
    fn test_pretty_format_batches_checks_schemas() {
        let int64_array: ArrayRef = Arc::new([Some(2)].iter().collect::<Int64Array>());
        let uint64_array: ArrayRef = Arc::new([Some(2)].iter().collect::<UInt64Array>());

        let batch1 = RecordBatch::try_from_iter(vec![("col", int64_array)]).unwrap();
        let batch2 = RecordBatch::try_from_iter(vec![("col", uint64_array)]).unwrap();

        let err = pretty_format_batches(&[batch1, batch2]).unwrap_err();
        assert_contains!(err.to_string(), "Batches have different schemas:");
    }
}

```

### Core Architecture Module: `core/arrow_util/src/flight.rs`
```
use std::sync::Arc;

use arrow::datatypes::{DataType, Field, Fields, Schema, SchemaRef};

/// Prepare an arrow Schema for transport over the Arrow Flight protocol
///
/// Converts dictionary types to underlying types due to <https://github.com/apache/arrow-rs/issues/3389>
pub fn prepare_schema_for_flight(schema: &Schema) -> SchemaRef {
    let fields: Fields = schema
        .fields()
        .iter()
        .map(|field| match field.data_type() {
            DataType::Dictionary(_, value_type) => Arc::new(
                Field::new(
                    field.name(),
                    value_type.as_ref().clone(),
                    field.is_nullable(),
                )
                .with_metadata(field.metadata().clone()),
            ),
            _ => Arc::clone(field),
        })
        .collect();

    Arc::new(Schema::new(fields).with_metadata(schema.metadata().clone()))
}

```

### Core Architecture Module: `core/arrow_util/src/lib.rs`
```
#[cfg(test)]
use criterion as _;

pub mod bitset;
pub mod dictionary;
pub mod display;
pub mod flight;
pub mod optimize;
pub mod parquet_meta;
pub mod string;
pub mod util;

/// This has a collection of testing helper functions
pub mod test_util;

```

### Core Architecture Module: `core/arrow_util/src/optimize.rs`
```
use std::collections::BTreeSet;
use std::sync::Arc;

use arrow::array::{Array, ArrayRef, DictionaryArray, StringArray};
use arrow::datatypes::{DataType, Int32Type};
use arrow::error::{ArrowError, Result};
use arrow::record_batch::RecordBatch;
use hashbrown::HashMap;

use crate::dictionary::StringDictionary;

/// Takes a record batch and returns a new record batch with dictionaries
/// optimized to contain no duplicate or unreferenced values
///
/// Where the input dictionaries are sorted, the output dictionaries
/// will also be
pub fn optimize_dictionaries(batch: &RecordBatch) -> Result<RecordBatch> {
    let schema = batch.schema();
    let new_columns = batch
        .columns()
        .iter()
        .zip(schema.fields())
        .map(|(col, field)| match field.data_type() {
            DataType::Dictionary(key, value) => optimize_dict_col(col, key, value),
            _ => Ok(Arc::clone(col)),
        })
        .collect::<Result<Vec<_>>>()?;

    RecordBatch::try_new(schema, new_columns)
}

/// Optimizes the dictionaries for a column
fn optimize_dict_col(
    col: &ArrayRef,
    key_type: &DataType,
    value_type: &DataType,
) -> Result<ArrayRef> {
    if key_type != &DataType::Int32 {
        return Err(ArrowError::NotYetImplemented(format!(
            "truncating non-Int32 dictionaries not supported: {key_type}"
        )));
    }

    if value_type != &DataType::Utf8 {
        return Err(ArrowError::NotYetImplemented(format!(
            "truncating non-string dictionaries not supported: {value_type}"
        )));
    }

    let col = col
        .as_any()
        .downcast_ref::<DictionaryArray<Int32Type>>()
        .expect("unexpected datatype");

    let keys = col.keys();
    let values = col.values();
    let values = values
        .as_any()
        .downcast_ref::<StringArray>()
        .expect("unexpected datatype");

    // The total length of the resulting values array
    let mut values_len = 0_usize;

    // Keys that appear in the values array
    // Use a BTreeSet to preserve the order of the dictionary
    let mut used_keys = BTreeSet::new();
    for key in keys.iter().flatten() {
        if used_keys.insert(key) {
            values_len += values.value_length(key as usize) as usize;
        }
    }

    // Then perform deduplication
    let mut new_dictionary = StringDictionary::with_capacity(used_keys.len(), values_len);
    let mut old_to_new_idx: HashMap<i32, i32> = HashMap::with_capacity(used_keys.len());
    for key in used_keys {
        let new_key = new_dictionary.lookup_value_or_insert(values.value(key as usize));
        old_to_new_idx.insert(key, new_key);
    }

    let new_keys = keys.iter().map(|x| match x {
        Some(x) => *old_to_new_idx.get(&x).expect("no mapping found"),
        None => -1,
    });

    let nulls = keys.nulls().cloned();
    Ok(Arc::new(new_dictionary.to_arrow(new_keys, nulls)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate as arrow_util;
    use crate::assert_batches_eq;
    use arrow::array::{ArrayDataBuilder, DictionaryArray, Float64Array, Int32Array, StringArray};
    use arrow::compute::concat;
    use std::iter::FromIterator;

    #[test]
    fn test_optimize_dictionaries() {
        let values = StringArray::from(vec![
            "duplicate",
            "duplicate",
            "foo",
            "boo",
            "unused",
            "duplicate",
        ]);
        let keys = Int32Array::from(vec![
            Some(0),
            Some(1),
            None,
            Some(1),
            Some(2),
            Some(5),
            Some(3),
        ]);

        let batch = RecordBatch::try_from_iter(vec![(
            "foo",
            Arc::new(build_dict(keys, values)) as ArrayRef,
        )])
        .unwrap();

        let optimized = optimize_dictionaries(&batch).unwrap();

        let col = optimized
            .column(0)
            .as_any()
            .downcast_ref::<DictionaryArray<Int32Type>>()
            .unwrap();

        let values = col.values();
        let values = values.as_any().downcast_ref::<StringArray>().unwrap();
        let values = values.iter().flatten().collect::<Vec<_>>();
        assert_eq!(values, vec!["duplicate", "foo", "boo"]);

        assert_batches_eq!(
            vec![
                "+-----------+",
                "| foo       |",
                "+-----------+",
                "| duplicate |",
                "| duplicate |",
                "|           |",
                "| duplicate |",
                "| foo       |",
                "| duplicate |",
                "| boo       |",
                "+-----------+",
            ],
            &[optimized]
        );
    }

    #[test]
    fn test_optimize_dictionaries_concat() {
        let f1_1 = Float64Array::from(vec![Some(1.0), Some(2.0), Some(3.0), Some(4.0)]);
        let t2_1 = DictionaryArray::<Int32Type>::from_iter(vec![
            Some("a"),
            Some("g"),
            Some("a"),
            Some("b"),
        ]);
        let t1_1 = DictionaryArray::<Int32Type>::from_iter(vec![
            Some("a"),
            Some("a"),
            Some("b"),
            Some("b"),
        ]);

        let f1_2 = Float64Array::from(vec![Some(1.0), Some(5.0), Some(2.0), Some(46.0)]);
        let t2_2 = DictionaryArray::<Int32Type>::from_iter(vec![
            Some("a"),
            Some("b"),
            Some("a"),
            Some("a"),
        ]);
        let t1_2 = DictionaryArray::<Int32Type>::from_iter(vec![
            Some("a"),
            Some("d"),
            Some("a"),
            Some("b"),
        ]);

        let concat = RecordBatch::try_from_iter(vec![
            ("f1", concat(&[&f1_1, &f1_2]).unwrap()),
            ("t2", concat(&[&t2_1, &t2_2]).unwrap()),
            ("t1", concat(&[&t1_1, &t1_2]).unwrap()),
        ])
        .unwrap();

        let optimized = optimize_dictionaries(&concat).unwrap();

        let col = optimized
            .column(optimized.schema().column_with_name("t2").unwrap().0)
            .as_any()
            .downcast_ref::<DictionaryArray<Int32Type>>()
            .unwrap();

        let values = col.values();
        let values = values.as_any().downcast_ref::<StringArray>().unwrap();
        let values = values.iter().flatten().collect::<Vec<_>>();
        assert_eq!(values, vec!["a", "g", "b"]);

        let col = optimized
            .column(optimized.schema().column_with_name("t1").unwrap().0)
            .as_any()
            .downcast_ref::<DictionaryArray<Int32Type>>()
            .unwrap();

        let values = col.values();
        let values = values.as_any().downcast_ref::<StringArray>().unwrap();
        let values = values.iter().flatten().collect::<Vec<_>>();
        assert_eq!(values, vec!["a", "b", "d"]);

        assert_batches_eq!(
            vec![
                "+------+----+----+",
                "| f1   | t2 | t1 |",
                "+------+----+----+",
                "| 1.0  | a  | a  |",
                "| 2.0  | g  | a  |",
                "| 3.0  | a  | b  |",
                "| 4.0  | b  | b  |",
                "| 1.0  | a  | a  |",
                "| 5.0  | b  | d  |",
                "| 2.0  | a  | a  |",
                "| 46.0 | a  | b  |",
                "+------+----+----+",
            ],
            &[optimized]
        );
    }

    #[test]
    fn test_optimize_dictionaries_null() {
        let values = StringArray::from(vec!["bananas"]);
        let keys = Int32Array::from(vec![None, None, Some(0)]);
        let col = Arc::new(build_dict(keys, values)) as ArrayRef;

        let col = optimize_dict_col(&col, &DataType::Int32, &DataType::Utf8).unwrap();

        let batch = RecordBatch::try_from_iter(vec![("t", col)]).unwrap();

        assert_batches_eq!(
            vec![
                "+---------+",
                "| t       |",
                "+---------+",
                "|         |",
                "|         |",
                "| bananas |",
                "+---------+",
            ],
            &[batch]
        );
    }

    #[test]
    fn test_optimize_dictionaries_slice() {
        let values = StringArray::from(vec!["bananas"]);
        let keys = Int32Array::from(vec![None, Some(0), None]);
        let col = Arc::new(build_dict(keys, values)) as ArrayRef;
        let col = col.slice(1, 2);

        let col = optimize_dict_col(&col, &DataType::Int32, &DataType::Utf8).unwrap();

        let batch = RecordBatch::try_from_iter(vec![("t", col)]).unwrap();

        assert_batches_eq!(
            vec![
                "+---------+",
                "| t       |",
                "+---------+",
                "| bananas |",
                "|         |",
                "+---------+",
            ],
            &[batch]
        );
    }

    fn build_dict(keys: Int32Array, values: StringArray) -> DictionaryArray<Int32Type> {
        let data = ArrayDataBuilder::new(DataType::Dictionary(
            Box::new(DataType::Int32),
            Box::new(DataType::Utf8),
        ))
        .len(keys.len())
        .add_buffer(keys.to_data().buffers()[0].clone())
        .nulls(keys.nulls().cloned())
        .add_child_data(values.into_data())
        .build()
        .unwrap();

        DictionaryArray::from(data)
    }
}

```

### Core Architecture Module: `core/arrow_util/src/parquet_meta.rs`
```
//! Utils for parquet metadata.

use arrow::datatypes::SchemaRef;
use base64::Engine;
use parquet::{arrow::ARROW_SCHEMA_META_KEY, file::metadata::KeyValue};

/// Encodes the Arrow schema into the IPC format, and base64 encodes it.
///
/// This method is copied from a private method in the arrow-rs upstream code.
/// (Refer: <https://github.com/apache/arrow-rs/blob/2905ce6796cad396241fc50164970dbf1237440a/parquet/src/arrow/schema/mod.rs#L178-L193>)
///
/// See <https://github.com/apache/arrow-rs/issues/6177> for discussion
///
/// TODO: Replace with upstream call when
/// <https://github.com/apache/arrow-rs/pull/6916> is available
fn encode_arrow_schema(schema: &SchemaRef) -> String {
    let options = arrow_ipc::writer::IpcWriteOptions::default();
    let data_gen = arrow_ipc::writer::IpcDataGenerator::default();
    let error_on_replacement = true;
    let mut tracker = arrow_ipc::writer::DictionaryTracker::new(error_on_replacement);
    let mut serialized_schema =
        data_gen.schema_to_bytes_with_dictionary_tracker(schema, &mut tracker, &options);

    // manually prepending the length to the schema as arrow uses the legacy IPC format
    // TODO: change after addressing ARROW-9777
    let schema_len = serialized_schema.ipc_message.len();
    let mut len_prefix_schema = Vec::with_capacity(schema_len + 8);
    len_prefix_schema.append(&mut vec![255u8, 255, 255, 255]);
    len_prefix_schema.append((schema_len as u32).to_le_bytes().to_vec().as_mut());
    len_prefix_schema.append(&mut serialized_schema.ipc_message);

    base64::prelude::BASE64_STANDARD.encode(&len_prefix_schema)
}

/// When encoding to parquet, the ArrowWriter persists the arrow schema, keyed to
/// [`ARROW_SCHEMA_META_KEY`] in the parquet metadata.
///
/// This occurs as the default behavior when using the ArrowWriter in single threaded writes.
/// (refer to: <https://github.com/apache/arrow-rs/blob/2905ce6796cad396241fc50164970dbf1237440a/parquet/src/arrow/arrow_writer/mod.rs#L188-L190>)
///
/// TODO: file upstream ticket to make this default behavior uniform across other parquet encoders
/// including the parallel writer.
/// See <https://github.com/apache/arrow-rs/issues/6177>
pub fn add_encoded_arrow_schema_to_metadata(arrow_schema: SchemaRef, meta: &mut Vec<KeyValue>) {
    let encoded = encode_arrow_schema(&arrow_schema);

    let schema_kv = KeyValue {
        key: ARROW_SCHEMA_META_KEY.to_string(),
        value: Some(encoded),
    };

    // check if ARROW:schema exists, and overwrite it
    let schema_meta = meta
        .iter()
        .enumerate()
        .find(|(_, kv)| kv.key.as_str() == ARROW_SCHEMA_META_KEY);
    match schema_meta {
        Some((i, _)) => {
            meta.remove(i);
            meta.push(schema_kv);
        }
        None => {
            meta.push(schema_kv);
        }
    }
}

```

### Core Architecture Module: `core/arrow_util/src/string.rs`
```
use arrow::array::ArrayDataBuilder;
use arrow::array::StringArray;
use arrow::buffer::Buffer;
use arrow::buffer::NullBuffer;
use num_traits::{AsPrimitive, FromPrimitive, Zero};
use std::fmt::Debug;
use std::ops::Range;

/// A packed string array that stores start and end indexes into
/// a contiguous string slice.
///
/// The type parameter K alters the type used to store the offsets
#[derive(Debug, Clone, PartialEq)]
pub struct PackedStringArray<K> {
    /// The start and end offsets of strings stored in storage
    offsets: Vec<K>,
    /// A contiguous array of string data
    storage: String,
}

impl<K: Zero> Default for PackedStringArray<K> {
    fn default() -> Self {
        Self {
            offsets: vec![K::zero()],
            storage: String::new(),
        }
    }
}

impl<K: AsPrimitive<usize> + FromPrimitive + Zero> PackedStringArray<K> {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn new_empty(len: usize) -> Self {
        Self {
            offsets: vec![K::zero(); len + 1],
            storage: String::new(),
        }
    }

    pub fn with_capacity(keys: usize, values: usize) -> Self {
        let mut offsets = Vec::with_capacity(keys + 1);
        offsets.push(K::zero());

        Self {
            offsets,
            storage: String::with_capacity(values),
        }
    }

    /// Append a value
    ///
    /// Returns the index of the appended data
    pub fn append(&mut self, data: &str) -> usize {
        let id = self.offsets.len() - 1;

        let offset = self.storage.len() + data.len();
        let offset = K::from_usize(offset).expect("failed to fit into offset type");

        self.offsets.push(offset);
        self.storage.push_str(data);

        id
    }

    /// Extends this [`PackedStringArray`] by the contents of `other`
    pub fn extend_from(&mut self, other: &Self) {
        let offset = self.storage.len();
        self.storage.push_str(other.storage.as_str());
        // Copy offsets skipping the first element as this string start delimiter is already
        // provided by the end delimiter of the current offsets array
        self.offsets.extend(
            other
                .offsets
                .iter()
                .skip(1)
                .map(|x| K::from_usize(x.as_() + offset).expect("failed to fit into offset type")),
        )
    }

    /// Extends this [`PackedStringArray`] by `range` elements from `other`
    pub fn extend_from_range(&mut self, other: &Self, range: Range<usize>) {
        let first_offset: usize = other.offsets[range.start].as_();
        let end_offset: usize = other.offsets[range.end].as_();

        let insert_offset = self.storage.len();

        self.storage
            .push_str(&other.storage[first_offset..end_offset]);

        self.offsets.extend(
            other.offsets[(range.start + 1)..(range.end + 1)]
                .iter()
                .map(|x| {
                    K::from_usize(x.as_() - first_offset + insert_offset)
                        .expect("failed to fit into offset type")
                }),
        )
    }

    /// Get the value at a given index
    pub fn get(&self, index: usize) -> Option<&str> {
        let start_offset = self.offsets.get(index)?.as_();
        let end_offset = self.offsets.get(index + 1)?.as_();

        Some(&self.storage[start_offset..end_offset])
    }

    /// Pads with empty strings to reach length
    pub fn extend(&mut self, len: usize) {
        let offset = K::from_usize(self.storage.len()).expect("failed to fit into offset type");
        self.offsets.resize(self.offsets.len() + len, offset);
    }

    /// Truncates the array to the given length
    pub fn truncate(&mut self, len: usize) {
        self.offsets.truncate(len + 1);
        let last_idx = self.offsets.last().expect("offsets empty");
        self.storage.truncate(last_idx.as_());
    }

    /// Removes all elements from this array
    pub fn clear(&mut self) {
        self.offsets.truncate(1);
        self.storage.clear();
    }

    pub fn iter(&self) -> PackedStringIterator<'_, K> {
        PackedStringIterator {
            array: self,
            index: 0,
        }
    }

    /// The number of strings in this array
    pub fn len(&self) -> usize {
        self.offsets.len() - 1
    }

    pub fn is_empty(&self) -> bool {
        self.offsets.len() == 1
    }

    /// Return the amount of memory in bytes taken up by this array
    pub fn size(&self) -> usize {
        self.storage.capacity() + self.offsets.capacity() * std::mem::size_of::<K>()
    }

    pub fn inner(&self) -> (&[K], &str) {
        (&self.offsets, &self.storage)
    }

    pub fn into_inner(self) -> (Vec<K>, String) {
        (self.offsets, self.storage)
    }

    /// Split this [`PackedStringArray`] at `n`, such that `self`` contains the
    /// elements `[0, n)` and the returned [`PackedStringArray`] contains
    /// elements `[n, len)`.
    pub fn split_off(&mut self, n: usize) -> Self {
        if n > self.len() {
            return Default::default();
        }

        let offsets = self.offsets.split_off(n + 1);

        // Figure out where to split the string storage.
        let split_point = self.offsets.last().map(|v| v.as_()).unwrap();

        // Split the storage at the split point, such that the first N values
        // appear in self.
        let storage = self.storage.split_off(split_point);

        // The new "offsets" now needs remapping such that the first offset
        // starts at 0, so that indexing into the new storage string will hit
        // the right start point.
        let offsets = std::iter::once(K::zero())
            .chain(
                offsets
                    .into_iter()
                    .map(|v| K::from_usize(v.as_() - split_point).unwrap()),
            )
            .collect::<Vec<_>>();

        Self { offsets, storage }
    }
}

impl PackedStringArray<i32> {
    /// Convert to an arrow with an optional null bitmask
    pub fn to_arrow(&self, nulls: Option<NullBuffer>) -> StringArray {
        let len = self.offsets.len() - 1;
        let offsets = Buffer::from_slice_ref(&self.offsets);
        let values = Buffer::from(self.storage.as_bytes());

        let data = ArrayDataBuilder::new(arrow::datatypes::DataType::Utf8)
            .len(len)
            .add_buffer(offsets)
            .add_buffer(values)
            .nulls(nulls)
            .build()
            // TODO consider skipping the validation checks by using
            // `new_unchecked`
            .expect("Valid array data");
        StringArray::from(data)
    }
}

#[derive(Debug)]
pub struct PackedStringIterator<'a, K> {
    array: &'a PackedStringArray<K>,
    index: usize,
}

impl<'a, K: AsPrimitive<usize> + FromPrimitive + Zero> Iterator for PackedStringIterator<'a, K> {
    type Item = &'a str;

    fn next(&mut self) -> Option<Self::Item> {
        let item = self.array.get(self.index)?;
        self.index += 1;
        Some(item)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let len = self.array.len() - self.index;
        (len, Some(len))
    }
}

#[cfg(test)]
mod tests {
    use crate::string::PackedStringArray;

    use proptest::prelude::*;

    #[test]
    fn test_storage() {
        let mut array = PackedStringArray::<i32>::new();

        array.append("hello");
        array.append("world");
        array.append("cupcake");

        assert_eq!(array.get(0).unwrap(), "hello");
        assert_eq!(array.get(1).unwrap(), "world");
        assert_eq!(array.get(2).unwrap(), "cupcake");
        assert!(array.get(-1_i32 as usize).is_none());

        assert!(array.get(3).is_none());

        array.extend(2);
        assert_eq!(array.get(3).unwrap(), "");
        assert_eq!(array.get(4).unwrap(), "");
        assert!(array.get(5).is_none());
    }

    #[test]
    fn test_empty() {
        let array = PackedStringArray::<u8>::new_empty(20);
        assert_eq!(array.get(12).unwrap(), "");
        assert_eq!(array.get(9).unwrap(), "");
        assert_eq!(array.get(3).unwrap(), "");
    }

    #[test]
    fn test_truncate() {
        let mut array = PackedStringArray::<i32>::new();

        array.append("hello");
        array.append("world");
        array.append("cupcake");

        array.truncate(1);
        assert_eq!(array.len(), 1);
        assert_eq!(array.get(0).unwrap(), "hello");

        array.append("world");
        assert_eq!(array.len(), 2);
        assert_eq!(array.get(0).unwrap(), "hello");
        assert_eq!(array.get(1).unwrap(), "world");
    }

    #[test]
    fn test_extend_from() {
        let mut a = PackedStringArray::<i32>::new();

        a.append("hello");
        a.append("world");
        a.append("cupcake");
        a.append("");

        let mut b = PackedStringArray::<i32>::new();

        b.append("foo");
        b.append("bar");

        a.extend_from(&b);

        let a_content: Vec<_> = a.iter().collect();
        assert_eq!(
            a_content,
            vec!["hello", "world", "cupcake", "", "foo", "bar"]
        );
    }

    #[test]
    fn test_extend_from_range() {
        let mut a = PackedStringArray::<i32>::new();

        a.append("hello");
        a.append("world");
        a.append("cupcake");
        a.append("");

        let mut b = PackedStringArray::<i32>::new();

        b.append("foo");
        b.append("bar");
        b.append("");
        b.append("fiz");

        a.extend_from_range(&b, 1..3);

        assert_eq!(a.len(), 6);

        let a_content: Vec<_> = a.iter().collect();
        assert_eq!(a_content, vec!["hello", "world", "cupcake", "", "bar", ""]);

        // Should be a no-op
        a.extend_from_range(&b, 0..0);

        let a_content: Vec<_> = a.iter().collect();
        assert_eq!(a_content, vec!["hello", "world", "cupcake", "", "bar", ""]);

        a.extend_from_range(&b, 0..1);

        let a_content: Vec<_> = a.iter().collect();
        assert_eq!(
            a_content,
            vec
```

### Core Architecture Module: `core/arrow_util/src/util.rs`
```
//! Utility functions for working with arrow

use std::sync::Arc;

use arrow::{
    array::new_null_array, datatypes::SchemaRef, error::ArrowError, record_batch::RecordBatch,
};

/// Create a new [`RecordBatch`] that has the specified schema, adding null values for columns that
/// don't appear in the batch.
pub fn ensure_schema(
    output_schema: &SchemaRef,
    batch: &RecordBatch,
) -> Result<RecordBatch, ArrowError> {
    // Go over all columns of output_schema
    let batch_output_columns = output_schema
        .fields()
        .iter()
        .map(|output_field| {
            // If the field is available in the batch, use it. Otherwise, add a column with all
            // null values.
            batch
                .column_by_name(output_field.name())
                .cloned()
                .unwrap_or_else(|| new_null_array(output_field.data_type(), batch.num_rows()))
        })
        .collect();

    RecordBatch::try_new(Arc::clone(output_schema), batch_output_columns)
}

```

### Core Architecture Module: `core/authz/src/authorization.rs`
```
use super::Permission;

/// Authorization information from a token. This contains the subset of
/// the requested permissions that are allowed by the token along with
/// additional information from the token.
#[derive(Debug)]
pub struct Authorization {
    subject: Option<String>,
    permissions: Vec<Permission>,
}

impl Authorization {
    /// Create a new Authorization object
    pub fn new(subject: Option<String>, permissions: Vec<Permission>) -> Self {
        Self {
            subject,
            permissions,
        }
    }

    /// Get the subject of the authorization, if there is one.
    pub fn subject(&self) -> Option<&str> {
        self.subject.as_deref()
    }

    /// Take the subject from the authorization.
    pub fn into_subject(self) -> Option<String> {
        self.subject
    }

    /// Get the subset of requested permissions that were granted by the
    /// token. Error::Forbidden is returned if the authorization
    /// has no granted permissions.
    pub fn permissions(&self) -> &Vec<Permission> {
        &self.permissions
    }
}

impl From<Authorization> for Vec<Permission> {
    fn from(v: Authorization) -> Self {
        v.permissions
    }
}

```

### Core Architecture Module: `core/authz/src/authorizer.rs`
```
use std::ops::ControlFlow;

use async_trait::async_trait;
use backoff::{Backoff, BackoffConfig};

use super::{Authorization, Error, Permission};

/// An authorizer is used to validate a request
/// (+ associated permissions needed to fulfill the request)
/// with an authorization token that has been extracted from the request.
#[async_trait]
pub trait Authorizer: std::fmt::Debug + Send + Sync {
    /// Determine the authorization provided by a request token.
    ///
    /// The returned [Authorization] contains the subject associated
    /// with the token, if available, along with the subset of the
    /// requested permissions provided by the token.
    ///
    /// Implementations of this trait should return the specified errors under
    /// the following conditions:
    ///
    /// * [`Error::InvalidToken`]: the token is invalid / in an incorrect
    ///       format / otherwise corrupt and a permission check cannot be
    ///       performed
    ///
    /// * [`Error::NoToken`]: the token was not provided
    ///
    /// * [`Error::Forbidden`]: the token was well formed, but lacks
    ///       authorisation to perform the requested action
    ///
    /// * [`Error::Verification`]: the token permissions were not possible
    ///       to validate - an internal error has occurred
    async fn authorize(
        &self,
        token: Option<Vec<u8>>,
        perms: &[Permission],
    ) -> Result<Authorization, Error>;

    /// Make a test request that determines if end-to-end communication
    /// with the service is working.
    ///
    /// Test is performed during deployment, with ordering of availability not being guaranteed.
    async fn probe(&self) -> Result<(), Error> {
        Backoff::new(&BackoffConfig::default())
            .retry_with_backoff("probe iox-authz service", async move || {
                match self.authorize(Some(b"".to_vec()), &[]).await {
                    // got response from authorizer server
                    Ok(_)
                    | Err(Error::Forbidden { .. })
                    | Err(Error::InvalidToken)
                    | Err(Error::NoToken) => ControlFlow::Break(Ok(())),
                    // communication error == Error::Verification
                    Err(e) => ControlFlow::<_, Error>::Continue(e),
                }
            })
            .await
            .expect("retry forever")
    }
}

/// Wrapped `Option<dyn Authorizer>`
/// Provides response to inner `IoxAuthorizer::permissions()`
#[async_trait]
impl<T: Authorizer> Authorizer for Option<T> {
    async fn authorize(
        &self,
        token: Option<Vec<u8>>,
        perms: &[Permission],
    ) -> Result<Authorization, Error> {
        match self {
            Some(authz) => authz.authorize(token, perms).await,
            // no authz rpc service => return same perms requested. Used for testing.
            None => Ok(Authorization::new(None, perms.to_vec())),
        }
    }
}

#[async_trait]
impl<T: AsRef<dyn Authorizer> + std::fmt::Debug + Send + Sync> Authorizer for T {
    async fn authorize(
        &self,
        token: Option<Vec<u8>>,
        perms: &[Permission],
    ) -> Result<Authorization, Error> {
        self.as_ref().authorize(token, perms).await
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #27682** (2026-10-02): **fix: Add fallback to direct downloads for goproxy failures (#27676)**
  *Symptoms*: (cherry picked from commit 70754b18513e8d1f650a97275c7e32a9adab9e1a)

- **Issue #27681** (2026-10-01): **chore(ui): Update influxdb UI to OSS-v2.10.0**
  *Symptoms*: 

- **Issue #27680** (2026-10-01): **chore(sync): influxdb_pro 2026-10-01 (3.12)**
  *Symptoms*: Part of cutting 3.12.0.  Source: 7dd361197ee2834eaa56089b67ffe59ad02e349a  Commits: - `7dd361197e` chore(release): update versions to 3.12.0 (influxdata/influxdb_pro#6245) - `5f6aa46e70` fix(query): fetch a parquet file once per scan, not once per partition (backport influxdata/influxdb_pro#6014 to 3.12) (influxdata/influxdb_pro#6101) - `41872beedf` fix(parquet_cache): never prune in-flight entries; de-dupe queued fetches for the same path (influxdata/influxdb_pro#6032) (influxdata/influxdb_pro#6102) - `be8decc260` chore(deny): ignore wasmtime advisories RUSTSEC-2026-0313 to 0316 (3.12 backport of influxdata/influxdb_pro#6194) (influxdata/influxdb_pro#6196)  Co-authored-by: praveen-influx <pkumar@influxdata.com> Co-authored-by: Reid Kaufmann <73494261+reidkaufmann@users.noreply.github.com>  

- **Issue #27679** (2026-10-03): **feat: report /health and /ready numbers as structured JSON fields**
  *Symptoms*: Every number /health and /ready report lived inside a free-text message -- "loading shards 47.0% (94 / 200)" -- or a Go duration string, so a poller that logs or graphs them had to regex every response and broke whenever a message was reworded. Checks now report those numbers beside the message as named groups of numeric values with a unit, e.g. "progress": {"completed": 94, "total": 200, "unit": "shards"}, and /ready adds uptime in seconds. Shard loading, shard failures, task-scheduler lag, and bolt probe age all report this way. HEALTH_READY.md documents each check's groups.  A check without groups renders byte-identical to before. The groups are detail, withheld wherever health auth withholds the message; uptime, like up, is always shown. 

- **Issue #27678** (2026-09-30): **chore(ci): add republish workflow for re-publishing a release tag (#2…**
  *Symptoms*: …7611)  * chore(ci): add republish workflow for re-publishing a release tag  Add a republish workflow for rebuilding and republishing a release tag if the original source build succeeded, but other parts of the CI pipeline failed. This allows those parts that are not integral to building the binaries to be fixed and release performed without needing to move the tag or burn a release number.  The republish workflow takes its source from a release tag and its configuration from the branch it is triggered against. A new 'release-ref' parameter names the tag, and 'checkout_source' replaces plain 'checkout' throughout, detaching to that tag so get-version derives VERSION from it exactly as it does on a tag build.  releng/republish triggers the workflow through the CircleCI API. The workflow could also be triggered directly from the CircleCI UI.  * fix: use release-ref parameter through envvar for safety  Use release-ref parameter through envvar for safety. Also fix an indentation issue in the package step.  * chore: tighten release tag detection  Tighten release tag detection so that it requires a major, minor, and patch version number (e.g. "v1.13.0"). Previously tags with missing prelease versions (e.g. "v1.13") and minor versions (e.g. "v1") would match.  * chore: make republish preflight checks more robust  Make republish script's preflight checks more robust. Also, include republish CircleCI pipeline ID in post-trigger message.  * fix: republish binary v

- **Issue #27677** (2026-09-30): **ci: push release artifacts to Cloudflare R2 instead of AWS S3 (#27595)**
  *Symptoms*: (cherry picked from commit f0281924ae2d2865dd1b981320d795a5e246639e) 

- **Issue #27676** (2026-10-01): **fix: Add fallback to direct downloads for goproxy failures**
  *Symptoms*: Closes #27607  

- **Issue #27675** (2026-09-30): **fix: require unique nonempty check names**
  *Symptoms*:  Each check on /health and /ready must now have a name, and no two health   checks or two ready checks may share one. A health check and a ready   check may still use the same name. Registering a check with an empty or   duplicate name fails with an error. influxd stops at startup if any of   its own checks has an invalid name, instead of serving /health or /ready   with an ambiguous entry. If a check added to report a startup failure   has a duplicate name, influxd logs an error, keeps the existing check,   and still returns the original startup error. The unnamed   AddHealthCheck registration is removed.

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

### Incident Patch 1: `06200ef9` (2026-09-18)
**Commit Message**: chore(sync): influxdb_pro 2026-09-18 (#27642)

Source: 790fbd0ecafd36cadc051b03f0a9cfa163ad9b4d

Commits:
- `6b247bf6f1` fix(iox_query): don't leave reporter mid-metric when memory pool is gone (influxdata/influxdb_pro#5918)
- `8553d1f025` feat(wal): log size_bytes for each WAL file flushed and replayed (influxdata/influxdb_pro#5885)
- `75de081c76` perf(parquet): parse snapshot manifests in parallel on the blocking pool (influxdata/influxdb_pro#5874)
- `a0f9fa7095` feat(iox_query): RunOptimizedStreamingMergeBuilder (influxdata/influxdb_pro#5831)
- `eb1e67c327` ci: make cargo-audit advisory failures non-blocking unless dependencies change (influxdata/influxdb_pro#5864)
- `f8370acf4f` fix(wal): enforce max_write_buffer_size by counting buffered ops (influxdata/influxdb_pro#5842)
- `bd073cd3fb` fix(catalog_cache): batch list responses above h2's small-frame threshold (influxdata/influxdb_pro#5518)
- `6692d5ea0a` fix(distributed-queries): enforce query node to be in only one query group (influxdata/influxdb_pro#5834)
- `7bb94ba478` feat(authz): add --hide-operator-token to omit the operator token fro… (influxdata/influxdb_pro#5819)
- `a956695bf5` feat(distributed-queries): reject a que

**File**: `.circleci/config.yml` (modified, +13/-13)
```diff
@@ -61,7 +61,6 @@ executors:
     working_directory: /tmp/workspace/<< pipeline.id >>
 
 orbs:
-  aws-s3: circleci/aws-s3@2.0.0
   rust: circleci/rust@1.6.1
 
 # Unlike when a commit is pushed to a branch, CircleCI does not automatically
@@ -146,10 +145,10 @@ parameters:
   # Consistent environment setup for Python Build Standalone
   PBS_DATE:
     type: string
-    default: "20260610"
+    default: "20260901"
   PBS_VERSION:
     type: string
-    default: "3.13.14"
+    default: "3.13.15"
 
 # Consistent Cargo environment configuration
 cargo_env: &cargo_env
@@ -268,7 +267,7 @@ jobs:
       - rust_components
       - run:
           name: Install cargo-deny
-          command: cargo install cargo-deny --locked
+          command: .circleci/scripts/install-cargo-deny.bash
       - run:
           name: cargo-deny Checks
           # `--warn unsound` downgrades RustSec `informational = "unsound"`
@@ -667,22 +666,23 @@ jobs:
       #   - snapshots
       destination:
         type: string
+    environment:
+      # Newer awscli/boto3 send CRC32 checksum headers that Cloudflare R2
+      # rejects unless checksum calculation is limited to when required.
+      AWS_REQUEST_CHECKSUM_CALCULATION: when_required
     steps:
       - attach_workspace:
           at: /tmp/workspace
-      - aws-s3/sync:
-          arguments:             --acl public-read
-          aws-region:            RELEASE_AWS_REGION
-          aws-access-key-id:     RELEASE_AWS_ACCESS_KEY_ID
-          aws-secret-access-key: RELEASE_AWS_SECRET_ACCESS_KEY
-          from:                  /tmp/workspace/artifacts
-          to:                    s3://dl.influxdata.com/influxdb/<< parameters.destination >>
       - run:
+          name: Upload artifacts to R2
           command: |
-            export AWS_REGION="${RELEASE_AWS_REGION}"
+            pip install --quiet awscli
             export AWS_ACCESS_KEY_ID="${RELEASE_AWS_ACCESS_KEY_ID}"
             export AWS_SECRET_ACCESS_KEY="${RELEASE_AWS_SECRET_ACCESS_KEY}"
-            aws cloudfront create-invalidation --distribution-id "${RELEASE_ARTIFACTS_CLOUDFRONT}" --paths '/influxdb/<< parameters.destination >>/*'
+            aws s3 sync /tmp/workspace/artifacts \
+              "s3://dl-influxdata-com/influxdb/<< parameters.destination >>" \
+              --endpoint-url "${AWS_ENDPOINT_URL_S3}" \
+              --region auto
 
   build-docker:
     parameters:
```

**File**: `.circleci/packages/config.yaml` (modified, +5/-0)
```diff
@@ -137,6 +137,11 @@ packages:
         perms: 0755
         target: usr/lib/influxdb3/sysv-init.sh
 
+      - owner: root
+        group: root
+        perms: 0755
+        target: usr/lib/influxdb3/influxdb3-core-generator
+
       - owner: root
         group: root
         perms: 0644
```

**File**: `.circleci/packages/influxdb3/control/post-install` (modified, +42/-0)
```diff
@@ -36,6 +36,11 @@ SHARE_DIR="/usr/share/influxdb3"
 LIB_DIR="/usr/lib/influxdb3"
 LOG_DIR="/var/log/influxdb3"
 
+# for systemd generator
+SYSTEMD_GENERATOR_DIR="/lib/systemd/system-generators"
+SYSTEMD_GENERATOR_TARGET="$LIB_DIR/$PKG_NAME-generator"
+SYSTEMD_GENERATOR_LINK="$SYSTEMD_GENERATOR_DIR/$PKG_NAME-generator"
+
 rpm_distro() {
     # RPM 4.13 doesn't provide RPM_PACKAGE_NAME, so just assume rpm if not deb
     if [ -z "$DPKG_MAINTSCRIPT_PACKAGE" ]; then
@@ -101,7 +106,44 @@ EOF
     fi
 }
 
+install_systemd_generator() {
+    # For maximum compatibility, keep the executable in the package-owned LIB_DIR
+    # and create its systemd discovery link when the package is installed.
+    if [ ! -d "$SYSTEMD_GENERATOR_DIR" ]; then
+        echo "WARNING: Missing systemd generator directory '$SYSTEMD_GENERATOR_DIR'; skipping generator installation" >&2
+        return 0
+    fi
+
+    if [ -L "$SYSTEMD_GENERATOR_LINK" ]; then
+        current_target=$(readlink "$SYSTEMD_GENERATOR_LINK")
+        if [ "$current_target" = "$SYSTEMD_GENERATOR_TARGET" ]; then
+            return 0
+        fi
+        case "$current_target" in
+        "$LIB_DIR"/*)
+            # Replace a stale discovery symlink whose target no longer matches
+            # the packaged generator, such as when its installed location
+            # changes. Only a target within the package-owned LIB_DIR can come
+            # from this package.
+            rm -f "$SYSTEMD_GENERATOR_LINK"
+            ;;
+        *)
+            # Do not remove an administrator-provided replacement at the same
+            # path. pre-uninstall applies the same rule on removal.
+            echo "WARNING: Refusing to replace administrator-provided '$SYSTEMD_GENERATOR_LINK' pointing to '$current_target'; skipping generator installation" >&2
+            return 0
+            ;;
+        esac
+    elif [ -e "$SYSTEMD_GENERATOR_LINK" ]; then
+        echo "WARNING: Refusing to replace non-symlink '$SYSTEMD_GENERATOR_LINK'; skipping generator installation" >&2
+        return 0
+    fi
+
+    ln -s "$SYSTEMD_GENERATOR_TARGET" "$SYSTEMD_GENERATOR_LINK"
+}
+
 install_systemd() {
+    install_systemd_generator
     systemctl daemon-reload
 
     if ! is_upgrade; then
```

**File**: `.circleci/packages/influxdb3/control/pre-uninstall` (modified, +12/-0)
```diff
@@ -16,6 +16,9 @@ PKG_NAME="$(get_pkgname)" || {
     echo "ERROR: Unable to determine package name" >&2
     exit 1
 }
+SYSTEMD_GENERATOR_DIR="/lib/systemd/system-generators"
+SYSTEMD_GENERATOR_TARGET="/usr/lib/influxdb3/$PKG_NAME-generator"
+SYSTEMD_GENERATOR_LINK="$SYSTEMD_GENERATOR_DIR/$PKG_NAME-generator"
 
 rpm_distro() {
     # RPM 4.13 doesn't provide RPM_PACKAGE_NAME, so just assume rpm if not deb
@@ -32,6 +35,14 @@ deb_distro() {
     return 1
 }
 
+remove_systemd_generator() {
+    # Do not remove an administrator-provided replacement at the same path.
+    if [ -L "$SYSTEMD_GENERATOR_LINK" ] &&
+        [ "$(readlink "$SYSTEMD_GENERATOR_LINK")" = "$SYSTEMD_GENERATOR_TARGET" ]; then
+        rm -f "$SYSTEMD_GENERATOR_LINK"
+    fi
+}
+
 disable_systemd() {
     # Stop the service if running
     systemctl stop "$PKG_NAME" 2>/dev/null || true
@@ -41,6 +52,7 @@ disable_systemd() {
         systemctl disable "$PKG_NAME" || true
     fi
 
+    remove_systemd_generator
     systemctl daemon-reload
 }
 
```

**File**: `.circleci/packages/influxdb3/fs/lib/systemd/system/influxdb3-core.service` (modified, +12/-4)
```diff
@@ -14,7 +14,7 @@ ExecReload=
 WorkingDirectory=/var/lib/influxdb3
 StateDirectory=influxdb3
 # Logs default to journald (StandardOutput/Error); you may optionally set
-# LOG_DESTINATION=file:/var/log/influxdb3/influxdb3.log to use LogsDirectory.
+# INFLUXDB3_LOG_DESTINATION=file:/var/log/influxdb3/influxdb3.log to use LogsDirectory.
 LogsDirectory=influxdb3
 StandardOutput=journal
 StandardError=journal
@@ -65,10 +65,18 @@ ProtectSystem=strict
 #     access. AppArmor or SELinux can be used to mediate these further
 #  c) anonymous sockets aren't a concern since this process won't have the fd
 RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
-# Disallow well-known system services' sockets
-InaccessiblePaths=-/run/avahi-daemon -/run/cups -/run/snapd.socket -/run/dbus/system_bus_socket
-# Disallow well-known desktop services' sockets
+# Disallow well-known system services' runtime directories
+InaccessiblePaths=-/run/avahi-daemon -/run/cups -/run/dbus
+# Disallow well-known desktop services' runtime directories
 InaccessiblePaths=-/tmp/.X11-unix -/tmp/.XIM-unix -/tmp/.ICE-unix -/tmp/.font-unix -/run/user
+# systemd 240 made a denied namespace mount fatal. RHEL-family policy gives
+# init_t no 'mounton' on this socket's type, so masking a socket fails the
+# service with 226 there; measured on Rocky 9 and Rocky 10, and expected on
+# Fedora and SUSE. The generator adds this on the Debian family, and
+# elsewhere only when SELinux is off for the boot; snapd mediates non-root
+# access.
+# See https://github.com/influxdata/influxdb/issues/27329
+#InaccessiblePaths=-/run/snapd.socket
 # Disallow use of all namespaces
 RestrictNamespaces=true
 # Limit syscalls (systemd-analyze syscall-filter) to reduce kernel surface.
```

**File**: `.circleci/packages/influxdb3/fs/usr/lib/influxdb3/influxdb3-core-generator` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+#!/bin/sh
+set -eu
+
+# The package installs this file under /usr/lib/influxdb3, and systemd's
+# generator directory holds only a symlink to it which changes the SELinux
+# domain of the generator. Measured under enforcing mode, a symlink runs as
+# unconfined_service_t on Rocky 10.2 and as initrc_t on Debian 13; a regular
+# file in the generator directory runs as systemd_generic_generator_t and as
+# systemd_generator_t there. Of those four domains, only systemd_generator_t on
+# Debian cannot read /sys/fs/selinux/enforce.
+#
+# While this variance doesn't change the output of the tested distros, the
+# symlink is kept so that this generator does not have to rely on that fallback
+# under a policy not tested here.
+[ "$#" -ge 1 ] || exit 1
+normal_dir="$1"
+selinux_enforce=/sys/fs/selinux/enforce
+dropin_dir="${normal_dir}/influxdb3-core.service.d"
+dropin_file="${dropin_dir}/50-influxdb3-inaccessible-paths.conf"
+
+# Return 0 when the kernel registered selinuxfs, and also when
+# /proc/filesystems cannot be read. Return 1 only when the file is readable
+# and does not list selinuxfs. The kernel cannot mount a filesystem type that
+# it did not register, so a missing entry proves SELinux is off for this boot.
+# /proc/filesystems stays readable in a confined generator domain that cannot
+# read $selinux_enforce.
+selinuxfs_registered() {
+    contents=$(cat /proc/filesystems 2>/dev/null) || return 0
+    [ -n "$contents" ] || return 0
+    case "$contents" in
+        *selinuxfs*) return 0 ;;
+    esac
+    return 1
+}
+
+# Return 0 when SELinux is on for this boot, in any mode. The mode is not
+# used: setenforce 1 can come after the generator ran, and a unit restart does
+# not re-run generators, so the drop-in would survive and fail the unit with
+# status 226.
+selinux_enabled() {
+    if [ -e "$selinux_enforce" ]; then
+        return 0
+    fi
+
+    # The kernel cannot mount selinuxfs if it did not register it, for example
+    # with selinux=0 on the kernel command line.
+    selinuxfs_registered
+}
+
+# Return 0 on the Debian family, whose policy lets init_t mount over a socket.
+# An unreadable or unrecognized /etc/os-release returns 1, so an unknown
+# distribution is treated as one that cannot take the mask.
+is_debian_family() {
+    [ -r /etc/os-release ] || return 1
+    ids=$(sed -n 's/^\(ID\|ID_LIKE\)=//p' /etc/os-release | tr -d \'\" | tr '\n' ' ')
+    case " $ids " in
+        *" debian "*|*" ubuntu "*) return 0 ;;
+    esac
+    return 1
+}
+
+# A daemon reload may reuse the generator output directory, so remove output
+# from an earlier run where SELinux was off before checking the current state.
+rm -f -- "$dropin_file"
+
+if selinux_enabled && ! is_debian_family; then
+    exit 0
+fi
+
+mkdir -p -- "$dropin_dir"
+
+# Only the snapd socket path for InaccessiblePaths is conditional. See the
+# unit file comments for details.
+printf '%s\n' \
+    '[Service]' \
+    "# Disallow snapd's socket" \
+    'InaccessiblePaths=-/run/snapd.socket' \
+    > "$dropin_file"
```

**File**: `.circleci/packages/influxdb3/fs/usr/lib/influxdb3/influxdb3-launcher` (modified, +6/-52)
```diff
@@ -40,18 +40,12 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
     "common": {  # core and enterprise
         # Node configuration
         "http-bind": "INFLUXDB3_HTTP_BIND_ADDR",
-        "node-id": "INFLUXDB3_NODE_IDENTIFIER_PREFIX",
-        "node-id-from-env": "INFLUXDB3_NODE_IDENTIFIER_FROM_ENV",
         # Admin token recovery
         "admin-token-recovery-http-bind": "INFLUXDB3_ADMIN_TOKEN_RECOVERY_HTTP_BIND_ADDR",
-        # Authorization
-        "without-auth": "INFLUXDB3_START_WITHOUT_AUTH",
-        # Datafusion
-        "num-datafusion-threads": "INFLUXDB3_DATAFUSION_NUM_THREADS",
-        # IO
-        "num-io-threads": "INFLUXDB3_IO_NUM_THREADS",
-        # Object storage
-        "data-dir": "INFLUXDB3_DB_DIR",
+        # Runtime threads
+        "num-io-threads": "INFLUXDB3_NUM_IO_THREADS",
+        # Deprecated alias of num-datafusion-threads; exports that flag's env
+        "datafusion-num-threads": "INFLUXDB3_NUM_DATAFUSION_THREADS",
         # AWS (AWS_ prefix, not INFLUXDB3_)
         "aws-access-key-id": "AWS_ACCESS_KEY_ID",
         "aws-allow-http": "AWS_ALLOW_HTTP",
@@ -69,63 +63,23 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
         "azure-storage-account": "AZURE_STORAGE_ACCOUNT",
         # Google Cloud (GOOGLE_ prefix, not INFLUXDB3_)
         "google-service-account": "GOOGLE_SERVICE_ACCOUNT",
-        # Object store
-        "object-store-connection-limit": "INFLUXDB3_OBJECT_STORE_CONNECTION_LIMIT",
-        "object-store-http2-only": "INFLUXDB3_OBJECT_STORE_HTTP2_ONLY",
-        "object-store-http2-max-frame-size": "INFLUXDB3_OBJECT_STORE_HTTP2_MAX_FRAME_SIZE",
-        "object-store-max-retries": "INFLUXDB3_OBJECT_STORE_MAX_RETRIES",
-        "object-store-request-timeout": "INFLUXDB3_OBJECT_STORE_REQUEST_TIMEOUT",
-        "object-store-retry-timeout": "INFLUXDB3_OBJECT_STORE_RETRY_TIMEOUT",
-        "object-store-tls-allow-insecure": "INFLUXDB3_OBJECT_STORE_TLS_ALLOW_INSECURE",
-        "object-store-tls-ca": "INFLUXDB3_OBJECT_STORE_TLS_CA",
         # Processing engine
         "virtual-env-location": "VIRTUAL_ENV",
-        # WAL
-        "snapshotted-wal-files-to-keep": "INFLUXDB3_NUM_WAL_FILES_TO_KEEP",
         # Tokio console
         "tokio-console-enabled": "INFLUXDB3_TOKIO_CONSOLE_ENABLED",
         "tokio-console-client-buffer-capacity": "INFLUXDB3_TOKIO_CONSOLE_CLIENT_BUFFER_CAPACITY",
         "tokio-console-event-buffer-capacity": "INFLUXDB3_TOKIO_CONSOLE_EVENT_BUFFER_CAPACITY",
-        # Tracing
-        "traces-exporter": "INFLUXDB3_TRACES_EXPORTER",
-        "traces-exporter-jaeger-agent-host": "INFLUXDB3_TRACES_EXPORTER_JAEGER_AGENT_HOST",
-        "traces-exporter-jaeger-agent-port": "INFLUXDB3_TRACES_EXPORTER_JAEGER_AGENT_PORT",
-        "traces-exporter-jaeger-debug-name": "INFLUXDB3_TRACES_EXPORTER_JAEGER_DEBUG_NAME",
-        "traces-exporter-jaeger-service-name": "INFLUXDB3_TRACES_EXPORTER_JAEGER_SERVICE_NAME",
-        "traces-exporter-jaeger-trace-context-header-name": "INFLUXDB3_TRACES_EXPORTER_JAEGER_TRACE_CONTEXT_HEADER_NAME",
         "traces-jaeger-debug-name": "INFLUXDB3_TRACES_EXPORTER_JAEGER_DEBUG_NAME",
-        "traces-jaeger-max-msgs-per-second": "INFLUXDB3_TRACES_JAEGER_MAX_MSGS_PER_SECOND",
         "traces-jaeger-tags": "INFLUXDB3_TRACES_EXPORTER_JAEGER_TAGS",
     },
     "core": {
         # Core-specific mappings (currently none - all are in common)
     },
     "enterprise": {
-        # Enterprise cluster configuration
-        "cluster-id": "INFLUXDB3_ENTERPRISE_CLUSTER_ID",
-        "conn-info": "INFLUXDB3_ENTERPRISE_CONN_INFO",
-        "mode": "INFLUXDB3_ENTERPRISE_MODE",
-        "num-cores": "INFLUXDB3_ENTERPRISE_NUM_CORES",
-        # Compaction
-        "compaction-check-interval": "INFLUXDB3_ENTERPRISE_COMPACTION_CHECK_INTERVAL",
-        "compaction-cleanup-wait": "INFLUXDB3_ENTERPRISE_COMPACTION_CLEANUP_WAIT",
-        "compaction-gen2-duration": "INFLUXDB3_ENTERPRISE_COMPACTION_GEN2_DURATION",
-        "compaction-max-num-files-per-plan": "INFLUXDB3_ENTERPRISE_COMPACTION_MAX_NUM_FILES_PER_PLAN",
-        "compaction-multipliers": "INFLUXDB3_ENTERPRISE_COMPACTION_MULTIPLIERS",
-        "compaction-row-limit": "INFLUXDB3_ENTERPRISE_COMPACTION_ROW_LIMIT",
         # Last Value & Distinct Value Caches
-        "preemptive-cache-age": "INFLUXDB3_ENTERPRISE_PREEMPTIVE_CACHE_AGE",
-        # Licensing
-        "license-email": "INFLUXDB3_ENTERPRISE_LICENSE_EMAIL",
-        "license-file": "INFLUXDB3_ENTERPRISE_LICENSE_FILE",
-        "license-type": "INFLUXDB3_ENTERPRISE_LICENSE_TYPE",
+        "preemptive-cache-age": "INFLUXDB3_PREEMPTIVE_CACHE_AGE",
         # Resource limits
-        "catalog-sync-interval": "INFLUXDB3_ENTERPRISE_CATALOG_SYNC_INTERVAL",
-        "max-columns": "INFLUXDB3_ENTERPRISE_PACHA_TREE_MAX_COLUMNS",
-        "num-database-limit": "INFLUXDB3_ENTERPRISE_NUM_DATABASE_LIMIT",
-        "num-table-limit": "INFLUXDB3_ENTERPRISE_NUM_TABLE_LIMIT",
-        "num-total-columns-per-table-limi
```

**File**: `.circleci/packages/influxdb3/fs/usr/share/influxdb3/influxdb3-core.conf` (modified, +37/-37)
```diff
@@ -16,11 +16,11 @@
 
 # Node identifier used as prefix in object store file paths
 # Default (quick-start mode): {hostname}-node or primary-node if hostname
-# unavailable (env: INFLUXDB3_NODE_IDENTIFIER_PREFIX)
+# unavailable (env: INFLUXDB3_NODE_ID)
 #node-id="<NODE_ID>"
 
 # Obtain the node id from the specified environment variable; conflicts with
-# --node-id flag (env: INFLUXDB3_NODE_IDENTIFIER_FROM_ENV)
+# --node-id flag (env: INFLUXDB3_NODE_ID_FROM_ENV)
 #node-id-from-env="<VARNAME>"
 
 # Object storage to use (Required)
@@ -44,7 +44,7 @@
 
 # Logs: filter directive
 # Default: info,iox_query::query_log=warn,influxdb3_query_executor::core=warn
-# (env: LOG_FILTER)
+# (env: INFLUXDB3_LOG_FILTER)
 #log-filter="info,iox_query::query_log=warn,influxdb3_query_executor::core=warn"
 
 # Disable automatic noise-reduction expansion of debug/trace log filters
@@ -78,7 +78,7 @@
 
 # Disables authentication for all server actions (CLI commands and API
 # requests). The server processes all requests without requiring tokens or
-# authentication. (env: INFLUXDB3_START_WITHOUT_AUTH)
+# authentication. (env: INFLUXDB3_WITHOUT_AUTH)
 #without-auth="<BOOL>"
 
 # Optionally disable authz by passing in a comma separated list of resources.
@@ -94,8 +94,8 @@
 #query-log-max-entries="1000"
 
 # Maximum concurrent queries (env: INFLUXDB3_MAX_CONCURRENT_QUERIES)
-# Default: ~2^60 (effectively unlimited)
-#max-concurrent-queries="<LIMIT>"
+# Default: max(50, 4 x effective parallelism — the smaller of CPU cores and DataFusion threads)
+#max-concurrent-queries="50"
 
 # Max parquet files allowed in a query (env: INFLUXDB3_QUERY_FILE_LIMIT)
 #query-file-limit="<LIMIT>"
@@ -106,7 +106,7 @@
 
 # Location to store files locally. Required when using the file object store
 # (default object store type)
-# Default (quick-start mode; env: INFLUXDB3_DB_DIR)
+# Default (quick-start mode; env: INFLUXDB3_DATA_DIR)
 #data-dir="<DIR>"
 
 # Bucket name for cloud object storage
@@ -181,33 +181,33 @@
 # -----------------------------------------------------------------------------
 
 # Connection limit for network object stores
-# Default: 16 (env: OBJECT_STORE_CONNECTION_LIMIT)
+# Default: 16 (env: INFLUXDB3_OBJECT_STORE_CONNECTION_LIMIT)
 #object-store-connection-limit="16"
 
 # HTTP request timeout for object store operations
-# Default: 30s (env: OBJECT_STORE_REQUEST_TIMEOUT)
+# Default: 30s (env: INFLUXDB3_OBJECT_STORE_REQUEST_TIMEOUT)
 #object-store-request-timeout="30s"
 
-# Force HTTP/2 for object stores (env: OBJECT_STORE_HTTP2_ONLY)
+# Force HTTP/2 for object stores (env: INFLUXDB3_OBJECT_STORE_HTTP2_ONLY)
 #object-store-http2-only="false"
 
-# HTTP/2 max frame size (env: OBJECT_STORE_HTTP2_MAX_FRAME_SIZE)
+# HTTP/2 max frame size (env: INFLUXDB3_OBJECT_STORE_HTTP2_MAX_FRAME_SIZE)
 #object-store-http2-max-frame-size="<SIZE>"
 
 # Max request retry attempts
-# Default: 10 (env: OBJECT_STORE_MAX_RETRIES)
+# Default: 10 (env: INFLUXDB3_OBJECT_STORE_MAX_RETRIES)
 #object-store-max-retries="<N>"
 
 # Max retry timeout
-# Default: 180s (env: OBJECT_STORE_RETRY_TIMEOUT)
+# Default: 180s (env: INFLUXDB3_OBJECT_STORE_RETRY_TIMEOUT)
 #object-store-retry-timeout="<TIMEOUT>"
 
-# Skip TLS certificate verification for object storage (env: OBJECT_STORE_TLS_ALLOW_INSECURE)
+# Skip TLS certificate verification for object storage (env: INFLUXDB3_OBJECT_STORE_TLS_ALLOW_INSECURE)
 #object-store-tls-allow-insecure="false"
 
 # Path to custom CA certificate file (PEM format) for object storage
 # Use when your object store uses a certificate signed by a private CA
-# (env: OBJECT_STORE_TLS_CA)
+# (env: INFLUXDB3_OBJECT_STORE_TLS_CA)
 #object-store-tls-ca="<PATH>"
 
 # =============================================================================
@@ -283,10 +283,6 @@
 # Default: 600 (env: INFLUXDB3_WAL_FILES_PER_SNAPSHOT)
 #wal-files-per-snapshot="<SIZE>"
 
-# Maximum size of the WAL write buffer
-# Default: 100000 (env: INFLUXDB3_WAL_MAX_BUFFERED_WRITES)
-#wal-max-buffered-writes="<SIZE>"
-
 # Concurrency limit for WAL replay operations
 # Default: max(num_cpus, 10) - dynamically determined (env: INFLUXDB3_WAL_REPLAY_CONCURRENCY_LIMIT)
 # Note: setting this too high can lead to OOM
@@ -302,7 +298,7 @@
 #wal-replay-fail-on-error="false"
 
 # Number of snapshotted WAL files to retain
-# Default: 300 (env: INFLUXDB3_NUM_WAL_FILES_TO_KEEP)
+# Default: 300 (env: INFLUXDB3_SNAPSHOTTED_WAL_FILES_TO_KEEP)
 #snapshotted-wal-files-to-keep="300"
 
 # Interval for persisting snapshot checkpoints to object storage
@@ -327,8 +323,8 @@
 # =============================================================================
 
 # Maximum size of HTTP requests
-# Default: 10485760 (10 MB) (env: INFLUXDB3_MAX_HTTP_REQUEST_SIZE)
-#max-http-request-size="10485760"
+# Default: 10mb (env: INFLUXDB3_MAX_HTTP_REQUEST_SIZE)
+#max-http-request-size="10mb"
 
 # =============================================================================
 # Memory Management
@@ -339,8 +335,12 @@
 #exec-mem-
```

---

### Incident Patch 2: `693b1fd1` (2026-08-17)
**Commit Message**: chore: remove install_influxdb.sh, now maintained in influxdb-install (#27586)

The install script moved to influxdata/influxdb-install with its history
intact, so this copy is a duplicate that would drift. RELEASE.md points at the
new location for the version-bump step, which is the only part of the release
process that touched the script.

Do not merge until the publisher behind
https://www.influxdata.com/d/install_influxdb3.sh reads from the new
repository. Until then this file is still the copy being served, and deleting
it breaks the documented install command.

**File**: `RELEASE.md` (modified, +7/-3)
```diff
@@ -42,7 +42,7 @@
   curl -LO https://dl.influxdata.com/influxdb/releases/influxdb3-core-3.5.0-0.rc.1_linux_amd64.tar.gz
   ```
 
-- _Note: release candidates do not require updates to `install_influxdb.sh`, Docker image
+- _Note: release candidates do not require updates to the install script, Docker image
   repository, or `apt`/`yum` repositories._
 
 ### Official Release Process
@@ -80,7 +80,9 @@
   curl -LO https://dl.influxdata.com/influxdb/releases/influxdb3-core-3.5.0_linux_amd64.tar.gz
   ```
 
-- When satisfied, update `install_influxdb.sh` to use the new version for `INFLUXDB_OSS_VERSION`.
+- When satisfied, update `install_influxdb.sh` in
+  [influxdata/influxdb-install](https://github.com/influxdata/influxdb-install) to use the new
+  version for `INFLUXDB_OSS_VERSION`.
 
 - Once the above is complete, the official Docker image repository needs to be updated. See
   [Official Docker Image Repository](#official-docker-image-repository) for the steps required to
@@ -186,7 +188,9 @@ we released `3.1`.
   curl -LO https://dl.influxdata.com/influxdb/releases/influxdb3-core-3.0.2_linux_amd64.tar.gz
   ```
 
-- When satisfied, update `install_influxdb.sh` to use the new version for `INFLUXDB_VERSION`
+- When satisfied, update `install_influxdb.sh` in
+  [influxdata/influxdb-install](https://github.com/influxdata/influxdb-install) to use the new
+  version for `INFLUXDB_VERSION`
 
 - Once the above is complete, the official Docker image repository needs to be updated. See
   [Official Docker Image Repository](#official-docker-image-repository) for the steps required to
```

**File**: `install_influxdb.sh` (removed, +0/-1626)
```diff
@@ -1,1626 +0,0 @@
-#!/bin/sh -e
-
-################################################################################
-# InfluxDB 3 Installation Script
-################################################################################
-#
-# PURPOSE:
-#   Automated setup script for InfluxDB 3 with intelligent installation method
-#   selection and environment-aware configuration management. This script is
-#   designed to be run for quick installation and non-production evaluation.
-#
-# INSTALLATION METHODS:
-#   1. Docker Compose: Complete stack (InfluxDB + Explorer UI)
-#      - Installs latest Docker images
-#      - Auto-creates docker-compose.yml with proper networking
-#      - Manages Explorer configuration and session secrets
-#      - Supports upgrades of existing Docker installations
-#
-#   2. Binary Installation: Direct binary download with optional startup
-#      - Downloads precompiled binaries for supported architectures
-#      - Extracts to user home directory (~/.influxdb)
-#      - Auto-configures shell PATH environment
-#      - Offers Quick Start, Custom, or Install-Only modes
-#
-# DIRECTORY STRUCTURE:
-#   Shared data directory (both installation methods):
-#     ~/.influxdb/
-#       ├── data/                  (Database files - shared between Docker & Binary)
-#       └── plugins/               (Custom plugins - shared between Docker & Binary)
-#
-#   Docker Compose specific:
-#     ~/.influxdb/docker/
-#       ├── docker-compose.yml     (Docker service definitions)
-#       ├── .env                   (Environment variables)
-#       └── explorer/
-#           ├── db/                (Explorer database)
-#           └── config/            (Explorer configuration)
-#
-#   Binary specific:
-#     ~/.influxdb/
-#       ├── influxdb3              (Main binary)
-#       └── logs/                  (Timestamped server logs)
-#
-# REQUIREMENTS/PREREQUISITES:
-#   Core Requirements:
-#     - POSIX-compliant shell (sh or bash)
-#     - curl (for downloading binaries and verification)
-#     - tar (for extracting archives)
-#     - shasum (macOS) or sha256sum (Linux) for SHA256 verification
-#
-#   Docker Compose Method:
-#     - Docker engine must be running and responding
-#     - docker and docker compose commands available
-#
-#   Binary Method:
-#     - Supported OS: macOS (ARM64 only), Linux (x86_64 or ARM64)
-#     - Port availability (default 8181, auto-adjusts if in use)
-#
-# EXISTING INSTALLATION HANDLING:
-#   Docker Compose:
-#     - Detects existing docker-compose.yml at ~/.influxdb/docker/
-#     - Automatically upgrades in-place when detected
-#     - Extracts and reuses existing port configuration from .env
-#     - Pulls latest images and restarts containers with health checks
-#     - Preserves all data in bind-mounted directories
-#
-#   Binary:
-#     - Overwrites any existing binary at ~/.influxdb/influxdb3
-#     - Preserves data directory (~/.influxdb/data) automatically
-#     - User can run script repeatedly to upgrade to latest version
-#
-# CONFIGURATION OPTIONS:
-#   Command Line Arguments:
-#     [enterprise]        Install Enterprise edition (default: Core)
-#     --version VERSION   Specify InfluxDB version (default: 3.11.1)
-#
-#   Interactive Prompts (Binary Installation):
-#     Installation Type:  Docker Compose or Binary
-#     Startup Mode:       Quick Start, Custom, or Skip
-#     Node ID:            Identifier for this server instance
-#     Cluster ID:         (Enterprise only) Cluster identifier
-#     Storage Type:       File, S3, Azure, GCS, or Memory
-#     Cloud Credentials:  (If object storage selected)
-#     License Type:       (Enterprise only) Trial or Home
-#     License Email:      (Enterprise only) Email for activation
-#
-#   Docker Compose Specific:
-#     Port Selection:     Automatic via find_next_available_port()
-#     Session Secret:     Generated via openssl or date hash
-#     InfluxDB Port:      Default 8181 (mapped to container 8181)
-#     Explorer Port:      Default 8888 (mapped to container 8080)
-#     Container Restart:  unless-stopped policy
-#
-# EXIT POINTS AND CONDITIONS:
-#   Successful Exits (exit 0):
-#     - Docker Compose: After successful deployment with access points shown
-#     - Docker Upgrade: After successful image pull and container restart
-#     - Binary: After showing "Next Steps" information
-#     - Skip Startup: After installation without starting service
-#
-#   Error Exits (exit 1):
-#     - Unsupported OS/Architecture (Intel Mac, Windows, etc.)
-#     - Docker not running or unavailable (Docker Compose path)
-#     - Failed image pulls or docker compose commands
-#     - Failed binary download, signature verification, or extraction
-#     - Invalid SHA256 checksum on downloaded binary
-#     - Container startup timeout (>60 seconds for InfluxDB/Explorer)
-#     - Port allocation failure or port range exhausted
-#
-# SPECIAL BEHAVIORS:
-#   Binary Download:
-#     - URL format: https://dl.influxdata.com
```

---

### Incident Patch 3: `d28e26e0` (2026-08-10)
**Commit Message**: chore(install_influxdb): update to 3.11.1 for default version installed (#27584)

* chore(install_influxdb): update to 3.11.1 for default version installed

* chore: ignore cargo audit RUSTSEC-2026-0222 for wasmtime 41.0.4

Stores can mix up type indices between engines. Reached transitively
through datafusion-udf-wasm, and only if a Wasm UDF is loaded — UDFs are
off by default (udfs_enabled = false).

There is no patched 41.x release. The fix needs wasmtime >=46.0.2, which
requires an upstream datafusion-udf-wasm bump to a DataFusion 52 rev, so
an ignore is the only option for now.

Ported from influxdata/influxdb_pro#4971.

**File**: `deny.toml` (modified, +8/-0)
```diff
@@ -92,6 +92,14 @@ ignore = [
     # upstream datafusion-udf-wasm bump.
     "RUSTSEC-2026-0188",
     #
+    # wasmtime 41.0.4 stores can mix up type indices between engines
+    # (https://rustsec.org/advisories/RUSTSEC-2026-0222). Same transitive path via
+    # datafusion-udf-wasm; only reachable if a Wasm UDF is loaded, and UDFs are
+    # disabled by default (udfs_enabled = false). The 41.x line has no patched
+    # release. The fix requires wasmtime >=46.0.2, which needs an upstream
+    # datafusion-udf-wasm bump to a DataFusion 52 rev.
+    "RUSTSEC-2026-0222",
+    #
     # TODO: update wasmtime-wasi via datafusion-udf-wasm to a patched version (>=45.0.3; >=46.0.1 is also fixed)
     #
     # pyo3 0.24-0.28 out-of-bounds read in Iterator::nth/nth_back on
```

**File**: `install_influxdb.sh` (modified, +3/-3)
```diff
@@ -72,7 +72,7 @@
 # CONFIGURATION OPTIONS:
 #   Command Line Arguments:
 #     [enterprise]        Install Enterprise edition (default: Core)
-#     --version VERSION   Specify InfluxDB version (default: 3.11.0)
+#     --version VERSION   Specify InfluxDB version (default: 3.11.1)
 #
 #   Interactive Prompts (Binary Installation):
 #     Installation Type:  Docker Compose or Binary
@@ -167,8 +167,8 @@ PORT=8181
 # Set the default (latest) version here. Users may specify a version using the
 # --version arg (handled below)
 INFLUXDB_VERSION_FLAG_SET="0"
-INFLUXDB_OSS_VERSION="3.11.0"
-INFLUXDB_ENT_VERSION="3.11.0"
+INFLUXDB_OSS_VERSION="3.11.1"
+INFLUXDB_ENT_VERSION="3.11.1"
 
 EDITION="Core"
 EDITION_TAG="core"
```

---

### Incident Patch 4: `b915bd06` (2026-07-23)
**Commit Message**: chore(sync): influxdb_pro 2026-07-23 (3.11) (#27558)

**File**: `.circleci/config.yml` (modified, +1/-1)
```diff
@@ -467,7 +467,7 @@ jobs:
           command: |
             target-env cargo build --target=<< parameters.target >> --profile=<< parameters.profile >> --workspace
           # linking might take a while and doesn't produce CLI output
-          no_output_timeout: 30m
+          no_output_timeout: 60m
       - when:
           condition:
             or:
```

**File**: `.circleci/packages/influxdb3/fs/usr/share/influxdb3/influxdb3-core.conf` (modified, +35/-14)
```diff
@@ -36,6 +36,12 @@
 # Default: 0.0.0.0:8181 (env: INFLUXDB3_HTTP_BIND_ADDR)
 #http-bind="0.0.0.0:8181"
 
+# Maximum time to wait for active connections to drain during shutdown.
+# Remaining connections are forcibly closed when the timeout expires. Set to
+# 0s to close connections immediately.
+# Default: 30s (env: INFLUXDB3_SHUTDOWN_TIMEOUT)
+#shutdown-timeout="30s"
+
 # Logs: filter directive
 # Default: info,iox_query::query_log=warn,influxdb3_query_executor::core=warn
 # (env: LOG_FILTER)
@@ -84,8 +90,8 @@
 # =============================================================================
 
 # Size of the query log
-# Default: 1000 (env: INFLUXDB3_QUERY_LOG_SIZE)
-#query-log-size="1000"
+# Default: 1000 (env: INFLUXDB3_QUERY_LOG_MAX_ENTRIES)
+#query-log-max-entries="1000"
 
 # Maximum concurrent queries (env: INFLUXDB3_MAX_CONCURRENT_QUERIES)
 # Default: ~2^60 (effectively unlimited)
@@ -222,13 +228,28 @@
 # Default: discover (env: INFLUXDB3_PACKAGE_MANAGER)
 #package-manager="discover"
 
+# Disable all Processing Engine package management. When true, the server never
+# creates or modifies a virtual environment, never invokes pip, and the plugin
+# package-install API endpoints are rejected. Takes precedence over
+# package-manager. Manage the virtual environment yourself and point the server
+# at it via VIRTUAL_ENV.
+# Default: false (env: INFLUXDB3_DISABLE_PACKAGE_MANAGEMENT)
+#disable-package-management=false
+
 # URL of plugin repository (env: INFLUXDB3_PLUGIN_REPO)
 #plugin-repo="<URL>"
 
 # Restrict plugin triggers to the provided trigger type(s). Comma-separated
 # list of: wal, schedule, request (env: INFLUXDB3_RESTRICT_PLUGIN_TRIGGERS_TO)
 #restrict-plugin-triggers-to="<TYPES>"
 
+# Maximum number of concurrent invocations per asynchronous trigger
+# (run_asynchronous). Synchronous triggers always run one invocation at a time.
+# Must be greater than zero.
+# NOTE: The default will change from unlimited to 8 in a future release.
+# Default: unlimited (env: INFLUXDB3_ASYNC_TRIGGER_CONCURRENCY_LIMIT)
+#async-trigger-concurrency-limit=8
+
 # =============================================================================
 # Data Lifecycle & Retention
 # =============================================================================
@@ -259,12 +280,12 @@
 #wal-flush-interval="<INTERVAL>"
 
 # Size threshold for WAL snapshot creation
-# Default: 600 (env: INFLUXDB3_WAL_SNAPSHOT_SIZE)
-#wal-snapshot-size="<SIZE>"
+# Default: 600 (env: INFLUXDB3_WAL_FILES_PER_SNAPSHOT)
+#wal-files-per-snapshot="<SIZE>"
 
 # Maximum size of the WAL write buffer
-# Default: 100000 (env: INFLUXDB3_WAL_MAX_WRITE_BUFFER_SIZE)
-#wal-max-write-buffer-size="<SIZE>"
+# Default: 100000 (env: INFLUXDB3_WAL_MAX_BUFFERED_WRITES)
+#wal-max-buffered-writes="<SIZE>"
 
 # Concurrency limit for WAL replay operations
 # Default: max(num_cpus, 10) - dynamically determined (env: INFLUXDB3_WAL_REPLAY_CONCURRENCY_LIMIT)
@@ -314,16 +335,16 @@
 # =============================================================================
 
 # Memory pool size for query execution
-# Default: 20% (env: INFLUXDB3_EXEC_MEM_POOL_BYTES)
-#exec-mem-pool-bytes="20%"
+# Default: 20% (env: INFLUXDB3_EXEC_MEM_POOL_SIZE)
+#exec-mem-pool-size="20%"
 
 # Internal buffer threshold
 # Default: 50% (env: INFLUXDB3_FORCE_SNAPSHOT_MEM_THRESHOLD)
 #force-snapshot-mem-threshold="50%"
 
 # In-memory Parquet cache size
-# Default: 20% (env: INFLUXDB3_PARQUET_MEM_CACHE_SIZE)
-#parquet-mem-cache-size="20%"
+# Default: 20% (env: INFLUXDB3_FILE_CACHE_SIZE)
+#file-cache-size="20%"
 
 # Percentage to prune from cache
 # Default: 0.1 (env: INFLUXDB3_PARQUET_MEM_CACHE_PRUNE_PERCENTAGE)
@@ -334,12 +355,12 @@
 #parquet-mem-cache-prune-interval="1s"
 
 # Duration to check for query path caching
-# Default: 5h (env: INFLUXDB3_PARQUET_MEM_CACHE_QUERY_PATH_DURATION)
-#parquet-mem-cache-query-path-duration="5h"
+# Default: 5h (env: INFLUXDB3_FILE_CACHE_RECENCY)
+#file-cache-recency="5h"
 
 # Disable in-memory Parquet cache
-# (env: INFLUXDB3_DISABLE_PARQUET_MEM_CACHE)
-#disable-parquet-mem-cache="false"
+# (env: INFLUXDB3_DISABLE_FILE_CACHE)
+#disable-file-cache="false"
 
 # Maximum number of table indices to cache in memory
 # Set to 0 for unlimited cache size
```

**File**: `Cargo.lock` (modified, +280/-383)
```diff
@@ -160,9 +160,9 @@ dependencies = [
 
 [[package]]
 name = "anyhow"
-version = "1.0.102"
+version = "1.0.103"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
+checksum = "2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3"
 
 [[package]]
 name = "ar_archive_writer"
@@ -228,9 +228,9 @@ dependencies = [
 
 [[package]]
 name = "arrow-array"
-version = "57.3.0"
+version = "57.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4c8955af33b25f3b175ee10af580577280b4bd01f7e823d94c7cdef7cf8c9aef"
+checksum = "c8a4ab47b3f3eac60f7fd31b81e9028fda018607bcc63451aca4f2b755269862"
 dependencies = [
  "ahash 0.8.12",
  "arrow-buffer",
@@ -247,9 +247,9 @@ dependencies = [
 
 [[package]]
 name = "arrow-buffer"
-version = "57.3.0"
+version = "57.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c697ddca96183182f35b3a18e50b9110b11e916d7b7799cbfd4d34662f2c56c2"
+checksum = "0d18b89b4c4f4811d0858175e79541fe98e33e18db3b011708bc287b1240593f"
 dependencies = [
  "bytes",
  "half",
@@ -259,9 +259,9 @@ dependencies = [
 
 [[package]]
 name = "arrow-cast"
-version = "57.3.0"
+version = "57.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "646bbb821e86fd57189c10b4fcdaa941deaf4181924917b0daa92735baa6ada5"
+checksum = "722b5c41dd1d14d0a879a1bce92c6fe33f546101bb2acce57a209825edd075b3"
 dependencies = [
  "arrow-array",
  "arrow-buffer",
@@ -296,9 +296,9 @@ dependencies = [
 
 [[package]]
 name = "arrow-data"
-version = "57.3.0"
+version = "57.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1fdd994a9d28e6365aa78e15da3f3950c0fdcea6b963a12fa1c391afb637b304"
+checksum = "c1683705c63dcf0d18972759eda48489028cbbff67af7d6bef2c6b7b74ab778a"
 dependencies = [
  "arrow-buffer",
  "arrow-schema",
@@ -329,17 +329,17 @@ dependencies = [
  "futures",
  "once_cell",
  "paste",
- "prost 0.14.3",
- "prost-types 0.14.3",
- "tonic 0.14.5",
+ "prost 0.14.4",
+ "prost-types 0.14.4",
+ "tonic 0.14.6",
  "tonic-prost",
 ]
 
 [[package]]
 name = "arrow-ipc"
-version = "57.3.0"
+version = "57.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "abf7df950701ab528bf7c0cf7eeadc0445d03ef5d6ffc151eaae6b38a58feff1"
+checksum = "8cf72d04c07229fbf4dbebe7145cac37d7cf7ec582fe705c6b92cb314af096ab"
 dependencies = [
  "arrow-array",
  "arrow-buffer",
@@ -377,9 +377,9 @@ dependencies = [
 
 [[package]]
 name = "arrow-ord"
-version = "57.3.0"
+version = "57.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f7d8f1870e03d4cbed632959498bcc84083b5a24bded52905ae1695bd29da45b"
+checksum = "082342947d4e5a2bcccf029a0a0397e21cb3bb8421edd9571d34fb5dd2670256"
 dependencies = [
  "arrow-array",
  "arrow-buffer",
@@ -403,19 +403,19 @@ dependencies = [
 
 [[package]]
 name = "arrow-schema"
-version = "57.3.0"
+version = "57.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8c872d36b7bf2a6a6a2b40de9156265f0242910791db366a2c17476ba8330d68"
+checksum = "e4cf0d4a6609679e03002167a61074a21d7b1ad9ea65e462b2c0a97f8a3b2bc6"
 dependencies = [
  "serde_core",
  "serde_json",
 ]
 
 [[package]]
 name = "arrow-select"
-version = "57.3.0"
+version = "57.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "68bf3e3efbd1278f770d67e5dc410257300b161b93baedb3aae836144edcaf4b"
+checksum = "0b320d86a9806923663bb0fd9baa65ecaba81cb0cd77ff8c1768b9716b4ef891"
 dependencies = [
  "ahash 0.8.12",
  "arrow-array",
@@ -477,9 +477,9 @@ dependencies = [
 
 [[package]]
 name = "assert_cmd"
-version = "2.2.1"
+version = "2.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "39bae1d3fa576f7c6519514180a72559268dd7d1fe104070956cb687bc6673bd"
+checksum = "2aa3a22042e45de04255c7bf3626e239f450200fd0493c1e382263544b20aea6"
 dependencies = [
  "anstyle",
  "bstr",
@@ -548,7 +548,7 @@ dependencies = [
  "backoff",
  "base64 0.22.1",
  "generated_types",
- "http 1.4.0",
+ "http 1.4.2",
  "iox_time",
  "metric",
  "parking_lot",
@@ -602,8 +602,8 @@ dependencies = [
  "axum-core 0.5.6",
  "bytes",
  "futures-util",
- "http 1.4.0",
- "http-body 1.0.1",
+ "http 1.4.2",
+ "http-body 1.1.0",
  "http-body-util",
  "itoa",
  "matchit 0.8.4",
@@ -643,8 +643,8 @@ checksum = "08c78f31d7b1291f7ee735c1c6780ccde7785daae9a9206026862dab7d8792d1"
 dependencies = [
  "bytes",
  "futures-core",
- "http 1.4.0",
- "http-body 1.0.1",
+ "http 1.4.2",
+ "http-body 1.1.0",
  "http-body-util",
  "mime",
  "pin-project-lite",
@@ -802,9 +802,9 @@ dependencies = [
 
 [[package]]
 name = "bitvec"
-version = "1.0.1"
+version = "1.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1bc2832c24239b0141d5674bb9174f9d68a8b5b3f2753311927c172ca46f7e9c"
+checksum = "ddcec3d12c579d40898fe0a9a358a803c23e9c52ca3c425707f81c9436211837"
 dependenc
```

**File**: `Cargo.toml` (modified, +6/-2)
```diff
@@ -209,7 +209,7 @@ prost = "0.14"
 prost-build = "0.14"
 prost-types = "0.14"
 proptest = { version = "1", default-features = false, features = ["std"] }
-pyo3 = { version = "0.28", features = ["experimental-async"]}
+pyo3 = { version = "0.29", features = ["experimental-async"]}
 rand = "0.8.5"
 rcgen = "0.13.2"
 regex = "1.11.1"
@@ -231,7 +231,7 @@ snap = "1.0.0"
 sqlparser = "0.48.0"
 # NOTE(tjh): explicitly add sqlite feature as the `data_types` crate relies on it
 sqlx = { version = "0.8.6", features = ["sqlite"] }
-sysinfo = "0.39.5"
+sysinfo = { version = "0.39.5", default-features = false, features = ["system", "disk"] }
 tempfile = "3.14.0"
 test-log = { version = "0.2.16", features = ["trace"] }
 thiserror = "1.0"
@@ -326,6 +326,10 @@ opt-level = 3
 [profile.dev.package.similar]
 opt-level = 3
 
+[profile.check-fast]
+inherits = "dev"
+debug = false
+
 # Patching Datafusion
 [patch.crates-io]
 # Use DataFusion fork
```

**File**: `README_processing_engine.md` (modified, +39/-0)
```diff
@@ -185,6 +185,45 @@ $ /here/influxdb3 install package bar                            # client
 $ /here/influxdb3 test schedule_plugin -d foo testme.py          # client
 ```
 
+### Disabling package management
+
+The examples above rely on the server to manage the Processing Engine's Python
+environment: it creates `<plugin-dir>/.venv` (or `--virtual-env-location`) with
+`python -m venv`, activates it for the server process (setting `VIRTUAL_ENV`,
+`PATH`, etc.), initializes embedded Python so `sys.path` includes the venv's
+site-packages, and services `influxdb3 install package ...` by running
+`python -m pip install ...`.
+
+With `--disable-package-management` (or
+`INFLUXDB3_DISABLE_PACKAGE_MANAGEMENT=true`), all of that becomes your
+responsibility: the server never creates, activates or otherwise touches a
+virtual environment and `influxdb3 install package ...` is rejected. Create the
+venv and export `VIRTUAL_ENV` before starting the server:
+
+```sh
+# create the venv with the bundled python and point VIRTUAL_ENV at it
+$ /here/python/bin/python3 -m venv /path/to/plugins/.venv
+$ export VIRTUAL_ENV=/path/to/plugins/.venv
+
+# start the server; VIRTUAL_ENV must be set in its environment
+$ /here/influxdb3 serve --plugin-dir /path/to/plugins --disable-package-management
+
+# install packages externally; no restart needed and 'influxdb3 install package' is rejected
+$ /path/to/plugins/.venv/bin/python -m pip install -r /path/to/requirements.txt
+... <plugins can now 'import' whatever is in /path/to/plugins/.venv> ...
+```
+
+Notes:
+
+ * Create the venv with the `python3` bundled with `influxdb3` (as above), not
+   the system python, so the venv's Python version matches the embedded
+   interpreter.
+ * `VIRTUAL_ENV` must be exported in the server's environment before
+   `influxdb3 serve` starts; `--virtual-env-location` is not consulted when
+   package management is disabled.
+ * Packages can be installed into the venv while the server is running; no
+   restart is required.
+
 ### Local development with python-build-standalone
 
 Local development with python-build-standalone currently consists of:
```

**File**: `core/generated_types/src/lib.rs` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@
     clippy::use_self,
     clippy::allow_attributes,
     clippy::uninlined_format_args,
+    clippy::useless_borrows_in_formatting,
     // I can't figure out what rustdoc lint triggers in this. It's not any of the individual ones,
     // only rustdoc::all fixes it afaict
     rustdoc::all,
```

**File**: `core/influxdb2_client/src/api/label.rs` (modified, +2/-2)
```diff
@@ -97,7 +97,7 @@ impl Client {
         properties: Option<HashMap<String, String>>,
         label_id: &str,
     ) -> Result<LabelResponse, RequestError> {
-        let update_label_url = format!("{}/api/v2/labels/{}", &self.url, label_id);
+        let update_label_url = format!("{}/api/v2/labels/{label_id}", self.url);
         let body = LabelUpdate { name, properties };
         let response = self
             .request(Method::PATCH, &update_label_url)
@@ -120,7 +120,7 @@ impl Client {
 
     /// Delete a Label
     pub async fn delete_label(&self, label_id: &str) -> Result<(), RequestError> {
-        let delete_label_url = format!("{}/api/v2/labels/{}", &self.url, label_id);
+        let delete_label_url = format!("{}/api/v2/labels/{label_id}", self.url);
         let response = self
             .request(Method::DELETE, &delete_label_url)
             .send()
```

**File**: `core/influxdb_line_protocol/src/lib.rs` (modified, +1/-1)
```diff
@@ -2342,7 +2342,7 @@ her"#,
         assert_eq!(vals.len(), 2);
         assert!(vals[0].is_err());
         assert_eq!(
-            format!("{:?}", &vals[0]),
+            format!("{:?}", vals[0]),
             "Err(CannotParseEntireLine { trailing_content: \".22,jkl=4\" })"
         );
 
```

---

### Incident Patch 5: `15130156` (2026-07-15)
**Commit Message**: chore(sync): influxdb_pro 2026-07-15 (#27541)

Source: b04220b8393522dc08944578d513c5a4a0e7c2cc

Commits:
- `b04220b839` feat(parquet compactor): Surface compaction plans skipped by the file limit (influxdata/influxdb_pro#4455)
- `ddedf9409a` chore: fix cargo deny `spin` (influxdata/influxdb_pro#4545)
- `22b9a416b3` chore: improve error message when a write fails due to limits (influxdata/influxdb_pro#4265)
- `35aa94cb20` feat(pt-disk-cache): add DiskSize config type (influxdata/influxdb_pro#4483)
- `dd241ae5ab` feat(catalog): add ParquetFileFlagForDeleteByRetentionPartitionBatch rpc (influxdata/influxdb_pro#4446)
- `2886db134c` chore: add `system` permissions to users (influxdata/influxdb_pro#4366)
- `0327df5884` feat(compactor): bound compacted-data load concurrency (influxdata/influxdb_pro#4413)
- `9624138d70` chore: update crossbeam-epoch for RUSTSEC-2026-0204 (influxdata/influxdb_pro#4404)
- `1d7695bf71` refactor: fix single node test compilation, remove maybe_arc_str shims (influxdata/influxdb_pro#4397)
- `4d789f56fe` chore: fix recursion overflow on macos clippy (influxdata/influxdb_pro#4399)
- `39abb09ed3` chore(distributed-queries): centralize http validation logic in one 

**File**: `.circleci/packages/influxdb3/fs/usr/lib/influxdb3/influxdb3-launcher` (modified, +4/-8)
```diff
@@ -70,7 +70,6 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
         # Google Cloud (GOOGLE_ prefix, not INFLUXDB3_)
         "google-service-account": "GOOGLE_SERVICE_ACCOUNT",
         # Object store
-        "object-store-cache-endpoint": "INFLUXDB3_OBJECT_STORE_CACHE_ENDPOINT",
         "object-store-connection-limit": "INFLUXDB3_OBJECT_STORE_CONNECTION_LIMIT",
         "object-store-http2-only": "INFLUXDB3_OBJECT_STORE_HTTP2_ONLY",
         "object-store-http2-max-frame-size": "INFLUXDB3_OBJECT_STORE_HTTP2_MAX_FRAME_SIZE",
@@ -83,10 +82,10 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
         "virtual-env-location": "VIRTUAL_ENV",
         # WAL
         "snapshotted-wal-files-to-keep": "INFLUXDB3_NUM_WAL_FILES_TO_KEEP",
-        # Tokio console (TOKIO_CONSOLE_ prefix, not INFLUXDB3_)
-        "tokio-console-enabled": "TOKIO_CONSOLE_ENABLED",
-        "tokio-console-client-buffer-capacity": "TOKIO_CONSOLE_CLIENT_BUFFER_CAPACITY",
-        "tokio-console-event-buffer-capacity": "TOKIO_CONSOLE_EVENT_BUFFER_CAPACITY",
+        # Tokio console
+        "tokio-console-enabled": "INFLUXDB3_TOKIO_CONSOLE_ENABLED",
+        "tokio-console-client-buffer-capacity": "INFLUXDB3_TOKIO_CONSOLE_CLIENT_BUFFER_CAPACITY",
+        "tokio-console-event-buffer-capacity": "INFLUXDB3_TOKIO_CONSOLE_EVENT_BUFFER_CAPACITY",
         # Tracing
         "traces-exporter": "INFLUXDB3_TRACES_EXPORTER",
         "traces-exporter-jaeger-agent-host": "INFLUXDB3_TRACES_EXPORTER_JAEGER_AGENT_HOST",
@@ -114,7 +113,6 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
         "compaction-max-num-files-per-plan": "INFLUXDB3_ENTERPRISE_COMPACTION_MAX_NUM_FILES_PER_PLAN",
         "compaction-multipliers": "INFLUXDB3_ENTERPRISE_COMPACTION_MULTIPLIERS",
         "compaction-row-limit": "INFLUXDB3_ENTERPRISE_COMPACTION_ROW_LIMIT",
-        "max-compact-destination": "INFLUXDB3_ENTERPRISE_MAX_COMPACT_DESTINATION",
         # Last Value & Distinct Value Caches
         "preemptive-cache-age": "INFLUXDB3_ENTERPRISE_PREEMPTIVE_CACHE_AGE",
         # Licensing
@@ -123,13 +121,11 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
         "license-type": "INFLUXDB3_ENTERPRISE_LICENSE_TYPE",
         # Resource limits
         "catalog-sync-interval": "INFLUXDB3_ENTERPRISE_CATALOG_SYNC_INTERVAL",
-        "database-split-level": "INFLUXDB3_ENTERPRISE_DATABASE_SPLIT_LEVEL",
         "max-columns": "INFLUXDB3_ENTERPRISE_PACHA_TREE_MAX_COLUMNS",
         "num-database-limit": "INFLUXDB3_ENTERPRISE_NUM_DATABASE_LIMIT",
         "num-table-limit": "INFLUXDB3_ENTERPRISE_NUM_TABLE_LIMIT",
         "num-total-columns-per-table-limit": "INFLUXDB3_ENTERPRISE_NUM_TOTAL_COLUMNS_PER_TABLE_LIMIT",
         "replication-interval": "INFLUXDB3_ENTERPRISE_REPLICATION_INTERVAL",
-        "table-split-level": "INFLUXDB3_ENTERPRISE_TABLE_SPLIT_LEVEL",
     },
 }
 
```

**File**: `.circleci/packages/influxdb3/fs/usr/share/influxdb3/influxdb3-core.conf` (modified, +3/-11)
```diff
@@ -196,9 +196,6 @@
 # Default: 180s (env: OBJECT_STORE_RETRY_TIMEOUT)
 #object-store-retry-timeout="<TIMEOUT>"
 
-# S3 compatible cache endpoint (env: OBJECT_STORE_CACHE_ENDPOINT)
-#object-store-cache-endpoint="<ENDPOINT>"
-
 # Skip TLS certificate verification for object storage (env: OBJECT_STORE_TLS_ALLOW_INSECURE)
 #object-store-tls-allow-insecure="false"
 
@@ -253,11 +250,6 @@
 # Default: 30m (env: INFLUXDB3_RETENTION_CHECK_INTERVAL)
 #retention-check-interval="30m"
 
-# The default duration from when a database or table is soft-deleted until the
-# data is scheduled to be hard deleted
-# Default: 72h (env: INFLUXDB3_HARD_DELETE_DEFAULT_DURATION)
-#hard-delete-default-duration="72h"
-
 # =============================================================================
 # Write-Ahead Log (WAL)
 # =============================================================================
@@ -493,15 +485,15 @@
 
 # Enable tokio console for runtime debugging
 # This comes with a certain runtime overhead
-# Default: false (env: TOKIO_CONSOLE_ENABLED)
+# Default: false (env: INFLUXDB3_TOKIO_CONSOLE_ENABLED)
 #tokio-console-enabled="false"
 
 # Maximum capacity for the channel of events sent from subscriber layers to the
 # aggregator task. When this channel is at capacity, additional events will be
-# dropped. (env: TOKIO_CONSOLE_EVENT_BUFFER_CAPACITY)
+# dropped. (env: INFLUXDB3_TOKIO_CONSOLE_EVENT_BUFFER_CAPACITY)
 #tokio-console-event-buffer-capacity="<SIZE>"
 
 # Maximum capacity of updates to buffer for each subscribed client, if that
 # client is not reading from the RPC stream. When this channel is at capacity,
-# the client may be disconnected. (env: TOKIO_CONSOLE_CLIENT_BUFFER_CAPACITY)
+# the client may be disconnected. (env: INFLUXDB3_TOKIO_CONSOLE_CLIENT_BUFFER_CAPACITY)
 #tokio-console-client-buffer-capacity="<SIZE>"
```

**File**: `Cargo.lock` (modified, +187/-213)
```diff
@@ -444,7 +444,7 @@ dependencies = [
 
 [[package]]
 name = "arrow_util"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "ahash 0.8.12",
  "arrow",
@@ -541,7 +541,7 @@ checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"
 
 [[package]]
 name = "authz"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "assert_matches",
  "async-trait",
@@ -655,7 +655,7 @@ dependencies = [
 
 [[package]]
 name = "backoff"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "rand 0.9.4",
  "snafu 0.9.0",
@@ -686,7 +686,7 @@ dependencies = [
  "miniz_oxide",
  "object",
  "rustc-demangle",
- "windows-link 0.2.1",
+ "windows-link",
 ]
 
 [[package]]
@@ -1078,7 +1078,7 @@ checksum = "37b2a672a2cb129a2e41c10b1224bb368f9f37a2b16b612598138befd7b37eb5"
 
 [[package]]
 name = "catalog_cache"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "bytes",
  "criterion 0.8.2",
@@ -1140,7 +1140,7 @@ dependencies = [
  "num-traits",
  "serde",
  "wasm-bindgen",
- "windows-link 0.2.1",
+ "windows-link",
 ]
 
 [[package]]
@@ -1222,14 +1222,14 @@ checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
 
 [[package]]
 name = "cli_types"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "tokio",
 ]
 
 [[package]]
 name = "client_util"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "http 1.4.0",
  "iox_http_util",
@@ -1691,9 +1691,9 @@ dependencies = [
 
 [[package]]
 name = "crossbeam-epoch"
-version = "0.9.18"
+version = "0.9.20"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5b82ac4a3c2ca9c3460964f020e1402edd5753411d7737aa39c3714ad1b5420e"
+checksum = "2d6914041f254d6e9176c01941b21115dcfb7089e55135a35411081bd106ef3f"
 dependencies = [
  "crossbeam-utils",
 ]
@@ -1832,7 +1832,7 @@ dependencies = [
 
 [[package]]
 name = "data_types"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "arrow",
  "arrow-buffer",
@@ -2566,7 +2566,7 @@ dependencies = [
 
 [[package]]
 name = "datafusion_util"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "assert_matches",
  "async-trait",
@@ -2648,6 +2648,16 @@ dependencies = [
  "crypto-common 0.2.1",
 ]
 
+[[package]]
+name = "dispatch2"
+version = "0.3.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1e0e367e4e7da84520dedcac1901e4da967309406d1e51017ae1abfb97adbd38"
+dependencies = [
+ "bitflags 2.11.1",
+ "objc2",
+]
+
 [[package]]
 name = "displaydoc"
 version = "0.2.5"
@@ -2661,7 +2671,7 @@ dependencies = [
 
 [[package]]
 name = "dml"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "arrow_util",
  "data_types",
@@ -2773,7 +2783,7 @@ dependencies = [
 
 [[package]]
 name = "error_reporting"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "datafusion",
  "snafu 0.9.0",
@@ -2803,7 +2813,7 @@ dependencies = [
 
 [[package]]
 name = "executor"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "futures",
  "metric",
@@ -2884,7 +2894,7 @@ dependencies = [
 
 [[package]]
 name = "flightsql"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "arrow",
  "arrow-flight",
@@ -3091,7 +3101,7 @@ dependencies = [
 
 [[package]]
 name = "futures_test_utils"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "clap",
  "futures",
@@ -3102,7 +3112,7 @@ dependencies = [
 
 [[package]]
 name = "generated_types"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "bytes",
  "pbjson",
@@ -3372,7 +3382,7 @@ checksum = "617aaa3557aef3810a6369d0a99fac8a080891b68bd9f9812a1eeda0c0730cbd"
 dependencies = [
  "cfg-if",
  "libc",
- "windows-link 0.2.1",
+ "windows-link",
 ]
 
 [[package]]
@@ -3590,7 +3600,7 @@ dependencies = [
  "js-sys",
  "log",
  "wasm-bindgen",
- "windows-core 0.62.2",
+ "windows-core",
 ]
 
 [[package]]
@@ -3756,7 +3766,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb2_client"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "bytes",
  "futures",
@@ -3775,7 +3785,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "anyhow",
  "arrow",
@@ -3807,6 +3817,7 @@ dependencies = [
  "influxdb3_commands",
  "influxdb3_process",
  "influxdb3_processing_engine",
+ "influxdb3_processing_engine_telemetry",
  "influxdb3_query_executor",
  "influxdb3_server",
  "influxdb3_shutdown",
@@ -3859,6 +3870,7 @@ dependencies = [
  "trace",
  "trace_exporters",
  "trace_http",
+ "tracing-subscriber",
  "trogging",
  "url",
  "uuid",
@@ -3867,7 +3879,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_authz"
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 dependencies = [
  "async-trait",
  "authz",
@@ -3885,7 +3897,7 @@ dependencies = [
 
 [[package
```

**File**: `Cargo.toml` (modified, +4/-4)
```diff
@@ -13,6 +13,7 @@ members = [
     "influxdb3_load_generator",
     "influxdb3_process",
     "influxdb3_processing_engine",
+    "influxdb3_processing_engine_telemetry",
     "influxdb3_py_api",
     "influxdb3_query_executor",
     "influxdb3_server",
@@ -127,7 +128,7 @@ exclude = [
 #
 # For porting to the actual OSS repo (influxdb), this would need to change to `-nightly`, i.e., by
 # stripping the `-oss`.
-version = "3.10.0-nightly"
+version = "3.11.0-nightly"
 authors = ["InfluxData OSS Developers"]
 edition = "2024"
 license = "MIT OR Apache-2.0"
@@ -230,12 +231,11 @@ snap = "1.0.0"
 sqlparser = "0.48.0"
 # NOTE(tjh): explicitly add sqlite feature as the `data_types` crate relies on it
 sqlx = { version = "0.8.6", features = ["sqlite"] }
-# Delaying upgrade until <https://github.com/GuillaumeGomez/sysinfo/issues/1496> is fixed
-sysinfo = "<0.38"
+sysinfo = "0.39.5"
 tempfile = "3.14.0"
 test-log = { version = "0.2.16", features = ["trace"] }
 thiserror = "1.0"
-tokio = { version = "1.52.2", features = ["full"] }
+tokio = { version = "1.52.2", features = ["full", "test-util"] }
 tokio-rustls = { version = "0.25", default-features = false, features = ["ring", "tls12"] }
 tokio-util = { version = "0.7.13", features = ["rt"] }
 tonic = { version = "0.14", features = ["tls-native-roots"] }
```

**File**: `core/generated_types/protos/influxdata/iox/catalog/v2/service.proto` (modified, +10/-0)
```diff
@@ -92,6 +92,7 @@ service CatalogService {
   rpc PartitionRetentionInvalidateByNamespaceId(PartitionRetentionInvalidateByNamespaceIdRequest) returns (PartitionRetentionInvalidateByNamespaceIdResponse);
 
   rpc ParquetFileFlagForDeleteByRetention(ParquetFileFlagForDeleteByRetentionRequest) returns (stream ParquetFileFlagForDeleteByRetentionResponse);
+  rpc ParquetFileFlagForDeleteByRetentionPartitionBatch(ParquetFileFlagForDeleteByRetentionPartitionBatchRequest) returns (stream ParquetFileFlagForDeleteByRetentionPartitionBatchResponse);
   rpc ParquetFileDeleteOldIdsOnly(ParquetFileDeleteOldIdsOnlyRequest) returns (stream ParquetFileDeleteOldIdsOnlyResponse);
   rpc ParquetFileDeleteOldIdsCount(ParquetFileDeleteOldIdsCountRequest) returns (ParquetFileDeleteOldIdsCountResponse);
   rpc ParquetFileListByPartitionNotToDeleteBatch(ParquetFileListByPartitionNotToDeleteBatchRequest) returns (stream ParquetFileListByPartitionNotToDeleteBatchResponse);
@@ -667,6 +668,15 @@ message ParquetFileFlagForDeleteByRetentionResponse {
   int64 partition_id = 2;
 }
 
+message ParquetFileFlagForDeleteByRetentionPartitionBatchRequest {
+  repeated int64 partition_ids = 1;
+}
+
+message ParquetFileFlagForDeleteByRetentionPartitionBatchResponse {
+  ObjectStoreId object_store_id = 1;
+  int64 partition_id = 2;
+}
+
 message ParquetFileDeleteOldIdsOnlyRequest {
   reserved "cutoff";
   reserved 2;
```

**File**: `core/influxdb_iox_client/src/client/flight/mod.rs` (modified, +5/-0)
```diff
@@ -222,6 +222,11 @@ impl Client {
         self.inner
     }
 
+    /// Get a mutable reference to the inner arrow flight client
+    pub fn inner(&mut self) -> &mut FlightClient {
+        &mut self.inner
+    }
+
     /// Return a reference to gRPC metadata included with each request
     pub fn metadata(&self) -> &MetadataMap {
         self.inner.metadata()
```

**File**: `core/influxdb_line_protocol/src/lib.rs` (modified, +10/-0)
```diff
@@ -98,6 +98,7 @@ use std::{
     fmt,
     hash::{Hash, Hasher},
     ops::Deref,
+    sync::Arc,
 };
 
 /// Maximum byte length for string components in line protocol
@@ -564,6 +565,15 @@ impl PartialEq<String> for EscapedStr<'_> {
     }
 }
 
+impl From<EscapedStr<'_>> for Arc<str> {
+    fn from(value: EscapedStr<'_>) -> Self {
+        match value {
+            EscapedStr::CopiedValue(s) => Self::from(s),
+            EscapedStr::SingleSlice(s) => Self::from(s),
+        }
+    }
+}
+
 /// Parses a new line-delimited string into an iterator of
 /// [`ParsedLine`]. See the [crate-level documentation](self) for more
 /// information and examples.
```

**File**: `core/iox_query_influxql/src/plan/planner.rs` (modified, +33/-3)
```diff
@@ -574,8 +574,10 @@ impl<'a> Context<'a> {
         self.fill
     }
 
-    /// Apply a projection to the input plan to ensure
-    /// that the time column is in the correct timezone.
+    /// Apply a projection to the input plan to ensure that the time column is
+    /// in the correct timezone. Skips the wrap when it would be equivalent
+    /// (no instant shift), preserving parquet pruning on `time`. See
+    /// <https://github.com/influxdata/EAR/issues/6957>.
     fn project_timezone(&self, builder: LogicalPlanBuilder) -> Result<LogicalPlanBuilder> {
         let Some(otz) = &self.tz else {
             return Ok(builder);
@@ -588,7 +590,7 @@ impl<'a> Context<'a> {
             .map(
                 |column| match schema.field_from_column(&column).unwrap().data_type() {
                     DataType::Timestamp(_, itz) => {
-                        if itz.as_ref().is_some_and(|itz| itz == otz) {
+                        if tz_is_equivalent(itz.as_deref(), otz) {
                             Expr::Column(column)
                         } else {
                             let name = column.name().to_string();
@@ -622,6 +624,16 @@ impl<'a> Context<'a> {
     }
 }
 
+/// Whether `tz(col, otz)` would be the identity on instants for a column whose
+/// stored timezone is `itz`. The UDF retags timezone metadata only, and treats
+/// a `None` storage tz as UTC.
+fn tz_is_equivalent(itz: Option<&str>, otz: &str) -> bool {
+    match itz {
+        Some(itz) => itz == otz,
+        None => otz.eq_ignore_ascii_case("UTC"),
+    }
+}
+
 /// This struct specifies how to handle non-existent columns when querying
 /// with the `FILL(Number)` clause. The gap-filling value is used to fill
 /// in the missing columns.
@@ -4671,6 +4683,24 @@ mod tests {
         }
     }
 
+    #[test]
+    fn test_tz_is_equivalent() {
+        // EAR #6957: storage tz unset, target UTC.
+        assert!(tz_is_equivalent(None, "UTC"));
+
+        // Identical zones (canonical names from `chrono_tz::Tz::name()`).
+        assert!(tz_is_equivalent(Some("UTC"), "UTC"));
+        assert!(tz_is_equivalent(
+            Some("America/Los_Angeles"),
+            "America/Los_Angeles"
+        ));
+
+        // Different zones: not equivalent — the projection's display zone changes.
+        assert!(!tz_is_equivalent(Some("America/Los_Angeles"), "UTC"));
+        assert!(!tz_is_equivalent(Some("UTC"), "America/Los_Angeles"));
+        assert!(!tz_is_equivalent(None, "America/Los_Angeles"));
+    }
+
     #[test]
     fn test_find_var_refs() {
         use influxdb_influxql_parser::expression::VarRefDataType::*;
```

---

### Incident Patch 6: `1f683340` (2026-06-17)
**Commit Message**: chore(sync): influxdb_pro 2026-06-17 (#27507)

Source: 20423f17dc8f6123bfc8badc4609cd03949b4b94

Commits:
- `892cd06aa0` chore(cargo-audit): ignore RUSTSEC-2026-0182 wasmtime advisory (influxdata/influxdb_pro#4138)
- `929fda0084` fix(py): update to 3.13.14-20260610 for latest security fixes (influxdata/influxdb_pro#4134)
- `376424a7c8` fix(cli): remove dead serve --tls-ca; make cancel row-delete TLS-capable; add missing INFLUXDB3_TLS_CA env bindings (influxdata/influxdb_pro#4062)
- `5dfe632abf` feat(write): `influxdb3 write` streams large inputs in chunks and in parallel (influxdata/influxdb_pro#3724)
- `582c258766` fix(tracing): honor --tokio-console-enabled and bound console retention (influxdata/influxdb_pro#4053)
- `5da8d10a99` Revert "fix(pacha-tree): bound compaction consumer preload by cache budget (influxdata/influxdb_pro#4054)" (influxdata/influxdb_pro#4094)
- `ac65b4b5f1` fix(pacha-tree): bound compaction consumer preload by cache budget (influxdata/influxdb_pro#4054)
- `32c95b200f` chore(deny): ignore RUSTSEC-2026-0176 (pyo3 nth/nth_back OOB read, tracked in influxdata/influxdb_pro#4072) (influxdata/influxdb_pro#4073)
- `713e85d147` feat(distributed-queries): add `influx

**File**: `.circleci/config.yml` (modified, +2/-2)
```diff
@@ -146,10 +146,10 @@ parameters:
   # Consistent environment setup for Python Build Standalone
   PBS_DATE:
     type: string
-    default: "20260602"
+    default: "20260610"
   PBS_VERSION:
     type: string
-    default: "3.13.13"
+    default: "3.13.14"
 
 # Consistent Cargo environment configuration
 cargo_env: &cargo_env
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4038,6 +4038,7 @@ name = "influxdb3_commands"
 version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
+ "bytes",
  "chrono",
  "clap",
  "comfy-table",
```

**File**: `core/iox_query/src/frontend/reorg.rs` (modified, +8/-8)
```diff
@@ -436,11 +436,11 @@ mod test {
         - " ProgressiveEvalExec: input_ranges=[(AL,50)->(MT,7000), (UT,28000)->(WA,220000)]"
         - "   UnionExec"
         - "     SortExec: expr=[tag1@2 ASC, time@3 ASC], preserve_partitioning=[false]"
-        - "       RecordBatchesExec: chunks=1, projection=[field_int, field_int2, tag1, time]"
+        - "       RecordBatchesExec: chunks=1 [Test=1], projection=[field_int, field_int2, tag1, time]"
         - "     ProjectionExec: expr=[field_int@0 as field_int, field_int2@1 as field_int2, tag1@2 as tag1, time@3 as time]"
         - "       DeduplicateExec: [tag1@2 ASC,time@3 ASC]"
         - "         SortExec: expr=[tag1@2 ASC, time@3 ASC, __chunk_order@4 ASC], preserve_partitioning=[false]"
-        - "           RecordBatchesExec: chunks=1, projection=[field_int, field_int2, tag1, time, __chunk_order]"
+        - "           RecordBatchesExec: chunks=1 [Test=1], projection=[field_int, field_int2, tag1, time, __chunk_order]"
         "#
         );
 
@@ -511,12 +511,12 @@ mod test {
         - "   ReorderPartitionsExec: mapped_partition_indices=[1, 0]"
         - "     UnionExec"
         - "       SortExec: expr=[tag1@2 DESC, time@3 ASC NULLS LAST], preserve_partitioning=[false]"
-        - "         RecordBatchesExec: chunks=1, projection=[field_int, field_int2, tag1, time]"
+        - "         RecordBatchesExec: chunks=1 [Test=1], projection=[field_int, field_int2, tag1, time]"
         - "       SortExec: expr=[tag1@2 DESC, time@3 ASC NULLS LAST], preserve_partitioning=[false]"
         - "         ProjectionExec: expr=[field_int@0 as field_int, field_int2@1 as field_int2, tag1@2 as tag1, time@3 as time]"
         - "           DeduplicateExec: [tag1@2 ASC,time@3 ASC]"
         - "             SortExec: expr=[tag1@2 ASC, time@3 ASC, __chunk_order@4 ASC], preserve_partitioning=[false]"
-        - "               RecordBatchesExec: chunks=1, projection=[field_int, field_int2, tag1, time, __chunk_order]"
+        - "               RecordBatchesExec: chunks=1 [Test=1], projection=[field_int, field_int2, tag1, time, __chunk_order]"
         "#
         );
 
@@ -589,12 +589,12 @@ mod test {
         - "   ProgressiveEvalExec: input_ranges=[(50,AL)->(7000,MT), (28000,UT)->(220000,WA)]"
         - "     UnionExec"
         - "       SortExec: expr=[time@3 ASC NULLS LAST, tag1@2 ASC], preserve_partitioning=[false]"
-        - "         RecordBatchesExec: chunks=1, projection=[field_int, field_int2, tag1, time]"
+        - "         RecordBatchesExec: chunks=1 [Test=1], projection=[field_int, field_int2, tag1, time]"
         - "       SortExec: expr=[time@3 ASC NULLS LAST, tag1@2 ASC], preserve_partitioning=[false]"
         - "         ProjectionExec: expr=[field_int@0 as field_int, field_int2@1 as field_int2, tag1@2 as tag1, time@3 as time]"
         - "           DeduplicateExec: [tag1@2 ASC,time@3 ASC]"
         - "             SortExec: expr=[tag1@2 ASC, time@3 ASC, __chunk_order@4 ASC], preserve_partitioning=[false]"
-        - "               RecordBatchesExec: chunks=1, projection=[field_int, field_int2, tag1, time, __chunk_order]"
+        - "               RecordBatchesExec: chunks=1 [Test=1], projection=[field_int, field_int2, tag1, time, __chunk_order]"
         "#
         );
 
@@ -679,12 +679,12 @@ mod test {
         - "   ProgressiveEvalExec: input_ranges=[(50,AL)->(7000,MT), (28000,UT)->(220000,WA)]"
         - "     UnionExec"
         - "       SortExec: expr=[time@3 ASC NULLS LAST, tag1@2 ASC], preserve_partitioning=[false]"
-        - "         RecordBatchesExec: chunks=1, projection=[field_int, field_int2, tag1, time]"
+        - "         RecordBatchesExec: chunks=1 [Test=1], projection=[field_int, field_int2, tag1, time]"
         - "       SortExec: expr=[time@3 ASC NULLS LAST, tag1@2 ASC], preserve_partitioning=[false]"
         - "         ProjectionExec: expr=[field_int@0 as field_int, field_int2@1 as field_int2, tag1@2 as tag1, time@3 as time]"
         - "           DeduplicateExec: [tag1@2 ASC,time@3 ASC]"
         - "             SortExec: expr=[tag1@2 ASC, time@3 ASC, __chunk_order@4 ASC], preserve_partitioning=[false]"
-        - "               RecordBatchesExec: chunks=1, projection=[field_int, field_int2, tag1, time, __chunk_order]"
+        - "               RecordBatchesExec: chunks=1 [Test=1], projection=[field_int, field_int2, tag1, time, __chunk_order]"
         "#
         );
 
```

**File**: `core/iox_query/src/physical_optimizer/dedup/split.rs` (modified, +22/-22)
```diff
@@ -260,12 +260,12 @@ mod tests {
         input:
           - " DeduplicateExec: [tag@0 ASC,time@1 ASC]"
           - "   FilterExec: false"
-          - "     RecordBatchesExec: chunks=1, projection=[tag, time]"
+          - "     RecordBatchesExec: chunks=1 [Test=1], projection=[tag, time]"
         output:
           Ok:
             - " DeduplicateExec: [tag@0 ASC,time@1 ASC]"
             - "   FilterExec: false"
-            - "     RecordBatchesExec: chunks=1, projection=[tag, time]"
+            - "     RecordBatchesExec: chunks=1 [Test=1], projection=[tag, time]"
         "#
         );
     }
@@ -286,13 +286,13 @@ mod tests {
             input:
               - " DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
               - "   UnionExec"
-              - "     RecordBatchesExec: chunks=2, projection=[field, tag1, tag2, time]"
+              - "     RecordBatchesExec: chunks=2 [Test=2], projection=[field, tag1, tag2, time]"
               - "     DataSourceExec: file_groups={1 group: [[3.parquet]]}, projection=[field, tag1, tag2, time], file_type=parquet"
             output:
               Ok:
                 - " DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
                 - "   UnionExec"
-                - "     RecordBatchesExec: chunks=2, projection=[field, tag1, tag2, time]"
+                - "     RecordBatchesExec: chunks=2 [Test=2], projection=[field, tag1, tag2, time]"
                 - "     DataSourceExec: file_groups={1 group: [[3.parquet]]}, projection=[field, tag1, tag2, time], file_type=parquet"
             "#
             );
@@ -317,18 +317,18 @@ mod tests {
             input:
               - " DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
               - "   UnionExec"
-              - "     RecordBatchesExec: chunks=2, projection=[field, tag1, tag2, time]"
+              - "     RecordBatchesExec: chunks=2 [Test=2], projection=[field, tag1, tag2, time]"
               - "     DataSourceExec: file_groups={2 groups: [[3.parquet, 5.parquet], [4.parquet, 6.parquet]]}, projection=[field, tag1, tag2, time], file_type=parquet"
             output:
               Ok:
                 - " UnionExec"
                 - "   DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
                 - "     UnionExec"
-                - "       RecordBatchesExec: chunks=1, projection=[field, tag1, tag2, time]"
+                - "       RecordBatchesExec: chunks=1 [Test=1], projection=[field, tag1, tag2, time]"
                 - "       DataSourceExec: file_groups={2 groups: [[3.parquet, 6.parquet], [5.parquet]]}, projection=[field, tag1, tag2, time], file_type=parquet"
                 - "   DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
                 - "     UnionExec"
-                - "       RecordBatchesExec: chunks=1, projection=[field, tag1, tag2, time]"
+                - "       RecordBatchesExec: chunks=1 [Test=1], projection=[field, tag1, tag2, time]"
                 - "       DataSourceExec: file_groups={1 group: [[4.parquet]]}, projection=[field, tag1, tag2, time], file_type=parquet"
             "#
             );
@@ -357,11 +357,11 @@ mod tests {
                 @r#"
             input:
               - " DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
-              - "   RecordBatchesExec: chunks=3, projection=[field, tag1, tag2, time]"
+              - "   RecordBatchesExec: chunks=3 [Test=3], projection=[field, tag1, tag2, time]"
             output:
               Ok:
                 - " DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
-                - "   RecordBatchesExec: chunks=3, projection=[field, tag1, tag2, time]"
+                - "   RecordBatchesExec: chunks=3 [Test=3], projection=[field, tag1, tag2, time]"
             "#
             );
         }
@@ -385,13 +385,13 @@ mod tests {
             input:
               - " DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
               - "   UnionExec"
-              - "     RecordBatchesExec: chunks=2, projection=[field, tag1, tag2, time]"
+              - "     RecordBatchesExec: chunks=2 [Test=2], projection=[field, tag1, tag2, time]"
               - "     DataSourceExec: file_groups={1 group: [[3.parquet]]}, projection=[field, tag1, tag2, time], file_type=parquet"
             output:
               Ok:
                 - " DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
                 - "   UnionExec"
-                - "     RecordBatchesExec: chunks=2, projection=[field, tag1, tag2, time]"
+                - "     RecordBatchesExec: chunks=2 [Test=2], projection=[field, tag1, tag2, time]"
                 - "     DataSourceExec: file_groups={1 group: [[3.parquet]]}, projection=[field, tag1, tag2, time], file_type=parquet"
             "#
             );
@@ -424,18 +424,18 @@ mod tests {
             input:
               - " DeduplicateExec: [tag1@1 ASC,tag2@2 ASC,time@3 ASC]"
               - "   UnionExec"
-              - "     RecordBat
```

**File**: `core/iox_query/src/physical_optimizer/projection_pushdown.rs` (modified, +2/-2)
```diff
@@ -1353,10 +1353,10 @@ mod tests {
             @r#"
         input:
           - " ProjectionExec: expr=[tag1@0 as tag1]"
-          - "   RecordBatchesExec: chunks=1, projection=[tag1, tag2, field]"
+          - "   RecordBatchesExec: chunks=1 [Test=1], projection=[tag1, tag2, field]"
         output:
           Ok:
-            - " RecordBatchesExec: chunks=1, projection=[tag1]"
+            - " RecordBatchesExec: chunks=1 [Test=1], projection=[tag1]"
         "#
         );
 
```

**File**: `core/iox_query/src/physical_optimizer/sort/order_union_sorted_inputs.rs` (modified, +40/-40)
```diff
@@ -301,7 +301,7 @@ mod test {
           - "           SortPreservingMergeExec: [col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST]"
           - "             UnionExec"
           - "               SortExec: expr=[col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST], preserve_partitioning=[false]"
-          - "                 RecordBatchesExec: chunks=2, projection=[col1, col2, field1, time, __chunk_order]"
+          - "                 RecordBatchesExec: chunks=2 [Test=2], projection=[col1, col2, field1, time, __chunk_order]"
           - "               DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[col1, col2, field1, time, __chunk_order], output_ordering=[__chunk_order@4 ASC], file_type=parquet"
         output:
           Ok:
@@ -316,7 +316,7 @@ mod test {
             - "             SortPreservingMergeExec: [col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST]"
             - "               UnionExec"
             - "                 SortExec: expr=[col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST], preserve_partitioning=[false]"
-            - "                   RecordBatchesExec: chunks=2, projection=[col1, col2, field1, time, __chunk_order]"
+            - "                   RecordBatchesExec: chunks=2 [Test=2], projection=[col1, col2, field1, time, __chunk_order]"
             - "                 DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[col1, col2, field1, time, __chunk_order], output_ordering=[__chunk_order@4 ASC], file_type=parquet"
         "#
         );
@@ -371,7 +371,7 @@ mod test {
           - "           SortPreservingMergeExec: [col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST]"
           - "             UnionExec"
           - "               SortExec: expr=[col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST], preserve_partitioning=[false]"
-          - "                 RecordBatchesExec: chunks=2, projection=[col1, col2, field1, time, __chunk_order]"
+          - "                 RecordBatchesExec: chunks=2 [Test=2], projection=[col1, col2, field1, time, __chunk_order]"
           - "               DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[col1, col2, field1, time, __chunk_order], output_ordering=[__chunk_order@4 ASC], file_type=parquet"
         output:
           Ok:
@@ -386,7 +386,7 @@ mod test {
             - "             SortPreservingMergeExec: [col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST]"
             - "               UnionExec"
             - "                 SortExec: expr=[col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST], preserve_partitioning=[false]"
-            - "                   RecordBatchesExec: chunks=2, projection=[col1, col2, field1, time, __chunk_order]"
+            - "                   RecordBatchesExec: chunks=2 [Test=2], projection=[col1, col2, field1, time, __chunk_order]"
             - "                 DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[col1, col2, field1, time, __chunk_order], output_ordering=[__chunk_order@4 ASC], file_type=parquet"
         "#
         );
@@ -440,7 +440,7 @@ mod test {
           - "           SortPreservingMergeExec: [col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST]"
           - "             UnionExec"
           - "               SortExec: expr=[col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST], preserve_partitioning=[false]"
-          - "                 RecordBatchesExec: chunks=2, projection=[col1, col2, field1, time, __chunk_order]"
+          - "                 RecordBatchesExec: chunks=2 [Test=2], projection=[col1, col2, field1, time, __chunk_order]"
           - "               DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[col1, col2, field1, time, __chunk_order], output_ordering=[__chunk_order@4 ASC], file_type=parquet"
         output:
           Ok:
@@ -454,7 +454,7 @@ mod test {
             - "           SortPreservingMergeExec: [col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST]"
             - "             UnionExec"
             - "               SortExec: expr=[col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST], preserve_partitioning=[false]"
-            - "                 RecordBatchesExec: chunks=2, projection=[col1, col2, field1, time, __chunk_order]"
+            - "                 RecordBatchesExec: chunks=2 [Test=2], projection=[col1, col2, field1, time, __chunk_order]"
             - "               DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[col1, col2, field1, time, __chunk_order], output_ordering=[__chunk_order@4 ASC], file_type=parquet"
         "#
         );
@@ -504,7 +504,7 @@ mod test {
           - "         SortPreservingMergeExec: [col2@1 ASC NULLS LAST, col1@0 ASC NULLS LAST, time@3 ASC NULLS LAST]"
           - "
```

**File**: `core/iox_query/src/physical_optimizer/sort/order_union_sorted_inputs_for_constants.rs` (modified, +22/-22)
```diff
@@ -86,7 +86,7 @@ mod test {
           - "         DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[tag2, tag0, tag1, field1, time, __chunk_order], output_ordering=[__chunk_order@5 ASC], file_type=parquet"
           - "     SortExec: expr=[value@2 ASC NULLS LAST], preserve_partitioning=[false]"
           - "       ProjectionExec: expr=[m0 as iox::measurement, tag0 as key, tag0@1 as value]"
-          - "         RecordBatchesExec: chunks=1, projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
+          - "         RecordBatchesExec: chunks=1 [Test=1], projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
         output:
           Ok:
             - " ProgressiveEvalExec: input_ranges=[(m0,tag0)->(m0,tag0), (m1,tag0)->(m1,tag0)]"
@@ -97,7 +97,7 @@ mod test {
             - "           DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[tag2, tag0, tag1, field1, time, __chunk_order], output_ordering=[__chunk_order@5 ASC], file_type=parquet"
             - "       SortExec: expr=[value@2 ASC NULLS LAST], preserve_partitioning=[false]"
             - "         ProjectionExec: expr=[m0 as iox::measurement, tag0 as key, tag0@1 as value]"
-            - "           RecordBatchesExec: chunks=1, projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
+            - "           RecordBatchesExec: chunks=1 [Test=1], projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
         "#
         );
     }
@@ -167,10 +167,10 @@ mod test {
           - "         DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[tag2, tag0, tag1, field1, time, __chunk_order], output_ordering=[__chunk_order@5 ASC], file_type=parquet"
           - "     SortExec: expr=[value@2 ASC NULLS LAST], preserve_partitioning=[false]"
           - "       ProjectionExec: expr=[m0 as iox::measurement, tag1 as key, tag1@2 as value]"
-          - "         RecordBatchesExec: chunks=1, projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
+          - "         RecordBatchesExec: chunks=1 [Test=1], projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
           - "     SortExec: expr=[value@2 ASC NULLS LAST], preserve_partitioning=[false]"
           - "       ProjectionExec: expr=[m0 as iox::measurement, tag0 as key, tag0@1 as value]"
-          - "         RecordBatchesExec: chunks=1, projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
+          - "         RecordBatchesExec: chunks=1 [Test=1], projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
         output:
           Ok:
             - " ProgressiveEvalExec: input_ranges=[(m0,tag0)->(m0,tag0), (m0,tag1)->(m0,tag1), (m1,tag0)->(m1,tag0)]"
@@ -181,10 +181,10 @@ mod test {
             - "           DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[tag2, tag0, tag1, field1, time, __chunk_order], output_ordering=[__chunk_order@5 ASC], file_type=parquet"
             - "       SortExec: expr=[value@2 ASC NULLS LAST], preserve_partitioning=[false]"
             - "         ProjectionExec: expr=[m0 as iox::measurement, tag1 as key, tag1@2 as value]"
-            - "           RecordBatchesExec: chunks=1, projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
+            - "           RecordBatchesExec: chunks=1 [Test=1], projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
             - "       SortExec: expr=[value@2 ASC NULLS LAST], preserve_partitioning=[false]"
             - "         ProjectionExec: expr=[m0 as iox::measurement, tag0 as key, tag0@1 as value]"
-            - "           RecordBatchesExec: chunks=1, projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
+            - "           RecordBatchesExec: chunks=1 [Test=1], projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
         "#
         );
     }
@@ -243,7 +243,7 @@ mod test {
           - "         DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[tag2, tag0, tag1, field1, time, __chunk_order], output_ordering=[__chunk_order@5 ASC], file_type=parquet"
           - "     SortExec: expr=[value@2 ASC NULLS LAST], preserve_partitioning=[false]"
           - "       ProjectionExec: expr=[2 as iox::measurement, 20 as key, tag0@1 as value]"
-          - "         RecordBatchesExec: chunks=1, projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
+          - "         RecordBatchesExec: chunks=1 [Test=1], projection=[tag2, tag0, tag1, field1, time, __chunk_order]"
         output:
           Ok:
             - " ProgressiveEvalExec: input_ranges=[(1,10)->(1,10), (2,20)->(2,20)]"
@@ -253,7 +253,7 @@ mod test {
             - "         DataSourceExec: file_groups={1 group: [[0.parquet]]}, projection=[tag2, tag0, tag1, field1, time, __chunk_order], output_ordering=[__chunk_order@5 ASC], file_type=parquet"
             - "     SortExec: expr=[value@2 ASC NULLS LAST], preserve_partitioning=[false]"
             - "       ProjectionExec: expr=[2 as iox::measurement, 20 as key, tag0
```

**File**: `core/iox_query/src/physical_optimizer/tests.rs` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ async fn test_parquet_should_not_be_resorted() {
     - "                   CoalesceBatchesExec: target_batch_size=8192"
     - "                     FilterExec: time@1 > 2"
     - "                       RepartitionExec: partitioning=RoundRobinBatch(16), input_partitions=1"
-    - "                         RecordBatchesExec: chunks=1, projection=[tag, time, __chunk_order]"
+    - "                         RecordBatchesExec: chunks=1 [Test=1], projection=[tag, time, __chunk_order]"
     - "                 DataSourceExec: file_groups={16 groups: [[2.parquet:0..125], [3.parquet:0..125], [2.parquet:125..250], [3.parquet:125..250], [2.parquet:250..375], ...]}, projection=[tag, time, __chunk_order], output_ordering=[tag@0 ASC, time@1 ASC, __chunk_order@2 ASC], file_type=parquet, predicate=time@1 > 2, pruning_predicate=time_null_count@1 != row_count@2 AND time_max@0 > 2, required_guarantees=[]"
     "#
     );
```

---

### Incident Patch 7: `b31dae11` (2026-06-11)
**Commit Message**: fix: move default startup choice match to end of case (#27496)

**File**: `install_influxdb.sh` (modified, +8/-8)
```diff
@@ -1437,6 +1437,14 @@ else
     STARTUP_CHOICE=${STARTUP_CHOICE:-1}
 
     case "$STARTUP_CHOICE" in
+        3)
+            # Skip startup
+            START_SERVICE="n"
+            ;;
+        2)
+            # Custom Configuration - existing detailed flow
+            START_SERVICE="y"
+            ;;
         1|*)
             # Quick Start - use defaults and check for existing license
             if [ "$STARTUP_CHOICE" != "1" ]; then
@@ -1446,14 +1454,6 @@ else
             setup_license_for_quick_start
             START_SERVICE="y"
             ;;
-        2)
-            # Custom Configuration - existing detailed flow
-            START_SERVICE="y"
-            ;;
-        3)
-            # Skip startup
-            START_SERVICE="n"
-            ;;
     esac
 
     if [ "$START_SERVICE" = "y" ] && [ "$STARTUP_CHOICE" = "1" ]; then
```

---

### Incident Patch 8: `70335b15` (2026-05-30)
**Commit Message**: chore: update to 3.9.3 and add small fixes for license selection (#27485)

**File**: `install_influxdb.sh` (modified, +50/-59)
```diff
@@ -72,7 +72,7 @@
 # CONFIGURATION OPTIONS:
 #   Command Line Arguments:
 #     [enterprise]        Install Enterprise edition (default: Core)
-#     --version VERSION   Specify InfluxDB version (default: 3.8.0)
+#     --version VERSION   Specify InfluxDB version (default: 3.9.3)
 #
 #   Interactive Prompts (Binary Installation):
 #     Installation Type:  Docker Compose or Binary
@@ -167,8 +167,8 @@ PORT=8181
 # Set the default (latest) version here. Users may specify a version using the
 # --version arg (handled below)
 INFLUXDB_VERSION_FLAG_SET="0"
-INFLUXDB_OSS_VERSION="3.9.2"
-INFLUXDB_ENT_VERSION="3.9.2"
+INFLUXDB_OSS_VERSION="3.9.3"
+INFLUXDB_ENT_VERSION="3.9.3"
 
 EDITION="Core"
 EDITION_TAG="core"
@@ -279,15 +279,23 @@ find_next_available_port() {
 
 # --- Browser Integration ---
 
-# Utility function to open URL in browser
+# Open URL in the user's default browser. Runs synchronously and surfaces
+# errors so a failed launch is visible.
 open_browser_url() {
     URL="$1"
     if command -v open >/dev/null 2>&1; then
-        open "$URL" >/dev/null 2>&1 &
+        OPENER="open"
     elif command -v xdg-open >/dev/null 2>&1; then
-        xdg-open "$URL" >/dev/null 2>&1 &
+        OPENER="xdg-open"
     elif command -v start >/dev/null 2>&1; then
-        start "$URL" >/dev/null 2>&1 &
+        OPENER="start"
+    else
+        printf "├─${YELLOW} No browser opener found — open %s manually${NC}\n" "$URL"
+        return 0
+    fi
+    printf "├─ Opening %s in your default browser\n" "$URL"
+    if ! "$OPENER" "$URL" >/dev/null; then
+        printf "├─${YELLOW} Browser opener (%s) failed — open %s manually${NC}\n" "$OPENER" "$URL"
     fi
 }
 
@@ -542,6 +550,7 @@ generate_docker_compose_yaml() {
     SESSION_SECRET="$2"
     LICENSE_EMAIL="$3"
     DOCKER_DIR="$4"
+    LICENSE_TYPE="$5"  # "trial"/"home", or empty to reuse an existing license
 
     USER_UID=$(id -u)
     USER_GID=$(id -g)
@@ -553,6 +562,11 @@ generate_docker_compose_yaml() {
         CLUSTER_ARG="      - --cluster-id=cluster0"
         ENV_SECTION="    environment:
       - INFLUXDB3_ENTERPRISE_LICENSE_EMAIL=\${INFLUXDB_EMAIL}"
+        # Empty LICENSE_TYPE means reuse an existing license file.
+        if [ -n "$LICENSE_TYPE" ]; then
+            ENV_SECTION="${ENV_SECTION}
+      - INFLUXDB3_ENTERPRISE_LICENSE_TYPE=${LICENSE_TYPE}"
+        fi
     else
         SERVICE_NAME="influxdb3-core"
         IMAGE_NAME="influxdb:3-core"
@@ -589,7 +603,8 @@ ${ENV_SECTION}}
     container_name: influxdb3-explorer
     command: ["--mode=admin"]
     ports:
-      - "${EXPLORER_PORT}:80"
+      # Explorer image nginx listens on 8080 (was 80 prior to influxdb3-ui v1.7.0).
+      - "${EXPLORER_PORT}:8080"
     volumes:
       - ./explorer/db:/db:rw
       - ./explorer/config:/app-root/config:ro
@@ -711,16 +726,7 @@ setup_docker_compose() {
         elif [ -z "$LICENSE_EMAIL" ]; then
             # Prompt for license if not provided
             printf "\n${BOLD}License Setup Required${NC}\n"
-            printf "1) ${GREEN}Trial${NC} ${DIM}- Full features for 30 days (up to 256 cores)${NC}\n"
-            printf "2) ${GREEN}Home${NC} ${DIM}- Free for non-commercial use (max 2 cores, single node)${NC}\n"
-            printf "\nEnter your choice (1-2): "
-            read -r LICENSE_CHOICE
-
-            case "${LICENSE_CHOICE:-1}" in
-                1) LICENSE_TYPE="trial" ;;
-                2) LICENSE_TYPE="home" ;;
-                *) LICENSE_TYPE="trial" ;;
-            esac
+            prompt_license_type
 
             printf "Enter your email: "
             read -r LICENSE_EMAIL
@@ -750,7 +756,7 @@ setup_docker_compose() {
     SESSION_SECRET=$(generate_session_secret)
 
     printf "├─ Creating docker-compose.yml\n"
-    generate_docker_compose_yaml "$EDITION_TYPE" "$SESSION_SECRET" "$LICENSE_EMAIL" "$DOCKER_DIR"
+    generate_docker_compose_yaml "$EDITION_TYPE" "$SESSION_SECRET" "$LICENSE_EMAIL" "$DOCKER_DIR" "$LICENSE_TYPE"
 
     cd "$DOCKER_DIR"
 
@@ -957,6 +963,27 @@ configure_google_cloud_storage() {
 
 # --- Enterprise License ---
 
+# Prompt for the Enterprise license type. Sets LICENSE_TYPE and LICENSE_DESC.
+# Re-prompts on invalid input; aborts on EOF rather than defaulting to trial.
+prompt_license_type() {
+    printf "1) ${GREEN}Trial${NC} ${DIM}- Full features for 30 days (up to 256 cores)${NC}\n"
+    printf "2) ${GREEN}Home${NC} ${DIM}- Free for non-commercial use (max 2 cores, single node)${NC}\n"
+    while true; do
+        printf "Enter your choice (1-2): "
+        if ! read -r LICENSE_CHOICE; then
+            printf "\n${RED}Error:${NC} No license type selected and no interactive input is available.\n"
+            printf "Re-run this installer in an interactive terminal, or start the server\n"
+            printf "manually with --license-type=trial or --license-type=home.\n"
+            exit 1
+        fi
+        case "$LICENSE_CHOICE" in
+            1) LICENSE_TYPE="trial"; LICENSE_DESC="Trial"; return ;
```

---

### Incident Patch 9: `5ac92958` (2026-05-01)
**Commit Message**: chore(sync): influxdb_pro 2026-05-01 (#27399)

Source: ad8686d895cadac4972a612dd2b5e4d0e0adfabf

Commits:
- `4bf54d028e` chore(ci): cargo audit ignore for 'RUSTSEC-2026-0114' (influxdata/influxdb_pro#3365)
- `dca0fabb21` feat: add plugin trigger type restrictions (influxdata/influxdb_pro#3293)
- `0ecab6db06` feat(grpc): emit query-stats gRPC trailers on Enterprise Flight do_get (influxdata/influxdb_pro#3295)
- `b681835416` fix(WriteLineError): slice string at utf-8 boundary (influxdata/influxdb_pro#3292)
- `545100cfba` fix(sll): include database_id on v1 /query entries (influxdata/influxdb_pro#3284)
- `694b428ba3` feat: add import command to CLI to exercise the Bulk Import API (influxdata/influxdb_pro#3162)
- `c1c0d3373d` chore: Remove iox-sync from justfiles and readme (influxdata/influxdb_pro#3256)
- `2a03788008` docs: fix rustdoc (influxdata/influxdb_pro#3222)
- `5d80136a7e` feat(pacha_tree): wire V2 compactor into Combined mode HTTP test endpoints (influxdata/influxdb_pro#3216)
- `ce9a862a4a` feat(server): add /ready endpoint with object store health check (influxdata/influxdb_pro#3185)
- `85e125f679` fix(tokio): update to 1.52.1 for spawn_blocking fix (influxdata/influxdb_pro#

**File**: `.circleci/config.yml` (modified, +1/-3)
```diff
@@ -271,10 +271,8 @@ jobs:
           command: cargo install cargo-deny --locked
       - run:
           name: cargo-deny Checks
-          # `--warn unsound` downgrades RustSec `informational = "unsound"`
-          # advisories to warnings, they flag API soundness concerns, not
-          # exploitable vulnerabilities, so we don't want them to fail CI.
           command: cargo deny check -s --warn unsound
+
   doc:
     docker:
       - image: quay.io/influxdb/rust:ci
```

**File**: `.circleci/packages/influxdb3/fs/usr/share/influxdb3/influxdb3-core.conf` (modified, +4/-0)
```diff
@@ -228,6 +228,10 @@
 # URL of plugin repository (env: INFLUXDB3_PLUGIN_REPO)
 #plugin-repo="<URL>"
 
+# Restrict plugin triggers to the provided trigger type(s). Comma-separated
+# list of: wal, schedule, request (env: INFLUXDB3_RESTRICT_PLUGIN_TRIGGERS_TO)
+#restrict-plugin-triggers-to="<TYPES>"
+
 # =============================================================================
 # Data Lifecycle & Retention
 # =============================================================================
```

**File**: `Cargo.lock` (modified, +20/-17)
```diff
@@ -168,7 +168,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -179,7 +179,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -2775,7 +2775,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -3578,7 +3578,7 @@ dependencies = [
  "libc",
  "percent-encoding",
  "pin-project-lite",
- "socket2 0.6.3",
+ "socket2 0.5.10",
  "tokio",
  "tower-service",
  "tracing",
@@ -4261,6 +4261,7 @@ dependencies = [
  "arrow-flight",
  "arrow-json",
  "arrow-schema",
+ "async-trait",
  "authz",
  "base64 0.21.7",
  "bytes",
@@ -4308,6 +4309,7 @@ dependencies = [
  "metric_exporters",
  "mime",
  "object_store",
+ "object_store_utils",
  "observability_deps",
  "parquet",
  "parquet_file",
@@ -4883,7 +4885,7 @@ checksum = "3640c1c38b8e4e43584d8df18be5fc6b0aa314ce6ebf51b53313d4306cca8e46"
 dependencies = [
  "hermit-abi",
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -5455,7 +5457,7 @@ version = "0.50.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7957b9740744892f114936ab4a57b3f487491bbeafaf8083688b16841a4240e5"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -5730,6 +5732,7 @@ dependencies = [
  "backon",
  "bytes",
  "futures",
+ "iox_time",
  "object_store",
  "observability_deps",
  "tokio",
@@ -6600,7 +6603,7 @@ dependencies = [
  "quinn-udp",
  "rustc-hash",
  "rustls 0.23.37",
- "socket2 0.6.3",
+ "socket2 0.5.10",
  "thiserror 2.0.18",
  "tokio",
  "tracing",
@@ -6637,7 +6640,7 @@ dependencies = [
  "cfg_aliases",
  "libc",
  "once_cell",
- "socket2 0.6.3",
+ "socket2 0.5.10",
  "tracing",
  "windows-sys 0.60.2",
 ]
@@ -7101,7 +7104,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.12.1",
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -7138,7 +7141,7 @@ dependencies = [
  "once_cell",
  "ring",
  "rustls-pki-types",
- "rustls-webpki 0.103.12",
+ "rustls-webpki 0.103.13",
  "subtle",
  "zeroize",
 ]
@@ -7187,9 +7190,9 @@ dependencies = [
 
 [[package]]
 name = "rustls-webpki"
-version = "0.103.12"
+version = "0.103.13"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8279bb85272c9f10811ae6a6c547ff594d6a7f3c6c6b02ee9726d1d0dcfcdd06"
+checksum = "61c429a8649f110dddef65e2a5ad240f747e85f7758a6bccc7e5777bd33f756e"
 dependencies = [
  "ring",
  "rustls-pki-types",
@@ -7655,7 +7658,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3a766e1110788c36f4fa1c2b71b387a7815aa65f88ce0229841826633d93723e"
 dependencies = [
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -8079,7 +8082,7 @@ dependencies = [
  "getrandom 0.4.2",
  "once_cell",
  "rustix 1.1.4",
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -8328,9 +8331,9 @@ checksum = "1f3ccbac311fea05f86f61904b462b55fb3df8837a366dfc601a0161d0532f20"
 
 [[package]]
 name = "tokio"
-version = "1.52.0"
+version = "1.52.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a91135f59b1cbf38c91e73cf3386fca9bb77915c45ce2771460c9d92f0f3d776"
+checksum = "b67dee974fe86fd92cc45b7a95fdd2f99a36a6d7b0d431a231178d3d670bbcc6"
 dependencies = [
  "bytes",
  "libc",
@@ -9572,7 +9575,7 @@ version = "0.1.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c2a7b1c03c876122aa43f3020e6c3c3ee5c05081c9a00739faf7503aeba10d22"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.48.0",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -212,7 +212,7 @@ regex = "1.11.1"
 reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "stream", "json"] }
 rstest = "0.26"
 rustls = { version = "0.23", default-features = false, features = ["logging", "ring", "std", "tls12"] }
-rustls-webpki = { version = "0.103.12", default-features = false, features = ["ring", "std"] }
+rustls-webpki = { version = "0.103.13", default-features = false, features = ["ring", "std"] }
 secrecy = "0.8.0"
 serde = { version = "1.0", features = ["derive"] }
 # serde_json is set to 1.0.127 to prevent a conflict with core, if that gets updated upstream, this
```

**File**: `core/README.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+# `oss/core`
+
+`oss/core` contains the lower-level shared crates shared across:
+
+- InfluxDB 3 Core
+- InfluxDB 3 Enterprise
+- InfluxDB 3 IOx
+
+These crates provide common building blocks such as query execution, schema and data
+types, HTTP and gRPC utilities, observability helpers, and supporting Arrow and Parquet
+infrastructure.
+
+
+Examples of crates in this directory include:
+
+- query and planner crates such as `iox_query`, `iox_query_influxql`, and `query_functions`
+- shared data model crates such as `data_types`, `schema`, and `mutable_batch`
+- service and protocol crates such as `generated_types`, `service_grpc_flight`, and `iox_http`
+- common runtime and observability crates such as `executor`, `metric`, `trace`, and `trogging`
+
+As a rule of thumb, code belongs in `core` when it is product-agnostic infrastructure.
```

**File**: `core/data_types/src/columns.rs` (modified, +19/-0)
```diff
@@ -411,6 +411,25 @@ impl std::fmt::Display for ColumnType {
     }
 }
 
+impl std::str::FromStr for ColumnType {
+    type Err = String;
+
+    fn from_str(s: &str) -> Result<Self, Self::Err> {
+        match s {
+            "i64" => Ok(Self::I64),
+            "u64" => Ok(Self::U64),
+            "f64" => Ok(Self::F64),
+            "bool" => Ok(Self::Bool),
+            "string" => Ok(Self::String),
+            "time" => Ok(Self::Time),
+            "tag" => Ok(Self::Tag),
+            _ => Err(format!(
+                "invalid column type '{s}': valid types are i64, u64, f64, bool, string, time, tag"
+            )),
+        }
+    }
+}
+
 impl TryFrom<&ArrowDataType> for ColumnType {
     type Error = &'static str;
 
```

**File**: `core/iox_v1_query_api/src/handler.rs` (modified, +185/-1)
```diff
@@ -61,6 +61,48 @@ struct QueryPlan {
     context: IOxSessionContext,
 }
 
+/// A V1 `/query` request parsed but not yet executed.
+///
+/// Returned by [`V1HttpHandler::extract_query_request`] and consumed by
+/// [`V1HttpHandler::execute_query`]. Callers can read
+/// [`Self::requested_database`] between the two phases to wire up
+/// observability that needs the database name from the request.
+///
+/// The inner fields hold the auth token bytes and the raw query text;
+/// the manual `Debug` impl redacts both so accidental `{:?}` formatting
+/// can't leak them into logs.
+pub struct ExtractedV1Request {
+    span_ctx: Option<SpanContext>,
+    token: Option<Vec<u8>>,
+    params: QueryParams,
+    format: QueryFormat,
+}
+
+impl std::fmt::Debug for ExtractedV1Request {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        f.debug_struct("ExtractedV1Request")
+            .field("requested_database", &self.requested_database())
+            .field("token", &self.token.as_ref().map(|_| "<redacted>"))
+            .field("query", &self.params.query.as_ref().map(|_| "<redacted>"))
+            .field("format", &self.format)
+            .finish()
+    }
+}
+
+impl ExtractedV1Request {
+    /// The database name as supplied by the request — URL query string,
+    /// `application/x-www-form-urlencoded` body, or multipart `db` field.
+    /// Empty strings collapse to `None`, matching `execute_query`'s own
+    /// handling.
+    ///
+    /// This is the request-level value only. Per-statement DB/RP overrides
+    /// embedded in InfluxQL (e.g. `SELECT … FROM "otherdb"."rp"."m"`) are
+    /// resolved during execution and are not reflected here.
+    pub fn requested_database(&self) -> Option<&str> {
+        self.params.database.as_deref().filter(|s| !s.is_empty())
+    }
+}
+
 #[derive(Debug, Clone)]
 pub struct V1HttpHandler {
     database: Arc<dyn QueryDatabase>,
@@ -132,7 +174,19 @@ impl V1HttpHandler {
             .map_err(|e| HttpError::InternalError(e.to_string()))
     }
 
-    async fn handle_parameterized_query(&self, mut req: Request) -> Result<Response, HttpError> {
+    async fn handle_parameterized_query(&self, req: Request) -> Result<Response, HttpError> {
+        let extracted = self.extract_query_request(req).await?;
+        self.execute_query(extracted).await
+    }
+
+    /// Parse the request: trace context, auth token, and body params/format.
+    ///
+    /// Splitting this out from execution lets callers inspect the resolved
+    /// `database` (e.g. for service-level logging) before the request runs.
+    pub async fn extract_query_request(
+        &self,
+        mut req: Request,
+    ) -> Result<ExtractedV1Request, HttpError> {
         let span_ctx = Some(SpanContext::new_with_optional_collector(
             self.trace_collector.as_ref().map(Arc::clone),
         ));
@@ -143,6 +197,26 @@ impl V1HttpHandler {
 
         let (params, format) = extract_request(req).await?;
 
+        Ok(ExtractedV1Request {
+            span_ctx,
+            token,
+            params,
+            format,
+        })
+    }
+
+    /// Execute a previously parsed V1 request.
+    pub async fn execute_query(
+        &self,
+        extracted: ExtractedV1Request,
+    ) -> Result<Response, HttpError> {
+        let ExtractedV1Request {
+            span_ctx,
+            token,
+            params,
+            format,
+        } = extracted;
+
         let QueryParams {
             chunk_size,
             chunked,
@@ -975,4 +1049,114 @@ mod tests {
             insta::assert_snapshot!(res);
         });
     }
+
+    /// Helper: build a fresh handler for `extract_query_request` tests.
+    /// These tests do not exercise execution, so the database / authz
+    /// implementations are inert.
+    fn handler_for_extract_tests() -> V1HttpHandler {
+        let db: Arc<dyn QueryDatabase> = Arc::new(TestDatabaseStore::default());
+        V1HttpHandler::new(db, None, None, "test".to_string())
+    }
+
+    #[tokio::test]
+    async fn extract_query_request_db_in_url() {
+        let req = RequestBuilder::new()
+            .method("GET")
+            .uri("http://h/query?db=mydb&q=SELECT%201")
+            .body(empty_request_body())
+            .unwrap();
+        let extracted = handler_for_extract_tests()
+            .extract_query_request(req)
+            .await
+            .expect("extract should succeed");
+        assert_eq!(extracted.requested_database(), Some("mydb"));
+    }
+
+    #[tokio::test]
+    async fn extract_query_request_db_in_form_body() {
+        let req = RequestBuilder::new()
+            .method("POST")
+            .uri("http://h/query")
+            .header("Content-Type", "application/x-www-form-urlencoded")
+            .body(iox_http_util::bytes_to_request_body("db=mydb&q=SELECT+1"))
+            .unwrap();
+        let extracted = handler_for_extract_tests()
+            .extract_query_request(req)
+            .await
+          
```

**File**: `core/iox_v1_query_api/src/lib.rs` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ use types::Statement;
 mod error;
 pub use error::HttpError;
 mod handler;
-pub use handler::V1HttpHandler;
+pub use handler::{ExtractedV1Request, V1HttpHandler};
 mod response;
 mod types;
 mod value;
```

---

### Incident Patch 10: `b66fe858` (2026-04-20)
**Commit Message**: fix(install): make Enterprise startup options 2 and 3 reachable (#27363)

The Enterprise startup case statement used `1|*)` as its first arm,
which matches any input because `*` is a wildcard. This made options
`2` (Custom Configuration) and `3` (Skip startup) unreachable — every
non-`1` input fell into the first arm and printed "Invalid choice".

Split the pattern into separate `1)` and `*)` arms, matching the Core
block's structure.

**File**: `install_influxdb.sh` (modified, +7/-4)
```diff
@@ -1437,11 +1437,8 @@ else
     STARTUP_CHOICE=${STARTUP_CHOICE:-1}
 
     case "$STARTUP_CHOICE" in
-        1|*)
+        1)
             # Quick Start - use defaults and check for existing license
-            if [ "$STARTUP_CHOICE" != "1" ]; then
-                printf "Invalid choice. Using Quick Start (option 1).\n"
-            fi
             setup_quick_start_defaults enterprise
             setup_license_for_quick_start
             START_SERVICE="y"
@@ -1454,6 +1451,12 @@ else
             # Skip startup
             START_SERVICE="n"
             ;;
+        *)
+            printf "Invalid choice. Using Quick Start (option 1).\n"
+            setup_quick_start_defaults enterprise
+            setup_license_for_quick_start
+            START_SERVICE="y"
+            ;;
     esac
 
     if [ "$START_SERVICE" = "y" ] && [ "$STARTUP_CHOICE" = "1" ]; then
```

---

### Incident Patch 11: `73be12bf` (2026-04-20)
**Commit Message**: chore(sync): influxdb_pro 2026-04-20 (#27365)

* chore(sync): influxdb_pro 2026-04-20

Source: df9464c7001d121794ccf5a661412c61eed94cc6

Commits:
- `7e41542e01` chore(oss): update `README` and `install_script` (influxdata/influxdb_pro#3197)
- `500b716ecb` feat(query concurrency limit): add query limit to cli and api (influxdata/influxdb_pro#2892)
- `4ffb57bc04` feat(shutdown): add named component tracking and shutdown progress logging (influxdata/influxdb_pro#3172)
- `6159903853` chore(sync): sync iox to oss/core 2026-04-15 (influxdata/influxdb_pro#3156)
- `4ca928c74e` chore: Port miri CI job to pro (`oss-miri`) (influxdata/influxdb_pro#3004)
- `f6214b1aba` chore: Port buf-lint job to influxdb_pro (influxdata/influxdb_pro#3024)
- `8326ce082c` chore: Address cargo audit failures (influxdata/influxdb_pro#3155)
- `b64029e16c` refactor(oss): use `DatabaseName` instead of `NamespaceName` (influxdata/influxdb_pro#3014)
- `df46ecc319` chore(cargo-deny): Downgrade unsound info advisories to warnings (influxdata/influxdb_pro#3115)
- `cdd4aa7865` chore(deny): ignore RUSTSEC-2026-0097 (rand 0.8.5 unsoundness) (influxdata/influxdb_pro#3113)
- `c243df955b` chore(sync): sync iox to oss/core 2026

**File**: `.circleci/config.yml` (modified, +18/-2)
```diff
@@ -271,8 +271,10 @@ jobs:
           command: cargo install cargo-deny --locked
       - run:
           name: cargo-deny Checks
-          command: cargo deny check -s
-
+          # `--warn unsound` downgrades RustSec `informational = "unsound"`
+          # advisories to warnings, they flag API soundness concerns, not
+          # exploitable vulnerabilities, so we don't want them to fail CI.
+          command: cargo deny check -s --warn unsound
   doc:
     docker:
       - image: quay.io/influxdb/rust:ci
@@ -483,8 +485,22 @@ jobs:
                 # XXX: better to use 'cargo:rustc-link-arg=-Wl,-rpath,@executable_path/python/lib'
                 name: adjust LC_RPATH path for darwin
                 command: |
+                  export PBS_LIBPYTHON=$(grep '^lib_name=' /tmp/workspace/python-artifacts/<< parameters.target >>/pyo3_config_file.txt | cut -d = -f 2)
+                  test -n "$PBS_LIBPYTHON" || { echo "ERROR: empty $PBS_LIBPYTHON"; exit 1; }
                   echo "Running: /osxcross/bin/aarch64-apple-darwin22.2-install_name_tool -add_rpath '@executable_path/python/lib' '${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3'"
                   /osxcross/bin/aarch64-apple-darwin22.2-install_name_tool -add_rpath '@executable_path/python/lib' "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3"
+                  echo "Verifying python shared library dependency via otool -L (expecting @rpath/libpython…dylib)"
+                  /osxcross/bin/aarch64-apple-darwin22.2-otool -L "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3" | grep -q "@rpath/lib${PBS_LIBPYTHON}.dylib" || {
+                    echo "ERROR: expected @rpath/lib${PBS_LIBPYTHON}.dylib not found in otool output"
+                    /osxcross/bin/aarch64-apple-darwin22.2-otool -L "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3"
+                    exit 1
+                  }
+                  echo "Verifying LC_RPATH for python shared library dependency via otool -l (expecting @executable_path/python/lib"
+                  /osxcross/bin/aarch64-apple-darwin22.2-otool -l "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3" | grep -q "path @executable_path/python/lib" || {
+                    echo "ERROR: expected @executable_path/python/lib not found in otool output"
+                    /osxcross/bin/aarch64-apple-darwin22.2-otool -l "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3"
+                    exit 1
+                  }
                   # re-sign after install_name_tool since osxcross won't do it
                   echo "Running: /usr/local/bin/rcodesign sign '${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3'"
                   /usr/local/bin/rcodesign sign "${PWD}/target/<< parameters.target >>/<< parameters.profile >>/influxdb3"
```

**File**: `.circleci/packages/influxdb3/fs/usr/share/influxdb3/influxdb3-core.conf` (modified, +4/-0)
```diff
@@ -87,6 +87,10 @@
 # Default: 1000 (env: INFLUXDB3_QUERY_LOG_SIZE)
 #query-log-size="1000"
 
+# Maximum concurrent queries (env: INFLUXDB3_MAX_CONCURRENT_QUERIES)
+# Default: ~2^60 (effectively unlimited)
+#max-concurrent-queries="<LIMIT>"
+
 # Max parquet files allowed in a query (env: INFLUXDB3_QUERY_FILE_LIMIT)
 #query-file-limit="<LIMIT>"
 
```

**File**: `Cargo.lock` (modified, +185/-102)
```diff
@@ -388,7 +388,7 @@ dependencies = [
  "arrow-schema",
  "chrono",
  "half",
- "indexmap 2.13.0",
+ "indexmap 2.14.0",
  "itoa",
  "lexical-core",
  "memchr",
@@ -842,7 +842,7 @@ version = "0.10.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "46502ad458c9a52b69d4d4d32775c788b7a1b85e8bc9d482d92250fc0e3f8efe"
 dependencies = [
- "digest",
+ "digest 0.10.7",
 ]
 
 [[package]]
@@ -856,7 +856,7 @@ dependencies = [
  "cc",
  "cfg-if",
  "constant_time_eq",
- "cpufeatures",
+ "cpufeatures 0.2.17",
 ]
 
 [[package]]
@@ -868,6 +868,15 @@ dependencies = [
  "generic-array",
 ]
 
+[[package]]
+name = "block-buffer"
+version = "0.12.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cdd35008169921d80bc60d3d0ab416eecb028c4cd653352907921d95084790be"
+dependencies = [
+ "hybrid-array",
+]
+
 [[package]]
 name = "bloom2"
 version = "0.5.1"
@@ -1228,6 +1237,13 @@ version = "1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
 
+[[package]]
+name = "cli_types"
+version = "3.10.0-oss-nightly"
+dependencies = [
+ "tokio",
+]
+
 [[package]]
 name = "client_util"
 version = "3.10.0-oss-nightly"
@@ -1279,14 +1295,13 @@ dependencies = [
 
 [[package]]
 name = "console"
-version = "0.15.11"
+version = "0.16.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "054ccb5b10f9f2cbf51eb355ca1d05c2d279ce1804688d0db74b4733a5aeafd8"
+checksum = "d64e8af5551369d19cf50138de61f1c42074ab970f74e99be916646777f8fc87"
 dependencies = [
  "encode_unicode",
  "libc",
- "once_cell",
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -1332,6 +1347,12 @@ version = "0.9.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c2459377285ad874054d797f3ccebf984978aa39129f6eafde5cdc8315b612f8"
 
+[[package]]
+name = "const-oid"
+version = "0.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a6ef517f0926dd24a1582492c791b6a4818a4d94e789a334894aa15b0d12f55c"
+
 [[package]]
 name = "const-random"
 version = "0.1.18"
@@ -1383,6 +1404,15 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "cpufeatures"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8b2a41393f66f16b0823bb79094d54ac5fbd34ab292ddafb9a0456ac9f87d201"
+dependencies = [
+ "libc",
+]
+
 [[package]]
 name = "cranelift-assembler-x64"
 version = "0.128.4"
@@ -1619,19 +1649,19 @@ dependencies = [
 
 [[package]]
 name = "croaring"
-version = "2.5.2"
+version = "2.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6df912ff72ea740c5584e3d86d12f4703563f7c82e5364c338d54adad6026d28"
+checksum = "d0e813b58ac55ac5ccea5ec63beb8c80f37dedd78da3f594c848313415a08c8c"
 dependencies = [
  "allocator-api2 0.4.0",
  "croaring-sys",
 ]
 
 [[package]]
 name = "croaring-sys"
-version = "4.5.1"
+version = "4.6.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "240ad876d0430c1fb1447c5f7dc66bd796e9b5b207d1a0519ca282a5fb220609"
+checksum = "f34e9ee8e65c0d46c9d0fe55ce80b477d0bfae4c786c6694687b9c70e8267027"
 dependencies = [
  "cc",
 ]
@@ -1729,6 +1759,15 @@ dependencies = [
  "typenum",
 ]
 
+[[package]]
+name = "crypto-common"
+version = "0.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "77727bb15fa921304124b128af125e7e3b968275d1b108b379190264f4423710"
+dependencies = [
+ "hybrid-array",
+]
+
 [[package]]
 name = "csv"
 version = "1.4.0"
@@ -1813,7 +1852,7 @@ dependencies = [
  "influxdb-line-protocol",
  "iox_time",
  "murmur3",
- "ordered-float 5.1.0",
+ "ordered-float 5.3.0",
  "paste",
  "percent-encoding",
  "proptest",
@@ -1822,7 +1861,7 @@ dependencies = [
  "schema",
  "serde",
  "serde_json",
- "sha2",
+ "sha2 0.11.0",
  "siphasher",
  "snafu 0.9.0",
  "sqlx",
@@ -1945,7 +1984,7 @@ dependencies = [
  "chrono",
  "half",
  "hashbrown 0.14.5",
- "indexmap 2.13.0",
+ "indexmap 2.14.0",
  "libc",
  "log",
  "object_store",
@@ -2134,7 +2173,7 @@ dependencies = [
  "datafusion-functions-aggregate-common",
  "datafusion-functions-window-common",
  "datafusion-physical-expr-common",
- "indexmap 2.13.0",
+ "indexmap 2.14.0",
  "itertools 0.14.0",
  "paste",
  "recursive",
@@ -2149,7 +2188,7 @@ source = "git+https://github.com/influxdata/arrow-datafusion.git?rev=dfdd85535f7
 dependencies = [
  "arrow",
  "datafusion-common",
- "indexmap 2.13.0",
+ "indexmap 2.14.0",
  "itertools 0.14.0",
  "paste",
 ]
@@ -2178,7 +2217,7 @@ dependencies = [
  "num-traits",
  "rand 0.9.2",
  "regex",
- "sha2",
+ "sha2 0.10.9",
  "unicode-segmentation",
  "uuid",
 ]
@@ -2299,7 +2338,7 @@ dependencies = [
  "datafusion-expr",
  "datafusion-expr-common",
  "datafusion-physical-expr",
- "indexmap 2.13.0",
+ "indexmap 2.14.0",
  "itertools 0.14.0",
  "log",
  "recursive",
@@ -2321,7 +2360,7 @@ dependencies = [
  "datafusion-physical-exp
```

**File**: `Cargo.toml` (modified, +2/-1)
```diff
@@ -24,6 +24,7 @@ members = [
     "influxdb3_types",
     "influxdb3_wal",
     "influxdb3_write",
+    "cli_types",
     "object_store_limit",
     "object_store_utils",
     "core/arrow_util",
@@ -211,7 +212,7 @@ regex = "1.11.1"
 reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "stream", "json"] }
 rstest = "0.26"
 rustls = { version = "0.23", default-features = false, features = ["logging", "ring", "std", "tls12"] }
-rustls-webpki = { version = "0.103", default-features = false, features = ["ring", "std"] }
+rustls-webpki = { version = "0.103.12", default-features = false, features = ["ring", "std"] }
 secrecy = "0.8.0"
 serde = { version = "1.0", features = ["derive"] }
 # serde_json is set to 1.0.127 to prevent a conflict with core, if that gets updated upstream, this
```

**File**: `cli_types/Cargo.toml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+[package]
+name = "cli_types"
+version.workspace = true
+authors.workspace = true
+edition.workspace = true
+license.workspace = true
+
+[dependencies]
+tokio = { workspace = true }
+
+[lints]
+workspace = true
```

**File**: `cli_types/src/lib.rs` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+//! Shared CLI argument types used by both OSS and Enterprise `influxdb3` binaries.
+
+use std::fmt;
+use std::str::FromStr;
+
+/// The effective upper bound for query concurrency — equal to `tokio::sync::Semaphore::MAX_PERMITS`.
+/// Used as the default (effectively unlimited) and as the validation ceiling.
+pub const QUERY_CONCURRENCY_LIMIT_MAX: usize = tokio::sync::Semaphore::MAX_PERMITS;
+
+/// Upper bound on concurrently-executing queries, parsed from the `--max-concurrent-queries`
+/// CLI flag. Valid range is `1..=QUERY_CONCURRENCY_LIMIT_MAX`.
+#[derive(Debug, Clone, Copy)]
+pub struct MaxConcurrentQueries(pub usize);
+
+impl FromStr for MaxConcurrentQueries {
+    type Err = String;
+
+    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
+        let n: usize = s.parse().map_err(|e| format!("invalid integer: {e}"))?;
+        if n == 0 {
+            return Err("must be a positive integer, got 0".into());
+        }
+        if n > QUERY_CONCURRENCY_LIMIT_MAX {
+            return Err(format!("exceeds maximum of {QUERY_CONCURRENCY_LIMIT_MAX}"));
+        }
+        Ok(Self(n))
+    }
+}
+
+impl fmt::Display for MaxConcurrentQueries {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        self.0.fmt(f)
+    }
+}
```

**File**: `core/arrow_util/Cargo.toml` (modified, +0/-1)
```diff
@@ -26,7 +26,6 @@ regex = "1.12.3"
 snafu = "0.9"
 uuid = "1"
 
-
 [dev-dependencies]
 datafusion = { workspace = true }
 proptest = { workspace = true }
```

**File**: `core/arrow_util/src/test_util.rs` (modified, +40/-0)
```diff
@@ -243,6 +243,11 @@ static REGEX_TIMING: LazyLock<Regex> =
 /// and `TableScan: .*`
 ///
 /// Should be used in combination w/ [`REGEX_TIME_OP`] and [`REGEX_TIMESTAMP_NANOSECOND`].
+///
+/// Example matches:
+/// * `FilterExec: time @compactor/src/components/df_planner/planner_v1.rs >= 123456789, projection=[tag0 @compactor/tests/steady_state/vary_l0_file_overlap.rs]`
+/// * `Filter: m0.time >= TimestampNanosecond(1775484002505303000, None)`
+/// * `TableScan: m0 projection=[tag0, time], partial_filters=[m0.time >= TimestampNanosecond(1775484002505303000, None)]`
 static REGEX_FILTER: LazyLock<Regex> = LazyLock::new(|| {
     Regex::new("(?P<prefix>(FilterExec)|(DataSourceExec)|(Filter)|(TableScan): )(?P<expr>.*)")
         .expect("filter regex")
@@ -603,3 +608,38 @@ impl PartialEq<Self> for Formatter {
 }
 
 impl Eq for Formatter {}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_normalizer_filters() {
+        let mut normalizer = Normalizer::new();
+        normalizer.normalized_filters = true;
+
+        let cases = vec![
+            (
+                "FilterExec: time@3 >= 123456789",
+                "FilterExec: time@3 >= <REDACTED>",
+            ),
+            (
+                "Filter: m0.time >= TimestampNanosecond(1775484002505303000, None)",
+                "Filter: m0.time >= TimestampNanosecond(<REDACTED>, None)",
+            ),
+            (
+                "TableScan: m0 projection=[tag0, time], partial_filters=[m0.time >= TimestampNanosecond(1775484002505303000, None)]",
+                "TableScan: m0 projection=[tag0, time], partial_filters=[m0.time >= TimestampNanosecond(<REDACTED>, None)]",
+            ),
+            (
+                "FilterExec: time @compactor/src/components/df_planner/planner_v1.rs >= 123456789",
+                "FilterExec: time @compactor/src/components/df_planner/planner_v1.rs >= 123456789", // Current behavior: no redact
+            ),
+        ];
+
+        for (input, expected) in cases {
+            let result = normalizer.normalize_text(vec![input.to_string()]);
+            assert_eq!(result[0], expected, "Input: {}", input);
+        }
+    }
+}
```

---

### Incident Patch 12: `bab3d0b0` (2026-04-09)
**Commit Message**: fix: ignore wasmtime 41.0.4 security advisories in cargo-deny (#27350)

Add 11 wasmtime RUSTSEC advisories to the deny.toml ignore list.
These are transitive dependencies via datafusion-udf-wasm and do not
affect us: Wasm UDFs are disabled by default, and none of the
advisories match our runtime configuration.

See influxdata/influxdb_pro#3089 for full analysis.

**File**: `deny.toml` (modified, +27/-0)
```diff
@@ -21,6 +21,33 @@ ignore = [
     # (requires CA compromise). Stuck on 0.102.x via wasmtime's rustls 0.22.x
     # dep in datafusion-udf-wasm. Upstream also ignores this advisory.
     "RUSTSEC-2026-0049",
+
+    # wasmtime 41.0.4 advisories (transitive dep via datafusion-udf-wasm)
+    #
+    # Wasm UDFs are disabled by default (udfs_enabled = false in iox_query config).
+    # The Wasm component model code path is never entered unless explicitly enabled.
+    # Additionally, none of the advisories match our runtime configuration:
+    #
+    # Winch compiler backend required (we use Cranelift, the default):
+    "RUSTSEC-2026-0086", # GHSA-m9w2-8782-2946: host data leakage with 64-bit tables and Winch
+    "RUSTSEC-2026-0089", # GHSA-q49f-xg75-m9xw: host panic on table.fill with Winch
+    "RUSTSEC-2026-0094", # GHSA-f984-pcp8-v2p7: improperly masked table.grow return with Winch
+    "RUSTSEC-2026-0095", # GHSA-xx5w-cvp6-jv83: Winch sandbox-escaping memory access
+    #
+    # Non-default runtime config required (we use defaults: spectre on, on-demand allocator):
+    "RUSTSEC-2026-0087", # GHSA-qqfj-4vcm-26hv: f64x2.splat segfault (requires signals-based-traps disabled)
+    "RUSTSEC-2026-0088", # GHSA-6wgr-89rj-399p: pooling allocator data leakage (requires pooling allocator)
+    "RUSTSEC-2026-0096", # GHSA-jhxm-h53p-jm7w: aarch64 sandbox escape (requires spectre mitigations disabled)
+    #
+    # Component model features we don't use (no flags types, no cross-component string passing):
+    "RUSTSEC-2026-0085", # GHSA-m758-wjhj-p3jq: panic lifting flags component value (no flags in our WIT)
+    "RUSTSEC-2026-0092", # GHSA-jxhv-7h78-9775: panic on misaligned UTF-16 strings (cross-component only)
+    "RUSTSEC-2026-0093", # GHSA-hx6p-xpx3-jvvv: heap OOB read in UTF-16 transcoding (cross-component only)
+    #
+    # Guest realloc validation (single-component host-guest interaction; low risk given UDFs are disabled):
+    "RUSTSEC-2026-0091", # GHSA-394w-hwhg-8vgm: OOB write from unvalidated guest realloc
+    #
+    # TODO: update wasmtime via datafusion-udf-wasm to a patched version (>=42.0.2)
 ]
 git-fetch-with-cli = true
 
```

---

### Incident Patch 13: `79a63cc7` (2026-04-02)
**Commit Message**: chore(sync): influxdb_pro 2026-04-01 (#27327)

**File**: `.circleci/config.yml` (modified, +3/-3)
```diff
@@ -423,15 +423,15 @@ jobs:
             - run:
                 name: Check extra features (like prod image)
                 command: |
-                  target-env cargo check --target=<< parameters.target >> --no-default-features --features="aws,gcp,azure,jemalloc_replacing_malloc,tokio_console"
+                  target-env cargo check --target=<< parameters.target >> --no-default-features --features="aws,gcp,azure,jemalloc_replacing_malloc,tokio_console,large-strings"
       - when:
           condition:
             equal: [ << parameters.target >>, x86_64-pc-windows-gnu ]
           steps:
             - run:
                 name: Check extra features (like prod image)
                 command: |
-                  target-env cargo check --target=<< parameters.target >> --no-default-features --features="aws,gcp,azure,jemalloc_replacing_malloc,tokio_console"
+                  target-env cargo check --target=<< parameters.target >> --no-default-features --features="aws,gcp,azure,jemalloc_replacing_malloc,tokio_console,large-strings"
 
   # Compile cargo "release" profile binaries for influxdb3 edge releases
   build-release:
@@ -693,7 +693,7 @@ jobs:
           command: |
             .circleci/scripts/docker_build_release.bash \
               "influxdb3" \
-              "aws,gcp,azure,jemalloc_replacing_malloc,tokio_console" \
+              "aws,gcp,azure,jemalloc_replacing_malloc,tokio_console,large-strings" \
               "<< parameters.image_name >>:latest-<< parameters.platform >>" \
               "$PBS_DATE" \
               "$PBS_VERSION" \
```

**File**: `Cargo.lock` (modified, +101/-87)
```diff
@@ -468,7 +468,7 @@ dependencies = [
 
 [[package]]
 name = "arrow_util"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "ahash 0.8.12",
  "arrow",
@@ -565,7 +565,7 @@ checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"
 
 [[package]]
 name = "authz"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "assert_matches",
  "async-trait",
@@ -679,7 +679,7 @@ dependencies = [
 
 [[package]]
 name = "backoff"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "rand 0.9.2",
  "snafu 0.9.0",
@@ -1092,7 +1092,7 @@ checksum = "37b2a672a2cb129a2e41c10b1224bb368f9f37a2b16b612598138befd7b37eb5"
 
 [[package]]
 name = "catalog_cache"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "bytes",
  "criterion 0.8.2",
@@ -1230,7 +1230,7 @@ checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
 
 [[package]]
 name = "client_util"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "http 1.4.0",
  "iox_http_util",
@@ -1800,7 +1800,7 @@ dependencies = [
 
 [[package]]
 name = "data_types"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "arrow",
  "arrow-buffer",
@@ -2534,7 +2534,7 @@ dependencies = [
 
 [[package]]
 name = "datafusion_util"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "assert_matches",
  "async-trait",
@@ -2618,7 +2618,7 @@ dependencies = [
 
 [[package]]
 name = "dml"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "arrow_util",
  "data_types",
@@ -2730,7 +2730,7 @@ dependencies = [
 
 [[package]]
 name = "error_reporting"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "datafusion",
  "snafu 0.9.0",
@@ -2760,7 +2760,7 @@ dependencies = [
 
 [[package]]
 name = "executor"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "futures",
  "metric",
@@ -2841,7 +2841,7 @@ dependencies = [
 
 [[package]]
 name = "flightsql"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "arrow",
  "arrow-flight",
@@ -3045,7 +3045,7 @@ dependencies = [
 
 [[package]]
 name = "futures_test_utils"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "clap",
  "futures",
@@ -3056,7 +3056,7 @@ dependencies = [
 
 [[package]]
 name = "generated_types"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "bytes",
  "pbjson",
@@ -3705,7 +3705,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb2_client"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "bytes",
  "futures",
@@ -3724,7 +3724,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "anyhow",
  "arrow",
@@ -3814,7 +3814,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_authz"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "async-trait",
  "authz",
@@ -3831,7 +3831,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_cache"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "anyhow",
  "arrow",
@@ -3866,7 +3866,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_catalog"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "anyhow",
  "arrow",
@@ -3918,7 +3918,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_clap_blocks"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "async-trait",
  "bytes",
@@ -3936,6 +3936,7 @@ dependencies = [
  "metric",
  "non-empty-string",
  "object_store",
+ "object_store_limit",
  "observability_deps",
  "paste",
  "serde",
@@ -3947,13 +3948,14 @@ dependencies = [
  "test_helpers",
  "tokio",
  "trace_exporters",
+ "tracker",
  "trogging",
  "url",
 ]
 
 [[package]]
 name = "influxdb3_client"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "bytes",
  "hashbrown 0.14.5",
@@ -3973,7 +3975,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_commands"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "anyhow",
  "clap",
@@ -3992,7 +3994,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_id"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "indexmap 2.13.0",
  "serde",
@@ -4002,7 +4004,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_internal_api"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -4023,7 +4025,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_load_generator"
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 dependencies = [
  "anyhow",
  "bytes",
@@ -4052,15 +4054,15 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_process"
-version = "3.10.0-nightly"
+version = "3.10.0
```

**File**: `Cargo.toml` (modified, +2/-1)
```diff
@@ -24,6 +24,7 @@ members = [
     "influxdb3_types",
     "influxdb3_wal",
     "influxdb3_write",
+    "object_store_limit",
     "object_store_utils",
     "core/arrow_util",
     "core/authz",
@@ -124,7 +125,7 @@ exclude = [
 #
 # For porting to the actual OSS repo (influxdb), this would need to change to `-nightly`, i.e., by
 # stripping the `-oss`.
-version = "3.10.0-nightly"
+version = "3.10.0-oss-nightly"
 authors = ["InfluxData OSS Developers"]
 edition = "2024"
 license = "MIT OR Apache-2.0"
```

**File**: `core/arrow_util/src/test_util.rs` (modified, +23/-11)
```diff
@@ -239,11 +239,18 @@ static REGEX_METRICS: LazyLock<Regex> =
 static REGEX_TIMING: LazyLock<Regex> =
     LazyLock::new(|| Regex::new(r"[0-9]+(\.[0-9]+)?.s").expect("timing regex"));
 
-/// Matches things like `FilterExec: .*` and `DataSourceExec: .*`
+/// Matches things like `FilterExec: .*`, `DataSourceExec: .*`, `Filter: .*`,
+/// and `TableScan: .*`
 ///
-/// Should be used in combination w/ [`REGEX_TIME_OP`].
+/// Should be used in combination w/ [`REGEX_TIME_OP`] and [`REGEX_TIMESTAMP_NANOSECOND`].
 static REGEX_FILTER: LazyLock<Regex> = LazyLock::new(|| {
-    Regex::new("(?P<prefix>(FilterExec)|(DataSourceExec): )(?P<expr>.*)").expect("filter regex")
+    Regex::new("(?P<prefix>(FilterExec)|(DataSourceExec)|(Filter)|(TableScan): )(?P<expr>.*)")
+        .expect("filter regex")
+});
+
+/// Matches things like `TimestampNanosecond(1773673285696531000, None)` in logical plan output
+static REGEX_TIMESTAMP_NANOSECOND: LazyLock<Regex> = LazyLock::new(|| {
+    Regex::new(r"TimestampNanosecond\(\s*(?P<value>-?[0-9]+)").expect("timestamp nanosecond regex")
 });
 
 /// Matches things like `time@3 < -9223372036854775808` and `time_min@2 > 1641031200399937022`
@@ -263,12 +270,13 @@ pub fn strip_table_lines(s: Cow<'_, str>) -> String {
 }
 
 fn normalize_time_ops(s: &str) -> String {
-    REGEX_TIME_OP
-        .replace_all(s, |c: &Captures<'_>| {
-            let prefix = c.name("prefix").expect("always captures").as_str();
-            let suffix = c.name("suffix").map_or("", |m| m.as_str());
-            format!("{prefix}<REDACTED>{suffix}")
-        })
+    let s = REGEX_TIME_OP.replace_all(s, |c: &Captures<'_>| {
+        let prefix = c.name("prefix").expect("always captures").as_str();
+        let suffix = c.name("suffix").map_or("", |m| m.as_str());
+        format!("{prefix}<REDACTED>{suffix}")
+    });
+    REGEX_TIMESTAMP_NANOSECOND
+        .replace_all(&s, "TimestampNanosecond(<REDACTED>")
         .to_string()
 }
 
@@ -463,11 +471,15 @@ impl Normalizer {
         //
         // Converts:
         // FilterExec: time@2 < -9223372036854775808 OR time@2 > 1640995204240217000
-        // DataSourceExec: limit=None, partitions={...}, predicate=time@2 > 1640995204240217000, pruning_predicate=time@2 > 1640995204240217000, output_ordering=[...], projection=[...]
+        // DataSourceExec: limit=None, partitions={...}, predicate=time@2 > 1640995204240217000, ...
+        // Filter: m0.time >= TimestampNanosecond(1773673285696531000, None)
+        // TableScan: m0 projection=[tag0, time], partial_filters=[m0.time >= TimestampNanosecond(1773673285696531000, None)]
         //
         // to
         // FilterExec: time@2 < <REDACTED> OR time@2 > <REDACTED>
-        // DataSourceExec: limit=None, partitions={...}, predicate=time@2 > <REDACTED>, pruning_predicate=time@2 > <REDACTED>, output_ordering=[...], projection=[...]
+        // DataSourceExec: limit=None, partitions={...}, predicate=time@2 > <REDACTED>, ...
+        // Filter: m0.time >= TimestampNanosecond(<REDACTED>, None)
+        // TableScan: m0 projection=[tag0, time], partial_filters=[m0.time >= TimestampNanosecond(<REDACTED>, None)]
         if *normalized_filters {
             current_results = current_results
                 .into_iter()
```

**File**: `core/generated_types/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+.flatbuffers
+
```

**File**: `core/influxdb_line_protocol/fuzz/.gitignore` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+target
+corpus
+artifacts
+coverage
```

**File**: `core/metric/src/gauge.rs` (modified, +7/-0)
```diff
@@ -45,6 +45,13 @@ impl U64Gauge {
         }
     }
 
+    /// Atomically updates this gauge to `max(current, val)`.
+    ///
+    /// Returns the previous value.
+    pub fn fetch_max(&self, val: u64) -> u64 {
+        self.state.fetch_max(val, Ordering::Relaxed)
+    }
+
     /// Fetches the value of this U64Gauge
     pub fn fetch(&self) -> u64 {
         self.state.load(Ordering::Relaxed)
```

**File**: `core/mutable_batch_lp/fuzz/.gitignore` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+target
+corpus
+artifacts
+coverage
```

---

### Incident Patch 14: `9ce7a441` (2026-03-27)
**Commit Message**: chore(sync): influxdb_pro 2026-03-27 (#27310)

Source: a50ca428dae3024ef99aa0c2eee4c51ada4bed0e

Co-authored-by: Cannon Palms <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Jack <[REDACTED_EMAIL]>
Co-authored-by: Jamie Strandboge <[REDACTED_EMAIL]>
Co-authored-by: Michael Gattozzi <[REDACTED_EMAIL]>
Co-authored-by: Phil Bracikowski <[REDACTED_EMAIL]>
Co-authored-by: Reid Hansen <[REDACTED_EMAIL]>
Co-authored-by: Stuart Carnie <[REDACTED_EMAIL]>
Co-authored-by: wayne <[REDACTED_EMAIL]>

**File**: `.cargo/config.toml` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+include = [
+    { path = "config.local.toml", optional = true },
+]
+
 # Local development overrides for Linux with lld
 # These flags are commented out by target-env in CI builds
 
```

**File**: `.circleci/packages/influxdb3/fs/usr/lib/influxdb3/influxdb3-launcher` (modified, +20/-24)
```diff
@@ -42,10 +42,6 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
         "http-bind": "INFLUXDB3_HTTP_BIND_ADDR",
         "node-id": "INFLUXDB3_NODE_IDENTIFIER_PREFIX",
         "node-id-from-env": "INFLUXDB3_NODE_IDENTIFIER_FROM_ENV",
-        # Logging (no INFLUXDB3_ prefix)
-        "log-destination": "LOG_DESTINATION",
-        "log-filter": "LOG_FILTER",
-        "log-format": "LOG_FORMAT",
         # Admin token recovery
         "admin-token-recovery-http-bind": "INFLUXDB3_ADMIN_TOKEN_RECOVERY_HTTP_BIND_ADDR",
         # Authorization
@@ -73,16 +69,16 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
         "azure-storage-account": "AZURE_STORAGE_ACCOUNT",
         # Google Cloud (GOOGLE_ prefix, not INFLUXDB3_)
         "google-service-account": "GOOGLE_SERVICE_ACCOUNT",
-        # Object store (OBJECT_STORE_ prefix, not INFLUXDB3_)
-        "object-store-cache-endpoint": "OBJECT_STORE_CACHE_ENDPOINT",
-        "object-store-connection-limit": "OBJECT_STORE_CONNECTION_LIMIT",
-        "object-store-http2-only": "OBJECT_STORE_HTTP2_ONLY",
-        "object-store-http2-max-frame-size": "OBJECT_STORE_HTTP2_MAX_FRAME_SIZE",
-        "object-store-max-retries": "OBJECT_STORE_MAX_RETRIES",
-        "object-store-request-timeout": "OBJECT_STORE_REQUEST_TIMEOUT",
-        "object-store-retry-timeout": "OBJECT_STORE_RETRY_TIMEOUT",
-        "object-store-tls-allow-insecure": "OBJECT_STORE_TLS_ALLOW_INSECURE",
-        "object-store-tls-ca": "OBJECT_STORE_TLS_CA",
+        # Object store
+        "object-store-cache-endpoint": "INFLUXDB3_OBJECT_STORE_CACHE_ENDPOINT",
+        "object-store-connection-limit": "INFLUXDB3_OBJECT_STORE_CONNECTION_LIMIT",
+        "object-store-http2-only": "INFLUXDB3_OBJECT_STORE_HTTP2_ONLY",
+        "object-store-http2-max-frame-size": "INFLUXDB3_OBJECT_STORE_HTTP2_MAX_FRAME_SIZE",
+        "object-store-max-retries": "INFLUXDB3_OBJECT_STORE_MAX_RETRIES",
+        "object-store-request-timeout": "INFLUXDB3_OBJECT_STORE_REQUEST_TIMEOUT",
+        "object-store-retry-timeout": "INFLUXDB3_OBJECT_STORE_RETRY_TIMEOUT",
+        "object-store-tls-allow-insecure": "INFLUXDB3_OBJECT_STORE_TLS_ALLOW_INSECURE",
+        "object-store-tls-ca": "INFLUXDB3_OBJECT_STORE_TLS_CA",
         # Processing engine
         "virtual-env-location": "VIRTUAL_ENV",
         # WAL
@@ -91,16 +87,16 @@ TOML_KEY_ENVVAR: Dict[str, Dict[str, str]] = {
         "tokio-console-enabled": "TOKIO_CONSOLE_ENABLED",
         "tokio-console-client-buffer-capacity": "TOKIO_CONSOLE_CLIENT_BUFFER_CAPACITY",
         "tokio-console-event-buffer-capacity": "TOKIO_CONSOLE_EVENT_BUFFER_CAPACITY",
-        # Tracing (TRACES_ prefix, not INFLUXDB3_)
-        "traces-exporter": "TRACES_EXPORTER",
-        "traces-exporter-jaeger-agent-host": "TRACES_EXPORTER_JAEGER_AGENT_HOST",
-        "traces-exporter-jaeger-agent-port": "TRACES_EXPORTER_JAEGER_AGENT_PORT",
-        "traces-exporter-jaeger-debug-name": "TRACES_EXPORTER_JAEGER_DEBUG_NAME",
-        "traces-exporter-jaeger-service-name": "TRACES_EXPORTER_JAEGER_SERVICE_NAME",
-        "traces-exporter-jaeger-trace-context-header-name": "TRACES_EXPORTER_JAEGER_TRACE_CONTEXT_HEADER_NAME",
-        "traces-jaeger-debug-name": "TRACES_EXPORTER_JAEGER_DEBUG_NAME",
-        "traces-jaeger-max-msgs-per-second": "TRACES_JAEGER_MAX_MSGS_PER_SECOND",
-        "traces-jaeger-tags": "TRACES_EXPORTER_JAEGER_TAGS",
+        # Tracing
+        "traces-exporter": "INFLUXDB3_TRACES_EXPORTER",
+        "traces-exporter-jaeger-agent-host": "INFLUXDB3_TRACES_EXPORTER_JAEGER_AGENT_HOST",
+        "traces-exporter-jaeger-agent-port": "INFLUXDB3_TRACES_EXPORTER_JAEGER_AGENT_PORT",
+        "traces-exporter-jaeger-debug-name": "INFLUXDB3_TRACES_EXPORTER_JAEGER_DEBUG_NAME",
+        "traces-exporter-jaeger-service-name": "INFLUXDB3_TRACES_EXPORTER_JAEGER_SERVICE_NAME",
+        "traces-exporter-jaeger-trace-context-header-name": "INFLUXDB3_TRACES_EXPORTER_JAEGER_TRACE_CONTEXT_HEADER_NAME",
+        "traces-jaeger-debug-name": "INFLUXDB3_TRACES_EXPORTER_JAEGER_DEBUG_NAME",
+        "traces-jaeger-max-msgs-per-second": "INFLUXDB3_TRACES_JAEGER_MAX_MSGS_PER_SECOND",
+        "traces-jaeger-tags": "INFLUXDB3_TRACES_EXPORTER_JAEGER_TAGS",
     },
     "core": {
         # Core-specific mappings (currently none - all are in common)
```

**File**: `.circleci/packages/influxdb3/fs/usr/share/influxdb3/influxdb3-core.conf` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@
 # (env: LOG_FILTER)
 #log-filter="info,iox_query::query_log=warn,influxdb3_query_executor::core=warn"
 
+# Disable automatic noise-reduction expansion of debug/trace log filters
+# Default: false (env: INFLUXDB3_DISABLE_LOG_FILTER_NOISE_REDUCTION)
+#disable-log-filter-noise-reduction=false
+
 # =============================================================================
 # Security
 # =============================================================================
```

**File**: `.circleci/packages/test_influxdb3-launcher.py` (modified, +2/-2)
```diff
@@ -304,15 +304,15 @@ def test_core_flavor_mappings(self):
         config_path = self._write_toml_config(
             'object-store = "file"\n'
             'http-bind = "0.0.0.0:8086"\n'
-            'log-filter = "info"\n'
+            'virtual-env-location = "/path/to/venv"\n'
         )
         env_vars = self.launcher.read_config_toml(config_path, "core")
         self.assertEqual(
             env_vars,
             {
                 "INFLUXDB3_OBJECT_STORE": "file",
                 "INFLUXDB3_HTTP_BIND_ADDR": "0.0.0.0:8086",
-                "LOG_FILTER": "info",
+                "VIRTUAL_ENV": "/path/to/venv",
             },
         )
 
```

**File**: `.circleci/scripts/fetch-python-standalone.bash` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ readonly PBS_TOP_DIR="/tmp/workspace"
 # - https://github.com/astral-sh/python-build-standalone/blob/main/docs/running.rst
 # - https://edu.chainguard.dev/chainguard/chainguard-images/about/images-compiled-programs/glibc-vs-musl/#python-builds
 # - https://pythonspeed.com/articles/alpine-docker-python/
-readonly TARGETS="aarch64-apple-darwin aarch64-unknown-linux-gnu x86_64-unknown-linux-gnu x86_64-pc-windows-msvc"
+readonly TARGETS="${TARGETS:-aarch64-apple-darwin aarch64-unknown-linux-gnu x86_64-unknown-linux-gnu x86_64-pc-windows-msvc}"
 
 fetch() {
     target="$1"
```

**File**: `Cargo.lock` (modified, +41/-33)
```diff
@@ -876,20 +876,19 @@ checksum = "92ca28db4dacf55b7a764e73c12fc191ccbc0707a3804fc2e5da72fe22b14b47"
 
 [[package]]
 name = "borsh"
-version = "1.6.1"
+version = "1.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cfd1e3f8955a5d7de9fab72fc8373fade9fb8a703968cb200ae3dc6cf08e185a"
+checksum = "d1da5ab77c1437701eeff7c88d968729e7766172279eab0676857b3d63af7a6f"
 dependencies = [
  "borsh-derive",
- "bytes",
  "cfg_aliases",
 ]
 
 [[package]]
 name = "borsh-derive"
-version = "1.6.1"
+version = "1.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bfcfdc083699101d5a7965e49925975f2f55060f94f9a05e7187be95d530ca59"
+checksum = "0686c856aa6aac0c4498f936d7d6a02df690f614c03e4d906d1018062b5c5e2c"
 dependencies = [
  "once_cell",
  "proc-macro-crate",
@@ -1821,6 +1820,7 @@ dependencies = [
  "prost 0.14.3",
  "rand 0.9.2",
  "schema",
+ "serde",
  "serde_json",
  "sha2",
  "siphasher",
@@ -3758,6 +3758,7 @@ dependencies = [
  "influxdb3_query_executor",
  "influxdb3_server",
  "influxdb3_shutdown",
+ "influxdb3_startup",
  "influxdb3_sys_events",
  "influxdb3_system_tables",
  "influxdb3_telemetry",
@@ -4277,6 +4278,13 @@ dependencies = [
  "tokio-util",
 ]
 
+[[package]]
+name = "influxdb3_startup"
+version = "3.10.0-nightly"
+dependencies = [
+ "chrono",
+]
+
 [[package]]
 name = "influxdb3_sys_events"
 version = "3.10.0-nightly"
@@ -4788,9 +4796,9 @@ checksum = "d98f6fed1fde3f8c21bc40a1abb88dd75e67924f9cffc3ef95607bad8017f8e2"
 
 [[package]]
 name = "iri-string"
-version = "0.7.11"
+version = "0.7.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d8e7418f59cc01c88316161279a7f665217ae316b388e58a0d10e29f54f1e5eb"
+checksum = "c91338f0783edbd6195decb37bae672fd3b165faffb89bf7b9e6942f8b1a731a"
 dependencies = [
  "memchr",
  "serde",
@@ -4851,9 +4859,9 @@ dependencies = [
 
 [[package]]
 name = "itoa"
-version = "1.0.18"
+version = "1.0.17"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682"
+checksum = "92ecc6618181def0457392ccd0ee51198e065e016d1d527a7ac1b6dc7c1f09d2"
 
 [[package]]
 name = "jemalloc_stats"
@@ -6359,9 +6367,9 @@ dependencies = [
 
 [[package]]
 name = "pulldown-cmark"
-version = "0.13.3"
+version = "0.13.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7c3a14896dfa883796f1cb410461aef38810ea05f2b2c33c5aded3649095fdad"
+checksum = "83c41efbf8f90ac44de7f3a868f0867851d261b56291732d0cbf7cceaaeb55a6"
 dependencies = [
  "bitflags 2.11.0",
  "memchr",
@@ -8328,32 +8336,32 @@ dependencies = [
 
 [[package]]
 name = "toml_datetime"
-version = "1.0.1+spec-1.1.0"
+version = "1.0.0+spec-1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9b320e741db58cac564e26c607d3cc1fdc4a88fd36c879568c07856ed83ff3e9"
+checksum = "32c2555c699578a4f59f0cc68e5116c8d7cabbd45e1409b989d4be085b53f13e"
 dependencies = [
  "serde_core",
 ]
 
 [[package]]
 name = "toml_edit"
-version = "0.25.5+spec-1.1.0"
+version = "0.25.4+spec-1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8ca1a40644a28bce036923f6a431df0b34236949d111cc07cb6dca830c9ef2e1"
+checksum = "7193cbd0ce53dc966037f54351dbbcf0d5a642c7f0038c382ef9e677ce8c13f2"
 dependencies = [
  "indexmap 2.13.0",
  "toml_datetime",
  "toml_parser",
- "winnow 1.0.0",
+ "winnow 0.7.15",
 ]
 
 [[package]]
 name = "toml_parser"
-version = "1.0.10+spec-1.1.0"
+version = "1.0.9+spec-1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7df25b4befd31c4816df190124375d5a20c6b6921e2cad937316de3fccd63420"
+checksum = "702d4415e08923e7e1ef96cd5727c0dfed80b4d2fa25db9647fe5eb6f7c5a4c4"
 dependencies = [
- "winnow 1.0.0",
+ "winnow 0.7.15",
 ]
 
 [[package]]
@@ -8808,9 +8816,9 @@ checksum = "6d49784317cd0d1ee7ec5c716dd598ec5b4483ea832a2dced265471cc0f690ae"
 
 [[package]]
 name = "ureq"
-version = "3.3.0"
+version = "3.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dea7109cdcd5864d4eeb1b58a1648dc9bf520360d7af16ec26d0a9354bafcfc0"
+checksum = "fdc97a28575b85cfedf2a7e7d3cc64b3e11bd8ac766666318003abbacc7a21fc"
 dependencies = [
  "base64 0.22.1",
  "flate2",
@@ -8819,15 +8827,15 @@ dependencies = [
  "rustls 0.23.37",
  "rustls-pki-types",
  "ureq-proto",
- "utf8-zero",
+ "utf-8",
  "webpki-roots 1.0.6",
 ]
 
 [[package]]
 name = "ureq-proto"
-version = "0.6.0"
+version = "0.5.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e994ba84b0bd1b1b0cf92878b7ef898a5c1760108fe7b6010327e274917a808c"
+checksum = "d81f9efa9df032be5934a46a068815a10a042b494b6a58cb0a1a97bb5467ed6f"
 dependencies = [
  "base64 0.22.1",
  "http 1.4.0",
@@ -8854,10 +8862,10 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5a1f0175e03a0973cf4afd476bef05c26e228520400eb1fd473ad417b1c00ffb"
 
 [[package]]
-name = "utf8-zero"
-versi
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ members = [
     "influxdb3_query_executor",
     "influxdb3_server",
     "influxdb3_shutdown",
+    "influxdb3_startup",
     "influxdb3_system_tables",
     "influxdb3_telemetry",
     "influxdb3_test_helpers",
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ COPY docker/entrypoint.sh /usr/bin/entrypoint.sh
 
 EXPOSE 8181
 
-ENV LOG_FILTER=info
+ENV INFLUXDB3_LOG_FILTER=info
 
 ENTRYPOINT ["/usr/bin/entrypoint.sh"]
 
```

---

### Incident Patch 15: `2a8d742c` (2026-03-24)
**Commit Message**: fix: restore main version to 3.10.0-nightly (#27300)

**File**: `Cargo.lock` (modified, +84/-84)
```diff
@@ -468,7 +468,7 @@ dependencies = [
 
 [[package]]
 name = "arrow_util"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "ahash 0.8.12",
  "arrow",
@@ -565,7 +565,7 @@ checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"
 
 [[package]]
 name = "authz"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "assert_matches",
  "async-trait",
@@ -679,7 +679,7 @@ dependencies = [
 
 [[package]]
 name = "backoff"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "rand 0.9.2",
  "snafu 0.9.0",
@@ -1093,7 +1093,7 @@ checksum = "37b2a672a2cb129a2e41c10b1224bb368f9f37a2b16b612598138befd7b37eb5"
 
 [[package]]
 name = "catalog_cache"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "bytes",
  "criterion 0.8.2",
@@ -1231,7 +1231,7 @@ checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
 
 [[package]]
 name = "client_util"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "http 1.4.0",
  "iox_http_util",
@@ -1801,7 +1801,7 @@ dependencies = [
 
 [[package]]
 name = "data_types"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "arrow",
  "arrow-buffer",
@@ -2534,7 +2534,7 @@ dependencies = [
 
 [[package]]
 name = "datafusion_util"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "assert_matches",
  "async-trait",
@@ -2618,7 +2618,7 @@ dependencies = [
 
 [[package]]
 name = "dml"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "arrow_util",
  "data_types",
@@ -2730,7 +2730,7 @@ dependencies = [
 
 [[package]]
 name = "error_reporting"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "datafusion",
  "snafu 0.9.0",
@@ -2760,7 +2760,7 @@ dependencies = [
 
 [[package]]
 name = "executor"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "futures",
  "metric",
@@ -2841,7 +2841,7 @@ dependencies = [
 
 [[package]]
 name = "flightsql"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "arrow",
  "arrow-flight",
@@ -3045,7 +3045,7 @@ dependencies = [
 
 [[package]]
 name = "futures_test_utils"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "clap",
  "futures",
@@ -3056,7 +3056,7 @@ dependencies = [
 
 [[package]]
 name = "generated_types"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "bytes",
  "pbjson",
@@ -3705,7 +3705,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb2_client"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "bytes",
  "futures",
@@ -3724,7 +3724,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
  "arrow",
@@ -3813,7 +3813,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_authz"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "async-trait",
  "authz",
@@ -3830,7 +3830,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_cache"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
  "arrow",
@@ -3865,7 +3865,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_catalog"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
  "arrow",
@@ -3917,7 +3917,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_clap_blocks"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "async-trait",
  "bytes",
@@ -3952,7 +3952,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_client"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "bytes",
  "hashbrown 0.14.5",
@@ -3972,7 +3972,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_commands"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
  "clap",
@@ -3991,7 +3991,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_id"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "indexmap 2.13.0",
  "serde",
@@ -4001,7 +4001,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_internal_api"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -4022,7 +4022,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_load_generator"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
  "bytes",
@@ -4051,15 +4051,15 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_process"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "iox_time",
  "uuid",
 ]
 
 [[package]]
 name = "influxdb3_processing_engine"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -4103,7 +4103,7 @@ dependencies = [
 
 [[package]]
 name = "influxdb3_py_api"
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 dependencies = [
  "anyhow",
  "arrow-array",
@@ -413
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ exclude = [
 #
 # For porting to the actual OSS repo (influxdb), this would need to change to `-nightly`, i.e., by
 # stripping the `-oss`.
-version = "3.9.0-0.rc.5"
+version = "3.10.0-nightly"
 authors = ["InfluxData OSS Developers"]
 edition = "2024"
 license = "MIT OR Apache-2.0"
```

#### Recent Merged Pull Requests:
- **PR #27682** (2026-10-02): fix: Add fallback to direct downloads for goproxy failures (#27676) (@devanbenz)
- **PR #27681** (2026-10-01): chore(ui): Update influxdb UI to OSS-v2.10.0 (@devanbenz)
- **PR #27680** (2026-10-01): chore(sync): influxdb_pro 2026-10-01 (3.12) (@praveen-influx)
- **PR #27679** (2026-10-03): feat: report /health and /ready numbers as structured JSON fields (@davidby-influx)
- **PR #27678** (2026-09-30): chore(ci): add republish workflow for re-publishing a release tag (#2… (@devanbenz)
- **PR #27677** (2026-09-30): ci: push release artifacts to Cloudflare R2 instead of AWS S3 (#27595) (@devanbenz)
- **PR #27676** (2026-10-01): fix: Add fallback to direct downloads for goproxy failures (@devanbenz)
- **PR #27675** (2026-09-30): fix: require unique nonempty check names (@davidby-influx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
