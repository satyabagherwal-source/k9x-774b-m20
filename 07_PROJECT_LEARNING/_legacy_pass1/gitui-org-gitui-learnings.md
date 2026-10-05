# Forensic Learning Record (Deep Inspection): gitui-org/gitui

> **Canonical Artifact**: `07_PROJECT_LEARNING/gitui-org-gitui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gitui-org/gitui](https://github.com/gitui-org/gitui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:04.016Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gitui-org/gitui`
- **Description**: Blazing 💥 fast terminal-ui for git written in rust 🦀
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 22537 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `asyncgit/src/asyncjob/mod.rs`
```
//! provides `AsyncJob` trait and `AsyncSingleJob` struct

#![deny(clippy::expect_used)]

use crate::error::Result;
use crossbeam_channel::Sender;
use std::sync::{Arc, Mutex, RwLock};

/// Passed to `AsyncJob::run` allowing sending intermediate progress notifications
pub struct RunParams<
	T: Copy + Send,
	P: Clone + Send + Sync + PartialEq,
> {
	sender: Sender<T>,
	progress: Arc<RwLock<P>>,
}

impl<T: Copy + Send, P: Clone + Send + Sync + PartialEq>
	RunParams<T, P>
{
	/// send an intermediate update notification.
	/// do not confuse this with the return value of `run`.
	/// `send` should only be used about progress notifications
	/// and not for the final notification indicating the end of the async job.
	/// see `run` for more info
	pub fn send(&self, notification: T) -> Result<()> {
		self.sender.send(notification)?;
		Ok(())
	}

	/// set the current progress
	pub fn set_progress(&self, p: P) -> Result<bool> {
		Ok(if *self.progress.read()? == p {
			false
		} else {
			*(self.progress.write()?) = p;
			true
		})
	}
}

/// trait that defines an async task we can run on a threadpool
pub trait AsyncJob: Send + Sync + Clone {
	/// defines what notification type is used to communicate outside
	type Notification: Copy + Send;
	/// type of progress
	type Progress: Clone + Default + Send + Sync + PartialEq;

	/// can run a synchronous time intensive task.
	/// the returned notification is used to tell interested parties
	/// that the job finished and the job can be access via `take_last`.
	/// prior to this final notification it is not safe to assume `take_last`
	/// will already return the correct job
	fn run(
		&mut self,
		params: RunParams<Self::Notification, Self::Progress>,
	) -> Result<Self::Notification>;

	/// allows observers to get intermediate progress status if the job customizes it
	/// by default this will be returning `Self::Progress::default()`
	fn get_progress(&self) -> Self::Progress {
		Self::Progress::default()
	}
}

/// Abstraction for a FIFO task queue that will only queue up **one** `next` job.
/// It keeps overwriting the next job until it is actually taken to be processed
#[derive(Debug, Clone)]
pub struct AsyncSingleJob<J: AsyncJob> {
	next: Arc<Mutex<Option<J>>>,
	last: Arc<Mutex<Option<J>>>,
	progress: Arc<RwLock<J::Progress>>,
	sender: Sender<J::Notification>,
	pending: Arc<Mutex<()>>,
}

impl<J: 'static + AsyncJob> AsyncSingleJob<J> {
	///
	pub fn new(sender: Sender<J::Notification>) -> Self {
		Self {
			next: Arc::new(Mutex::new(None)),
			last: Arc::new(Mutex::new(None)),
			pending: Arc::new(Mutex::new(())),
			progress: Arc::new(RwLock::new(J::Progress::default())),
			sender,
		}
	}

	///
	pub fn is_pending(&self) -> bool {
		self.pending.try_lock().is_err()
	}

	/// makes sure `next` is cleared and returns `true` if it actually canceled something
	pub fn cancel(&self) -> bool {
		if let Ok(mut next) = self.next.lock() {
			if next.is_some() {
				*next = None;
				return true;
			}
		}

		false
	}

	/// take out last finished job
	pub fn take_last(&self) -> Option<J> {
		self.last.lock().map_or(None, |mut last| last.take())
	}

	/// spawns `task` if nothing is running currently,
	/// otherwise schedules as `next` overwriting if `next` was set before.
	/// return `true` if the new task gets started right away.
	pub fn spawn(&self, task: J) -> bool {
		self.schedule_next(task);
		self.check_for_job()
	}

	///
	pub fn progress(&self) -> Option<J::Progress> {
		self.progress.read().ok().map(|d| (*d).clone())
	}

	fn check_for_job(&self) -> bool {
		if self.is_pending() {
			return false;
		}

		if let Some(task) = self.take_next() {
			let self_clone = (*self).clone();
			rayon_core::spawn(move || {
				if let Err(e) = self_clone.run_job(task) {
					log::error!("async job error: {e}");
				}
			});

			return true;
		}

		false
	}

	fn run_job(&self, mut task: J) -> Result<()> {
		//limit the pending scope
		{
			let _pending = self.pending.lock()?;

			let notification = task.run(RunParams {
				progress: self.progress.clone(),
				sender: self.sender.clone(),
			})?;

			if let Ok(mut last) = self.last.lock() {
				*last = Some(task);
			}

			self.sender.send(notification)?;
		}

		self.check_for_job();

		Ok(())
	}

	fn schedule_next(&self, task: J) {
		if let Ok(mut next) = self.next.lock() {
			*next = Some(task);
		}
	}

	fn take_next(&self) -> Option<J> {
		self.next.lock().map_or(None, |mut next| next.take())
	}
}

#[cfg(test)]
mod test {
	use super::*;
	use crossbeam_channel::unbounded;
	use pretty_assertions::assert_eq;
	use std::{
		sync::atomic::{AtomicBool, AtomicU32, Ordering},
		thread,
		time::Duration,
	};

	#[derive(Clone)]
	struct TestJob {
		v: Arc<AtomicU32>,
		finish: Arc<AtomicBool>,
		value_to_add: u32,
	}

	type TestNotification = ();

	impl AsyncJob for TestJob {
		type Notification = TestNotification;
		type Progress = ();

		fn run(
			&mut self,
			_params: RunParams<Self::Notification, Self::Progress>,
		) -> Result<Self::Notification> {
			println!("[job] wait");

			while !self.finish.load(Ordering::SeqCst) {
				std::thread::yield_now();
			}

			println!("[job] sleep");

			thread::sleep(Duration::from_millis(100));

			println!("[job] done sleeping");

			let res =
				self.v.fetch_add(self.value_to_add, Ordering::SeqCst);

			println!("[job] value: {res}");

			Ok(())
		}
	}

	#[test]
	fn test_overwrite() {
		let (sender, receiver) = unbounded();

		let job: AsyncSingleJob<TestJob> =
			AsyncSingleJob::new(sender);

		let task = TestJob {
			v: Arc::new(AtomicU32::new(1)),
			finish: Arc::new(AtomicBool::new(false)),
			value_to_add: 1,
		};

		assert!(job.spawn(task.clone()));
		task.finish.store(true, Ordering::SeqCst);
		thread::sleep(Duration::from_millis(10));

		for _ in 0..5 {
			println!("spawn");
			assert!(!job.spawn(task.clone()));
		}

		println!("recv");
		receiver.recv().unwrap();
		receiver.recv().unwrap();
		assert!(receiver.is_empty());

		assert_eq!(
			task.v.load(std::sync::atomic::Ordering::SeqCst),
			3
		);
	}

	fn wait_for_job(job: &AsyncSingleJob<TestJob>) {
		while job.is_pending() {
			thread::sleep(Duration::from_millis(10));
		}
	}

	#[test]
	fn test_cancel() {
		let (sender, receiver) = unbounded();

		let job: AsyncSingleJob<TestJob> =
			AsyncSingleJob::new(sender);

		let task = TestJob {
			v: Arc::new(AtomicU32::new(1)),
			finish: Arc::new(AtomicBool::new(false)),
			value_to_add: 1,
		};

		assert!(job.spawn(task.clone()));
		task.finish.store(true, Ordering::SeqCst);
		thread::sleep(Duration::from_millis(10));

		for _ in 0..5 {
			println!("spawn");
			assert!(!job.spawn(task.clone()));
		}

		println!("cancel");
		assert!(job.cancel());

		task.finish.store(true, Ordering::SeqCst);

		wait_for_job(&job);

		println!("recv");
		receiver.recv().unwrap();
		println!("received");

		assert_eq!(
			task.v.load(std::sync::atomic::Ordering::SeqCst),
			2
		);
	}
}

```

