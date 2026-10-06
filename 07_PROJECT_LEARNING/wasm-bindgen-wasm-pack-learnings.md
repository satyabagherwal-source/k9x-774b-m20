# Forensic Learning Record (Deep Inspection): wasm-bindgen/wasm-pack

> **Canonical Artifact**: `07_PROJECT_LEARNING/wasm-bindgen-wasm-pack-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wasm-bindgen/wasm-pack](https://github.com/wasm-bindgen/wasm-pack))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:06:15.383Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wasm-bindgen/wasm-pack`
- **Description**: 📦✨ your favorite rust -> wasm workflow tool!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7281 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/command/utils.rs`
```
//! Utility functions for commands.
#![allow(clippy::redundant_closure)]

use anyhow::Result;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use walkdir::WalkDir;

/// If an explicit path is given, then use it, otherwise assume the current
/// directory is the crate path.
pub fn get_crate_path(path: Option<PathBuf>) -> Result<PathBuf> {
    match path {
        Some(p) => Ok(p),
        None => find_manifest_from_cwd(),
    }
}

/// Search up the path for the manifest file from the current working directory
/// If we don't find the manifest file then return back the current working directory
/// to provide the appropriate error
fn find_manifest_from_cwd() -> Result<PathBuf> {
    let mut parent_path = std::env::current_dir()?;
    let mut manifest_path = parent_path.join("Cargo.toml");
    loop {
        if !manifest_path.is_file() {
            if parent_path.pop() {
                manifest_path = parent_path.join("Cargo.toml");
            } else {
                return Ok(PathBuf::from("."));
            }
        } else {
            return Ok(parent_path);
        }
    }
}

/// Construct our `pkg` directory in the crate.
pub fn create_pkg_dir(out_dir: &Path, no_gitignore: bool) -> Result<()> {
    let _ = fs::remove_file(out_dir.join("package.json")); // Clean up package.json from previous runs
    fs::create_dir_all(&out_dir)?;
    if !no_gitignore {
        fs::write(out_dir.join(".gitignore"), "*")?;
    }
    Ok(())
}

/// Locates the pkg directory from a specific path
/// Returns None if unable to find the 'pkg' directory
pub fn find_pkg_directory(path: &Path, pkg_directory: &Path) -> Option<PathBuf> {
    if is_pkg_directory(path, pkg_directory) {
        return Some(path.to_owned());
    }

    WalkDir::new(path)
        .into_iter()
        .filter_map(|x| x.ok().map(|e| e.into_path()))
        .find(|x| is_pkg_directory(&x, pkg_directory))
}

fn is_pkg_directory(path: &Path, pkg_directory: &Path) -> bool {
    path.exists() && path.is_dir() && path.ends_with(pkg_directory)
}

/// Render a `Duration` to a form suitable for display on a console
pub fn elapsed(duration: Duration) -> String {
    let secs = duration.as_secs();

    if secs >= 60 {
        format!("{}m {:02}s", secs / 60, secs % 60)
    } else {
        format!("{}.{:02}s", secs, duration.subsec_nanos() / 10_000_000)
    }
}

```

### Core Architecture Module: `wasm-pack-template/src/utils.rs`
```
pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

```

### Core Architecture Module: `npm/binary.js`
```
// Minimal install/run shim for the wasm-pack binary release tarball.
//
// Replaces the deprecated `binary-install` package and its old transitive
// deps (axios, rimraf@3, glob@7, inflight). Uses Node stdlib for HTTPS
// (follows redirects manually) plus the actively maintained `tar` package
// for extraction.

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { spawnSync } = require("child_process");
const tar = require("tar");

const WINDOWS_TARGET = "x86_64-pc-windows-msvc";

const getPlatform = () => {
  const type = os.type();
  const arch = os.arch();

  // https://github.com/nodejs/node/blob/c3664227a83cf009e9a2e1ddeadbd09c14ae466f/deps/uv/src/win/util.c#L1566-L1573
  if ((type === "Windows_NT" || type.startsWith("MINGW32_NT-")) && arch === "x64") {
    return WINDOWS_TARGET;
  }
  if (type === "Linux" && arch === "x64") return "x86_64-unknown-linux-musl";
  if (type === "Linux" && arch === "arm64") return "aarch64-unknown-linux-musl";
  if (type === "Darwin" && arch === "x64") return "x86_64-apple-darwin";
  if (type === "Darwin" && arch === "arm64") return "aarch64-apple-darwin";

  throw new Error(`Unsupported platform: ${type} ${arch}`);
};

const getConfig = () => {
  const platform = getPlatform();
  const version = require("./package.json").version;
  const binaryName = platform === WINDOWS_TARGET ? "wasm-pack.exe" : "wasm-pack";
  const url = `https://github.com/wasm-bindgen/wasm-pack/releases/download/v${version}/wasm-pack-v${version}-${platform}.tar.gz`;
  const installDirectory = path.join(__dirname, "binary");
  return {
    binaryName,
    binaryPath: path.join(installDirectory, binaryName),
    installDirectory,
    url,
  };
};

// Follow up to a small number of redirects manually. GitHub release asset
// URLs redirect to S3, and `https.get` doesn't follow redirects on its own.
const httpsGetFollow = (url, maxRedirects = 5) => new Promise((resolve, reject) => {
  const attempt = (currentUrl, remaining) => {
    https.get(currentUrl, (res) => {
      const { statusCode, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        if (remaining <= 0) {
          res.resume();
          return reject(new Error(`Too many redirects fetching ${url}`));
        }
        res.resume();
        const next = new URL(headers.location, currentUrl).toString();
        return attempt(next, remaining - 1);
      }
      if (statusCode !== 200) {
        res.resume();
        return reject(new Error(`Request failed with status code ${statusCode}`));
      }
      resolve(res);
    }).on("error", reject);
  };
  attempt(url, maxRedirects);
});

const downloadAndExtract = async (url, installDirectory) => {
  const stream = await httpsGetFollow(url);
  await new Promise((resolve, reject) => {
    stream
      .pipe(tar.x({ strip: 1, C: installDirectory }))
      .on("finish", resolve)
      .on("error", reject);
  });
};

const install = async () => {
  const { binaryPath, installDirectory, url } = getConfig();

  if (fs.existsSync(binaryPath)) {
    console.error("wasm-pack is already installed, skipping installation.");
    return;
  }

  fs.rmSync(installDirectory, { recursive: true, force: true });
  fs.mkdirSync(installDirectory, { recursive: true });

  console.error(`Downloading release from ${url}`);
  try {
    await downloadAndExtract(url, installDirectory);
  } catch (e) {
    console.error(`Error fetching release: ${e.message}`);
    process.exit(1);
  }
  console.error("wasm-pack has been installed!");
};

const run = async () => {
  const { binaryPath } = getConfig();

  if (!fs.existsSync(binaryPath)) {
    await install();
  }

  const args = process.argv.slice(2);
  const result = spawnSync(binaryPath, args, { cwd: process.cwd(), stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message || result.error);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
};

module.exports = { install, run };

```

### Core Architecture Module: `npm/install.js`
```
#!/usr/bin/env node

const { install } = require("./binary");
install().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

```

### Core Architecture Module: `npm/run.js`
```
#!/usr/bin/env node

const { run } = require("./binary");
run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

```

### Core Architecture Module: `src/bindgen.rs`
```
//! Functionality related to running `wasm-bindgen`.

use crate::child;
use crate::command::build::{BuildProfile, Target};
use crate::install::{self, Tool};
use crate::manifest::CrateData;
use anyhow::{bail, Context, Result};
use semver;
use std::path::Path;
use std::process::Command;

/// Run the `wasm-bindgen` CLI to generate bindings for the current crate's
/// `.wasm`.
pub fn wasm_bindgen_build(
    wasm_path: &str,
    data: &CrateData,
    install_status: &install::Status,
    out_dir: &Path,
    out_name: &Option<String>,
    disable_dts: bool,
    weak_refs: bool,
    reference_types: bool,
    target: Target,
    profile: BuildProfile,
) -> Result<()> {
    let out_dir = out_dir.to_str().unwrap();

    let dts_arg = if disable_dts {
        "--no-typescript"
    } else {
        "--typescript"
    };
    let bindgen_path = install::get_tool_path(install_status, Tool::WasmBindgen)?
        .binary(&Tool::WasmBindgen.to_string())?;

    let mut cmd = Command::new(&bindgen_path);
    cmd.arg(&wasm_path)
        .arg("--out-dir")
        .arg(out_dir)
        .arg(dts_arg);

    if weak_refs {
        cmd.arg("--weak-refs");
    }

    if reference_types {
        cmd.arg("--reference-types");
    }

    let target_arg = build_target_arg(target, &bindgen_path)?;
    if supports_dash_dash_target(&bindgen_path)? {
        cmd.arg("--target").arg(target_arg);
    } else {
        cmd.arg(target_arg);
    }

    if let Some(value) = out_name {
        cmd.arg("--out-name").arg(value);
    }

    let profile = data.configured_profile(profile);
    if profile.wasm_bindgen_debug_js_glue() {
        cmd.arg("--debug");
    }
    if !profile.wasm_bindgen_demangle_name_section() {
        cmd.arg("--no-demangle");
    }
    if profile.wasm_bindgen_dwarf_debug_info() {
        cmd.arg("--keep-debug");
    }
    if profile.wasm_bindgen_omit_default_module_path() {
        cmd.arg("--omit-default-module-path");
    }
    if profile.wasm_bindgen_split_linked_modules() {
        cmd.arg("--split-linked-modules");
    }

    child::run(cmd, "wasm-bindgen").context("Running the wasm-bindgen CLI")?;
    Ok(())
}

/// Check if the `wasm-bindgen` dependency is locally satisfied for the web target
fn supports_web_target(cli_path: &Path) -> Result<bool> {
    let cli_version = semver::Version::parse(&install::get_cli_version(
        &install::Tool::WasmBindgen,
        cli_path,
    )?)?;
    let expected_version = semver::Version::parse("0.2.39")?;
    Ok(cli_version >= expected_version)
}

/// Check if the `wasm-bindgen` dependency is locally satisfied for the --target flag
fn supports_dash_dash_target(cli_path: &Path) -> Result<bool> {
    let cli_version = semver::Version::parse(&install::get_cli_version(
        &install::Tool::WasmBindgen,
        cli_path,
    )?)?;
    let expected_version = semver::Version::parse("0.2.40")?;
    Ok(cli_version >= expected_version)
}

fn build_target_arg(target: Target, cli_path: &Path) -> Result<String> {
    if !supports_dash_dash_target(cli_path)? {
        Ok(build_target_arg_legacy(target, cli_path)?)
    } else {
        Ok(target.to_string())
    }
}

fn build_target_arg_legacy(target: Target, cli_path: &Path) -> Result<String> {
    log::info!("Your version of wasm-bindgen is out of date. You should consider updating your Cargo.toml to a version >= 0.2.40.");
    let target_arg = match target {
        Target::Nodejs => "--nodejs",
        Target::NoModules => "--no-modules",
        Target::Web => {
            if supports_web_target(cli_path)? {
                "--web"
            } else {
                bail!("Your current version of wasm-bindgen does not support the 'web' target. Please update your project to wasm-bindgen version >= 0.2.39.")
            }
        }
        Target::Bundler => "--browser",
        Target::Deno => "--deno",
    };
    Ok(target_arg.to_string())
}

```

### Core Architecture Module: `src/cache.rs`
```
//! Getting and configuring wasm-pack's binary cache.

use anyhow::Result;
use binary_install::Cache;
use std::env;
use std::path::Path;

/// Get wasm-pack's binary cache.
pub fn get_wasm_pack_cache() -> Result<Cache> {
    if let Ok(path) = env::var("WASM_PACK_CACHE") {
        Ok(Cache::at(Path::new(&path)))
    } else {
        Cache::new("wasm-pack")
    }
}

```

### Core Architecture Module: `src/child.rs`
```
//! Utilities for managing child processes.
//!
//! This module helps us ensure that all child processes that we spawn get
//! properly logged and their output is logged as well.

use anyhow::{bail, Result};
use log::info;
use std::process::{Command, Stdio};

/// Return a new Command object
pub fn new_command(program: &str) -> Command {
    // On Windows, initializes launching <program> as `cmd /c <program>`.
    // Initializing only with `Command::new("npm")` will launch
    //   `npm` with quotes, `"npm"`, causing a run-time error on Windows.
    // See rustc: #42436, #42791, #44542

    if cfg!(windows) {
        let mut cmd = Command::new("cmd");
        cmd.arg("/c").arg(program);
        cmd
    } else {
        Command::new(program)
    }
}

/// Run the given command and return on success.
pub fn run(mut command: Command, command_name: &str) -> Result<()> {
    info!("Running {:?}", command);

    let status = command.status()?;

    if status.success() {
        Ok(())
    } else {
        bail!(
            "failed to execute `{}`: exited with {}\n  full command: {:?}",
            command_name,
            status,
            command,
        )
    }
}

/// Run the given command and return its stdout.
pub fn run_capture_stdout(
    mut command: Command,
    command_name: impl std::fmt::Display,
) -> Result<String> {
    info!("Running {:?}", command);

    let output = command
        .stderr(Stdio::inherit())
        .stdin(Stdio::inherit())
        .output()?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        bail!(
            "failed to execute `{}`: exited with {}\n  full command: {:?}",
            command_name,
            output.status,
            command,
        )
    }
}

```

### Core Architecture Module: `src/command/generate.rs`
```
use crate::cache;
use crate::generate;
use crate::install::{self, Tool};
use crate::PBAR;
use anyhow::Result;
use log::info;

/// Executes the 'cargo-generate' command in the current directory
/// which generates a new rustwasm project from a template.
pub fn generate(template: String, name: String, install_permitted: bool) -> Result<()> {
    info!("Generating a new rustwasm project...");
    let download = install::download_prebuilt_or_cargo_install(
        Tool::CargoGenerate,
        &cache::get_wasm_pack_cache()?,
        "latest",
        install_permitted,
    )?;
    generate::generate(&template, &name, &download)?;

    let msg = format!("🐑 Generated new project at /{}", name);
    PBAR.info(&msg);
    Ok(())
}

```

### Core Architecture Module: `src/command/login.rs`
```
use crate::npm;
use crate::PBAR;
use anyhow::Result;
use log::info;

pub fn login(
    registry: Option<String>,
    scope: &Option<String>,
    auth_type: &Option<String>,
) -> Result<()> {
    let registry = registry.unwrap_or_else(|| npm::DEFAULT_NPM_REGISTRY.to_string());

    info!("Logging in to npm...");
    info!(
        "Scope: {:?} Registry: {}, Auth Type: {:?}.",
        &scope, &registry, &auth_type
    );
    info!("npm info located in the npm debug log");
    npm::npm_login(&registry, &scope, &auth_type)?;
    info!("Logged you in!");

    PBAR.info(&"👋  logged you in!".to_string());
    Ok(())
}

```

### Core Architecture Module: `src/command/mod.rs`
```
//! CLI command structures, parsing, and execution.
#![allow(clippy::redundant_closure)]

pub mod build;
mod generate;
mod login;
mod pack;
/// Data structures and functions for publishing a package.
pub mod publish;
pub mod test;
pub mod utils;

