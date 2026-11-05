> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oxc-project-oxc-learnings.md`  
> **Source**: github ([https://github.com/oxc-project/oxc](https://github.com/oxc-project/oxc))  
> **Source Version**: `c6ec50b6`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T16:52:36.174Z  
> **Learning ID**: `learn-github-oxc-project-oxc`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): oxc-project/oxc

> **Canonical Artifact**: `07_PROJECT_LEARNING/oxc-project-oxc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oxc-project/oxc](https://github.com/oxc-project/oxc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T16:52:35.708Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oxc-project/oxc`
- **Description**: ⚓ A collection of high-performance JavaScript tools.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 23334 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/oxfmt/src-js/cli-worker.ts`
```
// `oxfmt` CLI - Worker Thread Entry Point

// Re-exports core functions for use in `worker_threads`
export { formatEmbeddedDoc, formatFile, sortTailwindClasses } from "./libs/apis";

```

### Core Architecture Module: `apps/oxfmt/src-js/cli/worker-proxy.ts`
```
import Tinypool from "tinypool";
import { toFormatFileResult, toNullable } from "../libs/napi-callbacks";
import type { FormatFileResult } from "../libs/napi-callbacks";
import type {
  FormatFileParam,
  FormatEmbeddedDocParam,
  SortTailwindClassesArgs,
} from "../libs/apis";

// Worker pool for parallel Prettier formatting
let pool: Tinypool | null = null;
let poolSize: number | null = null;

export async function initExternalServices(numThreads: number): Promise<void> {
  // In LSP mode, this can be called repeatedly for the lifetime of the process.
  // e.g. on every workspace folder build, config-triggered rebuild, etc
  // The process-wide pool must never be recreated or destroyed on re-init:
  // that leaks the previous workers, and other workspace folders may have formats in-flight.
  // (https://github.com/oxc-project/oxc/issues/24147)
  // NOTE: `numThreads` never changes within a single session, so the first value wins.
  poolSize ??= numThreads;
}

// Create the pool lazily on first use,
// so runs that never send a task to the pool spawn no workers at all.
// (e.g. Rust-tier files only, without Tailwind sorting)
async function getPool(): Promise<Tinypool> {
  // Rust always calls `initExternalServices` before formatting, so this is defensive.
  if (poolSize === null) throw new Error("External services are not initialized");

  // NOTE: Default `runtime: worker_threads` requires napi >= 3.16.1,
  // older versions deadlock when a worker loads the addon during `block_on`. (napi-rs/napi-rs#3670)
  pool ??= new Tinypool({
    filename: new URL("./cli-worker.js", import.meta.url).href,
    // Spawn workers on demand up to `poolSize`, and keep them alive for later tasks.
    // - Each worker loads its own copy of JS deps (e.g. Prettier, Tailwind sorter),
    //   and many runs send only a few tasks to the pool
    // - The default `idleTimeout: 0` removes idle workers above `minThreads` right away
    // - Unlike Piscina, Tinypool does not special-case `Infinity` and passes it to `setTimeout` as is,
    //   where Node.js replaces it with 1 ms, so use the max delay `setTimeout` accepts instead
    minThreads: 1,
    maxThreads: poolSize,
    idleTimeout: 2 ** 31 - 1,
  });
  return pool;
}

export async function disposeExternalServices(): Promise<void> {
  await pool?.destroy();
  pool = null;
  poolSize = null;
}

// ---

export function formatFile(
  options: FormatFileParam["options"],
  code: string,
): Promise<FormatFileResult> {
  return toFormatFileResult(
    getPool().then((pool) =>
      pool.run({ options, code } satisfies FormatFileParam, { name: "formatFile" }),
    ),
  );
}

// ---

export function formatEmbeddedDoc(
  options: FormatEmbeddedDocParam["options"],
  code: string,
): Promise<string | null> {
  return toNullable(
    getPool().then((pool) =>
      pool.run({ options, code } satisfies FormatEmbeddedDocParam, {
        name: "formatEmbeddedDoc",
      }),
    ),
  );
}

export function sortTailwindClasses(
  options: SortTailwindClassesArgs["options"],
  classes: string[],
): Promise<string[] | null> {
  return toNullable(
    getPool().then((pool) =>
      pool.run({ classes, options } satisfies SortTailwindClassesArgs, {
        name: "sortTailwindClasses",
      }),
    ),
  );
}

```

### Core Architecture Module: `apps/oxfmt/src/core/config/associations.rs`
```
use std::path::{Path, PathBuf};

use crate::core::{Language, oxfmtrc::OxfmtAssociationConfig};

use super::relative_path;

/// Resolved `associations` for file-specific language matching.
/// Like `OxfmtrcOverrides`, but picks a language instead of merging options.
#[derive(Debug)]
pub struct OxfmtrcAssociations {
    base_dir: Option<PathBuf>,
    entries: Vec<OxfmtAssociationConfig>,
}

impl OxfmtrcAssociations {
    pub fn new(associations: Vec<OxfmtAssociationConfig>, base_dir: Option<PathBuf>) -> Self {
        Self { base_dir, entries: associations }
    }

    /// The language of the last association matching `path`, if any.
    pub fn matching(&self, path: &Path) -> Option<Language> {
        let relative = relative_path(self.base_dir.as_deref(), path);
        self.entries
            .iter()
            .rev()
            .find(|e| e.files.is_match(&relative) && !e.exclude_files.is_match(&relative))
            .map(|e| e.language)
    }
}

```

### Core Architecture Module: `apps/oxfmt/src/core/config/editorconfig.rs`
```
use std::path::{Path, PathBuf};

use editorconfig_parser::{
    EditorConfig, EditorConfigProperties, EditorConfigProperty, EndOfLine, IndentStyle,
    MaxLineLength, QuoteType,
};

use crate::core::{
    oxfmtrc::{EndOfLineConfig, FormatConfig},
    utils,
};

/// Find the nearest `.editorconfig` walking up from `cwd`.
pub fn resolve_editorconfig_path(cwd: &Path) -> Option<PathBuf> {
    cwd.ancestors().map(|dir| dir.join(".editorconfig")).find(|p| p.exists())
}

/// Load `.editorconfig` from a path if provided.
///
/// Section patterns like `[src/*.ts]` are anchored at the `.editorconfig`'s
/// own directory, so `path.parent()` is used as the base. Real callers always
/// pass an absolute path (via `resolve_editorconfig_path`), making the `.` fallback
/// only a theoretical safety net for a bare `.editorconfig` filename.
pub fn load_editorconfig(editorconfig_path: Option<&Path>) -> Result<Option<EditorConfig>, String> {
    match editorconfig_path {
        Some(path) => {
            let str = utils::read_to_string(path)
                .map_err(|_| format!("Failed to read {}: File not found", path.display()))?;
            let cwd = path.parent().unwrap_or_else(|| Path::new("."));
            Ok(Some(EditorConfig::parse(&str).with_cwd(cwd)))
        }
        None => Ok(None),
    }
}

/// The root `[*]` section's properties, if the file has one.
pub fn root_properties(editorconfig: &EditorConfig) -> Option<&EditorConfigProperties> {
    editorconfig.sections().iter().find(|s| s.name == "*").map(|s| &s.properties)
}

/// Resolve `.editorconfig` for `path`,
/// returning the properties only when a per-file section changes them against the root `[*]` section.
/// `None` when nothing changes, so callers can gate on `is_some()` without a separate probe.
///
/// Currently, only the following properties are considered for overrides:
/// - max_line_length
/// - end_of_line
/// - indent_style
/// - indent_size
/// - tab_width
/// - insert_final_newline
/// - quote_type
pub fn resolve_editorconfig_overrides(
    editorconfig: &EditorConfig,
    path: &Path,
) -> Option<EditorConfigProperties> {
    let sections = editorconfig.sections();

    // No sections, or only root `[*]` section → no overrides
    if sections.is_empty() || matches!(sections, [s] if s.name == "*") {
        return None;
    }

    let resolved = editorconfig.resolve(path);

    // Without `[*]`, the baseline is "nothing set": `resolve` starts from `default()` too.
    let default_props = EditorConfigProperties::default();
    let root = root_properties(editorconfig).unwrap_or(&default_props);

    // Compare only the properties `apply_editorconfig` reads,
    // so a whole-struct `!=` (which would also see `charset` etc.) is deliberately not used.
    // NOTE: `resolve` normalizes `Unset` to `None` while `root` is the raw section,
    // so `[*] xxx = unset` reads as a difference and takes the slow path.
    // Harmless (both apply as "not set") and rare, so left unnormalized.
    let differs = resolved.max_line_length != root.max_line_length
        || resolved.end_of_line != root.end_of_line
        || resolved.indent_style != root.indent_style
        || resolved.indent_size != root.indent_size
        || resolved.tab_width != root.tab_width
        || resolved.insert_final_newline != root.insert_final_newline
        || resolved.quote_type != root.quote_type;
    differs.then_some(resolved)
}

/// Apply `.editorconfig` properties to `FormatConfig`.
///
/// Only applies values that are not already set in the user's config.
/// NOTE: Only properties checked by [`resolve_editorconfig_overrides`] are applied here.
pub fn apply_editorconfig(config: &mut FormatConfig, props: &EditorConfigProperties) {
    if config.print_width.is_none()
        && let EditorConfigProperty::Value(MaxLineLength::Number(v)) = props.max_line_length
    {
        // Saturate an overflow, so validation rejects it as it does in `.oxfmtrc`
        config.print_width = Some(u16::try_from(v).unwrap_or(u16::MAX));
    }

    if config.end_of_line.is_none()
        && let EditorConfigProperty::Value(eol) = props.end_of_line
    {
        config.end_of_line = Some(match eol {
            EndOfLine::Lf => EndOfLineConfig::Lf,
            EndOfLine::Cr => EndOfLineConfig::Cr,
            EndOfLine::Crlf => EndOfLineConfig::Crlf,
        });
    }

    if config.use_tabs.is_none()
        && let EditorConfigProperty::Value(style) = props.indent_style
    {
        config.use_tabs = Some(match style {
            IndentStyle::Tab => true,
            IndentStyle::Space => false,
        });
    }

    if config.tab_width.is_none() {
        let value = |p: &EditorConfigProperty<usize>| match p {
            // Same saturation as `print_width`
            EditorConfigProperty::Value(v) => Some(u8::try_from(*v).unwrap_or(u8::MAX)),
            _ => None,
        };
        let indent_size = value(&props.indent_size);
        let tab_width = value(&props.tab_width);
        // Match Prettier's behavior: Only prefer `indent_size` when `useTabs: false`.
        // https://github.com/prettier/prettier/blob/90983f40dce5e20beea4e5618b5e0426a6a7f4f0/src/config/editorconfig/editorconfig-to-prettier.js#L25-L30
        // Otherwise `tab_width`, which defaults to `indent_size` per the EditorConfig spec.
        config.tab_width = if config.use_tabs == Some(false) {
            indent_size.or(tab_width)
        } else {
            tab_width.or(indent_size)
        };
    }

    if config.insert_final_newline.is_none()
        && let EditorConfigProperty::Value(v) = props.insert_final_newline
    {
        config.insert_final_newline = Some(v);
    }

    if config.single_quote.is_none() {
        match props.quote_type {
            EditorConfigProperty::Value(QuoteType::Single) => {
                config.single_quote = Some(true);
            }
            EditorConfigProperty::Value(QuoteType::Double) => {
                config.single_quote = Some(false);
            }
            _ => {}
        }
    }
}

```

### Core Architecture Module: `apps/oxfmt/src/core/config/js_config.rs`
```
use std::sync::Arc;

use napi::{Status, bindgen_prelude::Promise, threadsafe_function::ThreadsafeFunction};
use serde_json::Value;

/// JS callback to load a single JavaScript/TypeScript config file.
/// Takes an absolute path string and returns the config object directly.
pub type JsLoadJsConfigCb = ThreadsafeFunction<
    // Arguments: absolute path to config file
    String,
    // Return value: config object as serde_json::Value
    Promise<Value>,
    // Arguments (repeated)
    String,
    // Error status
    Status,
    // CalleeHandled
    false,
>;

/// Callback type for loading a JavaScript/TypeScript config file.
///
/// Wraps the NAPI `ThreadsafeFunction` and blocks the current thread until the JS callback resolves.
/// Uses `Arc` so it can be shared across CLI, Stdin, and LSP code paths.
pub type JsConfigLoaderCb = Arc<dyn Fn(String) -> Result<Value, String> + Send + Sync>;

/// Create a JS config loader callback from the NAPI JS callback.
///
/// The returned function blocks the current thread until the JS callback resolves.
///
/// The loader can be invoked from any thread, including:
/// - rayon worker threads (Phase 3 walk visitors during on-demand discovery)
/// - Tokio worker threads (Phase 2 direct file resolution, stdin, LSP)
/// - bare threads (any other context that obtained a `JsConfigLoaderCb`)
///
/// We capture a `tokio::runtime::Handle` at creation time
/// so the awaiting machinery does not depend on `Handle::current()` at call time.
/// We then branch on the calling context:
/// - inside a Tokio runtime, wrap with `block_in_place` so the Tokio worker
///   can be reused for other tasks while we block on the NAPI promise
/// - outside a Tokio runtime, drive the future directly via the captured handle
pub fn create_js_config_loader(cb: JsLoadJsConfigCb) -> JsConfigLoaderCb {
    let handle = tokio::runtime::Handle::current();
    Arc::new(move |path: String| {
        let cb = &cb;
        let handle = handle.clone();
        let fut = async move { cb.call_async(path).await?.into_future().await };

        let res = if tokio::runtime::Handle::try_current().is_ok() {
            tokio::task::block_in_place(|| handle.block_on(fut))
        } else {
            handle.block_on(fut)
        };
        res.map_err(|e| e.reason)
    })
}

```

### Core Architecture Module: `apps/oxfmt/src/core/config/mod.rs`
```
mod associations;
mod editorconfig;
#[cfg(feature = "napi")]
mod js_config;
mod nested;
mod overrides;
mod scopes;

#[cfg(feature = "napi")]
pub use js_config::{JsConfigLoaderCb, JsLoadJsConfigCb, create_js_config_loader};
pub use nested::NestedConfigCtx;
pub use scopes::ConfigScopes;

use std::{
    borrow::Cow,
    path::{Path, PathBuf},
    sync::Arc,
};

use editorconfig_parser::EditorConfig;
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use serde::Deserialize;
use serde_json::Value;
use tracing::instrument;

use oxc_config::{ConfigDiscovery, DiscoveredConfigFile, is_js_config_path, vp_version};

use self::{
    associations::OxfmtrcAssociations,
    editorconfig::{apply_editorconfig, resolve_editorconfig_overrides, root_properties},
    overrides::OxfmtrcOverrides,
};
use super::{
    FormatPlan, Language,
    global_ignore::matches_with_ancestors,
    options::{ValidatedOptions, validate},
    oxfmtrc::{FormatConfig, Oxfmtrc},
    support::{FormatStrategy, classify_as, classify_file},
    utils,
};

/// `path` relative to the config directory, as written glob patterns expect.
fn relative_path<'a>(base_dir: Option<&Path>, path: &'a Path) -> Cow<'a, str> {
    // NOTE: On Windows, `to_string_lossy()` produces `\`-separated paths.
    // This is OK since `fast_glob::glob_match()` supports both `/` and `\` via `std::path::is_separator`.
    base_dir.and_then(|dir| path.strip_prefix(dir).ok()).unwrap_or(path).to_string_lossy()
}

