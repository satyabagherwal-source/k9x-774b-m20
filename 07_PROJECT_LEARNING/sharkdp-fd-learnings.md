# Forensic Learning Record (Deep Inspection): sharkdp/fd

> **Canonical Artifact**: `07_PROJECT_LEARNING/sharkdp-fd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sharkdp/fd](https://github.com/sharkdp/fd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:31:59.434Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sharkdp/fd`
- **Description**: A simple, fast and user-friendly alternative to 'find'
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 44646 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/cli.rs`
```
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::anyhow;
use clap::{
    Arg, ArgAction, ArgGroup, ArgMatches, Command, Parser, ValueEnum, error::ErrorKind,
    value_parser,
};
#[cfg(feature = "completions")]
use clap_complete::Shell;
use normpath::PathExt;

use crate::exec::CommandSet;
use crate::filesystem;
#[cfg(unix)]
use crate::filter::OwnerFilter;
use crate::filter::SizeFilter;

#[derive(Parser)]
#[command(
    name = "fd",
    version,
    about = "A program to find entries in your filesystem with regex and glob based matching. By default, fd respects gitignore rules, ignores hidden directories, and is case insensitive.",
    after_long_help = "Bugs can be reported on GitHub: https://github.com/sharkdp/fd/issues",
    max_term_width = 98,
    args_override_self = true,
    group(ArgGroup::new("execs").args(&["exec", "exec_batch", "list_details"]).conflicts_with_all(&[
            "max_results", "quiet", "max_one_result"])),
)]
pub struct Opts {
    /// Include hidden directories and files in the search results (default:
    /// hidden files and directories are skipped). Files and directories are
    /// considered to be hidden if their name starts with a `.` sign (dot).
    /// Any files or directories that are ignored due to the rules described by
    /// --no-ignore are still ignored unless otherwise specified.
    /// The flag can be overridden with --no-hidden.
    #[arg(
        long,
        short = 'H',
        help = "Search hidden files and directories",
        long_help
    )]
    pub hidden: bool,

    /// Overrides --hidden
    #[arg(long, overrides_with = "hidden", hide = true, action = ArgAction::SetTrue)]
    no_hidden: (),

    /// Show search results from files and directories that would otherwise be
    /// ignored by '.gitignore', '.ignore', '.fdignore', or the global ignore file,
    /// The flag can be overridden with --ignore.
    #[arg(
        long,
        short = 'I',
        help = "Do not respect .(git|fd)ignore files",
        long_help
    )]
    pub no_ignore: bool,

    /// Overrides --no-ignore
    #[arg(long, overrides_with = "no_ignore", hide = true, action = ArgAction::SetTrue)]
    ignore: (),

    ///Show search results from files and directories that
    ///would otherwise be ignored by '.gitignore' files.
    ///The flag can be overridden with --ignore-vcs.
    #[arg(
        long,
        hide_short_help = true,
        help = "Do not respect .gitignore files",
        long_help
    )]
    pub no_ignore_vcs: bool,

    /// Overrides --no-ignore-vcs
    #[arg(long, overrides_with = "no_ignore_vcs", hide = true, action = ArgAction::SetTrue)]
    ignore_vcs: (),

    /// Do not require a git repository to respect gitignores.
    /// By default, fd will only respect global gitignore rules, .gitignore rules,
    /// and local exclude rules if fd detects that you are searching inside a
    /// git repository. This flag allows you to relax this restriction such that
    /// fd will respect all git related ignore rules regardless of whether you're
    /// searching in a git repository or not.
    ///
    ///
    /// This flag can be disabled with --require-git.
    #[arg(
        long,
        overrides_with = "require_git",
        hide_short_help = true,
        // same description as ripgrep's flag: ripgrep/crates/core/app.rs
        long_help
    )]
    pub no_require_git: bool,

    /// Overrides --no-require-git
    #[arg(long, overrides_with = "no_require_git", hide = true, action = ArgAction::SetTrue)]
    require_git: (),

    /// Show search results from files and directories that would otherwise be
    /// ignored by '.gitignore', '.ignore', or '.fdignore' files in parent directories.
    /// The flag can be overridden with --ignore-parent.
    #[arg(
        long,
        hide_short_help = true,
        help = "Do not respect .(git|fd)ignore files in parent directories",
        long_help
    )]
    pub no_ignore_parent: bool,

    /// Overrides --no-ignore-parent
    #[arg(long, overrides_with = "no_ignore_parent", hide = true, action = ArgAction::SetTrue)]
    ignore_parent: (),

    /// Do not respect the global ignore file
    #[arg(long, hide = true)]
    pub no_global_ignore_file: bool,

    /// Perform an unrestricted search, including ignored and hidden files. This is
    /// an alias for '--no-ignore --hidden'.
    #[arg(long = "unrestricted", short = 'u', overrides_with_all(&["ignore", "no_hidden"]), action(ArgAction::Count), hide_short_help = true,
    help = "Unrestricted search, alias for '--no-ignore --hidden'",
        long_help,
        )]
    rg_alias_hidden_ignore: u8,

    /// Case-sensitive search (default: smart case)
    #[arg(
        long,
        short = 's',
        overrides_with("ignore_case"),
        long_help = "Perform a case-sensitive search. By default, fd uses case-insensitive \
                     searches, unless the pattern contains an uppercase character (smart \
                     case)."
    )]
    pub case_sensitive: bool,

    /// Perform a case-insensitive search. By default, fd uses case-insensitive
    /// searches, unless the pattern contains an uppercase character (smart
    /// case).
    #[arg(
        long,
        short = 'i',
        overrides_with("case_sensitive"),
        help = "Case-insensitive search (default: smart case)",
        long_help
    )]
    pub ignore_case: bool,

    /// Perform a glob-based search instead of a regular expression search.
    #[arg(
        long,
        short = 'g',
        conflicts_with("fixed_strings"),
        help = "Glob-based search (default: regular expression)",
        long_help
    )]
    pub glob: bool,

    /// Perform a regular-expression based search (default). This can be used to
    /// override --glob.
    #[arg(
        long,
        overrides_with("glob"),
        hide_short_help = true,
        help = "Regular-expression based search (default)",
        long_help
    )]
    pub regex: bool,

    /// Treat the pattern as a literal string instead of a regular expression. Note
    /// that this also performs substring comparison. If you want to match on an
    /// exact filename, consider using '--glob' or '--exact' instead.
    #[arg(
        long,
        short = 'F',
        alias = "literal",
        hide_short_help = true,
        help = "Treat pattern as literal string instead of regex",
        long_help
    )]
    pub fixed_strings: bool,

    /// Perform an exact match. This is equivalent to '--fixed-strings' but requires
    /// the pattern to match the entire filename (or path if '--full-path' is used),
    /// rather than a substring. Special regex characters in the pattern are treated
    /// as literal characters.
    #[arg(
        long,
        conflicts_with_all(["glob", "fixed_strings"]),
        hide_short_help = true,
        help = "Match the entire filename exactly (literal, non-substring)",
        long_help
    )]
    pub exact: bool,

    /// Add additional required search patterns, all of which must be matched. Multiple
    /// additional patterns can be specified. The patterns are regular
    /// expressions, unless '--glob' or '--fixed-strings' is used.
    #[arg(
        long = "and",
        value_name = "pattern",
        help = "Additional search patterns that need to be matched",
        long_help,
        hide_short_help = true,
        allow_hyphen_values = true
    )]
    pub exprs: Option<Vec<String>>,

    /// Shows the full path starting from the root as opposed to relative paths.
    /// The flag can be overridden with --relative-path.
    #[arg(
        long,
        short = 'a',
        help = "Show absolute instead of relative paths",
        long_help
    )]
    pub absolute_path: bool,

    /// Overrides --absolute-path
    #[arg(long, overrides_with = "absolute_path", hide = true, action = ArgAction::SetTrue)]
    relative_path: (),

    /// Use a detailed listing format like 'ls -l'. This is basically an alias
    /// for '--exec-batch ls -l' with some additional 'ls' options. This can be
    /// used to see more metadata, to show symlink targets and to achieve a
    /// deterministic sort order.
    #[arg(
        long,
        short = 'l',
        conflicts_with("absolute_path"),
        help = "Use a long listing format with file metadata",
        long_help
    )]
    pub list_details: bool,

    /// Follow symbolic links
    #[arg(
        long,
        short = 'L',
        alias = "dereference",
        long_help = "By default, fd does not descend into symlinked directories. Using this \
                     flag, symbolic links are also traversed. \
                     Flag can be overridden with --no-follow."
    )]
    pub follow: bool,

    /// Overrides --follow
    #[arg(long, overrides_with = "follow", hide = true, action = ArgAction::SetTrue)]
    no_follow: (),

    /// By default, the search pattern is only matched against the filename (or directory name). Using this flag, the pattern is matched against the full (absolute) path. Example:
    ///   fd --glob -p '**/.git/config'
    #[arg(
        long,
        short = 'p',
        help = "Search full abs. path (default: filename only)",
        long_help,
        verbatim_doc_comment
    )]
    pub full_path: bool,

    /// Separate search results by the null character (instead of newlines).
    /// Useful for piping results to 'xargs'.
    #[arg(
        long = "print0",
        short = '0',
        conflicts_with("list_details"),
        hide_short_help = true,
        help = "Separate search results by the null character",
        long_help
    )]
    pub null_separator: bool,

    /// Limit the directory traversal to a given depth. By default, there is no
    /// limit on the search depth.
    #[arg(
        long,
        short = 'd',
        value_name = "depth",
        alias("maxdepth"),
        help = "Set maximum search depth (default: none)",
        long_help
    )]
    max_dep
```

### Core Architecture Module: `src/config.rs`
```
use std::{path::PathBuf, sync::Arc, time::Duration};

use lscolors::LsColors;
use regex::bytes::RegexSet;

use crate::exec::CommandSet;
use crate::filetypes::FileTypes;
#[cfg(unix)]
use crate::filter::OwnerFilter;
use crate::filter::{SizeFilter, TimeFilter};
use crate::fmt::FormatTemplate;

/// Configuration options for *fd*.
pub struct Config {
    /// Whether the search is case-sensitive or case-insensitive.
    pub case_sensitive: bool,

    /// Cached current working directory for absolute path construction.
    /// Populated when `--full-path` is set; `None` means search by filename only.
    pub full_path_base: Option<PathBuf>,

    /// Whether to ignore hidden files and directories (or not).
    pub ignore_hidden: bool,

    /// Whether to respect `.fdignore` files or not.
    pub read_fdignore: bool,

    /// Whether to respect ignore files in parent directories or not.
    pub read_parent_ignore: bool,

    /// Whether to respect VCS ignore files (`.gitignore`, ..) or not.
    pub read_vcsignore: bool,

    /// Whether to require a `.git` directory to respect gitignore files.
    pub require_git_to_read_vcsignore: bool,

    /// Whether to respect the global ignore file or not.
    pub read_global_ignore: bool,

    /// Whether to follow symlinks or not.
    pub follow_links: bool,

    /// Whether to limit the search to starting file system or not.
    pub one_file_system: bool,

    /// Whether elements of output should be separated by a null character
    pub null_separator: bool,

    /// The maximum search depth, or `None` if no maximum search depth should be set.
    ///
    /// A depth of `1` includes all files under the current directory, a depth of `2` also includes
    /// all files under subdirectories of the current directory, etc.
    pub max_depth: Option<usize>,

    /// The minimum depth for reported entries, or `None`.
    pub min_depth: Option<usize>,

    /// Whether to stop traversing into matching directories.
    pub prune: bool,

    /// The number of threads to use.
    pub threads: usize,

    /// If true, the program doesn't print anything and will instead return an exit code of 0
    /// if there's at least one match. Otherwise, the exit code will be 1.
    pub quiet: bool,

    /// Time to buffer results internally before streaming to the console. This is useful to
    /// provide a sorted output, in case the total execution time is shorter than
    /// `max_buffer_time`.
    pub max_buffer_time: Option<Duration>,

    /// `None` if the output should not be colorized. Otherwise, a `LsColors` instance that defines
    /// how to style different filetypes.
    pub ls_colors: Option<LsColors>,

    /// Whether or not we are writing to an interactive terminal
    #[cfg_attr(not(unix), allow(unused))]
    pub interactive_terminal: bool,

    /// The type of file to search for. If set to `None`, all file types are displayed. If
    /// set to `Some(..)`, only the types that are specified are shown.
    pub file_types: Option<FileTypes>,

    /// The extension to search for. Only entries matching the extension will be included.
    ///
    /// The value (if present) will be a lowercase string without leading dots.
    pub extensions: Option<RegexSet>,

    /// A format string to use to format results, similarly to exec
    pub format: Option<FormatTemplate>,

    /// If a value is supplied, each item found will be used to generate and execute commands.
    pub command: Option<Arc<CommandSet>>,

    /// Maximum number of search results to pass to each `command`. If zero, the number is
    /// unlimited.
    pub batch_size: usize,

    /// A list of glob patterns that should be excluded from the search.
    pub exclude_patterns: Vec<String>,

    /// A list of custom ignore files.
    pub ignore_files: Vec<PathBuf>,

    /// The given constraints on the size of returned files
    pub size_constraints: Vec<SizeFilter>,

    /// Constraints on last modification time of files
    pub time_constraints: Vec<TimeFilter>,

    #[cfg(unix)]
    /// User/group ownership constraint
    pub owner_constraint: Option<OwnerFilter>,

    /// Whether or not to display filesystem errors
    pub show_filesystem_errors: bool,

    /// The separator used to print file paths.
    pub path_separator: Option<String>,

    /// The actual separator, either the system default separator or `path_separator`
    pub actual_path_separator: String,

    /// The maximum number of search results
    pub max_results: Option<usize>,

    /// Whether or not to strip the './' prefix for search results
    pub strip_cwd_prefix: bool,

    /// Whether or not to use hyperlinks on paths
    pub hyperlink: bool,

    /// Names that should stop traversal down their parent. (e.g. https://bford.info/cachedir/).
    pub ignore_contain: Vec<String>,
}

