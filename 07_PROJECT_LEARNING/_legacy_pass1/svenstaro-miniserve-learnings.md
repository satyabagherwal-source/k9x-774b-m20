# Forensic Learning Record (Deep Inspection): svenstaro/miniserve

> **Canonical Artifact**: `07_PROJECT_LEARNING/svenstaro-miniserve-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/svenstaro/miniserve](https://github.com/svenstaro/miniserve))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:39:02.253Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `svenstaro/miniserve`
- **Description**: 🌟 For when you really just want to serve some files over HTTP right now!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7881 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/archive.rs`
```
use std::fs::File;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};

use libflate::gzip::Encoder;
use serde::Deserialize;
use strum::{Display, EnumIter, EnumString};
use tar::Builder;
use zip::{ZipWriter, write};

use crate::errors::RuntimeError;

/// Available archive methods
#[derive(Deserialize, Clone, Copy, EnumIter, EnumString, Display)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum ArchiveMethod {
    /// Gzipped tarball
    TarGz,

    /// Regular tarball
    Tar,

    /// Regular zip
    Zip,
}

impl ArchiveMethod {
    pub fn extension(self) -> String {
        match self {
            Self::TarGz => "tar.gz",
            Self::Tar => "tar",
            Self::Zip => "zip",
        }
        .to_string()
    }

    pub fn content_type(self) -> String {
        match self {
            Self::TarGz => "application/gzip",
            Self::Tar => "application/tar",
            Self::Zip => "application/zip",
        }
        .to_string()
    }

    pub fn is_enabled(self, tar_enabled: bool, tar_gz_enabled: bool, zip_enabled: bool) -> bool {
        match self {
            Self::TarGz => tar_gz_enabled,
            Self::Tar => tar_enabled,
            Self::Zip => zip_enabled,
        }
    }

    /// Make an archive out of the given directory, and write the output to the given writer.
    ///
    /// Recursively includes all files and subdirectories.
    ///
    /// If `skip_symlinks` is `true`, symlinks fill not be followed and will just be ignored.
    pub fn create_archive<T, W>(
        self,
        dir: T,
        skip_symlinks: bool,
        out: W,
    ) -> Result<(), RuntimeError>
    where
        T: AsRef<Path>,
        W: std::io::Write,
    {
        let dir = dir.as_ref();
        match self {
            Self::TarGz => tar_gz(dir, skip_symlinks, out),
            Self::Tar => tar_dir(dir, skip_symlinks, out),
            Self::Zip => zip_dir(dir, skip_symlinks, out),
        }
    }
}

/// Write a gzipped tarball of `dir` in `out`.
fn tar_gz<W>(dir: &Path, skip_symlinks: bool, out: W) -> Result<(), RuntimeError>
where
    W: std::io::Write,
{
    let mut out = Encoder::new(out).map_err(|e| RuntimeError::IoError("GZIP".to_string(), e))?;

    tar_dir(dir, skip_symlinks, &mut out)?;

    out.finish()
        .into_result()
        .map_err(|e| RuntimeError::IoError("GZIP finish".to_string(), e))?;

    Ok(())
}

/// Write a tarball of `dir` in `out`.
///
/// The target directory will be saved as a top-level directory in the archive.
///
/// For example, consider this directory structure:
///
/// ```ignore
/// a
/// └── b
///     └── c
///         ├── e
///         ├── f
///         └── g
/// ```
///
/// Making a tarball out of `"a/b/c"` will result in this archive content:
///
/// ```ignore
/// c
/// ├── e
/// ├── f
/// └── g
/// ```
fn tar_dir<W>(dir: &Path, skip_symlinks: bool, out: W) -> Result<(), RuntimeError>
where
    W: std::io::Write,
{
    let inner_folder = dir.file_name().ok_or_else(|| {
        RuntimeError::InvalidPathError("Directory name terminates in \"..\"".to_string())
    })?;

    let directory = inner_folder.to_str().ok_or_else(|| {
        RuntimeError::InvalidPathError(
            "Directory name contains invalid UTF-8 characters".to_string(),
        )
    })?;

    tar(dir, directory.to_string(), skip_symlinks, out)
        .map_err(|e| RuntimeError::ArchiveCreationError("tarball".to_string(), Box::new(e)))
}

/// Writes a tarball of `dir` in `out`.
///
/// The content of `src_dir` will be saved in the archive as a folder named `inner_folder`.
fn tar<W>(
    src_dir: &Path,
    inner_folder: String,
    skip_symlinks: bool,
    out: W,
) -> Result<(), RuntimeError>
where
    W: std::io::Write,
{
    let mut tar_builder = Builder::new(out);

    tar_builder.follow_symlinks(!skip_symlinks);

    // Recursively adds the content of src_dir into the archive stream
    tar_builder
        .append_dir_all(inner_folder, src_dir)
        .map_err(|e| {
            RuntimeError::IoError(
                format!(
                    "Failed to append the content of '{}' to the TAR archive",
                    src_dir.to_str().unwrap_or("file")
                ),
                e,
            )
        })?;

    // Finish the archive
    tar_builder.into_inner().map_err(|e| {
        RuntimeError::IoError("Failed to finish writing the TAR archive".to_string(), e)
    })?;

    Ok(())
}

