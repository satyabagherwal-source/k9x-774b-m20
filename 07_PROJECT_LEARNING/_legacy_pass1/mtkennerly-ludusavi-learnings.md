# Forensic Learning Record (Deep Inspection): mtkennerly/ludusavi

> **Canonical Artifact**: `07_PROJECT_LEARNING/mtkennerly-ludusavi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mtkennerly/ludusavi](https://github.com/mtkennerly/ludusavi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:46:01.615Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mtkennerly/ludusavi`
- **Description**: Backup tool for PC game saves
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6327 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/api.rs`
```
use ludusavi::api::*;

fn main() {
    let mut ludusavi = Ludusavi::load().unwrap();

    let games = vec![std::env::args().skip(1).next().unwrap_or_else(|| "Celeste".to_string())];

    let backups = ludusavi
        .list_backups(parameters::ListBackups { games: games.clone() })
        .unwrap();
    dbg!(backups);

    let output = ludusavi
        .back_up(parameters::BackUp {
            games,
            finality: Finality::Preview,
            ..Default::default()
        })
        .unwrap();
    dbg!(output);
}

```

### Core Architecture Module: `scripts/generate-macos-icon.py`
```
#!/usr/bin/env python3
"""Generate a padded macOS ICNS file from Ludusavi's SVG icon."""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


