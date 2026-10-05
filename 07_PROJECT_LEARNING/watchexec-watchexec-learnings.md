# Forensic Learning Record (Deep Inspection): watchexec/watchexec

> **Canonical Artifact**: `07_PROJECT_LEARNING/watchexec-watchexec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/watchexec/watchexec](https://github.com/watchexec/watchexec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:40:57.322Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `watchexec/watchexec`
- **Description**: Executes commands in response to file modifications
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7212 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/cli/src/state.rs`
```
use std::{
	env::var_os,
	io::Write,
	path::PathBuf,
	process::ExitCode,
	sync::{Arc, Mutex, OnceLock},
};

use watchexec::Watchexec;

use miette::{IntoDiagnostic, Result};
use tempfile::NamedTempFile;

use crate::{
	args::Args,
	socket::{SocketSet, Sockets},
};

pub type State = Arc<InnerState>;

pub async fn new(args: &Args) -> Result<State> {
	let socket_set = if args.command.socket.is_empty() {
		None
	} else {
		let mut sockets = SocketSet::create(&args.command.socket).await?;
		sockets.serve();
		Some(sockets)
	};

	Ok(Arc::new(InnerState {
		emit_file: RotatingTempFile::default(),
		socket_set,
		exit_code: Mutex::new(ExitCode::SUCCESS),
		watchexec: OnceLock::new(),
	}))
}

#[derive(Debug)]
pub struct InnerState {
	pub emit_file: RotatingTempFile,
	pub socket_set: Option<SocketSet>,
	pub exit_code: Mutex<ExitCode>,
	/// Reference to the Watchexec instance, set after creation.
	/// Used to send synthetic events (e.g., to trigger immediate quit on error).
	pub watchexec: OnceLock<Arc<Watchexec>>,
}

#[derive(Debug, Default)]
pub struct RotatingTempFile(Mutex<Option<NamedTempFile>>);

impl RotatingTempFile {
	pub fn rotate(&self) -> Result<()> {
		// implicitly drops the old file
		*self.0.lock().unwrap() = Some(
			if let Some(dir) = var_os("WATCHEXEC_TMPDIR") {
				NamedTempFile::new_in(dir)
			} else {
				NamedTempFile::new()
			}
			.into_diagnostic()?,
		);
		Ok(())
	}

	pub fn write(&self, data: &[u8]) -> Result<()> {
		if let Some(file) = self.0.lock().unwrap().as_mut() {
			file.write_all(data).into_diagnostic()?;
		}

		Ok(())
	}

	pub fn path(&self) -> PathBuf {
		if let Some(file) = self.0.lock().unwrap().as_ref() {
			file.path().to_owned()
		} else {
			PathBuf::new()
		}
	}
}

```

### Core Architecture Module: `crates/lib/src/action/worker.rs`
```
use std::{
	collections::HashMap,
	mem::take,
	sync::Arc,
	time::{Duration, Instant},
};

use async_priority_channel as priority;
use tokio::{sync::mpsc, time::timeout};
use tracing::{debug, trace};
use watchexec_events::{Event, Priority};
use watchexec_supervisor::job::Job;

use super::{handler::Handler, quit::QuitManner};
use crate::{
	action::ActionReturn,
	error::{CriticalError, RuntimeError},
	filter::Filterer,
	id::Id,
	late_join_set::LateJoinSet,
	Config,
};

/// The main worker of a Watchexec process.
///
/// This is the main loop of the process. It receives events from the event channel, filters them,
/// debounces them, obtains the desired outcome of an actioned event, calls the appropriate handlers
/// and schedules processes as needed.
pub async fn worker(
	config: Arc<Config>,
	errors: mpsc::Sender<RuntimeError>,
	events: priority::Receiver<Event, Priority>,
) -> Result<(), CriticalError> {
	let mut jobtasks = LateJoinSet::default();
	let mut jobs = HashMap::<Id, Job>::new();

	while let Some(mut set) = throttle_collect(
		config.clone(),
		events.clone(),
		errors.clone(),
		Instant::now(),
	)
	.await?
	{
		let events: Arc<[Event]> = Arc::from(take(&mut set).into_boxed_slice());

		trace!("preparing action handler");
		let action = Handler::new(events.clone(), jobs.clone());

		debug!("running action handler");
		let action = match config.action_handler.call(action) {
			ActionReturn::Sync(action) => action,
			ActionReturn::Async(action) => Box::into_pin(action).await,
		};

		debug!("take control of new tasks");
		for (id, (job, task)) in action.new {
			trace!(?id, "taking control of new task");
			jobtasks.insert(task);
			jobs.insert(id, job);
		}

		if let Some(manner) = action.quit {
			debug!(?manner, "quitting worker");
			match manner {
				QuitManner::Abort => break,
				QuitManner::Graceful { signal, grace } => {
					debug!(?signal, ?grace, "quitting worker gracefully");
					let mut tasks = LateJoinSet::default();
					for (id, job) in jobs.drain() {
						trace!(?id, "quitting job");
						tasks.spawn(async move {
							job.stop_with_signal(signal, grace);
							job.delete().await;
						});
					}
					// TODO: spawn to process actions, and allow events to come in while
					//       waiting for graceful shutdown, e.g. a second Ctrl-C to hasten
					debug!("waiting for graceful shutdown tasks");
					tasks.join_all().await;
					debug!("waiting for job tasks to end");
					jobtasks.join_all().await;
					break;
				}
			}
		}

		let gc: Vec<Id> = jobs
			.iter()
			.filter_map(|(id, job)| {
				if job.is_dead() {
					trace!(?id, "job is dead, gc'ing");
					Some(*id)
				} else {
					None
				}
			})
			.collect();
		if !gc.is_empty() {
			debug!("garbage collect old tasks");
			for id in gc {
				jobs.remove(&id);
			}
		}

		debug!("action handler finished");
	}

	debug!("action worker finished");
	Ok(())
}

pub async fn throttle_collect(
	config: Arc<Config>,
	events: priority::Receiver<Event, Priority>,
	errors: mpsc::Sender<RuntimeError>,
	mut last: Instant,
) -> Result<Option<Vec<Event>>, CriticalError> {
	if events.is_closed() {
		trace!("events channel closed, stopping");
		return Ok(None);
	}

	let mut set: Vec<Event> = vec![];
	loop {
		let maxtime = if set.is_empty() {
			trace!("nothing in set, waiting forever for next event");
			Duration::from_secs(u64::MAX)
		} else {
			config.throttle.get().saturating_sub(last.elapsed())
		};

		if maxtime.is_zero() {
			if set.is_empty() {
				trace!("out of throttle but nothing to do, resetting");
				last = Instant::now();
				continue;
			}

			trace!("out of throttle on recycle");
		} else {
			trace!(?maxtime, "waiting for event");
			let maybe_event = timeout(maxtime, events.recv()).await;
			if events.is_closed() {
				trace!("events channel closed during timeout, stopping");
				return Ok(None);
			}

			match maybe_event {
				Err(_timeout) => {
					trace!("timed out, cycling");
					continue;
				}
				Ok(Err(_empty)) => return Ok(None),
				Ok(Ok((event, priority))) => {
					trace!(?event, ?priority, "got event");

					if priority == Priority::Urgent {
						trace!("urgent event, bypassing filters");
					} else if event.is_empty() {
						trace!("empty event, bypassing filters");
					} else {
						let filtered = config.filterer.check_event(&event, priority);
						match filtered {
							Err(err) => {
								trace!(%err, "filter errored on event");
								errors.send(err).await?;
								continue;
							}
							Ok(false) => {
								trace!("filter rejected event");
								continue;
							}
							Ok(true) => {
								trace!("filter passed event");
							}
						}
					}

					if set.is_empty() {
						trace!("event is the first, resetting throttle window");
						last = Instant::now();
					}

					set.push(event);

					if priority == Priority::Urgent {
						trace!("urgent event, bypassing throttle");
					} else {
						let elapsed = last.elapsed();
						if elapsed < config.throttle.get() {
							trace!(?elapsed, "still within throttle window, cycling");
							continue;
						}
					}
				}
			}
		}

		return Ok(Some(set));
	}
}

```

### Core Architecture Module: `crates/supervisor/src/job/state.rs`
```
use std::{sync::Arc, time::Instant};

#[cfg(not(test))]
use process_wrap::tokio::ChildWrapper;
use process_wrap::tokio::CommandWrap;
use tracing::trace;
use watchexec_events::ProcessEnd;

#[cfg(not(test))]
use super::task::Spawner;
use super::task::SpawnerSlot;
use crate::command::Command;

/// The state of the job's command / process.
///
/// This is used both internally to represent the current state (ready/pending, running, finished)
/// of the command, and can be queried via the [`JobTaskContext`](super::JobTaskContext) by hooks.
///
/// Technically, some operations can be done through a `&self` shared borrow on the running
/// command's [`ChildWrapper`], but this library recommends against taking advantage of this,
/// and prefer using the methods on [`Job`](super::Job) instead, so that the job can keep track of
/// what's going on.
#[derive(Debug)]
#[cfg_attr(test, derive(Clone))]
pub enum CommandState {
	/// The command is neither running nor has finished. This is the initial state.
	Pending,

	/// The command is currently running. Note that this is established after the process is spawned
	/// and not precisely synchronised with the process' aliveness: in some cases the process may be
	/// exited but still `Running` in this enum.
	Running {
		/// The child process (test version).
		#[cfg(test)]
		child: super::TestChild,

		/// The child process.
		#[cfg(not(test))]
		child: Box<dyn ChildWrapper>,

		/// The time at which the process was spawned.
		started: Instant,
	},

	/// The command has completed and its status was collected.
	Finished {
		/// The command's exit status.
		status: ProcessEnd,

		/// The time at which the process was spawned.
		started: Instant,

		/// The time at which the process finished, or more precisely, when its status was collected.
		finished: Instant,
	},
}

impl CommandState {
	/// Whether the command is pending, i.e. not running or finished.
	#[must_use]
	pub const fn is_pending(&self) -> bool {
		matches!(self, Self::Pending)
	}

	/// Whether the command is running.
	#[must_use]
	pub const fn is_running(&self) -> bool {
		matches!(self, Self::Running { .. })
	}

	/// Whether the command is finished.
	#[must_use]
	pub const fn is_finished(&self) -> bool {
		matches!(self, Self::Finished { .. })
	}

	#[cfg_attr(test, allow(unused_mut, unused_variables))]
	pub(super) fn spawn(
		&mut self,
		command: Arc<Command>,
		mut spawnable: CommandWrap,
		spawner: &SpawnerSlot,
	) -> std::io::Result<bool> {
		if let Self::Running { .. } = self {
			trace!("command running, not spawning again");
			return Ok(false);
		}

		trace!(?command, "spawning command");

		#[cfg(test)]
		let child = super::TestChild::new(command)?;

		#[cfg(not(test))]
		let child = match spawner.get() {
			Spawner::Default => spawnable.spawn()?,
			Spawner::Command(f) => spawnable.spawn_with(|cmd| f(cmd))?,
			Spawner::Child(f) => f(spawnable)?,
		};

		*self = Self::Running {
			child,
			started: Instant::now(),
		};
		Ok(true)
	}

	#[must_use]
	pub(crate) fn reset(&mut self) -> Self {
		trace!(?self, "resetting command state");
		match self {
			Self::Pending => Self::Pending,
			Self::Finished {
				status,
				started,
				finished,
				..
			} => {
				let copy = Self::Finished {
					status: *status,
					started: *started,
					finished: *finished,
				};

				*self = Self::Pending;
				copy
			}
			Self::Running { started, .. } => {
				let copy = Self::Finished {
					status: ProcessEnd::Continued,
					started: *started,
					finished: Instant::now(),
				};

				*self = Self::Pending;
				copy
			}
		}
	}

	pub(crate) async fn wait(&mut self) -> std::io::Result<bool> {
		if let Self::Running { child, started } = self {
			let end = child.wait().await?;
			*self = Self::Finished {
				status: end.into(),
				started: *started,
				finished: Instant::now(),
			};
			Ok(true)
		} else {
			Ok(false)
		}
	}
}

```

### Core Architecture Module: `bin/dates.mjs`
```
#!/usr/bin/env node

const id = Math.floor(Math.random() * 100);
let n = 0;
const m = 5;
while (n < m) {
	n += 1;
	console.log(`[${id} : ${n}/${m}] ${new Date}`);
	await new Promise(done => setTimeout(done, 2000));
}

```

### Core Architecture Module: `crates/bosion/examples/clap/src/main.rs`
```
use clap::Parser;

include!(env!("BOSION_PATH"));

#[derive(Parser)]
#[clap(version, long_version = Bosion::LONG_VERSION)]
struct Args {
	#[clap(long)]
	extras: bool,

	#[clap(long)]
	features: bool,

	#[clap(long)]
	dates: bool,

	#[clap(long)]
	hashes: bool,
}

fn main() {
	let args = Args::parse();

	if args.extras {
		println!(
			"{}",
			Bosion::long_version_with(&[("extra", "field"), ("custom", "1.2.3"),])
		);
	} else if args.features {
		println!("Features: {}", Bosion::CRATE_FEATURE_STRING);
	} else if args.dates {
		println!("commit date: {}", Bosion::GIT_COMMIT_DATE);
		println!("commit datetime: {}", Bosion::GIT_COMMIT_DATETIME);
		println!("build date: {}", Bosion::BUILD_DATE);
		println!("build datetime: {}", Bosion::BUILD_DATETIME);
	} else if args.hashes {
		println!("commit hash: {}", Bosion::GIT_COMMIT_HASH);
		println!("commit shorthash: {}", Bosion::GIT_COMMIT_SHORTHASH);
	} else {
		println!("{}", Bosion::LONG_VERSION);
	}
}

```

### Core Architecture Module: `crates/bosion/examples/default/src/common.rs`
```
#[cfg(test)]
pub(crate) fn git_commit_info(format: &str) -> String {
	let output = std::process::Command::new("git")
		.arg("show")
		.arg("--no-notes")
		.arg("--no-patch")
		.arg(format!("--pretty=format:{format}"))
		.output()
		.expect("git");

	String::from_utf8(output.stdout)
		.expect("git")
		.trim()
		.to_string()
}

#[macro_export]
macro_rules! test_snapshot {
	($name:ident, $actual:expr) => {
		#[cfg(test)]
		#[test]
		fn $name() {
			use std::str::FromStr;
			let gittime = ::time::OffsetDateTime::from_unix_timestamp(
				i64::from_str(&crate::common::git_commit_info("%ct")).expect("git i64"),
			)
			.expect("git time");

			::snapbox::Assert::new().matches(
				::leon::Template::parse(
					std::fs::read_to_string(format!("../snapshots/{}.txt", stringify!($name)))
						.expect("read file")
						.trim(),
				)
				.expect("leon parse")
				.render(&[
					(
						"today date".to_string(),
						::time::OffsetDateTime::now_utc()
							.format(::time::macros::format_description!("[year]-[month]-[day]"))
							.unwrap(),
					),
					("git hash".to_string(), crate::common::git_commit_info("%H")),
					(
						"git shorthash".to_string(),
						crate::common::git_commit_info("%H").chars().take(8).collect(),
					),
					(
						"git date".to_string(),
						gittime
							.format(::time::macros::format_description!("[year]-[month]-[day]"))
							.expect("git date format"),
					),
					(
						"git datetime".to_string(),
						gittime
							.format(::time::macros::format_description!(
								"[year]-[month]-[day] [hour]:[minute]:[second]"
							))
							.expect("git time format"),
					),
				])
				.expect("leon render"),
				$actual,
			);
		}
	};
}

```

### Core Architecture Module: `crates/bosion/examples/default/src/main.rs`
```
include!(env!("BOSION_PATH"));

mod common;
fn main() {}

test_snapshot!(crate_version, Bosion::CRATE_VERSION);

test_snapshot!(crate_features, format!("{:#?}", Bosion::CRATE_FEATURES));

test_snapshot!(build_date, Bosion::BUILD_DATE);

test_snapshot!(build_datetime, Bosion::BUILD_DATETIME);

test_snapshot!(git_commit_hash, Bosion::GIT_COMMIT_HASH);

test_snapshot!(git_commit_shorthash, Bosion::GIT_COMMIT_SHORTHASH);

test_snapshot!(git_commit_date, Bosion::GIT_COMMIT_DATE);

test_snapshot!(git_commit_datetime, Bosion::GIT_COMMIT_DATETIME);

test_snapshot!(default_long_version, Bosion::LONG_VERSION);

test_snapshot!(
	default_long_version_with,
	Bosion::long_version_with(&[("extra", "field"), ("custom", "1.2.3")])
);

```

### Core Architecture Module: `crates/bosion/examples/no-git/src/main.rs`
```
include!(env!("BOSION_PATH"));

#[path = "../../default/src/common.rs"]
mod common;
fn main() {}

test_snapshot!(crate_version, Bosion::CRATE_VERSION);

test_snapshot!(crate_features, format!("{:#?}", Bosion::CRATE_FEATURES));

test_snapshot!(build_date, Bosion::BUILD_DATE);

test_snapshot!(build_datetime, Bosion::BUILD_DATETIME);

test_snapshot!(no_git_long_version, Bosion::LONG_VERSION);

test_snapshot!(
	no_git_long_version_with,
	Bosion::long_version_with(&[("extra", "field"), ("custom", "1.2.3")])
);

```

### Core Architecture Module: `crates/bosion/examples/no-std/src/main.rs`
```
#![cfg_attr(not(test), no_main)]
#![cfg_attr(not(test), no_std)]

#[cfg(not(test))]
use core::panic::PanicInfo;

#[cfg(not(test))]
#[panic_handler]
fn panic(_panic: &PanicInfo<'_>) -> ! {
    loop {}
}

include!(env!("BOSION_PATH"));

#[cfg(test)]
#[path = "../../default/src/common.rs"]
mod common;

#[cfg(test)]
mod test {
	use super::*;

	test_snapshot!(crate_version, Bosion::CRATE_VERSION);

	test_snapshot!(crate_features, format!("{:#?}", Bosion::CRATE_FEATURES));

	test_snapshot!(build_date, Bosion::BUILD_DATE);

	test_snapshot!(build_datetime, Bosion::BUILD_DATETIME);

	test_snapshot!(no_git_long_version, Bosion::LONG_VERSION);
}

```

