> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wix-react-native-navigation-learnings.md`  
> **Source**: github ([https://github.com/wix/react-native-navigation](https://github.com/wix/react-native-navigation))  
> **Source Version**: `42b85e71`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T10:19:19.497Z  
> **Learning ID**: `learn-github-wix-react-native-navigation`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): wix/react-native-navigation

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-react-native-navigation-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/react-native-navigation](https://github.com/wix/react-native-navigation))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T10:19:19.358Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/react-native-navigation`
- **Description**: A complete native navigation solution for React Native
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13172 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/AnimationListener.kt`
```
package com.reactnativenavigation.utils

open class ScreenAnimationListener {
    open fun onStart() {}

    open fun onEnd() {}

    open fun onCancel() {}
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/BorderRadiusOutlineProvider.kt`
```
package com.reactnativenavigation.utils

import android.graphics.Outline
import android.os.Build
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.ImageView
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
class BorderRadiusOutlineProvider(private val image: ImageView, initialRadius: Float) : ViewOutlineProvider() {
    var radius: Float = initialRadius
        private set

    override fun getOutline(view: View, outline: Outline) = outline.setRoundRect(
            0,
            0,
            image.clipBounds?.width() ?: image.width,
            image.clipBounds?.height() ?: image.height,
            radius
    )

