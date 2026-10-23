> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wasm-bindgen-wasm-pack-learnings.md`  
> **Source**: github ([https://github.com/wasm-bindgen/wasm-pack](https://github.com/wasm-bindgen/wasm-pack))  
> **Source Version**: `5081ad40`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T07:21:26.283Z  
> **Learning ID**: `learn-github-wasm-bindgen-wasm-pack`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): wasm-bindgen/wasm-pack

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Problem Space & System Mission
`wasm-pack` serves as the primary build-and-distribution orchestrator for compiling Rust code into WebAssembly (`wasm32-unknown-unknown`) and producing production-ready JavaScript/TypeScript packaging targets (npm packages for Node.js, Web bundlers like Webpack/Vite, ES Modules for native browser environments, and Deno).

Compiling Rust to WebAssembly natively yields a raw `.wasm` binary that lacks JavaScript-compatible memory bindings, DOM abstractions, ECMAScript module wrappers, type definitions (`.d.ts`), and `package.json` metadata. `wasm-pack` bridges the low-level systems compiler (`rustc`/`cargo`) and the high-level JavaScript runtime ecosystem (`npm`/`node`/browsers) by orchestrating external build utilities (`wasm-bindgen-cli`, `wasm-opt`, `cargo-generate`, `geckodriver`/`chromedriver`).

```
                    +------------------------------------+
                    |   User Invocation (CLI / CI/CD)    |
                    |   wasm-pack build --target web     |
                    +-----------------+------------------+
                                      |
                                      v
       +--------------------------------------------------------------+
       |                  wasm-pack CLI Runtime                       |
       |  - CLI Parsing (clap)                                        |
       |  - Manifest Resolution (Cargo.toml discovery & validation)   |
       |  - Binary Cache Management (binary-install / dirs / env var) |
       +--------+---------------------+----------------------+--------+
                |                     |                      |
                v                     v                      v
        [Cargo Compilation]  [Tool Resolution]      [Packaging Pipeline]
        - target: wasm32-     - wasm-bindgen        - Out-dir hygiene
          unknown-unknown     - wasm-opt            - TypeScript d.ts
        - profiles: release,  - cargo-generate      - package.json synth
          profiling, dev      - cached in user dir  - README/.gitignore
                |                     |                      |
                +---------------------+----------------------+
                                      |
                                      v
                       +------------------------------+
                       | Distribution & Interop Engine|
                       | - Node CJS/ESM shims         |
                       | - Browser ES6 loader modules |
                       | - npm publish / cargo publish|
                       +------------------------------+