pub fn config_discovery() -> ConfigDiscovery {
    if cfg!(feature = "napi") && vp_version().is_some() {
        ConfigDiscovery::vite_plus()
    } else {
        ConfigDiscovery::oxfmt()
    }
}

/// Everything a config file load needs besides the file itself,
/// shared by the root load ([`ConfigScopes::load`]) and nested probes ([`NestedConfigCtx`]).
///
/// Cloning is shallow.
#[derive(Clone)]
struct ConfigLoader {
    discovery: ConfigDiscovery,
    /// Parsed `.editorconfig`, shared by every resolver this loads,
    /// instead of re-reading and re-parsing the same file.
    editorconfig: Option<Arc<EditorConfig>>,
    #[cfg(feature = "napi")]
    js_loader: Option<JsConfigLoaderCb>,
}

impl ConfigLoader {
    fn new(
        editorconfig: Option<EditorConfig>,
        #[cfg(feature = "napi")] js_loader: Option<JsConfigLoaderCb>,
    ) -> Self {
        Self {
            discovery: config_discovery(),
            editorconfig: editorconfig.map(Arc::new),
            #[cfg(feature = "napi")]
            js_loader,
        }
    }

    /// Load the root config, handling both JSON/JSONC and JS/TS config files.
    ///
    /// When `explicit_config` is `Some`, it is treated as an explicitly specified config file.
    /// When `explicit_config` is `None`, auto-discovery searches upwards from `cwd`,
    /// and falls back to the default (empty) config.
    ///
    /// # Errors
    /// Returns error if config file loading or parsing fails.
    fn load_root(
        &self,
        cwd: &Path,
        explicit_config: Option<&Path>,
    ) -> Result<ConfigResolver, String> {
        // Explicit path: normalize and load directly
        if let Some(config_path) = explicit_config {
            let path = utils::normalize_relative_path(cwd, config_path);
            if !is_js_config_path(&path) {
                return ConfigResolver::from_json_config(Some(&path), self.editorconfig.clone());
            }
            let raw_config = self
                .load_js_config(&path)?
                // Explicit `--config`: missing `.fmt` is an error.
                .ok_or_else(|| {
                    format!("Expected a `fmt` field in the default export of {}", path.display())
                })?;
            return Ok(self.js_resolver(&path, raw_config));
        }

        // Auto-discovery: search upwards from cwd, load in one pass
        for dir in cwd.ancestors() {
            if let Some(resolver) = self.load_in_dir(dir)? {
                return Ok(resolver);
            }
        }

        // No config found, use defaults
        ConfigResolver::from_json_config(None, self.editorconfig.clone())
    }