impl Config {
    /// Check whether results are being printed.
    pub fn is_printing(&self) -> bool {
        self.command.is_none()
    }
}

```

### Core Architecture Module: `src/dir_entry.rs`
```
use std::cell::OnceCell;
use std::ffi::OsString;
use std::fs::{FileType, Metadata};
use std::path::{Path, PathBuf};

use lscolors::{Colorable, LsColors, Style};

use crate::config::Config;
use crate::filesystem::strip_current_dir;

#[derive(Debug)]
enum DirEntryInner {
    Normal(ignore::DirEntry),
    // Broken symlinks reach us as walk errors rather than entries, so we carry
    // over the depth the walker recorded on the error.
    BrokenSymlink { path: PathBuf, depth: Option<usize> },
}

#[derive(Debug)]
pub struct DirEntry {
    inner: DirEntryInner,
    metadata: OnceCell<Option<Metadata>>,
    style: OnceCell<Option<Style>>,
}

impl DirEntry {
    #[inline]
    pub fn normal(e: ignore::DirEntry) -> Self {
        Self {
            inner: DirEntryInner::Normal(e),
            metadata: OnceCell::new(),
            style: OnceCell::new(),
        }
    }

    pub fn broken_symlink(path: PathBuf, depth: Option<usize>) -> Self {
        Self {
            inner: DirEntryInner::BrokenSymlink { path, depth },
            metadata: OnceCell::new(),
            style: OnceCell::new(),
        }
    }

    pub fn path(&self) -> &Path {
        match &self.inner {
            DirEntryInner::Normal(e) => e.path(),
            DirEntryInner::BrokenSymlink { path, .. } => path.as_path(),
        }
    }

    pub fn into_path(self) -> PathBuf {
        match self.inner {
            DirEntryInner::Normal(e) => e.into_path(),
            DirEntryInner::BrokenSymlink { path, .. } => path,
        }
    }

    /// Returns the path as it should be presented to the user.
    /// When stripping `./` would leave the path starting with `-`, keep the original
    /// (with `./`) so downstream tools don't interpret it as an option.
    pub fn stripped_path(&self, config: &Config) -> &Path {
        let path = self.path();
        if config.strip_cwd_prefix {
            let stripped = strip_current_dir(path);
            if starts_with_dash(stripped) {
                path
            } else {
                stripped
            }
        } else {
            path
        }
    }

    /// Returns the path as it should be presented to the user.
    pub fn into_stripped_path(self, config: &Config) -> PathBuf {
        if config.strip_cwd_prefix {
            self.stripped_path(config).to_path_buf()
        } else {
            self.into_path()
        }
    }

    pub fn file_type(&self) -> Option<FileType> {
        match &self.inner {
            DirEntryInner::Normal(e) => e.file_type(),
            DirEntryInner::BrokenSymlink { .. } => self.metadata().map(|m| m.file_type()),
        }
    }

    pub fn metadata(&self) -> Option<&Metadata> {
        self.metadata
            .get_or_init(|| match &self.inner {
                DirEntryInner::Normal(e) => e.metadata().ok(),
                DirEntryInner::BrokenSymlink { path, .. } => path.symlink_metadata().ok(),
            })
            .as_ref()
    }

    pub fn depth(&self) -> Option<usize> {
        match &self.inner {
            DirEntryInner::Normal(e) => Some(e.depth()),
            DirEntryInner::BrokenSymlink { depth, .. } => *depth,
        }
    }

    pub fn style(&self, ls_colors: &LsColors) -> Option<&Style> {
        self.style
            .get_or_init(|| ls_colors.style_for(self).cloned())
            .as_ref()
    }
}

fn starts_with_dash(path: &Path) -> bool {
    path.as_os_str().as_encoded_bytes().first() == Some(&b'-')
}

impl PartialEq for DirEntry {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        self.path() == other.path()
    }
}

impl Eq for DirEntry {}

impl PartialOrd for DirEntry {
    #[inline]
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for DirEntry {
    #[inline]
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.path().cmp(other.path())
    }
}

impl Colorable for DirEntry {
    fn path(&self) -> PathBuf {
        self.path().to_owned()
    }

    fn file_name(&self) -> OsString {
        let name = match &self.inner {
            DirEntryInner::Normal(e) => e.file_name(),
            DirEntryInner::BrokenSymlink { path, .. } => {
                // Path::file_name() only works if the last component is Normal,
                // but we want it for all component types, so we open code it.
                // Copied from LsColors::style_for_path_with_metadata().
                path.components()
                    .next_back()
                    .map(|c| c.as_os_str())
                    .unwrap_or_else(|| path.as_os_str())
            }
        };
        name.to_owned()
    }

    fn file_type(&self) -> Option<FileType> {
        self.file_type()
    }

    fn metadata(&self) -> Option<Metadata> {
        self.metadata().cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::starts_with_dash;
    use std::path::Path;

    #[test]
    fn dash_prefixed_paths_detected() {
        assert!(starts_with_dash(Path::new("-rf")));
        assert!(starts_with_dash(Path::new("--delete")));
        assert!(starts_with_dash(Path::new("-")));
    }

    #[test]
    fn safe_paths_not_flagged() {
        assert!(!starts_with_dash(Path::new("foo")));
        assert!(!starts_with_dash(Path::new("./foo")));
        assert!(!starts_with_dash(Path::new("sub/-rf")));
        assert!(!starts_with_dash(Path::new("")));
        assert!(!starts_with_dash(Path::new(" -rf")));
    }
}

```

### Core Architecture Module: `src/error.rs`
```
use std::fmt::Display;
use std::io;

use crate::sanitize::write_sanitized;

/// Print an error message using a format string, sanitizing any arguments if necessary
macro_rules! print_error {
    ($fmt:literal, $($arg:expr),*) => {
        eprintln!(concat!("[fd error]: ", $fmt), $($crate::error::SanitizeErr::sanitize($arg)),*)
    }
}

/// Trait for specifying how to sanitize a type for error display, if needed.
pub(crate) trait SanitizeErr {
    type Sanitized: Display;

    fn sanitize(self) -> Self::Sanitized;
}

impl SanitizeErr for &str {
    type Sanitized = Self;

    fn sanitize(self) -> Self {
        self
    }
}

impl SanitizeErr for io::Error {
    type Sanitized = SanitizedError<io::Error>;

    fn sanitize(self) -> Self::Sanitized {
        SanitizedError(self)
    }
}

impl SanitizeErr for ignore::Error {
    type Sanitized = SanitizedError<ignore::Error>;

    fn sanitize(self) -> Self::Sanitized {
        SanitizedError(self)
    }
}

pub struct SanitizedError<E>(E);

impl<E: std::error::Error> Display for SanitizedError<E> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let raw = self.0.to_string();
        write_sanitized(f, &raw)
    }
}

```

### Core Architecture Module: `src/exec/command.rs`
```
use std::io;
use std::io::Write;

use argmax::Command;

use crate::exit_codes::ExitCode;

struct Outputs {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}
pub struct OutputBuffer {
    null_separator: bool,
    outputs: Vec<Outputs>,
}

impl OutputBuffer {
    pub fn new(null_separator: bool) -> Self {
        Self {
            null_separator,
            outputs: Vec::new(),
        }
    }

    fn push(&mut self, stdout: Vec<u8>, stderr: Vec<u8>) {
        self.outputs.push(Outputs { stdout, stderr });
    }

    fn write(self) {
        // Avoid taking the lock if there is nothing to do.
        // If null_separator is true, then we still need to write the
        // null separator, because the output may have been written directly
        // to stdout
        if self.outputs.is_empty() && !self.null_separator {
            return;
        }

        let stdout = io::stdout();
        let stderr = io::stderr();

        // While we hold these locks, only this thread will be able
        // to write its outputs.
        let mut stdout = stdout.lock();
        let mut stderr = stderr.lock();

        for output in self.outputs.iter() {
            let _ = stdout.write_all(&output.stdout);
            let _ = stderr.write_all(&output.stderr);
        }
        if self.null_separator {
            // If null_separator is enabled, then we should write a \0 at the end
            // of the output for this entry
            let _ = stdout.write_all(b"\0");
        }
    }
}

/// Executes a command.
pub fn execute_commands<I: Iterator<Item = io::Result<Command>>>(
    cmds: I,
    mut output_buffer: OutputBuffer,
    enable_output_buffering: bool,
) -> ExitCode {
    for result in cmds {
        let mut cmd = match result {
            Ok(cmd) => cmd,
            Err(e) => return handle_cmd_error(None, e),
        };

        // Spawn the supplied command.
        let output = if enable_output_buffering {
            cmd.output()
        } else {
            // If running on only one thread, don't buffer output
            // Allows for viewing and interacting with intermediate command output
            cmd.spawn().and_then(|c| c.wait_with_output())
        };

        // Then wait for the command to exit, if it was spawned.
        match output {
            Ok(output) => {
                if enable_output_buffering {
                    output_buffer.push(output.stdout, output.stderr);
                }
                if output.status.code() != Some(0) {
                    output_buffer.write();
                    return ExitCode::GeneralError;
                }
            }
            Err(why) => {
                output_buffer.write();
                return handle_cmd_error(Some(&cmd), why);
            }
        }
    }
    output_buffer.write();
    ExitCode::Success
}

pub fn handle_cmd_error(cmd: Option<&Command>, err: io::Error) -> ExitCode {
    match (cmd, err) {
        (Some(cmd), err) if err.kind() == io::ErrorKind::NotFound => {
            print_error!(
                "Command not found: {:?}",
                cmd.get_program().to_string_lossy().as_ref()
            );
            ExitCode::GeneralError
        }
        (_, err) => {
            print_error!("Problem while executing command: {}", err);
            ExitCode::GeneralError
        }
    }
}

```

### Core Architecture Module: `src/exec/job.rs`
```
use crate::config::Config;
use crate::exit_codes::{ExitCode, merge_exitcodes};
use crate::walk::WorkerResult;

use super::CommandSet;

/// An event loop that listens for inputs from the `rx` receiver. Each received input will
/// generate a command with the supplied command template. The generated command will then
/// be executed, and this process will continue until the receiver's sender has closed.
pub fn job(
    results: impl IntoIterator<Item = WorkerResult>,
    cmd: &CommandSet,
    config: &Config,
) -> ExitCode {
    // Output should be buffered when only running a single thread
    let buffer_output: bool = config.threads > 1;

    let mut ret = ExitCode::Success;
    for result in results {
        // Obtain the next result from the receiver, else if the channel
        // has closed, exit from the loop
        let dir_entry = match result {
            WorkerResult::Entry(dir_entry) => dir_entry,
            WorkerResult::Error(err) => {
                if config.show_filesystem_errors {
                    print_error!("{}", err);
                }
                continue;
            }
        };

        // Generate a command, execute it and store its exit code.
        let code = cmd.execute(
            dir_entry.stripped_path(config),
            config.path_separator.as_deref(),
            config.null_separator,
            buffer_output,
        );
        ret = merge_exitcodes([ret, code]);
    }
    // Returns error in case of any error.
    ret
}

pub fn batch(
    results: impl IntoIterator<Item = WorkerResult>,
    cmd: &CommandSet,
    config: &Config,
) -> ExitCode {
    let paths = results
        .into_iter()
        .filter_map(|worker_result| match worker_result {
            WorkerResult::Entry(dir_entry) => Some(dir_entry.into_stripped_path(config)),
            WorkerResult::Error(err) => {
                if config.show_filesystem_errors {
                    print_error!("{}", err);
                }
                None
            }
        });

    cmd.execute_batch(paths, config.batch_size, config.path_separator.as_deref())
}

```

### Core Architecture Module: `src/exec/mod.rs`
```
mod command;
mod job;

use std::ffi::OsString;
use std::io;
use std::iter;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use anyhow::{Result, bail};
use argmax::Command;

use crate::exec::command::OutputBuffer;
use crate::exit_codes::{ExitCode, merge_exitcodes};
use crate::fmt::{FormatTemplate, Token};

use self::command::{execute_commands, handle_cmd_error};
pub use self::job::{batch, job};

/// Execution mode of the command
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutionMode {
    /// Command is executed for each search result
    OneByOne,
    /// Command is run for a batch of results at once
    Batch,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CommandSet {
    mode: ExecutionMode,
    commands: Vec<CommandTemplate>,
}

impl CommandSet {
    pub fn new<I, T, S>(input: I) -> Result<CommandSet>
    where
        I: IntoIterator<Item = T>,
        T: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        Ok(CommandSet {
            mode: ExecutionMode::OneByOne,
            commands: input
                .into_iter()
                .map(|args| CommandTemplate::new(args, ExecutionMode::OneByOne))
                .collect::<Result<_>>()?,
        })
    }

    pub fn new_batch<I, T, S>(input: I) -> Result<CommandSet>
    where
        I: IntoIterator<Item = T>,
        T: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        Ok(CommandSet {
            mode: ExecutionMode::Batch,
            commands: input
                .into_iter()
                .map(|args| {
                    let cmd = CommandTemplate::new(args, ExecutionMode::Batch)?;
                    if cmd.number_of_tokens() > 1 {
                        bail!("Only one placeholder allowed for batch commands");
                    }
                    Ok(cmd)
                })
                .collect::<Result<Vec<_>>>()?,
        })
    }

    pub fn in_batch_mode(&self) -> bool {
        self.mode == ExecutionMode::Batch
    }

    pub fn execute(
        &self,
        input: &Path,
        path_separator: Option<&str>,
        null_separator: bool,
        buffer_output: bool,
    ) -> ExitCode {
        let commands = self
            .commands
            .iter()
            .map(|c| c.generate(input, path_separator));
        execute_commands(commands, OutputBuffer::new(null_separator), buffer_output)
    }

    pub fn execute_batch<I>(&self, paths: I, limit: usize, path_separator: Option<&str>) -> ExitCode
    where
        I: Iterator<Item = PathBuf>,
    {
        let builders: io::Result<Vec<_>> = self
            .commands
            .iter()
            .map(|c| CommandBuilder::new(c, limit))
            .collect();

        match builders {
            Ok(mut builders) => {
                for path in paths {
                    for builder in &mut builders {
                        if let Err(e) = builder.push(&path, path_separator) {
                            return handle_cmd_error(Some(&builder.cmd), e);
                        }
                    }
                }

                for builder in &mut builders {
                    if let Err(e) = builder.finish() {
                        return handle_cmd_error(Some(&builder.cmd), e);
                    }
                }

                merge_exitcodes(builders.iter().map(|b| b.exit_code()))
            }
            Err(e) => handle_cmd_error(None, e),
        }
    }
}

