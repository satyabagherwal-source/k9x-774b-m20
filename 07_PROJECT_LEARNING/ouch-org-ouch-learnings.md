# Forensic Learning Record (Deep Inspection): ouch-org/ouch

> **Canonical Artifact**: `07_PROJECT_LEARNING/ouch-org-ouch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ouch-org/ouch](https://github.com/ouch-org/ouch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:56:00.328Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ouch-org/ouch`
- **Description**: Painless compression and decompression in the terminal
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3780 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils/colors.rs`
```
//! Colored output in ouch with bright colors.

#![allow(dead_code)]

use std::{
    env,
    io::{self, IsTerminal},
    ops::Not,
    sync::LazyLock,
};

pub static DISABLE_COLORED_TEXT: LazyLock<bool> = LazyLock::new(|| {
    io::stdout().is_terminal().not() || io::stderr().is_terminal().not() || env::var_os("NO_COLOR").is_some()
});

macro_rules! color {
    ($name:ident = $value:literal) => {
        #[cfg(target_family = "unix")]
        /// Inserts color onto text based on configuration
        pub static $name: LazyLock<&str> = LazyLock::new(|| if *DISABLE_COLORED_TEXT { "" } else { $value });
        #[cfg(not(target_family = "unix"))]
        pub static $name: &&str = &"";
    };
}

color!(RESET = "\u{1b}[39m");
color!(BLACK = "\u{1b}[38;5;8m");
color!(BLUE = "\u{1b}[38;5;12m");
color!(CYAN = "\u{1b}[38;5;14m");
color!(GREEN = "\u{1b}[38;5;10m");
color!(MAGENTA = "\u{1b}[38;5;13m");
color!(RED = "\u{1b}[38;5;9m");
color!(WHITE = "\u{1b}[38;5;15m");
color!(YELLOW = "\u{1b}[38;5;11m");
// Requires true color support
color!(ORANGE = "\u{1b}[38;2;255;165;0m");
color!(STYLE_BOLD = "\u{1b}[1m");
color!(STYLE_RESET = "\u{1b}[0m");
color!(ALL_RESET = "\u{1b}[0;39m");

```

### Core Architecture Module: `src/utils/file_visibility.rs`
```
use std::{
    ffi::OsStr,
    iter,
    path::{Path, PathBuf},
};

use fs_err as fs;

/// Determines which files should be read or ignored during directory walking
pub struct FileVisibilityPolicy {
    /// Enables reading .ignore files.
    ///
    /// Disabled by default.
    pub read_ignore: bool,

    /// If enabled, ignores hidden files.
    ///
    /// Disabled by default
    pub read_hidden: bool,

    /// Enables reading .gitignore files.
    ///
    /// This is enabled by default.
    pub read_git_ignore: bool,

    /// Enables reading `.git/info/exclude` files.
    pub read_git_exclude: bool,

    pub follow_symlinks: bool,
}

impl Default for FileVisibilityPolicy {
    fn default() -> Self {
        Self {
            read_ignore: false,
            read_hidden: true,
            read_git_ignore: false,
            read_git_exclude: false,
            follow_symlinks: false,
        }
    }
}

impl FileVisibilityPolicy {
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    /// Enables reading .ignore files.
    pub fn read_ignore(self, read_ignore: bool) -> Self {
        Self { read_ignore, ..self }
    }

    #[must_use]
    /// Enables reading .gitignore files.
    pub fn read_git_ignore(self, read_git_ignore: bool) -> Self {
        Self {
            read_git_ignore,
            ..self
        }
    }

    #[must_use]
    /// Enables reading `.git/info/exclude` files.
    pub fn read_git_exclude(self, read_git_exclude: bool) -> Self {
        Self {
            read_git_exclude,
            ..self
        }
    }

    #[must_use]
    /// Enables reading `.git/info/exclude` files.
    pub fn read_hidden(self, read_hidden: bool) -> Self {
        Self { read_hidden, ..self }
    }

    #[must_use]
    pub fn follow_symlinks(self, follow_symlinks: bool) -> Self {
        Self {
            follow_symlinks,
            ..self
        }
    }

    /// Walks through a directory using [`ignore::Walk`]
    pub fn build_walker(&self, path: impl AsRef<Path>) -> ignore::Walk {
        let mut builder = ignore::WalkBuilder::new(path);

        builder
            .git_exclude(self.read_git_exclude)
            .git_ignore(self.read_git_ignore)
            .ignore(self.read_ignore)
            .hidden(self.read_hidden)
            .follow_links(self.follow_symlinks);

        if self.read_git_ignore {
            builder.filter_entry(|p| p.path().file_name().is_some_and(|name| name != ".git"));
            builder.require_git(false);
        }

        builder.build()
    }

    // workaround for ignore::Walk failing if the first given path is a broken symlink
    // even if follow_symlinks is set to false
    //
    // used by tar and zip
    pub fn workaround_build_walker_or_broken_link_path(
        &self,
        explicit_path: &Path,
        filename: &OsStr,
    ) -> Box<dyn Iterator<Item = Result<PathBuf, ignore::Error>> + 'static> {
        let is_broken_symlink = explicit_path.is_symlink() && fs::metadata(explicit_path).is_err();

        let iter: Box<dyn Iterator<Item = Result<PathBuf, ignore::Error>>> = if is_broken_symlink {
            Box::new(iter::once(Ok(PathBuf::from(filename))))
        } else {
            Box::new(
                self.build_walker(filename)
                    .map(|result| result.map(ignore::DirEntry::into_path)),
            )
        };
        iter
    }
}

```

### Core Architecture Module: `src/utils/formatting.rs`
```
use std::{
    borrow::Cow,
    cmp,
    ffi::{OsStr, OsString},
    fmt::{self, Write as _},
    path::{Path, PathBuf},
};

use crate::INITIAL_CURRENT_DIR;

/// Converts an OsStr to utf8 with custom formatting.
///
/// This is different from [`Path::display`].
///
/// See <https://gist.github.com/marcospb19/ebce5572be26397cf08bbd0fd3b65ac1> for a comparison.
pub fn path_to_str(path: &Path) -> Cow<'_, str> {
    os_str_to_str(path.as_ref())
}

pub fn os_str_to_str(os_str: &OsStr) -> Cow<'_, str> {
    let format = || {
        let text = format!("{os_str:?}");
        Cow::Owned(text.trim_matches('"').to_string())
    };

    os_str.to_str().map_or_else(format, Cow::Borrowed)
}

/// Removes the current dir from the beginning of a path as it's redundant information,
/// useful for presentation sake.
pub fn strip_cur_dir(source_path: &Path) -> &Path {
    source_path.strip_prefix(&*INITIAL_CURRENT_DIR).unwrap_or(source_path)
}

/// Converts a slice of `AsRef<OsStr>` to comma separated String
///
/// Panics if the slice is empty.
pub fn pretty_format_list_of_paths(paths: &[impl AsRef<Path>]) -> String {
    let mut string = String::new();
    for (i, path) in paths.iter().enumerate() {
        if i != 0 {
            string += ", ";
        }
        write!(string, "{}", PathFmt(path.as_ref())).expect("Couldn't write to a string");
    }
    string
}

/// Display the directory name, but use "current directory" when necessary.
pub fn nice_directory_display(path: &Path) -> Cow<'_, str> {
    if path == Path::new(".") {
        Cow::Borrowed("current directory")
    } else {
        path_to_str(path)
    }
}

/// Strips an ascii prefix from the path (similar to `<&str>::strip_prefix`).
///
/// # Panics:
///
/// - Panics if prefix is not valid ASCII (to ensure safety).
pub fn strip_path_ascii_prefix<'a>(path: Cow<'a, Path>, ascii_prefix: &str) -> Cow<'a, Path> {
    assert!(ascii_prefix.is_ascii());
    let prefix_slice = ascii_prefix.as_bytes();
    let path_slice = path.as_os_str().as_encoded_bytes();

    if let Some(stripped) = path_slice.strip_prefix(prefix_slice) {
        // Encoding Safety:
        //   this function returns a format that is guaranteed to be a superset
        //   of UTF-8, it might be WTF-8 encoding surrogates in UTF-8-like ways,
        //   it's impossible for us to break surrogate pairs or character
        //   boundaries if we slice an ASCII prefix, ASCII characters in WTF-8
        //   and UTF-8 look exactly just like in plain ASCII encoding
        let str = unsafe { OsStr::from_encoded_bytes_unchecked(stripped) };
        Cow::from(PathBuf::from(str))
    } else {
        path
    }
}

/// Append an ASCII suffix to an OS string.
///
/// # Panics:
///
/// - Panics if suffix is not valid ASCII (to ensure safety).
pub fn append_ascii_suffix_to_os_str(os_str: &OsStr, ascii_suffix: &str) -> OsString {
    assert!(ascii_suffix.is_ascii());

    let mut bytes = os_str.as_encoded_bytes().to_vec();
    bytes.extend_from_slice(ascii_suffix.as_bytes());

    // Safety: appending ASCII bytes to a valid OsStr encoding preserves validity.
    // ASCII characters in WTF-8/UTF-8 are encoded identically to plain ASCII,
    // so appending them cannot create invalid sequences or break encoding.
    unsafe { OsStr::from_encoded_bytes_unchecked(&bytes) }.to_owned()
}

pub struct PathFmt<'a>(pub &'a Path);
pub struct NoQuotePathFmt<'a>(pub &'a Path);

/// Returns true for bytes/chars that must be stripped before hitting a terminal
/// Covers C0 controls, DEL, C1 controls (U+0080..U+009F), line/paragraph separators,
/// BiDi formatting characters (Trojan Source, CVE-2021-42574), and zero-width
/// / invisible characters used for homoglyph or hidden-content attacks
pub fn is_unsafe_display_char(ch: char) -> bool {
    match ch {
        c if c.is_control() => true,
        '\u{2028}' | '\u{2029}' => true,
        '\u{202A}'..='\u{202E}' => true,
        '\u{2066}'..='\u{2069}' => true,
        '\u{200B}' | '\u{200C}' | '\u{200D}' | '\u{FEFF}' | '\u{00AD}' | '\u{180E}' | '\u{034F}' | '\u{061C}' => true,
        _ => false,
    }
}

pub fn contains_unsafe_display_char(text: &str) -> bool {
    text.chars().any(is_unsafe_display_char)
}

pub fn sanitize_for_display(text: &str) -> Cow<'_, str> {
    if !contains_unsafe_display_char(text) {
        return Cow::Borrowed(text);
    }

    let mut sanitized = String::with_capacity(text.len());
    for ch in text.chars() {
        if is_unsafe_display_char(ch) {
            sanitized.push('\u{FFFD}');
        } else {
            sanitized.push(ch);
        }
    }
    Cow::Owned(sanitized)
}

/// Same as NoQuotePathFmt, but surrounded by "".
impl<'a> fmt::Display for PathFmt<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "\"{}\"", NoQuotePathFmt(self.0))
    }
}

/// Same as `path.display()` but try to strip some common noise prefixes
/// Also strips control bytes and BiDi/zero-width chars to prevent terminal injection
impl<'a> fmt::Display for NoQuotePathFmt<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let path = self.0;
        debug_assert_ne!(path.as_os_str().as_encoded_bytes().len(), 0, "empty path");

        let path = strip_path_ascii_prefix(Cow::Borrowed(path), "./");
        let path = path.as_ref();

        let path = path.strip_prefix(&*INITIAL_CURRENT_DIR).unwrap_or(path);
        let path = if path.as_os_str().is_empty() {
            Path::new(".")
        } else {
            path
        };

        f.write_str(&sanitize_for_display(&path.display().to_string()))
    }
}

/// Pretty `fmt::Display` impl for printing bytes as kB, MB, GB, etc.
pub struct BytesFmt(pub u64);

impl BytesFmt {
    const UNIT_PREFIXES: [&'static str; 6] = ["", "ki", "Mi", "Gi", "Ti", "Pi"];
}

impl fmt::Display for BytesFmt {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let num = self.0 as f64;

        debug_assert!(num >= 0.0);
        if num < 1_f64 {
            return write!(f, "{num:>6.2}   B");
        }

        let delimiter = 1000_f64;
        let exponent = cmp::min((num.ln() / 6.90775).floor() as i32, 4);

        write!(
            f,
            "{:>6.2} {:>2}B",
            num / delimiter.powi(exponent),
            Self::UNIT_PREFIXES[exponent as usize],
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pretty_bytes_formatting() {
        fn format_bytes(bytes: u64) -> String {
            format!("{}", BytesFmt(bytes))
        }
        let b = 1;
        let kb = b * 1000;
        let mb = kb * 1000;
        let gb = mb * 1000;

        assert_eq!("  0.00   B", format_bytes(0)); // This is weird
        assert_eq!("  1.00   B", format_bytes(b));
        assert_eq!("999.00   B", format_bytes(b * 999));
        assert_eq!(" 12.00 MiB", format_bytes(mb * 12));
        assert_eq!("123.00 MiB", format_bytes(mb * 123));
        assert_eq!("  5.50 MiB", format_bytes(mb * 5 + kb * 500));
        assert_eq!("  7.54 GiB", format_bytes(gb * 7 + 540 * mb));
        assert_eq!("  1.20 TiB", format_bytes(gb * 1200));

        // bytes
        assert_eq!("234.00   B", format_bytes(234));
        assert_eq!("999.00   B", format_bytes(999));
        // kilobytes
        assert_eq!("  2.23 kiB", format_bytes(2234));
        assert_eq!(" 62.50 kiB", format_bytes(62500));
        assert_eq!("329.99 kiB", format_bytes(329990));
        // megabytes
        assert_eq!("  2.75 MiB", format_bytes(2750000));
        assert_eq!(" 55.00 MiB", format_bytes(55000000));
        assert_eq!("987.65 MiB", format_bytes(987654321));
        // gigabytes
        assert_eq!("  5.28 GiB", format_bytes(5280000000));
        assert_eq!(" 95.20 GiB", format_bytes(95200000000));
        assert_eq!("302.00 GiB", format_bytes(302000000000));
        assert_eq!("302.99 GiB", format_bytes(302990000000));
        // Weird approximation cases:
        assert_eq!("999.90 GiB", format_bytes(999900000000));
        assert_eq!("  1.00 TiB", format_bytes(999990000000));
    }

    #[test]
    fn strip_path_ascii_prefix_removes_prefix() {
        let p = PathBuf::from("./foo/bar");
        let stripped = strip_path_ascii_prefix(Cow::Borrowed(&p), "./");
        assert_eq!(stripped.as_ref(), Path::new("foo/bar"));
    }

    #[test]
    fn strip_path_ascii_prefix_no_match_returns_unchanged() {
        let p = PathBuf::from("foo/bar");
        let stripped = strip_path_ascii_prefix(Cow::Borrowed(&p), "./");
        assert_eq!(stripped.as_ref(), Path::new("foo/bar"));
    }

    #[test]
    fn strip_path_ascii_prefix_empty_prefix_is_noop() {
        let p = PathBuf::from("foo/bar");
        let stripped = strip_path_ascii_prefix(Cow::Borrowed(&p), "");
        assert_eq!(stripped.as_ref(), Path::new("foo/bar"));
    }

    #[test]
    fn append_ascii_suffix_appends_to_filename() {
        let result = append_ascii_suffix_to_os_str(OsStr::new("file"), ".bak");
        assert_eq!(result, OsString::from("file.bak"));
    }

    #[test]
    fn append_ascii_suffix_appends_to_empty_str() {
        let result = append_ascii_suffix_to_os_str(OsStr::new(""), "foo");
        assert_eq!(result, OsString::from("foo"));
    }

    #[test]
    fn nice_directory_display_dot_returns_phrase() {
        assert_eq!(nice_directory_display(Path::new(".")), "current directory");
    }

    #[test]
    fn nice_directory_display_other_returns_path() {
        assert_eq!(nice_directory_display(Path::new("foo/bar")), "foo/bar");
    }

    #[test]
    fn pretty_format_list_of_paths_single() {
        let paths = [PathBuf::from("a.txt")];
        assert_eq!(pretty_format_list_of_paths(&paths), "\"a.txt\"");
    }

    #[test]
    fn pretty_format_list_of_paths_multiple() {
        let paths = [PathBuf::from("a.txt"), PathBuf::from("b.txt"), PathBuf::from("c.txt")];
        assert_eq!(pretty_format_list_of_paths(&paths), "\"a.txt\", \"b.txt\", \"c.txt\"");
    }

    #[test]
    fn pretty_format_list
```

### Core Architecture Module: `src/utils/fs.rs`
```
//! Filesystem utility functions.

use std::{
    borrow::Cow,
    env,
    io::{self, Read, Write},
    path::{Path, PathBuf},
};

use fs_err::{self as fs, PathExt};
use same_file::Handle;

use super::{question::FileConflictOperation, user_wants_to_overwrite};
use crate::{
    FinalError, QuestionPolicy, Result,
    error::Error,
    extension::CompressionFormat,
    info_accessible,
    utils::{PathFmt, QuestionAction, strip_path_ascii_prefix},
};

pub fn is_path_stdin(path: &Path) -> bool {
    path.as_os_str() == "-"
}

/// Check if &Path exists, if it does then ask the user if they want to overwrite or rename it.
/// If the user want to overwrite then the file or directory will be removed and returned the same input path
/// If the user want to rename then nothing will be removed and a new path will be returned with a new name
///
/// * `Ok(None)` means the user wants to cancel the operation
/// * `Ok(Some(path))` returns a valid PathBuf without any another file or directory with the same name
/// * `Err(_)` is an error
pub fn resolve_path_conflict(
    path: &Path,
    question_policy: QuestionPolicy,
    question_action: QuestionAction,
) -> Result<Option<PathBuf>> {
    if path.fs_err_try_exists()? {
        match user_wants_to_overwrite(path, question_policy, question_action)? {
            FileConflictOperation::Cancel => Ok(None),
            FileConflictOperation::Overwrite => {
                remove_file_or_dir(path)?;
                Ok(Some(path.to_path_buf()))
            }
            FileConflictOperation::Rename => Ok(Some(find_available_filename_by_renaming(path)?)),
            FileConflictOperation::Merge => Ok(Some(path.to_path_buf())),
        }
    } else {
        Ok(Some(path.to_path_buf()))
    }
}

/// Decide where to extract a file when the path is taken. None means skip it.
pub fn resolve_extraction_conflict(path: &Path, question_policy: QuestionPolicy) -> Result<Option<PathBuf>> {
    // Only an existing file clashes. Directories merge and other kinds fail on write.
    if !path.is_file() {
        return Ok(Some(path.to_path_buf()));
    }

    // These choices fit a single file. They are rename or overwrite or skip.
    match user_wants_to_overwrite(path, question_policy, QuestionAction::Compression)? {
        FileConflictOperation::Cancel => Ok(None),
        FileConflictOperation::Rename => Ok(Some(find_available_filename_by_renaming(path)?)),
        FileConflictOperation::Overwrite | FileConflictOperation::Merge => Ok(Some(path.to_path_buf())),
    }
}

pub fn remove_file_or_dir(path: &Path) -> Result<()> {
    if path.is_dir() {
        if let Ok(cwd) = env::current_dir()
            && matches!(
                (Handle::from_path(path), Handle::from_path(&cwd)),
                (Ok(a), Ok(b)) if a == b
            )
        {
            return Err(
                FinalError::with_title("Refusing to delete the current working directory")
                    .detail(format!("Path {} is the current directory", PathFmt(path)))
                    .hint("Use a different output directory with `--dir` / `-d`")
                    .into(),
            );
        }
        fs::remove_dir_all(path)?;
    } else if path.is_file() {
        fs::remove_file(path)?;
    }
    Ok(())
}

pub fn file_size(path: &Path) -> Result<u64> {
    Ok(fs::metadata(path)?.len())
}

/// Say you want to write to `archive.tar.gz` but that already exists.
///
/// So the user chooses to `rename` to avoid the conflict (keep both files).
///
/// In this scenario, this function will return `archive_1.tar.gz`, subsequent
/// calls will keep incrementing the number:
///
/// - archive_1.tar.gz
/// - archive_2.tar.gz
/// - archive_3.tar.gz
pub fn find_available_filename_by_renaming(path: &Path) -> Result<PathBuf> {
    fn create_path_with_given_index(path: &Path, i: usize) -> PathBuf {
        let parent = path.parent().unwrap_or_else(|| Path::new(""));
        let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");

        let new_filename = match file_name.split_once('.') {
            Some((stem, extension)) if !stem.is_empty() => format!("{stem}_{i}.{extension}"),
            _ => format!("{file_name}_{i}"),
        };

        parent.join(new_filename)
    }

    for i in 1.. {
        let renamed_path = create_path_with_given_index(path, i);
        if !renamed_path.fs_err_try_exists()? {
            return Ok(renamed_path);
        }
    }
    unreachable!()
}

/// Creates a directory at the path, if there is nothing there.
pub fn create_dir_if_non_existent(path: &Path) -> Result<()> {
    if !path.fs_err_try_exists()? {
        fs::create_dir_all(path)?;
        info_accessible!("Directory {} created", PathFmt(path));
    }
    Ok(())
}

/// Ensures the parent directory of a file path exists, creating it if necessary.
/// Lexically normalize a relative path; returns None on absolute or escape via `..`.
pub fn normalize_safe_path(path: &Path) -> Option<PathBuf> {
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            std::path::Component::Normal(c) => out.push(c),
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                if !out.pop() {
                    return None;
                }
            }
            std::path::Component::Prefix(_) | std::path::Component::RootDir => return None,
        }
    }
    Some(out)
}

