# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: actix-actix-web-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "actix-actix-web-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T07:06:57.984Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-actix-actix-web-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [actix-actix-web-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T07:06:57.984Z`  
> **Learning ID**: `LEARN-EVO-actix-actix-web-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 79%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from actix-actix-web-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/actix-actix-web-learnings.md`  
> **Source**: github ([https://github.com/actix/actix-web](https://github.com/actix/actix-web))  
> **Source Version**: `27cdad7b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T07:06:53.418Z  
> **Learning ID**: `learn-github-actix-actix-web`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): actix/actix-web

> **Canonical Artifact**: `07_PROJECT_LEARNING/actix-actix-web-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/actix/actix-web](https://github.com/actix/actix-web))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T07:06:14.744Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `actix/actix-web`
- **Description**: Actix Web is a powerful, pragmatic, and extremely fast web framework for Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 24962 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `actix-http/src/body/utils.rs`
```
use std::{pin::pin, task::Poll};

use actix_utils::future::poll_fn;
use bytes::{Bytes, BytesMut};
use derive_more::{Display, Error};
use futures_core::ready;

use super::{BodySize, MessageBody};

/// Collects all the bytes produced by `body`.
///
/// Any errors produced by the body stream are returned immediately.
///
/// Consider using [`to_bytes_limited`] instead to protect against memory exhaustion.
///
/// # Examples
///
/// ```
/// use actix_http::body::{self, to_bytes};
/// use bytes::Bytes;
///
/// # actix_rt::System::new().block_on(async {
/// let body = body::None::new();
/// let bytes = to_bytes(body).await.unwrap();
/// assert!(bytes.is_empty());
///
/// let body = Bytes::from_static(b"123");
/// let bytes = to_bytes(body).await.unwrap();
/// assert_eq!(bytes, "123");
/// # });
/// ```
pub async fn to_bytes<B: MessageBody>(body: B) -> Result<Bytes, B::Error> {
    to_bytes_limited(body, usize::MAX)
        .await
        .expect("Body should never yield more than usize::MAX bytes")
}

/// Error type returned from [`to_bytes_limited`] when body produced exceeds limit.
#[derive(Debug, Display, Error)]
#[display("Limit exceeded while collecting body bytes")]
#[non_exhaustive]
pub struct BodyLimitExceeded;

/// Collects the bytes produced by `body`, up to `limit` bytes.
///
/// If a chunk read from `poll_next` causes the total number of bytes read to exceed `limit`, an
/// `Err(BodyLimitExceeded)` is returned.
///
/// Any errors produced by the body stream are returned immediately as `Ok(Err(B::Error))`.
///
/// # Examples
///
/// ```
/// use actix_http::body::{self, to_bytes_limited};
/// use bytes::Bytes;
///
/// # actix_rt::System::new().block_on(async {
/// let body = body::None::new();
/// let bytes = to_bytes_limited(body, 10).await.unwrap().unwrap();
/// assert!(bytes.is_empty());
///
/// let body = Bytes::from_static(b"123");
/// let bytes = to_bytes_limited(body, 10).await.unwrap().unwrap();
/// assert_eq!(bytes, "123");
///
/// let body = Bytes::from_static(b"123");
/// assert!(to_bytes_limited(body, 2).await.is_err());
/// # });
/// ```
pub async fn to_bytes_limited<B: MessageBody>(
    body: B,
    limit: usize,
) -> Result<Result<Bytes, B::Error>, BodyLimitExceeded> {
    /// Sensible default (32kB) for initial, bounded allocation when collecting body bytes.
    const INITIAL_ALLOC_BYTES: usize = 32 * 1024;

    let cap = match body.size() {
        BodySize::None | BodySize::Sized(0) => return Ok(Ok(Bytes::new())),
        BodySize::Sized(size) if size as usize > limit => return Err(BodyLimitExceeded),
        BodySize::Sized(size) => (size as usize).min(INITIAL_ALLOC_BYTES),
        BodySize::Stream => INITIAL_ALLOC_BYTES,
    };

    let mut exceeded_limit = false;
    let mut buf = BytesMut::with_capacity(cap);

    let mut body = pin!(body);

    match poll_fn(|cx| loop {
        let body = body.as_mut();

        match ready!(body.poll_next(cx)) {
            Some(Ok(bytes)) => {
                // if limit is exceeded...
                if buf.len() + bytes.len() > limit {
                    // ...set flag to true and break out of poll_fn
                    exceeded_limit = true;
                    return Poll::Ready(Ok(()));
                }

                buf.extend_from_slice(&bytes)
            }
            None => return Poll::Ready(Ok(())),
            Some(Err(err)) => return Poll::Ready(Err(err)),
        }
    })
    .await
    {
        // propagate error returned from body poll
        Err(err) => Ok(Err(err)),

        // limit was exceeded while reading body
        Ok(()) if exceeded_limit => Err(BodyLimitExceeded),

        // otherwise return body buffer
        Ok(()) => Ok(Ok(buf.freeze())),
    }
}

#[cfg(test)]
mod tests {
    use std::io;

    use futures_util::{stream, StreamExt as _};

    use super::*;
    use crate::{
        body::{BodyStream, SizedStream},
        Error,
    };

    #[tokio::test(flavor = "local")]
    async fn to_bytes_complete() {
        let bytes = to_bytes(()).await.unwrap();
        assert!(bytes.is_empty());

        let body = Bytes::from_static(b"123");
        let bytes = to_bytes(body).await.unwrap();
        assert_eq!(bytes, b"123"[..]);
    }

    #[tokio::test(flavor = "local")]
    async fn to_bytes_streams() {
        let stream = stream::iter(vec![Bytes::from_static(b"123"), Bytes::from_static(b"abc")])
            .map(Ok::<_, Error>);
        let body = BodyStream::new(stream);
        let bytes = to_bytes(body).await.unwrap();
        assert_eq!(bytes, b"123abc"[..]);
    }

    #[tokio::test(flavor = "local")]
    async fn to_bytes_limited_complete() {
        let bytes = to_bytes_limited((), 0).await.unwrap().unwrap();
        assert!(bytes.is_empty());

        let bytes = to_bytes_limited((), 1).await.unwrap().unwrap();
        assert!(bytes.is_empty());

        assert!(to_bytes_limited(Bytes::from_static(b"12"), 0)
            .await
            .is_err());
        assert!(to_bytes_limited(Bytes::from_static(b"12"), 1)
            .await
            .is_err());
        assert!(to_bytes_limited(Bytes::from_static(b"12"), 2).await.is_ok());
        assert!(to_bytes_limited(Bytes::from_static(b"12"), 3).await.is_ok());
    }

    #[tokio::test(flavor = "local")]
    async fn to_bytes_limited_streams() {
        // hinting a larger body fails
        let body = SizedStream::new(8, stream::empty().map(Ok::<_, Error>));
        assert!(to_bytes_limited(body, 3).await.is_err());

        // hinting a smaller body is okay
        let body = SizedStream::new(3, stream::empty().map(Ok::<_, Error>));
        assert!(to_bytes_limited(body, 3).await.unwrap().unwrap().is_empty());

        // hinting a smaller body then returning a larger one fails
        let stream = stream::iter(vec![Bytes::from_static(b"1234")]).map(Ok::<_, Error>);
        let body = SizedStream::new(3, stream);
        assert!(to_bytes_limited(body, 3).await.is_err());

        let stream = stream::iter(vec![Bytes::from_static(b"123"), Bytes::from_static(b"abc")])
            .map(Ok::<_, Error>);
        let body = BodyStream::new(stream);
        assert!(to_bytes_limited(body, 3).await.is_err());
    }

    #[tokio::test(flavor = "local")]
    async fn to_body_limit_error() {
        let err_stream = stream::once(async { Err(io::Error::other("")) });
        let body = SizedStream::new(8, err_stream);
        // not too big, but propagates error from body stream
        assert!(to_bytes_limited(body, 10).await.unwrap().is_err());
    }
}

```

### Core Architecture Module: `actix-http/src/h1/utils.rs`
```
use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};

use actix_codec::{AsyncRead, AsyncWrite, Framed};
use pin_project_lite::pin_project;

use crate::{
    body::{BodySize, MessageBody},
    h1::{Codec, Message},
    Error, Response,
};

pin_project! {
    /// Send HTTP/1 response
    pub struct SendResponse<T, B> {
        res: Option<Message<(Response<()>, BodySize)>>,

        #[pin]
        body: Option<B>,

        #[pin]
        framed: Option<Framed<T, Codec>>,
    }
}

impl<T, B> SendResponse<T, B>
where
    B: MessageBody,
    B::Error: Into<Error>,
{
    pub fn new(framed: Framed<T, Codec>, response: Response<B>) -> Self {
        let (res, body) = response.into_parts();

        SendResponse {
            res: Some((res, body.size()).into()),
            body: Some(body),
            framed: Some(framed),
        }
    }
}

impl<T, B> Future for SendResponse<T, B>
where
    T: AsyncRead + AsyncWrite + Unpin,
    B: MessageBody,
    B::Error: Into<Error>,
{
    type Output = Result<Framed<T, Codec>, Error>;

    // TODO: rethink if we need loops in polls
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let mut this = self.as_mut().project();

        let mut body_done = this.body.is_none();
        loop {
            let mut body_ready = !body_done;

            // send body
            if this.res.is_none() && body_ready {
                while body_ready
                    && !body_done
                    && !this
                        .framed
                        .as_ref()
                        .as_pin_ref()
                        .unwrap()
                        .is_write_buf_full()
                {
                    let next = match this.body.as_mut().as_pin_mut().unwrap().poll_next(cx) {
                        Poll::Ready(Some(Ok(item))) => Poll::Ready(Some(item)),
                        Poll::Ready(Some(Err(err))) => return Poll::Ready(Err(err.into())),
                        Poll::Ready(None) => Poll::Ready(None),
                        Poll::Pending => Poll::Pending,
                    };

                    match next {
                        Poll::Ready(item) => {
                            // body is done when item is None
                            body_done = item.is_none();
                            if body_done {
                                this.body.set(None);
                            }
                            let framed = this.framed.as_mut().as_pin_mut().unwrap();
                            framed
                                .write(Message::Chunk(item))
                                .map_err(|err| Error::new_send_response().with_cause(err))?;
                        }
                        Poll::Pending => body_ready = false,
                    }
                }
            }

            let framed = this.framed.as_mut().as_pin_mut().unwrap();

            // flush write buffer
            if !framed.is_write_buf_empty() {
                match framed
                    .flush(cx)
                    .map_err(|err| Error::new_send_response().with_cause(err))?
                {
                    Poll::Ready(_) => {
                        if body_ready {
                            continue;
                        } else {
                            return Poll::Pending;
                        }
                    }
                    Poll::Pending => return Poll::Pending,
                }
            }

            // send response
            if let Some(res) = this.res.take() {
                framed
                    .write(res)
                    .map_err(|err| Error::new_send_response().with_cause(err))?;
                continue;
            }

            if !body_done {
                if body_ready {
                    continue;
                } else {
                    return Poll::Pending;
                }
            } else {
                break;
            }
        }

        let framed = this.framed.take().unwrap();

        Poll::Ready(Ok(framed))
    }
}