use self::build::{Build, BuildOptions};
use self::generate::generate;
use self::login::login;
use self::pack::pack;
use self::publish::{access::Access, publish};
use self::test::{Test, TestOptions};
use crate::install::InstallMode;
use anyhow::Result;
use clap::Subcommand;
use log::info;
use std::path::PathBuf;
/// The various kinds of commands that `wasm-pack` can execute.
#[derive(Debug, Subcommand)]
pub enum Command {
    /// 🏗️  build your npm package!
    #[clap(name = "build", alias = "init")]
    Build(BuildOptions),

    #[clap(name = "pack")]
    /// 🍱  create a tar of your npm package but don't publish!
    Pack {
        #[clap(long = "pkg-dir", short = 'd', default_value = "pkg")]
        /// The name of the output directory where the npm package is stored
        pkg_directory: PathBuf,

        /// The path to the Rust crate. If not set, searches up the path from the current directory.
        #[clap()]
        path: Option<PathBuf>,
    },

    #[clap(name = "new")]
    /// 🐑 create a new project with a template
    Generate {
        /// The name of the project
        name: String,
        /// The URL to the template
        #[clap(
            long = "template",
            default_value = crate::generate::DEFAULT_TEMPLATE
        )]
        template: String,
        #[clap(long = "mode", short = 'm', default_value = "normal")]
        /// Should we install or check the presence of binary tools. [possible values: no-install, normal, force]
        mode: InstallMode,
    },

    #[clap(name = "publish")]
    /// 🎆  pack up your npm package and publish!
    Publish {
        #[clap(long = "target", short = 't', default_value = "bundler")]
        /// Sets the target environment. [possible values: bundler, nodejs, web, no-modules]
        target: String,

        /// The access level for the package to be published
        #[clap(long = "access", short = 'a')]
        access: Option<Access>,

        /// The distribution tag being used for publishing.
        /// See https://docs.npmjs.com/cli/dist-tag
        #[clap(long = "tag")]
        tag: Option<String>,

        #[clap(long = "pkg-dir", short = 'd', default_value = "pkg")]
        /// The name of the output directory where the npm package is stored
        pkg_directory: PathBuf,

        /// The path to the Rust crate. If not set, searches up the path from the current directory.
        #[clap()]
        path: Option<PathBuf>,
    },

    #[clap(name = "login", alias = "adduser", alias = "add-user")]
    /// 👤  Add an npm registry user account! (aliases: adduser, add-user)
    Login {
        #[clap(long = "registry", short = 'r')]
        /// Default: 'https://registry.npmjs.org/'.
        /// The base URL of the npm package registry. If scope is also
        /// specified, this registry will only be used for packages with that
        /// scope. scope defaults to the scope of the project directory you're
        /// currently in, if any.
        registry: Option<String>,

        #[clap(long = "scope", short = 's')]
        /// Default: none.
        /// If specified, the user and login credentials given will be
        /// associated with the specified scope.
        scope: Option<String>,

        #[clap(long = "auth-type", short = 't')]
        /// Default: 'legacy'.
        /// Type: 'legacy', 'sso', 'saml', 'oauth'.
        /// What authentication strategy to use with adduser/login. Some npm
        /// registries (for example, npmE) might support alternative auth
        /// strategies besides classic username/password entry in legacy npm.
        auth_type: Option<String>,
    },

    #[clap(name = "test")]
    /// 👩‍🔬  test your wasm!
    Test(TestOptions),
}

/// Run a command with the given logger!
pub fn run_wasm_pack(command: Command) -> Result<()> {
    // Run the correct command based off input and store the result of it so that we can clear
    // the progress bar then return it
    match command {
        Command::Build(build_opts) => {
            info!("Running build command...");
            Build::try_from_opts(build_opts).and_then(|mut b| b.run())
        }
        Command::Pack {
            path,
            pkg_directory,
        } => {
            info!("Running pack command...");
            info!("Path: {:?}", &path);
            pack(path, pkg_directory)
        }
        Command::Generate {
            template,
            name,
            mode,
        } => {
            info!("Running generate command...");
            info!("Template: {:?}", &template);
            info!("Name: {:?}", &name);
            generate(template, name, mode.install_permitted())
        }
        Command::Publish {
            target,
            path,
            access,
            tag,
            pkg_directory,
        } => {
            info!("Running publish command...");
            info!("Path: {:?}", &path);
            publish(&target, path, access, tag, pkg_directory)
        }
        Command::Login {
            registry,
            scope,
            auth_type,
        } => {
            info!("Running login command...");
            info!(
                "Registry: {:?}, Scope: {:?}, Auth Type: {:?}",
                &registry, &scope, &auth_type
            );
            login(registry, &scope, &auth_type)
        }
        Command::Test(test_opts) => {
            info!("Running test command...");
            Test::try_from_opts(test_opts).and_then(|t| t.run())
        }
    }
}

```

### Core Architecture Module: `src/command/pack.rs`
```
use crate::command::utils::{find_pkg_directory, get_crate_path};
use crate::npm;
use crate::PBAR;
use anyhow::{anyhow, Result};
use log::info;
use std::path::PathBuf;