### Core Architecture Module: `asyncgit/src/blame.rs`
```
use crate::{
	error::Result,
	hash,
	sync::{self, CommitId, FileBlame, RepoPath},
	AsyncGitNotification,
};
use crossbeam_channel::Sender;
use std::{
	hash::Hash,
	sync::{
		atomic::{AtomicUsize, Ordering},
		Arc, Mutex,
	},
};

///
#[derive(Hash, Clone, PartialEq, Eq)]
pub struct BlameParams {
	/// path to the file to blame
	pub file_path: String,
	/// blame at a specific revision
	pub commit_id: Option<CommitId>,
}

struct Request<R, A>(R, Option<A>);

#[derive(Default, Clone)]
struct LastResult<P, R> {
	params: P,
	result: R,
}

///
pub struct AsyncBlame {
	current: Arc<Mutex<Request<u64, FileBlame>>>,
	last: Arc<Mutex<Option<LastResult<BlameParams, FileBlame>>>>,
	sender: Sender<AsyncGitNotification>,
	pending: Arc<AtomicUsize>,
	repo: RepoPath,
}

impl AsyncBlame {
	///
	pub fn new(
		repo: RepoPath,
		sender: &Sender<AsyncGitNotification>,
	) -> Self {
		Self {
			repo,
			current: Arc::new(Mutex::new(Request(0, None))),
			last: Arc::new(Mutex::new(None)),
			sender: sender.clone(),
			pending: Arc::new(AtomicUsize::new(0)),
		}
	}

	///
	pub fn last(&self) -> Result<Option<(BlameParams, FileBlame)>> {
		let last = self.last.lock()?;

		Ok(last.clone().map(|last_result| {
			(last_result.params, last_result.result)
		}))
	}

	///
	pub fn refresh(&self) -> Result<()> {
		if let Ok(Some(param)) = self.get_last_param() {
			self.clear_current()?;
			self.request(param)?;
		}
		Ok(())
	}

	///
	pub fn is_pending(&self) -> bool {
		self.pending.load(Ordering::Relaxed) > 0
	}

	///
	pub fn request(
		&self,
		params: BlameParams,
	) -> Result<Option<FileBlame>> {
		log::trace!("request");

		let hash = hash(&params);

		{
			let mut current = self.current.lock()?;

			if current.0 == hash {
				return Ok(current.1.clone());
			}

			current.0 = hash;
			current.1 = None;
		}

		let arc_current = Arc::clone(&self.current);
		let arc_last = Arc::clone(&self.last);
		let sender = self.sender.clone();
		let arc_pending = Arc::clone(&self.pending);
		let repo = self.repo.clone();

		self.pending.fetch_add(1, Ordering::Relaxed);

		rayon_core::spawn(move || {
			let notify = Self::get_blame_helper(
				&repo,
				params,
				&arc_last,
				&arc_current,
				hash,
			);

			let notify = match notify {
				Err(err) => {
					log::error!("get_blame_helper error: {err}");
					true
				}
				Ok(notify) => notify,
			};

			arc_pending.fetch_sub(1, Ordering::Relaxed);

			sender
				.send(if notify {
					AsyncGitNotification::Blame
				} else {
					AsyncGitNotification::FinishUnchanged
				})
				.expect("error sending blame");
		});

		Ok(None)
	}

	fn get_blame_helper(
		repo_path: &RepoPath,
		params: BlameParams,
		arc_last: &Arc<
			Mutex<Option<LastResult<BlameParams, FileBlame>>>,
		>,
		arc_current: &Arc<Mutex<Request<u64, FileBlame>>>,
		hash: u64,
	) -> Result<bool> {
		let file_blame = sync::blame::blame_file(
			repo_path,
			&params.file_path,
			params.commit_id,
		)?;

		let mut notify = false;
		{
			let mut current = arc_current.lock()?;
			if current.0 == hash {
				current.1 = Some(file_blame.clone());
				notify = true;
			}
		}

		{
			let mut last = arc_last.lock()?;
			*last = Some(LastResult {
				result: file_blame,
				params,
			});
		}

		Ok(notify)
	}

	fn get_last_param(&self) -> Result<Option<BlameParams>> {
		Ok(self
			.last
			.lock()?
			.clone()
			.map(|last_result| last_result.params))
	}

	fn clear_current(&self) -> Result<()> {
		let mut current = self.current.lock()?;
		current.0 = 0;
		current.1 = None;
		Ok(())
	}
}

```