### Core Architecture Module: `crates/bosion/src/info.rs`
```
use std::{
	env::var,
	path::{Path, PathBuf},
};

use time::{format_description::FormatItem, macros::format_description, OffsetDateTime};

/// Gathered build-time information
///
/// This struct contains all the information gathered by `bosion`. It is not meant to be used
/// directly under normal circumstances, but is public for documentation purposes and if you wish
/// to build your own frontend for whatever reason. In that case, note that no effort has been made
/// to make this usable outside of the build.rs environment.
///
/// The `git` field is only available when the `git` feature is enabled, and if there is a git
/// repository to read from. The repository is discovered by walking up the directory tree until one
/// is found, which means workspaces or more complex monorepos are automatically supported. If there
/// are any errors reading the repository, the `git` field will be `None` and a rustc warning will
/// be printed.
#[derive(Debug, Clone)]
pub struct Info {
	/// The crate version, as read from the `CARGO_PKG_VERSION` environment variable.
	pub crate_version: String,

	/// The crate features, as found by the presence of `CARGO_FEATURE_*` environment variables.
	///
	/// These are normalised to lowercase and have underscores replaced by hyphens.
	pub crate_features: Vec<String>,

	/// The build date, in the format `YYYY-MM-DD`, at UTC.
	///
	/// This is either current as of build time, or from the timestamp specified by the
	/// `SOURCE_DATE_EPOCH` environment variable, for
	/// [reproducible builds](https://reproducible-builds.org/).
	pub build_date: String,

	/// The build datetime, in the format `YYYY-MM-DD HH:MM:SS`, at UTC.
	///
	/// This is either current as of build time, or from the timestamp specified by the
	/// `SOURCE_DATE_EPOCH` environment variable, for
	/// [reproducible builds](https://reproducible-builds.org/).
	pub build_datetime: String,

	/// Git repository information, if available.
	pub git: Option<GitInfo>,
}

trait ErrString<T> {
	fn err_string(self) -> Result<T, String>;
}

impl<T, E> ErrString<T> for Result<T, E>
where
	E: std::fmt::Display,
{
	fn err_string(self) -> Result<T, String> {
		self.map_err(|e| e.to_string())
	}
}

const DATE_FORMAT: &[FormatItem<'static>] = format_description!("[year]-[month]-[day]");
const DATETIME_FORMAT: &[FormatItem<'static>] =
	format_description!("[year]-[month]-[day] [hour]:[minute]:[second]");

impl Info {
	/// Gathers build-time information
	///
	/// This is not meant to be used directly under normal circumstances, but is public if you wish
	/// to build your own frontend for whatever reason. In that case, note that no effort has been
	/// made to make this usable outside of the build.rs environment.
	pub fn gather() -> Result<Self, String> {
		let build_date = Self::build_date()?;

		Ok(Self {
			crate_version: var("CARGO_PKG_VERSION").err_string()?,
			crate_features: Self::features(),
			build_date: build_date.format(DATE_FORMAT).err_string()?,
			build_datetime: build_date.format(DATETIME_FORMAT).err_string()?,

			#[cfg(feature = "git")]
			git: GitInfo::gather()
				.map_err(|e| {
					println!("cargo:warning=git info gathering failed: {e}");
				})
				.ok(),
			#[cfg(not(feature = "git"))]
			git: None,
		})
	}

	fn build_date() -> Result<OffsetDateTime, String> {
		if cfg!(feature = "reproducible") {
			if let Ok(date) = var("SOURCE_DATE_EPOCH") {
				if let Ok(date) = date.parse::<i64>() {
					return OffsetDateTime::from_unix_timestamp(date).err_string();
				}
			}
		}

		Ok(OffsetDateTime::now_utc())
	}

	fn features() -> Vec<String> {
		let mut features = Vec::new();

		for (key, _) in std::env::vars() {
			if let Some(stripped) = key.strip_prefix("CARGO_FEATURE_") {
				features.push(stripped.replace('_', "-").to_lowercase().clone());
			}
		}

		features
	}

	pub(crate) fn set_reruns(&self) {
		if cfg!(feature = "reproducible") {
			println!("cargo:rerun-if-env-changed=SOURCE_DATE_EPOCH");
		}

		if let Some(git) = &self.git {
			let git_head = git.git_root.join("HEAD");
			println!("cargo:rerun-if-changed={}", git_head.display());
		}
	}
}

/// Git repository information
#[derive(Debug, Clone)]
pub struct GitInfo {
	/// The absolute path to the git repository's data folder.
	///
	/// In a normal repository, this is `.git`, _not_ the index or working directory.
	pub git_root: PathBuf,

	/// The full hash of the current commit.
	///
	/// Note that this makes no effore to handle dirty working directories, so it may not be
	/// representative of the current state of the code.
	pub git_hash: String,

	/// The short hash of the current commit.
	///
	/// This is truncated to 8 characters.
	pub git_shorthash: String,

	/// The date of the current commit, in the format `YYYY-MM-DD`, at UTC.
	pub git_date: String,

	/// The datetime of the current commit, in the format `YYYY-MM-DD HH:MM:SS`, at UTC.
	pub git_datetime: String,
}

#[cfg(feature = "git")]
impl GitInfo {
	fn gather() -> Result<Self, String> {
		let git_root = Self::find_git_dir(Path::new("."))
			.ok_or_else(|| "no git repository found".to_string())?;

		let hash =
			Self::resolve_head(&git_root).ok_or_else(|| "could not resolve HEAD".to_string())?;

		let timestamp = Self::read_commit_timestamp(&git_root, &hash)
			.ok_or_else(|| "could not read commit timestamp".to_string())?;

		let timestamp = OffsetDateTime::from_unix_timestamp(timestamp).err_string()?;

		Ok(Self {
			git_root: git_root.canonicalize().err_string()?,
			git_shorthash: hash.chars().take(8).collect(),
			git_hash: hash,
			git_date: timestamp.format(DATE_FORMAT).err_string()?,
			git_datetime: timestamp.format(DATETIME_FORMAT).err_string()?,
		})
	}

	fn find_git_dir(start: &Path) -> Option<PathBuf> {
		use std::fs;

		let mut current = start.canonicalize().ok()?;
		loop {
			let git_dir = current.join(".git");
			if git_dir.is_dir() {
				return Some(git_dir);
			}
			// Handle git worktrees: .git can be a file containing "gitdir: <path>"
			if git_dir.is_file() {
				let content = fs::read_to_string(&git_dir).ok()?;
				if let Some(path) = content.strip_prefix("gitdir: ") {
					return Some(PathBuf::from(path.trim()));
				}
			}
			if !current.pop() {
				return None;
			}
		}
	}

	fn resolve_head(git_dir: &Path) -> Option<String> {
		use std::fs;

		let head_content = fs::read_to_string(git_dir.join("HEAD")).ok()?;
		let head_content = head_content.trim();

		if let Some(ref_path) = head_content.strip_prefix("ref: ") {
			Self::resolve_ref(git_dir, ref_path)
		} else {
			// Detached HEAD - direct commit hash
			Some(head_content.to_string())
		}
	}

	fn resolve_ref(git_dir: &Path, ref_path: &str) -> Option<String> {
		use std::fs;

		// Try loose ref first
		let ref_file = git_dir.join(ref_path);
		if let Ok(content) = fs::read_to_string(&ref_file) {
			return Some(content.trim().to_string());
		}

		// Try packed-refs
		let packed_refs = git_dir.join("packed-refs");
		if let Ok(content) = fs::read_to_string(&packed_refs) {
			for line in content.lines() {
				if line.starts_with('#') || line.starts_with('^') {
					continue;
				}
				let parts: Vec<_> = line.split_whitespace().collect();
				if parts.len() >= 2 && parts[1] == ref_path {
					return Some(parts[0].to_string());
				}
			}
		}

		None
	}

	fn read_commit_timestamp(git_dir: &Path, hash: &str) -> Option<i64> {
		// Try loose object first
		if let Some(timestamp) = Self::read_loose_commit_timestamp(git_dir, hash) {
			return Some(timestamp);
		}

		// Try packfiles
		Self::read_packed_commit_timestamp(git_dir, hash)
	}

	fn read_loose_commit_timestamp(git_dir: &Path, hash: &str) -> Option<i64> {
		use flate2::read::ZlibDecoder;
		use std::{fs, io::Read};

		let (prefix, suffix) = hash.split_at(2);
		let object_path = git_dir.join("objects").join(prefix).join(suffix);

		let compressed = fs::read(&object_path).ok()?;
		let mut decoder = ZlibDecoder::new(&compressed[..]);
		let mut decompressed = Vec::new();
		decoder.read_to_end(&mut decompressed).ok()?;

		Self::parse_commit_timestamp(&decompressed)
	}

	fn read_packed_commit_timestamp(git_dir: &Path, hash: &str) -> Option<i64> {
		use std::fs;

		let pack_dir = git_dir.join("objects").join("pack");
		let entries = fs::read_dir(&pack_dir).ok()?;

		// Parse the hash into bytes for comparison
		let hash_bytes = Self::hex_to_bytes(hash)?;

		for entry in entries.flatten() {
			let path = entry.path();
			if path.extension().and_then(|e| e.to_str()) == Some("idx") {
				if let Some(offset) = Self::find_object_in_index(&path, &hash_bytes) {
					let pack_path = path.with_extension("pack");
					if let Some(data) = Self::read_pack_object(&pack_path, offset) {
						return Self::parse_commit_timestamp(&data);
					}
				}
			}
		}

		None
	}

	fn hex_to_bytes(hex: &str) -> Option<[u8; 20]> {
		let mut bytes = [0u8; 20];
		if hex.len() != 40 {
			return None;
		}
		for (i, chunk) in hex.as_bytes().chunks(2).enumerate() {
			let s = std::str::from_utf8(chunk).ok()?;
			bytes[i] = u8::from_str_radix(s, 16).ok()?;
		}
		Some(bytes)
	}

	fn find_object_in_index(idx_path: &Path, hash: &[u8; 20]) -> Option<u64> {
		use std::{
			fs::File,
			io::{Read, Seek, SeekFrom},
		};

		let mut file = File::open(idx_path).ok()?;
		let mut header = [0u8; 8];
		file.read_exact(&mut header).ok()?;

		// Check for v2 index magic: 0xff744f63
		if header[0..4] != [0xff, 0x74, 0x4f, 0x63] {
			return None; // Only support v2 index
		}

		let version = u32::from_be_bytes([header[4], header[5], header[6], header[7]]);
		if version != 2 {
			return None;
		}

		// Read fanout table (256 * 4 bytes)
		let mut fanout = [0u32; 256];
		for entry in &mut fanout {
			let mut buf = [0u8; 4];
			file.read_exact(&mut buf).ok()?;
			*entry = u32::from_be_bytes(buf);
		}

		let total_objects = fanout[255] as usize;
		let first_byte = hash[0] as usize;

		// Find range of objects with this first byte
		let start = if first_byte == 0 {
			0
		} else {
			fanout[first_byte - 1] as usize
		};
		let end = fanout[first_byt
```

### Core Architecture Module: `crates/bosion/src/lib.rs`
```
#![doc = include_str!("../README.md")]
#![cfg_attr(not(test), warn(unused_crate_dependencies))]

use std::{env::var, fs::File, io::Write, path::PathBuf};

pub use info::*;
mod info;

/// Gather build-time information for the current crate
///
/// See the crate-level documentation for a guide. This function is a convenience wrapper around
/// [`gather_to`] with the most common defaults: it writes to `bosion.rs` a pub(crate) struct named
/// `Bosion`.
pub fn gather() {
	gather_to("bosion.rs", "Bosion", false);
}

/// Gather build-time information for the current crate (public visibility)
///
/// See the crate-level documentation for a guide. This function is a convenience wrapper around
/// [`gather_to`]: it writes to `bosion.rs` a pub struct named `Bosion`.
pub fn gather_pub() {
	gather_to("bosion.rs", "Bosion", true);
}

/// Gather build-time information for the current crate (custom output)
///
/// Gathers a limited set of build-time information for the current crate and writes it to a file.
/// The file is always written to the `OUT_DIR` directory, as per Cargo conventions. It contains a
/// zero-size struct with a bunch of associated constants containing the gathered information, and a
/// `long_version_with` function (when the `std` feature is enabled) that takes a slice of extra
/// key-value pairs to append in the same format.
///
/// `public` controls whether the struct is `pub` (true) or `pub(crate)` (false).
///
/// The generated code is entirely documented, and will appear in your documentation (in docs.rs, it
/// only will if visibility is public).
///
/// See [`Info`] for a list of gathered data.
///
/// The constants include all the information from [`Info`], as well as the following:
///
/// - `LONG_VERSION`: A clap-ready long version string, including the crate version, features, build
///   date, and git information when available.
/// - `CRATE_FEATURE_STRING`: A string containing the crate features, in the format `+feat1 +feat2`.
///
/// We also instruct rustc to rerun the build script if the environment changes, as necessary.
pub fn gather_to(filename: &str, structname: &str, public: bool) {
	let path = PathBuf::from(var("OUT_DIR").expect("bosion")).join(filename);
	println!("cargo:rustc-env=BOSION_PATH={}", path.display());

	let info = Info::gather().expect("bosion");
	info.set_reruns();
	let Info {
		crate_version,
		crate_features,
		build_date,
		build_datetime,
		git,
	} = info;

	let crate_feature_string = crate_features
		.iter()
		.filter(|feat| *feat != "default")
		.map(|feat| format!("+{feat}"))
		.collect::<Vec<_>>()
		.join(" ");

	let crate_feature_list = crate_features.join(",");

	let viz = if public { "pub" } else { "pub(crate)" };

	let (git_render, long_version) = if let Some(GitInfo {
		git_hash,
		git_shorthash,
		git_date,
		git_datetime,
		..
	}) = git
	{
		(format!(
		"
			/// The git commit hash
			///
			/// This is the full hash of the commit that was built. Note that if the repository was
			/// dirty, this will be the hash of the last commit, not including the changes.
			pub const GIT_COMMIT_HASH: &'static str = {git_hash:?};

			/// The git commit hash, shortened
			///
			/// This is the shortened hash of the commit that was built. Same caveats as with
			/// `GIT_COMMIT_HASH` apply. The length of the hash is fixed at 8 characters.
			pub const GIT_COMMIT_SHORTHASH: &'static str = {git_shorthash:?};

			/// The git commit date
			///
			/// This is the date (`YYYY-MM-DD`) of the commit that was built. Same caveats as with
			/// `GIT_COMMIT_HASH` apply.
			pub const GIT_COMMIT_DATE: &'static str = {git_date:?};

			/// The git commit date and time
			///
			/// This is the date and time (`YYYY-MM-DD HH:MM:SS`) of the commit that was built. Same
			/// caveats as with `GIT_COMMIT_HASH` apply.
			pub const GIT_COMMIT_DATETIME: &'static str = {git_datetime:?};
		"
	), format!("{crate_version} ({git_shorthash} {git_date}) {crate_feature_string}\ncommit-hash: {git_hash}\ncommit-date: {git_date}\nbuild-date: {build_date}\nrelease: {crate_version}\nfeatures: {crate_feature_list}"))
	} else {
		(String::new(), format!("{crate_version} ({build_date}) {crate_feature_string}\nbuild-date: {build_date}\nrelease: {crate_version}\nfeatures: {crate_feature_list}"))
	};

	#[cfg(feature = "std")]
	let long_version_with_fn = r#"
		/// Returns the long version string with extra information tacked on
		///
		/// This is the same as `LONG_VERSION` but takes a slice of key-value pairs to append to the
		/// end in the same format.
		pub fn long_version_with(extra: &[(&str, &str)]) -> String {
			use std::fmt::Write;
			let mut output = Self::LONG_VERSION.to_string();

			for (k, v) in extra {
				write!(&mut output, "\n{k}: {v}").unwrap();
			}

			output
		}
	"#;
	#[cfg(not(feature = "std"))]
	let long_version_with_fn = "";

	let bosion_version = env!("CARGO_PKG_VERSION");
	let render = format!(
		r#"
		/// Build-time information
		///
		/// This struct is generated by the [bosion](https://docs.rs/bosion) crate at build time.
		///
		/// Bosion version: {bosion_version}
		#[derive(Debug, Clone, Copy)]
		{viz} struct {structname};

		#[allow(dead_code)]
		impl {structname} {{
			/// Clap-compatible long version string
			///
			/// At minimum, this will be the crate version and build date.
			///
			/// It presents as a first "summary" line like `crate_version (build_date) features`,
			/// followed by `key: value` pairs. This is the same format used by `rustc -Vv`.
			///
			/// If git info is available, it also includes the git hash, short hash and commit date,
			/// and swaps the build date for the commit date in the summary line.
			pub const LONG_VERSION: &'static str = {long_version:?};

			/// The crate version, as reported by Cargo
			///
			/// You should probably prefer reading the `CARGO_PKG_VERSION` environment variable.
			pub const CRATE_VERSION: &'static str = {crate_version:?};

			/// The crate features
			///
			/// This is a list of the features that were enabled when this crate was built,
			/// lowercased and with underscores replaced by hyphens.
			pub const CRATE_FEATURES: &'static [&'static str] = &{crate_features:?};

			/// The crate features, as a string
			///
			/// This is in format `+feature +feature2 +feature3`, lowercased with underscores
			/// replaced by hyphens.
			pub const CRATE_FEATURE_STRING: &'static str = {crate_feature_string:?};

			/// The build date
			///
			/// This is the date that the crate was built, in the format `YYYY-MM-DD`. If the
			/// environment variable `SOURCE_DATE_EPOCH` was set, it's used instead of the current
			/// time, for [reproducible builds](https://reproducible-builds.org/).
			pub const BUILD_DATE: &'static str = {build_date:?};

			/// The build datetime
			///
			/// This is the date and time that the crate was built, in the format
			/// `YYYY-MM-DD HH:MM:SS`. If the environment variable `SOURCE_DATE_EPOCH` was set, it's
			/// used instead of the current time, for
			/// [reproducible builds](https://reproducible-builds.org/).
			pub const BUILD_DATETIME: &'static str = {build_datetime:?};

			{git_render}

			{long_version_with_fn}
		}}
		"#
	);

	let mut file = File::create(path).expect("bosion");
	file.write_all(render.as_bytes()).expect("bosion");
}

/// Gather build-time information and write it to the environment
///
/// See the crate-level documentation for a guide. This function is a convenience wrapper around
/// [`gather_to_env_with_prefix`] with the most common default prefix of `BOSION_`.
pub fn gather_to_env() {
	gather_to_env_with_prefix("BOSION_");
}

/// Gather build-time information and write it to the environment
///
/// Gathers a limited set of build-time information for the current crate and makes it available to
/// the crate as build environment variables. This is an alternative to [`include!`]ing a file which
/// is generated at build time, like for [`gather`] and variants, which doesn't create any new code
/// and doesn't include any information in the binary that you do not explicitly use.
///
/// The environment variables are prefixed with the given string, which should be generally be
/// uppercase and end with an underscore.
///
/// See [`Info`] for a list of gathered data.
///
/// Unlike [`gather`], there is no Clap-ready `LONG_VERSION` string, but you can of course generate
/// one yourself from the environment variables.
///
/// We also instruct rustc to rerun the build script if the environment changes, as necessary.
pub fn gather_to_env_with_prefix(prefix: &str) {
	let info = Info::gather().expect("bosion");
	info.set_reruns();
	let Info {
		crate_version,
		crate_features,
		build_date,
		build_datetime,
		git,
	} = info;

	println!("cargo:rustc-env={prefix}CRATE_VERSION={crate_version}");
	println!(
		"cargo:rustc-env={prefix}CRATE_FEATURES={}",
		crate_features.join(",")
	);
	println!("cargo:rustc-env={prefix}BUILD_DATE={build_date}");
	println!("cargo:rustc-env={prefix}BUILD_DATETIME={build_datetime}");

	if let Some(GitInfo {
		git_hash,
		git_shorthash,
		git_date,
		git_datetime,
		..
	}) = git
	{
		println!("cargo:rustc-env={prefix}GIT_COMMIT_HASH={git_hash}");
		println!("cargo:rustc-env={prefix}GIT_COMMIT_SHORTHASH={git_shorthash}");
		println!("cargo:rustc-env={prefix}GIT_COMMIT_DATE={git_date}");
		println!("cargo:rustc-env={prefix}GIT_COMMIT_DATETIME={git_datetime}");
	}
}

```

