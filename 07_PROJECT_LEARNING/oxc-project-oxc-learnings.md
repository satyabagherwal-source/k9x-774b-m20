# Forensic Learning Record (Deep Inspection): oxc-project/oxc

> **Canonical Artifact**: `07_PROJECT_LEARNING/oxc-project-oxc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oxc-project/oxc](https://github.com/oxc-project/oxc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:26:46.110Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oxc-project/oxc`
- **Description**: ⚓ A collection of high-performance JavaScript tools.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 22945 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/oxfmt/src-js/cli-worker.ts`
```
// `oxfmt` CLI - Worker Thread Entry Point

// Re-exports core functions for use in `worker_threads`
export {
  formatEmbeddedCode,
  formatEmbeddedDoc,
  formatFile,
  sortTailwindClasses,
} from "./libs/apis";

```

### Core Architecture Module: `apps/oxfmt/src-js/cli/worker-proxy.ts`
```
import Tinypool from "tinypool";
import { toFormatFileResult, toNullable } from "../libs/napi-callbacks";
import type { FormatFileResult } from "../libs/napi-callbacks";
import type {
  FormatFileParam,
  FormatEmbeddedCodeParam,
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
  // that leaks the previous `child_process` workers, and other workspace folders may have formats in-flight.
  // (https://github.com/oxc-project/oxc/issues/24147)
  // NOTE: `numThreads` never changes within a single session, so the first value wins.
  poolSize ??= numThreads;
}

