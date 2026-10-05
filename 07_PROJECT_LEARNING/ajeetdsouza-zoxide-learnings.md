# Forensic Learning Record (Deep Inspection): ajeetdsouza/zoxide

> **Canonical Artifact**: `07_PROJECT_LEARNING/ajeetdsouza-zoxide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ajeetdsouza/zoxide](https://github.com/ajeetdsouza/zoxide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:34:12.207Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ajeetdsouza/zoxide`
- **Description**: A smarter cd command. Supports all major shells.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 39890 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/util.rs`
```
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::SystemTime;
use std::{env, mem};

#[cfg(windows)]
use anyhow::anyhow;
use anyhow::{Context, Result, bail};

use crate::db::{Dir, Epoch};
use crate::error::SilentExit;

pub const SECOND: Epoch = 1;
pub const MINUTE: Epoch = 60 * SECOND;
pub const HOUR: Epoch = 60 * MINUTE;
pub const DAY: Epoch = 24 * HOUR;
pub const WEEK: Epoch = 7 * DAY;
pub const MONTH: Epoch = 30 * DAY;

pub struct Fzf(Command);

impl Fzf {
    const ERR_FZF_NOT_FOUND: &'static str = "could not find fzf, is it installed?";

    pub fn new() -> Result<Self> {
        // On Windows, CreateProcess implicitly searches the current working
        // directory for the executable, which is a potential security issue.
        // Instead, we resolve the path to the executable and then pass it to
        // CreateProcess.
        #[cfg(windows)]
        let program = which::which("fzf.exe").map_err(|_| anyhow!(Self::ERR_FZF_NOT_FOUND))?;
        #[cfg(not(windows))]
        let program = "fzf";

        // TODO: check version of fzf here.

        let mut cmd = Command::new(program);
        cmd.args([
            // Search mode
            "--delimiter=\t",
            "--nth=2",
            // Scripting
            "--read0",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped());

        Ok(Fzf(cmd))
    }

    pub fn enable_preview(&mut self) -> &mut Self {
        // Previews are only supported on UNIX.
        if !cfg!(unix) {
            return self;
        }

        self.args([
            // Non-POSIX args are only available on certain operating systems.
            if cfg!(target_os = "linux") {
                r"--preview=\command -p ls -Cp --color=always --group-directories-first {2..}"
            } else {
                r"--preview=\command -p ls -Cp {2..}"
            },
            // Rounded edges don't display correctly on some terminals.
            "--preview-window=down,30%,sharp",
        ])
        .envs([
            // Enables colorized `ls` output on macOS / FreeBSD.
            ("CLICOLOR", "1"),
            // Forces colorized `ls` output when the output is not a
            // TTY (like in fzf's preview window) on macOS /
            // FreeBSD.
            ("CLICOLOR_FORCE", "1"),
            // Ensures that the preview command is run in a
            // POSIX-compliant shell, regardless of what shell the
            // user has selected.
            ("SHELL", "sh"),
        ])
    }

    pub fn args<I, S>(&mut self, args: I) -> &mut Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        self.0.args(args);
        self
    }

    pub fn env<K, V>(&mut self, key: K, val: V) -> &mut Self
    where
        K: AsRef<OsStr>,
        V: AsRef<OsStr>,
    {
        self.0.env(key, val);
        self
    }

    pub fn envs<I, K, V>(&mut self, vars: I) -> &mut Self
    where
        I: IntoIterator<Item = (K, V)>,
        K: AsRef<OsStr>,
        V: AsRef<OsStr>,
    {
        self.0.envs(vars);
        self
    }

    pub fn spawn(&mut self) -> Result<FzfChild> {
        match self.0.spawn() {
            Ok(child) => Ok(FzfChild(child)),
            Err(e) if e.kind() == io::ErrorKind::NotFound => bail!(Self::ERR_FZF_NOT_FOUND),
            Err(e) => Err(e).context("could not launch fzf"),
        }
    }
}

pub struct FzfChild(Child);

impl FzfChild {
    pub fn write(&mut self, dir: &Dir, now: Epoch) -> Result<Option<String>> {
        let handle = self.0.stdin.as_mut().unwrap();
        match write!(handle, "{}\0", dir.display().with_score(now).with_separator('\t')) {
            Ok(()) => Ok(None),
            Err(e) if e.kind() == io::ErrorKind::BrokenPipe => self.wait().map(Some),
            Err(e) => Err(e).context("could not write to fzf"),
        }
    }

    pub fn wait(&mut self) -> Result<String> {
        // Drop stdin to prevent deadlock.
        mem::drop(self.0.stdin.take());

        let mut stdout = self.0.stdout.take().unwrap();
        let mut output = String::new();
        stdout.read_to_string(&mut output).context("failed to read from fzf")?;

        let status = self.0.wait().context("wait failed on fzf")?;
        match status.code() {
            Some(0) => Ok(output),
            Some(1) => bail!("no match found"),
            Some(2) => bail!("fzf returned an error"),
            Some(130) => bail!(SilentExit { code: 130 }),
            Some(128..=254) | None => bail!("fzf was terminated"),
            _ => bail!("fzf returned an unknown error"),
        }
    }
}

/// Similar to [`fs::write`], but atomic (best effort on Windows).
pub fn write(path: impl AsRef<Path>, contents: impl AsRef<[u8]>) -> Result<()> {
    let path = path.as_ref();
    let contents = contents.as_ref();
    let dir = path.parent().unwrap();

    // Create a tmpfile.
    let (mut tmp_file, tmp_path) = tmpfile(dir)?;
    let result = (|| {
        // Write to the tmpfile.
        _ = tmp_file.set_len(contents.len() as u64);
        tmp_file
            .write_all(contents)
            .with_context(|| format!("could not write to file: {}", tmp_path.display()))?;

        // Set the owner of the tmpfile (UNIX only).
        #[cfg(unix)]
        if let Ok(metadata) = path.metadata() {
            use std::os::unix::fs::{MetadataExt, fchown};

            _ = fchown(&tmp_file, Some(metadata.uid()), Some(metadata.gid()));
        }

        // Close and rename the tmpfile.
        // In some cases, errors from the last write() are reported only on close().
        // Rust ignores errors from close(), since it occurs inside `Drop`. To
        // catch these errors, we manually call `File::sync_all()` first.
        tmp_file
            .sync_all()
            .with_context(|| format!("could not sync writes to file: {}", tmp_path.display()))?;
        mem::drop(tmp_file);
        rename(&tmp_path, path)
    })();
    // In case of an error, delete the tmpfile.
    if result.is_err() {
        _ = fs::remove_file(&tmp_path);
    }
    result
}

/// Atomically create a tmpfile in the given directory.
fn tmpfile(dir: impl AsRef<Path>) -> Result<(File, PathBuf)> {
    const MAX_ATTEMPTS: usize = 5;
    const TMP_NAME_LEN: usize = 16;
    let dir = dir.as_ref();

    let mut attempts = 0;
    loop {
        attempts += 1;

        // Generate a random name for the tmpfile.
        let mut name = String::with_capacity(TMP_NAME_LEN);
        name.push_str("tmp_");
        while name.len() < TMP_NAME_LEN {
            name.push(fastrand::alphanumeric());
        }
        let path = dir.join(name);

        // Atomically create the tmpfile.
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => break Ok((file, path)),
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists && attempts < MAX_ATTEMPTS => {}
            Err(e) => {
                break Err(e).with_context(|| format!("could not create file: {}", path.display()));
            }
        }
    }
}

/// Similar to [`fs::rename`], but with retries on Windows.
fn rename(from: impl AsRef<Path>, to: impl AsRef<Path>) -> Result<()> {
    let from = from.as_ref();
    let to = to.as_ref();

    const MAX_ATTEMPTS: usize = if cfg!(windows) { 5 } else { 1 };
    let mut attempts = 0;

    loop {
        match fs::rename(from, to) {
            Err(e) if e.kind() == io::ErrorKind::PermissionDenied && attempts < MAX_ATTEMPTS => {
                attempts += 1
            }
            result => {
                break result.with_context(|| {
                    format!("could not rename file: {} -> {}", from.display(), to.display())
                });
            }
        }
    }
}

pub fn canonicalize(path: impl AsRef<Path>) -> Result<PathBuf> {
    dunce::canonicalize(&path)
        .with_context(|| format!("could not resolve path: {}", path.as_ref().display()))
}

pub fn current_dir() -> Result<PathBuf> {
    env::current_dir().context("could not get current directory")
}

pub fn current_time() -> Result<Epoch> {
    let current_time = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .context("system clock set to invalid time")?
        .as_secs();

    Ok(current_time)
}

pub fn path_to_str(path: &impl AsRef<Path>) -> Result<&str> {
    let path = path.as_ref();
    path.to_str().with_context(|| format!("invalid unicode in path: {}", path.display()))
}