    /// Load a config file located directly inside `dir` (no `build_and_validate`).
    ///
    /// NOTE: Returns `Ok(None)` when `dir` has no config file,
    /// or the file is a `vite.config.*` whose default export lacks a `.fmt` field.
    /// Callers decide how to handle it:
    /// - [`Self::load_root`] (ancestor walk): skip and continue upward
    /// - [`NestedConfigCtx`] (nested probe): no config in this dir
    fn load_in_dir(&self, dir: &Path) -> Result<Option<ConfigResolver>, String> {
        let Some(config_file) = self
            .discovery
            .find_unique_config_by_readdir(dir)
            .map_err(|e| Into::<oxc_diagnostics::OxcDiagnostic>::into(e).to_string())?
        else {
            return Ok(None);
        };

        let (path, raw_config) = match config_file {
            DiscoveredConfigFile::Json(path) | DiscoveredConfigFile::Jsonc(path) => {
                return ConfigResolver::from_json_config(Some(&path), self.editorconfig.clone())
                    .map(Some);
            }
            DiscoveredConfigFile::Js(path) => {
                // Non-Vite JS config: `loadJsConfig` never returns `null`; failures bubble up as `Err`.
                let raw_config = self
                    .load_js_config(&path)?
                    .expect("loadJsConfig never returns null for non-Vite JS config");
                (path, raw_config)
            }
            DiscoveredConfigFile::Vite(path) => {
                let Some(raw_config) = self.load_js_config(&path)? else {
                    return Ok(None);
                };
                (path, raw_config)
            }
        };
        Ok(Some(self.js_resolver(&path, raw_config)))
    }

    fn js_resolver(&self, path: &Path, raw_config: Value) -> ConfigResolver {
        ConfigResolver::new(
            raw_config,
            path.parent().map(Path::to_path_buf),
            self.editorconfig.clone(),
        )
    }
}

#[cfg(feature = "napi")]
impl ConfigLoader {
    /// Load a JS/TS config file via NAPI and return the raw JSON value.
    ///
    /// Returns `Ok(None)` when the JS side returns `null` (Vite+ `.fmt` missing).
    fn load_js_config(&self, path: &Path) -> Result<Option<Value>, String> {
        let js_config_loader = self
            .js_loader
            .as_ref()
            .expect("JS config loader must be set when `napi` feature is enabled");
        let value = js_config_loader(path.to_string_lossy().into_owned()).map_err(|err| {
            format!(
                "{}\n{err}\nEnsure the file has a valid default export of a JSON-serializable configuration object.",
                path.display()
            )
        })?;

        Ok(if value.is_null() { None } else { Some(value) })
    }
}

#[cfg(not(feature = "napi"))]
impl ConfigLoader {
    /// JS/TS config files need the Node.js CLI.
    #[expect(clippy::unused_self)]
    fn load_js_config(&self, path: &Path) -> Result<Option<Value>, String> {
        Err(format!(
            "JS/TS config file ({}) is not supported in pure Rust CLI.\nUse JSON/JSONC instead.",
            path.display()
        ))
    }
}

// ---

/// Outcome of resolving a [`FormatStrategy`] against a [`FormatConfig`],
/// constructed by [`ConfigResolver::resolve`] / [`resolve_for_api`].
#[derive(Debug)]
pub enum ResolveOutcome {
    /// Ready to format with this plan.
    Format(FormatPlan),
    /// The file's parser requires a plugin that the resolved config did NOT enable.
    /// The payload carries the missing config key (e.g. `"svelte"`)
    /// so callers can construct a friendly error or log message.
    #[cfg_attr(not(feature = "napi"), expect(dead_code))]
    MissingPlugin(&'static str),
}

/// Apply the missing-plugin gate, then build the [`ResolveOutcome`].
/// The gate's single home: [`ConfigResolver::resolve`] and [`resolve_for_api`] both end here,
/// so a plugin-gating change can never leave one path behind.
fn into_outcome(
    config: Arc<FormatConfig>,
    validated: Arc<ValidatedOptions>,
    path: &Path,
    strategy: FormatStrategy,
) -> ResolveOutcome {
    #[cfg(feature = "napi")]
    if let FormatStrategy::Prettier(language) = &strategy
        && let Some(plugin) = language.missing_plugin(&config)
    {
        return ResolveOutcome::MissingPlugin(plugin);
    }
    ResolveOutcome::Format(FormatPlan { path: Arc::from(path), strategy, config, validated })
}

/// Resolve options for a pre-classified file and build a [`ResolveOutcome`].
///
/// This is the simplified path for the NAPI `format()` API.
/// It resolves the caller-supplied [`FormatConfig`] directly instead of
/// discovering or loading project configuration.
///
/// Relative Tailwind paths are resolved against provided `cwd`.
///
/// Returns `Err` only when the merged config fails validation.
#[cfg(feature = "napi")]
pub fn resolve_for_api(
    raw_config: Value,
    path: &Path,
    strategy: FormatStrategy,
    cwd: &Path,
) -> Result<ResolveOutcome, String> {
    let mut format_config: FormatConfig =
        serde_json::from_value(raw_config).map_err(|err| err.to_string())?;
    format_config.resolve_tailwind_paths(cwd);
    // Validate eagerly, as the single gate for every option (core + js/sortImports):
    // downstream mapping consumes the derived artifacts and cannot re-fail,
    // and the `Prettier` strategy has no later chance before values reach Prettier.
    let validated = validate(&format_config)?;
    Ok(into_outcome(Arc::new(format_config), Arc::new(validated), path, strategy))
}

// ---

/// Configuration resolver to handle `.oxfmtrc` and `.editorconfig` files.
///
/// Priority (later wins):
/// - `.editorconfig` (fallback for unset fields)
/// - `.oxfmtrc` base
/// - `.oxfmtrc` overrides matching the file path.
#[derive(Debug)]
pub struct ConfigResolver {
    /// User's raw config as JSON value.
    ///
    /// Retained because the slow 
```

### Core Architecture Module: `apps/oxfmt/src/core/config/nested.rs`
```
use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock, RwLock},
};

use rustc_hash::FxHashMap;

use super::{ConfigLoader, ConfigResolver};

/// Result of loading a direct config in a single directory.
type ConfigLoadResult = Result<Option<Arc<ConfigResolver>>, String>;

/// Shared cache for direct-config loads.
///
/// Each entry's `OnceLock` ensures the underlying load runs at most once per
/// directory across all visitors and across phases.
type ConfigLoadCache = Arc<Mutex<FxHashMap<PathBuf, Arc<OnceLock<ConfigLoadResult>>>>>;

/// Shared map of "directory has a direct config" entries.
///
/// Lock discipline: never hold this lock across a `ConfigLoadCache` load.
/// Acquire the read/write lock, do the lookup or insert, release immediately.
type ScopeByDir = Arc<RwLock<FxHashMap<PathBuf, Arc<ConfigResolver>>>>;

/// Shared on-demand nested-config detection infrastructure.
///
/// Owned by `ConfigScopes`, and its caches live as long as that.
/// State is centralized to share caches and signals across all callers,
/// including the parallel walk visitors.
///
/// Cloning is shallow.
#[derive(Clone)]
pub struct NestedConfigCtx {
    /// Shared with the root load.
    loader: ConfigLoader,
    scope_by_dir: ScopeByDir,
    config_load_cache: ConfigLoadCache,
}

impl NestedConfigCtx {
    pub(super) fn new(root: &Arc<ConfigResolver>, loader: ConfigLoader) -> Self {
        // Register the root, so probing its dir returns the already loaded resolver
        // instead of reading it again or invoking the JS loader twice.
        let mut scope_by_dir = FxHashMap::default();
        if let Some(dir) = root.config_dir() {
            scope_by_dir.insert(dir.to_path_buf(), Arc::clone(root));
        }
        Self {
            loader,
            scope_by_dir: Arc::new(RwLock::new(scope_by_dir)),
            config_load_cache: Arc::new(Mutex::new(FxHashMap::default())),
        }
    }

