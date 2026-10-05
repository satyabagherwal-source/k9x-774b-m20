# Forensic Learning Record (Deep Inspection): watchexec/watchexec

> **Canonical Artifact**: `07_PROJECT_LEARNING/watchexec-watchexec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/watchexec/watchexec](https://github.com/watchexec/watchexec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:56:20.204Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `watchexec/watchexec`
- **Description**: Executes commands in response to file modifications
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7207 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

		Self:
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
/// and doesn
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #960** (2026-08-17): **Restart (-r) doesn't wait for the process to exit before restarting it**
  *Symptoms*: ``` $ watchexec --version watchexec 2.3.2 (5c810fd 2025-05-18) +pid1 commit-hash: 5c810fd7c693a13d9fcd4d36bc825681bf8ada5e commit-date: 2025-05-18 build-date: 2025-05-18 release: 2.3.2 features: default,pid1 ```  OS: `debian:bookworm-slim` in Docker container  Given the following script: ```typescript import { sleep } from 'bun';  // Get a random ID string: const getRandomId = () => {   return Math.random().toString(36).substring(2, 15); }; const id = getRandomId();  let shuttingDown = false; const shutdown = async (signal: string) => {   if (shuttingDown) {     process.exit(0);   }    console.log(`${id} - Received ${signal}, shutting down gracefully...`);    shuttingDown = true;    try {     await sleep(3_000);     console.log(`${id} - Exiting!`);     process.exit(0);   } catch (err) {     console.error(`${id} - Error during shutdown:`, err);     process.exit(1);   } };  process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));  console.log(`${id} - STARTING`); while (true) {   console.log(`${id} - ${new Date()}`);   await sleep(1000); } ```  `watchexec --exts json,ts -r -- bun run src/test.ts`  When the file is changed, I expect that the old process will be given 10s to exit before the new one is started, however what happens is the old process gets SIGTERM and watchexec starts the new process immediately: ``` $ watchexec -vvv --log-file watchexec.log --exts json,ts -r -- bun run src/test.ts  [Running: bun run src/test.ts] 2gwff8rd9r7

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