/// Returns the absolute version of a path. Like
/// [`std::path::Path::canonicalize`], but doesn't resolve symlinks.
pub fn resolve_path(path: impl AsRef<Path>) -> Result<PathBuf> {
    let path = path.as_ref();
    let base_path;

    let mut components = path.components().peekable();
    let mut stack = Vec::new();

    // initialize root
    if cfg!(windows) {
        use std::path::Prefix;

        fn get_drive_letter(path: impl AsRef<Path>) -> Option<u8> {
            let path = path.as_ref();
            let mut components = path.components();

            match components.next() {
                Some(Component::Prefix(prefix)) => match prefix.kind() {
                    Prefix::Disk(drive_letter) | Prefix::VerbatimDisk(drive_letter) => {
                        Some(drive_letter)
                    }
                    _ => None,
                },
                _ => None,
            }
        }

        fn get_drive_path(drive_letter: u8) -> PathBuf {
            format!(r"{}:\", drive_letter as char).into()
        }

        fn get_drive_relative(drive_letter: u8) -> Result<PathBuf> {
            let path = current_dir()?;
            if Some(drive_letter) == get_drive_letter(&path) {
                return Ok(path);
            }

            if let Some(path) = env::var_os(format!("={}:", drive_letter as char)) {
                return Ok(path.into());
            }

            let path = 
```

### Core Architecture Module: `contrib/completions/zoxide.ts`
```
const completion: Fig.Spec = {
  name: "zoxide",
  description: "A smarter cd command for your terminal",
  subcommands: [
    {
      name: "add",
      description: "Add a new directory or increment its rank",
      options: [
        {
          name: ["-s", "--score"],
          description: "The rank to increment the entry if it exists or initialize it with if it doesn't",
          isRepeatable: true,
          args: {
            name: "score",
            isOptional: true,
          },
        },
        {
          name: ["-h", "--help"],
          description: "Print help",
        },
        {
          name: ["-V", "--version"],
          description: "Print version",
        },
      ],
      args: {
        name: "paths",
        isVariadic: true,
        template: "folders",
      },
    },
    {
      name: "edit",
      description: "Edit the database",
      subcommands: [
        {
          name: "decrement",
          hidden: true,
          options: [
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
          args: {
            name: "path",
          },
        },
        {
          name: "delete",
          hidden: true,
          options: [
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
          args: {
            name: "path",
          },
        },
        {
          name: "increment",
          hidden: true,
          options: [
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
          args: {
            name: "path",
          },
        },
        {
          name: "reload",
          hidden: true,
          options: [
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
        },
      ],
      options: [
        {
          name: ["-h", "--help"],
          description: "Print help",
        },
        {
          name: ["-V", "--version"],
          description: "Print version",
        },
      ],
    },
    {
      name: "import",
      description: "Import entries from another application",
      subcommands: [
        {
          name: "atuin",
          description: "Import from atuin",
          options: [
            {
              name: "--merge",
              description: "Merge into existing database",
            },
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
        },
        {
          name: "autojump",
          description: "Import from autojump",
          options: [
            {
              name: "--merge",
              description: "Merge into existing database",
            },
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
        },
        {
          name: "fasd",
          description: "Import from fasd",
          options: [
            {
              name: "--merge",
              description: "Merge into existing database",
            },
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
        },
        {
          name: "z",
          description: "Import from z",
          options: [
            {
              name: "--merge",
              description: "Merge into existing database",
            },
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
        },
        {
          name: "z.lua",
          description: "Import from z.lua",
          options: [
            {
              name: "--merge",
              description: "Merge into existing database",
            },
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
        },
        {
          name: "zsh-z",
          description: "Import from zsh-z",
          options: [
            {
              name: "--merge",
              description: "Merge into existing database",
            },
            {
              name: ["-h", "--help"],
              description: "Print help",
            },
            {
              name: ["-V", "--version"],
              description: "Print version",
            },
          ],
        },
      ],
      options: [
        {
          name: "--merge",
          description: "Merge into existing database",
        },
        {
          name: ["-h", "--help"],
          description: "Print help",
        },
        {
          name: ["-V", "--version"],
          description: "Print version",
        },
      ],
    },
    {
      name: "init",
      description: "Generate shell configuration",
      options: [
        {
          name: "--cmd",
          description: "Changes the prefix of the `z` and `zi` commands",
          isRepeatable: true,
          args: {
            name: "cmd",
            isOptional: true,
          },
        },
        {
          name: "--hook",
          description: "Changes how often zoxide increments a directory's score",
          isRepeatable: true,
          args: {
            name: "hook",
            isOptional: true,
            suggestions: [
              "none",
              "prompt",
              "pwd",
            ],
          },
        },
        {
          name: "--no-cmd",
          description: "Prevents zoxide from defining the `z` and `zi` commands",
        },
        {
          name: ["-h", "--help"],
          description: "Print help",
        },
        {
          name: ["-V", "--version"],
          description: "Print version",
        },
      ],
      args: {
        name: "shell",
        suggestions: [
          "bash",
          "elvish",
          "fish",
          "nushell",
          "posix",
          "powershell",
          "tcsh",
          "xonsh",
          "zsh",
        ],
      },
    },
    {
      name: "query",
      description: "Search for a directory in the database",
      options: [
        {
          name: "--exclude",
          description: "Exclude the current directory",
          isRepeatable: true,
          args: {
            name: "exclude",
            isOptional: true,
            template: "folders",
          },
        },
        {
          name: "--base-dir",
          description: "Only search within this directory",
          isRepeatable: true,
          args: {
            name: "base_dir",
            isOptional: true,
            template: "folders",
          },
        },
        {
          name: ["-a", "--all"],
          description: "Show unavailable directories",
        },
        {
          name: ["-i", "--interactive"],
          description: "Use interactive selection",
          exclusiveOn: [
            "-l",
            "--list",
          ],
        },
        {
          name: ["-l", "--list"],
          description: "List all matching directories",
          exclusiveOn: [
            "-i",
            "--interactive",
          ],
        },
        {
          name: ["-s", "--score"],
          description: "Print score with results",
        },
        {
          name: ["-h", "--help"],
          description: "Print help",
        },
        {
          name: ["-V", "--version"],
          description: "Print version",
        },
      ],
      args: {
        name: "keywords",
        isVariadic: true,
        isOptional: true,
      },
    },
    {
      name: "remove",
      description: "Remove a directory from the database",
      options: [
        {
          name: ["-h", "--help"],
          description: "Print help",
        },
        {
          name: ["-V", "--version"],
          description: "Print version",
        },
      ],
      args: {
        name: "paths",
        isVariadic: true,
        isOptional: true,
        template: "folders",
      },
    },
  ],
  options: [
    {
      name: ["-h", "--help"],
      description: "Print help",
    },
    {
      name: ["-V", "--version"],
      description: "Print version",
    },
  ],
};

export default completion;

```

### Core Architecture Module: `src/cmd/add.rs`
```
use std::path::Path;

use anyhow::{Result, bail};

use crate::cmd::{Add, Run};
use crate::db::Database;
use crate::{config, util};

impl Run for Add {
    fn run(&self) -> Result<()> {
        // These characters can't be printed cleanly to a single line, so they can cause
        // confusion when writing to stdout.
        const EXCLUDE_CHARS: &[char] = &['\n', '\r'];

        let exclude_dirs = config::exclude_dirs()?;
        let max_age = config::maxage()?;
        let now = util::current_time()?;

        let mut db = Database::open()?;

        for path in &self.paths {
            let path =
                if config::resolve_symlinks() { util::canonicalize } else { util::resolve_path }(
                    path,
                )?;
            let path = util::path_to_str(&path)?;

            // Ignore path if it contains unsupported characters, or if it's in the exclude
            // list.
            if path.contains(EXCLUDE_CHARS) || exclude_dirs.iter().any(|glob| glob.matches(path)) {
                continue;
            }
            if !Path::new(path).is_dir() {
                bail!("not a directory: {path}");
            }

            let by = self.score.unwrap_or(1.0);
            db.add_update(path, by, now);
        }

        if db.dirty() {
            db.age(max_age);
        }
        db.save()
    }
}

```

### Core Architecture Module: `src/cmd/cmd.rs`
```
#![allow(clippy::module_inception)]

use std::path::PathBuf;

use clap::builder::{IntoResettable, Resettable, StyledStr};
use clap::{Parser, Subcommand, ValueEnum, ValueHint};

struct HelpTemplate;

impl IntoResettable<StyledStr> for HelpTemplate {
    fn into_resettable(self) -> Resettable<StyledStr> {
        color_print::cstr!("\
{before-help}<bold><underline>{name} {version}</underline></bold>
{author}
https://github.com/ajeetdsouza/zoxide

{about}

{usage-heading}
{tab}{usage}

{all-args}{after-help}

<bold><underline>Environment variables:</underline></bold>
{tab}<bold>_ZO_DATA_DIR</bold>        {tab}Path for zoxide data files
{tab}<bold>_ZO_ECHO</bold>            {tab}Print the matched directory before navigating to it when set to 1
{tab}<bold>_ZO_EXCLUDE_DIRS</bold>    {tab}List of directory globs to be excluded
{tab}<bold>_ZO_FZF_OPTS</bold>        {tab}Custom flags to pass to fzf
{tab}<bold>_ZO_MAXAGE</bold>          {tab}Maximum total age after which entries start getting deleted
{tab}<bold>_ZO_RESOLVE_SYMLINKS</bold>{tab}Resolve symlinks when storing paths").into_resettable()
    }
}

#[derive(Debug, Parser)]
#[clap(
    about,
    author,
    help_template = HelpTemplate,
    disable_help_subcommand = true,
    propagate_version = true,
    version,
)]
pub enum Cmd {
    Add(Add),
    Edit(Edit),
    Import(Import),
    Init(Init),
    Query(Query),
    Remove(Remove),
}

/// Add a new directory or increment its rank
#[derive(Debug, Parser)]
#[clap(
    author,
    help_template = HelpTemplate,
)]
pub struct Add {
    #[clap(num_args = 1.., required = true, value_hint = ValueHint::DirPath)]
    pub paths: Vec<PathBuf>,

    /// The rank to increment the entry if it exists or initialize it with if it
    /// doesn't
    #[clap(short, long)]
    pub score: Option<f64>,
}

/// Edit the database
#[derive(Debug, Parser)]
#[clap(
    author,
    help_template = HelpTemplate,
)]
pub struct Edit {
    #[clap(subcommand)]
    pub cmd: Option<EditCommand>,
}

#[derive(Clone, Debug, Subcommand)]
pub enum EditCommand {
    #[clap(hide = true)]
    Decrement { path: String },
    #[clap(hide = true)]
    Delete { path: String },
    #[clap(hide = true)]
    Increment { path: String },
    #[clap(hide = true)]
    Reload,
}

/// Import entries from another application
#[derive(Debug, Parser)]
#[clap(
    author,
    help_template = HelpTemplate,
)]
pub struct Import {
    #[clap(subcommand)]
    pub from: ImportFrom,

    /// Merge into existing database
    #[clap(long, global = true)]
    pub merge: bool,
}

#[derive(Subcommand, Clone, Debug)]
pub enum ImportFrom {
    /// Import from atuin
    Atuin,
    /// Import from autojump
    Autojump,
    /// Import from fasd
    Fasd,
    /// Import from z
    Z,
    /// Import from z.lua
    #[clap(name = "z.lua")]
    ZLua,
    /// Import from zsh-z
    #[clap(name = "zsh-z")]
    ZshZ,
}

/// Generate shell configuration
#[derive(Debug, Parser)]
#[clap(
    author,
    help_template = HelpTemplate,
)]
pub struct Init {
    #[clap(value_enum)]
    pub shell: InitShell,

    /// Prevents zoxide from defining the `z` and `zi` commands
    #[clap(long, alias = "no-aliases")]
    pub no_cmd: bool,

    /// Changes the prefix of the `z` and `zi` commands
    #[clap(long, default_value = "z")]
    pub cmd: String,

    /// Changes how often zoxide increments a directory's score
    #[clap(value_enum, long, default_value = "pwd")]
    pub hook: InitHook,
}

#[derive(ValueEnum, Clone, Copy, Debug, Eq, PartialEq)]
pub enum InitHook {
    None,
    Prompt,
    Pwd,
}

#[derive(ValueEnum, Clone, Debug)]
pub enum InitShell {
    Bash,
    Elvish,
    Fish,
    Nushell,
    #[clap(alias = "ksh")]
    Posix,
    Powershell,
    Tcsh,
    Xonsh,
    Zsh,
}

/// Search for a directory in the database
#[derive(Debug, Parser)]
#[clap(
    author,
    help_template = HelpTemplate,
)]
pub struct Query {
    pub keywords: Vec<String>,

    /// Show unavailable directories
    #[clap(long, short)]
    pub all: bool,

    /// Use interactive selection
    #[clap(long, short, conflicts_with = "list")]
    pub interactive: bool,

    /// List all matching directories
    #[clap(long, short, conflicts_with = "interactive")]
    pub list: bool,

    /// Print score with results
    #[clap(long, short)]
    pub score: bool,

    /// Exclude the current directory
    #[clap(long, value_hint = ValueHint::DirPath, value_name = "path")]
    pub exclude: Option<String>,

    /// Only search within this directory
    #[clap(long, value_hint = ValueHint::DirPath, value_name = "path")]
    pub base_dir: Option<String>,
}

/// Remove a directory from the database
#[derive(Debug, Parser)]
#[clap(
    author,
    help_template = HelpTemplate,
)]
pub struct Remove {
    #[clap(value_hint = ValueHint::DirPath)]
    pub paths: Vec<String>,
}