### Core Architecture Module: `asyncgit/src/branches.rs`
```
use crate::{
	asyncjob::{AsyncJob, RunParams},
	error::Result,
	sync::{branch::get_branches_info, BranchInfo, RepoPath},
	AsyncGitNotification,
};
use std::sync::{Arc, Mutex};

enum JobState {
	Request {
		local_branches: bool,
		repo: RepoPath,
	},
	Response(Result<Vec<BranchInfo>>),
}

///
#[derive(Clone, Default)]
pub struct AsyncBranchesJob {
	state: Arc<Mutex<Option<JobState>>>,
}

///
impl AsyncBranchesJob {
	///
	pub fn new(repo: RepoPath, local_branches: bool) -> Self {
		Self {
			state: Arc::new(Mutex::new(Some(JobState::Request {
				repo,
				local_branches,
			}))),
		}
	}

	///
	pub fn result(&self) -> Option<Result<Vec<BranchInfo>>> {
		if let Ok(mut state) = self.state.lock() {
			if let Some(state) = state.take() {
				return match state {
					JobState::Request { .. } => None,
					JobState::Response(result) => Some(result),
				};
			}
		}

		None
	}
}

impl AsyncJob for AsyncBranchesJob {
	type Notification = AsyncGitNotification;
	type Progress = ();

	fn run(
		&mut self,
		_params: RunParams<Self::Notification, Self::Progress>,
	) -> Result<Self::Notification> {
		if let Ok(mut state) = self.state.lock() {
			*state = state.take().map(|state| match state {
				JobState::Request {
					local_branches,
					repo,
				} => {
					let branches =
						get_branches_info(&repo, local_branches);

					JobState::Response(branches)
				}
				JobState::Response(result) => {
					JobState::Response(result)
				}
			});
		}

		Ok(AsyncGitNotification::Branches)
	}
}

```

