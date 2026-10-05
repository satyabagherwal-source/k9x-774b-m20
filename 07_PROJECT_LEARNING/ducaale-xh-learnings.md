# Forensic Learning Record (Deep Inspection): ducaale/xh

> **Canonical Artifact**: `07_PROJECT_LEARNING/ducaale-xh-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ducaale/xh](https://github.com/ducaale/xh))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:27:24.992Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ducaale/xh`
- **Description**: Friendly and fast tool for sending HTTP requests
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 8115 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils.rs`
```
use std::borrow::Cow;
use std::env::var_os;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::str::Utf8Error;

use anyhow::Result;
use reqwest::blocking::{Request, Response};
use reqwest::header::HeaderValue;
use url::Url;

pub fn unescape(text: &str, special_chars: &'static str) -> String {
    let mut out = String::new();
    let mut chars = text.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some(next) if special_chars.contains(next) => {
                    // Escape this character
                    out.push(next);
                }
                Some(next) => {
                    // Do not escape this character, treat backslash
                    // as ordinary character
                    out.push(ch);
                    out.push(next);
                }
                None => {
                    out.push(ch);
                }
            }
        } else {
            out.push(ch);
        }
    }
    out
}

pub fn clone_request(request: &mut Request) -> Result<Request> {
    if let Some(b) = request.body_mut().as_mut() {
        b.buffer()?;
    }
    // This doesn't copy the contents of the buffer, cloning requests is cheap
    // https://docs.rs/bytes/1.0.1/bytes/struct.Bytes.html
    Ok(request.try_clone().unwrap()) // guaranteed to not fail if body is already buffered
}

/// Whether to make some things more deterministic for the benefit of tests
pub fn test_mode() -> bool {
    // In integration tests the binary isn't compiled with cfg(test), so we
    // use an environment variable.
    // This isn't called very often currently but we could cache it using an
    // atomic integer.
    cfg!(test) || var_os("XH_TEST_MODE").is_some()
}

/// Whether to behave as if stdin and stdout are terminals
pub fn test_pretend_term() -> bool {
    var_os("XH_TEST_MODE_TERM").is_some()
}

pub fn test_default_color() -> bool {
    var_os("XH_TEST_MODE_COLOR").is_some()
}

#[cfg(test)]
pub fn random_string() -> String {
    use rand::Rng;

    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(10)
        .map(char::from)
        .collect()
}

pub fn config_dir() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("XH_CONFIG_DIR") {
        return Some(dir.into());
    }

    if cfg!(target_os = "macos") {
        // On macOS dirs returns `~/Library/Application Support`.
        // ~/.config is more usual so we switched to that. But first we check for
        // the legacy location.
        let legacy_config_dir = dirs::config_dir()?.join("xh");
        let config_home = match var_os("XDG_CONFIG_HOME") {
            Some(dir) => dir.into(),
            None => dirs::home_dir()?.join(".config"),
        };
        let new_config_dir = config_home.join("xh");
        if legacy_config_dir.exists() && !new_config_dir.exists() {
            Some(legacy_config_dir)
        } else {
            Some(new_config_dir)
        }
    } else {
        Some(dirs::config_dir()?.join("xh"))
    }
}

pub fn get_home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    if let Some(path) = std::env::var_os("XH_TEST_MODE_WIN_HOME_DIR") {
        return Some(PathBuf::from(path));
    }

    dirs::home_dir()
}

/// Perform simple tilde expansion if `dirs::home_dir()` is `Some(path)`.
///
/// Note that prefixed tilde e.g `~foo` is ignored.
///
/// See https://www.gnu.org/software/bash/manual/html_node/Tilde-Expansion.html
pub fn expand_tilde(path: impl AsRef<Path>) -> PathBuf {
    if let Ok(path) = path.as_ref().strip_prefix("~") {
        let mut expanded_path = PathBuf::new();
        expanded_path.push(get_home_dir().unwrap_or_else(|| "~".into()));
        expanded_path.push(path);
        expanded_path
    } else {
        path.as_ref().into()
    }
}

pub fn url_with_query(mut url: Url, query: &[(&str, Cow<str>)]) -> Url {
    if !query.is_empty() {
        // If we run this even without adding pairs it adds a `?`, hence
        // the .is_empty() check
        let mut pairs = url.query_pairs_mut();
        for (name, value) in query {
            pairs.append_pair(name, value);
        }
    }
    url
}

// https://stackoverflow.com/a/45145246/5915221
#[macro_export]
macro_rules! vec_of_strings {
    ($($str:expr),*) => ({
        vec![$(String::from($str),)*] as Vec<String>
    });
}

/// When downloading a large file from a local nginx, it seems that 128KiB
/// is a bit faster than 64KiB but bumping it up to 256KiB doesn't help any
/// more.
/// When increasing the buffer size all the way to 1MiB I observe 408KiB as
/// the largest read size. But this doesn't translate to a shorter runtime.
pub const BUFFER_SIZE: usize = 128 * 1024;

/// io::copy, but with a larger buffer size.
///
/// io::copy's buffer is just 8 KiB. This noticeably slows down fast
/// large downloads, especially with a progress bar.
///
/// If `flush` is true, the writer will be flushed after each write. This is
/// appropriate for streaming output, where you don't want a delay between data
/// arriving and being shown.
pub fn copy_largebuf(
    reader: &mut impl io::Read,
    writer: &mut impl Write,
    flush: bool,
) -> io::Result<()> {
    let mut buf = vec![0; BUFFER_SIZE];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => return Ok(()),
            Ok(len) => {
                writer.write_all(&buf[..len])?;
                if flush {
                    writer.flush()?;
                }
            }
            Err(ref e) if e.kind() == io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        }
    }
}

pub(crate) trait HeaderValueExt {
    fn to_utf8_str(&self) -> Result<&str, Utf8Error>;

    fn to_ascii_or_latin1(&self) -> Result<&str, BadHeaderValue<'_>>;
}

impl HeaderValueExt for HeaderValue {
    fn to_utf8_str(&self) -> Result<&str, Utf8Error> {
        std::str::from_utf8(self.as_bytes())
    }

    /// If the value is pure ASCII, return Ok(). If not, return Err() with methods for
    /// further handling.
    ///
    /// The Ok() version cannot contain control characters (not even ASCII ones).
    fn to_ascii_or_latin1(&self) -> Result<&str, BadHeaderValue<'_>> {
        self.to_str().map_err(|_| BadHeaderValue { value: self })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct BadHeaderValue<'a> {
    value: &'a HeaderValue,
}

impl<'a> BadHeaderValue<'a> {
    /// Return the header value's latin1 decoding, AKA isomorphic decode,
    /// AKA ISO-8859-1 decode. This is how browsers tend to handle it.
    ///
    /// Not to be confused with ISO 8859-1 (which leaves 0x8X and 0x9X unmapped)
    /// or with Windows-1252 (which is how HTTP bodies are decoded if they
    /// declare `Content-Encoding: iso-8859-1`).
    ///
    /// Is likely to contain control characters. Consider replacing these.
    pub(crate) fn latin1(self) -> String {
        // https://infra.spec.whatwg.org/#isomorphic-decode
        self.value.as_bytes().iter().map(|&b| b as char).collect()
    }

    /// Return the header value's UTF-8 decoding. This is most likely what the
    /// user expects, but when browsers prefer another encoding we should give
    /// that one precedence.
    pub(crate) fn utf8(self) -> Option<&'a str> {
        self.value.to_utf8_str().ok()
    }
}

pub(crate) fn reason_phrase(response: &Response) -> Cow<'_, str> {
    if let Some(reason) = response.extensions().get::<hyper::ext::ReasonPhrase>() {
        // The server sent a non-standard reason phrase.
        // Seems like some browsers interpret this as latin1 and others as UTF-8?
        // Rare case and clients aren't supposed to pay attention to the reason
        // phrase so let's just do UTF-8 for convenience.
        // We could send the bytes straight to stdout/stderr in case they're some
        // other encoding but that's probably not worth the effort.
        String::from_utf8_lossy(reason.as_bytes())
    } else if let Some(reason) = response.status().canonical_reason() {
        // On HTTP/2+ no reason phrase is sent so we're just explaining the code
        // to the user.
        // On HTTP/1.1 and below this matches the reason the server actually sent
        // or else hyper would have added a ReasonPhrase.
        Cow::Borrowed(reason)
    } else {
        // Only reachable in case of an unknown status code over HTTP/2+.
        // curl prints nothing in this case.
        Cow::Borrowed("<unknown status code>")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_latin1() {
        let good = HeaderValue::from_static("Rhodes");
        let good = good.to_ascii_or_latin1();

        assert_eq!(good, Ok("Rhodes"));

        let bad = HeaderValue::from_bytes("Ῥόδος".as_bytes()).unwrap();
        let bad = bad.to_ascii_or_latin1().unwrap_err();

        assert_eq!(bad.latin1(), "á¿¬Ï\u{8c}Î´Î¿Ï\u{82}");
        assert_eq!(bad.utf8(), Some("Ῥόδος"));

        let worse = HeaderValue::from_bytes(b"R\xF3dos").unwrap();
        let worse = worse.to_ascii_or_latin1().unwrap_err();

        assert_eq!(worse.latin1(), "Ródos");
        assert_eq!(worse.utf8(), None);
    }
}

```

### Core Architecture Module: `src/auth.rs`
```
use std::io;

use anyhow::Result;
use regex_lite::Regex;
use reqwest::StatusCode;
use reqwest::blocking::{Request, Response};
use reqwest::header::{AUTHORIZATION, HeaderValue, WWW_AUTHENTICATE};

use crate::cli::AuthType;
use crate::middleware::{Context, Middleware};
use crate::netrc;
use crate::utils::clone_request;

#[derive(Debug, PartialEq, Eq)]
pub enum Auth {
    Bearer(String),
    Basic(String, Option<String>),
    Digest(String, String),
}

impl Auth {
    pub fn from_str(auth: &str, auth_type: AuthType, host: &str) -> Result<Auth> {
        match auth_type {
            AuthType::Basic => {
                let (username, password) = parse_auth(auth, host)?;
                Ok(Auth::Basic(username, password))
            }
            AuthType::Digest => {
                let (username, password) = parse_auth(auth, host)?;
                Ok(Auth::Digest(
                    username,
                    password.unwrap_or_else(|| "".into()),
                ))
            }
            AuthType::Bearer => Ok(Auth::Bearer(auth.into())),
        }
    }

    pub fn from_netrc(auth_type: AuthType, entry: netrc::Entry) -> Option<Auth> {
        match auth_type {
            AuthType::Basic => Some(Auth::Basic(entry.login?, Some(entry.password))),
            AuthType::Bearer => Some(Auth::Bearer(entry.password)),
            AuthType::Digest => Some(Auth::Digest(entry.login?, entry.password)),
        }
    }
}

pub fn parse_auth(auth: &str, host: &str) -> io::Result<(String, Option<String>)> {
    if let Some(cap) = Regex::new(r"^([^:]*):$").unwrap().captures(auth) {
        Ok((cap[1].to_string(), None))
    } else if let Some(cap) = Regex::new(r"^(.*?):(.+)$").unwrap().captures(auth) {
        let username = cap[1].to_string();
        let password = cap[2].to_string();
        Ok((username, Some(password)))
    } else {
        let username = auth.to_string();
        let prompt = format!("http: password for {username}@{host}: ");
        let password = rpassword::prompt_password(prompt)?;
        Ok((username, Some(password)))
    }
}

pub struct DigestAuthMiddleware<'a> {
    username: &'a str,
    password: &'a str,
}

impl<'a> DigestAuthMiddleware<'a> {
    pub fn new(username: &'a str, password: &'a str) -> Self {
        DigestAuthMiddleware { username, password }
    }
}

impl Middleware for DigestAuthMiddleware<'_> {
    fn handle(&mut self, mut ctx: Context, mut request: Request) -> Result<Response> {
        let mut response = self.next(&mut ctx, clone_request(&mut request)?)?;
        match response.headers().get(WWW_AUTHENTICATE) {
            Some(wwwauth) if response.status() == StatusCode::UNAUTHORIZED => {
                let mut context = digest_auth::AuthContext::new(
                    self.username,
                    self.password,
                    request.url().path(),
                );
                if let Some(cnonc) = std::env::var_os("XH_TEST_DIGEST_AUTH_CNONCE") {
                    context.set_custom_cnonce(cnonc.to_string_lossy().to_string());
                }
                let mut prompt = digest_auth::parse(wwwauth.to_str()?)?;
                let answer = prompt.respond(&context)?.to_header_string();
                request
                    .headers_mut()
                    .insert(AUTHORIZATION, HeaderValue::from_str(&answer)?);
                self.print(&mut ctx, &mut response, &mut request)?;
                Ok(self.next(&mut ctx, request)?)
            }
            _ => Ok(response),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parsing() {
        let expected = vec![
            ("user:", ("user", None)),
            ("user:password", ("user", Some("password"))),
            ("user:pass:with:colons", ("user", Some("pass:with:colons"))),
            (":", ("", None)),
            (":password", ("", Some("password"))),
            (":pass:with:colons", ("", Some("pass:with:colons"))),
        ];
        for (input, output) in expected {
            let (user, pass) = parse_auth(input, "").unwrap();
            assert_eq!(output, (user.as_str(), pass.as_deref()));
        }
    }
}

```

### Core Architecture Module: `src/buffer.rs`
```
//! The [`Buffer`] type is responsible for writing the program output, be it
//! to a terminal or a pipe or a file. It supports colored output using
//! `termcolor`'s `WriteColor` trait.
//!
//! It's always buffered, so `.flush()` should be called whenever no new
//! output is immediately available. That's inconvenient, but improves
//! throughput.
//!
//! We want slightly different implementations depending on the platform and
//! the runtime conditions. Ansi<BufWriter> is fast, so we go through that
//! when possible, but on Windows we often need a BufferedStandardStream
//! instead to use the terminal APIs.
//!
//! Most of this code is boilerplate.

use std::{
    env::var_os,
    io::{self, Write},
    path::Path,
};

use crate::{
    cli::Pretty,
    utils::{test_default_color, test_pretend_term},
};

pub use imp::Buffer;

#[cfg(not(windows))]
mod imp {
    use std::io::{BufWriter, Write};

    use termcolor::{Ansi, WriteColor};

    pub struct Buffer {
        inner: Ansi<BufWriter<Inner>>,
        terminal: bool,
        redirect: bool,
    }

    enum Inner {
        File(std::fs::File),
        Stdout(std::io::Stdout),
        Stderr(std::io::Stderr),
    }

    impl Buffer {
        pub fn stdout() -> Self {
            Self {
                inner: Ansi::new(BufWriter::new(Inner::Stdout(std::io::stdout()))),
                terminal: true,
                redirect: false,
            }
        }

        pub fn stderr() -> Self {
            Self {
                inner: Ansi::new(BufWriter::new(Inner::Stderr(std::io::stderr()))),
                terminal: true,
                redirect: false,
            }
        }

        pub fn redirect() -> Self {
            Self {
                inner: Ansi::new(BufWriter::new(Inner::Stdout(std::io::stdout()))),
                terminal: crate::test_pretend_term(),
                redirect: true,
            }
        }

        pub fn file(file: std::fs::File) -> Self {
            Self {
                inner: Ansi::new(BufWriter::new(Inner::File(file))),
                terminal: false,
                redirect: false,
            }
        }

        pub fn is_terminal(&self) -> bool {
            self.terminal
        }

        pub fn is_redirect(&self) -> bool {
            self.redirect
        }

        #[cfg(test)]
        pub fn is_stdout(&self) -> bool {
            matches!(self.inner.get_ref().get_ref(), Inner::Stdout(_))
        }

        #[cfg(test)]
        pub fn is_stderr(&self) -> bool {
            matches!(self.inner.get_ref().get_ref(), Inner::Stderr(_))
        }

        #[cfg(test)]
        pub fn is_file(&self) -> bool {
            matches!(self.inner.get_ref().get_ref(), Inner::File(_))
        }
    }

    impl Write for Inner {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            match self {
                Inner::File(w) => w.write(buf),
                Inner::Stdout(w) => w.write(buf),
                Inner::Stderr(w) => w.write(buf),
            }
        }

        fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
            match self {
                Inner::File(w) => w.write_all(buf),
                Inner::Stdout(w) => w.write_all(buf),
                Inner::Stderr(w) => w.write_all(buf),
            }
        }

        fn flush(&mut self) -> std::io::Result<()> {
            match self {
                Inner::File(w) => w.flush(),
                Inner::Stdout(w) => w.flush(),
                Inner::Stderr(w) => w.flush(),
            }
        }
    }

    impl Write for Buffer {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.inner.write(buf)
        }

        fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
            // get_mut() to directly write into the BufWriter is significantly faster
            // https://github.com/BurntSushi/termcolor/pull/56
            self.inner.get_mut().write_all(buf)
        }

        fn flush(&mut self) -> std::io::Result<()> {
            self.inner.flush()
        }
    }

    impl WriteColor for Buffer {
        fn supports_color(&self) -> bool {
            true
        }

        fn set_color(&mut self, spec: &termcolor::ColorSpec) -> std::io::Result<()> {
            self.inner.set_color(spec)
        }

        fn reset(&mut self) -> std::io::Result<()> {
            self.inner.reset()
        }
    }
}

#[cfg(windows)]
mod imp {
    use std::io::{BufWriter, Write};

    use termcolor::{Ansi, BufferedStandardStream, ColorChoice, WriteColor};

    use crate::utils::test_default_color;

    pub enum Buffer {
        // Only escape codes make sense when the output isn't going directly
        // to a terminal, so we use Ansi for some cases.
        File(Ansi<BufWriter<std::fs::File>>),
        Redirect(Ansi<BufWriter<std::io::Stdout>>),
        Stdout(BufferedStandardStream),
        Stderr(BufferedStandardStream),
    }

    impl Buffer {
        pub fn stdout() -> Self {
            Buffer::Stdout(BufferedStandardStream::stdout(if test_default_color() {
                ColorChoice::AlwaysAnsi
            } else {
                ColorChoice::Always
            }))
        }

        pub fn stderr() -> Self {
            Buffer::Stderr(BufferedStandardStream::stderr(if test_default_color() {
                ColorChoice::AlwaysAnsi
            } else {
                ColorChoice::Always
            }))
        }

        pub fn redirect() -> Self {
            Buffer::Redirect(Ansi::new(BufWriter::new(std::io::stdout())))
        }

        pub fn file(file: std::fs::File) -> Self {
            Buffer::File(Ansi::new(BufWriter::new(file)))
        }

        pub fn is_terminal(&self) -> bool {
            matches!(self, Buffer::Stdout(_) | Buffer::Stderr(_))
        }

        pub fn is_redirect(&self) -> bool {
            matches!(self, Buffer::Redirect(_))
        }

        #[cfg(test)]
        pub fn is_stdout(&self) -> bool {
            matches!(self, Buffer::Stdout(_))
        }

        #[cfg(test)]
        pub fn is_stderr(&self) -> bool {
            matches!(self, Buffer::Stderr(_))
        }

        #[cfg(test)]
        pub fn is_file(&self) -> bool {
            matches!(self, Buffer::File(_))
        }
    }

    impl Write for Buffer {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            match self {
                Buffer::File(w) => w.write(buf),
                Buffer::Redirect(w) => w.write(buf),
                Buffer::Stdout(w) | Buffer::Stderr(w) => w.write(buf),
            }
        }

        fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
            match self {
                Buffer::File(w) => w.get_mut().write_all(buf),
                Buffer::Redirect(w) => w.get_mut().write_all(buf),
                Buffer::Stdout(w) | Buffer::Stderr(w) => w.write_all(buf),
            }
        }

        fn flush(&mut self) -> std::io::Result<()> {
            match self {
                Buffer::File(w) => w.flush(),
                Buffer::Redirect(w) => w.flush(),
                Buffer::Stdout(w) | Buffer::Stderr(w) => w.flush(),
            }
        }
    }

    impl WriteColor for Buffer {
        fn supports_color(&self) -> bool {
            match self {
                Buffer::File(w) => w.supports_color(),
                Buffer::Redirect(w) => w.supports_color(),
                Buffer::Stdout(w) | Buffer::Stderr(w) => w.supports_color(),
            }
        }

        fn set_color(&mut self, spec: &termcolor::ColorSpec) -> std::io::Result<()> {
            match self {
                Buffer::File(w) => w.set_color(spec),
                Buffer::Redirect(w) => w.set_color(spec),
                Buffer::Stdout(w) | Buffer::Stderr(w) => w.set_color(spec),
            }
        }

        fn reset(&mut self) -> std::io::Result<()> {
            match self {
                Buffer::File(w) => w.reset(),
                Buffer::Redirect(w) => w.reset(),
                Buffer::Stdout(w) | Buffer::Stderr(w) => w.reset(),
            }
        }

        fn is_synchronous(&self) -> bool {
            match self {
                Buffer::File(w) => w.is_synchronous(),
                Buffer::Redirect(w) => w.is_synchronous(),
                Buffer::Stdout(w) | Buffer::Stderr(w) => w.is_synchronous(),
            }
        }
    }
}

impl Buffer {
    pub fn new(download: bool, output: Option<&Path>, is_stdout_tty: bool) -> io::Result<Self> {
        log::trace!("is_stdout_tty: {is_stdout_tty}");
        Ok(if download {
            Buffer::stderr()
        } else if let Some(output) = output {
            log::trace!("creating file {output:?}");
            let file = std::fs::File::create(output)?;
            Buffer::file(file)
        } else if is_stdout_tty {
            Buffer::stdout()
        } else {
            Buffer::redirect()
        })
    }

    pub fn print(&mut self, s: &str) -> io::Result<()> {
        self.write_all(s.as_bytes())
    }