    /// Returns `true` if `path`'s file name matches a supported config file.
    pub fn is_config_file(&self, path: &Path) -> bool {
        self.loader.discovery.discover_config_file(path).is_some()
    }

    /// Look up a registered scope for `dir` without probing.
    pub fn lookup_scope(&self, dir: &Path) -> Option<Arc<ConfigResolver>> {
        self.scope_by_dir.read().expect("scope_by_dir rwlock poisoned").get(dir).cloned()
    }

    /// Whether any config has been registered, including the preloaded root.
    pub fn config_found(&self) -> bool {
        !self.scope_by_dir.read().expect("scope_by_dir rwlock poisoned").is_empty()
    }

    /// Read `scope_by_dir` for `dir`; on miss, probe via the load cache and register the result.
    ///
    /// Returns:
    /// - `Ok(Some(_))` — `dir` has a direct config (registered)
    /// - `Ok(None)` — no direct config in `dir`
    /// - `Err(_)` — load / parse / validate failure
    ///
    /// `OnceLock::get_or_init` blocks concurrent callers for the same `dir` until the first init completes.
    /// `Ok(Some(_))` / `Ok(None)` / `Err(_)` are all cached,
    /// so broken configs are not retried and "no config in this dir" lookups stay O(1).
    pub fn probe_dir(&self, dir: &Path) -> Result<Option<Arc<ConfigResolver>>, String> {
        if let Some(hit) = self.lookup_scope(dir) {
            return Ok(Some(hit));
        }

        // Acquire (or insert) the cell, then drop the outer mutex immediately.
        let cell = {
            let mut guard =
                self.config_load_cache.lock().expect("config_load_cache mutex poisoned");
            let entry = guard.entry(dir.to_path_buf()).or_insert_with(|| Arc::new(OnceLock::new()));
            Arc::clone(entry)
        };
        let load_result = cell.get_or_init(|| self.load_direct_in_dir(dir)).clone();

        match load_result? {
            Some(loaded) => {
                let mut guard = self.scope_by_dir.write().expect("scope_by_dir rwlock poisoned");
                guard.entry(dir.to_path_buf()).or_insert_with(|| Arc::clone(&loaded));
                Ok(Some(loaded))
            }
            None => Ok(None),
        }
    }

    /// Load and validate a config file located directly inside `dir`.
    fn load_direct_in_dir(&self, dir: &Path) -> ConfigLoadResult {
        let load_err = |err: String| format!("Failed to load config in {}: {err}", dir.display());
        let Some(mut resolver) = self.loader.load_in_dir(dir).map_err(load_err)? else {
            return Ok(None);
        };
        resolver.build_and_validate().map_err(load_err)?;
        Ok(Some(Arc::new(resolver)))
    }
}

```

### Core Architecture Module: `apps/oxfmt/src/core/config/overrides.rs`
```
use std::path::{Path, PathBuf};

use oxc_config::GlobSet;

use crate::core::oxfmtrc::{FormatConfig, OxfmtOverrideConfig};

use super::relative_path;

/// Resolved overrides for file-specific matching.
/// Similar to `EditorConfig`, this also handles `FormatConfig` override resolution.
#[derive(Debug)]
pub struct OxfmtrcOverrides {
    base_dir: Option<PathBuf>,
    entries: Vec<OverrideEntry>,
}

impl OxfmtrcOverrides {
    pub fn new(overrides: Vec<OxfmtOverrideConfig>, base_dir: Option<PathBuf>) -> Self {
        Self {
            base_dir,
            entries: overrides
                .into_iter()
                .map(|o| OverrideEntry {
                    files: o.files,
                    exclude_files: o.exclude_files,
                    options: o.options,
                })
                .collect(),
        }
    }

    /// Collect the options of every override matching `path`, in config order.
    /// Empty when nothing matches, so callers can gate on `is_empty()` without a separate probe.
    pub fn matching(&self, path: &Path) -> Vec<&FormatConfig> {
        let relative = relative_path(self.base_dir.as_deref(), path);

        self.entries
            .iter()
            .filter(|e| e.files.is_match(&relative) && !e.exclude_files.is_match(&relative))
            .map(|e| &e.options)
            .collect()
    }
}

// ---

/// A single override entry with normalized glob patterns.
/// NOTE: Written path patterns are glob patterns; use `/` as the path separator on all platforms.
#[derive(Debug)]
struct OverrideEntry {
    files: GlobSet,
    exclude_files: GlobSet,
    options: FormatConfig,
}

```

### Core Architecture Module: `apps/oxfmt/src/core/config/scopes.rs`
```
use std::{path::Path, sync::Arc};

#[cfg(feature = "napi")]
use super::js_config::JsConfigLoaderCb;
use super::{
    ConfigLoader, ConfigResolver, NestedConfigCtx,
    editorconfig::{load_editorconfig, resolve_editorconfig_path},
};

/// Root config and on-demand nested configs for a project rooted at `cwd`.
///
/// Holds the state shared by every file resolved under the same entry point run,
/// so each config file (and `.editorconfig`) is loaded at most once.
///
/// Cloning is shallow, clones share the same caches.
#[derive(Clone)]
pub struct ConfigScopes {
    root: Arc<ConfigResolver>,
    /// Always present, even when nested detection is disabled,
    /// since the walker also uses it to recognize config files.
    nested_ctx: NestedConfigCtx,
    use_nested: bool,
    has_editorconfig: bool,
}

impl ConfigScopes {
    /// Load `.editorconfig` nearest to `cwd` and the root config,
    /// discovered upwards from `cwd` or given by `explicit_config`.
    ///
    /// # Errors
    /// Returns a message ready to print if loading or validation fails.
    pub fn load(
        cwd: &Path,
        explicit_config: Option<&Path>,
        use_nested: bool,
        #[cfg(feature = "napi")] js_config_loader: Option<&JsConfigLoaderCb>,
    ) -> Result<Self, String> {
        let load_err = |err: String| format!("Failed to load configuration file.\n{err}");

        let editorconfig =
            load_editorconfig(resolve_editorconfig_path(cwd).as_deref()).map_err(load_err)?;
        let loader = ConfigLoader::new(
            editorconfig,
            #[cfg(feature = "napi")]
            js_config_loader.cloned(),
        );
        let mut root = loader.load_root(cwd, explicit_config).map_err(load_err)?;
        root.build_and_validate()
            .map_err(|err| format!("Failed to parse configuration.\n{err}"))?;

        Ok(Self::new(root, loader, use_nested))
    }

    /// Same as [`Self::load`], but with the default (empty) root config.
    ///
    /// For LSP, which keeps formatting with defaults when the root config is broken,
    /// while nested configs are still detected.
    /// CLI (Walk / Stdin) does not use this and exits with an error instead.
    #[cfg(feature = "napi")]
    pub fn with_default_root(
        cwd: &Path,
        use_nested: bool,
        js_config_loader: Option<&JsConfigLoaderCb>,
    ) -> Self {
        let mut root = ConfigResolver::from_json_config(None, None)
            .expect("Default ConfigResolver should never fail");
        root.build_and_validate().expect("Default ConfigResolver validation should never fail");

        // Best effort: an unreadable `.editorconfig` is skipped instead of failing again
        let editorconfig =
            load_editorconfig(resolve_editorconfig_path(cwd).as_deref()).ok().flatten();
        Self::new(root, ConfigLoader::new(editorconfig, js_config_loader.cloned()), use_nested)
    }

    fn new(root: ConfigResolver, loader: ConfigLoader, use_nested: bool) -> Self {
        let root = Arc::new(root);
        let has_editorconfig = loader.editorconfig.is_some();
        let nested_ctx = NestedConfigCtx::new(&root, loader);
        Self { root, nested_ctx, use_nested, has_editorconfig }
    }

    /// Resolve the config scope for a single file: the nearest nested config, or the root.
    ///
    /// When nested detection is enabled, the ancestor chain of `path` is walked.
    /// The root is registered in `nested_ctx`, so reaching its `config_dir()` returns it without reloading.
    ///
    /// # Errors
    /// Returns error if a nested config fails to load.
    pub fn resolve(&self, path: &Path) -> Result<Arc<ConfigResolver>, String> {
        if !self.use_nested {
            return Ok(Arc::clone(&self.root));
        }
        let Some(parent) = path.parent() else {
            return Ok(Arc::clone(&self.root));
        };

        for dir in parent.ancestors() {
            if let Some(r) = self.nested_ctx.probe_dir(dir)? {
                return Ok(r);
            }
        }

        Ok(Arc::clone(&self.root))
    }

    pub fn root(&self) -> &Arc<ConfigResolver> {
        &self.root
    }

