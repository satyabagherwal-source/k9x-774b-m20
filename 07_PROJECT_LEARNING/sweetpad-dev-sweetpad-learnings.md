# Forensic Learning Record (Deep Inspection): sweetpad-dev/sweetpad

> **Canonical Artifact**: `07_PROJECT_LEARNING/sweetpad-dev-sweetpad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T21:15:57.334Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sweetpad-dev/sweetpad`
- **Description**: xcodebuild for humans and agents: build, run, debug, and test iOS, macOS, tvOS, watchOS, and visionOS apps from your terminal.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 1886 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sweetpad-cli/src/cli/render.rs`
```
//! The render contract: a command produces a payload, and the dispatcher in
//! [`crate::cli::run`] renders it once — choosing human output or the JSON
//! envelope centrally, so a command never branches on `--json` itself.
//!
//! Migrated commands return [`Rendered::Data`] with a typed payload; commands
//! that stream their own output live (or haven't migrated yet) return
//! [`Rendered::Streamed`] and the dispatcher renders nothing for them.

use crate::cli::output::Output;

/// A renderable command payload. `human` writes the human view through `out`'s
/// sinks; `json` returns the DATA only — the `{schema, ok, data}` envelope is
/// added centrally by the dispatcher, so a payload never knows about it.
pub trait Render {
    /// Human-mode rendering. Free to use `out.line`/`out.item`/`out.use_color()`.
    fn human(&self, out: &Output);
    /// The `data` field of the success envelope. Pure; no I/O.
    fn json(&self) -> serde_json::Value;
}

/// What a command hands back to the dispatcher.
///
/// - Query/action commands return [`Rendered::Data`] — rendered once, centrally.
/// - Streaming commands (and not-yet-migrated ones that self-emit) return
///   [`Rendered::Streamed`]; the dispatcher emits nothing for them.
///
/// The `exit` on `Data` lets a command render its report *and* exit non-zero
/// (e.g. `doctor` with problems, a red `test` suite) without a separate error
/// path — process exit is a dispatch concern, not part of the `Render` trait.
pub enum Rendered {
    Data { payload: Box<dyn Render>, exit: u8 },
    Streamed,
}

impl Rendered {
    /// A payload that renders and exits 0.
    pub fn data(r: impl Render + 'static) -> Self {
        Self::Data {
            payload: Box::new(r),
            exit: 0,
        }
    }

    /// A payload that renders but forces a non-zero process exit.
    pub fn data_with_exit(r: impl Render + 'static, exit: u8) -> Self {
        Self::Data {
            payload: Box::new(r),
            exit,
        }
    }
}

```

### Core Architecture Module: `sweetpad-cli/src/cli/state.rs`
```
//! Machine-managed selection state: `~/.local/state/sweetpad/state.toml`.
//!
//! Remembers the user's interactive picks — scheme, configuration, sdk, and
//! destination, plus a separate testing context, recently-used and most-used
//! destinations, and the last launched app — per project so the daily loop
//! doesn't re-prompt. Mirrors the richer context the VS Code extension keeps in
//! its workspace state. Unlike
//! [`crate::cli::config`], this file is freely rewritten by the tool — never
//! hand-author it. Keyed by canonicalized project/workspace path.
//!
//! Honors `XDG_STATE_HOME`, falling back to `~/.local/state`.

use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// The whole state file: one [`ProjectState`] per project key.
#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct State {
    pub projects: BTreeMap<String, ProjectState>,
    /// Set when the on-disk file exists but couldn't be *read* (permissions,
    /// I/O error): the in-memory state is then a guess, and [`save`](State::save)
    /// becomes a no-op — writing would replace every project's remembered
    /// context with near-emptiness.
    #[serde(skip)]
    pub read_only: bool,
}

/// Remembered selections for a single project. Scalar fields come first so the
/// nested tables (testing, recents, usage, last-launched) serialize as valid
/// TOML after them; the table fields are skipped when empty so simple entries
/// stay simple.
#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct ProjectState {
    /// The build/run context — what `build` and `app` use.
    pub scheme: Option<String>,
    pub configuration: Option<String>,
    pub sdk: Option<String>,
    pub destination: Option<String>,

    /// The testing context, kept separate from the build context (mirrors the
    /// extension's `testing.*` keys). `test` reads this, falling back to the
    /// build context where a field is unset.
    #[serde(skip_serializing_if = "TestingState::is_empty")]
    pub testing: TestingState,

    /// Destinations selected before, unique by id, in first-seen order — the
    /// "recent" set. Stored structurally so they survive a device being offline.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub destination_recents: Vec<SelectedDestination>,

    /// How many times each destination (by id) has been selected — drives the
    /// most-used-first picker ordering.
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub destination_usage: BTreeMap<String, u32>,

    /// Named destination aliases (`context alias work-phone <UDID>`), resolved
    /// by `--on NAME`.
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub destination_aliases: BTreeMap<String, String>,

    /// The app launched most recently, for re-launch and inspection.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_launched_app: Option<LastLaunchedApp>,
}

impl ProjectState {
    /// Whether nothing is remembered at all — used to drop the entry from the
    /// file once its last field is cleared.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.scheme.is_none()
            && self.configuration.is_none()
            && self.sdk.is_none()
            && self.destination.is_none()
            && self.testing.is_empty()
            && self.destination_recents.is_empty()
            && self.destination_usage.is_empty()
            && self.destination_aliases.is_empty()
            && self.last_launched_app.is_none()
    }
}

/// The testing context — the test action's own scheme/configuration/target/
/// destination, independent of the build context.
#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct TestingState {
    pub scheme: Option<String>,
    pub configuration: Option<String>,
    pub target: Option<String>,
    pub destination: Option<String>,
}

impl TestingState {
    /// Whether nothing is set — used to drop the table from the file entirely.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.scheme.is_none()
            && self.configuration.is_none()
            && self.target.is_none()
            && self.destination.is_none()
    }
}

/// A destination remembered structurally (id + kind + display name), so recents
/// and usage stats survive the device being offline. Mirrors the extension's
/// `SelectedDestination`; `id` is the simulator UDID for simulators.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SelectedDestination {
    pub id: String,
    /// Destination kind, e.g. `iOSSimulator` / `watchOSSimulator`.
    pub kind: String,
    pub name: String,
}

/// The most recently launched app, kept for re-launch and for inspection by
/// `context show`. A flat record with a `kind` discriminator (rather than a Rust
/// enum) so it serializes to a single, TOML-clean table.
#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct LastLaunchedApp {
    /// `simulator` | `device` | `macos`.
    pub kind: String,
    pub app_path: String,
    pub bundle_identifier: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
    /// `CFBundleExecutable` — the process name in os_log (devices).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable_name: Option<String>,
    /// Simulator UDID (simulator launches).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub simulator_udid: Option<String>,
    /// Destination id + kind (device launches).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination_type: Option<String>,
    /// The scheme, configuration and `-destination` specifier the launch was
    /// planned with, so a verb given targeting flags can tell whether they
    /// name this launch.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheme: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub configuration: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination: Option<String>,
}

impl State {
    /// Standard state path, honoring `XDG_STATE_HOME`.
    #[must_use]
    pub fn path() -> Option<PathBuf> {
        state_dir().map(|d| d.join("sweetpad").join("state.toml"))
    }

    /// Load remembered state, preserving what's on disk against both failure
    /// modes:
    ///
    /// - a file that exists but can't be **read** (permissions, I/O error)
    ///   yields defaults flagged [`read_only`](State::read_only) — saves are
    ///   skipped for this run, so the unreadable file survives intact;
    /// - a file that reads but doesn't **parse** is moved aside to a unique
    ///   `state.toml.corrupt[.N]` backup and a warning names both paths.
    ///
    /// Without either guard, the next best-effort [`save`](State::save) would
    /// rewrite the whole file from the near-empty in-memory state — every
    /// project's remembered context lost without a trace.
    #[must_use]
    pub fn load_or_quarantine() -> (Self, Option<String>) {
        let Some(path) = Self::path() else {
            return (Self::default(), None);
        };
        let text = match std::fs::read_to_string(&path) {
            Ok(text) => text,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return (Self::default(), None);
            }
            Err(e) => {
                let state = Self {
                    read_only: true,
                    ..Self::default()
                };
                return (
                    state,
                    Some(format!(
                        "cannot read the state file {} ({e}); continuing without remembered \
                         context, and skipping state saves so it isn't overwritten",
                        path.display()
                    )),
                );
            }
        };
        match toml::from_str(&text) {
            Ok(state) => (state, None),
            Err(parse_err) => {
                let backup = quarantine_path(&path);
                let warning = match std::fs::rename(&path, &backup) {
                    Ok(()) => format!(
                        "state file is corrupt ({}: {parse_err}); moved it to {} and starting fresh",
                        path.display(),
                        backup.display()
                    ),
                    Err(_) => format!(
                        "state file is corrupt and will be overwritten on the next save: {}: {parse_err}",
                        path.display()
                    ),
                };
                (Self::default(), Some(warning))
            }
        }
    }

    /// Persist state, creating the parent directory as needed. Written to a
    /// temp file and renamed into place, so a crash or a concurrent session
    /// can never leave a torn half-written `state.toml` (concurrent saves are
    /// last-writer-wins with each writer's *complete* file). What lands on disk
    /// is the [`pruned_view`](State::pruned_view), so the file can't grow
    /// forever.
    ///
    /// In [`read_only`](State::read_only) mode this is an error: best-effort
    /// callers (`remember`) swallow it with `let _ =`, while commands whose
    /// whole purpose is the write (`context set`) must not report success for
    /// a save that never happened.
    pub fn save(&self) -> Result<(), String> {
        // PID alone distinguishes processes; the counter distinguishes saves
        // within this process, so two same-process saves can never interleave
        // writes into one temp file and rename a torn mix into place.
        static SAVE_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        // An unreadable-on-load file must never be replaced by this run's
        // near-empty v
```

### Core Architecture Module: `sweetpad-core/examples/dump_settings.rs`
```
//! Scratch diagnostic: resolve a (project, target, config, sdk, arch) tuple
//! against a versioned xcspec cache and print selected keys (or all).
//! Usage: cargo run --example dump_settings -- <xcodeproj> <target> <config> <sdk> <arch> <xcspec-ver> [KEY ...]

use sweetpad_core::build_context::{BuildContext, ResolveQuery};
use sweetpad_lib::xcspec;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [proj, target, config, sdk, arch, ver, ..] = args.as_slice() else {
        eprintln!(
            "usage: dump_settings <xcodeproj> <target> <config> <sdk> <arch> <xcspec-ver> [KEY ...]"
        );
        std::process::exit(2);
    };
    let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let xcspec_root = root.join(format!("xcspec-cache/xcode-{ver}"));
    let sdks = xcspec_root.join("sdksettings");
    let catalog = xcspec::load_catalog(&xcspec_root, Some(&sdks)).unwrap();
    let ctx = BuildContext::open(std::path::Path::new(proj))
        .unwrap()
        .with_xcspec(catalog);
    let resolved = ctx
        .resolve(&ResolveQuery::new(target, config, sdk, arch))
        .unwrap();
    let keys: Vec<&String> = args.iter().skip(6).collect();
    for (k, v) in &resolved.settings {
        if keys.is_empty() || keys.contains(&k) {
            println!("{k} = {v:?}");
        }
    }
}

```

### Core Architecture Module: `sweetpad-core/src/app_locator.rs`
```
//! Finding the app a build produced: which of a scheme's targets is the one to
//! launch, and where its bundle is, from the build settings that build
//! resolves. The CLI's `app` verbs and the VS Code extension (through the
//! native addon) both locate the app here, so they launch the same bundle.

use std::path::{Path, PathBuf};

use sweetpad_lib::destination::RunDestination;
use sweetpad_lib::project::{absolutize, canonicalize_sdk_base, standardize};
use sweetpad_lib::scheme;

use crate::build_settings::{BuildSettingsOptions, TargetSettings, resolve_build_settings};
use crate::xcodebuild_args;

/// What a build's command line adds to the build settings `xcodebuild`
/// resolves, above every project layer: the `-derivedDataPath` that places
/// the build, the `-xcconfig` overlay, and the `KEY=VALUE` assignments. Each
/// caller that resolves settings for a build reads them from the same
/// arguments the build takes, so the locator, `settings show`, the hot-reload
/// recompiler and the index agree with it.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CommandLineSettings {
    pub derived_data_path: Option<PathBuf>,
    /// `xcodebuild` takes one `-xcconfig` and refuses a second, so this is
    /// the last one given.
    pub xcconfig: Option<PathBuf>,
    pub overrides: Vec<(String, String)>,
}

impl CommandLineSettings {
    /// Read them from `args`, the arguments a build passes `xcodebuild`. The
    /// paths of the two flags resolve against `working_dir` (see
    /// [`path_value`]). The settings stay as typed: the resolver reads a
    /// relative `SYMROOT=build` against each target's project directory, as
    /// `xcodebuild` does.
    #[must_use]
    pub fn of(args: &[String], working_dir: Option<&Path>) -> Self {
        Self {
            derived_data_path: path_value(args, "-derivedDataPath", working_dir),
            xcconfig: path_value(args, "-xcconfig", working_dir),
            overrides: xcodebuild_args::settings(args),
        }
    }
}

/// The value after the last `flag` in `args`, as a path `xcodebuild` running
/// in `working_dir` reads it (`None` is the current directory). `xcodebuild`
/// knows that directory by its physical path, so a relative path joins its
/// [`standardize`] spelling: for a project reached through a symlinked `link`,
/// `-derivedDataPath dd` is `real/dd` and `../dd` is the real directory's
/// sibling.
#[must_use]
pub fn path_value(args: &[String], flag: &str, working_dir: Option<&Path>) -> Option<PathBuf> {
    let path = PathBuf::from(xcodebuild_args::last_value(args, flag)?);
    if path.is_absolute() {
        return Some(path);
    }
    let base = working_dir.unwrap_or_else(|| Path::new("."));
    Some(absolutize(&standardize(base).join(path)))
}

/// The launchable product of a build: the `.app` path, its bundle id, and the
/// executable inside it (used to launch macOS apps directly).
#[derive(Debug, Clone)]
pub struct AppBundle {
    pub path: PathBuf,
    pub bundle_id: String,
    /// `TARGET_BUILD_DIR/EXECUTABLE_PATH`, the binary to run for a macOS app.
    pub executable: PathBuf,
}

/// What a located target builds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProductKind {
    /// A `.app` bundle with a bundle id: installed and launched on any
    /// platform it supports.
    App,
    /// A macOS command-line tool: a bare executable, run in place on the Mac.
    /// Its [`AppBundle`] names the executable as its path, and its bundle id
    /// is empty when the target sets none.
    Tool,
}

/// The product [`locate`] found: its bundle, what kind of product it is, and
/// the resolved settings of the target that builds it.
#[derive(Debug)]
pub struct Located {
    pub app: AppBundle,
    pub kind: ProductKind,
    pub settings: TargetSettings,
}

/// The settings [`pick`] reads. [`locate`] resolves them whatever keys its
/// caller asks for, and trims the result afterwards.
const LOCATOR_KEYS: [&str; 7] = [
    "WRAPPER_NAME",
    "FULL_PRODUCT_NAME",
    "TARGET_BUILD_DIR",
    "PRODUCT_BUNDLE_IDENTIFIER",
    "PRODUCT_TYPE",
    "EXECUTABLE_PATH",
    "SUPPORTED_PLATFORMS",
];

/// The error when no target builds anything to launch.
const NOTHING_TO_LAUNCH: &str = "could not find a launchable .app in the resolved build settings";

/// Resolve `opts` and pick the product a build with them writes (see
/// [`pick`]), from the scheme's Run action and the destination's platform.
/// `opts.keys` trims the returned target's settings, as it trims a
/// [`resolve_build_settings`] result.
///
/// # Errors
/// The resolver's error, or one saying no target builds a launchable `.app`.
pub fn locate(mut opts: BuildSettingsOptions) -> Result<Located, String> {
    let keys = opts.keys.take();
    if let Some(wanted) = &keys {
        let mut all = wanted.clone();
        all.extend(LOCATOR_KEYS.iter().map(|k| (*k).to_string()));
        opts.keys = Some(all);
    }
    let settings = resolve_build_settings(&opts)?;
    let container = opts.workspace.as_deref().or(opts.project.as_deref());
    let launch = container
        .zip(opts.scheme.as_deref())
        .and_then(|(container, name)| launch_target(container, name));
    pick(
        settings,
        platform(opts.destination.as_ref(), &opts.sdk).as_deref(),
        launch.as_deref(),
        keys.as_deref(),
    )
}

/// Pick the product to launch out of a build's resolved `settings`, with the
/// picked target's settings trimmed to `keys` when given. [`locate`] resolves
/// the settings in-process; a caller that resolved them some other way
/// (`xcodebuild -showBuildSettings`) picks with this directly.
///
/// Candidates are targets that build a `.app` wrapper and declare a bundle id.
/// The target the scheme's Run action launches (`launch_target`) wins when it
/// is a candidate that can run on `platform`: a scheme that builds a helper
/// app, a second app or a share extension ahead of the one it runs launches
/// the one Xcode runs. Otherwise one whose `SUPPORTED_PLATFORMS` covers
/// `platform` (an SDK name, `iphonesimulator`) wins: in an iOS + watchOS
/// scheme the watch companion builds *first* (dependency order), and blind
/// first-pick would install the watch app onto the iPhone simulator. Targets
/// that don't state their platforms (or no `platform`) fall back to
/// first-candidate order, and when the filter rejects *every* candidate (Mac
/// Catalyst declaring `iphoneos` under a `platform=macOS` destination), the
/// first `.app` still wins over a nothing-to-launch error.
///
/// With no `.app` at all, on the Mac or with no `platform`, a command-line
/// tool is the product: the Run action's, else the first.
///
/// # Errors
/// When no target builds a launchable `.app` or, on the Mac, a tool.
pub fn pick(
    mut settings: Vec<TargetSettings>,
    platform: Option<&str>,
    launch_target: Option<&str>,
    keys: Option<&[String]>,
) -> Result<Located, String> {
    let (index, kind) = pick_index(&settings, platform, launch_target)?;
    let mut target = settings.swap_remove(index);
    let app = match kind {
        ProductKind::App => app_of(&target),
        ProductKind::Tool => tool_of(&target),
    }
    .expect("pick_index picks a target that builds its kind");
    if let Some(keys) = keys {
        target.settings.retain(|k, _| keys.iter().any(|w| w == k));
    }
    Ok(Located {
        app,
        kind,
        settings: target,
    })
}

/// The platform [`pick`] narrows to for a build: the destination's, else the
/// SDK's, as `SUPPORTED_PLATFORMS` spells it (`iphonesimulator`). `None` when
/// the build names neither.
#[must_use]
pub fn platform(destination: Option<&RunDestination>, sdk: &str) -> Option<String> {
    destination
        .map(|d| d.platform.clone())
        .or_else(|| (!sdk.is_empty()).then(|| canonicalize_sdk_base(sdk)))
}

/// [`pick`]'s choice, as an index into `settings` and what it builds.
fn pick_index(
    settings: &[TargetSettings],
    platform: Option<&str>,
    launch_target: Option<&str>,
) -> Result<(usize, ProductKind), String> {
    // Whether `t` runs on `platform`: `None` when there is no platform to
    // match or the target doesn't state its own.
    let runs_on = |t: &TargetSettings| {
        let platforms = t.settings.get("SUPPORTED_PLATFORMS")?;
        let wanted = platform?;
        Some(platforms.split_whitespace().any(|p| p == wanted))
    };
    let of_kind = |test: fn(&TargetSettings) -> Option<AppBundle>| {
        settings
            .iter()
            .enumerate()
            .filter(move |(_, t)| test(t).is_some())
    };
    let launched = |t: &TargetSettings| launch_target.is_some_and(|name| t.target == name);
    if let Some((i, _)) = of_kind(app_of).find(|(_, t)| launched(t) && runs_on(t) != Some(false)) {
        return Ok((i, ProductKind::App));
    }
    let mut fallback = None;
    let mut first_app = None;
    for (i, t) in of_kind(app_of) {
        first_app.get_or_insert(i);
        match runs_on(t) {
            // The target states its platforms and covers the destination: a
            // definitive pick.
            Some(true) => return Ok((i, ProductKind::App)),
            // States its platforms and the destination is not among them:
            // not this app (the watch-companion case).
            Some(false) => {}
            // No filter requested, or the target doesn't say: a candidate in
            // declaration order.
            None => {
                fallback.get_or_insert(i);
            }
        }
    }
    if let Some(i) = fallback.or(first_app) {
        return Ok((i, ProductKind::App));
    }
    if platform.is_none_or(|p| p == "macosx") {
        let tool = of_kind(tool_of)
            .find(|(_, t)| launched(t))
            .or_else(|| of_kind(tool_of).next());
        if let Some((i, _)) = tool {
            return Ok((i, ProductKind::Tool));
        }
    }
    Err(NOTHING_TO_LAUNCH.to_string())
}

/// The launchable bundle a target's resolved settings
```

### Core Architecture Module: `sweetpad-core/src/bin/bsp_server.rs`
```
//! `bsp-server` — standalone entry point for the Build Server Protocol server
//! (see DOCS.md §8 (BSP server)).
//!
//! Not a user-facing CLI: this exists so the BSP integration tests (and manual
//! debugging) can exec the stdio server, and so `bsp::write_config` has an
//! executable to point `buildServer.json`'s `argv` at. In the extension the
//! same server runs through the N-API addon (`node::bsp`).

use std::process::ExitCode;

const USAGE: &str = "\
bsp-server — Build Server Protocol server for sourcekit-lsp

USAGE:
    bsp-server <command> [options]

COMMANDS:
    bsp      Run the BSP server loop over stdio
    config   Write a buildServer.json so sourcekit-lsp finds the server
             (--project <p> | --workspace <p>) [--xcode <p>]
             [--derived-data-path <p>] [--output <p>]
";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("bsp") => sweetpad_core::bsp::run(&args[1..]),
        Some("config") => sweetpad_core::bsp::write_config(&args[1..], &["bsp"]),
        Some("-h" | "--help" | "help") => {
            print!("{USAGE}");
            return ExitCode::SUCCESS;
        }
        Some(other) => Err(format!("unknown command {other:?}\n\n{USAGE}")),
        None => Err(USAGE.to_string()),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("bsp-server: {e}");
            ExitCode::FAILURE
        }
    }
}

```

### Core Architecture Module: `sweetpad-core/src/bsp/control.rs`
```
//! The telemetry channel to the SweetPad extension. The BSP server reads all of
//! its config — including the Unix socket path to bind — from the `bsp.json`
//! named by `--config` (written by the extension into the host state dir). It
//! binds that socket, serves `bsp/log` and `bsp/status` to any extension that
//! connects, and accepts `bsp/setLogLevel` back. Config never flows over this
//! channel; it lives entirely in `bsp.json`.

use std::io::BufReader;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};

use crate::framing::{read_message, write_message};

/// Verbosity of the `bsp/log` stream pushed to the extension. Gates only the
/// telemetry stream — the `SWEETPAD_BSP_LOG` file always gets everything.
#[derive(Clone, Copy)]
pub(crate) enum LogLevel {
    Off = 0,
    Error = 1,
    Info = 2,
    Debug = 3,
}

impl LogLevel {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            LogLevel::Off => "off",
            LogLevel::Error => "error",
            LogLevel::Info => "info",
            LogLevel::Debug => "debug",
        }
    }

    pub(crate) fn parse(s: &str) -> Self {
        match s {
            "off" => LogLevel::Off,
            "error" => LogLevel::Error,
            "debug" => LogLevel::Debug,
            _ => LogLevel::Info,
        }
    }
}

/// The telemetry socket the BSP binds — at the path the extension assigned in
/// `bsp.json` — and the connected extensions it pushes `bsp/log` / `bsp/status`
/// to. Each accepted connection also feeds `bsp/setLogLevel` back through the
/// `on_set_level` callback.
pub(crate) struct TelemetryServer {
    clients: Mutex<Vec<UnixStream>>,
    socket: PathBuf,
    /// The last `bsp/status` frame, replayed to each new connection. A status is
    /// a state, not an event: an extension that connects (or reconnects) after
    /// the server pushed one would otherwise show nothing until the next change,
    /// which for a failed prepare could be never.
    last_status: Mutex<Option<String>>,
}

impl TelemetryServer {
    /// Bind `socket` and start accepting extension connections. Reclaims a stale
    /// socket file (nothing listening there); returns `None` if another live
    /// server already owns the path — a second BSP for the same project — so the
    /// caller simply runs without telemetry. `on_set_level` fires for each
    /// incoming `bsp/setLogLevel`.
    pub(crate) fn bind(
        socket: &Path,
        on_set_level: impl Fn(&str) + Send + Sync + 'static,
    ) -> Option<Arc<TelemetryServer>> {
        // A leftover socket file is either a live peer (another BSP owns this
        // project — stand down) or a crashed one's stale file (reclaim it).
        if socket.exists() {
            if UnixStream::connect(socket).is_ok() {
                return None;
            }
            let _ = std::fs::remove_file(socket);
        }
        let listener = UnixListener::bind(socket).ok()?;
        let server = Arc::new(TelemetryServer {
            clients: Mutex::new(Vec::new()),
            socket: socket.to_path_buf(),
            last_status: Mutex::new(None),
        });
        let accept = Arc::clone(&server);
        let on_set_level = Arc::new(on_set_level);
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                // Keep a write half for broadcasts; the read half drains
                // `bsp/setLogLevel` until the extension disconnects. The
                // write timeout is load-bearing: `broadcast` runs on the
                // request thread, so a connected client that stops reading
                // (suspended extension host, full socket buffer) would
                // otherwise block a broadcast forever — wedging the whole
                // server. A timed-out write fails and drops the client.
                if let Ok(mut write_half) = stream.try_clone()
                    && let Ok(mut clients) = accept.clients.lock()
                {
                    let _ = write_half.set_write_timeout(Some(Duration::from_secs(1)));
                    if let Ok(last) = accept.last_status.lock()
                        && let Some(body) = last.as_deref()
                    {
                        let _ = write_message(&mut write_half, body);
                    }
                    clients.push(write_half);
                }
                let on_set_level = Arc::clone(&on_set_level);
                std::thread::spawn(move || {
                    let mut reader = BufReader::new(stream);
                    while let Ok(Some(msg)) = read_message(&mut reader) {
                        if let Ok(val) = serde_json::from_str::<Value>(&msg)
                            && val.get("method").and_then(Value::as_str) == Some("bsp/setLogLevel")
                            && let Some(level) = val
                                .get("params")
                                .and_then(|p| p.get("level"))
                                .and_then(Value::as_str)
                        {
                            on_set_level(level);
                        }
                    }
                });
            }
        });
        Some(server)
    }

    /// Push a JSON-RPC notification to every connected extension, dropping any
    /// that errors on write — a disconnected client, or one whose write timed
    /// out (see the timeout set at accept; this runs on the request thread, so
    /// a stalled client must cost at most one bounded write, never a wedge).
    #[allow(clippy::needless_pass_by_value)]
    pub(crate) fn broadcast(&self, method: &str, params: Value) {
        let body = json!({ "jsonrpc": "2.0", "method": method, "params": params }).to_string();
        if method == "bsp/status"
            && let Ok(mut last) = self.last_status.lock()
        {
            *last = Some(body.clone());
        }
        if let Ok(mut clients) = self.clients.lock() {
            clients.retain_mut(|c| {
                if write_message(c, &body).is_ok() {
                    return true;
                }
                // A failed (or timed-out mid-frame) write may have left half a
                // frame on the wire, so the stream is unusable. Shut the socket
                // down — not just drop the write half — so the extension sees
                // EOF and reconnects instead of blocking forever on the missing
                // bytes (its reader thread here exits on the same EOF).
                let _ = c.shutdown(std::net::Shutdown::Both);
                false
            });
        }
    }

    /// Remove the socket file on a clean shutdown. (A crash leaves it behind; the
    /// next server reclaims it via the connect-probe in [`Self::bind`].)
    pub(crate) fn shutdown(&self) {
        let _ = std::fs::remove_file(&self.socket);
    }
}

```

### Core Architecture Module: `sweetpad-core/src/bsp/mod.rs`
```
//! The Build Server Protocol server — see `DOCS.md` §8 (BSP server).
//!
//! Speaks BSP (JSON-RPC over stdio) to `sourcekit-lsp`, answering the questions
//! that drive editor intelligence: what targets exist, what files each contains,
//! and the compiler arguments for a file. The argv comes from the resolver/
//! generator core (`build_settings::resolve_compiler_arguments`), so it's derived
//! from the project, not parsed out of a build log.
//!
//! This is the walking-skeleton scope: the core requests, per-**target** argv
//! (⚠️ per-file later — see `DOCS.md` §8 (BSP server)), no `buildTarget/prepare` yet (v2).

mod control;

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::fs::OpenOptions;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Condvar, Mutex, PoisonError};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde_json::{Value, json};

use crate::app_locator::CommandLineSettings;
use crate::build_context::BuildContext;
use crate::build_settings::{self, BuildSettingsOptions};
use crate::framing::{read_message, write_message};
use crate::scratch::{ScratchDir, TmpdirLeftovers};
use crate::xcodebuild_args;
use control::{LogLevel, TelemetryServer};
use sweetpad_lib::{compiler_args, derived_data, project, scheme};

/// Write a `buildServer.json` so `sourcekit-lsp` discovers and launches this
/// server. Its `argv` is the current executable followed by
/// `serve_subcommand` — the caller's spelling of "run the server loop"
/// (`["bsp"]` for the standalone bsp-server binary, `["bsp", "serve"]` for the
/// sweetpad CLI) — plus the server flags, dropped into the workspace root (the
/// `.xcodeproj`'s parent, or `--output`).
pub fn write_config(args: &[String], serve_subcommand: &[&str]) -> Result<(), String> {
    let flags = parse_flags(args);
    // Accept either a `.xcodeproj` (`--project`) or a `.xcworkspace` (`--workspace`);
    // the BSP server resolves files against a workspace's member projects.
    let (root_flag, root) = flags
        .get("workspace")
        .map(|w| ("--workspace", w))
        .or_else(|| flags.get("project").map(|p| ("--project", p)))
        .ok_or(
            "config: --project <path.xcodeproj> or --workspace <path.xcworkspace> is required",
        )?;
    let root_abs = std::fs::canonicalize(root).map_err(|e| format!("{root_flag}: {e}"))?;
    // A project's embedded workspace is the project: the server keys it that
    // way, and `buildServer.json` belongs beside the `.xcodeproj`, not in it.
    let (root_flag, root_abs) = match sweetpad_lib::workspace::embedding_project(&root_abs) {
        Some(project) => ("--project", project.to_path_buf()),
        None => (root_flag, root_abs),
    };
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    let mut server_argv = vec![exe.to_string_lossy().into_owned()];
    server_argv.extend(serve_subcommand.iter().map(|s| (*s).to_string()));
    server_argv.push(root_flag.into());
    server_argv.push(root_abs.to_string_lossy().into_owned());
    for (flag, key) in [
        ("--xcode", "xcode"),
        ("--derived-data-path", "derived-data-path"),
    ] {
        if let Some(v) = flags.get(key) {
            server_argv.push(flag.into());
            server_argv.push(v.clone());
        }
    }
    let config = json!({
        "name": "sweetpad",
        "version": env!("CARGO_PKG_VERSION"),
        "bspVersion": "2.2.0",
        "languages": LANGUAGE_IDS,
        "argv": server_argv,
    });

    let out = build_server_json_path(&root_abs, flags.get("output").map(Path::new));
    let body = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&out, format!("{body}\n"))
        .map_err(|e| format!("write {}: {e}", out.display()))?;
    eprintln!("wrote {}", out.display());
    Ok(())
}

