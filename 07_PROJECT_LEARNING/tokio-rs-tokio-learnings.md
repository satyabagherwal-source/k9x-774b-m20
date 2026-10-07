# Forensic Learning Record (Deep Inspection): tokio-rs/tokio

> **Canonical Artifact**: `07_PROJECT_LEARNING/tokio-rs-tokio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tokio-rs/tokio](https://github.com/tokio-rs/tokio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:19:40.090Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tokio-rs/tokio`
- **Description**: A runtime for writing reliable asynchronous applications with Rust. Provides I/O, networking, scheduling, timers, ...
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 33355 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `tokio-util/src/cfg.rs`
```
macro_rules! cfg_codec {
    ($($item:item)*) => {
        $(
            #[cfg(feature = "codec")]
            #[cfg_attr(docsrs, doc(cfg(feature = "codec")))]
            $item
        )*
    }
}

macro_rules! cfg_compat {
    ($($item:item)*) => {
        $(
            #[cfg(feature = "compat")]
            #[cfg_attr(docsrs, doc(cfg(feature = "compat")))]
            $item
        )*
    }
}

macro_rules! cfg_net {
    ($($item:item)*) => {
        $(
            #[cfg(all(feature = "net", feature = "codec"))]
            #[cfg_attr(docsrs, doc(cfg(all(feature = "net", feature = "codec"))))]
            $item
        )*
    }
}

macro_rules! cfg_io {
    ($($item:item)*) => {
        $(
            #[cfg(feature = "io")]
            #[cfg_attr(docsrs, doc(cfg(feature = "io")))]
            $item
        )*
    }
}

cfg_io! {
    macro_rules! cfg_io_util {
        ($($item:item)*) => {
            $(
                #[cfg(feature = "io-util")]
                #[cfg_attr(docsrs, doc(cfg(feature = "io-util")))]
                $item
            )*
        }
    }
}

macro_rules! cfg_rt {
    ($($item:item)*) => {
        $(
            #[cfg(feature = "rt")]
            #[cfg_attr(docsrs, doc(cfg(feature = "rt")))]
            $item
        )*
    }
}

macro_rules! cfg_not_rt {
    ($($item:item)*) => {
        $(
            #[cfg(not(feature = "rt"))]
            $item
        )*
    }
}

macro_rules! cfg_time {
    ($($item:item)*) => {
        $(
            #[cfg(feature = "time")]
            #[cfg_attr(docsrs, doc(cfg(feature = "time")))]
            $item
        )*
    }
}

```

### Core Architecture Module: `tokio-util/src/codec/any_delimiter_codec.rs`
```
use crate::codec::decoder::Decoder;
use crate::codec::encoder::Encoder;

use bytes::{Buf, BufMut, Bytes, BytesMut};
use std::{cmp, fmt, io, str};

const DEFAULT_SEEK_DELIMITERS: &[u8] = b",;\n\r";
const DEFAULT_SEQUENCE_WRITER: &[u8] = b",";
/// A simple [`Decoder`] and [`Encoder`] implementation that splits up data into chunks based on any character in the given delimiter string.
///
/// [`Decoder`]: crate::codec::Decoder
/// [`Encoder`]: crate::codec::Encoder
///
/// # Example
/// Decode string of bytes containing various different delimiters.
///
/// [`BytesMut`]: bytes::BytesMut
/// [`Error`]: std::io::Error
///
/// ```
/// use tokio_util::codec::{AnyDelimiterCodec, Decoder};
/// use bytes::{BufMut, BytesMut};
///
/// #
/// # #[tokio::main(flavor = "current_thread")]
/// # async fn main() -> Result<(), std::io::Error> {
/// let mut codec = AnyDelimiterCodec::new(b",;\r\n".to_vec(),b";".to_vec());
/// let buf = &mut BytesMut::new();
/// buf.reserve(200);
/// buf.put_slice(b"chunk 1,chunk 2;chunk 3\n\r");
/// assert_eq!("chunk 1", codec.decode(buf).unwrap().unwrap());
/// assert_eq!("chunk 2", codec.decode(buf).unwrap().unwrap());
/// assert_eq!("chunk 3", codec.decode(buf).unwrap().unwrap());
/// assert_eq!("", codec.decode(buf).unwrap().unwrap());
/// assert_eq!(None, codec.decode(buf).unwrap());
/// # Ok(())
/// # }
/// ```
///
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub struct AnyDelimiterCodec {
    // Stored index of the next index to examine for the delimiter character.
    // This is used to optimize searching.
    // For example, if `decode` was called with `abc` and the delimiter is '{}', it would hold `3`,
    // because that is the next index to examine.
    // The next time `decode` is called with `abcde}`, the method will
    // only look at `de}` before returning.
    next_index: usize,

    /// The maximum length for a given chunk. If `usize::MAX`, chunks will be
    /// read until a delimiter character is reached.
    max_length: usize,

    /// Are we currently discarding the remainder of a chunk which was over
    /// the length limit?
    is_discarding: bool,

    /// The bytes that are using for search during decode
    seek_delimiters: Vec<u8>,

    /// The bytes that are using for encoding
    sequence_writer: Vec<u8>,
}

impl AnyDelimiterCodec {
    /// Returns a `AnyDelimiterCodec` for splitting up data into chunks.
    ///
    /// # Note
    ///
    /// The returned `AnyDelimiterCodec` will not have an upper bound on the length
    /// of a buffered chunk. See the documentation for [`new_with_max_length`]
    /// for information on why this could be a potential security risk.
    ///
    /// [`new_with_max_length`]: crate::codec::AnyDelimiterCodec::new_with_max_length()
    pub fn new(seek_delimiters: Vec<u8>, sequence_writer: Vec<u8>) -> AnyDelimiterCodec {
        AnyDelimiterCodec {
            next_index: 0,
            max_length: usize::MAX,
            is_discarding: false,
            seek_delimiters,
            sequence_writer,
        }
    }

    /// Returns a `AnyDelimiterCodec` with a maximum chunk length limit.
    ///
    /// If this is set, calls to `AnyDelimiterCodec::decode` will return a
    /// [`AnyDelimiterCodecError`] when a chunk exceeds the length limit. Subsequent calls
    /// will discard up to `limit` bytes from that chunk until a delimiter
    /// character is reached, returning `None` until the delimiter over the limit
    /// has been fully discarded. After that point, calls to `decode` will
    /// function as normal.
    ///
    /// # Note
    ///
    /// Setting a length limit is highly recommended for any `AnyDelimiterCodec` which
    /// will be exposed to untrusted input. Otherwise, the size of the buffer
    /// that holds the chunk currently being read is unbounded. An attacker could
    /// exploit this unbounded buffer by sending an unbounded amount of input
    /// without any delimiter characters, causing unbounded memory consumption.
    ///
    /// [`AnyDelimiterCodecError`]: crate::codec::AnyDelimiterCodecError
    pub fn new_with_max_length(
        seek_delimiters: Vec<u8>,
        sequence_writer: Vec<u8>,
        max_length: usize,
    ) -> Self {
        AnyDelimiterCodec {
            max_length,
            ..AnyDelimiterCodec::new(seek_delimiters, sequence_writer)
        }
    }

    /// Returns the maximum chunk length when decoding.
    ///
    /// ```
    /// use tokio_util::codec::AnyDelimiterCodec;
    ///
    /// let codec = AnyDelimiterCodec::new(b",;\n".to_vec(), b";".to_vec());
    /// assert_eq!(codec.max_length(), usize::MAX);
    /// ```
    /// ```
    /// use tokio_util::codec::AnyDelimiterCodec;
    ///
    /// let codec = AnyDelimiterCodec::new_with_max_length(b",;\n".to_vec(), b";".to_vec(), 256);
    /// assert_eq!(codec.max_length(), 256);
    /// ```
    pub fn max_length(&self) -> usize {
        self.max_length
    }
}

impl Decoder for AnyDelimiterCodec {
    type Item = Bytes;
    type Error = AnyDelimiterCodecError;

    fn decode(&mut self, buf: &mut BytesMut) -> Result<Option<Bytes>, AnyDelimiterCodecError> {
        loop {
            // Determine how far into the buffer we'll search for a delimiter. If
            // there's no max_length set, we'll read to the end of the buffer.
            let read_to = cmp::min(self.max_length.saturating_add(1), buf.len());

            let new_chunk_offset = buf[self.next_index..read_to]
                .iter()
                .position(|b| self.seek_delimiters.contains(b));

            match (self.is_discarding, new_chunk_offset) {
                (true, Some(offset)) => {
                    // If we found a new chunk, discard up to that offset and
                    // then stop discarding. On the next iteration, we'll try
                    // to read a chunk normally.
                    buf.advance(offset + self.next_index + 1);
                    self.is_discarding = false;
                    self.next_index = 0;
                }
                (true, None) => {
                    // Otherwise, we didn't find a new chunk, so we'll discard
                    // everything we read. On the next iteration, we'll continue
                    // discarding up to max_len bytes unless we find a new chunk.
                    buf.advance(read_to);
                    self.next_index = 0;
                    if buf.is_empty() {
                        return Ok(None);
                    }
                }
                (false, Some(offset)) => {
                    // Found a chunk!
                    let new_chunk_index = offset + self.next_index;
                    self.next_index = 0;
                    let mut chunk = buf.split_to(new_chunk_index + 1);
                    chunk.truncate(chunk.len() - 1);
                    let chunk = chunk.freeze();
                    return Ok(Some(chunk));
                }
                (false, None) if buf.len() > self.max_length => {
                    // Reached the maximum length without finding a
                    // new chunk, return an error and start discarding on the
                    // next call.
                    self.is_discarding = true;
                    return Err(AnyDelimiterCodecError::MaxChunkLengthExceeded);
                }
                (false, None) => {
                    // We didn't find a chunk or reach the length limit, so the next
                    // call will resume searching at the current offset.
                    self.next_index = read_to;
                    return Ok(None);
                }
            }
        }
    }

    fn decode_eof(&mut self, buf: &mut BytesMut) -> Result<Option<Bytes>, AnyDelimiterCodecError> {
        Ok(match self.decode(buf)? {
            Some(frame) => Some(frame),
            None => {
                // return remaining data, if any
                if buf.is_empty() {
                    None
                } else {
                    let chunk = buf.split_to(buf.len());
                    self.next_index = 0;
                    Some(chunk.freeze())
                }
            }
        })
    }
}

impl<T> Encoder<T> for AnyDelimiterCodec
where
    T: AsRef<str>,
{
    type Error = AnyDelimiterCodecError;

    fn encode(&mut self, chunk: T, buf: &mut BytesMut) -> Result<(), AnyDelimiterCodecError> {
        let chunk = chunk.as_ref();
        buf.reserve(chunk.len() + self.sequence_writer.len());
        buf.put(chunk.as_bytes());
        buf.put(self.sequence_writer.as_ref());

        Ok(())
    }
}

impl Default for AnyDelimiterCodec {
    fn default() -> Self {
        Self::new(
            DEFAULT_SEEK_DELIMITERS.to_vec(),
            DEFAULT_SEQUENCE_WRITER.to_vec(),
        )
    }
}

/// An error occurred while encoding or decoding a chunk.
#[derive(Debug)]
pub enum AnyDelimiterCodecError {
    /// The maximum chunk length was exceeded.
    MaxChunkLengthExceeded,
    /// An IO error occurred.
    Io(io::Error),
}

impl fmt::Display for AnyDelimiterCodecError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AnyDelimiterCodecError::MaxChunkLengthExceeded => {
                write!(f, "max chunk length exceeded")
            }
            AnyDelimiterCodecError::Io(e) => write!(f, "{e}"),
        }
    }
}

impl From<io::Error> for AnyDelimiterCodecError {
    fn from(e: io::Error) -> AnyDelimiterCodecError {
        AnyDelimiterCodecError::Io(e)
    }
}

impl std::error::Error for AnyDelimiterCodecError {}

```

### Core Architecture Module: `tokio-util/src/codec/bytes_codec.rs`
```
use crate::codec::decoder::Decoder;
use crate::codec::encoder::Encoder;

use bytes::{BufMut, Bytes, BytesMut};
use std::io;

/// A simple [`Decoder`] and [`Encoder`] implementation that just ships bytes around.
///
/// [`Decoder`]: crate::codec::Decoder
/// [`Encoder`]: crate::codec::Encoder
///
/// # Example
///
/// Turn an [`AsyncRead`] into a stream of `Result<`[`BytesMut`]`, `[`Error`]`>`.
///
/// [`AsyncRead`]: tokio::io::AsyncRead
/// [`BytesMut`]: bytes::BytesMut
/// [`Error`]: std::io::Error
///
/// ```
/// # mod hidden {
/// # #[allow(unused_imports)]
/// use tokio::fs::File;
/// # }
/// use tokio::io::AsyncRead;
/// use tokio_util::codec::{FramedRead, BytesCodec};
///
/// # enum File {}
/// # impl File {
/// #     async fn open(_name: &str) -> Result<impl AsyncRead, std::io::Error> {
/// #         use std::io::Cursor;
/// #         Ok(Cursor::new(vec![0, 1, 2, 3, 4, 5]))
/// #     }
/// # }
/// #
/// # #[tokio::main(flavor = "current_thread")]
/// # async fn main() -> Result<(), std::io::Error> {
/// let my_async_read = File::open("filename.txt").await?;
/// let my_stream_of_bytes = FramedRead::new(my_async_read, BytesCodec::new());
/// # Ok(())
/// # }
/// ```
///
#[derive(Copy, Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, Default)]
pub struct BytesCodec(());

impl BytesCodec {
    /// Creates a new `BytesCodec` for shipping around raw bytes.
    pub fn new() -> BytesCodec {
        BytesCodec(())
    }
}

impl Decoder for BytesCodec {
    type Item = BytesMut;
    type Error = io::Error;

    fn decode(&mut self, buf: &mut BytesMut) -> Result<Option<BytesMut>, io::Error> {
        if !buf.is_empty() {
            let len = buf.len();
            Ok(Some(buf.split_to(len)))
        } else {
            Ok(None)
        }
    }
}

impl Encoder<Bytes> for BytesCodec {
    type Error = io::Error;

    fn encode(&mut self, data: Bytes, buf: &mut BytesMut) -> Result<(), io::Error> {
        buf.reserve(data.len());
        buf.put(data);
        Ok(())
    }
}

impl Encoder<BytesMut> for BytesCodec {
    type Error = io::Error;

    fn encode(&mut self, data: BytesMut, buf: &mut BytesMut) -> Result<(), io::Error> {
        buf.reserve(data.len());
        buf.put(data);
        Ok(())
    }
}

```

### Core Architecture Module: `tokio-util/src/codec/decoder.rs`
```
use crate::codec::Framed;

use tokio::io::{AsyncRead, AsyncWrite};

use bytes::BytesMut;
use std::io;

/// Decoding of frames via buffers.
///
/// This trait is used when constructing an instance of [`Framed`] or
/// [`FramedRead`]. An implementation of `Decoder` takes a byte stream that has
/// already been buffered in `src` and decodes the data into a stream of
/// `Self::Item` frames.
///
/// Implementations are able to track state on `self`, which enables
/// implementing stateful streaming parsers. In many cases, though, this type
/// will simply be a unit struct (e.g. `struct HttpDecoder`).
///
/// For some underlying data-sources, namely files and FIFOs,
/// it's possible to temporarily read 0 bytes by reaching EOF.
///
/// In these cases `decode_eof` will be called until it signals
/// fulfillment of all closing frames by returning `Ok(None)`.
/// After that, repeated attempts to read from the [`Framed`] or [`FramedRead`]
/// will not invoke `decode` or `decode_eof` again, until data can be read
/// during a retry.
///
/// It is up to the Decoder to keep track of a restart after an EOF,
/// and to decide how to handle such an event by, for example,
/// allowing frames to cross EOF boundaries, re-emitting opening frames, or
/// resetting the entire internal state.
///
/// [`Framed`]: crate::codec::Framed
/// [`FramedRead`]: crate::codec::FramedRead
pub trait Decoder {
    /// The type of decoded frames.
    type Item;

    /// The type of unrecoverable frame decoding errors.
    ///
    /// If an individual message is ill-formed but can be ignored without
    /// interfering with the processing of future messages, it may be more
    /// useful to report the failure as an `Item`.
    ///
    /// `From<io::Error>` is required in the interest of making `Error` suitable
    /// for returning directly from a [`FramedRead`], and to enable the default
    /// implementation of `decode_eof` to yield an `io::Error` when the decoder
    /// fails to consume all available data.
    ///
    /// Note that implementers of this trait can simply indicate `type Error =
    /// io::Error` to use I/O errors as this type.
    ///
    /// [`FramedRead`]: crate::codec::FramedRead
    type Error: From<io::Error>;