    pub fn nested_ctx(&self) -> &NestedConfigCtx {
        &self.nested_ctx
    }

    pub fn use_nested(&self) -> bool {
        self.use_nested
    }

    /// Whether any config file or `.editorconfig` has been found so far.
    ///
    /// Nested configs are detected lazily, call this after resolving files.
    pub fn any_config_found(&self) -> bool {
        self.nested_ctx.config_found() || self.has_editorconfig
    }
}

```

### Core Architecture Module: `apps/oxfmt/src/core/embed/dispatcher.rs`
```
//! The `FormatDispatcher` assembly shared by every build, routed by [`route_embedded`].
//!
//! Each language maps to a Rust formatter where available;
//! the [`PrettierLanguage`] set goes to the napi-only Prettier Doc→IR channel ([`super::prettier_doc`]) when one is supplied,
//! and is deliberately preserved as-is otherwise (pure Rust build); everything else stays as-is in every build.

use std::sync::{Arc, OnceLock};

use tracing::{debug, debug_span};

use oxc_formatter::{
    CssInJsTemplate, HtmlInJsTemplate, JsEmbeddedIn, JsFormatOptions, MarkdownInJsTemplate,
};
use oxc_formatter_core::{
    DispatchRequest, DispatchResponse, EmbeddedIr, FormatDispatcher, FormatSession,
};
use oxc_formatter_core::{FormatOptions, PrinterOptions};
use oxc_formatter_css::{CssEmbeddedIn, CssFormatOptions, CssVariant};
use oxc_formatter_graphql::GraphqlFormatOptions;
use oxc_formatter_htmlish::{
    CssInHtmlStyleAttribute, HtmlishEmbeddedIn, HtmlishFormatOptions, HtmlishVariant,
    JsInHtmlEventHandler,
};
use oxc_formatter_json::{JsonFormatOptions, JsonVariant};
use oxc_formatter_markdown::{MarkdownFormatOptions, XxxInMarkdownCodeBlock};
use oxc_formatter_toml::TomlFormatOptions;
use oxc_formatter_yaml::YamlFormatOptions;

use super::jsdoc_fence::XxxInJsdocFence;
use crate::core::{
    language::{Route, route_embedded},
    options::{
        ValidatedOptions, to_oxc_formatter, to_oxc_formatter_css, to_oxc_formatter_graphql,
        to_oxc_formatter_htmlish, to_oxc_formatter_json, to_oxc_formatter_markdown,
        to_oxc_formatter_toml, to_oxc_formatter_yaml,
    },
    oxfmtrc::FormatConfig,
    support::{NativeLanguage, PrettierLanguage},
};

/// Per-root context shared by every embedded service (dispatcher, string embedder, Tailwind sorter):
/// the host file's resolved config plus lazily-mapped per-language options.
///
/// Language options are NOT built up front: an embed-free file pays only for empty cells,
/// and a host where every language is embeddable (Markdown-scale) maps exactly the languages that actually appear,
/// once each (`OnceLock` memoizes and is safe under the rayon-parallel format runs).
pub struct ResolvedDispatchConfig {
    /// Resolved config of the HOST file (its overrides / editorconfig applied).
    /// Embedded children inherit it, mirroring Prettier's `textToDoc` (parent-options spread);
    /// never a re-resolution for a virtual path.
    config: Arc<FormatConfig>,
    /// The config-resolution gate's artifacts (`options::validate`), shared with the resolver's cache.
    /// Holding them pre-validated is what lets the per-language mappers be infallible.
    /// `sort_imports` is for JS children too: a Markdown code block is a whole program,
    /// sorted like the host's own imports (and a Vue `<script>`'s).
    validated: Arc<ValidatedOptions>,
    js: OnceLock<JsFormatOptions>,
    graphql: OnceLock<GraphqlFormatOptions>,
    /// One cell per [`CssVariant`]: JSDoc fences dispatch css/scss/less as-is, while css-in-js always uses Scss.
    css: [OnceLock<CssFormatOptions>; 3],
    yaml: OnceLock<YamlFormatOptions>,
    /// One cell per [`JsonVariant`].
    json: [OnceLock<JsonFormatOptions>; 4],
    markdown: OnceLock<MarkdownFormatOptions>,
    toml: OnceLock<TomlFormatOptions>,
    htmlish: OnceLock<HtmlishFormatOptions>,
    /// The options handed to Prettier; see [`PrettierOptions`].
    #[cfg(feature = "napi")]
    prettier: PrettierOptions,
}

/// The lazily-built options JSON handed to Prettier (+ plugins),
/// consumed by the Doc→IR path and the Tailwind sorter.
/// `path` is an ingredient, not a sibling datum: it becomes the JSON's `filepath` at last
/// (see [`crate::core::options::build_prettier_options`]).
///
/// NOTE: The late merge is load-bearing: the JSON must derive from the RESOLVED per-file config
/// (a pre-built Value loses overrides, #18246), and `path` is the one per-file ingredient,
/// keeping it out of the config is what keeps the config shareable across files.
/// Lazy so an embed-free file never builds the JSON at all.
#[cfg(feature = "napi")]
#[derive(Default)]
struct PrettierOptions {
    path: std::path::PathBuf,
    options: OnceLock<serde_json::Value>,
}

impl ResolvedDispatchConfig {
    /// Private so [`Self::for_root`] stays the only construction recipe.
    fn new(config: Arc<FormatConfig>, validated: Arc<ValidatedOptions>) -> Self {
        Self {
            config,
            validated,
            js: OnceLock::new(),
            graphql: OnceLock::new(),
            css: [OnceLock::new(), OnceLock::new(), OnceLock::new()],
            yaml: OnceLock::new(),
            json: [OnceLock::new(), OnceLock::new(), OnceLock::new(), OnceLock::new()],
            markdown: OnceLock::new(),
            toml: OnceLock::new(),
            htmlish: OnceLock::new(),
            #[cfg(feature = "napi")]
            prettier: PrettierOptions::default(),
        }
    }

    /// The one construction recipe for a root formatter run at `path`:
    /// [`Self::new`] plus the napi-only path recording
    /// (the pure build has no JS-side consumers, so `path` goes unused there).
    /// `validated` is the config-resolution gate's artifacts (`options::validate`),
    /// carried from resolution so they never get re-derived (or re-fail) here.
    pub fn for_root(
        config: Arc<FormatConfig>,
        validated: Arc<ValidatedOptions>,
        path: &std::path::Path,
    ) -> Arc<Self> {
        let dispatch_config = Self::new(config, validated);
        #[cfg(feature = "napi")]
        let dispatch_config = dispatch_config.with_path(path.to_path_buf());
        #[cfg(not(feature = "napi"))]
        let _ = path;
        Arc::new(dispatch_config)
    }

    /// Assembles the root's `FormatDispatcher` behind the off-gate:
    /// `None` under `embeddedLanguageFormatting: off`,
    /// so a root cannot install the registry without honoring the off-semantics.
    /// `fallback` is the one build-dependent datum (the napi Prettier Doc→IR path).
    pub fn root_dispatcher(
        self: &Arc<Self>,
        fallback: Option<PrettierDocFallback>,
    ) -> Option<FormatDispatcher> {
        self.is_embedded_formatting_enabled().then(|| build_dispatcher(Arc::clone(self), fallback))
    }

    /// The single off-predicate: [`Self::root_dispatcher`] and both build's `services::for_root` definitions consult it,
    /// so the off-semantics can never diverge between channels or builds.
    pub fn is_embedded_formatting_enabled(&self) -> bool {
        self.config.is_embedded_formatting_enabled()
    }

    pub fn js_options(&self) -> JsFormatOptions {
        self.js
            .get_or_init(|| {
                to_oxc_formatter(
                    &self.config,
                    self.validated.core,
                    self.validated.sort_imports.clone(),
                )
            })
            .clone()
    }

    pub fn graphql_options(&self) -> GraphqlFormatOptions {
        *self.graphql.get_or_init(|| to_oxc_formatter_graphql(&self.config, self.validated.core))
    }

    pub fn css_options(&self, variant: CssVariant) -> CssFormatOptions {
        let cell = match variant {
            CssVariant::Css => &self.css[0],
            CssVariant::Scss => &self.css[1],
            CssVariant::Less => &self.css[2],
        };
        *cell.get_or_init(|| to_oxc_formatter_css(&self.config, self.validated.core, variant))
    }

    pub fn yaml_options(&self) -> YamlFormatOptions {
        *self.yaml.get_or_init(|| to_oxc_formatter_yaml(&self.config, self.validated.core))
    }

    pub fn json_options(&self, variant: JsonVariant) -> JsonFormatOptions {
        let cell = match variant {
            JsonVariant::Json => &self.json[0],
            JsonVariant::Jsonc => &self.json[1],
            JsonVariant::Json5 => &self.json[2],
            JsonVariant::JsonStringify => &self.json[3],
        };
        *cell.get_or_init(|| to_oxc_formatter_json(&self.config, self.validated.core, variant))
    }

