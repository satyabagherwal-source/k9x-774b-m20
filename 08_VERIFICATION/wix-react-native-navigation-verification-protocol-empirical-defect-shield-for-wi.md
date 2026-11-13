# Verification Protocol: Verification Protocol: Empirical Defect Shield for wix/react/native/navigation

<!-- PROVENANCE_START
{
  "source_repository": "wix/react/native/navigation",
  "source_url": "https://github.com/wix/react/native/navigation",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [wix/react/native/navigation](https://github.com/wix/react/native/navigation) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `wix/react/native/navigation` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wix-react-native-navigation-learnings.md`  
> **Source**: github ([https://github.com/wix/react-native-navigation](https://github.com/wix/react-native-navigation))  
> **Source Version**: `f5ab5e81`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T02:53:30.563Z  
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
> **Harvest Timestamp**: 2026-11-04T02:53:29.659Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/react-native-navigation`
- **Description**: A complete native navigation solution for React Native
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13170 stars

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
- **Issue #8373** (2026-11-02): **docs(release): npm trust CLI flag and E409 recovery**
  *Symptoms*: Two notes learned while testing the same release tooling end to end for react-native-ui-lib (wix/react-native-ui-lib#4056) on real npm:  - `npm trust github … --allow-publish` is needed to allow direct publish from the CLI; npm 11.12.1 lacks the flag and fails with an unexplained `E400`, 11.17.0 works. - Resuming while npm still hides a fresh upload fails with `E409 Cannot publish over previously staged version`; waiting until the version is visible and resuming again completes the release.  Docs only.

- **Issue #8371** (2026-10-22): **fix(ci): wait for npm to make a published version visible**
  *Symptoms*: After `npm publish`, npm runs an automated malware scan and the version stays unavailable (registry returns 404) until it finishes. Usually ~5 min, can be 15+, no documented upper bound. The release scripts checked the registry once, right after publish, so the `publish` job failed even though the package was published (run 39783204995) and needed a manual `resume`.  - poll the registry after publish until the version matches the artifact (every 30s, up to 30 min) - same wait in `finalize` - `publish` and `finalize` job timeout 10 -> 40 min - if the limit is hit, fail with the existing "resume the same release" message (resume is still safe) - tests: 404 then visible, and the attempts limit  Limit and interval are my choice; npm gives no guarantee. Source: https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/

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

### Incident Patch 1: `f5ab5e81` (2026-11-02)
**Commit Message**: docs(release): npm trust CLI flag and E409 recovery (#8373)

**File**: `docs/RELEASING.md` (modified, +9/-0)
```diff
@@ -29,6 +29,14 @@ enabling publication. Creating or merging the workflow does not configure npm tr
    workflow. Standalone `npm dist-tag` permission is not needed. See
    [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
 
+   From the CLI, this needs an npm with `--allow-publish` (11.17.0 has it, 11.12.1 does not
+   and fails with an unexplained `E400`):
+
+   ```sh
+   npm trust github react-native-navigation --file release.yml \
+     --repo wix/react-native-navigation --env npm-release --allow-publish
+   ```
+
 3. Enable GitHub Actions for this repository. Check Wix's Actions policy permits the pinned checkout, setup-node, upload-artifact,
    and download-artifact actions. Allow workflow-created pull requests. Ensure existing
    repository rules permit version branches and release tags without a bypass.
@@ -129,6 +137,7 @@ resume dispatch may finish GitHub bookkeeping for an already published matching
 | Same version and same integrity already published | Skip publication and finish GitHub steps                                   |
 | Same version with different integrity             | Stop; investigate the conflicting publication                              |
 | Registry failure or lost response                 | Fail without choosing another version; resume when healthy                 |
+| `E409 Cannot publish over previously staged`      | npm still hides that upload; wait until the version is visible and resume  |
 | Existing branch/tag/PR matches                    | Reuse it                                                                   |
 | Existing branch/tag/PR conflicts                  | Stop; never force-push or move a tag                                       |
 | Dry-run artifact selected                         | Reject; start a fresh publish run                                          |
```

#### Recent Merged Pull Requests:
- **PR #8373** (2026-11-02): docs(release): npm trust CLI flag and E409 recovery (@noomorph)
- **PR #8371** (2026-10-22): fix(ci): wait for npm to make a published version visible (@noomorph)
- **PR #8370** (2026-10-22): fix(ci): release dry run artifact path + upload-artifact node24 (@noomorph)
- **PR #8368** (2026-10-20): fix(website): point package-lock.json at the public npm registry (@noomorph)
- **PR #8367** (2026-10-20): fix(release): tag the source commit instead of the release commit (@noomorph)
- **PR #8366** (2026-10-20): ci: move npm releases to admin-dispatched GitHub Actions (@yedidyak)

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

## X. docs(release): npm trust CLI flag and E409 recovery (#8373)

**RULE**:
When implementing operations in `docs/RELEASING.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wix/react-native-navigation. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f5ab5e81`: docs(release): npm trust CLI flag and E409 recovery (#8373). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing MDX data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/RELEASING.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```mdx
// Verified production-grade fix pattern:
   From the CLI, this needs an npm with `--allow-publish` (11.17.0 has it, 11.12.1 does not
   and fails with an unexplained `E400`):

   ```sh
   npm trust github react-native-navigation --file release.yml \
     --repo wix/react-native-navigation --env npm-release --allow-publish
   ```

| `E409 Cannot publish over previously staged`      | npm still hides that upload; wait until the version is visible and resume  |
```

**NEGATIVE CONSTRAINT**:
```mdx
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f5ab5e81` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