### Core Architecture Module: `crates/cli/src/args.rs`
```
use std::{
	ffi::{OsStr, OsString},
	str::FromStr,
	time::Duration,
};

use clap::{Parser, ValueEnum, ValueHint};
use miette::{IntoDiagnostic, Result, WrapErr};
use tracing::{debug, info, warn};
use tracing_appender::non_blocking::WorkerGuard;

pub(crate) mod command;
pub(crate) mod events;
pub(crate) mod filtering;
pub(crate) mod logging;
pub(crate) mod output;

const OPTSET_COMMAND: &str = "Command";
const OPTSET_DEBUGGING: &str = "Debugging";
const OPTSET_EVENTS: &str = "Events";
const OPTSET_FILTERING: &str = "Filtering";
const OPTSET_OUTPUT: &str = "Output";

include!(env!("BOSION_PATH"));

/// Execute commands when watched files change.
///
/// Recursively monitors the current directory for changes, executing the command when a filesystem
/// change is detected (among other event sources). By default, watchexec uses efficient
/// kernel-level mechanisms to watch for changes.
///
/// At startup, the specified command is run once, and watchexec begins monitoring for changes.
///
/// Events are debounced and checked using a variety of mechanisms, which you can control using
/// the flags in the **Filtering** section. The order of execution is: internal prioritisation
/// (signals come before everything else, and SIGINT/SIGTERM are processed even more urgently),
/// then file event kind (`--fs-events`), then files explicitly watched with `-w`, then ignores
/// (`--ignore` and co), then filters (which includes `--exts`), then filter programs.
///
/// Examples:
///
/// Rebuild a project when source files change:
///
///   $ watchexec make
///
/// Watch all HTML, CSS, and JavaScript files for changes:
///
///   $ watchexec -e html,css,js make
///
/// Run tests when source files change, clearing the screen each time:
///
///   $ watchexec -c make test
///
/// Launch and restart a node.js server:
///
///   $ watchexec -r node app.js
///
/// Watch lib and src directories for changes, rebuilding each time:
///
///   $ watchexec -w lib -w src make
#[derive(Debug, Clone, Parser)]
#[command(
	name = "watchexec",
	bin_name = "watchexec",
	author,
	version,
	long_version = Bosion::LONG_VERSION,
	after_help = "Want more detail? Try the long '--help' flag!",
	after_long_help = "Use @argfile as first argument to load arguments from the file 'argfile' (one argument per line) which will be inserted in place of the @argfile (further arguments on the CLI will override or add onto those in the file).\n\nDidn't expect this much output? Use the short '-h' flag to get short help.",
	hide_possible_values = true,
)]
pub struct Args {
	/// Command (program and arguments) to run on changes
	///
	/// It's run when events pass filters and the debounce period (and once at startup unless
	/// '--postpone' is given). If you pass flags to the command, you should separate it with --
	/// though that is not strictly required.
	///
	/// Examples:
	///
	///   $ watchexec -w src npm run build
	///
	///   $ watchexec -w src -- rsync -a src dest
	///
	/// Take care when using globs or other shell expansions in the command. Your shell may expand
	/// them before ever passing them to Watchexec, and the results may not be what you expect.
	/// Compare:
	///
	///   $ watchexec echo src/*.rs
	///
	///   $ watchexec echo 'src/*.rs'
	///
	///   $ watchexec --shell=none echo 'src/*.rs'
	///
	/// Behaviour depends on the value of '--shell': for all except 'none', every part of the
	/// command is joined together into one string with a single ascii space character, and given to
	/// the shell as described in the help for '--shell'. For 'none', each distinct element the
	/// command is passed as per the execvp(3) convention: first argument is the program, as a path
	/// or searched for in the 'PATH' environment variable, rest are arguments.
	#[arg(
		trailing_var_arg = true,
		num_args = 1..,
		value_hint = ValueHint::CommandString,
		value_name = "COMMAND",
		required_unless_present_any = ["completions", "manual", "only_emit_events"],
	)]
	pub program: Vec<String>,

	/// Show the manual page
	///
	/// This shows the manual page for Watchexec, if the output is a terminal and the 'man' program
	/// is available. If not, the manual page is printed to stdout in ROFF format (suitable for
	/// writing to a watchexec.1 file).
	#[arg(
		long,
		conflicts_with_all = ["program", "completions", "only_emit_events"],
		display_order = 130,
	)]
	pub manual: bool,

	/// Generate a shell completions script
	///
	/// Provides a completions script or configuration for the given shell. If Watchexec is not
	/// distributed with pre-generated completions, you can use this to generate them yourself.
	///
	/// Supported shells: bash, elvish, fish, nu, powershell, zsh.
	#[arg(
		long,
		value_name = "SHELL",
		conflicts_with_all = ["program", "manual", "only_emit_events"],
		display_order = 30,
	)]
	pub completions: Option<ShellCompletion>,

	/// Only emit events to stdout, run no commands.
	///
	/// This is a convenience option for using Watchexec as a file watcher, without running any
	/// commands. It is almost equivalent to using `cat` as the command, except that it will not
	/// spawn a new process for each event.
	///
	/// This option implies `--emit-events-to=json-stdio`; you may also use the text mode by
	/// specifying `--emit-events-to=stdio`.
	#[arg(
		long,
		conflicts_with_all = ["program", "completions", "manual"],
		display_order = 150,
	)]
	pub only_emit_events: bool,

	/// Testing only: exit Watchexec after the first run and return the command's exit code
	#[arg(short = '1', hide = true)]
	pub once: bool,

	#[command(flatten)]
	pub command: command::CommandArgs,

	#[command(flatten)]
	pub events: events::EventsArgs,

	#[command(flatten)]
	pub filtering: filtering::FilteringArgs,

	#[command(flatten)]
	pub logging: logging::LoggingArgs,

	#[command(flatten)]
	pub output: output::OutputArgs,
}

#[derive(Clone, Copy, Debug)]
pub struct TimeSpan<const UNITLESS_NANOS_MULTIPLIER: u64 = { 1_000_000_000 }>(pub Duration);

impl<const UNITLESS_NANOS_MULTIPLIER: u64> FromStr for TimeSpan<UNITLESS_NANOS_MULTIPLIER> {
	type Err = humantime::DurationError;

	fn from_str(s: &str) -> Result<Self, Self::Err> {
		s.parse::<u64>()
			.map_or_else(
				|_| humantime::parse_duration(s),
				|unitless| {
					if unitless != 0 {
						eprintln!("Warning: unitless non-zero time span values are deprecated and will be removed in an upcoming version");
					}
					Ok(Duration::from_nanos(unitless * UNITLESS_NANOS_MULTIPLIER))
				},
			)
			.map(TimeSpan)
	}
}

fn expand_args_up_to_doubledash(args: impl IntoIterator<Item = OsString>) -> Result<Vec<OsString>> {
	use argfile::Argument;
	use std::collections::VecDeque;

	let args = args.into_iter();
	let mut expanded_args = Vec::with_capacity(args.size_hint().0);

	let mut todo: VecDeque<_> = args.map(|a| Argument::parse(a, argfile::PREFIX)).collect();
	while let Some(next) = todo.pop_front() {
		match next {
			Argument::PassThrough(arg) => {
				expanded_args.push(arg.clone());
				if arg == "--" {
					break;
				}
			}
			Argument::Path(path) => {
				let content = std::fs::read_to_string(&path)
					.into_diagnostic()
					.wrap_err_with(|| format!("while expanding @argfile {}", path.display()))?;
				let new_args = argfile::parse_fromfile(&content, argfile::PREFIX);
				todo.reserve(new_args.len());
				for (i, arg) in new_args.into_iter().enumerate() {
					todo.insert(i, arg);
				}
			}
		}
	}

	while let Some(next) = todo.pop_front() {
		expanded_args.push(match next {
			Argument::PassThrough(arg) => arg,
			Argument::Path(path) => {
				let path = path.as_os_str();
				let mut restored = OsString::with_capacity(path.len() + 1);
				restored.push(OsStr::new("@"));
				restored.push(path);
				restored
			}
		});
	}
	Ok(expanded_args)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum ShellCompletion {
	Bash,
	Elvish,
	Fish,
	Nu,
	Powershell,
	Zsh,
}

#[derive(Debug, Default)]
pub struct Guards {
	_log: Option<WorkerGuard>,
}

pub async fn get_args() -> Result<(Args, Guards)> {
	let prearg_logs = logging::preargs();
	if prearg_logs {
		warn!(
			"⚠ WATCHEXEC_LOG environment variable set or hardcoded, logging options have no effect"
		);
	}

	debug!("expanding @argfile arguments if any");
	let args = expand_args_up_to_doubledash(std::env::args_os())?;

	debug!("parsing arguments");
	let mut args = Args::parse_from(args);

	let _log = if !prearg_logs {
		logging::postargs(&args.logging).await?
	} else {
		None
	};

	args.output.normalise()?;
	args.command.normalise().await?;
	args.filtering.normalise(&args.command).await?;
	args.events
		.normalise(&args.command, &args.filtering, args.only_emit_events)?;

	info!(?args, "got arguments");
	Ok((args, Guards { _log }))
}

#[test]
fn verify_cli() {
	use clap::CommandFactory;
	Args::command().debug_assert()
}

#[cfg(test)]
fn argfile_arg(path: &std::path::Path) -> OsString {
	let mut arg = OsString::from("@");
	arg.push(path);
	arg
}

#[test]
fn argfile_is_expanded_up_to_doubledash() {
	let dir = tempfile::tempdir().unwrap();
	let argfile = dir.path().join("argfile");
	std::fs::write(&argfile, "-1\n--postpone\n").unwrap();

	let expanded = expand_args_up_to_doubledash([
		"watchexec".into(),
		argfile_arg(&argfile),
		"--".into(),
		argfile_arg(&argfile),
	])
	.unwrap();

	assert_eq!(
		expanded,
		[
			OsString::from("watchexec"),
			"-1".into(),
			"--postpone".into(),
			"--".into(),
			argfile_arg(&argfile),
		]
	);
}

#[test]
fn unreadable_argfile_is_an_error() {
	let dir = tempfile::tempdir().unwrap();
	let missing = dir.path().join("missing");
	let not_utf8 = dir.path().join("not-utf8");
	std::fs::write(&not_utf8, b"\xff\xfe\n").unwrap();

	for path in [missing, not_utf8] {
		let err = expand_args_up_to_doubledash([
			"watchexec".into(),
			argfile_arg(&path),
			"--".into(),
			"echo".into(),
		])
		.expect_err("an unreadable argfile should be an error, not a panic");
		assert_eq!(
			err.to_string(),
			format!("while expanding @argfile {}", path.display())
		);
	
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1131** (2026-10-05): **Watching "jj log" with "less" as pager shows no output without "--wrap-process=none"**
  *Symptoms*: ### Watchexec version  watchexec 2.7.3 (2026-09-30) +pid1  ### OS and version (if applicable)  Debian 13.7 (aka. Trixie, slim)  ### Problem you're having  ## Setup  Start with a git repo and JJ (the Jujutsu VCS tool) installed. To set up something minimal and repeatable, I did this in a Debian/Rust container with:  ```console $ podman run --rmi --rm -it docker.io/rust:1.98.1-slim-trixie ```  Then I ran the following setup commands:  ```bash export DEBIAN_FRONTEND=noninteractive apt-get update -y -q apt-get -y -q --no-install-recommends install git less  cargo install --locked jj-cli watchexec-cli  mkdir ~/watchexec-test cd ~/watchexec-test jj git clone https://github.com/watchexec/watchexec.git . ```  ## Repro  (The attached log file starts from here and is just console output, not via `--log-file`, because there were multiple commands. I'd usually use `--clear --quiet` but have omitted those to keep the output.)  In the repository directory, if I do:  ```console $ watchexec -vvv --restart --wrap-process=none --shell=none --watch=.jj/repo --watch=. jj log ```  ...I see the `jj log` output as expected.  If I do:  ```console $ watchexec -vvv --restart --shell=none --watch=.jj/repo --watch=. jj log ```  There is no log output, and using <kbd>CTRL</kbd>-<kbd>C</kbd> to stop watching uses the 10s delay.  If I disable the pager in JJ, I see the output again:  ```console $ watchexec -vvv --restart --shell=none --watch=.jj/repo --watch=. jj log --no-pager ```  It might just be that c

- **Issue #1113** (2026-09-15): **v2.6.1+ Windows Issue: No such file or directory (os error 2)**
  *Symptoms*: **What used to happen** ` watchexec -w [folder] ...` worked without any issue.  **What happens now** ` watchexec -w [folder] ...` no longer works when called out of ~. (calling from ~/Downloads, ~/Documents, and their children don't work, but it seems they can be pointed at from ~)  **Details** - Latest version that worked: 2.5.1 - Earliest version that doesn't: 2.6.1 (corporate proxy doesn't let me install 2.6.0 through Scoop, but if needed, I could try to bypass it by a normal download here) - OS: Windows 11 Professional 25H2 - A debug log with `-vvv --log-file`:  There is no debug output. ``` ❯ eza -D Microsoft.WindowsTerminal_1.23.13503.0_x64 [...]  Javadam  RapidEEx64 [...]  Zotero-bib  ❯ watchexec.exe -w .\Javadam\ echo "boop" -vvv --log-file stuff.log Error:   × Le fichier spécifié est introuvable. (os error 2)  ❌1 ❯ cat stuff.log Get-Content: Cannot find path 'C:\Users\user\Downloads\stuff.log' because it does not exist. ```  Seems to be a sister issue to #765, but it seems like it was fixed in v2.7, not v2.6...
  **Post-Mortem & Fix Analysis**:
  > ...welp, seeing the lack of *bug* label, I guess *regression* wasn't the right template
  > Can you try 2.7? By manual download if needed
  > I tried 7.1, 7, 6.1, and got the same result and lack of outputs and logs. I'm only missing 6.0.  I forgot to mention I have a fairly extensive .fdignore file in ~/Documents, but I doubt it should impact watchexec?  (I won't be able to do any more tests until Monday, unfortunately)  ________________________________ From: Félix Saparelli ***@***.***> Sent: Friday, 11 September 2026 11:41:39 To: watchexec/watchexec ***@***.***> Cc: Prometheos2 ***@***.***>; Author ***@***.***> Subject: Re: [watchexec/watchexec] v2.6.1+ Windows Issue: No such file or directory (os error 2) (Issue #1113)  [https://avatars.githubusercontent.com/u/155787?s=20&v=4]passcod left a comment (watchexec/watchexec#1113)<https://github.com/watchexec/watchexec/issues/1113#issuecomment-5632558920>  Can you try 2.7? By manual download if needed  — Reply to this email directly, view it on GitHub<https://github.com/watchexec/watchexec/issues/1113?email_source=notifications&email_token=AK4GZCINCHGH6667OUO

- **Issue #1112** (2026-09-15): **watchexec startup consumes more cpu time than expected, with large number of files**
  *Symptoms*: I'm using watchexec 2.7.0 on Arch Linux. For many years I've used watchexec as a component in https://github.com/radian-software/straight.el, to detect package source code modifications and mark affected packages to be rebuilt later. Recently, I've noticed some strange performance behavior from watchexec. I believe either this is a regression, or I was exceptionally unobservant in the past years I was using watchexec.  To reproduce, consider a directory with N copies of a sample Git repository (MELPA):  ``` git clone https://github.com/melpa/melpa.git melpa-01 # cp melpa-01 melpa-02 # cp melpa-01 melpa-03 # ... ```  When I run `watchexec ls`, watchexec immediately consumes 100% cpu and stays stuck there for a bit before going to idle and behaving normally. But the amount of time it stays consuming that CPU scales more than linearly with the amount of contents to scan:  * One copy of MELPA - 5 seconds * Two copies of MELPA - 17 seconds * Three copies of MELPA - 35 seconds * Four copies of MELPA - 63 seconds  In fact, the scaling is almost exponential, which doesn't seem right at all to me.  For comparison, computing a hash of all file contents using `find . -type f | xargs sha1sum | sha1sum` only takes less than 500ms, even with ten copies of MELPA to scan.  I additionally notice one or more copies of this message printed to the console:  ``` [[Error (not fatal)]] Native fs watcher error ```  I've attached a log file here: [watchexec.log](https://github.com/user-attachments/fi
  **Post-Mortem & Fix Analysis**:
  > Yeah, 2.7.0 rewrote the file recursion, mostly to the benefit of performance, but is expected to have some new bugs. I'll take a look at your log file and MELPA to see what's pathological about that workload. And thank you for the very detailed bug report and your support of the project :)  The latest in 2.6.x is essentially the same in features at this point, so you can downgrade as a temporary workaround.
  > Alright, got it :) Testing mostly focuses on deep trees with few files at each level, as that was previously the most problematic cases; MELPA has 6k files flat in a directory, and there was a quadratic behaviour there which that got exacerbated by that structure. Will be in 2.7.3 this afternoon.
  > I've upgraded, and it looks much better now! No more audible CPU fan whenever I start Emacs :P  Thanks so much.