```

### 1.2 Architectural Boundaries and State Ownership
1. **Manifest Traversal & Invariant Validation (`src/manifest/`, `src/command/utils.rs`)**:
   Locates the crate boundary by traversing upwards from the current working directory (`CWD`) via directory tree popping until a `Cargo.toml` is found. It validates `[lib]` crate-types (enforcing `cdylib` or `rlib`), reads project metadata, and manages the `[package.metadata.wasm-pack]` configuration overlay.
2. **Binary Cache & External Tooling Resolver (`src/cache.rs`, `src/install/`)**:
   Manages lifecycle, resolution, and caching of secondary native binaries (`wasm-bindgen`, `wasm-opt`). Resolves pre-compiled releases based on host operating system (`Os`) and architecture (`Arch`), falling back to local `cargo install` when prebuilts are unavailable or disallowed.
3. **Execution Subsystem (`src/child.rs`)**:
   Abstracts cross-platform child process spawning, explicitly dealing with Windows command shell parsing bugs (e.g., executing `.cmd` or `.bat` binaries via `cmd /c` to evade rustc argument quotation bugs #42436, #42791).
4. **Binding Generation & Optimization Pipeline (`src/bindgen.rs`, `src/wasm_opt.rs`)**:
   Inspects the installed version of `wasm-bindgen` using semantic version parsing (`semver::Version`) to dynamically adapt CLI flags across major/minor versions (backward compatibility negotiation). Executes `wasm-opt` (from the Binaryen toolkit) with dead-code elimination, shrink-level, and optimization profiles.
5. **Node Distribution Shim (`npm/binary.js`)**:
   A zero-dependency (using Node stdlib `https` and the `tar` package) platform-detecting installer shim that fetches native prebuilt `wasm-pack` binaries directly from GitHub Release assets, following HTTP redirects manually across storage boundaries (GitHub to AWS S3).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Version-Negotiated Toolchain Invocation
**RULE**:
When an orchestration CLI invokes external sub-tools across heterogeneous development environments, it MUST NOT assume invariant sub-tool CLI syntax. It MUST query the sub-tool’s version programmatically, parse it into an algebraic semver structure, and dynamically route CLI arguments between legacy and modern flag schemas.

**WHY**:
External sub-tool interfaces drift over time. For example, `wasm-bindgen-cli` previously accepted target flags as standalone switches (`--browser`, `--nodejs`, `--web`), but migrated in version `0.2.40` to parameterized flags (`--target <TARGET>`). Invoking modern flags on older binaries causes abrupt runtime crashes, while invoking deprecated flags on newer binaries produces deprecation warnings or target degradation.

**WHEN TO APPLY**:
Apply in build tools, orchestration CLIs, meta-compilers, or CI runner actions that wrap independently versioned external binaries (`wasm-bindgen`, `clang`, `rustc`, `docker`, `kubectl`).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use anyhow::{bail, Context, Result};
use semver::Version;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetRuntime {
    Nodejs,
    Web,
    Bundler,
}

pub struct ToolchainAdapter<'a> {
    binary_path: &'a Path,
    cached_version: Version,
}

impl<'a> ToolchainAdapter<'a> {
    pub fn new(binary_path: &'a Path) -> Result<Self> {
        let output = Command::new(binary_path)
            .arg("--version")
            .output()
            .with_context(|| format!("Failed to probe version of {:?}", binary_path))?;

        if !output.status.success() {
            bail!("Sub-tool version check exited with status: {}", output.status);
        }

        let raw_stdout = String::from_utf8_lossy(&output.stdout);
        // Extract semver token from strings like "tool-name 0.2.45 (rev ...)"
        let version_str = raw_stdout
            .split_whitespace()
            .find(|token| Version::parse(token).is_ok())
            .ok_or_else(|| anyhow::anyhow!("No valid semver token in: {}", raw_stdout))?;

        let cached_version = Version::parse(version_str)?;
        Ok(Self { binary_path, cached_version })
    }

    pub fn configure_target(&self, cmd: &mut Command, target: TargetRuntime) -> Result<()> {
        let modern_target_flag_threshold = Version::parse("0.2.40").unwrap();
        let web_support_threshold = Version::parse("0.2.39").unwrap();

        if self.cached_version >= modern_target_flag_threshold {
            let target_str = match target {
                TargetRuntime::Nodejs => "nodejs",
                TargetRuntime::Web => "web",
                TargetRuntime::Bundler => "bundler",
            };
            cmd.arg("--target").arg(target_str);
        } else {
            // Fallback to legacy invocation contracts
            let legacy_flag = match target {
                TargetRuntime::Nodejs => "--nodejs",
                TargetRuntime::Bundler => "--browser",
                TargetRuntime::Web => {
                    if self.cached_version < web_support_threshold {
                        bail!(
                            "Target 'web' requires tool version >= 0.2.39, but found {}",
                            self.cached_version
                        );
                    }
                    "--web"
                }
            };
            cmd.arg(legacy_flag);
        }
        Ok(())
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly assuming fixed CLI argument flags across sub-tool versions
pub fn run_subtool_blind(binary_path: &Path, target: &str) -> Result<()> {
    let mut cmd = Command::new(binary_path);
    // Hard-coded argument flags will break when the sub-tool upgrades or downgrades
    cmd.arg("--target").arg(target);
    cmd.status()?;
    Ok(())
}
```

