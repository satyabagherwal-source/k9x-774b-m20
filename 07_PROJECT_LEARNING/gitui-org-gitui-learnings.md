# Forensic Learning Record (Deep Inspection): gitui-org/gitui

> **Canonical Artifact**: `07_PROJECT_LEARNING/gitui-org-gitui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gitui-org/gitui](https://github.com/gitui-org/gitui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:15:02.560Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gitui-org/gitui`
- **Description**: Blazing 💥 fast terminal-ui for git written in rust 🦀
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 22548 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `asyncgit/src/sync/hooks.rs`
```
use super::{repository::repo, RepoPath};
use crate::{
	error::Result,
	sync::{
		branch::get_branch_upstream_merge,
		config::{
			push_default_strategy_config_repo,
			PushDefaultStrategyConfig,
		},
		remotes::{proxy_auto, tags::tags_missing_remote, Callbacks},
	},
};
use git2::{BranchType, Direction, Oid};
pub use git2_hooks::{PrePushRef, PrepareCommitMsgSource};
use scopetime::scope_time;
use std::collections::HashMap;

///
#[derive(Debug, PartialEq, Eq)]
pub enum HookResult {
	/// Everything went fine
	Ok,
	/// Hook returned error
	NotOk(String),
}

impl From<git2_hooks::HookResult> for HookResult {
	fn from(v: git2_hooks::HookResult) -> Self {
		match v {
			git2_hooks::HookResult::NoHookFound => Self::Ok,
			git2_hooks::HookResult::Run(response) => {
				if response.is_successful() {
					Self::Ok
				} else {
					Self::NotOk(if response.stderr.is_empty() {
						response.stdout
					} else if response.stdout.is_empty() {
						response.stderr
					} else {
						format!(
							"{}\n{}",
							response.stdout, response.stderr
						)
					})
				}
			}
		}
	}
}

/// Retrieve advertised refs from the remote for the upcoming push.
fn advertised_remote_refs(
	repo_path: &RepoPath,
	remote: Option<&str>,
	url: &str,
	basic_credential: Option<crate::sync::cred::BasicAuthCredential>,
) -> Result<HashMap<String, Oid>> {
	let repo = repo(repo_path)?;
	let mut remote_handle = if let Some(name) = remote {
		repo.find_remote(name)?
	} else {
		repo.remote_anonymous(url)?
	};

	let callbacks = Callbacks::new(None, basic_credential);
	let conn = remote_handle.connect_auth(
		Direction::Push,
		Some(callbacks.callbacks()),
		Some(proxy_auto()),
	)?;

	let mut map = HashMap::new();
	for head in conn.list()? {
		map.insert(head.name().to_string(), head.oid());
	}

	Ok(map)
}

/// Determine the remote ref name for a branch push.
///
/// Respects `push.default=upstream` config when set and upstream is configured.
/// Otherwise defaults to `refs/heads/{branch}`. Delete operations always use
/// the simple ref name.
fn get_remote_ref_for_push(
	repo_path: &RepoPath,
	branch: &str,
	delete: bool,
) -> Result<String> {
	// For delete operations, always use the simple ref name
	// regardless of push.default configuration
	if delete {
		return Ok(format!("refs/heads/{branch}"));
	}

	let repo = repo(repo_path)?;
	let push_default_strategy =
		push_default_strategy_config_repo(&repo)?;

	// When push.default=upstream, use the configured upstream ref if available
	if push_default_strategy == PushDefaultStrategyConfig::Upstream {
		if let Ok(Some(upstream_ref)) =
			get_branch_upstream_merge(repo_path, branch)
		{
			return Ok(upstream_ref);
		}
		// If upstream strategy is set but no upstream is configured,
		// fall through to default behavior
	}

	// Default: push to remote branch with same name as local
	Ok(format!("refs/heads/{branch}"))
}

/// see `git2_hooks::hooks_commit_msg`
pub fn hooks_commit_msg(
	repo_path: &RepoPath,
	msg: &mut String,
) -> Result<HookResult> {
	scope_time!("hooks_commit_msg");

	let repo = repo(repo_path)?;

	Ok(git2_hooks::hooks_commit_msg(&repo, None, msg)?.into())
}

/// see `git2_hooks::hooks_pre_commit`
pub fn hooks_pre_commit(repo_path: &RepoPath) -> Result<HookResult> {
	scope_time!("hooks_pre_commit");

	let repo = repo(repo_path)?;

	Ok(git2_hooks::hooks_pre_commit(&repo, None)?.into())
}

/// see `git2_hooks::hooks_post_commit`
pub fn hooks_post_commit(repo_path: &RepoPath) -> Result<HookResult> {
	scope_time!("hooks_post_commit");

	let repo = repo(repo_path)?;

	Ok(git2_hooks::hooks_post_commit(&repo, None)?.into())
}

/// see `git2_hooks::hooks_prepare_commit_msg`
pub fn hooks_prepare_commit_msg(
	repo_path: &RepoPath,
	source: PrepareCommitMsgSource,
	msg: &mut String,
) -> Result<HookResult> {
	scope_time!("hooks_prepare_commit_msg");

	let repo = repo(repo_path)?;

	Ok(git2_hooks::hooks_prepare_commit_msg(
		&repo, None, source, msg,
	)?
	.into())
}

/// see `git2_hooks::hooks_pre_push`
pub fn hooks_pre_push(
	repo_path: &RepoPath,
	remote: &str,
	push: &PrePushTarget<'_>,
	basic_credential: Option<crate::sync::cred::BasicAuthCredential>,
) -> Result<HookResult> {
	scope_time!("hooks_pre_push");

	let repo = repo(repo_path)?;
	if !git2_hooks::hook_available(
		&repo,
		None,
		git2_hooks::HOOK_PRE_PUSH,
	)? {
		return Ok(HookResult::Ok);
	}

	let git_remote = repo.find_remote(remote)?;
	let url = git_remote
		.pushurl()
		.ok()
		.flatten()
		.or_else(|| git_remote.url().ok())
		.ok_or_else(|| {
			crate::error::Error::Generic(format!(
				"remote '{remote}' has no URL configured"
			))
		})?
		.to_string();

	let advertised = advertised_remote_refs(
		repo_path,
		Some(remote),
		&url,
		basic_credential,
	)?;
	let updates = match push {
		PrePushTarget::Branch { branch, delete } => {
			let remote_ref =
				get_remote_ref_for_push(repo_path, branch, *delete)?;
			vec![pre_push_branch_update(
				repo_path,
				branch,
				&remote_ref,
				*delete,
				&advertised,
			)?]
		}
		PrePushTarget::Tags => {
			pre_push_tag_updates(repo_path, remote, &advertised)?
		}
	};

	Ok(git2_hooks::hooks_pre_push(
		&repo,
		None,
		Some(remote),
		&url,
		&updates,
	)?
	.into())
}

/// Build a single pre-push update line for a branch.
fn pre_push_branch_update(
	repo_path: &RepoPath,
	branch_name: &str,
	remote_ref: &str,
	delete: bool,
	advertised: &HashMap<String, Oid>,
) -> Result<PrePushRef> {
	let repo = repo(repo_path)?;
	let local_ref = format!("refs/heads/{branch_name}");
	let local_oid = (!delete)
		.then(|| {
			repo.find_branch(branch_name, BranchType::Local)
				.ok()
				.and_then(|branch| branch.get().peel_to_commit().ok())
				.map(|commit| commit.id())
		})
		.flatten();

	let remote_oid = advertised.get(remote_ref).copied();

	Ok(PrePushRef::new(
		local_ref, local_oid, remote_ref, remote_oid,
	))
}

/// Build pre-push updates for tags that are missing on the remote.
fn pre_push_tag_updates(
	repo_path: &RepoPath,
	remote: &str,
	advertised: &HashMap<String, Oid>,
) -> Result<Vec<PrePushRef>> {
	let repo = repo(repo_path)?;
	let tags = tags_missing_remote(repo_path, remote, None)?;
	let mut updates = Vec::with_capacity(tags.len());

	for tag_ref in tags {
		if let Ok(reference) = repo.find_reference(&tag_ref) {
			let tag_oid = reference.target().or_else(|| {
				reference.peel_to_commit().ok().map(|c| c.id())
			});
			let remote_ref = tag_ref.clone();
			let advertised_oid = advertised.get(&remote_ref).copied();
			updates.push(PrePushRef::new(
				tag_ref.clone(),
				tag_oid,
				remote_ref,
				advertised_oid,
			));
		}
	}

	Ok(updates)
}

/// What is being pushed.
pub enum PrePushTarget<'a> {
	/// Push a single branch.
	Branch {
		/// Local branch name being pushed.
		branch: &'a str,
		/// Whether this is a delete push.
		delete: bool,
	},
	/// Push tags.
	Tags,
}

#[cfg(test)]
mod tests {
	use std::{ffi::OsString, io::Write as _, path::Path};

	use git2::Repository;
	use tempfile::TempDir;

	use super::*;
	use crate::sync::tests::repo_init_with_prefix;

	fn repo_init() -> Result<(TempDir, Repository)> {
		let mut os_string: OsString = OsString::new();

		os_string.push("gitui $# ' ");

		#[cfg(target_os = "linux")]
		{
			use std::os::unix::ffi::OsStrExt;

			const INVALID_UTF8: &[u8] = b"\xED\xA0\x80";

			os_string.push(std::ffi::OsStr::from_bytes(INVALID_UTF8));

			assert!(os_string.to_str().is_none());
		}

		os_string.push(" ");

		repo_init_with_prefix(os_string)
	}

	fn create_hook_in_path(path: &Path, hook_script: &[u8]) {
		std::fs::File::create(path)
			.unwrap()
			.write_all(hook_script)
			.unwrap();

		#[cfg(unix)]
		{
			std::process::Command::new("chmod")
				.arg("+x")
				.arg(path)
				// .current_dir(path)
				.output()
				.unwrap();
		}
	}

	#[test]
	fn test_post_commit_hook_reject_in_subfolder() {
		let (_td, repo) = repo_init().unwrap();
		let root = repo.workdir().unwrap();

		let hook = b"#!/bin/sh
	echo 'rejected'
	exit 1
			";

		git2_hooks::create_hook(
			&repo,
			git2_hooks::HOOK_POST_COMMIT,
			hook,
		);

		let subfolder = root.join("foo/");
		std::fs::create_dir_all(&subfolder).unwrap();

		let res = hooks_post_commit(&subfolder.into()).unwrap();

		assert_eq!(
			res,
			HookResult::NotOk(String::from("rejected\n"))
		);
	}

	// make sure we run the hooks with the correct pwd.
	// for non-bare repos this is the dir of the worktree
	// unfortunately does not work on windows
	#[test]
	#[cfg(unix)]
	fn test_pre_commit_workdir() {
		let (_td, repo) = repo_init().unwrap();
		let root = repo.workdir().unwrap();
		let repo_path: &RepoPath = &root.to_path_buf().into();

		let hook = b"#!/bin/sh
	echo \"$(pwd)\"
	exit 1
		";
		git2_hooks::create_hook(
			&repo,
			git2_hooks::HOOK_PRE_COMMIT,
			hook,
		);
		let res = hooks_pre_commit(repo_path).unwrap();
		if let HookResult::NotOk(res) = res {
			assert_eq!(
				res.trim_end().trim_end_matches('/'),
				// TODO: fix if output isn't utf8.
				root.to_string_lossy().trim_end_matches('/'),
			);
		} else {
			assert!(false);
		}
	}

	#[test]
	fn test_hooks_commit_msg_reject_in_subfolder() {
		let (_td, repo) = repo_init().unwrap();
		let root = repo.workdir().unwrap();

		let hook = b"#!/bin/sh
	echo 'msg' > \"$1\"
	echo 'rejected'
	exit 1
		";

		git2_hooks::create_hook(
			&repo,
			git2_hooks::HOOK_COMMIT_MSG,
			hook,
		);

		let subfolder = root.join("foo/");
		std::fs::create_dir_all(&subfolder).unwrap();

		let mut msg = String::from("test");
		let res =
			hooks_commit_msg(&subfolder.into(), &mut msg).unwrap();

		assert_eq!(
			res,
			HookResult::NotOk(String::from("rejected\n"))
		);

		assert_eq!(msg, String::from("msg\n"));
	}

	#[test]
	fn test_hooks_commit_msg_reject_in_hooks_folder_githooks_moved_absolute(
	) {
		let (_td, repo) = repo_init().unwrap();
		let root = repo.workdir().unwrap();
		let mut config = repo.config().unwrap();

		const HOOKS_DIR: &str = "my_hooks";
		config.set_str("core.hooksPath", HOOKS_DIR).unwrap();

		let hook = b"#!/bin/sh
	echo 'msg' > \"$1\"
	ech
```

### Core Architecture Module: `asyncgit/src/sync/state.rs`
```
use super::RepoPath;
use crate::{error::Result, sync::repository::repo};
use git2::RepositoryState;
use scopetime::scope_time;

///
#[derive(Debug, PartialEq, Eq)]
pub enum RepoState {
	///
	Clean,
	///
	Merge,
	///
	Rebase,
	///
	Revert,
	///
	Other,
}

impl From<RepositoryState> for RepoState {
	fn from(state: RepositoryState) -> Self {
		match state {
			RepositoryState::Clean => Self::Clean,
			RepositoryState::Merge => Self::Merge,
			RepositoryState::Revert => Self::Revert,
			RepositoryState::RebaseMerge => Self::Rebase,
			_ => {
				log::warn!("state not supported yet: {state:?}");
				Self::Other
			}
		}
	}
}

///
pub fn repo_state(repo_path: &RepoPath) -> Result<RepoState> {
	scope_time!("repo_state");

	let repo = repo(repo_path)?;

	let state = repo.state();

	Ok(state.into())
}

```