/// Represents a multi-exec command as it is built.
#[derive(Debug)]
struct CommandBuilder {
    pre_args: Vec<OsString>,
    path_arg: FormatTemplate,
    post_args: Vec<OsString>,
    cmd: Command,
    count: usize,
    limit: usize,
    exit_code: ExitCode,
}

impl CommandBuilder {
    fn new(template: &CommandTemplate, limit: usize) -> io::Result<Self> {
        let mut pre_args = vec![];
        let mut path_arg = None;
        let mut post_args = vec![];

        for arg in &template.args {
            if arg.has_tokens() {
                path_arg = Some(arg.clone());
            } else if path_arg.is_none() {
                pre_args.push(arg.generate("", None));
            } else {
                post_args.push(arg.generate("", None));
            }
        }

        let cmd = Self::new_command(&pre_args)?;

        Ok(Self {
            pre_args,
            path_arg: path_arg.unwrap(),
            post_args,
            cmd,
            count: 0,
            limit,
            exit_code: ExitCode::Success,
        })
    }

    fn new_command(pre_args: &[OsString]) -> io::Result<Command> {
        let mut cmd = Command::new(&pre_args[0]);
        cmd.stdin(Stdio::inherit());
        cmd.stdout(Stdio::inherit());
        cmd.stderr(Stdio::inherit());
        cmd.try_args(&pre_args[1..])?;
        Ok(cmd)
    }

    fn push(&mut self, path: &Path, separator: Option<&str>) -> io::Result<()> {
        if self.limit > 0 && self.count >= self.limit {
            self.finish()?;
        }

        let arg = self.path_arg.generate(path, separator);
        if !self
            .cmd
            .args_would_fit(iter::once(&arg).chain(&self.post_args))
        {
            self.finish()?;
        }

        self.cmd.try_arg(arg)?;
        self.count += 1;
        Ok(())
    }

    fn finish(&mut self) -> io::Result<()> {
        if self.count > 0 {
            self.cmd.try_args(&self.post_args)?;
            if !self.cmd.status()?.success() {
                self.exit_code = ExitCode::GeneralError;
            }

            self.cmd = Self::new_command(&self.pre_args)?;
            self.count = 0;
        }

        Ok(())
    }

    fn exit_code(&self) -> ExitCode {
        self.exit_code
    }
}

/// Represents a template that is utilized to generate command strings.
///
/// The template is meant to be coupled with an input in order to generate a command. The
/// `generate_and_execute()` method will be used to generate a command and execute it.
#[derive(Debug, Clone, PartialEq)]
struct CommandTemplate {
    args: Vec<FormatTemplate>,
}

impl CommandTemplate {
    fn new<I, S>(input: I, mode: ExecutionMode) -> Result<CommandTemplate>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let mut args = Vec::new();
        let mut has_placeholder = false;

        for arg in input {
            let arg = arg.as_ref();

            let tmpl = FormatTemplate::parse(arg);
            has_placeholder |= tmpl.has_tokens();
            args.push(tmpl);
        }

        // We need to check that we have at least one argument, because if not
        // it will try to execute each file and directory it finds.
        //
        // Sadly, clap can't currently handle this for us, see
        // https://github.com/clap-rs/clap/issues/3542
        if args.is_empty() {
            bail!("No executable provided for --exec or --exec-batch");
        }

        // A placeholder as the executable is meaningful for `--exec` but never for `--exec-batch`.
        if mode == ExecutionMode::Batch && args[0].has_tokens() {
            bail!("First argument of --exec-batch must be a fixed executable, not a placeholder");
        }

        // If a placeholder token was not supplied, append one at the end of the command.
        if !has_placeholder {
            args.push(FormatTemplate::Tokens(vec![Token::Placeholder]));
        }