    pub fn guess_pretty(&self) -> Pretty {
        if test_default_color() {
            Pretty::All
        } else if test_pretend_term() {
            Pretty::Format
        } else if self.is_terminal() {
            // Based on termcolor's logic for ColorChoice::Auto
            if cfg!(test) {
                Pretty::All
            } else if var_os("NO_COLOR").is_some_and(|val| !val.is_empty()) {
                Pretty::Format
            } else {
                match var_os("TERM") {
                    Some(term) if term == "dumb" => Pretty::Format,
                    Some(_) => Pretty::All,
                    None if cfg!(windows) => Pretty::All,
                    None => Pretty::Format,
                }
            }
        } else {
            Pretty::None
        }
    }
}

```

### Core Architecture Module: `src/cli.rs`
```
use std::convert::TryFrom;
use std::env;
use std::ffi::OsString;
use std::fmt;
use std::fs;
use std::io::Write;
use std::mem;
use std::net::{IpAddr, Ipv6Addr};
use std::path::PathBuf;
use std::str::FromStr;
use std::time::Duration;

use anyhow::{Context, anyhow};
use clap::builder::Styles;
use clap::builder::styling::{AnsiColor, Effects};
use clap::{self, ArgAction, FromArgMatches, ValueEnum};
use encoding_rs::Encoding;
use regex_lite::Regex;
use reqwest::{Method, Url, tls};
use serde::Deserialize;

use crate::buffer::Buffer;
use crate::redacted::SecretString;
use crate::request_items::RequestItems;
use crate::utils::config_dir;

const STYLES: Styles = Styles::styled()
    .header(AnsiColor::Blue.on_default().effects(Effects::BOLD))
    .usage(AnsiColor::Blue.on_default().effects(Effects::BOLD))
    .literal(AnsiColor::Cyan.on_default().effects(Effects::BOLD))
    .placeholder(AnsiColor::Cyan.on_default())
    .error(AnsiColor::Red.on_default().effects(Effects::BOLD))
    .valid(AnsiColor::Green.on_default())
    .invalid(AnsiColor::Yellow.on_default());

// Some doc comments were copy-pasted from HTTPie

// clap guidelines:
// - Only use `short` with an explicit arg (`short = "x"`)
// - Only use `long` with an implicit arg (just `long`)
//   - Unless it needs a different name, but then also use `name = "..."`
// - Add an uppercase value_name to options that take a value

/// xh is a friendly and fast tool for sending HTTP requests.
///
/// It reimplements as much as possible of HTTPie's excellent design, with a focus
/// on improved performance.
#[derive(clap::Parser, Debug)]
#[clap(
    version,
    long_version = long_version(),
    disable_help_flag = true,
    args_override_self = true,
    styles = STYLES,
)]
pub struct Cli {
    #[clap(skip)]
    pub httpie_compat_mode: bool,

    /// (default) Serialize data items from the command line as a JSON object.
    ///
    /// Overrides both --form and --multipart.
    #[clap(short = 'j', long, overrides_with_all = &["form", "multipart"])]
    pub json: bool,

    /// Serialize data items from the command line as form fields.
    ///
    /// Overrides both --json and --multipart.
    #[clap(short = 'f', long, overrides_with_all = &["json", "multipart"])]
    pub form: bool,

    /// Like --form, but force a multipart/form-data request even without files.
    ///
    /// Overrides both --json and --form.
    #[clap(long, conflicts_with_all = &["raw", "compress"], overrides_with_all = &["json", "form"])]
    pub multipart: bool,

    /// Pass raw request data without extra processing.
    #[clap(long, value_name = "RAW")]
    pub raw: Option<String>,

    /// Controls output processing.
    #[clap(
        long,
        value_enum,
        value_name = "STYLE",
        long_help = "\
Controls output processing. Possible values are:

    all      (default) Enable both coloring and formatting
    colors   Apply syntax highlighting to output
    format   Pretty-print json and sort headers
    none     Disable both coloring and formatting

Defaults to \"format\" if the NO_COLOR env is set and to \"none\" if stdout is not tty."
    )]
    pub pretty: Option<Pretty>,

    /// Set output formatting options.
    #[clap(
        long,
        value_name = "FORMAT_OPTIONS",
        long_help = "\
Set output formatting options. Supported option are:

    json.indent:<NUM>
    json.format:<true|false>
    xml.indent:<NUM>
    xml.format:<true|false>
    headers.sort:<true|false>

Example: --format-options=json.indent:2,headers.sort:false"
    )]
    pub format_options: Vec<FormatOptions>,

    /// Output coloring style.
    #[clap(short = 's', long, value_enum, value_name = "THEME")]
    pub style: Option<Theme>,

    /// Override the response encoding for terminal display purposes.
    ///
    /// Example: --response-charset=latin1
    #[clap(long, value_name = "ENCODING", value_parser = parse_encoding)]
    pub response_charset: Option<&'static Encoding>,

    /// Override the response mime type for coloring and formatting for the terminal.
    ///
    /// Example: --response-mime=application/json
    #[clap(long, value_name = "MIME_TYPE")]
    pub response_mime: Option<String>,

    /// String specifying what the output should contain
    #[clap(
        short = 'p',
        long,
        value_name = "FORMAT",
        long_help = "\
String specifying what the output should contain

    H   request headers
    B   request body
    h   response headers
    b   response body
    m   response metadata

Example: --print=Hb"
    )]
    pub print: Option<Print>,

    /// Print only the response headers. Shortcut for --print=h.
    #[clap(short = 'h', long)]
    pub headers: bool,

    /// Print only the response body. Shortcut for --print=b.
    #[clap(short = 'b', long)]
    pub body: bool,

    /// Print only the response metadata. Shortcut for --print=m.
    #[clap(short = 'm', long)]
    pub meta: bool,

    /// Print the whole request as well as the response.
    ///
    /// Additionally, this enables --all for printing intermediary
    /// requests/responses while following redirects.
    ///
    /// Using verbose twice i.e. -vv will print the response metadata as well.
    ///
    /// Equivalent to --print=HhBb --all.
    #[clap(short = 'v', long, action = ArgAction::Count)]
    pub verbose: u8,

    /// Print full error stack traces and debug log messages.
    ///
    /// Logging can be configured in more detail using the `$RUST_LOG` environment
    /// variable. Set `RUST_LOG=trace` to show even more messages.
    /// See https://docs.rs/env_logger/0.11.3/env_logger/#enabling-logging.
    #[clap(long)]
    pub debug: bool,

    /// Show any intermediary requests/responses while following redirects with --follow.
    #[clap(long)]
    pub all: bool,

    /// The same as --print but applies only to intermediary requests/responses.
    #[clap(short = 'P', long, value_name = "FORMAT")]
    pub history_print: Option<Print>,

    /// Do not print to stdout or stderr.
    ///
    ///  Using quiet twice i.e. -qq will suppress warnings as well.
    #[clap(short = 'q', long, action = ArgAction::Count)]
    pub quiet: u8,

    /// Always stream the response body.
    #[clap(short = 'S', long = "stream", name = "stream")]
    pub stream_raw: bool,

    ///  Content compressed (encoded) with Deflate algorithm.
    ///
    ///  The Content-Encoding header is set to deflate.
    ///
    ///  Compression is skipped if it appears that compression ratio is negative.
    ///  Compression can be forced by repeating this option.
    ///
    ///  Note: Compression cannot be used if the Content-Encoding request header is present.
    #[clap(short = 'x', long = "compress", name = "compress", action = ArgAction::Count)]
    pub compress: u8,

    #[clap(skip)]
    pub stream: Option<bool>,

    /// Save output to FILE instead of stdout.
    #[clap(short = 'o', long, value_name = "FILE")]
    pub output: Option<PathBuf>,

    /// Download the body to a file instead of printing it.
    ///
    /// The Accept-Encoding header is set to identity and any redirects will be followed.
    #[clap(short = 'd', long)]
    pub download: bool,

    /// Resume an interrupted download. Requires --download and --output.
    #[clap(
        short = 'c',
        long = "continue",
        name = "continue",
        requires = "download",
        requires = "output"
    )]
    pub resume: bool,

    /// Create, or reuse and update a session.
    ///
    /// Within a session, custom headers, auth credentials, as well as any cookies sent
    /// by the server persist between requests.
    #[clap(long, value_name = "FILE")]
    pub session: Option<OsString>,

    /// Create or read a session without updating it from the request/response exchange.
    #[clap(long, value_name = "FILE", conflicts_with = "session")]
    pub session_read_only: Option<OsString>,

    #[clap(skip)]
    pub is_session_read_only: bool,

    /// Specify the auth mechanism.
    #[clap(short = 'A', long, value_enum)]
    pub auth_type: Option<AuthType>,

    /// Authenticate as USER with PASS (-A basic|digest) or with TOKEN (-A bearer).
    ///
    /// PASS will be prompted if missing. Use a trailing colon (i.e. "USER:")
    /// to authenticate with just a username.
    ///
    /// TOKEN is expected if --auth-type=bearer.
    #[clap(short = 'a', long, value_name = "USER[:PASS] | TOKEN")]
    pub auth: Option<SecretString>,

    /// Authenticate with a bearer token.
    #[clap(long, value_name = "TOKEN", hide = true)]
    pub bearer: Option<SecretString>,

    /// Do not use credentials from .netrc
    #[clap(long)]
    pub ignore_netrc: bool,

    #[command(flatten)]
    pub m_sig: MessageSignature,

    /// Construct HTTP requests without sending them anywhere.
    #[clap(long)]
    pub offline: bool,

    /// (default) Exit with an error status code if the server replies with an error.
    ///
    /// The exit code will be 4 on 4xx (Client Error), 5 on 5xx (Server Error),
    /// or 3 on 3xx (Redirect) if --follow isn't set.
    ///
    /// If stdout is redirected then a warning is written to stderr.
    #[clap(long = "check-status", name = "check-status")]
    pub check_status_raw: bool,

    #[clap(skip)]
    pub check_status: Option<bool>,

    /// Do follow redirects.
    #[clap(short = 'F', long)]
    pub follow: bool,

    /// Number of redirects to follow. Only respected if --follow is used.
    #[clap(long, value_name = "NUM")]
    pub max_redirects: Option<usize>,

    /// Connection timeout of the request.
    ///
    /// The default value is "0", i.e., there is no timeout limit.
    #[clap(long, value_name = "SEC")]
    pub timeout: Option<Timeout>,

    /// Use a proxy for a protocol. For example: --proxy https:http://proxy.host:8080.
    ///
    /// PROTOCOL can be "all", "http" or "https".
    ///
    /// If your proxy requires credentials, put them in the URL, like so:
    /// --proxy http:socks5://user:password@proxy.host:80
```

### Core Architecture Module: `src/content_disposition.rs`
```
use percent_encoding::percent_decode_str;

/// Parse filename from Content-Disposition header
/// Prioritizes filename* parameter if present, otherwise uses filename parameter
pub fn parse_filename_from_content_disposition(content_disposition: &str) -> Option<String> {
    let parts: Vec<&str> = content_disposition
        .split(';')
        .map(|part| part.trim())
        .collect();

    // First try to find filename* parameter
    for part in parts.iter() {
        if let Some(value) = part.strip_prefix("filename*=") {
            if let Some(filename) = parse_encoded_filename(value) {
                return Some(filename);
            }
        }
    }

    // If filename* is not found or parsing failed, try regular filename parameter
    for part in parts {
        if let Some(value) = part.strip_prefix("filename=") {
            return parse_regular_filename(value);
        }
    }

    None
}

/// Parse regular filename parameter
/// Handles both quoted and unquoted filenames
fn parse_regular_filename(filename: &str) -> Option<String> {
    // Content-Disposition: attachment; filename="file with \"quotes\".txt"  // This won't occur
    // Content-Disposition: attachment; filename*=UTF-8''file%20with%20quotes.txt  // This is the actual practice
    //
    // We don't need to handle escaped characters in Content-Disposition header parsing because:
    //
    // It's not a standard practice
    // It rarely occurs in real-world scenarios
    // When filenames contain special characters, they should use the filename* parameter

    // Remove quotes if present
    let filename = if filename.starts_with('"') && filename.ends_with('"') && filename.len() >= 2 {
        &filename[1..(filename.len() - 1)]
    } else {
        filename
    };

    if filename.is_empty() {
        return None;
    }

    Some(filename.to_string())
}

/// Parse RFC 5987 encoded filename (filename*)
/// Format: charset'language'encoded-value
fn parse_encoded_filename(content: &str) -> Option<String> {
    // Remove "filename*=" prefix

    // According to RFC 5987, format should be: charset'language'encoded-value
    let parts: Vec<&str> = content.splitn(3, '\'').collect();
    if parts.len() != 3 {
        return None;
    }
    let charset = parts[0];
    let encoded_filename = parts[2];

    // Percent-decode the encoded filename into bytes.
    let decoded_bytes = percent_decode_str(encoded_filename).collect::<Vec<u8>>();

    if charset.eq_ignore_ascii_case("UTF-8") {
        if let Ok(decoded_str) = String::from_utf8(decoded_bytes) {
            return Some(decoded_str);
        }
    } else if charset.eq_ignore_ascii_case("ISO-8859-1") {
        // RFC 5987 says to use ISO/IEC 8859-1:1998.
        // But Firefox and Chromium decode %99 as ™ so they're actually using
        // Windows-1252. This mixup is common on the web.
        // This affects the 0x80-0x9F range. According to ISO 8859-1 those are
        // control characters. According to Windows-1252 most of them are
        // printable characters.
        // They agree on all the other characters, and filenames shouldn't have
        // control characters, so Windows-1252 makes sense.
        if let Some(decoded_str) = encoding_rs::WINDOWS_1252
            .decode_without_bom_handling_and_without_replacement(&decoded_bytes)
        {
            return Some(decoded_str.into_owned());
        }
    } else {
        // Unknown charset. As a fallback, try interpreting as UTF-8.
        // Firefox also does this.
        // Chromium makes up its own filename. (Even if `filename=` is present.)
        if let Ok(decoded_str) = String::from_utf8(decoded_bytes) {
            return Some(decoded_str);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_filename() {
        let header = r#"attachment; filename="example.pdf""#;
        assert_eq!(
            parse_filename_from_content_disposition(header),
            Some("example.pdf".to_string())
        );
    }

    #[test]
    fn test_filename_without_quotes() {
        let header = "attachment; filename=example.pdf";
        assert_eq!(
            parse_filename_from_content_disposition(header),
            Some("example.pdf".to_string())
        );
    }

    #[test]
    fn test_encoded_filename() {
        // UTF-8 encoded Chinese filename "测试.pdf"
        let header = "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.pdf";
        assert_eq!(
            parse_filename_from_content_disposition(header),
            Some("测试.pdf".to_string())
        );
    }

    #[test]
    fn test_both_filenames() {
        // When both filename and filename* are present, filename* should be preferred
        let header =
            r#"attachment; filename="fallback.pdf"; filename*=UTF-8''%E6%B5%8B%E8%AF%95.pdf"#;
        assert_eq!(
            parse_filename_from_content_disposition(header),
            Some("测试.pdf".to_string())
        );
    }
    #[test]
    fn test_decode_with_windows_1252() {
        let header = "content-disposition: attachment; filename*=iso-8859-1'en'a%99b";
        assert_eq!(
            parse_filename_from_content_disposition(header),
            Some("a™b".to_string())
        );
    }

    #[test]
    fn test_both_filenames_with_bad_format() {
        // When both filename and filename* are present, filename* with bad format, filename should be used
        let header = r#"attachment; filename="fallback.pdf"; filename*=UTF-8'bad_format.pdf"#;
        assert_eq!(
            parse_filename_from_content_disposition(header),
            Some("fallback.pdf".to_string())
        );
    }

    #[test]
    fn test_no_filename() {
        let header = "attachment";
        assert_eq!(parse_filename_from_content_disposition(header), None);
    }

    #[test]
    fn test_iso_8859_1() {
        let header = "attachment;filename*=iso-8859-1'en'%A3%20rates";
        assert_eq!(
            parse_filename_from_content_disposition(header),
            Some("£ rates".to_string())
        );
    }

    #[test]
    fn test_bad_encoding_fallback_to_utf8() {
        let header = "attachment;filename*=UTF-16''%E6%B5%8B%E8%AF%95.pdf";
        assert_eq!(
            parse_filename_from_content_disposition(header),
            Some("测试.pdf".to_string())
        );
    }
}

```

### Core Architecture Module: `src/decoder.rs`
```
use std::cell::Cell;
use std::io::{self, BufRead, BufReader, Read};
use std::rc::Rc;
use std::str::FromStr;

use brotli::Decompressor as BrotliDecoder;
use flate2::read::{GzDecoder, ZlibDecoder};
use reqwest::header::{CONTENT_ENCODING, CONTENT_LENGTH, HeaderMap, TRANSFER_ENCODING};
use ruzstd::frame::ReadFrameHeaderError;
use ruzstd::frame_decoder::FrameDecoderError;
use ruzstd::{BlockDecodingStrategy, FrameDecoder};

#[derive(Debug, Clone, Copy)]
pub enum CompressionType {
    Gzip,
    Deflate,
    Brotli,
    Zstd,
}

impl FromStr for CompressionType {
    type Err = anyhow::Error;
    fn from_str(value: &str) -> anyhow::Result<CompressionType> {
        match value {
            // RFC 2616 section 3.5:
            //   For compatibility with previous implementations of HTTP,
            //   applications SHOULD consider "x-gzip" and "x-compress" to be
            //   equivalent to "gzip" and "compress" respectively.
            "gzip" | "x-gzip" => Ok(CompressionType::Gzip),
            "deflate" => Ok(CompressionType::Deflate),
            "br" => Ok(CompressionType::Brotli),
            "zstd" => Ok(CompressionType::Zstd),
            _ => Err(anyhow::anyhow!("unknown compression type")),
        }
    }
}

// See https://github.com/seanmonstar/reqwest/blob/9bd4e90ec3401c2c5bc435c58954f3d52ab53e99/src/async_impl/decoder.rs#L150
pub fn get_compression_type(headers: &HeaderMap) -> Option<CompressionType> {
    let mut compression_type = headers
        .get_all(CONTENT_ENCODING)
        .iter()
        .find_map(|value| value.to_str().ok().and_then(|value| value.parse().ok()));

    if compression_type.is_none() {
        compression_type = headers
            .get_all(TRANSFER_ENCODING)
            .iter()
            .find_map(|value| value.to_str().ok().and_then(|value| value.parse().ok()));
    }

    if compression_type.is_some() {
        if let Some(content_length) = headers.get(CONTENT_LENGTH) {
            if content_length == "0" {
                return None;
            }
        }
    }

    compression_type
}

/// A wrapper that checks whether an error is an I/O error or a decoding error.
///
/// The main purpose of this is to suppress decoding errors that happen because
/// of an empty input. This is behavior we inherited from HTTPie.
///
/// It's load-bearing in the case of HEAD requests, where responses don't have a
/// body but may declare a Content-Encoding.
///
/// We also treat other empty response bodies like this, regardless of the request
/// method. This matches all the user agents I tried (reqwest, requests/HTTPie, curl,
/// wget, Firefox, Chromium) but I don't know if it's prescribed by any RFC.
///
/// As a side benefit we make I/O errors more focused by stripping decoding errors.
///
/// The reader is structured like this:
///
///      OuterReader ───────┐
///   compression codec     ├── [Status]
///     [InnerReader] ──────┘
///    underlying I/O
///
/// The shared Status object is used to communicate.
struct OuterReader<'a> {
    decoder: Box<dyn Read + 'a>,
    status: Option<Rc<Status>>,
}

struct Status {
    has_read_data: Cell<bool>,
    read_error: Cell<Option<io::Error>>,
    error_msg: &'static str,
}

impl Read for OuterReader<'_> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        match self.decoder.read(buf) {
            Ok(n) => Ok(n),
            Err(err) => {
                let Some(ref status) = self.status else {
                    // No decoder, pass on as is
                    return Err(err);
                };
                match status.read_error.take() {
                    // If an I/O error happened, return that.
                    Some(read_error) => Err(read_error),
                    // If the input was empty, ignore the decoder error.
                    None if !status.has_read_data.get() => Ok(0),
                    // Otherwise, decorate the decoder error with a message.
                    None => Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        DecodeError {
                            msg: status.error_msg,
                            err,
                        },
                    )),
                }
            }
        }
    }
}

struct InnerReader<R: Read> {
    reader: R,
    status: Rc<Status>,
}

impl<R: Read> Read for InnerReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.status.read_error.set(None);
        match self.reader.read(buf) {
            Ok(0) => Ok(0),
            Ok(len) => {
                self.status.has_read_data.set(true);
                Ok(len)
            }
            Err(err) => {
                // Store the real error and return a placeholder.
                // The placeholder is intercepted and replaced by the real error
                // before leaving this module.
                // We store the whole error instead of setting a flag because ruzstd
                // wraps I/O errors in custom errors during frame initialization and
                // decoding, making the original io::Error hard to recover.
                let msg = err.to_string();
                let kind = err.kind();
                self.status.read_error.set(Some(err));
                Err(io::Error::new(kind, msg))
            }
        }
    }
}

#[derive(Debug)]
struct DecodeError {
    msg: &'static str,
    err: io::Error,
}

impl std::fmt::Display for DecodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.msg)
    }
}

impl std::error::Error for DecodeError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&self.err)
    }
}

