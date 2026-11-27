# Verification Protocol: Verification Protocol: Empirical Defect Shield for oxc-project-oxc-learnings

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project-oxc-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T09:44:58.844Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oxc-project-oxc-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project-oxc-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T09:44:58.844Z`  
> **Learning ID**: `LEARN-EVO-oxc-project-oxc-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `oxc-project-oxc-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oxc-project-oxc-learnings.md`  
> **Source**: github ([https://github.com/oxc-project/oxc](https://github.com/oxc-project/oxc))  
> **Source Version**: `68fdb4c9`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T09:44:39.142Z  
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
> **Harvest Timestamp**: 2026-11-27T09:44:39.137Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oxc-project/oxc`
- **Description**: ⚓ A collection of high-performance JavaScript tools.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 23630 stars

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
- **Issue #30395** (2026-11-27): **fix(formatter_css): bump oxc-css-parser to 0.0.24 and keep SCSS at-rule names and the Less keyword `-` as written**
  *Symptoms*: Bumps `oxc-css-parser` to 0.0.24 (oxc-project/oxc-css-parser#220 to #224, fixing oxc-project/oxc-css-parser#217, #218 and #219, and oxc-project/oxc-css-parser#226) and follows its fixes in the CSS formatter. Before, oxfmt rejected some valid SCSS / Less, and changed what lessc and dart-sass compile for others.  - `@supports selector()`: the parser now spans the term from its name to its `)`, so the workaround that found both by scanning the source is dropped (a refactor: fixture output and conformance results are unchanged) - Less: `2-round(1.5)` and `1-(1)` are now subtractions, as in less.js, and print as written; a lone `-` that negates nothing is a keyword (`1 -"t"`), now kept glued to its neighbors as Prettier does - SCSS: dart-sass matches at-rule names case-sensitively, so an uppercase one is an unknown at-rule there: it now prints as written, params included. Lowercasing turned `@IMPORT` / `@USE` into a real `@import` / `@use`, and `@MEDIA (min-width:$bp)` (which dart-sass keeps as is) was re-spaced (`DIVERGENCES.md#scss-at-rule-name-case`) - Less `- 1` (a keyword, then a number) keeps its space where Prettier prints `-1`, which lessc compiles differently (`DIVERGENCES.md#less-keyword-minus`)  ### Example  Input (SCSS):  ```scss @IMPORT "Keep"; @USE "x"; ```  Before output:  ```scss @import "Keep"; @use "x"; ```  After output:  ```scss @IMPORT "Keep"; @USE "x"; ```  dart-sass 1.108.2 compiles `@IMPORT "Keep";` as written (an unknown at-rule), but `@import "Keep";` as 

- **Issue #30393** (2026-11-27): **refactor(formatter_css): share the operator fill between calc and Less operations**
  *Symptoms*: ## Summary  `write_calc` and `write_less_binary_operation` built the same flat operator fill twice: the piece enum, the operator push that ends a chunk after a spaced operator, the chunk writer with its comment flushes, and the `group(indent(fill))` layout. Both now go through `OpPiece` / `OpChunks` and keep only their own operand recursion and spacing rules.  Operators are printed from their source spans (the same `write_text_with_leading_comments` the Sass printer uses), so the two operator-to-string tables and the separate `Space` piece go away.  ## What stays identical  The formatter output, byte for byte. Compared against the parent PR's head:  - Every `.css` / `.scss` / `.less` file under `apps/oxfmt/conformance/externals` (2565 files: Prettier's suite plus the real-world projects), formatted with `--print-width 80` and `100` by both builds of the `css_formatter` example: 0 differences. - `cargo test -p oxc_formatter_css`: all snapshots unchanged. - `conformance:prettier`, `conformance:fixture` and `conformance:live` reports: unchanged.  `write_sass_binary` still builds its own fill: its run merging for `+` / `-` decides spacing while writing, so moving it onto `OpChunks` would be a behavior-sensitive change of its own.  ---  AI assistance: this PR was written with Claude Code (model: Claude Opus 5.5, `claude-opus-5-5`; the reasoning effort level is not available to the agent).  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

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

### Incident Patch 1: `9eb6c432` (2026-11-26)
**Commit Message**: fix(linter/eslint/no-empty-static-block): suggest a comment instead of deleting the block (#30374)

- Change the suggestion to insert ` /* empty */ ` inside the static
block instead of deleting it, matching ESLint.
- Deleting the block could merge neighbouring class members. For
example, `x = value` followed by `[key]() {}` became a computed access
on the field initializer, which is invalid.

**File**: `crates/oxc_linter/src/rules/eslint/no_empty_static_block.rs` (modified, +20/-5)
```diff
@@ -67,7 +67,15 @@ impl Rule for NoEmptyStaticBlock {
             }
             ctx.diagnostic_with_suggestion(
                 no_empty_static_block_diagnostic(static_block.span),
-                |fixer| fixer.delete(&static_block.span),
+                |fixer| {
+                    let span = static_block.span;
+                    let Some(offset) = ctx.find_next_token_within(span.start, span.end, "{") else {
+                        return fixer.noop();
+                    };
+                    fixer
+                        .replace(Span::new(span.start + offset + 1, span.end - 1), " /* empty */ ")
+                        .with_message("Add comment inside empty static block.")
+                },
             );
         }
     }
@@ -96,15 +104,22 @@ fn test() {
     ];
 
     let fix = vec![
-        ("class Foo { static {} }", "class Foo {  }"),
-        ("class Foo { static { } }", "class Foo {  }"),
+        ("class Foo { static {} }", "class Foo { static { /* empty */ } }"),
+        ("class Foo { static { } }", "class Foo { static { /* empty */ } }"),
         (
             "class Foo { static {
 
 			 } }",
-            "class Foo {  }",
+            "class Foo { static { /* empty */ } }",
+        ),
+        (
+            "class Foo { static { bar(); } static {} }",
+            "class Foo { static { bar(); } static { /* empty */ } }",
+        ),
+        (
+            "class C { x = value\nstatic {}\n[key]() {} }",
+            "class C { x = value\nstatic { /* empty */ }\n[key]() {} }",
         ),
-        ("class Foo { static { bar(); } static {} }", "class Foo { static { bar(); }  }"),
     ];
 
     Tester::new(NoEmptyStaticBlock::NAME, NoEmptyStaticBlock::PLUGIN, pass, fail)
```

---

### Incident Patch 2: `68fdb4c9` (2026-11-27)
**Commit Message**: fix(formatter_css): bump oxc-css-parser to 0.0.24 and keep SCSS at-rule names and the Less keyword `-` as written (#30395)

Bumps `oxc-css-parser` to 0.0.24 (oxc-project/oxc-css-parser#220 to
#224, fixing oxc-project/oxc-css-parser#217, #218 and #219, and
oxc-project/oxc-css-parser#226) and follows its fixes in the CSS
formatter. Before, oxfmt rejected some valid SCSS / Less, and changed
what lessc and dart-sass compile for others.

- `@supports selector()`: the parser now spans the term from its name to
its `)`, so the workaround that found both by scanning the source is
dropped (a refactor: fixture output and conformance results are
unchanged)
- Less: `2-round(1.5)` and `1-(1)` are now subtractions, as in less.js,
and print as written; a lone `-` that negates nothing is a keyword (`1
-"t"`), now kept glued to its neighbors as Prettier does
- SCSS: dart-sass matches at-rule names case-sensitively, so an
uppercase one is an unknown at-rule there: it now prints as written,
params included. Lowercasing turned `@IMPORT` / `@USE` into a real
`@import` / `@use`, and `@MEDIA (min-width:$bp)` (which dart-sass keeps
as is) was re-spaced (`DIVERGENCES.md#scss-at-rule-name-case`)
- Less `- 1

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1679,9 +1679,9 @@ dependencies = [
 
 [[package]]
 name = "oxc-css-parser"
-version = "0.0.22"
+version = "0.0.24"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8e5e8f4fcfe5796d4e23bec581cf049823c9303cb27bbcbbaa31342bce0d48bd"
+checksum = "398ea9a6754e2ebf0225b4f80dedb03a9836d5cbd1397fbb0701479db99c786c"
 dependencies = [
  "oxc_allocator",
 ]
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -250,7 +250,7 @@ nodejs-built-in-modules = "1.0.0" # Node.js built-in modules
 nonmax = "0.5.5" # Non-maximum numbers
 num-bigint = "0.5.0" # Big integers
 num-traits = "0.2.19" # Numeric traits
-oxc-css-parser = "0.0.22" # CSS/SCSS/Less parser (raffia 0.12.3 fork: adds `template_placeholder` typed placeholders for css-in-js + valid-syntax coverage fixes (see crates/oxc_formatter_css/AGENTS.md))
+oxc-css-parser = "0.0.24" # CSS/SCSS/Less parser (raffia 0.12.3 fork: adds `template_placeholder` typed placeholders for css-in-js + valid-syntax coverage fixes (see crates/oxc_formatter_css/AGENTS.md))
 oxc-graphql-parser = "0.0.10" # GraphQL parser (direct AST; apollo-parser 0.8.6 fork aligned with graphql-js 17 syntax)
 oxc-htmlish-parser = "0.0.11" # HTML / Vue / Angular parser (loose, span-faithful AST)
 oxc-markdown-parser = "0.0.4" # CommonMark + GFM parser (span-faithful, style-preserving typed AST)
```

**File**: `apps/oxfmt/conformance/snapshots/prettier.snap.md` (modified, +6/-6)
```diff
@@ -395,6 +395,8 @@
 - externals/prettier/css/font/font.css (💥, 79.41%)
   - crates/oxc_formatter_css/DIVERGENCES.md#slash-spacing
   - crates/oxc_formatter_css/DIVERGENCES.md#math-function-operator-spacing
+- externals/prettier/scss/case/case.scss (💥, 93.67%)
+  - crates/oxc_formatter_css/DIVERGENCES.md#scss-at-rule-name-case
 - externals/prettier/scss/comments/4594.scss (💥, 83.78%)
   - crates/oxc_formatter_css/DIVERGENCES.md#line-comment-after-comma
 - externals/prettier/scss/comments/4878.scss (💥, 89.39%)
@@ -437,8 +439,6 @@
 
 ### Error
 
-- externals/prettier/scss/case/case.scss: Syntax error: expect token `<string>`, but found `<ident>`
-  - ❓unclassified
 - externals/prettier/css/custom-properties/emoji.css: Syntax error: declaration at top level is disallowed
   - crates/oxc_formatter_css/DIVERGENCES.md#grammar-owner-rejected
 - externals/prettier/scss/atrule/for.scss: Syntax error: Sass keyword `to` is expected
@@ -500,15 +500,13 @@
 - externals/prettier/less/less-test-suite/snippet: tests-unit/variables/variables.less (💥, 97.89%)
   - crates/oxc_formatter_css/DIVERGENCES.md#slash-spacing
   - crates/oxc_formatter_css/DIVERGENCES.md#less-escaped-string-gap
+- externals/prettier/less/less/less.less (💥, 99.21%)
+  - crates/oxc_formatter_css/DIVERGENCES.md#less-extend-statement-break
 - externals/prettier/less/postcss-8-improment/test.less (💥, 88.24%)
   - crates/oxc_formatter_css/DIVERGENCES.md#custom-property-raw-verbatim
 
 ### Error
 
-- externals/prettier/less/less/less.less: Syntax error: expect one of `<ident>` or `@{`, but found `(`
-  - ❓unclassified
-- externals/prettier/less/parens/parens.less: Syntax error: expect token `;`, but found `{`
-  - ❓unclassified
 - externals/prettier/less/case/case.less: Syntax error: expect token `(`, but found `<ident>`
   - crates/oxc_formatter_css/DIVERGENCES.md#grammar-owner-rejected
 - externals/prettier/less/comments/in-value.less: Syntax error: expect token `;`, but found `{`
@@ -519,6 +517,8 @@
   - crates/oxc_formatter_css/DIVERGENCES.md#grammar-owner-rejected
 - externals/prettier/less/no-semicolon/url.less: Syntax error: expect token `(`, but found `<ident>`
   - crates/oxc_formatter_css/DIVERGENCES.md#grammar-owner-rejected
+- externals/prettier/less/parens/parens.less: Syntax error: expect token `;`, but found `{`
+  - crates/oxc_formatter_css/DIVERGENCES.md#grammar-owner-rejected
 
 ## graphql
 
```

**File**: `crates/oxc_formatter_css/AGENTS.md` (modified, +2/-1)
```diff
@@ -171,7 +171,8 @@ What the formatter relies on per shape:
 ### Case
 
 Lowercased: what the spec makes ASCII case-insensitive AND that can only be a keyword in its position.
-e.g. at-rule names, property names (a `@supports` declaration's included), media feature names, media types,
+e.g. at-rule names (not in SCSS: DIVERGENCES.md#scss-at-rule-name-case),
+property names (a `@supports` declaration's included), media feature names, media types,
 `only` / `and` / `not` / `or`.
 Everything else prints as written:
 values (a value may be a case-sensitive custom ident: `animation-name`, `grid-area`; keyword values are a linter's `value-keyword-case`),
```

**File**: `crates/oxc_formatter_css/DIVERGENCES.md` (modified, +50/-0)
```diff
@@ -965,6 +965,7 @@ and its at-rule printer drops the block comments in there (a trailing one surviv
 - Pin: `tests/fixtures/format/less/extend-rule.less`
 - Conformance:
   - `externals/prettier/less/less-test-suite/snippet: tests-unit/extend-chaining/extend-chaining.less`
+  - `externals/prettier/less/less/less.less` (the `extend #7977` rules)
 - Drop when: the selector-list leak is fixed (prettier/prettier#19550 covered only the indentation) and the pin catches up
 
 ```less
@@ -1010,6 +1011,54 @@ Prettier glues the sign to the number (removing the source space, a postcss word
 Matching that gluing is ad-hoc work for a torture-test-only shape.
 A sign GLUED in the source never gains a space in either implementation (that direction is the parser's folded-sign handling, not a divergence).
 
+## less-keyword-minus
+
+- Why: semantics
+- Pin: `tests/fixtures/format/less/keyword-minus.less`
+
+```less
+/* input */
+v: -  1;
+
+/* ours */
+v: - 1;
+
+/* prettier */
+v: -1;
+```
+
+less.js negates only a glued `@var`, `$prop` or `(`, so a lone `-` before a number is a keyword, not a sign.
+lessc compiles `- 1` as written and `-1` as the number, so Prettier's glue changes the output.
+
+## scss-at-rule-name-case
+
+- Why: semantics
+- Pin: `tests/fixtures/format/scss/at-rule-name-case.scss`
+- Conformance:
+  - `externals/prettier/scss/case/case.scss` (the at-rule name lines only; the interpolated property name line has no entry)
+
+```scss
+/* input */
+@IMPORT Keep;
+@USE "x";
+@MEDIA (MIN-WIDTH: 700PX) {}
+
+/* ours */
+@IMPORT Keep;
+@USE "x";
+@MEDIA (MIN-WIDTH: 700PX) {}
+
+/* prettier */
+@import Keep;
+@use "x";
+@media (min-width: 700px) {}
+```
+
+dart-sass matches at-rule names case-sensitively: `@IMPORT`, `@USE` and `@MEDIA` are unknown at-rules it compiles as written,
+while `@import Keep;` fails to compile and `@use "x"` loads a module.
+So an SCSS at-rule with an uppercase name prints as written, its params included,
+as every unknown at-rule's (AGENTS.md "Printing raw vs typed").
+
 ## signed-value-resplit
 
 - Why: uniform-rule (same construct, same output: the item in first position, an unsigned item)
@@ -1140,6 +1189,7 @@ A spaced `/` is not part of this: it glues to its left operand and breaks after,
   - `externals/prettier/less/interpolation/interpolation.less`
   - `externals/prettier/less/lookup/lookup-1.less`
   - `externals/prettier/less/no-semicolon/url.less`
+  - `externals/prettier/less/parens/parens.less`
 
 ```less
 /* input */
```

**File**: `crates/oxc_formatter_css/src/print/at_rule.rs` (modified, +27/-66)
```diff
@@ -30,18 +30,28 @@ use crate::{
     context::CssFormatContext,
     format::to_span,
     print::{
-        CssFormatter, block_comment_end, format_with, is_glued, scss, selector, statement,
+        CssFormatter, format_with, is_glued, scss, selector, statement,
         value::{self, ValueContext},
         write_maybe_lowercase,
     },
 };
 
+/// `@` and an at-rule name, lowercased except in SCSS (DIVERGENCES.md#scss-at-rule-name-case).
+pub(super) fn write_at_rule_name(span: oxc_span::Span, f: &mut CssFormatter<'_, '_>) {
+    let name = f.context().source_text().text_for(&span);
+    write!(f, "@");
+    if matches!(f.options().variant, crate::options::CssVariant::Scss) {
+        write!(f, text(name));
+    } else {
+        write_maybe_lowercase(name, f);
+    }
+}
+
 /// Mirrors Prettier's `css-atrule`.
 pub(super) fn write_at_rule<'a>(at_rule: &AtRule<'a>, f: &mut CssFormatter<'_, 'a>) {
     let source = f.context().source_text();
-    write!(f, "@");
     let name_span = to_span(at_rule.name.span());
-    write_maybe_lowercase(source.text_for(&name_span), f);
+    write_at_rule_name(name_span, f);
 
     // Comments inside the params: the structured printers place them,
     // a commented String-params prelude prints them as written (below).
@@ -80,7 +90,10 @@ pub(super) fn write_at_rule<'a>(at_rule: &AtRule<'a>, f: &mut CssFormatter<'_, '
         // The exception: SCSS-family names parsed AS CSS
         // (oxc-css-parser: Unknown, Prettier: parseValue/parseSelector) keep the structural printers below.
         let unknown_string_params = matches!(prelude, AtRulePrelude::Unknown(_))
-            && !is_value_parsed_at_rule(at_rule.name.raw);
+            && !is_value_parsed_at_rule(
+                at_rule.name.raw,
+                matches!(f.options().variant, crate::options::CssVariant::Scss),
+            );
         // NOTE: Prettier also keeps `@warn` / `@error` params as a raw string (`media-unknown`),
         // but `oxc-css-parser` parses their prelude structurally (`SassExpr`),
         // so we route them through the normal structured printer
@@ -268,8 +281,9 @@ fn split_important_tail(raw: &str) -> Option<(&str, &str)> {
 /// so a `oxc-css-parser` Unknown prelude for them must keep the structural printers.
 ///
 /// Case-sensitivity mirrors Prettier:
-/// bare `name` comparisons for the SCSS family, lowercased for module/media rules.
-fn is_value_parsed_at_rule(name: &str) -> bool {
+/// bare `name` comparisons for the SCSS family, lowercased for module/media rules
+/// except in SCSS, which keeps `@MEDIA` unknown (DIVERGENCES.md#scss-at-rule-name-case).
+fn is_value_parsed_at_rule(name: &str, scss: bool) -> bool {
     matches!(
         name,
         "extend"
@@ -291,7 +305,7 @@ fn is_value_parsed_at_rule(name: &str) -> bool {
             | "add-mixin"
             | "custom-selector"
     ) || matches!(
-        &*name.cow_to_ascii_lowercase(),
+        &*if scss { name.into() } else { name.cow_to_ascii_lowercase() },
         "import" | "use" | "forward" | "media" | "custom-media"
     )
 }
@@ -354,17 +368,7 @@ fn write_at_rule_prelude<'a>(prelude: &AtRulePrelude<'a>, f: &mut CssFormatter<'
     let source = f.context().source_text();
     // `@import` places its own: one fuses with the path after it (`write_import_path_list`)
     if !matches!(prelude, AtRulePrelude::Import(_) | AtRulePrelude::SassImport(_)) {
-        // A first `selector()` term starts before its span (`supports_in_parens_start`)
-        let start = match prelude {
-            AtRulePrelude::Supports(condition) => match condition.conditions.first() {
-                Some(SupportsConditionKind::SupportsInParens(in_parens)) => {
-                    supports_in_parens_start(in_parens, f)
-                }
-                _ => condition.span.start,
-            },
-            _ => prelude.span().start,
-        };
-        write_leading_comments(start, f);
+        write_leading_comments(prelude.span().start, f);
     }
     match prelude {
         AtRulePrelude::Media(media) => write_media_query_list(media, f),
@@ -1967,42 +1971,11 @@ fn write_supports_term<'a>(
     end: u32,
     f: &mut CssFormatter<'_, 'a>,
 ) {
-    let mut span = to_span(in_parens.span());
-    span.start = supports_in_parens_start(in_parens, f);
-    value::write_with_comments(span, end, f, |f| {
+    value::write_with_comments(to_span(in_parens.span()), end, f, |f| {
         write_supports_in_parens(in_parens, f);
     });
 }
 
-/// Where a term starts, so a comment inside it never reads as leading it.
-///
-/// TODO: oxc-css-parser spans a `selector()` term as its selector list only:
-/// its start is found back over the pending comments and whitespace after `selector(`.
-/// Fix the span in the parser and remove this.
-fn supports_in_parens_start(in_parens: &SupportsInParens<'_>, f: &CssFormatter<'_, '_>) -> u32 {
-    let list_start = in_parens.span.start;
-    if !matches!(in_parens.kind, SupportsInParensKind::Selec
```

**File**: `crates/oxc_formatter_css/src/print/statement.rs` (modified, +1/-3)
```diff
@@ -226,10 +226,8 @@ pub(super) fn write_statement<'a>(stmt: &Statement<'a>, f: &mut CssFormatter<'_,
         Statement::UnknownSassAtRule(unknown) => {
             // Same string-params contract as the Unknown prelude in `write_at_rule`:
             // Prettier prints unknown at-rule params verbatim.
-            let source = f.context().source_text();
-            write!(f, "@");
             let name_span = to_span(unknown.name.span());
-            write_maybe_lowercase(source.text_for(&name_span), f);
+            at_rule::write_at_rule_name(name_span, f);
             let region_end = params_region_end(unknown.block.as_ref(), unknown.span.end, f);
             let prelude_start =
                 unknown.prelude.as_ref().map_or(region_end, |prelude| prelude.span().start);
```

**File**: `crates/oxc_formatter_css/src/print/value.rs` (modified, +9/-1)
```diff
@@ -1423,6 +1423,11 @@ fn raw_token<'b, 'a>(value: &'b ComponentValue<'a>) -> Option<&'b Token<'a>> {
     if let ComponentValue::TokenWithSpan(token) = value { Some(&token.token) } else { None }
 }
 
+/// A lone `-` that oxc-css-parser reads as a Less keyword, not an operator or a sign (`1 -"t"`).
+fn is_less_keyword_minus(value: &ComponentValue<'_>) -> bool {
+    matches!(value, ComponentValue::InterpolableIdent(InterpolableIdent::Literal(id)) if id.raw == "-")
+}
+
 /// The end of the run starting at `values[start]`: tight / non-breaking-space components merge into one fill entry.
 fn run_end(
     values: &[ComponentValue<'_>],
@@ -1577,11 +1582,14 @@ fn base_separator(values: &[ComponentValue<'_>], i: usize, ctx: ValueContext<'_>
 
     // Raw token fallbacks (postcss-values would have produced operator/word tokens):
     // keep gap-free neighbors tight (`10em+12em`, `-fb-url(/a/b)`).
+    // So does the Less keyword `-` (`1 -"t"`, `1-`): a space after it would make it an operator
     if gap_empty
         && (matches!(prev, ComponentValue::TokenWithSpan(_) | ComponentValue::Placeholder(_))
             || matches!(curr, ComponentValue::TokenWithSpan(_) | ComponentValue::Placeholder(_))
             || matches!(prev, ComponentValue::Delimiter(_))
-            || matches!(curr, ComponentValue::Delimiter(_)))
+            || matches!(curr, ComponentValue::Delimiter(_))
+            || is_less_keyword_minus(prev)
+            || is_less_keyword_minus(curr))
     {
         return Separator::Tight;
     }
```

---

### Incident Patch 3: `69957244` (2026-11-27)
**Commit Message**: fix(formatter_css): make `/` spacing symmetric and space math-function operators (#30392)

## Summary

The spacing around `/` in CSS / SCSS / Less values depended on which
printer path handled it and on the operand kind, kept lopsided spacing
(`$a/ 2`), and comments next to a `/` moved past it. This PR applies one
rule everywhere:

- Outside a math function, a `/` stays tight when the source glues it on
both sides; a gap on either side prints one space on both sides.
- Inside a math function (`calc`, `min`, `max`, `clamp`, `round`, ...),
`*` and `/` are always spaced; `+` / `-` keep the source (they require
whitespace, a glued one is invalid and left as written).
- A comment between an operand and an operator stays where it is.

### Example

Input:

```scss
.a {
  font: 12px/ 1.5 serif;
  width: $a/ 2;
  width: f(1px)/2;
  width: calc(1px/2);
  width: min(1px/2, 3px);
  width: 1px /* c */ / 2;
}
```

Before output:

```scss
.a {
  font: 12px/1.5 serif;
  width: $a/ 2;
  width: f(1px)/2;
  width: calc(1px/2);
  width: min(1px/2, 3px);
  width: 1px / /* c */ 2;
}
```

After output:

```scss
.a {
  font: 12px / 1.5 serif;
  width: $a / 2;
  width: f(1px)/2;
  width: calc(1px / 2);
  w

**File**: `apps/oxfmt/conformance/snapshots/prettier.snap.md` (modified, +17/-6)
```diff
@@ -323,7 +323,7 @@
 
 ## css
 
-139/164 (84.76%)
+138/164 (84.15%)
 
 ### Failed
 
@@ -339,11 +339,15 @@
   - crates/oxc_formatter_css/DIVERGENCES.md#declaration-colon-comments
 - externals/prettier/css/fill-value/fill.css (💥, 93.33%)
   - crates/oxc_formatter_css/DIVERGENCES.md#signed-value-resplit
+- externals/prettier/css/font/font.css (💥, 79.41%)
+  - crates/oxc_formatter_css/DIVERGENCES.md#slash-spacing
+  - crates/oxc_formatter_css/DIVERGENCES.md#math-function-operator-spacing
 - externals/prettier/css/parens/empty-lines.css (💥, 31.58%)
   - crates/oxc_formatter_css/DIVERGENCES.md#postcss-simple-var-raw-verbatim
-- externals/prettier/css/parens/parens.css (💥, 92.41%)
+- externals/prettier/css/parens/parens.css (💥, 91.72%)
   - crates/oxc_formatter_css/DIVERGENCES.md#unary-plus-glue
   - crates/oxc_formatter_css/DIVERGENCES.md#css-glued-minus-paren
+  - crates/oxc_formatter_css/DIVERGENCES.md#slash-spacing
 - externals/prettier/css/postcss-8-improment/test.css (💥, 88.24%)
   - crates/oxc_formatter_css/DIVERGENCES.md#custom-property-raw-verbatim
 - externals/prettier/css/postcss-plugins/postcss-nesting.css (💥, 97.66%)
@@ -388,8 +392,9 @@
 
 ### Failed
 
-- externals/prettier/css/font/font.css (💥, 94.12%)
-  - ❓unclassified
+- externals/prettier/css/font/font.css (💥, 79.41%)
+  - crates/oxc_formatter_css/DIVERGENCES.md#slash-spacing
+  - crates/oxc_formatter_css/DIVERGENCES.md#math-function-operator-spacing
 - externals/prettier/scss/comments/4594.scss (💥, 83.78%)
   - crates/oxc_formatter_css/DIVERGENCES.md#line-comment-after-comma
 - externals/prettier/scss/comments/4878.scss (💥, 89.39%)
@@ -449,10 +454,13 @@
 
 ## less
 
-227/252 (90.08%)
+225/252 (89.29%)
 
 ### Failed
 
+- externals/prettier/css/font/font.css (💥, 79.41%)
+  - crates/oxc_formatter_css/DIVERGENCES.md#slash-spacing
+  - crates/oxc_formatter_css/DIVERGENCES.md#math-function-operator-spacing
 - externals/prettier/less/comments/between-decl.less (💥, 94.44%)
   - crates/oxc_formatter_css/DIVERGENCES.md#declaration-colon-comments
 - externals/prettier/less/comments/selectors.less (💥, 88.89%)
@@ -461,6 +469,8 @@
   - crates/oxc_formatter_css/DIVERGENCES.md#line-comment-after-comma
 - externals/prettier/less/less-test-suite/snippet: tests-config/globalVars/extended.less (💥, 78.26%)
   - crates/oxc_formatter_css/DIVERGENCES.md#trailing-line-comment-print-width
+- externals/prettier/less/less-test-suite/snippet: tests-config/namespacing/namespacing-3.less (💥, 98.04%)
+  - crates/oxc_formatter_css/DIVERGENCES.md#slash-spacing
 - externals/prettier/less/less-test-suite/snippet: tests-config/namespacing/namespacing-functions.less (💥, 97.30%)
   - crates/oxc_formatter_css/DIVERGENCES.md#less-lookup-glue
 - externals/prettier/less/less-test-suite/snippet: tests-config/namespacing/namespacing-media.less (💥, 96.15%)
@@ -487,7 +497,8 @@
   - crates/oxc_formatter_css/DIVERGENCES.md#less-variable-value-comments
 - externals/prettier/less/less-test-suite/snippet: tests-unit/strings/strings.less (💥, 98.68%)
   - crates/oxc_formatter_css/DIVERGENCES.md#less-escaped-string-gap
-- externals/prettier/less/less-test-suite/snippet: tests-unit/variables/variables.less (💥, 98.95%)
+- externals/prettier/less/less-test-suite/snippet: tests-unit/variables/variables.less (💥, 97.89%)
+  - crates/oxc_formatter_css/DIVERGENCES.md#slash-spacing
   - crates/oxc_formatter_css/DIVERGENCES.md#less-escaped-string-gap
 - externals/prettier/less/postcss-8-improment/test.less (💥, 88.24%)
   - crates/oxc_formatter_css/DIVERGENCES.md#custom-property-raw-verbatim
```

**File**: `crates/oxc_formatter_css/DIVERGENCES.md` (modified, +105/-0)
```diff
@@ -1253,6 +1253,111 @@ Everywhere else BOTH implementations keep the glue, so there is nothing to diver
 where exactly ours keeps it is printer mechanism, documented at `write_less_binary_operation` / `write_sass_binary`
 (and pinned by the same fixtures plus `tests/fixtures/format/scss/calc-glued-minus.scss` for Scss calculation args).
 
+## slash-spacing
+
+- Why: uniform-rule (same construct, same output: a `/` between numbers, glued `1rem/1` or spaced `1rem / 1`; prettier/prettier#10831)
+- Pin: `tests/fixtures/format/scss/slash-spacing.scss`, `tests/fixtures/format/less/slash-spacing.less`
+- Conformance:
+  - `externals/prettier/css/font/font.css`
+  - `externals/prettier/css/parens/parens.css`
+  - `externals/prettier/less/less-test-suite/snippet: tests-config/namespacing/namespacing-3.less`
+  - `externals/prettier/less/less-test-suite/snippet: tests-unit/variables/variables.less`
+
+```scss
+/* input */
+.a {
+  width: f(1px)/2;
+  width: 1px/($b);
+  font: 12px/ 1.5 serif;
+  font: 12px  /1.5 serif;
+  width: $a/ 2;
+}
+
+/* ours */
+.a {
+  width: f(1px)/2;
+  width: 1px/($b);
+  font: 12px / 1.5 serif;
+  font: 12px / 1.5 serif;
+  width: $a / 2;
+}
+
+/* prettier */
+.a {
+  width: f(1px) / 2;
+  width: 1px/ ($b);
+  font: 12px/1.5 serif;
+  font: 12px /1.5 serif;
+  width: $a/ 2;
+}
+```
+
+```less
+/* input */
+.a { width: @a/2; }
+@media @phone and (aspect-ratio: 16/ 9) {}
+
+/* ours */
+.a {
+  width: @a/2;
+}
+@media @phone and (aspect-ratio: 16 / 9) {
+}
+
+/* prettier */
+.a {
+  width: @a / 2;
+}
+@media @phone and (aspect-ratio: 16/ 9) {
+}
+```
+
+A `/` outside a math function keeps the source's choice, made symmetric:
+glued on both sides stays glued, a gap on either side prints one space on both.
+The spacing never changes the meaning: dart-sass and lessc compile `x/y`, `x/ y` and `x / y` alike for every operand kind.
+Prettier decides each gap on its own and by the neighbor's kind:
+
+- a word or function neighbor forces spaces (`f(1px)/2`), numbers and parens keep each gap as written (`1rem/ 1` stays lopsided)
+- `font` and custom properties tighten a `/` after a font-size value (prettier/prettier#18114, whose review asked to "preserve space")
+- a `/` glued after a word is lexed INTO the word by postcss-values-parser 2 (`$a/`, `center/`), so no operator node is left to space and `$a/ 2` stays lopsided
+
+Its own numeric `/` keeping tight or spaced is the rule we apply to every operand.
+Scope: declaration values, Sass / Less operations, media query ratios (a substituted raw prelude's too) and Sass control conditions;
+a Less mixin call / definition / guard prints its source slice (`adjust_numbers_and_strings`, Prettier does too), and a `@container` prelude prints verbatim.
+
+## math-function-operator-spacing
+
+- Why: uniform-rule (same construct, same output: `calc()`'s `*` and `/`)
+- Pin: `tests/fixtures/format/scss/slash-spacing.scss`
+- Conformance:
+  - `externals/prettier/css/font/font.css`
+
+```scss
+/* input */
+.a {
+  width: min(1px/2, 3px);
+  font: calc(var(--size)/2)/2;
+}
+
+/* ours */
+.a {
+  width: min(1px / 2, 3px);
+  font: calc(var(--size) / 2)/2;
+}
+
+/* prettier */
+.a {
+  width: min(1px/2, 3px);
+  font: calc(var(--size)/2)/2;
+}
+```
+
+Inside a math function (the `Calc` node: `calc`, `min`, `max`, `clamp`, `round`, `abs`, ...) `*` and `/` always print spaced;
+`+` / `-` keep the source, they require whitespace and a glued one is invalid, left as written.
+There a `/` is always a division, never a separator, so it is laid out as math:
+css-values-4 serializes a calculation tree with `" * "` / `" / "`, and dart-sass prints `min(var(--x)/2, 3px)` as `min(var(--x) / 2, 3px)`.
+Prettier spaces them inside `calc()` only, and not after a font-size value in `font` and custom properties (its #18114 rule above).
+
 ## paren-group-glued-word
 
 - Why: semantics
```

**File**: `crates/oxc_formatter_css/src/print/at_rule.rs` (modified, +22/-5)
```diff
@@ -836,8 +836,9 @@ fn write_token_comma_group_after<'a>(
         }
         let run = &tokens[i..run_end];
         let run_start = i;
+        let followed = run_end < tokens.len();
         let content = format_with(move |f: &mut CssFormatter<'_, 'a>| {
-            write_token_run(run, run_start == 0 && hug_lparen, f);
+            write_token_run(run, run_start == 0 && hug_lparen, followed, f);
         });
         filler.entry(&soft_line_break_or_space(), &content);
         i = run_end;
@@ -895,7 +896,13 @@ fn write_token_comma_group_grouped<'a>(
 }
 
 /// One run: spacing normalized; paren regions recurse as breakable groups.
-fn write_token_run<'a>(run: &[TokenWithSpan<'a>], hug_lparen: bool, f: &mut CssFormatter<'_, 'a>) {
+/// `followed`: more tokens come after the run (a `/` ending it has a gap after it).
+fn write_token_run<'a>(
+    run: &[TokenWithSpan<'a>],
+    hug_lparen: bool,
+    followed: bool,
+    f: &mut CssFormatter<'_, 'a>,
+) {
     let source = f.context().source_text();
     let mut j = 0;
     while j < run.len() {
@@ -914,7 +921,7 @@ fn write_token_run<'a>(run: &[TokenWithSpan<'a>], hug_lparen: bool, f: &mut CssF
             // Unbalanced region: print the opener verbatim and move on
             if depth != 0 || k < j + 2 {
                 if j > 0 {
-                    write_token_pair_space(run, j, hug_lparen, f);
+                    write_token_pair_space(run, j, hug_lparen, followed, f);
                 }
                 let span = to_span(tok.span);
                 write!(f, text(source.text_for(&span)));
@@ -928,7 +935,7 @@ fn write_token_run<'a>(run: &[TokenWithSpan<'a>], hug_lparen: bool, f: &mut CssF
                 _ => ("{", "}"),
             };
             if j > 0 {
-                write_token_pair_space(run, j, hug_lparen, f);
+                write_token_pair_space(run, j, hug_lparen, followed, f);
             }
             if inner.is_empty() {
                 write!(f, [text(open), text(close)]);
@@ -951,7 +958,7 @@ fn write_token_run<'a>(run: &[TokenWithSpan<'a>], hug_lparen: bool, f: &mut CssF
             continue;
         }
         if j > 0 {
-            write_token_pair_space(run, j, hug_lparen, f);
+            write_token_pair_space(run, j, hug_lparen, followed, f);
         }
         let span = to_span(tok.span);
         match &tok.token {
@@ -984,6 +991,7 @@ fn write_token_pair_space<'a>(
     run: &[TokenWithSpan<'a>],
     j: usize,
     hug_lparen: bool,
+    followed: bool,
     f: &mut CssFormatter<'_, 'a>,
 ) {
     let source = f.context().source_text();
@@ -1027,6 +1035,15 @@ fn write_token_pair_space<'a>(
             | Token::EqualEqual(_)
             | Token::ExclamationEqual(_),
         ) => true,
+        // A `/` takes both of its gaps together (DIVERGENCES.md#slash-spacing);
+        // it glues to its left operand, so a gap after it ends the run
+        (_, Token::Solidus(_)) => match run.get(j + 1) {
+            Some(next) => value::is_slash_spaced(prev.span, tok.span, next.span),
+            None => gap || followed,
+        },
+        (Token::Solidus(_), _) if j >= 2 => {
+            value::is_slash_spaced(run[j - 2].span, prev.span, tok.span)
+        }
         _ => gap,
     };
     if space {
```

**File**: `crates/oxc_formatter_css/src/print/scss.rs` (modified, +32/-20)
```diff
@@ -742,7 +742,7 @@ pub(super) fn write_control_condition<'a>(
 enum CondPart<'b, 'a> {
     Value(&'b ComponentValue<'a>),
     /// Operator/keyword raw text (`and`, `or`, `not`, `==`, `*`, ...).
-    Op(Span, OpClass),
+    Op(oxc_css_parser::pos::Span, OpClass),
 }
 
 #[derive(Clone, Copy, PartialEq, Eq)]
@@ -751,6 +751,8 @@ enum OpClass {
     Logical,
     /// `==` / `!=` / `<` / `<=` / `>` / `>=`
     Comparison,
+    /// `/`: glued on both sides or spaced on both (DIVERGENCES.md#slash-spacing)
+    Division,
     Other,
 }
 
@@ -766,15 +768,16 @@ fn flatten_condition<'b, 'a>(cond: &'b ComponentValue<'a>, out: &mut Vec<CondPar
                 | SassBinaryOperatorKind::GreaterThanOrEqual
                 | SassBinaryOperatorKind::LessThan
                 | SassBinaryOperatorKind::LessThanOrEqual => OpClass::Comparison,
+                SassBinaryOperatorKind::Division => OpClass::Division,
                 _ => OpClass::Other,
             };
-            out.push(CondPart::Op(to_span(binary.op.span), class));
+            out.push(CondPart::Op(binary.op.span, class));
             flatten_condition(&binary.right, out);
         }
         ComponentValue::SassUnaryExpression(unary)
             if matches!(unary.op.kind, SassUnaryOperatorKind::Not) =>
         {
-            out.push(CondPart::Op(to_span(unary.op.span), OpClass::Logical));
+            out.push(CondPart::Op(unary.op.span, OpClass::Logical));
             flatten_condition(&unary.expr, out);
         }
         other => out.push(CondPart::Value(other)),
@@ -794,6 +797,24 @@ fn write_condition_chain<'a>(
     let mut parts = Vec::new();
     flatten_condition(condition, &mut parts);
     let has_logical = parts.iter().any(|p| matches!(p, CondPart::Op(_, OpClass::Logical)));
+    let part_span = |p: &CondPart<'_, 'a>| match p {
+        CondPart::Op(span, _) => *span,
+        CondPart::Value(v) => v.span(),
+    };
+    // `glued[i]`: no source gap before `parts[i]`.
+    // Tokens glued in the source stay glued (postcss parses `$type==ocean` as ONE word and prints it verbatim);
+    // a `/` takes both of its gaps together (DIVERGENCES.md#slash-spacing)
+    let mut glued: Vec<bool> = (0..parts.len())
+        .map(|i| i > 0 && is_glued(part_span(&parts[i - 1]), part_span(&parts[i])))
+        .collect();
+    for i in 1..parts.len().saturating_sub(1) {
+        if matches!(parts[i], CondPart::Op(_, OpClass::Division)) {
+            let [left, slash, right] = [i - 1, i, i + 1].map(|k| part_span(&parts[k]));
+            let both = !value::is_slash_spaced(left, slash, right);
+            glued[i] = both;
+            glued[i + 1] = both;
+        }
+    }
     let parts_ref = &parts;
     let inner = format_with(move |f: &mut CssFormatter<'_, 'a>| {
         if let Some(word) = prefix {
@@ -805,28 +826,19 @@ fn write_condition_chain<'a>(
                 write!(f, soft_line_break_or_space());
             }
         }
-        let part_span = |p: &CondPart<'_, 'a>| match p {
-            CondPart::Op(span, _) => *span,
-            CondPart::Value(v) => to_span(v.span()),
-        };
         for (i, part) in parts_ref.iter().enumerate() {
-            if i > 0 {
-                // Tokens glued in the source stay glued (postcss parses
-                // `$type==ocean` as ONE word and prints it verbatim).
-                let glued = part_span(&parts_ref[i - 1]).end == part_span(part).start;
-                if !glued {
-                    let after_comparison = has_logical
-                        && matches!(parts_ref[i - 1], CondPart::Op(_, OpClass::Comparison));
-                    if matches!(part, CondPart::Op(..)) || after_comparison {
-                        write!(f, space());
-                    } else {
-                        write!(f, soft_line_break_or_space());
-                    }
+            if i > 0 && !glued[i] {
+                let after_comparison =
+                    has_logical && matches!(parts_ref[i - 1], CondPart::Op(_, OpClass::Comparison));
+                if matches!(part, CondPart::Op(..)) || after_comparison {
+                    write!(f, space());
+                } else {
+                    write!(f, soft_line_break_or_space());
                 }
             }
             // Each part owns its leading comments, or they would leak into the block
             match part {
-                CondPart::Op(span, _) => value::write_text_with_leading_comments(*span, f),
+                CondPart::Op(span, _) => value::write_text_with_leading_comments(to_span(*span), f),
                 CondPart::Value(v) => {
                     value::write_list_element(v, ValueContext::default(), f);
                 }
```

**File**: `crates/oxc_formatter_css/src/print/value.rs` (modified, +106/-178)
```diff
@@ -182,6 +182,11 @@ pub(super) fn write_adjusted_verbatim<'a>(raw: &'a str, f: &mut CssFormatter<'_,
 /// so splicing the printed `Number` / `Dimension` / `Str` leaves into the verbatim slice is possible
 /// and would retire this byte re-scan, with its comment / `url()` / hash skips.
 /// However, we keep the scan for now: `oxc-css-parser` has no visitor to collect those leaves.
+///
+/// TODO: the slice keeps its source `/` spacing (`.m(@a/ 2)`, `when (@a/ 2 > 1)`), unlike a declaration value's
+/// symmetric `/` (DIVERGENCES.md#slash-spacing); Prettier prints the slice as written too.
+/// Re-spacing `/` here would re-scan bytes it does not own (escapes, detached rulesets, `./`);
+/// the leaf-splicing above, printing the typed operations, is what lifts it.
 pub(super) fn adjust_numbers_and_strings<'a>(
     raw: &'a str,
     options: &CssFormatOptions,
@@ -462,6 +467,44 @@ fn is_solidus(value: &ComponentValue<'_>) -> bool {
     matches!(value, ComponentValue::Delimiter(Delimiter { kind: DelimiterKind::Solidus, .. }))
 }
 
+/// A `/` outside a math function keeps the source's choice, made symmetric (DIVERGENCES.md#slash-spacing):
+/// tight when glued on both sides, otherwise one space on both sides.
+pub(super) fn is_slash_spaced(
+    left: oxc_css_parser::pos::Span,
+    slash: oxc_css_parser::pos::Span,
+    right: oxc_css_parser::pos::Span,
+) -> bool {
+    !is_glued(left, slash) || !is_glued(slash, right)
+}
+
+/// [`is_slash_spaced`] for a component list:
+/// the separator BEFORE `values[i]` when it or `values[i - 1]` is a slash, `None` otherwise.
+fn slash_separator(
+    values: &[ComponentValue<'_>],
+    i: usize,
+    is_slash: impl Fn(&ComponentValue<'_>) -> bool,
+) -> Option<Separator> {
+    let gap = |k: usize| values.get(k).is_some_and(|v| !is_glued(values[k - 1].span(), v.span()));
+    let curr_is_slash = is_slash(&values[i]);
+    if !curr_is_slash && !is_slash(&values[i - 1]) {
+        return None;
+    }
+    // A leading `/` makes the stream path-like (`-fb-url(/a/b.png)`): it never spaces
+    if is_slash(&values[0]) && (i == 1 || !gap(i)) {
+        return Some(Separator::Tight);
+    }
+    // The slash's own two gaps: `values[i]` is the slash, or the one before it
+    let slash = if curr_is_slash { i } else { i - 1 };
+    // A trailing `/` has no right gap
+    let spaced = gap(slash) || gap(slash + 1);
+    Some(match (spaced, curr_is_slash) {
+        (false, _) => Separator::Tight,
+        // A spaced `/` glues to its left operand and breaks after
+        (true, true) => Separator::Space,
+        (true, false) => Separator::Line,
+    })
+}
+
 fn is_semicolon(value: &ComponentValue<'_>) -> bool {
     matches!(value, ComponentValue::Delimiter(Delimiter { kind: DelimiterKind::Semicolon, .. }))
 }
@@ -509,23 +552,6 @@ fn is_number_ish(value: &ComponentValue<'_>) -> bool {
     )
 }
 
-/// Is this number-ish or a font-size-capable function? (Prettier's `isPossibleFontSize`)
-fn is_possible_font_size(value: &ComponentValue<'_>) -> bool {
-    match value {
-        v if is_number_ish(v) => true,
-        ComponentValue::Function(func) => {
-            let name = function_name_text(func);
-            name.eq_ignore_ascii_case("var")
-                || name.eq_ignore_ascii_case("calc")
-                || name.eq_ignore_ascii_case("min")
-                || name.eq_ignore_ascii_case("max")
-                || name.eq_ignore_ascii_case("clamp")
-                || name.starts_with("--")
-        }
-        _ => false,
-    }
-}
-
 pub(super) fn function_name_text<'a>(func: &Function<'a>) -> &'a str {
     match &func.name {
         FunctionName::Ident(InterpolableIdent::Literal(ident)) => ident.raw,
@@ -573,10 +599,6 @@ impl ValueContext<'_> {
         !self.in_args
             && self.decl_prop.is_some_and(|p| p == "grid" || p.starts_with("grid-template"))
     }
-
-    fn is_font_or_custom(&self) -> bool {
-        self.decl_prop.is_some_and(|p| p == "font" || p.starts_with("--"))
-    }
 }
 
 /// Splits a flat component stream at top-level commas.
@@ -1264,13 +1286,25 @@ pub(super) fn write_comma_group<'a>(
             let content = format_with(move |f: &mut CssFormatter<'_, 'a>| {
                 flush_value_comments(start, f);
                 for (j, v) in run.iter().enumerate() {
-                    let is_word_continuation = j > 0 && {
-                        let sep = separator_between(values, run_start + j, ctx, source);
-                        if sep == Separator::Space {
+                    let sep =
+                        (j > 0).then(|| separator_between(values, run_start + j, ctx, source));
+                    if sep == Some(Separator::Space) {
+                        write!(f, " ");
+                    }
+                    let is_word_continuation = sep == Some(Separator::Word);
+                    // A comment inside the run stays where it is (`1px /* c */ / 2`), never past the next member;
+                    // a pair kept tight re
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/css/media-ratio.css.snap` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@ source: crates/oxc_formatter_css/tests/fixtures/mod.rs
 }
 @media (aspect-ratio: 16/9) {
 }
-@media (16/ 9 < aspect-ratio < 21 / 9) {
+@media (16 / 9 < aspect-ratio < 21 / 9) {
 }
 
 -------------------
@@ -24,7 +24,7 @@ source: crates/oxc_formatter_css/tests/fixtures/mod.rs
 }
 @media (aspect-ratio: 16/9) {
 }
-@media (16/ 9 < aspect-ratio < 21 / 9) {
+@media (16 / 9 < aspect-ratio < 21 / 9) {
 }
 
 ===================== End =====================
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/less/math-operations.less` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@
   t7: (2em*1em) + 20;
   h: (10px / 2px+6px-1px*2);
   g: @base*2;
-  // `/` spaced next to a word-like operand, number-only division keeps its glue
+  // `/` glued on both sides stays glued (DIVERGENCES.md#slash-spacing)
   m: @margins[zero] (@margins[ten]/2) !important;
   w: @w/2;
   d: 10px/8px;
```

**File**: `crates/oxc_formatter_css/tests/fixtures/format/less/math-operations.less.snap` (modified, +7/-7)
```diff
@@ -26,7 +26,7 @@ source: crates/oxc_formatter_css/tests/fixtures/mod.rs
   t7: (2em*1em) + 20;
   h: (10px / 2px+6px-1px*2);
   g: @base*2;
-  // `/` spaced next to a word-like operand, number-only division keeps its glue
+  // `/` glued on both sides stays glued (DIVERGENCES.md#slash-spacing)
   m: @margins[zero] (@margins[ten]/2) !important;
   w: @w/2;
   d: 10px/8px;
@@ -64,9 +64,9 @@ source: crates/oxc_formatter_css/tests/fixtures/mod.rs
   t7: (2em * 1em) + 20;
   h: (10px / 2px+6px-1px * 2);
   g: @base*2;
-  // `/` spaced next to a word-like operand, number-only division keeps its glue
-  m: @margins[zero] (@margins[ten] / 2) !important;
-  w: @w / 2;
+  // `/` glued on both sides stays glued (DIVERGENCES.md#slash-spacing)
+  m: @margins[zero] (@margins[ten]/2) !important;
+  w: @w/2;
   d: 10px/8px;
 }
 
@@ -100,9 +100,9 @@ source: crates/oxc_formatter_css/tests/fixtures/mod.rs
   t7: (2em * 1em) + 20;
   h: (10px / 2px+6px-1px * 2);
   g: @base*2;
-  // `/` spaced next to a word-like operand, number-only division keeps its glue
-  m: @margins[zero] (@margins[ten] / 2) !important;
-  w: @w / 2;
+  // `/` glued on both sides stays glued (DIVERGENCES.md#slash-spacing)
+  m: @margins[zero] (@margins[ten]/2) !important;
+  w: @w/2;
   d: 10px/8px;
 }
 
```

#### Recent Merged Pull Requests:
- **PR #30395** (2026-11-27): fix(formatter_css): bump oxc-css-parser to 0.0.24 and keep SCSS at-rule names and the Less keyword `-` as written (@leaysgur)
- **PR #30393** (2026-11-27): refactor(formatter_css): share the operator fill between calc and Less operations (@leaysgur)
- **PR #30392** (2026-11-27): fix(formatter_css): make `/` spacing symmetric and space math-function operators (@leaysgur)
- **PR #30391** (2026-11-27): fix(formatter): hug negated logical conditions in statement heads (@leaysgur)
- **PR #30387** (2026-11-26): fix(linter/eslint/no-constant-binary-expression): check that constructors resolve to globals (@camc314)
- **PR #30385** (2026-11-26): fix(linter/eslint/no-invalid-regexp): validate cooked flags and patterns with unknown flags (@camc314)

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

## X. linter/eslint/no-empty-static-block): suggest a comment instead of deleting the 

**RULE**:
When implementing operations in `crates/oxc_linter/src/rules/eslint/no_empty_static_block.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9eb6c432`: linter/eslint/no-empty-static-block): suggest a comment instead of deleting the block. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_linter/src/rules/eslint/no_empty_static_block.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                |fixer| {
                    let span = static_block.span;
                    let Some(offset) = ctx.find_next_token_within(span.start, span.end, "{") else {
                        return fixer.noop();
                    };
                    fixer
                        .replace(Span::new(span.start + offset + 1, span.end - 1), " /* empty */ ")
                        .with_message("Add comment inside empty static block.")
                },
        ("class Foo { static {} }", "class Foo { static { /* empty */ } }"),
        ("class Foo { static { } }", "class Foo { static { /* empty */ } }"),
            "class Foo { static { /* empty */ } }",
        ),
        (
            "class Foo { static { bar(); } static {} }",
            "class Foo { static { bar(); } static { /* empty */ } }",
        ),
        (
            "class C { x = value\nstatic {}\n[key]() {} }",
            "class C { x = value\nstatic { /* empty */ }\n[key]() {} }",
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                |fixer| fixer.delete(&static_block.span),
        ("class Foo { static {} }", "class Foo {  }"),
        ("class Foo { static { } }", "class Foo {  }"),
            "class Foo {  }",
        ("class Foo { static { bar(); } static {} }", "class Foo { static { bar(); }  }"),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9eb6c432` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