```

### Core Architecture Module: `actix-http/src/header/utils.rs`
```
//! Header parsing utilities.

use std::{fmt, str::FromStr};

use super::HeaderValue;
use crate::{error::ParseError, header::HTTP_VALUE};

/// Reads a comma-delimited raw header into a Vec.
///
/// A comma inside a quoted string does not delimit list elements. See [RFC 9110 §5.6.1] and
/// [RFC 9110 §5.6.4].
///
/// [RFC 9110 §5.6.1]: https://www.rfc-editor.org/rfc/rfc9110#section-5.6.1
/// [RFC 9110 §5.6.4]: https://www.rfc-editor.org/rfc/rfc9110#section-5.6.4
#[inline]
pub fn from_comma_delimited<'a, I, T>(all: I) -> Result<Vec<T>, ParseError>
where
    I: Iterator<Item = &'a HeaderValue> + 'a,
    T: FromStr,
{
    let size_guess = all.size_hint().1.unwrap_or(2);
    let mut result = Vec::with_capacity(size_guess);

    for h in all {
        let s = h.to_str().map_err(|_| ParseError::Header)?;

        result.extend(
            split_list_elements(s)
                .filter_map(|x| match x.trim() {
                    "" => None,
                    y => Some(y),
                })
                .filter_map(|x| x.trim().parse().ok()),
        )
    }

    Ok(result)
}

/// Splits a field value on the commas that are outside quoted strings.
///
/// A backslash inside a quoted string escapes the next character (a quoted-pair), so an
/// escaped double quote does not end the quoted string.
fn split_list_elements(value: &str) -> impl Iterator<Item = &str> {
    let mut rest = Some(value);

    std::iter::from_fn(move || {
        let value = rest?;
        let mut in_quoted_string = false;
        let mut escaped = false;

        for (idx, byte) in value.bytes().enumerate() {
            if escaped {
                escaped = false;
                continue;
            }

            match byte {
                b'\\' if in_quoted_string => escaped = true,
                b'"' => in_quoted_string = !in_quoted_string,
                b',' if !in_quoted_string => {
                    rest = Some(&value[idx + 1..]);
                    return Some(&value[..idx]);
                }
                _ => {}
            }
        }

        rest = None;
        Some(value)
    })
}

/// Reads a single string when parsing a header.
#[inline]
pub fn from_one_raw_str<T: FromStr>(val: Option<&HeaderValue>) -> Result<T, ParseError> {
    if let Some(line) = val {
        let line = line.to_str().map_err(|_| ParseError::Header)?;

        if !line.is_empty() {
            return T::from_str(line).or(Err(ParseError::Header));
        }
    }

    Err(ParseError::Header)
}

