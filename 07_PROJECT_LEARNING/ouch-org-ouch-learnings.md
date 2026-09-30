# Forensic Learning Record (Deep Inspection): ouch-org/ouch

> **Canonical Artifact**: `07_PROJECT_LEARNING/ouch-org-ouch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ouch-org/ouch](https://github.com/ouch-org/ouch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:24:46.935Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ouch-org/ouch`
- **Description**: Painless compression and decompression in the terminal
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3774 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `src/archive/mod.rs`
```
#[cfg(feature = "unrar")]
pub mod rar;
pub mod sevenz;
pub mod tar;
pub mod zip;

```

### Core Architecture Module: `src/archive/rar.rs`
```
//! Contains RAR-specific building and unpacking functions

use std::path::{Path, PathBuf};

use fs_err as fs;
use unrar::{
    Archive, ExtractEvent,
    error::{Code, UnrarError, When},
};

use crate::{
    QuestionPolicy,
    error::{Error, FinalError, Result},
    info,
    list::{FileInArchive, ListFileType},
    utils::{BytesFmt, PathFmt, resolve_extraction_conflict, validate_entry_path},
    warning,
};

/// Unpacks the archive into `output_folder` and asks before replacing files.
pub fn unpack_archive(
    archive_path: &Path,
    output_folder: &Path,
    password: Option<&[u8]>,
    question_policy: QuestionPolicy,
) -> Result<u64> {
    // Rar reference records need a full extraction pass to resolve.
    fs::create_dir_all(output_folder)?;
    let staging = tempfile::Builder::new()
        .prefix(".ouch-rar-")
        .tempdir_in(output_folder)?;
    extract_all(archive_path, staging.path(), password)?;
    move_into_place(staging.path(), staging.path(), output_folder, question_policy)
}

/// Move each staged entry into `output_folder` at the same relative path.
fn move_into_place(root: &Path, dir: &Path, output_folder: &Path, question_policy: QuestionPolicy) -> Result<u64> {
    let mut files_unpacked = 0;
    for entry in fs::read_dir(dir)? {
        let source = entry?.path();
        let dest = output_folder.join(source.strip_prefix(root).expect("child of staging root"));

        if fs::symlink_metadata(&source)?.is_dir() {
            std::fs::create_dir_all(&dest).map_err(|err| Error::Custom {
                reason: FinalError::with_title(format!("failed to create {}", PathFmt(&dest))).detail(err.to_string()),
            })?;
            files_unpacked += move_into_place(root, &source, output_folder, question_policy)?;
        } else if let Some(target) = resolve_extraction_conflict(&dest, question_policy)? {
            let size = fs::symlink_metadata(&source)?.len();
            std::fs::rename(&source, &target).map_err(|err| Error::Custom {
                reason: FinalError::with_title(format!("failed to extract {}", PathFmt(&target)))
                    .detail(err.to_string()),
            })?;
            info!("extracted ({}) {}", BytesFmt(size), PathFmt(&target));
            files_unpacked += 1;
        }
    }
    Ok(files_unpacked)
}

/// Extract the whole archive into a staging folder in one pass.
fn extract_all(archive_path: &Path, output_folder: &Path, password: Option<&[u8]>) -> Result<()> {
    let archive = match password {
        Some(password) => Archive::with_password(archive_path, password),
        None => Archive::new(archive_path),
    };

    let archive = archive.open_for_processing()?;

    let mut first_err: Option<(PathBuf, i32)> = None;
    let mut unsafe_path: Option<(PathBuf, String)> = None;

    let cb_result = archive.extract_all_with_callback(output_folder, |event| match event {
        ExtractEvent::Start { filename, .. } => {
            if let Err(e) = validate_entry_path(&filename) {
                warning!("refusing unsafe rar entry {}: {}", PathFmt(&filename), e);
                unsafe_path = Some((filename, e.to_string()));
                false
            } else {
                true
            }
        }
        ExtractEvent::Ok { .. } => true,
        ExtractEvent::Err { filename, error_code } => {
            first_err = Some((filename, error_code));
            // Returning false cancels the rest of the extraction so any
            // additional per-file errors don't get silently swallowed.
            false
        }
        ExtractEvent::LargeDictWarning {
            dict_size_kb,
            max_dict_size_kb,
        } => {
            info!(
                "archive requires {} KiB dictionary; this build supports up to {} KiB",
                dict_size_kb, max_dict_size_kb,
            );
            // Reject the oversized dictionary so the DLL fails the
            // operation with Code::LargeDict instead of silently
            // proceeding with a result it cannot actually produce.
            false
        }
        _ => true,
    });

    if let Some((path, reason)) = unsafe_path {
        return Err(Error::Custom {
            reason: FinalError::with_title(format!("refusing to extract unsafe rar entry {}", PathFmt(&path)))
                .detail(reason),
        });
    }

    if let Some((path, code)) = first_err {
        let inner = UnrarError::from(Code::from(code), When::Process).to_string();
        return Err(Error::Custom {
            reason: FinalError::with_title(format!("failed to extract {}", PathFmt(&path))).detail(inner),
        });
    }
    let _status = cb_result?;
    Ok(())
}

/// List contents of `archive_path`, returning a vector of archive entries
pub fn list_archive(
    archive_path: &Path,
    password: Option<&[u8]>,
) -> Result<impl Iterator<Item = Result<FileInArchive>> + use<>> {
    let archive = match password {
        Some(password) => Archive::with_password(archive_path, password),
        None => Archive::new(archive_path),
    };

    Ok(archive.open_for_listing()?.map(|item| {
        let item = item?;
        let is_dir = item.is_directory();
        let size = Some(item.unpacked_size);
        let path = item.filename;

        Ok(FileInArchive {
            path,
            file_type: if is_dir {
                ListFileType::Directory
            } else {
                ListFileType::File
            },
            size,
        })
    }))
}

pub fn no_compression() -> Error {
    Error::UnsupportedFormat {
        reason: "Creating RAR archives is not allowed due to licensing restrictions.".into(),
    }
}

```