### Core Architecture Module: `asyncgit/src/cached/branchname.rs`
```
use crate::{
	error::Result,
	sync::{self, branch::get_branch_name, RepoPathRef},
};
use sync::Head;

///
pub struct BranchName {
	last_result: Option<(Head, String)>,
	repo: RepoPathRef,
}

impl BranchName {
	///
	pub const fn new(repo: RepoPathRef) -> Self {
		Self {
			repo,
			last_result: None,
		}
	}

	///
	pub fn lookup(&mut self) -> Result<String> {
		let current_head = sync::get_head_tuple(&self.repo.borrow())?;

		if let Some((last_head, branch_name)) =
			self.last_result.as_ref()
		{
			if *last_head == current_head {
				return Ok(branch_name.clone());
			}
		}

		self.fetch(current_head)
	}

	///
	pub fn last(&self) -> Option<String> {
		self.last_result.as_ref().map(|last| last.1.clone())
	}

	fn fetch(&mut self, head: Head) -> Result<String> {
		let name = get_branch_name(&self.repo.borrow())?;
		self.last_result = Some((head, name.clone()));
		Ok(name)
	}
}

```

### Core Architecture Module: `asyncgit/src/cached/mod.rs`
```
//! cached lookups:
//! parts of the sync api that might take longer
//! to compute but change seldom so doing them async might be overkill

mod branchname;

pub use branchname::BranchName;

```