/// Where sourcekit-lsp finds the `buildServer.json` for `container`: the
/// explicit `output`, else beside the container. A project's embedded
/// workspace puts it beside the project, not inside the bundle.
#[must_use]
pub fn build_server_json_path(container: &Path, output: Option<&Path>) -> PathBuf {
    output.map_or_else(
        || {
            sweetpad_lib::workspace::normalize_stub_workspace(container)
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .join("buildServer.json")
        },
        Path::to_path_buf,
    )
}

/// Build settings the project's builds add above every project layer, from
/// the command line they run `xcodebuild` with: an `-xcconfig` overlay and
/// `KEY=VALUE` assignments, in order. The sweetpad CLI reads them from the
/// project's `sweetpad.toml`; a server started from `bsp.json` reads them
/// from that file's `buildArgs`, which the extension fills from
/// `sweetpad.build.args`.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CommandLine {
    pub xcconfig: Option<PathBuf>,
    pub overrides: Vec<(String, String)>,
}

/// The settings a command line layers on every resolution. Its
/// `-derivedDataPath` is left out: the server fixes DerivedData at startup.
impl From<CommandLineSettings> for CommandLine {
    fn from(settings: CommandLineSettings) -> Self {
        Self {
            xcconfig: settings.xcconfig,
            overrides: settings.overrides,
        }
    }
}

/// Run the BSP server loop over stdin/stdout until EOF or `build/exit`.
pub fn run(args: &[String]) -> Result<(), String> {
    run_with(args, CommandLine::default())
}

/// [`run`], resolving every target's settings with `command_line` on top, so
/// the editor's compiler arguments and the `buildTarget/prepare` build agree
/// with the project's own builds.
pub fn run_with(args: &[String], command_line: CommandLine) -> Result<(), String> {
    let server = Arc::new(Server::resolve(args, command_line)?);
    let stdin = io::stdin();
    let mut reader = stdin.lock();
    // Each write locks the output for one whole frame rather than holding the
    // lock across the loop, so the worker threads (change-watcher, prepare)
    // can interleave their messages between requests.
    let mut watching = false;

    // `buildTarget/prepare` runs `xcodebuild` (seconds-to-minutes), and
    // sourcekit-lsp blocks the requesting target's semantics until our response
    // arrives — so run it on a serialized worker and reply by id when the build
    // finishes, keeping the request loop responsive in the meantime.
    {
        let server = Arc::clone(&server);
        std::thread::spawn(move || {
            while let Some(job) = server.prepare_queue.take() {
                server.run_prepare(&job);
            }
        });
    }

    loop {
        let msg = match read_message(&mut reader) {
            Ok(Some(msg)) => msg,
            Ok(None) => break, // clean EOF
            Err(e) => {
                // The frame boundary is lost; log why before dying so the
                // failure is diagnosable instead of a silent exit.
                server.trace(&format!("fatal framing error: {e}"));
                server.prepare_queue.close();
                server.kill_prepare();
                server.shutdown_telemetry();
                return Err(e);
            }
        };
        let req = match serde_json::from_str::<Value>(&msg) {
            Ok(req) => req,
            Err(e) => {
                // JSON-RPC: a frame that isn't valid JSON gets a parse-error
                // response (id null) — silently dropping it would leave a
                // client that sent an id waiting forever.
                server.trace(&format!("recv: unparseable frame: {e}"));
                server.send(&json!({
                    "jsonrpc": "2.0",
                    "id": Value::Null,
                    "error": { "code": -32700, "message": format!("parse error: {e}") },
                }))?;
                continue;
            }
        };
        let method = req.get("method").and_then(Value::as_str).unwrap_or("");
        let id = req.get("id").cloned();
        let params = req.get("params");
        server.trace(&format!("recv: {msg}"));
        match method {
            "build/initialize" => server.reply(id, server.initialize())?,
            "build/initialized" => {
                // The client is now ready for notifications: watch the project
                // for structure changes and push `buildTarget/didChange`.
                if !watching {
                    Arc::clone(&server).spawn_change_watcher();
                    watching = true;
                    // Warm every target in the background. The cold window —
                    // the stretch where a target's header maps and generated
                    // sources don't exist yet, so its ObjC files can't resolve
                    // their imports — otherwise opens afresh for each target
                    // the first time somebody opens a file in it. Queued at the
                    // back, so a target the client actually asks about still
                    // goes first.
                    server.prepare_queue.push_back(PrepareJob {
                        id: None,
                        targets: server.current_targets(),
                    });
                }
            }
            "workspace/buildTargets" => server.reply(id, server.build_targets())?,
            "buildTarget/sources" => server.reply(id, server.sources(params))?,
            "buildTarget/inverseSources" => server.reply(id, server.inverse_sources(params))?,
            "textDocument/sourceKitOptions" => {
                server.reply(id, server.source_kit_options(params))?;
            }
            "buildTarget/prepare" => {
                // Hand off to the worker; it replies once the build is done. A
                // prepare without an id (shouldn't happen) is simply dropped.
                if let Some(id) = i
```

### Core Architecture Module: `sweetpad-core/src/devices/devicectl.rs`
```
//! `xcrun devicectl` output: the device listing, one device's details and
//! lock state, and the process list the app's pids come from. The CLI and
//! the extension each spawn devicectl (it writes to a `--json-output` file,
//! not stdout) and hand the file's text here.
//!
//! The listing comes in two shapes. Through `jsonVersion` 4 a device carried
//! `hardwareProperties` / `deviceProperties` / `connectionProperties`; version 5
//! (Xcode 27) adds a `properties` dictionary that supersedes all three and
//! carries a `_deprecationNotice` saying the old trio will be removed. Both are
//! read, `properties` first. Xcode 27's listing also holds the simulators
//! (`reality: "simulated"`), which are dropped: simctl lists them, and as
//! devices they would get a `platform=iOS` specifier that cannot build for
//! them.

use serde_json::Value;
use sweetpad_lib::destination::Platform;

/// Seconds between the Unix epoch and Core Foundation's 2001-01-01 reference
/// date, which version 5 counts `lastConnectionDate` from.
const CF_EPOCH_OFFSET_SECONDS: f64 = 978_307_200.0;

/// A physical device paired with this Mac.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Device {
    /// CoreDevice's own identifier, the one devicectl's `--device` also
    /// takes.
    pub identifier: String,
    /// The hex UDID xcodebuild's `id=` takes. Falls back to `identifier` for
    /// the entries devicectl lists with an empty hardware section (some USB
    /// iOS 16 and older devices).
    pub udid: String,
    /// Whether `udid` is the hardware UDID rather than the `identifier`
    /// fallback.
    pub has_hardware_udid: bool,
    pub name: String,
    /// The marketing name, else the product type (`iPhone14,5`): the listing
    /// leaves the marketing name out for some wireless devices.
    pub model: String,
    /// `iPhone 13`; empty when devicectl leaves it out.
    pub marketing_name: String,
    /// `iPhone14,5`.
    pub product_type: String,
    /// `iPhone`, `iPad`, `appleWatch`, `appleTV`, `appleVision`,
    /// `realityDevice`; empty when devicectl leaves it out.
    pub device_type: String,
    /// devicectl's platform, `iOS` when it reports none.
    pub platform: String,
    pub os_version: String,
    /// devicectl's connection state. An idle device reads `disconnected`:
    /// xcodebuild and devicectl connect on demand, so it says nothing about
    /// whether the device can be built to.
    pub connection: String,
    /// devicectl's `transportType`: `wired` or `localNetwork`.
    pub transport: String,
    /// devicectl's `pairingState`: `paired` once the device trusts this Mac.
    pub pairing: String,
    /// When the device last connected, in milliseconds since the Unix epoch.
    pub last_connection_ms: Option<f64>,
}

impl Device {
    /// `"My iPhone (iPhone 15 Pro, iOS 17.0)"`.
    #[must_use]
    pub fn label(&self) -> String {
        format!(
            "{} ({}, {} {})",
            self.name, self.model, self.platform, self.os_version
        )
    }

    /// How the device reaches this Mac, in a word or two for a listing: `usb`
    /// or `wifi`, plus `not paired` when it has not trusted this Mac. The
    /// connection state is left out, since an idle device always reads
    /// `disconnected`.
    #[must_use]
    pub fn link_hint(&self) -> Option<String> {
        let mut parts: Vec<&str> = Vec::new();
        match self.transport.as_str() {
            "" => {}
            "wired" => parts.push("usb"),
            "localNetwork" => parts.push("wifi"),
            other => parts.push(other),
        }
        if !self.pairing.is_empty() && self.pairing != "paired" {
            parts.push("not paired");
        }
        (!parts.is_empty()).then(|| parts.join(", "))
    }

    /// The `-destination platform=` label for this device, e.g. `iOS` or
    /// `visionOS`. A platform the table doesn't know keeps devicectl's name.
    #[must_use]
    pub fn platform_label(&self) -> &str {
        Platform::device_for_os(&self.platform).map_or(self.platform.as_str(), |p| p.label)
    }

    /// The `xcodebuild -destination` specifier targeting this device, e.g.
    /// `platform=iOS,id=<udid>`.
    #[must_use]
    pub fn destination(&self) -> String {
        format!("platform={},id={}", self.platform_label(), self.udid)
    }
}

/// One device record as devicectl reports it, in either JSON shape.
struct Raw<'a>(&'a Value);

impl<'a> Raw<'a> {
    fn at(&self, path: &[&str]) -> &'a Value {
        path.iter().fold(self.0, |v, key| &v[*key])
    }

    fn text(&self, path: &[&str]) -> &'a str {
        self.at(path).as_str().unwrap_or_default()
    }

    /// The version-5 value under `properties`, falling back to the deprecated
    /// one when the listing predates it (or leaves it blank).
    fn pick(&self, current: &[&str], deprecated: &[&str]) -> &'a str {
        let value = self.text(current);
        if value.is_empty() {
            self.text(deprecated)
        } else {
            value
        }
    }

    fn reality(&self) -> &'a str {
        self.pick(
            &["properties", "hardware", "reality"],
            &["hardwareProperties", "reality"],
        )
    }

    fn boot_state(&self) -> &'a str {
        self.pick(
            &["properties", "state", "bootState"],
            &["deviceProperties", "bootState"],
        )
    }

    /// `enabled` / `disabled`, reported only once a connection is made.
    /// Version 5 spells it as a one-case object (`{"enabled": {"mode": 1}}`),
    /// the deprecated field as the bare word.
    fn developer_mode(&self) -> Option<String> {
        let case = |status: &Value| match status {
            Value::String(word) if !word.is_empty() => Some(word.clone()),
            Value::Object(cases) => cases.keys().next().cloned(),
            _ => None,
        };
        case(self.at(&["properties", "state", "developerModeStatus"]))
            .or_else(|| case(self.at(&["deviceProperties", "developerModeStatus"])))
    }

    /// Version 5 counts seconds from Core Foundation's reference date; the
    /// deprecated field is an ISO 8601 string.
    fn last_connection_ms(&self) -> Option<f64> {
        if let Some(seconds) = self
            .at(&["properties", "connection", "lastConnectionDate"])
            .as_f64()
            .filter(|s| s.is_finite())
        {
            return Some((seconds + CF_EPOCH_OFFSET_SECONDS) * 1000.0);
        }
        iso8601_ms(self.text(&["connectionProperties", "lastConnectionDate"]))
    }

    /// The device this entry describes, or `None` for an entry with no id at
    /// all and for the simulators Xcode 27 lists alongside the devices.
    fn to_device(&self) -> Option<Device> {
        let identifier = self.text(&["identifier"]);
        let hardware_udid = self.pick(
            &["properties", "hardware", "udid"],
            &["hardwareProperties", "udid"],
        );
        let udid = if hardware_udid.is_empty() {
            identifier
        } else {
            hardware_udid
        };
        if udid.is_empty() || self.reality() == "simulated" {
            return None;
        }
        let marketing_name = self.pick(
            &["properties", "hardware", "marketingName"],
            &["hardwareProperties", "marketingName"],
        );
        let product_type = self.pick(
            &["properties", "hardware", "productType"],
            &["hardwareProperties", "productType"],
        );
        let platform = self.pick(
            &["properties", "hardware", "platform"],
            &["hardwareProperties", "platform"],
        );
        Some(Device {
            identifier: identifier.to_string(),
            udid: udid.to_string(),
            has_hardware_udid: !hardware_udid.is_empty(),
            name: self
                .pick(
                    &["properties", "state", "name"],
                    &["deviceProperties", "name"],
                )
                .to_string(),
            model: if marketing_name.is_empty() {
                product_type
            } else {
                marketing_name
            }
            .to_string(),
            marketing_name: marketing_name.to_string(),
            product_type: product_type.to_string(),
            device_type: self
                .pick(
                    &["properties", "hardware", "deviceType"],
                    &["hardwareProperties", "deviceType"],
                )
                .to_string(),
            platform: if platform.is_empty() { "iOS" } else { platform }.to_string(),
            os_version: self
                .pick(
                    &["properties", "software", "osVersionNumber", "stringValue"],
                    &["deviceProperties", "osVersionNumber"],
                )
                .to_string(),
            // `properties.connection.state` is version 5's spelling of what
            // `connectionProperties.tunnelState` said; both report
            // `connected` / `disconnected` / `unavailable`.
            connection: self
                .pick(
                    &["properties", "connection", "state"],
                    &["connectionProperties", "tunnelState"],
                )
                .to_string(),
            transport: self
                .pick(
                    &["properties", "connection", "transportType"],
                    &["connectionProperties", "transportType"],
                )
                .to_string(),
            pairing: self
                .pick(
                    &["properties", "connection", "pairingState"],
                    &["connectionProperties", "pairingState"],
                )
                .to_string(),
            last_connection_ms: self.last_connection_ms(),
        })
    }
}

/// Milliseconds since the Unix epoch for an ISO 8601 UTC timestamp as
/// devicectl writes it (`2026-09-26T21:50:00.000Z`, the fraction optional).
/// `None` for anything else.
fn iso8601_ms(text: &str) -> Option<f64> {
    let (date, 
```

### Core Architecture Module: `sweetpad-core/src/devices/mod.rs`
```
//! Simulators and physical devices as `simctl` and `devicectl` report them.
//! Parsing only: each frontend runs the tools its own way (the CLI with
//! timeouts and temp files, the extension through its exec layer) and hands
//! the output here, so both read the listings, the destination specifiers
//! and the app's processes the same way.

pub mod devicectl;
pub mod simctl;

```

### Core Architecture Module: `sweetpad-core/src/devices/simctl.rs`
```
//! `xcrun simctl` output: the simulator listing and the host processes a
//! simulator app runs as. The CLI spawns simctl and `ps`; the extension does
//! the same and hands the output here through the addon.

use std::cmp::Ordering;

use serde_json::Value;
use sweetpad_lib::destination::{DestinationSpec, PLATFORMS, Platform};

/// A simulator, with its runtime parsed into a friendly OS + version.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Simulator {
    pub udid: String,
    pub name: String,
    /// `Booted` / `Shutdown` (as reported by simctl).
    pub state: String,
    pub available: bool,
    /// e.g. `iOS`, `watchOS`, `tvOS`, `xrOS`.
    pub os: String,
    /// e.g. `17.0`.
    pub os_version: String,
    /// The runtime identifier, e.g. `com.apple.CoreSimulator.SimRuntime.iOS-17-0`.
    pub runtime: String,
    /// The device type identifier, e.g.
    /// `com.apple.CoreSimulator.SimDeviceType.iPhone-17`. Empty when simctl
    /// leaves it out.
    pub device_type: String,
}

impl Simulator {
    #[must_use]
    pub fn is_booted(&self) -> bool {
        self.state.eq_ignore_ascii_case("Booted")
    }

    /// `"iPhone 15 (17.0)"`.
    #[must_use]
    pub fn label(&self) -> String {
        format!("{} ({})", self.name, self.os_version)
    }

    /// The simulator platform this OS runs, when the platform table knows it.
    #[must_use]
    pub fn platform(&self) -> Option<&'static Platform> {
        Platform::simulator_for_os(&self.os)
    }

    /// The `xcodebuild -destination` platform label, e.g. `iOS Simulator`.
    /// An OS the platform table doesn't know keeps its own name (`fooOS
    /// Simulator`), the likeliest spelling for a platform newer than the
    /// table.
    #[must_use]
    pub fn platform_label(&self) -> String {
        self.platform()
            .map_or_else(|| format!("{} Simulator", self.os), |p| p.label.to_string())
    }

    /// The `xcodebuild -destination` specifier targeting this simulator,
    /// e.g. `platform=iOS Simulator,id=<udid>`.
    #[must_use]
    pub fn destination(&self) -> String {
        format!("platform={},id={}", self.platform_label(), self.udid)
    }

    /// Destination kind for the remembered recents/usage records, e.g.
    /// `iOSSimulator`. Pairs the OS with the simulator role.
    #[must_use]
    pub fn kind(&self) -> String {
        format!("{}Simulator", self.os)
    }
}

/// Parse `simctl list --json devices` output into available simulators in
/// picker order: platform first (iOS before the rest), then newest OS version,
/// then device family (iPhone before iPad) and a numeric-aware name sort.
/// Unavailable devices are dropped (they can't be booted or targeted).
pub fn parse_list(raw: &str) -> Result<Vec<Simulator>, String> {
    // simctl's stdout can carry a warning ahead of the JSON (a CoreSimulator
    // notice); the listing is the first object in it.
    let json = raw.find('{').map_or(raw, |start| &raw[start..]);
    let parsed: Value = serde_json::Deserializer::from_str(json)
        .into_iter::<Value>()
        .next()
        .unwrap_or_else(|| serde_json::from_str::<Value>(""))
        .map_err(|e| format!("parsing simctl output: {e}"))?;
    let devices = parsed
        .get("devices")
        .and_then(Value::as_object)
        .ok_or("parsing simctl output: it has no 'devices' map")?;
    let text = |d: &Value, key: &str| d[key].as_str().unwrap_or_default().to_string();
    let mut sims = Vec::new();
    for (runtime, list) in devices {
        let (os, os_version) = parse_runtime(runtime);
        for d in list.as_array().into_iter().flatten() {
            let udid = text(d, "udid");
            if udid.is_empty() || d["isAvailable"].as_bool() != Some(true) {
                continue;
            }
            sims.push(Simulator {
                udid,
                name: text(d, "name"),
                state: text(d, "state"),
                available: true,
                os: os.clone(),
                os_version: os_version.clone(),
                runtime: runtime.clone(),
                device_type: text(d, "deviceTypeIdentifier"),
            });
        }
    }
    sims.sort_by(cmp_for_picker);
    Ok(sims)
}

/// `com.apple.CoreSimulator.SimRuntime.iOS-17-0` → (`iOS`, `17.0`). A runtime
/// without a version keeps its whole tail as the OS.
#[must_use]
pub fn parse_runtime(runtime: &str) -> (String, String) {
    let tail = runtime.rsplit('.').next().unwrap_or(runtime); // iOS-17-0
    match tail.split_once('-') {
        Some((os, version)) => (os.to_string(), version.replace('-', ".")),
        None => (tail.to_string(), String::new()),
    }
}

/// Order simulators for pickers and listings: platform priority, then newest OS
/// version, then device family, then a numeric-aware name sort. Each tier is
/// explicit so the order is intentional rather than a byte-compare side effect
/// (which is what made 17.0 sort before 9.0 and "iPad" before "iPhone").
fn cmp_for_picker(a: &Simulator, b: &Simulator) -> Ordering {
    platform_rank(&a.os)
        .cmp(&platform_rank(&b.os))
        .then_with(|| version_key(&b.os_version).cmp(&version_key(&a.os_version))) // newest first
        .then_with(|| device_rank(&a.name).cmp(&device_rank(&b.name)))
        .then_with(|| natural_cmp(&a.name, &b.name))
}

/// Platform display order: the platform table's (iOS, tvOS, watchOS,
/// visionOS); anything unrecognized sorts last, so a future platform lands in a
/// defined place rather than wherever its name's bytes happen to fall.
fn platform_rank(os: &str) -> usize {
    Platform::simulator_for_os(os)
        .and_then(|p| PLATFORMS.iter().position(|q| q == p))
        .unwrap_or(PLATFORMS.len())
}

/// Device-family order within a platform: iPhone before iPad (the common pick),
/// then everything else. Platforms with a single family (Apple TV/Watch/Vision)
/// all land in the last bucket and fall through to the name sort.
fn device_rank(name: &str) -> u8 {
    if name.starts_with("iPhone") {
        0
    } else if name.starts_with("iPad") {
        1
    } else {
        2
    }
}

/// Parse a dotted version ("26.5") into numeric components so it orders
/// numerically: 9.0 before 17.0, where a byte compare puts "17.0" first.
/// Missing or garbled components count as 0.
#[must_use]
pub fn version_key(version: &str) -> Vec<u32> {
    version.split('.').map(|p| p.parse().unwrap_or(0)).collect()
}

/// Compare names so embedded numbers order numerically: "iPhone 9" before
/// "iPhone 15", which a plain byte compare reverses. Digit runs compare as
/// numbers; everything else compares byte-wise.
fn natural_cmp(a: &str, b: &str) -> Ordering {
    let (mut a, mut b) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (a.peek().copied(), b.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                match take_number(&mut a).cmp(&take_number(&mut b)) {
                    Ordering::Equal => {}
                    ord => return ord,
                }
            }
            (Some(x), Some(y)) => {
                a.next();
                b.next();
                match x.cmp(&y) {
                    Ordering::Equal => {}
                    ord => return ord,
                }
            }
        }
    }
}

/// Consume a leading run of digits as a number (saturating, so a pathologically
/// long run can't overflow).
fn take_number(it: &mut std::iter::Peekable<std::str::Chars<'_>>) -> u64 {
    let mut n: u64 = 0;
    while let Some(d) = it.peek().and_then(|c| c.to_digit(10)) {
        n = n.saturating_mul(10).saturating_add(u64::from(d));
        it.next();
    }
    n
}

/// Find a simulator by UDID (case-insensitive) or exact name. When several
/// share a name, the booted one wins, else the first.
#[must_use]
pub fn find<'a>(sims: &'a [Simulator], query: &str) -> Option<&'a Simulator> {
    if let Some(s) = sims.iter().find(|s| s.udid.eq_ignore_ascii_case(query)) {
        return Some(s);
    }
    let mut by_name: Vec<&Simulator> = sims.iter().filter(|s| s.name == query).collect();
    by_name.sort_by_key(|s| !s.is_booted());
    by_name.first().copied()
}

/// The simulator a `-destination` names by `name=`, matched the way xcodebuild
/// matches it: the name exactly, on the destination's platform when it gives
/// one, at its `OS=` exactly (`27` is not `27.0`), or at the newest OS for
/// `OS=latest`. A booted simulator wins a tie. `None` when the destination has
/// no `name=` or nothing matches. Xcode keeps a default set of devices for
/// every runtime, so `iPhone 17` can name one simulator per installed iOS.
#[must_use]
pub fn find_named<'a>(sims: &'a [Simulator], spec: &DestinationSpec) -> Option<&'a Simulator> {
    let name = spec.name.as_deref()?;
    let mut matches: Vec<&Simulator> = sims
        .iter()
        .filter(|s| s.name == name && spec.platform.is_none_or(|p| s.platform() == Some(p)))
        .collect();
    match spec.os.as_deref() {
        Some(os) if os.eq_ignore_ascii_case("latest") => {
            let newest = matches.iter().map(|s| version_key(&s.os_version)).max();
            matches.retain(|s| Some(version_key(&s.os_version)) == newest);
        }
        Some(os) => matches.retain(|s| s.os_version == os),
        None => {}
    }
    matches.sort_by_key(|s| !s.is_booted());
    matches.first().copied()
}

/// The pids in `ps -o pid=,comm=` output of `executable` running out of an
/// `.app` named `app_dir` on the simulator `udid`. A simulator app is a host
/// process under the device's data directory, so the host's `ps` sees it
/// without asking the simulator. The command path runs through
/// `CoreSimulator/Devices/<udid>/` (simctl prints the udid in upper case, a
/// typed destination may not) and ends in `<app_dir>/<e
```

### Core Architecture Module: `sweetpad-core/src/framing.rs`
```
//! `Content-Length`-framed JSON-RPC message codec, shared by the BSP server's
//! stdio loop (toward sourcekit-lsp), its control-socket client (toward the
//! extension), and the `sweetpad vscode` CLI client.

use std::io::{BufRead, Write};

/// Largest frame we'll accept. Real JSON-RPC bodies here top out at tens of
/// kilobytes (build-target/source lists); the cap stops a hostile or corrupt
/// `Content-Length` from forcing a giant zero-filled allocation (and a
/// `read_exact` that waits forever for a body that never comes) before a
/// single body byte is read.
const MAX_FRAME_BYTES: usize = 16 * 1024 * 1024;

/// Largest accepted header line. Real headers are tens of bytes; without a
/// bound, a peer that streams bytes with no newline grows the header buffer
/// without limit — the exact allocation blowup [`MAX_FRAME_BYTES`] exists to
/// stop, just before the body instead of inside it.
const MAX_HEADER_BYTES: u64 = 64 * 1024;

/// Read one `Content-Length`-framed JSON-RPC message. `Ok(None)` on clean EOF.
pub fn read_message(reader: &mut impl BufRead) -> Result<Option<String>, String> {
    let mut content_length: Option<usize> = None;
    loop {
        let mut raw = Vec::new();
        // UFCS so `take` binds to `impl Read for &mut R` (a plain method call
        // auto-derefs and tries to move the reader itself).
        let mut limited = std::io::Read::take(&mut *reader, MAX_HEADER_BYTES);
        let n = limited
            .read_until(b'\n', &mut raw)
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Ok(None);
        }
        if raw.last() != Some(&b'\n') && n as u64 == MAX_HEADER_BYTES {
            return Err(format!(
                "header line exceeds the {MAX_HEADER_BYTES}-byte cap"
            ));
        }
        let line = String::from_utf8_lossy(&raw);
        let line = line.trim_end_matches(['\r', '\n']);
        if line.is_empty() {
            break;
        }
        // Header names are case-insensitive; don't die on a client that
        // doesn't send the canonical casing. A malformed value is a hard
        // error (the frame boundary is unrecoverable without it).
        if let Some((name, value)) = line.split_once(':')
            && name.eq_ignore_ascii_case("content-length")
        {
            let parsed = value
                .trim()
                .parse()
                .map_err(|e| format!("bad Content-Length {:?}: {e}", value.trim()))?;
            content_length = Some(parsed);
        }
    }
    let len = content_length.ok_or("message without Content-Length")?;
    if len > MAX_FRAME_BYTES {
        return Err(format!(
            "Content-Length {len} exceeds the {MAX_FRAME_BYTES}-byte frame cap"
        ));
    }
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(Some(String::from_utf8_lossy(&buf).into_owned()))
}

pub fn write_message(writer: &mut impl Write, body: &str) -> Result<(), String> {
    write!(writer, "Content-Length: {}\r\n\r\n{body}", body.len()).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())
}

```

### Core Architecture Module: `sweetpad-core/src/hot.rs`
```
//! What a hot-reload build and launch need, shared by the CLI's `app run
//! --hot` and the extension's hot reload: the SDKs InjectionNext can inject
//! into, the client dylib and platform directory for each, and the build
//! settings that make the product injectable.

use std::path::Path;

/// The SDK a `-destination` builds for, among the ones hot reload can inject
/// into: the simulators InjectionNext ships a client for, and native macOS.
/// `None` for the rest (devices, watchOS, generic destinations).
#[must_use]
pub fn sdk_for_destination(destination: &str) -> Option<&'static str> {
    let spec = sweetpad_lib::destination::DestinationSpec::parse(destination);
    if spec.generic {
        return None;
    }
    spec.sdk().filter(|sdk| {
        matches!(
            *sdk,
            "iphonesimulator" | "appletvsimulator" | "xrsimulator" | "macosx"
        )
    })
}

/// The InjectionNext client dylib that injects into apps built for `sdk`.
/// `None` for SDKs InjectionNext can't inject into: devices strip
/// `DYLD_INSERT_LIBRARIES`, and watchOS ships no dylib.
#[must_use]
pub fn dylib_name(sdk: &str) -> Option<&'static str> {
    match sdk {
        "iphonesimulator" => Some("libiphonesimulatorInjection.dylib"),
        "appletvsimulator" => Some("libappletvsimulatorInjection.dylib"),
        "xrsimulator" => Some("libxrsimulatorInjection.dylib"),
        "macosx" => Some("libmacosxInjection.dylib"),
        _ => None,
    }
}

/// The `<Platform>.platform` directory an injectable `sdk` lives in, where
/// the InjectionNext.app client finds the XCTest it links.
#[must_use]
pub fn platform_dir(sdk: &str) -> Option<&'static str> {
    dylib_name(sdk).map(|_| sweetpad_lib::project::platform_dir_name_for(sdk))
}

