# Forensic Learning Record (Deep Inspection): actix/actix-web

> **Canonical Artifact**: `07_PROJECT_LEARNING/actix-actix-web-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/actix/actix-web](https://github.com/actix/actix-web))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:01.887Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `actix/actix-web`
- **Description**: Actix Web is a powerful, pragmatic, and extremely fast web framework for Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 24848 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

    /// Set r
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4289** (2026-09-30): **build(deps): bump actix-macros from 0.2.4 to 0.2.5**
  *Symptoms*: Bumps [actix-macros](https://github.com/actix/actix-net) from 0.2.4 to 0.2.5. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actix/actix-net/releases">actix-macros's releases</a>.</em></p> <blockquote> <h2>actix-macros: v0.2.5</h2> <ul> <li>Update <code>syn</code> dependency to <code>3</code>.</li> <li>Minimum supported Rust version (MSRV) is now 1.88.</li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/actix/actix-net/blob/v0.2.5/CHANGES.md">actix-macros's changelog</a>.</em></p> <blockquote> <h2>[0.2.5] - 2018-12-12</h2> <h3>Fixed</h3> <ul> <li> <p>Fix back-pressure for concurrent ssl handshakes</p> </li> <li> <p>Drop completed future for .then and .and_then combinators</p> </li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/actix/actix-net/commit/298727dcbdf52c2fc9c8dc0b759bc99d963d1f2c"><code>298727d</code></a> back port bug fixes</li> <li>See full diff in <a href="https://github.com/actix/actix-net/compare/v0.2.4...v0.2.5">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=actix-macros&package-manager=cargo&previous-version=0.2.4&new-version=0.2.5)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabo
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/92ea6691bd91f06d1548f5743c920eea236ec7df">92ea669</a> in the <span id="cc-branch" title="actix/actix-web:dependabot/cargo/actix-macros-0.2.5">dependabot/cargo/act...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/20dc029be1a35ce9b9ac56c5e7bcd079adedbfee">20dc029</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.  

- **Issue #4288** (2026-09-30): **build(deps): bump actix-rt from 2.14.0 to 2.15.0**
  *Symptoms*: Bumps [actix-rt](https://github.com/actix/actix-net) from 2.14.0 to 2.15.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actix/actix-net/releases">actix-rt's releases</a>.</em></p> <blockquote> <h2>actix-rt: v2.15.0</h2> <ul> <li>Add <code>Arbiter::alive()</code> and <code>ArbiterHandle::alive()</code> to check whether the arbiter's command channel is still open.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/actix/actix-net/commit/f5382cd2c8760d223cc24047b6cf6efd99a760ac"><code>f5382cd</code></a> chore(actix-rt): prepare release 2.15.0</li> <li><a href="https://github.com/actix/actix-net/commit/a2afafb23ddb94c04effdb403ddf464b477ea9eb"><code>a2afafb</code></a> feat(rt): add arbiter alive methods (<a href="https://redirect.github.com/actix/actix-net/issues/974">#974</a>)</li> <li>See full diff in <a href="https://github.com/actix/actix-net/compare/rt-v2.14.0...rt-v2.15.0">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=actix-rt&package-manager=cargo&previous-version=2.14.0&new-version=2.15.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by 
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/937400d5bbc790e6c8ba61034e2c2ab922079685">937400d</a> in the <span id="cc-branch" title="actix/actix-web:dependabot/cargo/actix-rt-2.15.0">dependabot/cargo/act...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/20dc029be1a35ce9b9ac56c5e7bcd079adedbfee">20dc029</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:main">main</span> <a id="cc-sha" href="/actix/actix-web/commit/20dc029be1a35ce9b9ac56c5e7bcd079adedbfee">20dc029</a></td>   <td align="center"><span id="cc-branch" title="actix/actix

- **Issue #4287** (2026-09-30): **build(deps): bump actix-server from 2.9.5 to 2.9.7**
  *Symptoms*: Bumps [actix-server](https://github.com/actix/actix-net) from 2.9.5 to 2.9.7. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actix/actix-net/releases">actix-server's releases</a>.</em></p> <blockquote> <h2>actix-server: v2.9.7</h2> <ul> <li>Fix busy listeners starving other listeners when worker connection capacity becomes available by rotating the first listener checked.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/actix/actix-net/commit/d11ff56251b655b0b5dcdaa3e2a29735a4084c8f"><code>d11ff56</code></a> chore(actix-server): prepare release 2.9.7</li> <li><a href="https://github.com/actix/actix-net/commit/eec7142bdc89c84e2205fe1202c759f87637dedd"><code>eec7142</code></a> ci: add miri tests for local-waker (<a href="https://redirect.github.com/actix/actix-net/issues/995">#995</a>)</li> <li><a href="https://github.com/actix/actix-net/commit/4c4985a6448b6545e1dfad43df05514de415c3bb"><code>4c4985a</code></a> build(deps): bump codecov/codecov-action from 7.1.0 to 7.1.1 (<a href="https://redirect.github.com/actix/actix-net/issues/991">#991</a>)</li> <li><a href="https://github.com/actix/actix-net/commit/6975511672c9a34db2d31edcbc11a01878cf64f0"><code>6975511</code></a> build(deps): bump taiki-e/install-action from 2.87.12 to 2.87.17 (<a href="https://redirect.github.com/actix/actix-net/issues/992">#992</a>)</li> <li><a href="https://github.com/actix/actix-net/commit/062507e0
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/f1f9c7f2698420485551b7a318e31cff7dfeb03d">f1f9c7f</a> in the <span id="cc-branch" title="actix/actix-web:dependabot/cargo/actix-server-2.9.7">dependabot/cargo/act...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/20dc029be1a35ce9b9ac56c5e7bcd079adedbfee">20dc029</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:main">main</span> <a id="cc-sha" href="/actix/actix-web/commit/20dc029be1a35ce9b9ac56c5e7bcd079adedbfee">20dc029</a></td>   <td align="center"><span id="cc-branch" title="actix/ac

- **Issue #4286** (2026-09-30): **build(deps): bump actix-tls from 3.6.0 to 3.6.1**
  *Symptoms*: Bumps [actix-tls](https://github.com/actix/actix-net) from 3.6.0 to 3.6.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actix/actix-net/releases">actix-tls's releases</a>.</em></p> <blockquote> <h2>actix-tls: v3.6.1</h2> <ul> <li>Fix parsing of bracketed IPv6 hosts and ports in <code>Host</code> for <code>String</code> and <code>&amp;'static str</code>.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/actix/actix-net/commit/95524f35f4ec8aa791d340366dbf335f77ff1bf5"><code>95524f3</code></a> chore(actix-tls): prepare release 3.6.1</li> <li><a href="https://github.com/actix/actix-net/commit/335e3ca19c79a13aa7fa5305f9ff38853f00908b"><code>335e3ca</code></a> fix(actix-tls): parse bracketed IPv6 hosts (<a href="https://redirect.github.com/actix/actix-net/issues/989">#989</a>)</li> <li><a href="https://github.com/actix/actix-net/commit/79fcb78bab4712f1135408a1668afde92164585e"><code>79fcb78</code></a> build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.0 (<a href="https://redirect.github.com/actix/actix-net/issues/986">#986</a>)</li> <li><a href="https://github.com/actix/actix-net/commit/60ba687f6f5a1c09e1955137e6a8979870b8c548"><code>60ba687</code></a> build(deps): bump taiki-e/install-action from 2.87.8 to 2.87.12 (<a href="https://redirect.github.com/actix/actix-net/issues/987">#987</a>)</li> <li><a href="https://github.com/actix/actix-net/commit/cef10e78aba4d3a69b195
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/84acc5e7e2a25b28117b62bdb74f7c3141e0417a">84acc5e</a> in the <span id="cc-branch" title="actix/actix-web:dependabot/cargo/actix-tls-3.6.1">dependabot/cargo/act...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/20dc029be1a35ce9b9ac56c5e7bcd079adedbfee">20dc029</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:main">main</span> <a id="cc-sha" href="/actix/actix-web/commit/20dc029be1a35ce9b9ac56c5e7bcd079adedbfee">20dc029</a></td>   <td align="center"><span id="cc-branch" title="actix/actix

- **Issue #4285** (2026-09-30): **build(deps): bump actix-utils from 3.0.1 to 3.0.2**
  *Symptoms*: Bumps [actix-utils](https://github.com/actix/actix-net) from 3.0.1 to 3.0.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actix/actix-net/releases">actix-utils's releases</a>.</em></p> <blockquote> <h2>actix-tls: v3.0.2</h2> <ul> <li>Expose <code>connect::Connection::new</code>. <a href="https://redirect.github.com/actix/actix-net/issues/439">#439</a></li> </ul> <p><a href="https://redirect.github.com/actix/actix-net/issues/439">#439</a>: <a href="https://redirect.github.com/actix/actix-net/pull/439">actix/actix-net#439</a></p> <h2>actix-utils: v3.0.2</h2> <ul> <li>Deprecate <code>ready</code> in favor of <code>core::future::{ready, Ready}</code>.</li> <li>Minimum supported Rust version (MSRV) is now 1.88.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/actix/actix-net/commit/5e290d76f8011cc7deb5844f6180e8d396b45873"><code>5e290d7</code></a> prepare actix-tls release 3.0.2</li> <li><a href="https://github.com/actix/actix-net/commit/0edb64575f28f6890bf902d59eda8184679c0f7b"><code>0edb645</code></a> update tls changelog</li> <li><a href="https://github.com/actix/actix-net/commit/941f67dec9b82c1a7bb1b77dc174ef921022da62"><code>941f67d</code></a> s/e/err</li> <li><a href="https://github.com/actix/actix-net/commit/3e624b83764c7f539ce118e3d0cd66da62f143ab"><code>3e624b8</code></a> Made <code>new</code> constructor for the Connection type public (<a href="https://redirect.gith
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/85c20a51feb4ac1725e8bc6c6343f3482ab87568">85c20a5</a> in the <span id="cc-branch" title="actix/actix-web:dependabot/cargo/actix-utils-3.0.2">dependabot/cargo/act...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/37cc911cf3f72e42eea5285796d870d3090c3072">37cc911</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:main">main</span> <a id="cc-sha" href="/actix/actix-web/commit/37cc911cf3f72e42eea5285796d870d3090c3072">37cc911</a></td>   <td align="center"><span id="cc-branch" title="actix/act

- **Issue #4280** (2026-09-28): **fix(http): correct encoder diagnostics and header documentation**
  *Symptoms*: <!-- Thanks for considering contributing actix! --> <!-- Please fill out the following to get your PR reviewed quicker. -->  ## PR Type  <!-- What kind of change does this PR make? --> <!-- Bug Fix / Feature / Refactor / Code Style / Other -->  Bug Fix  ## PR Checklist  <!-- Check your PR fulfills the following items. --> <!-- For draft PRs check the boxes as you complete them. -->  - [ ] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [ ] A changelog entry has been made for the appropriate packages. - [ ] Format code with the latest stable rustfmt. - [ ] (Team) Label with affected crates and semver status.  ## Overview  <!-- Describe the current and new behavior. --> <!-- Emphasize any breaking changes. -->  <!-- If this PR fixes or closes an issue, reference it here. --> <!-- Closes #000 -->  Correct content-encoder trace messages that describe encoding failures as decoding failures, including the `zstd` spelling. Correct the `Last-Modified` header name in its ABNF documentation.  Split from #4179. Both commits retain @WaterWhisperer's original author identity and dates, with source commit references.  Stack: 3 of 3, based on `fix-expect-continue`. Merge after the Expect PR.  Validation on macOS: 386 library/integration tests passed across `actix-http` and `awc` at this branch tip (1 ignored), with WebSocket, HTTP/2, and all compression features enabled and the repository recipe's filter. `cargo +nightly fmt --all -
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/18be69b8a877835622d630a9e9fdf9f63c7b6947">18be69b</a> in the <span id="cc-branch" title="actix/actix-web:fix-http-diagnostics-docs">fix-http-diagnostics...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/a1d3c932cad97eade59bae5640f9ff10ac6594ed">a1d3c93</a> in the <span id="cc-branch" title="actix/actix-web:fix-expect-continue">fix-expect-continue</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:fix-expect-continue">fix-expect-continue</span> <a id="cc-sha" href="/actix/actix-web/commit/a1d3c932cad97eade59bae5640f9ff10ac6594ed">a1d3c93</a></td>   <td a

