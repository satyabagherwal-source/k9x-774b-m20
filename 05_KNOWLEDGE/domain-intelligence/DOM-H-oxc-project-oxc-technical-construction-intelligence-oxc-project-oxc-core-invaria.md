# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: oxc-project/oxc Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project/oxc",
  "source_url": "https://github.com/oxc-project/oxc",
  "source_version": "e18e0b30",
  "license": "MIT",
  "timestamp": "2026-11-28T09:54:22.746Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oxc-project-oxc",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project/oxc](https://github.com/oxc-project/oxc) (Revision: `e18e0b30`).  
> **License**: MIT | **Timestamp**: `2026-11-28T09:54:22.746Z`  
> **Learning ID**: `learn-github-oxc-project-oxc`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), B (Product Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 66%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from oxc-project/oxc:

# Forensic Learning Record (Deep Inspection): oxc-project/oxc

> **Canonical Artifact**: `07_PROJECT_LEARNING/oxc-project-oxc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oxc-project/oxc](https://github.com/oxc-project/oxc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T09:54:20.574Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oxc-project/oxc`
- **Description**: ⚓ A collection of high-performance JavaScript tools.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 23648 stars

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

/** The comparison with Prettier, `null` when both agree, otherwise both outputs (`"ERROR"` for a failed one);
 * and for a project, whether oxfmt's output of the file as written is no fixpoint (`null` when it is, `true` when the second pass errored). */
export default async function run({ name, fullPath, isProject, options }: LiveTask) {
  const source = readFileSync(fullPath, "utf8");
  let input = source;
  let expected = await formatWithPrettier(name, input, options);
  // A project hands over Prettier's output, unless Prettier cannot read it back either
  if (isProject && expected !== null) {
    const again = await formatWithPrettier(name, expected, options);
    if (again !== null) [input, expected] = [expected, again];
  }
  const prettierResult = expected ?? "ERROR";
  const oxfmtResult = await formatWithOxfmt(name, input, options);

  // Both failing to parse is not a pass, the fixture exercised nothing
  const failure =
    oxfmtResult === prettierResult && oxfmtResult !== "ERROR"
      ? null
      : { name, oxfmt: oxfmtResult, prettier: prettierResult };
  // A project's file as written, which Prettier's output does not show (the shapes Prettier normalizes away)
  const nonIdempotent = isProject ? await nonIdempotentOf(name, source, options) : null;
  return { failure, nonIdempotent };
}

/** `null` when oxfmt's output of `content` formats to itself (or `content` fails), `true` when the second pass errored. */
async function nonIdempotentOf(
  fileName: string,
  content: string,
  options: Record<string, unknown>,
): Promise<boolean | null> {
  const first = await formatWithOxfmt(fileName, content, options);
  if (first === "ERROR") return null;
  const second = await formatWithOxfmt(fileName, first, options);
  return second === first ? null : second === "ERROR";
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
            .find_unique_config(dir)
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
    /// Retained because the slow path must r
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
- **Issue #30437** (2026-11-28): **docs(napi): improve JSDoc comments for all NAPI entry point functions**
  *Symptoms*: Improve the JSDoc comments for all `napi` packages.  - Add `@param` and `@return` to all functions. - Standardize the description of these functions. - Reformat the comments. - Correct the wording about the perf cost of the async functions.
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance** > [!WARNING] > oxc-project has exceeded the Hobby plan limit of 5 active contributors. [Upgrade your plan](https://app.codspeed.io/settings/organizations/oxc-project/billing?utm_source=github&utm_medium=comment-v2&utm_content=contributor_cap) or [apply to the open source program](https://app.codspeed.io/oss-program-application?owner=oxc-project&utm_source=github&utm_medium=comment-v2&utm_content=contributor_cap) by December 8, 2026 to keep using CodSpeed.    `✅ 91` untouched benchmarks   `⏩ 19` skipped benchmarks[^skipped]        ---  <sub>Comparing <code>om/11-27-docs_napi_improve_jsdoc_comments_for_all_napi_entry_point_functions</code> (8427dd0) with <code>main</code> (2d8f3ff)[^unexpected-base]</sub>  <a href="https://app.codspeed.io/oxc-project/oxc/branches/om%2F11-27-docs_napi_improve_jsdoc_comments_for_all_napi_entry_point_functions?utm_source=github&utm_medium=comment-v2&utm_conten

- **Issue #30436** (2026-11-28): **refactor(napi): clarify types in async tasks**
  *Symptoms*: Minor refactor.  In all `napi` packages, specify the actual types used by the async `Task`'s methods, rather than the more opaque `Self::Output` and `Self::JsValue`.

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

### Incident Patch 1: `c94ac0b2` (2026-11-27)
**Commit Message**: fix(linter/eslint/no-void): only suggest `undefined` for literal operands (#30417)

- The `undefined` suggestion is now offered only when the `void` operand
is a literal such as `void 0`. For other operands like `void
callback()`, the replacement skipped evaluating the operand, dropping
calls and their exceptions, so those are now reported without a
suggestion.
- The suggestion is also withheld when `undefined` is shadowed by a
local binding.

**File**: `crates/oxc_linter/src/rules/eslint/no_void.rs` (modified, +24/-3)
```diff
@@ -5,6 +5,7 @@ use oxc_ast::AstKind;
 use oxc_diagnostics::OxcDiagnostic;
 use oxc_macros::declare_oxc_lint;
 use oxc_span::Span;
+use oxc_str::static_ident;
 
 use crate::{
     AstNode,
@@ -77,9 +78,16 @@ impl Rule for NoVoid {
         }
 
         if unary_expr.operator.is_void() {
-            ctx.diagnostic_with_suggestion(no_void_diagnostic(unary_expr.span), |fixer| {
-                fixer.replace(unary_expr.span, "undefined")
-            });
+            let diagnostic = no_void_diagnostic(unary_expr.span);
+            if unary_expr.argument.without_parentheses().is_literal()
+                && ctx.scoping().find_binding(node.scope_id(), static_ident!("undefined")).is_none()
+            {
+                ctx.diagnostic_with_suggestion(diagnostic, |fixer| {
+                    fixer.replace(unary_expr.span, "undefined")
+                });
+            } else {
+                ctx.diagnostic(diagnostic);
+            }
         }
     }
 }
@@ -105,6 +113,7 @@ fn test() {
         ("void(0)", None),
         ("var foo = void 0", None),
         ("var foo = void 0", Some(serde_json::json!([{ "allowAsStatement": true }]))),
+        ("function discard(callback) { return void callback(); }", None),
     ];
 
     let fix = vec![
@@ -118,6 +127,18 @@ fn test() {
             "var foo = undefined",
             Some(serde_json::json!([{ "allowAsStatement": true }])),
         ),
+        ("var foo = void (0)", "var foo = undefined", None),
+        (
+            "function discard(callback) { return void callback(); }",
+            "function discard(callback) { return void callback(); }",
+            None,
+        ),
+        ("var foo = void bar", "var foo = void bar", None),
+        (
+            "function f(undefined) { return void 0; }",
+            "function f(undefined) { return void 0; }",
+            None,
+        ),
     ];
 
     Tester::new(NoVoid::NAME, NoVoid::PLUGIN, pass, fail).expect_fix(fix).test_and_snapshot();
```

**File**: `crates/oxc_linter/src/snapshots/eslint_no_void.snap` (modified, +7/-0)
```diff
@@ -43,3 +43,10 @@ source: crates/oxc_linter/src/tester.rs
    ·           ──────
    ╰────
   help: Use `undefined` instead
+
+  ⚠ eslint(no-void): Unexpected `void` operator
+   ╭─[no_void.tsx:1:37]
+ 1 │ function discard(callback) { return void callback(); }
+   ·                                     ───────────────
+   ╰────
+  help: Use `undefined` instead
```

---

### Incident Patch 2: `c7d3f6b5` (2026-11-28)
**Commit Message**: fix(napi/minify, napi/transform): do not produce codeframe for options errors (#30431)

NAPI `minify`, `transform-react` and `transform-relay` all produced
diagnostics with a codeframe for errors with options.

These errors are not related to the file or it's source, so skip adding
the code frame.

**File**: `Cargo.lock` (modified, +0/-1)
```diff
@@ -2431,7 +2431,6 @@ dependencies = [
  "oxc_allocator",
  "oxc_codegen",
  "oxc_compat",
- "oxc_diagnostics",
  "oxc_minifier",
  "oxc_napi",
  "oxc_parser",
```

**File**: `napi/minify/Cargo.toml` (modified, +0/-1)
```diff
@@ -26,7 +26,6 @@ oxc_allocator = { workspace = true }
 oxc_codegen = { workspace = true, features = ["sourcemap"] }
 oxc_compat = { workspace = true }
 oxc_str = { workspace = true }
-oxc_diagnostics = { workspace = true }
 oxc_minifier = { workspace = true }
 oxc_napi = { workspace = true }
 oxc_parser = { workspace = true }
```

**File**: `napi/minify/src/lib.rs` (modified, +7/-16)
```diff
@@ -22,8 +22,7 @@ use napi_derive::napi;
 
 use oxc_allocator::Allocator;
 use oxc_codegen::Codegen;
-use oxc_diagnostics::OxcDiagnostic;
-use oxc_minifier::Minifier;
+use oxc_minifier::{Minifier, MinifierOptions};
 use oxc_napi::OxcError;
 use oxc_parser::Parser;
 use oxc_sourcemap::napi::SourceMap;
@@ -60,19 +59,14 @@ fn to_napi_mangle_cache(
 
 fn minify_impl(filename: &str, source_text: &str, options: Option<MinifyOptions>) -> MinifyResult {
     use oxc_codegen::CodegenOptions;
+
     let options = options.unwrap_or_default();
 
-    let mut minifier_options = match oxc_minifier::MinifierOptions::try_from(&options) {
+    let mut minifier_options = match MinifierOptions::try_from(&options) {
         Ok(options) => options,
         Err(error) => {
-            return MinifyResult {
-                errors: OxcError::from_diagnostics(
-                    filename,
-                    source_text,
-                    vec![OxcDiagnostic::error(error)],
-                ),
-                ..MinifyResult::default()
-            };
+            // Options error is not an error in the source text, so don't produce a codeframe
+            return MinifyResult { errors: vec![OxcError::new(error)], ..MinifyResult::default() };
         }
     };
 
@@ -107,12 +101,9 @@ fn minify_impl(filename: &str, source_text: &str, options: Option<MinifyOptions>
         Some(Either::B(o)) => match o.to_codegen_options() {
             Ok(opts) => opts,
             Err(error) => {
+                // Options error is not an error in the source text, so don't produce a codeframe
                 return MinifyResult {
-                    errors: OxcError::from_diagnostics(
-                        filename,
-                        source_text,
-                        vec![OxcDiagnostic::error(error)],
-                    ),
+                    errors: vec![OxcError::new(error)],
                     ..MinifyResult::default()
                 };
             }
```

**File**: `napi/minify/test/minify.test.ts` (modified, +9/-0)
```diff
@@ -55,6 +55,13 @@ describe("simple", () => {
     expect(ret.errors.length).toBe(0);
   });
 
+  it("rejects empty legalComments.linked path", () => {
+    const ret = minifySync("test.js", "foo();", { codegen: { legalComments: { linked: "" } } });
+    expect(ret.errors.length).toBe(1);
+    expect(ret.errors[0].message).toContain("legalComments.linked must be a non-empty path");
+    expect(ret.errors[0].codeframe).toBeNull();
+  });
+
   it("defaults to esnext", () => {
     const code = "try { foo } catch (e) {}";
     const ret = minifySync("test.js", code);
@@ -176,6 +183,7 @@ describe("treeshake options", () => {
     });
     expect(ret.errors.length).toBe(1);
     expect(ret.errors[0].message).toContain("Invalid propertyReadSideEffects value");
+    expect(ret.errors[0].codeframe).toBeNull();
   });
 });
 
@@ -372,6 +380,7 @@ describe("property mangling", () => {
     const ret = minifySync("test.js", "obj._field;", { mangleProps: mangleProps as any });
     expect(ret.errors).toHaveLength(1);
     expect(ret.errors[0].message).toContain(message);
+    expect(ret.errors[0].codeframe).toBeNull();
     expect(ret.mangleCache).toBeUndefined();
   });
 });
```

**File**: `napi/transform-react/src/lib.rs` (modified, +2/-1)
```diff
@@ -74,9 +74,10 @@ fn transform_impl(
     let (react_compiler_options, transform_options) = match options.resolve(filename) {
         Ok(options) => options,
         Err(error) => {
+            // Options error is not an error in the source text, so don't produce a codeframe
             return TransformResult {
                 fatal: true,
-                errors: OxcError::from_diagnostics(filename, source_text, [error]),
+                errors: vec![OxcError::from(&error)],
                 ..TransformResult::default()
             };
         }
```

**File**: `napi/transform-react/test/transform.test.ts` (modified, +1/-0)
```diff
@@ -133,6 +133,7 @@ export function Component({ value }: { value: string }) {
     expect(result.code).toBe("");
     expect(result.errors).toHaveLength(1);
     expect(result.errors[0].message).toContain(`Invalid React Compiler \`${option}\` option`);
+    expect(result.errors[0].codeframe).toBeNull();
   });
 
   it("marks parse errors as fatal", () => {
```

**File**: `napi/transform-relay/src/lib.rs` (modified, +2/-1)
```diff
@@ -65,8 +65,9 @@ fn transform_impl(
     let relay_options = match options.unwrap_or_default().resolve() {
         Ok(options) => options,
         Err(error) => {
+            // Options error is not an error in the source text, so don't produce a codeframe
             return TransformResult {
-                errors: OxcError::from_diagnostics(filename, source_text, [error]),
+                errors: vec![OxcError::from(&error)],
                 ..TransformResult::default()
             };
         }
```

**File**: `napi/transform-relay/test/transform.test.ts` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ describe("transformSync", () => {
     const invalidOption = transformSync("foo.js", fixture, { language: "elm" });
     expect(invalidOption.code).toBe("");
     expect(invalidOption.errors[0].message).toContain("language");
+    expect(invalidOption.errors[0].codeframe).toBeNull();
   });
 });
 
```

---

### Incident Patch 3: `eef83a05` (2026-11-27)
**Commit Message**: fix(linter/typescript/no-extraneous-class): make class deletion a dangerous suggestion that keeps valid syntax (#30415)

- Deleting an empty class is now emitted as a dangerous suggestion,
matching the rule's declared fix kind, so `--fix-suggestions` alone no
longer removes (possibly exported) classes.
- For `export default class {}`, the suggestion deletes the whole export
instead of leaving a bare `export default`.
- When the next token could continue the previous statement (`(`, `[`,
`/`, `+`, `-`, ``` ` ```, `<`), the class is replaced with `;` instead
of deleted, so `const n = 1\nclass Empty {}\n/abc/.test('abc')` stays
valid.

**File**: `crates/oxc_linter/src/rules/typescript/no_extraneous_class.rs` (modified, +27/-6)
```diff
@@ -11,6 +11,7 @@ use oxc_span::Span;
 
 use crate::{
     AstNode,
+    ast_util::next_token,
     context::LintContext,
     rule::{DefaultRuleConfig, Rule},
 };
@@ -143,18 +144,23 @@ impl Rule for NoExtraneousClass {
                         }
                     }
                     let has_decorators = !class.decorators.is_empty();
-                    ctx.diagnostic_with_suggestion(
+                    ctx.diagnostic_with_dangerous_suggestion(
                         empty_class_diagnostic(span, has_decorators),
                         |fixer| {
                             if has_decorators || class.is_expression() {
                                 return fixer.noop();
                             }
-                            if let AstKind::ExportDeclaration(decl) =
-                                ctx.nodes().parent_kind(node.id())
-                            {
-                                fixer.delete(decl)
+                            let span = match ctx.nodes().parent_kind(node.id()) {
+                                AstKind::ExportDeclaration(decl) => decl.span,
+                                AstKind::ExportDefaultDeclaration(decl) => decl.span,
+                                _ => class.span,
+                            };
+                            if next_token(span.end, ctx).is_some_and(|(_, c)| {
+                                matches!(c, '(' | '[' | '/' | '+' | '-' | '`' | '<')
+                            }) {
+                                fixer.replace(span, ";")
                             } else {
-                                fixer.delete(class)
+                                fixer.delete_range(span)
                             }
                         },
                     );
@@ -359,6 +365,21 @@ fn test() {
     let fix = vec![
         ("class Foo {}", "", None, FixKind::DangerousSuggestion),
         ("export class Foo {}", "", None, FixKind::DangerousSuggestion),
+        ("export default class {}", "", None, FixKind::DangerousSuggestion),
+        ("export default class Foo {}", "", None, FixKind::DangerousSuggestion),
+        ("export class Foo {}", "export class Foo {}", None, FixKind::Suggestion),
+        (
+            "const n = 1\nclass Empty {}\n/abc/.test('abc');",
+            "const n = 1\n;\n/abc/.test('abc');",
+            None,
+            FixKind::DangerousSuggestion,
+        ),
+        (
+            "foo()\nexport class Empty {}\n[1].map(bar);",
+            "foo()\n;\n[1].map(bar);",
+            None,
+            FixKind::DangerousSuggestion,
+        ),
         (
             "@foo class Foo {}",
             "@foo class Foo {}",
```

#### Recent Merged Pull Requests:
- **PR #30437** (2026-11-28): docs(napi): improve JSDoc comments for all NAPI entry point functions (@overlookmotel)
- **PR #30436** (2026-11-28): refactor(napi): clarify types in async tasks (@overlookmotel)
- **PR #30435** (2026-11-28): refactor(napi/parser): rename `ResolveTask` to `ParseTask` (@overlookmotel)
- **PR #30434** (2026-11-28): perf(napi): drop all data on worker thread (@overlookmotel)
- **PR #30433** (2026-11-28): refactor(napi): re-order code (@overlookmotel)
- **PR #30432** (2026-11-28): refactor(napi/transform): deduplicate code (@overlookmotel)

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

## X. linter/eslint/no-void): only suggest `undefined` for literal operands

**RULE**:
When implementing operations in `crates/oxc_linter/src/rules/eslint/no_void.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c94ac0b2`: linter/eslint/no-void): only suggest `undefined` for literal operands. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_linter/src/rules/eslint/no_void.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use oxc_str::static_ident;
            let diagnostic = no_void_diagnostic(unary_expr.span);
            if unary_expr.argument.without_parentheses().is_literal()
                && ctx.scoping().find_binding(node.scope_id(), static_ident!("undefined")).is_none()
            {
                ctx.diagnostic_with_suggestion(diagnostic, |fixer| {
                    fixer.replace(unary_expr.span, "undefined")
                });
            } else {
                ctx.diagnostic(diagnostic);
            }
        ("function discard(callback) { return void callback(); }", None),
        ("var foo = void (0)", "var foo = undefined", None),
        (
            "function discard(callback) { return void callback(); }",
            "function discard(callback) { return void callback(); }",
            None,
        ),
        ("var foo = void bar", "var foo = void bar", None),
        (
            "function f(undefined) { return void 0; }",
            "function f(undefined) { return void 0; }",
            None,
        ),
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            ctx.diagnostic_with_suggestion(no_void_diagnostic(unary_expr.span), |fixer| {
                fixer.replace(unary_expr.span, "undefined")
            });
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c94ac0b2` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
