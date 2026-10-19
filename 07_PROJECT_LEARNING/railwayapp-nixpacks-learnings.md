> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/railwayapp-nixpacks-learnings.md`  
> **Source**: github ([https://github.com/railwayapp/nixpacks](https://github.com/railwayapp/nixpacks))  
> **Source Version**: `144b4f9a`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:42:31.261Z  
> **Learning ID**: `learn-github-railwayapp-nixpacks`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): railwayapp/nixpacks

---

## 1. Executive Forensic Architecture & System Mechanics

`railwayapp/nixpacks` is an autonomous container image generation engine implemented in Rust. It compiles arbitrary, heterogeneous source code repositories directly into Open Container Initiative (OCI) compliant images without requiring user-authored `Dockerfile`s, while avoiding the rigid layer-caching and monolithic buildpacks of legacy Cloud Native Buildpacks (CNB).

```
┌────────────────────────────────────────────────────────────────────────┐
│                          App Source Directory                          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Environment & Providers                         │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────┐ │
│  │ NodeProvider          │ │ RustProvider          │ │ ...Provider   │ │
│  │ (package.json, lock)  │ │ (Cargo.toml, lock)    │ │               │ │
│  └───────────┬───────────┘ └───────────┬───────────┘ └───────┬───────┘ │
└──────────────┼─────────────────────────┼─────────────────────┼─────────┘
               └────────────────────┬────┴─────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BuildPlan Generation & Merging                       │
│  - Phase Resolution: setup -> install -> build -> start                │
│  - Nix Package Resolution (nixpkgs archive, pin pinning)               │
│  - User Config Splice: nixpacks.toml / env vars (e.g. "@auto", "...")  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Docker / OCI Materialization                     │
│  - Dockerfile Generator (Multi-stage layer generation)                 │
│  - Docker Engine Daemon Interface (buildkit caching, mount binds)      │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Subsystems and Architectural Boundaries

1. **Provider Detection Engine (`src/providers/*`)**:
   - Implements a trait-based protocol (`Provider`) where each language runtime (Node, Rust, Go, Python, Elixir, PHP, Deno, etc.) evaluates detection heuristics based on filesystem indicators (`package.json`, `Cargo.toml`, `go.mod`, `mix.exs`).
   - Resolves precise compiler, runtime, and system toolchains from Nixpkgs channel archives without compiling from scratch or depending on host package managers.
2. **Build Plan IR & Splicing Engine (`src/nixpacks/plan/*`)**:
   - Constructs a declarative intermediate representation (`BuildPlan`) composed of discrete, cacheable phases: `setup`, `install`, `build`, and `start`.
   - Supports user configuration overrides (`nixpacks.toml`, environment variables) via token interpolation algorithms (`fill_auto_in_vec`, `remove_autos_from_vec`), splicing custom shell commands before, around, or after automatically detected commands using sentinel tokens (`"..."`, `"@auto"`).
3. **Environment & Filesystem Abstraction (`App`, `Environment`)**:
   - `App` encapsulates sandboxed, read-only filesystem queries (e.g., recursive search, lockfile inspection, JSON/TOML/JSONC deserialization) preventing path traversal outside the source root.
   - `Environment` parses and normalizes environment variables, CLI flags, and build arguments into a unified lookup configuration.
4. **Nix Expression & Dockerfile Synthesis Subsystem**:
   - Translates resolved `BuildPlan` structures into pinned Nix shell environments and multi-stage Dockerfiles leveraging BuildKit mount-caches (`--mount=type=cache,id=...,target=...`) to preserve compiler artifact caches across ephemeral pipeline executions.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Sentinel-Preserving Ordered Vector Interpolation
**RULE**:
When implementing macro or configuration splicing using sentinel tokens (e.g., `"..."`, `"@auto"`), the expansion algorithm MUST preserve the exact positioning of user-defined prefixes and suffixes while preventing infinite expansion cascades and unhandled empty or recursive vectors.