    /// Attempts to decode a frame from the provided buffer of bytes.
    ///
    /// This method is called by [`FramedRead`] whenever bytes are ready to be
    /// parsed. The provided buffer of bytes is what's been read so far, and
    /// this instance of `Decode` can determine whether an entire frame is in
    /// the buffer and is ready to be returned.
    ///
    /// If an entire frame is available, then this instance will remove those
    /// bytes from the buffer provided and return them as a decoded
    /// frame. Note that removing bytes from the provided buffer doesn't always
    /// necessarily copy the bytes, so this should be an efficient operation in
    /// most circumstances.
    ///
    /// If the bytes look valid, but a frame isn't fully available yet, then
    /// `Ok(None)` is returned. This indicates to the [`Framed`] instance that
    /// it needs to read some more bytes before calling this method again.
    ///
    /// Note that the bytes provided may be empty. If a previous call to
    /// `decode` consumed all the bytes in the buffer then `decode` will be
    /// called again until it returns `Ok(None)`, indicating that more bytes need to
    /// be read.
    ///
    /// Finally, if the bytes in the buffer are malformed then an error is
    /// returned indicating why. This informs [`Framed`] that the stream is now
    /// corrupt and should be terminated.
    ///
    /// [`Framed`]: crate::codec::Framed
    /// [`FramedRead`]: crate::codec::FramedRead
    ///
    /// # Buffer management
    ///
    /// Before returning from the function, implementations should ensure that
    /// the buffer has appropriate capacity in anticipation of future calls to
    /// `decode`. Failing to do so leads to inefficiency.
    ///
    /// For example, if frames have a fixed length, or if the length of the
    /// current frame is known from a header, a possible buffer management
    /// strategy is:
    ///
    /// ```no_run
    /// # use std::io;
    /// #
    /// # use bytes::BytesMut;
    /// # use tokio_util::codec::Decoder;
    /// #
    /// # struct MyCodec;
    /// #
    /// impl Decoder for MyCodec {
    ///     // ...
    ///     # type Item = BytesMut;
    ///     # type Error = io::Error;
    ///
    ///     fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
    ///         // ...
    ///
    ///         // Reserve enough to complete decoding of the current frame.
    ///         let current_frame_len: usize = 1000; // Example.
    ///         // And to start decoding the next frame.
    ///         let next_frame_header_len: usize = 10; // Example.
    ///         src.reserve(current_frame_len + next_frame_header_len);
    ///
    ///         return Ok(None);
    ///     }
    /// }
    /// ```
    ///
    /// An optimal buffer management strategy minimizes reallocations and
    /// over-allocations.
    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error>;

    /// A default method available to be called when there are no more bytes
    /// available to be read from the underlying I/O.
    ///
    /// This method defaults to calling `decode` and returns an error if
    /// `Ok(None)` is returned while there is unconsumed data in `buf`.
    /// Typically this doesn't need to be implemented unless the framing
    /// protocol differs near the end of the stream, or if you need to construct
    /// frames _across_ eof boundaries on sources that can be resumed.
    ///
    /// Note that the `buf` argument may be empty. If a previous call to
    /// `decode_eof` consumed all the bytes in the buffer, `decode_eof` will be
    /// called again until it returns `None`, indicating that there are no more
    /// frames to yield. This behavior enables returning finalization frames
    /// that may not be based on inbound data.
    ///
    /// Once `None` has been returned, `decode_eof` won't be called again until
    /// an attempt to resume the stream has been made, where the underlying stream
    /// actually returned more data.
    fn decode_eof(&mut self, buf: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        match self.decode(buf)? {
            Some(frame) => Ok(Some(frame)),
            None => {
                if buf.is_empty() {
                    Ok(None)
                } else {
                    Err(io::Error::other("bytes remaining on stream").into())
                }
            }
        }
    }

    /// Provides a [`Stream`] and [`Sink`] interface for reading and writing to this
    /// `Io` object, using `Decode` and `Encode` to read and write the raw data.
    ///
    /// Raw I/O objects work with byte sequences, but higher-level code usually
    /// wants to batch these into meaningful chunks, called "frames". This
    /// method layers framing on top of an I/O object, by using the `Codec`
    /// traits to handle encoding and decoding of messages frames. Note that
    /// the incoming and outgoing frame types may be distinct.
    ///
    /// This function returns a *single* object that is both `Stream` and
    /// `Sink`; grouping this into a single object is often useful for layering
    /// things like gzip or TLS, which require both read and write access to the
    /// underlying object.
    ///
    /// If you want to work more directly with the streams and sink, consider
    /// calling `split` on the [`Framed`] returned by this method, which will
    /// break them into separate objects, allowing them to interact more easily.
    ///
    /// [`Stream`]: futures_core::Stream
    /// [`Sink`]: futures_sink::Sink
    /// [`Framed`]: crate::codec::Framed
    fn framed<T: AsyncRead + AsyncWrite + Sized>(self, io: T) -> Framed<T, Self>
    where
        Self: Sized,
    {
        Framed::new(io, self)
    }
}

```

### Core Architecture Module: `tokio-util/src/codec/encoder.rs`
```
use bytes::BytesMut;
use std::io;

/// Trait of helper objects to write out messages as bytes, for use with
/// [`FramedWrite`].
///
/// [`FramedWrite`]: crate::codec::FramedWrite
pub trait Encoder<Item> {
    /// The type of encoding errors.
    ///
    /// [`FramedWrite`] requires `Encoder`s errors to implement `From<io::Error>`
    /// in the interest of letting it return `Error`s directly.
    ///
    /// [`FramedWrite`]: crate::codec::FramedWrite
    type Error: From<io::Error>;

    /// Encodes a frame into the buffer provided.
    ///
    /// This method will encode `item` into the byte buffer provided by `dst`.
    /// The `dst` provided is an internal buffer of the [`FramedWrite`] instance and
    /// will be written out when possible.
    ///
    /// [`FramedWrite`]: crate::codec::FramedWrite
    fn encode(&mut self, item: Item, dst: &mut BytesMut) -> Result<(), Self::Error>;
}

```

### Core Architecture Module: `tokio-util/src/codec/framed.rs`
```
use crate::codec::decoder::Decoder;
use crate::codec::encoder::Encoder;
use crate::codec::framed_impl::{FramedImpl, RWFrames, ReadFrame, WriteFrame};

use futures_core::Stream;
use tokio::io::{AsyncRead, AsyncWrite};

use bytes::BytesMut;
use futures_sink::Sink;
use pin_project_lite::pin_project;
use std::fmt;
use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};

pin_project! {
    /// A unified [`Stream`] and [`Sink`] interface to an underlying I/O object, using
    /// the `Encoder` and `Decoder` traits to encode and decode frames.
    ///
    /// You can create a `Framed` instance by using the [`Decoder::framed`] adapter, or
    /// by using the `new` function seen below.
    ///
    /// # Cancellation safety
    ///
    /// * [`futures_util::sink::SinkExt::send`]: if send is used as the event in a
    /// `tokio::select!` statement and some other branch completes first, then it is
    /// guaranteed that the message was not sent, but the message itself is lost.
    /// * [`tokio_stream::StreamExt::next`]: This method is cancel safe. The returned
    /// future only holds onto a reference to the underlying stream, so dropping it will
    /// never lose a value.
    ///
    /// [`Stream`]: futures_core::Stream
    /// [`Sink`]: futures_sink::Sink
    /// [`AsyncRead`]: tokio::io::AsyncRead
    /// [`Decoder::framed`]: crate::codec::Decoder::framed()
    /// [`futures_util::sink::SinkExt::send`]: futures_util::sink::SinkExt::send
    /// [`tokio_stream::StreamExt::next`]: https://docs.rs/tokio-stream/latest/tokio_stream/trait.StreamExt.html#method.next
    pub struct Framed<T, U> {
        #[pin]
        inner: FramedImpl<T, U, RWFrames>
    }
}

impl<T, U> Framed<T, U> {
    /// Provides a [`Stream`] and [`Sink`] interface for reading and writing to this
    /// I/O object, using [`Decoder`] and [`Encoder`] to read and write the raw data.
    ///
    /// Raw I/O objects work with byte sequences, but higher-level code usually
    /// wants to batch these into meaningful chunks, called "frames". This
    /// method layers framing on top of an I/O object, by using the codec
    /// traits to handle encoding and decoding of messages frames. Note that
    /// the incoming and outgoing frame types may be distinct.
    ///
    /// This function returns a *single* object that is both [`Stream`] and
    /// [`Sink`]; grouping this into a single object is often useful for layering
    /// things like gzip or TLS, which require both read and write access to the
    /// underlying object.
    ///
    /// If you want to work more directly with the streams and sink, consider
    /// calling [`split`] on the `Framed` returned by this method, which will
    /// break them into separate objects, allowing them to interact more easily.
    ///
    /// Note that, for some byte sources, the stream can be resumed after an EOF
    /// by reading from it, even after it has returned `None`. Repeated attempts
    /// to do so, without new data available, continue to return `None` without
    /// creating more (closing) frames.
    ///
    /// [`Stream`]: futures_core::Stream
    /// [`Sink`]: futures_sink::Sink
    /// [`Decode`]: crate::codec::Decoder
    /// [`Encoder`]: crate::codec::Encoder
    /// [`split`]: https://docs.rs/futures/0.3/futures/stream/trait.StreamExt.html#method.split
    pub fn new(inner: T, codec: U) -> Framed<T, U> {
        Framed {
            inner: FramedImpl {
                inner,
                codec,
                state: Default::default(),
            },
        }
    }

    /// Provides a [`Stream`] and [`Sink`] interface for reading and writing to this
    /// I/O object, using [`Decoder`] and [`Encoder`] to read and write the raw data,
    /// with a specific read buffer initial capacity.
    ///
    /// Raw I/O objects work with byte sequences, but higher-level code usually
    /// wants to batch these into meaningful chunks, called "frames". This
    /// method layers framing on top of an I/O object, by using the codec
    /// traits to handle encoding and decoding of messages frames. Note that
    /// the incoming and outgoing frame types may be distinct.
    ///
    /// This function returns a *single* object that is both [`Stream`] and
    /// [`Sink`]; grouping this into a single object is often useful for layering
    /// things like gzip or TLS, which require both read and write access to the
    /// underlying object.
    ///
    /// If you want to work more directly with the streams and sink, consider
    /// calling [`split`] on the `Framed` returned by this method, which will
    /// break them into separate objects, allowing them to interact more easily.
    ///
    /// [`Stream`]: futures_core::Stream
    /// [`Sink`]: futures_sink::Sink
    /// [`Decode`]: crate::codec::Decoder
    /// [`Encoder`]: crate::codec::Encoder
    /// [`split`]: https://docs.rs/futures/0.3/futures/stream/trait.StreamExt.html#method.split
    pub fn with_capacity(inner: T, codec: U, capacity: usize) -> Framed<T, U> {
        Framed {
            inner: FramedImpl {
                inner,
                codec,
                state: RWFrames {
                    read: ReadFrame {
                        eof: false,
                        is_readable: false,
                        buffer: BytesMut::with_capacity(capacity),
                        has_errored: false,
                    },
                    write: WriteFrame {
                        buffer: BytesMut::with_capacity(capacity),
                        backpressure_boundary: capacity,
                    },
                },
            },
        }
    }

    /// Provides a [`Stream`] and [`Sink`] interface for reading and writing to this
    /// I/O object, using [`Decoder`] and [`Encoder`] to read and write the raw data.
    ///
    /// Raw I/O objects work with byte sequences, but higher-level code usually
    /// wants to batch these into meaningful chunks, called "frames". This
    /// method layers framing on top of an I/O object, by using the `Codec`
    /// traits to handle encoding and decoding of messages frames. Note that
    /// the incoming and outgoing frame types may be distinct.
    ///
    /// This function returns a *single* object that is both [`Stream`] and
    /// [`Sink`]; grouping this into a single object is often useful for layering
    /// things like gzip or TLS, which require both read and write access to the
    /// underlying object.
    ///
    /// This objects takes a stream and a `readbuffer` and a `writebuffer`. These field
    /// can be obtained from an existing `Framed` with the [`into_parts`] method.
    ///
    /// If you want to work more directly with the streams and sink, consider
    /// calling [`split`] on the `Framed` returned by this method, which will
    /// break them into separate objects, allowing them to interact more easily.
    ///
    /// [`Stream`]: futures_core::Stream
    /// [`Sink`]: futures_sink::Sink
    /// [`Decoder`]: crate::codec::Decoder
    /// [`Encoder`]: crate::codec::Encoder
    /// [`into_parts`]: crate::codec::Framed::into_parts()
    /// [`split`]: https://docs.rs/futures/0.3/futures/stream/trait.StreamExt.html#method.split
    pub fn from_parts(parts: FramedParts<T, U>) -> Framed<T, U> {
        Framed {
            inner: FramedImpl {
                inner: parts.io,
                codec: parts.codec,
                state: RWFrames {
                    read: parts.read_buf.into(),
                    write: parts.write_buf.into(),
                },
            },
        }
    }