/// Write a zip of `dir` in `out`.
///
/// The target directory will be saved as a top-level directory in the archive.
///
/// For example, consider this directory structure:
///
/// ```ignore
/// a
/// └── b
///     └── c
///         ├── e
///         ├── f
///         └── g
/// ```
///
/// Making a zip out of `"a/b/c"` will result in this archive content:
///
/// ```ignore
/// c
/// ├── e
/// ├── f
/// └── g
/// ```
fn create_zip_from_directory<W>(
    out: W,
    directory: &Path,
    skip_symlinks: bool,
) -> Result<(), RuntimeError>
where
    W: std::io::Write + std::io::Seek,
{
    let options =
        write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let mut paths_queue: Vec<PathBuf> = vec![directory.to_path_buf()];
    let zip_root_folder_name = directory.file_name().ok_or_else(|| {
        RuntimeError::InvalidPathError("Directory name terminates in \"..\"".to_string())
    })?;

    let mut zip_writer = ZipWriter::new(out);
    let mut buffer = Vec::new();
    while !paths_queue.is_empty() {
        let next = paths_queue.pop().ok_or_else(|| {
            RuntimeError::ArchiveCreationDetailError("Could not get path from queue".to_string())
        })?;
        let current_dir = next.as_path();
        let directory_entry_iterator = std::fs::read_dir(current_dir)
            .map_err(|e| RuntimeError::IoError("Could not read directory".to_string(), e))?;
        let zip_directory = Path::new(zip_root_folder_name).join(
            current_dir.strip_prefix(directory).map_err(|_| {
                RuntimeError::ArchiveCreationDetailError(
                    "Could not append base directory".to_string(),
                )
            })?,
        );

        for entry in directory_entry_iterator {
            let entry_path = entry
                .ok()
                .ok_or_else(|| {
                    RuntimeError::InvalidPathError(
                        "Directory name terminates in \"..\"".to_string(),
                    )
                })?
                .path();
            let entry_metadata = std::fs::metadata(entry_path.clone()).map_err(|e| {
                RuntimeError::IoError(
                    format!(
                        "Could not get file metadata of '{}'",
                        entry_path.to_string_lossy()
                    )
                    .to_string(),
                    e,
                )
            })?;

            if entry_metadata.file_type().is_symlink() && skip_symlinks {
                continue;
            }
            let current_entry_name = entry_path.file_name().ok_or_else(|| {
                RuntimeError::InvalidPathError("Invalid file or directory name".to_string())
            })?;

            // To let every software correctly parse the file structure in ZIP files that are produced
            // on any platform (esp. Windows), always use forward slashes. The documentation:
            // https://users.cs.jmu.edu/buchhofp/forensics/formats/pkzip.html
            let relative_path = if cfg!(windows) {
                let branch = zip_directory
                    .as_os_str()
                    .to_string_lossy()
                    .trim_end_matches(r"\") // every branch ends with two backslashes "\\".
                    .replace(r"\", "/"); // every branch uses backslash "\" as path separators.
                let leaf = current_entry_name.to_string_lossy();
                format!("{branch}/{leaf}") // construct a Unix-style path in the simplest way.
  
```

### Core Architecture Module: `src/args.rs`
```
use std::fmt::Display;
use std::net::IpAddr;
use std::path::PathBuf;

use actix_web::http::header::{HeaderMap, HeaderName, HeaderValue};
use clap::{Parser, ValueEnum, ValueHint};

use crate::auth;
use crate::listing::{SortingMethod, SortingOrder};
use crate::renderer::ThemeSlug;

#[derive(ValueEnum, Clone)]
pub enum MediaType {
    Image,
    Audio,
    Video,
}

#[derive(Debug, ValueEnum, Clone, Default, Copy)]
pub enum DuplicateFile {
    #[default]
    Error,
    Overwrite,
    Rename,
}

#[derive(ValueEnum, Clone)]
pub enum SizeDisplay {
    Human,
    Exact,
}

impl Display for SizeDisplay {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SizeDisplay::Human => write!(f, "human"),
            SizeDisplay::Exact => write!(f, "exact"),
        }
    }
}

#[derive(Debug, ValueEnum, Clone, Copy, Default)]
pub enum LogColor {
    #[default]
    Auto,
    Always,
    Never,
}

#[derive(Parser)]
#[command(name = "miniserve", author, about, version)]
pub struct CliArgs {
    /// Be verbose, includes emitting access logs
    #[arg(short = 'v', long = "verbose", env = "MINISERVE_VERBOSE")]
    pub verbose: bool,

    /// Which path to serve
    #[arg(value_hint = ValueHint::AnyPath, env = "MINISERVE_PATH")]
    pub path: Option<PathBuf>,

    /// The path to where file uploads will be written to before being moved to their
    /// correct location. It's wise to make sure that this directory will be written to
    /// disk and not into memory.
    ///
    /// This value will only be used **IF** file uploading is enabled. If this option is
    /// not set, the operating system default temporary directory will be used.
    #[arg(
        long = "temp-directory",
        value_hint = ValueHint::FilePath,
        requires = "allowed_upload_dir",
        value_parser(validate_is_dir_and_exists),
        env = "MINISERVER_TEMP_UPLOAD_DIRECTORY")
    ]
    pub temp_upload_directory: Option<PathBuf>,

    /// The name of a directory index file to serve, like "index.html"
    ///
    /// Normally, when miniserve serves a directory, it creates a listing for that directory.
    /// However, if a directory contains this file, miniserve will serve that file instead.
    #[arg(long, value_hint = ValueHint::FilePath, env = "MINISERVE_INDEX")]
    pub index: Option<PathBuf>,

    /// Activate SPA (Single Page Application) mode
    ///
    /// This will cause the file given by --index to be served for all non-existing file paths. In
    /// effect, this will serve the index file whenever a 404 would otherwise occur in order to
    /// allow the SPA router to handle the request instead.
    #[arg(long, requires = "index", env = "MINISERVE_SPA")]
    pub spa: bool,

    /// Reduce output and silence warnings.
    #[arg(long, env = "MINISERVE_QUIET")]
    pub quiet: bool,

    /// Activate Pretty URLs mode
    ///
    /// This will cause the server to serve the equivalent `.html` file indicated by the path.
    ///
    /// `/about` will try to find `about.html` and serve it.
    #[arg(long, env = "MINISERVE_PRETTY_URLS")]
    pub pretty_urls: bool,

    /// Port to use
    #[arg(
        short = 'p',
        long = "port",
        default_value = "8080",
        env = "MINISERVE_PORT"
    )]
    pub port: u16,

    /// Interface to listen on
    #[arg(
        short = 'i',
        long = "interfaces",
        value_parser(parse_interface),
        num_args(1),
        env = "MINISERVE_INTERFACE"
    )]
    pub interfaces: Vec<IpAddr>,

    /// Number of server workers
    #[arg(long = "workers", default_value = "4", env = "MINISERVE_WORKERS")]
    pub workers: usize,

    /// Set authentication
    ///
    /// Currently supported formats:
    /// username:password, username:sha256:hash, username:sha512:hash
    /// (e.g. joe:123, joe:sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3)
    #[arg(
        short = 'a',
        long = "auth",
        value_parser(parse_auth),
        num_args(1),
        env = "MINISERVE_AUTH",
        verbatim_doc_comment
    )]
    pub auth: Vec<auth::RequiredAuth>,

    /// Read authentication values from a file
    ///
    /// Example file content:
    ///
    /// joe:123
    /// bob:sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
    /// bill:
    #[arg(long, value_hint = ValueHint::FilePath, env = "MINISERVE_AUTH_FILE", verbatim_doc_comment)]
    pub auth_file: Option<PathBuf>,

    /// Use a specific route prefix
    #[arg(long = "route-prefix", env = "MINISERVE_ROUTE_PREFIX")]
    pub route_prefix: Option<String>,

    /// Generate a random 6-hexdigit route
    #[arg(
        long = "random-route",
        conflicts_with("route_prefix"),
        env = "MINISERVE_RANDOM_ROUTE"
    )]
    pub random_route: bool,

    /// Hide symlinks in listing and prevent them from being followed
    #[arg(short = 'P', long = "no-symlinks", env = "MINISERVE_NO_SYMLINKS")]
    pub no_symlinks: bool,

    /// Show hidden files
    #[arg(short = 'H', long = "hidden", env = "MINISERVE_HIDDEN")]
    pub hidden: bool,

    /// Default sorting method for file list
    #[arg(
        short = 'S',
        long = "default-sorting-method",
        default_value = "name",
        ignore_case = true,
        env = "MINISERVE_DEFAULT_SORTING_METHOD"
    )]
    pub default_sorting_method: SortingMethod,

    /// Default sorting order for file list
    #[arg(
        short = 'O',
        long = "default-sorting-order",
        default_value = "desc",
        ignore_case = true,
        env = "MINISERVE_DEFAULT_SORTING_ORDER"
    )]
    pub default_sorting_order: SortingOrder,

    /// Default color scheme
    #[arg(
        short = 'c',
        long = "color-scheme",
        default_value = "squirrel",
        ignore_case = true,
        env = "MINISERVE_COLOR_SCHEME"
    )]
    pub color_scheme: ThemeSlug,

    /// Default color scheme
    #[arg(
        short = 'd',
        long = "color-scheme-dark",
        default_value = "archlinux",
        ignore_case = true,
        env = "MINISERVE_COLOR_SCHEME_DARK"
    )]
    pub color_scheme_dark: ThemeSlug,

    /// Enable QR code display
    #[arg(short = 'q', long = "qrcode", env = "MINISERVE_QRCODE")]
    pub qrcode: bool,

    /// Enable file uploading (and optionally specify for which directory)
    ///
    /// The provided path is not a physical file system path. Instead, it's relative to the serve
    /// dir. For instance, if the serve dir is '/home/hello', set this to '/upload' to allow
    /// uploading to '/home/hello/upload'.
    /// When specified via environment variable, a path always needs to be specified.
    #[arg(short = 'u', long = "upload-files", value_hint = ValueHint::FilePath, num_args(0..=1), value_delimiter(','), env = "MINISERVE_ALLOWED_UPLOAD_DIR")]
    pub allowed_upload_dir: Option<Vec<PathBuf>>,

    /// Configure amount of concurrent uploads when visiting the website. Must have
    /// upload-files option enabled for this setting to matter.
    ///
    /// For example, a value of 4 would mean that the web browser will only upload
    /// 4 files at a time to the web server when using the web browser interface.
    ///
    /// When the value is kept at 0, it attempts to resolve all the uploads at once
    /// in the web browser.
    ///
    /// NOTE: Web pages have a limit of how many active HTTP connections that they
    /// can make at one time, so even though you might set a concurrency limit of
    /// 100, the browser might only make progress on the max amount of connections
    /// it allows the web page to have open.
    #[arg(
        long = "web-upload-files-concurrency",
        env = "MINISERVE_WEB_UPLOAD_CONCURRENCY",
        default_value = "0"
    )]
    pub web_upload_concurrency: usize,

    /// Set unix file permissions of uploaded files
    ///
    /// This takes an octal number, for example 0600. By default 0666 & ~umask is used to simulate
    /// the system's default beh
```

### Core Architecture Module: `src/auth.rs`
```
use actix_web::{HttpMessage, dev::ServiceRequest, web};
use actix_web_httpauth::extractors::basic::BasicAuth;
use sha2::{Digest, Sha256, Sha512};

use crate::errors::RuntimeError;

#[derive(Clone, Debug)]
/// HTTP Basic authentication parameters
pub struct BasicAuthParams {
    pub username: String,
    pub password: String,
}

impl From<BasicAuth> for BasicAuthParams {
    fn from(auth: BasicAuth) -> Self {
        Self {
            username: auth.user_id().to_string(),
            password: auth.password().unwrap_or_default().to_string(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
/// `password` field of `RequiredAuth`
pub enum RequiredAuthPassword {
    Plain(String),
    Sha256(Vec<u8>),
    Sha512(Vec<u8>),
}

#[derive(Clone, Debug, PartialEq, Eq)]
/// Authentication structure to match `BasicAuthParams` against
pub struct RequiredAuth {
    pub username: String,
    pub password: RequiredAuthPassword,
}

/// Return `true` if `basic_auth` is matches any of `required_auth`
pub fn match_auth(basic_auth: &BasicAuthParams, required_auth: &[RequiredAuth]) -> bool {
    required_auth
        .iter()
        .any(|RequiredAuth { username, password }| {
            basic_auth.username == *username && compare_password(&basic_auth.password, password)
        })
}

/// Return `true` if `basic_auth_pwd` meets `required_auth_pwd`'s requirement
pub fn compare_password(basic_auth_pwd: &str, required_auth_pwd: &RequiredAuthPassword) -> bool {
    match &required_auth_pwd {
        RequiredAuthPassword::Plain(required_password) => *basic_auth_pwd == *required_password,
        RequiredAuthPassword::Sha256(password_hash) => {
            compare_hash::<Sha256>(basic_auth_pwd, password_hash)
        }
        RequiredAuthPassword::Sha512(password_hash) => {
            compare_hash::<Sha512>(basic_auth_pwd, password_hash)
        }
    }
}

/// Return `true` if hashing of `password` by `T` algorithm equals to `hash`
pub fn compare_hash<T: Digest>(password: &str, hash: &[u8]) -> bool {
    get_hash::<T>(password) == hash
}

/// Get hash of a `text`
pub fn get_hash<T: Digest>(text: &str) -> Vec<u8> {
    let mut hasher = T::new();
    hasher.update(text);
    hasher.finalize().to_vec()
}

pub struct CurrentUser {
    pub name: String,
}

pub async fn handle_auth(
    req: ServiceRequest,
    cred: BasicAuth,
) -> actix_web::Result<ServiceRequest, (actix_web::Error, ServiceRequest)> {
    let required_auth = &req
        .app_data::<web::Data<crate::MiniserveConfig>>()
        .unwrap()
        .auth;

    req.extensions_mut().insert(CurrentUser {
        name: cred.user_id().to_string(),
    });

    if match_auth(&cred.into(), required_auth) {
        Ok(req)
    } else {
        Err((RuntimeError::InvalidHttpCredentials.into(), req))
    }
}

#[rustfmt::skip]
#[cfg(test)]
mod tests {
    use super::*;
    use rstest::{rstest, fixture};
    use pretty_assertions::assert_eq;

    /// Return a hashing function corresponds to given name
    fn get_hash_func(name: &str) -> impl FnOnce(&str) -> Vec<u8> {
        match name {
            "sha256" => get_hash::<Sha256>,
            "sha512" => get_hash::<Sha512>,
            _ => panic!("Invalid hash method"),
        }
    }

    #[rstest(
        password, hash_method, hash,
        case("abc", "sha256", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"),
        case("abc", "sha512", "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"),
    )]
    fn test_get_hash(password: &str, hash_method: &str, hash: &str) {
        let hash_func = get_hash_func(hash_method);
        let expected = hex::decode(hash).expect("Provided hash is not a valid hex code");
        let received = hash_func(password);
        assert_eq!(received, expected);
    }

    /// Helper function that creates a `RequiredAuth` structure and encrypt `password` if necessary
    fn create_required_auth(username: &str, password: &str, encrypt: &str) -> RequiredAuth {
        use RequiredAuthPassword::*;

        let password = match encrypt {
            "plain" => Plain(password.to_owned()),
            "sha256" => Sha256(get_hash::<sha2::Sha256>(password)),
            "sha512" => Sha512(get_hash::<sha2::Sha512>(password)),
            _ => panic!("Unknown encryption type"),
        };

        RequiredAuth {
            username: username.to_owned(),
            password,
        }
    }

    #[rstest(
        should_pass, param_username, param_password, required_username, required_password, encrypt,
        case(true, "obi", "hello there", "obi", "hello there", "plain"),
        case(false, "obi", "hello there", "obi", "hi!", "plain"),
        case(true, "obi", "hello there", "obi", "hello there", "sha256"),
        case(false, "obi", "hello there", "obi", "hi!", "sha256"),
        case(true, "obi", "hello there", "obi", "hello there", "sha512"),
        case(false, "obi", "hello there", "obi", "hi!", "sha512")
    )]
    fn test_single_auth(
        should_pass: bool,
        param_username: &str,
        param_password: &str,
        required_username: &str,
        required_password: &str,
        encrypt: &str,
    ) {
        assert_eq!(
            match_auth(
                &BasicAuthParams {
                    username: param_username.to_owned(),
                    password: param_password.to_owned(),
                },
                &[create_required_auth(required_username, required_password, encrypt)],
            ),
            should_pass,
        )
    }

    /// Helper function that creates a sample of multiple accounts
    #[fixture]
    fn account_sample() -> Vec<RequiredAuth> {
        [
            ("usr0", "pwd0", "plain"),
            ("usr1", "pwd1", "plain"),
            ("usr2", "pwd2", "sha256"),
            ("usr3", "pwd3", "sha256"),
            ("usr4", "pwd4", "sha512"),
            ("usr5", "pwd5", "sha512"),
        ]
            .iter()
            .map(|(username, password, encrypt)| create_required_auth(username, password, encrypt))
            .collect()
    }

    #[rstest(
        username, password,
        case("usr0", "pwd0"),
        case("usr1", "pwd1"),
        case("usr2", "pwd2"),
        case("usr3", "pwd3"),
        case("usr4", "pwd4"),
        case("usr5", "pwd5"),
    )]
    fn test_multiple_auth_pass(
        account_sample: Vec<RequiredAuth>,
        username: &str,
        password: &str,
    ) {
        assert!(match_auth(
            &BasicAuthParams {
                username: username.to_owned(),
                password: password.to_owned(),
            },
            &account_sample,
        ));
    }

    #[rstest]
    fn test_multiple_auth_wrong_username(account_sample: Vec<RequiredAuth>) {
        assert_eq!(match_auth(
            &BasicAuthParams {
                username: "unregistered user".to_owned(),
                password: "pwd0".to_owned(),
            },
            &account_sample,
        ), false);
    }

    #[rstest(
        username, password,
        case("usr0", "pwd5"),
        case("usr1", "pwd4"),
        case("usr2", "pwd3"),
        case("usr3", "pwd2"),
        case("usr4", "pwd1"),
        case("usr5", "pwd0"),
    )]
    fn test_multiple_auth_wrong_password(
        account_sample: Vec<RequiredAuth>,
        username: &str,
        password: &str,
    ) {
        assert_eq!(match_auth(
            &BasicAuthParams {
                username: username.to_owned(),
                password: password.to_owned(),
            },
            &account_sample,
        ), false);
    }
}