    fun updateRadius(radius: Float) {
        this.radius = radius
        image.invalidateOutline()
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/Context.kt`
```
package com.reactnativenavigation.utils

import android.content.Context
import android.content.res.Configuration
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.ReactApplication
import com.reactnativenavigation.NavigationApplication

fun Context.isDebug(): Boolean {
    return (applicationContext as ReactApplication).reactNativeHost.useDeveloperSupport
}
fun isDarkMode() = NavigationApplication.instance.isDarkMode()
fun Context.isDarkMode(): Boolean = when (AppCompatDelegate.getDefaultNightMode()) {
    AppCompatDelegate.MODE_NIGHT_YES -> true
    AppCompatDelegate.MODE_NIGHT_NO -> false
    else -> resources.configuration.isDarkMode()
}
fun Configuration.isDarkMode() =
    (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/IdFactory.kt`
```
package com.reactnativenavigation.utils


class IdFactory {
    companion object {
        private val stringIdToIntId = HashMap<String, Int>()
        private var count = 0

        fun get(id: String): Int {
            return if (stringIdToIntId.containsKey(id)) {
                stringIdToIntId[id]!!
            } else {
                (++count).apply { stringIdToIntId[id] = count }
            }
        }
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/ImageLoader.kt`
```
package com.reactnativenavigation.utils

import android.app.Activity
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.StrictMode
import androidx.core.content.ContextCompat
import com.facebook.react.views.imagehelper.ResourceDrawableIdHelper
import com.reactnativenavigation.R
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStream
import java.net.URL
import java.util.*

open class ImageLoader {
    interface ImagesLoadingListener {
        fun onComplete(drawable: List<Drawable>)
        fun onComplete(drawable: Drawable)
        fun onError(error: Throwable?)
    }

    open fun getBackButtonIcon(context: Activity): Drawable? {
        val isRTL = context.window.decorView.isRTL()
        return ContextCompat.getDrawable(context, if (isRTL) R.drawable.ic_arrow_back_black_rtl_24dp else R.drawable.ic_arrow_back_black_24dp)
    }

    open fun loadIcon(context: Context, uri: String?): Drawable? {
        if (uri == null) return null
        try {
            return getDrawable(context, uri)
        } catch (e: IOException) {
            e.printStackTrace()
        }
        return null
    }

    open fun loadIcon(context: Context, uri: String, listener: ImagesLoadingListener) {
        try {
            listener.onComplete(getDrawable(context, uri))
        } catch (e: IOException) {
            listener.onError(e)
        }
    }

    open fun loadIcons(context: Context, uris: List<String>, listener: ImagesLoadingListener) {
        try {
            val drawables: MutableList<Drawable> = ArrayList()
            for (uri in uris) {
                val drawable = getDrawable(context, uri)
                drawables.add(drawable)
            }
            listener.onComplete(drawables)
        } catch (e: IOException) {
            listener.onError(e)
        }
    }

    @Throws(IOException::class)
    private fun getDrawable(context: Context, source: String): Drawable {
        var drawable: Drawable?
        if (isLocalFile(Uri.parse(source))) {
            drawable = loadFile(context, source)
        } else {
            drawable = loadResource(context, source)
            if (drawable == null && context.isDebug()) {
                drawable = readJsDevImage(context, source)
            }
        }
        if (drawable == null) throw RuntimeException("Could not load image $source")
        return drawable.mutate()
    }

    @Throws(IOException::class)
    private fun readJsDevImage(context: Context, source: String): Drawable {
        val threadPolicy = adjustThreadPolicyDebug(context)
        val `is` = openStream(context, source)
        val bitmap = BitmapFactory.decodeStream(`is`)
        restoreThreadPolicyDebug(context, threadPolicy)
        return BitmapDrawable(context.resources, bitmap)
    }

    private fun isLocalFile(uri: Uri): Boolean {
        return FILE_SCHEME == uri.scheme
    }

    private fun loadFile(context: Context, uri: String): Drawable {
        val bitmap = BitmapFactory.decodeFile(Uri.parse(uri).path)
        return BitmapDrawable(context.resources, bitmap)
    }

    private fun adjustThreadPolicyDebug(context: Context): StrictMode.ThreadPolicy? {
        var threadPolicy: StrictMode.ThreadPolicy? = null
        if (context.isDebug()) {
            threadPolicy = StrictMode.getThreadPolicy()
            StrictMode.setThreadPolicy(StrictMode.ThreadPolicy.Builder().permitNetwork().build())
        }
        return threadPolicy
    }

    private fun restoreThreadPolicyDebug(context: Context, threadPolicy: StrictMode.ThreadPolicy?) {
        if (context.isDebug() && threadPolicy != null) {
            StrictMode.setThreadPolicy(threadPolicy)
        }
    }

    companion object {
        private const val FILE_SCHEME = "file"
        private fun loadResource(context: Context, iconSource: String): Drawable? {
            return ResourceDrawableIdHelper.getInstance().getResourceDrawable(context, iconSource)
        }

        @Throws(IOException::class)
        private fun openStream(context: Context, uri: String): InputStream? {
            return if (uri.contains("http")) remoteUrl(uri) else localFile(context, uri)
        }

        @Throws(IOException::class)
        private fun remoteUrl(uri: String): InputStream {
            return URL(uri).openStream()
        }

        @Throws(FileNotFoundException::class)
        private fun localFile(context: Context, uri: String): InputStream? {
            return context.contentResolver.openInputStream(Uri.parse(uri))
        }
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/ImageUtils.kt`
```
package com.reactnativenavigation.utils

import android.view.View
import android.view.ViewParent
import com.reactnativenavigation.react.ReactView
import com.reactnativenavigation.viewcontrollers.viewcontroller.overlay.OverlayLayout

fun areDimensionsWithInheritedScaleEqual(a: View, b: View): Boolean {
    val (aScaleX, aScaleY) = computeInheritedScale(a)
    val (bScaleX, bScaleY) = computeInheritedScale(b)
    return a.width * aScaleX == b.width * bScaleX &&
            a.height * aScaleY == b.height * bScaleY
}

fun computeInheritedScale(v: View): Scale {
    return computeInheritedScale(v.parent, Scale(x = v.scaleX, y = v.scaleY))
}

private fun computeInheritedScale(v: ViewParent, childrenScale: Scale): Scale {
    return if (v is ReactView || v is OverlayLayout || v.parent == null) {
        childrenScale
    } else {
        computeInheritedScale(v.parent, Scale(x = childrenScale.x * v.scaleX, y = childrenScale.y * v.scaleY))
    }
}

data class Scale(val x: Float, val y: Float)
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/Log.kt`
```
package com.reactnativenavigation.utils

import android.util.Log
import com.reactnativenavigation.BuildConfig

const val MAIN_LIB_TAG = "RNN";
fun logd(msg: String?, tag: String = MAIN_LIB_TAG) {
    if (BuildConfig.DEBUG) {
        if (msg != null)
            Log.d(tag, msg)
        else
            Log.d(tag, "Cannot log null msg: $msg")
    }
}

fun wran(msg: String?, tag: String = MAIN_LIB_TAG) {
    if (!BuildConfig.DEBUG) {
        if (msg != null)
            Log.w(tag, msg)
        else
            Log.w(tag, "Cannot log null msg: $msg")
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/MotionEvent.kt`
```
package com.reactnativenavigation.utils

import android.graphics.Rect
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import com.reactnativenavigation.BuildConfig

val hitRect = Rect()

fun MotionEvent.coordinatesInsideView(view: View?): Boolean {
    val viewGroup = (view as? ViewGroup)?.getChildAt(0) as? ViewGroup ?: view

    viewGroup?.getHitRect(hitRect)
    return hitRect.contains(x.toInt(), y.toInt())

}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/OutlineProvider.kt`
```
package com.reactnativenavigation.utils

import android.graphics.Outline
import android.os.Build
import android.view.View
import android.view.ViewOutlineProvider
import androidx.annotation.RequiresApi
import com.reactnativenavigation.views.element.animators.ViewOutline
import kotlin.math.roundToInt

@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
class OutlineProvider(
        private val view: View,
        private var outline: ViewOutline
) : ViewOutlineProvider() {
    val radius: Float
        get() = outline.radius

    override fun getOutline(view: View, outline: Outline) {
        outline.setRoundRect(
                0,
                0,
                this.outline.width.roundToInt(),
                this.outline.height.roundToInt(),
                this.outline.radius
        )
    }

    fun update(outline: ViewOutline) {
        this.outline = outline
        view.invalidateOutline()
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/PrimitiveExt.kt`
```
package com.reactnativenavigation.utils

import android.content.res.Resources

val Int.dp: Int
    get() = (this * Resources.getSystem().displayMetrics.density).toInt()

val Float.dp: Int
    get() = (this * Resources.getSystem().displayMetrics.density).toInt()
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8367** (2026-10-20): **fix(release): tag the source commit instead of the release commit**
  *Symptoms*: Stacked on #8366. Merge into that branch or cherry-pick; whichever is easier for you.  ## Problem `finalize` tags `manifest.releaseSha`, the commit that exists only on `ci/update-version-X`. This repo allows squash merge only, so that commit never reaches `master`. Consequences: - `git tag --merged <master>` (`index.cjs`, plan) never sees the new tag, so `previousTag` stays on `8.8.11` forever. Release notes grow with every release and the `/commits/{sha}/pulls` calls grow with them. - The legacy `scripts/release.js` tagged the source commit (`8.8.11` -> `92e3bf13`, equal to npm `gitHead`), so this was a behaviour change.  ## Change - Tag and GitHub release `target_commitish` use `manifest.sourceSha`. Publish already requires `context.sha === sourceSha`, so the tag now matches the npm provenance commit. - `releaseSha` is still used for the version branch and the version PR head. - New test fails without the change. - Docs: the stable example becomes `8.9.1` (npm `latest` is already `8.9.0`, so the docs would reject `8.8.10`); the line about approvals on the version PR now says that `GITHUB_TOKEN` events do not start Actions workflows.  ## Verification `node --test scripts/release/*.test.cjs`: 28/28. 

- **Issue #8366** (2026-10-20): **ci: move npm releases to admin-dispatched GitHub Actions**
  *Symptoms*: ## Summary - Replace the expired-token Buildkite publisher with an admin-dispatched GitHub Actions workflow using npm trusted publishing. It prepares and validates immutable tarballs on Linux, publishes through OIDC, and creates version branches, tags, GitHub releases, and version/documentation PRs. - Support dry runs, explicit stable/prerelease versions, on-demand snapshots, and recovery of the original bytes after partial failure. Validate both dispatch/rerun administrators, originating workflow/artifacts, exact-SHA Buildkite status and its creator, package integrity, and monotonic release channels. - Remove the legacy release/publish pipelines, release script, gren config/dependencies and obsolete badge. Lock optional documentation builds and document setup, recovery, infrastructure cleanup, and the adapter requirements for Detox/UI-lib.  ## Validation - Bob build and npm 11.17.0 tarball inspection passed; Android/iOS source files and exported entry points are verified without Android SDK or Xcode. - `node scripts/test-js.js` passed: 38 suites, 405 tests, 4 snapshots (11 suites/59 tests already skipped). - `node --test scripts/release/*.test.cjs` passed: 27 tests, including unauthorized reruns, forged CI statuses, workflow identity, artifact/commit integrity, lost publication responses, and multi-package partial recovery. - Actionlint 1.7.7 passed for both new workflows and the documentation workflow; documentation helper ESLint and `git diff --check` passed.  ## Not Run -

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

### Incident Patch 1: `42b85e71` (2026-10-20)
**Commit Message**: ci: move npm releases to admin-dispatched GitHub Actions (#8366)

**File**: `.buildkite/jobs/pipeline.publish.yml` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-  - wait
-  - label: ":package: Publish"
-    env:
-      JAVA_HOME: /opt/openjdk/jdk-17.0.9.jdk/Contents/Home/
-    if: "build.pull_request.id == null"
-    command:
-    - "nvm install"
-    - "./scripts/ci.sh"
-    - "yarn run release"
-    timeout_in_minutes: 60
-    retry:
-      automatic:
-      - exit_status: [1, -1]
-        limit: 2
-
-
```

**File**: `.buildkite/jobs/pipeline.release.yml` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-  - block: ":rocket: Release!"
-    prompt: "Fill out the details for release"
-    if: 'build.message =~ /^release\$/i'
-    fields:
-      - text: "VERSION"
-        key: "version"
-      - text: "NPM_TAG"
-        key: "npm-tag"
-        default: 'null'
-        required: false
-      - text: "BUILD_DOCUMENTATION_VERSION"
-        key: "build-documentation-version"
-        default: 'null'
-        hint: 'Leave NULL if no version is specified'
-      - text: "REMOVE_DOCUMENTATION_VERSION"
-        key: "remove-documentation-version"
-        default: 'null'
-        hint: 'Leave NULL if no version is specified'
-
-
```

**File**: `.buildkite/pipeline.sh` (modified, +0/-2)
```diff
@@ -2,11 +2,9 @@
 
 echo "steps:"
 
-cat .buildkite/jobs/pipeline.release.yml
 cat .buildkite/jobs/pipeline.android_rn_78.yml
 cat .buildkite/jobs/pipeline.android_rn_84.yml
 cat .buildkite/jobs/pipeline.android_rn_85.yml
 cat .buildkite/jobs/pipeline.ios_rn_78.yml
 cat .buildkite/jobs/pipeline.ios_rn_84.yml
 cat .buildkite/jobs/pipeline.ios_rn_85.yml
-cat .buildkite/jobs/pipeline.publish.yml
```

**File**: `.claude/skills/rn-version-upgrade.md` (modified, +2/-2)
```diff
@@ -63,7 +63,7 @@ Also check the full peer dependency tree: `npm info react-native@<version> peerD
 
 ## Phase 2: CI Infrastructure Setup
 
-### 2a. Create Buildkite Pipeline Jobs
+### 2a. Maintain Buildkite CI Jobs
 
 Copy an existing job file and update the version:
 
@@ -88,7 +88,7 @@ cat .buildkite/jobs/pipeline.android_rn_84.yml
 cat .buildkite/jobs/pipeline.ios_rn_84.yml
 ```
 
-Insert them in version order, before `pipeline.publish.yml`.
+Insert them in version order alongside the other platform jobs. Release publishing is dispatched separately through the GitHub Actions release workflow.
 
 ### 2c. Optionally Drop Old Versions
 
```

**File**: `.github/workflows/documentation.yml` (modified, +4/-2)
```diff
@@ -22,7 +22,8 @@ jobs:
         run: |
           cd website/
           npm i -g npq@3.14.0
-          npq install
+          npq --dry-run
+          npm ci --legacy-peer-deps
           npm run build
   gh-release:
     if: github.event_name != 'pull_request'
@@ -54,6 +55,7 @@ jobs:
           git config --global user.name "yogevbd"
           cd website/
           npm i -g npq@3.14.0
-          npq install
+          npq --dry-run
+          npm ci --legacy-peer-deps
           npm run build
           npx docusaurus deploy
```

**File**: `.github/workflows/release-checks.yml` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+name: Release checks
+
+on:
+  pull_request:
+    branches: [master]
+  push:
+    branches: [master]
+
+permissions:
+  contents: read
+
+jobs:
+  package:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 30
+    steps:
+      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8
+        with:
+          persist-credentials: false
+      - uses: actions/setup-node@65d868f8d4d85d7d4abb7de0875cde3fcc8798f5
+        with:
+          node-version: '24.19.0'
+          package-manager-cache: false
+      - name: Test release authorization and recovery
+        run: node --test scripts/release/*.test.cjs
+      - name: Install, build, and test the npm package on Linux
+        run: |
+          node .yarn/releases/yarn-4.12.0.cjs install --immutable
+          node .yarn/releases/yarn-4.12.0.cjs prepare
+          node .yarn/releases/yarn-4.12.0.cjs test-js
+      - name: Verify package contents and entry points
+        env:
+          RELEASE_DIR: ${{ runner.temp }}/rnn-package
+        run: node scripts/release/index.cjs pack-check
```

**File**: `.github/workflows/release.yml` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+name: Release
+run-name: ${{ inputs.operation }} RNN ${{ inputs.version || inputs.kind }} by @${{ github.actor }}
+
+on:
+  workflow_dispatch:
+    inputs:
+      operation:
+        description: 'Dry run, publish, or resume an interrupted publishing run'
+        type: choice
+        options: [dry-run, publish, resume]
+        default: dry-run
+      kind:
+        description: 'Release or on-demand snapshot (ignored for resume)'
+        type: choice
+        options: [release, snapshot]
+        default: release
+      version:
+        description: 'Exact semver for release; leave empty for snapshots and resume'
+        type: string
+      npm_tag:
+        description: 'latest for stable, next for prerelease, snapshot for snapshots'
+        type: choice
+        options: [latest, next, snapshot]
+        default: latest
+      documentation_version:
+        description: 'Optional documentation version to create (x.y.z)'
+        type: string
+      remove_documentation_version:
+        description: 'Optional existing documentation version to replace/remove'
+        type: string
+      source_run_id:
+        description: 'Original publish run ID, required only for resume'
+        type: string
+
+permissions: {}
+
+concurrency:
+  group: rnn-npm-release
+  cancel-in-progress: false
+
+env:
+  RELEASE_OPERATION: ${{ inputs.operation }}
+  RELEASE_KIND: ${{ inputs.kind }}
+  RELEASE_VERSION: ${{ inputs.version }}
+  RELEASE_NPM_TAG: ${{ inputs.npm_tag }}
+  RELEASE_DOCUMENTATION_VERSION: ${{ inputs.documentation_version }}
+  RELEASE_REMOVE_DOCUMENTATION_VERSION: ${{ inputs.remove_documentation_version }}
+  RELEASE_SOURCE_RUN_ID: ${{ inputs.source_run_id }}
+  RELEASE_PUBLISH_ENABLED: ${{ vars.RELEASE_PUBLISH_ENABLED }}
+  RELEASE_DIR: ${{ github.workspace }}/../release-artifacts
+  GH_TOKEN: ${{ github.token }}
+
+jobs:
+  prepare:
+    if: github.repository == 'wix/react-native-navigation' && github.ref == 'refs/heads/master'
+    runs-on: ubuntu-24.04
+    timeout-minutes: 45
+    permissions:
+      contents: read
+      actions: read
+      statuses: read
+      pull-requests: read
+    outputs:
+      artifact_id: ${{ steps.upload.outputs.artifact-id || steps.resume.outputs.artifact_id }}
+      source_run_id: ${{ steps.resume.outputs.source_run_id || github.run_id }}
+    steps:
+      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8
+        with:
+          ref: ${{ github.sha }}
+          fetch-depth: 0
+          persist-credentials: false
+      - uses: actions/setup-node@65d868f8d4d85d7d4abb7de0875cde3fcc8798f5
+        with:
+          node-version: '24.19.0'
+          package-manager-cache: false
+      - name: Check admin authorization
+        run: node scripts/release/index.cjs authorize
+      - name: Locate original release artifact
+        if: inputs.operation == 'resume'
+        id: resume
+        run: node scripts/release/index.cjs resume-info
+      - uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093
+        if: inputs.operation == 'resume'
+        with:
+          artifact-ids: ${{ steps.resume.outputs.artifact_id }}
+          run-id: ${{ steps.resume.outputs.source_run_id }}
+          github-token: ${{ github.token }}
+          path: ${{ env.RELEASE_DIR }}
+          merge-multiple: true
+      - name: Verify recovery identity and native CI
+        if: inputs.operation == 'resume'
+        run: node scripts/release/index.cjs verify-resume
+      - name: Plan exact version and check native CI
+        if: inputs.operation != 'resume'
+        id: plan
+        run: node scripts/release/index.cjs plan
+      - name: Install locked dependencies
+        if: inputs.operation != 'resume'
+        run: node .yarn/releases/yarn-4.12.0.cjs install --immutable
+      - name: Install locked documentation dependencies
+        if: inputs.operation != 'resume' && steps.plan.outputs.documentation_version != ''
+        working-directory: website
+        run: npm ci --legacy-peer-deps
+      - name: Set version and generate optional documentation
+        if: inputs.operation != 'resume'
+        run: node scripts/release/index.cjs set-version
+      - name: Build and test
+        if: inputs.operation != 'resume'
+        run: |
+          node .yarn/releases/yarn-4.12.0.cjs prepare
+          node .yarn/releases/yarn-4.12.0.cjs test-js
+          node --test scripts/release/*.test.cjs
+      - name: Validate versioned documentation
+        if: inputs.operation != 'resume' && steps.plan.outputs.documentation_version != ''
+        working-directory: website
+        run: npm run build
+      - name: Pack and record immutable release inputs
+        if: inputs.operation != 'resume'
+        run: node scripts/release/index.cjs prepare-artifact
+      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
+        if: inputs.operation != 'resume'
+        id: upload
+        with:
+          name: 
```

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -233,7 +233,6 @@ playground/android/app/.settings/
 AndroidE2E/.settings/
 website/yarn.lock
 playground/ios/Podfile.lock
-website/package-lock.json
 
 # detox artifacts
 artifacts/
```

#### Recent Merged Pull Requests:
- **PR #8367** (2026-10-20): fix(release): tag the source commit instead of the release commit (@noomorph)
- **PR #8366** (2026-10-20): ci: move npm releases to admin-dispatched GitHub Actions (@yedidyak)
- **PR #8363** (2026-09-09): iOS: Fix bottom tabs visibility on iOS 18 (@guyca)
- **PR #8338** (closed): Update package.json version to 8.8.11 (@mobileoss)
- **PR #8337** (2026-07-30): [BottomTabsCustomRow] Fix crash attaching custom row to non-AppCompat activities (@avithalker-wix)
- **PR #8336** (2026-07-30): fix(customrow): only attach BottomTabs custom row to NavigationActivity (@Yoavpagir)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