- **Issue #1050** (2026-07-30): **broken for windows with nushell**
  *Symptoms*: **Problem**: `watchexec -e rs -- cargo build` doesn't work *on windows* with nushell.  **Why?** The following bit in `crates/supervisor/src/command/conversions.rs` executes on windows only ```rust 				// Avoid quoting issues on Windows by using raw_arg everywhere 				#[cfg(windows)] 				{ 					for opt in &shell.options { 						c.raw_arg(opt); 					} 					if let Some(progopt) = &shell.program_option { 						c.raw_arg(progopt); 					} 					c.raw_arg(command); 					for arg in args { 						c.raw_arg(arg); 					} 				} ```  The problem boils down basically to `nu -c cargo build` not doing what you would expect but instead one needs to execute `nu -c "cargo build"`  **Logs** Tested with latest master (9d8e344)  The following can be seen ``` nu cargo r -- -vvvv --shell none cargo build 2026-05-28T07:07:44.646105Z TRACE watchexec_supervisor::command::conversions: constructing command, program: Exec { prog: "cargo", args: ["build"] }  cargo r -- -vvvv cargo build 2026-05-28T07:04:57.190261Z TRACE watchexec_supervisor::command::conversions: constructing command, program: Shell { shell: Shell { prog: "nu", options: [], program_option: Some("-c") }, command: "cargo build", args: [] } ```  **NOTE**: nushell defines the `SHELL` environment variable  **Workaround**: Use the `--shell none` flag 
  **Post-Mortem & Fix Analysis**:
  > Yeah, I see it. I'm not really sure what to do about it. Adding an exception for nushell feels bad (probably not gonna be the only case). Making powershell and cmd exceptions also feels bad (same reason, inverted). We can't not use `raw_args` because quoting sucks on Windows.
  > I understand, I don't have any good suggestion, maybe a `compat.rs` file where this kind of stuff could be consolidated... not sure.  For the time being I added `export alias watchexec = watchexec --shell none` to my config on windows, this works well with the completions you offer with `watchexec --completions nu`  Feel free to close this issue  Thanks for the great package. 

- **Issue #1037** (2026-03-25): **Can't install from cargo**
  *Symptoms*: When running `cargo install watchexec-cli` for version `2.5.0` on FreeBSD `15.0-RELEASE-p4`, I got this error ```console error[E0658]: use of unstable library feature `debug_closure_helpers`    --> /home/ll/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/watchexec-cli-2.5.0/src/config.rs:818:2     | 818 |     fmt::from_fn(move |f| {     |     ^^^^^^^^^^^^     |     = note: see issue #117729 <https://github.com/rust-lang/rust/issues/117729> for more information  For more information about this error, try `rustc --explain E0658`. warning: watchexec-cli@2.5.0: git info gathering failed: no git repository found error: could not compile `watchexec-cli` (lib) due to 1 previous error warning: build failed, waiting for other jobs to finish... error: failed to compile `watchexec-cli v2.5.0`, intermediate artifacts can be found at `/tmp/cargo-install8hJGCT`. To reuse those artifacts with a future compilation, set the environment variable `CARGO_TARGET_DIR` to that path. ```
  **Post-Mortem & Fix Analysis**:
  > Upgrade your rustc. Only the latest Rust stable is supported, and fmt::from_fn landed in 1.93.0 stable.

- **Issue #1017** (2026-02-22): **Interactive mode `(q)uit` only quits when I press enter**
  *Symptoms*: After rsync runs, both `(p)ause` and `(r)estart` work. But `(q)uit` doesn't do anything until I press enter.  After I press `q`, any further keypresses (including `p` and `r`) appear on-screen.  Sample command:  ```fish watchexec --interactive -- 'echo test' ```  [watchexec.2026-02-22T13-57-32Z.log](https://github.com/user-attachments/files/25468973/watchexec.2026-02-22T13-57-32Z.log)  In the log, I waited about 3 seconds after rsync completed, pressed `q`, then waited another 3 seconds before pressing enter.  ---  watchexec 2.4.0 (2100d0b4 2026-02-22) +pid1 OS: macOS Sequoia 15.7.4 Shell: fish 4.5.0
  **Post-Mortem & Fix Analysis**:
  > Does it work with simpler commands or do you have sthe same bug?
  > I updated the issue with a simpler command and log file.
  > Your first log was showing this sequence of events:   - 13:14:11.138260Z — Watchexec starts  - 13:14:11.156342Z — Command starts  - 13:14:11.848061Z — Command completes  - 13:14:15.278722Z — Interactive quit detected (ie `q` is pressed)  - 13:14:15.278764Z — Graceful quit initiated  - 13:14:15.278894Z — Internal workers finish  - 13:14:15.281076Z — Watchexec stops  Your second log:   - 13:57:32.345492Z — Watchexec starts  - 13:57:32.377181Z — Command starts  - 13:57:32.434021Z — Command completes  - 13:57:36.002418Z — Interactive quit detected (ie `q` is pressed)  - 13:57:36.002465Z — Graceful quit initiated  - 13:57:36.002634Z — Internal workers finish  - 13:57:36.004602Z — Watchexec stops  So by the time you're pressing enter, Watchexec has long since exited.  I think what's happening is that Watchexec is working as intended, but your shell is not quite recovering after it quits, and doesn't re-render your prompt until you hit enter.  To test that, can you do  ``` watchexec -I date; 