/// Reject ZipSlip-style entry paths; returns the lexically-normalized safe form.
pub fn validate_entry_path(path: &Path) -> Result<PathBuf> {
    normalize_safe_path(path).ok_or_else(|| {
        FinalError::with_title("refusing to extract archive entry with unsafe path")
            .detail(format!("entry: {}", PathFmt(path)))
            .into()
    })
}

/// Reject symlink targets whose relative path would escape the extraction root.
pub fn validate_symlink_target(link_relpath: &Path, target: &Path) -> Result<()> {
    if target.is_absolute() {
        return Ok(());
    }
    let parent = link_relpath.parent().unwrap_or(Path::new(""));
    if normalize_safe_path(&parent.join(target)).is_none() {
        return Err(
            FinalError::with_title("refusing to create symlink escaping extraction root")
                .detail(format!("link: {}  target: {}", PathFmt(link_relpath), PathFmt(target)))
                .into(),
        );
    }
    Ok(())
}

/// Refuse to write through an on-disk symlink created by an earlier entry.
/// Walks every existing prefix between root and dest and errors if any component is a symlink.
pub fn validate_dest_inside_root(root: &Path, dest: &Path) -> Result<()> {
    let rel = dest.strip_prefix(root).map_err(|_| {
        FinalError::with_title("refusing to write outside extraction root").detail(format!("dest: {}", PathFmt(dest)))
    })?;
    let mut probe = root.to_path_buf();
    for comp in rel.components() {
        probe.push(comp);
        match fs::symlink_metadata(&probe) {
            Ok(md) if md.file_type().is_symlink() => {
                return Err(
                    FinalError::with_title("refusing to traverse on-disk symlink during extraction")
                        .detail(format!("path: {}", PathFmt(&probe)))
                        .into(),
                );
            }
            _ => {}
        }
    }
    Ok(())
}

/// LZMA/XZ dictionary memory cap (256 MiB). Bounds malformed-stream allocations
pub const LZMA_MEMLIMIT_BYTES: u32 = 256 * 1024 * 1024;

pub fn max_decompressed_bytes() -> u64 {
    env::var("OUCH_MAX_DECOMPRESSED_BYTES")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(u64::MAX)
}

pub struct LimitedReader<R> {
    inner: R,
    remaining: u64,
}

impl<R: Read> LimitedReader<R> {
    pub fn new(inner: R) -> Self {
        Self {
            inner,
            remaining: max_decompressed_bytes(),
        }
    }
}

pub fn copy_limited_decompression<R: Read, W: Write>(reader: R, writer: &mut W) -> io::Result<u64> {
    let mut limited = LimitedReader::new(reader);
    io::copy(&mut limited, writer)
}

impl<R: Read> Read for LimitedReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if buf.is_empty() {
            return Ok(0);
        }

        if self.remaining == 0 {
            // Probe one byte to tell exactly-at-limit (EOF) from over-limit; discarded on error.
            let mut probe = [0u8; 1];
            return match self.inner.read(&mut probe)? {
                0 => Ok(0),
                _ => Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "decompression output exceeded configured limit (see OUCH_MAX_DECOMPRESSED_BYTES)",
                )),
            };
        }

        let bytes_to_ready = usize::try_from(self.remaining).unwrap_or(usize::MAX).min(buf.len());
        let bytes_read = self.inner.read(&mut buf[..bytes_to_ready])?;

        self.remaining = self.remaining.saturating_sub(bytes_read as u64);
        Ok(bytes_read)
    }
}

/// Strip setuid/setgid/sticky bits from an archive-supplied mode.
pub fn sanitize_archive_mode(mode: u32) -> u32 {
    mode & 0o0777
}

/// RAII guard that restores the process CWD on drop.
pub struct CwdGuard(Option<PathBuf>);

impl CwdGuard {
    pub fn new(previous: PathBuf) -> Self {
        Self(Some(previous))
    }
}

impl Drop for CwdGuard {
    fn drop(&mut self) {
        if let Some(p) = self.0.take() {
            let _ = env::set_current_dir(&p);
        }
    }
}