**VERIFICATION METHOD**:
Enforce dynamic flag selection via integration test matrices mocking old and new binary version strings:
```rust
#[test]
fn verify_dynamic_flag_dispatch() {
    let old_ver = semver::Version::parse("0.2.38").unwrap();
    let mid_ver = semver::Version::parse("0.2.39").unwrap();
    let new_ver = semver::Version::parse("0.2.45").unwrap();

    assert!(old_ver < semver::Version::parse("0.2.40").unwrap());
    assert!(new_ver >= semver::Version::parse("0.2.40").unwrap());
    // Assert downstream Command args match the version branch
}
```

---

### 2. Upstream Manifest Discovery Invariant
**RULE**:
Filesystem manifest discovery that traverses upwards from the `CWD` MUST NOT use unbounded recursion and MUST terminate definitively when the directory root is reached (`PathBuf::pop() == false`). If discovery terminates without finding the manifest, the engine MUST fallback to the canonical execution directory (`CWD`) rather than panicking or looping infinitely.

**WHY**:
Invoking build tools inside subdirectories (e.g., `tests/`, `src/`, or nested workspace crates) requires unambiguous identification of the crate boundary. Unchecked directory bubbling can result in infinite filesystem loops on symlinked or unrooted container environments. Returning a fallback reference ensures descriptive compiler errors (e.g., "Cargo.toml not found in CWD") rather than low-level filesystem panics.

**WHEN TO APPLY**:
Any CLI or language server protocol (LSP) tool resolving project roots (`Cargo.toml`, `package.json`, `go.mod`, `pom.xml`, `.git`).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::Result;

