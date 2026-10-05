# Forensic Learning Record (Deep Inspection): ntex-rs/ntex

> **Canonical Artifact**: `07_PROJECT_LEARNING/ntex-rs-ntex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ntex-rs/ntex](https://github.com/ntex-rs/ntex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:23:29.153Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ntex-rs/ntex`
- **Description**: framework for composable networking services 
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2538 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ntex-bytes/benches/buf.rs`
```
#![deny(warnings, rust_2018_idioms)]
#![allow(clippy::all, clippy::pedantic)]

use std::hint::black_box;

use criterion::{Criterion, criterion_group, criterion_main};
use ntex_bytes::Buf;

/// Dummy Buf implementation
struct TestBuf {
    buf: &'static [u8],
    readlens: &'static [usize],
    init_pos: usize,
    pos: usize,
    readlen_pos: usize,
    readlen: usize,
}
impl TestBuf {
    fn new(buf: &'static [u8], readlens: &'static [usize], init_pos: usize) -> TestBuf {
        let mut buf = TestBuf {
            buf,
            readlens,
            init_pos,
            pos: 0,
            readlen_pos: 0,
            readlen: 0,
        };
        buf.reset();
        buf
    }
    fn reset(&mut self) {
        self.pos = self.init_pos;
        self.readlen_pos = 0;
        self.next_readlen();
    }
    /// Compute the length of the next read :
    /// - use the next value specified in readlens (capped by remaining) if any
    /// - else the remaining
    fn next_readlen(&mut self) {
        self.readlen = self.buf.len() - self.pos;
        if let Some(readlen) = self.readlens.get(self.readlen_pos) {
            self.readlen = std::cmp::min(self.readlen, *readlen);
            self.readlen_pos += 1;
        }
    }
}
impl Buf for TestBuf {
    fn remaining(&self) -> usize {
        self.buf.len() - self.pos
    }
    fn advance(&mut self, cnt: usize) {
        self.pos += cnt;
        assert!(self.pos <= self.buf.len());
        self.next_readlen();
    }
    fn chunk(&self) -> &[u8] {
        if self.readlen == 0 {
            Default::default()
        } else {
            &self.buf[self.pos..self.pos + self.readlen]
        }
    }
}

/// Dummy Buf implementation
///  version with methods forced to not be inlined (to simulate costly calls)
struct TestBufC {
    inner: TestBuf,
}
impl TestBufC {
    fn new(buf: &'static [u8], readlens: &'static [usize], init_pos: usize) -> TestBufC {
        TestBufC {
            inner: TestBuf::new(buf, readlens, init_pos),
        }
    }
    fn reset(&mut self) {
        self.inner.reset()
    }
}
impl Buf for TestBufC {
    #[inline(never)]
    fn remaining(&self) -> usize {
        self.inner.remaining()
    }
    #[inline(never)]
    fn advance(&mut self, cnt: usize) {
        self.inner.advance(cnt)
    }
    #[inline(never)]
    fn chunk(&self) -> &[u8] {
        self.inner.chunk()
    }
}

macro_rules! bench {
    ($c:expr, $name:expr, testbuf $testbuf:ident $readlens:expr, $method:ident $(,$arg:expr)*) => {{
        let mut bufs = [
            $testbuf::new(&[1u8; 8 + 0], $readlens, 0),
            $testbuf::new(&[1u8; 8 + 1], $readlens, 1),
            $testbuf::new(&[1u8; 8 + 2], $readlens, 2),
            $testbuf::new(&[1u8; 8 + 3], $readlens, 3),
            $testbuf::new(&[1u8; 8 + 4], $readlens, 4),
            $testbuf::new(&[1u8; 8 + 5], $readlens, 5),
            $testbuf::new(&[1u8; 8 + 6], $readlens, 6),
            $testbuf::new(&[1u8; 8 + 7], $readlens, 7),
        ];
        $c.bench_function($name, |b| {
            b.iter(|| {
                for buf in bufs.iter_mut() {
                    buf.reset();
                    let buf: &mut dyn Buf = buf; // type erasure
                    black_box(buf.$method($($arg,)*));
                }
            })
        });
    }};
    ($c:expr, $name:expr, slice, $method:ident $(,$arg:expr)*) => {{
        // buf must be long enough for one read of 8 bytes starting at pos 7
        let arr = [1u8; 8 + 7];
        $c.bench_function($name, |b| {
            b.iter(|| {
                for i in 0..8 {
                    let mut buf = &arr[i..];
                    let buf = &mut buf as &mut dyn Buf; // type erasure
                    black_box(buf.$method($($arg,)*));
                }
            })
        });
    }};
}

macro_rules! bench_group {
    ($c:expr, $group:literal, $method:ident $(,$arg:expr)*) => {
        bench!($c, concat!($group, "/slice"), slice, $method $(,$arg)*);
        bench!($c, concat!($group, "/tbuf_1"), testbuf TestBuf &[], $method $(,$arg)*);
        bench!($c, concat!($group, "/tbuf_1_costly"), testbuf TestBufC &[], $method $(,$arg)*);
        bench!($c, concat!($group, "/tbuf_2"), testbuf TestBuf &[1], $method $(,$arg)*);
        bench!($c, concat!($group, "/tbuf_2_costly"), testbuf TestBufC &[1], $method $(,$arg)*);
    };
}

fn benches(c: &mut Criterion) {
    bench_group!(c, "get_u8", get_u8);
    bench_group!(c, "get_u16", get_u16);
    bench_group!(c, "get_u32", get_u32);
    bench_group!(c, "get_u64", get_u64);
    bench_group!(c, "get_f32", get_f32);
    bench_group!(c, "get_f64", get_f64);
    bench_group!(c, "get_uint24", get_uint, 3);
}

criterion_group!(bench, benches);
criterion_main!(bench);

```

### Core Architecture Module: `ntex-bytes/benches/bytes.rs`
```
#![deny(warnings, rust_2018_idioms)]
#![allow(clippy::all, clippy::pedantic)]

use std::hint::black_box;

use criterion::{Bencher, Criterion, Throughput, criterion_group, criterion_main};
use ntex_bytes::{BufMut, Bytes, BytesMut};

fn alloc_small(b: &mut Bencher<'_>) {
    b.iter(|| {
        for _ in 0..1024 {
            black_box(BytesMut::with_capacity(12));
        }
    })
}

fn alloc_mid(b: &mut Bencher<'_>) {
    b.iter(|| {
        black_box(BytesMut::with_capacity(128));
    })
}

fn alloc_big(b: &mut Bencher<'_>) {
    b.iter(|| {
        black_box(BytesMut::with_capacity(4096));
    })
}

fn split_off_and_drop(b: &mut Bencher<'_>) {
    b.iter(|| {
        for _ in 0..1024 {
            let v = vec![10; 200];
            let mut b = Bytes::from(v);
            black_box(b.split_off(100));
            black_box(b);
        }
    })
}

fn deref_unique(b: &mut Bencher<'_>) {
    let mut buf = BytesMut::with_capacity(4096);
    buf.put(&[0u8; 1024][..]);

    b.iter(|| {
        for _ in 0..1024 {
            black_box(&buf[..]);
        }
    })
}

fn deref_unique_unroll(b: &mut Bencher<'_>) {
    let mut buf = BytesMut::with_capacity(4096);
    buf.put(&[0u8; 1024][..]);

    b.iter(|| {
        for _ in 0..128 {
            black_box(&buf[..]);
            black_box(&buf[..]);
            black_box(&buf[..]);
            black_box(&buf[..]);
            black_box(&buf[..]);
            black_box(&buf[..]);
            black_box(&buf[..]);
            black_box(&buf[..]);
        }
    })
}