```

### Core Architecture Module: `src/config.rs`
```
use std::{
    fs::File,
    io::{BufRead, BufReader},
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
    path::{Path, PathBuf},
};

use actix_web::http::header::HeaderMap;
use anyhow::{Context, Result, anyhow};

#[cfg(feature = "tls")]
use rustls_pemfile as pemfile;

#[cfg(unix)]
use crate::file_utils::get_default_filemode;
use crate::{
    args::{CliArgs, DuplicateFile, LogColor, MediaType, parse_auth},
    auth::RequiredAuth,
    file_utils::sanitize_path,
    listing::{SortingMethod, SortingOrder},
    renderer::ThemeSlug,
};

/// Possible characters for random routes
const ROUTE_ALPHABET: [char; 16] = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'a', 'b', 'c', 'd', 'e', 'f',
];

#[derive(Debug, Clone)]
/// Configuration of the Miniserve application
pub struct MiniserveConfig {
    /// Enable verbose mode
    pub verbose: bool,

    /// Path to be served by miniserve
    pub path: std::path::PathBuf,

    /// Temporary directory that should be used when files are uploaded to the server
    pub temp_upload_directory: Option<std::path::PathBuf>,

    /// Port on which miniserve will be listening
    pub port: u16,

    /// IP address(es) on which miniserve will be available
    pub interfaces: Vec<IpAddr>,

    /// Number of server workers
    pub workers: usize,

    /// Enable HTTP basic authentication
    pub auth: Vec<RequiredAuth>,

    /// If false, miniserve will serve the current working directory
    pub path_explicitly_chosen: bool,

    /// Enable symlink resolution
    pub no_symlinks: bool,

    /// Show hidden files
    pub show_hidden: bool,

    /// Default sorting method
    pub default_sorting_method: SortingMethod,

    /// Default sorting order
    pub default_sorting_order: SortingOrder,

    /// Route prefix; Either empty or prefixed with slash
    pub route_prefix: String,

    /// Well-known healthcheck route (prefixed if route_prefix is provided)
    pub healthcheck_route: String,

    /// Well-known API route (prefixed if route_prefix is provided)
    pub api_route: String,

    /// Well-known favicon route (prefixed if route_prefix is provided)
    pub favicon_route: String,

    /// Well-known css route (prefixed if route_prefix is provided)
    pub css_route: String,

    /// Default color scheme
    pub default_color_scheme: ThemeSlug,

    /// Default dark mode color scheme
    pub default_color_scheme_dark: ThemeSlug,

    /// The name of a directory index file to serve, like "index.html"
    ///
    /// Normally, when miniserve serves a directory, it creates a listing for that directory.
    /// However, if a directory contains this file, miniserve will serve that file instead.
    pub index: Option<std::path::PathBuf>,

    /// Activate SPA (Single Page Application) mode
    ///
    /// This will cause the file given by `index` to be served for all non-existing file paths. In
    /// effect, this will serve the index file whenever a 404 would otherwise occur in order to
    /// allow the SPA router to handle the request instead.
    pub spa: bool,

    /// Reduce output and silence warnings.
    pub quiet: bool,

    /// Activate Pretty URLs mode
    ///
    /// This will cause the server to serve the equivalent `.html` file indicated by the path.
    ///
    /// `/about` will try to find `about.html` and serve it.
    pub pretty_urls: bool,

    /// Enable QR code display
    pub show_qrcode: bool,

    /// Enable recursive directory size calculation
    pub directory_size: bool,

    /// Enable creating directories
    pub mkdir_enabled: bool,

    /// Enable file upload
    pub file_upload: bool,

    /// Enable pastepin creation
    pub pastebin_enabled: bool,

    /// Max amount of concurrency when uploading multiple files
    pub web_upload_concurrency: usize,

    /// chmod permissions of uploaded files
    #[cfg(unix)]
    pub upload_chmod: u16,

    /// List of allowed upload directories
    pub allowed_upload_dir: Vec<String>,

    /// HTML accept attribute value
    pub uploadable_media_type: Option<String>,

    /// What to do on upload if filename already exists
    pub on_duplicate_files: DuplicateFile,

    /// Enable file and directory deletion
    pub rm_enabled: bool,

    /// List of allowed deletion directories
    pub allowed_rm_dir: Vec<String>,

    /// If false, creation of uncompressed tar archives is disabled
    pub tar_enabled: bool,

    /// If false, creation of gz-compressed tar archives is disabled
    pub tar_gz_enabled: bool,

    /// If false, creation of zip archives is disabled
    pub zip_enabled: bool,

    /// Enable  compress response
    pub compress_response: bool,

    /// If enabled, directories are listed first
    pub dirs_first: bool,

    /// Shown instead of host in page title and heading
    pub title: Option<String>,

    /// If specified, header will be added
    pub header: Vec<HeaderMap>,

    /// If specified, symlink destination will be shown
    pub show_symlink_info: bool,

    /// If enabled, version footer is hidden
    pub hide_version_footer: bool,

    /// If enabled, theme selector is hidden
    pub hide_theme_selector: bool,

    /// If enabled, display a wget command to recursively download the current directory
    pub show_wget_footer: bool,

    /// If enabled, render the readme from the current directory
    pub readme: bool,

    /// If enabled, indexing is disabled.
    pub disable_indexing: bool,

    /// If enabled, respond to WebDAV requests (read-only).
    pub webdav_enabled: bool,

    /// If enabled, will show in exact byte size of the file
    pub show_exact_bytes: bool,

    /// If set, use provided rustls config for TLS
    #[cfg(feature = "tls")]
    pub tls_rustls_config: Option<rustls::ServerConfig>,

    #[cfg(not(feature = "tls"))]
    pub tls_rustls_config: Option<()>,

    /// Optional external URL to prepend to file links in listings
    pub file_external_url: Option<String>,

    /// Color choice for the log output
    pub log_color: LogColor,
}

impl MiniserveConfig {
    /// Parses the command line arguments
    pub fn try_from_args(args: CliArgs) -> Result<Self> {
        let interfaces = if !args.interfaces.is_empty() {
            args.interfaces
        } else {
            vec![
                IpAddr::V6(Ipv6Addr::new(0, 0, 0, 0, 0, 0, 0, 0)),
                IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)),
            ]
        };

        let route_prefix = match (args.route_prefix, args.random_route) {
            (Some(prefix), _) => format!("/{}", prefix.trim_matches('/')),
            (_, true) => format!("/{}", nanoid::nanoid!(6, &ROUTE_ALPHABET)),
            _ => "".to_owned(),
        };

        let mut auth = args.auth;

        if let Some(path) = args.auth_file {
            let file = File::open(path)?;
            let lines = BufReader::new(file).lines();

            for line in lines {
                auth.push(parse_auth(line?.as_str())?);
            }
        }

        // Format some well-known routes at paths that are very unlikely to conflict with real
        // files.
        // If --random-route is enabled, in order to not leak the random generated route, we must not use it
        // as static files prefix.
        // Otherwise, we should apply route_prefix to static files.
        let (healthcheck_route, api_route, favicon_route, css_route) = if args.random_route {
            (
                "/__miniserve_internal/healthcheck".into(),
                "/__miniserve_internal/api".into(),
                "/__miniserve_internal/favicon.svg".into(),
                "/__miniserve_internal/style.css".into(),
            )
        } else {
            (
                format!("{}/{}", route_prefix, "__miniserve_internal/healthcheck"),
                format!("{}/{}", route_prefix, "__miniserve_internal/api"),
                format!("{}/{}", route_prefix, "__miniserve_internal/favicon.svg"),
                format!("{}/{}", route_prefix, "__miniserve_internal/style.css"),
            )
        };

