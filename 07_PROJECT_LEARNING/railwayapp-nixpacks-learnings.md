# Forensic Learning Record (Deep Inspection): railwayapp/nixpacks

> **Canonical Artifact**: `07_PROJECT_LEARNING/railwayapp-nixpacks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/railwayapp/nixpacks](https://github.com/railwayapp/nixpacks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:02:33.170Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `railwayapp/nixpacks`
- **Description**: App source + Nix packages + Docker = Image
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3555 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/deno-fresh/utils/twind.ts`
```
import { IS_BROWSER } from "$fresh/runtime.ts";
import { Configuration, setup } from "twind";
export * from "twind";
export const config: Configuration = {
  darkMode: "class",
  mode: "silent",
};
if (IS_BROWSER) setup(config);

```

### Core Architecture Module: `examples/node-pnpm-corepack/index.ts`
```
import { execSync } from "child_process";

const pnpmVersion = execSync("pnpm --version", { encoding: "utf-8" }).trim();
const pnpmMajorVersion = pnpmVersion.split(".")[0];
console.log(`Hello from PNPM ${pnpmMajorVersion}`);

```

### Core Architecture Module: `src/nixpacks/plan/utils.rs`
```
/// Removes all the `"..."`'s or `"@auto"`'s from the `original`
pub fn remove_autos_from_vec(original: Vec<String>) -> Vec<String> {
    original
        .into_iter()
        .filter(|x| x != "@auto" && x != "...")
        .collect::<Vec<_>>()
}

/// Fills in the `"..."`'s or `"@auto"`'s in `replacer` with the values from the `original`
///
/// ```
/// use nixpacks::nixpacks::plan::utils::fill_auto_in_vec;
///
/// let arr = fill_auto_in_vec(
///   Some(vec!["a".into(), "b".into(), "c".into()]),
///   Some(vec!["x".into(), "...".into(), "z".into()])
/// );
/// assert_eq!(Some(vec!["x".into(), "...".into(), "a".into(), "b".into(), "c".into(), "z".into()]), arr);
/// ```
pub fn fill_auto_in_vec(
    original: Option<Vec<String>>,
    replacer: Option<Vec<String>>,
) -> Option<Vec<String>> {
    if let Some(replacer) = replacer {
        let original = original.unwrap_or_default();
        let modified = replacer
            .into_iter()
            .flat_map(|x| {
                let v = x.clone();
                if v == *"@auto" || v == *"..." {
                    let mut fill = vec![v];
                    fill.append(&mut original.clone());
                    fill
                } else {
                    vec![x]
                }
            })
            .collect::<Vec<_>>();

        Some(modified)
    } else {
        original
    }
}

#[cfg(test)]
mod test {
    use super::*;

    fn vs(v: Vec<&str>) -> Vec<String> {
        v.into_iter()
            .map(std::string::ToString::to_string)
            .collect()
    }

    #[test]
    fn test_remove_autos_from_vec() {
        assert_eq!(
            vs(vec!["a", "b", "c"]),
            remove_autos_from_vec(vs(vec!["a", "b", "c"]))
        );
        assert_eq!(
            vs(vec!["a", "c"]),
            remove_autos_from_vec(vs(vec!["a", "...", "c"]))
        );
        assert_eq!(
            vs(vec!["a", "c"]),
            remove_autos_from_vec(vs(vec!["@auto", "a", "...", "c", "@auto"]))
        );
    }

    #[test]
    fn test_fill_auto_in_vec() {
        assert_eq!(
            vec!["x", "...", "z"],
            fill_auto_in_vec(None, Some(vs(vec!["x", "...", "z"]))).unwrap()
        );
        assert_eq!(
            vec!["a", "b", "c"],
            fill_auto_in_vec(Some(vs(vec!["a", "b", "c"])), None).unwrap()
        );
        assert_eq!(
            vec!["x", "...", "a", "b", "c", "z"],
            fill_auto_in_vec(
                Some(vs(vec!["a", "b", "c"])),
                Some(vs(vec!["x", "...", "z"]))
            )
            .unwrap()
        );
    }
}

```

### Core Architecture Module: `src/providers/php/scripts/util/cmd.mjs`
```
import { execSync } from "child_process";

export const e = cmd => execSync(cmd).toString().replace('\n', '');
```

### Core Architecture Module: `src/providers/php/scripts/util/laravel.mjs`
```
import Logger from "./logger.mjs"
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const variableHints = {
    'APP_ENV': 'You should probably set this to `production`.'
};

const logger = new Logger('laravel');

export const isLaravel = () => process.env['IS_LARAVEL'] != null;

function checkVariable(name) {
    if (!process.env[name]) {
        let hint =
            `Your app configuration references the ${name} environment variable, but it is not set.`
            + (variableHints[name] ?? '');

        logger.warn(hint);
    }
}