- **Issue #4279** (2026-09-28): **fix(http): validate 100-continue expectations**
  *Symptoms*: <!-- Thanks for considering contributing actix! --> <!-- Please fill out the following to get your PR reviewed quicker. -->  ## PR Type  <!-- What kind of change does this PR make? --> <!-- Bug Fix / Feature / Refactor / Code Style / Other -->  Bug Fix  ## PR Checklist  <!-- Check your PR fulfills the following items. --> <!-- For draft PRs check the boxes as you complete them. -->  - [x] Tests for the changes have been added / updated. - [x] Documentation comments have been added / updated. - [x] A changelog entry has been made for the appropriate packages. - [ ] Format code with the latest stable rustfmt. - [ ] (Team) Label with affected crates and semver status.  ## Overview  <!-- Describe the current and new behavior. --> <!-- Emphasize any breaking changes. -->  <!-- If this PR fixes or closes an issue, reference it here. --> <!-- Closes #000 -->  Recognize only the `100-continue` expectation in HTTP/1.1 requests. Handle case-insensitive tokens, quoted commas, and escaped quotes, and ignore expectations in HTTP/1.0 requests. Update the expect-service documentation and parser tests.  Split from #4179. The two implementation commits retain @WaterWhisperer's original author identity and dates, with source commit references. A separate fixture-only commit adds the `Host` header required by current `main`.  Stack: 2 of 3, based on `fix-connection-options`. Merge after the Connection PR.  Depends on #4278.  Validation on macOS: 271 library tests passed across `actix-http` and 
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/098523ba68569fd76459fe7d30d980c3b245410a">098523b</a> in the <span id="cc-branch" title="actix/actix-web:fix-expect-continue">fix-expect-continue</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/a1d3c932cad97eade59bae5640f9ff10ac6594ed">a1d3c93</a> in the <span id="cc-branch" title="actix/actix-web:fix-connection-options">fix-connection-optio...</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:fix-connection-options">fix-connection-optio...</span> <a id="cc-sha" href="/actix/actix-web/commit/a1d3c932cad97eade59bae5640f9ff10ac6594ed">a1d3c93</a></td>   <