### Core Architecture Module: `asyncgit/src/sync/utils.rs`
```
//! sync git api (various methods)

use super::{
	repository::repo, CommitId, RepoPath, ShowUntrackedFilesConfig,
};
use crate::{
	error::{Error, Result},
	sync::config::untracked_files_config_repo,
};
use git2::{IndexAddOption, Repository, RepositoryOpenFlags};
use scopetime::scope_time;
use std::{
	fs::File,
	io::Write,
	path::{Path, PathBuf},
};

///
#[derive(PartialEq, Eq, Debug, Clone)]
pub struct Head {
	///
	pub name: String,
	///
	pub id: CommitId,
}

///
pub fn repo_open_error(repo_path: &RepoPath) -> Option<String> {
	if let Err(e) = Repository::open_ext(
		repo_path.gitpath(),
		RepositoryOpenFlags::FROM_ENV,
		Vec::<&Path>::new(),
	) {
		return Some(e.to_string());
	}

	gix::ThreadSafeRepository::discover_with_environment_overrides(
		repo_path.gitpath(),
	)
	.map_or_else(|e| Some(e.to_string()), |_| None)
}

///
pub(crate) fn work_dir(repo: &Repository) -> Result<&Path> {
	repo.workdir().ok_or(Error::NoWorkDir)
}

/// path to .git folder
pub fn repo_dir(repo_path: &RepoPath) -> Result<PathBuf> {
	let repo = repo(repo_path)?;
	Ok(repo.path().to_owned())
}

///
pub fn repo_work_dir(repo_path: &RepoPath) -> Result<String> {
	let repo = repo(repo_path)?;
	work_dir(&repo)?.to_str().map_or_else(
		|| Err(Error::Generic("invalid workdir".to_string())),
		|workdir| Ok(workdir.to_string()),
	)
}

///
pub fn get_head(repo_path: &RepoPath) -> Result<CommitId> {
	let repo = repo(repo_path)?;
	get_head_repo(&repo)
}

///
pub fn get_head_tuple(repo_path: &RepoPath) -> Result<Head> {
	let repo = repo(repo_path)?;
	let id = get_head_repo(&repo)?;
	let name = get_head_refname(&repo)?;

	Ok(Head { name, id })
}

///
pub fn get_head_refname(repo: &Repository) -> Result<String> {
	let head = repo.head()?;
	let ref_name = bytes2string(head.name_bytes())?;

	Ok(ref_name)
}

///
pub fn get_head_repo(repo: &Repository) -> Result<CommitId> {
	scope_time!("get_head_repo");

	let head = repo.head()?.target();

	head.map_or(Err(Error::NoHead), |head_id| Ok(head_id.into()))
}

/// add a file diff from workingdir to stage (will not add removed files see `stage_addremoved`)
pub fn stage_add_file(
	repo_path: &RepoPath,
	path: &Path,
) -> Result<()> {
	scope_time!("stage_add_file");

	let repo = repo(repo_path)?;

	let mut index = repo.index()?;

	index.add_path(path)?;
	index.write()?;

	Ok(())
}

/// like `stage_add_file` but uses a pattern to match/glob multiple files/folders
pub fn stage_add_all(
	repo_path: &RepoPath,
	pattern: &str,
	stage_untracked: Option<ShowUntrackedFilesConfig>,
) -> Result<()> {
	scope_time!("stage_add_all");

	let repo = repo(repo_path)?;

	let mut index = repo.index()?;

	let stage_untracked = if let Some(config) = stage_untracked {
		config
	} else {
		untracked_files_config_repo(&repo)?
	};

	if stage_untracked.include_untracked() {
		index.add_all(
			vec![pattern],
			IndexAddOption::DEFAULT,
			None,
		)?;
	} else {
		index.update_all(vec![pattern], None)?;
	}

	index.write()?;

	Ok(())
}

/// Undo last commit in repo
pub fn undo_last_commit(repo_path: &RepoPath) -> Result<()> {
	let repo = repo(repo_path)?;
	let previous_commit = repo.revparse_single("HEAD~")?;

	Repository::reset(
		&repo,
		&previous_commit,
		git2::ResetType::Soft,
		None,
	)?;

	Ok(())
}

/// stage a removed file
pub fn stage_addremoved(
	repo_path: &RepoPath,
	path: &Path,
) -> Result<()> {
	scope_time!("stage_addremoved");

	let repo = repo(repo_path)?;

	let mut index = repo.index()?;

	index.remove_path(path)?;
	index.write()?;

	Ok(())
}

pub(crate) fn bytes2string(bytes: &[u8]) -> Result<String> {
	Ok(String::from_utf8(bytes.to_vec())?)
}

/// write a file in repo
pub(crate) fn repo_write_file(
	repo: &Repository,
	file: &str,
	content: &str,
) -> Result<()> {
	let dir = work_dir(repo)?.join(file);
	let file_path = dir.to_str().ok_or_else(|| {
		Error::Generic(String::from("invalid file path"))
	})?;
	let mut file = File::create(file_path)?;
	file.write_all(content.as_bytes())?;
	Ok(())
}

///
pub fn read_file(path: &Path) -> Result<String> {
	use std::io::Read;

	let mut file = File::open(path)?;
	let mut buffer = Vec::new();
	file.read_to_end(&mut buffer)?;

	Ok(String::from_utf8(buffer)?)
}

#[cfg(test)]
pub(crate) fn repo_read_file(
	repo: &Repository,
	file: &str,
) -> Result<String> {
	use std::io::Read;

	let dir = work_dir(repo)?.join(file);
	let file_path = dir.to_str().ok_or_else(|| {
		Error::Generic(String::from("invalid file path"))
	})?;

	let mut file = File::open(file_path)?;
	let mut buffer = Vec::new();
	file.read_to_end(&mut buffer)?;

	Ok(String::from_utf8(buffer)?)
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::sync::{
		commit,
		diff::get_diff,
		status::{get_status, StatusType},
		tests::{
			debug_cmd_print, get_statuses, repo_init,
			repo_init_empty, write_commit_file,
		},
	};
	use std::{
		env,
		fs::{self, remove_file, File},
		io::Write,
		path::Path,
	};

	#[test]
	fn test_stage_add_smoke() {
		let file_path = Path::new("foo");
		let (_td, repo) = repo_init_empty().unwrap();
		let root = repo.path().parent().unwrap();
		let repo_path = root.as_os_str().to_str().unwrap();

		assert!(stage_add_file(&repo_path.into(), file_path).is_err());
	}

	#[test]
	fn test_staging_one_file() {
		let file_path = Path::new("file1.txt");
		let (_td, repo) = repo_init().unwrap();
		let root = repo.path().parent().unwrap();
		let repo_path: &RepoPath =
			&root.as_os_str().to_str().unwrap().into();

		File::create(root.join(file_path))
			.unwrap()
			.write_all(b"test file1 content")
			.unwrap();

		File::create(root.join(Path::new("file2.txt")))
			.unwrap()
			.write_all(b"test file2 content")
			.unwrap();

		assert_eq!(get_statuses(repo_path), (2, 0));

		stage_add_file(repo_path, file_path).unwrap();

		assert_eq!(get_statuses(repo_path), (1, 1));
	}

	#[test]
	fn test_staging_one_file_from_different_sub_directory() {
		// This test case covers an interaction between current working directory and the way
		// `gitoxide` handles pathspecs.
		//
		// When staging a new file in one sub-directory, then running running `get_status` in a
		// different sub-directory, `repo.pathspec` in `get_status` has to initialized with
		// `empty_patterns_match_prefix` set to `false` for `get_status` to report the staged file’s
		// status.
		let file_path = Path::new("untracked/file1.txt");
		let (_td, repo) = repo_init().unwrap();
		let root = repo.path().parent().unwrap();
		let repo_path: &RepoPath =
			&root.as_os_str().to_str().unwrap().into();

		fs::create_dir(root.join("untracked")).unwrap();

		File::create(root.join(file_path))
			.unwrap()
			.write_all(b"test file1 content")
			.unwrap();

		let sub_dir_path = root.join("unrelated");

		fs::create_dir(root.join("unrelated")).unwrap();

		let current_dir = env::current_dir().unwrap();
		env::set_current_dir(sub_dir_path).unwrap();

		assert_eq!(get_statuses(repo_path), (1, 0));

		stage_add_file(repo_path, file_path).unwrap();

		assert_eq!(get_statuses(repo_path), (0, 1));

		env::set_current_dir(current_dir).unwrap();
	}

	#[test]
	fn test_staging_folder() -> Result<()> {
		let (_td, repo) = repo_init().unwrap();
		let root = repo.path().parent().unwrap();
		let repo_path: &RepoPath =
			&root.as_os_str().to_str().unwrap().into();

		let status_count = |s: StatusType| -> usize {
			get_status(repo_path, s, None).unwrap().len()
		};

		fs::create_dir_all(root.join("a/d"))?;
		File::create(root.join(Path::new("a/d/f1.txt")))?
			.write_all(b"foo")?;
		File::create(root.join(Path::new("a/d/f2.txt")))?
			.write_all(b"foo")?;
		File::create(root.join(Path::new("a/f3.txt")))?
			.write_all(b"foo")?;

		repo.config()?.set_str("status.showUntrackedFiles", "all")?;

		assert_eq!(status_count(StatusType::WorkingDir), 3);

		stage_add_all(repo_path, "a/d", None).unwrap();

		assert_eq!(status_count(StatusType::WorkingDir), 1);
		assert_eq!(status_count(StatusType::Stage), 2);

		Ok(())
	}

	#[test]
	fn test_undo_commit_empty_repo() {
		let (_td, repo) = repo_init().unwrap();
		let root = repo.path().parent().unwrap();
		let repo_path: &RepoPath =
			&root.as_os_str().to_str().unwrap().into();

		// expect to fail
		assert!(undo_last_commit(repo_path).is_err());
	}

	#[test]
	fn test_undo_commit() {
		let (_td, repo) = repo_init().unwrap();
		let root = repo.path().parent().unwrap();
		let repo_path: &RepoPath =
			&root.as_os_str().to_str().unwrap().into();

		// write commit file test.txt
		let c1 =
			write_commit_file(&repo, "test.txt", "content1", "c1");
		let _c2 =
			write_commit_file(&repo, "test.txt", "content2", "c2");
		assert!(undo_last_commit(repo_path).is_ok());

		// Make sure that HEAD points to c1
		assert_eq!(c1, get_head_repo(&repo).unwrap());

		// Make sure that now we have 1 file staged
		assert_eq!(get_statuses(repo_path), (0, 1));

		// And that file is test.txt
		let diff =
			get_diff(repo_path, "test.txt", true, None).unwrap();
		assert_eq!(&*diff.hunks[0].lines[0].content, "@@ -1 +1 @@");
	}

	#[test]
	fn test_not_staging_untracked_folder() -> Result<()> {
		let (_td, repo) = repo_init().unwrap();
		let root = repo.path().parent().unwrap();
		let repo_path: &RepoPath =
			&root.as_os_str().to_str().unwrap().into();

		fs::create_dir_all(root.join("a/d"))?;
		File::create(root.join(Path::new("a/d/f1.txt")))?
			.write_all(b"foo")?;
		File::create(root.join(Path::new("a/d/f2.txt")))?
			.write_all(b"foo")?;
		File::create(root.join(Path::new("f3.txt")))?
			.write_all(b"foo")?;

		repo.config()?.set_str("status.showUntrackedFiles", "all")?;

		assert_eq!(get_statuses(repo_path), (3, 0));

		repo.config()?.set_str("status.showUntrackedFiles", "no")?;

		assert_eq!(get_statuses(repo_path), (0, 0));

		stage_add_all(repo_path, "*", None).unwrap();

		assert_eq!(get_statuses(repo_path), (0, 0));

		Ok(())
	}

	#[test]
	fn test_staging_deleted_file() {
		let file_path = Path::new("file1.txt");
		let (_td, repo) = repo_init().unwrap();
		let root = repo.path().parent().unwrap();
		let repo_path: &RepoPath =
			&root.as_os_str().to_str
```

### Core Architecture Module: `git2-hooks/src/error.rs`
```
use thiserror::Error;

/// crate specific error type
#[derive(Error, Debug)]
pub enum HooksError {
	#[error("git error:{0}")]
	Git(#[from] git2::Error),

	#[error("io error:{0}")]
	Io(#[from] std::io::Error),

	#[error("path string conversion error")]
	PathToString,

	#[error("shellexpand error:{0}")]
	ShellExpand(#[from] shellexpand::LookupError<std::env::VarError>),

	#[error("hook process terminated by signal without exit code")]
	NoExitCode,
}

/// crate specific `Result` type
pub type Result<T> = std::result::Result<T, HooksError>;

```

