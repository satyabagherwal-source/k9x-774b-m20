# Forensic Learning Record (Deep Inspection): chmln/sd

> **Canonical Artifact**: `07_PROJECT_LEARNING/chmln-sd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chmln/sd](https://github.com/chmln/sd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:41:57.574Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chmln/sd`
- **Description**: Intuitive find & replace CLI (sed alternative)
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7377 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sd-cli/src/cli.rs`
```
use clap::Parser;

#[derive(Parser, Debug)]
#[command(
    name = "sd",
    author,
    version,
    about,
    max_term_width = 100,
    help_template = "\
{before-help}{name} v{version}
{about-with-newline}
{usage-heading} {usage}

{all-args}{after-help}"
)]
pub struct Options {
    #[arg(short, long)]
    /// Display changes in a human reviewable format (the specifics of the
    /// format are likely to change in the future).
    pub preview: bool,

    #[arg(
        short = 'F',
        long = "fixed-strings",
        short_alias = 's',
        alias = "string-mode"
    )]
    /// Treat FIND and REPLACE_WITH args as literal strings
    pub literal_mode: bool,

    #[arg(
        short = 'n',
        long = "max-replacements",
        value_name = "LIMIT",
        default_value_t
    )]
    /// Limit the number of replacements that can occur per file. 0 indicates
    /// unlimited replacements.
    pub replacements: usize,

    #[arg(short, long, verbatim_doc_comment)]
    #[rustfmt::skip]
    /** Regex flags. May be combined (like `-f mc`).

c - case-sensitive

e - disable multi-line matching

i - case-insensitive

m - multi-line matching

s - make `.` match newlines

w - match full words only
    */
    pub flags: Option<String>,

    #[arg(short = 'A', long = "across")]
    /// Process each input as a whole rather than line by line. This allows
    /// patterns to match across line boundaries but uses more memory and
    /// prevents streaming.
    pub across: bool,

    /// The regexp or string (if using `-F`) to search for.
    pub find: String,

    /// What to replace each match with. Unless in string mode, you may
    /// use captured values like $1, $2, etc.
    pub replace_with: String,

    /// The path to file(s). This is optional - sd can also read from STDIN.
    ///
    /// Note: sd modifies files in-place by default. See documentation for
    /// examples.
    pub files: Vec<std::path::PathBuf>,
}

#[cfg(test)]
mod tests {
    use super::*;

    use clap::CommandFactory;

    #[test]
    fn debug_assert() {
        let cmd = Options::command();
        cmd.debug_assert();
    }
}

```

### Core Architecture Module: `sd-cli/src/main.rs`
```
mod cli;

use clap::Parser;
use std::{io::stdout, process};

use sd::{Replacer, Result, Source, process_sources};

fn main() {
    if let Err(e) = try_main() {
        eprintln!("error: {e}");
        process::exit(1);
    }
}

fn try_main() -> Result<()> {
    let options = cli::Options::parse();

    let replacer = Replacer::new(
        options.find,
        options.replace_with,
        options.literal_mode,
        options.flags,
        options.replacements,
    )?;

    let sources = if !options.files.is_empty() {
        Source::from_paths(options.files)
    } else {
        Ok(Source::from_stdin())
    };
    let sources = sources?;

    let mut handle = stdout().lock();
    process_sources(
        &replacer,
        &sources,
        options.preview,
        !options.across,
        &mut handle,
    )
}

```

### Core Architecture Module: `sd/src/error.rs`
```
use std::{fmt, path::PathBuf};

use crate::replacer::InvalidReplaceCapture;

#[derive(thiserror::Error)]
pub enum Error {
    #[error("invalid regex {0}")]
    Regex(#[from] regex::Error),
    #[error(transparent)]
    File(#[from] std::io::Error),
    #[error("failed to move file: {0}")]
    TempfilePersist(#[from] tempfile::PersistError),
    #[error("invalid path: {0}")]
    InvalidPath(PathBuf),
    #[error("{0}")]
    InvalidReplaceCapture(#[from] InvalidReplaceCapture),
    #[error("{0}")]
    FailedJobs(FailedJobs),
}

// pretty-print the error
impl fmt::Debug for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self)
    }
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

pub struct FailedJobs(pub Vec<(PathBuf, Error)>);

impl fmt::Display for FailedJobs {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Failed processing some inputs\n")?;
        for (source, error) in &self.0 {
            writeln!(f, "    {}: {}", source.display(), error)?;
        }

        Ok(())
    }
}

impl fmt::Debug for FailedJobs {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self)
    }
}

```

### Core Architecture Module: `sd/src/input.rs`
```
use std::{
    fs::File,
    io::{BufRead, BufReader, Read, stdin},
    path::PathBuf,
};

use crate::error::{Error, Result};

#[derive(Debug, PartialEq)]
pub enum Source {
    Stdin,
    File(PathBuf),
}

impl Source {
    pub fn from_paths(paths: Vec<PathBuf>) -> Result<Vec<Self>> {
        paths
            .into_iter()
            .map(|path| {
                if path.exists() {
                    Ok(Source::File(path))
                } else {
                    Err(Error::InvalidPath(path.clone()))
                }
            })
            .collect()
    }

    pub fn from_stdin() -> Vec<Self> {
        vec![Self::Stdin]
    }

    pub fn display(&self) -> String {
        match self {
            Self::Stdin => "STDIN".to_string(),
            Self::File(path) => format!("FILE {}", path.display()),
        }
    }
}

pub fn open_source(source: &Source) -> Result<Box<dyn BufRead + '_>> {
    match source {
        Source::File(path) => {
            let file = File::open(path)?;
            Ok(Box::new(BufReader::new(file)))
        }
        Source::Stdin => {
            let stdin = stdin().lock();
            Ok(Box::new(BufReader::new(stdin)))
        }
    }
}

pub fn read_source(source: &Source) -> Result<Vec<u8>> {
    let mut handle = open_source(source)?;
    let mut buf = Vec::new();
    handle.read_to_end(&mut buf)?;
    Ok(buf)
}

```

### Core Architecture Module: `sd/src/lib.rs`
```
mod error;
mod input;
pub mod replacer;
mod unescape;

use std::{
    fs,
    io::{BufRead, BufWriter, Read, Write},
    path::PathBuf,
};

pub use self::error::{Error, FailedJobs, Result};
pub use self::input::{Source, open_source, read_source};
pub use self::replacer::Replacer;