pub fn decompress(
    reader: &mut impl Read,
    compression_type: Option<CompressionType>,
) -> impl Read + '_ {
    let Some(compression_type) = compression_type else {
        return OuterReader {
            decoder: Box::new(reader),
            status: None,
        };
    };

    let status = Rc::new(Status {
        has_read_data: Cell::new(false),
        read_error: Cell::new(None),
        error_msg: match compression_type {
            CompressionType::Gzip => "error decoding gzip response body",
            CompressionType::Deflate => "error decoding deflate response body",
            CompressionType::Brotli => "error decoding brotli response body",
            CompressionType::Zstd => "error decoding zstd response body",
        },
    });
    let reader = InnerReader {
        reader,
        status: Rc::clone(&status),
    };
    OuterReader {
        decoder: match compression_type {
            CompressionType::Gzip => Box::new(GzDecoder::new(reader)),
            CompressionType::Deflate => Box::new(ZlibDecoder::new(reader)),
            // 32K is the default buffer size for gzip and deflate
            CompressionType::Brotli => Box::new(BrotliDecoder::new(reader, 32 * 1024)),
            CompressionType::Zstd => Box::new(LazyZstdDecoder::new(reader)),
        },
        status: Some(status),
    }
}

/// A lazy decoder for a stream containing any number of zstd frames.
///
/// ruzstd's high-level streaming decoder reads during construction and stops
/// after one frame. Using [FrameDecoder] directly lets us defer all reads until
/// [Read] and continue through concatenated and skippable frames.
struct LazyZstdDecoder<R: Read> {
    reader: BufReader<R>,
    decoder: FrameDecoder,
    state: ZstdDecoderState,
}

#[derive(Clone, Copy)]
enum ZstdDecoderState {
    NeedFrame,
    Decoding,
    Finished,
}

impl<R: Read> LazyZstdDecoder<R> {
    fn new(reader: R) -> Self {
        Self {
            reader: BufReader::new(reader),
            decoder: FrameDecoder::new(),
            state: ZstdDecoderState::NeedFrame,
        }
    }
}