### Core Architecture Module: `asyncgit/src/commit_files.rs`
```
use crate::{
	error::Result,
	sync::{self, commit_files::OldNew, CommitId, RepoPath},
	AsyncGitNotification, StatusItem,
};
use crossbeam_channel::Sender;
use std::sync::{
	atomic::{AtomicUsize, Ordering},
	Arc, Mutex,
};

type ResultType = Vec<StatusItem>;
struct Request<R, A>(R, A);

///
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub struct CommitFilesParams {
	///
	pub id: CommitId,
	///
	pub other: Option<CommitId>,
}

impl From<CommitId> for CommitFilesParams {
	fn from(id: CommitId) -> Self {
		Self { id, other: None }
	}
}

impl From<(CommitId, CommitId)> for CommitFilesParams {
	fn from((id, other): (CommitId, CommitId)) -> Self {
		Self {
			id,
			other: Some(other),
		}
	}
}

impl From<OldNew<CommitId>> for CommitFilesParams {
	fn from(old_new: OldNew<CommitId>) -> Self {
		Self {
			id: old_new.new,
			other: Some(old_new.old),
		}
	}
}

///
pub struct AsyncCommitFiles {
	current:
		Arc<Mutex<Option<Request<CommitFilesParams, ResultType>>>>,
	sender: Sender<AsyncGitNotification>,
	pending: Arc<AtomicUsize>,
	repo: RepoPath,
}

impl AsyncCommitFiles {
	///
	pub fn new(
		repo: RepoPath,
		sender: &Sender<AsyncGitNotification>,
	) -> Self {
		Self {
			repo,
			current: Arc::new(Mutex::new(None)),
			sender: sender.clone(),
			pending: Arc::new(AtomicUsize::new(0)),
		}
	}

	///
	pub fn current(
		&self,
	) -> Result<Option<(CommitFilesParams, ResultType)>> {
		let c = self.current.lock()?;

		c.as_ref()
			.map_or(Ok(None), |c| Ok(Some((c.0, c.1.clone()))))
	}

	///
	pub fn is_pending(&self) -> bool {
		self.pending.load(Ordering::Relaxed) > 0
	}

	///
	pub fn fetch(&self, params: CommitFilesParams) -> Result<()> {
		if self.is_pending() {
			return Ok(());
		}

		log::trace!("request: {params:?}");

		{
			let current = self.current.lock()?;
			if let Some(c) = &*current {
				if c.0 == params {
					return Ok(());
				}
			}
		}

		let arc_current = Arc::clone(&self.current);
		let sender = self.sender.clone();
		let arc_pending = Arc::clone(&self.pending);
		let repo = self.repo.clone();

		self.pending.fetch_add(1, Ordering::Relaxed);

		rayon_core::spawn(move || {
			Self::fetch_helper(&repo, params, &arc_current)
				.expect("failed to fetch");

			arc_pending.fetch_sub(1, Ordering::Relaxed);

			sender
				.send(AsyncGitNotification::CommitFiles)
				.expect("error sending");
		});

		Ok(())
	}

	fn fetch_helper(
		repo_path: &RepoPath,
		params: CommitFilesParams,
		arc_current: &Arc<
			Mutex<Option<Request<CommitFilesParams, ResultType>>>,
		>,
	) -> Result<()> {
		let res = sync::get_commit_files(
			repo_path,
			params.id,
			params.other,
		)?;

		log::trace!("get_commit_files: {:?} ({})", params, res.len());

		{
			let mut current = arc_current.lock()?;
			*current = Some(Request(params, res));
		}

		Ok(())
	}
}

```