### Core Architecture Module: `git2-hooks/src/hookspath.rs`
```
use git2::Repository;

use crate::{error::Result, HookResult, HooksError};

use std::{
	ffi::{OsStr, OsString},
	path::{Path, PathBuf},
	process::Command,
	str::FromStr,
};

pub struct HookPaths {
	pub git: PathBuf,
	pub hook: PathBuf,
	pub pwd: PathBuf,
}

const CONFIG_HOOKS_PATH: &str = "core.hooksPath";
const DEFAULT_HOOKS_PATH: &str = "hooks";
const ENOEXEC: i32 = 8;

impl HookPaths {
	/// `core.hooksPath` always takes precedence.
	/// If its defined and there is no hook `hook` this is not considered
	/// an error or a reason to search in other paths.
	/// If the config is not set we go into search mode and
	/// first check standard `.git/hooks` folder and any sub path provided in `other_paths`.
	///
	/// Note: we try to model as closely as possible what git shell is doing.
	pub fn new(
		repo: &Repository,
		other_paths: Option<&[&str]>,
		hook: &str,
	) -> Result<Self> {
		let pwd = repo
			.workdir()
			.unwrap_or_else(|| repo.path())
			.to_path_buf();

		let git_dir = repo.path().to_path_buf();

		if let Some(config_path) = Self::config_hook_path(repo)? {
			let hooks_path = PathBuf::from(config_path);

			let hook =
				Self::expand_path(&hooks_path.join(hook), &pwd)?;

			return Ok(Self {
				git: git_dir,
				hook,
				pwd,
			});
		}

		Ok(Self {
			git: git_dir,
			hook: Self::find_hook(repo, other_paths, hook),
			pwd,
		})
	}

	/// Expand path according to the rule of githooks and config
	/// core.hooksPath
	fn expand_path(path: &Path, pwd: &Path) -> Result<PathBuf> {
		let hook_expanded = shellexpand::full(
			path.as_os_str()
				.to_str()
				.ok_or(HooksError::PathToString)?,
		)?;
		let hook_expanded = PathBuf::from_str(hook_expanded.as_ref())
			.map_err(|_| HooksError::PathToString)?;

		// `man git-config`:
		//
		// > A relative path is taken as relative to the
		// > directory where the hooks are run (see the
		// > "DESCRIPTION" section of githooks[5]).
		//
		// `man githooks`:
		//
		// > Before Git invokes a hook, it changes its
		// > working directory to either $GIT_DIR in a bare
		// > repository or the root of the working tree in a
		// > non-bare repository.
		//
		// I.e. relative paths in core.hooksPath in non-bare
		// repositories are always relative to GIT_WORK_TREE.
		Ok({
			if hook_expanded.is_absolute() {
				hook_expanded
			} else {
				pwd.join(hook_expanded)
			}
		})
	}

	fn config_hook_path(repo: &Repository) -> Result<Option<String>> {
		Ok(repo.config()?.get_string(CONFIG_HOOKS_PATH).ok())
	}

	/// check default hook path first and then followed by `other_paths`.
	/// if no hook is found we return the default hook path
	fn find_hook(
		repo: &Repository,
		other_paths: Option<&[&str]>,
		hook: &str,
	) -> PathBuf {
		let mut paths = vec![DEFAULT_HOOKS_PATH.to_string()];
		if let Some(others) = other_paths {
			paths.extend(
				others
					.iter()
					.map(|p| p.trim_end_matches('/').to_string()),
			);
		}

		for p in paths {
			let p = repo.path().to_path_buf().join(p).join(hook);
			if p.exists() {
				return p;
			}
		}

		repo.path()
			.to_path_buf()
			.join(DEFAULT_HOOKS_PATH)
			.join(hook)
	}

	/// was a hook file found and is it executable
	pub fn found(&self) -> bool {
		self.hook.exists() && is_executable(&self.hook)
	}

	/// this function calls hook scripts based on conventions documented here
	/// see <https://git-scm.com/docs/githooks>
	pub fn run_hook(&self, args: &[&str]) -> Result<HookResult> {
		self.run_hook_os_str(args)
	}

	/// this function calls hook scripts based on conventions documented here
	/// see <https://git-scm.com/docs/githooks>
	pub fn run_hook_os_str<I, S>(&self, args: I) -> Result<HookResult>
	where
		I: IntoIterator<Item = S> + Copy,
		S: AsRef<OsStr>,
	{
		self.run_hook_os_str_with_stdin(args, None)
	}

	/// this function calls hook scripts with stdin input based on conventions documented here
	/// see <https://git-scm.com/docs/githooks>
	pub fn run_hook_os_str_with_stdin<I, S>(
		&self,
		args: I,
		stdin: Option<&[u8]>,
	) -> Result<HookResult>
	where
		I: IntoIterator<Item = S> + Copy,
		S: AsRef<OsStr>,
	{
		let hook = self.hook.clone();
		log::trace!(
			"run hook '{}' in '{}'",
			hook.display(),
			self.pwd.display()
		);

		let run_command = |command: &mut Command| {
			let mut child = command
				.args(args)
				.current_dir(&self.pwd)
				.with_no_window()
				.stdin(if stdin.is_some() {
					std::process::Stdio::piped()
				} else {
					std::process::Stdio::null()
				})
				.stdout(std::process::Stdio::piped())
				.stderr(std::process::Stdio::piped())
				.spawn()?;

			if let (Some(mut stdin_handle), Some(input)) =
				(child.stdin.take(), stdin)
			{
				use std::io::{ErrorKind, Write};

				// Write stdin to hook process
				// Ignore broken pipe - hook may exit early without reading all input
				let _ =
					stdin_handle.write_all(input).inspect_err(|e| {
						match e.kind() {
							ErrorKind::BrokenPipe => {
								log::debug!(
									"Hook closed stdin early"
								);
							}
							_ => log::warn!(
								"Failed to write stdin to hook: {e}"
							),
						}
					});
			}

			child.wait_with_output()
		};

		let output = if cfg!(windows) {
			// execute hook in shell
			let command = {
				// SEE: https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_02_02
				// Enclosing characters in single-quotes ( '' ) shall preserve the literal value of each character within the single-quotes.
				// A single-quote cannot occur within single-quotes.
				const REPLACEMENT: &str = concat!(
					"'",   // closing single-quote
					"\\'", // one escaped single-quote (outside of single-quotes)
					"'",   // new single-quote
				);

				let mut os_str = OsString::new();
				os_str.push("'");
				if let Some(hook) = hook.to_str() {
					os_str.push(hook.replace('\'', REPLACEMENT));
				} else {
					#[cfg(windows)]
					{
						use std::os::windows::ffi::OsStrExt;
						if hook
							.as_os_str()
							.encode_wide()
							.any(|x| x == u16::from(b'\''))
						{
							// TODO: escape single quotes instead of failing
							return Err(HooksError::PathToString);
						}
					}

					os_str.push(hook.as_os_str());
				}
				os_str.push("'");
				os_str.push(" \"$@\"");

				os_str
			};
			run_command(
				sh_command().arg("-c").arg(command).arg(&hook),
			)
		} else {
			// execute hook directly
			match run_command(&mut Command::new(&hook)) {
				Err(err) if err.raw_os_error() == Some(ENOEXEC) => {
					run_command(sh_command().arg(&hook))
				}
				result => result,
			}
		}?;

		let stderr =
			String::from_utf8_lossy(&output.stderr).to_string();
		let stdout =
			String::from_utf8_lossy(&output.stdout).to_string();

		// Get exit code, or fail if process was killed by signal
		let code =
			output.status.code().ok_or(HooksError::NoExitCode)?;

		Ok(HookResult::Run(crate::HookRunResponse {
			hook,
			stdout,
			stderr,
			code,
		}))
	}
}

fn sh_command() -> Command {
	let mut command = Command::new(gix_path::env::shell());

	if cfg!(windows) {
		// This call forces Command to handle the Path environment correctly on windows,
		// the specific env set here does not matter
		// see https://github.com/rust-lang/rust/issues/37519
		command.env(
			"DUMMY_ENV_TO_FIX_WINDOWS_CMD_RUNS",
			"FixPathHandlingOnWindows",
		);

		// Use -l to avoid "command not found"
		command.arg("-l");
	}

	command
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
	use std::os::unix::fs::PermissionsExt;

	let metadata = match path.metadata() {
		Ok(metadata) => metadata,
		Err(e) => {
			log::error!("metadata error: {e}");
			return false;
		}
	};

	let permissions = metadata.permissions();

	permissions.mode() & 0o111 != 0
}

#[cfg(windows)]
/// windows does not consider shell scripts to be executable so we consider everything
/// to be executable (which is not far from the truth for windows platform.)
const fn is_executable(_: &Path) -> bool {
	true
}

trait CommandExt {
	/// The process is a console application that is being run without a
	/// console window. Therefore, the console handle for the application is
	/// not set.
	///
	/// This flag is ignored if the application is not a console application,
	/// or if it used with either `CREATE_NEW_CONSOLE` or `DETACHED_PROCESS`.
	///
	/// See: <https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags>
	#[cfg(windows)]
	const CREATE_NO_WINDOW: u32 = 0x0800_0000;

	fn with_no_window(&mut self) -> &mut Self;
}

impl CommandExt for Command {
	/// On Windows, CLI applications that aren't the window's subsystem will
	/// create and show a console window that pops up next to the main
	/// application window when run. We disable this behavior by setting the
	/// `CREATE_NO_WINDOW` flag.
	#[inline]
	fn with_no_window(&mut self) -> &mut Self {
		#[cfg(windows)]
		{
			use std::os::windows::process::CommandExt;
			self.creation_flags(Self::CREATE_NO_WINDOW);
		}

		self
	}
}

#[cfg(test)]
mod test {
	use super::HookPaths;
	use std::path::Path;

	#[test]
	fn test_hookspath_relative() {
		assert_eq!(
			HookPaths::expand_path(
				Path::new("pre-commit"),
				Path::new("example_git_root"),
			)
			.unwrap(),
			Path::new("example_git_root").join("pre-commit")
		);
	}

	#[test]
	fn test_hookspath_absolute() {
		let absolute_hook =
			std::env::current_dir().unwrap().join("pre-commit");
		assert_eq!(
			HookPaths::expand_path(
				&absolute_hook,
				Path::new("example_git_root"),
			)
			.unwrap(),
			absolute_hook
		);
	}
}

```

### Core Architecture Module: `git2-hooks/src/lib.rs`
```
//! git2-rs addon supporting git hooks
//!
//! we look for hooks in the following locations:
//!  * whatever `config.hooksPath` points to
//!  * `.git/hooks/`
//!  * whatever list of paths provided as `other_paths` (in order)
//!
//! most basic hook is: [`hooks_pre_commit`]. see also other `hooks_*` functions.
//!
//! [`create_hook`] is useful to create git hooks from code (unittest make heavy usage of it)

#![forbid(unsafe_code)]
#![deny(
	mismatched_lifetime_syntaxes,
	unused_imports,
	unused_must_use,
	dead_code,
	unstable_name_collisions,
	unused_assignments
)]
#![deny(clippy::all, clippy::perf, clippy::pedantic, clippy::nursery)]
#![allow(
	clippy::missing_errors_doc,
	clippy::must_use_candidate,
	clippy::module_name_repetitions
)]

mod error;
mod hookspath;

use std::{
	fs::File,
	io::{Read, Write},
	path::{Path, PathBuf},
};

pub use error::HooksError;
use error::Result;
use hookspath::HookPaths;

use git2::{Oid, Repository};

pub const HOOK_POST_COMMIT: &str = "post-commit";
pub const HOOK_PRE_COMMIT: &str = "pre-commit";
pub const HOOK_COMMIT_MSG: &str = "commit-msg";
pub const HOOK_PREPARE_COMMIT_MSG: &str = "prepare-commit-msg";
pub const HOOK_PRE_PUSH: &str = "pre-push";

const HOOK_COMMIT_MSG_TEMP_FILE: &str = "COMMIT_EDITMSG";

/// Check if a given hook is present considering config/paths and optional extra paths.
pub fn hook_available(
	repo: &Repository,
	other_paths: Option<&[&str]>,
	hook: &str,
) -> Result<bool> {
	let hook = HookPaths::new(repo, other_paths, hook)?;
	Ok(hook.found())
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PrePushRef {
	pub local_ref: String,
	pub local_oid: Option<Oid>,
	pub remote_ref: String,
	pub remote_oid: Option<Oid>,
}

impl PrePushRef {
	pub fn new(
		local_ref: impl Into<String>,
		local_oid: Option<Oid>,
		remote_ref: impl Into<String>,
		remote_oid: Option<Oid>,
	) -> Self {
		Self {
			local_ref: local_ref.into(),
			local_oid,
			remote_ref: remote_ref.into(),
			remote_oid,
		}
	}

	fn format_oid(oid: Option<Oid>) -> String {
		// "If the foreign ref does not yet exist the <remote-object-name> will be the all-zeroes object name"
		// see https://git-scm.com/docs/githooks#_pre_push
		oid.map_or_else(|| "0".repeat(40), |id| id.to_string())
	}

	pub fn to_line(&self) -> String {
		format!(
			"{} {} {} {}",
			self.local_ref,
			Self::format_oid(self.local_oid),
			self.remote_ref,
			Self::format_oid(self.remote_oid)
		)
	}

	/// Build stdin content from a slice of updates (for pre-push hook)
	pub fn to_stdin(updates: &[Self]) -> String {
		let mut stdin = String::new();
		for update in updates {
			stdin.push_str(&update.to_line());
			stdin.push('\n');
		}
		stdin
	}
}

/// Response from running a hook
#[derive(Debug, PartialEq, Eq)]
pub struct HookRunResponse {
	/// path of the hook that was run
	pub hook: PathBuf,
	/// stdout output emitted by hook
	pub stdout: String,
	/// stderr output emitted by hook
	pub stderr: String,
	/// exit code as reported back from process calling the hook (0 = success)
	pub code: i32,
}

#[derive(Debug, PartialEq, Eq)]
pub enum HookResult {
	/// No hook found
	NoHookFound,
	/// Hook executed (check `HookRunResponse.code` for success/failure)
	Run(HookRunResponse),
}

impl HookResult {
	/// helper to check if hook ran successfully (found and exit code 0)
	pub const fn is_successful(&self) -> bool {
		matches!(self, Self::Run(response) if response.is_successful())
	}
}

impl HookRunResponse {
	/// Check if the hook succeeded (exit code 0)
	pub const fn is_successful(&self) -> bool {
		self.code == 0
	}
}

/// helper method to create git hooks programmatically (heavy used in unittests)
///
/// # Panics
/// Panics if hook could not be created
pub fn create_hook(
	r: &Repository,
	hook: &str,
	hook_script: &[u8],
) -> PathBuf {
	let hook = HookPaths::new(r, None, hook).unwrap();

	let path = hook.hook.clone();

	create_hook_in_path(&hook.hook, hook_script);

	path
}

fn create_hook_in_path(path: &Path, hook_script: &[u8]) {
	File::create(path).unwrap().write_all(hook_script).unwrap();

	#[cfg(unix)]
	{
		std::process::Command::new("chmod")
			.arg("+x")
			.arg(path)
			// .current_dir(path)
			.output()
			.unwrap();
	}
}

/// Git hook: `commit_msg`
///
/// This hook is documented here <https://git-scm.com/docs/githooks#_commit_msg>.
/// We use the same convention as other git clients to create a temp file containing
/// the commit message at `<.git|hooksPath>/COMMIT_EDITMSG` and pass it's relative path as the only
/// parameter to the hook script.
pub fn hooks_commit_msg(
	repo: &Repository,
	other_paths: Option<&[&str]>,
	msg: &mut String,
) -> Result<HookResult> {
	let hook = HookPaths::new(repo, other_paths, HOOK_COMMIT_MSG)?;

	if !hook.found() {
		return Ok(HookResult::NoHookFound);
	}

	let temp_file = hook.git.join(HOOK_COMMIT_MSG_TEMP_FILE);
	File::create(&temp_file)?.write_all(msg.as_bytes())?;

	let res = hook.run_hook_os_str([&temp_file])?;

	// load possibly altered msg
	msg.clear();
	File::open(temp_file)?.read_to_string(msg)?;

	Ok(res)
}

/// this hook is documented here <https://git-scm.com/docs/githooks#_pre_commit>
pub fn hooks_pre_commit(
	repo: &Repository,
	other_paths: Option<&[&str]>,
) -> Result<HookResult> {
	let hook = HookPaths::new(repo, other_paths, HOOK_PRE_COMMIT)?;

	if !hook.found() {
		return Ok(HookResult::NoHookFound);
	}

	hook.run_hook(&[])
}

/// this hook is documented here <https://git-scm.com/docs/githooks#_post_commit>
pub fn hooks_post_commit(
	repo: &Repository,
	other_paths: Option<&[&str]>,
) -> Result<HookResult> {
	let hook = HookPaths::new(repo, other_paths, HOOK_POST_COMMIT)?;

	if !hook.found() {
		return Ok(HookResult::NoHookFound);
	}

	hook.run_hook(&[])
}

/// this hook is documented here <https://git-scm.com/docs/githooks#_pre_push>
///
/// According to git documentation, pre-push hook receives:
/// - remote name as first argument (or URL if remote is not named)
/// - remote URL as second argument
/// - information about refs being pushed via stdin in format:
///   `<local-ref> SP <local-object-name> SP <remote-ref> SP <remote-object-name> LF`
///
/// If `remote` is `None` or empty, the `url` is used for both arguments as per Git spec.
///
/// Note: The hook is called even when `updates` is empty (matching Git's behavior).
/// This can occur when pushing tags that already exist on the remote.
pub fn hooks_pre_push(
	repo: &Repository,
	other_paths: Option<&[&str]>,
	remote: Option<&str>,
	url: &str,
	updates: &[PrePushRef],
) -> Result<HookResult> {
	let hook = HookPaths::new(repo, other_paths, HOOK_PRE_PUSH)?;

	if !hook.found() {
		return Ok(HookResult::NoHookFound);
	}

	// If a remote is not named (None or empty), the URL is passed for both arguments
	let remote_name = match remote {
		Some(r) if !r.is_empty() => r,
		_ => url,
	};

	let stdin_data = PrePushRef::to_stdin(updates);

	hook.run_hook_os_str_with_stdin(
		[remote_name, url],
		Some(stdin_data.as_bytes()),
	)
}

pub enum PrepareCommitMsgSource {
	Message,
	Template,
	Merge,
	Squash,
	Commit(git2::Oid),
}

/// this hook is documented here <https://git-scm.com/docs/githooks#_prepare_commit_msg>
#[allow(clippy::needless_pass_by_value)]
pub fn hooks_prepare_commit_msg(
	repo: &Repository,
	other_paths: Option<&[&str]>,
	source: PrepareCommitMsgSource,
	msg: &mut String,
) -> Result<HookResult> {
	let hook =
		HookPaths::new(repo, other_paths, HOOK_PREPARE_COMMIT_MSG)?;

	if !hook.found() {
		return Ok(HookResult::NoHookFound);
	}

	let temp_file = hook.git.join(HOOK_COMMIT_MSG_TEMP_FILE);
	File::create(&temp_file)?.write_all(msg.as_bytes())?;

	let temp_file_path = temp_file.as_os_str().to_string_lossy();

	let vec = vec![
		temp_file_path.as_ref(),
		match source {
			PrepareCommitMsgSource::Message => "message",
			PrepareCommitMsgSource::Template => "template",
			PrepareCommitMsgSource::Merge => "merge",
			PrepareCommitMsgSource::Squash => "squash",
			PrepareCommitMsgSource::Commit(_) => "commit",
		},
	];
	let mut args = vec;

	let id = if let PrepareCommitMsgSource::Commit(id) = &source {
		Some(id.to_string())
	} else {
		None
	};

	if let Some(id) = &id {
		args.push(id);
	}

	let res = hook.run_hook(args.as_slice())?;

	// load possibly altered msg
	msg.clear();
	File::open(temp_file)?.read_to_string(msg)?;

	Ok(res)
}

#[cfg(test)]
mod tests {
	use super::*;
	use git2_testing::{repo_init, repo_init_bare};
	use pretty_assertions::assert_eq;
	use tempfile::TempDir;

	fn branch_update(
		repo: &Repository,
		remote: Option<&str>,
		branch: &str,
		remote_branch: Option<&str>,
		delete: bool,
	) -> PrePushRef {
		let local_ref = format!("refs/heads/{branch}");
		let local_oid = (!delete).then(|| {
			repo.find_branch(branch, git2::BranchType::Local)
				.unwrap()
				.get()
				.peel_to_commit()
				.unwrap()
				.id()
		});

		let remote_branch = remote_branch.unwrap_or(branch);
		let remote_ref = format!("refs/heads/{remote_branch}");
		let remote_oid = remote.and_then(|remote_name| {
			repo.find_reference(&format!(
				"refs/remotes/{remote_name}/{remote_branch}"
			))
			.ok()
			.and_then(|r| r.peel_to_commit().ok())
			.map(|c| c.id())
		});

		PrePushRef::new(local_ref, local_oid, remote_ref, remote_oid)
	}

	fn head_branch(repo: &Repository) -> String {
		repo.head().unwrap().shorthand().unwrap().to_string()
	}

	#[test]
	fn test_pre_push_ref_format() {
		let zero_oid = "0".repeat(40);
		let oid_a = "a".repeat(40);
		let oid_b = "b".repeat(40);

		// Both oids present
		let update = PrePushRef::new(
			"refs/heads/main",
			Some(git2::Oid::from_str(&oid_a).unwrap()),
			"refs/heads/main",
			Some(git2::Oid::from_str(&oid_b).unwrap()),
		);
		assert_eq!(
			update.to_line(),
			format!(
				"refs/heads/main {oid_a} refs/heads/main {oid_b}"
			)
		);

		// No remote oid (new branch)
		let update = PrePushRef::new(
			"refs/heads/feature",
			Some(git2::Oid::from_str(&oid_a).unwrap()),
			"refs/heads/feature",
			None,
		);
		assert_eq!(
			update.to_line(),
			format!("refs/heads/featu
```

