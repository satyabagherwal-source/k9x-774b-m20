# Forensic Learning Record (Deep Inspection): joreilly/PeopleInSpace

> **Canonical Artifact**: `07_PROJECT_LEARNING/joreilly-peopleinspace-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/joreilly/PeopleInSpace](https://github.com/joreilly/PeopleInSpace))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:29:29.498Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `joreilly/PeopleInSpace`
- **Description**: Kotlin Multiplatform sample with SwiftUI, Jetpack Compose, Compose for Wear, Compose for Desktop, and Compose for Web clients along with Ktor backend.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3430 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `compose-web/src/wasmJsMain/resources/sqljs.worker.js`
```
import initSqlJs from "sql.js";

let db = null;

async function createDatabase() {
    let SQL = await initSqlJs({locateFile: file => 'sql-wasm.wasm'});
    db = new SQL.Database();
}

function onModuleReady() {
    const data = this.data;

    switch (data && data.action) {
        case "exec":
            if (!data["sql"]) {
                throw new Error("exec: Missing query string");
            }

            return postMessage({
                id: data.id,
                results: db.exec(data.sql, data.params)[0] ?? {values: []}
            });
        case "begin_transaction":
            return postMessage({
                id: data.id,
                results: db.exec("BEGIN TRANSACTION;")
            })
        case "end_transaction":
            return postMessage({
                id: data.id,
                results: db.exec("END TRANSACTION;")
            })
        case "rollback_transaction":
            return postMessage({
                id: data.id,
                results: db.exec("ROLLBACK TRANSACTION;")
            })
        default:
            throw new Error(`Unsupported action: ${data && data.action}`);
    }
}

function onError(err) {
    return postMessage({
        id: this.data.id,
        error: err
    });
}

if (typeof importScripts === "function") {
    db = null;
    const sqlModuleReady = createDatabase()
    self.onmessage = (event) => {
        return sqlModuleReady
            .then(onModuleReady.bind(event))
            .catch(onError.bind(event));
    }
}

```

### Core Architecture Module: `compose-web/webpack.config.d/config.js`
```
const TerserPlugin = require("terser-webpack-plugin");

config.optimization = config.optimization || {};
config.optimization.minimize = true;
config.optimization.minimizer = [
    new TerserPlugin({
        terserOptions: {
            mangle: true,    // Note: By default, mangle is set to true.
            compress: false, // Disable the transformations that reduce the code size.
            output: {
                beautify: false,
            },
        },
    }),
];
```

### Core Architecture Module: `compose-web/webpack.config.d/sqljs-config.js`
```
// {project}/webpack.config.d/sqljs.js
config.resolve = {
    fallback: {
        fs: false,
        path: false,
        crypto: false,
    }
};