### Core Architecture Module: `asyncgit/src/diff.rs`
```
use crate::{
	error::Result,
	hash,
	sync::{
		self, commit_files::OldNew, diff::DiffOptions, CommitId,
		RepoPath,
	},
	AsyncGitNotification, FileDiff,
};
use crossbeam_channel::Sender;
use std::{
	hash::Hash,
	sync::{
		atomic::{AtomicUsize, Ordering},
		Arc, Mutex,
	},
};

///
#[derive(Debug, Hash, Clone, PartialEq, Eq)]
pub enum DiffType {
	/// diff two commits
	Commits(OldNew<CommitId>),
	/// diff in a given commit
	Commit(CommitId),
	/// diff against staged file
	Stage,
	/// diff against file in workdir
	WorkDir,
}

///
#[derive(Debug, Hash, Clone, PartialEq, Eq)]
pub struct DiffParams {
	/// path to the file to diff
	pub path: String,
	/// what kind of diff
	pub diff_type: DiffType,
	/// diff options
	pub options: DiffOptions,
}

struct Request<R, A>(R, Option<A>);

#[derive(Default, Clone)]
struct LastResult<P, R> {
	params: P,
	result: R,
}

///
pub struct AsyncDiff {
	current: Arc<Mutex<Request<u64, FileDiff>>>,
	last: Arc<Mutex<Option<LastResult<DiffParams, FileDiff>>>>,
	sender: Sender<AsyncGitNotification>,
	pending: Arc<AtomicUsize>,
	repo: RepoPath,
}

impl AsyncDiff {
	///
	pub fn new(
		repo: RepoPath,
		sender: &Sender<AsyncGitNotification>,
	) -> Self {
		Self {
			repo,
			current: Arc::new(Mutex::new(Request(0, None))),
			last: Arc::new(Mutex::new(None)),
			sender: sender.clone(),
			pending: Arc::new(AtomicUsize::new(0)),
		}
	}

	///
	pub fn last(&self) -> Result<Option<(DiffParams, FileDiff)>> {
		let last = self.last.lock()?;

		Ok(last.clone().map(|res| (res.params, res.result)))
	}

	///
	pub fn refresh(&self) -> Result<()> {
		if let Ok(Some(param)) = self.get_last_param() {
			self.clear_current()?;
			self.request(param)?;
		}
		Ok(())
	}

	///
	pub fn is_pending(&self) -> bool {
		self.pending.load(Ordering::Relaxed) > 0
	}

	///
	pub fn request(
		&self,
		params: DiffParams,
	) -> Result<Option<FileDiff>> {
		log::trace!("request {params:?}");

		let hash = hash(&params);

		{
			let mut current = self.current.lock()?;

			if current.0 == hash {
				return Ok(current.1.clone());
			}

			current.0 = hash;
			current.1 = None;
		}

		let arc_current = Arc::clone(&self.current);
		let arc_last = Arc::clone(&self.last);
		let sender = self.sender.clone();
		let arc_pending = Arc::clone(&self.pending);
		let repo = self.repo.clone();

		self.pending.fetch_add(1, Ordering::Relaxed);

		rayon_core::spawn(move || {
			let notify = Self::get_diff_helper(
				&repo,
				params,
				&arc_last,
				&arc_current,
				hash,
			);

			let notify = match notify {
				Err(e) => {
					log::error!("get_diff_helper error: {e}");
					true
				}
				Ok(notify) => notify,
			};

			arc_pending.fetch_sub(1, Ordering::Relaxed);

			sender
				.send(if notify {
					AsyncGitNotification::Diff
				} else {
					AsyncGitNotification::FinishUnchanged
				})
				.expect("error sending diff");
		});

		Ok(None)
	}

	fn get_diff_helper(
		repo_path: &RepoPath,
		params: DiffParams,
		arc_last: &Arc<
			Mutex<Option<LastResult<DiffParams, FileDiff>>>,
		>,
		arc_current: &Arc<Mutex<Request<u64, FileDiff>>>,
		hash: u64,
	) -> Result<bool> {
		let res = match params.diff_type {
			DiffType::Stage => sync::diff::get_diff(
				repo_path,
				&params.path,
				true,
				Some(params.options),
			)?,
			DiffType::WorkDir => sync::diff::get_diff(
				repo_path,
				&params.path,
				false,
				Some(params.options),
			)?,
			DiffType::Commit(id) => sync::diff::get_diff_commit(
				repo_path,
				id,
				params.path.clone(),
				Some(params.options),
			)?,
			DiffType::Commits(ids) => sync::diff::get_diff_commits(
				repo_path,
				ids,
				params.path.clone(),
				Some(params.options),
			)?,
		};

		let mut notify = false;
		{
			let mut current = arc_current.lock()?;
			if current.0 == hash {
				current.1 = Some(res.clone());
				notify = true;
			}
		}

		{
			let mut last = arc_last.lock()?;
			*last = Some(LastResult {
				result: res,
				params,
			});
		}

		Ok(notify)
	}

	fn get_last_param(&self) -> Result<Option<DiffParams>> {
		Ok(self.last.lock()?.clone().map(|e| e.params))
	}

	fn clear_current(&self) -> Result<()> {
		let mut current = self.current.lock()?;
		current.0 = 0;
		current.1 = None;
		Ok(())
	}
}

```