fn deref_shared(b: &mut Bencher<'_>) {
    let mut buf = BytesMut::with_capacity(4096);
    buf.put(&[0u8; 1024][..]);
    let buf = buf.freeze();
    let _b2 = buf.clone();

    b.iter(|| {
        for _ in 0..1024 {
            black_box(&buf[..]);
        }
    })
}

fn deref_inline(b: &mut Bencher<'_>) {
    let mut buf = BytesMut::with_capacity(8);
    buf.put(&[0u8; 8][..]);

    b.iter(|| {
        for _ in 0..1024 {
            black_box(&buf[..]);
        }
    })
}

fn deref_two(b: &mut Bencher<'_>) {
    let mut buf1 = BytesMut::with_capacity(8);
    buf1.put(&[0u8; 8][..]);

    let mut buf2 = BytesMut::with_capacity(4096);
    buf2.put(&[0u8; 1024][..]);

    b.iter(|| {
        for _ in 0..512 {
            black_box(&buf1[..]);
            black_box(&buf2[..]);
        }
    })
}

fn clone_inline(b: &mut Bencher<'_>) {
    let bytes = Bytes::from_static(b"hello world");

    b.iter(|| {
        for _ in 0..1024 {
            black_box(&bytes.clone());
        }
    })
}

fn clone_static(b: &mut Bencher<'_>) {
    let bytes =
        Bytes::from_static("hello world 1234567890 and have a good byte 0987654321".as_bytes());

    b.iter(|| {
        for _ in 0..1024 {
            black_box(&bytes.clone());
        }
    })
}

fn clone_arc(b: &mut Bencher<'_>) {
    let bytes = Bytes::from(b"hello world 1234567890 and have a good byte 0987654321".to_vec());

    b.iter(|| {
        for _ in 0..1024 {
            black_box(&bytes.clone());
        }
    })
}

fn alloc_write_split_to_mid(b: &mut Bencher<'_>) {
    b.iter(|| {
        let mut buf = BytesMut::with_capacity(128);
        buf.put_slice(&[0u8; 64]);
        black_box(buf.split_to(64));
    })
}

fn drain_write_drain(b: &mut Bencher<'_>) {
    let data = [0u8; 128];

    b.iter(|| {
        let mut buf = BytesMut::with_capacity(1024);
        let mut parts = Vec::with_capacity(8);

        for _ in 0..8 {
            buf.put(&data[..]);
            parts.push(buf.split_to(128));
        }

        black_box(parts);
    })
}

fn fmt_write(b: &mut Bencher<'_>) {
    use std::fmt::Write;
    let mut buf = BytesMut::with_capacity(128);
    let s = "foo bar baz quux lorem ipsum dolor et";

    b.iter(|| {
        let _ = write!(buf, "{}", s);
        black_box(&buf);
        buf.clear();
    })
}

fn from_long_slice(b: &mut Bencher<'_>) {
    let data = [0u8; 128];
    b.iter(|| {
        let buf = BytesMut::from(&data[..]);
        black_box(buf);
    })
}

fn slice_empty(b: &mut Bencher<'_>) {
    b.iter(|| {
        let b = Bytes::from(vec![17; 1024]).clone();
        for i in 0..1000 {
            black_box(b.slice(i % 100..i % 100));
        }
    })
}

fn slice_short_from_arc(b: &mut Bencher<'_>) {
    b.iter(|| {
        // `clone` is to convert to ARC
        let b = Bytes::from(vec![17; 1024]).clone();
        for i in 0..1000 {
            black_box(b.slice(1..2 + i % 10));
        }
    })
}

// Keep in sync with storage.rs
#[cfg(target_pointer_width = "64")]
const INLINE_CAP: usize = 3 * 8 - 1;
#[cfg(target_pointer_width = "32")]
const INLINE_CAP: usize = 3 * 4 - 1;

fn slice_avg_le_inline_from_arc(b: &mut Bencher<'_>) {
    b.iter(|| {
        // `clone` is to convert to ARC
        let b = Bytes::from(vec![17; 1024]).clone();
        for i in 0..1000 {
            // [1, INLINE_CAP]
            let len = 1 + i % (INLINE_CAP - 1);
            black_box(b.slice(i % 10..i % 10 + len));
        }
    })
}

fn slice_large_le_inline_from_arc(b: &mut Bencher<'_>) {
    b.iter(|| {
        // `clone` is to convert to ARC
        let b = Bytes::from(vec![17; 1024]).clone();
        for i in 0..1000 {
            // [INLINE_CAP - 10, INLINE_CAP]
            let len = INLINE_CAP - 9 + i % 10;
            black_box(b.slice(i % 10..i % 10 + len));
        }
    })
}

fn benches(c: &mut Criterion) {
    c.bench_function("alloc_small", alloc_small);
    c.bench_function("alloc_mid", alloc_mid);
    c.bench_function("alloc_big", alloc_big);
    c.bench_function("split_off_and_drop", split_off_and_drop);
    c.bench_function("deref_unique", deref_unique);
    c.bench_function("deref_unique_unroll", deref_unique_unroll);
    c.bench_function("deref_shared", deref_shared);
    c.bench_function("deref_inline", deref_inline);
    c.bench_function("deref_two", deref_two);
    c.bench_function("clone_inline", clone_inline);
    c.bench_function("clone_static", clone_static);
    c.bench_function("clone_arc", clone_arc);
    c.bench_function("alloc_write_split_to_mid", alloc_write_split_to_mid);
    c.bench_function("drain_write_drain", drain_write_drain);
    c.benchmark_group("fmt_write")
        .throughput(Throughput::Bytes(37))
        .bench_function("fmt_write", fmt_write);
    c.benchmark_group("from_long_slice")
        .throughput(Throughput::Bytes(128))
        .bench_function("from_long_slice", from_long_slice);
    c.bench_function("slice_empty", slice_empty);
    c.bench_function("slice_short_from_arc", slice_short_from_arc);
    c.bench_function("slice_avg_le_inline_from_arc", slice_avg_le_inline_from_arc);
    c.bench_function(
        "slice_large_le_inline_from_arc",
        slice_large_le_inline_from_arc,
    );
}

criterion_group!(bench, benches);
criterion_main!(bench);

```

### Core Architecture Module: `ntex-bytes/src/buf/buf_impl.rs`
```
use std::{cmp, mem};

macro_rules! buf_get_impl {
    ($this:ident, $typ:tt::$conv:tt) => {{
        const SIZE: usize = mem::size_of::<$typ>();
        // try to convert directly from the bytes
        // this Option<ret> trick is to avoid keeping a borrow on self
        // when advance() is called (mut borrow) and to call chunk() only once
        #[allow(clippy::ptr_as_ptr)]
        let ret = $this
            .chunk()
            .get(..SIZE)
            .map(|src| unsafe { $typ::$conv(*(std::ptr::from_ref(src) as *const [_; SIZE])) });

        if let Some(ret) = ret {
            // if the direct conversion was possible, advance and return
            $this.advance(SIZE);
            return ret;
        }
        // if not we copy the bytes in a temp buffer then convert
        let mut buf = [0; SIZE];
        $this.copy_to_slice(&mut buf); // (do the advance)
        return $typ::$conv(buf);
    }};
    (le => $this:ident, $typ:tt, $len_to_read:expr) => {{
        debug_assert!(mem::size_of::<$typ>() >= $len_to_read);

        // The same trick as above does not improve the best case speed.
        // It seems to be linked to the way the method is optimised by the compiler
        let mut buf = [0; (mem::size_of::<$typ>())];
        $this.copy_to_slice(&mut buf[..($len_to_read)]);
        return $typ::from_le_bytes(buf);
    }};
    (be => $this:ident, $typ:tt, $len_to_read:expr) => {{
        debug_assert!(mem::size_of::<$typ>() >= $len_to_read);

        let mut buf = [0; (mem::size_of::<$typ>())];
        $this.copy_to_slice(&mut buf[mem::size_of::<$typ>() - ($len_to_read)..]);
        return $typ::from_be_bytes(buf);
    }};
}