const CopyWebpackPlugin = require('copy-webpack-plugin');
config.plugins.push(
    new CopyWebpackPlugin({
        patterns: [
            '../../node_modules/sql.js/dist/sql-wasm.wasm'
        ]
    })
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #532** (2026-09-25): **Update to Kotlin 2.4.20 and SKIE 0.10.15**
  *Symptoms*: ## Summary - Bump Kotlin 2.4.10 → 2.4.20 and SKIE 0.10.14 → 0.10.15 (SKIE release adding Kotlin 2.4.20 support), plus the forced `kotlin-test*` versions in `build.gradle.kts`. - Kotlin 2.4.20 moved webpack tooling out of the project `node_modules`, so `terser-webpack-plugin` (required by `compose-web/webpack.config.d/config.js`) is now declared as a `devNpm` dependency; wasm `yarn.lock` regenerated.  ## Test plan - [x] Android app + Wear app `assembleDebug` - [x] Desktop, backend, mcp-server jars - [x] `:compose-web:wasmJsBrowserProductionWebpack` - [x] iOS arm64 + simulator framework link - [x] SwiftUI app `xcodebuild` (same command as `ios.yml`) - [x] `:common:jvmTest` (13 tests pass) - [ ] CI green  Pre-existing on `main`, not addressed here: `distZip`/`distTar` duplicate `runtime-saveable-desktop` jar, and `:common:wasmJsTest` Compose UI test config check.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01T91dvBokCLmqtN6AkDkQr1

- **Issue #527** (2026-09-20): **Update androidGradlePlugin to v9.4.1**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [com.android.kotlin.multiplatform.library](https://developer.android.com/studio/build) ([source](https://android.googlesource.com/platform/tools/base)) | `9.1.1` → `9.4.1` | ![age](https://developer.mend.io/api/mc/badges/age/maven/com.android.kotlin.multiplatform.library:com.android.kotlin.multiplatform.library.gradle.plugin/9.4.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.android.kotlin.multiplatform.library:com.android.kotlin.multiplatform.library.gradle.plugin/9.1.1/9.4.1?slim=true) | | [com.android.application](https://developer.android.com/studio/build) ([source](https://android.googlesource.com/platform/tools/base)) | `9.1.1` → `9.4.1` | ![age](https://developer.mend.io/api/mc/badges/age/maven/com.android.application:com.android.application.gradle.plugin/9.4.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.android.application:com.android.application.gradle.plugin/9.1.1/9.4.1?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**:
  **Post-Mortem & Fix Analysis**:
  > ### Renovate Ignore Notification  Because you closed this PR without merging, Renovate will ignore this update (`9.4.1`). You will get a PR once a newer version is released. To ignore this dependency forever, add it to the `ignoreDeps` array of your Renovate config.  If you accidentally closed this PR, or if you changed your mind: rename this PR to get a fresh replacement PR.

- **Issue #526** (2026-09-20): **Update coilCompose3 to v3.6.3**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [io.coil-kt.coil3:coil-network-ktor3](https://redirect.github.com/coil-kt/coil) | `3.6.2` → `3.6.3` | ![age](https://developer.mend.io/api/mc/badges/age/maven/io.coil-kt.coil3:coil-network-ktor3/3.6.3?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/io.coil-kt.coil3:coil-network-ktor3/3.6.2/3.6.3?slim=true) | | [io.coil-kt.coil3:coil-compose](https://redirect.github.com/coil-kt/coil) | `3.6.2` → `3.6.3` | ![age](https://developer.mend.io/api/mc/badges/age/maven/io.coil-kt.coil3:coil-compose/3.6.3?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/io.coil-kt.coil3:coil-compose/3.6.2/3.6.3?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Release Notes  <details> <summary>coil-kt/coil (io.coil-kt.coil3:coil-network-ktor3)</summary>  ### [`v3.6.3`](https://redirect.github.com/coil-kt/coil/blob/HEAD/CHANGELOG.md#363---September-18-2026)  [Compare Source](https://redirect.github.com/coil-kt/coil/compare/3.6.2...3.6.3)  - Fix builds using Android Gradle Plugin 9.4.0 and R8 failing due to invalid characters in Kotlin module name metadata.  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creatio

- **Issue #523** (2026-09-13): **Update dependency Microsoft.WindowsAppSDK to v2**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [Microsoft.WindowsAppSDK](https://redirect.github.com/microsoft/windowsappsdk) | `1.8.260710003` → `2.4.0` | ![age](https://developer.mend.io/api/mc/badges/age/nuget/Microsoft.WindowsAppSDK/2.4.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/nuget/Microsoft.WindowsAppSDK/1.8.260710003/2.4.0?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Release Notes  <details> <summary>microsoft/windowsappsdk (Microsoft.WindowsAppSDK)</summary>  ### [`v2.4.0`](https://redirect.github.com/microsoft/WindowsAppSDK/releases/tag/v2.4.0): Windows App SDK 2.4.0  #### Windows App SDK 2.4.0  Windows App SDK 2.4.0 is the latest stable release on the 2.x line, adding expanded input support, more precise `LanguageModel` response statuses, and targeted reliability fixes across input, Storage Pickers, MRT Core, app runtime isolation, composition, and XAML tooling.  ##### What's new in WinAppSDK 2.4.0:  - **Expanded input support.** WinUI 3 apps can now use operating system touchpad and mouse haptics through `Windows.Devices.Haptics`, along with touchpad single-finger panning, when supported by the operating system and hardware. - **More precise `LanguageModel` response 

- **Issue #522** (2026-09-13): **Update actions/setup-java action to v6**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [actions/setup-java](https://redirect.github.com/actions/setup-java) | action | major | `v5` → `v6` |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Release Notes  <details> <summary>actions/setup-java (actions/setup-java)</summary>  ### [`v6.0.1`](https://redirect.github.com/actions/setup-java/compare/v6.0.0...v6.0.1)  [Compare Source](https://redirect.github.com/actions/setup-java/compare/v6.0.0...v6.0.1)  ### [`v6.0.0`](https://redirect.github.com/actions/setup-java/compare/v5.7.0...v6.0.0)  [Compare Source](https://redirect.github.com/actions/setup-java/compare/v5.7.0...v6.0.0)  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/joreilly/PeopleInSpace). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI

- **Issue #521** (2026-09-13): **Update actions/setup-dotnet action to v6**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [actions/setup-dotnet](https://redirect.github.com/actions/setup-dotnet) | action | major | `v5` → `v6` |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Release Notes  <details> <summary>actions/setup-dotnet (actions/setup-dotnet)</summary>  ### [`v6.0.0`](https://redirect.github.com/actions/setup-dotnet/releases/tag/v6.0.0)  [Compare Source](https://redirect.github.com/actions/setup-dotnet/compare/v5.4.0...v6.0.0)  ##### What's Changed  - Migrate to ESM and upgrade dependencies by [@&#8203;priyagupta108](https://redirect.github.com/priyagupta108) in [#&#8203;752](https://redirect.github.com/actions/setup-dotnet/pull/752) - Bump actions/checkout from 6.0.3 to 7.0.0 by [@&#8203;dependabot](https://redirect.github.com/dependabot)\[bot] in [#&#8203;751](https://redirect.github.com/actions/setup-dotnet/pull/751) - chore(deps): bump [@&#8203;actions/cache](https://redirect.github.com/actions/cache) to 6.2.0 by [@&#8203;philip-gai](https://redirect.github.com/philip-gai) in [#&#8203;756](https://redirect.github.com/actions/setup-dotnet/pull/756)  ##### New Contributors  - [@&#8203;philip-gai](https://redirect.github.com/philip-gai) made their first contribution in [#&#8203;756](https://redirect.github.com/actions/setup-dotnet/pull/756)  **Full Changelog**: <https://github.com/actions/setup-d

- **Issue #520** (2026-09-13): **Update dependency io.github.xxfast.kotlin.native.nuget to v0.6.0**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | io.github.xxfast.kotlin.native.nuget | `0.4.0` → `0.6.0` | ![age](https://developer.mend.io/api/mc/badges/age/maven/io.github.xxfast.kotlin.native.nuget:io.github.xxfast.kotlin.native.nuget.gradle.plugin/0.6.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/io.github.xxfast.kotlin.native.nuget:io.github.xxfast.kotlin.native.nuget.gradle.plugin/0.4.0/0.6.0?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/joreilly/PeopleInSpace). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC43OS4xIiwidXBkYXRlZEluVmVyIjoiNDQuNzkuMSIsInRhcmdld

- **Issue #519** (2026-09-13): **Update dependency com.github.ben-manes.versions to v0.62.0**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | com.github.ben-manes.versions | `0.61.0` → `0.62.0` | ![age](https://developer.mend.io/api/mc/badges/age/maven/com.github.ben-manes.versions:com.github.ben-manes.versions.gradle.plugin/0.62.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.github.ben-manes.versions:com.github.ben-manes.versions.gradle.plugin/0.61.0/0.62.0?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/joreilly/PeopleInSpace). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC43OS4xIiwidXBkYXRlZEluVmVyIjoiNDQuNzkuMSIsInRhcmdldEJyYW5jaCI6Im1haW4iLCJsYWJlbHM

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

### Incident Patch 1: `7c99fd88` (2026-09-20)
**Commit Message**: revert gradle to 9.6.1 to avoid IntelliJ syncing issue + README update

**File**: `README.md` (modified, +77/-0)
```diff
@@ -21,6 +21,83 @@ project's own small Ktor backend (see `backend` module below).
 
 The project is included as sample in the official [Kotlin Multiplatform docs](https://kotlinlang.org/docs/multiplatform-samples.html) and also the [Google Dev Library](https://devlibrary.withgoogle.com/products/android)
 
+### Architecture
+
+All of the clients are thin UI layers over the same `common` module: the shared view models expose
+`StateFlow`s of UI state, backed by a single repository that treats the local SQLDelight database as
+the source of truth and refreshes it from the network.
+
+```mermaid
+flowchart TB
+    subgraph clients["Clients"]
+        direction LR
+        android["<b>app</b><br/>Android · Jetpack Compose<br/>+ Glance / Remote Compose widgets"]
+        wear["<b>wearApp</b><br/>Wear OS · Compose + Tile"]
+        ios["<b>PeopleInSpaceSwiftUI</b><br/>iOS · SwiftUI (SKIE)<br/>+ SwiftExecutablePackage"]
+        desktop["<b>compose-desktop</b><br/>JVM · Compose for Desktop"]
+        web["<b>compose-web</b><br/>Kotlin/Wasm · Compose"]
+        winui["<b>windows/WinUiApp</b><br/>.NET · WinUI 3"]
+        mcp["<b>mcp-server</b><br/>JVM · Kotlin MCP SDK"]
+    end
+
+    subgraph common["common (Kotlin Multiplatform)"]
+        direction TB
+        cmpui["Compose Multiplatform UI<br/><i>PersonList / ISSPosition / ISSMapView</i><br/>(expect/actual map per platform)"]
+        vm["View models<br/><i>PersonListViewModel · ISSPositionViewModel</i><br/>StateFlow&lt;UiState&gt;"]
+        winclient["PeopleInSpaceClient<br/><i>mingwX64, exported via NuGet</i><br/>(no Koin / AndroidX)"]
+        repo["<b>PeopleInSpaceRepository</b><br/>offline-first: DB is source of truth,<br/>ISS position polled every 10s"]
+        db[("SQLDelight<br/>PeopleInSpaceDatabase")]
+        api["Ktor client APIs<br/><i>PeopleInSpaceApi · AstroviewerApi</i>"]
+        koin{{"Koin DI<br/>(annotations + compiler plugin)"}}
+
+        cmpui --> vm
+        vm --> repo
+        winclient --> repo
+        repo --> db
+        repo --> api
+        koin -.-> repo
+    end
+
+    subgraph remote["Remote"]
+        direction LR
+        backend["<b>backend</b><br/>Ktor / Netty on App Engine<br/><i>/astros.json</i>"]
+        spacedevs["The Space Devs API<br/><i>names, bios, images</i>"]
+        wheretheiss["wheretheiss.at<br/><i>current ISS position</i>"]
+        astroviewer["astroviewer.net<br/><i>predicted ISS orbit</i>"]
+    end
+
+    android --> cmpui
+    wear --> repo
+    ios --> cmpui
+    desktop --> cmpui
+    web --> cmpui
+    winui --> winclient
+    mcp --> repo
+
+    api --> backend
+    api --> wheretheiss
+    api --> astroviewer
+    backend --> spacedevs
+
+    classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d1b2a
+    classDef shared fill:#ede7f6,stroke:#5e35b1,color:#0d1b2a
+    classDef data fill:#e8f5e9,stroke:#2e7d32,color:#0d1b2a
+    classDef service fill:#fff3e0,stroke:#ef6c00,color:#0d1b2a
+    class android,wear,ios,desktop,web,winui,mcp client
+    class cmpui,vm,winclient,koin shared
+    class repo,db,api data
+    class backend,spacedevs,wheretheiss,astroviewer service
+```
+
+Notes on a few of the edges above:
+
+* The Wear OS client and the MCP server talk to the repository directly (Wear has its own
+  Wear-specific view models, the MCP server just reads the people list).
+* The Windows client goes through `PeopleInSpaceClient`, a self-contained `mingwX64` entry point that
+  owns its own Ktor engine, SQLite driver and coroutine scope rather than using Koin.
+* Only the people list goes through this project's own Ktor backend; the ISS position and predicted
+  orbit are fetched from their services directly by the shared Ktor client code.
+
 ### Module overview
 
 | Module | Description |
```

**File**: `gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-9.7.1-bin.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-9.6.1-bin.zip
 networkTimeout=10000
 retries=0
 retryBackOffMs=500
```

**File**: `renovate.json` (modified, +7/-0)
```diff
@@ -4,6 +4,13 @@
     "config:base"
   ],
   "packageRules": [
+    {
+      "description": "Pinned to Gradle 9.6.1 — the 9.7.x bump was reverted deliberately. Re-enable when we choose to move forward again.",
+      "matchManagers": [
+        "gradle-wrapper"
+      ],
+      "enabled": false
+    },
     {
       "description": "AGP 9.3.x+ outruns what the locally installed Android Studio supports — sync fails with unsupported-AGP-version and \"could not find compile target\" errors. Hold AGP updates until Studio's bundled support catches up.",
       "matchPackageNames": [
```

---

### Incident Patch 2: `64434e61` (2026-08-09)
**Commit Message**: Fix sql-wasm.wasm 404 on GitHub Pages by patching absolute locateFile path

@cashapp/sqldelight-sqljs-worker bundles sql.js with a hardcoded
locateFile: file => "/sql-wasm.wasm", which resolves against the site
root instead of the /PeopleInSpace/ project-page subpath and 404s.
GitHub then serves its 404 HTML page in place of the wasm binary,
which the loader can't parse ("expected magic word... found <!DO"),
leaving the app stuck on "Loading astronauts...". Patch the built
chunk to use a relative path so it resolves correctly regardless of
the deployment subpath. Verified locally by serving the patched dist
output under a /PeopleInSpace/ subpath.

**File**: `.github/workflows/build-and-publish-web.yml` (modified, +6/-0)
```diff
@@ -28,6 +28,12 @@ jobs:
       - name: Build web app
         run: ./gradlew :compose-web:wasmJsBrowserDistribution
 
+      - name: Fix absolute sql-wasm.wasm path for project-page subpath
+        # @cashapp/sqldelight-sqljs-worker bundles sql.js with a hardcoded
+        # locateFile: file => "/sql-wasm.wasm", which 404s once the site is
+        # served from a subpath like /PeopleInSpace/ instead of the domain root.
+        run: sed -i 's#"/sql-wasm.wasm"#"sql-wasm.wasm"#g' compose-web/build/dist/wasmJs/productionExecutable/*.js
+
       - name: Deploy to GitHub Pages
         uses: JamesIves/github-pages-deploy-action@v4.9.0
         with:
```

---

### Incident Patch 3: `7374eaae` (2026-07-18)
**Commit Message**: Fix wear app images by adding Coil network fetcher

Coil 3 moved HTTP loading to a separate artifact; without it no
network images load at all. Add coil3-network-ktor and register
KtorNetworkFetcherFactory in the wear ImageLoader, with the same
"PeopleInSpace" User-Agent as the phone app so Wikimedia-hosted
images work.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

**File**: `wearApp/build.gradle.kts` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ dependencies {
     implementation(libs.androidx.tiles.tooling.preview)
     implementation(libs.androidx.tiles)
     implementation(libs.coil3.compose)
+    implementation(libs.coil3.network.ktor)
 
     implementation(libs.koin.core)
     implementation(libs.koin.android)
```

**File**: `wearApp/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/di/AppModule.kt` (modified, +14/-0)
```diff
@@ -1,13 +1,18 @@
 package dev.johnoreilly.peopleinspace.peopleinspace.di
 
 import coil3.ImageLoader
+import coil3.network.ktor3.KtorNetworkFetcherFactory
 import coil3.request.crossfade
 import coil3.util.DebugLogger
 import coil3.util.Logger
 import dev.johnoreilly.peopleinspace.peopleinspace.list.PersonListViewModel
 import dev.johnoreilly.peopleinspace.peopleinspace.map.MapViewModel
 import dev.johnoreilly.peopleinspace.peopleinspace.person.PersonDetailsViewModel
 import dev.johnoreilly.peopleinspace.BuildConfig
+import io.ktor.client.HttpClient
+import io.ktor.client.plugins.defaultRequest
+import io.ktor.client.request.header
+import io.ktor.http.HttpHeaders
 import org.koin.android.ext.koin.androidContext
 import org.koin.core.module.dsl.viewModel
 import org.koin.dsl.module
@@ -26,6 +31,15 @@ val wearAppModule = module {
 val wearImageLoader = module {
     single {
         ImageLoader.Builder(androidContext())
+            .components {
+                add(KtorNetworkFetcherFactory(HttpClient {
+                    defaultRequest {
+                        // some image hosts (e.g. Wikimedia) reject requests with a
+                        // generic library User-Agent
+                        header(HttpHeaders.UserAgent, "PeopleInSpace")
+                    }
+                }))
+            }
             .crossfade(true)
             .apply {
                 if (BuildConfig.DEBUG) {
```

---

### Incident Patch 4: `592c067d` (2026-07-18)
**Commit Message**: Migrate to Koin compiler plugin and fix first-run loading state

- Replace KSP-based Koin annotations processing with the Koin compiler
  plugin (io.insert-koin.compiler.plugin 1.0.2): drop the KSP plugin,
  koin-ksp-compiler dependencies, generated source dir wiring and
  KOIN_CONFIG_CHECK; use typed startKoin<KoinApp>() API and updated
  org.koin.core.annotation.KoinViewModel import
- Align koin-annotations with the main Koin version (4.2.2)
- Keep PersonListUiState.Loading until the initial people fetch has
  completed so a fresh install shows the loading indicator instead of
  briefly flashing "No astronauts found" while the first sync runs
- Align kotlin-test force and androidx.concurrent constraints with
  Kotlin 2.4.0 / androidx.test.ext:truth 1.7.0
- Dependency updates (Compose Multiplatform 1.11.1, AGP 9.1.1,
  Ktor 3.5.1, coil 3.5.0, okhttp 5.4.0, skie 0.10.13, etc.)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # PeopleInSpace
 
-![kotlin-version](https://img.shields.io/badge/kotlin-2.3.21-blue?logo=kotlin)
+![kotlin-version](https://img.shields.io/badge/kotlin-2.4.0-blue?logo=kotlin)
 
 
 **Kotlin Multiplatform** project with SwiftUI, Jetpack Compose, Compose for Wear OS, Compose for Desktop and Compose for Web clients along with Ktor backend. Currently running on
```

**File**: `app/build.gradle.kts` (modified, +8/-1)
```diff
@@ -10,8 +10,8 @@ kotlin {
 }
 
 android {
-    compileSdk = libs.versions.compileSdk.get().toInt()
 
+    compileSdk = 37
     defaultConfig {
         applicationId = "dev.johnoreilly.peopleinspace"
         minSdk = libs.versions.minSdk.get().toInt()
@@ -104,6 +104,13 @@ dependencies {
     androidTestImplementation(libs.androidx.truth)
     debugImplementation(libs.androidx.compose.ui.test.manifest)
 
+    constraints {
+        // androidx.test.ext:truth 1.7.0 needs 1.2.0; align main variant so the
+        // androidTest classpath (pinned to main variant versions) can resolve
+        implementation("androidx.concurrent:concurrent-futures:1.2.0")
+        implementation("androidx.concurrent:concurrent-futures-ktx:1.2.0")
+    }
+
 
     implementation(projects.common)
 }
```

**File**: `app/src/androidTest/java/dev/johnoreilly/peopleinspace/peopleinspace/PeopleInSpaceRepositoryFake.kt` (modified, +4/-0)
```diff
@@ -5,9 +5,13 @@ import dev.johnoreilly.common.remote.IssPosition
 import dev.johnoreilly.common.remote.OrbitPoint
 import dev.johnoreilly.common.repository.PeopleInSpaceRepositoryInterface
 import kotlinx.coroutines.flow.Flow
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.flow.flowOf
 
 class PeopleInSpaceRepositoryFake: PeopleInSpaceRepositoryInterface {
+    override val initialSyncCompleted: StateFlow<Boolean> = MutableStateFlow(true)
+
     val peopleList = listOf(Assignment("Apollo 11", "Neil Armstrong"),
         Assignment("Apollo 11", "Buzz Aldrin"))
 
```

**File**: `build.gradle.kts` (modified, +3/-4)
```diff
@@ -1,6 +1,5 @@
 plugins {
     alias(libs.plugins.android.application) apply false
-    alias(libs.plugins.ksp) apply false
     alias(libs.plugins.android.kotlin.multiplatform.library) apply false
     alias(libs.plugins.kotlinMultiplatform) apply false
     alias(libs.plugins.kotlinx.serialization) apply false
@@ -14,9 +13,9 @@ plugins {
 allprojects {
     configurations.all {
         resolutionStrategy {
-            force("org.jetbrains.kotlin:kotlin-test:2.3.21")
-            force("org.jetbrains.kotlin:kotlin-test-common:2.3.21")
-            force("org.jetbrains.kotlin:kotlin-test-annotations-common:2.3.21")
+            force("org.jetbrains.kotlin:kotlin-test:2.4.0")
+            force("org.jetbrains.kotlin:kotlin-test-common:2.4.0")
+            force("org.jetbrains.kotlin:kotlin-test-annotations-common:2.4.0")
         }
     }
 }
```

**File**: `common/build.gradle.kts` (modified, +1/-28)
```diff
@@ -1,15 +1,13 @@
 @file:OptIn(ExperimentalWasmDsl::class)
 
 import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
-import com.google.devtools.ksp.gradle.KspAATask
-import org.jetbrains.kotlin.gradle.tasks.KotlinCompilationTask
 
 plugins {
     alias(libs.plugins.kotlinMultiplatform)
     alias(libs.plugins.android.kotlin.multiplatform.library)
     alias(libs.plugins.kotlinx.serialization)
     alias(libs.plugins.sqlDelight)
-    alias(libs.plugins.ksp)
+    alias(libs.plugins.koin.compiler)
     alias(libs.plugins.jetbrainsCompose)
     alias(libs.plugins.compose.compiler)
     alias(libs.plugins.skie)
@@ -108,12 +106,6 @@ kotlin {
             implementation(devNpm("copy-webpack-plugin", libs.versions.webPackPlugin.get()))
         }
     }
-
-    // KSP Common sourceSet
-    sourceSets.named("commonMain").configure {
-        kotlin.srcDir("build/generated/ksp/metadata/commonMain/kotlin")
-    }
-
 }
 
 sqldelight {
@@ -143,22 +135,3 @@ skie {
         enableSwiftUIObservingPreview = true
     }
 }
-
-// KSP Tasks
-dependencies {
-    add("kspCommonMainMetadata", libs.koin.ksp.compiler)
-    add("kspAndroid", libs.koin.ksp.compiler)
-    add("kspIosArm64", libs.koin.ksp.compiler)
-    add("kspIosSimulatorArm64", libs.koin.ksp.compiler)
-    add("kspJvm", libs.koin.ksp.compiler)
-    add("kspWasmJs", libs.koin.ksp.compiler)
-}
-
-// KSP Metadata Trigger
-tasks.matching { it.name.startsWith("ksp") && it.name != "kspCommonMainKotlinMetadata" }.configureEach {
-    dependsOn("kspCommonMainKotlinMetadata")
-}
-
-ksp {
-    arg("KOIN_CONFIG_CHECK","true")
-}
\ No newline at end of file
```

---

### Incident Patch 5: `efc98247` (2026-01-04)
**Commit Message**: Fix launch

**File**: `app/src/debug/AndroidManifest.xml` (modified, +0/-4)
```diff
@@ -6,10 +6,6 @@
                 android:name=".peopleinspace.remotecompose.RemoteComposeTestActivity"
                 android:exported="true"
                 android:label="@string/app_name">
-            <intent-filter>
-                <action android:name="android.intent.action.MAIN" />
-                <category android:name="android.intent.category.LAUNCHER" />
-            </intent-filter>
         </activity>
     </application>
 
```

**File**: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/glance/Fetch.kt` (modified, +21/-17)
```diff
@@ -53,25 +53,29 @@ suspend fun fetchMapBitmap(
     )
 
     val mapTileProvider = MapTileProviderBasic(context, source, null)
-    val bitmap = withContext(Dispatchers.Main) {
-        suspendCoroutine { cont ->
-            val mapSnapshot = MapSnapshot(
-                {
-                    if (it.status == MapSnapshot.Status.CANVAS_OK) {
-                        val bitmap = Bitmap.createBitmap(it.bitmap)
-                        cont.resume(bitmap)
-                    }
-                },
-                MapSnapshot.INCLUDE_FLAG_UPTODATE or MapSnapshot.INCLUDE_FLAG_SCALED,
-                mapTileProvider,
-                if (includeStationMarker) listOf(stationMarker) else listOf(),
-                projection
-            )
+    try {
+        val bitmap = withContext(Dispatchers.Main) {
+            suspendCoroutine { cont ->
+                val mapSnapshot = MapSnapshot(
+                    {
+                        if (it.status == MapSnapshot.Status.CANVAS_OK) {
+                            val bitmap = Bitmap.createBitmap(it.bitmap)
+                            cont.resume(bitmap)
+                        }
+                    },
+                    MapSnapshot.INCLUDE_FLAG_UPTODATE or MapSnapshot.INCLUDE_FLAG_SCALED,
+                    mapTileProvider,
+                    if (includeStationMarker) listOf(stationMarker) else listOf(),
+                    projection
+                )
 
-            launch(Dispatchers.IO) {
-                mapSnapshot.run()
+                launch(Dispatchers.IO) {
+                    mapSnapshot.run()
+                }
             }
         }
+        return bitmap.asImageBitmap()
+    } finally {
+        mapTileProvider.detach()
     }
-    return bitmap.asImageBitmap()
 }
\ No newline at end of file
```

**File**: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/remotecompose/util/GeoUtils.kt` (modified, +35/-31)
```diff
@@ -125,32 +125,33 @@ suspend fun fetchMapBitmapInRange(
 
     val mapTileProvider = MapTileProviderBasic(context, TileSourceFactory.DEFAULT_TILE_SOURCE, null)
 
-    // Split the list of points into segments where they cross the dateline.
-    // This allows osmdroid's Polyline to draw separate lines instead of a single line wrapping
-    // across the globe.
-    val segments = mutableListOf<MutableList<GeoPoint>>()
-    if (geoPoints.isNotEmpty()) {
-        segments.add(mutableListOf(geoPoints.first()))
-        for (i in 1 until geoPoints.size) {
-            val prev = geoPoints[i - 1]
-            val curr = geoPoints[i]
-            // If the longitude jump is > 180, it's a dateline crossing.
-            if (kotlin.math.abs(curr.longitude - prev.longitude) > 180.0) {
-                segments.add(mutableListOf())
+    try {
+        // Split the list of points into segments where they cross the dateline.
+        // This allows osmdroid's Polyline to draw separate lines instead of a single line wrapping
+        // across the globe.
+        val segments = mutableListOf<MutableList<GeoPoint>>()
+        if (geoPoints.isNotEmpty()) {
+            segments.add(mutableListOf(geoPoints.first()))
+            for (i in 1 until geoPoints.size) {
+                val prev = geoPoints[i - 1]
+                val curr = geoPoints[i]
+                // If the longitude jump is > 180, it's a dateline crossing.
+                if (kotlin.math.abs(curr.longitude - prev.longitude) > 180.0) {
+                    segments.add(mutableListOf())
+                }
+                segments.last().add(curr)
             }
-            segments.last().add(curr)
         }
-    }
 
-    val pathSegments =
+        val pathSegments =
             points.map { op ->
                 val gp = op.toGeoPoint()
                 val point = Point()
                 projection.toPixels(gp, point)
                 Pair(op.t, Offset(point.x.toFloat(), point.y.toFloat()))
             }
 
-    val overlays =
+        val overlays =
             segments.map { segment ->
                 Polyline().apply {
                     setPoints(segment)
@@ -159,29 +160,32 @@ suspend fun fetchMapBitmapInRange(
                 }
             }
 
-    val bitmap: Bitmap =
+        val bitmap: Bitmap =
             withContext(Dispatchers.Main) {
                 suspendCoroutine { cont ->
                     val mapSnapshot =
-                            MapSnapshot(
-                                    { snapshot ->
-                                        if (snapshot.status == Status.CANVAS_OK) {
-                                            val b: Bitmap = snapshot.bitmap
-                                            cont.resume(Bitmap.createBitmap(b))
-                                        }
-                                    },
-                                    MapSnapshot.INCLUDE_FLAG_UPTODATE or
-                                            MapSnapshot.INCLUDE_FLAG_SCALED,
-                                    mapTileProvider,
-                                    overlays,
-                                    projection
-                            )
+                        MapSnapshot(
+                            { snapshot ->
+                                if (snapshot.status == Status.CANVAS_OK) {
+                                    val b: Bitmap = snapshot.bitmap
+                                    cont.resume(Bitmap.createBitmap(b))
+                                }
+                            },
+                            MapSnapshot.INCLUDE_FLAG_UPTODATE or
+                                    MapSnapshot.INCLUDE_FLAG_SCALED,
+                            mapTileProvider,
+                            overlays,
+                            projection
+                        )
 
                     // Start the snapshot generation on a background thread.
                     launch(Dispatchers.IO) { mapSnapshot.run() }
          
```

---

### Incident Patch 6: `00a05b9d` (2026-01-03)
**Commit Message**: Fix

**File**: `common/src/commonTest/kotlin/com/surrus/peopleinspace/PeopleInSpaceRepositoryFake.kt` (modified, +8/-0)
```diff
@@ -2,9 +2,12 @@ package dev.johnoreilly.peopleinspace
 
 import dev.johnoreilly.common.remote.Assignment
 import dev.johnoreilly.common.remote.IssPosition
+import dev.johnoreilly.common.remote.OrbitPoint
 import dev.johnoreilly.common.repository.PeopleInSpaceRepositoryInterface
 import kotlinx.coroutines.flow.Flow
 import kotlinx.coroutines.flow.flowOf
+import kotlin.time.Clock
+import kotlin.time.ExperimentalTime
 
 class PeopleInSpaceRepositoryFake: PeopleInSpaceRepositoryInterface {
     val peopleList = listOf(
@@ -23,6 +26,11 @@ class PeopleInSpaceRepositoryFake: PeopleInSpaceRepositoryInterface {
         return flowOf(issPosition)
     }
 
+    @OptIn(ExperimentalTime::class)
+    override suspend fun fetchISSFuturePosition(): List<OrbitPoint> {
+        return listOf(OrbitPoint(Clock.System.now().epochSeconds, issPosition.latitude, issPosition.longitude))
+    }
+
     override suspend fun fetchAndStorePeople() {
         // No-op for fake
     }
```

---

### Incident Patch 7: `06abf5bd` (2025-10-26)
**Commit Message**: Fix previews

**File**: `gradle/libs.versions.toml` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ targetWearSdk = "33"
 [libraries]
 androidx-protolayout-material3 = { module = "androidx.wear.protolayout:protolayout-material3", version.ref = "protolayout" }
 androidx-tiles = { module = "androidx.wear.tiles:tiles", version.ref = "tiles" }
+androidx-tiles-tooling = { module = "androidx.wear.tiles:tiles-tooling", version.ref = "tiles" }
 androidx-tiles-tooling-preview = { module = "androidx.wear.tiles:tiles-tooling-preview", version.ref = "tiles" }
 androidx-ui-tooling = { module = "androidx.compose.ui:ui-tooling", version.ref = "uiToolingPreview" }
 androidx-ui-tooling-preview = { module = "androidx.compose.ui:ui-tooling-preview", version.ref = "uiToolingPreview" }
```

**File**: `wearApp/build.gradle.kts` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ dependencies {
     implementation(libs.androidx.ui.tooling)
     implementation(libs.wear.ui.tooling)
     debugImplementation(libs.androidx.ui.tooling.preview)
-    debugImplementation("androidx.wear.tiles:tiles-tooling:1.5.0")
+    implementation(libs.androidx.tiles.tooling)
 
     implementation(libs.okhttp)
     implementation(libs.loggingInterceptor)
```

**File**: `wearApp/src/main/java/com/surrus/peopleinspace/tile/PeopleInSpaceList.kt` (modified, +48/-4)
```diff
@@ -101,7 +101,12 @@ fun peopleList(
             },
             bottomSlot = {
                 val clickable = with(protoLayoutScope) {
-                    clickable(id = "home", pendingIntent = homeIntent(context))
+                    val pendingIntent = homeIntent(context)
+                    if (pendingIntent != null) {
+                        clickable(id = "home", pendingIntent = pendingIntent)
+                    } else {
+                        clickable(id = "home")
+                    }
                 }
                 textEdgeButton(
                     onClick = clickable,
@@ -119,7 +124,12 @@ fun MaterialScope.peopleButton(
     context: Context
 ): LayoutElementBuilders.LayoutElement {
     val clickable = with(protoLayoutScope) {
-        clickable(id = person.name, pendingIntent = personIntent(person, context))
+        val pendingIntent = personIntent(person, context)
+        if (pendingIntent != null) {
+            clickable(id = person.name, pendingIntent = pendingIntent)
+        } else {
+            clickable(id = person.name)
+        }
     }
     return textButton(
         onClick = clickable,
@@ -160,7 +170,7 @@ internal fun namesPreview(context: Context): TilePreviewData {
     }
 }
 
-private fun personIntent(person: Assignment, context: Context): PendingIntent {
+private fun personIntent(person: Assignment, context: Context): PendingIntent? {
     val sessionDetailIntent = Intent(
         Intent.ACTION_VIEW,
         (DEEPLINK_URI + "personList/{${person.name}}").toUri()
@@ -174,7 +184,7 @@ private fun personIntent(person: Assignment, context: Context): PendingIntent {
     )
 }
 
-private fun homeIntent(context: Context): PendingIntent {
+private fun homeIntent(context: Context): PendingIntent? {
     val sessionDetailIntent = Intent(
         Intent.ACTION_VIEW,
         ("${DEEPLINK_URI}personList").toUri()
@@ -186,4 +196,38 @@ private fun homeIntent(context: Context): PendingIntent {
         sessionDetailIntent,
         FLAG_IMMUTABLE or FLAG_UPDATE_CURRENT
     )
+}
+
+@MultiRoundDevicesWithFontScalePreviews
+internal fun twoRowsPreview(context: Context): TilePreviewData {
+    val contacts = Data(
+        people = listOf(
+            Assignment(
+                "Apollo 11",
+                "Neil Armstrong",
+                "https://www.biography.com/.image/ar_1:1%2Cc_fill%2Ccs_srgb%2Cfl_progressive%2Cq_auto:good%2Cw_1200/MTc5OTk0MjgyMzk5MTE0MzYy/gettyimages-150832381.jpg"
+            ),
+            Assignment(
+                "Apollo 11",
+                "Buzz Aldrin",
+                "https://nypost.com/wp-content/uploads/sites/2/2018/06/buzz-aldrin.jpg?quality=80&strip=all"
+            ),
+            Assignment(
+                "Vostok 1",
+                "Yuri Gagarin",
+                "https://nypost.com/wp-content/uploads/sites/2/2018/06/buzz-aldrin.jpg?quality=80&strip=all"
+            ),
+            Assignment(
+                "Sputnik 2",
+                "Laika",
+                "https://nypost.com/wp-content/uploads/sites/2/2018/06/buzz-aldrin.jpg?quality=80&strip=all"
+            )
+        ), mapOf()
+    )
+    return TilePreviewData {
+        TilePreviewHelper.singleTimelineEntryTileBuilder(
+            peopleList(context, it.deviceConfiguration, contacts, it.scope)
+        )
+            .build()
+    }
 }
\ No newline at end of file
```

---

### Incident Patch 8: `abb87850` (2025-10-25)
**Commit Message**: Fix ViewModel constructor errors in ViewModelUiTests

Rewrote ViewModelUiTests to use StateFlow-based testing instead of
attempting to instantiate ViewModels directly. The ViewModels in this
project use Koin dependency injection and don't accept constructor
parameters, which was causing "Too many arguments for constructor" errors.

Changes:

ViewModelUiTests.kt:
- Removed attempts to instantiate ViewModels with repository parameters
- Changed to StateFlow-based testing pattern using MutableStateFlow
- Added new tests demonstrating state transitions (Loading → Success → Error)
- Added test for ISS position state updates
- Added tests for all PersonListUiState variants (Loading, Success, Error)
- Added test demonstrating state transition from Loading to Success
- Updated documentation in comments to explain the testing approach
- All test composables now accept StateFlow parameters instead of ViewModels

New test coverage:
- testISSPositionDisplay_withStateFlow
- testISSPositionUpdate_whenStateChanges
- testPersonListSuccess_displaysData
- testPersonListLoading_displaysLoadingIndicator
- testPersonListError_displaysError
- testPersonListDisplaysCorrectCount
- testPersonListStateTrans

**File**: `common/src/commonTest/kotlin/README.md` (modified, +50/-16)
```diff
@@ -22,11 +22,12 @@ Tests for ISS position display components:
 - Demonstrating data-driven testing patterns
 
 ### 3. `ViewModelUiTests.kt`
-Advanced tests showing ViewModel integration:
-- Testing UI components connected to ViewModels
+Advanced tests showing state-based UI testing:
+- Testing UI components with StateFlow (the pattern used by ViewModels)
 - Managing coroutine test dispatchers
-- Testing state flow updates
-- Verifying UI reflects ViewModel state changes
+- Testing state transitions (Loading → Success → Error)
+- Verifying UI reacts to state changes
+- Note: Uses StateFlow directly instead of actual ViewModels (which use Koin DI)
 
 ### 4. `TestTagExampleTests.kt`
 Best practices for using test tags:
@@ -230,9 +231,9 @@ fun testButtonClick() = runComposeUiTest {
 }
 ```
 
-## Testing ViewModels
+## Testing State-Based UI Components
 
-When testing components with ViewModels:
+The ViewModels in this project use Koin dependency injection and don't accept constructor parameters. Therefore, UI tests focus on testing components with StateFlow directly:
 
 1. **Setup test dispatcher**:
 ```kotlin
@@ -249,17 +250,32 @@ fun tearDown() {
 }
 ```
 
-2. **Advance time for coroutines**:
+2. **Create mock state flows**:
 ```kotlin
-testDispatcher.scheduler.advanceUntilIdle()
+val uiStateFlow = MutableStateFlow(PersonListUiState.Success(fakeData))
+```
+
+3. **Test state transitions**:
+```kotlin
+// Start with loading
+val stateFlow = MutableStateFlow(UiState.Loading)
+setContent { MyComposable(stateFlow) }
+onNodeWithText("Loading...").assertIsDisplayed()
+
+// Transition to success
+stateFlow.value = UiState.Success(data)
 waitForIdle()
+onNodeWithText("Data").assertIsDisplayed()
 ```
 
-3. **Use fake repositories**:
+4. **Advance time for coroutines**:
 ```kotlin
-val viewModel = MyViewModel(fakeRepository)
+testDispatcher.scheduler.advanceUntilIdle()
+waitForIdle()
 ```
 
+This approach tests the UI layer independently of ViewModel implementation details.
+
 ## Platform-Specific Considerations
 
 ### Android
@@ -311,10 +327,10 @@ class CoordinateDisplayTests {
 }
 ```
 
-### Testing with ViewModel
+### Testing with StateFlow (ViewModel Pattern)
 ```kotlin
 @OptIn(ExperimentalTestApi::class)
-class ViewModelIntegrationTests {
+class StateBasedUiTests {
     private val testDispatcher = StandardTestDispatcher()
 
     @BeforeTest
@@ -323,21 +339,39 @@ class ViewModelIntegrationTests {
     }
 
     @Test
-    fun testWithViewModel() = runComposeUiTest {
-        val viewModel = ISSPositionViewModel(fakeRepository)
+    fun testWithStateFlow() = runComposeUiTest {
+        // Create mock state flow
+        val positionFlow = MutableStateFlow(IssPosition(53.27, -9.05))
 
         setContent {
-            ISSPositionContent(viewModel)
+            // Composable that accepts StateFlow
+            ISSPositionContent(positionFlow)
         }
 
         testDispatcher.scheduler.advanceUntilIdle()
         waitForIdle()
 
-        onNodeWithText("53.2743394").assertIsDisplayed()
+        onNodeWithText("53.27").assertIsDisplayed()
+    }
+
+    @Test
+    fun testStateTransition() = runComposeUiTest {
+        val stateFlow = MutableStateFlow(UiState.Loading)
+        setContent { MyComposable(stateFlow) }
+
+        onNodeWithText("Loading...").assertExists()
+
+        stateFlow.value = UiState.Success(data)
+        waitForIdle()
+
+        onNodeWithText("Success").assertExists()
     }
 }
 ```
 
+**Why StateFlow instead of actual ViewModels?**
+The ViewModels in this project use Koin for dependency injection and don't accept constructor parameters. Testing with StateFlow allows us to test the UI layer independently without setting up complex Koin test modules.
+
 ## Resources
 
 - [Compose Multiplatform Testing Docs](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-test.html)
```

**File**: `common/src/commonTest/kotlin/com/surrus/peopleinspace/viewmodel/ViewModelUiTests.kt` (modified, +138/-36)
```diff
@@ -4,13 +4,13 @@ import androidx.compose.foundation.layout.Column
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
-import androidx.compose.runtime.collectAsState
-import androidx.compose.runtime.getValue
 import androidx.compose.ui.test.*
-import dev.johnoreilly.common.viewmodel.ISSPositionViewModel
-import dev.johnoreilly.common.viewmodel.PersonListViewModel
+import dev.johnoreilly.common.remote.IssPosition
+import dev.johnoreilly.common.viewmodel.PersonListUiState
 import dev.johnoreilly.peopleinspace.PeopleInSpaceRepositoryFake
 import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.test.StandardTestDispatcher
 import kotlinx.coroutines.test.resetMain
 import kotlinx.coroutines.test.setMain
@@ -19,10 +19,14 @@ import kotlin.test.BeforeTest
 import kotlin.test.Test
 
 /**
- * UI Tests demonstrating integration with ViewModels
+ * UI Tests demonstrating state-based testing patterns
  *
- * These tests show how to test Compose UI components that interact with ViewModels,
- * using a fake repository to provide test data.
+ * These tests show how to test Compose UI components that use StateFlow
+ * for state management, which is the pattern used by ViewModels in this project.
+ *
+ * Note: The actual ViewModels use Koin dependency injection and don't accept
+ * constructor parameters, so these tests demonstrate testing the UI layer
+ * with mock state flows instead of actual ViewModel instances.
  */
 @OptIn(ExperimentalTestApi::class)
 class ViewModelUiTests {
@@ -41,14 +45,14 @@ class ViewModelUiTests {
     }
 
     @Test
-    fun testISSPositionDisplay_withViewModel() = runComposeUiTest {
-        // Given
-        val viewModel = ISSPositionViewModel(repository)
+    fun testISSPositionDisplay_withStateFlow() = runComposeUiTest {
+        // Given - Create a state flow with ISS position data
+        val positionFlow = MutableStateFlow(repository.issPosition)
 
         // When
         setContent {
             MaterialTheme {
-                ISSPositionTestContent(viewModel)
+                ISSPositionTestContent(positionFlow)
             }
         }
 
@@ -58,59 +62,156 @@ class ViewModelUiTests {
 
         // Then - Verify position data is displayed
         val position = repository.issPosition
+        onNodeWithText("ISS Position").assertIsDisplayed()
         onNodeWithText(position.latitude.toString()).assertIsDisplayed()
         onNodeWithText(position.longitude.toString()).assertIsDisplayed()
     }
 
     @Test
-    fun testPersonListData_fromViewModel() = runComposeUiTest {
-        // Given
-        val viewModel = PersonListViewModel(repository)
+    fun testISSPositionUpdate_whenStateChanges() = runComposeUiTest {
+        // Given - Create a mutable state flow
+        val positionFlow = MutableStateFlow(IssPosition(0.0, 0.0))
+
+        // When - Set initial content
+        setContent {
+            MaterialTheme {
+                ISSPositionTestContent(positionFlow)
+            }
+        }
+
+        waitForIdle()
+
+        // Then - Verify initial position
+        onNodeWithText("0.0").assertIsDisplayed()
+
+        // When - Update position
+        positionFlow.value = repository.issPosition
+
+        testDispatcher.scheduler.advanceUntilIdle()
+        waitForIdle()
+
+        // Then - Verify updated position is displayed
+        onNodeWithText(repository.issPosition.latitude.toString()).assertIsDisplayed()
+    }
+
+    @Test
+    fun testPersonListSuccess_displaysData() = runComposeUiTest {
+        // Given - Create state flow with success state
+        val uiStateFlow = MutableStateFlow<PersonListUiState>(
+            PersonListUiState.Success(repository.peopleList)
+        )
 
         // When
         setContent {
             MaterialTheme {
-                PersonListTestContent(viewModel)
+  
```

---

### Incident Patch 9: `71134763` (2025-10-25)
**Commit Message**: Fix experimental API warnings in Compose UI tests

Add @OptIn(ExperimentalTestApi::class) annotation to all test classes
to suppress "This testing API is experimental and is likely to be changed
or removed entirely" warnings.

Changes:
- Add @OptIn(ExperimentalTestApi::class) to ComposeMultiplatformUiTests
- Add @OptIn(ExperimentalTestApi::class) to ISSPositionUiTests
- Add @OptIn(ExperimentalTestApi::class) to TestTagExampleTests
- Add @OptIn(ExperimentalTestApi::class) to ViewModelUiTests
- Update README.md with documentation about the opt-in requirement
- Update all code examples in README to include the annotation
- Add note explaining why the annotation is needed

The annotation is required because the Compose Multiplatform UI testing
framework (runComposeUiTest) is currently experimental. This is standard
practice when using experimental APIs and does not affect test functionality.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

**File**: `common/src/commonTest/kotlin/README.md` (modified, +58/-34)
```diff
@@ -56,6 +56,7 @@ class MyTest {
 
 ### Multiplatform Tests (common module)
 ```kotlin
+@OptIn(ExperimentalTestApi::class)
 class MyTest {
     @Test
     fun myTest() = runComposeUiTest {
@@ -65,6 +66,8 @@ class MyTest {
 }
 ```
 
+**Note**: The `@OptIn(ExperimentalTestApi::class)` annotation is required because the Compose Multiplatform UI testing API is currently experimental. Add this annotation to your test classes to suppress experimental API warnings.
+
 ## Running the Tests
 
 ### Run all common tests
@@ -97,27 +100,34 @@ class MyTest {
 All tests follow this pattern:
 
 ```kotlin
-@Test
-fun testName() = runComposeUiTest {
-    // 1. Setup (if needed)
-    val viewModel = MyViewModel(fakeRepository)
-
-    // 2. Set content
-    setContent {
-        MaterialTheme {
-            MyComposable(viewModel)
+@OptIn(ExperimentalTestApi::class)
+class MyUiTests {
+    @Test
+    fun testName() = runComposeUiTest {
+        // 1. Setup (if needed)
+        val viewModel = MyViewModel(fakeRepository)
+
+        // 2. Set content
+        setContent {
+            MaterialTheme {
+                MyComposable(viewModel)
+            }
         }
-    }
 
-    // 3. Advance time (for async operations)
-    testDispatcher.scheduler.advanceUntilIdle()
-    waitForIdle()
+        // 3. Advance time (for async operations)
+        testDispatcher.scheduler.advanceUntilIdle()
+        waitForIdle()
 
-    // 4. Assert
-    onNodeWithText("Expected Text").assertIsDisplayed()
+        // 4. Assert
+        onNodeWithText("Expected Text").assertIsDisplayed()
+    }
 }
 ```
 
+### Important: Experimental API
+
+The Compose Multiplatform UI testing framework is currently experimental. You must add the `@OptIn(ExperimentalTestApi::class)` annotation to your test classes to use `runComposeUiTest` and suppress experimental API warnings.
+
 ## Common Test Assertions
 
 ### Existence
@@ -288,30 +298,43 @@ val viewModel = MyViewModel(fakeRepository)
 
 ### Testing CoordinateDisplay
 ```kotlin
-@Test
-fun testCoordinateDisplay() = runComposeUiTest {
-    setContent {
-        CoordinateDisplay(label = "Latitude", value = "53.27")
+@OptIn(ExperimentalTestApi::class)
+class CoordinateDisplayTests {
+    @Test
+    fun testCoordinateDisplay() = runComposeUiTest {
+        setContent {
+            CoordinateDisplay(label = "Latitude", value = "53.27")
+        }
+        onNodeWithText("Latitude").assertIsDisplayed()
+        onNodeWithText("53.27").assertIsDisplayed()
     }
-    onNodeWithText("Latitude").assertIsDisplayed()
-    onNodeWithText("53.27").assertIsDisplayed()
 }
 ```
 
 ### Testing with ViewModel
 ```kotlin
-@Test
-fun testWithViewModel() = runComposeUiTest {
-    val viewModel = ISSPositionViewModel(fakeRepository)
+@OptIn(ExperimentalTestApi::class)
+class ViewModelIntegrationTests {
+    private val testDispatcher = StandardTestDispatcher()
 
-    setContent {
-        ISSPositionContent(viewModel)
+    @BeforeTest
+    fun setup() {
+        Dispatchers.setMain(testDispatcher)
     }
 
-    testDispatcher.scheduler.advanceUntilIdle()
-    waitForIdle()
+    @Test
+    fun testWithViewModel() = runComposeUiTest {
+        val viewModel = ISSPositionViewModel(fakeRepository)
+
+        setContent {
+            ISSPositionContent(viewModel)
+        }
 
-    onNodeWithText("53.2743394").assertIsDisplayed()
+        testDispatcher.scheduler.advanceUntilIdle()
+        waitForIdle()
+
+        onNodeWithText("53.2743394").assertIsDisplayed()
+    }
 }
 ```
 
@@ -324,8 +347,9 @@ fun testWithViewModel() = runComposeUiTest {
 ## Contributing
 
 When adding new UI tests:
-1. Follow the existing naming conventions
-2. Add test tags to new composables
-3. Create test composables for complex scenarios
-4. Document any platform-specific limitations
-5. Keep tests fast and focused
+1. Add `@OptIn(ExperimentalTestApi::class)` to your test class
+2. Follow the existing naming conventions (e.g., `*UiTests.kt`)
+3. Add test tags to new composable
```

**File**: `common/src/commonTest/kotlin/com/surrus/peopleinspace/ui/ComposeMultiplatformUiTests.kt` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ import kotlin.test.Test
  * - Works with kotlin.test instead of JUnit
  * - Can be executed on multiple platforms
  */
+@OptIn(ExperimentalTestApi::class)
 class ComposeMultiplatformUiTests {
 
     @Test
```

**File**: `common/src/commonTest/kotlin/com/surrus/peopleinspace/ui/ISSPositionUiTests.kt` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ import kotlin.test.Test
  * These tests demonstrate testing Compose Multiplatform UI components
  * with realistic data from a fake repository.
  */
+@OptIn(ExperimentalTestApi::class)
 class ISSPositionUiTests {
 
     private val repository = PeopleInSpaceRepositoryFake()
```

**File**: `common/src/commonTest/kotlin/com/surrus/peopleinspace/ui/TestTagExampleTests.kt` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ import kotlin.test.Test
  * 3. Apply test tags to key interactive elements and containers
  * 4. Use test tags over text matching for better test stability
  */
+@OptIn(ExperimentalTestApi::class)
 class TestTagExampleTests {
 
     companion object {
```

**File**: `common/src/commonTest/kotlin/com/surrus/peopleinspace/viewmodel/ViewModelUiTests.kt` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ import kotlin.test.Test
  * These tests show how to test Compose UI components that interact with ViewModels,
  * using a fake repository to provide test data.
  */
+@OptIn(ExperimentalTestApi::class)
 class ViewModelUiTests {
 
     private val testDispatcher = StandardTestDispatcher()
```

#### Recent Merged Pull Requests:
- **PR #532** (2026-09-25): Update to Kotlin 2.4.20 and SKIE 0.10.15 (@joreilly)
- **PR #527** (closed): Update androidGradlePlugin to v9.4.1 (@renovate[bot])
- **PR #526** (2026-09-20): Update coilCompose3 to v3.6.3 (@renovate[bot])
- **PR #523** (2026-09-13): Update dependency Microsoft.WindowsAppSDK to v2 (@renovate[bot])
- **PR #522** (2026-09-13): Update actions/setup-java action to v6 (@renovate[bot])
- **PR #521** (2026-09-13): Update actions/setup-dotnet action to v6 (@renovate[bot])
- **PR #520** (2026-09-13): Update dependency io.github.xxfast.kotlin.native.nuget to v0.6.0 (@renovate[bot])
- **PR #519** (2026-09-13): Update dependency com.github.ben-manes.versions to v0.62.0 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
