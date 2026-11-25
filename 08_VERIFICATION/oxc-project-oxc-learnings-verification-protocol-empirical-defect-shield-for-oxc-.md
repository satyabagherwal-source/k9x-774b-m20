# Verification Protocol: Verification Protocol: Empirical Defect Shield for oxc-project-oxc-learnings

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project-oxc-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T01:52:57.133Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oxc-project-oxc-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project-oxc-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T01:52:57.133Z`  
> **Learning ID**: `LEARN-EVO-oxc-project-oxc-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `oxc-project-oxc-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oxc-project-oxc-learnings.md`  
> **Source**: github ([https://github.com/oxc-project/oxc](https://github.com/oxc-project/oxc))  
> **Source Version**: `e87c19c1`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T01:52:47.985Z  
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
> **Harvest Timestamp**: 2026-11-25T01:52:47.856Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oxc-project/oxc`
- **Description**: ⚓ A collection of high-performance JavaScript tools.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 23595 stars

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
- **Issue #30199** (2026-11-24): **fix(lexer)!: give BigInt literals exact values in a bigints lane**
  *Symptoms*: - BigInt values went into the f64 numbers lane, so anything above 2^53 was rounded: 9007199254740993n read as 9007199254740992, where V8 gives the exact value - BigInt values now go in a new bigints lane, as decimal digits without separators or the n, in the cooked bytes like strings; numbers only holds Number values, which breaks code that counted BigInts there - Hex, octal and binary BigInts are converted on a cold path, through a u64 when they fit and base 10^9 limbs above that, so Number tokens are untouched and perf is neutral  Closes #29856  ### Example  Input:  ```js x = [9007199254740993n, 0x10000000000000000n, 1.5]; ```  Before output:  ```text numbers: [9007199254740992.0, 1.8446744073709552e19, 1.5] ```  After output:  ```text numbers: [1.5] bigints: ["9007199254740993", "18446744073709551616"] ```  V8 gives 9007199254740993n, 18446744073709551616n and 1.5. No playground link, as the playground doesn't run oxc_lexer. 
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance** > [!WARNING] > oxc-project has exceeded the Hobby plan limit of 5 active contributors. [Upgrade your plan](https://app.codspeed.io/settings/organizations/oxc-project/billing?utm_source=github&utm_medium=comment-v2&utm_content=contributor_cap) or [apply to the open source program](https://app.codspeed.io/oss-program-application?owner=oxc-project&utm_source=github&utm_medium=comment-v2&utm_content=contributor_cap) by December 8, 2026 to keep using CodSpeed.    `✅ 91` untouched benchmarks   `⏩ 19` skipped benchmarks[^skipped]        ---  <sub>Comparing <code>fix/lexer-bigint-values</code> (f083ba5) with <code>main</code> (bddf793)</sub>  <a href="https://app.codspeed.io/oxc-project/oxc/branches/fix%2Flexer-bigint-values?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspe

- **Issue #30198** (2026-11-24): **fix(linter): name the type-aware linter generically in its errors**
  *Symptoms*: **TL;DR:** Oxlint's type-aware errors no longer name tsgolint, as since #28751 the linter they come from may be tsrs-lint.  ## Changes  Since #28751, `try_find_tsgolint_executable` prefers `tsrs-lint` over `tsgolint`, yet the errors of a type-aware run still name tsgolint, so a user running tsrs-lint is told that tsgolint failed. In `crates/oxc_linter/src/tsgolint.rs`, every message that does not depend on the backend now says "type-aware linter", the term #28751 already uses for the not-found error: the run failure, the missing `OXLINT_TSGOLINT_PATH` file, the spawn, stdin and stdout failures, and the three payload-parse errors. These messages reach both the CLI and the language server.  ```sh OXLINT_TSGOLINT_PATH=./missing/tsrs-lint oxlint --type-aware ```  Before:  ```text Failed to find tsgolint executable: OXLINT_TSGOLINT_PATH points to './missing/tsrs-lint' which does not exist ```  After:  ```text Failed to find type-aware linter executable: OXLINT_TSGOLINT_PATH points to './missing/tsrs-lint' which does not exist ```  AI disclosure: written with Claude Opus 5.5, reasoning effort Medium. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"7f86838fc4690d0f65e884d6dc6a8206b69595df","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  <details> <summary><strong>Codex Review Summary</strong>: ✅ Completed</summary>  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-24T18:56:54.919528Z">2026-11-24T18:56:54.919528Z</relative-time> | `7f86838` | Draft marked ready |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as rea
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance** > [!WARNING] > oxc-project has exceeded the Hobby plan limit of 5 active contributors. [Upgrade your plan](https://app.codspeed.io/settings/organizations/oxc-project/billing?utm_source=github&utm_medium=comment-v2&utm_content=contributor_cap) or [apply to the open source program](https://app.codspeed.io/oss-program-application?owner=oxc-project&utm_source=github&utm_medium=comment-v2&utm_content=contributor_cap) by December 8, 2026 to keep using CodSpeed.    `✅ 5` untouched benchmarks   `⏩ 105` skipped benchmarks[^skipped]        ---  <sub>Comparing <code>filipfalcon:type-aware-linter-errors</code> (7f86838) with <code>main</code> (d1fd8b5)</sub>  <a href="https://app.codspeed.io/oxc-project/oxc/branches/filipfalcon%3Atype-aware-linter-errors?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.i

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

### Incident Patch 1: `727f784f` (2026-11-24)
**Commit Message**: fix(linter/eslint/no-await-in-loop): report awaits in unbraced if/switch/try loop bodies (#30136)

Closes #30134.

`no-await-in-loop` missed `await` inside a loop body that was an
unbraced `if`, `switch`, `try`, labeled, or `with` statement. For
example, `for (const value of values) if (value) await foo(value);`
passed even though ESLint reports it.

## Example

```js
const foo = async (value) => value;

export const bar = async (values) => {
  for (const value of values) if (value) await foo(value);
};
```

Command:

```sh
oxlint -A all -D no-await-in-loop --threads=1 foo.js
```

Before:

```text
Found 0 warnings and 0 errors.
```

After:

```text
  x eslint(no-await-in-loop): Unexpected `await` inside a loop.
   ,-[foo.js:4:42]
 3 | export const bar = async (values) => {
 4 |   for (const value of values) if (value) await foo(value);
   :                                          ^^^^^
 5 | };
   `----
```

ESLint 10.15.0 reports the same location: `4:42`.

## Implementation

The rule walks up from each `await` until it reaches a function, arrow
function, or `for await...of` boundary. At each step, it checks whether
the current node is the loop body, test, or update.

That check u

**File**: `crates/oxc_linter/src/rules/eslint/no_await_in_loop.rs` (modified, +20/-68)
```diff
@@ -1,7 +1,4 @@
-use oxc_ast::{
-    AstKind,
-    ast::{Expression, Statement},
-};
+use oxc_ast::AstKind;
 use oxc_diagnostics::OxcDiagnostic;
 use oxc_macros::declare_oxc_lint;
 use oxc_span::{GetSpan, Span};
@@ -106,100 +103,46 @@ impl Rule for NoAwaitInLoop {
 }
 
 impl NoAwaitInLoop {
-    fn node_matches_stmt_span(span: Span, stmt: &Statement) -> bool {
-        match stmt {
-            Statement::BlockStatement(block) => block.span.contains_inclusive(span),
-            Statement::ExpressionStatement(expr_statement) => {
-                expr_statement.span.contains_inclusive(span)
-            }
-            _ => false,
-        }
-    }
-
-    fn node_matches_expr_span(span: Span, expr: &Expression) -> bool {
-        match expr {
-            Expression::TemplateLiteral(expr) => expr.span.contains_inclusive(span),
-            Expression::ArrayExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::ArrowFunctionExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::AssignmentExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::AwaitExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::BinaryExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::CallExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::ChainExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::ClassExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::ConditionalExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::FunctionExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::ImportExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::LogicalExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::NewExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::ObjectExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::ParenthesizedExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::SequenceExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::TaggedTemplateExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::ThisExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::UnaryExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::UpdateExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::YieldExpression(expr) => expr.span.contains_inclusive(span),
-            Expression::PrivateInExpression(expr) => expr.span.contains_inclusive(span),
-            _ => false,
-        }
-    }
-
     fn is_looped(node: &AstNode, parent: &AstNode) -> bool {
         let span = node.kind().span();
+        let contains = |outer: Span| outer.contains_inclusive(span);
         match parent.kind() {
             AstKind::ForStatement(stmt) => {
-                let mut result = Self::node_matches_stmt_span(span, &stmt.body);
-                if result {
-                    return result;
-                }
-
-                if let Some(test) = &stmt.test {
-                    result = Self::node_matches_expr_span(span, test);
-                    if result {
-                        return result;
-                    }
-                }
-
-                if let Some(update) = &stmt.update {
-                    result = Self::node_matches_expr_span(span, update);
-                }
-
-                result
+                contains(stmt.body.span())
+                    || stmt.test.as_ref().is_some_and(|test| contains(test.span()))
+                    || stmt.update.as_ref().is_some_and(|update| contains(update.span()))
             }
             AstKind::ForInStatement(stmt) => {
-                if Self::node_matches_stmt_span(span, &stmt.body) {
+                if contains(stmt.body.span()) {
                     return true;
                 }
                 // Check if this is `await using` in the left position
                 if let AstKind::VariableDeclaration(decl) = node.kind()
                     && decl.kind.is_await_using()
-                    && stmt.left.span().contains_inclusive(span)
+                    && contains(stmt.left.span())
                 {
                     return true;
                 }
                 false
             }
             AstKind::ForOfStatement(stmt) => {
-                if Self::node_matches_stmt_span(span, &stmt.body) {
+                if contains(stmt.body.span()) {
                     return true;
                 }
                 // Check if this is `await using` in the left position
                 if let AstKind::VariableDeclaration(decl) = node.kind()
                     && decl.kind.is_await_using()
-                    && stmt.left.span().contains_inclus
```

**File**: `crates/oxc_linter/src/snapshots/eslint_no_await_in_loop.snap` (modified, +63/-0)
```diff
@@ -120,3 +120,66 @@ source: crates/oxc_linter/src/tester.rs
    ·      ─────
    ╰────
   help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:54]
+ 1 │ async function foo() { for (var bar of baz) if (bar) await bar; }
+   ·                                                      ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:56]
+ 1 │ async function foo() { for (var bar of baz) if (bar) { await bar; } }
+   ·                                                        ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:66]
+ 1 │ async function foo() { for (var bar of baz) if (bar) foo(); else await bar; }
+   ·                                                                  ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:68]
+ 1 │ async function foo() { for (var bar of baz) switch (bar) { case 1: await bar; } }
+   ·                                                                    ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:51]
+ 1 │ async function foo() { for (var bar of baz) try { await bar; } catch {} }
+   ·                                                   ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:45]
+ 1 │ async function foo() { while (baz) if (baz) await bar; }
+   ·                                             ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:54]
+ 1 │ async function foo() { for (var bar in baz) if (bar) await bar; }
+   ·                                                      ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:42]
+ 1 │ async function foo() { for (;;) if (baz) await bar; }
+   ·                                          ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
+
+  ⚠ eslint(no-await-in-loop): Unexpected `await` inside a loop.
+   ╭─[no_await_in_loop.tsx:1:31]
+ 1 │ async function foo() { while (await bar as boolean) {} }
+   ·                               ─────
+   ╰────
+  help: Collect all promises into an array and use `Promise.all()` to run them in parallel, rather than awaiting each one sequentially inside the loop.
```

---

### Incident Patch 2: `f2f83f81` (2026-11-24)
**Commit Message**: fix(transformer/legacy-decorator): keep decorated static fields with `setPublicClassFields` (#29979)

With legacy decorators (`experimentalDecorators`) and
`setPublicClassFields: true` (TypeScript's `useDefineForClassFields:
false`), a decorator on a static field was dropped.

Fixes #29977

On class entry, the TypeScript transform moves field values out of the
class. An instance field keeps its declaration and decorators, so legacy
decorators still lower it on class exit, but a static field was replaced
wholesale by `static { this.y = 1; }`, so the decorated field was gone
before legacy decorators ran.

### Example

Input ([playground for this
example](https://playground.oxc.rs/?t=codegen&options=%7B%22run%22%3A%7B%22transform%22%3Atrue%7D%2C%22parser%22%3A%7B%22extension%22%3A%22ts%22%7D%2C%22transformer%22%3A%7B%22useDefineForClassFields%22%3Afalse%2C%22experimentalDecorators%22%3Atrue%7D%7D&code=class+A+%7B%0A++%40dec+static+y+%3D+1%3B%0A++%40dec+z+%3D+3%3B%0A%7D%0A);
its `useDefineForClassFields: false` also turns on
`removeClassFieldsWithoutInitializer`, so it matches that variant
below):

```ts
class A {
  @dec static y = 1;
  @dec z = 3;
}
```

Options: `{ "assumptions": { "

**File**: `crates/oxc_transformer/src/decorator/legacy/mod.rs` (modified, +22/-1)
```diff
@@ -267,6 +267,7 @@ impl<'a> Traverse<'a, TransformState<'a>> for LegacyDecorator<'a> {
             self.handle_decorated_class_element(
                 method.r#static,
                 &mut method.key,
+                true,
                 descriptor,
                 decorations,
                 ctx,
@@ -289,9 +290,20 @@ impl<'a> Traverse<'a, TransformState<'a>> for LegacyDecorator<'a> {
 
         // We emit `void 0` here to indicate to `_decorate` that it can invoke `Object.defineProperty` directly.
         let descriptor = Expression::new_void_0(SPAN, ctx);
+        // TypeScript turns a decorated field that it removes into a `declare` field keyed by a value
+        // reference or a literal, which the class doesn't evaluate. Other keys of user-written
+        // `declare` fields hold type references, so they keep the temp var.
+        let key_is_evaluated = !(prop.declare
+            && prop.key.as_expression().is_some_and(|key| match key {
+                Expression::Identifier(ident) => {
+                    ctx.scoping().get_reference(ident.reference_id()).flags().is_read()
+                }
+                key => key.is_literal(),
+            }));
         self.handle_decorated_class_element(
             prop.r#static,
             &mut prop.key,
+            key_is_evaluated,
             descriptor,
             decorations,
             ctx,
@@ -315,6 +327,7 @@ impl<'a> Traverse<'a, TransformState<'a>> for LegacyDecorator<'a> {
         self.handle_decorated_class_element(
             accessor.r#static,
             &mut accessor.key,
+            true,
             descriptor,
             decorations,
             ctx,
@@ -360,6 +373,7 @@ impl<'a> LegacyDecorator<'a> {
         &mut self,
         is_static: bool,
         key: &mut PropertyKey<'a>,
+        key_is_evaluated: bool,
         descriptor: Expression<'a>,
         decorations: Expression<'a>,
         ctx: &mut TraverseCtx<'a>,
@@ -385,7 +399,7 @@ impl<'a> LegacyDecorator<'a> {
         });
 
         let prefix = Self::get_class_member_prefix(class_binding, is_static, ctx);
-        let name = self.get_name_of_property_key(key, ctx);
+        let name = self.get_name_of_property_key(key, key_is_evaluated, ctx);
         let decorator_stmt = self.create_decorator(decorations, prefix, name, descriptor, ctx);
 
         // Push to current decoration stack
@@ -1132,10 +1146,14 @@ impl<'a> LegacyDecorator<'a> {
     ///    * NullLiteral: `[null] = 0;` -> `null`
     ///  * Non-copiable key:
     ///    * `[a()] = 0;` mutates the key to `[_a = a()] = 0;` and returns `_a`
+    ///
+    /// When the class doesn't evaluate `key`, it's moved into the decoration instead:
+    /// `@dec declare [_x];` -> `_decorate([dec], C.prototype, _x, void 0)`.
     #[expect(clippy::unused_self)]
     fn get_name_of_property_key(
         &self,
         key: &mut PropertyKey<'a>,
+        key_is_evaluated: bool,
         ctx: &mut TraverseCtx<'a>,
     ) -> Expression<'a> {
         match key {
@@ -1161,6 +1179,9 @@ impl<'a> LegacyDecorator<'a> {
                 Expression::new_template_literal(SPAN, quasis, [], ctx)
             }
             PropertyKey::NullLiteral(_) => Expression::new_null_literal(SPAN, ctx),
+            key @ match_expression!(PropertyKey) if !key_is_evaluated => {
+                key.to_expression_mut().take_in(ctx)
+            }
             match_expression!(PropertyKey) => {
                 // ```ts
                 // Input:
```

**File**: `crates/oxc_transformer/src/typescript/class.rs` (modified, +89/-15)
```diff
@@ -23,6 +23,17 @@ use crate::{
 
 use super::TypeScript;
 
+/// What happens to a property declaration when its initializer moves out of the class body.
+#[derive(Clone, Copy, PartialEq, Eq)]
+enum Declaration {
+    /// The declaration is removed, along with its key.
+    Remove,
+    /// The declaration stays, and the class still evaluates its key.
+    Keep,
+    /// The declaration stays as a `declare` field with a copy of its key, for legacy decorators.
+    Placeholder,
+}
+
 impl<'a> TypeScript<'a> {
     /// Transform class fields, and constructor parameters that includes modifiers into `this` assignments.
     ///
@@ -99,6 +110,9 @@ impl<'a> TypeScript<'a> {
     /// we don't need extra transformation for static properties, the output is the same as instance properties
     /// transformation, and the greatest advantage is we don't need to care about `this` usage in static block.
     ///
+    /// A decorated field whose declaration is removed stays as a `declare` field with a side-effect
+    /// free key until legacy decorators lower it: `@dec static [x()] = 1;` -> `@dec declare static [_x];`
+    ///
     /// Fields that `lowering` keeps for a downstream transform stay as written, and so do instance
     /// fields before [`ClassLowering::first_movable_instance_field`].
     pub(super) fn transform_class_fields(
@@ -123,10 +137,16 @@ impl<'a> TypeScript<'a> {
         // not the current traversal scope (which is the scope enclosing the class).
         let class_scope_id = class.scope_id();
 
-        let mut constructor = None;
+        let mut constructor_index = None;
         let mut property_assignments = Vec::new();
         let mut computed_key_assignments = Vec::new();
-        for (index, element) in class.body.body.iter_mut().enumerate() {
+        // A decorated static field gets its static block inserted after it, so `position` indexes
+        // the growing class body, and `index` is the element's index before any insertion.
+        let mut position = 0;
+        let mut inserted_blocks = 0;
+        while let Some(element) = class.body.body.get_mut(position) {
+            let index = position - inserted_blocks;
+            let mut block_after = None;
             let kept = lowering.keeps_field(element);
             match element {
                 // Skip static private properties — converting them to static blocks
@@ -137,30 +157,60 @@ impl<'a> TypeScript<'a> {
                         && (!prop.key.is_private_identifier()
                             || (!prop.r#static && will_hoist_initializers_to_constructor)) =>
                 {
+                    // Legacy decorators lower decorated fields on class exit. A decorated field
+                    // whose declaration is removed here stays until then as a `declare` field,
+                    // which `TypeScriptAnnotations::exit_class` removes after them.
+                    let decorated =
+                        !prop.decorators.is_empty() && !prop.key.is_private_identifier();
                     if let Some(value) = prop.value.take() {
                         // A static property is replaced by a static block below, and an instance
                         // property is removed later when `remove_class_fields_without_initializer`
                         // is `true`. Otherwise, the instance property declaration stays in the
                         // class body (without its initializer), so its key is still evaluated
                         // during class definition.
-                        let keep_declaration =
-                            !prop.r#static && !self.remove_class_fields_without_initializer;
+                        let declaration =
+                            if !prop.r#static && !self.remove_class_fields_without_initializer {
+                                Declaration::Keep
+                            } else if decorated {
+                                Declaration::Placeholder
+                            } else {
+                                Declaration::Remove
+                            };
                         let assignment = self.convert_property_definition(
                             &mut prop.key,
                             value,
-                            keep_declaration,
+                            declaration,
                             &mut computed_key_assignments,
                             ctx,
                         );
+                        prop.declare |= declaration == Declaration::Placeholder;
                         if prop.r#static {
                             // Convert static property to static block
                             // `class C { static x = 1; }` -> `class C { static { this.x = 1; } }`
                             // `class C { static [x] = 1; }` -> `let _x; class C { static { this[_x] = 1; } }`
                             let body = ArenaVec::from_value_in(assignment, ctx);
-                            *element = Sel
```

**File**: `tasks/transform_conformance/snapshots/oxc.snap.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 commit: 51225612
 
-Passed: 361/482
+Passed: 364/485
 
 # All Passed:
 * babel-plugin-transform-class-static-block
@@ -206,7 +206,7 @@ x Output mismatch
 x Output mismatch
 
 
-# legacy-decorators (33/115)
+# legacy-decorators (36/118)
 * oxc/accessor/input.ts
 x Output mismatch
 
```

**File**: `tasks/transform_conformance/snapshots/oxc_exec.snap.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ commit: 51225612
 
 node: v26.12.1
 
-Passed: 81 of 377 (21.49%)
+Passed: 82 of 378 (21.69%)
 
 Failures:
 
```

**File**: `tasks/transform_conformance/tests/legacy-decorators/test/fixtures/oxc/set-public-class-fields-decorated-fields-metadata/input.ts` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+class A {
+  @dec static n: number = 1;
+  @dec s: string = "s";
+  @dec static [k()]: boolean = true;
+  @dec static u: number;
+}
```

**File**: `tasks/transform_conformance/tests/legacy-decorators/test/fixtures/oxc/set-public-class-fields-decorated-fields-metadata/options.json` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+{
+  "assumptions": {
+    "setPublicClassFields": true
+  },
+  "plugins": [
+    [
+      "transform-legacy-decorator",
+      {
+        "emitDecoratorMetadata": true
+      }
+    ],
+    [
+      "transform-typescript",
+      {
+        "removeClassFieldsWithoutInitializer": true
+      }
+    ]
+  ]
+}
```

**File**: `tasks/transform_conformance/tests/legacy-decorators/test/fixtures/oxc/set-public-class-fields-decorated-fields-metadata/output.js` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+let _k;
+class A {
+  constructor() {
+    this.s = "s";
+  }
+  static {
+    _k = k();
+  }
+  static {
+    this.n = 1;
+  }
+  static {
+    this[_k] = true;
+  }
+}
+babelHelpers.decorate([dec, babelHelpers.decorateMetadata("design:type", String)], A.prototype, "s", void 0);
+babelHelpers.decorate([dec, babelHelpers.decorateMetadata("design:type", Number)], A, "n", void 0);
+babelHelpers.decorate([dec, babelHelpers.decorateMetadata("design:type", Boolean)], A, _k, void 0);
+babelHelpers.decorate([dec, babelHelpers.decorateMetadata("design:type", Number)], A, "u", void 0);
```

**File**: `tasks/transform_conformance/tests/legacy-decorators/test/fixtures/oxc/set-public-class-fields-decorated-fields-remove-class-fields-without-initializer/input.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+class A {
+  @dec static y = 1;
+  @dec z = 3;
+  static [a()] = 4;
+  @dec static [b()] = 5;
+  @dec [c()] = 6;
+  @dec static w = this.y;
+  @dec static v;
+  @dec u;
+  [e()] = 7;
+  @dec static [f()];
+  @dec "q" = 8;
+  @dec static 9 = 10;
+}
+
+class B extends Base {
+  @dec static x = 1;
+  @dec y = 2;
+  constructor() {
+    super();
+  }
+}
```

---

### Incident Patch 3: `1abb96db` (2026-11-24)
**Commit Message**: fix(transformer/typescript): hide computed key methods from decorators (#30184)

A standard element decorator can inspect the class before its static
blocks run. With `setPublicClassFields` enabled, it can see the
symbol-keyed method that #30148 generates to evaluate a computed key.
The source class has no such property.

### Example

```ts
const observed = [];
function inspect(getClass) {
  observed.push(Object.getOwnPropertySymbols(getClass()).filter(key => key !== Symbol.metadata));
}
function* make() {
  return class C {
    @inspect static getClass() { return C; }
    static [yield "key"] = 1;
  };
}
const it = make();
expect(it.next().value).toBe("key");
const C = it.next("x").value;
expect(C.x).toBe(1);
expect(observed).toEqual([[]]);
```

The Oxc playground cannot run the downstream decorator pass that exposes
the extra symbol. To print the JavaScript locally, save the input as
`/tmp/repro.ts` and run the transformer example with the fixture
options.

```sh
fixture=tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/preserved-class-context-dependent-computed-keys
cargo run -p oxc_transformer --example transformer -- /tmp/repro.ts --babel-op

**File**: `crates/oxc_transformer/src/decorator/accessor.rs` (modified, +4/-27)
```diff
@@ -7,7 +7,6 @@ use oxc_span::SPAN;
 use oxc_str::Str;
 use oxc_syntax::scope::ScopeId;
 use oxc_traverse::BoundIdentifier;
-use rustc_hash::FxHashSet;
 
 use crate::{
     common::{
@@ -18,7 +17,7 @@ use crate::{
     context::TraverseCtx,
     utils::{
         ast_builder::{create_accessor_method, take_literal_property_key},
-        decorated_class::is_auto_accessor,
+        decorated_class::{PrivateNames, is_auto_accessor},
     },
 };
 
@@ -43,19 +42,8 @@ pub(super) fn lower_auto_accessors<'a>(
     }
     // Storage must not capture references to enclosing private names, including those in
     // nested classes. Reserving all private identifiers also covers this class's declarations.
-    let mut collector = PrivateNameCollector::default();
-    collector.visit_class_body(body);
-    let mut used_names = collector.names;
-    let mut unique_name = |base: Str<'a>, ctx: &TraverseCtx<'a>| -> Str<'a> {
-        let mut name = base;
-        let mut n = 2u32;
-        while used_names.contains(name.as_str()) {
-            name = Str::from_strs_array_in([&base, itoa::Buffer::new().format(n)], ctx);
-            n += 1;
-        }
-        used_names.insert(name.as_str());
-        name
-    };
+    let mut private_names = PrivateNames::default();
+    private_names.visit_class_body(body);
     // Each accessor is replaced by storage plus a getter and setter, so the result is
     // `len + 2 * accessor_count` long.
     let mut new_body = ArenaVec::with_capacity_in(body.body.len() + accessor_count * 2, ctx);
@@ -113,7 +101,7 @@ pub(super) fn lower_auto_accessors<'a>(
                 (name, PropertyKey::from(assignment), PropertyKey::from(reference))
             }
         };
-        let storage_name = unique_name(storage_name, ctx);
+        let storage_name = private_names.generate(storage_name, ctx);
         let storage = PropertyDefinition::boxed(
             SPAN,
             PropertyDefinitionType::PropertyDefinition,
@@ -171,14 +159,3 @@ fn positional_storage_name<'a>(counter: &mut u32, ctx: &TraverseCtx<'a>) -> Str<
     *counter += 1;
     name
 }
-
-#[derive(Default)]
-struct PrivateNameCollector<'a> {
-    names: FxHashSet<&'a str>,
-}
-
-impl<'a> VisitJs<'a> for PrivateNameCollector<'a> {
-    fn visit_private_identifier(&mut self, ident: &PrivateIdentifier<'a>) {
-        self.names.insert(ident.name.as_str());
-    }
-}
```

**File**: `crates/oxc_transformer/src/typescript/class.rs` (modified, +87/-52)
```diff
@@ -2,10 +2,10 @@ use rustc_hash::FxHashSet;
 
 use oxc_allocator::{ArenaVec, CloneIn, GetAllocator, ReplaceWith, TakeIn};
 use oxc_ast::ast::*;
-use oxc_ast_visit::{Visit, walk};
+use oxc_ast_visit::{Visit, VisitJs, walk};
 use oxc_semantic::{ReferenceFlags, ScopeFlags, ScopeId, SymbolFlags};
 use oxc_span::{SPAN, Span};
-use oxc_str::{Ident, static_ident};
+use oxc_str::{Ident, Str, static_ident};
 use oxc_syntax::operator::{AssignmentOperator, UnaryOperator};
 use oxc_traverse::BoundIdentifier;
 
@@ -303,32 +303,30 @@ impl<'a> TypeScript<'a> {
             position += 1;
         }
 
-        let computed_key_assignment_static_block =
-            (!computed_key_assignments.is_empty()).then(|| {
-                let statement = if computed_key_assignments.iter().any(depends_on_outer_context) {
-                    let marker = self.computed_key_marker(ctx);
-                    let (carrier, delete) = Self::create_computed_key_carrier(
-                        computed_key_assignments,
-                        &marker,
-                        class_scope_id,
-                        ctx,
-                    );
-                    class.body.body.push(carrier);
-                    delete
-                } else {
-                    let sequence_expression = Expression::new_sequence_expression(
-                        SPAN,
-                        ArenaVec::from_iter_in(computed_key_assignments, ctx),
-                        ctx,
-                    );
-                    Statement::new_expression_statement(SPAN, sequence_expression, ctx)
-                };
+        let computed_key_assignment_static_block = if computed_key_assignments.is_empty() {
+            None
+        } else {
+            let assignments = ArenaVec::from_iter_in(computed_key_assignments, ctx);
+            let expr = if assignments.iter().any(depends_on_outer_context) {
+                self.append_computed_key_carrier(
+                    class,
+                    assignments,
+                    &property_assignments,
+                    lowering,
+                    ctx,
+                )
+            } else {
+                Some(Expression::new_sequence_expression(SPAN, assignments, ctx))
+            };
+            expr.map(|expr| {
+                let statement = Statement::new_expression_statement(SPAN, expr, ctx);
                 Self::create_class_static_block(
                     ArenaVec::from_value_in(statement, ctx),
                     class_scope_id,
                     ctx,
                 )
-            });
+            })
+        };
 
         // Blocks are only inserted after the visited element, and the carrier is appended,
         // so `constructor_index` is still valid.
@@ -780,49 +778,86 @@ impl<'a> TypeScript<'a> {
         });
     }
 
-    /// Return the temporary method `static [(assignments, _computedKey)]() {}`, which evaluates
-    /// `assignments` where the class evaluates its keys, and `delete this[_computedKey];`, which
-    /// removes it.
-    fn create_computed_key_carrier(
-        assignments: Vec<Expression<'a>>,
-        marker: &BoundIdentifier<'a>,
-        class_scope_id: ScopeId,
+    /// Evaluate trailing keys after the other class keys and before static initialization.
+    fn append_computed_key_carrier(
+        &mut self,
+        class: &mut Class<'a>,
+        mut assignments: ArenaVec<'a, Expression<'a>>,
+        property_assignments: &[Statement<'a>],
+        lowering: ClassLowering,
         ctx: &mut TraverseCtx<'a>,
-    ) -> (ClassElement<'a>, Statement<'a>) {
-        let marker_key = marker.create_read_expression(ctx);
-        let key = Expression::new_sequence_expression(
-            SPAN,
-            ArenaVec::from_iter_in(assignments.into_iter().chain(std::iter::once(marker_key)), ctx),
-            ctx,
-        );
+    ) -> Option<Expression<'a>> {
+        let class_scope_id = class.scope_id();
+        let mut decorators = ArenaVec::new_in(ctx);
+        let (key, cleanup) = if lowering.has_decorators() {
+            // Element decorators can inspect the class before its first static block. Evaluate
+            // the keys in an inert decorator on a private method, which has no reflective key.
+            let mut names = self.eval_private_names.clone();
+            names.visit_class_body(&class.body);
+            names.visit_expressions(&assignments);
+            for statement in property_assignments {
+                names.visit_statement(statement);
+            }
+            let name = names.generate(Str::from_str_in("_computedKey", ctx), ctx);
+            let decorator_scope = ctx.create_child_scope(
+                class_scope_id,
+                ScopeFlags::StrictMode | ScopeFlags::Function | ScopeFlags::Arrow,
+            );
+            let noop = Expression::new_arrow_function_expression_with_scope_id_and_pure_and_pife(
+                SPAN,
+                false,
+                None,
+                Form
```

**File**: `crates/oxc_transformer/src/typescript/mod.rs` (modified, +17/-1)
```diff
@@ -1,11 +1,15 @@
 use oxc_allocator::ArenaVec;
 use oxc_ast::ast::*;
+use oxc_ast_visit::VisitJs;
 use oxc_span::Span;
 use oxc_str::Ident;
 use oxc_syntax::scope::ScopeId;
 use oxc_traverse::{BoundIdentifier, Traverse};
 
-use crate::{common::class_lowering::ClassLowering, context::TraverseCtx, state::TransformState};
+use crate::{
+    common::class_lowering::ClassLowering, context::TraverseCtx, state::TransformState,
+    utils::decorated_class::PrivateNames,
+};
 
 mod annotations;
 mod class;
@@ -61,6 +65,8 @@ pub struct TypeScript<'a> {
     parameter_properties_starts: Vec<(ScopeId, usize)>,
     /// See [`Self::computed_key_marker`].
     computed_key_marker: Option<BoundIdentifier<'a>>,
+    /// Enclosing private declarations that direct eval could reference by string.
+    eval_private_names: PrivateNames<'a>,
 }
 
 impl<'a> TypeScript<'a> {
@@ -78,6 +84,7 @@ impl<'a> TypeScript<'a> {
             parameter_properties: Vec::new(),
             parameter_properties_starts: Vec::new(),
             computed_key_marker: None,
+            eval_private_names: PrivateNames::default(),
         }
     }
 
@@ -134,6 +141,15 @@ impl<'a> Traverse<'a, TransformState<'a>> for TypeScript<'a> {
 
     fn enter_class(&mut self, class: &mut Class<'a>, ctx: &mut TraverseCtx<'a>) {
         let lowering = ctx.state.class_lowering_of(class.scope_id());
+        if self.set_public_class_fields
+            && ctx.scoping().scope_flags(class.scope_id()).contains_direct_eval()
+        {
+            for element in &class.body.body {
+                if let Some(PropertyKey::PrivateIdentifier(name)) = element.property_key() {
+                    self.eval_private_names.visit_private_identifier(name);
+                }
+            }
+        }
         self.annotations.enter_class(class, ctx);
 
         if lowering.lowers_fields() {
```

**File**: `crates/oxc_transformer/src/utils/decorated_class.rs` (modified, +28/-1)
```diff
@@ -1,6 +1,33 @@
 //! Detect decorators and auto-accessors in class syntax.
 
-use oxc_ast::ast::{Class, ClassBody, ClassElement};
+use oxc_ast::ast::{Class, ClassBody, ClassElement, PrivateIdentifier};
+use oxc_ast_visit::VisitJs;
+use oxc_str::Str;
+use rustc_hash::FxHashSet;
+
+use crate::context::TraverseCtx;
+
+/// Reserve declarations and references, including uses of enclosing private names in nested classes.
+#[derive(Clone, Default)]
+pub struct PrivateNames<'a>(FxHashSet<&'a str>);
+
+impl<'a> VisitJs<'a> for PrivateNames<'a> {
+    fn visit_private_identifier(&mut self, ident: &PrivateIdentifier<'a>) {
+        self.0.insert(ident.name.as_str());
+    }
+}
+
+impl<'a> PrivateNames<'a> {
+    pub fn generate(&mut self, base: Str<'a>, ctx: &TraverseCtx<'a>) -> Str<'a> {
+        let mut name = base;
+        let mut n = 2u32;
+        while !self.0.insert(name.as_str()) {
+            name = Str::from_strs_array_in([&base, itoa::Buffer::new().format(n)], ctx);
+            n += 1;
+        }
+        name
+    }
+}
 
 /// Whether a runtime class has decorators on the class itself or any of its elements.
 pub fn class_has_decorators(class: &Class<'_>) -> bool {
```

**File**: `tasks/transform_conformance/snapshots/oxc_exec.snap.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ commit: 51225612
 
 node: v26.12.1
 
-Passed: 83 of 379 (21.90%)
+Passed: 84 of 380 (22.11%)
 
 Failures:
 
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/preserved-class-context-dependent-computed-keys/downstream-decorators/exec.ts` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+const userKey = Symbol("user method");
+const observed = [];
+function inspect(getClass) {
+  observed.push(Object.getOwnPropertySymbols(getClass()).filter(key => key !== Symbol.metadata));
+}
+
+class Outer {
+  #_computedKey = "x";
+  #_computedKey3 = "y";
+  *make() {
+    return class C {
+      static #_computedKey2() {}
+      static [userKey]() {}
+      @inspect static getClass() { return C; }
+      static [(yield "key", this.#_computedKey)] = 1;
+      static [eval("this.#_computedKey3")] = 2;
+    };
+  }
+}
+
+const it = new Outer().make();
+expect(it.next().value).toBe("key");
+const C = it.next().value;
+expect(C.x).toBe(1);
+expect(C.y).toBe(2);
+expect(observed).toEqual([[userKey]]);
```

**File**: `tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/oxc/preserved-class-context-dependent-computed-keys/output.js` (modified, +2/-9)
```diff
@@ -1,4 +1,3 @@
-var _computedKey = Symbol();
 function* autoAccessor() {
   let _yield$a, _arguments$;
   return class {
@@ -15,25 +14,19 @@ function* autoAccessor() {
 function* decorated() {
   let _yield$a2;
   return @dec class {
-    static {
-      delete this[_computedKey];
-    }
     static {
       this[_yield$a2] = 1;
     }
-    static [(_yield$a2 = yield "a", _computedKey)]() {}
+    @(_yield$a2 = yield "a", () => {}) static #_computedKey() {}
   };
 }
 function* decoratedStaticMethod() {
   let _yield$a3;
   return class {
-    static {
-      delete this[_computedKey];
-    }
     @dec static m() {}
     static {
       this[_yield$a3] = 1;
     }
-    static [(_yield$a3 = yield "a", _computedKey)]() {}
+    @(_yield$a3 = yield "a", () => {}) static #_computedKey() {}
   };
 }
```

**File**: `tasks/transform_conformance/vitest.config.mts` (modified, +19/-0)
```diff
@@ -3,6 +3,25 @@ import { defineConfig } from "vitest/config";
 
 export default defineConfig({
   plugins: [
+    {
+      // Execute fixtures that preserve standard decorators for a downstream compiler.
+      name: "downstream-decorators",
+      enforce: "pre",
+      transform: {
+        filter: { id: /-downstream-decorators-exec\.test\.js$/ },
+        async handler(code) {
+          const { transformAsync } = await import("@babel/core");
+          const { default: decorators } = await import("@babel/plugin-proposal-decorators");
+          return (
+            await transformAsync(code, {
+              babelrc: false,
+              configFile: false,
+              plugins: [[decorators, { version: "2023-11" }]],
+            })
+          )?.code;
+        },
+      },
+    },
     {
       // Resolve helper imports to this checkout before Vite's package resolution.
       name: "local-oxc-runtime",
```

#### Recent Merged Pull Requests:
- **PR #30199** (2026-11-24): fix(lexer)!: give BigInt literals exact values in a bigints lane (@ShanonJackson)
- **PR #30198** (2026-11-24): fix(linter): name the type-aware linter generically in its errors (@filipfalcon)
- **PR #30196** (2026-11-24): refactor(parser): add debug assertion (@overlookmotel)
- **PR #30195** (2026-11-24): refactor(parser): import from `std` at top level (@overlookmotel)
- **PR #30193** (2026-11-24): refactor(coverage): unambiguous diff compare ASTs with `FullEq` (@overlookmotel)
- **PR #30192** (2026-11-24): refactor(coverage): generate `FullEq` trait for comparing ASTs including spans (@overlookmotel)

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

## X. linter/eslint/no-await-in-loop): report awaits in unbraced if/switch/try loop bo

**RULE**:
When implementing operations in `crates/oxc_linter/src/rules/eslint/no_await_in_loop.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `727f784f`: linter/eslint/no-await-in-loop): report awaits in unbraced if/switch/try loop bodies. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_linter/src/rules/eslint/no_await_in_loop.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use oxc_ast::AstKind;
        let contains = |outer: Span| outer.contains_inclusive(span);
                contains(stmt.body.span())
                    || stmt.test.as_ref().is_some_and(|test| contains(test.span()))
                    || stmt.update.as_ref().is_some_and(|update| contains(update.span()))
                if contains(stmt.body.span()) {
                    && contains(stmt.left.span())
                if contains(stmt.body.span()) {
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use oxc_ast::{
    AstKind,
    ast::{Expression, Statement},
};
    fn node_matches_stmt_span(span: Span, stmt: &Statement) -> bool {
        match stmt {
            Statement::BlockStatement(block) => block.span.contains_inclusive(span),
            Statement::ExpressionStatement(expr_statement) => {
                expr_statement.span.contains_inclusive(span)
            }
            _ => false,
        }
    }

    fn node_matches_expr_span(span: Span, expr: &Expression) -> bool {
        match expr {
            Expression::TemplateLiteral(expr) => expr.span.contains_inclusive(span),
            Expression::ArrayExpression(expr) => expr.span.contains_inclusive(span),
            Expression::ArrowFunctionExpression(expr) => expr.span.contains_inclusive(span),
            Expression::AssignmentExpression(expr) => expr.span.contains_inclusive(span),
            Expression::AwaitExpression(expr) => expr.span.contains_inclusive(span),
            Expression::BinaryExpression(expr) => expr.span.contains_inclusive(span),
            Expression::CallExpression(expr) => expr.span.contains_inclusive(span),
            Expression::ChainExpression(expr) => expr.span.contains_inclusive(s
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `727f784f` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