/// Interprets the low `nbytes` bytes of `val` as a two's complement integer.
fn sign_extend(val: u64, nbytes: usize) -> i64 {
    if nbytes == 0 {
        0
    } else {
        let shift = (8 - nbytes) * 8;
        ((val << shift).cast_signed()) >> shift
    }
}

/// Read bytes from a buffer.
///
/// A buffer stores bytes in memory such that read operations are infallible.
/// The underlying storage may or may not be in contiguous memory. A `Buf` value
/// is a cursor into the buffer. Reading from `Buf` advances the cursor
/// position. It can be thought of as an efficient `Iterator` for collections of
/// bytes.
///
/// The simplest `Buf` is a `&[u8]`.
///
/// ```
/// use ntex_bytes::Buf;
///
/// let mut buf = &b"hello world"[..];
///
/// assert_eq!(b'h', buf.get_u8());
/// assert_eq!(b'e', buf.get_u8());
/// assert_eq!(b'l', buf.get_u8());
///
/// let mut rest = [0; 8];
/// buf.copy_to_slice(&mut rest);
///
/// assert_eq!(&rest[..], &b"lo world"[..]);
/// ```
pub trait Buf {
    /// Returns the number of bytes between the current position and the end of
    /// the buffer.
    ///
    /// This value is greater than or equal to the length of the slice returned
    /// by `chunk`.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Buf;
    ///
    /// let mut buf = &b"hello world"[..];
    ///
    /// assert_eq!(buf.remaining(), 11);
    ///
    /// buf.get_u8();
    ///
    /// assert_eq!(buf.remaining(), 10);
    /// ```
    ///
    /// # Implementer notes
    ///
    /// Implementations of `remaining` should ensure that the return value does
    /// not change unless a call is made to `advance` or any other function that
    /// is documented to change the `Buf`'s current position.
    fn remaining(&self) -> usize;

    /// Returns a slice starting at the current position and of length between 0
    /// and `Buf::remaining()`. Note that this *can* return shorter slice (this allows
    /// non-continuous internal representation).
    ///
    /// This is a lower level function. Most operations are done with other
    /// functions.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Buf;
    ///
    /// let mut buf = &b"hello world"[..];
    ///
    /// assert_eq!(buf.chunk(), &b"hello world"[..]);
    ///
    /// buf.advance(6);
    ///
    /// assert_eq!(buf.chunk(), &b"world"[..]);
    /// ```
    ///
    /// # Implementer notes
    ///
    /// This function should never panic. Once the end of the buffer is reached,
    /// i.e., `Buf::remaining` returns 0, calls to `chunk` should return an
    /// empty slice.
    fn chunk(&self) -> &[u8];

    /// Advance the internal cursor of the Buf
    ///
    /// The next call to `chunk` will return a slice starting `cnt` bytes
    /// further into the underlying buffer.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Buf;
    ///
    /// let mut buf = &b"hello world"[..];
    ///
    /// assert_eq!(buf.chunk(), &b"hello world"[..]);
    ///
    /// buf.advance(6);
    ///
    /// assert_eq!(buf.chunk(), &b"world"[..]);
    /// ```
    ///
    /// # Panics
    ///
    /// This function **may** panic if `cnt > self.remaining()`.
    ///
    /// # Implementer notes
    ///
    /// It is recommended for implementations of `advance` to panic if `cnt >
    /// self.remaining()`. If the implementation does not panic, the call must
    /// behave as if `cnt == self.remaining()`.
    ///
    /// A call with `cnt == 0` should never panic and be a no-op.
    fn advance(&mut self, cnt: usize);

    /// Returns true if there are any more bytes to consume
    ///
    /// This is equivalent to `self.remaining() != 0`.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Buf;
    ///
    /// let mut buf = &b"a"[..];
    ///
    /// assert!(buf.has_remaining());
    ///
    /// buf.get_u8();
    ///
    /// assert!(!buf.has_remaining());
    /// ```
    fn has_remaining(&self) -> bool {
        self.remaining() > 0
    }

    /// Copies bytes from `self` into `dst`.
    ///
    /// The cursor is advanced by the number of bytes copied. `self` must have
    /// enough remaining bytes to fill `dst`.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Buf;
    ///
    /// let mut buf = &b"hello world"[..];
    /// let mut dst = [0; 5];
    ///
    /// buf.copy_to_slice(&mut dst);
    /// assert_eq!(&b"hello"[..], &dst);
    /// assert_eq!(6, buf.remaining());
    /// ```
    ///
    /// # Panics
    ///
    /// This function panics if `self.remaining() < dst.len()`
    fn copy_to_slice(&mut self, dst: &mut [u8]) {
        let mut off = 0;

        assert!(self.remaining() >= dst.len());

        while off < dst.len() {
            let src = self.chunk();
            let cnt = cmp::min(src.len(), dst.len() - off);
            dst[off..off + cnt].copy_from_slice(&src[..cnt]);
            off += cnt;

            self.advance(cnt);
        }
    }

    /// Gets an unsigned 8 bit integer from `self`.
    ///
    /// The current position is advanced by 1.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Buf;
    ///
    /// let mut buf = &b"\x08 hello"[..];
    /// assert_eq!(8, buf.get_u8());
    /// ```
    ///
    /// # Panics
    ///
    /// This function panics if there is no more remaining data in `self`.
    #[inline]
    fn get_u8(&mut self) -> u8 {
        assert!(self.remaining() >= 1);
        let ret = self.chunk()[0];
        self.advance(1);
        ret
    }

    /// Gets a signed 8 bit integer from `self`.
    ///
    /// The current position is advanced by 1.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Buf;
    ///
    /// let mut buf = &b"\x08 hello"[..];
    /// assert_eq!(8, buf.get_i8());
    /// ```
    ///
    /// # Panics
    ///
    /// This function panics if there is no more remaining data in `self`.
    #[inline]
    fn get_i8(&mut self) -> i8 {
        self.get_u8() as i8
    }

    /// Gets an unsigned 16 bit integer from `self` in big-endian byte order.
    ///
    /// The current position is advanced by 2.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Buf;
    ///
    /// let mut buf = &b"\x08\x09 hello"[..];
    /// assert_eq!(0x0809, buf.get_u16());
    /// ```
    ///
    /// # Panics
  
```

### Core Architecture Module: `ntex-bytes/src/buf/buf_mut.rs`
```
use std::{cmp, mem};

use super::UninitSlice;

/// Generates the fixed-width integer `put_*` methods of `BufMut`, with docs.
macro_rules! put_int_impl {
    ($($name:ident, $ty:ty, $conv:ident, $what:literal, $order:literal, $size:literal, $val:literal, $bytes:literal;)*) => {$(
        #[doc = concat!("Writes ", $what, " to `self` in ", $order, " byte order.")]
        ///
        #[doc = concat!("The current position is advanced by ", $size, ".")]
        ///
        /// # Examples
        ///
        /// ```
        /// use ntex_bytes::BufMut;
        ///
        /// let mut buf = vec![];
        #[doc = concat!("buf.", stringify!($name), "(", $val, ");")]
        #[doc = concat!("assert_eq!(buf, b\"", $bytes, "\");")]
        /// ```
        ///
        /// # Panics
        ///
        /// This function panics if there is not enough remaining capacity in
        /// `self`.
        #[inline]
        fn $name(&mut self, n: $ty) {
            self.put_slice(&n.$conv());
        }
    )*};
}
/// A trait for values that provide sequential write access to bytes.
///
/// A buffer stores bytes in memory such that write operations are infallible.
/// The underlying storage may or may not be in contiguous memory. A `BufMut`
/// value is a cursor into the buffer. Writing to `BufMut` advances the cursor
/// position.
///
/// Fixed-size buffers such as `&mut [u8]` panic when a write does not fit.
/// Growable buffers such as `Vec<u8>`, [`BytesMut`](crate::BytesMut) and
/// [`BytePages`](crate::BytePages) allocate more space on demand instead, so
/// the `put_*` methods never run out of capacity for them.
///
/// The simplest `BufMut` is a `Vec<u8>`.
///
/// ```
/// use ntex_bytes::BufMut;
///
/// let mut buf = vec![];
///
/// buf.put("hello world");
///
/// assert_eq!(buf, b"hello world");
/// ```
pub trait BufMut {
    /// Returns the number of bytes that can be written from the current
    /// position until the end of the buffer is reached.
    ///
    /// This value is greater than or equal to the length of the slice returned
    /// by `chunk_mut`.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut dst = [0; 10];
    /// let mut buf = &mut dst[..];
    ///
    /// let original_remaining = buf.remaining_mut();
    /// buf.put("hello");
    ///
    /// assert_eq!(original_remaining - 5, buf.remaining_mut());
    /// ```
    ///
    /// # Implementer notes
    ///
    /// Implementations of `remaining_mut` should ensure that the return value
    /// does not change unless a call is made to `advance_mut` or any other
    /// function that is documented to change the `BufMut`'s current position.
    fn remaining_mut(&self) -> usize;

