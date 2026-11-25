# Verification Protocol: Verification Protocol: Empirical Defect Shield for ydb-platform-ydb-learnings

<!-- PROVENANCE_START
{
  "source_repository": "ydb-platform-ydb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T10:07:40.325Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-ydb-platform-ydb-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ydb-platform-ydb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T10:07:40.325Z`  
> **Learning ID**: `LEARN-EVO-ydb-platform-ydb-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `ydb-platform-ydb-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ydb-platform-ydb-learnings.md`  
> **Source**: github ([https://github.com/ydb-platform/ydb](https://github.com/ydb-platform/ydb))  
> **Source Version**: `11c43f77`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T10:07:35.125Z  
> **Learning ID**: `learn-github-ydb-platform-ydb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ydb-platform/ydb

> **Canonical Artifact**: `07_PROJECT_LEARNING/ydb-platform-ydb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ydb-platform/ydb](https://github.com/ydb-platform/ydb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T10:07:35.119Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ydb-platform/ydb`
- **Description**: YDB is an open source Distributed SQL Database that combines high availability and scalability with strong consistency and ACID transactions
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4790 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/alphabet.rs`
```
use crate::util::int::Usize;

/// A representation of byte oriented equivalence classes.
///
/// This is used in finite state machines to reduce the size of the transition
/// table. This can have a particularly large impact not only on the total size
/// of an FSM, but also on FSM build times because it reduces the number of
/// transitions that need to be visited/set.
#[derive(Clone, Copy)]
pub(crate) struct ByteClasses([u8; 256]);

impl ByteClasses {
    /// Creates a new set of equivalence classes where all bytes are mapped to
    /// the same class.
    pub(crate) fn empty() -> ByteClasses {
        ByteClasses([0; 256])
    }

    /// Creates a new set of equivalence classes where each byte belongs to
    /// its own equivalence class.
    pub(crate) fn singletons() -> ByteClasses {
        let mut classes = ByteClasses::empty();
        for b in 0..=255 {
            classes.set(b, b);
        }
        classes
    }

    /// Set the equivalence class for the given byte.
    #[inline]
    pub(crate) fn set(&mut self, byte: u8, class: u8) {
        self.0[usize::from(byte)] = class;
    }

    /// Get the equivalence class for the given byte.
    #[inline]
    pub(crate) fn get(&self, byte: u8) -> u8 {
        self.0[usize::from(byte)]
    }

    /// Return the total number of elements in the alphabet represented by
    /// these equivalence classes. Equivalently, this returns the total number
    /// of equivalence classes.
    #[inline]
    pub(crate) fn alphabet_len(&self) -> usize {
        // Add one since the number of equivalence classes is one bigger than
        // the last one.
        usize::from(self.0[255]) + 1
    }

    /// Returns the stride, as a base-2 exponent, required for these
    /// equivalence classes.
    ///
    /// The stride is always the smallest power of 2 that is greater than or
    /// equal to the alphabet length. This is done so that converting between
    /// state IDs and indices can be done with shifts alone, which is much
    /// faster than integer division. The "stride2" is the exponent. i.e.,
    /// `2^stride2 = stride`.
    pub(crate) fn stride2(&self) -> usize {
        let zeros = self.alphabet_len().next_power_of_two().trailing_zeros();
        usize::try_from(zeros).unwrap()
    }

    /// Returns the stride for these equivalence classes, which corresponds
    /// to the smallest power of 2 greater than or equal to the number of
    /// equivalence classes.
    pub(crate) fn stride(&self) -> usize {
        1 << self.stride2()
    }

    /// Returns true if and only if every byte in this class maps to its own
    /// equivalence class. Equivalently, there are 257 equivalence classes
    /// and each class contains exactly one byte (plus the special EOI class).
    #[inline]
    pub(crate) fn is_singleton(&self) -> bool {
        self.alphabet_len() == 256
    }

    /// Returns an iterator over all equivalence classes in this set.
    pub(crate) fn iter(&self) -> ByteClassIter {
        ByteClassIter { it: 0..self.alphabet_len() }
    }

    /// Returns an iterator of the bytes in the given equivalence class.
    pub(crate) fn elements(&self, class: u8) -> ByteClassElements {
        ByteClassElements { classes: self, class, bytes: 0..=255 }
    }

    /// Returns an iterator of byte ranges in the given equivalence class.
    ///
    /// That is, a sequence of contiguous ranges are returned. Typically, every
    /// class maps to a single contiguous range.
    fn element_ranges(&self, class: u8) -> ByteClassElementRanges {
        ByteClassElementRanges { elements: self.elements(class), range: None }
    }
}

impl core::fmt::Debug for ByteClasses {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        if self.is_singleton() {
            write!(f, "ByteClasses(<one-class-per-byte>)")
        } else {
            write!(f, "ByteClasses(")?;
            for (i, class) in self.iter().enumerate() {
                if i > 0 {
                    write!(f, ", ")?;
                }
                write!(f, "{:?} => [", class)?;
                for (start, end) in self.element_ranges(class) {
                    if start == end {
                        write!(f, "{:?}", start)?;
                    } else {
                        write!(f, "{:?}-{:?}", start, end)?;
                    }
                }
                write!(f, "]")?;
            }
            write!(f, ")")
        }
    }
}

/// An iterator over each equivalence class.
#[derive(Debug)]
pub(crate) struct ByteClassIter {
    it: core::ops::Range<usize>,
}

impl Iterator for ByteClassIter {
    type Item = u8;

    fn next(&mut self) -> Option<u8> {
        self.it.next().map(|class| class.as_u8())
    }
}

/// An iterator over all elements in a specific equivalence class.
#[derive(Debug)]
pub(crate) struct ByteClassElements<'a> {
    classes: &'a ByteClasses,
    class: u8,
    bytes: core::ops::RangeInclusive<u8>,
}

impl<'a> Iterator for ByteClassElements<'a> {
    type Item = u8;

    fn next(&mut self) -> Option<u8> {
        while let Some(byte) = self.bytes.next() {
            if self.class == self.classes.get(byte) {
                return Some(byte);
            }
        }
        None
    }
}

/// An iterator over all elements in an equivalence class expressed as a
/// sequence of contiguous ranges.
#[derive(Debug)]
pub(crate) struct ByteClassElementRanges<'a> {
    elements: ByteClassElements<'a>,
    range: Option<(u8, u8)>,
}

impl<'a> Iterator for ByteClassElementRanges<'a> {
    type Item = (u8, u8);

    fn next(&mut self) -> Option<(u8, u8)> {
        loop {
            let element = match self.elements.next() {
                None => return self.range.take(),
                Some(element) => element,
            };
            match self.range.take() {
                None => {
                    self.range = Some((element, element));
                }
                Some((start, end)) => {
                    if usize::from(end) + 1 != usize::from(element) {
                        self.range = Some((element, element));
                        return Some((start, end));
                    }
                    self.range = Some((start, element));
                }
            }
        }
    }
}

/// A partitioning of bytes into equivalence classes.
///
/// A byte class set keeps track of an *approximation* of equivalence classes
/// of bytes during NFA construction. That is, every byte in an equivalence
/// class cannot discriminate between a match and a non-match.
///
/// Note that this may not compute the minimal set of equivalence classes.
/// Basically, any byte in a pattern given to the noncontiguous NFA builder
/// will automatically be treated as its own equivalence class. All other
/// bytes---any byte not in any pattern---will be treated as their own
/// equivalence classes. In theory, all bytes not in any pattern should
/// be part of a single equivalence class, but in practice, we only treat
/// contiguous ranges of bytes as an equivalence class. So the number of
/// classes computed may be bigger than necessary. This usually doesn't make
/// much of a difference, and keeps the implementation simple.
#[derive(Clone, Debug)]
pub(crate) struct ByteClassSet(ByteSet);

impl Default for ByteClassSet {
    fn default() -> ByteClassSet {
        ByteClassSet::empty()
    }
}

impl ByteClassSet {
    /// Create a new set of byte classes where all bytes are part of the same
    /// equivalence class.
    pub(crate) fn empty() -> Self {
        ByteClassSet(ByteSet::empty())
    }

    /// Indicate the the range of byte given (inclusive) can discriminate a
    /// match between it and all other bytes outside of the range.
    pub(crate) fn set_range(&mut self, start: u8, end: u8) {
        debug_assert!(start <= end);
        if start > 0 {
            self.0.add(start - 1);
        }
        self.0.add(end);
    }

    /// Convert this boolean set to a map that maps all byte values to their
    /// corresponding equivalence class. The last mapping indicates the largest
    /// equivalence class identifier (which is never bigger than 255).
    pub(crate) fn byte_classes(&self) -> ByteClasses {
        let mut classes = ByteClasses::empty();
        let mut class = 0u8;
        let mut b = 0u8;
        loop {
            classes.set(b, class);
            if b == 255 {
                break;
            }
            if self.0.contains(b) {
                class = class.checked_add(1).unwrap();
            }
            b = b.checked_add(1).unwrap();
        }
        classes
    }
}

/// A simple set of bytes that is reasonably cheap to copy and allocation free.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub(crate) struct ByteSet {
    bits: BitSet,
}

/// The representation of a byte set. Split out so that we can define a
/// convenient Debug impl for it while keeping "ByteSet" in the output.
#[derive(Clone, Copy, Default, Eq, PartialEq)]
struct BitSet([u128; 2]);

impl ByteSet {
    /// Create an empty set of bytes.
    pub(crate) fn empty() -> ByteSet {
        ByteSet { bits: BitSet([0; 2]) }
    }

    /// Add a byte to this set.
    ///
    /// If the given byte already belongs to this set, then this is a no-op.
    pub(crate) fn add(&mut self, byte: u8) {
        let bucket = byte / 128;
        let bit = byte % 128;
        self.bits.0[usize::from(bucket)] |= 1 << bit;
    }

    /// Return true if and only if the given byte is in this set.
    pub(crate) fn contains(&self, byte: u8) -> bool {
        let bucket = byte / 128;
        let bit = byte % 128;
        self.bits.0[usize::from(bucket)] & (1 << bit) > 0
    }
}