### Incident Patch 1: `16363f12` (2026-09-29)
**Commit Message**: fix(fs): infer file type of removed paths from the event kind (#1130)

**File**: `crates/lib/src/sources/fs.rs` (modified, +46/-5)
```diff
@@ -34,12 +34,12 @@ use std::{
 use async_priority_channel as priority;
 use normalize_path::NormalizePath;
 use notify::{
-	event::{ModifyKind, RenameMode},
+	event::{CreateKind, ModifyKind, RemoveKind, RenameMode},
 	EventKind,
 };
 use tokio::sync::mpsc;
 use tracing::{debug, trace};
-use watchexec_events::{Event, Priority, Source, Tag};
+use watchexec_events::{Event, FileType, Priority, Source, Tag};
 
 use crate::{
 	error::{CriticalError, FsWatcherError, RuntimeError},
@@ -853,6 +853,18 @@ fn notify_multi_path_errors(
 	errs
 }
 
+const fn file_type_from_kind(kind: EventKind) -> Option<FileType> {
+	match kind {
+		EventKind::Create(CreateKind::Folder) | EventKind::Remove(RemoveKind::Folder) => {
+			Some(FileType::Dir)
+		}
+		EventKind::Create(CreateKind::File) | EventKind::Remove(RemoveKind::File) => {
+			Some(FileType::File)
+		}
+		_ => None,
+	}
+}
+
 fn process_event(
 	nev: Result<notify::Event, notify::Error>,
 	kind: Watcher,
@@ -871,7 +883,8 @@ fn process_event(
 		tags.push(Tag::Path {
 			file_type: metadata(&path)
 				.ok()
-				.map(|metadata| metadata.file_type().into()),
+				.map(|metadata| metadata.file_type().into())
+				.or_else(|| file_type_from_kind(nev.kind)),
 			path: path.normalize(),
 		});
 	}
@@ -929,7 +942,7 @@ mod tests {
 	use async_priority_channel as priority;
 	use futures::FutureExt as _;
 	use notify::{
-		event::{Flag, ModifyKind, RenameMode},
+		event::{Flag, ModifyKind, RemoveKind, RenameMode},
 		EventKind,
 	};
 	use std::{
@@ -938,7 +951,7 @@ mod tests {
 		sync::{atomic::Ordering, Arc},
 	};
 	use tokio::sync::mpsc;
-	use watchexec_events::Priority;
+	use watchexec_events::{FileType, Priority};
 
 	// Regression test for issue #920: when the bounded event channel is full,
 	// `process_event` used to propagate `RuntimeError::EventChannelTrySend`,
@@ -1056,6 +1069,34 @@ mod tests {
 		);
 	}
 
+	#[test]
+	fn process_event_infers_file_type_of_removed_path_from_kind(
+	) -> Result<(), Box<dyn std::error::Error>> {
+		let (ev_s, ev_r) = priority::bounded::<watchexec_events::Event, Priority>(2);
+		let removed = PathBuf::from("/nonexistent/watchexec-test/removed-dir");
+
+		let nev =
+			Ok(notify::Event::new(EventKind::Remove(RemoveKind::Folder)).add_path(removed.clone()));
+		process_event(nev, super::Watcher::default(), &ev_s)?;
+
+		let nev = Ok(notify::Event::new(EventKind::Remove(RemoveKind::File)).add_path(removed));
+		process_event(nev, super::Watcher::default(), &ev_s)?;
+
+		let file_type = |event: &watchexec_events::Event| {
+			event
+				.paths()
+				.next()
+				.and_then(|(_, file_type)| file_type.copied())
+		};
+		let (folder, _) = ev_r.try_recv()?;
+		let (file, _) = ev_r.try_recv()?;
+
+		assert_eq!(file_type(&folder), Some(FileType::Dir));
+		assert_eq!(file_type(&file), Some(FileType::File));
+
+		Ok(())
+	}
+
 	#[test]
 	fn process_event_propagates_when_channel_closed() {
 		let (ev_s, ev_r) = priority::bounded::<watchexec_events::Event, Priority>(1);
```

---

### Incident Patch 2: `d9e9a95a` (2026-09-29)
**Commit Message**: fix(fs): infer file type of removed paths from the event kind

**File**: `crates/lib/src/sources/fs.rs` (modified, +46/-5)
```diff
@@ -34,12 +34,12 @@ use std::{
 use async_priority_channel as priority;
 use normalize_path::NormalizePath;
 use notify::{
-	event::{ModifyKind, RenameMode},
+	event::{CreateKind, ModifyKind, RemoveKind, RenameMode},
 	EventKind,
 };
 use tokio::sync::mpsc;
 use tracing::{debug, trace};
-use watchexec_events::{Event, Priority, Source, Tag};
+use watchexec_events::{Event, FileType, Priority, Source, Tag};
 
 use crate::{
 	error::{CriticalError, FsWatcherError, RuntimeError},
@@ -853,6 +853,18 @@ fn notify_multi_path_errors(
 	errs
 }
 
+const fn file_type_from_kind(kind: EventKind) -> Option<FileType> {
+	match kind {
+		EventKind::Create(CreateKind::Folder) | EventKind::Remove(RemoveKind::Folder) => {
+			Some(FileType::Dir)
+		}
+		EventKind::Create(CreateKind::File) | EventKind::Remove(RemoveKind::File) => {
+			Some(FileType::File)
+		}
+		_ => None,
+	}
+}
+
 fn process_event(
 	nev: Result<notify::Event, notify::Error>,
 	kind: Watcher,
@@ -871,7 +883,8 @@ fn process_event(
 		tags.push(Tag::Path {
 			file_type: metadata(&path)
 				.ok()
-				.map(|metadata| metadata.file_type().into()),
+				.map(|metadata| metadata.file_type().into())
+				.or_else(|| file_type_from_kind(nev.kind)),
 			path: path.normalize(),
 		});
 	}
@@ -929,7 +942,7 @@ mod tests {
 	use async_priority_channel as priority;
 	use futures::FutureExt as _;
 	use notify::{
-		event::{Flag, ModifyKind, RenameMode},
+		event::{Flag, ModifyKind, RemoveKind, RenameMode},
 		EventKind,
 	};
 	use std::{
@@ -938,7 +951,7 @@ mod tests {
 		sync::{atomic::Ordering, Arc},
 	};
 	use tokio::sync::mpsc;
-	use watchexec_events::Priority;
+	use watchexec_events::{FileType, Priority};
 
 	// Regression test for issue #920: when the bounded event channel is full,
 	// `process_event` used to propagate `RuntimeError::EventChannelTrySend`,
@@ -1056,6 +1069,34 @@ mod tests {
 		);
 	}
 
+	#[test]
+	fn process_event_infers_file_type_of_removed_path_from_kind(
+	) -> Result<(), Box<dyn std::error::Error>> {
+		let (ev_s, ev_r) = priority::bounded::<watchexec_events::Event, Priority>(2);
+		let removed = PathBuf::from("/nonexistent/watchexec-test/removed-dir");
+
+		let nev =
+			Ok(notify::Event::new(EventKind::Remove(RemoveKind::Folder)).add_path(removed.clone()));
+		process_event(nev, super::Watcher::default(), &ev_s)?;
+
+		let nev = Ok(notify::Event::new(EventKind::Remove(RemoveKind::File)).add_path(removed));
+		process_event(nev, super::Watcher::default(), &ev_s)?;
+
+		let file_type = |event: &watchexec_events::Event| {
+			event
+				.paths()
+				.next()
+				.and_then(|(_, file_type)| file_type.copied())
+		};
+		let (folder, _) = ev_r.try_recv()?;
+		let (file, _) = ev_r.try_recv()?;
+
+		assert_eq!(file_type(&folder), Some(FileType::Dir));
+		assert_eq!(file_type(&file), Some(FileType::File));
+
+		Ok(())
+	}
+
 	#[test]
 	fn process_event_propagates_when_channel_closed() {
 		let (ev_s, ev_r) = priority::bounded::<watchexec_events::Event, Priority>(1);
```

---

### Incident Patch 3: `dbb274a9` (2026-09-29)
**Commit Message**: fix(cli): error instead of panicking on an unreadable @argfile (#1129)

**File**: `crates/cli/src/args.rs` (modified, +62/-5)
```diff
@@ -5,7 +5,7 @@ use std::{
 };
 
 use clap::{Parser, ValueEnum, ValueHint};
-use miette::Result;
+use miette::{IntoDiagnostic, Result, WrapErr};
 use tracing::{debug, info, warn};
 use tracing_appender::non_blocking::WorkerGuard;
 
@@ -188,11 +188,11 @@ impl<const UNITLESS_NANOS_MULTIPLIER: u64> FromStr for TimeSpan<UNITLESS_NANOS_M
 	}
 }
 
-fn expand_args_up_to_doubledash() -> Result<Vec<OsString>, std::io::Error> {
+fn expand_args_up_to_doubledash(args: impl IntoIterator<Item = OsString>) -> Result<Vec<OsString>> {
 	use argfile::Argument;
 	use std::collections::VecDeque;
 
-	let args = std::env::args_os();
+	let args = args.into_iter();
 	let mut expanded_args = Vec::with_capacity(args.size_hint().0);
 
 	let mut todo: VecDeque<_> = args.map(|a| Argument::parse(a, argfile::PREFIX)).collect();
@@ -205,7 +205,9 @@ fn expand_args_up_to_doubledash() -> Result<Vec<OsString>, std::io::Error> {
 				}
 			}
 			Argument::Path(path) => {
-				let content = std::fs::read_to_string(path)?;
+				let content = std::fs::read_to_string(&path)
+					.into_diagnostic()
+					.wrap_err_with(|| format!("while expanding @argfile {}", path.display()))?;
 				let new_args = argfile::parse_fromfile(&content, argfile::PREFIX);
 				todo.reserve(new_args.len());
 				for (i, arg) in new_args.into_iter().enumerate() {
@@ -254,7 +256,7 @@ pub async fn get_args() -> Result<(Args, Guards)> {
 	}
 
 	debug!("expanding @argfile arguments if any");
-	let args = expand_args_up_to_doubledash().expect("while expanding @argfile");
+	let args = expand_args_up_to_doubledash(std::env::args_os())?;
 
 	debug!("parsing arguments");
 	let mut args = Args::parse_from(args);
@@ -280,3 +282,58 @@ fn verify_cli() {
 	use clap::CommandFactory;
 	Args::command().debug_assert()
 }
+
+#[cfg(test)]
+fn argfile_arg(path: &std::path::Path) -> OsString {
+	let mut arg = OsString::from("@");
+	arg.push(path);
+	arg
+}
+
+#[test]
+fn argfile_is_expanded_up_to_doubledash() {
+	let dir = tempfile::tempdir().unwrap();
+	let argfile = dir.path().join("argfile");
+	std::fs::write(&argfile, "-1\n--postpone\n").unwrap();
+
+	let expanded = expand_args_up_to_doubledash([
+		"watchexec".into(),
+		argfile_arg(&argfile),
+		"--".into(),
+		argfile_arg(&argfile),
+	])
+	.unwrap();
+
+	assert_eq!(
+		expanded,
+		[
+			OsString::from("watchexec"),
+			"-1".into(),
+			"--postpone".into(),
+			"--".into(),
+			argfile_arg(&argfile),
+		]
+	);
+}
+
+#[test]
+fn unreadable_argfile_is_an_error() {
+	let dir = tempfile::tempdir().unwrap();
+	let missing = dir.path().join("missing");
+	let not_utf8 = dir.path().join("not-utf8");
+	std::fs::write(&not_utf8, b"\xff\xfe\n").unwrap();
+
+	for path in [missing, not_utf8] {
+		let err = expand_args_up_to_doubledash([
+			"watchexec".into(),
+			argfile_arg(&path),
+			"--".into(),
+			"echo".into(),
+		])
+		.expect_err("an unreadable argfile should be an error, not a panic");
+		assert_eq!(
+			err.to_string(),
+			format!("while expanding @argfile {}", path.display())
+		);
+	}
+}
```

---

### Incident Patch 4: `da832dd5` (2026-09-29)
**Commit Message**: fix(cli): error instead of panicking on an unreadable @argfile

A missing or non-UTF-8 argfile made watchexec panic with exit code 101
and a message that did not say which file was at fault. Reading the
argfile now returns a regular error naming the path, so it is reported
like other startup errors and exits with 1.

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `crates/cli/src/args.rs` (modified, +62/-5)
```diff
@@ -5,7 +5,7 @@ use std::{
 };
 
 use clap::{Parser, ValueEnum, ValueHint};
-use miette::Result;
+use miette::{IntoDiagnostic, Result, WrapErr};
 use tracing::{debug, info, warn};
 use tracing_appender::non_blocking::WorkerGuard;
 
@@ -188,11 +188,11 @@ impl<const UNITLESS_NANOS_MULTIPLIER: u64> FromStr for TimeSpan<UNITLESS_NANOS_M
 	}
 }
 
-fn expand_args_up_to_doubledash() -> Result<Vec<OsString>, std::io::Error> {
+fn expand_args_up_to_doubledash(args: impl IntoIterator<Item = OsString>) -> Result<Vec<OsString>> {
 	use argfile::Argument;
 	use std::collections::VecDeque;
 
-	let args = std::env::args_os();
+	let args = args.into_iter();
 	let mut expanded_args = Vec::with_capacity(args.size_hint().0);
 
 	let mut todo: VecDeque<_> = args.map(|a| Argument::parse(a, argfile::PREFIX)).collect();
@@ -205,7 +205,9 @@ fn expand_args_up_to_doubledash() -> Result<Vec<OsString>, std::io::Error> {
 				}
 			}
 			Argument::Path(path) => {
-				let content = std::fs::read_to_string(path)?;
+				let content = std::fs::read_to_string(&path)
+					.into_diagnostic()
+					.wrap_err_with(|| format!("while expanding @argfile {}", path.display()))?;
 				let new_args = argfile::parse_fromfile(&content, argfile::PREFIX);
 				todo.reserve(new_args.len());
 				for (i, arg) in new_args.into_iter().enumerate() {
@@ -254,7 +256,7 @@ pub async fn get_args() -> Result<(Args, Guards)> {
 	}
 
 	debug!("expanding @argfile arguments if any");
-	let args = expand_args_up_to_doubledash().expect("while expanding @argfile");
+	let args = expand_args_up_to_doubledash(std::env::args_os())?;
 
 	debug!("parsing arguments");
 	let mut args = Args::parse_from(args);
@@ -280,3 +282,58 @@ fn verify_cli() {
 	use clap::CommandFactory;
 	Args::command().debug_assert()
 }
+
+#[cfg(test)]
+fn argfile_arg(path: &std::path::Path) -> OsString {
+	let mut arg = OsString::from("@");
+	arg.push(path);
+	arg
+}
+
+#[test]
+fn argfile_is_expanded_up_to_doubledash() {
+	let dir = tempfile::tempdir().unwrap();
+	let argfile = dir.path().join("argfile");
+	std::fs::write(&argfile, "-1\n--postpone\n").unwrap();
+
+	let expanded = expand_args_up_to_doubledash([
+		"watchexec".into(),
+		argfile_arg(&argfile),
+		"--".into(),
+		argfile_arg(&argfile),
+	])
+	.unwrap();
+
+	assert_eq!(
+		expanded,
+		[
+			OsString::from("watchexec"),
+			"-1".into(),
+			"--postpone".into(),
+			"--".into(),
+			argfile_arg(&argfile),
+		]
+	);
+}
+
+#[test]
+fn unreadable_argfile_is_an_error() {
+	let dir = tempfile::tempdir().unwrap();
+	let missing = dir.path().join("missing");
+	let not_utf8 = dir.path().join("not-utf8");
+	std::fs::write(&not_utf8, b"\xff\xfe\n").unwrap();
+
+	for path in [missing, not_utf8] {
+		let err = expand_args_up_to_doubledash([
+			"watchexec".into(),
+			argfile_arg(&path),
+			"--".into(),
+			"echo".into(),
+		])
+		.expect_err("an unreadable argfile should be an error, not a panic");
+		assert_eq!(
+			err.to_string(),
+			format!("while expanding @argfile {}", path.display())
+		);
+	}
+}
```

---

### Incident Patch 5: `de94761b` (2026-09-15)
**Commit Message**: fix(cli): never produce verbatim paths when canonicalising (#1119)

**File**: `crates/cli/src/args/command.rs` (modified, +2/-54)
```diff
@@ -1,7 +1,7 @@
 use std::{
 	ffi::{OsStr, OsString},
 	mem::take,
-	path::{Path, PathBuf},
+	path::PathBuf,
 };
 
 use clap::{
@@ -321,8 +321,7 @@ impl CommandArgs {
 			w
 		} else {
 			let curdir = std::env::current_dir().into_diagnostic()?;
-			let canonical = dunce::canonicalize(&curdir).into_diagnostic()?;
-			prefer_non_verbatim(canonical, curdir)
+			crate::dirs::canonicalize(curdir).await.into_diagnostic()?
 		};
 		info!(path=?workdir, "effective working directory");
 		self.workdir = Some(workdir);
@@ -332,22 +331,6 @@ impl CommandArgs {
 	}
 }
 
-/// `dunce::canonicalize` only strips the `\\?\` prefix off verbatim *disk* paths, so canonicalising
-/// inside a network share yields `\\?\UNC\server\share\...`, which many programs (notably the Go
-/// toolchain) refuse as a working directory. In that case keep the uncanonicalised path, as long as
-/// it isn't verbatim itself.
-fn prefer_non_verbatim(canonical: PathBuf, original: PathBuf) -> PathBuf {
-	if is_verbatim(&canonical) && !is_verbatim(&original) {
-		original
-	} else {
-		canonical
-	}
-}
-
-fn is_verbatim(path: &Path) -> bool {
-	path.as_os_str().as_encoded_bytes().starts_with(br"\\?\")
-}
-
 #[derive(Clone, Copy, Debug, Default, ValueEnum)]
 pub enum WrapMode {
 	#[default]
@@ -394,38 +377,3 @@ impl TypedValueParser for EnvVarValueParser {
 		})
 	}
 }
-
-#[cfg(test)]
-mod tests {
-	use super::*;
-
-	#[test]
-	fn keeps_uncanonicalised_path_when_canonical_is_verbatim_unc() {
-		assert_eq!(
-			prefer_non_verbatim(
-				PathBuf::from(r"\\?\UNC\Mac\my-directory"),
-				PathBuf::from(r"Z:\my-directory"),
-			),
-			PathBuf::from(r"Z:\my-directory"),
-		);
-	}
-
-	#[test]
-	fn keeps_canonical_path_when_it_is_not_verbatim() {
-		assert_eq!(
-			prefer_non_verbatim(PathBuf::from(r"Z:\real"), PathBuf::from(r"Z:\link")),
-			PathBuf::from(r"Z:\real"),
-		);
-	}
-
-	#[test]
-	fn keeps_canonical_path_when_original_is_verbatim_too() {
-		assert_eq!(
-			prefer_non_verbatim(
-				PathBuf::from(r"\\?\UNC\Mac\my-directory"),
-				PathBuf::from(r"\\?\UNC\Mac\other"),
-			),
-			PathBuf::from(r"\\?\UNC\Mac\my-directory"),
-		);
-	}
-}
```

**File**: `crates/cli/src/args/filtering.rs` (modified, +68/-26)
```diff
@@ -441,35 +441,41 @@ impl FilteringArgs {
 			crate::dirs::project_origin(&self, command).await?
 		};
 		debug!(path=?project_origin, "resolved project origin");
-		let project_origin = dunce::canonicalize(project_origin).into_diagnostic()?;
+		let project_origin = crate::dirs::canonicalize(project_origin)
+			.await
+			.into_diagnostic()?;
 		info!(path=?project_origin, "effective project origin");
 		self.project_origin = Some(project_origin.clone());
 
-		self.paths = take(&mut self.recursive_paths)
+		// Not the origin: that's discovered by walking up *from* these paths, and sits
+		// above the workdir whenever the project root does. Matches dirs::watch_candidates
+		let workdir = command
+			.workdir
+			.as_deref()
+			.expect("workdir is resolved by CommandArgs::normalise");
+		let mut paths = BTreeSet::new();
+		for (path, recursive) in take(&mut self.recursive_paths)
 			.into_iter()
-			.map(|path| {
-				{
-					if path.is_absolute() {
-						Ok(path)
-					} else {
-						dunce::canonicalize(project_origin.join(path)).into_diagnostic()
-					}
-				}
-				.map(WatchedPath::recursive)
-			})
-			.chain(take(&mut self.non_recursive_paths).into_iter().map(|path| {
-				{
-					if path.is_absolute() {
-						Ok(path)
-					} else {
-						dunce::canonicalize(project_origin.join(path)).into_diagnostic()
-					}
-				}
-				.map(WatchedPath::non_recursive)
-			}))
-			.collect::<Result<BTreeSet<_>>>()?
-			.into_iter()
-			.collect();
+			.map(|path| (path, true))
+			.chain(
+				take(&mut self.non_recursive_paths)
+					.into_iter()
+					.map(|path| (path, false)),
+			) {
+			let path = if path.is_absolute() {
+				path
+			} else {
+				crate::dirs::canonicalize(workdir.join(path))
+					.await
+					.into_diagnostic()?
+			};
+			paths.insert(if recursive {
+				WatchedPath::recursive(path)
+			} else {
+				WatchedPath::non_recursive(path)
+			});
+		}
+		self.paths = paths.into_iter().collect();
 
 		if self.paths.len() == 1
 			&& self
@@ -481,7 +487,7 @@ impl FilteringArgs {
 			self.paths = Vec::new();
 		} else if self.paths.is_empty() {
 			info!("no paths, using current directory");
-			self.paths.push(command.workdir.as_deref().unwrap().into());
+			self.paths.push(workdir.into());
 		}
 		info!(paths=?self.paths, "effective watched paths");
 
@@ -509,3 +515,39 @@ pub enum FsEvent {
 	Modify,
 	Metadata,
 }
+
+#[cfg(test)]
+mod tests {
+	use super::*;
+	use crate::args::Args;
+
+	/// The origin is an ancestor of the workdir here, so the two resolutions differ.
+	#[tokio::test]
+	async fn relative_watched_paths_resolve_against_the_workdir() {
+		let tmp = tempfile::tempdir().expect("tempdir");
+		let root = tmp.path().join("project");
+		let workdir = root.join("sub");
+		let target = workdir.join("target");
+		std::fs::create_dir_all(&target).expect("create dirs");
+		std::fs::write(root.join("Cargo.toml"), "").expect("write origin marker");
+
+		let mut args = Args::parse_from(["watchexec", "-w", "./target", "true"]);
+		args.command.workdir = Some(workdir.clone());
+		args.filtering
+			.normalise(&args.command)
+			.await
+			.expect("normalise should resolve the watched path");
+
+		assert_eq!(
+			args.filtering.project_origin,
+			Some(dunce::canonicalize(&root).expect("canonicalize root")),
+			"the origin is meant to be the ancestor project, otherwise this proves nothing"
+		);
+		assert_eq!(
+			args.filtering.paths,
+			vec![WatchedPath::recursive(
+				dunce::canonicalize(&target).expect("canonicalize target")
+			)]
+		);
+	}
+}
```

**File**: `crates/cli/src/dirs.rs` (modified, +69/-2)
```diff
@@ -1,12 +1,12 @@
 use std::{
 	collections::HashSet,
+	io,
 	path::{Path, PathBuf},
 };
 
 use ignore_files::{IgnoreFile, IgnoreFilesFromOriginArgs};
 use miette::{miette, IntoDiagnostic, Result};
 use project_origins::ProjectType;
-use tokio::fs::canonicalize;
 use tracing::{debug, info, warn};
 use watchexec::paths::common_prefix;
 
@@ -64,7 +64,6 @@ pub async fn project_origin(
 
 		debug!(?origins, "resolved all project origins");
 
-		// This canonicalize is probably redundant
 		canonicalize(
 			common_prefix(&origins)
 				.ok_or_else(|| miette!("no common prefix, but this should never fail"))?,
@@ -77,6 +76,33 @@ pub async fn project_origin(
 	Ok(project_origin)
 }
 
+/// `dunce::canonicalize` only strips the `\\?\` prefix off verbatim *disk* paths, so canonicalising
+/// inside a network share yields `\\?\UNC\server\share\...`, which many programs (notably the Go
+/// toolchain) refuse as a working directory. In that case keep the uncanonicalised path, as long as
+/// it isn't verbatim itself.
+fn prefer_non_verbatim(canonical: PathBuf, original: PathBuf) -> PathBuf {
+	if is_verbatim(&canonical) && !is_verbatim(&original) {
+		original
+	} else {
+		canonical
+	}
+}
+
+fn is_verbatim(path: &Path) -> bool {
+	path.as_os_str().as_encoded_bytes().starts_with(br"\\?\")
+}
+
+/// Canonicalises without leaving a verbatim `\\?\C:\...` path behind, which is what
+/// `tokio::fs::canonicalize` returns on Windows and what the rest of the CLI avoids.
+pub(crate) async fn canonicalize(path: impl AsRef<Path>) -> io::Result<PathBuf> {
+	let path = path.as_ref();
+	let canonical = tokio::fs::canonicalize(path).await?;
+	Ok(prefer_non_verbatim(
+		dunce::simplified(&canonical).to_owned(),
+		path.to_owned(),
+	))
+}
+
 /// Resolves the paths given with `-w` / `-W` against the workdir, for use as starting points of
 /// origin discovery. Relative paths are joined onto the workdir; the `/dev/null` sentinel (which
 /// means "watch nothing") is skipped. If nothing is left, the workdir itself is the only candidate.
@@ -335,6 +361,47 @@ mod tests {
 		);
 	}
 
+	/// Only Windows canonicalises to the verbatim form, but the handling is not platform-specific.
+	#[tokio::test]
+	async fn canonicalize_does_not_return_a_verbatim_path() {
+		let tmp = tempfile::tempdir().expect("tempdir");
+		let path = canonicalize(tmp.path()).await.expect("canonicalize");
+		assert!(
+			!path.as_os_str().as_encoded_bytes().starts_with(br"\\?\"),
+			"{path:?} is verbatim, so it cannot compare equal to a discovered origin"
+		);
+	}
+
+	#[test]
+	fn keeps_uncanonicalised_path_when_canonical_is_verbatim_unc() {
+		assert_eq!(
+			prefer_non_verbatim(
+				PathBuf::from(r"\\?\UNC\Mac\my-directory"),
+				PathBuf::from(r"Z:\my-directory"),
+			),
+			PathBuf::from(r"Z:\my-directory"),
+		);
+	}
+
+	#[test]
+	fn keeps_canonical_path_when_it_is_not_verbatim() {
+		assert_eq!(
+			prefer_non_verbatim(PathBuf::from(r"Z:\real"), PathBuf::from(r"Z:\link")),
+			PathBuf::from(r"Z:\real"),
+		);
+	}
+
+	#[test]
+	fn keeps_canonical_path_when_original_is_verbatim_too() {
+		assert_eq!(
+			prefer_non_verbatim(
+				PathBuf::from(r"\\?\UNC\Mac\my-directory"),
+				PathBuf::from(r"\\?\UNC\Mac\other"),
+			),
+			PathBuf::from(r"\\?\UNC\Mac\my-directory"),
+		);
+	}
+
 	#[test]
 	fn watch_candidates_resolve_against_the_workdir() {
 		let workdir = Path::new("/work/dir");
```

**File**: `crates/lib/src/sources/fs/recursor.rs` (modified, +47/-2)
```diff
@@ -45,7 +45,13 @@ impl Scanner for FsScanner {
 		}
 
 		let metadata = if link_metadata.file_type().is_symlink() {
-			fs::metadata(path)?
+			match fs::metadata(path) {
+				Ok(metadata) => metadata,
+				Err(error) if error.kind() == io::ErrorKind::NotFound => {
+					return Ok(EntryKind::Other)
+				}
+				Err(error) => return Err(error),
+			}
 		} else {
 			link_metadata
 		};
@@ -2368,6 +2374,10 @@ impl Recursor {
 	}
 
 	fn queue_remove_owner_prefix(&mut self, root: &Root, prefix: &Path) {
+		if !self.logical.contains_key(prefix) {
+			return;
+		}
+
 		self.retry_candidates
 			.retain(|(owner, path)| owner != root || !path.starts_with(prefix));
 		self.work.retain(|work| {
@@ -2527,7 +2537,10 @@ impl Recursor {
 
 #[cfg(test)]
 mod tests {
-	use std::sync::{Arc, Mutex};
+	use std::{
+		sync::{Arc, Mutex},
+		time::{Duration, Instant},
+	};
 
 	use notify::{ErrorKind, EventKind};
 	use watchexec_events::{Event, Priority};
@@ -2816,6 +2829,38 @@ mod tests {
 		panic!("recursor did not request a rebuild");
 	}
 
+	#[test]
+	fn plain_files_are_discovered_in_linear_time() {
+		fn traverse(files: usize) -> Duration {
+			let (mut recursor, _backend, scanner) = fixture();
+			directory(&scanner, "/work/tree");
+			let names: Vec<_> = (0..files)
+				.map(|index| format!("/work/tree/f{index}"))
+				.collect();
+			entries(
+				&scanner,
+				"/work/tree",
+				&names.iter().map(String::as_str).collect::<Vec<_>>(),
+			);
+			recursor.reconcile(&[WatchedPath::recursive("/work/tree")], filter([]));
+
+			let start = Instant::now();
+			while recursor.has_work() {
+				recursor.step();
+			}
+			start.elapsed()
+		}
+
+		let small = traverse(2_000);
+		let large = traverse(8_000);
+		let allowance = 8 * small.max(Duration::from_millis(1));
+		assert!(
+			large <= allowance,
+			"traversal is superlinear in file count: {small:?} for 2000 files \
+			 but {large:?} for 8000 (allowance {allowance:?})"
+		);
+	}
+
 	fn watched(backend: &Arc<Mutex<FakeBackendState>>, path: &str) -> usize {
 		backend
 			.lock()
```

**File**: `crates/lib/tests/fs_worker_real.rs` (modified, +41/-0)
```diff
@@ -923,6 +923,47 @@ async fn explicit_symlink_root_receives_target_events() {
 	harness.shutdown().await;
 }
 
+#[cfg(unix)]
+#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
+async fn dangling_symlink_is_not_reported_as_a_scan_error() {
+	use std::os::unix::fs::symlink;
+
+	// Native backends only: under the poll watcher notify is in charge
+	for case in managed_watcher_cases()
+		.into_iter()
+		.filter(|case| case.name == "native")
+	{
+		let temp = make_tempdir(case, "dangling-symlink");
+		let root = temp.path().join("root");
+		let dangling = root.join("dangling");
+		create_dir(&root);
+		symlink("missing-target", &dangling).unwrap_or_else(|error| {
+			panic!("failed to create dangling symlink {dangling:?}: {error}")
+		});
+
+		let mut harness =
+			FsHarness::start(case, vec![WatchedPath::recursive(&root)], true, ()).await;
+
+		// Traversal reaches it on every scan, so this would be an error per link per scan
+		let errors = harness.take_available_errors();
+		assert!(
+			errors.is_empty(),
+			"{} watcher reported errors for a dangling symlink: {errors:?}",
+			case.name
+		);
+
+		// The rest of the tree stays watched despite the dangling entry.
+		let sibling = root.join("sibling.txt");
+		write_file(&sibling, "contents");
+		let expected = harness.aliases_for(&sibling);
+		harness
+			.wait_for_any_path(&expected, "writing beside a dangling symlink")
+			.await;
+
+		harness.shutdown().await;
+	}
+}
+
 #[cfg(unix)]
 #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
 async fn path_local_scan_error_is_reported_without_stopping_worker() {
```

---

### Incident Patch 6: `1cf01283` (2026-09-15)
**Commit Message**: fix(cli): never produce verbatim paths when canonicalising

finishes off the process of unverbatimising Windows paths,
simultaneously fixing #1113

**File**: `crates/cli/src/args/command.rs` (modified, +2/-54)
```diff
@@ -1,7 +1,7 @@
 use std::{
 	ffi::{OsStr, OsString},
 	mem::take,
-	path::{Path, PathBuf},
+	path::PathBuf,
 };
 
 use clap::{
@@ -321,8 +321,7 @@ impl CommandArgs {
 			w
 		} else {
 			let curdir = std::env::current_dir().into_diagnostic()?;
-			let canonical = dunce::canonicalize(&curdir).into_diagnostic()?;
-			prefer_non_verbatim(canonical, curdir)
+			crate::dirs::canonicalize(curdir).await.into_diagnostic()?
 		};
 		info!(path=?workdir, "effective working directory");
 		self.workdir = Some(workdir);
@@ -332,22 +331,6 @@ impl CommandArgs {
 	}
 }
 
-/// `dunce::canonicalize` only strips the `\\?\` prefix off verbatim *disk* paths, so canonicalising
-/// inside a network share yields `\\?\UNC\server\share\...`, which many programs (notably the Go
-/// toolchain) refuse as a working directory. In that case keep the uncanonicalised path, as long as
-/// it isn't verbatim itself.
-fn prefer_non_verbatim(canonical: PathBuf, original: PathBuf) -> PathBuf {
-	if is_verbatim(&canonical) && !is_verbatim(&original) {
-		original
-	} else {
-		canonical
-	}
-}
-
-fn is_verbatim(path: &Path) -> bool {
-	path.as_os_str().as_encoded_bytes().starts_with(br"\\?\")
-}
-
 #[derive(Clone, Copy, Debug, Default, ValueEnum)]
 pub enum WrapMode {
 	#[default]
@@ -394,38 +377,3 @@ impl TypedValueParser for EnvVarValueParser {
 		})
 	}
 }
-
-#[cfg(test)]
-mod tests {
-	use super::*;
-
-	#[test]
-	fn keeps_uncanonicalised_path_when_canonical_is_verbatim_unc() {
-		assert_eq!(
-			prefer_non_verbatim(
-				PathBuf::from(r"\\?\UNC\Mac\my-directory"),
-				PathBuf::from(r"Z:\my-directory"),
-			),
-			PathBuf::from(r"Z:\my-directory"),
-		);
-	}
-
-	#[test]
-	fn keeps_canonical_path_when_it_is_not_verbatim() {
-		assert_eq!(
-			prefer_non_verbatim(PathBuf::from(r"Z:\real"), PathBuf::from(r"Z:\link")),
-			PathBuf::from(r"Z:\real"),
-		);
-	}
-
-	#[test]
-	fn keeps_canonical_path_when_original_is_verbatim_too() {
-		assert_eq!(
-			prefer_non_verbatim(
-				PathBuf::from(r"\\?\UNC\Mac\my-directory"),
-				PathBuf::from(r"\\?\UNC\Mac\other"),
-			),
-			PathBuf::from(r"\\?\UNC\Mac\my-directory"),
-		);
-	}
-}
```

**File**: `crates/cli/src/args/filtering.rs` (modified, +22/-16)
```diff
@@ -441,7 +441,9 @@ impl FilteringArgs {
 			crate::dirs::project_origin(&self, command).await?
 		};
 		debug!(path=?project_origin, "resolved project origin");
-		let project_origin = dunce::canonicalize(project_origin).into_diagnostic()?;
+		let project_origin = crate::dirs::canonicalize(project_origin)
+			.await
+			.into_diagnostic()?;
 		info!(path=?project_origin, "effective project origin");
 		self.project_origin = Some(project_origin.clone());
 
@@ -451,25 +453,29 @@ impl FilteringArgs {
 			.workdir
 			.as_deref()
 			.expect("workdir is resolved by CommandArgs::normalise");
-		let resolve = |path: PathBuf| {
-			if path.is_absolute() {
-				Ok(path)
-			} else {
-				dunce::canonicalize(workdir.join(path)).into_diagnostic()
-			}
-		};
-
-		self.paths = take(&mut self.recursive_paths)
+		let mut paths = BTreeSet::new();
+		for (path, recursive) in take(&mut self.recursive_paths)
 			.into_iter()
-			.map(|path| resolve(path).map(WatchedPath::recursive))
+			.map(|path| (path, true))
 			.chain(
 				take(&mut self.non_recursive_paths)
 					.into_iter()
-					.map(|path| resolve(path).map(WatchedPath::non_recursive)),
-			)
-			.collect::<Result<BTreeSet<_>>>()?
-			.into_iter()
-			.collect();
+					.map(|path| (path, false)),
+			) {
+			let path = if path.is_absolute() {
+				path
+			} else {
+				crate::dirs::canonicalize(workdir.join(path))
+					.await
+					.into_diagnostic()?
+			};
+			paths.insert(if recursive {
+				WatchedPath::recursive(path)
+			} else {
+				WatchedPath::non_recursive(path)
+			});
+		}
+		self.paths = paths.into_iter().collect();
 
 		if self.paths.len() == 1
 			&& self
```

**File**: `crates/cli/src/dirs.rs` (modified, +69/-2)
```diff
@@ -1,12 +1,12 @@
 use std::{
 	collections::HashSet,
+	io,
 	path::{Path, PathBuf},
 };
 
 use ignore_files::{IgnoreFile, IgnoreFilesFromOriginArgs};
 use miette::{miette, IntoDiagnostic, Result};
 use project_origins::ProjectType;
-use tokio::fs::canonicalize;
 use tracing::{debug, info, warn};
 use watchexec::paths::common_prefix;
 
@@ -64,7 +64,6 @@ pub async fn project_origin(
 
 		debug!(?origins, "resolved all project origins");
 
-		// This canonicalize is probably redundant
 		canonicalize(
 			common_prefix(&origins)
 				.ok_or_else(|| miette!("no common prefix, but this should never fail"))?,
@@ -77,6 +76,33 @@ pub async fn project_origin(
 	Ok(project_origin)
 }
 
+/// `dunce::canonicalize` only strips the `\\?\` prefix off verbatim *disk* paths, so canonicalising
+/// inside a network share yields `\\?\UNC\server\share\...`, which many programs (notably the Go
+/// toolchain) refuse as a working directory. In that case keep the uncanonicalised path, as long as
+/// it isn't verbatim itself.
+fn prefer_non_verbatim(canonical: PathBuf, original: PathBuf) -> PathBuf {
+	if is_verbatim(&canonical) && !is_verbatim(&original) {
+		original
+	} else {
+		canonical
+	}
+}
+
+fn is_verbatim(path: &Path) -> bool {
+	path.as_os_str().as_encoded_bytes().starts_with(br"\\?\")
+}
+
+/// Canonicalises without leaving a verbatim `\\?\C:\...` path behind, which is what
+/// `tokio::fs::canonicalize` returns on Windows and what the rest of the CLI avoids.
+pub(crate) async fn canonicalize(path: impl AsRef<Path>) -> io::Result<PathBuf> {
+	let path = path.as_ref();
+	let canonical = tokio::fs::canonicalize(path).await?;
+	Ok(prefer_non_verbatim(
+		dunce::simplified(&canonical).to_owned(),
+		path.to_owned(),
+	))
+}
+
 /// Resolves the paths given with `-w` / `-W` against the workdir, for use as starting points of
 /// origin discovery. Relative paths are joined onto the workdir; the `/dev/null` sentinel (which
 /// means "watch nothing") is skipped. If nothing is left, the workdir itself is the only candidate.
@@ -335,6 +361,47 @@ mod tests {
 		);
 	}
 
+	/// Only Windows canonicalises to the verbatim form, but the handling is not platform-specific.
+	#[tokio::test]
+	async fn canonicalize_does_not_return_a_verbatim_path() {
+		let tmp = tempfile::tempdir().expect("tempdir");
+		let path = canonicalize(tmp.path()).await.expect("canonicalize");
+		assert!(
+			!path.as_os_str().as_encoded_bytes().starts_with(br"\\?\"),
+			"{path:?} is verbatim, so it cannot compare equal to a discovered origin"
+		);
+	}
+
+	#[test]
+	fn keeps_uncanonicalised_path_when_canonical_is_verbatim_unc() {
+		assert_eq!(
+			prefer_non_verbatim(
+				PathBuf::from(r"\\?\UNC\Mac\my-directory"),
+				PathBuf::from(r"Z:\my-directory"),
+			),
+			PathBuf::from(r"Z:\my-directory"),
+		);
+	}
+
+	#[test]
+	fn keeps_canonical_path_when_it_is_not_verbatim() {
+		assert_eq!(
+			prefer_non_verbatim(PathBuf::from(r"Z:\real"), PathBuf::from(r"Z:\link")),
+			PathBuf::from(r"Z:\real"),
+		);
+	}
+
+	#[test]
+	fn keeps_canonical_path_when_original_is_verbatim_too() {
+		assert_eq!(
+			prefer_non_verbatim(
+				PathBuf::from(r"\\?\UNC\Mac\my-directory"),
+				PathBuf::from(r"\\?\UNC\Mac\other"),
+			),
+			PathBuf::from(r"\\?\UNC\Mac\my-directory"),
+		);
+	}
+
 	#[test]
 	fn watch_candidates_resolve_against_the_workdir() {
 		let workdir = Path::new("/work/dir");
```

---

### Incident Patch 7: `3129ee7b` (2026-09-15)
**Commit Message**: fix(cli): resolve relative watched paths against the working directory

this is not a breaking change because it was masked until recently by
another bug which made project origin = working directory in this
context; fixing that made this bug stick out in cases where that's not
the case already

another part of the fix for #1113

**File**: `crates/cli/src/args/filtering.rs` (modified, +57/-21)
```diff
@@ -445,28 +445,28 @@ impl FilteringArgs {
 		info!(path=?project_origin, "effective project origin");
 		self.project_origin = Some(project_origin.clone());
 
+		// Not the origin: that's discovered by walking up *from* these paths, and sits
+		// above the workdir whenever the project root does. Matches dirs::watch_candidates
+		let workdir = command
+			.workdir
+			.as_deref()
+			.expect("workdir is resolved by CommandArgs::normalise");
+		let resolve = |path: PathBuf| {
+			if path.is_absolute() {
+				Ok(path)
+			} else {
+				dunce::canonicalize(workdir.join(path)).into_diagnostic()
+			}
+		};
+
 		self.paths = take(&mut self.recursive_paths)
 			.into_iter()
-			.map(|path| {
-				{
-					if path.is_absolute() {
-						Ok(path)
-					} else {
-						dunce::canonicalize(project_origin.join(path)).into_diagnostic()
-					}
-				}
-				.map(WatchedPath::recursive)
-			})
-			.chain(take(&mut self.non_recursive_paths).into_iter().map(|path| {
-				{
-					if path.is_absolute() {
-						Ok(path)
-					} else {
-						dunce::canonicalize(project_origin.join(path)).into_diagnostic()
-					}
-				}
-				.map(WatchedPath::non_recursive)
-			}))
+			.map(|path| resolve(path).map(WatchedPath::recursive))
+			.chain(
+				take(&mut self.non_recursive_paths)
+					.into_iter()
+					.map(|path| resolve(path).map(WatchedPath::non_recursive)),
+			)
 			.collect::<Result<BTreeSet<_>>>()?
 			.into_iter()
 			.collect();
@@ -481,7 +481,7 @@ impl FilteringArgs {
 			self.paths = Vec::new();
 		} else if self.paths.is_empty() {
 			info!("no paths, using current directory");
-			self.paths.push(command.workdir.as_deref().unwrap().into());
+			self.paths.push(workdir.into());
 		}
 		info!(paths=?self.paths, "effective watched paths");
 
@@ -509,3 +509,39 @@ pub enum FsEvent {
 	Modify,
 	Metadata,
 }
+
+#[cfg(test)]
+mod tests {
+	use super::*;
+	use crate::args::Args;
+
+	/// The origin is an ancestor of the workdir here, so the two resolutions differ.
+	#[tokio::test]
+	async fn relative_watched_paths_resolve_against_the_workdir() {
+		let tmp = tempfile::tempdir().expect("tempdir");
+		let root = tmp.path().join("project");
+		let workdir = root.join("sub");
+		let target = workdir.join("target");
+		std::fs::create_dir_all(&target).expect("create dirs");
+		std::fs::write(root.join("Cargo.toml"), "").expect("write origin marker");
+
+		let mut args = Args::parse_from(["watchexec", "-w", "./target", "true"]);
+		args.command.workdir = Some(workdir.clone());
+		args.filtering
+			.normalise(&args.command)
+			.await
+			.expect("normalise should resolve the watched path");
+
+		assert_eq!(
+			args.filtering.project_origin,
+			Some(dunce::canonicalize(&root).expect("canonicalize root")),
+			"the origin is meant to be the ancestor project, otherwise this proves nothing"
+		);
+		assert_eq!(
+			args.filtering.paths,
+			vec![WatchedPath::recursive(
+				dunce::canonicalize(&target).expect("canonicalize target")
+			)]
+		);
+	}
+}
```

---

### Incident Patch 8: `c25cb0d6` (2026-09-15)
**Commit Message**: fix(fs): treat a dangling symlink as an ordinary entry

previously that issued a not found error as it tried to resolve, but
it's not an error per se, as dangling symlinks are a normal filesystem
state technically (even if indicative of something probably broken in
the user's organisation system). we reserve NotFound for things that
vanish while scanning, and still detect and report on symlink loops

found while looking into #1112, though not directly related

**File**: `crates/lib/src/sources/fs/recursor.rs` (modified, +7/-1)
```diff
@@ -45,7 +45,13 @@ impl Scanner for FsScanner {
 		}
 
 		let metadata = if link_metadata.file_type().is_symlink() {
-			fs::metadata(path)?
+			match fs::metadata(path) {
+				Ok(metadata) => metadata,
+				Err(error) if error.kind() == io::ErrorKind::NotFound => {
+					return Ok(EntryKind::Other)
+				}
+				Err(error) => return Err(error),
+			}
 		} else {
 			link_metadata
 		};
```

**File**: `crates/lib/tests/fs_worker_real.rs` (modified, +41/-0)
```diff
@@ -923,6 +923,47 @@ async fn explicit_symlink_root_receives_target_events() {
 	harness.shutdown().await;
 }
 
+#[cfg(unix)]
+#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
+async fn dangling_symlink_is_not_reported_as_a_scan_error() {
+	use std::os::unix::fs::symlink;
+
+	// Native backends only: under the poll watcher notify is in charge
+	for case in managed_watcher_cases()
+		.into_iter()
+		.filter(|case| case.name == "native")
+	{
+		let temp = make_tempdir(case, "dangling-symlink");
+		let root = temp.path().join("root");
+		let dangling = root.join("dangling");
+		create_dir(&root);
+		symlink("missing-target", &dangling).unwrap_or_else(|error| {
+			panic!("failed to create dangling symlink {dangling:?}: {error}")
+		});
+
+		let mut harness =
+			FsHarness::start(case, vec![WatchedPath::recursive(&root)], true, ()).await;
+
+		// Traversal reaches it on every scan, so this would be an error per link per scan
+		let errors = harness.take_available_errors();
+		assert!(
+			errors.is_empty(),
+			"{} watcher reported errors for a dangling symlink: {errors:?}",
+			case.name
+		);
+
+		// The rest of the tree stays watched despite the dangling entry.
+		let sibling = root.join("sibling.txt");
+		write_file(&sibling, "contents");
+		let expected = harness.aliases_for(&sibling);
+		harness
+			.wait_for_any_path(&expected, "writing beside a dangling symlink")
+			.await;
+
+		harness.shutdown().await;
+	}
+}
+
 #[cfg(unix)]
 #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
 async fn path_local_scan_error_is_reported_without_stopping_worker() {
```

---

### Incident Patch 9: `0e0146fa` (2026-09-15)
**Commit Message**: fix(fs): stop rescanning pending for every plain file

take advantage of hashmap O(1) check to cut out a quadratic behaviour
which is visible mostly when there's a large amount of files flat in
a directory (rather than the more usual deep directory structures)

fixes #1112

**File**: `crates/lib/src/sources/fs/recursor.rs` (modified, +40/-1)
```diff
@@ -2368,6 +2368,10 @@ impl Recursor {
 	}
 
 	fn queue_remove_owner_prefix(&mut self, root: &Root, prefix: &Path) {
+		if !self.logical.contains_key(prefix) {
+			return;
+		}
+
 		self.retry_candidates
 			.retain(|(owner, path)| owner != root || !path.starts_with(prefix));
 		self.work.retain(|work| {
@@ -2527,7 +2531,10 @@ impl Recursor {
 
 #[cfg(test)]
 mod tests {
-	use std::sync::{Arc, Mutex};
+	use std::{
+		sync::{Arc, Mutex},
+		time::{Duration, Instant},
+	};
 
 	use notify::{ErrorKind, EventKind};
 	use watchexec_events::{Event, Priority};
@@ -2816,6 +2823,38 @@ mod tests {
 		panic!("recursor did not request a rebuild");
 	}
 
+	#[test]
+	fn plain_files_are_discovered_in_linear_time() {
+		fn traverse(files: usize) -> Duration {
+			let (mut recursor, _backend, scanner) = fixture();
+			directory(&scanner, "/work/tree");
+			let names: Vec<_> = (0..files)
+				.map(|index| format!("/work/tree/f{index}"))
+				.collect();
+			entries(
+				&scanner,
+				"/work/tree",
+				&names.iter().map(String::as_str).collect::<Vec<_>>(),
+			);
+			recursor.reconcile(&[WatchedPath::recursive("/work/tree")], filter([]));
+
+			let start = Instant::now();
+			while recursor.has_work() {
+				recursor.step();
+			}
+			start.elapsed()
+		}
+
+		let small = traverse(2_000);
+		let large = traverse(8_000);
+		let allowance = 8 * small.max(Duration::from_millis(1));
+		assert!(
+			large <= allowance,
+			"traversal is superlinear in file count: {small:?} for 2000 files \
+			 but {large:?} for 8000 (allowance {allowance:?})"
+		);
+	}
+
 	fn watched(backend: &Arc<Mutex<FakeBackendState>>, path: &str) -> usize {
 		backend
 			.lock()
```

---

### Incident Patch 10: `53611732` (2026-09-13)
**Commit Message**: Fix syntax

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: Bug report
-about: Something is wrong
+description: Something is wrong
 labels:
   - bug
   - need-info
```

#### Recent Merged Pull Requests:
- **PR #1130** (2026-09-29): fix(fs): infer file type of removed paths from the event kind (@lsh4711)
- **PR #1129** (2026-09-29): fix(cli): error instead of panicking on an unreadable @argfile (@00200200)
- **PR #1128** (2026-09-29): chore(deps): bump taiki-e/install-action from 2.86.5 to 2.87.20 (@dependabot[bot])
- **PR #1125** (2026-09-29): chore(deps): bump release-plz/action from 0.5.131 to 0.5.139 (@dependabot[bot])
- **PR #1123** (2026-09-23): docs: clarify opt-in event emission in the CLI README (@Likio3000)
- **PR #1122** (closed): chore(deps): bump release-plz/action from 0.5.131 to 0.5.138 (@dependabot[bot])
- **PR #1121** (closed): chore(deps): bump taiki-e/install-action from 2.86.5 to 2.87.15 (@dependabot[bot])
- **PR #1120** (2026-09-15): release (@passcod)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