    /// Advance the internal cursor of the `BufMut`
    ///
    /// The next call to `chunk_mut` will return a slice starting `cnt` bytes
    /// further into the underlying buffer.
    ///
    /// # Safety
    ///
    /// The caller must ensure that the `cnt` bytes being advanced past have
    /// been initialized.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut buf = Vec::with_capacity(16);
    ///
    /// unsafe {
    ///     buf.chunk_mut()[0..2].copy_from_slice(b"he");
    ///     buf.advance_mut(2);
    ///
    ///     buf.chunk_mut()[0..3].copy_from_slice(b"llo");
    ///     buf.advance_mut(3);
    /// }
    ///
    /// assert_eq!(5, buf.len());
    /// assert_eq!(buf, b"hello");
    /// ```
    ///
    /// # Panics
    ///
    /// This function **may** panic if `cnt > self.remaining_mut()`.
    ///
    /// # Implementer notes
    ///
    /// It is recommended for implementations of `advance_mut` to panic if
    /// `cnt > self.remaining_mut()`. If the implementation does not panic,
    /// the call must behave as if `cnt == self.remaining_mut()`.
    ///
    /// A call with `cnt == 0` should never panic and be a no-op.
    unsafe fn advance_mut(&mut self, cnt: usize);

    /// Returns true if there is space in `self` for more bytes.
    ///
    /// This is equivalent to `self.remaining_mut() != 0`.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut dst = [0; 5];
    /// let mut buf = &mut dst[..];
    ///
    /// assert!(buf.has_remaining_mut());
    ///
    /// buf.put("hello");
    ///
    /// assert!(!buf.has_remaining_mut());
    /// ```
    #[inline]
    fn has_remaining_mut(&self) -> bool {
        self.remaining_mut() > 0
    }

    /// Returns a mutable slice starting at the current `BufMut` position and of
    /// length between 0 and `BufMut::remaining_mut()`. Note that this *can* be shorter than the
    /// whole remainder of the buffer (this allows non-continuous implementation).
    ///
    /// This is a lower level function. Most operations are done with other
    /// functions.
    ///
    /// The returned byte slice may represent uninitialized memory.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut buf = Vec::with_capacity(16);
    ///
    /// unsafe {
    ///     buf.chunk_mut()[0..2].copy_from_slice(b"he");
    ///
    ///     buf.advance_mut(2);
    ///
    ///     buf.chunk_mut()[0..3].copy_from_slice(b"llo");
    ///
    ///     buf.advance_mut(3);
    /// }
    ///
    /// assert_eq!(5, buf.len());
    /// assert_eq!(buf, b"hello");
    /// ```
    ///
    /// # Implementer notes
    ///
    /// This function should never panic. `chunk_mut` should return an empty
    /// slice **if and only if** `remaining_mut` returns 0. In other words,
    /// `chunk_mut` returning an empty slice implies that `remaining_mut` will
    /// return 0 and `remaining_mut` returning 0 implies that `chunk_mut` will
    /// return an empty slice.
    fn chunk_mut(&mut self) -> &mut UninitSlice;

    /// Transfer bytes into `self` from `src` and advance the cursor by the
    /// number of bytes written.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut buf = vec![];
    ///
    /// buf.put_u8(b'h');
    /// buf.put(&b"ello"[..]);
    /// buf.put(" world");
    ///
    /// assert_eq!(buf, b"hello world");
    /// ```
    ///
    /// # Panics
    ///
    /// Panics if `self` does not have enough capacity to contain `src`.
    fn put<T: super::Buf>(&mut self, mut src: T)
    where
        Self: Sized,
    {
        while src.has_remaining() {
            let s = src.chunk();
            let l = s.len();
            self.put_slice(s);
            src.advance(l);
        }
    }

    /// Transfer bytes into `self` from `src` and advance the cursor by the
    /// number of bytes written.
    ///
    /// `self` must have enough remaining capacity to contain all of `src`.
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut dst = [0; 6];
    ///
    /// {
    ///     let mut buf = &mut dst[..];
    ///     buf.put_slice(b"hello");
    ///
    ///     assert_eq!(1, buf.remaining_mut());
    /// }
    ///
    /// assert_eq!(b"hello\0", &dst);
    /// ```
    fn put_slice(&mut self, src: &[u8]) {
        let mut off = 0;

        assert!(self.remaining_mut() >= src.len(), "buffer overflow");

        while off < src.len() {
            let dst = self.chunk_mut();
            let cnt = cmp::min(dst.len(), src.len() - off);
            dst[..cnt].copy_from_slice(&src[off..off + cnt]);
            off += cnt;

            unsafe {
                self.advance_mut(cnt);
            }
        }
    }

