# Forensic Learning Record (Deep Inspection): timvisee/ffsend

> **Canonical Artifact**: `07_PROJECT_LEARNING/timvisee-ffsend-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/timvisee/ffsend](https://github.com/timvisee/ffsend))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:59:37.980Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `timvisee/ffsend`
- **Description**: :mailbox_with_mail: Easily and securely share files from the command line. A fully featured Firefox Send client.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7419 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/util.rs`
```
#[cfg(feature = "clipboard-crate")]
extern crate clip;
#[cfg(feature = "clipboard-bin")]
extern crate which;

use std::borrow::Borrow;
use std::env::{self, current_exe, var_os};
use std::ffi::OsStr;
#[cfg(feature = "clipboard")]
use std::fmt;
use std::fmt::{Debug, Display};
#[cfg(feature = "clipboard-bin")]
use std::io::ErrorKind as IoErrorKind;
use std::io::{self, Read};
use std::io::{stderr, stdin, Error as IoError, Write};
use std::iter;
use std::path::Path;
use std::path::PathBuf;
use std::process::exit;
#[cfg(feature = "clipboard-bin")]
use std::process::{Command, Stdio};

#[cfg(feature = "clipboard-crate")]
use self::clip::{ClipboardContext, ClipboardProvider};
use chrono::Duration;
use colored::*;
#[cfg(feature = "history")]
use directories::ProjectDirs;
use failure::{err_msg, Fail};
#[cfg(feature = "clipboard-crate")]
use failure::{Compat, Error};
use ffsend_api::{
    api::request::{ensure_success, ResponseError},
    client::Client,
    reqwest,
    url::Url,
};
use fs2::available_space;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use regex::Regex;
use rpassword::prompt_password_stderr;
#[cfg(feature = "clipboard-bin")]
use which::which;

use crate::cmd::matcher::MainMatcher;

/// Print a success message.
pub fn print_success(msg: &str) {
    eprintln!("{}", msg.green());
}

/// Print the given error in a proper format for the user,
/// with it's causes.
pub fn print_error<E: Fail>(err: impl Borrow<E>) {
    // Report each printable error, count them
    let count = err
        .borrow()
        .causes()
        .map(|err| format!("{}", err))
        .filter(|err| !err.is_empty())
        .enumerate()
        .map(|(i, err)| {
            if i == 0 {
                eprintln!("{} {}", highlight_error("error:"), err);
            } else {
                eprintln!("{} {}", highlight_error("caused by:"), err);
            }
        })
        .count();

    // Fall back to a basic message
    if count == 0 {
        eprintln!(
            "{} {}",
            highlight_error("error:"),
            "an undefined error occurred"
        );
    }
}

/// Print the given error message in a proper format for the user,
/// with it's causes.
pub fn print_error_msg<S>(err: S)
where
    S: AsRef<str> + Display + Debug + Sync + Send + 'static,
{
    print_error(err_msg(err).compat());
}

/// Print a warning.
pub fn print_warning<S>(err: S)
where
    S: AsRef<str> + Display + Debug + Sync + Send + 'static,
{
    eprintln!("{} {}", highlight_warning("warning:"), err);
}

/// Quit the application regularly.
pub fn quit() -> ! {
    exit(0);
}

/// Quit the application with an error code,
/// and print the given error.
pub fn quit_error<E: Fail>(err: E, hints: impl Borrow<ErrorHints>) -> ! {
    // Print the error
    print_error(err);

    // Print error hints
    hints.borrow().print();

    // Quit
    exit(1);
}

/// Quit the application with an error code,
/// and print the given error message.
pub fn quit_error_msg<S>(err: S, hints: impl Borrow<ErrorHints>) -> !
where
    S: AsRef<str> + Display + Debug + Sync + Send + 'static,
{
    quit_error(err_msg(err).compat(), hints);
}

/// The error hint configuration.
#[derive(Clone, Builder)]
#[builder(default)]
pub struct ErrorHints {
    /// Show about specifying an API version.
    api: bool,

    /// A list of info messages to print along with the error.
    info: Vec<String>,

    /// Show about the name option.
    name: bool,

    /// Show about the password option.
    password: bool,

    /// Show about the owner option.
    owner: bool,

    /// Show about the history flag.
    #[cfg(feature = "history")]
    history: bool,

    /// Show about the force flag.
    force: bool,

    /// Show about the verbose flag.
    verbose: bool,

    /// Show about the help flag.
    help: bool,
}

impl ErrorHints {
    /// Check whether any hint should be printed.
    pub fn any(&self) -> bool {
        // Determine the result
        #[allow(unused_mut)]
        let mut result =
            self.name || self.password || self.owner || self.force || self.verbose || self.help;

        // Factor in the history hint when enabled
        #[cfg(feature = "history")]
        {
            result = result || self.history;
        }

        result
    }

    /// Print the error hints.
    pub fn print(&self) {
        // Print info messages
        for msg in &self.info {
            eprintln!("{} {}", highlight_info("info:"), msg);
        }

        // Stop if nothing should be printed
        if !self.any() {
            return;
        }

        eprint!("\n");

        // Print hints
        if self.api {
            eprintln!(
                "Use '{}' to select a server API version",
                highlight("--api <VERSION>")
            );
        }
        if self.name {
            eprintln!(
                "Use '{}' to specify a file name",
                highlight("--name <NAME>")
            );
        }
        if self.password {
            eprintln!(
                "Use '{}' to specify a password",
                highlight("--password <PASSWORD>")
            );
        }
        if self.owner {
            eprintln!(
                "Use '{}' to specify an owner token",
                highlight("--owner <TOKEN>")
            );
        }
        #[cfg(feature = "history")]
        {
            if self.history {
                eprintln!(
                    "Use '{}' to specify a history file",
                    highlight("--history <FILE>")
                );
            }
        }
        if self.force {
            eprintln!("Use '{}' to force", highlight("--force"));
        }
        if self.verbose {
            eprintln!("For detailed errors try '{}'", highlight("--verbose"));
        }
        if self.help {
            eprintln!("For more information try '{}'", highlight("--help"));
        }

        // Flush
        let _ = stderr().flush();
    }
}

impl Default for ErrorHints {
    fn default() -> Self {
        ErrorHints {
            api: false,
            info: Vec::new(),
            name: false,
            password: false,
            owner: false,
            #[cfg(feature = "history")]
            history: false,
            force: false,
            verbose: true,
            help: true,
        }
    }
}

impl ErrorHintsBuilder {
    /// Add a single info entry.
    pub fn add_info(mut self, info: String) -> Self {
        // Initialize the info list
        if self.info.is_none() {
            self.info = Some(Vec::new());
        }

        // Add the item to the info list
        if let Some(ref mut list) = self.info {
            list.push(info);
        }

        self
    }
}

/// Highlight the given text with a color.
pub fn highlight(msg: &str) -> ColoredString {
    msg.yellow()
}

/// Highlight the given text with an error color.
pub fn highlight_error(msg: &str) -> ColoredString {
    msg.red().bold()
}

/// Highlight the given text with an warning color.
pub fn highlight_warning(msg: &str) -> ColoredString {
    highlight(msg).bold()
}

/// Highlight the given text with an info color
pub fn highlight_info(msg: &str) -> ColoredString {
    msg.cyan()
}

/// Open the given URL in the users default browser.
/// The browsers exit status is returned.
pub fn open_url(url: impl Borrow<Url>) -> Result<(), IoError> {
    open_path(url.borrow().as_str())
}

/// Open the given path or URL using the program configured on the system.
/// The program exit status is returned.
pub fn open_path(path: &str) -> Result<(), IoError> {
    open::that(path)
}

/// Set the clipboard of the user to the given `content` string.
#[cfg(feature = "clipboard")]
pub fn set_clipboard(content: String) -> Result<(), ClipboardError> {
    ClipboardType::select().set(content)
}

/// Clipboard management enum.
///
/// Defines which method of setting the clipboard is used.
/// Invoke `ClipboardType::select()` to select the best variant to use determined at runtime.
///
/// Usually, the `Native` variant is used. However, on Linux system a different variant will be
/// selected which will call a system binary to set the clipboard. This must be done because the
/// native clipboard interface only has a lifetime of the application. This means that the
/// clipboard is instantly cleared as soon as this application quits, which is always immediately.
/// This limitation is due to security reasons as defined by X11. The alternative binaries we set
/// the clipboard with spawn a daemon in the background to keep the clipboard alive until it's
/// flushed.
#[cfg(feature = "clipboard")]
#[derive(Clone, Eq, PartialEq)]
pub enum ClipboardType {
    /// Native operating system clipboard.
    #[cfg(feature = "clipboard-crate")]
    Native,

    /// Manage clipboard through `xclip` on Linux.
    ///
    /// May contain a binary path if specified at compile time through the `XCLIP_PATH` variable.
    #[cfg(feature = "clipboard-bin")]
    Xclip(Option<String>),

    /// Manage clipboard through `xsel` on Linux.
    ///
    /// May contain a binary path if specified at compile time through the `XSEL_PATH` variable.
    #[cfg(feature = "clipboard-bin")]
    Xsel(Option<String>),
}

#[cfg(feature = "clipboard")]
impl ClipboardType {
    /// Select the clipboard type to use, depending on the runtime system.
    pub fn select() -> Self {
        #[cfg(feature = "clipboard-crate")]
        {
            ClipboardType::Native
        }

        #[cfg(feature = "clipboard-bin")]
        {
            if let Some(path) = option_env!("XCLIP_PATH") {
                ClipboardType::Xclip(Some(path.to_owned()))
            } else if let Some(path) = option_env!("XSEL_PATH") {
                ClipboardType::Xsel(Some(path.to_owned()))
            } else if which("xclip").is_ok() {
                ClipboardType::Xclip(None)
            } else if which("xsel").is_ok() {
                ClipboardType::Xsel(None)
            } else {
                // TODO: sh
```

### Core Architecture Module: `src/action/debug.rs`
```
use chrono::Duration;
use clap::ArgMatches;
use ffsend_api::config::SEND_DEFAULT_EXPIRE_TIME;
use prettytable::{format::FormatBuilder, Cell, Row, Table};

use crate::client::to_duration;
use crate::cmd::matcher::{debug::DebugMatcher, main::MainMatcher, Matcher};
use crate::error::ActionError;
#[cfg(feature = "clipboard-bin")]
use crate::util::ClipboardType;
use crate::util::{api_version_list, features_list, format_bool, format_duration};

/// A file debug action.
pub struct Debug<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Debug<'a> {
    /// Construct a new debug action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the debug action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), ActionError> {
        // Create the command matchers
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
        let matcher_debug = DebugMatcher::with(self.cmd_matches).unwrap();

        // Create a table for all debug information
        let mut table = Table::new();
        table.set_format(FormatBuilder::new().padding(0, 2).build());

        // The crate version
        table.add_row(Row::new(vec![
            Cell::new("Version:"),
            Cell::new(crate_version!()),
        ]));

        // The default host
        table.add_row(Row::new(vec![
            Cell::new("Host:"),
            Cell::new(matcher_debug.host().as_str()),
        ]));

        // The history file
        #[cfg(feature = "history")]
        table.add_row(Row::new(vec![
            Cell::new("History file:"),
            Cell::new(matcher_main.history().to_str().unwrap_or("?")),
        ]));

        // The timeouts
        table.add_row(Row::new(vec![
            Cell::new("Timeout:"),
            Cell::new(
                &to_duration(matcher_main.timeout())
                    .map(|t| {
                        format_duration(
                            Duration::from_std(t).expect("failed to convert timeout duration"),
                        )
                    })
                    .unwrap_or("disabled".into()),
            ),
        ]));
        table.add_row(Row::new(vec![
            Cell::new("Transfer timeout:"),
            Cell::new(
                &to_duration(matcher_main.transfer_timeout())
                    .map(|t| {
                        format_duration(
                            Duration::from_std(t)
                                .expect("failed to convert transfer timeout duration"),
                        )
                    })
                    .unwrap_or("disabled".into()),
            ),
        ]));

        // The default host
        table.add_row(Row::new(vec![
            Cell::new("Default expiry:"),
            Cell::new(&format_duration(Duration::seconds(
                SEND_DEFAULT_EXPIRE_TIME as i64,
            ))),
        ]));

        // Render a list of compiled features
        table.add_row(Row::new(vec![
            Cell::new("Features:"),
            Cell::new(&features_list().join(", ")),
        ]));

        // Render a list of compiled features
        table.add_row(Row::new(vec![
            Cell::new("API support:"),
            Cell::new(&api_version_list().join(", ")),
        ]));

        // Show used crypto backend
        table.add_row(Row::new(vec![
            Cell::new("Crypto backend:"),
            #[cfg(feature = "crypto-ring")]
            Cell::new("ring"),
            #[cfg(feature = "crypto-openssl")]
            Cell::new("OpenSSL"),
        ]));

        // Clipboard information
        #[cfg(feature = "clipboard-bin")]
        table.add_row(Row::new(vec![
            Cell::new("Clipboard:"),
            Cell::new(&format!("{}", ClipboardType::select())),
        ]));

        // Show whether quiet is used
        table.add_row(Row::new(vec![
            Cell::new("Quiet:"),
            Cell::new(format_bool(matcher_main.quiet())),
        ]));

        // Show whether verbose is used
        table.add_row(Row::new(vec![
            Cell::new("Verbose:"),
            Cell::new(format_bool(matcher_main.verbose())),
        ]));

        // Print the debug table
        table.printstd();

        Ok(())
    }
}

```