    /// Returns a reference to the underlying I/O stream wrapped by
    /// `Framed`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_ref(&self) -> &T {
        &self.inner.inner
    }

    /// Returns a mutable reference to the underlying I/O stream wrapped by
    /// `Framed`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_mut(&mut self) -> &mut T {
        &mut self.inner.inner
    }

    /// Returns a pinned mutable reference to the underlying I/O stream wrapped by
    /// `Framed`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_pin_mut(self: Pin<&mut Self>) -> Pin<&mut T> {
        self.project().inner.project().inner
    }

    /// Returns a reference to the underlying codec wrapped by
    /// `Framed`.
    ///
    /// Note that care should be taken to not tamper with the underlying codec
    /// as it may corrupt the stream of frames otherwise being worked with.
    pub fn codec(&self) -> &U {
        &self.inner.codec
    }

    /// Returns a mutable reference to the underlying codec wrapped by
    /// `Framed`.
    ///
    /// Note that care should be taken to not tamper with the underlying codec
    /// as it may corrupt the stream of frames otherwise being worked with.
    pub fn codec_mut(&mut self) -> &mut U {
        &mut self.inner.codec
    }

    /// Maps the codec `U` to `C`, preserving the read and write buffers
    /// wrapped by `Framed`.
    ///
    /// Note that care should be taken to not tamper with the underlying codec
    /// as it may corrupt the stream of frames otherwise being worked with.
    pub fn map_codec<C, F>(self, map: F) -> Framed<T, C>
    where
        F: FnOnce(U) -> C,
    {
        // This could be potentially simplified once rust-lang/rust#86555 hits stable
        let parts = self.into_parts();
        Framed::from_parts(FramedParts {
            io: parts.io,
            codec: map(parts.codec),
            read_buf: parts.read_buf,
            write_buf: pa
```

### Core Architecture Module: `tokio-util/src/codec/framed_impl.rs`
```
use crate::codec::decoder::Decoder;
use crate::codec::encoder::Encoder;

use futures_core::Stream;
use tokio::io::{AsyncRead, AsyncWrite};

use bytes::BytesMut;
use futures_sink::Sink;
use pin_project_lite::pin_project;
use std::borrow::{Borrow, BorrowMut};
use std::io;
use std::pin::Pin;
use std::task::{ready, Context, Poll};

pin_project! {
    #[derive(Debug)]
    pub(crate) struct FramedImpl<T, U, State> {
        #[pin]
        pub(crate) inner: T,
        pub(crate) state: State,
        pub(crate) codec: U,
    }
}

const INITIAL_CAPACITY: usize = 8 * 1024;

#[derive(Debug)]
pub(crate) struct ReadFrame {
    pub(crate) eof: bool,
    pub(crate) is_readable: bool,
    pub(crate) buffer: BytesMut,
    pub(crate) has_errored: bool,
}

pub(crate) struct WriteFrame {
    pub(crate) buffer: BytesMut,
    pub(crate) backpressure_boundary: usize,
}

#[derive(Default)]
pub(crate) struct RWFrames {
    pub(crate) read: ReadFrame,
    pub(crate) write: WriteFrame,
}

impl Default for ReadFrame {
    fn default() -> Self {
        Self {
            eof: false,
            is_readable: false,
            buffer: BytesMut::with_capacity(INITIAL_CAPACITY),
            has_errored: false,
        }
    }
}

impl Default for WriteFrame {
    fn default() -> Self {
        Self {
            buffer: BytesMut::with_capacity(INITIAL_CAPACITY),
            backpressure_boundary: INITIAL_CAPACITY,
        }
    }
}

impl From<BytesMut> for ReadFrame {
    fn from(mut buffer: BytesMut) -> Self {
        let is_readable = !buffer.is_empty();
        let size = buffer.capacity();
        if size < INITIAL_CAPACITY {
            buffer.reserve(INITIAL_CAPACITY - size);
        }

        Self {
            buffer,
            is_readable,
            eof: false,
            has_errored: false,
        }
    }
}

impl From<BytesMut> for WriteFrame {
    fn from(mut buffer: BytesMut) -> Self {
        let size = buffer.capacity();
        if size < INITIAL_CAPACITY {
            buffer.reserve(INITIAL_CAPACITY - size);
        }

        Self {
            buffer,
            backpressure_boundary: INITIAL_CAPACITY,
        }
    }
}

impl Borrow<ReadFrame> for RWFrames {
    fn borrow(&self) -> &ReadFrame {
        &self.read
    }
}
impl BorrowMut<ReadFrame> for RWFrames {
    fn borrow_mut(&mut self) -> &mut ReadFrame {
        &mut self.read
    }
}
impl Borrow<WriteFrame> for RWFrames {
    fn borrow(&self) -> &WriteFrame {
        &self.write
    }
}
impl BorrowMut<WriteFrame> for RWFrames {
    fn borrow_mut(&mut self) -> &mut WriteFrame {
        &mut self.write
    }
}
impl<T, U, R> Stream for FramedImpl<T, U, R>
where
    T: AsyncRead,
    U: Decoder,
    R: BorrowMut<ReadFrame>,
{
    type Item = Result<U::Item, U::Error>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        use crate::util::poll_read_buf;

        let mut pinned = self.project();
        let state: &mut ReadFrame = pinned.state.borrow_mut();
        // The following loops implements a state machine with each state corresponding
        // to a combination of the `is_readable` and `eof` flags. States persist across
        // loop entries and most state transitions occur with a return.
        //
        // The initial state is `reading`.
        //
        // | state   | eof   | is_readable | has_errored |
        // |---------|-------|-------------|-------------|
        // | reading | false | false       | false       |
        // | framing | false | true        | false       |
        // | pausing | true  | true        | false       |
        // | paused  | true  | false       | false       |
        // | errored | <any> | <any>       | true        |
        //                                                       `decode_eof` returns Err
        //                                          ┌────────────────────────────────────────────────────────┐
        //                   `decode_eof` returns   │                                                        │
        //                             `Ok(Some)`   │                                                        │
        //                                 ┌─────┐  │     `decode_eof` returns               After returning │
        //                Read 0 bytes     ├─────▼──┴┐    `Ok(None)`          ┌────────┐ ◄───┐ `None`    ┌───▼─────┐
        //               ┌────────────────►│ Pausing ├───────────────────────►│ Paused ├─┐   └───────────┤ Errored │
        //               │                 └─────────┘                        └─┬──▲───┘ │               └───▲───▲─┘
        // Pending read  │                                                      │  │     │                   │   │
        //     ┌──────┐  │            `decode` returns `Some`                   │  └─────┘                   │   │
        //     │      │  │                   ┌──────┐                           │  Pending                   │   │
        //     │ ┌────▼──┴─┐ Read n>0 bytes ┌┴──────▼─┐     read n>0 bytes      │  read                      │   │
        //     └─┤ Reading ├───────────────►│ Framing │◄────────────────────────┘                            │   │
        //       └──┬─▲────┘                └─────┬──┬┘                                                      │   │
        //          │ │                           │  │                 `decode` returns Err                  │   │
        //          │ └───decode` returns `None`──┘  └───────────────────────────────────────────────────────┘   │
        //          │                             read returns Err                                               │
        //          └────────────────────────────────────────────────────────────────────────────────────────────┘
        loop {
            // Return `None` if we have encountered an error from the underlying decoder
            // See: https://github.com/tokio-rs/tokio/issues/3976
            if state.has_errored {
                // preparing has_errored -> paused
                trace!("Returning None and setting paused");
                state.is_readable = false;
                state.has_errored = false;
                return Poll::Ready(None);
            }

            // Repeatedly call `decode` or `decode_eof` while the buffer is "readable",
            // i.e. it _might_ contain data consumable as a frame or closing frame.
            // Both signal that there is no such data by returning `None`.
            //
            // If `decode` couldn't read a frame and the upstream source has returned eof,
            // `decode_eof` will attempt to decode the remaining bytes as closing frames.
            //
            // If the underlying AsyncRead is resumable, we may continue after an EOF,
            // but must finish emitting all of it's associated `decode_eof` frames.
            // Furthermore, we don't want to emit any `decode_eof` frames on retried
            // reads after an EOF unless we've actually read more data.
            if state.is_readable {
                // pausing or framing
                if state.eof {
                    // pausing
                    let frame = pinned
                        .codec
                        .decode_eof(&mut state.buffer)
                        .inspect_err(|_err| {
                            trace!("Got an error, going to errored state");
                            state.has_errored = true;
                        })?;
                    if frame.is_none() {
                        state.is_readable = false; // prepare pausing -> paused
                    }
                    // implicit pausing -> pausing or pausing -> paused
                    return Poll::Ready(frame.map(Ok));
                }

                // framing
                trace!("attempting to decode a frame");

                if let Some(frame) = pinned.codec.decode(&mut state.buffer).inspect_err(|_op| {
                    trace!("Got an error, going to errored state");
                    state.has_errored = true;
                })? {
                    trace!("frame decoded from buffer");
                    // implicit framing -> framing
                    return Poll::Ready(Some(Ok(frame)));
                }

                // framing -> reading
                state.is_readable = false;
            }
            // reading or paused
            // If we can't build a frame yet, try to read more data and try again.
            // Make sure we've got room for at least one byte to read to ensure
            // that we don't get a spurious 0 that looks like EOF.
            state.buffer.reserve(1);
            #[allow(clippy::blocks_in_conditions)]
            let bytect = match poll_read_buf(pinned.inner.as_mut(), cx, &mut state.buffer).map_err(
                |err| {
                    trace!("Got an error, going to errored state");
                    state.has_errored = true;
                    err
                },
            )? {
                Poll::Ready(ct) => ct,
                // implicit reading -> reading or implicit paused -> paused
                Poll::Pending => return Poll::Pending,
            };
            if bytect == 0 {
                if state.eof {
                    // We're already at an EOF, and since we've reached this path
                    // we're also not readable. This implies that we've already finished
                    // our `decode_eof` handling, so we can simply return `None`.
                    // implicit paused -> paused
                    return Poll::Ready(None);
                }
                // prepare reading -> paused
                state.eof = true;
            } else {
                // prepare paused -> framing or noop reading -> framing
                state.eof = false;
            }

            // paused -> framing or reading -> framing or reading -> pausing
            state.is_readable = true;
        }
    }
}

impl<T, I, U, W> Sink<I> fo
```

### Core Architecture Module: `tokio-util/src/codec/framed_read.rs`
```
use crate::codec::framed_impl::{FramedImpl, ReadFrame};
use crate::codec::Decoder;

use futures_core::Stream;
use tokio::io::AsyncRead;

use bytes::BytesMut;
use futures_sink::Sink;
use pin_project_lite::pin_project;
use std::fmt;
use std::pin::Pin;
use std::task::{Context, Poll};

use super::FramedParts;

pin_project! {
    /// A [`Stream`] of messages decoded from an [`AsyncRead`].
    ///
    /// For examples of how to use `FramedRead` with a codec, see the
    /// examples on the [`codec`] module.
    ///
    /// # Cancellation safety
    /// * [`tokio_stream::StreamExt::next`]: This method is cancel safe. The returned
    /// future only holds onto a reference to the underlying stream, so dropping it will
    /// never lose a value.
    ///
    /// [`Stream`]: futures_core::Stream
    /// [`AsyncRead`]: tokio::io::AsyncRead
    /// [`codec`]: crate::codec
    /// [`tokio_stream::StreamExt::next`]: https://docs.rs/tokio-stream/latest/tokio_stream/trait.StreamExt.html#method.next
    pub struct FramedRead<T, D> {
        #[pin]
        inner: FramedImpl<T, D, ReadFrame>,
    }
}

// ===== impl FramedRead =====

impl<T, D> FramedRead<T, D> {
    /// Creates a new `FramedRead` with the given `decoder`.
    pub fn new(inner: T, decoder: D) -> FramedRead<T, D> {
        FramedRead {
            inner: FramedImpl {
                inner,
                codec: decoder,
                state: Default::default(),
            },
        }
    }

    /// Creates a new `FramedRead` with the given `decoder` and a buffer of `capacity`
    /// initial size.
    pub fn with_capacity(inner: T, decoder: D, capacity: usize) -> FramedRead<T, D> {
        FramedRead {
            inner: FramedImpl {
                inner,
                codec: decoder,
                state: ReadFrame {
                    eof: false,
                    is_readable: false,
                    buffer: BytesMut::with_capacity(capacity),
                    has_errored: false,
                },
            },
        }
    }

    /// Returns a reference to the underlying I/O stream wrapped by
    /// `FramedRead`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_ref(&self) -> &T {
        &self.inner.inner
    }

    /// Returns a mutable reference to the underlying I/O stream wrapped by
    /// `FramedRead`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_mut(&mut self) -> &mut T {
        &mut self.inner.inner
    }

    /// Returns a pinned mutable reference to the underlying I/O stream wrapped by
    /// `FramedRead`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_pin_mut(self: Pin<&mut Self>) -> Pin<&mut T> {
        self.project().inner.project().inner
    }

    /// Consumes the `FramedRead`, returning its underlying I/O stream.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn into_inner(self) -> T {
        self.inner.inner
    }

    /// Returns a reference to the underlying decoder.
    pub fn decoder(&self) -> &D {
        &self.inner.codec
    }

    /// Returns a mutable reference to the underlying decoder.
    pub fn decoder_mut(&mut self) -> &mut D {
        &mut self.inner.codec
    }

    /// Maps the decoder `D` to `C`, preserving the read buffer
    /// wrapped by `Framed`.
    pub fn map_decoder<C, F>(self, map: F) -> FramedRead<T, C>
    where
        F: FnOnce(D) -> C,
    {
        // This could be potentially simplified once rust-lang/rust#86555 hits stable
        let FramedImpl {
            inner,
            state,
            codec,
        } = self.inner;
        FramedRead {
            inner: FramedImpl {
                inner,
                state,
                codec: map(codec),
            },
        }
    }

    /// Returns a mutable reference to the underlying decoder.
    pub fn decoder_pin_mut(self: Pin<&mut Self>) -> &mut D {
        self.project().inner.project().codec
    }

    /// Returns a reference to the read buffer.
    pub fn read_buffer(&self) -> &BytesMut {
        &self.inner.state.buffer
    }

    /// Returns a mutable reference to the read buffer.
    pub fn read_buffer_mut(&mut self) -> &mut BytesMut {
        &mut self.inner.state.buffer
    }

    /// Consumes the `FramedRead`, returning its underlying I/O stream, the buffer
    /// with unprocessed data, and the codec.
    pub fn into_parts(self) -> FramedParts<T, D> {
        FramedParts {
            io: self.inner.inner,
            codec: self.inner.codec,
            read_buf: self.inner.state.buffer,
            write_buf: BytesMut::new(),
            _priv: (),
        }
    }
}

// This impl just defers to the underlying FramedImpl
impl<T, D> Stream for FramedRead<T, D>
where
    T: AsyncRead,
    D: Decoder,
{
    type Item = Result<D::Item, D::Error>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.project().inner.poll_next(cx)
    }
}

// This impl just defers to the underlying T: Sink
impl<T, I, D> Sink<I> for FramedRead<T, D>
where
    T: Sink<I>,
{
    type Error = T::Error;

    fn poll_ready(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.project().inner.project().inner.poll_ready(cx)
    }

    fn start_send(self: Pin<&mut Self>, item: I) -> Result<(), Self::Error> {
        self.project().inner.project().inner.start_send(item)
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.project().inner.project().inner.poll_flush(cx)
    }

    fn poll_close(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.project().inner.project().inner.poll_close(cx)
    }
}

impl<T, D> fmt::Debug for FramedRead<T, D>
where
    T: fmt::Debug,
    D: fmt::Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("FramedRead")
            .field("inner", &self.get_ref())
            .field("decoder", &self.decoder())
            .field("eof", &self.inner.state.eof)
            .field("is_readable", &self.inner.state.is_readable)
            .field("buffer", &self.read_buffer())
            .finish()
    }
}

```

### Core Architecture Module: `tokio-util/src/codec/framed_write.rs`
```
use crate::codec::encoder::Encoder;
use crate::codec::framed_impl::{FramedImpl, WriteFrame};

use futures_core::Stream;
use tokio::io::AsyncWrite;

use bytes::BytesMut;
use futures_sink::Sink;
use pin_project_lite::pin_project;
use std::fmt;
use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};

use super::FramedParts;

pin_project! {
    /// A [`Sink`] of frames encoded to an `AsyncWrite`.
    ///
    /// For examples of how to use `FramedWrite` with a codec, see the
    /// examples on the [`codec`] module.
    ///
    /// # Cancellation safety
    ///
    /// * [`futures_util::sink::SinkExt::send`]: if send is used as the event in a
    /// `tokio::select!` statement and some other branch completes first, then it is
    /// guaranteed that the message was not sent, but the message itself is lost.
    ///
    /// [`Sink`]: futures_sink::Sink
    /// [`codec`]: crate::codec
    /// [`futures_util::sink::SinkExt::send`]: futures_util::sink::SinkExt::send
    pub struct FramedWrite<T, E> {
        #[pin]
        inner: FramedImpl<T, E, WriteFrame>,
    }
}

impl<T, E> FramedWrite<T, E> {
    /// Creates a new `FramedWrite` with the given `encoder`.
    pub fn new(inner: T, encoder: E) -> FramedWrite<T, E> {
        FramedWrite {
            inner: FramedImpl {
                inner,
                codec: encoder,
                state: WriteFrame::default(),
            },
        }
    }

    /// Creates a new `FramedWrite` with the given `encoder` and a buffer of `capacity`
    /// initial size.
    pub fn with_capacity(inner: T, encoder: E, capacity: usize) -> FramedWrite<T, E> {
        FramedWrite {
            inner: FramedImpl {
                inner,
                codec: encoder,
                state: WriteFrame {
                    buffer: BytesMut::with_capacity(capacity),
                    backpressure_boundary: capacity,
                },
            },
        }
    }

    /// Returns a reference to the underlying I/O stream wrapped by
    /// `FramedWrite`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_ref(&self) -> &T {
        &self.inner.inner
    }

    /// Returns a mutable reference to the underlying I/O stream wrapped by
    /// `FramedWrite`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_mut(&mut self) -> &mut T {
        &mut self.inner.inner
    }

    /// Returns a pinned mutable reference to the underlying I/O stream wrapped by
    /// `FramedWrite`.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn get_pin_mut(self: Pin<&mut Self>) -> Pin<&mut T> {
        self.project().inner.project().inner
    }

    /// Consumes the `FramedWrite`, returning its underlying I/O stream.
    ///
    /// Note that care should be taken to not tamper with the underlying stream
    /// of data coming in as it may corrupt the stream of frames otherwise
    /// being worked with.
    pub fn into_inner(self) -> T {
        self.inner.inner
    }

    /// Returns a reference to the underlying encoder.
    pub fn encoder(&self) -> &E {
        &self.inner.codec
    }

    /// Returns a mutable reference to the underlying encoder.
    pub fn encoder_mut(&mut self) -> &mut E {
        &mut self.inner.codec
    }

    /// Maps the encoder `E` to `C`, preserving the write buffer
    /// wrapped by `Framed`.
    pub fn map_encoder<C, F>(self, map: F) -> FramedWrite<T, C>
    where
        F: FnOnce(E) -> C,
    {
        // This could be potentially simplified once rust-lang/rust#86555 hits stable
        let FramedImpl {
            inner,
            state,
            codec,
        } = self.inner;
        FramedWrite {
            inner: FramedImpl {
                inner,
                state,
                codec: map(codec),
            },
        }
    }

    /// Returns a mutable reference to the underlying encoder.
    pub fn encoder_pin_mut(self: Pin<&mut Self>) -> &mut E {
        self.project().inner.project().codec
    }

    /// Returns a reference to the write buffer.
    pub fn write_buffer(&self) -> &BytesMut {
        &self.inner.state.buffer
    }

    /// Returns a mutable reference to the write buffer.
    pub fn write_buffer_mut(&mut self) -> &mut BytesMut {
        &mut self.inner.state.buffer
    }

    /// Returns backpressure boundary
    pub fn backpressure_boundary(&self) -> usize {
        self.inner.state.backpressure_boundary
    }

    /// Updates backpressure boundary
    pub fn set_backpressure_boundary(&mut self, boundary: usize) {
        self.inner.state.backpressure_boundary = boundary;
    }

    /// Consumes the `FramedWrite`, returning its underlying I/O stream, the buffer
    /// with unprocessed data, and the codec.
    pub fn into_parts(self) -> FramedParts<T, E> {
        FramedParts {
            io: self.inner.inner,
            codec: self.inner.codec,
            read_buf: BytesMut::new(),
            write_buf: self.inner.state.buffer,
            _priv: (),
        }
    }
}

// This impl just defers to the underlying FramedImpl
impl<T, I, E> Sink<I> for FramedWrite<T, E>
where
    T: AsyncWrite,
    E: Encoder<I>,
    E::Error: From<io::Error>,
{
    type Error = E::Error;

    fn poll_ready(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.project().inner.poll_ready(cx)
    }

    fn start_send(self: Pin<&mut Self>, item: I) -> Result<(), Self::Error> {
        self.project().inner.start_send(item)
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.project().inner.poll_flush(cx)
    }

    fn poll_close(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.project().inner.poll_close(cx)
    }
}

// This impl just defers to the underlying T: Stream
impl<T, D> Stream for FramedWrite<T, D>
where
    T: Stream,
{
    type Item = T::Item;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.project().inner.project().inner.poll_next(cx)
    }
}

impl<T, U> fmt::Debug for FramedWrite<T, U>
where
    T: fmt::Debug,
    U: fmt::Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("FramedWrite")
            .field("inner", &self.get_ref())
            .field("encoder", &self.encoder())
            .field("buffer", &self.inner.state.buffer)
            .finish()
    }
}