### Core Architecture Module: `asyncgit/src/error.rs`
```
use std::{
	num::TryFromIntError, path::StripPrefixError,
	string::FromUtf8Error,
};
use thiserror::Error;

///
#[derive(Error, Debug)]
pub enum GixError {
	///
	#[error("gix::discover error: {0}")]
	Discover(#[from] Box<gix::discover::Error>),

	///
	#[error("gix::head::peel::to_commit error: {0}")]
	HeadPeelToCommit(#[from] gix::head::peel::to_commit::Error),

	///
	#[error("gix::object::find::existing::with_conversion::Error error: {0}")]
	ObjectFindExistingWithConversion(
		#[from] gix::object::find::existing::with_conversion::Error,
	),

	///
	#[error("gix::objs::decode::Error error: {0}")]
	ObjsDecode(#[from] gix::objs::decode::Error),

	///
	#[error("gix::pathspec::init::Error error: {0}")]
	PathspecInit(#[from] Box<gix::pathspec::init::Error>),

	///
	#[error("gix::reference::find::existing error: {0}")]
	ReferenceFindExisting(
		#[from] gix::reference::find::existing::Error,
	),

	///
	#[error("gix::reference::head_tree_id::Error error: {0}")]
	ReferenceHeadTreeId(#[from] gix::reference::head_tree_id::Error),

	///
	#[error("gix::reference::iter::Error error: {0}")]
	ReferenceIter(#[from] gix::reference::iter::Error),

	///
	#[error("gix::reference::iter::init::Error error: {0}")]
	ReferenceIterInit(#[from] gix::reference::iter::init::Error),

	///
	#[error("gix::revision::walk error: {0}")]
	RevisionWalk(#[from] gix::revision::walk::Error),

	///
	#[error("gix::status::Error error: {0}")]
	Status(#[from] Box<gix::status::Error>),

	///
	#[error("gix::status::index_worktree::Error error: {0}")]
	StatusIndexWorktree(
		#[from] Box<gix::status::index_worktree::Error>,
	),

	///
	#[error("gix::status::into_iter::Error error: {0}")]
	StatusIntoIter(#[from] Box<gix::status::into_iter::Error>),

	///
	#[error("gix::status::iter::Error error: {0}")]
	StatusIter(#[from] Box<gix::status::iter::Error>),

	///
	#[error("gix::status::tree_index::Error error: {0}")]
	StatusTreeIndex(#[from] Box<gix::status::tree_index::Error>),

	///
	#[error("gix::worktree::open_index::Error error: {0}")]
	WorktreeOpenIndex(#[from] Box<gix::worktree::open_index::Error>),
}

///
#[derive(Error, Debug)]
pub enum Error {
	///
	#[error("`{0}`")]
	Generic(String),

	///
	#[error("git: no head found")]
	NoHead,

	///
	#[error("git: conflict during rebase")]
	RebaseConflict,

	///
	#[error("git: remote url not found")]
	UnknownRemote,

	///
	#[error("git: inconclusive remotes")]
	NoDefaultRemoteFound,

	///
	#[error("git: work dir error")]
	NoWorkDir,

	///
	#[error("git: uncommitted changes")]
	UncommittedChanges,

	///
	#[error("git: can\u{2019}t run blame on a binary file")]
	NoBlameOnBinaryFile,

	///
	#[error("binary file")]
	BinaryFile,

	///
	#[error("io error:{0}")]
	Io(#[from] std::io::Error),

	///
	#[error("git error:{0}")]
	Git(#[from] git2::Error),

	///
	#[error("git config error: {0}")]
	GitConfig(String),

	///
	#[error("strip prefix error: {0}")]
	StripPrefix(#[from] StripPrefixError),

	///
	#[error("utf8 error:{0}")]
	Utf8Conversion(#[from] FromUtf8Error),

	///
	#[error("TryFromInt error:{0}")]
	IntConversion(#[from] TryFromIntError),

	///
	#[error("EasyCast error:{0}")]
	EasyCast(#[from] easy_cast::Error),

	///
	#[error("no parent of commit found")]
	NoParent,

	///
	#[error("not on a branch")]
	NoBranch,

	///
	#[error("rayon error: {0}")]
	ThreadPool(#[from] rayon_core::ThreadPoolBuildError),

	///
	#[error("git hook error: {0}")]
	Hooks(#[from] git2_hooks::HooksError),

	///
	#[error("sign builder error: {0}")]
	SignBuilder(#[from] crate::sync::sign::SignBuilderError),

	///
	#[error("sign error: {0}")]
	Sign(#[from] crate::sync::sign::SignError),

	///
	#[error("gix error:{0}")]
	Gix(#[from] GixError),

	///
	#[error("amend error: config commit.gpgsign=true detected.\ngpg signing is not supported for amending non-last commits")]
	SignAmendNonLastCommit,

	///
	#[error("reword error: config commit.gpgsign=true detected.\ngpg signing is not supported for rewording commits with staged changes\ntry unstaging or stashing your changes")]
	SignRewordLastCommitStaged,
}

///
pub type Result<T> = std::result::Result<T, Error>;

impl<T> From<std::sync::PoisonError<T>> for Error {
	fn from(error: std::sync::PoisonError<T>) -> Self {
		Self::Generic(format!("poison error: {error}"))
	}
}

impl<T> From<crossbeam_channel::SendError<T>> for Error {
	fn from(error: crossbeam_channel::SendError<T>) -> Self {
		Self::Generic(format!("send error: {error}"))
	}
}

impl From<gix::discover::Error> for GixError {
	fn from(error: gix::discover::Error) -> Self {
		Self::Discover(Box::new(error))
	}
}

impl From<gix::discover::Error> for Error {
	fn from(error: gix::discover::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::head::peel::to_commit::Error> for Error {
	fn from(error: gix::head::peel::to_commit::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::object::find::existing::with_conversion::Error>
	for Error
{
	fn from(
		error: gix::object::find::existing::with_conversion::Error,
	) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::objs::decode::Error> for Error {
	fn from(error: gix::objs::decode::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::pathspec::init::Error> for GixError {
	fn from(error: gix::pathspec::init::Error) -> Self {
		Self::PathspecInit(Box::new(error))
	}
}

impl From<gix::pathspec::init::Error> for Error {
	fn from(error: gix::pathspec::init::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::reference::find::existing::Error> for Error {
	fn from(error: gix::reference::find::existing::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::reference::head_tree_id::Error> for Error {
	fn from(error: gix::reference::head_tree_id::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::reference::iter::Error> for Error {
	fn from(error: gix::reference::iter::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::reference::iter::init::Error> for Error {
	fn from(error: gix::reference::iter::init::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::revision::walk::Error> for Error {
	fn from(error: gix::revision::walk::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::status::Error> for GixError {
	fn from(error: gix::status::Error) -> Self {
		Self::Status(Box::new(error))
	}
}

impl From<gix::status::Error> for Error {
	fn from(error: gix::status::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::status::iter::Error> for GixError {
	fn from(error: gix::status::iter::Error) -> Self {
		Self::StatusIter(Box::new(error))
	}
}

impl From<gix::status::iter::Error> for Error {
	fn from(error: gix::status::iter::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::status::into_iter::Error> for GixError {
	fn from(error: gix::status::into_iter::Error) -> Self {
		Self::StatusIntoIter(Box::new(error))
	}
}

impl From<gix::status::into_iter::Error> for Error {
	fn from(error: gix::status::into_iter::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::status::index_worktree::Error> for GixError {
	fn from(error: gix::status::index_worktree::Error) -> Self {
		Self::StatusIndexWorktree(Box::new(error))
	}
}

impl From<gix::status::index_worktree::Error> for Error {
	fn from(error: gix::status::index_worktree::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::status::tree_index::Error> for GixError {
	fn from(error: gix::status::tree_index::Error) -> Self {
		Self::StatusTreeIndex(Box::new(error))
	}
}

impl From<gix::status::tree_index::Error> for Error {
	fn from(error: gix::status::tree_index::Error) -> Self {
		Self::Gix(GixError::from(error))
	}
}

impl From<gix::worktree::open_index::Error> for GixError {
	fn from(error: gix::worktree::open_index::Error) -> Self {
		Self::WorktreeOpenIndex(Box::new(error))
	}
}

impl From<gix::worktree::open_index::Error> for Error 
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

### Incident Patch 1: `d78d2647` (2026-07-31)
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

### Incident Patch 2: `cf74c156` (2026-07-05)
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

### Incident Patch 3: `8b7a74ea` (2026-07-01)
**Commit Message**: fix: avoid index-out-of-bounds panic in staging apply_selection (#2955)

Co-authored-by: extrawurst <776816+extrawurst@users.noreply.github.com>

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

### Incident Patch 4: `c6b370f0` (2026-07-01)
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

### Incident Patch 5: `8ed70068` (2026-07-01)
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

### Incident Patch 6: `b1db21e1` (2026-03-31)
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

### Incident Patch 7: `a57cbf28` (2026-03-25)
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

### Incident Patch 8: `06a3f660` (2026-03-19)
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

### Incident Patch 9: `09d67266` (2026-03-19)
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

### Incident Patch 10: `268d8ab1` (2026-03-19)
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

#### Recent Merged Pull Requests:
- **PR #3010** (closed): chore: update Cargo.lock for git2 ssh feature (@youssefadly237)
- **PR #3009** (2026-07-31): fix: Update git2 dependency to include 'ssh' feature (@gcgbarbosa)
- **PR #2993** (2026-07-09): run tests on linux arm ci pipeline (@extrawurst)
- **PR #2992** (2026-07-09): make x502 signing test less flaky on macos (@extrawurst)
- **PR #2986** (2026-07-02): add e2e test covering gpg (@extrawurst)
- **PR #2985** (2026-07-01): fix ci lint (@extrawurst)
- **PR #2979** (closed): fix(staging): preserve no-trailing-newline when staging partial hunks (@Bolt4243)
- **PR #2967** (2026-07-17): Update `gix` to 0.84 (@cruessler)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