### Core Architecture Module: `src/action/delete.rs`
```
use clap::ArgMatches;
use ffsend_api::action::delete::{Delete as ApiDelete, Error as DeleteError};
use ffsend_api::file::remote_file::{FileParseError, RemoteFile};

use crate::client::create_config;
use crate::cmd::matcher::{delete::DeleteMatcher, main::MainMatcher, Matcher};
use crate::error::ActionError;
#[cfg(feature = "history")]
use crate::history_tool;
use crate::util::{ensure_owner_token, print_success};

/// A file delete action.
pub struct Delete<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Delete<'a> {
    /// Construct a new delete action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the delete action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), ActionError> {
        // Create the command matchers
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
        let matcher_delete = DeleteMatcher::with(self.cmd_matches).unwrap();

        // Get the share link
        let url = matcher_delete.url();

        // Create client
        let client_config = create_config(&matcher_main);
        let client = client_config.client(false);

        // Parse the remote file based on the share link, derive the owner token from history
        let mut file = RemoteFile::parse_url(url, matcher_delete.owner())?;
        #[cfg(feature = "history")]
        history_tool::derive_file_properties(&matcher_main, &mut file);

        // Ensure the owner token is set
        ensure_owner_token(file.owner_token_mut(), &matcher_main, false);

        // Send the file deletion request
        let result = ApiDelete::new(&file, None).invoke(&client);
        if let Err(DeleteError::Expired) = result {
            // Remove the file from the history manager if it does not exist
            #[cfg(feature = "history")]
            history_tool::remove(&matcher_main, &file);
        }
        result?;

        // Remove the file from the history manager
        #[cfg(feature = "history")]
        history_tool::remove(&matcher_main, &file);

        // Print a success message
        print_success("File deleted");

        Ok(())
    }
}

#[derive(Debug, Fail)]
pub enum Error {
    /// Failed to parse a share URL, it was invalid.
    /// This error is not related to a specific action.
    #[fail(display = "invalid share link")]
    InvalidUrl(#[cause] FileParseError),

    /// Could not delete, the file has expired or did never exist.
    #[fail(display = "the file has expired or did never exist")]
    Expired,

    /// An error occurred while deleting the remote file.
    #[fail(display = "failed to delete the shared file")]
    Delete(#[cause] DeleteError),
}

impl From<FileParseError> for Error {
    fn from(err: FileParseError) -> Error {
        Error::InvalidUrl(err)
    }
}

impl From<DeleteError> for Error {
    fn from(err: DeleteError) -> Error {
        match err {
            DeleteError::Expired => Error::Expired,
            err => Error::Delete(err),
        }
    }
}

```

### Core Architecture Module: `src/action/download.rs`
```
use std::env::current_dir;
use std::fs::create_dir_all;
#[cfg(feature = "archive")]
use std::io::Error as IoError;
use std::path::{self, PathBuf};
use std::sync::{Arc, Mutex};

use clap::ArgMatches;
use failure::Fail;
use ffsend_api::action::download::{Download as ApiDownload, Error as DownloadError};
use ffsend_api::action::exists::{Error as ExistsError, Exists as ApiExists};
use ffsend_api::action::metadata::{Error as MetadataError, Metadata as ApiMetadata};
use ffsend_api::action::version::Error as VersionError;
use ffsend_api::file::remote_file::{FileParseError, RemoteFile};
use ffsend_api::pipe::ProgressReporter;
#[cfg(feature = "archive")]
use tempfile::{Builder as TempBuilder, NamedTempFile};

use super::select_api_version;
#[cfg(feature = "archive")]
use crate::archive::archive::Archive;
use crate::client::create_config;
use crate::cmd::matcher::{download::DownloadMatcher, main::MainMatcher, Matcher};
#[cfg(feature = "history")]
use crate::history_tool;
use crate::progress::ProgressBar;
use crate::util::{
    ensure_enough_space, ensure_password, follow_url, print_error, prompt_yes, quit, quit_error,
    quit_error_msg, ErrorHints,
};

/// A file download action.
pub struct Download<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Download<'a> {
    /// Construct a new download action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the download action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), Error> {
        // Create the command matchers
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
        let matcher_download = DownloadMatcher::with(self.cmd_matches).unwrap();

        // Create a regular client
        let client_config = create_config(&matcher_main);
        let client = client_config.clone().client(false);

        // Get the share URL, attempt to follow it
        let url = matcher_download.url();
        let url = match follow_url(&client, &url) {
            Ok(url) => url,
            Err(err) => {
                print_error(err.context("failed to follow share URL, ignoring").compat());
                url
            }
        };

        // Guess the host
        let host = matcher_download.guess_host(Some(url.clone()));

        // Determine the API version to use
        let mut desired_version = matcher_main.api();
        select_api_version(&client, host, &mut desired_version)?;
        let api_version = desired_version.version().unwrap();

        // Parse the remote file based on the share URL
        let file = RemoteFile::parse_url(url, None)?;

        // Get the target file or directory, and the password
        let target = matcher_download.output();
        let mut password = matcher_download.password();

        // Check whether the file exists
        let exists = ApiExists::new(&file).invoke(&client)?;
        if !exists.exists() {
            // Remove the file from the history manager if it does not exist
            #[cfg(feature = "history")]
            history_tool::remove(&matcher_main, &file);

            return Err(Error::Expired);
        }

        // Ensure a password is set when required
        ensure_password(
            &mut password,
            exists.requires_password(),
            &matcher_main,
            false,
        );

        // Fetch the file metadata
        let metadata = ApiMetadata::new(&file, password.clone(), false).invoke(&client)?;

        // A temporary archive file, only used when archiving
        // The temporary file is stored here, to ensure it's lifetime exceeds the upload process
        #[cfg(feature = "archive")]
        let mut tmp_archive: Option<NamedTempFile> = None;

        // Check whether to extract
        #[cfg(feature = "archive")]
        let mut extract = matcher_download.extract();

        #[cfg(feature = "archive")]
        {
            // Ask to extract if downloading an archive
            if !extract && metadata.metadata().is_archive() {
                if prompt_yes(
                    "You're downloading an archive, extract it into the selected directory?",
                    Some(true),
                    &matcher_main,
                ) {
                    extract = true;
                }
            }
        }

        // Prepare the download target and output path to use
        #[cfg(feature = "archive")]
        let output_dir = !extract;
        #[cfg(not(feature = "archive"))]
        let output_dir = false;
        #[allow(unused_mut)]
        let mut target = Self::prepare_path(
            &target,
            metadata.metadata().name(),
            &matcher_main,
            output_dir,
        );
        #[cfg(feature = "archive")]
        let output_path = target.clone();

        #[cfg(feature = "archive")]
        {
            // Allocate an archive file, and update the download and target paths
            if extract {
                // TODO: select the extension dynamically
                let archive_extention = ".tar";

                // Allocate a temporary file to download the archive to
                tmp_archive = Some(
                    TempBuilder::new()
                        .prefix(&format!(".{}-archive-", crate_name!()))
                        .suffix(archive_extention)
                        .tempfile()
                        .map_err(ExtractError::TempFile)?,
                );
                if let Some(tmp_archive) = &tmp_archive {
                    target = tmp_archive.path().to_path_buf();
                }
            }
        }

        // Ensure there is enough disk space available when not being forced
        if !matcher_main.force() {
            ensure_enough_space(target.parent().unwrap(), metadata.size());
        }

        // Create a progress bar reporter
        let progress_bar = Arc::new(Mutex::new(ProgressBar::new_download()));
        let progress_reader: Arc<Mutex<dyn ProgressReporter>> = progress_bar;

        // Create a transfer client
        let transfer_client = client_config.client(true);

        // Execute an download action
        let progress = if !matcher_main.quiet() {
            Some(progress_reader)
        } else {
            None
        };
        ApiDownload::new(api_version, &file, target, password, false, Some(metadata))
            .invoke(&transfer_client, progress)?;

        // Extract the downloaded file if working with an archive
        #[cfg(feature = "archive")]
        {
            if extract {
                eprintln!("Extracting...");

                // Extract the downloaded file
                Archive::new(tmp_archive.unwrap().into_file())
                    .extract(output_path)
                    .map_err(ExtractError::Extract)?;
            }
        }

        // Add the file to the history
        #[cfg(feature = "history")]
        history_tool::add(&matcher_main, file, true);

        // TODO: open the file, or it's location
        // TODO: copy the file location

        Ok(())
    }

    /// This methods prepares a full file path to use for the file to
    /// download, based on the current directory, the original file name,
    /// and the user input.
    /// If `file` is set to false, no file name is included and the path
    /// will point to a directory.
    ///
    /// If no file name was given, the original file name is used.
    ///
    /// The full path including the name is returned.
    ///
    /// This method will check whether a file is overwritten, and whether
    /// parent directories must be created.
    ///
    /// The program will quit with an error message if a problem occurs.
    fn prepare_path(
        target: &PathBuf,
        name_hint: &str,
        main_matcher: &MainMatcher,
        file: bool,
    ) -> PathBuf {
        // Select the path to use
        let mut target = Self::select_path(&target, name_hint);

        // Use the parent directory, if we don't want a file
        if !file {
            target = target.parent().unwrap().to_path_buf();
        }

        // Ask to overwrite
        if file && target.exists() && !main_matcher.force() {
            eprintln!(
                "The path '{}' already exists",
                target.to_str().unwrap_or("?"),
            );
            if !prompt_yes("Overwrite?", None, main_matcher) {
                println!("Download cancelled");
                quit();
            }
        }

        {
            // Get the deepest directory, as we have to ensure it exists
            let dir = if file {
                match target.parent() {
                    Some(parent) => parent,
                    None => quit_error_msg("invalid output file path", ErrorHints::default()),
                }
            } else {
                &target
            };

            // Ensure the directory exists
            if !dir.is_dir() {
                // Prompt to create them if not forced
                if !main_matcher.force() {
                    eprintln!(
                        "The directory '{}' doesn't exists",
                        dir.to_str().unwrap_or("?"),
                    );
                    if !prompt_yes("Create it?", Some(true), main_matcher) {
                        println!("Download cancelled");
                        quit();
                    }
                }

                // Create the parent directories
                if let Err(err) = create_dir_all(dir) {
                    quit_error(
                        err.context("failed to create parent directories for output file"),
                        ErrorHints::default(),
                    );
                }
            }
        }

        target
    }

    /// This methods prepares a full file path to use for the file to
    /// download, based on the current directory, the original file name,
    /// and the user input.
    ///
    /// If no file name was given, the origi
```