### Core Architecture Module: `src/components/utils/emoji.rs`
```
use once_cell::sync::Lazy;
use std::borrow::Cow;

static EMOJI_REPLACER: Lazy<gh_emoji::Replacer> =
	Lazy::new(gh_emoji::Replacer::new);

// Replace markdown emojis with Unicode equivalent
// :hammer: --> 🔨
#[inline]
pub fn emojifi_string(s: String) -> String {
	if let Cow::Owned(altered_s) = EMOJI_REPLACER.replace_all(&s) {
		altered_s
	} else {
		s
	}
}

```

### Core Architecture Module: `src/components/utils/filetree.rs`
```
//TODO: remove in favour of new `filetreelist` crate

use anyhow::{bail, Result};
use asyncgit::StatusItem;
use std::{
	collections::BTreeSet,
	ffi::OsStr,
	ops::{Index, IndexMut},
	path::Path,
};

/// holds the information shared among all `FileTreeItem` in a `FileTree`
#[derive(Debug, Clone)]
pub struct TreeItemInfo {
	/// indent level
	pub indent: u8,
	/// currently visible depending on the folder collapse states
	pub visible: bool,
	/// just the last path element
	pub path: String,
	/// the full path
	pub full_path: String,
}

impl TreeItemInfo {
	const fn new(
		indent: u8,
		path: String,
		full_path: String,
	) -> Self {
		Self {
			indent,
			visible: true,
			path,
			full_path,
		}
	}
}

/// attribute used to indicate the collapse/expand state of a path item
#[derive(PartialEq, Eq, Debug, Copy, Clone)]
pub struct PathCollapsed(pub bool);

/// `FileTreeItem` can be of two kinds
#[derive(PartialEq, Eq, Debug, Clone)]
pub enum FileTreeItemKind {
	Path(PathCollapsed),
	File(StatusItem),
}

/// `FileTreeItem` can be of two kinds: see `FileTreeItem` but shares an info
#[derive(Debug, Clone)]
pub struct FileTreeItem {
	pub info: TreeItemInfo,
	pub kind: FileTreeItemKind,
}

impl FileTreeItem {
	fn new_file(item: &StatusItem) -> Result<Self> {
		let item_path = Path::new(&item.path);
		let indent = u8::try_from(
			item_path.ancestors().count().saturating_sub(2),
		)?;

		let name = item_path
			.file_name()
			.map(OsStr::to_string_lossy)
			.map(|x| x.to_string());

		match name {
			Some(path) => Ok(Self {
				info: TreeItemInfo::new(
					indent,
					path,
					item.path.clone(),
				),
				kind: FileTreeItemKind::File(item.clone()),
			}),
			None => bail!("invalid file name {item:?}"),
		}
	}

	fn new_path(
		path: &Path,
		path_string: String,
		collapsed: bool,
	) -> Result<Self> {
		let indent =
			u8::try_from(path.ancestors().count().saturating_sub(2))?;

		match path
			.components()
			.next_back()
			.map(std::path::Component::as_os_str)
			.map(OsStr::to_string_lossy)
			.map(String::from)
		{
			Some(path) => Ok(Self {
				info: TreeItemInfo::new(indent, path, path_string),
				kind: FileTreeItemKind::Path(PathCollapsed(
					collapsed,
				)),
			}),
			None => bail!("failed to create item from path"),
		}
	}
}

impl Eq for FileTreeItem {}

impl PartialEq for FileTreeItem {
	fn eq(&self, other: &Self) -> bool {
		self.info.full_path.eq(&other.info.full_path)
	}
}

impl PartialOrd for FileTreeItem {
	fn partial_cmp(
		&self,
		other: &Self,
	) -> Option<std::cmp::Ordering> {
		Some(self.cmp(other))
	}
}

impl Ord for FileTreeItem {
	fn cmp(&self, other: &Self) -> std::cmp::Ordering {
		self.info.path.cmp(&other.info.path)
	}
}

///
#[derive(Default)]
pub struct FileTreeItems {
	items: Vec<FileTreeItem>,
	file_count: usize,
}

impl FileTreeItems {
	///
	pub(crate) fn new(
		list: &[StatusItem],
		collapsed: &BTreeSet<&String>,
	) -> Result<Self> {
		let mut items = Vec::with_capacity(list.len());
		let mut paths_added = BTreeSet::new();

		for e in list {
			{
				let item_path = Path::new(&e.path);

				Self::push_dirs(
					item_path,
					&mut items,
					&mut paths_added,
					collapsed,
				)?;
			}

			items.push(FileTreeItem::new_file(e)?);
		}

		Ok(Self {
			items,
			file_count: list.len(),
		})
	}

	///
	pub(crate) const fn items(&self) -> &Vec<FileTreeItem> {
		&self.items
	}

	///
	pub(crate) const fn len(&self) -> usize {
		self.items.len()
	}

	///
	pub const fn file_count(&self) -> usize {
		self.file_count
	}

	///
	pub(crate) fn find_parent_index(&self, index: usize) -> usize {
		let item_indent = &self.items[index].info.indent;
		let mut parent_index = index;
		while item_indent <= &self.items[parent_index].info.indent {
			if parent_index == 0 {
				return 0;
			}
			parent_index -= 1;
		}

		parent_index
	}

	fn push_dirs<'a>(
		item_path: &'a Path,
		nodes: &mut Vec<FileTreeItem>,
		paths_added: &mut BTreeSet<&'a Path>,
		collapsed: &BTreeSet<&String>,
	) -> Result<()> {
		let mut ancestors =
			{ item_path.ancestors().skip(1).collect::<Vec<_>>() };
		ancestors.reverse();

		for c in &ancestors {
			if c.parent().is_some() && !paths_added.contains(c) {
				paths_added.insert(c);
				//TODO: get rid of expect
				let path_string =
					String::from(c.to_str().expect("invalid path"));
				let is_collapsed = collapsed.contains(&path_string);
				nodes.push(FileTreeItem::new_path(
					c,
					path_string,
					is_collapsed,
				)?);
			}
		}

		Ok(())
	}

	pub fn multiple_items_at_path(&self, index: usize) -> bool {
		let tree_items = self.items();
		let mut idx_temp_inner;
		if index + 2 < tree_items.len() {
			idx_temp_inner = index + 1;
			while idx_temp_inner < tree_items.len().saturating_sub(1)
				&& tree_items[index].info.indent
					< tree_items[idx_temp_inner].info.indent
			{
				idx_temp_inner += 1;
			}
		} else {
			return false;
		}

		tree_items[idx_temp_inner].info.indent
			== tree_items[index].info.indent
	}
}

impl IndexMut<usize> for FileTreeItems {
	fn index_mut(&mut self, idx: usize) -> &mut Self::Output {
		&mut self.items[idx]
	}
}

impl Index<usize> for FileTreeItems {
	type Output = FileTreeItem;

	fn index(&self, idx: usize) -> &Self::Output {
		&self.items[idx]
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use asyncgit::StatusItemType;

	fn string_vec_to_status(items: &[&str]) -> Vec<StatusItem> {
		items
			.iter()
			.map(|a| StatusItem {
				path: String::from(*a),
				status: StatusItemType::Modified,
			})
			.collect::<Vec<_>>()
	}

	#[test]
	fn test_simple() {
		let items = string_vec_to_status(&[
			"file.txt", //
		]);

		let res =
			FileTreeItems::new(&items, &BTreeSet::new()).unwrap();

		assert_eq!(
			res.items,
			vec![FileTreeItem {
				info: TreeItemInfo {
					path: items[0].path.clone(),
					full_path: items[0].path.clone(),
					indent: 0,
					visible: true,
				},
				kind: FileTreeItemKind::File(items[0].clone())
			}]
		);

		let items = string_vec_to_status(&[
			"file.txt",  //
			"file2.txt", //
		]);

		let res =
			FileTreeItems::new(&items, &BTreeSet::new()).unwrap();

		assert_eq!(res.items.len(), 2);
		assert_eq!(res.items[1].info.path, items[1].path);
	}

	#[test]
	fn test_folder() {
		let items = string_vec_to_status(&[
			"a/file.txt", //
		]);

		let res = FileTreeItems::new(&items, &BTreeSet::new())
			.unwrap()
			.items
			.iter()
			.map(|i| i.info.full_path.clone())
			.collect::<Vec<_>>();

		assert_eq!(
			res,
			vec![String::from("a"), items[0].path.clone(),]
		);
	}

	#[test]
	fn test_indent() {
		let items = string_vec_to_status(&[
			"a/b/file.txt", //
		]);

		let list =
			FileTreeItems::new(&items, &BTreeSet::new()).unwrap();
		let mut res = list
			.items
			.iter()
			.map(|i| (i.info.indent, i.info.path.as_str()));

		assert_eq!(res.next(), Some((0, "a")));
		assert_eq!(res.next(), Some((1, "b")));
		assert_eq!(res.next(), Some((2, "file.txt")));
	}

	#[test]
	fn test_indent_folder_file_name() {
		let items = string_vec_to_status(&[
			"a/b",   //
			"a.txt", //
		]);

		let list =
			FileTreeItems::new(&items, &BTreeSet::new()).unwrap();
		let mut res = list
			.items
			.iter()
			.map(|i| (i.info.indent, i.info.path.as_str()));

		assert_eq!(res.next(), Some((0, "a")));
		assert_eq!(res.next(), Some((1, "b")));
		assert_eq!(res.next(), Some((0, "a.txt")));
	}

	#[test]
	fn test_folder_dup() {
		let items = string_vec_to_status(&[
			"a/file.txt",  //
			"a/file2.txt", //
		]);

		let res = FileTreeItems::new(&items, &BTreeSet::new())
			.unwrap()
			.items
			.iter()
			.map(|i| i.info.full_path.clone())
			.collect::<Vec<_>>();

		assert_eq!(
			res,
			vec![
				String::from("a"),
				items[0].path.clone(),
				items[1].path.clone()
			]
		);
	}

	#[test]
	fn test_multiple_items_at_path() {
		//0 a/
		//1   b/
		//2     c/
		//3       d
		//4     e/
		//5       f

		let res = FileTreeItems::new(
			&string_vec_to_status(&[
				"a/b/c/d", //
				"a/b/e/f", //
			]),
			&BTreeSet::new(),
		)
		.unwrap();

		assert!(!res.multiple_items_at_path(0));
		assert!(!res.multiple_items_at_path(1));
		assert!(res.multiple_items_at_path(2));
	}

	#[test]
	fn test_find_parent() {
		//0 a/
		//1   b/
		//2     c
		//3     d

		let res = FileTreeItems::new(
			&string_vec_to_status(&[
				"a/b/c", //
				"a/b/d", //
			]),
			&BTreeSet::new(),
		)
		.unwrap();

		assert_eq!(res.find_parent_index(3), 1);
	}
}

```