/// Core processing function that handles file replacement
pub fn process_sources(
    replacer: &Replacer,
    sources: &[Source],
    preview: bool,
    line_by_line: bool,
    output_writer: &mut dyn Write,
) -> Result<()> {
    if line_by_line {
        return process_sources_line_by_line(
            replacer,
            sources,
            preview,
            output_writer,
        );
    }

    let mut inputs = Vec::new();
    for source in sources.iter() {
        let input = match source {
            Source::File(path) => {
                if path.exists() {
                    read_source(source)?
                } else {
                    return Err(Error::InvalidPath(path.to_owned()));
                }
            }
            Source::Stdin => read_source(source)?,
        };

        inputs.push(input);
    }

    let needs_separator = sources.len() > 1;

    let replaced: Vec<_> = {
        use rayon::prelude::*;
        inputs
            .par_iter()
            .map(|input| replacer.replace(input))
            .collect()
    };

    if preview || sources.first() == Some(&Source::Stdin) {
        for (source, replaced) in sources.iter().zip(replaced) {
            if needs_separator {
                writeln!(output_writer, "----- {} -----", source.display())?;
            }
            output_writer.write_all(&replaced)?;
        }
    } else {
        let mut failed_jobs = Vec::new();
        for (source, replaced) in sources.iter().zip(replaced) {
            match source {
                Source::File(path) => {
                    if let Err(e) = write_with_temp(path, &replaced) {
                        failed_jobs.push((path.to_owned(), e));
                    }
                }
                _ => unreachable!("stdin should go previous branch"),
            }
        }
        if !failed_jobs.is_empty() {
            return Err(Error::FailedJobs(FailedJobs(failed_jobs)));
        }
    }

    Ok(())
}

fn process_sources_line_by_line(
    replacer: &Replacer,
    sources: &[Source],
    preview: bool,
    output_writer: &mut dyn Write,
) -> Result<()> {
    let needs_separator = sources.len() > 1;

    if preview || sources.first() == Some(&Source::Stdin) {
        for source in sources {
            if needs_separator {
                writeln!(output_writer, "----- {} -----", source.display())?;
            }
            let reader = open_source(source)?;
            process_reader_line_by_line(replacer, reader, output_writer)?;
        }
    } else {
        // Pre-validate all files before modifying any, matching the
        // whole-file processing path which opens all inputs upfront.
        for source in sources {
            match source {
                Source::File(path) => {
                    if !path.exists() {
                        return Err(Error::InvalidPath(path.to_owned()));
                    }
                    std::fs::File::open(path)?;
                }
                _ => unreachable!("stdin should go previous branch"),
            }
        }

        let mut failed_jobs = Vec::new();
        for source in sources {
            match source {
                Source::File(path) => {
                    if let Err(e) = write_file_line_by_line(replacer, path) {
                        failed_jobs.push((path.to_owned(), e));
                    }
                }
                _ => unreachable!("stdin should go previous branch"),
            }
        }
        if !failed_jobs.is_empty() {
            return Err(Error::FailedJobs(FailedJobs(failed_jobs)));
        }
    }

    Ok(())
}

fn process_reader_line_by_line(
    replacer: &Replacer,
    mut reader: Box<dyn BufRead + '_>,
    writer: &mut dyn Write,
) -> Result<()> {
    const CHUNK_SIZE: usize = 8192;

    let mut chunk = vec![0u8; CHUNK_SIZE];
    let mut line = Vec::with_capacity(256);

    loop {
        let n = reader.read(&mut chunk)?;
        if n == 0 {
            // Finish any remaining line
            if !line.is_empty() {
                let replaced = replacer.replace(&line);
                writer.write_all(&replaced)?;
            }
            break;
        }

        let mut start = 0;
        for (i, &byte) in chunk[..n].iter().enumerate() {
            if byte == b'\n' {
                // Found a complete line
                line.extend_from_slice(&chunk[start..i]);
                let replaced = replacer.replace(&line);
                writer.write_all(&replaced)?;
                writer.write_all(b"\n")?;
                line.clear();
                start = i + 1;
            }
        }

        // Keep partial line for next chunk
        if start < n {
            line.extend_from_slice(&chunk[start..n]);
        }
    }

    Ok(())
}

fn write_file_line_by_line(replacer: &Replacer, path: &PathBuf) -> Result<()> {
    let canonical = fs::canonicalize(path)?;

    let temp = tempfile::NamedTempFile::new_in(
        canonical
            .parent()
            .ok_or_else(|| Error::InvalidPath(canonical.to_path_buf()))?,
    )?;

    if let Ok(metadata) = fs::metadata(&canonical) {
        temp.as_file().set_permissions(metadata.permissions()).ok();
    }

    {
        let source = Source::File(path.clone());
        let reader = open_source(&source)?;
        let mut writer = BufWriter::new(temp.as_file());
        process_reader_line_by_line(replacer, reader, &mut writer)?;
        writer.flush()?;
    }

    temp.persist(&canonical)?;

    Ok(())
}