```

### Core Architecture Module: `src/cmd/edit.rs`
```
use std::io::{self, Write};

use anyhow::Result;

use crate::cmd::{Edit, EditCommand, Run};
use crate::db::Database;
use crate::error::BrokenPipeHandler;
use crate::util::{self, Fzf, FzfChild};

impl Run for Edit {
    fn run(&self) -> Result<()> {
        let now = util::current_time()?;
        let db = &mut Database::open()?;

        match &self.cmd {
            Some(cmd) => {
                match cmd {
                    EditCommand::Decrement { path } => db.add(path, -1.0, now),
                    EditCommand::Delete { path } => {
                        db.remove(path);
                    }
                    EditCommand::Increment { path } => db.add(path, 1.0, now),
                    EditCommand::Reload => {}
                }
                db.save()?;

                let stdout = &mut io::stdout().lock();
                for dir in db.dirs().iter().rev() {
                    write!(stdout, "{}\0", dir.display().with_score(now).with_separator('\t'))
                        .pipe_exit("fzf")?;
                }
                Ok(())
            }
            None => {
                db.sort_by_score(now);
                db.save()?;
                Self::get_fzf()?.wait()?;
                Ok(())
            }
        }
    }
}

impl Edit {
    fn get_fzf() -> Result<FzfChild> {
        Fzf::new()?
            .args([
                // Search mode
                "--exact",
                // Search result
                "--no-sort",
                // Interface
                "--bind=\
btab:up,\
ctrl-r:reload(zoxide edit reload),\
ctrl-d:reload(zoxide edit delete {2..}),\
ctrl-w:reload(zoxide edit increment {2..}),\
ctrl-s:reload(zoxide edit decrement {2..}),\
ctrl-z:ignore,\
double-click:ignore,\
enter:abort,\
start:reload(zoxide edit reload),\
tab:down",
                "--cycle",
                "--keep-right",
                // Layout
                "--border=sharp",
                "--border-label=  zoxide-edit  ",
                "--header=\
ctrl-r:reload   \tctrl-d:delete
ctrl-w:increment\tctrl-s:decrement

 SCORE\tPATH",
                "--info=inline",
                "--layout=reverse",
                "--padding=1,0,0,0",
                // Display
                "--color=label:bold",
                "--tabstop=1",
            ])
            .enable_preview()
            .spawn()
    }
}

```

### Core Architecture Module: `src/cmd/import.rs`
```
use anyhow::{Result, bail};

use crate::cmd::{Import, ImportFrom, Run};
use crate::db::Database;
use crate::import;

impl Run for Import {
    fn run(&self) -> Result<()> {
        let mut db = Database::open()?;
        if !self.merge && !db.dirs().is_empty() {
            bail!("current database is not empty, specify --merge to continue anyway");
        }

        match self.from {
            ImportFrom::Atuin => import::run(&import::Atuin {}, &mut db)?,
            ImportFrom::Autojump => import::run(&import::Autojump {}, &mut db)?,
            ImportFrom::Fasd => import::run(&import::Fasd {}, &mut db)?,
            ImportFrom::Z => import::run(&import::Z {}, &mut db)?,
            ImportFrom::ZLua => import::run(&import::ZLua {}, &mut db)?,
            ImportFrom::ZshZ => import::run(&import::ZshZ {}, &mut db)?,
        }

        db.save()
    }
}

```

### Core Architecture Module: `src/cmd/init.rs`
```
use std::io::{self, Write};

use anyhow::{Context, Result};
use askama::Template;

use crate::cmd::{Init, InitShell, Run};
use crate::config;
use crate::error::BrokenPipeHandler;
use crate::shell::{Bash, Elvish, Fish, Nushell, Opts, Posix, Powershell, Tcsh, Xonsh, Zsh};

impl Run for Init {
    fn run(&self) -> Result<()> {
        let cmd = if self.no_cmd { None } else { Some(self.cmd.as_str()) };
        let echo = config::echo();
        let resolve_symlinks = config::resolve_symlinks();
        let opts = &Opts { cmd, hook: self.hook, echo, resolve_symlinks };

        let source = match self.shell {
            InitShell::Bash => Bash(opts).render(),
            InitShell::Elvish => Elvish(opts).render(),
            InitShell::Fish => Fish(opts).render(),
            InitShell::Nushell => Nushell(opts).render(),
            InitShell::Posix => Posix(opts).render(),
            InitShell::Powershell => Powershell(opts).render(),
            InitShell::Tcsh => Tcsh(opts).render(),
            InitShell::Xonsh => Xonsh(opts).render(),
            InitShell::Zsh => Zsh(opts).render(),
        }
        .context("could not render template")?;
        writeln!(io::stdout(), "{source}").pipe_exit("stdout")
    }
}

```

### Core Architecture Module: `src/cmd/mod.rs`
```
mod add;
mod cmd;
mod edit;
mod import;
mod init;
mod query;
mod remove;

use anyhow::Result;

pub use crate::cmd::cmd::*;

pub trait Run {
    fn run(&self) -> Result<()>;
}

impl Run for Cmd {
    fn run(&self) -> Result<()> {
        match self {
            Cmd::Add(cmd) => cmd.run(),
            Cmd::Edit(cmd) => cmd.run(),
            Cmd::Import(cmd) => cmd.run(),
            Cmd::Init(cmd) => cmd.run(),
            Cmd::Query(cmd) => cmd.run(),
            Cmd::Remove(cmd) => cmd.run(),
        }
    }
}

```

### Core Architecture Module: `src/cmd/query.rs`
```
use std::io::{self, Write};

use anyhow::{Context, Result};

use crate::cmd::{Query, Run};
use crate::config;
use crate::db::{Database, Epoch, Stream, StreamOptions};
use crate::error::BrokenPipeHandler;
use crate::util::{self, Fzf, FzfChild};

impl Run for Query {
    fn run(&self) -> Result<()> {
        let mut db = crate::db::Database::open()?;
        self.query(&mut db).and(db.save())
    }
}

impl Query {
    fn query(&self, db: &mut Database) -> Result<()> {
        let now = util::current_time()?;
        let mut stream = self.get_stream(db, now)?;

        if self.interactive {
            self.query_interactive(&mut stream, now)
        } else if self.list {
            self.query_list(&mut stream, now)
        } else {
            self.query_first(&mut stream, now)
        }
    }

    fn query_interactive(&self, stream: &mut Stream, now: Epoch) -> Result<()> {
        let mut fzf = Self::get_fzf()?;
        let selection = loop {
            match stream.next() {
                Some(dir) if Some(dir.path.as_ref()) == self.exclude.as_deref() => continue,
                Some(dir) => {
                    if let Some(selection) = fzf.write(dir, now)? {
                        break selection;
                    }
                }
                None => break fzf.wait()?,
            }
        };

        let stdout = &mut io::stdout();
        if self.score {
            write!(stdout, "{selection}").pipe_exit("stdout")?;
        } else {
            let path = selection.get(7..).context("could not read selection from fzf")?;
            write!(stdout, "{path}").pipe_exit("stdout")?;
        }
        stdout.flush().pipe_exit("stdout")
    }

    fn query_list(&self, stream: &mut Stream, now: Epoch) -> Result<()> {
        let handle = &mut io::stdout().lock();
        while let Some(dir) = stream.next() {
            if Some(dir.path.as_ref()) == self.exclude.as_deref() {
                continue;
            }
            let dir = if self.score { dir.display().with_score(now) } else { dir.display() };
            writeln!(handle, "{dir}").pipe_exit("stdout")?;
        }
        Ok(())
    }

    fn query_first(&self, stream: &mut Stream, now: Epoch) -> Result<()> {
        let handle = &mut io::stdout();

        let mut dir = stream.next().context("no match found")?;
        while Some(dir.path.as_ref()) == self.exclude.as_deref() {
            dir = stream.next().context("you are already in the only match")?;
        }

        let dir = if self.score { dir.display().with_score(now) } else { dir.display() };
        writeln!(handle, "{dir}").pipe_exit("stdout")
    }

    fn get_stream<'a>(&self, db: &'a mut Database, now: Epoch) -> Result<Stream<'a>> {
        let mut options = StreamOptions::new(now)
            .with_keywords(self.keywords.iter().map(|s| s.as_str()))
            .with_exclude(config::exclude_dirs()?)
            .with_base_dir(self.base_dir.clone());
        if !self.all {
            let resolve_symlinks = config::resolve_symlinks();
            options = options.with_exists(true).with_resolve_symlinks(resolve_symlinks);
        }

        let stream = Stream::new(db, options);
        Ok(stream)
    }

    fn get_fzf() -> Result<FzfChild> {
        let mut fzf = Fzf::new()?;
        if let Some(fzf_opts) = config::fzf_opts() {
            fzf.env("FZF_DEFAULT_OPTS", fzf_opts)
        } else {
            fzf.args([
                // Search mode
                "--exact",
                // Search result
                "--no-sort",
                // Interface
                "--bind=ctrl-z:ignore,btab:up,tab:down",
                "--cycle",
                "--keep-right",
                // Layout
                "--border=sharp", // rounded edges don't display correctly on some terminals
                "--height=45%",
                "--info=inline",
                "--layout=reverse",
                // Display
                "--tabstop=1",
                // Scripting
                "--exit-0",
            ])
            .enable_preview()
        }
        .spawn()
    }
}

```

### Core Architecture Module: `src/cmd/remove.rs`
```
use anyhow::{Result, bail};

use crate::cmd::{Remove, Run};
use crate::db::Database;
use crate::util;

impl Run for Remove {
    fn run(&self) -> Result<()> {
        let mut db = Database::open()?;

        for path in &self.paths {
            if !db.remove(path) {
                let path_abs = util::resolve_path(path)?;
                let path_abs = util::path_to_str(&path_abs)?;
                if path_abs == path || !db.remove(path_abs) {
                    bail!("path not found in database: {path}")
                }
            }
        }

        db.save()
    }
}

```

### Core Architecture Module: `src/config.rs`
```
use std::env;
use std::ffi::OsString;
use std::path::PathBuf;

use anyhow::{Context, Result, ensure};
use glob::Pattern;

use crate::db::Rank;

pub fn data_dir() -> Result<PathBuf> {
    let dir = match env::var_os("_ZO_DATA_DIR") {
        Some(path) => PathBuf::from(path),
        None => dirs::data_local_dir()
            .context("could not find data directory, please set _ZO_DATA_DIR manually")?
            .join("zoxide"),
    };

    ensure!(dir.is_absolute(), "_ZO_DATA_DIR must be an absolute path");
    Ok(dir)
}

pub fn echo() -> bool {
    env::var_os("_ZO_ECHO").is_some_and(|var| var == "1")
}