/// Executes the 'npm pack' command on the 'pkg' directory
/// which creates a tarball that can be published to the NPM registry
pub fn pack(path: Option<PathBuf>, pkg_directory: PathBuf) -> Result<()> {
    let crate_path = get_crate_path(path)?;

    info!("Packing up the npm package...");
    let pkg_directory = find_pkg_directory(&crate_path, &pkg_directory).ok_or_else(|| {
        anyhow!(
            "Unable to find the pkg directory at path {:#?}, or in a child directory of {:#?}",
            &crate_path,
            &crate_path
        )
    })?;
    npm::npm_pack(&pkg_directory.to_string_lossy())?;
    info!(
        "Your package is located at {:#?}",
        crate_path.join(pkg_directory)
    );

    PBAR.info("🎒  packed up your package!");
    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #943** (2020-12-22): ** RUSTSEC-2020-0053: dirs: dirs is unmaintained, use dirs-next instead**
  *Symptoms*: https://rustsec.org/advisories/RUSTSEC-2020-0053  ``` Crate:         dirs Version:       2.0.2 Warning:       unmaintained Title:         dirs is unmaintained, use dirs-next instead Date:          2020-10-16 ID:            RUSTSEC-2020-0053 URL:           https://rustsec.org/advisories/RUSTSEC-2020-0053 Dependency tree: dirs 2.0.2 ```  dirs is unmaintained, dirs-next should be used instead.  I would be willing to implement this and submit a PR if it would be accepted.
  **Post-Mortem & Fix Analysis**:
  > Yes- thanks for the heads up, much appreciated. A PR would be accepted.

- **Issue #934** (2023-06-17): **Errors compiling rustc-serialize-0.3.24 - not all trait items implemented, missing: `encode`, `decode`**
  *Symptoms*: ## 🐛 Bug description When compiling a simple test project to WASM, I found these errors:  ```shell $ wasm-pack build [INFO]: 🎯  Checking for the Wasm target... [INFO]: 🌀  Compiling to Wasm...    Compiling rustc-serialize v0.3.24    Compiling quote v1.0.7    Compiling syn v1.0.48 error[E0046]: not all trait items implemented, missing: `encode`     --> /Users/chakrit_w/.cargo/registry/src/github.com-1ecc6299db9ec823/rustc-serialize-0.3.24/src/serialize.rs:1358:1      | 853  |     fn encode<S: Encoder>(&self, s: &mut S) -> Result<(), S::Error>;      |     ---------------------------------------------------------------- `encode` from trait ... 1358 | impl Encodable for path::Path {      | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ missing `encode` in implementation  error[E0046]: not all trait items implemented, missing: `decode`     --> /Users/chakrit_w/.cargo/registry/src/github.com-1ecc6299db9ec823/rustc-serialize-0.3.24/src/serialize.rs:1382:1      | 904  |     fn decode<D: Decoder>(d: &mut D) -> Result<Self, D::Error>;      |     ----------------------------------------------------------- `decode` from trait ... 1382 | impl Decodable for path::PathBuf {      | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ missing `decode` in implementation  error: aborting due to 2 previous errors  For more information about this error, try `rustc --explain E0046`. error: could not compile `rustc-serialize`. ```  #### 🌍 Your environment Include the relevant details of your envir
  **Post-Mortem & Fix Analysis**:
  > Might be the same issue in https://github.com/rustwasm/wasm-bindgen/issues/1488
  > here I reproduced the issue by adding one dependency to the "wasm-pack-template" https://gist.github.com/kumavis/2662d126957b94ad45bebcbe19eb57c0
  > Please try out v0.12.0 from one of the following ways: * https://github.com/rustwasm/wasm-pack/releases/tag/v0.12.0 * https://crates.io/crates/wasm-pack/0.12.0 * https://www.npmjs.com/package/wasm-pack/v/0.12.0

- **Issue #921** (2023-06-17): **wasm-pack.exe build hang forever**
  *Symptoms*: ## 🐛 Bug description ``` \wasm-game-of-life> wasm-pack.exe build --release [INFO]: Checking for the Wasm target... [INFO]: Compiling to Wasm... warning: function is never used: `set_panic_hook`  --> src\utils.rs:1:8   | 1 | pub fn set_panic_hook() {   |        ^^^^^^^^^^^^^^   |   = note: `#[warn(dead_code)]` on by default  warning: 1 warning emitted      Finished release [optimized] target(s) in 0.05s ``` the build command never finish   #### 🌍 Your environment Include the relevant details of your environment. wasm-pack version: 0.9.1  rustc version: rustc 1.46.0 (04488afe3 2020-08-24)   I also tried `wasm-pack.exe build -dev`, it works as expected.
  **Post-Mortem & Fix Analysis**:
  > Also happened to me.
  > Same here, this time in WSL2 Ubuntu `20.04`. Running with `--dev` works, without it, just running `wasm-pack --verbose build --target nodejs` logs:  ``` [INFO]: Checking for the Wasm target... [INFO]: Compiling to Wasm...     Finished release [optimized] target(s) in 0.02s ```  then hangs indefinitely without exiting and doesn't generate a `package.json` file.
  > i think this might be due to wasm-opt, gonna tag as a wasm-opt bug, i'm working on a PR that makes wasm-opt opt-in by default. can you try to add this to your `Cargo.toml` and see if it fixes your issues?  ``` # `wasm-opt` is on by default in for the release profile, but it can be # disabled by setting it to `false` [package.metadata.wasm-pack.profile.release] wasm-opt = false ```

- **Issue #919** (2023-06-17): **wasm-opt Tool version should be bumped **
  *Symptoms*: ## 🐛 Bug description The prebuilt wasm-opt version_90 segfaults when optimizing my crate with `-enable-mutable-globals`. When I manually use version_97, it works   I think it will also help fix #886   #### 🤔 Expected Behavior  #### 👟 Steps to reproduce I didn't try to test any other project, but It specifically segfaults in mine: https://github.com/michelhe/rustboyadvance-ng/tree/master/platform/rustboyadvance-wasm add to Cargo.toml ```toml [package.metadata.wasm-pack.profile.release] wasm-opt = ["-Oz", "--enable-mutable-globals"] ``` run `wasm-pack build --release`   #### 🌍 Your environment wasm-pack version: 0.9.1 rustc version: rustc 1.43.0 (4fb7144ed 2020-04-20)
  **Post-Mortem & Fix Analysis**:
  > For the record, I had the same issue, reported it in binaryen:  https://github.com/WebAssembly/binaryen/issues/3513

- **Issue #917** (2020-12-21): **Tool immediately segfaults on Alpine Linux w/ Rustup**
  *Symptoms*: ## 🐛 Bug description  When I run `wasm-pack` inside an Alpine Linux docker container, it immediately segfaults. Adding flags (like `-V`) or commands (like `build`) do not change this behavior.  #### 🤔 Expected Behavior I should see the usage information.  #### 👟 Steps to reproduce This is the docker container I was using.  ```dockerfile FROM alpine as base  RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories RUN apk update && \     apk add nodejs rustup openssl openssl-dev build-base  RUN rustup-init -y RUN /root/.cargo/bin/cargo install wasm-pack ```  #### 🌍 Your environment Include the relevant details of your environment. wasm-pack version: 0.9.1 rustc version: `rustc 1.46.0 (04488afe3 2020-08-24)`  I've also built and run trivial Rust programs inside this container with no issues, so I don't think `rustc` is the problem.
  **Post-Mortem & Fix Analysis**:
  > I am experiencing the same problem on Ubuntu 20.04.  I have wasm-pack 0.9.1, just installed for the first time by the rustwasm.github.io installer script, and running it with no arguments produces: ``` $ wasm-pack wasm-pack 0.9.1 Ashley Williams <ashley666ashley@gmail.com> 📦 ✨  pack and publish your wasm!  USAGE:     wasm-pack [FLAGS] [OPTIONS] <SUBCOMMAND>  FLAGS:     -h, --help       Prints help information     -q, --quiet      No output printed to stdout     -V, --version    Prints version information     -v, --verbose    Log verbosity is based off the number of v used  OPTIONS:         --log-level <log_level>    The maximum level of messages that should be logged by wasm-pack. [possible values:                                    info, warn, error] [default: info]  SUBCOMMANDS:     build      🏗️  build your npm package!     help       Prints this message or the help of the given subcommand(s)     login      👤  Add an npm registry user account! (aliases: add
  > After reading a bit about the openssl/curl issues in #823, I decided to rebuild `wasm-pack` after `cargo update` to pick up newer upstream packages.  Even though there's still [one openssl fix](https://github.com/sfackler/rust-openssl/pull/1324) that hasn't made it to a release yet, my rebuilt binary works without crashing.  I'd suggest that `wasm-pack` should update at least the openssl and curl dependencies and cut a new release.  It's probably worth doing right away (since openssl-related segfaults have been reported multiple times), and probably again whenever the next openssl release happens.
  > i think that the work i'm doing in #947 will address this. sorry you ran into it!

- **Issue #913** (2021-12-16): **no prebuilt wasm-opt binaries error**
  *Symptoms*: ## 🐛 Bug description I'm running wasm-pack on a raspberry pie 3b (arm v71). and are trying the game of life tutorial. Build 'fails' with an error. (I say 'fails', as I get something that works after all.)  `~/rust/wasm-game-of-life $ wasm-pack build [INFO]: Checking for the Wasm target... [INFO]: Compiling to Wasm...     Finished release [optimized] target(s) in 0.50s [INFO]: Installing wasm-bindgen... Error: no prebuilt wasm-opt binaries are available for this platform: Unrecognized target! To disable `wasm-opt`, add `wasm-opt = false` to your package metadata in your 'Cargo.toml'.`  #### 🤔 Expected Behavior Looking at `wasm-opt.rs`, I would have expected the build to successfully complete, giving the message "Skipping wasm-opt because it is not supported on this platform". It also doesn't seem to look for a local wasm-opt in the path, as described above `pub fn find_wasm_opt`. I downloaded the [wasm-opt source](https://github.com/WebAssembly/binaryen), build it locally and added the bin dir it to the path... source doesn't show any signs of looking at the path...  #### 👟 Steps to reproduce Get a raspberry pie, install raspbian OS, install git, rust, wasm, etc git clone https://github.com/rustwasm/wasm_game_of_life.git cd wasm_game_of_life/ wasm_pack build  #### 🌍 Your environment Include the relevant details of your environment. wasm-pack version: 0.9.1 rustc version: 1.46.0
  **Post-Mortem & Fix Analysis**:
  > I ran into a completely different issue with wasm-opt as well which was solved by downgrading to 0.8.1. I reckon that will not solve anything for you considering the lack of binaries.  Have you tried disabling wasm-opt altogether? `To disable wasm-opt, add wasm-opt = false to your package metadata in your Cargo.toml.` Obviously doesn't address the issue here, but perhaps it'll at least allow you to continue.
  > I think this is a duplicate of https://github.com/rustwasm/wasm-pack/issues/886
  > > I think this is a duplicate of #886  No, because that bug occurs when wasm-opt is actually running. In my case, the wasm-opt binaries are not found at all.

- **Issue #907** (2021-07-02): **error executing wasm-pack new (cannot parse 'latest' as a semver)**
  *Symptoms*: ## 🐛 Bug description When running wasm-pack new rust-example an error in cargo-generate occurs the following log is printed ```[INFO]: Installing cargo-generate... error: the `--vers` provided, `latest`, is not a valid semver version: cannot parse 'latest' as a semver  Error: Installing cargo-generate with cargo Caused by: failed to execute `cargo install`: exited with exit code: 101   full command: "cargo" "install" "--force" "cargo-generate" "--version" "latest" "--root" "/home/lgama/.cache/.wasm-pack/.cargo-generate-cargo-install-latest" ``` #### 🤔 Expected Behavior  a new wasm-pack project should be created #### 👟 Steps to reproduce Have a previous rust toolchain installed install wasm-pack with `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh` execute `wasm-pack new rust-example`  #### 🌍 Your environment  wasm-pack version: 0.9.1 rustc version: rustc 1.45.0 (5c1f21c3b 2020-07-13)
  **Post-Mortem & Fix Analysis**:
  > similar to #828
  > I get the same issue when running `wasm-pack new` v0.9.1 with the patched lockfile from #960 on an Apple Silicon based Mac.
  > Facing the same issue with `wasm-pack new`

- **Issue #900** (2020-12-21): **build failed when converting .rs to .wasm**
  *Symptoms*: ## 🐛 Bug description When I followed the official document `Rust and WebAssembly` and coded the example `Conway's Game of Life`, I failed to  run `wasm-pack build`. Error Message as below:  `Fatal: error in validating input` `Error: failed to execute ``wasm-opt``: exited with exit code: 1`   `full command: "C:\\Users\\Simon\\AppData\\Local\\.wasm-pack\\wasm-opt-171374efd61df962\\wasm-opt.exe" "C:\\projects\\learn-rust\\wasm-game-of-life\\pkg\\wasm_game_of_life_bg.wasm" "-o" "C:\\projects\\learn-rust\\wasm-game-of-life\\pkg\\wasm_game_of_life_bg.wasm-opt.wasm" "-O" To disable ``wasm-opt``, add ``wasm-opt = false`` to your package metadata in your ``Cargo.toml`.`  Even though I disabled `wasm-opt = false`, the compiled process was passed but it failed to work with the glue code. I mean, run `npm run start` it did not work as expected.  the Rust code is the same as the example in the Doc `Rust and WebAssembly`.  #### 🤔 Expected Behavior I want to know it is a bug? or something wrong I did? I am totally a beginner on Rust & WebAssembly, hope you guys can help me.   #### 🌍 Your environment Include the relevant details of your environment. wasm-pack version: `wasm-pack 0.9.1` rustc version: `rustc 1.45.0 (5c1f21c3b 2020-07-13)` `wee_alloc` version: `0.4.5` `wasm-bindgen` version: `0.2.63` `opt-level`: `'s'`  Platform: `Windows 10` IDE: `VS code`
  **Post-Mortem & Fix Analysis**:
  > +1 here. Also very new to Rust/WASM. I was able to track down the error as coming from the `render` function for `Universe`. Apparently it's crashing because we return a String into Javascript? I tried commenting that function and it compiles fine. Also, I tried adding a totally unrelated   ``` #[wasm_bindgen] pub fn greet() -> String {     format!("Hello") } ``` function and the compilation error returned.  If you remove the `#[wasm_bindgen]` attribute, compilation goes back to normal.
  > Problably related to https://github.com/rustwasm/wasm-bindgen/issues/2279
  > @SimonWang9610 you should be able to run `cargo install --version 0.8.1 wasm-pack --force` to go back to `wasm-pack`'s `0.8.1` version, that's the last one I find this to be compiling correctly.

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

### Incident Patch 1: `e33b17ae` (2026-08-12)
**Commit Message**: fix: pass --enable-exception-handling to wasm-opt for --panic-unwind builds (#1600)

**File**: `docs/src/commands/build.md` (modified, +2/-0)
```diff
@@ -170,6 +170,8 @@ This flag:
 - Adds `-Z build-std=std,panic_unwind` to rebuild `std` with unwinding
   support.
 - Sets `RUSTFLAGS=-Cpanic=unwind` (preserving any user-provided `RUSTFLAGS`).
+- Passes `--enable-exception-handling` to `wasm-opt` so the optimiser accepts
+  the exception-handling instructions unwinding compiles to.
 
 The first time you use `--panic-unwind`, `wasm-pack` will install any missing
 prerequisites via `rustup`:
```

**File**: `src/command/build.rs` (modified, +3/-0)
```diff
@@ -521,6 +521,9 @@ impl Build {
         if build::is_tier3_wasm(&self.target_triple) {
             args.push("--enable-memory64".into());
         }
+        if self.panic_unwind {
+            args.push("--enable-exception-handling".into());
+        }
         info!("executing wasm-opt with {:?}", args);
         wasm_opt::run(
             &self.cache,
```

---

### Incident Patch 2: `c13f0dda` (2026-07-07)
**Commit Message**: fix(webdriver): drop 32-bit Linux geckodriver support (#1595)

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@
 
 - ### 🤕 Fixes
 
+  - **Drop 32-bit Linux geckodriver support - [guybedford], [pull/1595]**
+
+    Mozilla discontinued 32-bit (x86) Linux geckodriver builds in v0.37.0, so the
+    download URL now 404s. The 32-bit Linux target is removed from `install_geckodriver`
+    and its test is skipped on that platform.
+
+    [pull/1595]: https://github.com/wasm-bindgen/wasm-pack/pull/1595
+
   - **Use prebuilt wasm-bindgen binary on macOS aarch64 - [guybedford], [pull/1585]**
 
     Previously wasm-pack built `wasm-bindgen-cli` from source on Apple Silicon. The
```

**File**: `src/test/webdriver/geckodriver.rs` (modified, +1/-3)
```diff
@@ -36,9 +36,7 @@ pub fn get_or_install_geckodriver(cache: &Cache, mode: InstallMode) -> Result<Pa
 
 /// Download and install a pre-built `geckodriver` binary.
 pub fn install_geckodriver(cache: &Cache, installation_allowed: bool) -> Result<PathBuf> {
-    let (target, ext) = if target::LINUX && target::x86 {
-        ("linux32", "tar.gz")
-    } else if target::LINUX && target::x86_64 {
+    let (target, ext) = if target::LINUX && target::x86_64 {
         ("linux64", "tar.gz")
     } else if target::LINUX && target::aarch64 {
         ("linux-aarch64", "tar.gz")
```

**File**: `tests/all/webdriver.rs` (modified, +0/-1)
```diff
@@ -17,7 +17,6 @@ fn can_install_chromedriver() {
 
 #[test]
 #[cfg(any(
-    all(target_os = "linux", target_arch = "x86"),
     all(target_os = "linux", target_arch = "x86_64"),
     all(target_os = "linux", target_arch = "aarch64"),
     all(target_os = "macos", target_arch = "x86_64"),
```

---

### Incident Patch 3: `1d35e8fe` (2026-05-22)
**Commit Message**: fix(wasm64): fix tier-3 target handling and bump binaryen to v129 (#1586)

Resolves #1576.

Building for wasm64-unknown-unknown failed in two ways introduced by
#1553:

1. `rustup target add wasm64-unknown-unknown` failed because wasm64 is
   a tier-3 target with no prebuilt artifacts. Users had to work around
   this with `--mode force`.
2. The bundled wasm-opt (binaryen v117) could not parse 64-bit tables;
   support landed in binaryen v118.

The cargo target triple — declared in `.cargo/config.toml`,
`CARGO_BUILD_TARGET`, or as an extra cargo argument
(`-- --target wasm64-unknown-unknown`) — is the source of truth for
what wasm-pack builds. The target triple resolver now follows the same
precedence cargo uses (CLI > env > `.cargo/config.toml` walk-up >
`$CARGO_HOME/config.toml` > default), so wasm-pack and cargo always
agree on the target.

For tier-3 wasm targets (currently the `wasm64-*` family) wasm-pack
stays out of the cargo invocation — it does not inject `+nightly` or
`-Z build-std` (those would override a project's `rust-toolchain.toml`
pin or surprise users who hadn't intended a nightly build). Instead it:

* verifies the active toolchain is nightly, with a helpful erro

**File**: `Cargo.lock` (modified, +40/-1)
```diff
@@ -476,6 +476,15 @@ dependencies = [
  "subtle",
 ]
 
+[[package]]
+name = "dirs"
+version = "6.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c3e8aa94d75141228480295a7d0e7feb620b1a5ad9f12bc40be62411e38cce4e"
+dependencies = [
+ "dirs-sys",
+]
+
 [[package]]
 name = "dirs-next"
 version = "2.0.0"
@@ -486,14 +495,26 @@ dependencies = [
  "dirs-sys-next",
 ]
 
+[[package]]
+name = "dirs-sys"
+version = "0.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "e01a3366d27ee9890022452ee61b2b63a67e6f13f58900b651ff5665f0bb1fab"
+dependencies = [
+ "libc",
+ "option-ext",
+ "redox_users 0.5.2",
+ "windows-sys 0.61.2",
+]
+
 [[package]]
 name = "dirs-sys-next"
 version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4ebda144c4fe02d1f7ea1a7d9641b6fc6b580adcfa024ae48797ecdeb6825b4d"
 dependencies = [
  "libc",
- "redox_users",
+ "redox_users 0.4.6",
  "winapi",
 ]
 
@@ -1126,6 +1147,12 @@ version = "1.70.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "384b8ab6d37215f3c5301a95a4accb5d64aa607f1fcb26a11b5303878451b4fe"
 
+[[package]]
+name = "option-ext"
+version = "0.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "04744f49eae99ab78e0d5c0b603ab218f515ea8cfe5a456d7629ad883a3b6e7d"
+
 [[package]]
 name = "parking_lot"
 version = "0.12.5"
@@ -1288,6 +1315,17 @@ dependencies = [
  "thiserror 1.0.69",
 ]
 
+[[package]]
+name = "redox_users"
+version = "0.5.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "a4e608c6638b9c18977b00b475ac1f28d14e84b27d8d42f70e0bf1e3dec127ac"
+dependencies = [
+ "getrandom 0.2.17",
+ "libredox",
+ "thiserror 2.0.18",
+]
+
 [[package]]
 name = "regex"
 version = "1.12.3"
@@ -2019,6 +2057,7 @@ dependencies = [
  "clap",
  "console",
  "dialoguer",
+ "dirs",
  "env_logger",
  "glob",
  "human-panic",
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ ureq = { version = "2.12.1", features = ["json", "socks-proxy"] }
 walkdir = "2.5.0"
 which = "8.0.0"
 path-clean = "1.0.1"
+dirs = "6.0.0"
 
 [dev-dependencies]
 assert_cmd = "2.1.1"
```

**File**: `docs/src/cargo-toml-configuration.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ The available configuration options and their default values are shown below:
 #
 # In most cases, the `-O[X]` flag is enough. However, if you require extreme
 # optimizations, see the full list of `wasm-opt` optimization flags
-# https://github.com/WebAssembly/binaryen/blob/version_117/test/lit/help/wasm-opt.test
+# https://github.com/WebAssembly/binaryen/blob/version_129/test/lit/help/wasm-opt.test
 wasm-opt = ['-O']
 
 [package.metadata.wasm-pack.profile.dev.wasm-bindgen]
```

**File**: `docs/src/commands/build.md` (modified, +62/-0)
```diff
@@ -174,6 +174,68 @@ See [Non-`rustup` setups][non-rustup].
 
 `--panic-unwind` is also available for [`wasm-pack test`](./test.md).
 
+## 64-bit WebAssembly (`wasm64-unknown-unknown`)
+
+The cargo target triple is the source of truth for which WebAssembly ABI
+`wasm-pack` builds. To produce a `memory64` binary, declare the target the
+cargo-native way — either in `.cargo/config.toml`:
+
+```toml
+# .cargo/config.toml
+[build]
+target = "wasm64-unknown-unknown"
+```
+
+or as an extra cargo argument:
+
+```
+wasm-pack build -- --target wasm64-unknown-unknown
+```
+
+or via `CARGO_BUILD_TARGET=wasm64-unknown-unknown` in the environment.
+
+`wasm64-unknown-unknown` is a [tier-3 Rust target][tier-3], so `rustup`
+has no prebuilt artifacts for it. You need to provide two pieces yourself
+via cargo's native config:
+
+1. **A nightly toolchain** — `rust-toolchain.toml` is the cargo-native
+   way to pin one to your project:
+
+   ```toml
+   # rust-toolchain.toml
+   [toolchain]
+   channel = "nightly"
+   components = ["rust-src"]
+   ```
+
+   Or set `RUSTUP_TOOLCHAIN=nightly` for one-off invocations.
+
+2. **`-Z build-std` to build `std` from source**, since there is no
+   prebuilt one. Add to your `.cargo/config.toml`:
+
+   ```toml
+   [unstable]
+   build-std = ["std", "panic_abort"]
+   ```
+
+   Or pass `-Z build-std=std,panic_abort` as an extra cargo argument.
+
+`wasm-pack` itself stays out of the cargo invocation — it does not inject
+`+nightly` or `-Z build-std` (those would override your toolchain pin or
+surprise users who hadn't intended a nightly build). What it does do when
+it sees a `wasm64-*` triple:
+
+- Verifies the active toolchain is nightly, with a helpful error pointing
+  at the config above if it isn't.
+- Installs the `rust-src` component for the active toolchain via `rustup`
+  if missing.
+- Does **not** attempt `rustup target add wasm64-*` (which would always
+  fail for a tier-3 target).
+- Passes `--enable-memory64` to `wasm-opt` so the optimiser accepts
+  64-bit memories and tables.
+
+[tier-3]: https://doc.rust-lang.org/nightly/rustc/platform-support.html
+
 [wbg-catch-unwind]: https://wasm-bindgen.github.io/wasm-bindgen/reference/catch-unwind.html
 [non-rustup]: ../prerequisites/non-rustup-setups.md
 
```

**File**: `src/build/mod.rs` (modified, +22/-0)
```diff
@@ -74,6 +74,13 @@ fn wasm_pack_local_version() -> Option<String> {
     Some(output.to_string())
 }
 
+/// Returns true for tier-3 wasm targets that have no rustup-prebuilt sysroot
+/// and must be built via `-Z build-std`. Currently this is the wasm64 family
+/// (`wasm64-unknown-unknown`, future `wasm64-*` variants).
+pub fn is_tier3_wasm(target_triple: &str) -> bool {
+    target_triple.starts_with("wasm64")
+}
+
 /// Run `cargo build` for Wasm with config derived from the given `BuildProfile`.
 pub fn cargo_build_wasm(
     path: &Path,
@@ -260,3 +267,18 @@ pub fn cargo_build_wasm_tests(
     child::run(cmd, "cargo build").context("Compilation of your program failed")?;
     Ok(())
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn tier3_wasm_detection() {
+        assert!(is_tier3_wasm("wasm64-unknown-unknown"));
+        assert!(is_tier3_wasm("wasm64-wasi"));
+        assert!(!is_tier3_wasm("wasm32-unknown-unknown"));
+        assert!(!is_tier3_wasm("wasm32-wasi"));
+        assert!(!is_tier3_wasm("wasm32-unknown-emscripten"));
+        assert!(!is_tier3_wasm("x86_64-unknown-linux-gnu"));
+    }
+}
```

**File**: `src/build/wasm_target.rs` (modified, +72/-0)
```diff
@@ -56,6 +56,17 @@ pub fn check_for_wasm_target(target: &str) -> Result<()> {
     let msg = format!("{}Checking for the Wasm target...", emoji::TARGET);
     PBAR.info(&msg);
 
+    // Tier-3 wasm targets (`wasm64-unknown-unknown`) have no rustup-prebuilt
+    // sysroot — they are built from source via `-Z build-std`, which requires
+    // a nightly toolchain and the `rust-src` component. wasm-pack doesn't
+    // inject `+nightly` or `-Z build-std` itself (those would override the
+    // user's `rust-toolchain.toml` or surprise users who hadn't intended a
+    // nightly build); instead we verify the active toolchain is nightly,
+    // heal the `rust-src` component if missing, and let cargo run.
+    if crate::build::is_tier3_wasm(target) {
+        return check_tier3_wasm_prerequisites(target);
+    }
+
     // Check if wasm32 target is present, otherwise bail.
     match check_target(target) {
         Ok(ref wasm32_check) if wasm32_check.found => Ok(()),
@@ -64,6 +75,67 @@ pub fn check_for_wasm_target(target: &str) -> Result<()> {
     }
 }
 
+/// Tier-3 (currently `wasm64-*`) prerequisites: nightly active toolchain +
+/// `rust-src` component. Does not inject any cargo flags.
+fn check_tier3_wasm_prerequisites(target: &str) -> Result<()> {
+    if !is_active_toolchain_nightly()? {
+        bail!(
+            "`{target}` is a tier-3 Rust target and requires the nightly \
+             toolchain (rustup has no prebuilt artifacts for it).\n\n\
+             Pin nightly for this project by adding a `rust-toolchain.toml`:\n\n\
+                 [toolchain]\n\
+                 channel = \"nightly\"\n\
+                 components = [\"rust-src\"]\n\n\
+             Or set `RUSTUP_TOOLCHAIN=nightly` for a one-off invocation.\n\n\
+             You also need cargo to build `std` from source. Add to your \
+             `.cargo/config.toml`:\n\n\
+                 [unstable]\n\
+                 build-std = [\"std\", \"panic_abort\"]\n\n\
+             Or pass `-Z build-std=std,panic_abort` as an extra cargo argument."
+        );
+    }
+
+    if !has_rust_src_component_for_active_toolchain()? {
+        install_rust_src_for_active_toolchain()?;
+    }
+
+    Ok(())
+}
+
+/// Returns true if the currently-active rustc resolves to a nightly channel.
+fn is_active_toolchain_nightly() -> Result<bool> {
+    let output = Command::new("rustc").arg("--version").output()?;
+    if !output.status.success() {
+        bail!("`rustc --version` failed: {}", output.status);
+    }
+    let stdout = String::from_utf8(output.stdout)?;
+    // `rustc --version` prints e.g. `rustc 1.79.0-nightly (abc123 2024-04-01)`.
+    Ok(stdout.contains("-nightly") || stdout.contains("-dev"))
+}
+
+fn has_rust_src_component_for_active_toolchain() -> Result<bool> {
+    let output = Command::new("rustup")
+        .args(["component", "list", "--installed"])
+        .output()?;
+    if !output.status.success() {
+        return Ok(false);
+    }
+    let stdout = String::from_utf8(output.stdout)?;
+    Ok(stdout.lines().any(|line| line.starts_with("rust-src")))
+}
+
+fn install_rust_src_for_active_toolchain() -> Result<()> {
+    let msg = format!(
+        "{}Installing rust-src component for the active toolchain...",
+        emoji::TARGET
+    );
+    PBAR.info(&msg);
+    let mut cmd = Command::new("rustup");
+    cmd.arg("component").arg("add").arg("rust-src");
+    child::run(cmd, "rustup").context("Adding the rust-src component with rustup")?;
+    Ok(())
+}
+
 /// Get rustc's sysroot as a PathBuf
 fn get_rustc_sysroot() -> Result<PathBuf> {
     let command = Command::new("rustc")
```

**File**: `src/command/build.rs` (modified, +111/-11)
```diff
@@ -258,17 +258,24 @@ impl Build {
 
         let extra_options = build_opts.extra_options;
 
+        // Resolve the cargo target triple in the same precedence order cargo
+        // uses, so wasm-pack and cargo always agree on what's being built:
+        //   1. `--target` in extra cargo arguments (after `--`)
+        //   2. `CARGO_BUILD_TARGET` env var
+        //   3. `[build] target = "..."` in `.cargo/config.toml` (walking up
+        //      from the crate dir, then `$CARGO_HOME/config.toml`)
+        //   4. fallback to `wasm32-unknown-unknown`
         let target_triple = {
-            let mut extra_options_iter = extra_options.iter();
-            if extra_options_iter
+            let mut iter = extra_options.iter();
+            let from_args = iter
                 .by_ref()
-                .any(|option| option == "--target")
-            {
-                extra_options_iter.next().map(|s| s.as_str())
-            } else {
-                None
-            }
-            .unwrap_or("wasm32-unknown-unknown")
+                .find(|o| o.as_str() == "--target")
+                .and_then(|_| iter.next())
+                .cloned();
+            from_args
+                .or_else(|| std::env::var("CARGO_BUILD_TARGET").ok())
+                .or_else(|| read_cargo_build_target(&crate_path))
+                .unwrap_or_else(|| "wasm32-unknown-unknown".to_string())
         };
 
         Ok(Build {
@@ -287,7 +294,7 @@ impl Build {
             out_name: build_opts.out_name,
             bindgen: None,
             cache: cache::get_wasm_pack_cache()?,
-            target_triple: target_triple.to_owned(),
+            target_triple,
             extra_options,
             panic_unwind: build_opts.panic_unwind,
             wasm_path: None,
@@ -504,7 +511,7 @@ impl Build {
         if self.reference_types {
             args.push("--enable-reference-types".into());
         }
-        if self.target_triple.starts_with("wasm64") {
+        if build::is_tier3_wasm(&self.target_triple) {
             args.push("--enable-memory64".into());
         }
         info!("executing wasm-opt with {:?}", args);
@@ -520,3 +527,96 @@ impl Build {
         })
     }
 }
+
+/// Read the cargo `[build] target` setting from `.cargo/config.toml`.
+///
+/// Mirrors cargo's own discovery: walk up from `crate_path` checking
+/// `.cargo/config.toml` at each ancestor (workspace-aware) and finally
+/// check `$CARGO_HOME/config.toml` for user-level defaults. The first
+/// file that declares `[build] target = "..."` wins.
+pub(crate) fn read_cargo_build_target(crate_path: &std::path::Path) -> Option<String> {
+    for dir in crate_path.ancestors() {
+        if let Some(target) = parse_build_target(&dir.join(".cargo/config.toml")) {
+            return Some(target);
+        }
+    }
+    // Cargo falls back to $CARGO_HOME/config.toml (default ~/.cargo/config.toml)
+    // for user-wide settings. Honour the same precedence.
+    let cargo_home = std::env::var_os("CARGO_HOME")
+        .map(std::path::PathBuf::from)
+        .or_else(|| dirs::home_dir().map(|h| h.join(".cargo")))?;
+    parse_build_target(&cargo_home.join("config.toml"))
+}
+
+/// Parse `[build] target = "..."` from a single config file, if it
+/// exists and is well-formed. Returns `None` for missing files or
+/// configs that don't declare a target.
+fn parse_build_target(path: &std::path::Path) -> Option<String> {
+    let cfg = std::fs::read_to_string(path).ok()?;
+    let parsed: toml::Value = toml::from_str(&cfg).ok()?;
+    parsed
+        .get("build")?
+        .get("target")?
+        .as_str()
+        .map(str::to_owned)
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn read_cargo_build_target_walks_up_to_workspace_root() {
+        let tmp = tempfile::TempDir::new().unwrap();
+        let root = tmp.path();
+        // Workspace root holds the .cargo/config.toml.
+        std::fs::create_dir_all(root.join(".cargo")).unwrap();
+        std::fs::write(
+            root.join(".cargo/config.toml"),
+            "[build]\ntarget = \"wasm64-unknown-unknown\"\n",
+        )
+        .unwrap();
+        // Crate lives two levels deeper with no config of its own.
+        let crate_path = root.join("crates/foo");
+        std::fs::create_dir_all(&crate_path).unwrap();
+
+        assert_eq!(
+            read_cargo_build_target(&crate_path),
+            Some("wasm64-unknown-unknown".to_string())
+        );
+    }
+
+    #[test]
+    fn read_cargo_build_target_prefers_crate_over_workspace() {
+        let tmp = tempfile::TempDir::new().unwrap();
+        let root = tmp.path();
+        std::fs::create_dir_all(root.join(".cargo")).unwrap();
+        std::fs::write(
+            root.join(".cargo/config.toml"),
+            "[build]\ntarget = \"wasm32-unknown-unknown\"\n",
+        )
+        .unwrap();
+        let crate_path = root.join("crates/foo");
+        std::fs::create_dir_all(crate_path.join(".cargo")).unwrap();
+ 
```

**File**: `src/command/test.rs` (modified, +11/-7)
```diff
@@ -148,15 +148,19 @@ impl Test {
         let crate_data = manifest::CrateData::new(&crate_path, None)?;
         let any_browser = chrome || firefox || safari;
 
+        // Same precedence cargo uses, so wasm-pack and cargo agree on the
+        // target. See `command::build::read_cargo_build_target`.
         let target_triple = {
             let mut iter = extra_options.iter();
-            if iter.by_ref().any(|option| option == "--target") {
-                iter.next().map(|s| s.as_str())
-            } else {
-                None
-            }
-            .unwrap_or("wasm32-unknown-unknown")
-            .to_owned()
+            let from_args = iter
+                .by_ref()
+                .find(|o| o.as_str() == "--target")
+                .and_then(|_| iter.next())
+                .cloned();
+            from_args
+                .or_else(|| std::env::var("CARGO_BUILD_TARGET").ok())
+                .or_else(|| crate::command::build::read_cargo_build_target(&crate_path))
+                .unwrap_or_else(|| "wasm32-unknown-unknown".to_string())
         };
 
         if !node && !any_browser {
```

---

### Incident Patch 4: `3d157e3c` (2026-05-22)
**Commit Message**: fix(install): use prebuilt wasm-bindgen binary on macOS aarch64 (#1585)

Previously wasm-pack built wasm-bindgen-cli from source on Apple Silicon
because the macOS aarch64 match arm only covered cargo-generate and
wasm-opt. wasm-bindgen publishes an aarch64-apple-darwin tarball for
every release, so fall through to that target for any tool other than
wasm-opt (which uses the binaryen 'arm64-macos' naming).

Also enable the can_download_prebuilt_wasm_bindgen test on
macos/aarch64 so the new code path is exercised in CI.

Fixes #1581

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -2,6 +2,15 @@
 
 ## 🤍 Unreleased
 
+- ### 🤕 Fixes
+
+  - **Use prebuilt wasm-bindgen binary on macOS aarch64 - [guybedford], [pull/1585]**
+
+    Previously wasm-pack built `wasm-bindgen-cli` from source on Apple Silicon. The
+    prebuilt `aarch64-apple-darwin` release is now used directly.
+
+    [pull/1585]: https://github.com/wasm-bindgen/wasm-pack/pull/1585
+
 ## 🌷 0.15.0
 
 - ### ✨ Features
```

**File**: `src/install/mod.rs` (modified, +1/-1)
```diff
@@ -180,8 +180,8 @@ pub fn prebuilt_url_for(tool: &Tool, version: &str, arch: &Arch, os: &Os) -> Res
         (Os::Linux, Arch::X86_64, _) => "x86_64-unknown-linux-musl",
         (Os::MacOS, Arch::X86_64, Tool::WasmOpt) => "x86_64-macos",
         (Os::MacOS, Arch::X86_64, _) => "x86_64-apple-darwin",
-        (Os::MacOS, Arch::AArch64, Tool::CargoGenerate) => "aarch64-apple-darwin",
         (Os::MacOS, Arch::AArch64, Tool::WasmOpt) => "arm64-macos",
+        (Os::MacOS, Arch::AArch64, _) => "aarch64-apple-darwin",
         (Os::Windows, Arch::X86_64, Tool::WasmOpt) => "x86_64-windows",
         (Os::Windows, Arch::X86_64, _) => "x86_64-pc-windows-msvc",
         _ => bail!("Unrecognized target!"),
```

**File**: `tests/all/download.rs` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ use wasm_pack::install::{self, Arch, Os, Tool};
 #[cfg(any(
     all(target_os = "linux", target_arch = "x86_64"),
     all(target_os = "macos", target_arch = "x86_64"),
+    all(target_os = "macos", target_arch = "aarch64"),
     all(windows, target_arch = "x86_64"),
 ))]
 fn can_download_prebuilt_wasm_bindgen() {
```

---

### Incident Patch 5: `583572d4` (2026-05-20)
**Commit Message**: fix: bundle snippets (#1584)

**File**: `src/manifest/mod.rs` (modified, +4/-0)
```diff
@@ -706,6 +706,10 @@ impl CrateData {
             }
         }
 
+        if out_dir.join("snippets").is_dir() {
+            files.push("snippets".to_owned());
+        }
+
         NpmData {
             name: npm_name,
             dts_file,
```

---

### Incident Patch 6: `a7cae9d4` (2026-05-14)
**Commit Message**: fix(npm): replace deprecated binary-install and add release auto-publish (#1579)

The published `wasm-pack` npm package is broken on the registry: 0.14.0
shipped with the old `drager/wasm-pack` release URL and was never
republished after the repository moved. `npm install -g wasm-pack` fails
with a 404 against
`github.com/drager/wasm-pack/releases/download/v0.14.0/...`.

The fix for the URL has been on master since 5f48264, but there is no
automation to actually publish to npm, so every release since requires a
maintainer to run `npm publish` by hand and 0.14.0 has stayed broken.

While here, replace the `binary-install` dependency, which the author
deprecated in 2025 and which transitively pulls in unmaintained
`rimraf@3`, `glob@7`, `inflight`, and `tar@6` (all of which trigger
`npm warn deprecated` lines during install).

Changes:

* npm/binary.js: inline the install/run logic (~110 lines). Uses Node
  stdlib `https` with manual redirect handling to fetch the release
  tarball, then `tar` (v7, actively maintained) to extract. Same public
  shape as before (`install()`, `run()`).
* npm/package.json: drop `binary-install`, promote `tar` from
  `resolutions` to a real `dependencies`

**File**: `.github/workflows/release.yml` (modified, +32/-0)
```diff
@@ -216,3 +216,35 @@ jobs:
           asset_path: ./wasm-pack-${{ steps.get_version.outputs.VERSION }}-${{ env.MACOS_ARM64_TARGET }}.tar.gz
           asset_content_type: application/gzip
           asset_name: wasm-pack-${{ steps.get_version.outputs.VERSION }}-${{ env.MACOS_ARM64_TARGET }}.tar.gz
+
+  npm-publish:
+    name: Publish npm package
+    needs: release
+    # Requires the NPM_TOKEN repository secret.
+    if: ${{ github.repository == 'wasm-bindgen/wasm-pack' }}
+    permissions:
+      contents: read
+      id-token: write  # required for npm provenance
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '20'
+          registry-url: 'https://registry.npmjs.org'
+
+      - name: Sync npm package version to release tag
+        shell: bash
+        working-directory: npm
+        run: |
+          # Strip the leading "v" from the tag (e.g. "v0.14.1" -> "0.14.1").
+          version="${GITHUB_REF##*/v}"
+          echo "Publishing npm wasm-pack@${version}"
+          npm version --no-git-tag-version --allow-same-version "${version}"
+
+      - name: Publish to npm
+        working-directory: npm
+        run: npm publish --access public --provenance
+        env:
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**File**: `npm/.gitignore` (modified, +2/-1)
```diff
@@ -1 +1,2 @@
-node_modules
\ No newline at end of file
+node_modules
+binary
```

**File**: `npm/binary.js` (modified, +96/-32)
```diff
@@ -1,55 +1,119 @@
-const { Binary } = require("binary-install");
-const { join } = require("path");
+// Minimal install/run shim for the wasm-pack binary release tarball.
+//
+// Replaces the deprecated `binary-install` package and its old transitive
+// deps (axios, rimraf@3, glob@7, inflight). Uses Node stdlib for HTTPS
+// (follows redirects manually) plus the actively maintained `tar` package
+// for extraction.
+
+const fs = require("fs");
 const os = require("os");
+const path = require("path");
+const https = require("https");
+const { spawnSync } = require("child_process");
+const tar = require("tar");
 
-const windows = "x86_64-pc-windows-msvc";
+const WINDOWS_TARGET = "x86_64-pc-windows-msvc";
 
 const getPlatform = () => {
   const type = os.type();
   const arch = os.arch();
 
   // https://github.com/nodejs/node/blob/c3664227a83cf009e9a2e1ddeadbd09c14ae466f/deps/uv/src/win/util.c#L1566-L1573
   if ((type === "Windows_NT" || type.startsWith("MINGW32_NT-")) && arch === "x64") {
-    return windows;
-  }
-  if (type === "Linux" && arch === "x64") {
-    return "x86_64-unknown-linux-musl";
-  }
-  if (type === "Linux" && arch === "arm64") {
-    return "aarch64-unknown-linux-musl";
-  }
-  if (type === "Darwin" && arch === "x64") {
-    return "x86_64-apple-darwin";
-  }
-  if (type === "Darwin" && arch === "arm64") {
-    return "aarch64-apple-darwin";
+    return WINDOWS_TARGET;
   }
+  if (type === "Linux" && arch === "x64") return "x86_64-unknown-linux-musl";
+  if (type === "Linux" && arch === "arm64") return "aarch64-unknown-linux-musl";
+  if (type === "Darwin" && arch === "x64") return "x86_64-apple-darwin";
+  if (type === "Darwin" && arch === "arm64") return "aarch64-apple-darwin";
 
   throw new Error(`Unsupported platform: ${type} ${arch}`);
 };
 
-const getBinary = () => {
+const getConfig = () => {
   const platform = getPlatform();
   const version = require("./package.json").version;
-  const author = "wasm-bindgen";
-  const name = "wasm-pack";
-  const url = `https://github.com/${author}/${name}/releases/download/v${version}/${name}-v${version}-${platform}.tar.gz`;
-  return new Binary(platform === windows ? "wasm-pack.exe" : "wasm-pack", url, {
-    installDirectory: join(__dirname, "binary"),
-  });
+  const binaryName = platform === WINDOWS_TARGET ? "wasm-pack.exe" : "wasm-pack";
+  const url = `https://github.com/wasm-bindgen/wasm-pack/releases/download/v${version}/wasm-pack-v${version}-${platform}.tar.gz`;
+  const installDirectory = path.join(__dirname, "binary");
+  return {
+    binaryName,
+    binaryPath: path.join(installDirectory, binaryName),
+    installDirectory,
+    url,
+  };
 };
 
-const install = () => {
-  const binary = getBinary();
-  binary.install();
+// Follow up to a small number of redirects manually. GitHub release asset
+// URLs redirect to S3, and `https.get` doesn't follow redirects on its own.
+const httpsGetFollow = (url, maxRedirects = 5) => new Promise((resolve, reject) => {
+  const attempt = (currentUrl, remaining) => {
+    https.get(currentUrl, (res) => {
+      const { statusCode, headers } = res;
+      if (statusCode >= 300 && statusCode < 400 && headers.location) {
+        if (remaining <= 0) {
+          res.resume();
+          return reject(new Error(`Too many redirects fetching ${url}`));
+        }
+        res.resume();
+        const next = new URL(headers.location, currentUrl).toString();
+        return attempt(next, remaining - 1);
+      }
+      if (statusCode !== 200) {
+        res.resume();
+        return reject(new Error(`Request failed with status code ${statusCode}`));
+      }
+      resolve(res);
+    }).on("error", reject);
+  };
+  attempt(url, maxRedirects);
+});
+
+const downloadAndExtract = async (url, installDirectory) => {
+  const stream = await httpsGetFollow(url);
+  await new Promise((resolve, reject) => {
+    stream
+      .pipe(tar.x({ strip: 1, C: installDirectory }))
+      .on("finish", resolve)
+      .on("error", reject);
+  });
 };
 
-const run = () => {
-  const binary = getBinary();
-  binary.run();
+const install = async () => {
+  const { binaryPath, installDirectory, url } = getConfig();
+
+  if (fs.existsSync(binaryPath)) {
+    console.error("wasm-pack is already installed, skipping installation.");
+    return;
+  }
+
+  fs.rmSync(installDirectory, { recursive: true, force: true });
+  fs.mkdirSync(installDirectory, { recursive: true });
+
+  console.error(`Downloading release from ${url}`);
+  try {
+    await downloadAndExtract(url, installDirectory);
+  } catch (e) {
+    console.error(`Error fetching release: ${e.message}`);
+    process.exit(1);
+  }
+  console.error("wasm-pack has been installed!");
 };
 
-module.exports = {
-  install,
-  run,
+const run = async () => {
+  const { binaryPath } = getConfig();
+
+  if (!fs.existsSync(binaryPath)) {
+    await install();
+  }
+
+  const args = process.argv.slice(2);
+  const result = spawnSync(binaryPath, args, { cwd: process.cwd(), 
```

**File**: `npm/install.js` (modified, +4/-1)
```diff
@@ -1,4 +1,7 @@
 #!/usr/bin/env node
 
 const { install } = require("./binary");
-install();
+install().catch((e) => {
+  console.error(e.message || e);
+  process.exit(1);
+});
```

**File**: `npm/package.json` (modified, +11/-6)
```diff
@@ -3,6 +3,12 @@
   "version": "0.14.0",
   "description": "📦✨ your favorite rust -> wasm workflow tool!",
   "main": "binary.js",
+  "files": [
+    "binary.js",
+    "install.js",
+    "run.js",
+    "README.md"
+  ],
   "scripts": {
     "postinstall": "node ./install.js"
   },
@@ -22,17 +28,16 @@
     "npm",
     "package"
   ],
-  "author": "Jesper Håkansson <jesper@jesperh.se>",
+  "author": "wasm-bindgen Contributors",
   "license": "MIT OR Apache-2.0",
   "bugs": {
     "url": "https://github.com/wasm-bindgen/wasm-pack/issues"
   },
   "homepage": "https://github.com/wasm-bindgen/wasm-pack#readme",
-  "dependencies": {
-    "binary-install": "^1.1.2"
+  "engines": {
+    "node": ">=16"
   },
-  "resolutions": {
-    "tar": "^7.5.3",
-    "axios": "^0.30.0"
+  "dependencies": {
+    "tar": "^7.5.3"
   }
 }
```

**File**: `npm/run.js` (modified, +4/-1)
```diff
@@ -1,4 +1,7 @@
 #!/usr/bin/env node
 
 const { run } = require("./binary");
-run();
+run().catch((e) => {
+  console.error(e.message || e);
+  process.exit(1);
+});
```

**File**: `npm/yarn.lock` (modified, +7/-256)
```diff
@@ -9,235 +9,15 @@
   dependencies:
     minipass "^7.0.4"
 
-asynckit@^0.4.0:
-  version "0.4.0"
-  resolved "https://registry.yarnpkg.com/asynckit/-/asynckit-0.4.0.tgz#c79ed97f7f34cb8f2ba1bc9790bcc366474b4b79"
-  integrity sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==
-
-axios@^0.26.1, axios@^0.30.0:
-  version "0.30.2"
-  resolved "https://registry.yarnpkg.com/axios/-/axios-0.30.2.tgz#256d3a8ee765cc27188d08b8b545a5f5a0c77dad"
-  integrity sha512-0pE4RQ4UQi1jKY6p7u6i1Tkzqmu+d+/tHS7Q7rKunWLB9WyilBTpHHpXzPNMDj5hTbK0B0PTLSz07yqMBiF6xg==
-  dependencies:
-    follow-redirects "^1.15.4"
-    form-data "^4.0.4"
-    proxy-from-env "^1.1.0"
-
-balanced-match@^1.0.0:
-  version "1.0.2"
-  resolved "https://registry.yarnpkg.com/balanced-match/-/balanced-match-1.0.2.tgz#e83e3a7e3f300b34cb9d87f615fa0cbf357690ee"
-  integrity sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==
-
-binary-install@^1.1.2:
-  version "1.1.2"
-  resolved "https://registry.yarnpkg.com/binary-install/-/binary-install-1.1.2.tgz#06f059e5475e2a208d65ead8cb523d7845a83038"
-  integrity sha512-ZS2cqFHPZOy4wLxvzqfQvDjCOifn+7uCPqNmYRIBM/03+yllON+4fNnsD0VJdW0p97y+E+dTRNPStWNqMBq+9g==
-  dependencies:
-    axios "^0.26.1"
-    rimraf "^3.0.2"
-    tar "^6.1.11"
-
-brace-expansion@^1.1.7:
-  version "1.1.14"
-  resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-1.1.14.tgz#d9de602370d91347cd9ddad1224d4fd701eb348b"
-  integrity sha512-MWPGfDxnyzKU7rNOW9SP/c50vi3xrmrua/+6hfPbCS2ABNWfx24vPidzvC7krjU/RTo235sV776ymlsMtGKj8g==
-  dependencies:
-    balanced-match "^1.0.0"
-    concat-map "0.0.1"
-
-call-bind-apply-helpers@^1.0.1, call-bind-apply-helpers@^1.0.2:
-  version "1.0.2"
-  resolved "https://registry.yarnpkg.com/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz#4b5428c222be985d79c3d82657479dbe0b59b2d6"
-  integrity sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==
-  dependencies:
-    es-errors "^1.3.0"
-    function-bind "^1.1.2"
-
 chownr@^3.0.0:
   version "3.0.0"
   resolved "https://registry.yarnpkg.com/chownr/-/chownr-3.0.0.tgz#9855e64ecd240a9cc4267ce8a4aa5d24a1da15e4"
   integrity sha512-+IxzY9BZOQd/XuYPRmrvEVjF/nqj5kgT4kEq7VofrDoM1MxoRjEWkrCC3EtLi59TVawxTAn+orJwFQcrqEN1+g==
 
-combined-stream@^1.0.8:
-  version "1.0.8"
-  resolved "https://registry.yarnpkg.com/combined-stream/-/combined-stream-1.0.8.tgz#c3d45a8b34fd730631a110a8a2520682b31d5a7f"
-  integrity sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==
-  dependencies:
-    delayed-stream "~1.0.0"
-
-concat-map@0.0.1:
-  version "0.0.1"
-  resolved "https://registry.yarnpkg.com/concat-map/-/concat-map-0.0.1.tgz#d8a96bd77fd68df7793a73036a3ba0d5405d477b"
-  integrity sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==
-
-delayed-stream@~1.0.0:
-  version "1.0.0"
-  resolved "https://registry.yarnpkg.com/delayed-stream/-/delayed-stream-1.0.0.tgz#df3ae199acadfb7d440aaae0b29e2272b24ec619"
-  integrity sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==
-
-dunder-proto@^1.0.1:
-  version "1.0.1"
-  resolved "https://registry.yarnpkg.com/dunder-proto/-/dunder-proto-1.0.1.tgz#d7ae667e1dc83482f8b70fd0f6eefc50da30f58a"
-  integrity sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==
-  dependencies:
-    call-bind-apply-helpers "^1.0.1"
-    es-errors "^1.3.0"
-    gopd "^1.2.0"
-
-es-define-property@^1.0.1:
-  version "1.0.1"
-  resolved "https://registry.yarnpkg.com/es-define-property/-/es-define-property-1.0.1.tgz#983eb2f9a6724e9303f61addf011c72e09e0b0fa"
-  integrity sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==
-
-es-errors@^1.3.0:
-  version "1.3.0"
-  resolved "https://registry.yarnpkg.com/es-errors/-/es-errors-1.3.0.tgz#05f75a25dab98e4fb1dcd5e1472c0546d5057c8f"
-  integrity sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==
-
-es-object-atoms@^1.0.0, es-object-atoms@^1.1.1:
-  version "1.1.1"
-  resolved "https://registry.yarnpkg.com/es-object-atoms/-/es-object-atoms-1.1.1.tgz#1c4f2c4837327597ce69d2ca190a7fdd172338c1"
-  integrity sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==
-  dependencies:
-    es-errors "^1.3.0"
-
-es-set-tostringtag@^2.1.0:
-  version "2.1.0"
-  resolved "https://registry.yarnpkg.com/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz#f31dbbe0c183b00a6d26eb6325c810c0fd18bd4d"
-  integrity sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==
-  dependencies:
-    es-errors "^1.3.0"
-    get-intrinsic "^1.2.6"
-    has-tostringtag "^1.0.2"
-    hasown "^2.0.2"
-
-follow-redirects@^1.15.4:
-  version "1.16.0"
-  resolved "https://registry.yarnp
```

---

### Incident Patch 7: `a127ae20` (2026-05-13)
**Commit Message**: fix(installer): make init.sh POSIX-compatible and stop mangling $VERSION (#1578)

Two bugs broke `curl https://wasm-bindgen.github.io/wasm-pack/installer/init.sh -sSf | sh`:

1. The arg-parsing block introduced in 15e4f4f8 used bash arrays
   (`ORIG_ARGS=("$@")` / `"${ORIG_ARGS[@]}"`), so any non-bash POSIX
   shell (dash, ash, BusyBox sh) failed with a syntax error. This is
   issue #1527.

2. `docs/_installer/build-installer.rs` does a literal `$VERSION` ->
   `vX.Y.Z` text replacement on the script. Since 15e4f4f8 also added
   real `$VERSION` shell expansions (`if [ -z "$VERSION" ]`, the
   `case "$VERSION"`, etc.), every one of those got mangled in the
   published artifact, e.g. `if [ -z "v0.14.0" ]` and
   `VERSION="vv0.14.0"`. The runtime --version / VERSION-env override
   has been silently broken in every published release since.

This commit:

* switches the build-time placeholder to `@@WASM_PACK_VERSION@@` so it
  cannot collide with real shell variable references (both in init.sh
  and index.html).
* rewrites init.sh as POSIX sh: no arrays, no `local`, scans args via
  `for _arg in "$@"` without consuming them so they still pass
  through to wasm-pack-init.
* keeps the

**File**: `docs/_installer/build-installer.rs` (modified, +1/-1)
```diff
@@ -26,5 +26,5 @@ fn fixup(input: &str) -> String {
         .unwrap();
     let version = &version[version.find('"').unwrap() + 1..version.rfind('"').unwrap()];
 
-    input.replace("$VERSION", &format!("v{}", version))
+    input.replace("@@WASM_PACK_VERSION@@", &format!("v{}", version))
 }
```

**File**: `docs/_installer/index.html` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ <h1>Install <code>wasm-pack</code></h1>
           You appear to be running Windows 64-bit. Download and run
           <a
             class="winlink"
-            href="https://github.com/wasm-bindgen/wasm-pack/releases/download/$VERSION/wasm-pack-init.exe"
+            href="https://github.com/wasm-bindgen/wasm-pack/releases/download/@@WASM_PACK_VERSION@@/wasm-pack-init.exe"
             >wasm-pack-init.exe</a
           >
           then follow the onscreen instructions.
```

**File**: `docs/_installer/init.sh` (modified, +55/-50)
```diff
@@ -1,4 +1,4 @@
-#!/bin/bash
+#!/bin/sh
 # Copyright 2016 The Rust Project Developers. See the COPYRIGHT
 # file at the top-level directory of this distribution and at
 # http://rust-lang.org/COPYRIGHT.
@@ -15,29 +15,43 @@
 
 set -u
 
-# Parse VERSION from environment or --version argument, default to "latest"
-if [ -z "${VERSION:-}" ]; then
-    VERSION=""
-    ORIG_ARGS=("$@")
-    
-    while [ $# -gt 0 ]; do
-        case $1 in
-            --version)
-                VERSION="$2"
-                shift 2
-                ;;
-            *)
-                shift
-                ;;
-        esac
+# The version baked in at build time by docs/_installer/build-installer.rs.
+# The sentinel below is replaced with the published release tag (e.g. "v0.14.0").
+DEFAULT_VERSION="@@WASM_PACK_VERSION@@"
+
+say() {
+    echo "wasm-pack-init: $1"
+}
+
+err() {
+    say "$1" >&2
+    exit 1
+}
+
+# Resolve VERSION precedence: explicit env > --version arg > build-time default > "latest".
+# We scan args without consuming them so they pass through unchanged to the installer.
+resolve_version() {
+    if [ -n "${VERSION:-}" ]; then
+        return
+    fi
+
+    _prev=""
+    for _arg in "$@"; do
+        if [ "$_prev" = "--version" ]; then
+            VERSION="$_arg"
+            return
+        fi
+        _prev="$_arg"
     done
-    
-    set -- "${ORIG_ARGS[@]}"
-    
-    if [ -z "$VERSION" ]; then
+
+    if [ -n "$DEFAULT_VERSION" ]; then
+        VERSION="$DEFAULT_VERSION"
+    else
         VERSION="latest"
     fi
-fi
+}
+
+resolve_version "$@"
 
 # Resolve "latest" to actual version number
 if [ "$VERSION" = "latest" ]; then
@@ -47,7 +61,7 @@ if [ "$VERSION" = "latest" ]; then
     fi
 fi
 
-# Normalize version format for download URL
+# Normalize version format for download URL (ensure leading "v")
 case "$VERSION" in
     v*) ;;
     *) VERSION="v$VERSION" ;;
@@ -68,10 +82,10 @@ main() {
     need_cmd dirname
 
     get_architecture || return 1
-    local _arch="$RETVAL"
+    _arch="$RETVAL"
     assert_nz "$_arch" "arch"
 
-    local _ext=""
+    _ext=""
     case "$_arch" in
         *windows*)
             _ext=".exe"
@@ -80,13 +94,13 @@ main() {
 
     which rustup > /dev/null 2>&1
     need_ok "failed to find Rust installation, is rustup installed?"
-    local _rustup=$(which rustup)
-    local _tardir="wasm-pack-$VERSION-${_arch}"
-    local _url="$UPDATE_ROOT/${_tardir}.tar.gz"
-    local _dir="$(mktemp -d 2>/dev/null || ensure mktemp -d -t wasm-pack)"
-    local _file="$_dir/input.tar.gz"
-    local _wasmpack="$_dir/wasm-pack$_ext"
-    local _wasmpackinit="$_dir/wasm-pack-init$_ext"
+    _rustup=$(which rustup)
+    _tardir="wasm-pack-$VERSION-${_arch}"
+    _url="$UPDATE_ROOT/${_tardir}.tar.gz"
+    _dir="$(mktemp -d 2>/dev/null || ensure mktemp -d -t wasm-pack)"
+    _file="$_dir/input.tar.gz"
+    _wasmpack="$_dir/wasm-pack$_ext"
+    _wasmpackinit="$_dir/wasm-pack-init$_ext"
 
     printf '%s\n' 'info: downloading wasm-pack' 1>&2
 
@@ -112,16 +126,16 @@ main() {
       "$_wasmpackinit" "$@"
     fi
 
-    local _retval=$?
+    _retval=$?
 
     ignore rm -rf "$_dir"
 
     return "$_retval"
 }
 
 get_architecture() {
-    local _ostype="$(uname -s)"
-    local _cputype="$(uname -m)"
+    _ostype="$(uname -s)"
+    _cputype="$(uname -m)"
 
     # This is when installing inside docker, or can be useful to side-step
     # the script's built-in platform detection heuristic (if it drifts again in the future)
@@ -139,21 +153,21 @@ get_architecture() {
     if [ "$_ostype" = Darwin ] && [ "$_cputype" = i386 ]; then
         # Darwin `uname -s` lies
         if sysctl hw.optional.x86_64 | grep -q ': 1'; then
-            local _cputype=x86_64
+            _cputype=x86_64
         fi
     fi
 
     case "$_ostype" in
         Linux | linux)
-            local _ostype=unknown-linux-musl
+            _ostype=unknown-linux-musl
             ;;
 
         Darwin)
-            local _ostype=apple-darwin
+            _ostype=apple-darwin
             ;;
 
         MINGW* | MSYS* | CYGWIN*)
-            local _ostype=pc-windows-msvc
+            _ostype=pc-windows-msvc
             ;;
 
         *)
@@ -163,10 +177,10 @@ get_architecture() {
 
     case "$_cputype" in
         x86_64 | x86-64 | x64 | amd64)
-            local _cputype=x86_64
+            _cputype=x86_64
             ;;
         arm64 | aarch64)
-            local _cputype=aarch64
+            _cputype=aarch64
             ;;
         *)
             err "no precompiled binaries available for CPU architecture: $_cputype"
@@ -178,20 +192,11 @@ get_architecture() {
         _cputype="x86_64"
     fi
 
-    local _arch="$_cputype-$_ostype"
+    _arch="$_cputype-$_ostype"
 
     RETVAL="$_arch"
 }
 
-say() {
-    echo "wasm-pack-init: $1"
-}
-
-err() {
-    say "$1" >&2
-    exit 1
-}
-
 need_cmd() {
     if ! check_cmd "$1"
     then err "need '$1' (command not found)"
```

---

### Incident Patch 8: `1e6c1de3` (2026-05-13)
**Commit Message**: feat: add --panic-unwind flag to build and test commands (#1572)

Adds a new --panic-unwind option to `wasm-pack build` and `wasm-pack test`
that builds with `-Cpanic=unwind` instead of the default `panic=abort`.

When the flag is set, cargo is invoked via `+nightly` with
`-Z build-std=std,panic_unwind` and `RUSTFLAGS` is augmented with
`-Cpanic=unwind` (preserving any user-provided `RUSTFLAGS`). The nightly
toolchain, `rust-src` component, and nightly `wasm32-unknown-unknown`
target are auto-installed via `rustup` if not already present. The stable
rustc and wasm-target preflight checks are skipped when --panic-unwind is
set, since they are irrelevant for the nightly invocation.

This is a build-tool-level enabler: it produces a wasm artifact compiled
with unwinding semantics. The actual conversion of caught panics into
JavaScript exceptions is the responsibility of the consuming bindings layer
(e.g. wasm-bindgen's catch-unwind support).

**File**: `docs/src/commands/build.md` (modified, +39/-0)
```diff
@@ -138,6 +138,45 @@ example, to build the previous example using cargo's offline feature:
 wasm-pack build examples/js-hello-world --mode no-install -- --offline
 ```
 
+## Panic strategy
+
+By default, Rust panics in WebAssembly compile with `panic=abort`, which aborts
+the WebAssembly instance on panic. The `--panic-unwind` flag changes this so
+panics can be caught at FFI boundaries and converted to JavaScript exceptions
+by tools like [`wasm-bindgen`'s catch-unwind support][wbg-catch-unwind].
+
+```
+wasm-pack build --panic-unwind
+```
+
+This flag:
+
+- Invokes `cargo` with the **nightly** toolchain (`cargo +nightly build`).
+- Adds `-Z build-std=std,panic_unwind` to rebuild `std` with unwinding
+  support.
+- Sets `RUSTFLAGS=-Cpanic=unwind` (preserving any user-provided `RUSTFLAGS`).
+
+The first time you use `--panic-unwind`, `wasm-pack` will install any missing
+prerequisites via `rustup`:
+
+- The nightly toolchain
+- The `rust-src` component for nightly
+- The `wasm32-unknown-unknown` target for nightly
+
+If you are not using `rustup` you must install these prerequisites manually.
+See [Non-`rustup` setups][non-rustup].
+
+> **Note:** `wasm-pack` only handles producing the `.wasm`. The actual
+> "panic = recoverable JavaScript exception" behaviour requires runtime glue
+> from your bindings layer (e.g. `wasm-bindgen`'s catch-unwind feature). With
+> just `--panic-unwind` and no runtime glue, panics still terminate the
+> instance — they are merely *unwound* rather than *aborted*.
+
+`--panic-unwind` is also available for [`wasm-pack test`](./test.md).
+
+[wbg-catch-unwind]: https://wasm-bindgen.github.io/wasm-bindgen/reference/catch-unwind.html
+[non-rustup]: ../prerequisites/non-rustup-setups.md
+
 <hr style="font-size: 1.5em; margin-top: 2.5em"/>
 
 <sup id="footnote-0">0</sup> If you need to include additional assets in the pkg
```

**File**: `docs/src/commands/test.md` (modified, +10/-0)
```diff
@@ -39,6 +39,16 @@ Choose where to run your tests by passing in any combination of testing environm
 wasm-pack test --node --firefox --chrome --safari --headless
 ```
 
+## Panic strategy
+
+The `test` command accepts the `--panic-unwind` flag, which builds the test
+binary with `panic=unwind` via the nightly toolchain and `-Z build-std`. See
+the [`build` command's documentation](./build.md#panic-strategy) for details.
+
+```
+wasm-pack test --node --panic-unwind
+```
+
 ## Extra options
 
 The `test` command can pass extra options straight to `cargo test` even if they are not
```

**File**: `src/build/mod.rs` (modified, +48/-4)
```diff
@@ -80,12 +80,22 @@ pub fn cargo_build_wasm(
     profile: BuildProfile,
     extra_options: &[String],
     target_triple: &str,
+    panic_unwind: bool,
 ) -> Result<String> {
-    let msg = format!("{}Compiling to Wasm...", emoji::CYCLONE);
+    let msg = if panic_unwind {
+        format!("{}Compiling to Wasm (with panic=unwind)...", emoji::CYCLONE)
+    } else {
+        format!("{}Compiling to Wasm...", emoji::CYCLONE)
+    };
     PBAR.info(&msg);
 
     let mut cmd = Command::new("cargo");
-    cmd.current_dir(path).arg("build").arg("--lib");
+    cmd.current_dir(path);
+    // `+nightly` must be the first argument to cargo.
+    if panic_unwind {
+        cmd.arg("+nightly");
+    }
+    cmd.arg("build").arg("--lib");
 
     if PBAR.quiet() {
         cmd.arg("--quiet");
@@ -114,6 +124,19 @@ pub fn cargo_build_wasm(
 
     cmd.env("CARGO_BUILD_TARGET", target_triple);
 
+    if panic_unwind {
+        cmd.arg("-Z").arg("build-std=std,panic_unwind");
+
+        // Append `-Cpanic=unwind` to any user-provided RUSTFLAGS.
+        let existing = std::env::var("RUSTFLAGS").unwrap_or_default();
+        let combined = if existing.is_empty() {
+            "-Cpanic=unwind".to_string()
+        } else {
+            format!("{existing} -Cpanic=unwind")
+        };
+        cmd.env("RUSTFLAGS", combined);
+    }
+
     // The `cargo` command is executed inside the directory at `path`, so relative paths set via extra options won't work.
     // To remedy the situation, all detected paths are converted to absolute paths.
     let mut handle_path = false;
@@ -191,15 +214,24 @@ pub fn cargo_build_wasm(
 /// * `path`: Path to the crate directory to build tests.
 /// * `debug`: Whether to build tests in `debug` mode.
 /// * `extra_options`: Additional parameters to pass to `cargo` when building tests.
+/// * `target_triple`: The wasm target triple to build for (e.g.
+///   `wasm32-unknown-unknown` or `wasm64-unknown-unknown`).
+/// * `panic_unwind`: Whether to build tests with `panic=unwind` via the nightly
+///   toolchain and `-Z build-std`.
 pub fn cargo_build_wasm_tests(
     path: &Path,
     debug: bool,
     extra_options: &[String],
     target_triple: &str,
+    panic_unwind: bool,
 ) -> Result<()> {
     let mut cmd = Command::new("cargo");
-
-    cmd.current_dir(path).arg("build").arg("--tests");
+    cmd.current_dir(path);
+    // `+nightly` must be the first argument to cargo.
+    if panic_unwind {
+        cmd.arg("+nightly");
+    }
+    cmd.arg("build").arg("--tests");
 
     if PBAR.quiet() {
         cmd.arg("--quiet");
@@ -211,6 +243,18 @@ pub fn cargo_build_wasm_tests(
 
     cmd.env("CARGO_BUILD_TARGET", target_triple);
 
+    if panic_unwind {
+        cmd.arg("-Z").arg("build-std=std,panic_unwind");
+
+        let existing = std::env::var("RUSTFLAGS").unwrap_or_default();
+        let combined = if existing.is_empty() {
+            "-Cpanic=unwind".to_string()
+        } else {
+            format!("{existing} -Cpanic=unwind")
+        };
+        cmd.env("RUSTFLAGS", combined);
+    }
+
     cmd.args(extra_options);
 
     child::run(cmd, "cargo build").context("Compilation of your program failed")?;
```

**File**: `src/build/wasm_target.rs` (modified, +133/-0)
```diff
@@ -160,3 +160,136 @@ fn rustup_add_wasm_target(target: &str) -> Result<()> {
 
     Ok(())
 }
+
+const NIGHTLY_TOOLCHAIN: &str = "nightly";
+
+/// Ensure that the nightly toolchain is installed and has the `rust-src`
+/// component and `wasm32-unknown-unknown` target, all of which are required
+/// for `-Z build-std` (used by `--panic-unwind`). Missing components are
+/// installed automatically via `rustup`.
+pub fn check_nightly_prerequisites() -> Result<()> {
+    let msg = format!(
+        "{}Checking nightly toolchain prerequisites for panic=unwind...",
+        emoji::TARGET
+    );
+    PBAR.info(&msg);
+
+    let nightly_sysroot = get_nightly_sysroot()?;
+    if !nightly_sysroot.exists() {
+        install_nightly_toolchain()?;
+    }
+
+    if !has_rust_src_component()? {
+        install_rust_src_component()?;
+    }
+
+    if !does_nightly_wasm32_target_exist() {
+        rustup_add_wasm_target_nightly()?;
+    }
+
+    Ok(())
+}
+
+fn get_nightly_sysroot() -> Result<PathBuf> {
+    let command = Command::new("rustc")
+        .args(["+nightly", "--print", "sysroot"])
+        .output()?;
+
+    if command.status.success() {
+        Ok(String::from_utf8(command.stdout)?.trim().into())
+    } else {
+        Err(anyhow!(
+            "Getting nightly rustc's sysroot wasn't successful. Got {}",
+            command.status
+        ))
+    }
+}
+
+fn install_nightly_toolchain() -> Result<()> {
+    let msg = format!(
+        "{}Installing nightly toolchain via rustup...",
+        emoji::TARGET
+    );
+    PBAR.info(&msg);
+
+    let mut cmd = Command::new("rustup");
+    cmd.arg("toolchain").arg("install").arg(NIGHTLY_TOOLCHAIN);
+    child::run(cmd, "rustup").context("Installing the nightly toolchain with rustup")?;
+
+    Ok(())
+}
+
+fn has_rust_src_component() -> Result<bool> {
+    let command = Command::new("rustup")
+        .args(["component", "list", "--toolchain", NIGHTLY_TOOLCHAIN])
+        .output()?;
+
+    if !command.status.success() {
+        return Ok(false);
+    }
+
+    let stdout = String::from_utf8(command.stdout)?;
+    Ok(stdout
+        .lines()
+        .any(|line| line.starts_with("rust-src") && line.contains("(installed)")))
+}
+
+fn install_rust_src_component() -> Result<()> {
+    let msg = format!(
+        "{}Installing rust-src component for nightly toolchain...",
+        emoji::TARGET
+    );
+    PBAR.info(&msg);
+
+    let mut cmd = Command::new("rustup");
+    cmd.arg("component")
+        .arg("add")
+        .arg("rust-src")
+        .arg("--toolchain")
+        .arg(NIGHTLY_TOOLCHAIN);
+    child::run(cmd, "rustup").context("Adding the rust-src component with rustup")?;
+
+    Ok(())
+}
+
+fn does_nightly_wasm32_target_exist() -> bool {
+    let command = Command::new("rustc")
+        .args([
+            "+nightly",
+            "--target",
+            "wasm32-unknown-unknown",
+            "--print",
+            "target-libdir",
+        ])
+        .output();
+
+    match command {
+        Ok(output) if output.status.success() => {
+            let path: PathBuf = String::from_utf8(output.stdout)
+                .ok()
+                .map(|s| s.trim().into())
+                .unwrap_or_default();
+            path.exists()
+        }
+        _ => false,
+    }
+}
+
+fn rustup_add_wasm_target_nightly() -> Result<()> {
+    let msg = format!(
+        "{}Adding wasm32-unknown-unknown target for nightly toolchain...",
+        emoji::TARGET
+    );
+    PBAR.info(&msg);
+
+    let mut cmd = Command::new("rustup");
+    cmd.arg("target")
+        .arg("add")
+        .arg("wasm32-unknown-unknown")
+        .arg("--toolchain")
+        .arg(NIGHTLY_TOOLCHAIN);
+    child::run(cmd, "rustup")
+        .context("Adding the wasm32-unknown-unknown target for nightly with rustup")?;
+
+    Ok(())
+}
```

**File**: `src/command/build.rs` (modified, +25/-0)
```diff
@@ -41,6 +41,7 @@ pub struct Build {
     pub bindgen: Option<install::Status>,
     pub cache: Cache,
     pub extra_options: Vec<String>,
+    pub panic_unwind: bool,
     target_triple: String,
     wasm_path: Option<String>,
 }
@@ -184,6 +185,15 @@ pub struct BuildOptions {
     /// Option to skip optimization with wasm-opt
     pub no_opt: bool,
 
+    #[clap(long = "panic-unwind")]
+    /// Build with panic=unwind. Requires the nightly Rust toolchain; uses
+    /// `-Z build-std` to rebuild `std` with `-Cpanic=unwind` so panics can be
+    /// caught at FFI boundaries instead of aborting the WebAssembly instance.
+    /// The nightly toolchain, `rust-src` component, and nightly
+    /// `wasm32-unknown-unknown` target will be installed via `rustup` if not
+    /// already present.
+    pub panic_unwind: bool,
+
     /// List of extra options to pass to `cargo build`
     pub extra_options: Vec<String>,
 }
@@ -207,6 +217,7 @@ impl Default for BuildOptions {
             profile: None,
             out_dir: String::new(),
             out_name: None,
+            panic_unwind: false,
             extra_options: Vec::new(),
         }
     }
@@ -278,6 +289,7 @@ impl Build {
             cache: cache::get_wasm_pack_cache()?,
             target_triple: target_triple.to_owned(),
             extra_options,
+            panic_unwind: build_opts.panic_unwind,
             wasm_path: None,
         })
     }
@@ -364,6 +376,12 @@ impl Build {
     }
 
     fn step_check_rustc_version(&mut self) -> Result<()> {
+        // The stable rustc version is irrelevant when --panic-unwind is set,
+        // since cargo will be invoked via `+nightly`.
+        if self.panic_unwind {
+            info!("Skipping rustc version check (using nightly via --panic-unwind).");
+            return Ok(());
+        }
         info!("Checking rustc version...");
         let version = build::check_rustc_version()?;
         let msg = format!("rustc version is {}.", version);
@@ -379,6 +397,12 @@ impl Build {
     }
 
     fn step_check_for_wasm_target(&mut self) -> Result<()> {
+        if self.panic_unwind {
+            info!("Checking nightly toolchain prerequisites for panic=unwind...");
+            build::wasm_target::check_nightly_prerequisites()?;
+            info!("Nightly prerequisites check was successful.");
+            return Ok(());
+        }
         info!("Checking for wasm-target...");
         build::wasm_target::check_for_wasm_target(&self.target_triple)?;
         info!("Checking for wasm-target was successful.");
@@ -392,6 +416,7 @@ impl Build {
             self.profile.clone(),
             &self.extra_options,
             &self.target_triple,
+            self.panic_unwind,
         )?;
         info!("wasm built at {wasm_path:#?}.");
         self.wasm_path = Some(wasm_path);
```

**File**: `src/command/test.rs` (modified, +22/-0)
```diff
@@ -73,6 +73,13 @@ pub struct TestOptions {
     /// Build with the release profile.
     pub release: bool,
 
+    #[clap(long = "panic-unwind")]
+    /// Build tests with panic=unwind. Requires the nightly Rust toolchain;
+    /// uses `-Z build-std` to rebuild `std` with `-Cpanic=unwind`. The nightly
+    /// toolchain, `rust-src` component, and nightly `wasm32-unknown-unknown`
+    /// target will be installed via `rustup` if not already present.
+    pub panic_unwind: bool,
+
     /// Path to the Rust crate, and extra options to pass to `cargo test`.
     ///
     /// If the path is not provided, this command searches up the path from the current directory.
@@ -97,6 +104,7 @@ pub struct Test {
     safaridriver: Option<PathBuf>,
     headless: bool,
     release: bool,
+    panic_unwind: bool,
     test_runner_path: Option<PathBuf>,
     extra_options: Vec<String>,
     target_triple: String,
@@ -112,6 +120,7 @@ impl Test {
             mode,
             headless,
             release,
+            panic_unwind,
             chrome,
             chromedriver,
             firefox,
@@ -175,6 +184,7 @@ impl Test {
             safaridriver,
             headless,
             release,
+            panic_unwind,
             test_runner_path: None,
             target_triple,
             extra_options,
@@ -256,13 +266,24 @@ impl Test {
     }
 
     fn step_check_rustc_version(&mut self) -> Result<()> {
+        // Stable rustc version is irrelevant when --panic-unwind is set.
+        if self.panic_unwind {
+            info!("Skipping rustc version check (using nightly via --panic-unwind).");
+            return Ok(());
+        }
         info!("Checking rustc version...");
         let _ = build::check_rustc_version()?;
         info!("Rustc version is correct.");
         Ok(())
     }
 
     fn step_check_for_wasm_target(&mut self) -> Result<()> {
+        if self.panic_unwind {
+            info!("Checking nightly toolchain prerequisites for panic=unwind...");
+            build::wasm_target::check_nightly_prerequisites()?;
+            info!("Nightly prerequisites check was successful.");
+            return Ok(());
+        }
         info!("Adding wasm-target...");
         build::wasm_target::check_for_wasm_target(&self.target_triple)?;
         info!("Adding wasm-target was successful.");
@@ -285,6 +306,7 @@ impl Test {
             !self.release,
             extra_options,
             &self.target_triple,
+            self.panic_unwind,
         )?;
 
         info!("Finished compiling tests to wasm.");
```

---

### Incident Patch 9: `ba62a517` (2026-04-28)
**Commit Message**: chore(deps): bump brace-expansion from 1.1.12 to 1.1.14 in /npm (#1574)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.12 to 1.1.14.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.12...v1.1.14)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.14
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `npm/yarn.lock` (modified, +3/-3)
```diff
@@ -38,9 +38,9 @@ binary-install@^1.1.2:
     tar "^6.1.11"
 
 brace-expansion@^1.1.7:
-  version "1.1.12"
-  resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-1.1.12.tgz#ab9b454466e5a8cc3a187beaad580412a9c5b843"
-  integrity sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==
+  version "1.1.14"
+  resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-1.1.14.tgz#d9de602370d91347cd9ddad1224d4fd701eb348b"
+  integrity sha512-MWPGfDxnyzKU7rNOW9SP/c50vi3xrmrua/+6hfPbCS2ABNWfx24vPidzvC7krjU/RTo235sV776ymlsMtGKj8g==
   dependencies:
     balanced-match "^1.0.0"
     concat-map "0.0.1"
```

---

### Incident Patch 10: `7f7027e2` (2026-04-28)
**Commit Message**: Fix typo in prerequisites documentation (#1545)

**File**: `docs/src/prerequisites/considerations.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # nodejs
 
-Currently, `wasm-pack` generated npm modules require us to you have [fetch] polyfill in your node project.
+Currently, `wasm-pack` generated npm modules require you to have the [fetch] polyfill in your node project.
 
 If there is a module from `wasm-pack build --target nodejs` you may encounter some errors regarding global `Headers`, `Request`, `Response` and `fetch` Web APIs.
 
```

---

### Incident Patch 11: `41ad77cf` (2026-01-12)
**Commit Message**: Merge pull request #1529 from kaleidawave/add-aarch64-apple-darwin-build

Add aarch64 apple darwin build

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -215,4 +215,4 @@ jobs:
           upload_url: ${{ steps.create_release.outputs.upload_url }}
           asset_path: ./wasm-pack-${{ steps.get_version.outputs.VERSION }}-${{ env.MACOS_ARM64_TARGET }}.tar.gz
           asset_content_type: application/gzip
-          asset_name: wasm-pack-${{ steps.get_version.outputs.VERSION }}-${{ env.MACOS_ARM64_TARGET }}.tar.gz
\ No newline at end of file
+          asset_name: wasm-pack-${{ steps.get_version.outputs.VERSION }}-${{ env.MACOS_ARM64_TARGET }}.tar.gz
```

**File**: `npm/binary.js` (modified, +4/-1)
```diff
@@ -18,9 +18,12 @@ const getPlatform = () => {
   if (type === "Linux" && arch === "arm64") {
     return "aarch64-unknown-linux-musl";
   }
-  if (type === "Darwin" && (arch === "x64" || arch === "arm64")) {
+  if (type === "Darwin" && arch === "x64") {
     return "x86_64-apple-darwin";
   }
+  if (type === "Darwin" && arch === "arm64") {
+    return "aarch64-apple-darwin";
+  }
 
   throw new Error(`Unsupported platform: ${type} ${arch}`);
 };
```

---

### Incident Patch 12: `437d1ca5` (2026-01-12)
**Commit Message**: Merge branch 'master' into add-aarch64-apple-darwin-build

**File**: `.github/workflows/approve.yml` (modified, +3/-0)
```diff
@@ -1,4 +1,7 @@
 name: Automatic Approve
+permissions:
+  contents: read
+  pull-requests: write
 on:
   schedule: 
     - cron: "0 0 * * *"
```

**File**: `.github/workflows/book.yml` (modified, +2/-0)
```diff
@@ -6,6 +6,8 @@ on:
 
 jobs:
   book:
+    permissions:
+      contents: write
     name: Build and deploy book
     runs-on: ubuntu-latest
     steps:
```

**File**: `.github/workflows/release.yml` (modified, +13/-8)
```diff
@@ -4,6 +4,8 @@ on:
       - 'v*' # Run when tag matches v*, i.e. v1.0, v20.15.10
 
 name: Release
+permissions:
+  contents: read
 
 env:
   RELEASE_BIN: wasm-pack
@@ -37,6 +39,9 @@ jobs:
           - target: x86_64-apple-darwin
             os: macos-latest
             rust: stable
+          - target: aarch64-apple-darwin
+            os: macos-latest
+            rust: stable
           - target: x86_64-pc-windows-msvc
             os: windows-latest
             rust: stable
@@ -112,6 +117,8 @@ jobs:
   release:
     name: GitHub Release
     needs: build
+    permissions:
+      contents: write
     runs-on: ubuntu-latest
     steps:
       - name: Query version number
@@ -145,15 +152,14 @@ jobs:
         with:
           name: ${{ env.WINDOWS_TARGET }}
 
-      - name: Download MacOS amd64 tarball
+      - name: Download ARM64 MacOS tarball
         uses: actions/download-artifact@v4.1.7
         with:
-          name: ${{ env.MACOS_AMD64_TARGET }}
-  
-      - name: Download MacOS arm64 tarball
+          name: ${{ env.MACOS_ARM64_TARGET }}
+      - name: Download AMD64 MacOS tarball
         uses: actions/download-artifact@v4.1.7
         with:
-          name: ${{ env.MACOS_ARM64_TARGET }}
+          name: ${{ env.MACOS_AMD64_TARGET }}
 
       - name: Release Linux amd64 tarball
         uses: actions/upload-release-asset@v1
@@ -195,7 +201,7 @@ jobs:
           asset_content_type: application/vnd.microsoft.portable-executable
           asset_name: wasm-pack-init.exe
 
-      - name: Release MacOS amd64 tarball
+      - name: Release AMD64 MacOS tarball
         uses: actions/upload-release-asset@v1
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
@@ -204,8 +210,7 @@ jobs:
           asset_path: ./wasm-pack-${{ steps.get_version.outputs.VERSION }}-${{ env.MACOS_AMD64_TARGET }}.tar.gz
           asset_content_type: application/gzip
           asset_name: wasm-pack-${{ steps.get_version.outputs.VERSION }}-${{ env.MACOS_AMD64_TARGET }}.tar.gz
-      
-      - name: Release MacOS arm64 tarball
+      - name: Release ARM64 MacOS tarball
         uses: actions/upload-release-asset@v1
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.github/workflows/test.yml` (modified, +6/-14)
```diff
@@ -1,17 +1,16 @@
 name: Tests
-
 on:
   push:
     branches:
       - master
   pull_request:
     branches:
       - master
-
 jobs:
   test:
     name: Test
-
+    permissions:
+      contents: read
     runs-on: ${{ matrix.os }}
     strategy:
       matrix:
@@ -26,22 +25,18 @@ jobs:
           - build: windows-stable
             os: windows-latest
             rust: stable
-
     steps:
-      - uses: actions/checkout@v3
+      - uses: actions/checkout@v4
       - uses: nanasess/setup-chromedriver@master
       - if: matrix.os == 'macos-latest'
         run: brew install --cask firefox
       - uses: dtolnay/rust-toolchain@stable
         with:
           toolchain: ${{ matrix.rust }}
           targets: wasm32-unknown-unknown
-      - uses: actions/setup-node@v2
-
+      - uses: actions/setup-node@v3
       - name: Cache dependencies
-        uses: actions/cache@v3
-        env:
-          cache-name: cache-dependencies
+        uses: actions/cache@v4
         with:
           path: |
             ~/.cargo/.crates.toml
@@ -50,15 +45,12 @@ jobs:
             ~/.cargo/registry/index
             ~/.cargo/registry/cache
             target
-          key: ${{ runner.os }}-build-${{ env.cache-name }}-${{ hashFiles('Cargo.lock') }}
-
+          key: ${{ runner.os }}-build-${{ hashFiles('Cargo.lock') }}
       - name: Run Tests
         run: cargo test --all --locked
         env:
           RUST_BACKTRACE: 1
-
       - name: Clippy
         run: cargo clippy
-
       - name: Cargo fmt
         run: cargo fmt --all -- --check
```

**File**: `Cargo.lock` (modified, +1079/-533)
```diff
@@ -1,21 +1,21 @@
 # This file is automatically @generated by Cargo.
 # It is not intended for manual editing.
-version = 3
+version = 4
 
 [[package]]
 name = "addr2line"
-version = "0.24.2"
+version = "0.25.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dfbe277e56a376000877090da837660b4427aad530e3028d44e0bffe4f89a1c1"
+checksum = "1b5d307320b3181d6d7954e663bd7c774a838b8220fe0593c86d9fb09f498b4b"
 dependencies = [
  "gimli",
 ]
 
 [[package]]
 name = "adler2"
-version = "2.0.0"
+version = "2.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "512761e0bb2578dd7380c6baaa0f4ce03e84f95e960231d1dec8bf4d7d6e2627"
+checksum = "320119579fcad9c21884f5c4861d16174d0e06250625266f50fe6898340abefa"
 
 [[package]]
 name = "aes"
@@ -30,19 +30,13 @@ dependencies = [
 
 [[package]]
 name = "aho-corasick"
-version = "1.1.3"
+version = "1.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8e60d3430d3a69478ad0993f19238d2df97c507009a52b3c10addcd7f6bcb916"
+checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
 dependencies = [
  "memchr",
 ]
 
-[[package]]
-name = "android-tzdata"
-version = "0.1.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e999941b234f3131b00bc13c22d06e8c5ff726d1b6318ac7eb276997bbb4fef0"
-
 [[package]]
 name = "android_system_properties"
 version = "0.1.5"
@@ -54,9 +48,9 @@ dependencies = [
 
 [[package]]
 name = "anstream"
-version = "0.6.17"
+version = "0.6.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "23a1e53f0f5d86382dafe1cf314783b2044280f406e7e1506368220ad11b1338"
+checksum = "43d5b281e737544384e969a5ccad3f1cdd24b48086a0fc1b2a5262a26b8f4f4a"
 dependencies = [
  "anstyle",
  "anstyle-parse",
@@ -69,62 +63,62 @@ dependencies = [
 
 [[package]]
 name = "anstyle"
-version = "1.0.9"
+version = "1.0.13"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8365de52b16c035ff4fcafe0092ba9390540e3e352870ac09933bebcaa2c8c56"
+checksum = "5192cca8006f1fd4f7237516f40fa183bb07f8fbdfedaa0036de5ea9b0b45e78"
 
 [[package]]
 name = "anstyle-parse"
-version = "0.2.6"
+version = "0.2.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3b2d16507662817a6a20a9ea92df6652ee4f94f914589377d69f3b21bc5798a9"
+checksum = "4e7644824f0aa2c7b9384579234ef10eb7efb6a0deb83f9630a49594dd9c15c2"
 dependencies = [
  "utf8parse",
 ]
 
 [[package]]
 name = "anstyle-query"
-version = "1.1.2"
+version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "79947af37f4177cfead1110013d678905c37501914fba0efea834c3fe9a8d60c"
+checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
 name = "anstyle-wincon"
-version = "3.0.6"
+version = "3.0.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2109dbce0e72be3ec00bed26e6a7479ca384ad226efdd66db8fa2e3a38c83125"
+checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
- "windows-sys 0.59.0",
+ "once_cell_polyfill",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
 name = "anyhow"
-version = "1.0.91"
+version = "1.0.100"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c042108f3ed77fd83760a5fd79b53be043192bb3b9dba91d8c574c0ada7850c8"
+checksum = "a23eb6b1614318a8071c9b2521f36b424b2c83db5eb3a0fead4a6c0809af6e61"
 
 [[package]]
 name = "arbitrary"
-version = "1.3.2"
+version = "1.4.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7d5a26814d8dcb93b0e5a0ff3c6d80a8843bafb21b39e8e18a6f05471870e110"
+checksum = "c3d036a3c4ab069c7b410a2ce876bd74808d2d0888a82667669f8e783a898bf1"
 dependencies = [
  "derive_arbitrary",
 ]
 
 [[package]]
 name = "assert_cmd"
-version = "2.0.16"
+version = "2.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dc1835b7f27878de8525dc71410b5a31cdcc5f230aed5ba5df968e09c201b23d"
+checksum = "bcbb6924530aa9e0432442af08bbcafdad182db80d2e560da42a6d442535bf85"
 dependencies = [
  "anstyle",
  "bstr",
- "doc-comment",
  "libc",
  "predicates",
  "predicates-core",
@@ -134,23 +128,23 @@ dependencies = [
 
 [[package]]
 name = "autocfg"
-version = "1.4.0"
+version = "1.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ace50bade8e6234aa140d9a2f552bbee1db4d353f69b8217bc503490fc1a9f26"
+checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
 
 [[package]]
 name = "backtrace"
-version = "0.3.74"
+version = "0.3.76"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8d82cb332cdfaed17ae235a638438ac4d4839913cc2af585c3c6746e8f8bee1a"
+checksum = "bb531853791a215d7c62a30daf0dde835f381ab5de4589cfe7c649d2cbe92bd6"
 dependencies = [
  "addr2line",
  "cfg-if",
  "libc",
  "m
```

**File**: `Cargo.toml` (modified, +26/-26)
```diff
@@ -11,35 +11,35 @@ categories = ["wasm"]
 documentation = "https://drager.github.io/wasm-pack/"
 
 [dependencies]
-anyhow = "1.0.68"
+anyhow = "1.0.100"
 binary-install = "0.4.1"
-cargo_metadata = "0.15.2"
-chrono = "0.4.23"
-console = "0.15.5"
-dialoguer = "0.10.3"
-env_logger = { version = "0.10.0", default-features = false }
-glob = "0.3.1"
-human-panic = "1.0.3"
-log = "0.4.17"
-parking_lot = "0.12.1"
-semver = "1.0.16"
-serde = "1.0.152"
-serde_derive = "1.0.152"
-serde_ignored = "0.1.7"
-serde_json = "1.0.91"
-siphasher = "0.3.10"
-strsim = "0.10.0"
+cargo_metadata = "0.23.1"
+chrono = "0.4.42"
+console = "0.16.1"
+dialoguer = "0.12.0"
+env_logger = { version = "0.11.8", default-features = false }
+glob = "0.3.3"
+human-panic = "2.0.4"
+log = "0.4.28"
+parking_lot = "0.12.5"
+semver = "1.0.27"
+serde = "1.0.228"
+serde_derive = "1.0.228"
+serde_ignored = "0.1.14"
+serde_json = "1.0.145"
+siphasher = "1.0.1"
+strsim = "0.11.1"
 clap = { version = "4.2.5", features = ["derive"] }
-toml = "0.7.3"
-ureq = { version = "2.6.2", features = ["json", "socks-proxy"] }
-walkdir = "2.3.2"
-which = "4.4.0"
+toml = "0.9.8"
+ureq = { version = "2.12.1", features = ["json", "socks-proxy"] }
+walkdir = "2.5.0"
+which = "8.0.0"
 path-clean = "1.0.1"
 
 [dev-dependencies]
-assert_cmd = "2.0.8"
-lazy_static = "1.4.0"
-predicates = "3.0.3"
-serial_test = "2.0.0"
-tempfile = "3.3.0"
+assert_cmd = "2.1.1"
+lazy_static = "1.5.0"
+predicates = "3.1.3"
+serial_test = "3.2.0"
+tempfile = "3.23.0"
 
```

**File**: `README.md` (modified, +3/-13)
```diff
@@ -1,6 +1,6 @@
 <div align="center">
 
-  <h1>📦✨  wasm-pack</h1>
+  <h1>📦✨ wasm-pack</h1>
 
   <p>
     <strong>Your favorite Rust → Wasm workflow tool!</strong>
@@ -12,14 +12,13 @@
   </p>
 
   <h3>
-    <a href="https://rustwasm.github.io/docs/wasm-pack/">Docs</a>
+    <a href="https://drager.github.io/wasm-pack/book">Docs</a>
     <span> | </span>
     <a href="https://github.com/drager/wasm-pack/blob/master/CONTRIBUTING.md">Contributing</a>
     <span> | </span>
     <a href="https://discordapp.com/channels/442252698964721669/443151097398296587">Chat</a>
   </h3>
 
-<sub>Built with 🦀🕸 by <a href="https://rustwasm.github.io/">The Rust and WebAssembly Working Group</a></sub>
 
 </div>
 
@@ -31,14 +30,8 @@ browser or with Node.js. `wasm-pack` helps you build rust-generated
 WebAssembly packages that you could publish to the npm registry, or otherwise use
 alongside any javascript packages in workflows that you already use, such as [webpack].
 
-[bundler-support]: https://github.com/rustwasm/team/blob/master/goals/bundler-integration.md#details
 [webpack]: https://webpack.js.org/
 
-This project is a part of the [rust-wasm] group. You can find more info by
-visiting that repo!
-
-[rust-wasm]: https://github.com/rustwasm/team
-
 ![demo](demo.gif)
 
 ## 🔮 Prerequisites
@@ -83,10 +76,7 @@ check out our [contribution policy].
 
 ## 🤹‍♀️ Governance
 
-This project is part of the [rustwasm Working Group].
-
-This project was started by [ashleygwilliams] and is maintained by [drager] and the Rust Wasm Working Group Core Team.
+This project was started by [ashleygwilliams] and is maintained by [drager].
 
 [ashleygwilliams]: https://github.com/ashleygwilliams
 [drager]: https://github.com/drager
-[rustwasm working group]: https://github.com/rustwasm/team
```

**File**: `docs/_theme/header.hbs` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
   <p>
     This is the <strong>unpublished</strong> documentation of
     <code>wasm-pack</code>, the published documentation is available
-    <a href="https://rustwasm.github.io/docs/wasm-pack/">
+    <a href="https://drager.github.io/wasm-pack/">
       on the main Rust and WebAssembly documentation site
     </a>. Features documented here may not be available in released versions of
     <code>wasm-pack</code>.
```

---

### Incident Patch 13: `5f48264f` (2025-12-15)
**Commit Message**: fix(npm): update npm package download url

**File**: `npm/binary.js` (modified, +3/-3)
```diff
@@ -28,11 +28,11 @@ const getPlatform = () => {
 const getBinary = () => {
   const platform = getPlatform();
   const version = require("./package.json").version;
-  const author = "rustwasm";
+  const author = "drager";
   const name = "wasm-pack";
   const url = `https://github.com/${author}/${name}/releases/download/v${version}/${name}-v${version}-${platform}.tar.gz`;
   return new Binary(platform === windows ? "wasm-pack.exe" : "wasm-pack", url, {
-    installDirectory: join(__dirname, "binary")
+    installDirectory: join(__dirname, "binary"),
   });
 };
 
@@ -44,7 +44,7 @@ const install = () => {
 const run = () => {
   const binary = getBinary();
   binary.run();
-}
+};
 
 module.exports = {
   install,
```

---

### Incident Patch 14: `f28cf3e7` (2025-11-30)
**Commit Message**: Merge pull request #1540 from drager/alert-autofix-3

chore: fix for code scanning alert no. 3: Workflow does not contain permissions

**File**: `.github/workflows/approve.yml` (modified, +3/-0)
```diff
@@ -1,4 +1,7 @@
 name: Automatic Approve
+permissions:
+  contents: read
+  pull-requests: write
 on:
   schedule: 
     - cron: "0 0 * * *"
```

---

### Incident Patch 15: `948213c1` (2025-11-30)
**Commit Message**: Merge pull request #1539 from drager/alert-autofix-2

chore: fix for code scanning alert no. 2: Workflow does not contain permissions

**File**: `.github/workflows/book.yml` (modified, +2/-0)
```diff
@@ -6,6 +6,8 @@ on:
 
 jobs:
   book:
+    permissions:
+      contents: write
     name: Build and deploy book
     runs-on: ubuntu-latest
     steps:
```

#### Recent Merged Pull Requests:
- **PR #1602** (closed): fix: keep an existing package.json when --no-pack is passed (@cpruijsen)
- **PR #1600** (2026-08-12): fix: pass --enable-exception-handling to wasm-opt for --panic-unwind builds (@guybedford)
- **PR #1599** (2026-08-05): Update Binaryen to v130 (@divergentdave)
- **PR #1597** (closed): chore(deps): bump tar from 7.5.16 to 7.5.21 in /npm (@dependabot[bot])
- **PR #1596** (closed): chore(deps): bump tar from 7.5.16 to 7.5.19 in /npm (@dependabot[bot])
- **PR #1595** (2026-07-07): fix(webdriver): drop 32-bit Linux geckodriver support (@guybedford)
- **PR #1593** (2026-07-22): chore(deps): bump tar from 7.5.15 to 7.5.16 in /npm (@dependabot[bot])
- **PR #1590** (2026-06-12): Add `--no-gitignore` Flag (@NellowTCS)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