### Core Architecture Module: `src/archive/sevenz.rs`
```
//! SevenZip archive format compress function

use std::{
    io::{BufWriter, Read, Seek, Write},
    path::{Path, PathBuf},
};

use bstr::ByteSlice;
use fs_err as fs;
use fs_err::PathExt;
use same_file::Handle;
use sevenz_rust2::ArchiveEntry;

use crate::{
    QuestionPolicy, Result,
    error::{Error, FinalError},
    info,
    list::{FileInArchive, ListFileType},
    utils::{
        BytesFmt, FileVisibilityPolicy, PathFmt, cd_into_same_dir_as, copy_limited_decompression,
        ensure_parent_dir_exists, is_same_file_as_output, resolve_extraction_conflict, validate_dest_inside_root,
        validate_entry_path,
    },
    warning,
};

pub fn unpack_archive<R>(
    reader: R,
    output_path: &Path,
    password: Option<&[u8]>,
    question_policy: QuestionPolicy,
) -> Result<u64>
where
    R: Read + Seek,
{
    let mut files_unpacked = 0;
    // The closure cannot return an ouch error so it is carried out here.
    let mut conflict_error = None;

    let entry_extract_fn =
        |entry: &ArchiveEntry, reader: &mut dyn Read, path: &PathBuf| -> Result<bool, sevenz_rust2::Error> {
            // Manually handle writing all files from 7z archive (the library defaults ignore empty files)

            let name_as_path = Path::new(entry.name());
            let safe_relpath = match validate_entry_path(name_as_path) {
                Ok(p) => p,
                Err(e) => {
                    warning!("skipping unsafe 7z entry {}: {}", PathFmt(name_as_path), e);
                    return Ok(true);
                }
            };
            let file_path = output_path.join(&safe_relpath);

            if let Err(e) = validate_dest_inside_root(output_path, &file_path) {
                warning!("skipping 7z entry {}: {}", PathFmt(&file_path), e);
                return Ok(true);
            }

            if entry.is_directory() {
                info!("File {} extracted to {}", entry.name(), PathFmt(&file_path));
                if !path.fs_err_try_exists()? {
                    fs::create_dir_all(path)?;
                }
            } else {
                let dest = match resolve_extraction_conflict(path, question_policy) {
                    Ok(Some(dest)) => dest,
                    Ok(None) => return Ok(true),
                    Err(err) => {
                        conflict_error = Some(err);
                        return Ok(false);
                    }
                };

                info!("extracted ({}) {}", BytesFmt(entry.size()), PathFmt(&dest));

                ensure_parent_dir_exists(&dest)?;

                let file = fs::File::create(&dest)?;
                let mut writer = BufWriter::new(file);
                copy_limited_decompression(reader, &mut writer)?;

                use filetime_creation as ft;
                // Surface mtime-set failures as warnings so users know timestamps weren't preserved
                if let Err(e) = ft::set_file_handle_times(
                    writer.get_ref().file(),
                    Some(ft::FileTime::from_system_time(entry.access_date().into())),
                    Some(ft::FileTime::from_system_time(entry.last_modified_date().into())),
                    Some(ft::FileTime::from_system_time(entry.creation_date().into())),
                ) {
                    warning!("could not set timestamps on {}: {e}", PathFmt(&dest));
                }
            }

            files_unpacked += 1;
            Ok(true) // Always proceed
        };

    let result = match password {
        Some(password) => sevenz_rust2::decompress_with_extract_fn_and_password(
            reader,
            output_path,
            sevenz_rust2::Password::from(password.to_str().map_err(|err| Error::InvalidPassword {
                reason: err.to_string(),
            })?),
            entry_extract_fn,
        ),
        None => sevenz_rust2::decompress_with_extract_fn(reader, output_path, entry_extract_fn),
    };

    // Report the prompt failure instead of the library error it caused.
    if let Some(err) = conflict_error {
        return Err(err);
    }
    result?;

    Ok(files_unpacked)
}

/// List contents of `archive_path`, returning a vector of archive entries
pub fn list_archive<R>(reader: R, password: Option<&[u8]>) -> Result<impl Iterator<Item = Result<FileInArchive>>>
where
    R: Read + Seek,
{
    let mut files = Vec::new();

    let entry_extract_fn = |entry: &ArchiveEntry, _: &mut dyn Read, _: &PathBuf| {
        files.push(Ok(FileInArchive {
            path: entry.name().into(),
            file_type: if entry.is_directory() {
                ListFileType::Directory
            } else {
                ListFileType::File
            },
            size: Some(entry.size()),
        }));
        Ok(true)
    };

    match password {
        Some(password) => {
            let password = match password.to_str() {
                Ok(p) => p,
                Err(err) => {
                    return Err(Error::InvalidPassword {
                        reason: err.to_string(),
                    });
                }
            };
            sevenz_rust2::decompress_with_extract_fn_and_password(
                reader,
                ".",
                sevenz_rust2::Password::from(password),
                entry_extract_fn,
            )?;
        }
        None => sevenz_rust2::decompress_with_extract_fn(reader, ".", entry_extract_fn)?,
    }

    Ok(files.into_iter())
}

pub fn build_archive<W>(
    files: &[PathBuf],
    output_path: &Path,
    writer: W,
    file_visibility_policy: FileVisibilityPolicy,
) -> Result<W>
where
    W: Write + Seek,
{
    let mut writer = sevenz_rust2::ArchiveWriter::new(writer)?;
    let output_handle = Handle::from_path(output_path);

    for filename in files {
        let previous_location = cd_into_same_dir_as(filename)?;
        let _cwd_guard = crate::utils::CwdGuard::new(previous_location);

        // Unwrap safety:
        //   paths should be canonicalized by now, and the root directory rejected.
        let filename = filename.file_name().unwrap();

        for entry in file_visibility_policy.build_walker(filename) {
            let entry = entry?;
            let path = entry.path();

            // Avoid compressing the output file into itself
            if let Ok(handle) = output_handle.as_ref()
                && is_same_file_as_output(path, handle)
            {
                warning!("Cannot compress {} into itself, skipping", PathFmt(output_path));
                continue;
            }

            info!("Compressing {}", PathFmt(path));

            // use metadata instead of symlink_metadata, 7z doesn't support symlinks
            let metadata = path.metadata()?;

            let entry_name = path.to_str().ok_or_else(|| {
                FinalError::with_title("7z requires that all entry names are valid UTF-8")
                    .detail(format!("File {} has a non-UTF-8 name", PathFmt(path)))
            })?;

            let entry = sevenz_rust2::ArchiveEntry::from_path(path, entry_name.to_owned());
            let entry_data = if metadata.is_dir() {
                None
            } else {
                Some(fs::File::open(path)?)
            };

            writer.push_archive_entry::<fs::File>(entry, entry_data)?;
        }
    }

    let bytes = writer.finish()?;
    Ok(bytes)
}

```