export async function checkEnvErrors(srcdir) {
    const envRegex = /env\(["']([^,]*)["']\)/g;
    const configDir = path.join(srcdir, 'config');

    const config =
        (await Promise.all(
            (await fs.readdir(configDir))
                .filter(fileName => fileName.endsWith('.php'))
                .map(fileName => fs.readFile(path.join(configDir, fileName)))
        )).join('');

    for (const match of config.matchAll(envRegex)) {
        if (match[1] != 'APP_KEY') checkVariable(match[1]);
    }

    if (!process.env.APP_KEY) {
        logger.warn('Your app key is not set! Please set a random 32-character string in your APP_KEY environment variable. This can be easily generated with `openssl rand -hex 16`.');
    }
}

```

### Core Architecture Module: `src/providers/php/scripts/util/logger.mjs`
```
export default class Logger {
    /** @type string */
    #tag;

    /**
    * @param {string} tag
    */
    constructor(tag) {
        this.#tag = tag
    }

    #log(color, messageType, message, fn = console.log) {
        fn(`\x1b[${color}m[${this.#tag}:${messageType}]\x1b[0m ${message}`)
    }

    info(message) {
        this.#log(34, 'info', message)
    }

    warn(message) {
        this.#log(35, 'warn', message, console.warn)
    }

    error(message) {
        this.#log(31, 'error', message, console.error)
    }
}

```

### Core Architecture Module: `src/providers/php/scripts/util/nix.mjs`
```
import { e } from "./cmd.mjs";

export const getNixPath = (exe) => e(`nix-store -q ${e(`which ${exe}`)}`);

```

### Core Architecture Module: `examples/deno-fresh/dev.ts`
```
#!/usr/bin/env -S deno run -A --watch=static/,routes/

import dev from "$fresh/dev.ts";

await dev(import.meta.url, "./main.ts");

```

### Core Architecture Module: `examples/deno-fresh/fresh.gen.ts`
```
// DO NOT EDIT. This file is generated by fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import * as $0 from "./routes/[name].tsx";
import * as $1 from "./routes/api/joke.ts";
import * as $2 from "./routes/index.tsx";
import * as $$0 from "./islands/Counter.tsx";

const manifest = {
  routes: {
    "./routes/[name].tsx": $0,
    "./routes/api/joke.ts": $1,
    "./routes/index.tsx": $2,
  },
  islands: {
    "./islands/Counter.tsx": $$0,
  },
  baseUrl: import.meta.url,
};

export default manifest;

```

### Core Architecture Module: `examples/deno-fresh/islands/Counter.tsx`
```
/** @jsx h */
import { h } from "preact";
import { useState } from "preact/hooks";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { tw } from "@twind";

interface CounterProps {
  start: number;
}

export default function Counter(props: CounterProps) {
  const [count, setCount] = useState(props.start);
  const btn = tw`px-2 py-1 border(gray-100 1) hover:bg-gray-200`;
  return (
    <div class={tw`flex gap-2 w-full`}>
      <p class={tw`flex-grow-1 font-bold text-xl`}>{count}</p>
      <button
        class={btn}
        onClick={() => setCount(count - 1)}
        disabled={!IS_BROWSER}
      >
        -1
      </button>
      <button
        class={btn}
        onClick={() => setCount(count + 1)}
        disabled={!IS_BROWSER}
      >
        +1
      </button>
    </div>
  );
}

```

### Core Architecture Module: `examples/deno-fresh/main.ts`
```
/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { InnerRenderFunction, RenderContext, start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";

import { config, setup } from "@twind";
import { virtualSheet } from "twind/sheets";

const sheet = virtualSheet();
sheet.reset();
setup({ ...config, sheet });

function render(ctx: RenderContext, render: InnerRenderFunction) {
  const snapshot = ctx.state.get("twind") as unknown[] | null;
  sheet.reset(snapshot || undefined);
  render();
  ctx.styles.splice(0, ctx.styles.length, ...(sheet).target);
  const newSnapshot = sheet.reset();
  ctx.state.set("twind", newSnapshot);
}

await start(manifest, { render });

```

### Core Architecture Module: `examples/deno-fresh/routes/[name].tsx`
```
/** @jsx h */
import { h } from "preact";
import { PageProps } from "$fresh/server.ts";

export default function Greet(props: PageProps) {
  return <div>Hello {props.params.name}</div>;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1330** (2025-10-24): **Node.js 23 not detected**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the bug  `{ "engines": { "node": "23" } }` results in Node 18 being instead of Node 23.  (Versions 20 and 22 work as expected.)  ### To reproduce  1. In am empty directory, create a `package.json` file with the following contents: `{ "engines": { "node": "23" } }` 2. Run `nixpacks plan .` in that directory.  `phases.setup.nixPkgs` contains `"nodejs_18"`  ### Expected behavior  `phases.setup.nixPkgs` contains `"nodejs_23"`  ### Environment  ``` $ nixpacks -V nixpacks 1.39.0 $ lsb_release -a No LSB modules are available. Distributor ID: Ubuntu Description:    Ubuntu 24.10 Release:        24.10 Codename:       oracular ```
  **Post-Mortem & Fix Analysis**:
  > I can see that since 1f5e11dade896deecc477743d689ea38114d14db non-LTS versions are ignored. I can't see a way to circumvent that though. Also, https://github.com/railwayapp/nixpacks/commit/fd35d3c818ef3292d7624703080ccbd43e06e4f8 is kind of pointless then.
  > I am also experiencing this bug. I can't change to 23.
  > I just tried `NIXPACKS_NODE_VERSION ` `24` and it's using NodeJS 18...

- **Issue #1326** (2025-10-24): **Support for pnpm v10**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the bug  When defining pnpm v10 as the `packageManager`, pnpm v9 is being used.   ```json "packageManager": "pnpm@10.11.0", "engines": {   "node": ">=22" }, ```  ``` ╔═══════════════════════ Nixpacks v1.38.0 ═══════════════════════╗ ║ setup      │ nodejs_22, pnpm-9_x                               ║ ║────────────────────────────────────────────────────────────────║ ║ install    │ npm install -g corepack@0.24.1 && corepack enable ║ ║            │ pnpm i --frozen-lockfile                          ║ ```  Related: https://github.com/railwayapp/nixpacks/issues/1091  Code: https://github.com/railwayapp/nixpacks/blob/205b33b515282cdf56cb4848f01274bd858f850e/src/providers/node/mod.rs#L531-L542    ### To reproduce  _No response_  ### Expected behavior  pnpm v10 is used when the `packageManager` field defines v10  ### Environment  Nixpacks v1.38.0
  **Post-Mortem & Fix Analysis**:
  > @billdybas I'm running into this as well and I'm moving my [builds over to railpack](https://github.com/railwayapp/railpack). I'm going to be helping out with maintenance  on the project, so ping me on GitHub if you run into any issues.

- **Issue #1302** (2025-06-22): **Building react-router v7 applications**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the bug  The `node` prodiver of nixpacks is quite complex, as it has to support a lot of different use cases.  There is a dedicated `vite.rs` file where the logic of figuring out whether the project is an SPA is implemented.  In the `1.34.1` release there was a fix for building `remix` applications.  Since 2024-11-21 remix has been merged with `react-router` as v7 was released.  The fix that was introduced for remix, only works for remix. Remix is now maintained in the react-router project.  If someone would like to build a react-router v7 project, nixpacks will think it's an SPA, nevertheless that it might not be.  A quick fix can be that in the https://github.com/railwayapp/nixpacks/blob/main/src/providers/node/spa/vite.rs#L29 file include another check in the conditions to look for `@react-router/node`.  However that won't necessarily handle when the user is in `framework` mode but directly disables the SSR in the `react-router.config.ts` file. Although in that case the static assets are still served through `@react-router/serve` therefor the quick fix might just be enough for a while.  Ultimately I think there should be a more robust check, as `react-router` can be used in multiple modes: - framework - data - declarative  Reference: https://reactrouter.com/start/modes  ### To reproduce  Steps to reproduce the bug:  1. Setup a react-router v7 project in framework mode    ```sh
  **Post-Mortem & Fix Analysis**:
  > I've added a PR for the issue: https://github.com/railwayapp/nixpacks/pull/1303

- **Issue #1297** (2025-04-25): **Ubuntu image is still 22.04 (jammy) instead of 24.04 (noble)**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the bug  https://github.com/railwayapp/nixpacks/issues/1296  Ubuntu image is still 22.04 (jammy) instead of 24.04 (noble).  `Build and push [Ubuntu]` step failed in this action => https://github.com/railwayapp/nixpacks/actions/runs/14183924609/job/39735656763  ``` Error: buildx failed with: ERROR: failed to solve: process "/bin/bash -ol pipefail -c set -o pipefail && curl -L https://nixos.org/nix/install | bash     && /nix/var/nix/profiles/default/bin/nix-channel --remove nixpkgs     && /nix/var/nix/profiles/default/bin/nix-collect-garbage --delete-old     && printf 'if [ -d $HOME/.nix-profile/etc/profile.d ]; then\\n for i in $HOME/.nix-profile/etc/profile.d/*.sh; do\\n if [ -r $i ]; then\\n . $i\\n fi\\n done\\n fi\\n' >> /root/.profile     && printf 'PATH=$NIXPACKS_PATH:$PATH' >> /root/.profile" did not complete successfully: exit code: 55 ```  ### To reproduce  In https://github.com/railwayapp/nixpacks/blob/main/src/nixpacks/images.rs, `UBUNTU_BASE_IMAGE`  is `ghcr.io/railwayapp/nixpacks:ubuntu-1742861060`   ```shell docker run -it ghcr.io/railwayapp/nixpacks:ubuntu-1742861060 bash ```  ```shell cat /etc/os-release ```  ``` PRETTY_NAME="Ubuntu 22.04.5 LTS" NAME="Ubuntu" VERSION_ID="22.04" VERSION="22.04.5 LTS (Jammy Jellyfish)" VERSION_CODENAME=jammy ID=ubuntu ID_LIKE=debian HOME_URL="https://www.ubuntu.com/" SUPPORT_URL="https://help.ubuntu.com/" BUG_REPORT_URL="https://bugs
  **Post-Mortem & Fix Analysis**:
  > Yes it looks like there is a problem with building and publishing the updated base images. Fix will be worked on soon.
  > Re-opening this until this PR (https://github.com/railwayapp/nixpacks/pull/1317) is merged. There are some issues with building and running some of the examples that need to be fixed before a new version can be released.
  > This should be fixed by https://github.com/railwayapp/nixpacks/pull/1319

- **Issue #1289** (2025-03-10): **Remix applications default Caddy file is wrong.**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the bug  Simply deploying a Remix.run application (even the template) causes a 404 on all pages due to the generated Caddy configuration.  ### To reproduce  1. Use remix.run default template. 2. Build it with nixpacks. 3. Try to run the built image.  ### Expected behavior  _No response_  ### Environment  Nixpacks: 1.33.0 (but it is reproducable with 1.34.0) OS: Linux / MacOS
  **Post-Mortem & Fix Analysis**:
  > Oh no this is not intended! Will be fixed soon

- **Issue #1288** (2025-03-11): **version `GLIBC_2.36' not found (required by /nix/store/hm2...**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the bug  When I run Playwright from a FlightControl Post deploy container (NixPacks), I get the following error:  > [pid=2933][err] /root/pw-browsers/chromium_headless_shell-1155/chrome-linux/headless_shell: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.36' not found (required by /nix/store/hm2rpszabwpvs28jwkaz7pg0dqslm4bd-util-linux-minimal-2.39.4-lib/lib/libmount.so.1)  Full error:  > 4:19:43 pm Running 40 tests using 1 worker 4:19:52 pm FFFFF 4:19:52 pm   1) [playwright test setup] › tests/globalSetup.ts:56:8 › Login › @setup member test ────────────── 4:19:52 pm     Error: browserType.launch: Target page, context or browser has been closed 4:19:52 pm     Browser logs: 4:19:52 pm     <launching> /root/pw-browsers/chromium_headless_shell-1155/chrome-linux/headless_shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-extensions --disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyCompon
  **Post-Mortem & Fix Analysis**:
  > The installed version of GLIBC is 2.35
  > Seems Jammy only supports 2.35 https://launchpad.net/ubuntu/+source/glibc I'd need to upgrade to Noble to get 2.39
  > Closing as this is not related to nixpacks, but either Playwright or Chromium

- **Issue #1285** (2025-02-22): **Nixpacks refuses to use pnpm**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the bug  Nixpacks ignores the `pnpm-lock.yaml` and package manager defined in the `package.json`.  `package.json`: ``` {   ...   "packageManager": "pnpm@9.0.0",   "engines": {     "node": ">=22"   } } ```  Railway deploy logs: ``` ╔════════ Nixpacks v1.31.0 ═══════╗  ║ setup      │ nodejs_18, npm-9_x ║    <----- should be pnpm (+ incorrect node version)  ║─────────────────────────────────║  ║ install    │ npm i              ║  ║─────────────────────────────────║  ║ build      │ pnpm run build     ║  ║─────────────────────────────────║  ║ start      │ pnpm run start     ║  ╚═════════════════════════════════╝  ...  process "/bin/bash -ol pipefail -c npm i" did not complete successfully: exit code: 1 ```   ### To reproduce  Deploy a Railway project that uses pnpm  ### Expected behavior  Uses correct node + pnpm version  ### Environment  Nixpacks v1.31.0
  **Post-Mortem & Fix Analysis**:
  > Why was this closed?

- **Issue #1280** (2025-02-08): **`--docker-host` flag does not work with Docker sockets**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the bug  I am running Nixpacks in a Docker container, with the Docker socket exposed to the container as a volume. However, Nixpacks does not recognize the socket and believes that Docker is not installed, even when `--docker-host` is used.  ### To reproduce  1. Run a Docker container with any image that Nixpacks can be installed onto, for example `debian:slim`. 2. Ensure that the Docker socket is exposed to the container with `-v /var/run/docker.sock:/var/run/docker.sock` 3. Open a shell within the container with `exec -it bash` 4. Install Nixpacks as shown in the documentation 5. Attempt to build a Docker image with the flag `--docker-host`. 6. Notice that Nixpacks believes Docker is not installed.  Here is an example of me trying to build an image in a Docker container. ``` root@b061154b24e6:/deploydeploydeploy# nixpacks build --docker-host unix:///var/run/docker.sock -n test /deploydeploydeploy/data/projects/528253b8-b153-4cf8-82ff-96356311bb6c/  ╔════════════ Nixpacks v1.33.0 ════════════╗ ║ setup      │ nodejs_18, npm-9_x, openssl ║ ║──────────────────────────────────────────║ ║ install    │ npm ci                      ║ ║──────────────────────────────────────────║ ║ build      │ npm run build               ║ ║──────────────────────────────────────────║ ║ start      │ npm run start               ║ ╚══���═══════════════════════════════════════╝  Error: Please install Docker 
  **Post-Mortem & Fix Analysis**:
  > Just fixed this, I didn't realize you had to install Docker too within the container, not just expose the socket.

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

### Incident Patch 1: `2819b0a2` (2025-09-08)
**Commit Message**: fix: resolve clippy warnings for code quality (#1364)

* fix: resolve clippy warnings for code quality

* fmt

**File**: `src/nixpacks/plan/mod.rs` (modified, +6/-6)
```diff
@@ -264,9 +264,9 @@ impl BuildPlan {
             let mut install = Phase::install(Some(cmd_string));
 
             if let Some(cache_dirs) = env.get_config_variable("INSTALL_CACHE_DIRS") {
-                split_env_string(cache_dirs.as_str())
-                    .iter()
-                    .for_each(|dir| install.add_cache_directory(dir));
+                for dir in &split_env_string(cache_dirs.as_str()) {
+                    install.add_cache_directory(dir);
+                }
             }
 
             phases.push(install);
@@ -277,9 +277,9 @@ impl BuildPlan {
             let mut build = Phase::build(Some(cmd_string));
 
             if let Some(cache_dirs) = env.get_config_variable("BUILD_CACHE_DIRS") {
-                split_env_string(cache_dirs.as_str())
-                    .iter()
-                    .for_each(|dir| build.add_cache_directory(dir));
+                for dir in &split_env_string(cache_dirs.as_str()) {
+                    build.add_cache_directory(dir);
+                }
             }
 
             phases.push(build);
```

**File**: `src/providers/elixir.rs` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ impl ElixirProvider {
     }
 
     fn get_nix_elixir_package(app: &App, env: &Environment) -> Result<Pkg> {
-        fn as_default(v: Option<Match>) -> &str {
+        fn as_default(v: Option<Match<'_>>) -> &str {
             match v {
                 Some(m) => m.as_str(),
                 None => "_",
```

**File**: `src/providers/go.rs` (modified, +2/-2)
```diff
@@ -141,8 +141,8 @@ impl GolangProvider {
     }
 
     pub fn get_nix_golang_pkg(go_mod_contents: Option<&String>) -> Result<(String, String)> {
-        if go_mod_contents.is_some() {
-            let mut lines = go_mod_contents.as_ref().unwrap().lines();
+        if let Some(contents) = go_mod_contents {
+            let mut lines = contents.lines();
             let go_version_line = lines.find(|line| line.trim().starts_with("go"));
 
             if let Some(go_version_line) = go_version_line {
```

**File**: `src/providers/python.rs` (modified, +1/-1)
```diff
@@ -517,7 +517,7 @@ impl PythonProvider {
 
     fn get_nix_python_package(app: &App, env: &Environment) -> Result<(Pkg, String)> {
         // Fetch python versions into tuples with defaults
-        fn as_default(v: Option<Match>) -> &str {
+        fn as_default(v: Option<Match<'_>>) -> &str {
             match v {
                 Some(m) => m.as_str(),
                 None => "_",
```

---

### Incident Patch 2: `67eb94b2` (2025-07-21)
**Commit Message**: style: fix clippy errors (#1344)

**File**: `tests/docker_run_tests.rs` (modified, +3/-3)
```diff
@@ -127,7 +127,7 @@ async fn run_image(name: &str, cfg: Option<Config>) -> String {
 async fn build_with_hosts(path: &str, add_hosts: &[String], nginx_host: String) -> String {
     let name = Uuid::new_v4().to_string();
     let mut env: Vec<&str> = Vec::new();
-    let env_var = format!("REMOTE_URL=http://{}", nginx_host);
+    let env_var = format!("REMOTE_URL=http://{nginx_host}");
     env.push(&*env_var);
 
     create_docker_image(
@@ -665,7 +665,7 @@ async fn test_pnpm_network_call_should_not_work_without_hosts() {
     }
 
     let mut env: Vec<&str> = Vec::new();
-    let env_var = format!("REMOTE_URL=http://{}", container_name);
+    let env_var = format!("REMOTE_URL=http://{container_name}");
     env.push(&*env_var);
 
     // Build the basic example, a function that calls the database
@@ -972,7 +972,7 @@ async fn test_python_psycopg2() -> Result<()> {
     )
     .await;
 
-    println!("OUTPUT = {}", output);
+    println!("OUTPUT = {output}");
 
     // Cleanup containers and networks
     stop_and_remove_container(container_name);
```

---

### Incident Patch 3: `d28bebe0` (2025-04-25)
**Commit Message**: revert rust musl behaviour (#1320)

**File**: `src/providers/rust.rs` (modified, +1/-2)
```diff
@@ -75,8 +75,7 @@ impl RustProvider {
         }
 
         if RustProvider::should_use_musl(app, env)? {
-            setup.add_nix_pkgs(&[Pkg::new("musl")]);
-            setup.add_apt_pkgs(vec![String::from("musl-tools")]);
+            setup.add_nix_pkgs(&[Pkg::new("musl"), Pkg::new("musl.dev")]);
         }
 
         setup.set_nix_archive(NIX_ARCHIVE.to_string());
```

---

### Incident Patch 4: `479ad5af` (2025-04-25)
**Commit Message**: fix path sourcing in base images (#1318)

**File**: `base/debian/Dockerfile` (modified, +2/-3)
```diff
@@ -17,9 +17,8 @@ RUN set -o pipefail && curl --proto '=https' --tlsv1.2 -sSf -L https://install.d
     && /nix/var/nix/profiles/default/bin/nix-collect-garbage --delete-old
 
 # Set up the shell profile to source Nix
-RUN echo 'if [ -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then' >> /root/.profile && \
-    echo '  . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' >> /root/.profile && \
-    echo 'fi' >> /root/.profile
+RUN printf 'if [ -d $HOME/.nix-profile/etc/profile.d ]; then\n for i in $HOME/.nix-profile/etc/profile.d/*.sh; do\n if [ -r $i ]; then\n . $i\n fi\n done\n fi\n' >> /root/.profile \
+    && printf 'PATH=$NIXPACKS_PATH:$PATH' >> /root/.profile
 
 ENV \
   ENV=/etc/profile \
```

**File**: `base/ubuntu/Dockerfile` (modified, +2/-3)
```diff
@@ -17,9 +17,8 @@ RUN set -o pipefail && curl --proto '=https' --tlsv1.2 -sSf -L https://install.d
     && /nix/var/nix/profiles/default/bin/nix-collect-garbage --delete-old
 
 # Set up the shell profile to source Nix
-RUN echo 'if [ -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then' >> /root/.profile && \
-    echo '  . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' >> /root/.profile && \
-    echo 'fi' >> /root/.profile
+RUN printf 'if [ -d $HOME/.nix-profile/etc/profile.d ]; then\n for i in $HOME/.nix-profile/etc/profile.d/*.sh; do\n if [ -r $i ]; then\n . $i\n fi\n done\n fi\n' >> /root/.profile \
+    && printf 'PATH=$NIXPACKS_PATH:$PATH' >> /root/.profile
 
 ENV \
   ENV=/etc/profile \
```

---

### Incident Patch 5: `82288eec` (2025-04-25)
**Commit Message**: Fix/fix react router v7 application building (#1303)

* chore: add a `react-router-v7-framework` example to the list of examples

* chore: add a `react-router-v7-spa` to the list of examples

* fix: an issue where the node provider would build react-router v7 apps as spa

eventhough they are not in SPA mode

* docs: extend the node docs `Caddy requirements` section with info about rrv7

* style: fix linting issues in various files

* test: update the snapshot tests with the new `react-router` examples

* style: fix a clippy error where an unnecessary continue was used in the jsonc parser in `app.rs`

* fix: fix an issue with the rust provider where the `musl.dev` nix pkg is not available anymore

due to this musl required builds such as the `rust-ring` example fails

---------

Co-authored-by: Jake Runzer <[REDACTED_EMAIL]>

**File**: `docs/pages/docs/providers/node.md` (modified, +1/-0)
```diff
@@ -120,6 +120,7 @@ If you have an application that doesn't pass the requirements for automatically
 If your package.json has `vite` any of the following dependencies:
 
 - `react`
+- `react-router` (but not in framework mode)
 - `vue`
 - `svelte` (but not `@sveltejs/kit`)
 - `preact`
```

**File**: `examples/node-react-router-v7-framework/.dockerignore` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+.react-router
+build
+node_modules
+README.md
\ No newline at end of file
```

**File**: `examples/node-react-router-v7-framework/.gitignore` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+.DS_Store
+/node_modules/
+
+# React Router
+/.react-router/
+/build/
```

**File**: `examples/node-react-router-v7-framework/Dockerfile` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+FROM node:20-alpine AS development-dependencies-env
+COPY . /app
+WORKDIR /app
+RUN npm ci
+
+FROM node:20-alpine AS production-dependencies-env
+COPY ./package.json package-lock.json /app/
+WORKDIR /app
+RUN npm ci --omit=dev
+
+FROM node:20-alpine AS build-env
+COPY . /app/
+COPY --from=development-dependencies-env /app/node_modules /app/node_modules
+WORKDIR /app
+RUN npm run build
+
+FROM node:20-alpine
+COPY ./package.json package-lock.json /app/
+COPY --from=production-dependencies-env /app/node_modules /app/node_modules
+COPY --from=build-env /app/build /app/build
+WORKDIR /app
+CMD ["npm", "run", "start"]
\ No newline at end of file
```

**File**: `examples/node-react-router-v7-framework/README.md` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+# Welcome to React Router!
+
+A modern, production-ready template for building full-stack React applications using React Router.
+
+[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)
+
+## Features
+
+- 🚀 Server-side rendering
+- ⚡️ Hot Module Replacement (HMR)
+- 📦 Asset bundling and optimization
+- 🔄 Data loading and mutations
+- 🔒 TypeScript by default
+- 🎉 TailwindCSS for styling
+- 📖 [React Router docs](https://reactrouter.com/)
+
+## Getting Started
+
+### Installation
+
+Install the dependencies:
+
+```bash
+npm install
+```
+
+### Development
+
+Start the development server with HMR:
+
+```bash
+npm run dev
+```
+
+Your application will be available at `http://localhost:5173`.
+
+## Building for Production
+
+Create a production build:
+
+```bash
+npm run build
+```
+
+## Deployment
+
+### Docker Deployment
+
+To build and run using Docker:
+
+```bash
+docker build -t my-app .
+
+# Run the container
+docker run -p 3000:3000 my-app
+```
+
+The containerized application can be deployed to any platform that supports Docker, including:
+
+- AWS ECS
+- Google Cloud Run
+- Azure Container Apps
+- Digital Ocean App Platform
+- Fly.io
+- Railway
+
+### DIY Deployment
+
+If you're familiar with deploying Node applications, the built-in app server is production-ready.
+
+Make sure to deploy the output of `npm run build`
+
+```
+├── package.json
+├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
+├── build/
+│   ├── client/    # Static assets
+│   └── server/    # Server-side code
+```
+
+## Styling
+
+This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.
+
+---
+
+Built with ❤️ using React Router.
```

**File**: `examples/node-react-router-v7-framework/app/app.css` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+@import "tailwindcss";
+
+@theme {
+  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif,
+    "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
+}
+
+html,
+body {
+  @apply bg-white dark:bg-gray-950;
+
+  @media (prefers-color-scheme: dark) {
+    color-scheme: dark;
+  }
+}
```

**File**: `examples/node-react-router-v7-framework/app/root.tsx` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+import {
+  isRouteErrorResponse,
+  Links,
+  Meta,
+  Outlet,
+  Scripts,
+  ScrollRestoration,
+} from "react-router";
+
+import type { Route } from "./+types/root";
+import "./app.css";
+
+export const links: Route.LinksFunction = () => [
+  { rel: "preconnect", href: "https://fonts.googleapis.com" },
+  {
+    rel: "preconnect",
+    href: "https://fonts.gstatic.com",
+    crossOrigin: "anonymous",
+  },
+  {
+    rel: "stylesheet",
+    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
+  },
+];
+
+export function Layout({ children }: { children: React.ReactNode }) {
+  return (
+    <html lang="en">
+      <head>
+        <meta charSet="utf-8" />
+        <meta name="viewport" content="width=device-width, initial-scale=1" />
+        <Meta />
+        <Links />
+      </head>
+      <body>
+        {children}
+        <ScrollRestoration />
+        <Scripts />
+      </body>
+    </html>
+  );
+}
+
+export default function App() {
+  return <Outlet />;
+}
+
+export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
+  let message = "Oops!";
+  let details = "An unexpected error occurred.";
+  let stack: string | undefined;
+
+  if (isRouteErrorResponse(error)) {
+    message = error.status === 404 ? "404" : "Error";
+    details =
+      error.status === 404
+        ? "The requested page could not be found."
+        : error.statusText || details;
+  } else if (import.meta.env.DEV && error && error instanceof Error) {
+    details = error.message;
+    stack = error.stack;
+  }
+
+  return (
+    <main className="pt-16 p-4 container mx-auto">
+      <h1>{message}</h1>
+      <p>{details}</p>
+      {stack && (
+        <pre className="w-full p-4 overflow-x-auto">
+          <code>{stack}</code>
+        </pre>
+      )}
+    </main>
+  );
+}
```

**File**: `examples/node-react-router-v7-framework/app/routes.ts` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+import { type RouteConfig, index } from "@react-router/dev/routes";
+
+export default [index("routes/home.tsx")] satisfies RouteConfig;
```

---

### Incident Patch 6: `d98f2f25` (2025-04-24)
**Commit Message**: fix debian dockerfile (#1314)

**File**: `base/debian/Dockerfile` (modified, +14/-14)
```diff
@@ -1,22 +1,25 @@
 FROM debian:bullseye-slim
 
-ARG DEBIAN_FRONTEND=noninteractive
+ARG DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC
 
 RUN apt-get update && apt-get -y upgrade \
-  && apt-get install --no-install-recommends -y sudo locales curl xz-utils ca-certificates openssl make git pkg-config \
+  && apt-get install --no-install-recommends -y sudo locales curl tzdata xz-utils ca-certificates openssl make git pkg-config \
   && apt-get clean && rm -rf /var/lib/apt/lists/* \
   && rm -rf /usr/share/doc/* \
-  && mkdir -m 0755 /nix && mkdir -m 0755 /etc/nix && groupadd -r nixbld && chown root /nix \
-  && printf 'sandbox = false \nfilter-syscalls = false\n' > /etc/nix/nix.conf \
-  && printf 'experimental-features = nix-command\n' >> /etc/nix/nix.conf \
-  && for n in $(seq 1 10); do useradd -c "Nix build user $n" -d /var/empty -g nixbld -G nixbld -M -N -r -s "$(command -v nologin)" "nixbld$n"; done
+  && mkdir -m 0755 /nix && mkdir -m 0755 /etc/nix
 
 SHELL ["/bin/bash", "-ol", "pipefail", "-c"]
-RUN set -o pipefail && curl -L https://nixos.org/nix/install | bash \
+RUN set -o pipefail && curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install linux --no-confirm --init none \
+    --extra-conf "sandbox = false" \
+    --extra-conf "filter-syscalls = false" \
+    --extra-conf "experimental-features = nix-command flakes" \
     && /nix/var/nix/profiles/default/bin/nix-channel --remove nixpkgs \
-    && /nix/var/nix/profiles/default/bin/nix-collect-garbage --delete-old \
-    && printf 'if [ -d $HOME/.nix-profile/etc/profile.d ]; then\n for i in $HOME/.nix-profile/etc/profile.d/*.sh; do\n if [ -r $i ]; then\n . $i\n fi\n done\n fi\n' >> /root/.profile \
-    && printf 'PATH=$NIXPACKS_PATH:$PATH' >> /root/.profile
+    && /nix/var/nix/profiles/default/bin/nix-collect-garbage --delete-old
+
+# Set up the shell profile to source Nix
+RUN echo 'if [ -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then' >> /root/.profile && \
+    echo '  . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' >> /root/.profile && \
+    echo 'fi' >> /root/.profile
 
 ENV \
   ENV=/etc/profile \
@@ -28,7 +31,4 @@ ENV \
   NIXPKGS_ALLOW_BROKEN=1 \
   NIXPKGS_ALLOW_UNFREE=1 \
   NIXPKGS_ALLOW_INSECURE=1 \
-  LD_LIBRARY_PATH=/usr/lib \
-  CPATH=~/.nix-profile/include:$CPATH \
-  LIBRARY_PATH=~/.nix-profile/lib:$LIBRARY_PATH \
-  QTDIR=~/.nix-profile:$QTDIR
+  LD_LIBRARY_PATH=/usr/lib
```

---

### Incident Patch 7: `ea2965d3` (2025-04-24)
**Commit Message**: Fix ubuntu noble base image (#1311)

* update to latest build-push-action jobs

* fix ubuntu nix dockerfile install

* fix lints

* fix lints

* fix lints (again)

* update snapshots

**File**: `.github/workflows/publish.yml` (modified, +2/-2)
```diff
@@ -47,15 +47,15 @@ jobs:
         run: echo "::set-output name=date::$(date +%s)"
 
       - name: Build and push [Ubuntu]
-        uses: docker/build-push-action@v5
+        uses: docker/build-push-action@v6
         with:
           context: base/ubuntu
           platforms: linux/arm64, linux/amd64
           push: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
           tags: ghcr.io/railwayapp/nixpacks:ubuntu, ghcr.io/railwayapp/nixpacks:latest, ghcr.io/railwayapp/nixpacks:ubuntu-${{ steps.date.outputs.date }}
 
       - name: Build and push [Debian]
-        uses: docker/build-push-action@v5
+        uses: docker/build-push-action@v6
         with:
           context: base/debian
           platforms: linux/arm64, linux/amd64, linux/386
```

**File**: `base/ubuntu/Dockerfile` (modified, +12/-12)
```diff
@@ -6,17 +6,20 @@ RUN apt-get update && apt-get -y upgrade \
   && apt-get install --no-install-recommends -y sudo locales curl tzdata xz-utils ca-certificates openssl make git pkg-config \
   && apt-get clean && rm -rf /var/lib/apt/lists/* \
   && rm -rf /usr/share/doc/* \
-  && mkdir -m 0755 /nix && mkdir -m 0755 /etc/nix && groupadd -r nixbld && chown root /nix \
-  && printf 'sandbox = false \nfilter-syscalls = false\n' > /etc/nix/nix.conf \
-  && printf 'experimental-features = nix-command\n' >> /etc/nix/nix.conf \
-  && for n in $(seq 1 10); do useradd -c "Nix build user $n" -d /var/empty -g nixbld -G nixbld -M -N -r -s "$(command -v nologin)" "nixbld$n"; done
+  && mkdir -m 0755 /nix && mkdir -m 0755 /etc/nix
 
 SHELL ["/bin/bash", "-ol", "pipefail", "-c"]
-RUN set -o pipefail && curl --retry 5 --retry-delay 5 --connect-timeout 30 -L https://nixos.org/nix/install | bash \
+RUN set -o pipefail && curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install linux --no-confirm --init none \
+    --extra-conf "sandbox = false" \
+    --extra-conf "filter-syscalls = false" \
+    --extra-conf "experimental-features = nix-command flakes" \
     && /nix/var/nix/profiles/default/bin/nix-channel --remove nixpkgs \
-    && /nix/var/nix/profiles/default/bin/nix-collect-garbage --delete-old \
-    && printf 'if [ -d $HOME/.nix-profile/etc/profile.d ]; then\n for i in $HOME/.nix-profile/etc/profile.d/*.sh; do\n if [ -r $i ]; then\n . $i\n fi\n done\n fi\n' >> /root/.profile \
-    && printf 'PATH=$NIXPACKS_PATH:$PATH' >> /root/.profile
+    && /nix/var/nix/profiles/default/bin/nix-collect-garbage --delete-old
+
+# Set up the shell profile to source Nix
+RUN echo 'if [ -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then' >> /root/.profile && \
+    echo '  . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' >> /root/.profile && \
+    echo 'fi' >> /root/.profile
 
 ENV \
   ENV=/etc/profile \
@@ -28,7 +31,4 @@ ENV \
   NIXPKGS_ALLOW_BROKEN=1 \
   NIXPKGS_ALLOW_UNFREE=1 \
   NIXPKGS_ALLOW_INSECURE=1 \
-  LD_LIBRARY_PATH=/usr/lib \
-  CPATH=~/.nix-profile/include:$CPATH \
-  LIBRARY_PATH=~/.nix-profile/lib:$LIBRARY_PATH \
-  QTDIR=~/.nix-profile:$QTDIR
+  LD_LIBRARY_PATH=/usr/lib
```

**File**: `src/nixpacks/images.rs` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@ pub const DEBIAN_BASE_IMAGE: &str = "ghcr.io/railwayapp/nixpacks:debian-17428610
 pub const UBUNTU_BASE_IMAGE: &str = "ghcr.io/railwayapp/nixpacks:ubuntu-1742861060";
 pub const DEFAULT_BASE_IMAGE: &str = UBUNTU_BASE_IMAGE;
 
-pub const STANDALONE_IMAGE: &str = "ubuntu:jammy";
+pub const STANDALONE_IMAGE: &str = "ubuntu:noble";
```

**File**: `src/providers/node/turborepo.rs` (modified, +1/-0)
```diff
@@ -64,6 +64,7 @@ impl Turborepo {
         } else if let Some(app_name) = Turborepo::get_app_name(env) {
             return Ok(Some(format!("{dlx} turbo run {app_name}:build")));
         }
+
         Ok(None)
     }
 
```

**File**: `tests/snapshots/generate_plan_tests__go.snap` (modified, +1/-1)
```diff
@@ -34,6 +34,6 @@ expression: plan
   },
   "start": {
     "cmd": "./out",
-    "runImage": "ubuntu:jammy"
+    "runImage": "ubuntu:noble"
   }
 }
```

**File**: `tests/snapshots/generate_plan_tests__go_cmd.snap` (modified, +1/-2)
```diff
@@ -1,7 +1,6 @@
 ---
 source: tests/generate_plan_tests.rs
 expression: plan
-snapshot_kind: text
 ---
 {
   "providers": [],
@@ -47,6 +46,6 @@ snapshot_kind: text
   },
   "start": {
     "cmd": "./out",
-    "runImage": "ubuntu:jammy"
+    "runImage": "ubuntu:noble"
   }
 }
```

**File**: `tests/snapshots/generate_plan_tests__go_custom_version.snap` (modified, +1/-1)
```diff
@@ -46,6 +46,6 @@ expression: plan
   },
   "start": {
     "cmd": "./out",
-    "runImage": "ubuntu:jammy"
+    "runImage": "ubuntu:noble"
   }
 }
```

**File**: `tests/snapshots/generate_plan_tests__go_gin.snap` (modified, +1/-1)
```diff
@@ -46,6 +46,6 @@ expression: plan
   },
   "start": {
     "cmd": "./out",
-    "runImage": "ubuntu:jammy"
+    "runImage": "ubuntu:noble"
   }
 }
```

---

### Incident Patch 8: `59559650` (2025-04-24)
**Commit Message**: lint fix (#1313)

**File**: `src/nixpacks/app.rs` (modified, +1/-1)
```diff
@@ -217,7 +217,7 @@ impl App {
                                 break;
                             }
                             None => break,
-                            _ => continue,
+                            _ => {}
                         }
                     }
                 }
```

**File**: `src/nixpacks/plan/merge.rs` (modified, +2/-2)
```diff
@@ -47,15 +47,15 @@ impl Mergeable for BuildPlan {
                         phase.depends_on_phase("setup");
                     } else if name == "build" {
                         phase.depends_on_phase("install");
-                    };
+                    }
 
                     phase
                 });
 
                 let merged_phase = Phase::merge(&phase, &c2_phase);
                 new_plan.add_phase(merged_phase);
             }
-        };
+        }
 
         new_plan.start_phase = match (new_plan.start_phase, plan2.start_phase) {
             (None, s) | (s, None) => s,
```

**File**: `src/providers/deno.rs` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ impl Provider for DenoProvider {
             let mut build = Phase::build(Some(build_cmd));
             build.depends_on_phase("setup");
             plan.add_phase(build);
-        };
+        }
 
         if let Some(start_cmd) = DenoProvider::get_start_cmd(app)? {
             let start = StartPhase::new(start_cmd);
```

**File**: `src/providers/node/mod.rs` (modified, +2/-2)
```diff
@@ -550,7 +550,7 @@ impl NodeProvider {
                 // npm v9 uses lockfile v3 as default
                 pm_pkg = Pkg::new("npm-9_x");
             }
-        };
+        }
         pkgs.push(pm_pkg.from_overlay(NODE_OVERLAY));
 
         Ok(pkgs)
@@ -673,7 +673,7 @@ impl NodeProvider {
                     }
                 }
             }
-        };
+        }
     }
 }
 
```

**File**: `src/providers/node/turborepo.rs` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ impl Turborepo {
             return Ok(Some(build_cmd));
         } else if let Some(app_name) = Turborepo::get_app_name(env) {
             return Ok(Some(format!("{dlx} turbo run {app_name}:build")));
-        };
+        }
         Ok(None)
     }
 
```

**File**: `src/providers/php/mod.rs` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ impl PhpProvider {
         ));
         if app.includes_file("composer.json") {
             install.add_cmd("composer install --ignore-platform-reqs".to_string());
-        };
+        }
         if app.includes_file("package.json") {
             if let Some(install_cmd) = NodeProvider::get_install_command(app) {
                 install.add_cmd(install_cmd);
```

**File**: `src/providers/procfile.rs` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ impl Provider for ProcfileProvider {
             ]);
             release.cmds = Some(vec!["...".to_string(), release_cmd]);
             plan.add_phase(release);
-        };
+        }
 
         if let Some(start_cmd) = ProcfileProvider::get_start_cmd(app)? {
             let start_phase = StartPhase::new(start_cmd);
```

---

### Incident Patch 9: `f86b05f4` (2025-04-07)
**Commit Message**: fix publish workflow

**File**: `.github/workflows/publish.yml` (modified, +27/-27)
```diff
@@ -3,20 +3,20 @@ on:
     branches:
       - main
     paths:
-      - 'base/publish/*'
+      - "base/publish/*"
   pull_request:
     branches:
       - main
     paths:
-      - 'base/publish/*'
+      - "base/publish/*"
   schedule:
-    - cron:  '0 0 * * 2'
+    - cron: "0 0 * * 2"
   workflow_dispatch:
 
 name: Publish Debian & Ubuntu Base Images
 
 jobs:
-  debian:
+  images:
     runs-on: ubuntu-latest
     permissions:
       contents: write
@@ -27,10 +27,10 @@ jobs:
     steps:
       - name: Checkout sources
         uses: actions/checkout@v4
-        
+
       - name: Set up QEMU
         uses: docker/setup-qemu-action@v3
-        
+
       - name: Set up Docker Buildx
         id: buildx
         uses: docker/setup-buildx-action@v3
@@ -41,33 +41,33 @@ jobs:
           registry: ghcr.io
           username: ${{ github.actor }}
           password: ${{ secrets.GITHUB_TOKEN }}
-      
+
       - name: Get current date
         id: date
         run: echo "::set-output name=date::$(date +%s)"
-      
-      - name: Build and push [Debian]
-        uses: docker/build-push-action@v5
-        with:
-          context: base/debian
-          platforms: linux/arm64, linux/amd64, linux/386
-          push: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
-          tags: ghcr.io/railwayapp/nixpacks:debian, ghcr.io/railwayapp/nixpacks:debian-${{ steps.date.outputs.date }}
-      
+
       - name: Build and push [Ubuntu]
         uses: docker/build-push-action@v5
         with:
           context: base/ubuntu
           platforms: linux/arm64, linux/amd64
           push: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
           tags: ghcr.io/railwayapp/nixpacks:ubuntu, ghcr.io/railwayapp/nixpacks:latest, ghcr.io/railwayapp/nixpacks:ubuntu-${{ steps.date.outputs.date }}
-      
+
+      - name: Build and push [Debian]
+        uses: docker/build-push-action@v5
+        with:
+          context: base/debian
+          platforms: linux/arm64, linux/amd64, linux/386
+          push: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
+          tags: ghcr.io/railwayapp/nixpacks:debian, ghcr.io/railwayapp/nixpacks:debian-${{ steps.date.outputs.date }}
+
       - name: Bump base image
         if: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
         run: |
           sed -i 's/nixpacks:debian-.*/nixpacks:debian-${{ steps.date.outputs.date }}";/g' src/nixpacks/images.rs
           sed -i 's/nixpacks:ubuntu-.*/nixpacks:ubuntu-${{ steps.date.outputs.date }}";/g' src/nixpacks/images.rs
-      
+
       - name: Create Pull Request
         if: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
         uses: peter-evans/create-pull-request@v7
@@ -79,20 +79,12 @@ jobs:
           delete-branch: true
           title: Bump base images to `${{ steps.date.outputs.date }}`
           labels: release/patch
-          
+
       - name: Login to Docker Hub
         uses: docker/login-action@v3
         with:
           username: ${{ secrets.DOCKERHUB_USERNAME }}
           password: ${{ secrets.DOCKERHUB_TOKEN }}
-           
-      - name: Build and push to Docker Hub [Debian]
-        uses: docker/build-push-action@v5
-        with:
-          context: base/debian
-          platforms: linux/arm64, linux/amd64, linux/386
-          push: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
-          tags: railwayapp/nixpacks:debian, railwayapp/nixpacks:latest, railwayapp/nixpacks:debian-${{ steps.date.outputs.date }}
 
       - name: Build and push to Docker Hub [Ubuntu]
         uses: docker/build-push-action@v5
@@ -101,3 +93,11 @@ jobs:
           platforms: linux/arm64, linux/amd64
           push: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
           tags: railwayapp/nixpacks:ubuntu, railwayapp/nixpacks:ubuntu-${{ steps.date.outputs.date }}
+
+      - name: Build and push to Docker Hub [Debian]
+        uses: docker/build-push-action@v5
+        with:
+          context: base/debian
+          platforms: linux/arm64, linux/amd64, linux/386
+          push: ${{ github.event_name == 'push' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
+          tags: railwayapp/nixpacks:debian, railwayapp/nixpacks:latest, railwayapp/nixpacks:debian-${{ steps.date.outputs.date }}
```

---

### Incident Patch 10: `793fa864` (2025-03-10)
**Commit Message**: fix building remix apps with node (#1290)

* fix building remix apps with node

* add remix snapshot test

**File**: `examples/node-remix/.eslintrc.cjs` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+/**
+ * This is intended to be a basic starting point for linting in your app.
+ * It relies on recommended configs out of the box for simplicity, but you can
+ * and should modify this configuration to best suit your team's needs.
+ */
+
+/** @type {import('eslint').Linter.Config} */
+module.exports = {
+  root: true,
+  parserOptions: {
+    ecmaVersion: "latest",
+    sourceType: "module",
+    ecmaFeatures: {
+      jsx: true,
+    },
+  },
+  env: {
+    browser: true,
+    commonjs: true,
+    es6: true,
+  },
+  ignorePatterns: ["!**/.server", "!**/.client"],
+
+  // Base config
+  extends: ["eslint:recommended"],
+
+  overrides: [
+    // React
+    {
+      files: ["**/*.{js,jsx,ts,tsx}"],
+      plugins: ["react", "jsx-a11y"],
+      extends: [
+        "plugin:react/recommended",
+        "plugin:react/jsx-runtime",
+        "plugin:react-hooks/recommended",
+        "plugin:jsx-a11y/recommended",
+      ],
+      settings: {
+        react: {
+          version: "detect",
+        },
+        formComponents: ["Form"],
+        linkComponents: [
+          { name: "Link", linkAttribute: "to" },
+          { name: "NavLink", linkAttribute: "to" },
+        ],
+        "import/resolver": {
+          typescript: {},
+        },
+      },
+    },
+
+    // Typescript
+    {
+      files: ["**/*.{ts,tsx}"],
+      plugins: ["@typescript-eslint", "import"],
+      parser: "@typescript-eslint/parser",
+      settings: {
+        "import/internal-regex": "^~/",
+        "import/resolver": {
+          node: {
+            extensions: [".ts", ".tsx"],
+          },
+          typescript: {
+            alwaysTryTypes: true,
+          },
+        },
+      },
+      extends: [
+        "plugin:@typescript-eslint/recommended",
+        "plugin:import/recommended",
+        "plugin:import/typescript",
+      ],
+    },
+
+    // Node
+    {
+      files: [".eslintrc.cjs"],
+      env: {
+        node: true,
+      },
+    },
+  ],
+};
```

**File**: `examples/node-remix/.gitignore` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+node_modules
+
+/.cache
+/build
+.env
```

**File**: `examples/node-remix/README.md` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+# Welcome to Remix!
+
+- 📖 [Remix docs](https://remix.run/docs)
+
+## Development
+
+Run the dev server:
+
+```shellscript
+npm run dev
+```
+
+## Deployment
+
+First, build your app for production:
+
+```sh
+npm run build
+```
+
+Then run the app in production mode:
+
+```sh
+npm start
+```
+
+Now you'll need to pick a host to deploy it to.
+
+### DIY
+
+If you're familiar with deploying Node applications, the built-in Remix app server is production-ready.
+
+Make sure to deploy the output of `npm run build`
+
+- `build/server`
+- `build/client`
+
+## Styling
+
+This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.
```

**File**: `examples/node-remix/app/entry.client.tsx` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+/**
+ * By default, Remix will handle hydrating your app on the client for you.
+ * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
+ * For more information, see https://remix.run/file-conventions/entry.client
+ */
+
+import { RemixBrowser } from "@remix-run/react";
+import { startTransition, StrictMode } from "react";
+import { hydrateRoot } from "react-dom/client";
+
+startTransition(() => {
+  hydrateRoot(
+    document,
+    <StrictMode>
+      <RemixBrowser />
+    </StrictMode>
+  );
+});
```

**File**: `examples/node-remix/app/entry.server.tsx` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+/**
+ * By default, Remix will handle generating the HTTP Response for you.
+ * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
+ * For more information, see https://remix.run/file-conventions/entry.server
+ */
+
+import { PassThrough } from "node:stream";
+
+import type { AppLoadContext, EntryContext } from "@remix-run/node";
+import { createReadableStreamFromReadable } from "@remix-run/node";
+import { RemixServer } from "@remix-run/react";
+import { isbot } from "isbot";
+import { renderToPipeableStream } from "react-dom/server";
+
+const ABORT_DELAY = 5_000;
+
+export default function handleRequest(
+  request: Request,
+  responseStatusCode: number,
+  responseHeaders: Headers,
+  remixContext: EntryContext,
+  // This is ignored so we can keep it in the template for visibility.  Feel
+  // free to delete this parameter in your app if you're not using it!
+  // eslint-disable-next-line @typescript-eslint/no-unused-vars
+  loadContext: AppLoadContext
+) {
+  return isbot(request.headers.get("user-agent") || "")
+    ? handleBotRequest(
+        request,
+        responseStatusCode,
+        responseHeaders,
+        remixContext
+      )
+    : handleBrowserRequest(
+        request,
+        responseStatusCode,
+        responseHeaders,
+        remixContext
+      );
+}
+
+function handleBotRequest(
+  request: Request,
+  responseStatusCode: number,
+  responseHeaders: Headers,
+  remixContext: EntryContext
+) {
+  return new Promise((resolve, reject) => {
+    let shellRendered = false;
+    const { pipe, abort } = renderToPipeableStream(
+      <RemixServer
+        context={remixContext}
+        url={request.url}
+        abortDelay={ABORT_DELAY}
+      />,
+      {
+        onAllReady() {
+          shellRendered = true;
+          const body = new PassThrough();
+          const stream = createReadableStreamFromReadable(body);
+
+          responseHeaders.set("Content-Type", "text/html");
+
+          resolve(
+            new Response(stream, {
+              headers: responseHeaders,
+              status: responseStatusCode,
+            })
+          );
+
+          pipe(body);
+        },
+        onShellError(error: unknown) {
+          reject(error);
+        },
+        onError(error: unknown) {
+          responseStatusCode = 500;
+          // Log streaming rendering errors from inside the shell.  Don't log
+          // errors encountered during initial shell rendering since they'll
+          // reject and get logged in handleDocumentRequest.
+          if (shellRendered) {
+            console.error(error);
+          }
+        },
+      }
+    );
+
+    setTimeout(abort, ABORT_DELAY);
+  });
+}
+
+function handleBrowserRequest(
+  request: Request,
+  responseStatusCode: number,
+  responseHeaders: Headers,
+  remixContext: EntryContext
+) {
+  return new Promise((resolve, reject) => {
+    let shellRendered = false;
+    const { pipe, abort } = renderToPipeableStream(
+      <RemixServer
+        context={remixContext}
+        url={request.url}
+        abortDelay={ABORT_DELAY}
+      />,
+      {
+        onShellReady() {
+          shellRendered = true;
+          const body = new PassThrough();
+          const stream = createReadableStreamFromReadable(body);
+
+          responseHeaders.set("Content-Type", "text/html");
+
+          resolve(
+            new Response(stream, {
+              headers: responseHeaders,
+              status: responseStatusCode,
+            })
+          );
+
+          pipe(body);
+        },
+        onShellError(error: unknown) {
+          reject(error);
+        },
+        onError(error: unknown) {
+          responseStatusCode = 500;
+          // Log streaming rendering errors from inside the shell.  Don't log
+          // errors encountered during initial shell rendering since they'll
+          // reject and get logged in handleDocumentRequest.
+          if (shellRendered) {
+            console.error(error);
+          }
+        },
+      }
+    );
+
+    setTimeout(abort, ABORT_DELAY);
+  });
+}
```

**File**: `examples/node-remix/app/root.tsx` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import {
+  Links,
+  Meta,
+  Outlet,
+  Scripts,
+  ScrollRestoration,
+} from "@remix-run/react";
+import type { LinksFunction } from "@remix-run/node";
+
+import "./tailwind.css";
+
+export const links: LinksFunction = () => [
+  { rel: "preconnect", href: "https://fonts.googleapis.com" },
+  {
+    rel: "preconnect",
+    href: "https://fonts.gstatic.com",
+    crossOrigin: "anonymous",
+  },
+  {
+    rel: "stylesheet",
+    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
+  },
+];
+
+export function Layout({ children }: { children: React.ReactNode }) {
+  return (
+    <html lang="en">
+      <head>
+        <meta charSet="utf-8" />
+        <meta name="viewport" content="width=device-width, initial-scale=1" />
+        <Meta />
+        <Links />
+      </head>
+      <body>
+        {children}
+        <ScrollRestoration />
+        <Scripts />
+      </body>
+    </html>
+  );
+}
+
+export default function App() {
+  return <Outlet />;
+}
```

**File**: `examples/node-remix/app/routes/_index.tsx` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+import type { MetaFunction } from "@remix-run/node";
+
+export const meta: MetaFunction = () => {
+  return [
+    { title: "New Remix App" },
+    { name: "description", content: "Welcome to Remix!" },
+  ];
+};
+
+export default function Index() {
+  return (
+    <div className="flex h-screen items-center justify-center">
+      <div className="flex flex-col items-center gap-16">
+        <header className="flex flex-col items-center gap-9">
+          <h1 className="leading text-2xl font-bold text-gray-800 dark:text-gray-100">
+            Welcome to <span className="sr-only">Remix</span>
+          </h1>
+          <div className="h-[144px] w-[434px]">
+            <img
+              src="/logo-light.png"
+              alt="Remix"
+              className="block w-full dark:hidden"
+            />
+            <img
+              src="/logo-dark.png"
+              alt="Remix"
+              className="hidden w-full dark:block"
+            />
+          </div>
+        </header>
+        <nav className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-gray-200 p-6 dark:border-gray-700">
+          <p className="leading-6 text-gray-700 dark:text-gray-200">
+            What&apos;s next?
+          </p>
+          <ul>
+            {resources.map(({ href, text, icon }) => (
+              <li key={href}>
+                <a
+                  className="group flex items-center gap-3 self-stretch p-3 leading-normal text-blue-700 hover:underline dark:text-blue-500"
+                  href={href}
+                  target="_blank"
+                  rel="noreferrer"
+                >
+                  {icon}
+                  {text}
+                </a>
+              </li>
+            ))}
+          </ul>
+        </nav>
+      </div>
+    </div>
+  );
+}
+
+const resources = [
+  {
+    href: "https://remix.run/start/quickstart",
+    text: "Quick Start (5 min)",
+    icon: (
+      <svg
+        xmlns="http://www.w3.org/2000/svg"
+        width="24"
+        height="20"
+        viewBox="0 0 20 20"
+        fill="none"
+        className="stroke-gray-600 group-hover:stroke-current dark:stroke-gray-300"
+      >
+        <path
+          d="M8.51851 12.0741L7.92592 18L15.6296 9.7037L11.4815 7.33333L12.0741 2L4.37036 10.2963L8.51851 12.0741Z"
+          strokeWidth="1.5"
+          strokeLinecap="round"
+          strokeLinejoin="round"
+        />
+      </svg>
+    ),
+  },
+  {
+    href: "https://remix.run/start/tutorial",
+    text: "Tutorial (30 min)",
+    icon: (
+      <svg
+        xmlns="http://www.w3.org/2000/svg"
+        width="24"
+        height="20"
+        viewBox="0 0 20 20"
+        fill="none"
+        className="stroke-gray-600 group-hover:stroke-current dark:stroke-gray-300"
+      >
+        <path
+          d="M4.561 12.749L3.15503 14.1549M3.00811 8.99944H1.01978M3.15503 3.84489L4.561 5.2508M8.3107 1.70923L8.3107 3.69749M13.4655 3.84489L12.0595 5.2508M18.1868 17.0974L16.635 18.6491C16.4636 18.8205 16.1858 18.8205 16.0144 18.6491L13.568 16.2028C13.383 16.0178 13.0784 16.0347 12.915 16.239L11.2697 18.2956C11.047 18.5739 10.6029 18.4847 10.505 18.142L7.85215 8.85711C7.75756 8.52603 8.06365 8.21994 8.39472 8.31453L17.6796 10.9673C18.0223 11.0653 18.1115 11.5094 17.8332 11.7321L15.7766 13.3773C15.5723 13.5408 15.5554 13.8454 15.7404 14.0304L18.1868 16.4767C18.3582 16.6481 18.3582 16.926 18.1868 17.0974Z"
+          strokeWidth="1.5"
+          strokeLinecap="round"
+          strokeLinejoin="round"
+        />
+      </svg>
+    ),
+  },
+  {
+    href: "https://remix.run/docs",
+    text: "Remix Docs",
+    icon: (
+      <svg
+        xmlns="http://www.w3.org/2000/svg"
+        width="24"
+        height="20"
+        viewBox="0 0 20 20"
+        fill="none"
+        className="stroke-gray-600 group-hover:stroke-current dark:stroke-gray-300"
+      >
+        <path
+          d="M9.99981 10.0751V9.99992M17.4688 17.4688C15.889 19.0485 11.2645 16.9853 7.13958 12.8604C3.01467 8.73546 0.951405 4.11091 2.53116 2.53116C4.11091 0.951405 8.73546 3.01467 12.8604 7.13958C16.9853 11.2645 19.0485 15.889 17.4688 17.4688ZM2.53132 17.4688C0.951566 15.8891 3.01483 11.2645 7.13974 7.13963C11.2647 3.01471 15.8892 0.951453 17.469 2.53121C19.0487 4.11096 16.9854 8.73551 12.8605 12.8604C8.73562 16.9853 4.11107 19.0486 2.53132 17.4688Z"
+          strokeWidth="1.5"
+          strokeLinecap="round"
+        />
+      </svg>
+    ),
+  },
+  {
+    href: "https://rmx.as/discord",
+    text: "Join Discord",
+    icon: (
+      <svg
+        xmlns="http://www.w3.org/2000/svg"
+        width="24"
+        height="20"
+        viewBox="0 0 24 20"
+        fill="none"
+        className="stroke-gray-600 group-hover:stroke-current dark:stroke-gray-300"
+      >
+        <path
+          d="M15.0686 1.25995L14.5477 1.17423L14.2913 1.63578C14.1754 1.84439 14.0545 2.08275 13.9422 2.31963C12.6461 2.16488 11.3406 2.16505 10.0445 2.32014C9.92822 2.08178 9.80478 1.8497
```

**File**: `examples/node-remix/app/tailwind.css` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+@tailwind base;
+@tailwind components;
+@tailwind utilities;
+
+html,
+body {
+  @apply bg-white dark:bg-gray-950;
+
+  @media (prefers-color-scheme: dark) {
+    color-scheme: dark;
+  }
+}
```

---

### Incident Patch 11: `d9e65136` (2025-02-20)
**Commit Message**: Revert "docs: clarify environment variable setting for Node provider (#1251)" (#1282)

This reverts commit 7653b2f1a8b7c4532adb51d1c8f7f20cbd26386c.

**File**: `docs/pages/docs/providers/node.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ The Node provider supports NPM, Yarn, Yarn 2, PNPM and Bun.
 
 ## Environment Variables
 
-The Node provider sets the following environment variables when the container is running (not during build):
+The Node provider sets the following environment variables:
 
 - `CI=true`
 - `NODE_ENV=production`
```

---

### Incident Patch 12: `b164dc52` (2025-01-16)
**Commit Message**: Add Coolify as a Nixpacks is available as a builder on it (#1262)

Co-authored-by: Jake Runzer <[REDACTED_EMAIL]>

**File**: `docs/pages/docs/deploying/coolify.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+title: Coolify
+---
+
+# {% $markdoc.frontmatter.title %}
+
+Nixpacks is available as a builder on [Coolify](https://coolify.io/). Configure the builder on the service settings page.
+
+![](/images/coolify.png)
```

**File**: `docs/sidebar.ts` (modified, +6/-5)
```diff
@@ -65,14 +65,15 @@ export const sidebarItems: ISidebarSection[] = [
     text: "Deploying",
     links: [
       { text: "Railway", href: "/docs/deploying/railway" },
-      { text: "Stacktape", href: "/docs/deploying/stacktape" },
-      { text: "Flightcontrol", href: "/docs/deploying/flightcontrol" },
-      { text: "Easypanel", href: "/docs/deploying/easypanel" },
       { text: "Coherence", href: "/docs/deploying/coherence" },
-      { text: "PipeOps", href: "/docs/deploying/pipeops" },
+      { text: "Coolify", href: "/docs/deploying/coolify" },
+      { text: "Dokku", href: "/docs/deploying/dokku" },
       { text: "Dokploy", href: "/docs/deploying/dokploy" },
+      { text: "Easypanel", href: "/docs/deploying/easypanel" },
+      { text: "Flightcontrol", href: "/docs/deploying/flightcontrol" },
       { text: "GitHub Actions", href: "/docs/deploying/github-actions" },
-      { text: "Dokku", href: "/docs/deploying/dokku" },
+      { text: "PipeOps", href: "/docs/deploying/pipeops" },
+      { text: "Stacktape", href: "/docs/deploying/stacktape" },
     ],
   },
 ];
```

---

### Incident Patch 13: `b161f1af` (2025-01-11)
**Commit Message**: fix clipply lints (#1260)

* fix clipply lints

* pin rust in lunatic example

**File**: `examples/lunatic-basic/Cargo.toml` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 name = "lunatic-basic"
 version = "0.1.0"
 edition = "2021"
+rust-version = "1.83.0"
 
 # See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
 
```

**File**: `src/nixpacks/environment.rs` (modified, +2/-4)
```diff
@@ -18,11 +18,9 @@ impl Environment {
     /// Collects all variables from the calling environment.
     pub fn from_envs(envs: Vec<&str>) -> Result<Environment> {
         let mut environment = Environment::default();
+        let re = Regex::new(r"([A-Za-z0-9_-]*)(?:=?)([\s\S]*)").unwrap();
         for env in envs {
-            let matches = Regex::new(r"([A-Za-z0-9_-]*)(?:=?)([\s\S]*)")
-                .unwrap()
-                .captures(env)
-                .unwrap();
+            let matches = re.captures(env).unwrap();
             if matches.get(2).unwrap().as_str() == "" {
                 // No value, pull from the current environment
                 let name = matches.get(1).unwrap().as_str();
```

**File**: `src/providers/clojure.rs` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ const DEFAULT_JDK_PKG_NAME: &str = "jdk8";
 pub struct ClojureProvider {}
 
 impl Provider for ClojureProvider {
-    fn name(&self) -> &str {
+    fn name(&self) -> &'static str {
         "clojure"
     }
 
```

**File**: `src/providers/cobol.rs` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ const DEFAULT_COBOL_COMPILE_ARGS: &str = "-x -o";
 pub struct CobolProvider {}
 
 impl Provider for CobolProvider {
-    fn name(&self) -> &str {
+    fn name(&self) -> &'static str {
         "cobol"
     }
 
```

**File**: `src/providers/crystal.rs` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ pub struct ShardYaml {
 pub struct CrystalProvider {}
 
 impl Provider for CrystalProvider {
-    fn name(&self) -> &str {
+    fn name(&self) -> &'static str {
         "crystal"
     }
 
```

**File**: `src/providers/csharp.rs` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ pub struct CSharpProvider {}
 pub const ARTIFACT_DIR: &str = "out";
 
 impl Provider for CSharpProvider {
-    fn name(&self) -> &str {
+    fn name(&self) -> &'static str {
         "c#"
     }
 
```

**File**: `src/providers/dart.rs` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ pub struct DartPubspec {
 pub struct DartProvider {}
 
 impl Provider for DartProvider {
-    fn name(&self) -> &str {
+    fn name(&self) -> &'static str {
         "dart"
     }
 
```

**File**: `src/providers/deno.rs` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ pub struct DenoJson {
 pub struct DenoProvider {}
 
 impl Provider for DenoProvider {
-    fn name(&self) -> &str {
+    fn name(&self) -> &'static str {
         "deno"
     }
 
```

---

### Incident Patch 14: `1c61eb9e` (2025-01-06)
**Commit Message**: fix(plan): stdout logic for valid output files (#1249)

* feat: cleanup build plan logic and stdout

Don't let build plans generate anything other than the build plan
itself. If an error or warning should be generated, it should be
outputted to stderr. That way consumers can be pretty confident that the
output is only ever in valid TOML/JSON format.

* docs: add expected output behavior of -- plan

* chore: fix linting error

---------

Co-authored-by: Jake Runzer <[REDACTED_EMAIL]>

**File**: `docs/pages/docs/cli.md` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ nixpacks plan examples/node
 ```
 
 By default, the plan is output in JSON format. You can output in TOML format with the `--format toml` option.
+The generated plan will be outputted to stdout, while some providers expose recoverable errors to stderr.
 
 View all plan options with
 
```

**File**: `src/main.rs` (modified, +2/-1)
```diff
@@ -76,7 +76,8 @@ struct Args {
 #[allow(clippy::large_enum_variant)]
 #[derive(Subcommand)]
 enum Commands {
-    /// Generate a build plan for an app
+    /// Generate a build plan for an app.
+    /// Generated plan will be outputted to stdout, while warnings might be outputted to stderr.
     Plan {
         /// App source
         path: String,
```

**File**: `src/providers/node/mod.rs` (modified, +1/-1)
```diff
@@ -631,7 +631,7 @@ fn version_number_to_pkg(version: u32) -> String {
 fn parse_node_version_into_pkg(node_version: &str) -> String {
     let default_node_pkg_name = version_number_to_pkg(DEFAULT_NODE_VERSION);
     let range: Range = node_version.parse().unwrap_or_else(|_| {
-        println!("Warning: node version {node_version} is not valid, using default node version {default_node_pkg_name}");
+        eprintln!("Warning: node version {node_version} is not valid, using default node version {default_node_pkg_name}");
         Range::parse(DEFAULT_NODE_VERSION.to_string()).unwrap()
     });
     let mut available_node_versions = AVAILABLE_NODE_VERSIONS.to_vec();
```

**File**: `src/providers/node/turborepo.rs` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ impl Turborepo {
                     format!("{pkg_manager} --workspace {name} run start")
                 }));
             }
-            println!("Warning: Turborepo app `{name}` not found");
+            eprintln!("Warning: Turborepo app `{name}` not found");
         }
         if let Some(start_pipeline) = Turborepo::get_start_cmd(&turbo_cfg) {
             return Ok(Some(start_pipeline));
```

**File**: `src/providers/php/mod.rs` (modified, +2/-2)
```diff
@@ -209,13 +209,13 @@ impl PhpProvider {
             } else if v.contains("7.4") {
                 "7.4".to_string()
             } else {
-                println!(
+                eprintln!(
                     "Warning: PHP version {v} is not available, using PHP {DEFAULT_PHP_VERSION}"
                 );
                 DEFAULT_PHP_VERSION.to_string()
             }
         } else {
-            println!("Warning: No PHP version specified, using PHP {DEFAULT_PHP_VERSION}; see https://getcomposer.org/doc/04-schema.md#package-links for how to specify a PHP version.");
+            eprintln!("Warning: No PHP version specified, using PHP {DEFAULT_PHP_VERSION}; see https://getcomposer.org/doc/04-schema.md#package-links for how to specify a PHP version.");
             DEFAULT_PHP_VERSION.to_string()
         };
 
```

**File**: `src/providers/python.rs` (modified, +4/-7)
```diff
@@ -377,13 +377,10 @@ impl PythonProvider {
         Ok(asdf_versions.get("python").map(|s| {
             let parts: Vec<&str> = s.split('.').collect();
 
-            if parts.len() == 3 {
-                // this is the expected result, but will be unexpected to users
-                println!("Patch python version detected in .tool-versions, but not supported in nixpkgs.");
-            } else if parts.len() == 2 {
-                println!("Expected a python version string in the format x.y.z from .tool-versions");
-            } else {
-                println!("Could not find a python version string in the format x.y.z or x.y from .tool-versions");
+            // We expect there to be 3 or 2 parts (x.y.z) however, only x.y can be parsed.
+            // So we accept strip x.y.z -> x.y and warn that all other formats are invalid
+            if parts.len() != 3 && parts.len() != 2 {
+                eprintln!("Could not find a python version string in the format x.y.z or x.y from .tool-versions. Found {}. Skipping", parts.join("."));
             }
 
             format!("{}.{}", parts[0], parts[1])
```

---

### Incident Patch 15: `d86e22de` (2025-01-06)
**Commit Message**: Fix #1241: nixpack plan generates an invalid toml file for python projects containing a .tool-versions file. (#1242)

I assume that outputting those lines before the toml or json file is not intended. If it is then please ignore this commit.

Another option might be to print these messages to stderr instead?

**File**: `src/providers/python.rs` (modified, +0/-2)
```diff
@@ -86,7 +86,6 @@ impl Provider for PythonProvider {
                 if let Some(poetry_version) =
                     PythonProvider::parse_tool_versions_poetry_version(file_content)?
                 {
-                    println!("Using poetry version from .tool-versions: {poetry_version}");
                     version = poetry_version;
                 }
             }
@@ -114,7 +113,6 @@ impl Provider for PythonProvider {
                 if let Some(uv_version) =
                     PythonProvider::parse_tool_versions_uv_version(file_content)?
                 {
-                    println!("Using uv version from .tool-versions: {uv_version}");
                     version = uv_version;
                 }
             }
```

#### Recent Merged Pull Requests:
- **PR #1446** (closed): chore(deps): bump docker/build-push-action from 5 to 6 (@dependabot[bot])
- **PR #1445** (closed): Bump base images to `1788221300` (@railway-bot)
- **PR #1444** (closed): fix(node): select overlay package for major version 11 (@BetterAndBetterII)
- **PR #1443** (closed): Bump base images to `1787616282` (@railway-bot)
- **PR #1442** (closed): Bump base images to `1787011451` (@railway-bot)
- **PR #1441** (closed): Bump base images to `1786406911` (@railway-bot)
- **PR #1440** (closed): Bump base images to `1785802875` (@railway-bot)
- **PR #1439** (closed): chore(deps): bump docker/login-action from 3 to 4.5.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