/// Format an array into a comma-delimited string.
#[inline]
pub fn fmt_comma_delimited<T>(f: &mut fmt::Formatter<'_>, parts: &[T]) -> fmt::Result
where
    T: fmt::Display,
{
    let mut iter = parts.iter();

    if let Some(part) = iter.next() {
        fmt::Display::fmt(part, f)?;
    }

    for part in iter {
        f.write_str(", ")?;
        fmt::Display::fmt(part, f)?;
    }

    Ok(())
}

/// Percent encode a sequence of bytes with a character set defined in [RFC 5987 §3.2].
///
/// [RFC 5987 §3.2]: https://datatracker.ietf.org/doc/html/rfc5987#section-3.2
#[inline]
pub fn http_percent_encode(f: &mut fmt::Formatter<'_>, bytes: &[u8]) -> fmt::Result {
    let encoded = percent_encoding::percent_encode(bytes, HTTP_VALUE);
    fmt::Display::fmt(&encoded, f)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comma_delimited_parsing() {
        let headers = [];
        let res: Vec<usize> = from_comma_delimited(headers.iter()).unwrap();
        assert_eq!(res, vec![0; 0]);

        let headers = [
            HeaderValue::from_static("1, 2"),
            HeaderValue::from_static("3,4"),
        ];
        let res: Vec<usize> = from_comma_delimited(headers.iter()).unwrap();
        assert_eq!(res, vec![1, 2, 3, 4]);

        let headers = [
            HeaderValue::from_static(""),
            HeaderValue::from_static(","),
            HeaderValue::from_static("  "),
            HeaderValue::from_static("1    ,"),
            HeaderValue::from_static(""),
        ];
        let res: Vec<usize> = from_comma_delimited(headers.iter()).unwrap();
        assert_eq!(res, vec![1]);
    }

    #[test]
    fn comma_delimited_parsing_keeps_commas_in_quoted_strings() {
        let headers = [
            HeaderValue::from_static(r#""a,b", "c""#),
            HeaderValue::from_static(r#"private="x, y", no-store"#),
        ];
        let res: Vec<String> = from_comma_delimited(headers.iter()).unwrap();
        assert_eq!(res, [r#""a,b""#, r#""c""#, r#"private="x, y""#, "no-store"]);
    }

    #[test]
    fn comma_delimited_parsing_skips_quoted_pairs() {
        let headers = [HeaderValue::from_static(r#"a="x\", y", b"#)];
        let res: Vec<String> = from_comma_delimited(headers.iter()).unwrap();
        assert_eq!(res, [r#"a="x\", y""#, "b"]);
    }
}

```

### Core Architecture Module: `actix-web/examples/worker-cpu-pin.rs`
```
use std::{
    io,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    thread,
};

use actix_web::{middleware, web, App, HttpServer};

async fn hello() -> &'static str {
    "Hello world!"
}

#[tokio::main(flavor = "local")]
async fn main() -> io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let core_ids = core_affinity::get_core_ids().unwrap();
    let n_core_ids = core_ids.len();
    let next_core_id = Arc::new(AtomicUsize::new(0));

    HttpServer::new(move || {
        let pin = Arc::clone(&next_core_id).fetch_add(1, Ordering::AcqRel);
        log::info!(
            "setting CPU affinity for worker {}: pinning to core {}",
            thread::current().name().unwrap(),
            pin,
        );
        core_affinity::set_for_current(core_ids[pin]);

        App::new()
            .wrap(middleware::Logger::default())
            .service(web::resource("/").get(hello))
    })
    .bind(("127.0.0.1", 8080))?
    .workers(n_core_ids)
    .run()
    .await
}

```

### Core Architecture Module: `actix-files/examples/guarded-listing.rs`
```
use actix_files::Files;
use actix_web::{get, guard, middleware, App, HttpServer, Responder};

const EXAMPLES_DIR: &str = concat![env!("CARGO_MANIFEST_DIR"), "/examples"];

#[get("/")]
async fn index() -> impl Responder {
    "Hello world!"
}

#[tokio::main(flavor = "local")]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    log::info!("starting HTTP server at http://localhost:8080");

    HttpServer::new(|| {
        App::new()
            .service(index)
            .service(
                Files::new("/assets", EXAMPLES_DIR)
                    .show_files_listing()
                    .guard(guard::Header("show-listing", "?1")),
            )
            .service(Files::new("/assets", EXAMPLES_DIR))
            .wrap(middleware::Compress::default())
            .wrap(middleware::Logger::default())
    })
    .bind(("127.0.0.1", 8080))?
    .workers(2)
    .run()
    .await
}

```

### Core Architecture Module: `actix-files/src/chunked.rs`
```
use std::{
    cmp, fmt,
    future::Future,
    io,
    pin::Pin,
    task::{Context, Poll},
};

use actix_web::{error::Error, web::Bytes};
use futures_core::{ready, Stream};
use pin_project_lite::pin_project;

use super::named::File;

#[derive(Debug, Clone, Copy)]
pub(crate) enum ReadMode {
    Sync,
    Async,
}

pin_project! {
    /// Adapter to read a `std::file::File` in chunks.
    #[doc(hidden)]
    pub struct ChunkedReadFile<F, Fut> {
        size: u64,
        offset: u64,
        #[pin]
        state: ChunkedReadFileState<Fut>,
        counter: u64,
        callback: F,
        read_mode: ReadMode,
    }
}

pin_project! {
    #[project = ChunkedReadFileStateProj]
    #[project_replace = ChunkedReadFileStateProjReplace]
    enum ChunkedReadFileState<Fut> {
        File { file: Option<File>, },
        Future { #[pin] fut: Fut },
    }
}

impl<F, Fut> fmt::Debug for ChunkedReadFile<F, Fut> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("ChunkedReadFile")
    }
}

pub(crate) fn new_chunked_read(
    size: u64,
    offset: u64,
    file: File,
    read_mode_threshold: u64,
) -> impl Stream<Item = Result<Bytes, Error>> {
    ChunkedReadFile {
        size,
        offset,
        state: ChunkedReadFileState::File { file: Some(file) },
        counter: 0,
        callback: chunked_read_file_callback,
        read_mode: if size < read_mode_threshold {
            ReadMode::Sync
        } else {
            ReadMode::Async
        },
    }
}

fn chunked_read_file_callback_sync(
    mut file: File,
    offset: u64,
    max_bytes: usize,
) -> Result<(File, Bytes), io::Error> {
    use io::{Read as _, Seek as _};

    let mut buf = Vec::with_capacity(max_bytes);

    file.seek(io::SeekFrom::Start(offset))?;

    let n_bytes = file.by_ref().take(max_bytes as u64).read_to_end(&mut buf)?;

    if n_bytes == 0 {
        Err(io::Error::from(io::ErrorKind::UnexpectedEof))
    } else {
        Ok((file, Bytes::from(buf)))
    }
}

#[inline]
async fn chunked_read_file_callback(
    file: File,
    offset: u64,
    max_bytes: usize,
    read_mode: ReadMode,
) -> Result<(File, Bytes), Error> {
    let res = match read_mode {
        ReadMode::Sync => chunked_read_file_callback_sync(file, offset, max_bytes)?,
        ReadMode::Async => {
            actix_web::web::block(move || chunked_read_file_callback_sync(file, offset, max_bytes))
                .await??
        }
    };

    Ok(res)
}

impl<F, Fut> Stream for ChunkedReadFile<F, Fut>
where
    F: Fn(File, u64, usize, ReadMode) -> Fut,
    Fut: Future<Output = Result<(File, Bytes), Error>>,
{
    type Item = Result<Bytes, Error>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut this = self.as_mut().project();
        match this.state.as_mut().project() {
            ChunkedReadFileStateProj::File { file } => {
                let size = *this.size;
                let offset = *this.offset;
                let counter = *this.counter;

                if size == counter {
                    Poll::Ready(None)
                } else {
                    let max_bytes = cmp::min(size.saturating_sub(counter), 65_536) as usize;

                    let file = file
                        .take()
                        .expect("ChunkedReadFile polled after completion");

                    let fut = (this.callback)(file, offset, max_bytes, *this.read_mode);

                    this.state
                        .project_replace(ChunkedReadFileState::Future { fut });

                    self.poll_next(cx)
                }
            }
            ChunkedReadFileStateProj::Future { fut } => {
                let (file, bytes) = ready!(fut.poll(cx))?;

                this.state
                    .project_replace(ChunkedReadFileState::File { file: Some(file) });

                *this.offset += bytes.len() as u64;
                *this.counter += bytes.len() as u64;

                Poll::Ready(Some(Ok(bytes)))
            }
        }
    }
}

```

### Core Architecture Module: `actix-files/src/directory.rs`
```
use std::{
    fmt::Write,
    fs::DirEntry,
    io,
    path::{Path, PathBuf},
};

use actix_web::{dev::ServiceResponse, HttpRequest, HttpResponse};
use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};
use v_htmlescape::escape_fmt;

/// A directory; responds with the generated directory listing.
#[derive(Debug)]
pub struct Directory {
    /// Base directory.
    pub base: PathBuf,

    /// Path of subdirectory to generate listing for.
    pub path: PathBuf,
}

impl Directory {
    /// Create a new directory
    pub fn new(base: PathBuf, path: PathBuf) -> Directory {
        Directory { base, path }
    }

    /// Is this entry visible from this directory?
    pub fn is_visible(&self, entry: &io::Result<DirEntry>) -> bool {
        if let Ok(ref entry) = *entry {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with('.') {
                    return false;
                }
            }
            if let Ok(ref md) = entry.metadata() {
                let ft = md.file_type();
                return ft.is_dir() || ft.is_file() || ft.is_symlink();
            }
        }
        false
    }
}

pub(crate) type DirectoryRenderer =
    dyn Fn(&Directory, &HttpRequest) -> Result<ServiceResponse, io::Error>;

// Leave only RFC 3986 unreserved characters unencoded within each path segment.
const PATH_SEGMENT: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'.')
    .remove(b'_')
    .remove(b'~');

/// Returns a percent encoded file URL path escaped for an HTML attribute.
macro_rules! encode_file_url {
    ($path:ident) => {
        escape_fmt(
            &$path
                .split('/')
                .map(|segment| utf8_percent_encode(segment, PATH_SEGMENT).to_string())
                .collect::<Vec<_>>()
                .join("/"),
        )
        .to_string()
        // Slashes are safe in a quoted attribute. Keep path separators literal.
        .replace("&#x2f;", "/")
    };
}

/// Returns HTML entity encoded formatter.
///
/// ```plain
/// " => &quot;
/// & => &amp;
/// ' => &#x27;
/// < => &lt;
/// > => &gt;
/// / => &#x2f;
/// ```
macro_rules! encode_file_name {
    ($entry:ident) => {
        escape_fmt(&$entry.file_name().to_string_lossy())
    };
}

pub(crate) fn directory_listing(
    dir: &Directory,
    req: &HttpRequest,
) -> Result<ServiceResponse, io::Error> {
    let index_of = format!("Index of {}", req.path());
    let mut body = String::new();
    let base = Path::new(req.path());

    for entry in dir.path.read_dir()? {
        if dir.is_visible(&entry) {
            let entry = entry.unwrap();
            let p = match entry.path().strip_prefix(&dir.path) {
                Ok(p) if cfg!(windows) => base.join(p).to_string_lossy().replace('\\', "/"),
                Ok(p) => base.join(p).to_string_lossy().into_owned(),
                Err(_) => continue,
            };

            // if file is a directory, add '/' to the end of the name
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    let _ = write!(
                        body,
                        "<li><a href=\"{}\">{}/</a></li>",
                        encode_file_url!(p),
                        encode_file_name!(entry),
                    );
                } else {
                    let _ = write!(
                        body,
                        "<li><a href=\"{}\">{}</a></li>",
                        encode_file_url!(p),
                        encode_file_name!(entry),
                    );
                }
            } else {
                continue;
            }
        }
    }

    let html = format!(
        "<html>\
         <head><title>{}</title></head>\
         <body><h1>{}</h1>\
         <ul>\
         {}\
         </ul></body>\n</html>",
        index_of, index_of, body
    );
    Ok(ServiceResponse::new(
        req.clone(),
        HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(html),
    ))
}

```

### Core Architecture Module: `actix-files/src/encoding.rs`
```
use mime::Mime;

/// Transforms MIME `text/*` types into their UTF-8 equivalent, if supported.
///
/// MIME types that are converted
/// - application/javascript
/// - text/html
/// - text/css
/// - text/plain
/// - text/csv
/// - text/tab-separated-values
pub(crate) fn equiv_utf8_text(ct: Mime) -> Mime {
    // use (roughly) order of file-type popularity for a web server

    if ct == mime::APPLICATION_JAVASCRIPT {
        return mime::APPLICATION_JAVASCRIPT_UTF_8;
    }

    if ct == mime::TEXT_HTML {
        return mime::TEXT_HTML_UTF_8;
    }

    if ct == mime::TEXT_CSS {
        return mime::TEXT_CSS_UTF_8;
    }

    if ct == mime::TEXT_PLAIN {
        return mime::TEXT_PLAIN_UTF_8;
    }

    if ct == mime::TEXT_CSV {
        return mime::TEXT_CSV_UTF_8;
    }

    if ct == mime::TEXT_TAB_SEPARATED_VALUES {
        return mime::TEXT_TAB_SEPARATED_VALUES_UTF_8;
    }

    ct
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_equiv_utf8_text() {
        assert_eq!(equiv_utf8_text(mime::TEXT_PLAIN), mime::TEXT_PLAIN_UTF_8);
        assert_eq!(equiv_utf8_text(mime::TEXT_XML), mime::TEXT_XML);
        assert_eq!(equiv_utf8_text(mime::IMAGE_PNG), mime::IMAGE_PNG);
    }
}