### Core Architecture Module: `src/action/exists.rs`
```
use clap::ArgMatches;
use ffsend_api::action::exists::{Error as ExistsError, Exists as ApiExists};
use ffsend_api::file::remote_file::{FileParseError, RemoteFile};

use crate::client::create_config;
use crate::cmd::matcher::main::MainMatcher;
use crate::cmd::matcher::{exists::ExistsMatcher, Matcher};
use crate::error::ActionError;
#[cfg(feature = "history")]
use crate::history_tool;

/// A file exists action.
pub struct Exists<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Exists<'a> {
    /// Construct a new exists action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the exists action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), ActionError> {
        // Create the command matchers
        let matcher_exists = ExistsMatcher::with(self.cmd_matches).unwrap();
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();

        // Get the share URL
        let url = matcher_exists.url();

        // Create a reqwest client
        let client_config = create_config(&matcher_main);
        let client = client_config.client(false);

        // Parse the remote file based on the share URL
        let file = RemoteFile::parse_url(url, None)?;

        // Make sure the file exists
        let exists_response = ApiExists::new(&file).invoke(&client)?;
        let exists = exists_response.exists();

        // Print the results
        println!("Exists: {:?}", exists);
        if exists {
            println!("Password: {:?}", exists_response.requires_password());
        }

        // Add or remove the file from the history
        #[cfg(feature = "history")]
        {
            if exists {
                history_tool::add(&matcher_main, file, false);
            } else {
                history_tool::remove(&matcher_main, &file);
            }
        }

        Ok(())
    }
}

#[derive(Debug, Fail)]
pub enum Error {
    /// Failed to parse a share URL, it was invalid.
    /// This error is not related to a specific action.
    #[fail(display = "invalid share link")]
    InvalidUrl(#[cause] FileParseError),

    /// An error occurred while checking if the file exists.
    #[fail(display = "failed to check whether the file exists")]
    Exists(#[cause] ExistsError),
}

impl From<FileParseError> for Error {
    fn from(err: FileParseError) -> Error {
        Error::InvalidUrl(err)
    }
}

impl From<ExistsError> for Error {
    fn from(err: ExistsError) -> Error {
        Error::Exists(err)
    }
}

```

### Core Architecture Module: `src/action/generate/completions.rs`
```
use std::fs;
use std::io;

use clap::ArgMatches;

use crate::cmd::matcher::{generate::completions::CompletionsMatcher, main::MainMatcher, Matcher};
use crate::error::ActionError;

/// A file completions action.
pub struct Completions<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Completions<'a> {
    /// Construct a new completions action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the completions action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), ActionError> {
        // Create the command matchers
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
        let matcher_completions = CompletionsMatcher::with(self.cmd_matches).unwrap();

        // Obtain shells to generate completions for, build application definition
        let shells = matcher_completions.shells();
        let dir = matcher_completions.output();
        let quiet = matcher_main.quiet();
        let mut app = crate::cmd::handler::Handler::build();

        // If the directory does not exist yet, attempt to create it
        if !dir.is_dir() {
            fs::create_dir_all(&dir).map_err(Error::CreateOutputDir)?;
        }

        // Generate completions
        for shell in shells {
            if !quiet {
                eprint!(
                    "Generating completions for {}...",
                    format!("{}", shell).to_lowercase()
                );
            }
            app.gen_completions(crate_name!(), shell, &dir);
            if !quiet {
                eprintln!(" done.");
            }
        }

        Ok(())
    }
}

#[derive(Debug, Fail)]
pub enum Error {
    /// An error occurred while creating the output directory.
    #[fail(display = "failed to create output directory, it doesn't exist")]
    CreateOutputDir(#[cause] io::Error),
}

```

### Core Architecture Module: `src/action/generate/mod.rs`
```
pub mod completions;

use clap::ArgMatches;

use crate::cmd::matcher::{generate::GenerateMatcher, Matcher};
use crate::error::ActionError;
use completions::Completions;

/// A file generate action.
pub struct Generate<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Generate<'a> {
    /// Construct a new generate action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the generate action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), ActionError> {
        // Create the command matcher
        let matcher_generate = GenerateMatcher::with(self.cmd_matches).unwrap();

        // Match shell completions
        if matcher_generate.matcher_completions().is_some() {
            return Completions::new(self.cmd_matches).invoke();
        }

        // Unreachable, clap will print help for missing sub command instead
        unreachable!()
    }
}

```

### Core Architecture Module: `src/action/history.rs`
```
use clap::ArgMatches;
use failure::Fail;
use prettytable::{format::FormatBuilder, Cell, Row, Table};

use crate::cmd::matcher::{history::HistoryMatcher, main::MainMatcher, Matcher};
use crate::error::ActionError;
use crate::history::{History as HistoryManager, LoadError as HistoryLoadError};
use crate::util::{format_duration, quit_error, quit_error_msg, ErrorHintsBuilder};

/// A history action.
pub struct History<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> History<'a> {
    /// Construct a new history action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the history action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), ActionError> {
        // Create the command matchers
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
        let matcher_history = HistoryMatcher::with(self.cmd_matches).unwrap();

        // Get the history path, make sure it exists
        let history_path = matcher_main.history();
        if !history_path.is_file() {
            if !matcher_main.quiet() {
                eprintln!("No files in history");
            }
            return Ok(());
        }

        // History
        let mut history = HistoryManager::load(history_path)?;

        // Do not report any files if there aren't any
        if history.files().is_empty() {
            if !matcher_main.quiet() {
                eprintln!("No files in history");
            }
            return Ok(());
        }

        // Clear all history
        if matcher_history.clear() {
            history.clear();

            // Save history
            if let Err(err) = history.save() {
                quit_error(
                    err,
                    ErrorHintsBuilder::default().verbose(true).build().unwrap(),
                );
            }

            eprintln!("History cleared");
            return Ok(());
        }

        // Remove history item
        if let Some(url) = matcher_history.rm() {
            // Remove item, print error if no item with URL was found
            match history.remove_url(url) {
                Ok(removed) if !removed => quit_error_msg(
                    "could not remove item from history, no item matches given URL",
                    ErrorHintsBuilder::default().verbose(true).build().unwrap(),
                ),
                Err(err) => quit_error(
                    err.context("could not remove item from history"),
                    ErrorHintsBuilder::default().verbose(true).build().unwrap(),
                ),
                _ => {}
            }

            // Save history
            if let Err(err) = history.save() {
                quit_error(
                    err,
                    ErrorHintsBuilder::default().verbose(true).build().unwrap(),
                );
            }

            eprintln!("Item removed from history");
            return Ok(());
        }

        // Get the list of files, and sort the first expiring files to be last
        let mut files = history.files().clone();
        files.sort_by(|a, b| b.expire_at().cmp(&a.expire_at()));

        // Log a history table, or just the URLs in quiet mode
        if !matcher_main.quiet() {
            // Build the list of column names
            let mut columns = vec!["#", "LINK", "EXPIRE"];
            if matcher_main.verbose() {
                columns.push("OWNER TOKEN");
            }

            // Create a new table
            let mut table = Table::new();
            table.set_format(FormatBuilder::new().padding(0, 2).build());
            table.add_row(Row::new(columns.into_iter().map(Cell::new).collect()));

            // Add an entry for each file
            for (i, file) in files.iter().enumerate() {
                // Build the expiry time string
                let mut expiry = format_duration(&file.expire_duration());
                if file.expire_uncertain() {
                    expiry.insert(0, '~');
                }

                // Get the owner token
                let owner_token: String = match file.owner_token() {
                    Some(token) => token.clone(),
                    None => "?".into(),
                };

                // Define the cell values
                let mut cells: Vec<String> =
                    vec![format!("{}", i + 1), file.download_url(true).into(), expiry];
                if matcher_main.verbose() {
                    cells.push(owner_token);
                }

                // Add the row
                table.add_row(Row::new(cells.into_iter().map(|c| Cell::new(&c)).collect()));
            }

            // Print the table
            table.printstd();
        } else {
            files
                .iter()
                .for_each(|f| println!("{}", f.download_url(true)));
        }

        Ok(())
    }
}

#[derive(Debug, Fail)]
pub enum Error {
    /// Failed to load the history.
    #[fail(display = "Failed to load file history")]
    Load(#[cause] HistoryLoadError),
}

impl From<HistoryLoadError> for ActionError {
    fn from(err: HistoryLoadError) -> ActionError {
        ActionError::History(Error::Load(err))
    }
}

```

### Core Architecture Module: `src/action/info.rs`
```
use chrono::Duration;
use clap::ArgMatches;
use failure::Fail;
use ffsend_api::action::exists::{Error as ExistsError, Exists as ApiExists};
use ffsend_api::action::info::{Error as InfoError, Info as ApiInfo};
use ffsend_api::action::metadata::Metadata as ApiMetadata;
use ffsend_api::file::remote_file::{FileParseError, RemoteFile};
use prettytable::{format::FormatBuilder, Cell, Row, Table};

use crate::client::create_config;
use crate::cmd::matcher::{info::InfoMatcher, main::MainMatcher, Matcher};
#[cfg(feature = "history")]
use crate::history_tool;
use crate::util::{
    ensure_owner_token, ensure_password, format_bytes, format_duration, print_error,
};

/// A file info action.
pub struct Info<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Info<'a> {
    /// Construct a new info action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the info action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), Error> {
        // Create the command matchers
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
        let matcher_info = InfoMatcher::with(self.cmd_matches).unwrap();

        // Get the share URL
        let url = matcher_info.url();

        // Create a reqwest client
        let client_config = create_config(&matcher_main);
        let client = client_config.client(false);

        // Parse the remote file based on the share URL, derive the owner token from history
        let mut file = RemoteFile::parse_url(url, matcher_info.owner())?;
        #[cfg(feature = "history")]
        history_tool::derive_file_properties(&matcher_main, &mut file);

        // Ask the user to set the owner token for more detailed information
        let has_owner = ensure_owner_token(file.owner_token_mut(), &matcher_main, true);

        // Check whether the file exists
        let exists = ApiExists::new(&file).invoke(&client)?;
        if !exists.exists() {
            // Remove the file from the history manager if it doesn't exist
            #[cfg(feature = "history")]
            history_tool::remove(&matcher_main, &file);

            return Err(Error::Expired);
        }

        // Get the password, ensure the password is set when required
        let mut password = matcher_info.password();
        let has_password = ensure_password(
            &mut password,
            exists.requires_password(),
            &matcher_main,
            true,
        );

        // Fetch both file info and metadata
        let info = if has_owner {
            Some(ApiInfo::new(&file, None).invoke(&client)?)
        } else {
            None
        };
        let metadata = if has_password {
            ApiMetadata::new(&file, password, false)
                .invoke(&client)
                .map_err(|err| {
                    print_error(err.context("failed to fetch file metadata, showing limited info"))
                })
                .ok()
        } else {
            None
        };

        // Update history file TTL if info is known
        if let Some(info) = &info {
            let ttl_millis = info.ttl_millis() as i64;
            let ttl = Duration::milliseconds(ttl_millis);
            file.set_expire_duration(ttl);
        }

        // Add the file to the history
        #[cfg(feature = "history")]
        history_tool::add(&matcher_main, file.clone(), true);

        // Create a new table for the information
        let mut table = Table::new();
        table.set_format(FormatBuilder::new().padding(0, 2).build());

        // Add the ID
        table.add_row(Row::new(vec![Cell::new("ID:"), Cell::new(file.id())]));

        // Show file metadata if available
        if let Some(metadata) = &metadata {
            // The file name
            table.add_row(Row::new(vec![
                Cell::new("Name:"),
                Cell::new(metadata.metadata().name()),
            ]));

            // The file size
            let size = metadata.size();
            table.add_row(Row::new(vec![
                Cell::new("Size:"),
                Cell::new(&if size >= 1024 {
                    format!("{} ({} B)", format_bytes(size), size)
                } else {
                    format_bytes(size)
                }),
            ]));

            // The file MIME
            table.add_row(Row::new(vec![
                Cell::new("MIME:"),
                Cell::new(metadata.metadata().mime()),
            ]));
        }

        // Show file info if available
        if let Some(info) = &info {
            // The download count
            table.add_row(Row::new(vec![
                Cell::new("Downloads:"),
                Cell::new(&format!(
                    "{} of {}",
                    info.download_count(),
                    info.download_limit()
                )),
            ]));

            // The time to live
            let ttl_millis = info.ttl_millis() as i64;
            let ttl = Duration::milliseconds(ttl_millis);
            table.add_row(Row::new(vec![
                Cell::new("Expiry:"),
                Cell::new(&if ttl_millis >= 60 * 1000 {
                    format!("{} ({}s)", format_duration(&ttl), ttl.num_seconds())
                } else {
                    format_duration(&ttl)
                }),
            ]));
        }

        // Print the info table
        table.printstd();

        Ok(())
    }
}

#[derive(Debug, Fail)]
pub enum Error {
    /// Failed to parse a share URL, it was invalid.
    /// This error is not related to a specific action.
    #[fail(display = "invalid share link")]
    InvalidUrl(#[cause] FileParseError),

    /// An error occurred while checking if the file exists.
    #[fail(display = "failed to check whether the file exists")]
    Exists(#[cause] ExistsError),

    /// An error occurred while fetching the file information.
    #[fail(display = "failed to fetch file info")]
    Info(#[cause] InfoError),

    /// The given Send file has expired, or did never exist in the first place.
    #[fail(display = "the file has expired or did never exist")]
    Expired,
}

impl From<FileParseError> for Error {
    fn from(err: FileParseError) -> Error {
        Error::InvalidUrl(err)
    }
}

impl From<ExistsError> for Error {
    fn from(err: ExistsError) -> Error {
        Error::Exists(err)
    }
}

impl From<InfoError> for Error {
    fn from(err: InfoError) -> Error {
        Error::Info(err)
    }
}

```