    /// Writes an unsigned 8 bit integer to `self`.
    ///
    /// The current position is advanced by 1.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut buf = vec![];
    /// buf.put_u8(0x01);
    /// assert_eq!(buf, b"\x01");
    /// ```
    ///
    /// # Panics
    ///
    /// This function panics if there is not enough remaining capacity in
    /// `self`.
    #[inline]
    fn put_u8(&mut self, n
```

### Core Architecture Module: `ntex-bytes/src/buf/iter.rs`
```
use crate::Buf;

/// Iterator over the bytes contained by the buffer.
///
/// This struct is created by the [`iter`] method on [`Buf`].
///
/// # Examples
///
/// Basic usage:
///
/// ```
/// use ntex_bytes::{Buf, Bytes};
///
/// let buf = Bytes::from(&b"abc"[..]);
/// let mut iter = buf.into_iter();
///
/// assert_eq!(iter.next(), Some(b'a'));
/// assert_eq!(iter.next(), Some(b'b'));
/// assert_eq!(iter.next(), Some(b'c'));
/// assert_eq!(iter.next(), None);
/// ```
///
/// [`iter`]: trait.Buf.html#method.iter
/// [`Buf`]: trait.Buf.html
#[derive(Debug)]
pub struct IntoIter<T> {
    inner: T,
}

impl<T> IntoIter<T> {
    /// Creates an iterator over the bytes contained by the buffer.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::{Buf, Bytes};
    /// use ntex_bytes::buf::IntoIter;
    ///
    /// let buf = Bytes::from_static(b"abc");
    /// let mut iter = IntoIter::new(buf);
    ///
    /// assert_eq!(iter.next(), Some(b'a'));
    /// assert_eq!(iter.next(), Some(b'b'));
    /// assert_eq!(iter.next(), Some(b'c'));
    /// assert_eq!(iter.next(), None);
    /// ```
    pub fn new(inner: T) -> IntoIter<T> {
        IntoIter { inner }
    }
    /// Consumes this `IntoIter`, returning the underlying value.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use ntex_bytes::{Buf, Bytes};
    ///
    /// let buf = Bytes::from(&b"abc"[..]);
    /// let mut iter = buf.into_iter();
    ///
    /// assert_eq!(iter.next(), Some(b'a'));
    ///
    /// let buf = iter.into_inner();
    /// assert_eq!(2, buf.remaining());
    /// ```
    pub fn into_inner(self) -> T {
        self.inner
    }

    /// Gets a reference to the underlying `Buf`.
    ///
    /// It is inadvisable to directly read from the underlying `Buf`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use ntex_bytes::{Buf, Bytes};
    ///
    /// let buf = Bytes::from(&b"abc"[..]);
    /// let mut iter = buf.into_iter();
    ///
    /// assert_eq!(iter.next(), Some(b'a'));
    ///
    /// assert_eq!(2, iter.get_ref().remaining());
    /// ```
    pub fn get_ref(&self) -> &T {
        &self.inner
    }

    /// Gets a mutable reference to the underlying `Buf`.
    ///
    /// It is inadvisable to directly read from the underlying `Buf`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use ntex_bytes::{Buf, BytesMut};
    ///
    /// let buf = BytesMut::from(&b"abc"[..]);
    /// let mut iter = buf.into_iter();
    ///
    /// assert_eq!(iter.next(), Some(b'a'));
    ///
    /// iter.get_mut().advance(1);
    ///
    /// assert_eq!(iter.next(), Some(b'c'));
    /// ```
    pub fn get_mut(&mut self) -> &mut T {
        &mut self.inner
    }
}

impl<T: Buf> Iterator for IntoIter<T> {
    type Item = u8;

    fn next(&mut self) -> Option<u8> {
        if !self.inner.has_remaining() {
            return None;
        }

        let b = self.inner.chunk()[0];
        self.inner.advance(1);

        Some(b)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let rem = self.inner.remaining();
        (rem, Some(rem))
    }
}

impl<T: Buf> ExactSizeIterator for IntoIter<T> {}

```

### Core Architecture Module: `ntex-bytes/src/buf/mod.rs`
```
//! Utilities for working with buffers.
//!
//! A buffer is any structure that contains a sequence of bytes. The bytes may
//! or may not be stored in contiguous memory. This module contains traits used
//! to abstract over buffers as well as utilities for working with buffer types.
//!
//! # `Buf`, `BufMut`
//!
//! These are the two foundational traits for abstractly working with buffers.
//! They can be thought as iterators for byte structures. They offer additional
//! performance over `Iterator` by providing an API optimized for byte slices.
//!
//! See [`Buf`] and [`BufMut`] for more details.
//!
//! [rope]: https://en.wikipedia.org/wiki/Rope_(data_structure)
//! [`Buf`]: trait.Buf.html
//! [`BufMut`]: trait.BufMut.html

mod buf_impl;
mod buf_mut;
mod iter;
mod uninit_slice;

pub use self::buf_impl::Buf;
pub use self::buf_mut::BufMut;
pub use self::iter::IntoIter;
pub use self::uninit_slice::UninitSlice;

```

### Core Architecture Module: `ntex-bytes/src/buf/uninit_slice.rs`
```
use std::ops::{
    Index, IndexMut, Range, RangeFrom, RangeFull, RangeInclusive, RangeTo, RangeToInclusive,
};
use std::{fmt, mem::MaybeUninit, ptr};

/// Uninitialized byte slice.
///
/// Returned by `BufMut::chunk_mut()`, the referenced byte slice may be
/// uninitialized. The wrapper provides safe access without introducing
/// undefined behavior.
///
/// The safety invariants of this wrapper are:
///
///  1. Reading from an `UninitSlice` is undefined behavior.
///  2. Writing uninitialized bytes to an `UninitSlice` is undefined behavior.
///
/// The difference between `&mut UninitSlice` and `&mut [MaybeUninit<u8>]` is
/// that it is possible in safe code to write uninitialized bytes to an
/// `&mut [MaybeUninit<u8>]`, which this type prohibits.
#[repr(transparent)]
pub struct UninitSlice([MaybeUninit<u8>]);

impl UninitSlice {
    /// Create a `&mut UninitSlice` from a pointer and a length.
    ///
    /// # Safety
    ///
    /// The caller must ensure that `ptr` references a valid memory region owned
    /// by the caller representing a byte slice for the duration of `'a`.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::buf::UninitSlice;
    ///
    /// let bytes = b"hello world".to_vec();
    /// let ptr = bytes.as_ptr() as *mut _;
    /// let len = bytes.len();
    ///
    /// let slice = unsafe { UninitSlice::from_raw_parts_mut(ptr, len) };
    /// ```
    #[inline]
    pub unsafe fn from_raw_parts_mut<'a>(ptr: *mut u8, len: usize) -> &'a mut UninitSlice {
        UninitSlice::from_uninit_mut(core::slice::from_raw_parts_mut(ptr.cast(), len))
    }

    // SAFETY for both: `UninitSlice` is a `repr(transparent)` wrapper of `[MaybeUninit<u8>]`
    #[inline]
    fn from_uninit(slice: &[MaybeUninit<u8>]) -> &UninitSlice {
        unsafe { &*(ptr::from_ref(slice) as *const UninitSlice) }
    }

    #[inline]
    fn from_uninit_mut(slice: &mut [MaybeUninit<u8>]) -> &mut UninitSlice {
        unsafe { &mut *(ptr::from_mut(slice) as *mut UninitSlice) }
    }

    /// Write a single byte at the specified offset.
    ///
    /// # Panics
    ///
    /// The function panics if `index` is out of bounds.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::buf::UninitSlice;
    ///
    /// let mut data = [b'f', b'o', b'o'];
    /// let slice = unsafe { UninitSlice::from_raw_parts_mut(data.as_mut_ptr(), 3) };
    ///
    /// slice.write_byte(0, b'b');
    ///
    /// assert_eq!(b"boo", &data[..]);
    /// ```
    #[inline]
    pub fn write_byte(&mut self, index: usize, byte: u8) {
        assert!(index < self.len());

        unsafe { self[index..].as_mut_ptr().write(byte) }
    }

    /// Copies bytes  from `src` into `self`.
    ///
    /// The length of `src` must be the same as `self`.
    ///
    /// # Panics
    ///
    /// The function panics if `src` has a different length than `self`.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::buf::UninitSlice;
    ///
    /// let mut data = [b'f', b'o', b'o'];
    /// let slice = unsafe { UninitSlice::from_raw_parts_mut(data.as_mut_ptr(), 3) };
    ///
    /// slice.copy_from_slice(b"bar");
    ///
    /// assert_eq!(b"bar", &data[..]);
    /// ```
    #[inline]
    pub fn copy_from_slice(&mut self, src: &[u8]) {
        use core::ptr;

        assert_eq!(self.len(), src.len());

        unsafe {
            ptr::copy_nonoverlapping(src.as_ptr(), self.as_mut_ptr(), self.len());
        }
    }

    /// Return a raw pointer to the slice's buffer.
    ///
    /// # Safety
    ///
    /// The caller **must not** read from the referenced memory and **must not**
    /// write **uninitialized** bytes to the slice either.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut data = [0, 1, 2];
    /// let mut slice = &mut data[..];
    /// let ptr = BufMut::chunk_mut(&mut slice).as_mut_ptr();
    /// ```
    #[inline]
    pub fn as_mut_ptr(&mut self) -> *mut u8 {
        self.0.as_mut_ptr().cast()
    }

    /// Returns the number of bytes in the slice.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut data = [0, 1, 2];
    /// let mut slice = &mut data[..];
    /// let len = BufMut::chunk_mut(&mut slice).len();
    ///
    /// assert_eq!(len, 3);
    /// ```
    #[inline]
    #[allow(clippy::len_without_is_empty)]
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Returns the slice as a mutable slice of [`MaybeUninit<u8>`].
    ///
    /// # Safety
    ///
    /// The memory may already be initialized, for example when the slice was
    /// returned by the [`BufMut`](crate::BufMut) implementation for
    /// `&mut [u8]`. The caller **must not** write uninitialized bytes to the
    /// returned slice.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BufMut;
    ///
    /// let mut data = [0, 1, 2];
    /// let mut slice = &mut data[..];
    /// let uninit = unsafe { BufMut::chunk_mut(&mut slice).as_uninit_slice_mut() };
    /// uninit[0].write(b'a');
    ///
    /// assert_eq!(data[0], b'a');
    /// ```
    #[inline]
    pub unsafe fn as_uninit_slice_mut(&mut self) -> &mut [MaybeUninit<u8>] {
        &mut self.0
    }
}

/// Deprecated, use [`UninitSlice::as_uninit_slice_mut`] instead.
///
/// This impl is unsound. The memory may already be initialized, for example
/// when the slice was returned by the [`BufMut`](crate::BufMut) implementation
/// for `&mut [u8]`, and safe code can write uninitialized bytes to the
/// returned slice. It will be removed in the next major release.
///
/// Rust does not allow `#[deprecated]` on trait impls, so using this impl
/// does not emit a warning.
impl AsMut<[MaybeUninit<u8>]> for UninitSlice {
    fn as_mut(&mut self) -> &mut [MaybeUninit<u8>] {
        &mut self.0
    }
}

impl fmt::Debug for UninitSlice {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt.debug_struct("UninitSlice[...]").finish()
    }
}

macro_rules! impl_index {
    ($($t:ty),*) => {
        $(
            impl Index<$t> for UninitSlice {
                type Output = UninitSlice;

                #[inline]
                fn index(&self, index: $t) -> &UninitSlice {
                    UninitSlice::from_uninit(&self.0[index])
                }
            }

            impl IndexMut<$t> for UninitSlice {
                #[inline]
                fn index_mut(&mut self, index: $t) -> &mut UninitSlice {
                    UninitSlice::from_uninit_mut(&mut self.0[index])
                }
            }
        )*
    };
}

impl_index!(
    Range<usize>,
    RangeFrom<usize>,
    RangeFull,
    RangeInclusive<usize>,
    RangeTo<usize>,
    RangeToInclusive<usize>
);

```

### Core Architecture Module: `ntex-bytes/src/bvec.rs`
```
use std::{borrow, fmt, io, ops::DerefMut, ptr};

use crate::{Buf, BufMut, Bytes, buf::UninitSlice, stvec::StorageVec};

/// A unique reference to a contiguous slice of memory.
///
/// `BytesMut` represents a unique view into a potentially shared memory region.
/// Given the uniqueness guarantee, owners of `BytesMut` handles are able to
/// mutate the memory. It is similar to a `Vec<u8>` but with fewer copies and
/// allocations. It also always allocates.
///
/// For more detail, see [`Bytes`].
///
/// # Growth
///
/// Safe write operations such as [`BufMut::put_slice`], [`BufMut::put_u8`], and
/// [`extend_from_slice`](Self::extend_from_slice) reserve additional capacity
/// when needed. Use [`reserve`](Self::reserve) when the required capacity is
/// known in advance to avoid repeated allocation.
///
/// # Examples
///
/// ```
/// use ntex_bytes::{BytesMut, BufMut};
///
/// let mut buf = BytesMut::with_capacity(64);
///
/// buf.put_u8(b'h');
/// buf.put_u8(b'e');
/// buf.put("llo");
///
/// assert_eq!(&buf[..], b"hello");
///
/// // Freeze the buffer so that it can be shared
/// let a = buf.freeze();
///
/// // This does not allocate, instead `b` points to the same memory.
/// let b = a.clone();
///
/// assert_eq!(a, b"hello");
/// assert_eq!(b, b"hello");
/// ```
pub struct BytesMut {
    pub(crate) storage: StorageVec,
}

impl BytesMut {
    /// Creates a new `BytesMut` with the specified capacity.
    ///
    /// The returned `BytesMut` will be able to hold `capacity` bytes
    /// without reallocating.
    ///
    /// It is important to note that this function does not specify the length
    /// of the returned `BytesMut`, but only the capacity.
    ///
    /// # Panics
    ///
    /// Panics if `capacity` exceeds `u32::MAX` minus the buffer
    /// header size, just under 4 GiB.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::{BytesMut, BufMut};
    ///
    /// let mut bytes = BytesMut::with_capacity(64);
    ///
    /// // `bytes` contains no data, even though there is capacity
    /// assert_eq!(bytes.len(), 0);
    ///
    /// bytes.put(&b"hello world"[..]);
    ///
    /// assert_eq!(&bytes[..], b"hello world");
    /// ```
    #[inline]
    #[must_use]
    pub fn with_capacity(capacity: usize) -> BytesMut {
        BytesMut {
            storage: StorageVec::with_capacity(capacity),
        }
    }