pub fn ensure_parent_dir_exists(file_path: &Path) -> io::Result<()> {
    if let Some(parent) = file_path.parent()
        && !parent.fs_err_try_exists()?
    {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

/// Returns current directory, but before change the process' directory to the
/// one that contains the file pointed to by `filename`.
pub fn cd_into_same_dir_as(filename: &Path) -> Result<PathBuf> {
    let previous_location = env::current_dir()?;

    l
```

### Core Architecture Module: `src/utils/io.rs`
```
use std::io::{self, StderrLock, StdoutLock, Write, stderr, stdout};

#[cfg(unix)]
use fs_err as fs;

use crate::utils::logger;

type StdioOutputLocks = (StdoutLock<'static>, StderrLock<'static>);

pub fn lock_and_flush_output_stdio() -> io::Result<StdioOutputLocks> {
    logger::flush_messages();

    let mut stdout = stdout().lock();
    stdout.flush()?;
    let mut stderr = stderr().lock();
    stderr.flush()?;

    Ok((stdout, stderr))
}

#[cfg(unix)]
pub fn is_stdin_dev_null() -> io::Result<bool> {
    use std::os::unix::fs::MetadataExt;

    let stdin = fs::metadata("/dev/stdin")?;
    let null = fs::metadata("/dev/null")?;
    Ok(stdin.dev() == null.dev() && stdin.ino() == null.ino())
}

#[cfg(not(unix))]
pub fn is_stdin_dev_null() -> io::Result<bool> {
    Ok(false)
}

/// Workaround for `dyn Read + Seek`
pub trait ReadSeek: io::Read + io::Seek {}
impl<T> ReadSeek for T where T: io::Read + io::Seek {}

```

### Core Architecture Module: `src/utils/logger.rs`
```
use std::{
    fmt,
    sync::{Arc, Barrier, OnceLock, mpsc},
    thread,
};

pub use logger_thread::spawn_logger_thread;

use super::{
    colors::{GREEN, ORANGE, RESET},
    formatting::{contains_unsafe_display_char, sanitize_for_display},
};
use crate::accessible::is_running_in_accessible_mode;

#[macro_export]
macro_rules! info {
    ($($arg:tt)*) => {
        $crate::utils::logger::info(format!($($arg)*))
    };
}

#[macro_export]
macro_rules! info_accessible {
    ($($arg:tt)*) => {
        $crate::utils::logger::info_accessible(format!($($arg)*))
    };
}

#[macro_export]
macro_rules! warning {
    ($($arg:tt)*) => {
        $crate::utils::logger::warning(format!($($arg)*))
    };
}

/// Global value used to determine which logs to display.
static LOG_DISPLAY_LEVEL: OnceLock<MessageLevel> = OnceLock::new();

fn should_display_log(level: &MessageLevel) -> bool {
    let global_level = &LOG_DISPLAY_LEVEL.get().copied().unwrap_or(MessageLevel::Info);
    level >= global_level
}

/// Set the value of the global [`LOG_DISPLAY_LEVEL`].
pub fn set_log_display_level(quiet: bool) {
    let level = if quiet { MessageLevel::Quiet } else { MessageLevel::Info };
    if LOG_DISPLAY_LEVEL.get().is_none() {
        LOG_DISPLAY_LEVEL.set(level).unwrap();
    }
}

/// Asks logger to shutdown and waits till it flushes all pending messages.
#[track_caller]
pub fn shutdown_logger_and_wait() {
    logger_thread::send_shutdown_command_and_wait();
}

/// Asks logger to flush all messages, useful before starting STDIN interaction.
#[track_caller]
pub fn flush_messages() {
    logger_thread::send_flush_command_and_wait();
}

/// An `[INFO]` log to be displayed if we're not running accessibility mode.
///
/// Same as `.info_accessible()`, but only displayed if accessibility mode
/// is turned off, which is detected by the function
/// `is_running_in_accessible_mode`.
///
/// Read more about accessibility mode in `accessible.rs`.
#[track_caller]
pub fn info(contents: String) {
    info_with_accessibility(contents, false);
}

/// An `[INFO]` log to be displayed.
///
/// Same as `.info()`, but also displays if `is_running_in_accessible_mode`
/// returns `true`.
///
/// Read more about accessibility mode in `accessible.rs`.
#[track_caller]
pub fn info_accessible(contents: String) {
    info_with_accessibility(contents, true);
}

#[track_caller]
fn info_with_accessibility(contents: String, accessible: bool) {
    logger_thread::send_print_command(PrintMessage {
        contents,
        accessible,
        level: MessageLevel::Info,
    });
}

#[track_caller]
pub fn warning(contents: String) {
    logger_thread::send_print_command(PrintMessage {
        contents,
        // Warnings are important and unlikely to flood, so they should be displayed
        accessible: true,
        level: MessageLevel::Warning,
    });
}

#[derive(Debug)]
enum LoggerCommand {
    Print(PrintMessage),
    Flush { finished_barrier: Arc<Barrier> },
    FlushAndShutdown { finished_barrier: Arc<Barrier> },
}

/// Message object used for sending logs from worker threads to a logging thread via channels.
/// See <https://github.com/ouch-org/ouch/issues/643>
#[derive(Debug)]
struct PrintMessage {
    contents: String,
    accessible: bool,
    level: MessageLevel,
}

impl PrintMessage {
    fn should_display(&self) -> bool {
        if self.level == MessageLevel::Quiet {
            return false;
        }

        if !should_display_log(&self.level) && !is_running_in_accessible_mode() {
            return false;
        }

        if self.level == MessageLevel::Info {
            return !is_running_in_accessible_mode() || self.accessible;
        }

        true
    }
}

impl fmt::Display for PrintMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        debug_assert!(
            self.should_display(),
            "Display called on message that shouldn't be displayed"
        );

        match self.level {
            MessageLevel::Info => {
                if !is_running_in_accessible_mode() {
                    write!(f, "{}[INFO]{} {}", *GREEN, *RESET, self.contents)?;
                } else if self.accessible {
                    write!(f, "{}Info:{} {}", *GREEN, *RESET, self.contents)?;
                }
            }
            MessageLevel::Warning => {
                if is_running_in_accessible_mode() {
                    write!(f, "{}Warning:{} {}", *ORANGE, *RESET, self.contents)?;
                } else {
                    write!(f, "{}[WARNING]{} {}", *ORANGE, *RESET, self.contents)?;
                }
            }
            MessageLevel::Quiet => {}
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
enum MessageLevel {
    Info,
    Warning,
    Quiet,
}

mod logger_thread {
    use std::{
        io::{Write, stderr},
        sync::{Arc, Barrier, mpsc::RecvTimeoutError},
        time::Duration,
    };

    use super::*;

    type LogReceiver = mpsc::Receiver<LoggerCommand>;
    type LogSender = mpsc::Sender<LoggerCommand>;

    static SENDER: OnceLock<LogSender> = OnceLock::new();

    #[track_caller]
    fn setup_channel() -> Option<LogReceiver> {
        let mut optional = None;
        SENDER.get_or_init(|| {
            let (tx, rx) = mpsc::channel();
            optional = Some(rx);
            tx
        });
        optional
    }

    #[track_caller]
    fn get_sender() -> &'static LogSender {
        SENDER.get().expect("No sender, you need to call `setup_channel` first")
    }

    #[track_caller]
    pub(super) fn send_print_command(msg: PrintMessage) {
        if cfg!(test) {
            spawn_logger_thread();
        }
        get_sender()
            .send(LoggerCommand::Print(msg))
            .expect("Failed to send print command");
    }

    #[track_caller]
    pub(super) fn send_flush_command_and_wait() {
        let barrier = Arc::new(Barrier::new(2));

        get_sender()
            .send(LoggerCommand::Flush {
                finished_barrier: barrier.clone(),
            })
            .expect("Failed to send flush command");

        barrier.wait();
    }

    #[track_caller]
    pub(super) fn send_shutdown_command_and_wait() {
        let barrier = Arc::new(Barrier::new(2));

        get_sender()
            .send(LoggerCommand::FlushAndShutdown {
                finished_barrier: barrier.clone(),
            })
            .expect("Failed to send shutdown command");

        barrier.wait();
    }

    pub fn spawn_logger_thread() {
        if let Some(log_receiver) = setup_channel() {
            thread::spawn(move || run_logger(log_receiver));
        }
    }

    fn run_logger(log_receiver: LogReceiver) {
        const FLUSH_TIMEOUT: Duration = Duration::from_millis(200);

        let mut buffer = Vec::new();

        loop {
            let msg = match log_receiver.recv_timeout(FLUSH_TIMEOUT) {
                Ok(msg) => msg,
                Err(RecvTimeoutError::Timeout) => {
                    flush_logs_to_stderr(&mut buffer);
                    continue;
                }
                Err(RecvTimeoutError::Disconnected) => unreachable!("sender is static"),
            };

            match msg {
                LoggerCommand::Print(msg) => {
                    // Append message to buffer
                    if msg.should_display() {
                        write_message_to_buffer(&mut buffer, &msg);
                    }
                }
                LoggerCommand::Flush { finished_barrier } => {
                    flush_logs_to_stderr(&mut buffer);
                    finished_barrier.wait();
                }
                LoggerCommand::FlushAndShutdown { finished_barrier } => {
                    flush_logs_to_stderr(&mut buffer);
                    finished_barrier.wait();
                    return;
                }
            }
        }
    }

    fn write_message_to_buffer(buffer: &mut Vec<u8>, msg: &PrintMessage) {
        if !contains_unsafe_display_char(&msg.contents) {
            writeln!(buffer, "{msg}").unwrap();
        } else {
            let msg = PrintMessage {
                contents: sanitize_for_display(&msg.contents).into_owned(),
                accessible: msg.accessible,
                level: msg.level,
            };
            writeln!(buffer, "{msg}").unwrap();
        }
    }

    fn flush_logs_to_stderr(buffer: &mut Vec<u8>) {
        if !buffer.is_empty() {
            // Ignore stderr write failures (broken pipe, closed terminal) instead of panicking
            let _ = stderr().write_all(buffer);
            buffer.clear();
        }
    }
}

```

### Core Architecture Module: `src/utils/mod.rs`
```
//! Random and miscellaneous utils used in ouch.
//!
//! In here we have the logic for custom formatting, some file and directory utils, and user
//! stdin interaction helpers.

pub mod colors;
pub mod io;
pub mod logger;
pub mod threads;

pub use self::{file_visibility::*, formatting::*, fs::*, question::*, utf8::*};
mod file_visibility;
mod formatting;
mod fs;
mod question;
mod utf8;

```

### Core Architecture Module: `src/utils/question.rs`
```
//! Utils related to asking [Y/n] questions to the user.
//!
//! Example:
//!   "Do you want to overwrite 'archive.tar.gz'? [Y/n]"

use std::{
    borrow::Cow,
    io::{self, BufRead, stdin},
    path::{Path, PathBuf},
};

use fs_err as fs;

use crate::{
    accessible::is_running_in_accessible_mode,
    error::{Error, FinalError, Result},
    utils::{
        self, colors,
        formatting::PathFmt,
        io::{is_stdin_dev_null, lock_and_flush_output_stdio},
    },
};

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
/// Determines if overwrite questions should be skipped or asked to the user
pub enum QuestionPolicy {
    /// Ask the user every time
    Ask,
    /// Set by `--yes`, will say 'Y' to all overwrite questions
    AlwaysYes,
    /// Set by `--no`, will say 'N' to all overwrite questions
    AlwaysNo,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
/// Determines which action is being questioned
pub enum QuestionAction {
    /// question called from a compression function
    Compression,
    /// question called from a decompression function
    Decompression,
}

#[derive(Default)]
/// Determines which action to do when there is a file conflict
pub enum FileConflictOperation {
    #[default]
    /// Cancel the operation
    Cancel,
    /// Overwrite the existing file with the new one
    Overwrite,
    /// Rename the file
    /// It'll be put "_1" at the end of the filename or "_2","_3","_4".. if already exists
    Rename,
    /// Merge conflicting folders
    Merge,
}

/// Check if QuestionPolicy flags were set, otherwise, ask user if they want to overwrite.
pub fn user_wants_to_overwrite(
    path: &Path,
    question_policy: QuestionPolicy,
    question_action: QuestionAction,
) -> Result<FileConflictOperation> {
    use FileConflictOperation as Op;

    match question_policy {
        QuestionPolicy::AlwaysYes => match question_action {
            QuestionAction::Decompression => Ok(Op::Merge),
            QuestionAction::Compression => Ok(Op::Overwrite),
        },
        QuestionPolicy::AlwaysNo => Ok(Op::Cancel),
        QuestionPolicy::Ask => prompt_user_for_file_conflict_resolution(path, question_action),
    }
}

/// Ask the user how to resolve a file or folder conflict.
pub fn prompt_user_for_file_conflict_resolution(
    path: &Path,
    question_action: QuestionAction,
) -> Result<FileConflictOperation> {
    use FileConflictOperation as Op;

    match question_action {
        QuestionAction::Compression => ChoicePrompt::new(
            format!("Handle file conflict for {}:", PathFmt(path)),
            [
                ("rename", Op::Rename, *colors::BLUE),
                ("overwrite", Op::Overwrite, *colors::GREEN),
                ("skip", Op::Cancel, *colors::RED),
            ],
        )
        .ask(),
        QuestionAction::Decompression if path.is_dir() => ChoicePrompt::new(
            format!("Handle file conflict for {}:", PathFmt(path)),
            [
                ("rename", Op::Rename, *colors::BLUE),
                ("merge", Op::Merge, *colors::ORANGE),
                ("skip", Op::Cancel, *colors::RED),
            ],
        )
        .ask(),
        QuestionAction::Decompression => ChoicePrompt::new(
            format!("Handle file conflict for {}:", PathFmt(path)),
            [
                ("rename", Op::Rename, *colors::BLUE),
                ("merge", Op::Merge, *colors::ORANGE),
                ("overwrite", Op::Overwrite, *colors::GREEN),
                ("skip", Op::Cancel, *colors::RED),
            ],
        )
        .ask(),
    }
}

/// Create the file if it doesn't exist and if it does then ask to overwrite it.
///
/// If the user doesn't want to overwrite then we return [`Ok(None)`]
///
/// Returns the new file name in case the user asked to rename the file to avoid
/// the conflict.
pub fn create_file_or_prompt_on_conflict(
    path: &Path,
    question_policy: QuestionPolicy,
    question_action: QuestionAction,
) -> Result<Option<(fs::File, PathBuf)>> {
    let path = path.to_owned();

    match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
        Ok(file) => return Ok(Some((file, path))),
        Err(e) if e.kind() != io::ErrorKind::AlreadyExists => return Err(Error::from(e)),

        Err(_file_already_exists) => {
            // Keep going, will prompt user to solve conflicts
        }
    }

    // Question policy override prompting
    let action = match question_policy {
        QuestionPolicy::AlwaysYes => FileConflictOperation::Overwrite,
        QuestionPolicy::AlwaysNo => FileConflictOperation::Cancel,
        QuestionPolicy::Ask => prompt_user_for_file_conflict_resolution(&path, question_action)?,
    };

    let path_to_create_file = match action {
        FileConflictOperation::Cancel => return Ok(None),
        FileConflictOperation::Merge => path,
        FileConflictOperation::Overwrite => {
            // Refuse an existing directory so overwrite never deletes it
            if path.is_dir() {
                return Err(FinalError::with_title(format!("Cannot compress to {}", PathFmt(&path)))
                    .detail("A directory already exists at this path.")
                    .hint("Remove it or choose a different output file name.")
                    .into());
            }
            utils::remove_file_or_dir(&path)?;
            path
        }
        FileConflictOperation::Rename => utils::find_available_filename_by_renaming(&path)?,
    };

    let file = fs::File::create(&path_to_create_file)?;
    Ok(Some((file, path_to_create_file)))
}

/// Check if QuestionPolicy flags were set, otherwise, ask the user if they want to continue.
pub fn user_wants_to_continue(
    path: &Path,
    question_policy: QuestionPolicy,
    question_action: QuestionAction,
) -> Result<bool> {
    match question_policy {
        QuestionPolicy::AlwaysYes => Ok(true),
        QuestionPolicy::AlwaysNo => Ok(false),
        QuestionPolicy::Ask => {
            let action = match question_action {
                QuestionAction::Compression => "compress",
                QuestionAction::Decompression => "decompress",
            };
            let path = format!("{}", PathFmt(path));
            let path = Some(&*path);
            let placeholder = Some("FILE");
            Confirmation::new(&format!("Do you want to {action} 'FILE'?"), placeholder).ask(path)
        }
    }
}

/// Choice dialog for end user with [option1/option2/...] question.
/// Each option is a [Choice] entity, holding a value "T" returned when that option is selected
pub struct ChoicePrompt<'a, T: Default> {
    /// The message to be displayed before the options
    /// e.g.: "Do you want to overwrite 'FILE'?"
    pub prompt: String,

    pub choices: Vec<Choice<'a, T>>,
}

/// A single choice showed as a option to user in a [ChoicePrompt]
/// It holds a label and a color to display to user and a real value to be returned
pub struct Choice<'a, T: Default> {
    label: &'a str,
    value: T,
    color: &'a str,
}

impl<'a, T: Default> ChoicePrompt<'a, T> {
    /// Creates a new Confirmation.
    pub fn new(prompt: impl Into<String>, choices: impl IntoIterator<Item = (&'a str, T, &'a str)>) -> Self {
        Self {
            prompt: prompt.into(),
            choices: choices
                .into_iter()
                .map(|(label, value, color)| Choice { label, value, color })
                .collect(),
        }
    }

    /// Creates user message and receives a input to be compared with choices "label"
    /// and returning the real value of the choice selected
    pub fn ask(mut self) -> Result<T> {
        let message = self.prompt;

        if is_stdin_dev_null()? {
            // stdin is /dev/null so the conflict prompt cannot be answered; fail instead of silently skipping
            let error = FinalError::with_title("Cannot read input to resolve file conflict")
                .detail(format!("Tried to ask: \"{message}\""))
                .detail("Stdin is connected to /dev/null, so the prompt cannot be answered.")
                .hint("If using Ouch in scripting, consider using `--yes` and `--no`.");
            return Err(error.into());
        }

        let _locks = lock_and_flush_output_stdio()?;
        let mut stdin_lock = stdin().lock();

        // Ask the same question to end while no valid answers are given
        loop {
            let choice_prompt = if is_running_in_accessible_mode() {
                self.choices
                    .iter()
                    .map(|choice| format!("{}{}{}", choice.color, choice.label, *colors::RESET))
                    .collect::<Vec<_>>()
                    .join("/")
            } else {
                let choices = self
                    .choices
                    .iter()
                    .enumerate()
                    .map(|(index, choice)| {
                        let mut chars = choice.label.chars();
                        let first = chars
                            .next()
                            .expect("dev error, should be reported, we checked this won't happen");
                        let first_formatted = if index == 0 {
                            first.to_ascii_uppercase().to_string()
                        } else {
                            first.to_string()
                        };
                        let rest: String = chars.collect();
                        format!("{}({}){}{}", choice.color, first_formatted, rest, *colors::RESET)
                    })
                    .collect::<Vec<_>>()
                    .join("/");

                format!("[{choices}]")
            };

            eprintln!("{message} {choice_prompt}");

            let mut answer = String::new();
            let bytes_read = stdin_lock.read_line(&mut answer)?;

            if bytes_read == 0 {
                let error = FinalError::with_title("Unexpected EOF when asking question.")
                    .detail("When asking the user:")
          
```

### Core Architecture Module: `src/utils/threads.rs`
```
use std::sync::OnceLock;

static USER_DEFINED_THREAD_COUNT: OnceLock<usize> = OnceLock::new();

pub fn logical_thread_count() -> usize {
    USER_DEFINED_THREAD_COUNT.get().copied().unwrap_or(num_cpus::get())
}

pub fn physical_thread_count() -> usize {
    USER_DEFINED_THREAD_COUNT
        .get()
        .copied()
        .unwrap_or(num_cpus::get_physical())
}

pub fn set_thread_count(value: usize) {
    if USER_DEFINED_THREAD_COUNT.get().is_none() {
        USER_DEFINED_THREAD_COUNT.set(value).unwrap();
    }
}

```

### Core Architecture Module: `src/utils/utf8.rs`
```
use std::{ffi::OsStr, path::PathBuf};

/// Check, without allocating, if os_str can be converted into &str
pub fn is_invalid_utf8(os_str: impl AsRef<OsStr>) -> bool {
    os_str.as_ref().to_str().is_none()
}

/// Filter out list of paths that are not utf8 valid
pub fn get_invalid_utf8_paths(paths: &[PathBuf]) -> Vec<&PathBuf> {
    paths.iter().filter(|path| is_invalid_utf8(path)).collect()
}

```

### Core Architecture Module: `scripts/draft-new-release.py`
```
#!/usr/bin/env python3
# pyright: reportUnusedCallResult=false

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import NoReturn, cast

VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")

def die(message: str) -> NoReturn:
    print(f"Error: {message}", file=sys.stderr)
    sys.exit(1)

def run(*args: str, capture: bool = False) -> str:
    result = subprocess.run(
        args,
        check=False,
        text=True,
        stdout=subprocess.PIPE if capture else None,
    )
    if result.returncode != 0:
        die(f"Command failed: {' '.join(args)}")
    return result.stdout.strip() if capture else ""

def succeeds(*args: str) -> bool:
    return (
        subprocess.run(
            args,
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
        == 0
    )

def repo_root() -> Path:
    return Path(run("git", "rev-parse", "--show-toplevel", capture=True))

def confirm(message: str) -> bool:
    try:
        answer = input(f"{message} [y/N]: ").strip().lower()
    except EOFError:
        return False
    return answer in {"y", "yes"}

def create_release_branch(version: str, rc_number: int) -> str:
    current_branch = run("git", "branch", "--show-current", capture=True)
    if not current_branch:
        die("Must be on a branch before creating a temporary release branch")

    release_branch = f"tmp/release/{version}-rc{rc_number}"
    print(f"Temporary release branch: {release_branch}")
    if not confirm(
        f"Create '{release_branch}' from '{current_branch}' and switch to it"
    ):
        die("Release branch creation aborted")

    if succeeds("git", "ls-remote", "--exit-code", "--heads", "origin", release_branch):
        die(f"Remote branch '{release_branch}' already exists")

    run("git", "switch", "--create", release_branch)
    return release_branch

def update_cargo_toml(version: str) -> None:
    path = Path("Cargo.toml")
    text = path.read_text()
    new_text, count = re.subn(
        r'(?s)(\[package\]\n.*?^version = ")[^"]+(")',
        rf"\g<1>{version}\2",
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if count != 1:
        die("Could not update package version in Cargo.toml")
    path.write_text(new_text)

def confirm_working_tree_changes() -> None:
    status = run("git", "status", "--short", capture=True)
    if not status:
        return

    print("Working tree has staged, unstaged, or untracked changes:")
    print(status)
    if not confirm("Continue with these changes present"):
        die("Release creation aborted")

def confirm_release_script_changes() -> None:
    diff = run(
        "git", "diff", "--no-ext-diff", "--no-color", "origin/main", "--",
        ".github", "scripts", capture=True,
    )
    if not diff:
        return

    print("There is a diff in .github or scripts compared to origin/main:")
    print(diff)
    if not confirm("Continue with these differences present"):
        die("Release creation aborted")

def remote_tags(pattern: str) -> list[str]:
    refs = run(
        "git", "ls-remote", "--tags", "origin", pattern, capture=True
    ).splitlines()
    tags: list[str] = []

    for ref in refs:
        tag = ref.rsplit("refs/tags/", maxsplit=1)[-1].removesuffix("^{}")
        tags.append(tag)

    return tags

def remote_branches(pattern: str) -> list[str]:
    refs = run(
        "git", "ls-remote", "--heads", "origin", pattern, capture=True
    ).splitlines()
    return [ref.rsplit("refs/heads/", maxsplit=1)[-1] for ref in refs]

def final_tag_exists(version: str) -> bool:
    return bool(remote_tags(version)) or succeeds(
        "git", "rev-parse", "--verify", "--quiet", f"refs/tags/{version}"
    )

def next_rc_number(version: str) -> int:
    branch_prefix = f"tmp/release/{version}-rc"
    branches = set(
        run(
            "git",
            "for-each-ref",
            "--format=%(refname:short)",
            f"refs/heads/{branch_prefix}*",
            capture=True,
        ).splitlines()
    )
    branches.update(remote_branches(f"{branch_prefix}*"))

    tag_prefix = f"{version}-rc"
    tags = set(run("git", "tag", "--list", f"{tag_prefix}*", capture=True).splitlines())
    tags.update(remote_tags(f"{tag_prefix}*"))

    rc_numbers: list[int] = []
    for refs, prefix in ((branches, branch_prefix), (tags, tag_prefix)):
        for ref in refs:
            match = re.fullmatch(rf"{re.escape(prefix)}([0-9]+)", ref)
            if match:
                rc_numbers.append(int(match.group(1)))

    return max(rc_numbers, default=0) + 1

def parse_args() -> str:
    parser = argparse.ArgumentParser()
    parser.add_argument("version", help="version like 1.0.0")
    version = cast(str, parser.parse_args().version)

    if not VERSION_RE.fullmatch(version):
        die(f"Invalid version '{version}'. Expected format like 1.0.0")

    return version

def main() -> None:
    version = parse_args()
    root = repo_root()
    os.chdir(root)

    confirm_working_tree_changes()
    confirm_release_script_changes()
    if final_tag_exists(version):
        die(f"Final release tag '{version}' already exists")

    rc_number = next_rc_number(version)
    release_branch = create_release_branch(version, rc_number)
    update_cargo_toml(version)
    run("cargo", "test", "--profile", "fast")

    run("git", "add", "Cargo.lock", "Cargo.toml")

    if succeeds("git", "diff", "--cached", "--quiet", "--", "Cargo.lock", "Cargo.toml"):
        die("Version bump produced no changes to commit")

    run(
        "git",
        "commit",
        "-m",
        f"bump version {version}",
        "--",
        "Cargo.lock",
        "Cargo.toml",
    )

    run("git", "push", "--set-upstream", "origin", release_branch)
    tag = f"{version}-rc{rc_number}"
    run("git", "tag", tag)
    run("git", "push", "origin", tag)
    print(f"Pushed branch: {release_branch}")
    print(f"Pushed tag: {tag}")
    print("GitHub Actions: https://github.com/ouch-org/ouch/actions")

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `src/accessible.rs`
```
//! Accessibility mode functions.
//!
//! # Problem
//!
//! `Ouch`'s default output contains symbols which make it visually easier to
//! read, but harder for people who are visually impaired and rely on
//! text-to-voice readers.
//!
//! On top of that, people who use text-to-voice tools can't easily skim
//! through verbose lines of text, so they strongly benefit from fewer lines
//! of output.
//!
//! # Solution
//!
//! To tackle that, `Ouch` has an accessibility mode that filters out most of
//! the verbose logging, displaying only the most important pieces of
//! information.
//!
//! Accessible mode also changes how logs are displayed, to remove symbols
//! which are "noise" to text-to-voice tools and change formatting of error
//! messages.
//!
//! # Are impaired people actually benefiting from this?
//!
//! So far we don't know. Most CLI tools aren't accessible, so we can't expect
//! many impaired people to be using the terminal and CLI tools, including
//! `Ouch`.
//!
//! I consider this to be an experiment, and a tiny step towards the right
//! direction, `Ouch` shows that this is possible and easy to do, hopefully
//! we can use our experience to later create guides or libraries for other
//! developers.

use std::sync::OnceLock;

/// Global flag for accessible mode.
pub static ACCESSIBLE: OnceLock<bool> = OnceLock::new();

/// Check if `Ouch` is running in accessible mode.
///
/// Check the module-level documentation for more details.
pub fn is_running_in_accessible_mode() -> bool {
    ACCESSIBLE.get().copied().unwrap_or(false)
}

/// Set the value of the global [`ACCESSIBLE`] flag.
///
/// Check the module-level documentation for more details.
pub fn set_accessible(value: bool) {
    if ACCESSIBLE.get().is_none() {
        ACCESSIBLE.set(value).unwrap();
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1076** (2026-09-13): **Updating to 0.8.3 thro cargo**
  *Symptoms*: ### Version  from 0.8.2 to 0.8.3   ### Description  When I update thro cargo rep, I got the such errors  ``` error[E0308]: mismatched types   --> …/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/ouch-0.8.3/src/commands/compress.rs:75:60    | 75 |                     bzip3::write::Bz3Encoder::new(encoder, 16 * 2_usize.pow(20))?,    |                     -----------------------------          ^^^^^^^^^^^^^^^^^^^^ expected `BlockSize`, found `usize`    |                     |    |                     arguments to this function are incorrect    | note: associated function defined here   --> …/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/bzip3-0.12.1/src/write.rs:35:12    | 35 |     pub fn new(mut writer: W, block_size: BlockSize) -> Self {    |            ^^^  error[E0277]: the `?` operator can only be applied to values that implement `Try`   --> …/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/ouch-0.8.3/src/commands/compress.rs:75:21    | 75 |                     bzip3::write::Bz3Encoder::new(encoder, 16 * 2_usize.pow(20))?,    |                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ the `?` operator cannot be applied to type `bzip3::write::Bz3Encoder<_>`    |    = help: the nightly-only, unstable trait `Try` is not implemented for `bzip3::write::Bz3Encoder<_>`  Some errors have detailed explanations: E0277, E0308. For more information about an error, try `rustc --explain E0277`. error: could not compile `ouch` (bin "ouch") due to 
  **Post-Mortem & Fix Analysis**:
  > bzip3 folks release a minor version with a breaking change, which is incorrect  this is kind of a `cargo` thing:  run `cargo install ouch --locked` to ensure you're using the exact version I published :)  EDIT: love the Sonny Boy pic

- **Issue #1062** (2026-09-02): **ouch list and decompress fail on zip archives using Zstandard compression (method 93)**
  *Symptoms*: ### Version  0.8.2  ### Description  ouch list and ouch decompress fail on zip archives whose entries are compressed with Zstandard (compression method 93) "zstd"  ### Current Behavior  Create a zstd zip and list it or using any other tool to compress a zip using zstd compression: - printf 'hello\n' > a.txt - bsdtar --options zip:compression=zstd -cf test.zip a.txt  ouch list test.zip Output: Archive: "test.zip"  [ERROR] Unexpected error in zip archive  - compression method not supported: 93  ouch decompress test.zip fails the same way.  ### Expected Behavior  ouch list and ouch decompress should handle method-93 (Zstandard) zip entries like any other zip.  ### Additional Information  OS: Arch Linux (CachyOS).  Root cause: ouch uses the Rust zip crate (8.6.0) with the zstd feature disabled, so the crate maps method 93 to Unsupported.  Enabling that feature in Cargo.toml fixes both list and decompress

- **Issue #1043** (2026-09-02): **Bug: Decompressing with --dir flag and choosing 'overwrite' wipes parent directory contents**
  *Symptoms*: ### Version  Version : 0.8.0-2.1 , Installed From : cachyos-extra-v4  ### Describe the Bug When using `ouch decompress` with the `--dir` flag pointing to an existing directory, `ouch` prompts for a file conflict on that parent directory. If the user selects `(o)verwrite`, `ouch` completely purges all other existing files and subdirectories inside that parent folder before unpacking the archive.  According to the official release page, this specific folder-wiping bug was supposedly fixed in version `0.8.0`. However, this report demonstrates a critical regression or edge-case recurrence of the issue in the current `0.8.0-2.1` build.  ### Steps to Reproduce 1. Create a directory structure with files and folders inside it. 2. Run `ouch d <archive>.zip --dir <path_to_existing_directory>` 3. When prompted with `Handle file conflict for "...": [(R)ename/(m)erge/(o)verwrite/(s)kip]`, select `o` (overwrite). 4. Check the contents of the parent directory.  ### Environment - **Ouch Version:** 0.8.0-2.1 - **OS/Distribution:** Arch Linux / CachyOS (x86_64_v4 variant) - **Install Source:** cachyos-extra-v4 - **Build Date:** Sun 05 Jul 2026   ### Current Behavior  The entire contents of the target parent directory are completely deleted without warning before extraction begins.  ### Terminal Logs / Proof of Concept ```bash ❯ ls Desktop/ouch-test/ drwxr-xr-x - cachyos  6 Aug 10:23  dir1 drwxr-xr-x - cachyos  6 Aug 10:23  dir2 drwxr-xr-x - cachyos  6 Aug 10:23  dir3 .rw-r--r-- 0 cachyos  6
  **Post-Mortem & Fix Analysis**:
  > I traced this on current `main` to `prepare_decompress_target()` resolving a non-empty explicit `--dir` as a directory conflict. Selecting `overwrite` then reaches `remove_dir_all()` on the destination itself. The earlier `--yes` safeguard only changes the non-interactive path to merge.  I can take this. I plan to stop offering destructive overwrite for directory conflicts during decompression (keeping rename, merge, and skip), while retaining overwrite for actual file conflicts, and add an integration regression test that verifies unrelated destination contents survive. 
  > I apologize, after @fzlzjerry's PR there will now be no option to delete a folder.  I thought about renaming it but it's better to remove it entirely so it's impossible for people to lose files by confusing options.

- **Issue #963** (2026-05-18): **optional smart unpack**
  *Symptoms*: ### Version  0.7.1  ### Description  After #962, running `ouch d archive.zip` without `--dir` extracts files directly into the current directory. That matches what tar, unzip, unrar, 7z and most other CLI archivers do by default, but it leaves a few annoyances that have come up before. e.g extracting an archive scatters its contents into whatever directory you happen to be in. People downloading archives into a populated directory often want a one-shot "extract this into its own folder" behavior.  The 0.6.1 smart_unpack feature tried to address this. It was removed in #907 with this rationale, quoted from the commit message:  > all this feature did was automatically flatten the top-level directory of an > archive when decompressing an archive with a single element in its root. > It's being removed right now for being unpredictable, might be re-added in > the future with flags or config file, basically, something that makes it > opt-in and not the default.  Proposal: add an opt-in flag that makes ouch extract into `CWD/<archive_basename>/` instead of directly into the CWD.  Two things that should work differently compared to the old smart_unpack:  1. The output path is always derived from the archive's filename. The user can predict where files will land just by reading the command line, without inspecting the archive first. This is the part of smart_unpack that #907 called unpredictable 2. After extraction, if the wrapper directory turns out to contain exactly one entry whose
  **Post-Mortem & Fix Analysis**:
  > Thanks for bringing it up.  What if `ouch decompress` for archives always extracts to a new directory by default, at `CWD/archive-name` but if that already exists it goes to `CWD/archive-name-2` and keeps increasing that integer till it's available.  Then we add a `--here` flag to extract directly into CWD instead (similar to how on Windows we used to do "extract here" for Winrar or .zip), in case of file conflicts, for directories we merge them (without asking?), for conflicting files, we ask for [skip, rename, overwrite, halt].  As a user would you prefer that over your suggestion?
  > Well wait isn't my suggestion similar to what you suggested yesterday on #962? (just read that)
  > > Well wait isn't my suggestion similar to what you suggested yesterday on [#962](https://github.com/ouch-org/ouch/pull/962)? (just read that)  yes, I think so. I am updating the PR to implement this

- **Issue #958** (2026-05-18): **Ouch 0.7.1 breaks decompression**
  *Symptoms*: ### Version  0.7.1  ### Description  running decompression in an otherwise empty directory with just the archive results in: ``` ouch d test.zip Do you want to overwrite "."? [y/n/r/m] ```  When pressing y ``` y [ERROR] Refusing to delete the current working directory  - Path "." is the current directory  hint: Use a different output directory with `--dir` / `-d` ```  currently ouch only works when using the -d option  ### Current Behavior  _No response_  ### Expected Behavior  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, taking a look at it.
  > Almost all of our tests use `--dir` for the convenience, I need to start adding more tests for subcommands that `cd` into folders so we can have coverage when `--dir` is not there.
  > I'll chime in because I wanted to write about it myself. If you select `y`es, an error will appear and nothing will happen. If I select `n`o, nothing will happen. If you select "rename," it creates a folder in the parent folder with the name of the folder containing the archive, plus an underscore and a number. Only the `m` (what M mean?) option allows extraction in the same folder, but it doesn't create a subfolder with the archive name as before; it just extracts everything to the same folder as the archive. Previously, I could extract any number of archives  with `ouch decompress *`, but now everything would be in a single folder and if folders have the same name, there is a conflict. Is there a way around this?  ``` roland@blackrainbow newfolder/test/01 ❯ ouch decompress FOSS-Cannon-v1.3.zip Do you want to overwrite "."? [y/n/r/m] y [ERROR] Refusing to delete the current working directory  - Path "." is the current directory  hint: Use a different output directory with `--dir` / `-

- **Issue #954** (2026-04-22): **0.7.0 GitHub release reporting old version**
  *Symptoms*: ### Version  0.7.0  ### Description  Release 0.7.0 is reporting the wrong version.  ### Current Behavior  ```sh $ ouch --version ouch 0.6.1 ```  ### Expected Behavior  ```sh $ ouch --version ouch 0.7.0 ```  ### Additional Information  Downloaded from here: https://github.com/ouch-org/ouch/releases/download/0.7.0/ouch-x86_64-unknown-linux-gnu.tar.gz
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, I fear I'll break someones package if I try to mess with that version, so I'll just create 0.7.1.  Btw not the first time I forget to update the Cargo.toml version.
  > Fixed in https://github.com/ouch-org/ouch/releases/tag/0.7.1

- **Issue #943** (2026-04-28): **[ouch 0.6.1] \rename_or_increment_filename` overflow in rename-conflict handling`**
  *Symptoms*: ### Version  0.6.1  ### Description  In `ouch 0.6.1`, the older rename-conflict logic could overflow when incrementing a numeric suffix, e.g.:  ```rust let number = number_str.parse::<u32>().unwrap_or(0); format!("{}_{}", base, number + 1) ```  If the suffix was `4294967295` (`u32::MAX`), `number + 1` could overflow and panic (reproducible in debug builds).  I see that newer code now uses `find_available_filename_by_renaming` with `for i in 1..`, so the old `parse-and-increment` path seems gone. As a small hardening suggestion, it might still be nice to add an explicit boundary guard (or graceful fallback) for the index growth path as well, even though reaching that boundary is extremely unlikely in practice.  Thank you.  ### Current Behavior  _No response_  ### Expected Behavior  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > > reproducible in debug builds  Hi, did you managed to reproduce this somehow? If so did you had Ouch running in a loop by accident?
  > > > reproducible in debug builds >  > Hi, did you managed to reproduce this somehow? If so did you had Ouch running in a loop by accident?  Tbh I discover this bug by scanning panic patterns, and it can be reproduced like ``` $ouch compress input.txt archive_4294967295.tar Do you want to overwrite archive_4294967295.tar? [y/n/r] r  thread 'main' (466849) panicked at src/utils/fs.rs:78:36: attempt to add with overflow note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace ``` This exact function has been removed in the latest GitHub version, I’m sharing it as a historical edge case and hardening reference ^_^. Btw I think latest version has successfully avoided this bug.
  > Thanks for reporting, I did confirm that this was fixed for any version after 0.6.1.  Fortunately integer overflow like these aren't UB in Rust, so this isn't a CVE. 

- **Issue #902** (2026-09-05): **Files from extracted zip have wrong modified time**
  *Symptoms*: ### Version  0.6.1  ### Description  Files extracted from a zip have the modified time updated to a value 6 hours in the past. I'm in UTC-6, so the time being read from the extracted file seems to be interpreted as UTC time rather than local time.  Attached are an empty file (`test.orig.txt`), an archive with that file (`test.zip`), the extracted result from `ouch` (`test.ouch.txt`) and the extracted result from `unzip`, which has the correct modified time (`test.unzip.txt`).  ### Current Behavior  Here's the relevant `stat` output:  ``` > stat test.orig.txt   File: test.orig.txt   Size: 0               Blocks: 0          IO Block: 4096   regular empty file Device: 259,9   Inode: 11947048    Links: 1 Modify: 2026-02-07 10:06:50.918485119 -0600  Birth: 2026-02-07 10:06:50.918485119 -0600 > stat test.ouch.txt   File: test.ouch.txt   Size: 0               Blocks: 0          IO Block: 4096   regular empty file Device: 259,9   Inode: 16384698    Links: 1 Modify: 2026-02-07 04:06:50.000000000 -0600  Birth: 2026-02-07 10:07:18.766744263 -0600 ```  ### Expected Behavior  I would expect the same output that `unzip` gives:  ``` > stat test.unzip.txt   File: test.unzip.txt   Size: 0               Blocks: 0          IO Block: 4096   regular empty file Device: 259,9   Inode: 11962158    Links: 1 Modify: 2026-02-07 10:06:50.000000000 -0600  Birth: 2026-02-07 10:07:31.198860767 -0600 ```  ### Additional Information  Here's the `unzip` version, in case it's relevant:  ``` > unzip --version U
  **Post-Mortem & Fix Analysis**:
  > Hi @tbekolay , Are you still experiencing this issue? I just tested on macOS with the same ouch version and wasn’t able to reproduce it. I’ll also try on a Linux environment once I have access.
  > Yes, I just downloaded the .zip file in the original post and `ouch` and `unzip` disagree on the modify date:  ``` > ouch decompress test.zip [INFO] Created temporary directory /home/tbekolay/tmp/./tmp-ouch-k167KJ to hold decompressed elements [INFO] extracted (  0.00   B) "tmp-ouch-k167KJ/test.txt" [INFO] Successfully moved "/home/tbekolay/tmp/./tmp-ouch-k167KJ/test.txt" to "./test.txt" [INFO] Successfully decompressed archive in current directory (1 files) > ls -al .rw-rw-r--   0 tbekolay  7 Feb 04:06 test.txt .rw-rw-r-- 166 tbekolay 20 Mar 11:44 test.zip > stat test.txt   File: test.txt   Size: 0               Blocks: 0          IO Block: 4096   regular empty file Device: 259,9   Inode: 17041947    Links: 1 Access: (0664/-rw-rw-r--)  Uid: ( 1000/tbekolay)   Gid: ( 1000/tbekolay) Access: 2026-03-20 11:49:28.162834699 -0500 Modify: 2026-02-07 04:06:50.000000000 -0600 Change: 2026-03-20 11:49:28.166227765 -0500  Birth: 2026-03-20 11:49:28.162834699 -0500 ```  ``` > unzip test.zip Archi
  > Interesting, I’m seeing the opposite on my side.   I just tried on Ubuntu (WSL): `unzip` shifts the timestamp by my timezone offset, while `ouch` preserves the original time. In my case, `ouch` matches the expected “no conversion” behavior, and `unzip` appears to be applying an extra timezone adjustment.

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

### Incident Patch 1: `6df14b05` (2026-09-24)
**Commit Message**: fix: crash on --format (#1080)

**File**: `src/check.rs` (modified, +2/-2)
```diff
@@ -135,13 +135,13 @@ pub fn check_for_non_archive_formats(files: &[PathBuf], formats: &[Vec<Extension
 /// Show error if archive format is not the first format in the chain.
 pub fn check_archive_formats_position(formats: &[Extension], output_path: &Path) -> Result<()> {
     if let Some(format) = formats.iter().skip(1).find(|format| format.is_archive()) {
-        let error = FinalError::with_title(format!("Cannot compress to {}", PathFmt(output_path)))
+        let error = FinalError::with_title(format!("Cannot process {}", PathFmt(output_path)))
             .detail(format!("Found the format '{format}' in an incorrect position."))
             .detail(format!(
                 "'{format}' can only be used at the start of the file extension."
             ))
             .hint(format!(
-                "If you wish to compress multiple files, start the extension with '{format}'."
+                "'{format}' is an archive format and must be at the start of the extension, for example '{format}.gz'."
             ))
             .hint(format!(
                 "Otherwise, remove the last '{}' from {}.",
```

**File**: `src/commands/mod.rs` (modified, +1/-0)
```diff
@@ -184,6 +184,7 @@ pub fn run(args: CliArgs, question_policy: QuestionPolicy, file_visibility_polic
             if let Some(format) = args.format {
                 let format = parse_format_flag(&format)?;
                 for path in files.iter() {
+                    check::check_archive_formats_position(&format, path)?;
                     let file_name = path.file_name().ok_or_else(|| Error::Custom {
                         reason: FinalError::with_title(format!("{} does not have a file name", PathFmt(path))),
                     })?;
```

**File**: `tests/decompress_format_flag.rs` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+mod utils;
+
+use fs_err as fs;
+
+// a misplaced archive in --format must be rejected not panic
+#[test]
+fn format_flag_rejects_misplaced_archive() {
+    let (_tempdir, dir) = crate::utils::testdir().unwrap();
+
+    fs::write(dir.join("f.txt"), "hello").unwrap();
+    crate::utils::cargo_bin()
+        .current_dir(dir)
+        .args(["compress", "f.txt", "f.txt.gz"])
+        .assert()
+        .success();
+    // remove the source so decompression reaches the format handling not a conflict prompt
+    fs::remove_file(dir.join("f.txt")).unwrap();
+
+    crate::utils::cargo_bin()
+        .current_dir(dir)
+        .args(["decompress", "f.txt.gz", "--format", "gz.tar"])
+        .assert()
+        .failure()
+        .code(1);
+}
```

---

### Incident Patch 2: `8f5600f6` (2026-09-13)
**Commit Message**: fix release workflows (#1075)

**File**: `scripts/DRAFT_NEW_RELEASE.md` (modified, +49/-45)
```diff
@@ -1,55 +1,59 @@
 # Draft a New Release
 
-Use `scripts/draft-new-release.py` to prepare a release-candidate tag and trigger the GitHub Actions release workflow.
+Use `scripts/draft-new-release.py x.y.z` to prepare the new release.
 
-## Checks
+How the release pipeline roughly works:
 
-The script will fail if these requirements aren't met.
+- A temporary release branch `tmp/release/x.y.z-rcN` is created and pushed.
+  - It contains 1 extra commit, the version bump.
+- We tag the bump commit and push the tag
+  - CI will detect the tag, build the artifacts and create the draft release.
+- We review the draft release.
+  - If failed, delete and do again with `tmp/release/x.y.z-rc(N+1)`.
+  - If successful, publish and fast-forward main to the bump commit to persist.
 
-- Be on `main`.
-- `main` must match `origin/main`.
-- Do not have staged or unstaged tracked changes. Untracked files are ignored.
-- Have Rust/Cargo available.
+Steps that are omitted can be found in exhaustive list of steps below.
 
-## Run the draft script
+## Start a release
 
 ```sh
-scripts/draft-new-release.py NEW_VERSION
+scripts/draft-new-release.py x.y.z
 ```
 
-Example:
-
-```sh
-scripts/draft-new-release.py 0.8.0
-```
-
-The version must be in `MAJOR.MINOR.PATCH` format.
-
-The script will:
-
-1. Update the package version in `Cargo.toml`.
-2. Run `cargo test --profile fast`, which will also update `Cargo.lock`.
-3. Commit `Cargo.toml` and `Cargo.lock` with new version:
-   - Message: `"bump version NEW_VERSION"`.
-4. Create new release candidate tag, like `NEW_VERSION-rc1`, `NEW_VERSION-rc2`, etc.
-5. Push tags.
-6. Print the GitHub Actions URL.
-
-## After the script runs
-
-1. Go to GitHub Actions:
-   <https://github.com/ouch-org/ouch/actions>
-2. Wait for the release workflow triggered by the RC tag.
-3. Go to GitHub Releases:
-   <https://github.com/ouch-org/ouch/releases>
-4. Open the drafted release for the RC tag.
-5. Continue polishing the release notes if needed.
-6. Publish to crates.io:
-   ```sh
-   cargo publish
-   ```
-7. Push the version bump commit to `main` with `git push` (the script creates the commit, but only pushes the RC tag).
-8. In GitHub, edit the release:
-   - mark it as the final release instead of a pre-release
-   - confirm the title/body/assets are correct
-9. Click **Release**.
+<details>
+<summary>The script will:</summary>
+
+1. Check if the `git` repo is dirty, if so, report and ask for confirmation before proceeding.
+2. Create and check out to `tmp/release/x.y.z-rcN`
+  - `N` will be incremented automatically based on local and remote branch and tag references.
+  - The same `N` is used for both the branch and the RC tag.
+  - The script should show the branch name and ask for confirmation before proceeding.
+3. Update the package version in `Cargo.toml`.
+4. Run `cargo test --profile fast`, which may update `Cargo.lock`.
+5. Commit `Cargo.toml` and `Cargo.lock` with message `bump version x.y.z`.
+6. Push newly created branch to `origin`.
+7. Create and push the next RC tag, such as `x.y.z-rc1`.
+8. Print the GitHub Actions URL.
+
+</details>
+
+If the release is a hotfix and shouldn't go to `main`, the difference is that you should first create another branch where the commits will live, suggested name is `hotfix/x.y.z`, notice that you'll still use the script to create `tmp/release/x.y.z-rcN`, but you'll base it on and merge-fast-forward later to `hotfix/x.y.z`, not `main`.
+
+## Test the draft release
+
+1. Go to [GitHub Actions](https://github.com/ouch-org/ouch/actions) and wait for the release workflow.
+2. Open the draft at [GitHub Releases](https://github.com/ouch-org/ouch/releases) for editing.
+3. Download and test the assets, check the asset names, signatures and package version.
+4. Create the release text.
+5. If anything needs fixing, go back to your base branch and run the script again.
+
+## Finalize the release
+
+1. `git switch BASE_BRANCH` (either `main` or `hotfix/x.y.z`)
+2. `git pull` (ensure up to date)
+3. `git merge --ff-only tmp/release/x.y.z-rcN` (add the bump commit to `BASE_BRANCH`)
+4. In GitHub, finish preparing the release.
+5. `cargo publish --locked`.
+6. `git push`.
+7. Press `Create Release` inside GitHub.
+8. Clean up dangling temporary branches.
```

**File**: `scripts/draft-new-release.py` (modified, +101/-56)
```diff
@@ -1,58 +1,69 @@
 #!/usr/bin/env python3
+# pyright: reportUnusedCallResult=false
+
 import argparse
 import os
 import re
 import subprocess
 import sys
 from pathlib import Path
+from typing import NoReturn, cast
 
 VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")
 
-
-def die(message: str) -> None:
+def die(message: str) -> NoReturn:
     print(f"Error: {message}", file=sys.stderr)
     sys.exit(1)
 
-
 def run(*args: str, capture: bool = False) -> str:
     result = subprocess.run(
         args,
+        check=False,
         text=True,
         stdout=subprocess.PIPE if capture else None,
     )
     if result.returncode != 0:
         die(f"Command failed: {' '.join(args)}")
     return result.stdout.strip() if capture else ""
 
-
 def succeeds(*args: str) -> bool:
     return (
         subprocess.run(
-            args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
+            args,
+            check=False,
+            stdout=subprocess.DEVNULL,
+            stderr=subprocess.DEVNULL,
         ).returncode
         == 0
     )
 
-
 def repo_root() -> Path:
     return Path(run("git", "rev-parse", "--show-toplevel", capture=True))
 
+def confirm(message: str) -> bool:
+    try:
+        answer = input(f"{message} [y/N]: ").strip().lower()
+    except EOFError:
+        return False
+    return answer in {"y", "yes"}
 
-def ensure_on_origin_main() -> None:
-    branch = run("git", "branch", "--show-current", capture=True)
-    if branch != "main":
-        die(f"Must be on main branch; currently on '{branch}'")
+def create_release_branch(version: str, rc_number: int) -> str:
+    current_branch = run("git", "branch", "--show-current", capture=True)
+    if not current_branch:
+        die("Must be on a branch before creating a temporary release branch")
 
-    run("git", "fetch", "origin", "main")
+    release_branch = f"tmp/release/{version}-rc{rc_number}"
+    print(f"Temporary release branch: {release_branch}")
+    if not confirm(
+        f"Create '{release_branch}' from '{current_branch}' and switch to it"
+    ):
+        die("Release branch creation aborted")
 
-    if not succeeds("git", "rev-parse", "--verify", "origin/main"):
-        die("Could not find origin/main")
-
-    if not succeeds("git", "merge-base", "--is-ancestor", "origin/main", "HEAD"):
-        die(
-            "HEAD is behind or has diverged from origin/main. Pull/rebase before bumping the version."
-        )
+    if succeeds("git", "ls-remote", "--exit-code", "--heads", "origin", release_branch):
+        die(f"Remote branch '{release_branch}' already exists")
 
+    run("git", "switch", "--create", release_branch)
+    return release_branch
 
 def update_cargo_toml(version: str) -> None:
     path = Path("Cargo.toml")
@@ -68,77 +79,111 @@ def update_cargo_toml(version: str) -> None:
         die("Could not update package version in Cargo.toml")
     path.write_text(new_text)
 
-
-def ensure_no_tracked_changes() -> None:
+def confirm_working_tree_changes() -> None:
     status = run("git", "status", "--short", capture=True)
-    tracked_changes = [
-        line for line in status.splitlines() if not line.startswith("?? ")
-    ]
-    if tracked_changes:
-        print("\n".join(tracked_changes))
-        die(
-            "Working tree has staged or unstaged tracked changes. Commit or stash them before drafting a release."
-        )
+    if not status:
+        return
 
+    print("Working tree has staged, unstaged, or untracked changes:")
+    print(status)
+    if not confirm("Continue with these changes present"):
+        die("Release creation aborted")
 
 def remote_tags(pattern: str) -> list[str]:
     refs = run(
         "git", "ls-remote", "--tags", "origin", pattern, capture=True
     ).splitlines()
-    tags = []
+    tags: list[str] = []
 
     for ref in refs:
-        tag = ref.rsplit("refs/tags/", maxsplit=1)[-1]
-        if tag.endswith("^{}"):
-            tag = tag[:-3]
+        tag = ref.rsplit("refs/tags/", maxsplit=1)[-1].removesuffix("^{}")
         tags.append(tag)
 
     return tags
 
+def remote_branches(pattern: str) -> list[str]:
+    refs = run(
+        "git", "ls-remote", "--heads", "origin", pattern, capture=True
+    ).splitlines()
+    return [ref.rsplit("refs/heads/", maxsplit=1)[-1] for ref in refs]
 
-def next_rc_tag(version: str) -> str:
-    pattern = f"{version}-rc*"
-    tags = set(run("git", "tag", "--list", pattern, capture=True).splitlines())
-    tags.update(remote_tags(pattern))
-    rc_numbers = []
-    rc_re = re.compile(rf"^{re.escape(version)}-rc([0-9]+)$")
+def final_tag_exists(version: str) -> bool:
+    return bool(remote_tags(version)) or succeeds(
+        "git", "rev-parse", "--verify", "--quiet", f"refs/tags/{version}"
+    )
 
-    for tag in tags:
-        match = rc_re.fullmatch(tag)
-        if match:
-            rc_numbers.append(int(match.group(1)))
+def next_rc_number(version: str) -> int:
+    branch_prefix = f"tmp/release/{version}-rc"
+ 
```

---

### Incident Patch 3: `0f8a36c3` (2026-09-05)
**Commit Message**: fix: zip timestamps across time zones (#1033)

**File**: `Cargo.lock` (modified, +11/-0)
```diff
@@ -1083,6 +1083,15 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "num_threads"
+version = "0.1.7"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "5c7398b9c8b70908f6371f47ed36737907c87c52af34c268fed0bf0ceb92ead9"
+dependencies = [
+ "libc",
+]
+
 [[package]]
 name = "once_cell"
 version = "1.21.4"
@@ -1718,7 +1727,9 @@ checksum = "cdb87b95ec50ddfa440816d227a17b2ccbdda963a316a727fda0fc4334f7d134"
 dependencies = [
  "deranged",
  "js-sys",
+ "libc",
  "num-conv",
+ "num_threads",
  "powerfmt",
  "serde_core",
  "time-core",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ snap = "1.1.1"
 strum = { version = "0.28.0", features = ["derive"] }
 tar = "0.4.46"
 tempfile = "3.27.0"
-time = { version = "0.3.47", default-features = false }
+time = { version = "0.3.47", default-features = false, features = ["local-offset"] }
 unrar = { package = "unrar-ng", version = "0.7.6", optional = true }
 zip = { version = "8.6.0", default-features = false, features = [
     "time",
```

**File**: `src/archive/zip.rs` (modified, +65/-8)
```diff
@@ -11,7 +11,7 @@ use filetime_creation::{FileTime, set_file_mtime};
 use fs_err as fs;
 use is_executable::is_executable;
 use same_file::Handle;
-use time::{OffsetDateTime, PrimitiveDateTime};
+use time::{OffsetDateTime, PrimitiveDateTime, UtcOffset};
 use zip::{self, DateTime, ZipArchive, read::ZipFile};
 
 #[cfg(unix)]
@@ -341,31 +341,52 @@ fn get_last_modified_time(file: &fs::File) -> DateTime {
         .and_then(|metadata| metadata.modified())
         .ok()
         .and_then(|time| {
-            // zip stores timezone-naive DOS times, so drop the tz from OffsetDateTime
-            let odt = OffsetDateTime::from(time);
-            DateTime::try_from(PrimitiveDateTime::new(odt.date(), odt.time())).ok()
+            let datetime = OffsetDateTime::from(time);
+            let offset = UtcOffset::local_offset_at(datetime).unwrap_or(UtcOffset::UTC);
+            zip_datetime_from_offset(datetime, offset)
         })
         .unwrap_or_default()
 }
 
 fn set_last_modified_time<R: Read>(zip_file: &ZipFile<'_, R>, path: &Path) -> Result<()> {
-    // Extract modification time from zip file and convert to FileTime
     let file_time = zip_file
         .last_modified()
         .and_then(|datetime| PrimitiveDateTime::try_from(datetime).ok())
         .map(|pdt| {
-            // Zip does not support nanoseconds, so we can assume zero here
-            FileTime::from_unix_time(pdt.assume_utc().unix_timestamp(), 0)
+            let offset = local_offset_for(pdt).unwrap_or(UtcOffset::UTC);
+            file_time_from_local_datetime(pdt, offset)
         });
 
-    // Set the modification time if available
     if let Some(modification_time) = file_time {
         set_file_mtime(path, modification_time)?;
     }
 
     Ok(())
 }
 
+fn zip_datetime_from_offset(datetime: OffsetDateTime, offset: UtcOffset) -> Option<DateTime> {
+    let local = datetime.to_offset(offset);
+    DateTime::try_from(PrimitiveDateTime::new(local.date(), local.time())).ok()
+}
+
+fn local_offset_for(datetime: PrimitiveDateTime) -> Option<UtcOffset> {
+    let mut offset = UtcOffset::local_offset_at(datetime.assume_utc()).ok()?;
+
+    for _ in 0..2 {
+        let next = UtcOffset::local_offset_at(datetime.assume_offset(offset)).ok()?;
+        if next == offset {
+            break;
+        }
+        offset = next;
+    }
+
+    Some(offset)
+}
+
+fn file_time_from_local_datetime(datetime: PrimitiveDateTime, offset: UtcOffset) -> FileTime {
+    FileTime::from_unix_time(datetime.assume_offset(offset).unix_timestamp(), 0)
+}
+
 /// A zip mode without Unix file-type bits isn't a real Unix mode, so its permissions are ignored.
 #[cfg(unix)]
 fn valid_unix_permissions(mode: u32) -> Option<u32> {
@@ -390,3 +411,39 @@ fn zip_non_utf8_error<'a>(path: &'a Path) -> impl Fn() -> FinalError + 'a {
             .detail(format!("File {} has a non-UTF-8 path", PathFmt(path)))
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use time::{Date, Month, Time};
+
+    use super::*;
+
+    #[test]
+    fn zip_timestamps_round_trip_with_offset() {
+        let date = Date::from_calendar_date(2026, Month::February, 7).unwrap();
+        let local = PrimitiveDateTime::new(date, Time::from_hms(10, 6, 50).unwrap());
+        let offset = UtcOffset::from_hms(-6, 0, 0).unwrap();
+        let instant = local.assume_offset(offset);
+
+        let datetime = zip_datetime_from_offset(instant, offset).unwrap();
+        assert_eq!(PrimitiveDateTime::try_from(datetime).unwrap(), local);
+
+        let file_time = file_time_from_local_datetime(local, offset);
+        assert_eq!(file_time.unix_seconds(), instant.unix_timestamp());
+    }
+
+    #[test]
+    fn zip_timestamps_round_trip_with_local_offset() {
+        let instant = Date::from_calendar_date(2026, Month::February, 7)
+            .unwrap()
+            .with_hms(12, 34, 56)
+            .unwrap()
+            .assume_utc();
+        let offset = UtcOffset::local_offset_at(instant).unwrap();
+        let datetime = zip_datetime_from_offset(instant, offset).unwrap();
+        let local = PrimitiveDateTime::try_from(datetime).unwrap();
+        let resolved_offset = local_offset_for(local).unwrap();
+        let file_time = file_time_from_local_datetime(local, resolved_offset);
+        assert_eq!(file_time.unix_seconds(), instant.unix_timestamp());
+    }
+}
```

---

### Incident Patch 4: `79e0b3e2` (2026-09-02)
**Commit Message**: fix: support zstd in zip (method 93) (#1063)

The zip crate was built without its zstd feature, so listing or
decompressing a zip whose entries use compression method 93 failed
with "compression method not supported: 93". Enable the feature and
add a regression test covering both list and decompress.

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2089,6 +2089,7 @@ dependencies = [
  "time",
  "typed-path",
  "zeroize",
+ "zstd",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ unrar = { package = "unrar-ng", version = "0.7.6", optional = true }
 zip = { version = "8.6.0", default-features = false, features = [
     "time",
     "aes-crypto",
+    "zstd",
 ] }
 zstd = { version = "0.13.3", default-features = false, features = ["zstdmt"] }
 
```

**File**: `tests/integration.rs` (modified, +33/-0)
```diff
@@ -1851,6 +1851,39 @@ fn zip_special_permission_bits_are_stripped() {
     }
 }
 
+/// Zip entries compressed with Zstandard (method 93) must list and decompress (issue #1062).
+#[test]
+fn zip_with_zstd_entries() {
+    let (_tempdir, test_dir) = testdir().unwrap();
+    let zstd_zip = test_dir.join("zstd.zip");
+
+    {
+        use zip::{CompressionMethod, write::SimpleFileOptions};
+        let file = std::fs::File::create(&zstd_zip).unwrap();
+        let mut zip = zip::ZipWriter::new(file);
+        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Zstd);
+        zip.start_file("test_file.txt", options).unwrap();
+        zip.write_all(b"zstd in zip").unwrap();
+        zip.finish().unwrap();
+    }
+
+    crate::utils::cargo_bin().arg("list").arg(&zstd_zip).assert().success();
+
+    let out_dir = test_dir.join("out");
+    crate::utils::cargo_bin()
+        .arg("d")
+        .arg(&zstd_zip)
+        .arg("-d")
+        .arg(&out_dir)
+        .assert()
+        .success();
+
+    assert_eq!(
+        "zstd in zip",
+        fs::read_to_string(out_dir.join("test_file.txt")).unwrap()
+    );
+}
+
 // Default mode decompression without --dir or --here is not tested elsewhere
 // These lock in the layout where output goes into a new directory named after the archive
 
```

---

### Incident Patch 5: `015fe613` (2026-09-02)
**Commit Message**: fix: prevent destructive overwrite of decompression directories (#1044)

Co-authored-by: João Marcos <[REDACTED_EMAIL]>

**File**: `src/utils/question.rs` (modified, +9/-0)
```diff
@@ -91,6 +91,15 @@ pub fn prompt_user_for_file_conflict_resolution(
             ],
         )
         .ask(),
+        QuestionAction::Decompression if path.is_dir() => ChoicePrompt::new(
+            format!("Handle file conflict for {}:", PathFmt(path)),
+            [
+                ("rename", Op::Rename, *colors::BLUE),
+                ("merge", Op::Merge, *colors::ORANGE),
+                ("skip", Op::Cancel, *colors::RED),
+            ],
+        )
+        .ask(),
         QuestionAction::Decompression => ChoicePrompt::new(
             format!("Handle file conflict for {}:", PathFmt(path)),
             [
```

**File**: `tests/integration.rs` (modified, +78/-9)
```diff
@@ -257,7 +257,7 @@ fn multiple_files(
 }
 
 #[proptest(cases = 25)]
-fn multiple_files_with_conflict_and_choice_to_overwrite(
+fn multiple_files_with_conflict_and_choice_to_merge(
     ext: DirectoryExtension,
     #[any(size_range(0..1).lift())] extra_extensions: Vec<FileExtension>,
     #[strategy(0u8..3)] depth: u8,
@@ -270,9 +270,9 @@ fn multiple_files_with_conflict_and_choice_to_overwrite(
     create_random_files(before_dir, depth, &mut SmallRng::from_os_rng());
 
     let after = &dir.join("after");
-    let after_dir = &after.join("dir");
-    fs::create_dir_all(after_dir).unwrap();
-    create_random_files(after_dir, depth, &mut SmallRng::from_os_rng());
+    fs::create_dir_all(after).unwrap();
+    let unrelated_file = after.join("unrelated.txt");
+    fs::write(&unrelated_file, "keep this").unwrap();
 
     let archive = &dir.join(format!("archive.{}", merge_extensions(ext, &extra_extensions)));
     ouch!("-A", "c", before_dir, archive);
@@ -282,10 +282,12 @@ fn multiple_files_with_conflict_and_choice_to_overwrite(
         .arg(archive)
         .arg("-d")
         .arg(after)
-        .write_stdin("o")
+        .write_stdin("m")
         .assert()
         .success();
 
+    assert_eq!("keep this", fs::read_to_string(&unrelated_file).unwrap());
+    fs::remove_file(unrelated_file).unwrap();
     assert_same_directory(before, after, false);
 }
 
@@ -1352,6 +1354,47 @@ fn test_concatenated_streams(extension: &str, compress_chunk: impl Fn(&[u8]) ->
     );
 }
 
+/// Directory conflicts during decompression must not offer the destructive overwrite action.
+/// An invalid overwrite choice should be ignored, allowing the user to choose merge instead.
+#[test]
+fn decompress_directory_conflict_preserves_unrelated_contents() {
+    let (_tempdir, dir) = testdir().unwrap();
+    let input_folder = dir.join("folder");
+    let archive = dir.join("archive.zip");
+    let output_dir = dir.join("out");
+
+    fs::create_dir(&input_folder).unwrap();
+    fs::write(input_folder.join("file"), "archive content").unwrap();
+    crate::utils::cargo_bin()
+        .arg("compress")
+        .arg(&input_folder)
+        .arg(&archive)
+        .assert()
+        .success();
+
+    fs::create_dir(&output_dir).unwrap();
+    fs::write(output_dir.join("important.txt"), "keep this").unwrap();
+
+    crate::utils::cargo_bin()
+        .arg("decompress")
+        .arg(&archive)
+        .arg("--dir")
+        .arg(&output_dir)
+        .write_stdin("o\nm\n")
+        .assert()
+        .success();
+
+    assert_eq!(
+        "keep this",
+        fs::read_to_string(output_dir.join("important.txt")).unwrap(),
+        "choosing overwrite removed unrelated destination contents"
+    );
+    assert_eq!(
+        "archive content",
+        fs::read_to_string(output_dir.join("folder").join("file")).unwrap()
+    );
+}
+
 /// Regression test: `--yes` should merge into a non-empty output directory rather than wiping it.
 /// Previously, `--yes` defaulted to `Overwrite`, which would call `remove_dir_all` on the output
 /// directory, including when that directory was `$CWD`.
@@ -1614,6 +1657,32 @@ fn decompress_single_file_dir_allows_non_empty_output_dir_with_no() {
     assert_eq!("keep", fs::read_to_string(dir.join("out").join("other-file")).unwrap());
 }
 
+/// Overwrite remains available when decompression conflicts with an actual file.
+#[test]
+fn decompress_single_file_conflict_can_be_overwritten() {
+    let (_tempdir, dir) = testdir().unwrap();
+
+    fs::write(dir.join("a"), "new content").unwrap();
+    crate::utils::cargo_bin()
+        .args(["compress", "a", "a.gz"])
+        .current_dir(dir)
+        .assert()
+        .success();
+    fs::remove_file(dir.join("a")).unwrap();
+
+    fs::create_dir(dir.join("out")).unwrap();
+    fs::write(dir.join("out").join("a"), "old content").unwrap();
+
+    crate::utils::cargo_bin()
+        .args(["decompress", "a.gz", "--dir", "out"])
+        .current_dir(dir)
+        .write_stdin("o\n")
+        .assert()
+        .success();
+
+    assert_eq!("new content", fs::read_to_string(dir.join("out").join("a")).unwrap());
+}
+
 /// This test ensures the current behavior isn't modified by accident, even
 /// if it's not the ideal behavior.
 ///
@@ -2067,24 +2136,24 @@ fn merging_a_rar_asks_before_replacing_each_file() {
     fs::create_dir(&out).unwrap();
     fs::write(out.join("testfile.txt"), "original").unwrap();
 
-    // Skip the file that is already there.
+    // Merge into the existing directory, then skip the file that is already there.
     crate::utils::cargo_bin()
         .arg("decompress")
         .arg(&archive)
         .arg("-d")
         .arg(&out)
-        .write_stdin("s\n")
+        .write_stdin("m\ns\n")
         .assert()
         .success();
     assert_eq!("original", fs::read_to_string(out.join("testfile.txt")).unwrap());
 
-    // Answering overwrite replaces it.
+    // Merge into the existing directory, then overwrite the conflicting file.
     c
```

---

### Incident Patch 6: `a49c6164` (2026-08-31)
**Commit Message**: fix: decompression: ask before overwriting on merge (#1031)

With this PR, on decompression when merging two directories now
the user will be prompted on how to solve further conflicts, instead
of simply overwriting the files on merge.

**File**: `src/archive/rar.rs` (modified, +48/-11)
```diff
@@ -2,30 +2,71 @@
 
 use std::path::{Path, PathBuf};
 
+use fs_err as fs;
 use unrar::{
     Archive, ExtractEvent,
     error::{Code, UnrarError, When},
 };
 
 use crate::{
+    QuestionPolicy,
     error::{Error, FinalError, Result},
     info,
     list::{FileInArchive, ListFileType},
-    utils::{BytesFmt, PathFmt, validate_entry_path},
+    utils::{BytesFmt, PathFmt, resolve_extraction_conflict, validate_entry_path},
     warning,
 };
 
-/// Unpacks the archive given by `archive_path` into the folder given by `output_folder`.
-/// Assumes that output_folder is empty
-pub fn unpack_archive(archive_path: &Path, output_folder: &Path, password: Option<&[u8]>) -> Result<u64> {
+/// Unpacks the archive into `output_folder` and asks before replacing files.
+pub fn unpack_archive(
+    archive_path: &Path,
+    output_folder: &Path,
+    password: Option<&[u8]>,
+    question_policy: QuestionPolicy,
+) -> Result<u64> {
+    // Rar reference records need a full extraction pass to resolve.
+    fs::create_dir_all(output_folder)?;
+    let staging = tempfile::Builder::new()
+        .prefix(".ouch-rar-")
+        .tempdir_in(output_folder)?;
+    extract_all(archive_path, staging.path(), password)?;
+    move_into_place(staging.path(), staging.path(), output_folder, question_policy)
+}
+
+/// Move each staged entry into `output_folder` at the same relative path.
+fn move_into_place(root: &Path, dir: &Path, output_folder: &Path, question_policy: QuestionPolicy) -> Result<u64> {
+    let mut files_unpacked = 0;
+    for entry in fs::read_dir(dir)? {
+        let source = entry?.path();
+        let dest = output_folder.join(source.strip_prefix(root).expect("child of staging root"));
+
+        if fs::symlink_metadata(&source)?.is_dir() {
+            std::fs::create_dir_all(&dest).map_err(|err| Error::Custom {
+                reason: FinalError::with_title(format!("failed to create {}", PathFmt(&dest))).detail(err.to_string()),
+            })?;
+            files_unpacked += move_into_place(root, &source, output_folder, question_policy)?;
+        } else if let Some(target) = resolve_extraction_conflict(&dest, question_policy)? {
+            let size = fs::symlink_metadata(&source)?.len();
+            std::fs::rename(&source, &target).map_err(|err| Error::Custom {
+                reason: FinalError::with_title(format!("failed to extract {}", PathFmt(&target)))
+                    .detail(err.to_string()),
+            })?;
+            info!("extracted ({}) {}", BytesFmt(size), PathFmt(&target));
+            files_unpacked += 1;
+        }
+    }
+    Ok(files_unpacked)
+}
+
+/// Extract the whole archive into a staging folder in one pass.
+fn extract_all(archive_path: &Path, output_folder: &Path, password: Option<&[u8]>) -> Result<()> {
     let archive = match password {
         Some(password) => Archive::with_password(archive_path, password),
         None => Archive::new(archive_path),
     };
 
     let archive = archive.open_for_processing()?;
 
-    let mut files_unpacked: u64 = 0;
     let mut first_err: Option<(PathBuf, i32)> = None;
     let mut unsafe_path: Option<(PathBuf, String)> = None;
 
@@ -39,11 +80,7 @@ pub fn unpack_archive(archive_path: &Path, output_folder: &Path, password: Optio
                 true
             }
         }
-        ExtractEvent::Ok { filename, size } => {
-            info!("extracted ({}) {}", BytesFmt(size), PathFmt(&filename));
-            files_unpacked += 1;
-            true
-        }
+        ExtractEvent::Ok { .. } => true,
         ExtractEvent::Err { filename, error_code } => {
             first_err = Some((filename, error_code));
             // Returning false cancels the rest of the extraction so any
@@ -80,7 +117,7 @@ pub fn unpack_archive(archive_path: &Path, output_folder: &Path, password: Optio
         });
     }
     let _status = cb_result?;
-    Ok(files_unpacked)
+    Ok(())
 }
 
 /// List contents of `archive_path`, returning a vector of archive entries
```

**File**: `src/archive/sevenz.rs` (modified, +33/-10)
```diff
@@ -12,22 +12,30 @@ use same_file::Handle;
 use sevenz_rust2::ArchiveEntry;
 
 use crate::{
-    Result,
+    QuestionPolicy, Result,
     error::{Error, FinalError},
     info,
     list::{FileInArchive, ListFileType},
     utils::{
         BytesFmt, FileVisibilityPolicy, PathFmt, cd_into_same_dir_as, copy_limited_decompression,
-        ensure_parent_dir_exists, is_same_file_as_output, validate_dest_inside_root, validate_entry_path,
+        ensure_parent_dir_exists, is_same_file_as_output, resolve_extraction_conflict, validate_dest_inside_root,
+        validate_entry_path,
     },
     warning,
 };
 
-pub fn unpack_archive<R>(reader: R, output_path: &Path, password: Option<&[u8]>) -> Result<u64>
+pub fn unpack_archive<R>(
+    reader: R,
+    output_path: &Path,
+    password: Option<&[u8]>,
+    question_policy: QuestionPolicy,
+) -> Result<u64>
 where
     R: Read + Seek,
 {
     let mut files_unpacked = 0;
+    // The closure cannot return an ouch error so it is carried out here.
+    let mut conflict_error = None;
 
     let entry_extract_fn =
         |entry: &ArchiveEntry, reader: &mut dyn Read, path: &PathBuf| -> Result<bool, sevenz_rust2::Error> {
@@ -54,11 +62,20 @@ where
                     fs::create_dir_all(path)?;
                 }
             } else {
-                info!("extracted ({}) {}", BytesFmt(entry.size()), PathFmt(&file_path));
+                let dest = match resolve_extraction_conflict(path, question_policy) {
+                    Ok(Some(dest)) => dest,
+                    Ok(None) => return Ok(true),
+                    Err(err) => {
+                        conflict_error = Some(err);
+                        return Ok(false);
+                    }
+                };
+
+                info!("extracted ({}) {}", BytesFmt(entry.size()), PathFmt(&dest));
 
-                ensure_parent_dir_exists(path)?;
+                ensure_parent_dir_exists(&dest)?;
 
-                let file = fs::File::create(path)?;
+                let file = fs::File::create(&dest)?;
                 let mut writer = BufWriter::new(file);
                 copy_limited_decompression(reader, &mut writer)?;
 
@@ -70,25 +87,31 @@ where
                     Some(ft::FileTime::from_system_time(entry.last_modified_date().into())),
                     Some(ft::FileTime::from_system_time(entry.creation_date().into())),
                 ) {
-                    warning!("could not set timestamps on {}: {e}", PathFmt(&file_path));
+                    warning!("could not set timestamps on {}: {e}", PathFmt(&dest));
                 }
             }
 
             files_unpacked += 1;
             Ok(true) // Always proceed
         };
 
-    match password {
+    let result = match password {
         Some(password) => sevenz_rust2::decompress_with_extract_fn_and_password(
             reader,
             output_path,
             sevenz_rust2::Password::from(password.to_str().map_err(|err| Error::InvalidPassword {
                 reason: err.to_string(),
             })?),
             entry_extract_fn,
-        )?,
-        None => sevenz_rust2::decompress_with_extract_fn(reader, output_path, entry_extract_fn)?,
+        ),
+        None => sevenz_rust2::decompress_with_extract_fn(reader, output_path, entry_extract_fn),
+    };
+
+    // Report the prompt failure instead of the library error it caused.
+    if let Some(err) = conflict_error {
+        return Err(err);
     }
+    result?;
 
     Ok(files_unpacked)
 }
```

**File**: `src/archive/tar.rs` (modified, +28/-11)
```diff
@@ -13,21 +13,21 @@ use fs_err as fs;
 use same_file::Handle;
 
 use crate::{
-    Result,
+    QuestionPolicy, Result,
     error::FinalError,
     info,
     list::{FileInArchive, ListFileType},
     utils::{
         self, BytesFmt, FileType, FileVisibilityPolicy, PathFmt, canonicalize, create_symlink, is_same_file_as_output,
-        read_file_type, sanitize_archive_mode, set_permission_mode, validate_dest_inside_root, validate_entry_path,
-        validate_symlink_target,
+        read_file_type, resolve_extraction_conflict, sanitize_archive_mode, set_permission_mode,
+        validate_dest_inside_root, validate_entry_path, validate_symlink_target,
     },
     warning,
 };
 
 /// Unpacks the archive given by `archive` into the folder given by `into`.
 /// Assumes that output_folder is empty
-pub fn unpack_archive(reader: impl Read, output_folder: &Path) -> Result<u64> {
+pub fn unpack_archive(reader: impl Read, output_folder: &Path, question_policy: QuestionPolicy) -> Result<u64> {
     let mut archive = tar::Archive::new(reader);
 
     let mut files_unpacked = 0;
@@ -36,6 +36,9 @@ pub fn unpack_archive(reader: impl Read, output_folder: &Path) -> Result<u64> {
     for entry in archive.entries()? {
         let mut entry = entry?;
 
+        // Set when the user renamed a file so the log can show the real path.
+        let mut written = None;
+
         match entry.header().entry_type() {
             tar::EntryType::Symlink => {
                 let raw_path = entry.path()?.into_owned();
@@ -66,7 +69,20 @@ pub fn unpack_archive(reader: impl Read, output_folder: &Path) -> Result<u64> {
                 fs::hard_link(&full_target_path, &full_link_path)?;
             }
             tar::EntryType::Regular | tar::EntryType::GNUSparse => {
-                entry.unpack_in(output_folder)?;
+                let raw_path = entry.path()?.into_owned();
+                let safe_relpath = validate_entry_path(&raw_path)?;
+                let full_path = output_folder.join(&safe_relpath);
+
+                let Some(dest) = resolve_extraction_conflict(&full_path, question_policy)? else {
+                    continue;
+                };
+
+                if dest == full_path {
+                    entry.unpack_in(output_folder)?;
+                } else {
+                    entry.unpack(&dest)?;
+                }
+                written = Some(dest);
             }
             tar::EntryType::Directory => {
                 let original_mode = entry.header().mode()?;
@@ -90,14 +106,15 @@ pub fn unpack_archive(reader: impl Read, output_folder: &Path) -> Result<u64> {
             _ => continue,
         }
 
+        let unpacked_path = match written {
+            Some(path) => path,
+            None => output_folder.join(entry.path()?),
+        };
+
         if entry.header().entry_type().is_dir() {
-            info!("Directory {} created", PathFmt(&output_folder.join(entry.path()?)));
+            info!("Directory {} created", PathFmt(&unpacked_path));
         } else {
-            info!(
-                "extracted ({}) {}",
-                BytesFmt(entry.size()),
-                PathFmt(&output_folder.join(entry.path()?)),
-            );
+            info!("extracted ({}) {}", BytesFmt(entry.size()), PathFmt(&unpacked_path));
         }
         files_unpacked += 1;
     }
```

**File**: `src/archive/zip.rs` (modified, +19/-4)
```diff
@@ -17,22 +17,27 @@ use zip::{self, DateTime, ZipArchive, read::ZipFile};
 #[cfg(unix)]
 use crate::utils::sanitize_archive_mode;
 use crate::{
-    Result,
+    QuestionPolicy, Result,
     error::FinalError,
     info, info_accessible,
     list::{FileInArchive, ListFileType},
     utils::{
         BytesFmt, FileType, FileVisibilityPolicy, PathFmt, canonicalize, cd_into_same_dir_as,
         copy_limited_decompression, create_symlink, ensure_parent_dir_exists, get_invalid_utf8_paths,
-        is_same_file_as_output, pretty_format_list_of_paths, read_file_type, strip_cur_dir, validate_dest_inside_root,
-        validate_symlink_target,
+        is_same_file_as_output, pretty_format_list_of_paths, read_file_type, resolve_extraction_conflict,
+        strip_cur_dir, validate_dest_inside_root, validate_symlink_target,
     },
     warning,
 };
 
 /// Unpacks the archive given by `archive` into the folder given by `output_folder`.
 /// Assumes that output_folder is empty
-pub fn unpack_archive<R>(reader: R, output_folder: &Path, password: Option<&[u8]>) -> Result<u64>
+pub fn unpack_archive<R>(
+    reader: R,
+    output_folder: &Path,
+    password: Option<&[u8]>,
+    question_policy: QuestionPolicy,
+) -> Result<u64>
 where
     R: Read + Seek,
 {
@@ -87,6 +92,16 @@ where
                 let mode = file.unix_mode();
                 let is_symlink = mode.is_some_and(|mode| mode & 0o170000 == 0o120000);
 
+                // Symlink creation fails on its own when the path is taken.
+                let mut resolved = None;
+                if !is_symlink {
+                    let Some(path) = resolve_extraction_conflict(file_path, question_policy)? else {
+                        continue;
+                    };
+                    resolved = Some(path);
+                }
+                let file_path = resolved.as_deref().unwrap_or(file_path);
+
                 if is_symlink {
                     // Symlink targets are arbitrary bytes on Unix, not guaranteed UTF-8; read as bytes.
                     let mut target_bytes = Vec::new();
```

**File**: `src/commands/decompress.rs` (modified, +17/-4)
```diff
@@ -206,7 +206,7 @@ pub fn decompress_file(options: DecompressOptions) -> Result<()> {
         Tar => unpack_archive(
             |output_dir| {
                 let reader = LimitedReader::new(create_decoder_up_to_first_extension()?);
-                crate::archive::tar::unpack_archive(reader, output_dir)
+                crate::archive::tar::unpack_archive(reader, output_dir, options.question_policy)
             },
             dir,
         )?,
@@ -251,7 +251,10 @@ pub fn decompress_file(options: DecompressOptions) -> Result<()> {
                 ))
             };
 
-            unpack_archive(|output_dir| unpack_fn(reader, output_dir, options.password), dir)?
+            unpack_archive(
+                |output_dir| unpack_fn(reader, output_dir, options.password, options.question_policy),
+                dir,
+            )?
         }
         #[cfg(feature = "unrar")]
         Rar => {
@@ -260,11 +263,21 @@ pub fn decompress_file(options: DecompressOptions) -> Result<()> {
                 let mut temp_file = tempfile::Builder::new().prefix(".ouch-rar-").tempfile_in(&dir)?;
                 copy_limited_decompression(create_decoder_up_to_first_extension()?, &mut temp_file)?;
                 Box::new(move |output_dir| {
-                    crate::archive::rar::unpack_archive(temp_file.path(), output_dir, options.password)
+                    crate::archive::rar::unpack_archive(
+                        temp_file.path(),
+                        output_dir,
+                        options.password,
+                        options.question_policy,
+                    )
                 })
             } else {
                 Box::new(|output_dir| {
-                    crate::archive::rar::unpack_archive(options.input_file_path, output_dir, options.password)
+                    crate::archive::rar::unpack_archive(
+                        options.input_file_path,
+                        output_dir,
+                        options.password,
+                        options.question_policy,
+                    )
                 })
             };
 
```

**File**: `src/utils/fs.rs` (modified, +15/-0)
```diff
@@ -50,6 +50,21 @@ pub fn resolve_path_conflict(
     }
 }
 
+/// Decide where to extract a file when the path is taken. None means skip it.
+pub fn resolve_extraction_conflict(path: &Path, question_policy: QuestionPolicy) -> Result<Option<PathBuf>> {
+    // Only an existing file clashes. Directories merge and other kinds fail on write.
+    if !path.is_file() {
+        return Ok(Some(path.to_path_buf()));
+    }
+
+    // These choices fit a single file. They are rename or overwrite or skip.
+    match user_wants_to_overwrite(path, question_policy, QuestionAction::Compression)? {
+        FileConflitOperation::Cancel => Ok(None),
+        FileConflitOperation::Rename => Ok(Some(find_available_filename_by_renaming(path)?)),
+        FileConflitOperation::Overwrite | FileConflitOperation::Merge => Ok(Some(path.to_path_buf())),
+    }
+}
+
 pub fn remove_file_or_dir(path: &Path) -> Result<()> {
     if path.is_dir() {
         if let Ok(cwd) = env::current_dir()
```

**File**: `tests/integration.rs` (modified, +85/-5)
```diff
@@ -835,7 +835,7 @@ fn unpack_multiple_sources_into_the_same_destination_with_merge(
         .arg(archive1)
         .arg("-d")
         .arg(&out_path)
-        .write_stdin("m")
+        .write_stdin("m\no\n")
         .assert()
         .success();
 
@@ -1641,12 +1641,13 @@ fn decompress_dir_flag_current_dir_and_overwrite() {
         .assert()
         .success();
 
-    // First decompress with `--dir .` — should succeed
+    // First decompress with `--dir .` asks before replacing the file
     crate::utils::cargo_bin()
         .arg("decompress")
         .arg(&archive)
         .args(["--dir", "."])
         .current_dir(dir)
+        .write_stdin("o")
         .assert()
         .success();
 
@@ -1665,14 +1666,14 @@ fn decompress_dir_flag_current_dir_and_overwrite() {
         .assert()
         .success();
 
-    // Decompressing again with `--dir .` — this succeeds for now, and it's
-    // inconsistent with other `--dir PATH` usages, this test ensure this isn't
-    // changed by accident.
+    // Decompressing again with `--dir .` asks before it replaces the file.
+    // Answering overwrite keeps the file replaced.
     crate::utils::cargo_bin()
         .arg("decompress")
         .arg(&archive)
         .args(["--dir", "."])
         .current_dir(dir)
+        .write_stdin("o")
         .assert()
         .success();
 
@@ -2009,3 +2010,82 @@ fn decompress_conflict_with_dev_null_stdin_exits_nonzero() {
         "decompress with an unresolvable conflict on /dev/null stdin must exit non-zero"
     );
 }
+
+// Merging into a folder must ask per file instead of replacing files silently.
+#[test]
+fn merging_into_a_folder_asks_before_replacing_each_file() {
+    for ext in MainDirectoryExtension::iter() {
+        let (_tempdir, dir) = testdir().unwrap();
+        let archive = dir.join(format!("archive.{ext}"));
+        let source = dir.join("src");
+        fs::create_dir(&source).unwrap();
+        fs::write(source.join("data.txt"), "from archive").unwrap();
+
+        crate::utils::cargo_bin()
+            .args(["compress", source.join("data.txt").to_str().unwrap()])
+            .arg(&archive)
+            .assert()
+            .success();
+
+        let out = dir.join("out");
+        fs::create_dir(&out).unwrap();
+        fs::write(out.join("data.txt"), "original").unwrap();
+
+        // Merge the folder and then skip the file that is already there.
+        crate::utils::cargo_bin()
+            .arg("decompress")
+            .arg(&archive)
+            .arg("-d")
+            .arg(&out)
+            .write_stdin("m\ns\n")
+            .assert()
+            .success();
+        assert_eq!("original", fs::read_to_string(out.join("data.txt")).unwrap());
+
+        // Answering overwrite replaces it.
+        crate::utils::cargo_bin()
+            .arg("decompress")
+            .arg(&archive)
+            .arg("-d")
+            .arg(&out)
+            .write_stdin("m\no\n")
+            .assert()
+            .success();
+        assert_eq!("from archive", fs::read_to_string(out.join("data.txt")).unwrap());
+    }
+}
+
+// Merging a rar into a folder must ask before it replaces a file.
+#[cfg(feature = "unrar")]
+#[test]
+fn merging_a_rar_asks_before_replacing_each_file() {
+    let (_tempdir, dir) = testdir().unwrap();
+    let mut archive = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
+    archive.push("tests/data/testfile.rar5.rar");
+
+    let out = dir.join("out");
+    fs::create_dir(&out).unwrap();
+    fs::write(out.join("testfile.txt"), "original").unwrap();
+
+    // Skip the file that is already there.
+    crate::utils::cargo_bin()
+        .arg("decompress")
+        .arg(&archive)
+        .arg("-d")
+        .arg(&out)
+        .write_stdin("s\n")
+        .assert()
+        .success();
+    assert_eq!("original", fs::read_to_string(out.join("testfile.txt")).unwrap());
+
+    // Answering overwrite replaces it.
+    crate::utils::cargo_bin()
+        .arg("decompress")
+        .arg(&archive)
+        .arg("-d")
+        .arg(&out)
+        .write_stdin("o\n")
+        .assert()
+        .success();
+    assert_eq!("Testing 123\n", fs::read_to_string(out.join("testfile.txt")).unwrap());
+}
```

---

### Incident Patch 7: `98266d77` (2026-08-27)
**Commit Message**: fix: scope visibility flags to compression (#1030)

**File**: `src/cli/args.rs` (modified, +20/-11)
```diff
@@ -26,18 +26,10 @@ pub struct CliArgs {
     #[arg(short = 'A', long, env = "ACCESSIBLE", global = true)]
     pub accessible: bool,
 
-    /// Ignore hidden files
-    #[arg(short = 'H', long, global = true)]
-    pub hidden: bool,
-
     /// Silence output
     #[arg(short, long, global = true)]
     pub quiet: bool,
 
-    /// Ignore files matched by git's ignore files
-    #[arg(short, long, global = true)]
-    pub gitignore: bool,
-
     /// Specify the format of the archive
     #[arg(short, long, global = true)]
     pub format: Option<String>,
@@ -73,6 +65,14 @@ pub enum Subcommand {
         #[arg(required = true, value_hint = ValueHint::FilePath)]
         output: PathBuf,
 
+        /// Ignore hidden files
+        #[arg(short = 'H', long)]
+        hidden: bool,
+
+        /// Ignore files matched by git's ignore files
+        #[arg(short, long)]
+        gitignore: bool,
+
         /// Compression level, applied to all formats
         #[arg(short, long, group = "compression-level")]
         level: Option<i16>,
@@ -157,9 +157,7 @@ mod tests {
             yes: false,
             no: false,
             accessible: false,
-            hidden: false,
             quiet: false,
-            gitignore: false,
             format: None,
             // This is usually replaced in assertion tests
             password: None,
@@ -220,6 +218,8 @@ mod tests {
                 cmd: Subcommand::Compress {
                     files: to_paths(["file"]),
                     output: PathBuf::from("file.tar.gz"),
+                    hidden: false,
+                    gitignore: false,
                     level: None,
                     fast: false,
                     slow: false,
@@ -234,6 +234,8 @@ mod tests {
                 cmd: Subcommand::Compress {
                     files: to_paths(["a", "b", "c"]),
                     output: PathBuf::from("archive.tar.gz"),
+                    hidden: false,
+                    gitignore: false,
                     level: None,
                     fast: false,
                     slow: false,
@@ -243,11 +245,13 @@ mod tests {
             }
         );
         test!(
-            "ouch compress a b c archive.tar.gz",
+            "ouch compress --hidden --gitignore a b c archive.tar.gz",
             CliArgs {
                 cmd: Subcommand::Compress {
                     files: to_paths(["a", "b", "c"]),
                     output: PathBuf::from("archive.tar.gz"),
+                    hidden: true,
+                    gitignore: true,
                     level: None,
                     fast: false,
                     slow: false,
@@ -273,6 +277,8 @@ mod tests {
                     cmd: Subcommand::Compress {
                         files: to_paths(["a", "b", "c"]),
                         output: PathBuf::from("output"),
+                        hidden: false,
+                        gitignore: false,
                         level: None,
                         fast: false,
                         slow: false,
@@ -291,5 +297,8 @@ mod tests {
         assert!(CliArgs::try_parse_from(args_splitter("ouch c input")).is_err());
         assert!(CliArgs::try_parse_from(args_splitter("ouch d")).is_err());
         assert!(CliArgs::try_parse_from(args_splitter("ouch l")).is_err());
+        assert!(CliArgs::try_parse_from(args_splitter("ouch decompress --hidden file.tar.gz")).is_err());
+        assert!(CliArgs::try_parse_from(args_splitter("ouch list --gitignore file.tar.gz")).is_err());
+        assert!(CliArgs::try_parse_from(args_splitter("ouch --hidden compress file file.tar.gz")).is_err());
     }
 }
```

**File**: `src/cli/mod.rs` (modified, +11/-9)
```diff
@@ -46,19 +46,21 @@ impl CliArgs {
             (true, true) => unreachable!(),
         };
 
-        let follow_symlinks = matches!(
-            &args.cmd,
+        let (hidden, gitignore, follow_symlinks) = match &args.cmd {
             Subcommand::Compress {
-                follow_symlinks: true,
+                hidden,
+                gitignore,
+                follow_symlinks,
                 ..
-            }
-        );
+            } => (*hidden, *gitignore, *follow_symlinks),
+            Subcommand::Decompress { .. } | Subcommand::List { .. } => (false, false, false),
+        };
 
         let file_visibility_policy = FileVisibilityPolicy::new()
-            .read_git_exclude(args.gitignore)
-            .read_ignore(args.gitignore)
-            .read_git_ignore(args.gitignore)
-            .read_hidden(args.hidden)
+            .read_git_exclude(gitignore)
+            .read_ignore(gitignore)
+            .read_git_ignore(gitignore)
+            .read_hidden(hidden)
             .follow_symlinks(follow_symlinks);
 
         Ok((args, skip_questions_positively, file_visibility_policy))
```

**File**: `src/commands/mod.rs` (modified, +4/-2)
```diff
@@ -60,6 +60,8 @@ pub fn run(args: CliArgs, question_policy: QuestionPolicy, file_visibility_polic
         Subcommand::Compress {
             files,
             output: output_path,
+            hidden: _,
+            gitignore,
             level,
             fast,
             slow,
@@ -72,9 +74,9 @@ pub fn run(args: CliArgs, question_policy: QuestionPolicy, file_visibility_polic
 
             // gitignore and follow_symlinks both read paths outside the declared input set so the
             // sandbox cannot confine them; run unsandboxed and say why
-            let sandbox_disabled = sandbox::disabled_by_request(args.no_sandbox) || args.gitignore || follow_symlinks;
+            let sandbox_disabled = sandbox::disabled_by_request(args.no_sandbox) || gitignore || follow_symlinks;
             if cfg!(target_os = "linux") && !sandbox::disabled_by_request(args.no_sandbox) {
-                if args.gitignore {
+                if gitignore {
                     info!("Sandbox: disabled because --gitignore reads git configuration outside the input files");
                 }
                 if follow_symlinks {
```

**File**: `tests/snapshots/ui__ui_test_usage_help_flag-2.snap` (modified, +0/-2)
```diff
@@ -16,9 +16,7 @@ Options:
   -y, --yes                  Skip [Y/n] questions, default to yes
   -n, --no                   Skip [Y/n] questions, default to no
   -A, --accessible           Activate accessibility mode, reducing visual noise [env: ACCESSIBLE=]
-  -H, --hidden               Ignore hidden files
   -q, --quiet                Silence output
-  -g, --gitignore            Ignore files matched by git's ignore files
   -f, --format <FORMAT>      Specify the format of the archive
   -p, --password <PASSWORD>  Decompress or list with password [env: OUCH_PASSWORD=]
   -c, --threads <THREADS>    Concurrent working threads
```

**File**: `tests/snapshots/ui__ui_test_usage_help_flag.snap` (modified, +0/-6)
```diff
@@ -28,15 +28,9 @@ Options:
           
           [env: ACCESSIBLE=]
 
-  -H, --hidden
-          Ignore hidden files
-
   -q, --quiet
           Silence output
 
-  -g, --gitignore
-          Ignore files matched by git's ignore files
-
   -f, --format <FORMAT>
           Specify the format of the archive
 
```

---

### Incident Patch 8: `d87eb9ca` (2026-08-27)
**Commit Message**: Fix stale dependencies (#1053)

**File**: `Cargo.lock` (modified, +154/-357)
```diff
@@ -10,9 +10,9 @@ checksum = "320119579fcad9c21884f5c4861d16174d0e06250625266f50fe6898340abefa"
 
 [[package]]
 name = "aes"
-version = "0.9.0"
+version = "0.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "66bd29a732b644c0431c6140f370d097879203d79b80c94a6747ba0872adaef8"
+checksum = "f8eb277bec05f56a0e0591f155a484cbd0f4f07ff2905051a48c72f004f7ed58"
 dependencies = [
  "cipher",
  "cpubits",
@@ -21,9 +21,9 @@ dependencies = [
 
 [[package]]
 name = "aho-corasick"
-version = "1.1.4"
+version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
+checksum = "c982642fa9e8606056828ee9a8505737230110bb1099153c79efe865c59d12ba"
 dependencies = [
  "memchr",
 ]
@@ -36,9 +36,9 @@ checksum = "cc7bb162ec39d46ab1ca8c77bf72e890535becd1751bb45f64c597edb4c8c6b3"
 
 [[package]]
 name = "alloc-stdlib"
-version = "0.2.2"
+version = "0.2.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "94fb8275041c72129eb51b7d0322c29b8387a0386127718b096429201a5d6ece"
+checksum = "0e76a019e91224d279006ff972f1e984179a6e9feb050adba6ce8274aef23195"
 dependencies = [
  "alloc-no-stdlib",
 ]
@@ -116,9 +116,9 @@ dependencies = [
 
 [[package]]
 name = "autocfg"
-version = "1.5.0"
+version = "1.5.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
+checksum = "f2032f911046de80f0a198e0901378627c33f59ea0ac00e363d481118bd70a53"
 
 [[package]]
 name = "bindgen"
@@ -136,8 +136,8 @@ dependencies = [
  "quote",
  "regex",
  "rustc-hash",
- "shlex",
- "syn 2.0.117",
+ "shlex 1.3.0",
+ "syn 2.0.119",
 ]
 
 [[package]]
@@ -157,15 +157,15 @@ checksum = "5e764a1d40d510daf35e07be9eb06e75770908c27d411ee6c92109c9840eaaf7"
 
 [[package]]
 name = "bitflags"
-version = "2.11.1"
+version = "2.13.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c4512299f36f043ab09a583e57bceb5a5aab7a73db1805848e8fef3c9e8c78b3"
+checksum = "b588b76d00fde79687d7646a9b5bdf3cc0f655e0bbd080335a95d7e96f3587da"
 
 [[package]]
 name = "block-buffer"
-version = "0.12.0"
+version = "0.12.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cdd35008169921d80bc60d3d0ab416eecb028c4cd653352907921d95084790be"
+checksum = "d2f6c7dbe95a6ed67ad9f18e57daf93a2f034c524b99fd2b76d18fdfeb6660aa"
 dependencies = [
  "hybrid-array",
  "zeroize",
@@ -193,9 +193,9 @@ dependencies = [
 
 [[package]]
 name = "brotli-decompressor"
-version = "5.0.0"
+version = "5.0.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "874bb8112abecc98cbd6d81ea4fa7e94fb9449648c93cc89aa40c81c24d7de03"
+checksum = "3a32acac15fe1967bc3986b2a6347dffc965602354ea6f450ad07e8bfd253583"
 dependencies = [
  "alloc-no-stdlib",
  "alloc-stdlib",
@@ -214,9 +214,9 @@ dependencies = [
 
 [[package]]
 name = "bumpalo"
-version = "3.20.2"
+version = "3.20.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5d20789868f4b01b2f2caec9f5c4e0213b41e3e5702a50157d699ae31ced2fcb"
+checksum = "72f5acc6cb2ba439de613abc23857ec3d78374d8ed5ac84e9d11336e87da8649"
 
 [[package]]
 name = "byteorder"
@@ -226,15 +226,15 @@ checksum = "1fd0f2584146f6f2ef48085050886acf353beff7305ebd1ae69500e27c67f64b"
 
 [[package]]
 name = "bytes"
-version = "1.11.1"
+version = "1.12.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1e748733b7cbc798e1434b6ac524f0c1ff2ab456fe201501e6497c8417a4fc33"
+checksum = "fc652a48c352aef3ea3aed32080501cf3ef6ed5da78602a020c991775b0aff04"
 
 [[package]]
 name = "bytesize"
-version = "2.3.1"
+version = "2.7.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6bd91ee7b2422bcb158d90ef4d14f75ef67f340943fc4149891dcce8f8b972a3"
+checksum = "7354288c522e7e980fafd2075d63d1285794c3a6a16cdd492f189ea406e5f18b"
 
 [[package]]
 name = "bzip2"
@@ -261,23 +261,23 @@ dependencies = [
 
 [[package]]
 name = "cbc"
-version = "0.2.0"
+version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "98db6aeaef0eeef2c1e3ce9a27b739218825dae116076352ac3777076aa22225"
+checksum = "ce2dc9ee5f88d11e0beb842c88b33c8a5cf0d1329c4b19494af42b07dbfe8896"
 dependencies = [
  "cipher",
 ]
 
 [[package]]
 name = "cc"
-version = "1.2.62"
+version = "1.4.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a1dce859f0832a7d088c4f1119888ab94ef4b5d6795d1ce05afb7fe159d79f98"
+checksum = "0ad534f4357a5264cce5019c989cf66a4f0dc4e0d1b1d15f8aacec0ff7360273"
 dependencies = [
  "find-msvc-tools",
  "jobserver",
  "libc",
- "shlex",
+ "shlex 2.0.1",
 ]
 
 [[package]]
@@ -308,19 +308,19 @@ checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
 
 [[package]]
 name = "cipher"
-version = "0.5.1"
+version = "0.5.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-ch
```

---

### Incident Patch 9: `e0568442` (2026-08-25)
**Commit Message**: fix(completions): clarify compress positional arguments (#1057)

**File**: `build.rs` (modified, +3/-0)
```diff
@@ -18,6 +18,8 @@ use clap_complete::{Shell, generate_to};
 use clap_complete_nushell::Nushell;
 
 include!("src/cli/args.rs");
+#[path = "src/cli/completion.rs"]
+mod completion;
 
 fn main() {
     println!("cargo:rerun-if-env-changed=OUCH_ARTIFACTS_FOLDER");
@@ -29,6 +31,7 @@ fn main() {
 
         clap_mangen::generate_to(cmd.clone(), out).unwrap();
 
+        let cmd = &mut completion::with_combined_compress_positionals(CliArgs::command());
         for shell in Shell::value_variants() {
             generate_to(*shell, cmd, "ouch", out).unwrap();
         }
```

**File**: `src/cli/completion.rs` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+use clap::Command;
+
+const COMPRESSION_POSITIONAL_HELP: &str = "Input files; or output archive with compression format when placed last";
+
+pub fn with_combined_compress_positionals(mut command: Command) -> Command {
+    let compress = command
+        .find_subcommand_mut("compress")
+        .expect("compress subcommand should exist");
+
+    *compress = std::mem::take(compress).mut_args(|argument| match argument.get_id().as_str() {
+        "files" | "output" => argument.help(COMPRESSION_POSITIONAL_HELP),
+        _ => argument,
+    });
+
+    command
+}
+
+#[cfg(test)]
+mod tests {
+    use clap::CommandFactory;
+
+    use super::*;
+    use crate::cli::CliArgs;
+
+    #[test]
+    fn keeps_standard_compress_positional_descriptions() {
+        let command = CliArgs::command();
+        let compress = command
+            .find_subcommand("compress")
+            .expect("compress subcommand should exist");
+        let descriptions = compress
+            .get_arguments()
+            .filter(|argument| matches!(argument.get_id().as_str(), "files" | "output"))
+            .map(|argument| argument.get_help().map(ToString::to_string))
+            .collect::<Vec<_>>();
+
+        assert_eq!(
+            descriptions,
+            [
+                Some("Files to be compressed".to_owned()),
+                Some("The resulting file. Its extensions can be used to specify the compression formats".to_owned()),
+            ]
+        );
+    }
+
+    #[test]
+    fn combines_compress_positional_descriptions() {
+        let command = with_combined_compress_positionals(CliArgs::command());
+        let compress = command
+            .find_subcommand("compress")
+            .expect("compress subcommand should exist");
+
+        for id in ["files", "output"] {
+            let argument = compress
+                .get_arguments()
+                .find(|argument| argument.get_id() == id)
+                .expect("compress positional argument should exist");
+            assert_eq!(
+                argument.get_help().map(ToString::to_string).as_deref(),
+                Some(COMPRESSION_POSITIONAL_HELP)
+            );
+        }
+    }
+}
```

**File**: `src/cli/mod.rs` (modified, +2/-0)
```diff
@@ -1,6 +1,8 @@
 //! CLI related functions, uses the clap argparsing definitions from `args.rs`.
 
 mod args;
+#[cfg(test)]
+mod completion;
 
 use std::path::{Path, PathBuf, absolute};
 
```

---

### Incident Patch 10: `410337ac` (2026-08-16)
**Commit Message**: fix: negative compression levels interpreted as max lvl (#1046)

Negative compression levels were cast to u32 first, wrapping negative values to large unsigned integers. Clamping after the cast resulted in maximum compression instead of minimum.

Fix: clamp on the i16 value before casting to u32. Add regression test to prevent silent wrap-around.

**File**: `src/commands/compress.rs` (modified, +6/-6)
```diff
@@ -54,7 +54,7 @@ pub fn compress_files(
                 // instead of the regular default that flate2 uses
                 let parz: ParCompress<gzp::deflate::Gzip, _> = ParCompressBuilder::new()
                     .compression_level(
-                        level.map_or_else(Default::default, |l| gzp::Compression::new((l as u32).clamp(0, 9))),
+                        level.map_or_else(Default::default, |l| gzp::Compression::new(l.clamp(0, 9) as u32)),
                     )
                     .num_threads(logical_thread_count())
                     .expect("gpz: num_threads must be greater than 0")
@@ -63,7 +63,7 @@ pub fn compress_files(
             }),
             Bzip => Box::new(bzip2::write::BzEncoder::new(
                 encoder,
-                level.map_or_else(Default::default, |l| bzip2::Compression::new((l as u32).clamp(1, 9))),
+                level.map_or_else(Default::default, |l| bzip2::Compression::new(l.clamp(1, 9) as u32)),
             )),
             Bzip3 => {
                 #[cfg(not(feature = "bzip3"))]
@@ -78,14 +78,14 @@ pub fn compress_files(
             Lz4 => Box::new(lz4_flex::frame::FrameEncoder::new(encoder).auto_finish()),
             Lzma => {
                 let options = level.map_or_else(Default::default, |l| {
-                    lzma_rust2::LzmaOptions::with_preset((l as u32).clamp(0, 9))
+                    lzma_rust2::LzmaOptions::with_preset(l.clamp(0, 9) as u32)
                 });
                 let writer = lzma_rust2::LzmaWriter::new_use_header(encoder, &options, None)?;
                 Box::new(writer.auto_finish())
             }
             Xz => {
                 let mut options = level.map_or_else(Default::default, |l| {
-                    lzma_rust2::XzOptions::with_preset((l as u32).clamp(0, 9))
+                    lzma_rust2::XzOptions::with_preset(l.clamp(0, 9) as u32)
                 });
                 let dict_size = options.lzma_options.dict_size as u64;
                 options.set_block_size(NonZeroU64::new(dict_size));
@@ -95,15 +95,15 @@ pub fn compress_files(
             }
             Lzip => {
                 let options = level.map_or_else(Default::default, |l| {
-                    lzma_rust2::LzipOptions::with_preset((l as u32).clamp(0, 9))
+                    lzma_rust2::LzipOptions::with_preset(l.clamp(0, 9) as u32)
                 });
                 let writer = lzma_rust2::LzipWriter::new(encoder, options);
                 Box::new(writer.auto_finish())
             }
             Snappy => Box::new({
                 let parz: ParCompress<gzp::snap::Snap, _> = ParCompressBuilder::new()
                     .compression_level(gzp::par::compress::Compression::new(
-                        level.map_or_else(Default::default, |l| (l as u32).clamp(0, 9)),
+                        level.map_or_else(Default::default, |l| l.clamp(0, 9) as u32),
                     ))
                     .num_threads(logical_thread_count())
                     .expect("gpz: num_threads must be greater than 0")
```

**File**: `tests/integration.rs` (modified, +27/-0)
```diff
@@ -167,6 +167,33 @@ fn single_file(
     assert_same_directory(before, after, false);
 }
 
+/// A negative `--level` must clamp to the minimum compression, not the maximum.
+///
+/// Regression test: the level was cast to an unsigned integer before clamping, so
+/// `-1i16 as u32` became 4294967295 and `clamp(0, 9)` returned 9, silently giving
+/// maximum compression instead of minimum.
+#[test]
+fn negative_compression_level_is_not_maximum() {
+    let (_tempdir, dir) = testdir().unwrap();
+    let before_file = &dir.join("file");
+    // Highly compressible content, so the compression level actually changes the output size
+    fs::write(before_file, "ouch".repeat(64 * 1024)).unwrap();
+
+    let compress_with_level = |level: &str, name: &str| {
+        let archive = &dir.join(name);
+        ouch!("-A", "c", format!("--level={level}"), before_file, archive);
+        fs::metadata(archive).unwrap().len()
+    };
+
+    let negative = compress_with_level("-1", "negative.gz");
+    let maximum = compress_with_level("9", "maximum.gz");
+
+    assert_ne!(
+        negative, maximum,
+        "--level=-1 must not produce the same output as --level=9 (maximum compression)"
+    );
+}
+
 /// Compress and decompress a single file over stdin.
 #[proptest(cases = 200)]
 fn single_file_stdin(
```

---

### Incident Patch 11: `719cb031` (2026-07-18)
**Commit Message**: fix size-limit and non-UTF-8 zip symlinks (#1020)

**File**: `src/archive/zip.rs` (modified, +25/-8)
```diff
@@ -66,10 +66,12 @@ where
                 let is_symlink = mode.is_some_and(|mode| mode & 0o170000 == 0o120000);
 
                 if is_symlink {
-                    let mut target = String::new();
-                    file.read_to_string(&mut target)?;
+                    // Symlink targets are arbitrary bytes on Unix, not guaranteed UTF-8; read as bytes.
+                    let mut target_bytes = Vec::new();
+                    file.read_to_end(&mut target_bytes)?;
+                    let target = symlink_target_from_bytes(&target_bytes);
 
-                    validate_symlink_target(&relpath, Path::new(&target))?;
+                    validate_symlink_target(&relpath, &target)?;
                     #[cfg(unix)]
                     std::os::unix::fs::symlink(&target, &file_path)?;
                     #[cfg(windows)]
@@ -86,13 +88,15 @@ where
                 let is_symlink = mode.is_some_and(|mode| mode & 0o170000 == 0o120000);
 
                 if is_symlink {
-                    let mut target = String::new();
-                    file.read_to_string(&mut target)?;
+                    // Symlink targets are arbitrary bytes on Unix, not guaranteed UTF-8; read as bytes.
+                    let mut target_bytes = Vec::new();
+                    file.read_to_end(&mut target_bytes)?;
+                    let target = symlink_target_from_bytes(&target_bytes);
 
-                    validate_symlink_target(&relpath, Path::new(&target))?;
-                    info!("linking {} -> \"{}\"", PathFmt(file_path), target);
+                    validate_symlink_target(&relpath, &target)?;
+                    info!("linking {} -> \"{}\"", PathFmt(file_path), target.display());
 
-                    create_symlink(Path::new(&target), file_path)?;
+                    create_symlink(&target, file_path)?;
                 } else {
                     #[cfg(unix)]
                     let mut output_file = {
@@ -286,6 +290,19 @@ where
     Ok(bytes)
 }
 
+/// Decode a zip symlink target's raw bytes into a path (lossless on Unix, lossy elsewhere).
+fn symlink_target_from_bytes(bytes: &[u8]) -> PathBuf {
+    #[cfg(unix)]
+    {
+        use std::os::unix::ffi::OsStrExt;
+        PathBuf::from(std::ffi::OsStr::from_bytes(bytes))
+    }
+    #[cfg(not(unix))]
+    {
+        PathBuf::from(String::from_utf8_lossy(bytes).into_owned())
+    }
+}
+
 fn display_zip_comment_if_exists<R: Read>(file: &ZipFile<'_, R>) {
     let comment = file.comment();
     if !comment.is_empty() {
```

**File**: `src/utils/fs.rs` (modified, +9/-4)
```diff
@@ -220,10 +220,15 @@ impl<R: Read> Read for LimitedReader<R> {
         }
 
         if self.remaining == 0 {
-            return Err(io::Error::new(
-                io::ErrorKind::InvalidData,
-                "decompression output exceeded configured limit (see OUCH_MAX_DECOMPRESSED_BYTES)",
-            ));
+            // Probe one byte to tell exactly-at-limit (EOF) from over-limit; discarded on error.
+            let mut probe = [0u8; 1];
+            return match self.inner.read(&mut probe)? {
+                0 => Ok(0),
+                _ => Err(io::Error::new(
+                    io::ErrorKind::InvalidData,
+                    "decompression output exceeded configured limit (see OUCH_MAX_DECOMPRESSED_BYTES)",
+                )),
+            };
         }
 
         let bytes_to_ready = usize::try_from(self.remaining).unwrap_or(usize::MAX).min(buf.len());
```

---

### Incident Patch 12: `e11f199f` (2026-07-04)
**Commit Message**: fix: wrong size on empty folder entries in zip archives (#1018)

**File**: `src/archive/zip.rs` (modified, +2/-1)
```diff
@@ -260,7 +260,8 @@ where
                     io::copy(&mut file, &mut writer)?;
                 }
                 FileType::Directory => {
-                    writer.add_directory(entry_name, default_options)?;
+                    // Directory entries have no data and get an invalid size when ZIP64 is forced on
+                    writer.add_directory(entry_name, default_options.large_file(false))?;
                 }
                 FileType::Symlink => {
                     let target_path = path.read_link()?;
```

---

### Incident Patch 13: `6c3c8039` (2026-06-26)
**Commit Message**: fix: ignore invalid unix permissions and setuid bits from zip (#1007)

Signed-off-by: tommady <[REDACTED_EMAIL]>

**File**: `src/archive/zip.rs` (modified, +9/-1)
```diff
@@ -337,7 +337,15 @@ fn unix_set_permissions<R: Read>(file_path: &Path, file: &ZipFile<'_, R>) -> Res
     use std::fs::Permissions;
 
     if let Some(mode) = file.unix_mode() {
-        fs::set_permissions(file_path, Permissions::from_mode(sanitize_archive_mode(mode)))?;
+        // Zip crate may return invalid Unix modes derived from MS-DOS attributes.
+        // Valid Unix modes contain the file type bits (S_IFMT, 0o170000).
+        // If these bits are missing, the mode is likely invalid and should be ignored.
+        // Also, we mask out the setuid, setgid, and sticky bits (0o7777 -> 0o0777)
+        // for security reasons when decompressing.
+        if mode & 0o170000 != 0 {
+            let safe_mode = mode & 0o777;
+            fs::set_permissions(file_path, Permissions::from_mode(sanitize_archive_mode(safe_mode)))?;
+        }
     }
 
     Ok(())
```

**File**: `tests/integration.rs` (modified, +49/-0)
```diff
@@ -1570,6 +1570,55 @@ fn decompress_concatenated_lz4_frames() {
     });
 }
 
+/// Ensure extracting zip archives lacking correct UNIX file type bits (e.g. MS-DOS attributes mapped poorly)
+/// won't wrongly apply setuid/setgid bits.
+#[test]
+fn missing_file_type_unix_permissions() {
+    let (_tempdir, test_dir) = testdir().unwrap();
+
+    let bad_perms_zip = test_dir.join("bad_perms.zip");
+
+    {
+        use zip::write::SimpleFileOptions;
+
+        let file = std::fs::File::create(&bad_perms_zip).unwrap();
+        let mut zip = zip::ZipWriter::new(file);
+
+        // Use an invalid mode: 0o7700 (missing S_IFMT)
+        let options = SimpleFileOptions::default().unix_permissions(0o7700);
+        zip.start_file("test_file.txt", options).unwrap();
+        zip.write_all(b"hello world").unwrap();
+        zip.finish().unwrap();
+    }
+
+    let out_dir = test_dir.join("out");
+
+    let mut cmd = crate::utils::cargo_bin();
+    cmd.arg("d")
+        .arg(&bad_perms_zip)
+        .arg("-d")
+        .arg(&out_dir)
+        .assert()
+        .success();
+
+    #[cfg(unix)]
+    {
+        use std::os::unix::fs::PermissionsExt;
+        let file_path = out_dir.join("test_file.txt");
+        let metadata = std::fs::metadata(&file_path).unwrap();
+        let mode = metadata.permissions().mode();
+
+        // Default permission should be applied since 0o7700 does not have file type bits.
+        // It definitely shouldn't be 0o7700 or have sticky/setuid bits.
+        assert_ne!(
+            mode & 0o7777,
+            0o7700,
+            "Should have fallen back to default file permissions"
+        );
+        assert_eq!(mode & 0o7000, 0, "Should not have sticky, setuid, or setgid bits");
+    }
+}
+
 /// A conflict that cannot be resolved because stdin is /dev/null must fail, not exit 0.
 #[test]
 fn decompress_conflict_with_dev_null_stdin_exits_nonzero() {
```

---

### Incident Patch 14: `31fa3bdf` (2026-06-21)
**Commit Message**: security improvements (#951)

Co-authored-by: João Marcos <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +11/-3)
```diff
@@ -12,6 +12,7 @@ Categories Used:
 - Tweaks - anything that doesn't fit into other categories, small typo fixes, most CI stuff,
   meta changes (e.g. README updates), etc.
 - Removals - removal of a feature (and most likely a breaking change)
+- Safety - Changes focused on preventing malicious attacks
 
 **Bullet points in chronological order by PR**
 
@@ -21,6 +22,16 @@ Categories Used:
 
 ### Improvements
 
+- Add `OUCH_PASSWORD` env var as alternative to `--password` (https://github.com/ouch-org/ouch/pull/951).
+- Add `OUCH_MAX_DECOMPRESSED_BYTES` to optionally cap decompressed output size and listing (https://github.com/ouch-org/ouch/pull/951).
+
+### Safety
+
+- Limit LZMA/XZ decoder size limit to 256 MiB to prevent OOM attacks from malicious inputs (https://github.com/ouch-org/ouch/pull/951).
+- Prevent path traversal and symlink/hardlink escape attacks in tar, zip, 7z, and rar entries (https://github.com/ouch-org/ouch/pull/951).
+- Sanitize archive-controlled filenames, comments, symlink targets, and error text before printing to the terminal (https://github.com/ouch-org/ouch/pull/951).
+- Strip special permission bits from archive-supplied file modes and create zip outputs with final sanitized permissions immediately (https://github.com/ouch-org/ouch/pull/951).
+
 ### Bug Fixes
 
 - Decompress: exit with a non-zero code when a file conflict can't be resolved on non-interactive stdin, instead of silently skipping and reporting success (https://github.com/ouch-org/ouch/pull/1011)
@@ -49,9 +60,6 @@ Categories Used:
 - Fix various panics not handled gracefully (https://github.com/ouch-org/ouch/pull/950)
 - Handle GNUSparse archive entries during tar decompression (https://github.com/ouch-org/ouch/pull/975)
 
-### Tweaks
-
-
 ## [0.7.1](https://github.com/ouch-org/ouch/releases/tag/0.7.1)
 
 ### Bug Fixes
```

**File**: `src/archive/rar.rs` (modified, +19/-1)
```diff
@@ -11,7 +11,8 @@ use crate::{
     error::{Error, FinalError, Result},
     info,
     list::{FileInArchive, ListFileType},
-    utils::{BytesFmt, PathFmt},
+    utils::{BytesFmt, PathFmt, validate_entry_path},
+    warning,
 };
 
 /// Unpacks the archive given by `archive_path` into the folder given by `output_folder`.
@@ -26,8 +27,18 @@ pub fn unpack_archive(archive_path: &Path, output_folder: &Path, password: Optio
 
     let mut files_unpacked: u64 = 0;
     let mut first_err: Option<(PathBuf, i32)> = None;
+    let mut unsafe_path: Option<(PathBuf, String)> = None;
 
     let cb_result = archive.extract_all_with_callback(output_folder, |event| match event {
+        ExtractEvent::Start { filename, .. } => {
+            if let Err(e) = validate_entry_path(&filename) {
+                warning!("refusing unsafe rar entry {}: {}", PathFmt(&filename), e);
+                unsafe_path = Some((filename, e.to_string()));
+                false
+            } else {
+                true
+            }
+        }
         ExtractEvent::Ok { filename, size } => {
             info!("extracted ({}) {}", BytesFmt(size), PathFmt(&filename));
             files_unpacked += 1;
@@ -55,6 +66,13 @@ pub fn unpack_archive(archive_path: &Path, output_folder: &Path, password: Optio
         _ => true,
     });
 
+    if let Some((path, reason)) = unsafe_path {
+        return Err(Error::Custom {
+            reason: FinalError::with_title(format!("refusing to extract unsafe rar entry {}", PathFmt(&path)))
+                .detail(reason),
+        });
+    }
+
     if let Some((path, code)) = first_err {
         let inner = UnrarError::from(Code::from(code), When::Process).to_string();
         return Err(Error::Custom {
```

**File**: `src/archive/sevenz.rs` (modified, +19/-7)
```diff
@@ -1,8 +1,7 @@
 //! SevenZip archive format compress function
 
 use std::{
-    env,
-    io::{self, BufWriter, Read, Seek, Write},
+    io::{BufWriter, Read, Seek, Write},
     path::{Path, PathBuf},
 };
 
@@ -18,7 +17,8 @@ use crate::{
     info,
     list::{FileInArchive, ListFileType},
     utils::{
-        BytesFmt, FileVisibilityPolicy, PathFmt, cd_into_same_dir_as, ensure_parent_dir_exists, is_same_file_as_output,
+        BytesFmt, FileVisibilityPolicy, PathFmt, cd_into_same_dir_as, copy_limited_decompression,
+        ensure_parent_dir_exists, is_same_file_as_output, validate_dest_inside_root, validate_entry_path,
     },
     warning,
 };
@@ -33,7 +33,20 @@ where
         |entry: &ArchiveEntry, reader: &mut dyn Read, path: &PathBuf| -> Result<bool, sevenz_rust2::Error> {
             // Manually handle writing all files from 7z archive (the library defaults ignore empty files)
 
-            let file_path = output_path.join(entry.name());
+            let name_as_path = Path::new(entry.name());
+            let safe_relpath = match validate_entry_path(name_as_path) {
+                Ok(p) => p,
+                Err(e) => {
+                    warning!("skipping unsafe 7z entry {}: {}", PathFmt(name_as_path), e);
+                    return Ok(true);
+                }
+            };
+            let file_path = output_path.join(&safe_relpath);
+
+            if let Err(e) = validate_dest_inside_root(output_path, &file_path) {
+                warning!("skipping 7z entry {}: {}", PathFmt(&file_path), e);
+                return Ok(true);
+            }
 
             if entry.is_directory() {
                 info!("File {} extracted to {}", entry.name(), PathFmt(&file_path));
@@ -47,7 +60,7 @@ where
 
                 let file = fs::File::create(path)?;
                 let mut writer = BufWriter::new(file);
-                io::copy(reader, &mut writer)?;
+                copy_limited_decompression(reader, &mut writer)?;
 
                 use filetime_creation as ft;
                 // Surface mtime-set failures as warnings so users know timestamps weren't preserved
@@ -136,6 +149,7 @@ where
 
     for filename in files {
         let previous_location = cd_into_same_dir_as(filename)?;
+        let _cwd_guard = crate::utils::CwdGuard::new(previous_location);
 
         // Unwrap safety:
         //   paths should be canonicalized by now, and the root directory rejected.
@@ -172,8 +186,6 @@ where
 
             writer.push_archive_entry::<fs::File>(entry, entry_data)?;
         }
-
-        env::set_current_dir(previous_location)?;
     }
 
     let bytes = writer.finish()?;
```

**File**: `src/archive/tar.rs` (modified, +22/-13)
```diff
@@ -4,7 +4,6 @@
 use std::os::unix::fs::MetadataExt;
 use std::{
     collections::HashMap,
-    env,
     io::{self, prelude::*},
     ops::Not,
     path::{Path, PathBuf},
@@ -20,7 +19,8 @@ use crate::{
     list::{FileInArchive, ListFileType},
     utils::{
         self, BytesFmt, FileType, FileVisibilityPolicy, PathFmt, canonicalize, create_symlink, is_same_file_as_output,
-        read_file_type, set_permission_mode,
+        read_file_type, sanitize_archive_mode, set_permission_mode, validate_dest_inside_root, validate_entry_path,
+        validate_symlink_target,
     },
     warning,
 };
@@ -38,23 +38,31 @@ pub fn unpack_archive(reader: impl Read, output_folder: &Path) -> Result<u64> {
 
         match entry.header().entry_type() {
             tar::EntryType::Symlink => {
-                let relative_path = entry.path()?;
-                let full_path = output_folder.join(&relative_path);
+                let raw_path = entry.path()?.into_owned();
+                let safe_relpath = validate_entry_path(&raw_path)?;
+                let full_path = output_folder.join(&safe_relpath);
                 let target = entry
                     .link_name()?
                     .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Missing symlink target"))?;
 
+                validate_symlink_target(&safe_relpath, &target)?;
+                validate_dest_inside_root(output_folder, &full_path)?;
                 create_symlink(&target, &full_path)?;
             }
             tar::EntryType::Link => {
-                let link_path = entry.path()?;
-                let target = entry
+                let raw_link = entry.path()?.into_owned();
+                let safe_link_path = validate_entry_path(&raw_link)?;
+                let raw_target = entry
                     .link_name()?
-                    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Missing hardlink target"))?;
+                    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Missing hardlink target"))?
+                    .into_owned();
+                let safe_target = validate_entry_path(&raw_target)?;
 
-                let full_link_path = output_folder.join(&link_path);
-                let full_target_path = output_folder.join(&target);
+                let full_link_path = output_folder.join(&safe_link_path);
+                let full_target_path = output_folder.join(&safe_target);
 
+                validate_dest_inside_root(output_folder, &full_link_path)?;
+                validate_dest_inside_root(output_folder, &full_target_path)?;
                 fs::hard_link(&full_target_path, &full_link_path)?;
             }
             tar::EntryType::Regular | tar::EntryType::GNUSparse => {
@@ -71,10 +79,11 @@ pub fn unpack_archive(reader: impl Read, output_folder: &Path) -> Result<u64> {
                     // We unpacked a read-only directory, make it writeable so that we can
                     // create the files inside of it, by the end, restore the original mode
                     let original_path = entry.path()?.to_path_buf();
-                    let unpacked = output_folder.join(&original_path);
-                    set_permission_mode(&unpacked, original_mode | 0o200)?;
+                    let safe_relpath = validate_entry_path(&original_path)?;
+                    let unpacked = output_folder.join(&safe_relpath);
+                    set_permission_mode(&unpacked, sanitize_archive_mode(original_mode) | 0o200)?;
 
-                    read_only_dirs_and_modes.push((original_path, original_mode));
+                    read_only_dirs_and_modes.push((original_path, sanitize_archive_mode(original_mode)));
                 }
             }
             _ => continue,
@@ -146,6 +155,7 @@ where
 
     for explicit_path in explicit_paths {
         let previous_location = utils::cd_into_same_dir_as(explicit_path)?;
+        let _cwd_guard = utils::CwdGuard::new(previous_location);
 
         // Unwrap expectation:
         //   paths should be canonicalized by now, and the root directory rejected.
@@ -231,7 +241,6 @@ where
                 }
             }
         }
-        env::set_current_dir(previous_location)?;
     }
 
     Ok(builder.into_inner()?)
```

**File**: `src/archive/zip.rs` (modified, +33/-11)
```diff
@@ -3,7 +3,6 @@
 #[cfg(unix)]
 use std::os::unix::fs::PermissionsExt;
 use std::{
-    env,
     io::{self, prelude::*},
     path::{Path, PathBuf},
 };
@@ -15,15 +14,18 @@ use same_file::Handle;
 use time::{OffsetDateTime, PrimitiveDateTime};
 use zip::{self, DateTime, ZipArchive, read::ZipFile};
 
+#[cfg(unix)]
+use crate::utils::sanitize_archive_mode;
 use crate::{
     Result,
     error::FinalError,
     info, info_accessible,
     list::{FileInArchive, ListFileType},
     utils::{
-        BytesFmt, FileType, FileVisibilityPolicy, PathFmt, canonicalize, cd_into_same_dir_as, create_symlink,
-        ensure_parent_dir_exists, get_invalid_utf8_paths, is_same_file_as_output, pretty_format_list_of_paths,
-        read_file_type, strip_cur_dir,
+        BytesFmt, FileType, FileVisibilityPolicy, PathFmt, canonicalize, cd_into_same_dir_as,
+        copy_limited_decompression, create_symlink, ensure_parent_dir_exists, get_invalid_utf8_paths,
+        is_same_file_as_output, pretty_format_list_of_paths, read_file_type, strip_cur_dir, validate_dest_inside_root,
+        validate_symlink_target,
     },
     warning,
 };
@@ -42,12 +44,17 @@ where
             Some(password) => archive.by_index_decrypt(idx, password)?,
             None => archive.by_index(idx)?,
         };
-        let file_path = match file.enclosed_name() {
+        let relpath = match file.enclosed_name() {
             Some(path) => path.to_owned(),
-            None => continue,
+            None => {
+                warning!("skipping entry {} with unsafe name: {}", idx, file.name());
+                continue;
+            }
         };
 
-        let file_path = output_folder.join(file_path);
+        let file_path = output_folder.join(&relpath);
+
+        validate_dest_inside_root(output_folder, &file_path)?;
 
         display_zip_comment_if_exists(&file);
 
@@ -62,6 +69,7 @@ where
                     let mut target = String::new();
                     file.read_to_string(&mut target)?;
 
+                    validate_symlink_target(&relpath, Path::new(&target))?;
                     #[cfg(unix)]
                     std::os::unix::fs::symlink(&target, &file_path)?;
                     #[cfg(windows)]
@@ -81,12 +89,27 @@ where
                     let mut target = String::new();
                     file.read_to_string(&mut target)?;
 
+                    validate_symlink_target(&relpath, Path::new(&target))?;
                     info!("linking {} -> \"{}\"", PathFmt(file_path), target);
 
                     create_symlink(Path::new(&target), file_path)?;
                 } else {
+                    #[cfg(unix)]
+                    let mut output_file = {
+                        use fs_err::os::unix::fs::OpenOptionsExt;
+                        let mode = file.unix_mode().map(sanitize_archive_mode).unwrap_or(0o644);
+                        fs::OpenOptions::new()
+                            .write(true)
+                            .create(true)
+                            .truncate(true)
+                            .mode(mode)
+                            .open(file_path)?
+                    };
+                    #[cfg(not(unix))]
                     let mut output_file = fs::File::create(file_path)?;
-                    io::copy(&mut file, &mut output_file)?;
+                    {
+                        copy_limited_decompression(&mut file, &mut output_file)?;
+                    }
                     set_last_modified_time(&file, file_path)?;
                     #[cfg(unix)]
                     unix_set_permissions(file_path, &file)?;
@@ -182,6 +205,7 @@ where
 
     for explicit_path in input_filenames {
         let previous_location = cd_into_same_dir_as(explicit_path)?;
+        let _cwd_guard = crate::utils::CwdGuard::new(previous_location);
 
         // Unwrap safety:
         //   paths should be canonicalized by now, and the root directory rejected.
@@ -255,8 +279,6 @@ where
                 }
             }
         }
-
-        env::set_current_dir(previous_location)?;
     }
 
     let bytes = writer.finish()?;
@@ -315,7 +337,7 @@ fn unix_set_permissions<R: Read>(file_path: &Path, file: &ZipFile<'_, R>) -> Res
     use std::fs::Permissions;
 
     if let Some(mode) = file.unix_mode() {
-        fs::set_permissions(file_path, Permissions::from_mode(mode))?;
+        fs::set_permissions(file_path, Permissions::from_mode(sanitize_archive_mode(mode)))?;
     }
 
     Ok(())
```

**File**: `src/cli/args.rs` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ pub struct CliArgs {
     pub format: Option<String>,
 
     /// Decompress or list with password
-    #[arg(short, long = "password", aliases = ["pass", "pw"], global = true)]
+    #[arg(short, long = "password", aliases = ["pass", "pw"], env = "OUCH_PASSWORD", global = true)]
     pub password: Option<OsString>,
 
     /// Concurrent working threads
```

**File**: `src/commands/decompress.rs` (modified, +16/-6)
```diff
@@ -16,7 +16,7 @@ use crate::{
     info, info_accessible,
     non_archive::lz4::MultiFrameLz4Decoder,
     utils::{
-        self, BytesFmt, PathFmt, file_size,
+        self, BytesFmt, LZMA_MEMLIMIT_BYTES, LimitedReader, PathFmt, copy_limited_decompression, file_size,
         io::{ReadSeek, lock_and_flush_output_stdio},
         is_path_stdin, resolve_path_conflict, user_wants_to_continue,
     },
@@ -65,7 +65,11 @@ pub fn decompress_file(options: DecompressOptions) -> Result<()> {
                 Box::new(bzip3::read::Bz3Decoder::new(decoder)?)
             }
             Lz4 => Box::new(MultiFrameLz4Decoder::new(decoder)),
-            Lzma => Box::new(lzma_rust2::LzmaReader::new_mem_limit(decoder, u32::MAX, None)?),
+            Lzma => Box::new(lzma_rust2::LzmaReader::new_mem_limit(
+                decoder,
+                LZMA_MEMLIMIT_BYTES,
+                None,
+            )?),
             Xz => Box::new(lzma_rust2::XzReader::new(decoder, true)),
             Lzip => Box::new(lzma_rust2::LzipReader::new(decoder)),
             Snappy => Box::new(snap::read::FrameDecoder::new(decoder)),
@@ -108,7 +112,9 @@ pub fn decompress_file(options: DecompressOptions) -> Result<()> {
     let control_flow = match first_extension {
         Gzip | Bzip | Bzip3 | Lz4 | Lzma | Xz | Lzip | Snappy | Zstd | Brotli => {
             let reader = create_decoder_up_to_first_extension()?;
-            let mut reader = chain_reader_decoder(&first_extension, reader)?;
+            let reader = chain_reader_decoder(&first_extension, reader)?;
+            // Bomb cap: abort if decompressed output exceeds OUCH_MAX_DECOMPRESSED_BYTES
+            let mut reader = LimitedReader::new(reader);
 
             let (mut writer, final_output_path) = match utils::create_file_or_prompt_on_conflict(
                 &options.output_file_path,
@@ -125,7 +131,10 @@ pub fn decompress_file(options: DecompressOptions) -> Result<()> {
             })
         }
         Tar => unpack_archive(
-            |output_dir| crate::archive::tar::unpack_archive(create_decoder_up_to_first_extension()?, output_dir),
+            |output_dir| {
+                let reader = LimitedReader::new(create_decoder_up_to_first_extension()?);
+                crate::archive::tar::unpack_archive(reader, output_dir)
+            },
             archive_output_dir,
             options.question_policy,
         )?,
@@ -160,7 +169,8 @@ pub fn decompress_file(options: DecompressOptions) -> Result<()> {
                 drop(locks);
 
                 let mut vec = vec![];
-                io::copy(&mut create_decoder_up_to_first_extension()?, &mut vec)?;
+                // Bomb cap: abort if the in-memory decompressed image exceeds the limit
+                copy_limited_decompression(create_decoder_up_to_first_extension()?, &mut vec)?;
                 Box::new(io::Cursor::new(vec))
             } else {
                 Box::new(BufReader::with_capacity(
@@ -179,7 +189,7 @@ pub fn decompress_file(options: DecompressOptions) -> Result<()> {
         Rar => {
             let unpack_fn: Box<dyn FnOnce(&Path) -> Result<u64>> = if options.formats.len() > 1 || input_is_stdin {
                 let mut temp_file = tempfile::NamedTempFile::new()?;
-                io::copy(&mut create_decoder_up_to_first_extension()?, &mut temp_file)?;
+                copy_limited_decompression(create_decoder_up_to_first_extension()?, &mut temp_file)?;
                 Box::new(move |output_dir| {
                     crate::archive::rar::unpack_archive(temp_file.path(), output_dir, options.password)
                 })
```

**File**: `src/commands/list.rs` (modified, +19/-6)
```diff
@@ -11,7 +11,10 @@ use crate::{
     extension::CompressionFormat::{self, *},
     list::{self, FileInArchive, ListOptions},
     non_archive::lz4::MultiFrameLz4Decoder,
-    utils::{io::lock_and_flush_output_stdio, user_wants_to_continue},
+    utils::{
+        LZMA_MEMLIMIT_BYTES, LimitedReader, copy_limited_decompression, io::lock_and_flush_output_stdio,
+        user_wants_to_continue,
+    },
 };
 
 /// File at archive_path is opened for reading, example: "archive.tar.gz"
@@ -57,7 +60,11 @@ pub fn list_archive_contents(
                     Box::new(bzip3::read::Bz3Decoder::new(decoder)?)
                 }
                 Lz4 => Box::new(MultiFrameLz4Decoder::new(decoder)),
-                Lzma => Box::new(lzma_rust2::LzmaReader::new_mem_limit(decoder, u32::MAX, None)?),
+                Lzma => Box::new(lzma_rust2::LzmaReader::new_mem_limit(
+                    decoder,
+                    LZMA_MEMLIMIT_BYTES,
+                    None,
+                )?),
                 Xz => Box::new(lzma_rust2::XzReader::new(decoder, true)),
                 Lzip => Box::new(lzma_rust2::LzipReader::new(decoder)),
                 Snappy => Box::new(snap::read::FrameDecoder::new(decoder)),
@@ -79,7 +86,10 @@ pub fn list_archive_contents(
 
     let archive_format = misplaced_archive_format.unwrap_or(formats[0]);
     let files: Box<dyn Iterator<Item = Result<FileInArchive>>> = match archive_format {
-        Tar => Box::new(crate::archive::tar::list_archive(tar::Archive::new(reader))?),
+        Tar => {
+            let limited = LimitedReader::new(reader);
+            Box::new(crate::archive::tar::list_archive(tar::Archive::new(limited))?)
+        }
         Zip => {
             if formats.len() > 1 {
                 // Make thread own locks to keep output messages adjacent
@@ -92,7 +102,8 @@ pub fn list_archive_contents(
             }
 
             let mut vec = vec![];
-            io::copy(&mut reader, &mut vec)?;
+            // Bomb cap: abort if the in-memory decompressed image exceeds the limit
+            copy_limited_decompression(&mut reader, &mut vec)?;
             let zip_archive = zip::ZipArchive::new(io::Cursor::new(vec))?;
 
             Box::new(crate::archive::zip::list_archive(zip_archive, password))
@@ -101,7 +112,8 @@ pub fn list_archive_contents(
         Rar => {
             if formats.len() > 1 {
                 let mut temp_file = tempfile::NamedTempFile::new()?;
-                io::copy(&mut reader, &mut temp_file)?;
+                // Bomb cap: abort if decompressed output to tempfile exceeds the limit
+                copy_limited_decompression(&mut reader, &mut temp_file)?;
                 Box::new(crate::archive::rar::list_archive(temp_file.path(), password)?)
             } else {
                 Box::new(crate::archive::rar::list_archive(archive_path, password)?)
@@ -122,7 +134,8 @@ pub fn list_archive_contents(
                 drop(locks);
 
                 let mut vec = vec![];
-                io::copy(&mut reader, &mut vec)?;
+                // Bomb cap: abort if the in-memory decompressed image exceeds the limit
+                copy_limited_decompression(&mut reader, &mut vec)?;
 
                 Box::new(archive::sevenz::list_archive(io::Cursor::new(vec), password)?)
             } else {
```

---

### Incident Patch 15: `374a7d6f` (2026-06-21)
**Commit Message**: fix exit code when `stdin` is `/dev/null` (#1011)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -23,6 +23,8 @@ Categories Used:
 
 ### Bug Fixes
 
+- Decompress: exit with a non-zero code when a file conflict can't be resolved on non-interactive stdin, instead of silently skipping and reporting success (https://github.com/ouch-org/ouch/pull/1011)
+
 ### Tweaks
 
 
```

**File**: `src/utils/question.rs` (modified, +6/-3)
```diff
@@ -205,9 +205,12 @@ impl<'a, T: Default> ChoicePrompt<'a, T> {
         let message = self.prompt;
 
         if is_stdin_dev_null()? {
-            eprintln!("{message}");
-            eprintln!("Stdin is null, can't read user input (bypass with --yes, but be careful)");
-            return Ok(T::default());
+            // stdin is /dev/null so the conflict prompt cannot be answered; fail instead of silently skipping
+            let error = FinalError::with_title("Cannot read input to resolve file conflict")
+                .detail(format!("Tried to ask: \"{message}\""))
+                .detail("Stdin is connected to /dev/null, so the prompt cannot be answered.")
+                .hint("If using Ouch in scripting, consider using `--yes` and `--no`.");
+            return Err(error.into());
         }
 
         let _locks = lock_and_flush_output_stdio()?;
```

**File**: `tests/integration.rs` (modified, +34/-0)
```diff
@@ -1569,3 +1569,37 @@ fn decompress_concatenated_lz4_frames() {
         encoder.finish().unwrap()
     });
 }
+
+/// A conflict that cannot be resolved because stdin is /dev/null must fail, not exit 0.
+#[test]
+fn decompress_conflict_with_dev_null_stdin_exits_nonzero() {
+    use std::process::Stdio;
+
+    let (_tempdir, dir) = testdir().unwrap();
+    fs::create_dir(dir.join("d")).unwrap();
+    fs::write(dir.join("d").join("f.txt"), b"hi").unwrap();
+
+    crate::utils::cargo_bin()
+        .current_dir(dir)
+        .args(["compress", "d", "a.zip", "--yes"])
+        .assert()
+        .success();
+    // first extraction creates ./a, so the next run hits a conflict
+    crate::utils::cargo_bin()
+        .current_dir(dir)
+        .args(["decompress", "a.zip", "--yes"])
+        .assert()
+        .success();
+
+    // stdin is /dev/null so the conflict cannot be answered; the run must fail instead of exiting 0
+    let status = crate::utils::cargo_bin_command()
+        .current_dir(dir)
+        .args(["decompress", "a.zip"])
+        .stdin(Stdio::null())
+        .status()
+        .unwrap();
+    assert!(
+        !status.success(),
+        "decompress with an unresolvable conflict on /dev/null stdin must exit non-zero"
+    );
+}
```

**File**: `tests/utils.rs` (modified, +13/-8)
```diff
@@ -23,16 +23,21 @@ macro_rules! ouch {
 }
 
 pub fn cargo_bin() -> Command {
+    Command::from_std(cargo_bin_command())
+}
+
+/// Like [`cargo_bin`] but returns a `std::process::Command`, so callers can set stdin/stdout.
+pub fn cargo_bin_command() -> std::process::Command {
+    let bin = assert_cmd::cargo::cargo_bin("ouch");
     env::vars()
-        .find_map(|(k, v)| {
-            (k.starts_with("CARGO_TARGET_") && k.ends_with("_RUNNER")).then(|| {
-                let mut runner = v.split_whitespace();
-                let mut cmd = Command::new(runner.next().unwrap());
-                cmd.args(runner).arg(assert_cmd::cargo::cargo_bin("ouch"));
-                cmd
-            })
+        .find(|(k, _)| k.starts_with("CARGO_TARGET_") && k.ends_with("_RUNNER"))
+        .map(|(_, runner)| {
+            let mut parts = runner.split_whitespace();
+            let mut cmd = std::process::Command::new(parts.next().unwrap());
+            cmd.args(parts).arg(&bin);
+            cmd
         })
-        .unwrap_or_else(|| Command::cargo_bin("ouch").expect("Failed to find ouch executable"))
+        .unwrap_or_else(|| std::process::Command::new(&bin))
 }
 
 pub fn testdir() -> io::Result<(tempfile::TempDir, &'static Path)> {
```

#### Recent Merged Pull Requests:
- **PR #1080** (2026-09-24): fix: crash on --format (@valoq)
- **PR #1079** (2026-09-17): deps: bump zstd from 0.13.3 to 0.14.0 (@dependabot[bot])
- **PR #1077** (closed): deps: bump indexmap from 2.14.1 to 2.14.2 in the cargo-patch-and-minor group (@dependabot[bot])
- **PR #1075** (2026-09-13): change release pipeline to prevent stale artifacts (@marcospb19)
- **PR #1074** (2026-09-12): remove pull request template (@marcospb19)
- **PR #1071** (closed): Bump package version to 0.8.2 (@chenrui333)
- **PR #1069** (2026-09-11): deps: bump the cargo-patch-and-minor group with 4 updates (@dependabot[bot])
- **PR #1067** (2026-09-04): docs: fix writting typo in stdin decompression example (@foorgange)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