```

### Core Architecture Module: `src/consts.rs`
```
use fast_qr::ECL;

/// The error correction level to use for all QR code generation.
pub const QR_EC_LEVEL: ECL = ECL::L;

/// The margin size for the SVG QR code on the webpage.
pub const SVG_QR_MARGIN: usize = 1;

```

### Core Architecture Module: `src/errors.rs`
```
use std::str::FromStr;

use actix_web::{
    HttpRequest, HttpResponse, ResponseError,
    body::{BoxBody, MessageBody},
    dev::{ResponseHead, ServiceRequest, ServiceResponse},
    http::{StatusCode, header},
    middleware::Next,
    web,
};
use thiserror::Error;

use crate::{MiniserveConfig, renderer::render_error};

#[derive(Debug, Error)]
pub enum StartupError {
    /// Any kind of IO errors
    #[error("{0}\ncaused by: {1}")]
    IoError(String, std::io::Error),

    /// In case miniserve was invoked without an interactive terminal and without an explicit path
    #[error("Refusing to start as no explicit serve path was set and no interactive terminal was attached
Please set an explicit serve path like: `miniserve /my/path`")]
    NoExplicitPathAndNoTerminal,

    /// In case miniserve was invoked with --no-symlinks but the serve path is a symlink
    #[error("The -P|--no-symlinks option was provided but the serve path '{0}' is a symlink")]
    NoSymlinksOptionWithSymlinkServePath(String),

    #[error("The --enable-webdav option was provided, but the serve path '{0}' is a file")]
    WebdavWithFileServePath(String),
}

#[derive(Debug, Error)]
pub enum RuntimeError {
    /// Any kind of IO errors
    #[error("{0}\ncaused by: {1}")]
    IoError(String, std::io::Error),

    /// Might occur during file upload, when processing the multipart request fails
    #[error("Failed to process multipart request\ncaused by: {0}")]
    MultipartError(String),

    /// Might occur during file upload
    #[error("File already exists, and the on_duplicate_files option is set to error out")]
    DuplicateFileError,

    /// Uploaded hash not correct
    #[error("File hash that was provided did not match checksum of uploaded file")]
    UploadHashMismatchError,

    /// Upload not allowed
    #[error("Upload not allowed to this directory")]
    UploadForbiddenError,

    /// Remove not allowed
    #[error("Remove not allowed to this directory")]
    RmForbiddenError,

    /// Any error related to an invalid path (failed to retrieve entry name, unexpected entry type, etc)
    #[error("Invalid path\ncaused by: {0}")]
    InvalidPathError(String),

    /// Might occur if the user has insufficient permissions to create an entry in a given directory
    #[error("Insufficient permissions to create file in {0}")]
    InsufficientPermissionsError(String),

    /// Any error related to parsing
    #[error("Failed to parse {0}\ncaused by: {1}")]
    ParseError(String, String),

    /// Might occur when the creation of an archive fails
    #[error("An error occurred while creating the {0}\ncaused by: {1}")]
    ArchiveCreationError(String, Box<RuntimeError>),

    /// More specific archive creation failure reason
    #[error("{0}")]
    ArchiveCreationDetailError(String),

    /// Might occur when the HTTP credentials are not correct
    #[error("Invalid credentials for HTTP authentication")]
    InvalidHttpCredentials,

    /// Might occur when an HTTP request is invalid
    #[error("Invalid HTTP request\ncaused by: {0}")]
    InvalidHttpRequestError(String),

    /// Might occur when trying to access a page that does not exist
    #[error("Route {0} could not be found")]
    RouteNotFoundError(String),
}

impl ResponseError for RuntimeError {
    fn status_code(&self) -> StatusCode {
        use RuntimeError as E;
        use StatusCode as S;
        match self {
            E::IoError(_, _) => S::INTERNAL_SERVER_ERROR,
            E::UploadHashMismatchError => S::BAD_REQUEST,
            E::MultipartError(_) => S::BAD_REQUEST,
            E::DuplicateFileError => S::CONFLICT,
            E::UploadForbiddenError => S::FORBIDDEN,
            E::RmForbiddenError => S::FORBIDDEN,
            E::InvalidPathError(_) => S::BAD_REQUEST,
            E::InsufficientPermissionsError(_) => S::FORBIDDEN,
            E::ParseError(_, _) => S::BAD_REQUEST,
            E::ArchiveCreationError(_, err) => err.status_code(),
            E::ArchiveCreationDetailError(_) => S::INTERNAL_SERVER_ERROR,
            E::InvalidHttpCredentials => S::UNAUTHORIZED,
            E::InvalidHttpRequestError(_) => S::BAD_REQUEST,
            E::RouteNotFoundError(_) => S::NOT_FOUND,
        }
    }

    fn error_response(&self) -> HttpResponse {
        log_error_chain(self.to_string());

        let mut resp = HttpResponse::build(self.status_code());
        if let Self::InvalidHttpCredentials = self {
            resp.append_header((
                header::WWW_AUTHENTICATE,
                header::HeaderValue::from_static("Basic realm=\"miniserve\""),
            ));
        }

        resp.content_type(mime::TEXT_PLAIN_UTF_8)
            .body(self.to_string())
    }
}