```

### Core Architecture Module: `tokio-util/src/codec/length_delimited.rs`
```
//! Frame a stream of bytes based on a length prefix
//!
//! Many protocols delimit their frames by prefacing frame data with a
//! frame head that specifies the length of the frame. The
//! `length_delimited` module provides utilities for handling the length
//! based framing. This allows the consumer to work with entire frames
//! without having to worry about buffering or other framing logic.
//!
//! # Getting started
//!
//! If implementing a protocol from scratch, using length delimited framing
//! is an easy way to get started. [`LengthDelimitedCodec::new()`] will
//! return a length delimited codec using default configuration values.
//! This can then be used to construct a framer to adapt a full-duplex
//! byte stream into a stream of frames.
//!
//! ```
//! use tokio::io::{AsyncRead, AsyncWrite};
//! use tokio_util::codec::{Framed, LengthDelimitedCodec};
//!
//! fn bind_transport<T: AsyncRead + AsyncWrite>(io: T)
//!     -> Framed<T, LengthDelimitedCodec>
//! {
//!     Framed::new(io, LengthDelimitedCodec::new())
//! }
//! # pub fn main() {}
//! ```
//!
//! The returned transport implements `Sink + Stream` for `BytesMut`. It
//! encodes the frame with a big-endian `u32` header denoting the frame
//! payload length:
//!
//! ```text
//! +----------+--------------------------------+
//! | len: u32 |          frame payload         |
//! +----------+--------------------------------+
//! ```
//!
//! Specifically, given the following:
//!
//! ```
//! use tokio::io::{AsyncRead, AsyncWrite};
//! use tokio_util::codec::{Framed, LengthDelimitedCodec};
//!
//! use futures::SinkExt;
//! use bytes::Bytes;
//!
//! async fn write_frame<T>(io: T) -> Result<(), Box<dyn std::error::Error>>
//! where
//!     T: AsyncRead + AsyncWrite + Unpin,
//! {
//!     let mut transport = Framed::new(io, LengthDelimitedCodec::new());
//!     let frame = Bytes::from("hello world");
//!
//!     transport.send(frame).await?;
//!     Ok(())
//! }
//! ```
//!
//! The encoded frame will look like this:
//!
//! ```text
//! +---- len: u32 ----+---- data ----+
//! | \x00\x00\x00\x0b |  hello world |
//! +------------------+--------------+
//! ```
//!
//! # Decoding
//!
//! [`FramedRead`] adapts an [`AsyncRead`] into a `Stream` of [`BytesMut`],
//! such that each yielded [`BytesMut`] value contains the contents of an
//! entire frame. There are many configuration parameters enabling
//! [`FramedRead`] to handle a wide range of protocols. Here are some
//! examples that will cover the various options at a high level.
//!
//! ## Example 1
//!
//! The following will parse a `u16` length field at offset 0, omitting the
//! frame head in the yielded `BytesMut`.
//!
//! ```
//! # use tokio_stream::StreamExt;
//! # use tokio_util::codec::LengthDelimitedCodec;
//! # #[tokio::main(flavor = "current_thread")]
//! # async fn main() {
//! # let io: &[u8] = b"\x00\x0BHello world";
//! let mut reader = LengthDelimitedCodec::builder()
//!     .length_field_offset(0) // default value
//!     .length_field_type::<u16>()
//!     .length_adjustment(0)   // default value
//!     .new_read(io);
//! # let res = reader.next().await.unwrap().unwrap().to_vec();
//! # assert_eq!(res, b"Hello world");
//! # }
//! ```
//!
//! The following frame will be decoded as such:
//!
//! ```text
//!          INPUT                        DECODED
//! +-- len ---+--- Payload ---+     +--- Payload ---+
//! | \x00\x0B |  Hello world  | --> |  Hello world  |
//! +----------+---------------+     +---------------+
//! ```
//!
//! The value of the length field is 11 (`\x0B`) which represents the length
//! of the payload, `hello world`. By default, [`FramedRead`] assumes that
//! the length field represents the number of bytes that **follows** the
//! length field. Thus, the entire frame has a length of 13: 2 bytes for the
//! frame head + 11 bytes for the payload.
//!
//! ## Example 2
//!
//! The following will parse a `u16` length field at offset 0, including the
//! frame head in the yielded `BytesMut`.
//!
//! ```
//! # use tokio_stream::StreamExt;
//! # use tokio_util::codec::LengthDelimitedCodec;
//! # #[tokio::main(flavor = "current_thread")]
//! # async fn main() {
//! # let io: &[u8] = b"\x00\x0BHello world";
//! let mut reader = LengthDelimitedCodec::builder()
//!     .length_field_offset(0) // default value
//!     .length_field_type::<u16>()
//!     .length_adjustment(2)   // Add head size to length
//!     .num_skip(0)            // Do NOT skip the head
//!     .new_read(io);
//! # let res = reader.next().await.unwrap().unwrap().to_vec();
//! # assert_eq!(res, b"\x00\x0BHello world");
//! # }
//! ```
//!
//! The following frame will be decoded as such:
//!
//! ```text
//!          INPUT                           DECODED
//! +-- len ---+--- Payload ---+     +-- len ---+--- Payload ---+
//! | \x00\x0B |  Hello world  | --> | \x00\x0B |  Hello world  |
//! +----------+---------------+     +----------+---------------+
//! ```
//!
//! This is similar to the first example, the only difference is that the
//! frame head is **included** in the yielded `BytesMut` value. To achieve
//! this, we need to add the header size to the length with `length_adjustment`,
//! and set `num_skip` to `0` to prevent skipping the head.
//!
//! ## Example 3
//!
//! The following will parse a `u16` length field at offset 0, omitting the
//! frame head in the yielded `BytesMut`. In this case, the length field
//! **includes** the frame head length.
//!
//! ```
//! # use tokio_stream::StreamExt;
//! # use tokio_util::codec::LengthDelimitedCodec;
//! # #[tokio::main(flavor = "current_thread")]
//! # async fn main() {
//! # let io: &[u8] = b"\x00\x0DHello world";
//! let mut reader = LengthDelimitedCodec::builder()
//!     .length_field_offset(0) // default value
//!     .length_field_type::<u16>()
//!     .length_adjustment(-2)  // size of head
//!     .new_read(io);
//! # let res = reader.next().await.unwrap().unwrap().to_vec();
//! # assert_eq!(res, b"Hello world");
//! # }
//! ```
//!
//! The following frame will be decoded as such:
//!
//! ```text
//!          INPUT                           DECODED
//! +-- len ---+--- Payload ---+     +--- Payload ---+
//! | \x00\x0D |  Hello world  | --> |  Hello world  |
//! +----------+---------------+     +---------------+
//! ```
//!
//! In most cases, the length field represents the length of the payload
//! only, as shown in the previous examples. However, in some protocols the
//! length field represents the length of the whole frame, including the
//! head. In such cases, we specify a negative `length_adjustment` to adjust
//! the value provided in the frame head to represent the payload length.
//!
//! ## Example 4
//!
//! The following will parse a 3 byte length field at offset 0 in a 5 byte
//! frame head, including the frame head in the yielded `BytesMut`.
//!
//! ```
//! # use tokio_stream::StreamExt;
//! # use tokio_util::codec::LengthDelimitedCodec;
//! # #[tokio::main(flavor = "current_thread")]
//! # async fn main() {
//! # let io: &[u8] = b"\x00\x00\x0B\xCA\xFEHello world";
//! let mut reader = LengthDelimitedCodec::builder()
//!     .length_field_offset(0) // default value
//!     .length_field_length(3)
//!     .length_adjustment(3 + 2)  // len field and remaining head
//!     .num_skip(0)
//!     .new_read(io);
//! # let res = reader.next().await.unwrap().unwrap().to_vec();
//! # assert_eq!(res, b"\x00\x00\x0B\xCA\xFEHello world");
//! # }
//! ```
//!
//! The following frame will be decoded as such:
//!
//! ```text
//!                  INPUT
//! +---- len -----+- head -+--- Payload ---+
//! | \x00\x00\x0B | \xCAFE |  Hello world  |
//! +--------------+--------+---------------+
//!
//!                  DECODED
//! +---- len -----+- head -+--- Payload ---+
//! | \x00\x00\x0B | \xCAFE |  Hello world  |
//! +--------------+--------+---------------+
//! ```
//!
//! A more advanced example that shows a case where there is extra frame
//! head data between the length field and the payload. In such cases, it is
//! usually desirable to include the frame head as part of the yielded
//! `BytesMut`. This lets consumers of the length delimited framer to
//! process the frame head as needed.
//!
//! The positive `length_adjustment` value lets `FramedRead` factor in the
//! additional head into the frame length calculation.
//!
//! ## Example 5
//!
//! The following will parse a `u16` length field at offset 1 of a 4 byte
//! frame head. The first byte and the length field will be omitted from the
//! yielded `BytesMut`, but the trailing 2 bytes of the frame head will be
//! included.
//!
//! ```
//! # use tokio_stream::StreamExt;
//! # use tokio_util::codec::LengthDelimitedCodec;
//! # #[tokio::main(flavor = "current_thread")]
//! # async fn main() {
//! # let io: &[u8] = b"\xCA\x00\x0B\xFEHello world";
//! let mut reader = LengthDelimitedCodec::builder()
//!     .length_field_offset(1) // length of hdr1
//!     .length_field_type::<u16>()
//!     .length_adjustment(1)  // length of hdr2
//!     .num_skip(3) // length of hdr1 + LEN
//!     .new_read(io);
//! # let res = reader.next().await.unwrap().unwrap().to_vec();
//! # assert_eq!(res, b"\xFEHello world");
//! # }
//! ```
//!
//! The following frame will be decoded as such:
//!
//! ```text
//!                  INPUT
//! +- hdr1 -+-- len ---+- hdr2 -+--- Payload ---+
//! |  \xCA  | \x00\x0B |  \xFE  |  Hello world  |
//! +--------+----------+--------+---------------+
//!
//!          DECODED
//! +- hdr2 -+--- Payload ---+
//! |  \xFE  |  Hello world  |
//! +--------+---------------+
//! ```
//!
//! The length field is situated in the middle of the frame head. In this
//! case, the first byte in the frame head could be a version or some other
//! identifier that is not needed for processing. On the other hand, the
//! second half of the head is needed.
//!
//! `length_field_offset` indicates how many bytes to skip before starting
//! to read the length field.  `length_adjustment` is the number of bytes to
//!
```

### Core Architecture Module: `tokio-util/src/codec/lines_codec.rs`
```
use crate::codec::decoder::Decoder;
use crate::codec::encoder::Encoder;

use bytes::{Buf, BufMut, BytesMut};
use std::{cmp, fmt, io, str};

/// A simple [`Decoder`] and [`Encoder`] implementation that splits up data into lines.
///
/// This uses the `\n` character as the line ending on all platforms.
///
/// [`Decoder`]: crate::codec::Decoder
/// [`Encoder`]: crate::codec::Encoder
#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub struct LinesCodec {
    // Stored index of the next index to examine for a `\n` character.
    // This is used to optimize searching.
    // For example, if `decode` was called with `abc`, it would hold `3`,
    // because that is the next index to examine.
    // The next time `decode` is called with `abcde\n`, the method will
    // only look at `de\n` before returning.
    next_index: usize,

    /// The maximum length for a given line. If `usize::MAX`, lines will be
    /// read until a `\n` character is reached.
    max_length: usize,

    /// Are we currently discarding the remainder of a line which was over
    /// the length limit?
    is_discarding: bool,
}

impl LinesCodec {
    /// Returns a `LinesCodec` for splitting up data into lines.
    ///
    /// # Note
    ///
    /// The returned `LinesCodec` will not have an upper bound on the length
    /// of a buffered line. See the documentation for [`new_with_max_length`]
    /// for information on why this could be a potential security risk.
    ///
    /// [`new_with_max_length`]: crate::codec::LinesCodec::new_with_max_length()
    pub fn new() -> LinesCodec {
        LinesCodec {
            next_index: 0,
            max_length: usize::MAX,
            is_discarding: false,
        }
    }

    /// Returns a `LinesCodec` with a maximum line length limit.
    ///
    /// If this is set, calls to `LinesCodec::decode` will return a
    /// [`LinesCodecError`] when a line exceeds the length limit. Subsequent calls
    /// will discard up to `limit` bytes from that line until a newline
    /// character is reached, returning `None` until the line over the limit
    /// has been fully discarded. After that point, calls to `decode` will
    /// function as normal.
    ///
    /// # Note
    ///
    /// Setting a length limit is highly recommended for any `LinesCodec` which
    /// will be exposed to untrusted input. Otherwise, the size of the buffer
    /// that holds the line currently being read is unbounded. An attacker could
    /// exploit this unbounded buffer by sending an unbounded amount of input
    /// without any `\n` characters, causing unbounded memory consumption.
    ///
    /// [`LinesCodecError`]: crate::codec::LinesCodecError
    pub fn new_with_max_length(max_length: usize) -> Self {
        LinesCodec {
            max_length,
            ..LinesCodec::new()
        }
    }

    /// Returns the maximum line length when decoding.
    ///
    /// ```
    /// use tokio_util::codec::LinesCodec;
    ///
    /// let codec = LinesCodec::new();
    /// assert_eq!(codec.max_length(), usize::MAX);
    /// ```
    /// ```
    /// use tokio_util::codec::LinesCodec;
    ///
    /// let codec = LinesCodec::new_with_max_length(256);
    /// assert_eq!(codec.max_length(), 256);
    /// ```
    pub fn max_length(&self) -> usize {
        self.max_length
    }
}

fn utf8(buf: &[u8]) -> Result<&str, io::Error> {
    str::from_utf8(buf)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "Unable to decode input as UTF8"))
}

fn without_carriage_return(s: &[u8]) -> &[u8] {
    if let Some(&b'\r') = s.last() {
        &s[..s.len() - 1]
    } else {
        s
    }
}

impl Decoder for LinesCodec {
    type Item = String;
    type Error = LinesCodecError;

    fn decode(&mut self, buf: &mut BytesMut) -> Result<Option<String>, LinesCodecError> {
        loop {
            // Determine how far into the buffer we'll search for a newline. If
            // there's no max_length set, we'll read to the end of the buffer.
            let read_to = cmp::min(self.max_length.saturating_add(1), buf.len());

            let newline_offset = crate::util::memchr::memchr(b'\n', &buf[self.next_index..read_to]);

            match (self.is_discarding, newline_offset) {
                (true, Some(offset)) => {
                    // If we found a newline, discard up to that offset and
                    // then stop discarding. On the next iteration, we'll try
                    // to read a line normally.
                    buf.advance(offset + self.next_index + 1);
                    self.is_discarding = false;
                    self.next_index = 0;
                }
                (true, None) => {
                    // Otherwise, we didn't find a newline, so we'll discard
                    // everything we read. On the next iteration, we'll continue
                    // discarding up to max_len bytes unless we find a newline.
                    buf.advance(read_to);
                    self.next_index = 0;
                    if buf.is_empty() {
                        return Ok(None);
                    }
                }
                (false, Some(offset)) => {
                    // Found a line!
                    let newline_index = offset + self.next_index;
                    self.next_index = 0;
                    let line = buf.split_to(newline_index + 1);
                    let line = &line[..line.len() - 1];
                    let line = without_carriage_return(line);
                    let line = utf8(line)?;
                    return Ok(Some(line.to_string()));
                }
                (false, None) if buf.len() > self.max_length => {
                    // Reached the maximum length without finding a
                    // newline, return an error and start discarding on the
                    // next call.
                    self.is_discarding = true;
                    return Err(LinesCodecError::MaxLineLengthExceeded);
                }
                (false, None) => {
                    // We didn't find a line or reach the length limit, so the next
                    // call will resume searching at the current offset.
                    self.next_index = read_to;
                    return Ok(None);
                }
            }
        }
    }

    fn decode_eof(&mut self, buf: &mut BytesMut) -> Result<Option<String>, LinesCodecError> {
        Ok(match self.decode(buf)? {
            Some(frame) => Some(frame),
            None => {
                self.next_index = 0;
                // No terminating newline - return remaining data, if any
                if buf.is_empty() || buf == &b"\r"[..] {
                    None
                } else {
                    let line = buf.split_to(buf.len());
                    let line = without_carriage_return(&line);
                    let line = utf8(line)?;
                    Some(line.to_string())
                }
            }
        })
    }
}

impl<T> Encoder<T> for LinesCodec
where
    T: AsRef<str>,
{
    type Error = LinesCodecError;

    fn encode(&mut self, line: T, buf: &mut BytesMut) -> Result<(), LinesCodecError> {
        let line = line.as_ref();
        buf.reserve(line.len() + 1);
        buf.put(line.as_bytes());
        buf.put_u8(b'\n');
        Ok(())
    }
}

impl Default for LinesCodec {
    fn default() -> Self {
        Self::new()
    }
}

/// An error occurred while encoding or decoding a line.
#[derive(Debug)]
pub enum LinesCodecError {
    /// The maximum line length was exceeded.
    MaxLineLengthExceeded,
    /// An IO error occurred.
    Io(io::Error),
}

impl fmt::Display for LinesCodecError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LinesCodecError::MaxLineLengthExceeded => write!(f, "max line length exceeded"),
            LinesCodecError::Io(e) => write!(f, "{e}"),
        }
    }
}

impl From<io::Error> for LinesCodecError {
    fn from(e: io::Error) -> LinesCodecError {
        LinesCodecError::Io(e)
    }
}

impl std::error::Error for LinesCodecError {}