- **Issue #4278** (2026-09-28): **fix(http): parse Connection options consistently**
  *Symptoms*: <!-- Thanks for considering contributing actix! --> <!-- Please fill out the following to get your PR reviewed quicker. -->  ## PR Type  <!-- What kind of change does this PR make? --> <!-- Bug Fix / Feature / Refactor / Code Style / Other -->  Bug Fix  ## PR Checklist  <!-- Check your PR fulfills the following items. --> <!-- For draft PRs check the boxes as you complete them. -->  - [x] Tests for the changes have been added / updated. - [ ] Documentation comments have been added / updated. - [x] A changelog entry has been made for the appropriate packages. - [ ] Format code with the latest stable rustfmt. - [ ] (Team) Label with affected crates and semver status.  ## Overview  <!-- Describe the current and new behavior. --> <!-- Emphasize any breaking changes. -->  <!-- If this PR fixes or closes an issue, reference it here. --> <!-- Closes #000 -->  Parse comma-separated and repeated `Connection` fields with `close` taking precedence over `upgrade` and `keep-alive`. Apply the same token matching to request upgrade checks and AWC WebSocket handshake validation.  Closes #2692.  Split from #4179. The two implementation commits retain @WaterWhisperer's original author identity and dates, with source commit references. A separate fixture-only commit adds the `Host` header required by current `main`.  Stack: 1 of 3, based on `main`. Merge this PR first.  Validation on macOS: 270 library tests passed across `actix-http` and `awc` at this branch tip (1 ignored). WebSocket, HTTP/2,
  **Post-Mortem & Fix Analysis**:
  > <!-- code-coverage-overview --> ### Code Coverage Overview  <b>Languages:</b> Rust <h4>Rust / code-coverage/cargo-llvm-cov</h4>  The overall line coverage in commit <a id="cc-sha" href="/actix/actix-web/commit/6f2f7ead479ad1b6ec21363da2c269f8f389cc2d">6f2f7ea</a> in the <span id="cc-branch" title="actix/actix-web:fix-connection-options">fix-connection-optio...</span> branch remains at 84%, unchanged from commit <a id="cc-sha" href="/actix/actix-web/commit/a1d3c932cad97eade59bae5640f9ff10ac6594ed">a1d3c93</a> in the <span id="cc-branch" title="actix/actix-web:main">main</span> branch.    <details open>   <summary>Show a line coverage summary of the most impacted files.</summary>    <table>   <tr>   <td align="center"><b>File</b></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:main">main</span> <a id="cc-sha" href="/actix/actix-web/commit/a1d3c932cad97eade59bae5640f9ff10ac6594ed">a1d3c93</a></td>   <td align="center"><span id="cc-branch" title="actix/actix-web:fix-c

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