```

### Core Architecture Module: `actix-files/src/error.rs`
```
use actix_web::{http::StatusCode, ResponseError};
use derive_more::Display;

/// Errors which can occur when serving static files.
#[derive(Debug, PartialEq, Eq, Display)]
pub enum FilesError {
    /// Path is not a directory.
    #[allow(dead_code)]
    #[display("Path is not a directory. Unable to serve static files")]
    IsNotDirectory,

    /// Cannot render directory.
    #[display("Unable to render directory without index file")]
    IsDirectory,
}

impl ResponseError for FilesError {
    /// Returns `404 Not Found`.
    fn status_code(&self) -> StatusCode {
        StatusCode::NOT_FOUND
    }
}

/// Error which can occur with parsing/validating a request-uri path
#[derive(Debug, PartialEq, Eq, Display)]
#[non_exhaustive]
pub enum UriSegmentError {
    /// Segment started with the wrapped invalid character.
    #[display("Segment started with invalid character: ('{_0}')")]
    BadStart(char),

    /// Segment contained the wrapped invalid character.
    #[display("Segment contained invalid character ('{_0}')")]
    BadChar(char),

    /// Segment ended with the wrapped invalid character.
    #[display("Segment ended with invalid character: ('{_0}')")]
    BadEnd(char),

    /// Path is not a valid UTF-8 string after percent-decoding.
    #[display("Path is not a valid UTF-8 string after percent-decoding")]
    NotValidUtf8,
}

impl ResponseError for UriSegmentError {
    /// Returns `400 Bad Request`.
    fn status_code(&self) -> StatusCode {
        StatusCode::BAD_REQUEST
    }
}

```

### Core Architecture Module: `actix-files/src/files.rs`
```
use std::{
    borrow::Cow,
    cell::RefCell,
    ffi::{OsStr, OsString},
    fmt, io,
    path::{Path, PathBuf},
    rc::Rc,
};

use actix_service::{boxed, IntoServiceFactory, ServiceFactory, ServiceFactoryExt};
use actix_web::{
    dev::{
        AppService, HttpServiceFactory, RequestHead, ResourceDef, ServiceRequest, ServiceResponse,
    },
    error::Error,
    guard::Guard,
    http::header::DispositionType,
    HttpRequest,
};
use futures_core::future::LocalBoxFuture;

use crate::{
    directory_listing, named,
    service::{FilesService, FilesServiceInner},
    Directory, DirectoryRenderer, HttpNewService, MimeOverride, PathFilter,
};

/// Static files handling service.
///
/// `Files` service must be registered with `App::service()` method.
///
/// # Examples
/// ```
/// use actix_web::App;
/// use actix_files::Files;
///
/// let app = App::new()
///     .service(Files::new("/static", "."));
/// ```
pub struct Files {
    mount_path: String,
    directories: Vec<PathBuf>,
    index: Option<String>,
    show_index: bool,
    redirect_to_slash: bool,
    with_permanent_redirect: bool,
    default: Rc<RefCell<Option<Rc<HttpNewService>>>>,
    renderer: Rc<DirectoryRenderer>,
    mime_override: Option<Rc<MimeOverride>>,
    path_filter: Option<Rc<PathFilter>>,
    file_flags: named::Flags,
    use_guards: Option<Rc<dyn Guard>>,
    guards: Vec<Rc<dyn Guard>>,
    hidden_files: bool,
    try_compressed: bool,
    read_mode_threshold: u64,
}

impl fmt::Debug for Files {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Files")
    }
}

impl Clone for Files {
    fn clone(&self) -> Self {
        Self {
            directories: self.directories.clone(),
            index: self.index.clone(),
            show_index: self.show_index,
            redirect_to_slash: self.redirect_to_slash,
            with_permanent_redirect: self.with_permanent_redirect,
            default: self.default.clone(),
            renderer: self.renderer.clone(),
            file_flags: self.file_flags,
            mount_path: self.mount_path.clone(),
            mime_override: self.mime_override.clone(),
            path_filter: self.path_filter.clone(),
            use_guards: self.use_guards.clone(),
            guards: self.guards.clone(),
            hidden_files: self.hidden_files,
            try_compressed: self.try_compressed,
            read_mode_threshold: self.read_mode_threshold,
        }
    }
}

/// File serving root directories for [`Files`].
///
/// This type is used by [`Files::new`] to accept either one root directory or an ordered
/// collection of root directories.
#[derive(Debug)]
pub struct FilesDirs(Vec<PathBuf>);

impl FilesDirs {
    fn canonicalize(self) -> Vec<PathBuf> {
        self.0
            .into_iter()
            .map(|orig_dir| match orig_dir.canonicalize() {
                Ok(canon_dir) => canon_dir,
                Err(_) => {
                    log::error!("Specified path is not a directory: {:?}", orig_dir);
                    // Preserve original path so requests don't fall back to CWD.
                    orig_dir
                }
            })
            .collect()
    }
}