### Core Architecture Module: `src/components/utils/logitems.rs`
```
use asyncgit::sync::{CommitId, CommitInfo};
use chrono::{DateTime, Duration, Local, Utc};
use indexmap::IndexSet;
use std::{rc::Rc, slice::Iter};

#[cfg(feature = "ghemoji")]
use super::emoji::emojifi_string;

static SLICE_OFFSET_RELOAD_THRESHOLD: usize = 100;

type BoxStr = Box<str>;

pub struct LogEntry {
	//TODO: cache string representation
	pub time: DateTime<Local>,
	//TODO: use tinyvec here
	pub author: BoxStr,
	pub msg: BoxStr,
	//TODO: use tinyvec here
	pub hash_short: BoxStr,
	pub id: CommitId,
	pub highlighted: bool,
}

impl From<CommitInfo> for LogEntry {
	fn from(c: CommitInfo) -> Self {
		let hash_short = c.id.get_short_string().into();

		let time = {
			let date = DateTime::from_timestamp(c.time, 0)
				.map(|d| d.naive_utc());
			if date.is_none() {
				log::error!("error reading commit date: {hash_short} - timestamp: {}",c.time);
			}
			DateTime::<Local>::from(
				DateTime::<Utc>::from_naive_utc_and_offset(
					date.unwrap_or_default(),
					Utc,
				),
			)
		};

		let author = c.author;
		let msg = c.message;

		// Replace markdown emojis with Unicode equivalent
		#[cfg(feature = "ghemoji")]
		let msg = emojifi_string(msg);

		Self {
			author: author.into(),
			msg: msg.into(),
			time,
			hash_short,
			id: c.id,
			highlighted: false,
		}
	}
}

impl LogEntry {
	pub fn time_to_string(&self, now: DateTime<Local>) -> String {
		let delta = now - self.time;
		if delta < Duration::try_minutes(30).unwrap_or_default() {
			let delta_str = if delta
				< Duration::try_minutes(1).unwrap_or_default()
			{
				"<1m ago".to_string()
			} else {
				format!("{:0>2}m ago", delta.num_minutes())
			};
			format!("{delta_str: <10}")
		} else if self.time.date_naive() == now.date_naive() {
			self.time.format("%T  ").to_string()
		} else {
			self.time.format("%Y-%m-%d").to_string()
		}
	}
}

///
#[derive(Default)]
pub struct ItemBatch {
	index_offset: Option<usize>,
	items: Vec<LogEntry>,
	highlighting: bool,
}

impl ItemBatch {
	fn last_idx(&self) -> usize {
		self.index_offset() + self.items.len()
	}

	///
	pub fn index_offset(&self) -> usize {
		self.index_offset.unwrap_or_default()
	}

	///
	pub const fn index_offset_raw(&self) -> Option<usize> {
		self.index_offset
	}

	///
	pub const fn highlighting(&self) -> bool {
		self.highlighting
	}

	/// shortcut to get an `Iter` of our internal items
	pub fn iter(&self) -> Iter<'_, LogEntry> {
		self.items.iter()
	}

	/// clear current list of items
	pub fn clear(&mut self) {
		self.items.clear();
		self.index_offset = None;
	}

	/// insert new batch of items
	pub fn set_items(
		&mut self,
		start_index: usize,
		commits: Vec<CommitInfo>,
		highlighted: Option<&Rc<IndexSet<CommitId>>>,
	) {
		self.clear();

		if !commits.is_empty() {
			self.items.extend(commits.into_iter().map(|c| {
				let id = c.id;
				let mut entry = LogEntry::from(c);
				if highlighted.as_ref().is_some_and(|highlighted| {
					highlighted.contains(&id)
				}) {
					entry.highlighted = true;
				}
				entry
			}));

			self.index_offset = Some(start_index);
			self.highlighting = highlighted.is_some();
		}
	}

	/// returns `true` if we should fetch updated list of items
	pub fn needs_data(&self, idx: usize, idx_max: usize) -> bool {
		let want_min =
			idx.saturating_sub(SLICE_OFFSET_RELOAD_THRESHOLD);
		let want_max = idx
			.saturating_add(SLICE_OFFSET_RELOAD_THRESHOLD)
			.min(idx_max);

		let needs_data_top = want_min < self.index_offset();
		let needs_data_bottom = want_max >= self.last_idx();
		needs_data_bottom || needs_data_top
	}
}

impl<'a> IntoIterator for &'a ItemBatch {
	type IntoIter = std::slice::Iter<
		'a,
		crate::components::utils::logitems::LogEntry,
	>;
	type Item = &'a crate::components::utils::logitems::LogEntry;
	fn into_iter(self) -> Self::IntoIter {
		self.iter()
	}
}

#[cfg(test)]
#[cfg(feature = "ghemoji")]
mod tests {
	use super::*;

	fn test_conversion(s: &str) -> String {
		emojifi_string(s.into())
	}

	#[test]
	fn test_emojifi_string_conversion_cases() {
		assert_eq!(
			&test_conversion("It's :hammer: time!"),
			"It's 🔨 time!"
		);
		assert_eq!(
			&test_conversion(":red_circle::orange_circle::yellow_circle::green_circle::large_blue_circle::purple_circle:"),
			"🔴🟠🟡🟢🔵🟣"
		);
		assert_eq!(
			&test_conversion("It's raining :cat:s and :dog:s"),
			"It's raining 🐱s and 🐶s"
		);
		assert_eq!(&test_conversion(":crab: rules!"), "🦀 rules!");
	}

	#[test]
	fn test_emojifi_string_no_conversion_cases() {
		assert_eq!(&test_conversion("123"), "123");
		assert_eq!(
			&test_conversion("This :should_not_convert:"),
			"This :should_not_convert:"
		);
		assert_eq!(&test_conversion(":gopher:"), ":gopher:");
	}
}

```

### Core Architecture Module: `src/components/utils/mod.rs`
```
use chrono::{DateTime, Local, Utc};
use unicode_width::UnicodeWidthStr;

#[cfg(feature = "ghemoji")]
pub mod emoji;
pub mod filetree;
pub mod logitems;
pub mod scroll_horizontal;
pub mod scroll_vertical;
pub mod statustree;

/// macro to simplify running code that might return Err.
/// It will show a popup in that case
#[macro_export]
macro_rules! try_or_popup {
	($self:ident, $msg:expr, $e:expr) => {
		if let Err(err) = $e {
			::log::error!("{} {}", $msg, err);
			$self.queue.push(
				$crate::queue::InternalEvent::ShowErrorMsg(format!(
					"{}\n{}",
					$msg, err
				)),
			);
		}
	};
}

/// helper func to convert unix time since epoch to formatted time string in local timezone
pub fn time_to_string(secs: i64, short: bool) -> String {
	let time = DateTime::<Local>::from(
		DateTime::<Utc>::from_naive_utc_and_offset(
			DateTime::from_timestamp(secs, 0)
				.unwrap_or_default()
				.naive_utc(),
			Utc,
		),
	);

	time.format(if short {
		"%Y-%m-%d"
	} else {
		"%Y-%m-%d %H:%M:%S"
	})
	.to_string()
}

#[inline]
pub fn string_width_align(s: &str, width: usize) -> String {
	static POSTFIX: &str = "..";

	let len = UnicodeWidthStr::width(s);
	let width_wo_postfix = width.saturating_sub(POSTFIX.len());

	if (len >= width_wo_postfix && len <= width)
		|| (len <= width_wo_postfix)
	{
		format!("{s:width$}")
	} else {
		let mut s = s.to_string();
		s.truncate(find_truncate_point(&s, width_wo_postfix));
		format!("{s}{POSTFIX}")
	}
}

#[inline]
fn find_truncate_point(s: &str, chars: usize) -> usize {
	s.chars().take(chars).map(char::len_utf8).sum()
}

```

### Core Architecture Module: `src/components/utils/scroll_horizontal.rs`
```
use crate::{
	components::HorizontalScrollType,
	ui::{draw_scrollbar, style::SharedTheme, Orientation},
};
use ratatui::{layout::Rect, Frame};
use std::cell::Cell;

pub struct HorizontalScroll {
	right: Cell<usize>,
	max_right: Cell<usize>,
}

impl HorizontalScroll {
	pub const fn new() -> Self {
		Self {
			right: Cell::new(0),
			max_right: Cell::new(0),
		}
	}

	pub const fn get_right(&self) -> usize {
		self.right.get()
	}

	pub fn reset(&self) {
		self.right.set(0);
	}

	pub fn move_right(
		&self,
		move_type: HorizontalScrollType,
	) -> bool {
		let old = self.right.get();
		let max = self.max_right.get();

		let new_scroll_right = match move_type {
			HorizontalScrollType::Left => old.saturating_sub(1),
			HorizontalScrollType::Right => old.saturating_add(1),
		};

		let new_scroll_right = new_scroll_right.clamp(0, max);

		if new_scroll_right == old {
			return false;
		}

		self.right.set(new_scroll_right);

		true
	}

	pub fn update(
		&self,
		selection: usize,
		max_selection: usize,
		visual_width: usize,
	) -> usize {
		let new_right = calc_scroll_right(
			self.get_right(),
			visual_width,
			selection,
			max_selection,
		);
		self.right.set(new_right);

		if visual_width == 0 {
			self.max_right.set(0);
		} else {
			let new_max_right =
				max_selection.saturating_sub(visual_width);
			self.max_right.set(new_max_right);
		}

		new_right
	}

	pub fn update_no_selection(
		&self,
		column_count: usize,
		visual_width: usize,
	) -> usize {
		self.update(self.get_right(), column_count, visual_width)
	}

	pub fn draw(&self, f: &mut Frame, r: Rect, theme: &SharedTheme) {
		draw_scrollbar(
			f,
			r,
			theme,
			self.max_right.get(),
			self.right.get(),
			Orientation::Horizontal,
		);
	}
}

const fn calc_scroll_right(
	current_right: usize,
	width_in_lines: usize,
	selection: usize,
	selection_max: usize,
) -> usize {
	if width_in_lines == 0 {
		return 0;
	}
	if selection_max <= width_in_lines {
		return 0;
	}

	if current_right + width_in_lines <= selection {
		selection.saturating_sub(width_in_lines) + 1
	} else if current_right > selection {
		selection
	} else {
		current_right
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use pretty_assertions::assert_eq;

	#[test]
	fn test_scroll_no_scroll_to_right() {
		assert_eq!(calc_scroll_right(1, 10, 4, 4), 0);
	}

	#[test]
	fn test_scroll_zero_width() {
		assert_eq!(calc_scroll_right(4, 0, 4, 3), 0);
	}
}

```

### Core Architecture Module: `src/components/utils/scroll_vertical.rs`
```
use crate::{
	components::ScrollType,
	ui::{draw_scrollbar, style::SharedTheme, Orientation},
};
use ratatui::{layout::Rect, Frame};
use std::cell::Cell;

pub struct VerticalScroll {
	top: Cell<usize>,
	max_top: Cell<usize>,
	visual_height: Cell<usize>,
}

impl VerticalScroll {
	pub const fn new() -> Self {
		Self {
			top: Cell::new(0),
			max_top: Cell::new(0),
			visual_height: Cell::new(0),
		}
	}

	pub const fn get_top(&self) -> usize {
		self.top.get()
	}

	pub fn reset(&self) {
		self.top.set(0);
	}

	pub fn move_top(&self, move_type: ScrollType) -> bool {
		let old = self.top.get();
		let max = self.max_top.get();

		let new_scroll_top = match move_type {
			ScrollType::Down => old.saturating_add(1),
			ScrollType::Up => old.saturating_sub(1),
			ScrollType::PageDown => old
				.saturating_sub(1)
				.saturating_add(self.visual_height.get()),
			ScrollType::PageUp => old
				.saturating_add(1)
				.saturating_sub(self.visual_height.get()),
			ScrollType::Home => 0,
			ScrollType::End => max,
		};

		let new_scroll_top = new_scroll_top.clamp(0, max);

		if new_scroll_top == old {
			return false;
		}

		self.top.set(new_scroll_top);

		true
	}

	pub fn move_area_to_visible(
		&self,
		height: usize,
		start: usize,
		end: usize,
	) {
		let top = self.top.get();
		let bottom = top + height;
		let max_top = self.max_top.get();
		// the top of some content is hidden
		if start < top {
			self.top.set(start);
			return;
		}
		// the bottom of some content is hidden and there is visible space available
		if end > bottom && start > top {
			let avail_space = start.saturating_sub(top);
			let diff = std::cmp::min(
				avail_space,
				end.saturating_sub(bottom),
			);
			let top = top.saturating_add(diff);
			self.top.set(std::cmp::min(max_top, top));
		}
	}

	pub fn update(
		&self,
		selection: usize,
		selection_max: usize,
		visual_height: usize,
	) -> usize {
		self.visual_height.set(visual_height);

		let new_top = calc_scroll_top(
			self.get_top(),
			visual_height,
			selection,
			selection_max,
		);
		self.top.set(new_top);

		if visual_height == 0 {
			self.max_top.set(0);
		} else {
			let new_max = selection_max.saturating_sub(visual_height);
			self.max_top.set(new_max);
		}

		new_top
	}

	pub fn update_no_selection(
		&self,
		line_count: usize,
		visual_height: usize,
	) -> usize {
		self.update(self.get_top(), line_count, visual_height)
	}

	pub fn draw(&self, f: &mut Frame, r: Rect, theme: &SharedTheme) {
		draw_scrollbar(
			f,
			r,
			theme,
			self.max_top.get(),
			self.top.get(),
			Orientation::Vertical,
		);
	}
}

const fn calc_scroll_top(
	current_top: usize,
	height_in_lines: usize,
	selection: usize,
	selection_max: usize,
) -> usize {
	if height_in_lines == 0 {
		return 0;
	}
	if selection_max <= height_in_lines {
		return 0;
	}

	if current_top + height_in_lines <= selection {
		selection.saturating_sub(height_in_lines) + 1
	} else if current_top > selection {
		selection
	} else {
		current_top
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use pretty_assertions::assert_eq;

	#[test]
	fn test_scroll_no_scroll_to_top() {
		assert_eq!(calc_scroll_top(1, 10, 4, 4), 0);
	}

	#[test]
	fn test_scroll_zero_height() {
		assert_eq!(calc_scroll_top(4, 0, 4, 3), 0);
	}

	#[test]
	fn test_scroll_bottom_into_view() {
		let visual_height = 10;
		let line_count = 20;
		let scroll = VerticalScroll::new();
		scroll.max_top.set(line_count - visual_height);

		// intersecting with the bottom of the visible area
		scroll.move_area_to_visible(visual_height, 9, 11);
		assert_eq!(scroll.get_top(), 1);

		// completely below the visible area
		scroll.move_area_to_visible(visual_height, 15, 17);
		assert_eq!(scroll.get_top(), 7);

		// scrolling to the bottom overflow
		scroll.move_area_to_visible(visual_height, 30, 40);
		assert_eq!(scroll.get_top(), 10);
	}

	#[test]
	fn test_scroll_top_into_view() {
		let visual_height = 10;
		let line_count = 20;
		let scroll = VerticalScroll::new();
		scroll.max_top.set(line_count - visual_height);
		scroll.top.set(4);

		// intersecting with the top of the visible area
		scroll.move_area_to_visible(visual_height, 2, 8);
		assert_eq!(scroll.get_top(), 2);

		// completely above the visible area
		scroll.move_area_to_visible(visual_height, 0, 2);
		assert_eq!(scroll.get_top(), 0);
	}

	#[test]
	fn test_scroll_with_pageup_pagedown() {
		let scroll = VerticalScroll::new();
		scroll.max_top.set(10);
		scroll.visual_height.set(8);

		assert!(scroll.move_top(ScrollType::End));
		assert_eq!(scroll.get_top(), 10);

		assert!(!scroll.move_top(ScrollType::PageDown));
		assert_eq!(scroll.get_top(), 10);

		assert!(scroll.move_top(ScrollType::PageUp));
		assert_eq!(scroll.get_top(), 3);

		assert!(scroll.move_top(ScrollType::PageUp));
		assert_eq!(scroll.get_top(), 0);

		assert!(!scroll.move_top(ScrollType::PageUp));
		assert_eq!(scroll.get_top(), 0);
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3008** (2026-07-31): **pushing ssh remotes stopped working**
  *Symptoms*: Using gitui with SSH remotes (`git@github.com:...` or `ssh://git@...`) pushing throws `git error:unsupported URL protocol; class=Net (12)`  Steps to reproduce the behavior: 1. Install gitui 0.28.1-nightly 2026-07-30 ( 2. Push a repo with `origin  ssh://git@github.com/ [...]` 3. See error  **Expected behavior** Push and be happy.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Context:**  - OS/Distro + Version: MacOSX 26.5.1  - GitUI Version 0.28.1-nightly 2026-07-30  - Rust version: 1.95.0