### Incident Patch 1: `20dc029b` (2026-09-28)
**Commit Message**: fix(http): correct encoder diagnostics and header documentation (#4280)

Co-authored-by: WaterWhisperer <waterwhisperer24@qq.com>

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

### Incident Patch 2: `3e55aac0` (2026-09-28)
**Commit Message**: fix(http): validate 100-continue expectations (#4279)

Co-authored-by: WaterWhisperer <waterwhisperer24@qq.com>

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

### Incident Patch 3: `ab23b035` (2026-09-28)
**Commit Message**: fix(http): parse Connection options consistently (#4278)

Co-authored-by: WaterWhisperer <waterwhisperer24@qq.com>

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

---

### Incident Patch 4: `b290368a` (2026-09-26)
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

### Incident Patch 5: `41288cdd` (2026-09-26)
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
     fn t
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
@@ -911,6 +919,7 @@ async fn expect_eager()
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

---

### Incident Patch 6: `fcaf3b05` (2026-09-26)
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

---

### Incident Patch 7: `a06cd07d` (2026-09-25)
**Commit Message**: fix(http): reject empty chunk size lines (RFC 9112 §7.1) (#4239)

**File**: `actix-http/src/h1/chunked.rs` (modified, +38/-1)
```diff
@@ -18,6 +18,7 @@ macro_rules! byte (
 #[derive(Debug, Clone, PartialEq, Eq)]
 pub(super) enum ChunkedState {
     Size,
+    SizeMore,
     SizeLws,
     Extension,
     SizeLf,
@@ -39,6 +40,7 @@ impl ChunkedState {
         use self::ChunkedState::*;
         match *self {
             Size => ChunkedState::read_size(body, size),
+            SizeMore => ChunkedState::read_size_more(body, size),
             SizeLws => ChunkedState::read_size_lws(body),
             Extension => ChunkedState::read_extension(body),
             SizeLf => ChunkedState::read_size_lf(body, *size),
@@ -52,6 +54,26 @@ impl ChunkedState {
     }
 
     fn read_size(rdr: &mut BytesMut, size: &mut u64) -> Poll<Result<ChunkedState, io::Error>> {
+        let b = byte!(rdr);
+        if !b.is_ascii_hexdigit() {
+            return Poll::Ready(Err(io::Error::new(
+                io::ErrorKind::InvalidInput,
+                "400 Bad Request",
+            )));
+        }
+
+        let rem = match b {
+            b'0'..=b'9' => b - b'0',
+            b'a'..=b'f' => b + 10 - b'a',
+            b'A'..=b'F' => b + 10 - b'A',
+            _ => unreachable!(),
+        };
+
+        *size = rem as u64;
+        Poll::Ready(Ok(ChunkedState::SizeMore))
+    }
+
+    fn read_size_more(rdr: &mut BytesMut, size: &mut u64) -> Poll<Result<ChunkedState, io::Error>> {
         let radix = 16;
 
         let rem = match byte!(rdr) {
@@ -74,7 +96,7 @@ impl ChunkedState {
                 *size = n;
                 *size += rem as u64;
 
-                Poll::Ready(Ok(ChunkedState::Size))
+                Poll::Ready(Ok(ChunkedState::SizeMore))
             }
             None => {
                 debug!("chunk size would overflow u64");
@@ -220,6 +242,21 @@ mod tests {
         }};
     }
 
+    #[test]
+    fn test_reject_empty_chunk_size() {
+        let mut buf = BytesMut::from(
+            "GET /test HTTP/1.1\r\n\
+             transfer-encoding: chunked\r\n\r\n",
+        );
+        let mut reader = MessageDecoder::<Request>::default();
+        let (_req, pl) = reader.decode(&mut buf).unwrap().unwrap();
+        let mut pl = pl.unwrap();
+
+        // Empty chunk size before CRLF is illegal under RFC 9112 §7.1
+        buf.extend(b"\r\n\r\n");
+        assert!(pl.decode(&mut buf).is_err());
+    }
+
     #[test]
     fn test_parse_chunked_payload_chunk_extension() {
         let mut buf = BytesMut::from(
```

---

### Incident Patch 8: `71131e10` (2026-09-25)
**Commit Message**: fix(http): verify chunked is final encoding in HttpMessage::chunked (RFC 9112 §6.1) (#4241)

**File**: `actix-http/src/http_message.rs` (modified, +24/-1)
```diff
@@ -93,7 +93,10 @@ pub trait HttpMessage: Sized {
     fn chunked(&self) -> Result<bool, ParseError> {
         if let Some(encodings) = self.headers().get(header::TRANSFER_ENCODING) {
             if let Ok(s) = encodings.to_str() {
-                Ok(s.to_lowercase().contains("chunked"))
+                Ok(s.rsplit(',')
+                    .next()
+                    .map(|token| token.trim().eq_ignore_ascii_case("chunked"))
+                    .unwrap_or(false))
             } else {
                 Err(ParseError::Header)
             }
@@ -218,6 +221,26 @@ mod tests {
             .finish();
         assert!(req.chunked().unwrap());
 
+        let req = TestRequest::default()
+            .insert_header((header::TRANSFER_ENCODING, "gzip, chunked"))
+            .finish();
+        assert!(req.chunked().unwrap());
+
+        let req = TestRequest::default()
+            .insert_header((header::TRANSFER_ENCODING, "chunked, gzip"))
+            .finish();
+        assert!(!req.chunked().unwrap());
+
+        let req = TestRequest::default()
+            .insert_header((header::TRANSFER_ENCODING, "not-chunked"))
+            .finish();
+        assert!(!req.chunked().unwrap());
+
+        let req = TestRequest::default()
+            .insert_header((header::TRANSFER_ENCODING, "chunked-fake"))
+            .finish();
+        assert!(!req.chunked().unwrap());
+
         let req = TestRequest::default()
             .insert_header((
                 header::TRANSFER_ENCODING,
```

---

### Incident Patch 9: `9d3a1fe5` (2026-09-23)
**Commit Message**: fix(actix-http): return exact size for empty removed headers (#4265)

**File**: `actix-http/CHANGES.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Fix `Removed::len()` panicking when inserting a new header or removing an absent header.
+
 ## 3.13.6
 
 - Removes `h2` from the TLS ALPN offer list when `http2` crate feature is disabled.
```

**File**: `actix-http/src/header/map.rs` (modified, +30/-1)
```diff
@@ -725,7 +725,7 @@ impl Iterator for Removed {
     fn size_hint(&self) -> (usize, Option<usize>) {
         match self.inner {
             Some(ref iter) => iter.size_hint(),
-            None => (0, None),
+            None => (0, Some(0)),
         }
     }
 }
@@ -960,6 +960,35 @@ mod tests {
         assert_eq!(map.len(), 1);
     }
 
+    #[test]
+    fn removed_has_exact_length() {
+        let mut map = HeaderMap::new();
+        let mut removed = map.insert(header::ACCEPT, HeaderValue::from_static("text/plain"));
+
+        assert_eq!(removed.len(), 0);
+        assert_eq!(removed.size_hint(), (0, Some(0)));
+        assert!(removed.next().is_none());
+        assert_eq!(removed.len(), 0);
+        assert_eq!(removed.size_hint(), (0, Some(0)));
+
+        let mut removed = map.remove(header::ACCEPT);
+
+        assert_eq!(removed.len(), 1);
+        assert_eq!(removed.size_hint(), (1, Some(1)));
+        assert_eq!(removed.next(), Some(HeaderValue::from_static("text/plain")));
+        assert_eq!(removed.len(), 0);
+        assert_eq!(removed.size_hint(), (0, Some(0)));
+        assert!(removed.next().is_none());
+
+        let mut removed = map.remove(header::ACCEPT);
+
+        assert_eq!(removed.len(), 0);
+        assert_eq!(removed.size_hint(), (0, Some(0)));
+        assert!(removed.next().is_none());
+        assert_eq!(removed.len(), 0);
+        assert_eq!(removed.size_hint(), (0, Some(0)));
+    }
+
     #[test]
     fn contains() {
         let mut map = HeaderMap::new();
```

---

### Incident Patch 10: `1f049e8f` (2026-09-19)
**Commit Message**: ci: fix lockfile

**File**: `.github/workflows/actions.lock` (modified, +23/-23)
```diff
@@ -6,39 +6,39 @@ workflows:
     '.github/workflows/bench.yml':
         - 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
     '.github/workflows/ci-post-merge.yml':
-        - 'actions-rust-lang/setup-rust-toolchain@v2.0.0'
+        - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
         - 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
         - 'ilammy/setup-nasm@72793074d3c8cdda771dba85f6deafe00623038b'
-        - 'rui314/setup-mold@v1'
-        - 'taiki-e/install-action@v2.87.12'
+        - 'rui314/setup-mold@10ca16bf91dc22e05ebdc935cad9c75ea248f621'
+        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
     '.github/workflows/ci.yml':
-        - 'actions-rust-lang/setup-rust-toolchain@v2.0.0'
+        - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
         - 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
         - 'ilammy/setup-nasm@72793074d3c8cdda771dba85f6deafe00623038b'
-        - 'rui314/setup-mold@v1'
-        - 'taiki-e/install-action@v2.87.12'
+        - 'rui314/setup-mold@10ca16bf91dc22e05ebdc935cad9c75ea248f621'
+        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
     '.github/workflows/coverage.yml':
-        - 'actions-rust-lang/setup-rust-toolchain@v2.0.0'
+        - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
         - 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
         - 'actions/upload-code-coverage@1c15be36fc3733ba839b1dd643bd9556e4426dc1'
-        - 'taiki-e/install-action@v2.87.12'
+        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
     '.github/workflows/labeler.yml':
         - 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
         - 'actions/labeler@bf12e9b00b37c5c0ca2b87b79b2daf7891dbda13'
     '.github/workflows/lint.yml':
-        - 'actions-rust-lang/setup-rust-toolchain@v2.0.0'
+        - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
         - 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
         - 'embarkstudios/cargo-deny-action@3c6349835b2b7b196a839186cb8b78e02f7b5f25'
         - 'giraffate/clippy-action@13b9d32482f25d29ead141b79e7e04e7900281e0'
         - 'taiki-e/cache-cargo-install-action@9ee83daaa7b96a6fab930949ecf1122bba04a389'
-        - 'taiki-e/install-action@v2.87.12'
-        - 'zizmorcore/zizmor-action@v0.6.4'
+        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
+        - 'zizmorcore/zizmor-action@cc914d7f3750a2d13d75c7f184a1060aa0e9d482'
     '.github/workflows/semver-checks.yml':
-        - 'actions-rust-lang/setup-rust-toolchain@v2.0.0'
+        - 'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f'
         - 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
-        - 'taiki-e/install-action@v2.87.12'
+        - 'taiki-e/install-action@3f74d7c16a4242f1c95561e98edc25d36adb4375'
 dependencies:
-    'actions-rust-lang/setup-rust-toolchain@v2.0.0':
+    'actions-rust-lang/setup-rust-toolchain@ecabd13d1c56bd1345c230e542e9144811ad706f':
         ref: 'v2.0.0'
         commit: 'sha1-ecabd13d1c56bd1345c230e542e9144811ad706f'
         owner_id: 103899579
@@ -51,7 +51,7 @@ dependencies:
         owner_id: 44036562
         repo_id: 215566462
     'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1':
-        ref: '3d3c42e5aac5ba805825da76410c181273ba90b1'
+        ref: 'v7.0.1'
         commit: 'sha1-3d3c42e5aac5ba805825da76410c181273ba90b1'
         owner_id: 44036562
         repo_id: 197814629
@@ -61,17 +61,17 @@ dependencies:
         owner_id: 44036562
         repo_id: 177139928
     'actions/upload-code-coverage@1c15be36fc3733ba839b1dd643bd9556e4426dc1':
-        ref: '1c15be36fc3733ba839b1dd643bd9556e4426dc1'
+        ref: 'v1.4.1'
         commit: 'sha1-1c15be36fc3733ba839b1dd643bd9556e4426dc1'
       
```

#### Recent Merged Pull Requests:
- **PR #4289** (2026-09-30): build(deps): bump actix-macros from 0.2.4 to 0.2.5 (@dependabot[bot])
- **PR #4288** (2026-09-30): build(deps): bump actix-rt from 2.14.0 to 2.15.0 (@dependabot[bot])
- **PR #4287** (2026-09-30): build(deps): bump actix-server from 2.9.5 to 2.9.7 (@dependabot[bot])
- **PR #4286** (2026-09-30): build(deps): bump actix-tls from 3.6.0 to 3.6.1 (@dependabot[bot])
- **PR #4285** (2026-09-30): build(deps): bump actix-utils from 3.0.1 to 3.0.2 (@dependabot[bot])
- **PR #4280** (2026-09-28): fix(http): correct encoder diagnostics and header documentation (@robjtede)
- **PR #4279** (2026-09-28): fix(http): validate 100-continue expectations (@robjtede)
- **PR #4278** (2026-09-28): fix(http): parse Connection options consistently (@robjtede)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
