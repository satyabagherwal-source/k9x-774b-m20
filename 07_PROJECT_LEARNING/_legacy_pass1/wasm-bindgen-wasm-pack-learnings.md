# Forensic Learning Record (Deep Inspection): wasm-bindgen/wasm-pack

> **Canonical Artifact**: `07_PROJECT_LEARNING/wasm-bindgen-wasm-pack-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wasm-bindgen/wasm-pack](https://github.com/wasm-bindgen/wasm-pack))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:44:20.475Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wasm-bindgen/wasm-pack`
- **Description**: 📦✨ your favorite rust -> wasm workflow tool!
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7283 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
+      .on("error", re
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
+            _ostype=
```

---

### Incident Patch 8: `ba62a517` (2026-04-28)
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

Signed-off-by: dependabot[bot] <support@github.com>
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

### Incident Patch 9: `7f7027e2` (2026-04-28)
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

### Incident Patch 10: `5f48264f` (2025-12-15)
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

#### Recent Merged Pull Requests:
- **PR #1600** (2026-08-12): fix: pass --enable-exception-handling to wasm-opt for --panic-unwind builds (@guybedford)
- **PR #1599** (2026-08-05): Update Binaryen to v130 (@divergentdave)
- **PR #1597** (closed): chore(deps): bump tar from 7.5.16 to 7.5.21 in /npm (@dependabot[bot])
- **PR #1596** (closed): chore(deps): bump tar from 7.5.16 to 7.5.19 in /npm (@dependabot[bot])
- **PR #1595** (2026-07-07): fix(webdriver): drop 32-bit Linux geckodriver support (@guybedford)
- **PR #1593** (2026-07-22): chore(deps): bump tar from 7.5.15 to 7.5.16 in /npm (@dependabot[bot])
- **PR #1590** (2026-06-12): Add `--no-gitignore` Flag (@NellowTCS)
- **PR #1587** (2026-07-22): chore(deps): bump tar from 0.4.45 to 0.4.46 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