- **Issue #2960** (2026-06-24): **Can't build with git2 > 0.20**
  *Symptoms*: **Describe the bug** I tried to build gitui and got a lot of compile errors.  **To Reproduce** Steps to reproduce the behavior: 1. Clone repository on master branch 2. type `cargo build --release` or/and `cargo install --path .` 3. Compilation stops due to a lot of errors  **Expected behavior** Gitui will be build and is ready to be installed  **Context (please complete the following information):**  - OS/Distro + Version: Ubuntu 22.04 LTS  - GitUI Version: master branch + x509 feature request (but this does not change anything to the observed behavior)  - Rust version: 1.95.0  **Additional context** git2 with 0.21.0 seems to have restructured a lot of code. Thus, compilation fails. For now it worked to set the used versions of git2 to `git2 = "<=0.20"`.   [build.log](https://github.com/user-attachments/files/28339526/build.log) 
  **Post-Mortem & Fix Analysis**:
  > Did you try `cargo build --release --locked`? If I remember correctly, Cargo eagerly resolves dependencies to newer versions than specified in the lockfile on install by default, and `--locked` would prevent it from doing that.
  > Yeah we specifically CI test this: https://github.com/gitui-org/gitui/actions/runs/27927170450/job/82631728704#step:13:1
  > Hey, I pulled the current state of the `master` branch and it is fixed now. Event without `--locked` it worked for me.  Thank you

- **Issue #2953** (2026-07-01): **Index out of bounds**
  *Symptoms*: **Describe the bug** Index out of bounds  **To Reproduce** Steps to reproduce the behavior: 1. stage changes  2. open Diff 3. Press s (Unstage lines) i press on almost at the end of the buffer 4. error  **Error** GitUI was closed due to an unexpected panic. Please file an issue on https://github.com/gitui-org/gitui/issues with the following info:  panicked at asyncgit/src/sync/staging/mod.rs:42:25: index out of bounds: the len is 151 but the index is 151  trace:    0: backtrace::capture::Backtrace::new    1: gitui::set_panic_handler::{{closure}}    2: std::panicking::panic_with_hook    3: std::panicking::panic_handler::{{closure}}    4: std::sys::backtrace::__rust_end_short_backtrace    5: __rustc::rust_begin_unwind    6: core::panicking::panic_fmt    7: core::panicking::panic_bounds_check    8: asyncgit::sync::staging::NewFromOldContent::add_old_line    9: asyncgit::sync::staging::apply_selection   10: <gitui::components::diff::DiffComponent as gitui::components::Component>::event   11: gitui::components::event_pump   12: <gitui::tabs::status::Status as gitui::components::Component>::event   13: gitui::components::event_pump   14: gitui::run_app   15: gitui::main   16: std::sys::backtrace::__rust_begin_short_backtrace   17: _main  **Context (please complete the following information):**  - macos 26.4.1  - gitui 0.28.1-nightly 2026-03-24 ()  - rustc 1.93.1 

- **Issue #2895** (2026-03-31): **Unexpected panic while going into submodule**
  *Symptoms*: **Describe the bug** Crash/panic when entering a submodule  **To Reproduce** I don't know, I home the stacktrace is enough to help you pinpoint better. I suspect it has to do with having a big repo with 10 submodules and keeping `gitui` alive over the night during an hibernation and resuming work from there.  **Expected behavior** Go into the submodule, like in 0.27.  **Screenshots** ``` GitUI was closed due to an unexpected panic. Please file an issue on https://github.com/gitui-org/gitui/issues with the following info:  panicked at ~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/asyncgit-0.28.1/src/status.rs:143:18: error sending status: "SendError(..)"  trace:    0: gitui::set_panic_handler::{{closure}}    1: std::panicking::panic_with_hook    2: std::panicking::panic_handler::{{closure}}    3: std::sys::backtrace::__rust_end_short_backtrace    4: __rustc::rust_begin_unwind    5: core::panicking::panic_fmt    6: core::result::unwrap_failed    7: core::result::Result<T,E>::expect    8: <rayon_core::job::HeapJob<BODY> as rayon_core::job::Job>::execute    9: rayon_core::registry::WorkerThread::wait_until_cold   10: std::sys::backtrace::__rust_begin_short_backtrace   11: core::ops::function::FnOnce::call_once{{vtable.shim}}   12: std::sys::thread::unix::Thread::new::thread_start   13: start_thread              at ./nptl/pthread_create.c:442:8   14: clone3              at ./misc/../sysdeps/unix/sysv/linux/x86_64/clone3.S:81:0  Rayon: detected unexpected panic; aborting ^
  **Post-Mortem & Fix Analysis**:
  > 1. Is the repo public in which this happens? 2. Does this reproduce every time you go into that submodule?
  > Pressing Enter in the submodule popup queues `OpenRepo` at [submodules.rs](/Users/stephan/code/gitui/src/popups/submodules.rs#L178). That becomes `QuitState::OpenSubmodule` in [app.rs](/Users/stephan/code/gitui/src/app.rs#L916), and the current `run_app()` instance exits. The per-session git notification channel is created inside `run_app()` at [main.rs](/Users/stephan/code/gitui/src/main.rs#L238), so when that function returns at [main.rs](/Users/stephan/code/gitui/src/main.rs#L332), the old receiver is dropped. The outer loop then immediately starts a new app session for the submodule at [main.rs](/Users/stephan/code/gitui/src/main.rs#L200).  At the same time, the visible status tab continuously kicks off background status refreshes at [status.rs](/Users/stephan/code/gitui/src/tabs/status.rs#L384). `AsyncStatus::fetch()` spawns a detached Rayon task at [asyncgit/status.rs](/Users/stephan/code/gitui/asyncgit/src/status.rs#L84), and when that task finishes it does `send(...).expect("er
  > Should be fixed on `master` - triggered a new nightly release that contains the fix

- **Issue #2874** (2026-03-15): **`exit_popup` in Diff mode quits gitui**
  *Symptoms*: **Describe the bug** This occurs if the `exit_popup` keymap and the `quit` keymap are made identical. I set these keymaps to `q`. It works when I close other popups only such as `find files`, `blames` etc.. But In diff mode, It closes gitui process.  If two keymaps are different, `exit_popup` doesn't quit gitui even though I executes `exit_popup` in diff mode.   **To Reproduce** Steps to reproduce the behavior: 1. Set keymap for `exit_popup` and `quit` to `q` 2. open gitui 3. Enter diff mode from status view using `L` 4. Push `q` 5. It will make gitui close  **Expected behavior** If diff mode is considered as popup, `exit_popup` quit diff mode only without quiting `gitui`  even though their keymaps are same.   **Screenshots** If applicable, add screenshots to help explain your problem.  **Context (please complete the following information):**  - Windows 10 Pro 22H2 19045.6466  - gitui 0.28.0 5527160  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > I realized that I must not use `q` in popup

- **Issue #2869** (2026-03-19): **GitUI panics in RemoteList with no remotes configured ("git: inconclusive remotes")**
  *Symptoms*: **Describe the bug** GitUI exits with an error in a newly initialized repo when triggering pull-related action with ambiguous/incomplete remote setup.  Observed error: `Error: git: inconclusive remotes`  **To Reproduce** Steps to reproduce the behavior: 1. Create a clean repo:    mkdir -p /i4/gitui_crash1    cd /i4/gitui_crash1    git init 2. Start GitUI:    gitui 3. Press keys:    2    p 4. See error and exit/backtrace. panicked at /i4/gitui/cargo-home/registry/src/index.crates.io-1949cf8c6b5b557f/gitui-0.28.0/src/popups/remotelist.rs:460:30: index out of bounds: the len is 0 but the index is 0  trace:    0: gitui::set_panic_handler::{{closure}}    1: std::panicking::panic_with_hook    2: std::panicking::panic_handler::{{closure}}    3: std::sys::backtrace::__rust_end_short_backtrace    4: __rustc::rust_begin_unwind    5: core::panicking::panic_fmt    6: core::panicking::panic_bounds_check    7: <alloc::vec::Vec<T,A> as core::ops::index::Index<I>>::index    8: <gitui::popups::remotelist::RemoteListPopup as gitui::components::Component>::event    9: gitui::components::event_pump   10: gitui::run_app   11: gitui::main   12: std::sys::backtrace::__rust_begin_short_backtrace   13: main   14: __libc_start_call_main              at ./csu/../sysdeps/nptl/libc_start_call_main.h:58:16   15: __libc_start_main_impl              at ./csu/../csu/libc-start.c:360:3   16: _start

- **Issue #2868** (2026-03-19): **GitUI crash in empty repo with no remotes**
  *Symptoms*: **Describe the bug** GitUI crashes when opening remote-related UI in an empty repo with no remotes configured. It panics with an index out-of-bounds error  **To Reproduce** Steps to reproduce the behavior: 1. Create a clean repo:    mkdir -p /i4/gitui_crash0    cd /i4/gitui_crash0    git init 2. Start GitUI:    gitui 3. Press keys:    b    <C-r>    u 4. See panic/error. `panicked at /i4/gitui/cargo-home/registry/src/index.crates.io-1949cf8c6b5b557f/gitui-0.28.0/src/popups/remotelist.rs:460:30: index out of bounds: the len is 0 but the index is 0  trace:    0: gitui::set_panic_handler::{{closure}}    1: std::panicking::panic_with_hook    2: std::panicking::panic_handler::{{closure}}    3: std::sys::backtrace::__rust_end_short_backtrace    4: __rustc::rust_begin_unwind    5: core::panicking::panic_fmt    6: core::panicking::panic_bounds_check    7: <alloc::vec::Vec<T,A> as core::ops::index::Index<I>>::index    8: <gitui::popups::remotelist::RemoteListPopup as gitui::components::Component>::event    9: gitui::components::event_pump   10: gitui::run_app   11: gitui::main   12: std::sys::backtrace::__rust_begin_short_backtrace   13: main   14: __libc_start_call_main              at ./csu/../sysdeps/nptl/libc_start_call_main.h:58:16   15: __libc_start_main_impl              at ./csu/../csu/libc-start.c:360:3   16: _start`  **Expected behavior** GitUI should not panic when no remotes exist. It should show an empty/disabled state or a user-facing validation message.   **Context (plea

- **Issue #2841** (2026-01-13): **Gitui is broken after Arch python update**
  *Symptoms*: **Describe the bug** There was a Pyhon upgrade today on Arch based distros. After that, the githui does not starts anymore.  **To Reproduce** Steps to reproduce the behavior: 1. Upgrade Arch btw 2. start gitui 3. See error message  **Expected behavior** Just works.  **Context (please complete the following information):**  - OS/Distro + Version: Arch linux, rolling release  - GitUI Version 0.28.0-1  - Rust version: 1:1.92.0-1  **Additional context**  Logs after launch it in terminal:  ```sh $ gitui Error: invalid repo path: could not find repository at '.'; class=Repository (6); code=NotFound (-3) ```
  **Post-Mortem & Fix Analysis**:
  > Hmm...  `gitui` does not have any python dependencies at runtime.  `gitui` throws the error in the OP if it's run from a directory without any git repo (in ancestors or current dir). Just to double check, did you try running `git status` in the same directory and was that successful?  Thank you for reporting the bug 👍 
  > Omg... you're right. My fault. Thank you for the help!  Edit: Only 1 suggestion: may the error message can be a little bit more precise and user friendly. :))

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

### Incident Patch 1: `4fdda8ef` (2026-10-05)
**Commit Message**: fix ci

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -344,7 +344,7 @@ jobs:
     runs-on: macos-latest
     steps:
       - name: Set up Homebrew
-        uses: Homebrew/actions/setup-homebrew@master
+        uses: Homebrew/actions/setup-homebrew@main
 
       - name: Install stable Rust
         uses: actions-rs/toolchain@v1
```

**File**: `asyncgit/src/sync/config.rs` (modified, +5/-8)
```diff
@@ -2,6 +2,7 @@ use crate::error::Result;
 use git2::Repository;
 use scopetime::scope_time;
 use serde::{Deserialize, Serialize};
+use std::str::FromStr;
 
 use super::{repository::repo, RepoPath};
 
@@ -73,11 +74,9 @@ pub enum PushDefaultStrategyConfig {
 	Matching,
 }
 
-impl<'a> TryFrom<&'a str> for PushDefaultStrategyConfig {
-	type Error = crate::Error;
-	fn try_from(
-		value: &'a str,
-	) -> std::result::Result<Self, Self::Error> {
+impl FromStr for PushDefaultStrategyConfig {
+	type Err = crate::Error;
+	fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
 		match value {
 			"nothing" => Ok(Self::Nothing),
 			"current" => Ok(Self::Current),
@@ -96,9 +95,7 @@ pub fn push_default_strategy_config_repo(
 ) -> Result<PushDefaultStrategyConfig> {
 	(get_config_string_repo(repo, "push.default")?).map_or_else(
 		|| Ok(PushDefaultStrategyConfig::default()),
-		|entry_str| {
-			PushDefaultStrategyConfig::try_from(entry_str.as_str())
-		},
+		|entry_str| entry_str.parse(),
 	)
 }
 
```

**File**: `src/queue.rs` (modified, +3/-3)
```diff
@@ -21,11 +21,11 @@ use std::{
 bitflags! {
 	/// flags defining what part of the app need to update
 	pub struct NeedsUpdate: u32 {
-		/// app::update
+		/// `app::update`
 		const ALL = 0b001;
-		/// diff may have changed (app::update_diff)
+		/// diff may have changed (`app::update_diff`)
 		const DIFF = 0b010;
-		/// commands might need updating (app::update_commands)
+		/// commands might need updating (`app::update_commands`)
 		const COMMANDS = 0b100;
 		/// branches have changed
 		const BRANCHES = 0b1000;
```

---

### Incident Patch 2: `d78d2647` (2026-07-31)
**Commit Message**: fix: Update git2 dependency to include 'ssh' feature (#3009)

Added 'ssh' feature to git2 dependency in Cargo.toml

**File**: `asyncgit/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ crossbeam-channel = "0.5"
 dirs = "6.0"
 easy-cast = "0.5"
 fuzzy-matcher = "0.3"
-git2 = { version = "0.21", features = ["https"] }
+git2 = { version = "0.21", features = ["https", "ssh"] }
 git2-hooks = { path = "../git2-hooks", version = "0.7" }
 gix = { version = "0.84.0", default-features = false, features = ["mailmap", "max-performance", "revision", "sha1", "sha256", "status"] }
 log = "0.4"
```

---

### Incident Patch 3: `685cca91` (2026-07-09)
**Commit Message**: run tests on linux arm ci pipeline (#2993)

* run tests on linux arm ci pipeline

* exclude a test

**File**: `.github/workflows/ci.yml` (modified, +18/-0)
```diff
@@ -180,6 +180,14 @@ jobs:
       - name: Override rust toolchain
         run: rustup override set ${{ matrix.rust }}
 
+      - uses: taiki-e/install-action@nextest
+
+      # qemu runs the cross-compiled aarch64 test binaries; the aarch64 cross
+      # runtime provides the sysroot qemu loads guest libs from; gpgsm is needed
+      # by the x509 signing e2e test (ssh-keygen/gpg/openssl are preinstalled).
+      - name: Install emulation and signing tools
+        run: sudo apt-get update && sudo apt-get install -y qemu-user-static libc6-arm64-cross libgcc-s1-arm64-cross gpgsm
+
       - name: Setup ARM toolchain
         run: |
           rustup target add aarch64-unknown-linux-gnu
@@ -201,6 +209,16 @@ jobs:
       - name: Build Debug
         run: |
           make build-linux-arm-debug
+
+      # Run the suite for aarch64 under emulation. qemu emulates the aarch64
+      # test binary (loading its libs from the cross sysroot via -L) while
+      # passing native x86 child processes (git, gpg, ssh-keygen, ...) straight
+      # through to the host, so the signing e2e tests exercise the real tools.
+      - name: Run tests (aarch64, emulated)
+        env:
+          CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_RUNNER: qemu-aarch64-static -L /usr/aarch64-linux-gnu
+        run: make test-linux-arm
+
       - name: Build Release
         run: |
           make build-linux-arm-release
```

**File**: `Makefile` (modified, +8/-0)
```diff
@@ -61,6 +61,14 @@ build-linux-musl-release:
 test-linux-musl:
 	cargo nextest run --workspace --target=x86_64-unknown-linux-musl
 
+# aarch64 test binaries are cross-compiled, so CI runs them under qemu via a
+# CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_RUNNER (see .github/workflows/ci.yml).
+# Exclude test_hook_with_missing_shebang: it needs the kernel's ENOEXEC (so
+# gitui retries the hook via `sh`), which qemu-user doesn't emulate — the exec
+# just exits 127. It passes on real aarch64 hardware.
+test-linux-arm:
+	cargo nextest run --workspace --target=aarch64-unknown-linux-gnu -E 'not test(test_hook_with_missing_shebang)'
+
 release-linux-arm: build-linux-arm-release
 	mkdir -p release
 
```

---

### Incident Patch 4: `cf74c156` (2026-07-05)
**Commit Message**: fix #2987

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -3235,9 +3235,9 @@ checksum = "953ec861398dccce10c670dfeaf3ec4911ca479e9c02154b3a215178c5f566f2"
 
 [[package]]
 name = "plist"
-version = "1.7.0"
+version = "1.10.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "42cf17e9a1800f5f396bc67d193dc9411b59012a5876445ef450d449881e1016"
+checksum = "7da1d65da6dd5d1e44199ac0f58712d241c0f439f80adea8924d832384087f85"
 dependencies = [
  "base64",
  "indexmap",
@@ -3348,9 +3348,9 @@ dependencies = [
 
 [[package]]
 name = "quick-xml"
-version = "0.32.0"
+version = "0.41.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1d3a6e5838b60e0e8fa7a43f22ade549a37d61f8bdbe636d0d7816191de969c2"
+checksum = "e660451e55124f798a69a5af3f49ccfbefbd41910eefd25caf2393e1f3473ec1"
 dependencies = [
  "memchr",
 ]
```

---

### Incident Patch 5: `8b7a74ea` (2026-07-01)
**Commit Message**: fix: avoid index-out-of-bounds panic in staging apply_selection (#2955)

Co-authored-by: extrawurst <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixes
 * crash when opening submodule ([#2895](https://github.com/gitui-org/gitui/issues/2895))
 * when staging the last file in a directory, the first item after the directory is no longer skipped [[@Tillerino](https://github.com/Tillerino)] ([#2748](https://github.com/gitui-org/gitui/issues/2748))
+* index-out-of-bounds panic when unstaging lines near the end of a diff ([#2953](https://github.com/gitui-org/gitui/issues/2953))
 
 ## [0.28.1] - 2026-03-21
 
```

**File**: `asyncgit/src/sync/staging/mod.rs` (modified, +39/-3)
```diff
@@ -39,16 +39,20 @@ impl NewFromOldContent {
 	}
 
 	fn add_old_line(&mut self, old_lines: &[&str]) {
-		self.lines.push(old_lines[self.old_index].to_string());
-		self.old_index += 1;
+		if let Some(line) = old_lines.get(self.old_index) {
+			self.lines.push((*line).to_string());
+			self.old_index += 1;
+		}
 	}
 
 	fn catchup_to_hunkstart(
 		&mut self,
 		hunk_start: usize,
 		old_lines: &[&str],
 	) {
-		while hunk_start > self.old_index + 1 {
+		while hunk_start > self.old_index + 1
+			&& self.old_index < old_lines.len()
+		{
 			self.add_old_line(old_lines);
 		}
 	}
@@ -182,3 +186,35 @@ pub fn load_file(
 
 	Ok(res)
 }
+
+#[cfg(test)]
+mod tests {
+	use super::NewFromOldContent;
+
+	// Regression for #2953: indexing old_lines past its length used to panic
+	// in add_old_line / catchup_to_hunkstart when a hunk_start pointed past
+	// the end of the working copy. The bounds-checked helpers must stop
+	// catching up at end-of-buffer instead of panicking.
+	#[test]
+	fn catchup_to_hunkstart_past_end_does_not_panic() {
+		let old_lines = ["a", "b", "c"];
+		let mut content = NewFromOldContent::default();
+
+		content.catchup_to_hunkstart(99, &old_lines);
+
+		assert_eq!(content.old_index, old_lines.len());
+		assert_eq!(content.lines, vec!["a", "b", "c"]);
+	}
+
+	#[test]
+	fn add_old_line_at_end_is_noop() {
+		let old_lines = ["only-line"];
+		let mut content = NewFromOldContent::default();
+		content.add_old_line(&old_lines);
+		assert_eq!(content.old_index, 1);
+
+		content.add_old_line(&old_lines);
+		assert_eq!(content.old_index, 1);
+		assert_eq!(content.lines, vec!["only-line"]);
+	}
+}
```

---

### Incident Patch 6: `c6b370f0` (2026-07-01)
**Commit Message**: fix(ci): collapse inline tables to single line for rust 1.88

The tombi 'fmt' left multi-line inline tables in Cargo.toml, which are
TOML 1.1 syntax that Cargo on our MSRV (rust 1.88) rejects with
'invalid inline table'. tombi.toml already caps line-width so tombi
keeps these single-line going forward.

**File**: `Cargo.toml` (modified, +2/-19)
```diff
@@ -48,14 +48,7 @@ notify = "8"
 notify-debouncer-mini = "0.7"
 once_cell = "1"
 parking_lot_core = "0.9"
-ratatui = {
-  version = "0.30",
-  default-features = false,
-  features = [
-    "crossterm",
-    "serde",
-  ]
-}
+ratatui = { version = "0.30", default-features = false, features = ["crossterm", "serde"] }
 ratatui-textarea = "0.8"
 rayon-core = "1.13"
 ron = "0.12"
@@ -65,17 +58,7 @@ serde = "1.0"
 shellexpand = "3.1"
 simplelog = { version = "0.12", default-features = false }
 struct-patch = "0.10"
-syntect = {
-  version = "5.3",
-  default-features = false,
-  features = [
-    "default-syntaxes",
-    "default-themes",
-    "html",
-    "parsing",
-    "plist-load",
-  ]
-}
+syntect = { version = "5.3", default-features = false, features = ["default-syntaxes", "default-themes", "html", "parsing", "plist-load"] }
 two-face = { version = "0.4.4", default-features = false }
 unicode-segmentation = "1.12"
 unicode-truncate = "2.0"
```

**File**: `asyncgit/Cargo.toml` (modified, +1/-10)
```diff
@@ -19,16 +19,7 @@ easy-cast = "0.5"
 fuzzy-matcher = "0.3"
 git2 = { version = "0.21", features = ["https"] }
 git2-hooks = { path = "../git2-hooks", version = "0.7" }
-gix = {
-  version = "0.78.0",
-  default-features = false,
-  features = [
-    "mailmap",
-    "max-performance",
-    "revision",
-    "status",
-  ]
-}
+gix = { version = "0.78.0", default-features = false, features = ["mailmap", "max-performance", "revision", "status"] }
 log = "0.4"
 # git2 = { path = "../../extern/git2-rs", features = ["vendored-openssl"]}
 # git2 = { git="https://github.com/extrawurst/git2-rs.git", rev="fc13dcc", features = ["vendored-openssl"]}
```

---

### Incident Patch 7: `8ed70068` (2026-07-01)
**Commit Message**: fix ci lint (#2985)

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -127,9 +127,9 @@ dependencies = [
 
 [[package]]
 name = "anyhow"
-version = "1.0.102"
+version = "1.0.103"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
+checksum = "2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3"
 
 [[package]]
 name = "arc-swap"
```

---

### Incident Patch 8: `b1db21e1` (2026-03-31)
**Commit Message**: fix panic when opening submodule (#2896)

this is caused by us dropping the git notify channel and creating a new one when opening the submodule.

closes #2895

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 * use [tombi](https://github.com/tombi-toml/tombi) for all toml file formatting
 
 ### Fixes
+* crash when opening submodule ([#2895](https://github.com/gitui-org/gitui/issues/2895))
 * when staging the last file in a directory, the first item after the directory is no longer skipped [[@Tillerino](https://github.com/Tillerino)] ([#2748](https://github.com/gitui-org/gitui/issues/2748))
 
 ## [0.28.1] - 2026-03-21
```

**File**: `asyncgit/src/status.rs` (modified, +4/-3)
```diff
@@ -138,9 +138,10 @@ impl AsyncStatus {
 			arc_generation.fetch_add(1, Ordering::Relaxed);
 			arc_pending.fetch_sub(1, Ordering::Relaxed);
 
-			sender
-				.send(AsyncGitNotification::Status)
-				.expect("error sending status");
+			if let Err(e) = sender.send(AsyncGitNotification::Status)
+			{
+				log::error!("send status error: {e}");
+			}
 		});
 
 		Ok(None)
```

---

### Incident Patch 9: `8b2de117` (2026-03-28)
**Commit Message**: migrate from tui-textarea to ratatui-textarea (#2889)

**File**: `Cargo.lock` (modified, +951/-180)
```diff
@@ -170,11 +170,20 @@ dependencies = [
  "serial_test",
  "ssh-key",
  "tempfile",
- "thiserror",
- "unicode-truncate 2.0.1",
+ "thiserror 2.0.18",
+ "unicode-truncate",
  "url",
 ]
 
+[[package]]
+name = "atomic"
+version = "0.6.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a89cbf775b137e9b968e67227ef7f775587cde3fd31b0d8599dbd0f598a48340"
+dependencies = [
+ "bytemuck",
+]
+
 [[package]]
 name = "autocfg"
 version = "1.4.0"
@@ -234,15 +243,30 @@ dependencies = [
  "serde",
 ]
 
+[[package]]
+name = "bit-set"
+version = "0.5.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "0700ddab506f33b20a03b13996eccd309a48e5ff77d0d95926aa0210fb4e95f1"
+dependencies = [
+ "bit-vec 0.6.3",
+]
+
 [[package]]
 name = "bit-set"
 version = "0.8.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "08807e080ed7f9d5433fa9b275196cfc35414f66a0c79d864dc51a0d825231a3"
 dependencies = [
- "bit-vec",
+ "bit-vec 0.8.0",
 ]
 
+[[package]]
+name = "bit-vec"
+version = "0.6.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "349f9b6a179ed607305526ca489b34ad0a41aed5f7980fa90eb03160b69598fb"
+
 [[package]]
 name = "bit-vec"
 version = "0.8.0"
@@ -329,6 +353,12 @@ dependencies = [
  "unicode-width 0.1.14",
 ]
 
+[[package]]
+name = "bytemuck"
+version = "1.25.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c8efb64bd706a16a1bdde310ae86b351e4d21550d98d056f22f8a7f7a2183fec"
+
 [[package]]
 name = "byteorder"
 version = "1.5.0"
@@ -341,12 +371,6 @@ version = "2.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "6bd91ee7b2422bcb158d90ef4d14f75ef67f340943fc4149891dcce8f8b972a3"
 
-[[package]]
-name = "cassowary"
-version = "0.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "df8670b8c7b9dae1793364eafadf7239c40d669904660c5960d74cfd80b46a53"
-
 [[package]]
 name = "castaway"
 version = "0.2.3"
@@ -378,9 +402,15 @@ dependencies = [
 
 [[package]]
 name = "cfg-if"
-version = "1.0.0"
+version = "1.0.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
+
+[[package]]
+name = "cfg_aliases"
+version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "baf1de4339761588bc0619e3cbc0120ee582ebb74b53b4efbf79117bd2da40fd"
+checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
 
 [[package]]
 name = "chacha20"
@@ -455,9 +485,9 @@ checksum = "5b63caa9aa9397e2d9480a9b13673856c78d8ac123288526c37d7839f2a86990"
 
 [[package]]
 name = "compact_str"
-version = "0.8.1"
+version = "0.9.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3b79c4069c6cad78e2e0cdfcbd26275770669fb39fd308a752dc110e83b9af32"
+checksum = "3fdb1325a1cece981e8a296ab8f0f9b63ae357bd0784a9faaf548cc7b480707a"
 dependencies = [
  "castaway",
  "cfg-if",
@@ -474,6 +504,15 @@ version = "0.9.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c2459377285ad874054d797f3ccebf984978aa39129f6eafde5cdc8315b612f8"
 
+[[package]]
+name = "convert_case"
+version = "0.10.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "633458d4ef8c78b72454de2d54fd6ab2e60f9e02be22f3c6104cdc8a4e0fceb9"
+dependencies = [
+ "unicode-segmentation",
+]
+
 [[package]]
 name = "core-foundation-sys"
 version = "0.8.7"
@@ -549,6 +588,25 @@ dependencies = [
  "winapi",
 ]
 
+[[package]]
+name = "crossterm"
+version = "0.29.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d8b9f2e4c67f833b660cdb0a3523065869fb35570177239812ed4c905aeff87b"
+dependencies = [
+ "bitflags 2.10.0",
+ "crossterm_winapi",
+ "derive_more",
+ "document-features",
+ "mio",
+ "parking_lot",
+ "rustix 1.1.3",
+ "serde",
+ "signal-hook",
+ "signal-hook-mio",
+ "winapi",
+]
+
 [[package]]
 name = "crossterm_winapi"
 version = "0.9.1"
@@ -580,6 +638,16 @@ dependencies = [
  "typenum",
 ]
 
+[[package]]
+name = "csscolorparser"
+version = "0.6.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "eb2a7d3066da2de787b7f032c736763eb7ae5d355f81a68bab2675a96008b0bf"
+dependencies = [
+ "lab",
+ "phf",
+]
+
 [[package]]
 name = "ctr"
 version = "0.9.2"
@@ -612,7 +680,7 @@ checksum = "f46882e17999c6cc590af592290432be3bce0428cb0d5f8b6715e4dc7b383eb3"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn",
+ "syn 2.0.117",
 ]
 
 [[package]]
@@ -636,7 +704,7 @@ dependencies = [
  "proc-macro2",
  "quote",
  "strsim",
- "syn",
+ "syn 2.0.117",
 ]
 
 [[package]]
@@ -647,7 +715,7 @@ checksum = "d336a2a514f6ccccaa3e09b02d41d35330c07ddf03a62165fcec10bb561c7806"
 dependencies = [
  "darling_core",
  "quote",
- "syn",
+ "syn 2.0.117",
 ]
 
 [[package]]
@@ -664,6 +732,12 @@ dependencies = [
  "parking_lot_core",
 ]
 
+[[package]]
+name = "deltae"
+version = "0.3.2"
+sou
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -35,7 +35,7 @@ bytesize = { version = "2.3", default-features = false }
 chrono = { version = "0.4", default-features = false, features = ["clock"] }
 clap = { version = "4.5", features = ["cargo", "env"] }
 crossbeam-channel = "0.5"
-crossterm = { version = "0.28", features = ["serde"] }
+crossterm = { version = "0.29", features = ["serde"] }
 dirs = "6.0"
 easy-cast = "0.5"
 filetreelist = { path = "./filetreelist", version = ">=0.6" }
@@ -48,10 +48,11 @@ notify = "8"
 notify-debouncer-mini = "0.7"
 once_cell = "1"
 parking_lot_core = "0.9"
-ratatui = { version = "0.29", default-features = false, features = [
+ratatui = { version = "0.30", default-features = false, features = [
   "crossterm",
   "serde",
 ] }
+ratatui-textarea = "0.8"
 rayon-core = "1.13"
 ron = "0.12"
 scopeguard = "1.2"
@@ -67,7 +68,6 @@ syntect = { version = "5.3", default-features = false, features = [
   "parsing",
   "plist-load",
 ] }
-tui-textarea = "0.7"
 two-face = { version = "0.4.4", default-features = false }
 unicode-segmentation = "1.12"
 unicode-truncate = "2.0"
```

**File**: `src/components/textinput.rs` (modified, +1/-1)
```diff
@@ -18,9 +18,9 @@ use ratatui::{
 	widgets::{Clear, Paragraph},
 	Frame,
 };
+use ratatui_textarea::{CursorMove, Input, Key, Scrolling, TextArea};
 use std::cell::Cell;
 use std::cell::OnceCell;
-use tui_textarea::{CursorMove, Input, Key, Scrolling, TextArea};
 
 ///
 #[derive(PartialEq, Eq)]
```

---

### Incident Patch 10: `a57cbf28` (2026-03-25)
**Commit Message**: fix changelog

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -7,6 +7,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## Unreleased
 
+### Fixes
+* when staging the last file in a directory, the first item after the directory is no longer skipped [[@Tillerino](https://github.com/Tillerino)] ([#2748](https://github.com/gitui-org/gitui/issues/2748))
+
 ## [0.28.1] - 2026-03-21
 
 ### Changed
@@ -61,7 +64,6 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 * disable blame and history popup keybinds for untracked files [[@kpbaks](https://github.com/kpbaks)] ([#2489](https://github.com/gitui-org/gitui/pull/2489))
 * overwrites committer on amend of unsigned commits [[@cruessler](https://github.com/cruessler)] ([#2784](https://github.com/gitui-org/gitui/issues/2784))
 * Updated project links to point to `gitui-org` instead of `extrawurst`  [[@vasleymus](https://github.com/vasleymus)] ([#2538](https://github.com/gitui-org/gitui/pull/2538))
-* when staging the last file in a directory, the first item after the directory is no longer skipped [[@Tillerino](https://github.com/Tillerino)] ([#2748](https://github.com/gitui-org/gitui/issues/2748))
 
 ## [0.27.0] - 2025-01-14
 
```

---

### Incident Patch 11: `3cf7a818` (2026-03-20)
**Commit Message**: feat: build.rs version message (#2839)

* feat: build.rs version message

* doc: changelog

---------

Co-authored-by: extrawurst <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -8,10 +8,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ## Unreleased
 
 ### Changed
+<<<<<<< feat/version-message
+* improve `gitui --version` message [[@hlsxx](https://github.com/hlsxx)] ([#2838](https://github.com/gitui-org/gitui/issues/2838))
+=======
 * rust msrv bumped to `1.88`
 
 ### Fixed
 * fix panic when renaming or updating remote URL with no remotes configured [[@xvchris](https://github.com/xvchris)] ([#2868](https://github.com/gitui-org/gitui/issues/2868))
+>>>>>>> master
 
 ## [0.28.0] - 2025-12-14
 
```

**File**: `build.rs` (modified, +3/-3)
```diff
@@ -34,14 +34,14 @@ fn main() {
 	let build_date = now.date_naive();
 
 	let build_name = if std::env::var("GITUI_RELEASE").is_ok() {
+		env!("CARGO_PKG_VERSION").to_string()
+	} else {
 		format!(
-			"{} {} ({})",
+			"{}-nightly {} ({})",
 			env!("CARGO_PKG_VERSION"),
 			build_date,
 			get_git_hash()
 		)
-	} else {
-		format!("nightly {} ({})", build_date, get_git_hash())
 	};
 
 	println!("cargo:warning=buildname '{build_name}'");
```

---

### Incident Patch 12: `06a3f660` (2026-03-19)
**Commit Message**: fix: guard rename/update_url actions against empty remote list (#2870)

* fix: guard rename/update_url actions against empty remote list

The rename_remote() and update_remote_url() event handlers in
RemoteListPopup did not check valid_selection() before indexing
into self.remote_names, causing a panic (index out of bounds)
when no remotes are configured.

The delete_remote() handler already had this guard. This commit
adds the same valid_selection() check to the other two handlers
for consistency.

Fixes #2868
Fixes #2869

* chore: add changelog entry and sort Cargo.toml dependencies

* revert: restore original Cargo.toml formatting

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -10,6 +10,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Changed
 * rust msrv bumped to `1.88`
 
+### Fixed
+* fix panic when renaming or updating remote URL with no remotes configured [[@xvchris](https://github.com/xvchris)] ([#2868](https://github.com/gitui-org/gitui/issues/2868))
+
 ## [0.28.0] - 2025-12-14
 
 **discard changes on checkout**
```

**File**: `src/popups/remotelist.rs` (modified, +4/-2)
```diff
@@ -146,12 +146,14 @@ impl Component for RemoteListPopup {
 			} else if key_match(
 				e,
 				self.key_config.keys.update_remote_name,
-			) {
+			) && self.valid_selection()
+			{
 				self.rename_remote();
 			} else if key_match(
 				e,
 				self.key_config.keys.update_remote_url,
-			) {
+			) && self.valid_selection()
+			{
 				self.update_remote_url();
 			}
 		}
```

---

### Incident Patch 13: `09d67266` (2026-03-19)
**Commit Message**: Fix typos (#2649)

Found via `typos --hidden --format brief`

**File**: `src/popups/submodules.rs` (modified, +2/-2)
```diff
@@ -317,8 +317,8 @@ impl SubmodulesListPopup {
 	}
 
 	fn set_selection(&mut self, selection: u16) -> Result<()> {
-		let num_entriess: u16 = self.submodules.len().try_into()?;
-		let num_entries = num_entriess.saturating_sub(1);
+		let num_entries: u16 = self.submodules.len().try_into()?;
+		let num_entries = num_entries.saturating_sub(1);
 
 		let selection = if selection > num_entries {
 			num_entries
```

---

### Incident Patch 14: `268d8ab1` (2026-03-19)
**Commit Message**: fix time CVE

**File**: `Cargo.lock` (modified, +11/-11)
```diff
@@ -676,9 +676,9 @@ dependencies = [
 
 [[package]]
 name = "deranged"
-version = "0.3.11"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b42b6fa04a440b495c8b04d0e71b707c585f83cb9cb28cf8cd0d976c315e31b4"
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 dependencies = [
  "powerfmt",
 ]
@@ -2597,9 +2597,9 @@ dependencies = [
 
 [[package]]
 name = "num-conv"
-version = "0.1.0"
+version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "51d515d32fb182ee37cda2ccdcb92950d6a3c2893aa280e540671c2cd0f3b1d9"
+checksum = "cf97ec579c3c42f953ef76dbf8d55ac91fb219dde70e49aa4a6b7d74e9919050"
 
 [[package]]
 name = "num-integer"
@@ -3691,30 +3691,30 @@ dependencies = [
 
 [[package]]
 name = "time"
-version = "0.3.37"
+version = "0.3.47"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "35e7868883861bd0e56d9ac6efcaaca0d6d5d82a2a7ec8209ff492c07cf37b21"
+checksum = "743bd48c283afc0388f9b8827b976905fb217ad9e647fae3a379a9283c4def2c"
 dependencies = [
  "deranged",
  "itoa",
  "num-conv",
  "powerfmt",
- "serde",
+ "serde_core",
  "time-core",
  "time-macros",
 ]
 
 [[package]]
 name = "time-core"
-version = "0.1.2"
+version = "0.1.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ef927ca75afb808a4d64dd374f00a2adf8d0fcff8e7b184af886c3c87ec4a3f3"
+checksum = "7694e1cfe791f8d31026952abf09c69ca6f6fa4e1a1229e18988f06a04a12dca"
 
 [[package]]
 name = "time-macros"
-version = "0.2.19"
+version = "0.2.27"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2834e6017e3e5e4b9834939793b282bc03b37a3336245fa820e35e233e2a85de"
+checksum = "2e70e4c5a0e0a8a4823ad65dfe1a6930e4f4d756dcd9dd7939022b5e8c501215"
 dependencies = [
  "num-conv",
  "time-core",
```

---

### Incident Patch 15: `28cd5e7b` (2026-03-19)
**Commit Message**: clippy fixes

**File**: `asyncgit/src/push.rs` (modified, +1/-1)
```diff
@@ -164,7 +164,7 @@ impl AsyncPush {
 		*last_res = match res {
 			Ok(()) => None,
 			Err(e) => {
-				log::error!("push error: {e}",);
+				log::error!("push error: {e}");
 				Some(e.to_string())
 			}
 		};
```

**File**: `asyncgit/src/sync/remotes/callbacks.rs` (modified, +2/-2)
```diff
@@ -107,7 +107,7 @@ impl Callbacks {
 		reference: &str,
 		msg: Option<&str>,
 	) {
-		log::debug!("push_update_reference: '{reference}' {msg:?}",);
+		log::debug!("push_update_reference: '{reference}' {msg:?}");
 
 		if let Ok(mut stats) = self.stats.lock() {
 			stats.push_rejected_msg = msg
@@ -162,7 +162,7 @@ impl Callbacks {
 		total: usize,
 		bytes: usize,
 	) {
-		log::debug!("progress: {current}/{total} ({bytes} B)",);
+		log::debug!("progress: {current}/{total} ({bytes} B)");
 		self.sender.clone().map(|sender| {
 			sender.send(ProgressNotification::PushTransfer {
 				current,
```

#### Recent Merged Pull Requests:
- **PR #3035** (2026-10-05): fix ci (@extrawurst)
- **PR #3034** (2026-10-05): Modified README (@realy8v)
- **PR #3032** (closed): ci: use Homebrew/actions@main, master was removed (Homebrew job red since 2026-09-14) (@glaziermag)
- **PR #3010** (closed): chore: update Cargo.lock for git2 ssh feature (@youssefadly237)
- **PR #3009** (2026-07-31): fix: Update git2 dependency to include 'ssh' feature (@gcgbarbosa)
- **PR #2993** (2026-07-09): run tests on linux arm ci pipeline (@extrawurst)
- **PR #2992** (2026-07-09): make x502 signing test less flaky on macos (@extrawurst)
- **PR #2986** (2026-07-02): add e2e test covering gpg (@extrawurst)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