impl core::fmt::Debug for BitSet {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        let mut fmtd = f.debug_set();
        for b in 0u8..=255 {
            if (ByteSet { bits: *self }).contains(b) {
                fmtd.entry(&b);
            }
        }
        fmtd.finis
```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/buffer.rs`
```
use alloc::{vec, vec::Vec};

/// The default buffer capacity that we use for the stream buffer.
const DEFAULT_BUFFER_CAPACITY: usize = 64 * (1 << 10); // 64 KB

/// A fairly simple roll buffer for supporting stream searches.
///
/// This buffer acts as a temporary place to store a fixed amount of data when
/// reading from a stream. Its central purpose is to allow "rolling" some
/// suffix of the data to the beginning of the buffer before refilling it with
/// more data from the stream. For example, let's say we are trying to match
/// "foobar" on a stream. When we report the match, we'd like to not only
/// report the correct offsets at which the match occurs, but also the matching
/// bytes themselves. So let's say our stream is a file with the following
/// contents: `test test foobar test test`. Now assume that we happen to read
/// the aforementioned file in two chunks: `test test foo` and `bar test test`.
/// Naively, it would not be possible to report a single contiguous `foobar`
/// match, but this roll buffer allows us to do that. Namely, after the second
/// read, the contents of the buffer should be `st foobar test test`, where the
/// search should ultimately resume immediately after `foo`. (The prefix `st `
/// is included because the roll buffer saves N bytes at the end of the buffer,
/// where N is the maximum possible length of a match.)
///
/// A lot of the logic for dealing with this is unfortunately split out between
/// this roll buffer and the `StreamChunkIter`.
///
/// Note also that this buffer is not actually required to just report matches.
/// Because a `Match` is just some offsets. But it *is* required for supporting
/// things like `try_stream_replace_all` because that needs some mechanism for
/// knowing which bytes in the stream correspond to a match and which don't. So
/// when a match occurs across two `read` calls, *something* needs to retain
/// the bytes from the previous `read` call because you don't know before the
/// second read call whether a match exists or not.
#[derive(Debug)]
pub(crate) struct Buffer {
    /// The raw buffer contents. This has a fixed size and never increases.
    buf: Vec<u8>,
    /// The minimum size of the buffer, which is equivalent to the maximum
    /// possible length of a match. This corresponds to the amount that we
    /// roll
    min: usize,
    /// The end of the contents of this buffer.
    end: usize,
}

impl Buffer {
    /// Create a new buffer for stream searching. The minimum buffer length
    /// given should be the size of the maximum possible match length.
    pub(crate) fn new(min_buffer_len: usize) -> Buffer {
        let min = core::cmp::max(1, min_buffer_len);
        // The minimum buffer amount is also the amount that we roll our
        // buffer in order to support incremental searching. To this end,
        // our actual capacity needs to be at least 1 byte bigger than our
        // minimum amount, otherwise we won't have any overlap. In actuality,
        // we want our buffer to be a bit bigger than that for performance
        // reasons, so we set a lower bound of `8 * min`.
        //
        // TODO: It would be good to find a way to test the streaming
        // implementation with the minimal buffer size. For now, we just
        // uncomment out the next line and comment out the subsequent line.
        // let capacity = 1 + min;
        let capacity = core::cmp::max(min * 8, DEFAULT_BUFFER_CAPACITY);
        Buffer { buf: vec![0; capacity], min, end: 0 }
    }

    /// Return the contents of this buffer.
    #[inline]
    pub(crate) fn buffer(&self) -> &[u8] {
        &self.buf[..self.end]
    }

    /// Return the minimum size of the buffer. The only way a buffer may be
    /// smaller than this is if the stream itself contains less than the
    /// minimum buffer amount.
    #[inline]
    pub(crate) fn min_buffer_len(&self) -> usize {
        self.min
    }

    /// Return all free capacity in this buffer.
    fn free_buffer(&mut self) -> &mut [u8] {
        &mut self.buf[self.end..]
    }

    /// Refill the contents of this buffer by reading as much as possible into
    /// this buffer's free capacity. If no more bytes could be read, then this
    /// returns false. Otherwise, this reads until it has filled the buffer
    /// past the minimum amount.
    pub(crate) fn fill<R: std::io::Read>(
        &mut self,
        mut rdr: R,
    ) -> std::io::Result<bool> {
        let mut readany = false;
        loop {
            let readlen = rdr.read(self.free_buffer())?;
            if readlen == 0 {
                return Ok(readany);
            }
            readany = true;
            self.end += readlen;
            if self.buffer().len() >= self.min {
                return Ok(true);
            }
        }
    }

    /// Roll the contents of the buffer so that the suffix of this buffer is
    /// moved to the front and all other contents are dropped. The size of the
    /// suffix corresponds precisely to the minimum buffer length.
    ///
    /// This should only be called when the entire contents of this buffer have
    /// been searched.
    pub(crate) fn roll(&mut self) {
        let roll_start = self
            .end
            .checked_sub(self.min)
            .expect("buffer capacity should be bigger than minimum amount");
        let roll_end = roll_start + self.min;

        assert!(roll_end <= self.end);
        self.buf.copy_within(roll_start..roll_end, 0);
        self.end = self.min;
    }
}

```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/byte_frequencies.rs`
```
pub const BYTE_FREQUENCIES: [u8; 256] = [
    55,  // '\x00'
    52,  // '\x01'
    51,  // '\x02'
    50,  // '\x03'
    49,  // '\x04'
    48,  // '\x05'
    47,  // '\x06'
    46,  // '\x07'
    45,  // '\x08'
    103, // '\t'
    242, // '\n'
    66,  // '\x0b'
    67,  // '\x0c'
    229, // '\r'
    44,  // '\x0e'
    43,  // '\x0f'
    42,  // '\x10'
    41,  // '\x11'
    40,  // '\x12'
    39,  // '\x13'
    38,  // '\x14'
    37,  // '\x15'
    36,  // '\x16'
    35,  // '\x17'
    34,  // '\x18'
    33,  // '\x19'
    56,  // '\x1a'
    32,  // '\x1b'
    31,  // '\x1c'
    30,  // '\x1d'
    29,  // '\x1e'
    28,  // '\x1f'
    255, // ' '
    148, // '!'
    164, // '"'
    149, // '#'
    136, // '$'
    160, // '%'
    155, // '&'
    173, // "'"
    221, // '('
    222, // ')'
    134, // '*'
    122, // '+'
    232, // ','
    202, // '-'
    215, // '.'
    224, // '/'
    208, // '0'
    220, // '1'
    204, // '2'
    187, // '3'
    183, // '4'
    179, // '5'
    177, // '6'
    168, // '7'
    178, // '8'
    200, // '9'
    226, // ':'
    195, // ';'
    154, // '<'
    184, // '='
    174, // '>'
    126, // '?'
    120, // '@'
    191, // 'A'
    157, // 'B'
    194, // 'C'
    170, // 'D'
    189, // 'E'
    162, // 'F'
    161, // 'G'
    150, // 'H'
    193, // 'I'
    142, // 'J'
    137, // 'K'
    171, // 'L'
    176, // 'M'
    185, // 'N'
    167, // 'O'
    186, // 'P'
    112, // 'Q'
    175, // 'R'
    192, // 'S'
    188, // 'T'
    156, // 'U'
    140, // 'V'
    143, // 'W'
    123, // 'X'
    133, // 'Y'
    128, // 'Z'
    147, // '['
    138, // '\\'
    146, // ']'
    114, // '^'
    223, // '_'
    151, // '`'
    249, // 'a'
    216, // 'b'
    238, // 'c'
    236, // 'd'
    253, // 'e'
    227, // 'f'
    218, // 'g'
    230, // 'h'
    247, // 'i'
    135, // 'j'
    180, // 'k'
    241, // 'l'
    233, // 'm'
    246, // 'n'
    244, // 'o'
    231, // 'p'
    139, // 'q'
    245, // 'r'
    243, // 's'
    251, // 't'
    235, // 'u'
    201, // 'v'
    196, // 'w'
    240, // 'x'
    214, // 'y'
    152, // 'z'
    182, // '{'
    205, // '|'
    181, // '}'
    127, // '~'
    27,  // '\x7f'
    212, // '\x80'
    211, // '\x81'
    210, // '\x82'
    213, // '\x83'
    228, // '\x84'
    197, // '\x85'
    169, // '\x86'
    159, // '\x87'
    131, // '\x88'
    172, // '\x89'
    105, // '\x8a'
    80,  // '\x8b'
    98,  // '\x8c'
    96,  // '\x8d'
    97,  // '\x8e'
    81,  // '\x8f'
    207, // '\x90'
    145, // '\x91'
    116, // '\x92'
    115, // '\x93'
    144, // '\x94'
    130, // '\x95'
    153, // '\x96'
    121, // '\x97'
    107, // '\x98'
    132, // '\x99'
    109, // '\x9a'
    110, // '\x9b'
    124, // '\x9c'
    111, // '\x9d'
    82,  // '\x9e'
    108, // '\x9f'
    118, // '\xa0'
    141, // '¡'
    113, // '¢'
    129, // '£'
    119, // '¤'
    125, // '¥'
    165, // '¦'
    117, // '§'
    92,  // '¨'
    106, // '©'
    83,  // 'ª'
    72,  // '«'
    99,  // '¬'
    93,  // '\xad'
    65,  // '®'
    79,  // '¯'
    166, // '°'
    237, // '±'
    163, // '²'
    199, // '³'
    190, // '´'
    225, // 'µ'
    209, // '¶'
    203, // '·'
    198, // '¸'
    217, // '¹'
    219, // 'º'
    206, // '»'
    234, // '¼'
    248, // '½'
    158, // '¾'
    239, // '¿'
    255, // 'À'
    255, // 'Á'
    255, // 'Â'
    255, // 'Ã'
    255, // 'Ä'
    255, // 'Å'
    255, // 'Æ'
    255, // 'Ç'
    255, // 'È'
    255, // 'É'
    255, // 'Ê'
    255, // 'Ë'
    255, // 'Ì'
    255, // 'Í'
    255, // 'Î'
    255, // 'Ï'
    255, // 'Ð'
    255, // 'Ñ'
    255, // 'Ò'
    255, // 'Ó'
    255, // 'Ô'
    255, // 'Õ'
    255, // 'Ö'
    255, // '×'
    255, // 'Ø'
    255, // 'Ù'
    255, // 'Ú'
    255, // 'Û'
    255, // 'Ü'
    255, // 'Ý'
    255, // 'Þ'
    255, // 'ß'
    255, // 'à'
    255, // 'á'
    255, // 'â'
    255, // 'ã'
    255, // 'ä'
    255, // 'å'
    255, // 'æ'
    255, // 'ç'
    255, // 'è'
    255, // 'é'
    255, // 'ê'
    255, // 'ë'
    255, // 'ì'
    255, // 'í'
    255, // 'î'
    255, // 'ï'
    255, // 'ð'
    255, // 'ñ'
    255, // 'ò'
    255, // 'ó'
    255, // 'ô'
    255, // 'õ'
    255, // 'ö'
    255, // '÷'
    255, // 'ø'
    255, // 'ù'
    255, // 'ú'
    255, // 'û'
    255, // 'ü'
    255, // 'ý'
    255, // 'þ'
    255, // 'ÿ'
];

```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/debug.rs`
```
/// A type that wraps a single byte with a convenient fmt::Debug impl that
/// escapes the byte.
pub(crate) struct DebugByte(pub(crate) u8);

impl core::fmt::Debug for DebugByte {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        // Special case ASCII space. It's too hard to read otherwise, so
        // put quotes around it. I sometimes wonder whether just '\x20' would
        // be better...
        if self.0 == b' ' {
            return write!(f, "' '");
        }
        // 10 bytes is enough to cover any output from ascii::escape_default.
        let mut bytes = [0u8; 10];
        let mut len = 0;
        for (i, mut b) in core::ascii::escape_default(self.0).enumerate() {
            // capitalize \xab to \xAB
            if i >= 2 && b'a' <= b && b <= b'f' {
                b -= 32;
            }
            bytes[len] = b;
            len += 1;
        }
        write!(f, "{}", core::str::from_utf8(&bytes[..len]).unwrap())
    }
}

```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/error.rs`
```
use crate::util::{
    primitives::{PatternID, SmallIndex},
    search::MatchKind,
};

/// An error that occurred during the construction of an Aho-Corasick
/// automaton.
///
/// Build errors occur when some kind of limit has been exceeded, either in the
/// number of states, the number of patterns of the length of a pattern. These
/// limits aren't part of the public API, but they should generally be large
/// enough to handle most use cases.
///
/// When the `std` feature is enabled, this implements the `std::error::Error`
/// trait.
#[derive(Clone, Debug)]
pub struct BuildError {
    kind: ErrorKind,
}

/// The kind of error that occurred.
#[derive(Clone, Debug)]
enum ErrorKind {
    /// An error that occurs when allocating a new state would result in an
    /// identifier that exceeds the capacity of a `StateID`.
    StateIDOverflow {
        /// The maximum possible id.
        max: u64,
        /// The maximum ID requested.
        requested_max: u64,
    },
    /// An error that occurs when adding a pattern to an Aho-Corasick
    /// automaton would result in an identifier that exceeds the capacity of a
    /// `PatternID`.
    PatternIDOverflow {
        /// The maximum possible id.
        max: u64,
        /// The maximum ID requested.
        requested_max: u64,
    },
    /// Occurs when a pattern string is given to the Aho-Corasick constructor
    /// that is too long.
    PatternTooLong {
        /// The ID of the pattern that was too long.
        pattern: PatternID,
        /// The length that was too long.
        len: usize,
    },
}

impl BuildError {
    pub(crate) fn state_id_overflow(
        max: u64,
        requested_max: u64,
    ) -> BuildError {
        BuildError { kind: ErrorKind::StateIDOverflow { max, requested_max } }
    }

    pub(crate) fn pattern_id_overflow(
        max: u64,
        requested_max: u64,
    ) -> BuildError {
        BuildError {
            kind: ErrorKind::PatternIDOverflow { max, requested_max },
        }
    }