### Core Architecture Module: `src/action/mod.rs`
```
pub mod debug;
pub mod delete;
pub mod download;
pub mod exists;
pub mod generate;
#[cfg(feature = "history")]
pub mod history;
pub mod info;
pub mod params;
pub mod password;
pub mod upload;
pub mod version;

use ffsend_api::action::version::{Error as VersionError, Version as ApiVersion};
use ffsend_api::api::DesiredVersion;
use ffsend_api::client::Client;
use ffsend_api::url::Url;

use crate::config::API_VERSION_ASSUME;
use crate::util::print_warning;

/// Based on the given desired API version, select a version we can use.
///
/// If the current desired version is set to the `DesiredVersion::Lookup` variant, this method
/// will look up the server API version. It it's `DesiredVersion::Use` it will return and
/// attempt to use the specified version.
fn select_api_version(
    client: &Client,
    host: Url,
    desired: &mut DesiredVersion,
) -> Result<(), VersionError> {
    // Break if already specified
    if let DesiredVersion::Use(_) = desired {
        return Ok(());
    }

    // TODO: only lookup if `DesiredVersion::Assume` after first operation attempt failed

    // Look up the version
    match ApiVersion::new(host).invoke(&client) {
        // Use the probed version
        Ok(v) => *desired = DesiredVersion::Use(v),

        // If unknown, just assume the default version
        Err(VersionError::Unknown) => {
            *desired = DesiredVersion::Use(API_VERSION_ASSUME);
            print_warning(format!(
                "server API version could not be determined, assuming v{}",
                API_VERSION_ASSUME,
            ));
        }

        // Propagate other errors
        Err(e) => return Err(e),
    }

    Ok(())
}

```

### Core Architecture Module: `src/action/params.rs`
```
use clap::ArgMatches;
use ffsend_api::action::params::{Error as ParamsError, Params as ApiParams, ParamsDataBuilder};
use ffsend_api::file::remote_file::RemoteFile;

use super::select_api_version;
use crate::client::create_config;
use crate::cmd::matcher::{main::MainMatcher, params::ParamsMatcher, Matcher};
use crate::error::ActionError;
#[cfg(feature = "history")]
use crate::history_tool;
use crate::util::{ensure_owner_token, print_success};

/// A file parameters action.
pub struct Params<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Params<'a> {
    /// Construct a new parameters action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the parameters action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), ActionError> {
        // Create the command matchers
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
        let matcher_params = ParamsMatcher::with(self.cmd_matches).unwrap();

        // Get the share URL and the host
        // TODO: derive host through helper function
        let url = matcher_params.url();
        let mut host = url.clone();
        host.set_path("");
        host.set_query(None);
        host.set_fragment(None);

        // Create a reqwest client
        let client_config = create_config(&matcher_main);
        let client = client_config.client(false);

        // Determine the API version to use
        let mut desired_version = matcher_main.api();
        select_api_version(&client, host, &mut desired_version)?;
        let api_version = desired_version.version().unwrap();

        // Parse the remote file based on the share URL, derive the owner token from history
        let mut file = RemoteFile::parse_url(url, matcher_params.owner())?;
        #[cfg(feature = "history")]
        history_tool::derive_file_properties(&matcher_main, &mut file);

        // Ensure the owner token is set
        ensure_owner_token(file.owner_token_mut(), &matcher_main, false);

        // We don't authenticate for now
        let auth = false;

        // Build the parameters data object
        let data = ParamsDataBuilder::default()
            .download_limit(
                matcher_params
                    .download_limit(&matcher_main, api_version, auth)
                    .map(|d| d as u8),
            )
            .build()
            .unwrap();

        // TODO: make sure the data isn't empty

        // Execute an password action
        let result = ApiParams::new(&file, data, None).invoke(&client);
        if let Err(ParamsError::Expired) = result {
            // Remove the file from the history if expired
            #[cfg(feature = "history")]
            history_tool::remove(&matcher_main, &file);
        }
        result?;

        // Update the history
        #[cfg(feature = "history")]
        history_tool::add(&matcher_main, file, true);

        // Print a success message
        print_success("Parameters set");

        Ok(())
    }
}

```

### Core Architecture Module: `src/action/password.rs`
```
use clap::ArgMatches;
use ffsend_api::action::password::{Error as PasswordError, Password as ApiPassword};
use ffsend_api::file::remote_file::RemoteFile;
use prettytable::{format::FormatBuilder, Cell, Row, Table};

use crate::client::create_config;
use crate::cmd::matcher::{main::MainMatcher, password::PasswordMatcher, Matcher};
use crate::error::ActionError;
#[cfg(feature = "history")]
use crate::history_tool;
use crate::util::{ensure_owner_token, print_success};

/// A file password action.
pub struct Password<'a> {
    cmd_matches: &'a ArgMatches<'a>,
}

impl<'a> Password<'a> {
    /// Construct a new password action.
    pub fn new(cmd_matches: &'a ArgMatches<'a>) -> Self {
        Self { cmd_matches }
    }

    /// Invoke the password action.
    // TODO: create a trait for this method
    pub fn invoke(&self) -> Result<(), ActionError> {
        // Create the command matchers
        let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
        let matcher_password = PasswordMatcher::with(self.cmd_matches).unwrap();

        // Get the share URL
        let url = matcher_password.url();

        // Create a reqwest client
        let client_config = create_config(&matcher_main);
        let client = client_config.client(false);

        // Parse the remote file based on the share URL, derive the owner token from history
        let mut file = RemoteFile::parse_url(url, matcher_password.owner())?;
        #[cfg(feature = "history")]
        history_tool::derive_file_properties(&matcher_main, &mut file);

        // Ensure the owner token is set
        ensure_owner_token(file.owner_token_mut(), &matcher_main, false);

        // Get the password to use and whether it was generated
        let (password, password_generated) = matcher_password.password();

        // Execute an password action
        let result = ApiPassword::new(&file, &password, None).invoke(&client);
        if let Err(PasswordError::Expired) = result {
            // Remove the file from the history if expired
            #[cfg(feature = "history")]
            history_tool::remove(&matcher_main, &file);
        }
        result?;

        // Add the file to the history
        #[cfg(feature = "history")]
        history_tool::add(&matcher_main, file, true);

        // Print the passphrase if one was generated
        if password_generated {
            let mut table = Table::new();
            table.set_format(FormatBuilder::new().padding(0, 2).build());
            table.add_row(Row::new(vec![
                Cell::new("Passphrase:"),
                Cell::new(&password),
            ]));
            table.printstd();
        }

        // Print a success message
        print_success("Password set");

        Ok(())
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #120** (2020-07-31): **Downtime**
  *Symptoms*: ![](https://user-images.githubusercontent.com/169669/89047715-5a73c580-d381-11ea-88e4-ed3892c08eff.png) 
  **Post-Mortem & Fix Analysis**:
  > I'm aware of this. Mozilla temporarily took their Send instance down.   Update to `ffsend v0.2.65`. This version uses a different Send host I'm currently hosting myself.  See this issue for more info: https://gitlab.com/timvisee/ffsend/-/issues/101  Tracking issue: https://gitlab.com/timvisee/ffsend/-/issues/100

- **Issue #106** (2020-02-16): **Windows: Failing with missing libssl and libcrypto**
  *Symptoms*: I installed `ffsend` with `scoop` and the installation was successful. Trying to use the `ffsend u` command though is failing with this error:  ``` The code execution cannot proceed because libssl-1_1-x64.dll was not found. Reinstalling the program may fix this problem. ```  Followed by,  ``` The code execution cannot proceed because libcrypto-1_1-x64.dll was not found. Reinstalling the program may fix this problem. ```  I tried removing `ffsend` and installing it afresh, but that did not help. Should I install these packages/libraries manually, or is it something that `ffsend` installation should take care of?
  **Post-Mortem & Fix Analysis**:
  > Thank you for the report.  Scoop should take care of installing the OpenSSL (libssl, libcrypto) dependency indeed. The OpenSSL package did not have any updates for a while, and I didn't receive a report like this yet.  I'm wondering whether the installation has successfully completed. What Windows version are you using, and is it up-to-date? Also, is your scoop installation up-to-date?  For reference:   `ffsend` package: https://github.com/ScoopInstaller/Main/blob/master/bucket/ffsend.json   `openssl` package: https://github.com/ScoopInstaller/Main/blob/master/bucket/openssl.json
  > Thanks for taking a look, @timvisee. I am using Windows 10.0.18362 Build 18362. Yes, it's latest.  Scoop is latest as well, because I installed it for the first time yesterday. And immediately tried installing `ffsend`, when it failed with this error.  I am not sure what I must do with the links that you had provided, but I guess I can ignore them. 
  > @arunsathiya You need to have `libcrypto-1_1-x64.dll` and `libssl-1_1-x64.dll` on the `PATH`. Scoop doesn't do that automatically.   You could file a PR in the manifest of `openssl` here: https://github.com/ScoopInstaller/Main/edit/master/bucket/openssl.json and add this below `env_add`:  ```     "env_add_path": [         "bin"     ], ```

- **Issue #44** (2019-04-18): **Bug: thread 'main' panicked at 'failed to read header' on Ubuntu 16.04 Xenial **
  *Symptoms*: hello thanks for you jobs, i got on ubuntu1604 xenial :  ./ffsend upload dummy.png  thread 'main' panicked at 'failed to read header from reader: Custom { kind: UnexpectedEof, error: StringError("failed to fill whole buffer") }', src/libcore/result.rs:997:5 note: Run with `RUST_BACKTRACE=1` environment variable to display a backtrace.
  **Post-Mortem & Fix Analysis**:
  > help command work  dummyuser@627712:~/$ ./ffsend  ffsend 0.2.44 Usage: ffsend [FLAGS] <SUBCOMMAND> ...  Easily and securely share files from the command line. A fully featured Firefox Send client.  Missing subcommand. Here are the most used:     ffsend upload <FILE> ...     ffsend download <URL> ...  To show all subcommands, features and other help:     ffsend help [SUBCOMMAND] 
  > Thank you for the report. It is not quite clear to me what is happening here right now.  Your first message noted `libssl` issues, but your latest edit doesn't explicitly mention that. I assume this is still caused by an unsupported `libssl` version.  Could you clarify what installation option you're currently using? If you're using a binary directly, what binary are you using from the [releases](https://github.com/timvisee/ffsend/releases), or are you using a package such as the [`snap`](https://github.com/timvisee/ffsend#linux-snap-package) package?  I assume you're using the regular binary (non-static) directly, which does indeed require `libssl` to be installed on your system. This shouldn't be necessary for the static variant, I therefore recommend you to give the [`*-linux-x64-static`](https://github.com/timvisee/ffsend/releases/latest) binary a try if you're not already using it.   Your best bet might be to give the [`snap`](https://github.com/timvisee/ffsend#linux-snap-p
  > I am having exactly the same issue on Ubuntu 18.04. I installed with snap, and I have `ca-certificates` installed I used `ffsend upload -p -C -o document.txt` and got the same error as above.

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

### Incident Patch 1: `29eb167d` (2025-06-16)
**Commit Message**: chore(build): bump traitobject to 0.1.1 to build against rust 1.87.0

Signed-off-by: Rui Chen <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2691,9 +2691,9 @@ dependencies = [
 
 [[package]]
 name = "traitobject"
-version = "0.1.0"
+version = "0.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "efd1f82c56340fdf16f2a953d7bda4f8fdffba13d93b00844c25572110b26079"
+checksum = "04a79e25382e2e852e8da874249358d382ebaf259d0d34e75d8db16a7efabbc7"
 
 [[package]]
 name = "try-lock"
```