```

### Core Architecture Module: `tokio-util/src/codec/mod.rs`
```
//! Adaptors from `AsyncRead`/`AsyncWrite` to Stream/Sink
//!
//! Raw I/O objects work with byte sequences, but higher-level code usually
//! wants to batch these into meaningful chunks, called "frames".
//!
//! This module contains adapters to go from streams of bytes, [`AsyncRead`] and
//! [`AsyncWrite`], to framed streams implementing [`Sink`] and [`Stream`].
//! Framed streams are also known as transports.
//!
//! # Example encoding using `LinesCodec`
//!
//! The following example demonstrates how to use a codec such as [`LinesCodec`] to
//! write framed data. [`FramedWrite`] can be used to achieve this. Data sent to
//! [`FramedWrite`] are first framed according to a specific codec, and then sent to
//! an implementer of [`AsyncWrite`].
//!
//! ```
//! use futures::sink::SinkExt;
//! use tokio_util::codec::LinesCodec;
//! use tokio_util::codec::FramedWrite;
//!
//! # #[tokio::main(flavor = "current_thread")]
//! # async fn main() {
//! let buffer = Vec::new();
//! let messages = vec!["Hello", "World"];
//! let encoder = LinesCodec::new();
//!
//! // FramedWrite is a sink which means you can send values into it
//! // asynchronously.
//! let mut writer = FramedWrite::new(buffer, encoder);
//!
//! // To be able to send values into a FramedWrite, you need to bring the
//! // `SinkExt` trait into scope.
//! writer.send(messages[0]).await.unwrap();
//! writer.send(messages[1]).await.unwrap();
//!
//! let buffer = writer.get_ref();
//!
//! assert_eq!(buffer.as_slice(), "Hello\nWorld\n".as_bytes());
//! # }
//!```
//!
//! # Example decoding using `LinesCodec`
//! The following example demonstrates how to use a codec such as [`LinesCodec`] to
//! read a stream of framed data. [`FramedRead`] can be used to achieve this. [`FramedRead`]
//! will keep reading from an [`AsyncRead`] implementer until a whole frame, according to a codec,
//! can be parsed.
//!
//!```
//! use tokio_stream::StreamExt;
//! use tokio_util::codec::LinesCodec;
//! use tokio_util::codec::FramedRead;
//!
//! # #[tokio::main(flavor = "current_thread")]
//! # async fn main() {
//! let message = "Hello\nWorld".as_bytes();
//! let decoder = LinesCodec::new();
//!
//! // FramedRead can be used to read a stream of values that are framed according to
//! // a codec. FramedRead will read from its input (here `buffer`) until a whole frame
//! // can be parsed.
//! let mut reader = FramedRead::new(message, decoder);
//!
//! // To read values from a FramedRead, you need to bring the
//! // `StreamExt` trait into scope.
//! let frame1 = reader.next().await.unwrap().unwrap();
//! let frame2 = reader.next().await.unwrap().unwrap();
//!
//! assert!(reader.next().await.is_none());
//! assert_eq!(frame1, "Hello");
//! assert_eq!(frame2, "World");
//! # }
//! ```
//!
//! # The Decoder trait
//!
//! A [`Decoder`] is used together with [`FramedRead`] or [`Framed`] to turn an
//! [`AsyncRead`] into a [`Stream`]. The job of the decoder trait is to specify
//! how sequences of bytes are turned into a sequence of frames, and to
//! determine where the boundaries between frames are.  The job of the
//! `FramedRead` is to repeatedly switch between reading more data from the IO
//! resource, and asking the decoder whether we have received enough data to
//! decode another frame of data.
//!
//! The main method on the `Decoder` trait is the [`decode`] method. This method
//! takes as argument the data that has been read so far, and when it is called,
//! it will be in one of the following situations:
//!
//!  1. The buffer contains less than a full frame.
//!  2. The buffer contains exactly a full frame.
//!  3. The buffer contains more than a full frame.
//!
//! In the first situation, the decoder should return `Ok(None)`.
//!
//! In the second situation, the decoder should clear the provided buffer and
//! return `Ok(Some(the_decoded_frame))`.
//!
//! In the third situation, the decoder should use a method such as [`split_to`]
//! or [`advance`] to modify the buffer such that the frame is removed from the
//! buffer, but any data in the buffer after that frame should still remain in
//! the buffer. The decoder should also return `Ok(Some(the_decoded_frame))` in
//! this case.
//!
//! Finally the decoder may return an error if the data is invalid in some way.
//! The decoder should _not_ return an error just because it has yet to receive
//! a full frame.
//!
//! It is guaranteed that, from one call to `decode` to another, the provided
//! buffer will contain the exact same data as before, except that if more data
//! has arrived through the IO resource, that data will have been appended to
//! the buffer.  This means that reading frames from a `FramedRead` is
//! essentially equivalent to the following loop:
//!
//! ```no_run
//! use tokio::io::AsyncReadExt;
//! # // This uses async_stream to create an example that compiles.
//! # fn foo() -> impl futures_core::Stream<Item = std::io::Result<bytes::BytesMut>> { async_stream::try_stream! {
//! # use tokio_util::codec::Decoder;
//! # let mut decoder = tokio_util::codec::BytesCodec::new();
//! # let io_resource = &mut &[0u8, 1, 2, 3][..];
//!
//! let mut buf = bytes::BytesMut::new();
//! loop {
//!     // The read_buf call will append to buf rather than overwrite existing data.
//!     let len = io_resource.read_buf(&mut buf).await?;
//!
//!     if len == 0 {
//!         while let Some(frame) = decoder.decode_eof(&mut buf)? {
//!             yield frame;
//!         }
//!         break;
//!     }
//!
//!     while let Some(frame) = decoder.decode(&mut buf)? {
//!         yield frame;
//!     }
//! }
//! # }}
//! ```
//! The example above uses `yield` whenever the `Stream` produces an item.
//!
//! ## Example decoder
//!
//! As an example, consider a protocol that can be used to send strings where
//! each frame is a four byte integer that contains the length of the frame,
//! followed by that many bytes of string data. The decoder fails with an error
//! if the string data is not valid utf-8 or too long.
//!
//! Such a decoder can be written like this:
//! ```
//! use tokio_util::codec::Decoder;
//! use bytes::{BytesMut, Buf};
//!
//! struct MyStringDecoder {}
//!
//! const MAX: usize = 8 * 1024 * 1024;
//!
//! impl Decoder for MyStringDecoder {
//!     type Item = String;
//!     type Error = std::io::Error;
//!
//!     fn decode(
//!         &mut self,
//!         src: &mut BytesMut
//!     ) -> Result<Option<Self::Item>, Self::Error> {
//!         if src.len() < 4 {
//!             // Not enough data to read length marker.
//!             return Ok(None);
//!         }
//!
//!         // Read length marker.
//!         let mut length_bytes = [0u8; 4];
//!         length_bytes.copy_from_slice(&src[..4]);
//!         let length = u32::from_le_bytes(length_bytes) as usize;
//!
//!         // Check that the length is not too large to avoid a denial of
//!         // service attack where the server runs out of memory.
//!         if length > MAX {
//!             return Err(std::io::Error::new(
//!                 std::io::ErrorKind::InvalidData,
//!                 format!("Frame of length {} is too large.", length)
//!             ));
//!         }
//!
//!         if src.len() < 4 + length {
//!             // The full string has not yet arrived.
//!             //
//!             // We reserve more space in the buffer. This is not strictly
//!             // necessary, but is a good idea performance-wise.
//!             src.reserve(4 + length - src.len());
//!
//!             // We inform the Framed that we need more bytes to form the next
//!             // frame.
//!             return Ok(None);
//!         }
//!
//!         // Use advance to modify src such that it no longer contains
//!         // this frame.
//!         let data = src[4..4 + length].to_vec();
//!         src.advance(4 + length);
//!
//!         // Convert the data to a string, or fail if it is not valid utf-8.
//!         match String::from_utf8(data) {
//!             Ok(string) => Ok(Some(string)),
//!             Err(utf8_error) => {
//!                 Err(std::io::Error::new(
//!                     std::io::ErrorKind::InvalidData,
//!                     utf8_error.utf8_error(),
//!                 ))
//!             },
//!         }
//!     }
//! }
//! ```
//!
//! # The Encoder trait
//!
//! An [`Encoder`] is used together with [`FramedWrite`] or [`Framed`] to turn
//! an [`AsyncWrite`] into a [`Sink`]. The job of the encoder trait is to
//! specify how frames are turned into a sequences of bytes.  The job of the
//! `FramedWrite` is to take the resulting sequence of bytes and write it to the
//! IO resource.
//!
//! The main method on the `Encoder` trait is the [`encode`] method. This method
//! takes an item that is being written, and a buffer to write the item to. The
//! buffer may already contain data, and in this case, the encoder should append
//! the new frame to the buffer rather than overwrite the existing data.
//!
//! It is guaranteed that, from one call to `encode` to another, the provided
//! buffer will contain the exact same data as before, except that some of the
//! data may have been removed from the front of the buffer. Writing to a
//! `FramedWrite` is essentially equivalent to the following loop:
//!
//! ```no_run
//! use tokio::io::AsyncWriteExt;
//! use bytes::Buf; // for advance
//! # use tokio_util::codec::Encoder;
//! # async fn next_frame() -> bytes::Bytes { bytes::Bytes::new() }
//! # async fn no_more_frames() { }
//! # #[tokio::main] async fn main() -> std::io::Result<()> {
//! # let mut io_resource = tokio::io::sink();
//! # let mut encoder = tokio_util::codec::BytesCodec::new();
//!
//! const MAX: usize = 8192;
//!
//! let mut buf = bytes::BytesMut::new();
//! loop {
//!     tokio::select! {
//!         num_written = io_resource.write(&buf), if !buf.is_empty() => {
//!             buf.advance(num_written?);
//!         },
//!         frame = next_frame(), if buf.len() < MAX => {
//!             encoder.encode(f
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8594** (2026-10-07): **ci: pin libc to 0.2.189 on FreeBSD**
  *Symptoms*: The `libc` 0.2.190 release removed `NOTE_PCTRLMASK` on FreeBSD, which breaks `mio` and `nix` (and therefore Tokio) builds on FreeBSD: https://github.com/rust-lang/libc/issues/5598  Thus, pin `libc` to `0.2.189` in the FreeBSD CI jobs until a fix is released upstream.
  **Post-Mortem & Fix Analysis**:
  > FYI Mio v1.2.4 fixes the issue, so I think only https://github.com/nix-rust/nix/issues/2834 needs to be fixed.
  > Yeah this is motivated mainly by nix.

- **Issue #8590** (2026-10-04): **chore: clean up stale Err(Invalid) doc and typo**
  *Symptoms*: ## Motivation  In `tokio::runtime::time::Wheel::insert`, the doc comment describes an `Err(Invalid)` return value, but `InsertError::Invalid` was removed and no longer exists. Additionally, the corresponding doc comment in `tokio-util` contains a typo (`as been supplied`).  ## Solution  - Remove the stale `Err(Invalid)` doc comment in `tokio::runtime::time::Wheel::insert` - Fix the typo from `as been supplied` to `has been supplied` in `tokio_util::time::Wheel::insert`

- **Issue #8586** (2026-10-04): **docs: fix builds with `--generate-link-to-definition`**
  *Symptoms*: ## Motivation  `cfg_windows!` and `cfg_net_windows!` enable Windows-only items when the `docsrs` cfg is set, so that docs.rs can render them from a Unix host. Until now that only worked because `rustdoc` does not type check function bodies by default, and the `crate::doc::os` shim therefore only had to make the *signatures* resolve.  Passing `-Zunstable-options --generate-link-to-definition` makes rustdoc resolve items inside function bodies too, which type checks them. The Windows-only bodies then fail, because they call into APIs that do not exist on the documentation host:  ``` RUSTDOCFLAGS="--cfg docsrs -Zunstable-options --generate-link-to-definition" \     cargo doc -p tokio --no-deps --all-features ```  reports 85 errors, for example:  ``` error[E0599]: no variant, associated function, or constant named `borrow_raw`               found for enum `doc::NotDefinedHere` in the current scope error[E0599]: no method named `as_raw_handle` found for struct `std::io::Stdin` error[E0433]: failed to resolve: could not resolve path `windows_sys::PIPE_TYPE_MESSAGE` ```  This affects downstream users of Tokio whenever `--no-deps` is not passed.  ## Solution  Complete the documentation shim so the Windows-only bodies resolve on a Unix documentation build.  - `doc::NotDefinedHere` gains the inherent associated functions and trait impls that the `std::os::windows` types it stands in for expose, including `Read`/`Write` for both `NotDefinedHere` and `&NotDefinedHere`. - `doc::os::window

- **Issue #8580** (2026-10-03): **chore: prepare Tokio v1.53.2**
  *Symptoms*: # 1.53.2 (October 3rd, 2026)  ### Fixed  - fs: handle integer overflow in buffered relative seek ([#8574]) - io: revert "always cleanup `AsyncFd` registration list on deregister" ([#8540]) - process: unregister Windows wait before closing child handle ([#8564]) - rt: drop blocking pool mutex before shutting down rejected task ([#8562]) - sync: fix mpsc index wraparound in block reclamation ([#8546]) - sync: forget mpsc `Permit` before sending value ([#8560]) - sync: validate `MAX_PERMITS` in `Semaphore::acquire` ([#8548]) - sync: wake broadcast `Sender::closed` outside mutex ([#8558]) - task: drop replaced waker outside lock in `JoinSet` ([#8554]) - time: drop timer lock before dropping waker in `clear_entry` ([#8552]) - time: expire timers directly on shutdown without rotating wheel ([#8570])  ### Fixed (unstable)  - fs: clamp `io_uring` read length to `u32::MAX` ([#8572]) - rt: ignore `current_thread` task dumps from other runtimes ([#8544]) - rt: preserve `io_uring` context if a completion waker panics ([#8566]) - sync: fix semaphore use-after-free and permit leak on tracing panic ([#8542]) - taskdump: restore deferred leaf wakes during capture ([#8445]) - time: drop stored waker when cancelling alt timer entry ([#8550])  [#8445]: https://github.com/tokio-rs/tokio/pull/8445 [#8572]: https://github.com/tokio-rs/tokio/pull/8572 [#8540]: https://github.com/tokio-rs/tokio/pull/8540 [#8542]: https://github.com/tokio-rs/tokio/pull/8542 [#8544]: https
  **Post-Mortem & Fix Analysis**:
  > Cannot be merged until #8577 lands.

- **Issue #8579** (2026-10-03): **chore: prepare Tokio v1.51.5**
  *Symptoms*: # 1.51.5 (October 3rd, 2026)  ### Fixed  - fs: handle integer overflow in buffered relative seek ([#8574]) - io: revert "always cleanup `AsyncFd` registration list on deregister" ([#8540]) - process: unregister Windows wait before closing child handle ([#8564]) - rt: drop blocking pool mutex before shutting down rejected task ([#8562]) - sync: fix mpsc index wraparound in block reclamation ([#8546]) - sync: forget mpsc `Permit` before sending value ([#8560]) - sync: validate `MAX_PERMITS` in `Semaphore::acquire` ([#8548]) - sync: wake broadcast `Sender::closed` outside mutex ([#8558]) - task: drop replaced waker outside lock in `JoinSet` ([#8554]) - time: drop timer lock before dropping waker in `clear_entry` ([#8552]) - time: expire timers directly on shutdown without rotating wheel ([#8570])  ### Fixed (unstable)  - rt: ignore `current_thread` task dumps from other runtimes ([#8544]) - rt: preserve `io_uring` context if a completion waker panics ([#8566]) - sync: fix semaphore use-after-free and permit leak on tracing panic ([#8542]) - time: drop stored waker when cancelling alt timer entry ([#8550])  [#8540]: https://github.com/tokio-rs/tokio/pull/8540 [#8542]: https://github.com/tokio-rs/tokio/pull/8542 [#8544]: https://github.com/tokio-rs/tokio/pull/8544 [#8546]: https://github.com/tokio-rs/tokio/pull/8546 [#8548]: https://github.com/tokio-rs/tokio/pull/8548 [#8550]: https://github.com/tokio-rs/tokio/pull/8550 [#8552]: https://github.com/toki

- **Issue #8578** (2026-10-03): **Merge 'tokio-1.53.2' into 'master'**
  *Symptoms*: 

- **Issue #8577** (2026-10-03): **Merge 'tokio-1.51.5' into 'tokio-1.53.x'**
  *Symptoms*: 

- **Issue #8575** (2026-10-03): **fs: prevent overflow on buffered relative seek (#8573)**
  *Symptoms*: ## Motivation  When `File::seek(SeekFrom::Current(offset))` is called on a file that retains buffered unread bytes from a cancelled read, `File::start_seek` factors in the unread data via signed addition: ```rust let n = buf.discard_read(); if let SeekFrom::Current(ref mut offset) = pos {     *offset += n; } ``` Here, `n` is negative (representing the unread bytes to seek backwards past). If an extreme negative offset such as `i64::MIN` is provided, `*offset += n` panics in debug builds with: ``` thread 'main' panicked at tokio/src/fs/file.rs: attempt to add with overflow ``` Seeking past byte zero is documented as an I/O error (`ErrorKind::InvalidInput`), but the arithmetic overflow panicked before the underlying file operation could return the error.  ## Solution  Use `checked_add(n)` on `offset`. If an overflow occurs, mark the seek as invalid and return `io::Error::new(io::ErrorKind::InvalidInput, "cannot seek to a negative or overflowing position")` through the standard completion channel, safely preserving buffer lifecycle and avoiding panic in both debug and release builds.  Also added a unit test `buffered_seek_overflow` in `tests/fs_file.rs` verifying that seeking with `SeekFrom::Current(i64::MIN)` when unread buffer bytes exist returns an error without panicking.  Closes #8573 
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #8574

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