/// Middleware to convert plain-text error responses to user-friendly web pages
pub async fn error_page_middleware(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, actix_web::Error> {
    let res = next.call(req).await?.map_into_boxed_body();

    if (res.status().is_client_error() || res.status().is_server_error())
        && res.request().path() != "/upload"
        && res
            .headers()
            .get(header::CONTENT_TYPE)
            .map(AsRef::as_ref)
            .and_then(|s| std::str::from_utf8(s).ok())
            .and_then(|s| mime::Mime::from_str(s).ok())
            .as_ref()
            .map(mime::Mime::essence_str)
            == Some(mime::TEXT_PLAIN.as_ref())
    {
        let req = res.request().clone();
        Ok(res.map_body(|head, body| map_error_page(&req, head, body)))
    } else {
        Ok(res)
    }
}

fn map_error_page(req: &HttpRequest, head: &mut ResponseHead, body: BoxBody) -> BoxBody {
    let error_msg = match body.try_into_bytes() {
        Ok(bytes) => bytes,
        Err(body) => return body,
    };

    let error_msg = match std::str::from_utf8(&error_msg) {
        Ok(msg) => msg,
        _ => return BoxBody::new(error_msg),
    };

    let conf = req.app_data::<web::Data<MiniserveConfig>>().unwrap();
    let return_address = req
        .headers()
        .get(header::REFERER)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("/");

    head.headers.insert(
        header::CONTENT_TYPE,
        mime::TEXT_HTML_UTF_8.essence_str().try_into().unwrap(),
    );

    BoxBody::new(render_error(error_msg, head.status, conf, return_address).into_string())
}

pub fn log_error_chain(description: String) {
    for cause in description.lines() {
        log::error!("{cause}");
    }
}

```

### Core Architecture Module: `src/file_op.rs`
```
//! Handlers for file upload and removal

#[cfg(target_family = "unix")]
use std::collections::HashSet;

use std::io::ErrorKind;

#[cfg(target_family = "unix")]
use std::os::unix::fs::MetadataExt;

use std::path::{Component, Path, PathBuf};

#[cfg(target_family = "unix")]
use std::sync::Arc;

use actix_web::{HttpRequest, HttpResponse, http::header, web};
use async_walkdir::WalkDir;
use futures::{StreamExt, TryStreamExt};
use log::{error, info, warn};
use serde::Deserialize;
use sha2::digest::DynDigest;
use sha2::{Digest, Sha256, Sha512};
use tempfile::NamedTempFile;
use tokio::fs;
use tokio::io::AsyncWriteExt;

#[cfg(target_family = "unix")]
use tokio::sync::RwLock;

use crate::{
    args::DuplicateFile, config::MiniserveConfig, errors::RuntimeError,
    file_utils::contains_symlink, file_utils::sanitize_path,
};

enum FileHash {
    SHA256(String),
    SHA512(String),
}

impl FileHash {
    pub fn get_hasher(&self) -> Box<dyn DynDigest> {
        match self {
            Self::SHA256(_) => Box::new(Sha256::new()),
            Self::SHA512(_) => Box::new(Sha512::new()),
        }
    }

    pub fn get_hash(&self) -> &str {
        match self {
            Self::SHA256(string) => string,
            Self::SHA512(string) => string,
        }
    }
}

/// Get the recursively calculated dir size for a given dir
///
/// Counts hardlinked files only once if the OS supports hardlinks.
///
/// Expects `dir` to be sanitized. This function doesn't do any sanitization itself.
pub async fn recursive_dir_size(dir: &Path) -> Result<u64, RuntimeError> {
    #[cfg(target_family = "unix")]
    let seen_inodes = Arc::new(RwLock::new(HashSet::new()));

    let mut entries = WalkDir::new(dir);

    let mut total_size = 0;
    loop {
        match entries.next().await {
            Some(Ok(entry)) => {
                if let Ok(metadata) = entry.metadata().await
                    && metadata.is_file()
                {
                    // On Unix, we want to filter inodes that we've already seen so we get a
                    // more accurate count of real size used on disk.
                    #[cfg(target_family = "unix")]
                    {
                        let (device_id, inode) = (metadata.dev(), metadata.ino());

                        // Check if this file has been seen before based on its device ID and
                        // inode number
                        if seen_inodes.read().await.contains(&(device_id, inode)) {
                            continue;
                        } else {
                            seen_inodes.write().await.insert((device_id, inode));
                        }
                    }
                    total_size += metadata.len();
                }
            }
            Some(Err(e)) => {
                if let Some(io_err) = e.into_io() {
                    match io_err.kind() {
                        ErrorKind::PermissionDenied => warn!(
                            "Error trying to read file when calculating dir size: {io_err}, ignoring"
                        ),
                        _ => return Err(RuntimeError::InvalidPathError(io_err.to_string())),
                    }
                }
            }
            None => break,
        }
    }
    Ok(total_size)
}

/// Saves file data from a multipart form field (`field`) to `file_path`. Optionally overwriting
/// existing file and comparing the uploaded file checksum to the user provided `file_hash`.
///
/// Returns total bytes written to file.
async fn save_file(
    field: &mut actix_multipart::Field,
    mut file_path: PathBuf,
    on_duplicate_files: DuplicateFile,
    file_checksum: Option<&FileHash>,
    temporary_upload_directory: Option<&PathBuf>,
    #[cfg(unix)] chmod: u16,
) -> Result<u64, RuntimeError> {
    if file_path.exists() {
        match on_duplicate_files {
            DuplicateFile::Error => return Err(RuntimeError::DuplicateFileError),
            DuplicateFile::Overwrite => (),
            DuplicateFile::Rename => {
                // extract extension of the file and the file stem without extension
                // file.txt => (file, txt)
                let file_name = file_path.file_stem().unwrap_or_default().to_string_lossy();
                let file_ext = file_path.extension().map(|s| s.to_string_lossy());
                for i in 1.. {
                    // increment the number N in {file_name}-{N}.{file_ext}
                    // format until available name is found (e.g. file-1.txt, file-2.txt, etc)
                    let fp = if let Some(ext) = &file_ext {
                        file_path.with_file_name(format!("{file_name}-{i}.{ext}"))
                    } else {
                        file_path.with_file_name(format!("{file_name}-{i}"))
                    };
                    // If we have a file name that doesn't exist yet then we'll use that.
                    if !fp.exists() {
                        file_path = fp;
                        break;
                    }
                }
            }
        }
    }

    let temp_upload_directory = temporary_upload_directory.cloned();
    // Tempfile doesn't support async operations, so we'll do it on a background thread.
    let temp_upload_directory_task = tokio::task::spawn_blocking(move || {
        // If the user provided a temporary directory path, then use it.
        if let Some(temp_directory) = temp_upload_directory {
            NamedTempFile::new_in(temp_directory)
        } else {
            NamedTempFile::new()
        }
    });

    // Validate that the temporary task completed successfully.
    let named_temp_file_task = match temp_upload_directory_task.await {
        Ok(named_temp_file) => Ok(named_temp_file),
        Err(err) => Err(RuntimeError::MultipartError(format!(
            "Failed to complete spawned task to create named temp file. {err}",
        ))),
    }?;

    // Validate the the temporary file was created successfully.
    let named_temp_file = match named_temp_file_task {
        Err(err) if err.kind() == ErrorKind::PermissionDenied => Err(
            RuntimeError::InsufficientPermissionsError(file_path.display().to_string()),
        ),
        Err(err) => Err(RuntimeError::IoError(
            format!("Failed to create temporary file {}", file_path.display()),
            err,
        )),
        Ok(file) => Ok(file),
    }?;

    // Convert the temporary file into a non-temporary file. This allows us
    // to control the lifecycle of the file. This is useful for us because
    // we need to convert the temporary file into an async enabled file and
    // on successful upload, we want to move it to the target directory.
    let (file, temp_path) = named_temp_file
        .keep()
        .map_err(|err| RuntimeError::IoError("Failed to keep temporary file".into(), err.error))?;
    let mut temp_file = tokio::fs::File::from_std(file);

    let mut written_len = 0;
    let mut hasher = file_checksum.as_ref().map(|h| h.get_hasher());
    let mut save_upload_file_error: Option<RuntimeError> = None;

    // This while loop take a stream (in this case `field`) and awaits
    // new chunks from the websocket connection. The while loop reads
    // the file from the HTTP connection and writes it to disk or until
    // the stream from the multipart request is aborted.
    while let Some(Ok(bytes)) = field.next().await {
        // If the hasher exists (if the user has also sent a chunksum with the request)
        // then we want to update the hasher with the new bytes uploaded.
        if let Some(hasher) = hasher.as_mut() {
            hasher.update(&bytes)
        }
        // Write the bytes from the stream into our temporary file.
        if let Err(e) = temp_file.write_all(&bytes).await {
            // Failed to write to file. Drop it and return the error
            save_upload_file_error =
                Some(RuntimeError::IoError("Failed to write to file".into(), e));
            break;
        }
   
```

### Core Architecture Module: `src/file_utils.rs`
```
#[cfg(unix)]
use rustix::{fs::Mode, process::umask};
use std::{
    io,
    path::{Component, Path, PathBuf},
};

/// Guarantee that the path is relative and cannot traverse back to parent directories
/// and optionally prevent traversing hidden directories.
///
/// See the unit tests tests::test_sanitize_path* for examples
pub fn sanitize_path(path: impl AsRef<Path>, traverse_hidden: bool) -> Option<PathBuf> {
    let mut buf = PathBuf::new();

    for comp in path.as_ref().components() {
        match comp {
            Component::Normal(name) => buf.push(name),
            Component::ParentDir => {
                buf.pop();
            }
            _ => (),
        }
    }

    // Double-check that all components are Normal and check for hidden dirs
    for comp in buf.components() {
        match comp {
            Component::Normal(_) if traverse_hidden => (),
            Component::Normal(name) if !name.to_str()?.starts_with('.') => (),
            _ => return None,
        }
    }

    Some(buf)
}

/// Checks if any segment of the path is a symlink.
///
/// This function fails if [`std::fs::symlink_metadata`] fails, which usually
/// means user has no permission to access the path.
pub fn contains_symlink(path: impl AsRef<Path>) -> io::Result<bool> {
    let contains_symlink = path
        .as_ref()
        .ancestors()
        // On Windows, `\\?\` won't exist even though it's the root, but there's no need to check it
        // So we filter it out
        .filter(|p| p.exists())
        .map(|p| p.symlink_metadata())
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .any(|p| p.file_type().is_symlink());

    Ok(contains_symlink)
}

/// Get default file creation permissions by umask
#[cfg(unix)]
pub fn get_default_filemode() -> u16 {
    let old = umask(Mode::all());
    umask(old);
    let mode = 0o666 & (!old).as_raw_mode();
    mode as u16
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    #[rstest]
    #[case("/foo", "foo")]
    #[case("////foo", "foo")]
    #[case("C:/foo", if cfg!(windows) { "foo" } else { "C:/foo" })]
    #[case("../foo", "foo")]
    #[case("../foo/../bar/abc", "bar/abc")]
    fn test_sanitize_path(#[case] input: &str, #[case] output: &str) {
        assert_eq!(
            sanitize_path(Path::new(input), true).unwrap(),
            Path::new(output)
        );
        assert_eq!(
            sanitize_path(Path::new(input), false).unwrap(),
            Path::new(output)
        );
    }

    #[rstest]
    #[case(".foo")]
    #[case("/.foo")]
    #[case("foo/.bar/foo")]
    fn test_sanitize_path_no_hidden_files(#[case] input: &str) {
        assert_eq!(sanitize_path(Path::new(input), false), None);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1581** (2026-09-01): **Bump the all-dependencies group with 10 updates**
  *Symptoms*: Bumps the all-dependencies group with 10 updates:  | Package | From | To | | --- | --- | --- | | [actix-files](https://github.com/actix/actix-web) | `0.6.10` | `0.7.0` | | [actix-multipart](https://github.com/actix/actix-web) | `0.8.0` | `0.8.1` | | [actix-web](https://github.com/actix/actix-web) | `4.14.0` | `4.15.0` | | [bytesize](https://github.com/bytesize-rs/bytesize) | `2.6.0` | `2.7.0` | | [clap](https://github.com/clap-rs/clap) | `4.6.5` | `4.6.6` | | [clap_complete](https://github.com/clap-rs/clap) | `4.6.8` | `4.6.9` | | [clap_mangen](https://github.com/clap-rs/clap) | `0.3.0` | `0.3.3` | | [futures](https://github.com/rust-lang/futures-rs) | `0.3.33` | `0.3.34` | | [log](https://github.com/rust-lang/log) | `0.4.33` | `0.4.34` | | [thiserror](https://github.com/dtolnay/thiserror) | `2.0.19` | `2.0.20` |  Updates `actix-files` from 0.6.10 to 0.7.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actix/actix-web/releases">actix-files's releases</a>.</em></p> <blockquote> <h2>actix-multipart-derive: v0.7.0</h2> <ul> <li>Minimum supported Rust version (MSRV) is now 1.72.</li> </ul> <h2>actix-multipart: v0.7.0</h2> <ul> <li>Add <code>MultipartError::ContentTypeIncompatible</code> variant.</li> <li>Add <code>MultipartError::ContentDispositionNameMissing</code> variant.</li> <li>Add <code>Field::bytes()</code> method.</li> <li>Rename <code>MultipartError::{NoContentDisposition =&gt; ContentDispositionMissing}</code> variant.</li> <
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are no longer updatable, so this is no longer needed.

- **Issue #1574** (2026-08-01): **Bump the all-dependencies group across 1 directory with 14 updates**
  *Symptoms*: Bumps the all-dependencies group with 14 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [alphanumeric-sort](https://github.com/magiclen/alphanumeric-sort) | `1.5.7` | `1.5.8` | | [anyhow](https://github.com/dtolnay/anyhow) | `1.0.103` | `1.0.104` | | [bytesize](https://github.com/bytesize-rs/bytesize) | `2.4.0` | `2.4.2` | | [clap](https://github.com/clap-rs/clap) | `4.6.1` | `4.6.4` | | [clap_complete](https://github.com/clap-rs/clap) | `4.6.6` | `4.6.8` | | [comrak](https://github.com/kivikakk/comrak) | `0.52.0` | `0.54.0` | | [futures](https://github.com/rust-lang/futures-rs) | `0.3.32` | `0.3.33` | | [libflate](https://github.com/sile/libflate) | `2.3.0` | `2.3.1` | | [regex](https://github.com/rust-lang/regex) | `1.12.4` | `1.13.1` | | [rustls](https://github.com/rustls/rustls) | `0.23.41` | `0.23.42` | | [serde](https://github.com/serde-rs/serde) | `1.0.228` | `1.0.229` | | [socket2](https://github.com/rust-lang/socket2) | `0.6.4` | `0.6.5` | | [thiserror](https://github.com/dtolnay/thiserror) | `2.0.18` | `2.0.19` | | [tokio](https://github.com/tokio-rs/tokio) | `1.52.3` | `1.53.1` |   Updates `alphanumeric-sort` from 1.5.7 to 1.5.8 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/magiclen/alphanumeric-sort/commit/0a7684e0787b06fb78382d98a6e49c7fa296bc50"><code>0a7684e</code></a> fix issue <a href="https://redirect.github.com/magiclen/alphanumeric-sort/issues/14">#14</a></li> <li><a href="https://github.com/magiclen/
  **Post-Mortem & Fix Analysis**:
  > @dependabot rebase
  > Looks like these dependencies are no longer updatable, so this is no longer needed.

- **Issue #1571** (2026-07-01): **Bump the all-dependencies group with 10 updates**
  *Symptoms*: Bumps the all-dependencies group with 10 updates:  | Package | From | To | | --- | --- | --- | | [actix-multipart](https://github.com/actix/actix-web) | `0.7.2` | `0.8.0` | | [actix-web](https://github.com/actix/actix-web) | `4.13.0` | `4.14.0` | | [alphanumeric-sort](https://github.com/magiclen/alphanumeric-sort) | `1.5.6` | `1.5.7` | | [anyhow](https://github.com/dtolnay/anyhow) | `1.0.102` | `1.0.103` | | [bytesize](https://github.com/bytesize-rs/bytesize) | `2.3.1` | `2.4.0` | | [chrono](https://github.com/chronotope/chrono) | `0.4.44` | `0.4.45` | | [clap_complete](https://github.com/clap-rs/clap) | `4.6.5` | `4.6.6` | | [log](https://github.com/rust-lang/log) | `0.4.30` | `0.4.33` | | [regex](https://github.com/rust-lang/regex) | `1.12.3` | `1.12.4` | | [rustls](https://github.com/rustls/rustls) | `0.23.40` | `0.23.41` |  Updates `actix-multipart` from 0.7.2 to 0.8.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actix/actix-web/releases">actix-multipart's releases</a>.</em></p> <blockquote> <h2>actix-multipart-derive: v0.8.0</h2> <h2>0.8.0</h2> <ul> <li>Minimum supported Rust version (MSRV) is now 1.88.</li> <li>Update <code>darling</code> dependency to <code>0.23</code>.</li> </ul> <h2>actix-multipart: v0.8.0</h2> <h2>0.8.0</h2> <ul> <li>Add multi-field multipart payload builders to <code>actix_multipart::test</code>. <a href="https://redirect.github.com/actix/actix-web/issues/3575">#3575</a></li> <li>Add <code>MultipartForm

- **Issue #1567** (2026-06-01): **Bump the all-dependencies group with 8 updates**
  *Symptoms*: Bumps the all-dependencies group with 8 updates:  | Package | From | To | | --- | --- | --- | | [clap_complete](https://github.com/clap-rs/clap) | `4.6.3` | `4.6.5` | | [log](https://github.com/rust-lang/log) | `0.4.29` | `0.4.30` | | [socket2](https://github.com/rust-lang/socket2) | `0.6.3` | `0.6.4` | | [tar](https://github.com/composefs/tar-rs) | `0.4.45` | `0.4.46` | | [tokio](https://github.com/tokio-rs/tokio) | `1.52.2` | `1.52.3` | | [assert_cmd](https://github.com/assert-rs/assert_cmd) | `2.2.1` | `2.2.2` | | [assert_fs](https://github.com/assert-rs/assert_fs) | `1.1.3` | `1.1.4` | | [reqwest](https://github.com/seanmonstar/reqwest) | `0.13.3` | `0.13.4` |  Updates `clap_complete` from 4.6.3 to 4.6.5 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/clap-rs/clap/commit/c8c935504a3f1a015470199ae82c3cb124b5b1d5"><code>c8c9355</code></a> chore: Release</li> <li><a href="https://github.com/clap-rs/clap/commit/af74def7141738c51ace956f58eb32dd94e998ab"><code>af74def</code></a> docs: Update changelog</li> <li><a href="https://github.com/clap-rs/clap/commit/c96f222c35c4ef4bd3ab9927809b2724532a8f6e"><code>c96f222</code></a> Merge pull request <a href="https://redirect.github.com/clap-rs/clap/issues/6368">#6368</a> from truffle-dev/fix/fish-env-escaping</li> <li><a href="https://github.com/clap-rs/clap/commit/49a05cdc99c2151cdd48d5ec4c974151d21c026e"><code>49a05cd</code></a> fix(complete): Two-pass quote fish env-completer</li> <li><a href="https://githu

- **Issue #1563** (2026-05-01): **Bump the all-dependencies group with 9 updates**
  *Symptoms*: Bumps the all-dependencies group with 9 updates:  | Package | From | To | | --- | --- | --- | | [clap](https://github.com/clap-rs/clap) | `4.6.0` | `4.6.1` | | [clap_complete](https://github.com/clap-rs/clap) | `4.6.0` | `4.6.3` | | [libflate](https://github.com/sile/libflate) | `2.2.1` | `2.3.0` | | [nanoid](https://github.com/mrdimidium/nanoid) | `0.4.0` | `0.5.0` | | [rustls](https://github.com/rustls/rustls) | `0.23.37` | `0.23.40` | | [tokio](https://github.com/tokio-rs/tokio) | `1.51.1` | `1.52.1` | | [zip](https://github.com/zip-rs/zip2) | `8.5.1` | `8.6.0` | | [assert_cmd](https://github.com/assert-rs/assert_cmd) | `2.2.0` | `2.2.1` | | [reqwest](https://github.com/seanmonstar/reqwest) | `0.13.2` | `0.13.3` |  Updates `clap` from 4.6.0 to 4.6.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/clap-rs/clap/releases">clap's releases</a>.</em></p> <blockquote> <h2>v4.6.1</h2> <h2>[4.6.1] - 2026-04-15</h2> <h3>Fixes</h3> <ul> <li><em>(derive)</em> Ensure rebuilds happen when an read env variable is changed</li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/clap-rs/clap/blob/master/CHANGELOG.md">clap's changelog</a>.</em></p> <blockquote> <h2>[4.6.1] - 2026-04-15</h2> <h3>Fixes</h3> <ul> <li><em>(derive)</em> Ensure rebuilds happen when an read env variable is changed</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="htt

- **Issue #1562** (2026-05-02): **Use current datetime instead of "crypto.randomUUID()" in non-HTTPS env**
  *Symptoms*: Hi.  The reason:  > Secure context: This feature is available only in secure contexts > (HTTPS), in some or all supporting browsers. > > *from: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID*  The environment:  - Windows 11 (Version 10.0.22631.4317) - Microsoft Edge Version 147.0.3912.72 (Official build) (64-bit)  The command:  ```bash $ ./miniserve-0.35.0-x86_64-pc-windows-msvc.exe \   --interfaces '192.168.1.2' \   --interfaces '127.0.0.1' \   --pastebin \   --upload-files '.' \   --verbose \   '.'  ```  The console when I was using pastebin in `http://192.168.1.2/`:  ``` 00:00:00.000 ?sort=date&order=desc:412 Uncaught TypeError: crypto.randomUUID is not a function     at ?sort=date&order=desc:412:59     at HTMLFormElement.<anonymous> (?sort=date&order=desc:424:31)  ```  Then no file was uploaded until I specified a name.  The error did not appear when I was in `http://127.0.0.1/`.  
  **Post-Mortem & Fix Analysis**:
  > Thanks, merged as 4bc9702.

- **Issue #1561** (2026-04-27): **Fix missing UTF-8 charset on text file responses**
  *Symptoms*: Fixes #1500.  `actix-files` is currently only appending `charset=utf-8` to some text responses, so UTF-8 `.js` and `.md` files are still served without a charset while `.txt` already gets one.  This adds a small response middleware on the file-serving scope that appends `charset=utf-8` to `text/*` responses that don't already declare a charset.  Validation: - cargo test served_text_files_include_utf8_charset --test encoding -- --nocapture - cargo test --test serve_request - cargo fmt --check 
  **Post-Mortem & Fix Analysis**:
  > Is there an upstream bug report for this? I don't really want to fix this downstream if I don't have to.
  > > Is there an upstream bug report for this? ...  Didn't find it.  <br>  > `actix-files` is currently only appending `charset=utf-8` to some text responses ...  We have the `.prefer_utf8(true)` call:  https://github.com/svenstaro/miniserve/blob/eee8e19f39a92d6151d5dd5745e350aa36d565c3/src/main.rs#L411-L434  `pub fn prefer_utf8(mut self, value: bool)`: [actix-files/src/named.rs#L397-L404](https://github.com/actix/actix-web/blob/86eeea7f92cb14250a4529bb1938c1bfa26c0f27/actix-files/src/named.rs#L397-L404)  `pub fn into_response(self, req: &HttpRequest)` calls `equiv_utf8_text(...)`: [actix-files/src/named.rs#L477-L481](https://github.com/actix/actix-web/blob/86eeea7f92cb14250a4529bb1938c1bfa26c0f27/actix-files/src/named.rs#L477-L481)  Then, `pub(crate) fn equiv_utf8_text(ct: Mime)` only cares about part of MIME types: [actix-files/src/encoding.rs#L3-L40](https://github.com/actix/actix-web/blob/86eeea7f92cb14250a4529bb1938c1bfa26c0f27/actix-files/src/encoding.rs#L3-L40)  <
  > Closing this because the maintainer indicated they do not want to carry this as a downstream fix without an upstream bug report, and I do not have a confirmed upstream issue to anchor it.

- **Issue #1559** (2026-04-10): **Fix typo writen->written**
  *Symptoms*: 

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

### Incident Patch 1: `4193cede` (2026-08-01)
**Commit Message**: Fix lints

**File**: `src/file_op.rs` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ async fn handle_multipart(
         )),
         Ok(metadata) if !metadata.is_dir() => Err(RuntimeError::InvalidPathError(format!(
             "cannot upload file to {}, since it's not a directory",
-            &path.display()
+            path.display()
         ))),
         Ok(_) => Ok(()),
     }?;
```

**File**: `src/listing.rs` (modified, +3/-3)
```diff
@@ -217,7 +217,7 @@ pub fn directory_listing(
         let decoded = percent_decode_str(&encoded_dir).decode_utf8_lossy();
 
         let mut res: Vec<Breadcrumb> = Vec::new();
-        let mut link_accumulator = format!("{}/", &conf.route_prefix);
+        let mut link_accumulator = format!("{}/", conf.route_prefix);
         let mut components = Path::new(&*decoded).components().peekable();
 
         while let Some(c) = components.next() {
@@ -343,7 +343,7 @@ pub fn directory_listing(
 
                                 markdown_to_html(&std::fs::read_to_string(entry.path())?, &options)
                             } else {
-                                format!("<pre>{}</pre>", &std::fs::read_to_string(entry.path())?)
+                                format!("<pre>{}</pre>", std::fs::read_to_string(entry.path())?)
                             },
                         ));
                     }
@@ -406,7 +406,7 @@ pub fn directory_listing(
         log::info!(
             "Creating an archive ({extension}) of {path}...",
             extension = archive_method.extension(),
-            path = &dir.path.display().to_string()
+            path = dir.path.display()
         );
 
         let file_name = format!(
```

**File**: `src/renderer.rs` (modified, +4/-4)
```diff
@@ -45,8 +45,8 @@ pub fn page(
         return raw(entries, search, is_root, conf);
     }
 
-    let upload_route = format!("{}/upload", &conf.route_prefix);
-    let rm_route = format!("{}/rm", &conf.route_prefix);
+    let upload_route = format!("{}/upload", conf.route_prefix);
+    let rm_route = format!("{}/rm", conf.route_prefix);
 
     let upload_action = build_upload_action(&upload_route, encoded_dir, sort_method, sort_order);
     let mkdir_action = build_mkdir_action(&upload_route, encoded_dir);
@@ -387,10 +387,10 @@ fn build_upload_action(
 ) -> String {
     let mut upload_action = format!("{upload_route}?path={encoded_dir}");
     if let Some(sorting_method) = sort_method {
-        upload_action = format!("{}&sort={}", upload_action, &sorting_method);
+        upload_action = format!("{}&sort={}", upload_action, sorting_method);
     }
     if let Some(sorting_order) = sort_order {
-        upload_action = format!("{}&order={}", upload_action, &sorting_order);
+        upload_action = format!("{}&order={}", upload_action, sorting_order);
     }
 
     upload_action
```

---

### Incident Patch 2: `4bc97021` (2026-05-02)
**Commit Message**: Merge branch 'fix/crypto-uuid-not-found-in-non-https'

**File**: `src/renderer.rs` (modified, +7/-1)
```diff
@@ -1184,7 +1184,13 @@ fn page_header(
                                 const title = ((inputValue) => {
                                     const title = inputValue.trim();
                                     if (title.length === 0) {
-                                        const suffix = crypto.randomUUID().substring(0,6);
+                                        let suffix;
+                                        if (crypto.randomUUID !== undefined) {
+                                            suffix = crypto.randomUUID().substring(0,6);
+                                        } else {
+                                            // neither HTTPS nor "localhost"
+                                            suffix = Date.now().toString(16).slice(-6);
+                                        }
                                         return `paste-${suffix}.txt`;
                                     } else {
                                         // use given extension if one is present, otherwise make it
```

---

### Incident Patch 3: `7184849b` (2026-04-09)
**Commit Message**: Fix typo writen->written

**File**: `src/file_op.rs` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ async fn save_file(
         match err.kind() {
             ErrorKind::CrossesDevices => {
                 warn!(
-                    "File writen to {temp_path:?} must be copied to {file_path:?} because it's on a different filesystem"
+                    "File written to {temp_path:?} must be copied to {file_path:?} because it's on a different filesystem"
                 );
                 let copy_result = tokio::fs::copy(&temp_path, &file_path).await;
                 if let Err(e) = tokio::fs::remove_file(&temp_path).await {
```

---

### Incident Patch 4: `96d69098` (2026-04-07)
**Commit Message**: test: fix request_client usage

**File**: `tests/serve_request.rs` (modified, +3/-1)
```diff
@@ -73,7 +73,9 @@ fn serves_requests_with_search_query(
     #[case] result: &'static [&'static str],
     reqwest_client: Client,
 ) -> Result<(), Error> {
-    let body = reqwest_client(format!("{}/?search={}", server.url(), search))?
+    let body = reqwest_client
+        .get(format!("{}/?search={}", server.url(), search))
+        .send()?
         .error_for_status()?;
     let parsed = Document::from_read(body)?;
     let items: Vec<_> = parsed
```

---

### Incident Patch 5: `9fecbe7c` (2026-04-07)
**Commit Message**: test: use reqwest_client fixture

Co-authored-by: Sven-Hendrik Haase <sven@svenstaro.org>

**File**: `tests/serve_request.rs` (modified, +2/-1)
```diff
@@ -71,8 +71,9 @@ fn serves_requests_with_search_query(
     #[case] server: TestServer,
     #[case] search: &'static str,
     #[case] result: &'static [&'static str],
+    reqwest_client: Client,
 ) -> Result<(), Error> {
-    let body = reqwest::blocking::get(format!("{}/?search={}", server.url(), search))?
+    let body = reqwest_client(format!("{}/?search={}", server.url(), search))?
         .error_for_status()?;
     let parsed = Document::from_read(body)?;
     let items: Vec<_> = parsed
```

---

### Incident Patch 6: `ee761c1f` (2026-02-16)
**Commit Message**: Fix lints

**File**: `tests/paste.rs` (modified, +3/-6)
```diff
@@ -1,9 +1,6 @@
 use reqwest::blocking::Client;
 use rstest::rstest;
-use select::{
-    document::Document,
-    predicate::{Attr, Text},
-};
+use select::{document::Document, predicate::Attr};
 
 mod fixtures;
 
@@ -18,9 +15,9 @@ use crate::fixtures::{Error, TestServer, reqwest_client, server};
 #[case::without_flag(&["--upload-files"], false)]
 #[case::with_flag(&["--upload-files", "--pastebin"], true)]
 fn paste_entry_only_appears_with_flag(
-    #[case] flags: &[&str],
+    #[case] _flags: &[&str],
     #[case] should_exist: bool,
-    #[with(flags)] server: TestServer,
+    #[with(_flags)] server: TestServer,
     reqwest_client: Client,
 ) -> Result<(), Error> {
     let body = reqwest_client
```

---

### Incident Patch 7: `e0680249` (2026-02-16)
**Commit Message**: Merge pull request #1534 from pzhlkj6612/fix/archive-zip-windows-path-backslashes

Use forward slashes in ZIP files; rewrite archive tests; refine error msg

**File**: `src/archive.rs` (modified, +37/-13)
```diff
@@ -155,7 +155,7 @@ where
         .map_err(|e| {
             RuntimeError::IoError(
                 format!(
-                    "Failed to append the content of {} to the TAR archive",
+                    "Failed to append the content of '{}' to the TAR archive",
                     src_dir.to_str().unwrap_or("file")
                 ),
                 e,
@@ -234,39 +234,63 @@ where
                     )
                 })?
                 .path();
-            let entry_metadata = std::fs::metadata(entry_path.clone())
-                .map_err(|e| RuntimeError::IoError("Could not get file metadata".to_string(), e))?;
+            let entry_metadata = std::fs::metadata(entry_path.clone()).map_err(|e| {
+                RuntimeError::IoError(
+                    format!(
+                        "Could not get file metadata of '{}'",
+                        entry_path.to_string_lossy()
+                    )
+                    .to_string(),
+                    e,
+                )
+            })?;
 
             if entry_metadata.file_type().is_symlink() && skip_symlinks {
                 continue;
             }
             let current_entry_name = entry_path.file_name().ok_or_else(|| {
                 RuntimeError::InvalidPathError("Invalid file or directory name".to_string())
             })?;
+
+            // To let every software correctly parse the file structure in ZIP files that are produced
+            // on any platform (esp. Windows), always use forward slashes. The documentation:
+            // https://users.cs.jmu.edu/buchhofp/forensics/formats/pkzip.html
+            let relative_path = if cfg!(windows) {
+                let branch = zip_directory
+                    .as_os_str()
+                    .to_string_lossy()
+                    .trim_end_matches(r"\") // every branch ends with two backslashes "\\".
+                    .replace(r"\", "/"); // every branch uses backslash "\" as path separators.
+                let leaf = current_entry_name.to_string_lossy();
+                format!("{branch}/{leaf}") // construct a Unix-style path in the simplest way.
+            } else {
+                zip_directory
+                    .join(current_entry_name)
+                    .into_os_string()
+                    .to_string_lossy()
+                    .into_owned()
+            };
+
             if entry_metadata.is_file() {
                 let mut f = File::open(&entry_path)
                     .map_err(|e| RuntimeError::IoError("Could not open file".to_string(), e))?;
                 f.read_to_end(&mut buffer).map_err(|e| {
                     RuntimeError::IoError("Could not read from file".to_string(), e)
                 })?;
-                let relative_path = zip_directory.join(current_entry_name).into_os_string();
-                zip_writer
-                    .start_file(relative_path.to_string_lossy(), options)
-                    .map_err(|_| {
-                        RuntimeError::ArchiveCreationDetailError(
-                            "Could not add file path to ZIP".to_string(),
-                        )
-                    })?;
+                zip_writer.start_file(relative_path, options).map_err(|_| {
+                    RuntimeError::ArchiveCreationDetailError(
+                        "Could not add file path to ZIP".to_string(),
+                    )
+                })?;
                 zip_writer.write(buffer.as_ref()).map_err(|_| {
                     RuntimeError::ArchiveCreationDetailError(
                         "Could not write file to ZIP".to_string(),
                     )
                 })?;
                 buffer.clear();
             } else if entry_metadata.is_dir() {
-                let relative_path = zip_directory.join(current_entry_name).into_os_string();
                 zip_writer
-                    .add_directory(relative_path.to_string_lossy(), options)
+                    .add_directory(relative_path, options)
  
```

**File**: `tests/archive.rs` (modified, +235/-97)
```diff
@@ -1,129 +1,267 @@
+use std::io::Cursor;
+
 use reqwest::{StatusCode, blocking::Client};
 use rstest::rstest;
 use select::{document::Document, predicate::Text};
+use zip::ZipArchive;
 
 mod fixtures;
 
 use crate::fixtures::{Error, TestServer, reqwest_client, server};
 
+enum ArchiveKind {
+    TarGz,
+    Tar,
+    Zip,
+}
+
+impl ArchiveKind {
+    fn server_option(&self) -> &'static str {
+        match self {
+            ArchiveKind::TarGz => "--enable-tar-gz",
+            ArchiveKind::Tar => "--enable-tar",
+            ArchiveKind::Zip => "--enable-zip",
+        }
+    }
+
+    fn link_text(&self) -> &'static str {
+        match self {
+            ArchiveKind::TarGz => "Download .tar.gz",
+            ArchiveKind::Tar => "Download .tar",
+            ArchiveKind::Zip => "Download .zip",
+        }
+    }
+
+    fn download_param(&self) -> &'static str {
+        match self {
+            ArchiveKind::TarGz => "?download=tar_gz",
+            ArchiveKind::Tar => "?download=tar",
+            ArchiveKind::Zip => "?download=zip",
+        }
+    }
+}
+
+fn fetch_index_document(
+    reqwest_client: &Client,
+    server: &TestServer,
+    expected: StatusCode,
+) -> Result<Document, Error> {
+    let resp = reqwest_client.get(server.url()).send()?;
+    assert_eq!(resp.status(), expected);
+
+    Ok(Document::from_read(resp)?)
+}
+
+fn download_archive_bytes(
+    reqwest_client: &Client,
+    server: &TestServer,
+    kind: ArchiveKind,
+) -> Result<(StatusCode, usize), Error> {
+    let resp = reqwest_client
+        .get(server.url().join(kind.download_param())?)
+        .send()?;
+
+    Ok((resp.status(), resp.bytes()?.len()))
+}
+
+fn assert_link_presence(document: &Document, present: &[&str], absent: &[&str]) {
+    let contains_text =
+        |document: &Document, text: &str| document.find(Text).any(|x| x.text() == text);
+
+    for text in present {
+        assert!(
+            contains_text(document, text),
+            "Expected link text '{text}' to be present",
+        );
+    }
+
+    for text in absent {
+        assert!(
+            !contains_text(document, text),
+            "Expected link text '{text}' to be absent",
+        );
+    }
+}
+
+/// By default, all archive links are hidden.
 #[rstest]
-fn archives_are_disabled(server: TestServer, reqwest_client: Client) -> Result<(), Error> {
-    // Ensure the links to the archives are not present
-    let body = reqwest_client
-        .get(server.url())
-        .send()?
-        .error_for_status()?;
-    let parsed = Document::from_read(body)?;
-    assert!(
-        parsed
-            .find(Text)
-            .all(|x| x.text() != "Download .tar.gz" && x.text() != "Download .tar")
+fn archives_are_disabled_links(server: TestServer, reqwest_client: Client) -> Result<(), Error> {
+    let document = fetch_index_document(&reqwest_client, &server, StatusCode::OK)?;
+    assert_link_presence(
+        &document,
+        &[],
+        &[
+            ArchiveKind::TarGz.link_text(),
+            ArchiveKind::Tar.link_text(),
+            ArchiveKind::Zip.link_text(),
+        ],
     );
 
-    // Try to download anyway, ensure it's forbidden
-    assert_eq!(
-        reqwest_client
-            .get(server.url().join("?download=tar_gz")?)
-            .send()?
-            .status(),
-        StatusCode::FORBIDDEN
-    );
-    assert_eq!(
-        reqwest_client
-            .get(server.url().join("?download=tar")?)
-            .send()?
-            .status(),
-        StatusCode::FORBIDDEN
-    );
-    assert_eq!(
-        reqwest_client
-            .get(server.url().join("?download=zip")?)
-            .send()?
-            .status(),
-        StatusCode::FORBIDDEN
-    );
+    Ok(())
+}
+
+/// By default, downloading archives is forbidden.
+#[rstest]
+#[case(ArchiveKind::TarGz)]
+#[case(ArchiveKind::Tar)]
+#[case(ArchiveKind::Zip)]
+fn archives_are_disabled_downloads(
+    #[case] kind: ArchiveKind,
+    server: TestServer,
+    reqwest_client
```

---

### Incident Patch 8: `1fe61674` (2026-02-16)
**Commit Message**: Fix wrong comments about slashes

oops

Co-authored-by: Sven-Hendrik Haase <svenstaro@gmail.com>

**File**: `src/archive.rs` (modified, +1/-1)
```diff
@@ -253,7 +253,7 @@ where
             })?;
 
             // To let every software correctly parse the file structure in ZIP files that are produced
-            // on any platform (esp. Windows), always use backslashes. The documentation:
+            // on any platform (esp. Windows), always use forward slashes. The documentation:
             // https://users.cs.jmu.edu/buchhofp/forensics/formats/pkzip.html
             let relative_path = if cfg!(windows) {
                 let branch = zip_directory
```

---

### Incident Patch 9: `a06e31e7` (2026-02-11)
**Commit Message**: Revert "using forward slashes in ZIP on Windows" and a related test

Our dependency "zip" has fixed a bug about setting local platform in the ZIP since v7.2.0: https://github.com/zip-rs/zip2/commit/9e9badde0510a863b2362affc73eed32da3fbe5c, so we don't need to fix it here.

This effectively reverts the main part of commits:

- The fix: ad8d3d9a4862cb1e8b139132920273470e1cb991 (the origin) or 3b59a69bdca2b0672bf5c55a935cfa928aec4dce (the re-applied one)
- The test: 90c523425e092c7137c5450c8276167954e64ff4

**File**: `src/archive.rs` (modified, +9/-26)
```diff
@@ -251,37 +251,20 @@ where
             let current_entry_name = entry_path.file_name().ok_or_else(|| {
                 RuntimeError::InvalidPathError("Invalid file or directory name".to_string())
             })?;
-
-            // Workaround for Windows path in ZIP files:
-            // Always use forward slashes for all paths to avoid literal backslashes in saved entry path.
-            // TODO: remove this when the "zip" cargo has the ability to process a directory as a whole.
-            let relative_path = if cfg!(windows) {
-                let branch = zip_directory
-                    .as_os_str()
-                    .to_string_lossy()
-                    .trim_end_matches(r"\") // every branch ends with two backslashes "\\".
-                    .replace(r"\", "/"); // every branch uses backslash "\" as path separators.
-                let leaf = current_entry_name.to_string_lossy();
-                format!("{branch}/{leaf}") // construct a Unix-style path in the simplest way.
-            } else {
-                zip_directory
-                    .join(current_entry_name)
-                    .into_os_string()
-                    .to_string_lossy()
-                    .into_owned()
-            };
-
+            let relative_path = zip_directory.join(current_entry_name).into_os_string();
             if entry_metadata.is_file() {
                 let mut f = File::open(&entry_path)
                     .map_err(|e| RuntimeError::IoError("Could not open file".to_string(), e))?;
                 f.read_to_end(&mut buffer).map_err(|e| {
                     RuntimeError::IoError("Could not read from file".to_string(), e)
                 })?;
-                zip_writer.start_file(relative_path, options).map_err(|_| {
-                    RuntimeError::ArchiveCreationDetailError(
-                        "Could not add file path to ZIP".to_string(),
-                    )
-                })?;
+                zip_writer
+                    .start_file(relative_path.to_string_lossy(), options)
+                    .map_err(|_| {
+                        RuntimeError::ArchiveCreationDetailError(
+                            "Could not add file path to ZIP".to_string(),
+                        )
+                    })?;
                 zip_writer.write(buffer.as_ref()).map_err(|_| {
                     RuntimeError::ArchiveCreationDetailError(
                         "Could not write file to ZIP".to_string(),
@@ -290,7 +273,7 @@ where
                 buffer.clear();
             } else if entry_metadata.is_dir() {
                 zip_writer
-                    .add_directory(relative_path, options)
+                    .add_directory(relative_path.to_string_lossy(), options)
                     .map_err(|_| {
                         RuntimeError::ArchiveCreationDetailError(
                             "Could not add directory path to ZIP".to_string(),
```

**File**: `tests/archive.rs` (modified, +0/-32)
```diff
@@ -1,9 +1,6 @@
-use std::io::Cursor;
-
 use reqwest::{StatusCode, blocking::Client};
 use rstest::rstest;
 use select::{document::Document, predicate::Text};
-use zip::ZipArchive;
 
 mod fixtures;
 
@@ -236,32 +233,3 @@ fn archive_behave_differently_with_broken_symlinks(
 
     Ok(())
 }
-
-/// ZIP archives store entry names using unix-style paths (no backslashes).
-/// The "someDir" dir is constructed by [`fixtures`] and all items in it can be correctly processed.
-#[rstest]
-fn zip_archives_store_entry_name_in_unix_style(
-    #[with(&["--enable-zip"])] server: TestServer,
-    reqwest_client: Client,
-) -> Result<(), Error> {
-    let resp = reqwest_client
-        .get(server.url().join("someDir/?download=zip")?)
-        .send()?
-        .error_for_status()?;
-
-    assert_eq!(resp.status(), StatusCode::OK);
-
-    let mut archive = ZipArchive::new(Cursor::new(resp.bytes()?))?;
-    for i in 0..archive.len() {
-        let entry = archive.by_index(i)?;
-        let name = entry.name();
-
-        assert!(
-            !name.contains(r"\"),
-            "ZIP entry '{}' contains a backslash",
-            name
-        );
-    }
-
-    Ok(())
-}
```

---

### Incident Patch 10: `2e760919` (2026-02-09)
**Commit Message**: Fix clippy lint

**File**: `src/main.rs` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ use bytesize::ByteSize;
 use clap::{CommandFactory, Parser, crate_version};
 use colored::*;
 use dav_server::{
-    DavConfig, DavHandler, DavMethodSet,
+    DavHandler, DavMethodSet,
     actix::{DavRequest, DavResponse},
 };
 use fast_qr::QRBuilder;
```

#### Recent Merged Pull Requests:
- **PR #1581** (closed): Bump the all-dependencies group with 10 updates (@dependabot[bot])
- **PR #1574** (closed): Bump the all-dependencies group across 1 directory with 14 updates (@dependabot[bot])
- **PR #1571** (2026-07-01): Bump the all-dependencies group with 10 updates (@dependabot[bot])
- **PR #1567** (2026-06-01): Bump the all-dependencies group with 8 updates (@dependabot[bot])
- **PR #1563** (2026-05-01): Bump the all-dependencies group with 9 updates (@dependabot[bot])
- **PR #1562** (2026-05-02): Use current datetime instead of "crypto.randomUUID()" in non-HTTPS env (@pzhlkj6612)
- **PR #1561** (closed): Fix missing UTF-8 charset on text file responses (@lawrence3699)
- **PR #1559** (2026-04-10): Fix typo writen->written (@sermuns)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