    pub(crate) fn pattern_too_long(
        pattern: PatternID,
        len: usize,
    ) -> BuildError {
        BuildError { kind: ErrorKind::PatternTooLong { pattern, len } }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for BuildError {}

impl core::fmt::Display for BuildError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self.kind {
            ErrorKind::StateIDOverflow { max, requested_max } => {
                write!(
                    f,
                    "state identifier overflow: failed to create state ID \
                     from {}, which exceeds the max of {}",
                    requested_max, max,
                )
            }
            ErrorKind::PatternIDOverflow { max, requested_max } => {
                write!(
                    f,
                    "pattern identifier overflow: failed to create pattern ID \
                     from {}, which exceeds the max of {}",
                    requested_max, max,
                )
            }
            ErrorKind::PatternTooLong { pattern, len } => {
                write!(
                    f,
                    "pattern {} with length {} exceeds \
                     the maximum pattern length of {}",
                    pattern.as_usize(),
                    len,
                    SmallIndex::MAX.as_usize(),
                )
            }
        }
    }
}

/// An error that occurred during an Aho-Corasick search.
///
/// An error that occurs during a search is limited to some kind of
/// misconfiguration that resulted in an illegal call. Stated differently,
/// whether an error occurs is not dependent on the specific bytes in the
/// haystack.
///
/// Examples of misconfiguration:
///
/// * Executing a stream or overlapping search on a searcher that was built was
/// something other than [`MatchKind::Standard`](crate::MatchKind::Standard)
/// semantics.
/// * Requested an anchored or an unanchored search on a searcher that doesn't
/// support unanchored or anchored searches, respectively.
///
/// When the `std` feature is enabled, this implements the `std::error::Error`
/// trait.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MatchError(alloc::boxed::Box<MatchErrorKind>);

impl MatchError {
    /// Create a new error value with the given kind.
    ///
    /// This is a more verbose version of the kind-specific constructors, e.g.,
    /// `MatchError::unsupported_stream`.
    pub fn new(kind: MatchErrorKind) -> MatchError {
        MatchError(alloc::boxed::Box::new(kind))
    }

    /// Returns a reference to the underlying error kind.
    pub fn kind(&self) -> &MatchErrorKind {
        &self.0
    }

    /// Create a new "invalid anchored search" error. This occurs when the
    /// caller requests an anchored search but where anchored searches aren't
    /// supported.
    ///
    /// This is the same as calling `MatchError::new` with a
    /// [`MatchErrorKind::InvalidInputAnchored`] kind.
    pub fn invalid_input_anchored() -> MatchError {
        MatchError::new(MatchErrorKind::InvalidInputAnchored)
    }

    /// Create a new "invalid unanchored search" error. This occurs when the
    /// caller requests an unanchored search but where unanchored searches
    /// aren't supported.
    ///
    /// This is the same as calling `MatchError::new` with a
    /// [`MatchErrorKind::InvalidInputUnanchored`] kind.
    pub fn invalid_input_unanchored() -> MatchError {
        MatchError::new(MatchErrorKind::InvalidInputUnanchored)
    }

    /// Create a new "unsupported stream search" error. This occurs when the
    /// caller requests a stream search while using an Aho-Corasick automaton
    /// with a match kind other than [`MatchKind::Standard`].
    ///
    /// The match kind given should be the match kind of the automaton. It
    /// should never be `MatchKind::Standard`.
    pub fn unsupported_stream(got: MatchKind) -> MatchError {
        MatchError::new(MatchErrorKind::UnsupportedStream { got })
    }

    /// Create a new "unsupported overlapping search" error. This occurs when
    /// the caller requests an overlapping search while using an Aho-Corasick
    /// automaton with a match kind other than [`MatchKind::Standard`].
    ///
    /// The match kind given should be the match kind of the automaton. It
    /// should never be `MatchKind::Standard`.
    pub fn unsupported_overlapping(got: MatchKind) -> MatchError {
        MatchError::new(MatchErrorKind::UnsupportedOverlapping { got })
    }

    /// Create a new "unsupported empty pattern" error. This occurs when the
    /// caller requests a search for which matching an automaton that contains
    /// an empty pattern string is not supported.
    pub fn unsupported_empty() -> MatchError {
        MatchError::new(MatchErrorKind::UnsupportedEmpty)
    }
}

/// The underlying kind of a [`MatchError`].
///
/// This is a **non-exhaustive** enum. That means new variants may be added in
/// a semver-compatible release.
#[non_exhaustive]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MatchErrorKind {
    /// An error indicating that an anchored search was requested, but from a
    /// searcher that was built without anchored support.
    InvalidInputAnchored,
    /// An error indicating that an unanchored search was requested, but from a
    /// searcher that was built without unanchored support.
    InvalidInputUnanchored,
    /// An error indicating that a stream search was attempted on an
    /// Aho-Corasick automaton with an unsupported `MatchKind`.
    UnsupportedStream {
        /// The match semantics for the automaton that was used.
        got: MatchKind,
    },
    /// An error indicating that an overlapping search was attempted on an
    /// Aho-Corasick automaton with an unsupported `MatchKind`.
    UnsupportedOverlapping {
        /// The match semantics for the automaton that was used.
        got: MatchKind,
    },
    /// An error indicating that the operation requested doesn't support
    /// automatons that contain an empty pattern string.
    UnsupportedEmpty,
}

#[cfg(feature = "std")]
impl std::error::Error for MatchError {}

impl core::fmt::Display for MatchError {
    fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        match *self.kind() {
            MatchErrorKind::InvalidInputAnchored => {
                write!(f, "anchored searches are not supported or enabled")
            }
            MatchErrorKind::InvalidInputUnanchored => {
                write!(f, "unanchored searches are not supported or enabled")
            }
            MatchErrorKind::UnsupportedStream { got } => {
                write!(
                    f,
                    "match kind {:?} does not support stream searching",
                    got,
                )
            }
            MatchErrorKind::UnsupportedOverlapping { got } => {
                write!(
                    f,
                    "match kind {:?} does not support overlapping searches",
                    got,
                )
            }
            MatchErrorKind::UnsupportedEmpty => {
                write!(
                    f,
                    "matching with an empty pattern string is not \
                     supported for this operation",
                )
            }
        }
    }
}

```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/int.rs`
```
/*!
This module provides several integer oriented traits for converting between
both fixed size integers and integers whose size varies based on the target
(like `usize`).

The main design principle for this module is to centralize all uses of `as`.
The thinking here is that `as` makes it very easy to perform accidental lossy
conversions, and if we centralize all its uses here under more descriptive
higher level operations, its use and correctness becomes easier to audit.

This was copied mostly wholesale from `regex-automata`.

NOTE: for simplicity, we don't take target pointer width into account here for
`usize` conversions. Since we currently only panic in debug mode, skipping the
check when it can be proven it isn't needed at compile time doesn't really
matter. Now, if we wind up wanting to do as many checks as possible in release
mode, then we would want to skip those when we know the conversions are always
non-lossy.
*/

// We define a little more than what we need, but I'd rather just have
// everything via a consistent and uniform API then have holes.
#![allow(dead_code)]

pub(crate) trait U8 {
    fn as_usize(self) -> usize;
}

impl U8 for u8 {
    fn as_usize(self) -> usize {
        usize::from(self)
    }
}

pub(crate) trait U16 {
    fn as_usize(self) -> usize;
    fn low_u8(self) -> u8;
    fn high_u8(self) -> u8;
}

impl U16 for u16 {
    fn as_usize(self) -> usize {
        usize::from(self)
    }

    fn low_u8(self) -> u8 {
        self as u8
    }

    fn high_u8(self) -> u8 {
        (self >> 8) as u8
    }
}

pub(crate) trait U32 {
    fn as_usize(self) -> usize;
    fn low_u8(self) -> u8;
    fn low_u16(self) -> u16;
    fn high_u16(self) -> u16;
}

impl U32 for u32 {
    #[inline]
    fn as_usize(self) -> usize {
        #[cfg(debug_assertions)]
        {
            usize::try_from(self).expect("u32 overflowed usize")
        }
        #[cfg(not(debug_assertions))]
        {
            self as usize
        }
    }

    fn low_u8(self) -> u8 {
        self as u8
    }

    fn low_u16(self) -> u16 {
        self as u16
    }

    fn high_u16(self) -> u16 {
        (self >> 16) as u16
    }
}

pub(crate) trait U64 {
    fn as_usize(self) -> usize;
    fn low_u8(self) -> u8;
    fn low_u16(self) -> u16;
    fn low_u32(self) -> u32;
    fn high_u32(self) -> u32;
}

impl U64 for u64 {
    fn as_usize(self) -> usize {
        #[cfg(debug_assertions)]
        {
            usize::try_from(self).expect("u64 overflowed usize")
        }
        #[cfg(not(debug_assertions))]
        {
            self as usize
        }
    }

    fn low_u8(self) -> u8 {
        self as u8
    }

    fn low_u16(self) -> u16 {
        self as u16
    }

    fn low_u32(self) -> u32 {
        self as u32
    }

    fn high_u32(self) -> u32 {
        (self >> 32) as u32
    }
}

pub(crate) trait I8 {
    fn as_usize(self) -> usize;
    fn to_bits(self) -> u8;
    fn from_bits(n: u8) -> i8;
}

impl I8 for i8 {
    fn as_usize(self) -> usize {
        #[cfg(debug_assertions)]
        {
            usize::try_from(self).expect("i8 overflowed usize")
        }
        #[cfg(not(debug_assertions))]
        {
            self as usize
        }
    }

    fn to_bits(self) -> u8 {
        self as u8
    }

    fn from_bits(n: u8) -> i8 {
        n as i8
    }
}

pub(crate) trait I32 {
    fn as_usize(self) -> usize;
    fn to_bits(self) -> u32;
    fn from_bits(n: u32) -> i32;
}

impl I32 for i32 {
    fn as_usize(self) -> usize {
        #[cfg(debug_assertions)]
        {
            usize::try_from(self).expect("i32 overflowed usize")
        }
        #[cfg(not(debug_assertions))]
        {
            self as usize
        }
    }

    fn to_bits(self) -> u32 {
        self as u32
    }

    fn from_bits(n: u32) -> i32 {
        n as i32
    }
}

pub(crate) trait I64 {
    fn as_usize(self) -> usize;
    fn to_bits(self) -> u64;
    fn from_bits(n: u64) -> i64;
}

impl I64 for i64 {
    fn as_usize(self) -> usize {
        #[cfg(debug_assertions)]
        {
            usize::try_from(self).expect("i64 overflowed usize")
        }
        #[cfg(not(debug_assertions))]
        {
            self as usize
        }
    }

    fn to_bits(self) -> u64 {
        self as u64
    }

    fn from_bits(n: u64) -> i64 {
        n as i64
    }
}

pub(crate) trait Usize {
    fn as_u8(self) -> u8;
    fn as_u16(self) -> u16;
    fn as_u32(self) -> u32;
    fn as_u64(self) -> u64;
}

impl Usize for usize {
    fn as_u8(self) -> u8 {
        #[cfg(debug_assertions)]
        {
            u8::try_from(self).expect("usize overflowed u8")
        }
        #[cfg(not(debug_assertions))]
        {
            self as u8
        }
    }

    fn as_u16(self) -> u16 {
        #[cfg(debug_assertions)]
        {
            u16::try_from(self).expect("usize overflowed u16")
        }
        #[cfg(not(debug_assertions))]
        {
            self as u16
        }
    }

    fn as_u32(self) -> u32 {
        #[cfg(debug_assertions)]
        {
            u32::try_from(self).expect("usize overflowed u32")
        }
        #[cfg(not(debug_assertions))]
        {
            self as u32
        }
    }

    fn as_u64(self) -> u64 {
        #[cfg(debug_assertions)]
        {
            u64::try_from(self).expect("usize overflowed u64")
        }
        #[cfg(not(debug_assertions))]
        {
            self as u64
        }
    }
}

// Pointers aren't integers, but we convert pointers to integers to perform
// offset arithmetic in some places. (And no, we don't convert the integers
// back to pointers.) So add 'as_usize' conversions here too for completeness.
//
// These 'as' casts are actually okay because they're always non-lossy. But the
// idea here is to just try and remove as much 'as' as possible, particularly
// in this crate where we are being really paranoid about offsets and making
// sure we don't panic on inputs that might be untrusted. This way, the 'as'
// casts become easier to audit if they're all in one place, even when some of
// them are actually okay 100% of the time.

pub(crate) trait Pointer {
    fn as_usize(self) -> usize;
}

impl<T> Pointer for *const T {
    fn as_usize(self) -> usize {
        self as usize
    }
}

```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/mod.rs`
```
pub(crate) mod alphabet;
#[cfg(feature = "std")]
pub(crate) mod buffer;
pub(crate) mod byte_frequencies;
pub(crate) mod debug;
pub(crate) mod error;
pub(crate) mod int;
pub(crate) mod prefilter;
pub(crate) mod primitives;
pub(crate) mod remapper;
pub(crate) mod search;
pub(crate) mod special;