### Core Architecture Module: `src/archive/tar.rs`
```
//! Contains Tar-specific building and unpacking functions

#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::{
    collections::HashMap,
    io::{self, prelude::*},
    ops::Not,
    path::{Path, PathBuf},
};

use fs_err as fs;
use same_file::Handle;

use crate::{
    QuestionPolicy, Result,
    error::FinalError,
    info,
    list::{FileInArchive, ListFileType},
    utils::{
        self, BytesFmt, FileType, FileVisibilityPolicy, PathFmt, canonicalize, create_symlink, is_same_file_as_output,
        read_file_type, resolve_extraction_conflict, sanitize_archive_mode, set_permission_mode,
        validate_dest_inside_root, validate_entry_path, validate_symlink_target,
    },
    warning,
};

/// Unpacks the archive given by `archive` into the folder given by `into`.
/// Assumes that output_folder is empty
pub fn unpack_archive(reader: impl Read, output_folder: &Path, question_policy: QuestionPolicy) -> Result<u64> {
    let mut archive = tar::Archive::new(reader);

    let mut files_unpacked = 0;
    let mut read_only_dirs_and_modes = Vec::new();

    for entry in archive.entries()? {
        let mut entry = entry?;

        // Set when the user renamed a file so the log can show the real path.
        let mut written = None;

        match entry.header().entry_type() {
            tar::EntryType::Symlink => {
                let raw_path = entry.path()?.into_owned();
                let safe_relpath = validate_entry_path(&raw_path)?;
                let full_path = output_folder.join(&safe_relpath);
                let target = entry
                    .link_name()?
                    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Missing symlink target"))?;

                validate_symlink_target(&safe_relpath, &target)?;
                validate_dest_inside_root(output_folder, &full_path)?;
                create_symlink(&target, &full_path)?;
            }
            tar::EntryType::Link => {
                let raw_link = entry.path()?.into_owned();
                let safe_link_path = validate_entry_path(&raw_link)?;
                let raw_target = entry
                    .link_name()?
                    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Missing hardlink target"))?
                    .into_owned();
                let safe_target = validate_entry_path(&raw_target)?;

                let full_link_path = output_folder.join(&safe_link_path);
                let full_target_path = output_folder.join(&safe_target);

                validate_dest_inside_root(output_folder, &full_link_path)?;
                validate_dest_inside_root(output_folder, &full_target_path)?;
                fs::hard_link(&full_target_path, &full_link_path)?;
            }
            tar::EntryType::Regular | tar::EntryType::GNUSparse => {
                let raw_path = entry.path()?.into_owned();
                let safe_relpath = validate_entry_path(&raw_path)?;
                let full_path = output_folder.join(&safe_relpath);

                let Some(dest) = resolve_extraction_conflict(&full_path, question_policy)? else {
                    continue;
                };

                if dest == full_path {
                    entry.unpack_in(output_folder)?;
                } else {
                    entry.unpack(&dest)?;
                }
                written = Some(dest);
            }
            tar::EntryType::Directory => {
                let original_mode = entry.header().mode()?;
                let is_writeable = (original_mode & 0o200) != 0;

                // this is no-op when dir already exists, errs if a file with another type is found there
                entry.unpack_in(output_folder)?;

                if cfg!(unix) && is_writeable.not() {
                    // We unpacked a read-only directory, make it writeable so that we can
                    // create the files inside of it, by the end, restore the original mode
                    let original_path = entry.path()?.to_path_buf();
                    let safe_relpath = validate_entry_path(&original_path)?;
                    let unpacked = output_folder.join(&safe_relpath);
                    set_permission_mode(&unpacked, sanitize_archive_mode(original_mode) | 0o200)?;

                    // Store the absolute path because the restore loop runs without changing directory.
                    read_only_dirs_and_modes.push((unpacked, sanitize_archive_mode(original_mode)));
                }
            }
            _ => continue,
        }

        let unpacked_path = match written {
            Some(path) => path,
            None => output_folder.join(entry.path()?),
        };

        if entry.header().entry_type().is_dir() {
            info!("Directory {} created", PathFmt(&unpacked_path));
        } else {
            info!("extracted ({}) {}", BytesFmt(entry.size()), PathFmt(&unpacked_path));
        }
        files_unpacked += 1;
    }

    // Restore original mode for read-only dirs we made writeable
    if cfg!(unix) {
        for (path, mode) in &read_only_dirs_and_modes {
            set_permission_mode(path, *mode)?;
        }
    }

    Ok(files_unpacked)
}

/// List contents of `archive`, returning a vector of archive entries
pub fn list_archive(mut archive: tar::Archive<impl Read>) -> Result<impl Iterator<Item = Result<FileInArchive>>> {
    let entries = archive.entries()?.map(|file| {
        let file = file?;
        let path = file.path()?.into_owned();
        let size = file.header().size().ok();
        let file_type = get_file_type(file.header(), &file)?;
        Ok(FileInArchive { path, file_type, size })
    });

    Ok(entries.collect::<Vec<_>>().into_iter())
}

fn get_file_type(header: &tar::Header, file: &tar::Entry<impl Read>) -> Result<ListFileType> {
    Ok(match header.entry_type() {
        tar::EntryType::Directory => ListFileType::Directory,
        tar::EntryType::Symlink => file
            .link_name()?
            .map(|t| ListFileType::Symlink { target: t.into_owned() })
            .unwrap_or(ListFileType::File),
        tar::EntryType::Link => file
            .link_name()?
            .map(|t| ListFileType::Hardlink { target: t.into_owned() })
            .unwrap_or(ListFileType::File),
        _ => ListFileType::File,
    })
}

/// Compresses the archives given by `input_filenames` into the file given previously to `writer`.
pub fn build_archive<W>(
    explicit_paths: &[PathBuf],
    output_path: &Path,
    writer: W,
    file_visibility_policy: FileVisibilityPolicy,
    follow_symlinks: bool,
) -> Result<W>
where
    W: Write,
{
    let mut builder = tar::Builder::new(writer);
    let output_handle = Handle::from_path(output_path);
    let mut seen_inode: HashMap<(u64, u64), PathBuf> = HashMap::new();

    for explicit_path in explicit_paths {
        let previous_location = utils::cd_into_same_dir_as(explicit_path)?;
        let _cwd_guard = utils::CwdGuard::new(previous_location);

        // Unwrap expectation:
        //   paths should be canonicalized by now, and the root directory rejected.
        let filename = explicit_path.file_name().unwrap();

        let iter = file_visibility_policy.workaround_build_walker_or_broken_link_path(explicit_path, filename);

        for entry in iter {
            let path = entry?;

            // Avoid compressing the output file into itself
            if let Ok(handle) = output_handle.as_ref()
                && is_same_file_as_output(&path, handle)
            {
                warning!("Cannot compress {} into itself, skipping", PathFmt(output_path));
                continue;
            }

            info!("Compressing {}", PathFmt(&path));

            let (metadata, file_type) = {
                if follow_symlinks {
                    (path.metadata()?, read_file_type(canonicalize(&path)?)?)
                } else {
                    (path.symlink_metadata()?, read_file_type(&path)?)
                }
            };

     
```