// Create the pool lazily on first use,
// so runs that never delegate to Prettier spawn no `child_process` workers at all.
// (e.g. Rust-tier files only)
async function getPool(): Promise<Tinypool> {
  // Rust always calls `initExternalServices` before formatting, so this is defensive.
  if (poolSize === null) throw new Error("External services are not initialized");

  pool ??= new Tinypool({
    filename: new URL("./cli-worker.js", import.meta.url).href,
    minThreads: poolSize,
    maxThreads: poolSize,
    // XXX: Use `child_process` instead of `worker_threads`.
    // Not sure why, but when using `worker_threads`,
    // calls from NAPI (CLI) -> worker threads -> NAPI (prettier-plugin-oxfmt) causes a hang...
    runtime: "child_process",
    // When setting the `runtime: child_process`,
    // `process.env` is not inherited (likely a bug), so it needs to be explicitly specified.
    env: process.env as Record<string, string>,
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

export function formatEmbeddedCode(
  options: FormatEmbeddedCodeParam["options"],
  code: string,
): Promise<string | null> {
  return toNullable(
    getPool().then((pool) =>
      pool.run({ options, code } satisfies FormatEmbeddedCodeParam, {
        name: "formatEmbeddedCode",
      }),
    ),
  );
}

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
    #[expect(clippy::cast_possible_truncation)]
    if config.print_width.is_none()
        && let EditorConfigProperty::Value(MaxLineLength::Number(v)) = props.max_line_length
    {
        config.print_width = Some(v as u16);
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
        // Match Prettier's behavior: Only use `indent_size` when `useTabs: false`.
        // https://github.com/prettier/prettier/blob/90983f40dce5e20beea4e5618b5e0426a6a7f4f0/src/config/editorconfig/editorconfig-to-prettier.js#L25-L30
        #[expect(clippy::cast_possible_truncation)]
        if config.use_tabs == Some(false)
            && let EditorConfigProperty::Value(size) = props.indent_size
        {
            config.tab_width = Some(size as u8);
        } else if let EditorConfigProperty::Value(size) = props.tab_width {
            config.tab_width = Some(size as u8);
        }
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
    editorconfig::{apply_editorconfig, resolve_editorconfig_overrides, root_properties},
    overrides::OxfmtrcOverrides,
};
use super::{
    FormatStrategy,
    global_ignore::matches_with_ancestors,
    options::{ValidatedOptions, validate},
    oxfmtrc::{FormatConfig, Oxfmtrc},
    support::FileKind,
    utils,
};

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
            .find_unique_config_by_readdir(dir, false)
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

/// Outcome of resolving a [`FileKind`] against a [`FormatConfig`],
/// constructed by [`ConfigResolver::resolve`] / [`resolve_for_api`].
#[derive(Debug)]
pub enum ResolveOutcome {
    /// Ready to format with this strategy.
    Format(FormatStrategy),
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
    kind: FileKind,
) -> ResolveOutcome {
    #[cfg(feature = "napi")]
    if let Some(plugin) = kind.requires_plugin(&config) {
        return ResolveOutcome::MissingPlugin(plugin);
    }
    ResolveOutcome::Format(FormatStrategy { kind, config, validated })
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
    kind: FileKind,
    cwd: &Path,
) -> Result<ResolveOutcome, String> {
    let mut format_config: FormatConfig =
        serde_json::from_value(raw_config).map_err(|err| err.to_string())?;
    format_config.resolve_tailwind_paths(cwd);
    // Validate eagerly, as the single gate for every option (core + js/sortImports):
    // downstream mapping consumes the derived artifacts and cannot re-fail,
    // and `Prettier` kinds have no later chance before values reach Prettier.
    let validated = validate(&format_config)?;
    Ok(into_outcome(Arc::new(format_config), Arc::new(validated), kind))
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
    /// Retained because the slow path must re-deserialize [`FormatConfig`] from it. (see [`Self::resolve_options`]).
    /// Rebuilding from the typed `base` snapshot is not enough, since `apply_editorconfig` only fills `is_none()` fields,
    /// so per-file `[src/*.ts]` sections couldn't override values that the `[*]` section already baked in.
    raw_config: Value,
    /// Directory containing the config file (for relative path resolution in overrides).
    config_dir: Option<PathBuf>,
    /// Fast-path snapshot for files without per-file overrides:
    /// the typed `FormatConfig` (`.oxfmtrc` base + `.editorconfig` `[*]` folded in)
    /// together with its validation-gate artifacts,
    /// so the pair can never go stale 
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
        // NOTE: On Windows, `to_string_lossy()` produces `\`-separated paths.
        // This is OK since `fast_glob::glob_match()` supports both `/` and `\` via `std::path::is_separator`.
        let relative = self
            .base_dir
            .as_ref()
            .and_then(|dir| path.strip_prefix(dir).ok())
            .unwrap_or(path)
            .to_string_lossy();

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
//! The embedded routing table ([`route`]) and the `FormatDispatcher` assembly shared by every build.
//!
//! Each language maps to a Rust formatter where available;
//! the [`PrettierLanguage`] set goes to the napi-only Prettier Doc→IR channel ([`super::prettier_doc`]) when one is supplied,
//! and is deliberately preserved as-is otherwise (pure Rust build); everything else stays as-is in every build.

use std::sync::{Arc, OnceLock};

use tracing::{debug, debug_span};

use oxc_formatter::{CssInJsTemplate, JsEmbeddedIn, JsFormatOptions, MarkdownInJsTemplate};
use oxc_formatter_core::{
    DispatchRequest, DispatchResponse, EmbeddedIr, FormatDispatcher, FormatSession,
};
use oxc_formatter_core::{FormatOptions, PrinterOptions};
use oxc_formatter_css::{CssFormatOptions, CssVariant};
use oxc_formatter_graphql::GraphqlFormatOptions;
use oxc_formatter_json::{JsonFormatOptions, JsonVariant};
use oxc_formatter_markdown::{MarkdownFormatOptions, XxxInMarkdownCodeBlock};
use oxc_formatter_yaml::YamlFormatOptions;
use oxc_span::SourceType;

use crate::core::{
    options::{
        ValidatedOptions, to_oxc_formatter, to_oxc_formatter_css, to_oxc_formatter_graphql,
        to_oxc_formatter_json, to_oxc_formatter_markdown, to_oxc_formatter_yaml,
    },
    oxfmtrc::FormatConfig,
};

/// The native half of the routing table:
/// a request/fence language routed to [`Route::Native`] parses to its Rust formatter branch here.
pub enum NativeLanguage {
    Js(SourceType),
    Graphql,
    /// The fence-derived variant;
    /// the css-in-js typed context overrides it to Scss + placeholders at dispatch time (see the css branch).
    Css(CssVariant),
    Yaml,
    Json(JsonVariant),
    Markdown,
}

/// Languages Prettier still formats for us (no Rust formatter yet).
///
/// [`PrettierDocFallback`] receives this instead of a raw string,
/// so the fallback can never be handed a language the table did not route to it.
/// The set shrinks as Rust ports land, and the type disappears with the last port.
#[derive(Clone, Copy)]
pub enum PrettierLanguage {
    Html,
    Angular,
    Vue,
    /// Formatted only when `prettier-plugin-svelte` is enabled (`svelte` config key).
    Svelte,
    Handlebars,
    Mdx,
}

#[cfg(feature = "napi")]
impl PrettierLanguage {
    /// The Prettier `parser` name injected into the options JSON.
    ///
    /// NOTE: language identifiers happen to overlap with some Prettier parser names,
    /// but `oxc_formatter` treats them as generic language names;
    /// this method is the only place mapping EMBEDDED language identifiers to Prettier parsers
    /// (the whole-file Tier 3/4 path has its own filename-keyed map in `core::support`).
    pub fn parser(self) -> &'static str {
        match self {
            Self::Html => "html",
            Self::Angular => "angular",
            Self::Vue => "vue",
            Self::Svelte => "svelte",
            Self::Handlebars => "glimmer",
            Self::Mdx => "mdx",
        }
    }

    /// Whether the Doc→IR conversion must surface `HtmlEmbedMeta`
    /// (`htmlHasMultipleRootElements`) to the embed site.
    pub fn wants_html_meta(self) -> bool {
        matches!(self, Self::Html | Self::Angular)
    }
}

/// Where a language identifier routes.
pub enum Route {
    /// A Rust formatter branch in [`build_dispatcher`]; never re-routed to Prettier.
    Native(NativeLanguage),
    /// Prettier serves it (napi Doc→IR fallback / string channel);
    /// the pure build preserves it as-is.
    Prettier(PrettierLanguage),
    /// No formatter anywhere: the part deliberately stays as-is in every build.
    Unsupported,
}

/// THE routing table: "which formatter serves this language?" answered in one place.
/// [`build_dispatcher`] and the napi string channel's fence routing both consult it,
/// so their notions of who formats what can never drift,
/// and aliases are resolved here and nowhere else.
///
/// A code fence's name arrives as written: the aliases are Shiki's ids and aliases,
/// what Markdown tooling (VitePress, Astro, ...) highlights with.
/// <https://shiki.style/languages>
pub fn route(language: &str) -> Route {
    match language {
        "graphql" | "gql" => Route::Native(NativeLanguage::Graphql),
        "css" | "postcss" => Route::Native(NativeLanguage::Css(CssVariant::Css)),
        "scss" => Route::Native(NativeLanguage::Css(CssVariant::Scss)),
        "less" => Route::Native(NativeLanguage::Css(CssVariant::Less)),
        "yaml" | "yml" => Route::Native(NativeLanguage::Yaml),
        "json" => Route::Native(NativeLanguage::Json(JsonVariant::Json)),
        "jsonc" => Route::Native(NativeLanguage::Json(JsonVariant::Jsonc)),
        "json5" => Route::Native(NativeLanguage::Json(JsonVariant::Json5)),
        "html" => Route::Prettier(PrettierLanguage::Html),
        "angular" | "angular-html" => Route::Prettier(PrettierLanguage::Angular),
        "vue" => Route::Prettier(PrettierLanguage::Vue),
        "svelte" => Route::Prettier(PrettierLanguage::Svelte),
        "handlebars" | "hbs" => Route::Prettier(PrettierLanguage::Handlebars),
        "mdx" => Route::Prettier(PrettierLanguage::Mdx),
        "markdown" | "md" => Route::Native(NativeLanguage::Markdown),
        // JS / TS by file extension, which carries the module kind and JSX.
        // A component's inline template is found from its decorator, not from the fence (`angular-ts`).
        _ => {
            let extension = match language {
                "javascript" => "js",
                "typescript" | "angular-ts" => "ts",
                extension => extension,
            };
            SourceType::from_extension(extension).map_or(Route::Unsupported, |source_type| {
                Route::Native(NativeLanguage::Js(source_type))
            })
        }
    }
}

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
    /// One cell per fence-reachable [`JsonVariant`] (json / jsonc / json5; `JsonStringify` is `package.json`-only).
    json: [OnceLock<JsonFormatOptions>; 3],
    markdown: OnceLock<MarkdownFormatOptions>,
    /// The options handed to Prettier; see [`PrettierOptions`].
    #[cfg(feature = "napi")]
    prettier: PrettierOptions,
}

/// The lazily-built options JSON handed to Prettier (+ plugins),
/// consumed by the Doc→IR / string paths and the Tailwind sorter.
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
            json: [OnceLock::new(), OnceLock::new(), OnceLock::new()],
            markdown: OnceLock::new(),
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
    /// `fallback` is the one build-de
```

### Core Architecture Module: `apps/oxfmt/src/core/embed/jsdoc_fence.rs`
```
//! Native-fence string adapter:
//! a JSDoc fenced code block whose language has a Rust formatter branch
//! formats through the dispatch registry, in EVERY build.
//!
//! This is the build-independent half of the string-out channel;
//! the profiles in [`super::services`] wire it into the session's string embedder
//! (the napi one via [`super::prettier_string`], which routes native fences here
//! before its Prettier string paths; the pure one directly, non-native fences stay verbatim).

use std::sync::Arc;

use tracing::debug_span;

use oxc_allocator::Allocator;
use oxc_formatter_core::{
    DispatchRequest, FormatDispatcher, FormatSession, InputKind, PrintWidth, SessionServices,
    TailwindSorter,
};

use super::dispatcher::ResolvedDispatchConfig;

/// Format a JSDoc fenced code block through the native dispatch registry:
/// a string-in/string-out adapter over `FormatSession::dispatch_to_string`.
///
/// Load-bearing notes:
/// - `print_width` is the fence's effective width at its comment position;
///   it overrides the configured width, the other print knobs come from the resolved config
/// - `Err` keeps the fence verbatim, covering both the deliberate keep
///   (`Ok(None)`; a failed native language never re-routes to Prettier) and operational errors
/// - The session-less `StringEmbedder` contract forces a fresh root session per fence,
///   so `dispatch_depth` resets at this string boundary (inert today: no native fence language re-dispatches).
///   Threading the parent session through the callback is the eventual fix.
pub fn format_native_fence(
    language: &str,
    code: &str,
    print_width: usize,
    fence_dispatcher: &FormatDispatcher,
    dispatch_config: &ResolvedDispatchConfig,
    sort_tailwind: Option<&TailwindSorter>,
) -> Result<String, String> {
    debug_span!("oxfmt::embed::format_native_fence", language = language).in_scope(|| {
        let allocator = Allocator::default();
        let session = FormatSession::with_services(
            &allocator,
            InputKind::Fragment,
            SessionServices {
                dispatcher: Some(Arc::clone(fence_dispatcher)),
                tailwind_sorter: sort_tailwind.cloned(),
                ..SessionServices::default()
            },
        );

        let printer_options = dispatch_config
            .print_options()
            .with_print_width(PrintWidth::new(u32::try_from(print_width).unwrap_or(u32::MAX)));
        session
            .dispatch_to_string(
                DispatchRequest {
                    language,
                    text: code,
                    input_kind: InputKind::Fragment,
                    parent_context: None,
                },
                printer_options,
            )?
            .map(|mut code| {
                // The block is re-embedded line-by-line into the comment; no trailing newline
                code.truncate(code.trim_end().len());
                code
            })
            .ok_or_else(|| format!("Native formatter for '{language}' kept the input as-is"))
    })
}

```

### Core Architecture Module: `apps/oxfmt/src/core/embed/mod.rs`
```
//! Embedded-language formatting orchestration.
//!
//! `oxc_formatter_core` holds the abstract contract
//! (`FormatSession`, `FormatDispatcher`, `DispatchRequest`/`DispatchResponse`);
//! this module is its concrete counterpart owned by the orchestrator (Oxfmt).
//!
//! - [`dispatcher`] (every build):
//!   the routing table (`route`: one function answering "which formatter serves this language?"),
//!   `ResolvedDispatchConfig` (lazy per-language options) + `build_dispatcher` with a Rust branch per `NativeLanguage`;
//!   IR integrates into the parent's arena / `GroupId` space
//! - [`services`] (every build): the root `SessionServices` assembly (`for_root`, one definition per build)
//! - [`jsdoc_fence`] (every build): the JSDoc native-fence string adapter over the registry
//! - [`prettier_doc`] (napi only): Prettier Doc→IR path for the `Route::Prettier` set
//! - [`prettier_string`] (napi only): the Prettier string paths of the string-out channel (html JSDoc fences; results re-embed line-by-line)

#[cfg(feature = "napi")]
use std::sync::Arc;

#[cfg(feature = "napi")]
use serde_json::Value;

pub mod dispatcher;
pub mod jsdoc_fence;
#[cfg(feature = "napi")]
pub mod prettier_doc;
#[cfg(feature = "napi")]
pub mod prettier_string;
pub mod services;

// --- Cross-module callback types ---
//
// These describe the shape of the napi-wrapped callbacks the orchestration builders consume.
// NOTE: They live here (not in `external_services`),
// so the `prettier_doc` / `prettier_string` factories stay independent of the napi boundary.
// `external_services` is the producer of these types via its `wrap_*` functions, and orchestration is the consumer.

/// Callback function type for formatting embedded code with config.
/// Takes (options, code) and returns formatted code or an error.
/// The `options` Value is owned and includes `parser` set by the caller.
#[cfg(feature = "napi")]
pub type FormatEmbeddedWithConfigCallback =
    Arc<dyn Fn(Value, &str) -> Result<String, String> + Send + Sync>;

/// Callback function type for formatting embedded code via the Doc IR path.
/// Takes (options, text) and returns a Doc JSON string or an error.
#[cfg(feature = "napi")]
pub type FormatEmbeddedDocWithConfigCallback =
    Arc<dyn Fn(Value, &str) -> Result<String, String> + Send + Sync>;

/// Internal callback type for Tailwind processing with config.
/// Takes (options, classes) and returns sorted classes.
/// The `filepath` is included in `options`.
#[cfg(feature = "napi")]
pub type TailwindWithConfigCallback = Arc<dyn Fn(&Value, Vec<String>) -> Vec<String> + Send + Sync>;

```

### Core Architecture Module: `apps/oxfmt/src/core/embed/prettier_doc.rs`
```
//! The Prettier Doc→IR channel: the one path for `Route::Prettier` languages (napi only).
//!
//! Sends the text to JS `printToDoc()`, then converts the returned Doc JSON into formatter IR
//! that integrates into the parent's arena / `GroupId` space.
//! Fills the dispatcher's optional [`PrettierDocFallback`] slot;
//! the string twin is [`super::prettier_string`].

use std::sync::Arc;

use serde::Deserialize;
use serde_json::Value;
use tracing::{debug, debug_span};

use oxc_formatter::HtmlEmbedMeta;
use oxc_formatter_core::{DispatchPayload, DispatchResponse, FormatSession};

use crate::{
    core::embed::{
        FormatEmbeddedDocWithConfigCallback,
        dispatcher::{PrettierDocFallback, PrettierLanguage, ResolvedDispatchConfig},
    },
    prettier_compat::from_prettier_doc,
};

/// Build the Prettier Doc→IR fallback installed on the dispatcher's `Route::Prettier` arm.
/// The routing table already narrowed the language; only a language whose plugin is off is rejected (as-is).
pub fn build_prettier_fallback(
    dispatch_config: Arc<ResolvedDispatchConfig>,
    format_embedded_doc: FormatEmbeddedDocWithConfigCallback,
) -> PrettierDocFallback {
    Arc::new(move |session: &FormatSession<'_>, language: PrettierLanguage, text: &str| {
        let parser_name = language.parser();
        let Some(options) = dispatch_config.prettier_options_for(language) else {
            debug!("The plugin for parser '{parser_name}' is not enabled, part stays as-is");
            return Ok(DispatchResponse::PreserveOriginal);
        };
        debug_span!("oxfmt::external::format_embedded_doc", parser = parser_name)
            .in_scope(|| {
                let doc_json_str = (format_embedded_doc)(options, text).map_err(|err| {
                    format!("Failed to get Doc for embedded code (parser '{parser_name}'): {err}")
                })?;
                // Prettier's Doc can produce deeply nested arrays
                // (e.g., md-in-js with `proseWrap: preserve`, which nests each word in `[[[prev, " "], word], " "]`).
                // The default recursion limit of 128 is not enough for long paragraphs.
                // This only affects this deserialization call;
                // other `serde_json` usage in the codebase keeps the default limit.
                let mut de = serde_json::Deserializer::from_str(&doc_json_str);
                de.disable_recursion_limit();
                let doc_json = serde_json::Value::deserialize(&mut de)
                    .map_err(|e| format!("Failed to parse Doc JSON: {e}"))?;

                let allocator = session.allocator();
                let (mut ir, metadata) = from_prettier_doc::convert_envelope(
                    doc_json,
                    allocator,
                    session.group_id_builder(),
                )?;
                from_prettier_doc::postprocess(&mut ir, allocator);
                // HTML/Angular additionally surface `HtmlEmbedMeta` to the embed site.
                let child_context = language.wants_html_meta().then(|| {
                    Box::new(HtmlEmbedMeta {
                        has_multiple_root_elements: metadata
                            .get("htmlHasMultipleRootElements")
                            .and_then(Value::as_bool),
                    }) as Box<dyn std::any::Any>
                });
                Ok(DispatchResponse::Formatted(DispatchPayload { doc: ir, child_context }))
            })
            .inspect_err(|err| {
                debug!("Failed to format embedded doc for parser '{parser_name}': {err}");
            })
    })
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #27363** (2026-10-06): **fix(oxlint,oxfmt): set stderr blocking**
  *Symptoms*: Closes #27361  We already set blocking mode for stdout/stdin, but not for stderr.  ### Repro  1000 files with a parse error (`const a = ;`), so stderr exceeds 64KB. The reader waits 3s before reading, so the pipe fills up:  ```sh node dist/cli.js --check . > out.txt 2> >(sleep 3; cat > err.txt) ```  | | exit | stderr | errors shown | |---|---|---|---| | stderr to a file (baseline) | 2 | 90739B | 1000/1000 | | Before | 2 | 65536B | 723/1000 | | After | 2 | 90739B | 1000/1000 |  Before this fix, the output stops at exactly 64KB, and the final `Error occurred when checking code style...` line is missing too. 
  **Post-Mortem & Fix Analysis**:
  > * **#27363** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27363?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> 👈 <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27363?utm_source=stack-comment-view-in-graphite" target="_blank">(View in Graphite)</a> * **#27362** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27362?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> * `main` <hr />  ## How to use the Graphite Merge Queue  Add either label to this PR to merge it via the merge queue: - <kbd>0-merge</kbd> - adds this PR to the back of the merge queue - <kbd>hotfix</kbd> - for urgent changes, fast-track this PR to the front of the merge queue  You must have a Graphite account in order to use the merge queue. Sign up using [this link](ht
  > ### Merge activity  * **Oct 6, 4:15 AM UTC**: The merge label '0-merge' was detected. This PR will be added to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc) once it meets the requirements. * **Oct 6, 4:15 AM UTC**: `leaysgur` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Oct 6, 4:20 AM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 

- **Issue #27362** (2026-10-06): **docs(oxfmt): update how `embeddedLanguageFormatting` option works**
  *Symptoms*: Refine docs about `embeddedLanguageFormatting`.
  **Post-Mortem & Fix Analysis**:
  > * **#27363** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27363?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> * **#27362** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27362?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> 👈 <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27362?utm_source=stack-comment-view-in-graphite" target="_blank">(View in Graphite)</a> * `main` <hr />  ## How to use the Graphite Merge Queue  Add either label to this PR to merge it via the merge queue: - <kbd>0-merge</kbd> - adds this PR to the back of the merge queue - <kbd>hotfix</kbd> - for urgent changes, fast-track this PR to the front of the merge queue  You must have a Graphite account in order to use the merge queue. Sign up using [this link](ht
  > ### Merge activity  * **Oct 6, 4:15 AM UTC**: `leaysgur` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Oct 6, 4:19 AM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 

- **Issue #27361** (2026-10-06): **oxfmt: --check sometimes exits non-zero and prints nothing when stdout and stderr are pipes**
  *Symptoms*: Hi there, we saw this behavior with our toolchain with oxfmt 0.71.0 on GitHub Actions with Node 24.19.0.  We're running oxfmt via a child process and piping the output to use:  Eg.  ```ts const result = await execa("oxfmt", ["--check"], {       cwd: dir,       all: true,       reject: false,     }); ```  We noticed on some runs the output would never return.  I got Cursor to help me debug it and it suggested we needed to also set stderr to also blocking alongside the existing blockings and it spat out the following:  >Node opens piped stdio as non-blocking ([napi-rs#1630](https://github.com/napi-rs/napi-rs/issues/1630)). `apps/oxfmt/src-js/cli.ts` turns >blocking mode back on for stdout and stdin only: >```ts >if (!process.stdout.isTTY) process.stdout._handle?.setBlocking?.(true); >if (!process.stdin.isTTY) process.stdin._handle?.setBlocking?.(true); >``` >`stderr` stays non-blocking. The parse frame is written there by `DiagnosticService`, and so is `Error occurred when checking code style in >the above files.` (`apps/oxfmt/src/cli/walk_runner.rs`). `Checking formatting...` goes to stdout through the same helper.  The suggested fix being adding setBlocking to true for the stderr:  https://github.com/oxc-project/oxc/blob/6b72e990dedc31148cde587e61c2ef9859d7c312/apps/oxfmt/src-js/cli.ts#L25-L31  ```ts if (!process.stderr.isTTY) process.stderr._handle?.setBlocking?.(true); ``` 

- **Issue #27360** (2026-10-06): **test(oxfmt): remove format tests duplicated by E2E**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > * **#27360** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27360?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> 👈 <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27360?utm_source=stack-comment-view-in-graphite" target="_blank">(View in Graphite)</a> * **#27359** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27359?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> * `main` <hr />  ## How to use the Graphite Merge Queue  Add either label to this PR to merge it via the merge queue: - <kbd>0-merge</kbd> - adds this PR to the back of the merge queue - <kbd>hotfix</kbd> - for urgent changes, fast-track this PR to the front of the merge queue  You must have a Graphite account in order to use the merge queue. Sign up using [this link](ht
  > ### Merge activity  * **Oct 6, 2:54 AM UTC**: The merge label '0-merge' was detected. This PR will be added to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc) once it meets the requirements. * **Oct 6, 2:56 AM UTC**: `graphite-app` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Oct 6, 3:02 AM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 

- **Issue #27359** (2026-10-06): **fix(formatter_core): leave blank frontmatter without dispatcher**
  *Symptoms*: Always leave FM (in any form) as-is when `embeddedLanguageFormatting: off` (or Rust CLI).
  **Post-Mortem & Fix Analysis**:
  > * **#27360** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27360?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> * **#27359** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27359?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> 👈 <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27359?utm_source=stack-comment-view-in-graphite" target="_blank">(View in Graphite)</a> * `main` <hr />  ## How to use the Graphite Merge Queue  Add either label to this PR to merge it via the merge queue: - <kbd>0-merge</kbd> - adds this PR to the back of the merge queue - <kbd>hotfix</kbd> - for urgent changes, fast-track this PR to the front of the merge queue  You must have a Graphite account in order to use the merge queue. Sign up using [this link](ht
  > ### Merge activity  * **Oct 6, 2:54 AM UTC**: The merge label '0-merge' was detected. This PR will be added to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc) once it meets the requirements. * **Oct 6, 2:56 AM UTC**: `graphite-app` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Oct 6, 3:01 AM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 77` untouched benchmarks   `⏩ 19` skipped benchmarks[^skipped]        ---  <sub>Comparing <code>10-06-fix_formatter_core_leave_blank_frontmatter_without_dispatcher</code> (2038b65) with <code>main</code> (7e6a050)[^unexpected-base]</sub>  <a href="https://app.codspeed.io/oxc-project/oxc/branches/10-06-fix_formatter_core_leave_blank_frontmatter_without_dispatcher?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>   [^skipped]: 19 benchmarks were skipped, so the baseline results were used instead. If 

- **Issue #27358** (2026-10-06): **docs(formatter_markdown): fix DIVERGENCES.md examples and slug to match behavior**
  *Symptoms*: Update these 3 entries to match reality.  - wrapped-block-starts - fence-info-batcktick - leading-dashes-paragraph
  **Post-Mortem & Fix Analysis**:
  > * **#27358** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27358?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> 👈 <a href="https://app.graphite.com/github/pr/oxc-project/oxc/27358?utm_source=stack-comment-view-in-graphite" target="_blank">(View in Graphite)</a> * `main` <hr />  ## How to use the Graphite Merge Queue  Add either label to this PR to merge it via the merge queue: - <kbd>0-merge</kbd> - adds this PR to the back of the merge queue - <kbd>hotfix</kbd> - for urgent changes, fast-track this PR to the front of the merge queue  You must have a Graphite account in order to use the merge queue. Sign up using [this link](https://app.graphite.com/invite/github/oxc-project?ref=merge-queue-instructions-in-stack-comment&prId=27358).  <h2></h2> <sub>  An organization admin has enabled the [Graphite Merge Queue](https://graphite.dev/docs/graphite-merge-queue) in 
  > ### Merge activity  * **Oct 6, 2:14 AM UTC**: The merge label '0-merge' was detected. This PR will be added to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc) once it meets the requirements. * **Oct 6, 2:16 AM UTC**: `leaysgur` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Oct 6, 2:20 AM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 

- **Issue #27357** (2026-10-05): **fix(semantic): visit `TSMethodSignature` computed method keys in enclosing scope**
  *Symptoms*: Computed TypeScript method keys must resolve in the enclosing scope. In:  ``` declare const x: unique symbol; interface I {   [x](x: number): void; } ``` The key currently binds to the parameter `x`; this change binds it to the outer constant.  
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-05T21:48:16.735094Z">2026-10-05T21:48:16.735094Z</relative-time> | `24dac02` | Draft marked ready |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>
  > ### Merge activity  * **Oct 5, 9:46 PM UTC**: The merge label '0-merge' was detected. This PR will be added to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc) once it meets the requirements. * **Oct 5, 9:46 PM UTC**: `camc314` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Oct 5, 9:52 PM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 82` untouched benchmarks   `⏩ 14` skipped benchmarks[^skipped]        ---  <sub>Comparing <code>codex/fix-ts-method-key-scope</code> (24dac02) with <code>main</code> (3c361a7)[^unexpected-base]</sub>  <a href="https://app.codspeed.io/oxc-project/oxc/branches/codex%2Ffix-ts-method-key-scope?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>   [^skipped]: 14 benchmarks were skipped, so the baseline results were used instead. If they were deleted from the codebase, [click here and archive them to remov

- **Issue #27354** (2026-10-05): **refactor(lexer): answer dense context questions with the full walk**
  *Symptoms*: - a bounded walk starts fresh at its anchor for every question and keeps nothing between questions, once the bounded walks of a pass have taken as many scan steps as the full walk would the full walk answers the rest - drops walk continuation, group leaving and the separator and angle jumps, disambiguate is 247 code lines shorter; also fixes a template in tsx type arguments being lexed as an unterminated JSX element - main set about 1% slower, mostly code layout (checker.js runs the same instruction count), ts_zod about 5% slower since its class body questions walk the members again 

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

### Incident Patch 1: `6e573f92` (2026-10-06)
**Commit Message**: fix(oxlint,oxfmt): set stderr blocking (#27363)

Closes #27361

We already set blocking mode for stdout/stdin, but not for stderr.

### Repro

1000 files with a parse error (`const a = ;`), so stderr exceeds 64KB.
The reader waits 3s before reading, so the pipe fills up:

```sh
node dist/cli.js --check . > out.txt 2> >(sleep 3; cat > err.txt)
```

| | exit | stderr | errors shown |
|---|---|---|---|
| stderr to a file (baseline) | 2 | 90739B | 1000/1000 |
| Before | 2 | 65536B | 723/1000 |
| After | 2 | 90739B | 1000/1000 |

Before this fix, the output stops at exactly 64KB, and the final `Error occurred when checking code style...` line is missing too.

**File**: `apps/oxfmt/src-js/cli.ts` (modified, +4/-0)
```diff
@@ -29,6 +29,10 @@ void (async () => {
   // https://github.com/oxc-project/oxc/issues/20285
   // @ts-expect-error: `_handle` is an internal API
   if (!process.stdin.isTTY) process.stdin._handle?.setBlocking?.(true);
+  // stderr: Diagnostics for many files can overflow the pipe buffer, and the rest is silently dropped.
+  // https://github.com/oxc-project/oxc/issues/27361
+  // @ts-expect-error: `_handle` is an internal API
+  if (!process.stderr.isTTY) process.stderr._handle?.setBlocking?.(true);
 
   // LSP uses stdout for communication, so write logs to stderr to avoid breaking the protocol.
   // Since LSP is handled on the Rust side, we have to check the flag here. (`runCli()` starts the server and waits)
```

**File**: `apps/oxlint/src-js/cli.ts` (modified, +6/-0)
```diff
@@ -176,6 +176,12 @@ if (!process.stdout.isTTY) {
   // @ts-expect-error: `_handle` is an internal API
   process.stdout._handle?.setBlocking?.(true);
 }
+// Same for stderr, aligned with the fix in `oxfmt` CLI.
+// https://github.com/oxc-project/oxc/issues/27361
+// Currently Oxlint barely writes to stderr (diagnostics go to stdout),
+// but output beyond the pipe buffer would be lost otherwise.
+// @ts-expect-error: `_handle` is an internal API
+if (!process.stderr.isTTY) process.stderr._handle?.setBlocking?.(true);
 
 // LSP uses stdout for communication, so write logs to stderr to avoid breaking the protocol.
 // Since LSP is handled on the Rust side, we have to check the flag here. (`lint()` starts the server and waits)
```

---

### Incident Patch 2: `d730fdd1` (2026-10-06)
**Commit Message**: fix(formatter_core): leave blank frontmatter without dispatcher (#27359)

Always leave FM (in any form) as-is when `embeddedLanguageFormatting: off` (or Rust CLI).

**File**: `apps/oxfmt/test/api/front_matter.test.ts` (modified, +7/-0)
```diff
@@ -68,6 +68,13 @@ describe("CSS front matter", () => {
     });
     expect(result.errors).toStrictEqual([]);
     expect(result.code).toBe("---\ntitle:   Home\n---\n\nb {\n}\n");
+
+    // Even an empty block is not normalized
+    const empty = await format("a.css", "---\n\n---\nb {}\n", {
+      embeddedLanguageFormatting: "off",
+    });
+    expect(empty.errors).toStrictEqual([]);
+    expect(empty.code).toBe("---\n\n---\n\nb {\n}\n");
   });
 
   it("keeps a physical BOM at byte 0, before the block", async () => {
```

**File**: `crates/oxc_formatter_core/src/envelope/mod.rs` (modified, +6/-6)
```diff
@@ -18,13 +18,13 @@ use crate::{
 
 /// Writes a front matter block.
 ///
-/// The body dispatches through the session when its resolved language is in `embeddable_languages`,
-/// the whole block stays verbatim otherwise.
+/// The body dispatches through the session when a dispatcher is installed
+/// and its resolved language is in `embeddable_languages`, the whole block stays verbatim otherwise.
 /// Membership means "gets the frame treatment", not "gets formatted":
 /// a member language without a serving formatter keeps its body verbatim (`PreserveOriginal`),
-/// but its EMPTY block still normalizes through the frame.
-/// Never fails; any refusal (`PreserveOriginal`, operational error, non-embeddable language) keeps the block's bytes as-is
-/// while the host document still formats.
+/// but its EMPTY block still normalizes through the frame when a dispatcher is installed.
+/// Never fails; any refusal (`PreserveOriginal`, operational error, no dispatcher, non-embeddable language)
+/// keeps the block's bytes as-is while the host document still formats.
 ///
 /// The composed shape (Prettier `embed.js` + its css/markdown printers):
 /// opening delimiter with the explicit language re-emitted (`---yaml`),
@@ -36,7 +36,7 @@ pub fn write_front_matter<'a, C: FormatContext>(
     f: &mut Formatter<'_, 'a, C>,
 ) {
     let language = fm.language();
-    if embeddable_languages.contains(&language) {
+    if f.session().has_dispatcher() && embeddable_languages.contains(&language) {
         let body = fm.value.trim();
         if body.is_empty() {
             write_frame(fm, None, f);
```

**File**: `crates/oxc_formatter_css/src/format.rs` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ pub fn format<'a>(
     options: CssFormatOptions,
 ) -> Result<Formatted<'a, CssFormatContext<'a>>, OxcDiagnostic> {
     // NOTE: this wrapper labels the run `PhysicalFile` with NO services:
-    // front matter is detected but its body degrades to verbatim (`PreserveOriginal`),
+    // front matter is detected but kept verbatim (no dispatcher),
     // and `@apply` Tailwind classes print unsorted.
     // Hosts that want them use `format_with_session` with the services installed.
     format_with_session(
```

**File**: `crates/oxc_formatter_css/tests/conformance.rs` (modified, +2/-1)
```diff
@@ -26,8 +26,9 @@ const CSS: ConformanceConfig = ConformanceConfig {
     ignore: &[
         // postcss-conditionals (archived: https://github.com/andyjansson/postcss-conditionals).
         "css/atrule/if-else.css",
-        // YAML frontmatter
+        // YAML frontmatter, needs the dispatcher this harness doesn't install
         "css/yaml/dirty.css",
+        "css/yaml/empty_newlines.css",
         // range formatting / IDE cursor, not whole-file formatting
         "css/range/",
         "css/cursor/",
```

**File**: `crates/oxc_formatter_css/tests/snapshots/conformance__prettier-css.snap` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 source: crates/oxc_formatter_css/tests/conformance.rs
 expression: report
 ---
-css compatibility: 142/151 (94.04%), 13 files skipped
+css compatibility: 141/150 (94.00%), 13 files skipped
 
 # Failed
 
```

---

### Incident Patch 3: `37b3c48b` (2026-10-06)
**Commit Message**: docs(formatter_markdown): fix DIVERGENCES.md examples and slug to match behavior (#27358)

Update these 3 entries to match reality.

- wrapped-block-starts
- fence-info-batcktick
- leading-dashes-paragraph

**File**: `crates/oxc_formatter_markdown/DIVERGENCES.md` (modified, +6/-6)
```diff
@@ -380,8 +380,8 @@ Prettier wraps it like any line: a break right after the destination makes it a
 Some words that push the tag to the edge of the line so the html block <div>x</div> lands first.
 
 <!-- ours -->
-Some words that push the tag to the edge of the line so the html block <div>x</div>
-lands first.
+Some words that push the tag to the edge of the line so the html
+block <div>x</div> lands first.
 
 <!-- prettier -->
 Some words that push the tag to the edge of the line so the html block
@@ -491,7 +491,7 @@ See [[the `first second` note]] for details.
 In a paragraph printed as written for wiki link risk (Prettier's `riskyParagraphPositions`, `[[` ... `]]`),
 a code span keeps its line break too; Prettier joins it, and the one-line `[[...]]` is a wiki link on the next parse.
 
-## leading-dashes
+## leading-dashes-paragraph
 
 - Why: semantics
 - Pin: `tests/fixtures/markdown/leading-dashes-paragraph.md`
@@ -632,17 +632,17 @@ Ours prints every node as written, the next parse replaces it again.
 
 ````markdown
 <!-- input -->
-~~~js `x`
+~~~sh `x`
 a
 ~~~
 
 <!-- ours -->
-~~~js `x`
+~~~sh `x`
 a
 ~~~
 
 <!-- prettier -->
-```js `x`
+```sh `x`
 a
 ```
 ````
```

---

### Incident Patch 4: `7e6a0502` (2026-10-05)
**Commit Message**: fix(semantic): visit `TSMethodSignature` computed method keys in enclosing scope (#27357)

Computed TypeScript method keys must resolve in the enclosing scope. In:

```
declare const x: unique symbol;
interface I {
  [x](x: number): void;
}
```
The key currently binds to the parameter `x`; this change binds it to the outer constant.

**File**: `crates/oxc_ast/src/ast/ts.rs` (modified, +1/-0)
```diff
@@ -1117,6 +1117,7 @@ pub struct TSMethodSignature<'a> {
     pub computed: bool,
     pub optional: bool,
     pub kind: TSMethodSignatureKind,
+    #[scope(enter_before)]
     pub type_parameters: Option<Box<'a, TSTypeParameterDeclaration<'a>>>,
     #[estree(skip)]
     pub this_param: Option<Box<'a, TSThisParameter<'a>>>,
```

**File**: `crates/oxc_ast_visit/src/generated/visit.rs` (modified, +1/-1)
```diff
@@ -3825,9 +3825,9 @@ pub mod walk {
     pub fn walk_ts_method_signature<'a, V: Visit<'a>>(visitor: &mut V, it: &TSMethodSignature<'a>) {
         let kind = AstKind::TSMethodSignature(visitor.alloc(it));
         visitor.enter_node(kind);
-        visitor.enter_scope(ScopeFlags::empty(), &it.scope_id);
         visitor.visit_span(&it.span);
         visitor.visit_property_key(&it.key);
+        visitor.enter_scope(ScopeFlags::empty(), &it.scope_id);
         if let Some(type_parameters) = &it.type_parameters {
             visitor.visit_ts_type_parameter_declaration(type_parameters);
         }
```

**File**: `crates/oxc_ast_visit/src/generated/visit_mut.rs` (modified, +1/-1)
```diff
@@ -4039,9 +4039,9 @@ pub mod walk_mut {
     ) {
         let kind = AstType::TSMethodSignature;
         visitor.enter_node(kind);
-        visitor.enter_scope(ScopeFlags::empty(), &it.scope_id);
         visitor.visit_span(&mut it.span);
         visitor.visit_property_key(&mut it.key);
+        visitor.enter_scope(ScopeFlags::empty(), &it.scope_id);
         if let Some(type_parameters) = &mut it.type_parameters {
             visitor.visit_ts_type_parameter_declaration(type_parameters);
         }
```

**File**: `crates/oxc_minifier/src/generated/walk.rs` (modified, +6/-6)
```diff
@@ -4950,12 +4950,6 @@ unsafe fn walk_ts_method_signature<'a, Tr: Traverse<'a>>(
     ctx: &mut TraverseCtx<'a>,
 ) {
     traverser.enter_ts_method_signature(&mut *node, ctx);
-    let previous_scope_id = ctx.current_scope_id();
-    let current_scope_id = (*((node as *mut u8).add(ancestor::OFFSET_TS_METHOD_SIGNATURE_SCOPE_ID)
-        as *mut Cell<Option<ScopeId>>))
-        .get()
-        .unwrap();
-    ctx.set_current_scope_id(current_scope_id);
     let pop_token = ctx.push_stack(Ancestor::TSMethodSignatureKey(
         ancestor::TSMethodSignatureWithoutKey(node, PhantomData),
     ));
@@ -4964,6 +4958,12 @@ unsafe fn walk_ts_method_signature<'a, Tr: Traverse<'a>>(
         (node as *mut u8).add(ancestor::OFFSET_TS_METHOD_SIGNATURE_KEY) as *mut PropertyKey,
         ctx,
     );
+    let previous_scope_id = ctx.current_scope_id();
+    let current_scope_id = (*((node as *mut u8).add(ancestor::OFFSET_TS_METHOD_SIGNATURE_SCOPE_ID)
+        as *mut Cell<Option<ScopeId>>))
+        .get()
+        .unwrap();
+    ctx.set_current_scope_id(current_scope_id);
     if let Some(field) = &mut *((node as *mut u8)
         .add(ancestor::OFFSET_TS_METHOD_SIGNATURE_TYPE_PARAMETERS)
         as *mut Option<ArenaBox<TSTypeParameterDeclaration>>)
```

**File**: `crates/oxc_minifier/src/traverse_context/scopes_collector.rs` (modified, +1/-0)
```diff
@@ -1917,6 +1917,7 @@ impl<'a> Visit<'a> for ChildScopeCollector {
 
     #[inline]
     fn visit_ts_method_signature(&mut self, it: &TSMethodSignature<'a>) {
+        self.visit_property_key(&it.key);
         self.add_scope(&it.scope_id);
     }
 
```

**File**: `crates/oxc_semantic/src/builder.rs` (modified, +1/-1)
```diff
@@ -2444,7 +2444,6 @@ impl<'a> Visit<'a> for SemanticBuilder<'a> {
     fn visit_ts_method_signature(&mut self, sig: &TSMethodSignature<'a>) {
         let kind = AstKind::TSMethodSignature(self.alloc(sig));
         self.enter_node(kind);
-        self.enter_scope(ScopeFlags::empty(), &sig.scope_id);
         self.visit_span(&sig.span);
         if sig.computed {
             // interface A { [prop](): string }
@@ -2453,6 +2452,7 @@ impl<'a> Visit<'a> for SemanticBuilder<'a> {
         }
         self.visit_property_key(&sig.key);
         self.current_reference_flags = ReferenceFlags::empty();
+        self.enter_scope(ScopeFlags::empty(), &sig.scope_id);
         if let Some(type_parameters) = &sig.type_parameters {
             self.visit_ts_type_parameter_declaration(type_parameters);
         }
```

**File**: `crates/oxc_semantic/tests/fixtures/oxc/ts/interfaces/computed-method-key-scope.snap` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+---
+source: crates/oxc_semantic/tests/main.rs
+input_file: crates/oxc_semantic/tests/fixtures/oxc/ts/interfaces/computed-method-key-scope.ts
+---
+[
+  {
+    "children": [
+      {
+        "children": [
+          {
+            "children": [],
+            "flags": "ScopeFlags(0x0)",
+            "id": 2,
+            "node": "TSMethodSignature",
+            "symbols": [
+              {
+                "flags": "SymbolFlags(FunctionScopedVariable)",
+                "id": 2,
+                "name": "x",
+                "node": "FormalParameter(x)",
+                "references": []
+              }
+            ]
+          }
+        ],
+        "flags": "ScopeFlags(0x0)",
+        "id": 1,
+        "node": "TSInterfaceDeclaration",
+        "symbols": []
+      },
+      {
+        "children": [
+          {
+            "children": [],
+            "flags": "ScopeFlags(0x0)",
+            "id": 4,
+            "node": "TSMethodSignature",
+            "symbols": [
+              {
+                "flags": "SymbolFlags(TypeParameter)",
+                "id": 4,
+                "name": "x",
+                "node": "TSTypeParameter(x)",
+                "references": [
+                  {
+                    "flags": "ReferenceFlags(Type)",
+                    "id": 2,
+                    "name": "x",
+                    "node_id": 32,
+                    "scope_id": 4
+                  }
+                ]
+              },
+              {
+                "flags": "SymbolFlags(FunctionScopedVariable)",
+                "id": 5,
+                "name": "value",
+                "node": "FormalParameter(value)",
+                "references": []
+              }
+            ]
+          }
+        ],
+        "flags": "ScopeFlags(0x0)",
+        "id": 3,
+        "node": "TSTypeAliasDeclaration",
+        "symbols": []
+      },
+      {
+        "children": [
+          {
+            "children": [],
+            "flags": "ScopeFlags(0x0)",
+            "id": 6,
+            "node": "TSMethodSignature",
+            "symbols": []
+          },
+          {
+            "children": [],
+            "flags": "ScopeFlags(0x0)",
+            "id": 7,
+            "node": "TSMethodSignature",
+            "symbols": [
+              {
+                "flags": "SymbolFlags(FunctionScopedVariable)",
+                "id": 7,
+                "name": "x",
+                "node": "FormalParameter(x)",
+                "references": []
+              }
+            ]
+          }
+        ],
+        "flags": "ScopeFlags(0x0)",
+        "id": 5,
+        "node": "TSTypeAliasDeclaration",
+        "symbols": []
+      }
+    ],
+    "flags": "ScopeFlags(Top)",
+    "id": 0,
+    "node": "Program",
+    "symbols": [
+      {
+        "flags": "SymbolFlags(BlockScopedVariable | ConstVariable | Ambient)",
+        "id": 0,
+        "name": "x",
+        "node": "VariableDeclarator(x)",
+        "references": [
+          {
+            "flags": "ReferenceFlags(Type)",
+            "id": 0,
+            "name": "x",
+            "node_id": 11,
+            "scope_id": 1
+          },
+          {
+            "flags": "ReferenceFlags(Type)",
+            "id": 1,
+            "name": "x",
+            "node_id": 23,
+            "scope_id": 3
+          },
+          {
+            "flags": "ReferenceFlags(Type)",
+            "id": 3,
+            "name": "x",
+            "node_id": 39,
+            "scope_id": 5
+          },
+          {
+            "flags": "ReferenceFlags(Type)",
+            "id": 4,
+            "name": "x",
+            "node_id": 44,
+            "scope_id": 5
+          }
+        ]
+      },
+      {
+        "flags": "SymbolFlags(Interface)",
+        "id": 1,
+        "name": "I",
+        "node": "TSInterfaceDeclaration",
+        "references": []
+      },
+      {
+        "flags": "SymbolFlags(TypeAlias)",
+        "id": 3,
+        "name": "Method",
+        "node": "TSTypeAliasDeclaration",
+        "references": []
+      },
+      {
+        "flags": "SymbolFlags(TypeAlias)",
+        "id": 6,
+        "name": "Accessors",
+        "node": "TSTypeAliasDeclaration",
+        "references": []
+      }
+    ]
+  }
+]
```

**File**: `crates/oxc_semantic/tests/fixtures/oxc/ts/interfaces/computed-method-key-scope.ts` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+declare const x: unique symbol;
+
+interface I {
+    [x](x: number): void;
+}
+
+type Method = {
+    [x]<x>(value: x): void;
+};
+
+type Accessors = {
+    get [x](): number;
+    set [x](x: number);
+};
```

---

### Incident Patch 5: `e4443dce` (2026-10-05)
**Commit Message**: fix(lexer): context walk line break and type end rules (#27353)

- != at the start of a line continues the expression and as or satisfies there ends it, as tsc does; a type that ends a line goes on with an initializer or a body, and on one line a type ends at any token that cannot continue it (x as T - 1, c ? x as T : y)
- simplifies the walk steps and anchors a walk at a function or class only where a declaration starts, disambiguate is 380 code lines shorter
- every valid input whose tokens change now matches tsc, main set neutral

**File**: `crates/oxc_lexer/src/pipeline/disambiguate/context/anchor.rs` (modified, +19/-134)
```diff
@@ -1,8 +1,3 @@
-//! Anchors: tokens whose context is certain from their neighbours alone, where a bounded walk
-//! may start. Statement keywords that are not property names, members or JSX attributes; a
-//! `function` or `class` whose token before says declaration or expression; the `(` whose group
-//! holds the query when the token before makes it an expression's.
-
 use crate::token::{OP_KIND_BASE, matches_tk, tk};
 
 use super::*;
@@ -16,8 +11,7 @@ use crate::pipeline::disambiguate::{
 pub(super) enum Anchor {
     /// A statement starts at the token here.
     Stmt(usize),
-    /// An operand starts at the token here: an expression-position `function` / `class`, or the
-    /// `(` whose group holds the query.
+    /// An operand starts at the paren here, whose group holds the query.
     Expr(usize),
     /// The bounded walk already covers this point and continues from where it stopped.
     /// It first leaves the group from open to close that it stopped in, when close is not 0.
@@ -86,117 +80,6 @@ fn stmt_boundary(tokens: &Tokens, p: usize, prev: Prev) -> bool {
     }
 }
 
-/// `function` / `class` at `at` (`async` for `async function`): a declaration or an expression,
-/// read off the token before. `named` says a name follows (a label's `:` then precedes a
-/// declaration, a property's an expression; only a name allows ASI to start a declaration).
-fn fn_class_anchor(
-    tokens: &Tokens,
-    at: usize,
-    prev: Prev,
-    class: bool,
-    named: bool,
-) -> Option<Anchor> {
-    let broken = |q: usize| {
-        let e = tokens.next_start(q + 1);
-        tokens.line_break_between(e, at)
-    };
-    let stmt = Some(Anchor::Stmt(at));
-    let expr = Some(Anchor::Expr(at));
-    match prev {
-        Prev::None => stmt,
-        Prev::Op(q, c) => match c {
-            b';' | b'{' => stmt,
-            b'}' => {
-                if in_jsx_tag(tokens, at) {
-                    None
-                } else {
-                    stmt
-                }
-            }
-            // `if (x) function f() {}`; a decorator's `)` before a class expression.
-            b')' => {
-                if !class || (named && broken(q)) {
-                    stmt
-                } else {
-                    None
-                }
-            }
-            b']' => {
-                if named && broken(q) {
-                    stmt
-                } else {
-                    None
-                }
-            }
-            b'>' if q > 0 && tokens.src[q - 1] == b'=' => expr,
-            // A value or type ended on the previous line.
-            b'>' => {
-                if named && broken(q) {
-                    stmt
-                } else {
-                    expr
-                }
-            }
-            b'+' | b'-' if tokens.src[q + 1] == c || (q > 0 && tokens.src[q - 1] == c) => {
-                if named && broken(q) { stmt } else { None }
-            }
-            b':' => {
-                if named {
-                    None
-                } else {
-                    expr
-                }
-            }
-            // A generator method named function, as in { *function() {} }.
-            b'*' if !named => None,
-            // A TypeScript postfix non-null ends a value at a line break too.
-            b'!' if tokens.ts && named && broken(q) => None,
-            _ => expr,
-        },
-        Prev::Word(_, tk!(KwElse | KwDo | KwExport | KwDefault | KwDeclare | KwAbstract)) => stmt,
-        // A name or type these spell ends a value at a line break: the walk decides.
-        Prev::Word(q, tk!(KwAwait | KwOf | KwVoid)) if named && broken(q) => None,
-        // Restricted productions: a line break ends the statement.
-        Prev::Word(q, tk!(KwReturn | KwYield)) => {
-            if named && broken(q) {
-                stmt
-            } else {
-                expr
-            }
-        }
-        #[rustfmt::skip]
-        Prev::Word(
-            _,
-            tk!(KwTypeof | KwThrow | KwAwait | KwVoid | KwDelete | KwNew | KwIn | KwOf | KwInstanceof | KwCase)
-        ) => expr,
-        // A heritage expression: what follows it is the enclosing class's body.
-        Prev::Word(_, tk!(KwExtends)) => None,
-        Prev::Word(q, _) | Prev::Other(q) => {
-            if named && broken(q) {
-                stmt
-            } else {
-                None
-            }
-        }
-    }
-}
-
-/// `function` at `at` (or the `async` before it), with the token after `function` at `f`: a named
-/// function is a declaration or an expression by its context; an anonymous one is an expression,
-/// or a method named `function`, which is no anchor.
-fn function_anchor(tokens: &Tokens, at: usize, prev: Prev, f: Peek) -> Option<Anchor> {
-    if f.kind == tk!(Ident) || (f.kind >= OP_KIND_BASE && f.byte == b'*') {
-        fn_class_anchor(tokens, at, prev, false, true)
-    } else if f.kind >= OP_KIND_BASE && f.byte == b'(' {
-        match fn_class_ancho
```

**File**: `crates/oxc_lexer/src/pipeline/disambiguate/context/frame.rs` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ pub(super) const R_EXPR: u8 = 5; // `as T` / `satisfies T`: ends at any expressi
 // What an Angle list is (`state`).
 pub(super) const A_VALUE: u8 = 1; // declaration type parameters or `f<T>(x)` type arguments
 pub(super) const A_IN_TYPE: u8 = 3; // a list inside a type
-pub(super) const A_ASSERT: u8 = 4; // `<T>x` assertion or `<T,>() =>` generic arrow
+pub(super) const A_ASSERT: u8 = 4; // an operand follows: an assertion or leading type parameters
 
 // ClassHead: an interface head (reg).
 pub(super) const C_INTERFACE: u8 = 1;
```

**File**: `crates/oxc_lexer/src/pipeline/disambiguate/context/jsx.rs` (modified, +0/-3)
```diff
@@ -38,9 +38,6 @@ impl Walk {
                 self.jsx_element_done();
                 pos + 1
             }
-            tk!(JsxText | String | Ident | Number | BigInt | TemplateNoSub) => {
-                tokens.next_start(pos + 1)
-            }
             _ if k >= OP_KIND_BASE => {
                 match c {
                     b'{' => {
```

**File**: `crates/oxc_lexer/src/pipeline/disambiguate/context/mod.rs` (modified, +1/-4)
```diff
@@ -137,8 +137,5 @@ impl Walks {
 /// [`after`] on the full walk from the start of the source: needed when the answer depends on the
 /// enclosing functions (`yield` / `await`).
 pub(super) fn after_scoped(tokens: &Tokens, walks: &mut Walks, pos: usize) -> After {
-    let w = walks.full_to(tokens, pos);
-    // A query inside the token just processed (the tail of a fused operator run such as `>>>`)
-    // is answered by the state after it.
-    if w.walked_to > pos { w.classify_after() } else { w.after_token(tokens, pos) }
+    walks.full_to(tokens, pos).after_token(tokens, pos)
 }
```

**File**: `crates/oxc_lexer/src/pipeline/disambiguate/context/punct.rs` (modified, +112/-245)
```diff
@@ -22,173 +22,86 @@ impl Walk {
             if c == b'<' && c1 == b'<' {
                 len = 1;
             }
-            if c == b'=' && c1 == b'>' {
-                len = 2;
-            }
-            return self.type_op(tokens, pos, c, len);
+            return self.type_op(pos, c, len);
         }
 
+        let postfix = !self.operand_allowed() && !newline;
         match c {
-            b'{' => {
-                self.open_brace();
-                pos + 1
-            }
-            b'}' => {
-                self.close_brace();
-                pos + 1
-            }
-            b'(' => {
-                self.open_paren();
-                pos + 1
-            }
-            b')' => {
-                self.close_paren();
-                pos + 1
-            }
-            b'[' => {
-                self.open_bracket();
-                pos + 1
-            }
-            b']' => {
-                self.close_bracket();
-                pos + 1
-            }
-            b';' => {
-                self.semicolon();
-                pos + 1
-            }
-            b',' => {
-                self.comma();
-                pos + 1
-            }
-            b':' => {
-                self.colon(tokens);
-                pos + 1
-            }
+            b'{' => self.open_brace(),
+            b'}' => self.close_brace(),
+            b'(' => self.open_paren(),
+            b')' => self.close_paren(),
+            b'[' => self.open_bracket(),
+            b']' => self.close_bracket(),
+            b';' => self.semicolon(),
+            b',' => self.comma(),
+            b':' => self.colon(tokens),
+            b'?' if len == 1 => self.question(tokens, pos),
+            // Optional chaining or nullish coalescing.
             b'?' => {
-                if len >= 2 {
-                    // `?.` / `??` / `??=`
-                    self.operand_done();
-                    self.after_dot = c1 == b'.';
-                    return pos + len;
+                self.operand_done();
+                self.after_dot = c1 == b'.';
+            }
+            // A spread: what follows is a value, not a member key.
+            b'.' if len == 3 => {
+                if self.top_kind() == FrameKind::Object {
+                    self.top_mut().state = M_VALUE;
                 }
-                self.question(tokens, pos);
-                pos + 1
+                self.operand_done();
             }
+            // The dot of a number such as 1. continues the literal.
+            b'.' if tokens.numeric_dot(pos) => self.set_value(),
             b'.' => {
-                if len == 3 {
-                    // spread: what follows is a value, not a member key
-                    if self.top_kind() == FrameKind::Object {
-                        self.top_mut().state = M_VALUE;
-                    }
-                    self.operand_done();
-                    return pos + 3;
-                }
-                if tokens.numeric_dot(pos) {
-                    // `1.` continues the numeric literal.
-                    self.set_value();
-                    return pos + 1;
-                }
                 self.operand_done();
                 self.after_dot = true;
-                pos + 1
             }
-            b'=' => {
-                if len == 2 && c1 == b'>' {
-                    self.arrow(tokens, pos);
-                    return pos + 2;
-                }
-                if len == 1 {
-                    self.assign();
-                    return pos + 1;
-                }
-                // `==` / `===`
-                self.operand_done();
-                pos + len
+            b'=' if len == 2 && c1 == b'>' => self.arrow(tokens, pos),
+            b'=' if len == 1 => self.assign(),
+            // A postfix non-null assertion, or a definite assignment.
+            b'!' if len == 1 && tokens.ts && postfix => self.value_done(),
+            // A postfix increment or decrement keeps the value.
+            b'+' | b'-' if len == 2 && c1 == c && postfix => self.value_done(),
+            b'*' if len == 1 && self.top_kind() == FrameKind::FnHead => {
+                self.top_mut().is_generator = true;
+                self.value_done();
+                self.prev_kw = tk!(KwFunction);
             }
-            b'!' => {
-                if len == 1 && tokens.ts && !self.operand_allowed() && !newline {
-                    // Postfix non-null / definite assignment.
-                    self.value_done();
-                    return pos + 1;
-                }
-                self.operand_done();
-                pos + len
-            }
-            b'+' | b'-' => {
-                if len == 2 && c1 == c {
-                    // `++` / `--`: postfix keeps the value.
-                    if !self.operand_allowed() && !newline {
-                        self.value_done();
-                    } else {
-                        self.operand_done();
-                    }
-    
```

**File**: `crates/oxc_lexer/src/pipeline/disambiguate/context/scan.rs` (modified, +4/-12)
```diff
@@ -17,9 +17,9 @@ use super::*;
 use crate::pipeline::disambiguate::WALK_SCAN_CAP;
 
 struct Scan {
-    pub(super) anchor: Anchor,
+    anchor: Anchor,
     /// Unmatched `<` on the query's own level: the type lists a `>` run there could close.
-    pub(super) angles: u32,
+    angles: u32,
 }
 
 /// What the scan has seen on the level it is in, nearest to the query first: the last `;`, `,`
@@ -29,16 +29,13 @@ struct Level<'a> {
     semi: Option<usize>,
     comma: Option<usize>,
     brace: Option<usize>,
-    /// A braced group was skipped: an expression anchor on the level ended before the query.
-    braces: bool,
     closers: &'a mut Vec<u32>,
 }
 
 impl Level<'_> {
     /// Nothing seen yet on a level the scan enters through its opener.
     fn enter(&mut self) {
         self.inside_list();
-        self.braces = false;
         self.closers.clear();
     }
 
@@ -92,7 +89,7 @@ fn scan(
     let mut steps = 0u32;
     // Brackets opened (going back) between the query and the position scanned.
     let mut level = 0u32;
-    let mut lv = Level { semi: None, comma: None, brace: None, braces: false, closers: gts };
+    let mut lv = Level { semi: None, comma: None, brace: None, closers: gts };
     // Unmatched `<` found on the query's own level.
     let mut unmatched_lt = 0u32;
     let mut q = tokens.prev_sig(from);
@@ -125,7 +122,6 @@ fn scan(
                     if c == b'}' && lv.brace.is_none() && lv.closers.is_empty() {
                         lv.brace = brace_boundary(tokens, p);
                     }
-                    lv.braces |= c == b'}';
                     jumps.push(Jump::Skip { at: o as u32, to: p as u32 });
                     q = tokens.prev_sig(o);
                     continue;
@@ -187,8 +183,6 @@ fn scan(
             }
         } else if k == tk!(Ident) {
             let (kw, anchor) = anchor_at(tokens, p);
-            // A function or class expression is certain only for a query inside it.
-            let anchor = anchor.filter(|a| !(lv.braces && matches!(a, Anchor::Expr(_))));
             if let Some(anchor) = anchor {
                 let at = match anchor {
                     Anchor::Stmt(a) | Anchor::Expr(a) => a,
@@ -287,9 +281,7 @@ pub(crate) fn after(tokens: &Tokens, walks: &mut Walks, pos: usize) -> After {
         None
     };
     let from = from.unwrap_or(pos);
-    if let Some(a) = local_walk(tokens, walks, pos, from, |w, tokens| {
-        if w.walked_to > pos { w.classify_after() } else { w.after_token(tokens, pos) }
-    }) {
+    if let Some(a) = local_walk(tokens, walks, pos, from, |w, tokens| w.after_token(tokens, pos)) {
         return a;
     }
     after_scoped(tokens, walks, pos)
```

**File**: `crates/oxc_lexer/src/pipeline/disambiguate/context/step.rs` (modified, +37/-61)
```diff
@@ -15,59 +15,15 @@ fn continues_expression(tokens: &Tokens, pos: usize) -> bool {
         if (c == b'+' || c == b'-') && c1 == c {
             return false;
         }
-        return matches!(
-            c,
-            b'+' | b'-'
-                | b'*'
-                | b'/'
-                | b'%'
-                | b'&'
-                | b'|'
-                | b'^'
-                | b'<'
-                | b'>'
-                | b'='
-                | b'?'
-                | b'.'
-                | b','
-                | b'('
-                | b'['
-                | b':'
-                | b')'
-                | b']'
-                | b'}'
-        );
+        return b"+-*/%&|^<>=?.,([:)]}".contains(&c) || (c == b'!' && c1 == b'=');
     }
+    // tsc ends the expression before an as or satisfies on a new line.
     if k == tk!(Ident) {
-        let kw = tokens.ident_kw(pos);
-        return matches_tk!(kw, KwIn | KwInstanceof)
-            || (tokens.ts && matches_tk!(kw, KwAs | KwSatisfies));
+        return matches_tk!(tokens.ident_kw(pos), KwIn | KwInstanceof);
     }
     matches_tk!(k, TemplateHead | TemplateNoSub)
 }
 
-/// Can `pos` continue a type after a completed type atom on the previous line? `.`, `|`, `&` may
-/// follow a line break; `[`, `<`, `extends` may not.
-fn continues_type_after_break(tokens: &Tokens, pos: usize) -> bool {
-    let k = tokens.base_kind(pos);
-    if k >= OP_KIND_BASE {
-        let c = tokens.src[pos];
-        let c1 = tokens.src[pos + 1];
-        return (c == b'.' && c1 != b'.')
-            || (c == b'|' && c1 != b'|')
-            || (c == b'&' && c1 != b'&')
-            || c == b'?'
-            || c == b':'
-            || c == b','
-            || c == b')'
-            || c == b']'
-            || c == b'}'
-            || c == b'>'
-            || (c == b'=' && c1 == b'>');
-    }
-    false
-}
-
 impl Walk {
     pub(super) fn step(&mut self, tokens: &Tokens, pos: usize) -> usize {
         self.last_start = pos;
@@ -95,11 +51,10 @@ impl Walk {
         if newline && !self.operand_allowed() && !continues_expression(tokens, pos) {
             self.asi(tokens, pos);
         }
-        // `let x` then a line break: only `=`, `,`, `;`, `:` and `!` can continue the declarator,
-        // anything else starts a new statement.
+        // A binding that ended the line goes on with =, a comma or a type annotation only.
         if newline && !self.operand_allowed() && self.top_declarator() == D_BOUND {
             let c = tokens.src[pos];
-            if !(k >= OP_KIND_BASE && matches!(c, b'=' | b',' | b';' | b':' | b'!')) {
+            if !(k >= OP_KIND_BASE && matches!(c, b'=' | b',' | b':')) {
                 self.end_statement();
             }
         }
@@ -108,7 +63,7 @@ impl Walk {
         if newline
             && self.top_kind() == FrameKind::TypeRegion
             && self.top().atom
-            && !continues_type_after_break(tokens, pos)
+            && !self.continues_after_type_break(tokens, pos)
         {
             self.end_region_by_break();
         }
@@ -123,6 +78,13 @@ impl Walk {
         {
             self.end_statement();
         }
+        // A token that cannot continue a completed type ends it, as in x as T - 1.
+        if self.top_kind() == FrameKind::TypeRegion
+            && self.top().atom
+            && !self.continues_type(tokens, pos, k)
+        {
+            self.end_region_for();
+        }
         let end = match k {
             tk!(Ident) => self.step_word(tokens, pos),
             tk!(Number | BigInt | String | RegExp | TemplateNoSub | PrivateIdent) => {
@@ -175,21 +137,18 @@ impl Walk {
         // A head continues onto the next line when its body (or more head) follows; otherwise the
         // break ends a bodiless signature.
         if matches!(self.top_kind(), FrameKind::FnHead | FrameKind::ClassHead) {
-            let c = tokens.src[pos];
             let k = tokens.base_kind(pos);
-            if k >= OP_KIND_BASE && (c == b'{' || c == b'<' || c == b'(') {
-                return;
-            }
             // Right after `function` / `class`, the name (or a generator's `*`) may follow a
             // line break: nothing has been declared yet, so there is no signature to end.
             let unnamed = matches_tk!(self.prev_kw, KwFunction | KwClass);
-            if unnamed && (k == tk!(Ident) || (k >= OP_KIND_BASE && c == b'*')) {
-                return;
-            }
-            if k == tk!(Ident) && matches_tk!(tokens.ident_kw(pos), KwExtends | KwImplements) {
-                return;
+            let goes_on = if k == tk!(Ident) {
+                unnamed || matches_tk!(tokens.ident_kw(pos), KwExtends | KwImplements)
+            } else {
+                k >= OP_KIND_BASE && tokens.src[pos] == b'{'
+            };
+            if !goes_on {
+                self.end_statement();
             }
-            self.end_statement();
             return;
         }
   
```

**File**: `crates/oxc_lexer/src/pipeline/disambiguate/context/types.rs` (modified, +64/-133)
```diff
@@ -1,6 +1,8 @@
 //! Punctuation inside a type: type regions and how each kind of region ends, angle lists,
 //! and the `<` that may open one.
 
+use crate::token::{OP_KIND_BASE, matches_tk, tk};
+
 use super::*;
 
 impl Walk {
@@ -9,204 +11,133 @@ impl Walk {
         self.operand_done();
     }
 
-    /// End the type region on top because `pos` is an expression token. Returns true if a region
-    /// was ended.
-    fn end_region_for(&mut self) -> bool {
+    /// End the type region on top because the token after it belongs to the expression.
+    pub(super) fn end_region_for(&mut self) {
         if self.top_kind() != FrameKind::TypeRegion {
-            return false;
+            return;
         }
         let r = self.pop();
         self.set_value();
-        if r.state == R_EXPR {
-            self.no_type_args = true;
+        match r.state {
+            R_EXPR => self.no_type_args = true,
+            // The arrow after a return type takes the async of the parameter group.
+            R_ARROW_RET => {
+                self.closed_group = true;
+                self.closed_group_async = r.mods & MOD_ASYNC != 0;
+            }
+            _ => {}
+        }
+    }
+
+    /// Can the token at pos, of base kind k, continue the type the region on top completed?
+    pub(super) fn continues_type(&self, tokens: &Tokens, pos: usize, k: u8) -> bool {
+        if k == tk!(Ident) {
+            // A conditional type or a type predicate.
+            return matches_tk!(tokens.ident_kw(pos), KwExtends | KwIs);
+        }
+        if k < OP_KIND_BASE {
+            return false;
+        }
+        let (c, c1, r) = (tokens.src[pos], tokens.src[pos + 1], self.top());
+        match c {
+            b'|' | b'&' => c1 != c,
+            b'.' | b'[' => true,
+            // Only a name takes type arguments.
+            b'<' => !self.no_type_args && c1 != b'=',
+            // The rest of a conditional type.
+            b'?' | b':' => r.open_questions > 0,
+            // The arrow of a function type.
+            b'=' => c1 == b'>' && r.inner,
+            // An import equals require call.
+            b'(' => r.state == R_STMT,
+            _ => false,
         }
-        true
     }
 
-    pub(super) fn type_op(&mut self, tokens: &Tokens, pos: usize, c: u8, len: usize) -> usize {
+    pub(super) fn type_op(&mut self, pos: usize, c: u8, len: usize) -> usize {
         let top = self.top_kind();
         match c {
             b'(' => {
                 self.push(FrameKind::TypeParen);
                 self.operand_done();
-                pos + 1
             }
             b')' => {
                 if top == FrameKind::TypeParen {
                     self.pop();
                     self.type_atom(true);
-                    return pos + 1;
+                } else {
+                    // Closes something outside the type.
+                    self.pop_virtual();
+                    self.close_paren();
                 }
-                // Closes something outside the type.
-                self.pop_virtual();
-                self.close_paren();
-                pos + 1
             }
             b'[' => {
                 self.push(FrameKind::TypeBracket);
                 self.operand_done();
-                pos + 1
             }
             b']' => {
                 if top == FrameKind::TypeBracket {
                     self.pop();
                     self.type_atom(false);
-                    return pos + 1;
+                } else {
+                    self.pop_virtual();
+                    self.close_bracket();
                 }
-                self.pop_virtual();
-                self.close_bracket();
-                pos + 1
             }
             b'{' => {
-                if top == FrameKind::TypeRegion && self.top().atom {
-                    // A body follows a completed type (`): T {`).
-                    self.pop();
-                    self.set_value();
-                    self.open_brace();
-                    return pos + 1;
-                }
                 self.push(FrameKind::TypeLit);
                 self.operand_done();
-                pos + 1
             }
             b'}' => {
-                if top == FrameKind::TypeLit {
-                    let f = self.pop();
-                    if f.state == L_INTERFACE_BODY {
-                        // Interface body done: statement over.
-                        self.end_statement();
-                        return pos + 1;
-                    }
+                if top != FrameKind::TypeLit {
+                    self.pop_virtual();
+                    self.close_brace();
+                } else if self.pop().state == L_INTERFACE_BODY {
+                    // Interface body done: statement over.
+                    self.end_statement();
+                } else {
                     self.type_atom(false);
-                    return pos + 1;
                 }
-                self.pop_virtual();
-  
```

---

### Incident Patch 6: `eec94b27` (2026-10-05)
**Commit Message**: chore(codegen): revert remove unused minified-printing support (#27340)

This reverts commit b98722887c18f1207e2bb3ec924d09d4d01be4c3.

**File**: `packages/codegen/DESIGN.md` (modified, +19/-14)
```diff
@@ -124,10 +124,11 @@ This has 3 advantages over storing the last character:
 
 That one `last` field replaces all of this:
 
-| Rust                                 | Question it answers                 | JS             |
-| :----------------------------------- | :---------------------------------- | :------------- |
-| `last_byte()` + `is_identifier_part` | Would a following identifier merge? | `CAT_IDENT`    |
-| `last_byte() == Some(b'?')`          | Would a following `?` make `??`?    | `CAT_QUESTION` |
+| Rust                                  | Question it answers                 | JS                       |
+| :------------------------------------ | :---------------------------------- | :----------------------- |
+| `last_byte()` + `is_identifier_part`  | Would a following identifier merge? | `CAT_IDENT`              |
+| `last_byte() == Some(b'?')`           | Would a following `?` make `??`?    | `CAT_QUESTION`           |
+| `peek_nth_byte_back(1) == Some(b'<')` | Is this `!` the `!` of a `<!`?      | `CAT_OP_UN_NOT_AFTER_LT` |
 
 ### Extending this scheme to operators
 
@@ -151,21 +152,25 @@ to avoid the huge perf hit of reading the last character from `output`.
 
 So we might as well use `last` to record operators too, and also some similar character classes:
 
-| Rust                                    | Question it answers                                     | JS              |
-| :-------------------------------------- | :------------------------------------------------------ | :-------------- |
-| `code.len() == prev_op_end` + `prev_op` | Which operator came last, and was it right before this? | `CAT_OP_*`      |
-| `code.len() == need_space_before_dot`   | Is space needed after digit? e.g. `0 .toExponential()`  | `CAT_INT_DIGIT` |
+| Rust                                    | Question it answers                                     | JS                |
+| :-------------------------------------- | :------------------------------------------------------ | :---------------- |
+| `code.len() == prev_op_end` + `prev_op` | Which operator came last, and was it right before this? | `CAT_OP_*`        |
+| `code.len() == need_space_before_dot`   | Is space needed after digit? e.g. `0 .toExponential()`  | `CAT_INT_DIGIT`   |
+| `code.len() == prev_reg_exp_end`        | Did a flagless regex just close?                        | `CAT_REGEX_SLASH` |
 
 All these Rust state fields, and every read of the output buffer, collapse into one field in the JS printer.
 
 It costs no write barrier to store (because categories are represented by "SMI" small integers), and one compare
 to test. Being touched by every single write, it is the hottest field in `State`, reliably in L1 cache,
 and probably often also benefits from fast store-to-load forwarding.
 
-The JS printer only produces pretty output. Binary operators always have spaces around them, so
-`<` followed by `!--` cannot become `<!--`, and a regex literal cannot merge with a following
-binary operator or keyword. These cases need no additional categories. Unary operators still
-need separation: `+ +x` and `- --x` must keep their spaces.
+#### The `<!--` case, as an example
+
+Rust decides whether a `!` is the `!` of a `<!--` hazard by peeking at the _second_-to-last byte,
+at the moment a `--` is about to be written.
+
+Here the question is answered when the `!` is written, where the preceding character is already known,
+and the answer is baked into which category gets stored. The reader has nothing left to look up.
 
 ### Position marks
 
@@ -228,9 +233,9 @@ The full table is at the top of [`print/categories.ts`] and is the authority.
 
 Three properties are relied on. Adding a code without preserving them will silently space output wrongly.
 
-1. **Identifier hazards are the lowest codes.** So `printSpaceBeforeIdentifier` is `last <= CAT_INT_DIGIT` -
+1. **Identifier hazards are the lowest codes.** So `printSpaceBeforeIdentifier` is `last <= CAT_REGEX_SLASH` -
    one compare, no table, no branch tree. The operators `printSpaceBeforeOperator` must distinguish are the highest,
-   for the same reason (`last >= CAT_OP_UN_PLUS`).
+   for the same reason (`last >= CAT_OP_UN_NOT_AFTER_LT`).
 2. **The `CAT_START_OF_*` codes sit between those two ranges**, which is what makes both range checks
    treat them as "nothing to separate".
 3. **`CAT_START_OF_STMT` is odd, with the other two marks either side.** The five reader sites each ask
```

**File**: `packages/codegen/src-js/print/categories.ts` (modified, +31/-7)
```diff
@@ -15,8 +15,8 @@ import { debugAssert } from "../asserts.ts";
 //
 // Three properties of the layout are load bearing, so keep them if you add a code:
 //
-// 1. `CAT_IDENT` through `CAT_INT_DIGIT` are the classes needing a space before a following identifier,
-//    and they are the lowest codes, so `printSpaceBeforeIdentifier` is one compare against `CAT_INT_DIGIT`.
+// 1. `CAT_IDENT` through `CAT_REGEX_SLASH` are the classes needing a space before a following identifier,
+//    and they are the lowest codes, so `printSpaceBeforeIdentifier` is one compare against `CAT_REGEX_SLASH`.
 //    The unary and update operators are likewise contiguous, and the highest codes, so `printSpaceBeforeOperator`
 //    is one compare too.
 //
@@ -30,9 +30,10 @@ import { debugAssert } from "../asserts.ts";
 //
 // The whole numbering:
 //
-// Group 0 to 1: A following identifier needs a space (`printSpaceBeforeIdentifier` checks `last <= CAT_INT_DIGIT`)
+// Group 0 to 2: A following identifier needs a space (`printSpaceBeforeIdentifier` checks `last <= CAT_REGEX_SLASH`)
 //    0  CAT_IDENT                      Identifier part - letters, digits, `_`, `$`, ID_Continue
 //    1  CAT_INT_DIGIT                  Numeric literal of plain digits (`0 .toExponential()`)
+//    2  CAT_REGEX_SLASH                Regex closed with no flags
 //
 // Group 3 to 10: Checked individually
 //    3  CAT_OTHER                      Anything else not covered by another category - punctuation, whitespace
@@ -44,7 +45,8 @@ import { debugAssert } from "../asserts.ts";
 //    9  CAT_CLOSE_BRACKET              `)` or `]`
 //   10  CAT_OP_UN_NOT                  `!`
 //
-// Group 12 to 15: Operators `printSpaceBeforeOperatorSlow` needs to tell apart (`last >= CAT_OP_UN_PLUS`)
+// Group 11 to 15: Operators `printSpaceBeforeOperatorSlow` needs to tell apart (`last >= CAT_OP_UN_NOT_AFTER_LT`)
+//   11  CAT_OP_UN_NOT_AFTER_LT         `!` written straight after a `<`
 //   12  CAT_OP_UN_PLUS                 `+`
 //   13  CAT_OP_UPD_INC                 `++`
 //   14  CAT_OP_UN_NEG                  `-`
@@ -57,6 +59,7 @@ import { debugAssert } from "../asserts.ts";
 export type Category =
   | typeof CAT_IDENT
   | typeof CAT_INT_DIGIT
+  | typeof CAT_REGEX_SLASH
   | typeof CAT_OTHER
   | typeof CAT_LT
   | typeof CAT_QUESTION
@@ -65,6 +68,7 @@ export type Category =
   | typeof CAT_START_OF_DEFAULT_EXPORT
   | typeof CAT_CLOSE_BRACKET
   | typeof CAT_OP_UN_NOT
+  | typeof CAT_OP_UN_NOT_AFTER_LT
   | typeof CAT_OP_UN_PLUS
   | typeof CAT_OP_UPD_INC
   | typeof CAT_OP_UN_NEG
@@ -79,10 +83,18 @@ export const CAT_IDENT = 0;
  */
 export const CAT_INT_DIGIT = 1;
 
+/**
+ * A regex's closing `/`, written only where the regex has no flags.
+ *
+ * In the identifier range because `/a/ in x` needs the space just as much as `x in y` does -
+ * without it the `in` would be read as regex flags. With flags, `CAT_IDENT` says the same thing.
+ */
+export const CAT_REGEX_SLASH = 2;
+
 /** Anything not covered by another category - punctuation, whitespace, a quote. */
 export const CAT_OTHER = 3;
 
-/** `<`, which must not merge with a following `<` in a TypeScript type assertion. */
+/** `<`, which a following `!` must not merge with into `<!--`. */
 export const CAT_LT = 4;
 
 /** `?`, which must not merge with a following `?` into `??` - see `TSJSDocNullableType`. */
@@ -131,13 +143,23 @@ export const CAT_START_OF_ARROW_EXPR = 8;
 export const CAT_CLOSE_BRACKET = 9;
 
 /**
- * `!`, both the unary operator and TS's postfix `!` (non-null assertion, definite assignment).
+ * `!`, written anywhere other than straight after a `<` - both the unary operator and TS's
+ * postfix `!` (non-null assertion, definite assignment), which postfix position keeps off a `<`.
  *
  * An operator code, but deliberately below the range `printSpaceBeforeOperator` gates on -
  * no following operator merges with a plain `!`, so storing this never costs the slow path a call.
  */
 export const CAT_OP_UN_NOT = 10;
 
+/**
+ * `!` written immediately after a `<`, which is the `<!--` hazard.
+ * Folding the check on the preceding character into the code saves tracking the second-last character.
+ *
+ * The first of the operators `printSpaceBeforeOperator` gates on - writing one of these
+ * is what records it, so no separate field tracks which operator came last.
+ */
+export const CAT_OP_UN_NOT_AFTER_LT = 11;
+
 /** `+`, which must not merge with a following `+` or `++`. */
 export const CAT_OP_UN_PLUS = 12;
 
@@ -147,7 +169,7 @@ export const CAT_OP_UPD_INC = 13;
 /** `-`, which must not merge with a following `-` or `--`. */
 export const CAT_OP_UN_NEG = 14;
 
-/** `--`, which must not follow a `-` without a space. */
+/** `--`, which must not follow a `-`, nor the `!` of a `<!`. */
 export const CAT_OP_UPD_DEC = 15;
 
 /**
@@ -159,6 +181,7 @@ export const CAT_OP_UPD_DEC = 15;
 export const ALL_CATEGORIES: Category[] = [
   CAT_IDENT,
   CAT_INT_DIGIT,
+  CAT_REGEX_SLASH,
   CAT_OTHER,
   CAT_LT,
```

**File**: `packages/codegen/src-js/print/expression.ts` (modified, +10/-1)
```diff
@@ -8,7 +8,9 @@ import {
   CAT_CLOSE_BRACKET,
   CAT_IDENT,
   CAT_INT_DIGIT,
+  CAT_LT,
   CAT_OP_UN_NOT,
+  CAT_OP_UN_NOT_AFTER_LT,
   CAT_OTHER,
   CAT_QUESTION,
   CAT_START_OF_ARROW_EXPR,
@@ -678,6 +680,9 @@ function printUpdateExpression(
 /**
  * Wraps from `PREC_PREFIX` upwards and prints its argument at `PREC_EXPONENTIATION`,
  * so a `**` operand takes parens of its own - `-a ** b` does not parse.
+ *
+ * A `!` written straight after a `<` records a category of its own, so that a `--`
+ * printed next is spaced off it and cannot complete `<!--`.
  */
 function printUnaryExpression(
   node: ESTree.UnaryExpression,
@@ -699,8 +704,12 @@ function printUnaryExpression(
     isDeleteInfinity =
       operator === "delete" && node.argument.type === "Literal" && node.argument.value === Infinity;
   } else {
-    const operatorCode = unaryOperatorCode(operator);
+    let operatorCode = unaryOperatorCode(operator);
     printSpaceBeforeOperator(state, operatorCode);
+    debugAssertLastFresh(state);
+    if (operatorCode === CAT_OP_UN_NOT && state.last === CAT_LT) {
+      operatorCode = CAT_OP_UN_NOT_AFTER_LT;
+    }
     writeWithMap(state, operator, operatorCode, node.start, node.end, node);
   }
 
```

**File**: `packages/codegen/src-js/print/literal.ts` (modified, +26/-1)
```diff
@@ -7,6 +7,7 @@ import {
   CAT_INT_DIGIT,
   CAT_OP_UN_NEG,
   CAT_OTHER,
+  CAT_REGEX_SLASH,
 } from "./categories.ts";
 import { write, writeIdent, writeNoLast, writeWithMap, writeWithMapNoLast } from "./write.ts";
 import { printSpaceBeforeIdentifier, printSpaceBeforeOperator } from "./space.ts";
@@ -148,14 +149,38 @@ function printNumericLiteral(
 
 /**
  * Print a regex literal from its pattern and flags.
+ *
+ * A regex with no flags ends in `/`, which is recorded as its own category, because a `/`
+ * immediately after it would open a comment.
  */
 function printRegExpLiteral(node: ESTree.RegExpLiteral, state: State): void {
+  // Neither of the separating spaces below can be needed in pretty mode, so the check is not made.
+  // Both guard against a regex being written immediately after something, and nothing can be
+  // immediately before a regex here: every operator which could put one after a `/` or a `<` is
+  // written space padded, so `last` is always the space.
+  //
+  // A minified mode would stop padding operators and make both reachable again, so this code would
+  // need to be restored. `CAT_REGEX_SLASH` is left in place for that - the code is still written
+  // after a flagless regex, and it still sits in the range `printSpaceBeforeIdentifier` tests,
+  // which costs nothing and is what keeps this a 4 line restoration.
+  //
+  //   debugAssertLastFresh(state);
+  //   const { last } = state;
+  //   if (last === CAT_REGEX_SLASH || (last === CAT_LT && /^script/i.test(pattern.slice(0, 6)))) {
+  //     write(state, " ", CAT_OTHER);
+  //   }
+  //
+  // * `last === CAT_REGEX_SLASH` keeps `/a//b/` from lexing as a line comment
+  // * `CAT_LT` arm keeps `<` followed by `/script...` from closing a host `<script>` element.
+
   writeWithMapNoLast(state, "/", node.start, node.end, node);
   writeNoLast(state, node.regex.pattern);
 
+  // `CAT_REGEX_SLASH` rather than `CAT_OTHER`. It means "a regex just closed", which is what the
+  // commented-out check above would read. With flags, the flags are what `last` describes instead.
   const { flags } = node.regex;
   if (flags === "") {
-    write(state, "/", CAT_OTHER);
+    write(state, "/", CAT_REGEX_SLASH);
   } else {
     writeNoLast(state, "/");
     writeIdent(state, flags);
```

**File**: `packages/codegen/src-js/print/space.ts` (modified, +28/-13)
```diff
@@ -10,25 +10,27 @@ import {
   CAT_IDENT,
   CAT_INT_DIGIT,
   CAT_OP_UN_NEG,
+  CAT_OP_UN_NOT_AFTER_LT,
   CAT_OP_UN_PLUS,
   CAT_OP_UPD_DEC,
   CAT_OP_UPD_INC,
   CAT_OTHER,
+  CAT_REGEX_SLASH,
 } from "./categories.ts";
 import { debugAssertLastFresh, write } from "./write.ts";
 
 import type { Category } from "./categories.ts";
 import type { State } from "../state.ts";
 
 // `printSpaceBeforeIdentifier` selects the categories needing a space by their position in `Category` numbering.
-// Check `category <= CAT_INT_DIGIT` matches the intended categories, and no others.
+// Check `category <= CAT_REGEX_SLASH` matches the intended categories, and no others.
 if (DEBUG) {
   for (const category of ALL_CATEGORIES) {
-    const expected = [CAT_IDENT, CAT_INT_DIGIT].includes(category);
-    const actual = category <= CAT_INT_DIGIT;
+    const expected = [CAT_IDENT, CAT_INT_DIGIT, CAT_REGEX_SLASH].includes(category);
+    const actual = category <= CAT_REGEX_SLASH;
     debugAssert(
       actual === expected,
-      `Category ${category} disagrees with \`last <= CAT_INT_DIGIT\``,
+      `Category ${category} disagrees with \`last <= CAT_REGEX_SLASH\``,
     );
   }
 }
@@ -46,23 +48,27 @@ export function printSpaceBeforeIdentifier(state: State): void {
   // `last` starts as `CAT_OTHER` (start of output behaves like after whitespace),
   // so no empty-output check is needed.
   // Everything needing a space before an identifier is one of the lowest codes, so this is one compare -
-  // identifier characters and a plain-digit number.
-  if (state.last <= CAT_INT_DIGIT) write(state, " ", CAT_OTHER);
+  // identifier characters, a plain-digit number, and a regex closed with no flags.
+  if (state.last <= CAT_REGEX_SLASH) write(state, " ", CAT_OTHER);
 }
 
 // `printSpaceBeforeOperator` selects the categories needing a space by their position in `Category` numbering.
-// Check `category >= CAT_OP_UN_PLUS` matches the intended categories, and no others.
+// Check `category >= CAT_OP_UN_NOT_AFTER_LT` matches the intended categories, and no others.
 // `CAT_OP_UN_NOT` is deliberately absent - `printSpaceBeforeOperatorSlow` has no clause for a
 // plain `!`, so it sits below the range and storing it costs the slow path nothing.
 if (DEBUG) {
   for (const category of ALL_CATEGORIES) {
-    const expected = [CAT_OP_UN_PLUS, CAT_OP_UPD_INC, CAT_OP_UN_NEG, CAT_OP_UPD_DEC].includes(
-      category,
-    );
-    const actual = category >= CAT_OP_UN_PLUS;
+    const expected = [
+      CAT_OP_UN_NOT_AFTER_LT,
+      CAT_OP_UN_PLUS,
+      CAT_OP_UPD_INC,
+      CAT_OP_UN_NEG,
+      CAT_OP_UPD_DEC,
+    ].includes(category);
+    const actual = category >= CAT_OP_UN_NOT_AFTER_LT;
     debugAssert(
       actual === expected,
-      `Category ${category} disagrees with \`last >= CAT_OP_UN_PLUS\``,
+      `Category ${category} disagrees with \`last >= CAT_OP_UN_NOT_AFTER_LT\``,
     );
   }
 }
@@ -82,7 +88,7 @@ export function printSpaceBeforeOperator(state: State, next: Category): void {
   // The slow path only runs when an operator it distinguishes was the immediately preceding token,
   // which is rare in pretty output. Keep the hot check inlinable.
   const prev = state.last;
-  if (prev >= CAT_OP_UN_PLUS) printSpaceBeforeOperatorSlow(state, prev, next);
+  if (prev >= CAT_OP_UN_NOT_AFTER_LT) printSpaceBeforeOperatorSlow(state, prev, next);
 }
 
 /**
@@ -91,6 +97,14 @@ export function printSpaceBeforeOperator(state: State, next: Category): void {
  *
  * In pretty mode binary operators are written space-padded, so they never leave an operator code in `last`
  * and are never passed as `next` - only unary and update operators reach here.
+ * Oxc's `print_space_before_operator` also has clauses for the binary cases, but those were already
+ * unreachable here, and there is now no code which could produce a binary operator's category.
+ *
+ * Only prefix operators appear as `next` - `+ +y`, `- --y` - which is why `prev` being `++` or
+ * `--` matches no clause. That is not a gap: in pretty output a postfix `++`/`--` is always
+ * followed by punctuation or a padded binary operator, never directly by another operator. (The
+ * asymmetry is the Rust original's, where it is live in minified mode - unpadded `(x++)+y` must
+ * print `x+++y` with no space, while unary `+ +y` must keep one.)
  *
  * @param prev - Category of the operator written last
  * @param next - Category of the operator about to be written
@@ -99,6 +113,7 @@ function printSpaceBeforeOperatorSlow(state: State, prev: Category, next: Catego
   if (
     (prev === CAT_OP_UN_PLUS && (next === CAT_OP_UN_PLUS || next === CAT_OP_UPD_INC))
     || (prev === CAT_OP_UN_NEG && (next === CAT_OP_UN_NEG || next === CAT_OP_UPD_DEC))
+    || (prev === CAT_OP_UN_NOT_AFTER_LT && next === CAT_OP_UPD_DEC)
   ) {
     write(state, " ", CAT_OTHER);
   }
```

**File**: `packages/codegen/src-js/print/write.ts` (modified, +30/-10)
```diff
@@ -11,11 +11,13 @@ import {
   CAT_LT,
   CAT_OP_UN_NEG,
   CAT_OP_UN_NOT,
+  CAT_OP_UN_NOT_AFTER_LT,
   CAT_OP_UN_PLUS,
   CAT_OP_UPD_DEC,
   CAT_OP_UPD_INC,
   CAT_OTHER,
   CAT_QUESTION,
+  CAT_REGEX_SLASH,
 } from "./categories.ts";
 
 import type { Category } from "./categories.ts";
@@ -37,13 +39,14 @@ import type * as ESTree from "../../../../npm/oxc-types/types.d.ts";
  */
 export function write(state: State, code: string, last: Category): void {
   debugAssert(code.length > 0, "`code` should not be an empty string");
-  debugAssertCategoryMatches(code, last);
+  debugAssertCategoryMatches(state, code, last);
 
   state.last = last;
   state.output += code;
 
   if (DEBUG) {
     state.lastIsStale = false;
+    state.lastCharWritten = code[code.length - 1];
   }
 }
 
@@ -59,13 +62,14 @@ export function write(state: State, code: string, last: Category): void {
  */
 export function writeIdent(state: State, code: string): void {
   debugAssert(code.length > 0, "`code` should not be an empty string");
-  debugAssertCategoryMatches(code, CAT_IDENT);
+  debugAssertCategoryMatches(state, code, CAT_IDENT);
 
   state.last = CAT_IDENT;
   state.output += code;
 
   if (DEBUG) {
     state.lastIsStale = false;
+    state.lastCharWritten = code[code.length - 1];
   }
 }
 
@@ -82,14 +86,15 @@ export function writeIdent(state: State, code: string): void {
  */
 export function writePrivate(state: State, name: string): void {
   debugAssert(name.length > 0, "`name` should not be an empty string");
-  debugAssertCategoryMatches(name, CAT_IDENT);
+  debugAssertCategoryMatches(state, name, CAT_IDENT);
 
   state.last = CAT_IDENT;
   state.output += "#";
   state.output += name;
 
   if (DEBUG) {
     state.lastIsStale = false;
+    state.lastCharWritten = name[name.length - 1];
   }
 }
 
@@ -117,7 +122,7 @@ export function writeWithMap(
   node: UnnamedMappableNode,
 ): void {
   debugAssert(code.length > 0, "`code` should not be an empty string");
-  debugAssertCategoryMatches(code, last);
+  debugAssertCategoryMatches(state, code, last);
 
   markMapStart(state, start, end, node);
 
@@ -126,6 +131,7 @@ export function writeWithMap(
 
   if (DEBUG) {
     state.lastIsStale = false;
+    state.lastCharWritten = code[code.length - 1];
   }
 }
 
@@ -154,7 +160,7 @@ export function writeWithMapNamed(
   node: IdentMappableNode,
 ): void {
   debugAssert(name.length > 0, "`name` should not be an empty string");
-  debugAssertCategoryMatches(name, CAT_IDENT);
+  debugAssertCategoryMatches(state, name, CAT_IDENT);
   debugAssertNameMatches(node, name);
 
   markMapNamed(state, name, false, 0, start, end, node);
@@ -164,6 +170,7 @@ export function writeWithMapNamed(
 
   if (DEBUG) {
     state.lastIsStale = false;
+    state.lastCharWritten = name[name.length - 1];
   }
 }
 
@@ -193,7 +200,7 @@ export function writeWithMapNamedPrivate(
   node: ESTree.PrivateIdentifier,
 ): void {
   debugAssert(name.length > 0, "`name` should not be an empty string");
-  debugAssertCategoryMatches(name, CAT_IDENT);
+  debugAssertCategoryMatches(state, name, CAT_IDENT);
   debugAssertNameMatches(node, name);
 
   markMapNamed(state, name, false, 1, start, end, node);
@@ -204,6 +211,7 @@ export function writeWithMapNamedPrivate(
 
   if (DEBUG) {
     state.lastIsStale = false;
+    state.lastCharWritten = name[name.length - 1];
   }
 }
 
@@ -227,6 +235,7 @@ export function writeNoLast(state: State, code: string): void {
 
   if (DEBUG) {
     state.lastIsStale = true;
+    if (code.length > 0) state.lastCharWritten = code[code.length - 1];
   }
 }
 
@@ -260,6 +269,7 @@ export function writeWithMapNoLast(
 
   if (DEBUG) {
     state.lastIsStale = true;
+    if (code.length > 0) state.lastCharWritten = code[code.length - 1];
   }
 }
 
@@ -296,6 +306,7 @@ export function writeWithMapNamedNoLast(
 
   if (DEBUG) {
     state.lastIsStale = true;
+    if (name.length > 0) state.lastCharWritten = name[name.length - 1];
   }
 }
 
@@ -331,6 +342,7 @@ export function writeWithMapNamedJSXNoLast(
 
   if (DEBUG) {
     state.lastIsStale = true;
+    if (name.length > 0) state.lastCharWritten = name[name.length - 1];
   }
 }
 
@@ -362,7 +374,7 @@ export function writeWithMapEnd(
   node: MappableNode,
 ): void {
   debugAssert(code.length > 0, "`code` should not be an empty string");
-  debugAssertCategoryMatches(code, last);
+  debugAssertCategoryMatches(state, code, last);
 
   markMapEnd(state, start, end, node);
 
@@ -371,6 +383,7 @@ export function writeWithMapEnd(
 
   if (DEBUG) {
     state.lastIsStale = false;
+    state.lastCharWritten = code[code.length - 1];
   }
 }
 
@@ -828,11 +841,12 @@ const JSX_IDENTIFIER_REGEX = /^[\p{ID_Start}$_](?:[\p{ID_Continue}$-]|\u200C|\u2
  *
  * Debug builds only. Removed by minifier in release builds.
  *
+ * @param state - Printer state
  * @param code - Code being appended to output
  * @param last - Category of the last character of `code`
  * @throws - If `last` and `code` do not match
  */
-function 
```

**File**: `packages/codegen/src-js/state.ts` (modified, +5/-0)
```diff
@@ -100,6 +100,10 @@ export class State {
   // Only used in debug builds. See `debugAssertLastFresh`.
   declare lastIsStale: boolean;
 
+  // The character the output currently ends with.
+  // Only used in debug builds. See `debugAssertCategoryMatches`.
+  declare lastCharWritten: string;
+
   // Deferred source mappings. When source maps are enabled, `mapPositions` is the process-wide
   // buffer above, holding generated/source offset pairs, and `mapPositionsLen` is how much of it
   // this print has filled.
@@ -161,6 +165,7 @@ export class State {
     // Debug-only fields for checking `last` is correct on both writes and reads
     if (DEBUG) {
       this.lastIsStale = false;
+      this.lastCharWritten = "";
     }
 
     // `writeWithMap*` functions record the output offset and original position of every mapped node,
```

**File**: `packages/codegen/test/print.test.ts` (modified, +2/-7)
```diff
@@ -313,7 +313,8 @@ describe("bigints", () => {
   ]);
 });
 
-// Pretty output separates regex literals from adjacent operators and keywords.
+// A regex with no flags leaves the closing `/` as the last thing written, which is what stops
+// `/a//b/` lexing as a line comment and what forces a space before a following identifier.
 describe("regexes", () => {
   checkCases([
     ["no-flags", e(regex("a", "")), "/a/;\n"],
@@ -326,12 +327,6 @@ describe("regexes", () => {
     ["divide", e(bin("/", regex("a", ""), id("x"))), "/a/ / x;\n"],
     ["instanceof", e(bin("instanceof", regex("a", ""), id("RegExp"))), "/a/ instanceof RegExp;\n"],
     ["script-pattern", e(regex("script", "")), "/script/;\n"],
-    ["less-than-regex", e(bin("<", id("x"), regex("script", ""))), "x < /script/;\n"],
-    [
-      "html-comment-operators",
-      e(bin("<", id("x"), unary("!", update("--", id("y"))))),
-      "x < !--y;\n",
-    ],
     ["return-no-flags", program(ret(regex("a", ""))), "return /a/;\n"],
   ]);
 });
```

---

### Incident Patch 7: `71e400b9` (2026-10-05)
**Commit Message**: fix(formatter_markdown): fixed remaining issues found by fuzz (#27334)

- keep a lazy HTML block's continuation lines in the list item
- print a footnote paragraph on its marker line only when it prints as one line

**File**: `crates/oxc_formatter_markdown/AGENTS.md` (modified, +4/-0)
```diff
@@ -96,4 +96,8 @@ Extend the ignore set only with a reason written next to it.
 `tests/invariants.rs` formats a deterministic token-soup corpus (the parser repo's differential generator) under every `proseWrap` and checks the fingerprint and idempotency.
 The default corpus must fail exactly on `KNOWN_FAILURES` (the documents and their classes are listed there);
 remove an entry when its class is fixed, any other failure is a regression.
+
+Other seeds pass (3 / 5 / 7 / 8 / 13 / 21 / 42 / 99) except one known class, seed 11 #5:
+a liquid tag continued on a lazy line (`2. {% x` + `y %}`) is inline in a paragraph,
+re-indented into the item it becomes a liquid flow block (micromark reads the two the same way).
 `MD_FUZZ_SEED` / `MD_FUZZ_COUNT` run other corpora, `MD_FUZZ_FILE` prints one document's fingerprints.
```

**File**: `crates/oxc_formatter_markdown/DIVERGENCES.md` (modified, +45/-0)
```diff
@@ -214,6 +214,20 @@ though no type 7 block can interrupt a paragraph on a regular line.
 Printed with the container's prefix the line is no longer lazy, so a blank line keeps the block apart;
 Prettier prints it adjacent, and the next parse reads it as part of the paragraph.
 
+In a tight list item the line stays lazy, and the block's other lines keep the item's content column:
+
+```markdown
+<!-- input, ours -->
+- a
+<a>
+    b
+
+<!-- prettier (the html loses the 2 columns before `b`) -->
+- a
+<a>
+  b
+```
+
 ## list-after-html-block
 
 - Why: semantics (prettier/prettier#17690)
@@ -636,3 +650,34 @@ a
 A fenced code block whose info string has a backtick keeps its `~~~` fence; any other fence is printed with backticks.
 A backtick fence cannot have a backtick in its info string (CommonMark),
 so Prettier's opener is a paragraph on the next parse and its closer opens a code block that runs to the end of the document.
+
+## footnote-kept-line-break
+
+- Why: semantics
+- Pin: `tests/fixtures/markdown/prose-wrap/footnote-kept-line-break.md`
+
+```markdown
+<!-- input -->
+[^1]: a b\
+=
+
+<!-- ours (every proseWrap) -->
+[^1]:
+    a b\
+        =
+
+<!-- prettier, preserve (a setext heading on the next parse) -->
+[^1]:
+    a b\
+    =
+
+<!-- prettier, never -->
+[^1]: a b\
+=
+```
+
+A footnote's single paragraph follows the marker only when it prints as one line, under every `proseWrap`:
+`always` also breaks it for the width, the other modes only for a line break the paragraph keeps.
+Prettier asks `preserve` whether the source is one line, and its block form above moves the lazy `=` into the footnote,
+where it underlines the paragraph.
+Its `never` keeps the marker line whatever the paragraph holds (admissible here); ours follows the same rule as the other modes.
```

**File**: `crates/oxc_formatter_markdown/src/print/block.rs` (modified, +23/-37)
```diff
@@ -1,7 +1,7 @@
 //! Block dispatch and the blank-line policy between siblings.
 
 use oxc_formatter_core::{
-    Buffer,
+    Buffer, FormatElements, MemoizeFormat,
     builders::{
         exact_line_breaks, group, hard_line_break, literal_line_break, mark_as_root,
         soft_line_break_or_space, space, space_align, text, token,
@@ -72,7 +72,7 @@ pub fn write_blocks<'a>(
     }
 }
 
-pub fn write_gap(
+fn write_gap(
     siblings: &[Block<'_>],
     index: usize,
     parent: Parent,
@@ -82,7 +82,7 @@ pub fn write_gap(
 }
 
 /// Whether `siblings[index]` gets a blank line before it.
-fn double_gap(
+pub fn double_gap(
     siblings: &[Block<'_>],
     index: usize,
     parent: Parent,
@@ -322,47 +322,33 @@ fn write_heading<'a>(
     }
 }
 
-/// `[^label]: ` + content.
-/// A lone paragraph stays on the label's line under `never` (and under `preserve` when it is one source line);
-/// otherwise the content is aligned by 4 and the first block moves to its own line when it does not fit
-/// (or is multi-line).
+/// `[^label]: ` + content, aligned by 4.
+/// A lone paragraph that prints as one line stays on the label's line (under `always` the group decides),
+/// anything else starts on the next line (DIVERGENCES.md#footnote-kept-line-break).
 fn write_footnote_definition<'a>(
     def: &'a FootnoteDefinition<'a>,
     f: &mut MarkdownFormatter<'_, 'a>,
 ) {
     write!(f, [token("[^"), text(f.context().slice(def.label)), token("]:")]);
     let children = &def.children;
-    let inline = match children.as_slice() {
-        [Block::Paragraph(p)] => match f.options().prose_wrap {
-            ProseWrap::Never => true,
-            // Prettier asks whether the source paragraph is one line;
-            // asking whether it prints as one keeps the answer stable across passes
-            // (a line break joined away would flip it).
-            ProseWrap::Preserve => !inline::keeps_a_line_break(&p.children, f),
-            ProseWrap::Always => false,
-        },
-        _ => false,
-    };
-    if inline {
-        write!(f, space());
-        write_blocks(children, Parent::Container, f);
-        return;
-    }
     let parent = Parent::Container;
-    write!(
-        f,
-        space_align(
-            4,
-            &mark_as_root(&format_with(|f| {
-                let first = format_with(|f| write_block(&children[0], children, 0, parent, f));
-                write!(f, group(&format_args!(soft_line_break_or_space(), first)));
-                for index in 1..children.len() {
-                    write_gap(children, index, parent, f);
-                    write_block(&children[index], children, index, parent, f);
-                }
-            }))
-        )
-    );
+    let first = format_with(|f| write_block(&children[0], children, 0, parent, f)).memoized();
+    let on_label_line = matches!(children.as_slice(), [Block::Paragraph(_)])
+        && f.options().prose_wrap != ProseWrap::Always
+        && !first.inspect(f).will_break();
+    let body = format_with(|f| {
+        if on_label_line {
+            write!(f, [space(), first]);
+        } else {
+            write!(f, group(&format_args!(soft_line_break_or_space(), first)));
+        }
+        for index in 1..children.len() {
+            write_gap(children, index, parent, f);
+            write_block(&children[index], children, index, parent, f);
+        }
+    });
+    // Also on the label's line: the 4-space guard of a block-start-looking line counts from the content column
+    write!(f, space_align(4, &mark_as_root(&body)));
 }
 
 /// `---`, except inside a list
```

**File**: `crates/oxc_formatter_markdown/src/print/inline.rs` (modified, +0/-17)
```diff
@@ -203,23 +203,6 @@ fn markers_as_written(f: &MarkdownFormatter<'_, '_>) -> bool {
     f.context().raw_text().get() == Raw::Line || f.context().literal_markers().get()
 }
 
-/// Under `proseWrap: preserve`, whether any soft break of this paragraph survives printing
-/// (one before a block-start-looking word is joined away; one next to a dialect shape line stays).
-pub fn keeps_a_line_break<'a>(children: &'a [Inline<'a>], f: &MarkdownFormatter<'_, 'a>) -> bool {
-    let last = children.len().wrapping_sub(1);
-    children.iter().enumerate().any(|(i, child)| {
-        matches!(child, Inline::SoftBreak(_))
-            && i != 0
-            && i != last
-            && (line_shape(children, i + 1, false, false, f)
-                || !words::prevents_break(
-                    true,
-                    next_word_of(children, i, None, f),
-                    ProseWrap::Preserve,
-                ))
-    })
-}
-
 /// Prettier's `riskyParagraphPositions`: a `[[` in text, followed by `]]` (text or a wiki link's).
 /// Wrapping such a paragraph could merge `[[foo\n[[wiki link]]` into one link,
 /// so its text is printed as written.
```

**File**: `crates/oxc_formatter_markdown/src/print/list.rs` (modified, +15/-17)
```diff
@@ -5,7 +5,7 @@
 
 use oxc_formatter_core::{
     Buffer,
-    builders::{mark_as_root, space_align, text, token},
+    builders::{dedent, hard_line_break, mark_as_root, space_align, text, token},
     write,
 };
 use oxc_markdown_parser::{
@@ -87,24 +87,10 @@ pub fn write_list<'a>(
         let prefix: &'a str = f.allocator().alloc_str(&prefix);
         write!(f, text(prefix));
 
-        // A `[paragraph, html]` item whose html sits left of the content column is
-        // micromark's lazy type 7 quirk (oxc-markdown-parser DIVERGENCES.md): the html stays where it was, unaligned.
-        // (Prettier drops the alignment whenever the two columns differ,
-        // which moves an html block indented past a task checkbox out of the item:
-        // DIVERGENCES.md#list-html-block-alignment)
-        let skip_align =
-            item.children.len() == 2 && matches!(item.children[1], Block::HtmlBlock(_)) && {
-                let source = f.context().source_text().as_str();
-                let content_column = item
-                    .checkbox
-                    .map_or(item.children[0].span().start, |checkbox| checkbox.span.start);
-                column_of(source, item.children[1].span().start) < column_of(source, content_column)
-            };
         let body = format_with(|f| write_list_item(item, checkbox, prefix.len(), loose, f));
-        let width = if skip_align { 0 } else { prefix.len() };
         // The item's content column is the root that verbatim continuation lines return to.
         // Its columns are syntax, spaces under `useTabs` too (see `space_align`).
-        write!(f, space_align(width, &mark_as_root(&body)));
+        write!(f, space_align(prefix.len(), &mark_as_root(&body)));
     }
 
     f.context().lists().borrow_mut().pop();
@@ -127,7 +113,19 @@ fn write_list_item<'a>(
 
     for (i, child) in item.children.iter().enumerate() {
         if i > 0 {
-            block::write_gap(&item.children, i, parent, f);
+            let blank = block::double_gap(&item.children, i, parent, f);
+            // A type 7 HTML block right after a paragraph starts on a lazy line
+            // (micromark's quirk, oxc-markdown-parser DIVERGENCES.md): that line stays in the parent's column,
+            // the block's other lines are in the item (DIVERGENCES.md#lazy-html-block)
+            let lazy_html = matches!(
+                (&item.children[i - 1], child),
+                (Block::Paragraph(_), Block::HtmlBlock(h)) if h.kind == 7
+            );
+            if lazy_html && !blank {
+                write!(f, dedent(&hard_line_break()));
+            } else {
+                write_gap(blank, f);
+            }
         }
         // The first block follows the checkbox on its line: its first line is not a line start
         let child_parent = if i == 0 && !checkbox.is_empty() {
```

**File**: `crates/oxc_formatter_markdown/src/print/text.rs` (modified, +1/-1)
```diff
@@ -241,7 +241,7 @@ pub fn push_whitespace<'a>(
 }
 
 /// Never break before a word that would start a block.
-pub fn prevents_break(newline: bool, next: Option<NextWord<'_>>, prose_wrap: ProseWrap) -> bool {
+fn prevents_break(newline: bool, next: Option<NextWord<'_>>, prose_wrap: ProseWrap) -> bool {
     let Some(next) = next else { return false };
     if next.escaped {
         return false;
```

**File**: `crates/oxc_formatter_markdown/tests/fixtures/markdown/lazy-html-block.md` (modified, +20/-0)
```diff
@@ -1,3 +1,23 @@
 > a
 <a>
 > c
+
+- a
+<a>
+    b
+
+* a\
+      # x
+<a>
+    b
+
+1. a
+<a>
+   b
+
+2. c
+
+- # h
+  a
+<a>
+    b
```

**File**: `crates/oxc_formatter_markdown/tests/fixtures/markdown/lazy-html-block.md.snap` (modified, +62/-0)
```diff
@@ -6,6 +6,26 @@ source: crates/oxc_formatter_markdown/tests/fixtures/mod.rs
 <a>
 > c
 
+- a
+<a>
+    b
+
+* a\
+      # x
+<a>
+    b
+
+1. a
+<a>
+   b
+
+2. c
+
+- # h
+  a
+<a>
+    b
+
 ==================== Output ====================
 ------------------
 { printWidth: 80 }
@@ -15,6 +35,27 @@ source: crates/oxc_formatter_markdown/tests/fixtures/mod.rs
 > <a>
 > c
 
+- a
+<a>
+    b
+
+* a\
+      # x
+<a>
+    b
+
+1. a
+
+   <a>
+   b
+
+2. c
+
+- # h
+  a
+<a>
+    b
+
 -------------------
 { printWidth: 100 }
 -------------------
@@ -23,4 +64,25 @@ source: crates/oxc_formatter_markdown/tests/fixtures/mod.rs
 > <a>
 > c
 
+- a
+<a>
+    b
+
+* a\
+      # x
+<a>
+    b
+
+1. a
+
+   <a>
+   b
+
+2. c
+
+- # h
+  a
+<a>
+    b
+
 ===================== End =====================
```

---

### Incident Patch 8: `7d0e54dc` (2026-10-05)
**Commit Message**: fix(formatter_markdown): preserve line breaks around Chinese/Japanese characters in all `proseWrap` (#27331)

Align with Prettier 3.10 (not released) and also dprint and biome.

**File**: `apps/oxfmt/conformance/snapshots/conformance.snap.md` (modified, +3/-1)
```diff
@@ -245,7 +245,7 @@
 - [externals/prettier/markdown/thematicBreak/simple.md](diffs/markdown/externals__prettier__markdown__thematicBreak__simple.md.md)
   - crates/oxc_formatter_markdown/DIVERGENCES.md#leading-thematic-break
 
-### Option 2: 270/282 (95.74%)
+### Option 2: 269/282 (95.39%)
 
 ```json
 {"printWidth":100,"proseWrap":"always"}
@@ -273,6 +273,8 @@
   - crates/oxc_formatter/DIVERGENCES.md#suppressed-terminator-per-semi
 - [externals/prettier/markdown/paragraph/cjk.md](diffs/markdown/externals__prettier__markdown__paragraph__cjk.md.md)
   - crates/oxc_formatter_markdown/DIVERGENCES.md#container-directive
+- [externals/prettier/markdown/splitCjkText/symbolSpaceNewLine.md](diffs/markdown/externals__prettier__markdown__splitCjkText__symbolSpaceNewLine.md.md)
+  - crates/oxc_formatter_markdown/DIVERGENCES.md#cj-line-break
 - [externals/prettier/markdown/thematicBreak/simple.md](diffs/markdown/externals__prettier__markdown__thematicBreak__simple.md.md)
   - crates/oxc_formatter_markdown/DIVERGENCES.md#leading-thematic-break
 
```

**File**: `apps/oxfmt/conformance/snapshots/diffs/markdown/externals__prettier__markdown__splitCjkText__symbolSpaceNewLine.md.md` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+# externals/prettier/markdown/splitCjkText/symbolSpaceNewLine.md
+
+## Option 2
+
+`````json
+{"printWidth":100,"proseWrap":"always"}
+`````
+
+### Diff
+
+`````diff
+===================================================================
+--- prettier
++++ oxfmt
+@@ -1,14 +1,65 @@
+-日本語、にほんご。汉语, 中文. 日本語，にほんご．English
+-words!? 漢字！汉字？「セリフ」(括弧) 文字（括弧）文字【括弧】日本語English
++日本語
++、
++にほんご
++。
++汉语,
++中文.
++日
++本
++語
++，
++に
++ほ
++ん
++ご
++．
++English words!?
++漢字
++！
++汉字
++？
++「セリフ」
++(括弧)
++文字
++（括弧）
++文字
++【括弧】
++日本語
++English
+ 
+-「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）」「禁則（きんそく）処理（しょり）」「禁則（きんそく）処理（しょり）！！！！」「禁則（きんそく）処理（しょり）！！！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）」
++「禁則（きんそく）処理（しょり）」
++「禁則（きんそく）処理（しょり）！！！！」
++「禁則（きんそく）処理（しょり）！！！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
++「禁則（きんそく）処理（しょり）！」
+ 
+-中点・中点
++中点
++・
++中点
+ 
+-禁則処理にわざと違反した文章のテストを今から行います。準備はいいでしょうか？レディ、ゴー！
++禁則処理にわざと違反した文章のテストを今から行います。準備はいいでしょうか？レデ
++ィ、ゴー！
+ 
+ [ウ ィキペディア]
+ 
+ [ウ ィキペディア]: https://ja.wikipedia.org/
+ 
+-C言語・C++・Go・Rust
++C言
++語
++・
++C++
++・
++Go
++・
++Rust
+
+`````
+
+### Actual (oxfmt)
+
+`````md
+日本語
+、
+にほんご
+。
+汉语,
+中文.
+日
+本
+語
+，
+に
+ほ
+ん
+ご
+．
+English words!?
+漢字
+！
+汉字
+？
+「セリフ」
+(括弧)
+文字
+（括弧）
+文字
+【括弧】
+日本語
+English
+
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）」
+「禁則（きんそく）処理（しょり）」
+「禁則（きんそく）処理（しょり）！！！！」
+「禁則（きんそく）処理（しょり）！！！」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）！」
+「禁則（きんそく）処理（しょり）！」
+
+中点
+・
+中点
+
+禁則処理にわざと違反した文章のテストを今から行います。準備はいいでしょうか？レデ
+ィ、ゴー！
+
+[ウ ィキペディア]
+
+[ウ ィキペディア]: https://ja.wikipedia.org/
+
+C言
+語
+・
+C++
+・
+Go
+・
+Rust
+
+`````
+
+### Expected (prettier)
+
+`````md
+日本語、にほんご。汉语, 中文. 日本語，にほんご．English
+words!? 漢字！汉字？「セリフ」(括弧) 文字（括弧）文字【括弧】日本語English
+
+「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）」「禁則（きんそく）処理（しょり）」「禁則（きんそく）処理（しょり）！！！！」「禁則（きんそく）処理（しょり）！！！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」「禁則（きんそく）処理（しょり）！」
+
+中点・中点
+
+禁則処理にわざと違反した文章のテストを今から行います。準備はいいでしょうか？レディ、ゴー！
+
+[ウ ィキペディア]
+
+[ウ ィキペディア]: https://ja.wikipedia.org/
+
+C言語・C++・Go・Rust
+
+`````
```

**File**: `crates/oxc_formatter_markdown/AGENTS.md` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ Pin fixtures are named after their entry's slug (a comment would be an HTML bloc
 ### Fixture fingerprint
 
 `tests/fixtures/fingerprint.rs` serializes the AST's meaning (structure, decoded text, destinations, labels) and ignores what formatting may change
-(spans, markers, fence style, text splitting, whitespace runs, tightness, whitespace next to Chinese / Japanese characters, trailing whitespace of verbatim lines, info string whitespace).
+(spans, markers, fence style, text splitting, whitespace runs, tightness, trailing whitespace of verbatim lines, info string whitespace).
 The harness asserts it is identical for input and output: every fixture is a `parse(format(x)) ≅ parse(x)` check, which idempotency alone cannot give (a corrupted output is often a fixpoint).
 Extend the ignore set only with a reason written next to it.
 
```

**File**: `crates/oxc_formatter_markdown/DIVERGENCES.md` (modified, +23/-8)
```diff
@@ -505,27 +505,42 @@ delimiter escaped when a later line could close it as front matter (a line start
 or a thematic break, which prints `---`): the next parse (Prettier's and ours) would read the block as front matter.
 Prettier prints it as written (the leading blank line that kept it out of front matter is dropped).
 
-## autolink-cjk-space
+## cj-line-break
 
-- Why: semantics
-- Pin: `tests/fixtures/markdown/prose-wrap/autolink-cjk-space.md`
+- Why: semantics (prettier/prettier#20143)
+- Pin: `tests/fixtures/markdown/prose-wrap/cj-line-break.md`
+- Conformance: `markdown/splitCjkText/symbolSpaceNewLine.md`
+- Oxfmt: `externals/prettier/markdown/splitCjkText/symbolSpaceNewLine.md`
 
 ```markdown
 <!-- input, proseWrap always -->
+日本語の文章は
+改行しても
+そのままです。
+
 見て http://x.y2.
 。次
 
 <!-- ours -->
-見て http://x.y2. 。次
+日本語の文章は
+改行しても
+そのままです。
+
+見て http://x.y2.
+。次
 
 <!-- prettier -->
+日本語の文章は改行してもそのままです。
+
 見て http://x.y2.。次
 ```
 
-A line break right after the trailing punctuation of an autolink literal stays a space, whatever the
-Chinese / Japanese rules would make of it: the literal runs to the next whitespace, so joined to `。次`
-it becomes `http://x.y2.。次` on the next parse (`autolink_stretch`).
-Prettier drops the break between the two punctuation characters and the link changes.
+A line break next to Chinese / Japanese text is kept under every `proseWrap`,
+except between a Korean and a CJ letter, where it is a space.
+Browsers disagree on such a break (Firefox drops it, Chrome and Safari render a space),
+so removing it or making it a space changes the rendered text in some of them.
+Joined, an autolink literal also takes the CJ punctuation after it (`http://x.y2.。次`).
+Prettier `main` keeps the break since #20143; the pin (3.9.9) removes it or makes it a space.
 
 ## wiki-link-risk-link-text
 
```

**File**: `crates/oxc_formatter_markdown/src/print/cjk.rs` (modified, +27/-66)
```diff
@@ -1,20 +1,18 @@
 //! Word kinds for the CJK line-breaking rules (Prettier's `splitText` / `printWhitespace`).
 //!
-//! A whitespace-delimited word is split into runs of non-CJK characters
-//! and single CJK characters (a variation selector stays with its base);
-//! only the edge runs matter to the printer,
-//! and the split as a whole feeds the "does this sentence put spaces around CJ text" statistic.
+//! Only the characters at the ends of a whitespace-delimited word matter to the printer
+//! (a variation selector stays with its base).
 //!
 //! The tables are Prettier's own character classes
 //! (`constants.evaluate.js`: `cjk-regex` + Script_Extensions / General_Category for CJK,
-//! ASCII punctuation + `\p{P}` (+ U+3000, U+FF5E) for punctuation, `\p{Script_Extensions=Hangul}` for Korean),
+//! `\p{P}` (+ U+3000, U+FF5E) for punctuation, `\p{Script_Extensions=Hangul}` for Korean),
 //! enumerated with Node 26 (Unicode 17).
 //! Regenerate by testing every code point against those regexes and collapsing the hits into ranges.
 
 #[derive(Clone, Copy, Debug, PartialEq, Eq)]
 pub enum Kind {
     NonCjk,
-    /// Chinese or Japanese letter: no spaces between words, a line break is not a space.
+    /// Chinese or Japanese letter: no spaces between words, a line break next to it is kept.
     CjLetter,
     /// Korean letter: words are space-separated, as in Latin script.
     KLetter,
@@ -27,65 +25,31 @@ impl Kind {
     }
 }
 
-/// The run at one end of a word, as the whitespace next to it sees it.
-#[derive(Clone, Copy, Debug)]
-pub struct Edge {
-    pub kind: Kind,
-    /// The run's character on the whitespace side.
-    pub ch: char,
-    /// That character is punctuation (a CJK punctuation run always is).
-    pub punctuation: bool,
+/// The kind of the word's first character.
+pub fn first_kind(word: &str) -> Option<Kind> {
+    word.chars().next().map(kind)
 }
 
-/// The kinds of a word's runs, in order.
-pub fn kinds(word: &str) -> impl Iterator<Item = Kind> + '_ {
-    runs(word).map(|(_, kind)| kind)
-}
-
-/// The word's first and last run, as edges.
-pub fn edges(word: &str) -> Option<(Edge, Edge)> {
-    let mut it = runs(word);
-    let (first_run, first_kind) = it.next()?;
-    let (last_run, last_kind) = it.last().unwrap_or((first_run, first_kind));
-    let first_ch = first_run.chars().next()?;
-    let last_ch = last_run.chars().next_back()?;
-    let edge = |kind: Kind, ch: char| Edge {
-        kind,
-        ch,
-        punctuation: kind == Kind::CjkPunctuation || is_punctuation(ch),
-    };
-    Some((edge(first_kind, first_ch), edge(last_kind, last_ch)))
+/// The kind of the word's last character; a trailing variation selector stays with its base.
+pub fn last_kind(word: &str) -> Option<Kind> {
+    let mut chars = word.chars();
+    let last = chars.next_back()?;
+    Some(match chars.next_back() {
+        Some(base) if is_variation_selector(last) && is_cjk(base) => kind(base),
+        _ => kind(last),
+    })
 }
 
-/// Splits a word into runs: each CJK character (plus a following variation selector) on its own,
-/// non-CJK characters together.
-fn runs(word: &str) -> impl Iterator<Item = (&str, Kind)> {
-    let mut rest = word;
-    std::iter::from_fn(move || {
-        let c = rest.chars().next()?;
-        let (len, kind) = if is_cjk(c) {
-            let mut len = c.len_utf8();
-            if let Some(vs) = rest[len..].chars().next()
-                && is_variation_selector(vs)
-            {
-                len += vs.len_utf8();
-            }
-            let kind = if is_punctuation(c) {
-                Kind::CjkPunctuation
-            } else if is_hangul(c) {
-                Kind::KLetter
-            } else {
-                Kind::CjLetter
-            };
-            (len, kind)
-        } else {
-            let len = rest.find(is_cjk).unwrap_or(rest.len());
-            (len, Kind::NonCjk)
-        };
-        let (run, tail) = rest.split_at(len);
-        rest = tail;
-        Some((run, kind))
-    })
+fn kind(c: char) -> Kind {
+    if !is_cjk(c) {
+        Kind::NonCjk
+    } else if is_punctuation(c) {
+        Kind::CjkPunctuation
+    } else if is_hangul(c) {
+        Kind::KLetter
+    } else {
+        Kind::CjLetter
+    }
 }
 
 fn is_variation_selector(c: char) -> bool {
@@ -100,11 +64,8 @@ fn is_hangul(c: char) -> bool {
     in_ranges(HANGUL, c)
 }
 
-/// ASCII punctuation, U+3000, U+FF5E, or Unicode general category P.
-pub fn is_punctuation(c: char) -> bool {
-    if c.is_ascii() {
-        return c.is_ascii_punctuation();
-    }
+/// U+3000, U+FF5E, or Unicode general category P (only asked about CJK characters).
+fn is_punctuation(c: char) -> bool {
     matches!(c, '\u{3000}' | '\u{FF5E}') || in_ranges(PUNCTUATION, c)
 }
 
```

**File**: `crates/oxc_formatter_markdown/src/print/inline.rs` (modified, +17/-40)
```diff
@@ -272,13 +272,13 @@ pub fn collect_inlines<'a>(
     let break_kept = |j: usize, f: &MarkdownFormatter<'_, 'a>| -> bool {
         f.context().raw_text().get() != Raw::No || raw_line(j + 1, f) != Raw::No
     };
-    // Prettier's sentence is a run of texts joined by soft breaks; its CJ spacing style is one statistic.
-    let mut sentence_cj_spaces: Option<Option<bool>> = None;
+    // Whether the sentence (a run of texts joined by soft breaks) has CJK text, scanned once per sentence.
+    let mut sentence_has_cjk: Option<bool> = None;
     // The previous sibling was a line break that stays in the output
     let mut last_break_kept = false;
     for (i, child) in children.iter().enumerate() {
         if !matches!(child, Inline::Text(_) | Inline::SoftBreak(_)) {
-            sentence_cj_spaces = None;
+            sentence_has_cjk = None;
         }
         let after_kept_break = last_break_kept;
         if !matches!(child, Inline::SoftBreak(_) | Inline::HardBreak(_)) {
@@ -332,8 +332,8 @@ pub fn collect_inlines<'a>(
                 } else {
                     (None, None)
                 };
-                let cj_spaces = *sentence_cj_spaces
-                    .get_or_insert_with(|| sentence_cj_spaces_at(children, i, f));
+                let has_cjk =
+                    *sentence_has_cjk.get_or_insert_with(|| sentence_has_cjk_at(children, i));
                 // A paragraph's first line that opens a block
                 // (the rest of a paragraph a definition was split from) is escaped: `\- x`, `1\. x`
                 if i == 0
@@ -365,7 +365,7 @@ pub fn collect_inlines<'a>(
                     before_soft_break: matches!(children.get(i + 1), Some(Inline::SoftBreak(_))),
                     next_word: next_word_of(children, i, parent.delimiter, f),
                     glued_last_word: glued_last_word(children, i, raw, f),
-                    cj_spaces,
+                    has_cjk,
                     ..words::TextContext::default()
                 };
                 words::push_text(raw, cx, parts, f);
@@ -381,19 +381,19 @@ pub fn collect_inlines<'a>(
                     // A separator, not content: the next line is measured on its own
                     parts.push_sep(Sep::HardLine);
                 } else {
-                    let cj_spaces = *sentence_cj_spaces
-                        .get_or_insert_with(|| sentence_cj_spaces_at(children, i, f));
+                    let has_cjk =
+                        *sentence_has_cjk.get_or_insert_with(|| sentence_has_cjk_at(children, i));
                     let cx = words::TextContext {
                         next_word: next_word_of(children, i, parent.delimiter, f),
                         after_liquid: follows_liquid(children, i),
-                        // Only the CJK rules look back (a trailing `\` was escaped by the text);
-                        // a word glued to an autolink literal is part of it, the break after it stays a space
-                        prev_word: if cj_spaces.is_some() && !glued_to_autolink(children, i, f) {
+                        // Only the CJK rules look back (a trailing `\` was escaped by the text),
+                        // and `preserve` keeps the break anyway
+                        prev_word: if has_cjk && f.options().prose_wrap != ProseWrap::Preserve {
                             prev_word_of(children, i, f)
                         } else {
                             None
                         },
-                        cj_spaces,
+                        has_cjk,
                         ..words::TextContext::default()
                     };
                     words::push_whitespace(true, &cx, parts, f);
@@ -707,40 +707,17 @@ fn autolink_stretch(children: &[Inline<'_>], i: usize, raw: &str) -> usize {
     }
 }
 
-/// The text before node `i` is one word in an autolink literal's stretch (`http://x.y2` + `.`):
-/// what follows the break must not glue to it (`push_text` makes the same call for its first word).
-fn glued_to_autolink<'a>(
-    children: &'a [Inline<'a>],
-    i: usize,
-    f: &MarkdownFormatter<'_, 'a>,
-) -> bool {
-    let Some(Inline::Text(t)) = children.get(i.wrapping_sub(1)) else { return false };
-    let raw = f.context().slice(t.span);
-    !raw.contains(is_split_whitespace) && autolink_stretch(children, i - 1, raw) > 0
-}
-
 fn follows_liquid(children: &[Inline<'_>], i: usize) -> bool {
     matches!(children.get(i.wrapping_sub(1)), Some(Inline::Liquid(_)))
 }
 
-/// `usesCJSpaces` of the sentence (run of texts and soft breaks) containing node `i`;
-/// `None` without CJK text, which is the common case and skips the scan and the CJK rules.
-fn sentence_cj_spaces_at<'a>(
-    children: &'a [Inline<'a>],
-    i: usize,
-    f: &MarkdownFormatter<'_, 'a>,
-) -> Option<bool> {
-    let in_sentence = |c: &Inline<'a>| matches!(c, Inline::Text(_) | Inline::SoftBreak(_));
+/// The sentence (run of texts and soft breaks) containing node `i` has CJK text;
```

**File**: `crates/oxc_formatter_markdown/src/print/parts.rs` (modified, +2/-6)
```diff
@@ -5,7 +5,7 @@ use oxc_allocator::{Allocator, ArenaVec, StringBuilder};
 use oxc_formatter_core::{
     Buffer, Format,
     builders::{
-        dedent_to_root, hard_line_break, literal_line_break, mark_as_root, soft_line_break,
+        dedent_to_root, hard_line_break, literal_line_break, mark_as_root,
         soft_line_break_or_space, text,
     },
     write,
@@ -46,16 +46,13 @@ impl<'a> Format<'a, MarkdownFormatContext<'a>> for Atom<'a> {
 /// A fill separator.
 #[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
 pub enum Sep {
-    /// A break or nothing (a line break between CJ characters).
-    SoftLine,
     Line,
     HardLine,
 }
 
 impl<'a> Format<'a, MarkdownFormatContext<'a>> for Sep {
     fn fmt(&self, f: &mut MarkdownFormatter<'_, 'a>) {
         match self {
-            Sep::SoftLine => write!(f, soft_line_break()),
             Sep::Line => write!(f, soft_line_break_or_space()),
             Sep::HardLine => write!(f, hard_line_break()),
         }
@@ -79,13 +76,12 @@ pub struct Parts<'a> {
 }
 
 impl<'a> Item<'a> {
-    /// The item as the parser will read it: a break is a newline, a soft line between CJ letters nothing.
+    /// The item as the parser will read it: a break is a newline, a line a space.
     fn flat(&self) -> &'a str {
         match self {
             Item::Atom(Atom::Str(s)) => s,
             Item::Atom(_) | Item::Sep(Sep::HardLine) => "\n",
             Item::Sep(Sep::Line) => " ",
-            Item::Sep(Sep::SoftLine) => "",
         }
     }
 }
```

**File**: `crates/oxc_formatter_markdown/src/print/text.rs` (modified, +31/-127)
```diff
@@ -7,7 +7,7 @@
 //! - a line break before a word that would start a block (`-`, `1.`, `#`, `>`) never breaks
 //!
 //! Around Chinese / Japanese text a whitespace follows Prettier's `printWhitespace`:
-//! a line break between CJ characters is not a space, and a space next to one never breaks
+//! a line break next to CJ is kept, and a space next to one never breaks
 //! (`cjk` classifies the word edges).
 
 use std::borrow::Cow;
@@ -19,7 +19,7 @@ use crate::options::ProseWrap;
 
 use super::{
     MarkdownFormatter,
-    cjk::{self, Edge, Kind},
+    cjk::{self, Kind},
     escape::{
         ends_with_unescaped_backslash, is_fake_setext_underline, leading_run_escaped,
         print_delimited_word,
@@ -76,9 +76,8 @@ pub struct TextContext<'a> {
     /// The last word of the previous sibling text (a soft break's other side), for the CJK rules only;
     /// a trailing `\` there was escaped by the text (see `push_text`).
     pub prev_word: Option<&'a str>,
-    /// The sentence puts spaces between CJ and non-CJK words (Prettier's `usesCJSpaces`);
-    /// `None` when it has no CJK text at all.
-    pub cj_spaces: Option<bool>,
+    /// The sentence has CJK text (the parser's `contains_cjk`); without it the word edges are not classified.
+    pub has_cjk: bool,
     /// Inside a reference link's raw content, where a line break never prevents a break.
     pub is_link: bool,
 }
@@ -99,8 +98,6 @@ pub fn push_text<'a>(
     let mut is_first = true;
     let leading_ws = raw.starts_with(is_split_whitespace);
     let mut prev_word: Option<&'a str> = None;
-    // `prev_word` is the text's first word
-    let mut prev_is_first = false;
     loop {
         // Whitespace before the next word (leading, or the run after the previous word).
         let after_ws = rest.trim_start_matches(is_split_whitespace);
@@ -126,9 +123,7 @@ pub fn push_text<'a>(
             };
             let cx = TextContext {
                 next_word: next,
-                // The first word inside an autolink literal's stretch is part of the link:
-                // the whitespace after it stays a space (a CJ neighbor must not glue to the link)
-                prev_word: prev_word.filter(|_| !(cx.autolink_stretch > 0 && prev_is_first)),
+                prev_word,
                 after_liquid: is_first && cx.after_liquid,
                 ..cx
             };
@@ -144,7 +139,6 @@ pub fn push_text<'a>(
             break;
         }
         prev_word = Some(word);
-        prev_is_first = is_first;
         let printed: Cow<'a, str> = if in_delimiter {
             let prev = if is_first { cx.edge_prev } else { Some(' ') };
             let next = if is_last { cx.edge_next } else { Some(' ') };
@@ -184,7 +178,7 @@ pub fn push_text<'a>(
 
 /// The whitespace (a space run, or one holding a `newline`) between `cx.prev_word`
 /// and `cx.next_word` (`None`: the whitespace touches a node edge):
-/// a separator that may break, a space, or nothing.
+/// a kept line break, a separator that may break, or a space.
 pub fn push_whitespace<'a>(
     newline: bool,
     cx: &TextContext<'a>,
@@ -208,132 +202,42 @@ pub fn push_whitespace<'a>(
         options.prose_wrap
     };
 
-    if prose_wrap == ProseWrap::Preserve && newline {
+    if newline && prose_wrap == ProseWrap::Preserve {
         parts.push_sep(Sep::HardLine);
         return;
     }
-    // The CJK rules only apply to a sentence with CJK text
-    let (prev, next) = if cx.cj_spaces.is_some() {
+    // A space breaks only under `always`; otherwise it stays a space whatever its neighbors
+    let (prev, next) = if cx.has_cjk && (newline || prose_wrap == ProseWrap::Always) {
         (
-            cx.prev_word.and_then(|w| cjk::edges(w).map(|(_, last)| last)),
-            cx.next_word
-                .filter(|w| w.in_sentence)
-                .and_then(|w| cjk::edges(w.word).map(|(first, _)| first)),
+            cx.prev_word.and_then(cjk::last_kind),
+            cx.next_word.filter(|w| w.in_sentence).and_then(|w| cjk::first_kind(w.word)),
         )
     } else {
         (None, None)
     };
-    let can_be_space = !newline || line_break_can_be_space(prev, next, cx);
+    // Next to CJ, except Korean next to a CJ letter (a space everywhere)
+    let cj_bound = (prev.is_some_and(Kind::is_cj) || next.is_some_and(Kind::is_cj))
+        && !matches!(
+            (prev, next),
+            (Some(Kind::KLetter), Some(Kind::CjLetter))
+                | (Some(Kind::CjLetter), Some(Kind::KLetter))
+        );
+    // Prettier's `isLineBreakAmbiguous`: browsers disagree on whether the break is a space or nothing
+    if newline && cj_bound {
+        parts.push_sep(Sep::HardLine);
+        return;
+    }
+    // Prettier's `isBreakable`: never a break between CJ and a neighbor word,
+    // a node edge (`None`) may break
     let breakable = prose_wrap == ProseWrap::Always
         && f.context().no_wrap_depth().get() == 0
-        && is_breakable(prev, next, cx);
-    match (breakab
```

---

### Incident Patch 9: `cd77f1c5` (2026-10-05)
**Commit Message**: test(oxfmt): use codeload.github.com for download-fixtures (#27330)

Migrate from `degit`, `degit` can not specify commit hash unless it is on ref edge.

**File**: `apps/oxfmt/conformance/download-fixtures.js` (modified, +49/-29)
```diff
@@ -1,16 +1,19 @@
 // oxlint-disable no-console, no-await-in-loop
 
-import { exec } from "node:child_process";
-import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import { exec, spawn } from "node:child_process";
+import { once } from "node:events";
+import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
 import { join } from "node:path";
+import { createInterface } from "node:readline";
 import { promisify } from "node:util";
 import pkg from "../package.json" with { type: "json" };
 
 const execAsync = promisify(exec);
 
 const externalsDir = join(import.meta.dirname, "fixtures", "externals");
-const cwd = join(import.meta.dirname, "..");
 
+// `repo` is `<owner>/<name>` plus the directory to take, `version` is any ref (a tag or a commit)
 const sources = [
   // xxx-in-js
   {
@@ -79,37 +82,54 @@ const sources = [
   },
 ];
 
-// Group sources by repository and download each group sequentially.
-// Parallel `degit` calls for the same repo+ref share a single tarball cache path;
-// one process sees the other's partially written tarball, fails to extract it,
-// and silently falls back to `git clone` which ignores the subdirectory,
-// dumping the entire repository into the fixture directory.
-const sourcesByRepo = new Map();
-for (const source of sources) {
-  const repoKey = source.repo.split("/").slice(0, 2).join("/");
-  if (!sourcesByRepo.has(repoKey)) sourcesByRepo.set(repoKey, []);
-  sourcesByRepo.get(repoKey).push(source);
-}
+// Group sources by archive, so an archive shared by several sources downloads once.
+const sourcesByArchive = Map.groupBy(
+  sources,
+  ({ repo, version }) => `${repo.split("/").slice(0, 2).join("/")}#${version}`,
+);
 
 await Promise.all(
-  [...sourcesByRepo.values()].map(async (group) => {
-    for (const { name, repo, version } of group) {
-      const dest = join(externalsDir, name);
+  [...sourcesByArchive.values()].map(async (group) => {
+    // Stamp-based skip (same scheme as `oxc_formatter_tests`' suite provisioning):
+    // the stamp is written last, so a half-downloaded tree is always re-done.
+    const stale = group.filter(({ name, repo, version }) => {
+      const stamp = join(externalsDir, name, ".version");
+      const upToDate =
+        existsSync(stamp) && readFileSync(stamp, "utf8").trim() === `${repo}#${version}`;
+      if (upToDate) console.log(`Up-to-date: ${name}@${version}`);
+      return !upToDate;
+    });
+    if (stale.length === 0) return;
 
-      // Stamp-based skip (same scheme as `oxc_formatter_tests`' suite provisioning):
-      // the stamp is written last, so a half-downloaded tree is always re-done.
-      const stamp = join(dest, ".version");
-      const pin = `${repo}#${version}`;
-      if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === pin) {
-        console.log(`Up-to-date: ${name}@${version}`);
-        continue;
-      }
-      rmSync(dest, { recursive: true, force: true });
+    const [owner, repoName] = group[0].repo.split("/");
+    const { version } = group[0];
+    console.log(`Downloading ${owner}/${repoName}@${version}...`);
+    const tmp = mkdtempSync(join(tmpdir(), "oxfmt-fixtures-"));
+    const tarball = join(tmp, "archive.tar.gz");
+    await execAsync(
+      `curl -fsSL -o "${tarball}" https://codeload.github.com/${owner}/${repoName}/tar.gz/${version}`,
+    );
+    const top = await topDirectory(tarball);
 
-      console.log(`Downloading ${name}@${version} fixtures...`);
-      await execAsync(`pnpm exec degit ${repo}#${version} "${dest}"`, { cwd });
-      writeFileSync(stamp, pin);
+    for (const { name, repo } of stale) {
+      const dest = join(externalsDir, name);
+      rmSync(dest, { recursive: true, force: true });
+      mkdirSync(dest, { recursive: true });
+      const subdir = repo.split("/").slice(2);
+      await execAsync(
+        `tar -xzf "${tarball}" -C "${dest}" --strip-components=${subdir.length + 1} "${[top, ...subdir].join("/")}"`,
+      );
+      writeFileSync(join(dest, ".version"), `${repo}#${version}`);
       console.log(`Done: ${name}@${version}`);
     }
+    rmSync(tmp, { recursive: true });
   }),
 );
+
+/** The archive's top directory, GitHub's `<name>-<ref>` with the ref normalized (e.g. no leading `v`). */
+async function topDirectory(tarball) {
+  const tar = spawn("tar", ["-tzf", tarball]);
+  const [line] = await once(createInterface({ input: tar.stdout }), "line");
+  tar.kill();
+  return line.split("/")[0];
+}
```

**File**: `apps/oxfmt/package.json` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@
     "@napi-rs/cli": "catalog:",
     "@oxapps/shared": "workspace:*",
     "@types/node": "catalog:",
-    "degit": "catalog:",
     "diff": "^9.0.0",
     "execa": "^10.0.0",
     "json-schema-to-typescript": "catalog:",
```

**File**: `pnpm-lock.yaml` (modified, +0/-3)
```diff
@@ -256,9 +256,6 @@ importers:
       '@types/node':
         specifier: 'catalog:'
         version: 24.1.0
-      degit:
-        specifier: 'catalog:'
-        version: 3.10.0
       diff:
         specifier: ^9.0.0
         version: 9.0.0
```

---

### Incident Patch 10: `51506c66` (2026-10-05)
**Commit Message**: docs(formatter_css): record divergences found in mdn-content (css-in-md) (#27327)

**File**: `crates/oxc_formatter_css/DIVERGENCES.md` (modified, +155/-4)
```diff
@@ -273,24 +273,30 @@ Prettier keeps it verbatim because postcss swallows the run as an opaque prelude
 Selector-position Sass interpolation normalizes inner spaces like value-position interpolation does in both formatters;
 Prettier keeps SELECTOR interpolation verbatim.
 
-## warn-error-requote
+## prelude-string-requote
 
 - Why: uniform-rule (option governs: singleQuote)
-- Pin: `tests/fixtures/format/scss/unknown-at-rule-edges.scss`
+- Pin: `tests/fixtures/format/scss/unknown-at-rule-edges.scss`, `tests/fixtures/format/css/prelude-string-requote.css`
 
 ```scss
 /* input */
 @error 'single quotes get normalized';
+@keyframes 'validString' {}
 
 /* ours */
 @error "single quotes get normalized";
+@keyframes "validString" {
+}
 
 /* prettier */
 @error 'single quotes get normalized';
+@keyframes 'validString' {
+}
 ```
 
-`@warn` / `@error` prelude strings re-quote per the `singleQuote` option: `oxc-css-parser` parses them as `SassExpr`, so they go through the structured printer (see `at_rule.rs`);
-Prettier keeps them as a raw string verbatim.
+A string in an at-rule prelude we parse typed re-quotes per the `singleQuote` option:
+the `@warn` / `@error` prelude (a `SassExpr`) and a `@keyframes` name (`at_rule.rs` `write_keyframes_name`) go through the structured printer;
+Prettier keeps the at-rule params as a raw string verbatim.
 Every other string in a declaration value re-quotes per the same option in both formatters.
 
 ## call-after-line-comment-indent
@@ -1385,3 +1391,148 @@ At-rule names, property names, media feature names and the prelude keywords next
 Values keep their case (`LANDSCAPE`, `FLEX`), as in any declaration: a value may be a case-sensitive custom ident (`animation-name`, `grid-area`).
 So do case-sensitive names (`layer(FOO)`) and any identifier carrying a variable or interpolation marker (`@media @PHONE`, `#{$Q}`).
 Prettier lowercases only what its `maybeToLowerCase` reaches (at-rule names, `media-feature`, declaration props) and prints the neighbouring keywords as its media-query parser or value parser hands them over: verbatim.
+
+## missed-semicolon-accepted
+
+- Why: uniform-rule (acceptance: the grammar owner decides)
+- Pin: `tests/fixtures/format/css/missed-semicolon-accepted.css`
+
+```css
+/* input */
+a {
+  left: 0
+  top: 0;
+}
+
+/* ours */
+a {
+  left: 0 top: 0;
+}
+
+/* prettier: CssSyntaxError: Missed semicolon, the input is left as-is */
+```
+
+A `;`-less declaration runs to the next `;`: `oxc-css-parser` reads one declaration, a value being any component-value run (css-syntax-3; its README "Acceptance");
+postcss rejects a value with a `word:` after its first word.
+Same tokens, so same meaning: a browser drops the whole declaration either way.
+SCSS / Less keep rejecting it (dart-sass / lessc), so those stay as-is.
+
+## combinator-spacing
+
+- Why: uniform-rule (same construct, same output: the `>` / `+` / `~` combinators)
+- Pin: `tests/fixtures/format/css/combinator-spacing.css`
+
+```css
+/* input */
+col.selected||td {}
+col.selected || td {}
+.a^b {}
+.a^^b {}
+
+/* ours */
+col.selected || td {
+}
+col.selected || td {
+}
+.a ^ b {
+}
+.a ^^ b {
+}
+
+/* prettier */
+col.selected||td {
+}
+col.selected||td {
+}
+.a^b {
+}
+.a^^b {
+}
+```
+
+Every combinator other than the descendant one prints with a space on each side (`selector.rs` `write_combinator`);
+Prettier spaces only `>` / `+` / `~` / `>>>`, prints the others as written, and glues a spaced `||` too.
+
+## document-url-brace
+
+- Why: uniform-rule (same construct, same output: `@document url("x") {`)
+- Pin: `tests/fixtures/format/css/document-url-brace.css`
+
+```css
+/* input */
+@document url("https://www.example.com/") {}
+
+/* ours */
+@document url("https://www.example.com/") {
+}
+
+/* prettier */
+@document url("https://www.example.com/")
+{
+}
+```
+
+The typed `@document` / `@-moz-document` prelude keeps the `{` on its line;
+Prettier takes the `//` of `https://` for a line comment and moves the `{` to its own line.
+A raw prelude (unknown at-rule params) still takes the same `//` test as Prettier (`comments.rs` `last_line_has_inline_comment`), so there the two agree.
+
+## value-semicolon-glue
+
+- Why: uniform-rule (same construct, same output: the SCSS `if()` branch separator; prettier/prettier#19384)
+- Pin: `tests/fixtures/format/css/value-semicolon-glue.css`
+
+```css
+/* input */
+a {
+  b: if(media(width < 700px): 1 ; else: 2);
+  c: foo(x ; y);
+}
+
+/* ours */
+a {
+  b: if(media(width < 700px): 1; else: 2);
+  c: foo(x; y);
+}
+
+/* prettier */
+a {
+  b: if(media(width < 700px): 1 ; else: 2);
+  c: foo(x ; y);
+}
+```
+
+A `;` in a value glues to what precedes it, in every dialect (`value.rs` `base_separator`);
+Prettier glues it only between SCSS `if()` branches and keeps the source space elsewhere.
+
+## supports-function-args-indent
+
+- Why: uniform-rule (same construct, same output: the function in a declaration value)
+- Pin: `tests/fixtures/format/css/supports-funct
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/css/combinator-spacing.css` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+/* DIVERGENCES.md#combinator-spacing */
+col.selected||td {}
+col.selected || td {}
+.a^b {}
+.a^^b {}
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/css/combinator-spacing.css.snap` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+---
+source: crates/oxc_formatter_css/tests/fixtures/mod.rs
+---
+==================== Input ====================
+/* DIVERGENCES.md#combinator-spacing */
+col.selected||td {}
+col.selected || td {}
+.a^b {}
+.a^^b {}
+
+==================== Output ====================
+------------------
+{ printWidth: 80 }
+------------------
+/* DIVERGENCES.md#combinator-spacing */
+col.selected || td {
+}
+col.selected || td {
+}
+.a ^ b {
+}
+.a ^^ b {
+}
+
+-------------------
+{ printWidth: 100 }
+-------------------
+/* DIVERGENCES.md#combinator-spacing */
+col.selected || td {
+}
+col.selected || td {
+}
+.a ^ b {
+}
+.a ^^ b {
+}
+
+===================== End =====================
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/css/document-url-brace.css` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+/* DIVERGENCES.md#document-url-brace */
+@document url("https://www.example.com/") {}
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/css/document-url-brace.css.snap` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+---
+source: crates/oxc_formatter_css/tests/fixtures/mod.rs
+---
+==================== Input ====================
+/* DIVERGENCES.md#document-url-brace */
+@document url("https://www.example.com/") {}
+
+==================== Output ====================
+------------------
+{ printWidth: 80 }
+------------------
+/* DIVERGENCES.md#document-url-brace */
+@document url("https://www.example.com/") {
+}
+
+-------------------
+{ printWidth: 100 }
+-------------------
+/* DIVERGENCES.md#document-url-brace */
+@document url("https://www.example.com/") {
+}
+
+===================== End =====================
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/css/missed-semicolon-accepted.css` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+/* DIVERGENCES.md#missed-semicolon-accepted */
+a {
+  left: 0
+  top: 0;
+}
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/css/missed-semicolon-accepted.css.snap` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+---
+source: crates/oxc_formatter_css/tests/fixtures/mod.rs
+---
+==================== Input ====================
+/* DIVERGENCES.md#missed-semicolon-accepted */
+a {
+  left: 0
+  top: 0;
+}
+
+==================== Output ====================
+------------------
+{ printWidth: 80 }
+------------------
+/* DIVERGENCES.md#missed-semicolon-accepted */
+a {
+  left: 0 top: 0;
+}
+
+-------------------
+{ printWidth: 100 }
+-------------------
+/* DIVERGENCES.md#missed-semicolon-accepted */
+a {
+  left: 0 top: 0;
+}
+
+===================== End =====================
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/css/prelude-string-requote.css` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+/* DIVERGENCES.md#prelude-string-requote */
+@keyframes 'validString' {
+}
```

---

### Incident Patch 11: `e9ae2d8f` (2026-10-05)
**Commit Message**: fix(formatter_css): fix layouts found in mdn-content repo (css-in-md) (#27326)

- `@supports`: keep `not` on its term's line, open over-wide parenthesized terms
- custom function prelude: indent the continuation after `returns type(...)`
- media ratio: print the spacing around `/` as written
- spaced `/`: glue to its left operand and break after
- a comment leading a comma list item: measure the item's first chunk
- `calc()` parenthesized operand: open its parens when over-wide
- do not follow postcss-values' re-split of a signed word (`Arial, -apple-system`, `-600px`)
- re-pin DIVERGENCES.md#fill-break-position

**File**: `apps/oxfmt/conformance/snapshots/conformance.snap.md` (modified, +8/-6)
```diff
@@ -228,24 +228,22 @@
 
 ## less
 
-### Option 1: 402/409 (98.29%)
+### Option 1: 403/409 (98.53%)
 
 ```json
 {"printWidth":80}
 ```
 
 - [externals/ng-zorro-antd/components/style/mixins/customize.less](diffs/less/externals__ng-zorro-antd__components__style__mixins__customize.less.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#less-guard-list-inline
-- [externals/ng-zorro-antd/components/style/themes/compact.less](diffs/less/externals__ng-zorro-antd__components__style__themes__compact.less.md)
-  - crates/oxc_formatter_css/DIVERGENCES.md#fill-break-position
 - [externals/ng-zorro-antd/components/style/themes/dark.less](diffs/less/externals__ng-zorro-antd__components__style__themes__dark.less.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#trailing-line-comment-print-width
 - [externals/ng-zorro-antd/components/style/themes/default.less](diffs/less/externals__ng-zorro-antd__components__style__themes__default.less.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#trailing-line-comment-print-width, crates/oxc_formatter_css/DIVERGENCES.md#fill-break-position
 - [externals/ng-zorro-antd/components/style/themes/variable.less](diffs/less/externals__ng-zorro-antd__components__style__themes__variable.less.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#trailing-line-comment-print-width, crates/oxc_formatter_css/DIVERGENCES.md#fill-break-position
 - [externals/ng-zorro-antd/components/table/style/index.less](diffs/less/externals__ng-zorro-antd__components__table__style__index.less.md)
-  - crates/oxc_formatter_css/DIVERGENCES.md#fill-break-position
+  - crates/oxc_formatter_css/DIVERGENCES.md#signed-value-resplit
 - [externals/ng-zorro-antd/components/table/style/rtl.less](diffs/less/externals__ng-zorro-antd__components__table__style__rtl.less.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#fill-break-position
 
@@ -345,7 +343,7 @@
 
 ## scss
 
-### Option 1: 203/217 (93.55%)
+### Option 1: 202/217 (93.09%)
 
 ```json
 {"printWidth":80}
@@ -357,6 +355,8 @@
   - crates/oxc_formatter_css/DIVERGENCES.md#media-query-operator-spacing
 - [externals/gitlab/stylesheets/framework/variables_overrides.scss](diffs/scss/externals__gitlab__stylesheets__framework__variables_overrides.scss.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#map-item-break-comma-lists-only
+- [externals/gitlab/stylesheets/framework/variables.scss](diffs/scss/externals__gitlab__stylesheets__framework__variables.scss.md)
+  - crates/oxc_formatter_css/DIVERGENCES.md#signed-value-resplit
 - [externals/gitlab/stylesheets/highlight/conflict_colors.scss](diffs/scss/externals__gitlab__stylesheets__highlight__conflict_colors.scss.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#map-paren-value-blank-lines
 - [externals/gitlab/stylesheets/page_bundles/_ide_theme_overrides.scss](diffs/scss/externals__gitlab__stylesheets__page_bundles___ide_theme_overrides.scss.md)
@@ -380,7 +380,7 @@
 - [externals/gitlab/stylesheets/pages/settings.scss](diffs/scss/externals__gitlab__stylesheets__pages__settings.scss.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#media-query-operator-spacing
 
-### Option 2: 204/217 (94.01%)
+### Option 2: 203/217 (93.55%)
 
 ```json
 {"printWidth":100}
@@ -392,6 +392,8 @@
   - crates/oxc_formatter_css/DIVERGENCES.md#fill-break-position
 - [externals/gitlab/stylesheets/framework/variables_overrides.scss](diffs/scss/externals__gitlab__stylesheets__framework__variables_overrides.scss.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#map-item-break-comma-lists-only
+- [externals/gitlab/stylesheets/framework/variables.scss](diffs/scss/externals__gitlab__stylesheets__framework__variables.scss.md)
+  - crates/oxc_formatter_css/DIVERGENCES.md#signed-value-resplit
 - [externals/gitlab/stylesheets/highlight/conflict_colors.scss](diffs/scss/externals__gitlab__stylesheets__highlight__conflict_colors.scss.md)
   - crates/oxc_formatter_css/DIVERGENCES.md#map-paren-value-blank-lines
 - [externals/gitlab/stylesheets/page_bundles/_ide_theme_overrides.scss](diffs/scss/externals__gitlab__stylesheets__page_bundles___ide_theme_overrides.scss.md)
```

**File**: `apps/oxfmt/conformance/snapshots/diffs/less/externals__ng-zorro-antd__components__style__themes__compact.less.md` (removed, +0/-657)
```diff
@@ -1,657 +0,0 @@
-# externals/ng-zorro-antd/components/style/themes/compact.less
-
-## Option 1
-
-`````json
-{"printWidth":80}
-`````
-
-### Diff
-
-`````diff
-===================================================================
---- prettier
-+++ oxfmt
-@@ -104,15 +104,12 @@
- // Input
- // ---
- @input-padding-vertical-base: round(
-   max(
--    (
--        round(
--            ((@input-height-base - @font-size-base * @line-height-base) / 2) *
--              10
--          ) /
--          10
--      ) -
-+    (round(
-+          ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
-+        ) /
-+        10) -
-       @border-width-base,
-     2px
-   )
- );
-
-`````
-
-### Actual (oxfmt)
-
-`````less
-@import "./default.less";
-
-@line-height-base: 1.66667;
-@line-height-lg: 1.5715;
-@mode: compact;
-@font-size-base: 12px;
-@font-size-lg: @font-size-base + 2px;
-
-// default paddings
-@default-padding-lg: 24px; // containers
-@default-padding-md: 16px; // small containers and buttons
-@default-padding-sm: 12px; // Form controls and items
-@default-padding-xs: 8px; // small items
-@default-padding-xss: 4px; // more small
-
-// vertical paddings
-@padding-lg: 16px; // containers
-@padding-md: 8px; // small containers and buttons
-@padding-sm: 8px; // Form controls and items
-@padding-xs: 4px; // small items
-@padding-xss: 0px; // more small
-
-// vertical padding for all form controls
-@control-padding-horizontal: @padding-sm;
-@control-padding-horizontal-sm: @default-padding-xs;
-
-// vertical margins
-@margin-lg: 16px; // containers
-@margin-md: 8px; // small containers and buttons
-@margin-sm: 8px; // Form controls and items
-@margin-xs: 4px; // small items
-@margin-xss: 0px; // more small
-
-// height rules
-@height-base: 28px;
-@height-lg: 32px;
-@height-sm: 22px;
-
-// Button
-// ---
-@btn-padding-horizontal-base: @default-padding-sm - 1px;
-@btn-padding-horizontal-lg: @btn-padding-horizontal-base;
-@btn-padding-horizontal-sm: @default-padding-xs - 1px;
-@btn-square-only-icon-size-lg: 16px;
-@btn-square-only-icon-size: 14px;
-@btn-square-only-icon-size-sm: 12px;
-
-// Breadcrumb
-// ---
-@breadcrumb-font-size: @font-size-base;
-@breadcrumb-icon-font-size: @font-size-base;
-
-//Dropdown
-@dropdown-line-height: 18px;
-
-// Menu
-@menu-item-padding-horizontal: 12px;
-@menu-horizontal-line-height: 38px;
-@menu-inline-toplevel-item-height: 32px;
-@menu-item-height: 32px;
-@menu-item-vertical-margin: 0px;
-@menu-item-boundary-margin: 0px;
-@menu-icon-margin-right: 8px;
-
-// Checkbox
-@checkbox-size: 14px;
-@checkbox-group-item-margin-right: 6px;
-
-// picker
-@picker-panel-cell-height: 22px;
-@picker-panel-cell-width: 32px;
-@picker-text-height: 32px;
-@picker-time-panel-cell-height: 24px;
-@picker-panel-without-time-cell-height: 48px;
-
-// Form
-// ---
-@form-item-margin-bottom: 16px;
-@form-vertical-label-padding: 0 0 4px;
-
-// Rate
-// ---
-@rate-star-size: 16px;
-
-// Radio
-// ---
-@radio-size: 14px;
-@radio-wrapper-margin-right: 6px;
-
-// Switch
-// ---
-@switch-height: 20px;
-@switch-sm-height: 14px;
-@switch-min-width: 40px;
-@switch-sm-min-width: 24px;
-@switch-inner-margin-min: 4px;
-@switch-inner-margin-max: 22px;
-
-// Slider
-// ---
-@slider-handle-size: 12px;
-@slider-handle-margin-top: -4px;
-
-// Input
-// ---
-@input-padding-vertical-base: round(
-  max(
-    (round(
-          ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
-        ) /
-        10) -
-      @border-width-base,
-    2px
-  )
-);
-@input-padding-horizontal-lg: 11px;
-
-// PageHeader
-// ---
-@page-header-padding: 16px;
-@page-header-padding-vertical: 8px;
-@page-header-heading-title: 16px;
-@page-header-heading-sub-title: 12px;
-@page-header-tabs-tab-font-size: 14px;
-
-// Pagination
-// ---
-@pagination-mini-options-size-changer-top: 1px;
-@pagination-item-size-sm: 22px;
-
-// Cascader
-// ----
-@cascader-dropdown-line-height: @dropdown-line-height;
-
-// Select
-// ---
-@select-dropdown-height: @height-base;
-@select-single-item-height-lg: 32px;
-@select-multiple-item-height: @input-height-base -
-  max(@input-padding-vertical-base, 4) * 2; // Normal 24px
-@select-multiple-item-height-lg: 24px;
-@select-multiple-item-spacing-half: 3px;
-
-// Tree
-// ---
-@tree-title-height: 20px;
-
-// Transfer
-// ---
-@transfer-item-padding-vertical: 3px;
-@transfer-list-search-icon-top: 8px;
-@transfer-header-height: 36px;
-
-// Comment
-// ---
-@comment-actions-margin-bottom: 0px;
-@comment-actions-margin-top: @margin-xs;
-@comment-content-detail-p-margin-bottom: 0px;
-
-// Steps
-// ---
-@steps-icon-size: 24px;
-@steps-icon-custom-size: 20px;
-@steps-icon-custom-font-size: 20px;
-@steps-icon-custom-top: 2px;
-@steps-icon-margin: 2px 8px 2px 0;
-@steps-icon-font-size: @font-size-base;
-@steps-dot-top: 4px;
-@steps-icon-top: 0px;
-@steps-small-icon-size: 20px;
-@steps-vertical-icon-width: 12px;
-@steps-vertical-tail-width: 12px;
-@steps-vertical-tail-width-sm: 10px;
-// Collapse
-// ---
-
```

**File**: `apps/oxfmt/conformance/snapshots/diffs/less/externals__ng-zorro-antd__components__style__themes__default.less.md` (modified, +13/-38)
```diff
@@ -55,38 +55,7 @@
  @background-color-dark: hsv(0, 0, 94%); // dark grey background color
  
  // Disabled states
-@@ -465,24 +453,18 @@
- @input-padding-horizontal-base: @input-padding-horizontal;
- @input-padding-horizontal-sm: @control-padding-horizontal-sm - @line-width;
- @input-padding-horizontal-lg: @input-padding-horizontal;
- @input-padding-vertical-base: max(
--  (
--      round(
--          ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
--        ) /
--        10
--    ) -
-+  (round(
-+        ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
-+      ) /
-+      10) -
-     @border-width-base,
-   3px
- );
- @input-padding-vertical-sm: max(
--  (
--      round(
--          ((@input-height-sm - @font-size-base * @line-height-base) / 2) * 10
--        ) /
--        10
--    ) -
-+  (round(((@input-height-sm - @font-size-base * @line-height-base) / 2) * 10) /
-+      10) -
-     @border-width-base,
-   0
- );
- @input-padding-vertical-lg: (
-@@ -846,11 +828,12 @@
+@@ -846,11 +834,12 @@
  @tabs-card-head-background: @background-color-light;
  @tabs-card-height: 40px;
  @tabs-card-active-color: @primary-color;
@@ -564,16 +533,22 @@
 @input-padding-horizontal-sm: @control-padding-horizontal-sm - @line-width;
 @input-padding-horizontal-lg: @input-padding-horizontal;
 @input-padding-vertical-base: max(
-  (round(
-        ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
-      ) /
-      10) -
+  (
+      round(
+          ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
+        ) /
+        10
+    ) -
     @border-width-base,
   3px
 );
 @input-padding-vertical-sm: max(
-  (round(((@input-height-sm - @font-size-base * @line-height-base) / 2) * 10) /
-      10) -
+  (
+      round(
+          ((@input-height-sm - @font-size-base * @line-height-base) / 2) * 10
+        ) /
+        10
+    ) -
     @border-width-base,
   0
 );
```

**File**: `apps/oxfmt/conformance/snapshots/diffs/less/externals__ng-zorro-antd__components__style__themes__variable.less.md` (modified, +13/-38)
```diff
@@ -27,38 +27,7 @@
  @background-color-dark: hsv(0, 0, 94%); // dark grey background color
  
  // Disabled states
-@@ -530,24 +526,18 @@
- @input-padding-horizontal-base: @input-padding-horizontal;
- @input-padding-horizontal-sm: @control-padding-horizontal-sm - @line-width;
- @input-padding-horizontal-lg: @input-padding-horizontal;
- @input-padding-vertical-base: max(
--  (
--      round(
--          ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
--        ) /
--        10
--    ) -
-+  (round(
-+        ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
-+      ) /
-+      10) -
-     @border-width-base,
-   3px
- );
- @input-padding-vertical-sm: max(
--  (
--      round(
--          ((@input-height-sm - @font-size-base * @line-height-base) / 2) * 10
--        ) /
--        10
--    ) -
-+  (round(((@input-height-sm - @font-size-base * @line-height-base) / 2) * 10) /
-+      10) -
-     @border-width-base,
-   0
- );
- @input-padding-vertical-lg: (
-@@ -910,11 +900,12 @@
+@@ -910,11 +906,12 @@
  @tabs-card-head-background: @background-color-light;
  @tabs-card-height: 40px;
  @tabs-card-active-color: @primary-color;
@@ -609,16 +578,22 @@
 @input-padding-horizontal-sm: @control-padding-horizontal-sm - @line-width;
 @input-padding-horizontal-lg: @input-padding-horizontal;
 @input-padding-vertical-base: max(
-  (round(
-        ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
-      ) /
-      10) -
+  (
+      round(
+          ((@input-height-base - @font-size-base * @line-height-base) / 2) * 10
+        ) /
+        10
+    ) -
     @border-width-base,
   3px
 );
 @input-padding-vertical-sm: max(
-  (round(((@input-height-sm - @font-size-base * @line-height-base) / 2) * 10) /
-      10) -
+  (
+      round(
+          ((@input-height-sm - @font-size-base * @line-height-base) / 2) * 10
+        ) /
+        10
+    ) -
     @border-width-base,
   0
 );
```

**File**: `apps/oxfmt/conformance/snapshots/diffs/scss/externals__gitlab__stylesheets__framework__variables.scss.md` (added, +2439/-0)
```diff
@@ -0,0 +1,2439 @@
+# externals/gitlab/stylesheets/framework/variables.scss
+
+## Option 1
+
+`````json
+{"printWidth":80}
+`````
+
+### Diff
+
+`````diff
+===================================================================
+--- prettier
++++ oxfmt
+@@ -304,21 +304,11 @@
+   var(--default-mono-font, "GitLab Mono"), "JetBrains Mono", "Menlo",
+   "DejaVu Sans Mono", "Liberation Mono", "Consolas", "Ubuntu Mono",
+   "Courier New", "andale mono", "lucida console", monospace;
+ $regular-font:
+-  var(--default-regular-font, "GitLab Sans"),
+-  -apple-system,
+-  BlinkMacSystemFont,
+-  "Segoe UI",
+-  Roboto,
+-  "Noto Sans",
+-  Ubuntu,
+-  Cantarell,
+-  "Helvetica Neue",
+-  sans-serif,
+-  "Apple Color Emoji",
+-  "Segoe UI Emoji",
+-  "Segoe UI Symbol",
++  var(--default-regular-font, "GitLab Sans"), -apple-system, BlinkMacSystemFont,
++  "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue",
++  sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol",
+   "Noto Color Emoji";
+ $gl-monospace-font: $monospace-font;
+ $gl-regular-font: $regular-font;
+ 
+
+`````
+
+### Actual (oxfmt)
+
+`````scss
+@import "@gitlab/ui/dist/tokens/scss/tokens";
+
+/*
+ * Layout
+ */
+$grid-size: 8px;
+$right-sidebar-collapsed-width: 62px;
+$right-sidebar-width: 290px;
+$right-sidebar-inner-width: 250px;
+$sidebar-breakpoint: 1024px;
+$default-transition-duration: 0.15s;
+$contextual-sidebar-width: 256px;
+$contextual-sidebar-collapsed-width: 56px;
+$toggle-sidebar-height: 48px;
+$super-sidebar-width: 16rem;
+$super-sidebar-z-index: 600;
+$super-sidebar-skip-to-z-index: 601;
+$super-sidebar-overlay-z-index: 599;
+$top-bar-z-index: 210;
+
+/**
+  🚨 Do not use this spacing scale — it is deprecated and being removed. 🚨
+  See https://gitlab.com/gitlab-org/gitlab/issues/36857 for more details.
+
+  Instead, if you need a spacing class, add it to app/assets/stylesheets/framework/common.scss,
+  using the following values.
+
+    $gl-spacing-scale-0: 0;
+    $gl-spacing-scale-1: 2px;
+    $gl-spacing-scale-2: 4px;
+    $gl-spacing-scale-3: 8px;
+    $gl-spacing-scale-4: 12px;
+    $gl-spacing-scale-5: 16px;
+    $gl-spacing-scale-6: 24px;
+    $gl-spacing-scale-7: 32px;
+    $gl-spacing-scale-8: 40px;
+    $gl-spacing-scale-9: 48px;
+    $gl-spacing-scale-10: 56px;
+    $gl-spacing-scale-11: 64px;
+    $gl-spacing-scale-12: 80px;
+    $gl-spacing-scale-13: 96px;
+
+  E.g., a padding top of 96px can be added using:
+  .gl-shim-pt-13 {
+    padding-top: 96px;
+  }
+
+  Please use -shim- so it can be differentiated from the old scale classes.
+
+  These will be replaced when the Gitlab UI utilities are included.
+**/
+$spacing-scale: (
+  0: 0,
+  1: #{0.5 * $grid-size},
+  2: $grid-size,
+  3: #{2 * $grid-size},
+  4: #{3 * $grid-size},
+  5: #{4 * $grid-size},
+);
+
+/* Will be moved to @gitlab/ui by https://gitlab.com/gitlab-org/gitlab-ui/-/issues/1709 */
+$gl-spacing-scale-48: 48 * $grid-size;
+$gl-spacing-scale-75: 75 * $grid-size;
+/* End gitlab-ui#1709 */
+
+/*
+ * Why another sizing scale???
+ * Great question, friend!
+ * This size scale is a "backport" of the equivalent set of "named" sizes
+ * (e.g. `xl` versus `70`) that came from the following design document as of 2019-10-23:
+ *
+ * https://gitlab-org.gitlab.io/gitlab-design/hosted/design-gitlab-specs/forms-spec-previews/
+ *
+ * (See `input-` items at the bottom)
+ *
+ * The presumption here is that these sizes will be standardized in GitLab UI and thus will be
+ * broadly useful here in the GitLab product when not using the GitLab UI components.
+ */
+$size-scale: (
+  "xs": #{10 * $grid-size},
+  "s": #{20 * $grid-size},
+  "m": #{30 * $grid-size},
+  "l": #{40 * $grid-size},
+  "xl": #{70 * $grid-size},
+);
+
+// Color schema
+$darken-normal-factor: 7% !default;
+$darken-dark-factor: 10% !default;
+
+$purple: #6d49cb !default;
+$purple-light: #ede8fb !default;
+
+$gray-lightest: lighten($gray-10, 1) !default;
+$gray-light: $gray-10 !default;
+$gray-lighter: lighten($gray-50, 4) !default;
+$gray-normal: lighten($gray-50, 2) !default;
+$gray-dark: darken($gray-light, $darken-dark-factor) !default;
+$gray-darker: $gray-50 !default;
+$gray-darkest: $gray-200 !default;
+
+$t-white-a-02: rgba(255, 255, 255, 0.02) !default;
+$t-white-a-04: rgba(255, 255, 255, 0.04) !default;
+$t-white-a-06: rgba(255, 255, 255, 0.06) !default;
+$t-white-a-08: rgba(255, 255, 255, 0.08) !default;
+$t-white-a-16: rgba(255, 255, 255, 0.16) !default;
+$t-white-a-24: rgba(255, 255, 255, 0.24) !default;
+$t-white-a-36: rgba(255, 255, 255, 0.36) !default;
+
+$t-gray-a-02: rgba(31, 30, 36, 0.02) !default;
+$t-gray-a-04: rgba(31, 30, 36, 0.04) !default;
+$t-gray-a-06: rgba(31, 30, 36, 0.06) !default;
+$t-gray-a-08: rgba(31, 30, 36, 0.08) !default;
+$t-gray-a-16: rgba(31, 30, 36, 0.16) !default;
+$t-gray-a-24: rgba(31, 30, 36, 0.24) !default;
+
+/*
+ * UI elements
+ */
+$contextual-sidebar-bg-color: $gray-10;
+$contextual-sidebar-border-color: #e9e9e9;
+$border-color: $gray
```

**File**: `crates/oxc_formatter_css/DIVERGENCES.md` (modified, +55/-13)
```diff
@@ -845,6 +845,44 @@ Prettier glues the sign to the number (removing the source space, a postcss word
 Matching that gluing is ad-hoc work for a torture-test-only shape.
 A sign GLUED in the source never gains a space in either implementation (that direction is the parser's folded-sign handling, not a divergence).
 
+## signed-value-resplit
+
+- Why: uniform-rule (same construct, same output: the item in first position, an unsigned item)
+- Pin: `tests/fixtures/format/css/signed-value-resplit.css`
+- Conformance: `css/fill-value/fill.css`
+- Oxfmt: `externals/gitlab/stylesheets/framework/variables.scss`, `externals/ng-zorro-antd/components/table/style/index.less`
+
+```css
+/* input */
+font-family: Arial, -apple-system;
+-webkit-mask-position-x: 50px, 25%, -3em;
+background: url("/shared-assets/images/examples/web-animations/cat_sprite.png") -600px 0 no-repeat;
+
+/* ours */
+font-family: Arial, -apple-system;
+-webkit-mask-position-x: 50px, 25%, -3em;
+background: url("/shared-assets/images/examples/web-animations/cat_sprite.png")
+  -600px 0 no-repeat;
+
+/* prettier */
+font-family:
+  Arial,
+  -apple-system;
+-webkit-mask-position-x:
+  50px,
+  25%,
+  -3em;
+background: url("/shared-assets/images/examples/web-animations/cat_sprite.png") -600px
+  0 no-repeat;
+```
+
+postcss-values splits a signed word (`-apple-system`, `-3em`, `-@var`) past the first position into an operator + word,
+the re-split word AGENTS.md's "Acceptance" does not follow:
+- as a two-node item, it breaks the comma list one item per line (`shouldBreakList`), though `-apple-system, Arial` and `50px, 25%, 3em` stay on one line
+- as a math operator, it glues to the word before it, overflowing the line
+
+Ours prints a signed item as one word, like the same item in first position or unsigned.
+
 ## css-glued-minus-paren
 
 - Why: uniform-rule (same construct, same output: the `-(` shapes Prettier keeps glued)
@@ -873,29 +911,33 @@ Css mode only (hence the prefix): in Less and Scss, Prettier keeps `3px -(4px)`
 ## fill-break-position
 
 - Why: cost
-- Pin: `tests/fixtures/format/css/fill-math-chunk-break.css`
-- Conformance: `css/fill-value/fill.css`
+- Pin: `tests/fixtures/format/scss/fill-break-position.scss`
 - Oxfmt: `externals/webawesome/number-input/number-input.styles.ts`, `externals/webawesome/page/page.styles.ts`,
-  `externals/ng-zorro-antd/components/style/themes/compact.less`, `externals/ng-zorro-antd/components/style/themes/default.less`, `externals/ng-zorro-antd/components/style/themes/variable.less`, `externals/ng-zorro-antd/components/table/style/index.less`, `externals/ng-zorro-antd/components/table/style/rtl.less`,
+  `externals/ng-zorro-antd/components/style/themes/default.less`, `externals/ng-zorro-antd/components/style/themes/variable.less`, `externals/ng-zorro-antd/components/table/style/rtl.less`,
   `externals/gitlab/stylesheets/components/content_editor.scss`, `externals/gitlab/stylesheets/page_bundles/_ide_theme_overrides.scss`, `externals/gitlab/stylesheets/framework/sidebar.scss`
 
-```css
-/* input (nested one level, print width 80) */
-margin-left: sg-layout-width(logo-shopify) / 2 * -1 + sg-offset-x(page-nav) / 2;
+```scss
+/* input (nested three levels, print width 80) */
+height: calc(#{$calc-application-viewport-height} - #{$mr-sticky-header-height} - var(--mr-review-bar-height));
 
 /* ours */
-margin-left: sg-layout-width(logo-shopify) / 2 * -1 + sg-offset-x(page-nav)
-  / 2;
+height: calc(
+  #{$calc-application-viewport-height} - #{$mr-sticky-header-height} -
+    var(--mr-review-bar-height)
+);
 
 /* prettier */
-margin-left: sg-layout-width(logo-shopify) / 2 * -1 +
-  sg-offset-x(page-nav) / 2;
+height: calc(
+  #{$calc-application-viewport-height} -
+    #{$mr-sticky-header-height} - var(--mr-review-bar-height)
+);
 ```
 
-An over-wide math-y value run (css token soup here):
-Prettier's fill fit-check breaks INSIDE the wide chunk;
-our core `fill` (biome semantics) breaks the SEPARATOR instead.
+A math-y value run (token soup here):
+Prettier's fill breaks at an earlier separator, though the next chunk still fits;
+our core `fill` (biome semantics) breaks only at the last fitting separator.
 Layout-only, the principled fix is the shared core-fill fit-check change (needs a JS-conformance impact experiment first).
+A spaced `/` is not part of this: it glues to its left operand and breaks after, as in Prettier (`tests/fixtures/format/css/fill-math-chunk-break.css`).
 
 ## less-value-interpolation-rejected
 
```

**File**: `crates/oxc_formatter_css/src/print/at_rule.rs` (modified, +92/-57)
```diff
@@ -11,8 +11,9 @@ use oxc_css_parser::{
         KeyframesName, LessImportOptions, LessImportPrelude, MediaCondition,
         MediaConditionAfterMediaType, MediaConditionKind, MediaFeature, MediaFeatureComparisonKind,
         MediaFeatureName, MediaInParens, MediaInParensKind, MediaQuery, MediaQueryList,
-        NamespacePreludeUri, SassAtRootKind, SimpleBlock, SupportsCondition, SupportsConditionKind,
-        SupportsInParens, SupportsInParensKind, TokenSeq, UnknownAtRulePrelude,
+        NamespacePreludeUri, SassAtRootKind, SimpleBlock, SupportsAnd, SupportsCondition,
+        SupportsConditionKind, SupportsInParens, SupportsInParensKind, SupportsNot, SupportsOr,
+        TokenSeq, UnknownAtRulePrelude,
     },
     pos::Span,
     token::{Token, TokenWithSpan},
@@ -21,10 +22,10 @@ use oxc_css_parser::{
 use oxc_formatter_core::{
     Buffer, Format, FormatElement, arena_cow_str,
     builders::{
-        empty_line, group, hard_line_break, indent, soft_line_break, soft_line_break_or_space,
-        space, text,
+        empty_line, group, hard_line_break, indent, soft_block_indent, soft_line_break,
+        soft_line_break_or_space, space, text,
     },
-    write,
+    format_args, write,
 };
 
 use crate::{
@@ -1050,12 +1051,7 @@ fn write_token_value<'a>(
         let only = groups[0];
         // `name( ... )` covering the whole group:
         // the parens govern breaking/indent; anything else gets the continuation indent.
-        let whole_call = only.len() > 2
-            && matches!(&only[only.len() - 1].token, Token::RParen(_))
-            && (matches!(&only[0].token, Token::LParen(_))
-                || (matches!(&only[0].token, Token::Ident(_))
-                    && matches!(&only[1].token, Token::LParen(_))));
-        if whole_call {
+        if only.len() > 2 && is_one_paren_region(only) {
             write_token_comma_group(only, top_level, f);
         } else if top_level {
             let body = format_with(move |f: &mut CssFormatter<'_, 'a>| {
@@ -1225,6 +1221,26 @@ fn write_token_comma_group_after<'a>(
     filler.finish();
 }
 
+/// Whether `tokens` is one `( ... )` or `name( ... )` region:
+/// the opening paren closes at the last token
+/// (`--f(a) returns type(b)` ends with a `)` too, but is two regions).
+fn is_one_paren_region(tokens: &[TokenWithSpan<'_>]) -> bool {
+    let open = match tokens {
+        [TokenWithSpan { token: Token::LParen(_), .. }, ..] => 0,
+        [
+            TokenWithSpan { token: Token::Ident(_), .. },
+            TokenWithSpan { token: Token::LParen(_), .. },
+            ..,
+        ] => 1,
+        _ => return false,
+    };
+    let mut depth = 0;
+    tokens[open..].iter().position(|t| {
+        depth += value::token_depth_delta(&t.token);
+        depth == 0
+    }) == Some(tokens.len() - open - 1)
+}
+
 /// Wrapper: a comma group is its own breakable group with indent.
 /// Except when it contains paren regions,
 /// which provide their own indentation (avoids double-indenting `name(...)` contents).
@@ -1234,12 +1250,7 @@ fn write_token_comma_group_grouped<'a>(
     f: &mut CssFormatter<'_, 'a>,
 ) {
     // A group that IS one call/paren region delegates breaking to the parens
-    let whole_region = !tokens.is_empty()
-        && matches!(&tokens[tokens.len() - 1].token, Token::RParen(_))
-        && (matches!(&tokens[0].token, Token::LParen(_))
-            || (tokens.len() > 1
-                && matches!(&tokens[0].token, Token::Ident(_))
-                && matches!(&tokens[1].token, Token::LParen(_))));
+    let whole_region = is_one_paren_region(tokens);
     // A `$key: (region)` pair also delegates to the parens
     let kv_region = !whole_region
         && matches!(tokens.last().map(|t| &t.token), Some(Token::RParen(_)))
@@ -2159,57 +2170,81 @@ fn write_supports_condition<'a>(condition: &SupportsCondition<'a>, f: &mut CssFo
     // A fill of keywords and parenthesized terms:
     // a long condition breaks AFTER `and`/`or`, one indent in
     // (`postcss-values` prints the params as a value group, so each word/paren is its own fill entry).
-    let condition_end = to_span(condition.span()).end;
-    let body = format_with(move |f: &mut CssFormatter<'_, 'a>| {
-        let mut filler = f.fill();
-        for kind in &condition.conditions {
-            let (keyword, in_parens) = match kind {
-                SupportsConditionKind::SupportsInParens(in_parens) => (None, in_parens),
-                SupportsConditionKind::And(and) => (Some(&and.keyword), &and.condition),
-                SupportsConditionKind::Or(or) => (Some(&or.keyword), &or.condition),
-                SupportsConditionKind::Not(not) => (Some(&not.keyword), &not.condition),
-            };
-            // A `//` among the entries breaks the condition
-            if let Some(keyword) = keyword {
-                let kw = format_with(move |f: &mut CssFormatter<'_, 'a>| {
-                    let span = to_span(keyword.span());
-                    val
```

**File**: `crates/oxc_formatter_css/src/print/scss.rs` (modified, +2/-2)
```diff
@@ -118,7 +118,7 @@ pub(super) fn top_level_value_breaks_hard<'a>(
         .iter_before(value_span.end)
         .any(|c| c.span.start >= value_span.start);
     has_comments
-        || elements.iter().enumerate().any(|(i, el)| {
+        || elements.iter().any(|el| {
             let group = match el {
                 ComponentValue::SassList(inner) if inner.comma_spans.is_none() => {
                     &inner.elements[..]
@@ -128,7 +128,7 @@ pub(super) fn top_level_value_breaks_hard<'a>(
                 }
                 other => std::slice::from_ref(other),
             };
-            value::comma_group_is_multi(group, i == 0)
+            value::comma_group_is_multi(group)
         })
 }
 
```

---

### Incident Patch 12: `df85b4cd` (2026-10-05)
**Commit Message**: fix(oxfmt): keep blank lines after a line break in Prettier Doc to IR (#27325)

**File**: `apps/oxfmt/src/prettier_compat/from_prettier_doc.rs` (modified, +33/-12)
```diff
@@ -6,7 +6,7 @@
 //! Language-specific routing lives in `core::embed`;
 //! [`postprocess`] here is the conversion's finishing pass (Prettier-fallback path only).
 
-use std::num::NonZeroU8;
+use std::num::{NonZeroU8, NonZeroU32};
 
 use rustc_hash::FxHashMap;
 use serde_json::Value;
@@ -486,7 +486,10 @@ fn extract_group_id(
 /// the finishing step of the Doc→IR conversion (Prettier-fallback path only;
 /// Rust formatters write IR that never needs it):
 /// - strip trailing hardline (useless for embedded parts)
-/// - collapse double-hardlines `[HardWithoutExpand, ExpandParent, HardWithoutExpand, ExpandParent]` → `[Empty, ExpandParent]`
+/// - a hardline right after a line break prints its own newline (`ExactLineBreaks(1)`):
+///   Prettier's hardline always does, the core printer's drops on an empty line.
+///   Tags in between are looked through (`fill(["a", hardline, "", hardline, "b"])`, whitespace-sensitive HTML text),
+///   so every blank line survives.
 /// - merge consecutive Text nodes (the Prettier Doc path can emit adjacent `Text`s)
 /// - trim a Text's trailing spaces/tabs when a hard/empty line follows:
 ///   Prettier's own printer trims at every line break,
@@ -508,17 +511,25 @@ pub fn postprocess<'a>(ir: &mut ArenaVec<'a, FormatElement<'a>>, allocator: &'a
     let mut write = 0;
     let mut read = 0;
     while read < ir.len() {
-        // Collapse double-hardline → empty line
-        if read + 3 < ir.len()
-            && matches!(ir[read], FormatElement::Line(LineMode::HardWithoutExpand))
-            && matches!(ir[read + 1], FormatElement::ExpandParent)
-            && matches!(ir[read + 2], FormatElement::Line(LineMode::HardWithoutExpand))
-            && matches!(ir[read + 3], FormatElement::ExpandParent)
+        // A `hardline` pair (its break-parent keeps the propagation as is) right after a line break
+        if matches!(ir[read], FormatElement::Line(LineMode::HardWithoutExpand))
+            && matches!(ir.get(read + 1), Some(FormatElement::ExpandParent))
+            && ir[..write]
+                .iter()
+                .rev()
+                .find(|el| !matches!(el, FormatElement::Tag(_) | FormatElement::ExpandParent))
+                .is_some_and(|el| {
+                    matches!(
+                        el,
+                        FormatElement::Line(
+                            LineMode::HardWithoutExpand | LineMode::ExactLineBreaks(_)
+                        )
+                    )
+                })
         {
-            ir[write] = FormatElement::Line(LineMode::Empty);
-            ir[write + 1] = FormatElement::ExpandParent;
-            write += 2;
-            read += 4;
+            ir[write] = FormatElement::Line(LineMode::ExactLineBreaks(NonZeroU32::MIN));
+            write += 1;
+            read += 1;
         } else if matches!(ir[read], FormatElement::Text { .. }) {
             // Merge consecutive Text nodes
             let run_start = read;
@@ -621,6 +632,16 @@ mod tests {
         assert_eq!(print_doc_with(&doc, options), "a\n  b\n  \tc");
     }
 
+    #[test]
+    fn fill_keeps_blank_lines_of_empty_parts() {
+        let hardline = json!([{ "type": "line", "hard": true }, { "type": "break-parent" }]);
+        let doc = json!({
+            "type": "fill",
+            "parts": ["a", hardline, "", hardline, "b", hardline, "", hardline, "", hardline, "c"]
+        });
+        assert_eq!(print_doc(&doc, 80), "a\n\nb\n\n\nc");
+    }
+
     #[test]
     fn blockquote_string_align_keeps_its_prefix() {
         let doc = json!([
```

---

### Incident Patch 13: `6a7d48b4` (2026-10-04)
**Commit Message**: fix(parser): report abstract private field error on modifier (#27314)

For `abstract #quux = 3`, report TS18019 on the `abstract` keyword instead of the private identifier, matching TypeScript. Keep the boolean check on the fast path and retrieve the modifier span only when reporting the error.

**File**: `crates/oxc_parser/src/js/class.rs` (modified, +2/-1)
```diff
@@ -797,7 +797,8 @@ impl<'a, C: Config> ParserImpl<'a, C> {
             }
         }
         if r#abstract && name.is_private_identifier() {
-            self.error(diagnostics::abstract_with_private_identifier(name.span()));
+            let modifier = modifiers.get(ModifierKind::Abstract).unwrap();
+            self.error(diagnostics::abstract_with_private_identifier(modifier.span()));
         }
         if r#abstract && initializer.is_some() {
             let (name, span) = self.abstract_member_name(&name);
```

**File**: `tasks/coverage/snapshots/parser_babel.snap` (modified, +4/-4)
```diff
@@ -12459,10 +12459,10 @@ Expect to Parse: tasks/coverage/babel/packages/babel-parser/test/fixtures/typesc
   help: Try inserting a semicolon here
 
   × TS(18019): 'abstract' modifier cannot be used with a private identifier.
-   ╭─[babel/packages/babel-parser/test/fixtures/estree/class-private-property/typescript-invalid-abstract/input.ts:2:12]
+   ╭─[babel/packages/babel-parser/test/fixtures/estree/class-private-property/typescript-invalid-abstract/input.ts:2:3]
  1 │ abstract class TSAbstractClass {
  2 │   abstract #foo: boolean;
-   ·            ────
+   ·   ────────
  3 │ }
    ╰────
 
@@ -13722,10 +13722,10 @@ Expect to Parse: tasks/coverage/babel/packages/babel-parser/test/fixtures/typesc
     ╰────
 
   × TS(18019): 'abstract' modifier cannot be used with a private identifier.
-   ╭─[babel/packages/babel-parser/test/fixtures/typescript/class/private-fields-modifier-abstract/input.ts:2:12]
+   ╭─[babel/packages/babel-parser/test/fixtures/typescript/class/private-fields-modifier-abstract/input.ts:2:3]
  1 │ abstract class A {
  2 │   abstract #a;
-   ·            ──
+   ·   ────────
  3 │ }
    ╰────
 
```

**File**: `tasks/coverage/snapshots/parser_typescript.snap` (modified, +2/-2)
```diff
@@ -18261,10 +18261,10 @@ Expect to Parse: tasks/coverage/typescript/tsc/testdata/tests/cases/conformance/
     ╰────
 
   × TS(18019): 'abstract' modifier cannot be used with a private identifier.
-    ╭─[typescript/tsc/testdata/tests/cases/conformance/classes/members/privateNames/privateNamesIncompatibleModifiers.ts:32:14]
+    ╭─[typescript/tsc/testdata/tests/cases/conformance/classes/members/privateNames/privateNamesIncompatibleModifiers.ts:32:5]
  31 │ abstract class B {
  32 │     abstract #quux = 3;      // Error
-    ·              ─────
+    ·     ────────
  33 │ }
     ╰────
 
```

---

### Incident Patch 14: `2ff6fb51` (2026-10-04)
**Commit Message**: fix(parser): include generator marker in overload diagnostic span (#27313)

Include the generator `*` in TS1222 diagnostic spans for class method overload signatures. Use the earlier of the function start and generator marker so function declaration spans retain their existing start.

**File**: `crates/oxc_parser/src/js/function.rs` (modified, +3/-1)
```diff
@@ -350,7 +350,9 @@ impl<'a, C: Config> ParserImpl<'a, C> {
             if ctx.has_ambient() {
                 self.error(diagnostics::generator_in_ambient_context(self.end_span(generator)));
             } else if body.is_none() {
-                self.error(diagnostics::overload_signature_generator(self.end_span(start)));
+                self.error(diagnostics::overload_signature_generator(
+                    self.end_span(start.min(generator)),
+                ));
             }
         }
         self.verify_modifiers(
```

**File**: `tasks/coverage/snapshots/parser_typescript.snap` (modified, +4/-4)
```diff
@@ -21647,18 +21647,18 @@ Expect to Parse: tasks/coverage/typescript/tsc/testdata/tests/cases/conformance/
    ╰────
 
   × TS(1222): An overload signature cannot be declared as a generator.
-   ╭─[typescript/tsc/testdata/tests/cases/conformance/es6/yieldExpressions/generatorOverloads3.ts:2:7]
+   ╭─[typescript/tsc/testdata/tests/cases/conformance/es6/yieldExpressions/generatorOverloads3.ts:2:5]
  1 │ class C {
  2 │     *f(s: string): Iterable<any>;
-   ·       ───────────────────────────
+   ·     ─────────────────────────────
  3 │     *f(s: number): Iterable<any>;
    ╰────
 
   × TS(1222): An overload signature cannot be declared as a generator.
-   ╭─[typescript/tsc/testdata/tests/cases/conformance/es6/yieldExpressions/generatorOverloads3.ts:3:7]
+   ╭─[typescript/tsc/testdata/tests/cases/conformance/es6/yieldExpressions/generatorOverloads3.ts:3:5]
  2 │     *f(s: string): Iterable<any>;
  3 │     *f(s: number): Iterable<any>;
-   ·       ───────────────────────────
+   ·     ─────────────────────────────
  4 │     *f(s: any): Iterable<any> { }
    ╰────
 
```

---

### Incident Patch 15: `4359a669` (2026-10-04)
**Commit Message**: fix(parser): reject TypeScript class modifiers in JavaScript (#27312)

Reject TypeScript-only class member modifiers in JavaScript with TS8009. Valid JavaScript modifiers and members named `declare`, `override`, or `readonly` remain accepted.

Reuse the existing modifier validation and storage, retaining its deduplication and keyword-span behavior. Coverage fixtures and updated conformance snapshots cover ordinary, repeated, and escaped modifiers.

fixes #27290
closes #27294

**File**: `crates/oxc_parser/src/diagnostics.rs` (modified, +5/-0)
```diff
@@ -1197,6 +1197,11 @@ parser_diagnostics! {
         ts_error("5087", "A labeled tuple element is declared as rest with a '...' before the name, rather than before the type.").with_label(span)
     };
 
+    modifier_in_ts(kind: ModifierKind, span: Span) => {
+        ts_error("8009", format!("The '{kind}' modifier can only be used in TypeScript files."))
+            .with_label(span)
+    };
+
     parameter_modifiers_in_ts(modifier: Modifier, allowed: Option<ModifierKinds>) => {
         ts_error("8012", "Parameter modifiers can only be used in TypeScript files.")
             .with_label(modifier.span())
```

**File**: `crates/oxc_parser/src/js/class.rs` (modified, +14/-0)
```diff
@@ -267,6 +267,20 @@ impl<'a, C: Config> ParserImpl<'a, C> {
                 false,
                 diagnostics::cannot_appear_on_class_elements,
             );
+            if !parser.is_ts {
+                parser.verify_modifiers(
+                    modifiers,
+                    ModifierKinds::new([
+                        ModifierKind::Export,
+                        ModifierKind::Default,
+                        ModifierKind::Static,
+                        ModifierKind::Async,
+                        ModifierKind::Accessor,
+                    ]),
+                    false,
+                    |modifier, _| diagnostics::modifier_in_ts(modifier.kind, modifier.span()),
+                );
+            }
         }
 
         let start = self.cur_start();
```

**File**: `tasks/coverage/misc/fail/oxc-27290-declare.js` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+class A {
+  declare y;
+}
```

**File**: `tasks/coverage/misc/fail/oxc-27290-escaped.js` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+class A {
+  pr\u0069vate x;
+  publ\u0069c f() {}
+}
```

**File**: `tasks/coverage/misc/fail/oxc-27290-private.js` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+class A {
+  private g() {}
+}
```

**File**: `tasks/coverage/misc/fail/oxc-27290-protected.js` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+class A {
+  protected f() {}
+}
```

**File**: `tasks/coverage/misc/fail/oxc-27290-readonly.js` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+class A {
+  readonly x = 1;
+}
```

**File**: `tasks/coverage/misc/fail/oxc-27290-repeated.js` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+class A {
+  private private x = 1;
+  public public f() {}
+  readonly readonly y = 1;
+}
```

#### Recent Merged Pull Requests:
- **PR #27363** (2026-10-06): fix(oxlint,oxfmt): set stderr blocking (@leaysgur)
- **PR #27362** (2026-10-06): docs(oxfmt): update how `embeddedLanguageFormatting` option works (@leaysgur)
- **PR #27360** (2026-10-06): test(oxfmt): remove format tests duplicated by E2E (@leaysgur)
- **PR #27359** (2026-10-06): fix(formatter_core): leave blank frontmatter without dispatcher (@leaysgur)
- **PR #27358** (2026-10-06): docs(formatter_markdown): fix DIVERGENCES.md examples and slug to match behavior (@leaysgur)
- **PR #27357** (2026-10-05): fix(semantic): visit `TSMethodSignature` computed method keys in enclosing scope (@camc314)
- **PR #27354** (2026-10-05): refactor(lexer): answer dense context questions with the full walk (@ShanonJackson)
- **PR #27353** (2026-10-05): fix(lexer): context walk line break and type end rules (@ShanonJackson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