        Ok(CommandTemplate { args })
    }

    fn number_of_tokens(&self) -> usize {
        self.args.iter().filter(|arg| arg.has_tokens()).count()
    }

    /// Generates and executes a command.
    ///
    /// Using the internal `args` field, and a supplied `input` variable, a `Command` will be
    /// build.
    fn generate(&self, input: &Path, path_separator: Option<&str>) -> io::Result<Command> {
        let mut cmd = Command::new(self.args[0].generate(input, path_separator));
        for arg in &self.args[1..] {
            cmd.try_arg(arg.generate(input, path_separator))?;
        }
        Ok(cmd)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn generate_str(template: &CommandTemplate, input: &str) -> Vec<String> {
        template
            .args
            .iter()
            .map(|arg| arg.generate(input, None).into_string().unwrap())
            .collect()
    }

    #[test]
    fn tokens_with_placeholder() {
        assert_eq!(
            CommandSet::new(vec![vec![&"echo", &"${SHELL}:"]]).unwrap(),
            CommandSet {
                commands: vec![CommandTemplate {
                    args: vec![
                        FormatTemplate::Text("echo".into()),
                        FormatTemplate::Text("${SHELL}:".into()),
                        FormatTemplate::Tokens(vec![Token::Placeholder]),
                    ]
                }],
                mode: ExecutionMode::OneByOne,
            }
        );
    }

    #[test]
    fn tokens_with_no_extension() {
        assert_eq!(
            CommandSet::new(vec![vec!["echo", "{.}"]]).unwrap(),
            CommandSet {
                commands: vec![CommandTemplate {
                    args: vec![
                        FormatTemplate::Text("echo".into()),
                        FormatTemplate::Tokens(vec![Token::NoExt]),
                    ],
                }],
                mode: ExecutionMode::OneByOne,
            }
        );
    }

    #[test]
    fn tokens_with_basename() {
        assert_eq!(
            CommandSet::new(vec![vec!["echo", "{/}"]]).unwrap(),
            CommandSet {
                commands: vec![CommandTemplate {
                    args: vec![
                        FormatTemplate::Text("echo".into()),
                        FormatTemplate::Tokens(vec![Token::Basename]),
                    ],
                }],
                mode: ExecutionMode::OneByOne,
            }
        );
    }

    #[test]
    fn tokens_with_parent() {
        assert_eq!(
            CommandSet::new(vec![vec!["echo", "{//}"]]).unwrap(),
            CommandSet {
                commands: vec![CommandTemplate {
      
```

### Core Architecture Module: `src/exit_codes.rs`
```
use std::process;

#[cfg(unix)]
use nix::sys::signal::{SigHandler, Signal, raise, signal};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitCode {
    Success,
    HasResults(bool),
    GeneralError,
    KilledBySigint,
}

impl From<ExitCode> for i32 {
    fn from(code: ExitCode) -> Self {
        match code {
            ExitCode::Success => 0,
            ExitCode::HasResults(has_results) => !has_results as i32,
            ExitCode::GeneralError => 1,
            ExitCode::KilledBySigint => 130,
        }
    }
}

impl ExitCode {
    fn is_error(self) -> bool {
        i32::from(self) != 0
    }

    /// Exit the process with the appropriate code.
    pub fn exit(self) -> ! {
        #[cfg(unix)]
        if self == ExitCode::KilledBySigint {
            // Get rid of the SIGINT handler, if present, and raise SIGINT
            unsafe {
                if signal(Signal::SIGINT, SigHandler::SigDfl).is_ok() {
                    let _ = raise(Signal::SIGINT);
                }
            }
        }

        process::exit(self.into())
    }
}

pub fn merge_exitcodes(results: impl IntoIterator<Item = ExitCode>) -> ExitCode {
    if results.into_iter().any(ExitCode::is_error) {
        return ExitCode::GeneralError;
    }
    ExitCode::Success
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn success_when_no_results() {
        assert_eq!(merge_exitcodes([]), ExitCode::Success);
    }

    #[test]
    fn general_error_if_at_least_one_error() {
        assert_eq!(
            merge_exitcodes([ExitCode::GeneralError]),
            ExitCode::GeneralError
        );
        assert_eq!(
            merge_exitcodes([ExitCode::KilledBySigint]),
            ExitCode::GeneralError
        );
        assert_eq!(
            merge_exitcodes([ExitCode::KilledBySigint, ExitCode::Success]),
            ExitCode::GeneralError
        );
        assert_eq!(
            merge_exitcodes([ExitCode::Success, ExitCode::GeneralError]),
            ExitCode::GeneralError
        );
        assert_eq!(
            merge_exitcodes([ExitCode::GeneralError, ExitCode::KilledBySigint]),
            ExitCode::GeneralError
        );
    }

    #[test]
    fn success_if_no_error() {
        assert_eq!(merge_exitcodes([ExitCode::Success]), ExitCode::Success);
        assert_eq!(
            merge_exitcodes([ExitCode::Success, ExitCode::Success]),
            ExitCode::Success
        );
    }
}

```

### Core Architecture Module: `src/filesystem.rs`
```
use std::borrow::Cow;
use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io;
#[cfg(any(unix, target_os = "redox"))]
use std::os::unix::fs::FileTypeExt;
use std::path::{Path, PathBuf};

use normpath::PathExt;

use crate::dir_entry;

pub fn path_absolute_form(path: &Path) -> io::Result<PathBuf> {
    if path.is_absolute() {
        return Ok(path.to_path_buf());
    }

    let path = path.strip_prefix(".").unwrap_or(path);
    env::current_dir().map(|path_buf| path_buf.join(path))
}

pub fn absolute_path(path: &Path) -> io::Result<PathBuf> {
    let path_buf = path_absolute_form(path)?;

    #[cfg(windows)]
    let path_buf = Path::new(
        path_buf
            .as_path()
            .to_string_lossy()
            .trim_start_matches(r"\\?\"),
    )
    .to_path_buf();

    Ok(path_buf)
}

pub fn is_existing_directory(path: &Path) -> bool {
    // Note: we do not use `.exists()` here, as `.` always exists, even if
    // the CWD has been deleted.
    path.is_dir() && (path.file_name().is_some() || path.normalize().is_ok())
}

pub fn is_empty(entry: &dir_entry::DirEntry) -> bool {
    if let Some(file_type) = entry.file_type() {
        if file_type.is_dir() {
            if let Ok(mut entries) = fs::read_dir(entry.path()) {
                entries.next().is_none()
            } else {
                false
            }
        } else if file_type.is_file() {
            entry.metadata().map(|m| m.len() == 0).unwrap_or(false)
        } else {
            false
        }
    } else {
        false
    }
}

#[cfg(any(unix, target_os = "redox"))]
pub fn is_block_device(ft: fs::FileType) -> bool {
    ft.is_block_device()
}

#[cfg(windows)]
pub fn is_block_device(_: fs::FileType) -> bool {
    false
}

#[cfg(any(unix, target_os = "redox"))]
pub fn is_char_device(ft: fs::FileType) -> bool {
    ft.is_char_device()
}

#[cfg(windows)]
pub fn is_char_device(_: fs::FileType) -> bool {
    false
}

#[cfg(any(unix, target_os = "redox"))]
pub fn is_socket(ft: fs::FileType) -> bool {
    ft.is_socket()
}

#[cfg(windows)]
pub fn is_socket(_: fs::FileType) -> bool {
    false
}

#[cfg(any(unix, target_os = "redox"))]
pub fn is_pipe(ft: fs::FileType) -> bool {
    ft.is_fifo()
}

#[cfg(windows)]
pub fn is_pipe(_: fs::FileType) -> bool {
    false
}

#[cfg(any(unix, target_os = "redox"))]
pub fn osstr_to_bytes(input: &OsStr) -> Cow<'_, [u8]> {
    use std::os::unix::ffi::OsStrExt;
    Cow::Borrowed(input.as_bytes())
}

#[cfg(windows)]
pub fn osstr_to_bytes(input: &OsStr) -> Cow<'_, [u8]> {
    let string = input.to_string_lossy();

    match string {
        Cow::Owned(string) => Cow::Owned(string.into_bytes()),
        Cow::Borrowed(string) => Cow::Borrowed(string.as_bytes()),
    }
}

/// Remove the `./` prefix from a path.
pub fn strip_current_dir(path: &Path) -> &Path {
    path.strip_prefix(".").unwrap_or(path)
}

/// Default value for the path_separator, mainly for MSYS/MSYS2, which set the MSYSTEM
/// environment variable, and we set fd's path separator to '/' rather than Rust's default of '\'.
///
/// Returns Some to use a nonstandard path separator, or None to use rust's default on the target
/// platform.
pub fn default_path_separator() -> Option<String> {
    if cfg!(windows) {
        let msystem = env::var("MSYSTEM").ok()?;
        if !msystem.is_empty() {
            return Some("/".to_owned());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::strip_current_dir;
    use std::path::Path;

    #[test]
    fn strip_current_dir_basic() {
        assert_eq!(strip_current_dir(Path::new("./foo")), Path::new("foo"));
        assert_eq!(strip_current_dir(Path::new("foo")), Path::new("foo"));
        assert_eq!(
            strip_current_dir(Path::new("./foo/bar/baz")),
            Path::new("foo/bar/baz")
        );
        assert_eq!(
            strip_current_dir(Path::new("foo/bar/baz")),
            Path::new("foo/bar/baz")
        );
    }
}

```

### Core Architecture Module: `src/filetypes.rs`
```
use crate::dir_entry;
use crate::filesystem;

use faccess::PathExt;

/// Whether or not to show
#[derive(Default)]
pub struct FileTypes {
    pub files: bool,
    pub directories: bool,
    pub symlinks: bool,
    pub block_devices: bool,
    pub char_devices: bool,
    pub sockets: bool,
    pub pipes: bool,
    pub executables_only: bool,
    pub empty_only: bool,
}

impl FileTypes {
    pub fn should_ignore(&self, entry: &dir_entry::DirEntry) -> bool {
        if let Some(ref entry_type) = entry.file_type() {
            (!self.files && entry_type.is_file())
                || (!self.directories && entry_type.is_dir())
                || (!self.symlinks && entry_type.is_symlink())
                || (!self.block_devices && filesystem::is_block_device(*entry_type))
                || (!self.char_devices && filesystem::is_char_device(*entry_type))
                || (!self.sockets && filesystem::is_socket(*entry_type))
                || (!self.pipes && filesystem::is_pipe(*entry_type))
                || (self.executables_only && !entry.path().executable())
                || (self.empty_only && !filesystem::is_empty(entry))
                || !(entry_type.is_file()
                    || entry_type.is_dir()
                    || entry_type.is_symlink()
                    || filesystem::is_block_device(*entry_type)
                    || filesystem::is_char_device(*entry_type)
                    || filesystem::is_socket(*entry_type)
                    || filesystem::is_pipe(*entry_type))
        } else {
            true
        }
    }
}

```

### Core Architecture Module: `src/filter/mod.rs`
```
pub use self::size::SizeFilter;
pub use self::time::TimeFilter;

#[cfg(unix)]
pub use self::owner::OwnerFilter;

mod size;
mod time;

#[cfg(unix)]
mod owner;

```

### Core Architecture Module: `src/filter/owner.rs`
```
use anyhow::{Result, anyhow};
use nix::unistd::{Group, User};
use std::fs;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OwnerFilter {
    uid: Check<u32>,
    gid: Check<u32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Check<T> {
    Equal(T),
    NotEq(T),
    Ignore,
}

impl OwnerFilter {
    const IGNORE: Self = OwnerFilter {
        uid: Check::Ignore,
        gid: Check::Ignore,
    };

    /// Parses an owner constraint
    /// Returns an error if the string is invalid
    /// Returns Ok(None) when string is acceptable but a noop (such as "" or ":")
    pub fn from_string(input: &str) -> Result<Self> {
        let mut it = input.split(':');
        let (fst, snd) = (it.next(), it.next());

        if it.next().is_some() {
            return Err(anyhow!(
                "more than one ':' present in owner string '{}'. See 'fd --help'.",
                input
            ));
        }

        let uid = Check::parse(fst, |s| {
            if let Ok(uid) = s.parse() {
                Ok(uid)
            } else {
                User::from_name(s)?
                    .map(|user| user.uid.as_raw())
                    .ok_or_else(|| anyhow!("'{}' is not a recognized user name", s))
            }
        })?;
        let gid = Check::parse(snd, |s| {
            if let Ok(gid) = s.parse() {
                Ok(gid)
            } else {
                Group::from_name(s)?
                    .map(|group| group.gid.as_raw())
                    .ok_or_else(|| anyhow!("'{}' is not a recognized group name", s))
            }
        })?;

        Ok(OwnerFilter { uid, gid })
    }

    /// If self is a no-op (ignore both uid and gid) then return `None`, otherwise wrap in a `Some`
    pub fn filter_ignore(self) -> Option<Self> {
        if self == Self::IGNORE {
            None
        } else {
            Some(self)
        }
    }

    pub fn matches(&self, md: &fs::Metadata) -> bool {
        use std::os::unix::fs::MetadataExt;

        self.uid.check(md.uid()) && self.gid.check(md.gid())
    }
}

impl<T: PartialEq> Check<T> {
    fn check(&self, v: T) -> bool {
        match self {
            Check::Equal(x) => v == *x,
            Check::NotEq(x) => v != *x,
            Check::Ignore => true,
        }
    }

    fn parse<F>(s: Option<&str>, f: F) -> Result<Self>
    where
        F: Fn(&str) -> Result<T>,
    {
        let (s, equality) = match s {
            Some("") | None => return Ok(Check::Ignore),
            Some(s) if s.starts_with('!') => (&s[1..], false),
            Some(s) => (s, true),
        };

        f(s).map(|x| {
            if equality {
                Check::Equal(x)
            } else {
                Check::NotEq(x)
            }
        })
    }
}

#[cfg(test)]
mod owner_parsing {
    use super::OwnerFilter;

    macro_rules! owner_tests {
        ($($name:ident: $value:expr => $result:pat,)*) => {
            $(
                #[test]
                fn $name() {
                    let o = OwnerFilter::from_string($value);
                    match o {
                        $result => {},
                        _ => panic!("{:?} does not match {}", o, stringify!($result)),
                    }
                }
            )*
        };
    }

    use super::Check::*;
    owner_tests! {
        empty:      ""      => Ok(OwnerFilter::IGNORE),
        uid_only:   "5"     => Ok(OwnerFilter { uid: Equal(5), gid: Ignore     }),
        uid_gid:    "9:3"   => Ok(OwnerFilter { uid: Equal(9), gid: Equal(3)   }),
        gid_only:   ":8"    => Ok(OwnerFilter { uid: Ignore,   gid: Equal(8)   }),
        colon_only: ":"     => Ok(OwnerFilter::IGNORE),
        trailing:   "5:"    => Ok(OwnerFilter { uid: Equal(5), gid: Ignore     }),

        uid_negate: "!5"    => Ok(OwnerFilter { uid: NotEq(5), gid: Ignore     }),
        both_negate:"!4:!3" => Ok(OwnerFilter { uid: NotEq(4), gid: NotEq(3)   }),
        uid_not_gid:"6:!8"  => Ok(OwnerFilter { uid: Equal(6), gid: NotEq(8)   }),

        more_colons:"3:5:"  => Err(_),
        only_colons:"::"    => Err(_),
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2126** (2026-09-09): **[BUG] `--format` rejects templates starting with `-` and gives a misleading error suggestion**
  *Symptoms*: ### Checks  - [x] I have read the troubleshooting section and still think this is a bug.  ### Describe the bug you encountered:  When using `--format <fmt>`, a format string starting with `-` is rejected:  ```console > fd --format "- {/.}" error: unexpected argument '- ' found    tip: to pass '- ' as a value, use '-- - '  Usage: fd.exe [OPTIONS] [pattern] [path]...  For more information, try '--help'. ```  But `--format="- {/.}"` can work.  The help text presents the option as:  ```text --format <fmt>     Print results according to template ```  This suggests that a template can be passed as the next argument. It does not mention a restriction on templates starting with `-`. Generating a Markdown list is a straightforward use of this option, but following the documented syntax fails, and the error suggestion does not explain how to fix it.  The suggestion to use `--` is confusing here because the intended value belongs to `--format`, rather than being a positional argument.  ### Describe what you expected to happen:  `--format "- {/.}"` should accept the string as the format value, consistent with the documented `--format <fmt>` syntax, and print:  ```text - a - b - ... ```  If requiring `=` for these templates is intentional, the help text should explain this restriction, and the error should suggest `--format="- {/.}"` instead of directing the user toward `--`.  ### What version of `fd` are you using?  fd 10.5.0  ### Which operating system / distribution are you on?  ```she

- **Issue #2119** (2026-09-15): **[BUG] Sanitize gap for error messages**
  *Symptoms*: ### Checks  - [x] I have read the troubleshooting section and still think this is a bug.  ### Describe the bug you encountered:  Commit a3942db removed the escaping of control characters from error messages. It was meant to fix the newline rendering reported in #2104, but it dropped the whole filter instead of only the newline case.  Error messages do contain file names. filesystem errors shown with --show-errors carry the path of the entry, and "Command not found" carries it when a placeholder is used as the command. Escape sequences in a file name therefore reach the terminal unchanged again, which is what 10.5.0 fixed.  We should keep the filter and allow only the newline. Why not add a variant of sanitize_for_terminal that leaves `\n` unescaped and use it in print_error, and keep the strict version for file names.  ### Describe what you expected to happen:  All relevant paths should be sanitized like `ls` or `find` do it  ### What version of `fd` are you using?  10.5.0  ### Which operating system / distribution are you on?  ```shell Arch ```
  **Post-Mortem & Fix Analysis**:
  > Do you have a reproducible case where this would be a problem? I went through every case where we call print an error, and couldn't find anywhere that we injected text that came from  a filename (other than command line arguments).  I think it would be better to escape the filename (including newlines) before generating the error message rather than escaping the entire message.
  > > Do you have a reproducible case where this would be a problem?   ``` $ ln -s /nonexistent "dangling$(printf '\033]52;c;cHduZWQ=\007').txt" $ fd -x {} ``` or ``` $ ln -s .. "loop$(printf '\033]52;c;cHduZWQ=\007')" $ fd -L --show-errors ```  The clipboard now contains the string 'PWNED'  > I think it would be better to escape the filename (including newlines) before generating the error message rather than escaping the entire message.   That works for messages fd builds itself, but not for --show-errors: there fd just prints err.to_string() from ignore::Error, and that crate inserts the path. Escaping the filename first would mean formatting every ignore::Error variant by hand instead of using Display.   

- **Issue #2104** (2026-09-02): **[BUG] Newlines in error messages shown as `\x0A`**
  *Symptoms*: ### Checks  - [x] I have read the troubleshooting section and still think this is a bug.  ### Describe the bug you encountered:  ``` $ fd a/b [fd error]: The search pattern 'a/b' contains a path-separation character and will not lead to any search results.\x0A\x0AIf you want to search for all files inside the 'a/b' directory, use a match-all pattern:\x0A\x0A  fd . 'a/b'\x0A\x0AInstead, if you want your pattern to match the full file path, use:\x0A\x0A  fd --full-path 'a/b' ```  https://github.com/sharkdp/fd/blob/fe0e455feea831a055599accb5ac4eea2e3d6ba1/src/main.rs#L204-L212  ### Describe what you expected to happen:  ``` $ $ fd a/b [fd error]: The search pattern 'a/b' contains a path-separation character and will not lead to any search results.  If you want to search for all files inside the 'a/b' directory, use a match-all pattern:    fd . 'a/b'  Instead, if you want your pattern to match the full file path, use:    fd --full-path 'a/b' ```  ### What version of `fd` are you using?  10.5.0  ### Which operating system / distribution are you on?  ```shell Darwin 24.6.0 x86_64 ```
  **Post-Mortem & Fix Analysis**:
  > Looks like this was caused by https://github.com/sharkdp/fd/pull/1976

- **Issue #1965** (2026-06-16): **[BUG] fd to support light/dark terminal themes**
  *Symptoms*: ### Checks  - [x] I have read the troubleshooting section and still think this is a bug.  ### Describe the bug you encountered:  i thought that was a fish_config bug, but [i was told this is a fd issue](https://github.com/fish-shell/fish-shell/issues/12631).  Environment  * OS: Linux (PTYXIS) * Shell: fish 4.6.0 * Problematic app: fd which uses LS_COLORS for path colouring * Other: fd shows colors intended for dark terminals; user uses a light-background terminal   ### Describe what you expected to happen:  the only way to make the output readable is to turn color off  ### What version of `fd` are you using?  10.4.2  ### Which operating system / distribution are you on?  ```shell Linux 6.19 x64 ```
  **Post-Mortem & Fix Analysis**:
  > My observation suggests fd outputs based on LS_COLORS. You may want to look into that first.
  > > My observation suggests fd outputs based on LS_COLORS. You may want to look into that first.  yes, that is what the bug report says
  > The point is you can set LS_COLORS to use colors that better fit your terminal's color scheme.  There isn't really a reliable way for fd to know if you use a light terminal theme.

- **Issue #1936** (2026-03-25): **[BUG] Artifact attestation mismatch**
  *Symptoms*: ### Checks  - [x] I have read the troubleshooting section and still think this is a bug.  ### Describe the bug you encountered:  There's something wrong with artifact attestations, or release tarballs -- generated attestations don't match the actual release artifacts. For example: ```shellsession $ curl -RLO https://github.com/sharkdp/fd/releases/download/v10.4.2/fd-v10.4.2-x86_64-unknown-linux-musl.tar.gz $ gh attestation verify --owner sharkdp fd-v10.4.2-x86_64-unknown-linux-musl.tar.gz Loaded digest sha256:e3257d48e29a6be965187dbd24ce9af564e0fe67b3e73c9bdcd180f4ec11bdde for file://fd-v10.4.2-x86_64-unknown-linux-musl.tar.gz ✗ Loading attestations from GitHub API failed  Error: HTTP 404: Not Found (https://api.github.com/orgs/sharkdp/attestations/sha256:e3257d48e29a6be965187dbd24ce9af564e0fe67b3e73c9bdcd180f4ec11bdde?per_page=30&predicate_type=https://slsa.dev/provenance/v1) ```  The locally calculated sha256 for this tarball is e3257d48e29a6be965187dbd24ce9af564e0fe67b3e73c9bdcd180f4ec11bdde, but the artifact attestation generated for it was for c7fbdbd4857d5813991fa273043eae92c4565d5b5f7a6bb7f6c929e84eb8abf6: https://github.com/sharkdp/fd/attestations/20884959  ### Describe what you expected to happen:  Artifact attestation successfully verified, sha256sum in attestation matching that of the actual release tarball.  ### What version of `fd` are you using?  N/A  ### Which operating system / distribution are you on?  ```shell N/A ```
  **Post-Mortem & Fix Analysis**:
  > Hmm I'm not sure why that would be. Maybe I should use subject_path instead of subject _ digest?  
  > Looks like artifact upload actually _zips_ the uploaded things by default (so it becomes .tar.gz.zip and we get a digest of _that_), cf. https://github.com/sharkdp/fd/actions/runs/22891933838/job/66416886890#step:14:23  I suppose with upload-artifact v7.0.0 setting `archive: false` could help: https://github.com/actions/upload-artifact/releases/tag/v7.0.0 (the main action docs are not up to date wrt this, https://github.com/actions/upload-artifact)  Then again simply switching to `subject-path: ${{ steps.package.outputs.PKG_PATH }}` and similarly for other attested release assets could work and be independent of the artifact upload.

- **Issue #1931** (2026-03-18): **[BUG] --print0 --exec emits NUL as standalone output marker**
  *Symptoms*: ### Checks  - [x] I have read the troubleshooting section and still think this is a bug.  ### Describe the bug you encountered:   Description:  After the --print0 + --exec changes from #1805 released in v10.4.0, the NUL separator appears in the output stream as a visible standalone ^@ marker when viewed through a tool that makes NUL bytes visible.  The intended behavior from #1805 seems to be to emit \0 between the output of each found entry’s command execution.  Reproducer:  fd -e txt --no-ignore --print0 --exec sh -c "echo {}" | bat  bat is only used here to make the NUL byte visible as ^@.  Output: ``` ─────┬────────────────────────────────────────────────────────────────────      │ STDIN ─────┼────────────────────────────────────────────────────────────────────    1 │ ./vidbrx.txt    2 │ ^@ ─────┴──────────────────────────────────────────────────────────────────── ``` Expected behavior:  The \0 should act purely as an entry separator in the stream, rather than surfacing as a standalone visible output marker after the command output.  Possible cause:  In src/exec/command.rs, OutputBuffer::write() appears to append \0 unconditionally when null_separator is enabled:  if self.null_separator {     let _ = stdout.write_all(b"\0"); }  This may be causing the separator to be written independently of the command’s visible output boundaries.  Notes:  I’m not questioning the feature from #1805 itself — having --print0 work with --exec is useful. This looks like a sequencing / presen
  **Post-Mortem & Fix Analysis**:
  > hmm.  i think this behaviour change is surfacing a bug in my script execution.  I verified that   >  fd -e txt --no-ignore --print0 --exec sh -c 'printf %s "{}"' | hexdump -C  outputs correctly per the change message:  > 00000000  2e 2f 76 69 64 62 72 78  2e 74 78 74 00           |./vidbrx.txt.| 0000000d  I'll look at updating my usage.

- **Issue #1923** (2026-03-13): **[BUG] fd -HI -e elc -X rm . ~/.emacs.d**
  *Symptoms*: ### Checks  - [x] I have read the troubleshooting section and still think this is a bug.  ### Describe the bug you encountered:  `fd -HI -e elc -X rm . ~/.emacs.d` It doesn't work and there is no elc files deleted. Could you resolve it?  ### Describe what you expected to happen:  _No response_  ### What version of `fd` are you using?  fd 10.4.2  ### Which operating system / distribution are you on?  ```shell Darwin 25.3.0 arm64 ```
  **Post-Mortem & Fix Analysis**:
  > I don't think that does what you are hoping. That will run `rm . ~/.emacs.d $x` where $x  is the set of .elc files it finds from the current directory.  You probably want:  ``` fd -HI -e elc . ~/.emacs.d -X rm ```  Or  ``` fd -HI -e elc -X rm '{}'  ';' . ~/.emacs.d ```
  > Thanks. It's not a bug, and I'll close it.

- **Issue #1913** (2026-03-09): **[BUG] Performance regression on directory lookups between 10.3.0 and 10.4.0**
  *Symptoms*: ### Checks  - [x] I have read the troubleshooting section and still think this is a bug.  ### Describe the bug you encountered:  Hello,  After upgrading from 10.3.0 to 10.4.0 (official archlinux packages), I noticed some of my scripts got noticeably slower.  I use `fd` to navigate a pretty large ZFS volume (roughly 2800 directories and 1.3M files) mounted locally with NFS.  Baseline measurement with the last known good version: ``` > fd --version fd 10.3.0  # Hot cache > hyperfine --warmup 2 'fd xyz /tank/documents/ --type d' Benchmark 1: fd xyz /tank/documents/ --type d   Time (mean ± σ):      93.5 ms ±   2.4 ms    [User: 596.2 ms, System: 197.9 ms]   Range (min … max):    89.4 ms …  99.0 ms    31 runs  # Cold cache > hyperfine --prepare 'sync ; echo 3 | sudo tee /proc/sys/vm/drop_caches' 'fd xyz /tank/documents/ --type d' Benchmark 1: fd xyz /tank/documents/ --type d   Time (mean ± σ):      2.248 s ±  0.072 s    [User: 0.429 s, System: 0.635 s]   Range (min … max):    2.180 s …  2.447 s    10 runs ```  But after upgrading to 10.4.0: ``` > fd --version fd 10.4.0  # Hot cache > hyperfine --warmup 2 'fd xyz /tank/documents/ --type d' Benchmark 1: fd xyz /tank/documents/ --type d   Time (mean ± σ):     205.0 ms ±   5.1 ms    [User: 981.2 ms, System: 2421.8 ms]   Range (min … max):   197.3 ms … 218.9 ms    15 runs  # Cold cache > hyperfine --prepare 'sync ; echo 3 | sudo tee /proc/sys/vm/drop_caches' 'fd xyz /tank/documents/ --type d' Benchmark 1: fd xyz /tank/documents/ --type 
  **Post-Mortem & Fix Analysis**:
  > @bvergnaud Does https://github.com/sharkdp/fd/pull/1914 help? 
  > Yup ! 👍🏻   Your patch gets us back to 10.3.0 performance: ``` # Hot cache > hyperfine --warmup 2 'fd xyz /tank/documents --type d' Benchmark 1: fd xyz /tank/documents --type d   Time (mean ± σ):      97.3 ms ±   3.4 ms    [User: 624.9 ms, System: 196.4 ms]   Range (min … max):    91.1 ms … 102.6 ms    29 runs  # Cold cache > hyperfine --prepare 'sync ; echo 3 | sudo tee /proc/sys/vm/drop_caches' 'fd xyz /tank/documents --type d' Benchmark 1: fd xyz /tank/documents --type d   Time (mean ± σ):      2.309 s ±  0.163 s    [User: 0.450 s, System: 0.658 s]   Range (min … max):    2.242 s …  2.772 s    10 runs ```  Thanks. 🙂 

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

### Incident Patch 1: `d91fe9cb` (2026-10-01)
**Commit Message**: build(deps): bump crossbeam-channel from 0.5.16 to 0.5.17

Bumps [crossbeam-channel](https://github.com/crossbeam-rs/crossbeam) from 0.5.16 to 0.5.17.
- [Release notes](https://github.com/crossbeam-rs/crossbeam/releases)
- [Changelog](https://github.com/crossbeam-rs/crossbeam/blob/main/CHANGELOG.md)
- [Commits](https://github.com/crossbeam-rs/crossbeam/compare/crossbeam-channel-0.5.16...crossbeam-channel-0.5.17)

---
updated-dependencies:
- dependency-name: crossbeam-channel
  dependency-version: 0.5.17
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -189,9 +189,9 @@ checksum = "b05b61dc5112cbb17e4b6cd61790d9845d13888356391624cbe7e41efeac1e75"
 
 [[package]]
 name = "crossbeam-channel"
-version = "0.5.16"
+version = "0.5.17"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d85363c37faeca707aef026efa9f3b34d077bce547e48f770770625c6013679e"
+checksum = "98b0cc327b5bc766e7fda9c9260cc0fa81b43a8e240440422dff70788e3f9ef1"
 dependencies = [
  "crossbeam-utils",
 ]
```

---

### Incident Patch 2: `ce97e473` (2026-09-24)
**Commit Message**: Merge pull request #2039 from hexbinoct/fix/min-depth-broken-symlink

Compute depth for broken symlinks so --min-depth keeps them

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@
   when output goes to a terminal, to prevent terminal escape-sequence injection.
   Also reject a placeholder as the executable for `--exec-batch`, while still
   allowing it for `--exec`.
+- Fix broken symlinks being incorrectly filtered out by `--min-depth` when following links (`--follow`), because their depth was not computed; see #1017 (@hexbinoct).
 - Handle invalid working directories gracefully when using `--full-path`, see #1900 (@Xavrir).
 - Fire the "search pattern contains a path separator" diagnostic for any pattern containing `/`, not just patterns that happen to name an existing directory. Preserves the legacy Windows behaviour that also flags native `\` separators when the pattern resolves to a real directory. See #1873.
 - Also fire the "search pattern contains a path separator" diagnostic for `--and` patterns, not only the primary positional pattern. `--and` patterns are matched against the file name just like the primary pattern, so a path separator in them silently returned zero results. See #1873.
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ path = "src/main.rs"
 aho-corasick = "1.1"
 nu-ansi-term = "0.50"
 argmax = "0.4.0"
-ignore = "0.4.25"
+ignore = "0.4.28"
 regex = "1.12.2"
 regex-syntax = "0.8"
 ctrlc = "3.5"
```

**File**: `src/dir_entry.rs` (modified, +11/-9)
```diff
@@ -11,7 +11,9 @@ use crate::filesystem::strip_current_dir;
 #[derive(Debug)]
 enum DirEntryInner {
     Normal(ignore::DirEntry),
-    BrokenSymlink(PathBuf),
+    // Broken symlinks reach us as walk errors rather than entries, so we carry
+    // over the depth the walker recorded on the error.
+    BrokenSymlink { path: PathBuf, depth: Option<usize> },
 }
 
 #[derive(Debug)]
@@ -31,9 +33,9 @@ impl DirEntry {
         }
     }
 
-    pub fn broken_symlink(path: PathBuf) -> Self {
+    pub fn broken_symlink(path: PathBuf, depth: Option<usize>) -> Self {
         Self {
-            inner: DirEntryInner::BrokenSymlink(path),
+            inner: DirEntryInner::BrokenSymlink { path, depth },
             metadata: OnceCell::new(),
             style: OnceCell::new(),
         }
@@ -42,14 +44,14 @@ impl DirEntry {
     pub fn path(&self) -> &Path {
         match &self.inner {
             DirEntryInner::Normal(e) => e.path(),
-            DirEntryInner::BrokenSymlink(pathbuf) => pathbuf.as_path(),
+            DirEntryInner::BrokenSymlink { path, .. } => path.as_path(),
         }
     }
 
     pub fn into_path(self) -> PathBuf {
         match self.inner {
             DirEntryInner::Normal(e) => e.into_path(),
-            DirEntryInner::BrokenSymlink(p) => p,
+            DirEntryInner::BrokenSymlink { path, .. } => path,
         }
     }
 
@@ -82,23 +84,23 @@ impl DirEntry {
     pub fn file_type(&self) -> Option<FileType> {
         match &self.inner {
             DirEntryInner::Normal(e) => e.file_type(),
-            DirEntryInner::BrokenSymlink(_) => self.metadata().map(|m| m.file_type()),
+            DirEntryInner::BrokenSymlink { .. } => self.metadata().map(|m| m.file_type()),
         }
     }
 
     pub fn metadata(&self) -> Option<&Metadata> {
         self.metadata
             .get_or_init(|| match &self.inner {
                 DirEntryInner::Normal(e) => e.metadata().ok(),
-                DirEntryInner::BrokenSymlink(path) => path.symlink_metadata().ok(),
+                DirEntryInner::BrokenSymlink { path, .. } => path.symlink_metadata().ok(),
             })
             .as_ref()
     }
 
     pub fn depth(&self) -> Option<usize> {
         match &self.inner {
             DirEntryInner::Normal(e) => Some(e.depth()),
-            DirEntryInner::BrokenSymlink(_) => None,
+            DirEntryInner::BrokenSymlink { depth, .. } => *depth,
         }
     }
 
@@ -144,7 +146,7 @@ impl Colorable for DirEntry {
     fn file_name(&self) -> OsString {
         let name = match &self.inner {
             DirEntryInner::Normal(e) => e.file_name(),
-            DirEntryInner::BrokenSymlink(path) => {
+            DirEntryInner::BrokenSymlink { path, .. } => {
                 // Path::file_name() only works if the last component is Normal,
                 // but we want it for all component types, so we open code it.
                 // Copied from LsColors::style_for_path_with_metadata().
```

**File**: `src/walk.rs` (modified, +33/-18)
```diff
@@ -2,7 +2,7 @@ use std::borrow::Cow;
 use std::ffi::OsStr;
 use std::io::{self, Write};
 use std::mem;
-use std::path::PathBuf;
+use std::path::{Path, PathBuf};
 use std::sync::atomic::{AtomicBool, Ordering};
 use std::sync::{Arc, Mutex, MutexGuard};
 use std::thread;
@@ -483,24 +483,24 @@ impl WorkerState {
                 }
                 let entry = match entry {
                     Ok(e) => DirEntry::normal(e),
-                    Err(ignore::Error::WithPath {
-                        path,
-                        err: inner_err,
-                    }) if inner_err
-                        .io_error()
-                        .is_some_and(|io_error| io_error.kind() == io::ErrorKind::NotFound)
-                        && path
-                            .symlink_metadata()
-                            .ok()
-                            .is_some_and(|m| m.file_type().is_symlink()) =>
-                    {
-                        DirEntry::broken_symlink(path)
-                    }
                     Err(err) => {
-                        return match tx.send(WorkerResult::Error(err)) {
-                            Ok(_) => WalkState::Continue,
-                            Err(_) => WalkState::Quit,
-                        };
+                        // The depth has to be read off the error before it is
+                        // taken apart, since it is recorded on an inner variant.
+                        let depth = err.depth();
+                        match err {
+                            ignore::Error::WithPath {
+                                path,
+                                err: inner_err,
+                            } if is_broken_symlink(&path, &inner_err) => {
+                                DirEntry::broken_symlink(path, depth)
+                            }
+                            err => {
+                                return match tx.send(WorkerResult::Error(err)) {
+                                    Ok(_) => WalkState::Continue,
+                                    Err(_) => WalkState::Quit,
+                                };
+                            }
+                        }
                     }
                 };
 
@@ -652,6 +652,21 @@ impl WorkerState {
     }
 }
 
+/// Whether a walk error is really a broken symlink rather than a failure worth
+/// reporting.
+///
+/// A symlink whose target is missing is surfaced by the walker as a NotFound
+/// error against the link's own path, so it never arrives as an entry. fd still
+/// wants to match and print it (see issue #1017), which means recovering it here.
+fn is_broken_symlink(path: &Path, err: &ignore::Error) -> bool {
+    err.io_error()
+        .is_some_and(|io_error| io_error.kind() == io::ErrorKind::NotFound)
+        && path
+            .symlink_metadata()
+            .ok()
+            .is_some_and(|m| m.file_type().is_symlink())
+}
+
 fn search_str_for_entry<'a>(
     entry_path: &'a std::path::Path,
     full_path_base: Option<&std::path::Path>,
```

**File**: `tests/tests.rs` (modified, +201/-0)
```diff
@@ -1208,6 +1208,207 @@ fn test_min_depth() {
     );
 }
 
+/// Minimum depth with a broken symlink (regression test for #1017)
+///
+/// A broken symlink, surfaced while following links, has no depth reported by
+/// the walker, so --min-depth used to drop it unconditionally.
+#[test]
+fn test_min_depth_broken_symlink() {
+    let mut te = TestEnv::new(DEFAULT_DIRS, DEFAULT_FILES);
+    te.create_broken_symlink("one/two/broken_symlink")
+        .expect("Failed to create broken symlink.");
+
+    // The broken symlink sits at depth 3, so it is kept up to that depth.
+    te.assert_output(
+        &[
+            "--follow",
+            "--type",
+            "symlink",
+            "--min-depth",
+            "3",
+            "broken_symlink",
+        ],
+        "one/two/broken_symlink",
+    );
+
+    // A --min-depth beyond its actual depth must exclude it.
+    te.assert_output(
+        &[
+            "--follow",
+            "--type",
+            "symlink",
+            "--min-depth",
+            "4",
+            "broken_symlink",
+        ],
+        "",
+    );
+}
+
+/// Minimum depth with a broken symlink combined with --absolute-path (#1017)
+///
+/// With --absolute-path the search root is made absolute before walking, so the
+/// broken symlink's depth must still be computed relative to that root rather
+/// than from the absolute path's full component count.
+#[test]
+fn test_min_depth_broken_symlink_absolute_path() {
+    let (mut te, abs_path) = get_test_env_with_abs_path(DEFAULT_DIRS, DEFAULT_FILES);
+    te.create_broken_symlink("one/two/broken_symlink")
+        .expect("Failed to create broken symlink.");
+
+    // The broken symlink sits at depth 3 relative to the (absolute) root.
+    te.assert_output(
+        &[
+            "--follow",
+            "--absolute-path",
+            "--type",
+            "symlink",
+            "--min-depth",
+            "3",
+            "broken_symlink",
+        ],
+        &format!("{abs_path}/one/two/broken_symlink"),
+    );
+
+    // A --min-depth beyond its actual depth must exclude it.
+    te.assert_output(
+        &[
+            "--follow",
+            "--absolute-path",
+            "--type",
+            "symlink",
+            "--min-depth",
+            "4",
+            "broken_symlink",
+        ],
+        "",
+    );
+}
+
+/// Minimum depth with a broken symlink under overlapping search roots (#1017)
+///
+/// When two search roots overlap, the walker visits the same broken symlink once
+/// per root, at a different depth each time. Here `one/two/broken_symlink` is at
+/// depth 2 under root `one` and at depth 1 under root `one/two`, so --min-depth 2
+/// must keep the entry the walker reached via `one` and drop the one it reached
+/// via `one/two`. A depth derived from the entry's path cannot distinguish the
+/// two visits, since both carry the same path.
+#[test]
+fn test_min_depth_broken_symlink_overlapping_roots() {
+    let mut te = TestEnv::new(DEFAULT_DIRS, DEFAULT_FILES);
+    te.create_broken_symlink("one/two/broken_symlink")
+        .expect("Failed to create broken symlink.");
+
+    // Only the route through `one` reaches depth 2.
+    te.assert_output(
+        &[
+            "--follow",
+            "--type",
+            "symlink",
+            "--min-depth",
+            "2",
+            "broken_symlink",
+            "one",
+            "one/two",
+        ],
+        "one/two/broken_symlink",
+    );
+
+    // Both routes clear --min-depth 1, so it is reported once per root.
+    te.assert_output(
+        &[
+            "--follow",
+            "--type",
+            "symlink",
+            "--min-depth",
+            "1",
+            "broken_symlink",
+            "one",
+            "one/two",
+        ],
+        "one/two/broken_symlink
+        one/two/broken_symlink",
+    );
+}
+
+/// Maximum depth with a broken symlink (#1017)
+///
+/// A broken symlink must be filtered by --max-depth like any other entry. The
+/// default environment also exposes it through the followed `symlink` directory
+/// (`symlink -> one/two`), so it is reachable at depth 2 as well as depth 3.
+#[test]
+fn test_max_depth_broken_symlink() {
+    let mut te = TestEnv::new(DEFAULT_DIRS, DEFAULT_FILES);
+    te.create_broken_symlink("one/two/broken_symlink")
+        .expect("Failed to create broken symlink.");
+
+    // --max-depth 3 keeps both routes to the broken symlink.
+    te.assert_output(
+        &[
+            "--follow",
+            "--type",
+            "symlink",
+            "--max-depth",
+            "3",
+            "broken_symlink",
+        ],
+        "one/two/broken_symlink
+        symlink/broken_symlink",
+    );
+
+    // A --max-depth below either route must exclude it.
+    te.assert_output(
+        &[
+            "--follow",
+            "--type",
+            "symlink",
+            "--max-depth",
+            "1",
+            "broken_symlink",
+        ],
+        "",
+    );
+}
+
+
```

---

### Incident Patch 3: `9e8927e8` (2026-09-02)
**Commit Message**: build(deps): bump clap_complete from 4.6.5 to 4.6.9

Bumps [clap_complete](https://github.com/clap-rs/clap) from 4.6.5 to 4.6.9.
- [Release notes](https://github.com/clap-rs/clap/releases)
- [Changelog](https://github.com/clap-rs/clap/blob/master/CHANGELOG.md)
- [Commits](https://github.com/clap-rs/clap/compare/clap_complete-v4.6.5...clap_complete-v4.6.9)

---
updated-dependencies:
- dependency-name: clap_complete
  dependency-version: 4.6.9
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -156,9 +156,9 @@ dependencies = [
 
 [[package]]
 name = "clap_complete"
-version = "4.6.5"
+version = "4.6.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e0a7a9bfdb35811f9e59832f0f05975114d2251b415fb534108e6f34060fd772"
+checksum = "3be2ad0423bdbbb0e25bc89add796f3559706d4a95e1bc98e4d9662a957b6a19"
 dependencies = [
  "clap",
 ]
```

---

### Incident Patch 4: `0e01c8ce` (2026-09-07)
**Commit Message**: build(deps): bump softprops/action-gh-release from 3.0.2 to 3.0.3

Bumps [softprops/action-gh-release](https://github.com/softprops/action-gh-release) from 3.0.2 to 3.0.3.
- [Release notes](https://github.com/softprops/action-gh-release/releases)
- [Changelog](https://github.com/softprops/action-gh-release/blob/master/CHANGELOG.md)
- [Commits](https://github.com/softprops/action-gh-release/compare/3d0d9888cb7fd7b750713d6e236d1fcb99157228...efb35369e0ad2afab669f228072c1b0d510eae64)

---
updated-dependencies:
- dependency-name: softprops/action-gh-release
  dependency-version: 3.0.3
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/CICD.yml` (modified, +1/-1)
```diff
@@ -255,7 +255,7 @@ jobs:
           ${{ steps.debian-package.outputs.DPKG_PATH }}
 
     - name: Publish archives and packages
-      uses: softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228 # v3.0.2
+      uses: softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64 # v3.0.3
       if: steps.is-release.outputs.IS_RELEASE
       with:
         files: |
```

---

### Incident Patch 5: `24198d90` (2026-09-14)
**Commit Message**: fix: Better sanitizing

This refactors the sanitization code somewhat, to provide a couple
benefits:

- Ensure we sanitize output in error messages (#2119), while not
  escaping newlines from error messages.
- Avoids some unnecessary allocations and string copies
- Makes `print_error` a little nicer to use. As a macro, it avoids
  needing a separate call to `format!`.

The main downside is added complexity.

Fixes: #2119

**File**: `src/cli.rs` (modified, +6/-5)
```diff
@@ -11,7 +11,6 @@ use clap::{
 use clap_complete::Shell;
 use normpath::PathExt;
 
-use crate::error::print_error;
 use crate::exec::CommandSet;
 use crate::filesystem;
 #[cfg(unix)]
@@ -711,10 +710,12 @@ impl Opts {
                 if filesystem::is_existing_directory(path) {
                     Some(self.normalize_path(path))
                 } else {
-                    print_error(format!(
-                        "Search path '{}' is not a directory.",
-                        path.to_string_lossy()
-                    ));
+                    // We use debug for the path to make it more readable if it has special characters
+                    // Should we use a more reliable escape?
+                    print_error!(
+                        "Search path {:?} is not a directory.",
+                        path.to_string_lossy().as_ref()
+                    );
                     None
                 }
             })
```

**File**: `src/error.rs` (modified, +50/-2)
```diff
@@ -1,3 +1,51 @@
-pub fn print_error(msg: impl std::fmt::Display) {
-    eprintln!("[fd error]: {msg}");
+use std::fmt::Display;
+use std::io;
+
+use crate::sanitize::write_sanitized;
+
+/// Print an error message using a format string, sanitizing any arguments if necessary
+macro_rules! print_error {
+    ($fmt:literal, $($arg:expr),*) => {
+        eprintln!(concat!("[fd error]: ", $fmt), $($crate::error::SanitizeErr::sanitize($arg)),*)
+    }
+}
+
+/// Trait for specifying how to sanitize a type for error display, if needed.
+pub(crate) trait SanitizeErr {
+    type Sanitized: Display;
+
+    fn sanitize(self) -> Self::Sanitized;
+}
+
+impl SanitizeErr for &str {
+    type Sanitized = Self;
+
+    fn sanitize(self) -> Self {
+        self
+    }
+}
+
+impl SanitizeErr for io::Error {
+    type Sanitized = SanitizedError<io::Error>;
+
+    fn sanitize(self) -> Self::Sanitized {
+        SanitizedError(self)
+    }
+}
+
+impl SanitizeErr for ignore::Error {
+    type Sanitized = SanitizedError<ignore::Error>;
+
+    fn sanitize(self) -> Self::Sanitized {
+        SanitizedError(self)
+    }
+}
+
+pub struct SanitizedError<E>(E);
+
+impl<E: std::error::Error> Display for SanitizedError<E> {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        let raw = self.0.to_string();
+        write_sanitized(f, &raw)
+    }
 }
```

**File**: `src/exec/command.rs` (modified, +5/-6)
```diff
@@ -3,7 +3,6 @@ use std::io::Write;
 
 use argmax::Command;
 
-use crate::error::print_error;
 use crate::exit_codes::ExitCode;
 
 struct Outputs {
@@ -101,14 +100,14 @@ pub fn execute_commands<I: Iterator<Item = io::Result<Command>>>(
 pub fn handle_cmd_error(cmd: Option<&Command>, err: io::Error) -> ExitCode {
     match (cmd, err) {
         (Some(cmd), err) if err.kind() == io::ErrorKind::NotFound => {
-            print_error(format!(
-                "Command not found: {}",
-                cmd.get_program().to_string_lossy()
-            ));
+            print_error!(
+                "Command not found: {:?}",
+                cmd.get_program().to_string_lossy().as_ref()
+            );
             ExitCode::GeneralError
         }
         (_, err) => {
-            print_error(format!("Problem while executing command: {err}"));
+            print_error!("Problem while executing command: {}", err);
             ExitCode::GeneralError
         }
     }
```

**File**: `src/exec/job.rs` (modified, +2/-3)
```diff
@@ -1,5 +1,4 @@
 use crate::config::Config;
-use crate::error::print_error;
 use crate::exit_codes::{ExitCode, merge_exitcodes};
 use crate::walk::WorkerResult;
 
@@ -24,7 +23,7 @@ pub fn job(
             WorkerResult::Entry(dir_entry) => dir_entry,
             WorkerResult::Error(err) => {
                 if config.show_filesystem_errors {
-                    print_error(err.to_string());
+                    print_error!("{}", err);
                 }
                 continue;
             }
@@ -54,7 +53,7 @@ pub fn batch(
             WorkerResult::Entry(dir_entry) => Some(dir_entry.into_stripped_path(config)),
             WorkerResult::Error(err) => {
                 if config.show_filesystem_errors {
-                    print_error(err.to_string());
+                    print_error!("{}", err);
                 }
                 None
             }
```

**File**: `src/main.rs` (modified, +11/-6)
```diff
@@ -1,7 +1,10 @@
+// needs to be first because it defines a macro
+#[macro_use]
+mod error;
+
 mod cli;
 mod config;
 mod dir_entry;
-mod error;
 mod exec;
 mod exit_codes;
 mod filesystem;
@@ -66,7 +69,9 @@ fn main() {
             exit_code.exit();
         }
         Err(err) => {
-            crate::error::print_error(format!("{err:#}"));
+            // NB: we use eprintln directly instead of print_error!() because
+            // we sanitize anyhow errors at the generation site
+            eprintln!("[fd error]: {:#}", err);
             ExitCode::GeneralError.exit();
         }
     }
@@ -132,14 +137,14 @@ fn set_working_dir(opts: &Opts) -> Result<()> {
     if let Some(ref base_directory) = opts.base_directory {
         if !filesystem::is_existing_directory(base_directory) {
             return Err(anyhow!(
-                "The '--base-directory' path '{}' is not a directory.",
-                base_directory.to_string_lossy()
+                "The '--base-directory' path {:?} is not a directory.",
+                base_directory.to_string_lossy().as_ref()
             ));
         }
         env::set_current_dir(base_directory).with_context(|| {
             format!(
-                "Could not set '{}' as the current working directory",
-                base_directory.to_string_lossy()
+                "Could not set {:?} as the current working directory",
+                base_directory.to_string_lossy().as_ref()
             )
         })?;
     }
```

**File**: `src/output.rs` (modified, +21/-7)
```diff
@@ -7,7 +7,7 @@ use crate::config::Config;
 use crate::dir_entry::DirEntry;
 use crate::fmt::FormatTemplate;
 use crate::hyperlink::PathUrl;
-use crate::sanitize::maybe_sanitize;
+use crate::sanitize::sanitize_for_term;
 
 fn replace_path_separator(path: &str, new_path_separator: &str) -> String {
     path.replace(std::path::MAIN_SEPARATOR, new_path_separator)
@@ -81,7 +81,7 @@ fn print_entry_format<W: Write>(
     write!(
         stdout,
         "{}",
-        maybe_sanitize(&s, config.interactive_terminal)
+        sanitize_for_term(&s, config.interactive_terminal)
     )
 }
 
@@ -117,16 +117,30 @@ fn print_entry_colorized<W: Write>(
             .style_for_indicator(Indicator::Directory)
             .map(Style::to_nu_ansi_term_style)
             .unwrap_or_default();
-        let safe_parent = maybe_sanitize(&parent_str, config.interactive_terminal);
-        write!(stdout, "{}", style.paint(safe_parent.as_ref()))?;
+        let safe_parent = sanitize_for_term(&parent_str, config.interactive_terminal);
+        // We explicitly use prefix/suffix instead of paint so that we can use Sanitized
+        write!(
+            stdout,
+            "{}{}{}",
+            style.prefix(),
+            safe_parent,
+            style.suffix()
+        )?;
     }
 
     let style = entry
         .style(ls_colors)
         .map(Style::to_nu_ansi_term_style)
         .unwrap_or_default();
-    let safe_basename = maybe_sanitize(&path_str[offset..], config.interactive_terminal);
-    write!(stdout, "{}", style.paint(safe_basename.as_ref()))?;
+    let safe_basename = sanitize_for_term(&path_str[offset..], config.interactive_terminal);
+    // We explicitly use prefix/suffix instead of paint so that we can use Sanitized
+    write!(
+        stdout,
+        "{}{}{}",
+        style.prefix(),
+        safe_basename,
+        style.suffix()
+    )?;
 
     print_trailing_slash(
         stdout,
@@ -150,7 +164,7 @@ fn print_entry_uncolorized_base<W: Write>(
     if let Some(ref separator) = config.path_separator {
         *path_string.to_mut() = replace_path_separator(&path_string, separator);
     }
-    let safe = maybe_sanitize(&path_string, config.interactive_terminal);
+    let safe = sanitize_for_term(&path_string, config.interactive_terminal);
     write!(stdout, "{safe}")?;
     print_trailing_slash(stdout, entry, config, None)
 }
```

**File**: `src/sanitize.rs` (modified, +59/-51)
```diff
@@ -1,7 +1,6 @@
 //! TTY-output sanitization to prevent terminal escape injection via filenames.
 
-use std::borrow::Cow;
-use std::fmt::Write;
+use std::fmt::{Display, Formatter, Write};
 
 /// True for any char that is neither printable nor permitted whitespace (only HT).
 /// Covers C0/C1/DEL, bidi overrides, zero-width and format chars, and tag chars.
@@ -23,41 +22,66 @@ fn needs_escape(c: char) -> bool {
         )
 }
 
-/// Returns a `Cow<str>` borrowing `s` when no escaping is needed, otherwise an owned
-/// escaped copy. Use this when an owned `&str`/`String` is required (e.g. ANSI paint).
-pub fn sanitize_for_terminal(s: &str) -> Cow<'_, str> {
-    if !s.chars().any(needs_escape) {
-        return Cow::Borrowed(s);
-    }
-    let mut out = String::with_capacity(s.len());
-    for c in s.chars() {
+/// Write the sanitized contents of `raw` to `f`.
+pub fn write_sanitized(f: &mut std::fmt::Formatter<'_>, raw: &str) -> std::fmt::Result {
+    // Would it be faster to do a pass to see if we don't need an escape and write
+    // the whole string first? Maybe with a faster check just for non-control ASCII?
+    for c in raw.chars() {
         if needs_escape(c) {
             let v = c as u32;
             if v <= 0xFF {
-                let _ = write!(out, "\\x{v:02X}");
+                write!(f, "\\x{v:02X}")?;
             } else {
-                let _ = write!(out, "\\u{{{v:04X}}}");
+                write!(f, "\\u{{{v:04X}}}")?;
             }
         } else {
-            out.push(c);
+            f.write_char(c)?;
+        }
+    }
+    Ok(())
+}
+
+// TODO: add something to sanitize paths directly instead of as strings.
+
+/// A wrapper type that sanitizes the output to Display
+pub(crate) struct SanitizedStr<'a> {
+    raw: &'a str,
+    /// If true, the content is safe to output without sanitizing,
+    /// either because it is trusted, or because it isn't going to a terminal.
+    is_safe: bool,
+}
+
+impl<'a> Display for SanitizedStr<'a> {
+    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
+        if self.is_safe {
+            // We don't need to sanitize anything, just forward
+            self.raw.fmt(f)
+        } else {
+            write_sanitized(f, self.raw)
         }
     }
-    Cow::Owned(out)
 }
 
 /// Sanitize for terminal output only; raw bytes pass through on pipes/files.
-pub fn maybe_sanitize<'a>(s: &'a str, is_terminal: bool) -> Cow<'a, str> {
-    if is_terminal {
-        sanitize_for_terminal(s)
-    } else {
-        Cow::Borrowed(s)
+pub fn sanitize_for_term(raw: &str, is_terminal: bool) -> SanitizedStr<'_> {
+    SanitizedStr {
+        raw,
+        is_safe: !is_terminal,
     }
 }
 
 #[cfg(test)]
 mod tests {
     use super::*;
 
+    fn sanitize_string(s: &str) -> String {
+        SanitizedStr {
+            raw: s,
+            is_safe: false,
+        }
+        .to_string()
+    }
+
     #[test]
     fn preserves_safe_content() {
         for s in [
@@ -68,75 +92,63 @@ mod tests {
             "a\tb",
             "a\u{FFFD}b",
         ] {
-            assert!(
-                matches!(sanitize_for_terminal(s), Cow::Borrowed(_)),
-                "{s:?}"
-            );
-            assert_eq!(sanitize_for_terminal(s), s);
+            assert_eq!(sanitize_string(s), s);
         }
     }
 
     #[test]
     fn strips_osc52_clipboard_payload() {
         let attack = "innocent\x1b]52;c;cHduZWQ=\x1b\\.txt";
-        let safe = sanitize_for_terminal(attack);
+        let safe = sanitize_string(attack);
         assert!(!safe.contains('\x1b'));
         assert_eq!(safe, "innocent\\x1B]52;c;cHduZWQ=\\x1B\\.txt");
     }
 
     #[test]
     fn strips_cr_output_forgery() {
-        assert_eq!(sanitize_for_terminal("A\rFAKE OUTPUT"), "A\\x0DFAKE OUTPUT");
+        assert_eq!(sanitize_string("A\rFAKE OUTPUT"), "A\\x0DFAKE OUTPUT");
     }
 
     #[test]
     fn strips_osc8_hyperlink_injection() {
         let attack = "phish\x1b]8;;https:evil.example\x1b\\phony.txt";
-        assert!(!sanitize_for_terminal(attack).contains('\x1b'));
+        assert!(!sanitize_string(attack).contains('\x1b'));
     }
 
     #[test]
     fn strips_del() {
-        assert_eq!(sanitize_for_terminal("a\x7fb"), "a\\x7Fb");
+        assert_eq!(sanitize_string("a\x7fb"), "a\\x7Fb");
     }
 
     #[test]
     fn strips_bel_and_null() {
-        assert_eq!(sanitize_for_terminal("a\x07b"), "a\\x07b");
-        assert_eq!(sanitize_for_terminal("a\0b"), "a\\x00b");
-    }
-
-    #[test]
-    fn strips_newline() {
-        assert_eq!(sanitize_for_terminal("a\nb"), "a\\x0Ab");
+        assert_eq!(sanitize_string("a\x07b"), "a\\x07b");
+        assert_eq!(sanitize_string("a\0b"), "a\\x00b");
     }
 
     #[test]
     fn escape_preserves_information() {
         let s = "name\x1bX\x07Y.txt";
-        assert_eq!(sanitize_for_terminal(s), "name\\x1BX\\x07Y.txt");
+        assert_eq!(sanitize_string(s), "name\\x1BX\\x07Y.txt");
     }
 
     #[test]
     fn strips_c1_csi_and_osc_ini
```

**File**: `src/walk.rs` (modified, +4/-5)
```diff
@@ -17,7 +17,6 @@ use regex::bytes::Regex;
 
 use crate::config::Config;
 use crate::dir_entry::DirEntry;
-use crate::error::print_error;
 use crate::exec;
 use crate::exit_codes::{ExitCode, merge_exitcodes};
 use crate::filesystem;
@@ -226,7 +225,7 @@ impl<'a, W: Write> ReceiverBuffer<'a, W> {
                         }
                         WorkerResult::Error(err) => {
                             if self.config.show_filesystem_errors {
-                                print_error(err.to_string());
+                                print_error!("{}", err);
                             }
                         }
                     }
@@ -253,7 +252,7 @@ impl<'a, W: Write> ReceiverBuffer<'a, W> {
         if let Err(e) = output::print_entry(&mut self.stdout, entry, self.config)
             && e.kind() != ::std::io::ErrorKind::BrokenPipe
         {
-            print_error(format!("Could not write to output: {e}"));
+            print_error!("Could not write to output: {}", e);
             return Err(ExitCode::GeneralError);
         }
 
@@ -377,7 +376,7 @@ impl WorkerState {
                 match result {
                     Some(ignore::Error::Partial(_)) => (),
                     Some(err) => {
-                        print_error(format!("Malformed pattern in global ignore file. {err}."));
+                        print_error!("Malformed pattern in global ignore file. {}.", err);
                     }
                     None => (),
                 }
@@ -389,7 +388,7 @@ impl WorkerState {
             match result {
                 Some(ignore::Error::Partial(_)) => (),
                 Some(err) => {
-                    print_error(format!("Malformed pattern in custom ignore file. {err}."));
+                    print_error!("Malformed pattern in custom ignore file. {}.", err);
                 }
                 None => (),
             }
```

---

### Incident Patch 6: `b422e5d8` (2026-09-08)
**Commit Message**: fix: allow hyphen-leading --format templates

Clap treated a space-separated --format value that starts with '-' as a
new flag. Enable allow_hyphen_values for --format (same as --and) and
add a regression covering markdown-list-style templates. See #2126.

Signed-off-by: Jason Wang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 -
 
 ## Bugfixes
+- Accept `--format` templates that start with `-` when passed as a separate argument, see #2126 (@vulragrag-star)
 - Don't incorrectly escape newlines in error messages, see #2104
 - Restore jemalloc as default allocator on supported systems
 
```

**File**: `src/cli.rs` (modified, +2/-1)
```diff
@@ -482,7 +482,8 @@ pub struct Opts {
         long,
         value_name = "fmt",
         help = "Print results according to template",
-        conflicts_with = "list_details"
+        conflicts_with = "list_details",
+        allow_hyphen_values = true
     )]
     pub format: Option<String>,
 
```

**File**: `tests/tests.rs` (modified, +11/-0)
```diff
@@ -1755,6 +1755,17 @@ fn format() {
         parent=one/two/three
         parent=one/two/three",
     );
+
+    // Templates may start with '-' (e.g. markdown list items); see #2126.
+    te.assert_output(
+        &["foo", "--format", "- {/.}", "--path-separator=/"],
+        "- a
+        - b
+        - C
+        - c
+        - d
+        - directory_foo",
+    );
 }
 
 /// Shell script execution (--exec)
```

---

### Incident Patch 7: `bb80489e` (2026-09-07)
**Commit Message**: build(deps): bump regex from 1.12.4 to 1.13.1

Bumps [regex](https://github.com/rust-lang/regex) from 1.12.4 to 1.13.1.
- [Release notes](https://github.com/rust-lang/regex/releases)
- [Changelog](https://github.com/rust-lang/regex/blob/master/CHANGELOG.md)
- [Commits](https://github.com/rust-lang/regex/compare/1.12.4...1.13.1)

---
updated-dependencies:
- dependency-name: regex
  dependency-version: 1.13.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -705,9 +705,9 @@ checksum = "f8dcc9c7d52a811697d2151c701e0d08956f92b0e24136cf4cf27b57a6a0d9bf"
 
 [[package]]
 name = "regex"
-version = "1.12.4"
+version = "1.13.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f1292b7759ae1cb9ec195452d1390a074f0cd8541ab7a5a8c31cd6db45d4a6ba"
+checksum = "f020237b6c8eed93db2e2cb53c00c60a8e1bc73da7d073199a1180401450218d"
 dependencies = [
  "aho-corasick",
  "memchr",
```

---

### Incident Patch 8: `bc5a8159` (2026-09-07)
**Commit Message**: build(deps): bump aho-corasick from 1.1.4 to 1.1.5

Bumps [aho-corasick](https://github.com/BurntSushi/aho-corasick) from 1.1.4 to 1.1.5.
- [Commits](https://github.com/BurntSushi/aho-corasick/compare/1.1.4...1.1.5)

---
updated-dependencies:
- dependency-name: aho-corasick
  dependency-version: 1.1.5
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -4,9 +4,9 @@ version = 4
 
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
```

---

### Incident Patch 9: `d9506eb2` (2026-09-01)
**Commit Message**: build(deps): bump ignore from 0.4.31 to 0.4.33

Bumps [ignore](https://github.com/BurntSushi/ripgrep) from 0.4.31 to 0.4.33.
- [Release notes](https://github.com/BurntSushi/ripgrep/releases)
- [Changelog](https://github.com/BurntSushi/ripgrep/blob/master/CHANGELOG.md)
- [Commits](https://github.com/BurntSushi/ripgrep/compare/ignore-0.4.31...ignore-0.4.33)

---
updated-dependencies:
- dependency-name: ignore
  dependency-version: 0.4.33
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -432,9 +432,9 @@ checksum = "3d3067d79b975e8844ca9eb072e16b31c3c1c36928edf9c6789548c524d0d954"
 
 [[package]]
 name = "ignore"
-version = "0.4.31"
+version = "0.4.33"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7f8a7b8211e695a1d0cd91cace480d4d0bd57667ab10277cc412c5f7f4884f83"
+checksum = "00b69833ed729dc5aa7d19541d96d6cf8e9137194207a04916d658e43168402f"
 dependencies = [
  "crossbeam-deque",
  "globset",
@@ -717,9 +717,9 @@ dependencies = [
 
 [[package]]
 name = "regex-automata"
-version = "0.4.14"
+version = "0.4.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6e1dd4122fc1595e8162618945476892eefca7b88c52820e74af6262213cae8f"
+checksum = "ad8553b9b26413251cbf30e620595c7a41b3887f03da04579c0e6b0d6a06b4b2"
 dependencies = [
  "aho-corasick",
  "memchr",
```

---

### Incident Patch 10: `d6040b6b` (2026-09-01)
**Commit Message**: build(deps): bump jiff from 0.2.29 to 0.2.35

Bumps [jiff](https://github.com/BurntSushi/jiff) from 0.2.29 to 0.2.35.
- [Release notes](https://github.com/BurntSushi/jiff/releases)
- [Changelog](https://github.com/BurntSushi/jiff/blob/master/CHANGELOG.md)
- [Commits](https://github.com/BurntSushi/jiff/compare/jiff-static-0.2.29...jiff-static-0.2.35)

---
updated-dependencies:
- dependency-name: jiff
  dependency-version: 0.2.35
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +15/-4)
```diff
@@ -472,11 +472,12 @@ checksum = "92ecc6618181def0457392ccd0ee51198e065e016d1d527a7ac1b6dc7c1f09d2"
 
 [[package]]
 name = "jiff"
-version = "0.2.29"
+version = "0.2.35"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "34f877a98676d2fb664698d74cc6a51ce6c484ce8c770f05d0108ec9090aeb46"
+checksum = "668b7183bd07af9a4885f5c35b0cc5c83c4607a913c16b7e17291832910d2dcc"
 dependencies = [
  "defmt",
+ "jiff-core",
  "jiff-static",
  "jiff-tzdb-platform",
  "log",
@@ -486,12 +487,22 @@ dependencies = [
  "windows-link",
 ]
 
+[[package]]
+name = "jiff-core"
+version = "0.1.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7feca88439efe53da3754500c1851dedf3cb36c524dd5cf8225cc0794de95d09"
+dependencies = [
+ "defmt",
+]
+
 [[package]]
 name = "jiff-static"
-version = "0.2.29"
+version = "0.2.35"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0666b5ab5ecaca213fc2a85b8c0083d9004e84ee2d5f9a7e0017aaf50986f25f"
+checksum = "3a69dcb3a21cfb32ce1cd056169337ca284af0766dd766e7878819b251a49204"
 dependencies = [
+ "jiff-core",
  "proc-macro2",
  "quote",
  "syn",
```

---

### Incident Patch 11: `1765d081` (2026-08-28)
**Commit Message**: fix: Re-enable jemalloc by default

The "use-jemalloc" feature was accidentally removed from the default
features in 92c54d37c0a3425b4d8b25dd8c9e4ddbbecfbe0a.

This turns it back on.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
 
 ## Bugfixes
 - Don't incorrectly escape newlines in error messages, see #2104
+- Restore jemalloc as default allocator on supported systems
 
 # 10.5.0
 
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ codegen-units = 1
 use-jemalloc = ["tikv-jemallocator"]
 completions = ["clap_complete"]
 base = ["use-jemalloc"]
-default = ["completions"]
+default = ["use-jemalloc", "completions"]
 
 [package.metadata.binstall]
 pkg-url = "{ repo }/releases/download/v{ version }/{ name }-v{ version }-{ target }.{ archive-format }"
```

---

### Incident Patch 12: `1e07fcb7` (2026-09-02)
**Commit Message**: Merge pull request #2106 from tmccombs/fix-error-newlines

fix: don't sanitize error message

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 -
 
 ## Bugfixes
--
+- Don't incorrectly escape newlines in error messages, see #2104
 
 # 10.5.0
 
```

**File**: `src/error.rs` (modified, +2/-8)
```diff
@@ -1,9 +1,3 @@
-use std::io::IsTerminal;
-
-use crate::sanitize::maybe_sanitize;
-
-pub fn print_error(msg: impl Into<String>) {
-    let msg = msg.into();
-    let safe = maybe_sanitize(&msg, std::io::stderr().is_terminal());
-    eprintln!("[fd error]: {safe}");
+pub fn print_error(msg: impl std::fmt::Display) {
+    eprintln!("[fd error]: {msg}");
 }
```

---

### Incident Patch 13: `a3942dbb` (2026-08-28)
**Commit Message**: fix: don't sanitize error message

Calling `maybe_sanitize` on error messages results in newlines getting
replaced with "\x0a". This is not desirable for error messages that have
newlines.

I audited everwhere we construct an error, and call print_error and
confirmed that none of those places have inputs that include found
paths. I'm not too worried about inputs that come from command line
arguments.

This bug was introduced in 92c54d37c0a3425b4d8b25dd8c9e4ddbbecfbe0a.

Fixes: #2104

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 -
 
 ## Bugfixes
--
+- Don't incorrectly escape newlines in error messages, see #2104
 
 # 10.5.0
 
```

**File**: `src/error.rs` (modified, +2/-8)
```diff
@@ -1,9 +1,3 @@
-use std::io::IsTerminal;
-
-use crate::sanitize::maybe_sanitize;
-
-pub fn print_error(msg: impl Into<String>) {
-    let msg = msg.into();
-    let safe = maybe_sanitize(&msg, std::io::stderr().is_terminal());
-    eprintln!("[fd error]: {safe}");
+pub fn print_error(msg: impl std::fmt::Display) {
+    eprintln!("[fd error]: {msg}");
 }
```

---

### Incident Patch 14: `711ba7fe` (2026-08-26)
**Commit Message**: chore: Buimp to version 10.5.0

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ checksum = "37909eebbb50d72f9059c3b6d82c0463f2ff062c9e95845c43a6c9c0355411be"
 
 [[package]]
 name = "fd-find"
-version = "10.4.2"
+version = "10.5.0"
 dependencies = [
  "aho-corasick",
  "anyhow",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ license = "MIT OR Apache-2.0"
 name = "fd-find"
 readme = "README.md"
 repository = "https://github.com/sharkdp/fd"
-version = "10.4.2"
+version = "10.5.0"
 edition= "2024"
 rust-version = "1.90.0"
 
```

---

### Incident Patch 15: `c276ac79` (2026-03-25)
**Commit Message**: build: Create archive script

Move the code for creating the archive from the GHA yaml into a
dedicated script file.

**File**: `.github/workflows/CICD.yml` (modified, +4/-36)
```diff
@@ -205,44 +205,12 @@ jobs:
     - name: Create tarball
       id: package
       shell: bash
+      run: bash scripts/create-archive.sh
       env:
         BIN_PATH: ${{ steps.bin.outputs.BIN_PATH }}
-        version: ${{ needs.crate_metadata.outputs.version }}
-      run: |
-        PKG_suffix=".tar.gz"
-        case ${target} in
-        *-pc-windows-*) PKG_suffix=".zip" ;;
-        esac
-        PKG_BASENAME=${name}-v${version}-${target}
-        PKG_NAME=${PKG_BASENAME}${PKG_suffix}
-        echo "PKG_NAME=${PKG_NAME}" >> $GITHUB_OUTPUT
-
-        PKG_STAGING="${CICD_INTERMEDIATES_DIR}/package"
-        ARCHIVE_DIR="${PKG_STAGING}/${PKG_BASENAME}/"
-        mkdir -p "${ARCHIVE_DIR}"
-
-        # Binary
-        cp "${BIN_PATH}" "$ARCHIVE_DIR"
-
-        # README, LICENSE and CHANGELOG files
-        cp "README.md" "LICENSE-MIT" "LICENSE-APACHE" "CHANGELOG.md" "$ARCHIVE_DIR"
-
-        # Man page
-        cp "doc/${name}.1" "$ARCHIVE_DIR"
-
-        # Autocompletion files
-        cp -r autocomplete "${ARCHIVE_DIR}"
-
-        # base compressed package
-        pushd "${PKG_STAGING}/" >/dev/null
-        case ${target} in
-          *-pc-windows-*) 7z -y a "${PKG_NAME}" "${PKG_BASENAME}"/* | tail -2 ;;
-          *) tar czf "${PKG_NAME}" "${PKG_BASENAME}"/* ;;
-        esac;
-        popd >/dev/null
-
-        # Let subsequent steps know where to find the compressed package
-        echo "PKG_PATH=${PKG_STAGING}/${PKG_NAME}" >> $GITHUB_OUTPUT
+        TARGET: ${{ env.target }}
+        ARCHIVE_NAME: ${{ env.name }}-v${{ needs.crate_metadata.outputs.version }}-${{ env.target }}
+        PKG_STAGING: "${{ env.CICD_INTERMEDIATES_DIR }}/package"
 
     - name: Create Debian package
       id: debian-package
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
 target/
 /autocomplete/
+/package/
 **/*.rs.bk
```

**File**: `Makefile` (modified, +13/-1)
```diff
@@ -1,9 +1,16 @@
-PROFILE=release
+PROFILE?=release
 EXE=target/$(PROFILE)/fd
 prefix=/usr/local
 bindir=$(prefix)/bin
 datadir=$(prefix)/share
 exe_name=fd
+ifdef VERSION
+	ARCHIVE_NAME = fd-v$(VERSION)
+else
+	ARCHIVE_NAME = fd
+endif
+export ARCHIVE_NAME
+archive_path=package/$(ARCHIVE_NAME).tar.gz
 
 $(EXE): Cargo.toml src/**/*.rs
 	cargo build --profile $(PROFILE) --locked
@@ -41,6 +48,11 @@ autocomplete/fdfind.fish: contrib/completion/fdfind.fish
 	$(comp_dir)
 	cp $< $@
 
+archive: $(archive_path)
+
+$(archive_path): completions $(EXE)
+	bash scripts/create-archive.sh
+
 install: $(EXE) completions
 	install -Dm755 $(EXE) $(DESTDIR)$(bindir)/fd
 	install -Dm644 autocomplete/fd.bash $(DESTDIR)/$(datadir)/bash-completion/completions/$(exe_name)
```

**File**: `scripts/create-archive.sh` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+#!/bin/bash
+#
+# Create a .tar.gz archive of the fd project for distribution
+#
+# Expected environment variables:
+#
+# TARGET: rust target to publish. Defaults to default rustc target
+# BIN_PATH: path to fd binary
+# PKG_STAGING: directory to use for staging files to include in the archive
+# ARCHIVE_NAME: Name of output file, minus extension, defaults to "fd" with a version appended
+#   if VERSION is specified
+# VERSION: version to publish
+# GITHUB_OUTPUT: file to store github output variables in
+
+if [[ -z "$TARGET" ]]; then
+  TARGET="$(rustc -vV | sed -n 's/host: //p')"
+fi
+
+PKG_suffix=".tar.gz"
+EXE_suffix=""
+case ${TARGET} in
+*-pc-windows-*)
+  PKG_suffix=".zip"
+  EXE_suffix=".exe"
+  ;;
+esac
+
+if [[ -z $BIN_PATH ]]; then
+  BIN_PATH=target/${PROFILE:-release}/fd
+fi
+
+if [[ -z "$ARCHIVE_NAME" ]]; then
+  ARCHIVE_NAME=fd
+  [[ -n "$VERSION" ]] && ARCHIVE_NAME+="-v$VERSION"
+fi
+
+PKG_NAME=${ARCHIVE_NAME}${PKG_suffix}
+
+staging_dir="${PKG_STAGING:-package}"
+ARCHIVE_DIR="${staging_dir}/${ARCHIVE_NAME}/"
+mkdir -p "${ARCHIVE_DIR}"
+
+# Binary
+cp "${BIN_PATH}" "$ARCHIVE_DIR"
+
+# README, LICENSE and CHANGELOG files
+cp "README.md" "LICENSE-MIT" "LICENSE-APACHE" "CHANGELOG.md" "$ARCHIVE_DIR"
+
+# Man page
+cp "doc/fd.1" "$ARCHIVE_DIR"
+
+# Autocompletion files
+cp -r autocomplete "${ARCHIVE_DIR}"
+
+# base compressed package
+pushd "${staging_dir}/" >/dev/null
+case ${TARGET} in
+*-pc-windows-*) 7z -y a "${PKG_NAME}" "${ARCHIVE_NAME}"/* | tail -2 ;;
+*) tar czf "${PKG_NAME}" "${ARCHIVE_NAME}"/* ;;
+esac;
+popd >/dev/null
+
+if [[ -n "$GITHUB_OUTPUT" ]]; then
+  echo "PKG_NAME=${PKG_NAME}" >> $GITHUB_OUTPUT
+  # Let subsequent steps know where to find the compressed package
+  echo "PKG_PATH=${PKG_STAGING}/${PKG_NAME}" >> $GITHUB_OUTPUT
+fi
```

#### Recent Merged Pull Requests:
- **PR #2148** (2026-10-03): build(deps): bump crossbeam-channel from 0.5.16 to 0.5.17 (@dependabot[bot])
- **PR #2143** (2026-10-05): refactor: Avoid depending on ignore implementation detail (@tmccombs)
- **PR #2141** (2026-09-24): Fix test failures on Windows when GNU tools are missing (@mrhard9090)
- **PR #2140** (closed): fix: honor --min-depth for broken symlinks with -L (@MeowdyAGENT)
- **PR #2135** (2026-09-15): fix: Better sanitizing (@tmccombs)
- **PR #2133** (2026-09-16): docs(exec): clarify command ordering and output grouping for -x/--exec (@pederbe)
- **PR #2132** (closed): fix: sanitize control characters in error messages again (@jabrailkhalil)
- **PR #2127** (2026-09-09): fix: allow hyphen-leading --format templates (@vulragrag-star)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