CANVAS_SIZE = 1024
ART_SIZE = 820
ICON_SIZES = [(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="source SVG file")
    parser.add_argument("output", type=Path, help="output ICNS file")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if shutil.which("rsvg-convert") is None:
        sys.exit("rsvg-convert is required; install librsvg before generating the macOS icon")

    try:
        from PIL import Image
    except ImportError:
        sys.exit("Pillow is required; install it with: python3 -m pip install pillow")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp_dir:
        raster = Path(temp_dir) / "icon.png"
        subprocess.run(
            [
                "rsvg-convert",
                "--width",
                str(CANVAS_SIZE),
                "--height",
                str(CANVAS_SIZE),
                str(args.input),
                "--output",
                str(raster),
            ],
            check=True,
        )

        art = Image.open(raster).convert("RGBA")
        art.thumbnail((ART_SIZE, ART_SIZE), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(art, ((CANVAS_SIZE - art.width) // 2, (CANVAS_SIZE - art.height) // 2))
        canvas.save(args.output, format="ICNS", sizes=ICON_SIZES)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `src/api.rs`
```
use std::collections::{BTreeMap, BTreeSet};

use rayon::iter::{IndexedParallelIterator, IntoParallelRefIterator, ParallelIterator};

use crate::{
    cloud::{CloudChange, Rclone},
    prelude::{Error, app_dir},
    report,
    scan::{
        BackupId, DuplicateDetector, Launchers, OperationStepDecision, ScanKind, SteamShortcuts, TitleFinder,
        TitleMatch, layout::BackupLayout, prepare_backup_target, scan_game_for_backup, semantic,
    },
};

pub use crate::{
    path::StrictPath,
    prelude::{Finality, SyncDirection},
    report::ApiOutput,
    resource::{config::Config, manifest::Manifest},
    scan::TitleQuery,
};

/// Unlike the CLI, this always uses the config's backup path, never the restore path.
pub struct Ludusavi {
    pub config: Config,
    pub manifest: Manifest,
    layout: BackupLayout,
    title_finder: TitleFinder,
    steam_shortcuts: SteamShortcuts,
}

impl Ludusavi {
    pub fn new(config: Config, manifest: Manifest) -> Self {
        let (layout, title_finder, steam_shortcuts) = Self::make_state(&config, &manifest);

        Self {
            config,
            manifest,
            layout,
            title_finder,
            steam_shortcuts,
        }
    }

    pub fn load() -> Result<Self, Error> {
        let config = Config::load()?;
        let manifest = Manifest::load()?;

        Ok(Self::new(config, manifest))
    }

    fn make_state(config: &Config, manifest: &Manifest) -> (BackupLayout, TitleFinder, SteamShortcuts) {
        let layout = BackupLayout::new(config.backup.path.clone());

        let title_finder = TitleFinder::new(config, manifest, layout.restorable_game_set());

        let steam_shortcuts = SteamShortcuts::scan(&title_finder);

        (layout, title_finder, steam_shortcuts)
    }

    /// Update internal state after a change to config, manifest, or backups.
    pub fn refresh(&mut self) {
        let (layout, title_finder, steam_shortcuts) = Self::make_state(&self.config, &self.manifest);

        self.layout = layout;
        self.title_finder = title_finder;
        self.steam_shortcuts = steam_shortcuts;
    }

    fn target(&self) -> &StrictPath {
        &self.config.backup.path
    }

    fn sync_cloud(&self, sync: SyncDirection, finality: Finality, games: &[String]) -> Result<Vec<CloudChange>, Error> {
        match finality {
            Finality::Preview => log::info!("checking cloud sync"),
            Finality::Final => log::info!("performing cloud sync"),
        }

        let remote = crate::cloud::validate_cloud_config(&self.config, &self.config.cloud.path)?;

        let games = if !games.is_empty() {
            games.iter().filter_map(|x| self.layout.game_folder(x).leaf()).collect()
        } else {
            vec![]
        };

        let rclone = Rclone::new(self.config.apps.rclone.clone(), remote);
        let mut process = match rclone.sync(self.target(), &self.config.cloud.path, sync, finality, &games) {
            Ok(p) => p,
            Err(e) => return Err(Error::UnableToSynchronizeCloud(e)),
        };

        let mut changes = vec![];
        loop {
            let events = process.events();
            for event in events {
                match event {
                    crate::cloud::RcloneProcessEvent::Progress { .. } => {}
                    crate::cloud::RcloneProcessEvent::Change(change) => {
                        changes.push(change);
                    }
                }
            }
            match process.succeeded() {
                Some(Ok(_)) => {
                    return Ok(changes);
                }
                Some(Err(e)) => {
                    return Err(Error::UnableToSynchronizeCloud(e));
                }
                None => (),
            }
        }
    }

    /// Back up games.
    pub fn back_up(
        &mut self,
        parameters::BackUp {
            games,
            finality,
            resolve_cloud_conflict,
            wine_prefix,
            include_disabled,
            skip_downgrade,
        }: parameters::BackUp,
    ) -> Result<ApiOutput, Error> {
        let mut reporter = report::Reporter::json();

        let roots = self.config.expanded_roots();
        let backup_dir = self.target().clone();

        if !finality.preview() {
            prepare_backup_target(&backup_dir)?;
        }

        let retention = self.config.backup.retention;

        let games_specified = !games.is_empty();
        let games = evaluate_games(self.manifest.primary_titles(), games, &self.title_finder)?;

        let mut duplicate_detector = DuplicateDetector::default();
        let launchers = Launchers::scan(&roots, &self.manifest, &games, &self.title_finder, None);

        let cloud_sync = self.config.cloud.synchronize
            && !finality.preview()
            && crate::cloud::validate_cloud_config(&self.config, &self.config.cloud.path).is_ok();
        let mut should_sync_cloud_after = cloud_sync && !finality.preview();
        let mut should_sync_cloud_after_even_if_unchanged = false;
        if cloud_sync {
            let changes = self.sync_cloud(
                SyncDirection::Upload,
                Finality::Preview,
                if games_specified { &games } else { &[] },
            );
            match changes {
                Ok(changes) => {
                    if !changes.is_empty() {
                        match resolve_cloud_conflict {
                            Some(direction @ SyncDirection::Download) => {
                                // We need to download before the new backup
                                // to keep mapping.yaml in a coherent state.
                                if let Err(e) = self.sync_cloud(
                                    direction,
                                    Finality::Final,
                                    if games_specified { &games } else { &[] },
                                ) {
                                    log::error!(
                                        "Failed to resolve save conflict pre-backup with direction {direction:?}: {e:?}"
                                    );
                                    should_sync_cloud_after = false;
                                    reporter.trip_cloud_sync_failed();
                                }
                            }
                            Some(SyncDirection::Upload) => {
                                // We'll make the new backup first and then sync after.
                                should_sync_cloud_after_even_if_unchanged = true;
                            }
                            None => {
                                should_sync_cloud_after = false;
                                reporter.trip_cloud_conflict();
                            }
                        }
                    }
                }
                Err(_) => {
                    should_sync_cloud_after = false;
                    reporter.trip_cloud_sync_failed();
                }
            }
        }

        let step = |i, name| {
            log::trace!("step {i} / {}: {name}", games.len());
            let game = &self.manifest.0[name];

            let wine_ctx = semantic::Wine::for_game(name, &self.config);
            let previous = self.layout.latest_backup(
                name,
                ScanKind::Backup,
                &self.config.redirects,
                self.config.restore.reverse_redirects,
                &self.config.restore.toggled_paths,
                self.config.backup.only_constructive,
                wine_ctx.as_ref(),
            );

            if self
                .config
                .backup
                .filter
                .excludes(games_specified, previous.is_some(), &game.cloud)
            {
                log::trace!("[{name}] excluded by backup filter");
                return None;
            }

            let scan_info = scan_game_for_backup(
                game,
                name,
   
```

### Core Architecture Module: `src/cli.rs`
```
mod api;
pub mod parse;
mod ui;

use std::{collections::BTreeSet, process::Command, time::Duration};

use clap::CommandFactory;
use indicatif::{ParallelProgressIterator, ProgressBar};
use rayon::{
    iter::{IntoParallelRefIterator, ParallelIterator},
    prelude::IndexedParallelIterator,
};

use crate::{
    cli::parse::{Cli, CompletionShell, ConfigSubcommand, ManifestSubcommand, Subcommand},
    cloud::{CloudChange, Rclone, Remote},
    lang::{Language, TRANSLATOR},
    prelude::{
        Error, Finality, StrictPath, SyncDirection, app_dir, get_threads_from_env, initialize_rayon, register_sigint,
        unregister_sigint,
    },
    report::{self, Reporter, report_cloud_changes},
    resource::{ResourceFile, SaveableResourceFile, cache::Cache, config::Config, manifest::Manifest},
    scan::{
        BackupId, DuplicateDetector, Launchers, OperationStepDecision, ScanKind, SteamShortcuts, TitleFinder,
        TitleQuery, layout::BackupLayout, prepare_backup_target, scan_game_for_backup, semantic,
    },
    wrap,
};

const PROGRESS_BAR_REFRESH_INTERVAL: Duration = Duration::from_millis(50);

pub fn show_error(games: &[String], error: &Error, gui: bool, force: bool) {
    let message = TRANSLATOR.handle_error(error);

    if gui {
        let _ = ui::alert(games, gui, force, &message);
    } else {
        eprintln!("{message}");
    }
}

fn negatable_flag(on: bool, off: bool, default: bool) -> bool {
    if on {
        true
    } else if off {
        false
    } else {
        default
    }
}

fn load_manifest(
    config: &Config,
    cache: &mut Cache,
    no_manifest_update: bool,
    try_manifest_update: bool,
) -> Result<Manifest, Error> {
    if no_manifest_update {
        Ok(Manifest::load().unwrap_or_default().with_extensions(config))
    } else if try_manifest_update {
        if let Err(e) = Manifest::update_mut(config, cache, false) {
            eprintln!("{}", TRANSLATOR.handle_error(&e));
        }
        Ok(Manifest::load().unwrap_or_default().with_extensions(config))
    } else {
        Manifest::update_mut(config, cache, false)?;
        Manifest::load().map(|x| x.with_extensions(config))
    }
}

fn parse_game(game: Option<String>) -> Option<String> {
    match game {
        Some(game) => Some(game),
        None => {
            use std::io::IsTerminal;

            let stdin = std::io::stdin();
            if stdin.is_terminal() {
                None
            } else {
                let game = stdin.lines().next().and_then(Result::ok);
                log::debug!("Game from stdin: {:?}", &game);
                game
            }
        }
    }
}

fn parse_games(games: Vec<String>) -> Vec<String> {
    if !games.is_empty() {
        games
    } else {
        use std::io::IsTerminal;

        let stdin = std::io::stdin();
        if stdin.is_terminal() {
            vec![]
        } else {
            let games = stdin.lines().map_while(Result::ok).collect();
            log::debug!("Games from stdin: {:?}", &games);
            games
        }
    }
}

pub fn evaluate_games(
    default: BTreeSet<String>,
    requested: Vec<String>,
    title_finder: &TitleFinder,
) -> Result<Vec<String>, Vec<String>> {
    if requested.is_empty() {
        return Ok(default.into_iter().collect());
    }

    let mut valid = BTreeSet::new();
    let mut invalid = BTreeSet::new();

    for game in requested {
        match title_finder.find_one_by_name(&game) {
            Some(found) => {
                valid.insert(found);
            }
            None => {
                invalid.insert(game);
            }
        }
    }

    if !invalid.is_empty() {
        return Err(invalid.into_iter().collect());
    }

    Ok(valid.into_iter().collect())
}

pub fn parse() -> Result<Cli, clap::Error> {
    use clap::Parser;
    Cli::try_parse()
}

pub fn run(sub: Subcommand, no_manifest_update: bool, try_manifest_update: bool) -> Result<(), Error> {
    let mut config = Config::load()?;
    if let Some(threads) = get_threads_from_env().or(config.runtime.threads) {
        initialize_rayon(threads);
    }
    let mut cache = Cache::load().unwrap_or_default().migrate_config(&mut config);
    TRANSLATOR.set_language(config.language);
    let mut failed = false;
    let mut duplicate_detector = DuplicateDetector::default();

    log::debug!("Config on startup: {config:?}");

    match sub {
        Subcommand::Backup {
            preview,
            path,
            force,
            no_force_cloud_conflict,
            wine_prefix,
            api,
            gui,
            sort,
            format,
            compression,
            compression_level,
            full_limit,
            differential_limit,
            cloud_sync,
            no_cloud_sync,
            dump_registry,
            include_disabled,
            ask_downgrade,
            games,
        } => {
            let games = parse_games(games);

            let mut reporter = if api { Reporter::json() } else { Reporter::standard() };

            let manifest = load_manifest(&config, &mut cache, no_manifest_update, try_manifest_update)?;

            let backup_dir = match path {
                None => config.backup.path.clone(),
                Some(p) => p,
            };
            let roots = config.expanded_roots();

            if !ui::confirm(
                &games,
                gui,
                force,
                preview,
                &TRANSLATOR.confirm_backup(&backup_dir, backup_dir.exists(), false),
            )? {
                return Ok(());
            }

            if !preview {
                prepare_backup_target(&backup_dir)?;
            }

            let retention = config.backup.retention.with_limits(full_limit, differential_limit);

            let layout = BackupLayout::new(backup_dir.clone());
            let title_finder = TitleFinder::new(&config, &manifest, layout.restorable_game_set());

            let games_specified = !games.is_empty();
            let games = match evaluate_games(manifest.primary_titles(), games, &title_finder) {
                Ok(games) => games,
                Err(games) => {
                    reporter.trip_unknown_games(games.clone());
                    reporter.print_failure();
                    return Err(Error::CliUnrecognizedGames { games });
                }
            };

            let launchers = Launchers::scan(&roots, &manifest, &games, &title_finder, None);
            let filter = config.backup.filter.clone();
            let toggled_paths = config.backup.toggled_paths.clone();
            let toggled_registry = config.backup.toggled_registry.clone();
            let steam_shortcuts = SteamShortcuts::scan(&title_finder);

            let cloud_sync = negatable_flag(
                cloud_sync && !preview,
                no_cloud_sync,
                config.cloud.synchronize
                    && !preview
                    && crate::cloud::validate_cloud_config(&config, &config.cloud.path).is_ok(),
            );
            let mut should_sync_cloud_after = cloud_sync && !preview;
            let mut should_sync_cloud_after_even_if_unchanged = false;
            if cloud_sync {
                let changes = sync_cloud(
                    &config,
                    &backup_dir,
                    &config.cloud.path,
                    SyncDirection::Upload,
                    Finality::Preview,
                    if games_specified { &games } else { &[] },
                );
                match changes {
                    Ok(changes) => {
                        if !changes.is_empty() {
                            match ui::ask_cloud_conflict(&games, gui, force && !no_force_cloud_conflict, preview)? {
                                Some(direction @ SyncDirection::Download) => {
                                    // We need to download before the new backup
                                    // to keep mapping.yaml in a coherent state.
            
```

### Core Architecture Module: `src/cli/api.rs`
```
use std::io::Read;

use itertools::Itertools;

use crate::{
    lang::TRANSLATOR,
    path::StrictPath,
    prelude::Error,
    resource::{config::Config, manifest::Manifest},
    scan::{BackupId, TitleFinder, TitleQuery, compare_ranked_titles, layout::BackupLayout},
};

/// The full input to the `api` command.
#[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Input {
    /// Override configuration.
    #[serde(default)]
    pub config: ConfigOverride,
    /// The order of the requests here will match the order of responses in the output.
    pub requests: Vec<Request>,
}

/// Overridden configuration.
#[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConfigOverride {
    /// Directory where Ludusavi stores backups.
    pub backup_path: Option<StrictPath>,
}

/// The full output of the `api` command.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
#[serde(untagged, rename_all = "camelCase")]
pub enum Output {
    Success {
        /// Responses to each request, in the same order as the request input.
        responses: Vec<Response>,
    },
    Failure {
        /// A top-level error not tied to any particular request.
        error: response::Error,
    },
}

/// An individual request.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum Request {
    FindTitle(request::FindTitle),
    CheckAppUpdate(request::CheckAppUpdate),
    EditBackup(request::EditBackup),
}

/// A response to an individual request.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum Response {
    Error(response::Error),
    FindTitle(response::FindTitle),
    CheckAppUpdate(response::CheckAppUpdate),
    EditBackup(response::EditBackup),
}

pub mod request {
    /// Find game titles
    ///
    /// Precedence: Steam ID -> GOG ID -> Lutris ID -> exact names -> normalized names.
    /// Once a match is found for one of these options,
    /// Ludusavi will stop looking and return that match,
    /// unless you set `multiple: true`, in which case,
    /// the results will be sorted by how well they match.
    ///
    /// Depending on the options chosen, there may be multiple matches, but the default is a single match.
    ///
    /// Aliases will be resolved to the target title.
    #[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct FindTitle {
        /// Keep looking for all potential matches,
        /// instead of stopping at the first match.
        pub multiple: bool,
        /// Ensure the game is recognized in a backup context.
        pub backup: bool,
        /// Ensure the game is recognized in a restore context.
        pub restore: bool,
        /// Look up game by a Steam ID.
        pub steam_id: Option<u32>,
        /// Look up game by a GOG ID.
        pub gog_id: Option<u64>,
        /// Look up game by a Lutris slug.
        pub lutris_id: Option<String>,
        /// Look up game by an approximation of the title.
        /// Ignores capitalization, "edition" suffixes, year suffixes, and some special symbols.
        /// This may find multiple games for a single input.
        pub normalized: bool,
        /// Look up games with fuzzy matching.
        /// This may find multiple games for a single input.
        pub fuzzy: bool,
        /// Select games that are disabled.
        pub disabled: bool,
        /// Select games that have some saves disabled.
        pub partial: bool,
        /// Look up game by an exact title.
        /// With multiple values, they will be checked in the order given.
        pub names: Vec<String>,
    }

    /// Check whether an application update is available.
    #[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct CheckAppUpdate {}

    /// Edit a backup's metadata.
    #[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct EditBackup {
        /// Which game to edit.
        pub game: String,
        /// Edit a specific backup, using an ID returned by the `backups` command.
        /// When not specified, this defaults to the latest backup.
        pub backup: Option<String>,
        /// If set, indicates whether the backup should be locked.
        pub locked: Option<bool>,
        /// If set, update the backup's comment.
        /// To delete an existing comment, set this to an empty string.
        pub comment: Option<String>,
    }
}

pub mod response {
    #[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct Error {
        /// Human-readable error message.
        pub message: String,
    }

    #[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct FindTitle {
        /// Any matching titles found.
        pub titles: Vec<String>,
    }

    #[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct CheckAppUpdate {
        /// An available update.
        pub update: Option<AppUpdate>,
    }

    #[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct AppUpdate {
        /// New version number.
        pub version: String,
        /// Release URL to open in browser.
        pub url: String,
    }

    #[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, schemars::JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct EditBackup {}
}

fn parse_input(input: Option<String>) -> Result<Input, String> {
    if let Some(input) = input {
        let input = serde_json::from_str::<Input>(&input).map_err(|e| e.to_string())?;
        Ok(input)
    } else {
        use std::io::IsTerminal;

        let mut stdin = std::io::stdin();
        if stdin.is_terminal() {
            Ok(Input::default())
        } else {
            let mut bytes = vec![];
            let _ = stdin.read_to_end(&mut bytes);
            let raw = String::from_utf8_lossy(&bytes);
            let input = serde_json::from_str::<Input>(&raw).map_err(|e| e.to_string())?;
            Ok(input)
        }
    }
}

pub fn abort_error(error: Error) -> ! {
    let output = Output::Failure {
        error: response::Error {
            message: TRANSLATOR.handle_error(&error),
        },
    };
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
    std::process::exit(1);
}

pub fn abort_message(message: String) -> ! {
    let output = Output::Failure {
        error: response::Error { message },
    };
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
    std::process::exit(1);
}

pub fn process(input: Option<String>, config: &Config, manifest: &Manifest) -> Result<Output, String> {
    let input = parse_input(input)?;
    log::debug!("API input: {input:?}");
    let mut responses = vec![];

    let backup_path = input.config.backup_path.unwrap_or_else(|| config.restore.path.clone());
    let layout = BackupLayout::new(backup_path);

    let title_finder = TitleFinder::new(config, manifest, layout.restorable_game_set());

    for request in input.re
```

### Core Architecture Module: `src/cli/parse.rs`
```
use std::path::PathBuf;

use crate::{
    cloud::WebDavProvider,
    prelude::StrictPath,
    resource::config::{BackupFormat, Sort, SortKey, ZipCompression},
};

use clap::{ArgGroup, Args, ValueEnum};

macro_rules! possible_values {
    ($t: ty, $options: ident) => {{
        use clap::builder::{PossibleValuesParser, TypedValueParser};
        PossibleValuesParser::new(<$t>::$options).map(|s| s.parse::<$t>().unwrap())
    }};
}

fn parse_strict_path(path: &str) -> Result<StrictPath, std::io::Error> {
    let cwd = StrictPath::cwd();
    Ok(StrictPath::relative(path.to_owned(), Some(cwd.raw())))
}

fn parse_existing_strict_path(path: &str) -> Result<StrictPath, std::io::Error> {
    let cwd = StrictPath::cwd();
    let sp = StrictPath::relative(path.to_owned(), Some(cwd.raw()));
    sp.metadata()?;
    Ok(sp)
}

fn styles() -> clap::builder::styling::Styles {
    use clap::builder::styling::{AnsiColor, Effects, Styles};

    Styles::styled()
        .header(AnsiColor::Yellow.on_default() | Effects::BOLD)
        .usage(AnsiColor::Yellow.on_default() | Effects::BOLD)
        .literal(AnsiColor::Green.on_default() | Effects::BOLD)
        .placeholder(AnsiColor::Green.on_default())
}

#[derive(clap::Subcommand, Clone, Debug, PartialEq, Eq)]
pub enum CompletionShell {
    #[clap(about = "Completions for Bash")]
    Bash,
    #[clap(about = "Completions for Fish")]
    Fish,
    #[clap(about = "Completions for Zsh")]
    Zsh,
    #[clap(name = "powershell", about = "Completions for PowerShell")]
    PowerShell,
    #[clap(about = "Completions for Elvish")]
    Elvish,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum CliSort {
    #[default]
    Name,
    NameReversed,
    Size,
    SizeReversed,
    Status,
    StatusReversed,
}

impl CliSort {
    pub const ALL: &'static [&'static str] = &["name", "name-rev", "size", "size-rev", "status", "status-rev"];
}

impl std::str::FromStr for CliSort {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "name" => Ok(Self::Name),
            "name-rev" => Ok(Self::NameReversed),
            "size" => Ok(Self::Size),
            "size-rev" => Ok(Self::SizeReversed),
            "status" => Ok(Self::Status),
            "status-rev" => Ok(Self::StatusReversed),
            _ => Err(format!("invalid sort key: {s}")),
        }
    }
}

impl From<CliSort> for Sort {
    fn from(source: CliSort) -> Self {
        match source {
            CliSort::Name => Self {
                key: SortKey::Name,
                reversed: false,
            },
            CliSort::NameReversed => Self {
                key: SortKey::Name,
                reversed: true,
            },
            CliSort::Size => Self {
                key: SortKey::Size,
                reversed: false,
            },
            CliSort::SizeReversed => Self {
                key: SortKey::Size,
                reversed: true,
            },
            CliSort::Status => Self {
                key: SortKey::Status,
                reversed: false,
            },
            CliSort::StatusReversed => Self {
                key: SortKey::Status,
                reversed: true,
            },
        }
    }
}

/// Supported launchers for wrap --infer command
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum)]
pub enum Launcher {
    Heroic,
    Lutris,
    Steam,
}

/// Serialization format
#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum)]
pub enum SerializationFormat {
    #[default]
    Json,
    Yaml,
}

#[derive(clap::Subcommand, Clone, Debug, PartialEq, Eq)]
pub enum Subcommand {
    /// Back up data
    ///
    /// This command automatically updates the manifest if necessary.
    Backup {
        /// List out what would be included, but don't actually perform the operation.
        #[clap(long)]
        preview: bool,

        /// Directory in which to store the backup.
        /// It will be created if it does not already exist.
        /// When not specified, this defers to the config file.
        #[clap(long, value_parser = parse_strict_path)]
        path: Option<StrictPath>,

        /// Don't ask for confirmation.
        #[clap(long)]
        force: bool,

        /// Even if the `--force` option has been specified,
        /// ask how to resolve any cloud conflict
        /// rather than ignoring it and continuing silently.
        #[clap(long)]
        no_force_cloud_conflict: bool,

        /// Extra Wine/Proton prefix to check for saves. This should be a folder
        /// with an immediate child folder named "drive_c" (or another letter).
        #[clap(long, value_parser = parse_strict_path)]
        wine_prefix: Option<StrictPath>,

        /// Print information to stdout in machine-readable JSON.
        /// This replaces the default, human-readable output.
        #[clap(long)]
        api: bool,

        /// Use GUI dialogs for prompts and some information.
        #[clap(long)]
        gui: bool,

        /// Sort the game list by different criteria.
        /// When not specified, this defers to the config file.
        #[clap(long, value_parser = possible_values!(CliSort, ALL))]
        sort: Option<CliSort>,

        /// Format in which to store new backups.
        /// When not specified, this defers to the config file.
        #[clap(long, value_parser = possible_values!(BackupFormat, ALL_NAMES))]
        format: Option<BackupFormat>,

        /// Compression method to use for new zip backups.
        /// When not specified, this defers to the config file.
        #[clap(long, value_parser = possible_values!(ZipCompression, ALL_NAMES))]
        compression: Option<ZipCompression>,

        /// Compression level to use for new zip backups.
        /// When not specified, this defers to the config file.
        /// Valid ranges: 1 to 9 for deflate/bzip2, -7 to 22 for zstd.
        #[clap(long, allow_hyphen_values(true))]
        compression_level: Option<i32>,

        /// Maximum number of full backups to retain per game.
        /// Must be between 1 and 255 (inclusive).
        /// When not specified, this defers to the config file.
        #[clap(long, value_parser = clap::value_parser!(u8).range(1..))]
        full_limit: Option<u8>,

        /// Maximum number of differential backups to retain per full backup.
        /// Must be between 0 and 255 (inclusive).
        /// When not specified, this defers to the config file.
        #[clap(long)]
        differential_limit: Option<u8>,

        /// Upload any changes to the cloud when the backup is complete.
        /// If the local and cloud backups are not in sync to begin with,
        /// then nothing will be uploaded.
        /// This has no effect on previews.
        /// When not specified, this defers to the config file.
        #[clap(long)]
        cloud_sync: bool,

        /// Don't perform any cloud checks or synchronization.
        /// When not specified, this defers to the config file.
        #[clap(long, conflicts_with("cloud_sync"))]
        no_cloud_sync: bool,

        /// Include the serialized registry content in the output.
        /// Only includes the native Windows registry, not Wine.
        #[clap(long)]
        dump_registry: bool,

        /// By default, disabled games are skipped unless you name them explicitly.
        /// You can use this option to include all disabled games.
        #[clap(long)]
        include_disabled: bool,

        /// Ask what to do when a game's backup is newer than the live data.
        /// Currently, this only considers file-based saves, not the Windows registry.
        /// This option ignores `--force`.
        ///
        /// You might want to use this if you force a backup on game exit,
        /// but you sometimes restore an older save temporarily to check something,
        /// and you don't want to accidentally back up that old save a
```

### Core Architecture Module: `src/cli/ui.rs`
```
use crate::{
    lang::TRANSLATOR,
    prelude::{Error, SyncDirection},
};

/// GUI looks nicer with an extra empty line as separator, but for terminals a single
/// newline is sufficient
fn get_separator(gui: bool) -> &'static str {
    match gui {
        true => "\n\n",
        false => "\n",
    }
}

fn title(games: &[String]) -> String {
    match games.len() {
        0 => TRANSLATOR.app_name(),
        1 => format!("{} - {}", TRANSLATOR.app_name(), games[0]),
        total => format!("{} - {}: {}", TRANSLATOR.app_name(), TRANSLATOR.total_games(), total),
    }
}

fn pause() -> Result<(), Error> {
    use std::io::prelude::{Read, Write};

    let mut stdin = std::io::stdin();
    let mut stdout = std::io::stdout();

    // TODO: Must be a string literal. Can we support translation?
    write!(stdout, "Press any key to continue...").map_err(|_| Error::CliUnableToRequestConfirmation)?;
    stdout.flush().map_err(|_| Error::CliUnableToRequestConfirmation)?;

    stdin
        .read(&mut [0u8])
        .map_err(|_| Error::CliUnableToRequestConfirmation)?;

    Ok(())
}

pub fn alert_with_raw_error(games: &[String], gui: bool, force: bool, msg: &str, error: &str) -> Result<(), Error> {
    alert(
        games,
        gui,
        force,
        &format!("{}{}{}", msg, get_separator(gui), TRANSLATOR.prefix_error(error)),
    )
}

pub fn alert_with_error(games: &[String], gui: bool, force: bool, msg: &str, error: &Error) -> Result<(), Error> {
    alert(
        games,
        gui,
        force,
        &format!("{}{}{}", msg, get_separator(gui), TRANSLATOR.handle_error(error)),
    )
}

pub fn alert(games: &[String], gui: bool, force: bool, msg: &str) -> Result<(), Error> {
    log::debug!("Showing alert to user (GUI={}, force={}): {}", gui, force, msg);
    if gui {
        rfd::MessageDialog::new()
            .set_title(title(games))
            .set_description(msg)
            .set_level(rfd::MessageLevel::Error)
            .set_buttons(rfd::MessageButtons::Ok)
            .show();
        Ok(())
    } else if !force {
        // TODO: Dialoguer doesn't have an alert type.
        // https://github.com/console-rs/dialoguer/issues/287
        println!("{msg}");
        pause()
    } else {
        println!("{msg}");
        Ok(())
    }
}

pub fn confirm_with_question(
    games: &[String],
    gui: bool,
    force: bool,
    preview: bool,
    msg: &str,
    question: &str,
) -> Result<bool, Error> {
    if force || preview {
        _ = alert(games, gui, force, msg);
        return Ok(true);
    }

    confirm(
        games,
        gui,
        force,
        preview,
        &format!("{}{}{}", msg, get_separator(gui), question),
    )
}

pub fn confirm(games: &[String], gui: bool, force: bool, preview: bool, msg: &str) -> Result<bool, Error> {
    log::debug!(
        "Showing confirmation to user (GUI={}, force={}, preview={}): {}",
        gui,
        force,
        preview,
        msg
    );

    if force || preview {
        return Ok(true);
    }

    if gui {
        let choice = match rfd::MessageDialog::new()
            .set_title(title(games))
            .set_description(msg)
            .set_level(rfd::MessageLevel::Info)
            .set_buttons(rfd::MessageButtons::YesNo)
            .show()
        {
            rfd::MessageDialogResult::Yes => true,
            rfd::MessageDialogResult::No => false,
            rfd::MessageDialogResult::Ok => true,
            rfd::MessageDialogResult::Cancel => false,
            rfd::MessageDialogResult::Custom(_) => false,
        };
        log::debug!("User responded: {}", choice);
        Ok(choice)
    } else {
        match dialoguer::Confirm::new().with_prompt(msg).interact() {
            Ok(value) => {
                log::debug!("User responded: {}", value);
                Ok(value)
            }
            Err(err) => {
                log::error!("Unable to request confirmation: {:?}", err);
                Err(Error::CliUnableToRequestConfirmation)
            }
        }
    }
}

pub fn ask_cloud_conflict(
    games: &[String],
    gui: bool,
    force: bool,
    preview: bool,
) -> Result<Option<SyncDirection>, Error> {
    let msg = TRANSLATOR.cloud_synchronize_conflict();

    log::debug!(
        "Asking user about cloud conflict (GUI={}, force={}, preview={}): {}",
        gui,
        force,
        preview,
        msg,
    );

    if force || preview {
        return Ok(None);
    }

    fn parse_response(raw: &str) -> Option<SyncDirection> {
        if raw == TRANSLATOR.download_button() {
            Some(SyncDirection::Download)
        } else if raw == TRANSLATOR.upload_button() {
            Some(SyncDirection::Upload)
        } else {
            None
        }
    }

    if gui {
        let choice = match rfd::MessageDialog::new()
            .set_title(title(games))
            .set_description(msg)
            .set_level(rfd::MessageLevel::Info)
            .set_buttons(rfd::MessageButtons::YesNoCancelCustom(
                TRANSLATOR.ignore_button(),
                TRANSLATOR.download_button(),
                TRANSLATOR.upload_button(),
            ))
            .show()
        {
            rfd::MessageDialogResult::Yes => None,
            rfd::MessageDialogResult::No => None,
            rfd::MessageDialogResult::Ok => None,
            rfd::MessageDialogResult::Cancel => None,
            rfd::MessageDialogResult::Custom(raw) => parse_response(&raw),
        };
        log::debug!("User responded: {:?}", choice);
        Ok(choice)
    } else {
        let options = vec![
            TRANSLATOR.ignore_button(),
            TRANSLATOR.download_button(),
            TRANSLATOR.upload_button(),
        ];

        let dialog = dialoguer::Select::new().with_prompt(msg).items(&options);

        match dialog.interact() {
            Ok(index) => {
                let choice = parse_response(&options[index]);
                log::debug!("User responded: {} -> {:?}", index, choice);
                Ok(choice)
            }
            Err(err) => {
                log::error!("Unable to request confirmation: {:?}", err);
                Err(Error::CliUnableToRequestConfirmation)
            }
        }
    }
}

```

### Core Architecture Module: `src/cloud.rs`
```
use std::io::{BufRead, BufReader};

use crate::{
    lang::TRANSLATOR,
    prelude::{CommandError, CommandOutput, Error, Finality, Privacy, StrictPath, SyncDirection, run_command},
    resource::config::{App, Config},
    scan::ScanChange,
};

pub fn validate_cloud_config(config: &Config, cloud_path: &str) -> Result<Remote, Error> {
    if !config.apps.rclone.is_valid() {
        return Err(Error::RcloneUnavailable);
    }
    let Some(remote) = config.cloud.remote.clone() else {
        return Err(Error::CloudNotConfigured);
    };
    validate_cloud_path(cloud_path)?;
    Ok(remote)
}

pub fn validate_cloud_path(path: &str) -> Result<(), Error> {
    if path.is_empty() || path == "/" {
        Err(Error::CloudPathInvalid)
    } else {
        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct CloudChange {
    pub path: String,
    pub change: ScanChange,
}

#[derive(Clone, Debug)]
pub enum RcloneProcessEvent {
    Progress { current: f32, max: f32 },
    Change(CloudChange),
}

#[derive(Debug)]
pub struct RcloneProcess {
    program: String,
    args: Vec<String>,
    child: std::process::Child,
    stderr: Option<BufReader<std::process::ChildStderr>>,
}

impl RcloneProcess {
    pub fn launch(program: String, args: Vec<String>) -> Result<Self, CommandError> {
        let mut command = std::process::Command::new(&program);
        command
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(windows::Win32::System::Threading::CREATE_NO_WINDOW.0);
        }

        log::debug!("Running command: {} {:?}", &program, &args);

        let mut child = command.spawn().map_err(|e| {
            let e = CommandError::Launched {
                program: program.clone(),
                args: args.clone(),
                raw: e.to_string(),
            };
            log::error!("Rclone failed: {e:?}");
            e
        })?;

        let stderr = child.stderr.take().map(BufReader::new);
        Ok(Self {
            program,
            args,
            child,
            stderr,
        })
    }

    pub fn events(&mut self) -> Vec<RcloneProcessEvent> {
        let mut events = vec![];

        #[derive(Debug, serde::Deserialize)]
        #[serde(rename_all = "camelCase", untagged)]
        enum Log {
            Skip { skipped: String, object: String },
            Change { msg: String, object: String },
            Stats { stats: Stats },
        }

        #[derive(Debug, serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Stats {
            bytes: f32,
            total_bytes: f32,
        }

        if let Some(stderr) = self.stderr.as_mut() {
            for line in stderr.lines().take(10).filter_map(|x| x.ok()) {
                match serde_json::from_str::<Log>(&line) {
                    Ok(Log::Skip { skipped, object }) => match skipped.as_str() {
                        "copy" => events.push(RcloneProcessEvent::Change(CloudChange {
                            path: object,
                            change: ScanChange::Different,
                        })),
                        "delete" => events.push(RcloneProcessEvent::Change(CloudChange {
                            path: object,
                            change: ScanChange::Removed,
                        })),
                        raw => {
                            log::trace!("Unhandled Rclone 'skipped': {raw}");
                        }
                    },
                    Ok(Log::Change { msg, object }) => match msg.as_str() {
                        "Copied (new)" => events.push(RcloneProcessEvent::Change(CloudChange {
                            path: object,
                            change: ScanChange::New,
                        })),
                        "Copied (replaced existing)" => events.push(RcloneProcessEvent::Change(CloudChange {
                            path: object,
                            change: ScanChange::Different,
                        })),
                        "Deleted" => events.push(RcloneProcessEvent::Change(CloudChange {
                            path: object,
                            change: ScanChange::Removed,
                        })),
                        raw => {
                            log::trace!("Unhandled Rclone 'msg': {raw}");
                        }
                    },
                    Ok(Log::Stats {
                        stats: Stats { bytes, total_bytes },
                    }) => {
                        if total_bytes > 0.0 {
                            events.push(RcloneProcessEvent::Progress {
                                current: bytes,
                                max: total_bytes,
                            });
                        }
                    }
                    Err(_) => {
                        log::trace!("Unhandled Rclone message: {line}");
                    }
                }
            }
        }

        if !events.is_empty() {
            log::trace!("New Rclone events: {events:?}");
        }
        events
    }

    pub fn succeeded(&mut self) -> Option<Result<(), CommandError>> {
        let res = match self.child.try_wait() {
            Ok(Some(status)) => match status.code() {
                Some(0) => Some(Ok(())),
                Some(code) => {
                    let stdout = self.child.stdout.as_mut().and_then(|x| {
                        let lines = BufReader::new(x).lines().map_while(Result::ok).collect::<Vec<_>>();
                        (!lines.is_empty()).then_some(lines.join("\n"))
                    });
                    let stderr = self.stderr.as_mut().and_then(|x| {
                        let lines = x.lines().map_while(Result::ok).collect::<Vec<_>>();
                        (!lines.is_empty()).then_some(lines.join("\n"))
                    });

                    Some(Err(CommandError::Exited {
                        program: self.program.clone(),
                        args: self.args.clone(),
                        code,
                        stdout,
                        stderr,
                    }))
                }
                None => Some(Err(CommandError::Terminated {
                    program: self.program.clone(),
                    args: self.args.clone(),
                })),
            },
            Ok(None) => None,
            Err(_) => Some(Err(CommandError::Terminated {
                program: self.program.clone(),
                args: self.args.clone(),
            })),
        };

        if let Some(Ok(_)) = &res {
            log::debug!("Rclone succeeded");
        }
        if let Some(Err(e)) = &res {
            log::error!("Rclone failed: {e:?}");
        }

        res
    }

    pub fn kill(&mut self) -> Result<(), std::io::Error> {
        let res = self.child.kill();
        if let Err(e) = &res {
            log::error!("Unable to kill child process for Rclone: {e:?}");
        }
        res
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RemoteChoice {
    None,
    Custom,
    Box,
    Dropbox,
    Ftp,
    GoogleDrive,
    OneDrive,
    Smb,
    WebDav,
}

impl RemoteChoice {
    pub const ALL: &'static [Self] = &[
        Self::None,
        Self::Box,
        Self::Dropbox,
        Self::GoogleDrive,
        Self::OneDrive,
        Self::Ftp,
        Self::Smb,
        Self::WebDav,
        Self::Custom,
    ];
}

impl ToString for RemoteChoice {
    fn to_string(&self) -> String {
        match self {
            Self::None => TRANSLATOR.none_label(),
            Self::Custom => TRANSLATOR.custom_label(),
            Self::Box => "Box".to_string(),
            Self::Dropbox => "Dropbox".to_string(),
            Self::Ftp => "FTP".to_string(),
            Self::Goo
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #650** (2026-09-19): **Unable to synchronize with cloud - Nextcloud**
  *Symptoms*: ### Ludusavi version  v0.31.0  ### Operating system  Linux  ### Installation method  Other  ### Description  I've got ludusavi set up to synchronise to Nextcloud through WebDAV. I set it up as follows: ``` Remote: WebDAV url: https://nextcloud.mydomain.com user: myusername password: mypassword provider: Nextcloud ```  When trying to sync my saves to the cloud, I get the following error:   ``` Error: Unable to synchronize with cloud.  Command failed with code 1: /nix/store/9zajf7frvwgc3pn52j5kxyjp1fwi3vv6-rclone-1.75.0/bin/rclone --fast-list --ignore-checksum sync -v --use-json-log --stats=100ms --dry-run /home/myuser/ludusavi-backup ludusavi-1789800606:ludusavi-backup ```  Running the same command in terminal provides this output:  ``` ❯ /nix/store/9zajf7frvwgc3pn52j5kxyjp1fwi3vv6-rclone-1.75.0/bin/rclone --fast-list --ignore-checksum sync -v --use-json-log --stats=100ms --dry-run /home/myuser/ludusavi-backup ludusavi-1789800606:ludusavi-backup {"time":"2026-09-19T15:26:49.315118063+02:00","level":"critical","msg":"Failed to create file system for \"ludusavi-1789800606:ludusavi-backup\": the remote url looks incorrect. Note that nextcloud chunked uploads require you to use the /dav/files/USER endpoint instead of /webdav. Please check 'rclone config show remotename' to verify that the url field ends in /dav/files/USERNAME","source":"cmd/cmd.go:148"} ```  I wasn't sure what to put instead of `remotename` in the suggested command `rclone config show remotename` so that's as far 
  **Post-Mortem & Fix Analysis**:
  > Hi!  > I wasn't sure what to put instead of `remotename` in the suggested command `rclone config show remotename` so that's as far as I got in my debugging.  That would be `rclone config show ludusavi-1789800606` here.  I don't use Nextcloud myself, but I found this: https://docs.nextcloud.com/server/stable/user_manual/en/files/access_webdav.html  > The URL to use when configuring third-party apps to connect to Nextcloud is a bit lengthier than the one for official clients: >  > https://cloud.example.com/remote.php/dav/files/USERNAME/ >  > If Nextcloud is installed in a subdirectory called “nextcloud”: >  > https://example.com/nextcloud/remote.php/dav/files/USERNAME/ 
  > So that nearly worked.  Setting the url to `https://nextcloud.mydomain.com/remote.php/dav/files/myusername` and then getting an app password for credentials instead of using my normal credentials (as explained in the nextcloud documentation https://docs.nextcloud.com/server/stable/user_manual/en/files/access_webdav.html) seems to have successfully connected me to my nextcloud instance.   However, when running the upload from the button in the "Cloud"-settings (the button with a Github icon) it gets stuck at `Changes: 0   Loading...`. Running ludusavi with --debug provides the below logs (which repeat for a very long time):  ``` [2026-09-19T16:14:15.418Z] DEBUG [ludusavi::cloud] Running command: /nix/store/9zajf7frvwgc3pn52j5kxyjp1fwi3vv6-rclone-1.75.0/bin/rclone ["--fast-list", "--ignore-checksum", "sync", "-v", "--use-json-log", "--stats=100ms", "/home/myusername/ludusavi-backup", "ludusavi-1789834229:ludusavi-backup"] [2026-09-19T16:14:15.931Z] TRACE [ludusavi::cloud] Unhandled Rclon
  > Solved!  My username had been autogenerated as my account was created through OIDC. Therefore, the url I was using was incorrect. Rather than `https://nextcloud.mydomain.com/remote.php/dav/files/what_i_thought_was_my_username` it was `https://nextcloud.mydomain.com/remote.php/dav/files/0123456789abcdef0123456789abcdef0123456789abcdef` which I could find from my profile page `https://nextcloud.mydomain.com/index.php/u/0123456789abcdef0123456789abcdef0123456789abcdef`.

- **Issue #649** (2026-09-15): **Interstate Drifter 1999 save not detected**
  *Symptoms*: ### Ludusavi version  v0.31.0  ### Operating system  Linux  ### Installation method  Flatpak  ### Description  Hi, I've added the correct path to PCGW for the Steam game [Interstate Drifter 1999](https://www.pcgamingwiki.com/wiki/Interstate_Drifter_1999#Configuration_file(s)_location), but the save game is not detected.  When I check the [manifest.yaml](https://github.com/mtkennerly/ludusavi-manifest/blob/master/data/manifest.yaml) raw file, the only thing it shows is this:  ``` Interstate Drifter 1999:   id:     lutris: interstate-drifter-1999   installDir:     Interstate Drifter 1999: {}   launch:     "<base>/Interstate Drifter 1999.exe":       - when:           - os: windows             store: steam   steam:     id: 1383770 ```  Is there something missing from the PCGW side, or it's on Ludusavi?  ### Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi! There are a couple of delays in data processing:  * Once every 6 hours, a script runs on GitHub to pull changes from PCGamingWiki into the manifest * Once every 24 hours, Ludusavi checks if the manifest has been updated (you can also check right away by clicking the refresh icon on the "other" screen)  It looks like the data is in the manifest now. Could you give it another try?  ```yaml Interstate Drifter 1999:   files:     "<winLocalAppData>/Interstate_Drifter_1999":       tags:         - save       when:         - os: windows     "<winLocalAppData>/Interstate_Drifter_1999/ID1999.ini":       tags:         - config       when:         - os: windows   id:     lutris: interstate-drifter-1999   installDir:     Interstate Drifter 1999: {}   launch:     "<base>/Interstate Drifter 1999.exe":       - when:           - os: windows             store: steam   steam:     id: 1383770 ```
  > Hi @mtkennerly yes, it's working. I was not aware that there were two independent jobs; I assumed that every 6 hours it would update the manifest completely.  Additionally, I got the information from a friend, who, according to him (shared by someone from the PCGW?! from what I understood), said that currently there is a [Cargo table](https://www.pcgamingwiki.com/wiki/Special:CargoTables/GameData) that you can use (you'll have to authenticate through the API, though), and you would get something like this when using the [MediaWiki API call](https://www.pcgamingwiki.com/w/api.php?action=cargoquery&tables=Game,GameData&fields=GameData.Type=Type,GameData.Platform=Platform,GameData.Paths=Paths&join_on=Game._pageID=GameData._pageID&where=Game.Steam_AppID%20HOLDS%20%221383770%22&format=jsonfm):   ```json {     "cargoquery": [         {             "title": {                 "Type": "Config",                 "Platform": "Windows",                 "Paths": "%LOCALAPPDATA%\\Interstate_Drifter_1

- **Issue #647** (2026-09-06): **Prevent --full-limit 0 from discarding all backups**
  *Symptoms*: The problem is "--full-limit" documents that it "must be between 1 and 255 (inclusive)", and the GUI enforces 1..=255 for the same setting, but the CLI accepts "--full-limit 0", which silently discards every backup for the affected games.  Reproduced on master, with a custom game pointing at /tmp/lv-repro/saves and an empty backup target: ``` $ ludusavi --config /tmp/lv-repro/config --no-manifest-update backup --path /tmp/lv-repro/backups --force --full-limit 1 "Test Game" Test Game [19 B] [+]:   - [+] /tmp/lv-repro/saves/save.txt  Overall:   Games: 1 [+1]   Size: 19 B   Location: /tmp/lv-repro/backups  $ ludusavi --config /tmp/lv-repro/config --no-manifest-update backups --path /tmp/lv-repro/backups Test Game:   Folder: /tmp/lv-repro/backups/Test Game   - "." (2026-09-01T02:30:32) [Linux]  $ echo "more progress" >> /tmp/lv-repro/saves/save.txt  $ ludusavi --config /tmp/lv-repro/config --no-manifest-update backup --path /tmp/lv-repro/backups --force --full-limit 0 "Test Game" Test Game [33 B] [Δ]:   - [Δ] /tmp/lv-repro/saves/save.txt  Overall:   Games: 1 [Δ1]   Size: 33 B   Location: /tmp/lv-repro/backups  $ ludusavi --config /tmp/lv-repro/config --no-manifest-update backups --path /tmp/lv-repro/backups  $ find /tmp/lv-repro/backups -type f /tmp/lv-repro/backups/Test Game/mapping.yaml ``` Exit code is 0, but the game ends up with no backups at all, including the ones it had before: "forget_excess_backups" computes "unlocked_fulls.saturating_s
  **Post-Mortem & Fix Analysis**:
  > @mtkennerly done. Idk the way this was written, I guess it was a keyboard hit.

- **Issue #639** (2026-08-02): **Missclick**
  *Symptoms*: ### Ludusavi version  v0.31.0  ### Operating system  SteamOS  ### Installation method  Decky Loader  ### Description  I want tell to this plugin's devs, that it's the best idea ever arranging "backup" and "restore" buttons very close to each other, making user misclick and lose that save file...  BTW, there's only one slot for backup each game, AFAIK. If there's still a way to restore previous backup version - I'll be glad to do this. Preferably, right now.  ### Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi! I don't maintain the plugin for Decky Loader, but you can leave them feedback over here: https://github.com/GedasFX/decky-ludusavi

- **Issue #637** (2026-08-02): **Mafia 1 (classic) on Steam not detected when ignore cloud saves is disabled**
  *Symptoms*: ### Ludusavi version  v0.31.0  ### Operating system  Linux (Steam Deck)  ### Installation method  Flatpak  ### Description  I am on Steam Machine btw.  When I check "do not backup games with cloud support" it doesn't get picked up, as it should instead  I have Mafia 1 classic not definitive on Steam, and from PcGamingWiki I see hat it has cloud saves on GOG but not on Steam, so maybe that's why it's not being picked up  ### Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > https://github.com/mtkennerly/ludusavi/blob/master/docs/help/backup-exclusions.md
  > Oh, so it's intentional? Or it's because there's no way to distinguish the platform from the installed game?
  > > Oh, so it's intentional? Or it's because there's no way to distinguish the platform from the installed game?  Not necessarily intentional.  The PCWiki that the manifest is derived from has it marked as Cloud Saves, so that's what it gets tagged as in Ludusavi.  Deselect the "Do not back up games with cloud support...." option under `Other`, then run a `Preview` under `Backup Mode` to list all your games. Then select the 3 vertical dots on the right of your game (Mafia), and click `Back up`:  <img width="264" height="354" alt="Image" src="https://github.com/user-attachments/assets/86a10f09-841a-4f5c-a793-e76625028e7a" />  Once done you can go back and reselect the "Do not back up games with cloud support...." option under `Other`.  Going forward Mafia will continue to be backed up.

- **Issue #635** (2026-08-02): **Fix cloud sync when rclone progress is enabled**
  *Symptoms*: ## Summary - force terminal progress off for sync commands so the JSON log parser receives only JSON records - append the override after custom Rclone arguments; the command-line value also overrides `RCLONE_PROGRESS` - add a regression test for the effective argument order and required JSON logging flags  ## Testing - `git diff --check` - Rust tests were not run locally because this machine does not have a Rust toolchain; upstream CI will compile and test the change  Fixes #627
  **Post-Mortem & Fix Analysis**:
  > Thanks! Tested and this works great.

- **Issue #632** (2026-07-25): **Return None from parent() for a bare Windows drive root**
  *Symptoms*: ## Summary  `StrictPath::new("C:").parent()` returns `Some("C:/")` instead of `None`, so a bare Windows drive root reports itself as its own parent. The Unix root `/` correctly returns `None`.  ## Root cause  `parent()` compares the path against `popped()` by raw string:  ```rust let popped = self.popped(); (self != &popped).then_some(popped) ```  For `/`, `popped()` produces `/`, which equals the raw string, so `parent()` returns `None`. For a bare drive root `C:`, `popped()` formats it as `C:/` (a different string that denotes the same location), so `self != popped` holds and `parent()` returns `Some("C:/")`. Walking parents from a Windows drive root therefore takes one extra step (`C:` -> `C:/` -> `None`) that the Unix root does not.  ## Fix  Compare by analysis rather than raw string, so two spellings of the same location are treated as equal:  ```rust (self.analyze() != popped.analyze()).then_some(popped) ```  `analyze("C:")` and `analyze("C:/")` are identical, so a drive root now yields `None`. This only affects the root case; `parent()` of any non-root path is unchanged, since `popped()` itself is untouched.  ## Testing  Added `parent_of_a_root_is_none`, asserting `None` for `/`, `C:`, and `C:/`, and the expected parent for a non-root path. It fails on `main` (the `C:` case returns `Some("C:/")`) and passes with the fix. The full `path::` test suite passes (40 tests) and `cargo fmt --check` is clean.  ## Notes  Low severity, no crash and no data loss, just a wrong/inco

- **Issue #631** (2026-07-25): **Disambiguate colliding drive folder names to prevent silent data loss**
  *Symptoms*: ## Summary  `IndividualMapping::drive_folder_name` can map two distinct drives to the same backup folder, so saves from one silently overwrite the other and a restore cannot tell them apart.  ## Root cause  A drive is turned into a backup folder name by `new_drive_folder_name` -> `escape_folder_name`, which replaces every `INVALID_FILE_CHARS` entry (including the path separator `\`) with `_`. That escaping is not injective, so different drives can escape to the same string. Two fully valid but distinct Windows UNC shares are enough:  ``` \\a_b\c   (server "a_b", share "c")   -> drive-__a_b_c \\a\b_c   (server "a",   share "b_c") -> drive-__a_b_c ```  When both are backed up, `drive_folder_name` computes the same key for each and does `self.drives.insert(key, drive)` with no collision check, so:  - both drives resolve to one `drive-__a_b_c` folder, and files at the same relative path overwrite each other (silent data loss), and - the `drives` map in `mapping.yaml` keeps only the last drive for that key, so a restore can no longer map the folder back to the right share.  ## Fix  Disambiguate on collision with a numeric suffix and persist the chosen key:  ``` drive-__a_b_c, drive-__a_b_c-2, drive-__a_b_c-3, ... ```  The reverse lookup used by the immutable variant (restore) reads the persisted key, so it stays correct. Non-colliding drives are unchanged, so existing backups keep their folder names.  ## Testing  Added `distinct_unc_drives_do_not_collide_to_same_folder`. It fails 
  **Post-Mortem & Fix Analysis**:
  > Thanks for catching this 👍 

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

### Incident Patch 1: `70f4abb3` (2026-09-11)
**Commit Message**: Fix Windows 32-bit build

**File**: `.github/workflows/main.yaml` (modified, +9/-8)
```diff
@@ -43,36 +43,37 @@ jobs:
           args: --style semver
       - uses: dtolnay/rust-toolchain@master
         with:
-          toolchain: stable-${{ matrix.rust-target }}
+          targets: ${{ matrix.rust-target }}
+          toolchain: stable
       - uses: Swatinem/rust-cache@v2
         with:
           key: ${{ matrix.os }}-${{ matrix.rust-target }}
       - if: ${{ startsWith(matrix.os, 'ubuntu-') }}
         run: sudo apt-get update && sudo apt-get install -y gcc libxcb-composite0-dev libgtk-3-dev
-      - run: cargo build --release
+      - run: cargo build --release --target ${{ matrix.rust-target }}
       - if: ${{ matrix.artifact-name == 'mac' }}
         run: bash tests/package-macos-app.sh
       - if: ${{ matrix.artifact-name == 'mac' }}
         run: >
           scripts/package-macos-app.sh
-          target/release/${{ matrix.artifact-file }}
+          target/${{ matrix.rust-target }}/release/${{ matrix.artifact-file }}
           ${{ env.LUDUSAVI_VERSION }}
-          target/release/ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}
-          target/release/ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}.tar.gz
+          target/${{ matrix.rust-target }}/release/ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}
+          target/${{ matrix.rust-target }}/release/ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}.tar.gz
       - if: ${{ matrix.tar && matrix.artifact-name != 'mac' }}
         run: |
-          cd target/release
+          cd target/${{ matrix.rust-target }}/release
           tar --create --gzip --file=ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}.tar.gz ${{ matrix.artifact-file }}
       - if: ${{ matrix.tar }}
         uses: actions/upload-artifact@v4
         with:
           name: ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}
-          path: target/release/ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}.tar.gz
+          path: target/${{ matrix.rust-target }}/release/ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}.tar.gz
       - if: ${{ !matrix.tar }}
         uses: actions/upload-artifact@v4
         with:
           name: ludusavi-v${{ env.LUDUSAVI_VERSION }}-${{ matrix.artifact-name }}
-          path: target/release/${{ matrix.artifact-file }}
+          path: target/${{ matrix.rust-target }}/release/${{ matrix.artifact-file }}
 
   test:
     strategy:
```

---

### Incident Patch 2: `ce2a9efc` (2026-09-05)
**Commit Message**: Fix syntax

**File**: `src/cli/parse.rs` (modified, +1/-1)
```diff
@@ -1211,7 +1211,7 @@ mod tests {
             &["ludusavi", "restore", "--path", "tests/fake"],
             clap::error::ErrorKind::ValueValidation,
         );
-    }606847
+    }
     
 
     #[test]
```

---

### Incident Patch 3: `2b3eb90b` (2026-08-08)
**Commit Message**: Fix width of the placeholder popupmenu

**File**: `src/gui/editor.rs` (modified, +1/-0)
```diff
@@ -461,6 +461,7 @@ pub fn custom_games<'a>(
                                                             },
                                                         )
                                                         .width(70)
+                                                        .menu_width(200.0)
                                                         .class(style::PickList::Button)
                                                         .open_on_hover()
                                                         .button_like(),
```

**File**: `src/gui/popup_menu.rs` (modified, +9/-1)
```diff
@@ -29,6 +29,7 @@ where
     on_selected: Box<dyn Fn(T) -> Message + 'a>,
     options: Cow<'a, [T]>,
     width: Length,
+    menu_width: f32,
     padding: Padding,
     text_size: Option<f32>,
     font: Option<Renderer::Font>,
@@ -56,6 +57,7 @@ where
             on_selected: Box::new(on_selected),
             options: options.into(),
             width: Length::Shrink,
+            menu_width: 150.0,
             text_size: None,
             padding: Self::DEFAULT_PADDING,
             font: None,
@@ -73,6 +75,12 @@ where
         self
     }
 
+    /// Sets the width of the drop-down menu.
+    pub fn menu_width(mut self, width: f32) -> Self {
+        self.menu_width = width;
+        self
+    }
+
     /// Sets the style of the [`PopupMenu`].
     pub fn class(mut self, style: impl Into<<Theme as Catalog>::Class<'a>>) -> Self {
         self.style = style.into();
@@ -316,7 +324,7 @@ where
                 None,
                 &self.menu_style,
             )
-            .width(150.0)
+            .width(self.menu_width)
             .padding(self.padding)
             .font(self.font.unwrap_or_else(|| renderer.default_font()))
             .text_shaping(text::Shaping::Advanced);
```

---

### Incident Patch 4: `f1c8953a` (2026-08-08)
**Commit Message**: fix: avoid ripgrep in macOS packaging test

**File**: `tests/package-macos-app.sh` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ test "$(readlink "$staging_dir/ludusavi")" = "Ludusavi.app/Contents/MacOS/Ludusa
 test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist")" = "Ludusavi"
 test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist")" = "com.mtkennerly.ludusavi"
 test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist")" = "1.2.3"
-test "$(tar --list --gzip --file="$archive" | rg '^Ludusavi\.app/Contents/MacOS/Ludusavi$')" = "Ludusavi.app/Contents/MacOS/Ludusavi"
-test "$(tar --list --gzip --file="$archive" | rg '^ludusavi$')" = "ludusavi"
+test "$(tar --list --gzip --file="$archive" | /usr/bin/grep -x 'Ludusavi.app/Contents/MacOS/Ludusavi')" = "Ludusavi.app/Contents/MacOS/Ludusavi"
+test "$(tar --list --gzip --file="$archive" | /usr/bin/grep -x 'ludusavi')" = "ludusavi"
 
 extracted_dir="$temp_dir/extracted"
 mkdir "$extracted_dir"
```

---

### Incident Patch 5: `3ae0d31f` (2026-08-02)
**Commit Message**: Merge pull request #635 from bm1016bm-svg/codex/fix-rclone-progress-output

Fix cloud sync when rclone progress is enabled

**File**: `src/cloud.rs` (modified, +55/-7)
```diff
@@ -634,24 +634,22 @@ impl Rclone {
         Ok(())
     }
 
-    pub fn sync(
+    fn sync_args(
         &self,
         local: &StrictPath,
         remote_path: &str,
         direction: SyncDirection,
         finality: Finality,
         game_dirs: &[String],
-    ) -> Result<RcloneProcess, CommandError> {
-        if direction == SyncDirection::Upload && !local.exists() {
-            // Rclone will fail with exit code 3 if the local folder does not exist.
-            _ = local.create_dirs();
-        }
-
+    ) -> Vec<String> {
         let mut args = vec![
             "sync".to_string(),
             "-v".to_string(),
             "--use-json-log".to_string(),
             "--stats=100ms".to_string(),
+            // Terminal progress output is incompatible with the JSON log parser.
+            // A command-line value also overrides RCLONE_PROGRESS.
+            "--progress=false".to_string(),
         ];
 
         if finality.preview() {
@@ -674,10 +672,60 @@ impl Rclone {
             }
         }
 
+        args
+    }
+
+    pub fn sync(
+        &self,
+        local: &StrictPath,
+        remote_path: &str,
+        direction: SyncDirection,
+        finality: Finality,
+        game_dirs: &[String],
+    ) -> Result<RcloneProcess, CommandError> {
+        if direction == SyncDirection::Upload && !local.exists() {
+            // Rclone will fail with exit code 3 if the local folder does not exist.
+            _ = local.create_dirs();
+        }
+
+        let args = self.sync_args(local, remote_path, direction, finality, game_dirs);
         RcloneProcess::launch(self.app.path.raw().into(), self.args(&args))
     }
 }
 
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn sync_disables_terminal_progress_after_custom_arguments() {
+        let rclone = Rclone::new(
+            App {
+                path: StrictPath::new("rclone".to_string()),
+                arguments: "--progress".to_string(),
+            },
+            Remote::Custom {
+                id: "cloud".to_string(),
+            },
+        );
+
+        let sync_args = rclone.sync_args(
+            &StrictPath::new("local".to_string()),
+            "backups",
+            SyncDirection::Upload,
+            Finality::Final,
+            &[],
+        );
+        let args = rclone.args(&sync_args);
+
+        assert!(args.contains(&"--use-json-log".to_string()));
+        assert!(args.contains(&"--stats=100ms".to_string()));
+        let progress = args.iter().position(|x| x == "--progress").unwrap();
+        let no_progress = args.iter().position(|x| x == "--progress=false").unwrap();
+        assert!(progress < no_progress);
+    }
+}
+
 #[cfg(feature = "app")]
 pub mod rclone_monitor {
     use iced::{
```

---

### Incident Patch 6: `276156b4` (2026-07-30)
**Commit Message**: Fix rclone progress output during cloud sync

**File**: `src/cloud.rs` (modified, +55/-7)
```diff
@@ -634,24 +634,22 @@ impl Rclone {
         Ok(())
     }
 
-    pub fn sync(
+    fn sync_args(
         &self,
         local: &StrictPath,
         remote_path: &str,
         direction: SyncDirection,
         finality: Finality,
         game_dirs: &[String],
-    ) -> Result<RcloneProcess, CommandError> {
-        if direction == SyncDirection::Upload && !local.exists() {
-            // Rclone will fail with exit code 3 if the local folder does not exist.
-            _ = local.create_dirs();
-        }
-
+    ) -> Vec<String> {
         let mut args = vec![
             "sync".to_string(),
             "-v".to_string(),
             "--use-json-log".to_string(),
             "--stats=100ms".to_string(),
+            // Terminal progress output is incompatible with the JSON log parser.
+            // A command-line value also overrides RCLONE_PROGRESS.
+            "--progress=false".to_string(),
         ];
 
         if finality.preview() {
@@ -674,10 +672,60 @@ impl Rclone {
             }
         }
 
+        args
+    }
+
+    pub fn sync(
+        &self,
+        local: &StrictPath,
+        remote_path: &str,
+        direction: SyncDirection,
+        finality: Finality,
+        game_dirs: &[String],
+    ) -> Result<RcloneProcess, CommandError> {
+        if direction == SyncDirection::Upload && !local.exists() {
+            // Rclone will fail with exit code 3 if the local folder does not exist.
+            _ = local.create_dirs();
+        }
+
+        let args = self.sync_args(local, remote_path, direction, finality, game_dirs);
         RcloneProcess::launch(self.app.path.raw().into(), self.args(&args))
     }
 }
 
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn sync_disables_terminal_progress_after_custom_arguments() {
+        let rclone = Rclone::new(
+            App {
+                path: StrictPath::new("rclone".to_string()),
+                arguments: "--progress".to_string(),
+            },
+            Remote::Custom {
+                id: "cloud".to_string(),
+            },
+        );
+
+        let sync_args = rclone.sync_args(
+            &StrictPath::new("local".to_string()),
+            "backups",
+            SyncDirection::Upload,
+            Finality::Final,
+            &[],
+        );
+        let args = rclone.args(&sync_args);
+
+        assert!(args.contains(&"--use-json-log".to_string()));
+        assert!(args.contains(&"--stats=100ms".to_string()));
+        let progress = args.iter().position(|x| x == "--progress").unwrap();
+        let no_progress = args.iter().position(|x| x == "--progress=false").unwrap();
+        assert!(progress < no_progress);
+    }
+}
+
 #[cfg(feature = "app")]
 pub mod rclone_monitor {
     use iced::{
```

---

### Incident Patch 7: `22d83469` (2026-07-25)
**Commit Message**: Fix lints

**File**: `src/cli/ui.rs` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ fn get_separator(gui: bool) -> &'static str {
 fn title(games: &[String]) -> String {
     match games.len() {
         0 => TRANSLATOR.app_name(),
-        1 => format!("{} - {}", TRANSLATOR.app_name(), &games[0]),
+        1 => format!("{} - {}", TRANSLATOR.app_name(), games[0]),
         total => format!("{} - {}: {}", TRANSLATOR.app_name(), TRANSLATOR.total_games(), total),
     }
 }
```

**File**: `src/main.rs` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ fn prepare_logging(debug: bool) -> Result<flexi_logger::LoggerHandle, flexi_logg
                     now.format("%Y-%m-%dT%H:%M:%S%.3fZ"),
                     record.level(),
                     record.module_path().unwrap_or("<unnamed>"),
-                    &record.args(),
+                    record.args(),
                 )
             })
             .start()
@@ -56,7 +56,7 @@ fn prepare_logging(debug: bool) -> Result<flexi_logger::LoggerHandle, flexi_logg
                     now.format("%Y-%m-%dT%H:%M:%S%.3fZ"),
                     record.level(),
                     record.module_path().unwrap_or("<unnamed>"),
-                    &record.args(),
+                    record.args(),
                 )
             })
             .start()
```

**File**: `src/path.rs` (modified, +3/-3)
```diff
@@ -222,7 +222,7 @@ impl std::hash::Hash for StrictPath {
 
 impl std::fmt::Debug for StrictPath {
     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
-        write!(f, "StrictPath {{ raw: {:?}, basis: {:?} }}", &self.raw, &self.basis)
+        write!(f, "StrictPath {{ raw: {:?}, basis: {:?} }}", self.raw, self.basis)
     }
 }
 
@@ -267,7 +267,7 @@ impl StrictPath {
 
     pub fn as_std_path_buf(&self) -> Result<std::path::PathBuf, std::io::Error> {
         Ok(std::path::PathBuf::from(&self.interpret().map_err(|_| {
-            std::io::Error::other(format!("Cannot interpret path: {:?}", &self))
+            std::io::Error::other(format!("Cannot interpret path: {:?}", self))
         })?))
     }
 
@@ -658,7 +658,7 @@ impl StrictPath {
 
     pub fn joined(&self, other: impl AsRef<str>) -> Self {
         Self {
-            raw: format!("{}/{}", &self.raw, other.as_ref()).replace('\\', "/"),
+            raw: format!("{}/{}", self.raw, other.as_ref()).replace('\\', "/"),
             basis: self.basis.clone(),
             canonical: Arc::new(Mutex::new(None)),
         }
```

**File**: `src/report.rs` (modified, +1/-1)
```diff
@@ -400,7 +400,7 @@ impl Reporter {
 
                 if let Some(dumped_registry) = scan_info.dumped_registry.as_ref().filter(|_| dump_registry) {
                     let label = TRANSLATOR.custom_registry_label();
-                    parts.push(format!("---------- {} ----------", &label));
+                    parts.push(format!("---------- {} ----------", label));
                     parts.push(dumped_registry.serialize(registry::Format::Reg));
                     parts.push("-".repeat(22 + label.len()));
                 }
```

**File**: `src/scan.rs` (modified, +30/-30)
```diff
@@ -215,7 +215,7 @@ pub fn parse_paths(
             if Os::HOST == Os::Linux {
                 add_path!(
                     path.replace(p::GAME, &format!("{install_dir}/game"))
-                        .replace(p::BASE, &format!("{}/{}/game", &root_globbable, install_dir))
+                        .replace(p::BASE, &format!("{}/{}/game", root_globbable, install_dir))
                 );
             }
         }
@@ -225,11 +225,11 @@ pub fn parse_paths(
                 add_path!(
                     path.replace(
                         p::XDG_DATA,
-                        check_nonwindows_path(&format!("{}/../../data", &root_globbable)),
+                        check_nonwindows_path(&format!("{}/../../data", root_globbable)),
                     )
                     .replace(
                         p::XDG_CONFIG,
-                        check_nonwindows_path(&format!("{}/../../config", &root_globbable)),
+                        check_nonwindows_path(&format!("{}/../../config", root_globbable)),
                     )
                     .replace(p::STORE_USER_ID, "*")
                     .replace(p::OS_USER_NAME, &crate::prelude::OS_USERNAME)
@@ -245,11 +245,11 @@ pub fn parse_paths(
                 add_path!(
                     path.replace(
                         p::XDG_DATA,
-                        check_nonwindows_path(&format!("{}/../../data", &root_globbable)),
+                        check_nonwindows_path(&format!("{}/../../data", root_globbable)),
                     )
                     .replace(
                         p::XDG_CONFIG,
-                        check_nonwindows_path(&format!("{}/../../config", &root_globbable)),
+                        check_nonwindows_path(&format!("{}/../../config", root_globbable)),
                     )
                     .replace(p::STORE_USER_ID, "*")
                     .replace(p::OS_USER_NAME, &crate::prelude::OS_USERNAME)
@@ -270,13 +270,13 @@ pub fn parse_paths(
                     add_path!(
                         path.replace(p::STORE_USER_ID, "*")
                             .replace(p::OS_USER_NAME, &crate::prelude::OS_USERNAME)
-                            .replace(p::XDG_DATA, &format!("{}../../.local/share", &root_globbable))
-                            .replace(p::XDG_CONFIG, &format!("{}../../.config", &root_globbable))
+                            .replace(p::XDG_DATA, &format!("{}../../.local/share", root_globbable))
+                            .replace(p::XDG_CONFIG, &format!("{}../../.config", root_globbable))
                     );
                 }
 
                 for id in ids.steam(steam_shortcut.map(|x| x.id)) {
-                    let prefix = format!("{}/steamapps/compatdata/{}/pfx/drive_c", &root_globbable, id);
+                    let prefix = format!("{}/steamapps/compatdata/{}/pfx/drive_c", root_globbable, id);
                     let path2 = path
                         .replace(p::ROOT, &root_globbable)
                         .replace(p::GAME, &install_dir)
@@ -317,7 +317,7 @@ pub fn parse_paths(
                         add_path!(
                             path.replace(p::ROOT, &ubisoft)
                                 .replace(p::GAME, &install_dir)
-                                .replace(p::BASE, &format!("{}/{}", &ubisoft, install_dir))
+                                .replace(p::BASE, &format!("{}/{}", ubisoft, install_dir))
                                 .replace(p::STORE_USER_ID, "*")
                                 .replace(p::OS_USER_NAME, "steamuser")
                         );
@@ -329,7 +329,7 @@ pub fn parse_paths(
             add_path!(
                 path.replace(p::ROOT, &root_globbable)
                     .replace(p::GAME, &install_dir)
-                    .replace(p::BASE, &format!("{}/{}", &root_globbable, install_dir))
+                    .replace(p::BASE, &format!("{}/{}", root_globbable, install_dir))
                     .replace(p::STORE_USER_ID, "*")
     
```

---

### Incident Patch 8: `60e4dbde` (2026-07-25)
**Commit Message**: Merge pull request #631 from dkxmercury/fix/unc-drive-collision

Disambiguate colliding drive folder names to prevent silent data loss

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -6,6 +6,12 @@
     This is supported for Wine specifically, not any other native Linux paths.
     Currently, this only translates file paths, not the registry.
     ([Contributed by thedavidweng](https://github.com/mtkennerly/ludusavi/pull/614))
+* Fixed:
+  * Two distinct drives whose escaped folder names collided (such as the UNC
+    shares `\\a_b\c` and `\\a\b_c`) would share one backup folder, so saves from
+    one could silently overwrite the other. Colliding folder names are now
+    disambiguated with a numeric suffix.
+    ([Contributed by dkxmercury](https://github.com/mtkennerly/ludusavi/pull/631))
 
 ## v0.31.0 (2026-04-04)
 
```

**File**: `src/scan/layout.rs` (modified, +33/-1)
```diff
@@ -401,7 +401,18 @@ impl IndividualMapping {
         match reversed.get::<str>(drive) {
             Some(mapped) => mapped.to_string(),
             None => {
-                let key = Self::new_drive_folder_name(drive);
+                // The escaped folder name is not injective (e.g. distinct UNC
+                // shares like \\a_b\c and \\a\b_c both escape to the same
+                // string), so disambiguate on collision. Otherwise two drives
+                // share one backup folder and saves from one silently overwrite
+                // the other.
+                let base = Self::new_drive_folder_name(drive);
+                let mut key = base.clone();
+                let mut suffix = 2;
+                while self.drives.get(&key).is_some_and(|existing| existing != drive) {
+                    key = format!("{base}-{suffix}");
+                    suffix += 1;
+                }
                 self.drives.insert(key.to_string(), drive.to_string());
                 key
             }
@@ -2356,6 +2367,27 @@ mod tests {
             assert_eq!("drive-____C", mapping.drive_folder_name(r#"\\?\C:"#));
             assert_eq!("drive-__remote", mapping.drive_folder_name(r#"\\remote"#));
         }
+
+        #[test]
+        fn distinct_unc_drives_do_not_collide_to_same_folder() {
+            let mut mapping = IndividualMapping::new("foo".to_owned());
+            // Two valid but distinct Windows UNC shares that escape to the same
+            // string: server "a_b" share "c" vs server "a" share "b_c".
+            let folder1 = mapping.drive_folder_name(r#"\\a_b\c"#);
+            let folder2 = mapping.drive_folder_name(r#"\\a\b_c"#);
+
+            // They must map to different backup folders, otherwise saves from
+            // one share silently overwrite saves from the other.
+            assert_ne!(folder1, folder2, "distinct UNC drives collided to folder {folder1}");
+
+            // And both shares must be retained in the drives map, not just the last.
+            assert_eq!(
+                2,
+                mapping.drives.len(),
+                "drives map lost an entry: {:?}",
+                mapping.drives
+            );
+        }
     }
 
     mod backup_layout {
```

---

### Incident Patch 9: `3da08496` (2026-07-25)
**Commit Message**: Merge pull request #632 from dkxmercury/fix/parent-drive-root

Return None from parent() for a bare Windows drive root

**File**: `src/path.rs` (modified, +19/-1)
```diff
@@ -838,7 +838,10 @@ impl StrictPath {
 
     pub fn parent(&self) -> Option<Self> {
         let popped = self.popped();
-        (self != &popped).then_some(popped)
+        // Compare by analysis rather than raw string. A bare drive root like
+        // "C:" pops to "C:/", a different string that denotes the same location,
+        // and should have no parent, matching the Unix root "/".
+        (self.analyze() != popped.analyze()).then_some(popped)
     }
 
     pub fn parent_if_file(&self) -> Result<Self, StrictPathError> {
@@ -1871,6 +1874,21 @@ mod tests {
             check!(r"C:/", r"C:");
         }
 
+        #[test]
+        fn parent_of_a_root_is_none() {
+            // A Unix root has no parent, and a bare Windows drive root should
+            // behave the same instead of reporting itself (as "C:/") as its parent.
+            assert_eq!(None, StrictPath::new("/".to_string()).parent());
+            assert_eq!(None, StrictPath::new("C:".to_string()).parent());
+            assert_eq!(None, StrictPath::new("C:/".to_string()).parent());
+
+            // A non-root path still has the expected parent.
+            assert_eq!(
+                Some(StrictPath::new("C:/foo".to_string())),
+                StrictPath::new("C:/foo/bar".to_string()).parent()
+            );
+        }
+
         #[test]
         fn handles_windows_classic_path_with_extra_colon() {
             // https://github.com/mtkennerly/ludusavi/issues/36
```

---

### Incident Patch 10: `7529c678` (2026-07-25)
**Commit Message**: Merge pull request #629 from dkxmercury/fix/is-absolute-trim

Make is_absolute trim like the rest of StrictPath

**File**: `src/path.rs` (modified, +21/-1)
```diff
@@ -866,7 +866,7 @@ impl StrictPath {
             Utf8WindowsComponent as WComponent,
         };
 
-        if let Some(component) = TypedPath::derive(&self.raw).components().next() {
+        if let Some(component) = TypedPath::derive(self.raw.trim()).components().next() {
             match component {
                 Component::Windows(WComponent::Prefix(_) | WComponent::RootDir)
                 | Component::Unix(UComponent::RootDir) => {
@@ -1757,6 +1757,26 @@ mod tests {
             assert_eq!(Err(StrictPathError::Unsupported), path.access_nonwindows());
         }
 
+        #[test]
+        fn is_absolute_ignores_surrounding_whitespace() {
+            // Every other method derives its typed path from the trimmed raw
+            // string, so is_absolute must trim too. A leading space should not
+            // make an otherwise absolute path report as relative.
+            assert!(StrictPath::new("/foo/bar").is_absolute());
+            assert!(StrictPath::new(" /foo/bar").is_absolute());
+            assert!(StrictPath::new("C:/foo").is_absolute());
+            assert!(StrictPath::new(" C:/foo").is_absolute());
+            assert!(!StrictPath::new("foo/bar").is_absolute());
+            assert!(!StrictPath::new(" foo/bar").is_absolute());
+
+            // The leading-space path is treated as absolute everywhere else, so
+            // is_absolute has to agree.
+            assert_eq!(
+                Analysis::new(Some(Drive::Root), vec!["foo".to_string(), "bar".to_string()]),
+                StrictPath::new(" /foo/bar").analyze()
+            );
+        }
+
         #[test]
         fn tilde() {
             let path = StrictPath::new("~".to_owned());
```

#### Recent Merged Pull Requests:
- **PR #647** (2026-09-06): Prevent --full-limit 0 from discarding all backups (@rleeon)
- **PR #645** (2026-08-27): Expose manifest file tags in the API output (@ChrisJr404)
- **PR #643** (closed): Fix: escape literal brackets in custom game paths (@Darkmet98)
- **PR #642** (2026-08-16): Package the macOS release as Ludusavi.app (@marcodallagatta)
- **PR #641** (2026-08-10): Add hoverable placeholder menu for custom paths (@a1156883061)
- **PR #640** (closed): Main (@zarzar47)
- **PR #636** (closed): Add Linux package builds (deb, rpm, AppImage, pacman, tarball) (@TheRealFame)
- **PR #635** (2026-08-02): Fix cloud sync when rclone progress is enabled (@bm1016bm-svg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