### Incident Patch 1: `832dd233` (2026-10-02)
**Commit Message**: sync: avoid leaking semaphore permits on tracing panic (#8542)

Currently, when `poll_acquire` takes all of the requested permits from
the semaphore without queueing the waiter, it emits tracing events
before returning. At this point, neither the waiter's state nor the
`queued` flag record that the permits were taken, so if the tracing
subscriber panics during one of these events, the `Acquire` future is
dropped without returning the permits to the semaphore.

Fix this by recording the permits in the waiter's state and setting
`queued` before emitting the tracing events. `Acquire::poll` then only
clears `queued` once the future completes, after the last tracing
event has been emitted.

With this, `queued` consistently means that `Acquire::drop` must clean
up after the waiter, and `num_permits - state` is always the number of
permits the waiter holds, regardless of whether they were taken
directly from the semaphore or assigned in the wait queue.

**File**: `tokio/src/sync/batch_semaphore.rs` (modified, +36/-13)
```diff
@@ -72,6 +72,13 @@ pub(crate) struct Acquire<'a> {
     node: Waiter,
     semaphore: &'a Semaphore,
     num_permits: usize,
+    /// Whether `Acquire::drop` must clean up after the waiter, by removing it
+    /// from the wait queue if it is still linked and returning the permits
+    /// assigned to it to the semaphore.
+    ///
+    /// This is set as soon as `poll_acquire` assigns permits to the waiter or
+    /// links it into the wait queue, and it is only cleared once the future
+    /// completes and the permits are handed to the caller.
     queued: bool,
 }
 
@@ -406,11 +413,11 @@ impl Semaphore {
         cx: &mut Context<'_>,
         num_permits: usize,
         node: Pin<&mut Waiter>,
-        queued: bool,
+        queued: &mut bool,
     ) -> Poll<Result<(), AcquireError>> {
         let mut acquired = 0;
 
-        let needed = if queued {
+        let needed = if *queued {
             node.state.load(Acquire) << Self::PERMIT_SHIFT
         } else {
             num_permits << Self::PERMIT_SHIFT
@@ -453,7 +460,15 @@ impl Semaphore {
                 Ok(_) => {
                     acquired += acq;
                     if remaining == 0 {
-                        if !queued {
+                        if !*queued {
+                            // The waiter now holds all of its permits. Record
+                            // this in its state and set `queued`, so that
+                            // `Acquire::drop` returns the permits if the
+                            // future is dropped before it completes, e.g.
+                            // because the tracing subscriber panics below.
+                            node.state.store(0, Release);
+                            *queued = true;
+
                             #[cfg(all(tokio_unstable, feature = "tracing"))]
                             self.resource_span.in_scope(|| {
                                 tracing::trace!(
@@ -483,6 +498,11 @@ impl Semaphore {
             return Poll::Ready(Err(AcquireError::closed()));
         }
 
+        // The waiter is about to be assigned permits or linked into the wait
+        // queue, so `Acquire::drop` must clean up after it from now on.
+        let was_queued = *queued;
+        *queued = true;
+
         #[cfg(all(tokio_unstable, feature = "tracing"))]
         self.resource_span.in_scope(|| {
             tracing::trace!(
@@ -518,7 +538,7 @@ impl Semaphore {
         });
 
         // If the waiter is not already in the wait queue, enqueue it.
-        if !queued {
+        if !was_queued {
             let node = unsafe {
                 let node = Pin::into_inner_unchecked(node) as *mut _;
                 NonNull::new_unchecked(node)
@@ -614,24 +634,27 @@ impl Future for Acquire<'_> {
         #[cfg(not(all(tokio_unstable, feature = "tracing")))]
         let coop = ready!(crate::task::coop::poll_proceed(cx));
 
-        let result = match semaphore.poll_acquire(cx, needed, node, *queued) {
-            Poll::Pending => {
-                *queued = true;
-                Poll::Pending
-            }
+        let result = match semaphore.poll_acquire(cx, needed, node, queued) {
+            Poll::Pending => Poll::Pending,
             Poll::Ready(r) => {
                 coop.made_progress();
                 r?;
-                *queued = false;
                 Poll::Ready(Ok(()))
             }
         };
 
         #[cfg(all(tokio_unstable, feature = "tracing"))]
-        return trace_poll_op!("poll_acquire", result);
+        let result = trace_poll_op!("poll_acquire", result);
+
+        // The permits are handed to the caller once the future completes, so
+        // `Acquire::drop` must no longer return them. Clear `queued` only after
+        // the last tracing event, so that the permits are still returned if
+        // the subscriber panics.
+        if result.is_ready() {
+            *queued = false;
+        }
 
-        #[cfg(not(all(tokio_unstable, feature = "tracing")))]
-        return result;
+        result
     }
 }
 
```

**File**: `tokio/tests/tracing_sync.rs` (modified, +23/-0)
```diff
@@ -285,6 +285,7 @@ async fn test_semaphore_creates_span() {
 /// is in the middle of an operation.
 #[cfg(panic = "unwind")]
 mod subscriber_panic {
+    use std::future::Future;
     use std::panic::{catch_unwind, AssertUnwindSafe};
     use std::sync::atomic::{AtomicBool, Ordering};
     use tokio::sync;
@@ -356,4 +357,26 @@ mod subscriber_panic {
         drop(permit);
         assert_eq!(sem.available_permits(), 2);
     }
+
+    #[test]
+    fn semaphore_acquire() {
+        // Polls `acquire` with a subscriber that panics on the event emitted
+        // once the permits have been taken from the semaphore. The `Acquire`
+        // future is dropped while unwinding, which must return the permits.
+        fn poll_with_panicking_subscriber<F: Future>(mut acquire: task::Spawn<F>) {
+            let subscriber = PanicOnEvent::new("runtime::resource::state_update");
+            let res = catch_unwind(AssertUnwindSafe(|| {
+                tracing::subscriber::with_default(subscriber, || {
+                    let _ = acquire.poll();
+                });
+            }));
+            assert!(res.is_err());
+        }
+
+        let sem = sync::Semaphore::new(1);
+
+        // Uncontended acquisition that takes the permit without queueing.
+        poll_with_panicking_subscriber(task::spawn(sem.acquire()));
+        assert_eq!(sem.available_permits(), 1);
+    }
 }
```

---

### Incident Patch 2: `2fc5972b` (2026-10-02)
**Commit Message**: fs: handle integer overflow in buffered relative seek (#8574)

When `File::start_seek` is called with `SeekFrom::Current(offset)` while
unread data remains in the internal buffer, it subtracts the unread
byte count (`n < 0`) from `offset` using `*offset += n`. For extreme
negative offsets such as `i64::MIN`, this addition overflows `i64`.

To fix this, use `checked_add` and seek twice on overflow.

Fixes: #8573

**File**: `tokio/src/fs/file.rs` (modified, +18/-4)
```diff
@@ -675,18 +675,32 @@ impl AsyncSeek for File {
                 let mut buf = buf_cell.take().unwrap();
 
                 // Factor in any unread data from the buf
-                if !buf.is_empty() {
+                let extra_seek = if !buf.is_empty() {
                     let n = buf.discard_read();
 
                     if let SeekFrom::Current(ref mut offset) = pos {
-                        *offset += n;
+                        match offset.checked_add(n) {
+                            Some(new_offset) => {
+                                *offset = new_offset;
+                                None
+                            }
+                            None => Some(SeekFrom::Current(n)),
+                        }
+                    } else {
+                        None
                     }
-                }
+                } else {
+                    None
+                };
 
                 let std = me.std.clone();
 
                 inner.state = State::Busy(spawn_blocking(move || {
-                    let res = (&*std).seek(pos);
+                    let res = if let Some(extra_seek) = extra_seek {
+                        (&*std).seek(extra_seek).and_then(|_| (&*std).seek(pos))
+                    } else {
+                        (&*std).seek(pos)
+                    };
                     (Operation::Seek(res), buf)
                 }));
                 Ok(())
```

**File**: `tokio/src/fs/file/tests.rs` (modified, +36/-0)
```diff
@@ -976,3 +976,39 @@ fn busy_file_seek_error() {
     let mut t = task::spawn(file.seek(SeekFrom::Start(0)));
     assert_ready_err!(t.poll());
 }
+
+#[test]
+fn incomplete_read_followed_by_overflowing_relative_seek() {
+    let mut file = MockFile::default();
+    let mut seq = Sequence::new();
+    file.expect_inner_read()
+        .once()
+        .in_sequence(&mut seq)
+        .returning(|buf| {
+            buf[0..HELLO.len()].copy_from_slice(HELLO);
+            Ok(HELLO.len())
+        });
+    file.expect_inner_seek()
+        .once()
+        .in_sequence(&mut seq)
+        .with(eq(SeekFrom::Current(-(HELLO.len() as i64))))
+        .returning(|_| Ok(0));
+    file.expect_inner_seek()
+        .once()
+        .in_sequence(&mut seq)
+        .with(eq(SeekFrom::Current(i64::MIN)))
+        .returning(|_| Err(io::ErrorKind::InvalidInput.into()));
+
+    let mut file = File::from_std(file);
+    let mut buf = [0; 32];
+
+    let mut t = task::spawn(file.read(&mut buf));
+    assert_pending!(t.poll());
+
+    pool::run_one();
+
+    let mut t = task::spawn(file.seek(SeekFrom::Current(i64::MIN)));
+    assert_pending!(t.poll());
+    pool::run_one();
+    assert_ready_err!(t.poll());
+}
```

---

### Incident Patch 3: `85a6d138` (2026-10-02)
**Commit Message**: io: revert "always cleanup AsyncFd registration list on deregister" (#8540)

This reverts commit 1280cf81de55aef040b65b202dddb09713fd4f2b (#7773).

PR #7773 changed `Handle::deregister_source` to unconditionally remove
and release the `ScheduledIo` registration even when `mio` fails to
deregister the source from the OS poller.

On Linux, `epoll` registrations are associated with the kernel open file
description (`(struct file *, int fd)`). If a caller registers a raw
file descriptor in `AsyncFd`, duplicates the descriptor (`dup`), and
closes the original fd number before dropping `AsyncFd`,
`epoll_ctl(EPOLL_CTL_DEL)` fails with `EBADF` because the original fd
number is closed. However, because the duplicate fd keeps the underlying
open file description alive, `epoll` retains the registration and its
raw `*const ScheduledIo` token pointer. Releasing `ScheduledIo` when OS
deregistration fails therefore leads to a heap use-after-free on the
next readiness event for that open file description.

Restore the early return on `self.registry.deregister(source)?` so that
`ScheduledIo` is leaked rather than freed if OS deregistration fails.

Fixes: #8537
Refs: #8539

**File**: `tokio/src/runtime/io/driver.rs` (modified, +10/-4)
```diff
@@ -295,9 +295,15 @@ impl Handle {
         registration: &Arc<ScheduledIo>,
         source: &mut impl Source,
     ) -> io::Result<()> {
-        // Deregister the source with the OS poller **first**
-        // Cleanup ALWAYS happens
-        let os_result = self.registry.deregister(source);
+        // Deregister the source with the OS poller **first**.
+        //
+        // If `deregister` fails (for example, because the caller closed the raw
+        // file descriptor before dropping `AsyncFd`), we must NOT release the
+        // `ScheduledIo` registration. On Linux, if the file descriptor was
+        // duplicated before the original fd number was closed, the open file
+        // description remains registered in epoll with the `ScheduledIo` token
+        // pointer even though `EPOLL_CTL_DEL` fails with `EBADF`.
+        self.registry.deregister(source)?;
 
         if self
             .registrations
@@ -308,7 +314,7 @@ impl Handle {
 
         self.metrics.dec_fd_count();
 
-        os_result // Return error after cleanup
+        Ok(())
     }
 
     fn release_pending_registrations(&self) {
```

**File**: `tokio/tests/io_async_fd.rs` (modified, +22/-0)
```diff
@@ -956,3 +956,25 @@ async fn try_with_interest() {
 
     assert!(Arc::ptr_eq(&original, &returned));
 }
+
+#[tokio::test]
+async fn drop_after_closing_raw_fd_with_live_duplicate() {
+    let (original, mut peer) = socketpair();
+    let duplicate = original.fd.try_clone().unwrap();
+
+    let registered = AsyncFd::with_interest(original.as_raw_fd(), Interest::READABLE).unwrap();
+
+    // Closing the original fd while `duplicate` stays open keeps the open file
+    // description registered in epoll on Linux, while causing `EPOLL_CTL_DEL`
+    // to fail with `EBADF` when `registered` is dropped.
+    drop(original);
+    drop(registered);
+
+    // Let the I/O driver run a turn so any pending registration releases happen.
+    tokio::task::yield_now().await;
+
+    peer.write_all(b"x").unwrap();
+    tokio::task::yield_now().await;
+
+    drop(duplicate);
+}
```

**File**: `tokio/tests/io_async_fd_memory_leak.rs` (removed, +0/-209)
```diff
@@ -1,209 +0,0 @@
-//! Regression test for issue #7563 - Memory leak when fd closed before AsyncFd drop
-//!
-//! This test uses a custom global allocator to track actual memory usage,
-//! avoiding false positives from RSS measurements which include freed-but-retained memory.
-
-#![cfg(all(unix, target_os = "linux", feature = "full"))]
-
-use std::alloc::{GlobalAlloc, Layout, System};
-use std::sync::atomic::{AtomicUsize, Ordering};
-
-/// A tracking allocator that counts bytes currently allocated
-struct TrackingAllocator {
-    allocated: AtomicUsize,
-}
-
-impl TrackingAllocator {
-    const fn new() -> Self {
-        Self {
-            allocated: AtomicUsize::new(0),
-        }
-    }
-}
-
-unsafe impl GlobalAlloc for TrackingAllocator {
-    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
-        let ptr = unsafe { System.alloc(layout) };
-        if !ptr.is_null() {
-            self.allocated.fetch_add(layout.size(), Ordering::Relaxed);
-        }
-        ptr
-    }
-
-    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
-        unsafe { System.dealloc(ptr, layout) };
-        self.allocated.fetch_sub(layout.size(), Ordering::Relaxed);
-    }
-
-    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
-        let new_ptr = unsafe { System.realloc(ptr, layout, new_size) };
-        if !new_ptr.is_null() {
-            // Subtract old size, add new size
-            if new_size > layout.size() {
-                self.allocated
-                    .fetch_add(new_size - layout.size(), Ordering::Relaxed);
-            } else {
-                self.allocated
-                    .fetch_sub(layout.size() - new_size, Ordering::Relaxed);
-            }
-        }
-        new_ptr
-    }
-}
-
-#[global_allocator]
-static GLOBAL: TrackingAllocator = TrackingAllocator::new();
-
-fn allocated_bytes() -> usize {
-    GLOBAL.allocated.load(Ordering::Relaxed)
-}
-
-#[tokio::test]
-async fn memory_leak_when_fd_closed_before_drop() {
-    use nix::sys::socket::{self, AddressFamily, SockFlag, SockType};
-    use std::os::unix::io::{AsRawFd, RawFd};
-    use std::sync::Arc;
-    use tokio::io::unix::AsyncFd;
-
-    struct RawFdWrapper {
-        fd: RawFd,
-    }
-
-    impl AsRawFd for RawFdWrapper {
-        fn as_raw_fd(&self) -> RawFd {
-            self.fd
-        }
-    }
-
-    struct ArcFd(Arc<RawFdWrapper>);
-
-    impl AsRawFd for ArcFd {
-        fn as_raw_fd(&self) -> RawFd {
-            self.0.as_raw_fd()
-        }
-    }
-
-    fn set_nonblocking(fd: RawFd) {
-        use nix::fcntl::{OFlag, F_GETFL, F_SETFL};
-
-        let flags = nix::fcntl::fcntl(fd, F_GETFL).expect("fcntl(F_GETFL)");
-
-        if flags < 0 {
-            panic!(
-                "bad return value from fcntl(F_GETFL): {} ({:?})",
-                flags,
-                nix::Error::last()
-            );
-        }
-
-        let flags = OFlag::from_bits_truncate(flags) | OFlag::O_NONBLOCK;
-
-        nix::fcntl::fcntl(fd, F_SETFL(flags)).expect("fcntl(F_SETFL)");
-    }
-
-    // Warm up - let runtime and allocator stabilize
-    for _ in 0..100 {
-        tokio::task::yield_now().await;
-    }
-
-    const ITERATIONS: usize = 1000;
-
-    // Phase 1: Warm up allocations
-    for _ in 0..ITERATIONS {
-        let (fd_a, _fd_b) = socket::socketpair(
-            AddressFamily::Unix,
-            SockType::Stream,
-            None,
-            SockFlag::empty(),
-        )
-        .unwrap();
-
-        let raw_fd = fd_a.as_raw_fd();
-        set_nonblocking(raw_fd);
-        std::mem::forget(fd_a);
-
-        let wrapper = Arc::new(RawFdWrapper { fd: raw_fd });
-        let async_fd = AsyncFd::new(ArcFd(wrapper)).unwrap();
-
-        // Close fd before dropping AsyncFd - this triggers the bug
-        unsafe {
-            libc::close(raw_fd);
-        }
-
-        drop(async_fd);
-    }
-
-    // Let things settle
-    tokio::task::yield_now().await;
-    let baseline = allocated_bytes();
-
-    // Phase 2: Run more iterations and check for growth
-    for _ in 0..ITERATIONS {
-        let (fd_a, _fd_b) = socket::socketpair(
-            AddressFamily::Unix,
-            SockType::Stream,
-            None,
-            SockFlag::empty(),
-        )
-        .unwrap();
-
-        let raw_fd = fd_a.as_raw_fd();
-        set_nonblocking(raw_fd);
-        std::mem::forget(fd_a);
-
-        let wrapper = Arc::new(RawFdWrapper { fd: raw_fd });
-        let async_fd = AsyncFd::new(ArcFd(wrapper)).unwrap();
-
-        unsafe {
-            libc::close(raw_fd);
-        }
-
-        drop(async_fd);
-    }
-
-    tokio::task::yield_now().await;
-    let after_phase2 = allocated_bytes();
-
-    // Phase 3: Run even more iterations
-    for _ in 0..ITERATIONS {
-        let (fd_a, _fd_b) = socket::socketpair(
-            AddressFamily::Unix,
-            SockType::Stream,
-            None,
-            SockFlag::empty(),
-        )
-        .unwrap();
-
-        let raw_fd = fd_a.as_ra
```

---

### Incident Patch 4: `5dd04eb0` (2026-10-02)
**Commit Message**: sync: validate MAX_PERMITS in Semaphore::acquire (#8548)

Currently, `batch_semaphore::Acquire::new` does not check that the
requested number of permits is at most `Semaphore::MAX_PERMITS`, unlike
`Semaphore::new` and `Semaphore::try_acquire`.

On 32-bit targets, `Semaphore::acquire_many` accepts a `u32` that can
exceed `Semaphore::MAX_PERMITS` (`usize::MAX >> 3`). When `poll_acquire`
shifts `num_permits` left by `PERMIT_SHIFT` (`1`), a request with the
top bit set (such as `1 << 31`) wraps or truncates, allowing
`acquire_many(1 << 31)` to succeed immediately on an empty semaphore.

Fix this by asserting `num_permits <= Semaphore::MAX_PERMITS` in
`Acquire::new`.

Fixes: #8547

**File**: `tokio/src/sync/batch_semaphore.rs` (modified, +6/-0)
```diff
@@ -620,6 +620,12 @@ impl Future for Acquire<'_> {
 
 impl<'a> Acquire<'a> {
     fn new(semaphore: &'a Semaphore, num_permits: usize) -> Self {
+        assert!(
+            num_permits <= Semaphore::MAX_PERMITS,
+            "a semaphore may not have more than MAX_PERMITS permits ({})",
+            Semaphore::MAX_PERMITS
+        );
+
         #[cfg(any(not(tokio_unstable), not(feature = "tracing")))]
         return Self {
             node: Waiter::new(num_permits),
```

**File**: `tokio/src/sync/tests/semaphore_batch.rs` (modified, +21/-0)
```diff
@@ -182,6 +182,27 @@ fn validates_max_permits() {
     Semaphore::new(MAX_PERMITS + 1);
 }
 
+#[test]
+#[should_panic(expected = "a semaphore may not have more than MAX_PERMITS permits")]
+fn try_acquire_validates_max_permits() {
+    let s = Semaphore::new(0);
+    let _ = s.try_acquire(MAX_PERMITS + 1);
+}
+
+#[test]
+#[should_panic(expected = "a semaphore may not have more than MAX_PERMITS permits")]
+fn acquire_validates_max_permits() {
+    let s = Semaphore::new(0);
+    let _ = task::spawn(s.acquire(MAX_PERMITS + 1)).poll();
+}
+
+#[test]
+#[should_panic(expected = "a semaphore may not have more than MAX_PERMITS permits")]
+fn acquire_validates_top_bit_permits() {
+    let s = Semaphore::new(0);
+    let _ = task::spawn(s.acquire(1usize << (usize::BITS - 1))).poll();
+}
+
 #[test]
 fn close_semaphore_prevents_acquire() {
     let s = Semaphore::new(5);
```

**File**: `tokio/tests/sync_semaphore.rs` (modified, +16/-0)
```diff
@@ -222,6 +222,22 @@ fn panic_when_exceeds_maxpermits() {
     let _ = Semaphore::new(Semaphore::MAX_PERMITS + 1);
 }
 
+#[cfg(target_pointer_width = "32")]
+#[test]
+#[should_panic(expected = "a semaphore may not have more than MAX_PERMITS permits")]
+fn acquire_many_exceeds_maxpermits() {
+    let s = Semaphore::new(0);
+    let _ = tokio_test::task::spawn(s.acquire_many((Semaphore::MAX_PERMITS as u32) + 1)).poll();
+}
+
+#[cfg(target_pointer_width = "32")]
+#[test]
+#[should_panic(expected = "a semaphore may not have more than MAX_PERMITS permits")]
+fn acquire_many_top_bit_exceeds_maxpermits() {
+    let s = Semaphore::new(0);
+    let _ = tokio_test::task::spawn(s.acquire_many(1_u32 << 31)).poll();
+}
+
 #[test]
 fn no_panic_at_maxpermits() {
     let _ = Semaphore::new(Semaphore::MAX_PERMITS);
```

**File**: `tokio/tests/sync_semaphore_owned.rs` (modified, +17/-0)
```diff
@@ -114,6 +114,23 @@ fn merge_unrelated_permits() {
     p1.merge(p2)
 }
 
+#[cfg(target_pointer_width = "32")]
+#[test]
+#[should_panic(expected = "a semaphore may not have more than MAX_PERMITS permits")]
+fn acquire_many_owned_exceeds_maxpermits() {
+    let s = Arc::new(Semaphore::new(0));
+    let _ =
+        tokio_test::task::spawn(s.acquire_many_owned((Semaphore::MAX_PERMITS as u32) + 1)).poll();
+}
+
+#[cfg(target_pointer_width = "32")]
+#[test]
+#[should_panic(expected = "a semaphore may not have more than MAX_PERMITS permits")]
+fn acquire_many_owned_top_bit_exceeds_maxpermits() {
+    let s = Arc::new(Semaphore::new(0));
+    let _ = tokio_test::task::spawn(s.acquire_many_owned(1_u32 << 31)).poll();
+}
+
 #[test]
 fn split() {
     let sem = Arc::new(Semaphore::new(5));
```

---

### Incident Patch 5: `8513291f` (2026-10-02)
**Commit Message**: sync: fix mpsc index wraparound in block reclamation (#8546)

Use wrapping arithmetic in `Rx::reclaim_blocks`, `Block::grow`, and
`Block::has_value` so that block reclamation and index checks behave
correctly when `tail_position` wraps around `usize::MAX`. Without this,
the receiver can reclaim a block while a concurrent sender is still
reading it, leading to a data race or use-after-free on 32-bit
platforms after 2^32 messages.

**File**: `tokio/src/sync/mpsc/block.rs` (modified, +2/-5)
```diff
@@ -178,10 +178,7 @@ impl<T> Block<T> {
     ///
     /// Always returns false when given an index from a different block.
     pub(crate) fn has_value(&self, slot_index: usize) -> bool {
-        if slot_index < self.header.start_index {
-            return false;
-        }
-        if slot_index >= self.header.start_index + super::BLOCK_CAP {
+        if start_index(slot_index) != self.header.start_index {
             return false;
         }
 
@@ -358,7 +355,7 @@ impl<T> Block<T> {
         // Create the new block. It is assumed that the block will become the
         // next one after `&self`. If this turns out to not be the case,
         // `start_index` is updated accordingly.
-        let new_block = Block::new(self.header.start_index + BLOCK_CAP);
+        let new_block = Block::new(self.header.start_index.wrapping_add(BLOCK_CAP));
 
         let mut new_block = unsafe { NonNull::new_unchecked(Box::into_raw(new_block)) };
 
```

**File**: `tokio/src/sync/mpsc/chan.rs` (modified, +16/-0)
```diff
@@ -114,7 +114,23 @@ impl<T, S> panic::UnwindSafe for Chan<T, S> {}
 
 pub(crate) fn channel<T, S: Semaphore>(semaphore: S) -> (Tx<T, S>, Rx<T, S>) {
     let (tx, rx) = list::channel();
+    channel_from_list(tx, rx, semaphore)
+}
 
+#[cfg(all(test, not(loom)))]
+pub(crate) fn channel_from_index<T, S: Semaphore>(
+    start_index: usize,
+    semaphore: S,
+) -> (Tx<T, S>, Rx<T, S>) {
+    let (tx, rx) = list::channel_from_index(start_index);
+    channel_from_list(tx, rx, semaphore)
+}
+
+fn channel_from_list<T, S: Semaphore>(
+    tx: list::Tx<T>,
+    rx: list::Rx<T>,
+    semaphore: S,
+) -> (Tx<T, S>, Rx<T, S>) {
     let chan = Arc::new(Chan {
         notify_rx_closed: Notify::new(),
         tx: CachePadded::new(tx),
```

**File**: `tokio/src/sync/mpsc/list.rs` (modified, +88/-4)
```diff
@@ -49,20 +49,26 @@ pub(crate) enum TryPopResult<T> {
 }
 
 pub(crate) fn channel<T>() -> (Tx<T>, Rx<T>) {
+    channel_from_index(0)
+}
+
+pub(crate) fn channel_from_index<T>(start_index: usize) -> (Tx<T>, Rx<T>) {
+    debug_assert_eq!(block::offset(start_index), 0);
+
     // Create the initial block shared between the tx and rx halves.
-    let initial_block = Block::new(0);
+    let initial_block = Block::new(start_index);
     let initial_block_ptr = Box::into_raw(initial_block);
 
     let tx = Tx {
         block_tail: AtomicPtr::new(initial_block_ptr),
-        tail_position: AtomicUsize::new(0),
+        tail_position: AtomicUsize::new(start_index),
     };
 
     let head = NonNull::new(initial_block_ptr).unwrap();
 
     let rx = Rx {
         head,
-        index: 0,
+        index: start_index,
         free_head: head,
     };
 
@@ -402,7 +408,7 @@ impl<T> Rx<T> {
                     None => return,
                 };
 
-                if required_index > self.index {
+                if required_index.wrapping_sub(self.index) as isize > 0 {
                     return;
                 }
 
@@ -455,3 +461,81 @@ impl<T> fmt::Debug for Rx<T> {
             .finish()
     }
 }
+
+#[cfg(all(test, not(loom)))]
+mod tests {
+    use crate::sync::mpsc::unbounded::unbounded_channel_from_index;
+    use crate::sync::mpsc::BLOCK_CAP;
+
+    #[cfg(all(target_family = "wasm", not(target_os = "wasi")))]
+    use wasm_bindgen_test::wasm_bindgen_test as test;
+
+    #[test]
+    #[cfg(not(target_family = "wasm"))]
+    fn wraparound() {
+        use super::*;
+
+        let (tx, mut rx) = channel_from_index(0usize.wrapping_sub(2 * BLOCK_CAP));
+        let head = rx.free_head;
+
+        for i in 0..BLOCK_CAP {
+            tx.push(i);
+            assert!(matches!(rx.pop(&tx), Some(block::Read::Value(v)) if v == i));
+        }
+
+        // Simulate a slow sender claiming the first slot of the second block
+        // while still holding a pointer to the first block.
+        let slow_slot = tx.tail_position.fetch_add(1, Acquire);
+        let slow_tail = AtomicPtr::new(tx.block_tail.load(Acquire));
+
+        // Fill the rest of the second block (wrapping `tail_position` to 0),
+        // then push one item into the third block to retire the first block.
+        for i in 1..BLOCK_CAP {
+            tx.push(i);
+        }
+        assert_eq!(rx.len(&tx), BLOCK_CAP);
+        tx.push(BLOCK_CAP);
+
+        // Advancing `rx` to the second block must not reclaim the first block yet,
+        // because `rx.index` has not reached the wrapped `required_index` (1).
+        std::thread::scope(|s| {
+            s.spawn(|| unsafe {
+                let slow_tail = &*slow_tail.load(Relaxed);
+                let slow_block = slow_tail.load_next(Acquire).unwrap();
+                assert!(slow_block
+                    .as_ref()
+                    .is_at_index(block::start_index(slow_slot)));
+            });
+            assert!(rx.pop(&tx).is_none());
+        });
+        assert_eq!(rx.free_head, head);
+
+        unsafe {
+            let slow_tail = &*slow_tail.load(Relaxed);
+            let slow_block = slow_tail.load_next(Acquire).unwrap();
+            slow_block.as_ref().write(slow_slot, 0);
+        }
+
+        for i in 0..=BLOCK_CAP {
+            assert!(matches!(rx.pop(&tx), Some(block::Read::Value(v)) if v == i));
+        }
+        unsafe { rx.free_blocks() };
+    }
+
+    #[test]
+    fn wraparound_unbounded() {
+        let (tx, mut rx) = unbounded_channel_from_index(0usize.wrapping_sub(2 * BLOCK_CAP));
+
+        for i in 0..4 * BLOCK_CAP {
+            tx.send(i).unwrap();
+            assert_eq!(rx.len(), i + 1);
+            assert!(!rx.is_empty());
+        }
+
+        for i in 0..4 * BLOCK_CAP {
+            assert_eq!(rx.try_recv().unwrap(), i);
+            assert_eq!(rx.len(), 4 * BLOCK_CAP - 1 - i);
+        }
+        assert!(rx.is_empty());
+    }
+}
```

**File**: `tokio/src/sync/mpsc/unbounded.rs` (modified, +12/-0)
```diff
@@ -101,6 +101,18 @@ pub fn unbounded_channel<T>() -> (UnboundedSender<T>, UnboundedReceiver<T>) {
     (tx, rx)
 }
 
+#[cfg(all(test, not(loom)))]
+pub(crate) fn unbounded_channel_from_index<T>(
+    start_index: usize,
+) -> (UnboundedSender<T>, UnboundedReceiver<T>) {
+    let (tx, rx) = chan::channel_from_index(start_index, Semaphore(AtomicUsize::new(0)));
+
+    let tx = UnboundedSender::new(tx);
+    let rx = UnboundedReceiver::new(rx);
+
+    (tx, rx)
+}
+
 /// No capacity
 #[derive(Debug)]
 pub(crate) struct Semaphore(pub(crate) AtomicUsize);
```

---

### Incident Patch 6: `ba23117a` (2026-10-02)
**Commit Message**: rt: preserve io_uring context if a completion waker panics (#8566)

`UringContext::dispatch_completions` previously took `self.uring` with
`Option::take()` and only restored it after waking completed tasks. If a
waker panicked, `self.uring` was dropped and left as `None`, causing
`UringContext::drop` to skip waiting for in-flight operations and free
their buffers while the kernel was still using them (use-after-free UB).

Borrow `self.uring` via `as_mut()` instead of taking it, and record
`Lifecycle::Completed(cqe)` before waking the task.

Fixes: #8565

**File**: `tokio/src/runtime/io/driver/uring.rs` (modified, +7/-5)
```diff
@@ -64,7 +64,7 @@ impl UringContext {
 
     pub(crate) fn dispatch_completions(&mut self) {
         let ops = &mut self.ops;
-        let Some(mut uring) = self.uring.take() else {
+        let Some(uring) = self.uring.as_mut() else {
             // Uring is not initialized yet.
             return;
         };
@@ -75,9 +75,13 @@ impl UringContext {
             let idx = cqe.user_data() as usize;
 
             match ops.get_mut(idx) {
-                Some(Lifecycle::Waiting(waker)) => {
+                Some(lifecycle @ Lifecycle::Waiting(_)) => {
+                    let Lifecycle::Waiting(waker) =
+                        mem::replace(lifecycle, Lifecycle::Completed(cqe))
+                    else {
+                        unreachable!()
+                    };
                     waker.wake_by_ref();
-                    *ops.get_mut(idx).unwrap() = Lifecycle::Completed(cqe);
                 }
                 Some(Lifecycle::Cancelled(cancel_data)) => {
                     if let CancelData::Open(_) = cancel_data {
@@ -100,8 +104,6 @@ impl UringContext {
             }
         }
 
-        self.uring.replace(uring);
-
         // `cq`'s drop gets called here, updating the latest head pointer
     }
 
```

**File**: `tokio/tests/fs_uring.rs` (modified, +47/-0)
```diff
@@ -145,6 +145,53 @@ async fn cancel_op_future() {
     assert!(res.is_cancelled());
 }
 
+#[cfg(panic = "unwind")]
+#[test]
+fn completion_waker_panic_preserves_uring() {
+    use std::panic::{catch_unwind, AssertUnwindSafe};
+    use std::sync::Arc;
+    use std::task::{Context, Wake, Waker};
+
+    struct PanicWaker;
+    impl Wake for PanicWaker {
+        fn wake(self: Arc<Self>) {
+            panic!("completion waker panic");
+        }
+    }
+
+    if io_uring::IoUring::new(2).is_err() {
+        return;
+    }
+
+    let rt = Builder::new_current_thread().enable_all().build().unwrap();
+
+    // Initialize io_uring on the runtime.
+    rt.block_on(tokio::fs::File::open("/dev/null")).unwrap();
+
+    let mut open_fut = Box::pin(tokio::fs::File::open("/dev/null"));
+    {
+        let _enter = rt.enter();
+        let waker = Waker::from(Arc::new(PanicWaker));
+        let mut cx = Context::from_waker(&waker);
+        tokio_test::assert_pending!(open_fut.as_mut().poll_unpin(&mut cx));
+    }
+
+    let res = catch_unwind(AssertUnwindSafe(|| {
+        rt.block_on(std::future::pending::<()>());
+    }));
+    assert!(res.is_err());
+
+    // The completed operation recorded its CQE before waking, and the ring is still intact.
+    {
+        let _enter = rt.enter();
+        open_fut.now_or_never().unwrap().unwrap();
+
+        let mut next_open = Box::pin(tokio::fs::File::open("/dev/null"));
+        let mut cx = Context::from_waker(Waker::noop());
+        tokio_test::assert_pending!(next_open.as_mut().poll_unpin(&mut cx));
+    }
+}
+
 fn create_tmp_files(num_files: usize) -> (Vec<NamedTempFile>, Vec<PathBuf>) {
     let mut files = Vec::with_capacity(num_files);
     for _ in 0..num_files {
```

---

### Incident Patch 7: `e133b6fe` (2026-09-29)
**Commit Message**: task: test task builder spawn locations (#8499)

**File**: `tokio/tests/task_hooks.rs` (modified, +45/-0)
```diff
@@ -180,6 +180,51 @@ fn task_hook_spawn_location_multi_thread() {
     assert_eq!(poll_starts, poll_ends.fetch_add(0, Ordering::SeqCst));
 }
 
+/// Test that task::Builder properly propagates the user call-site location.
+#[cfg(feature = "tracing")]
+#[test]
+fn task_hook_spawn_location_builder() {
+    let spawns = Arc::new(AtomicUsize::new(0));
+
+    let runtime = Builder::new_current_thread()
+        .on_task_spawn(mk_spawn_location_hook(
+            "(current_thread) task::Builder",
+            &spawns,
+        ))
+        .build()
+        .unwrap();
+
+    runtime.block_on(async {
+        let builder = tokio::task::Builder::new().name("builder_spawn_test");
+        builder.spawn(async {}).unwrap().await.unwrap();
+
+        let handle = tokio::runtime::Handle::current();
+        let builder = tokio::task::Builder::new().name("builder_spawn_on_test");
+        builder.spawn_on(async {}, &handle).unwrap().await.unwrap();
+    });
+    assert_eq!(spawns.load(Ordering::SeqCst), 2);
+
+    #[cfg(not(target_os = "wasi"))]
+    {
+        let spawns = Arc::new(AtomicUsize::new(0));
+
+        let mt_runtime = Builder::new_multi_thread()
+            .worker_threads(2)
+            .on_task_spawn(mk_spawn_location_hook(
+                "(multi_thread) task::Builder",
+                &spawns,
+            ))
+            .build()
+            .unwrap();
+
+        mt_runtime.block_on(async {
+            let builder = tokio::task::Builder::new().name("mt_builder_spawn");
+            builder.spawn(async {}).unwrap().await.unwrap();
+        });
+        assert_eq!(spawns.load(Ordering::SeqCst), 1);
+    }
+}
+
 #[cfg(feature = "schedule-latency")]
 #[test]
 fn task_hook_schedule_latency_non_poll_callbacks() {
```

---

### Incident Patch 8: `38631ed3` (2026-09-29)
**Commit Message**: rt: fix spurious failure in queue `stress1` test (#8524)

The producer pops at most 250 tasks after each round of 500 pushes. A
steal during the last round can shift the overflow points so that a few
tasks (up to 6) remain in the local queue. If the stealer thread has
already exited, nobody takes them and the count comes up short.

Drain the local queue after joining the stealer, like `stress2` does.

**File**: `tokio/src/runtime/tests/queue.rs` (modified, +6/-0)
```diff
@@ -211,6 +211,12 @@ fn stress1() {
 
         n += th.join().unwrap();
 
+        // A steal during the last round can leave a few tasks in the local
+        // queue after the stealer has exited.
+        while local.pop().is_some() {
+            n += 1;
+        }
+
         assert_eq!(n, NUM_LOCAL * NUM_PUSH);
     }
 }
```

---

### Incident Patch 9: `40b87794` (2026-09-29)
**Commit Message**: sync: revert `Box::leak` usage (#8522)

**File**: `tokio/src/sync/mpsc/block.rs` (modified, +1/-1)
```diff
@@ -360,7 +360,7 @@ impl<T> Block<T> {
         // `start_index` is updated accordingly.
         let new_block = Block::new(self.header.start_index + BLOCK_CAP);
 
-        let mut new_block = NonNull::from(Box::leak(new_block));
+        let mut new_block = unsafe { NonNull::new_unchecked(Box::into_raw(new_block)) };
 
         // Attempt to store the block. The first compare-and-swap attempt is
         // "unrolled" due to minor differences in logic
```

---

### Incident Patch 10: `aa18e84c` (2026-09-29)
**Commit Message**: Fix typo in semaphore.rs documentation (#8521)

**File**: `tokio/src/sync/semaphore.rs` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ use std::sync::Arc;
 /// they were requested. This fairness is also applied when `acquire_many` gets
 /// involved, so if a call to `acquire_many` at the front of the queue requests
 /// more permits than currently available, this can prevent a call to `acquire`
-/// from completing, even if the semaphore has enough permits complete the call
+/// from completing, even if the semaphore has enough permits to complete the call
 /// to `acquire`.
 ///
 /// To use the `Semaphore` in a poll function, you can use the [`PollSemaphore`]
```

---

### Incident Patch 11: `e3b676ec` (2026-09-27)
**Commit Message**: chore: fix clippy warnings from latest nightly (#8517)

**File**: `tokio-stream/src/stream_map.rs` (modified, +1/-7)
```diff
@@ -502,13 +502,7 @@ impl<K, V> StreamMap<K, V> {
         K: Borrow<Q>,
         Q: Hash + Eq + ?Sized,
     {
-        for i in 0..self.entries.len() {
-            if self.entries[i].0.borrow() == k {
-                return true;
-            }
-        }
-
-        false
+        self.entries.iter().any(|e| e.0.borrow() == k)
     }
 }
 
```

**File**: `tokio-util/src/time/wheel/mod.rs` (modified, +4/-12)
```diff
@@ -148,23 +148,15 @@ where
     /// Advances the timer up to the instant represented by `now`.
     pub(crate) fn poll(&mut self, now: u64, store: &mut T::Store) -> Option<T::Owned> {
         loop {
-            let expiration = self.next_expiration().and_then(|expiration| {
-                if expiration.deadline > now {
-                    None
-                } else {
-                    Some(expiration)
-                }
-            });
-
-            match expiration {
-                Some(ref expiration) => {
-                    if let Some(item) = self.poll_expiration(expiration, store) {
+            match self.next_expiration() {
+                Some(expiration) if expiration.deadline <= now => {
+                    if let Some(item) = self.poll_expiration(&expiration, store) {
                         return Some(item);
                     }
 
                     self.set_elapsed(expiration.deadline);
                 }
-                None => {
+                _ => {
                     // in this case the poll did not indicate an expiration
                     // _and_ we were not able to find a next expiration in
                     // the current list of timers.  advance to the poll's
```

**File**: `tokio/src/sync/mpsc/block.rs` (modified, +1/-1)
```diff
@@ -360,7 +360,7 @@ impl<T> Block<T> {
         // `start_index` is updated accordingly.
         let new_block = Block::new(self.header.start_index + BLOCK_CAP);
 
-        let mut new_block = unsafe { NonNull::new_unchecked(Box::into_raw(new_block)) };
+        let mut new_block = NonNull::from(Box::leak(new_block));
 
         // Attempt to store the block. The first compare-and-swap attempt is
         // "unrolled" due to minor differences in logic
```

---

### Incident Patch 12: `ec6d2afd` (2026-09-24)
**Commit Message**: stream: implement `FusedStream` for `Throttle` (#8485)

**File**: `tokio-stream/src/stream_ext/throttle.rs` (modified, +7/-0)
```diff
@@ -1,6 +1,7 @@
 //! Slow down a stream by enforcing a delay between items.
 
 use crate::Stream;
+use futures_core::FusedStream;
 use tokio::time::{sleep, Duration, Sleep};
 
 use std::future::Future;
@@ -97,6 +98,12 @@ impl<T: Stream> Stream for Throttle<T> {
     }
 }
 
+impl<T: FusedStream> FusedStream for Throttle<T> {
+    fn is_terminated(&self) -> bool {
+        (self.has_delayed || is_zero(self.duration)) && self.stream.is_terminated()
+    }
+}
+
 fn is_zero(dur: Duration) -> bool {
     dur == Duration::from_millis(0)
 }
```

**File**: `tokio-stream/tests/stream_fused.rs` (modified, +19/-0)
```diff
@@ -268,3 +268,22 @@ async fn stream_notify_close_does_not_poll_inner_after_close_notification() {
     assert!(stream.is_terminated());
     assert_eq!(stream.next().await, None);
 }
+
+// ── throttle ─────────────────────────────────────────────────────────────────
+
+#[tokio::test(start_paused = true)]
+async fn throttle_not_terminated_before_done() {
+    let stream = fused_iter(vec![1, 2]).throttle(std::time::Duration::from_millis(100));
+    assert!(!stream.is_terminated());
+}
+
+#[tokio::test(start_paused = true)]
+async fn throttle_terminated_after_inner_done() {
+    let stream = fused_iter(vec![1]).throttle(std::time::Duration::from_millis(100));
+    tokio::pin!(stream);
+    assert_eq!(stream.next().await, Some(1));
+    assert!(!stream.as_ref().get_ref().is_terminated());
+    assert_eq!(stream.next().await, None);
+    assert!(stream.as_ref().get_ref().is_terminated());
+    assert_eq!(stream.next().await, None);
+}
```

**File**: `tokio-stream/tests/time_throttle.rs` (modified, +43/-0)
```diff
@@ -1,6 +1,7 @@
 #![warn(rust_2018_idioms)]
 #![cfg(all(feature = "time", feature = "sync", feature = "io-util"))]
 
+use futures_core::FusedStream;
 use tokio::time;
 use tokio_stream::{Stream, StreamExt};
 use tokio_test::*;
@@ -61,3 +62,45 @@ async fn size_hint() {
 
     assert_eq!(stream.size_hint(), (3, Some(3)));
 }
+
+#[tokio::test(start_paused = true)]
+async fn is_terminated() {
+    let stream = tokio_stream::once(1).throttle(Duration::from_millis(100));
+    tokio::pin!(stream);
+
+    assert!(!stream.as_ref().get_ref().is_terminated());
+    assert_eq!(stream.next().await, Some(1));
+
+    // The inner stream is already terminated, but the throttle delay is still pending.
+    assert!(stream.as_ref().get_ref().get_ref().is_terminated());
+    assert!(!stream.as_ref().get_ref().is_terminated());
+
+    time::sleep(Duration::from_millis(101)).await;
+
+    // After the delay has elapsed, the stream yields None and is terminated.
+    assert_eq!(stream.next().await, None);
+    assert!(stream.as_ref().get_ref().is_terminated());
+    assert_eq!(stream.next().await, None);
+}
+
+#[tokio::test]
+async fn is_terminated_zero_duration() {
+    let stream = tokio_stream::once(1).throttle(Duration::from_millis(0));
+    tokio::pin!(stream);
+
+    assert!(!stream.as_ref().get_ref().is_terminated());
+    assert_eq!(stream.next().await, Some(1));
+    assert!(stream.as_ref().get_ref().get_ref().is_terminated());
+    assert!(stream.as_ref().get_ref().is_terminated());
+    assert_eq!(stream.next().await, None);
+}
+
+#[tokio::test]
+async fn is_terminated_empty() {
+    let stream = tokio_stream::empty::<i32>().throttle(Duration::from_millis(100));
+    tokio::pin!(stream);
+
+    assert!(stream.as_ref().get_ref().is_terminated());
+    assert_eq!(stream.next().await, None);
+    assert!(stream.as_ref().get_ref().is_terminated());
+}
```

---

### Incident Patch 13: `e43fb07c` (2026-09-23)
**Commit Message**: rt: suggest `.await` in nested `block_on` panic (#8501)

Point callers at `.await` when `block_on` is invoked from an async
context, and assert the hint in the nesting test.

Fixes: #3960

**File**: `tokio/src/runtime/context/runtime.rs` (modified, +2/-1)
```diff
@@ -69,7 +69,8 @@ where
         "Cannot start a runtime from within a runtime. This happens \
             because a function (like `block_on`) attempted to block the \
             current thread while the thread is being used to drive \
-            asynchronous tasks."
+            asynchronous tasks. If you are in an async function, use \
+            `.await` on the future instead of blocking on it."
     );
 }
 
```

**File**: `tokio/tests/rt_handle_block_on.rs` (modified, +1/-1)
```diff
@@ -376,7 +376,7 @@ rt_test! {
 
     #[test]
     #[should_panic(
-        expected = "Cannot start a runtime from within a runtime. This happens because a function (like `block_on`) attempted to block the current thread while the thread is being used to drive asynchronous tasks."
+        expected = "Cannot start a runtime from within a runtime. This happens because a function (like `block_on`) attempted to block the current thread while the thread is being used to drive asynchronous tasks. If you are in an async function, use `.await` on the future instead of blocking on it."
     )]
     fn nesting() {
         fn some_non_async_function() -> i32 {
```

---

### Incident Patch 14: `5d5ca118` (2026-09-22)
**Commit Message**: rt: avoid overflow in `shutdown_timeout()` (#8497)

**File**: `tokio/src/runtime/context/blocking.rs` (modified, +9/-5)
```diff
@@ -84,7 +84,7 @@ impl BlockingRegionGuard {
         let mut cx = Context::from_waker(&waker);
 
         pin!(f);
-        let when = Instant::now() + timeout;
+        let when = Instant::now().checked_add(timeout);
 
         loop {
             if let Ready(v) = crate::task::coop::budget(|| f.as_mut().poll(&mut cx)) {
@@ -93,11 +93,15 @@ impl BlockingRegionGuard {
 
             let now = Instant::now();
 
-            if now >= when {
-                return Err(());
-            }
+            if let Some(when) = when {
+                if now >= when {
+                    return Err(());
+                }
 
-            park.park_timeout(when - now);
+                park.park_timeout(when - now);
+            } else {
+                park.park();
+            }
         }
     }
 }
```

**File**: `tokio/tests/rt_common.rs` (modified, +9/-0)
```diff
@@ -1069,6 +1069,15 @@ rt_test! {
         assert!(now.elapsed().as_secs() < 1);
     }
 
+    #[cfg(not(target_os="wasi"))]
+    #[test]
+    #[cfg_attr(miri, ignore)] // Miri detects leaked threads (see #7010)
+    fn shutdown_timeout_max() {
+        let runtime = rt();
+
+        Arc::try_unwrap(runtime).unwrap().shutdown_timeout(Duration::MAX);
+    }
+
     #[test]
     #[cfg_attr(miri, ignore)] // Miri detects leaked threads (see #7010)
     fn shutdown_wakeup_time() {
```

---

### Incident Patch 15: `7d2a0f10` (2026-09-16)
**Commit Message**: time: create timer inside `Throttle` stream lazily (#8468)

**File**: `tokio-stream/src/stream_ext/throttle.rs` (modified, +6/-4)
```diff
@@ -14,7 +14,7 @@ where
     T: Stream,
 {
     Throttle {
-        delay: sleep(duration),
+        delay: None,
         duration,
         has_delayed: true,
         stream,
@@ -28,7 +28,7 @@ pin_project! {
     #[must_use = "streams do nothing unless polled"]
     pub struct Throttle<T> {
         #[pin]
-        delay: Sleep,
+        delay: Option<Sleep>,
         duration: Duration,
 
         // Set to true when `delay` has returned ready, but `stream` hasn't.
@@ -73,15 +73,17 @@ impl<T: Stream> Stream for Throttle<T> {
         let dur = *me.duration;
 
         if !*me.has_delayed && !is_zero(dur) {
-            ready!(me.delay.as_mut().poll(cx));
+            if let Some(delay) = me.delay.as_mut().as_pin_mut() {
+                ready!(delay.poll(cx));
+            }
             *me.has_delayed = true;
         }
 
         let value = ready!(me.stream.poll_next(cx));
 
         if value.is_some() {
             if !is_zero(dur) {
-                me.delay.set(sleep(dur));
+                me.delay.set(Some(sleep(dur)));
             }
 
             *me.has_delayed = false;
```

**File**: `tokio-stream/tests/time_throttle.rs` (modified, +21/-0)
```diff
@@ -7,6 +7,27 @@ use tokio_test::*;
 
 use std::time::Duration;
 
+#[test]
+fn throttle_can_be_created_outside_runtime() {
+    let _stream = futures::stream::iter([1, 2]).throttle(Duration::from_millis(1));
+}
+
+#[test]
+fn zero_duration_does_not_require_time_driver() {
+    let rt = tokio::runtime::Builder::new_current_thread()
+        .build()
+        .unwrap();
+
+    rt.block_on(async {
+        let stream = futures::stream::iter([1, 2]).throttle(Duration::from_millis(0));
+        tokio::pin!(stream);
+
+        assert_eq!(stream.next().await, Some(1));
+        assert_eq!(stream.next().await, Some(2));
+        assert_eq!(stream.next().await, None);
+    });
+}
+
 #[tokio::test]
 async fn usage() {
     time::pause();
```

#### Recent Merged Pull Requests:
- **PR #8594** (2026-10-07): ci: pin libc to 0.2.189 on FreeBSD (@Darksonn)
- **PR #8590** (2026-10-04): chore: clean up stale Err(Invalid) doc and typo (@TAYTS)
- **PR #8586** (closed): docs: fix builds with `--generate-link-to-definition` (@Miruameli)
- **PR #8580** (2026-10-03): chore: prepare Tokio v1.53.2 (@Darksonn)
- **PR #8579** (2026-10-03): chore: prepare Tokio v1.51.5 (@Darksonn)
- **PR #8578** (2026-10-03): Merge 'tokio-1.53.2' into 'master' (@Darksonn)
- **PR #8577** (2026-10-03): Merge 'tokio-1.51.5' into 'tokio-1.53.x' (@Darksonn)
- **PR #8575** (closed): fs: prevent overflow on buffered relative seek (#8573) (@Aditya-9-6)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