    /// Creates a `BytesMut` by copying a byte slice.
    #[inline]
    #[must_use]
    pub fn copy_from_slice<T: AsRef<[u8]>>(src: T) -> Self {
        let slice = src.as_ref();
        BytesMut {
            storage: StorageVec::from_slice(slice.len(), slice),
        }
    }

    /// Creates a new `BytesMut` with default capacity.
    ///
    /// Resulting object has length 0 and unspecified capacity.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::{BytesMut, BufMut};
    ///
    /// let mut bytes = BytesMut::new();
    ///
    /// assert_eq!(0, bytes.len());
    ///
    /// bytes.reserve(2);
    /// bytes.put_slice(b"xy");
    ///
    /// assert_eq!(&b"xy"[..], &bytes[..]);
    /// ```
    #[inline]
    #[must_use]
    pub fn new() -> BytesMut {
        BytesMut {
            storage: StorageVec::with_capacity(crate::storage::MIN_CAPACITY),
        }
    }

    /// Returns the number of bytes contained in this `BytesMut`.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BytesMut;
    ///
    /// let b = BytesMut::copy_from_slice(&b"hello"[..]);
    /// assert_eq!(b.len(), 5);
    /// ```
    #[inline]
    pub fn len(&self) -> usize {
        self.storage.len()
    }

    /// Returns `true` if the buffer is empty.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BytesMut;
    ///
    /// let b = BytesMut::with_capacity(64);
    /// assert!(b.is_empty());
    /// ```
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.storage.len() == 0
    }

    /// Returns the number of bytes the `BytesMut` can hold without reallocating.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BytesMut;
    ///
    /// let b = BytesMut::with_capacity(64);
    /// assert_eq!(b.capacity(), 64);
    /// ```
    #[inline]
    pub fn capacity(&self) -> usize {
        self.storage.capacity()
    }

    /// Returns `true` if no other handle refers to the underlying buffer.
    ///
    /// Values split off with [`split_to`](Self::split_to) or frozen into
    /// [`Bytes`] share the buffer with `self`. While they exist, clearing
    /// `self` does not reclaim the capacity in front of it, and the whole
    /// allocation stays alive as long as any of them does.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BytesMut;
    ///
    /// let mut buf = BytesMut::with_capacity(64);
    /// buf.extend_from_slice(&[0; 32]);
    /// assert!(buf.is_unique());
    ///
    /// let head = buf.split_to(30);
    /// assert!(!buf.is_unique());
    ///
    /// drop(head);
    /// assert!(buf.is_unique());
    /// ```
    #[inline]
    pub fn is_unique(&self) -> bool {
        self.storage.is_unique()
    }

