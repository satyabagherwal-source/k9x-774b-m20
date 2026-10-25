> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/watchexec-watchexec-learnings.md`  
> **Source**: github ([https://github.com/watchexec/watchexec](https://github.com/watchexec/watchexec))  
> **Source Version**: `a7170667`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T11:59:44.988Z  
> **Learning ID**: `learn-github-watchexec-watchexec`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): watchexec/watchexec

> **Canonical Artifact**: `07_PROJECT_LEARNING/watchexec-watchexec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/watchexec/watchexec](https://github.com/watchexec/watchexec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T11:59:44.793Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `watchexec/watchexec`
- **Description**: Executes commands in response to file modifications
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7249 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1131** (2026-10-05): **Watching "jj log" with "less" as pager shows no output without "--wrap-process=none"**
  *Symptoms*: ### Watchexec version  watchexec 2.7.3 (2026-09-30) +pid1  ### OS and version (if applicable)  Debian 13.7 (aka. Trixie, slim)  ### Problem you're having  ## Setup  Start with a git repo and JJ (the Jujutsu VCS tool) installed. To set up something minimal and repeatable, I did this in a Debian/Rust container with:  ```console $ podman run --rmi --rm -it docker.io/rust:1.98.1-slim-trixie ```  Then I ran the following setup commands:  ```bash export DEBIAN_FRONTEND=noninteractive apt-get update -y -q apt-get -y -q --no-install-recommends install git less  cargo install --locked jj-cli watchexec-cli  mkdir ~/watchexec-test cd ~/watchexec-test jj git clone https://github.com/watchexec/watchexec.git . ```  ## Repro  (The attached log file starts from here and is just console output, not via `--log-file`, because there were multiple commands. I'd usually use `--clear --quiet` but have omitted those to keep the output.)  In the repository directory, if I do:  ```console $ watchexec -vvv --restart --wrap-process=none --shell=none --watch=.jj/repo --watch=. jj log ```  ...I see the `jj log` output as expected.  If I do:  ```console $ watchexec -vvv --restart --shell=none --watch=.jj/repo --watch=. jj log ```  There is no log output, and using <kbd>CTRL</kbd>-<kbd>C</kbd> to stop watching uses the 10s delay.  If I disable the pager in JJ, I see the output again:  ```console $ watchexec -vvv --restart --shell=none --watch=.jj/repo --watch=. jj log --no-pager ```  It might just be that c

- **Issue #1113** (2026-09-15): **v2.6.1+ Windows Issue: No such file or directory (os error 2)**
  *Symptoms*: **What used to happen** ` watchexec -w [folder] ...` worked without any issue.  **What happens now** ` watchexec -w [folder] ...` no longer works when called out of ~. (calling from ~/Downloads, ~/Documents, and their children don't work, but it seems they can be pointed at from ~)  **Details** - Latest version that worked: 2.5.1 - Earliest version that doesn't: 2.6.1 (corporate proxy doesn't let me install 2.6.0 through Scoop, but if needed, I could try to bypass it by a normal download here) - OS: Windows 11 Professional 25H2 - A debug log with `-vvv --log-file`:  There is no debug output. ``` ❯ eza -D Microsoft.WindowsTerminal_1.23.13503.0_x64 [...]  Javadam  RapidEEx64 [...]  Zotero-bib  ❯ watchexec.exe -w .\Javadam\ echo "boop" -vvv --log-file stuff.log Error:   × Le fichier spécifié est introuvable. (os error 2)  ❌1 ❯ cat stuff.log Get-Content: Cannot find path 'C:\Users\user\Downloads\stuff.log' because it does not exist. ```  Seems to be a sister issue to #765, but it seems like it was fixed in v2.7, not v2.6...

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

### Incident Patch 1: `a7170667` (2026-10-23)
**Commit Message**: docs: correct Linux package installation instructions (#1158)

**File**: `crates/cli/README.md` (modified, +0/-1)
```diff
@@ -134,7 +134,6 @@ Common package managers:
 - Alpine: `$ apk add watchexec`
 - ArchLinux: `$ pacman -S watchexec`
 - Nix: `$ nix-shell -p watchexec`
-- Debian/Ubuntu via [apt.cli.rs](https://apt.cli.rs): `$ apt install watchexec`
 - Homebrew on Mac:  `$ brew install watchexec`
 - Chocolatey on Windows: `#> choco install watchexec`
 
```

**File**: `doc/packages.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ relevant packager.
 | Platform | Distributor | Package name | Status | Install command |
 |:-|:-|:-:|:-:|-:|
 | Linux | _n/a_ (deb) | [`watchexec-{version}-{platform}.deb`](https://github.com/watchexec/watchexec/releases) | first-party | `dpkg -i watchexec-*.deb` |
-| Linux | _n/a_ (rpm) | [`watchexec-{version}-{platform}.rpm`](https://github.com/watchexec/watchexec/releases) | first-party | `dnf install watchexec-*.deb` |
+| Linux | _n/a_ (rpm) | [`watchexec-{version}-{platform}.rpm`](https://github.com/watchexec/watchexec/releases) | first-party | `dnf install watchexec-*.rpm` |
 | Linux | _n/a_ (tarball) | [`watchexec-{version}-{platform}.tar.xz`](https://github.com/watchexec/watchexec/releases) | first-party | `tar xf watchexec-*.tar.xz` |
 | Linux | Alpine | [`watchexec`](https://pkgs.alpinelinux.org/packages?name=watchexec) | official | `apk add watchexec` |
 | Linux | ALT Sisyphus | [`watchexec`](https://packages.altlinux.org/en/sisyphus/srpms/watchexec/) | official | `apt-get install watchexec` |
```

---

### Incident Patch 2: `119781d3` (2026-10-23)
**Commit Message**: docs: correct Linux package installation instructions

**File**: `crates/cli/README.md` (modified, +0/-1)
```diff
@@ -134,7 +134,6 @@ Common package managers:
 - Alpine: `$ apk add watchexec`
 - ArchLinux: `$ pacman -S watchexec`
 - Nix: `$ nix-shell -p watchexec`
-- Debian/Ubuntu via [apt.cli.rs](https://apt.cli.rs): `$ apt install watchexec`
 - Homebrew on Mac:  `$ brew install watchexec`
 - Chocolatey on Windows: `#> choco install watchexec`
 
```

**File**: `doc/packages.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ relevant packager.
 | Platform | Distributor | Package name | Status | Install command |
 |:-|:-|:-:|:-:|-:|
 | Linux | _n/a_ (deb) | [`watchexec-{version}-{platform}.deb`](https://github.com/watchexec/watchexec/releases) | first-party | `dpkg -i watchexec-*.deb` |
-| Linux | _n/a_ (rpm) | [`watchexec-{version}-{platform}.rpm`](https://github.com/watchexec/watchexec/releases) | first-party | `dnf install watchexec-*.deb` |
+| Linux | _n/a_ (rpm) | [`watchexec-{version}-{platform}.rpm`](https://github.com/watchexec/watchexec/releases) | first-party | `dnf install watchexec-*.rpm` |
 | Linux | _n/a_ (tarball) | [`watchexec-{version}-{platform}.tar.xz`](https://github.com/watchexec/watchexec/releases) | first-party | `tar xf watchexec-*.tar.xz` |
 | Linux | Alpine | [`watchexec`](https://pkgs.alpinelinux.org/packages?name=watchexec) | official | `apk add watchexec` |
 | Linux | ALT Sisyphus | [`watchexec`](https://packages.altlinux.org/en/sisyphus/srpms/watchexec/) | official | `apt-get install watchexec` |
```

#### Recent Merged Pull Requests:
- **PR #1158** (2026-10-23): docs: correct Linux package installation instructions (@jdotc1)
- **PR #1154** (2026-10-19): fix: keep stops and signals from reaching the next run (@fzakaria)
- **PR #1153** (2026-10-19): Start when HOME does not exist (@fzakaria)
- **PR #1151** (closed): chore(deps): bump release-plz/action from 0.5.139 to 0.5.141 (@dependabot[bot])
- **PR #1150** (closed): chore(deps): bump taiki-e/install-action from 2.87.22 to 2.87.27 (@dependabot[bot])
- **PR #1149** (closed): chore(deps): update gix-error requirement from 0.4.0 to 0.5.0 in /crates/ignore-files (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