- **Issue #983** (2025-12-11): **Can't install on Ubuntu 24.04 LTS**
  *Symptoms*: I've just checked packages on https://github.com/watchexec/watchexec/blob/main/doc/packages.md For ubuntu there are specified repo https://apt.cli.rs/  When i try open this URL in browser or CURL the URL is never loads (infinity loading state). After some time i got "504 Gateway Time-out" error.  So I cannot to install a wetchexec on LTS Ubuntu.
  **Post-Mortem & Fix Analysis**:
  > You can use one of the other ways to install watchexec, such as: - the first-party deb packages: https://github.com/watchexec/watchexec/releases/tag/v2.3.2 - tarballs: https://github.com/watchexec/watchexec/releases/tag/v2.3.2 - from source  I've marked apt.cli.rs as defunct since it seems it's permanently down.
  > @passcod there are bad UX when i go on release page and see something like ` watchexec-2.3.2-aarch64-unknown-linux-musl.deb`  As an active Linux consumer I don't know what it does mean. I can suppose there are namespace + architecture + "unknown-linux" that does not mean anything + used compiler.  But I have no idea what compiler uses my LTS Ubuntu.  Also it is not clear how I can ensure the package is up to date.  My feedback is watchexec UX are bad, because I use the most popular Linux distributive and I can't even install this package quick. It feels the watchexec is built for the nerds who looks as bad as Linus Torvalds looks like at 55, because they spent their whole live on configuring anything in Linux, instead of live a real life.  I think as software developers we should **simplify** our software usage and **minimize** required actions to make user happy.  To try the `watchexec` I had ask ChatGPT, then install a `cargo` and `rustup`, then run `cargo install --locked watchexec-
  > You understand I don't get paid for this, yeah? Go away.

- **Issue #967** (2026-08-25): **Panicked on FreeBSD**
  *Symptoms*: `watchexec` panicked multiple times when I using this command `watchexec --exts=c --restart --clear -- 'clang -o$(uname -n) ./main.c && ./$(uname -n)'`  watchexec log: ```console {"timestamp":"2025-10-09T17:32:29.886189Z","level":"INFO","fields":{"message":"logging initialised"},"target":"watchexec_cli::args::logging"} {"timestamp":"2025-10-09T17:32:29.886387Z","level":"INFO","fields":{"message":"effective working directory","path":"\"/temp\""},"target":"watchexec_cli::args::command"} {"timestamp":"2025-10-09T17:32:29.886477Z","level":"DEBUG","fields":{"message":"home directory","homedir":"Some(\"/\")"},"target":"watchexec_cli::dirs"} {"timestamp":"2025-10-09T17:32:29.886489Z","level":"DEBUG","fields":{"message":"resolved whether the homedir is explicitly requested","homedir_requested":"false"},"target":"watchexec_cli::dirs"} {"timestamp":"2025-10-09T17:32:29.886494Z","level":"DEBUG","fields":{"message":"no origins, using current directory"},"target":"watchexec_cli::dirs"} {"timestamp":"2025-10-09T17:32:29.886501Z","level":"DEBUG","fields":{"message":"resolved all project origins","origins":"{\"/temp\"}"},"target":"watchexec_cli::dirs"} {"timestamp":"2025-10-09T17:32:29.886531Z","level":"DEBUG","fields":{"message":"resolved common/project origin","project_origin":"\"/temp\""},"target":"watchexec_cli::dirs"} {"timestamp":"2025-10-09T17:32:29.886538Z","level":"DEBUG","fields":{"message":"resolved project origin","path":"\"/temp\""},"target":"watchexec_cli::args::filtering"} {"t
  **Post-Mortem & Fix Analysis**:
  > Sounds like a [notify](https://github.com/notify-rs/notify) or [kqueue crate](https://gitlab.com/rust-kqueue/rust-kqueue) bug
  > Encountered again with  ``` watchexec 2.5.0 (2026-03-26) +pid1 build-date: 2026-03-26 release: 2.5.0 features: default,pid1 ```  ``` FreeBSD localhost 15.0-RELEASE-p5 FreeBSD 15.0-RELEASE-p5 GENERIC amd64 ```
  > Still an upstream issue

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

### Incident Patch 1: `3479df1c` (2026-10-04)
**Commit Message**: fix(supervisor): take the command state mutably when resuming a pause

TestChild::id() takes &mut self, so resuming a paused command under the test
configuration failed to compile; missed because cargo check and clippy without
--all-targets do not compile the test configuration.

**File**: `crates/supervisor/src/job/task.rs` (modified, +6/-6)
```diff
@@ -238,7 +238,7 @@ pub fn start_job(command: Arc<Command>) -> (Job, JoinHandle<()>) {
 								}
 								Control::Stop => {
 									#[cfg(unix)]
-									resume_paused_command(&mut paused, &command_state);
+									resume_paused_command(&mut paused, &mut command_state);
 									#[cfg(unix)]
 									{
 										end_pause_watch(&mut pause_watch);
@@ -271,7 +271,7 @@ pub fn start_job(command: Arc<Command>) -> (Job, JoinHandle<()>) {
 								}
 								Control::GracefulStop { signal, grace } => {
 									#[cfg(unix)]
-									resume_paused_command(&mut paused, &command_state);
+									resume_paused_command(&mut paused, &mut command_state);
 									if let CommandState::Running { child, .. } = &mut command_state {
 										try_with_handler!(signal_child(signal, child).await);
 
@@ -283,7 +283,7 @@ pub fn start_job(command: Arc<Command>) -> (Job, JoinHandle<()>) {
 								}
 								Control::TryRestart => {
 									#[cfg(unix)]
-									resume_paused_command(&mut paused, &command_state);
+									resume_paused_command(&mut paused, &mut command_state);
 									#[cfg(unix)]
 									{
 										end_pause_watch(&mut pause_watch);
@@ -342,7 +342,7 @@ pub fn start_job(command: Arc<Command>) -> (Job, JoinHandle<()>) {
 								}
 								Control::TryGracefulRestart { signal, grace } => {
 									#[cfg(unix)]
-									resume_paused_command(&mut paused, &command_state);
+									resume_paused_command(&mut paused, &mut command_state);
 									if let CommandState::Running { child, .. } = &mut command_state {
 										try_with_handler!(signal_child(signal, child).await);
 
@@ -358,7 +358,7 @@ pub fn start_job(command: Arc<Command>) -> (Job, JoinHandle<()>) {
 									trace!("continuing a graceful try-restart");
 
 									#[cfg(unix)]
-									resume_paused_command(&mut paused, &command_state);
+									resume_paused_command(&mut paused, &mut command_state);
 									#[cfg(unix)]
 									{
 										end_pause_watch(&mut pause_watch);
@@ -784,7 +784,7 @@ fn try_grant_foreground(foreground_grant: &mut Option<ForegroundGrant>, pgrp: Pi
 /// restarting a paused command must continue it first for graceful termination to work at
 /// all; without this, a graceful stop of a paused command pends until the force-kill timeout.
 #[cfg(unix)]
-fn resume_paused_command(paused: &mut Option<i32>, command_state: &CommandState) {
+fn resume_paused_command(paused: &mut Option<i32>, command_state: &mut CommandState) {
 	if paused.take().is_none() {
 		return;
 	}
```

---

### Incident Patch 2: `40bd2dd0` (2026-10-04)
**Commit Message**: fix docs

**File**: `completions/bash` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ _watchexec() {
                     return 0
                     ;;
                 --wrap-process)
-                    COMPREPLY=($(compgen -W "group session none" -- "${cur}"))
+                    COMPREPLY=($(compgen -W "auto group session none" -- "${cur}"))
                     return 0
                     ;;
                 --stop-signal)
```

**File**: `completions/fish` (modified, +2/-1)
```diff
@@ -6,7 +6,8 @@ powershell\t''
 zsh\t''"
 complete -c watchexec -l shell -d 'Use a different shell' -r
 complete -c watchexec -s E -l env -d 'Add env vars to the command' -r
-complete -c watchexec -l wrap-process -d 'Configure how the process is wrapped' -r -f -a "group\t''
+complete -c watchexec -l wrap-process -d 'Configure how the process is wrapped' -r -f -a "auto\t''
+group\t''
 session\t''
 none\t''"
 complete -c watchexec -l stop-signal -d 'Signal to send to stop the command' -r
```

**File**: `completions/nu` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ module completions {
   }
 
   def "nu-complete watchexec wrap_process" [] {
-    [ "group" "session" "none" ]
+    [ "auto" "group" "session" "none" ]
   }
 
   def "nu-complete watchexec on_busy_update" [] {
```

**File**: `completions/zsh` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ _watchexec() {
 '--shell=[Use a different shell]:SHELL:_default' \
 '*-E+[Add env vars to the command]:KEY=VALUE:_default' \
 '*--env=[Add env vars to the command]:KEY=VALUE:_default' \
-'--wrap-process=[Configure how the process is wrapped]:MODE:(group session none)' \
+'--wrap-process=[Configure how the process is wrapped]:MODE:(auto group session none)' \
 '--stop-signal=[Signal to send to stop the command]:SIGNAL:_default' \
 '--stop-timeout=[Time to wait for the command to exit gracefully]:TIMEOUT:_default' \
 '--timeout=[Kill the command if it runs longer than this duration]:TIMEOUT:_default' \
```

**File**: `crates/cli/src/args/command.rs` (modified, +15/-5)
```diff
@@ -140,7 +140,21 @@ pub struct CommandArgs {
 
 	/// Configure how the process is wrapped
 	///
-	/// TODO(docs): rewrite for the 'auto' default and terminal foreground handling.
+    /// By default (mode 'auto'), Watchexec will run the command in a session on Mac, in a process
+	/// group in Unix, and in a Job Object in Windows.
+	///
+	/// Some Unix programs prefer running in a session, while others do not work in a process group.
+	/// Additionally, on Unix in 'auto' mode, Watchexec will detect when a program needs to be the
+	/// foreground process to handle terminal input, and grant that temporarily. This is the case
+	/// for many pagers and interactive programs. To opt-out, specify an explicit mode as needed.
+	///
+	/// Use 'group' to use a process group, 'session' to use a process session, and 'none' to run
+	/// the command directly. On Windows, either of 'group' or 'session' will use a Job Object.
+	///
+	/// If you find you need to specify this frequently for different kinds of programs, file an
+	/// issue at <https://github.com/watchexec/watchexec/issues>. As errors of this nature are hard to
+	/// debug and can be highly environment-dependent, reports from *multiple affected people* are
+	/// more likely to be actioned promptly. Ask your friends/colleagues!
 	#[arg(
 		long,
 		help_heading = OPTSET_COMMAND,
@@ -322,14 +336,10 @@ impl CommandArgs {
 
 #[derive(Clone, Copy, Debug, Default, ValueEnum)]
 pub enum WrapMode {
-	/// TODO(docs)
 	#[default]
 	Auto,
-	/// TODO(docs)
 	Group,
-	/// TODO(docs)
 	Session,
-	/// TODO(docs)
 	None,
 }
 
```

**File**: `crates/cli/src/config.rs` (modified, +0/-6)
```diff
@@ -1184,18 +1184,13 @@ fn interpret_command_args(args: &Args) -> Result<Arc<Command>> {
 		}
 	};
 
-	// 'auto' resolves to the platform default wrap; the explicit modes are the pre-'auto'
-	// behaviours, exactly as they were
 	let (grouped, session) = match args.command.wrap_process {
 		WrapMode::Auto => (!cfg!(target_os = "macos"), cfg!(target_os = "macos")),
 		WrapMode::Group => (true, false),
 		WrapMode::Session => (false, true),
 		WrapMode::None => (false, false),
 	};
 
-	// Watchexec and the command cannot both read the terminal: keyboard event sources put
-	// Watchexec itself in raw mode, so the command does not get the foreground in that case.
-	// Note this only matters for the foreground *grant*: stop observation is harmless.
 	let terminal_free_for_command = !(args.events.stdin_quit || args.events.interactive);
 
 	let grant_foreground = cfg!(unix)
@@ -1529,7 +1524,6 @@ fn format_duration(duration: Duration) -> impl fmt::Display {
 	})
 }
 
-/// Print a one-line notice about a command being stopped by, or granted, the terminal.
 fn print_stop_notice(event: StopEvent, outflags: OutputFlags) {
 	if outflags.quiet {
 		return;
```

**File**: `crates/supervisor/src/command.rs` (modified, +23/-2)
```diff
@@ -78,9 +78,30 @@ pub struct SpawnOptions {
 	/// This is only supported on Unix systems.
 	pub reset_sigmask: bool,
 
-	/// TODO(docs): Unix-only terminal stop observation and reporting via the stop hook.
+	/// Watch the process for terminal pauses (SIGTTIN or SIGTTOU).
+	///
+	/// When enabled, we observe the running process and fire the
+	/// [pause hook](crate::job::Job::set_pause_hook) when it's paused by the kernel using the
+	/// terminal control signals (SIGTTIN or SIGTTOU), which are delivered when a background job
+	/// attempts to read from or change the terminal (termios) while not in the foreground process
+	/// group, or the terminal suspend signal (SIGTSTP) when it is suspended from the terminal.
+	///
+	/// Does nothing when the process is `grouped: false` or `session: true`, since those signals
+	/// don't occur in those states.
+	///
+	/// This is only supported on Unix systems.
 	pub observe_stops: bool,
 
-	/// TODO(docs): Unix-only terminal foreground grant; implies `observe_stops`.
+	/// Give the process terminal foreground control when it asks.
+	///
+	/// When enabled, [when a pause is observed](Self::observe_pauses), we give the process group
+	/// foreground control, resume the process, and take foreground back when the process ends.
+	///
+	/// This makes pagers and interactive programs work under process groups, without giving up
+	/// wrapping altogether.
+	///
+	/// Implies `observe_stops: true`.
+	///
+	/// This is only supported on Unix systems.
 	pub grant_foreground: bool,
 }
```

**File**: `crates/supervisor/src/foreground.rs` (modified, +0/-22)
```diff
@@ -1,24 +1,3 @@
-//! Grant and reclaim the controlling terminal's foreground process group.
-//!
-//! Programs which interact with the terminal — pagers, full-screen programs, password prompts —
-//! require their process group to be the foreground process group of the controlling terminal.
-//! The kernel stops a background process with SIGTTIN when it reads the terminal, and with
-//! SIGTTOU when it changes the terminal state (which a pager does to switch the terminal in and
-//! out of raw mode before writing anything), so such programs freeze without the foreground.
-//!
-//! This module implements a just-in-time foreground grant: when the supervisor observes that a
-//! wrapped command was stopped by SIGTTIN or SIGTTOU, it gives the command's process group the
-//! foreground of the controlling terminal, exactly as a job control shell would, and continues
-//! the stopped command. The foreground is reclaimed and the terminal state restored when the
-//! run ends.
-//!
-//! Note that `tcsetpgrp` and termios changes are themselves subject to the same foreground
-//! check (`tiocspgrp` runs `tty_check_change`), which for a backgrounded, orphaned caller
-//! surfaces as `ENOTTY`. Every terminal operation in this module therefore temporarily sets
-//! SIGTTOU to ignored, under which the kernel permits background terminal changes; the
-//! previous disposition is restored immediately after. The ignore is never active across a
-//! spawn, so commands always inherit default signal dispositions.
-
 use std::{fs::File, os::fd::OwnedFd};
 
 use nix::{
@@ -84,7 +63,6 @@ impl ForegroundGrant {
 	}
 }
 
-/// Open the controlling terminal, if there is one.
 fn open_controlling_tty() -> Result<OwnedFd, Errno> {
 	File::options()
 		.read(true)
```

---

### Incident Patch 3: `4d559a0a` (2026-10-05)
**Commit Message**: fix(docs): preserve apostrophes in generated markdown manual (#1140)

**File**: `bin/manpage` (modified, +5/-1)
```diff
@@ -1,3 +1,7 @@
 #!/bin/sh
 cargo run -p watchexec-cli -- --manual > doc/watchexec.1
-pandoc doc/watchexec.1 -t markdown > doc/watchexec.1.md
+# clap-mangen escapes apostrophes as \*(Aq (a groff string defined in the
+# page header). pandoc's man reader doesn't resolve that string, so the
+# apostrophes silently vanish from the markdown (see #1137). Expand it to
+# the plain \(aq escape first, which pandoc renders correctly.
+sed 's/\\\*(Aq/\\(aq/g' doc/watchexec.1 | pandoc -f man -t markdown > doc/watchexec.1.md
```

**File**: `doc/watchexec.1.md` (modified, +147/-147)
```diff
@@ -88,7 +88,7 @@ Supported shells: bash, elvish, fish, nu, powershell, zsh.
 :   Show the manual page
 
 This shows the manual page for Watchexec, if the output is a terminal
-and the man program is available. If not, the manual page is printed to
+and the 'man' program is available. If not, the manual page is printed to
 stdout in ROFF format (suitable for writing to a watchexec.1 file).
 
 **\--only-emit-events**
@@ -105,7 +105,7 @@ the text mode by specifying \`\--emit-events-to=stdio\`.
 
 **-h**, **\--help**
 
-:   Print help (see a summary with -h)
+:   Print help (see a summary with '-h')
 
 **-V**, **\--version**
 
@@ -115,8 +115,8 @@ the text mode by specifying \`\--emit-events-to=stdio\`.
 
 :   Command (program and arguments) to run on changes
 
-Its run when events pass filters and the debounce period (and once at
-startup unless \--postpone is given). If you pass flags to the command,
+It's run when events pass filters and the debounce period (and once at
+startup unless '\--postpone' is given). If you pass flags to the command,
 you should separate it with \-- though that is not strictly required.
 
 Examples:
@@ -131,16 +131,16 @@ the results may not be what you expect. Compare:
 
 \$ watchexec echo src/\*.rs
 
-\$ watchexec echo src/\*.rs
+\$ watchexec echo 'src/\*.rs'
 
-\$ watchexec \--shell=none echo src/\*.rs
+\$ watchexec \--shell=none echo 'src/\*.rs'
 
-Behaviour depends on the value of \--shell: for all except none, every
+Behaviour depends on the value of '\--shell': for all except 'none', every
 part of the command is joined together into one string with a single
 ascii space character, and given to the shell as described in the help
-for \--shell. For none, each distinct element the command is passed as
+for '\--shell'. For 'none', each distinct element the command is passed as
 per the execvp(3) convention: first argument is the program, as a path
-or searched for in the PATH environment variable, rest are arguments.
+or searched for in the 'PATH' environment variable, rest are arguments.
 
 # COMMAND
 
@@ -197,18 +197,18 @@ environment.
 
 **-n**
 
-:   Shorthand for \--shell=none
+:   Shorthand for '\--shell=none'
 
 **\--no-process-group**
 
-:   Dont use a process group
+:   Don't use a process group
 
 By default, Watchexec will run the command in a process group, so that
 signals and terminations are sent to all processes in the group.
-Sometimes thats not what you want, and you can disable the behaviour
+Sometimes that's not what you want, and you can disable the behaviour
 with this option.
 
-Deprecated, use \--wrap-process=none instead.
+Deprecated, use '\--wrap-process=none' instead.
 
 **-Q**, **\--quote**
 
@@ -217,7 +217,7 @@ Deprecated, use \--wrap-process=none instead.
 
 On Windows by default this is treated as false, as CMD and PowerShell do
 not work correctly when the symbols are quoted. For git-bash and nushell
-on Windows, as well as other shells that wont work correctly without
+on Windows, as well as other shells that won't work correctly without
 quoting, opt in to quoting using this option.
 
 On Linux and MacOS this is ignored and always treated as true, because
@@ -236,8 +236,8 @@ possibly other newer shells.
 
 :   Use a different shell
 
-By default, Watchexec will use \$SHELL if its defined or a default of sh
-on Unix-likes, and either pwsh, powershell, or cmd (CMD.EXE) on Windows,
+By default, Watchexec will use '\$SHELL' if it's defined or a default of 'sh'
+on Unix-likes, and either 'pwsh', 'powershell', or 'cmd' (CMD.EXE) on Windows,
 depending on what Watchexec detects is the running shell.
 
 With this option, you can override that and use a different shell, for
@@ -247,17 +247,17 @@ functions.
 If the value has spaces, it is parsed as a command line, and the first
 word used as the shell program, with the rest as arguments to the shell.
 
-The command is run with the -c flag (except for cmd on Windows, where
-its /C).
+The command is run with the '-c' flag (except for 'cmd' on Windows, where
+it's '/C').
 
-The special value none can be used to disable shell use entirely. In
+The special value 'none' can be used to disable shell use entirely. In
 that case, the command provided to Watchexec will be parsed, with the
 first word being the executable and the rest being the arguments, and
 executed directly. Note that this parsing is rudimentary, and may not
 work as expected in all cases.
 
-Using none is a little more efficient and can enable a stricter
-interpretation of the input, but it also means that you cant use shell
+Using 'none' is a little more efficient and can enable a stricter
+interpretation of the input, but it also means that you can't use shell
 features like globbing, redirection, control flow, logic, or pipes.
 
 Examples:
@@ -276,20 +276,20 @@ Use with CMD.exe:
 
 Use with a different unix shell:
 
-\$ watchexec \--shell=bash \-- echo \$BASH_VERSION
+\$ watchexec \--shell=bash \-- 'echo \$BASH_VERSION'
 
 Use with a unix sh
```

---

### Incident Patch 4: `f46c708a` (2026-10-05)
**Commit Message**: fix(docs): preserve apostrophes in generated markdown manual

The roff from clap-mangen escapes apostrophes as \*(Aq and pandoc drops them, so each regen wiped every apostrophe from the markdown manual. Expand to \(aq before converting.

**File**: `bin/manpage` (modified, +5/-1)
```diff
@@ -1,3 +1,7 @@
 #!/bin/sh
 cargo run -p watchexec-cli -- --manual > doc/watchexec.1
-pandoc doc/watchexec.1 -t markdown > doc/watchexec.1.md
+# clap-mangen escapes apostrophes as \*(Aq (a groff string defined in the
+# page header). pandoc's man reader doesn't resolve that string, so the
+# apostrophes silently vanish from the markdown (see #1137). Expand it to
+# the plain \(aq escape first, which pandoc renders correctly.
+sed 's/\\\*(Aq/\\(aq/g' doc/watchexec.1 | pandoc -f man -t markdown > doc/watchexec.1.md
```

**File**: `doc/watchexec.1.md` (modified, +147/-147)
```diff
@@ -88,7 +88,7 @@ Supported shells: bash, elvish, fish, nu, powershell, zsh.
 :   Show the manual page
 
 This shows the manual page for Watchexec, if the output is a terminal
-and the man program is available. If not, the manual page is printed to
+and the 'man' program is available. If not, the manual page is printed to
 stdout in ROFF format (suitable for writing to a watchexec.1 file).
 
 **\--only-emit-events**
@@ -105,7 +105,7 @@ the text mode by specifying \`\--emit-events-to=stdio\`.
 
 **-h**, **\--help**
 
-:   Print help (see a summary with -h)
+:   Print help (see a summary with '-h')
 
 **-V**, **\--version**
 
@@ -115,8 +115,8 @@ the text mode by specifying \`\--emit-events-to=stdio\`.
 
 :   Command (program and arguments) to run on changes
 
-Its run when events pass filters and the debounce period (and once at
-startup unless \--postpone is given). If you pass flags to the command,
+It's run when events pass filters and the debounce period (and once at
+startup unless '\--postpone' is given). If you pass flags to the command,
 you should separate it with \-- though that is not strictly required.
 
 Examples:
@@ -131,16 +131,16 @@ the results may not be what you expect. Compare:
 
 \$ watchexec echo src/\*.rs
 
-\$ watchexec echo src/\*.rs
+\$ watchexec echo 'src/\*.rs'
 
-\$ watchexec \--shell=none echo src/\*.rs
+\$ watchexec \--shell=none echo 'src/\*.rs'
 
-Behaviour depends on the value of \--shell: for all except none, every
+Behaviour depends on the value of '\--shell': for all except 'none', every
 part of the command is joined together into one string with a single
 ascii space character, and given to the shell as described in the help
-for \--shell. For none, each distinct element the command is passed as
+for '\--shell'. For 'none', each distinct element the command is passed as
 per the execvp(3) convention: first argument is the program, as a path
-or searched for in the PATH environment variable, rest are arguments.
+or searched for in the 'PATH' environment variable, rest are arguments.
 
 # COMMAND
 
@@ -197,18 +197,18 @@ environment.
 
 **-n**
 
-:   Shorthand for \--shell=none
+:   Shorthand for '\--shell=none'
 
 **\--no-process-group**
 
-:   Dont use a process group
+:   Don't use a process group
 
 By default, Watchexec will run the command in a process group, so that
 signals and terminations are sent to all processes in the group.
-Sometimes thats not what you want, and you can disable the behaviour
+Sometimes that's not what you want, and you can disable the behaviour
 with this option.
 
-Deprecated, use \--wrap-process=none instead.
+Deprecated, use '\--wrap-process=none' instead.
 
 **-Q**, **\--quote**
 
@@ -217,7 +217,7 @@ Deprecated, use \--wrap-process=none instead.
 
 On Windows by default this is treated as false, as CMD and PowerShell do
 not work correctly when the symbols are quoted. For git-bash and nushell
-on Windows, as well as other shells that wont work correctly without
+on Windows, as well as other shells that won't work correctly without
 quoting, opt in to quoting using this option.
 
 On Linux and MacOS this is ignored and always treated as true, because
@@ -236,8 +236,8 @@ possibly other newer shells.
 
 :   Use a different shell
 
-By default, Watchexec will use \$SHELL if its defined or a default of sh
-on Unix-likes, and either pwsh, powershell, or cmd (CMD.EXE) on Windows,
+By default, Watchexec will use '\$SHELL' if it's defined or a default of 'sh'
+on Unix-likes, and either 'pwsh', 'powershell', or 'cmd' (CMD.EXE) on Windows,
 depending on what Watchexec detects is the running shell.
 
 With this option, you can override that and use a different shell, for
@@ -247,17 +247,17 @@ functions.
 If the value has spaces, it is parsed as a command line, and the first
 word used as the shell program, with the rest as arguments to the shell.
 
-The command is run with the -c flag (except for cmd on Windows, where
-its /C).
+The command is run with the '-c' flag (except for 'cmd' on Windows, where
+it's '/C').
 
-The special value none can be used to disable shell use entirely. In
+The special value 'none' can be used to disable shell use entirely. In
 that case, the command provided to Watchexec will be parsed, with the
 first word being the executable and the rest being the arguments, and
 executed directly. Note that this parsing is rudimentary, and may not
 work as expected in all cases.
 
-Using none is a little more efficient and can enable a stricter
-interpretation of the input, but it also means that you cant use shell
+Using 'none' is a little more efficient and can enable a stricter
+interpretation of the input, but it also means that you can't use shell
 features like globbing, redirection, control flow, logic, or pipes.
 
 Examples:
@@ -276,20 +276,20 @@ Use with CMD.exe:
 
 Use with a different unix shell:
 
-\$ watchexec \--shell=bash \-- echo \$BASH_VERSION
+\$ watchexec \--shell=bash \-- 'echo \$BASH_VERSION'
 
 Use with a unix sh
```

---

### Incident Patch 5: `7fbf0b39` (2026-10-02)
**Commit Message**: deps: gix-config 0.61, process-wrap 9.1.1, clearscreen 5, time security bumps (#1136)

**File**: `Cargo.lock` (modified, +75/-135)
```diff
@@ -363,19 +363,10 @@ dependencies = [
  "cc",
  "cfg-if",
  "constant_time_eq",
- "cpufeatures 0.3.1",
+ "cpufeatures",
  "rayon-core",
 ]
 
-[[package]]
-name = "block-buffer"
-version = "0.10.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71"
-dependencies = [
- "generic-array",
-]
-
 [[package]]
 name = "block2"
 version = "0.6.2"
@@ -509,7 +500,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "65c35e4b699c7e15ccbe7ee35c005e4fc0a278d22238a2857e6ce2dadeda1b06"
 dependencies = [
  "cfg-if",
- "cpufeatures 0.3.1",
+ "cpufeatures",
  "rand_core 0.10.1",
 ]
 
@@ -598,9 +589,9 @@ dependencies = [
 
 [[package]]
 name = "clearscreen"
-version = "4.0.6"
+version = "5.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d669bb552908e336ad5681789752033b45566b7e591aeaac7a614e58e5d6d8f2"
+checksum = "6ebe9918b237e4e17e25a04d539d99ef3515417a85f703e0ed8bf44353eb17b3"
 dependencies = [
  "nix",
  "terminfo",
@@ -676,15 +667,6 @@ version = "0.8.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"
 
-[[package]]
-name = "cpufeatures"
-version = "0.2.17"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "59ed5838eebb26a2bb2e58f6d5b5316989ae9d08bab10e0e6d103e656d1b0280"
-dependencies = [
- "libc",
-]
-
 [[package]]
 name = "cpufeatures"
 version = "0.3.1"
@@ -737,16 +719,6 @@ version = "0.8.23"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a31eee39dddec8330830986fcd7625edb5a24ec90ea038215273bbc3adb08ac6"
 
-[[package]]
-name = "crypto-common"
-version = "0.1.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "78c8292055d1c1df0cce5d180393dc8cce0abec0a7102adb6c7b1eef6016d60a"
-dependencies = [
- "generic-array",
- "typenum",
-]
-
 [[package]]
 name = "dashmap"
 version = "6.2.1"
@@ -761,6 +733,15 @@ dependencies = [
  "parking_lot_core",
 ]
 
+[[package]]
+name = "defmt"
+version = "0.3.100"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f0963443817029b2024136fc4dd07a5107eb8f977eaf18fcd1fdeb11306b64ad"
+dependencies = [
+ "defmt 1.1.1",
+]
+
 [[package]]
 name = "defmt"
 version = "1.1.1"
@@ -798,16 +779,6 @@ version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 
-[[package]]
-name = "digest"
-version = "0.10.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9ed9a281f7bc9b7576e61468ba615a66a5c8cfdff42420a70aa82701a3b1e292"
-dependencies = [
- "block-buffer",
- "crypto-common",
-]
-
 [[package]]
 name = "dirs"
 version = "6.0.0"
@@ -993,10 +964,12 @@ dependencies = [
 
 [[package]]
 name = "faster-hex"
-version = "0.10.0"
+version = "0.10.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7223ae2d2f179b803433d9c830478527e92b8117eab39460edae7f1614d9fb73"
+checksum = "04839bdf9d8c10f66806fad16b852fc72aab80873aebc3cb69d85b4fa41543ed"
 dependencies = [
+ "autocfg",
+ "defmt 0.3.100",
  "heapless",
  "serde",
 ]
@@ -1155,16 +1128,6 @@ dependencies = [
  "slab",
 ]
 
-[[package]]
-name = "generic-array"
-version = "0.14.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "85649ca51fd72272d7821adaf274ad91c288277713d9c18820d8499a7ff69e9a"
-dependencies = [
- "typenum",
- "version_check",
-]
-
 [[package]]
 name = "getrandom"
 version = "0.2.17"
@@ -1214,9 +1177,9 @@ checksum = "1033caf0b349c518623b5396bfb2cf0bddf44f0306d543a250e5743297aafd10"
 
 [[package]]
 name = "gix-actor"
-version = "0.41.2"
+version = "0.43.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "33f9308ad6fd35b2a865cbe4117ac61b2be59e4a9ef1621c7a9794f7c8e52c5b"
+checksum = "8e046e9a929e8e1f40f9a34f736408c4c079f9cf004429f3e718d270e847be96"
 dependencies = [
  "bstr",
  "gix-date",
@@ -1225,41 +1188,41 @@ dependencies = [
 
 [[package]]
 name = "gix-config"
-version = "0.59.0"
+version = "0.61.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "103d11bef95c467577ecfa8b7b86a22e65af3507b2c9bfa3809a4afbae7df301"
+checksum = "eb2cb454dce2f1895cf9def1df8b0a6bbc579d86d8313bdf60f1ab429d52df12"
 dependencies = [
  "bstr",
  "gix-config-value",
+ "gix-error",
  "gix-features",
  "gix-glob",
  "gix-path",
  "gix-ref",
  "gix-sec",
  "gix-utils",
  "smallvec",
- "thiserror",
  "unicode-bom",
 ]
 
 [[package]]
 name = "gix-config-value"
-version = "0.19.1"
+version = "0.20.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6f6af5321bfd3711a279d6b244d58532ba1cfabf9eb6374791f19929d8970082"
+checksum = "1894e816c774650b5157d965853b50d7e8f7137ea74055a6bac2f2ec051cf997"
 dependencies = [
  "bitflags 2.13.2",
  "bstr",
+ "gix
```

**File**: `crates/bosion/examples/clap/Cargo.lock` (modified, +11/-21)
```diff
@@ -60,7 +60,7 @@ dependencies = [
 
 [[package]]
 name = "bosion"
-version = "1.1.3"
+version = "2.0.2"
 dependencies = [
  "flate2",
  "time",
@@ -137,12 +137,9 @@ dependencies = [
 
 [[package]]
 name = "deranged"
-version = "0.5.5"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ececcb659e7ba858fb4f10388c250a7252eb0a27373f1a72b8748afdd248e587"
-dependencies = [
- "powerfmt",
-]
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 
 [[package]]
 name = "flate2"
@@ -166,12 +163,6 @@ version = "1.70.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a6cb138bb79a146c1bd460005623e142ef0181e3d0219cb493e02f7d08a35695"
 
-[[package]]
-name = "itoa"
-version = "1.0.17"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "92ecc6618181def0457392ccd0ee51198e065e016d1d527a7ac1b6dc7c1f09d2"
-
 [[package]]
 name = "miniz_oxide"
 version = "0.8.9"
@@ -184,9 +175,9 @@ dependencies = [
 
 [[package]]
 name = "num-conv"
-version = "0.1.0"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "51d515d32fb182ee37cda2ccdcb92950d6a3c2893aa280e540671c2cd0f3b1d9"
+checksum = "521739c6d2bac4aa25192232afe6841231376b2b26d4d9fae5ecf8ca5772e441"
 
 [[package]]
 name = "once_cell_polyfill"
@@ -263,12 +254,11 @@ dependencies = [
 
 [[package]]
 name = "time"
-version = "0.3.45"
+version = "0.3.55"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f9e442fc33d7fdb45aa9bfeb312c095964abdf596f7567261062b2a7107aaabd"
+checksum = "cdb87b95ec50ddfa440816d227a17b2ccbdda963a316a727fda0fc4334f7d134"
 dependencies = [
  "deranged",
- "itoa",
  "num-conv",
  "powerfmt",
  "serde_core",
@@ -278,15 +268,15 @@ dependencies = [
 
 [[package]]
 name = "time-core"
-version = "0.1.7"
+version = "0.1.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b36ee98fd31ec7426d599183e8fe26932a8dc1fb76ddb6214d05493377d34ca"
+checksum = "9e1c906769ad99c88eaa54e728060edef082f8e358ff32030cb7c7d315e81109"
 
 [[package]]
 name = "time-macros"
-version = "0.2.25"
+version = "0.2.32"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "71e552d1249bf61ac2a52db88179fd0673def1e1ad8243a00d9ec9ed71fee3dd"
+checksum = "7e689342a48d2ea927c87ea50cabf8594854bf940e9310208848d680d668ed85"
 dependencies = [
  "num-conv",
  "time-core",
```

**File**: `crates/bosion/examples/default/Cargo.lock` (modified, +11/-21)
```diff
@@ -60,7 +60,7 @@ dependencies = [
 
 [[package]]
 name = "bosion"
-version = "1.1.3"
+version = "2.0.2"
 dependencies = [
  "flate2",
  "time",
@@ -99,12 +99,9 @@ dependencies = [
 
 [[package]]
 name = "deranged"
-version = "0.5.5"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ececcb659e7ba858fb4f10388c250a7252eb0a27373f1a72b8748afdd248e587"
-dependencies = [
- "powerfmt",
-]
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 
 [[package]]
 name = "flate2"
@@ -122,12 +119,6 @@ version = "1.70.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a6cb138bb79a146c1bd460005623e142ef0181e3d0219cb493e02f7d08a35695"
 
-[[package]]
-name = "itoa"
-version = "1.0.17"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "92ecc6618181def0457392ccd0ee51198e065e016d1d527a7ac1b6dc7c1f09d2"
-
 [[package]]
 name = "leon"
 version = "3.0.2"
@@ -155,9 +146,9 @@ checksum = "61807f77802ff30975e01f4f071c8ba10c022052f98b3294119f3e615d13e5be"
 
 [[package]]
 name = "num-conv"
-version = "0.1.0"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "51d515d32fb182ee37cda2ccdcb92950d6a3c2893aa280e540671c2cd0f3b1d9"
+checksum = "521739c6d2bac4aa25192232afe6841231376b2b26d4d9fae5ecf8ca5772e441"
 
 [[package]]
 name = "once_cell_polyfill"
@@ -276,12 +267,11 @@ dependencies = [
 
 [[package]]
 name = "time"
-version = "0.3.45"
+version = "0.3.55"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f9e442fc33d7fdb45aa9bfeb312c095964abdf596f7567261062b2a7107aaabd"
+checksum = "cdb87b95ec50ddfa440816d227a17b2ccbdda963a316a727fda0fc4334f7d134"
 dependencies = [
  "deranged",
- "itoa",
  "num-conv",
  "powerfmt",
  "serde_core",
@@ -291,15 +281,15 @@ dependencies = [
 
 [[package]]
 name = "time-core"
-version = "0.1.7"
+version = "0.1.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b36ee98fd31ec7426d599183e8fe26932a8dc1fb76ddb6214d05493377d34ca"
+checksum = "9e1c906769ad99c88eaa54e728060edef082f8e358ff32030cb7c7d315e81109"
 
 [[package]]
 name = "time-macros"
-version = "0.2.25"
+version = "0.2.32"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "71e552d1249bf61ac2a52db88179fd0673def1e1ad8243a00d9ec9ed71fee3dd"
+checksum = "7e689342a48d2ea927c87ea50cabf8594854bf940e9310208848d680d668ed85"
 dependencies = [
  "num-conv",
  "time-core",
```

**File**: `crates/bosion/examples/no-git/Cargo.lock` (modified, +11/-21)
```diff
@@ -54,7 +54,7 @@ dependencies = [
 
 [[package]]
 name = "bosion"
-version = "1.1.3"
+version = "2.0.2"
 dependencies = [
  "time",
 ]
@@ -77,25 +77,16 @@ checksum = "b05b61dc5112cbb17e4b6cd61790d9845d13888356391624cbe7e41efeac1e75"
 
 [[package]]
 name = "deranged"
-version = "0.5.5"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ececcb659e7ba858fb4f10388c250a7252eb0a27373f1a72b8748afdd248e587"
-dependencies = [
- "powerfmt",
-]
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 
 [[package]]
 name = "is_terminal_polyfill"
 version = "1.70.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a6cb138bb79a146c1bd460005623e142ef0181e3d0219cb493e02f7d08a35695"
 
-[[package]]
-name = "itoa"
-version = "1.0.17"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "92ecc6618181def0457392ccd0ee51198e065e016d1d527a7ac1b6dc7c1f09d2"
-
 [[package]]
 name = "leon"
 version = "3.0.2"
@@ -113,9 +104,9 @@ checksum = "61807f77802ff30975e01f4f071c8ba10c022052f98b3294119f3e615d13e5be"
 
 [[package]]
 name = "num-conv"
-version = "0.1.0"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "51d515d32fb182ee37cda2ccdcb92950d6a3c2893aa280e540671c2cd0f3b1d9"
+checksum = "521739c6d2bac4aa25192232afe6841231376b2b26d4d9fae5ecf8ca5772e441"
 
 [[package]]
 name = "once_cell_polyfill"
@@ -228,12 +219,11 @@ dependencies = [
 
 [[package]]
 name = "time"
-version = "0.3.45"
+version = "0.3.55"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f9e442fc33d7fdb45aa9bfeb312c095964abdf596f7567261062b2a7107aaabd"
+checksum = "cdb87b95ec50ddfa440816d227a17b2ccbdda963a316a727fda0fc4334f7d134"
 dependencies = [
  "deranged",
- "itoa",
  "num-conv",
  "powerfmt",
  "serde_core",
@@ -243,15 +233,15 @@ dependencies = [
 
 [[package]]
 name = "time-core"
-version = "0.1.7"
+version = "0.1.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b36ee98fd31ec7426d599183e8fe26932a8dc1fb76ddb6214d05493377d34ca"
+checksum = "9e1c906769ad99c88eaa54e728060edef082f8e358ff32030cb7c7d315e81109"
 
 [[package]]
 name = "time-macros"
-version = "0.2.25"
+version = "0.2.32"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "71e552d1249bf61ac2a52db88179fd0673def1e1ad8243a00d9ec9ed71fee3dd"
+checksum = "7e689342a48d2ea927c87ea50cabf8594854bf940e9310208848d680d668ed85"
 dependencies = [
  "num-conv",
  "time-core",
```

**File**: `crates/cli/Cargo.toml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ chrono = "0.4.31"
 clap_complete = "4.5.44"
 clap_complete_nushell = "4.4.2"
 clap_mangen = "0.2.15"
-clearscreen = "4.0.4"
+clearscreen = "5.0.0"
 dashmap = "6.1.0"
 dirs = "6.0.0"
 dunce = "1.0.4"
```

**File**: `crates/cli/src/config.rs` (modified, +0/-1)
```diff
@@ -1681,7 +1681,6 @@ fn emit_events_to_command(
 pub fn reset_screen() {
 	for cs in [
 		ClearScreen::WindowsCooked,
-		ClearScreen::WindowsVt,
 		ClearScreen::VtLeaveAlt,
 		ClearScreen::VtWellDone,
 		ClearScreen::default(),
```

**File**: `crates/ignore-files/Cargo.toml` (modified, +3/-2)
```diff
@@ -11,19 +11,20 @@ documentation = "https://docs.rs/ignore-files"
 repository = "https://github.com/watchexec/watchexec"
 readme = "README.md"
 
-rust-version = "1.85.0"
+rust-version = "1.88.0"
 edition = "2021"
 
 [dependencies]
 futures = "0.3.29"
-gix-config = { version = "0.59.0", features = ["sha1"] }
+gix-config = { version = "0.61.0", features = ["sha1"] }
 ignore = "0.4.18"
 miette = "7.2.0"
 normalize-path = "0.2.1"
 thiserror = "2.0.11"
 tracing = "0.1.40"
 radix_trie = "0.3.0"
 dunce = "1.0.4"
+gix-error = "0.4.0"
 
 [dependencies.tokio]
 version = "1.33.0"
```

**File**: `crates/ignore-files/src/discover.rs` (modified, +11/-10)
```diff
@@ -7,6 +7,7 @@ use std::{
 
 use futures::future::try_join_all;
 use gix_config::{path::interpolate::Context as InterpolateContext, File, Path as GitPath};
+use gix_error::Exn;
 use miette::{bail, Result};
 use normalize_path::NormalizePath;
 use project_origins::ProjectType;
@@ -180,7 +181,7 @@ pub async fn from_origin(
 				ErrorKind::Other,
 				"unreachable: .git/config must have a parent",
 			)),
-			Some(Err(err)) => errors.push(Error::new(ErrorKind::Other, err)),
+			Some(Err(err)) => errors.push(Error::new(ErrorKind::Other, err.into_error())),
 			Some(Ok(config)) => {
 				let config_excludes = config.value::<GitPath>("core.excludesFile");
 				if let Ok(excludes) = config_excludes {
@@ -331,16 +332,16 @@ pub async fn from_environment(appname: Option<&str>) -> (Vec<IgnoreFile>, Vec<Er
 	let mut errors = Vec::new();
 
 	let mut found_git_global = false;
-	match File::from_environment_overrides().map(|mut env| {
-		File::from_globals().map(move |glo| {
-			env.append(glo)?;
-			Ok::<_, gix_config::parse::span::Error>(env)
-		})
+	match File::from_environment_overrides().and_then(|mut env| {
+		File::from_globals()
+			.and_then(move |glo| {
+				env.append(glo)?;
+				Ok(env)
+			})
+			.map_err(Exn::erased)
 	}) {
-		Err(err) => errors.push(Error::new(ErrorKind::Other, err)),
-		Ok(Err(err)) => errors.push(Error::new(ErrorKind::Other, err)),
-		Ok(Ok(Err(err))) => errors.push(Error::new(ErrorKind::Other, err)),
-		Ok(Ok(Ok(config))) => {
+		Err(err) => errors.push(Error::new(ErrorKind::Other, err.into_error())),
+		Ok(config) => {
 			let config_excludes = config.value::<GitPath>("core.excludesFile");
 			if let Ok(excludes) = config_excludes {
 				match excludes.interpolate(InterpolateContext {
```

---

### Incident Patch 6: `88f96826` (2026-10-02)
**Commit Message**: build(deps): update time in bosion example lockfiles

Bumps time to 0.3.55 in the default, no-git, and clap example
lockfiles, past the 0.3.47 floor of CVE-2026-25727 / GHSA-r6v5-fh4h-64xc
(stack exhaustion DoS). These are lockfile-only updates in standalone
example projects, which is also why dependabot could only file alerts
rather than PRs for them.

Co-authored-by: OpenCode <[REDACTED_EMAIL]>

**File**: `crates/bosion/examples/clap/Cargo.lock` (modified, +11/-21)
```diff
@@ -60,7 +60,7 @@ dependencies = [
 
 [[package]]
 name = "bosion"
-version = "1.1.3"
+version = "2.0.2"
 dependencies = [
  "flate2",
  "time",
@@ -137,12 +137,9 @@ dependencies = [
 
 [[package]]
 name = "deranged"
-version = "0.5.5"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ececcb659e7ba858fb4f10388c250a7252eb0a27373f1a72b8748afdd248e587"
-dependencies = [
- "powerfmt",
-]
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 
 [[package]]
 name = "flate2"
@@ -166,12 +163,6 @@ version = "1.70.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a6cb138bb79a146c1bd460005623e142ef0181e3d0219cb493e02f7d08a35695"
 
-[[package]]
-name = "itoa"
-version = "1.0.17"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "92ecc6618181def0457392ccd0ee51198e065e016d1d527a7ac1b6dc7c1f09d2"
-
 [[package]]
 name = "miniz_oxide"
 version = "0.8.9"
@@ -184,9 +175,9 @@ dependencies = [
 
 [[package]]
 name = "num-conv"
-version = "0.1.0"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "51d515d32fb182ee37cda2ccdcb92950d6a3c2893aa280e540671c2cd0f3b1d9"
+checksum = "521739c6d2bac4aa25192232afe6841231376b2b26d4d9fae5ecf8ca5772e441"
 
 [[package]]
 name = "once_cell_polyfill"
@@ -263,12 +254,11 @@ dependencies = [
 
 [[package]]
 name = "time"
-version = "0.3.45"
+version = "0.3.55"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f9e442fc33d7fdb45aa9bfeb312c095964abdf596f7567261062b2a7107aaabd"
+checksum = "cdb87b95ec50ddfa440816d227a17b2ccbdda963a316a727fda0fc4334f7d134"
 dependencies = [
  "deranged",
- "itoa",
  "num-conv",
  "powerfmt",
  "serde_core",
@@ -278,15 +268,15 @@ dependencies = [
 
 [[package]]
 name = "time-core"
-version = "0.1.7"
+version = "0.1.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b36ee98fd31ec7426d599183e8fe26932a8dc1fb76ddb6214d05493377d34ca"
+checksum = "9e1c906769ad99c88eaa54e728060edef082f8e358ff32030cb7c7d315e81109"
 
 [[package]]
 name = "time-macros"
-version = "0.2.25"
+version = "0.2.32"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "71e552d1249bf61ac2a52db88179fd0673def1e1ad8243a00d9ec9ed71fee3dd"
+checksum = "7e689342a48d2ea927c87ea50cabf8594854bf940e9310208848d680d668ed85"
 dependencies = [
  "num-conv",
  "time-core",
```

**File**: `crates/bosion/examples/default/Cargo.lock` (modified, +11/-21)
```diff
@@ -60,7 +60,7 @@ dependencies = [
 
 [[package]]
 name = "bosion"
-version = "1.1.3"
+version = "2.0.2"
 dependencies = [
  "flate2",
  "time",
@@ -99,12 +99,9 @@ dependencies = [
 
 [[package]]
 name = "deranged"
-version = "0.5.5"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ececcb659e7ba858fb4f10388c250a7252eb0a27373f1a72b8748afdd248e587"
-dependencies = [
- "powerfmt",
-]
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 
 [[package]]
 name = "flate2"
@@ -122,12 +119,6 @@ version = "1.70.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a6cb138bb79a146c1bd460005623e142ef0181e3d0219cb493e02f7d08a35695"
 
-[[package]]
-name = "itoa"
-version = "1.0.17"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "92ecc6618181def0457392ccd0ee51198e065e016d1d527a7ac1b6dc7c1f09d2"
-
 [[package]]
 name = "leon"
 version = "3.0.2"
@@ -155,9 +146,9 @@ checksum = "61807f77802ff30975e01f4f071c8ba10c022052f98b3294119f3e615d13e5be"
 
 [[package]]
 name = "num-conv"
-version = "0.1.0"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "51d515d32fb182ee37cda2ccdcb92950d6a3c2893aa280e540671c2cd0f3b1d9"
+checksum = "521739c6d2bac4aa25192232afe6841231376b2b26d4d9fae5ecf8ca5772e441"
 
 [[package]]
 name = "once_cell_polyfill"
@@ -276,12 +267,11 @@ dependencies = [
 
 [[package]]
 name = "time"
-version = "0.3.45"
+version = "0.3.55"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f9e442fc33d7fdb45aa9bfeb312c095964abdf596f7567261062b2a7107aaabd"
+checksum = "cdb87b95ec50ddfa440816d227a17b2ccbdda963a316a727fda0fc4334f7d134"
 dependencies = [
  "deranged",
- "itoa",
  "num-conv",
  "powerfmt",
  "serde_core",
@@ -291,15 +281,15 @@ dependencies = [
 
 [[package]]
 name = "time-core"
-version = "0.1.7"
+version = "0.1.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b36ee98fd31ec7426d599183e8fe26932a8dc1fb76ddb6214d05493377d34ca"
+checksum = "9e1c906769ad99c88eaa54e728060edef082f8e358ff32030cb7c7d315e81109"
 
 [[package]]
 name = "time-macros"
-version = "0.2.25"
+version = "0.2.32"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "71e552d1249bf61ac2a52db88179fd0673def1e1ad8243a00d9ec9ed71fee3dd"
+checksum = "7e689342a48d2ea927c87ea50cabf8594854bf940e9310208848d680d668ed85"
 dependencies = [
  "num-conv",
  "time-core",
```

**File**: `crates/bosion/examples/no-git/Cargo.lock` (modified, +11/-21)
```diff
@@ -54,7 +54,7 @@ dependencies = [
 
 [[package]]
 name = "bosion"
-version = "1.1.3"
+version = "2.0.2"
 dependencies = [
  "time",
 ]
@@ -77,25 +77,16 @@ checksum = "b05b61dc5112cbb17e4b6cd61790d9845d13888356391624cbe7e41efeac1e75"
 
 [[package]]
 name = "deranged"
-version = "0.5.5"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ececcb659e7ba858fb4f10388c250a7252eb0a27373f1a72b8748afdd248e587"
-dependencies = [
- "powerfmt",
-]
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 
 [[package]]
 name = "is_terminal_polyfill"
 version = "1.70.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a6cb138bb79a146c1bd460005623e142ef0181e3d0219cb493e02f7d08a35695"
 
-[[package]]
-name = "itoa"
-version = "1.0.17"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "92ecc6618181def0457392ccd0ee51198e065e016d1d527a7ac1b6dc7c1f09d2"
-
 [[package]]
 name = "leon"
 version = "3.0.2"
@@ -113,9 +104,9 @@ checksum = "61807f77802ff30975e01f4f071c8ba10c022052f98b3294119f3e615d13e5be"
 
 [[package]]
 name = "num-conv"
-version = "0.1.0"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "51d515d32fb182ee37cda2ccdcb92950d6a3c2893aa280e540671c2cd0f3b1d9"
+checksum = "521739c6d2bac4aa25192232afe6841231376b2b26d4d9fae5ecf8ca5772e441"
 
 [[package]]
 name = "once_cell_polyfill"
@@ -228,12 +219,11 @@ dependencies = [
 
 [[package]]
 name = "time"
-version = "0.3.45"
+version = "0.3.55"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f9e442fc33d7fdb45aa9bfeb312c095964abdf596f7567261062b2a7107aaabd"
+checksum = "cdb87b95ec50ddfa440816d227a17b2ccbdda963a316a727fda0fc4334f7d134"
 dependencies = [
  "deranged",
- "itoa",
  "num-conv",
  "powerfmt",
  "serde_core",
@@ -243,15 +233,15 @@ dependencies = [
 
 [[package]]
 name = "time-core"
-version = "0.1.7"
+version = "0.1.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b36ee98fd31ec7426d599183e8fe26932a8dc1fb76ddb6214d05493377d34ca"
+checksum = "9e1c906769ad99c88eaa54e728060edef082f8e358ff32030cb7c7d315e81109"
 
 [[package]]
 name = "time-macros"
-version = "0.2.25"
+version = "0.2.32"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "71e552d1249bf61ac2a52db88179fd0673def1e1ad8243a00d9ec9ed71fee3dd"
+checksum = "7e689342a48d2ea927c87ea50cabf8594854bf940e9310208848d680d668ed85"
 dependencies = [
  "num-conv",
  "time-core",
```

---

### Incident Patch 7: `fb727d00` (2026-10-02)
**Commit Message**: fix(cli): update clearscreen to 5.0.0

clearscreen 5 replaces Windows version detection with a VT capability
probe: the console host is asked directly whether it supports VT
processing, with no manifest needed, and the sequence-based methods
fall back to the legacy console clear when it does not. It also carries
the fix for the netapi buffer misuse (uninitialised memory read when
probing the version fallbacks) and the terminal-echo regression fix.

ClearScreen::WindowsVt is gone with the version detection it enabled;
the reset sequence drops it, as XtermClear now handles the VT enable
itself on Windows.

Co-authored-by: OpenCode <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -589,9 +589,9 @@ dependencies = [
 
 [[package]]
 name = "clearscreen"
-version = "4.0.6"
+version = "5.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d669bb552908e336ad5681789752033b45566b7e591aeaac7a614e58e5d6d8f2"
+checksum = "6ebe9918b237e4e17e25a04d539d99ef3515417a85f703e0ed8bf44353eb17b3"
 dependencies = [
  "nix",
  "terminfo",
```

**File**: `crates/cli/Cargo.toml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ chrono = "0.4.31"
 clap_complete = "4.5.44"
 clap_complete_nushell = "4.4.2"
 clap_mangen = "0.2.15"
-clearscreen = "4.0.4"
+clearscreen = "5.0.0"
 dashmap = "6.1.0"
 dirs = "6.0.0"
 dunce = "1.0.4"
```

**File**: `crates/cli/src/config.rs` (modified, +0/-1)
```diff
@@ -1681,7 +1681,6 @@ fn emit_events_to_command(
 pub fn reset_screen() {
 	for cs in [
 		ClearScreen::WindowsCooked,
-		ClearScreen::WindowsVt,
 		ClearScreen::VtLeaveAlt,
 		ClearScreen::VtWellDone,
 		ClearScreen::default(),
```

---

### Incident Patch 8: `978fc622` (2026-10-02)
**Commit Message**: fix(deps): update process-wrap to 9.1.1

Picks up the 9.x backports of the two 10.0.1 fixes: avoiding tracing
after fork, and not capturing an unused signal mask. 10.x is a breaking
API change (typed wrappers) that would force a major release of
watchexec-supervisor, so it is left for a deliberate migration.

The declared MSRV is raised to 1.87 to match process-wrap 9.1.x: 9.1.0
already required it, so the previous 1.64 was stale rather than a real
support floor.

Supersedes #1127, whose lockfile was never updated so every --locked
CI job failed.

Co-authored-by: OpenCode <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2615,9 +2615,9 @@ dependencies = [
 
 [[package]]
 name = "process-wrap"
-version = "9.1.0"
+version = "9.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2e842efad9119158434d193c6682e2ebee4b44d6ad801d7b349623b3f57cdf55"
+checksum = "f95f6259ebd0640685b7cd26d635861f39208df0f89b2b61ff5cf76310fa54f6"
 dependencies = [
  "futures",
  "indexmap",
```

**File**: `crates/supervisor/Cargo.toml` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@ documentation = "https://docs.rs/watchexec-supervisor"
 repository = "https://github.com/watchexec/watchexec"
 readme = "README.md"
 
-rust-version = "1.64.0"
+rust-version = "1.87.0"
 edition = "2021"
 
 [package.metadata.docs.rs]
@@ -26,7 +26,7 @@ futures = "0.3.29"
 tracing = "0.1.40"
 
 [dependencies.process-wrap]
-version = "9.1.0"
+version = "9.1.1"
 features = ["reset-sigmask", "tokio1"]
 
 [dependencies.tokio]
```

---

### Incident Patch 9: `c1c18b3d` (2026-10-02)
**Commit Message**: fix(deps): adapt ignore-files to gix-config 0.61

The error types moved to the gix-error Exn scheme: the comfort
constructors and File::append are fallible with Exn-based errors, and
gix_config::parse::span::Error is gone. The environment/global config
merge now chains with and_then, and the errors are converted with
Exn::into_error() where std io::Error needs a real std error; gix-error
becomes a direct dependency for that. The declared MSRV is raised to
match gix-config 0.61's (1.88).

Supersedes the gix-config part of #1126, whose lockfile was never
updated so every --locked CI job failed.

Co-authored-by: OpenCode <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +71/-131)
```diff
@@ -363,19 +363,10 @@ dependencies = [
  "cc",
  "cfg-if",
  "constant_time_eq",
- "cpufeatures 0.3.1",
+ "cpufeatures",
  "rayon-core",
 ]
 
-[[package]]
-name = "block-buffer"
-version = "0.10.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71"
-dependencies = [
- "generic-array",
-]
-
 [[package]]
 name = "block2"
 version = "0.6.2"
@@ -509,7 +500,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "65c35e4b699c7e15ccbe7ee35c005e4fc0a278d22238a2857e6ce2dadeda1b06"
 dependencies = [
  "cfg-if",
- "cpufeatures 0.3.1",
+ "cpufeatures",
  "rand_core 0.10.1",
 ]
 
@@ -676,15 +667,6 @@ version = "0.8.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"
 
-[[package]]
-name = "cpufeatures"
-version = "0.2.17"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "59ed5838eebb26a2bb2e58f6d5b5316989ae9d08bab10e0e6d103e656d1b0280"
-dependencies = [
- "libc",
-]
-
 [[package]]
 name = "cpufeatures"
 version = "0.3.1"
@@ -737,16 +719,6 @@ version = "0.8.23"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "a31eee39dddec8330830986fcd7625edb5a24ec90ea038215273bbc3adb08ac6"
 
-[[package]]
-name = "crypto-common"
-version = "0.1.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "78c8292055d1c1df0cce5d180393dc8cce0abec0a7102adb6c7b1eef6016d60a"
-dependencies = [
- "generic-array",
- "typenum",
-]
-
 [[package]]
 name = "dashmap"
 version = "6.2.1"
@@ -761,6 +733,15 @@ dependencies = [
  "parking_lot_core",
 ]
 
+[[package]]
+name = "defmt"
+version = "0.3.100"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f0963443817029b2024136fc4dd07a5107eb8f977eaf18fcd1fdeb11306b64ad"
+dependencies = [
+ "defmt 1.1.1",
+]
+
 [[package]]
 name = "defmt"
 version = "1.1.1"
@@ -798,16 +779,6 @@ version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 
-[[package]]
-name = "digest"
-version = "0.10.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9ed9a281f7bc9b7576e61468ba615a66a5c8cfdff42420a70aa82701a3b1e292"
-dependencies = [
- "block-buffer",
- "crypto-common",
-]
-
 [[package]]
 name = "dirs"
 version = "6.0.0"
@@ -993,10 +964,12 @@ dependencies = [
 
 [[package]]
 name = "faster-hex"
-version = "0.10.0"
+version = "0.10.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7223ae2d2f179b803433d9c830478527e92b8117eab39460edae7f1614d9fb73"
+checksum = "04839bdf9d8c10f66806fad16b852fc72aab80873aebc3cb69d85b4fa41543ed"
 dependencies = [
+ "autocfg",
+ "defmt 0.3.100",
  "heapless",
  "serde",
 ]
@@ -1155,16 +1128,6 @@ dependencies = [
  "slab",
 ]
 
-[[package]]
-name = "generic-array"
-version = "0.14.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "85649ca51fd72272d7821adaf274ad91c288277713d9c18820d8499a7ff69e9a"
-dependencies = [
- "typenum",
- "version_check",
-]
-
 [[package]]
 name = "getrandom"
 version = "0.2.17"
@@ -1214,9 +1177,9 @@ checksum = "1033caf0b349c518623b5396bfb2cf0bddf44f0306d543a250e5743297aafd10"
 
 [[package]]
 name = "gix-actor"
-version = "0.41.2"
+version = "0.43.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "33f9308ad6fd35b2a865cbe4117ac61b2be59e4a9ef1621c7a9794f7c8e52c5b"
+checksum = "8e046e9a929e8e1f40f9a34f736408c4c079f9cf004429f3e718d270e847be96"
 dependencies = [
  "bstr",
  "gix-date",
@@ -1225,41 +1188,41 @@ dependencies = [
 
 [[package]]
 name = "gix-config"
-version = "0.59.0"
+version = "0.61.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "103d11bef95c467577ecfa8b7b86a22e65af3507b2c9bfa3809a4afbae7df301"
+checksum = "eb2cb454dce2f1895cf9def1df8b0a6bbc579d86d8313bdf60f1ab429d52df12"
 dependencies = [
  "bstr",
  "gix-config-value",
+ "gix-error",
  "gix-features",
  "gix-glob",
  "gix-path",
  "gix-ref",
  "gix-sec",
  "gix-utils",
  "smallvec",
- "thiserror",
  "unicode-bom",
 ]
 
 [[package]]
 name = "gix-config-value"
-version = "0.19.1"
+version = "0.20.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6f6af5321bfd3711a279d6b244d58532ba1cfabf9eb6374791f19929d8970082"
+checksum = "1894e816c774650b5157d965853b50d7e8f7137ea74055a6bac2f2ec051cf997"
 dependencies = [
  "bitflags 2.13.2",
  "bstr",
+ "gix-error",
  "gix-path",
  "libc",
- "thiserror",
 ]
 
 [[package]]
 name = "gix-date"
-version = "0.15.6"
+version = "0.17.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7e47b9e8cdc688296609b706428de570f88b1e0eed7156dde7b4a89d26fa4567"
+checksum = "cb8beceb16a77fb222923592864b94beb4ad4c2b175a7055c2cac6815ee0370a"
 dependencies = [
  "bstr",

```

**File**: `crates/ignore-files/Cargo.toml` (modified, +3/-2)
```diff
@@ -11,19 +11,20 @@ documentation = "https://docs.rs/ignore-files"
 repository = "https://github.com/watchexec/watchexec"
 readme = "README.md"
 
-rust-version = "1.85.0"
+rust-version = "1.88.0"
 edition = "2021"
 
 [dependencies]
 futures = "0.3.29"
-gix-config = { version = "0.59.0", features = ["sha1"] }
+gix-config = { version = "0.61.0", features = ["sha1"] }
 ignore = "0.4.18"
 miette = "7.2.0"
 normalize-path = "0.2.1"
 thiserror = "2.0.11"
 tracing = "0.1.40"
 radix_trie = "0.3.0"
 dunce = "1.0.4"
+gix-error = "0.4.0"
 
 [dependencies.tokio]
 version = "1.33.0"
```

**File**: `crates/ignore-files/src/discover.rs` (modified, +11/-10)
```diff
@@ -7,6 +7,7 @@ use std::{
 
 use futures::future::try_join_all;
 use gix_config::{path::interpolate::Context as InterpolateContext, File, Path as GitPath};
+use gix_error::Exn;
 use miette::{bail, Result};
 use normalize_path::NormalizePath;
 use project_origins::ProjectType;
@@ -180,7 +181,7 @@ pub async fn from_origin(
 				ErrorKind::Other,
 				"unreachable: .git/config must have a parent",
 			)),
-			Some(Err(err)) => errors.push(Error::new(ErrorKind::Other, err)),
+			Some(Err(err)) => errors.push(Error::new(ErrorKind::Other, err.into_error())),
 			Some(Ok(config)) => {
 				let config_excludes = config.value::<GitPath>("core.excludesFile");
 				if let Ok(excludes) = config_excludes {
@@ -331,16 +332,16 @@ pub async fn from_environment(appname: Option<&str>) -> (Vec<IgnoreFile>, Vec<Er
 	let mut errors = Vec::new();
 
 	let mut found_git_global = false;
-	match File::from_environment_overrides().map(|mut env| {
-		File::from_globals().map(move |glo| {
-			env.append(glo)?;
-			Ok::<_, gix_config::parse::span::Error>(env)
-		})
+	match File::from_environment_overrides().and_then(|mut env| {
+		File::from_globals()
+			.and_then(move |glo| {
+				env.append(glo)?;
+				Ok(env)
+			})
+			.map_err(Exn::erased)
 	}) {
-		Err(err) => errors.push(Error::new(ErrorKind::Other, err)),
-		Ok(Err(err)) => errors.push(Error::new(ErrorKind::Other, err)),
-		Ok(Ok(Err(err))) => errors.push(Error::new(ErrorKind::Other, err)),
-		Ok(Ok(Ok(config))) => {
+		Err(err) => errors.push(Error::new(ErrorKind::Other, err.into_error())),
+		Ok(config) => {
 			let config_excludes = config.value::<GitPath>("core.excludesFile");
 			if let Ok(excludes) = config_excludes {
 				match excludes.interpolate(InterpolateContext {
```

---

### Incident Patch 10: `a5858124` (2026-10-02)
**Commit Message**: fix(supervisor): exclude shell constructs from the exec prefix (#1135)

**File**: `crates/supervisor/src/command/conversions.rs` (modified, +64/-1)
```diff
@@ -141,8 +141,51 @@ fn pass_program_args_quoted(
 /// program it runs: sequencing (`;`, newlines), conditionals (`&&`, `||`), pipes (`|`), and
 /// backgrounding (`&`). `exec`ing into the first program of such a command would silently
 /// skip the rest of it, since control never returns to the shell.
+///
+/// The first word must also name the program to run: environment assignments (`FOO=1 cmd`),
+/// reserved words that start shell constructs (`time`, `!`, `if`, ...), builtins that have no
+/// external equivalent for `exec` to run (`exec`, `eval`), and subshells (`(cmd)`) are all
+/// excluded, since the shell would otherwise look for a program literally named after them,
+/// or fail to parse.
 fn shell_command_is_execable(command: &str) -> bool {
-	!command.contains([';', '&', '|', '\n'])
+	if command.contains([';', '&', '|', '\n']) {
+		return false;
+	}
+
+	let first_word = match command.split_whitespace().next() {
+		Some(word) => word,
+		// empty commands are left for the shell to no-op on
+		None => return false,
+	};
+
+	// `FOO=1 cmd` assigns for the command rather than naming it: `exec` would look
+	// for a program literally called "FOO=1".
+	if first_word.contains('=') {
+		return false;
+	}
+
+	// Reserved words start shell constructs, and some builtins have no external
+	// equivalent: the shell must handle them itself or the command breaks.
+	if matches!(
+		first_word,
+		"!" | "{"
+			| "[[" | "case"
+			| "coproc"
+			| "eval" | "exec"
+			| "for" | "function"
+			| "if" | "select"
+			| "time" | "until"
+			| "while"
+	) {
+		return false;
+	}
+
+	// A leading parenthesis opens a subshell, which cannot follow `exec`.
+	if first_word.starts_with('(') {
+		return false;
+	}
+
+	true
 }
 
 #[cfg(test)]
@@ -158,6 +201,26 @@ mod tests {
 		assert!(shell_command_is_execable("cmd $(echo sub)"));
 	}
 
+	#[test]
+	fn assignment_prefixed_commands_are_not_execable() {
+		assert!(!shell_command_is_execable("FOO=1 ./run.sh"));
+		assert!(!shell_command_is_execable("PATH=/usr/bin make"));
+	}
+
+	#[test]
+	fn shell_construct_commands_are_not_execable() {
+		assert!(!shell_command_is_execable("time make"));
+		assert!(!shell_command_is_execable("! false"));
+		assert!(!shell_command_is_execable("exec ./run.sh"));
+		assert!(!shell_command_is_execable("eval $(thing)"));
+		assert!(!shell_command_is_execable("(cd /tmp)"));
+	}
+
+	#[test]
+	fn empty_commands_are_not_execable() {
+		assert!(!shell_command_is_execable(""));
+	}
+
 	#[test]
 	fn compound_commands_are_not_execable() {
 		assert!(!shell_command_is_execable("make build && make test"));
```

---

### Incident Patch 11: `18a90f26` (2026-10-02)
**Commit Message**: docs(supervisor): describe the exec prefix in behavioural terms (#1134)

**File**: `crates/supervisor/src/command/conversions.rs` (modified, +6/-6)
```diff
@@ -134,13 +134,13 @@ fn pass_program_args_quoted(
 	}
 }
 
-/// Whether it's safe to prefix `command` with `exec ` so the wrapping shell replaces itself
-/// with it, rather than running it as a child.
+/// Whether the wrapping shell can replace itself with `command` via an `exec ` prefix rather
+/// than running it as a child.
 ///
-/// This is unsafe for commands that rely on the shell surviving past the first program it
-/// runs: sequencing (`;`, newlines), conditionals (`&&`, `||`), pipes (`|`), and backgrounding
-/// (`&`). `exec`ing into the first program of such a command would silently skip the rest of
-/// it, since control never returns to the shell.
+/// This changes shell behaviour for commands that rely on the shell surviving past the first
+/// program it runs: sequencing (`;`, newlines), conditionals (`&&`, `||`), pipes (`|`), and
+/// backgrounding (`&`). `exec`ing into the first program of such a command would silently
+/// skip the rest of it, since control never returns to the shell.
 fn shell_command_is_execable(command: &str) -> bool {
 	!command.contains([';', '&', '|', '\n'])
 }
```

---

### Incident Patch 12: `18311feb` (2026-10-02)
**Commit Message**: fix(lib): serialise keyboard watcher restarts past terminal restore (#1133)

**File**: `crates/lib/src/sources/keyboard.rs` (modified, +43/-27)
```diff
@@ -26,31 +26,31 @@ pub async fn worker(
 	errors: mpsc::Sender<RuntimeError>,
 	events: priority::Sender<Event, Priority>,
 ) -> Result<(), CriticalError> {
-	let mut send_close = None;
+	// The close channel ends a watcher; the done channel is sent once that watcher
+	// has restored the terminal, so the next watcher starts from cooked mode.
+	let mut current: Option<(oneshot::Sender<()>, oneshot::Receiver<()>)> = None;
 	let mut config_watch = config.watch();
 	loop {
 		config_watch.next().await;
 		let want_keyboard = config.keyboard_events.get();
-		match (want_keyboard, &send_close) {
-			// if we want to watch stdin and we're not already watching it then spawn a task to watch it
-			(true, None) => {
+		if want_keyboard {
+			// if we want to watch stdin and we're not already watching it then spawn a task to
+			// watch it
+			if current.is_none() {
 				let (close_s, close_r) = oneshot::channel::<()>();
+				let (done_s, done_r) = oneshot::channel::<()>();
 
-				send_close = Some(close_s);
-				spawn(watch_stdin(errors.clone(), events.clone(), close_r));
+				spawn(watch_stdin(errors.clone(), events.clone(), close_r, done_s));
+				current = Some((close_s, done_r));
 			}
-			// if we don't want to watch stdin but we are already watching it then send a close signal to end
-			// the watching
-			(false, Some(_)) => {
-				// ignore send error as if channel is closed watch is already gone
-				send_close
-					.take()
-					.expect("unreachable due to match")
-					.send(())
-					.ok();
-			}
-			// otherwise no action is required
-			_ => {}
+		} else if let Some((close_s, done_r)) = current.take() {
+			// if we don't want to watch stdin but we are already watching it then send a close
+			// signal to end the watching, and wait for the terminal to be restored before
+			// another watcher may be spawned
+			// ignore send error as if channel is closed watch is already gone
+			close_s.send(()).ok();
+			// ignore done error (watcher panicked): the terminal state is unknown either way
+			let _ = done_r.await;
 		}
 	}
 }
@@ -127,10 +127,10 @@ mod raw_mode {
 	}
 
 	// SAFETY: the stored HANDLE is the process-wide stdin console handle, and
-	// Win32 console handles are not thread-affine, so moving the guard to
-	// another thread keeps the later GetConsoleMode/SetConsoleMode calls in
-	// Drop valid. The guard is currently created and dropped on a single
-	// thread, so this impl is precautionary.
+	// Win32 console handles are not thread-affine, so the guard moves with its
+	// future between executor threads and the GetConsoleMode/SetConsoleMode
+	// calls in Drop stay valid. The worker serialises watchers, so at most one
+	// guard exists at a time and console modes are not mutated concurrently.
 	unsafe impl Send for RawModeGuard {}
 
 	impl RawModeGuard {
@@ -210,20 +210,28 @@ async fn watch_stdin(
 	errors: mpsc::Sender<RuntimeError>,
 	events: priority::Sender<Event, Priority>,
 	close_r: oneshot::Receiver<()>,
+	done: oneshot::Sender<()>,
 ) -> Result<(), CriticalError> {
 	// Use an AtomicBool to signal the blocking reader to stop.
 	// This avoids tokio::io::stdin() which uses blocking threads that can't be
 	// interrupted, causing the process to hang on shutdown (issue #1017).
 	let cancel = Arc::new(AtomicBool::new(false));
 	let cancel_clone = cancel.clone();
 
+	// Raw mode is entered and left on this side rather than inside the blocking
+	// reader, so the restore is not held up by a blocking read, and is complete
+	// before `done` is sent below.
+	#[cfg(any(unix, windows))]
+	let raw_guard = raw_mode::RawModeGuard::enter();
+	#[cfg(any(unix, windows))]
+	let is_raw = raw_guard.is_some();
+	#[cfg(not(any(unix, windows)))]
+	let is_raw = false;
+
 	let (tx, mut rx) = mpsc::channel::<Result<Vec<u8>, ()>>(16);
 
 	// Spawn a blocking task that reads stdin directly
 	tokio::task::spawn_blocking(move || {
-		#[cfg(any(unix, windows))]
-		let _raw_guard = raw_mode::RawModeGuard::enter();
-
 		let mut stdin = std::io::stdin().lock();
 		let mut buffer = [0u8; 10];
 
@@ -232,10 +240,10 @@ async fn watch_stdin(
 				Ok(0) => {
 					// EOF or VTIME timeout with no data
 					// With VMIN=0/VTIME=1, this is a timeout - just loop and check cancel
-					#[cfg(any(unix, windows))]
-					if _raw_guard.is_some() {
+					if is_raw {
 						continue;
 					}
+
 					// Real EOF in non-raw mode
 					let _ = tx.blocking_send(Ok(vec![]));
 					break;
@@ -284,6 +292,14 @@ async fn watch_stdin(
 	// Always signal the blocking thread to stop when we exit
 	cancel.store(true, Ordering::Relaxed);
 
+	// Restore the terminal before reporting completion: the worker waits on
+	// `done` before spawning another watcher, which must start from cooked mode.
+	#[cfg(any(unix, windows))]
+	drop(raw_guard);
+
+	// Ignore send error: if the worker is gone, nobody waits for completion.
+	done.send(()).ok();
+
 	Ok(())
 }
 
```

---

### Incident Patch 13: `5c2d8547` (2026-10-02)
**Commit Message**: fix(supervisor): exclude shell constructs from the exec prefix

The execability heuristic only rejected the ;, &, |, and newline
operators, so any other first word was taken for a program name. Three
families of command broke as a result:

- environment assignments: "FOO=1 ./run.sh" became "exec FOO=1
  ./run.sh", where the shell looks for a program literally called
  "FOO=1", fails, and exits 127 without running anything
- reserved words and builtins without an external equivalent: "time
  cmd", "! cmd", "exec cmd", "eval ..." became "exec time cmd" and so
  on, which either fails the same way or changes semantics when an
  external namesake happens to exist
- subshells: "(cd /tmp)" became "exec (cd /tmp)", a parse error, so
  the command never ran

The first word of the command must now actually name the program:
words containing "=", shell construct starters and no-external-equivalent
builtins, and words opening a subshell are excluded, and empty commands
are left to the shell. Excluding too much only loses the optimization;
including any of these broke the command outright.

Co-authored-by: OpenCode <[REDACTED_EMAIL]>

**File**: `crates/supervisor/src/command/conversions.rs` (modified, +64/-1)
```diff
@@ -141,8 +141,51 @@ fn pass_program_args_quoted(
 /// program it runs: sequencing (`;`, newlines), conditionals (`&&`, `||`), pipes (`|`), and
 /// backgrounding (`&`). `exec`ing into the first program of such a command would silently
 /// skip the rest of it, since control never returns to the shell.
+///
+/// The first word must also name the program to run: environment assignments (`FOO=1 cmd`),
+/// reserved words that start shell constructs (`time`, `!`, `if`, ...), builtins that have no
+/// external equivalent for `exec` to run (`exec`, `eval`), and subshells (`(cmd)`) are all
+/// excluded, since the shell would otherwise look for a program literally named after them,
+/// or fail to parse.
 fn shell_command_is_execable(command: &str) -> bool {
-	!command.contains([';', '&', '|', '\n'])
+	if command.contains([';', '&', '|', '\n']) {
+		return false;
+	}
+
+	let first_word = match command.split_whitespace().next() {
+		Some(word) => word,
+		// empty commands are left for the shell to no-op on
+		None => return false,
+	};
+
+	// `FOO=1 cmd` assigns for the command rather than naming it: `exec` would look
+	// for a program literally called "FOO=1".
+	if first_word.contains('=') {
+		return false;
+	}
+
+	// Reserved words start shell constructs, and some builtins have no external
+	// equivalent: the shell must handle them itself or the command breaks.
+	if matches!(
+		first_word,
+		"!" | "{"
+			| "[[" | "case"
+			| "coproc"
+			| "eval" | "exec"
+			| "for" | "function"
+			| "if" | "select"
+			| "time" | "until"
+			| "while"
+	) {
+		return false;
+	}
+
+	// A leading parenthesis opens a subshell, which cannot follow `exec`.
+	if first_word.starts_with('(') {
+		return false;
+	}
+
+	true
 }
 
 #[cfg(test)]
@@ -158,6 +201,26 @@ mod tests {
 		assert!(shell_command_is_execable("cmd $(echo sub)"));
 	}
 
+	#[test]
+	fn assignment_prefixed_commands_are_not_execable() {
+		assert!(!shell_command_is_execable("FOO=1 ./run.sh"));
+		assert!(!shell_command_is_execable("PATH=/usr/bin make"));
+	}
+
+	#[test]
+	fn shell_construct_commands_are_not_execable() {
+		assert!(!shell_command_is_execable("time make"));
+		assert!(!shell_command_is_execable("! false"));
+		assert!(!shell_command_is_execable("exec ./run.sh"));
+		assert!(!shell_command_is_execable("eval $(thing)"));
+		assert!(!shell_command_is_execable("(cd /tmp)"));
+	}
+
+	#[test]
+	fn empty_commands_are_not_execable() {
+		assert!(!shell_command_is_execable(""));
+	}
+
 	#[test]
 	fn compound_commands_are_not_execable() {
 		assert!(!shell_command_is_execable("make build && make test"));
```

---

### Incident Patch 14: `9e2aac5f` (2026-10-02)
**Commit Message**: docs(supervisor): describe the exec prefix in behavioural terms

The doc comment on shell_command_is_execable used "unsafe" for what is
a shell-behaviour concern on a safe function, which reads as Rust
unsafety. It now describes the same condition as what changes in the
shell when the exec prefix is applied.

Co-authored-by: OpenCode <[REDACTED_EMAIL]>

**File**: `crates/supervisor/src/command/conversions.rs` (modified, +6/-6)
```diff
@@ -134,13 +134,13 @@ fn pass_program_args_quoted(
 	}
 }
 
-/// Whether it's safe to prefix `command` with `exec ` so the wrapping shell replaces itself
-/// with it, rather than running it as a child.
+/// Whether the wrapping shell can replace itself with `command` via an `exec ` prefix rather
+/// than running it as a child.
 ///
-/// This is unsafe for commands that rely on the shell surviving past the first program it
-/// runs: sequencing (`;`, newlines), conditionals (`&&`, `||`), pipes (`|`), and backgrounding
-/// (`&`). `exec`ing into the first program of such a command would silently skip the rest of
-/// it, since control never returns to the shell.
+/// This changes shell behaviour for commands that rely on the shell surviving past the first
+/// program it runs: sequencing (`;`, newlines), conditionals (`&&`, `||`), pipes (`|`), and
+/// backgrounding (`&`). `exec`ing into the first program of such a command would silently
+/// skip the rest of it, since control never returns to the shell.
 fn shell_command_is_execable(command: &str) -> bool {
 	!command.contains([';', '&', '|', '\n'])
 }
```

---

### Incident Patch 15: `ba731340` (2026-10-02)
**Commit Message**: fix(lib): serialise keyboard watcher restarts past terminal restore

When the keyboard source was disabled and re-enabled, the worker spawned
the next stdin watcher immediately, while the previous watcher could
still hold its RawModeGuard: on Unix for up to the 100ms read timeout,
on Windows until the next key event. Two guards then raced on the
terminal: the new enter() could capture the previous raw settings as
the original to restore, and the old Drop could restore cooked mode
under the new watcher, or leave the terminal raw at shutdown.

The guard now lives in the async watcher rather than the blocking
reader, is restored before the watcher reports completion, and the
worker waits for that completion before spawning another watcher.
Waiting on the async-side restore, not the blocking task exit, keeps
config changes processing promptly on Windows, where the blocking read
only returns on input or EOF.

The Send impl on the windows guard stops being precautionary: the
future holding it moves across executor threads. Its comment now
states that and the single-guard invariant the worker enforces.

Co-authored-by: OpenCode <[REDACTED_EMAIL]>

**File**: `crates/lib/src/sources/keyboard.rs` (modified, +43/-27)
```diff
@@ -26,31 +26,31 @@ pub async fn worker(
 	errors: mpsc::Sender<RuntimeError>,
 	events: priority::Sender<Event, Priority>,
 ) -> Result<(), CriticalError> {
-	let mut send_close = None;
+	// The close channel ends a watcher; the done channel is sent once that watcher
+	// has restored the terminal, so the next watcher starts from cooked mode.
+	let mut current: Option<(oneshot::Sender<()>, oneshot::Receiver<()>)> = None;
 	let mut config_watch = config.watch();
 	loop {
 		config_watch.next().await;
 		let want_keyboard = config.keyboard_events.get();
-		match (want_keyboard, &send_close) {
-			// if we want to watch stdin and we're not already watching it then spawn a task to watch it
-			(true, None) => {
+		if want_keyboard {
+			// if we want to watch stdin and we're not already watching it then spawn a task to
+			// watch it
+			if current.is_none() {
 				let (close_s, close_r) = oneshot::channel::<()>();
+				let (done_s, done_r) = oneshot::channel::<()>();
 
-				send_close = Some(close_s);
-				spawn(watch_stdin(errors.clone(), events.clone(), close_r));
+				spawn(watch_stdin(errors.clone(), events.clone(), close_r, done_s));
+				current = Some((close_s, done_r));
 			}
-			// if we don't want to watch stdin but we are already watching it then send a close signal to end
-			// the watching
-			(false, Some(_)) => {
-				// ignore send error as if channel is closed watch is already gone
-				send_close
-					.take()
-					.expect("unreachable due to match")
-					.send(())
-					.ok();
-			}
-			// otherwise no action is required
-			_ => {}
+		} else if let Some((close_s, done_r)) = current.take() {
+			// if we don't want to watch stdin but we are already watching it then send a close
+			// signal to end the watching, and wait for the terminal to be restored before
+			// another watcher may be spawned
+			// ignore send error as if channel is closed watch is already gone
+			close_s.send(()).ok();
+			// ignore done error (watcher panicked): the terminal state is unknown either way
+			let _ = done_r.await;
 		}
 	}
 }
@@ -127,10 +127,10 @@ mod raw_mode {
 	}
 
 	// SAFETY: the stored HANDLE is the process-wide stdin console handle, and
-	// Win32 console handles are not thread-affine, so moving the guard to
-	// another thread keeps the later GetConsoleMode/SetConsoleMode calls in
-	// Drop valid. The guard is currently created and dropped on a single
-	// thread, so this impl is precautionary.
+	// Win32 console handles are not thread-affine, so the guard moves with its
+	// future between executor threads and the GetConsoleMode/SetConsoleMode
+	// calls in Drop stay valid. The worker serialises watchers, so at most one
+	// guard exists at a time and console modes are not mutated concurrently.
 	unsafe impl Send for RawModeGuard {}
 
 	impl RawModeGuard {
@@ -210,20 +210,28 @@ async fn watch_stdin(
 	errors: mpsc::Sender<RuntimeError>,
 	events: priority::Sender<Event, Priority>,
 	close_r: oneshot::Receiver<()>,
+	done: oneshot::Sender<()>,
 ) -> Result<(), CriticalError> {
 	// Use an AtomicBool to signal the blocking reader to stop.
 	// This avoids tokio::io::stdin() which uses blocking threads that can't be
 	// interrupted, causing the process to hang on shutdown (issue #1017).
 	let cancel = Arc::new(AtomicBool::new(false));
 	let cancel_clone = cancel.clone();
 
+	// Raw mode is entered and left on this side rather than inside the blocking
+	// reader, so the restore is not held up by a blocking read, and is complete
+	// before `done` is sent below.
+	#[cfg(any(unix, windows))]
+	let raw_guard = raw_mode::RawModeGuard::enter();
+	#[cfg(any(unix, windows))]
+	let is_raw = raw_guard.is_some();
+	#[cfg(not(any(unix, windows)))]
+	let is_raw = false;
+
 	let (tx, mut rx) = mpsc::channel::<Result<Vec<u8>, ()>>(16);
 
 	// Spawn a blocking task that reads stdin directly
 	tokio::task::spawn_blocking(move || {
-		#[cfg(any(unix, windows))]
-		let _raw_guard = raw_mode::RawModeGuard::enter();
-
 		let mut stdin = std::io::stdin().lock();
 		let mut buffer = [0u8; 10];
 
@@ -232,10 +240,10 @@ async fn watch_stdin(
 				Ok(0) => {
 					// EOF or VTIME timeout with no data
 					// With VMIN=0/VTIME=1, this is a timeout - just loop and check cancel
-					#[cfg(any(unix, windows))]
-					if _raw_guard.is_some() {
+					if is_raw {
 						continue;
 					}
+
 					// Real EOF in non-raw mode
 					let _ = tx.blocking_send(Ok(vec![]));
 					break;
@@ -284,6 +292,14 @@ async fn watch_stdin(
 	// Always signal the blocking thread to stop when we exit
 	cancel.store(true, Ordering::Relaxed);
 
+	// Restore the terminal before reporting completion: the worker waits on
+	// `done` before spawning another watcher, which must start from cooked mode.
+	#[cfg(any(unix, windows))]
+	drop(raw_guard);
+
+	// Ignore send error: if the worker is gone, nobody waits for completion.
+	done.send(()).ok();
+
 	Ok(())
 }
 
```

#### Recent Merged Pull Requests:
- **PR #1140** (2026-10-05): fix(docs): preserve apostrophes in generated markdown manual (@GhostCoder6969)
- **PR #1139** (2026-10-05): feat(supervisor): hand the terminal back to a resumed command (@passcod)
- **PR #1138** (2026-10-05): feat: grant the terminal foreground to commands that need it (@passcod)
- **PR #1137** (closed): Fix missing apostrophes in man page (@GhostCoder6969)
- **PR #1136** (2026-10-02): deps: gix-config 0.61, process-wrap 9.1.1, clearscreen 5, time security bumps (@passcod)
- **PR #1135** (2026-10-02): fix(supervisor): exclude shell constructs from the exec prefix (@passcod)
- **PR #1134** (2026-10-02): docs(supervisor): describe the exec prefix in behavioural terms (@passcod)
- **PR #1133** (2026-10-02): fix(lib): serialise keyboard watcher restarts past terminal restore (@passcod)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