/// The build settings a hot build for `sdk` adds, in order, as `KEY=VALUE`
/// overrides that outrank the project's. Empty when hot reload can't inject
/// into `sdk`.
///
/// Every injectable build links with `-interposable`, so dyld can swap
/// symbols, and emits frontend command lines, so the recompiler can recover
/// each file's compile command from the build log. A macOS app must also be
/// injectable: the hardened runtime makes dyld strip `DYLD_INSERT_LIBRARIES`
/// and library validation reject the recompiled dylibs, and the App Sandbox
/// blocks the client's socket and loading from outside its container. Without
/// these the app launches and injection fails silently. An entitlements file
/// that turns the sandbox on outranks `ENABLE_APP_SANDBOX`, so a macOS build
/// signs with `entitlements` (a copy without the sandbox) when given.
#[must_use]
pub fn build_settings(sdk: &str, entitlements: Option<&Path>) -> Vec<(&'static str, String)> {
    if dylib_name(sdk).is_none() {
        return Vec::new();
    }
    // `$(inherited)` keeps the project's own linker flags.
    let mut settings = vec![
        (
            "OTHER_LDFLAGS",
            "$(inherited) -Xlinker -interposable".to_string(),
        ),
        ("EMIT_FRONTEND_COMMAND_LINES", "YES".to_string()),
    ];
    if sdk == "macosx" {
        settings.push(("ENABLE_HARDENED_RUNTIME", "NO".to_string()));
        settings.push(("ENABLE_APP_SANDBOX", "NO".to_string()));
        if let Some(entitlements) = entitlements {
            settings.push(("CODE_SIGN_ENTITLEMENTS", entitlements.display().to_string()));
        }
    }
    settings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sdk_for_destination_maps_injectable_destinations() {
        assert_eq!(
            sdk_for_destination("platform=iOS Simulator,id=ABC"),
            Some("iphonesimulator")
        );
        assert_eq!(
            sdk_for_destination("platform=visionOS Simulator,name=X"),
            Some("xrsimulator")
        );
        assert_eq!(sdk_for_destination("platform=macOS"), Some("macosx"));
        // Physical device / unknown → unsupported.
        assert_eq!(sdk_for_destination("platform=iOS,id=ABC"), None);
        assert_eq!(sdk_for_destination("generic/platform=iOS"), None);
    }

    #[test]
    fn dylib_and_platform_cover_the_injectable_sdks() {
        for (sdk, dylib, platform) in [
            (
                "iphonesimulator",
                "libiphonesimulatorInjection.dylib",
                "iPhoneSimulator",
            ),
            (
                "appletvsimulator",
                "libappletvsimulatorInjection.dylib",
                "AppleTVSimulator",
            ),
            (
                "xrsimulator",
                "libxrsimulatorInjection.dylib",
                "XRSimulator",
            ),
            ("macosx", "libmacosxInjection.dylib", "MacOSX"),
        ] {
            assert_eq!(dylib_name(sdk), Some(dylib));
            assert_eq!(platform_dir(sdk), Some(platform));
        }
        // Devices, watchOS and unknown SDKs aren't injectable.
        for sdk in [
            "iphoneos",
            "appletvos",
            "xros",
            "watchos",
            "watchsimulator",
            "",
        ] {
            assert_eq!(dylib_name(sdk), None, "{sdk}");
            assert_eq!(platform_dir(sdk), None, "{sdk}");
            assert!(build_settings(sdk, None).is_empty(), "{sdk}");
        }
    }

    #[test]
    fn a_simulator_build_links_interposable_and_emits_command_lines() {
        assert_eq!(
            build_settings("iphonesimulator", Some(Path::new("/ignored.entitlements"))),
            [
                (
                    "OTHER_LDFLAGS",
                    "$(inherited) -Xlinker -interposable".to_string()
                ),
                ("EMIT_FRONTEND_COMMAND_LINES", "YES".to_string()),
            ]
        );
    }

    #[test]
    fn a_macos_build_drops_the_hardened_runtime_and_sandbox() {
        let keys =
            |s: Vec<(&'static str, String)>| s.into_iter().map(|(k, _)| k).collect::<Vec<_>>();
        assert_eq!(
            keys(build_settings("macosx", None)),
            [
                "OTHER_LDFLAGS",
                "EMIT_FRONTEND_COMMAND_LINES",
                "ENABLE_HARDENED_RUNTIME",
                "ENABLE_APP_SANDBOX"
            ]
        );
        let stripped = build_settings("macosx", Some(Path::new("/cache/Debug.entitlements")));
        assert_eq!(
            stripped.last(),
            Some(&(
                "CODE_SIGN_ENTITLEMENTS",
                "/cache/Debug.entitlements".to_string()
            ))
        );
        assert!(
            stripped
                .iter()
                .any(|(k, v)| *k == "ENABLE_HARDENED_RUNTIME" && v == "NO")
        );
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #339** (2026-09-28): **Project discovery selects internal project.xcworkspace instead of .xcodeproj, breaking scheme refresh**
  *Symptoms*: ## Summary  SweetPad's VS Code extension (0.2.16) discovers only `.xcworkspace` directories and `Package.swift`. For an ordinary single-project repository containing only `TinyPreview.xcodeproj`, the *only* offered choice is the internal `TinyPreview.xcodeproj/project.xcworkspace`, not the `.xcodeproj` itself. The extension then fails to list schemes with `I/O error: No such file or directory (os error 2)` and "Generate Build Server Config" fails before writing a config.  This is different from earlier "No schemes" reports caused by an inactive Xcode installation or an incompatible project format: `xcodebuild -list -project` and the SweetPad CLI both enumerate the schemes successfully here.  ## Reproduction  1. Open a repository containing `TinyPreview.xcodeproj` but no top-level `.xcworkspace` in VS Code (example: [lingmacker/TinyPreview](https://github.com/lingmacker/TinyPreview), commit `d62bfe3`). 2. In SweetPad, select the Xcode container / run "Generate Build Server Config". 3. The picker offers only `TinyPreview.xcodeproj/project.xcworkspace`; selecting it logs:     ```text    Getting schemes: <repo>/TinyPreview.xcodeproj/project.xcworkspace    Failed to refresh schemes: I/O error: No such file or directory (os error 2)    Failed to get schemes: I/O error: No such file or directory (os error 2)    ```  `project.xcworkspace` exists but has no `contents.xcworkspacedata`. The extension's bundled native reader reproduces the *same* error when passed this path, while passin
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report and repro! Fixed in 0.2.17: SweetPad now offers the `.xcodeproj` and reads its schemes. Closing.

- **Issue #338** (2026-09-19): **Launch the simulator app Xcode 27 renamed to DeviceHub (#337)**
  *Symptoms*: Closes #337

- **Issue #337** (2026-09-19): **Xcode 27 - launch of iOS app fails, due to Simulator being renamed to DeviceHub**
  *Symptoms*: Launching an iOS app that built ok against an Xcode 27 install fails as the Simulator command used `open -a Simulator` no longer finds and app as it has been renamed to DeviceHub.  As a temporary workaround the attached ZIP file is a tiny shim app - expand it to `~/Applications/Simulator.app` and Sweetpad will launch it and get redirected to device hub.  The core script that runs is: ``` #!/bin/bash exec open -a "/Applications/Xcode.app/Contents/Applications/DeviceHub.app" "$@" ```  [Simulator.zip](https://github.com/user-attachments/files/32294617/Simulator.zip)

- **Issue #336** (2026-09-16): **Command to send deeplinks to simulator**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Closing, found it in the docs, sorry!

- **Issue #335** (2026-09-28): **sweetpad build diagnostics command does not color output**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Which command do you mean here — "SweetPad: Diagnose build setup", or the build output itself?
  > @hyzyla It's the `sweetpad build diagnostics` command, the one which shows warnings and errors from latest build
  > Sorry for the slow reply. `sweetpad build diagnostics` is colored since CLI 0.1.10 (`brew upgrade sweetpad`). Closing.

- **Issue #334** (2026-08-26): **List schemes from every local Swift package a container reaches (#327)**
  *Symptoms*: xcodebuild resolves the whole local package graph — the workspace's FileRef members, the packages a member project declares, keeps as a folder reference, or holds under a synchronized folder, and everything those pull in through `.package(path:)` — and synthesizes schemes from all of it, while SweetPad read only the workspace's own members. It now walks the same graph, counting SwiftPM's implicit executable products alongside the declared ones and adding each package's scheme files and the test targets Xcode counts. A package opened on its own is listed the way xcodebuild lists it: under its own name when it has exactly one product, under `<name>-Package` when it has none, and under both when it has more. 

- **Issue #333** (2026-08-25): **Show each generic destination with its platform's own icon**
  *Symptoms*: The nine build-only destinations all shared the `vm` glyph, so the group rendered as identical rows and "Any iOS Device" got a desktop-display icon. Each now uses its platform's own silhouette, and the group header gets a `sweetpad-circle-letter-g` badge so it matches the letter-badge grammar of the groups above it. The glyph was already in tabler-icons.original.woff, so this is a package.json entry plus a font re-subset.

- **Issue #332** (2026-08-26): **Match Xcode's DerivedData folder name when the project name has a space**
  *Symptoms*: Fixes #329. Xcode writes `ARTA NYC.xcworkspace`'s DerivedData to `ARTA_NYC-<hash>`, so the resolver named a directory that never existed: the build succeeded and the launch then looked for the app somewhere it had never been written. Xcode collapses each run of space, tab, LF or CR to a single `_`, and only where the folder is keyed by hash — a workspace-relative location keeps the name verbatim — so the collapse sits at the `<name>-<hash>` spelling rather than at the name. This also corrects `derived-data`'s project scoping, which guessed the rule as "replace every non-alphanumeric" and could therefore match a different project's folder.

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

### Incident Patch 1: `947e05fa` (2026-10-04)
**Commit Message**: Plan sweetpad dap for debugging from any editor

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +122/-0)
```diff
@@ -4089,6 +4089,128 @@ credentials, a 403 and a 407, `no_proxy` sending around a lower-case
 from stdin; attachments or logs; the VS Code extension; SOCKS proxies and
 proxies reached over HTTPS, which `minreq` doesn't support.
 
+## 9u. Direction — debugging from any editor (`dap`)
+
+> Status: planned, not yet versioned. `dap` ships in a CLI release first; the
+> extension then switches to it by default. Asked for in sweetpad-dev/sweetpad#340.
+
+Debugging an app goes through one of two doors. The VS Code extension builds
+and launches through its own pre-launch task, then hands an attach config to
+CodeLLDB (`vadimcn.vscode-lldb`, a hard `extensionDependencies` entry). The CLI
+has `app debug`, an interactive or `--batch` lldb session in the terminal.
+Neither reaches Neovim, Zed, Helix or Emacs, whose debug UIs all speak the
+Debug Adapter Protocol and expect an adapter to get the process running.
+
+Xcode already ships the adapter half: `xcrun lldb-dap`, LLVM's DAP server
+linked against Apple's LLDB, so Swift variables and expressions behave as they
+do in Xcode with no `lldb.library` setup. What it can't do is build a scheme or
+start an app on a simulator or device; it expects a program to launch or a pid
+to attach to. That gap is exactly the part sweetpad already owns.
+
+**`sweetpad dap` is an adapter in front of `lldb-dap`.** The editor starts it
+over stdio; it starts `xcrun lldb-dap` as a child and forwards traffic both
+ways. Four messages are intercepted:
+
+- `initialize` is forwarded, and the capabilities in the reply are trimmed to
+  what the proxy honours (no `supportsRestartRequest` in v1).
+- `launch` is never forwarded as sent. Its fields resolve to a `RunPlan`; the
+  adapter builds, installs and launches suspended, then sends lldb-dap the
+  request it needs: `attach {pid}` on a simulator (the pid from `simctl launch
+  --wait-for-debugger`), a plain `launch {program, args, env}` on macOS, and on
+  a device `attachCommands` running `device select <udid>` and `device process
+  attach --pid <pid>` after `devicectl … --start-stopped`, the route the
+  extension's `debugger/provider.ts` already takes. lldb-dap's reply is relayed
+  as the answer to the editor's `launch`.
+- `attach` reaches an app that is already running, by bundle id or pid, with
+  no build.
+- `disconnect` is forwarded, then the app is terminated unless the client sent
+  `terminateDebuggee: false`, and the log stream stops.
+
+Everything else (breakpoints, stepping, `stackTrace`, `variables`, `evaluate`)
+passes through untouched.
+
+**Sequence numbers are renumbered in one direction.** The proxy injects
+messages of its own (build output, app logs), so everything flowing to the
+editor carries the proxy's `seq`. Toward lldb-dap the editor's `seq` is kept,
+and the rewritten `launch` reuses the original's, so lldb-dap's `request_seq`
+already matches what the editor asked. Reverse requests from lldb-dap
+(`runInTerminal`) are renumbered toward the editor and their responses mapped
+back to lldb-dap's numbers.
+
+**The launch config mirrors `run`'s flags:**
+
+```json
+{ "type": "sweetpad", "request": "launch", "scheme": "MyApp", "configuration": "Debug",
+  "destination": "iPhone 18 Pro", "args": [], "env": {}, "lldb": { "sourceMap": [] } }
+```
+
+`destination` is the `--on` specifier, so `booted` and `mac` resolve as they
+do for `run`, and `lldb` is passed to lldb-dap untouched. Missing fields fall
+back to the remembered scheme and destination. A DAP session has no terminal,
+so it never prompts: with nothing explicit and nothing remembered, `launch`
+fails with the choices listed and `sweetpad run` named as the way to pick once.
+The extension shows its own picker and passes the result.
+
+**Build and app output go to the debug console.** The build streams as
+`output` events in the short build-log form, compiler errors carrying `source`
+and `line` so editors link them, wrapped in `progressStart`/`progressEnd`.
+Simulator stdout and stderr arrive through the log stream `run` already
+follows; on macOS lldb launched the process and captures stdout itself, so the
+stream isn't attached twice. An editor that disconnects mid-build cancels the
+`xcodebuild` it started.
+
+**Restart and hot reload wait.** v1 advertises no `restart`, and VS Code and
+nvim-dap fall back to disconnect-and-launch, which already rebuilds. A native
+restart means a fresh lldb-dap child and replaying every breakpoint request the
+editor sent. `--hot` stays out of debug sessions until injection with a
+debugger attached is tested.
+
+**The surface follows `bsp`.** `sweetpad dap` serves on stdio; `dap init
+--editor nvim|zed|helix` writes the editor's adapter entry; `dap doctor` checks
+that `xcrun lldb-dap` resolves (following `DEVELOPER_DIR` and `xcode-select`)
+and that Xcode is new enough, with an override path for anything else.
+`SWEETPAD_DAP_LOG` names a file that records the full DAP traffic, as
+`SWEETPAD_BSP_LOG` does for BSP.

```

---

### Incident Patch 2: `8f9489e0` (2026-10-04)
**Commit Message**: Add a looping sweetpad run demo under the landing page hero

**File**: `sweetpad-docs/src/pages/index.module.css` (modified, +27/-0)
```diff
@@ -409,6 +409,33 @@
 
 /* Social-proof strip. A slim step down from the hero, so the numbers read as a
    footnote to the pitch rather than a section of their own. */
+.demo {
+    background-color: #22272e;
+    padding: 2.5rem 2rem 0.5rem;
+}
+
+.demoInner {
+    max-width: 1100px;
+    margin: 0 auto;
+    /* The video's background is this section's color; fading its edges hides
+       any shift the decoder makes to it. */
+    mask-image: linear-gradient(to bottom, transparent 0, #000 4%, #000 96%, transparent 100%);
+}
+
+.demoVideo {
+    display: block;
+    width: 100%;
+    height: auto;
+    aspect-ratio: 16 / 9;
+    mask-image: linear-gradient(to right, transparent 0, #000 4%, #000 96%, transparent 100%);
+}
+
+@media (max-width: 600px) {
+    .demo {
+        padding: 1.5rem 0.25rem 0.25rem;
+    }
+}
+
 .stats {
     background-color: #22272e;
     padding: 1.75rem 2rem;
```

**File**: `sweetpad-docs/src/pages/index.tsx` (modified, +59/-0)
```diff
@@ -1,7 +1,9 @@
 import type * as React from "react";
+import { useEffect, useRef, useState } from "react";
 import Layout from "@theme/Layout";
 import styles from "./index.module.css";
 import Link from "@docusaurus/Link";
+import useBaseUrl from "@docusaurus/useBaseUrl";
 
 const toneClass: Record<string, string> = {
 	ok: styles.tOk,
@@ -64,6 +66,62 @@ function HeroBanner() {
 	);
 }
 
+/**
+ * One real `sweetpad run` session, an edit to the app, and the rebuild, looping
+ * on the section's own background. It plays muted on its own, except for readers
+ * who prefer reduced motion: they get the poster frame and the controls instead.
+ */
+function DemoVideo() {
+	const video = useRef<HTMLVideoElement>(null);
+	const [reducedMotion, setReducedMotion] = useState(false);
+	const webm = useBaseUrl("/videos/sweetpad-demo.webm");
+	const mp4 = useBaseUrl("/videos/sweetpad-demo.mp4");
+	const poster = useBaseUrl("/videos/sweetpad-demo-poster.jpg");
+
+	useEffect(() => {
+		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
+			setReducedMotion(true);
+			return;
+		}
+		const element = video.current;
+		if (!element) {
+			return;
+		}
+		// React hydration leaves the muted property unset, and browsers only autoplay muted video.
+		element.muted = true;
+		// Browsers refuse to start video in a background tab, so start it whenever the page is shown.
+		const play = () => {
+			if (document.visibilityState === "visible" && element.paused) {
+				element.play().catch(() => {});
+			}
+		};
+		play();
+		document.addEventListener("visibilitychange", play);
+		return () => document.removeEventListener("visibilitychange", play);
+	}, []);
+
+	return (
+		<section className={styles.demo} data-theme="dark">
+			<div className={styles.demoInner}>
+				<video
+					ref={video}
+					className={styles.demoVideo}
+					muted
+					loop
+					playsInline
+					preload="metadata"
+					controls={reducedMotion}
+					poster={poster}
+					aria-label="sweetpad run builds an app and launches it in the iOS Simulator, then rebuilds and relaunches it after a code change"
+				>
+					<source src={webm} type="video/webm" />
+					<source src={mp4} type="video/mp4" />
+				</video>
+			</div>
+		</section>
+	);
+}
+
 /**
  * Numbers a reader can check, in the place they'd look for a reason to keep
  * scrolling. Rounded down so they stay true between edits.
@@ -410,6 +468,7 @@ export default function Home(): React.JSX.Element {
 		>
 			<main>
 				<HeroBanner />
+				<DemoVideo />
 				<StatsBar />
 				<CliFeatures />
 				<ProofBand />
```

---

### Incident Patch 3: `601302d0` (2026-10-04)
**Commit Message**: Pass -parse-as-library to swiftc where Swift Build does

A target whose only Swift file isn't `main.swift` was compiled as if that file were `main.swift`, so a SwiftUI app with a lone `@main` file reported top-level code. The flag now follows Swift Build's rule: a single input not named `main.swift`, or `SWIFT_LIBRARIES_ONLY`, unless `SWIFT_DISABLE_PARSE_AS_LIBRARY` is set.

**File**: `sweetpad-core/src/build_settings.rs` (modified, +1/-0)
```diff
@@ -435,6 +435,7 @@ pub fn resolve_file_arguments(
                 arguments: compiler_args::swift_arguments(
                     settings,
                     &query.arch,
+                    &swift_inputs,
                     swift_opts,
                     xcode_version,
                     has_package_products,
```

**File**: `sweetpad-core/tests/bsp_arg_invariants.rs` (modified, +7/-0)
```diff
@@ -270,9 +270,16 @@ fn editor_args(
     let query = ResolveQuery::new(target, config, platform, "arm64");
     let resolved = ctx.resolve(&query).ok()?;
     let has_pkg = project::target_has_package_products(xcodeproj, target).unwrap_or(false);
+    let inputs: Vec<String> = project::target_source_files(xcodeproj, target)
+        .unwrap_or_default()
+        .into_iter()
+        .filter(|p| p.extension().is_some_and(|e| e == "swift"))
+        .map(|p| p.to_string_lossy().into_owned())
+        .collect();
     Some(compiler_args::swift_arguments(
         &resolved.settings,
         "arm64",
+        &inputs,
         swift_opts,
         XCODE_VERSION,
         has_pkg,
```

**File**: `sweetpad-core/tests/compiler_args_oracle.rs` (modified, +1/-0)
```diff
@@ -514,6 +514,7 @@ fn compiler_args_oracle_coverage() {
                 let ours = compiler_args::swift_arguments(
                     settings,
                     &oracle.arch,
+                    &sw.input_files,
                     swift_opts,
                     &version,
                     has_pkg,
```

**File**: `sweetpad-lib/src/compiler_args.rs` (modified, +61/-7)
```diff
@@ -122,6 +122,7 @@ pub fn target_arguments(
         arguments: swift_arguments(
             settings,
             arch,
+            &swift_inputs,
             swift_options,
             xcode_version,
             has_package_products,
@@ -186,13 +187,16 @@ fn link_tool(settings: &Settings, product_type: Option<&str>) -> &'static str {
 /// (`options`) through that data and hand-coding the computed/build-system flags
 /// it doesn't (the target triple, search paths, driver defaults, …). Pass `&[]`
 /// for `options` to fall back to the hand-coded heuristic for every option.
+/// `inputs` are the `.swift` files the invocation compiles, which decide
+/// `-parse-as-library` ([`emit_parse_as_library`]).
 ///
 /// Order is not significant — the oracle comparator scores argv as a multiset —
 /// so flags are grouped by concern for readability.
 #[must_use]
 pub fn swift_arguments(
     settings: &Settings,
     arch: &str,
+    inputs: &[String],
     options: &[CompilerOption],
     xcode_version: &str,
     has_package_products: bool,
@@ -297,6 +301,7 @@ pub fn swift_arguments(
     }
     emit_unit_test_search_paths(&mut a, settings);
     emit_swift_system_search_paths(&mut a, settings);
+    emit_parse_as_library(&mut a, settings, inputs);
 
     // Swift macros a package vends are out-of-process executable plugins. A
     // plugin *search path* doesn't discover executables, so the frontend
@@ -375,6 +380,22 @@ fn emit_unit_test_search_paths(a: &mut ArgBuilder, settings: &Settings) {
     }
 }
 
+/// `-parse-as-library` where Swift Build passes it (`SwiftCompilerSpec`): under
+/// `SWIFT_LIBRARIES_ONLY` (the xcspec's encoding), and for a compile of a
+/// single file not named `main.swift` unless `SWIFT_DISABLE_PARSE_AS_LIBRARY`
+/// is set. Without it a lone file compiles as the module's `main.swift`, so an
+/// app whose only file declares `@main` reports top-level code.
+fn emit_parse_as_library(a: &mut ArgBuilder, settings: &Settings, inputs: &[String]) {
+    let yes = |key: &str| is_yes(settings.get(key).map_or("", String::as_str));
+    let lone_file = matches!(
+        inputs,
+        [only] if Path::new(only).file_name().is_none_or(|name| name != "main.swift")
+    );
+    if yes("SWIFT_LIBRARIES_ONLY") || (lone_file && !yes("SWIFT_DISABLE_PARSE_AS_LIBRARY")) {
+        a.flag("-parse-as-library");
+    }
+}
+
 /// The system search paths, the way Swift Build hands them to swiftc
 /// (`SwiftCompilerSpec.searchPathArguments`). Each `SYSTEM_FRAMEWORK_SEARCH_PATHS`
 /// entry not already searched as a framework path is `-Fsystem` for Mac
@@ -1625,7 +1646,7 @@ mod tests {
         s.insert("SWIFT_VERSION".into(), "5.0".into());
         s.insert("SWIFT_ACTIVE_COMPILATION_CONDITIONS".into(), "DEBUG".into());
         // No spec options: exercises the hand-coded fallback path.
-        let args = swift_arguments(&s, "arm64", &[], "26.5.0", false, &[]);
+        let args = swift_arguments(&s, "arm64", &[], &[], "26.5.0", false, &[]);
         let joined = args.join(" ");
         assert!(joined.contains("-module-name Alamofire"));
         assert!(joined.contains("-Onone"));
@@ -1671,7 +1692,7 @@ mod tests {
             "SWIFT_ACTIVE_COMPILATION_CONDITIONS".into(),
             "DEBUG COCOAPODS".into(),
         );
-        let args = swift_arguments(&s, "arm64", &[opt_level, conds], "26.5.0", false, &[]);
+        let args = swift_arguments(&s, "arm64", &[], &[opt_level, conds], "26.5.0", false, &[]);
         // The enum's special-cased `-Owholemodule` expands; conditions become -D.
         assert!(
             args.windows(2)
@@ -1764,7 +1785,7 @@ mod tests {
         // `-Xfrontend -load-plugin-executable -Xfrontend <plugin>#<module>` form.
         let s = Settings::new();
         let plugins = [PathBuf::from("/dd/Build/Products/Debug/MyMacros")];
-        let args = swift_arguments(&s, "arm64", &[], "26.5.0", false, &plugins);
+        let args = swift_arguments(&s, "arm64", &[], &[], "26.5.0", false, &plugins);
         let joined = args.join(" ");
         assert!(
             args.iter().any(|a| a == "-load-plugin-executable"),
@@ -1785,7 +1806,7 @@ mod tests {
             "BUILT_PRODUCTS_DIR".into(),
             "/dd/Build/Products/Debug".into(),
         );
-        let args = swift_arguments(&s, "arm64", &[], "26.5.0", true, &[]);
+        let args = swift_arguments(&s, "arm64", &[], &[], "26.5.0", true, &[]);
         assert!(
             args.windows(2)
                 .any(|w| w[0] == "-F" && w[1] == "/dd/Build/Products/Debug/PackageFrameworks"),
@@ -1822,7 +1843,7 @@ mod tests {
              -fmodule-map-file=\"/dd/Build/Products/Debug-iphoneos/Pod A/Pod_A.modulemap\""
                 .into(),
         );
-        let args = swift_arguments(&s, "arm64", &[], "26.5.0", false, &[]);
+        let args = swift_arguments(&s, "arm64", &[], &[], "26.5.0", false, &[]);
         assert!(
             args.contains(
                 &"-fmodule-map-file=/dd/Build/Products/Debug-
```

---

### Incident Patch 4: `19af38b0` (2026-10-04)
**Commit Message**: Pass system framework and header search paths to swiftc and clang as Swift Build does

`SYSTEM_FRAMEWORK_SEARCH_PATHS` and `SYSTEM_HEADER_SEARCH_PATHS` never reached the compiler arguments, so a Mac Catalyst file resolved none of the UIKit or SwiftUI under the SDK's `System/iOSSupport`. They now follow Swift Build's rules: `-Fsystem` for the iOSSupport frameworks and `-F` for other paths in swiftc, `-iframework` in clang, and `-isystem` for headers.

**File**: `sweetpad-lib/src/compiler_args.rs` (modified, +146/-3)
```diff
@@ -296,6 +296,7 @@ pub fn swift_arguments(
         a.pair("-F", &p);
     }
     emit_unit_test_search_paths(&mut a, settings);
+    emit_swift_system_search_paths(&mut a, settings);
 
     // Swift macros a package vends are out-of-process executable plugins. A
     // plugin *search path* doesn't discover executables, so the frontend
@@ -374,6 +375,58 @@ fn emit_unit_test_search_paths(a: &mut ArgBuilder, settings: &Settings) {
     }
 }
 
+/// The system search paths, the way Swift Build hands them to swiftc
+/// (`SwiftCompilerSpec.searchPathArguments`). Each `SYSTEM_FRAMEWORK_SEARCH_PATHS`
+/// entry not already searched as a framework path is `-Fsystem` for Mac
+/// Catalyst's `System/iOSSupport` `Frameworks` and `SubFrameworks`, where its
+/// UIKit and SwiftUI live, or for every path under
+/// `SYSTEM_FRAMEWORK_SEARCH_PATHS_USE_FSYSTEM`, and `-F` otherwise. Each
+/// `SYSTEM_HEADER_SEARCH_PATHS` entry reaches the clang importer as
+/// `-isystem`, once (Catalyst's value repeats its iOSSupport `usr/include`).
+fn emit_swift_system_search_paths(a: &mut ArgBuilder, settings: &Settings) {
+    let all_fsystem = is_yes(
+        settings
+            .get("SYSTEM_FRAMEWORK_SEARCH_PATHS_USE_FSYSTEM")
+            .map_or("", String::as_str),
+    );
+    let mut searched: BTreeSet<String> = a
+        .out
+        .windows(2)
+        .filter(|w| matches!(w[0].as_str(), "-F" | "-Fsystem"))
+        .map(|w| w[1].clone())
+        .collect();
+    for path in ws_unquoted(
+        settings
+            .get("SYSTEM_FRAMEWORK_SEARCH_PATHS")
+            .map(String::as_str),
+    ) {
+        if !searched.insert(path.clone()) {
+            continue;
+        }
+        let ios_support = path.ends_with("System/iOSSupport/System/Library/Frameworks")
+            || path.ends_with("System/iOSSupport/System/Library/SubFrameworks");
+        a.pair(
+            if ios_support || all_fsystem {
+                "-Fsystem"
+            } else {
+                "-F"
+            },
+            &path,
+        );
+    }
+    let mut headers = BTreeSet::new();
+    for path in ws_unquoted(
+        settings
+            .get("SYSTEM_HEADER_SEARCH_PATHS")
+            .map(String::as_str),
+    ) {
+        if headers.insert(path.clone()) {
+            a.pair("-Xcc", "-isystem");
+            a.pair("-Xcc", &path);
+        }
+    }
+}
+
 /// Major version from an Xcode version string (`26.5.0` → 26), or 0 if absent /
 /// unparseable — callers treat 0 as the current (modern) toolchain.
 fn xcode_major(version: &str) -> u32 {
@@ -526,8 +579,8 @@ pub fn clang_arguments(
 /// from the core build settings (not the Clang xcspec): the target's generated
 /// header maps, the products dir's generated-headers `include` subdir +
 /// `HEADER_SEARCH_PATHS` as `-I`, the target's generated-sources dirs, the
-/// products dir + `FRAMEWORK_SEARCH_PATHS` as `-F`, and the user/system header
-/// paths as `-iquote`/`-isystem`. Each `flag`/path pair is emitted once (a
+/// products dir + `FRAMEWORK_SEARCH_PATHS` as `-F`, the system framework paths
+/// as `-iframework`, and the user/system header paths as `-iquote`/`-isystem`. Each `flag`/path pair is emitted once (a
 /// setting often re-inherits the products dir), as `emit_library_paths` does
 /// for `-L`.
 fn emit_clang_search_paths(a: &mut ArgBuilder, settings: &Settings, arch: &str) {
@@ -563,7 +616,9 @@ fn emit_clang_search_paths(a: &mut ArgBuilder, settings: &Settings, arch: &str)
         }
     }
 
-    // `-F`: the products dir, then FRAMEWORK_SEARCH_PATHS.
+    // `-F`: the products dir, then FRAMEWORK_SEARCH_PATHS; then
+    // SYSTEM_FRAMEWORK_SEARCH_PATHS as `-iframework`, less a path already
+    // searched with `-F`, as Swift Build adds a system framework path.
     if let Some(p) = products {
         paths.push(("-F", p.to_string()));
     }
@@ -572,6 +627,17 @@ fn emit_clang_search_paths(a: &mut ArgBuilder, settings: &Settings, arch: &str)
             .into_iter()
             .map(|p| ("-F", p)),
     );
+    let frameworks: BTreeSet<String> = paths
+        .iter()
+        .filter(|(flag, _)| *flag == "-F")
+        .map(|(_, p)| p.clone())
+        .collect();
+    paths.extend(
+        ws_unquoted(get("SYSTEM_FRAMEWORK_SEARCH_PATHS"))
+            .into_iter()
+            .filter(|p| !frameworks.contains(p))
+            .map(|p| ("-iframework", p)),
+    );
     paths.extend(
         ws_unquoted(get("USER_HEADER_SEARCH_PATHS"))
             .into_iter()
@@ -1988,4 +2054,81 @@ mod tests {
         assert!(got.contains(&("-I".to_string(), d.to_string())));
         assert!(!got.contains(&("-I".to_string(), format!("{d}/arm64"))));
     }
+
+    /// Mac Catalyst's UIKit and SwiftUI live under the macOS SDK's
+    /// `System/iOSSupport`, which Swift Build passes swiftc as `-Fsystem` and
+    /// `-Xcc -isystem`, once each though the setting repeats them. Any other
+    /// system framework path is a plain `-F`, and none repeats a `-F` already
+    //
```

---

### Incident Patch 5: `081deaaf` (2026-09-28)
**Commit Message**: Pass the Sentry DSN to the extension build so published builds report errors

rolldown embeds SENTRY_DSN in the bundle, and the deploy workflow never set it, so every published build had no DSN and sent nothing. The build step reads it from the SENTRY_DSN repository variable.

**File**: `.github/workflows/ci.yaml` (modified, +4/-1)
```diff
@@ -31,7 +31,10 @@ jobs:
       - name: Build extension bundle
         working-directory: sweetpad-vscode
         # Builds the universal .node addon into out/ so it exists for signing;
-        # the packaging step below reuses out/ without rebuilding.
+        # the packaging step below reuses out/ without rebuilding. The bundle
+        # embeds the Sentry DSN, which is public, so it's a repository variable.
+        env:
+          SENTRY_DSN: ${{ vars.SENTRY_DSN }}
         run: npm run vscode:prepublish
 
       - name: Import Developer ID certificate
```

---

### Incident Patch 6: `c97e04f3` (2026-09-28)
**Commit Message**: Build a target that lists macosx natively for My Mac, not as Designed for iPad

A target whose SUPPORTED_PLATFORMS lists macosx builds natively for a macOS destination, but the iOS-on-Mac rule resolved it for iphoneos as Designed for iPad. It keeps the macosx binding, as the catalyst-oracle job checks against xcodebuild.

**File**: `sweetpad-core/src/build_context.rs` (modified, +14/-1)
```diff
@@ -474,7 +474,8 @@ impl BuildContext {
 
     /// How `query`'s target builds for a macOS run destination (`-destination
     /// platform=macOS`) when its own SDK is `iphoneos`, or `None` for any
-    /// other target. xcodebuild picks the Mac Catalyst destination for a
+    /// other target, and for one whose `SUPPORTED_PLATFORMS` lists `macosx`,
+    /// which builds natively. xcodebuild picks the Mac Catalyst destination for a
     /// target that supports Catalyst, and otherwise the "Designed for iPad"
     /// one, which builds for `iphoneos` and runs the iOS app on the Mac. On
     /// Xcode 27 an iOS app with neither `SUPPORTS_MACCATALYST` nor
@@ -502,6 +503,18 @@ impl BuildContext {
             ..query.clone()
         };
         let authored = self.authored_probe(&bundle, &ios).settings;
+        // A target that lists `macosx` among its supported platforms builds
+        // natively for a macOS destination, as xcodebuild builds it.
+        if authored
+            .get("SUPPORTED_PLATFORMS")
+            .is_some_and(|platforms| {
+                platforms
+                    .split_whitespace()
+                    .any(|p| p.eq_ignore_ascii_case("macosx"))
+            })
+        {
+            return Ok(None);
+        }
         let yes = |key: &str| authored.get(key).map(|v| v.eq_ignore_ascii_case("YES"));
         let catalyst = yes("SUPPORTS_MACCATALYST").unwrap_or_else(|| {
             let default = self.xcspec.as_ref().and_then(|catalog| {
```

---

### Incident Patch 7: `6343da67` (2026-09-28)
**Commit Message**: Resolve the configuration a -configuration in bsp.json buildArgs names

The extension's builds let a -configuration in sweetpad.build.args replace their own, but the index kept resolving bsp.json's configuration, so it read Debug settings for a Release build. serve takes the buildArgs' configuration at startup and on reload, and its prepare build uses it too.

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +4/-1)
```diff
@@ -3685,7 +3685,10 @@ other than the one `bsp.json` does. So the extension writes that setting into
 `xcodebuild_args`). A relative `-xcconfig` is read against `workspacePath`,
 where the extension's builds run `xcodebuild`, by that folder's physical path,
 as `xcodebuild` reads it: through a symlinked folder, `../ci.xcconfig` is the
-real folder's sibling. The
+real folder's sibling. A `-configuration` in `buildArgs` replaces the
+extension's own on its builds' command line, so `serve` resolves that
+configuration instead of `bsp.json`'s `configuration`, at startup and when the
+file changes. The
 extension's builds read the setting with a copy of core's `VALUE_FLAGS`
 (`XCODEBUILD_VALUE_FLAGS`), and a spec fails when the two differ, so a build
 and the index agree on which argument is a flag's value: `-xcconfig -quiet`
```

**File**: `sweetpad-core/src/bsp/mod.rs` (modified, +86/-11)
```diff
@@ -553,7 +553,7 @@ impl ResolvedConfig {
             configuration: flags
                 .get("configuration")
                 .cloned()
-                .or_else(|| pull("configuration"))
+                .or_else(|| configuration_of(value))
                 .unwrap_or_else(|| "Debug".into()),
             scheme: flags.get("scheme").cloned().or_else(|| pull("scheme")),
             sdk: flags.get("sdk").cloned(),
@@ -619,14 +619,7 @@ fn config_base(value: &Value, path: &Path) -> PathBuf {
 /// without it, so a half-typed edit doesn't cost autocomplete the settings
 /// before it.
 fn command_line_of(value: &Value, base: &Path) -> (CommandLine, Option<String>) {
-    let args: Vec<String> = value
-        .get("buildArgs")
-        .and_then(Value::as_array)
-        .into_iter()
-        .flatten()
-        .filter_map(Value::as_str)
-        .map(str::to_string)
-        .collect();
+    let args = build_args(value);
     let warning = xcodebuild_args::dangling_flag(&args).map(|flag| {
         format!(
             "ignoring '{flag}' at the end of buildArgs: it has no value, and xcodebuild refuses it"
@@ -635,6 +628,33 @@ fn command_line_of(value: &Value, base: &Path) -> (CommandLine, Option<String>)
     (CommandLineSettings::of(&args, Some(base)).into(), warning)
 }
 
+/// A `bsp.json`'s `buildArgs`, the extension's `sweetpad.build.args`.
+fn build_args(value: &Value) -> Vec<String> {
+    value
+        .get("buildArgs")
+        .and_then(Value::as_array)
+        .into_iter()
+        .flatten()
+        .filter_map(Value::as_str)
+        .map(str::to_string)
+        .collect()
+}
+
+/// The configuration the extension's builds use: a `-configuration` in
+/// `buildArgs` replaces the one the extension picks on their command line, so
+/// it wins over the file's `configuration`, and the index resolves the
+/// configuration the build compiles.
+fn configuration_of(value: &Value) -> Option<String> {
+    xcodebuild_args::last_value(&build_args(value), "-configuration")
+        .map(str::to_string)
+        .or_else(|| {
+            value
+                .get("configuration")
+                .and_then(Value::as_str)
+                .map(str::to_string)
+        })
+}
+
 impl Server {
     /// Resolve the server config. An explicit `--project`/`--workspace` stays
     /// self-contained (no config file, no telemetry — used by `bsp init` and the
@@ -830,7 +850,7 @@ impl Server {
         let Ok(value) = serde_json::from_str::<Value>(&raw) else {
             return;
         };
-        let configuration = value.get("configuration").and_then(Value::as_str);
+        let configuration = configuration_of(&value);
         let scheme = value
             .get("scheme")
             .and_then(Value::as_str)
@@ -839,7 +859,7 @@ impl Server {
         if let Some(warning) = &warning {
             self.log(warning);
         }
-        self.apply_config(configuration, scheme, command_line);
+        self.apply_config(configuration.as_deref(), scheme, command_line);
         let socket = value
             .get("socket")
             .and_then(Value::as_str)
@@ -2488,6 +2508,61 @@ mod tests {
         );
     }
 
+    /// A `-configuration` in `buildArgs` replaces the one the extension picks
+    /// on its builds' command line, so the index resolves that configuration,
+    /// at startup and when the file changes, and the prepare build takes it.
+    #[test]
+    fn a_configuration_in_build_args_is_the_one_the_index_resolves() {
+        let project = format!(
+            "{}/fixtures/_synthetic-objectversion-110/project/SweetpadCIApp.xcodeproj",
+            env!("SWEETPAD_LIB_DIR")
+        );
+        let scratch = crate::scratch::ScratchDir::new("sweetpad-bsp-json-config").unwrap();
+        let config = scratch.join("bsp.json");
+        let write = |build_args: &[&str]| {
+            let body = serde_json::json!({
+                "workspacePath": *scratch,
+                "projectPath": project,
+                "configuration": "Debug",
+                "buildArgs": build_args,
+            });
+            std::fs::write(&config, body.to_string()).unwrap();
+        };
+        write(&["-quiet", "-configuration", "Release"]);
+        let sent = Sent::default();
+        let server = Server::build(
+            ResolvedConfig::from_file(&config, &BTreeMap::new()).unwrap(),
+            Some(config.clone()),
+            Arc::new(AtomicU8::new(LogLevel::Info as u8)),
+            CommandLine::default(),
+            sent.writer(),
+        )
+        .unwrap();
+        let resolved = |server: &Server| {
+            let opts = server.options_for("SweetpadCIMac", "macosx", "arm64");
+            let settings = crate::build_settings::resolve_build_settings(&opts)
+                .unwrap()
+                .pop()
+                .unwrap()
+                .settings;
+            (opts.configuration, settings["CONFIGURATION"].clone())
+        };
+        assert_eq!(resolved(&server), (
```

---

### Incident Patch 8: `1c4bfbfe` (2026-09-28)
**Commit Message**: Build an iOS app for My Mac as Designed for iPad unless it supports Mac Catalyst

An iOS app under platform=macOS resolved as Mac Catalyst unless the project said otherwise, so settings, the product path and app launch pointed at a Debug-maccatalyst bundle xcodebuild never builds. It resolves as Designed for iPad under iphoneos unless SUPPORTS_MACCATALYST is YES, and a target that can't run on the destination keeps its own platform, as in xcodebuild.

**File**: `sweetpad-core/src/build_context.rs` (modified, +123/-0)
```diff
@@ -88,6 +88,18 @@ fn default_sdk(layers: &[Vec<Assignment>]) -> String {
         .unwrap_or_else(|| "macosx".to_string())
 }
 
+/// How an iOS target builds for a macOS run destination
+/// ([`BuildContext::mac_destination_variant`]).
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub enum MacVariant {
+    /// Mac Catalyst: the `macosx` SDK with the iOS support libraries.
+    Catalyst,
+    /// "Designed for iPad": the `iphoneos` SDK, the iOS app run on the Mac.
+    DesignedForIpad,
+    /// Neither: xcodebuild has no macOS destination for it.
+    None,
+}
+
 /// One resolution query against a [`BuildContext`].
 #[derive(Debug, Clone)]
 pub struct ResolveQuery {
@@ -407,6 +419,117 @@ impl BuildContext {
         })
     }
 
+    /// The SDK `query`'s target builds with when its run destination's
+    /// platform isn't one the target supports, or `None` when it is. A
+    /// build for one destination builds each target that can't run there for
+    /// its own platform: on Xcode 27, a scheme with an iOS app and a macOS app
+    /// builds the macOS app for `macosx` under an iOS Simulator destination. A
+    /// simulator destination takes the simulator of the target's platform
+    /// where the target supports it (a watchOS app under an iPhone simulator).
+    /// The supported platforms are the target's authored
+    /// `SUPPORTED_PLATFORMS` under its own SDK, else that SDK's default: a
+    /// device SDK and its simulator (`iphoneos iphonesimulator`), or `macosx`.
+    pub fn own_platform_sdk(&self, query: &ResolveQuery) -> Result<Option<String>, Error> {
+        let Some(destination) = &query.destination else {
+            return Ok(None);
+        };
+        let bundle = self.document.build_settings(
+            &self.project.path,
+            &query.target,
+            &query.configuration,
+        )?;
+        let own = default_sdk(&bundle.layers);
+        let probe = ResolveQuery {
+            sdk: own.clone(),
+            destination: None,
+            ..query.clone()
+        };
+        let simulator = own
+            .strip_suffix("os")
+            .map(|family| format!("{family}simulator"));
+        let supported: Vec<String> = self
+            .authored_probe(&bundle, &probe)
+            .settings
+            .get("SUPPORTED_PLATFORMS")
+            .map_or_else(
+                || {
+                    std::iter::once(own.clone())
+                        .chain(simulator.clone())
+                        .collect()
+                },
+                |authored| {
+                    authored
+                        .split_whitespace()
+                        .map(str::to_ascii_lowercase)
+                        .collect()
+                },
+            );
+        let supports = |sdk: &str| supported.iter().any(|p| p == sdk);
+        if supports(&destination.platform) {
+            return Ok(None);
+        }
+        let simulator = simulator.filter(|sim| destination.is_simulator() && supports(sim));
+        Ok(Some(simulator.unwrap_or(own)))
+    }
+
+    /// How `query`'s target builds for a macOS run destination (`-destination
+    /// platform=macOS`) when its own SDK is `iphoneos`, or `None` for any
+    /// other target. xcodebuild picks the Mac Catalyst destination for a
+    /// target that supports Catalyst, and otherwise the "Designed for iPad"
+    /// one, which builds for `iphoneos` and runs the iOS app on the Mac. On
+    /// Xcode 27 an iOS app with neither `SUPPORTS_MACCATALYST` nor
+    /// `SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD` authored reports `PLATFORM_NAME
+    /// = iphoneos` and builds into `Debug-iphoneos` there. An application or
+    /// app extension doesn't support Catalyst unless it says so (their product
+    /// types default `SUPPORTS_MACCATALYST` to `NO`); a framework or library
+    /// does (the iOS platform's default is `YES`). The query's `-xcconfig` and
+    /// `KEY=VALUE` settings count, as they do for the build.
+    pub fn mac_destination_variant(
+        &self,
+        query: &ResolveQuery,
+    ) -> Result<Option<MacVariant>, Error> {
+        let bundle = self.document.build_settings(
+            &self.project.path,
+            &query.target,
+            &query.configuration,
+        )?;
+        if default_sdk(&bundle.layers) != "iphoneos" {
+            return Ok(None);
+        }
+        let ios = ResolveQuery {
+            sdk: "iphoneos".into(),
+            destination: None,
+            ..query.clone()
+        };
+        let authored = self.authored_probe(&bundle, &ios).settings;
+        let yes = |key: &str| authored.get(key).map(|v| v.eq_ignore_ascii_case("YES"));
+        let catalyst = yes("SUPPORTS_MACCATALYST").unwrap_or_else(|| {
+            let default = self.xcspec.as_ref().and_then(|catalog| {
+                let layer = catalog.layer_for(bundle.product_type.as_deref(), Some("iphoneos"));
+                project::last_unconditional_setting(&[layer], "SUPPORTS_MACCATALYST")
+  
```

**File**: `sweetpad-core/src/build_settings.rs` (modified, +64/-3)
```diff
@@ -7,7 +7,7 @@
 use std::collections::{BTreeMap, HashSet};
 use std::path::{Path, PathBuf};
 
-use crate::build_context::{BuildContext, ResolveQuery};
+use crate::build_context::{BuildContext, MacVariant, ResolveQuery};
 use sweetpad_lib::destination::RunDestination;
 use sweetpad_lib::xcspec::Catalog;
 use sweetpad_lib::{catalog_cache, compiler_args, project, scheme, workspace, xcode};
@@ -676,7 +676,7 @@ fn build_queries(
             queries.push(q);
         }
     }
-    queries
+    let mut queries: Vec<ResolveQuery> = queries
         .into_iter()
         .map(|mut q| {
             if let Some(p) = &opts.derived_data_path {
@@ -687,7 +687,68 @@ fn build_queries(
             }
             q
         })
-        .collect()
+        .collect();
+    if destination.is_some() {
+        bind_destination_sdks(ctx, &mut queries);
+    }
+    queries
+}
+
+/// Bind each query's SDK the way xcodebuild specializes a build's targets
+/// for its one run destination, which [`build_queries`] first binds every
+/// query to. On a macOS destination an iOS target builds for Mac Catalyst or
+/// "Designed for iPad" on `iphoneos` ([`BuildContext::mac_destination_variant`]).
+/// xcodebuild picks that destination for the whole build, from its apps, so a
+/// framework the app embeds builds for `iphoneos` too, although on its own it
+/// would take Catalyst; with no app among the queries, each target's own
+/// variant decides. That destination is an `iphoneos` one to the scheme's
+/// other targets, so a macOS app beside the iOS app builds as it would for an
+/// iOS device (full `ARCHS`, `ONLY_ACTIVE_ARCH = NO`). Any other target that
+/// can't run on the destination builds for its own platform
+/// ([`BuildContext::own_platform_sdk`]).
+fn bind_destination_sdks(ctx: &BuildContext, queries: &mut [ResolveQuery]) {
+    let variants: Vec<Option<MacVariant>> = queries
+        .iter()
+        .map(|q| {
+            if q.destination.as_ref().is_some_and(RunDestination::is_macos) {
+                ctx.mac_destination_variant(q).ok().flatten()
+            } else {
+                None
+            }
+        })
+        .collect();
+    let is_app = |target: &str| {
+        ctx.project.targets.iter().any(|t| {
+            t.name == target
+                && t.product_type.as_deref() == Some("com.apple.product-type.application")
+        })
+    };
+    let apps: Vec<MacVariant> = queries
+        .iter()
+        .zip(&variants)
+        .filter(|(q, _)| is_app(&q.target))
+        .filter_map(|(_, v)| *v)
+        .collect();
+    let designed_app = !apps.is_empty() && apps.iter().all(|v| *v == MacVariant::DesignedForIpad);
+    for (q, variant) in queries.iter_mut().zip(variants) {
+        if let Some(variant) = variant {
+            let designed = if apps.is_empty() {
+                variant == MacVariant::DesignedForIpad
+            } else {
+                designed_app
+            };
+            if designed {
+                q.sdk = "iphoneos".into();
+            }
+            continue;
+        }
+        if designed_app && let Some(destination) = &mut q.destination {
+            destination.platform = "iphoneos".into();
+        }
+        if let Ok(Some(sdk)) = ctx.own_platform_sdk(q) {
+            q.sdk = sdk;
+        }
+    }
 }
 
 #[cfg(test)]
```

**File**: `sweetpad-core/tests/destination_platform_oracle.rs` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+//! Destination-platform oracle: the SDK one run destination builds each
+//! target of a scheme for. `-destination platform=macOS` builds an iOS app
+//! that doesn't support Mac Catalyst "Designed for iPad", on the `iphoneos`
+//! SDK into `Debug-iphoneos`, and an app that does for Mac Catalyst.
+//! xcodebuild picks one destination for the scheme from its app, so the
+//! framework both schemes build follows the app either way, and a macOS app
+//! beside a Designed-for-iPad app builds as it would for an iOS device. A
+//! target that can't run on the destination builds for its own platform: an
+//! iPhone simulator destination builds the macOS app of a mixed scheme for
+//! `macosx`.
+//!
+//! The corpus oracles feed the resolver the SDK a capture reports, so they
+//! never check which SDK a destination binds. This one resolves the way the
+//! CLI does, from the scheme and the destination alone. Ground truth is a real
+//! `xcodebuild -showBuildSettings -json -scheme <S> -configuration Debug
+//! -destination <D>` capture of
+//! `fixtures/_synthetic-destination-platforms/xcode-<ver>/project/DestPlatforms`,
+//! named `<S>__Debug__<D>.json` (a simulator capture is made for a concrete
+//! device and named for its platform).
+
+mod common;
+
+use std::ffi::OsStr;
+use std::path::{Path, PathBuf};
+
+use sweetpad_core::build_settings::{BuildSettingsOptions, resolve_build_settings};
+use sweetpad_lib::destination::parse_destination_arg;
+
+use common::{
+    capture_xcode_version, fixtures_root, read_build_settings, sdksettings_root_for,
+    xcspec_root_for,
+};
+
+const FIXTURE_DIR: &str = "_synthetic-destination-platforms";
+
+/// The keys that say which platform and SDK variant a target builds for, and
+/// the ones a destination the target can't run on changes.
+const PLATFORM_KEYS: &[&str] = &[
+    "PLATFORM_NAME",
+    "EFFECTIVE_PLATFORM_NAME",
+    "SWIFT_PLATFORM_TARGET_PREFIX",
+    "LLVM_TARGET_TRIPLE_OS_VERSION",
+    "LLVM_TARGET_TRIPLE_SUFFIX",
+    "IS_MACCATALYST",
+    "SUPPORTED_PLATFORMS",
+    "ARCHS",
+    "ONLY_ACTIVE_ARCH",
+    "BUILD_ACTIVE_RESOURCES_ONLY",
+    "__IS_NOT_SIMULATOR",
+];
+
+/// Every `<scheme>__<config>__<destination>.json` capture under
+/// `fixtures/_synthetic-destination-platforms/*/captures/`.
+fn capture_files() -> Vec<PathBuf> {
+    let mut out = Vec::new();
+    let Ok(versions) = std::fs::read_dir(fixtures_root().join(FIXTURE_DIR)) else {
+        return out;
+    };
+    for version in versions.flatten() {
+        let Ok(entries) = std::fs::read_dir(version.path().join("captures")) else {
+            continue;
+        };
+        out.extend(
+            entries
+                .flatten()
+                .map(|e| e.path())
+                .filter(|p| p.extension() == Some(OsStr::new("json"))),
+        );
+    }
+    out.sort();
+    out
+}
+
+/// The scheme, configuration and destination a capture file is named for.
+fn capture_request(capture: &Path) -> (String, String, String) {
+    let stem = capture.file_stem().and_then(OsStr::to_str).unwrap();
+    let mut parts = stem.splitn(3, "__");
+    let mut next = || parts.next().unwrap().to_string();
+    (next(), next(), next())
+}
+
+/// The part of a products path below `Build/Products/`: `Debug-iphoneos`,
+/// `Debug-maccatalyst`.
+fn products_leaf(path: &str) -> &str {
+    path.rsplit_once("/Build/Products/")
+        .map_or(path, |(_, leaf)| leaf)
+}
+
+#[test]
+fn a_destination_binds_each_target_to_the_sdk_xcodebuild_builds_it_with() {
+    common::pin_capture_host();
+    let captures = capture_files();
+    assert!(
+        !captures.is_empty(),
+        "no {FIXTURE_DIR} captures found — fixture missing?"
+    );
+    for capture in &captures {
+        let version = capture_xcode_version(capture).unwrap();
+        let (scheme, configuration, destination) = capture_request(capture);
+        let root = capture.parent().unwrap().parent().unwrap();
+        let opts = BuildSettingsOptions {
+            project: Some(root.join("project/DestPlatforms/DestPlatforms.xcodeproj")),
+            scheme: Some(scheme.clone()),
+            configuration,
+            destination: parse_destination_arg(&destination),
+            xcspec_root: Some(xcspec_root_for(&version)),
+            sdksettings_root: Some(sdksettings_root_for(&version)),
+            ..BuildSettingsOptions::default()
+        };
+        let resolved = resolve_build_settings(&opts)
+            .unwrap_or_else(|e| panic!("{scheme} [{destination}]: {e}"));
+        let entries = read_build_settings(capture).unwrap();
+        for theirs in &entries {
+            let target = &theirs["TARGET_NAME"];
+            let ours = &resolved
+                .iter()
+                .find(|t| t.target == *target)
+                .unwrap_or_else(|| panic!("{scheme}: no {target} resolved"))
+                .settings;
+            for key in PLATFORM_KEYS {
+                // Where xcodebuild leaves a Catalyst ke
```

**File**: `sweetpad-docs/docs/cli/destinations.md` (modified, +10/-0)
```diff
@@ -220,6 +220,16 @@ sweetpad build --mac
 The macOS destination is also where the CLI's Mac-only verbs apply: `app screenshot` captures the
 app's window, and `app ui` reads and drives it through accessibility.
 
+For an iOS app, `--on mac` builds what `xcodebuild -destination platform=macOS` builds. An app that
+sets `SUPPORTS_MACCATALYST = YES` builds for Mac Catalyst, into `Debug-maccatalyst`. Any other iOS
+app builds "Designed for iPad" with the iOS device SDK (`iphoneos`), into `Debug-iphoneos`, and so do
+the frameworks its scheme builds. `settings show --on mac` reports the same settings, and the `app`
+commands look for the bundle there.
+
+A scheme can build targets for more than one platform, such as an iOS app and a macOS helper. Each
+target that can't run on the destination builds for its own platform, as it does in `xcodebuild`:
+under an iPhone simulator, the macOS helper still builds for macOS, into `Debug`.
+
 ## The raw escape hatch
 
 `--destination` takes xcodebuild's exact specifier, with no fuzzy matching:
```

**File**: `sweetpad-lib/DOCS.md` (modified, +2/-0)
```diff
@@ -260,6 +260,7 @@ Hand-built fixtures cover paths no real corpus project exercises:
 | `_synthetic-multiplatform` | One `SDKROOT = auto` target with `SUPPORTED_PLATFORMS = iphoneos iphonesimulator macosx` — the IceCubesApp shape that keeps the SDK-binding regression in CI |
 | `_synthetic-{coredata,assetsym,strcat,intents,cocoapods,macro,tests}` | BSP generated-source / CocoaPods / Swift-macro / XCTest coverage — each a forced `Probe*.swift` referencing a build-time-generated / Pod / macro-expanded symbol |
 | `_synthetic-spm`, `_synthetic-workspace` | SwiftPM package products (`-F …/PackageFrameworks`); multi-project `.xcworkspace` resolution |
+| `_synthetic-destination-platforms` | The SDK one run destination binds each target of a scheme to: an iOS app Designed for iPad or Mac Catalyst under `platform=macOS`, a macOS app beside an iOS app under either destination (`tests/destination_platform_oracle.rs`) |
 | `_synthetic-spm-graph` | One workspace reaching a local package six ways — its own `FileRef` member, the member project's declared package, both of their `.package(path:)` dependencies, and two under a `PBXFileSystemSynchronizedRootGroup` — plus a package carrying a `.swiftpm/xcode` scheme container and one whose only target is an `executableTarget` (`tests/spm_graph_oracle.rs` in sweetpad-core) |
 | `_global` | Per-SDK metadata (`sdks/<sdk>.json`), xcodebuild version banner |
 | `_tuist-src` | Generated tuist examples adding a command-line tool (`mh_execute`) and a standalone dynamic library (`mh_dylib`) to the compiler-args oracle. `16_capture_compiler_args.py --slug _tuist-src` resolves `corpus/_tuist-src`, which is a symlink to `corpus/tuist-fixtures/examples/xcode/generated_command_line_tool_with_dynamic_library`; 16 does not copy `raw/`, so a new version needs the `.xcodeproj` copied in by hand |
@@ -991,6 +992,7 @@ answers to the package name too. `Manifest::scheme_names` in
 | `appletvos` / `appletvsimulator` | ✅ | fixtures/alamofire/.../schemes/Alamofire tvOS |
 | `xros` / `xrsimulator` (visionOS) | ✅ | fixtures/ice-cubes/.../schemes/IceCubesApp (visionOS-Simulator captures) |
 | Mac Catalyst variant | ✅ | fixtures/ice-cubes/.../schemes/IceCubesApp/build-settings/Debug__macOS.json |
+| The SDK a destination binds per target: `platform=macOS` builds an iOS app Designed for iPad (`iphoneos`) or for Mac Catalyst, chosen per scheme; a target that can't run on the destination builds for its own platform | ✅ | fixtures/_synthetic-destination-platforms/xcode-27.0.0/captures/*.json (`tests/destination_platform_oracle.rs`) |
 | DriverKit | ❌ | — |
 
 ### Architectures
```

**File**: `sweetpad-lib/fixtures/_synthetic-destination-platforms/xcode-27.0.0/captures/CatApp__Debug__platform=macOS.json` (added, +1225/-0)
```diff
@@ -0,0 +1,1225 @@
+[
+  {
+    "action" : "build",
+    "buildSettings" : {
+      "__ARCHS__" : "arm64 x86_64",
+      "__DIAGNOSE_DEPRECATED_ARCHS" : "YES",
+      "__DIAGNOSE_INVALID_DEPLOYMENT_TARGET_AS_ERROR" : "YES",
+      "__IS_NOT_MACOS" : "NO",
+      "__IS_NOT_MACOS_macosx" : "NO",
+      "__IS_NOT_SIMULATOR" : "YES",
+      "__IS_NOT_SIMULATOR_simulator" : "NO",
+      "__ORIGINAL_SDK_DEFINED_LLVM_TARGET_TRIPLE_SYS" : "ios",
+      "_BOOL_" : "NO",
+      "_BOOL_NO" : "NO",
+      "_BOOL_YES" : "YES",
+      "_DISCOVER_COMMAND_LINE_LINKER_INPUTS" : "YES",
+      "_DISCOVER_COMMAND_LINE_LINKER_INPUTS_INCLUDE_WL" : "YES",
+      "_IPHONEOS_DEPLOYMENT_TARGET_IS_EMPTY" : "NO",
+      "_IS_EMPTY_" : "YES",
+      "_LD_MULTIARCH" : "YES",
+      "_SWIFT_EXPLICIT_MODULES_ALLOW_CXX_INTEROP" : "YES",
+      "_WRAPPER_CONTENTS_DIR" : "/Contents",
+      "_WRAPPER_CONTENTS_DIR_SHALLOW_BUNDLE_NO" : "/Contents",
+      "_WRAPPER_PARENT_PATH" : "/..",
+      "_WRAPPER_PARENT_PATH_SHALLOW_BUNDLE_NO" : "/..",
+      "_WRAPPER_RESOURCES_DIR" : "/Resources",
+      "_WRAPPER_RESOURCES_DIR_SHALLOW_BUNDLE_NO" : "/Resources",
+      "ACTION" : "build",
+      "AD_HOC_CODE_SIGNING_ALLOWED" : "YES",
+      "AGGREGATE_TRACKED_DOMAINS" : "YES",
+      "ALLOW_BUILD_REQUEST_OVERRIDES" : "NO",
+      "ALLOW_TARGET_PLATFORM_SPECIALIZATION" : "NO",
+      "ALTERNATE_GROUP" : "staff",
+      "ALTERNATE_MODE" : "u+w,go-w,a+rX",
+      "ALTERNATE_OWNER" : "hyzyla_home",
+      "ALTERNATIVE_DISTRIBUTION_WEB" : "NO",
+      "ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES" : "NO",
+      "ALWAYS_SEARCH_USER_PATHS" : "NO",
+      "ALWAYS_USE_SEPARATE_HEADERMAPS" : "NO",
+      "APP_SHORTCUTS_ENABLE_FLEXIBLE_MATCHING" : "YES",
+      "APPLICATION_EXTENSION_API_ONLY" : "NO",
+      "APPLY_RULES_IN_COPY_FILES" : "NO",
+      "APPLY_RULES_IN_COPY_HEADERS" : "NO",
+      "arch" : "undefined_arch",
+      "ARCH_COHORT_arm64e" : "arm64e arm64e.x1",
+      "ARCHS" : "arm64",
+      "ARCHS_BASE" : "arm64",
+      "ARCHS_STANDARD" : "arm64 x86_64",
+      "ARCHS_STANDARD_32_64_BIT" : "arm64 x86_64 i386",
+      "ARCHS_STANDARD_32_BIT" : "i386",
+      "ARCHS_STANDARD_64_BIT" : "arm64 x86_64",
+      "ARCHS_STANDARD_INCLUDING_64_BIT" : "arm64 x86_64",
+      "ASSETCATALOG_COMPILER_APPICON_NAME" : "AppIcon",
+      "AUTOMATICALLY_MERGE_DEPENDENCIES" : "NO",
+      "AUTOMATION_APPLE_EVENTS" : "NO",
+      "AVAILABLE_PLATFORMS" : "android appletvos appletvsimulator driverkit freebsd iphoneos iphonesimulator linux macosx none openbsd qnx staticlinux watchos watchsimulator webassembly xros xrsimulator",
+      "BUILD_ACTIVE_RESOURCES_ONLY" : "NO",
+      "BUILD_COMPONENTS" : "headers build",
+      "BUILD_DIR" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products",
+      "BUILD_LIBRARY_FOR_DISTRIBUTION" : "NO",
+      "BUILD_ONLY_KNOWN_LOCALIZATIONS" : "NO",
+      "BUILD_ROOT" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products",
+      "BUILD_STYLE" : "",
+      "BUILD_VARIANTS" : "normal",
+      "BUILT_PRODUCTS_DIR" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products/Debug-maccatalyst",
+      "BUNDLE_CONTENTS_FOLDER_PATH" : "Contents/",
+      "BUNDLE_CONTENTS_FOLDER_PATH_deep" : "Contents/",
+      "BUNDLE_EXECUTABLE_FOLDER_NAME_deep" : "MacOS",
+      "BUNDLE_EXECUTABLE_FOLDER_PATH" : "Contents/MacOS",
+      "BUNDLE_EXTENSIONS_FOLDER_PATH" : "Contents/Extensions",
+      "BUNDLE_FORMAT" : "deep",
+      "BUNDLE_FRAMEWORKS_FOLDER_PATH" : "Contents/Frameworks",
+      "BUNDLE_PLUGINS_FOLDER_PATH" : "Contents/PlugIns",
+      "BUNDLE_PRIVATE_HEADERS_FOLDER_PATH" : "Contents/PrivateHeaders",
+      "BUNDLE_PUBLIC_HEADERS_FOLDER_PATH" : "Contents/Headers",
+      "CACHE_ROOT" : "/var/folders/wq/kkdk740d68qcqvttr995x13w0000gq/C/com.apple.DeveloperTools/27.0-27A266a/Xcode",
+      "CCHROOT" : "/var/folders/wq/kkdk740d68qcqvttr995x13w0000gq/C/com.apple.DeveloperTools/27.0-27A266a/Xcode",
+      "CHMOD" : "/bin/chmod",
+      "CHOWN" : "chown",
+      "CLANG_ANALYZER_NONNULL" : "YES",
+      "CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION" : "YES_AGGRESSIVE",
+      "CLANG_CACHE_FINE_GRAINED_OUTPUTS" : "YES",
+      "CLANG_CXX_LANGUAGE_STANDARD" : "gnu++14",
+      "CLANG_CXX_LIBRARY" : "libc++",
+      "CLANG_ENABLE_EXPLICIT_MODULES" : "YES",
+      "CLANG_ENABLE_MODULES" : "YES",
+      "CLANG_ENABLE_OBJC_ARC" : "YES",
+      "CLANG_ENABLE_OBJC_WEAK" : "YES",
+      "CLANG_MODULES_BUILD_SESSION_FILE" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/Session.modulevalidation",
+      "CLANG_WARN__DUPLICATE_METHOD_MATCH" : "YES",
+      "CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING" : "YES",
+      "CLANG_WARN_BOOL_CONVERSION" : "YES",
+      "CLANG_WARN_COMMA" : "YES",
+      "CLANG_WARN_CONSTANT_CONVERSION" : "YES",
+      "CLANG_WARN_DEPRECATED_OBJC_I
```

**File**: `sweetpad-lib/fixtures/_synthetic-destination-platforms/xcode-27.0.0/captures/IPadApp__Debug__platform=macOS.json` (added, +1208/-0)
```diff
@@ -0,0 +1,1208 @@
+[
+  {
+    "action" : "build",
+    "buildSettings" : {
+      "__ARCHS__" : "arm64",
+      "__DIAGNOSE_DEPRECATED_ARCHS" : "YES",
+      "__DIAGNOSE_INVALID_DEPLOYMENT_TARGET_AS_ERROR" : "YES",
+      "__IS_NOT_MACOS" : "YES",
+      "__IS_NOT_MACOS_macosx" : "NO",
+      "__IS_NOT_SIMULATOR" : "YES",
+      "__IS_NOT_SIMULATOR_simulator" : "NO",
+      "__ORIGINAL_SDK_DEFINED_LLVM_TARGET_TRIPLE_SYS" : "ios",
+      "_DISCOVER_COMMAND_LINE_LINKER_INPUTS" : "YES",
+      "_DISCOVER_COMMAND_LINE_LINKER_INPUTS_INCLUDE_WL" : "YES",
+      "_LD_MULTIARCH" : "YES",
+      "_SWIFT_EXPLICIT_MODULES_ALLOW_CXX_INTEROP" : "YES",
+      "_WRAPPER_CONTENTS_DIR_SHALLOW_BUNDLE_NO" : "/Contents",
+      "_WRAPPER_PARENT_PATH_SHALLOW_BUNDLE_NO" : "/..",
+      "_WRAPPER_RESOURCES_DIR_SHALLOW_BUNDLE_NO" : "/Resources",
+      "ACTION" : "build",
+      "AD_HOC_CODE_SIGNING_ALLOWED" : "NO",
+      "AGGREGATE_TRACKED_DOMAINS" : "YES",
+      "ALLOW_BUILD_REQUEST_OVERRIDES" : "NO",
+      "ALLOW_TARGET_PLATFORM_SPECIALIZATION" : "NO",
+      "ALTERNATE_GROUP" : "staff",
+      "ALTERNATE_MODE" : "u+w,go-w,a+rX",
+      "ALTERNATE_OWNER" : "hyzyla_home",
+      "ALTERNATIVE_DISTRIBUTION_WEB" : "NO",
+      "ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES" : "NO",
+      "ALWAYS_SEARCH_USER_PATHS" : "NO",
+      "ALWAYS_USE_SEPARATE_HEADERMAPS" : "NO",
+      "APP_SHORTCUTS_ENABLE_FLEXIBLE_MATCHING" : "YES",
+      "APPLICATION_EXTENSION_API_ONLY" : "NO",
+      "APPLY_RULES_IN_COPY_FILES" : "NO",
+      "APPLY_RULES_IN_COPY_HEADERS" : "NO",
+      "arch" : "undefined_arch",
+      "ARCH_COHORT_arm64e" : "arm64e arm64e.x1",
+      "ARCHS" : "arm64",
+      "ARCHS_BASE" : "arm64",
+      "ARCHS_STANDARD" : "arm64",
+      "ARCHS_STANDARD_32_64_BIT" : "armv7 arm64",
+      "ARCHS_STANDARD_32_BIT" : "armv7",
+      "ARCHS_STANDARD_64_BIT" : "arm64",
+      "ARCHS_STANDARD_INCLUDING_64_BIT" : "arm64",
+      "ARCHS_UNIVERSAL_IPHONE_OS" : "armv7 arm64",
+      "ASSETCATALOG_COMPILER_APPICON_NAME" : "AppIcon",
+      "ASSETCATALOG_FILTER_FOR_DEVICE_MODEL" : "MacFamily20,1",
+      "ASSETCATALOG_FILTER_FOR_DEVICE_OS_VERSION" : "27.0",
+      "ASSETCATALOG_FILTER_FOR_THINNING_DEVICE_CONFIGURATION" : "MacFamily20,1",
+      "AUTOMATICALLY_MERGE_DEPENDENCIES" : "NO",
+      "AUTOMATION_APPLE_EVENTS" : "NO",
+      "AVAILABLE_PLATFORMS" : "android appletvos appletvsimulator driverkit freebsd iphoneos iphonesimulator linux macosx none openbsd qnx staticlinux watchos watchsimulator webassembly xros xrsimulator",
+      "BUILD_ACTIVE_RESOURCES_ONLY" : "YES",
+      "BUILD_COMPONENTS" : "headers build",
+      "BUILD_DIR" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products",
+      "BUILD_LIBRARY_FOR_DISTRIBUTION" : "NO",
+      "BUILD_ONLY_KNOWN_LOCALIZATIONS" : "NO",
+      "BUILD_ROOT" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products",
+      "BUILD_STYLE" : "",
+      "BUILD_VARIANTS" : "normal",
+      "BUILT_PRODUCTS_DIR" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products/Debug-iphoneos",
+      "BUNDLE_CONTENTS_FOLDER_PATH_deep" : "Contents/",
+      "BUNDLE_EXECUTABLE_FOLDER_NAME_deep" : "MacOS",
+      "BUNDLE_EXTENSIONS_FOLDER_PATH" : "Extensions",
+      "BUNDLE_FORMAT" : "shallow",
+      "BUNDLE_FRAMEWORKS_FOLDER_PATH" : "Frameworks",
+      "BUNDLE_PLUGINS_FOLDER_PATH" : "PlugIns",
+      "BUNDLE_PRIVATE_HEADERS_FOLDER_PATH" : "PrivateHeaders",
+      "BUNDLE_PUBLIC_HEADERS_FOLDER_PATH" : "Headers",
+      "CACHE_ROOT" : "/var/folders/wq/kkdk740d68qcqvttr995x13w0000gq/C/com.apple.DeveloperTools/27.0-27A266a/Xcode",
+      "CCHROOT" : "/var/folders/wq/kkdk740d68qcqvttr995x13w0000gq/C/com.apple.DeveloperTools/27.0-27A266a/Xcode",
+      "CHMOD" : "/bin/chmod",
+      "CHOWN" : "chown",
+      "CLANG_ANALYZER_NONNULL" : "YES",
+      "CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION" : "YES_AGGRESSIVE",
+      "CLANG_CACHE_FINE_GRAINED_OUTPUTS" : "YES",
+      "CLANG_CXX_LANGUAGE_STANDARD" : "gnu++14",
+      "CLANG_CXX_LIBRARY" : "libc++",
+      "CLANG_ENABLE_EXPLICIT_MODULES" : "YES",
+      "CLANG_ENABLE_MODULES" : "YES",
+      "CLANG_ENABLE_OBJC_ARC" : "YES",
+      "CLANG_ENABLE_OBJC_WEAK" : "YES",
+      "CLANG_MODULES_BUILD_SESSION_FILE" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/Session.modulevalidation",
+      "CLANG_WARN__DUPLICATE_METHOD_MATCH" : "YES",
+      "CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING" : "YES",
+      "CLANG_WARN_BOOL_CONVERSION" : "YES",
+      "CLANG_WARN_COMMA" : "YES",
+      "CLANG_WARN_CONSTANT_CONVERSION" : "YES",
+      "CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS" : "YES",
+      "CLANG_WARN_DIRECT_OBJC_ISA_USAGE" : "YES_ERROR",
+      "CLANG_WARN_DOCUMENTATION_COMMENTS" : "YES",
+      "CLANG_WARN_EMPTY_BODY" : "YES",
+      "CLANG_WARN_ENUM_CONVERSION" : "YES",
+  
```

**File**: `sweetpad-lib/fixtures/_synthetic-destination-platforms/xcode-27.0.0/captures/Mixed__Debug__platform=iOS Simulator.json` (added, +1212/-0)
```diff
@@ -0,0 +1,1212 @@
+[
+  {
+    "action" : "build",
+    "buildSettings" : {
+      "__ARCHS__" : "arm64 x86_64",
+      "__DIAGNOSE_DEPRECATED_ARCHS" : "YES",
+      "__DIAGNOSE_INVALID_DEPLOYMENT_TARGET_AS_ERROR" : "YES",
+      "__IS_NOT_MACOS" : "YES",
+      "__IS_NOT_MACOS_macosx" : "NO",
+      "__IS_NOT_SIMULATOR" : "NO",
+      "__IS_NOT_SIMULATOR_simulator" : "NO",
+      "__ORIGINAL_SDK_DEFINED_LLVM_TARGET_TRIPLE_SYS" : "ios",
+      "_DISCOVER_COMMAND_LINE_LINKER_INPUTS" : "YES",
+      "_DISCOVER_COMMAND_LINE_LINKER_INPUTS_INCLUDE_WL" : "YES",
+      "_LD_MULTIARCH" : "YES",
+      "_SWIFT_EXPLICIT_MODULES_ALLOW_CXX_INTEROP" : "YES",
+      "_WRAPPER_CONTENTS_DIR_SHALLOW_BUNDLE_NO" : "/Contents",
+      "_WRAPPER_PARENT_PATH_SHALLOW_BUNDLE_NO" : "/..",
+      "_WRAPPER_RESOURCES_DIR_SHALLOW_BUNDLE_NO" : "/Resources",
+      "ACTION" : "build",
+      "AD_HOC_CODE_SIGNING_ALLOWED" : "YES",
+      "AGGREGATE_TRACKED_DOMAINS" : "YES",
+      "ALLOW_BUILD_REQUEST_OVERRIDES" : "NO",
+      "ALLOW_TARGET_PLATFORM_SPECIALIZATION" : "NO",
+      "ALTERNATE_GROUP" : "staff",
+      "ALTERNATE_MODE" : "u+w,go-w,a+rX",
+      "ALTERNATE_OWNER" : "hyzyla_home",
+      "ALTERNATIVE_DISTRIBUTION_WEB" : "NO",
+      "ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES" : "NO",
+      "ALWAYS_SEARCH_USER_PATHS" : "NO",
+      "ALWAYS_USE_SEPARATE_HEADERMAPS" : "NO",
+      "APP_SHORTCUTS_ENABLE_FLEXIBLE_MATCHING" : "YES",
+      "APPLICATION_EXTENSION_API_ONLY" : "NO",
+      "APPLY_RULES_IN_COPY_FILES" : "NO",
+      "APPLY_RULES_IN_COPY_HEADERS" : "NO",
+      "arch" : "undefined_arch",
+      "ARCHS" : "arm64",
+      "ARCHS_BASE" : "arm64",
+      "ARCHS_STANDARD" : "arm64 x86_64",
+      "ARCHS_STANDARD_32_64_BIT" : "arm64 x86_64",
+      "ARCHS_STANDARD_64_BIT" : "arm64 x86_64",
+      "ARCHS_STANDARD_INCLUDING_64_BIT" : "arm64 x86_64",
+      "ARCHS_UNIVERSAL_IPHONE_OS" : "arm64 x86_64",
+      "ASSETCATALOG_COMPILER_APPICON_NAME" : "AppIcon",
+      "ASSETCATALOG_FILTER_FOR_DEVICE_MODEL" : "iPhone18,5",
+      "ASSETCATALOG_FILTER_FOR_DEVICE_OS_VERSION" : "27.0",
+      "ASSETCATALOG_FILTER_FOR_THINNING_DEVICE_CONFIGURATION" : "iPhone18,5",
+      "AUTOMATICALLY_MERGE_DEPENDENCIES" : "NO",
+      "AUTOMATION_APPLE_EVENTS" : "NO",
+      "AVAILABLE_PLATFORMS" : "android appletvos appletvsimulator driverkit freebsd iphoneos iphonesimulator linux macosx none openbsd qnx staticlinux watchos watchsimulator webassembly xros xrsimulator",
+      "BUILD_ACTIVE_RESOURCES_ONLY" : "YES",
+      "BUILD_COMPONENTS" : "headers build",
+      "BUILD_DIR" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products",
+      "BUILD_LIBRARY_FOR_DISTRIBUTION" : "NO",
+      "BUILD_ONLY_KNOWN_LOCALIZATIONS" : "NO",
+      "BUILD_ROOT" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products",
+      "BUILD_STYLE" : "",
+      "BUILD_VARIANTS" : "normal",
+      "BUILT_PRODUCTS_DIR" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/DestPlatforms-dmtkailrzdwuecadqvjtybszshqs/Build/Products/Debug-iphonesimulator",
+      "BUNDLE_CONTENTS_FOLDER_PATH_deep" : "Contents/",
+      "BUNDLE_EXECUTABLE_FOLDER_NAME_deep" : "MacOS",
+      "BUNDLE_EXTENSIONS_FOLDER_PATH" : "Extensions",
+      "BUNDLE_FORMAT" : "shallow",
+      "BUNDLE_FRAMEWORKS_FOLDER_PATH" : "Frameworks",
+      "BUNDLE_PLUGINS_FOLDER_PATH" : "PlugIns",
+      "BUNDLE_PRIVATE_HEADERS_FOLDER_PATH" : "PrivateHeaders",
+      "BUNDLE_PUBLIC_HEADERS_FOLDER_PATH" : "Headers",
+      "CACHE_ROOT" : "/var/folders/wq/kkdk740d68qcqvttr995x13w0000gq/C/com.apple.DeveloperTools/27.0-27A266a/Xcode",
+      "CCHROOT" : "/var/folders/wq/kkdk740d68qcqvttr995x13w0000gq/C/com.apple.DeveloperTools/27.0-27A266a/Xcode",
+      "CHMOD" : "/bin/chmod",
+      "CHOWN" : "chown",
+      "CLANG_ANALYZER_NONNULL" : "YES",
+      "CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION" : "YES_AGGRESSIVE",
+      "CLANG_CACHE_FINE_GRAINED_OUTPUTS" : "YES",
+      "CLANG_CXX_LANGUAGE_STANDARD" : "gnu++14",
+      "CLANG_CXX_LIBRARY" : "libc++",
+      "CLANG_ENABLE_EXPLICIT_MODULES" : "YES",
+      "CLANG_ENABLE_MODULES" : "YES",
+      "CLANG_ENABLE_OBJC_ARC" : "YES",
+      "CLANG_ENABLE_OBJC_WEAK" : "YES",
+      "CLANG_MODULES_BUILD_SESSION_FILE" : "/Users/hyzyla_home/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/Session.modulevalidation",
+      "CLANG_WARN__DUPLICATE_METHOD_MATCH" : "YES",
+      "CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING" : "YES",
+      "CLANG_WARN_BOOL_CONVERSION" : "YES",
+      "CLANG_WARN_COMMA" : "YES",
+      "CLANG_WARN_CONSTANT_CONVERSION" : "YES",
+      "CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS" : "YES",
+      "CLANG_WARN_DIRECT_OBJC_ISA_USAGE" : "YES_ERROR",
+      "CLANG_WARN_DOCUMENTATION_COMMENTS" : "YES",
+      "CLANG_WARN_EMPTY_BODY" : "YES",
+      "CLANG_WARN_ENUM_CONVERSION" : "YES",
+      "CLANG_WARN_INFINITE_RECURSION" : "YES",
+      "CLANG_WA
```

---

### Incident Patch 9: `359db6aa` (2026-09-28)
**Commit Message**: Resolve a relative -xcconfig in the BSP's buildArgs where xcodebuild reads it

The BSP joined a relative -xcconfig from bsp.json buildArgs onto workspacePath as spelled, so through a symlinked folder the index read a different file than the build. It reads buildArgs through core's CommandLineSettings, against the folder's physical path, as the CLI does.

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +6/-3)
```diff
@@ -3680,9 +3680,12 @@ The extension's `buildServer.json` runs `sweetpad bsp serve --config
 not the file, and discovery from the working directory could name a container
 other than the one `bsp.json` does. So the extension writes that setting into
 `bsp.json` as `buildArgs`, and `serve` reads its `KEY=VALUE` settings and last
-`-xcconfig` the way the CLI reads `[xcodebuild] args` (the parser lives in
-sweetpad-core's `xcodebuild_args`). A relative `-xcconfig` is read against
-`workspacePath`, where the extension's builds run `xcodebuild`. The
+`-xcconfig` the way the CLI reads `[xcodebuild] args`, through the same
+`CommandLineSettings` in sweetpad-core's `app_locator` (the parser lives in
+`xcodebuild_args`). A relative `-xcconfig` is read against `workspacePath`,
+where the extension's builds run `xcodebuild`, by that folder's physical path,
+as `xcodebuild` reads it: through a symlinked folder, `../ci.xcconfig` is the
+real folder's sibling. The
 extension's builds read the setting with a copy of core's `VALUE_FLAGS`
 (`XCODEBUILD_VALUE_FLAGS`), and a spec fails when the two differ, so a build
 and the index agree on which argument is a flag's value: `-xcconfig -quiet`
```

**File**: `sweetpad-cli/src/cli/resolve.rs` (modified, +1/-22)
```diff
@@ -53,33 +53,12 @@ impl Container {
     #[must_use]
     pub fn key(&self) -> String {
         std::fs::canonicalize(self.path())
-            .unwrap_or_else(|_| absolutize(self.path()))
+            .unwrap_or_else(|_| sweetpad_lib::project::absolutize(self.path()))
             .to_string_lossy()
             .into_owned()
     }
 }
 
-/// Join a path onto the cwd (when relative) and squash `.`/`..` lexically — the
-/// canonicalize fallback that never touches the filesystem.
-fn absolutize(path: &Path) -> PathBuf {
-    use std::path::Component;
-    let mut out = if path.is_absolute() {
-        PathBuf::new()
-    } else {
-        std::env::current_dir().unwrap_or_default()
-    };
-    for comp in path.components() {
-        match comp {
-            Component::CurDir => {}
-            Component::ParentDir => {
-                out.pop();
-            }
-            c => out.push(c.as_os_str()),
-        }
-    }
-    out
-}
-
 /// Resolve the project container from explicit flags, else from a committed
 /// `sweetpad.toml` that names one, else by auto-discovery in the current
 /// directory (warning when same-kind siblings make the pick ambiguous). An
```

**File**: `sweetpad-core/src/bsp/mod.rs` (modified, +64/-10)
```diff
@@ -22,6 +22,7 @@ use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
 
 use serde_json::{Value, json};
 
+use crate::app_locator::CommandLineSettings;
 use crate::build_context::BuildContext;
 use crate::build_settings::{self, BuildSettingsOptions};
 use crate::framing::{read_message, write_message};
@@ -113,6 +114,17 @@ pub struct CommandLine {
     pub overrides: Vec<(String, String)>,
 }
 
+/// The settings a command line layers on every resolution. Its
+/// `-derivedDataPath` is left out: the server fixes DerivedData at startup.
+impl From<CommandLineSettings> for CommandLine {
+    fn from(settings: CommandLineSettings) -> Self {
+        Self {
+            xcconfig: settings.xcconfig,
+            overrides: settings.overrides,
+        }
+    }
+}
+
 /// Run the BSP server loop over stdin/stdout until EOF or `build/exit`.
 pub fn run(args: &[String]) -> Result<(), String> {
     run_with(args, CommandLine::default())
@@ -595,9 +607,12 @@ fn config_base(value: &Value, path: &Path) -> PathBuf {
 
 /// The command-line settings in a `bsp.json`'s `buildArgs`: the arguments
 /// the extension's builds add to `xcodebuild`, from `sweetpad.build.args`.
-/// Its `KEY=VALUE` settings and last `-xcconfig` are read as `xcodebuild`
-/// reads them, a relative `-xcconfig` against `base`, the directory those
-/// builds run in. A file without `buildArgs` has none.
+/// They are read as `xcodebuild` running in `base`, the directory those
+/// builds run in, reads them ([`CommandLineSettings::of`], the CLI's reader
+/// too): a relative `-xcconfig` joins the directory's physical path, so
+/// through a symlinked folder `../ci.xcconfig` is the real directory's
+/// sibling. A file without `buildArgs` has none. Its `-derivedDataPath` is
+/// the extension's to resolve into `derivedDataPath`.
 ///
 /// The second half is a warning for a flag that ends `buildArgs` without its
 /// value. The extension's builds fail on it, and the index reads the rest
@@ -617,11 +632,7 @@ fn command_line_of(value: &Value, base: &Path) -> (CommandLine, Option<String>)
             "ignoring '{flag}' at the end of buildArgs: it has no value, and xcodebuild refuses it"
         )
     });
-    let command_line = CommandLine {
-        xcconfig: xcodebuild_args::last_value(&args, "-xcconfig").map(|p| base.join(p)),
-        overrides: xcodebuild_args::settings(&args),
-    };
-    (command_line, warning)
+    (CommandLineSettings::of(&args, Some(base)).into(), warning)
 }
 
 impl Server {
@@ -2341,7 +2352,10 @@ mod tests {
         let pair = |k: &str, v: &str| (k.to_string(), v.to_string());
 
         let opts = server.options_for("SweetpadCIMac", "macosx", "arm64");
-        assert_eq!(opts.xcconfig, Some(scratch.join("ci.xcconfig")));
+        assert_eq!(
+            opts.xcconfig,
+            Some(sweetpad_lib::project::standardize(&scratch).join("ci.xcconfig"))
+        );
         assert_eq!(
             opts.overrides,
             [
@@ -2389,6 +2403,43 @@ mod tests {
         assert_eq!(opts.overrides, [pair("A", "typed")]);
     }
 
+    /// The extension's builds run `xcodebuild` in the workspace folder, which
+    /// `xcodebuild` knows by its physical path. Through a symlinked folder, a
+    /// relative `-xcconfig ../ci.xcconfig` in `buildArgs` is the real
+    /// folder's sibling, the way the CLI reads its arguments. A
+    /// `-derivedDataPath` there leaves DerivedData to `derivedDataPath`.
+    #[test]
+    fn build_args_paths_are_read_from_the_physical_workspace_folder() {
+        let project = format!(
+            "{}/fixtures/_synthetic-objectversion-110/project/SweetpadCIApp.xcodeproj",
+            env!("SWEETPAD_LIB_DIR")
+        );
+        let scratch = crate::scratch::ScratchDir::new("sweetpad-bsp-json-link").unwrap();
+        let real = scratch.join("real/app");
+        std::fs::create_dir_all(&real).unwrap();
+        std::fs::create_dir_all(scratch.join("elsewhere")).unwrap();
+        let link = scratch.join("elsewhere/link");
+        std::os::unix::fs::symlink(&real, &link).unwrap();
+        let config = scratch.join("bsp.json");
+        std::fs::write(
+            &config,
+            serde_json::json!({
+                "workspacePath": link,
+                "projectPath": project,
+                "buildArgs": ["-xcconfig", "../ci.xcconfig", "-derivedDataPath", "dd"],
+            })
+            .to_string(),
+        )
+        .unwrap();
+        let resolved = ResolvedConfig::from_file(&config, &BTreeMap::new()).unwrap();
+        let physical = sweetpad_lib::project::standardize(&real);
+        assert_eq!(
+            resolved.command_line.xcconfig,
+            Some(physical.parent().unwrap().join("ci.xcconfig"))
+        );
+        assert_eq!(resolved.derived_data_path, None);
+    }
+
     /// A `buildArgs` that ends with a flag waiting for its value fails the
     /// extension's builds. The index warns and reads the rest, the copy of the
     /// flag before it included,
```

---

### Incident Patch 10: `1dc956e2` (2026-09-28)
**Commit Message**: Compare each target on its own platforms in the live -showBuildSettings diff

The live differential read every target under -sdk macosx and a bare -sdk for simulators, so it reported ARCHS and SWIFT_PLATFORM_TARGET_PREFIX mismatches a real build doesn't have. It reads each target on the platforms its SUPPORTED_PLATFORMS names, binds a simulator platform to a concrete simulator as a build does, and asserts the SDK, platform, arch and triple inputs plus the compilation conditions.

**File**: `sweetpad-core/tests/showbuildsettings_live_diff.rs` (modified, +198/-28)
```diff
@@ -8,11 +8,23 @@
 //! `auto` resolves to a real SDK path and every platform of a multiplatform target
 //! gets a ground-truth row the pre-captured oracle never had.
 //!
+//! Each target is compared on the platforms its own `SUPPORTED_PLATFORMS`
+//! names, read the way a plain `-showBuildSettings` reads it: under the SDK
+//! its `SDKROOT` names. A device or macOS platform is bound with `-sdk`. A
+//! simulator platform is bound to a concrete simulator, through the scheme
+//! that builds the target, because that is how every simulator build runs and
+//! what the resolver models: with no device to single out, `-sdk
+//! iphonesimulator` alone keeps the full `ARCHS` list that a Debug build for a
+//! simulator collapses to the active arch. A simulator cell with no scheme or
+//! no simulator to bind falls back to `-sdk` and leaves the run-destination
+//! keys out of the comparison.
+//!
 //! For each key the resolver produces, it compares our value to xcodebuild's
 //! (canonicalized to absorb `$HOME` / DerivedData / Xcode-dir drift). The editor-
 //! critical keys that drive `-sdk`/`-target` (`SDKROOT`, `PLATFORM_NAME`, `ARCHS`,
-//! the triple inputs) are asserted for committed fixtures; everything else is
-//! reported, since this is a discovery sweep, not a byte-for-byte gate.
+//! the triple inputs) and the compilation conditions are asserted for committed
+//! fixtures; everything else is reported, since this is a discovery sweep, not a
+//! byte-for-byte gate.
 //!
 //! Opt-in (`BSP_LIVE_DIFF=1`): shells out to `xcodebuild` per (target, platform,
 //! config), so it's slow. It runs the Xcode `BSP_ORACLE_XCODE` names, else the
@@ -30,6 +42,7 @@ use oracle_xcode::OracleXcode;
 use serde_json::Value;
 use sweetpad_core::build_context::{BuildContext, ResolveQuery};
 use sweetpad_core::scratch::ScratchDir;
+use sweetpad_lib::destination::{self, RunDestination};
 use sweetpad_lib::{project, xcspec};
 
 const KNOWN_SDKS: &[&str] = &[
@@ -45,18 +58,108 @@ const KNOWN_SDKS: &[&str] = &[
 ];
 
 /// Keys whose mismatch corrupts the editor `-sdk`/`-target` (and thus stdlib
-/// loading) — asserted to match for the committed fixtures.
+/// loading), or changes what a file type-checks against — asserted to match
+/// for the committed fixtures.
 const CRITICAL_KEYS: &[&str] = &[
     "SDKROOT",
     "PLATFORM_NAME",
     "ARCHS",
     "SWIFT_PLATFORM_TARGET_PREFIX",
+    "IS_MACCATALYST",
+    "LLVM_TARGET_TRIPLE_OS_VERSION",
+    "LLVM_TARGET_TRIPLE_SUFFIX",
+    "SWIFT_ACTIVE_COMPILATION_CONDITIONS",
+    "GCC_PREPROCESSOR_DEFINITIONS",
+    "SWIFT_VERSION",
 ];
 
-/// The Xcode the diff runs and the `TMPDIR` it runs in.
+/// The keys only a run destination decides: with no simulator bound,
+/// xcodebuild's simulator view keeps the full arch list and no active
+/// resources, which no simulator build uses.
+const RUN_DESTINATION_KEYS: &[&str] = &["ARCHS", "BUILD_ACTIVE_RESOURCES_ONLY", "ONLY_ACTIVE_ARCH"];
+
+/// The Xcode the diff runs, the `TMPDIR` it runs in, and the simulators it
+/// can bind a simulator cell to.
 struct Live {
     xcode: OracleXcode,
     tmp: ScratchDir,
+    simulators: Vec<Simulator>,
+}
+
+/// One available simulator: its runtime's platform SDK and OS version, its
+/// name and its UDID.
+struct Simulator {
+    sdk: &'static str,
+    os: (u32, u32),
+    name: String,
+    udid: String,
+}
+
+impl Simulator {
+    /// The run destination a build for this simulator resolves under.
+    fn destination(&self) -> Option<RunDestination> {
+        let label = match self.sdk {
+            "iphonesimulator" => "iOS Simulator",
+            "appletvsimulator" => "tvOS Simulator",
+            "watchsimulator" => "watchOS Simulator",
+            "xrsimulator" => "visionOS Simulator",
+            _ => return None,
+        };
+        destination::parse_destination_arg(&format!(
+            "platform={label},OS={}.{},name={}",
+            self.os.0, self.os.1, self.name
+        ))
+    }
+}
+
+/// The simulators `simctl` lists as available for this Xcode, newest runtime
+/// first. Empty when `simctl` can't answer.
+fn available_simulators(xcode: &OracleXcode, tmp: &Path) -> Vec<Simulator> {
+    let Ok(out) = xcode
+        .command("xcrun", tmp)
+        .args(["simctl", "list", "devices", "available", "-j"])
+        .output()
+    else {
+        return Vec::new();
+    };
+    let json: Value = serde_json::from_slice(&out.stdout).unwrap_or(Value::Null);
+    let mut sims = Vec::new();
+    for (runtime, devices) in json
+        .get("devices")
+        .and_then(Value::as_object)
+        .into_iter()
+        .flatten()
+    {
+        // `com.apple.CoreSimulator.SimRuntime.iOS-27-0`
+        let Some((family, version)) = runtime.rsplit('.').next().and_then(|r| r.split_once('-'))
+        else {
+            continue;
+        };
+        let sdk = match family {
+            "iOS" => "iphonesimulator",
+            "tvOS" => "appletvsimulator",
+            "watchOS" => "wa
```

**File**: `sweetpad-lib/DOCS.md` (modified, +15/-11)
```diff
@@ -728,17 +728,21 @@ and the live differential) build with the Xcode that `BSP_ORACLE_XCODE` names
 choice for all of them. Except for `bsp_prepare`, their `xcodebuild`,
 `sourcekit-lsp` and toolchain runs get a `TMPDIR` of the test's own, which goes
 when the test ends. The live differential resolves against the specs of that
-same Xcode, not a committed `xcspec-cache/` capture. On Xcode 27.0 it fails on
-two editor-critical mismatches:
-
-- `SWIFT_PLATFORM_TARGET_PREFIX` is `ios` in ours and `macos` in xcodebuild
-  for an iOS app bound to `-sdk macosx` (`SweetpadCIApp` in
-  `_synthetic-objectversion-110`, `App` in `_synthetic-cocoapods`).
-- `ARCHS` is `arm64` in ours and `arm64 x86_64` in xcodebuild for
-  `_synthetic-multiplatform` on `iphonesimulator` in Debug.
-
-Both appear with the committed `xcode-27.0.0` catalog too. The fast hermetic
-tiers are version-agnostic.
+same Xcode, not a committed `xcspec-cache/` capture.
+
+The live differential compares each target on the platforms its
+`SUPPORTED_PLATFORMS` names, read under the target's own `SDKROOT` the way a
+plain `-showBuildSettings` reads it. A device or macOS platform is bound with
+`-target … -sdk`. A simulator platform is bound to a concrete simulator
+through the scheme that builds the target (`-scheme … -destination id=…`),
+since every simulator build runs on one: with `-sdk iphonesimulator` alone,
+xcodebuild keeps the full `ARCHS` that a Debug simulator build collapses to
+the active arch, and the resolver models the build. Where no scheme or no
+simulator is available, the cell falls back to `-sdk` and skips `ARCHS`,
+`ONLY_ACTIVE_ARCH` and `BUILD_ACTIVE_RESOURCES_ONLY`. The asserted keys are the
+SDK, platform, arch and triple inputs plus `SWIFT_ACTIVE_COMPILATION_CONDITIONS`,
+`GCC_PREPROCESSOR_DEFINITIONS` and `SWIFT_VERSION`. The fast hermetic tiers are
+version-agnostic.
 
 ### 8.4 Engine fixes the harness drove (knowledge catalog)
 
```

---

### Incident Patch 11: `0b888f4e` (2026-09-27)
**Commit Message**: Check every project write against the fixtures, with an xcodebuild oracle

Each write verb runs on every fixture in both formats and has to leave the object graph whole, restore the document under its inverse, and, with WRITE_LIVE_ORACLE=1, still open in xcodebuild and build.

**File**: `sweetpad-lib/tests/write_integrity.rs` (added, +1717/-0)
```diff
@@ -0,0 +1,1717 @@
+//! Every verb that writes a project document, run against the committed
+//! fixtures in both formats, with the document checked after each edit the
+//! way Xcode reads it.
+//!
+//! A `project.pbxproj` edit may not leave a name pointing at no object, lose
+//! an object the project reached unless the verb says it orphans one, delete
+//! an object of a kind the verb does not own, or list a node in a second group
+//! (Xcode 27.2 refuses to open that). A `project.xcproj` edit may not leave a
+//! configuration's xcconfig, a target's product or the products group naming
+//! nothing (Xcode 27.0 and 27.2 refuse that as an invalid reference), and a
+//! move may not change where any node resolves. An edit that refuses may not
+//! change the document at all, and an edit followed by its inverse restores
+//! it. The checks read the documents directly rather than through the crate's
+//! own readers, so they judge the writers independently.
+//!
+//! `WRITE_LIVE_ORACLE=1` adds the Xcode half: each edited project is written
+//! to a copy of its bundle, and `xcodebuild -list` has to open it and list the
+//! targets and configurations the unedited copy lists. A project that names
+//! Swift packages is skipped: listing it means resolving them, which needs
+//! the network and leaves a DerivedData folder behind. Then one small app is
+//! moved around in both formats and built. It runs the selected Xcode, which
+//! reads both formats from 27.0 on.
+
+mod common;
+
+use std::collections::{BTreeMap, BTreeSet};
+use std::path::{Path, PathBuf};
+use std::process::Command;
+use std::sync::Mutex;
+use std::sync::atomic::{AtomicUsize, Ordering};
+
+use common::TempDir;
+use sweetpad_lib::membership::Phase;
+use sweetpad_lib::pbxproj::{self, Dict};
+use sweetpad_lib::spm::RequirementSpec;
+use sweetpad_lib::stored_settings::{Assignment, Op, Scope};
+use sweetpad_lib::tree::{AddGroupOutcome, AddRefOutcome, MoveOutcome};
+use sweetpad_lib::{
+    membership_pbxproj, membership_xcproj, settings_pbxproj, settings_xcproj, spm_pbxproj,
+    spm_xcproj, sync_pbxproj, sync_xcproj, tree_pbxproj, tree_xcproj, xcproj,
+};
+
+const LIVE: &str = "WRITE_LIVE_ORACLE";
+
+const PROBE_URL: &str = "https://github.com/sweetpad-dev/sweetpad-probe";
+
+fn fixtures() -> PathBuf {
+    Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures")
+}
+
+/// Every file called `name` under the fixtures, one per distinct content, so
+/// a project captured under several Xcode versions is edited once.
+fn documents(name: &str) -> Vec<PathBuf> {
+    fn walk(dir: &Path, name: &str, out: &mut Vec<PathBuf>) {
+        let Ok(entries) = std::fs::read_dir(dir) else {
+            return;
+        };
+        let mut entries: Vec<PathBuf> = entries.flatten().map(|e| e.path()).collect();
+        entries.sort();
+        for path in entries {
+            if path.is_dir() {
+                walk(&path, name, out);
+            } else if path.file_name().is_some_and(|n| n == name) {
+                out.push(path);
+            }
+        }
+    }
+    let mut all = Vec::new();
+    walk(&fixtures(), name, &mut all);
+    let mut seen = BTreeSet::new();
+    all.into_iter()
+        .filter(|p| seen.insert(std::fs::read(p).unwrap_or_default()))
+        .collect()
+}
+
+/// Up to `n` items spread evenly over `items`, first and last included.
+fn spread<T: Clone>(items: &[T], n: usize) -> Vec<T> {
+    if items.len() <= n {
+        return items.to_vec();
+    }
+    (0..n)
+        .map(|i| items[i * (items.len() - 1) / (n - 1).max(1)].clone())
+        .collect()
+}
+
+fn label_of(path: &Path) -> String {
+    path.strip_prefix(fixtures())
+        .unwrap_or(path)
+        .display()
+        .to_string()
+}
+
+/// Failures across a whole run, reported together.
+#[derive(Default)]
+struct Report {
+    failures: Vec<String>,
+    edits: usize,
+}
+
+impl Report {
+    fn finish(self, what: &str) {
+        assert!(self.edits > 0, "no {what} edits ran");
+        assert!(
+            self.failures.is_empty(),
+            "{} of {} {what} edits broke the document:\n{}",
+            self.failures.len(),
+            self.edits,
+            self.failures.join("\n")
+        );
+    }
+}
+
+/// Edited documents worth opening in Xcode: what made each, and its text.
+type Edits = Vec<(String, String)>;
+
+/// A bundle, the name of its document, and the edits to open it with.
+type Edited = (PathBuf, &'static str, Edits);
+
+/// Run `exercise` on every fixture document called `name`, a few at a time,
+/// and gather what each found.
+fn exercise_all(
+    name: &'static str,
+    exercise: fn(&Path, &mut Report) -> Edits,
+) -> (Report, Vec<Edited>) {
+    let paths = documents(name);
+    let next = AtomicUsize::new(0);
+    let done = Mutex::new(Vec::new());
+    std::thread::scope(|scope| {
+        for _ in 0..8 {
+            scope.spawn(|| {
+                while let Some(path) = paths.get(next.fetch_add(1, Ordering::SeqCst)) {
+      
```

---

### Incident Patch 12: `cbdddcaf` (2026-09-27)
**Commit Message**: Share hot reload's build settings with the extension so macOS injection works

The CLI and the extension take the hot build settings and injection tables from sweetpad_core::hot. An extension hot build of a macOS app turns off the hardened runtime and App Sandbox too; without that, the client can't connect and injection fails silently.

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +4/-1)
```diff
@@ -1139,7 +1139,10 @@ Two hooks, mirroring the extension's proven `hot-reload.ts` path:
   `OTHER_LDFLAGS=$(inherited) -Xlinker -interposable`
   (lets dyld swap symbols at runtime) and `EMIT_FRONTEND_COMMAND_LINES=YES`
   (needed to recover compile commands on Xcode 16.3+; see the recompiler below).
-  Both are gated to `--hot` so ordinary `build`/`run` never pay for them.
+  Both are gated to `--hot` so ordinary `build`/`run` never pay for them. The
+  list, with the macOS additions below, is `sweetpad_core::hot::build_settings`,
+  which the extension's hot build reads through the addon
+  (`hotReloadBuildSettings`), next to the client dylib and platform tables.
 - **Launch env** — `[`crate::cli::simctl`]` gains an env-passing `launch`
   variant; `--hot` sets `SIMCTL_CHILD_DYLD_INSERT_LIBRARIES=<client dylib>`,
   `SIMCTL_CHILD_INJECTION_PROJECT_ROOT=<workspace root>`, and the XCTest
```

**File**: `sweetpad-cli/src/cli/inject/client.rs` (modified, +4/-40)
```diff
@@ -12,33 +12,9 @@
 
 use std::path::{Path, PathBuf};
 
-const INJECTIONNEXT_APP: &str = "/Applications/InjectionNext.app";
-
-/// Map an SDK to the InjectionNext dylib that injects into it. Returns
-/// `None` for SDKs InjectionNext can't inject (devices strip
-/// `DYLD_INSERT_LIBRARIES`; watchOS ships no dylib).
-#[must_use]
-pub fn dylib_name_for(sdk: &str) -> Option<&'static str> {
-    match sdk {
-        "iphonesimulator" => Some("libiphonesimulatorInjection.dylib"),
-        "appletvsimulator" => Some("libappletvsimulatorInjection.dylib"),
-        "xrsimulator" => Some("libxrsimulatorInjection.dylib"),
-        "macosx" => Some("libmacosxInjection.dylib"),
-        _ => None,
-    }
-}
+use sweetpad_core::hot;
 
-/// The `<Platform>.platform` directory name for an SDK, used to find XCTest.
-#[must_use]
-pub fn platform_dir_for(sdk: &str) -> Option<&'static str> {
-    match sdk {
-        "iphonesimulator" => Some("iPhoneSimulator"),
-        "appletvsimulator" => Some("AppleTVSimulator"),
-        "xrsimulator" => Some("XRSimulator"),
-        "macosx" => Some("MacOSX"),
-        _ => None,
-    }
-}
+const INJECTIONNEXT_APP: &str = "/Applications/InjectionNext.app";
 
 /// Inputs for resolving/injecting the client.
 pub struct ClientOptions {
@@ -106,7 +82,7 @@ pub fn check_available(sdk: &str, override_path: Option<&Path>) -> Result<(), St
 
 /// The InjectionNext dylib name for `sdk`, or why hot reload can't target it.
 fn client_name(sdk: &str) -> Result<&'static str, String> {
-    dylib_name_for(sdk).ok_or_else(|| format!("hot reload is not supported for the {sdk} SDK"))
+    hot::dylib_name(sdk).ok_or_else(|| format!("hot reload is not supported for the {sdk} SDK"))
 }
 
 /// Where an installed `InjectionNext.app` keeps its client for `name`.
@@ -176,7 +152,7 @@ pub fn launch_env(dylib: &Path, opts: &ClientOptions, prefix: &str) -> Vec<(Stri
 
 /// The Platform-specific XCTest framework + library search paths.
 fn xctest_search_paths(developer_dir: &str, sdk: &str) -> Option<(String, String)> {
-    let platform = platform_dir_for(sdk)?;
+    let platform = hot::platform_dir(sdk)?;
     let dev = Path::new(developer_dir)
         .join("Platforms")
         .join(format!("{platform}.platform"))
@@ -274,18 +250,6 @@ mod tests {
     use super::*;
     use crate::cli::testdir::TempDir;
 
-    #[test]
-    fn dylib_and_platform_map_simulator_sdks() {
-        assert_eq!(
-            dylib_name_for("iphonesimulator"),
-            Some("libiphonesimulatorInjection.dylib")
-        );
-        assert_eq!(platform_dir_for("iphonesimulator"), Some("iPhoneSimulator"));
-        // Devices / unknown SDKs aren't injectable.
-        assert_eq!(dylib_name_for("iphoneos"), None);
-        assert_eq!(platform_dir_for("watchsimulator"), None);
-    }
-
     #[test]
     fn launch_env_sets_dyld_and_injection_vars() {
         let opts = ClientOptions {
```

**File**: `sweetpad-cli/src/cli/inject/mod.rs` (modified, +1/-33)
```diff
@@ -62,23 +62,7 @@ impl Drop for HotSession {
     }
 }
 
-/// Map an `xcodebuild` `-destination` specifier to the SDK short name (the
-/// value SDK conditionals and the client dylib lookup key on) for the
-/// injectable destinations: simulators and native macOS. Returns `None` for
-/// the rest (devices, generic).
-#[must_use]
-pub fn sdk_for_destination(destination: &str) -> Option<&'static str> {
-    let spec = sweetpad_lib::destination::DestinationSpec::parse(destination);
-    if spec.generic {
-        return None;
-    }
-    spec.sdk().filter(|sdk| {
-        matches!(
-            *sdk,
-            "iphonesimulator" | "appletvsimulator" | "xrsimulator" | "macosx"
-        )
-    })
-}
+pub use sweetpad_core::hot::sdk_for_destination;
 
 /// Whether the project depends on the `Inject` package (krzysztofzablocki/Inject),
 /// which SwiftUI views need (`@ObserveInjection` + `.enableInjection()`) to
@@ -242,22 +226,6 @@ pub fn host_arch() -> String {
 mod tests {
     use super::*;
 
-    #[test]
-    fn sdk_for_destination_maps_injectable_destinations() {
-        assert_eq!(
-            sdk_for_destination("platform=iOS Simulator,id=ABC"),
-            Some("iphonesimulator")
-        );
-        assert_eq!(
-            sdk_for_destination("platform=visionOS Simulator,name=X"),
-            Some("xrsimulator")
-        );
-        assert_eq!(sdk_for_destination("platform=macOS"), Some("macosx"));
-        // Physical device / unknown → unsupported.
-        assert_eq!(sdk_for_destination("platform=iOS,id=ABC"), None);
-        assert_eq!(sdk_for_destination("generic/platform=iOS"), None);
-    }
-
     #[test]
     fn hardened_runtime_flag_detection() {
         let hardened = "Executable=/x/App\nIdentifier=dev.x.app\n\
```

**File**: `sweetpad-cli/src/cli/xcodebuild.rs` (modified, +15/-26)
```diff
@@ -190,7 +190,8 @@ pub struct BuildPlan<'a> {
     /// the destination imply it.
     pub sdk: Option<&'a str>,
     pub clean: bool,
-    /// Hot-reload build: add `-Xlinker -interposable` (so dyld can swap symbols)
+    /// Hot-reload build: add [`sweetpad_core::hot::build_settings`] for the
+    /// destination's SDK, `-Xlinker -interposable` (so dyld can swap symbols)
     /// and `EMIT_FRONTEND_COMMAND_LINES=YES` (so the build-log recompiler can
     /// recover per-file commands). A macOS destination additionally disables the
     /// hardened runtime and App Sandbox so the product is injectable. Set for
@@ -249,32 +250,20 @@ impl BuildPlan<'_> {
             args.push(bundle.display().to_string());
         }
         args.extend(container_args(self.container));
-        if self.hot {
-            // Build settings (KEY=VALUE) after the action; `$(inherited)` keeps
-            // any project OTHER_LDFLAGS. Mirrors the VS Code extension + the
-            // validated spike fixture.
-            args.push("OTHER_LDFLAGS=$(inherited) -Xlinker -interposable".into());
-            args.push("EMIT_FRONTEND_COMMAND_LINES=YES".into());
-            // A native macOS app must be injectable: the hardened runtime makes
-            // dyld strip `DYLD_INSERT_LIBRARIES` and library validation reject
-            // the ad-hoc recompiled dylibs, and the App Sandbox blocks both the
-            // client's socket and dlopen from outside the container. Command-line
-            // settings outrank project ones, so the hot Debug product is built
-            // without either protection. (A sandbox declared in an explicit
-            // entitlements file is beyond build settings — the mac preflight
-            // catches that case with instructions.)
-            if self
+        if self.hot
+            && let Some(sdk) = self
                 .destination
-                .is_some_and(|d| DestinationSpec::parse(d).is_macos())
-            {
-                args.push("ENABLE_HARDENED_RUNTIME=NO".into());
-                args.push("ENABLE_APP_SANDBOX=NO".into());
-                // An explicit entitlements plist outranks those settings at
-                // signing time; the ephemeral stripped copy wins it back.
-                if let Some(entitlements) = self.hot_entitlements {
-                    args.push(format!("CODE_SIGN_ENTITLEMENTS={}", entitlements.display()));
-                }
-            }
+                .and_then(sweetpad_core::hot::sdk_for_destination)
+        {
+            // Build settings (KEY=VALUE) after the action, shared with the VS
+            // Code extension. A sandbox declared in an entitlements file the
+            // stripped copy doesn't replace is beyond build settings: the mac
+            // preflight catches that case with instructions.
+            args.extend(
+                sweetpad_core::hot::build_settings(sdk, self.hot_entitlements)
+                    .into_iter()
+                    .map(|(key, value)| format!("{key}={value}")),
+            );
         }
         args.extend(self.passthrough.iter().cloned());
         args
```

**File**: `sweetpad-core/src/hot.rs` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+//! What a hot-reload build and launch need, shared by the CLI's `app run
+//! --hot` and the extension's hot reload: the SDKs InjectionNext can inject
+//! into, the client dylib and platform directory for each, and the build
+//! settings that make the product injectable.
+
+use std::path::Path;
+
+/// The SDK a `-destination` builds for, among the ones hot reload can inject
+/// into: the simulators InjectionNext ships a client for, and native macOS.
+/// `None` for the rest (devices, watchOS, generic destinations).
+#[must_use]
+pub fn sdk_for_destination(destination: &str) -> Option<&'static str> {
+    let spec = sweetpad_lib::destination::DestinationSpec::parse(destination);
+    if spec.generic {
+        return None;
+    }
+    spec.sdk().filter(|sdk| {
+        matches!(
+            *sdk,
+            "iphonesimulator" | "appletvsimulator" | "xrsimulator" | "macosx"
+        )
+    })
+}
+
+/// The InjectionNext client dylib that injects into apps built for `sdk`.
+/// `None` for SDKs InjectionNext can't inject into: devices strip
+/// `DYLD_INSERT_LIBRARIES`, and watchOS ships no dylib.
+#[must_use]
+pub fn dylib_name(sdk: &str) -> Option<&'static str> {
+    match sdk {
+        "iphonesimulator" => Some("libiphonesimulatorInjection.dylib"),
+        "appletvsimulator" => Some("libappletvsimulatorInjection.dylib"),
+        "xrsimulator" => Some("libxrsimulatorInjection.dylib"),
+        "macosx" => Some("libmacosxInjection.dylib"),
+        _ => None,
+    }
+}
+
+/// The `<Platform>.platform` directory an injectable `sdk` lives in, where
+/// the InjectionNext.app client finds the XCTest it links.
+#[must_use]
+pub fn platform_dir(sdk: &str) -> Option<&'static str> {
+    dylib_name(sdk).map(|_| sweetpad_lib::project::platform_dir_name_for(sdk))
+}
+
+/// The build settings a hot build for `sdk` adds, in order, as `KEY=VALUE`
+/// overrides that outrank the project's. Empty when hot reload can't inject
+/// into `sdk`.
+///
+/// Every injectable build links with `-interposable`, so dyld can swap
+/// symbols, and emits frontend command lines, so the recompiler can recover
+/// each file's compile command from the build log. A macOS app must also be
+/// injectable: the hardened runtime makes dyld strip `DYLD_INSERT_LIBRARIES`
+/// and library validation reject the recompiled dylibs, and the App Sandbox
+/// blocks the client's socket and loading from outside its container. Without
+/// these the app launches and injection fails silently. An entitlements file
+/// that turns the sandbox on outranks `ENABLE_APP_SANDBOX`, so a macOS build
+/// signs with `entitlements` (a copy without the sandbox) when given.
+#[must_use]
+pub fn build_settings(sdk: &str, entitlements: Option<&Path>) -> Vec<(&'static str, String)> {
+    if dylib_name(sdk).is_none() {
+        return Vec::new();
+    }
+    // `$(inherited)` keeps the project's own linker flags.
+    let mut settings = vec![
+        (
+            "OTHER_LDFLAGS",
+            "$(inherited) -Xlinker -interposable".to_string(),
+        ),
+        ("EMIT_FRONTEND_COMMAND_LINES", "YES".to_string()),
+    ];
+    if sdk == "macosx" {
+        settings.push(("ENABLE_HARDENED_RUNTIME", "NO".to_string()));
+        settings.push(("ENABLE_APP_SANDBOX", "NO".to_string()));
+        if let Some(entitlements) = entitlements {
+            settings.push(("CODE_SIGN_ENTITLEMENTS", entitlements.display().to_string()));
+        }
+    }
+    settings
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn sdk_for_destination_maps_injectable_destinations() {
+        assert_eq!(
+            sdk_for_destination("platform=iOS Simulator,id=ABC"),
+            Some("iphonesimulator")
+        );
+        assert_eq!(
+            sdk_for_destination("platform=visionOS Simulator,name=X"),
+            Some("xrsimulator")
+        );
+        assert_eq!(sdk_for_destination("platform=macOS"), Some("macosx"));
+        // Physical device / unknown → unsupported.
+        assert_eq!(sdk_for_destination("platform=iOS,id=ABC"), None);
+        assert_eq!(sdk_for_destination("generic/platform=iOS"), None);
+    }
+
+    #[test]
+    fn dylib_and_platform_cover_the_injectable_sdks() {
+        for (sdk, dylib, platform) in [
+            (
+                "iphonesimulator",
+                "libiphonesimulatorInjection.dylib",
+                "iPhoneSimulator",
+            ),
+            (
+                "appletvsimulator",
+                "libappletvsimulatorInjection.dylib",
+                "AppleTVSimulator",
+            ),
+            (
+                "xrsimulator",
+                "libxrsimulatorInjection.dylib",
+                "XRSimulator",
+            ),
+            ("macosx", "libmacosxInjection.dylib", "MacOSX"),
+        ] {
+            assert_eq!(dylib_name(sdk), Some(dylib));
+            assert_eq!(platform_dir(sdk), Some(platform));
+        }
+        // Devices, watchOS and unknown SDKs aren't inje
```

**File**: `sweetpad-core/src/lib.rs` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ pub mod build_context;
 pub mod build_settings;
 pub mod devices;
 pub mod framing;
+pub mod hot;
 pub mod package_members;
 pub mod paths;
 pub mod scratch;
```

**File**: `sweetpad-docs/docs/vscode/hot-reload.md` (modified, +6/-1)
```diff
@@ -81,7 +81,12 @@ environment.
 **Build flags.** It appends `OTHER_LDFLAGS=$(inherited) -Xlinker -interposable`
 to xcodebuild so the linker emits Swift functions as interposable symbols, plus
 `EMIT_FRONTEND_COMMAND_LINES=YES` so Xcode 16.3+ logs the per-file frontend
-invocations InjectionNext needs to recompile with.
+invocations InjectionNext needs to recompile with. A macOS build also gets
+`ENABLE_HARDENED_RUNTIME=NO` and `ENABLE_APP_SANDBOX=NO`. The hardened runtime
+stops the injection dylib from loading, and the App Sandbox stops it from
+connecting to InjectionNext. These are the same settings the `sweetpad` CLI uses
+for `app run --hot`. A sandbox turned on in your target's `.entitlements` file
+still applies, so turn App Sandbox off for Debug there.
 
 **Launch env.** It sets `DYLD_INSERT_LIBRARIES` on the simulator/macOS launch so
 the injection dylib loads automatically (no AppDelegate changes), and
```

**File**: `sweetpad-lib/src/project.rs` (modified, +4/-2)
```diff
@@ -3484,8 +3484,10 @@ fn detect_developer_dir() -> String {
         .into_owned()
 }
 
-/// Filesystem name of the platform under `<Xcode>/Contents/Developer/Platforms/`.
-fn platform_dir_name_for(sdk_base: &str) -> &'static str {
+/// Filesystem name of the platform under `<Xcode>/Contents/Developer/Platforms/`
+/// for an SDK name without its version (`iphonesimulator` is `iPhoneSimulator`).
+#[must_use]
+pub fn platform_dir_name_for(sdk_base: &str) -> &'static str {
     match sdk_base {
         "iphoneos" => "iPhoneOS",
         "iphonesimulator" => "iPhoneSimulator",
```

---

### Incident Patch 13: `4d0506c7` (2026-09-27)
**Commit Message**: Autocreate schemes per target unless another scheme runs or builds the target

scheme list, settings show and the build's product lookup disagreed with xcodebuild -list on which schemes Xcode autocreates: the resolver refused a scheme-less target's scheme whenever any scheme file existed, while the listing kept targets another scheme runs or builds. Both use lib's listed_schemes rule, measured against Xcode 27.0.

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +9/-0)
```diff
@@ -907,6 +907,15 @@ Notes / heuristics:
   Run action through it (`sweetpad_core::app_locator::find_scheme`), and so do
   the CLI, the build-settings resolver, the supported-platforms filter and the
   extension (launch settings, `scheme.reveal`).
+- Autocreated schemes follow Xcode's per-target rule
+  (`sweetpad_lib::project::listed_schemes`): each eligible target gets one
+  unless a scheme file is named for it, or a scheme file under another name
+  covers it (`sweetpad_lib::scheme::SchemeReferences`). A scheme covers an
+  app, tool or extension by running it in its Launch or Profile action, and a
+  framework or library by building it. A workspace's own scheme files count
+  for its members, and a local package's for its products. Scheme files for
+  other targets don't stand in the way, so `scheme list`, `settings show` and
+  the build's product lookup agree on the set `xcodebuild -list` prints.
 - `test run` exits non-zero on failures; the `--json` summary lands on stdout
   and the failure error on stderr, so both are independently consumable.
 - simulator inline logs use a best-effort `processImagePath CONTAINS` log
```

**File**: `sweetpad-core/src/build_settings.rs` (modified, +12/-11)
```diff
@@ -116,10 +116,11 @@ impl Selection {
 /// project, then each local package, shared then the current user's
 /// directories. A scheme with no
 /// file falls back to [`Selection::AutoScheme`] only when Xcode's scheme
-/// autocreation would surface it: no container holds *any* scheme file, and
-/// the shared workspace settings don't disable autocreation. Otherwise the
-/// unknown name is an error, matching `xcodebuild -scheme Nope` against a
-/// container that does have schemes.
+/// autocreation surfaces it: when the container lists it the way
+/// `xcodebuild -list` does ([`project::Project::schemes`],
+/// [`workspace::Workspace::project_for_scheme`]), which autocreates per
+/// target rather than per container. Otherwise the unknown name is an
+/// error, matching `xcodebuild -scheme Nope`.
 fn resolve_selection(
     opts: &BuildSettingsOptions,
     projects: &[PathBuf],
@@ -142,13 +143,13 @@ fn resolve_selection(
                 parsed: Box::new(parsed),
             });
         }
-        let any_scheme_files = containers
-            .iter()
-            .any(|c| !scheme::container_schemes(c).is_empty());
-        let autocreation = containers
-            .first()
-            .is_some_and(|primary| scheme::autocreation_allowed(primary));
-        if any_scheme_files || !autocreation {
+        let listed = match opts.workspace.as_deref() {
+            Some(ws) => workspace::open(ws).is_ok_and(|ws| ws.project_for_scheme(name).is_some()),
+            None => projects.first().is_some_and(|p| {
+                project::open(p).is_ok_and(|project| project.schemes.iter().any(|s| s == name))
+            }),
+        };
+        if !listed {
             return Err(format!(
                 "the workspace/project does not contain a scheme named {name:?}"
             ));
```

**File**: `sweetpad-core/src/package_members.rs` (modified, +84/-2)
```diff
@@ -37,6 +37,14 @@
 //! from a rename — it names a target no longer in the manifest, and
 //! `xcodebuild` autocreates nothing for that package.
 //!
+//! A product one of those scheme files covers gets no scheme of its own
+//! under its name: a scheme that builds a library product, or runs an
+//! executable one, takes its place, the way it does for a project's targets
+//! ([`sweetpad_lib::scheme::SchemeReferences`]). On Xcode 27.0 a project whose
+//! local package ships a `Beta.xcscheme` building its `Zeta` library lists
+//! `Beta` and no `Zeta`. A package opened on its own lists `Zeta` all the
+//! same.
+//!
 //! A target that no product exposes never gets a scheme, so a package that
 //! declares no products contributes nothing but its test targets — and,
 //! without a container or a membership, nothing at all. An `executableTarget`
@@ -186,6 +194,9 @@ struct ManifestNames {
     /// its own.
     name: String,
     products: Vec<String>,
+    /// The products that run: the declared executables and the implicit ones
+    /// behind `executableTarget`s.
+    executables: Vec<String>,
     test_targets: Vec<String>,
     targets: Vec<String>,
     /// Absolute directories of the manifest's `.package(path:)` dependencies.
@@ -287,6 +298,7 @@ fn cached_manifest(
     Some(ManifestNames {
         name: entry.get("name")?.as_str()?.to_string(),
         products: string_list(entry, "products")?,
+        executables: string_list(entry, "executables")?,
         test_targets: string_list(entry, "testTargets")?,
         targets: string_list(entry, "targets")?,
         path_deps: string_list(entry, "pathDependencies")?
@@ -306,6 +318,7 @@ fn cache_entry(current: Stamp, names: &ManifestNames) -> Value {
         "mtime": mtime.to_string(),
         "name": names.name,
         "products": names.products,
+        "executables": names.executables,
         "testTargets": names.test_targets,
         "targets": names.targets,
         "pathDependencies": names.path_deps
@@ -319,10 +332,21 @@ fn cache_entry(current: Stamp, names: &ManifestNames) -> Value {
 /// container names, its products, and — for a workspace member, or a package
 /// somebody has opened in Xcode — its test targets.
 fn schemes_for(dir: &Path, role: PackageRole, names: &ManifestNames) -> Vec<String> {
-    let files = sweetpad_lib::scheme::container_schemes(&package_scheme_root(dir));
+    let root = package_scheme_root(dir);
+    let files = sweetpad_lib::scheme::container_schemes(&root);
     let opened_in_xcode = has_a_scheme_that_resolves(dir, &files, names);
+    let references = sweetpad_lib::scheme::SchemeReferences::of(&root);
+    let uncovered: Vec<String> = names
+        .products
+        .iter()
+        .filter(|product| {
+            files.contains(product)
+                || !references.cover(None, product, names.executables.contains(product))
+        })
+        .cloned()
+        .collect();
     let mut out = files;
-    out.extend(names.products.iter().cloned());
+    out.extend(uncovered);
     if role == PackageRole::WorkspaceMember || opened_in_xcode {
         out.extend(names.test_targets.iter().cloned());
     }
@@ -639,6 +663,7 @@ fn read_manifest(manifest: &Value) -> ManifestNames {
             .unwrap_or_default()
             .to_string(),
         products: products_with_implicit_executables(manifest),
+        executables: executable_products(manifest),
         test_targets: names_in(manifest, "targets", is_test_target),
         targets: names_in(manifest, "targets", |_| true),
         path_deps: path_dependencies(manifest),
@@ -696,6 +721,27 @@ fn products_with_implicit_executables(manifest: &Value) -> Vec<String> {
     out
 }
 
+/// The products that run: the declared executables (`"type": {"executable":
+/// null}`), and the implicit product behind each `executableTarget` no
+/// declared product covers.
+fn executable_products(manifest: &Value) -> Vec<String> {
+    let declared: Vec<String> = names_in(manifest, "products", |product| {
+        product
+            .get("type")
+            .is_some_and(|t| t.get("executable").is_some())
+    });
+    let all_declared: HashSet<String> = names_in(manifest, "products", |_| true)
+        .into_iter()
+        .collect();
+    let mut out = declared;
+    out.extend(
+        products_with_implicit_executables(manifest)
+            .into_iter()
+            .filter(|name| !all_declared.contains(name)),
+    );
+    out
+}
+
 fn names_in(manifest: &Value, key: &str, keep: impl Fn(&Value) -> bool) -> Vec<String> {
     manifest
         .get(key)
@@ -953,6 +999,42 @@ mod tests {
         );
     }
 
+    /// A scheme that builds a library product takes its place in a container
+    /// that reaches the package (Xcode 27.0: a project over a package whose
+    /// `Beta.xcscheme` builds `Zeta` lists `Beta` and no `Zeta`), while the
+    /// package opened on its own still lists the product.
+    #[test]
+    fn a_scheme_that_builds_a_library_produc
```

**File**: `sweetpad-core/tests/build_settings.rs` (modified, +103/-6)
```diff
@@ -441,6 +441,28 @@ fn write_scheme(dir: &PathBuf, name: &str) {
     std::fs::write(dir.join(format!("{name}.xcscheme")), SCRATCH_SCHEME_XML).unwrap();
 }
 
+/// [`SCRATCH_SCHEME_XML`] with a Launch action that runs the `Scratch` target.
+fn write_running_scheme(dir: &PathBuf, name: &str) {
+    std::fs::create_dir_all(dir).unwrap();
+    let launch = r#"   <LaunchAction buildConfiguration="Debug">
+      <BuildableProductRunnable runnableDebuggingMode="0">
+         <BuildableReference
+            BuildableIdentifier="primary"
+            BlueprintIdentifier="14A71A1C6762522AADB33EF1"
+            BuildableName="Scratch"
+            BlueprintName="Scratch"
+            ReferencedContainer="container:Scratch.xcodeproj">
+         </BuildableReference>
+      </BuildableProductRunnable>
+   </LaunchAction>
+</Scheme>"#;
+    std::fs::write(
+        dir.join(format!("{name}.xcscheme")),
+        SCRATCH_SCHEME_XML.replace("</Scheme>", launch),
+    )
+    .unwrap();
+}
+
 #[test]
 fn scheme_without_file_resolves_the_same_named_target() {
     // No `.xcscheme` exists anywhere — Xcode's autocreated per-target scheme.
@@ -458,16 +480,34 @@ fn scheme_without_file_resolves_the_same_named_target() {
     assert_eq!(s.get("PRODUCT_NAME").map(String::as_str), Some("Scratch"));
 }
 
+/// Autocreation is per target. On Xcode 27.0 this project, with a `Custom`
+/// scheme that only builds `Scratch`, lists both `Custom` and `Scratch`, and
+/// `xcodebuild -showBuildSettings -scheme Scratch` resolves.
 #[test]
-fn unknown_scheme_errors_when_other_scheme_files_exist() {
-    // Xcode's autocreated per-target schemes only exist in containers with
-    // NO scheme files at all. Once any scheme file exists, xcodebuild
-    // refuses an unknown scheme name even if a target with that name exists.
+fn a_target_another_scheme_only_builds_keeps_its_autocreated_scheme() {
     let (_root, proj) = scratch_copy("schemes-exist");
     write_scheme(&proj.join("xcshareddata/xcschemes"), "Custom");
     let opts = BuildSettingsOptions {
         project: Some(proj),
-        scheme: Some("Scratch".to_string()), // a target, but not a scheme
+        scheme: Some("Scratch".to_string()),
+        configuration: "Debug".to_string(),
+        sdk: "macosx".to_string(),
+        arch: "arm64".to_string(),
+        ..Default::default()
+    };
+    let s = resolve_one(opts);
+    assert_eq!(s.get("PRODUCT_NAME").map(String::as_str), Some("Scratch"));
+}
+
+/// Once `Custom` runs `Scratch` in its Launch action, Xcode 27.0 lists
+/// `Custom` alone and refuses `-scheme Scratch`.
+#[test]
+fn a_target_another_scheme_runs_has_no_autocreated_scheme() {
+    let (_root, proj) = scratch_copy("scheme-runs");
+    write_running_scheme(&proj.join("xcshareddata/xcschemes"), "Custom");
+    let opts = BuildSettingsOptions {
+        project: Some(proj),
+        scheme: Some("Scratch".to_string()),
         configuration: "Debug".to_string(),
         sdk: "macosx".to_string(),
         arch: "arm64".to_string(),
@@ -477,6 +517,63 @@ fn unknown_scheme_errors_when_other_scheme_files_exist() {
     assert!(err.contains("does not contain a scheme"), "err: {err}");
 }
 
+/// A workspace listing the scratch project, with `scheme` written into the
+/// workspace's own shared schemes by `write`.
+fn scratch_workspace(tag: &str, write: fn(&PathBuf, &str)) -> (ScratchDir, PathBuf) {
+    let (root, _proj) = scratch_copy(tag);
+    let ws = root.join("W.xcworkspace");
+    std::fs::create_dir_all(&ws).unwrap();
+    std::fs::write(
+        ws.join("contents.xcworkspacedata"),
+        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Workspace version = \"1.0\">\n   \
+         <FileRef location = \"group:Scratch.xcodeproj\"></FileRef>\n</Workspace>\n",
+    )
+    .unwrap();
+    write(&ws.join("xcshareddata/xcschemes"), "Custom");
+    (root, ws)
+}
+
+fn workspace_scheme(ws: PathBuf, scheme: &str) -> BuildSettingsOptions {
+    BuildSettingsOptions {
+        workspace: Some(ws),
+        scheme: Some(scheme.to_string()),
+        configuration: "Debug".to_string(),
+        sdk: "macosx".to_string(),
+        arch: "arm64".to_string(),
+        ..Default::default()
+    }
+}
+
+/// A member's autocreated scheme survives a workspace scheme that only builds
+/// its target, as in `xcodebuild -list -workspace` on Xcode 27.0, and
+/// resolves.
+#[test]
+fn a_workspace_scheme_that_only_builds_a_member_target_keeps_its_scheme() {
+    let (_root, ws) = scratch_workspace("ws-builds", write_scheme);
+    assert_eq!(
+        sweetpad_lib::workspace::open(&ws).unwrap().merged_schemes(),
+        ["Custom", "Scratch"]
+    );
+    let s = resolve_one(workspace_scheme(ws, "Scratch"));
+    assert_eq!(s.get("PRODUCT_NAME").map(String::as_str), Some("Scratch"));
+}
+
+/// A workspace scheme that runs a member target takes the place of the
+/// target's autocreated scheme, in the listing and in resolution.
+#[test]
+fn a_workspace_scheme_that_runs_a_member_target_repl
```

**File**: `sweetpad-core/tests/project_resolution_fixes.rs` (modified, +35/-0)
```diff
@@ -377,6 +377,41 @@ fn scheme_for_target_autocreates_when_no_scheme_files() {
     assert_eq!(scheme_for_target(&proj, "App").as_deref(), Some("App"));
 }
 
+/// Autocreation is per target: a scheme file for `Tool` leaves `App` its own
+/// autocreated scheme, and a prepare of `App` builds through it.
+#[test]
+fn scheme_for_target_autocreates_beside_another_targets_scheme() {
+    let (_root, proj) = scratch_xcodeproj("scheme-autocreate-beside", TWO_CONFIG_PBXPROJ);
+    write_scheme(&proj.join("xcshareddata/xcschemes"), "ToolScheme", "Tool");
+    assert_eq!(open(&proj).unwrap().schemes, ["App", "Tool", "ToolScheme"]);
+    assert_eq!(scheme_for_target(&proj, "App").as_deref(), Some("App"));
+}
+
+/// A scheme that runs `App` under another name takes the place of its
+/// autocreated one: Xcode 27.0 lists only that scheme.
+#[test]
+fn a_scheme_that_runs_a_target_replaces_its_autocreated_scheme() {
+    let (_root, proj) = scratch_xcodeproj("scheme-runs-target", TWO_CONFIG_PBXPROJ);
+    let dir = proj.join("xcshareddata/xcschemes");
+    fs::create_dir_all(&dir).unwrap();
+    fs::write(
+        dir.join("Main.xcscheme"),
+        r#"<?xml version="1.0" encoding="UTF-8"?>
+<Scheme version = "1.7">
+   <LaunchAction buildConfiguration = "Debug">
+      <BuildableProductRunnable runnableDebuggingMode = "0">
+         <BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "APP"
+            BuildableName = "App.app" BlueprintName = "App" ReferencedContainer = "container:App.xcodeproj">
+         </BuildableReference>
+      </BuildableProductRunnable>
+   </LaunchAction>
+</Scheme>
+"#,
+    )
+    .unwrap();
+    assert_eq!(open(&proj).unwrap().schemes, ["Main", "Tool"]);
+}
+
 /// The plist disabling scheme autocreation, as Xcode writes it (and XcodeGen /
 /// Tuist generate it).
 const AUTOCREATE_OFF_PLIST: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
```

**File**: `sweetpad-lib/src/project.rs` (modified, +70/-38)
```diff
@@ -28,8 +28,8 @@ pub struct Project {
     /// Scheme names for this project, sorted alphabetically — the set
     /// `xcodebuild -list` prints: shared (`xcshareddata/xcschemes`) plus
     /// per-user (`xcuserdata/<user>.xcuserdatad/xcschemes`) scheme files,
-    /// plus one autocreated scheme per eligible target not already named by
-    /// a scheme file (Xcode's scheme autocreation; see
+    /// plus one autocreated scheme per eligible target no scheme file names
+    /// or runs (Xcode's scheme autocreation; see [`listed_schemes`], and
     /// [`autocreates_scheme_for_target`] for the eligibility rules). Schemes
     /// that `xcodebuild` additionally synthesizes from Swift *package*
     /// manifests are out of scope — they aren't derivable from the pbxproj.
@@ -206,32 +206,10 @@ pub fn open_from_value(value: &Value, xcodeproj_path: &Path) -> Result<Project,
     let configurations = extract_project_configurations(objects, project_obj)?;
     let default_configuration = default_configuration_name(objects, project_obj);
     let targets = extract_targets(objects, project_obj)?;
-    let mut schemes = crate::scheme::container_schemes(xcodeproj_path);
-    if crate::scheme::autocreation_allowed(xcodeproj_path) {
-        // Mirror Xcode's per-target scheme autocreation: `xcodebuild -list`
-        // reports one scheme per eligible target that no scheme file already
-        // names, even when other targets DO have scheme files (kingfisher's
-        // Demo project ships only `Kingfisher-Demo.xcscheme` yet lists its
-        // macOS/tvOS/watchOS demo apps too; NetNewsWire lists its
-        // extension targets). When the workspace settings disable
-        // autocreation (XcodeGen / Tuist write the flag), `xcodebuild -list`
-        // shows only the scheme files and so do we.
-        let existing: std::collections::BTreeSet<&str> =
-            schemes.iter().map(String::as_str).collect();
-        let first_config = configurations.first().cloned();
-        let autocreated: Vec<String> = targets
-            .iter()
-            .filter(|t| !existing.contains(t.name.as_str()))
-            .filter(|t| {
-                autocreates_scheme_for_target(value, xcodeproj_path, t, first_config.as_deref())
-            })
-            .map(|t| t.name.clone())
-            .collect();
-        schemes.extend(autocreated);
-        schemes.dedup();
-    }
-    crate::scheme::sort_like_xcodebuild(&mut schemes);
-    schemes.dedup();
+    let first_config = configurations.first().cloned();
+    let schemes = listed_schemes(xcodeproj_path, &targets, |t| {
+        autocreates_scheme_for_target(value, xcodeproj_path, t, first_config.as_deref())
+    });
 
     let name = xcodeproj_path
         .file_stem()
@@ -427,6 +405,58 @@ fn names_a_directory(node: &Value) -> bool {
     }
 }
 
+/// The schemes `xcodebuild -list -project` prints for the project at
+/// `xcodeproj_path`: its scheme files, plus one autocreated scheme per target
+/// `eligible` accepts that no scheme file names or runs, sorted the way
+/// `xcodebuild` sorts. Both project formats list their schemes through here.
+///
+/// Autocreation is per target, not per project: a project with scheme files
+/// still lists a scheme for each other eligible target (kingfisher's Demo
+/// project ships only `Kingfisher-Demo.xcscheme` yet lists its
+/// macOS/tvOS/watchOS demo apps too; NetNewsWire lists its extension
+/// targets). A target a scheme file runs, or builds when the target doesn't
+/// run, has none under its own name ([`crate::scheme::SchemeReferences`]).
+/// When the workspace settings disable
+/// autocreation (XcodeGen / Tuist write the flag), `xcodebuild -list` shows
+/// only the scheme files and so do we.
+pub(crate) fn listed_schemes(
+    xcodeproj_path: &Path,
+    targets: &[Target],
+    eligible: impl Fn(&Target) -> bool,
+) -> Vec<String> {
+    let mut schemes = crate::scheme::container_schemes(xcodeproj_path);
+    if crate::scheme::autocreation_allowed(xcodeproj_path) {
+        let existing: std::collections::BTreeSet<&str> =
+            schemes.iter().map(String::as_str).collect();
+        let references = crate::scheme::SchemeReferences::of(xcodeproj_path);
+        let autocreated: Vec<String> = targets
+            .iter()
+            .filter(|t| !existing.contains(t.name.as_str()))
+            .filter(|t| !references.cover(Some(xcodeproj_path), &t.name, t.runs()))
+            .filter(|t| eligible(t))
+            .map(|t| t.name.clone())
+            .collect();
+        schemes.extend(autocreated);
+    }
+    crate::scheme::sort_like_xcodebuild(&mut schemes);
+    schemes.dedup();
+    schemes
+}
+
+impl Target {
+    /// Whether the target is something a scheme runs, an app, a command-line
+    /// tool or an app extension, rather than something it only builds.
+    #[must_use]
+    pub fn runs(&self) -> bool {
+        self.product_type.as_deref().is_some_and(|pt| {
+            pt.starts_with("com.apple.
```

**File**: `sweetpad-lib/src/project_xcproj.rs` (modified, +4/-17)
```diff
@@ -67,23 +67,10 @@ pub(crate) fn open_from_value(value: &Value, xcodeproj_path: &Path) -> Result<Pr
     let default_configuration = schema::default_configuration(value).map(str::to_string);
     let targets = extract_targets(value, &configurations);
 
-    let mut schemes = crate::scheme::container_schemes(xcodeproj_path);
-    if crate::scheme::autocreation_allowed(xcodeproj_path) {
-        let existing: std::collections::BTreeSet<&str> =
-            schemes.iter().map(String::as_str).collect();
-        let first_config = configurations.first().cloned();
-        let autocreated: Vec<String> = targets
-            .iter()
-            .filter(|t| !existing.contains(t.name.as_str()))
-            .filter(|t| {
-                autocreates_scheme_for_target(value, xcodeproj_path, t, first_config.as_deref())
-            })
-            .map(|t| t.name.clone())
-            .collect();
-        schemes.extend(autocreated);
-    }
-    crate::scheme::sort_like_xcodebuild(&mut schemes);
-    schemes.dedup();
+    let first_config = configurations.first().cloned();
+    let schemes = crate::project::listed_schemes(xcodeproj_path, &targets, |t| {
+        autocreates_scheme_for_target(value, xcodeproj_path, t, first_config.as_deref())
+    });
 
     let name = xcodeproj_path
         .file_stem()
```

**File**: `sweetpad-lib/src/scheme.rs` (modified, +132/-0)
```diff
@@ -353,6 +353,96 @@ pub fn find_scheme_file(container: &Path, name: &str) -> Option<PathBuf> {
         .find(|p| p.is_file())
 }
 
+/// The targets the scheme files stored in a container point at, which decide
+/// the targets Xcode autocreates no scheme for.
+///
+/// Measured on Xcode 27.0 with `xcodebuild -list`: a target that runs (an
+/// app, a tool, an extension) loses its autocreated scheme once a scheme with
+/// another name runs it in its Launch or Profile action, and keeps it when
+/// that scheme only builds it or names it as the test action's macro
+/// expansion. A target that doesn't run (a framework, a library, a package's
+/// library product) loses it once a scheme builds it. A workspace's scheme
+/// files count for its member projects the same way.
+#[derive(Debug, Clone, Default)]
+pub struct SchemeReferences {
+    /// Each scheme's Launch or Profile runnable, as the project its
+    /// `ReferencedContainer` names and the target's name.
+    runs: Vec<(Option<PathBuf>, String)>,
+    /// Each scheme's Build action entries, the same way.
+    builds: Vec<(Option<PathBuf>, String)>,
+}
+
+impl SchemeReferences {
+    /// What the shared and the current user's scheme files in `container` (a
+    /// `.xcodeproj`, a `.xcworkspace`, or a package's `.swiftpm/xcode`) point
+    /// at. A `container:` reference resolves against the directory holding
+    /// `container`; one that names no project (a package's `container:`)
+    /// matches by target name alone.
+    #[must_use]
+    pub fn of(container: &Path) -> Self {
+        let base = container.parent().unwrap_or(Path::new(""));
+        let project_of = |reference: &BuildableRef| match reference.container.split_once(':') {
+            Some(("container", "")) => None,
+            Some(("container", rel)) => Some(crate::project::absolutize(&base.join(rel))),
+            Some(("absolute", abs)) => Some(crate::project::absolutize(Path::new(abs))),
+            _ => None,
+        };
+        let mut out = Self::default();
+        for name in container_schemes(container) {
+            let Some(root) =
+                find_scheme_file(container, &name).and_then(|p| xcscheme::parse_file(&p).ok())
+            else {
+                continue;
+            };
+            for action in ["LaunchAction", "ProfileAction"] {
+                if let Some(reference) = root
+                    .child(action)
+                    .and_then(|a| {
+                        a.child("BuildableProductRunnable")
+                            .or_else(|| a.child("RemoteRunnable"))
+                    })
+                    .and_then(|r| r.child("BuildableReference"))
+                    .and_then(parse_buildable)
+                {
+                    out.runs
+                        .push((project_of(&reference), reference.blueprint_name.clone()));
+                }
+            }
+            let entries = root
+                .child("BuildAction")
+                .and_then(|b| b.child("BuildActionEntries"));
+            for entry in entries
+                .map(|e| e.children_named("BuildActionEntry").collect::<Vec<_>>())
+                .unwrap_or_default()
+            {
+                if let Some(reference) = entry.child("BuildableReference").and_then(parse_buildable)
+                {
+                    out.builds
+                        .push((project_of(&reference), reference.blueprint_name.clone()));
+                }
+            }
+        }
+        out
+    }
+
+    /// Whether a scheme takes the place of `target`'s autocreated one: a
+    /// scheme that runs it, for a target that `runs`, or one that builds it,
+    /// for one that doesn't. `project` is the target's `.xcodeproj`; `None`
+    /// matches by name alone.
+    #[must_use]
+    pub fn cover(&self, project: Option<&Path>, target: &str, runs: bool) -> bool {
+        let project = project.map(crate::project::absolutize);
+        let references = if runs { &self.runs } else { &self.builds };
+        references.iter().any(|(p, t)| {
+            t == target
+                && match (p, &project) {
+                    (Some(p), Some(project)) => p == project,
+                    _ => true,
+                }
+        })
+    }
+}
+
 /// The file behind the scheme `name` that `xcodebuild` lists for `container`,
 /// or `None` when it has none (an autocreated scheme Xcode never wrote, or a
 /// name the container doesn't know). See [`locate_all`] for where it looks.
@@ -923,4 +1013,46 @@ mod tests {
         assert_eq!(locate(&dir, "Foreign"), None);
         assert_eq!(locate(&dir, "Mine"), Some(mine));
     }
+
+    /// A scheme building `Kit` and running `App`, both in `App.xcodeproj`.
+    const COVERING_SCHEME: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
+<Scheme version = "1.7">
+   <BuildAction>
+      <BuildActionEntries>
+         <BuildActionEntry buildForRunning = "YES">
+            <BuildableReference BuildableIdentifier = "primary" Bluepri
```

---

### Incident Patch 14: `6d6b6f74` (2026-09-27)
**Commit Message**: Find scheme files where xcodebuild -list reads them, including local packages

The CLI, the app locator, the build-settings resolver and the extension share one lookup, sweetpad_lib::scheme::locate. It covers a workspace's members and local packages' .swiftpm/xcode, and never reads another user's xcuserdata or a same-named scheme outside the container.

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +8/-0)
```diff
@@ -899,6 +899,14 @@ rules and `sweetpad-core/src/package_members.rs` the cache that keeps the
 spawns off the common path.
 
 Notes / heuristics:
+- A scheme's `.xcscheme` is found where `xcodebuild -list` reads it for the
+  container (`sweetpad_lib::scheme::locate`): the container itself, then a
+  workspace's member projects, then the `.swiftpm/xcode` of each local package
+  it or they declare. Only the current user's `xcuserdata` counts, since Xcode
+  never shows one user another's personal schemes. The app locator reads the
+  Run action through it (`sweetpad_core::app_locator::find_scheme`), and so do
+  the CLI, the build-settings resolver, the supported-platforms filter and the
+  extension (launch settings, `scheme.reveal`).
 - `test run` exits non-zero on failures; the `--json` summary lands on stdout
   and the failure error on stderr, so both are independently consumable.
 - simulator inline logs use a best-effort `processImagePath CONTAINS` log
```

**File**: `sweetpad-cli/src/cli/commands/dependency.rs` (modified, +6/-19)
```diff
@@ -1259,22 +1259,12 @@ fn multi_select(kind: &str, items: &[String], color: bool) -> Result<Vec<String>
 /// first one with build entries (or an autocreated scheme, which has none on
 /// disk but always builds) is used; falls back to the first scheme.
 fn first_scheme(container: &Container) -> Option<String> {
+    if let Container::SwiftPackage(_) = container {
+        return None;
+    }
     let names = resolve::schemes(container).ok()?;
-    // Where a scheme's `.xcscheme` may live: the container itself, plus every
-    // member project for a workspace.
-    let dirs: Vec<PathBuf> = match container {
-        Container::Project(p) => vec![p.clone()],
-        Container::Workspace(p) => {
-            let mut dirs = vec![p.clone()];
-            if let Ok(ws) = sweetpad_lib::workspace::open(p) {
-                dirs.extend(ws.project_refs);
-            }
-            dirs
-        }
-        Container::SwiftPackage(_) => return None,
-    };
     for name in &names {
-        if scheme_builds(&dirs, name) {
+        if scheme_builds(container.path(), name) {
             return Some(name.clone());
         }
     }
@@ -1284,11 +1274,8 @@ fn first_scheme(container: &Container) -> Option<String> {
 /// Whether a scheme builds something: it has no materialized file (an
 /// autocreated scheme for a buildable target) or its `BuildAction` has entries.
 /// An unparseable file is assumed buildable rather than skipped.
-fn scheme_builds(dirs: &[PathBuf], name: &str) -> bool {
-    match dirs
-        .iter()
-        .find_map(|d| sweetpad_lib::scheme::find_scheme_file(d, name))
-    {
+fn scheme_builds(container: &Path, name: &str) -> bool {
+    match sweetpad_lib::scheme::locate(container, name) {
         None => true,
         Some(file) => match sweetpad_lib::scheme::parse_file(&file) {
             Ok(scheme) => !scheme.build_entries.is_empty(),
```

**File**: `sweetpad-core/src/app_locator.rs` (modified, +49/-12)
```diff
@@ -7,7 +7,7 @@ use std::path::{Path, PathBuf};
 
 use sweetpad_lib::destination::RunDestination;
 use sweetpad_lib::project::{absolutize, canonicalize_sdk_base, standardize};
-use sweetpad_lib::{scheme, workspace};
+use sweetpad_lib::scheme;
 
 use crate::build_settings::{BuildSettingsOptions, TargetSettings, resolve_build_settings};
 use crate::xcodebuild_args;
@@ -305,19 +305,12 @@ pub fn launch_target(container: &Path, name: &str) -> Option<String> {
 
 /// The parsed scheme file behind `name`, or `None` when there is none to read:
 /// an autocreated scheme Xcode never materialized, or a name that doesn't
-/// resolve. A workspace scheme lives either in the workspace itself or in one
-/// of its member projects, so both are searched, the workspace first.
+/// resolve. The file is the one `xcodebuild -list` reads for the container
+/// ([`scheme::locate`]): the workspace's own, then its member projects', then
+/// its local packages', and only the current user's `xcuserdata`.
 #[must_use]
 pub fn find_scheme(container: &Path, name: &str) -> Option<scheme::Scheme> {
-    let mut candidates = vec![container.to_path_buf()];
-    if container.extension().is_some_and(|e| e == "xcworkspace")
-        && let Ok(ws) = workspace::open(container)
-    {
-        candidates.extend(ws.project_refs);
-    }
-    let file = candidates
-        .iter()
-        .find_map(|c| scheme::find_scheme_file(c, name))?;
+    let file = scheme::locate(container, name)?;
     scheme::parse_file(&file).ok()
 }
 
@@ -605,4 +598,48 @@ mod tests {
             simulator.app.path
         );
     }
+
+    /// The Run action is read from the file `xcodebuild -list` reads: a
+    /// workspace member package's `.swiftpm/xcode` scheme counts, a scheme in a
+    /// project the workspace doesn't list doesn't.
+    #[test]
+    fn the_launch_target_comes_from_the_file_xcodebuild_reads() {
+        let dir = crate::scratch::ScratchDir::new("sweetpad-locate-find-scheme").unwrap();
+        let ws = dir.join("App.xcworkspace");
+        std::fs::create_dir_all(&ws).unwrap();
+        std::fs::write(
+            ws.join("contents.xcworkspacedata"),
+            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Workspace version = \"1.0\">\n   \
+             <FileRef location = \"group:Pkg\"></FileRef>\n</Workspace>\n",
+        )
+        .unwrap();
+        std::fs::create_dir_all(dir.join("Pkg")).unwrap();
+        std::fs::write(dir.join("Pkg/Package.swift"), "").unwrap();
+        let scheme = |launches: &str| {
+            format!(
+                r#"<?xml version="1.0" encoding="UTF-8"?>
+<Scheme version="1.7">
+<LaunchAction><BuildableProductRunnable><BuildableReference BuildableIdentifier="primary"
+ BlueprintIdentifier="{launches}" BuildableName="{launches}" BlueprintName="{launches}"
+ ReferencedContainer="container:"></BuildableReference></BuildableProductRunnable></LaunchAction>
+</Scheme>"#
+            )
+        };
+        for (at, launches) in [
+            (
+                "Pkg/.swiftpm/xcode/xcshareddata/xcschemes/Tool.xcscheme",
+                "runner",
+            ),
+            (
+                "Stray.xcodeproj/xcshareddata/xcschemes/Stray.xcscheme",
+                "stray",
+            ),
+        ] {
+            let path = dir.join(at);
+            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
+            std::fs::write(path, scheme(launches)).unwrap();
+        }
+        assert_eq!(launch_target(&ws, "Tool").as_deref(), Some("runner"));
+        assert_eq!(launch_target(&ws, "Stray"), None);
+    }
 }
```

**File**: `sweetpad-core/src/build_settings.rs` (modified, +8/-7)
```diff
@@ -111,9 +111,10 @@ impl Selection {
 }
 
 /// Resolve the `scheme` / `target` choice once, before the per-project loop.
-/// A scheme file is looked up across every container that can hold one — the
-/// workspace bundle itself, then each member project, shared then per-user
-/// directories (mirroring where xcodebuild finds schemes). A scheme with no
+/// A scheme file is looked up where `xcodebuild` finds it
+/// ([`scheme::locate`]): the workspace bundle itself, then each member
+/// project, then each local package, shared then the current user's
+/// directories. A scheme with no
 /// file falls back to [`Selection::AutoScheme`] only when Xcode's scheme
 /// autocreation would surface it: no container holds *any* scheme file, and
 /// the shared workspace settings don't disable autocreation. Otherwise the
@@ -130,10 +131,10 @@ fn resolve_selection(
             .into_iter()
             .chain(projects.iter().map(PathBuf::as_path))
             .collect();
-        for container in &containers {
-            let Some(path) = scheme::find_scheme_file(container, name) else {
-                continue;
-            };
+        if let Some(path) = containers
+            .first()
+            .and_then(|primary| scheme::locate(primary, name))
+        {
             let parsed = scheme::parse_file(&path)
                 .map_err(|e| format!("failed to parse scheme {name} at {}: {e}", path.display()))?;
             return Ok(Selection::Scheme {
```

**File**: `sweetpad-lib/src/scheme.rs` (modified, +166/-0)
```diff
@@ -353,6 +353,87 @@ pub fn find_scheme_file(container: &Path, name: &str) -> Option<PathBuf> {
         .find(|p| p.is_file())
 }
 
+/// The file behind the scheme `name` that `xcodebuild` lists for `container`,
+/// or `None` when it has none (an autocreated scheme Xcode never wrote, or a
+/// name the container doesn't know). See [`locate_all`] for where it looks.
+#[must_use]
+pub fn locate(container: &Path, name: &str) -> Option<PathBuf> {
+    scheme_containers(container)
+        .flat_map(|c| scheme_dirs(&c))
+        .map(|dir| dir.join(format!("{name}.xcscheme")))
+        .find(|p| p.is_file())
+}
+
+/// Every file named for the scheme `name` among the scheme containers
+/// `xcodebuild -list` reads for `container`, the one it uses first. Only the
+/// current user's `xcuserdata` counts, as it does for Xcode.
+///
+/// - A `.xcworkspace` (a project's embedded one included): its own schemes,
+///   then each member project's, then each local package's `.swiftpm/xcode`,
+///   the workspace's own package members before the ones its projects declare.
+/// - A `.xcodeproj`: its own, then the `.swiftpm/xcode` of each local package
+///   it declares.
+/// - A Swift package, named by its `Package.swift` or its directory: its
+///   `.swiftpm/xcode`.
+///
+/// A package reached only through another package's `.package(path:)` is not
+/// looked in: only its manifest names it.
+#[must_use]
+pub fn locate_all(container: &Path, name: &str) -> Vec<PathBuf> {
+    scheme_containers(container)
+        .flat_map(|c| scheme_dirs(&c))
+        .map(|dir| dir.join(format!("{name}.xcscheme")))
+        .filter(|p| p.is_file())
+        .collect()
+}
+
+/// The directories holding `xcshareddata`/`xcuserdata` scheme folders for
+/// `container`, in lookup order. The container's own comes first and costs
+/// nothing to name; the members behind it are read only when a lookup gets
+/// that far.
+fn scheme_containers(container: &Path) -> impl Iterator<Item = PathBuf> {
+    let own = if container.file_name() == Some(OsStr::new("Package.swift")) {
+        crate::workspace::package_scheme_root(container.parent().unwrap_or(Path::new(".")))
+    } else if matches!(
+        container.extension().and_then(OsStr::to_str),
+        Some("xcworkspace" | "xcodeproj")
+    ) {
+        container.to_path_buf()
+    } else {
+        crate::workspace::package_scheme_root(container)
+    };
+    let container = container.to_path_buf();
+    std::iter::once(own).chain(std::iter::once_with(move || members(&container)).flatten())
+}
+
+/// The scheme containers behind `container`'s own: a workspace's member
+/// projects and local packages, a project's local packages.
+fn members(container: &Path) -> Vec<PathBuf> {
+    match container.extension().and_then(OsStr::to_str) {
+        Some("xcworkspace") => crate::workspace::open(container)
+            .map(|ws| {
+                let packages = ws
+                    .package_refs
+                    .iter()
+                    .cloned()
+                    .chain(ws.project_package_refs())
+                    .map(|dir| crate::workspace::package_scheme_root(&dir));
+                ws.project_refs.iter().cloned().chain(packages).collect()
+            })
+            .unwrap_or_default(),
+        Some("xcodeproj") => crate::project::open(container)
+            .map(|project| {
+                project
+                    .package_refs
+                    .iter()
+                    .map(|dir| crate::workspace::package_scheme_root(dir))
+                    .collect()
+            })
+            .unwrap_or_default(),
+        _ => Vec::new(),
+    }
+}
+
 /// Build a [`Scheme`] from an already-parsed `<Scheme>` element.
 pub fn from_element(root: &Element) -> Result<Scheme, Error> {
     if root.name != "Scheme" {
@@ -757,4 +838,89 @@ mod tests {
         assert_eq!(find_scheme_file(&dir, "Mine"), Some(user_only));
         assert_eq!(find_scheme_file(&dir, "Nope"), None);
     }
+
+    /// A workspace holding two projects and a local package, each with
+    /// scheme files of its own.
+    fn scratch_workspace(tag: &str) -> (TempDir, PathBuf) {
+        let root = TempDir::new(&format!("sweetpad-scheme-{tag}"));
+        let ws = root.join("App.xcworkspace");
+        std::fs::create_dir_all(&ws).unwrap();
+        std::fs::write(
+            ws.join("contents.xcworkspacedata"),
+            r#"<?xml version="1.0" encoding="UTF-8"?>
+<Workspace version = "1.0">
+   <FileRef location = "group:A.xcodeproj"></FileRef>
+   <FileRef location = "group:B.xcodeproj"></FileRef>
+   <FileRef location = "group:Pkg"></FileRef>
+</Workspace>
+"#,
+        )
+        .unwrap();
+        for dir in ["A.xcodeproj", "B.xcodeproj", "Pkg"] {
+            std::fs::create_dir_all(root.join(dir)).unwrap();
+        }
+        touch(&root.join("Pkg/Package.swift"));
+        (root, ws)
+    }
+
+    /// `xcodebuild -list -workspace` reads the workspace's schemes, then each
+    /// member's,
```

**File**: `sweetpad-vscode/native/src/lib.rs` (modified, +22/-0)
```diff
@@ -692,6 +692,28 @@ pub fn parse_scheme(path: String) -> napi::Result<SchemeInfo> {
     Ok(scheme_to_napi(scheme))
 }
 
+/// The `.xcscheme` file behind the scheme `name` of a `.xcworkspace`,
+/// `.xcodeproj` or `Package.swift`: the one `xcodebuild` reads, from the
+/// container, its member projects and its local packages, and only the
+/// current user's `xcuserdata`. `null` for a scheme with no file (autocreated)
+/// or a name the container doesn't list.
+#[napi]
+#[must_use]
+pub fn locate_scheme(container: String, name: String) -> Option<String> {
+    scheme::locate(Path::new(&container), &name).map(|p| p.display().to_string())
+}
+
+/// Every file named for the scheme `name` in the places [`locate_scheme`]
+/// looks, the one it returns first.
+#[napi]
+#[must_use]
+pub fn scheme_files(container: String, name: String) -> Vec<String> {
+    scheme::locate_all(Path::new(&container), &name)
+        .into_iter()
+        .map(|p| p.display().to_string())
+        .collect()
+}
+
 fn buildable_to_napi(b: scheme::BuildableRef) -> SchemeBuildable {
     SchemeBuildable {
         blueprint_name: b.blueprint_name,
```

**File**: `sweetpad-vscode/src/cli-server/handlers/scheme-file.spec.ts` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import { promises as fs } from "node:fs";
+import * as os from "node:os";
+import * as path from "node:path";
+
+import * as sweetpadLib from "@sweetpad/native";
+import type { Mock } from "vitest";
+
+import { activateCurrentXcodeWorkspacePath } from "../../build/utils";
+import type { RpcContext } from "./context";
+import { schemeReveal } from "./scheme-file";
+
+vi.mock("@sweetpad/native", () => ({ schemeFiles: vi.fn() }));
+vi.mock("../../build/utils", () => ({ activateCurrentXcodeWorkspacePath: vi.fn() }));
+
+const mockSchemeFiles = sweetpadLib.schemeFiles as Mock;
+const mockCurrent = activateCurrentXcodeWorkspacePath as Mock;
+const ctx = { workspaceState: {}, workspaceContext: {} } as unknown as RpcContext;
+
+describe("scheme.reveal", () => {
+  let tmp: string;
+
+  beforeEach(async () => {
+    vi.resetAllMocks();
+    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sw-scheme-file-spec-"));
+  });
+
+  afterEach(async () => {
+    await fs.rm(tmp, { recursive: true, force: true });
+  });
+
+  // The lookup is the current project's, the way `xcodebuild` reads it, so a same-named scheme in
+  // another project of the folder, or in another user's `xcuserdata`, is never the answer.
+  it("reveals the scheme file the current project reads first", async () => {
+    const shared = path.join(tmp, "App.xcodeproj", "xcshareddata", "xcschemes", "App.xcscheme");
+    await fs.mkdir(path.dirname(shared), { recursive: true });
+    await fs.writeFile(shared, "<Scheme/>");
+    mockCurrent.mockReturnValue(path.join(tmp, "App.xcworkspace"));
+    mockSchemeFiles.mockReturnValue([shared, path.join(tmp, "other.xcscheme")]);
+
+    const out = await schemeReveal({ name: "App" }, ctx);
+
+    expect(mockSchemeFiles).toHaveBeenCalledWith(path.join(tmp, "App.xcworkspace"), "App");
+    expect(out).toEqual({
+      name: "App",
+      path: shared,
+      xml: "<Scheme/>",
+      allPaths: [shared, path.join(tmp, "other.xcscheme")],
+    });
+  });
+
+  it("names the missing project when none is selected", async () => {
+    mockCurrent.mockReturnValue(undefined);
+    await expect(schemeReveal({ name: "App" }, ctx)).rejects.toThrow(/No Xcode workspace/);
+    expect(mockSchemeFiles).not.toHaveBeenCalled();
+  });
+
+  it("reports a scheme with no file", async () => {
+    mockCurrent.mockReturnValue(path.join(tmp, "App.xcodeproj"));
+    mockSchemeFiles.mockReturnValue([]);
+    await expect(schemeReveal({ name: "Auto" }, ctx)).rejects.toThrow(/No .xcscheme file found for "Auto"/);
+  });
+});
```

**File**: `sweetpad-vscode/src/cli-server/handlers/scheme-file.ts` (modified, +15/-18)
```diff
@@ -1,36 +1,33 @@
 import { promises as fs } from "node:fs";
 
-import { findFilesRecursive } from "../../common/files";
+import * as sweetpadLib from "@sweetpad/native";
+
+import { activateCurrentXcodeWorkspacePath } from "../../build/utils";
 import { methodHint } from "../method-catalog";
 import { SweetpadRpcError } from "../rpc";
 import { ERROR_CODES } from "../types";
 import { requireString } from "./_common";
 import type { HandlerFn } from "./context";
 
 const MAX_SCHEME_XML_BYTES = 1024 * 1024;
-const SKIP_DIRS = ["node_modules", ".build", "DerivedData", ".git"];
-
-async function locateSchemeFiles(workspacePath: string, name: string): Promise<string[]> {
-  const target = `${name}.xcscheme`;
-  const candidates = await findFilesRecursive({
-    directory: workspacePath,
-    depth: 8,
-    matcher: (file) => file.name === target,
-    ignore: SKIP_DIRS,
-  });
-  // Restrict to standard Xcode locations and prefer shared schemes first
-  // (matches Xcode's own resolution order).
-  const shared = candidates.filter((p) => p.includes("/xcshareddata/xcschemes/"));
-  const user = candidates.filter((p) => /\/xcuserdata\/[^/]+\.xcuserdatad\/xcschemes\//.test(p));
-  return [...shared, ...user];
-}
 
 export const schemeReveal: HandlerFn<
   { name?: string },
   { name: string; path: string; xml: string; allPaths: string[] }
 > = async (params, ctx) => {
   const name = requireString(params?.name, "scheme.reveal", "name");
-  const all = await locateSchemeFiles(ctx.workspacePath, name);
+  const xcworkspace = activateCurrentXcodeWorkspacePath({
+    workspaceState: ctx.workspaceState,
+    workspaceContext: ctx.workspaceContext,
+  });
+  if (!xcworkspace) {
+    throw new SweetpadRpcError(ERROR_CODES.NO_WORKSPACE, "No Xcode workspace detected for this folder.", {
+      hint: "open the project in VS Code so SweetPad can detect the workspace",
+    });
+  }
+  // The files `xcodebuild` reads for the current project, the one it uses first: the project's
+  // own, its member projects' and its local packages', and only this user's `xcuserdata`.
+  const all = sweetpadLib.schemeFiles(xcworkspace, name);
   if (all.length === 0) {
     throw new SweetpadRpcError(ERROR_CODES.SCHEME_FILE_NOT_FOUND, `No .xcscheme file found for "${name}".`, {
       hint: methodHint("scheme.list"),
```

---

### Incident Patch 15: `f3e26307` (2026-09-27)
**Commit Message**: List a Swift package's .swiftpm/xcode schemes the way xcodebuild -list does

Package reading is one function in core that the CLI and the VS Code addon both call. It adds the package's .swiftpm/xcode scheme files and sorts like xcodebuild, and its manifest dump never writes .build/ or temp files into the package.

**File**: `sweetpad-cli/CLI_DESIGN.md` (modified, +5/-1)
```diff
@@ -886,7 +886,11 @@ sweetpad completions <shell>          clap_complete-generated scripts
 with a ready `-destination` specifier. SPM containers are supported for
 `scheme`/`build`/`test`/`run`: schemes are read straight from the manifest via
 `swift package dump-package` (the product names xcodebuild would synthesize —
-no xcodebuild spawn, no pbxproj needed). A project or workspace container reads
+no xcodebuild spawn, no pbxproj needed), plus the scheme files in the
+package's `.swiftpm/xcode`, sorted the way `xcodebuild -list` sorts them. The
+extension reads a package through the same code
+(`sweetpad_core::package_members::standalone`, via the addon), so neither
+writes a `.build/` into the package. A project or workspace container reads
 the same manifests for the local packages around it, walking `.package(path:)`
 from every package the container references; `sweetpad-lib/DOCS.md` §9 has the
 rules and `sweetpad-core/src/package_members.rs` the cache that keeps the
```

**File**: `sweetpad-cli/src/cli/commands/project.rs` (modified, +15/-9)
```diff
@@ -528,7 +528,10 @@ fn gather(container: &Container) -> Result<Info, CliError> {
             })?;
             // `info` is an explicit enumeration, so it pays for the packages'
             // manifests rather than under-reporting what the workspace holds.
-            let members = sweetpad_core::package_members::resolve_workspace(&ws, None);
+            let members = sweetpad_core::package_members::resolve_workspace(
+                &ws,
+                &sweetpad_core::package_members::Toolchain::default(),
+            );
             Ok(Info {
                 kind: "workspace",
                 name: ws.name.clone(),
@@ -546,7 +549,10 @@ fn gather(container: &Container) -> Result<Info, CliError> {
             let proj = sweetpad_lib::project::open(p).map_err(|e| {
                 CliError::new(format!("failed to read project {}: {e}", p.display()))
             })?;
-            let members = sweetpad_core::package_members::resolve_project(&proj, None);
+            let members = sweetpad_core::package_members::resolve_project(
+                &proj,
+                &sweetpad_core::package_members::Toolchain::default(),
+            );
             Ok(Info {
                 kind: "project",
                 name: proj.name.clone(),
@@ -560,17 +566,17 @@ fn gather(container: &Container) -> Result<Info, CliError> {
         }
         Container::SwiftPackage(_) => {
             // No pbxproj to read; evaluate the manifest instead. Targets are
-            // every declared target; schemes mirror the synthesized set
-            // (products plus the package aggregate). SwiftPM builds are
-            // debug/release.
-            let manifest = crate::cli::swiftpm::manifest(container)?;
+            // every declared target; schemes are what `xcodebuild -list`
+            // prints in the package directory (its scheme files, products
+            // and the package aggregate). SwiftPM builds are debug/release.
+            let package = crate::cli::swiftpm::package_names(container)?;
             Ok(Info {
                 kind: "package",
-                name: manifest.name.clone(),
+                name: package.name,
                 path,
-                targets: manifest.targets.iter().map(|t| t.name.clone()).collect(),
+                targets: package.targets,
                 configurations: vec!["Debug".to_string(), "Release".to_string()],
-                schemes: manifest.scheme_names(),
+                schemes: package.schemes,
             })
         }
     }
```

**File**: `sweetpad-cli/src/cli/resolve.rs` (modified, +8/-2)
```diff
@@ -655,15 +655,21 @@ pub fn schemes(container: &Container) -> Result<Vec<String>, CliError> {
     match container {
         Container::Workspace(p) => sweetpad_lib::workspace::open(p)
             .map(|w| {
-                let members = sweetpad_core::package_members::resolve_workspace(&w, None);
+                let members = sweetpad_core::package_members::resolve_workspace(
+                    &w,
+                    &sweetpad_core::package_members::Toolchain::default(),
+                );
                 w.merged_schemes_with_packages(&sweetpad_core::package_members::scheme_pairs(
                     &members,
                 ))
             })
             .map_err(|e| CliError::new(format!("failed to read workspace {}: {e}", p.display()))),
         Container::Project(p) => sweetpad_lib::project::open(p)
             .map(|proj| {
-                let members = sweetpad_core::package_members::resolve_project(&proj, None);
+                let members = sweetpad_core::package_members::resolve_project(
+                    &proj,
+                    &sweetpad_core::package_members::Toolchain::default(),
+                );
                 proj.schemes_with_packages(&sweetpad_core::package_members::scheme_pairs(&members))
             })
             .map_err(|e| CliError::new(format!("failed to read project {}: {e}", p.display()))),
```

**File**: `sweetpad-cli/src/cli/swiftpm.rs` (modified, +37/-213)
```diff
@@ -18,6 +18,7 @@ use std::path::{Path, PathBuf};
 use std::process::{Command, Stdio};
 
 use serde::Deserialize;
+use sweetpad_core::package_members::{DumpError, PackageNames, Toolchain};
 use sweetpad_core::scratch::ScratchDir;
 
 use crate::cli::process;
@@ -55,58 +56,6 @@ pub struct DeclaredDep {
 }
 
 impl Manifest {
-    /// Scheme candidates for a package opened on its own, matching what
-    /// `xcodebuild -list` prints in a package directory. How many products the
-    /// package has decides the shape (measured on Xcode 26.5; the two-product
-    /// form is the same back to 15.4 in the captures):
-    ///
-    /// | products | schemes |
-    /// |---|---|
-    /// | none | `<name>-Package` alone |
-    /// | one | `<name>` alone — the package's own name, whatever the product is called |
-    /// | two or more | `<name>-Package` plus one scheme per product |
-    ///
-    /// The single-product collapse is easy to get wrong in both directions: a
-    /// package with one library product answers to neither that product's name
-    /// nor the aggregate, and one whose only product is the implicit
-    /// executable behind an `executableTarget` answers to the package name
-    /// too.
-    #[must_use]
-    pub fn scheme_names(&self) -> Vec<String> {
-        let products = self.effective_products();
-        if products.len() == 1 {
-            return vec![self.name.clone()];
-        }
-        let mut names = vec![format!("{}-Package", self.name)];
-        names.extend(products);
-        names
-    }
-
-    /// The package's products as SwiftPM sees them: the declared ones, plus
-    /// the implicit executable product it synthesizes for each
-    /// `executableTarget` no declared product already covers.
-    ///
-    /// `dump-package` reports only what the manifest wrote — `swift package
-    /// describe` is what shows the implicit ones, and it resolves the whole
-    /// dependency graph to do it. Reconstructing them here keeps the read
-    /// offline.
-    #[must_use]
-    pub fn effective_products(&self) -> Vec<String> {
-        let covered: std::collections::HashSet<&str> = self
-            .products
-            .iter()
-            .flat_map(|p| p.targets.iter().map(String::as_str))
-            .collect();
-        let mut names: Vec<String> = self.products.iter().map(|p| p.name.clone()).collect();
-        names.extend(
-            self.targets
-                .iter()
-                .filter(|t| t.is_executable() && !covered.contains(t.name.as_str()))
-                .map(|t| t.name.clone()),
-        );
-        names
-    }
-
     /// The package's declared dependencies, decoded best-effort from the raw
     /// `dependencies` array. Unknown entries are skipped (never an error).
     #[must_use]
@@ -194,51 +143,16 @@ fn requirement_string(req: &serde_json::Value) -> String {
     "(unparsed)".to_string()
 }
 
-/// A product declared by the package. In the dump, `type` is a single-key
-/// object (`{"library":[…]}`, `{"executable":null}`, `{"plugin":…}`, …); we
-/// keep it raw and inspect the key, which is robust against new product kinds.
+/// A product declared by the package.
 #[derive(Debug, Deserialize)]
 pub struct Product {
     pub name: String,
-    #[serde(rename = "type", default)]
-    pub kind: serde_json::Value,
-    /// The targets this product exposes — what says whether an
-    /// `executableTarget` already has a product, in
-    /// [`Manifest::effective_products`].
-    #[serde(default)]
-    pub targets: Vec<String>,
-}
-
-impl Product {
-    /// Whether this product is an executable (the only kind `swift run` and
-    /// `app run` can launch).
-    #[must_use]
-    pub fn is_executable(&self) -> bool {
-        self.kind.get("executable").is_some()
-    }
 }
 
-/// A target declared by the package. `type` is a plain string here: `regular`,
-/// `executable`, `test`, `system`, `binary`, `plugin`, or `macro`.
+/// A target declared by the package.
 #[derive(Debug, Deserialize)]
 pub struct Target {
     pub name: String,
-    #[serde(rename = "type", default)]
-    pub kind: String,
-}
-
-impl Target {
-    #[must_use]
-    pub fn is_test(&self) -> bool {
-        self.kind == "test"
-    }
-
-    /// Whether SwiftPM would synthesize an executable product for this target
-    /// when no declared product covers it.
-    #[must_use]
-    pub fn is_executable(&self) -> bool {
-        self.kind == "executable"
-    }
 }
 
 /// The package root — the directory holding `Package.swift`, where `swift` must
@@ -269,16 +183,32 @@ pub fn manifest(container: &Container) -> Result<Manifest, CliError> {
 /// ([`sweetpad_core::package_members::run_dump_package`]), so reading a package
 /// leaves no `.build/` in it and nothing in the user's `$TMPDIR`.
 pub fn manifest_at(package_path: &Path) -> Result<Manifest, CliError> {
-    let output =
-        sweetpad_core::package_members::run_dump_package(package_path, None, Stdio::inherit())
-            .map_err(|e| pr
```

**File**: `sweetpad-cli/tests/spm_oracle.rs` (modified, +10/-7)
```diff
@@ -6,8 +6,8 @@
 //! matches what xcodebuild actually synthesizes, and that the `swift`-driven
 //! build/test path succeeds on a real package:
 //!
-//! - **fixture mode** (default): compare our `scheme_names()` (parsed from a
-//!   captured `dump-package.json`) against the captured `xcodebuild -list`
+//! - **fixture mode** (default): compare the schemes we synthesize from a
+//!   captured `dump-package.json` against the captured `xcodebuild -list`
 //!   schemes, and check the captured `swift build`/`swift test` succeeded.
 //!   Skips cleanly when no captures exist (e.g. on a non-macOS host), so it
 //!   never fails a Linux/CI run — capture with `scripts/22_spm_cli_oracle.py`.
@@ -23,7 +23,7 @@ use std::process::Command;
 
 use common::TempDir;
 use sweetpad_cli::cli::resolve::Container;
-use sweetpad_cli::cli::swiftpm::{self, Manifest};
+use sweetpad_cli::cli::swiftpm;
 
 fn fixtures_root() -> PathBuf {
     Path::new(env!("SWEETPAD_LIB_DIR")).join("fixtures/_synthetic-spm-cli")
@@ -60,9 +60,12 @@ fn xcodebuild_list_schemes(json: &str) -> Vec<String> {
         .unwrap_or_default()
 }
 
-fn our_schemes_from_dump(dump: &str) -> Vec<String> {
-    let manifest: Manifest = serde_json::from_str(dump).expect("dump-package json deserializes");
-    manifest.scheme_names()
+/// The schemes we give the package a dump describes. The capture holds no
+/// `.swiftpm/xcode` container, so the manifest decides them alone.
+fn our_schemes_from_dump(dir: &Path, dump: &str) -> Vec<String> {
+    let manifest: serde_json::Value =
+        serde_json::from_str(dump).expect("dump-package json deserializes");
+    sweetpad_core::package_members::standalone_from_dump(dir, &manifest).schemes
 }
 
 #[test]
@@ -84,7 +87,7 @@ fn schemes_match_captured_xcodebuild_list() {
         let list = std::fs::read_to_string(dir.join("list.json")).unwrap();
         let dump = std::fs::read_to_string(dir.join("dump-package.json")).unwrap();
         let theirs: BTreeSet<String> = xcodebuild_list_schemes(&list).into_iter().collect();
-        let ours: BTreeSet<String> = our_schemes_from_dump(&dump).into_iter().collect();
+        let ours: BTreeSet<String> = our_schemes_from_dump(dir, &dump).into_iter().collect();
         if ours != theirs {
             failures.push(format!(
                 "{}: ours={ours:?} xcodebuild={theirs:?} (missing={:?}, extra={:?})",
```

**File**: `sweetpad-core/src/package_members.rs` (modified, +285/-29)
```diff
@@ -56,6 +56,20 @@
 //! **Targets include test targets** in every case, unlike schemes: a target
 //! list exists to drive `-only-testing:`, where a test target is the point.
 //!
+//! **A package opened on its own lists its own shape.** `xcodebuild -list` in
+//! a package directory prints its scheme files beside what the manifest
+//! synthesizes, all sorted case-insensitively ([`standalone`]; the shape
+//! measured on Xcode 26.5, the order on 27.0):
+//!
+//! | products | synthesized schemes |
+//! |---|---|
+//! | none | `<name>-Package` alone |
+//! | one | `<name>` alone, the package's own name whatever the product is called |
+//! | two or more | `<name>-Package` plus one scheme per product |
+//!
+//! Its test targets are never schemes of their own, whatever its container
+//! holds.
+//!
 //! **The spawn is slow enough to need a cache.** A cold `dump-package` takes
 //! seconds (SwiftPM compiles the manifest); a warm one still costs the `swift`
 //! driver's startup. Results are memoized on disk against the manifest's
@@ -64,10 +78,11 @@
 //! one-shot, so an in-process memo alone would never hit.
 
 use std::collections::{BTreeMap, HashSet};
+use std::fmt;
 use std::fs;
 use std::io::{self, Write};
 use std::path::{Path, PathBuf};
-use std::process::{Command, Output, Stdio};
+use std::process::{Command, ExitStatus, Output, Stdio};
 use std::time::UNIX_EPOCH;
 
 use serde_json::Value;
@@ -77,6 +92,54 @@ use sweetpad_lib::workspace::{Workspace, package_scheme_root};
 
 use crate::scratch::ScratchDir;
 
+/// The toolchain that evaluates a manifest. The default is the `swift` on
+/// `PATH` under the process's own `DEVELOPER_DIR`, which is what the CLI
+/// wants. The extension host sees neither the user's login shell nor its
+/// settings, so it passes both.
+#[derive(Debug, Clone, Default)]
+pub struct Toolchain {
+    /// The `swift` to run, when not the one on `PATH`.
+    pub swift: Option<PathBuf>,
+    /// The `DEVELOPER_DIR` to run it under.
+    pub developer_dir: Option<PathBuf>,
+}
+
+impl Toolchain {
+    /// The program to spawn.
+    #[must_use]
+    pub fn swift(&self) -> &Path {
+        self.swift.as_deref().unwrap_or(Path::new("swift"))
+    }
+}
+
+/// Why a manifest could not be read.
+#[derive(Debug)]
+pub enum DumpError {
+    /// `swift` could not be spawned, or its scratch directory made.
+    Spawn(io::Error),
+    /// The dump ran and failed, most often a manifest that doesn't compile.
+    Failed(ExitStatus),
+    /// It printed no JSON object.
+    NoJson,
+    /// It printed JSON that doesn't parse.
+    Parse(serde_json::Error),
+}
+
+impl fmt::Display for DumpError {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        match self {
+            DumpError::Spawn(e) => write!(f, "running swift package dump-package: {e}"),
+            DumpError::Failed(status) => {
+                write!(f, "swift package dump-package exited with {status}")
+            }
+            DumpError::NoJson => f.write_str("swift package dump-package produced no JSON"),
+            DumpError::Parse(e) => write!(f, "parsing swift package dump-package: {e}"),
+        }
+    }
+}
+
+impl std::error::Error for DumpError {}
+
 /// How a package was reached. A workspace member's test targets are schemes
 /// whether or not it has been opened in Xcode; every other package's are only
 /// once it has (see the module docs).
@@ -114,11 +177,14 @@ type Stamp = (u64, u128);
 /// manifest, and only this catches an unedited one whose names this code
 /// derives differently — `products`, for one, counts implicit executables that
 /// a plain read of `dump-package` does not.
-const CACHE_SCHEMA: u64 = 1;
+const CACHE_SCHEMA: u64 = 2;
 
 /// What one manifest says, before a role turns it into schemes.
 #[derive(Debug, Clone)]
 struct ManifestNames {
+    /// The package's own name, which names its schemes when it is opened on
+    /// its own.
+    name: String,
     products: Vec<String>,
     test_targets: Vec<String>,
     targets: Vec<String>,
@@ -219,6 +285,7 @@ fn cached_manifest(
         return None;
     }
     Some(ManifestNames {
+        name: entry.get("name")?.as_str()?.to_string(),
         products: string_list(entry, "products")?,
         test_targets: string_list(entry, "testTargets")?,
         targets: string_list(entry, "targets")?,
@@ -237,6 +304,7 @@ fn cache_entry(current: Stamp, names: &ManifestNames) -> Value {
         // u128 exceeds JSON's safe integer range; keep it as a string so a
         // round-trip can't quietly lose precision.
         "mtime": mtime.to_string(),
+        "name": names.name,
         "products": names.products,
         "testTargets": names.test_targets,
         "targets": names.targets,
@@ -303,10 +371,7 @@ fn has_a_scheme_that_resolves(dir: &Path, files: &[String], names: &ManifestName
 /// manifest fails to evaluate contributes nothing and is not cached, so the
 /// next call retries — a broken manifest is usually mid-edit.
 #[mu
```

**File**: `sweetpad-core/tests/spm_graph_oracle.rs` (modified, +2/-2)
```diff
@@ -124,7 +124,7 @@ fn a_workspace_lists_every_local_package_it_reaches() {
     assert_eq!(ws.package_refs, vec![fixture().join("MultiLib")]);
     assert_eq!(ws.project_package_refs(), project_packages());
 
-    let members = package_members::resolve_workspace(&ws, None);
+    let members = package_members::resolve_workspace(&ws, &package_members::Toolchain::default());
     assert_eq!(
         ws.merged_schemes_with_packages(&package_members::scheme_pairs(&members)),
         WORKSPACE_SCHEMES
@@ -161,7 +161,7 @@ fn a_bare_project_lists_the_packages_it_declares() {
     let proj = project::open(&fixture().join("project/SpmApp.xcodeproj")).unwrap();
     assert_eq!(proj.package_refs, project_packages());
 
-    let members = package_members::resolve_project(&proj, None);
+    let members = package_members::resolve_project(&proj, &package_members::Toolchain::default());
     assert_eq!(
         proj.schemes_with_packages(&package_members::scheme_pairs(&members)),
         PROJECT_SCHEMES
```

**File**: `sweetpad-vscode/native/src/lib.rs` (modified, +65/-16)
```diff
@@ -127,6 +127,27 @@ fn is_workspace(path: &Path) -> bool {
     path.extension().and_then(|e| e.to_str()) == Some("xcworkspace")
 }
 
+/// Which toolchain evaluates the manifests a names read needs. The extension
+/// host sees neither the login shell's `DEVELOPER_DIR` nor
+/// `sweetpad.build.swiftCommand`, so the extension passes both.
+#[napi(object)]
+pub struct ManifestToolchain {
+    /// The `swift` to run, when not the one on `PATH`.
+    pub swift: Option<String>,
+    /// The `DEVELOPER_DIR` to run it under.
+    pub developer_dir: Option<String>,
+}
+
+fn toolchain_of(options: Option<ManifestToolchain>) -> sweetpad_core::package_members::Toolchain {
+    let non_empty = |value: Option<String>| value.filter(|v| !v.is_empty()).map(PathBuf::from);
+    options.map_or_else(Default::default, |options| {
+        sweetpad_core::package_members::Toolchain {
+            swift: non_empty(options.swift),
+            developer_dir: non_empty(options.developer_dir),
+        }
+    })
+}
+
 /// Which names to read. Both include what the container's local SwiftPM
 /// packages declare, and naming those means running `swift package
 /// dump-package`, which takes seconds on a cold manifest cache — so the calls
@@ -138,12 +159,28 @@ enum Names {
 }
 
 /// Read `path`'s names, evaluating the manifests of every local package the
-/// container reaches. Runs off the main thread (see [`NamesTask`]).
-fn read_names(path: &str, which: &Names) -> napi::Result<Vec<String>> {
+/// container reaches. A `Package.swift` reads the package opened on its own:
+/// what `xcodebuild -list` prints in its directory. Runs off the main thread
+/// (see [`NamesTask`]).
+fn read_names(
+    path: &str,
+    which: &Names,
+    toolchain: &sweetpad_core::package_members::Toolchain,
+) -> napi::Result<Vec<String>> {
     let p = Path::new(path);
+    if p.file_name().and_then(|n| n.to_str()) == Some("Package.swift") {
+        let dir = p.parent().unwrap_or(Path::new("."));
+        let package =
+            sweetpad_core::package_members::standalone(dir, toolchain, std::process::Stdio::null())
+                .map_err(to_napi_err)?;
+        return Ok(match which {
+            Names::Schemes => package.schemes,
+            Names::Targets => package.targets,
+        });
+    }
     if !is_workspace(p) {
         let project = project::open(p).map_err(to_napi_err)?;
-        let members = sweetpad_core::package_members::resolve_project(&project, None);
+        let members = sweetpad_core::package_members::resolve_project(&project, toolchain);
         return Ok(match which {
             Names::Schemes => project
                 .schemes_with_packages(&sweetpad_core::package_members::scheme_pairs(&members)),
@@ -152,7 +189,7 @@ fn read_names(path: &str, which: &Names) -> napi::Result<Vec<String>> {
         });
     }
     let ws = workspace::open(p).map_err(to_napi_err)?;
-    let members = sweetpad_core::package_members::resolve_workspace(&ws, None);
+    let members = sweetpad_core::package_members::resolve_workspace(&ws, toolchain);
     Ok(match which {
         Names::Schemes => {
             ws.merged_schemes_with_packages(&sweetpad_core::package_members::scheme_pairs(&members))
@@ -166,45 +203,57 @@ fn read_names(path: &str, which: &Names) -> napi::Result<Vec<String>> {
 pub struct NamesTask {
     path: String,
     which: Names,
+    toolchain: sweetpad_core::package_members::Toolchain,
 }
 
 impl napi::Task for NamesTask {
     type Output = Vec<String>;
     type JsValue = Vec<String>;
 
     fn compute(&mut self) -> napi::Result<Self::Output> {
-        read_names(&self.path, &self.which)
+        read_names(&self.path, &self.which, &self.toolchain)
     }
 
     fn resolve(&mut self, _env: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
         Ok(output)
     }
 }
 
-/// Scheme names for a `.xcodeproj` or `.xcworkspace` — shared and per-user
-/// scheme files, plus autocreated per-target schemes, plus the products of
-/// every local SwiftPM package the container reaches. For a workspace, merged
-/// across the bundle and every member project, sorted like
-/// `xcodebuild -list -workspace`.
+/// Scheme names for a `.xcodeproj`, `.xcworkspace` or `Package.swift` —
+/// shared and per-user scheme files, plus autocreated per-target schemes, plus
+/// the products of every local SwiftPM package the container reaches. For a
+/// workspace, merged across the bundle and every member project, sorted like
+/// `xcodebuild -list -workspace`. For a package, its `.swiftpm/xcode` scheme
+/// files and the schemes its manifest synthesizes, sorted like `xcodebuild
+/// -list` in its directory. `toolchain` evaluates the manifests.
 #[napi(ts_return_type = "Promise<Array<string>>")]
 #[must_use]
-pub fn schemes(path: String) -> napi::bindgen_prelude::AsyncTask<NamesTask> {
+pub fn schemes(
+    path: String,
+    toolchain: Option<ManifestToolchain>,
+) -> napi::bindgen_prelude::AsyncTask<NamesTask> {
     na
```

#### Recent Merged Pull Requests:
- **PR #338** (2026-09-19): Launch the simulator app Xcode 27 renamed to DeviceHub (#337) (@hyzyla)
- **PR #334** (2026-08-26): List schemes from every local Swift package a container reaches (#327) (@hyzyla)
- **PR #333** (2026-08-25): Show each generic destination with its platform's own icon (@hyzyla)
- **PR #332** (2026-08-26): Match Xcode's DerivedData folder name when the project name has a space (@hyzyla)
- **PR #331** (2026-08-25): Rewrite the 0.2.x changelog entries as titles (@hyzyla)
- **PR #330** (2026-08-25): Pass Xcode's header maps to sourcekit-lsp and prepare every target (@hyzyla)
- **PR #328** (2026-08-25): feat(destination): add generic build-only destinations ("Any … Device") (@NSExceptional)
- **PR #325** (2026-08-16): Support xcodebuild passthrough args on app install, debug, and diagnose (@hyzyla)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