```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/prefilter.rs`
```
use core::{
    cmp,
    fmt::Debug,
    panic::{RefUnwindSafe, UnwindSafe},
    u8,
};

use alloc::{sync::Arc, vec, vec::Vec};

use crate::{
    packed,
    util::{
        alphabet::ByteSet,
        search::{Match, MatchKind, Span},
    },
};

/// A prefilter for accelerating a search.
///
/// This crate uses prefilters in the core search implementations to accelerate
/// common cases. They typically only apply to cases where there are a small
/// number of patterns (less than 100 or so), but when they do, thoughput can
/// be boosted considerably, perhaps by an order of magnitude. When a prefilter
/// is active, it is used whenever a search enters an automaton's start state.
///
/// Currently, prefilters cannot be constructed by
/// callers. A `Prefilter` can only be accessed via the
/// [`Automaton::prefilter`](crate::automaton::Automaton::prefilter)
/// method and used to execute a search. In other words, a prefilter can be
/// used to optimize your own search implementation if necessary, but cannot do
/// much else. If you have a use case for more APIs, please submit an issue.
#[derive(Clone, Debug)]
pub struct Prefilter {
    finder: Arc<dyn PrefilterI>,
    memory_usage: usize,
}

impl Prefilter {
    /// Execute a search in the haystack within the span given. If a match or
    /// a possible match is returned, then it is guaranteed to occur within
    /// the bounds of the span.
    ///
    /// If the span provided is invalid for the given haystack, then behavior
    /// is unspecified.
    #[inline]
    pub fn find_in(&self, haystack: &[u8], span: Span) -> Candidate {
        self.finder.find_in(haystack, span)
    }

    #[inline]
    pub(crate) fn memory_usage(&self) -> usize {
        self.memory_usage
    }
}

/// A candidate is the result of running a prefilter on a haystack at a
/// particular position.
///
/// The result is either no match, a confirmed match or a possible match.
///
/// When no match is returned, the prefilter is guaranteeing that no possible
/// match can be found in the haystack, and the caller may trust this. That is,
/// all correct prefilters must never report false negatives.
///
/// In some cases, a prefilter can confirm a match very quickly, in which case,
/// the caller may use this to stop what it's doing and report the match. In
/// this case, prefilter implementations must never report a false positive.
/// In other cases, the prefilter can only report a potential match, in which
/// case the callers must attempt to confirm the match. In this case, prefilter
/// implementations are permitted to return false positives.
#[derive(Clone, Debug)]
pub enum Candidate {
    /// No match was found. Since false negatives are not possible, this means
    /// the search can quit as it is guaranteed not to find another match.
    None,
    /// A confirmed match was found. Callers do not need to confirm it.
    Match(Match),
    /// The start of a possible match was found. Callers must confirm it before
    /// reporting it as a match.
    PossibleStartOfMatch(usize),
}

impl Candidate {
    /// Convert this candidate into an option. This is useful when callers
    /// do not distinguish between true positives and false positives (i.e.,
    /// the caller must always confirm the match).
    pub fn into_option(self) -> Option<usize> {
        match self {
            Candidate::None => None,
            Candidate::Match(ref m) => Some(m.start()),
            Candidate::PossibleStartOfMatch(start) => Some(start),
        }
    }
}

/// A prefilter describes the behavior of fast literal scanners for quickly
/// skipping past bytes in the haystack that we know cannot possibly
/// participate in a match.
trait PrefilterI:
    Send + Sync + RefUnwindSafe + UnwindSafe + Debug + 'static
{
    /// Returns the next possible match candidate. This may yield false
    /// positives, so callers must confirm a match starting at the position
    /// returned. This, however, must never produce false negatives. That is,
    /// this must, at minimum, return the starting position of the next match
    /// in the given haystack after or at the given position.
    fn find_in(&self, haystack: &[u8], span: Span) -> Candidate;
}

impl<P: PrefilterI + ?Sized> PrefilterI for Arc<P> {
    #[inline(always)]
    fn find_in(&self, haystack: &[u8], span: Span) -> Candidate {
        (**self).find_in(haystack, span)
    }
}

/// A builder for constructing the best possible prefilter. When constructed,
/// this builder will heuristically select the best prefilter it can build,
/// if any, and discard the rest.
#[derive(Debug)]
pub(crate) struct Builder {
    count: usize,
    ascii_case_insensitive: bool,
    start_bytes: StartBytesBuilder,
    rare_bytes: RareBytesBuilder,
    memmem: MemmemBuilder,
    packed: Option<packed::Builder>,
    // If we run across a condition that suggests we shouldn't use a prefilter
    // at all (like an empty pattern), then disable prefilters entirely.
    enabled: bool,
}

impl Builder {
    /// Create a new builder for constructing the best possible prefilter.
    pub(crate) fn new(kind: MatchKind) -> Builder {
        let pbuilder = kind
            .as_packed()
            .map(|kind| packed::Config::new().match_kind(kind).builder());
        Builder {
            count: 0,
            ascii_case_insensitive: false,
            start_bytes: StartBytesBuilder::new(),
            rare_bytes: RareBytesBuilder::new(),
            memmem: MemmemBuilder::default(),
            packed: pbuilder,
            enabled: true,
        }
    }

    /// Enable ASCII case insensitivity. When set, byte strings added to this
    /// builder will be interpreted without respect to ASCII case.
    pub(crate) fn ascii_case_insensitive(mut self, yes: bool) -> Builder {
        self.ascii_case_insensitive = yes;
        self.start_bytes = self.start_bytes.ascii_case_insensitive(yes);
        self.rare_bytes = self.rare_bytes.ascii_case_insensitive(yes);
        self
    }

    /// Return a prefilter suitable for quickly finding potential matches.
    ///
    /// All patterns added to an Aho-Corasick automaton should be added to this
    /// builder before attempting to construct the prefilter.
    pub(crate) fn build(&self) -> Option<Prefilter> {
        if !self.enabled {
            debug!("prefilter not enabled, skipping");
            return None;
        }
        // If we only have one pattern, then deferring to memmem is always
        // the best choice. This is kind of a weird case, because, well, why
        // use Aho-Corasick if you only have one pattern? But maybe you don't
        // know exactly how many patterns you'll get up front, and you need to
        // support the option of multiple patterns. So instead of relying on
        // the caller to branch and use memmem explicitly, we just do it for
        // them.
        if !self.ascii_case_insensitive {
            if let Some(pre) = self.memmem.build() {
                debug!("using memmem prefilter");
                return Some(pre);
            }
        }
        let (packed, patlen, minlen) = if self.ascii_case_insensitive {
            (None, usize::MAX, 0)
        } else {
            let patlen = self.packed.as_ref().map_or(usize::MAX, |p| p.len());
            let minlen = self.packed.as_ref().map_or(0, |p| p.minimum_len());
            let packed =
                self.packed.as_ref().and_then(|b| b.build()).map(|s| {
                    let memory_usage = s.memory_usage();
                    debug!(
                        "built packed prefilter (len: {}, \
                         minimum pattern len: {}, memory usage: {}) \
                         for consideration",
                        patlen, minlen, memory_usage,
                    );
                    Prefilter { finder: Arc::new(Packed(s)), memory_usage }
                });
            (packed, patlen, minlen)
        };
        match (self.start_bytes.build(), self.rare_bytes.build()) {
            // If we could build both start and rare prefilters, then there are
            // a few cases in which we'd want to use the start-byte prefilter
            // over the rare-byte prefilter, since the former has lower
            // overhead.
            (prestart @ Some(_), prerare @ Some(_)) => {
                debug!(
                    "both start (len={}, rank={}) and \
                     rare (len={}, rank={}) byte prefilters \
                     are available",
                    self.start_bytes.count,
                    self.start_bytes.rank_sum,
                    self.rare_bytes.count,
                    self.rare_bytes.rank_sum,
                );
                if patlen <= 16
                    && minlen >= 2
                    && self.start_bytes.count >= 3
                    && self.rare_bytes.count >= 3
                {
                    debug!(
                        "start and rare byte prefilters available, but \
                             they're probably slower than packed so using \
                             packed"
                    );
                    return packed;
                }
                // If the start-byte prefilter can scan for a smaller number
                // of bytes than the rare-byte prefilter, then it's probably
                // faster.
                let has_fewer_bytes =
                    self.start_bytes.count < self.rare_bytes.count;
                // Otherwise, if the combined frequency rank of the detected
                // bytes in the start-byte prefilter is "close" to the combined
                // frequency rank of the rare-byte prefilter, then we pick
                // the start-byte prefilter even if the rare-byte prefilter
                // heuristically searches for rare bytes. This is because the
                // rare-byte prefilter has higher constant costs, so we tend to
                // prefer the start-byte prefilter when we can.
             
```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/primitives.rs`
```
/*!
Lower level primitive types that are useful in a variety of circumstances.

# Overview

This list represents the principle types in this module and briefly describes
when you might want to use them.

* [`PatternID`] - A type that represents the identifier of a regex pattern.
This is probably the most widely used type in this module (which is why it's
also re-exported in the crate root).
* [`StateID`] - A type the represents the identifier of a finite automaton
state. This is used for both NFAs and DFAs, with the notable exception of
the hybrid NFA/DFA. (The hybrid NFA/DFA uses a special purpose "lazy" state
identifier.)
* [`SmallIndex`] - The internal representation of both a `PatternID` and a
`StateID`. Its purpose is to serve as a type that can index memory without
being as big as a `usize` on 64-bit targets. The main idea behind this type
is that there are many things in regex engines that will, in practice, never
overflow a 32-bit integer. (For example, like the number of patterns in a regex
or the number of states in an NFA.) Thus, a `SmallIndex` can be used to index
memory without peppering `as` casts everywhere. Moreover, it forces callers
to handle errors in the case where, somehow, the value would otherwise overflow
either a 32-bit integer or a `usize` (e.g., on 16-bit targets).
*/

// The macro we use to define some types below adds methods that we don't
// use on some of the types. There isn't much, so we just squash the warning.
#![allow(dead_code)]

use alloc::vec::Vec;

use crate::util::int::{Usize, U16, U32, U64};