    /// Converts `self` into an immutable `Bytes`.
    ///
    /// The conversion is zero cost and is used to indicate that the slice
    /// referenced by the handle will no longer be mutated. Once the conversion
    /// is done, the handle can be cloned and shared across threads.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::{BytesMut, BufMut};
    /// use std::thread;
    ///
    /// let mut b = BytesMut::with_capacity(64);
    /// b.put("hello world");
    /// let b1 = b.freeze();
    /// let b2 = b1.clone();
    ///
    /// let th = thread::spawn(move || {
    ///     assert_eq!(b1, b"hello world");
    /// });
    ///
    /// assert_eq!(b2, b"hello world");
    /// th.join().unwrap();
    /// ```
    #[inline]
    #[must_use]
    pub fn freeze(self) -> Bytes {
        Bytes {
            storage: self.storage.freeze(),
        }
    }

    /// Removes the bytes from the current view, returning them in a
    /// `Bytes` instance.
    ///
    /// Afterwards, `self` will be empty, but will retain any additional
    /// capacity that it had before the operation. This is identical to
    /// `self.split_to(self.len())`.
    ///
    /// This is an `O(1)` operation that just increases the reference count and
    /// sets a few indices.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::{BytesMut, BufMut};
    ///
    /// let mut buf = BytesMut::with_capacity(1024);
    /// buf.put(&b"hello world"[..]);
    ///
    /// let other = buf.take();
    ///
    /// assert!(buf.is_empty());
    /// assert_eq!(1013, buf.capacity());
    ///
    /// assert_eq!(other, b"hello world"[..]);
    /// ```
    #[inline]
    #[must_use]
    pub fn take(&mut self) -> Bytes {
        Bytes {
            storage: self.storage.split_to(self.len()),
        }
    }

    /// Splits the buffer into two at the given index.
    ///
    /// Afterwards `self` contains elements `[at, len)`, and the returned `Bytes`
    /// contains elements `[0, at)`.
    ///
    /// This is an `O(1)` operation that just increases the reference count and
    /// sets a few indices.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::BytesMut;
    ///
    /// let mut a = BytesMut::copy_from_slice(&b"hello world"[..]);
    /// let mut b = a.split_to(5);
    ///
    /// a[0] = b'!';
    ///
    /// assert_eq!(&a[..], b"!world");
    /// assert_eq!(&b[..], b"hello");
    /// ```
    ///
    /// # Panics
    ///
    /// Panics if `at > len`.
    #[inline]
    #[must_use]
    pub fn split_to(&mut self, at: usize) -> Bytes {
        self.split_to_checked(at)
            .expect("at value must be <= self.len()`")
    }