fn write_with_temp(path: &PathBuf, data: &[u8]) -> Result<()> {
    let path = fs::canonicalize(path)?;

    let mut temp = tempfile::NamedTempFile::new_in(
        path.parent()
            .ok_or_else(|| Error::InvalidPath(path.to_path_buf()))?,
    )?;

    let file = temp.as_file();
    file.set_len(data.len() as u64)?;
    if let Ok(metadata) = fs::metadata(&path) {
        file.set_permissions(metadata.permissions()).ok();
    }

    if !data.is_empty() {
        temp.as_file_mut().write_all(data)?;
        temp.as_file_mut().flush()?;
    }

    temp.persist(&path)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_process_sources_with_preview() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        std::fs::write(&file_path, "abc123def").unwrap();

        let replacer =
            Replacer::new("abc".into(), "xyz".into(), false, None, 0)?;
        let sources = vec![Source::File(file_path)];
        let mut output = Vec::new();

        process_sources(&replacer, &sources, true, false, &mut output)?;

        let result = String::from_utf8(output).unwrap();
        assert_eq!(result, "xyz123def");

        Ok(())
    }

    #[test]
    fn test_process_sources_in_place() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        std::fs::write(&file_path, "abc123def").unwrap();

        let replacer =
            Replacer::new("abc".into(), "xyz".into(), false, None, 0)?;
        let sources = vec![Source::File(file_path.clone())];
        let mut output = Vec::new();

        process_sources(&replacer, &sources, false, false, &mut output)?;

        let result = std::fs::read_to_string(&file_path).unwrap();
        assert_eq!(result, "xyz123def");

        Ok(())
    }

    #[test]
    fn test_process_sources_nonexistent_file() {
        let replacer =
            Replacer::new("abc".into(), "def".into(), false, None, 0).unwrap();
        let nonexistent = PathBuf::from("/nonexistent/file.txt");
        let sources = vec![Source::File(nonexistent.clone())];
   
```

### Core Architecture Module: `sd/src/output.rs`
```
use crate::{Error, Result};
use std::{fs, io::Write, path::Path};

pub(crate) fn write_atomic(path: &Path, data: &[u8]) -> Result<()> {
    let path = fs::canonicalize(path)?;

    let mut temp = tempfile::NamedTempFile::new_in(
        path.parent()
            .ok_or_else(|| Error::InvalidPath(path.to_path_buf()))?,
    )?;

    let file = temp.as_file();
    file.set_len(data.len() as u64)?;

    if let Ok(metadata) = fs::metadata(&path) {
        file.set_permissions(metadata.permissions()).ok();

        // Explicitly retain ownership
        #[cfg(unix)]
        {
            use std::os::unix::fs::{MetadataExt, fchown};
            fchown(file, Some(metadata.uid()), Some(metadata.gid()))?;
            metadata.gid();
        }
    }

    if !data.is_empty() {
        temp.as_file_mut().write_all(data)?;
        temp.as_file_mut().flush()?;
    }

    temp.persist(&path)?;

    Ok(())
}

```

### Core Architecture Module: `sd/src/replacer/mod.rs`
```
use std::borrow::Cow;

use crate::{Result, unescape};

use regex::bytes::Regex;

#[cfg(test)]
mod tests;
mod validate;

pub use validate::{InvalidReplaceCapture, validate_replace};

pub struct Replacer {
    regex: Regex,
    replace_with: Vec<u8>,
    is_literal: bool,
    replacements: usize,
}

impl Replacer {
    pub fn new(
        look_for: String,
        replace_with: String,
        is_literal: bool,
        flags: Option<String>,
        replacements: usize,
    ) -> Result<Self> {
        let (look_for, replace_with) = if is_literal {
            (regex::escape(&look_for), replace_with.into_bytes())
        } else {
            validate_replace(&replace_with)?;

            (look_for, unescape::unescape(&replace_with).into_bytes())
        };

        let mut regex = regex::bytes::RegexBuilder::new(&look_for);
        regex.multi_line(true);

        if let Some(flags) = flags {
            flags.chars().for_each(|c| {
                #[rustfmt::skip]
                match c {
                    'c' => { regex.case_insensitive(false); },
                    'i' => { regex.case_insensitive(true); },
                    'm' => {},
                    'e' => { regex.multi_line(false); },
                    's' => {
                        if !flags.contains('m') {
                            regex.multi_line(false);
                        }
                        regex.dot_matches_new_line(true);
                    },
                    'w' => {
                        regex = regex::bytes::RegexBuilder::new(&format!(
                            "\\b{}\\b",
                            look_for
                        ));
                    },
                    _ => {},
                };
            });
        };

        Ok(Self {
            regex: regex.build()?,
            replace_with,
            is_literal,
            replacements,
        })
    }

    pub fn replace<'a>(&'a self, content: &'a [u8]) -> Cow<'a, [u8]> {
        let regex = &self.regex;
        let limit = self.replacements;
        let use_color = false;
        if self.is_literal {
            Self::replacen(
                regex,
                limit,
                content,
                use_color,
                regex::bytes::NoExpand(&self.replace_with),
            )
        } else {
            Self::replacen(
                regex,
                limit,
                content,
                use_color,
                &*self.replace_with,
            )
        }
    }

    /// A modified form of [`regex::bytes::Regex::replacen`] that supports
    /// coloring replacements
    pub fn replacen<'haystack, R: regex::bytes::Replacer>(
        regex: &regex::bytes::Regex,
        limit: usize,
        haystack: &'haystack [u8],
        _use_color: bool,
        mut rep: R,
    ) -> Cow<'haystack, [u8]> {
        let mut it = regex.captures_iter(haystack).enumerate().peekable();
        if it.peek().is_none() {
            return Cow::Borrowed(haystack);
        }
        let mut new = Vec::with_capacity(haystack.len());
        let mut last_match = 0;
        for (i, cap) in it {
            // unwrap on 0 is OK because captures only reports matches
            let m = cap.get(0).unwrap();
            new.extend_from_slice(&haystack[last_match..m.start()]);
            rep.replace_append(&cap, &mut new);
            last_match = m.end();
            if limit > 0 && i >= limit - 1 {
                break;
            }
        }
        new.extend_from_slice(&haystack[last_match..]);
        Cow::Owned(new)
    }
}

```

### Core Architecture Module: `sd/src/replacer/validate.rs`
```
use std::{error::Error, fmt, str::CharIndices};

#[derive(Debug)]
pub struct InvalidReplaceCapture {
    original_replace: String,
    invalid_ident: Span,
    num_leading_digits: usize,
}

impl Error for InvalidReplaceCapture {}

// NOTE: This code is much more allocation heavy than it needs to be, but it's
//       only displayed as a hard error to the user, so it's not a big deal
impl fmt::Display for InvalidReplaceCapture {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        #[derive(Clone, Copy)]
        enum SpecialChar {
            Newline,
            CarriageReturn,
            Tab,
        }

        impl SpecialChar {
            fn new(c: char) -> Option<Self> {
                match c {
                    '\n' => Some(Self::Newline),
                    '\r' => Some(Self::CarriageReturn),
                    '\t' => Some(Self::Tab),
                    _ => None,
                }
            }

            /// Renders as the character from the "Control Pictures" block
            ///
            /// https://en.wikipedia.org/wiki/Control_Pictures
            fn render(self) -> char {
                match self {
                    Self::Newline => '␊',
                    Self::CarriageReturn => '␍',
                    Self::Tab => '␉',
                }
            }
        }

        let Self {
            original_replace,
            invalid_ident,
            num_leading_digits,
        } = self;

        // Build up the error to show the user
        let mut formatted = String::new();
        let mut arrows_start = Span::start_at(0);
        for (byte_index, c) in original_replace.char_indices() {
            let (prefix, suffix, text) = match SpecialChar::new(c) {
                Some(c) => {
                    (
                        Some("" /* special prefix */),
                        Some("" /* special suffix */),
                        c.render(),
                    )
                }
                None => {
                    let (prefix, suffix) = if byte_index == invalid_ident.start
                    {
                        (Some("" /* error prefix */), None)
                    } else if byte_index
                        == invalid_ident.end.checked_sub(1).unwrap()
                    {
                        (None, Some("" /* error suffix */))
                    } else {
                        (None, None)
                    };
                    (prefix, suffix, c)
                }
            };

            if let Some(prefix) = prefix {
                formatted.push_str(prefix);
            }
            formatted.push(text);
            if let Some(suffix) = suffix {
                formatted.push_str(suffix);
            }

            if byte_index < invalid_ident.start {
                // Assumes that characters have a base display width of 1. While
                // that's not technically true, it's near impossible to do right
                // since the specifics on text rendering is up to the user's
                // terminal/font. This _does_ rely on variable-width characters
                // like \n, \r, and \t getting converting to single character
                // representations above
                arrows_start.start += 1;
            }
        }

        let ident = invalid_ident.slice(original_replace);
        let (number, the_rest) = ident.split_at(*num_leading_digits);

        writeln!(
            f,
            "The numbered capture group `${number}` in the replacement text is ambiguous."
        )?;

        let disambiguous = format!("${{{number}}}{the_rest}");
        writeln!(
            f,
            "hint: Use curly braces to disambiguate it `{disambiguous}`."
        )?;

        writeln!(f, "{}", formatted)?;

        // This relies on all non-curly-braced capture chars being 1 byte
        let arrows_span = arrows_start.end_offset(invalid_ident.len());
        let mut arrows = " ".repeat(arrows_span.start);
        arrows.push_str(&"^".repeat(arrows_span.len()));
        write!(f, "{}", arrows)
    }
}

pub fn validate_replace(s: &str) -> Result<(), InvalidReplaceCapture> {
    for ident in ReplaceCaptureIter::new(s) {
        let mut char_it = ident.name.char_indices();
        let (_, c) = char_it.next().unwrap();
        if c.is_ascii_digit() {
            for (i, c) in char_it {
                if !c.is_ascii_digit() {
                    return Err(InvalidReplaceCapture {
                        original_replace: s.to_owned(),
                        invalid_ident: ident.span,
                        num_leading_digits: i,
                    });
                }
            }
        }
    }

    Ok(())
}

#[derive(Clone, Copy, Debug)]
struct Span {
    start: usize,
    end: usize,
}