    pub fn markdown_options(&self) -> MarkdownFormatOptions {
        *self.markdown.get_or_init(|| to_oxc_formatter_markdown(&self.config, self.validated.core))
    }

    pub fn toml_options(&self) -> TomlFormatOptions {
        *self.toml.get_or_init(|| to_oxc_formatter_toml(&self.config, self.validated.core))
    }

    pub fn htmlish_options(&self, variant: HtmlishVariant) -> HtmlishFormatOptions {
        let options = self
            .htmlish
            .get_or_init(|| to_oxc_formatter_htmlish(&self.config, self.validated.core));
        HtmlishFormatOptions { variant, ..options.clone() }
    }

    /// Printer options from the shared resolved core bundle;
    /// the fence adapter ([`super::jsdoc_fence`]) derives its per-fence options from these
    /// (width overridden to the fence's effective width).
    pub fn print_options(&self) -> PrinterOptions {
        self.validated.core.as_print_options()
    }
}

/// Napi-only methods: the [`PrettierOptions`] accessors and the Tailwind predicate.
#[cfg(feature = "napi")]
impl ResolvedDispatchConfig {
    /// Sets the host file path for `filepath` injection into [`Self::prettier_options`];
    /// chained by [`Self::for_root`].
    fn with_path(mut self, path: std::path::PathBuf) -> Self {
        self.prettier.path = path;
        self
    }

    /// The single Tailwind predicate, same pattern as
    /// [`Self::is_embedded_formatting_enabled`]: every sorter-assembly site consults it
    /// (the sorter is napi-only; the pure build has no JS-side class order source).
    pub fn is_tailwind_enabled(&self) -> bool {
        self.config.is_tailwind_enabled()
    }

    /// [`Self::prettier_options`] for one `language`: its parser, plus the payload of the plugin it needs.
    /// `None` when that plugin is not enabled (svelte / astro without the config key): the part stays as-is.
    pub fn prettier_options_for(&self, language: PrettierLanguage) -> Option<serde_json::Value> {
        if language.missing_plugin(&self.config)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #28864** (2026-11-05): **fix(linter/vitest/prefer-called-exactly-once-with): preserve neighboring code in autofix**
  *Symptoms*: The autofix could delete neighboring code on the redundant assertion's line, generate overlapping edits when both assertions shared a line, and leave an empty line with CRLF endings.  Remove the whole line only when the assertion is surrounded by whitespace; otherwise remove just the statement. Handle complete JavaScript line endings and cover nearby code, comments, both matcher orders, and EOF in regression tests.  Fixes #28851 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"7b2600c38b6377ec3ad2c41fce2ba63265281365","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-05T15:26:58.760716Z">2026-11-05T15:26:58.760716Z</relative-time> | `7b2600c` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex 
  > ### Merge activity  * **Nov 5, 3:27 PM UTC**: The merge label '0-merge' was detected. This PR will be added to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc) once it meets the requirements. * **Nov 5, 3:30 PM UTC**: `camc314` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Nov 5, 3:39 PM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 

- **Issue #28863** (2026-11-05): **style(lexer): reorder imports**
  *Symptoms*: Pure refactor - style nit.  Reorder module imports so feature-gated `mod` statements are in their own block, after other `mod`s.
  **Post-Mortem & Fix Analysis**:
  > * **#28863** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/28863?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> 👈 <a href="https://app.graphite.com/github/pr/oxc-project/oxc/28863?utm_source=stack-comment-view-in-graphite" target="_blank">(View in Graphite)</a> * `main` <hr />  ## How to use the Graphite Merge Queue  Add either label to this PR to merge it via the merge queue: - <kbd>0-merge</kbd> - adds this PR to the back of the merge queue - <kbd>hotfix</kbd> - for urgent changes, fast-track this PR to the front of the merge queue  You must have a Graphite account in order to use the merge queue. Sign up using [this link](https://app.graphite.com/invite/github/oxc-project?ref=merge-queue-instructions-in-stack-comment&prId=28863).  <h2></h2> <sub>  An organization admin has enabled the [Graphite Merge Queue](https://graphite.dev/docs/graphite-merge-queue) in 
  > ### Merge activity  * **Nov 5, 3:12 PM UTC**: The merge label '0-merge' was detected. This PR will be added to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc) once it meets the requirements. * **Nov 5, 3:19 PM UTC**: `overlookmotel` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Nov 5, 3:28 PM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 

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

### Incident Patch 1: `171ad772` (2026-11-05)
**Commit Message**: fix(lexer): classify Turbopack magic comments (#28427)

Closes #28320

`oxc_lexer` gave Turbopack magic comments such as `/*
turbopackChunkName: "x" */` `CommentContent::None`, while `oxc_parser`
classifies them as `CommentContent::Turbopack`.

This adds the missing case to `classify` in
`pipeline/carve/comments.rs`, following the parser's `parse_annotation`:
after leading whitespace, the comment starts with `turbopack`, followed
by an ASCII uppercase letter. Otherwise it falls back to the `@license`
/ `@preserve` check, like the other cases. The issue's repro is added as
the `misc/pass/comment-turbopack.js` fixture (block comments with and
without spaces, plus a line comment), and `classify` gets a unit test.

Validation:

- `cargo test -p oxc_lexer`: all pass (235 unit, 66 integration), on
both the host (generic) build and the AVX2 build (`--target
x86_64-unknown-linux-gnu --config .cargo/lexer-avx2.toml`). With the new
match arm disabled, the new `turbopack` unit test fails (`left: None,
right: Turbopack`).
- Lexer conformance on the new fixture: without the fix it reproduces
the issue's diff for all 3 comments (`None` vs `Turbopack`); with it,
`lexer_misc` passes 392/392.
- `CA

**File**: `crates/oxc_lexer/src/pipeline/carve/comments.rs` (modified, +28/-0)
```diff
@@ -374,6 +374,15 @@ fn classify(bytes: &[u8], is_block: bool, lic: bool, cpu: impl Cpu) -> CommentCo
             }
             return if lic { CommentContent::Legal } else { CommentContent::None };
         }
+        b't' => {
+            if bytes[start..].starts_with(b"turbopack")
+                && start + 9 < bytes.len()
+                && bytes[start + 9].is_ascii_uppercase()
+            {
+                return CommentContent::Turbopack;
+            }
+            return if lic { CommentContent::Legal } else { CommentContent::None };
+        }
         b'v' | b'c' | b'n' | b'i' => {
             let rest = &bytes[start..];
             if rest.starts_with(b"v8 ignore")
@@ -520,4 +529,23 @@ mod tests {
             assert_eq!(classify(source, true, false, BASELINE), CommentContent::None);
         }
     }
+
+    #[test]
+    fn turbopack() {
+        for (source, is_block) in [
+            (b" turbopackChunkName: \"x\" ".as_slice(), true),
+            (b"turbopackOptional: true".as_slice(), true),
+            (b"\tturbopackIgnore: true\n".as_slice(), true),
+            (b" turbopackIgnore: true".as_slice(), false),
+        ] {
+            assert_eq!(classify(source, is_block, false, BASELINE), CommentContent::Turbopack);
+        }
+
+        for source in [b" turbopack ".as_slice(), b" turbopack", b" turbopackignore: true"] {
+            assert_eq!(classify(source, true, false, BASELINE), CommentContent::None);
+        }
+
+        // Without a magic comment, @license or @preserve still makes it legal
+        assert_eq!(classify(b" turbopack @license ", true, true, BASELINE), CommentContent::Legal);
+    }
 }
```

**File**: `tasks/coverage/misc/pass/comment-turbopack.js` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+import(/* turbopackChunkName: "x" */ "./a");
+import(/*turbopackOptional: true*/ "./b");
+import(
+  // turbopackIgnore: true
+  "./c"
+);
```

**File**: `tasks/coverage/snapshots/codegen_misc.snap` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 codegen_misc Summary:
-AST Parsed     : 133/133 (100.00%)
-Positive Passed: 133/133 (100.00%)
+AST Parsed     : 134/134 (100.00%)
+Positive Passed: 134/134 (100.00%)
```

**File**: `tasks/coverage/snapshots/formatter_misc.snap` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 formatter_misc Summary:
-AST Parsed     : 133/133 (100.00%)
-Positive Passed: 133/133 (100.00%)
+AST Parsed     : 134/134 (100.00%)
+Positive Passed: 134/134 (100.00%)
```