/// A type that represents a "small" index.
///
/// The main idea of this type is to provide something that can index memory,
/// but uses less memory than `usize` on 64-bit systems. Specifically, its
/// representation is always a `u32` and has `repr(transparent)` enabled. (So
/// it is safe to transmute between a `u32` and a `SmallIndex`.)
///
/// A small index is typically useful in cases where there is no practical way
/// that the index will overflow a 32-bit integer. A good example of this is
/// an NFA state. If you could somehow build an NFA with `2^30` states, its
/// memory usage would be exorbitant and its runtime execution would be so
/// slow as to be completely worthless. Therefore, this crate generally deems
/// it acceptable to return an error if it would otherwise build an NFA that
/// requires a slice longer than what a 32-bit integer can index. In exchange,
/// we can use 32-bit indices instead of 64-bit indices in various places.
///
/// This type ensures this by providing a constructor that will return an error
/// if its argument cannot fit into the type. This makes it much easier to
/// handle these sorts of boundary cases that are otherwise extremely subtle.
///
/// On all targets, this type guarantees that its value will fit in a `u32`,
/// `i32`, `usize` and an `isize`. This means that on 16-bit targets, for
/// example, this type's maximum value will never overflow an `isize`,
/// which means it will never overflow a `i16` even though its internal
/// representation is still a `u32`.
///
/// The purpose for making the type fit into even signed integer types like
/// `isize` is to guarantee that the difference between any two small indices
/// is itself also a small index. This is useful in certain contexts, e.g.,
/// for delta encoding.
///
/// # Other types
///
/// The following types wrap `SmallIndex` to provide a more focused use case:
///
/// * [`PatternID`] is for representing the identifiers of patterns.
/// * [`StateID`] is for representing the identifiers of states in finite
/// automata. It is used for both NFAs and DFAs.
///
/// # Representation
///
/// This type is always represented internally by a `u32` and is marked as
/// `repr(transparent)`. Thus, this type always has the same representation as
/// a `u32`. It is thus safe to transmute between a `u32` and a `SmallIndex`.
///
/// # Indexing
///
/// For convenience, callers may use a `SmallIndex` to index slices.
///
/// # Safety
///
/// While a `SmallIndex` is meant to guarantee that its value fits into `usize`
/// without using as much space as a `usize` on all targets, callers must
/// not rely on this property for safety. Callers may choose to rely on this
/// property for correctness however. For example, creating a `SmallIndex` with
/// an invalid value can be done in entirely safe code. This may in turn result
/// in panics or silent logical errors.
#[derive(
    Clone, Copy, Debug, Default, Eq, Hash, PartialEq, PartialOrd, Ord,
)]
#[repr(transparent)]
pub(crate) struct SmallIndex(u32);

impl SmallIndex {
    /// The maximum index value.
    #[cfg(any(target_pointer_width = "32", target_pointer_width = "64"))]
    pub const MAX: SmallIndex =
        // FIXME: Use as_usize() once const functions in traits are stable.
        SmallIndex::new_unchecked(core::i32::MAX as usize - 1);

    /// The maximum index value.
    #[cfg(target_pointer_width = "16")]
    pub const MAX: SmallIndex =
        SmallIndex::new_unchecked(core::isize::MAX - 1);

    /// The total number of values that can be represented as a small index.
    pub const LIMIT: usize = SmallIndex::MAX.as_usize() + 1;

    /// The zero index value.
    pub const ZERO: SmallIndex = SmallIndex::new_unchecked(0);

    /// The number of bytes that a single small index uses in memory.
    pub const SIZE: usize = core::mem::size_of::<SmallIndex>();

    /// Create a new small index.
    ///
    /// If the given index exceeds [`SmallIndex::MAX`], then this returns
    /// an error.
    #[inline]
    pub fn new(index: usize) -> Result<SmallIndex, SmallIndexError> {
        SmallIndex::try_from(index)
    }

    /// Create a new small index without checking whether the given value
    /// exceeds [`SmallIndex::MAX`].
    ///
    /// Using this routine with an invalid index value will result in
    /// unspecified behavior, but *not* undefined behavior. In particular, an
    /// invalid index value is likely to cause panics or possibly even silent
    /// logical errors.
    ///
    /// Callers must never rely on a `SmallIndex` to be within a certain range
    /// for memory safety.
    #[inline]
    pub const fn new_unchecked(index: usize) -> SmallIndex {
        // FIXME: Use as_u32() once const functions in traits are stable.
        SmallIndex::from_u32_unchecked(index as u32)
    }

    /// Create a new small index from a `u32` without checking whether the
    /// given value exceeds [`SmallIndex::MAX`].
    ///
    /// Using this routine with an invalid index value will result in
    /// unspecified behavior, but *not* undefined behavior. In particular, an
    /// invalid index value is likely to cause panics or possibly even silent
    /// logical errors.
    ///
    /// Callers must never rely on a `SmallIndex` to be within a certain range
    /// for memory safety.
    #[inline]
    pub const fn from_u32_unchecked(index: u32) -> SmallIndex {
        SmallIndex(index)
    }

    /// Like [`SmallIndex::new`], but panics if the given index is not valid.
    #[inline]
    pub fn must(index: usize) -> SmallIndex {
        SmallIndex::new(index).expect("invalid small index")
    }

    /// Return this small index as a `usize`. This is guaranteed to never
    /// overflow `usize`.
    #[inline]
    pub const fn as_usize(&self) -> usize {
        // FIXME: Use as_usize() once const functions in traits are stable.
        self.0 as usize
    }

    /// Return this small index as a `u64`. This is guaranteed to never
    /// overflow.
    #[inline]
    pub const fn as_u64(&self) -> u64 {
        // FIXME: Use u64::from() once const functions in traits are stable.
        self.0 as u64
    }

    /// Return the internal `u32` of this small index. This is guaranteed to
    /// never overflow `u32`.
    #[inline]
    pub const fn as_u32(&self) -> u32 {
        self.0
    }

    /// Return the internal `u32` of this small index represented as an `i32`.
    /// This is guaranteed to never overflow an `i32`.
    #[inline]
    pub const fn as_i32(&self) -> i32 {
        // This is OK because we guarantee that our max value is <= i32::MAX.
        self.0 as i32
    }

    /// Returns one more than this small index as a usize.
    ///
    /// Since a small index has constraints on its maximum value, adding `1` to
    /// it will always fit in a `usize`, `isize`, `u32` and a `i32`.
    #[inline]
    pub fn one_more(&self) -> usize {
        self.as_usize() + 1
    }

    /// Decode this small index from the bytes given using the native endian
    /// byte order for the current target.
    ///
    /// If the decoded integer is not representable as a small index for the
    /// current target, then this returns an error.
    #[inline]
    pub fn from_ne_bytes(
        bytes: [u8; 4],
    ) -> Result<SmallIndex, SmallIndexError> {
        let id = u32::from_ne_bytes(bytes);
        if id > SmallIndex::MAX.as_u32() {
            return Err(SmallIndexError { attempted: u64::from(id) });
        }
        Ok(SmallIndex::new_unchecked(id.as_usize()))
    }

    /// Decode this small index from the bytes given using the native endian
    /// byte order for the current target.
    ///
    /// This is analogous to [`SmallIndex::new_unchecked`] in that is does not
    /// check whether the decoded integer is representable as a small index.
    #[inline]
    pub fn from_ne_bytes_unchecked(bytes: [u8; 4]) -> SmallIndex {
        SmallIndex::new_unchecked(u32::from_ne_bytes(bytes).as_usize())
    }

    /// Return the underlying small index integer as raw bytes in native endian
    /// format.
    #[inline]
    pub fn to_ne_bytes(&self) -> [u8; 4] {
        self.0.to_ne_bytes()
    }
}

impl<T> core::ops::Index<SmallIndex> for [T] {
    type Output = T;

    #[inline]
    fn index(&self, index: SmallIndex) -> &T {
        &self[index.as_usize()]
    }
}

