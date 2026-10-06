# Forensic Learning Record (Deep Inspection): actix/actix-web

> **Canonical Artifact**: `07_PROJECT_LEARNING/actix-actix-web-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/actix/actix-web](https://github.com/actix/actix-web))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:12:53.429Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `actix/actix-web`
- **Description**: Actix Web is a powerful, pragmatic, and extremely fast web framework for Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 24855 stars

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
        .expect("body should never yield more than usize::MAX bytes")
}

/// Error type returned from [`to_bytes_limited`] when body produced exceeds limit.
#[derive(Debug, Display, Error)]
#[display("limit exceeded while collecting body bytes")]
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

    #[actix_rt::test]
    async fn to_bytes_complete() {
        let bytes = to_bytes(()).await.unwrap();
        assert!(bytes.is_empty());

        let body = Bytes::from_static(b"123");
        let bytes = to_bytes(body).await.unwrap();
        assert_eq!(bytes, b"123"[..]);
    }

    #[actix_rt::test]
    async fn to_bytes_streams() {
        let stream = stream::iter(vec![Bytes::from_static(b"123"), Bytes::from_static(b"abc")])
            .map(Ok::<_, Error>);
        let body = BodyStream::new(stream);
        let bytes = to_bytes(body).await.unwrap();
        assert_eq!(bytes, b"123abc"[..]);
    }

    #[actix_rt::test]
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

    #[actix_rt::test]
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

    #[actix_rt::test]
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
            s.split(',')
                .filter_map(|x| match x.trim() {
                    "" => None,
                    y => Some(y),
                })
                .filter_map(|x| x.trim().parse().ok()),
        )
    }

    Ok(result)
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

#[actix_web::main]
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

#[actix_web::main]
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
use percent_encoding::{utf8_percent_encode, CONTROLS};
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

/// Returns percent encoded file URL path.
macro_rules! encode_file_url {
    ($path:ident) => {
        utf8_percent_encode(&$path, CONTROLS)
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
    #[display("path is not a directory. Unable to serve static files")]
    IsNotDirectory,

    /// Cannot render directory.
    #[display("unable to render directory without index file")]
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
    #[display("segment started with invalid character: ('{_0}')")]
    BadStart(char),

    /// Segment contained the wrapped invalid character.
    #[display("segment contained invalid character ('{_0}')")]
    BadChar(char),

    /// Segment ended with the wrapped invalid character.
    #[display("segment ended with invalid character: ('{_0}')")]
    BadEnd(char),

    /// Path is not a valid UTF-8 string after percent-decoding.
    #[display("path is not a valid UTF-8 string after percent-decoding")]
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

### Core Architecture Module: `actix-files/src/lib.rs`
```
//! Static file serving for Actix Web.
//!
//! Provides a non-blocking service for serving static files from disk.
//!
//! # Examples
//! ```
//! use actix_web::App;
//! use actix_files::Files;
//!
//! let app = App::new()
//!     .service(Files::new("/static", ".").prefer_utf8(true));
//! ```

#![warn(missing_docs, missing_debug_implementations)]
#![doc(html_logo_url = "https://actix.rs/img/logo.png")]
#![doc(html_favicon_url = "https://actix.rs/favicon.ico")]
#![cfg_attr(docsrs, feature(doc_cfg))]

use std::path::Path;

use actix_service::boxed::{BoxService, BoxServiceFactory};
use actix_web::{
    dev::{RequestHead, ServiceRequest, ServiceResponse},
    error::Error,
    http::header::DispositionType,
};
use mime_guess::from_ext;

mod chunked;
mod directory;
mod encoding;
mod error;
mod files;
mod named;
mod path_buf;
mod range;
mod service;

pub use self::{
    chunked::ChunkedReadFile,
    directory::Directory,
    error::UriSegmentError,
    files::{Files, FilesDirs},
    named::NamedFile,
    path_buf::PathBufWrap,
    range::HttpRange,
    service::FilesService,
};
use self::{
    directory::{directory_listing, DirectoryRenderer},
    error::FilesError,
};

type HttpService = BoxService<ServiceRequest, ServiceResponse, Error>;
type HttpNewService = BoxServiceFactory<(), ServiceRequest, ServiceResponse, Error, ()>;

/// Return the MIME type associated with a filename extension (case-insensitive).
/// If `ext` is empty or no associated type for the extension was found, returns
/// the type `application/octet-stream`.
#[inline]
pub fn file_extension_to_mime(ext: &str) -> mime::Mime {
    from_ext(ext).first_or_octet_stream()
}