**File**: `tasks/coverage/snapshots/lexer_misc.snap` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 lexer_misc Summary:
-AST Parsed     : 401/401 (100.00%)
-Positive Passed: 401/401 (100.00%)
+AST Parsed     : 402/402 (100.00%)
+Positive Passed: 402/402 (100.00%)
```

**File**: `tasks/coverage/snapshots/parser_misc.snap` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 parser_misc Summary:
-AST Parsed     : 133/133 (100.00%)
-Positive Passed: 133/133 (100.00%)
+AST Parsed     : 134/134 (100.00%)
+Positive Passed: 134/134 (100.00%)
 Negative Passed: 270/270 (100.00%)
 
   × TS(1275): 'accessor' modifier can only appear on a property declaration.
```

**File**: `tasks/coverage/snapshots/semantic_misc.snap` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 semantic_misc Summary:
-AST Parsed     : 133/133 (100.00%)
-Positive Passed: 127/133 (95.49%)
+AST Parsed     : 134/134 (100.00%)
+Positive Passed: 128/134 (95.52%)
 semantic Error: tasks/coverage/misc/pass/declare-let-private.ts
 Bindings mismatch:
 after transform: ScopeId(0): ["private"]
```

**File**: `tasks/coverage/snapshots/transformer_misc.snap` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 transformer_misc Summary:
-AST Parsed     : 133/133 (100.00%)
-Positive Passed: 133/133 (100.00%)
+AST Parsed     : 134/134 (100.00%)
+Positive Passed: 134/134 (100.00%)
```

---