### Core Architecture Module: `src/archive/zip.rs`
```
//! Contains Zip-specific building and unpacking functions

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::{
    io::{self, prelude::*},
    path::{Path, PathBuf},
};

use filetime_creation::{FileTime, set_file_mtime};
use fs_err as fs;
use is_executable::is_executable;
use same_file::Handle;
use time::{OffsetDateTime, PrimitiveDateTime, UtcOffset};
use zip::{self, DateTime, ZipArchive, read::ZipFile};

#[cfg(unix)]
use crate::utils::sanitize_archive_mode;
use crate::{
    QuestionPolicy, Result,
    error::FinalError,
    info, info_accessible,
    list::{FileInArchive, ListFileType},
    utils::{
        BytesFmt, FileType, FileVisibilityPolicy, PathFmt, canonicalize, cd_into_same_dir_as,
        copy_limited_decompression, create_symlink, ensure_parent_dir_exists, get_invalid_utf8_paths,
        is_same_file_as_output, pretty_format_list_of_paths, read_file_type, resolve_extraction_conflict,
        strip_cur_dir, validate_dest_inside_root, validate_symlink_target,
    },
    warning,
};

/// Unpacks the archive given by `archive` into the folder given by `output_folder`.
/// Assumes that output_folder is empty
pub fn unpack_archive<R>(
    reader: R,
    output_folder: &Path,
    password: Option<&[u8]>,
    question_policy: QuestionPolicy,
) -> Result<u64>
where
    R: Read + Seek,
{
    let mut files_unpacked = 0;
    let mut archive = ZipArchive::new(reader)?;

    for idx in 0..archive.len() {
        let mut file = match password {
            Some(password) => archive.by_index_decrypt(idx, password)?,
            None => archive.by_index(idx)?,
        };
        let relpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => {
                warning!("skipping entry {} with unsafe name: {}", idx, file.name());
                continue;
            }
        };

        let file_path = output_folder.join(&relpath);

        validate_dest_inside_root(output_folder, &file_path)?;

        display_zip_comment_if_exists(&file);

        match file.name().ends_with('/') {
            _is_dir @ true => {
                info!("Directory {} created", PathFmt(&file_path));

                let mode = file.unix_mode();
                let is_symlink = mode.is_some_and(|mode| mode & 0o170000 == 0o120000);

                if is_symlink {
                    // Symlink targets are arbitrary bytes on Unix, not guaranteed UTF-8; read as bytes.
                    let mut target_bytes = Vec::new();
                    file.read_to_end(&mut target_bytes)?;
                    let target = symlink_target_from_bytes(&target_bytes);

                    validate_symlink_target(&relpath, &target)?;
                    #[cfg(unix)]
                    std::os::unix::fs::symlink(&target, &file_path)?;
                    #[cfg(windows)]
                    std::os::windows::fs::symlink_dir(&target, file_path)?;
                } else {
                    fs::create_dir_all(&file_path)?;
                }
            }
            _is_file @ false => {
                ensure_parent_dir_exists(&file_path)?;
                let file_path = strip_cur_dir(file_path.as_path());

                let mode = file.unix_mode();
                let is_symlink = mode.is_some_and(|mode| mode & 0o170000 == 0o120000);

                // Symlink creation fails on its own when the path is taken.
                let mut resolved = None;
                if !is_symlink {
                    let Some(path) = resolve_extraction_conflict(file_path, question_policy)? else {
                        continue;
                    };
                    resolved = Some(path);
                }
                let file_path = resolved.as_deref().unwrap_or(file_path);

                if is_symlink {
                    // Symlink targets are arbitrary bytes on Unix, not guaranteed UTF-8; read as bytes.
                    let mut target_bytes = Vec::new();
                    file.read_to_end(&mut target_bytes)?;
                    let target = symlink_target_from_bytes(&target_bytes);

                    validate_symlink_target(&relpath, &target)?;
                    info!("linking {} -> \"{}\"", PathFmt(file_path), target.display());

                    create_symlink(&target, file_path)?;
                } else {
                    #[cfg(unix)]
                    let mut output_file = {
                        use fs_err::os::unix::fs::OpenOptionsExt;
                        let mode = file.unix_mode().and_then(valid_unix_permissions).unwrap_or(0o644);
                        fs::OpenOptions::new()
                            .write(true)
                            .create(true)
                            .truncate(true)
                            .mode(mode)
                            .open(file_path)?
                    };
                    #[cfg(not(unix))]
                    let mut output_file = fs::File::create(file_path)?;
                    {
                        copy_limited_decompression(&mut file, &mut output_file)?;
                    }
                    set_last_modified_time(&file, file_path)?;
                    #[cfg(unix)]
                    unix_set_permissions(file_path, &file)?;
                }

                // same reason is in _is_dir: long, often not needed text
                info!("extracted ({}) {}", BytesFmt(file.size()), PathFmt(file_path));
            }
        }

        files_unpacked += 1;
    }

    Ok(files_unpacked)
}

/// List contents of `archive`, returning a vector of archive entries
pub fn list_archive<R>(
    mut archive: ZipArchive<R>,
    password: Option<&[u8]>,
) -> impl Iterator<Item = Result<FileInArchive>>
where
    R: Read + Seek,
{
    let password = password.map(|p| p.to_owned());

    (0..archive.len()).map(move |idx| {
        let zip_result = match password.clone() {
            Some(password) => archive.by_index_decrypt(idx, &password),
            None => archive.by_index(idx),
        };

        let mut file = match zip_result {
            Ok(f) => f,
            Err(e) => return Err(e.into()),
        };

        let path = file.enclosed_name().unwrap_or_else(|| file.mangled_name()).to_owned();
        let size = Some(file.size());

        let file_type = if file.is_dir() {
            ListFileType::Directory
        } else if let Some(target) = file
            .unix_mode()
            .filter(|mode| mode & 0o170000 == 0o120000)
            .and_then(|_| {
                let mut s = Vec::new();
                file.read_to_end(&mut s)
                    .ok()
                    .map(|_| PathBuf::from(String::from_utf8_lossy(&s).into_owned()))
            })
        {
            ListFileType::Symlink { target }
        } else {
            ListFileType::File
        };

        Ok(FileInArchive { path, file_type, size })
    })
}

/// Compresses the archives given by `input_filenames` into the file given previously to `writer`.
pub fn build_archive<W>(
    input_filenames: &[PathBuf],
    output_path: &Path,
    writer: W,
    file_visibility_policy: FileVisibilityPolicy,
    follow_symlinks: bool,
) -> Result<W>
where
    W: Write + Seek,
{
    let mut writer = zip::ZipWriter::new(writer);
    let output_handle = Handle::from_path(output_path);

    // always use ZIP64 to allow compression of files larger than 4GB
    // the format is widely supported and the 20B cost is negligible
    let default_options = zip::write::SimpleFileOptions::default().large_file(true);
    let default_executable_options = default_options.unix_permissions(0o755);

    // Vec of any filename that failed the UTF-8 check
    let invalid_unicode_filenames = get_invalid_utf8_paths(input_filenames);

    if !invalid_unicode_filenames.is_empty() {
        let error = FinalError::with_title("Cannot build zip archive")
            .detail("Zip archives require files to have valid UTF-8 paths")
            .detail(format!(
                "Files with invalid paths:
```