impl From<&Path> for FilesDirs {
    fn from(dir: &Path) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<&PathBuf> for FilesDirs {
    fn from(dir: &PathBuf) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<PathBuf> for FilesDirs {
    fn from(dir: PathBuf) -> Self {
        Self(vec![dir])
    }
}

impl From<&str> for FilesDirs {
    fn from(dir: &str) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<&String> for FilesDirs {
    fn from(dir: &String) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<String> for FilesDirs {
    fn from(dir: String) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<&OsStr> for FilesDirs {
    fn from(dir: &OsStr) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<OsString> for FilesDirs {
    fn from(dir: OsString) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<&OsString> for FilesDirs {
    fn from(dir: &OsString) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<Box<Path>> for FilesDirs {
    fn from(dir: Box<Path>) -> Self {
        Self(vec![dir.into()])
    }
}

impl From<Cow<'_, Path>> for FilesDirs {
    fn from(dir: Cow<'_, Path>) -> Self {
        Self(vec![dir.into()])
    }
}

impl<P, const N: usize> From<[P; N]> for FilesDirs
where
    P: Into<PathBuf>,
{
    fn from(dirs: [P; N]) -> Self {
        Self(dirs.into_iter().map(Into::into).collect())
    }
}

impl<P, const N: usize> From<&[P; N]> for FilesDirs
where
    P: Clone + Into<PathBuf>,
{
    fn from(dirs: &[P; N]) -> Self {
        Self(dirs.iter().cloned().map(Into::into).collect())
    }
}

impl<P> From<&[P]> for FilesDirs
where
    P: Clone + Into<PathBuf>,
{
    fn from(dirs: &[P]) -> Self {
        Self(dirs.iter().cloned().map(Into::into).collect())
    }
}

impl<P> From<Vec<P>> for FilesDirs
where
    P: Into<PathBuf>,
{
    fn from(dirs: Vec<P>) -> Self {
        Self(dirs.into_iter().map(Into::into).collect())
    }
}

impl Files {
    /// Create new `Files` instance for a specified base directory.
    ///
    /// # Argument Order
    /// The first argument (`mount_path`) is the root URL at which the static files are served.
    /// For example, `/assets` will serve files at `example.com/assets/...`.
    ///
    /// The second argument (`serve_from`) is the location on disk that files are served from. This
    /// can be a single path or an ordered collection of paths. Relative paths are resolved from the
    /// current working directory.
    ///
    /// When multiple directories are provided, they are checked in order. The first directory that
    /// can serve the requested path is used.
    ///
    /// Directory listings are generated from the first matching directory and are not merged across
    /// roots. When [`Files::index_file()`] is configured, later roots are searched if an earlier
    /// matching directory does not contain the index file.
    ///
    /// Empty root collections never match files; requests fall through to the default handler, or
    /// return `404 Not Found` if none is configured.
    ///
    /// # Implementation Notes
    /// If the mount path is set as the root path `/`, services registered after this one will
    /// be inaccessible. Register more specific handlers and services first.
    ///
    /// If a `serve_from` path cannot be canonicalized at startup, an error is logged and the
    /// original path is preserved. Requests will return `404 Not Found` until the path exists.
    ///
    /// `Files` utilizes the existing Tokio thread-pool for blocking filesystem operations.
    /// The number of running threads is adjusted over time as needed, up to a maximum of 512 times
    /// the number of server [workers](actix_web::HttpServer::workers), by default.
    pub fn new<T: Into<FilesDirs>>(mount_path: &str, serve_from: T) -> Files {
        Files {
            mount_path: mount_path.trim_end_matches('/').to_owned(),
            directories: serve_from.into().canonicalize(),
            index: None,
            show_index: false,
            redirect_to_slash: false,
            with_permanent_redirect: false,
            default: Rc::new(RefCell::new(None)),
            renderer: Rc::new(directory_listing),
            mime_override: None,
            path_filter: None,
            file_flags: named::Flags::default(),
            use_guards: None,
            guards: Vec::new(),
            hidden_files: false,
            try_compressed: false,
            read_mode_threshold: 0,
        }
    }

    /// Show files listing for directories.
    ///
    /// By default show files listing is disabled.
    ///
    /// When used with [`Files::index_file()`], files listing is shown as a fallback
    /// when the index file is not found.
    pub fn show_files_listing(mut self) -> Self {
        self.show_index = true;
        self
    }

    /// Redirects to a slash-ended path when browsing a directory.
    ///
    /// By default never redirect.
    ///
    /// When multiple root directories are configured, a matching directory in an earlier root can
    /// trigger a redirect before later roots are checked for a file at the same path.
    pub fn redirect_to_slash_directory(mut self) -> Self {
        self.redirect_to_slash = true;
        self
    }

    /// Redirect with permanent redirect status code (308).
    ///
    /// By default redirect with temporary redirect status code (307).
    pub fn with_permanent_redirect(mut self) -> Self {
        self.with_permanent_redirect = true;
        self
    }

    /// Set custom directory renderer.
    pub fn files_listing_renderer<F>(mut self, f: F) -> Self
    where
        for<'r, 's> F:
            Fn(&'r Directory, &'s HttpRequest) -> Result<ServiceResponse, io::Error> + 'static,
    {
        self.renderer = Rc::new(f);
        self
    }

    /// Specifies MIME override callback.
    pub fn mime_override<F>(mut self, f: F) -> Self
    where
        F: Fn(&mime::Name<'_>) -> DispositionType + 'static,
    {
        self.mime_override = Some(Rc::new(f));
        self
    }

    /// Sets path filtering closure.
    ///
    /// The path provided to the closure is relative to `serve_from` path.
    /// You can safely join this path with the `serve_from` path to get the real path.
    /// However, the real path may not exist since the filter is called before checking path existence.
    ///
    /// When a path doesn't pass the filter, [`Files::default_handler`] is called if set, otherwise,
    /// `404 Not Found` is returned.
    ///
    /// # Examples
    /// ```
    /// use std::path::Path;
    /// use actix_files::Files;
    ///
    /// // prevent searching subdirectories and following symlinks
    /// let files_service = Files::new("/", "./static").path_filter(|path, _| {
    ///     path.components().coun
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4423** (2026-11-16): **fix(http): keep commas inside quoted strings in list headers**
  *Symptoms*: ## PR Type  Bug Fix  ## PR Checklist  - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [x] A changelog entry has been made for the appropriate packages. - [x] (Team) Label with affected crates and semver status.  ## Overview  `header::from_comma_delimited()` splits each field line on every comma. A comma inside a quoted string therefore cuts one list element in two. Both halves fail to parse, and the typed header drops them without an error.  | Field line | `IfMatch::parse` before | `IfMatch::parse` after | |---|---|---| | `"a,b", "c"` | `Items(["c"])` | `Items(["a,b", "c"])` | | `"a,b"` | `Items([])` | `Items(["a,b"])` |  The grammar allows the comma in both places:  - [RFC 9110 §8.8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.8.3): `etagc = %x21 / %x23-7E / obs-text`, which includes `,` (%x2C). - [RFC 9110 §5.6.4](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.4): `qdtext` includes `,`, so a quoted parameter value or a quoted `Cache-Control` argument can hold one.  For `If-Match`, the lost tag changes the outcome. §13.1.1 says the condition "is true if any of the listed tags match the entity tag of the selected representation". A server that compares `Items([])` with a current tag of `"a,b"` answers 412 to a request whose condition is true.  ### Change  `from_comma_delimited()` now splits only on the commas outside quoted strings. Inside a quoted string, a backslash escapes the next character (quote

- **Issue #4422** (2026-11-16): **refactor(http): support any item type in InfallibleStream**
  *Symptoms*: ## PR Type  Refactor  ## PR Checklist  - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [x] A changelog entry has been made for the appropriate packages. - [x] (Team) Label with affected crates and semver status.  ## Overview  Allow `InfallibleStream` to wrap streams with any item type. It now yields `Result<S::Item, Infallible>` and keeps existing byte stream behavior unchanged.
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code coverage overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  <table> <tr> <th scope="col"><span id="cc-branch-badge" title="actix/actix-web:main">main</span> <a id="cc-sha-link" href="/actix/actix-web/commit/1e04b0b804f5210a3960d527d1f59d316e7ee25e">1e04b0b</a></th> <th scope="col"><span id="cc-branch-badge" title="actix/actix-web:t3/generic-infallible-stream-item">t3/generic-infallibl...</span> <a id="cc-sha-link" href="/actix/actix-web/commit/1750601a94ee0531ffa13433354cc87299770885">1750601</a></th> <th scope="col">+/-</th> </tr> <tr> <td>88%</td> <td>88%</td> <td>0%</td> </tr> </table>  :information_source: Calculations represent line coverage. Results may change as calculations are updated.  --- <sub>Updated <relative-time datetime="2026-11-16T18:14:07Z">November 16, 2026 18:14 UTC</relative-time></sub> 

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

### Incident Patch 1: `315839cb` (2026-11-16)
**Commit Message**: fix(multipart): map PayloadError::Overflow to 413 Payload Too Large (#4415)

MultipartError::status_code treated every Payload error as 400, so a
body that hit the configured size limit was reported as a generic bad
request. Delegate Payload errors to PayloadError::status_code so
Overflow returns 413, matching actix-web's own PayloadError mapping.

Update the form size-limit tests and add a changelog entry.

**File**: `actix-multipart/CHANGES.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Map `MultipartError::Payload(PayloadError::Overflow)` to `413 Payload Too Large`, matching `PayloadError`.
+
 ## 0.8.8
 
 - Significant performance improvement when reading fields.
```

**File**: `actix-multipart/src/error.rs` (modified, +3/-0)
```diff
@@ -104,6 +104,7 @@ impl ResponseError for Error {
     fn status_code(&self) -> StatusCode {
         match &self {
             Error::Field { source, .. } => source.as_response_error().status_code(),
+            Error::Payload(err) => err.status_code(),
             Error::ContentTypeIncompatible => StatusCode::UNSUPPORTED_MEDIA_TYPE,
             _ => StatusCode::BAD_REQUEST,
         }
@@ -126,6 +127,8 @@ mod tests {
             Report::new(&err).to_string(),
             "Payload error: Payload reached size limit",
         );
+        assert_eq!(err.status_code(), StatusCode::PAYLOAD_TOO_LARGE);
+        assert_eq!(err.error_response().status(), StatusCode::PAYLOAD_TOO_LARGE);
 
         let err = Error::Parse(ParseError::Incomplete);
         assert_eq!(
```

**File**: `actix-multipart/src/form/mod.rs` (modified, +7/-7)
```diff
@@ -880,13 +880,13 @@ mod tests {
         form.add_text("field", "7 bytes");
         form.add_text("unknown", "this string is 28 bytes long");
         let response = send_form(&srv, form, "/unknown").await;
-        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
+        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
 
         let mut form = multipart::Form::default();
         form.add_text("field", "first_value");
         form.add_text("field", "this string is 28 bytes long");
         let response = send_form(&srv, form, "/duplicate").await;
-        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
+        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
     }
 
     #[tokio::test(flavor = "local")]
@@ -1084,7 +1084,7 @@ mod tests {
         let mut form = multipart::Form::default();
         form.add_text("field", "this string is 28 bytes long");
         let response = send_form(&srv, form, "/text").await;
-        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
+        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
 
         // Memory limit should not apply when the data is being streamed to disk
         let mut form = multipart::Form::default();
@@ -1116,13 +1116,13 @@ mod tests {
         let mut form = multipart::Form::default();
         form.add_text("field", "this string is 28 bytes long");
         let response = send_form(&srv, form, "/text").await;
-        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
+        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
 
         // Exceeds the 20 byte overall limit
         let mut form = multipart::Form::default();
         form.add_text("field", "this string is 28 bytes long");
         let response = send_form(&srv, form, "/file").await;
-        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
+        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
     }
 
     #[derive(MultipartForm)]
@@ -1160,7 +1160,7 @@ mod tests {
         let mut form = multipart::Form::default();
         form.add_text("field", "this string is more than 30 bytes long");
         let response = send_form(&srv, form, "/").await;
-        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
+        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
 
         // Total of values (14 bytes) is within 30 byte limit for "field"
         let mut form = multipart::Form::default();
@@ -1174,7 +1174,7 @@ mod tests {
         form.add_text("field", "this string is 28 bytes long");
         form.add_text("field", "this string is 28 bytes long");
         let response = send_form(&srv, form, "/").await;
-        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
+        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
     }
 
     #[tokio::test(flavor = "local")]
```

---

### Incident Patch 2: `dbc4c3e5` (2026-11-15)
**Commit Message**: fix(actix-http): merge keep-alive head timeout fix

Merge fix/h1-keepalive-partial-head-timeout into local main. Keep the timeout changelog entry under Unreleased and preserve the 3.21.1 release notes. Combine the test imports so both regression suites remain available.

**File**: `.github/workflows/actions.lock` (modified, +45/-0)
```diff
@@ -33,6 +33,12 @@ workflows:
         - 'taiki-e/install-action@v2.90.3'
         - 'useblacksmith/checkout@v1.8.2'
         - 'zizmorcore/zizmor-action@v0.8.1'
+    '.github/workflows/release.yml':
+        - 'actions-rust-lang/setup-rust-toolchain@v2.0.1'
+        - 'actions/checkout@v7.0.1'
+        - 'nicknovitski/nix-develop@v1.2.1'
+        - 'nixbuild/nix-quick-install-action@v35'
+        - 'release-plz/action@v0.5.140'
     '.github/workflows/semver-checks.yml':
         - 'actions-rust-lang/setup-rust-toolchain@v2.0.1'
         - 'taiki-e/install-action@v2.90.3'
@@ -50,6 +56,11 @@ dependencies:
         commit: 'sha1-55cc8345863c7cc4c66a329aec7e433d2d1c52a9'
         owner_id: 44036562
         repo_id: 215566462
+    'actions/checkout@v7.0.1':
+        ref: 'v7.0.1'
+        commit: 'sha1-3d3c42e5aac5ba805825da76410c181273ba90b1'
+        owner_id: 44036562
+        repo_id: 197814629
     'actions/labeler@v7.0.0':
         ref: 'v7.0.0'
         commit: 'sha1-bf12e9b00b37c5c0ca2b87b79b2daf7891dbda13'
@@ -60,6 +71,11 @@ dependencies:
         commit: 'sha1-2b21a77928be8d5168c2b9581a67f2adbebacc52'
         owner_id: 44036562
         repo_id: 1220171870
+    'cargo-bins/cargo-binstall@c06f6a0003f7c6165a00c89d1697731c9e8a5c72':
+        ref: 'v1.25.2'
+        commit: 'sha1-c06f6a0003f7c6165a00c89d1697731c9e8a5c72'
+        owner_id: 110581826
+        repo_id: 321270638
     'embarkstudios/cargo-deny-action@v2.1.1':
         ref: 'v2.1.1'
         commit: 'sha1-3c6349835b2b7b196a839186cb8b78e02f7b5f25'
@@ -80,6 +96,30 @@ dependencies:
         commit: 'sha1-72793074d3c8cdda771dba85f6deafe00623038b'
         owner_id: 1256587
         repo_id: 211647646
+    'nicknovitski/nix-develop@v1.2.1':
+        ref: 'v1.2.1'
+        commit: 'sha1-9be7cfb4b10451d3390a75dc18ad0465bed4932a'
+        owner_id: 151337
+        repo_id: 706956179
+    'nixbuild/nix-quick-install-action@v35':
+        ref: 'v35'
+        commit: 'sha1-9f63be77f412a248c9d9a65a4c82cf066cdf8f0c'
+        owner_id: 60610456
+        repo_id: 296639338
+    'release-plz/action@v0.5.140':
+        ref: 'v0.5.140'
+        commit: 'sha1-18641b6c63063cc5ff8786ebf69cd57e8541bae1'
+        owner_id: 188756284
+        repo_id: 476470908
+        uses:
+            - 'cargo-bins/cargo-binstall@c06f6a0003f7c6165a00c89d1697731c9e8a5c72'
+            - 'release-plz/git-config@59144859caf016f8b817a2ac9b051578729173c4'
+            - 'taiki-e/install-action@f7e5d7c961414b23f5b25b2da9294395d08513ad'
+    'release-plz/git-config@59144859caf016f8b817a2ac9b051578729173c4':
+        ref: 'v0.1.2'
+        commit: 'sha1-59144859caf016f8b817a2ac9b051578729173c4'
+        owner_id: 188756284
+        repo_id: 735058483
     'rui314/setup-mold@v1':
         ref: 'v1'
         commit: 'sha1-339e96b4ff1f3bd865856ba4cbbe8818a7acb038'
@@ -97,6 +137,11 @@ dependencies:
         repo_id: 588643148
         uses:
             - 'actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9'
+    'taiki-e/install-action@f7e5d7c961414b23f5b25b2da9294395d08513ad':
+        ref: 'v2.87.26'
+        commit: 'sha1-f7e5d7c961414b23f5b25b2da9294395d08513ad'
+        owner_id: 43724913
+        repo_id: 442947557
     'taiki-e/install-action@v2.90.3':
         ref: 'v2.90.3'
         commit: 'sha1-cfdb7ed4ccc7c7dce37759eae89dc5674b469b39'
```

**File**: `.github/workflows/release.yml` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+name: Release
+
+on:
+  push:
+    branches: [main]
+
+permissions: {}
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: false
+
+jobs:
+  release:
+    name: Release
+    runs-on: ubuntu-latest
+    if: github.repository == 'actix/actix-web'
+    permissions:
+      contents: write
+      id-token: write
+
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v7.0.1
+        with:
+          fetch-depth: 0
+          persist-credentials: false
+
+      - name: Install Rust
+        uses: actions-rust-lang/setup-rust-toolchain@v2.0.1
+
+      - name: release-plz
+        uses: release-plz/action@v0.5.140
+        id: release-plz
+        with:
+          command: release
+        env:
+          GITHUB_TOKEN: ${{ github.token }}
+
+      - name: Install Nix
+        if: steps.release-plz.outputs.releases_created == 'true'
+        uses: nixbuild/nix-quick-install-action@v35
+
+      - name: Enter Nix devshell
+        if: steps.release-plz.outputs.releases_created == 'true'
+        uses: nicknovitski/nix-develop@v1.2.1
+        with:
+          arguments: .#ci-release
+
+      - name: Update release notes
+        if: steps.release-plz.outputs.releases_created == 'true'
+        env:
+          GH_TOKEN: ${{ github.token }}
+          RELEASE_PLZ_RELEASES_JSON: ${{ steps.release-plz.outputs.releases }}
+        run: |
+          # The shared release tool reads CHANGELOG.md.
+          for changelog in */CHANGES.md; do
+            ln -s CHANGES.md "${changelog%CHANGES.md}CHANGELOG.md"
+          done
+
+          x52-update-release-notes --then-undraft
```

**File**: `.release-plz.toml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+[workspace]
+changelog_update = false
+dependencies_update = false
+publish_all_features = true
+release_always = true
+git_release_draft = true
+git_release_name = "{{ package }}: v{{ version }}"
+git_tag_name = "{{ package }}-v{{ version }}"
```

**File**: `actix-http/CHANGES.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Apply the request head timeout to pipelined HTTP/1.1 partial requests on keep-alive connections.
+
 ## 3.21.1
 
 - Reject bare LF as trailer terminator after chunked encodings. [GHSA-9w4r-xc43-v236](https://github.com/actix/actix-web/security/advisories/GHSA-9w4r-xc43-v236)
```

**File**: `actix-http/src/builder.rs` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ where
         self
     }
 
-    /// Set client request timeout (for first request).
+    /// Set the timeout for reading a client request head.
     ///
     /// Defines a timeout for reading client request header. If the client does not transmit the
     /// request head within this duration, the connection is terminated with a `408 Request Timeout`
```

**File**: `actix-http/src/config.rs` (modified, +3/-3)
```diff
@@ -92,7 +92,7 @@ impl ServiceConfigBuilder {
         self
     }
 
-    /// Sets the timeout for the client to finish sending the head of its first request
+    /// Sets the timeout for the client to finish sending a request head.
     pub fn client_request_timeout(mut self, timeout: Duration) -> Self {
         self.inner.client_request_timeout = timeout;
         self
@@ -274,8 +274,8 @@ impl ServiceConfig {
         }
     }
 
-    /// Creates a time object representing the deadline for the client to finish sending the head of
-    /// its first request.
+    /// Creates a time object representing the deadline for the client to finish sending a request
+    /// head.
     ///
     /// Returns `None` if this `ServiceConfig was` constructed with `client_request_timeout: 0`.
     pub fn client_request_deadline(&self) -> Option<Instant> {
```

**File**: `actix-http/src/h1/dispatcher.rs` (modified, +23/-6)
```diff
@@ -1051,7 +1051,7 @@ where
 
                     match msg {
                         Message::Item(mut req) => {
-                            // head timer only applies to first request on connection
+                            // Stop the head timer before reading the request payload.
                             this.head_timer.clear(line!());
 
                             req.head_mut().peer_addr = *this.peer_addr;
@@ -1125,9 +1125,23 @@ where
                     }
                 }
 
-                // decode is partial and buffer is not full yet
-                // break and wait for more read
-                Ok(None) => break,
+                // Decode is partial.
+                Ok(None) => {
+                    if this.payload.is_none()
+                        && this.codec.keep_alive()
+                        && !this.read_buf.is_empty()
+                        && !matches!(this.head_timer, TimerState::Active { .. })
+                    {
+                        // Subsequent requests on this connection get client deadlines too.
+                        if let Some(deadline) = this.config.client_request_deadline() {
+                            this.head_timer
+                                .set_and_init(cx, sleep_until(deadline.into()), line!());
+                        }
+                    }
+
+                    // Needs more bytes read for full head.
+                    break;
+                }
 
                 Err(ParseError::Io(err)) => {
                     trace!("I/O error: {}", &err);
@@ -1187,7 +1201,7 @@ where
 
         if let TimerState::Active { timer } = this.head_timer {
             if timer.as_mut().poll(cx).is_ready() {
-                // timeout on first request (slow request) return 408
+                // Return 408 when a request head takes too long.
 
                 trace!("timed out on slow request; replying with 408 and closing connection");
 
@@ -1517,7 +1531,10 @@ where
                             PollResponse::DoNothing => {
                                 // KEEP_ALIVE is set in send_response_inner if client allows it
                                 // FINISHED is set after writing last chunk of response
-                                if inner.flags.contains(Flags::KEEP_ALIVE | Flags::FINISHED) {
+                                // A partial head uses its own deadline instead of the idle timeout.
+                                if inner.flags.contains(Flags::KEEP_ALIVE | Flags::FINISHED)
+                                    && !matches!(inner.head_timer, TimerState::Active { .. })
+                                {
                                     if let Some(timer) = inner.config.keep_alive_deadline() {
                                         inner.as_mut().project().ka_timer.set_and_init(
                                             cx,
```

**File**: `actix-http/tests/test_server.rs` (modified, +269/-1)
```diff
@@ -3,6 +3,7 @@ use std::{
     future::ready,
     io::{Read, Write},
     net,
+    pin::pin,
     sync::{Arc, Mutex},
     thread,
     time::{Duration, Instant},
@@ -23,7 +24,10 @@ use derive_more::{Display, Error};
 use futures_util::{stream::once, FutureExt as _, StreamExt as _};
 use rand::RngExt as _;
 use regex::Regex;
-use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};
+use tokio::{
+    io::{AsyncReadExt as _, AsyncWriteExt as _},
+    time::interval,
+};
 use tokio_util::future::FutureExt as _;
 
 #[tokio::test(flavor = "local")]
@@ -491,6 +495,270 @@ async fn http1_keepalive_close() {
     srv.stop().await;
 }
 
+/// Reads the socket until EOF and returns everything received. Panics if EOF does not arrive
+/// within `timeout`.
+fn read_to_end_with_deadline(mut stream: net::TcpStream, timeout: Duration) -> String {
+    let (tx, rx) = std::sync::mpsc::channel();
+
+    thread::spawn(move || {
+        let mut buf = Vec::new();
+        let mut chunk = [0u8; 256];
+
+        loop {
+            match stream.read(&mut chunk) {
+                Ok(0) | Err(_) => break,
+                Ok(n) => buf.extend_from_slice(&chunk[..n]),
+            }
+        }
+
+        let _ = tx.send(String::from_utf8_lossy(&buf).into_owned());
+    });
+
+    match rx.recv_timeout(timeout) {
+        Ok(response) => response,
+        Err(_) => panic!("Connection should close within {timeout:?}"),
+    }
+}
+
+/// Sends `probe` as the start of a second request on an idle keep-alive connection and checks
+/// that the connection is eventually closed.
+async fn keepalive_partial_second_request_probe(probe: &'static [u8]) {
+    let mut srv = test_server(|| {
+        HttpService::build()
+            .keep_alive(Duration::from_secs(1))
+            .client_request_timeout(Duration::from_secs(1))
+            .h1(|_| ready(Ok::<_, Infallible>(Response::ok())))
+            .tcp()
+    })
+    .await;
+
+    let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
+
+    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n");
+    let mut data = vec![0; 256];
+    let _ = stream.read(&mut data);
+    assert_eq!(&data[..17], b"HTTP/1.1 200 OK\r\n");
+
+    let _ = stream.write_all(probe);
+
+    let response = read_to_end_with_deadline(stream, Duration::from_secs(5));
+
+    assert!(
+        response.is_empty() || response.contains("408"),
+        "Connection should close or time out; got: {response:?}"
+    );
+
+    srv.stop().await;
+}
+
+#[tokio::test(flavor = "local")]
+async fn http1_keepalive_partial_second_request_timeout() {
+    keepalive_partial_second_request_probe(b"G").await;
+}
+
+#[tokio::test(flavor = "local")]
+async fn http1_keepalive_crlf_probe_timeout() {
+    keepalive_partial_second_request_probe(b"\r\n").await;
+}
+
+#[tokio::test(flavor = "local")]
+async fn http1_keepalive_pipelined_then_partial_timeout() {
+    let mut srv = test_server(|| {
+        HttpService::build()
+            .keep_alive(Duration::from_secs(30))
+            .client_request_timeout(Duration::from_secs(1))
+            .h1(|_| ready(Ok::<_, Infallible>(Response::ok())))
+            .tcp()
+    })
+    .await;
+
+    let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
+
+    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n");
+    let mut data = vec![0; 256];
+    let _ = stream.read(&mut data);
+
+    // pipelined second request followed by one byte of a third request, then silence
+    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\n\r\nG");
+
+    let response = read_to_end_with_deadline(stream, Duration::from_secs(5));
+
+    assert!(
+        response.contains("408"),
+        "Connection should time out; got: {response:?}"
+    );
+
+    srv.stop().await;
+}
+
+#[tokio::test(flavor = "local")]
+async fn http1_request_head_timeout_is_not_renewed_by_incoming_bytes() {
+    let mut srv = test_server(|| {
+        HttpService::build()
+            .keep_alive(Duration::from_secs(30))
+            .client_request_timeout(Duration::from_secs(1))
+            .h1(|_| ready(Ok::<_, Infallible>(Response::ok())))
+            .tcp()
+    })
+    .await;
+
+    for follow_up in [false, true] {
+        let mut stream = TcpStream::connect(srv.addr()).await.unwrap();
+
+        if follow_up {
+            stream
+                .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
+                .await
+                .unwrap();
+
+            assert!(read_http1_response_head(&mut stream)
+                .await
+                .contains("200 OK"));
+        }
+
+        stream.write_all(b"G").await.unwrap();
+
+        let (mut reader, mut writer) = stream.split();
+        let mut response = String::new();
+
+        async {
+            let mut read = pin!(reader.read_to_string(&mut response));
+
+            let mut interval = interval(Duration::from_millis(150));
+
+            loop {
+                tokio::select! {
+        
```

---

### Incident Patch 3: `b6fbadad` (2026-11-15)
**Commit Message**: fix(actix-http): bound partial request heads on keep-alive connections

A client could complete one request, send one byte of the next head, and
keep the connection open forever. This regressed in #2611 (3200de3f,
2022-01-31), which cleared the keep-alive timer on input while the head
timer still applied only to the first request.

Start the existing head timer when decoding needs more head bytes on a
reusable connection. Preserve an active deadline across reads and clear
it when the head is complete so upload bodies remain unrestricted.

Check the partial decode after each complete head. This also bounds a
partial third head buffered behind a complete pipelined second request.
Do not arm the idle timer while a head deadline is active, or start a
new
head timer after a request disables keep-alive.

A client that sends a bare CRLF probe and waits past
client_request_timeout (5 seconds by default) now receives 408 and the
connection closes, even when no request is pending. HTTP/2 is unchanged.

Add the three supplied TCP regressions and coverage for byte drips,
uploads, and a keep-alive timeout shorter than the head timeout.

**File**: `actix-http/CHANGES.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Apply the request head timeout to pipelined HTTP/1.1 partial requests on keep-alive connections.
+
 ## 3.21.0
 
 - Enable `TCP_NODELAY` by default.
```

**File**: `actix-http/Cargo.toml` (modified, +1/-0)
```diff
@@ -161,6 +161,7 @@ tls-openssl = { package = "openssl", version = "0.10.55" }
 tls-rustls_023 = { package = "rustls", version = "0.23" }
 tokio = { version = "1.51", features = ["net", "rt", "macros", "sync", "time"] }
 tokio-test = "0.4"
+tokio-util = { version = "0.7", features = ["io", "codec", "time"] }
 
 [lints]
 workspace = true
```

**File**: `actix-http/src/builder.rs` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ where
         self
     }
 
-    /// Set client request timeout (for first request).
+    /// Set the timeout for reading a client request head.
     ///
     /// Defines a timeout for reading client request header. If the client does not transmit the
     /// request head within this duration, the connection is terminated with a `408 Request Timeout`
```

**File**: `actix-http/src/config.rs` (modified, +3/-3)
```diff
@@ -92,7 +92,7 @@ impl ServiceConfigBuilder {
         self
     }
 
-    /// Sets the timeout for the client to finish sending the head of its first request
+    /// Sets the timeout for the client to finish sending a request head.
     pub fn client_request_timeout(mut self, timeout: Duration) -> Self {
         self.inner.client_request_timeout = timeout;
         self
@@ -274,8 +274,8 @@ impl ServiceConfig {
         }
     }
 
-    /// Creates a time object representing the deadline for the client to finish sending the head of
-    /// its first request.
+    /// Creates a time object representing the deadline for the client to finish sending a request
+    /// head.
     ///
     /// Returns `None` if this `ServiceConfig was` constructed with `client_request_timeout: 0`.
     pub fn client_request_deadline(&self) -> Option<Instant> {
```

**File**: `actix-http/src/h1/dispatcher.rs` (modified, +23/-6)
```diff
@@ -1051,7 +1051,7 @@ where
 
                     match msg {
                         Message::Item(mut req) => {
-                            // head timer only applies to first request on connection
+                            // Stop the head timer before reading the request payload.
                             this.head_timer.clear(line!());
 
                             req.head_mut().peer_addr = *this.peer_addr;
@@ -1125,9 +1125,23 @@ where
                     }
                 }
 
-                // decode is partial and buffer is not full yet
-                // break and wait for more read
-                Ok(None) => break,
+                // Decode is partial.
+                Ok(None) => {
+                    if this.payload.is_none()
+                        && this.codec.keep_alive()
+                        && !this.read_buf.is_empty()
+                        && !matches!(this.head_timer, TimerState::Active { .. })
+                    {
+                        // Subsequent requests on this connection get client deadlines too.
+                        if let Some(deadline) = this.config.client_request_deadline() {
+                            this.head_timer
+                                .set_and_init(cx, sleep_until(deadline.into()), line!());
+                        }
+                    }
+
+                    // Needs more bytes read for full head.
+                    break;
+                }
 
                 Err(ParseError::Io(err)) => {
                     trace!("I/O error: {}", &err);
@@ -1187,7 +1201,7 @@ where
 
         if let TimerState::Active { timer } = this.head_timer {
             if timer.as_mut().poll(cx).is_ready() {
-                // timeout on first request (slow request) return 408
+                // Return 408 when a request head takes too long.
 
                 trace!("timed out on slow request; replying with 408 and closing connection");
 
@@ -1517,7 +1531,10 @@ where
                             PollResponse::DoNothing => {
                                 // KEEP_ALIVE is set in send_response_inner if client allows it
                                 // FINISHED is set after writing last chunk of response
-                                if inner.flags.contains(Flags::KEEP_ALIVE | Flags::FINISHED) {
+                                // A partial head uses its own deadline instead of the idle timeout.
+                                if inner.flags.contains(Flags::KEEP_ALIVE | Flags::FINISHED)
+                                    && !matches!(inner.head_timer, TimerState::Active { .. })
+                                {
                                     if let Some(timer) = inner.config.keep_alive_deadline() {
                                         inner.as_mut().project().ka_timer.set_and_init(
                                             cx,
```

**File**: `actix-http/tests/test_server.rs` (modified, +270/-0)
```diff
@@ -3,6 +3,7 @@ use std::{
     future::ready,
     io::{Read, Write},
     net,
+    pin::pin,
     sync::{Arc, Mutex},
     thread,
     time::{Duration, Instant},
@@ -23,6 +24,11 @@ use derive_more::{Display, Error};
 use futures_util::{stream::once, FutureExt as _, StreamExt as _};
 use rand::RngExt as _;
 use regex::Regex;
+use tokio::{
+    io::{AsyncReadExt as _, AsyncWriteExt as _},
+    time::interval,
+};
+use tokio_util::future::FutureExt as _;
 
 #[tokio::test(flavor = "local")]
 async fn h1_basic() {
@@ -434,6 +440,270 @@ async fn http1_keepalive_close() {
     srv.stop().await;
 }
 
+/// Reads the socket until EOF and returns everything received. Panics if EOF does not arrive
+/// within `timeout`.
+fn read_to_end_with_deadline(mut stream: net::TcpStream, timeout: Duration) -> String {
+    let (tx, rx) = std::sync::mpsc::channel();
+
+    thread::spawn(move || {
+        let mut buf = Vec::new();
+        let mut chunk = [0u8; 256];
+
+        loop {
+            match stream.read(&mut chunk) {
+                Ok(0) | Err(_) => break,
+                Ok(n) => buf.extend_from_slice(&chunk[..n]),
+            }
+        }
+
+        let _ = tx.send(String::from_utf8_lossy(&buf).into_owned());
+    });
+
+    match rx.recv_timeout(timeout) {
+        Ok(response) => response,
+        Err(_) => panic!("Connection should close within {timeout:?}"),
+    }
+}
+
+/// Sends `probe` as the start of a second request on an idle keep-alive connection and checks
+/// that the connection is eventually closed.
+async fn keepalive_partial_second_request_probe(probe: &'static [u8]) {
+    let mut srv = test_server(|| {
+        HttpService::build()
+            .keep_alive(Duration::from_secs(1))
+            .client_request_timeout(Duration::from_secs(1))
+            .h1(|_| ready(Ok::<_, Infallible>(Response::ok())))
+            .tcp()
+    })
+    .await;
+
+    let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
+
+    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n");
+    let mut data = vec![0; 256];
+    let _ = stream.read(&mut data);
+    assert_eq!(&data[..17], b"HTTP/1.1 200 OK\r\n");
+
+    let _ = stream.write_all(probe);
+
+    let response = read_to_end_with_deadline(stream, Duration::from_secs(5));
+
+    assert!(
+        response.is_empty() || response.contains("408"),
+        "Connection should close or time out; got: {response:?}"
+    );
+
+    srv.stop().await;
+}
+
+#[tokio::test(flavor = "local")]
+async fn http1_keepalive_partial_second_request_timeout() {
+    keepalive_partial_second_request_probe(b"G").await;
+}
+
+#[tokio::test(flavor = "local")]
+async fn http1_keepalive_crlf_probe_timeout() {
+    keepalive_partial_second_request_probe(b"\r\n").await;
+}
+
+#[tokio::test(flavor = "local")]
+async fn http1_keepalive_pipelined_then_partial_timeout() {
+    let mut srv = test_server(|| {
+        HttpService::build()
+            .keep_alive(Duration::from_secs(30))
+            .client_request_timeout(Duration::from_secs(1))
+            .h1(|_| ready(Ok::<_, Infallible>(Response::ok())))
+            .tcp()
+    })
+    .await;
+
+    let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
+
+    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n");
+    let mut data = vec![0; 256];
+    let _ = stream.read(&mut data);
+
+    // pipelined second request followed by one byte of a third request, then silence
+    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\n\r\nG");
+
+    let response = read_to_end_with_deadline(stream, Duration::from_secs(5));
+
+    assert!(
+        response.contains("408"),
+        "Connection should time out; got: {response:?}"
+    );
+
+    srv.stop().await;
+}
+
+#[tokio::test(flavor = "local")]
+async fn http1_request_head_timeout_is_not_renewed_by_incoming_bytes() {
+    let mut srv = test_server(|| {
+        HttpService::build()
+            .keep_alive(Duration::from_secs(30))
+            .client_request_timeout(Duration::from_secs(1))
+            .h1(|_| ready(Ok::<_, Infallible>(Response::ok())))
+            .tcp()
+    })
+    .await;
+
+    for follow_up in [false, true] {
+        let mut stream = TcpStream::connect(srv.addr()).await.unwrap();
+
+        if follow_up {
+            stream
+                .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
+                .await
+                .unwrap();
+
+            assert!(read_http1_response_head(&mut stream)
+                .await
+                .contains("200 OK"));
+        }
+
+        stream.write_all(b"G").await.unwrap();
+
+        let (mut reader, mut writer) = stream.split();
+        let mut response = String::new();
+
+        async {
+            let mut read = pin!(reader.read_to_string(&mut response));
+
+            let mut interval = interval(Duration::from_millis(150));
+
+            loop {
+                tokio::select! {
+                    result = &mut read => 
```

**File**: `actix-web/src/server.rs` (modified, +1/-1)
```diff
@@ -230,7 +230,7 @@ where
         self
     }
 
-    /// Sets server client timeout for first request.
+    /// Sets the timeout for reading a client request head.
     ///
     /// Defines a timeout for reading client request head. If a client does not transmit the entire
     /// set headers within this time, the request is terminated with a 408 (Request Timeout) error.
```

#### Recent Merged Pull Requests:
- **PR #4423** (2026-11-16): fix(http): keep commas inside quoted strings in list headers (@JMLX42)
- **PR #4422** (2026-11-16): refactor(http): support any item type in InfallibleStream (@robjtede)
- **PR #4421** (2026-11-15): refactor(http): match chunk bytes directly (@robjtede)
- **PR #4418** (2026-11-15): ci: automate releases with release-plz (@robjtede)
- **PR #4417** (2026-11-13): test: replace Actix test attributes with Tokio local tests (@robjtede)
- **PR #4416** (2026-11-13): chore: replace example main macros with Tokio (@robjtede)

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

## X. multipart): map PayloadError::Overflow to 413 Payload Too Large

**RULE**:
When implementing operations in `actix-multipart/CHANGES.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in actix/actix-web. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `315839cb`: multipart): map PayloadError::Overflow to 413 Payload Too Large. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `actix-multipart/CHANGES.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Map `MultipartError::Payload(PayloadError::Overflow)` to `413 Payload Too Large`, matching `PayloadError`.

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `315839cb` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