pub fn exclude_dirs() -> Result<Vec<Pattern>> {
    match env::var_os("_ZO_EXCLUDE_DIRS") {
        Some(paths) => env::split_paths(&paths)
            .map(|path| {
                let pattern = path.to_str().context("invalid unicode in _ZO_EXCLUDE_DIRS")?;
                Pattern::new(pattern)
                    .with_context(|| format!("invalid glob in _ZO_EXCLUDE_DIRS: {pattern}"))
            })
            .collect(),
        None => {
            let pattern = (|| {
                let home = dirs::home_dir()?;
                let home = Pattern::escape(home.to_str()?);
                Pattern::new(&home).ok()
            })();
            Ok(pattern.into_iter().collect())
        }
    }
}

pub fn fzf_opts() -> Option<OsString> {
    env::var_os("_ZO_FZF_OPTS")
}

pub fn maxage() -> Result<Rank> {
    env::var_os("_ZO_MAXAGE").map_or(Ok(10_000.0), |maxage| {
        let maxage = maxage.to_str().context("invalid unicode in _ZO_MAXAGE")?;
        let maxage = maxage
            .parse::<u32>()
            .with_context(|| format!("unable to parse _ZO_MAXAGE as integer: {maxage}"))?;
        Ok(maxage as Rank)
    })
}

pub fn resolve_symlinks() -> bool {
    env::var_os("_ZO_RESOLVE_SYMLINKS").is_some_and(|var| var == "1")
}

```

### Core Architecture Module: `src/db/dir.rs`
```
use std::borrow::Cow;
use std::fmt::{self, Display, Formatter};

use serde::Deserialize;

use crate::util::{DAY, HOUR, WEEK};

#[derive(Clone, Debug, Deserialize)]
pub struct Dir<'a> {
    #[serde(borrow)]
    pub path: Cow<'a, str>,
    pub rank: Rank,
    pub last_accessed: Epoch,
}

impl Dir<'_> {
    pub fn display(&self) -> DirDisplay<'_> {
        DirDisplay::new(self)
    }

    pub fn score(&self, now: Epoch) -> Rank {
        // The older the entry, the lesser its importance.
        let duration = now.saturating_sub(self.last_accessed);
        if duration < HOUR {
            self.rank * 4.0
        } else if duration < DAY {
            self.rank * 2.0
        } else if duration < WEEK {
            self.rank * 0.5
        } else {
            self.rank * 0.25
        }
    }
}

pub struct DirDisplay<'a> {
    dir: &'a Dir<'a>,
    now: Option<Epoch>,
    separator: char,
}

impl<'a> DirDisplay<'a> {
    fn new(dir: &'a Dir) -> Self {
        Self { dir, separator: ' ', now: None }
    }

    pub fn with_score(mut self, now: Epoch) -> Self {
        self.now = Some(now);
        self
    }

    pub fn with_separator(mut self, separator: char) -> Self {
        self.separator = separator;
        self
    }
}

impl Display for DirDisplay<'_> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        if let Some(now) = self.now {
            let score = self.dir.score(now).clamp(0.0, 9999.0);
            write!(f, "{score:>6.1}{}", self.separator)?;
        }
        write!(f, "{}", self.dir.path)
    }
}

pub type Rank = f64;
pub type Epoch = u64;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #345** (2022-04-22): **Update Nushell script to support engine-q**
  *Symptoms*: Nushell is upgrading to a new engine with numerous backward-incompatible changes, which breaks zoxide's initialization script. The script would have to be updated accordingly.  CC @fdncred
  **Post-Mortem & Fix Analysis**:
  > indeed. we've tried to list most of the [breaking changes here](nushell/nushell#4305) but I'm guessing we've missed a few. let us know if you see things missing that we need. we're close to merging all these changes into the main nushell repo - maybe within a week.
  > we might find some inspiration from Kubouch's update of the virtualenv scripts he's been working on. https://github.com/kubouch/virtualenv/tree/engine-q-update/src/virtualenv/activation/nushell
  > we also made a working prototype here - https://github.com/nushell/nu_scripts/blob/main/engine-q/prompt/zoxide-eq.nu