### Core Architecture Module: `src/check.rs`
```
//! Checks for errors.

#![warn(missing_docs)]

use std::{
    ffi::OsString,
    path::{Path, PathBuf},
};

use crate::{
    QuestionAction, QuestionPolicy, Result,
    error::FinalError,
    extension::{Extension, build_archive_file_suggestion},
    info_accessible,
    utils::{
        NoQuotePathFmt, PathFmt, append_ascii_suffix_to_os_str, pretty_format_list_of_paths, try_infer_format,
        user_wants_to_continue,
    },
    warning,
};

#[allow(missing_docs)]
/// Different outcomes for file signature check that the caller must handle.
pub enum CheckFileSignatureControlFlow {
    HaltProgram,
    Continue,
    ChangeToDetectedExtension {
        new_extension: Extension,
        new_path_filename: OsString,
    },
}

/// Check if the file signature matches the detected extensions.
///
/// If the path didn't have any extensions, try to infer the format from signature.
///
/// Note that Brotli can't be detected by signature.
///
/// # Panics
///
/// - Panics if `path` has no filename.
pub fn check_file_signature(
    path: &Path,
    extensions: &[Extension],
    question_policy: QuestionPolicy,
) -> Result<CheckFileSignatureControlFlow> {
    debug_assert!(path.file_name().is_some());

    let detected_format = try_infer_format(path);
    let outer_format_from_path = extensions
        .last()
        .and_then(|extension| extension.compression_formats.last())
        .copied();

    match (detected_format, outer_format_from_path) {
        (None, None) => {
            // Do nothing, so these cases will be reported at `check::check_missing_formats_when_decompressing` together
        }
        (None, Some(_from_path)) => {
            // TODO: promote to a warning and ask the user to proceed
            info_accessible!(
                "Failed to confirm the format of {} by sniffing the contents, file might be misnamed",
                PathFmt(path),
            );
        }
        (Some(detected), None) => {
            warning!(
                "No recognized extensions in {}. Proceeding with `{}` that was detected from the file signature.",
                PathFmt(path),
                detected.as_str(),
            );

            // TODO: change question to: "do you want to proceed regardless of that"?
            if !user_wants_to_continue(path, question_policy, QuestionAction::Decompression)? {
                return Ok(CheckFileSignatureControlFlow::HaltProgram);
            }

            // We usually get the output path name by removing the extensions, in this scenario
            // we didn't recognized path extensions, so we need to improvise to create a
            // reasonable output path name
            let new_path_filename =
                append_ascii_suffix_to_os_str(path.with_extension("").file_name().unwrap(), "-output");
            return Ok(CheckFileSignatureControlFlow::ChangeToDetectedExtension {
                new_path_filename,
                new_extension: Extension::from_format(detected),
            });
        }
        (Some(detected), Some(from_path)) => {
            if from_path != detected {
                let error = FinalError::with_title(format!("Format mismatch for {}", PathFmt(path)))
                    .detail(format!(
                        "File extension suggests `{}`, but file signature indicates `{}`",
                        from_path.as_str(),
                        detected.as_str(),
                    ))
                    .hint(format!(
                        "Use the `--format {}` flag to specify the correct format",
                        detected.as_str()
                    ))
                    .hint("(If that's not correct, please rename the file)");

                return Err(error.into());
            }
        }
    }

    Ok(CheckFileSignatureControlFlow::Continue)
}

/// In the context of listing archives, this function checks if `ouch` was told to list
/// the contents of a compressed file that is not an archive
pub fn check_for_non_archive_formats(files: &[PathBuf], formats: &[Vec<Extension>]) -> Result<()> {
    let mut not_archives = files
        .iter()
        .zip(formats)
        .filter(|(_, formats)| !formats.first().map(Extension::is_archive).unwrap_or(false))
        .map(|(path, _)| path)
        .peekable();

    if not_archives.peek().is_some() {
        let not_archives: Vec<_> = not_archives.collect();
        let error = FinalError::with_title("Cannot list archive contents")
            .detail("Only archives can have their contents listed")
            .detail(format!(
                "Files are not archives: {}",
                pretty_format_list_of_paths(&not_archives)
            ));

        return Err(error.into());
    }

    Ok(())
}

/// Show error if archive format is not the first format in the chain.
pub fn check_archive_formats_position(formats: &[Extension], output_path: &Path) -> Result<()> {
    if let Some(format) = formats.iter().skip(1).find(|format| format.is_archive()) {
        let error = FinalError::with_title(format!("Cannot process {}", PathFmt(output_path)))
            .detail(format!("Found the format '{format}' in an incorrect position."))
            .detail(format!(
                "'{format}' can only be used at the start of the file extension."
            ))
            .hint(format!(
                "'{format}' is an archive format and must be at the start of the extension, for example '{format}.gz'."
            ))
            .hint(format!(
                "Otherwise, remove the last '{}' from {}.",
                format,
                PathFmt(output_path)
            ));

        return Err(error.into());
    }
    Ok(())
}

/// Check if all provided files have formats to decompress.
pub fn check_missing_formats_when_decompressing(files: &[PathBuf], formats: &[Vec<Extension>]) -> Result<()> {
    let files_with_broken_extension: Vec<&PathBuf> = files
        .iter()
        .zip(formats)
        .filter(|(_, format)| format.is_empty())
        .map(|(input_path, _)| input_path)
        .collect();

    if files_with_broken_extension.is_empty() {
        return Ok(());
    }

    let (files_with_unsupported_extensions, files_missing_extension): (Vec<&PathBuf>, Vec<&PathBuf>) =
        files_with_broken_extension
            .iter()
            .partition(|path| path.extension().is_some());

    let mut error = FinalError::with_title("Cannot decompress files");

    if !files_with_unsupported_extensions.is_empty() {
        error = error.detail(format!(
            "Files with unsupported extensions: {}",
            pretty_format_list_of_paths(&files_with_unsupported_extensions)
        ));
    }

    if !files_missing_extension.is_empty() {
        error = error.detail(format!(
            "Files with missing extensions: {}",
            pretty_format_list_of_paths(&files_missing_extension)
        ));
    }

    error = error.detail("Decompression formats are detected automatically from file extension and signature");
    error = error.hint_all_supported_formats();

    // If there's exactly one file, give a suggestion to use `--format`
    if let &[path] = files_with_broken_extension.as_slice() {
        error = error
            .hint("")
            .hint("Alternatively, you can pass an extension to the '--format' flag:")
            .hint(format!("  ouch decompress {} --format tar.gz", NoQuotePathFmt(path)));
    }

    Err(error.into())
}

/// Check if there is a first format when compressing, and returns it.
pub fn check_first_format_when_compressing<'a>(formats: &'a [Extension], output_path: &Path) -> Result<&'a Extension> {
    formats.first().ok_or_else(|| {
        FinalError::with_title(format!("Cannot compress to {}", PathFmt(output_path)))
            .detail("You must supply the compression format")
            .hint("Try adding supported extensions (see --help):")
            .hint(format!(
                "  ouch compress <FILES>... {}.tar.gz",
                NoQuotePathFmt(output
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
+2. `git pull` (e
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
+        tag = ref.rsplit("refs/tag
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
+        let datetime = zip_datetime_f
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

Co-authored-by: João Marcos <marcospb19@hotmail.com>

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
@@ 
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
