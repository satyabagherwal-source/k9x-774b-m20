# Forensic Learning Record (Deep Inspection): chmln/sd

> **Canonical Artifact**: `07_PROJECT_LEARNING/chmln-sd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chmln/sd](https://github.com/chmln/sd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:01:50.850Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chmln/sd`
- **Description**: Intuitive find & replace CLI (sed alternative)
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7380 stars

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
        let mut output = Vec::new();

        let result =
            process_sources(&replacer, &sources, false, false, &mut output);
        assert!(result.is_err());

        match result.unwrap_err() {
            Error::InvalidPath(path) => assert_eq!(path, nonexistent),
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[test]
    fn test_write_with_temp() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        std::fs::write(&file_path, "original").unwrap();

        let new_data = b"new content";
        write_with_temp(&file_path, new_data)?;

        let result = std::fs::read_to_string(&file_path).unwrap();
        assert_eq!(result, "new content");

        Ok(())
    }

    #[test]
    fn test_process_sources_line_by_line_preview() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        std::fs::write(&file_path, "abc123\ndef456\n").unwrap();

        let replacer =
            Replacer::new("abc".into(), "xyz".into(), false, None, 0)?;
        let sources = vec![Source::File(file_path)];
        let mut output = Vec::new();

        process_sources(&replacer, &sources, true, true, &mut output)?;

        let result = String::from_utf8(output).unwrap();
        assert_eq!(result, "xyz123\ndef456\n");

        Ok(())
    }

    #[test]
    fn test_process_sources_line_by_line_in_place() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        std::fs::write(&file_path, "abc123\ndef456\n").unwrap();

        let replacer =
            Replacer::new("abc".into(), "xyz".into(), false, None, 0)?;
        let sources = vec![Source::File(file_path.clone())];
        let mut output = Vec::new();

        process_sources(&replacer, &sources, false, true, &mut output)?;

        let result = std::fs::read_to_string(&file_p
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

    // We just verified that the range 0..cap_end is valid ASCII, so it must
    // therefore be valid UTF-8. If we really cared, we could avoid this UTF-8
    // check via an unchecked conversion or by parsing the number straight from
    // &[u8].
    let name = core::str::from_utf8(&rep[..cap_end])
        .expect("valid UTF-8 capture name");
    Some(Capture::new(name, open_span.end_offset(name.len())))
}

/// Looks for a braced reference, e.g., `${foo1}`. This then looks for a
/// closing brace and returns the capture reference within the brace.
fn find_cap_ref_braced(rep: &[u8], open_span: SpanOpen) -> Option<Capture<'_>> {
    assert_eq!(b'{', rep[0]);
    let mut cap_end = 1;

    while rep.get(cap_end).is_some_and(|&b| b != b'}') {
        cap_end += 1;
    }
    if rep.get(cap_end).is_none_or(|&b| b != b'}') {
        return None;
    }

    // When looking at braced names, we don't put any restrictions on the name,
    // so it's possible it could be invalid UTF-8. But a capture group name
    // can never be invalid UTF-8, so if we have invalid UTF-8, then we can
    // safely return None.
    let name = core::str::from_utf8(&rep[..cap_end + 1]).ok()?;
    Some(Capture::new(name, open_span.end_offset(name.len())))
}

fn is_valid_cap_letter(b: u8) -> bool {
    matches!(b, b'0'..=b'9' | b'a'..=b'z' | b'A'..=b'Z' | b'_')
}

#[cfg(test)]
mod tests {
    use super::*;

    use proptest::prelude::*;

    #[test]
    fn literal_dollar_sign() {
        let replace = "$$0";
        let mut cap_iter = ReplaceCaptureIter::new(replace);
        assert!(cap_iter.next().is_none());
    }