impl Span {
    fn start_at(start: usize) -> SpanOpen {
        SpanOpen { start }
    }

    fn new(start: usize, end: usize) -> Self {
        // `<` instead of `<=` because `Span` is exclusive on the upper bound
        assert!(start < end);
        Self { start, end }
    }

    fn slice(self, s: &str) -> &str {
        &s[self.start..self.end]
    }

    fn len(self) -> usize {
        self.end - self.start
    }
}

#[derive(Clone, Copy)]
struct SpanOpen {
    start: usize,
}

impl SpanOpen {
    fn end_at(self, end: usize) -> Span {
        let Self { start } = self;
        Span::new(start, end)
    }

    fn end_offset(self, offset: usize) -> Span {
        assert_ne!(offset, 0);
        let Self { start } = self;
        self.end_at(start + offset)
    }
}

#[derive(Debug)]
struct Capture<'rep> {
    name: &'rep str,
    span: Span,
}

impl<'rep> Capture<'rep> {
    fn new(name: &'rep str, span: Span) -> Self {
        Self { name, span }
    }
}

/// An iterator over the capture idents in an interpolated replacement string
///
/// This code is adapted from the `regex` crate
/// <https://docs.rs/regex-automata/latest/src/regex_automata/util/interpolate.rs.html>
/// (hence the high quality doc comments).
struct ReplaceCaptureIter<'rep>(CharIndices<'rep>);

impl<'rep> ReplaceCaptureIter<'rep> {
    fn new(s: &'rep str) -> Self {
        Self(s.char_indices())
    }
}

impl<'rep> Iterator for ReplaceCaptureIter<'rep> {
    type Item = Capture<'rep>;

    fn next(&mut self) -> Option<Self::Item> {
        // Continually seek to `$` until we find one that has a capture group
        loop {
            let (start, _) = self.0.find(|(_, c)| *c == '$')?;

            let replacement = self.0.as_str();
            let rep = replacement.as_bytes();
            let open_span = Span::start_at(start + 1);
            let maybe_cap = match rep.first()? {
                // Handle escaping of '$'.
                b'$' => {
                    self.0.next().unwrap();
                    None
                }
                b'{' => find_cap_ref_braced(rep, open_span),
                _ => find_cap_ref(rep, open_span),
            };

            if let Some(cap) = maybe_cap {
                // Advance the inner iterator to consume the capture
                let mut remaining_bytes = cap.name.len();
                while remaining_bytes > 0 {
                    let (_, c) = self.0.next().unwrap();
                    remaining_bytes =
                        remaining_bytes.checked_sub(c.len_utf8()).unwrap();
                }
                return Some(cap);
            }
        }
    }
}

/// Parses a possible reference to a capture group name in the given text,
/// starting at the beginning of `replacement`.
///
/// If no such valid reference could be found, None is returned.
fn find_cap_ref(rep: &[u8], open_span: SpanOpen) -> Option<Capture<'_>> {
    if rep.is_empty() {
        return None;
    }

    let mut cap_end = 0;
    while rep.get(cap_end).copied().is_some_and(is_valid_cap_letter) {
        cap_end += 1;
    }
    if cap_end == 0 {
        return None;
    }

    // We just verified that the range 0..cap_end is valid ASCII, so it
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #342** (2026-06-11): **docs(cli): document $$ escape in --help for replace_with**
  *Symptoms*: ## Summary  Issue #341: The `690081` escape syntax is documented in the README but missing from `--help` output.  The `replace_with` arg help only mentioned ``, `` capture groups but didn't document how to escape a literal `$`, which is a common need. Added one line to the doc comment noting that `690081` produces a literal `$`.  ## Test plan  `cargo run --bin sd -- --help` now shows the `690081` escape note under the replace_with argument.  ## Related  - Issue #341
  **Post-Mortem & Fix Analysis**:
  > Closing as stale (no activity for 4+ weeks). Happy to reopen if still relevant — just drop a comment and I'll pick it back up.

- **Issue #336** (2026-03-25): **sd "\n" " " not working as expected**
  *Symptoms*: linux shell  ```sh cat << EOF | sd --flags=m "\n" " " a b c EOF ```  I expect the newline characters to be replaced, making one space separated line `a b c `  but instead I get ``` a b c ```  using `tr "\n" " "`  I get the correct output  
  **Post-Mortem & Fix Analysis**:
  > `-A`/`--across` must be used?: `… | sd -A '\n' ' '`
  > > `-A`/`--across` must be used?: `… | sd -A '\n' ' '`  Thanks that solves it!

- **Issue #333** (2026-02-27): **Possible regression after upgrade to v1.1.0**
  *Symptoms*: I use  ```sh sd -f s '\s\[\s*\(.*?];' ';' ./*.proto ```  to edit  ```proto   UploadWhere where = 2 [(validate.rules).enum = {     in: [       1,       2,       3     ]   }]; ```  before sd change to  ```proto UploadWhere where = 2; ```  but after upgrade sd can not change anymore
  **Post-Mortem & Fix Analysis**:
  > Looks like I need to add `--across`

- **Issue #330** (2026-02-25): **arm64 targets**
  *Symptoms*: Generally useful, also requested: https://github.com/chmln/sd/issues/290#issuecomment-3942723098

- **Issue #329** (2026-02-25): **Add Windows ARM64 binaries to GitHub releases**
  *Symptoms*: Generally useful, also requested: https://github.com/chmln/sd/issues/290#issuecomment-3942723098  

- **Issue #328** (2026-02-25): **feat: add line-by-line mode as default, stream without loading files into memory**
  *Symptoms*: Implements line-by-line processing as the default mode, replacing the previous behavior of loading entire files into memory via mmap. Adds `--across` (`-A`) for the old whole-file behavior when needed.  ## Changes  - **Default mode is now line-by-line**: processes files as a stream, never loading the whole thing into memory - **New `--across` / `-A` flag**: opt-in to the old whole-file mmap behavior, which is faster when memory isn't a concern - **Chunked I/O**: reads in 8KB chunks with a line buffer, so performance is good and memory use is bounded - **Refactored codebase**: split into `sd` (library) and `sd-cli` (binary) crates  ## Closes  Closes #96 — massive memory usage on large files Closes #100 — stdin now streams, works with `journalctl -f | sd ...` and similar Closes #154 — memory allocation failure on files too large to fit in RAM Closes #286 — `sd` now streams by default; the documented caveat no longer applies Closes #302 — output is emitted as lines are processed, not buffered until EOF  Also closes #290. I'm back.  ## Benchmarks  1M lines (~36MB), `foo → qux`:  | Command | Time | |---|---| | `sd -A 'foo' 'qux'` (across, whole-file) | 33ms | | `sd 'foo' 'qux'` (line-by-line, **default**) | 106ms | | `sed s/foo/qux/g` | 120ms |  Line-by-line is faster than sed while using a fraction of the memory.
  **Post-Mortem & Fix Analysis**:
  > Awesome work!
  > Thank you for this!

- **Issue #327** (2025-12-20): **Retain ownership on atomic writes**
  *Symptoms*: Preserve original file uid/gid when replacing files via tempfile.   