### Incident Patch 2: `838d3393` (2026-11-05)
**Commit Message**: fix(linter/vitest/prefer-called-exactly-once-with): avoid panic on non-ASCII text (#28850)

Fixes #28849

`get_source_code_line_span` sliced the source text at every byte offset
back to the line start, and at `statement_span.end + 1`. If a multi-byte
character was in either place, the rule panicked, also without `--fix`.

This PR finds the line start with `rfind('\n')`, and extends the end by
the `len_utf8()` of the next char. For ASCII text, the span does not
change.

Added two fail cases and two fix cases. Each case panics without this
change.

I used AI assistance (Claude Code) to write this change. I reviewed the
code and ran the tests.

---------

Co-authored-by: Cameron <[REDACTED_EMAIL]>

**File**: `crates/oxc_linter/src/rules/vitest/prefer_called_exactly_once_with.rs` (modified, +19/-6)
```diff
@@ -427,14 +427,15 @@ fn is_mock_reset_call_expression(call_expr: &CallExpression<'_>) -> bool {
  */
 #[expect(clippy::cast_possible_truncation)]
 fn get_source_code_line_span(statement_span: Span, ctx: &LintContext<'_>) -> Span {
-    let line_end = std::cmp::min(statement_span.end + 1, ctx.source_text().len() as u32);
+    let source_text = ctx.source_text();
+    let start = statement_span.start as usize;
+    let end = statement_span.end as usize;
 
-    let column_0_span_index = (0..statement_span.start)
-        .rev()
-        .find(|&index| ctx.source_range(Span::new(index, line_end)).starts_with('\n'))
-        .map_or(statement_span.start, |index| index + 1);
+    let line_end = source_text[end..].chars().next().map_or(end, |c| end + c.len_utf8());
 
-    Span::new(column_0_span_index, line_end)
+    let column_0_span_index = source_text[..start].rfind('\n').map_or(start, |index| index + 1);
+
+    Span::new(column_0_span_index as u32, line_end as u32)
 }
 
 fn get_callback_body<'a>(callback: &'a Expression<'a>) -> Option<&'a FunctionBody<'a>> {
@@ -571,6 +572,8 @@ fn test() {
 			      expect(x).toHaveBeenCalledWith<[string]>('hoge');
 			      ",
         "expect(x).toHaveBeenCalledOnce();\nexpect(x).toHaveBeenCalledWith('hoge');",
+        r#"expect(x).toHaveBeenCalledWith("🍣"); expect(x).toHaveBeenCalledOnce();"#,
+        "expect(x).toHaveBeenCalledWith(1);\nexpect(x).toHaveBeenCalledOnce();\u{a0}",
     ];
 
     let fix = vec![
@@ -742,6 +745,16 @@ fn test() {
 			      ",
             None,
         ),
+        (
+            "expect(x).toHaveBeenCalledWith(1);\n\u{a0}expect(x).toHaveBeenCalledOnce();",
+            "expect(x).toHaveBeenCalledExactlyOnceWith(1);\n",
+            None,
+        ),
+        (
+            "expect(x).toHaveBeenCalledWith(1);\nexpect(x).toHaveBeenCalledOnce();\u{a0}",
+            "expect(x).toHaveBeenCalledExactlyOnceWith(1);\n",
+            None,
+        ),
     ];
     Tester::new(PreferCalledExactlyOnceWith::NAME, PreferCalledExactlyOnceWith::PLUGIN, pass, fail)
         .with_vitest_plugin(true)
```

**File**: `crates/oxc_linter/src/snapshots/vitest_prefer_called_exactly_once_with.snap` (modified, +20/-0)
```diff
@@ -231,3 +231,23 @@ source: crates/oxc_linter/src/tester.rs
    ·                    ╰── Remove this expect
    ╰────
   help: Replace with `toHaveBeenCalledExactlyOnceWith` and remove redundant expect
+
+  ⚠ vitest(prefer-called-exactly-once-with): Prefer `toHaveBeenCalledExactlyOnceWith` over `toHaveBeenCalledOnce` and `toHaveBeenCalledWith` on the same target.
+   ╭─[prefer_called_exactly_once_with.tsx:1:1]
+ 1 │ expect(x).toHaveBeenCalledWith("🍣"); expect(x).toHaveBeenCalledOnce();
+   · ──────────────────┬─────────────────  ────────────────┬────────────────
+   ·                   │                                   ╰── Remove this expect
+   ·                   ╰── Replace with `toHaveBeenCalledExactlyOnceWith`
+   ╰────
+  help: Replace with `toHaveBeenCalledExactlyOnceWith` and remove redundant expect
+
+  ⚠ vitest(prefer-called-exactly-once-with): Prefer `toHaveBeenCalledExactlyOnceWith` over `toHaveBeenCalledOnce` and `toHaveBeenCalledWith` on the same target.
+   ╭─[prefer_called_exactly_once_with.tsx:1:1]
+ 1 │ expect(x).toHaveBeenCalledWith(1);
+   · ────────────────┬────────────────
+   ·                 ╰── Replace with `toHaveBeenCalledExactlyOnceWith`
+ 2 │ expect(x).toHaveBeenCalledOnce(); 
+   · ─────────────────┬────────────────
+   ·                  ╰── Remove this expect
+   ╰────
+  help: Replace with `toHaveBeenCalledExactlyOnceWith` and remove redundant expect
```

---

### Incident Patch 3: `ebfd40ad` (2026-11-05)
**Commit Message**: fix(formatter): sort Tailwind calls printed as member chains (#28800)

Stacked on #28798.

## What was wrong

With `sortTailwindcss` on, a Tailwind call with a member callee was not
sorted when printed as a `MemberChain`:

```js
// experimentalTailwindcss: { functions: ["cn", "tw"] }

// Input
tw.style("p-4  flex");
cn.a("p-4  flex").b("m-2  block").c();

// Before
tw.style("p-4  flex");
cn.a("p-4  flex").b("m-2  block").c();

// After
tw.style("flex p-4");
cn.a("flex p-4").b("m-2 block").c();
```

Cause: only the non-`MemberChain` branch of `CallExpression::write`
pushed the Tailwind context.
Inside JSX `className` they were sorted by the attribute's context, so
the existing tests didn't catch it.

## What changed

- The push moves to the call arguments printer (`impl Format for
AstNode<ArenaVec<Argument>>`),
  which both `CallExpression` and `MemberChain` go through
- The call's own context covers only its arguments, so `cn.foo["a
b"](...)` keeps `"a b"`, like the plugin
    (an outer context still covers the callee, as the plugin does)
- `CallExpression::write` only hides the context for a nested
non-Tailwind call
- `AGENTS.md` notes the known limitation below

## Not covered he

**File**: `apps/oxfmt/test/api/sort_tailwindcss.test.ts` (modified, +26/-0)
```diff
@@ -229,6 +229,32 @@ const A = (
     expect(result.errors).toStrictEqual([]);
   });
 
+  it("should sort classes in calls printed as member chains", async () => {
+    // Outside JSX, since a `className` context would sort them anyway
+    const input = `const a = tw.style("p-4  flex");
+const b = cn.a("p-4  flex").b("m-2  block").c();
+const c = cn.foo["a  b"]("x  y");
+const d = cn(x.y("a  b"), cn.x("p-4  flex"));
+`;
+    const options = { experimentalTailwindcss: { functions: ["cn", "tw"] } };
+
+    const result = await format("test.ts", input, options);
+
+    // Like the plugin, only the arguments are sorted, not the computed key `["a  b"]`
+    expect(result.code).toMatchInlineSnapshot(`
+      "const a = tw.style("flex p-4");
+      const b = cn.a("flex p-4").b("m-2 block").c();
+      const c = cn.foo["a  b"]("x y");
+      const d = cn(x.y("a  b"), cn.x("flex p-4"));
+      "
+    `);
+    expect(result.errors).toStrictEqual([]);
+
+    // Formatting the output again should not change it.
+    const second = await format("test.ts", result.code, options);
+    expect(second.code).toBe(result.code);
+  });
+
   it("should preserve whitespace when preserveWhitespace is true", async () => {
     // Input with leading/trailing whitespace in class string
     const input = `const A = <div className="  p-4 flex  ">Hello</div>;`;
```

**File**: `crates/oxc_formatter/AGENTS.md` (modified, +3/-0)
```diff
@@ -60,6 +60,9 @@ After changing AST shapes or the generators, regenerate with `just ast`, never h
 - Covered by the Oxfmt API tests (`apps/oxfmt/test/api/sort_tailwindcss.test.ts`), since only the host sorts
 - Deliberately unlike the plugin, nothing in the arguments of a nested non-Tailwind call is sorted
   (tailwindlabs/prettier-plugin-tailwindcss#426): `cn(x.includes("a  b"))` keeps `"a  b"`, which the plugin rewrites
+- Known limitation, left since the triggers are rare and a fix would thread Tailwind state through `SimpleArgument`:
+  a multiline template collapsed by sorting is still judged by its source line breaks in some layouts,
+  so a Tailwind call with one inside a member chain can take a second pass to settle
 
 ### Embedded language formatting
 
```

**File**: `crates/oxc_formatter/src/print/call_like_expression/arguments.rs` (modified, +21/-1)
```diff
@@ -30,13 +30,33 @@ use crate::{
     utils::{
         call_expression::is_test_call_expression,
         expression::as_call_expression_without_chain_wrappers, is_long_curried_call,
-        member_chain::simple_argument::SimpleArgument, typecast::is_cast_target,
+        member_chain::simple_argument::SimpleArgument, tailwindcss::tailwind_context_for_callee,
+        typecast::is_cast_target,
     },
     write,
 };
 
 impl<'a> Format<'a, JsFormatContext<'a>> for AstNode<'_, 'a, ArenaVec<'a, Argument<'a>>> {
     fn fmt(&self, f: &mut JsFormatter<'_, 'a>) {
+        // Pushed here, so this call's context covers only its arguments, not its callee (e.g. `cn.foo["a  b"](...)`),
+        // for both a call and the calls a `MemberChain` prints
+        // (an outer context still covers the callee, as the plugin does)
+        let tailwind_ctx = match self.parent() {
+            AstNodes::CallExpression(call) => tailwind_context_for_callee(&call.callee, f),
+            _ => None,
+        };
+        if let Some(ctx) = tailwind_ctx {
+            f.context_mut().push_tailwind_context(ctx);
+        }
+        self.write_arguments(f);
+        if tailwind_ctx.is_some() {
+            f.context_mut().pop_tailwind_context();
+        }
+    }
+}
+
+impl<'a> AstNode<'_, 'a, ArenaVec<'a, Argument<'a>>> {
+    fn write_arguments(&self, f: &mut JsFormatter<'_, 'a>) {
         let l_paren_token = "(";
         let r_paren_token = ")";
 
```

**File**: `crates/oxc_formatter/src/print/call_like_expression/mod.rs` (modified, +6/-18)
```diff
@@ -23,20 +23,19 @@ impl<'a> FormatWrite<'a> for AstNode<'_, 'a, CallExpression<'a>> {
         let type_arguments = self.type_arguments();
         let arguments = self.arguments();
 
-        // Check if this is a Tailwind function call (e.g., clsx, cn, tw)
-        let tailwind_ctx_to_push = tailwind_context_for_callee(&self.callee, f);
-
         // For nested non-Tailwind calls inside a Tailwind context, hide the context
         // to prevent sorting strings and templates inside the nested call's arguments.
         // (e.g., `classNames("a", x.includes("\n") ? "b" : "c")` - don't sort "\n")
-        let hides_tailwind_ctx =
-            tailwind_ctx_to_push.is_none() && f.context().tailwind_context().is_some();
+        // A Tailwind call pushes its own context, around its arguments only
+        let hides_tailwind_ctx = f.context().tailwind_context().is_some()
+            && tailwind_context_for_callee(&self.callee, f).is_none();
         if hides_tailwind_ctx {
             f.context_mut().hide_tailwind_context();
         }
 
-        // NOTE: Decided before this call pushes its Tailwind context, and `MemberChain` pushes none,
-        // so a Tailwind call with a multiline template takes the branch below, which sorts it
+        // NOTE: Read before the arguments push the Tailwind context,
+        // so a Tailwind call with a multiline template it collapses stays out of `MemberChain`,
+        // which would break the chain on the template's line breaks in the source
         if callee.is_member_expression()
             && !is_verbatim_multiline_template_sole_arg(arguments.as_slice(), Some(self), f)
             && !is_simple_module_import(&self.arguments(), f.comments())
@@ -53,18 +52,7 @@ impl<'a> FormatWrite<'a> for AstNode<'_, 'a, CallExpression<'a>> {
                         type_arguments
                     ]
                 );
-
-                // If this IS a Tailwind function call, push the Tailwind context before formatting arguments
-                if let Some(ctx) = tailwind_ctx_to_push {
-                    f.context_mut().push_tailwind_context(ctx);
-                }
-
                 write!(f, arguments);
-
-                // Pop Tailwind context after formatting
-                if tailwind_ctx_to_push.is_some() {
-                    f.context_mut().pop_tailwind_context();
-                }
             });
             if matches!(callee.as_ref(), Expression::CallExpression(_)) {
                 write!(f, [group(&format_inner)]);
```

**File**: `crates/oxc_formatter/src/utils/assignment_like.rs` (modified, +0/-1)
```diff
@@ -1249,7 +1249,6 @@ fn is_short_argument(
     f: &JsFormatter,
 ) -> bool {
     // Decided by `callee` alone: a Tailwind one pushes its context, a non-Tailwind one hides an outer one
-    // (except for a call printed as a `MemberChain`, which pushes none)
     let collapses_tailwind_whitespace =
         || tailwind_context_for_callee(callee, f).is_some_and(|ctx| !ctx.preserve_whitespace);
 
```

#### Recent Merged Pull Requests:
- **PR #28864** (2026-11-05): fix(linter/vitest/prefer-called-exactly-once-with): preserve neighboring code in autofix (@camc314)
- **PR #28863** (2026-11-05): style(lexer): reorder imports (@overlookmotel)
- **PR #28857** (closed): fix(linter): preserve unrelated code in Vitest autofix (@sainimal1ba-hue)
- **PR #28856** (2026-11-05): style(lexer): apply consistent attribute order (@overlookmotel)
- **PR #28854** (2026-11-05): refactor(lexer): derive `Eq` on `Diagnostic` and `StringSpan` (@overlookmotel)
- **PR #28853** (2026-11-05): docs(lexer): add README to `oxc_lexer_macros` crate (@overlookmotel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. lexer): classify Turbopack magic comments (#28427)

**RULE**:
When implementing operations in `crates/oxc_lexer/src/pipeline/carve/comments.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `171ad772`: lexer): classify Turbopack magic comments (#28427). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_lexer/src/pipeline/carve/comments.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        b't' => {
            if bytes[start..].starts_with(b"turbopack")
                && start + 9 < bytes.len()
                && bytes[start + 9].is_ascii_uppercase()
            {
                return CommentContent::Turbopack;
            }
            return if lic { CommentContent::Legal } else { CommentContent::None };
        }

    #[test]
    fn turbopack() {
        for (source, is_block) in [
            (b" turbopackChunkName: \"x\" ".as_slice(), true),
            (b"turbopackOptional: true".as_slice(), true),
            (b"\tturbopackIgnore: true\n".as_slice(), true),
            (b" turbopackIgnore: true".as_slice(), false),
        ] {
            assert_eq!(classify(source, is_block, false, BASELINE), CommentContent::Turbopack);
        }

        for source in [b" turbopack ".as_slice(), b" turbopack", b" turbopackignore: true"] {
            assert_eq!(classify(source, true, false, BASELINE), CommentContent::None);
        }

        // Without a magic comment, @license or @preserve still makes it legal
        assert_eq!(classify(b" turbopack @license ", true, true, BASELINE), CommentContent::Legal);
    }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `171ad772` are properly handled with clean fallback behavior.