---

### Incident Patch 2: `a7143bb1` (2025-02-04)
**Commit Message**: Merge branch 'linux-libssl3' into 'master'

Upgrade to OpenSSL 3.x

See merge request timvisee/ffsend!43

**File**: `.gitlab-ci.yml` (modified, +5/-5)
```diff
@@ -5,7 +5,7 @@
 # - export a build artifact from the new job
 # - manually upload artifact to GitHub in the 'github-release' job
 
-image: "rust:slim"
+image: "rust:slim-bookworm"
 
 stages:
   - check
@@ -95,17 +95,17 @@ build-x86_64-linux-musl:
 
     # Build OpenSSL statically
     - apt-get install -y build-essential wget musl-tools
-    - wget https://www.openssl.org/source/old/1.1.1/openssl-1.1.1k.tar.gz
-    - tar xzvf openssl-1.1.1k.tar.gz
-    - cd openssl-1.1.1k
+    - wget https://github.com/openssl/openssl/releases/download/openssl-3.0.15/openssl-3.0.15.tar.gz
+    - tar xzvf openssl-3.0.15.tar.gz
+    - cd openssl-3.0.15
     - ./config no-async -fPIC --openssldir=/usr/local/ssl --prefix=/usr/local
     - make
     - make install
     - cd ..
 
     # Statically build ffsend
     - export OPENSSL_STATIC=1
-    - export OPENSSL_LIB_DIR=/usr/local/lib
+    - export OPENSSL_LIB_DIR=/usr/local/lib64
     - export OPENSSL_INCLUDE_DIR=/usr/local/include
     - cargo build --target=$RUST_TARGET --release --verbose
 
```

---

### Incident Patch 3: `27439fb7` (2023-05-22)
**Commit Message**: Possible fix for "missing" OpenSSL libraries.

**File**: `.gitlab-ci.yml` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ build-x86_64-linux-musl:
 
     # Statically build ffsend
     - export OPENSSL_STATIC=1
-    - export OPENSSL_LIB_DIR=/usr/local/lib
+    - export OPENSSL_LIB_DIR=/usr/local/lib64
     - export OPENSSL_INCLUDE_DIR=/usr/local/include
     - cargo build --target=$RUST_TARGET --release --verbose
 
```

---

### Incident Patch 4: `1da99678` (2025-01-28)
**Commit Message**: fix segmentation fault

**File**: `src/cmd/handler.rs` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ impl<'a: 'b, 'b> Handler<'a> {
         let app = App::new(crate_name!())
             .version(crate_version!())
             .author(crate_authors!())
-            .about(APP_ABOUT.as_ref())
+            .about(APP_ABOUT.as_str())
             .after_help("This application is not affiliated with Firefox or Mozilla.")
             .global_setting(AppSettings::GlobalVersion)
             .global_setting(AppSettings::VersionlessSubcommands)
```

---

### Incident Patch 5: `8d8ad7fd` (2023-05-18)
**Commit Message**: Revert "Upgrade to libssl3/openssl3."

This reverts commit 5fd2eac6ebee158ea1e76c4d94aa28cbd0aba3a2.

**File**: `.gitlab-ci.yml` (modified, +3/-3)
```diff
@@ -95,9 +95,9 @@ build-x86_64-linux-musl:
 
     # Build OpenSSL statically
     - apt-get install -y build-essential wget musl-tools
-    - wget https://www.openssl.org/source/openssl-3.0.8.tar.gz
-    - tar xzvf openssl-3.0.8.tar.gz
-    - cd openssl-3.0.8
+    - wget https://www.openssl.org/source/old/1.1.1/openssl-1.1.1k.tar.gz
+    - tar xzvf openssl-1.1.1k.tar.gz
+    - cd openssl-1.1.1k
     - ./config no-async -fPIC --openssldir=/usr/local/ssl --prefix=/usr/local
     - make
     - make install
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ An optional password may be specified, and a default file lifetime of 1 \
 remain online forever. This provides a secure platform to share your files."""
 priority = "standard"
 license-file = ["LICENSE", "3"]
-depends = "$auto, libssl3, ca-certificates, xclip"
+depends = "$auto, libssl1.1, ca-certificates, xclip"
 maintainer-scripts = "pkg/deb"
 
 [[bin]]
```

**File**: `pkg/aur/ffsend-git/PKGBUILD` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ arch=('x86_64' 'i686')
 provides=('ffsend')
 conflicts=('ffsend')
 depends=('ca-certificates')