- **Issue #326** (2025-12-20): **The reply for SD privilege escalation**
  *Symptoms*: **First of all, I am very confused about the decision to lock the issue I previously posted. I don't understand why the discussion about the vulnerability is so strict. After seeing the reply, I conducted a verification.After seeing the reply, I conducted a verification.**    ```bash ┌──(mj㉿MJ)-[/tmp/test] └─$ echo 123 > test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ ls -al | grep test.txt -rw-rw-r-- 1 mj   mj       4 Dec 19 13:45 test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ echo $SHELL /bin/bash  ┌──(mj㉿MJ)-[/tmp/test] └─$ sudo -u root sed -i 's/1/2/' test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ cat test.txt 223  ┌──(mj㉿MJ)-[/tmp/test] └─$ ls -al | grep test.txt -rw-rw-r-- 1 mj   mj       4 Dec 19 13:45 test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ sudo -u root perl -i -pe 's/2/1/' test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ cat test.txt 123  ┌──(mj㉿MJ)-[/tmp/test] └─$ ls -al | grep test.txt -rw-rw-r-- 1 mj   mj       4 Dec 19 13:46 test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ sudo -u root perl -i'' -pe 's/1/2/' test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ cat test.txt 223  ┌──(mj㉿MJ)-[/tmp/test] └─$ ls -al | grep test.txt -rw-rw-r-- 1 mj   mj       4 Dec 19 13:47 test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ sudo -u root sd '2' '1' test.txt  ┌──(mj㉿MJ)-[/tmp/test] └─$ cat test.txt 113  ┌──(mj㉿MJ)-[/tmp/test] └─$ ls -al | grep test.txt -rw-rw-r-- 1 root root     4 Dec 19 13:48 test.txt ``` **The above is my verification. If there is anything wrong, I hope to provide sed and perl commands that I can use to change the file's group, and I also
  **Post-Mortem & Fix Analysis**:
  > Dude stop it. You clearly don't understand how `sudo` works or atomic writes or anything about Unix permissions, but **THIS IS NOT AN `sd` VULNURABILITY**. Please take your learning exercises elsewhere. The initial report is just AI slop. It is invalid, and it isn't necessary for this project to convince you of that.
  > @faabbi first of all, `sd` is a find & replace utility. It doesn't assign any privileges, so any notion of privilege escalation here is silly.   But that aside, your example "vulnerability" scenario involves a user that has access to performing commands as root by `sudo`. In a situation where an attacker already has access to sudo or root you've already lost.  Since youre already running `sudo -u root` this is not privilege escalation at all, and the CVE is misleading
  > > [@faabbi](https://github.com/faabbi) first of all, `sd` is a find & replace utility. It doesn't assign any privileges, so any notion of privilege escalation here is silly. >  > But that aside, your example "vulnerability" scenario involves a user that has access to performing commands as root by `sudo`. In a situation where an attacker already has access to sudo or root you've already lost. >  > Since youre already running `sudo -u root` this is not privilege escalation at all, and the CVE is misleading   I agree with some of your points. The sd command itself does not inherently have vulnerabilities for privilege escalation. The key to elevating privileges lies in the sudo command. Without sudo privileges, it is entirely impossible to achieve privilege escalation. Similarly, if a low-privileged user has root privileges for the sd command, they can certainly escalate privileges in many ways, such as modifying /etc/passwd or /etc/shadow, rather than merely focusing on the sd command’s

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

### Incident Patch 1: `4a7b2165` (2026-02-25)
**Commit Message**: feat: add line-by-line mode as default, stream without loading files into memory (#328)

* refactor: remove pub(crate)

This made no sense because we don't intend to ever release `sd` as a crate

* remove old feature

* address clippy lints and improve code quality

* refactor: split sd and sd-cli

* feat: add --line-by-line (-L) flag for line-by-line processing

Add a new processing mode that handles input line by line instead of
reading entire files into memory. This fixes several long-standing issues:
- OOM on large files (O(line_size) memory instead of O(file_size))
- stdin waits for EOF (output now flushed per line, enables streaming)
- `^` matches phantom empty line after trailing `\n`
- `\s+$` eats newlines because `\s` sees `\n` across line boundaries

The implementation strips `\n` before passing each line to the replacer,
then restores it, so regex never sees newline characters. Files without
trailing newlines are preserved as-is. In-place file modification uses
the same atomic temp-file-and-rename pattern as the existing code path.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

* feat: make line-by-line the default, add --across (-A) for whole-file

Line-by-li

**File**: `CHANGELOG.md` (modified, +2/-3)
```diff
@@ -78,7 +78,7 @@ release artifacts on the releases page.
   - Fixes several cross-compilation issues that effected different targets in CI
 - #182 `cargo update` (@CosmicHorrorDev)
   - Bumps dependencies to their latest compatible versions
-- #183 Switch `memmap` -> `memmap2` (@CosmicHorrorDev)
+- #183 Switch file-mapping crate implementation (@CosmicHorrorDev)
   - Switches away from an unmaintained crate
 - #184 Add editor config file matching rustfmt config (@CosmicHorrorDev)
   - Adds an `.editorconfig` file matching the settings listed in the
@@ -121,7 +121,7 @@ release artifacts on the releases page.
 
 ## [0.6.2]
 
-- Fixed pre-allocated memmap buffer size
+- Fixed pre-allocated file-mapping buffer size
 - Fixed failing tests
 
 ## [0.6.0] - 2019-06-15
@@ -188,4 +188,3 @@ To reflect this change, `--input` is also renamed to `--in-place`. This is the f
 
 - Files are now written to [atomically](https://github.com/chmln/sd/issues/3)
 
-
```

**File**: `Cargo.lock` (modified, +14/-14)
```diff
@@ -358,15 +358,6 @@ version = "2.7.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f52b00d39961fc5b2736ea853c9cc86238e165017a493d1d5c8eac6bdc4cc273"
 
-[[package]]
-name = "memmap2"
-version = "0.9.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "deaba38d7abf1d4cca21cc89e932e542ba2b9258664d2a9ef0e61512039c9375"
-dependencies = [
- "libc",
-]
-
 [[package]]
 name = "memoffset"
 version = "0.9.0"
@@ -606,6 +597,19 @@ checksum = "94143f37725109f92c262ed2cf5e59bce7498c01bcc1502d7b9afe439a4e9f49"
 [[package]]
 name = "sd"
 version = "1.0.0"
+dependencies = [
+ "insta",
+ "proptest",
+ "rayon",
+ "regex",
+ "regex-automata",
+ "tempfile",
+ "thiserror",
+]
+
+[[package]]
+name = "sd-cli"
+version = "1.0.0"
 dependencies = [
  "ansi-to-html",
  "anyhow",
@@ -614,13 +618,9 @@ dependencies = [
  "clap_mangen",
  "console",
  "insta",
- "memmap2",
- "proptest",
- "rayon",
  "regex",
- "regex-automata",
+ "sd",
  "tempfile",
- "thiserror",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +10/-28)
```diff
@@ -1,48 +1,30 @@
 [workspace]
+resolver = "3"
 members = [
-    ".",
+    "sd",
+    "sd-cli",
     "xtask",
 ]
 
-[workspace.dependencies.clap]
-version = "4.4.6"
-features = ["derive", "deprecated", "wrap_help"]
+[workspace.dependencies]
+tempfile = "3.8.0"
+clap = {version =  "4.4.6", features = ["derive", "wrap_help"]}
+
+
 
 [workspace.package]
 edition = "2024"
 version = "1.0.0"
-
-[package]
-name = "sd"
-version.workspace = true
-edition.workspace = true
-authors = ["Gregory <gregory.mkv@gmail.com>"]
+authors = ["Gregory <gregory.mkv@gmail.com>", "Orión <oriongonza42@pm.me>"]
 description = "An intuitive find & replace CLI"
-readme = "README.md"
+readme = "../README.md"
 keywords = ["sed", "find", "replace", "regex"]
 license = "MIT"
 homepage = "https://github.com/chmln/sd"
 repository = "https://github.com/chmln/sd.git"
 categories = ["command-line-utilities", "text-processing", "development-tools"]
 rust-version = "1.86.0"
 
-[dependencies]
-regex = "1.10.2"
-rayon = "1.8.0"
-memmap2 = "0.9.0"
-tempfile = "3.8.0"
-thiserror = "1.0.50"
-clap.workspace = true
-
-[dev-dependencies]
-assert_cmd = "2.1.1"
-anyhow = "1.0.75"
-clap_mangen = "0.2.14"
-proptest = "1.3.1"
-console = "0.15.7"
-insta = "1.34.0"
-ansi-to-html = "0.1.3"
-regex-automata = "0.4.3"
 
 [profile.release]
 opt-level = 3
```

**File**: `README.md` (modified, +39/-1)
```diff
@@ -23,9 +23,11 @@ Simpler syntax for replacing all occurrences:
   - sed: `sed s/before/after/g`
 
 Replace newlines with commas:
-  - sd: `sd '\n' ','`
+  - sd: `sd -A '\n' ','`
   - sed: `sed ':a;N;$!ba;s/\n/,/g'`
 
+  Note: this requires `-A` (across mode) since `\n` is a cross-line pattern.
+
 Extracting stuff out of strings containing slashes:
   - sd: `echo "sample with /path/" | sd '.*(/.*/)' '$1'`
   - sed: `echo "sample with /path/" | sed -E 's/.*(\\/.*\\/)/\1/g'`
@@ -78,6 +80,27 @@ hyperfine --warmup 3 --export-markdown out.md \
 
 Result: ~11.93 times faster
 
+**Line-by-line vs across mode** (1M lines, ~36MB file):
+
+| Command | Mean [ms] | Relative |
+|:---|---:|---:|
+| `sd -A 'foo' 'qux'` (across) | 125.6 ± 14.3 | 1.00 |
+| `sed s/foo/qux/g` | 316.4 ± 30.0 | 2.52 |
+| `sd 'foo' 'qux'` (line-by-line, default) | 357.0 ± 15.0 | 2.84 |
+
+| Command | Mean [ms] | Relative |
+|:---|---:|---:|
+| `sd -A '(\w+) world' '$1 earth'` (across) | 254.0 ± 11.2 | 1.00 |
+| `sd '(\w+) world' '$1 earth'` (line-by-line, default) | 566.7 ± 16.7 | 2.23 |
+| `sed -E 's/(\w+) world/\1 earth/g'` | 4432.7 ± 173.2 | 17.45 |
+
+Line-by-line mode is ~2-3x slower than across mode but still faster than sed for regex replacements. The tradeoff is dramatically lower memory usage:
+
+| Mode | Peak RSS |
+|:---|---:|
+| `sd -A` (across) | 74 MB |
+| `sd` (line-by-line, default) | 3 MB |
+
 ## Installation
 
 Install through
@@ -176,6 +199,21 @@ $ echo "./hello --foo" | sd -- "--foo" "-w"
 ./hello -w
 ```
 
+### Processing modes
+
+By default, sd processes input **line by line**. This means:
+- Low memory usage (only one line in memory at a time)
+- Streaming output for stdin (results appear before EOF)
+- `^` and `$` match the start/end of each line without phantom matches
+- `\s+$` trims trailing whitespace without eating newlines
+
+If you need patterns to match **across line boundaries** (e.g. replacing `\n` or matching multi-line patterns), use the `-A` / `--across` flag:
+
+```sh
+> echo -e "hello\nworld" | sd -A '\n' ','
+hello,world
+```
+
 ### Escaping special characters
 To escape the `$` character, use `$$`:
 
```

**File**: `gen/completions/_sd` (modified, +2/-0)
```diff
@@ -23,6 +23,8 @@ _sd() {
 '--preview[Display changes in a human reviewable format (the specifics of the format are likely to change in the future)]' \
 '-F[Treat FIND and REPLACE_WITH args as literal strings]' \
 '--fixed-strings[Treat FIND and REPLACE_WITH args as literal strings]' \
+'-A[Process each input as a whole rather than line by line. This allows patterns to match across line boundaries but uses more memory and prevents streaming]' \
+'--across[Process each input as a whole rather than line by line. This allows patterns to match across line boundaries but uses more memory and prevents streaming]' \
 '-h[Print help (see more with '\''--help'\'')]' \
 '--help[Print help (see more with '\''--help'\'')]' \
 '-V[Print version]' \
```

---

### Incident Patch 2: `84c7e6e8` (2025-12-20)
**Commit Message**: Fix clippy warnings

**File**: `src/main.rs` (modified, +2/-2)
```diff
@@ -45,7 +45,7 @@ fn try_main() -> Result<()> {
         .iter()
         .map(|source| {
             Ok(match source {
-                Source::File(path) => make_mmap(&path)?,
+                Source::File(path) => make_mmap(path)?,
                 Source::Stdin => make_mmap_stdin()?,
             })
         })
@@ -55,7 +55,7 @@ fn try_main() -> Result<()> {
         use rayon::prelude::*;
         mmaps
             .par_iter()
-            .map(|mmap| replacer.replace(&mmap))
+            .map(|mmap| replacer.replace(mmap))
             .collect()
     };
 
```

**File**: `src/output.rs` (modified, +3/-9)
```diff
@@ -1,8 +1,6 @@
 use crate::{Error, Result};
 use memmap2::MmapMut;
-use std::{
-    fs, io::Write, ops::DerefMut, os::unix::fs::MetadataExt, path::Path,
-};
+use std::{fs, io::Write, ops::DerefMut, path::Path};
 
 pub(crate) fn write_atomic(path: &Path, data: &[u8]) -> Result<()> {
     let path = fs::canonicalize(path)?;
@@ -21,12 +19,8 @@ pub(crate) fn write_atomic(path: &Path, data: &[u8]) -> Result<()> {
         // Explicitly retain ownership
         #[cfg(unix)]
         {
-            use std::os::unix;
-            unix::fs::fchown(
-                &file,
-                Some(metadata.uid()),
-                Some(metadata.gid()),
-            )?;
+            use std::os::unix::fs::{MetadataExt, fchown};
+            fchown(file, Some(metadata.uid()), Some(metadata.gid()))?;
             metadata.gid();
         }
     }
```

**File**: `src/replacer/validate.rs` (modified, +7/-8)
```diff
@@ -76,11 +76,11 @@ impl fmt::Display for InvalidReplaceCapture {
             };
 
             if let Some(prefix) = prefix {
-                formatted.push_str(&prefix.to_string());
+                formatted.push_str(prefix);
             }
             formatted.push(text);
             if let Some(suffix) = suffix {
-                formatted.push_str(&suffix.to_string());
+                formatted.push_str(suffix);
             }
 
             if byte_index < invalid_ident.start {
@@ -97,14 +97,13 @@ impl fmt::Display for InvalidReplaceCapture {
         // This relies on all non-curly-braced capture chars being 1 byte
         let arrows_span = arrows_start.end_offset(invalid_ident.len());
         let mut arrows = " ".repeat(arrows_span.start);
-        arrows.push_str(&format!("{}", "^".repeat(arrows_span.len())));
+        arrows.push_str(&"^".repeat(arrows_span.len()));
 
         let ident = invalid_ident.slice(original_replace);
         let (number, the_rest) = ident.split_at(*num_leading_digits);
         let disambiguous = format!("${{{number}}}{the_rest}");
         let error_message = format!(
-            "The numbered capture group `{}` in the replacement text is ambiguous.",
-            format!("${}", number).to_string()
+            "The numbered capture group `${number}` in the replacement text is ambiguous.",
         );
         let hint_message = format!(
             "{}: Use curly braces to disambiguate it `{}`.",
@@ -252,7 +251,7 @@ fn find_cap_ref(rep: &[u8], open_span: SpanOpen) -> Option<Capture<'_>> {
     }
 
     let mut cap_end = 0;
-    while rep.get(cap_end).copied().map_or(false, is_valid_cap_letter) {
+    while rep.get(cap_end).copied().is_some_and(is_valid_cap_letter) {
         cap_end += 1;
     }
     if cap_end == 0 {
@@ -274,10 +273,10 @@ fn find_cap_ref_braced(rep: &[u8], open_span: SpanOpen) -> Option<Capture<'_>> {
     assert_eq!(b'{', rep[0]);
     let mut cap_end = 1;
 
-    while rep.get(cap_end).map_or(false, |&b| b != b'}') {
+    while rep.get(cap_end).is_some_and(|&b| b != b'}') {
         cap_end += 1;
     }
-    if !rep.get(cap_end).map_or(false, |&b| b == b'}') {
+    if rep.get(cap_end).is_none_or(|&b| b != b'}') {
         return None;
     }
 
```

**File**: `src/unescape.rs` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ pub fn unescape(input: &str) -> String {
 /// This is for sequences such as `\x08` or `\u1234`
 fn escape_n_chars(chars: &mut Chars<'_>, length: usize) -> Option<char> {
     let s = chars.as_str().get(0..length)?;
-    let u = u32::from_str_radix(&s, 16).ok()?;
+    let u = u32::from_str_radix(s, 16).ok()?;
     let ch = char::from_u32(u)?;
     _ = chars.nth(length);
     Some(ch)
```

---

### Incident Patch 3: `25c4aac1` (2025-12-20)
**Commit Message**: Merge pull request #320 from frdiener/fix-manpage-typo

fix(manpage): add missing single quotes in example

**File**: `gen/sd.1` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ The program panicked.
 .SH EXAMPLES
 .TP
 String\-literal mode
-\fB$ echo \*(Aqlots((([]))) of special chars\*(Aq | sd \-F \*(Aq((([])))\*(Aq\fR
+\fB$ echo \*(Aqlots((([]))) of special chars\*(Aq | sd \-F \*(Aq((([])))\*(Aq \*(Aq\*(Aq\fR
 .br
 lots of special chars
 .TP
```

**File**: `xtask/src/gen.rs` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ fn gen_man(base_dir: &Path) {
         // (description, command, result), result can be empty
         (
             "String-literal mode",
-            "echo 'lots((([]))) of special chars' | sd -F '((([])))'",
+            "echo 'lots((([]))) of special chars' | sd -F '((([])))' ''",
             "lots of special chars",
         ),
         (
```

---

### Incident Patch 4: `61285dfe` (2025-09-18)
**Commit Message**: fix(manpage): add missing single quotes in example

* Update man page example to include the empty replacement string (`''`)

* Update corresponding example in `cargo-xtask` generator to stay
consistent

**File**: `gen/sd.1` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ The program panicked.
 .SH EXAMPLES
 .TP
 String\-literal mode
-\fB$ echo \*(Aqlots((([]))) of special chars\*(Aq | sd \-F \*(Aq((([])))\*(Aq\fR
+\fB$ echo \*(Aqlots((([]))) of special chars\*(Aq | sd \-F \*(Aq((([])))\*(Aq \*(Aq\*(Aq\fR
 .br
 lots of special chars
 .TP
```

**File**: `xtask/src/gen.rs` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ fn gen_man(base_dir: &Path) {
         // (description, command, result), result can be empty
         (
             "String-literal mode",
-            "echo 'lots((([]))) of special chars' | sd -F '((([])))'",
+            "echo 'lots((([]))) of special chars' | sd -F '((([])))' ''",
             "lots of special chars",
         ),
         (
```

---

### Incident Patch 5: `1254e038` (2025-04-18)
**Commit Message**: fix(#313): Replace unescape crate with more lenient implementation

Previously we used to do an "all or nothing" approach, where if anything
failed in the escaping we didn't escape at all.

**File**: `Cargo.lock` (modified, +0/-7)
```diff
@@ -637,7 +637,6 @@ dependencies = [
  "regex-automata",
  "tempfile",
  "thiserror",
- "unescape",
 ]
 
 [[package]]
@@ -738,12 +737,6 @@ version = "0.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "eaea85b334db583fe3274d12b4cd1880032beab409c0d774be044d4480ab9a94"
 
-[[package]]
-name = "unescape"
-version = "0.1.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ccb97dac3243214f8d8507998906ca3e2e0b900bf9bf4870477f125b82e68f6e"
-
 [[package]]
 name = "unicode-ident"
 version = "1.0.12"
```

**File**: `Cargo.toml` (modified, +2/-3)
```diff
@@ -9,7 +9,7 @@ version = "4.4.6"
 features = ["derive", "deprecated", "wrap_help"]
 
 [workspace.package]
-edition = "2021"
+edition = "2024"
 version = "1.0.0"
 
 [package]
@@ -24,12 +24,11 @@ license = "MIT"
 homepage = "https://github.com/chmln/sd"
 repository = "https://github.com/chmln/sd.git"
 categories = ["command-line-utilities", "text-processing", "development-tools"]
-rust-version = "1.70.0"
+rust-version = "1.86.0"
 
 [dependencies]
 regex = "1.10.2"
 rayon = "1.8.0"
-unescape = "0.1.0"
 memmap2 = "0.9.0"
 tempfile = "3.8.0"
 thiserror = "1.0.50"
```

**File**: `src/main.rs` (modified, +2/-0)
```diff
@@ -1,8 +1,10 @@
+#![feature(try_blocks)]
 mod cli;
 mod error;
 mod input;
 
 pub(crate) mod replacer;
+mod unescape;
 
 use clap::Parser;
 use memmap2::MmapMut;
```

**File**: `src/replacer/mod.rs` (modified, +2/-7)
```diff
@@ -1,6 +1,6 @@
 use std::borrow::Cow;
 
-use crate::Result;
+use crate::{unescape, Result};
 
 use regex::bytes::Regex;
 
@@ -30,12 +30,7 @@ impl Replacer {
         } else {
             validate_replace(&replace_with)?;
 
-            (
-                look_for,
-                unescape::unescape(&replace_with)
-                    .unwrap_or(replace_with)
-                    .into_bytes(),
-            )
+            (look_for, unescape::unescape(&replace_with).into_bytes())
         };
 
         let mut regex = regex::bytes::RegexBuilder::new(&look_for);
```

**File**: `src/replacer/tests.rs` (modified, +27/-4)
```diff
@@ -41,10 +41,11 @@ impl Replace {
             UNLIMITED_REPLACEMENTS,
         )
         .unwrap();
-        assert_eq!(
-            std::str::from_utf8(&replacer.replace(self.src.as_bytes())),
-            Ok(self.expected)
-        );
+
+        let binding = replacer.replace(self.src.as_bytes());
+        let actual = std::str::from_utf8(&binding).unwrap();
+
+        assert_eq!(self.expected, actual);
     }
 }
 
@@ -144,3 +145,25 @@ fn full_word_replace() {
     }
     .test();
 }
+
+#[test]
+fn escaping_unnecessarily() {
+    // https://github.com/chmln/sd/issues/313
+    Replace {
+        look_for: "abc",
+        replace_with: r#"\n{"#,
+        src: "abc",
+        expected: "\n{",
+        ..Default::default()
+    }
+    .test();
+
+    Replace {
+        look_for: "abc",
+        replace_with: r#"\n\{"#,
+        src: "abc",
+        expected: "\n\\{",
+        ..Default::default()
+    }
+    .test();
+}
```

---

### Incident Patch 6: `97bd728a` (2024-05-06)
**Commit Message**: fix: alter note

**File**: `README_zh-CN.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 `sd` 是一个直观的查找与替换命令行工具。
 
-## 宣传
+## 主要优点
 
 为什么要使用它而不是现有的任何工具？
 
```

---

### Incident Patch 7: `0fd8524b` (2024-02-19)
**Commit Message**: docs: fix capture group example in man page

**File**: `xtask/src/gen.rs` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ fn gen_man(base_dir: &Path) {
         (
             "Indexed capture groups",
             r"echo 'cargo +nightly watch' | sd '(\w+)\s+\+(\w+)\s+(\w+)' 'cmd: $1, channel: $2, subcmd: $3'",
-            "123 dollars and 45 cents",
+            "cmd: cargo, channel: nightly, subcmd: watch",
         ),
         (
             "Find & replace in file",
```

---

### Incident Patch 8: `bbefeb8a` (2023-11-05)
**Commit Message**: Fix release checklist indentation (#271)

**File**: `RELEASE.md` (modified, +9/-9)
```diff
@@ -1,21 +1,21 @@
 # Release checklist
 
 1. [ ] Create a new _"Release v{VERSION}"_ issue with this checklist
-  - `$ cat RELEASE.md | sd '\{VERSION\}' '{NEW_VERSION}' | xclip -sel clip`
-  - Create the issue in GitHub
+    - `$ cat RELEASE.md | sd '\{VERSION\}' '{NEW_VERSION}' | xclip -sel clip`
+    - Create the issue in GitHub
 1. [ ] Ensure that all entries in the man page are up to date
-  - Manually verify with the entries in `xtask/src/gen.rs`
+    - Manually verify with the entries in `xtask/src/gen.rs`
 1. [ ] Regenerate static assets
-  - `$ cargo xtask gen`
+    - `$ cargo xtask gen`
 1. [ ] Update `rust-version` in `Cargo.toml`
-  - `$ cargo msrv --min 1.60 -- cargo check`
+    - `$ cargo msrv --min 1.60 -- cargo check`
 1. [ ] Bump `version` in `Cargo.toml`
 1. [ ] Update the `CHANGELOG.md`
 1. [ ] Merge changes through a PR to make sure that CI passes
 1. [ ] Publish on [crates.io](crates.io)
-  - `$ cargo publish`
+    - `$ cargo publish`
 1. [ ] Publish on GitHub by pushing a version tag
-  - Make sure the branch you're on is fully up to date
-  - `$ git tag v{VERSION}`
-  - `$ git push upstream/origin v{VERSION}`
+    - Make sure the branch you're on is fully up to date
+    - `$ git tag v{VERSION}`
+    - `$ git push upstream/origin v{VERSION}`
 1. [ ] Make a release announcement on GitHub after the release workflow finishes
```

---

### Incident Patch 9: `a98100fb` (2023-10-24)
**Commit Message**: Fix copy-paste error (#257)

**File**: `.github/workflows/publish.yml` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ jobs:
           7z a "$staging.zip" "$staging"
           echo "ASSET=$staging.zip" >> $GITHUB_ENV
         else
-          cp "target/${{ matrix.target }}/release-lto/inlyne" "$staging/"
+          cp "target/${{ matrix.target }}/release/sd" "$staging/"
           tar czf "$staging.tar.gz" "$staging"
           echo "ASSET=$staging.tar.gz" >> $GITHUB_ENV
         fi
```

---

### Incident Patch 10: `4dab4123` (2023-10-18)
**Commit Message**: Update --string-mode references to --fixed-strings (#240)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ Install through
 
 ## Quick Guide
 
-1. **String-literal mode**. By default, expressions are treated as regex. Use `-s` or `--string-mode` to disable regex.
+1. **String-literal mode**. By default, expressions are treated as regex. Use `-F` or `--fixed-strings` to disable regex.
 
    ```sh
    > echo 'lots((([]))) of special chars' | sd -s '((([])))' ''
```

**File**: `src/cli.rs` (modified, +8/-1)
```diff
@@ -54,7 +54,14 @@ w - match full words only
     */
     pub flags: Option<String>,
 
-    /// The regexp or string (if -s) to search for.
+    #[arg(long, value_name = "SEPARATOR")]
+    /// Set the path separator to use when printing file paths. The default is
+    /// your platform's path separator ('/' on Unix, '\' on Windows). This flag
+    /// is intended to override the default when the environment demands it. A
+    /// path separator is limited to a single byte.
+    pub path_separator: Option<char>,
+
+    /// The regexp or string (if using `-F`) to search for.
     pub find: String,
 
     /// What to replace each match with. Unless in string mode, you may
```

#### Recent Merged Pull Requests:
- **PR #342** (closed): docs(cli): document $$ escape in --help for replace_with (@fuleinist)
- **PR #330** (2026-02-25): arm64 targets (@oriongonza)
- **PR #328** (2026-02-25): feat: add line-by-line mode as default, stream without loading files into memory (@oriongonza)
- **PR #327** (2025-12-20): Retain ownership on atomic writes (@chmln)
- **PR #320** (2025-12-20): fix(manpage): add missing single quotes in example (@frdiener)
- **PR #309** (closed):  Sd lakalak (@sakuan88)
- **PR #300** (2025-12-20): deps: bump libc from 0.2.149 to 0.2.155 (@huajingyun01)
- **PR #299** (2024-05-24): feat: add README_zh-CN.md (@zhangymPerson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