    /// Advance the internal cursor.
    ///
    /// Afterwards `self` contains elements `[cnt, len)`.
    /// This is an `O(1)` operation.
    ///
    /// # Examples
    ///
    /// ```
    /// use ntex_bytes::Bytes
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #130** (2022-07-14): **Fix transported protocol error on ping request**
  *Symptoms*: Pong response is being encoded as a transported binary message by WS filter
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/ntex-rs/ntex/pull/130?src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ntex-rs) Report > Merging [#130](https://codecov.io/gh/ntex-rs/ntex/pull/130?src=pr&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ntex-rs) (2091e0f) into [master](https://codecov.io/gh/ntex-rs/ntex/commit/d808574b97b09b4ebb7e143603668ae192baaeee?el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ntex-rs) (d808574) will **increase** coverage by `0.04%`. > The diff coverage is `0.00%`.  ```diff @@            Coverage Diff             @@ ##           master     #130      +/-   ## ========================================== + Coverage   86.88%   86.92%   +0.04%      ==========================================   Files         187      187                 Lines       21404    21404               =======================================
  > thanks. i made new release

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

### Incident Patch 1: `7e8e49c8` (2026-09-15)
**Commit Message**: Update names and fix InternalError impl (#1028)

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -54,8 +54,7 @@ ntex-macros = { path = "ntex-macros" }
 ntex-util = { path = "ntex-util" }
 
 [workspace.dependencies]
-ntex = "4.0.0-beta.12"
-ntex-macros = "4.0.0-beta.6"
+ntex = "4.0.0-beta.13"
 
 ntex-bytes = "1.9.0"
 ntex-codec = "1.2.1"
@@ -64,10 +63,11 @@ ntex-error = "2.6.0"
 ntex-h2 = "4.0.0"
 ntex-http = "1.2.0"
 ntex-io = "4.0.0"
+ntex-macros = "4.0.0"
 ntex-net = "4.0.0"
 ntex-router = "1.1.0"
 ntex-rt = "3.17.1"
-ntex-server = "4.0.0"
+ntex-server = "4.1.0"
 ntex-service = "5.0.0"
 ntex-tls = "4.0.0"
 ntex-util = "4.0.0"
```

**File**: `ntex-macros/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-macros"
-version = "4.0.0-beta.6"
+version = "4.0.0"
 description = "ntex proc macros"
 readme = "README.md"
 authors = ["ntex contributors <team@ntex.rs>"]
```

**File**: `ntex-server/CHANGES.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Changes
 
+## [4.1.0] - 2026-09-14
+
+* Move ServerAppConfig to root
+
+* Rename `build_with_config()` helper
+
 ## [4.0.0] - 2026-09-14
 
 * Refactor server state creation process
```

**File**: `ntex-server/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-server"
-version = "4.0.0"
+version = "4.1.0"
 authors = ["ntex contributors <team@ntex.rs>"]
 description = "Server for ntex framework"
 keywords = ["network", "framework", "async", "futures"]
```

**File**: `ntex-server/src/lib.rs` (modified, +2/-0)
```diff
@@ -15,10 +15,12 @@ mod manager;
 pub mod net;
 mod pool;
 mod server;
+mod state;
 mod wrk;
 
 pub use self::pool::WorkerPool;
 pub use self::server::Server;
+pub use self::state::{NoConfig, ServerAppConfig};
 pub use self::wrk::{Worker, WorkerStatus, WorkerStop};
 
 /// Worker id
```

---

### Incident Patch 2: `bdeab500` (2026-09-13)
**Commit Message**: Fix keepalive readiness deadlock when sub-millisecond time remains (#1004)

**File**: `ntex-util/src/services/keepalive.rs` (modified, +35/-13)
```diff
@@ -119,21 +119,26 @@ where
         if expire <= now() {
             Err((self.f)())
         } else {
-            ctx.poll_once(|cx| match self.sleep.poll_elapsed(cx) {
-                Poll::Ready(()) => {
-                    let now = now();
-                    let expire = self.expire.get() + self.dur;
-                    if expire <= now {
-                        Err((self.f)())
-                    } else {
-                        let expire = expire - now;
-                        self.sleep
-                            .reset(Millis(expire.as_millis().try_into().unwrap_or(u32::MAX)));
-                        let _ = self.sleep.poll_elapsed(cx);
-                        Ok(())
+            ctx.poll_once(|cx| {
+                loop {
+                    match self.sleep.poll_elapsed(cx) {
+                        Poll::Ready(()) => {
+                            let now = now();
+                            let expire = self.expire.get() + self.dur;
+                            if expire <= now {
+                                return Err((self.f)());
+                            }
+                            let expire = expire - now;
+
+                            // sleep must be reset to non zero duration,
+                            // otherwise it stays in elapsed state and waker
+                            // never gets registered
+                            let expire: u32 = expire.as_millis().try_into().unwrap_or(u32::MAX);
+                            self.sleep.reset(Millis(expire.max(1)));
+                        }
+                        Poll::Pending => return Ok(()),
                     }
                 }
-                Poll::Pending => Ok(()),
             })
         }
     }
@@ -202,4 +207,21 @@ mod tests {
         assert_eq!(res, Ok(()));
         assert_eq!(svc.ready().await, Err(TestErr));
     }
+
+    #[ntex::test]
+    async fn test_ka_sub_millis() {
+        let svc = std::rc::Rc::new(KeepAliveService::new(Millis(100), || TestErr));
+
+        // less than millisecond is left before expiration
+        svc.expire
+            .set(now().checked_sub(svc.dur).unwrap() + time::Duration::from_micros(500));
+        svc.sleep.elapse();
+
+        let p = Pipeline::<usize, usize, TestErr>::new((), svc.clone()).bind();
+        assert_eq!(p.ready().await, Ok(()));
+
+        // timer has to be re-armed, otherwise waker never gets registered
+        // and service readiness never resolves
+        assert!(!svc.sleep.is_elapsed());
+    }
 }
```

---

### Incident Patch 3: `10d0da53` (2026-08-27)
**Commit Message**: Fix arbiter storage cleanup logic and SIGTERM handling (#999)

* Fix arbiter storage cleanup logic
* Fix SIGTERM handling

**File**: `ntex-rt/CHANGES.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # Changes
 
+## [3.17.2] - 2026-08-27
+
+* Fix arbiter storage cleanup logic
+
 ## [3.17.1] - 2026-08-10
 
 * Add panic handling support
```

**File**: `ntex-rt/src/arbiter.rs` (modified, +2/-2)
```diff
@@ -365,11 +365,11 @@ pub unsafe fn remove_all_items() {
     STORAGE.with(move |cell| {
         loop {
             let mut items = cell.borrow_mut();
-            let Some(item) = items.drain().next() else {
+            let Some(key) = items.keys().next().copied() else {
                 break;
             };
+            items.remove(&key);
             drop(items);
-            drop(item);
         }
     });
     System::remove_current();
```

**File**: `ntex-server/CHANGES.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # Changes
 
+## [4.0.0-beta.1] - 2026-08-26
+
+* Shutdown on SIGTERM is always graceful
+
 ## [4.0.0-beta.0] - 2026-08-24
 
 * Add app state management
```

**File**: `ntex-server/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-server"
-version = "4.0.0-beta.0"
+version = "4.0.0-beta.1"
 authors = ["ntex contributors <team@ntex.rs>"]
 description = "Server for ntex framework"
 keywords = ["network", "framework", "async", "futures"]
```

**File**: `ntex-server/src/manager.rs` (modified, +1/-1)
```diff
@@ -365,7 +365,7 @@ async fn handle_cmd<F: ServerConfiguration>(
                     }
                     Signal::Term => {
                         log::info!("SIGTERM received, stopping");
-                        state.stop(state.mgr.0.cfg.graceful_shutdown, None).await;
+                        state.stop(true, None).await;
                         return;
                     }
                     Signal::Quit => {
```

---

### Incident Patch 4: `7c134908` (2026-08-25)
**Commit Message**: Fix re-export (#996)

**File**: `ntex-util/src/lib.rs` (modified, +2/-2)
```diff
@@ -23,8 +23,8 @@ pub use hashbrown::HashMap as HashMapBase;
 #[doc(hidden)]
 pub use hashbrown::HashSet as HashSetBase;
 
-pub type HashMap<K, V> = HashMapFull<K, V, foldhash::fast::RandomState>;
-pub type HashSet<V> = HashSetFull<V, foldhash::fast::RandomState>;
+pub type HashMap<K, V> = HashMapBase<K, V, foldhash::fast::RandomState>;
+pub type HashSet<V> = HashSetBase<V, foldhash::fast::RandomState>;
 pub type HashRandomState = foldhash::fast::RandomState;
 
 pub fn dyn_err<E: Error + 'static>(e: E) -> Box<dyn Error> {
```

---

### Incident Patch 5: `f9124bb0` (2026-08-06)
**Commit Message**: Fix panic in arbiters pings (#960)

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ ntex-io = "3.13.1"
 ntex-net = "3.14.0"
 ntex-macros = "3.3.0"
 ntex-router = "1.0.0"
-ntex-rt = "3.16.0"
+ntex-rt = "3.16.1"
 ntex-server = "3.10.4"
 ntex-service = "4.6.0"
 ntex-tls = "3.8.0"
```

**File**: `ntex-rt/CHANGES.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # Changes
 
+## [3.16.1] - 2026-08-06
+
+* Fix panic in arbiters pings
+
 ## [3.16.0] - 2026-08-03
 
 * Allow to detach spawn blocking future
```

**File**: `ntex-rt/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "ntex-rt"
-version = "3.16.0"
+version = "3.16.1"
 authors = ["ntex contributors <team@ntex.rs>"]
 description = "ntex runtime"
 keywords = ["network", "framework", "async", "futures"]
```

**File**: `ntex-rt/src/system.rs` (modified, +10/-12)
```diff
@@ -429,7 +429,7 @@ pub struct PingRecord {
 }
 
 async fn ping_arbiters(sys: System) {
-    let pings = Rc::new(RefCell::new(HashSet::default()));
+    let arbs = Rc::new(RefCell::new(HashSet::default()));
     let interval = Duration::from_millis(sys.0.config.ping_interval as u64);
     #[cfg(target_os = "linux")]
     let threshold = Duration::from_millis(sys.0.config.ping_threshold as u64);
@@ -440,14 +440,14 @@ async fn ping_arbiters(sys: System) {
 
         // send pings
         {
-            pings.borrow_mut().clear();
+            arbs.borrow_mut().clear();
 
             let start = Instant::now();
             let arbiters = sys.0.arbiters.lock();
 
             for arb in &arbiters.list {
                 let id = arb.id();
-                let pings = pings.clone();
+                let arbs = arbs.clone();
                 let fut = arb.handle().spawn(async move {
                     yield_to().await;
                 });
@@ -462,16 +462,14 @@ async fn ping_arbiters(sys: System) {
 
                 crate::spawn(async move {
                     if fut.await.is_ok() {
-                        pings.borrow_mut().insert(id);
+                        arbs.borrow_mut().insert(id);
 
                         PINGS.with(|pings| {
-                            pings
-                                .borrow_mut()
-                                .get_mut(&id)
-                                .unwrap()
-                                .front_mut()
-                                .unwrap()
-                                .rtt = Some(start.elapsed());
+                            if let Some(recs) = pings.borrow_mut().get_mut(&id)
+                                && let Some(rec) = recs.front_mut()
+                            {
+                                rec.rtt = Some(start.elapsed());
+                            }
                         });
                     }
                 });
@@ -489,7 +487,7 @@ async fn ping_arbiters(sys: System) {
             let mut no_pongs = Vec::new();
             {
                 for arb in &sys.0.arbiters.lock().list {
-                    let pong = pings.borrow_mut().remove(&arb.id());
+                    let pong = arbs.borrow_mut().remove(&arb.id());
                     if !pong {
                         no_pongs.push(arb.clone());
                     }
```

#### Recent Merged Pull Requests:
- **PR #1061** (2026-09-29): Add Waiter, IoRef::waiter() and IoRef::wake() (@fafhrd91)
- **PR #1060** (2026-09-28): Write back-pressure waiters (@fafhrd91)
- **PR #1059** (2026-09-29): Http updates (@fafhrd91)
- **PR #1058** (2026-09-28): Update utils (@fafhrd91)
- **PR #1057** (2026-09-28): http updates (@fafhrd91)
- **PR #1056** (2026-09-27): HTTP/2 server resets the stream with NO_ERROR if the response is comp… (@fafhrd91)
- **PR #1055** (2026-09-27): Update versions (@fafhrd91)
- **PR #1054** (2026-09-27): Bytes optimizations (@fafhrd91)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