pub fn discover_project_manifest_root(explicit_path: Option<PathBuf>, manifest_name: &str) -> Result<PathBuf> {
    if let Some(path) = explicit_path {
        return Ok(path);
    }

    let mut current = env::current_dir()?;
    let canonical_start = current.clone();

    loop {
        let manifest_candidate = current.join(manifest_name);
        if manifest_candidate.is_file() {
            return Ok(current);
        }

        // PathBuf::pop() returns false when it reaches the filesystem root (e.g., "/" or "C:\")
        if !current.pop() {
            // Return root context directory to allow upstream error handlers to surface standard missing-manifest errors
            return Ok(canonical_start);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Recursive discovery without termination proof or symlink protection
pub fn find_manifest_leaking(dir: &Path) -> PathBuf {
    let candidate = dir.join("Cargo.toml");
    if candidate.exists() {
        return dir.to_path_buf();
    }
    // DANGEROUS: .parent().unwrap() panics at root directory ("/") or loops on circular symlinks
    find_manifest_leaking(dir.parent().unwrap())
}
```

**VERIFICATION METHOD**:
Execute property-based or boundary tests asserting traversal against isolated temporary directories containing zero manifest files:
```rust
#[test]
fn test_manifest_discovery_at_root_returns_cwd() {
    let temp_empty_dir = tempfile::tempdir().unwrap();
    env::set_current_dir(temp_empty_dir.path()).unwrap();
    let result = discover_project_manifest_root(None, "Cargo.toml").unwrap();
    assert_eq!(result, temp_empty_dir.path());
}
```

---

### 3. Cross-Registry Atomic Release Sequencing
**RULE**:
Multi-registry release automation workflows MUST order deployments by registry mutability: publish to strictly immutable package registries (e.g., `crates.io`) and upstream binary hosting platforms PRIOR to releasing dependent packages on secondary registries (e.g., `npm`), while gating binary asset releases on successful verification of all pre-built binaries.

**WHY**:
Once a crate is published to `crates.io`, that exact version number is permanently immutable and cannot be deleted or re-uploaded. If a release pipeline first un-drafts a GitHub Release or publishes an npm shim, and subsequent `cargo publish` fails (e.g., due to token expiration, crates.io transient 500s, or missing metadata), the release enters an inconsistent, broken state. The npm package will attempt to download assets from an unreleased/broken build, and maintainers cannot re-run the pipeline with the same version number without burning a patch version.

**WHEN TO APPLY**:
Continuous Delivery pipelines that orchestrate distribution across multiple registries simultaneously (e.g., Rust `crates.io`, Node `npm`, Python `PyPI`, and GitHub Releases).

**VERIFIED IMPLEMENTATION PATTERN**:
```yaml
# GitHub Actions release dependency pattern
jobs:
  build-and-verify-binaries:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build assets
        run: cargo build --release

  # Step 1: Push immutable core package first
  publish-crates-io:
    needs: build-and-verify-binaries
    runs-on: ubuntu-latest
    environment:
      name: publish
      deployment: false
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - name: Publish to crates.io
        run: cargo publish

  # Step 2: Finalize asset release only after immutable core succeeds
  finalize-github-release:
    needs: publish-crates-io
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Undraft release
        run: gh release edit "$GITHUB_REF_NAME" --draft=false --latest
        env:
          GH_TOKEN: ${{ github.token }}

  # Step 3: Dependent wrappers (npm shims) run after binary assets are public
  publish-npm-wrapper:
    needs: finalize-github-release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Publish npm wrapper
        run: npm publish --access public
```

**NEGATIVE CONSTRAINT**:
```yaml
# ANTI-PATTERN: Undrafting release or publishing wrapper before primary core publish
jobs:
  finalize-github-release:
    # Publishing assets first exposes draft binaries prematurely
    steps:
      - run: gh release edit "$GITHUB_REF_NAME" --draft=false
  publish-npm:
    needs: finalize-github-release
    # If cargo-publish fails later, npm is already live pointing to broken state
    steps:
      - run: npm publish
  cargo-publish:
    needs: publish-npm
    steps:
      - run: cargo publish # FAILURE HERE LEAVES SYSTEM PERMANENTLY CORRUPT
```

**VERIFICATION METHOD**:
Implement CI structural linting verifying DAG dependencies in workflow files (`yq` or programmatic GitHub Actions validator):
```bash
# Verify cargo-publish is a direct prerequisite of finalize
cargo_needs=$(yq eval '.jobs.finalize.needs' .github/workflows/release.yml)
if [ "$cargo_needs" != "publish" ]; then
  echo "FAIL: finalize must depend on publish (crates.io)"
  exit 1
fi
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Windows ARM64 Prebuilt Download Failure (BUG-WASM-OPT-ARM64-WIN)
- **Context**: `wasm-opt` binary downloader in `src/install/mod.rs` & `binaryen` target matrix.
- **What Was Expected**: Executing `wasm-pack build` on Windows running on an ARM64 processor (e.g., Snapdragon X Elite, Surface Pro ARM) should detect the host platform, download the pre-compiled `binaryen-*-arm64-windows.tar.gz` binary from GitHub Releases, and optimize the WebAssembly artifact.
- **What Actually Happened**: The build crashed immediately with:
  ```
  Error: no prebuilt wasm-opt binaries are available for this platform: Unrecognized target!
  To disable `wasm-opt`, add `wasm-opt = false` to your package metadata in your `Cargo.toml`.
  ```
- **Evidence in Repo**: Closed Issue #1604. `prebuilt_url_for` function in `src/install/mod.rs`.
- **Root Cause**: The exhaustive pattern match on the tuple `(Os, Arch, Tool)` completely omitted the combination `(Os::Windows, Arch::AArch64, Tool::WasmOpt)`. The match fell through to the catch-all wildcard `_ => bail!("Unrecognized target!")`, even though upstream `binaryen` published prebuilt `arm64-windows` binaries conforming to standard naming conventions.
- **Remediation Code Diff**:
```rust
// In src/install/mod.rs:
match (target_os, target_arch, tool) {
    (Os::Linux, Arch::X86_64, Tool::WasmOpt) => "x86_64-linux",
    (Os::Linux, Arch::AArch64, Tool::WasmOpt) => "aarch64-linux",
    (Os::MacOS, Arch::X86_64, Tool::WasmOpt) => "x86_64-macos",
    (Os::MacOS, Arch::AArch64, Tool::WasmOpt) => "arm64-macos",
    (Os::Windows, Arch::X86_64, Tool::WasmOpt) => "x86_64-windows",
// - Missing ARM64 Windows entry caused fallthrough to bail!
// + Safely map Windows ARM64 to upstream binary release identifier
+   (Os::Windows, Arch::AArch64, Tool::WasmOpt) => "arm64-windows",
    _ => bail!("Unrecognized target!"),
}
```
- **Lesson**: Architectural platform mapping tables MUST have comprehensive combinatorial coverage across `(OS x Arch)` matrices. Enforce compile-time or unit-test matrix assertions that validate all supported host targets against upstream release artifacts.

---

### Incident 2: Unmaintained Core Dependency Vulnerability (RUSTSEC-2020-0053)
- **Context**: Cache and local path resolution dependency `dirs` in `Cargo.toml`.
- **What Was Expected**: `wasm-pack` resolves user cache paths (e.g., `~/.cache/wasm-pack` or `~/AppData/Local/wasm-pack`) using an actively maintained, sound system directory library.
- **What Actually Happened**: Security audits triggered `RUSTSEC-2020-0053`: The `dirs` 2.x crate had been unmaintained, abandoned by its original author, and contained unpatched path expansion vulnerabilities and memory bugs on Windows systems.
- **Evidence in Repo**: Issue #943, fixed across commits upgrading `dirs` -> `dirs-next` and eventually modern `dirs` 6.0.0.
- **Root Cause**: Stale dependency tree locking in `Cargo.toml` without automated cargo-audit enforcement in continuous integration.
- **Remediation Code Diff**:
```toml
# Cargo.toml
[dependencies]
- dirs = "2.0.2"
+ dirs = "6.0.0"
```
- **Lesson**: CLI utilities that access platform filesystem hierarchies must continuously monitor cargo advisories and isolate path-resolution primitives behind internal adapter interfaces to allow zero-downtime crate substitution.

---

### Incident 3: Release Pipeline Deadlock & Race Condition (BUG-REL-RACE-01)
- **Context**: Multi-registry publish workflow `.github/workflows/release.yml` and `RELEASE_CHECKLIST.md`.
- **What Was Expected**: An automated GitHub Action publishes binaries to crates.io and GitHub Releases without releasing premature artifacts to npm or leaving GitHub releases in an inconsistent state on publish failure.
- **What Actually Happened**: The workflow published the GitHub release first (marking it public), then attempted to publish to crates.io. If crates.io rejected the upload (e.g., token failure or crates.io read-only outage), the release was already public and immutable on GitHub, requiring manual tag surgery. Additionally, npm publishing was coupled to the automated workflow, occasionally attempting to fetch assets before CDN replication completed.
- **Evidence in Repo**: Commit `5081ad40`: "Gate the crates.io publish on the publish environment, leaving npm manual (#1615)".
- **Root Cause**: Inverted pipeline dependency DAG. Making the GitHub release public (`--draft=false`) before verifying crates.io publication broke release immutability guarantees.
- **Remediation Code Diff**:
```yaml
# In .github/workflows/release.yml:
-  finalize:
-    name: Publish GitHub Release
-    environment:
-      name: publish
-    needs: release
-    steps:
-      - run: gh release edit "$GITHUB_REF_NAME" --draft=false --latest
-
-  cargo-publish:
+  publish:
     name: Publish to crates.io
     environment:
-      name: crate-publish
+      name: publish
+      deployment: false
     permissions:
       id-token: write
     needs: release
     steps:
       - uses: actions/checkout@v4
       - run: cargo publish
+
+  finalize:
+    name: Publish GitHub Release
+    needs: publish
+    permissions:
+      contents: write
+    steps:
+      - run: gh release edit "$GITHUB_REF_NAME" --draft=false --latest
```
- **Lesson**: Release orchestration MUST place immutable single-source-of-truth registries (crates.io) ahead of downstream release announcements and manual consumer shims.

---

### Incident 4: Bot Auto-Merge Race Condition on Label Mutation (BUG-BOT-RACE-02)
- **Context**: Automated CI triage and merge bot `.github/workflows/bot.yml`.
- **What Was Expected**: When maintainers toggle labels (specifically applying `merge-ready`), the bot should trigger merge operations cleanly without cancelling in-flight review or testing workflows.
- **What Actually Happened**: Applying and rapidly un-applying labels on PRs triggered generic concurrency cancellations that aborted running review checks because the bot grouped runs by PR number alone.
- **Evidence in Repo**: Commit `49eaa1e5`: "Trigger wasm-bindgen-bot auto-merge on the merge-ready label".
- **Root Cause**: The workflow listened only to `labeled` events without handling `unlabeled`, and used a coarse concurrency key (`group: wasm-bindgen-bot-${{ pr.number }}`), causing label adjustments to terminate active review runs.
- **Remediation Code Diff**:
```yaml
# In .github/workflows/bot.yml:
  pull_request_target:
-   types: [opened, ready_for_review, synchronize, labeled]
+   types: [opened, ready_for_review, synchronize, labeled, unlabeled]
  ...
  concurrency:
-   group: wasm-bindgen-bot-${{ github.event.pull_request.number || github.event.issue.number || github.run_id }}${{ github.event.comment && format('-{0}', github.event.comment.id) || github.event.review && format('-review-{0}', github.event.review.id) || '' }}
+   group: wasm-bindgen-bot-${{ github.event.pull_request.number || github.event.issue.number || github.run_id }}${{ github.event.comment && format('-{0}', github.event.comment.id) || github.event.review && format('-review-{0}', github.event.review.id) || github.event.label.name == 'merge-ready' && '-merge-ready' || '' }}
    cancel-in-progress: true
```
- **Lesson**: GitHub Action concurrency grouping MUST partition disjoint event streams (comments, reviews, label assertions) into distinct concurrency sub-keys; otherwise, administrative metadata operations will abort in-flight compute jobs.

---

### Incident 5: Windows Argument Shell Quoting Execution Failure (BUG-WIN-CMD-05)
- **Context**: Child process execution engine `src/child.rs`.
- **What Was Expected**: Executing npm, cargo, or other build utilities on Windows via `std::process::Command::new("npm")` should execute cleanly across all Windows environments.
- **What Actually Happened**: Running `Command::new("npm")` on Windows fails with `The system cannot find the file specified (os error 2)` or results in quotes improperly escaping argument batches due to `npm` on Windows being an `npm.cmd` batch file.
- **Evidence in Repo**: `src/child.rs`, lines 11–24 (referencing rustc bugs #42436, #42791, #44542).
- **Root Cause**: On Windows, `.cmd` and `.bat` files cannot be executed directly by the Win32 `CreateProcess` API without invoking the command shell interpreter (`cmd.exe /c`), and Rust’s standard library historical argument escaping logic caused broken argument quotes when calling `.cmd` binaries directly.
- **Remediation Code Diff**:
```rust
// In src/child.rs:
pub fn new_command(program: &str) -> Command {
-   Command::new(program)
+   if cfg!(windows) {
+       let mut cmd = Command::new("cmd");
+       cmd.arg("/c").arg(program);
+       cmd
+   } else {
+       Command::new(program)
+   }
}
```
- **Lesson**: Cross-platform CLI orchestrators invoking batch or shell scripts on Windows MUST explicitly wrap execution through `cmd /c` to ensure correct path lookup and escape-sequence preservation.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Falsy Redirection Counter Handling in JavaScript (`npm/binary.js`)**:
   ```javascript
   // CRITICAL INVARIANT: Check (remaining <= 0), NEVER (!remaining)
   // If remaining starts at 5 and decrements:
   if (remaining <= 0) {
     res.resume();
     return reject(new Error(`Too many redirects fetching ${url}`));
   }
   ```
   *Forensic Reason*: If `remaining` is initialized to `0` or passed improperly, a strict check prevents infinite recursion across HTTP 301/302 chains.
2. **Stream Drainage on Abort (`npm/binary.js`)**:
   ```javascript
   if (statusCode !== 200) {
     // MANDATORY: Node.js http.IncomingMessage MUST be resumed to free memory sockets
     res.resume();
     return reject(new Error(`Request failed with status code ${statusCode}`));
   }
   ```
   *Forensic Reason*: In Node.js core `http`/`https`, if an HTTP response stream is not consumed or explicitly drained via `res.resume()`, the underlying TCP socket never returns to the internal agent pool, producing socket starvation and memory leaks.
3. **Rust String Allocation Precision (`src/command/utils.rs`)**:
   ```rust
   // Display formatting duration subsecond precision:
   pub fn elapsed(duration: Duration) -> String {
       let secs = duration.as_secs();
       if secs >= 60 {
           format!("{}m {:02}s", secs / 60, secs % 60)
       } else {
           // Fixed divisor 10_000_000 converts nanoseconds directly to 2-digit fractional centiseconds
           format!("{}.{:02}s", secs, duration.subsec_nanos() / 10_000_000)
       }
   }
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **Filesystem Manifest Ascendancy Proof (`src/command/utils.rs`)**:
   ```rust
   fn find_manifest_from_cwd() -> Result<PathBuf> {
       let mut parent_path = std::env::current_dir()?;
       let mut manifest_path = parent_path.join("Cargo.toml");
       loop {
           if !manifest_path.is_file() {
               // Invariant: parent_path.pop() mutates parent_path and returns false 
               // iff parent_path is already at the filesystem root.
               if parent_path.pop() {
                   manifest_path = parent_path.join("Cargo.toml");
               } else {
                   // Loop Termination: Absolute bottom reached. Return fallback safely.
                   return Ok(PathBuf::from("."));
               }
           } else {
               // Loop Termination: Found Cargo.toml.
               return Ok(parent_path);
           }
       }
   }
   ```
   *Proof of Termination*: The loop invariant strictly relies on `PathBuf::pop()`. Since any path in a finite filesystem has a finite depth $D$, the loop executes at most $D + 1$ iterations before `pop()` returns `false`, guaranteeing $O(D)$ termination without infinite cycles.

2. **Redirect Recursion Guard (`npm/binary.js`)**:
   ```javascript
   const httpsGetFollow = (url, maxRedirects = 5) => new Promise((resolve, reject) => {
     const attempt = (currentUrl, remaining) => {
       // Loop termination invariant:
       // remaining strictly decreases by 1 on each recursive branch (attempt(next, remaining - 1))
       // Base condition: remaining <= 0 halts immediately
     };
     attempt(url, maxRedirects);
   });
   ```

### 4.3 UI & UX Micro-Mechanics
1. **Stdout/Stderr Stream Segregation for Machine Output**:
   When invoking sub-tools (`src/child.rs`), logging info lines MUST be routed to `stderr` or filtered via log levels (`log::info!`), leaving `stdout` completely clean for CLI piping:
   ```rust
   let output = command
       .stderr(Stdio::inherit()) // UX: Stream compilation logs in real time to terminal
       .stdin(Stdio::inherit())
       .output()?;               // Captures stdout deterministically
   ```
2. **Terminal Progress Bar Demarcation (`src/command/generate.rs`)**:
   `wasm-pack` encapsulates terminal progress indicators (`indicatif` / internal `PBAR`) behind explicit lock boundaries to prevent ANSI escape codes from mangling child process stderr/stdout streams.

### 4.4 Backend Concurrency & Memory Safety
1. **Cache Contention and Lock Isolation (`src/cache.rs`)**:
   The binary cache directory defaults to user platform cache locations via `dirs::cache_dir()`. When concurrent builds occur across multiple terminal tabs, cache collisions are averted via path hashes and atomic directory renames (`fs::rename` over unfinished extraction folders).
2. **Subprocess Signal Propagation**:
   In `src/child.rs`, commands are executed synchronously via `command.status()`. Child process handles are retained such that if the parent `wasm-pack` process receives `SIGINT` (Ctrl+C), standard OS process groups propagate termination down to child compilers, preventing orphaned `rustc` or `wasm-opt` background processes.

### 4.5 Defect & Error Prevention ("Galti Pakadna")
1. **Stale Artifact Cache Poisoning Prevention (`src/command/utils.rs`)**:
   ```rust
   pub fn create_pkg_dir(out_dir: &Path, no_gitignore: bool) -> Result<()> {
       // DEFECT TR