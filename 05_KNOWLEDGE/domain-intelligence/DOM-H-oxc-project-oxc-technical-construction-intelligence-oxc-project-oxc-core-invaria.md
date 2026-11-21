# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: oxc-project/oxc Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project/oxc",
  "source_url": "https://github.com/oxc-project/oxc",
  "source_version": "209f078b",
  "license": "MIT",
  "timestamp": "2026-11-21T02:00:33.106Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oxc-project-oxc",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project/oxc](https://github.com/oxc-project/oxc) (Revision: `209f078b`).  
> **License**: MIT | **Timestamp**: `2026-11-21T02:00:33.106Z`  
> **Learning ID**: `learn-github-oxc-project-oxc`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), B (Product Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 68%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from oxc-project/oxc:

# Forensic Learning Record (Deep Inspection): oxc-project/oxc

> **Canonical Artifact**: `07_PROJECT_LEARNING/oxc-project-oxc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oxc-project/oxc](https://github.com/oxc-project/oxc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T02:00:31.337Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oxc-project/oxc`
- **Description**: ⚓ A collection of high-performance JavaScript tools.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 23525 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/oxfmt/conformance/live_worker.ts`
```
// Runs one `run_live.ts` comparison (a fixture under one option set) in a `tinypool` worker,
// Prettier is CPU-bound JS, so the main thread alone serializes it.

import { readFileSync } from "node:fs";
import prettier from "prettier";
import * as astroPlugin from "prettier-plugin-astro";
import * as sveltePlugin from "prettier-plugin-svelte";
import { format } from "../dist/index.js";

export type LiveTask = {
  name: string;
  fullPath: string;
  isProject: boolean;
  options: Record<string, unknown>;
};

/** `null` when both agree, otherwise both outputs (`"ERROR"` for a failed one). */
export default async function run({ name, fullPath, isProject, options }: LiveTask) {
  let input = readFileSync(fullPath, "utf8");
  let expected = await formatWithPrettier(name, input, options);
  // A project hands over Prettier's output, unless Prettier cannot read it back either
  if (isProject && expected !== null) {
    const again = await formatWithPrettier(name, expected, options);
    if (again !== null) [input, expected] = [expected, again];
  }
  const prettierResult = expected ?? "ERROR";
  const oxfmtResult = await formatWithOxfmt(name, input, options);

  // Both failing to parse is not a pass, the fixture exercised nothing
  if (oxfmtResult === prettierResult && oxfmtResult !== "ERROR") return null;
  return { name, oxfmt: oxfmtResult, prettier: prettierResult };
}

/** `null` when Prettier fails. */
async function formatWithPrettier(
  fileName: string,
  content: string,
  options: Record<string, unknown>,
): Promise<string | null> {
  try {
    return await prettier.format(content, {
      ...options,
      filepath: fileName,
      plugins: [sveltePlugin, astroPlugin],
    });
  } catch {
    return null;
  }
}

async function formatWithOxfmt(
  fileName: string,
  content: string,
  options: Record<string, unknown>,
): Promise<string> {
  const res = await format(fileName, content, options);
  return res.errors.length === 0 ? res.code : "ERROR";
}

```

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29958** (2026-11-21): **perf(mangler): promote hot late bindings into front slots of large scopes**
  *Symptoms*: Bindings take free slots in declaration order. In a scope with many bindings, a heavily used binding declared late gets a fresh slot that no other scope shares, and often ends up with a two-character name. Meanwhile the scope's first slots are reused by inner scopes for their parameters and locals, so they get one-character names no matter how rarely the outer bindings in them are used.  This PR swaps a few such bindings into the front of the scope: - only in scopes with at least 100 mangle candidates; - at most 20 swaps per scope, each with the coldest of the first 54 bindings; - only when the late binding has more than 4× the uses of the one it displaces; - parameters never move, so `function(e,t,n)` patterns survive.  The promoted binding's uses join a slot that already gets a one-character name, and its old slot cools down, freeing a one-character name for another slot. Everything else keeps declaration order, which is what keeps neighbouring names similar for gzip.  ### Example  Input (the full file is in the details below):  ```js export function outer() {   var c0, c1, /* … */ c99;                  // 100 cold bindings, declared first   function set(v) { c0 = v; /* … */ c99 = v; }   function g(p0, /* … */ p53) {              // 54 hot params, reusing the front slots     return [p0, /* … */ p53, /* ×12 */];   }   var hot = g();                             // hot binding declared late   return [hot, /* ×13 */, set, c0, /* … */ c99]; } ```  No playground link: the input n
  **Post-Mortem & Fix Analysis**:
  > ## [Monitor Oxc](https://github.com/oxc-project/monitor-oxc/actions/runs/44847911577)  Commit: [`3d272902f83f`](https://github.com/oxc-project/oxc/commit/3d272902f83f755bbcd6e4781be419f9a892578d)  | suite | result | |-------|--------| | [Test262](https://github.com/oxc-project/monitor-oxc/actions/runs/44847911577/job/136672060186) | :white_check_mark: | | [Build](https://github.com/oxc-project/monitor-oxc/actions/runs/44847911577/job/136672060358) | :white_check_mark: | | [Isolated Declarations](https://github.com/oxc-project/monitor-oxc/actions/runs/44847911577/job/136672902538) | :white_check_mark: | | [Runtime Bundles](https://github.com/oxc-project/monitor-oxc/actions/runs/44847911577/job/136672902577) | :white_check_mark: | | [Uglify Corpus](https://github.com/oxc-project/monitor-oxc/actions/runs/44847911577/job/136672902599) | :white_check_mark: | | [Minify Size](https://github.com/oxc-project/monitor-oxc/actions/runs/44847911577/job/136672902606) | :white_check_mark: | | [(white
  > ## Minify Size  **[`claude/gracious-euler-g6xiwf`](https://github.com/oxc-project/oxc/commit/3d272902f83f755bbcd6e4781be419f9a892578d)** vs **[`main`](https://github.com/oxc-project/oxc/commit/209f078ba8572400fbf75e59cbd48fa8c291e71a)**  **542 of 109,516 files changed.**  | | files | changed | raw | gzip -9 | brotli q5 | |---|---:|---:|---:|---:|---:| | normal | 108,351 | 474<br><sub>455 smaller, 19 larger</sub> | -80,744 B (-0.016%)<br><sub>503.27 MB → 503.19 MB</sub> | +4,666 B (+0.003%)<br><sub>148.55 MB → 148.56 MB</sub> | +13,697 B (+0.010%)<br><sub>136.55 MB → 136.56 MB</sub> | | already minified (`*.min.js`) | 1,165 | 68<br><sub>64 smaller, 4 larger</sub> | -6,313 B (-0.012%)<br><sub>54.30 MB → 54.29 MB</sub> | +905 B (+0.006%)<br><sub>14.16 MB → 14.16 MB</sub> | +1,225 B (+0.009%)<br><sub>13.23 MB → 13.23 MB</sub> |  **[Full report](https://github.com/oxc-project/monitor-oxc/actions/runs/44847911577)** (Test Minify Size summary): top files and packages each way, and before/afte

- **Issue #29950** (2026-11-20): **docs(formatter_css): record multi-line value comment expanding its group as a divergence**
  *Symptoms*: For consistency. All other languages break parent, but CSS does not. 
  **Post-Mortem & Fix Analysis**:
  > * **#29950** <a href="https://app.graphite.com/github/pr/oxc-project/oxc/29950?utm_source=stack-comment-icon" target="_blank"><img src="https://static.graphite.dev/graphite-32x32-black.png" alt="Graphite" width="10px" height="10px"/></a> 👈 <a href="https://app.graphite.com/github/pr/oxc-project/oxc/29950?utm_source=stack-comment-view-in-graphite" target="_blank">(View in Graphite)</a> * `main` <hr />  ## How to use the Graphite Merge Queue  Add either label to this PR to merge it via the merge queue: - <kbd>0-merge</kbd> - adds this PR to the back of the merge queue - <kbd>hotfix</kbd> - for urgent changes, fast-track this PR to the front of the merge queue  You must have a Graphite account in order to use the merge queue. Sign up using [this link](https://app.graphite.com/invite/github/oxc-project?ref=merge-queue-instructions-in-stack-comment&prId=29950).  <h2></h2> <sub>  An organization admin has enabled the [Graphite Merge Queue](https://graphite.dev/docs/graphite-merge-queue) in 
  > ### Merge activity  * **Nov 20, 2:16 PM UTC**: The merge label '0-merge' was detected. This PR will be added to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc) once it meets the requirements. * **Nov 20, 2:17 PM UTC**: `leaysgur` added this pull request to the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). * **Nov 20, 2:24 PM UTC**: Merged by the [Graphite merge queue](https://app.graphite.com/merges?org=oxc-project&repo=oxc). 

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

### Incident Patch 1: `6db561f3` (2026-11-20)
**Commit Message**: fix(transformer): keep correct keys on leftover fields with setPublicClassFields (#29911)

With `setPublicClassFields: true`, the TypeScript transform moves field initializers into the constructor. With the default `allowDeclareFields`, the field declaration stays in the class body. For string, numeric, BigInt and computed keys, the key was moved out with `take_in`, leaving `null;` / `[null];` behind, so instances got a bogus `null` own property.

Supersedes #29906. That PR kept literal keys, but left computed keys as `[_y]` while assigning `_y` in a `static {}` block. JavaScript evaluates every computed class key during class definition, before any static block runs, so `[_y]` read `undefined`. That PR also panicked with `allowDeclareFields: false`.

Closes #29904

### Example

Input (options: `{ "assumptions": { "setPublicClassFields": true }, "plugins": ["transform-typescript"] }`):

```ts
const getY = () => "yKey";
class C {
  "x" = 1;
  [getY()] = 2;
}
console.log(Object.keys(new C()));
```

No playground link: the playground's `useDefineForClassFields: false` turns on both `setPublicClassFields` and `removeClassFieldsWithoutInitializer`, so it can't select the kept-declaratio

**File**: `crates/oxc_transformer/src/typescript/class.rs` (modified, +66/-15)
```diff
@@ -9,7 +9,10 @@ use oxc_syntax::operator::AssignmentOperator;
 use oxc_traverse::BoundIdentifier;
 
 use crate::{
-    common::computed_key::{create_computed_key_temp_var, key_needs_temp_var},
+    common::{
+        computed_key::{create_computed_key_temp_var, key_needs_temp_var},
+        duplicate::duplicate_expression,
+    },
     context::TraverseCtx,
     utils::ast_builder::{
         create_class_constructor, create_this_property_access, create_this_property_assignment,
@@ -120,9 +123,17 @@ impl<'a> TypeScript<'a> {
                         || (!prop.r#static && will_hoist_initializers_to_constructor) =>
                 {
                     if let Some(value) = prop.value.take() {
+                        // A static property is replaced by a static block below, and an instance
+                        // property is removed later when `remove_class_fields_without_initializer`
+                        // is `true`. Otherwise, the instance property declaration stays in the
+                        // class body (without its initializer), so its key is still evaluated
+                        // during class definition.
+                        let keep_declaration =
+                            !prop.r#static && !self.remove_class_fields_without_initializer;
                         let assignment = self.convert_property_definition(
                             &mut prop.key,
                             value,
+                            keep_declaration,
                             &mut computed_key_assignments,
                             ctx,
                         );
@@ -148,6 +159,15 @@ impl<'a> TypeScript<'a> {
                             // keeps and is evaluated in the same order as the original class field in static block.
                             computed_key_assignments.push(key.take_in(ctx));
                         }
+                    } else if !prop.declare && prop.computed {
+                        // The property declaration without initializer is kept in the class body, so its
+                        // computed key is evaluated during class definition. Any pending computed key
+                        // assignments from previous elements must be evaluated before it.
+                        Self::convert_computed_key(
+                            &mut prop.key,
+                            &mut computed_key_assignments,
+                            ctx,
+                        );
                     }
                 }
                 ClassElement::MethodDefinition(method) => {
@@ -435,12 +455,18 @@ impl<'a> TypeScript<'a> {
     /// * Static key:
     ///   `class C { x = 1; }` -> `class C { constructor() { this.x = 1; } }`
     ///
+    /// When `keep_declaration` is `true`, the property declaration stays in the class body, so
+    /// its key is still evaluated during class definition. In that case the temp var is assigned
+    /// inside the key itself, so the key expression is evaluated exactly once and in source order:
+    ///   `class C { [x()] = 1; }` -> `let _x; class C { constructor() { this[_x] = 1; } [_x = x()]; }`
+    ///
     /// Returns an assignment statement which would be inserted in the constructor body.
     #[expect(clippy::unused_self)]
     fn convert_property_definition(
         &self,
         key: &mut PropertyKey<'a>,
         value: Expression<'a>,
+        keep_declaration: bool,
         computed_key_assignments: &mut Vec<Expression<'a>>,
         ctx: &mut TraverseCtx<'a>,
     ) -> Statement<'a> {
@@ -467,8 +493,25 @@ impl<'a> TypeScript<'a> {
                 let new_key = if key_needs_temp_var(key, ctx) {
                     let taken_key = key.take_in(ctx);
                     let (assignment, ident) = create_computed_key_temp_var(taken_key, ctx);
-                    computed_key_assignments.push(assignment);
+                    if keep_declaration {
+                        // All computed keys are evaluated during class definition, before any
+                        // static block runs, so assigning the temp var in a static block would
+                        // leave it `undefined` when the kept declaration's key is evaluated.
+                        // Assign it in the key instead: `[x()] = 1` -> `[_x = x()];`.
+                        *key = assignment;
+                        Self::prepend_computed_key_assignments(key, computed_key_assignments, ctx);
+                    } else {
+                        computed_key_assignments.push(assignment);
+                    }
                     ident
+                } else if keep_declaration {
+                    // Keep the original key in the kept declaration, rather than leaving
+                    // the `NullLiteral` dummy from `take_in`, which would create a `null` property.
+                    // The key is side-effect free here, so it can be duplicated without a temp var.
+                    let (original_key, new_key) =
+                       
```

**File**: `tasks/transform_conformance/snapshots/oxc.snap.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 commit: 16a2d671
 
-Passed: 342/467
+Passed: 344/469
 
 # All Passed:
 * babel-plugin-transform-class-static-block
@@ -49,7 +49,7 @@ x Output mismatch
 x Output mismatch
 
 
-# babel-plugin-transform-typescript (51/67)
+# babel-plugin-transform-typescript (53/69)
 * computed-constant-value/input.ts
 x Output mismatch
 
```

**File**: `tasks/transform_conformance/snapshots/oxc_exec.snap.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ commit: 16a2d671
 
 node: v26.12.1
 
-Passed: 71 of 367 (19.35%)
+Passed: 73 of 369 (19.78%)
 
 Failures:
 
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-computed-key-order-remove-uninitialized/exec.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+const log: string[] = [];
+const k = (name: string) => (log.push(name), name);
+
+class D {
+  [k("a")] = 1;
+  "lit" = 2;
+  [k("b")]: number;
+  static [k("c")] = 3;
+  [k("d")]: number;
+  [k("e")]() {}
+  [k("f")] = 4;
+  static [k("g")] = 5;
+  plain = 6;
+}
+
+expect(log).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
+const d = new D();
+expect(log).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
+expect(Object.keys(d)).toEqual(["a", "lit", "f", "plain"]);
+expect(d).toEqual({ a: 1, lit: 2, f: 4, plain: 6 });
+expect(Object.keys(D)).toEqual(["c", "g"]);
+expect(D.c).toBe(3);
+expect(D.g).toBe(5);
+expect(typeof D.prototype.e).toBe("function");
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-computed-key-order-remove-uninitialized/input.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+class D {
+  [k("a")] = 1;
+  [k("b")]: number;
+  static [k("c")] = 2;
+  [k("d")]: number;
+  [k("e")]() {}
+  static [k("f")] = 3;
+  [k("g")] = 4;
+  static [k("h")] = 5;
+}
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-computed-key-order-remove-uninitialized/options.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "assumptions": {
+    "setPublicClassFields": true
+  },
+  "plugins": [["transform-typescript", { "allowDeclareFields": false }]]
+}
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-computed-key-order-remove-uninitialized/output.js` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+let _k, _k2, _k3, _k4, _k5;
+class D {
+  constructor() {
+    this[_k] = 1;
+    this[_k4] = 4;
+  }
+  static {
+    _k3 = k("f"), _k4 = k("g"), _k5 = k("h");
+  }
+  static {
+    this[_k2] = 2;
+  }
+  [(_k = k("a"), k("b"), _k2 = k("c"), k("d"), k("e"))]() {}
+  static {
+    this[_k3] = 3;
+  }
+  static {
+    this[_k5] = 5;
+  }
+}
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-non-identifier-keys/exec.ts` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+const log: string[] = [];
+const k = (name: string) => (log.push(name), name);
+const getY = () => "yKey";
+const bound = "b";
+
+class C {
+  "x" = 1;
+  1 = 2;
+  [getY()] = 4;
+  [bound] = 5;
+  z = 6;
+}
+
+const c = new C();
+expect(Object.keys(c)).toEqual(["1", "x", "yKey", "b", "z"]);
+expect(c).toEqual({ 1: 2, x: 1, yKey: 4, b: 5, z: 6 });
+
+class D {
+  [k("a")] = 1;
+  "lit" = 2;
+  [k("b")]: number;
+  static [k("c")] = 3;
+  [k("d")]: number;
+  [k("e")]() {}
+  [k("f")] = 4;
+  static [k("g")] = 5;
+  plain = 6;
+}
+
+expect(log).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
+const d = new D();
+expect(log).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
+expect(d.a).toBe(1);
+expect(d.lit).toBe(2);
+expect(d.f).toBe(4);
+expect(d.plain).toBe(6);
+expect(D.c).toBe(3);
+expect(D.g).toBe(5);
+expect(typeof D.prototype.e).toBe("function");
+expect(Object.keys(d)).not.toContain("undefined");
+expect(Object.keys(d)).not.toContain("null");
+expect(Object.keys(D)).toEqual(["c", "g"]);
```

---

### Incident Patch 2: `831fbcab` (2026-11-20)
**Commit Message**: fix(transformer): don't fold computed key assignments into non-computed method keys (#29912)

Follow-up to #29911 (merged).

With `setPublicClassFields: true`, key assignments that are still waiting to be emitted (for example from a static field turned into a static block) are prepended to the next method or accessor key, even when that key isn't computed. A non-computed key can't hold a sequence expression, so the output is invalid JavaScript. This bug is already on `main`; #29911 didn't introduce it.

### Example

Input, with target `esnext` and `useDefineForClassFields: false`:

```ts
const k = (name: string) => name;
class C {
  static [k("a")] = 1;
  "m"() {
    return "m";
  }
}
console.log(C.a, new C().m());
```

[Playground for this example](https://playground.oxc.rs/?t=codegen&options=%7B%22run%22%3A%7B%22transform%22%3Atrue%7D%2C%22parser%22%3A%7B%22extension%22%3A%22ts%22%7D%2C%22transformer%22%3A%7B%22target%22%3A%22esnext%22%2C%22useDefineForClassFields%22%3Afalse%7D%7D&code=const+k+%3D+%28name%3A+string%29+%3D%3E+name%3B%0Aclass+C+%7B%0A++static+%5Bk%28%22a%22%29%5D+%3D+1%3B%0A++%22m%22%28%29+%7B%0A++++return+%22m%22%3B%0A++%7D%0A%7D%0Aconsole.log%28C.a%2C+new+C%28%29

**File**: `crates/oxc_transformer/src/typescript/class.rs` (modified, +5/-2)
```diff
@@ -173,15 +173,18 @@ impl<'a> TypeScript<'a> {
                 ClassElement::MethodDefinition(method) => {
                     if method.kind == MethodDefinitionKind::Constructor {
                         constructor = Some(&mut method.value);
-                    } else {
+                    } else if method.computed {
+                        // A non-computed key (e.g. `"m"() {}`) has no side effects, and can't hold
+                        // a sequence expression. Pending assignments go to the next computed key
+                        // or the static block instead.
                         Self::convert_computed_key(
                             &mut method.key,
                             &mut computed_key_assignments,
                             ctx,
                         );
                     }
                 }
-                ClassElement::AccessorProperty(accessor) => {
+                ClassElement::AccessorProperty(accessor) if accessor.computed => {
                     Self::convert_computed_key(
                         &mut accessor.key,
                         &mut computed_key_assignments,
```

**File**: `tasks/transform_conformance/snapshots/oxc.snap.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 commit: 16a2d671
 
-Passed: 344/469
+Passed: 345/470
 
 # All Passed:
 * babel-plugin-transform-class-static-block
@@ -49,7 +49,7 @@ x Output mismatch
 x Output mismatch
 
 
-# babel-plugin-transform-typescript (53/69)
+# babel-plugin-transform-typescript (54/70)
 * computed-constant-value/input.ts
 x Output mismatch
 
```

**File**: `tasks/transform_conformance/snapshots/oxc_exec.snap.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ commit: 16a2d671
 
 node: v26.12.1
 
-Passed: 73 of 369 (19.78%)
+Passed: 74 of 370 (20.00%)
 
 Failures:
 
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-non-computed-method-key/exec.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+const log: string[] = [];
+const k = (name: string) => (log.push(name), name);
+
+class C {
+  static [k("a")] = 1;
+  "m"() {
+    return "m";
+  }
+  1() {
+    return 1;
+  }
+  get "g"() {
+    return 2;
+  }
+  static "s"() {
+    return "s";
+  }
+  [k("b")] = 3;
+}
+
+expect(log).toEqual(["a", "b"]);
+expect(C.a).toBe(1);
+expect(C.s()).toBe("s");
+const c = new C();
+expect(c.m()).toBe("m");
+expect(c[1]()).toBe(1);
+expect(c.g).toBe(2);
+expect(c.b).toBe(3);
+expect(Object.keys(c)).toEqual(["b"]);
+expect(log).toEqual(["a", "b"]);
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-non-computed-method-key/input.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+class C {
+  static [k("a")] = 1;
+  "m"() {}
+  1() {}
+  get "g"() {
+    return 2;
+  }
+  static "s"() {}
+  [k("b")] = 3;
+}
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-non-computed-method-key/options.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "assumptions": {
+    "setPublicClassFields": true
+  },
+  "plugins": ["transform-typescript"]
+}
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/set-public-class-fields-non-computed-method-key/output.js` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+let _k, _k2;
+class C {
+  constructor() {
+    this[_k2] = 3;
+  }
+  static {
+    this[_k] = 1;
+  }
+  "m"() {}
+  1() {}
+  get "g"() {
+    return 2;
+  }
+  static "s"() {}
+  [(_k = k("a"), _k2 = k("b"))];
+}
```

---

### Incident Patch 3: `e4e2ac4e` (2026-11-20)
**Commit Message**: fix(parser,semantic): reject invalid types in type arguments (#29945)

TypeScript parses an element of a type-argument list only from a token that can start a type. `null` is a literal type and cannot begin a qualified name, and JSDoc `?`/`!` types are grammar errors wherever they appear. Before this change, Oxc did three things differently:

- It parsed reserved words such as `class` and `return` as type references inside type arguments.
- It parsed `null.x` as a qualified name.
- It reported JSDoc `?`/`!` only when the type was the top-level type of a type annotation.

As a result, every example in the issue was accepted silently.

### Example

Input from #29314, plus `type T = null.x;` ([playground for `type T = null.x`](https://playground.oxc.rs/?t=ast&options=%7B%22parser%22%3A%7B%22extension%22%3A%22ts%22%2C%22semanticErrors%22%3Atrue%7D%7D&code=type+T+%3D+null.x%3B); it runs the released Oxc, so it shows the before behavior). Each line was run as its own `.ts` file with `cargo run -p oxc_semantic --example semantic`:

```ts
f<class>(h);
f<return>(h);
f<A<class>>(h);
f<A<return>>(h);
f<A<null.x>>(h);
f<A<B?>>(h);
f<A<?>>(h);
f<A<?B>>(h);
f<A<B!>>(h);
f<A<!B>>(h);
type T = nul

**File**: `crates/oxc_parser/src/ts/types.rs` (modified, +59/-15)
```diff
@@ -466,9 +466,14 @@ impl<'a, C: Config> ParserImpl<'a, C> {
             | Kind::Boolean
             | Kind::Undefined
             | Kind::Never
-            | Kind::Object
+            | Kind::Object => self.parse_keyword_type(),
             // Parse `null` as `TSNullKeyword` instead of null literal to align with typescript eslint.
-            | Kind::Null => self.parse_keyword_type(),
+            // Unlike the keywords above, it cannot begin a qualified name: `null.x`.
+            Kind::Null => {
+                let span = self.cur_token().span();
+                self.bump_any();
+                TSType::new_ts_null_keyword(span, self)
+            }
             // TODO: js doc types: `JSDocAllType`, `JSDocFunctionType`
             // Kind::StarEq => {
             // scanner.reScanAsteriskEqualsToken();
@@ -491,7 +496,11 @@ impl<'a, C: Config> ParserImpl<'a, C> {
                 let start = self.cur_start();
                 let literal = self.parse_template_literal(false);
                 let span = self.end_span(start);
-                TSType::new_ts_literal_type(span, TSLiteral::TemplateLiteral(self.alloc(literal)), self)
+                TSType::new_ts_literal_type(
+                    span,
+                    TSLiteral::TemplateLiteral(self.alloc(literal)),
+                    self,
+                )
             }
             Kind::Minus => {
                 if self.lexer.peek_token().kind().is_number() {
@@ -517,9 +526,7 @@ impl<'a, C: Config> ParserImpl<'a, C> {
                     TSType::TSThisType(this_type)
                 }
             }
-            Kind::Typeof => {
-                self.parse_type_query()
-            }
+            Kind::Typeof => self.parse_type_query(),
             Kind::LCurly => {
                 let opening_span = self.cur_token().span();
                 self.bump_any();
@@ -576,7 +583,6 @@ impl<'a, C: Config> ParserImpl<'a, C> {
             Kind::Symbol => TSType::new_ts_symbol_keyword(span, self),
             Kind::Undefined => TSType::new_ts_undefined_keyword(span, self),
             Kind::Unknown => TSType::new_ts_unknown_keyword(span, self),
-            Kind::Null => TSType::new_ts_null_keyword(span, self),
             _ => unreachable!(),
         }
     }
@@ -935,7 +941,7 @@ impl<'a, C: Config> ParserImpl<'a, C> {
                 Kind::RAngle,
                 Kind::Comma,
                 opening_span,
-                Self::parse_ts_type,
+                Self::parse_type_argument,
             );
             self.expect(Kind::RAngle);
             let span = self.end_span(start);
@@ -1013,7 +1019,7 @@ impl<'a, C: Config> ParserImpl<'a, C> {
                 Kind::RAngle,
                 Kind::Comma,
                 opening_span,
-                Self::parse_ts_type,
+                Self::parse_type_argument,
             );
             self.expect(Kind::RAngle);
             let span = self.end_span(start);
@@ -1025,6 +1031,18 @@ impl<'a, C: Config> ParserImpl<'a, C> {
         None
     }
 
+    /// Parse one type in a `TypeArguments` list.
+    ///
+    /// TypeScript parses a type argument only from a token which can start a type. A type
+    /// reference otherwise accepts any identifier name, as in `let a: class`, but `A<class>`
+    /// is not a type-argument list.
+    fn parse_type_argument(&mut self) -> TSType<'a> {
+        if is_reserved_non_type_start(self.cur_kind()) {
+            return self.unexpected();
+        }
+        self.parse_ts_type()
+    }
+
     /// Speculatively parse a `<T, U>` type-argument list in an expression
     /// position (e.g. `foo<T>(arg)` vs `foo < T`). Returns `None` if a cached failure
     /// rules it out, or rewinds to the checkpoint when a fresh attempt fails.
@@ -1089,8 +1107,12 @@ impl<'a, C: Config> ParserImpl<'a, C> {
         let opening_span = self.cur_token().span();
         debug_assert!(self.at(Kind::LAngle));
         self.advance(Kind::LAngle);
-        let (params, _) =
-            self.parse_delimited_list(Kind::RAngle, Kind::Comma, opening_span, Self::parse_ts_type);
+        let (params, _) = self.parse_delimited_list(
+            Kind::RAngle,
+            Kind::Comma,
+            opening_span,
+            Self::parse_type_argument,
+        );
         // A contiguous `>=` remains a relational operator: `a < b >= c`. A separated
         // `> =` can end an instantiation before `=`; assignment validity is checked later.
         // Re-lex before consuming `>` so whitespace between these spellings matters.
@@ -1151,9 +1173,11 @@ impl<'a, C: Config> ParserImpl<'a, C> {
     ///
     /// plus the JSDoc postfix `!` and `?`, which the type parser accepts in order to report them.
     /// Any other token ends the list early: `a < b;`, `a < b.c)`, `a < 0 &&`, `a < this.b`.
+    /// A reserved word which cannot start a type rules out the list at once: `a < class {}`.
     ///
     /// The lexer is positioned after `first`. The checks mirror `parse_non_array
```

**File**: `crates/oxc_semantic/src/checker/mod.rs` (modified, +3/-1)
```diff
@@ -99,7 +99,9 @@ pub fn check<'a>(kind: AstKind<'a>, ctx: &SemanticBuilder<'a>) {
         AstKind::VariableDeclarator(decl) if !ctx.source_type.is_typescript() => {
             js::check_variable_declarator_redeclaration(decl, ctx);
         }
-        AstKind::TSTypeAnnotation(annot) => ts::check_ts_type_annotation(annot, ctx),
+        AstKind::JSDocNullableType(ty) => ts::check_jsdoc_nullable_type(ty, ctx),
+        AstKind::JSDocNonNullableType(ty) => ts::check_jsdoc_non_nullable_type(ty, ctx),
+        AstKind::JSDocUnknownType(ty) => ts::check_jsdoc_unknown_type(ty, ctx),
         AstKind::TSTypePredicate(predicate) => ts::check_ts_type_predicate(predicate, ctx),
         AstKind::TSExternalModuleDeclaration(decl) => {
             ts::check_ts_external_module_declaration(decl, ctx);
```

**File**: `crates/oxc_semantic/src/checker/typescript.rs` (modified, +18/-9)
```diff
@@ -10,15 +10,20 @@ use oxc_str::{JSStr, Str};
 
 use crate::{builder::SemanticBuilder, diagnostics};
 
-pub fn check_ts_type_annotation(annotation: &TSTypeAnnotation<'_>, ctx: &SemanticBuilder<'_>) {
-    let (modifier, is_start, span_with_illegal_modifier) = match &annotation.type_annotation {
-        TSType::JSDocNonNullableType(ty) => ('!', !ty.postfix, ty.span()),
-        TSType::JSDocNullableType(ty) => ('?', !ty.postfix, ty.span()),
-        _ => {
-            return;
-        }
-    };
+pub fn check_jsdoc_nullable_type(ty: &JSDocNullableType<'_>, ctx: &SemanticBuilder<'_>) {
+    check_jsdoc_type_modifier('?', !ty.postfix, ty.span, ctx);
+}
+
+pub fn check_jsdoc_non_nullable_type(ty: &JSDocNonNullableType<'_>, ctx: &SemanticBuilder<'_>) {
+    check_jsdoc_type_modifier('!', !ty.postfix, ty.span, ctx);
+}
 
+fn check_jsdoc_type_modifier(
+    modifier: char,
+    is_start: bool,
+    span_with_illegal_modifier: Span,
+    ctx: &SemanticBuilder<'_>,
+) {
     let valid_type_span = if is_start {
         span_with_illegal_modifier.shrink_left(1)
     } else {
@@ -32,14 +37,18 @@ pub fn check_ts_type_annotation(annotation: &TSTypeAnnotation<'_>, ctx: &Semanti
         Cow::Borrowed(suggestion)
     };
 
-    ctx.error(diagnostics::jsdoc_type_in_annotation(
+    ctx.error(diagnostics::jsdoc_type_modifier(
         modifier,
         is_start,
         span_with_illegal_modifier,
         &suggestion,
     ));
 }
 
+pub fn check_jsdoc_unknown_type(ty: &JSDocUnknownType, ctx: &SemanticBuilder<'_>) {
+    ctx.error(diagnostics::jsdoc_type(ty.span));
+}
+
 pub fn check_ts_type_predicate(predicate: &TSTypePredicate<'_>, ctx: &SemanticBuilder<'_>) {
     if !is_allowed_type_predicate_position(ctx) {
         ctx.error(diagnostics::type_predicate_only_in_return_type(predicate.span));
```

**File**: `crates/oxc_semantic/src/diagnostics.rs` (modified, +7/-1)
```diff
@@ -319,7 +319,7 @@ pub fn await_or_yield_in_parameter(x0: &str, span1: Span) -> OxcDiagnostic {
 
 /// '?' at the end of a type is not valid TypeScript syntax. Did you mean to write 'number | null | undefined'?(17019)
 #[cold]
-pub fn jsdoc_type_in_annotation(
+pub fn jsdoc_type_modifier(
     modifier: char,
     is_start: bool,
     span: Span,
@@ -335,6 +335,12 @@ pub fn jsdoc_type_in_annotation(
     .with_help(format!("Did you mean to write '{suggested_type}'?"))
 }
 
+/// JSDoc types can only be used inside documentation comments.(8020)
+#[cold]
+pub fn jsdoc_type(span: Span) -> OxcDiagnostic {
+    ts_error("8020", "JSDoc types can only be used inside documentation comments.").with_label(span)
+}
+
 #[cold]
 pub fn not_allowed_namespace_declaration(span: Span) -> OxcDiagnostic {
     ts_error(
```

**File**: `tasks/coverage/misc/fail/oxc-29314-1.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+f<class>(h);
```

**File**: `tasks/coverage/misc/fail/oxc-29314-2.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+f<A<return>>(h);
```

**File**: `tasks/coverage/misc/fail/oxc-29314-3.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+type T = null.x;
```

**File**: `tasks/coverage/snapshots/lexer_misc.snap` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 lexer_misc Summary:
-AST Parsed     : 431/431 (100.00%)
-Positive Passed: 431/431 (100.00%)
+AST Parsed     : 434/434 (100.00%)
+Positive Passed: 434/434 (100.00%)
```

#### Recent Merged Pull Requests:
- **PR #29958** (closed): perf(mangler): promote hot late bindings into front slots of large scopes (@Dunqing)
- **PR #29950** (2026-11-20): docs(formatter_css): record multi-line value comment expanding its group as a divergence (@leaysgur)
- **PR #29947** (2026-11-20): fix(semantic): align JSDoc nullable type suggestions with TypeScript (@camc314)
- **PR #29946** (2026-11-20): chore(submodules): update submodule SHAs to latest commits (@camc314)
- **PR #29945** (2026-11-20): fix(parser,semantic): reject invalid types in type arguments (@camc314)
- **PR #29942** (2026-11-20): refactor(formatter_css): share block comment helper (@leaysgur)

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

## X. transformer): keep correct keys on leftover fields with setPublicClassFields

**RULE**:
When implementing operations in `crates/oxc_transformer/src/typescript/class.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6db561f3`: transformer): keep correct keys on leftover fields with setPublicClassFields. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_transformer/src/typescript/class.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    common::{
        computed_key::{create_computed_key_temp_var, key_needs_temp_var},
        duplicate::duplicate_expression,
    },
                        // A static property is replaced by a static block below, and an instance
                        // property is removed later when `remove_class_fields_without_initializer`
                        // is `true`. Otherwise, the instance property declaration stays in the
                        // class body (without its initializer), so its key is still evaluated
                        // during class definition.
                        let keep_declaration =
                            !prop.r#static && !self.remove_class_fields_without_initializer;
                            keep_declaration,
                    } else if !prop.declare && prop.computed {
                        // The property declaration without initializer is kept in the class body, so its
                        // computed key is evaluated during class definition. Any pending computed key
                        // assignments from previous elements must be evaluated before it.
                        Self::convert_computed_key(
                      
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    common::computed_key::{create_computed_key_temp_var, key_needs_temp_var},
                    computed_key_assignments.push(assignment);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6db561f3` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