type MimeOverride = dyn Fn(&mime::Name<'_>) -> DispositionType;

type PathFilter = dyn Fn(&Path, &RequestHead) -> bool;

#[cfg(test)]
mod tests {
    use std::{
        ffi::OsString,
        fmt::Write as _,
        fs::{self},
        ops::Add,
        path::PathBuf,
        time::{Duration, SystemTime},
    };

    use actix_web::{
        dev::ServiceFactory,
        guard,
        http::{
            header::{self, ContentDisposition, DispositionParam},
            Method, StatusCode,
        },
        middleware::Compress,
        test::{self, TestRequest},
        web::{self, Bytes},
        App, HttpResponse, Responder,
    };

    use super::*;
    use crate::named::File;

    #[actix_web::test]
    async fn test_file_extension_to_mime() {
        let m = file_extension_to_mime("");
        assert_eq!(m, mime::APPLICATION_OCTET_STREAM);

        let m = file_extension_to_mime("jpg");
        assert_eq!(m, mime::IMAGE_JPEG);

        let m = file_extension_to_mime("invalid extension!!");
        assert_eq!(m, mime::APPLICATION_OCTET_STREAM);

        let m = file_extension_to_mime("");
        assert_eq!(m, mime::APPLICATION_OCTET_STREAM);
    }

    #[actix_rt::test]
    async fn test_if_modified_since_without_if_none_match() {
        let file = NamedFile::open("Cargo.toml").unwrap();
        let since = header::HttpDate::from(SystemTime::now().add(Duration::from_secs(60)));

        let req = TestRequest::default()
            .insert_header((header::IF_MODIFIED_SINCE, since))
            .to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(resp.status(), StatusCode::NOT_MODIFIED);
    }

    #[actix_rt::test]
    async fn test_if_modified_since_without_if_none_match_same() {
        let file = NamedFile::open("Cargo.toml").unwrap();
        let since = file.last_modified().unwrap();

        let req = TestRequest::default()
            .insert_header((header::IF_MODIFIED_SINCE, since))
            .to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(resp.status(), StatusCode::NOT_MODIFIED);
    }

    #[actix_rt::test]
    async fn test_if_modified_since_with_if_none_match() {
        let file = NamedFile::open("Cargo.toml").unwrap();
        let since = header::HttpDate::from(SystemTime::now().add(Duration::from_secs(60)));

        let req = TestRequest::default()
            .insert_header((header::IF_NONE_MATCH, "miss_etag"))
            .insert_header((header::IF_MODIFIED_SINCE, since))
            .to_http_request();
        let resp = file.respond_to(&req);
        assert_ne!(resp.status(), StatusCode::NOT_MODIFIED);
    }

    #[actix_rt::test]
    async fn test_if_unmodified_since() {
        let file = NamedFile::open("Cargo.toml").unwrap();
        let since = file.last_modified().unwrap();

        let req = TestRequest::default()
            .insert_header((header::IF_UNMODIFIED_SINCE, since))
            .to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_rt::test]
    async fn test_if_unmodified_since_failed() {
        let file = NamedFile::open("Cargo.toml").unwrap();
        let since = header::HttpDate::from(SystemTime::UNIX_EPOCH);

        let req = TestRequest::default()
            .insert_header((header::IF_UNMODIFIED_SINCE, since))
            .to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(resp.status(), StatusCode::PRECONDITION_FAILED);
    }

    #[actix_rt::test]
    async fn test_named_file_text() {
        assert!(NamedFile::open("test--").is_err());
        let mut file = NamedFile::open("Cargo.toml").unwrap();
        {
            file.file();
            let _f: &File = &file;
        }
        {
            let _f: &mut File = &mut file;
        }

        let req = TestRequest::default().to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(
            resp.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/x-toml"
        );
        assert_eq!(
            resp.headers().get(header::CONTENT_DISPOSITION).unwrap(),
            "inline; filename=\"Cargo.toml\""
        );
    }

    #[actix_rt::test]
    async fn test_named_file_content_disposition() {
        assert!(NamedFile::open("test--").is_err());
        let mut file = NamedFile::open("Cargo.toml").unwrap();
        {
            file.file();
            let _f: &File = &file;
        }
        {
            let _f: &mut File = &mut file;
        }

        let req = TestRequest::default().to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(
            resp.headers().get(header::CONTENT_DISPOSITION).unwrap(),
            "inline; filename=\"Cargo.toml\""
        );

        let file = NamedFile::open("Cargo.toml")
            .unwrap()
            .disable_content_disposition();
        let req = TestRequest::default().to_http_request();
        let resp = file.respond_to(&req);
        assert!(resp.headers().get(header::CONTENT_DISPOSITION).is_none());
    }

    #[actix_rt::test]
    async fn test_named_file_non_ascii_file_name() {
        let file = crate::named::File::open("Cargo.toml").unwrap();

        let mut file = NamedFile::from_file(file, "貨物.toml").unwrap();
        {
            file.file();
            let _f: &File = &file;
        }
        {
            let _f: &mut File = &mut file;
        }

        let req = TestRequest::default().to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(
            resp.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/x-toml"
        );
        assert_eq!(
            resp.headers().get(header::CONTENT_DISPOSITION).unwrap(),
            "inline; filename=\"貨物.toml\"; filename*=UTF-8''%E8%B2%A8%E7%89%A9.toml"
        );
    }

    #[actix_rt::test]
    async fn test_named_file_set_content_type() {
        let mut file = NamedFile::open("Cargo.toml")
            .unwrap()
            .set_content_type(mime::TEXT_XML);
        {
            file.file();
            let _f: &File = &file;
        }
        {
            let _f: &mut File = &mut file;
        }

        let req = TestRequest::default().to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(
            resp.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/xml"
        );
        assert_eq!(
            resp.headers().get(header::CONTENT_DISPOSITION).unwrap(),
            "inline; filename=\"Cargo.toml\""
        );
    }

    #[actix_rt::test]
    async fn test_named_file_image() {
        let mut file = NamedFile::open("tests/test.png").unwrap();
        {
            file.file();
            let _f: &File = &file;
        }
        {
            let _f: &mut File = &mut file;
        }

        let req = TestRequest::default().to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(
            resp.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/png"
        );
        assert_eq!(
            resp.headers().get(header::CONTENT_DISPOSITION).unwrap(),
            "inline; filename=\"test.png\""
        );
    }

    #[actix_rt::test]
    async fn test_named_file_javascript() {
        let file = NamedFile::open("tests/test.js").unwrap();

        let req = TestRequest::default().to_http_request();
        let resp = file.respond_to(&req);
        assert_eq!(
            resp.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/javascript",
        );
        assert_eq!(
            resp.headers().get(header::CONTENT_DISPOSITION).unwrap(),
            "inline; filename=\"test.js\"",
        );
    }

    #[actix_rt::test]
    async fn test_named_file_image_attachment() {
        let cd = ContentDisposition {
            disposition: DispositionType::Attachment,
            parameters: vec![DispositionParam::Filename(String::from("test.png"))],
        };
        let mut file = NamedFile::open("tests/test.png")
            .unwrap()
            .set_content_disposition(cd);
        {
            file.file();
            let _f: &File = &file;
        }
        {
            let _f: &mut File = &mut file;
        }

        let req = TestRequest::default().to_http_request();
        let resp = file.
```

### Core Architecture Module: `actix-files/src/named.rs`
```
use std::{
    fs::Metadata,
    io,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use actix_web::{
    body::{self, BoxBody, SizedStream},
    dev::{
        self, AppService, HttpServiceFactory, ResourceDef, Service, ServiceFactory, ServiceRequest,
        ServiceResponse,
    },
    http::{
        header::{
            self, Charset, ContentDisposition, ContentEncoding, DispositionParam, DispositionType,
            ExtendedValue,
        },
        StatusCode,
    },
    Error, HttpMessage, HttpRequest, HttpResponse, Responder,
};
use bitflags::bitflags;
use derive_more::{Deref, DerefMut};
use futures_core::future::LocalBoxFuture;
use mime::Mime;

use crate::{encoding::equiv_utf8_text, range::HttpRange};

bitflags! {
    #[derive(Debug, Clone, Copy)]
    pub(crate) struct Flags: u8 {
        const ETAG =                0b0000_0001;
        const LAST_MD =             0b0000_0010;
        const CONTENT_DISPOSITION = 0b0000_0100;
        const PREFER_UTF8 =         0b0000_1000;
    }
}

impl Default for Flags {
    fn default() -> Self {
        Flags::from_bits_truncate(0b0000_1111)
    }
}

/// A file with an associated name.
///
/// `NamedFile` can be registered as services:
/// ```
/// use actix_web::App;
/// use actix_files::NamedFile;
///
/// # fn run() -> Result<(), Box<dyn std::error::Error>> {
/// let file = NamedFile::open("./static/index.html")?;
/// let app = App::new().service(file);
/// # Ok(())
/// # }
/// ```
///
/// They can also be returned from handlers:
/// ```
/// use actix_web::{Responder, get};
/// use actix_files::NamedFile;
///
/// #[get("/")]
/// async fn index() -> impl Responder {
///     NamedFile::open("./static/index.html")
/// }
/// ```
#[derive(Debug, Deref, DerefMut)]
pub struct NamedFile {
    #[deref]
    #[deref_mut]
    file: File,
    path: PathBuf,
    modified: Option<SystemTime>,
    pub(crate) md: Metadata,
    pub(crate) flags: Flags,
    pub(crate) status_code: StatusCode,
    pub(crate) content_type: Mime,
    pub(crate) content_disposition: ContentDisposition,
    pub(crate) encoding: Option<ContentEncoding>,
    pub(crate) read_mode_threshold: u64,
}

pub(crate) use std::fs::File;

use super::chunked;

pub(crate) fn get_content_type_and_disposition(
    path: &Path,
) -> Result<(mime::Mime, ContentDisposition), io::Error> {
    let filename = match path.file_name() {
        Some(name) => name.to_string_lossy(),
        None => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Provided path has no filename",
            ));
        }
    };

    let ct = mime_guess::from_path(path).first_or_octet_stream();

    let disposition = match ct.type_() {
        mime::IMAGE | mime::TEXT | mime::AUDIO | mime::VIDEO => DispositionType::Inline,
        mime::APPLICATION => match ct.subtype() {
            mime::JAVASCRIPT | mime::JSON => DispositionType::Inline,
            name if name == "wasm" || name == "xhtml" => DispositionType::Inline,
            _ => DispositionType::Attachment,
        },
        _ => DispositionType::Attachment,
    };

    // replace special characters in filenames which could occur on some filesystems
    let mut escaped_len = filename.len();
    for byte in filename.bytes() {
        if matches!(byte, b'\n' | b'\x0B' | b'\x0C' | b'\r') {
            escaped_len += 2;
        }
    }

    let filename_s = if escaped_len == filename.len() {
        filename.to_string()
    } else {
        let mut escaped = String::with_capacity(escaped_len);
        for ch in filename.chars() {
            match ch {
                '\n' => escaped.push_str("%0A"),   // \n line break
                '\x0B' => escaped.push_str("%0B"), // \v vertical tab
                '\x0C' => escaped.push_str("%0C"), // \f form feed
                '\r' => escaped.push_str("%0D"),   // \r carriage return
                ch => escaped.push(ch),
            }
        }
        escaped
    };

    let is_ascii = filename.is_ascii();

    let mut parameters = Vec::with_capacity(if is_ascii { 1 } else { 2 });
    parameters.push(DispositionParam::Filename(filename_s));

    if !is_ascii {
        parameters.push(DispositionParam::FilenameExt(ExtendedValue {
            charset: Charset::Ext(String::from("UTF-8")),
            language_tag: None,
            value: filename.into_owned().into_bytes(),
        }))
    }

    let cd = ContentDisposition {
        disposition,
        parameters,
    };

    Ok((ct, cd))
}

impl NamedFile {
    /// Creates an instance from a previously opened file.
    ///
    /// The given `path` need not exist and is only used to determine the `ContentType` and
    /// `ContentDisposition` headers.
    ///
    /// # Examples
    /// ```ignore
    /// use std::{
    ///     io::{self, Write as _},
    ///     env,
    ///     fs::File
    /// };
    /// use actix_files::NamedFile;
    ///
    /// let mut file = File::create("foo.txt")?;
    /// file.write_all(b"Hello, world!")?;
    /// let named_file = NamedFile::from_file(file, "bar.txt")?;
    /// # std::fs::remove_file("foo.txt");
    /// Ok(())
    /// ```
    pub fn from_file<P: AsRef<Path>>(file: File, path: P) -> io::Result<NamedFile> {
        let path = path.as_ref().to_path_buf();

        // Get the name of the file and use it to construct default Content-Type
        // and Content-Disposition values
        let (content_type, content_disposition) = get_content_type_and_disposition(&path)?;

        let md = file.metadata()?;

        let modified = md.modified().ok();
        let encoding = None;

        Ok(NamedFile {
            path,
            file,
            content_type,
            content_disposition,
            md,
            modified,
            encoding,
            status_code: StatusCode::OK,
            flags: Flags::default(),
            read_mode_threshold: 0,
        })
    }

    /// Attempts to open a file in read-only mode.
    ///
    /// # Examples
    /// ```
    /// use actix_files::NamedFile;
    /// let file = NamedFile::open("foo.txt");
    /// ```
    pub fn open<P: AsRef<Path>>(path: P) -> io::Result<NamedFile> {
        let file = File::open(&path)?;
        Self::from_file(file, path)
    }

    /// Returns reference to the underlying file object.
    #[inline]
    pub fn file(&self) -> &File {
        &self.file
    }

    /// Returns the filesystem path to this file.
    ///
    /// # Examples
    /// ```
    /// # use std::io;
    /// use actix_files::NamedFile;
    ///
    /// # fn path() -> io::Result<()> {
    /// let file = NamedFile::open("test.txt")?;
    /// assert_eq!(file.path().as_os_str(), "foo.txt");
    /// # Ok(())
    /// # }
    /// ```
    #[inline]
    pub fn path(&self) -> &Path {
        self.path.as_path()
    }

    /// Returns the time the file was last modified.
    ///
    /// Returns `None` only on unsupported platforms; see [`std::fs::Metadata::modified()`].
    /// Therefore, it is usually safe to unwrap this.
    #[inline]
    pub fn modified(&self) -> Option<SystemTime> {
        self.modified
    }

    /// Returns the filesystem metadata associated with this file.
    #[inline]
    pub fn metadata(&self) -> &Metadata {
        &self.md
    }

    /// Returns the `Content-Type` header that will be used when serving this file.
    #[inline]
    pub fn content_type(&self) -> &Mime {
        &self.content_type
    }

    /// Returns the `Content-Disposition` that will be used when serving this file.
    #[inline]
    pub fn content_disposition(&self) -> &ContentDisposition {
        &self.content_disposition
    }

    /// Returns the `Content-Encoding` that will be used when serving this file.
    ///
    /// A return value of `None` indicates that the content is not already using a compressed
    /// representation and may be subject to compression downstream.
    #[inline]
    pub fn content_encoding(&self) -> Option<ContentEncoding> {
        self.encoding
    }

    /// Set response status code.
    #[deprecated(since = "0.7.0", note = "Prefer `Responder::customize()`.")]
    pub fn set_status_code(mut self, status: StatusCode) -> Self {
        self.status_code = status;
        self
    }

    /// Sets the `Content-Type` header that will be used when serving this file. By default the
    /// `Content-Type` is inferred from the filename extension.
    #[inline]
    pub fn set_content_type(mut self, mime_type: Mime) -> Self {
        self.content_type = mime_type;
        self
    }

    /// Set the Content-Disposition for serving this file. This allows changing the
    /// `inline/attachment` disposition as well as the filename sent to the peer.
    ///
    /// By default the disposition is `inline` for `text/*`, `image/*`, `video/*` and
    /// `application/{javascript, json, wasm}` mime types, and `attachment` otherwise, and the
    /// filename is taken from the path provided in the `open` method after converting it to UTF-8
    /// (using `to_string_lossy`).
    #[inline]
    pub fn set_content_disposition(mut self, cd: ContentDisposition) -> Self {
        self.content_disposition = cd;
        self.flags.insert(Flags::CONTENT_DISPOSITION);
        self
    }

    /// Disables `Content-Disposition` header.
    ///
    /// By default, the `Content-Disposition` header is sent.
    #[inline]
    pub fn disable_content_disposition(mut self) -> Self {
        self.flags.remove(Flags::CONTENT_DISPOSITION);
        self
    }

    /// Sets content encoding for this file.
    ///
    /// This prevents the `Compress` middleware from modifying the file contents and signals to
    /// browsers/clients how to decode it. For example, if serving a compressed HTML file (e.g.,
    /// `index.html.gz`) then use `.set_content_encoding(ContentEncoding::Gzip)`.
    #[inline]
    pub fn set_content_encoding(mut self, enc: ContentEncoding) -> Self {
        self.encoding = Some(enc);
        self
    }

    /// Sets the size threshold that determines f
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4299** (2026-10-02): **ci: remove obsolete disk space cleanup**
  *Symptoms*: <!-- Thanks for considering contributing actix! --> <!-- Please fill out the following to get your PR reviewed quicker. -->  ## PR Type  <!-- What kind of change does this PR make? --> <!-- Bug Fix / Feature / Refactor / Code Style / Other -->  Other (CI)  ## PR Checklist  <!-- Check your PR fulfills the following items. --> <!-- For draft PRs check the boxes as you complete them. -->  - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [x] A changelog entry has been made for the appropriate packages. - [x] Format code with the latest stable rustfmt. - [x] (Team) Label with affected crates and semver status.  ## Overview  <!-- Describe the current and new behavior. --> <!-- Emphasize any breaking changes. -->  Remove the `Free Disk Space` step from the post-merge feature-combination job and delete `scripts/free-disk-space.sh`. No jobs use the script after this change. Keep `cargo-ci-cache-clean` for Rust cache management.  Recent [Blacksmith feature checks](https://github.com/actix/actix-web/actions/runs/36973045808/job/110730897176) started with 81 GiB free, compared with the script's old assumption of 17 GB free on Azure runners. The cleanup adds 12–16 seconds per job and includes an unavailable `hhvm` package.  Validation: the changed workflow passes Prettier and offline zizmor checks. Repository search confirms no disk-cleanup steps or script references remain. Feature checks without cleanup still need validatio
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/a5688089267f44aed98124d52c56ef68758de91a">a568808</a> in the <span id="cc-branch" title="actix/actix-web:ci/remove-disk-space-cleanup">ci/remove-disk-space...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/457ffd1ebc85eec7c3b5f6f21e4e6453da586302">457ffd1</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:main">main</span> <a id="cc-sha" href="/actix/actix-web/commit/457ffd1ebc85eec7c3b5f6f21e4e6453da586302">457ffd1</a></td>   <td align="center"><span id="cc-branch" title="actix/actix-web

- **Issue #4298** (2026-10-02): **ci: partition feature combination checks**
  *Symptoms*: <!-- Thanks for considering contributing actix! --> <!-- Please fill out the following to get your PR reviewed quicker. -->  ## PR Type  <!-- What kind of change does this PR make? --> <!-- Bug Fix / Feature / Refactor / Code Style / Other -->  Other (CI)  ## PR Checklist  <!-- Check your PR fulfills the following items. --> <!-- For draft PRs check the boxes as you complete them. -->  - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [x] A changelog entry has been made for the appropriate packages. - [x] Format code with the latest stable rustfmt. - [x] (Team) Label with affected crates and semver status.  ## Overview  <!-- Describe the current and new behavior. --> <!-- Emphasize any breaking changes. -->  <!-- If this PR fixes or closes an issue, reference it here. --> <!-- Closes #000 -->  Split the existing feature combination checks across eight Linux runners. The post-merge workflow runs only on pushes to `main`. Each partition has a separate cache key. The local just recipe runs all combinations by default.  Keep the existing feature depth and exclusions. The benchmark logs confirm that all 6,934 checks ran exactly once.  Validation:  - `just --unstable --fmt --check` - Prettier check for the changed workflow - `zizmor --offline .github/workflows/ci-post-merge.yml` - All eight partitions passed in the [PR benchmark run](https://github.com/actix/actix-web/actions/runs/37011175339).  | Configuration | Longes
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/7bf3e531277397fd9da3b850e5992fc85da2c7f2">7bf3e53</a> in the <span id="cc-branch" title="actix/actix-web:t3code/partition-verify-feature-combinations">t3code/partition-ver...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/457ffd1ebc85eec7c3b5f6f21e4e6453da586302">457ffd1</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.  --- <sub>Updated <relative-time datetime="2026-10-02T13:46:30Z">October 02, 2026 13:46 UTC</relative-time></sub> 

- **Issue #4297** (2026-10-01): **ci: use Blacksmith checkout in all workflows**
  *Symptoms*: ## PR Type  Other: CI  ## Overview  Replace the remaining `actions/checkout` steps in CI, post-merge CI, and labeler with `useblacksmith/checkout` v1.8.1 at the same commit pin used by the other workflows. Each step keeps `persist-credentials: false`.  Rebuild `actions.lock` to remove the old checkout dependency. The generator also refreshes version metadata for existing dependencies; their commit pins stay the same.  ## Validation  - Prettier check for the three changed workflows. - `zizmor --offline --strict-collection --no-progress .github/workflows`. - `gh actions-lock --verify-local --no-interactive`. 
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/62032cac0525b568e28145f99850401f575155ba">62032ca</a> in the <span id="cc-branch" title="actix/actix-web:ci/use-blacksmith-checkout">ci/use-blacksmith-ch...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/140261d02c4aaee8fdfe4bf6f274464160a4c58f">140261d</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:main">main</span> <a id="cc-sha" href="/actix/actix-web/commit/140261d02c4aaee8fdfe4bf6f274464160a4c58f">140261d</a></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:c

- **Issue #4296** (2026-10-02): **fix(ws): validate 16-byte base64 nonce in Sec-WebSocket-Key (RFC 6455 §4.2.1)**
  *Symptoms*: ## PR Type Bug Fix  ## PR Checklist - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [ ] A changelog entry has been made for the appropriate packages. - [x] Format code with the latest stable rustfmt. - [x] (Team) Label with affected crates and semver status.  ## Overview Validates that `Sec-WebSocket-Key` is a valid 16-byte base64-encoded nonce during handshake verification, conforming with RFC 6455 §4.2.1.  Refs #4274 (Part 3: Missing Handshake Invariant Validations).  ### Context & Changes * **RFC 6455 §4.2.1 clause 5**: *"The request MUST include a header field with the name |Sec-WebSocket-Key|. The value of this header field MUST be a nonce consisting of a randomly selected 16-byte value that has been base64-encoded."* * Previously, `verify_handshake` only checked if the header key existed without validating that the value was a valid 16-byte base64-encoded nonce. * Added validation in `verify_handshake` to reject invalid length/corrupted nonces with `HandshakeError::BadWebsocketKey`. * Updated handshake unit tests.

- **Issue #4295** (2026-10-02): **fix(ws): return 426 Upgrade Required on unsupported version (RFC 6455 §4.2.2)**
  *Symptoms*: ## PR Type Bug Fix  ## PR Checklist - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [ ] A changelog entry has been made for the appropriate packages. - [x] Format code with the latest stable rustfmt. - [x] (Team) Label with affected crates and semver status.  ## Overview Rejects WebSocket handshake versions other than 13 across `actix-http` and `actix-web-actors`, and returns HTTP 426 `Upgrade Required` with `Sec-WebSocket-Version: 13`, `Upgrade: websocket`, and `Connection: Upgrade` headers when an unsupported version is received, conforming with RFC 6455 §4.2.2 (Step 4) and RFC 9110 §15.5.22.  Refs #4274 (Part 2: Status Code on Unsupported Version).  ### Context & Changes * **RFC 6455 §4.2.2 Step 4 (`/version/`)**: *"If this version does not match a version understood by the server, the server MUST abort the WebSocket handshake described in this section and instead send an appropriate HTTP error code (such as 426 Upgrade Required) and a `Sec-WebSocket-Version` header field indicating the version(s) the server is capable of understanding."* * **RFC 9110 §15.5.22 (426 Upgrade Required)**: *"The server MUST send an Upgrade header field in a 426 response to indicate the required protocol(s)."* * Updated `verify_handshake` in both `actix-http` and `actix-web-actors` to only accept version `13` (rejecting obsolete draft versions `7` and `8` with `HandshakeError::UnsupportedVersion`). * Updated `From<HandshakeError> 
  **Post-Mortem & Fix Analysis**:
  > CC @robjtede  ci's were all green, just a branch update :smile:  
  > @robjtede  this one's on me, the clanker used the suite and made fabricated qoute of rfc, as i had explicitly told to qoute RFC directly when its finds any violation of RFC best practices and design pattern, etc.  But returning UPGRADE REQUIRED would also be great "user experience" here and check another qoute  > ### 1. HTTP Semantics: RFC 9110 §15.5.22 > "The 426 (Upgrade Required) status code indicates that the server refuses to perform the request using the current          protocol but might be willing to do so after the client upgrades to a different protocol. The server MUST send an                                  Upgrade  header field in a 426 response to indicate the required protocol(s)."  What do u say??  __________________________________________________________________________________________________________________________   > Looking into this more, we actually accept version 7 and 8 in the handshake, even though we don't actually handle them correctly. This 
  > Ahh RFC 9110 makes things clearer then. It also says we should be adding Upgrade & Connection headers to this response.  Conclusion:  - keep 426 - keep version header - add connection header - add upgrade header - remove acceptance of version 7 and 8 from -actors crate - not breaking

- **Issue #4294** (2026-10-02): **fix(ws): reject oversized close control frames (RFC 6455 §5.5)**
  *Symptoms*: ## PR Type Bug Fix  ## PR Checklist - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [ ] A changelog entry has been made for the appropriate packages. - [x] Format code with the latest stable rustfmt. - [x] (Team) Label with affected crates and semver status.  ## Overview Rejects oversized Close control frames (> 125 bytes) with `ProtocolError::InvalidLength`, conforming with RFC 6455 §5.5.  Refs #4274 (Part 1: Control Frame Oversize Morphing).  ### Context & Changes * **RFC 6455 §5.5**: *"All control frames MUST have a payload length of 125 bytes or less and MUST NOT be fragmented."* * Previously, receiving an oversized Close frame morphed it into an empty `OpCode::Close` frame and continued. * This change eliminates morphing and rejects oversized Close frames with `ProtocolError::InvalidLength(length)` identically to Ping/Pong control frames. * Added unit test `test_oversized_control_frames`.
  **Post-Mortem & Fix Analysis**:
  > CC @robjtede   Hey all ci's are green! These aint a breaking change but more of patch, right?

- **Issue #4293** (2026-10-03): **refactor(http): replace HTTP/1.1 framing and encoder magic numbers with named constants**
  *Symptoms*: ## PR Type Refactor  ## PR Checklist - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [ ] A changelog entry has been made for the appropriate packages. - [x] Format code with the latest stable rustfmt. - [x] (Team) Label with affected crates and semver status.  ## Overview Replaces raw framing delimiter lengths, head capacity pre-allocations, and ASCII casing bitmasks across the HTTP/1.1 encoder with named constants.  Refs #4226 (Part 4: HTTP/1.1 Framing & Encoder Pre-allocation Cleanup).  ### Changes * `actix-http/src/h1/encoder.rs`:   * Define `INITIAL_HEAD_CAPACITY = 256` for request and response status line pre-allocation.   * Define `COLON_SPACE_LEN = 2` (`: `) and `CRLF_LEN = 2` (`\r\n`).   * Define `HEADER_DELIMITER_LEN = COLON_SPACE_LEN + CRLF_LEN` (4 bytes).   * Define `ASCII_TO_UPPERCASE_MASK = 0b1101_1111` for `write_camel_case` casing arithmetic. * `actix-http/src/h1/chunked.rs`:   * Define `HEX_RADIX = 16` for chunk size decoding.
  **Post-Mortem & Fix Analysis**:
  > CC @robjtede 

- **Issue #4292** (2026-10-02): **refactor(ws): replace framing and protocol magic numbers with named constants**
  *Symptoms*: ## PR Type Refactor  ## PR Checklist - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [ ] A changelog entry has been made for the appropriate packages. - [x] Format code with the latest stable rustfmt. - [x] (Team) Label with affected crates and semver status.  ## Overview Replaces naked framing literals and protocol thresholds across `actix_http::ws` with self-documenting RFC 6455 constants.  Refs #4226 (Part 3: RFC 6455 WebSocket Framing & Protocol Constants).  ### Changes * `actix-http/src/ws/frame.rs`:   * Define RFC 6455 §5.2 header bitmasks: `FIN_MASK` (`0x80`), `RSV_MASK` (`0b0111_0000`), `OPCODE_MASK` (`0x0F`), `MASK_BIT` (`0x80`), and `PAYLOAD_LEN_MASK` (`0x7F`).   * Define RFC 6455 length thresholds: `EXT_LEN_U16` (`126`), `EXT_LEN_U64` (`127`), `MAX_CONTROL_FRAME_PAYLOAD` (`125`), `U16_PAYLOAD_MAX` (`65_535`), and `MASK_LEN` (`4`). * `actix-http/src/ws/proto.rs`:   * Define `WS_ACCEPT_LEN = 28` for `Sec-WebSocket-Accept` Base64 SHA-1 output length. * `actix-http/src/ws/codec.rs`:   * Define `DEFAULT_MAX_FRAME_SIZE = 64 * 1024` (64 KiB default frame limit).
  **Post-Mortem & Fix Analysis**:
  > CC @robjtede 
  > DONE  :heavy_check_mark: 

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

### Incident Patch 1: `ffa0ef73` (2026-10-02)
**Commit Message**: fix(ws): return 426 Upgrade Required on unsupported version (RFC 6455 §4.2.2) (#4295)

**File**: `actix-http/src/ws/mod.rs` (modified, +41/-4)
```diff
@@ -9,7 +9,9 @@ use base64::prelude::*;
 use derive_more::{Display, Error, From};
 use http::{header, Method, StatusCode};
 
-use crate::{body::BoxBody, header::HeaderValue, RequestHead, Response, ResponseBuilder};
+use crate::{
+    body::BoxBody, header::HeaderValue, ConnectionType, RequestHead, Response, ResponseBuilder,
+};
 
 mod codec;
 mod dispatcher;
@@ -141,7 +143,15 @@ impl From<HandshakeError> for Response<BoxBody> {
             }
 
             HandshakeError::UnsupportedVersion => {
-                let mut res = Response::bad_request();
+                #[allow(clippy::declare_interior_mutable_const)]
+                const HV_13: HeaderValue = HeaderValue::from_static("13");
+                #[allow(clippy::declare_interior_mutable_const)]
+                const HV_WEBSOCKET: HeaderValue = HeaderValue::from_static("websocket");
+                let mut res = Response::new(StatusCode::UPGRADE_REQUIRED);
+                res.head_mut().set_connection_type(ConnectionType::Upgrade);
+                res.headers_mut().insert(header::UPGRADE, HV_WEBSOCKET);
+                res.headers_mut()
+                    .insert(header::SEC_WEBSOCKET_VERSION, HV_13);
                 res.head_mut().reason = Some("Unsupported WebSocket version");
                 res
             }
@@ -199,7 +209,7 @@ pub fn verify_handshake(req: &RequestHead) -> Result<(), HandshakeError> {
     }
     let supported_ver = {
         if let Some(hdr) = req.headers().get(header::SEC_WEBSOCKET_VERSION) {
-            hdr == "13" || hdr == "8" || hdr == "7"
+            hdr == "13"
         } else {
             false
         }
@@ -312,6 +322,27 @@ mod tests {
             verify_handshake(req.head()).unwrap_err(),
         );
 
+        for &ver in &["7", "8"] {
+            let req = TestRequest::default()
+                .insert_header((
+                    header::UPGRADE,
+                    header::HeaderValue::from_static("websocket"),
+                ))
+                .insert_header((
+                    header::CONNECTION,
+                    header::HeaderValue::from_static("upgrade"),
+                ))
+                .insert_header((
+                    header::SEC_WEBSOCKET_VERSION,
+                    header::HeaderValue::from_static(ver),
+                ))
+                .finish();
+            assert_eq!(
+                HandshakeError::UnsupportedVersion,
+                verify_handshake(req.head()).unwrap_err(),
+            );
+        }
+
         let req = TestRequest::default()
             .insert_header((
                 header::UPGRADE,
@@ -391,7 +422,13 @@ mod tests {
         let resp: Response<BoxBody> = HandshakeError::NoVersionHeader.into();
         assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
         let resp: Response<BoxBody> = HandshakeError::UnsupportedVersion.into();
-        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
+        assert_eq!(resp.status(), StatusCode::UPGRADE_REQUIRED);
+        assert!(resp.upgrade());
+        assert_eq!(resp.headers().get(header::UPGRADE).unwrap(), "websocket");
+        assert_eq!(
+            resp.headers().get(header::SEC_WEBSOCKET_VERSION).unwrap(),
+            "13"
+        );
         let resp: Response<BoxBody> = HandshakeError::BadWebsocketKey.into();
         assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
     }
```

**File**: `actix-web-actors/src/ws.rs` (modified, +22/-1)
```diff
@@ -404,7 +404,7 @@ pub fn handshake_with_protocols(
     }
     let supported_ver = {
         if let Some(hdr) = req.headers().get(&header::SEC_WEBSOCKET_VERSION) {
-            hdr == "13" || hdr == "8" || hdr == "7"
+            hdr == "13"
         } else {
             false
         }
@@ -883,6 +883,27 @@ mod tests {
             handshake(&req).err().unwrap()
         );
 
+        for &ver in &["7", "8"] {
+            let req = TestRequest::default()
+                .insert_header((
+                    header::UPGRADE,
+                    header::HeaderValue::from_static("websocket"),
+                ))
+                .insert_header((
+                    header::CONNECTION,
+                    header::HeaderValue::from_static("upgrade"),
+                ))
+                .insert_header((
+                    header::SEC_WEBSOCKET_VERSION,
+                    header::HeaderValue::from_static(ver),
+                ))
+                .to_http_request();
+            assert_eq!(
+                HandshakeError::UnsupportedVersion,
+                handshake(&req).err().unwrap()
+            );
+        }
+
         let req = TestRequest::default()
             .insert_header((
                 header::UPGRADE,
```

---

### Incident Patch 2: `4524d5e6` (2026-10-02)
**Commit Message**: fix(ws): validate 16-byte base64 nonce in Sec-WebSocket-Key (RFC 6455 §4.2.1) (#4296)

* fix(ws): validate 16-byte base64 nonce in Sec-WebSocket-Key (RFC 6455 §4.2.1)

* style: fix rustfmt line-wrapping and import ordering

**File**: `actix-http/src/ws/mod.rs` (modified, +34/-3)
```diff
@@ -5,6 +5,7 @@
 
 use std::io;
 
+use base64::prelude::*;
 use derive_more::{Display, Error, From};
 use http::{header, Method, StatusCode};
 
@@ -207,8 +208,14 @@ pub fn verify_handshake(req: &RequestHead) -> Result<(), HandshakeError> {
         return Err(HandshakeError::UnsupportedVersion);
     }
 
-    // check client handshake for validity
-    if !req.headers().contains_key(header::SEC_WEBSOCKET_KEY) {
+    // check client handshake for validity (RFC 6455 §4.2.1 clause 5)
+    let key = match req.headers().get(header::SEC_WEBSOCKET_KEY) {
+        Some(key) => key.as_bytes(),
+        None => return Err(HandshakeError::BadWebsocketKey),
+    };
+
+    let mut decoded = [0u8; 16];
+    if key.len() != 24 || BASE64_STANDARD.decode_slice(key, &mut decoded) != Ok(16) {
         return Err(HandshakeError::BadWebsocketKey);
     }
     Ok(())
@@ -340,13 +347,37 @@ mod tests {
             ))
             .insert_header((
                 header::SEC_WEBSOCKET_KEY,
-                header::HeaderValue::from_static("13"),
+                header::HeaderValue::from_static("dGhlIHNhbXBsZSBub25jZQ=="),
             ))
             .finish();
         assert_eq!(
             StatusCode::SWITCHING_PROTOCOLS,
             handshake(req.head()).unwrap().finish().status()
         );
+
+        // Invalid key length / non-16-byte base64 nonce
+        let req = TestRequest::default()
+            .insert_header((
+                header::UPGRADE,
+                header::HeaderValue::from_static("websocket"),
+            ))
+            .insert_header((
+                header::CONNECTION,
+                header::HeaderValue::from_static("upgrade"),
+            ))
+            .insert_header((
+                header::SEC_WEBSOCKET_VERSION,
+                header::HeaderValue::from_static("13"),
+            ))
+            .insert_header((
+                header::SEC_WEBSOCKET_KEY,
+                header::HeaderValue::from_static("13"),
+            ))
+            .finish();
+        assert_eq!(
+            HandshakeError::BadWebsocketKey,
+            verify_handshake(req.head()).unwrap_err(),
+        );
     }
 
     #[test]
```

---

### Incident Patch 3: `0bdc8e72` (2026-10-02)
**Commit Message**: fix(ws): reject oversized close control frames (RFC 6455 §5.5) (#4294)

**File**: `actix-http/src/ws/frame.rs` (modified, +21/-7)
```diff
@@ -1,7 +1,6 @@
 use std::{cmp::min, io, str};
 
 use bytes::{Buf, BufMut, BytesMut};
-use tracing::debug;
 
 use super::{
     mask::apply_mask,
@@ -169,15 +168,11 @@ impl Parser {
 
         let mut data = src.split_to(length);
 
-        // control frames must have length <= 125
+        // control frames must have length <= 125 (RFC 6455 §5.5)
         match opcode {
-            OpCode::Ping | OpCode::Pong if length > MAX_CONTROL_FRAME_PAYLOAD => {
+            OpCode::Ping | OpCode::Pong | OpCode::Close if length > MAX_CONTROL_FRAME_PAYLOAD => {
                 return Err(ProtocolError::InvalidLength(length));
             }
-            OpCode::Close if length > MAX_CONTROL_FRAME_PAYLOAD => {
-                debug!("Received close frame with payload length exceeding 125. Morphing to protocol close frame.");
-                return Ok(Some((true, OpCode::Close, None)));
-            }
             _ => {}
         }
 
@@ -541,6 +536,25 @@ mod tests {
         ));
     }
 
+    #[test]
+    fn test_oversized_control_frames() {
+        // Ping frame with 126 bytes payload (exceeding 125 limit)
+        let mut buf = BytesMut::from(&[0x89u8, 126u8, 0x00, 126][..]);
+        buf.extend(vec![0u8; 126]);
+        assert!(matches!(
+            Parser::parse(&mut buf, false, 65536),
+            Err(ProtocolError::InvalidLength(126))
+        ));
+
+        // Close frame with 126 bytes payload (exceeding 125 limit)
+        let mut buf = BytesMut::from(&[0x88u8, 126u8, 0x00, 126][..]);
+        buf.extend(vec![0u8; 126]);
+        assert!(matches!(
+            Parser::parse(&mut buf, false, 65536),
+            Err(ProtocolError::InvalidLength(126))
+        ));
+    }
+
     #[test]
     fn test_parse_length_overflow() {
         let buf: [u8; 14] = [
```

---

### Incident Patch 4: `ef1e6f3d` (2026-10-02)
**Commit Message**: build(deps): bump taiki-e/install-action from 2.87.12 to 2.87.21 (#4284)

* build(deps): bump taiki-e/install-action from 2.87.12 to 2.87.21

Bumps [taiki-e/install-action](https://github.com/taiki-e/install-action) from 2.87.12 to 2.87.21.
- [Release notes](https://github.com/taiki-e/install-action/releases)
- [Changelog](https://github.com/taiki-e/install-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/taiki-e/install-action/compare/3f74d7c16a4242f1c95561e98edc25d36adb4375...4cef1412cce204788f482e778a0b9187f9626a29)

---
updated-dependencies:
- dependency-name: taiki-e/install-action
  dependency-version: 2.87.21
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* ci: update install-action lock file

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Rob Ede <[REDACTED_EMAIL]>

**File**: `.github/workflows/actions.lock` (modified, +8/-8)
```diff
@@ -9,18 +9,18 @@ workflows:
         - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
         - 'ilammy/setup-nasm@72793074d3c8cdda771dba85f6deafe00623038b'
         - 'rui314/setup-mold@10ca16bf91dc22e05ebdc935cad9c75ea248f621'
-        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
+        - 'taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29'
         - 'useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a'
     '.github/workflows/ci.yml':
         - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
         - 'ilammy/setup-nasm@72793074d3c8cdda771dba85f6deafe00623038b'
         - 'rui314/setup-mold@10ca16bf91dc22e05ebdc935cad9c75ea248f621'
-        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
+        - 'taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29'
         - 'useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a'
     '.github/workflows/coverage.yml':
         - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
         - 'actions/upload-code-coverage@1c15be36fc3733ba839b1dd643bd9556e4426dc1'
-        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
+        - 'taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29'
         - 'useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a'
     '.github/workflows/labeler.yml':
         - 'actions/labeler@bf12e9b00b37c5c0ca2b87b79b2daf7891dbda13'
@@ -30,12 +30,12 @@ workflows:
         - 'embarkstudios/cargo-deny-action@3c6349835b2b7b196a839186cb8b78e02f7b5f25'
         - 'giraffate/clippy-action@13b9d32482f25d29ead141b79e7e04e7900281e0'
         - 'taiki-e/cache-cargo-install-action@9ee83daaa7b96a6fab930949ecf1122bba04a389'
-        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
+        - 'taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29'
         - 'useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a'
         - 'zizmorcore/zizmor-action@cc914d7f3750a2d13d75c7f184a1060aa0e9d482'
     '.github/workflows/semver-checks.yml':
         - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
-        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
+        - 'taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29'
         - 'useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a'
 dependencies:
     'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f':
@@ -97,9 +97,9 @@ dependencies:
         repo_id: 588643148
         uses:
             - 'actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9'
-    'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375':
-        ref: 'v2.87.12'
-        commit: 'sha1-3f74d7c16a4242f1c95561e98edc25d36adb4375'
+    'taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29':
+        ref: 'v2.87.21'
+        commit: 'sha1-4cef1412cce204788f482e778a0b9187f9626a29'
         owner_id: 43724913
         repo_id: 442947557
     'useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a':
```

**File**: `.github/workflows/ci-post-merge.yml` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@ jobs:
           toolchain: ${{ matrix.version.version }}
 
       - name: Install just, cargo-hack, cargo-nextest, cargo-ci-cache-clean
-        uses: taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375 # v2.87.12
+        uses: taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29 # v2.87.21
         with:
           tool: just,cargo-hack,cargo-nextest,cargo-ci-cache-clean
 
@@ -89,7 +89,7 @@ jobs:
         uses: actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f # v2.0.0
 
       - name: Install just, cargo-hack
-        uses: taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375 # v2.87.12
+        uses: taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29 # v2.87.21
         with:
           tool: just,cargo-hack
 
```

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -68,7 +68,7 @@ jobs:
           toolchain: ${{ matrix.version.version }}
 
       - name: Install just, cargo-hack, cargo-nextest, cargo-ci-cache-clean
-        uses: taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375 # v2.87.12
+        uses: taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29 # v2.87.21
         with:
           tool: just,cargo-hack,cargo-nextest,cargo-ci-cache-clean
 
@@ -103,7 +103,7 @@ jobs:
           toolchain: nightly
 
       - name: Install just
-        uses: taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375 # v2.87.12
+        uses: taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29 # v2.87.21
         with:
           tool: just
 
```

**File**: `.github/workflows/coverage.yml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ jobs:
           components: llvm-tools
 
       - name: Install just, cargo-llvm-cov, cargo-nextest
-        uses: taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375 # v2.87.12
+        uses: taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29 # v2.87.21
         with:
           tool: just,cargo-llvm-cov,cargo-nextest
 
```

**File**: `.github/workflows/lint.yml` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ jobs:
           toolchain: ${{ vars.RUST_VERSION_EXTERNAL_TYPES }}
 
       - name: Install just
-        uses: taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375 # v2.87.12
+        uses: taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29 # v2.87.21
         with:
           tool: just
 
```

**File**: `.github/workflows/semver-checks.yml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
           toolchain: stable
 
       - name: Install cargo-semver-checks
-        uses: taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375 # v2.87.12
+        uses: taiki-e/install-action@4cef1412cce204788f482e778a0b9187f9626a29 # v2.87.21
         with:
           tool: cargo-semver-checks
 
```

---

### Incident Patch 5: `758f6ee3` (2026-09-30)
**Commit Message**: build(deps): bump actix-utils from 3.0.1 to 3.0.2 (#4285)

* build(deps): bump actix-utils from 3.0.1 to 3.0.2

Bumps [actix-utils](https://github.com/actix/actix-net) from 3.0.1 to 3.0.2.
- [Release notes](https://github.com/actix/actix-net/releases)
- [Commits](https://github.com/actix/actix-net/compare/tls-v3.0.1...tls-v3.0.2)

---
updated-dependencies:
- dependency-name: actix-utils
  dependency-version: 3.0.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* fix: preserve ready future types after actix-utils update

Retain the public Actix ready future types and use scoped deprecation expectations so warning-deny CI builds pass with actix-utils 3.0.2.

Replace ok and err helpers with ready(Ok(...)) and ready(Err(...)). Use standard ready futures in tests and internal services.

Set workspace lint group priorities below the explicit linker_messages override to pass Clippy.

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Rob Ede <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -309,9 +309,9 @@ dependencies = [
 
 [[package]]
 name = "actix-utils"
-version = "3.0.1"
+version = "3.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "88a1dcdff1466e3c2488e1cb5c36a71822750ad43839937f85d2f4d9f8b705d8"
+checksum = "0128396dd7313f697ad05b21b1a7be7d4cbb81888704f55996e4a27db196bb4d"
 dependencies = [
  "local-waker",
  "pin-project-lite",
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -51,9 +51,9 @@ awc = { path = "awc" }
 # actix-server = { path = "../actix-net/actix-server" }
 
 [workspace.lints.rust]
-rust_2018_idioms = { level = "deny" }
-future_incompatible = { level = "deny" }
-nonstandard_style = { level = "deny" }
+rust_2018_idioms = { level = "deny", priority = -1 }
+future_incompatible = { level = "deny", priority = -1 }
+nonstandard_style = { level = "deny", priority = -1 }
 linker_messages = { level = "allow" }
 
 [workspace.lints.clippy]
```

**File**: `actix-files/src/path_buf.rs` (modified, +2/-0)
```diff
@@ -4,6 +4,7 @@ use std::{
     str::FromStr,
 };
 
+#[expect(deprecated, reason = "preserve the public ready future type")]
 use actix_utils::future::{ready, Ready};
 use actix_web::{dev::Payload, FromRequest, HttpRequest};
 
@@ -125,6 +126,7 @@ impl AsRef<Path> for PathBufWrap {
     }
 }
 
+#[expect(deprecated, reason = "preserve the public ready future type")]
 impl FromRequest for PathBufWrap {
     type Error = UriSegmentError;
     type Future = Ready<Result<Self, Self::Error>>;
```

**File**: `actix-http/examples/tls_rustls.rs` (modified, +2/-3)
```diff
@@ -14,10 +14,9 @@
 
 extern crate tls_rustls_023 as rustls;
 
-use std::io;
+use std::{future::ready, io};
 
 use actix_http::{Error, HttpService, Request, Response};
-use actix_utils::future::ok;
 
 #[actix_rt::main]
 async fn main() -> io::Result<()> {
@@ -34,7 +33,7 @@ async fn main() -> io::Result<()> {
                         Protocol: {:?}",
                         req.head().version
                     );
-                    ok::<_, Error>(Response::ok().set_body(body))
+                    ready(Ok::<_, Error>(Response::ok().set_body(body)))
                 })
                 .rustls_0_23(rustls_config())
         })?
```

**File**: `actix-http/src/h1/dispatcher_tests.rs` (modified, +1/-2)
```diff
@@ -1,6 +1,6 @@
 use std::{
     cell::Cell,
-    future::Future,
+    future::{ready, Future, Ready},
     pin::{pin, Pin},
     rc::Rc,
     str,
@@ -10,7 +10,6 @@ use std::{
 
 use actix_codec::Framed;
 use actix_service::{fn_service, Service};
-use actix_utils::future::{ready, Ready};
 use bytes::BytesMut;
 use futures_util::future::lazy;
 use tokio::time::{sleep, timeout};
```

**File**: `actix-http/src/h1/expect.rs` (modified, +3/-0)
```diff
@@ -1,10 +1,12 @@
 use actix_service::{Service, ServiceFactory};
+#[expect(deprecated, reason = "preserve the public ready future type")]
 use actix_utils::future::{ready, Ready};
 
 use crate::{Error, Request};
 
 pub struct ExpectHandler;
 
+#[expect(deprecated, reason = "preserve the public ready future type")]
 impl ServiceFactory<Request> for ExpectHandler {
     type Response = Request;
     type Error = Error;
@@ -18,6 +20,7 @@ impl ServiceFactory<Request> for ExpectHandler {
     }
 }
 
+#[expect(deprecated, reason = "preserve the public ready future type")]
 impl Service<Request> for ExpectHandler {
     type Response = Request;
     type Error = Error;
```

**File**: `actix-http/src/h1/service.rs` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@ use actix_codec::{AsyncRead, AsyncWrite, Framed};
 use actix_service::{
     fn_service, IntoServiceFactory, Service, ServiceFactory, ServiceFactoryExt as _,
 };
+#[expect(deprecated, reason = "preserve the public ready future type")]
 use actix_utils::future::ready;
 use futures_core::future::LocalBoxFuture;
 use tokio::net::TcpStream;
@@ -79,6 +80,7 @@ where
     U::InitError: fmt::Debug,
 {
     /// Create simple tcp stream service
+    #[expect(deprecated, reason = "preserve the public ready future type")]
     pub fn tcp(
         self,
     ) -> impl ServiceFactory<TcpStream, Config = (), Response = (), Error = DispatchError, InitError = ()>
```

**File**: `actix-http/src/h2/service.rs` (modified, +2/-0)
```diff
@@ -11,6 +11,7 @@ use actix_codec::{AsyncRead, AsyncWrite};
 use actix_service::{
     fn_factory, fn_service, IntoServiceFactory, Service, ServiceFactory, ServiceFactoryExt as _,
 };
+#[expect(deprecated, reason = "preserve the public ready future type")]
 use actix_utils::future::ready;
 use futures_core::{future::LocalBoxFuture, ready};
 use tokio::net::TcpStream;
@@ -83,6 +84,7 @@ where
     B: MessageBody + 'static,
 {
     /// Create plain TCP based service
+    #[expect(deprecated, reason = "preserve the public ready future type")]
     pub fn tcp(
         self,
     ) -> impl ServiceFactory<
```

---

### Incident Patch 6: `37cc911c` (2026-09-30)
**Commit Message**: build(deps): bump actix-macros from 0.2.4 to 0.2.5 (#4289)

Bumps [actix-macros](https://github.com/actix/actix-net) from 0.2.4 to 0.2.5.
- [Release notes](https://github.com/actix/actix-net/releases)
- [Changelog](https://github.com/actix/actix-net/blob/v0.2.5/CHANGES.md)
- [Commits](https://github.com/actix/actix-net/compare/v0.2.4...v0.2.5)

---
updated-dependencies:
- dependency-name: actix-macros
  dependency-version: 0.2.5
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +4/-3)
```diff
@@ -130,12 +130,13 @@ dependencies = [
 
 [[package]]
 name = "actix-macros"
-version = "0.2.4"
+version = "0.2.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e01ed3140b2f8d422c68afa1ed2e85d996ea619c988ac834d255db32138655cb"
+checksum = "367f814ad4afbac74f07df5001214da65f65e185c90ef56c4dd8df23f8695b9b"
 dependencies = [
+ "proc-macro2",
  "quote",
- "syn 2.0.119",
+ "syn 3.0.5",
 ]
 
 [[package]]
```

---

### Incident Patch 7: `89b6f898` (2026-09-30)
**Commit Message**: build(deps): bump actix-rt from 2.14.0 to 2.15.0 (#4288)

Bumps [actix-rt](https://github.com/actix/actix-net) from 2.14.0 to 2.15.0.
- [Release notes](https://github.com/actix/actix-net/releases)
- [Commits](https://github.com/actix/actix-net/compare/rt-v2.14.0...rt-v2.15.0)

---
updated-dependencies:
- dependency-name: actix-rt
  dependency-version: 2.15.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -215,9 +215,9 @@ dependencies = [
 
 [[package]]
 name = "actix-rt"
-version = "2.14.0"
+version = "2.15.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cd8da217b2da141a847749e497713951864f81e6c6a2c1aa10ab02ee9a6dd6be"
+checksum = "e5f794807f82bbd36430c12cd600c73bbab0f52fdde4f0ed49978df113f4807f"
 dependencies = [
  "actix-macros",
  "futures-core",
```

---

### Incident Patch 8: `1c2d4b53` (2026-09-30)
**Commit Message**: build(deps): bump actix-server from 2.9.5 to 2.9.7 (#4287)

Bumps [actix-server](https://github.com/actix/actix-net) from 2.9.5 to 2.9.7.
- [Release notes](https://github.com/actix/actix-net/releases)
- [Commits](https://github.com/actix/actix-net/compare/server-v2.9.5...server-v2.9.7)

---
updated-dependencies:
- dependency-name: actix-server
  dependency-version: 2.9.7
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -226,9 +226,9 @@ dependencies = [
 
 [[package]]
 name = "actix-server"
-version = "2.9.5"
+version = "2.9.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "aec21d555b23ee78a1c0e4ed61667935de7d61664caba878226a081b1ac20a74"
+checksum = "8db2cf6f034e227c0c79825fbf11f3cad48569109515f62542b84d8abedb9376"
 dependencies = [
  "actix-rt",
  "actix-service",
```

---

### Incident Patch 9: `b8f0ee59` (2026-09-30)
**Commit Message**: build(deps): bump actix-tls from 3.6.0 to 3.6.1 (#4286)

Bumps [actix-tls](https://github.com/actix/actix-net) from 3.6.0 to 3.6.1.
- [Release notes](https://github.com/actix/actix-net/releases)
- [Commits](https://github.com/actix/actix-net/compare/tls-v3.6.0...tls-v3.6.1)

---
updated-dependencies:
- dependency-name: actix-tls
  dependency-version: 3.6.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -278,9 +278,9 @@ dependencies = [
 
 [[package]]
 name = "actix-tls"
-version = "3.6.0"
+version = "3.6.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "21d0a5de50893252dfa9d7c4bf83761bcc1920651916cd9da24c974cf8ee1b92"
+checksum = "c5d41b969edabcf8784fe0215f88b33e120dde04aace700bda8f78d77ca6bd81"
 dependencies = [
  "actix-rt",
  "actix-service",
```

---

### Incident Patch 10: `20dc029b` (2026-09-28)
**Commit Message**: fix(http): correct encoder diagnostics and header documentation (#4280)

Co-authored-by: WaterWhisperer <[REDACTED_EMAIL]>

**File**: `actix-http/src/encoding/encoder.rs` (modified, +4/-4)
```diff
@@ -409,7 +409,7 @@ impl ContentEncoder {
             ContentEncoder::Brotli(ref mut encoder) => match encoder.write_all(data) {
                 Ok(_) => Ok(()),
                 Err(err) => {
-                    trace!("Error decoding br encoding: {}", err);
+                    trace!("Error encoding br data: {}", err);
                     Err(err)
                 }
             },
@@ -418,7 +418,7 @@ impl ContentEncoder {
             ContentEncoder::Gzip(ref mut encoder) => match encoder.write_all(data) {
                 Ok(_) => Ok(()),
                 Err(err) => {
-                    trace!("Error decoding gzip encoding: {}", err);
+                    trace!("Error encoding gzip data: {}", err);
                     Err(err)
                 }
             },
@@ -427,7 +427,7 @@ impl ContentEncoder {
             ContentEncoder::Deflate(ref mut encoder) => match encoder.write_all(data) {
                 Ok(_) => Ok(()),
                 Err(err) => {
-                    trace!("Error decoding deflate encoding: {}", err);
+                    trace!("Error encoding deflate data: {}", err);
                     Err(err)
                 }
             },
@@ -436,7 +436,7 @@ impl ContentEncoder {
             ContentEncoder::Zstd(ref mut encoder) => match encoder.write_all(data) {
                 Ok(_) => Ok(()),
                 Err(err) => {
-                    trace!("Error decoding ztsd encoding: {}", err);
+                    trace!("Error encoding zstd data: {}", err);
                     Err(err)
                 }
             },
```

**File**: `actix-web/src/http/header/last_modified.rs` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ crate::http::header::common_header! {
     ///
     /// # ABNF
     /// ```plain
-    /// Expires = HTTP-date
+    /// Last-Modified = HTTP-date
     /// ```
     ///
     /// # Example Values
```

---

### Incident Patch 11: `3e55aac0` (2026-09-28)
**Commit Message**: fix(http): validate 100-continue expectations (#4279)

Co-authored-by: WaterWhisperer <[REDACTED_EMAIL]>

**File**: `actix-http/CHANGES.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## Unreleased
 
 - Parse all HTTP/1 `Connection` header options consistently.
+- Only treat `Expect: 100-continue` as a continue expectation in HTTP/1.1 requests.
 
 ## 3.18.12
 
```

**File**: `actix-http/src/builder.rs` (modified, +1/-1)
```diff
@@ -206,7 +206,7 @@ where
 
     /// Provide service for `EXPECT: 100-Continue` support.
     ///
-    /// Service get called with request that contains `EXPECT` header.
+    /// Service get called with request that contains `EXPECT: 100-Continue` header.
     /// Service must return request in case of success, in that case
     /// request will be forwarded to main service.
     pub fn expect<F, X1>(self, expect: F) -> HttpServiceBuilder<T, S, X1, U>
```

**File**: `actix-http/src/h1/decoder.rs` (modified, +45/-5)
```diff
@@ -187,11 +187,27 @@ pub(crate) trait MessageType: Sized {
                         }
                     }
 
-                    header::EXPECT => {
-                        let bytes = value.as_bytes();
-                        if bytes.len() >= 4 && &bytes[0..4] == b"100-" {
-                            expect = true;
-                        }
+                    header::EXPECT if version == Version::HTTP_11 => {
+                        let mut quoted = false;
+                        let mut escaped = false;
+                        expect = expect
+                            || value
+                                .as_bytes()
+                                .split(|&byte| {
+                                    if escaped {
+                                        escaped = false;
+                                    } else if quoted && byte == b'\\' {
+                                        escaped = true;
+                                    } else if byte == b'"' {
+                                        quoted = !quoted;
+                                    } else {
+                                        return byte == b',' && !quoted;
+                                    }
+                                    false
+                                })
+                                .any(|item| {
+                                    item.trim_ascii().eq_ignore_ascii_case(b"100-continue")
+                                });
                     }
 
                     _ => {}
@@ -873,6 +889,30 @@ mod tests {
         assert_eq!(val[1], "c2=cookie2");
     }
 
+    #[test]
+    fn test_expect_100_continue() {
+        for (value, expected) in [
+            ("100-custom, 100-Continue", true),
+            ("100-custom", false),
+            (r#"custom="foo, 100-continue, bar""#, false),
+            (r#"custom="foo\", 100-continue, bar""#, false),
+            (r#"custom="foo\\", 100-Continue"#, true),
+            (r#"custom="é, bar", 100-Continue"#, true),
+        ] {
+            let raw =
+                format!("POST /test HTTP/1.1\r\nHost: localhost\r\ncontent-length: 1\r\nexpect: {value}\r\n\r\n");
+            let req = parse_ready!(&mut BytesMut::from(raw.as_str()));
+            assert_eq!(req.head().expect(), expected, "{value:?}");
+        }
+
+        let req = parse_ready!(&mut BytesMut::from(
+            "POST /test HTTP/1.0\r\n\
+             content-length: 1\r\n\
+             expect: 100-continue\r\n\r\n",
+        ));
+        assert!(!req.head().expect());
+    }
+
     #[test]
     fn test_conn_default_1_0() {
         let req = parse_ready!(&mut BytesMut::from("GET /test HTTP/1.0\r\n\r\n"));
```

**File**: `actix-http/src/service.rs` (modified, +2/-2)
```diff
@@ -139,8 +139,8 @@ where
 {
     /// Sets service for `Expect: 100-Continue` handling.
     ///
-    /// An expect service is called with requests that contain an `Expect` header. A successful
-    /// response type is also a request which will be forwarded to the main service.
+    /// An expect service is called with requests that contain an `Expect: 100-Continue` header. A
+    /// successful response type is also a request which will be forwarded to the main service.
     pub fn expect<X1>(self, expect: X1) -> HttpService<T, S, B, X1, U>
     where
         X1: ServiceFactory<Request, Config = (), Response = Request>,
```

---

### Incident Patch 12: `ab23b035` (2026-09-28)
**Commit Message**: fix(http): parse Connection options consistently (#4278)

Co-authored-by: WaterWhisperer <[REDACTED_EMAIL]>

**File**: `actix-http/CHANGES.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Parse all HTTP/1 `Connection` header options consistently.
+
 ## 3.18.12
 
 - Flush compressed response bodies when the source is pending.
```

**File**: `actix-http/src/h1/decoder.rs` (modified, +40/-18)
```diff
@@ -162,19 +162,21 @@ pub(crate) trait MessageType: Sized {
 
                     // connection keep-alive state
                     header::CONNECTION => {
-                        ka = if let Ok(conn) = value.to_str().map(str::trim) {
-                            if conn.eq_ignore_ascii_case("keep-alive") {
-                                Some(ConnectionType::KeepAlive)
-                            } else if conn.eq_ignore_ascii_case("close") {
-                                Some(ConnectionType::Close)
-                            } else if conn.eq_ignore_ascii_case("upgrade") {
-                                Some(ConnectionType::Upgrade)
-                            } else {
-                                None
+                        if let Ok(conn) = value.to_str() {
+                            for option in conn.split(',').map(str::trim) {
+                                if option.eq_ignore_ascii_case("close") {
+                                    ka = Some(ConnectionType::Close);
+                                    break;
+                                } else if option.eq_ignore_ascii_case("upgrade")
+                                    && ka != Some(ConnectionType::Close)
+                                {
+                                    ka = Some(ConnectionType::Upgrade);
+                                } else if option.eq_ignore_ascii_case("keep-alive") && ka.is_none()
+                                {
+                                    ka = Some(ConnectionType::KeepAlive);
+                                }
                             }
-                        } else {
-                            None
-                        };
+                        }
                     }
 
                     header::UPGRADE => {
@@ -978,6 +980,31 @@ mod tests {
         assert_eq!(req.head().connection_type(), ConnectionType::Upgrade);
     }
 
+    #[test]
+    fn test_conn_multi_value() {
+        for (connection, expected) in [
+            ("keep-alive, Upgrade", ConnectionType::Upgrade),
+            ("keep-alive\r\nconnection: Upgrade", ConnectionType::Upgrade),
+            ("close, upgrade", ConnectionType::Close),
+            ("upgrade, close", ConnectionType::Close),
+            ("close\r\nconnection: upgrade", ConnectionType::Close),
+            ("upgrade\r\nconnection: close", ConnectionType::Close),
+            ("not-upgrade", ConnectionType::KeepAlive),
+        ] {
+            let raw = format!(
+                "GET /test HTTP/1.1\r\nHost: localhost\r\nconnection: {connection}\r\n\r\n"
+            );
+            let req = parse_ready!(&mut BytesMut::from(raw.as_str()));
+            assert_eq!(req.head().connection_type(), expected, "{connection:?}");
+            assert_eq!(
+                req.upgrade(),
+                expected == ConnectionType::Upgrade,
+                "{connection:?}"
+            );
+            assert_eq!(req.head().upgrade(), req.upgrade(), "{connection:?}");
+        }
+    }
+
     #[test]
     fn test_conn_upgrade_connect_method() {
         let req = parse_ready!(&mut BytesMut::from(
@@ -1071,12 +1098,7 @@ mod tests {
         );
         let mut reader = MessageDecoder::<Request>::default();
         let (req, pl) = reader.decode(&mut buf).unwrap().unwrap();
-        // `connection: upgrade, http2-settings` doesn't work properly..
-        // see MessageType::set_headers().
-        //
-        // The line below should be:
-        // assert_eq!(req.head().connection_type(), ConnectionType::Upgrade);
-        assert_eq!(req.head().connection_type(), ConnectionType::KeepAlive);
+        assert_eq!(req.head().connection_type(), ConnectionType::Upgrade);
         assert!(req.upgrade());
         assert!(!pl.is_unhandled());
     }
```

**File**: `actix-http/src/requests/head.rs` (modified, +14/-9)
```diff
@@ -107,16 +107,21 @@ impl RequestHead {
 
     /// Connection upgrade status
     pub fn upgrade(&self) -> bool {
-        self.headers()
-            .get(header::CONNECTION)
-            .map(|hdr| {
-                if let Ok(s) = hdr.to_str() {
-                    s.to_ascii_lowercase().contains("upgrade")
-                } else {
-                    false
+        let mut upgrade = false;
+
+        for conn in self.headers().get_all(header::CONNECTION) {
+            if let Ok(conn) = conn.to_str() {
+                for option in conn.split(',').map(str::trim) {
+                    if option.eq_ignore_ascii_case("close") {
+                        return false;
+                    } else if option.eq_ignore_ascii_case("upgrade") {
+                        upgrade = true;
+                    }
                 }
-            })
-            .unwrap_or(false)
+            }
+        }
+
+        upgrade
     }
 
     #[inline]
```

**File**: `actix-http/src/requests/request.rs` (modified, +3/-3)
```diff
@@ -160,9 +160,9 @@ impl<P> Request<P> {
     /// Check if request requires connection upgrade
     #[inline]
     pub fn upgrade(&self) -> bool {
-        if let Some(conn) = self.head().headers.get(header::CONNECTION) {
-            if let Ok(s) = conn.to_str() {
-                return s.to_lowercase().contains("upgrade");
+        for conn in self.head().headers.get_all(header::CONNECTION) {
+            if conn.to_str().is_ok() {
+                return self.head().upgrade();
             }
         }
         self.head().method == Method::CONNECT
```

**File**: `actix-http/src/ws/mod.rs` (modified, +3/-2)
```diff
@@ -331,8 +331,9 @@ mod tests {
             ))
             .insert_header((
                 header::CONNECTION,
-                header::HeaderValue::from_static("upgrade"),
+                header::HeaderValue::from_static("keep-alive"),
             ))
+            .append_header((header::CONNECTION, "Upgrade"))
             .insert_header((
                 header::SEC_WEBSOCKET_VERSION,
                 header::HeaderValue::from_static("13"),
@@ -344,7 +345,7 @@ mod tests {
             .finish();
         assert_eq!(
             StatusCode::SWITCHING_PROTOCOLS,
-            handshake_response(req.head()).finish().status()
+            handshake(req.head()).unwrap().finish().status()
         );
     }
 
```

**File**: `awc/CHANGES.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Parse all `Connection` header options when validating WebSocket handshakes.
+
 ## 3.9.0
 
 - Add camel-case header controls to `WebsocketsRequest` via `camel_case_headers()` and `set_camel_case_headers()`.
```

**File**: `awc/src/ws.rs` (modified, +17/-9)
```diff
@@ -385,19 +385,27 @@ impl WebsocketsRequest {
         }
 
         // Check for "CONNECTION" header
-        if let Some(conn) = head.headers.get(&header::CONNECTION) {
-            if let Ok(s) = conn.to_str() {
-                if !s.to_ascii_lowercase().contains("upgrade") {
-                    log::trace!("Invalid connection header: {}", s);
-                    return Err(WsClientError::InvalidConnectionHeader(conn.clone()));
+        let mut upgrade = false;
+        for conn in head.headers.get_all(header::CONNECTION) {
+            if let Ok(value) = conn.to_str() {
+                for option in value.split(',').map(str::trim) {
+                    if option.eq_ignore_ascii_case("close") {
+                        log::trace!("Invalid connection header: {:?}", conn);
+                        return Err(WsClientError::InvalidConnectionHeader(conn.clone()));
+                    } else if option.eq_ignore_ascii_case("upgrade") {
+                        upgrade = true;
+                    }
                 }
-            } else {
+            }
+        }
+        if !upgrade {
+            if let Some(conn) = head.headers.get(header::CONNECTION) {
                 log::trace!("Invalid connection header: {:?}", conn);
                 return Err(WsClientError::InvalidConnectionHeader(conn.clone()));
+            } else {
+                log::trace!("Missing connection header");
+                return Err(WsClientError::MissingConnectionHeader);
             }
-        } else {
-            log::trace!("Missing connection header");
-            return Err(WsClientError::MissingConnectionHeader);
         }
 
         if let Some(hdr_key) = head.headers.get(&header::SEC_WEBSOCKET_ACCEPT) {
```

---

### Incident Patch 13: `b290368a` (2026-09-26)
**Commit Message**: fix(http): flush compressed response bodies when the source is pending (#4256)

* fix(http): flush compressed response bodies when the source is pending

* docs: update changelog

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -3527,6 +3527,7 @@ dependencies = [
  "futures-sink",
  "libc",
  "pin-project-lite",
+ "slab",
  "tokio",
 ]
 
```

**File**: `actix-http/CHANGES.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Flush compressed response bodies when the source is pending.
+
 ## 3.18.11
 
 - Reject requests with a missing or duplicate `Host` header in HTTP/1.1 requests.
```

**File**: `actix-http/src/encoding/encoder.rs` (modified, +44/-1)
```diff
@@ -34,6 +34,7 @@ pin_project! {
         body: EncoderBody<B>,
         encoder: Option<ContentEncoder>,
         fut: Option<JoinHandle<Result<ContentEncoder, io::Error>>>,
+        needs_flush: bool,
         eof: bool,
     }
 }
@@ -46,6 +47,7 @@ impl<B: MessageBody> Encoder<B> {
             },
             encoder: None,
             fut: None,
+            needs_flush: false,
             eof: true,
         }
     }
@@ -55,6 +57,7 @@ impl<B: MessageBody> Encoder<B> {
             body: EncoderBody::Full { body: Bytes::new() },
             encoder: None,
             fut: None,
+            needs_flush: false,
             eof: true,
         }
     }
@@ -87,6 +90,7 @@ impl<B: MessageBody> Encoder<B> {
                     body,
                     encoder: Some(enc),
                     fut: None,
+                    needs_flush: false,
                     eof: false,
                 };
             }
@@ -96,6 +100,7 @@ impl<B: MessageBody> Encoder<B> {
             body,
             encoder: None,
             fut: None,
+            needs_flush: false,
             eof: false,
         }
     }
@@ -199,13 +204,35 @@ where
                 }
             }
 
-            let result = ready!(this.body.as_mut().poll_next(cx));
+            let result = match this.body.as_mut().poll_next(cx) {
+                Poll::Ready(result) => result,
+
+                Poll::Pending => {
+                    if *this.needs_flush {
+                        if let Some(encoder) = this.encoder.as_mut() {
+                            // Release buffered content when the producer pauses.
+                            encoder.flush().map_err(EncoderError::Io)?;
+                            *this.needs_flush = false;
+
+                            let chunk = encoder.take();
+
+                            if !chunk.is_empty() {
+                                return Poll::Ready(Some(Ok(chunk)));
+                            }
+                        }
+                    }
+
+                    return Poll::Pending;
+                }
+            };
 
             match result {
                 Some(Err(err)) => return Poll::Ready(Some(Err(err))),
 
                 Some(Ok(chunk)) => {
                     if let Some(mut encoder) = this.encoder.take() {
+                        *this.needs_flush |= !chunk.is_empty();
+
                         if chunk.len() < MAX_CHUNK_SIZE_ENCODE_IN_PLACE {
                             encoder.write(&chunk).map_err(EncoderError::Io)?;
                             let chunk = encoder.take();
@@ -332,6 +359,22 @@ impl ContentEncoder {
         }
     }
 
+    fn flush(&mut self) -> Result<(), io::Error> {
+        match self {
+            #[cfg(feature = "compress-brotli")]
+            ContentEncoder::Brotli(encoder) => encoder.flush(),
+
+            #[cfg(feature = "compress-gzip")]
+            ContentEncoder::Gzip(encoder) => encoder.flush(),
+
+            #[cfg(feature = "compress-gzip")]
+            ContentEncoder::Deflate(encoder) => encoder.flush(),
+
+            #[cfg(feature = "compress-zstd")]
+            ContentEncoder::Zstd(encoder) => encoder.flush(),
+        }
+    }
+
     fn finish(self) -> Result<Bytes, io::Error> {
         match self {
             #[cfg(feature = "compress-brotli")]
```

**File**: `actix-web/Cargo.toml` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ static_assertions = "1"
 tls-openssl = { package = "openssl", version = "0.10.55" }
 tls-rustls = { package = "rustls", version = "0.23" }
 tokio = { version = "1.38.2", features = ["rt-multi-thread", "macros", "time"] }
-tokio-util = "0.7"
+tokio-util = { version = "0.7", default-features = false, features = ["time"] }
 zstd = "0.13"
 
 [lints]
```

**File**: `actix-web/tests/compression.rs` (modified, +55/-0)
```diff
@@ -1,10 +1,14 @@
+use std::{io, time::Duration};
+
 use actix_http::ContentEncoding;
 use actix_web::{
     http::{header, StatusCode},
     middleware::Compress,
     web, App, HttpResponse,
 };
 use bytes::Bytes;
+use futures_util::{stream, StreamExt as _};
+use tokio_util::future::FutureExt as _;
 
 mod utils;
 
@@ -302,6 +306,57 @@ async fn deny_identity_coding_no_decompress() {
     srv.stop().await;
 }
 
+// Regression test for https://github.com/actix/actix-web/issues/3410.
+#[actix_rt::test]
+async fn gzip_stream_delivers_content_while_body_is_pending() {
+    const INITIAL_CONTENT: &[u8] = b"This content appears immediately";
+
+    let srv = actix_test::start(|| {
+        App::new()
+            .wrap(Compress::default())
+            .default_service(web::to(|| async {
+                let body =
+                    stream::once(async { Ok::<_, io::Error>(Bytes::from_static(INITIAL_CONTENT)) })
+                        // Keep the body open so completion cannot flush the compressor.
+                        .chain(stream::pending());
+
+                HttpResponse::Ok()
+                    .content_type("text/html; charset=utf-8")
+                    .streaming(body)
+            }))
+    });
+
+    let mut res = srv
+        .get("/")
+        .insert_header((header::ACCEPT_ENCODING, "gzip"))
+        .send()
+        .await
+        .unwrap();
+
+    assert_eq!(res.status(), StatusCode::OK);
+    assert_eq!(res.headers().get(header::CONTENT_ENCODING).unwrap(), "gzip");
+
+    // Read decoded content, since a gzip header alone does not make progress.
+    let content = async {
+        let mut content = Vec::new();
+
+        while content.len() < INITIAL_CONTENT.len() {
+            let chunk = res.next().await.unwrap().unwrap();
+            content.extend_from_slice(&chunk);
+        }
+
+        content
+    }
+    .timeout(Duration::from_secs(1))
+    .await;
+
+    drop(res);
+    srv.stop().await;
+
+    let content = content.expect("gzip retained content while the response body was pending");
+    assert_eq!(content, INITIAL_CONTENT);
+}
+
 // TODO: fix test
 // currently fails because negotiation doesn't consider unknown encoding types
 #[ignore]
```

---

### Incident Patch 14: `41288cdd` (2026-09-26)
**Commit Message**: fix(http): validate Host header in HTTP/1.1 requests (RFC 9112 §3.2) (#4273)

* fix(http): reject multiple Host headers (RFC 9112 §3.2)

* fix(http): reject missing Host header in HTTP/1.1 requests (RFC 9112 §3.2)

* style: fix rustfmt line-wrapping

**File**: `actix-http/src/h1/chunked.rs` (modified, +10/-0)
```diff
@@ -285,6 +285,7 @@ mod tests {
     fn test_reject_empty_chunk_size() {
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chunked\r\n\r\n",
         );
         let mut reader = MessageDecoder::<Request>::default();
@@ -300,6 +301,7 @@ mod tests {
     fn test_parse_chunked_payload_chunk_extension() {
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+            Host: localhost\r\n\
             transfer-encoding: chunked\r\n\
             \r\n",
         );
@@ -322,6 +324,7 @@ mod tests {
     fn test_request_chunked() {
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chunked\r\n\r\n",
         );
         let req = parse_ready!(&mut buf);
@@ -335,6 +338,7 @@ mod tests {
         // intentional typo in "chunked"
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chnked\r\n\r\n",
         );
         expect_parse_err!(&mut buf);
@@ -344,6 +348,7 @@ mod tests {
     fn test_http_request_chunked_payload() {
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chunked\r\n\r\n",
         );
         let mut reader = MessageDecoder::<Request>::default();
@@ -367,6 +372,7 @@ mod tests {
     fn test_http_request_chunked_payload_and_next_message() {
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chunked\r\n\r\n",
         );
         let mut reader = MessageDecoder::<Request>::default();
@@ -377,6 +383,7 @@ mod tests {
         buf.extend(
             b"4\r\ndata\r\n4\r\nline\r\n0\r\n\r\n\
               POST /test2 HTTP/1.1\r\n\
+              Host: localhost\r\n\
               transfer-encoding: chunked\r\n\r\n"
                 .iter(),
         );
@@ -397,6 +404,7 @@ mod tests {
     fn test_http_request_chunked_payload_chunks() {
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chunked\r\n\r\n",
         );
 
@@ -505,6 +513,7 @@ mod tests {
     fn test_parse_chunked_payload_with_trailers() {
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chunked\r\n\r\n\
              4\r\ndata\r\n\
              0\r\n\
@@ -519,6 +528,7 @@ mod tests {
 
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chunked\r\n\r\n\
              4\r\ndata\r\n\
              0\r\n\
```

**File**: `actix-http/src/h1/codec.rs` (modified, +5/-1)
```diff
@@ -207,6 +207,7 @@ mod tests {
 
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              transfer-encoding: chunked\r\n\r\n",
         );
         let item = codec.decode(&mut buf).unwrap().unwrap();
@@ -218,6 +219,7 @@ mod tests {
         buf.extend(
             b"4\r\ndata\r\n4\r\nline\r\n0\r\n\r\n\
                POST /test2 HTTP/1.1\r\n\
+               Host: localhost\r\n\
                transfer-encoding: chunked\r\n\r\n"
                 .iter(),
         );
@@ -243,10 +245,12 @@ mod tests {
         let mut codec = Codec::default();
         let mut buf = BytesMut::from(
             "POST /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              content-length: 11\r\n\
              transfer-encoding: chunked\r\n\r\n\
              0\r\n\r\n\
-             GET /test2 HTTP/1.1\r\n\r\n",
+             GET /test2 HTTP/1.1\r\n\
+             Host: localhost\r\n\r\n",
         );
 
         assert!(codec.decode(&mut buf).is_err());
```

**File**: `actix-http/src/h1/decoder.rs` (modified, +86/-8)
```diff
@@ -83,6 +83,7 @@ pub(crate) trait MessageType: Sized {
         let mut expect = false;
         let mut chunked = false;
         let mut seen_te = false;
+        let mut seen_host = false;
         let mut content_length = None;
 
         {
@@ -132,6 +133,16 @@ pub(crate) trait MessageType: Sized {
                         return Err(ParseError::Header);
                     }
 
+                    // host
+                    header::HOST if seen_host => {
+                        debug!("multiple Host headers not allowed");
+                        return Err(ParseError::Header);
+                    }
+
+                    header::HOST => {
+                        seen_host = true;
+                    }
+
                     header::TRANSFER_ENCODING if version == Version::HTTP_11 => {
                         seen_te = true;
 
@@ -275,6 +286,13 @@ impl MessageType for Request {
         // convert headers
         let mut length = msg.set_headers(&src.split_to(len).freeze(), &headers[..h_len], ver)?;
 
+        // disallow HTTP/1.1 requests that do not contain a Host header
+        // see https://datatracker.ietf.org/doc/html/rfc9112#section-3.2
+        if ver == Version::HTTP_11 && !msg.head().headers.contains_key(header::HOST) {
+            debug!("missing Host header for HTTP/1.1 request");
+            return Err(ParseError::Header);
+        }
+
         if msg.head().headers.contains_key(header::TRANSFER_ENCODING) {
             if ver == Version::HTTP_10 {
                 debug!("Transfer-Encoding is not allowed in HTTP/1.0 requests");
@@ -633,7 +651,7 @@ mod tests {
 
     #[test]
     fn test_parse() {
-        let mut buf = BytesMut::from("GET /test HTTP/1.1\r\n\r\n");
+        let mut buf = BytesMut::from("GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n");
 
         let mut reader = MessageDecoder::<Request>::default();
         match reader.decode(&mut buf) {
@@ -653,7 +671,7 @@ mod tests {
         let mut reader = MessageDecoder::<Request>::default();
         assert!(reader.decode(&mut buf).unwrap().is_none());
 
-        buf.extend(b".1\r\n\r\n");
+        buf.extend(b".1\r\nHost: localhost\r\n\r\n");
         let (req, _) = reader.decode(&mut buf).unwrap().unwrap();
         assert_eq!(req.version(), Version::HTTP_11);
         assert_eq!(*req.method(), Method::PUT);
@@ -759,7 +777,9 @@ mod tests {
 
     #[test]
     fn test_parse_body() {
-        let mut buf = BytesMut::from("GET /test HTTP/1.1\r\nContent-Length: 4\r\n\r\nbody");
+        let mut buf = BytesMut::from(
+            "GET /test HTTP/1.1\r\nHost: localhost\r\nContent-Length: 4\r\n\r\nbody",
+        );
 
         let mut reader = MessageDecoder::<Request>::default();
         let (req, pl) = reader.decode(&mut buf).unwrap().unwrap();
@@ -775,7 +795,9 @@ mod tests {
 
     #[test]
     fn test_parse_body_crlf() {
-        let mut buf = BytesMut::from("\r\nGET /test HTTP/1.1\r\nContent-Length: 4\r\n\r\nbody");
+        let mut buf = BytesMut::from(
+            "\r\nGET /test HTTP/1.1\r\nHost: localhost\r\nContent-Length: 4\r\n\r\nbody",
+        );
 
         let mut reader = MessageDecoder::<Request>::default();
         let (req, pl) = reader.decode(&mut buf).unwrap().unwrap();
@@ -791,7 +813,7 @@ mod tests {
 
     #[test]
     fn test_parse_partial_eof() {
-        let mut buf = BytesMut::from("GET /test HTTP/1.1\r\n");
+        let mut buf = BytesMut::from("GET /test HTTP/1.1\r\nHost: localhost\r\n");
         let mut reader = MessageDecoder::<Request>::default();
         assert!(reader.decode(&mut buf).unwrap().is_none());
 
@@ -804,7 +826,7 @@ mod tests {
 
     #[test]
     fn test_headers_split_field() {
-        let mut buf = BytesMut::from("GET /test HTTP/1.1\r\n");
+        let mut buf = BytesMut::from("GET /test HTTP/1.1\r\nHost: localhost\r\n");
 
         let mut reader = MessageDecoder::<Request>::default();
         assert! { reader.decode(&mut buf).unwrap().is_none() }
@@ -833,6 +855,7 @@ mod tests {
     fn test_headers_multi_value() {
         let mut buf = BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              Set-Cookie: c1=cookie1\r\n\
              Set-Cookie: c2=cookie2\r\n\r\n",
         );
@@ -856,20 +879,24 @@ mod tests {
 
     #[test]
     fn test_conn_default_1_1() {
-        let req = parse_ready!(&mut BytesMut::from("GET /test HTTP/1.1\r\n\r\n"));
+        let req = parse_ready!(&mut BytesMut::from(
+            "GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n"
+        ));
         assert_eq!(req.head().connection_type(), ConnectionType::KeepAlive);
     }
 
     #[test]
     fn test_conn_close() {
         let req = parse_ready!(&mut BytesMut::from(
             "GET /test HTTP/1.1\r\n\
+             Host: localhost\r\n\
              connection: close\r\n\r\n",
         ));
         assert_eq!(req.head().connection_type(), ConnectionType::Close);
 
         let req = parse_ready!(&mut BytesMut::from(
             "GET /test HTT
```

**File**: `actix-http/src/h1/dispatcher_tests.rs` (modified, +41/-12)
```diff
@@ -98,7 +98,7 @@ async fn late_request() {
         // polls: initial
         assert_eq!(h1.poll_count, 1);
 
-        buf.extend_read_buf("GET /abcd HTTP/1.1\r\nConnection: close\r\n\r\n");
+        buf.extend_read_buf("GET /abcd HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");
 
         match h1.as_mut().poll(cx) {
             Poll::Pending => panic!("second poll should not be pending"),
@@ -134,7 +134,7 @@ async fn late_request() {
 
 #[actix_rt::test]
 async fn oneshot_connection() {
-    let buf = TestBuffer::new("GET /abcd HTTP/1.1\r\n\r\n");
+    let buf = TestBuffer::new("GET /abcd HTTP/1.1\r\nHost: localhost\r\n\r\n");
 
     let cfg = ServiceConfig::new(
         KeepAlive::Disabled,
@@ -195,7 +195,7 @@ async fn oneshot_connection() {
 
 #[actix_rt::test]
 async fn keep_alive_timeout() {
-    let buf = TestBuffer::new("GET /abcd HTTP/1.1\r\n\r\n");
+    let buf = TestBuffer::new("GET /abcd HTTP/1.1\r\nHost: localhost\r\n\r\n");
 
     let cfg = ServiceConfig::new(
         KeepAlive::Timeout(Duration::from_millis(200)),
@@ -274,7 +274,7 @@ async fn keep_alive_timeout() {
 
 #[actix_rt::test]
 async fn keep_alive_follow_up_req() {
-    let mut buf = TestBuffer::new("GET /abcd HTTP/1.1\r\n\r\n");
+    let mut buf = TestBuffer::new("GET /abcd HTTP/1.1\r\nHost: localhost\r\n\r\n");
 
     let cfg = ServiceConfig::new(
         KeepAlive::Timeout(Duration::from_millis(500)),
@@ -354,6 +354,7 @@ async fn keep_alive_follow_up_req() {
         buf.extend_read_buf(
             "\
             GET /efg HTTP/1.1\r\n\
+            Host: localhost\r\n\
             Connection: close\r\n\
             \r\n\r\n",
         );
@@ -414,7 +415,7 @@ async fn graceful_shutdown_does_not_start_buffered_request() {
     let config = ServiceConfigBuilder::new()
         .graceful_shutdown_signal(Some(GracefulShutdownSignal::new(|| ready(()))))
         .build();
-    let buf = TestBuffer::new("GET /buffered HTTP/1.1\r\n\r\n");
+    let buf = TestBuffer::new("GET /buffered HTTP/1.1\r\nHost: localhost\r\n\r\n");
     let dispatcher = Dispatcher::new(
         buf.clone(),
         services,
@@ -476,8 +477,10 @@ async fn pipelining_ok_then_ok() {
     lazy(|cx| {
         let buf = TestBuffer::new(
             "\
-                GET /abcd HTTP/1.1\r\n\r\n\
-                GET /def HTTP/1.1\r\n\r\n\
+                GET /abcd HTTP/1.1\r\n\
+                Host: localhost\r\n\r\n\
+                GET /def HTTP/1.1\r\n\
+                Host: localhost\r\n\r\n\
                 ",
         );
 
@@ -547,6 +550,7 @@ async fn early_response_with_payload_lingers_before_closing() {
         let buf = TestSeqBuffer::new(http_msg(
             r"
             GET /unfinished HTTP/1.1
+            Host: localhost
             Content-Length: 2
             ",
         ));
@@ -617,6 +621,7 @@ async fn buffered_upload_ignored_by_handler_should_not_shutdown_immediately() {
         let buf = TestSeqBuffer::new(http_msg(
             r"
             POST / HTTP/1.1
+            Host: localhost
             Content-Length: 8
 
             ab
@@ -688,6 +693,7 @@ async fn lingering_timeout_uses_graceful_shutdown() {
     let buf = TestSeqBuffer::new(
         "\
             POST / HTTP/1.1\r\n\
+            Host: localhost\r\n\
             Content-Length: 8\r\n\
             \r\n\
             ab\
@@ -745,7 +751,8 @@ async fn pipelining_ok_then_bad() {
     lazy(|cx| {
         let buf = TestBuffer::new(
             "\
-                GET /abcd HTTP/1.1\r\n\r\n\
+                GET /abcd HTTP/1.1\r\n\
+                Host: localhost\r\n\r\n\
                 GET /def HTTP/1\r\n\r\n\
                 ",
         );
@@ -834,6 +841,7 @@ async fn expect_handling() {
         buf.extend_read_buf(
             "\
                 POST /upload HTTP/1.1\r\n\
+                Host: localhost\r\n\
                 Content-Length: 5\r\n\
                 Expect: 100-continue\r\n\
                 \r\n\
@@ -911,6 +919,7 @@ async fn expect_eager() {
         buf.extend_read_buf(
             "\
                 POST /upload HTTP/1.1\r\n\
+                Host: localhost\r\n\
                 Content-Length: 5\r\n\
                 Expect: 100-continue\r\n\
                 \r\n\
@@ -994,6 +1003,7 @@ async fn upgrade_handling() {
         buf.extend_read_buf(
             "\
                 GET /ws HTTP/1.1\r\n\
+                Host: localhost\r\n\
                 Connection: Upgrade\r\n\
                 Upgrade: websocket\r\n\
                 \r\n\
@@ -1016,6 +1026,7 @@ async fn upgrade_response_does_not_close_unfinished_payload() {
     let buf = TestSeqBuffer::new(http_msg(
         r"
         GET /ws HTTP/1.1
+        Host: localhost
         Connection: Upgrade
         Upgrade: websocket
         Sec-WebSocket-Version: 13
@@ -1079,6 +1090,7 @@ async fn handler_drop_payload() {
     let mut buf = TestBuffer::new(http_msg(
         r"
         POST /drop-payload HTTP/1.1
+        Host: localhost
         Content-Length
```

**File**: `actix-http/src/responses/head.rs` (modified, +2/-2)
```diff
@@ -238,7 +238,7 @@ mod tests {
 
         let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
         stream
-            .write_all(b"GET /camel HTTP/1.1\r\nConnection: Close\r\n\r\n")
+            .write_all(b"GET /camel HTTP/1.1\r\nHost: localhost\r\nConnection: Close\r\n\r\n")
             .unwrap();
         let mut data = vec![];
         let _ = stream.read_to_end(&mut data).unwrap();
@@ -252,7 +252,7 @@ mod tests {
 
         let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
         stream
-            .write_all(b"GET /lower HTTP/1.1\r\nConnection: Close\r\n\r\n")
+            .write_all(b"GET /lower HTTP/1.1\r\nHost: localhost\r\nConnection: Close\r\n\r\n")
             .unwrap();
         let mut data = vec![];
         let _ = stream.read_to_end(&mut data).unwrap();
```

**File**: `actix-http/tests/test_server.rs` (modified, +24/-14)
```diff
@@ -92,13 +92,15 @@ async fn expect_continue() {
     .await;
 
     let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
-    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nexpect: 100-continue\r\n\r\n");
+    let _ =
+        stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\nexpect: 100-continue\r\n\r\n");
     let mut data = String::new();
     let _ = stream.read_to_string(&mut data);
     assert!(data.starts_with("HTTP/1.1 417 Expectation Failed\r\ncontent-length"));
 
     let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
-    let _ = stream.write_all(b"GET /test?yes= HTTP/1.1\r\nexpect: 100-continue\r\n\r\n");
+    let _ = stream
+        .write_all(b"GET /test?yes= HTTP/1.1\r\nHost: localhost\r\nexpect: 100-continue\r\n\r\n");
     let mut data = String::new();
     let _ = stream.read_to_string(&mut data);
     assert!(data.starts_with("HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 200 OK\r\n"));
@@ -125,13 +127,15 @@ async fn expect_continue_h1() {
     .await;
 
     let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
-    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nexpect: 100-continue\r\n\r\n");
+    let _ =
+        stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\nexpect: 100-continue\r\n\r\n");
     let mut data = String::new();
     let _ = stream.read_to_string(&mut data);
     assert!(data.starts_with("HTTP/1.1 417 Expectation Failed\r\ncontent-length"));
 
     let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
-    let _ = stream.write_all(b"GET /test?yes= HTTP/1.1\r\nexpect: 100-continue\r\n\r\n");
+    let _ = stream
+        .write_all(b"GET /test?yes= HTTP/1.1\r\nHost: localhost\r\nexpect: 100-continue\r\n\r\n");
     let mut data = String::new();
     let _ = stream.read_to_string(&mut data);
     assert!(data.starts_with("HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 200 OK\r\n"));
@@ -164,7 +168,9 @@ async fn chunked_payload() {
 
     let returned_size = {
         let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
-        let _ = stream.write_all(b"POST /test HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n");
+        let _ = stream.write_all(
+            b"POST /test HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n",
+        );
 
         for chunk_size in chunk_sizes.iter() {
             let mut bytes = Vec::new();
@@ -263,12 +269,12 @@ async fn http1_keepalive() {
     .await;
 
     let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
-    let _ = stream.write_all(b"GET /test/tests/test HTTP/1.1\r\n\r\n");
+    let _ = stream.write_all(b"GET /test/tests/test HTTP/1.1\r\nHost: localhost\r\n\r\n");
     let mut data = vec![0; 1024];
     let _ = stream.read(&mut data);
     assert_eq!(&data[..17], b"HTTP/1.1 200 OK\r\n");
 
-    let _ = stream.write_all(b"GET /test/tests/test HTTP/1.1\r\n\r\n");
+    let _ = stream.write_all(b"GET /test/tests/test HTTP/1.1\r\nHost: localhost\r\n\r\n");
     let mut data = vec![0; 1024];
     let _ = stream.read(&mut data);
     assert_eq!(&data[..17], b"HTTP/1.1 200 OK\r\n");
@@ -288,7 +294,7 @@ async fn http1_keepalive_timeout() {
 
     let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
 
-    let _ = stream.write_all(b"GET /test HTTP/1.1\r\n\r\n");
+    let _ = stream.write_all(b"GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n");
     let mut data = vec![0; 256];
     let _ = stream.read(&mut data);
     assert_eq!(&data[..17], b"HTTP/1.1 200 OK\r\n");
@@ -312,7 +318,9 @@ async fn http1_keepalive_close() {
     .await;
 
     let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
-    let _ = stream.write_all(b"GET /test/tests/test HTTP/1.1\r\nconnection: close\r\n\r\n");
+    let _ = stream.write_all(
+        b"GET /test/tests/test HTTP/1.1\r\nHost: localhost\r\nconnection: close\r\n\r\n",
+    );
     let mut data = vec![0; 1024];
     let _ = stream.read(&mut data);
     assert_eq!(&data[..17], b"HTTP/1.1 200 OK\r\n");
@@ -385,7 +393,7 @@ async fn http1_keepalive_disabled() {
     .await;
 
     let mut stream = net::TcpStream::connect(srv.addr()).unwrap();
-    let _ = stream.write_all(b"GET /test/tests/test HTTP/1.1\r\n\r\n");
+    let _ = stream.write_all(b"GET /test/tests/test HTTP/1.1\r\nHost: localhost\r\n\r\n");
     let mut data = vec![0; 1024];
     let _ = stream.read(&mut data);
     assert_eq!(&data[..17], b"HTTP/1.1 200 OK\r\n");
@@ -482,15 +490,17 @@ async fn content_length_truncated() {
     let mut buf = [0; 12];
 
     let mut conn = TcpStream::connect(&addr).await.unwrap();
-    conn.write_all(b"POST /10000 HTTP/1.1\r\nContent-Length: 10000\r\n\r\ndata_truncated")
-        .await
-        .unwrap();
+    conn.write_all(
+        b"POST /10000 HTTP/1.1\r\nHost: localhost\r\nContent-Length: 10000\r\n\r\ndata_truncated",
+    )
+    .await
+    .unwrap();
     conn.shutdown().await.unwrap();
     conn.read_exact(&mut buf).await.unwrap();
     assert_eq!(&buf, b"HTTP/1.1 400");
 
     let mut conn = TcpStre
```

---

### Incident Patch 15: `fcaf3b05` (2026-09-26)
**Commit Message**: fix(http): parse chunked trailer section (RFC 9112 §7.1.2) (#4240)

**File**: `actix-http/src/h1/chunked.rs` (modified, +43/-4)
```diff
@@ -27,6 +27,8 @@ pub(super) enum ChunkedState {
     BodyLf,
     EndCr,
     EndLf,
+    Trailer,
+    TrailerLf,
     End,
 }
 
@@ -49,6 +51,8 @@ impl ChunkedState {
             BodyLf => ChunkedState::read_body_lf(body),
             EndCr => ChunkedState::read_end_cr(body),
             EndLf => ChunkedState::read_end_lf(body),
+            Trailer => ChunkedState::read_trailer(body),
+            TrailerLf => ChunkedState::read_trailer_lf(body),
             End => Poll::Ready(Ok(ChunkedState::End)),
         }
     }
@@ -192,12 +196,10 @@ impl ChunkedState {
     fn read_end_cr(rdr: &mut BytesMut) -> Poll<Result<ChunkedState, io::Error>> {
         match byte!(rdr) {
             b'\r' => Poll::Ready(Ok(ChunkedState::EndLf)),
-            _ => Poll::Ready(Err(io::Error::new(
-                io::ErrorKind::InvalidInput,
-                "Invalid chunk end CR",
-            ))),
+            _ => Poll::Ready(Ok(ChunkedState::Trailer)),
         }
     }
+
     fn read_end_lf(rdr: &mut BytesMut) -> Poll<Result<ChunkedState, io::Error>> {
         match byte!(rdr) {
             b'\n' => Poll::Ready(Ok(ChunkedState::End)),
@@ -207,6 +209,25 @@ impl ChunkedState {
             ))),
         }
     }
+
+    fn read_trailer(rdr: &mut BytesMut) -> Poll<Result<ChunkedState, io::Error>> {
+        loop {
+            match byte!(rdr) {
+                b'\r' => return Poll::Ready(Ok(ChunkedState::TrailerLf)),
+                _ => continue,
+            }
+        }
+    }
+
+    fn read_trailer_lf(rdr: &mut BytesMut) -> Poll<Result<ChunkedState, io::Error>> {
+        match byte!(rdr) {
+            b'\n' => Poll::Ready(Ok(ChunkedState::EndCr)),
+            _ => Poll::Ready(Err(io::Error::new(
+                io::ErrorKind::InvalidInput,
+                "Invalid chunk trailer LF",
+            ))),
+        }
+    }
 }
 
 #[cfg(test)]
@@ -243,6 +264,24 @@ mod tests {
         }};
     }
 
+    #[test]
+    fn test_parse_chunked_payload_with_trailers() {
+        let mut buf = BytesMut::from(
+            "GET /test HTTP/1.1\r\n\
+             transfer-encoding: chunked\r\n\r\n",
+        );
+        let mut reader = MessageDecoder::<Request>::default();
+        let (_req, pl) = reader.decode(&mut buf).unwrap().unwrap();
+        let mut pl = pl.unwrap();
+
+        buf.extend(b"4\r\ndata\r\n0\r\nX-Checksum: 12345\r\nExpires: Wed\r\n\r\n");
+        assert_eq!(
+            pl.decode(&mut buf).unwrap().unwrap().chunk().as_ref(),
+            b"data"
+        );
+        assert!(pl.decode(&mut buf).unwrap().unwrap().eof());
+    }
+
     #[test]
     fn test_reject_empty_chunk_size() {
         let mut buf = BytesMut::from(
```

#### Recent Merged Pull Requests:
- **PR #4299** (2026-10-02): ci: remove obsolete disk space cleanup (@robjtede)
- **PR #4298** (2026-10-02): ci: partition feature combination checks (@robjtede)
- **PR #4297** (2026-10-01): ci: use Blacksmith checkout in all workflows (@robjtede)
- **PR #4296** (2026-10-02): fix(ws): validate 16-byte base64 nonce in Sec-WebSocket-Key (RFC 6455 §4.2.1) (@Sruhvx-jpg)
- **PR #4295** (2026-10-02): fix(ws): return 426 Upgrade Required on unsupported version (RFC 6455 §4.2.2) (@Sruhvx-jpg)
- **PR #4294** (2026-10-02): fix(ws): reject oversized close control frames (RFC 6455 §5.5) (@Sruhvx-jpg)
- **PR #4293** (2026-10-03): refactor(http): replace HTTP/1.1 framing and encoder magic numbers with named constants (@Sruhvx-jpg)
- **PR #4292** (2026-10-02): refactor(ws): replace framing and protocol magic numbers with named constants (@Sruhvx-jpg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