    #[test]
    fn wacky_captures() {
        let replace =
            "$foo $1 $1invalid ${1}valid ${valid} $__${__weird__}${${__}";

        let cap_iter = ReplaceCaptureIter::new(replace);
        let expecteds = &[
            "foo",
            "1",
            "1invalid",
            "{1}",
            "{valid}",
            "__",
            "{__weird__}",
            "{${__}",
        ];
        for (&expected, cap) in expecteds.iter().zip(cap
```

### Core Architecture Module: `sd/src/unescape.rs`
```
use std::char;
use std::str::Chars;

/// Takes in a string with backslash escapes written out with literal backslash characters and
/// converts it to a string with the proper escaped characters.
pub fn unescape(input: &str) -> String {
    let mut chars = input.chars();
    let mut s = String::new();

    while let Some(c) = chars.next() {
        if c != '\\' {
            s.push(c);
            continue;
        }
        let Some(char) = chars.next() else {
            // This means that the last char is a `\\`
            assert_eq!(c, '\\');
            s.push('\\');
            break;
        };

        let escaped: Option<char> = match char {
            'n' => Some('\n'),
            'r' => Some('\r'),
            't' => Some('\t'),
            '\'' => Some('\''),
            '\"' => Some('\"'),
            '\\' => Some('\\'),
            'u' => escape_n_chars(&mut chars, 4),
            'x' => escape_n_chars(&mut chars, 2),
            _ => None,
        };
        if let Some(char) = escaped {
            // Successfully escaped a sequence
            s.push(char);
        } else {
            // User didn't meant to escape that
            s.push('\\');
            s.push(char);
        }
    }

    s
}

/// This is for sequences such as `\x08` or `\u1234`
fn escape_n_chars(chars: &mut Chars<'_>, length: usize) -> Option<char> {
    let s = chars.as_str().get(0..length)?;
    let u = u32::from_str_radix(s, 16).ok()?;
    let ch = char::from_u32(u)?;
    _ = chars.nth(length);
    Some(ch)
}

#[cfg(test)]
mod test {
    use std::fmt::Write as _;

    #[test]
    fn test_unescape() {
        let mut out = String::new();
        let mut test = |s: &str, name: &str| {
            writeln!(out, "{name}: `{s}` -> `{}`", super::unescape(s)).unwrap();
        };

        test("", "empty");
        test("\\", "single backslash");
        test("\\\\", "two backslashes");
        test("\\n", "newline");
        test("\\t", "tab");
        test("\\r", "carriage return");
        test("\\\"", "escaped double quote");
        test("\\'", "escaped single quote");
        test("\\\\", "escaped backslash");
        test("\\u0042", "unicode escape");
        test("\\x41", "hex escape");
        test("\\xG", "invalid hex escape");
        test("\\u00Z1", "invalid unicode escape");
        test("a\\t\\xG\\n", "mixed valid and invalid escapes");
        test("ab", "non-escape characters");
        test("\\u004", "incomplete escape sequence");
        test("a", "single characters");
        test("\\t{", "issue #313");
        test("\\t\\{", "issue #313");

        insta::assert_snapshot!(out);
    }
}

```

### Core Architecture Module: `xtask/src/generate.rs`
```
mod sd {
    include!("../../sd-cli/src/cli.rs");
}
use sd::Options;

use std::{fs, path::Path};

use clap::{CommandFactory, ValueEnum};
use clap_complete::{Shell, generate_to};
use roff::{Roff, bold, roman};

pub fn generate() {
    let gen_dir = Path::new("gen");
    gen_shell(gen_dir);
    gen_man(gen_dir);
}

fn gen_shell(base_dir: &Path) {
    let completions_dir = base_dir.join("completions");
    fs::create_dir_all(&completions_dir).unwrap();

    let mut cmd = Options::command();
    for &shell in Shell::value_variants() {
        generate_to(shell, &mut cmd, "sd", &completions_dir).unwrap();
    }
}

fn gen_man(base_dir: &Path) {
    let man_path = base_dir.join("sd.1");
    let cmd = Options::command();
    let mut buffer: Vec<u8> = Vec::new();

    let man = clap_mangen::Man::new(cmd);
    man.render_title(&mut buffer)
        .expect("failed to render title section");
    man.render_name_section(&mut buffer)
        .expect("failed to render name section");
    man.render_synopsis_section(&mut buffer)
        .expect("failed to render synopsis section");
    man.render_description_section(&mut buffer)
        .expect("failed to render description section");
    man.render_options_section(&mut buffer)
        .expect("failed to render options section");

    let statuses = [
        ("0", "Successful program execution."),
        ("1", "Unsuccessful program execution."),
        ("101", "The program panicked."),
    ];
    let mut sect = Roff::new();
    sect.control("SH", ["EXIT STATUS"]);
    for (code, reason) in statuses {
        sect.control("IP", [code]).text([roman(reason)]);
    }
    sect.to_writer(&mut buffer)
        .expect("failed to render exit status section");

    let examples = [
        // (description, command, result), result can be empty
        (
            "String-literal mode",
            "echo 'lots((([]))) of special chars' | sd -F '((([])))' ''",
            "lots of special chars",
        ),
        (
            "Regex use. Let's trim some trailing whitespace",
            "echo 'lorem ipsum 23   ' | sd '\\s+$' ''",
            "lorem ipsum 23",
        ),
        (
            "Indexed capture groups",
            r"echo 'cargo +nightly watch' | sd '(\w+)\s+\+(\w+)\s+(\w+)' 'cmd: $1, channel: $2, subcmd: $3'",
            "cmd: cargo, channel: nightly, subcmd: watch",
        ),
        (
            "Find & replace in file",
            r#"sd 'window.fetch' 'fetch' http.js"#,
            "",
        ),
        (
            "Find & replace from STDIN an emit to STDOUT",
            r#"sd 'window.fetch' 'fetch' < http.js"#,
            "",
        ),
    ];
    let mut sect = Roff::new();
    sect.control("SH", ["EXAMPLES"]);
    for (desc, command, result) in examples {
        sect.control("TP", [])
            .text([roman(desc)])
            .text([bold(format!("$ {}", command))])
            .control("br", [])
            .text([roman(result)]);
    }
    sect.to_writer(&mut buffer)
        .expect("failed to render example section");

    std::fs::write(man_path, buffer).expect("failed to write manpage");
}

```

### Core Architecture Module: `xtask/src/main.rs`
```
use std::{
    env,
    path::{Path, PathBuf},
};

use clap::{Parser, Subcommand};

mod generate;

#[derive(Parser)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate static assets
    Gen,
}

fn main() {
    let Cli { command } = Cli::parse();

    env::set_current_dir(project_root()).unwrap();

    match command {
        Commands::Gen => generate::generate(),
    }
}

fn project_root() -> PathBuf {
    Path::new(
        &env::var("CARGO_MANIFEST_DIR")
            .unwrap_or_else(|_| env!("CARGO_MANIFEST_DIR").to_owned()),
    )
    .ancestors()
    .nth(1)
    .unwrap()
    .to_path_buf()
}

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

### Incident Patch 1: `c864c580` (2026-02-25)
**Commit Message**: add linux aarch64 gnu target to CI and releases

**File**: `.github/workflows/publish.yml` (modified, +4/-4)
```diff
@@ -36,10 +36,6 @@ jobs:
             target: aarch64-pc-windows-msvc
             use-cross: false
 
-          - os: windows-latest
-            target: aarch64-pc-windows-gnullvm
-            use-cross: false
-
           - os: macos-latest
             target: x86_64-apple-darwin
             use-cross: false
@@ -52,6 +48,10 @@ jobs:
             target: aarch64-unknown-linux-musl
             use-cross: true
 
+          - os: ubuntu-latest
+            target: aarch64-unknown-linux-gnu
+            use-cross: true
+
           - os: ubuntu-latest
             target: armv7-unknown-linux-gnueabihf
             use-cross: true
```

**File**: `.github/workflows/test.yml` (modified, +4/-4)
```diff
@@ -35,10 +35,6 @@ jobs:
             target: aarch64-pc-windows-msvc
             use-cross: false
 
-          - os: windows-latest
-            target: aarch64-pc-windows-gnullvm
-            use-cross: false
-
           - os: macos-latest
             target: x86_64-apple-darwin
             use-cross: false
@@ -51,6 +47,10 @@ jobs:
             target: aarch64-unknown-linux-musl
             use-cross: true
 
+          - os: ubuntu-latest
+            target: aarch64-unknown-linux-gnu
+            use-cross: true
+
           - os: ubuntu-latest
             target: armv7-unknown-linux-gnueabihf
             use-cross: true
```

---

### Incident Patch 2: `90bc67d6` (2026-02-25)
**Commit Message**: add Windows ARM64 GNU/GNUllvm release targets

**File**: `.github/workflows/publish.yml` (modified, +8/-0)
```diff
@@ -32,6 +32,14 @@ jobs:
             target: x86_64-pc-windows-msvc
             use-cross: false
 
+          - os: windows-latest
+            target: aarch64-pc-windows-msvc
+            use-cross: false
+
+          - os: windows-latest
+            target: aarch64-pc-windows-gnullvm
+            use-cross: false
+
           - os: macos-latest
             target: x86_64-apple-darwin
             use-cross: false
```

**File**: `.github/workflows/test.yml` (modified, +8/-0)
```diff
@@ -31,6 +31,14 @@ jobs:
             target: x86_64-pc-windows-msvc
             use-cross: false
 
+          - os: windows-latest
+            target: aarch64-pc-windows-msvc
+            use-cross: false
+
+          - os: windows-latest
+            target: aarch64-pc-windows-gnullvm
+            use-cross: false
+
           - os: macos-latest
             target: x86_64-apple-darwin
             use-cross: false
```

---

### Incident Patch 3: `4a7b2165` (2026-02-25)
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

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

* feat: make line-by-line the default, add --across (-A) for whole-file

Line-by-line pr

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

**File**: `gen/completions/_sd.ps1` (modified, +2/-0)
```diff
@@ -29,6 +29,8 @@ Register-ArgumentCompleter -Native -CommandName 'sd' -ScriptBlock {
             [CompletionResult]::new('--preview', 'preview', [CompletionResultType]::ParameterName, 'Display changes in a human reviewable format (the specifics of the format are likely to change in the future)')
             [CompletionResult]::new('-F', 'F ', [CompletionResultType]::ParameterName, 'Treat FIND and REPLACE_WITH args as literal strings')
             [CompletionResult]::new('--fixed-strings', 'fixed-strings', [CompletionResultType]::ParameterName, 'Treat FIND and REPLACE_WITH args as literal strings')
+            [CompletionResult]::new('-A', 'A ', [CompletionResultType]::ParameterName, 'Process each input as a whole rather than line by line. This allows patterns to match across line boundaries but uses more memory and prevents streaming')
+            [CompletionResult]::new('--across', 'across', [CompletionResultType]::ParameterName, 'Process each input as a whole rather than line by line. This allows patterns to match across line boundaries but uses more memory and prevents streaming')
             [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Print help (see more with ''--help'')')
             [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Print help (see more with ''--help'')')
             [CompletionResult]::new('-V', 'V ', [CompletionResultType]::ParameterName, 'Print version')
```

**File**: `gen/completions/sd.bash` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ _sd() {
 
     case "${cmd}" in
         sd)
-            opts="-p -F -n -f -h -V --preview --fixed-strings --max-replacements --flags --help --version <FIND> <REPLACE_WITH> [FILES]..."
+            opts="-p -F -n -f -A -h -V --preview --fixed-strings --max-replacements --flags --across --help --version <FIND> <REPLACE_WITH> [FILES]..."
             if [[ ${cur} == -* || ${COMP_CWORD} -eq 1 ]] ; then
                 COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
                 return 0
```

**File**: `gen/completions/sd.elv` (modified, +2/-0)
```diff
@@ -26,6 +26,8 @@ set edit:completion:arg-completer[sd] = {|@words|
             cand --preview 'Display changes in a human reviewable format (the specifics of the format are likely to change in the future)'
             cand -F 'Treat FIND and REPLACE_WITH args as literal strings'
             cand --fixed-strings 'Treat FIND and REPLACE_WITH args as literal strings'
+            cand -A 'Process each input as a whole rather than line by line. This allows patterns to match across line boundaries but uses more memory and prevents streaming'
+            cand --across 'Process each input as a whole rather than line by line. This allows patterns to match across line boundaries but uses more memory and prevents streaming'
             cand -h 'Print help (see more with ''--help'')'
             cand --help 'Print help (see more with ''--help'')'
             cand -V 'Print version'
```

---

### Incident Patch 4: `84c7e6e8` (2025-12-20)
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

### Incident Patch 5: `25c4aac1` (2025-12-20)
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

### Incident Patch 6: `61285dfe` (2025-09-18)
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

### Incident Patch 7: `1254e038` (2025-04-18)
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

**File**: `src/snapshots/sd__unescape__test__unescape.snap` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+---
+source: src/unescape.rs
+expression: out
+---
+empty: `` -> ``
+single backslash: `\` -> `\`
+two backslashes: `\\` -> `\`
+newline: `\n` -> `
+`
+tab: `\t` -> `	`
+carriage return: `\r` -> ``
+escaped double quote: `\"` -> `"`
+escaped single quote: `\'` -> `'`
+escaped backslash: `\\` -> `\`
+unicode escape: `\u0042` -> `B`
+hex escape: `\x41` -> `A`
+invalid hex escape: `\xG` -> `\xG`
+invalid unicode escape: `\u00Z1` -> `\u00Z1`
+mixed valid and invalid escapes: `a\t\xG\n` -> `a	\xG
+`
+non-escape characters: `ab` -> `ab`
+incomplete escape sequence: `\u004` -> `\u004`
+single characters: `a` -> `a`
+issue #313: `\t{` -> `	{`
+issue #313: `\t\{` -> `	\{`
```

**File**: `src/unescape.rs` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+use std::char;
+use std::str::Chars;
+
+/// Takes in a string with backslash escapes written out with literal backslash characters and
+/// converts it to a string with the proper escaped characters.
+pub fn unescape(input: &str) -> String {
+    let mut chars = input.chars();
+    let mut s = String::new();
+
+    while let Some(c) = chars.next() {
+        if c != '\\' {
+            s.push(c);
+            continue;
+        }
+        let Some(char) = chars.next() else {
+            // This means that the last char is a `\\`
+            assert_eq!(c, '\\');
+            s.push('\\');
+            break;
+        };
+
+        let escaped: Option<char> = match char {
+            'n' => Some('\n'),
+            'r' => Some('\r'),
+            't' => Some('\t'),
+            '\'' => Some('\''),
+            '\"' => Some('\"'),
+            '\\' => Some('\\'),
+            'u' => escape_n_chars(&mut chars, 4),
+            'x' => escape_n_chars(&mut chars, 2),
+            _ => None,
+        };
+        if let Some(char) = escaped {
+            // Successfully escaped a sequence
+            s.push(char);
+        } else {
+            // User didn't meant to escape that
+            s.push('\\');
+            s.push(char);
+        }
+    }
+
+    s
+}
+
+/// This is for sequences such as `\x08` or `\u1234`
+fn escape_n_chars(chars: &mut Chars<'_>, length: usize) -> Option<char> {
+    let s = chars.as_str().get(0..length)?;
+    let u = u32::from_str_radix(&s, 16).ok()?;
+    let ch = char::from_u32(u)?;
+    _ = chars.nth(length);
+    Some(ch)
+}
+
+#[cfg(test)]
+mod test {
+    use std::fmt::Write as _;
+
+    #[test]
+    fn test_unescape() {
+        let mut out = String::new();
+        let mut test = |s: &str, name: &str| {
+            writeln!(out, "{name}: `{s}` -> `{}`", super::unescape(s)).unwrap();
+        };
+
+        test("", "empty");
+        test("\\", "single backslash");
+        test("\\\\", "two backslashes");
+        test("\\n", "newline");
+        test("\\t", "tab");
+        test("\\r", "carriage return");
+        test("\\\"", "escaped double quote");
+        test("\\'", "escaped single quote");
+        test("\\\\", "escaped backslash");
+        test("\\u0042", "unicode escape");
+        test("\\x41", "hex escape");
+        test("\\xG", "invalid hex escape");
+        test("\\u00Z1", "invalid unicode escape");
+        test("a\\t\\xG\\n", "mixed valid and invalid escapes");
+        test("ab", "non-escape characters");
+        test("\\u004", "incomplete escape sequence");
+        test("a", "single characters");
+        test("\\t{", "issue #313");
+        test("\\t\\{", "issue #313");
+
+        insta::assert_snapshot!(out);
+    }
+}
```

---

### Incident Patch 8: `97bd728a` (2024-05-06)
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

### Incident Patch 9: `0fd8524b` (2024-02-19)
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

### Incident Patch 10: `bbefeb8a` (2023-11-05)
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

### Incident Patch 11: `a98100fb` (2023-10-24)
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

### Incident Patch 12: `20b1459a` (2023-10-22)
**Commit Message**: Actually use the build target intended for each CI job (#252)

**File**: `.github/workflows/publish.yml` (modified, +12/-4)
```diff
@@ -66,7 +66,13 @@ jobs:
       with:
         targets: ${{ matrix.target }}
 
-    - name: Install Cross
+    - name: Setup native compilation
+      if: ${{ matrix.use-cross == false }}
+      shell: bash
+      run: |
+        echo "CARGO=cargo" >> $GITHUB_ENV
+
+    - name: Setup cross compilation
       if: ${{ matrix.use-cross == true }}
       shell: bash
       run: |
@@ -77,12 +83,14 @@ jobs:
         curl -LO "https://github.com/cross-rs/cross/releases/download/v0.2.5/cross-x86_64-unknown-linux-musl.tar.gz"
         tar xf cross-x86_64-unknown-linux-musl.tar.gz
         echo "CARGO=cross" >> $GITHUB_ENV
-        echo "RUSTFLAGS='--cfg sd_cross_compile'"
-        echo "TARGET_FLAGS=--target ${{ matrix.target }}" >> $GITHUB_ENV
+        echo "RUSTFLAGS=--cfg sd_cross_compile" >> $GITHUB_ENV
+        echo "TARGET_DIR=./target/${{ matrix.target }}" >> $GITHUB_ENV
 
     - name: Build
+      shell: bash
       run: |
-        cargo build --release --locked
+        $CARGO --version
+        $CARGO build --release --locked --target ${{ matrix.target }}
 
     - name: Upload binaries to release
       uses: svenstaro/upload-release-action@2.7.0
```

**File**: `.github/workflows/test.yml` (modified, +10/-3)
```diff
@@ -60,6 +60,12 @@ jobs:
       with:
         targets: ${{ matrix.target }}
 
+    - name: Setup native compilation
+      if: ${{ matrix.use-cross == false }}
+      shell: bash
+      run: |
+        echo "CARGO=cargo" >> $GITHUB_ENV
+
     - name: Install Cross
       if: ${{ matrix.use-cross == true }}
       shell: bash
@@ -71,10 +77,11 @@ jobs:
         curl -LO "https://github.com/cross-rs/cross/releases/download/v0.2.5/cross-x86_64-unknown-linux-musl.tar.gz"
         tar xf cross-x86_64-unknown-linux-musl.tar.gz
         echo "CARGO=cross" >> $GITHUB_ENV
-        echo "RUSTFLAGS='--cfg sd_cross_compile'"
-        echo "TARGET_FLAGS=--target ${{ matrix.target }}" >> $GITHUB_ENV
+        echo "RUSTFLAGS=--cfg sd_cross_compile" >> $GITHUB_ENV
         echo "TARGET_DIR=./target/${{ matrix.target }}" >> $GITHUB_ENV
 
     - name: Test
+      shell: bash
       run: |
-        cargo test
+        $CARGO --version
+        $CARGO test --target ${{ matrix.target }}
```

---

### Incident Patch 13: `4dab4123` (2023-10-18)
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

---

### Incident Patch 14: `a730b276` (2023-08-20)
**Commit Message**: Adding Windows builds back (#206)

**File**: `.github/workflows/publish.yml` (modified, +7/-4)
```diff
@@ -24,10 +24,13 @@ jobs:
             target: arm-unknown-linux-gnueabihf
             use-cross: true
 
-          # This isn't working right now. See this: https://github.com/chmln/sd/pull/179#discussion_r1195840367
-          # - os: windows-latest
-          #   target: x86_64-pc-windows-msvc
-          #   use-cross: false
+          - os: windows-latest
+            target: x86_64-pc-windows-gnu
+            use-cross: false
+
+          - os: windows-latest
+            target: x86_64-pc-windows-msvc
+            use-cross: false
 
           - os: macos-latest
             target: x86_64-apple-darwin
```

**File**: `.github/workflows/test.yml` (modified, +7/-4)
```diff
@@ -23,10 +23,13 @@ jobs:
             target: arm-unknown-linux-gnueabihf
             use-cross: true
 
-          # This isn't working right now. See this: https://github.com/chmln/sd/pull/179#discussion_r1195840870
-          # - os: windows-latest
-          #   target: x86_64-pc-windows-msvc
-          #   use-cross: false
+          - os: windows-latest
+            target: x86_64-pc-windows-gnu
+            use-cross: false
+
+          - os: windows-latest
+            target: x86_64-pc-windows-msvc
+            use-cross: false
 
           - os: macos-latest
             target: x86_64-apple-darwin
```

---

### Incident Patch 15: `4456de5f` (2023-08-20)
**Commit Message**: Adding `armv7-unknown-linux-gnueabihf` target (#204)

**File**: `.github/workflows/publish.yml` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ jobs:
             target: aarch64-unknown-linux-musl
             use-cross: true
 
+          - os: ubuntu-latest
+            target: armv7-unknown-linux-gnueabihf
+            use-cross: true
+
     steps:
     - name: Checkout repository
       uses: actions/checkout@v2
```

**File**: `.github/workflows/test.yml` (modified, +4/-0)
```diff
@@ -39,6 +39,10 @@ jobs:
             target: aarch64-unknown-linux-musl
             use-cross: true
 
+          - os: ubuntu-latest
+            target: armv7-unknown-linux-gnueabihf
+            use-cross: true
+
     steps:
     - name: Checkout repository
       uses: actions/checkout@v2
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