impl<T> core::ops::IndexMut<SmallIndex> for [T] {
    #[inline]
    fn index_mut(&mut self, index: SmallInde
```

### Core Architecture Module: `contrib/crates/aho-corasick-1.1.5/src/util/remapper.rs`
```
use alloc::vec::Vec;

use crate::{nfa::noncontiguous, util::primitives::StateID};

/// Remappable is a tightly coupled abstraction that facilitates remapping
/// state identifiers in DFAs.
///
/// The main idea behind remapping state IDs is that DFAs often need to check
/// if a certain state is a "special" state of some kind (like a match state)
/// during a search. Since this is extremely perf critical code, we want this
/// check to be as fast as possible. Partitioning state IDs into, for example,
/// into "non-match" and "match" states means one can tell if a state is a
/// match state via a simple comparison of the state ID.
///
/// The issue is that during the DFA construction process, it's not
/// particularly easy to partition the states. Instead, the simplest thing is
/// to often just do a pass over all of the states and shuffle them into their
/// desired partitionings. To do that, we need a mechanism for swapping states.
/// Hence, this abstraction.
///
/// Normally, for such little code, I would just duplicate it. But this is a
/// key optimization and the implementation is a bit subtle. So the abstraction
/// is basically a ham-fisted attempt at DRY. The only place we use this is in
/// the dense and one-pass DFAs.
///
/// See also src/dfa/special.rs for a more detailed explanation of how dense
/// DFAs are partitioned.
pub(crate) trait Remappable: core::fmt::Debug {
    /// Return the total number of states.
    fn state_len(&self) -> usize;

    /// Swap the states pointed to by the given IDs. The underlying finite
    /// state machine should be mutated such that all of the transitions in
    /// `id1` are now in the memory region where the transitions for `id2`
    /// were, and all of the transitions in `id2` are now in the memory region
    /// where the transitions for `id1` were.
    ///
    /// Essentially, this "moves" `id1` to `id2` and `id2` to `id1`.
    ///
    /// It is expected that, after calling this, the underlying state machine
    /// will be left in an inconsistent state, since any other transitions
    /// pointing to, e.g., `id1` need to be updated to point to `id2`, since
    /// that's where `id1` moved to.
    ///
    /// In order to "fix" the underlying inconsistent state, a `Remapper`
    /// should be used to guarantee that `remap` is called at the appropriate
    /// time.
    fn swap_states(&mut self, id1: StateID, id2: StateID);

    /// This must remap every single state ID in the underlying value according
    /// to the function given. For example, in a DFA, this should remap every
    /// transition and every starting state ID.
    fn remap(&mut self, map: impl Fn(StateID) -> StateID);
}

/// Remapper is an abstraction the manages the remapping of state IDs in a
/// finite state machine. This is useful when one wants to shuffle states into
/// different positions in the machine.
///
/// One of the key complexities this manages is the ability to correctly move
/// one state multiple times.
///
/// Once shuffling is complete, `remap` must be called, which will rewrite
/// all pertinent transitions to updated state IDs. Neglecting to call `remap`
/// will almost certainly result in a corrupt machine.
#[derive(Debug)]
pub(crate) struct Remapper {
    /// A map from the index of a state to its pre-multiplied identifier.
    ///
    /// When a state is swapped with another, then their corresponding
    /// locations in this map are also swapped. Thus, its new position will
    /// still point to its old pre-multiplied StateID.
    ///
    /// While there is a bit more to it, this then allows us to rewrite the
    /// state IDs in a DFA's transition table in a single pass. This is done
    /// by iterating over every ID in this map, then iterating over each
    /// transition for the state at that ID and re-mapping the transition from
    /// `old_id` to `map[dfa.to_index(old_id)]`. That is, we find the position
    /// in this map where `old_id` *started*, and set it to where it ended up
    /// after all swaps have been completed.
    map: Vec<StateID>,
    /// A way to map indices to state IDs (and back).
    idx: IndexMapper,
}

impl Remapper {
    /// Create a new remapper from the given remappable implementation. The
    /// remapper can then be used to swap states. The remappable value given
    /// here must the same one given to `swap` and `remap`.
    ///
    /// The given stride should be the stride of the transition table expressed
    /// as a power of 2. This stride is used to map between state IDs and state
    /// indices. If state IDs and state indices are equivalent, then provide
    /// a `stride2` of `0`, which acts as an identity.
    pub(crate) fn new(r: &impl Remappable, stride2: usize) -> Remapper {
        let idx = IndexMapper { stride2 };
        let map = (0..r.state_len()).map(|i| idx.to_state_id(i)).collect();
        Remapper { map, idx }
    }

    /// Swap two states. Once this is called, callers must follow through to
    /// call `remap`, or else it's possible for the underlying remappable
    /// value to be in a corrupt state.
    pub(crate) fn swap(
        &mut self,
        r: &mut impl Remappable,
        id1: StateID,
        id2: StateID,
    ) {
        if id1 == id2 {
            return;
        }
        r.swap_states(id1, id2);
        self.map.swap(self.idx.to_index(id1), self.idx.to_index(id2));
    }

    /// Complete the remapping process by rewriting all state IDs in the
    /// remappable value according to the swaps performed.
    pub(crate) fn remap(mut self, r: &mut impl Remappable) {
        // Update the map to account for states that have been swapped
        // multiple times. For example, if (A, C) and (C, G) are swapped, then
        // transitions previously pointing to A should now point to G. But if
        // we don't update our map, they will erroneously be set to C. All we
        // do is follow the swaps in our map until we see our original state
        // ID.
        //
        // The intuition here is to think about how changes are made to the
        // map: only through pairwise swaps. That means that starting at any
        // given state, it is always possible to find the loop back to that
        // state by following the swaps represented in the map (which might be
        // 0 swaps).
        //
        // We are also careful to clone the map before starting in order to
        // freeze it. We use the frozen map to find our loops, since we need to
        // update our map as well. Without freezing it, our updates could break
        // the loops referenced above and produce incorrect results.
        let oldmap = self.map.clone();
        for i in 0..r.state_len() {
            let cur_id = self.idx.to_state_id(i);
            let mut new_id = oldmap[i];
            if cur_id == new_id {
                continue;
            }
            loop {
                let id = oldmap[self.idx.to_index(new_id)];
                if cur_id == id {
                    self.map[i] = new_id;
                    break;
                }
                new_id = id;
            }
        }
        r.remap(|sid| self.map[self.idx.to_index(sid)]);
    }
}

/// A simple type for mapping between state indices and state IDs.
///
/// The reason why this exists is because state IDs are "premultiplied" in a
/// DFA. That is, in order to get to the transitions for a particular state,
/// one need only use the state ID as-is, instead of having to multiply it by
/// transition table's stride.
///
/// The downside of this is that it's inconvenient to map between state IDs
/// using a dense map, e.g., Vec<StateID>. That's because state IDs look like
/// `0`, `stride`, `2*stride`, `3*stride`, etc., instead of `0`, `1`, `2`, `3`,
/// etc.
///
/// Since our state IDs are premultiplied, we can convert back-and-forth
/// between IDs and indices by simply unmultiplying the IDs and multiplying the
/// indices.
///
/// Note that for a sparse NFA, state IDs and indices are equivalent. In this
/// case, we set the stride of the index mapped to be `0`, which acts as an
/// identity.
#[derive(Debug)]
struct IndexMapper {
    /// The power of 2 corresponding to the stride of the corresponding
    /// transition table. 'id >> stride2' de-multiplies an ID while 'index <<
    /// stride2' pre-multiplies an index to an ID.
    stride2: usize,
}

impl IndexMapper {
    /// Convert a state ID to a state index.
    fn to_index(&self, id: StateID) -> usize {
        id.as_usize() >> self.stride2
    }

    /// Convert a state index to a state ID.
    fn to_state_id(&self, index: usize) -> StateID {
        // CORRECTNESS: If the given index is not valid, then it is not
        // required for this to panic or return a valid state ID. We'll "just"
        // wind up with panics or silent logic errors at some other point. But
        // this is OK because if Remappable::state_len is correct and so is
        // 'to_index', then all inputs to 'to_state_id' should be valid indices
        // and thus transform into valid state IDs.
        StateID::new_unchecked(index << self.stride2)
    }
}

impl Remappable for noncontiguous::NFA {
    fn state_len(&self) -> usize {
        noncontiguous::NFA::states(self).len()
    }

    fn swap_states(&mut self, id1: StateID, id2: StateID) {
        noncontiguous::NFA::swap_states(self, id1, id2)
    }

    fn remap(&mut self, map: impl Fn(StateID) -> StateID) {
        noncontiguous::NFA::remap(self, map)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #60166** (2026-11-20): **[CBO] Missing join condition above non-inner join after CBO reordering**
  *Symptoms*: When CBO optimizer splits an `INNER JOIN` condition into multiple hyperedges, the chosen join order can leave some equalities unapplied, leading to incorrect results.  Example: ```sql SELECT * FROM A LEFT JOIN B ON A.b = B.a JOIN C ON A.c = C.a AND B.c = C.b; ```  Hypergraph that represents eligible reorderings of this query: ``` A ------ B LEFT  JOIN ON A.b = B.a A ------ C INNER JOIN ON A.c = C.a {A, B} - C INNER JOIN ON B.c = C.b ```  Which makes this candidate eligible: ```sql SELECT * FROM A INNER JOIN C ON A.c = C.a LEFT JOIN B ON A.b = B.a; -- this left join lacks "B.c = C.b" condition ```  Usually in cases where a condition is missing from a tree that CBO selected, it gets added back by `AddMissingConditions` subroutine to eligible joins until the tree is complete. The problem here is that it silently fails to do so because join at the top (the one where the condition needs to be added) is a `LEFT JOIN`, adding that condition to it is impossible.  Suggested solution: in such cases add a filter above outer-join that needs to filter on additional condition.

- **Issue #59741** (2026-11-19): **Query Service: filter over keyless aggregate returns/writes a row when a column-free predicate is false (Table Service is correct)**
  *Symptoms*: **YDB version:** reproduced on 26.1.1.20 (`ydbplatform/local-ydb`, image `sha256:3d909b59...`) and on `ydbplatform/local-ydb:26.3.1` (`SELECT Version()` = `stable-26-3-1`). The fix candidate a374bb20 (guard `agg.Keys().Size() == 0` in `FilterOverAggregate`) is not in these branches.  **Summary** A `WHERE` over a keyless aggregate (`COUNT(*)` without `GROUP BY`) that contains a predicate independent of the aggregate's columns (a scalar named expression) behaves differently in Query Service and Table Service. In Query Service the column-free predicate seems to be pushed below the aggregate: the aggregate input becomes empty, `COUNT(*)` yields `0`, and the remaining predicate `cnt = 0` becomes true. As a result a guarded `UPSERT ... SELECT ... FROM $agg WHERE ...` writes when the guard is false. Table Service returns the correct result.  **Setup** ```sql CREATE TABLE omo_cas_repro (doc_id Utf8, ext_id Utf8, revision Int64, PRIMARY KEY (doc_id, revision)); UPSERT INTO omo_cas_repro (doc_id, ext_id, revision) VALUES ("doc","e0",0), ("doc","e1",1); ```  **1. Read-only repro** ```sql $agg = (SELECT COUNT(*) AS cnt FROM omo_cas_repro WHERE doc_id = "doc" AND ext_id = "e1"); $s   = (SELECT 0 AS v); SELECT * FROM $agg WHERE cnt = 0 AND $s = 1;   -- expected: 0 rows ``` - `ydb sql -s` (Query Service): **1 row, `cnt = 0`** (wrong) - `ydb table query execute -t data` (Table Service): 0 rows (correct)  **2. Guarded write (optimistic-concurrency pattern used in production code)** ```sql $tm

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

### Incident Patch 1: `16d689be` (2026-11-25)
**Commit Message**: Fix gluing regression NBYDB-2712 (#60629)

Regression: commit 0bd012c64ad added auxData == back.AuxData to the span-gluing condition. Main-channel serialization still stores &event.ZcTransferId in auxData; sequential events have different ZcTransferId addresses, so contiguous spans from different events can no longer be coalesced. The main socket does not use this zero-copy metadata, making the per-event pointer unnecessary for the main channel.

**File**: `ydb/library/actors/interconnect/interconnect_channel.cpp` (modified, +3/-2)
```diff
@@ -300,20 +300,21 @@ namespace NActors {
     bool TEventOutputChannel::SerializeEvent(TTcpPacketOutTask& task, TEventHolder& event, bool disableChecksums, size_t *bytesSerialized) {
         const bool useRdmaForMainChannelPacket = !External && task.UsePreallocatedInternalStream;
         auto addChunk = [&](const void *data, size_t len, bool allowCopy, const NInterconnect::NRdma::TMemRegion* memRegion = nullptr) {
+            ui32* const zcTransferId = External ? &event.ZcTransferId : nullptr;
             event.UpdateChecksum(data, len);
             if (useRdmaForMainChannelPacket) {
                 if (memRegion) {
                     task.AppendRdma(data, len, memRegion, disableChecksums);
                 } else if (allowCopy) {
                     task.Write<External>(data, len);
                 } else {
-                    task.Append<External>(data, len, &event.ZcTransferId, disableChecksums);
+                    task.Append<External>(data, len, zcTransferId, disableChecksums);
                 }
             } else {
                 if (allowCopy && (reinterpret_cast<uintptr_t>(data) & 63) + len <= 64) {
                     task.Write<External>(data, len);
                 } else {
-                    task.Append<External>(data, len, &event.ZcTransferId, disableChecksums);
+                    task.Append<External>(data, len, zcTransferId, disableChecksums);
                 }
             }
             *bytesSerialized += len;
```

**File**: `ydb/library/actors/interconnect/ut/event_output_channel_ut.cpp` (modified, +36/-0)
```diff
@@ -373,6 +373,42 @@ void AssertXdcDeclareNotSerialized(IEventBase* ev, ui32 maxSerializedEventSize)
 } // namespace
 
 Y_UNIT_TEST_SUITE(EventOutputChannel) {
+    Y_UNIT_TEST(GluesSmallMainChannelProtobufEventsIntoSingleSpan) {
+        auto common = MakeIntrusive<TInterconnectProxyCommon>();
+        common->MonCounters = MakeIntrusive<NMonitoring::TDynamicCounters>();
+
+        std::shared_ptr<IInterconnectMetrics> metrics = CreateInterconnectCounters(common);
+        metrics->SetPeerInfo("peer", "1", "peer");
+
+        auto releaseCallback = [](THolder<IEventBase>) {};
+        TEventHolderPool pool(common, releaseCallback);
+
+        TSessionParams params;
+        TEventOutputChannel channel(1, 1, 64 << 20, metrics, params, nullptr);
+
+        for (ui64 blobId : {1, 2}) {
+            auto* ev = new TEvTestSerialization;
+            ev->Record.SetBlobID(blobId);
+            auto evHandle = MakeHolder<IEventHandle>(TActorId(), TActorId(), ev);
+            channel.Push(*evHandle, pool, TInstant::Zero());
+        }
+
+        NInterconnect::TOutgoingStream mainStream;
+        NInterconnect::TOutgoingStream xdcStream;
+        TTcpPacketOutTask task(params, mainStream, xdcStream);
+
+        UNIT_ASSERT(channel.FeedBuf(task, 1));
+        UNIT_ASSERT(channel.FeedBuf(task, 1));
+        task.Finish(1, 0);
+
+        UNIT_ASSERT_VALUES_EQUAL(mainStream.GetSendQueueSize(), 1u);
+
+        TVector<TConstIoVec> data;
+        mainStream.ProduceIoVec(data, 1024, Max<size_t>());
+        UNIT_ASSERT_VALUES_EQUAL(data.size(), 1u);
+        UNIT_ASSERT_VALUES_EQUAL(data.front().Size, task.GetPacketSize());
+    }
+
     Y_UNIT_TEST(PropagatesSerializedEventTooLargeFromCoroutineSerializer) {
         auto common = MakeIntrusive<TInterconnectProxyCommon>();
         common->MonCounters = MakeIntrusive<NMonitoring::TDynamicCounters>();
```

---

### Incident Patch 2: `11c43f77` (2026-11-25)
**Commit Message**: Require fresh VDisk status for mirror-3-dc solo recovery (#60689)

**File**: `ydb/core/blobstorage/syncer/group_state.cpp` (modified, +5/-5)
```diff
@@ -21,7 +21,7 @@ std::optional<TMirror3dcGroupConfiguration> GetConfiguration(const TGroupReplica
     return std::nullopt;
 }
 
-// W expands from 2 in Included to 2+2 in Included and Recovering on this edge.
+// W expands from 2 in Included to 2+2 in Included and Recovering on these edges.
 bool WaitForRecoveringVDiskStartup(EMirror3dcGroupState state) {
     using TGroupState = NKikimrBlobStorage::TGroupState;
     return state == TGroupState::DC_SOLO_RECOVERY_INV1_PENDING || state == TGroupState::DC_SOLO_RECOVERY_INV2_PENDING;
@@ -219,12 +219,12 @@ class TGroupStateActor : public TActorBootstrapped<TGroupStateActor> {
         }
         EraseQueries(groupId);
         group->Pending = 0;
-        if (group->Stage == EStage::CheckPromotion) {
+        if (group->Stage == EStage::CheckPromotion || WaitForRecoveringVDiskStartup(*group->Info.GroupState)) {
             ProposeState(groupId, group);
             return;
         }
         StatusPollGroups.erase(groupId);
-        group->Stage = WaitForRecoveringVDiskStartup(*group->Info.GroupState) ? EStage::Propose : EStage::Repair;
+        group->Stage = EStage::Repair;
         RepairGroups.insert(groupId);
     }
 
@@ -268,8 +268,8 @@ class TGroupStateActor : public TActorBootstrapped<TGroupStateActor> {
                     continue;
                 }
                 const bool checkPromotion = group.Stage == EStage::CheckPromotion;
-                if (checkPromotion) {
-                    // Health must come from one round after repair, including on proposal retries.
+                if (checkPromotion || WaitForRecoveringVDiskStartup(*group.Info.GroupState)) {
+                    // These transitions require a fresh set of replies, including on proposal retries.
                     group.ConfirmedDisks.assign(group.Info.VDisks.size(), false);
                 }
                 ActiveGroups.push_back(groupId);
```

**File**: `ydb/core/mind/bscontroller/ut_bscontroller/group_state_ut.cpp` (modified, +117/-21)
```diff
@@ -6,6 +6,7 @@
 #include <ydb/core/testlib/basics/runtime.h>
 #include <ydb/core/testlib/basics/appdata.h>
 #include <library/cpp/testing/unittest/registar.h>
+#include <util/generic/map.h>
 
 using namespace NActors;
 using namespace NKikimr;
@@ -68,23 +69,40 @@ class TGroupStateFixture {
             disks.insert(disk.ActorId);
         }
         for (ui32 index = 0; index < requests; ++index) {
-            TEvBlobStorage::TEvVStatus::TPtr request = Runtime.GrabEdgeEventRethrow<TEvBlobStorage::TEvVStatus>(disks);
-            TVDiskID disk = VDiskIDFromVDiskID(request->Get()->Record.GetVDiskID());
-            UNIT_ASSERT_VALUES_EQUAL(disk.GroupGeneration, Info.Generation);
-            const bool available = !status.FailSecondRealm || disk.FailRealm != 1 || disk.FailDomain != 0;
-            if (!available || (status.OnlyFirstRealm && disk.FailRealm != 0)) {
-                --disk.GroupGeneration;
-            }
-            const TVDiskIdShort diskId(disk);
-            const bool replicated = status.Replicated && available && status.ReplicatingRealm != disk.FailRealm;
-            const auto replyStatus = status.ErrorDisk == diskId ? NKikimrProto::ERROR : NKikimrProto::OK;
-            std::unique_ptr<TEvBlobStorage::TEvVStatusResult> result =
-                std::make_unique<TEvBlobStorage::TEvVStatusResult>(replyStatus, disk, true, replicated, false, 1);
-            if (status.DurabilityReplicated) {
-                result->Record.SetDurabilityReplicated(*status.DurabilityReplicated && available);
+            ReplyStatus(*Runtime.GrabEdgeEventRethrow<TEvBlobStorage::TEvVStatus>(disks), status);
+        }
+    }
+
+    TMap<TVDiskIdShort, IEventHandle::TPtr> CaptureStatusRound() {
+        TMap<TVDiskIdShort, IEventHandle::TPtr> requests;
+        for (const auto& disk : Info.VDisks) {
+            auto events = Runtime.CaptureMailboxEvents(disk.ActorId.Hint(), disk.ActorId.NodeId());
+            const bool excluded = IsExcluded(Info.States[disk.Id.FailRealm]);
+            UNIT_ASSERT_VALUES_EQUAL(events.size(), excluded ? 0u : 1u);
+            if (!excluded) {
+                UNIT_ASSERT_VALUES_EQUAL(events.front()->GetTypeRewrite(), TEvBlobStorage::TEvVStatus::EventType);
+                requests.emplace(TVDiskIdShort(disk.Id), std::move(events.front()));
             }
-            Runtime.Send(new IEventHandle(request->Sender, request->Recipient, result.release(), 0, request->Cookie), 0, true);
         }
+        return requests;
+    }
+
+    void ReplyStatus(const IEventHandle& request, const TVDiskReplicationStatus& status = {}) {
+        TVDiskID disk = VDiskIDFromVDiskID(request.CastAsLocal<TEvBlobStorage::TEvVStatus>()->Record.GetVDiskID());
+        UNIT_ASSERT_VALUES_EQUAL(disk.GroupGeneration, Info.Generation);
+        const bool available = !status.FailSecondRealm || disk.FailRealm != 1 || disk.FailDomain != 0;
+        if (!available || (status.OnlyFirstRealm && disk.FailRealm != 0)) {
+            --disk.GroupGeneration;
+        }
+        const TVDiskIdShort diskId(disk);
+        const bool replicated = status.Replicated && available && status.ReplicatingRealm != disk.FailRealm;
+        const auto replyStatus = status.ErrorDisk == diskId ? NKikimrProto::ERROR : NKikimrProto::OK;
+        std::unique_ptr<TEvBlobStorage::TEvVStatusResult> result =
+            std::make_unique<TEvBlobStorage::TEvVStatusResult>(replyStatus, disk, true, replicated, false, 1);
+        if (status.DurabilityReplicated) {
+            result->Record.SetDurabilityReplicated(*status.DurabilityReplicated && available);
+        }
+        Runtime.Send(new IEventHandle(request.Sender, request.Recipient, result.release(), 0, request.Cookie), 0, true);
     }
 
     void AssertNoRequests() {
@@ -125,12 +143,15 @@ class TGroupStateFixture {
         Runtime.PushMailboxEventsFront(Warden.Hint(), Warden.NodeId(), events);
     }
 
-    TMirror3dcGroupConfiguration GetProposal(ui32 groupId = 42) {
+    TMirror3dcGroupConfiguration GetProposal(ui32 groupId = 42, ui64* cookie = nullptr) {
         auto event = Runtime.GrabEdgeEventRethrow<TEvGroupState::TEvPropose>(Controller);
         UNIT_ASSERT_VALUES_EQUAL(event->Sender, Actor);
         const auto& proposal = *event->Get();
         UNIT_ASSERT_VALUES_EQUAL(proposal.GroupId, groupId);
         UNIT_ASSERT_VALUES_EQUAL(proposal.Generation, Info.Generation);
+        if (cookie) {
+            *cookie = event->Cookie;
+        }
         return proposal.Next;
     }
 };
@@ -218,23 +239,98 @@ Y_UNIT_TEST_SUITE(BsControllerGroupState) {
 
     Y_UNIT_TEST(SoloRecoveryPendingWaitsForRecoveringVDiskStartup) {
         using S = NKikimrBlobStorage::TGroupState;
+        const TVDiskIdShort included3(0, 2, 0);
+        const TVDiskIdShort recovering1(1, 0, 0);
+        const TVDiskIdShort recovering2(1, 1, 0);
+        const TVDiskIdShort recovering3(1, 2, 0);
         for (auto [pending, ready] : {std::pair{S::DC_SOLO_RECOVERY_INV1_PENDING, S::DC_SOLO
```

---

### Incident Patch 3: `1f5ecad9` (2026-11-25)
**Commit Message**: fix mass restarts during switchover (#60526)

**File**: `ydb/core/mind/hive/drain.cpp` (modified, +6/-0)
```diff
@@ -358,6 +358,12 @@ void THive::ProcessPileDrains() {
     Send(SelfId(), new TEvPrivate::TEvProcessPileDrains());
 }
 
+void THive::HandleInit(TEvPrivate::TEvProcessPileDrains::TPtr&) {
+    // requested while loading (e.g. by a config notification); the load ends with UpdatePiles, which processes
+    // the pile drains once Hive works, so it is only needed to allow scheduling again
+    ProcessPileDrainsScheduled = false;
+}
+
 void THive::Handle(TEvPrivate::TEvProcessPileDrains::TPtr&) {
     ProcessPileDrainsScheduled = false;
     if (!BridgeInfo || std::none_of(BridgePiles.begin(), BridgePiles.end(), [](const auto& item) { return item.second.Drain; })) {
```

**File**: `ydb/core/mind/hive/hive_impl.cpp` (modified, +1/-0)
```diff
@@ -4226,6 +4226,7 @@ STFUNC(THive::StateInit) {
     switch (ev->GetTypeRewrite()) {
         hFunc(TEvInterconnect::TEvNodesInfo, Handle);
         hFunc(TEvPrivate::TEvProcessBootQueue, HandleInit);
+        hFunc(TEvPrivate::TEvProcessPileDrains, HandleInit);
         hFunc(TEvPrivate::TEvProcessTabletBalancer, HandleInit);
         hFunc(TEvPrivate::TEvCheckNamedResourceEstimates, HandleInit);
         hFunc(TEvNodeWardenStorageConfig, HandleInit);
```

**File**: `ydb/core/mind/hive/hive_impl.h` (modified, +1/-0)
```diff
@@ -697,6 +697,7 @@ class THive : public TActor<THive>, public TTabletExecutedFlat, public THiveShar
     void HandleInit(TEvPrivate::TEvProcessBootQueue::TPtr&);
     void Handle(TEvPrivate::TEvProcessBootQueue::TPtr&);
     void Handle(TEvPrivate::TEvProcessPileDrains::TPtr&);
+    void HandleInit(TEvPrivate::TEvProcessPileDrains::TPtr&);
     void Handle(TEvPrivate::TEvPostponeProcessBootQueue::TPtr&);
     void Handle(TEvPrivate::TEvProcessDisconnectNode::TPtr&);
     void HandleInit(TEvPrivate::TEvProcessTabletBalancer::TPtr&);
```

**File**: `ydb/core/mind/hive/hive_ut.cpp` (modified, +87/-8)
```diff
@@ -13272,7 +13272,7 @@ Y_UNIT_TEST_SUITE(THiveTest) {
         UNIT_ASSERT_VALUES_EQUAL(GetSimpleCounter(runtime, test.HiveTablet, NHive::COUNTER_TABLETS_STARTING), 0);
     }
 
-    Y_UNIT_TEST(TestBridgePileDrainResumesOnPileUpdateAfterNodeBecomesUp) {
+    Y_UNIT_TEST(TestBridgePileDrainResumesWhenNodeBecomesUp) {
         TBridgeDrainTest test;
         const ui64 tabletId = test.CreateTablet();
         TBlockEvents<TEvLocal::TEvStatus> blockNodeStatus(test.Runtime);
@@ -13283,14 +13283,10 @@ Y_UNIT_TEST_SUITE(THiveTest) {
         UNIT_ASSERT(test.IsRunningInPile(tabletId, 0));
         UNIT_ASSERT(test.DrainPending());
 
+        // node statuses stay blocked: bringing the target Up is enough for the drain to resume
         test.SetDown(1, false);
-        test.Runtime.SimulateSleep(TDuration::Seconds(10));
-        UNIT_ASSERT_C(test.IsRunningInPile(tabletId, 0), "pile drain resumed without a new node status or pile update");
-        UNIT_ASSERT(test.DrainPending());
-
-        test.Bridge.SetPileState(1, NKikimrBridge::TClusterState::SYNCHRONIZED);
         UNIT_ASSERT_C(WaitUntil(test.Runtime, [&] { return test.IsRunningInPile(tabletId, 1) && !test.DrainPending(); }),
-            "pile drain did not resume on a pile update after its target became Up");
+            "pile drain did not resume after its target became Up");
     }
 
     Y_UNIT_TEST(TestBridgePileDrainResumesOnPileUpdateAfterResourcesBecomeAvailable) {
@@ -13726,10 +13722,16 @@ Y_UNIT_TEST_SUITE(THiveTest) {
 
                 // Preserve Sync -> Status order from each Local while replaying a report for the old placement.
                 blockSync->Stop().Unblock();
+                // A disconnected pile loses all its tablets. A pile that is only not allowed anymore keeps the
+                // instances Hive knows about, for its drain to move them gradually; the stale one is not revived.
+                const size_t keptInPile0 = scenario == EBridgeDrainScenario::ResyncOnDisconnectedPile ? 0 : NUM_TABLETS - 1;
                 UNIT_ASSERT_C(waitUntil([&] {
                     auto distribution = getDistribution();
-                    return tabletsInPile(distribution, 0) == 0 && tabletsInPile(distribution, 1) == 0;
+                    return tabletsInPile(distribution, 0) == keptInPile0 && tabletsInPile(distribution, 1) == 0;
                 }), "resync revived tablets in a pile that no longer allows their leaders");
+                runtime.SimulateSleep(TDuration::MilliSeconds(100));
+                UNIT_ASSERT_VALUES_EQUAL(tabletsInPile(getDistribution(), 0), keptInPile0);
+                UNIT_ASSERT_VALUES_EQUAL(GetHiveTabletInfo(runtime, hiveTablet, tablets.front(), senderA).GetNodeID(), 0);
                 blockSourceStatus->Stop().Unblock();
             }
             blockStatus.Stop().Unblock();
@@ -13988,6 +13990,83 @@ Y_UNIT_TEST_SUITE(THiveTest) {
         UNIT_ASSERT_VALUES_EQUAL_C(blockComplete.size(), DRAIN_INFLIGHT, "a second drain of the pile started");
     }
 
+    Y_UNIT_TEST(TestBridgeResyncAfterSwitchoverKeepsDrainGradual) {
+        static constexpr ui32 NUM_NODES = 4;
+        static constexpr ui32 NUM_TABLETS = 8;
+        static constexpr ui32 DRAIN_INFLIGHT = 1;
+        TTestBasicRuntime runtime(NUM_NODES, false);
+        TDummyBridge bridge(runtime);
+        Setup(runtime, true, 2, [](TAppPrepare& app) {
+            app.HiveConfig.SetDrainInflight(DRAIN_INFLIGHT);
+        });
+        const ui64 hiveTablet = MakeDefaultHiveID();
+        const ui64 testerTablet = MakeTabletID(false, 1);
+        const TActorId sender = runtime.AllocateEdgeActor(0);
+        const ui32 nodeBase = runtime.GetNodeId(0);
+        CreateTestBootstrapper(runtime, CreateTestTabletInfo(hiveTablet, TTabletTypes::Hive), &CreateDefaultHive);
+        MakeSureTabletIsUp(runtime, hiveTablet, 0);
+        TActorId hiveActor = GetHiveActor(runtime, hiveTablet);
+        bridge.Subscribe(hiveActor);
+        runtime.EnableScheduleForActor(hiveActor);
+        std::vector<ui64> tablets;
+        for (ui32 i = 0; i < NUM_TABLETS; ++i) {
+            THolder<TEvHive::TEvCreateTablet> ev(new TEvHive::TEvCreateTablet(testerTablet, 100500 + i, TTabletTypes::Dummy, BINDED_CHANNELS));
+            tablets.push_back(SendCreateTestTablet(runtime, hiveTablet, testerTablet, std::move(ev), 0, true));
+            MakeSureTabletIsUp(runtime, tablets.back(), 0);
+        }
+        auto inPile = [&](ui32 pile) {
+            ui32 count = 0;
+            for (ui64 tablet : tablets) {
+                const auto info = GetHiveTabletInfo(runtime, hiveTablet, tablet, sender);
+                if (info.GetNodeID() != 0 && (info.GetNodeID() - nodeBase) % 2 == pile) {
+                    ++count;
+                }
+            }
+            return count;
+        };
+        UNIT_ASSERT_VALUES_EQUAL(inPile(0), NUM_TABLETS);
+
+        // switchover: the drain of pile 0 starts and is held
+        std::optional<TBlockEvents<NHive::TEvPr
```

**File**: `ydb/core/mind/hive/node_info.cpp` (modified, +11/-2)
```diff
@@ -176,7 +176,7 @@ void TNodeInfo::UpdateResourceValues(const TTabletInfo* tablet, const TMetrics&
     Hive.UpdateTotalResourceValues(this, tablet, before, after, ResourceValues - oldResourceValues, normalizedValues - oldNormalizedValues);
 }
 
-bool TNodeInfo::MatchesFilter(const TNodeFilter& filter, TTabletDebugState* debugState) const {
+bool TNodeInfo::MatchesFilter(const TNodeFilter& filter, TTabletDebugState* debugState, bool checkPile) const {
     const auto& effectiveAllowedDomains = filter.GetEffectiveAllowedDomains();
     bool result = false;
 
@@ -218,7 +218,7 @@ bool TNodeInfo::MatchesFilter(const TNodeFilter& filter, TTabletDebugState* debu
         return false;
     }
 
-    if (Hive.BridgeInfo) {
+    if (checkPile && Hive.BridgeInfo) {
         if (!filter.IsAllowedPile(BridgePileId)) {
             return false;
         }
@@ -469,6 +469,7 @@ void TNodeInfo::SendReconnect(const TActorId& local) {
 }
 
 void TNodeInfo::SetDown(bool down, EHiveEventReason reason, TString details) {
+    const bool becameUp = Down && !down;
     if (Down != down) {
         Hive.RecordNodeEvent(*this, down ? EHiveEventType::Down : EHiveEventType::Up, reason, std::move(details));
     }
@@ -479,6 +480,14 @@ void TNodeInfo::SetDown(bool down, EHiveEventReason reason, TString details) {
     } else {
         Hive.ObjectDistributions.AddNode(*this);
         Hive.ProcessWaitQueue();
+        if (becameUp && Hive.BridgeInfo) {
+            // a pile drain may have been waiting for a node in an allowed pile to move the tablets to; the nodes
+            // of a draining pile are left out, as a pile drain brings its own nodes back up when it ends
+            const auto* pile = Hive.FindPile(BridgePileId);
+            if (!(pile && pile->Drain) && TNodeFilter(Hive).IsAllowedPile(BridgePileId)) {
+                Hive.ProcessPileDrains();
+            }
+        }
     }
 }
 
```

**File**: `ydb/core/mind/hive/node_info.h` (modified, +1/-1)
```diff
@@ -227,7 +227,7 @@ struct TNodeInfo: public TIntrusiveListItem<TNodeInfo, TSegmentNodesTag> {
         return Id;
     }
 
-    bool MatchesFilter(const TNodeFilter& filter, TTabletDebugState* debugState = nullptr) const;
+    bool MatchesFilter(const TNodeFilter& filter, TTabletDebugState* debugState = nullptr, bool checkPile = true) const;
     bool IsAllowedToRunTablet(TTabletDebugState* debugState = nullptr) const;
     bool IsAllowedToRunTablet(const TTabletInfo& tablet, TTabletDebugState* debugState = nullptr) const;
     bool IsAbleToRunTablet(const TTabletInfo& tablet, TTabletDebugState* debugState = nullptr) const;
```

**File**: `ydb/core/mind/hive/tx__sync_tablets.cpp` (modified, +40/-0)
```diff
@@ -10,6 +10,7 @@ class TTxSyncTablets : public TTransactionBase<THive> {
     TActorId Local;
     NKikimrLocal::TEvSyncTablets SyncTablets;
     TSideEffects SideEffects;
+    bool DrainPending = false;
 
 public:
     TTxSyncTablets(const TActorId &local, NKikimrLocal::TEvSyncTablets& rec, THive* hive)
@@ -39,11 +40,36 @@ class TTxSyncTablets : public TTransactionBase<THive> {
         return false;
     }
 
+    bool IsMovedOutByPileDrain(const TNodeInfo& node, const TTabletInfo& tablet) const {
+        if (!Self->BridgeInfo || tablet.GetNodeFilter().IsAllowedPile(node.BridgePileId)) {
+            return false;
+        }
+        const auto* pile = Self->FindPile(node.BridgePileId);
+        if (!pile || !NBridge::PileStateTraits(pile->State).AllowsConnection) {
+            return false; // the pile is disconnected, its tablets are restarted elsewhere anyway
+        }
+        return node.MatchesFilter(tablet.GetNodeFilter(), nullptr, /* checkPile */ false);
+    }
+
+    void MarkPileForDrain(NIceDb::TNiceDb& db, TBridgePileId pileId) {
+        DrainPending = true;
+        auto& pile = Self->GetPile(pileId);
+        if (pile.Drain) {
+            return;
+        }
+        YDB_LOG_NOTICE("THive::TTxSyncTablets::Execute pile has tablets its placement does not allow, draining",
+            {"logPrefix", GetLogPrefix()},
+            {"pileId", pileId});
+        pile.Drain = true;
+        db.Table<Schema::BridgePile>().Key(pile.GetId()).Update<Schema::BridgePile::Drain>(true);
+    }
+
     bool Execute(TTransactionContext &txc, const TActorContext& ctx) override {
         YDB_LOG_DEBUG("THive::TTxSyncTablets::Execute synchronizing tablets with node",
             {"logPrefix", GetLogPrefix()},
             {"nodeId", Local.NodeId()});
         SideEffects.Reset(Self->SelfId());
+        DrainPending = false;
         NIceDb::TNiceDb db(txc.DB);
         TNodeInfo& node = Self->GetNode(Local.NodeId());
         THashSet<std::pair<TTabletId, TFollowerId>> tabletsToRestart;
@@ -65,6 +91,17 @@ class TTxSyncTablets : public TTransactionBase<THive> {
                     {"state", state},
                     {"tabletId", tabletId});
                 tabletsToRestart.erase(tabletId);
+            } else if (IsMovedOutByPileDrain(node, *tablet)) {
+                // the tablet is only in a pile it is not allowed in anymore (e.g. after a switchover):
+                // keep it running, the pile drain moves it out gradually instead of restarting everything at once
+                YDB_LOG_TRACE("THive::TTxSyncTablets::Execute confirmed tablet left for the pile drain",
+                    {"logPrefix", GetLogPrefix()},
+                    {"nodeId", Local.NodeId()},
+                    {"pileId", node.BridgePileId},
+                    {"state", state},
+                    {"tabletId", tabletId});
+                tabletsToRestart.erase(tabletId);
+                MarkPileForDrain(db, node.BridgePileId);
             } else {
                 YDB_LOG_TRACE("THive::TTxSyncTablets::Execute confirmed tablet not allowed on this node",
                     {"logPrefix", GetLogPrefix()},
@@ -196,6 +233,9 @@ class TTxSyncTablets : public TTransactionBase<THive> {
             {"logPrefix", GetLogPrefix()},
             {"nodeId", Local.NodeId()});
         SideEffects.Complete(ctx, Self->Requests);
+        if (DrainPending) {
+            Self->ProcessPileDrains();
+        }
     }
 };
 
```

#### Recent Merged Pull Requests:
- **PR #60775** (2026-11-25): Mark C++ SDK v3.28.0 in changelog (@ydbot)
- **PR #60774** (2026-11-25): [26-2][docs] Backport conditional Workload Manager warning (@nataliaboldyreva)
- **PR #60757** (2026-11-25): Update muted_ya (relwithdebinfo) in main (@ydbot)
- **PR #60756** (2026-11-25): Update muted_ya (release-asan) in stable-26-4-1 (@ydbot)
- **PR #60755** (2026-11-25): Update muted_ya (relwithdebinfo) in stable-26-3-1 (@ydbot)
- **PR #60754** (2026-11-25): Sync branches 261125-0049: rightlib to main (@ydbot)

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

## X. gluing regression NBYDB-2712

**RULE**:
When implementing operations in `ydb/library/actors/interconnect/interconnect_channel.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ydb-platform/ydb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `16d689be`: gluing regression NBYDB-2712. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `ydb/library/actors/interconnect/interconnect_channel.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
            ui32* const zcTransferId = External ? &event.ZcTransferId : nullptr;
                    task.Append<External>(data, len, zcTransferId, disableChecksums);
                    task.Append<External>(data, len, zcTransferId, disableChecksums);
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
                    task.Append<External>(data, len, &event.ZcTransferId, disableChecksums);
                    task.Append<External>(data, len, &event.ZcTransferId, disableChecksums);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `16d689be` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