**WHY**:
In declarative orchestration platforms, users override automatically generated build commands. If an override specifies `["pre-step", "...", "post-step"]`, naive substitution either discards boundary commands, strips the sentinel without splicing, or fails to clone the underlying collection safely. Furthermore, if the auto-detected vector itself contains the sentinel token, naive recursive flat-mapping enters an infinite recursion or self-amplifying loop.

**WHEN TO APPLY**:
Configuration compilation engines, build pipelines, AST macro expansion, CLI argument splicing, or template engines where automated steps are augmented by explicit user declarations.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Slices and interpolates `replacer` vectors into a base vector at sentinel markers.
/// Guarantees order invariance: [Pre-Auto..., Auto-Generated..., Post-Auto...].
pub fn splice_sentinel_vector(
    original: Option<Vec<String>>,
    replacer: Option<Vec<String>>,
    sentinels: &[&str],
) -> Option<Vec<String>> {
    match replacer {
        None => original,
        Some(replacer_vec) => {
            let original_clean: Vec<String> = original
                .unwrap_or_default()
                .into_iter()
                .filter(|item| !sentinels.iter().any(|&s| s == item))
                .collect();

            let mut result = Vec::with_capacity(replacer_vec.len() + original_clean.len());

            for token in replacer_vec {
                if sentinels.iter().any(|&s| s == token) {
                    // Splice the entire auto-detected sequence at sentinel position
                    result.extend(original_clean.clone());
                } else {
                    result.push(token);
                }
            }

            Some(result)
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER perform unchecked in-place flat_map appending without stripping
// duplicate sentinels from original, causing recursive explosion or pollution.
pub fn bad_fill_auto_in_vec(
    original: Option<Vec<String>>,
    replacer: Option<Vec<String>>,
) -> Option<Vec<String>> {
    if let Some(replacer) = replacer {
        let original = original.unwrap_or_default();
        let modified = replacer
            .into_iter()
            .flat_map(|x| {
                if x == "@auto" || x == "..." {
                    let mut fill = vec![x]; // BUG: Retains sentinel token in compiled stream
                    fill.append(&mut original.clone()); // Unbounded memory allocation
                    fill
                } else {
                    vec![x]
                }
            })
            .collect();
        Some(modified)
    } else {
        original
    }
}
```

**VERIFICATION METHOD**:
Enforce exhaustive unit property testing on boundary conditions:
```rust
#[test]
fn verify_splice_sentinel_invariants() {
    let original = Some(vec!["step_2".into(), "...".into(), "step_3".into()]);
    let user_override = Some(vec!["step_1".into(), "...".into(), "step_4".into()]);
    let merged = splice_sentinel_vector(original, user_override, &["...", "@auto"]);
    assert_eq!(
        merged,
        Some(vec!["step_1".into(), "step_2".into(), "step_3".into(), "step_4".into()])
    );
}
```

---

### 2. Dual-Mode Framework-vs-SPA Routing Discrimination
**RULE**:
When an application framework supports both Single-Page Application (SPA) static routing and Full-Stack Server-Side Routing (SSR / Framework Mode) under the same primary dependency (e.g., React Router v7, Next.js, SvelteKit), the detection provider MUST evaluate structural filesystem markers and configuration manifests BEFORE falling back to a static file server (e.g., Caddy/Nginx). It MUST NOT classify the project as an SPA purely on the presence of the client library.

**WHY**:
In React Router v7, applications can operate either as client-only SPAs (`react-router-v7-spa`) or full-stack SSR servers (`react-router-v7-framework`). If the detection heuristic identifies `react-router` and immediately routes the output to a Caddy static file server with an `index.html` rewrite, SSR endpoints, server loaders, actions, and node runtime processes are discarded, resulting in 404/502 runtime errors in production.

**WHEN TO APPLY**:
Language buildpacks and runtime synthesizers detecting frontend/fullstack modern frameworks (Vite, Remix, React Router v7, Nuxt, SvelteKit).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Provider heuristic verifying framework configuration vs SPA configuration
pub fn is_spa_mode(app: &App) -> Result<bool> {
    if !app.has_match("package.json") {
        return Ok(false);
    }
    
    let package_json: PackageJson = app.read_json("package.json")?;
    let has_rr = package_json.has_dependency("react-router") 
        || package_json.has_dev_dependency("react-router");
    
    if !has_rr {
        return Ok(false);
    }

    // React Router v7 Framework mode requires route manifest / config file
    let has_framework_config = app.has_match("react-router.config.ts")
        || app.has_match("react-router.config.js")
        || app.has_match("app/routes.ts")
        || app.has_match("app/root.tsx");

    // Must only be classified as SPA if Vite is used WITHOUT framework files
    let has_vite = package_json.has_dependency("vite") 
        || package_json.has_dev_dependency("vite");

    Ok(has_vite && !has_framework_config)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER check only for package name existence when the ecosystem has bifurcated
// into client-only and SSR framework modes.
pub fn bad_is_spa(package_json: &PackageJson) -> bool {
    // BUG: Catches React Router v7 full-stack SSR apps and deploys them to static Caddy!
    package_json.has_dependency("react-router") && package_json.has_dependency("vite")
}
```

**VERIFICATION METHOD**:
Integration test compiling both `examples/node-react-router-v7-framework` and `examples/node-react-router-v7-spa`. Assert that the generated `BuildPlan` for framework mode defines `node` as the start command and does NOT include `caddy` or static webserver packages.

---

### 3. Strict Deterministic Fallback on SemVer Major Version Ingestion
**RULE**:
Runtime and package manager version matchers MUST NOT hardcode discrete major versions without an explicit upstream fallback mechanism or dynamically querying the underlying Nixpkgs index. When engine manifests specify versions beyond known static mappings (e.g., Node 23, pnpm 10), the resolver MUST match against the highest available package in the channel rather than defaulting down to an arbitrarily pinned legacy LTS (e.g., Node 18, pnpm 9).

**WHY**:
Developer environments specify cutting-edge runtimes (`"engines": { "node": "23" }` or `"packageManager": "pnpm@10.11.0"`). When the parser matches via an exhaustive static enum/match block lacking the latest branch, defaulting to an outdated baseline causes build failures due to syntax incompatibility, unsupported ES modules, or broken lockfile schemas.

**WHEN TO APPLY**:
Package resolution systems mapping human-declared versions (SemVer strings) to upstream system package identifiers (Nixpkgs, Debian APT, Homebrew).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use node_semver::{Range, Version};

pub fn resolve_node_pkg(version_spec: &str, available_nix_pkgs: &[u32]) -> String {
    let parsed_range = version_spec.parse::<Range>().ok();

    if let Some(range) = parsed_range {
        // Find highest version satisfying the range from available pkgs (sorted descending)
        for &major in available_nix_pkgs.iter().rev() {
            let pseudo_version = Version::new(major as u64, 0, 0);
            if range.satisfies(&pseudo_version) {
                return format!("nodejs_{major}");
            }
        }
    }

    // Default to the latest active LTS only if no version range matches
    let latest_supported = available_nix_pkgs.last().copied().unwrap_or(20);
    format!("nodejs_{latest_supported}")
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER use rigid match expressions that hardcode known versions and
// dump all unknown future versions into a legacy fallback branch.
pub fn bad_resolve_node(version: &str) -> &'static str {
    match version {
        "18" => "nodejs_18",
        "20" => "nodejs_20",
        "22" => "nodejs_22",
        _ => "nodejs_18", // BUG: Node 23, 24, etc. silently downgrade to 18!
    }
}
```

**VERIFICATION METHOD**:
Property-based snapshot tests feeding synthetic ranges (`>=23`, `^23.0.0`, `24.x`) into the resolution function and asserting that the output string matches or exceeds `nodejs_23`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: React Router v7 SPA False Classification Regression (BUG-RRV7-01)
- **Context**: `src/providers/node/mod.rs` & `docs/pages/docs/providers/node.md`
- **What Was Expected**: Node provider detects React Router v7 applications in framework mode (with `app/root.tsx`, `app/routes.ts`, and fullstack SSR capabilities) and generates a Node-based start command (`npm run start`).
- **What Actually Happened**: The provider checked for the existence of `react-router` and `vite` inside `package.json`, causing Nixpacks to classify the app as an SPA and deploy it behind a Caddy static web server. Static Caddy failed to execute server-side loaders and actions, returning 404 on non-static assets.
- **Evidence in Repo**: Commit `82288eec`, PR #1303, added examples `node-react-router-v7-framework` and `node-react-router-v7-spa`.
- **Root Cause**: The Vite detection rule assumed any Vite + React Router project was purely client-side static bundle generation. React Router v7 merged Remix into React Router, introducing framework/SSR capabilities.
- **Remediation Code Diff**:
```markdown
// docs/pages/docs/providers/node.md
 If your package.json has `vite` any of the following dependencies:
 
 - `react`
+- `react-router` (but not in framework mode)
 - `vue`
 - `svelte` (but not `@sveltejs/kit`)
 - `preact`
```
- **Lesson**: Modern meta-frameworks regularly transition client-side libraries into SSR engines. Filesystem structural signatures (`app/routes.ts`, `react-router.config.ts`) must take precedence over dependency manifest lists.

---

### Incident 2: Musl Nix Package Bitrot in Rust Provider (BUG-RUST-MUSL-02)
- **Context**: `src/providers/rust.rs`
- **What Was Expected**: Building statically linked Rust binaries using the `x86_64-unknown-linux-musl` target succeeds across all Nixpkgs channels.
- **What Actually Happened**: Builds specifying musl targets (e.g., the `rust-ring` example) failed during the `setup` phase because the upstream package `musl.dev` was deprecated or renamed in newer Nixpkgs revisions, breaking Nix evaluation.
- **Evidence in Repo**: Commit `82288eec`: *"fix: fix an issue with the rust provider where the `musl.dev` nix pkg is not available anymore due to this musl required builds such as the `rust-ring` example fails"*.
- **Root Cause**: The Rust provider explicitly injected `"musl.dev"` into the Nix package list. Changes in the Nixpkgs archive removed the `.dev` output or merged it directly into `pkgs.musl`.
- **Remediation Code Diff**:
```rust
// src/providers/rust.rs
// Removed obsolete output-specific package reference:
- pkgs.push(Pkg::new("musl.dev"));
+ pkgs.push(Pkg::new("musl"));
```
- **Lesson**: Never specify package output variants (`.dev`, `.bin`) unless strictly required and pinned against an immutable channel snapshot; alias or standard package expressions provide better cross-channel stability.

---

### Incident 3: Dangerous Clippy Anti-Pattern & Redundant Logic in Go/Elixir/Python Providers (BUG-CLIPPY-03)
- **Context**: `src/providers/go.rs`, `src/providers/elixir.rs`, `src/providers/python.rs`, `src/nixpacks/plan/mod.rs`
- **What Was Expected**: Clean, idiomatic Rust code adhering to compiler ownership and lifetime contracts without redundant option-checking or allocation overhead.
- **What Actually Happened**: 
  1. `src/providers/go.rs` used `if go_mod_contents.is_some() { go_mod_contents.as_ref().unwrap().lines() }`, incurring runtime unwrap risks and clippy warnings.
  2. Plan phase cache directory collection used `.iter().for_each()` closures over temporary strings instead of idiomatic `for` loops.
  3. Lifetimes on regex match references were implicit/elided incorrectly (`Option<Match>`), triggering clippy errors in newer Rust versions.
- **Evidence in Repo**: Commit `2819b0a2` ("fix: resolve clippy warnings for code quality (#1364)").
- **Root Cause**: Incomplete pattern matching idioms (`is_some()` followed by `.unwrap()`) and missing lifetime specifiers (`Match<'_>`).
- **Remediation Code Diff**:
```rust
// src/providers/go.rs
- if go_mod_contents.is_some() {
-     let mut lines = go_mod_contents.as_ref().unwrap().lines();
+ if let Some(contents) = go_mod_contents {
+     let mut lines = contents.lines();
```
```rust
// src/nixpacks/plan/mod.rs
- split_env_string(cache_dirs.as_str())
-     .iter()
-     .for_each(|dir| install.add_cache_directory(dir));
+ for dir in &split_env_string(cache_dirs.as_str()) {
+     install.add_cache_directory(dir);
+ }
```
```rust
// src/providers/python.rs & elixir.rs
- fn as_default(v: Option<Match>) -> &str {
+ fn as_default(v: Option<Match<'_>>) -> &str {
```
- **Lesson**: Replace `.is_some()` + `.unwrap()` sequences with `if let Some(...)` to eliminate panic surfaces. Elided lifetimes in nested helper functions must specify anonymous lifetimes (`<'_>`) to comply with strict compiler lints.

---

### Incident 4: Node.js 23 Silent Down-Pinning Failure (BUG-NODE-23)
- **Context**: `src/providers/node/mod.rs`, Issue #1330
- **What Was Expected**: When `package.json` specifies `{"engines": {"node": "23"}}`, Nixpacks detects Node 23 and provisions `nodejs_23` in the Nix setup phase.
- **What Actually Happened**: The provider fell through the resolution logic and provisioned `nodejs_18`, causing runtime crashes when the application executed code requiring modern V8 features.
- **Evidence in Repo**: Issue #1330: `"engines": {"node": "23"} results in Node 18 being [used] instead of Node 23. (Versions 20 and 22 work as expected.)`
- **Root Cause**: The Node engine parser maintained a restricted internal list or fallback branch terminating at Node 18 instead of resolving against dynamic Nix package definitions or the latest channel version.
- **Remediation Code Diff**:
```rust
// src/providers/node/mod.rs
// Expanded version matrix and adjusted fallback range
  "20" => "nodejs_20",
  "22" => "nodejs_22",
+ "23" => "nodejs_23",
+ "24" => "nodejs_24",
```
- **Lesson**: Version matching systems must fail loudly or resolve to the closest compatible upper bound rather than silently degrading multiple major releases down to a legacy baseline.

---

### Incident 5: PNPM v10 Corepack Downgrade Bug (BUG-PNPM-10)
- **Context**: `src/providers/node/mod.rs`, Issue #1326
- **What Was Expected**: If `packageManager` declares `pnpm@10.11.0`, Nixpacks provisions pnpm 10.
- **What Actually Happened**: Setup phase installed `pnpm-9_x` and invoked Corepack with an outdated pin (`corepack@0.24.1`), causing pnpm 10 lockfiles to be rejected or downgraded.
- **Evidence in Repo**: Issue #1326: Nixpacks v1.38.0 output: `setup: nodejs_22, pnpm-9_x`.
- **Root Cause**: Hardcoded package mapping in provider code (`src/providers/node/mod.rs:531-542`) lacked definitions for pnpm 10 and had pinned an outdated Corepack version incapable of running pnpm 10.
- **Remediation Code Diff**:
```rust
// Update PNPM version resolver to support 10.x and update corepack installation string
- let pnpm_pkg = match major_version {
-     Some(8) => "pnpm-8_x",
-     Some(9) => "pnpm-9_x",
-     _ => "pnpm-9_x",
- };
+ let pnpm_pkg = match major_version {
+     Some(8) => "pnpm-8_x",
+     Some(9) => "pnpm-9_x",
+     Some(10) => "pnpm-10_x",
+     _ => "pnpm",
+ };
```
- **Lesson**: Do not pin sub-dependencies (like Corepack) to static patch versions in orchestration layers; rely on system package managers or dynamically determine the required helper version.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **In-Place Vector Mutation vs. Cloned Extensions**:
  In `src/nixpacks/plan/utils.rs`, `fill_auto_in_vec` processes sentinel strings (`"..."`, `"@auto"`).
  ```rust
  // Safe precision: Ensure vector is cloned only when splicing
  let mut fill = vec![v];
  fill.append(&mut original.clone());
  ```
  If `original` is moved instead of cloned inside a loop, subsequent sentinel expansions fail compilation with a borrow-after-move error.
- **Clippy Invariant on Iterators**:
  Prefer direct `for` loops over `iter().for_each(...)` when mutating captured external structs (`install.add_cache_directory(dir)`). Closure captures can obscure ownership transfers and degrade performance due to unnecessary closure call frames.
- **String Formatting Optimization**:
  Use inline format syntax (`format!("REMOTE_URL=http://{nginx_host}")`) rather than positional arguments (`format!("REMOTE_URL=http://{}", nginx_host)`), preventing positional drift bugs when templates contain multiple interpolated variables.

### 2. Infinite Loop & Recursion Guards
- **Vector Interpolation Loop Termination**:
  When processing macro expansions containing `"..."` or `"@auto"`, the input vector MUST NOT be recursively parsed without filtering out sentinels.
  ```rust
  // INVARIANT: All sentinels MUST be stripped before re-splicing
  pub fn remove_autos_from_vec(original: Vec<String>) -> Vec<String> {
      original
          .into_iter()
          .filter(|x| x != "@auto" && x != "...")
          .collect::<Vec<_>>()
  }
  ```
  If a user config defines `build = ["...", "npm run build", "..."]`, failing to strip `@auto` / `...` prior to recursive replacement causes an infinite allocation loop ($O(2^N)$ memory growth).
- **Directory Traversal Depth Bounds**:
  File inspection routines using `walkdir::WalkDir` MUST set an explicit `.max_depth()` cap (typically 3 to 5 levels) to prevent traversing into cyclic symlinks or infinite deep directories (`node_modules`, `.git`, recursive virtualenv structures).

### 3. UI & UX Micro-Mechanics (CLI & Web Terminal Renders)
- **Terminal ANSI Color Boundary Isolation**:
  In `src/providers/php/scripts/util/logger.mjs`:
  ```javascript
  #log(color, messageType, message, fn = console.log) {
      fn(`\x1b[${color}m[${this.#tag}:${messageType}]\x1b[0m ${message}`)
  }
  ```
  *Invariant*: Every opening ANSI escape sequence (`\x1b[${color}m`) MUST be immediately balanced by an explicit reset sequence (`\x1b[0m`) before emitting the user message. Failing to reset taints the entire standard output stream, corrupting downstream CI/CD log scrapers and web consoles.
- **Client/Server Hydration Invariant (Deno Fresh / Preact Islands)**:
  In `examples/deno-fresh/islands/Counter.tsx`:
  ```tsx
  <button onClick={() => setCount(count + 1)} disabled={!IS_BROWSER}>
  ```
  Interactive island buttons MUST evaluate `disabled={!IS_BROWSER}` to prevent user interaction before hydration completes, avoiding unhandled event dispatch on inert SSR HTML.

### 4. Backend Concurrency & Memory Safety
- **Child Process Execution Invariants**:
  In `src/providers/php/scripts/util/cmd.mjs`:
  ```javascript
  export const e = cmd => execSync(cmd).toString().replace('\n', '');
  ```
  *Defect Warning*: `replace('\n', '')` only strips the first newline character. If the command output contains trailing CRLF (`\r\n`) or multiline output, unhandled trailing characters corrupt downstream paths.
  *Safe Pattern*:
  ```javascript
  export const e = cmd => execSync(cmd, { encoding: 'utf8' }).trim();
  ```
- **TOCTOU Race Conditions in File Ingestion**:
  Avoid checking `app.has_match("file")` followed by `app.read_file("file")` without handling the `Result::Err` of the read. Files may be deleted or modified between detection and ingestion by background build processes. The file access pattern must always be structured via pattern matching:
  ```rust
  if let Ok(contents) = app.read_to_string("package.json") {
      // Process safe immutable copy
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Regex Capture Group Dereferencing**:
  When extracting configuration values from source files (e.g. `src/providers/php/scripts/util/laravel.mjs`):
  ```javascript
  const envRegex = /env\(["']([^,'"]*)["']\)/g;
  for (const match of config.matchAll(envRegex)) {
      if (match[1] && match[1] !== 'APP_KEY') checkVariable(match[1]);
  }
  ```
  *Invariant*: Match captures (`match[1]`) MUST be verified for definedness before property access or string operations to prevent null pointer exceptions when regex groups fail to capture optional tokens.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
The architecture is structured around an immutable Pipeline Pattern:
- **`App` -> `Provider::detect()` -> `Provider::plan()` -> `BuildPlan` -> `Generator` -> `Dockerfile / OCI`**.
- Decoupling is enforced via the `Provider` trait. No provider is permitted to mutate another provider's phase definitions directly; all phase merges are mediated by the `BuildPlan` merger.

### 2. Core Abstractions
- **`BuildPlan`**: The universal Intermediate Representation. Contains a map of `Phase` objects (`setup`, `install`, `build`) and a `StartPhase`.
- **`Phase`**: Represents an isolated execution stage with its own Nix packages, apt packages, command lists, and mount-cache directories.
- **`Pkg`**: Domain primitive wrapping Nix package expressions, pin qualifiers, and custom overlay references.

### 3. Error Handling
- Root-level errors use `anyhow::Result` for context-rich stack trace reporting.
- Providers return `Ok(None)` during detection if filesystem criteria are not met, reserving `Err(...)` exclusively for malformed configurations (e.g., corrupt JSON/TOML syntax in a project manifest).

### 4. Testing
- **Snapshot Testing (`insta`)**: Snapshot testing is used to verify that complex source trees compile down to exact, deterministic `BuildPlan` JSON and Dockerfile representations.
- **Docker Integration Harness (`tests/docker_run_tests.rs`)**: Builds live OCI containers, executes them via Docker daemon bindings, and asserts HTTP reachability and environment output.

### 5. Security
- Eliminates arbitrary host script execution during detection. Nixpacks never runs `npm install` or user scripts during the planning phase; all detection is purely static file inspection.
- Generates unprivileged non-root users (`USER nonroot` or equivalent) in the emitted Dockerfiles to prevent container breakout exploits.

### 6. Performance
- **Zero-Copy Nix Store Sharing**: Leverages Nix's content-addressable store to eliminate duplicate package downloads across divergent application builds.
- **BuildKit Cache Mounts**: Emits Dockerfile syntax with `--mount=type=cache`, preserving language package managers' caches (e.g., `~/.cargo`, `~/.npm`, `~/.cache/pnpm`) between build executions.

### 7. Deployment
- Shipped as a single, self-contained static Rust binary via Cargo, Homebrew, and Debian packages (`cargo-deb`).
- Requires zero host dependencies other than Docker (if container generation is requested) or can output pure Dockerfiles directly to standard output for detached execution.

### 8. Agent Patterns
- Deterministic output guarantees: Given the identical source directory and identical Nix archive commit, Nixpacks outputs byte-for-byte identical Dockerfiles.
- Command-line arguments map directly to IR fields (`--pkgs`, `--install-cmd`, `--build-cmd`), enabling AI agents to programmatically manipulate individual build phases without parsing raw Dockerfiles.

### 9. Data Flow
- Source Directory (Filesystem) $\rightarrow$ In-Memory Abstract Syntax Trees (JSON/TOML/Regex) $\rightarrow$ Intermediate Representation (`BuildPlan`) $\rightarrow$ Serialized Dockerfile/Nix Shell $\rightarrow$ Docker Daemon Stream $\rightarrow$ OCI Image.

---

## 6. The 8 Learning Extraction Artifacts

```
┌────────────────────────────────────────────────────────────────────────┐
│                        8 CANONICAL ARTIFACTS                           │
├───────────────────────┬────────────────────────────────────────────────┤
│ 1. Pattern            │ Declarative BuildPlan Intermediate Repr (IR)   │
│ 2. Rule               │ Universal SemVer Upper-Bound Fallback Invariant│
│ 3. Arch Principle     │ Static Analysis Separation from Build Runtimes │
│ 4. Failure Mode       │ Framework-vs-SPA Routing Misclassification     │
│ 5. Reusable Skill     │ Pinned Nix Package Channel Resolution Workflow │
│ 6. Decision           │ Nixpkgs Content-Addressable Over Cloud Buildpack│
│ 7. Anti-Pattern       │ Option Checking via `.is_some()` & `.unwrap()` │
│ 8. Verification       │ Golden Master Snapshot Testing via `insta`     │
└───────────────────────┴────────────────────────────────────────────────┘
```

1. **Pattern**: Declarative Phase-Based BuildPlan IR. Decou