-makedepends=('cargo' 'cmake' 'openssl')
+makedepends=('cargo' 'cmake' 'openssl>=1.0')
 optdepends=('xclip: clipboard support')
 
 prepare() {
```

**File**: `pkg/aur/ffsend/PKGBUILD` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ source=("$url/-/archive/v$pkgver/ffsend-v$pkgver.tar.gz") # automatically set in
 sha256sums=('SKIP') # automatically set in CI, see: /.gitlab-ci.yml
 arch=('x86_64' 'i686')
 depends=('ca-certificates')
-makedepends=('cargo' 'cmake' 'openssl')
+makedepends=('cargo' 'cmake' 'openssl>=1.0')
 optdepends=('xclip: clipboard support')
 
 prepare() {
```

**File**: `pkg/snap/snapcraft.yaml` (modified, +1/-1)
```diff
@@ -32,4 +32,4 @@ parts:
     plugin: rust
     build-attributes: [no-system-libraries]
     build-packages: [make, cmake, pkg-config, libssl-dev]
-    stage-packages: [libssl3, xclip]
+    stage-packages: [libssl1.0.0, xclip]
```

---

### Incident Patch 6: `f06b6395` (2023-05-18)
**Commit Message**: Merge branch 'sarrchri-linux-libssl3' into master

See https://github.com/timvisee/ffsend/pull/156

**File**: `.gitlab-ci.yml` (modified, +3/-3)
```diff
@@ -95,9 +95,9 @@ build-x86_64-linux-musl:
 
     # Build OpenSSL statically
     - apt-get install -y build-essential wget musl-tools
-    - wget https://www.openssl.org/source/old/1.1.1/openssl-1.1.1k.tar.gz
-    - tar xzvf openssl-1.1.1k.tar.gz
-    - cd openssl-1.1.1k
+    - wget https://www.openssl.org/source/openssl-3.0.8.tar.gz
+    - tar xzvf openssl-3.0.8.tar.gz
+    - cd openssl-3.0.8
     - ./config no-async -fPIC --openssldir=/usr/local/ssl --prefix=/usr/local
     - make
     - make install
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ An optional password may be specified, and a default file lifetime of 1 \
 remain online forever. This provides a secure platform to share your files."""
 priority = "standard"
 license-file = ["LICENSE", "3"]
-depends = "$auto, libssl1.1, ca-certificates, xclip"
+depends = "$auto, libssl3, ca-certificates, xclip"
 maintainer-scripts = "pkg/deb"
 
 [[bin]]
```

**File**: `pkg/aur/ffsend-git/PKGBUILD` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ arch=('x86_64' 'i686')
 provides=('ffsend')
 conflicts=('ffsend')
 depends=('ca-certificates')
-makedepends=('cargo' 'cmake' 'openssl>=1.0')
+makedepends=('cargo' 'cmake' 'openssl')
 optdepends=('xclip: clipboard support')
 
 prepare() {
```

**File**: `pkg/aur/ffsend/PKGBUILD` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ source=("$url/-/archive/v$pkgver/ffsend-v$pkgver.tar.gz") # automatically set in
 sha256sums=('SKIP') # automatically set in CI, see: /.gitlab-ci.yml
 arch=('x86_64' 'i686')
 depends=('ca-certificates')
-makedepends=('cargo' 'cmake' 'openssl>=1.0')
+makedepends=('cargo' 'cmake' 'openssl')
 optdepends=('xclip: clipboard support')
 
 prepare() {
```

**File**: `pkg/snap/snapcraft.yaml` (modified, +1/-1)
```diff
@@ -32,4 +32,4 @@ parts:
     plugin: rust
     build-attributes: [no-system-libraries]
     build-packages: [make, cmake, pkg-config, libssl-dev]
-    stage-packages: [libssl1.0.0, xclip]
+    stage-packages: [libssl3, xclip]
```

---

### Incident Patch 7: `3c1c2dc2` (2023-04-07)
**Commit Message**: Fix segfault

close  #153

**File**: `Cargo.lock` (modified, +178/-89)
```diff
@@ -56,12 +56,6 @@ version = "0.3.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a4c527152e37cf757a3f78aae5a06fbeefdb07ccc535c980a3208ee3060dd544"
 
-[[package]]
-name = "arrayvec"
-version = "0.5.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "23b62fc65de8e4e7f52534fb52b0f3ed04746ae267519eef2a83941e8085068b"
-
 [[package]]
 name = "atty"
 version = "0.2.14"
@@ -146,17 +140,6 @@ version = "1.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
 
-[[package]]
-name = "blake2b_simd"
-version = "0.5.11"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "afa748e348ad3be8263be728124b24a24f268266f6f5d58af9d75f6a40b5c587"
-dependencies = [
- "arrayref",
- "arrayvec",
- "constant_time_eq",
-]
-
 [[package]]
 name = "block"
 version = "0.1.6"
@@ -252,7 +235,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "45a7298287f1443f422d3f46e8ce9f855e75f0e43c06605adb4c52a262faeabd"
 dependencies = [
  "derive_builder 0.10.2",
- "getrandom 0.2.8",
+ "getrandom",
  "rand 0.8.5",
  "thiserror",
 ]
@@ -352,12 +335,6 @@ version = "0.4.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "fbdcdcb6d86f71c5e97409ad45898af11cbc995b4ee8112d59095a28d376c935"
 
-[[package]]
-name = "constant_time_eq"
-version = "0.1.5"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "245097e9a4535ee1e3e3931fcfcd55a796a44c643e8596ff6566d68f09b87bbc"
-
 [[package]]
 name = "core-foundation"
 version = "0.9.3"
@@ -646,14 +623,13 @@ dependencies = [
 ]
 
 [[package]]
-name = "dirs"
-version = "1.0.5"
+name = "dirs-next"
+version = "2.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3fd78930633bd1c6e35c4b42b1df7b0cbc6bc191146e512bb3bedf243fcc3901"
+checksum = "b98cf8ebf19c3d1b223e151f99a4f9f0690dca41414773390fc824184ac833e1"
 dependencies = [
- "libc",
- "redox_users 0.3.5",
- "winapi 0.3.9",
+ "cfg-if 1.0.0",
+ "dirs-sys-next",
 ]
 
 [[package]]
@@ -663,7 +639,18 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1b1d1d91c932ef41c0f2663aa8b0ca0342d444d842c06914aa0a7e352d0bada6"
 dependencies = [
  "libc",
- "redox_users 0.4.3",
+ "redox_users",
+ "winapi 0.3.9",
+]
+
+[[package]]
+name = "dirs-sys-next"
+version = "0.1.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "4ebda144c4fe02d1f7ea1a7d9641b6fc6b580adcfa024ae48797ecdeb6825b4d"
+dependencies = [
+ "libc",
+ "redox_users",
  "winapi 0.3.9",
 ]
 
@@ -681,9 +668,9 @@ checksum = "7fcaabb2fef8c910e7f4c7ce9f67a1283a1715879a7c230ca9d6d1ae31f16d91"
 
 [[package]]
 name = "encode_unicode"
-version = "0.3.6"
+version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a357d28ed41a50f9c765dbfe56cbc04a64e53e5fc58ba79fbc34c10ef3df831f"
+checksum = "34aa73646ffb006b8f5147f3dc182bd4bcb190227ce861fc4a4844bf8e3cb2c0"
 
 [[package]]
 name = "encoding_rs"
@@ -694,6 +681,27 @@ dependencies = [
  "cfg-if 1.0.0",
 ]
 
+[[package]]
+name = "errno"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "50d6a0976c999d473fe89ad888d5a284e55366d9dc9038b1ba2aa15128c4afa0"
+dependencies = [
+ "errno-dragonfly",
+ "libc",
+ "windows-sys 0.45.0",
+]
+
+[[package]]
+name = "errno-dragonfly"
+version = "0.1.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "aa68f1b12764fab894d2755d2518754e71b4fd80ecfb822714a1206c2aab39bf"
+dependencies = [
+ "cc",
+ "libc",
+]
+
 [[package]]
 name = "failure"
 version = "0.1.8"
@@ -944,17 +952,6 @@ dependencies = [
  "version_check 0.9.4",
 ]
 
-[[package]]
-name = "getrandom"
-version = "0.1.16"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8fc3cb4d91f53b50155bdcfd23f6a4c39ae1969c2ae85982b135750cccaf5fce"
-dependencies = [
- "cfg-if 1.0.0",
- "libc",
- "wasi 0.9.0+wasi-snapshot-preview1",
-]
-
 [[package]]
 name = "getrandom"
 version = "0.2.8"
@@ -1017,6 +1014,12 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "hermit-abi"
+version = "0.3.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "fed44880c466736ef9a5c5b5facefb5ed0785676d0c02d612db14e54f0d84286"
+
 [[package]]
 name = "hkdf"
 version = "0.11.0"
@@ -1210,6 +1213,17 @@ dependencies = [
  "cfg-if 1.0.0",
 ]
 
+[[package]]
+name = "io-lifetimes"
+version = "1.0.10"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9c66c74d2ae7e79a5a8f7ac924adbe38ee42a859c6539ad869eb51f0b52dc220"
+dependencies = [
+ "hermit-abi 0.3.1",
+ "libc",
+ "windows-sys 0.48.0",
+]
+
 [[package]]
 name = "iovec"
 version = "0.1.4"
@@ -1225,6 +1239,18 @@ version = "2.7.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "30e22bd8629359895450b59ea7a776c850561b96a3b1d
```

**File**: `Cargo.toml` (modified, +2/-11)
```diff
@@ -54,16 +54,7 @@ name = "ffsend"
 path = "src/main.rs"
 
 [features]
-default = [
-    "archive",
-    "clipboard",
-    "crypto-ring",
-    "history",
-    "infer-command",
-    "qrcode",
-    "send3",
-    "urlshorten",
-]
+default = ["archive", "clipboard", "crypto-ring", "history", "infer-command", "qrcode", "send3", "urlshorten"]
 
 # Compile with file archiving support
 archive = ["tar"]
@@ -119,7 +110,7 @@ open = "2"
 openssl-probe = "0.1"
 pathdiff = "0.2"
 pbr = "1"
-prettytable-rs = { version = "0.8", default-features = false }
+prettytable-rs = { version = "0.10.0", default-features = false }
 qr2term = { version = "0.2", optional = true }
 rand = "0.8"
 regex = "1.5"
```

---

### Incident Patch 8: `6661a587` (2023-02-14)
**Commit Message**: Revert "Use shorter passphrase words, make them less than 32-characters long"

This reverts commit fdf8ae9201ec02afb17775b09e6dda3e9bf5c696.

This is reverted because the password length limit is now set much
higher, see: https://github.com/timvisee/send/pull/147

**File**: `src/cmd/arg/gen_passphrase.rs` (modified, +2/-8)
```diff
@@ -1,22 +1,16 @@
-use chbs::{config::BasicConfig, prelude::*, word::WordList};
+use chbs;
 use clap::Arg;
 
 use super::{CmdArg, CmdArgFlag};
 
-/// How many words the passphrase should consist of.
-const PASSPHRASE_WORDS: usize = 5;
-
 /// The passphrase generation argument.
 pub struct ArgGenPassphrase {}
 
 impl ArgGenPassphrase {
     /// Generate a cryptographically secure passphrase that is easily
     /// remembered using diceware.
     pub fn gen_passphrase() -> String {
-        let mut config = BasicConfig::default();
-        config.words = PASSPHRASE_WORDS;
-        config.word_provider = WordList::builtin_eff_general_short().sampler();
-        config.to_scheme().generate()
+        chbs::passphrase()
     }
 }
 
```

---

### Incident Patch 9: `a98c9d1c` (2022-10-05)
**Commit Message**: Merge branch 'kianmeng-fix-typos' into master

See https://github.com/timvisee/ffsend/pull/144

**File**: `README.md` (modified, +2/-2)
```diff
@@ -362,7 +362,7 @@ You can use `ffsend` from the command line in the same directory:
 .\ffsend.exe --help
 ```
 
-To make it globally invokable as `ffsend`, you must make the binary available in
+To make it globally invocable as `ffsend`, you must make the binary available in
 your systems `PATH`. The easiest solution is to move it into `System32`:
 ```cmd
 move .\ffsend.exe C:\Windows\System32\ffsend.exe
@@ -428,7 +428,7 @@ docker pull timvisee/ffsend
 ```
 
 On Linux or macOS you might define a alias in your shell configuration, to make
-it invokable as `ffsend`:
+it invocable as `ffsend`:
 
 ```bash
 alias ffsend='docker run --rm -it -v "$(pwd):/data" timvisee/ffsend'
```

**File**: `pkg/create_deb` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ fi
 mkdir -p "$DIR/ffsend-$VERSION"
 cp -- "$DIR/../ffsend" "$DIR/ffsend-$VERSION/ffsend"
 
-# Create an application tarbal
+# Create an application tarball
 cd -- "$DIR/.."
 git archive --format tar.gz -o "$DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz" "$TRAVIS_TAG"
 
```

---

### Incident Patch 10: `f77f9f11` (2022-10-05)
**Commit Message**: Fix typos

Found via `codespell -S *.svg -L crate,ser`

**File**: `README.md` (modified, +2/-2)
```diff
@@ -362,7 +362,7 @@ You can use `ffsend` from the command line in the same directory:
 .\ffsend.exe --help
 ```
 
-To make it globally invokable as `ffsend`, you must make the binary available in
+To make it globally invocable as `ffsend`, you must make the binary available in
 your systems `PATH`. The easiest solution is to move it into `System32`:
 ```cmd
 move .\ffsend.exe C:\Windows\System32\ffsend.exe
@@ -428,7 +428,7 @@ docker pull timvisee/ffsend
 ```
 
 On Linux or macOS you might define a alias in your shell configuration, to make
-it invokable as `ffsend`:
+it invocable as `ffsend`:
 
 ```bash
 alias ffsend='docker run --rm -it -v "$(pwd):/data" timvisee/ffsend'
```

**File**: `pkg/create_deb` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ fi
 mkdir -p "$DIR/ffsend-$VERSION"
 cp -- "$DIR/../ffsend" "$DIR/ffsend-$VERSION/ffsend"
 
-# Create an application tarbal
+# Create an application tarball
 cd -- "$DIR/.."
 git archive --format tar.gz -o "$DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz" "$TRAVIS_TAG"
 
```

---

### Incident Patch 11: `91cf01ec` (2022-06-20)
**Commit Message**: Fix Snapcraft CI release, use new authentication method

**File**: `.gitlab-ci.yml` (modified, +1/-1)
```diff
@@ -188,7 +188,7 @@ release-snap:
     # Publish snap package
     - echo "Publishing snap package..."
     - echo "$SNAPCRAFT_LOGIN" | base64 -d > snapcraft.login
-    - snapcraft login --with snapcraft.login
+    - snapcraft whoami
     - snapcraft push --release=stable ffsend_*_amd64.snap
   artifacts:
     name: ffsend-snap-x86_64
```

**File**: `snapcraft.login` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+eyJyIjogIk1EQXlPV3h2WTJGMGFXOXVJRzE1WVhCd2N5NWtaWFpsYkc5d1pYSXVkV0oxYm5SMUxtTnZiUW93TURFMmFXUmxiblJwWm1sbGNpQk5lVUZ3Y0hNS01EQTBZbU5wWkNCdGVXRndjSE11WkdWMlpXeHZjR1Z5TG5WaWRXNTBkUzVqYjIxOGRtRnNhV1JmYzJsdVkyVjhNakF5TWkwd05pMHlNRlF3T0Rvd016b3hNaTQwTlRreU9EUUtNREUzWkdOcFpDQjdJblpsY25OcGIyNGlPaUF4TENBaWMyVmpjbVYwSWpvZ0ltOWFVRzlpVG1vdlJYTmhkazlYUVZoRmNIQlRNM1JNY0RGak1tdFZaVU5NYzFaWlNUQmFaa1JFZERkcVozaHhTVlI2VEhselFtOVZjV3N5VURad1JXdFFRblpNUkhOMFkwTTNSRlU1VUVFMGFXVlpPV0U0WWxGU2VtNHJNbTQxVEVsRWMwY3ZTVEphVEM4eU1uSTBjakZDYmlzM1VqRnhUVWt2WjNoR1kzVnVVV05pUlZkeVVWQXdZV3BrUTBrd1pWRmxOVEZsVmpWSVJrbzNjMlZGU0c5WVpFRlZTVVZ1Vm1GNU5sRnFVMDQzTW1SSFpWSlVabVZvYVVacmFWbFFaVVJJZVN0d1VqbHVjMXBNZW5aMFNYbHNPRnBYYVhkSVdIcFpRVTl2T0Rob1VXdFhZakZ6UzNGSGFYWjZWRFZEWlZoV1IyaElaalJSUVdRNVIwOWxLMjUxUmpWM2JHMWtaRlIwY1U1YWNWQnNjVkZHYjBoelprUk9jRFpvVFd4dWFHbDVMMGxvY2tOclZscENUVzFMYld0cFIwVk1VWFZMTUVSUVFtdFFNSE5RVWpaVVdsWnFjVGQzZVRaaFdIa3dVM1ZyZDBaclp6MDlJbjBLTURBMU1YWnBaQ0ExYU5mbjFKU3NBa1VoMFM1NXB4bnp2VUxESlRtcldMLTZSa3B0c3kzbFdVSG02T0hVQnJHeGtfYmlnbnEtbkxIMm9hYVdwaENKRkM1YzNod1BqWjBXUl83bUZ5QWN2QlFLTURBeE9HTnNJR3h2WjJsdUxuVmlkVzUwZFM1amIyMEtNREJoT1dOcFpDQnRlV0Z3Y0hNdVpHVjJaV3h2Y0dWeUxuVmlkVzUwZFM1amIyMThZV05zZkZzaWNHRmphMkZuWlY5aFkyTmxjM01pTENBaWNHRmphMkZuWlY5dFlXNWhaMlVpTENBaWNHRmphMkZuWlY5dFpYUnlhV056SWl3Z0luQmhZMnRoWjJWZmNIVnphQ0lzSUNKd1lXTnJZV2RsWDNKbFoybHpkR1Z5SWl3Z0luQmhZMnRoWjJWZmNtVnNaV0Z6WlNJc0lDSndZV05yWVdkbFgzVndaR0YwWlNKZENqQXdORGRqYVdRZ2JYbGhjSEJ6TG1SbGRtVnNiM0JsY2k1MVluVnVkSFV1WTI5dGZHVjRjR2x5WlhOOE1qQXlNeTB3TmkweU1GUXdPRG93TXpveE1pNHdNREF3TVRjS01EQXlabk5wWjI1aGRIVnlaU0JOYm05MFAyTkpYV3RON0I1aktWbkVBQUZqM0c3dzItLWNhOGloR2lJWUhRbyIsICJkIjogIk1EQXhaV3h2WTJGMGFXOXVJR3h2WjJsdUxuVmlkVzUwZFM1amIyMEtNREU0Tkdsa1pXNTBhV1pwWlhJZ2V5SjJaWEp6YVc5dUlqb2dNU3dnSW5ObFkzSmxkQ0k2SUNKdldsQnZZazVxTDBWellYWlBWMEZZUlhCd1V6TjBUSEF4WXpKclZXVkRUSE5XV1Vrd1dtWkVSSFEzYW1kNGNVbFVla3g1YzBKdlZYRnJNbEEyY0VWclVFSjJURVJ6ZEdORE4wUlZPVkJCTkdsbFdUbGhPR0pSVW5wdUt6SnVOVXhKUkhOSEwwa3lXa3d2TWpKeU5ISXhRbTRyTjFJeGNVMUpMMmQ0Um1OMWJsRmpZa1ZYY2xGUU1HRnFaRU5KTUdWUlpUVXhaVlkxU0VaS04zTmxSVWh2V0dSQlZVbEZibFpoZVRaUmFsTk9OekprUjJWU1ZHWmxhR2xHYTJsWlVHVkVTSGtyY0ZJNWJuTmFUSHAyZEVsNWJEaGFWMmwzU0ZoNldVRlBiemc0YUZGclYySXhjMHR4UjJsMmVsUTFRMlZZVmtkb1NHWTBVVUZrT1VkUFpTdHVkVVkxZDJ4dFpHUlVkSEZPV25GUWJIRlJSbTlJYzJaRVRuQTJhRTFzYm1ocGVTOUphSEpEYTFaYVFrMXRTMjFyYVVkRlRGRjFTekJFVUVKclVEQnpVRkkyVkZwV2FuRTNkM2syWVZoNU1GTjFhM2RHYTJjOVBTSjlDakF3WkRaamFXUWdiRzluYVc0dWRXSjFiblIxTG1OdmJYeGhZMk52ZFc1MGZHVjVTakZqTWxaNVltMUdkRnBUU1RaSlEwb3dZVmN4TW1GWVRteGFVMGx6U1VOS2RtTkhWblZoVjFGcFQybEJhVlZ1WkV4UlZXaDBVME5KYzBsRFNtdGhXRTUzWWtkR05XSnRSblJhVTBrMlNVTktWV0ZYTUdkV2JXeDZXRWhWZDAxSFZUVmFVMGx6U1VOS2JHSlhSbkJpUTBrMlNVTktNR0ZYTUhKa1Ywb3hZbTVTTVdJeU5XeFJTRnB3WXpKV2JFeHRNV3hKYVhkblNXMXNlbGd6V214amJXeHRZVmRXYTBscWIyZGtTRW94V2xnd1BRb3dNRFF3WTJsa0lHeHZaMmx1TG5WaWRXNTBkUzVqYjIxOGRtRnNhV1JmYzJsdVkyVjhNakF5TWkwd05pMHlNRlF3T0Rvd016b3hNeTR5T0RJd09UTUtNREF6WldOcFpDQnNiMmRwYmk1MVluVnVkSFV1WTI5dGZHeGhjM1JmWVhWMGFId3lNREl5TFRBMkxUSXdWREE0T2pBek9qRXpMakk0TWpBNU13b3dNREptYzJsbmJtRjBkWEpsSVBtdzV2aGZjWXhjRVFzX1RHV2VHWUFrQWhxdkJONVJjOFpHTEpnVFZ2eGxDZyJ9
\ No newline at end of file
```

---

### Incident Patch 12: `8f909b80` (2021-10-07)
**Commit Message**: Revert "Use latest ca-certificates for ffsend binary test against public instance"

This reverts commit 4c55145a07c3ceace3fefa42f0fcc35e3a4b5eef.

**File**: `.gitlab-ci.yml` (modified, +1/-2)
```diff
@@ -136,8 +136,7 @@ test-public:
   variables:
     GIT_STRATEGY: none
     RUST_TARGET: x86_64-unknown-linux-musl
-  before_script:
-    - apk add ca-certificates
+  before_script: []
   script:
     # Prepare ffsend binary, create random file
     - mv ./ffsend-$RUST_TARGET ./ffsend
```

---

### Incident Patch 13: `cf8c13af` (2021-08-26)
**Commit Message**: Merge branch 'a1346054-fixes' into master

See https://github.com/timvisee/ffsend/pull/129

**File**: `.gitlab-ci.yml` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ before_script:
     rustc --version
     cargo --version
 
-# Check on stable, beta and nightly 
+# Check on stable, beta and nightly
 .check-base: &check-base
   stage: check
   script:
```

**File**: `CONTRIBUTING.md` (modified, +5/-5)
```diff
@@ -18,7 +18,7 @@ Contributions to the `ffsend` project are welcome!
 When contributing new features, alternative implementations or bigger
 improvements, please first discuss the change you wish to make via an issue
 or email.
-Small changes such as fixed commands, fixed spelling or dependency updates 
+Small changes such as fixed commands, fixed spelling or dependency updates
 are always welcome without discussion.
 
 The `ffsend` repository is primarily hosted on [GitLab][gitlab].
@@ -115,11 +115,11 @@ members of the project's leadership.
 
 ### Attribution
 This Code of Conduct is adapted from the [Contributor Covenant][coc-homepage], version 1.4,
-available at [http://contributor-covenant.org/version/1/4][coc-version]
+available at [https://contributor-covenant.org/version/1/4][coc-version]
 
 ## License
 This project is released under the GNU GPL-3.0 license.
-Check out the [LICENSE](LICENSE) file for more information. 
+Check out the [LICENSE](LICENSE) file for more information.
 
 [branch-master]: https://gitlab.com/timvisee/ffsend/tree/master
 [gitlab]: https://gitlab.com/timvisee/ffsend
@@ -128,5 +128,5 @@ Check out the [LICENSE](LICENSE) file for more information.
 [github]: https://github.com/timvisee/ffsend
 [github-issues]: https://github.com/timvisee/ffsend/issues
 [github-pr]: https://github.com/timvisee/ffsend/pulls
-[coc-homepage]: http://contributor-covenant.org
-[coc-version]: http://contributor-covenant.org/version/1/4/
+[coc-homepage]: https://contributor-covenant.org
+[coc-version]: https://contributor-covenant.org/version/1/4/
```

**File**: `LICENSE` (modified, +54/-1)
```diff
@@ -1,7 +1,7 @@
                     GNU GENERAL PUBLIC LICENSE
                        Version 3, 29 June 2007
 
- Copyright (C) 2007 Free Software Foundation, Inc. <http://fsf.org/>
+ Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
  Everyone is permitted to copy and distribute verbatim copies
  of this license document, but changing it is not allowed.
 
@@ -619,3 +619,56 @@ Program, unless a warranty or assumption of liability accompanies a
 copy of the Program in return for a fee.
 
                      END OF TERMS AND CONDITIONS
+
+            How to Apply These Terms to Your New Programs
+
+  If you develop a new program, and you want it to be of the greatest
+possible use to the public, the best way to achieve this is to make it
+free software which everyone can redistribute and change under these terms.
+
+  To do so, attach the following notices to the program.  It is safest
+to attach them to the start of each source file to most effectively
+state the exclusion of warranty; and each file should have at least
+the "copyright" line and a pointer to where the full notice is found.
+
+    <one line to give the program's name and a brief idea of what it does.>
+    Copyright (C) <year>  <name of author>
+
+    This program is free software: you can redistribute it and/or modify
+    it under the terms of the GNU General Public License as published by
+    the Free Software Foundation, either version 3 of the License, or
+    (at your option) any later version.
+
+    This program is distributed in the hope that it will be useful,
+    but WITHOUT ANY WARRANTY; without even the implied warranty of
+    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
+    GNU General Public License for more details.
+
+    You should have received a copy of the GNU General Public License
+    along with this program.  If not, see <https://www.gnu.org/licenses/>.
+
+Also add information on how to contact you by electronic and paper mail.
+
+  If the program does terminal interaction, make it output a short
+notice like this when it starts in an interactive mode:
+
+    <program>  Copyright (C) <year>  <name of author>
+    This program comes with ABSOLUTELY NO WARRANTY; for details type `show w'.
+    This is free software, and you are welcome to redistribute it
+    under certain conditions; type `show c' for details.
+
+The hypothetical commands `show w' and `show c' should show the appropriate
+parts of the General Public License.  Of course, your program's commands
+might be different; for a GUI interface, you would use an "about box".
+
+  You should also get your employer (if you work as a programmer) or school,
+if any, to sign a "copyright disclaimer" for the program, if necessary.
+For more information on this, and how to apply and follow the GNU GPL, see
+<https://www.gnu.org/licenses/>.
+
+  The GNU General Public License does not permit incorporating your program
+into proprietary programs.  If your program is a subroutine library, you
+may consider it more useful to permit linking proprietary applications with
+the library.  If this is what you want to do, use the GNU Lesser General
+Public License instead of this License.  But first, please read
+<https://www.gnu.org/licenses/why-not-lgpl.html>.
```

**File**: `contrib/completions/gen_completions` (modified, +1/-1)
```diff
@@ -4,5 +4,5 @@
 set -e
 
 echo "Generating all completions using cargo debug binary..."
-cargo run -q -- generate completions all --output $PWD
+cargo run -q -- generate completions all --output "$PWD"
 echo "Done."
```

**File**: `pkg/create_deb` (modified, +10/-10)
```diff
@@ -9,13 +9,13 @@ if [[ ! $TRAVIS_TAG =~ ^v([0-9]+\.)*[0-9]+$ ]]; then
 fi
 
 # Ensure the debian architecture is set
-if [[ -z "$DEB_ARCH" ]]; then
+if [[ -z $DEB_ARCH ]]; then
     echo "Error: debian architecture not configured in \$DEB_ARCH"
     exit 1
 fi
 
 # Define some useful variables
-DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
+DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
 VERSION=${TRAVIS_TAG:1}
 
 # Ensure the binary file exists
@@ -25,23 +25,23 @@ if [[ ! -f "$DIR/../ffsend" ]]; then
 fi
 
 # Create an application directory, copy the binary into it
-mkdir -p $DIR/ffsend-$VERSION
-cp $DIR/../ffsend $DIR/ffsend-$VERSION/ffsend
+mkdir -p "$DIR/ffsend-$VERSION"
+cp -- "$DIR/../ffsend" "$DIR/ffsend-$VERSION/ffsend"
 
 # Create an application tarbal
-cd $DIR/..
-git archive --format tar.gz -o $DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz $TRAVIS_TAG
+cd -- "$DIR/.."
+git archive --format tar.gz -o "$DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz" "$TRAVIS_TAG"
 
 # Change into the app directory
-cd $DIR/ffsend-$VERSION
+cd -- "$DIR/ffsend-$VERSION"
 
 # Build the debian package
 # TODO: define GPG?
-dh_make -e "timvisee@gmail.com" -c gpl3 -f ffsend-$VERSION.tar.gz -s -y
-rm *.ex README.Debian README.source
+dh_make -e "timvisee@gmail.com" -c gpl3 -f "ffsend-$VERSION.tar.gz" -s -y
+rm -- *.ex README.Debian README.source
 
 # Remove the project tar ball, we're not using it anymore
-rm $DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz
+rm -- "$DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz"
 
 # TODO: configure the debian/control file
 # TODO: configure copyright file
```

**File**: `pkg/deb/prerm` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 # Unlink the ffs alias if it links to ffsend
 if [[ -L /usr/bin/ffs ]] \
-    && [[ $(ls -l /usr/bin/ffs | sed -e 's/.* -> //') == "/usr/bin/ffsend" ]]; \
+    && [[ $(realpath /usr/bin/ffs) == "/usr/bin/ffsend" ]]; \
 then
     echo "Removing ffs alias for ffsend..."
     unlink /usr/bin/ffs
```

**File**: `res/asciinema-to-svg` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-#!/bin/bash
+#!/usr/bin/env bash
 
 # Ensure svg-term is installed
 if ! [ -x "$(command -v svg-term)" ]; then
```

**File**: `src/action/download.rs` (modified, +3/-3)
```diff
@@ -139,7 +139,7 @@ impl<'a> Download<'a> {
         {
             // Allocate an archive file, and update the download and target paths
             if extract {
-                // TODO: select the extention dynamically
+                // TODO: select the extension dynamically
                 let archive_extention = ".tar";
 
                 // Allocate a temporary file to download the archive to
@@ -210,7 +210,7 @@ impl<'a> Download<'a> {
     ///
     /// The full path including the name is returned.
     ///
-    /// This method will check whether a file is overwitten, and whether
+    /// This method will check whether a file is overwritten, and whether
     /// parent directories must be created.
     ///
     /// The program will quit with an error message if a problem occurs.
@@ -313,7 +313,7 @@ impl<'a> Download<'a> {
         // Get the path string
         let path = target.to_str();
 
-        // If the path is emtpy, use the working directory with the name hint
+        // If the path is empty, use the working directory with the name hint
         let use_workdir = path.map(|path| path.trim().is_empty()).unwrap_or(true);
         if use_workdir {
             match current_dir() {
```

---

### Incident Patch 14: `e2c20840` (2021-08-25)
**Commit Message**: Fix spelling

**File**: `src/action/download.rs` (modified, +3/-3)
```diff
@@ -139,7 +139,7 @@ impl<'a> Download<'a> {
         {
             // Allocate an archive file, and update the download and target paths
             if extract {
-                // TODO: select the extention dynamically
+                // TODO: select the extension dynamically
                 let archive_extention = ".tar";
 
                 // Allocate a temporary file to download the archive to
@@ -210,7 +210,7 @@ impl<'a> Download<'a> {
     ///
     /// The full path including the name is returned.
     ///
-    /// This method will check whether a file is overwitten, and whether
+    /// This method will check whether a file is overwritten, and whether
     /// parent directories must be created.
     ///
     /// The program will quit with an error message if a problem occurs.
@@ -313,7 +313,7 @@ impl<'a> Download<'a> {
         // Get the path string
         let path = target.to_str();
 
-        // If the path is emtpy, use the working directory with the name hint
+        // If the path is empty, use the working directory with the name hint
         let use_workdir = path.map(|path| path.trim().is_empty()).unwrap_or(true);
         if use_workdir {
             match current_dir() {
```

**File**: `src/action/generate/completions.rs` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ impl<'a> Completions<'a> {
         let matcher_main = MainMatcher::with(self.cmd_matches).unwrap();
         let matcher_completions = CompletionsMatcher::with(self.cmd_matches).unwrap();
 
-        // Obtian shells to generate completions for, build application definition
+        // Obtain shells to generate completions for, build application definition
         let shells = matcher_completions.shells();
         let dir = matcher_completions.output();
         let quiet = matcher_main.quiet();
```

**File**: `src/action/history.rs` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ impl<'a> History<'a> {
 
         // Remove history item
         if let Some(url) = matcher_history.rm() {
-            // Remove item, print error if no item with URL was foudn
+            // Remove item, print error if no item with URL was found
             match history.remove_url(url) {
                 Ok(removed) if !removed => quit_error_msg(
                     "could not remove item from history, no item matches given URL",
```

**File**: `src/action/mod.rs` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ fn select_api_version(
             ));
         }
 
-        // Propegate other errors
+        // Propagate other errors
         Err(e) => return Err(e),
     }
 
```

**File**: `src/action/upload.rs` (modified, +2/-2)
```diff
@@ -224,7 +224,7 @@ impl<'a> Upload<'a> {
                     // Finish the archival process, writes the archive file
                     archiver.finish().map_err(ArchiveError::Write)?;
 
-                    // Append archive extention to name, set to upload archived file
+                    // Append archive extension to name, set to upload archived file
                     if let Some(ref mut file_name) = file_name {
                         file_name.push_str(archive_extention);
                     }
@@ -275,7 +275,7 @@ impl<'a> Upload<'a> {
             // TODO: set false parameter to authentication state
             let max_size = upload_size_max(api_version, auth);
 
-            // Get the file size, fail on emtpy files, warn about large files
+            // Get the file size, fail on empty files, warn about large files
             if let Ok(size) = path.metadata().map(|m| m.len()) {
                 // Enforce files not being 0 bytes
                 if size == 0 && !matcher_main.force() {
```

**File**: `src/cmd/arg/gen_passphrase.rs` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ pub struct ArgGenPassphrase {}
 
 impl ArgGenPassphrase {
     /// Generate a cryptographically secure passphrase that is easily
-    /// rememberable using diceware.
+    /// remembered using diceware.
     pub fn gen_passphrase() -> String {
         let mut config = BasicConfig::default();
         config.words = PASSPHRASE_WORDS;
```

**File**: `src/cmd/arg/mod.rs` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ pub mod owner;
 pub mod password;
 pub mod url;
 
-// Re-eexport to arg module
+// Re-export to arg module
 pub use self::api::ArgApi;
 pub use self::basic_auth::ArgBasicAuth;
 pub use self::download_limit::ArgDownloadLimit;
```

**File**: `src/cmd/matcher/upload.rs` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ impl<'a: 'b, 'b> UploadMatcher<'a> {
         let name = self.matches.value_of("name")?;
 
         // The file name must not be empty
-        // TODO: allow to force an empty name here, and process emtpy names on downloading
+        // TODO: allow to force an empty name here, and process empty names on downloading
         if name.trim().is_empty() {
             quit_error_msg(
                 "the file name must not be empty",
@@ -171,7 +171,7 @@ pub enum CopyMode {
 }
 
 impl CopyMode {
-    /// Build the string to copy, based on the given `url` and currend mode.
+    /// Build the string to copy, based on the given `url` and current mode.
     pub fn build(&self, url: &str) -> String {
         match self {
             CopyMode::Url => url.into(),
```

---

### Incident Patch 15: `c7c53d86` (2021-08-25)
**Commit Message**: Fix issues in scripts identified using shellcheck

**File**: `contrib/completions/gen_completions` (modified, +1/-1)
```diff
@@ -4,5 +4,5 @@
 set -e
 
 echo "Generating all completions using cargo debug binary..."
-cargo run -q -- generate completions all --output $PWD
+cargo run -q -- generate completions all --output "$PWD"
 echo "Done."
```

**File**: `pkg/create_deb` (modified, +10/-10)
```diff
@@ -9,13 +9,13 @@ if [[ ! $TRAVIS_TAG =~ ^v([0-9]+\.)*[0-9]+$ ]]; then
 fi
 
 # Ensure the debian architecture is set
-if [[ -z "$DEB_ARCH" ]]; then
+if [[ -z $DEB_ARCH ]]; then
     echo "Error: debian architecture not configured in \$DEB_ARCH"
     exit 1
 fi
 
 # Define some useful variables
-DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
+DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
 VERSION=${TRAVIS_TAG:1}
 
 # Ensure the binary file exists
@@ -25,23 +25,23 @@ if [[ ! -f "$DIR/../ffsend" ]]; then
 fi
 
 # Create an application directory, copy the binary into it
-mkdir -p $DIR/ffsend-$VERSION
-cp $DIR/../ffsend $DIR/ffsend-$VERSION/ffsend
+mkdir -p "$DIR/ffsend-$VERSION"
+cp -- "$DIR/../ffsend" "$DIR/ffsend-$VERSION/ffsend"
 
 # Create an application tarbal
-cd $DIR/..
-git archive --format tar.gz -o $DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz $TRAVIS_TAG
+cd -- "$DIR/.."
+git archive --format tar.gz -o "$DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz" "$TRAVIS_TAG"
 
 # Change into the app directory
-cd $DIR/ffsend-$VERSION
+cd -- "$DIR/ffsend-$VERSION"
 
 # Build the debian package
 # TODO: define GPG?
-dh_make -e "timvisee@gmail.com" -c gpl3 -f ffsend-$VERSION.tar.gz -s -y
-rm *.ex README.Debian README.source
+dh_make -e "timvisee@gmail.com" -c gpl3 -f "ffsend-$VERSION.tar.gz" -s -y
+rm -- *.ex README.Debian README.source
 
 # Remove the project tar ball, we're not using it anymore
-rm $DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz
+rm -- "$DIR/ffsend-$VERSION/ffsend-$VERSION.tar.gz"
 
 # TODO: configure the debian/control file
 # TODO: configure copyright file
```

#### Recent Merged Pull Requests:
- **PR #183** (2025-09-18): Update README.md (@defiling9046)
- **PR #180** (closed): Update traitobject to 0.1.1 (@beatussum)
- **PR #177** (closed): Upgrade to OpenSSL 3.0 (@sarrchri)
- **PR #176** (2025-01-28): fix segmentation fault (@Kramtoske)
- **PR #156** (2023-05-18): Upgrade linux/Arch builds to use libssl3. (@sarrchri)
- **PR #155** (closed): Bump openssl from 0.10.45 to 0.10.49 (@dependabot[bot])
- **PR #154** (2023-04-07): Fix `prettytable-rs` segfault with a version upgrade (@alichtman)
- **PR #152** (closed): Bump openssl from 0.10.45 to 0.10.48 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