- **Issue #332** (2022-04-22): **Allow `z -- /path/to/dir/`**
  *Symptoms*: I often use [fzf's ALT-C command](https://github.com/junegunn/fzf#key-bindings-for-command-line) to change directory, together with the alias `cd=z`. However, they recently [changed their `cd` behaviour](https://github.com/junegunn/fzf/pull/2659) so that it does `cd -- /path/to/dir/` instead of just `cd /path/to/dir/`, which `cd` supports but not `zoxide`. Is it possible to add support for `--` to zoxide as well?
  **Post-Mortem & Fix Analysis**:
  > Same situation for me. Really want this.
  > Fixed in fzf's repo: https://github.com/junegunn/fzf/pull/2799
  > @ajeetdsouza Now, the problem for me is, that Fzf's cd widget bypasses zoxide. What do you think about adding `z -- /path/to/dir/` to address this problem?

- **Issue #328** (2022-03-08): **Interactive selection preview doesn't work if you've aliased ls**
  *Symptoms*: I've aliased the ls command to the wonderful exa tool, however that means that if I run `zi` I get a pretty box on the right that displays: `exa: Unknown argument -p`. I'm pretty sure that's caused by this line: https://github.com/ajeetdsouza/zoxide/blob/b6b024c452635d672e3dc58707ef86cb944a52ab/src/fzf.rs#L35  I'm not entirely sure what the right fix is, maybe another environment variable and fully qualify `ls` by default.
  **Post-Mortem & Fix Analysis**:
  > Hey, thanks for pointing this out!  I looked up the implementation, it seems fzf uses `sh -c COMMAND` to run the preview command. On UNIX systems, we can reasonably assume that `sh` is POSIX compliant, so we can use `\command -p` to bypass the alias.
  > I don't think that's true because I had `ls` aliased in fish, and so `sh -c 'ls -p'` works fine. [The fzf README](https://github.com/junegunn/fzf#preview-window) claims it uses your `$SHELL` rather than `sh` which makes that approach less helpful.
  > I had the same issue and have setup this little workaround for it. Just set the `ZO_FZF_OPTS` to `--preview=\'exa -la {2..}\'`.  To preserve all the other fzf options:  ``` # fish env set set -Ux _ZO_FZF_OPTS '--bind=ctrl-z:ignore --exit-0 --height=40% --inline-info --no-sort --reverse --select-1 --preview=\'exa -la {2..}\'' ```

- **Issue #310** (2022-07-15): **Add support for arm linux**
  *Symptoms*: ``` parallels@ubuntu-linux-20-04-desktop:~$ uname -a Linux ubuntu-linux-20-04-desktop 5.4.0-91-generic #102-Ubuntu SMP Fri Nov 5 16:30:45 UTC 2021 aarch64 aarch64 aarch64 GNU/Linux parallels@ubuntu-linux-20-04-desktop:~$ sudo apt install zoxide [sudo] password for parallels:  Reading package lists... Done Building dependency tree        Reading state information... Done E: Unable to locate package zoxide ```
  **Post-Mortem & Fix Analysis**:
  > zoxide was only added to Ubuntu repositories in 21.04+. You might want to use the generic installer instead:  ```sh curl -sS https://webinstall.dev/zoxide | bash ```
  > I got a `cannot execute binary file` error when using the generic installer.  ``` parallels@ubuntu-linux-20-04-desktop:~/Downloads$ curl -sS https://webinstall.dev/zoxide | bash  Thanks for using webi to install 'zoxide@stable' on 'Linux/aarch64'. Have a problem? Experience a bug? Please let us know:         https://github.com/webinstall/webi-installers/issues  Lovin' it? Say thanks with a Star on GitHub:         https://github.com/webinstall/webi-installers  Found /home/parallels/Downloads/webi/zoxide/0.7.9/zoxide-v0.7.9-aarch64-unknown-linux-musl.tar.gz Extracting /home/parallels/Downloads/webi/zoxide/0.7.9/zoxide-v0.7.9-aarch64-unknown-linux-musl.tar.gz Installing to /home/parallels/.local/opt/zoxide-v0.7.9/bin/zoxide zoxide@stable-bootstrap.sh: line 247: /home/parallels/.local/bin/pathman: cannot execute binary file: Exec format error zoxide was installed successfully. Next, you'll need to set it up on your shell:  - For bash, add this line to ~/.bashrc:     eval 
  > Hey, zoxide now ships its own installer once again, so this should be fixed. Sorry this took so long!

- **Issue #181** (2022-03-09): **zoxide changes db.zo ownership to root when using sudo -E**
  *Symptoms*: Just revamped my zsh shell setup and included zoxide, it's fantastic!  But when I want to run a string of commands or move around the nether regions of my manjaro linux filesystem as **root** I'm in the habit of using `sudo -E zsh`, which carries over my user account shell setup to root.  However I've noticed that if I do that now and cd to a directory zoxide will happily store the history _but_ will change the ownership of `/home/adrinux/.local/share/zoxide/db.zo` to **root**. Once I exit from root back to a normal user I then get permission denied errors from zoxide, for obvious reasons.  The fix is easy enough - just sudo chown it back to myself.  The workarounds are obvious: don't use sudo -E; just use sudo -s and put up with the suckier shell; or not and copy my shell config to the root user so it's the same, or even just use sudo for every command.  But at the same time I get the feeling zoxide shouldn't be quite so aggressive about changing the zo.db ownership to root, am I wrong?  For complete clarity here is an example session, assuming you've been using zoxide as a normal user so zo.db exists: ```bash # check permissions ls -al /home/adrinux/.local/share/zoxide .rw------- 427 adrinux adrinux 13 Apr 15:39   db.zo # switch to root and do some stuff sudo -E zsh cd /etc/systemd/system exit # back to our normal user and check permissions ls -al /home/adrinux/.local/share/zoxide .rw------- 470 root root 13 Apr 15:58    db.zo  # and the fix sudo 
  **Post-Mortem & Fix Analysis**:
  > Hey @adrinux, thanks for reporting this. I don't think there's a straightforward solution to the issue, unfortunately.  - The owner on the file is changing because zoxide updates the database by creating a tempfile and atomically moving it over the original. The tempfile is always created under the current user (in your case, `root`). Editing the file in-place would fix the problem, but we would no longer have atomicity on the database, leading to possible corruption. - We could change the permissions on the database file to `0666`. The problem with this approach is that users may not want their directory history to be accessible by everyone.  You could work around this by editing your `.zshrc` file to only call `zoxide init` when `$USER` is the correct user.
  > Thanks @ajeetdsouza for the explanation - and a solution I hadn't yet thought of!  I think what I'll do is set up the shell for the root user how I like it and go back to using `sudo -s` to switch, that way root will have its own db.zo and I can still take advantage of the power :)
  > @adrinux sounds good! If you're willing to have a separate DB for root, you can still use `sudo -E`:  ```sh if [ "$USER" = "root" ]; then     export _ZO_DATA_DIR="/root/.local/share/zoxide" fi  eval "$(zoxide init zsh)" ```

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

### Incident Patch 1: `9a6d2d4c` (2026-10-01)
**Commit Message**: fix: handle broken pipe in query --interactive (#1314)

query_interactive printed the fzf selection with bare print! macros, which panic on EPIPE. Use the pipe_exit convention introduced for broken pipes in #137 like the rest of the command already does.

The final flush makes the error surface deterministically even if stdout buffering would otherwise defer the failed write to process exit.

Co-authored-by: Mathjk <[REDACTED_EMAIL]>

**File**: `src/cmd/query.rs` (modified, +4/-3)
```diff
@@ -43,13 +43,14 @@ impl Query {
             }
         };
 
+        let stdout = &mut io::stdout();
         if self.score {
-            print!("{selection}");
+            write!(stdout, "{selection}").pipe_exit("stdout")?;
         } else {
             let path = selection.get(7..).context("could not read selection from fzf")?;
-            print!("{path}");
+            write!(stdout, "{path}").pipe_exit("stdout")?;
         }
-        Ok(())
+        stdout.flush().pipe_exit("stdout")
     }
 
     fn query_list(&self, stream: &mut Stream, now: Epoch) -> Result<()> {
```

---

### Incident Patch 2: `8a3f76da` (2026-08-18)
**Commit Message**: Fix minimum supported Nushell version in README (#1284)

Co-authored-by: Ajeet D'Souza <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Changed
 
 - `import` now takes a subcommand instead of the `--from` flag.
+- Nushell: upgrade minimum supported version to v0.106.0.
 
 ### Fixed
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -268,7 +268,7 @@ zoxide can be installed in 4 easy steps:
    > ```
    >
    > **Note:**
-   > zoxide only supports Nushell v0.89.0+.
+   > zoxide only supports Nushell v0.106.0+.
 
    </details>
 
```

**File**: `man/man1/zoxide-init.1` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ Now, add this to the \fBend\fR of your config file (find it by running
     \fBsource ~/.zoxide.nu\fR
 .fi
 .sp
-Note: zoxide only supports Nushell v0.89.0+.
+Note: zoxide only supports Nushell v0.106.0+.
 .TP
 .B powershell
 Add this to the \fBend\fR of your config file (find it by running \fBecho
```

**File**: `templates/nushell.txt` (modified, +1/-1)
```diff
@@ -104,4 +104,4 @@ export alias {{cmd}}i = __zoxide_zi
 #
 #   source ~/.zoxide.nu
 #
-# Note: zoxide only supports Nushell v0.89.0+.
+# Note: zoxide only supports Nushell v0.106.0+.
```

---

### Incident Patch 3: `1f484a4e` (2026-07-06)
**Commit Message**: Fix MSYS2 cygpath pwd substitution (#1260)

---------

Co-authored-by: cyphercodes <[REDACTED_EMAIL]>
Co-authored-by: Ajeet D'Souza <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -7,6 +7,12 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [Unreleased]
+
+### Fixed
+
+- Bash/Zsh: fix `z` failing on Cygwin/MSYS2 due to `cygpath` being passed a bad string.
+
 ## [0.10.0] - 2026-07-04
 
 ### Added
```

**File**: `templates/bash.txt` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ function __zoxide_pwd() {
 {%- let pwd = "\\builtin pwd -L" -%}
 {%- endif -%}
 {%- if cfg!(windows) %}
-    \command cygpath -w "{{ pwd }}"
+    \command cygpath -w "$({{ pwd }})"
 {%- else %}
     {{ pwd }}
 {%- endif %}
```

**File**: `templates/zsh.txt` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ function __zoxide_pwd() {
 {%- let pwd = "\\builtin pwd -L" -%}
 {%- endif -%}
 {%- if cfg!(windows) %}
-    \command cygpath -w "{{ pwd }}"
+    \command cygpath -w "$({{ pwd }})"
 {%- else %}
     {{ pwd }}
 {%- endif %}
```

---

### Incident Patch 4: `f84f9a3e` (2026-07-04)
**Commit Message**: Fix link in CHANGELOG

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -584,6 +584,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - GitHub Actions pipeline to build and upload releases.
 - Add support for Zsh.
 
+[0.10.0]: https://github.com/ajeetdsouza/zoxide/compare/v0.9.9...v0.10.0
 [0.9.9]: https://github.com/ajeetdsouza/zoxide/compare/v0.9.8...v0.9.9
 [0.9.8]: https://github.com/ajeetdsouza/zoxide/compare/v0.9.7...v0.9.8
 [0.9.7]: https://github.com/ajeetdsouza/zoxide/compare/v0.9.6...v0.9.7
```

---

### Incident Patch 5: `1683e7b8` (2026-05-10)
**Commit Message**: import: auto-detect databases; add Atuin support (#1232)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -12,6 +12,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Added
 
 - POSIX: support for non-Cygwin Windows environments (e.g. Busybox).
+- `import` now supports fetching entries from `atuin`.
+
+### Changed
+
+- `import` now auto-detects database files.
 
 ### Fixed
 
```

**File**: `Cargo.lock` (modified, +400/-212)
```diff
@@ -4,9 +4,9 @@ version = 4
 
 [[package]]
 name = "aho-corasick"
-version = "1.1.3"
+version = "1.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8e60d3430d3a69478ad0993f19238d2df97c507009a52b3c10addcd7f6bcb916"
+checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
 dependencies = [
  "memchr",
 ]
@@ -19,9 +19,9 @@ checksum = "250f629c0161ad8107cf89319e990051fae62832fd343083bea452d93e2205fd"
 
 [[package]]
 name = "anstream"
-version = "0.6.18"
+version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8acc5369981196006228e28809f761875c0327210a891e941f4c683b3a99529b"
+checksum = "824a212faf96e9acacdbd09febd34438f8f711fb84e09a8916013cd7815ca28d"
 dependencies = [
  "anstyle",
  "anstyle-parse",
@@ -34,33 +34,33 @@ dependencies = [
 
 [[package]]
 name = "anstyle"
-version = "1.0.10"
+version = "1.0.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "55cc3b69f167a1ef2e161439aa98aed94e6028e5f9a59be9a6ffb47aef1651f9"
+checksum = "940b3a0ca603d1eade50a4846a2afffd5ef57a9feac2c0e2ec2e14f9ead76000"
 
 [[package]]
 name = "anstyle-parse"
-version = "0.2.6"
+version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3b2d16507662817a6a20a9ea92df6652ee4f94f914589377d69f3b21bc5798a9"
+checksum = "52ce7f38b242319f7cabaa6813055467063ecdc9d355bbb4ce0c68908cd8130e"
 dependencies = [
  "utf8parse",
 ]
 
 [[package]]
 name = "anstyle-query"
-version = "1.1.2"
+version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "79947af37f4177cfead1110013d678905c37501914fba0efea834c3fe9a8d60c"
+checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
  "windows-sys",
 ]
 
 [[package]]
 name = "anstyle-wincon"
-version = "3.0.8"
+version = "3.0.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6680de5231bd6ee4c6191b8a1325daa282b415391ec9d3a37bd34f2060dc73fa"
+checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
@@ -69,17 +69,17 @@ dependencies = [
 
 [[package]]
 name = "anyhow"
-version = "1.0.98"
+version = "1.0.102"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e16d2d3311acee920a9eb8d33b8cbc1787ce4a264e85f964c2404b969bdcd487"
+checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
 [[package]]
 name = "askama"
-version = "0.14.0"
+version = "0.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f75363874b771be265f4ffe307ca705ef6f3baa19011c149da8674a87f1b75c4"
+checksum = "f1bf825125edd887a019d0a3a837dcc5499a68b0d034cc3eb594070c3e18addc"
 dependencies = [
- "askama_derive",
+ "askama_macros",
  "itoa",
  "percent-encoding",
  "serde",
@@ -88,9 +88,9 @@ dependencies = [
 
 [[package]]
 name = "askama_derive"
-version = "0.14.0"
+version = "0.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "129397200fe83088e8a68407a8e2b1f826cf0086b21ccdb866a722c8bcd3a94f"
+checksum = "e1c7065972a130eafa84215f21352ae15b4a7393da48c1f5e103904490736738"
 dependencies = [
  "askama_parser",
  "memchr",
@@ -100,25 +100,34 @@ dependencies = [
  "syn",
 ]
 
+[[package]]
+name = "askama_macros"
+version = "0.16.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "0e23b1d2c4bd39a41971f6124cef4cc6fd0540913ecb90919b69ab3bbe44ae1a"
+dependencies = [
+ "askama_derive",
+]
+
 [[package]]
 name = "askama_parser"
-version = "0.14.0"
+version = "0.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d6ab5630b3d5eaf232620167977f95eb51f3432fc76852328774afbd242d4358"
+checksum = "7db09fde9143e7ac4513358fb32ee32847125b63b18ea715afd487956da715da"
 dependencies = [
- "memchr",
+ "rustc-hash",
+ "unicode-ident",
  "winnow",
 ]
 
 [[package]]
 name = "assert_cmd"
-version = "2.0.17"
+version = "2.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2bd389a4b2970a01282ee455294913c0a43724daedcd1a24c3eb0ec1c1320b66"
+checksum = "39bae1d3fa576f7c6519514180a72559268dd7d1fe104070956cb687bc6673bd"
 dependencies = [
  "anstyle",
  "bstr",
- "doc-comment",
  "libc",
  "predicates",
  "predicates-core",
@@ -137,15 +146,15 @@ dependencies = [
 
 [[package]]
 name = "bitflags"
-version = "2.9.1"
+version = "2.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1b8e56985ec62d17e9c1001dc89c88ecd7dc08e47eba5ec7c29c7b5eeecde967"
+checksum = "c4512299f36f043ab09a583e57bceb5a5aab7a73db1805848e8fef3c9e8c78b3"
 
 [[package]]
 name = "bstr"
-version = "1.12.0"
+version = "1.12.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "234113d19d0d7d613b40e86fb654acf958910802bcceab913a4f9e7cda03b1a4"
+checksum = "63044e1ae8e69f3b5a92c736ca6269b8d12fa7efe39bf34ddb06d102cf0e2cab"

```

**File**: `Cargo.toml` (modified, +5/-4)
```diff
@@ -9,15 +9,15 @@ license = "MIT"
 name = "zoxide"
 readme = "README.md"
 repository = "https://github.com/ajeetdsouza/zoxide"
-rust-version = "1.85.0"
+rust-version = "1.88.0"
 version = "0.9.9"
 
 [badges]
 maintenance = { status = "actively-developed" }
 
 [dependencies]
 anyhow = "1.0.32"
-askama = { version = "0.14.0", default-features = false, features = [
+askama = { version = "0.16.0", default-features = false, features = [
     "derive",
     "std",
 ] }
@@ -30,15 +30,16 @@ fastrand = "2.0.0"
 glob = "0.3.0"
 ouroboros = "0.18.3"
 serde = { version = "1.0.116", features = ["derive"] }
+time = { version = "0.3.47", default-features = false, features = ["parsing", "macros", "std"] }
 
 [target.'cfg(unix)'.dependencies]
-nix = { version = "0.30.1", default-features = false, features = [
+nix = { version = "0.31.2", default-features = false, features = [
     "fs",
     "user",
 ] }
 
 [target.'cfg(windows)'.dependencies]
-which = "7.0.3"
+which = "8.0.2"
 
 [build-dependencies]
 clap = { version = "4.3.0", features = ["derive"] }
```

**File**: `README.md` (modified, +15/-55)
```diff
@@ -350,61 +350,21 @@ zoxide can be installed in 4 easy steps:
 4. **Import your data** <sup>(optional)</sup>
 
    If you currently use any of these plugins, you may want to import your data
-   into zoxide:
-
-   <details>
-   <summary>autojump</summary>
-
-   > Run this command in your terminal:
-   >
-   > ```sh
-   > zoxide import --from=autojump "/path/to/autojump/db"
-   > ```
-   >
-   > The path usually varies according to your system:
-   >
-   > | OS      | Path                                                                                 | Example                                                |
-   > | ------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
-   > | Linux   | `$XDG_DATA_HOME/autojump/autojump.txt` or `$HOME/.local/share/autojump/autojump.txt` | `/home/alice/.local/share/autojump/autojump.txt`       |
-   > | macOS   | `$HOME/Library/autojump/autojump.txt`                                                | `/Users/Alice/Library/autojump/autojump.txt`           |
-   > | Windows | `%APPDATA%\autojump\autojump.txt`                                                    | `C:\Users\Alice\AppData\Roaming\autojump\autojump.txt` |
-
-   </details>
-
-   <details>
-   <summary>fasd, z, z.lua, zsh-z</summary>
-
-   > Run this command in your terminal:
-   >
-   > ```sh
-   > zoxide import --from=z "path/to/z/db"
-   > ```
-   >
-   > The path usually varies according to your system:
-   >
-   > | Plugin           | Path                                                                                |
-   > | ---------------- | ----------------------------------------------------------------------------------- |
-   > | fasd             | `$_FASD_DATA` or `$HOME/.fasd`                                                      |
-   > | z (bash/zsh)     | `$_Z_DATA` or `$HOME/.z`                                                            |
-   > | z (fish)         | `$Z_DATA` or `$XDG_DATA_HOME/z/data` or `$HOME/.local/share/z/data`                 |
-   > | z.lua (bash/zsh) | `$_ZL_DATA` or `$HOME/.zlua`                                                        |
-   > | z.lua (fish)     | `$XDG_DATA_HOME/zlua/zlua.txt` or `$HOME/.local/share/zlua/zlua.txt` or `$_ZL_DATA` |
-   > | zsh-z            | `$ZSHZ_DATA` or `$_Z_DATA` or `$HOME/.z`                                            |
-
-   </details>
-
-   <details>
-   <summary>ZLocation</summary>
-
-   > Run this command in PowerShell:
-   >
-   > ```powershell
-   > $db = New-TemporaryFile
-   > (Get-ZLocation).GetEnumerator() | ForEach-Object { Write-Output ($_.Name+'|'+$_.Value+'|0') } | Out-File $db
-   > zoxide import --from=z $db
-   > ```
-
-   </details>
+   into zoxide. The data file is auto-detected using each plugin's standard
+   conventions.
+
+   ```sh
+   zoxide import <plugin>
+   ```
+
+   | Plugin     | Command                   |
+   | ---------- | ------------------------- |
+   | atuin      | `zoxide import atuin`     |
+   | autojump   | `zoxide import autojump`  |
+   | fasd       | `zoxide import fasd`      |
+   | z          | `zoxide import z`         |
+   | z.lua      | `zoxide import z.lua`     |
+   | zsh-z      | `zoxide import zsh-z`     |
 
 ## Configuration
 
```

**File**: `contrib/completions/_zoxide` (modified, +125/-24)
```diff
@@ -45,7 +45,7 @@ _arguments "${_arguments_options[@]}" : \
 '--help[Print help]' \
 '-V[Print version]' \
 '--version[Print version]' \
-":: :_zoxide__edit_commands" \
+":: :_zoxide__subcmd__edit_commands" \
 "*::: :->edit" \
 && ret=0
 
@@ -96,15 +96,79 @@ esac
 ;;
 (import)
 _arguments "${_arguments_options[@]}" : \
-'--from=[Application to import from]:FROM:(autojump z)' \
 '--merge[Merge into existing database]' \
 '-h[Print help]' \
 '--help[Print help]' \
 '-V[Print version]' \
 '--version[Print version]' \
-':path:_files' \
+":: :_zoxide__subcmd__import_commands" \
+"*::: :->import" \
+&& ret=0
+
+    case $state in
+    (import)
+        words=($line[1] "${words[@]}")
+        (( CURRENT += 1 ))
+        curcontext="${curcontext%:*:*}:zoxide-import-command-$line[1]:"
+        case $line[1] in
+            (atuin)
+_arguments "${_arguments_options[@]}" : \
+'--merge[Merge into existing database]' \
+'-h[Print help]' \
+'--help[Print help]' \
+'-V[Print version]' \
+'--version[Print version]' \
+&& ret=0
+;;
+(autojump)
+_arguments "${_arguments_options[@]}" : \
+'--merge[Merge into existing database]' \
+'-h[Print help]' \
+'--help[Print help]' \
+'-V[Print version]' \
+'--version[Print version]' \
+&& ret=0
+;;
+(fasd)
+_arguments "${_arguments_options[@]}" : \
+'--merge[Merge into existing database]' \
+'-h[Print help]' \
+'--help[Print help]' \
+'-V[Print version]' \
+'--version[Print version]' \
+&& ret=0
+;;
+(z)
+_arguments "${_arguments_options[@]}" : \
+'--merge[Merge into existing database]' \
+'-h[Print help]' \
+'--help[Print help]' \
+'-V[Print version]' \
+'--version[Print version]' \
 && ret=0
 ;;
+(z.lua)
+_arguments "${_arguments_options[@]}" : \
+'--merge[Merge into existing database]' \
+'-h[Print help]' \
+'--help[Print help]' \
+'-V[Print version]' \
+'--version[Print version]' \
+&& ret=0
+;;
+(zsh-z)
+_arguments "${_arguments_options[@]}" : \
+'--merge[Merge into existing database]' \
+'-h[Print help]' \
+'--help[Print help]' \
+'-V[Print version]' \
+'--version[Print version]' \
+&& ret=0
+;;
+        esac
+    ;;
+esac
+;;
 (init)
 _arguments "${_arguments_options[@]}" : \
 '--cmd=[Changes the prefix of the \`z\` and \`zi\` commands]:CMD:_default' \
@@ -162,13 +226,13 @@ _zoxide_commands() {
     )
     _describe -t commands 'zoxide commands' commands "$@"
 }
-(( $+functions[_zoxide__add_commands] )) ||
-_zoxide__add_commands() {
+(( $+functions[_zoxide__subcmd__add_commands] )) ||
+_zoxide__subcmd__add_commands() {
     local commands; commands=()
     _describe -t commands 'zoxide add commands' commands "$@"
 }
-(( $+functions[_zoxide__edit_commands] )) ||
-_zoxide__edit_commands() {
+(( $+functions[_zoxide__subcmd__edit_commands] )) ||
+_zoxide__subcmd__edit_commands() {
     local commands; commands=(
 'decrement:' \
 'delete:' \
@@ -177,43 +241,80 @@ _zoxide__edit_commands() {
     )
     _describe -t commands 'zoxide edit commands' commands "$@"
 }
-(( $+functions[_zoxide__edit__decrement_commands] )) ||
-_zoxide__edit__decrement_commands() {
+(( $+functions[_zoxide__subcmd__edit__subcmd__decrement_commands] )) ||
+_zoxide__subcmd__edit__subcmd__decrement_commands() {
     local commands; commands=()
     _describe -t commands 'zoxide edit decrement commands' commands "$@"
 }
-(( $+functions[_zoxide__edit__delete_commands] )) ||
-_zoxide__edit__delete_commands() {
+(( $+functions[_zoxide__subcmd__edit__subcmd__delete_commands] )) ||
+_zoxide__subcmd__edit__subcmd__delete_commands() {
     local commands; commands=()
     _describe -t commands 'zoxide edit delete commands' commands "$@"
 }
-(( $+functions[_zoxide__edit__increment_commands] )) ||
-_zoxide__edit__increment_commands() {
+(( $+functions[_zoxide__subcmd__edit__subcmd__increment_commands] )) ||
+_zoxide__subcmd__edit__subcmd__increment_commands() {
     local commands; commands=()
     _describe -t commands 'zoxide edit increment commands' commands "$@"
 }
-(( $+functions[_zoxide__edit__reload_commands] )) ||
-_zoxide__edit__reload_commands() {
+(( $+functions[_zoxide__subcmd__edit__subcmd__reload_commands] )) ||
+_zoxide__subcmd__edit__subcmd__reload_commands() {
     local commands; commands=()
     _describe -t commands 'zoxide edit reload commands' commands "$@"
 }
-(( $+functions[_zoxide__import_commands] )) ||
-_zoxide__import_commands() {
-    local commands; commands=()
+(( $+functions[_zoxide__subcmd__import_commands] )) ||
+_zoxide__subcmd__import_commands() {
+    local commands; commands=(
+'atuin:Import from atuin' \
+'autojump:Import from autojump' \
+'fasd:Import from fasd' \
+'z:Import from z' \
+'z.lua:Import from z.lua' \
+'zsh-z:Import from zsh-z' \
+    )
     _describe -t commands 'zoxide import commands' commands "$@"
 }
-(( $+functions[_zoxide__init_commands] )) ||
-_zoxide__init_commands() {
+(( $+functions[_zoxide__subcmd__import__subcmd__atuin_commands] )) ||
+_zoxide__subcmd__import__subcmd__atuin_commands() {
+    local commands; commands=()
+    _describe -t commands 'zoxide import
```

**File**: `contrib/completions/_zoxide.ps1` (modified, +54/-1)
```diff
@@ -82,7 +82,60 @@ Register-ArgumentCompleter -Native -CommandName 'zoxide' -ScriptBlock {
             break
         }
         'zoxide;import' {
-            [CompletionResult]::new('--from', '--from', [CompletionResultType]::ParameterName, 'Application to import from')
+            [CompletionResult]::new('--merge', '--merge', [CompletionResultType]::ParameterName, 'Merge into existing database')
+            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('-V', '-V ', [CompletionResultType]::ParameterName, 'Print version')
+            [CompletionResult]::new('--version', '--version', [CompletionResultType]::ParameterName, 'Print version')
+            [CompletionResult]::new('atuin', 'atuin', [CompletionResultType]::ParameterValue, 'Import from atuin')
+            [CompletionResult]::new('autojump', 'autojump', [CompletionResultType]::ParameterValue, 'Import from autojump')
+            [CompletionResult]::new('fasd', 'fasd', [CompletionResultType]::ParameterValue, 'Import from fasd')
+            [CompletionResult]::new('z', 'z', [CompletionResultType]::ParameterValue, 'Import from z')
+            [CompletionResult]::new('z.lua', 'z.lua', [CompletionResultType]::ParameterValue, 'Import from z.lua')
+            [CompletionResult]::new('zsh-z', 'zsh-z', [CompletionResultType]::ParameterValue, 'Import from zsh-z')
+            break
+        }
+        'zoxide;import;atuin' {
+            [CompletionResult]::new('--merge', '--merge', [CompletionResultType]::ParameterName, 'Merge into existing database')
+            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('-V', '-V ', [CompletionResultType]::ParameterName, 'Print version')
+            [CompletionResult]::new('--version', '--version', [CompletionResultType]::ParameterName, 'Print version')
+            break
+        }
+        'zoxide;import;autojump' {
+            [CompletionResult]::new('--merge', '--merge', [CompletionResultType]::ParameterName, 'Merge into existing database')
+            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('-V', '-V ', [CompletionResultType]::ParameterName, 'Print version')
+            [CompletionResult]::new('--version', '--version', [CompletionResultType]::ParameterName, 'Print version')
+            break
+        }
+        'zoxide;import;fasd' {
+            [CompletionResult]::new('--merge', '--merge', [CompletionResultType]::ParameterName, 'Merge into existing database')
+            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('-V', '-V ', [CompletionResultType]::ParameterName, 'Print version')
+            [CompletionResult]::new('--version', '--version', [CompletionResultType]::ParameterName, 'Print version')
+            break
+        }
+        'zoxide;import;z' {
+            [CompletionResult]::new('--merge', '--merge', [CompletionResultType]::ParameterName, 'Merge into existing database')
+            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('-V', '-V ', [CompletionResultType]::ParameterName, 'Print version')
+            [CompletionResult]::new('--version', '--version', [CompletionResultType]::ParameterName, 'Print version')
+            break
+        }
+        'zoxide;import;z.lua' {
+            [CompletionResult]::new('--merge', '--merge', [CompletionResultType]::ParameterName, 'Merge into existing database')
+            [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('--help', '--help', [CompletionResultType]::ParameterName, 'Print help')
+            [CompletionResult]::new('-V', '-V ', [CompletionResultType]::ParameterName, 'Print version')
+            [CompletionResult]::new('--version', '--version', [CompletionResultType]::ParameterName, 'Print version')
+            break
+        }
+        'zoxide;import;zsh-z' {
             [CompletionResult]::new('--merge', '--merge', [CompletionResultType]::ParameterName, 'Merge into existing database')
             [CompletionResult]::new('-h', '-h', [CompletionResultType]::ParameterName, 'Print help')
             [CompletionRe
```

**File**: `contrib/completions/zoxide.bash` (modified, +126/-28)
```diff
@@ -17,34 +17,52 @@ _zoxide() {
                 cmd="zoxide"
                 ;;
             zoxide,add)
-                cmd="zoxide__add"
+                cmd="zoxide__subcmd__add"
                 ;;
             zoxide,edit)
-                cmd="zoxide__edit"
+                cmd="zoxide__subcmd__edit"
                 ;;
             zoxide,import)
-                cmd="zoxide__import"
+                cmd="zoxide__subcmd__import"
                 ;;
             zoxide,init)
-                cmd="zoxide__init"
+                cmd="zoxide__subcmd__init"
                 ;;
             zoxide,query)
-                cmd="zoxide__query"
+                cmd="zoxide__subcmd__query"
                 ;;
             zoxide,remove)
-                cmd="zoxide__remove"
+                cmd="zoxide__subcmd__remove"
                 ;;
-            zoxide__edit,decrement)
-                cmd="zoxide__edit__decrement"
+            zoxide__subcmd__edit,decrement)
+                cmd="zoxide__subcmd__edit__subcmd__decrement"
                 ;;
-            zoxide__edit,delete)
-                cmd="zoxide__edit__delete"
+            zoxide__subcmd__edit,delete)
+                cmd="zoxide__subcmd__edit__subcmd__delete"
                 ;;
-            zoxide__edit,increment)
-                cmd="zoxide__edit__increment"
+            zoxide__subcmd__edit,increment)
+                cmd="zoxide__subcmd__edit__subcmd__increment"
                 ;;
-            zoxide__edit,reload)
-                cmd="zoxide__edit__reload"
+            zoxide__subcmd__edit,reload)
+                cmd="zoxide__subcmd__edit__subcmd__reload"
+                ;;
+            zoxide__subcmd__import,atuin)
+                cmd="zoxide__subcmd__import__subcmd__atuin"
+                ;;
+            zoxide__subcmd__import,autojump)
+                cmd="zoxide__subcmd__import__subcmd__autojump"
+                ;;
+            zoxide__subcmd__import,fasd)
+                cmd="zoxide__subcmd__import__subcmd__fasd"
+                ;;
+            zoxide__subcmd__import,z)
+                cmd="zoxide__subcmd__import__subcmd__z"
+                ;;
+            zoxide__subcmd__import,z.lua)
+                cmd="zoxide__subcmd__import__subcmd__z.lua"
+                ;;
+            zoxide__subcmd__import,zsh-z)
+                cmd="zoxide__subcmd__import__subcmd__zsh__subcmd__z"
                 ;;
             *)
                 ;;
@@ -66,7 +84,7 @@ _zoxide() {
             COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
             return 0
             ;;
-        zoxide__add)
+        zoxide__subcmd__add)
             opts="-s -h -V --score --help --version <PATHS>..."
             if [[ ${cur} == -* || ${COMP_CWORD} -eq 2 ]] ; then
                 COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
@@ -88,7 +106,7 @@ _zoxide() {
             COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
             return 0
             ;;
-        zoxide__edit)
+        zoxide__subcmd__edit)
             opts="-h -V --help --version decrement delete increment reload"
             if [[ ${cur} == -* || ${COMP_CWORD} -eq 2 ]] ; then
                 COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
@@ -102,7 +120,7 @@ _zoxide() {
             COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
             return 0
             ;;
-        zoxide__edit__decrement)
+        zoxide__subcmd__edit__subcmd__decrement)
             opts="-h -V --help --version <PATH>"
             if [[ ${cur} == -* || ${COMP_CWORD} -eq 3 ]] ; then
                 COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
@@ -116,7 +134,7 @@ _zoxide() {
             COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
             return 0
             ;;
-        zoxide__edit__delete)
+        zoxide__subcmd__edit__subcmd__delete)
             opts="-h -V --help --version <PATH>"
             if [[ ${cur} == -* || ${COMP_CWORD} -eq 3 ]] ; then
                 COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
@@ -130,7 +148,7 @@ _zoxide() {
             COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
             return 0
             ;;
-        zoxide__edit__increment)
+        zoxide__subcmd__edit__subcmd__increment)
             opts="-h -V --help --version <PATH>"
             if [[ ${cur} == -* || ${COMP_CWORD} -eq 3 ]] ; then
                 COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
@@ -144,7 +162,7 @@ _zoxide() {
             COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
             return 0
             ;;
-        zoxide__edit__reload)
+        zoxide__subcmd__edit__subcmd__reload)
             opts="-h -V --help --version"
             if [[ ${cur} == -* || ${COMP_CWORD} -eq 3 ]] ; then
                 COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
@@ -158,25 +176,105 @@ _zoxide() {
             COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
             return 0
             ;;
-        zoxide__import)
-            opts="-h -V --f
```

**File**: `contrib/completions/zoxide.elv` (modified, +48/-1)
```diff
@@ -72,7 +72,54 @@ set edit:completion:arg-completer[zoxide] = {|@words|
             cand --version 'Print version'
         }
         &'zoxide;import'= {
-            cand --from 'Application to import from'
+            cand --merge 'Merge into existing database'
+            cand -h 'Print help'
+            cand --help 'Print help'
+            cand -V 'Print version'
+            cand --version 'Print version'
+            cand atuin 'Import from atuin'
+            cand autojump 'Import from autojump'
+            cand fasd 'Import from fasd'
+            cand z 'Import from z'
+            cand z.lua 'Import from z.lua'
+            cand zsh-z 'Import from zsh-z'
+        }
+        &'zoxide;import;atuin'= {
+            cand --merge 'Merge into existing database'
+            cand -h 'Print help'
+            cand --help 'Print help'
+            cand -V 'Print version'
+            cand --version 'Print version'
+        }
+        &'zoxide;import;autojump'= {
+            cand --merge 'Merge into existing database'
+            cand -h 'Print help'
+            cand --help 'Print help'
+            cand -V 'Print version'
+            cand --version 'Print version'
+        }
+        &'zoxide;import;fasd'= {
+            cand --merge 'Merge into existing database'
+            cand -h 'Print help'
+            cand --help 'Print help'
+            cand -V 'Print version'
+            cand --version 'Print version'
+        }
+        &'zoxide;import;z'= {
+            cand --merge 'Merge into existing database'
+            cand -h 'Print help'
+            cand --help 'Print help'
+            cand -V 'Print version'
+            cand --version 'Print version'
+        }
+        &'zoxide;import;z.lua'= {
+            cand --merge 'Merge into existing database'
+            cand -h 'Print help'
+            cand --help 'Print help'
+            cand -V 'Print version'
+            cand --version 'Print version'
+        }
+        &'zoxide;import;zsh-z'= {
             cand --merge 'Merge into existing database'
             cand -h 'Print help'
             cand --help 'Print help'
```

---

### Incident Patch 6: `4f04fd41` (2026-03-23)
**Commit Message**: ci: add riscv64 to release build matrix (#1201)

---------

Signed-off-by: Bruno Verachten <[REDACTED_EMAIL]>
Co-authored-by: Ajeet D'Souza <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +3/-0)
```diff
@@ -30,6 +30,9 @@ jobs:
           - os: ubuntu-latest
             target: i686-unknown-linux-musl
             deb: true
+          - os: ubuntu-latest
+            target: riscv64gc-unknown-linux-musl
+            deb: true
           - os: ubuntu-latest
             target: aarch64-linux-android
           - os: ubuntu-latest
```

---

### Incident Patch 7: `ce469159` (2026-02-07)
**Commit Message**: install.sh: Prefix global variables

**File**: `install.sh` (modified, +31/-31)
```diff
@@ -19,7 +19,7 @@ main() {
     parse_args "$@"
 
     local _arch
-    _arch="${ARCH:-$(get_architecture)}" || exit $?
+    _arch="${_ZOXIDE_ARCH:-$(get_architecture)}" || exit $?
     assert_nz "${_arch}" "arch"
     echo "Detected architecture: ${_arch}"
 
@@ -54,44 +54,44 @@ main() {
     esac
 
     # Install binary.
-    ensure try_sudo mkdir -p -- "${BIN_DIR}"
-    ensure try_sudo cp -- "${_bin_name}" "${BIN_DIR}/${_bin_name}"
-    ensure try_sudo chmod +x "${BIN_DIR}/${_bin_name}"
-    echo "Installed zoxide to ${BIN_DIR}"
+    ensure try_sudo mkdir -p -- "${_ZOXIDE_BIN_DIR}"
+    ensure try_sudo cp -- "${_bin_name}" "${_ZOXIDE_BIN_DIR}/${_bin_name}"
+    ensure try_sudo chmod +x "${_ZOXIDE_BIN_DIR}/${_bin_name}"
+    echo "Installed zoxide to ${_ZOXIDE_BIN_DIR}"
 
     # Install manpages.
-    ensure try_sudo mkdir -p -- "${MAN_DIR}/man1"
-    ensure try_sudo cp -- "man/man1/"* "${MAN_DIR}/man1/"
-    echo "Installed manpages to ${MAN_DIR}"
+    ensure try_sudo mkdir -p -- "${_ZOXIDE_MAN_DIR}/man1"
+    ensure try_sudo cp -- "man/man1/"* "${_ZOXIDE_MAN_DIR}/man1/"
+    echo "Installed manpages to ${_ZOXIDE_MAN_DIR}"
 
     # Print success message and check $PATH.
     echo ""
     echo "zoxide is installed!"
-    if ! echo ":${PATH}:" | grep -Fq ":${BIN_DIR}:"; then
-        echo "Note: ${BIN_DIR} is not on your \$PATH. zoxide will not work unless it is added to \$PATH."
+    if ! echo ":${PATH}:" | grep -Fq ":${_ZOXIDE_BIN_DIR}:"; then
+        echo "Note: ${_ZOXIDE_BIN_DIR} is not on your \$PATH. zoxide will not work unless it is added to \$PATH."
     fi
 }
 
 # Parse the arguments passed and set variables accordingly.
 parse_args() {
-    BIN_DIR_DEFAULT="${HOME}/.local/bin"
-    MAN_DIR_DEFAULT="${HOME}/.local/share/man"
-    SUDO_DEFAULT="sudo"
+    _ZOXIDE_BIN_DIR_DEFAULT="${HOME}/.local/bin"
+    _ZOXIDE_MAN_DIR_DEFAULT="${HOME}/.local/share/man"
+    _ZOXIDE_SUDO_DEFAULT="sudo"
 
-    BIN_DIR="${BIN_DIR_DEFAULT}"
-    MAN_DIR="${MAN_DIR_DEFAULT}"
-    SUDO="${SUDO_DEFAULT}"
+    _ZOXIDE_BIN_DIR="${_ZOXIDE_BIN_DIR_DEFAULT}"
+    _ZOXIDE_MAN_DIR="${_ZOXIDE_MAN_DIR_DEFAULT}"
+    _ZOXIDE_SUDO="${_ZOXIDE_SUDO_DEFAULT}"
 
     while [ "$#" -gt 0 ]; do
         case "$1" in
-        --arch) ARCH="$2" && shift 2 ;;
-        --arch=*) ARCH="${1#*=}" && shift 1 ;;
-        --bin-dir) BIN_DIR="$2" && shift 2 ;;
-        --bin-dir=*) BIN_DIR="${1#*=}" && shift 1 ;;
-        --man-dir) MAN_DIR="$2" && shift 2 ;;
-        --man-dir=*) MAN_DIR="${1#*=}" && shift 1 ;;
-        --sudo) SUDO="$2" && shift 2 ;;
-        --sudo=*) SUDO="${1#*=}" && shift 1 ;;
+        --arch) _ZOXIDE_ARCH="$2" && shift 2 ;;
+        --arch=*) _ZOXIDE_ARCH="${1#*=}" && shift 1 ;;
+        --bin-dir) _ZOXIDE_BIN_DIR="$2" && shift 2 ;;
+        --bin-dir=*) _ZOXIDE_BIN_DIR="${1#*=}" && shift 1 ;;
+        --man-dir) _ZOXIDE_MAN_DIR="$2" && shift 2 ;;
+        --man-dir=*) _ZOXIDE_MAN_DIR="${1#*=}" && shift 1 ;;
+        --sudo) _ZOXIDE_SUDO="$2" && shift 2 ;;
+        --sudo=*) _ZOXIDE_SUDO="${1#*=}" && shift 1 ;;
         -h | --help) usage && exit 0 ;;
         *) err "Unknown option: $1" ;;
         esac
@@ -119,9 +119,9 @@ ${_text_heading}Usage:${_text_reset}
 
 ${_text_heading}Options:${_text_reset}
       --arch     Override the architecture identified by the installer [current: ${_arch}]
-      --bin-dir  Override the installation directory [default: ${BIN_DIR_DEFAULT}]
-      --man-dir  Override the manpage installation directory [default: ${MAN_DIR_DEFAULT}]
-      --sudo     Override the command used to elevate to root privileges [default: ${SUDO_DEFAULT}]
+      --bin-dir  Override the installation directory [default: ${_ZOXIDE_BIN_DIR_DEFAULT}]
+      --man-dir  Override the manpage installation directory [default: ${_ZOXIDE_MAN_DIR_DEFAULT}]
+      --sudo     Override the command used to elevate to root privileges [default: ${_ZOXIDE_SUDO_DEFAULT}]
   -h, --help     Print help"
 }
 
@@ -176,19 +176,19 @@ try_sudo() {
     fi
 
     need_sudo
-    "${SUDO}" "$@"
+    "${_ZOXIDE_SUDO}" "$@"
 }
 
 need_sudo() {
-    if ! check_cmd "${SUDO}"; then
+    if ! check_cmd "${_ZOXIDE_SUDO}"; then
         err "\
-could not find the command \`${SUDO}\` needed to get permissions for install.
+could not find the command \`${_ZOXIDE_SUDO}\` needed to get permissions for install.
 
 If you are on Windows, please run your shell as an administrator, then rerun this script.
 Otherwise, please run this script as root, or install \`sudo\`."
     fi
 
-    if ! "${SUDO}" -v; then
+    if ! "${_ZOXIDE_SUDO}" -v; then
         err "sudo permissions not granted, aborting installation"
     fi
 }
```

---

### Incident Patch 8: `d304543d` (2025-11-18)
**Commit Message**: Remove uses of builtin from POSIX (#1146)

**File**: `templates/posix.txt` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@
 # pwd based on the value of _ZO_RESOLVE_SYMLINKS.
 __zoxide_pwd() {
 {%- if cfg!(windows) %}
-    \command cygpath -w "$(\builtin pwd -P)"
+    \command cygpath -w "$(\command pwd -P)"
 {%- else if resolve_symlinks %}
     \command pwd -P
 {%- else %}
@@ -35,7 +35,7 @@ __zoxide_cd() {
 {%- when InitHook::Prompt -%}
 # Hook to add new entries to the database.
 __zoxide_hook() {
-    \command zoxide add -- "$(__zoxide_pwd || \builtin true)"
+    \command zoxide add -- "$(__zoxide_pwd || \command true)"
 }
 
 # Initialize hook.
@@ -95,7 +95,7 @@ __zoxide_z() {
     elif [ "$#" -eq 1 ] && [ -d "$1" ]; then
         __zoxide_cd "$1"
     else
-        __zoxide_result="$(\command zoxide query --exclude "$(__zoxide_pwd || \builtin true)" -- "$@")" &&
+        __zoxide_result="$(\command zoxide query --exclude "$(__zoxide_pwd || \command true)" -- "$@")" &&
             __zoxide_cd "${__zoxide_result}"
     fi
 }
```

---

### Incident Patch 9: `ee8bbe57` (2025-05-16)
**Commit Message**: Fixed the arg[0] argument position (#1056)

**File**: `templates/powershell.txt` (modified, +2/-2)
```diff
@@ -106,10 +106,10 @@ function global:__zoxide_z {
     elseif ($args.Length -eq 1 -and ($args[0] -eq '-' -or $args[0] -eq '+')) {
         __zoxide_cd $args[0] $false
     }
-    elseif ($args.Length -eq 1 -and (Test-Path $args[0] -PathType Container -LiteralPath)) {
+    elseif ($args.Length -eq 1 -and (Test-Path -PathType Container -LiteralPath $args[0])) {
         __zoxide_cd $args[0] $true
     }
-    elseif ($args.Length -eq 1 -and (Test-Path $args[0] -PathType Container -Path)) {
+    elseif ($args.Length -eq 1 -and (Test-Path -PathType Container -Path $args[0] )) {
         __zoxide_cd $args[0] $false
     }
     else {
```

---

### Incident Patch 10: `628f8542` (2025-05-13)
**Commit Message**: Fixes #995: Wildcard expansion for PowerShell (#1001)

Co-authored-by: Ajeet D'Souza <[REDACTED_EMAIL]>

**File**: `templates/powershell.txt` (modified, +4/-1)
```diff
@@ -106,9 +106,12 @@ function global:__zoxide_z {
     elseif ($args.Length -eq 1 -and ($args[0] -eq '-' -or $args[0] -eq '+')) {
         __zoxide_cd $args[0] $false
     }
-    elseif ($args.Length -eq 1 -and (Test-Path $args[0] -PathType Container)) {
+    elseif ($args.Length -eq 1 -and (Test-Path $args[0] -PathType Container -LiteralPath)) {
         __zoxide_cd $args[0] $true
     }
+    elseif ($args.Length -eq 1 -and (Test-Path $args[0] -PathType Container -Path)) {
+        __zoxide_cd $args[0] $false
+    }
     else {
         $result = __zoxide_pwd
         if ($null -ne $result) {
```

---

### Incident Patch 11: `8e140388` (2025-05-12)
**Commit Message**: Fix lints

**File**: `templates/posix.txt` (modified, +2/-1)
```diff
@@ -50,7 +50,8 @@ __zoxide_doctor() {
 {%- else %}
     [ "${_ZO_DOCTOR:-1}" -eq 0 ] && return 0
     case "${PS1:-}" in
-        *__zoxide_hook*) return 0 ;;
+    *__zoxide_hook*) return 0 ;;
+    *) ;;
     esac
 
     _ZO_DOCTOR=0
```

---

### Incident Patch 12: `306d7ae1` (2025-05-11)
**Commit Message**: Fix shellcheck lint

**File**: `templates/bash.txt` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ function __zoxide_doctor() {
 {%- else %}
     [[ ${_ZO_DOCTOR:-1} -eq 0 ]] && return 0
     [[ ${PROMPT_COMMAND:-} == *'__zoxide_hook'* ]] && return 0
+    # shellcheck disable=SC2199
     [[ ${__vsc_original_prompt_command[@]:-} == *'__zoxide_hook'* ]] && return 0
 
     _ZO_DOCTOR=0
```

#### Recent Merged Pull Requests:
- **PR #1317** (2026-10-03): Define __zoxide_doctor for all hooks in POSIX init (@ajeetdsouza)
- **PR #1314** (2026-10-01): Fix panic on closed stdout in query --interactive (@Mathjk)
- **PR #1312** (2026-10-01): Bump taiki-e/install-action from 2.87.20 to 2.87.21 (@dependabot[bot])
- **PR #1309** (2026-09-28): Bump taiki-e/install-action from 2.87.15 to 2.87.20 (@dependabot[bot])
- **PR #1305** (2026-09-21): Bump taiki-e/install-action from 2.87.11 to 2.87.15 (@dependabot[bot])
- **PR #1304** (2026-09-14): Bump taiki-e/install-action from 2.87.5 to 2.87.11 (@dependabot[bot])
- **PR #1301** (2026-09-08): Bump taiki-e/install-action from 2.87.0 to 2.87.5 (@dependabot[bot])
- **PR #1296** (2026-08-31): Bump taiki-e/install-action from 2.86.5 to 2.87.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