impl<R: Read> Read for LazyZstdDecoder<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if buf.is_empty() {
            return Ok(0);
        }

        loop {
            match self.state {
                ZstdDecoderState::NeedFrame => {
                    if self.reader.fill_buf()?.is_empty() {
                        self.state = ZstdDecoderState::Finished;
                        return Ok(0);
                    }

                    match self.decoder.reset(&mut self.reader) {
                        Ok(()) => self.state = ZstdDecoderState::Decoding,
                        Err(FrameDecoderError::ReadFrameHeaderError(
                            ReadFrameHeaderError::SkipFrame { length, .. },
                        )) => {
                            let length = u64::from(length);
                            let copied = {
                                let mut payload = self.reader.by_ref().take(length);
                                io::copy(&mut payload, &mut io::sink())?
                            };
                            if copied != length {
                                return Err(io::Error::new(
                                    io::ErrorKind::UnexpectedEof,
                                    "truncated zstd skippable frame",
                                ));
                            }
                        }
                        Err(err) => return Err(io::Error::other(err)),
                    }
                }
                ZstdDecoderState::Decoding => {
                    while self.decoder.can_collect() < buf.len() && !self.decoder.is_finished() {
                        let additional_bytes = buf.len() - self.decoder.can_collect();
                        self.decoder
                            .decode_blocks(
                                &mut self.reader,
                                BlockDecodingStrategy::UptoBytes(additional_bytes),
                            )
                            .map_err(io::Error::other)?;
                    }

                    let read = self.decoder.read(buf)?;
                    if read != 0 {
                        r
```

### Core Architecture Module: `src/download.rs`
```
use std::fs::{self, File, OpenOptions};
use std::io::{self, ErrorKind, IsTerminal};
use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::content_disposition;
use crate::decoder::{decompress, get_compression_type};
use crate::utils::{HeaderValueExt, copy_largebuf, test_pretend_term};
use anyhow::{Context, Result, anyhow};
use indicatif::{HumanBytes, ProgressBar, ProgressStyle};
use mime2ext::mime2ext;
use regex_lite::Regex;
use reqwest::{
    StatusCode,
    blocking::Response,
    header::{CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, HeaderMap},
};

fn get_content_length(headers: &HeaderMap) -> Option<u64> {
    headers
        .get(CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
}

// This function is system-agnostic, so it's ok for it to use Strings instead
// of PathBufs
fn get_file_name(response: &Response, orig_url: &reqwest::Url) -> String {
    fn from_header(response: &Response) -> Option<String> {
        let header = response
            .headers()
            .get(CONTENT_DISPOSITION)?
            .to_utf8_str()
            .ok()?;
        content_disposition::parse_filename_from_content_disposition(header)
    }

    fn from_url(url: &reqwest::Url) -> Option<String> {
        let last_seg = url
            .path_segments()?
            .rev()
            .find(|segment| !segment.is_empty())?;
        Some(last_seg.to_string())
    }

    fn guess_extension(response: &Response) -> Option<&'static str> {
        let mimetype = response.headers().get(CONTENT_TYPE)?.to_str().ok()?;
        mime2ext(mimetype)
    }

    let filename = from_header(response)
        .or_else(|| from_url(orig_url))
        .unwrap_or_else(|| "index".to_string());

    let filename = sanitize_filename::sanitize_with_options(
        &filename,
        sanitize_filename::Options {
            replacement: "_",
            ..Default::default()
        },
    );

    let mut filename = filename.trim().trim_start_matches('.').to_string();

    if !filename.contains('.') {
        if let Some(extension) = guess_extension(response) {
            filename.push('.');
            filename.push_str(extension);
        }
    }

    filename
}

pub fn get_file_size(path: Option<&Path>) -> Option<u64> {
    Some(fs::metadata(path?).ok()?.len())
}

/// Find a file name that doesn't exist yet.
fn open_new_file(file_name: PathBuf) -> io::Result<(PathBuf, File)> {
    fn try_open_new(file_name: &Path) -> io::Result<Option<File>> {
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(file_name)
        {
            Ok(file) => Ok(Some(file)),
            Err(err) if err.kind() == ErrorKind::AlreadyExists => Ok(None),
            Err(err) => Err(err),
        }
    }
    if let Some(file) = try_open_new(&file_name)? {
        return Ok((file_name, file));
    }
    for suffix in 1..u32::MAX {
        let candidate = {
            let mut candidate = file_name.clone().into_os_string();
            candidate.push(format!("-{suffix}"));
            PathBuf::from(candidate)
        };
        if let Some(file) = try_open_new(&candidate)? {
            return Ok((candidate, file));
        }
    }
    panic!("Could not create file after unreasonable number of attempts");
}

// https://github.com/httpie/httpie/blob/84c7327057/httpie/downloads.py#L44
// https://tools.ietf.org/html/rfc7233#section-4.2
fn total_for_content_range(header: &str, expected_start: u64) -> Result<u64> {
    let re_range = Regex::new(concat!(
        r"^bytes (?P<first_byte_pos>\d+)-(?P<last_byte_pos>\d+)",
        r"/(?:\*|(?P<complete_length>\d+))$"
    ))
    .unwrap();
    let caps = re_range
        .captures(header)
        // Could happen if header uses unit other than bytes
        .ok_or_else(|| anyhow!("Can't parse Content-Range header, can't resume download"))?;
    let first_byte_pos: u64 = caps
        .name("first_byte_pos")
        .unwrap()
        .as_str()
        .parse()
        .context("Can't parse Content-Range first_byte_pos")?;
    let last_byte_pos: u64 = caps
        .name("last_byte_pos")
        .unwrap()
        .as_str()
        .parse()
        .context("Can't parse Content-Range last_byte_pos")?;
    let complete_length: Option<u64> = caps
        .name("complete_length")
        .map(|num| {
            num.as_str()
                .parse()
                .context("Can't parse Content-Range complete_length")
        })
        .transpose()?;
    // Note that last_byte_pos must be strictly less than complete_length
    // If first_byte_pos == last_byte_pos exactly one byte is sent
    if first_byte_pos > last_byte_pos {
        return Err(anyhow!("Invalid Content-Range: {:?}", header));
    }
    if let Some(complete_length) = complete_length {
        if last_byte_pos >= complete_length {
            return Err(anyhow!("Invalid Content-Range: {:?}", header));
        }
        if complete_length != last_byte_pos + 1 {
            return Err(anyhow!("Content-Range has wrong end: {:?}", header));
        }
    }
    if expected_start != first_byte_pos {
        return Err(anyhow!("Content-Range has wrong start: {:?}", header));
    }
    Ok(last_byte_pos + 1)
}

const BAR_TEMPLATE: &str =
    "{spinner:.green} {percent}% [{wide_bar:.cyan/blue}] {bytes} {bytes_per_sec} ETA {eta}";
const UNCOLORED_BAR_TEMPLATE: &str =
    "{spinner} {percent}% [{wide_bar}] {bytes} {bytes_per_sec} ETA {eta}";
const SPINNER_TEMPLATE: &str = "{spinner:.green} {bytes} {bytes_per_sec} {wide_msg}";
const UNCOLORED_SPINNER_TEMPLATE: &str = "{spinner} {bytes} {bytes_per_sec} {wide_msg}";

pub fn download_file(
    response: Response,
    file_name: Option<PathBuf>,
    // If we fall back on taking the filename from the URL it has to be the
    // original URL, before redirects. That's less surprising and matches
    // HTTPie. Hence this argument.
    orig_url: &reqwest::Url,
    mut resume: Option<u64>,
    color: bool,
    quiet: bool,
) -> Result<()> {
    if resume.is_some() && response.status() != StatusCode::PARTIAL_CONTENT {
        resume = None;
    }

    let mut buffer: Box<dyn io::Write>;
    let dest_name: PathBuf;

    if let Some(file_name) = file_name {
        let mut open_opts = OpenOptions::new();
        open_opts.write(true).create(true);
        if resume.is_some() {
            open_opts.append(true);
        } else {
            open_opts.truncate(true);
        }

        dest_name = file_name;
        buffer = Box::new(open_opts.open(&dest_name)?);
    } else if test_pretend_term() || io::stdout().is_terminal() {
        let (new_name, handle) = open_new_file(get_file_name(&response, orig_url).into())?;
        dest_name = new_name;
        buffer = Box::new(handle);
    } else {
        dest_name = "<stdout>".into();
        buffer = Box::new(io::stdout());
    }

    let starting_length: u64;
    let total_length: Option<u64>;
    if let Some(resume) = resume {
        let header = response
            .headers()
            .get(CONTENT_RANGE)
            .ok_or_else(|| anyhow!("Missing Content-Range header"))?
            .to_str()
            .map_err(|_| anyhow!("Bad Content-Range header"))?;
        starting_length = resume;
        total_length = Some(total_for_content_range(header, starting_length)?);
    } else {
        starting_length = 0;
        total_length = get_content_length(response.headers());
    }

    let starting_time = Instant::now();

    let pb = if quiet {
        // Still counts the downloaded bytes, it just doesn't display anything.
        ProgressBar::hidden()
    } else if let Some(total_length) = total_length {
        eprintln!(
            "Downloading {} to {:?}",
            HumanBytes(total_length - starting_length),
            dest_name
        );
        let style = ProgressStyle::default_bar()
            .template(if color {
                BAR_TEMPLATE
            } else {
                UNCOLORED_BAR_TEMPLATE
            })?
            .progress_chars("#>-");
        ProgressBar::new(total_length).with_style(style)
    } else {
        eprintln!("Downloading to {dest_name:?}");
        let style = ProgressStyle::default_bar().template(if color {
            SPINNER_TEMPLATE
        } else {
            UNCOLORED_SPINNER_TEMPLATE
        })?;
        ProgressBar::new_spinner().with_style(style)
    };
    pb.set_position(starting_length);
    pb.reset_eta();

    let compression_type = get_compression_type(response.headers());
    copy_largebuf(
        &mut decompress(&mut pb.wrap_read(response), compression_type),
        &mut buffer,
        false,
    )?;
    // The progress bar wraps the response before it's decompressed, so this is
    // the number of bytes we received, matching the units of `total_length`.
    let total_downloaded_length = pb.position();
    let downloaded_length = total_downloaded_length - starting_length;
    pb.finish_and_clear();

    // Only meaningful if the body wasn't compressed: a decoder may stop short of the
    // end of the stream, and a truncated compressed body fails while decoding anyway.
    let incomplete = total_length.filter(|&total_length| {
        compression_type.is_none() && total_downloaded_length != total_length
    });

    if !quiet {
        let verb = if incomplete.is_some() {
            "Interrupted"
        } else {
            "Done"
        };
        let time_taken = starting_time.elapsed();
        if !time_taken.is_zero() {
            eprintln!(
                "{verb}. {} in {:.5}s ({}/s)",
                HumanBytes(downloaded_length),
                time_taken.as_secs_f64(),
                HumanBytes((downloaded_length as f64 / time_taken.as_secs_f64()) as u64)
            );
        } else {
            eprintln!("{verb}. {}", HumanBytes(downloaded_length));
        }
        if incomplete.is_some() {
            // Separate the summary from the error message that follows.
            epr
```

### Core Architecture Module: `src/error_reporting.rs`
```
use std::process::ExitCode;

pub(crate) fn additional_messages(err: &anyhow::Error, native_tls: bool) -> Vec<String> {
    let mut msgs = Vec::new();

    #[cfg(feature = "rustls")]
    msgs.extend(format_rustls_error(err));

    if native_tls && err.root_cause().to_string() == "invalid minimum TLS version for backend" {
        msgs.push("Try running without the --native-tls flag.".into());
    }

    msgs
}

/// Format certificate expired/not valid yet messages. By default these print
/// human-unfriendly Unix timestamps.
///
/// Other rustls error messages (e.g. wrong host) are readable enough.
///
/// Note this only works on platforms where rustls-platform-verifier uses webpki for verification.
#[cfg(feature = "rustls")]
fn format_rustls_error(err: &anyhow::Error) -> Option<String> {
    use humantime::format_duration;
    use rustls::CertificateError;
    use rustls::pki_types::UnixTime;
    use time::OffsetDateTime;

    // Multiple layers of io::Error for some reason?
    // This may be fragile
    let err = err.root_cause().downcast_ref::<std::io::Error>()?;
    let err = err.get_ref()?.downcast_ref::<std::io::Error>()?;
    let err = err.get_ref()?.downcast_ref::<rustls::Error>()?;
    let rustls::Error::InvalidCertificate(err) = err else {
        return None;
    };

    fn conv_time(unix_time: &UnixTime) -> Option<OffsetDateTime> {
        OffsetDateTime::from_unix_timestamp(unix_time.as_secs() as i64).ok()
    }

    match err {
        CertificateError::ExpiredContext { time, not_after } => {
            let time = conv_time(time)?;
            let not_after = conv_time(not_after)?;
            let diff = format_duration((time - not_after).try_into().ok()?);
            Some(format!(
                "Certificate not valid after {not_after} ({diff} ago).",
            ))
        }
        CertificateError::NotValidYetContext { time, not_before } => {
            let time = conv_time(time)?;
            let not_before = conv_time(not_before)?;
            let diff = format_duration((not_before - time).try_into().ok()?);
            Some(format!(
                "Certificate not valid before {not_before} ({diff} from now).",
            ))
        }
        _ => None,
    }
}

pub(crate) fn exit_code(err: &anyhow::Error) -> ExitCode {
    if let Some(err) = err.downcast_ref::<reqwest::Error>() {
        if err.is_timeout() {
            return ExitCode::from(2);
        }
    }

    if err
        .downcast_ref::<crate::redirect::TooManyRedirects>()
        .is_some()
    {
        return ExitCode::from(6);
    }

    ExitCode::FAILURE
}

```

### Core Architecture Module: `src/formatting/headers.rs`
```
use std::io::Result;

use reqwest::{
    Method, StatusCode, Version,
    header::{HeaderMap, HeaderName, HeaderValue},
};
use syntect::highlighting::Theme;
use termcolor::WriteColor;
use url::Url;

use crate::utils::HeaderValueExt;

super::palette::palette! {
    struct HeaderPalette {
        http_keyword: ["keyword.other.http"],
        http_separator: ["punctuation.separator.http"],
        http_version: ["constant.numeric.http"],
        method: ["keyword.control.http"],
        path: ["const.language.http"],
        status_code: ["constant.numeric.http"],
        status_reason: ["keyword.reason.http"],
        header_name: ["source.http", "http.requestheaders", "support.variable.http"],
        header_colon: ["source.http", "http.requestheaders", "punctuation.separator.http"],
        header_value: ["source.http", "http.requestheaders", "string.other.http"],
        error: ["error"],
    }
}

macro_rules! set_color {
    ($self:ident, $color:ident) => {
        if let Some(ref palette) = $self.palette {
            $self.output.set_color(&palette.$color)
        } else {
            Ok(())
        }
    };
}

pub(crate) struct HeaderFormatter<'a, W: WriteColor> {
    output: &'a mut W,
    palette: Option<HeaderPalette>,
    is_terminal: bool,
    sort_headers: bool,
}

impl<'a, W: WriteColor> HeaderFormatter<'a, W> {
    pub(crate) fn new(
        output: &'a mut W,
        theme: Option<&Theme>,
        is_terminal: bool,
        sort_headers: bool,
    ) -> Self {
        Self {
            palette: theme.map(HeaderPalette::from),
            output,
            is_terminal,
            sort_headers,
        }
    }

    fn print(&mut self, text: &str) -> Result<()> {
        self.output.write_all(text.as_bytes())
    }

    fn print_plain(&mut self, text: &str) -> Result<()> {
        set_color!(self, default)?;
        self.print(text)
    }

    pub(crate) fn print_request_headers(
        &mut self,
        method: &Method,
        url: &Url,
        version: Version,
        headers: &HeaderMap,
    ) -> Result<()> {
        set_color!(self, method)?;
        self.print(method.as_str())?;

        self.print_plain(" ")?;

        set_color!(self, path)?;
        self.print(url.path())?;
        if let Some(query) = url.query() {
            self.print("?")?;
            self.print(query)?;
        }

        self.print_plain(" ")?;
        self.print_http_version(version)?;

        self.print_plain("\n")?;
        self.print_headers(headers, version)?;

        if self.palette.is_some() {
            self.output.reset()?;
        }
        Ok(())
    }

    pub(crate) fn print_response_headers(
        &mut self,
        version: Version,
        status: StatusCode,
        reason_phrase: &str,
        headers: &HeaderMap,
    ) -> Result<()> {
        self.print_http_version(version)?;

        self.print_plain(" ")?;

        set_color!(self, status_code)?;
        self.print(status.as_str())?;

        self.print_plain(" ")?;

        set_color!(self, status_reason)?;
        self.print(reason_phrase)?;

        self.print_plain("\n")?;

        self.print_headers(headers, version)?;

        if self.palette.is_some() {
            self.output.reset()?;
        }
        Ok(())
    }

    fn print_http_version(&mut self, version: Version) -> Result<()> {
        let version = format!("{version:?}");
        let version = version.strip_prefix("HTTP/").unwrap_or(&version);

        set_color!(self, http_keyword)?;
        self.print("HTTP")?;
        set_color!(self, http_separator)?;
        self.print("/")?;
        set_color!(self, http_version)?;
        self.print(version)?;

        Ok(())
    }

    fn print_headers(&mut self, headers: &HeaderMap, version: Version) -> Result<()> {
        let as_titlecase = match version {
            Version::HTTP_09 | Version::HTTP_10 | Version::HTTP_11 => true,
            Version::HTTP_2 | Version::HTTP_3 => false,
            _ => false,
        };
        let mut headers: Vec<(&HeaderName, &HeaderValue)> = headers.iter().collect();
        if self.sort_headers {
            headers.sort_by_key(|(name, _)| name.as_str());
        }

        let mut namebuf = String::with_capacity(64);
        for (name, value) in headers {
            let key = if as_titlecase {
                titlecase_header(name, &mut namebuf)
            } else {
                name.as_str()
            };

            set_color!(self, header_name)?;
            self.print(key)?;
            set_color!(self, header_colon)?;
            self.print(":")?;
            self.print_plain(" ")?;

            match value.to_ascii_or_latin1() {
                Ok(ascii) => {
                    set_color!(self, header_value)?;
                    self.print(ascii)?;
                }
                Err(bad) => {
                    const FAQ_URL: &str =
                        "https://github.com/ducaale/xh/blob/master/FAQ.md#header-value-encoding";

                    let mut latin1 = bad.latin1();
                    if self.is_terminal {
                        latin1 = sanitize_header_value(&latin1);
                    }
                    set_color!(self, error)?;
                    self.print(&latin1)?;

                    if let Some(utf8) = bad.utf8() {
                        set_color!(self, default)?;
                        if self.palette.is_some() && super::supports_hyperlinks() {
                            self.print(" (")?;
                            self.print(&super::create_hyperlink("UTF-8", FAQ_URL))?;
                            self.print(": ")?;
                        } else {
                            self.print(" (UTF-8: ")?;
                        }

                        set_color!(self, header_value)?;
                        // We could escape these as well but latin1 has a much higher chance
                        // to contain control characters because:
                        // - ~14% of the possible latin1 codepoints are control characters,
                        //   versus <0.1% for UTF-8.
                        // - The latin1 text may not be intended as latin1, but if it's valid
                        //   as UTF-8 then chances are that it really is UTF-8.
                        // We should revisit this if we come up with a general policy for
                        // escaping control characters, not just in headers.
                        self.print(utf8)?;
                        self.print_plain(")")?;
                    }
                }
            }
            self.print_plain("\n")?;
        }

        Ok(())
    }
}

fn titlecase_header<'b>(name: &HeaderName, buffer: &'b mut String) -> &'b str {
    let name = name.as_str();
    buffer.clear();
    buffer.reserve(name.len());
    // Ought to be equivalent to how hyper does it
    // https://github.com/hyperium/hyper/blob/f46b175bf71b202fbb907c4970b5743881b891e1/src/proto/h1/role.rs#L1332
    // Header names are ASCII so operating on char or u8 is equivalent
    let mut prev = '-';
    for mut c in name.chars() {
        if prev == '-' {
            c.make_ascii_uppercase();
        }
        buffer.push(c);
        prev = c;
    }
    buffer
}

/// Escape control characters. Firefox uses Unicode replacement characters,
/// that seems like a good choice.
///
/// Header values can't contain ASCII control characters (like newlines)
/// but if misencoded they frequently contain latin1 control characters.
/// What we do here might not make sense for other strings.
fn sanitize_header_value(value: &str) -> String {
    const REPLACEMENT_CHARACTER: &str = "\u{FFFD}";
    value.replace(char::is_control, REPLACEMENT_CHARACTER)
}

#[cfg(test)]
mod tests {
    use indoc::indoc;

    use super::*;

    #[test]
    fn test_header_casing() {
        let mut headers = HeaderMap::new();
        headers.insert("ab-cd", "0".parse().unwrap());
        headers.insert("-cd", "0".parse().unwrap());
        headers.insert("-", "0".parse().unwrap());
        headers.insert("ab-%c", "0".parse().unwrap());
        headers.insert("A-b--C", "0".parse().unwrap());

        let mut buf = termcolor::Ansi::new(Vec::new());
        let mut formatter = HeaderFormatter::new(&mut buf, None, false, false);
        formatter.print_headers(&headers, Version::HTTP_11).unwrap();
        let buf = buf.into_inner();
        assert_eq!(
            buf,
            indoc! {b"
                Ab-Cd: 0
                -Cd: 0
                -: 0
                Ab-%c: 0
                A-B--C: 0
                "
            }
        );

        let mut buf = termcolor::Ansi::new(Vec::new());
        let mut formatter = HeaderFormatter::new(&mut buf, None, false, false);
        formatter.print_headers(&headers, Version::HTTP_2).unwrap();
        let buf = buf.into_inner();
        assert_eq!(
            buf,
            indoc! {b"
                ab-cd: 0
                -cd: 0
                -: 0
                ab-%c: 0
                a-b--c: 0
                "
            }
        );
    }
}

```

### Core Architecture Module: `src/formatting/mod.rs`
```
use std::{
    io::{self, Write},
    sync::{LazyLock, OnceLock},
};

use quick_xml::events::Event;
use quick_xml::{Reader, Writer};
use syntect::dumps::from_binary;
use syntect::easy::HighlightLines;
use syntect::highlighting::ThemeSet;
use syntect::parsing::SyntaxSet;
use syntect::util::LinesWithEndings;
use termcolor::WriteColor;

use crate::{buffer::Buffer, cli::Theme};

pub(crate) mod headers;
pub(crate) mod palette;

pub fn get_json_formatter(indent_level: usize) -> jsonxf::Formatter {
    let mut fmt = jsonxf::Formatter::pretty_printer();
    fmt.indent = " ".repeat(indent_level);
    fmt.record_separator = String::from("\n\n");
    fmt.eager_record_separators = true;
    fmt
}

/// Pretty-print an XML document. Whitespace-only text nodes (typically existing
/// indentation) are stripped so that already-formatted XML gets re-indented cleanly.
pub fn format_xml(indent: usize, text: &str) -> io::Result<Vec<u8>> {
    let mut reader = Reader::from_str(text);
    let mut writer = Writer::new_with_indent(Vec::new(), b' ', indent);
    loop {
        match reader.read_event() {
            Ok(Event::Eof) => break,
            Ok(Event::Text(ref e)) if e.iter().all(|b| b.is_ascii_whitespace()) => {}
            Ok(event) => writer.write_event(event)?,
            Err(e) => return Err(io::Error::new(io::ErrorKind::InvalidData, e)),
        }
    }
    Ok(writer.into_inner())
}

/// Format a JSON value using serde. Unlike jsonxf this decodes escaped Unicode values.
///
/// Note that if parsing fails this function will stop midway through and return an error.
/// It should only be used with known-valid JSON.
pub fn serde_json_format(indent_level: usize, text: &str, write: impl Write) -> io::Result<()> {
    let indent = " ".repeat(indent_level);
    let formatter = serde_json::ser::PrettyFormatter::with_indent(indent.as_bytes());
    let mut serializer = serde_json::Serializer::with_formatter(write, formatter);
    let mut deserializer = serde_json::Deserializer::from_str(text);
    serde_transcode::transcode(&mut deserializer, &mut serializer)?;
    Ok(())
}

pub(crate) static THEMES: LazyLock<ThemeSet> = LazyLock::new(|| {
    from_binary(include_bytes!(concat!(
        env!("OUT_DIR"),
        "/themepack.themedump"
    )))
});
static PS_BASIC: LazyLock<SyntaxSet> =
    LazyLock::new(|| from_binary(include_bytes!(concat!(env!("OUT_DIR"), "/basic.packdump"))));
static PS_LARGE: LazyLock<SyntaxSet> =
    LazyLock::new(|| from_binary(include_bytes!(concat!(env!("OUT_DIR"), "/large.packdump"))));

pub struct Highlighter<'a> {
    highlighter: HighlightLines<'static>,
    syntax_set: &'static SyntaxSet,
    out: &'a mut Buffer,
}

/// A wrapper around a [`Buffer`] to add syntax highlighting when printing.
impl<'a> Highlighter<'a> {
    pub fn new(syntax: &'static str, theme: Theme, out: &'a mut Buffer) -> Self {
        let syntax_set: &SyntaxSet = match syntax {
            "json" => &PS_BASIC,
            _ => &PS_LARGE,
        };
        let syntax = syntax_set
            .find_syntax_by_extension(syntax)
            .expect("syntax not found");
        Self {
            highlighter: HighlightLines::new(syntax, theme.as_syntect_theme()),
            syntax_set,
            out,
        }
    }

    /// Write a single piece of highlighted text.
    /// May return a [`io::ErrorKind::Other`] when there is a problem
    /// during highlighting.
    pub fn highlight(&mut self, text: &str) -> io::Result<()> {
        for line in LinesWithEndings::from(text) {
            for (style, component) in self
                .highlighter
                .highlight_line(line, self.syntax_set)
                .map_err(io::Error::other)?
            {
                self.out.set_color(&convert_style(style))?;
                write!(self.out, "{component}")?;
            }
        }
        Ok(())
    }

    pub fn highlight_bytes(&mut self, line: &[u8]) -> io::Result<()> {
        self.highlight(&String::from_utf8_lossy(line))
    }

    pub fn flush(&mut self) -> io::Result<()> {
        self.out.flush()
    }
}

impl Drop for Highlighter<'_> {
    fn drop(&mut self) {
        // This is just a best-effort attempt to restore the terminal, failure can be ignored
        let _ = self.out.reset();
    }
}

fn convert_style(style: syntect::highlighting::Style) -> termcolor::ColorSpec {
    use syntect::highlighting::FontStyle;
    let mut spec = termcolor::ColorSpec::new();
    spec.set_fg(convert_color(style.foreground))
        .set_underline(style.font_style.contains(FontStyle::UNDERLINE))
        .set_bold(style.font_style.contains(FontStyle::BOLD))
        .set_italic(style.font_style.contains(FontStyle::ITALIC));
    spec
}

// https://github.com/sharkdp/bat/blob/3a85fd767bd1f03debd0a60ac5bc08548f95bc9d/src/terminal.rs
fn convert_color(color: syntect::highlighting::Color) -> Option<termcolor::Color> {
    use termcolor::Color;

    if color.a == 0 {
        // Themes can specify one of the user-configurable terminal colors by
        // encoding them as #RRGGBBAA with AA set to 00 (transparent) and RR set
        // to the 8-bit color palette number. The built-in themes ansi-light,
        // ansi-dark, base16, and base16-256 use this.
        match color.r {
            // For the first 7 colors, use the Color enum to produce ANSI escape
            // sequences using codes 30-37 (foreground) and 40-47 (background).
            // For example, red foreground is \x1b[31m. This works on terminals
            // without 256-color support.
            0x00 => Some(Color::Black),
            0x01 => Some(Color::Red),
            0x02 => Some(Color::Green),
            0x03 => Some(Color::Yellow),
            0x04 => Some(Color::Blue),
            0x05 => Some(Color::Magenta),
            0x06 => Some(Color::Cyan),
            // The 8th color is white. Themes use it as the default foreground
            // color, but that looks wrong on terminals with a light background.
            // So keep that text uncolored instead.
            0x07 => None,
            // For all other colors, produce escape sequences using
            // codes 38;5 (foreground) and 48;5 (background). For example,
            // bright red foreground is \x1b[38;5;9m. This only works on
            // terminals with 256-color support.
            n => Some(Color::Ansi256(n)),
        }
    } else {
        Some(Color::Rgb(color.r, color.g, color.b))
    }
}

pub(crate) fn supports_hyperlinks() -> bool {
    static SUPPORTS_HYPERLINKS: OnceLock<bool> = OnceLock::new();
    *SUPPORTS_HYPERLINKS.get_or_init(supports_hyperlinks::supports_hyperlinks)
}

pub(crate) fn create_hyperlink(text: &str, url: &str) -> String {
    // https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
    format!("\x1B]8;;{url}\x1B\\{text}\x1B]8;;\x1B\\")
}

```

### Core Architecture Module: `src/formatting/palette.rs`
```
//! We used to use syntect for all of our coloring and we still use syntect-compatible
//! files to store themes.
//!
//! But we've started coloring some things manually for better control (and potentially
//! for better efficiency). This macro loads colors from themes and exposes them as
//! fields on a struct. See [`super::headers`] for an example.

macro_rules! palette {
    {
        $vis:vis struct $name:ident {
            $($color:ident: $scopes:expr,)*
        }
    } => {
        $vis struct $name {
            $(pub $color: ::termcolor::ColorSpec,)*
            #[allow(unused)]
            pub default: ::termcolor::ColorSpec,
        }

        impl From<&::syntect::highlighting::Theme> for $name {
            fn from(theme: &::syntect::highlighting::Theme) -> Self {
                let highlighter = ::syntect::highlighting::Highlighter::new(theme);
                let mut parsed_scopes = ::std::vec::Vec::new();
                Self {
                    $($color: $crate::formatting::palette::util::extract_color(
                        &highlighter,
                        &$scopes,
                        &mut parsed_scopes,
                    ),)*
                    default: $crate::formatting::palette::util::extract_default(theme),
                }
            }
        }
    }
}

pub(crate) use palette;

pub(crate) mod util {
    use syntect::{
        highlighting::{Highlighter, Theme},
        parsing::Scope,
    };
    use termcolor::ColorSpec;

    use crate::formatting::{convert_color, convert_style};

    #[inline(never)]
    pub(crate) fn extract_color(
        highlighter: &Highlighter,
        scopes: &[&str],
        parsebuf: &mut Vec<Scope>,
    ) -> ColorSpec {
        parsebuf.clear();
        parsebuf.extend(scopes.iter().map(|s| s.parse::<Scope>().unwrap()));
        let style = highlighter.style_for_stack(parsebuf);
        convert_style(style)
    }

    #[inline(never)]
    pub(crate) fn extract_default(theme: &Theme) -> ColorSpec {
        let mut color = ColorSpec::new();
        if let Some(foreground) = theme.settings.foreground {
            color.set_fg(convert_color(foreground));
        }
        color
    }
}

```

### Core Architecture Module: `src/generation.rs`
```
use std::io;

use clap_complete::Shell;
use clap_complete_nushell::Nushell;

use crate::cli::Cli;
use crate::cli::Generate;

const MAN_TEMPLATE: &str = include_str!("../doc/man-template.roff");
const MD_TEMPLATE: &str = include_str!("../doc/md-template.md");

pub fn generate(bin_name: &str, generate: Generate) {
    let mut app = Cli::into_app();

    match generate {
        Generate::CompleteBash => {
            clap_complete::generate(Shell::Bash, &mut app, bin_name, &mut io::stdout());
        }
        Generate::CompleteElvish => {
            clap_complete::generate(Shell::Elvish, &mut app, bin_name, &mut io::stdout());
        }
        Generate::CompleteFish => {
            use std::io::Write;
            let mut buf = Vec::new();
            clap_complete::generate(Shell::Fish, &mut app, bin_name, &mut buf);
            let mut stdout = io::stdout();
            // Based on https://github.com/fish-shell/fish-shell/blob/1e61e6492db879ba6c32013f901d84b067ca22eb/share/completions/curl.fish#L1-L6
            let preamble = format!(
                r#"# Complete paths after @ in options:
function __{bin_name}_complete_data
    string match -qr '^(?<prefix>.*@)(?<path>.*)' -- (commandline -ct)
    printf '%s\n' -- $prefix(__fish_complete_path $path)
end
complete -c {bin_name} -n 'string match -qr "@" -- (commandline -ct)' -kxa "(__{bin_name}_complete_data)"

"#,
            );
            stdout.write_all(preamble.as_bytes()).unwrap();
            stdout.write_all(&buf).unwrap();
        }
        Generate::CompleteNushell => {
            clap_complete::generate(Nushell, &mut app, bin_name, &mut io::stdout());
        }
        Generate::CompletePowershell => {
            clap_complete::generate(Shell::PowerShell, &mut app, bin_name, &mut io::stdout());
        }
        Generate::CompleteZsh => {
            clap_complete::generate(Shell::Zsh, &mut app, bin_name, &mut io::stdout());
        }
        Generate::Man => {
            generate_manpages(&mut app);
        }
        Generate::ManMarkdown => {
            generate_markdown(&mut app);
        }
    }
}

fn generate_markdown(app: &mut clap::Command) {
    let items: Vec<_> = app.get_arguments().filter(|i| !i.is_hide_set()).collect();

    let mut request_items = String::new();
    let request_items_help = items
        .iter()
        .find(|opt| opt.get_id() == "raw_rest_args")
        .expect("request_items not found")
        .get_long_help()
        .expect("request_items is missing help")
        .to_string()
        .replace("\"", "`");

    let mut indent = false;
    for line in parse_help(&request_items_help) {
        match line {
            ParsedHelp::Definition(term, Some(description)) => {
                request_items.push_str(&format!("  - `{term}`: {description}\n"))
            }
            ParsedHelp::Definition(term, None) => {
                request_items.push_str(&format!("  - `{term}`\n"))
            }
            ParsedHelp::Line(line) if indent => request_items.push_str(&format!("    {line}\n")),
            ParsedHelp::Line(line) => request_items.push_str(&format!("  {line}\n")),
            ParsedHelp::Indent => indent = true,
            ParsedHelp::DeIndent => indent = false,
        }
    }

    let mut options = String::new();
    let non_pos_items = items
        .iter()
        .filter(|a| !a.is_positional())
        .collect::<Vec<_>>();

    for opt in non_pos_items {
        let mut header = String::new();
        if let Some(short) = opt.get_short() {
            header.push_str(&format!("`-{short}`"));
        }
        if let Some(long) = opt.get_long() {
            if !header.is_empty() {
                header.push_str(", ");
            }
            header.push_str(&format!("`--{long}`"));
        }
        if opt.get_action().takes_values() {
            header.pop();
            let value_name = &opt.get_value_names().unwrap();
            if opt.get_long().is_some() {
                header.push('=');
            } else {
                header.push(' ');
            }
            header.push_str(&value_name.join(" "));
            header.push('`')
        }

        let mut body = String::new();

        let mut help = opt
            .get_long_help()
            .or_else(|| opt.get_help())
            .expect("option is missing help")
            .to_string()
            .replace("\"", "`");
        if !help.ends_with('.') {
            help.push('.')
        }

        let mut indent = false;
        for line in parse_help(&help) {
            match line {
                ParsedHelp::Definition(term, Some(description)) => {
                    body.push_str(&format!("  - `{term}`: {description}\n"))
                }
                ParsedHelp::Definition(term, None) => body.push_str(&format!("  - `{term}`\n")),
                ParsedHelp::Line(line) if indent => body.push_str(&format!("    {line}\n")),
                ParsedHelp::Line(line) => body.push_str(&format!("  {line}\n")),
                ParsedHelp::Indent => indent = true,
                ParsedHelp::DeIndent => indent = false,
            }
        }

        let possible_values = opt.get_possible_values();
        if !possible_values.is_empty()
            && !opt.is_hide_possible_values_set()
            && opt.get_id() != "pretty"
        {
            let possible_values_text = format!(
                "\n  [possible values: {}]\n",
                possible_values
                    .iter()
                    .map(|v| format!("`{}`", v.get_name()))
                    .collect::<Vec<_>>()
                    .join(", ")
            );
            body.push_str(&possible_values_text);
        }
        options.push_str(&format!("- {header}: {}\n", body.trim_start()));
    }

    let mut manpage = MD_TEMPLATE.to_string();

    manpage = manpage.replace("{{request_items}}", request_items.trim_end());
    manpage = manpage.replace("{{options}}", options.trim());

    print!("{manpage}");
}

fn generate_manpages(app: &mut clap::Command) {
    use roff::{Roff, bold, italic, roman};
    use time::OffsetDateTime as DateTime;

    let items: Vec<_> = app.get_arguments().filter(|i| !i.is_hide_set()).collect();

    let mut request_items_roff = Roff::new();
    let request_items_help = items
        .iter()
        .find(|opt| opt.get_id() == "raw_rest_args")
        .expect("request_items not found")
        .get_long_help()
        .expect("request_items is missing help")
        .to_string();

    for line in parse_help(&request_items_help) {
        match line {
            ParsedHelp::Definition(term, Some(description)) => {
                request_items_roff.control("TP", ["4"]);
                request_items_roff.text([roman(term)]);
                request_items_roff.text([roman(description)]);
            }
            ParsedHelp::Definition(_, None) => {
                unreachable!()
            }
            ParsedHelp::Line(line) => {
                request_items_roff.text([roman(line)]);
            }
            ParsedHelp::Indent => {
                request_items_roff.control("RS", ["8"]);
            }
            ParsedHelp::DeIndent => {
                request_items_roff.control("RE", []);
                request_items_roff.control("IP", []);
            }
        }
    }

    let mut options_roff = Roff::new();
    let non_pos_items = items
        .iter()
        .filter(|a| !a.is_positional())
        .collect::<Vec<_>>();

    for opt in non_pos_items {
        options_roff.control("TP", ["4"]);

        let mut header = vec![];

        if let Some(short) = opt.get_short() {
            header.push(bold(format!("-{short}")));
        }
        if let Some(long) = opt.get_long() {
            if !header.is_empty() {
                header.push(roman(", "));
            }
            header.push(bold(format!("--{long}")));
        }
        if opt.get_action().takes_values() {
            let value_name = &opt.get_value_names().unwrap();
            if opt.get_long().is_some() {
                header.push(roman("="));
            } else {
                header.push(roman(" "));
            }

            if opt.get_id() == "auth" {
                header.push(italic("USER"));
                header.push(roman("["));
                header.push(italic(":PASS"));
                header.push(roman("] | "));
                header.push(italic("TOKEN"));
            } else {
                header.push(italic(value_name.join(" ")));
            }
        }
        options_roff.text(header);

        let mut body = vec![];

        let mut help = opt
            .get_long_help()
            .or_else(|| opt.get_help())
            .expect("option is missing help")
            .to_string();
        if !help.ends_with('.') {
            help.push('.')
        }

        for line in parse_help(&help) {
            match line {
                ParsedHelp::Definition(term, Some(description)) => {
                    options_roff.control("TP", ["8"]);
                    options_roff.text([roman(term)]);
                    options_roff.text([roman(description)]);
                }
                ParsedHelp::Definition(term, None) => {
                    options_roff.control("IP", ["\"\"", "0"]);
                    options_roff.text([roman(term)]);
                }
                ParsedHelp::Line(line) => {
                    options_roff.text([roman(line)]);
                }
                ParsedHelp::Indent => {
                    options_roff.control("RS", ["8"]);
                }
                ParsedHelp::DeIndent => {
                    options_roff.control("RE", []);
                    options_roff.control("IP", []);
                }
            }
        }

        let possible_values = opt.get_possible_values();
        if !possible_values.is_empty()
            && !opt.is_hide_possible_values_set()
            && opt.get_id() != "pretty"
        {
            let possible_values_text = format!(

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #400** (2025-01-19): **Cookies without explicit path are stored in session without _any_ path**
  *Symptoms*: As the title explains, xh doesn't store _any_ path for session cookies when `Set-Cookie` headers don't explicitly set a `path` attribute. This means that cookies stored by xh may erroneously be sent to wrong endpoints.  ---  _Original issue below, which was bogus_  I was playing around with an endpoint that: 1. sets a cookie, then 2. redirects to someplace else  ## Example  ``` λ xh \           --session ./xh-session \           -F \           --all \           --print hbHB \           POST http://localhost:8080/jwt/with-redirect \           key=value POST /jwt/with-redirect HTTP/1.1 Accept: application/json, */*;q=0.5 Accept-Encoding: gzip, deflate, br, zstd Connection: keep-alive Content-Length: 164 Content-Type: application/json Host: localhost:8080 User-Agent: xh/0.23.1  {     "key": "value" }    HTTP/1.1 303 See Other Content-Length: 0 Location: http://localhost:9080/other-url Set-Cookie: Bearer=JWT-here;Version=1    GET /other-url HTTP/1.1 Accept: application/json, */*;q=0.5 Accept-Encoding: gzip, deflate, br, zstd Connection: keep-alive Host: localhost:9080 User-Agent: xh/0.23.1  HTTP/1.1 200 OK Content-Language: en-NL Content-Length: 3 Content-Type: application/json Date: Sat, 18 Jan 2025 17:45:14 GMT  {} ```  NB: actual contents redacted, so `Content-Length` isn't correct for the redacted values.  ## Expected outcome  I would've expected the cookie I got from the initial request to be sent to the second one. Rerunning the command above does in fact send the cookie in
  **Post-Mortem & Fix Analysis**:
  > I think this happens because the `set-cookie` header doesn't specify a path, so it **correctly** defaults to `/jwt/with-redirect`. As a result, any subsequent requests that do not fall under `/jwt/with-redirect` directory will not include the cookie. See https://stackoverflow.com/a/43336097/5915221  However, we lose this isolation when persisting cookies in the session file by incorrectly defaulting the path to `None` instead of of using the request path.  ```rs // session.rs session_cookies.push(Cookie {     name: cookie.name().into(),     value: cookie.value().into(),     expires: cookie         .expires()         .and_then(|v| v.datetime())         .map(|v| v.unix_timestamp()),     path: cookie.path().map(Into::into), // should be changed into cookie.path.parse().ok()     secure: cookie.secure(),     domain: domain.map(Into::into), }); ```
  > > I think this happens because the set-cookie header doesn't specify a path, so it correctly defaults to /jwt/with-redirect.  Oh wow, I'm an idiot... 🤦   I have since fixed the endpoint to set a `path` on the cookie, and it now works a treat!  Still glad I opened the issue though, since it helped surface _another_ bug. Thanks for taking the time to look into it 🙏 
  > No worries. Feel free to submit a PR for the fix if you're interested. Let me know if you need any help.

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

### Incident Patch 1: `a005bcb3` (2026-07-17)
**Commit Message**: Merge pull request #470 from snowyukitty/fix-concatenated-zstd-frames

Fix truncated concatenated zstd response bodies

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ## Unreleased
 ### Bug fixes
 - Fix `--auth` ignoring credentials when the username is empty (e.g. `-a :password`), see #467 (@upuddu)
+- Decode all frames in concatenated zstd response bodies, see #470 (@snowyukitty)
 
 ## [0.26.1] - 2026-06-19
 ### Features
```

**File**: `src/decoder.rs` (modified, +146/-27)
```diff
@@ -1,12 +1,14 @@
 use std::cell::Cell;
-use std::io::{self, Read};
+use std::io::{self, BufRead, BufReader, Read};
 use std::rc::Rc;
 use std::str::FromStr;
 
 use brotli::Decompressor as BrotliDecoder;
 use flate2::read::{GzDecoder, ZlibDecoder};
 use reqwest::header::{CONTENT_ENCODING, CONTENT_LENGTH, HeaderMap, TRANSFER_ENCODING};
-use ruzstd::{FrameDecoder, StreamingDecoder as ZstdDecoder};
+use ruzstd::frame::ReadFrameHeaderError;
+use ruzstd::frame_decoder::FrameDecoderError;
+use ruzstd::{BlockDecodingStrategy, FrameDecoder};
 
 #[derive(Debug, Clone, Copy)]
 pub enum CompressionType {
@@ -137,11 +139,9 @@ impl<R: Read> Read for InnerReader<R> {
                 // Store the real error and return a placeholder.
                 // The placeholder is intercepted and replaced by the real error
                 // before leaving this module.
-                // We store the whole error instead of setting a flag because of zstd:
-                // - ZstdDecoder::new() fails with a custom error type and it's hard
-                //   to extract the underlying io::Error
-                // - ZstdDecoder::read() (unlike the other decoders) wraps custom errors
-                //   around the underlying io::Error
+                // We store the whole error instead of setting a flag because ruzstd
+                // wraps I/O errors in custom errors during frame initialization and
+                // decoding, making the original io::Error hard to recover.
                 let msg = err.to_string();
                 let kind = err.kind();
                 self.status.read_error.set(Some(err));
@@ -200,37 +200,93 @@ pub fn decompress(
             CompressionType::Deflate => Box::new(ZlibDecoder::new(reader)),
             // 32K is the default buffer size for gzip and deflate
             CompressionType::Brotli => Box::new(BrotliDecoder::new(reader, 32 * 1024)),
-            CompressionType::Zstd => Box::new(LazyZstdDecoder::Uninit(Some(reader))),
+            CompressionType::Zstd => Box::new(LazyZstdDecoder::new(reader)),
         },
         status: Some(status),
     }
 }
 
-/// [ZstdDecoder] reads from its input during construction.
+/// A lazy decoder for a stream containing any number of zstd frames.
 ///
-/// We need to delay construction until [Read] so read errors stay read errors.
-#[allow(clippy::large_enum_variant)]
-enum LazyZstdDecoder<R: Read> {
-    Uninit(Option<R>),
-    Init(ZstdDecoder<R, FrameDecoder>),
+/// ruzstd's high-level streaming decoder reads during construction and stops
+/// after one frame. Using [FrameDecoder] directly lets us defer all reads until
+/// [Read] and continue through concatenated and skippable frames.
+struct LazyZstdDecoder<R: Read> {
+    reader: BufReader<R>,
+    decoder: FrameDecoder,
+    state: ZstdDecoderState,
+}
+
+#[derive(Clone, Copy)]
+enum ZstdDecoderState {
+    NeedFrame,
+    Decoding,
+    Finished,
+}
+
+impl<R: Read> LazyZstdDecoder<R> {
+    fn new(reader: R) -> Self {
+        Self {
+            reader: BufReader::new(reader),
+            decoder: FrameDecoder::new(),
+            state: ZstdDecoderState::NeedFrame,
+        }
+    }
 }
 
 impl<R: Read> Read for LazyZstdDecoder<R> {
     fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
-        match self {
-            LazyZstdDecoder::Uninit(reader) => match reader.take() {
-                Some(reader) => match ZstdDecoder::new(reader) {
-                    Ok(decoder) => {
-                        *self = LazyZstdDecoder::Init(decoder);
-                        self.read(buf)
+        if buf.is_empty() {
+            return Ok(0);
+        }
+
+        loop {
+            match self.state {
+                ZstdDecoderState::NeedFrame => {
+                    if self.reader.fill_buf()?.is_empty() {
+                        self.state = ZstdDecoderState::Finished;
+                        return Ok(0);
+                    }
+
+                    match self.decoder.reset(&mut self.reader) {
+                        Ok(()) => self.state = ZstdDecoderState::Decoding,
+                        Err(FrameDecoderError::ReadFrameHeaderError(
+                            ReadFrameHeaderError::SkipFrame { length, .. },
+                        )) => {
+                            let length = u64::from(length);
+                            let copied = {
+                                let mut payload = self.reader.by_ref().take(length);
+                                io::copy(&mut payload, &mut io::sink())?
+                            };
+                            if copied != length {
+                                return Err(io::Error::new(
+                                    io::ErrorKind::UnexpectedEof,
+                                    "truncated zstd skippable frame",
+                                ));
+                            }
+                        }
+                        Err(err) => return Err(io::Error::other(err)),
+                    }
+  
```

**File**: `tests/cli.rs` (modified, +27/-0)
```diff
@@ -3582,6 +3582,33 @@ fn zstd() {
         "#});
 }
 
+#[test]
+fn zstd_concatenated_frames() {
+    let server = server::http(|_req| async move {
+        let frame = fs::read("./tests/fixtures/responses/hello_world.zst").unwrap();
+        let compressed_bytes = [frame.as_slice(), frame.as_slice()].concat();
+        hyper::Response::builder()
+            .header("date", "N/A")
+            .header("content-encoding", "zstd")
+            .body(compressed_bytes.into())
+            .unwrap()
+    });
+
+    get_command()
+        .arg(server.base_url())
+        .assert()
+        .stdout(indoc! {r#"
+            HTTP/1.1 200 OK
+            Content-Encoding: zstd
+            Content-Length: 50
+            Date: N/A
+
+            Hello world
+            Hello world
+
+        "#});
+}
+
 #[test]
 fn empty_response_with_content_encoding() {
     let server = server::http(|_req| async move {
```

---

### Incident Patch 2: `4ad146e3` (2026-07-15)
**Commit Message**: Fix truncated concatenated zstd response bodies

**File**: `src/decoder.rs` (modified, +146/-27)
```diff
@@ -1,12 +1,14 @@
 use std::cell::Cell;
-use std::io::{self, Read};
+use std::io::{self, BufRead, BufReader, Read};
 use std::rc::Rc;
 use std::str::FromStr;
 
 use brotli::Decompressor as BrotliDecoder;
 use flate2::read::{GzDecoder, ZlibDecoder};
 use reqwest::header::{CONTENT_ENCODING, CONTENT_LENGTH, HeaderMap, TRANSFER_ENCODING};
-use ruzstd::{FrameDecoder, StreamingDecoder as ZstdDecoder};
+use ruzstd::frame::ReadFrameHeaderError;
+use ruzstd::frame_decoder::FrameDecoderError;
+use ruzstd::{BlockDecodingStrategy, FrameDecoder};
 
 #[derive(Debug, Clone, Copy)]
 pub enum CompressionType {
@@ -137,11 +139,9 @@ impl<R: Read> Read for InnerReader<R> {
                 // Store the real error and return a placeholder.
                 // The placeholder is intercepted and replaced by the real error
                 // before leaving this module.
-                // We store the whole error instead of setting a flag because of zstd:
-                // - ZstdDecoder::new() fails with a custom error type and it's hard
-                //   to extract the underlying io::Error
-                // - ZstdDecoder::read() (unlike the other decoders) wraps custom errors
-                //   around the underlying io::Error
+                // We store the whole error instead of setting a flag because ruzstd
+                // wraps I/O errors in custom errors during frame initialization and
+                // decoding, making the original io::Error hard to recover.
                 let msg = err.to_string();
                 let kind = err.kind();
                 self.status.read_error.set(Some(err));
@@ -200,37 +200,93 @@ pub fn decompress(
             CompressionType::Deflate => Box::new(ZlibDecoder::new(reader)),
             // 32K is the default buffer size for gzip and deflate
             CompressionType::Brotli => Box::new(BrotliDecoder::new(reader, 32 * 1024)),
-            CompressionType::Zstd => Box::new(LazyZstdDecoder::Uninit(Some(reader))),
+            CompressionType::Zstd => Box::new(LazyZstdDecoder::new(reader)),
         },
         status: Some(status),
     }
 }
 
-/// [ZstdDecoder] reads from its input during construction.
+/// A lazy decoder for a stream containing any number of zstd frames.
 ///
-/// We need to delay construction until [Read] so read errors stay read errors.
-#[allow(clippy::large_enum_variant)]
-enum LazyZstdDecoder<R: Read> {
-    Uninit(Option<R>),
-    Init(ZstdDecoder<R, FrameDecoder>),
+/// ruzstd's high-level streaming decoder reads during construction and stops
+/// after one frame. Using [FrameDecoder] directly lets us defer all reads until
+/// [Read] and continue through concatenated and skippable frames.
+struct LazyZstdDecoder<R: Read> {
+    reader: BufReader<R>,
+    decoder: FrameDecoder,
+    state: ZstdDecoderState,
+}
+
+#[derive(Clone, Copy)]
+enum ZstdDecoderState {
+    NeedFrame,
+    Decoding,
+    Finished,
+}
+
+impl<R: Read> LazyZstdDecoder<R> {
+    fn new(reader: R) -> Self {
+        Self {
+            reader: BufReader::new(reader),
+            decoder: FrameDecoder::new(),
+            state: ZstdDecoderState::NeedFrame,
+        }
+    }
 }
 
 impl<R: Read> Read for LazyZstdDecoder<R> {
     fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
-        match self {
-            LazyZstdDecoder::Uninit(reader) => match reader.take() {
-                Some(reader) => match ZstdDecoder::new(reader) {
-                    Ok(decoder) => {
-                        *self = LazyZstdDecoder::Init(decoder);
-                        self.read(buf)
+        if buf.is_empty() {
+            return Ok(0);
+        }
+
+        loop {
+            match self.state {
+                ZstdDecoderState::NeedFrame => {
+                    if self.reader.fill_buf()?.is_empty() {
+                        self.state = ZstdDecoderState::Finished;
+                        return Ok(0);
+                    }
+
+                    match self.decoder.reset(&mut self.reader) {
+                        Ok(()) => self.state = ZstdDecoderState::Decoding,
+                        Err(FrameDecoderError::ReadFrameHeaderError(
+                            ReadFrameHeaderError::SkipFrame { length, .. },
+                        )) => {
+                            let length = u64::from(length);
+                            let copied = {
+                                let mut payload = self.reader.by_ref().take(length);
+                                io::copy(&mut payload, &mut io::sink())?
+                            };
+                            if copied != length {
+                                return Err(io::Error::new(
+                                    io::ErrorKind::UnexpectedEof,
+                                    "truncated zstd skippable frame",
+                                ));
+                            }
+                        }
+                        Err(err) => return Err(io::Error::other(err)),
+                    }
+  
```

**File**: `tests/cli.rs` (modified, +27/-0)
```diff
@@ -3582,6 +3582,33 @@ fn zstd() {
         "#});
 }
 
+#[test]
+fn zstd_concatenated_frames() {
+    let server = server::http(|_req| async move {
+        let frame = fs::read("./tests/fixtures/responses/hello_world.zst").unwrap();
+        let compressed_bytes = [frame.as_slice(), frame.as_slice()].concat();
+        hyper::Response::builder()
+            .header("date", "N/A")
+            .header("content-encoding", "zstd")
+            .body(compressed_bytes.into())
+            .unwrap()
+    });
+
+    get_command()
+        .arg(server.base_url())
+        .assert()
+        .stdout(indoc! {r#"
+            HTTP/1.1 200 OK
+            Content-Encoding: zstd
+            Content-Length: 50
+            Date: N/A
+
+            Hello world
+            Hello world
+
+        "#});
+}
+
 #[test]
 fn empty_response_with_content_encoding() {
     let server = server::http(|_req| async move {
```

---

### Incident Patch 3: `87750f24` (2026-07-11)
**Commit Message**: fix clippy warning

**File**: `build.rs` (modified, +2/-2)
```diff
@@ -30,8 +30,8 @@ fn feature_status(feature: &str) -> String {
 fn features() -> String {
     format!(
         "{} {}",
-        &feature_status("native-tls"),
-        &feature_status("rustls")
+        feature_status("native-tls"),
+        feature_status("rustls")
     )
 }
 
```

---

### Incident Patch 4: `d9df32e2` (2026-07-07)
**Commit Message**: Merge pull request #467 from upuddu/fix-empty-username-auth

Fix --auth ignoring credentials with an empty username

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## Unreleased
+### Bug fixes
+- Fix `--auth` ignoring credentials when the username is empty (e.g. `-a :password`), see #467 (@upuddu)
+
 ## [0.26.1] - 2026-06-19
 ### Features
 - Pretty-print XML responses, see #450 (@o1x3)
```

**File**: `src/auth.rs` (modified, +3/-1)
```diff
@@ -48,7 +48,7 @@ impl Auth {
 pub fn parse_auth(auth: &str, host: &str) -> io::Result<(String, Option<String>)> {
     if let Some(cap) = Regex::new(r"^([^:]*):$").unwrap().captures(auth) {
         Ok((cap[1].to_string(), None))
-    } else if let Some(cap) = Regex::new(r"^(.+?):(.+)$").unwrap().captures(auth) {
+    } else if let Some(cap) = Regex::new(r"^(.*?):(.+)$").unwrap().captures(auth) {
         let username = cap[1].to_string();
         let password = cap[2].to_string();
         Ok((username, Some(password)))
@@ -108,6 +108,8 @@ mod tests {
             ("user:password", ("user", Some("password"))),
             ("user:pass:with:colons", ("user", Some("pass:with:colons"))),
             (":", ("", None)),
+            (":password", ("", Some("password"))),
+            (":pass:with:colons", ("", Some("pass:with:colons"))),
         ];
         for (input, output) in expected {
             let (user, pass) = parse_auth(input, "").unwrap();
```

**File**: `tests/cli.rs` (modified, +14/-0)
```diff
@@ -731,6 +731,20 @@ fn user_auth() {
         .success();
 }
 
+#[test]
+fn empty_user_password_auth() {
+    let server = server::http(|req| async move {
+        // base64 of ":pass"
+        assert_eq!(req.headers()["Authorization"], "Basic OnBhc3M=");
+        hyper::Response::default()
+    });
+
+    get_command()
+        .args(["--auth=:pass", &server.base_url()])
+        .assert()
+        .success();
+}
+
 #[test]
 fn bearer_auth() {
     let server = server::http(|req| async move {
```

---

### Incident Patch 5: `9b0cf819` (2026-07-07)
**Commit Message**: Fix --auth ignoring credentials with an empty username

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## Unreleased
+### Bug fixes
+- Fix `--auth` ignoring credentials when the username is empty (e.g. `-a :password`), see #467 (@upuddu)
+
 ## [0.26.1] - 2026-06-19
 ### Features
 - Pretty-print XML responses, see #450 (@o1x3)
```

**File**: `src/auth.rs` (modified, +3/-1)
```diff
@@ -48,7 +48,7 @@ impl Auth {
 pub fn parse_auth(auth: &str, host: &str) -> io::Result<(String, Option<String>)> {
     if let Some(cap) = Regex::new(r"^([^:]*):$").unwrap().captures(auth) {
         Ok((cap[1].to_string(), None))
-    } else if let Some(cap) = Regex::new(r"^(.+?):(.+)$").unwrap().captures(auth) {
+    } else if let Some(cap) = Regex::new(r"^(.*?):(.+)$").unwrap().captures(auth) {
         let username = cap[1].to_string();
         let password = cap[2].to_string();
         Ok((username, Some(password)))
@@ -108,6 +108,8 @@ mod tests {
             ("user:password", ("user", Some("password"))),
             ("user:pass:with:colons", ("user", Some("pass:with:colons"))),
             (":", ("", None)),
+            (":password", ("", Some("password"))),
+            (":pass:with:colons", ("", Some("pass:with:colons"))),
         ];
         for (input, output) in expected {
             let (user, pass) = parse_auth(input, "").unwrap();
```

**File**: `tests/cli.rs` (modified, +14/-0)
```diff
@@ -731,6 +731,20 @@ fn user_auth() {
         .success();
 }
 
+#[test]
+fn empty_user_password_auth() {
+    let server = server::http(|req| async move {
+        // base64 of ":pass"
+        assert_eq!(req.headers()["Authorization"], "Basic OnBhc3M=");
+        hyper::Response::default()
+    });
+
+    get_command()
+        .args(["--auth=:pass", &server.base_url()])
+        .assert()
+        .success();
+}
+
 #[test]
 fn bearer_auth() {
     let server = server::http(|req| async move {
```

---

### Incident Patch 6: `d38979da` (2026-05-01)
**Commit Message**: fix clippy + failing test

**File**: `src/generation.rs` (modified, +5/-5)
```diff
@@ -106,12 +106,12 @@ fn generate_markdown(app: &mut clap::Command) {
             header.pop();
             let value_name = &opt.get_value_names().unwrap();
             if opt.get_long().is_some() {
-                header.push_str("=");
+                header.push('=');
             } else {
-                header.push_str(" ");
+                header.push(' ');
             }
             header.push_str(&value_name.join(" "));
-            header.push_str("`")
+            header.push('`')
         }
 
         let mut body = String::new();
@@ -407,8 +407,8 @@ mod tests {
         let parsed = parse_help(indoc! {"
             String specifying what the output should contain
 
-                H request headers
-                B request body
+                'H' request headers
+                'B' request body
 
             Example: --print=Hb
         "});
```

---

### Incident Patch 7: `d298aa80` (2026-05-01)
**Commit Message**: fix indent of request items

**File**: `doc/xh.1.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ command instead of sending a request.
 
 - `[REQUEST_ITEM ...]`:
 
-Optional key-value pairs to be included in the request.
+  Optional key-value pairs to be included in the request.
   
   The separator is used to determine the type:
   
```

**File**: `src/generation.rs` (modified, +2/-6)
```diff
@@ -155,16 +155,12 @@ fn generate_markdown(app: &mut clap::Command) {
             );
             body.push_str(&possible_values_text);
         }
-        options.push_str("- ");
-        options.push_str(&header);
-        options.push_str(": ");
-        options.push_str(body.trim_start());
-        options.push_str("\n")
+        options.push_str(&format!("- {header}: {}\n", body.trim_start()));
     }
 
     let mut manpage = MD_TEMPLATE.to_string();
 
-    manpage = manpage.replace("{{request_items}}", request_items.trim());
+    manpage = manpage.replace("{{request_items}}", request_items.trim_end());
     manpage = manpage.replace("{{options}}", options.trim());
 
     print!("{manpage}");
```

---

### Incident Patch 8: `d5636b8f` (2026-04-27)
**Commit Message**: parse and render definitions in help

**File**: `doc/xh.1` (modified, +130/-20)
```diff
@@ -1,4 +1,4 @@
-.TH XH 1 2026-01-14 0.25.3 "User Commands"
+.TH XH 1 2026-04-27 0.25.3 "User Commands"
 
 .SH NAME
 xh \- Friendly and fast tool for sending HTTP requests
@@ -89,73 +89,126 @@ Each --OPTION can be reset with a --no-OPTION argument.
 (default) Serialize data items from the command line as a JSON object.
 
 Overrides both \-\-form and \-\-multipart.
+
 .TP 4
 \fB\-f\fR, \fB\-\-form\fR
 Serialize data items from the command line as form fields.
 
 Overrides both \-\-json and \-\-multipart.
+
 .TP 4
 \fB\-\-multipart\fR
 Like \-\-form, but force a multipart/form\-data request even without files.
 
 Overrides both \-\-json and \-\-form.
+
 .TP 4
 \fB\-\-raw\fR=\fIRAW\fR
 Pass raw request data without extra processing.
+
 .TP 4
 \fB\-\-pretty\fR=\fISTYLE\fR
 Controls output processing. Possible values are:
 
-    all      (default) Enable both coloring and formatting
-    colors   Apply syntax highlighting to output
-    format   Pretty\-print json and sort headers
-    none     Disable both coloring and formatting
+.RS 8
+.TP 8
+all
+(default) Enable both coloring and formatting
+.TP 8
+colors
+Apply syntax highlighting to output
+.TP 8
+format
+Pretty\-print json and sort headers
+.TP 8
+none
+Disable both coloring and formatting
+.RE
+.RS 4
+.PP
 
 Defaults to "format" if the NO_COLOR env is set and to "none" if stdout is not tty.
+.RE
+
 .TP 4
 \fB\-\-format\-options\fR=\fIFORMAT_OPTIONS\fR
 Set output formatting options. Supported option are:
 
-    json.indent:<NUM>
-    json.format:<true|false>
-    headers.sort:<true|false>
+.RS 8
+.PP
+json.indent:<NUM>
+.PP
+json.format:<true|false>
+.PP
+xml.indent:<NUM>
+.PP
+xml.format:<true|false>
+.PP
+headers.sort:<true|false>
+.RE
+.RS 4
+.PP
 
 Example: \-\-format\-options=json.indent:2,headers.sort:false.
+.RE
+
 .TP 4
 \fB\-s\fR, \fB\-\-style\fR=\fITHEME\fR
 Output coloring style.
 
+
 [possible values: auto, solarized, monokai, fruity]
 .TP 4
 \fB\-\-response\-charset\fR=\fIENCODING\fR
 Override the response encoding for terminal display purposes.
 
 Example: \-\-response\-charset=latin1.
+
 .TP 4
 \fB\-\-response\-mime\fR=\fIMIME_TYPE\fR
 Override the response mime type for coloring and formatting for the terminal.
 
 Example: \-\-response\-mime=application/json.
+
 .TP 4
 \fB\-p\fR, \fB\-\-print\fR=\fIFORMAT\fR
 String specifying what the output should contain
 
-    'H' request headers
-    'B' request body
-    'h' response headers
-    'b' response body
-    'm' response metadata
+.RS 8
+.TP 8
+H
+request headers
+.TP 8
+B
+request body
+.TP 8
+h
+response headers
+.TP 8
+b
+response body
+.TP 8
+m
+response metadata
+.RE
+.RS 4
+.PP
 
 Example: \-\-print=Hb.
+.RE
+
 .TP 4
 \fB\-h\fR, \fB\-\-headers\fR
 Print only the response headers. Shortcut for \-\-print=h.
+
 .TP 4
 \fB\-b\fR, \fB\-\-body\fR
 Print only the response body. Shortcut for \-\-print=b.
+
 .TP 4
 \fB\-m\fR, \fB\-\-meta\fR
 Print only the response metadata. Shortcut for \-\-print=m.
+
 .TP 4
 \fB\-v\fR, \fB\-\-verbose\fR
 Print the whole request as well as the response.
@@ -165,25 +218,31 @@ Additionally, this enables \-\-all for printing intermediary requests/responses
 Using verbose twice i.e. \-vv will print the response metadata as well.
 
 Equivalent to \-\-print=HhBb \-\-all.
+
 .TP 4
 \fB\-\-debug\fR
 Print full error stack traces and debug log messages.
 
 Logging can be configured in more detail using the `$RUST_LOG` environment variable. Set `RUST_LOG=trace` to show even more messages. See https://docs.rs/env_logger/0.11.3/env_logger/#enabling\-logging.
+
 .TP 4
 \fB\-\-all\fR
 Show any intermediary requests/responses while following redirects with \-\-follow.
+
 .TP 4
 \fB\-P\fR, \fB\-\-history\-print\fR=\fIFORMAT\fR
 The same as \-\-print but applies only to intermediary requests/responses.
+
 .TP 4
 \fB\-q\fR, \fB\-\-quiet\fR
 Do not print to stdout or stderr.
 
 Using quiet twice i.e. \-qq will suppress warnings as well.
+
 .TP 4
 \fB\-S\fR, \fB\-\-stream\fR
 Always stream the response body.
+
 .TP 4
 \fB\-x\fR, \fB\-\-compress\fR
 Content compressed (encoded) with Deflate algorithm.
@@ -193,29 +252,36 @@ The Content\-Encoding header is set to deflate.
 Compression is skipped if it appears that compression ratio is negative. Compression can be forced by repeating this option.
 
 Note: Compression cannot be used if the Content\-Encoding request header is present.
+
 .TP 4
 \fB\-o\fR, \fB\-\-output\fR=\fIFILE\fR
 Save output to FILE instead of stdout.
+
 .TP 4
 \fB\-d\fR, \fB\-\-download\fR
 Download the body to a file instead of printing it.
 
 The Accept\-Encoding header is set to identity and any redirects will be followed.
+
 .TP 4
 \fB\-c\fR, \fB\-\-continue\fR
 Resume an interrupted download. Requires \-\-download and \-\-output.
+
 .TP 4
 \fB\-\-session\fR=\fIFILE\fR
 Create, or reuse and update a session.
 
 Within a session, custom headers, auth credentials, as well as any cookies sent by the server persist between requests.
+
 .TP 4
 \fB\-\-session\-r
```

**File**: `doc/xh.1.md` (modified, +107/-111)
```diff
@@ -81,59 +81,58 @@ command instead of sending a request.
 Each `--OPTION` can be reset with a `--no-OPTION` argument.
 
 - `-j`, `--json`: (default) Serialize data items from the command line as a JSON object.
-    
-    Overrides both --form and --multipart.
+  
+  Overrides both --form and --multipart.
 
 - `-f`, `--form`: Serialize data items from the command line as form fields.
-    
-    Overrides both --json and --multipart.
+  
+  Overrides both --json and --multipart.
 
 - `--multipart`: Like --form, but force a multipart/form-data request even without files.
-    
-    Overrides both --json and --form.
+  
+  Overrides both --json and --form.
 
 - `--raw`=`RAW`: Pass raw request data without extra processing.
 
 - `--pretty`=`STYLE`: Controls output processing. Possible values are:
-    
-    - all      (default) Enable both coloring and formatting
-    - colors   Apply syntax highlighting to output
-    - format   Pretty-print json and sort headers
-    - none     Disable both coloring and formatting
-    
-    Defaults to "format" if the NO_COLOR env is set and to "none" if stdout is not tty.
+  
+  - `all`: (default) Enable both coloring and formatting
+  - `colors`: Apply syntax highlighting to output
+  - `format`: Pretty-print json and sort headers
+  - `none`: Disable both coloring and formatting
+  
+  Defaults to "format" if the NO_COLOR env is set and to "none" if stdout is not tty.
 
 - `--format-options`=`FORMAT_OPTIONS`: Set output formatting options. Supported option are:
-    
-    - json.indent:<NUM>
-    - json.format:<true|false>
-    - xml.indent:<NUM>
-    - xml.format:<true|false>
-    - headers.sort:<true|false>
-    
-    Example: --format-options=json.indent:2,xml.indent:2,headers.sort:false.
+  
+  - `json.indent:<NUM>`
+  - `json.format:<true|false>`
+  - `xml.indent:<NUM>`
+  - `xml.format:<true|false>`
+  - `headers.sort:<true|false>`
+  
+  Example: --format-options=json.indent:2,headers.sort:false.
 
 - `-s`, `--style`=`THEME`: Output coloring style.
 
-    [possible values: auto, solarized, monokai, fruity]
-
+  [possible values: auto, solarized, monokai, fruity]
 - `--response-charset`=`ENCODING`: Override the response encoding for terminal display purposes.
-    
-    Example: --response-charset=latin1.
+  
+  Example: --response-charset=latin1.
 
 - `--response-mime`=`MIME_TYPE`: Override the response mime type for coloring and formatting for the terminal.
-    
-    Example: --response-mime=application/json.
+  
+  Example: --response-mime=application/json.
 
 - `-p`, `--print`=`FORMAT`: String specifying what the output should contain
-    
-    - 'H' request headers
-    - 'B' request body
-    - 'h' response headers
-    - 'b' response body
-    - 'm' response metadata
-    
-    Example: --print=Hb.
+  
+  - `H`: request headers
+  - `B`: request body
+  - `h`: response headers
+  - `b`: response body
+  - `m`: response metadata
+  
+  Example: --print=Hb.
 
 - `-h`, `--headers`: Print only the response headers. Shortcut for --print=h.
 
@@ -142,154 +141,151 @@ Each `--OPTION` can be reset with a `--no-OPTION` argument.
 - `-m`, `--meta`: Print only the response metadata. Shortcut for --print=m.
 
 - `-v`, `--verbose`: Print the whole request as well as the response.
-    
-    Additionally, this enables --all for printing intermediary requests/responses while following redirects.
-    
-    Using verbose twice i.e. -vv will print the response metadata as well.
-    
-    Equivalent to --print=HhBb --all.
+  
+  Additionally, this enables --all for printing intermediary requests/responses while following redirects.
+  
+  Using verbose twice i.e. -vv will print the response metadata as well.
+  
+  Equivalent to --print=HhBb --all.
 
 - `--debug`: Print full error stack traces and debug log messages.
-    
-    Logging can be configured in more detail using the `$RUST_LOG` environment variable. Set `RUST_LOG=trace` to show even more messages. See https://docs.rs/env_logger/0.11.3/env_logger/#enabling-logging.
+  
+  Logging can be configured in more detail using the `$RUST_LOG` environment variable. Set `RUST_LOG=trace` to show even more messages. See https://docs.rs/env_logger/0.11.3/env_logger/#enabling-logging.
 
 - `--all`: Show any intermediary requests/responses while following redirects with --follow.
 
 - `-P`, `--history-print`=`FORMAT`: The same as --print but applies only to intermediary requests/responses.
 
 - `-q`, `--quiet`: Do not print to stdout or stderr.
-    
-    Using quiet twice i.e. -qq will suppress warnings as well.
+  
+  Using quiet twice i.e. -qq will suppress warnings as well.
 
 - `-S`, `--stream`: Always stream the response body.
 
 - `-x`, `--compress`: Content compressed (encoded) with Deflate algorithm.
-    
-    The Content-Encoding header is set to deflate.
-    
-    Compression is skipped if it appears that compression ratio is negative. Compression can be forced by repeating this option.
-    
-    Note: Compression c
```

**File**: `src/cli.rs` (modified, +6/-6)
```diff
@@ -109,7 +109,7 @@ Set output formatting options. Supported option are:
     xml.format:<true|false>
     headers.sort:<true|false>
 
-Example: --format-options=json.indent:2,xml.indent:2,headers.sort:false"
+Example: --format-options=json.indent:2,headers.sort:false"
     )]
     pub format_options: Vec<FormatOptions>,
 
@@ -137,11 +137,11 @@ Example: --format-options=json.indent:2,xml.indent:2,headers.sort:false"
         long_help = "\
 String specifying what the output should contain
 
-    'H' request headers
-    'B' request body
-    'h' response headers
-    'b' response body
-    'm' response metadata
+    H   request headers
+    B   request body
+    h   response headers
+    b   response body
+    m   response metadata
 
 Example: --print=Hb"
     )]
```

**File**: `src/generation.rs` (modified, +79/-10)
```diff
@@ -92,22 +92,29 @@ fn generate_markdown(app: &mut clap::Command) {
             .get_long_help()
             .or_else(|| opt.get_help())
             .expect("option is missing help")
-            .to_string()
-            .replace("\n    ", "\n- ")
-            .replace('\n', "\n    ");
+            .to_string();
         if !help.ends_with('.') {
             help.push('.')
         }
 
-        body.push_str(&help);
+        for line in parse_help(&help) {
+            match line {
+                ParsedHelp::Definition(term, Some(description)) => {
+                    body.push_str(&format!("  - `{term}`: {description}"))
+                }
+                ParsedHelp::Definition(term, None) => body.push_str(&format!("  - `{term}`")),
+                ParsedHelp::Line(line) => body.push_str(&format!("  {line}")),
+            }
+            body.push_str("\n")
+        }
 
         let possible_values = opt.get_possible_values();
         if !possible_values.is_empty()
             && !opt.is_hide_possible_values_set()
             && opt.get_id() != "pretty"
         {
             let possible_values_text = format!(
-                "\n\n    [possible values: {}]",
+                "\n  [possible values: {}]",
                 possible_values
                     .iter()
                     .map(|v| v.get_name())
@@ -119,8 +126,8 @@ fn generate_markdown(app: &mut clap::Command) {
         options.push_str("- ");
         options.push_str(&header);
         options.push_str(": ");
-        options.push_str(&body);
-        options.push_str("\n\n")
+        options.push_str(body.trim_start());
+        options.push_str("\n")
     }
 
     let mut manpage = MD_TEMPLATE.to_string();
@@ -213,7 +220,10 @@ fn generate_manpages(app: &mut clap::Command) {
         .collect::<Vec<_>>();
 
     for opt in non_pos_items {
+        options_roff.control("TP", ["4"]);
+
         let mut header = vec![];
+
         if let Some(short) = opt.get_short() {
             header.push(bold(format!("-{short}")));
         }
@@ -241,6 +251,8 @@ fn generate_manpages(app: &mut clap::Command) {
                 header.push(italic(value_name.join(" ")));
             }
         }
+        options_roff.text(header);
+
         let mut body = vec![];
 
         let mut help = opt
@@ -251,7 +263,43 @@ fn generate_manpages(app: &mut clap::Command) {
         if !help.ends_with('.') {
             help.push('.')
         }
-        body.push(roman(help));
+
+        let mut rs = false;
+        let mut pp = false;
+        for line in parse_help(&help) {
+            match line {
+                ParsedHelp::Definition(term, Some(description)) => {
+                    if !rs {
+                        rs = true;
+                        options_roff.control("RS", ["8"]);
+                    }
+                    options_roff.control("TP", ["8"]);
+                    options_roff.text([roman(term)]);
+                    options_roff.text([roman(description)]);
+                }
+                ParsedHelp::Definition(term, None) => {
+                    if !rs {
+                        rs = true;
+                        options_roff.control("RS", ["8"]);
+                    }
+                    options_roff.control("PP", []);
+                    options_roff.text([roman(term)]);
+                }
+                ParsedHelp::Line(line) => {
+                    if rs {
+                        rs = false;
+                        options_roff.control("RE", []);
+                        pp = true;
+                        options_roff.control("RS", ["4"]);
+                        options_roff.control("PP", []);
+                    }
+                    options_roff.text([roman(line)]);
+                }
+            }
+        }
+        if pp {
+            options_roff.control("RE", []);
+        }
 
         let possible_values = opt.get_possible_values();
         if !possible_values.is_empty()
@@ -268,8 +316,6 @@ fn generate_manpages(app: &mut clap::Command) {
             );
             body.push(roman(possible_values_text));
         }
-        options_roff.control("TP", ["4"]);
-        options_roff.text(header);
         options_roff.text(body);
     }
 
@@ -292,3 +338,26 @@ fn generate_manpages(app: &mut clap::Command) {
 
     print!("{manpage}");
 }
+
+enum ParsedHelp<'a> {
+    Line(&'a str),
+    Definition(&'a str, Option<&'a str>),
+}
+
+fn parse_help(body: &str) -> Vec<ParsedHelp<'_>> {
+    let mut parsed: Vec<ParsedHelp> = Vec::new();
+
+    for line in body.lines() {
+        if line.starts_with("    ") {
+            if let Some((term, description)) = line.trim_start().split_once("   ") {
+                parsed.push(ParsedHelp::Definition(term, Some(description.trim_start())))
+            } else {
+                parsed.push(ParsedHelp::Definition(line.trim_start(), None))
+            }
+        } else {
+            parsed.push(ParsedHelp::Line(line.trim_start()))
+        }
+    }
+
+  
```

---

### Incident Patch 9: `48fdc592` (2026-03-22)
**Commit Message**: Fix "identify" typo

**File**: `doc/xh.1` (modified, +1/-1)
```diff
@@ -200,7 +200,7 @@ Save output to FILE instead of stdout.
 \fB\-d\fR, \fB\-\-download\fR
 Download the body to a file instead of printing it.
 
-The Accept\-Encoding header is set to identify and any redirects will be followed.
+The Accept\-Encoding header is set to identity and any redirects will be followed.
 .TP 4
 \fB\-c\fR, \fB\-\-continue\fR
 Resume an interrupted download. Requires \-\-download and \-\-output.
```

**File**: `src/cli.rs` (modified, +1/-1)
```diff
@@ -216,7 +216,7 @@ Example: --print=Hb"
 
     /// Download the body to a file instead of printing it.
     ///
-    /// The Accept-Encoding header is set to identify and any redirects will be followed.
+    /// The Accept-Encoding header is set to identity and any redirects will be followed.
     #[clap(short = 'd', long)]
     pub download: bool,
 
```

---

### Incident Patch 10: `2edd1765` (2026-02-26)
**Commit Message**: Merge pull request #452 from zuisong/edition-2024

upgrade to Rust 2024 edition

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name = "xh"
 version = "0.25.3"
 authors = ["ducaale <sharaf.13@hotmail.com>"]
-edition = "2021"
+edition = "2024"
 rust-version = "1.85.0"
 license = "MIT"
 description = "Friendly and fast tool for sending HTTP requests"
```

**File**: `src/auth.rs` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@ use std::io;
 
 use anyhow::Result;
 use regex_lite::Regex;
-use reqwest::blocking::{Request, Response};
-use reqwest::header::{HeaderValue, AUTHORIZATION, WWW_AUTHENTICATE};
 use reqwest::StatusCode;
+use reqwest::blocking::{Request, Response};
+use reqwest::header::{AUTHORIZATION, HeaderValue, WWW_AUTHENTICATE};
 
 use crate::cli::AuthType;
 use crate::middleware::{Context, Middleware};
```

**File**: `src/cli.rs` (modified, +9/-7)
```diff
@@ -10,13 +10,13 @@ use std::path::PathBuf;
 use std::str::FromStr;
 use std::time::Duration;
 
-use anyhow::{anyhow, Context};
-use clap::builder::styling::{AnsiColor, Effects};
+use anyhow::{Context, anyhow};
 use clap::builder::Styles;
+use clap::builder::styling::{AnsiColor, Effects};
 use clap::{self, ArgAction, FromArgMatches, ValueEnum};
 use encoding_rs::Encoding;
 use regex_lite::Regex;
-use reqwest::{tls, Method, Url};
+use reqwest::{Method, Url, tls};
 use serde::Deserialize;
 
 use crate::buffer::Buffer;
@@ -1825,10 +1825,12 @@ mod tests {
             assert!(FormatOptions::from_str(format_option).is_err());
         }
 
-        assert!(FormatOptions::from_str(
-            "json.indent:8,json.format:true,headers.sort:false,JSON.FORMAT:TRUE"
-        )
-        .is_ok());
+        assert!(
+            FormatOptions::from_str(
+                "json.indent:8,json.format:true,headers.sort:false,JSON.FORMAT:TRUE"
+            )
+            .is_ok()
+        );
 
         assert!(FormatOptions::from_str("xml.format:true,xml.indent:4").is_ok());
         assert!(FormatOptions::from_str("xml.format:false").is_ok());
```

**File**: `src/decoder.rs` (modified, +5/-4)
```diff
@@ -5,7 +5,7 @@ use std::str::FromStr;
 
 use brotli::Decompressor as BrotliDecoder;
 use flate2::read::{GzDecoder, ZlibDecoder};
-use reqwest::header::{HeaderMap, CONTENT_ENCODING, CONTENT_LENGTH, TRANSFER_ENCODING};
+use reqwest::header::{CONTENT_ENCODING, CONTENT_LENGTH, HeaderMap, TRANSFER_ENCODING};
 use ruzstd::{FrameDecoder, StreamingDecoder as ZstdDecoder};
 
 #[derive(Debug, Clone, Copy)]
@@ -250,9 +250,10 @@ mod tests {
         match reader.read_to_end(&mut buffer) {
             Ok(_) => unreachable!("gzip should fail to decompress an uncompressed data"),
             Err(e) => {
-                assert!(e
-                    .to_string()
-                    .starts_with("error decoding gzip response body"))
+                assert!(
+                    e.to_string()
+                        .starts_with("error decoding gzip response body")
+                )
             }
         }
     }
```

**File**: `src/download.rs` (modified, +4/-4)
```diff
@@ -5,15 +5,15 @@ use std::time::Instant;
 
 use crate::content_disposition;
 use crate::decoder::{decompress, get_compression_type};
-use crate::utils::{copy_largebuf, test_pretend_term, HeaderValueExt};
-use anyhow::{anyhow, Context, Result};
+use crate::utils::{HeaderValueExt, copy_largebuf, test_pretend_term};
+use anyhow::{Context, Result, anyhow};
 use indicatif::{HumanBytes, ProgressBar, ProgressStyle};
 use mime2ext::mime2ext;
 use regex_lite::Regex;
 use reqwest::{
-    blocking::Response,
-    header::{HeaderMap, CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE},
     StatusCode,
+    blocking::Response,
+    header::{CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, HeaderMap},
 };
 
 fn get_content_length(headers: &HeaderMap) -> Option<u64> {
```

**File**: `src/error_reporting.rs` (modified, +1/-1)
```diff
@@ -22,8 +22,8 @@ pub(crate) fn additional_messages(err: &anyhow::Error, native_tls: bool) -> Vec<
 #[cfg(feature = "rustls")]
 fn format_rustls_error(err: &anyhow::Error) -> Option<String> {
     use humantime::format_duration;
-    use rustls::pki_types::UnixTime;
     use rustls::CertificateError;
+    use rustls::pki_types::UnixTime;
     use time::OffsetDateTime;
 
     // Multiple layers of io::Error for some reason?
```

**File**: `src/formatting/headers.rs` (modified, +1/-1)
```diff
@@ -1,8 +1,8 @@
 use std::io::Result;
 
 use reqwest::{
-    header::{HeaderMap, HeaderName, HeaderValue},
     Method, StatusCode, Version,
+    header::{HeaderMap, HeaderName, HeaderValue},
 };
 use syntect::highlighting::Theme;
 use termcolor::WriteColor;
```

**File**: `src/generation.rs` (modified, +216/-216)
```diff
@@ -1,216 +1,216 @@
-use std::io;
-
-use clap_complete::Shell;
-use clap_complete_nushell::Nushell;
-
-use crate::cli::Cli;
-use crate::cli::Generate;
-
-const MAN_TEMPLATE: &str = include_str!("../doc/man-template.roff");
-
-pub fn generate(bin_name: &str, generate: Generate) {
-    let mut app = Cli::into_app();
-
-    match generate {
-        Generate::CompleteBash => {
-            clap_complete::generate(Shell::Bash, &mut app, bin_name, &mut io::stdout());
-        }
-        Generate::CompleteElvish => {
-            clap_complete::generate(Shell::Elvish, &mut app, bin_name, &mut io::stdout());
-        }
-        Generate::CompleteFish => {
-            use std::io::Write;
-            let mut buf = Vec::new();
-            clap_complete::generate(Shell::Fish, &mut app, bin_name, &mut buf);
-            let mut stdout = io::stdout();
-            // Based on https://github.com/fish-shell/fish-shell/blob/1e61e6492db879ba6c32013f901d84b067ca22eb/share/completions/curl.fish#L1-L6
-            let preamble = format!(
-                r#"# Complete paths after @ in options:
-function __{bin_name}_complete_data
-    string match -qr '^(?<prefix>.*@)(?<path>.*)' -- (commandline -ct)
-    printf '%s\n' -- $prefix(__fish_complete_path $path)
-end
-complete -c {bin_name} -n 'string match -qr "@" -- (commandline -ct)' -kxa "(__{bin_name}_complete_data)"
-
-"#,
-            );
-            stdout.write_all(preamble.as_bytes()).unwrap();
-            stdout.write_all(&buf).unwrap();
-        }
-        Generate::CompleteNushell => {
-            clap_complete::generate(Nushell, &mut app, bin_name, &mut io::stdout());
-        }
-        Generate::CompletePowershell => {
-            clap_complete::generate(Shell::PowerShell, &mut app, bin_name, &mut io::stdout());
-        }
-        Generate::CompleteZsh => {
-            clap_complete::generate(Shell::Zsh, &mut app, bin_name, &mut io::stdout());
-        }
-        Generate::Man => {
-            generate_manpages(&mut app);
-        }
-    }
-}
-
-fn generate_manpages(app: &mut clap::Command) {
-    use roff::{bold, italic, roman, Roff};
-    use time::OffsetDateTime as DateTime;
-
-    let items: Vec<_> = app.get_arguments().filter(|i| !i.is_hide_set()).collect();
-
-    let mut request_items_roff = Roff::new();
-    let request_items = items
-        .iter()
-        .find(|opt| opt.get_id() == "raw_rest_args")
-        .unwrap();
-    let request_items_help = request_items
-        .get_long_help()
-        .or_else(|| request_items.get_help())
-        .expect("request_items is missing help")
-        .to_string();
-
-    // replace the indents in request_item help with proper roff controls
-    // For example:
-    //
-    // ```
-    // normal help normal help
-    // normal help normal help
-    //
-    //   request-item-1
-    //     help help
-    //
-    //   request-item-2
-    //     help help
-    //
-    // normal help normal help
-    // ```
-    //
-    // Should look like this with roff controls
-    //
-    // ```
-    // normal help normal help
-    // normal help normal help
-    // .RS 12
-    // .TP
-    // request-item-1
-    // help help
-    // .TP
-    // request-item-2
-    // help help
-    // .RE
-    //
-    // .RS
-    // normal help normal help
-    // .RE
-    // ```
-    let lines: Vec<&str> = request_items_help.lines().collect();
-    let mut rs = false;
-    for i in 0..lines.len() {
-        if lines[i].is_empty() {
-            let prev = lines[i - 1].chars().take_while(|&x| x == ' ').count();
-            let next = lines[i + 1].chars().take_while(|&x| x == ' ').count();
-            if prev != next && next > 0 {
-                if !rs {
-                    request_items_roff.control("RS", ["8"]);
-                    rs = true;
-                }
-                request_items_roff.control("TP", ["4"]);
-            } else if prev != next && next == 0 {
-                request_items_roff.control("RE", []);
-                request_items_roff.text(vec![roman("")]);
-                request_items_roff.control("RS", []);
-            } else {
-                request_items_roff.text(vec![roman(lines[i])]);
-            }
-        } else {
-            request_items_roff.text(vec![roman(lines[i].trim())]);
-        }
-    }
-    request_items_roff.control("RE", []);
-
-    let mut options_roff = Roff::new();
-    let non_pos_items = items
-        .iter()
-        .filter(|a| !a.is_positional())
-        .collect::<Vec<_>>();
-
-    for opt in non_pos_items {
-        let mut header = vec![];
-        if let Some(short) = opt.get_short() {
-            header.push(bold(format!("-{short}")));
-        }
-        if let Some(long) = opt.get_long() {
-            if !header.is_empty() {
-                header.push(roman(", "));
-            }
-            header.push(bold(format!(
```

---

### Incident Patch 11: `3a4190f7` (2026-02-22)
**Commit Message**: Merge pull request #448 from zuisong/message-signature

Implement RFC 9421 (HTTP Message Signatures)

**File**: `Cargo.lock` (modified, +761/-24)
```diff
@@ -137,12 +137,30 @@ dependencies = [
  "fs_extra",
 ]
 
+[[package]]
+name = "base16ct"
+version = "0.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "4c7f02d4ea65f2c1853089ffd8d2787bdbc63de2f0d29dedbcf8ccdfa0ccd4cf"
+
+[[package]]
+name = "base16ct"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "fd307490d624467aa6f74b0eabb77633d1f758a7b25f12bceb0b22e08d9726f6"
+
 [[package]]
 name = "base64"
 version = "0.22.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
 
+[[package]]
+name = "base64ct"
+version = "1.7.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "89e25b6adfb930f02d1981565a6e5d9c547ac15a96606256d3b59040e5cd4ca3"
+
 [[package]]
 name = "bincode"
 version = "1.3.3"
@@ -167,6 +185,15 @@ dependencies = [
  "generic-array",
 ]
 
+[[package]]
+name = "block-buffer"
+version = "0.11.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "96eb4cdd6cf1b31d671e9efe75c5d1ec614776856cefbe109ca373554a6d514f"
+dependencies = [
+ "hybrid-array",
+]
+
 [[package]]
 name = "brotli"
 version = "8.0.2"
@@ -207,9 +234,9 @@ checksum = "46c5e41b57b8bba42a04676d81cb89e9ee8e859a1a66f80a5a72e1cb76b34d43"
 
 [[package]]
 name = "bytes"
-version = "1.11.0"
+version = "1.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b35204fbdc0b3f4446b89fc1ac2cf84a8a68971995d0bf2e925ec7cd960f9cb3"
+checksum = "1e748733b7cbc798e1434b6ac524f0c1ff2ab456fe201501e6497c8417a4fc33"
 
 [[package]]
 name = "cc"
@@ -241,6 +268,17 @@ version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
 
+[[package]]
+name = "chacha20"
+version = "0.10.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "6f8d983286843e49675a4b7a2d174efe136dc93a18d69130dd18198a6c167601"
+dependencies = [
+ "cfg-if",
+ "cpufeatures 0.3.0",
+ "rand_core 0.10.0",
+]
+
 [[package]]
 name = "chardetng"
 version = "0.1.17"
@@ -321,6 +359,12 @@ dependencies = [
  "cc",
 ]
 
+[[package]]
+name = "cmov"
+version = "0.5.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "de0758edba32d61d1fd9f4d69491b47604b91ee2f7e6b33de7e54ca4ebe55dc3"
+
 [[package]]
 name = "colorchoice"
 version = "1.0.4"
@@ -350,6 +394,18 @@ dependencies = [
  "windows-sys 0.61.2",
 ]
 
+[[package]]
+name = "const-oid"
+version = "0.9.6"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c2459377285ad874054d797f3ccebf984978aa39129f6eafde5cdc8315b612f8"
+
+[[package]]
+name = "const-oid"
+version = "0.10.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a6ef517f0926dd24a1582492c791b6a4818a4d94e789a334894aa15b0d12f55c"
+
 [[package]]
 name = "cookie"
 version = "0.18.1"
@@ -406,6 +462,12 @@ version = "0.8.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"
 
+[[package]]
+name = "cpubits"
+version = "0.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "5ef0c543070d296ea414df2dd7625d1b24866ce206709d8a4a424f28377f5861"
+
 [[package]]
 name = "cpufeatures"
 version = "0.2.17"
@@ -415,6 +477,15 @@ dependencies = [
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
 name = "crc32fast"
 version = "1.5.0"
@@ -424,6 +495,32 @@ dependencies = [
  "cfg-if",
 ]
 
+[[package]]
+name = "crypto-bigint"
+version = "0.5.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "0dc92fb57ca44df6db8059111ab3af99a63d5d0f8375d9972e319a379c6bab76"
+dependencies = [
+ "generic-array",
+ "rand_core 0.6.4",
+ "subtle",
+ "zeroize",
+]
+
+[[package]]
+name = "crypto-bigint"
+version = "0.7.0-rc.27"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b43308b9b6a47554f4612d5b1fb95ff935040aa3927dd42b1d6cbc015a262d96"
+dependencies = [
+ "cpubits",
+ "ctutils",
+ "num-traits",
+ "rand_core 0.10.0",
+ "serdect",
+ "zeroize",
+]
+
 [[package]]
 name = "crypto-common"
 version = "0.1.7"
@@ -434,6 +531,57 @@ dependencies = [
  "typenum",
 ]
 
+[[package]]
+name = "crypto-common"
+version = "0.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "211f05e03c7d03754740fd9e585de910a095d6b99f8bcfffdef8319fa02a8331"
+dependencies = [
+ "hybrid-array",
+]
+
+[[package]]
+name = "crypto-primes"
+version = "0.7.0-pre.9"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "6081ce8b60c0e533e2bba42771b94eb6149052115f4179744d5779883dc985
```

**File**: `Cargo.toml` (modified, +6/-2)
```diff
@@ -51,9 +51,13 @@ time = "0.3.16"
 humantime = "2.2.0"
 unicode-width = "0.1.9"
 url = "2.2.2"
-ruzstd = { version = "0.7", default-features = false, features = ["std"]}
+ruzstd = { version = "0.7", default-features = false, features = ["std"] }
 env_logger = { version = "0.11.3", default-features = false, features = ["color", "auto-color", "humantime"] }
 log = "0.4.21"
+base64 = "0.22.1"
+form_urlencoded = "1.0.1"
+httpsig-hyper = { version = "0.0.24", optional = true, default-features = false, features = ["blocking", "rsa-signature"] }
+sha2 = { version = "0.10", default-features = false }
 
 # Enable logging in transitive dependencies.
 # The rustls version number should be kept in sync with hyper/reqwest.
@@ -82,7 +86,6 @@ features = ["dump-create", "plist-load", "regex-onig", "yaml-load"]
 
 [dev-dependencies]
 assert_cmd = "2.0.8"
-form_urlencoded = "1.0.1"
 indoc = "2.0"
 rand = "0.8.3"
 predicates = "3.0"
@@ -97,6 +100,7 @@ default = ["online-tests", "rustls", "network-interface"]
 native-tls = ["reqwest/native-tls"]
 rustls = ["reqwest/rustls", "dep:rustls"]
 http3 = ["reqwest/http3"]
+message-signatures = ["dep:httpsig-hyper"]
 
 # To be used by platforms that don't support binding to interface via SO_BINDTODEVICE
 # Ideally, this would be auto-disabled on platforms that don't need it
```

**File**: `src/cli.rs` (modified, +160/-0)
```diff
@@ -263,6 +263,9 @@ Example: --print=Hb"
     #[clap(long)]
     pub ignore_netrc: bool,
 
+    #[command(flatten)]
+    pub m_sig: MessageSignature,
+
     /// Construct HTTP requests without sending them anywhere.
     #[clap(long)]
     pub offline: bool,
@@ -804,6 +807,125 @@ pub enum AuthType {
     Digest,
 }
 
+#[derive(clap::Args, Debug, Clone)]
+pub struct MessageSignature {
+    /// Message signature key identifier (RFC 9421).
+    #[arg(
+        long = "unstable-m-sig-id",
+        value_name = "KEY_ID",
+        requires = "m_sig_key"
+    )]
+    pub m_sig_id: Option<String>,
+
+    /// Message signature key material (RFC 9421).
+    ///
+    /// Can be a raw string or a file path starting with @.
+    #[arg(long = "unstable-m-sig-key", value_name = "KEY", requires = "m_sig_id")]
+    pub m_sig_key: Option<String>,
+
+    /// Message signature algorithm (RFC 9421).
+    ///
+    /// Supported algorithms: hmac-sha256, ed25519, ecdsa-p256-sha256,
+    /// ecdsa-p384-sha384, rsa-v1_5-sha256, rsa-pss-sha512.
+    #[arg(
+        long = "unstable-m-sig-alg",
+        value_name = "ALG",
+        requires = "m_sig_key"
+    )]
+    pub m_sig_alg: Option<MessageSignatureAlgorithm>,
+
+    /// Comma-separated list of message signature components (RFC 9421).
+    ///
+    /// If not specified, defaults to "@method, @authority, @target-uri".
+    /// This flag can be passed multiple times; values are appended in order.
+    /// "@query-params" is a shorthand for all query parameters.
+    /// "content-digest" is included if there's a body.
+    ///
+    /// Example: "@method,@path,content-digest"
+    #[arg(long = "unstable-m-sig-comp", value_name = "COMPONENTS")]
+    pub m_sig_comp: Vec<MessageSignatureComponents>,
+}
+
+#[allow(unused)]
+impl MessageSignature {
+    pub fn has_key_pair(&self) -> bool {
+        self.m_sig_id.is_some() && self.m_sig_key.is_some()
+    }
+
+    pub fn key_pair(&self) -> Option<(&str, &str)> {
+        Some((self.m_sig_id.as_deref()?, self.m_sig_key.as_deref()?))
+    }
+
+    pub fn algorithm(&self) -> Option<MessageSignatureAlgorithm> {
+        self.m_sig_alg
+    }
+
+    pub fn has_components(&self) -> bool {
+        self.m_sig_comp
+            .iter()
+            .any(|components| !components.0.is_empty())
+    }
+
+    pub fn flattened_components(&self) -> Vec<String> {
+        self.m_sig_comp
+            .iter()
+            .flat_map(|components| components.0.iter().cloned())
+            .collect()
+    }
+}
+
+#[derive(Debug, Clone)]
+pub struct MessageSignatureComponents(pub Vec<String>);
+
+impl FromStr for MessageSignatureComponents {
+    type Err = std::convert::Infallible;
+    fn from_str(s: &str) -> Result<Self, Self::Err> {
+        let components = s
+            .split(',')
+            .map(|s| {
+                let component = s.trim();
+                if let Some(idx) = component.find(';') {
+                    let (name, params) = component.split_at(idx);
+                    format!("{}{}", name.to_lowercase(), params)
+                } else {
+                    component.to_lowercase()
+                }
+            })
+            .collect();
+        Ok(MessageSignatureComponents(components))
+    }
+}
+
+#[derive(ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
+pub enum MessageSignatureAlgorithm {
+    #[clap(name = "hmac-sha256")]
+    HmacSha256,
+    #[clap(name = "ed25519")]
+    Ed25519,
+    #[clap(name = "ecdsa-p256-sha256")]
+    EcdsaP256Sha256,
+    #[clap(name = "ecdsa-p384-sha384")]
+    EcdsaP384Sha384,
+    #[clap(name = "rsa-v1_5-sha256")]
+    RsaV15Sha256,
+    #[clap(name = "rsa-pss-sha512")]
+    RsaPssSha512,
+}
+
+#[cfg(feature = "message-signatures")]
+impl From<MessageSignatureAlgorithm> for httpsig_hyper::prelude::AlgorithmName {
+    fn from(value: MessageSignatureAlgorithm) -> Self {
+        match value {
+            MessageSignatureAlgorithm::HmacSha256 => Self::HmacSha256,
+            MessageSignatureAlgorithm::Ed25519 => Self::Ed25519,
+            MessageSignatureAlgorithm::EcdsaP256Sha256 => Self::EcdsaP256Sha256,
+            MessageSignatureAlgorithm::EcdsaP384Sha384 => Self::EcdsaP384Sha384,
+            MessageSignatureAlgorithm::RsaV15Sha256 => Self::RsaV1_5Sha256,
+            MessageSignatureAlgorithm::RsaPssSha512 => Self::RsaPssSha512,
+        }
+    }
+}
+
 #[derive(ValueEnum, Debug, Clone)]
 pub enum TlsVersion {
     // ssl2.3 is not a real version but it's how HTTPie spells "auto"
@@ -1711,6 +1833,44 @@ mod tests {
         )
     }
 
+    #[test]
+    fn parse_repeated_message_signature_components() {
+        let cli = parse([
+            "--unstable-m-sig-id=my-key",
+            "--unstable-m-sig-key=secret",
+            "--unstable-m-sig-comp=@method,@path",
+            "--unstable-m-sig-comp=date",
+            "get",
+            "example.org",
+        ])
+        .unwrap();
+
+        assert_eq!(cli.m_sig.m_sig_comp.len(), 2);
+        assert_eq!(cli.m_sig.m_sig_comp[0]
```

**File**: `src/main.rs` (modified, +46/-1)
```diff
@@ -8,6 +8,8 @@ mod download;
 mod error_reporting;
 mod formatting;
 mod generation;
+#[cfg(feature = "message-signatures")]
+mod message_signature;
 mod middleware;
 mod nested_json;
 mod netrc;
@@ -579,6 +581,37 @@ fn run(args: Cli) -> Result<ExitCode> {
             request.headers_mut().remove(header);
         }
 
+        #[cfg(not(feature = "message-signatures"))]
+        if args.m_sig.m_sig_id.is_some()
+            || args.m_sig.m_sig_key.is_some()
+            || args.m_sig.m_sig_alg.is_some()
+            || args.m_sig.has_components()
+        {
+            return Err(anyhow!(
+                "This binary was built without message signature support. Enable the `message-signatures` feature."
+            ));
+        }
+
+        #[cfg(feature = "message-signatures")]
+        if args.m_sig.has_components() && !args.m_sig.has_key_pair() {
+            return Err(anyhow!(
+                "Message signature components require both --unstable-m-sig-id and --unstable-m-sig-key."
+            ));
+        }
+
+        #[cfg(feature = "message-signatures")]
+        if let Some((key_id, key_material)) = args.m_sig.key_pair() {
+            let m_sig_components = args.m_sig.flattened_components();
+            let m_sig_algorithm = args.m_sig.algorithm().map(Into::into);
+            message_signature::sign_request(
+                &mut request,
+                key_id,
+                key_material,
+                (!m_sig_components.is_empty()).then_some(m_sig_components.as_slice()),
+                m_sig_algorithm,
+            )?;
+        }
+
         request
     };
 
@@ -658,7 +691,19 @@ fn run(args: Cli) -> Result<ExitCode> {
                 });
             }
             if args.follow {
-                client = client.with(RedirectFollower::new(args.max_redirects.unwrap_or(10)));
+                #[cfg(feature = "message-signatures")]
+                {
+                    let message_signature = args.m_sig.has_key_pair().then_some(args.m_sig.clone());
+
+                    client = client.with(RedirectFollower::new(
+                        args.max_redirects.unwrap_or(10),
+                        message_signature,
+                    ));
+                }
+                #[cfg(not(feature = "message-signatures"))]
+                {
+                    client = client.with(RedirectFollower::new(args.max_redirects.unwrap_or(10)));
+                }
             }
             if let Some(Auth::Digest(username, password)) = &auth {
                 client = client.with(DigestAuthMiddleware::new(username, password));
```

**File**: `src/message_signature.rs` (added, +637/-0)
```diff
@@ -0,0 +1,637 @@
+use std::collections::HashSet;
+
+use anyhow::{anyhow, bail, Context, Result};
+use base64::{engine::general_purpose::STANDARD, Engine as _};
+use httpsig_hyper::prelude::{
+    message_component::{HttpMessageComponentId, HttpMessageComponentName},
+    AlgorithmName, HttpSigResult, HttpSignatureParams, SecretKey, SharedKey, SigningKey,
+};
+use hyper::http;
+use reqwest::blocking::{Body as ReqwestBody, Request};
+use reqwest::header::{HeaderName, HeaderValue};
+use sha2::{Digest, Sha256};
+
+pub fn sign_request(
+    request: &mut Request,
+    key_id: &str,
+    key_material: &str,
+    components: Option<&[String]>,
+    algorithm_override: Option<AlgorithmName>,
+) -> Result<()> {
+    let key = parse_key_input(key_material)?;
+
+    let (signing_key, algorithm) = build_signing_key(&key, key_id, algorithm_override)?;
+
+    let components = resolve_components(request, components);
+    ensure_content_digest(request, &components)?;
+
+    let mut signature_params = build_signature_params(&components)?;
+    signature_params.set_alg(&algorithm);
+
+    // Ensure keyid is included in Signature-Input
+    signature_params.set_keyid(key_id);
+
+    // Preferred path: use upstream sync signing helper.
+    let mut http_request = http::Request::builder()
+        .version(request.version())
+        .method(request.method())
+        .uri(request.url().as_str())
+        .body(reqwest::Body::default())
+        .context("message-signature: Failed to build temporary HTTP request")?;
+    *http_request.headers_mut() = request.headers().clone();
+
+    use httpsig_hyper::MessageSignatureReqSync;
+    http_request
+        .set_message_signature_sync(&signature_params, &signing_key, Some("sig1"))
+        .context("message-signature: Failed to set message signature")?;
+
+    let signature = http_request
+        .headers()
+        .get("signature")
+        .context("message-signature: Signature header missing after signing")?;
+    let signature_input = http_request
+        .headers()
+        .get("signature-input")
+        .context("message-signature: Signature-Input header missing after signing")?;
+
+    request
+        .headers_mut()
+        .insert(HeaderName::from_static("signature"), signature.clone());
+    request.headers_mut().insert(
+        HeaderName::from_static("signature-input"),
+        signature_input.clone(),
+    );
+    Ok(())
+}
+
+/// Resolves and expands message components for signature coverage.
+///
+/// This function handles:
+/// - Default components: If no components are specified, uses @method, @authority, @target-uri
+/// - @query-params expansion: Expands into individual @query-param components for each parameter
+/// - content-digest: Only includes if the request has a body
+///
+/// Note: @query-params is not a standard RFC 9421 component, but is commonly used as a
+/// convenience shorthand to sign all query parameters without listing them individually.
+fn resolve_components(request: &Request, components: Option<&[String]>) -> Vec<String> {
+    let mut resolved = Vec::new();
+    let source = if let Some(c) = components {
+        c
+    } else {
+        // RFC 9421 recommended minimal set for request signing
+        &[
+            "@method".to_string(),
+            "@authority".to_string(),
+            "@target-uri".to_string(),
+        ] as &[String]
+    };
+
+    for component in source {
+        if component == "@query-params" {
+            // According to some conventions (and this implementation), "@query-params"
+            // acts as a wildcard that expands into individual "@query-param" components
+            // for every parameter present in the request's query string.
+            //
+            // RFC 9421 does not define "@query-params" as a standard derived component,
+            // but many implementations use it to simplify signing all query parameters
+            // without listing them explicitly.
+            if let Some(query) = request.url().query() {
+                let mut seen = HashSet::new();
+                for (name, _) in form_urlencoded::parse(query.as_bytes()) {
+                    if seen.insert(name.to_string()) {
+                        resolved.push(format!("@query-param;name=\"{}\"", name));
+                    }
+                }
+            }
+        } else if component == "content-digest" {
+            if request.body().is_some() {
+                resolved.push(component.clone());
+            }
+        } else {
+            resolved.push(component.clone());
+        }
+    }
+    resolved
+}
+
+/// Ensures the Content-Digest header is present if it's a covered component.
+///
+/// According to RFC 9530, the Content-Digest header uses the format:
+/// `sha-256=:<base64-encoded-hash>:`
+///
+/// This function:
+/// 1. Checks if "content-digest" is in the covered components
+/// 2. If yes and the header is missing, computes SHA-256 of the request body
+/// 3. Adds the Content-Digest heade
```

**File**: `src/redirect.rs` (modified, +56/-2)
```diff
@@ -6,16 +6,27 @@ use reqwest::header::{
 };
 use reqwest::{Method, StatusCode, Url};
 
+#[cfg(feature = "message-signatures")]
+use crate::cli::MessageSignature;
 use crate::middleware::{Context, Middleware};
 use crate::utils::{clone_request, HeaderValueExt};
 
 pub struct RedirectFollower {
     max_redirects: usize,
+    #[cfg(feature = "message-signatures")]
+    message_signature: Option<MessageSignature>,
 }
 
 impl RedirectFollower {
-    pub fn new(max_redirects: usize) -> Self {
-        RedirectFollower { max_redirects }
+    pub fn new(
+        max_redirects: usize,
+        #[cfg(feature = "message-signatures")] message_signature: Option<MessageSignature>,
+    ) -> Self {
+        RedirectFollower {
+            max_redirects,
+            #[cfg(feature = "message-signatures")]
+            message_signature,
+        }
     }
 }
 
@@ -36,6 +47,22 @@ impl Middleware for RedirectFollower {
                 }
                 .into());
             }
+
+            #[cfg(feature = "message-signatures")]
+            if let Some(signature) = &self.message_signature {
+                if let Some((key_id, key_material)) = signature.key_pair() {
+                    let components = signature.flattened_components();
+                    let algorithm = signature.algorithm().map(Into::into);
+                    crate::message_signature::sign_request(
+                        &mut next_request,
+                        key_id,
+                        key_material,
+                        (!components.is_empty()).then_some(components.as_slice()),
+                        algorithm,
+                    )?;
+                }
+            }
+
             log::info!("Following redirect to {}", next_request.url());
             log::trace!("Remaining redirects: {remaining_redirects}");
             log::trace!("{next_request:#?}");
@@ -87,6 +114,7 @@ fn get_next_request(mut request: Request, response: &Response) -> Option<Request
             if is_cross_domain_redirect(&next_url, prev_url) {
                 remove_sensitive_headers(request.headers_mut());
             }
+            remove_signature_headers(request.headers_mut());
             remove_content_headers(request.headers_mut());
             *request.url_mut() = next_url;
             *request.body_mut() = None;
@@ -104,6 +132,7 @@ fn get_next_request(mut request: Request, response: &Response) -> Option<Request
             if is_cross_domain_redirect(&next_url, prev_url) {
                 remove_sensitive_headers(request.headers_mut());
             }
+            remove_signature_headers(request.headers_mut());
             *request.url_mut() = next_url;
             Some(request)
         }
@@ -134,4 +163,29 @@ fn remove_content_headers(headers: &mut HeaderMap) {
     headers.remove(CONTENT_ENCODING);
     headers.remove(CONTENT_TYPE);
     headers.remove(CONTENT_LENGTH);
+    headers.remove("content-digest");
+}
+
+fn remove_signature_headers(headers: &mut HeaderMap) {
+    log::debug!("Removing signature headers before redirect");
+    headers.remove("signature");
+    headers.remove("signature-input");
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use reqwest::header::HeaderValue;
+
+    #[test]
+    fn remove_content_headers_removes_content_digest() {
+        let mut headers = HeaderMap::new();
+        headers.insert(CONTENT_LENGTH, HeaderValue::from_static("1"));
+        headers.insert("content-digest", HeaderValue::from_static("sha-256=:abc=:"));
+
+        remove_content_headers(&mut headers);
+
+        assert!(!headers.contains_key(CONTENT_LENGTH));
+        assert!(!headers.contains_key("content-digest"));
+    }
 }
```

**File**: `src/session.rs` (modified, +1/-1)
```diff
@@ -241,7 +241,7 @@ impl Session {
                     let (username, password) = auth::parse_auth(raw_auth, "")?;
                     Ok(Some(auth::Auth::Digest(
                         username,
-                        password.unwrap_or_else(|| "".into()),
+                        password.unwrap_or_default(),
                     )))
                 }
                 "bearer" => Ok(Some(auth::Auth::Bearer(raw_auth.into()))),
```

**File**: `src/to_curl.rs` (modified, +8/-0)
```diff
@@ -97,6 +97,14 @@ pub fn translate(args: Cli) -> Result<Command> {
         // No equivalent
         (args.style.is_some(), "-s/--style"),
         // No equivalent
+        (args.m_sig.m_sig_id.is_some(), "--unstable-m-sig-id"),
+        // No equivalent
+        (args.m_sig.m_sig_key.is_some(), "--unstable-m-sig-key"),
+        // No equivalent
+        (args.m_sig.m_sig_alg.is_some(), "--unstable-m-sig-alg"),
+        // No equivalent
+        (args.m_sig.has_components(), "--unstable-m-sig-comp"),
+        // No equivalent
         (args.compress > 0, "-x/--compress"),
         // No equivalent
         (args.response_charset.is_some(), "--response-charset"),
```

---

### Incident Patch 12: `2befed19` (2026-01-19)
**Commit Message**: Fix IPv6 authority formatting in message signatures

**File**: `src/message_signature.rs` (modified, +17/-1)
```diff
@@ -309,7 +309,14 @@ fn gather_derived_component_values(
 fn compute_authority(url: &Url) -> String {
     // According to RFC 9421 Section 2.2.3, the "@authority" derived component
     // consists of the host and, if present and non-default, the port number.
-    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
+    // IPv6 literals must be wrapped in brackets to match URI authority syntax (RFC 3986),
+    // which RFC 9421 relies on for @authority formatting.
+    let host = match url.host() {
+        Some(url::Host::Domain(domain)) => domain.to_ascii_lowercase(),
+        Some(url::Host::Ipv4(addr)) => addr.to_string(),
+        Some(url::Host::Ipv6(addr)) => format!("[{addr}]"),
+        None => String::new(),
+    };
     if let Some(port) = url.port() {
         if Some(port) != default_port_for_scheme(url.scheme()) {
             return format!("{host}:{port}");
@@ -527,6 +534,15 @@ mod tests {
         assert_eq!(values, vec!["?bar=baz"]);
     }
 
+    #[test]
+    fn test_authority_ipv6_brackets() {
+        let url = Url::parse("http://[::1]:8080/").unwrap();
+        assert_eq!(compute_authority(&url), "[::1]:8080");
+
+        let default_port_url = Url::parse("http://[::1]/").unwrap();
+        assert_eq!(compute_authority(&default_port_url), "[::1]");
+    }
+
     #[test]
     fn test_sign_request_with_query_param() {
         let mut req = Client::new()
```

**File**: `tests/cases/auth_message_signature.rs` (modified, +70/-7)
```diff
@@ -1,4 +1,5 @@
 use crate::{get_command, server};
+use base64::engine::general_purpose::STANDARD;
 use httpsig_hyper::prelude::*;
 use httpsig_hyper::HyperSigError;
 
@@ -15,7 +16,7 @@ fn message_signature_verification_on_server() {
         async move {
             // 1. Prepare the verification key (HMAC SHA256)
             use base64::Engine;
-            let key_base64 = base64::engine::general_purpose::STANDARD.encode(key_material_inner);
+            let key_base64 = STANDARD.encode(key_material_inner);
             let shared_key = SharedKey::from_base64(&key_base64).unwrap();
 
             // 2. Verify the request using extension trait provided by httpsig-hyper
@@ -75,7 +76,7 @@ fn message_signature_auth_defaults() {
 
             // Verify the signature
             use base64::Engine;
-            let key_base64 = base64::engine::general_purpose::STANDARD.encode(&key_inner);
+            let key_base64 = STANDARD.encode(&key_inner);
             let shared_key = SharedKey::from_base64(&key_base64).unwrap();
             use httpsig_hyper::MessageSignatureReq;
             let result = req
@@ -104,6 +105,68 @@ fn message_signature_auth_defaults() {
         .stdout(predicates::str::contains("Signature-Input: sig1="));
 }
 
+#[test]
+fn message_signature_auth_ipv6_authority() {
+    let key = KEY_MATERIAL;
+    let key_id = "my-key";
+
+    let server = match server::http_v6(move |mut req| {
+        let key_inner = key.to_string();
+        let key_id_inner = key_id.to_string();
+        async move {
+            // Reconstruct absolute URI for verification of @target-uri and @authority
+            if let Some(host) = req.headers().get("host") {
+                let host_str = host.to_str().unwrap();
+                let uri_string = format!("http://{}{}", host_str, req.uri());
+                *req.uri_mut() = uri_string.parse().unwrap();
+            }
+
+            assert_eq!(req.method(), "GET");
+            assert!(req.headers().contains_key("Signature"));
+            assert!(req.headers().contains_key("Signature-Input"));
+
+            // Verify the signature
+            use base64::Engine;
+            let key_base64 = STANDARD.encode(&key_inner);
+            let shared_key = SharedKey::from_base64(&key_base64).unwrap();
+            use httpsig_hyper::MessageSignatureReq;
+            let result = req
+                .verify_message_signature(&shared_key, Some(&key_id_inner))
+                .await;
+            assert!(
+                result.is_ok(),
+                "Signature verification failed: {:?}",
+                result.err()
+            );
+
+            hyper::Response::default()
+        }
+    }) {
+        Some(server) => server,
+        None => {
+            eprintln!("IPv6 not available; skipping test");
+            return;
+        }
+    };
+
+    let host = server.host();
+    let url = if host.contains(':') {
+        format!("http://[{host}]:{}", server.port())
+    } else {
+        format!("http://{host}:{}", server.port())
+    };
+    let mut cmd = get_command();
+    cmd.arg("--unstable-m-sig-id=my-key")
+        .arg(format!("--unstable-m-sig-key={}", key))
+        .arg("-v")
+        .arg("get")
+        .arg(url)
+        .assert()
+        .success()
+        .stdout(predicates::str::contains("Signature: sig1="))
+        .stdout(predicates::str::contains("Signature-Input: sig1="));
+}
+
 #[test]
 fn message_signature_auth_with_custom_components_and_digest() {
     let key = KEY_MATERIAL;
@@ -134,7 +197,7 @@ fn message_signature_auth_with_custom_components_and_digest() {
 
             // Verify the signature
             use base64::Engine;
-            let key_base64 = base64::engine::general_purpose::STANDARD.encode(&key_inner);
+            let key_base64 = STANDARD.encode(&key_inner);
             let shared_key = SharedKey::from_base64(&key_base64).unwrap();
             use httpsig_hyper::MessageSignatureReq;
             let result = req
@@ -188,7 +251,7 @@ fn message_signature_auth_with_multiple_set_cookie() {
 
             // Verify the signature
             use base64::Engine;
-            let key_base64 = base64::engine::general_purpose::STANDARD.encode(&key_inner);
+            let key_base64 = STANDARD.encode(&key_inner);
             let shared_key = SharedKey::from_base64(&key_base64).unwrap();
             use httpsig_hyper::MessageSignatureReq;
             let result = req
@@ -233,7 +296,7 @@ fn message_signature_auth_sf_parameter() {
 
             // Verify the signature
             use base64::Engine;
-            let key_base64 = base64::engine::general_purpose::STANDARD.encode(&key_inner);
+            let key_base64 = STANDARD.encode(&key_inner);
             let shared_key = SharedKey::from_base64(&key_base64).unwrap();
             use httpsig_hyper::MessageSignatureReq;
             let result = req
@@ -276,7 +339,7 @@ fn message_signature_auth_key_parameter() {
 
             // Verify the signature
        
```

**File**: `tests/server/mod.rs` (modified, +56/-7)
```diff
@@ -36,23 +36,42 @@ pub struct Server {
 impl Server {
     pub fn base_url(&self) -> String {
         match &*self.listener {
-            Listener::TcpListener(l) => format!("http://{}", l.local_addr().unwrap()),
+            Listener::TcpListener(l) => {
+                let addr = l.local_addr().unwrap();
+                match addr.ip() {
+                    std::net::IpAddr::V6(_) => format!("http://[{}]:{}", addr.ip(), addr.port()),
+                    std::net::IpAddr::V4(_) => format!("http://{}:{}", addr.ip(), addr.port()),
+                }
+            }
             #[cfg(unix)]
             _ => panic!("no base_url for unix server"),
         }
     }
 
     pub fn url(&self, path: &str) -> String {
         match &*self.listener {
-            Listener::TcpListener(l) => format!("http://{}{}", l.local_addr().unwrap(), path),
+            Listener::TcpListener(l) => {
+                let addr = l.local_addr().unwrap();
+                match addr.ip() {
+                    std::net::IpAddr::V6(_) => {
+                        format!("http://[{}]:{}{}", addr.ip(), addr.port(), path)
+                    }
+                    std::net::IpAddr::V4(_) => {
+                        format!("http://{}:{}{}", addr.ip(), addr.port(), path)
+                    }
+                }
+            }
             #[cfg(unix)]
             _ => panic!("no url for unix server"),
         }
     }
 
     pub fn host(&self) -> String {
         match &*self.listener {
-            Listener::TcpListener(_) => String::from("127.0.0.1"),
+            Listener::TcpListener(l) => match l.local_addr().unwrap().ip() {
+                std::net::IpAddr::V6(addr) => addr.to_string(),
+                std::net::IpAddr::V4(addr) => addr.to_string(),
+            },
             #[cfg(unix)]
             _ => panic!("no host for unix server"),
         }
@@ -124,7 +143,11 @@ where
     F: Fn(Request<hyper::body::Incoming>) -> Fut + Send + Sync + 'static,
     Fut: Future<Output = Response<Body>> + Send + 'static,
 {
-    http_inner(Arc::new(move |req| Box::new(Box::pin(func(req)))), false)
+    http_inner(
+        Arc::new(move |req| Box::new(Box::pin(func(req)))),
+        false,
+        None,
+    )
 }
 
 #[cfg(unix)]
@@ -133,13 +156,38 @@ where
     F: Fn(Request<hyper::body::Incoming>) -> Fut + Send + Sync + 'static,
     Fut: Future<Output = Response<Body>> + Send + 'static,
 {
-    http_inner(Arc::new(move |req| Box::new(Box::pin(func(req)))), true)
+    http_inner(
+        Arc::new(move |req| Box::new(Box::pin(func(req)))),
+        true,
+        None,
+    )
+}
+
+pub fn http_v6<F, Fut>(func: F) -> Option<Server>
+where
+    F: Fn(Request<hyper::body::Incoming>) -> Fut + Send + Sync + 'static,
+    Fut: Future<Output = Response<Body>> + Send + 'static,
+{
+    let addr = std::net::SocketAddr::from((std::net::Ipv6Addr::LOCALHOST, 0));
+    if std::net::TcpListener::bind(addr).is_err() {
+        return None;
+    }
+
+    Some(http_inner(
+        Arc::new(move |req| Box::new(Box::pin(func(req)))),
+        false,
+        Some(addr),
+    ))
 }
 
 type Serv = dyn Fn(Request<hyper::body::Incoming>) -> Box<ServFut> + Send + Sync;
 type ServFut = dyn Future<Output = Response<Body>> + Send + Unpin;
 
-fn http_inner(func: Arc<Serv>, use_unix_socket: bool) -> Server {
+fn http_inner(
+    func: Arc<Serv>,
+    use_unix_socket: bool,
+    addr: Option<std::net::SocketAddr>,
+) -> Server {
     // Spawn new runtime in thread to prevent reactor execution context conflict
     thread::spawn(move || {
         let rt = runtime::Builder::new_current_thread()
@@ -163,7 +211,8 @@ fn http_inner(func: Arc<Serv>, use_unix_socket: bool) -> Server {
                         .unwrap()
                 }
             } else {
-                tokio::net::TcpListener::bind(&std::net::SocketAddr::from(([127, 0, 0, 1], 0)))
+                let addr = addr.unwrap_or(std::net::SocketAddr::from(([127, 0, 0, 1], 0)));
+                tokio::net::TcpListener::bind(&addr)
                     .await
                     .map(Listener::TcpListener)
                     .unwrap()
```

---

### Incident Patch 13: `751c3e9d` (2025-12-16)
**Commit Message**: fix release.yaml

**File**: `.github/workflows/release.yaml` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ jobs:
         if: matrix.job.os != 'windows-latest'
         run: |
           if [ "${{ matrix.job.binutils }}" != "" ]; then
+            sudo apt update
             sudo apt -y install "binutils-${{ matrix.job.binutils }}"
             "${{ matrix.job.binutils }}-strip" "target/${{ matrix.job.target }}/release/xh"
           else
```

---

### Incident Patch 14: `1d7665f1` (2025-12-16)
**Commit Message**: fix failing tests

**File**: `tests/cli.rs` (modified, +19/-7)
```diff
@@ -3199,34 +3199,46 @@ fn warns_if_config_is_invalid() {
 #[test]
 fn http1_0() {
     get_command()
-        .args(["--print=hH", "--http-version=1.0", "https://example.com"])
+        .args([
+            "--print=hH",
+            "--http-version=1.0",
+            "https://httpbingo.org/json",
+        ])
         .assert()
         .success()
-        .stdout(contains("GET / HTTP/1.0"))
+        .stdout(contains("GET /json HTTP/1.0"))
         // Some servers i.e nginx respond with HTTP/1.1 to HTTP/1.0 requests, see https://serverfault.com/questions/442960/nginx-ignoring-clients-http-1-0-request-and-respond-by-http-1-1
-        // Fortunately, https://example.com is not one of those.
+        // Fortunately, https://httpbingo.org is not one of those.
         .stdout(contains("HTTP/1.0 200 OK"));
 }
 
 #[cfg(feature = "online-tests")]
 #[test]
 fn http1_1() {
     get_command()
-        .args(["--print=hH", "--http-version=1.1", "https://example.com"])
+        .args([
+            "--print=hH",
+            "--http-version=1.1",
+            "https://httpbingo.org/json",
+        ])
         .assert()
         .success()
-        .stdout(contains("GET / HTTP/1.1"))
+        .stdout(contains("GET /json HTTP/1.1"))
         .stdout(contains("HTTP/1.1 200 OK"));
 }
 
 #[cfg(feature = "online-tests")]
 #[test]
 fn http2() {
     get_command()
-        .args(["--print=hH", "--http-version=2", "https://example.com"])
+        .args([
+            "--print=hH",
+            "--http-version=2",
+            "https://httpbingo.org/json",
+        ])
         .assert()
         .success()
-        .stdout(contains("GET / HTTP/2.0"))
+        .stdout(contains("GET /json HTTP/2.0"))
         .stdout(contains("HTTP/2.0 200 OK"));
 }
 
```

---

### Incident Patch 15: `7e073979` (2025-12-16)
**Commit Message**: fix use of deprecated function from assert_cmd

**File**: `tests/cli.rs` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ fn find_runner() -> Option<String> {
 
 fn get_base_command() -> Command {
     let mut cmd;
-    let path = assert_cmd::cargo::cargo_bin("xh");
+    let path = assert_cmd::cargo::cargo_bin!("xh");
     if let Some(runner) = find_runner() {
         let mut runner = runner.split_whitespace();
         cmd = Command::new(runner.next().unwrap());
```

#### Recent Merged Pull Requests:
- **PR #491** (closed): fix: omit internal positional args from Nushell completions (@Mathjk)
- **PR #490** (closed): docs: clarify that timeout also covers reads and writes (@Likio3000)
- **PR #489** (2026-09-05): Buffer session file writes (@AkshayDhola)
- **PR #487** (2026-09-04): Detect and error on incomplete downloads (@AkshayDhola)
- **PR #486** (closed): Drop required positionals from Nushell completions (@cestercian)
- **PR #485** (closed): Add --chunked flag for chunked request transfer encoding (@ChrisJr404)
- **PR #482** (closed): ci: add native Windows ARM64 release (@meop)
- **PR #481** (closed): fix: only set a JSON Content-Type when there is a body (@VXNCXNX)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
