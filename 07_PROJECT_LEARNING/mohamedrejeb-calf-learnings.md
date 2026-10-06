# Forensic Learning Record (Deep Inspection): MohamedRejeb/Calf

> **Canonical Artifact**: `07_PROJECT_LEARNING/mohamedrejeb-calf-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MohamedRejeb/Calf](https://github.com/MohamedRejeb/Calf))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:32:03.383Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MohamedRejeb/Calf`
- **Description**: Calf is a library that allows you to easily create adaptive UIs and access platform specific APIs with Compose Multiplatform (Adaptive UI, File Picker, WebView, Permissions...).
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1727 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `calf-core/src/androidMain/kotlin/com.mohamedrejeb.calf/core/LocalPlatformContext.android.kt`
```
package com.mohamedrejeb.calf.core

import androidx.compose.ui.platform.LocalContext

actual val LocalPlatformContext get() = LocalContext

```

### Core Architecture Module: `calf-core/src/androidMain/kotlin/com.mohamedrejeb.calf/core/PlatformContext.android.kt`
```
package com.mohamedrejeb.calf.core

import android.content.Context

actual typealias PlatformContext = Context

```

### Core Architecture Module: `calf-core/src/commonMain/kotlin/com.mohamedrejeb.calf/core/ExperimentalCalfApi.kt`
```
package com.mohamedrejeb.calf.core

@RequiresOptIn(
    level = RequiresOptIn.Level.ERROR,
    message = "This is an experimental API for Calf and is likely to change before becoming " +
            "stable."
)
@Target(
    AnnotationTarget.CLASS,
    AnnotationTarget.FUNCTION,
    AnnotationTarget.PROPERTY,
    AnnotationTarget.PROPERTY_GETTER
)
@Retention(AnnotationRetention.BINARY)
annotation class ExperimentalCalfApi

```

### Core Architecture Module: `calf-core/src/commonMain/kotlin/com.mohamedrejeb.calf/core/InternalCalfApi.kt`
```
package com.mohamedrejeb.calf.core

@RequiresOptIn(
    level = RequiresOptIn.Level.ERROR,
    message = "This is internal API for Calf modules that may change frequently " +
            "and without warning."
)
@Target(
    AnnotationTarget.CLASS,
    AnnotationTarget.FUNCTION,
    AnnotationTarget.PROPERTY,
    AnnotationTarget.CONSTRUCTOR
)
@Retention(AnnotationRetention.BINARY)
annotation class InternalCalfApi

```

### Core Architecture Module: `calf-core/src/commonMain/kotlin/com.mohamedrejeb.calf/core/LocalPlatformContext.kt`
```
package com.mohamedrejeb.calf.core

import androidx.compose.runtime.ProvidableCompositionLocal

expect val LocalPlatformContext: ProvidableCompositionLocal<PlatformContext>

```

### Core Architecture Module: `calf-core/src/commonMain/kotlin/com.mohamedrejeb.calf/core/PlatformContext.kt`
```
package com.mohamedrejeb.calf.core

expect abstract class PlatformContext

```

### Core Architecture Module: `calf-core/src/nonAndroidMain/kotlin/com.mohamedrejeb.calf/core/LocalPlatformContext.nonAndroid.kt`
```
package com.mohamedrejeb.calf.core

import androidx.compose.runtime.staticCompositionLocalOf

actual val LocalPlatformContext =
    staticCompositionLocalOf {
        PlatformContext.INSTANCE
    }

```

### Core Architecture Module: `calf-core/src/nonAndroidMain/kotlin/com.mohamedrejeb.calf/core/PlatformContext.nonAndroid.kt`
```
package com.mohamedrejeb.calf.core

import kotlin.jvm.JvmField

actual abstract class PlatformContext private constructor() {
    companion object {
        @JvmField
        val INSTANCE = object : PlatformContext() {}
    }
}

```

### Core Architecture Module: `calf-file-picker/src/desktopMain/kotlin/jodd/io/IOUtil.kt`
```
// Copyright (c) 2003-present, Jodd Team (http://jodd.org)
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
// this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright
// notice, this list of conditions and the following disclaimer in the
// documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
package jodd.io

import java.io.Closeable
import java.io.Flushable
import java.io.IOException

/**
 * Optimized byte and character stream utilities.
 */
internal object IOUtil {
    // ---------------------------------------------------------------- silent close
    /**
     * Closes silently the closable object. If it is [Flushable], it
     * will be flushed first. No exception will be thrown if an I/O error occurs.
     */
    fun close(closeable: Closeable?) {
        if (closeable == null)
            return

        if (closeable is Flushable) {
            try {
                closeable.flush()
            } catch (ignored: IOException) {
            }
        }

        try {
            closeable.close()
        } catch (ignored: IOException) {
        }
    }
}
```

### Core Architecture Module: `calf-file-picker/src/desktopMain/kotlin/jodd/util/Wildcard.kt`
```
// Copyright (c) 2003-present, Jodd Team (http://jodd.org)
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
// this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright
// notice, this list of conditions and the following disclaimer in the
// documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
package jodd.util

/**
 * Checks whether a string or path matches a given wildcard pattern.
 * Possible patterns allow to match single characters ('?') or any count of
 * characters ('*'). Wildcard characters can be escaped (by an '\').
 * When matching path, deep tree wildcard also can be used ('**').
 *
 *
 * This method uses recursive matching, as in linux or windows. regexp works the same.
 * This method is very fast, comparing to similar implementations.
 */
internal object Wildcard {
    /**
     * Checks whether a string matches a given wildcard pattern.
     *
     * @param string    input string
     * @param pattern    pattern to match
     * @return            `true` if string matches the pattern, otherwise `false`
     */
    fun match(string: CharSequence, pattern: CharSequence): Boolean {
        return match(string, pattern, 0, 0)
    }

    /**
     * Internal matching recursive function.
     */
    private fun match(string: CharSequence, pattern: CharSequence, sNdx: Int, pNdx: Int): Boolean {
        var sNdx = sNdx
        var pNdx = pNdx
        val pLen = pattern.length
        if (pLen == 1) {
            if (pattern[0] == '*') {     // speed-up
                return true
            }
        }
        val sLen = string.length
        var nextIsNotWildcard = false

        while (true) {
            // check if end of string and/or pattern occurred

            if ((sNdx >= sLen)) {        // end of string still may have pending '*' in pattern
                while ((pNdx < pLen) && (pattern[pNdx] == '*')) {
                    pNdx++
                }
                return pNdx >= pLen
            }
            if (pNdx >= pLen) {                    // end of pattern, but not end of the string
                return false
            }
            val p = pattern[pNdx] // pattern char

            // perform logic
            if (!nextIsNotWildcard) {
                if (p == '\\') {
                    pNdx++
                    nextIsNotWildcard = true
                    continue
                }
                if (p == '?') {
                    sNdx++
                    pNdx++
                    continue
                }
                if (p == '*') {
                    var pNext = 0.toChar() // next pattern char
                    if (pNdx + 1 < pLen) {
                        pNext = pattern[pNdx + 1]
                    }
                    if (pNext == '*') {                    // double '*' have the same effect as one '*'
                        pNdx++
                        continue
                    }
                    pNdx++

                    // find recursively if there is any substring from the end of the
                    // line that matches the rest of the pattern !!!
                    var i = string.length
                    while (i >= sNdx) {
                        if (match(string, pattern, i, pNdx)) {
                            return true
                        }
                        i--
                    }
                    return false
                }
            } else {
                nextIsNotWildcard = false
            }

            // check if pattern char and string char are equals
            if (p != string[sNdx]) {
                return false
            }

            // everything matches for now, continue
            sNdx++
            pNdx++
        }
    }


    // ---------------------------------------------------------------- utilities
    /**
     * Matches string to at least one pattern.
     * Returns index of matched pattern, or `-1` otherwise.
     * @see .match
     */
    fun matchOne(src: String, vararg patterns: String): Int {
        for (i in patterns.indices) {
            if (match(src, patterns[i])) {
                return i
            }
        }
        return -1
    }
}
```

### Core Architecture Module: `calf-permissions/core/src/androidMain/kotlin/com/mohamedrejeb/calf/permissions/AndroidPermissionRegistry.kt`
```
package com.mohamedrejeb.calf.permissions

/**
 * Configuration for mapping a [Permission] to its Android permission string.
 *
 * @param permissionString the Android manifest permission string (e.g. [android.Manifest.permission.CAMERA]).
 * @param minSdkVersion the minimum Android SDK version where this permission applies (inclusive).
 * @param maxSdkVersion the maximum Android SDK version where this permission applies (inclusive).
 * @param alwaysGranted whether this permission is always considered granted on Android.
 */
class AndroidPermissionMapping(
    val permissionString: String,
    val minSdkVersion: Int = 0,
    val maxSdkVersion: Int = Int.MAX_VALUE,
    val alwaysGranted: Boolean = false,
)

/**
 * Registry for Android permission mappings.
 *
 * Each permission module registers its Android permission mappings here
 * via the actual implementation of its register function in androidMain.
 */
object AndroidPermissionRegistry {
    private val mappings = mutableMapOf<Permission, AndroidPermissionMapping>()

    fun register(permission: Permission, mapping: AndroidPermissionMapping) {
        mappings[permission] = mapping
    }

    internal fun getMapping(permission: Permission): AndroidPermissionMapping? =
        mappings[permission]

    internal fun findByAndroidString(androidPermission: String, sdkInt: Int): Permission? =
        mappings.entries.firstOrNull { (_, mapping) ->
            mapping.permissionString == androidPermission &&
                sdkInt in mapping.minSdkVersion..mapping.maxSdkVersion
        }?.key
}

```

### Core Architecture Module: `calf-permissions/core/src/androidMain/kotlin/com/mohamedrejeb/calf/permissions/MutableMultiplePermissionsState.android.kt`
```
package com.mohamedrejeb.calf.permissions

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * Creates a [MultiplePermissionsState] that is remembered across compositions.
 *
 * It's recommended that apps exercise the permissions workflow as described in the
 * [documentation](https://developer.android.com/training/permissions/requesting#workflow_for_requesting_permissions).
 *
 * @param permissions the permissions to control and observe.
 * @param onPermissionsResult will be called with whether or not the user granted the permissions
 *  after [MultiplePermissionsState.launchMultiplePermissionRequest] is called.
 */
@ExperimentalPermissionsApi
@Composable
internal actual fun rememberMutableMultiplePermissionsState(
    permissions: List<Permission>,
    onPermissionsResult: (Map<Permission, Boolean>) -> Unit
): MultiplePermissionsState {
    // Create mutable permissions that can be requested individually
    val mutablePermissions = rememberMutablePermissionsState(permissions, onPermissionsResult)
    // Refresh permissions when the lifecycle is resumed.
    PermissionsLifecycleCheckerEffect(mutablePermissions)

    val multiplePermissionsState = remember(permissions) {
        MutableMultiplePermissionsState(mutablePermissions)
    }

    // Remember RequestMultiplePermissions launcher and assign it to multiplePermissionsState
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissionsResult ->
        val result = permissionsResult
            .mapKeys { getPermissionFromAndroidPermission(it.key) }
            .filter { it.key != null }
            .mapKeys { it.key!! }
        multiplePermissionsState.updatePermissionsStatus(result)
        onPermissionsResult(result)
    }
    DisposableEffect(multiplePermissionsState, launcher) {
        multiplePermissionsState.launcher = launcher
        onDispose {
            multiplePermissionsState.launcher = null
        }
    }

    return multiplePermissionsState
}

@ExperimentalPermissionsApi
@Composable
private fun rememberMutablePermissionsState(
    permissions: List<Permission>,
    onPermissionsResult: (Map<Permission, Boolean>) -> Unit
): List<MutablePermissionState> {
    // Create list of MutablePermissionState for each permission
    val context = LocalContext.current
    val activity = context.findActivity()
    val mutablePermissions = remember(permissions) {
        return@remember permissions.map { permission ->
            MutablePermissionStateImpl(
                permission,
                context,
                activity,
            ) { isGranted ->
                onPermissionsResult(mapOf(permission to isGranted))
            }
        }
    }
    // Update each permission with its own launcher
    for (permissionState in mutablePermissions) {
        key(permissionState.permission) {
            // Remember launcher and assign it to the permissionState
            val launcher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission()
            ) {
                permissionState.refreshPermissionStatus()
            }
            DisposableEffect(launcher) {
                permissionState.launcher = launcher
                onDispose {
                    permissionState.launcher = null
                }
            }
        }
    }

    return mutablePermissions
}

/**
 * A state object that can be hoisted to control and observe multiple permission status changes.
 *
 * In most cases, this will be created via [rememberMutableMultiplePermissionsState].
 *
 * @param mutablePermissions list of mutable permissions to control and observe.
 */
@ExperimentalPermissionsApi
@Stable
internal actual class MutableMultiplePermissionsState actual constructor(
    private val mutablePermissions: List<MutablePermissionState>
) : MultiplePermissionsState {

    actual override val permissions: List<PermissionState> = mutablePermissions

    actual override val revokedPermissions: List<PermissionState> by derivedStateOf {
        permissions.filter { it.status != PermissionStatus.Granted }
    }

    actual override val allPermissionsGranted: Boolean by derivedStateOf {
        permissions.all { it.status.isGranted } || // Up to date when the lifecycle is resumed
                revokedPermissions.isEmpty() // Up to date when the user launches the action
    }

    actual override val shouldShowRationale: Boolean by derivedStateOf {
        permissions.any { it.status.shouldShowRationale }
    }

    actual override fun launchMultiplePermissionRequest() {
        // added empty string and empty array safeguards
        val safePermissions = permissions
            .map { it.permission.toAndroidPermission() }
            .filter { it.isNotBlank() }

        if (safePermissions.isNotEmpty()) {
            launcher?.launch(safePermissions.toTypedArray())
                ?: throw IllegalStateException("ActivityResultLauncher cannot be null")
        }
    }

    internal var launcher: ActivityResultLauncher<Array<String>>? = null

    internal actual fun updatePermissionsStatus(permissionsStatus: Map<Permission, Boolean>) {
        // Update all permissions with the result
        for (permission in permissionsStatus.keys) {
            mutablePermissions.firstOrNull { it.permission == permission }?.apply {
                permissionsStatus[permission]?.let {
                    this.refreshPermissionStatus()
                }
            }
        }
    }
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #538** (2026-08-16): **[Bug] specified class size for type 'CalfToggle' is smaller than the parent type's 'GtkRange' class size**
  *Symptoms*: ### Steps to Reproduce  Calf 0.90.8 Gtk+ 2.24.33 Ardour 9.2.0 build with GCC version 14.3.1 Linux 6.18.32   Adding a Calf plugin (e. g. Calf Compressor) in a bus in Ardour crashes. Plugins by other vendors are not affected.  The following message appears in the console:  ``` CALF DEBUG: instance 0x558b6fb61cc0 data 0x558b6fa9b670 CALF DEBUG: calf 0x7f3c55fc2db0 cpi 0x7f3c557cf770  (ardour-9.2.0:93312): GLib-GObject-CRITICAL **: 23:40:06.175: specified class size for type 'CalfToggle' is smaller than the parent type's 'GtkRange' class size  (ardour-9.2.0:93312): GLib-GObject-CRITICAL **: 23:40:06.176: g_object_new_with_properties: assertion 'G_TYPE_IS_OBJECT (object_type)' failed ```       ### Expected Behavior  Calf plugins should load  ### Actual Behavior  DAW crashes  ### Module  calf-ui  ### Specify Other Module (if you selected "other" above)  _No response_  ### Platform  Desktop  ### Library Version  _No response_
  **Post-Mortem & Fix Analysis**:
  > Sorry, this is the wrong project. I reposted the issue at  https://github.com/calf-studio-gear/calf

- **Issue #536** (2026-09-11): **[Bug]: Alert dialog single button**
  *Symptoms*: ### Steps to Reproduce  It is currently impossible to have an alert dialog on iOS with a single button  ### Expected Behavior  We should be able to have a single button on an alert dialog  ### Actual Behavior  If we set an empty string, we get a blank button  ### Module  calf-ui  ### Specify Other Module (if you selected "other" above)  _No response_  ### Platform  iOS  ### Library Version  0.12.0
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this, it's now available in `0.14.0` Docs: https://mohamedrejeb.github.io/Calf/filepicker/#streaming-with-kotlinx-io

- **Issue #534** (2026-09-11): **ExceptionInInitializerError: Using same DLL in 2 Different Product flavor released App on same system running at same time**
  *Symptoms*: ### Steps to Reproduce  1. Add File picker dependency 2. use 2 or more product flavor in your app 3. use both app with different product flavor on 1 system at same time  ### Expected Behavior  normally run both apps  ### Actual Behavior  got exception:  java.lang.ExceptionInInitializerError 	at com.mohamedrejeb.calf.picker.platform.PlatformFilePicker.createFilePickerHandle(PlatformFilePicker.kt:33) 	at com.mohamedrejeb.calf.picker.FilePickerLauncher_desktopKt$rememberFilePickerLauncherInternal$1$1$1$handle$1.invokeSuspend(FilePickerLauncher.desktop.kt:124) 	at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:34) 	at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:100) 	at kotlinx.coroutines.internal.LimitedDispatcher$Worker.run(LimitedDispatcher.kt:124) 	at kotlinx.coroutines.scheduling.TaskImpl.run(Tasks.kt:89) 	at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:586) 	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.executeTask(CoroutineScheduler.kt:798) 	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.runWorker(CoroutineScheduler.kt:717) 	at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(CoroutineScheduler.kt:704) 	Suppressed: kotlinx.coroutines.internal.DiagnosticCoroutineContextException: [kotlinx.coroutines.UndispatchedMarker@41248ba4, androidx.compose.runtime.BroadcastFrameClock@37ce8417, androidx.compose.runtime.LaunchedEffectImpl@9e61d6d, StandaloneCoroutine{Ca
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this, try updating to `0.14.0` and the issue should be fixed automatically

- **Issue #408** (2026-07-20): **AdaptiveBottomSheet: weird scroll issue on iOS**
  *Symptoms*: https://github.com/user-attachments/assets/51d80d51-4c4c-4743-96bc-6248b994d726  Also reproducing on my physical iOS 18.6.2 device  ## Environment ``` kotlin = 2.3.0 compose-multiplatform = 1.10.0 calf = 0.9.0 ```  ## Sample code ```kotlin @OptIn(ExperimentalMaterial3Api::class) @Composable fun TestSheet(     onDismissRequest: () -> Unit ) {     AdaptiveBottomSheet(         adaptiveSheetState = rememberAdaptiveSheetState(skipPartiallyExpanded = true),         dragHandle = null,         onDismissRequest = onDismissRequest     ) {         LazyColumn(             modifier = Modifier.fillMaxSize()         ) {             items(100) {                 Text(                     modifier = Modifier                         .fillMaxWidth()                         .padding(16.dp),                     text = "${it.inc()}"                 )             }         }     } } ```
  **Post-Mortem & Fix Analysis**:
  > Hello Thanks for reporting this, Can you try updating Compose to 1.11.0, that should fix the issue Fixed in https://github.com/JetBrains/compose-multiplatform-core/pull/2883

- **Issue #381** (2026-03-14): **AdaptiveAlertDialog crashes iOS app**
  *Symptoms*: When clicking outside of AdaptiveAlertDialog, the iOS app crashes. But it works well, when using buttons. Here the code to reproduce: ``` var showDialog by remember {         mutableListOf(false)     }  // Button to trigger the dialog  // Show the dialog when state is true     if (showDialog) {         AdaptiveAlertDialog(             onConfirm = {                 // Handle confirmation                 showDialog = false             },             onDismiss = {                 // Handle dismissal                 showDialog = false             },             confirmText = "OK",             dismissText = "Cancel",             title = "Alert Dialog",             text = "This is a native alert dialog from Calf",             // Optional: Customize iOS dialog style             iosDialogStyle = AlertDialogIosStyle.Alert, // or ActionSheet             iosConfirmButtonStyle = AlertDialogIosActionStyle.Default,             iosDismissButtonStyle = AlertDialogIosActionStyle.Destructive,         )     }      Box(modifier = Modifier.fillMaxSize()) {         Button(             onClick = { showDialog = true },         ) {             Text("Show Alert Dialog")         }     } ``` Any solution? Thanks.
  **Post-Mortem & Fix Analysis**:
  > Hello Thanks for reporting this issue What's the iOS version you are using?
  > 26.1 (Virtual device)
  > Hello @MohamedRejeb, is anything new about this crash?

- **Issue #363** (2026-05-16): **Scrolling AdaptiveBottomSheet**
  *Symptoms*: Hello. Is it possible to make AdaptiveBottomSheet  vertically scrollable?
  **Post-Mortem & Fix Analysis**:
  > Not the same, but similar issue on IOS.  I've added a Scaffold inside of the AdaptiveBottomSheet with bottom bar and a LazyColumn as it's content, the sheet isn't being closed but being over scrolled. Is it possible to close the sheet when it's no longer forward scrollable?  https://github.com/user-attachments/assets/666b9e8f-d959-40e1-8708-21e748a455ea
  > Hello Can you share a video of the problem please @lemkoleg , because you should be able to use a vertical scroll inside the bottom sheet, check the sample I'm already using it: https://github.com/MohamedRejeb/Calf/blob/main/sample/common/src/commonMain/kotlin/com.mohamedrejeb.calf.sample/screens/BottomSheetScreen.kt
  > Currently that's a limitation from Compose for the over scroll, I'll check if they added an option to support that.

- **Issue #280** (2026-09-12): **FilePicker crashes on Linux Debian Trixie**
  *Symptoms*: Hey,  I just tried your FilePicker: ``` val openPicker = rememberFilePickerLauncher(     type = FilePickerFileType.Extension(listOf("cub")),     selectionMode = FilePickerSelectionMode.Single,     onResult = { file ->      } )  IconButton(onClick = openPicker::launch) {     Icon(         imageVector = Icons.Default.FolderOpen,         contentDescription = i18n.menuFileOpen     ) } ```  However it crashes with the following error:  ``` Caused by: java.lang.ClassCastException: class kotlin.coroutines.jvm.internal.CompletedContinuation cannot be cast to class kotlinx.coroutines.internal.DispatchedContinuation (kotlin.coroutines.jvm.internal.CompletedContinuation and kotlinx.coroutines.internal.DispatchedContinuation are in unnamed module of loader 'app') ```  
  **Post-Mortem & Fix Analysis**:
  > Hello thanks for reporting this issue, working on fixing it.
  > Should be working fine in the latest release, feel free to reopen if you still have issues

- **Issue #277** (2026-03-31): **No Activity found to handle Intent { act=android.provider.action.PICK_IMAGES typ=image/* (has extras) }**
  *Symptoms*: When using:  ```kotlin rememberFilePickerLauncher(       type = FilePickerFileType.Image,       selectionMode = FilePickerSelectionMode.Single, ) ```  on an Android Simulator with Android 35, I'm getting:  > android.content.ActivityNotFoundException: No Activity found to handle Intent { act=android.provider.action.PICK_IMAGES typ=image/* (has extras) }  Is there any reason why `PICK_IMAGES` is used and not `Intent.ACTION_GET_CONTENT`? 
  **Post-Mortem & Fix Analysis**:
  > > When using: >  > rememberFilePickerLauncher( >       type = FilePickerFileType.Image, >       selectionMode = FilePickerSelectionMode.Single, > ) > on an Android Simulator with Android 35, I'm getting: >  > > android.content.ActivityNotFoundException: No Activity found to handle Intent { act=android.provider.action.PICK_IMAGES typ=image/* (has extras) } >  > Is there any reason why `PICK_IMAGES` is used and not `Intent.ACTION_GET_CONTENT`?  When using rememberFilePickerLauncher with FilePickerFileType.Image on an Android emulator running Android 35, you might encounter this exception:  > android.content.ActivityNotFoundException: No Activity found to handle Intent { act=android.provider.action.PICK_IMAGES typ=image/* (has extras) }  This happens because Intent.ACTION_PICK_IMAGES (introduced in Android 13) relies on the presence of a compatible photo picker app or system component that handles the PICK_IMAGES action. On some emulators or devices without a default gallery or photo pick

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

### Incident Patch 1: `af388bd3` (2026-09-20)
**Commit Message**: Merge pull request #549 from kevinguitar/adaptive-clickable-long-click

Support full combinedClickable capability in adaptiveClickable modifier

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/gesture/AdaptiveClickable.kt` (modified, +4/-0)
```diff
@@ -18,5 +18,9 @@ expect fun Modifier.adaptiveClickable(
     onClickLabel: String? = null,
     role: Role? = null,
     shape: Shape = RectangleShape,
+    onLongClickLabel: String? = null,
+    onLongClick: (() -> Unit)? = null,
+    onDoubleClick: (() -> Unit)? = null,
+    hapticFeedbackEnabled: Boolean = true,
     onClick: () -> Unit,
 ): Modifier
\ No newline at end of file
```

**File**: `calf-ui/src/desktopTest/kotlin/com/mohamedrejeb/calf/ui/gesture/AdaptiveClickableMaterialTest.kt` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+package com.mohamedrejeb.calf.ui.gesture
+
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.size
+import androidx.compose.material3.Text
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.doubleClick
+import androidx.compose.ui.test.longClick
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.performClick
+import androidx.compose.ui.test.performTouchInput
+import androidx.compose.ui.test.v2.runComposeUiTest
+import androidx.compose.ui.unit.dp
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveClickableMaterialTest {
+
+    @Test
+    fun `invokes onClick when clicked`() = runComposeUiTest {
+        var clickCount = 0
+
+        setContent {
+            Box(
+                modifier = Modifier
+                    .size(100.dp)
+                    .adaptiveClickable(onClick = { clickCount++ })
+            ) {
+                Text("Target")
+            }
+        }
+
+        onNodeWithText("Target").performClick()
+
+        assertEquals(1, clickCount)
+    }
+
+    @Test
+    fun `invokes onLongClick when long clicked`() = runComposeUiTest {
+        var clickCount = 0
+        var longClickCount = 0
+
+        setContent {
+            Box(
+                modifier = Modifier
+                    .size(100.dp)
+                    .adaptiveClickable(
+                        onLongClick = { longClickCount++ },
+                        onClick = { clickCount++ },
+                    )
+            ) {
+                Text("Target")
+            }
+        }
+
+        onNodeWithText("Target").performTouchInput { longClick() }
+
+        assertEquals(1, longClickCount)
+        assertEquals(0, clickCount)
+    }
+
+    @Test
+    fun `does not invoke onClick when disabled`() = runComposeUiTest {
+        var clickCount = 0
+
+        setContent {
+            Box(
+                modifier = Modifier
+                    .size(100.dp)
+                    .adaptiveClickable(
+                        enabled = false,
+                        onClick = { clickCount++ },
+                    )
+            ) {
+                Text("Target")
+            }
+        }
+
+        onNodeWithText("Target").performClick()
+
+        assertEquals(0, clickCount)
+    }
+
+    @Test
+    fun `when onLongClick is null, invoke onClick when long clicked`() = runComposeUiTest {
+        var clickCount = 0
+
+        setContent {
+            Box(
+                modifier = Modifier
+                    .size(100.dp)
+                    .adaptiveClickable(
+                        onLongClick = null,
+                        onClick = { clickCount++ },
+                    )
+            ) {
+                Text("Target")
+            }
+        }
+
+        onNodeWithText("Target").performTouchInput { longClick() }
+
+        assertEquals(1, clickCount)
+    }
+
+    @Test
+    fun `invokes onDoubleClick when double clicked`() = runComposeUiTest {
+        var clickCount = 0
+        var doubleClickCount = 0
+
+        setContent {
+            Box(
+                modifier = Modifier
+                    .size(100.dp)
+                    .adaptiveClickable(
+                        onDoubleClick = { doubleClickCount++ },
+                        onClick = { clickCount++ },
+                    )
+            ) {
+                Text("Target")
+            }
+        }
+
+        onNodeWithText("Target").performTouchInput { doubleClick() }
+
+        assertEquals(1, doubleClickCount)
+        assertEquals(0, clickCount)
+    }
+
+    @Test
+    fun `when onDoubleClick is null, invoke onClick when double clicked`() = runComposeUiTest {
+        var clickCount = 0
+
+        setContent {
+            Box(
+                modifier = Modifier
+                    .size(100.dp)
+                    .adaptiveClickable(
+                        onDoubleClick = null,
+                        onClick = { clickCount++ },
+                    )
+            ) {
+                Text("Target")
+            }
+        }
+
+        onNodeWithText("Target").performTouchInput { doubleClick() }
+
+        assertEquals(2, clickCount)
+    }
+}
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/gesture/AdaptiveClickable.ios.kt` (modified, +10/-2)
```diff
@@ -2,7 +2,7 @@ package com.mohamedrejeb.calf.ui.gesture
 
 import androidx.compose.animation.core.animateFloatAsState
 import androidx.compose.foundation.Indication
-import androidx.compose.foundation.clickable
+import androidx.compose.foundation.combinedClickable
 import androidx.compose.foundation.interaction.MutableInteractionSource
 import androidx.compose.foundation.interaction.collectIsPressedAsState
 import androidx.compose.runtime.Composable
@@ -21,6 +21,10 @@ actual fun Modifier.adaptiveClickable(
     onClickLabel: String?,
     role: Role?,
     shape: Shape,
+    onLongClickLabel: String?,
+    onLongClick: (() -> Unit)?,
+    onDoubleClick: (() -> Unit)?,
+    hapticFeedbackEnabled: Boolean,
     onClick: () -> Unit
 ): Modifier {
     val isPressed by interactionSource.collectIsPressedAsState()
@@ -33,12 +37,16 @@ actual fun Modifier.adaptiveClickable(
             scaleY = scale
         }
         .clip(shape)
-        .clickable(
+        .combinedClickable(
             interactionSource = interactionSource,
             indication = null,
             enabled = enabled,
             onClickLabel = onClickLabel,
             role = role,
+            onLongClickLabel = onLongClickLabel,
+            onLongClick = onLongClick,
+            onDoubleClick = onDoubleClick,
+            hapticFeedbackEnabled = hapticFeedbackEnabled,
             onClick = onClick
         )
 }
```

**File**: `calf-ui/src/materialMain/kotlin/com/mohamedrejeb/calf/ui/gesture/AdaptiveClickable.material.kt` (modified, +11/-3)
```diff
@@ -1,7 +1,7 @@
 package com.mohamedrejeb.calf.ui.gesture
 
 import androidx.compose.foundation.Indication
-import androidx.compose.foundation.clickable
+import androidx.compose.foundation.combinedClickable
 import androidx.compose.foundation.interaction.MutableInteractionSource
 import androidx.compose.runtime.Composable
 import androidx.compose.ui.Modifier
@@ -17,15 +17,23 @@ actual fun Modifier.adaptiveClickable(
     onClickLabel: String?,
     role: Role?,
     shape: Shape,
-    onClick: () -> Unit
+    onLongClickLabel: String?,
+    onLongClick: (() -> Unit)?,
+    onDoubleClick: (() -> Unit)?,
+    hapticFeedbackEnabled: Boolean,
+    onClick: () -> Unit,
 ): Modifier =
     this
         .clip(shape)
-        .clickable(
+        .combinedClickable(
             interactionSource = interactionSource,
             indication = indication,
             enabled = enabled,
             onClickLabel = onClickLabel,
             role = role,
+            onLongClickLabel = onLongClickLabel,
+            onLongClick = onLongClick,
+            onDoubleClick = onDoubleClick,
+            hapticFeedbackEnabled = hapticFeedbackEnabled,
             onClick = onClick
         )
\ No newline at end of file
```

**File**: `docs/ui/adaptive-clickable.md` (modified, +9/-0)
```diff
@@ -25,6 +25,15 @@ Box(
             interactionSource = remember { MutableInteractionSource() },
             indication = rememberRipple(), // Used on Android only
             enabled = true,
+            onLongClick = {
+                // Handle long click
+                println("Long clicked!")
+            },
+            onDoubleClick = {
+                // Handle double click
+                println("Double clicked!")
+            },
+            hapticFeedbackEnabled = true, // Used for long click only
         ) {
             // Handle click
             println("Clicked!")
```

**File**: `sample/common/src/commonMain/kotlin/com.mohamedrejeb.calf.sample/screens/AdaptiveClickableScreen.kt` (modified, +6/-0)
```diff
@@ -43,6 +43,12 @@ fun AdaptiveClickableScreen(
                 modifier = Modifier
                     .adaptiveClickable(
                         shape = MaterialTheme.shapes.medium,
+                        onLongClick = {
+                            // Handle long click
+                        },
+                        onDoubleClick = {
+                            // Handle double click
+                        }
                     ) {
                         // Handle click
                     }
```

---

### Incident Patch 2: `a903a20f` (2026-09-19)
**Commit Message**: Merge pull request #550 from kevinguitar/enable-gradle-parallel-sync

Enabled parallel sync for Gradle 9.4+

**File**: `gradle.properties` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 org.gradle.jvmargs=-Xmx4048M -Dfile.encoding=UTF-8 -Dkotlin.daemon.jvm.options\="-Xmx4048M"
 org.gradle.caching=true
 org.gradle.parallel=true
+org.gradle.tooling.parallel=true
 
 kotlin.code.style=official
 
```

---

### Incident Patch 3: `0e601976` (2026-09-12)
**Commit Message**: Merge pull request #542 from MohamedRejeb/fix/nav-host-state-restore

fix(navigation): keep each destination's saved state while it is on the back stack

**File**: `calf-navigation/build.gradle.kts` (modified, +9/-0)
```diff
@@ -8,6 +8,15 @@ kotlin {
         implementation(libs.compose.material3)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.android.navigation.compose)
     }
```

**File**: `calf-navigation/src/commonMain/kotlin/com.mohamedrejeb.calf/navigation/AdaptiveNavHost.kt` (modified, +28/-2)
```diff
@@ -3,7 +3,10 @@ package com.mohamedrejeb.calf.navigation
 import androidx.compose.foundation.layout.Box
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.saveable.SaveableStateHolder
+import androidx.compose.runtime.saveable.rememberSaveableStateHolder
 import androidx.compose.ui.Modifier
 
 @Composable
@@ -28,11 +31,34 @@ fun AdaptiveNavHost(
             navController.navigate(startDestination)
     }
 
+    // Keeps each destination's `rememberSaveable` state (list positions, form input) while the
+    // destination stays on the back stack, so coming back restores it.
+    val saveableStateHolder = rememberSaveableStateHolder()
+    ForgetPoppedDestinations(navController, saveableStateHolder)
+
     Box(modifier = modifier) {
         navController.currentDestination?.let { currentDestination ->
             graphBuilder.destinations.find { it.route == currentDestination }?.let { destination ->
-                destination.content(destination.arguments)
+                saveableStateHolder.SaveableStateProvider(key = currentDestination) {
+                    destination.content(destination.arguments)
+                }
             }
         }
     }
-}
\ No newline at end of file
+}
+
+/** Drops the saved state of destinations that left the back stack, so a later visit starts fresh. */
+@Composable
+private fun ForgetPoppedDestinations(
+    navController: AdaptiveNavHostController,
+    saveableStateHolder: SaveableStateHolder,
+) {
+    val routesOnStack = navController.backStack.toSet()
+    val retainedRoutes = remember { mutableSetOf<String>() }
+
+    SideEffect {
+        (retainedRoutes - routesOnStack).forEach(saveableStateHolder::removeState)
+        retainedRoutes.clear()
+        retainedRoutes.addAll(routesOnStack)
+    }
+}
```

**File**: `calf-navigation/src/desktopTest/kotlin/com/mohamedrejeb/calf/navigation/AdaptiveNavHostStateTest.kt` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package com.mohamedrejeb.calf.navigation
+
+import androidx.compose.material3.Button
+import androidx.compose.material3.Text
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.saveable.rememberSaveable
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.performClick
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+
+private const val HOME = "home"
+private const val DETAIL = "detail"
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveNavHostStateTest {
+
+
+    @Test
+    fun `saveable state of a destination survives navigating away and back`() = runComposeUiTest {
+        lateinit var navController: AdaptiveNavHostController
+        setContent {
+            navController = rememberNavController()
+            AdaptiveNavHost(navController = navController, startDestination = HOME) {
+                composable(HOME) { Counter(label = HOME) }
+                composable(DETAIL) { Text(DETAIL) }
+            }
+        }
+        waitForIdle()
+
+        onNodeWithText("$HOME 0").performClick()
+        onNodeWithText("$HOME 1").assertIsDisplayed()
+
+        navController.navigate(DETAIL)
+        waitForIdle()
+        onNodeWithText(DETAIL).assertIsDisplayed()
+
+        navController.popBackStack()
+        waitForIdle()
+
+        onNodeWithText("$HOME 1").assertIsDisplayed()
+    }
+
+    @Test
+    fun `saveable state of a popped destination is dropped`() = runComposeUiTest {
+        lateinit var navController: AdaptiveNavHostController
+        setContent {
+            navController = rememberNavController()
+            AdaptiveNavHost(navController = navController, startDestination = HOME) {
+                composable(HOME) { Text(HOME) }
+                composable(DETAIL) { Counter(label = DETAIL) }
+            }
+        }
+        waitForIdle()
+
+        navController.navigate(DETAIL)
+        waitForIdle()
+        onNodeWithText("$DETAIL 0").performClick()
+        onNodeWithText("$DETAIL 1").assertIsDisplayed()
+
+        navController.popBackStack()
+        waitForIdle()
+        navController.navigate(DETAIL)
+        waitForIdle()
+
+        onNodeWithText("$DETAIL 0").assertIsDisplayed()
+    }
+}
+
+@androidx.compose.runtime.Composable
+private fun Counter(label: String) {
+    var count by rememberSaveable { mutableStateOf(0) }
+    Button(onClick = { count++ }) {
+        Text("$label $count")
+    }
+}
```

---

### Incident Patch 4: `e535b7a5` (2026-09-12)
**Commit Message**: Merge pull request #541 from MohamedRejeb/fix/date-picker-selectable-dates

feat(ui): add a cross-platform selectable dates rule to AdaptiveDatePicker

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDatePickerState.kt` (modified, +42/-2)
```diff
@@ -5,6 +5,23 @@ import androidx.compose.runtime.*
 import androidx.compose.runtime.saveable.Saver
 import androidx.compose.runtime.saveable.rememberSaveable
 
+/**
+ * Creates and remembers an [AdaptiveDatePickerState].
+ *
+ * @param initialSelectedDateMillis timestamp in _UTC_ milliseconds from the epoch that
+ * represents an initial selection of a date. Provide a `null` to indicate no selection.
+ * @param initialDisplayedMonthMillis timestamp in _UTC_ milliseconds from the epoch that
+ * represents an initial selection of a month to be displayed to the user. In case `null` is
+ * provided, the displayed month would be the current one.
+ * @param yearRange an [IntRange] that holds the year range that the date picker will be limited
+ * to
+ * @param initialMaterialDisplayMode an initial [DisplayMode] that this state will hold
+ * @param initialUIKitDisplayMode an initial [UIKitDisplayMode] used by the iOS picker
+ * @param selectableDates the rule deciding which days can be picked, see
+ * [AdaptiveDatePickerState.selectableDates]. Use [DateBounds] for a minimum and maximum day and
+ * [and] to combine rules. Pass a stable instance (for example an `object`, a `data class` or a
+ * remembered value) so the picker does not re-evaluate on every recomposition.
+ */
 @Composable
 @ExperimentalMaterial3Api
 fun rememberAdaptiveDatePickerState(
@@ -13,17 +30,22 @@ fun rememberAdaptiveDatePickerState(
     yearRange: IntRange = DatePickerDefaults.YearRange,
     initialMaterialDisplayMode: DisplayMode = DisplayMode.Picker,
     initialUIKitDisplayMode: UIKitDisplayMode = UIKitDisplayMode.Picker,
+    selectableDates: SelectableDates = DatePickerDefaults.AllDates,
 ): AdaptiveDatePickerState =
     rememberSaveable(
-        saver = AdaptiveDatePickerState.Saver(),
+        saver = AdaptiveDatePickerState.Saver(selectableDates),
     ) {
         AdaptiveDatePickerState(
             initialSelectedDateMillis = initialSelectedDateMillis,
             initialDisplayedMonthMillis = initialDisplayedMonthMillis,
             yearRange = yearRange,
             initialMaterialDisplayMode = initialMaterialDisplayMode,
             initialUIKitDisplayMode = initialUIKitDisplayMode,
+            selectableDates = selectableDates,
         )
+    }.apply {
+        // Keep the rule in sync when the caller passes a new one on recomposition.
+        this.selectableDates = selectableDates
     }
 
 /**
@@ -43,6 +65,8 @@ fun rememberAdaptiveDatePickerState(
  * @param yearRange an [IntRange] that holds the year range that the date picker will be limited
  * to
  * @param initialMaterialDisplayMode an initial [DisplayMode] that this state will hold
+ * @param initialUIKitDisplayMode an initial [UIKitDisplayMode] used by the iOS picker
+ * @param selectableDates initial value of [AdaptiveDatePickerState.selectableDates]
  * @see rememberAdaptiveDatePickerState
  * @throws [IllegalArgumentException] if the initial selected date or displayed month represent
  * a year that is out of the year range.
@@ -55,6 +79,7 @@ expect class AdaptiveDatePickerState(
     yearRange: IntRange,
     initialMaterialDisplayMode: DisplayMode,
     initialUIKitDisplayMode: UIKitDisplayMode,
+    selectableDates: SelectableDates = DatePickerDefaults.AllDates,
 ) {
     /**
      * A timestamp that represents the _start_ of the day of the selected date in _UTC_ milliseconds
@@ -87,11 +112,26 @@ expect class AdaptiveDatePickerState(
      */
     var displayMode: DisplayMode
 
+    /**
+     * The [SelectableDates] rule deciding which days can be picked. Use [DateBounds] for a
+     * minimum and maximum day, and [and] to combine rules.
+     *
+     * Honoured by the Material picker and by the iOS 16+ calendars, where rejected days are
+     * greyed out; bounds coming from a [DateBounds] are also applied natively, so the iOS wheels
+     * stop at the range. The iOS wheels picker, and the inline picker below iOS 16, cannot grey
+     * out days: a rejected day is snapped to the nearest selectable one instead. Observable:
+     * changing it updates the displayed picker, and a selection the new rule rejects is moved
+     * to the nearest selectable day. [SelectableDates.isSelectableYear] only affects Material.
+     */
+    var selectableDates: SelectableDates
+
     companion object {
         /**
          * The default [Saver] implementation for [AdaptiveDatePickerState].
+         *
+         * @param selectableDates the rule to re-attach on restore, since it cannot be saved.
          */
-        fun Saver(): Saver<AdaptiveDatePickerState, *>
+        fun Saver(selectableDates: SelectableDates = DatePickerDefaults.AllDates): Saver<AdaptiveDatePickerState, Any>
     }
 }
 
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateBounds.kt` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+import androidx.compose.runtime.Immutable
+
+/**
+ * A [SelectableDates] rule that accepts the days from [minDateMillis] to [maxDateMillis], both
+ * inclusive and compared per UTC day, so any timestamp inside the first or last day keeps that
+ * whole day selectable. A `null` bound is open on that side.
+ *
+ * Besides greying out days, the pickers apply these bounds natively: the iOS wheels stop at the
+ * range and the calendars hide the months outside it. Combine with other rules using [and].
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+@Immutable
+data class DateBounds(
+    val minDateMillis: Long? = null,
+    val maxDateMillis: Long? = null,
+) : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean =
+        isDayWithinBounds(utcTimeMillis, minDateMillis, maxDateMillis)
+
+    override fun isSelectableYear(year: Int): Boolean =
+        isYearWithinBounds(year, minDateMillis, maxDateMillis)
+}
+
+/** A rule that accepts a day, or a year, only when both this rule and [other] accept it. */
+@OptIn(ExperimentalMaterial3Api::class)
+infix fun SelectableDates.and(other: SelectableDates): SelectableDates =
+    CombinedSelectableDates(this, other)
+
+@OptIn(ExperimentalMaterial3Api::class)
+@Immutable
+internal data class CombinedSelectableDates(
+    val first: SelectableDates,
+    val second: SelectableDates,
+) : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean =
+        first.isSelectableDate(utcTimeMillis) && second.isSelectableDate(utcTimeMillis)
+
+    override fun isSelectableYear(year: Int): Boolean =
+        first.isSelectableYear(year) && second.isSelectableYear(year)
+}
+
+/**
+ * The bounds this rule enforces when it is a [DateBounds], or combines one through [and];
+ * `null` for any other rule.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal fun SelectableDates.dateBoundsOrNull(): DateBounds? =
+    when (this) {
+        is DateBounds -> this
+        is CombinedSelectableDates -> intersectOrNull(first.dateBoundsOrNull(), second.dateBoundsOrNull())
+        else -> null
+    }
+
+/** The days accepted by both this and [other]. */
+internal fun DateBounds.intersect(other: DateBounds): DateBounds =
+    DateBounds(
+        minDateMillis = tighterMin(minDateMillis, other.minDateMillis),
+        maxDateMillis = tighterMax(maxDateMillis, other.maxDateMillis),
+    )
+
+private fun intersectOrNull(first: DateBounds?, second: DateBounds?): DateBounds? =
+    when {
+        first == null -> second
+        second == null -> first
+        else -> first.intersect(second)
+    }
+
+private fun tighterMin(first: Long?, second: Long?): Long? =
+    if (first == null || second == null) first ?: second else maxOf(first, second)
+
+private fun tighterMax(first: Long?, second: Long?): Long? =
+    if (first == null || second == null) first ?: second else minOf(first, second)
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/RuleTrackingDatePickerState.kt` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerState
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+/**
+ * A [DatePickerState] that reports the rule returned by [currentRule] instead of the one it was
+ * created with.
+ *
+ * Material3 caches each day's enabled state keyed on the rule object, so the picker only
+ * notices a change when the object itself changes. Handing it the caller's rule, which is a
+ * new object whenever the rule changes, keeps the calendar in sync.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal class RuleTrackingDatePickerState(
+    delegate: DatePickerState,
+    private val currentRule: () -> SelectableDates,
+) : DatePickerState by delegate {
+    override val selectableDates: SelectableDates
+        get() = currentRule()
+}
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/SelectableDays.kt` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+internal const val MILLIS_PER_DAY = 86_400_000L
+
+/** How far, in days on each side, a snapped selection may move to find a selectable day. */
+internal const val DEFAULT_SNAP_SEARCH_DAYS = 366
+
+private const val DAYS_FROM_CIVIL_EPOCH_TO_UNIX_EPOCH = 719_468L
+private const val DAYS_PER_ERA = 146_097L
+private const val YEARS_PER_ERA = 400L
+
+/**
+ * Returns true when the UTC day containing [utcTimeMillis] lies within the inclusive
+ * [minDateMillis]..[maxDateMillis] range.
+ *
+ * Bounds are compared at day granularity, so any timestamp inside the min or max day keeps
+ * that whole day selectable. A null bound is open on that side.
+ */
+internal fun isDayWithinBounds(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Boolean {
+    val day = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val afterMin = minDateMillis == null || day >= minDateMillis.floorDiv(MILLIS_PER_DAY)
+    val beforeMax = maxDateMillis == null || day <= maxDateMillis.floorDiv(MILLIS_PER_DAY)
+    return afterMin && beforeMax
+}
+
+/**
+ * Returns true when [year] contains at least one day of the inclusive
+ * [minDateMillis]..[maxDateMillis] range. A null bound is open on that side.
+ */
+internal fun isYearWithinBounds(
+    year: Int,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Boolean {
+    val afterMin = minDateMillis == null || year >= utcYearOf(minDateMillis)
+    val beforeMax = maxDateMillis == null || year <= utcYearOf(maxDateMillis)
+    return afterMin && beforeMax
+}
+
+/**
+ * Moves the UTC day containing [utcTimeMillis] into the inclusive bounds.
+ *
+ * Returns [utcTimeMillis] unchanged when it is already inside, otherwise the _start_ of the
+ * minimum or maximum day in UTC, whichever is nearer. A null bound is open on that side.
+ */
+internal fun clampDayIntoBounds(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Long {
+    val day = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val minDay = minDateMillis?.floorDiv(MILLIS_PER_DAY)
+    val maxDay = maxDateMillis?.floorDiv(MILLIS_PER_DAY)
+    return when {
+        minDay != null && day < minDay -> minDay * MILLIS_PER_DAY
+        maxDay != null && day > maxDay -> maxDay * MILLIS_PER_DAY
+        else -> utcTimeMillis
+    }
+}
+
+/**
+ * Proleptic Gregorian year of a UTC timestamp, computed without a calendar dependency
+ * using the days-to-civil algorithm from Howard Hinnant's date algorithms.
+ */
+internal fun utcYearOf(utcTimeMillis: Long): Int {
+    val days = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val shifted = days + DAYS_FROM_CIVIL_EPOCH_TO_UNIX_EPOCH
+    val era = shifted.floorDiv(DAYS_PER_ERA)
+    val dayOfEra = shifted - era * DAYS_PER_ERA
+    val yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365
+    val dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
+    val monthIndex = (5 * dayOfYear + 2) / 153 // 0 is March, 11 is February
+    val marchBasedYear = yearOfEra + era * YEARS_PER_ERA
+    return (if (monthIndex >= 10) marchBasedYear + 1 else marchBasedYear).toInt()
+}
+
+/**
+ * Finds the selectable day nearest to [utcTimeMillis] and returns its _start_ in UTC.
+ *
+ * The day is first clamped into the bounds, then the search walks outwards one day at a
+ * time, later days first, until [selectableDates] accepts one. Returns null when no day within
+ * [maxDistanceDays] on either side is selectable.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal fun nearestSelectableDay(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+    selectableDates: SelectableDates,
+    maxDistanceDays: Int = DEFAULT_SNAP_SEARCH_DAYS,
+): Long? {
+    fun isSelectable(day: Long): Boolean {
+        val dayStart = day * MILLIS_PER_DAY
+        return isDayWithinBounds(dayStart, minDateMillis, maxDateMillis) &&
+            selectableDates.isSelectableDate(dayStart)
+    }
+
+    val startDay = clampDayIntoBounds(utcTimeMillis, minDateMillis, maxDateMillis)
+        .floorDiv(MILLIS_PER_DAY)
+    if (isSelectable(startDay)) return startDay * MILLIS_PER_DAY
+
+    for (distance in 1..maxDistanceDays) {
+        val later = startDay + distance
+        if (isSelectable(later)) return later * MILLIS_PER_DAY
+        val earlier = startDay - distance
+        if (isSelectable(earlier)) return earlier * MILLIS_PER_DAY
+    }
+    return null
+}
+
+/**
+ * The day a native picker should end up on after the user picked [pickedUtcTimeMillis]: the
+ * pick itself when [bounds] and [selectableDates] accept it, otherwise the nearest selectable
+ * day, or the pick unchanged when none is within reach.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal fun resolvePickedDay(
+    pickedUtcTimeMillis: Long,
+    bound
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateBoundsSelectableDatesTest.kt` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.ExperimentalMaterial3Api
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalMaterial3Api::class)
+class DateBoundsSelectableDatesTest {
+
+    @Test
+    fun `date bounds accept the days inside and reject the days outside`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+
+        assertFalse(march.isSelectableDate(FEB_28_2026))
+        assertTrue(march.isSelectableDate(MAR_1_2026))
+        assertTrue(march.isSelectableDate(MAR_31_2026 + NOON_OFFSET_MILLIS))
+        assertFalse(march.isSelectableDate(APR_1_2026))
+    }
+
+    @Test
+    fun `date bounds with one side open accept everything on that side`() {
+        assertTrue(DateBounds(minDateMillis = MAR_1_2026).isSelectableDate(APR_1_2026))
+        assertTrue(DateBounds(maxDateMillis = MAR_31_2026).isSelectableDate(FEB_28_2026))
+        assertTrue(DateBounds().isSelectableDate(FEB_29_2000))
+    }
+
+    @Test
+    fun `date bounds reject the years outside`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+
+        assertFalse(march.isSelectableYear(2025))
+        assertTrue(march.isSelectableYear(2026))
+        assertFalse(march.isSelectableYear(2027))
+    }
+
+    @Test
+    fun `and accepts a day only when both rules accept it`() {
+        val marchWeekdays = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026) and WeekdaysOnly
+
+        assertTrue(marchWeekdays.isSelectableDate(MAR_13_2026))
+        assertFalse(marchWeekdays.isSelectableDate(MAR_14_2026))
+        assertFalse(marchWeekdays.isSelectableDate(APR_1_2026))
+        assertFalse(marchWeekdays.isSelectableYear(2025))
+    }
+
+    @Test
+    fun `bounds are extracted from date bounds and intersected through and`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+        val fromMid = DateBounds(minDateMillis = MAR_15_2026)
+
+        assertEquals(march, march.dateBoundsOrNull())
+        assertEquals(
+            DateBounds(minDateMillis = MAR_15_2026, maxDateMillis = MAR_31_2026),
+            (march and fromMid).dateBoundsOrNull(),
+        )
+        assertEquals(march, (march and WeekdaysOnly).dateBoundsOrNull())
+        assertEquals(march, (WeekdaysOnly and march).dateBoundsOrNull())
+    }
+
+    @Test
+    fun `other rules expose no bounds`() {
+        assertNull(WeekdaysOnly.dateBoundsOrNull())
+        assertNull(DatePickerDefaults.AllDates.dateBoundsOrNull())
+        assertNull((WeekdaysOnly and NoDates).dateBoundsOrNull())
+    }
+}
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateBoundsTest.kt` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.ExperimentalMaterial3Api
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalMaterial3Api::class)
+class DateBoundsTest {
+
+    @Test
+    fun `every day is within bounds when no bounds are set`() {
+        assertTrue(isDayWithinBounds(MAR_15_2026 + NOON_OFFSET_MILLIS, minDateMillis = null, maxDateMillis = null))
+    }
+
+    @Test
+    fun `days before the minimum are rejected and the minimum day itself is accepted`() {
+        assertFalse(isDayWithinBounds(FEB_28_2026, minDateMillis = MAR_1_2026, maxDateMillis = null))
+        assertTrue(isDayWithinBounds(MAR_1_2026, minDateMillis = MAR_1_2026, maxDateMillis = null))
+    }
+
+    @Test
+    fun `days after the maximum are rejected and the maximum day itself is accepted`() {
+        assertTrue(isDayWithinBounds(MAR_31_2026, minDateMillis = null, maxDateMillis = MAR_31_2026))
+        assertFalse(isDayWithinBounds(APR_1_2026, minDateMillis = null, maxDateMillis = MAR_31_2026))
+    }
+
+    @Test
+    fun `bounds are compared at day granularity`() {
+        assertTrue(isDayWithinBounds(MAR_1_2026, minDateMillis = MAR_1_2026 + NOON_OFFSET_MILLIS, maxDateMillis = null))
+        assertTrue(isDayWithinBounds(MAR_31_2026 + NOON_OFFSET_MILLIS, minDateMillis = null, maxDateMillis = MAR_31_2026))
+    }
+
+    @Test
+    fun `years outside the bounds are rejected`() {
+        assertFalse(isYearWithinBounds(2025, minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026))
+        assertTrue(isYearWithinBounds(2026, minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026))
+        assertFalse(isYearWithinBounds(2027, minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026))
+        assertTrue(isYearWithinBounds(1999, minDateMillis = null, maxDateMillis = null))
+    }
+
+    @Test
+    fun `utc year is derived from epoch millis across year and leap boundaries`() {
+        assertEquals(1970, utcYearOf(0))
+        assertEquals(1969, utcYearOf(-1))
+        assertEquals(2000, utcYearOf(FEB_29_2000))
+        assertEquals(2024, utcYearOf(JAN_1_2025 - 1))
+        assertEquals(2025, utcYearOf(JAN_1_2025))
+        assertEquals(2026, utcYearOf(MAR_1_2026))
+    }
+
+    @Test
+    fun `clamping keeps a day inside the bounds unchanged`() {
+        assertEquals(MAR_15_2026, clampDayIntoBounds(MAR_15_2026, minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026))
+    }
+
+    @Test
+    fun `clamping moves a day before the minimum to the start of the minimum day`() {
+        assertEquals(MAR_1_2026, clampDayIntoBounds(FEB_28_2026, minDateMillis = MAR_1_2026 + NOON_OFFSET_MILLIS, maxDateMillis = null))
+    }
+
+    @Test
+    fun `clamping moves a day after the maximum to the start of the maximum day`() {
+        assertEquals(MAR_31_2026, clampDayIntoBounds(APR_1_2026, minDateMillis = null, maxDateMillis = MAR_31_2026 + NOON_OFFSET_MILLIS))
+    }
+
+    @Test
+    fun `nearest selectable day is the start of the day itself when it is selectable`() {
+        assertEquals(
+            MAR_15_2026,
+            nearestSelectableDay(MAR_15_2026 + NOON_OFFSET_MILLIS, null, null, DatePickerDefaults.AllDates),
+        )
+    }
+
+    @Test
+    fun `nearest selectable day skips the days the rule rejects`() {
+        assertEquals(MAR_13_2026, nearestSelectableDay(MAR_14_2026, null, null, WeekdaysOnly))
+        assertEquals(MAR_16_2026, nearestSelectableDay(MAR_15_2026, null, null, WeekdaysOnly))
+    }
+
+    @Test
+    fun `nearest selectable day stays inside the bounds`() {
+        assertEquals(MAR_31_2026, nearestSelectableDay(APR_1_2026, null, MAR_31_2026, DatePickerDefaults.AllDates))
+        assertEquals(MAR_1_2026, nearestSelectableDay(FEB_28_2026, MAR_1_2026, null, DatePickerDefaults.AllDates))
+    }
+
+    @Test
+    fun `nearest selectable day is null when nothing is selectable within the search window`() {
+        assertNull(nearestSelectableDay(MAR_15_2026, null, null, NoDates, maxDistanceDays = 3))
+    }
+
+    @Test
+    fun `a picked day is kept when the bounds and the rule accept it`() {
+        assertEquals(MAR_13_2026, resolvePickedDay(MAR_13_2026, DateBounds(MAR_1_2026, MAR_31_2026), WeekdaysOnly))
+    }
+
+    @Test
+    fun `a rejected pick resolves to the nearest selectable day`() {
+        assertEquals(MAR_13_2026, resolvePickedDay(MAR_14_2026, DateBounds(), WeekdaysOnly))
+        assertEquals(MAR_31_2026, resolvePickedDay(APR_1_2026, DateBounds(maxDateMillis = MAR_31_2026), DatePickerDefaults.AllDates))
+    }
+
+    @Test
+    fun `a rejected pick is kept when nothing selectable is within reach`() {
+        assertEquals(MAR_14_2026, resolvePickedDay(MAR_14_2026, DateBounds(), NoDates))
+    }
+}
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/TestDates.kt` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+/** UTC start-of-day timestamp for the given number of days since 1970-01-01. */
+internal fun utcDay(daysSinceEpoch: Long): Long = daysSinceEpoch * MILLIS_PER_DAY
+
+internal const val NOON_OFFSET_MILLIS = 12L * 60 * 60 * 1000
+
+// Day counts since 1970-01-01 (UTC) for the dates used in the date picker tests.
+// 2026-03-01 is a Sunday, so 2026-03-14 is a Saturday and 2026-03-15 a Sunday.
+internal val FEB_29_2000 = utcDay(11016)
+internal val JAN_1_2025 = utcDay(20089)
+internal val FEB_28_2026 = utcDay(20512)
+internal val MAR_1_2026 = utcDay(20513)
+internal val MAR_13_2026 = utcDay(20525)
+internal val MAR_14_2026 = utcDay(20526)
+internal val MAR_15_2026 = utcDay(20527)
+internal val MAR_16_2026 = utcDay(20528)
+internal val MAR_31_2026 = utcDay(20543)
+internal val APR_1_2026 = utcDay(20544)
+
+private const val DAYS_PER_WEEK = 7L
+private const val EPOCH_DAY_OFFSET_FROM_MONDAY = 3L // 1970-01-01 was a Thursday
+private const val SATURDAY_INDEX = 5L
+
+/** Accepts Monday to Friday only, computed from the epoch day without a calendar library. */
+@OptIn(ExperimentalMaterial3Api::class)
+internal object WeekdaysOnly : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean {
+        val dayOfWeekIndex = (utcTimeMillis.floorDiv(MILLIS_PER_DAY) + EPOCH_DAY_OFFSET_FROM_MONDAY)
+            .mod(DAYS_PER_WEEK)
+        return dayOfWeekIndex < SATURDAY_INDEX
+    }
+}
+
+/** Rejects every day. */
+@OptIn(ExperimentalMaterial3Api::class)
+internal object NoDates : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean = false
+}
```

**File**: `calf-ui/src/desktopTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDatePickerStateMaterialTest.kt` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.DisplayMode
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.saveable.SaverScope
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.assertIsEnabled
+import androidx.compose.ui.test.assertIsNotEnabled
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalMaterial3Api::class, ExperimentalTestApi::class)
+class AdaptiveDatePickerStateMaterialTest {
+
+    private val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+
+    private fun state(
+        selectableDates: SelectableDates = DatePickerDefaults.AllDates,
+    ) = AdaptiveDatePickerState(
+        initialSelectedDateMillis = null,
+        initialDisplayedMonthMillis = null,
+        yearRange = DatePickerDefaults.YearRange,
+        initialMaterialDisplayMode = DisplayMode.Picker,
+        initialUIKitDisplayMode = UIKitDisplayMode.Picker,
+        selectableDates = selectableDates,
+    )
+
+    @Test
+    fun `material selectable dates follow the rule`() {
+        val selectable = state(selectableDates = march).datePickerState.selectableDates
+
+        assertFalse(selectable.isSelectableDate(FEB_28_2026))
+        assertTrue(selectable.isSelectableDate(MAR_1_2026))
+        assertTrue(selectable.isSelectableDate(MAR_31_2026))
+        assertFalse(selectable.isSelectableDate(APR_1_2026))
+        assertFalse(selectable.isSelectableYear(2025))
+        assertTrue(selectable.isSelectableYear(2026))
+        assertFalse(selectable.isSelectableYear(2027))
+    }
+
+    @Test
+    fun `the material state exposes the current rule as a new object after a change`() {
+        val state = state()
+        val before = state.datePickerState.selectableDates
+        assertTrue(before.isSelectableDate(FEB_28_2026))
+
+        state.selectableDates = DateBounds(minDateMillis = MAR_1_2026)
+
+        val after = state.datePickerState.selectableDates
+        assertFalse(after.isSelectableDate(FEB_28_2026))
+        assertTrue(before !== after)
+    }
+
+    @Test
+    fun `changing the rule disables the rejected days in the calendar`() = runComposeUiTest {
+        var rule: SelectableDates by mutableStateOf(DatePickerDefaults.AllDates)
+        setContent {
+            val state = rememberAdaptiveDatePickerState(
+                initialSelectedDateMillis = MAR_15_2026,
+                selectableDates = rule,
+            )
+            AdaptiveDatePicker(state = state)
+        }
+        waitForIdle()
+        dayCell(MAR_14_2026).assertIsEnabled()
+
+        rule = WeekdaysOnly
+        waitForIdle()
+
+        dayCell(MAR_14_2026).assertIsNotEnabled()
+    }
+
+    @Test
+    fun `selection is clamped to the new maximum when the bounds shrink`() {
+        val state = state()
+        state.selectedDateMillis = MAR_15_2026
+
+        state.selectableDates = DateBounds(maxDateMillis = MAR_1_2026)
+
+        assertEquals(MAR_1_2026, state.selectedDateMillis)
+    }
+
+    @Test
+    fun `selection is clamped to the new minimum when the bounds shrink`() {
+        val state = state()
+        state.selectedDateMillis = FEB_28_2026
+
+        state.selectableDates = DateBounds(minDateMillis = MAR_1_2026)
+
+        assertEquals(MAR_1_2026, state.selectedDateMillis)
+    }
+
+    @Test
+    fun `selection inside the bounds is left untouched`() {
+        val state = state()
+        state.selectedDateMillis = MAR_15_2026
+
+        state.selectableDates = march
+
+        assertEquals(MAR_15_2026, state.selectedDateMillis)
+    }
+
+    @Test
+    fun `selection snaps to the nearest selectable day when the rule changes`() {
+        val state = state()
+        state.selectedDateMillis = MAR_14_2026
+
+        state.selectableDates = WeekdaysOnly
+
+        assertEquals(MAR_13_2026, state.selectedDateMillis)
+    }
+
+    @Test
+    fun `selection is kept when no selectable day is within reach`() {
+        val state = state()
+        state.selectedDateMillis = MAR_14_2026
+
+        state.selectableDates = NoDates
+
+        assertEquals(MAR_14_2026, state.selectedDateMillis)
+    }
+
+    @Test
+    fun `saver round-trips the selection and re-attaches the rule`() {
+        val saver = AdaptiveDatePickerState.Saver(march)
+        val original = state(selectableDates = march)
+        original.selectedDateMillis = MAR_15_2026
+
+        val saved = requireNotNull(with(saver) { SaverScope { true }.save(original) })
+        val restored = requireNotNull(s
```

---

### Incident Patch 5: `1554f1b7` (2026-09-12)
**Commit Message**: fix(navigation): keep each destination's saved state while it is on the back stack

AdaptiveNavHost rendered the current destination directly, so when the
user navigated away the destination's rememberSaveable state (list
positions, form input) was discarded, and coming back started from
scratch. In the sample, opening any screen and going back reset the home
list to the top.

Each destination is now composed inside a SaveableStateHolder keyed on
its route, the way Jetpack's NavHost scopes its entries, and the saved
state of routes that leave the back stack is dropped so a later visit
starts fresh.

- Tests: AdaptiveNavHostStateTest (desktopTest, Compose UI): state
  survives navigating away and back, and is dropped after a pop

**File**: `calf-navigation/build.gradle.kts` (modified, +9/-0)
```diff
@@ -8,6 +8,15 @@ kotlin {
         implementation(libs.compose.material3)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.android.navigation.compose)
     }
```

**File**: `calf-navigation/src/commonMain/kotlin/com.mohamedrejeb.calf/navigation/AdaptiveNavHost.kt` (modified, +28/-2)
```diff
@@ -3,7 +3,10 @@ package com.mohamedrejeb.calf.navigation
 import androidx.compose.foundation.layout.Box
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.saveable.SaveableStateHolder
+import androidx.compose.runtime.saveable.rememberSaveableStateHolder
 import androidx.compose.ui.Modifier
 
 @Composable
@@ -28,11 +31,34 @@ fun AdaptiveNavHost(
             navController.navigate(startDestination)
     }
 
+    // Keeps each destination's `rememberSaveable` state (list positions, form input) while the
+    // destination stays on the back stack, so coming back restores it.
+    val saveableStateHolder = rememberSaveableStateHolder()
+    ForgetPoppedDestinations(navController, saveableStateHolder)
+
     Box(modifier = modifier) {
         navController.currentDestination?.let { currentDestination ->
             graphBuilder.destinations.find { it.route == currentDestination }?.let { destination ->
-                destination.content(destination.arguments)
+                saveableStateHolder.SaveableStateProvider(key = currentDestination) {
+                    destination.content(destination.arguments)
+                }
             }
         }
     }
-}
\ No newline at end of file
+}
+
+/** Drops the saved state of destinations that left the back stack, so a later visit starts fresh. */
+@Composable
+private fun ForgetPoppedDestinations(
+    navController: AdaptiveNavHostController,
+    saveableStateHolder: SaveableStateHolder,
+) {
+    val routesOnStack = navController.backStack.toSet()
+    val retainedRoutes = remember { mutableSetOf<String>() }
+
+    SideEffect {
+        (retainedRoutes - routesOnStack).forEach(saveableStateHolder::removeState)
+        retainedRoutes.clear()
+        retainedRoutes.addAll(routesOnStack)
+    }
+}
```

**File**: `calf-navigation/src/desktopTest/kotlin/com/mohamedrejeb/calf/navigation/AdaptiveNavHostStateTest.kt` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+package com.mohamedrejeb.calf.navigation
+
+import androidx.compose.material3.Button
+import androidx.compose.material3.Text
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.saveable.rememberSaveable
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.performClick
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+
+private const val HOME = "home"
+private const val DETAIL = "detail"
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveNavHostStateTest {
+
+
+    @Test
+    fun `saveable state of a destination survives navigating away and back`() = runComposeUiTest {
+        lateinit var navController: AdaptiveNavHostController
+        setContent {
+            navController = rememberNavController()
+            AdaptiveNavHost(navController = navController, startDestination = HOME) {
+                composable(HOME) { Counter(label = HOME) }
+                composable(DETAIL) { Text(DETAIL) }
+            }
+        }
+        waitForIdle()
+
+        onNodeWithText("$HOME 0").performClick()
+        onNodeWithText("$HOME 1").assertIsDisplayed()
+
+        navController.navigate(DETAIL)
+        waitForIdle()
+        onNodeWithText(DETAIL).assertIsDisplayed()
+
+        navController.popBackStack()
+        waitForIdle()
+
+        onNodeWithText("$HOME 1").assertIsDisplayed()
+    }
+
+    @Test
+    fun `saveable state of a popped destination is dropped`() = runComposeUiTest {
+        lateinit var navController: AdaptiveNavHostController
+        setContent {
+            navController = rememberNavController()
+            AdaptiveNavHost(navController = navController, startDestination = HOME) {
+                composable(HOME) { Text(HOME) }
+                composable(DETAIL) { Counter(label = DETAIL) }
+            }
+        }
+        waitForIdle()
+
+        navController.navigate(DETAIL)
+        waitForIdle()
+        onNodeWithText("$DETAIL 0").performClick()
+        onNodeWithText("$DETAIL 1").assertIsDisplayed()
+
+        navController.popBackStack()
+        waitForIdle()
+        navController.navigate(DETAIL)
+        waitForIdle()
+
+        onNodeWithText("$DETAIL 0").assertIsDisplayed()
+    }
+}
+
+@androidx.compose.runtime.Composable
+private fun Counter(label: String) {
+    var count by rememberSaveable { mutableStateOf(0) }
+    Button(onClick = { count++ }) {
+        Text("$label $count")
+    }
+}
```

---

### Incident Patch 6: `5d31147d` (2026-09-12)
**Commit Message**: feat(ui): add AdaptiveDateRangePicker

A range picker with its own AdaptiveDateRangePickerState: one common
class wrapping Material3's DateRangePickerState on every platform, with
the same selectable-dates rule as the single-date pickers. The Material3
state is wrapped so it reports the caller's rule object, which keeps the
Material3 picker in sync when the rule changes.

- Material: the Material3 DateRangePicker. It scrolls its months and
  cannot take an unbounded height, so inside a scrolling column it falls
  back to DateRangePickerFallbackHeight instead of crashing
- iOS 16+: a native UICalendarView with multi-date selection driven by a
  pure DateRangeSelection reducer (first tap sets the start, a tap on or
  after it sets the end, a tap before it moves the start, any tap on a
  complete range starts over); every day of the range is highlighted and
  rejected days are greyed out. Below iOS 16 the Material3 picker is shown
- iOS: the UICalendarView setup, including the refresh of visible days
  after rule changes, moves into a CalendarViewHost shared by the
  single-date and range calendars
- Tests: DateRangeSelectionTest (commonTest) and
  AdaptiveDateRangePickerStateTest (de

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDateRangePicker.kt` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.foundation.layout.BoxWithConstraints
+import androidx.compose.foundation.layout.PaddingValues
+import androidx.compose.foundation.layout.height
+import androidx.compose.material3.DatePickerColors
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.DatePickerFormatter
+import androidx.compose.material3.DateRangePicker
+import androidx.compose.material3.DateRangePickerState
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.remember
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.unit.Dp
+import androidx.compose.ui.unit.dp
+
+/**
+ * A date range picker that adapts to the platform it is running on.
+ *
+ * On Material platforms it is the Material3 `DateRangePicker`. On iOS 16+ it is a native
+ * `UICalendarView`: the first tap picks the start, a tap on or after it picks the end, a tap
+ * before it moves the start, and any tap on a completed range starts a new one. Below iOS 16
+ * the Material3 picker is shown.
+ *
+ * @param state the state that holds the selected range and the selectable dates.
+ * @param modifier the modifier applied to the picker.
+ * @param dateFormatter formats dates on Material platforms.
+ * @param title the title slot on Material platforms; hidden when `null`.
+ * @param headline the headline slot on Material platforms; hidden when `null`.
+ * @param showModeToggle whether Material platforms offer the text input mode.
+ * @param colors colors of the picker; the selected day color tints the native iOS calendar.
+ *
+ * On Material platforms the picker scrolls through months, so it needs a bounded height. When
+ * the parent gives none, for example inside a vertically scrolling column, it falls back to
+ * [DateRangePickerFallbackHeight]; pass a `height` modifier to choose your own.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+@Composable
+expect fun AdaptiveDateRangePicker(
+    state: AdaptiveDateRangePickerState,
+    modifier: Modifier = Modifier,
+    dateFormatter: DatePickerFormatter = remember { DatePickerDefaults.dateFormatter() },
+    title: (@Composable () -> Unit)? = null,
+    headline: (@Composable () -> Unit)? = null,
+    showModeToggle: Boolean = true,
+    colors: DatePickerColors = DatePickerDefaults.colors(),
+)
+
+/** Height of the Material range picker when its parent gives no vertical bound. */
+val DateRangePickerFallbackHeight: Dp = 568.dp
+
+/** Paddings of the Material3 range picker defaults, which Material3 keeps private. */
+internal val DateRangePickerTitlePadding = PaddingValues(start = 64.dp, end = 12.dp)
+internal val DateRangePickerHeadlinePadding = PaddingValues(start = 64.dp, end = 12.dp, bottom = 12.dp)
+
+/** The Material3 range picker bound to [state]; shared by Material platforms and the iOS fallback. */
+@OptIn(ExperimentalMaterial3Api::class)
+@Composable
+internal fun MaterialDateRangePicker(
+    state: AdaptiveDateRangePickerState,
+    modifier: Modifier,
+    dateFormatter: DatePickerFormatter,
+    title: (@Composable () -> Unit)?,
+    headline: (@Composable () -> Unit)?,
+    showModeToggle: Boolean,
+    colors: DatePickerColors,
+) {
+    BoundedMaterial3DateRangePicker(
+        state = state.dateRangePickerState,
+        modifier = modifier,
+        dateFormatter = dateFormatter,
+        title = title,
+        headline = headline,
+        showModeToggle = showModeToggle,
+        colors = colors,
+    )
+}
+
+/** A Material3 range picker that falls back to [DateRangePickerFallbackHeight] under an unbounded height. */
+@OptIn(ExperimentalMaterial3Api::class)
+@Composable
+internal fun BoundedMaterial3DateRangePicker(
+    state: DateRangePickerState,
+    modifier: Modifier,
+    dateFormatter: DatePickerFormatter,
+    title: (@Composable () -> Unit)?,
+    headline: (@Composable () -> Unit)?,
+    showModeToggle: Boolean,
+    colors: DatePickerColors,
+) {
+    // Material3's DateRangePicker scrolls its months and throws under an unbounded height.
+    BoxWithConstraints(modifier = modifier) {
+        val boundedHeight = if (maxHeight == Dp.Infinity) {
+            Modifier.height(DateRangePickerFallbackHeight)
+        } else {
+            Modifier
+        }
+        DateRangePicker(
+            state = state,
+            modifier = boundedHeight,
+            dateFormatter = dateFormatter,
+            colors = colors,
+            title = title,
+            headline = headline,
+            showModeToggle = showModeToggle,
+        )
+    }
+}
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDateRangePickerState.kt` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.DateRangePickerState
+import androidx.compose.material3.DisplayMode
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.Stable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.saveable.Saver
+import androidx.compose.runtime.saveable.listSaver
+import androidx.compose.runtime.saveable.rememberSaveable
+import androidx.compose.runtime.setValue
+
+/**
+ * Creates and remembers an [AdaptiveDateRangePickerState].
+ *
+ * @param initialSelectedStartDateMillis timestamp in _UTC_ milliseconds from the epoch of the
+ * initial start date, or `null` for no selection.
+ * @param initialSelectedEndDateMillis timestamp in _UTC_ milliseconds from the epoch of the
+ * initial end date, or `null` for no end date. Requires a start date.
+ * @param initialDisplayedMonthMillis timestamp in _UTC_ milliseconds from the epoch of the month
+ * to display first; the current month when `null`.
+ * @param yearRange the years the picker is limited to.
+ * @param initialMaterialDisplayMode the initial [DisplayMode] on Material platforms.
+ * @param selectableDates the rule deciding which days can be picked, see
+ * [AdaptiveDateRangePickerState.selectableDates]. Use [DateBounds] for a minimum and maximum
+ * day and [and] to combine rules. Pass a stable instance.
+ */
+@Composable
+@ExperimentalMaterial3Api
+fun rememberAdaptiveDateRangePickerState(
+    initialSelectedStartDateMillis: Long? = null,
+    initialSelectedEndDateMillis: Long? = null,
+    initialDisplayedMonthMillis: Long? = initialSelectedStartDateMillis,
+    yearRange: IntRange = DatePickerDefaults.YearRange,
+    initialMaterialDisplayMode: DisplayMode = DisplayMode.Picker,
+    selectableDates: SelectableDates = DatePickerDefaults.AllDates,
+): AdaptiveDateRangePickerState =
+    rememberSaveable(
+        saver = AdaptiveDateRangePickerState.Saver(selectableDates),
+    ) {
+        AdaptiveDateRangePickerState(
+            initialSelectedStartDateMillis = initialSelectedStartDateMillis,
+            initialSelectedEndDateMillis = initialSelectedEndDateMillis,
+            initialDisplayedMonthMillis = initialDisplayedMonthMillis,
+            yearRange = yearRange,
+            initialMaterialDisplayMode = initialMaterialDisplayMode,
+            selectableDates = selectableDates,
+        )
+    }.apply {
+        // Keep the rule in sync when the caller passes a new one on recomposition.
+        this.selectableDates = selectableDates
+    }
+
+/**
+ * State of an [AdaptiveDateRangePicker]: the selected start and end days plus the selectable
+ * range. It wraps a Material3 [DateRangePickerState] on every platform.
+ *
+ * Unlike [AdaptiveDatePickerState], a range is not adjusted automatically when the rule
+ * changes; it is validated when set, see [setSelection].
+ *
+ * @param initialSelectedStartDateMillis see [rememberAdaptiveDateRangePickerState].
+ * @param initialSelectedEndDateMillis see [rememberAdaptiveDateRangePickerState].
+ * @param initialDisplayedMonthMillis see [rememberAdaptiveDateRangePickerState].
+ * @param yearRange the years the picker is limited to.
+ * @param initialMaterialDisplayMode the initial [DisplayMode] on Material platforms.
+ * @param selectableDates initial value of [selectableDates].
+ * Initial dates are validated like [setSelection]: a missing or out-of-range start leaves the
+ * selection empty, and an end before the start does too.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+@Stable
+class AdaptiveDateRangePickerState(
+    initialSelectedStartDateMillis: Long?,
+    initialSelectedEndDateMillis: Long?,
+    initialDisplayedMonthMillis: Long?,
+    val yearRange: IntRange,
+    initialMaterialDisplayMode: DisplayMode,
+    selectableDates: SelectableDates = DatePickerDefaults.AllDates,
+) {
+    /**
+     * The [SelectableDates] rule deciding which days can be picked. Use [DateBounds] for a
+     * minimum and maximum day, and [and] to combine rules. Honoured by the Material picker and
+     * by the iOS 16+ calendar, where rejected days are greyed out; bounds coming from a
+     * [DateBounds] are also applied natively. [SelectableDates.isSelectableYear] only affects
+     * Material. Observable.
+     */
+    var selectableDates: SelectableDates by mutableStateOf(selectableDates)
+
+    /** The bounds the rule enforces natively; open on both sides for rules without bounds. */
+    internal val dateBounds: DateBounds
+        get() = selectableDates.dateBoundsOrNull() ?: DateBounds()
+
+    private val materialState: DateRangePickerState =
+        DateRangePickerState(
+            locale = getCalendarLocalDefault(),
+            initialSelectedStartDateMillis
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateRangeSelection.kt` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+/**
+ * The start and end of a date range as UTC start-of-day timestamps, and how taps on a
+ * calendar change it: the first tap sets the start, a tap on or after the start sets the end,
+ * a tap before the start moves the start, and any tap on a completed range starts over.
+ */
+internal data class DateRangeSelection(
+    val start: Long?,
+    val end: Long?,
+) {
+    fun afterTap(utcTimeMillis: Long): DateRangeSelection {
+        val currentStart = start
+        return when {
+            currentStart == null || end != null -> DateRangeSelection(start = utcTimeMillis, end = null)
+            utcTimeMillis < currentStart -> DateRangeSelection(start = utcTimeMillis, end = null)
+            else -> DateRangeSelection(start = currentStart, end = utcTimeMillis)
+        }
+    }
+
+    /** Every day of the range as UTC start-of-day timestamps; only the start while the end is unset. */
+    fun days(): List<Long> {
+        val firstDay = start?.floorDiv(MILLIS_PER_DAY) ?: return emptyList()
+        val lastDay = end?.floorDiv(MILLIS_PER_DAY) ?: firstDay
+        return (firstDay..lastDay).map { day -> day * MILLIS_PER_DAY }
+    }
+}
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/RuleTrackingDateRangePickerState.kt` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DateRangePickerState
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+/**
+ * A [DateRangePickerState] that reports the rule returned by [currentRule] instead of the one
+ * it was created with, for the same reason as [RuleTrackingDatePickerState].
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal class RuleTrackingDateRangePickerState(
+    delegate: DateRangePickerState,
+    private val currentRule: () -> SelectableDates,
+) : DateRangePickerState by delegate {
+    override val selectableDates: SelectableDates
+        get() = currentRule()
+}
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateRangeSelectionTest.kt` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class DateRangeSelectionTest {
+
+    @Test
+    fun `first tap starts a new range`() {
+        assertEquals(
+            DateRangeSelection(start = MAR_14_2026, end = null),
+            DateRangeSelection(start = null, end = null).afterTap(MAR_14_2026),
+        )
+    }
+
+    @Test
+    fun `tapping after the start completes the range`() {
+        assertEquals(
+            DateRangeSelection(start = MAR_14_2026, end = MAR_16_2026),
+            DateRangeSelection(start = MAR_14_2026, end = null).afterTap(MAR_16_2026),
+        )
+    }
+
+    @Test
+    fun `tapping the start day again makes a single-day range`() {
+        assertEquals(
+            DateRangeSelection(start = MAR_14_2026, end = MAR_14_2026),
+            DateRangeSelection(start = MAR_14_2026, end = null).afterTap(MAR_14_2026),
+        )
+    }
+
+    @Test
+    fun `tapping before the start moves the start`() {
+        assertEquals(
+            DateRangeSelection(start = MAR_13_2026, end = null),
+            DateRangeSelection(start = MAR_14_2026, end = null).afterTap(MAR_13_2026),
+        )
+    }
+
+    @Test
+    fun `tapping while a range is complete starts over`() {
+        assertEquals(
+            DateRangeSelection(start = MAR_1_2026, end = null),
+            DateRangeSelection(start = MAR_14_2026, end = MAR_16_2026).afterTap(MAR_1_2026),
+        )
+    }
+
+    @Test
+    fun `days in range lists every day start from start to end inclusive`() {
+        assertEquals(
+            listOf(MAR_13_2026, MAR_14_2026, MAR_15_2026, MAR_16_2026),
+            DateRangeSelection(start = MAR_13_2026, end = MAR_16_2026).days(),
+        )
+        assertEquals(listOf(MAR_14_2026), DateRangeSelection(start = MAR_14_2026, end = null).days())
+        assertEquals(emptyList(), DateRangeSelection(start = null, end = null).days())
+    }
+}
```

**File**: `calf-ui/src/desktopTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDateRangePickerStateTest.kt` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.rememberScrollState
+import androidx.compose.foundation.verticalScroll
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.DisplayMode
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.saveable.SaverScope
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.assertIsEnabled
+import androidx.compose.ui.test.assertIsNotEnabled
+import androidx.compose.ui.test.hasContentDescription
+import androidx.compose.ui.test.hasText
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalMaterial3Api::class, ExperimentalTestApi::class)
+class AdaptiveDateRangePickerStateTest {
+
+    private val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+
+    private fun state(
+        selectableDates: SelectableDates = DatePickerDefaults.AllDates,
+    ) = AdaptiveDateRangePickerState(
+        initialSelectedStartDateMillis = null,
+        initialSelectedEndDateMillis = null,
+        initialDisplayedMonthMillis = null,
+        yearRange = DatePickerDefaults.YearRange,
+        initialMaterialDisplayMode = DisplayMode.Picker,
+        selectableDates = selectableDates,
+    )
+
+    @Test
+    fun `selection exposes start and end`() {
+        val state = state()
+
+        state.setSelection(MAR_13_2026, MAR_16_2026)
+
+        assertEquals(MAR_13_2026, state.selectedStartDateMillis)
+        assertEquals(MAR_16_2026, state.selectedEndDateMillis)
+    }
+
+    @Test
+    fun `an end before the start clears the selection`() {
+        val state = state()
+        state.setSelection(MAR_13_2026, MAR_16_2026)
+
+        state.setSelection(MAR_16_2026, MAR_13_2026)
+
+        assertNull(state.selectedStartDateMillis)
+        assertNull(state.selectedEndDateMillis)
+    }
+
+    @Test
+    fun `selectable dates follow the bounds and the rule`() {
+        val selectable = state(selectableDates = march and WeekdaysOnly).dateRangePickerState.selectableDates
+
+        assertFalse(selectable.isSelectableDate(FEB_28_2026))
+        assertTrue(selectable.isSelectableDate(MAR_13_2026))
+        assertFalse(selectable.isSelectableDate(MAR_14_2026))
+        assertFalse(selectable.isSelectableDate(APR_1_2026))
+        assertFalse(selectable.isSelectableYear(2025))
+        assertTrue(selectable.isSelectableYear(2026))
+    }
+
+    @Test
+    fun `the material state exposes the current rule as a new object after a change`() {
+        val state = state()
+        val before = state.dateRangePickerState.selectableDates
+        assertTrue(before.isSelectableDate(FEB_28_2026))
+
+        state.selectableDates = DateBounds(minDateMillis = MAR_1_2026)
+
+        val after = state.dateRangePickerState.selectableDates
+        assertFalse(after.isSelectableDate(FEB_28_2026))
+        assertTrue(before !== after)
+    }
+
+    @Test
+    fun `changing the rule disables the rejected days in the range calendar`() = runComposeUiTest {
+        var rule: SelectableDates by mutableStateOf(DatePickerDefaults.AllDates)
+        setContent {
+            val state = rememberAdaptiveDateRangePickerState(
+                initialSelectedStartDateMillis = MAR_15_2026,
+                selectableDates = rule,
+            )
+            AdaptiveDateRangePicker(state = state)
+        }
+        waitForIdle()
+        dayCell(MAR_14_2026).assertIsEnabled()
+
+        rule = WeekdaysOnly
+        waitForIdle()
+
+        dayCell(MAR_14_2026).assertIsNotEnabled()
+    }
+
+    @Test
+    fun `saver round-trips the selection and re-attaches the rule`() {
+        val saver = AdaptiveDateRangePickerState.Saver(march)
+        val original = state(selectableDates = march)
+        original.setSelection(MAR_13_2026, MAR_16_2026)
+
+        val saved = requireNotNull(with(saver) { SaverScope { true }.save(original) })
+        val restored = requireNotNull(saver.restore(saved))
+
+        assertEquals(MAR_13_2026, restored.selectedStartDateMillis)
+        assertEquals(MAR_16_2026, restored.selectedEndDateMillis)
+        assertEquals(march, restored.selectableDates)
+        assertNull(state().selectedStartDateMillis)
+    }
+
+    @Test
+    fun `a rule can reject a year inside the bounds`() {
+        val noYear2026 = object : SelectableDates {
+            override fun isSelectableYear(year: Int): Boolean = year != 2026
+        }
+        val selectable = state(selectableDates = noYear202
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDateRangePicker.ios.kt` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.foundation.background
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.aspectRatio
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.material3.DatePickerColors
+import androidx.compose.material3.DatePickerFormatter
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.LocalAbsoluteTonalElevation
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.key
+import androidx.compose.runtime.remember
+import androidx.compose.ui.ExperimentalComposeUiApi
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.platform.LocalLayoutDirection
+import androidx.compose.ui.viewinterop.UIKitInteropInteractionMode
+import androidx.compose.ui.viewinterop.UIKitInteropProperties
+import androidx.compose.ui.viewinterop.UIKitView
+import com.mohamedrejeb.calf.ui.utils.applyLayoutDirection
+import com.mohamedrejeb.calf.ui.utils.isIOSVersionAtLeast
+import com.mohamedrejeb.calf.ui.utils.surfaceColorAtElevation
+
+@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
+@Composable
+actual fun AdaptiveDateRangePicker(
+    state: AdaptiveDateRangePickerState,
+    modifier: Modifier,
+    dateFormatter: DatePickerFormatter,
+    title: (@Composable () -> Unit)?,
+    headline: (@Composable () -> Unit)?,
+    showModeToggle: Boolean,
+    colors: DatePickerColors,
+) {
+    if (!isIOSVersionAtLeast(FIRST_IOS_WITH_CALENDAR_VIEW)) {
+        MaterialDateRangePicker(
+            state = state,
+            modifier = modifier,
+            dateFormatter = dateFormatter,
+            title = title,
+            headline = headline,
+            showModeToggle = showModeToggle,
+            colors = colors,
+        )
+        return
+    }
+
+    // Recreated if a different state is passed, so taps never reach a stale state.
+    val backend = remember(state) {
+        CalendarRangePickerBackend(
+            initialSelection = DateRangeSelection(
+                start = state.selectedStartDateMillis,
+                end = state.selectedEndDateMillis,
+            ),
+            onSelectionChanged = { selection ->
+                state.setSelection(selection.start, selection.end)
+            },
+            isDaySelectable = { dateMillis ->
+                state.isDaySelectable(dateMillis)
+            },
+        )
+    }
+    val aspectRatio = remember(backend) {
+        backend.aspectRatio.takeIf { it > 0f } ?: inlineDatePickerAspectRatio()
+    }
+
+    val layoutDirection = LocalLayoutDirection.current
+    val absoluteElevation = LocalAbsoluteTonalElevation.current
+    val containerColorAtElevation = surfaceColorAtElevation(
+        color = colors.containerColor,
+        elevation = absoluteElevation,
+    )
+
+    LaunchedEffect(layoutDirection) {
+        backend.view.applyLayoutDirection(layoutDirection)
+    }
+
+    LaunchedEffect(state.selectableDates) {
+        val bounds = state.dateBounds
+        backend.applyDateBounds(bounds.minDateMillis, bounds.maxDateMillis)
+    }
+
+    LaunchedEffect(state.selectedStartDateMillis, state.selectedEndDateMillis) {
+        backend.setSelectedRange(
+            DateRangeSelection(
+                start = state.selectedStartDateMillis,
+                end = state.selectedEndDateMillis,
+            ),
+        )
+    }
+
+    LaunchedEffect(colors, containerColorAtElevation) {
+        backend.applyColors(
+            containerColor = containerColorAtElevation,
+            dayContentColor = colors.dayContentColor,
+            selectedDayContainerColor = colors.selectedDayContainerColor,
+        )
+    }
+
+    Box(modifier = modifier) {
+        key(backend) {
+            UIKitView(
+                factory = { backend.view },
+                properties = UIKitInteropProperties(
+                    interactionMode = UIKitInteropInteractionMode.NonCooperative,
+                ),
+                modifier = Modifier
+                    .background(colors.containerColor)
+                    .fillMaxWidth()
+                    .aspectRatio(aspectRatio),
+            )
+        }
+    }
+}
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/CalendarDatePickerBackend.kt` (modified, +11/-81)
```diff
@@ -4,31 +4,13 @@ package com.mohamedrejeb.calf.ui.datepicker
 
 import kotlinx.cinterop.ExperimentalForeignApi
 import kotlinx.cinterop.ObjCSignatureOverride
-import kotlinx.datetime.DateTimeUnit
-import kotlinx.datetime.LocalDate
-import kotlinx.datetime.minus
-import kotlinx.datetime.number
-import kotlinx.datetime.plus
-import platform.Foundation.NSCalendar
-import platform.Foundation.NSDate
 import platform.Foundation.NSDateComponents
-import platform.Foundation.NSDateInterval
-import platform.Foundation.NSTimeZone
-import platform.Foundation.distantFuture
-import platform.Foundation.distantPast
-import platform.Foundation.localTimeZone
 import platform.UIKit.UICalendarSelectionSingleDate
 import platform.UIKit.UICalendarSelectionSingleDateDelegateProtocol
-import platform.UIKit.UICalendarView
-import platform.UIKit.UICalendarViewDecoration
-import platform.UIKit.UICalendarViewDelegateProtocol
 import platform.UIKit.UIColor
 import platform.UIKit.UIView
 import platform.darwin.NSObject
 
-private const val MAX_SUPPORTED_YEAR = 9999L
-private const val MAX_MONTH = 12L
-
 /**
  * Inline calendar backed by `UICalendarView` (iOS 16+). Days rejected by [isDaySelectable]
  * are greyed out and cannot be tapped, matching the Material picker.
@@ -39,7 +21,7 @@ internal class CalendarDatePickerBackend(
     private val isDaySelectable: (utcTimeMillis: Long) -> Boolean,
 ) : IosDatePickerBackend {
 
-    private val calendarView = UICalendarView()
+    private val host = CalendarViewHost()
 
     private val selectionDelegate = object : NSObject(), UICalendarSelectionSingleDateDelegateProtocol {
         @ObjCSignatureOverride
@@ -62,93 +44,41 @@ internal class CalendarDatePickerBackend(
 
     private val selection = UICalendarSelectionSingleDate(delegate = selectionDelegate)
 
-    /** Draws no decorations, but lets [refresh] ask the calendar to rebuild its day cells. */
-    private val decorationDelegate = object : NSObject(), UICalendarViewDelegateProtocol {
-        @ObjCSignatureOverride
-        override fun calendarView(
-            calendarView: UICalendarView,
-            decorationForDateComponents: NSDateComponents,
-        ): UICalendarViewDecoration? = null
-    }
-
     override val view: UIView
-        get() = calendarView
+        get() = host.calendarView
 
     init {
-        calendarView.calendar = NSCalendar.currentCalendar
-        calendarView.locale = getCalendarLocalDefault()
-        calendarView.timeZone = NSTimeZone.localTimeZone
-        calendarView.delegate = decorationDelegate
-        calendarView.selectionBehavior = selection
+        host.calendarView.selectionBehavior = selection
         initialSelectedDateMillis?.let { millis ->
             selection.setSelectedDate(utcDayToDateComponents(millis), animated = false)
-            calendarView.setVisibleDateComponents(utcDayToDateComponents(millis), animated = false)
+            host.showMonth(millis, animated = false)
         }
-        calendarView.sizeToFit()
+        host.calendarView.sizeToFit()
     }
 
     override fun setSelectedDate(utcTimeMillis: Long?) {
         val current = selection.selectedDate?.toUtcDayMillis()
         if (current == utcTimeMillis) return
 
         selection.setSelectedDate(utcTimeMillis?.let(::utcDayToDateComponents), animated = true)
-        utcTimeMillis?.let { millis ->
-            calendarView.setVisibleDateComponents(utcDayToDateComponents(millis), animated = true)
-        }
+        utcTimeMillis?.let { millis -> host.showMonth(millis, animated = true) }
     }
 
     override fun applyDateBounds(minDateMillis: Long?, maxDateMillis: Long?) {
-        val start = minDateMillis?.let(::localStartOfDay) ?: NSDate.distantPast
-        val end = maxDateMillis?.let(::localEndOfDay) ?: NSDate.distantFuture
-        calendarView.availableDateRange = NSDateInterval(startDate = start, endDate = end)
+        host.applyDateBounds(minDateMillis, maxDateMillis)
     }
 
     override fun updateSelectableDates() {
         selection.updateSelectableDates()
-        refresh()
+        host.refresh()
     }
 
     override fun setEnabled(enabled: Boolean) {
-        calendarView.userInteractionEnabled = enabled
-    }
-
-    /**
-     * Rebuilds the days around the visible month, so bounds and rule changes show right away
-     * instead of on the next scroll or tap.
-     */
-    private fun refresh() {
-        val days = daysAroundVisibleMonth()
-        if (days.isNotEmpty()) {
-            calendarView.reloadDecorationsForDateComponents(days, animated = false)
-        }
-        calendarView.setNeedsLayout()
-        calendarView.layoutIfNeeded()
-    }
-
-    /** Every day of the visible month and its two neighbours, which may be partly on screen. */
-    private fun daysAroundVisibleMonth(): List<NSDateComponents> {
-        val visible = calendarView.visibleDateComponents
-        val year = visible.year
-        val month = visible.month
-        if (year !in 1..MAX_SUPPORTED_YEA
```

---

### Incident Patch 7: `15183749` (2026-09-12)
**Commit Message**: feat(ui): add AdaptiveCompactDatePicker

A field showing the selected date that opens the calendar on tap,
sharing AdaptiveDatePickerState with the inline picker so the
selectable-dates rule applies unchanged.

- Material: an outlined button opens a DatePickerDialog that edits a
  scratch state, so the shared state only changes on confirm; dismiss or
  tapping outside discards the pick
- iOS: the system compact UIDatePicker, which pops its calendar over the
  content. Bounds coming from a DateBounds apply natively; the control
  cannot grey out days any other rule rejects, so such a pick snaps to
  the nearest selectable day
- iOS: DatePickerManager gains presentations (inline, wheels, compact),
  an enabled flag and an intrinsic size that is measured again after
  each selection because the compact label resizes
- iOS: the state-to-native sync composable is shared by the inline and
  compact pickers, and native pickers are keyed on their state so taps
  never reach a stale instance
- Tests: AdaptiveCompactDatePickerMaterialTest (desktopTest, Compose UI,
  incl. picking a day in the dialog)
- Docs: compact picker section; sample gains a compact section

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveCompactDatePicker.kt` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerColors
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.DatePickerFormatter
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.remember
+import androidx.compose.ui.Modifier
+
+/**
+ * A compact date picker that shows the selected date and opens the full picker on tap.
+ *
+ * On iOS this is the system compact `UIDatePicker`, which pops its calendar over the content.
+ * It applies bounds coming from a [DateBounds] natively, but cannot grey out days any other rule
+ * rejects: such a pick snaps to the nearest selectable day. On Material platforms it is an
+ * outlined button showing the formatted date that opens a `DatePickerDialog` holding a Material3
+ * `DatePicker`. Both share [state], including its selectable-dates rule.
+ *
+ * @param state the state that holds the selection and the selectable range.
+ * @param modifier the modifier applied to the field.
+ * @param enabled whether the user can open the picker.
+ * @param dateFormatter formats the date shown in the field and the dialog on Material platforms.
+ * @param colors colors of the picker; the selected day color tints the native iOS control.
+ * @param materialPlaceholder text shown in the field on Material platforms while nothing is
+ * selected; the iOS control always shows a date.
+ * @param materialConfirmText label of the dialog button that keeps the selection on Material platforms.
+ * @param materialDismissText label of the dialog button that discards the day picked in the
+ * dialog on Material platforms. Dismissing the dialog by tapping outside behaves the same way.
+ * The shared [state] only changes when the dialog is confirmed.
+ * @param materialTitle the dialog title slot on Material platforms. Unlike [AdaptiveDatePicker],
+ * `null` shows the Material3 default rather than hiding it, because a dialog needs a header.
+ * @param materialHeadline the dialog headline slot on Material platforms; `null` shows the
+ * Material3 default, which displays the day picked so far.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+@Composable
+expect fun AdaptiveCompactDatePicker(
+    state: AdaptiveDatePickerState,
+    modifier: Modifier = Modifier,
+    enabled: Boolean = true,
+    dateFormatter: DatePickerFormatter = remember { DatePickerDefaults.dateFormatter() },
+    colors: DatePickerColors = DatePickerDefaults.colors(),
+    materialPlaceholder: String = "Select date",
+    materialConfirmText: String = "OK",
+    materialDismissText: String = "Cancel",
+    materialTitle: (@Composable () -> Unit)? = null,
+    materialHeadline: (@Composable () -> Unit)? = null,
+)
```

**File**: `calf-ui/src/desktopTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveCompactDatePickerMaterialTest.kt` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.DisplayMode
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.assertCountEquals
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.assertIsNotEnabled
+import androidx.compose.ui.test.onAllNodesWithText
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.performClick
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+private const val PLACEHOLDER = "Pick a date"
+private const val CONFIRM = "Done"
+private const val DISMISS = "Back"
+
+@OptIn(ExperimentalMaterial3Api::class, ExperimentalTestApi::class)
+class AdaptiveCompactDatePickerMaterialTest {
+
+    private val formatter = DatePickerDefaults.dateFormatter()
+
+    private fun state(selectedDateMillis: Long? = null) = AdaptiveDatePickerState(
+        initialSelectedDateMillis = selectedDateMillis,
+        initialDisplayedMonthMillis = selectedDateMillis,
+        yearRange = DatePickerDefaults.YearRange,
+        initialMaterialDisplayMode = DisplayMode.Picker,
+        initialUIKitDisplayMode = UIKitDisplayMode.Picker,
+    )
+
+    private fun fieldLabel(utcTimeMillis: Long): String =
+        requireNotNull(formatter.formatDate(utcTimeMillis, getCalendarLocalDefault()))
+
+    @Test
+    fun `shows the placeholder while nothing is selected`() = runComposeUiTest {
+        setContent {
+            AdaptiveCompactDatePicker(state = state(), materialPlaceholder = PLACEHOLDER)
+        }
+
+        onNodeWithText(PLACEHOLDER).assertIsDisplayed()
+    }
+
+    @Test
+    fun `shows the formatted selected date`() = runComposeUiTest {
+        setContent {
+            AdaptiveCompactDatePicker(state = state(MAR_15_2026), materialPlaceholder = PLACEHOLDER)
+        }
+
+        onNodeWithText(fieldLabel(MAR_15_2026)).assertIsDisplayed()
+    }
+
+    @Test
+    fun `tapping the field opens a dialog with confirm and dismiss buttons`() = runComposeUiTest {
+        setContent {
+            AdaptiveCompactDatePicker(
+                state = state(),
+                materialPlaceholder = PLACEHOLDER,
+                materialConfirmText = CONFIRM,
+                materialDismissText = DISMISS,
+            )
+        }
+
+        onNodeWithText(PLACEHOLDER).performClick()
+
+        onNodeWithText(CONFIRM).assertIsDisplayed()
+        onNodeWithText(DISMISS).assertIsDisplayed()
+    }
+
+    @Test
+    fun `a day picked in the dialog does not reach the state until confirmed`() = runComposeUiTest {
+        val state = state(MAR_15_2026)
+        setContent {
+            AdaptiveCompactDatePicker(state = state, materialConfirmText = CONFIRM, materialDismissText = DISMISS)
+        }
+
+        onNodeWithText(fieldLabel(MAR_15_2026)).performClick()
+        dayCell(MAR_16_2026).performClick()
+
+        assertEquals(MAR_15_2026, state.selectedDateMillis)
+    }
+
+    @Test
+    fun `confirming applies the day picked in the dialog`() = runComposeUiTest {
+        val state = state(MAR_15_2026)
+        setContent {
+            AdaptiveCompactDatePicker(state = state, materialConfirmText = CONFIRM, materialDismissText = DISMISS)
+        }
+
+        onNodeWithText(fieldLabel(MAR_15_2026)).performClick()
+        dayCell(MAR_16_2026).performClick()
+        onNodeWithText(CONFIRM).performClick()
+
+        assertEquals(MAR_16_2026, state.selectedDateMillis)
+        onAllNodesWithText(CONFIRM).assertCountEquals(0)
+    }
+
+    @Test
+    fun `dismissing discards the day picked in the dialog`() = runComposeUiTest {
+        val state = state(MAR_15_2026)
+        setContent {
+            AdaptiveCompactDatePicker(state = state, materialConfirmText = CONFIRM, materialDismissText = DISMISS)
+        }
+
+        onNodeWithText(fieldLabel(MAR_15_2026)).performClick()
+        dayCell(MAR_16_2026).performClick()
+        onNodeWithText(DISMISS).performClick()
+
+        assertEquals(MAR_15_2026, state.selectedDateMillis)
+        onAllNodesWithText(DISMISS).assertCountEquals(0)
+    }
+
+    @Test
+    fun `a disabled field cannot be opened`() = runComposeUiTest {
+        setContent {
+            AdaptiveCompactDatePicker(state = state(), enabled = false, materialPlaceholder = PLACEHOLDER)
+        }
+
+        onNodeWithText(PLACEHOLDER).assertIsNotEnabled()
+    }
+}
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveCompactDatePicker.ios.kt` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.foundation.layout.size
+import androidx.compose.material3.DatePickerColors
+import androidx.compose.material3.DatePickerFormatter
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.key
+import androidx.compose.ui.ExperimentalComposeUiApi
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.viewinterop.UIKitInteropInteractionMode
+import androidx.compose.ui.viewinterop.UIKitInteropProperties
+import androidx.compose.ui.viewinterop.UIKitView
+import com.mohamedrejeb.calf.core.InternalCalfApi
+
+@OptIn(ExperimentalMaterial3Api::class, InternalCalfApi::class, ExperimentalComposeUiApi::class)
+@Composable
+actual fun AdaptiveCompactDatePicker(
+    state: AdaptiveDatePickerState,
+    modifier: Modifier,
+    enabled: Boolean,
+    dateFormatter: DatePickerFormatter,
+    colors: DatePickerColors,
+    materialPlaceholder: String,
+    materialConfirmText: String,
+    materialDismissText: String,
+    materialTitle: (@Composable () -> Unit)?,
+    materialHeadline: (@Composable () -> Unit)?,
+) {
+    val datePickerManager = rememberDatePickerManager(
+        state = state,
+        presentation = IosDatePickerPresentation.Compact,
+    )
+
+    SyncNativeDatePicker(
+        state = state,
+        manager = datePickerManager,
+        colors = colors,
+        enabled = enabled,
+    )
+
+    key(datePickerManager) {
+        UIKitView(
+            factory = {
+                datePickerManager.view
+            },
+            properties = UIKitInteropProperties(
+                interactionMode = UIKitInteropInteractionMode.NonCooperative,
+            ),
+            modifier = modifier.size(datePickerManager.viewSize),
+        )
+    }
+}
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDatePicker.ios.kt` (modified, +88/-62)
```diff
@@ -10,20 +10,22 @@ import androidx.compose.material3.ExperimentalMaterial3Api
 import androidx.compose.material3.LocalAbsoluteTonalElevation
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.key
 import androidx.compose.runtime.remember
 import androidx.compose.ui.ExperimentalComposeUiApi
 import androidx.compose.ui.Modifier
+import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.viewinterop.UIKitInteropInteractionMode
 import androidx.compose.ui.viewinterop.UIKitInteropProperties
 import androidx.compose.ui.viewinterop.UIKitView
-import androidx.compose.ui.platform.LocalLayoutDirection
 import com.mohamedrejeb.calf.core.InternalCalfApi
 import com.mohamedrejeb.calf.ui.utils.applyLayoutDirection
 import com.mohamedrejeb.calf.ui.utils.surfaceColorAtElevation
 import kotlinx.cinterop.ExperimentalForeignApi
 
-@OptIn(ExperimentalForeignApi::class, ExperimentalMaterial3Api::class, InternalCalfApi::class,
-    ExperimentalComposeUiApi::class
+@OptIn(
+    ExperimentalForeignApi::class, ExperimentalMaterial3Api::class, InternalCalfApi::class,
+    ExperimentalComposeUiApi::class,
 )
 @Composable
 actual fun AdaptiveDatePicker(
@@ -35,87 +37,111 @@ actual fun AdaptiveDatePicker(
     showModeToggle: Boolean,
     colors: DatePickerColors
 ) {
-    val datePickerManager = remember {
-        DatePickerManager(
-            initialSelectedDateMillis = state.selectedDateMillis,
-            displayMode = state.initialUIKitDisplayMode,
-            onSelectionChanged = { dateMillis ->
-                state.selectedDateMillis = dateMillis
-            },
-            isDaySelectable = { dateMillis ->
-                state.isDaySelectable(dateMillis)
-            },
-            resolveSelection = { pickedMillis ->
-                if (state.isDaySelectable(pickedMillis)) {
-                    pickedMillis
-                } else {
-                    val bounds = state.dateBounds
-                    nearestSelectableDay(
-                        utcTimeMillis = pickedMillis,
-                        minDateMillis = bounds.minDateMillis,
-                        maxDateMillis = bounds.maxDateMillis,
-                        selectableDates = state.selectableDates,
-                    ) ?: pickedMillis
-                }
-            },
-        )
+    val datePickerManager = rememberDatePickerManager(
+        state = state,
+        presentation = when (state.initialUIKitDisplayMode) {
+            UIKitDisplayMode.Picker -> IosDatePickerPresentation.Inline
+            else -> IosDatePickerPresentation.Wheels
+        },
+    )
+
+    SyncNativeDatePicker(
+        state = state,
+        manager = datePickerManager,
+        colors = colors,
+        enabled = true,
+    )
+
+    Box(
+        modifier = modifier
+    ) {
+        key(datePickerManager) {
+            UIKitView(
+                factory = {
+                    datePickerManager.view
+                },
+                properties = UIKitInteropProperties(
+                    interactionMode = UIKitInteropInteractionMode.NonCooperative,
+                ),
+                modifier = Modifier
+                    .background(colors.containerColor)
+                    .fillMaxWidth()
+                    .then(
+                        if (datePickerManager.aspectRatio.isFinite() && datePickerManager.aspectRatio > 0f)
+                            Modifier
+                                .aspectRatio(datePickerManager.aspectRatio)
+                        else
+                            Modifier
+                    )
+            )
+        }
     }
+}
 
-    val layoutDirection = LocalLayoutDirection.current
+/** Creates the native picker for [state] and recreates it if a different state is passed. */
+@OptIn(ExperimentalMaterial3Api::class, InternalCalfApi::class)
+@Composable
+internal fun rememberDatePickerManager(
+    state: AdaptiveDatePickerState,
+    presentation: IosDatePickerPresentation,
+): DatePickerManager = remember(state) {
+    DatePickerManager(
+        initialSelectedDateMillis = state.selectedDateMillis,
+        presentation = presentation,
+        onSelectionChanged = { dateMillis ->
+            state.selectedDateMillis = dateMillis
+        },
+        isDaySelectable = { dateMillis ->
+            state.isDaySelectable(dateMillis)
+        },
+        resolveSelection = { pickedMillis ->
+            resolvePickedDay(pickedMillis, state.dateBounds, state.selectableDates)
+        },
+    )
+}
 
+/** Pushes [state], colors, layout direction and the enabled flag into the native picker. */
+@OptIn(ExperimentalMaterial3Api::class, InternalCalfApi::class)
+@Composable
+internal fun SyncNativeDatePicker(
+    state: AdaptiveDatePickerState,
+    manager: DatePickerManager,
+    colors: DatePickerColors,
+    enabled: Boolean,
+) {
+    val layoutDirection = LocalLayoutDirection.current
     val absoluteElevation =
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/CalendarDatePickerBackend.kt` (modified, +4/-0)
```diff
@@ -108,6 +108,10 @@ internal class CalendarDatePickerBackend(
         refresh()
     }
 
+    override fun setEnabled(enabled: Boolean) {
+        calendarView.userInteractionEnabled = enabled
+    }
+
     /**
      * Rebuilds the days around the visible month, so bounds and rule changes show right away
      * instead of on the next scroll or tap.
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/DatePickerManager.kt` (modified, +63/-18)
```diff
@@ -4,10 +4,12 @@ package com.mohamedrejeb.calf.ui.datepicker
 
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.mutableFloatStateOf
+import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.unit.DpSize
+import androidx.compose.ui.unit.dp
 import com.mohamedrejeb.calf.core.InternalCalfApi
-import com.mohamedrejeb.calf.ui.utils.applyTheme
 import com.mohamedrejeb.calf.ui.utils.isDark
 import com.mohamedrejeb.calf.ui.utils.isIOSVersionAtLeast
 import com.mohamedrejeb.calf.ui.utils.toUIColor
@@ -18,38 +20,53 @@ import platform.UIKit.UIDatePickerMode
 import platform.UIKit.UIDatePickerStyle
 import platform.UIKit.UIView
 
-private const val FIRST_IOS_WITH_CALENDAR_VIEW = 16
+internal const val FIRST_IOS_WITH_CALENDAR_VIEW = 16
+
+/** How the native date picker is presented. */
+internal enum class IosDatePickerPresentation {
+    /** A full calendar; `UICalendarView` on iOS 16+, an inline `UIDatePicker` before that. */
+    Inline,
+
+    /** Spinning wheels. */
+    Wheels,
+
+    /** A small button showing the date that pops the calendar over the content. */
+    Compact,
+}
 
 /**
- * Owns the native date picker view and keeps it in sync with [AdaptiveDatePickerState].
+ * Owns the native date picker view and keeps it in sync with the selection it is given.
  *
- * The inline style uses `UICalendarView` on iOS 16+, which can grey out days the
- * [isDaySelectable] rule rejects. The wheels style, and the inline style on older systems,
- * use `UIDatePicker` and resolve rejected picks through [resolveSelection].
+ * The inline presentation uses `UICalendarView` on iOS 16+, which greys out days the
+ * [isDaySelectable] rule rejects. Every other presentation, including the system compact
+ * control, uses `UIDatePicker`, which only enforces bounds, and resolves rejected picks
+ * through [resolveSelection].
  */
 @InternalCalfApi
 class DatePickerManager internal constructor(
     initialSelectedDateMillis: Long?,
-    displayMode: UIKitDisplayMode,
+    private val presentation: IosDatePickerPresentation,
     onSelectionChanged: (utcTimeMillis: Long?) -> Unit,
     isDaySelectable: (utcTimeMillis: Long) -> Boolean,
     resolveSelection: (pickedUtcTimeMillis: Long) -> Long,
 ) {
+    private val onNativeSelectionChanged: (Long?) -> Unit = { utcTimeMillis ->
+        remeasureCompactView()
+        onSelectionChanged(utcTimeMillis)
+    }
+
     private val backend: IosDatePickerBackend =
-        if (displayMode == UIKitDisplayMode.Picker && isIOSVersionAtLeast(FIRST_IOS_WITH_CALENDAR_VIEW)) {
+        if (presentation == IosDatePickerPresentation.Inline && isIOSVersionAtLeast(FIRST_IOS_WITH_CALENDAR_VIEW)) {
             CalendarDatePickerBackend(
                 initialSelectedDateMillis = initialSelectedDateMillis,
-                onSelectionChanged = onSelectionChanged,
+                onSelectionChanged = onNativeSelectionChanged,
                 isDaySelectable = isDaySelectable,
             )
         } else {
-            WheelsDatePickerBackend(
+            UIDatePickerBackend(
                 initialSelectedDateMillis = initialSelectedDateMillis,
-                style = when (displayMode) {
-                    UIKitDisplayMode.Picker -> UIDatePickerStyle.UIDatePickerStyleInline
-                    else -> UIDatePickerStyle.UIDatePickerStyleWheels
-                },
-                onSelectionChanged = onSelectionChanged,
+                style = presentation.toUIDatePickerStyle(),
+                onSelectionChanged = onNativeSelectionChanged,
                 resolveSelection = resolveSelection,
             )
         }
@@ -62,6 +79,13 @@ class DatePickerManager internal constructor(
     internal var aspectRatio by mutableFloatStateOf(0f)
         private set
 
+    /**
+     * Intrinsic size of the native view in points, which equal dp on iOS. The compact picker
+     * resizes with its date label, so it is measured again after every selection change.
+     */
+    internal var viewSize: DpSize by mutableStateOf(backend.view.currentSize())
+        private set
+
     init {
         aspectRatio = backend.view.aspectRatioOrZero()
             .takeIf { it > 0f }
@@ -81,7 +105,7 @@ class DatePickerManager internal constructor(
     }
 
     internal fun applyTheme(isDark: Boolean) {
-        backend.view.applyTheme(isDark)
+        backend.applyTheme(isDark)
     }
 
     internal fun applyDateBounds(minDateMillis: Long?, maxDateMillis: Long?) {
@@ -95,16 +119,37 @@ class DatePickerManager internal constructor(
 
     internal fun setSelectedDate(utcTimeMillis: Long?) {
         backend.setSelectedDate(utcTimeMillis)
+        remeasureCompactView()
+    }
+
+    private fun remeasureCompactView() {
+        if (presentation != IosDatePickerPresentation.Compact) return
+        backend.view.sizeToFit()
+        viewSize = backend.view.currentSize()
+    }
+
+ 
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/IosDatePickerBackend.kt` (modified, +7/-0)
```diff
@@ -1,5 +1,6 @@
 package com.mohamedrejeb.calf.ui.datepicker
 
+import com.mohamedrejeb.calf.ui.utils.applyTheme
 import platform.UIKit.UIColor
 import platform.UIKit.UIView
 
@@ -19,5 +20,11 @@ internal interface IosDatePickerBackend {
     /** Re-evaluates which days can be picked after the rule or the bounds changed. */
     fun updateSelectableDates()
 
+    fun setEnabled(enabled: Boolean)
+
     fun applyColors(containerColor: UIColor, selectedDayContainerColor: UIColor)
+
+    fun applyTheme(isDark: Boolean) {
+        view.applyTheme(isDark)
+    }
 }
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/UIDatePickerBackend.kt` (renamed, +8/-3)
```diff
@@ -18,11 +18,11 @@ import platform.darwin.NSObject
 import platform.objc.sel_registerName
 
 /**
- * Picker backed by `UIDatePicker`, used for the wheels style and as the inline fallback below
+ * Picker backed by `UIDatePicker`: the wheels and compact styles, and the inline fallback below
  * iOS 16. `UIDatePicker` can only enforce a minimum and a maximum date, so a picked day the
- * rule rejects is replaced by [resolveSelection] and the wheels move to that day.
+ * rule rejects is replaced by [resolveSelection] and the control moves to that day.
  */
-internal class WheelsDatePickerBackend(
+internal class UIDatePickerBackend(
     initialSelectedDateMillis: Long?,
     style: UIDatePickerStyle,
     private val onSelectionChanged: (utcTimeMillis: Long?) -> Unit,
@@ -53,6 +53,7 @@ internal class WheelsDatePickerBackend(
         datePicker.timeZone = TimeZone.currentSystemDefault().toNSTimeZone()
         datePicker.datePickerMode = UIDatePickerMode.UIDatePickerModeDate
         datePicker.preferredDatePickerStyle = style
+        datePicker.sizeToFit()
         datePicker.addTarget(
             target = valueChangedTarget,
             action = sel_registerName("onDateChanged:"),
@@ -76,6 +77,10 @@ internal class WheelsDatePickerBackend(
         // UIDatePicker cannot grey out individual days; rejected picks are resolved on change.
     }
 
+    override fun setEnabled(enabled: Boolean) {
+        datePicker.enabled = enabled
+    }
+
     override fun applyColors(containerColor: UIColor, selectedDayContainerColor: UIColor) {
         datePicker.tintColor = selectedDayContainerColor
         datePicker.backgroundColor = containerColor
```

---

### Incident Patch 8: `645b8063` (2026-09-10)
**Commit Message**: feat(ui): add a cross-platform selectable dates rule to AdaptiveDatePicker

Closes #328.

The docs advertised a dateValidator parameter that never existed.
AdaptiveDatePickerState now exposes an observable selectableDates rule
that works on every platform, plus DateBounds, a SelectableDates for a
minimum and maximum day (inclusive, compared per UTC day), and an infix
`and` to combine rules.

- Material: the Material3 state is wrapped so it reports the caller's
  rule object; Material3 caches each day's enabled flag keyed on that
  object, so a rule changing its answers in place would never redraw
- iOS 16+ inline picker: backed by UICalendarView, whose selection
  delegate greys out days the rule rejects; bounds coming from a
  DateBounds map to the available date range, and the visible days are
  rebuilt after every change so it shows immediately rather than on the
  next scroll or tap
- iOS wheels picker and inline below iOS 16: backed by UIDatePicker,
  which only supports min/max, so DateBounds stop the wheels and any
  other rejected pick snaps to the nearest selectable day
- A selection the new rule rejects is moved to the nearest selectable
  day on every platform; the state

**File**: `calf-ui/build.gradle.kts` (modified, +9/-0)
```diff
@@ -11,6 +11,15 @@ kotlin {
         implementation(libs.kotlinx.coroutines.core)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.activity.compose)
         implementation(libs.kotlinx.coroutines.android)
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/AdaptiveDatePickerState.kt` (modified, +42/-2)
```diff
@@ -5,6 +5,23 @@ import androidx.compose.runtime.*
 import androidx.compose.runtime.saveable.Saver
 import androidx.compose.runtime.saveable.rememberSaveable
 
+/**
+ * Creates and remembers an [AdaptiveDatePickerState].
+ *
+ * @param initialSelectedDateMillis timestamp in _UTC_ milliseconds from the epoch that
+ * represents an initial selection of a date. Provide a `null` to indicate no selection.
+ * @param initialDisplayedMonthMillis timestamp in _UTC_ milliseconds from the epoch that
+ * represents an initial selection of a month to be displayed to the user. In case `null` is
+ * provided, the displayed month would be the current one.
+ * @param yearRange an [IntRange] that holds the year range that the date picker will be limited
+ * to
+ * @param initialMaterialDisplayMode an initial [DisplayMode] that this state will hold
+ * @param initialUIKitDisplayMode an initial [UIKitDisplayMode] used by the iOS picker
+ * @param selectableDates the rule deciding which days can be picked, see
+ * [AdaptiveDatePickerState.selectableDates]. Use [DateBounds] for a minimum and maximum day and
+ * [and] to combine rules. Pass a stable instance (for example an `object`, a `data class` or a
+ * remembered value) so the picker does not re-evaluate on every recomposition.
+ */
 @Composable
 @ExperimentalMaterial3Api
 fun rememberAdaptiveDatePickerState(
@@ -13,17 +30,22 @@ fun rememberAdaptiveDatePickerState(
     yearRange: IntRange = DatePickerDefaults.YearRange,
     initialMaterialDisplayMode: DisplayMode = DisplayMode.Picker,
     initialUIKitDisplayMode: UIKitDisplayMode = UIKitDisplayMode.Picker,
+    selectableDates: SelectableDates = DatePickerDefaults.AllDates,
 ): AdaptiveDatePickerState =
     rememberSaveable(
-        saver = AdaptiveDatePickerState.Saver(),
+        saver = AdaptiveDatePickerState.Saver(selectableDates),
     ) {
         AdaptiveDatePickerState(
             initialSelectedDateMillis = initialSelectedDateMillis,
             initialDisplayedMonthMillis = initialDisplayedMonthMillis,
             yearRange = yearRange,
             initialMaterialDisplayMode = initialMaterialDisplayMode,
             initialUIKitDisplayMode = initialUIKitDisplayMode,
+            selectableDates = selectableDates,
         )
+    }.apply {
+        // Keep the rule in sync when the caller passes a new one on recomposition.
+        this.selectableDates = selectableDates
     }
 
 /**
@@ -43,6 +65,8 @@ fun rememberAdaptiveDatePickerState(
  * @param yearRange an [IntRange] that holds the year range that the date picker will be limited
  * to
  * @param initialMaterialDisplayMode an initial [DisplayMode] that this state will hold
+ * @param initialUIKitDisplayMode an initial [UIKitDisplayMode] used by the iOS picker
+ * @param selectableDates initial value of [AdaptiveDatePickerState.selectableDates]
  * @see rememberAdaptiveDatePickerState
  * @throws [IllegalArgumentException] if the initial selected date or displayed month represent
  * a year that is out of the year range.
@@ -55,6 +79,7 @@ expect class AdaptiveDatePickerState(
     yearRange: IntRange,
     initialMaterialDisplayMode: DisplayMode,
     initialUIKitDisplayMode: UIKitDisplayMode,
+    selectableDates: SelectableDates = DatePickerDefaults.AllDates,
 ) {
     /**
      * A timestamp that represents the _start_ of the day of the selected date in _UTC_ milliseconds
@@ -87,11 +112,26 @@ expect class AdaptiveDatePickerState(
      */
     var displayMode: DisplayMode
 
+    /**
+     * The [SelectableDates] rule deciding which days can be picked. Use [DateBounds] for a
+     * minimum and maximum day, and [and] to combine rules.
+     *
+     * Honoured by the Material picker and by the iOS 16+ calendars, where rejected days are
+     * greyed out; bounds coming from a [DateBounds] are also applied natively, so the iOS wheels
+     * stop at the range. The iOS wheels picker, and the inline picker below iOS 16, cannot grey
+     * out days: a rejected day is snapped to the nearest selectable one instead. Observable:
+     * changing it updates the displayed picker, and a selection the new rule rejects is moved
+     * to the nearest selectable day. [SelectableDates.isSelectableYear] only affects Material.
+     */
+    var selectableDates: SelectableDates
+
     companion object {
         /**
          * The default [Saver] implementation for [AdaptiveDatePickerState].
+         *
+         * @param selectableDates the rule to re-attach on restore, since it cannot be saved.
          */
-        fun Saver(): Saver<AdaptiveDatePickerState, *>
+        fun Saver(selectableDates: SelectableDates = DatePickerDefaults.AllDates): Saver<AdaptiveDatePickerState, Any>
     }
 }
 
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateBounds.kt` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+import androidx.compose.runtime.Immutable
+
+/**
+ * A [SelectableDates] rule that accepts the days from [minDateMillis] to [maxDateMillis], both
+ * inclusive and compared per UTC day, so any timestamp inside the first or last day keeps that
+ * whole day selectable. A `null` bound is open on that side.
+ *
+ * Besides greying out days, the pickers apply these bounds natively: the iOS wheels stop at the
+ * range and the calendars hide the months outside it. Combine with other rules using [and].
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+@Immutable
+data class DateBounds(
+    val minDateMillis: Long? = null,
+    val maxDateMillis: Long? = null,
+) : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean =
+        isDayWithinBounds(utcTimeMillis, minDateMillis, maxDateMillis)
+
+    override fun isSelectableYear(year: Int): Boolean =
+        isYearWithinBounds(year, minDateMillis, maxDateMillis)
+}
+
+/** A rule that accepts a day, or a year, only when both this rule and [other] accept it. */
+@OptIn(ExperimentalMaterial3Api::class)
+infix fun SelectableDates.and(other: SelectableDates): SelectableDates =
+    CombinedSelectableDates(this, other)
+
+@OptIn(ExperimentalMaterial3Api::class)
+@Immutable
+internal data class CombinedSelectableDates(
+    val first: SelectableDates,
+    val second: SelectableDates,
+) : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean =
+        first.isSelectableDate(utcTimeMillis) && second.isSelectableDate(utcTimeMillis)
+
+    override fun isSelectableYear(year: Int): Boolean =
+        first.isSelectableYear(year) && second.isSelectableYear(year)
+}
+
+/**
+ * The bounds this rule enforces when it is a [DateBounds], or combines one through [and];
+ * `null` for any other rule.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal fun SelectableDates.dateBoundsOrNull(): DateBounds? =
+    when (this) {
+        is DateBounds -> this
+        is CombinedSelectableDates -> intersectOrNull(first.dateBoundsOrNull(), second.dateBoundsOrNull())
+        else -> null
+    }
+
+/** The days accepted by both this and [other]. */
+internal fun DateBounds.intersect(other: DateBounds): DateBounds =
+    DateBounds(
+        minDateMillis = tighterMin(minDateMillis, other.minDateMillis),
+        maxDateMillis = tighterMax(maxDateMillis, other.maxDateMillis),
+    )
+
+private fun intersectOrNull(first: DateBounds?, second: DateBounds?): DateBounds? =
+    when {
+        first == null -> second
+        second == null -> first
+        else -> first.intersect(second)
+    }
+
+private fun tighterMin(first: Long?, second: Long?): Long? =
+    if (first == null || second == null) first ?: second else maxOf(first, second)
+
+private fun tighterMax(first: Long?, second: Long?): Long? =
+    if (first == null || second == null) first ?: second else minOf(first, second)
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/RuleTrackingDatePickerState.kt` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerState
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+/**
+ * A [DatePickerState] that reports the rule returned by [currentRule] instead of the one it was
+ * created with.
+ *
+ * Material3 caches each day's enabled state keyed on the rule object, so the picker only
+ * notices a change when the object itself changes. Handing it the caller's rule, which is a
+ * new object whenever the rule changes, keeps the calendar in sync.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal class RuleTrackingDatePickerState(
+    delegate: DatePickerState,
+    private val currentRule: () -> SelectableDates,
+) : DatePickerState by delegate {
+    override val selectableDates: SelectableDates
+        get() = currentRule()
+}
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/datepicker/SelectableDays.kt` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+internal const val MILLIS_PER_DAY = 86_400_000L
+
+/** How far, in days on each side, a snapped selection may move to find a selectable day. */
+internal const val DEFAULT_SNAP_SEARCH_DAYS = 366
+
+private const val DAYS_FROM_CIVIL_EPOCH_TO_UNIX_EPOCH = 719_468L
+private const val DAYS_PER_ERA = 146_097L
+private const val YEARS_PER_ERA = 400L
+
+/**
+ * Returns true when the UTC day containing [utcTimeMillis] lies within the inclusive
+ * [minDateMillis]..[maxDateMillis] range.
+ *
+ * Bounds are compared at day granularity, so any timestamp inside the min or max day keeps
+ * that whole day selectable. A null bound is open on that side.
+ */
+internal fun isDayWithinBounds(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Boolean {
+    val day = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val afterMin = minDateMillis == null || day >= minDateMillis.floorDiv(MILLIS_PER_DAY)
+    val beforeMax = maxDateMillis == null || day <= maxDateMillis.floorDiv(MILLIS_PER_DAY)
+    return afterMin && beforeMax
+}
+
+/**
+ * Returns true when [year] contains at least one day of the inclusive
+ * [minDateMillis]..[maxDateMillis] range. A null bound is open on that side.
+ */
+internal fun isYearWithinBounds(
+    year: Int,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Boolean {
+    val afterMin = minDateMillis == null || year >= utcYearOf(minDateMillis)
+    val beforeMax = maxDateMillis == null || year <= utcYearOf(maxDateMillis)
+    return afterMin && beforeMax
+}
+
+/**
+ * Moves the UTC day containing [utcTimeMillis] into the inclusive bounds.
+ *
+ * Returns [utcTimeMillis] unchanged when it is already inside, otherwise the _start_ of the
+ * minimum or maximum day in UTC, whichever is nearer. A null bound is open on that side.
+ */
+internal fun clampDayIntoBounds(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+): Long {
+    val day = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val minDay = minDateMillis?.floorDiv(MILLIS_PER_DAY)
+    val maxDay = maxDateMillis?.floorDiv(MILLIS_PER_DAY)
+    return when {
+        minDay != null && day < minDay -> minDay * MILLIS_PER_DAY
+        maxDay != null && day > maxDay -> maxDay * MILLIS_PER_DAY
+        else -> utcTimeMillis
+    }
+}
+
+/**
+ * Proleptic Gregorian year of a UTC timestamp, computed without a calendar dependency
+ * using the days-to-civil algorithm from Howard Hinnant's date algorithms.
+ */
+internal fun utcYearOf(utcTimeMillis: Long): Int {
+    val days = utcTimeMillis.floorDiv(MILLIS_PER_DAY)
+    val shifted = days + DAYS_FROM_CIVIL_EPOCH_TO_UNIX_EPOCH
+    val era = shifted.floorDiv(DAYS_PER_ERA)
+    val dayOfEra = shifted - era * DAYS_PER_ERA
+    val yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365
+    val dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
+    val monthIndex = (5 * dayOfYear + 2) / 153 // 0 is March, 11 is February
+    val marchBasedYear = yearOfEra + era * YEARS_PER_ERA
+    return (if (monthIndex >= 10) marchBasedYear + 1 else marchBasedYear).toInt()
+}
+
+/**
+ * Finds the selectable day nearest to [utcTimeMillis] and returns its _start_ in UTC.
+ *
+ * The day is first clamped into the bounds, then the search walks outwards one day at a
+ * time, later days first, until [selectableDates] accepts one. Returns null when no day within
+ * [maxDistanceDays] on either side is selectable.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal fun nearestSelectableDay(
+    utcTimeMillis: Long,
+    minDateMillis: Long?,
+    maxDateMillis: Long?,
+    selectableDates: SelectableDates,
+    maxDistanceDays: Int = DEFAULT_SNAP_SEARCH_DAYS,
+): Long? {
+    fun isSelectable(day: Long): Boolean {
+        val dayStart = day * MILLIS_PER_DAY
+        return isDayWithinBounds(dayStart, minDateMillis, maxDateMillis) &&
+            selectableDates.isSelectableDate(dayStart)
+    }
+
+    val startDay = clampDayIntoBounds(utcTimeMillis, minDateMillis, maxDateMillis)
+        .floorDiv(MILLIS_PER_DAY)
+    if (isSelectable(startDay)) return startDay * MILLIS_PER_DAY
+
+    for (distance in 1..maxDistanceDays) {
+        val later = startDay + distance
+        if (isSelectable(later)) return later * MILLIS_PER_DAY
+        val earlier = startDay - distance
+        if (isSelectable(earlier)) return earlier * MILLIS_PER_DAY
+    }
+    return null
+}
+
+/**
+ * The day a native picker should end up on after the user picked [pickedUtcTimeMillis]: the
+ * pick itself when [bounds] and [selectableDates] accept it, otherwise the nearest selectable
+ * day, or the pick unchanged when none is within reach.
+ */
+@OptIn(ExperimentalMaterial3Api::class)
+internal fun resolvePickedDay(
+    pickedUtcTimeMillis: Long,
+    bound
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateBoundsSelectableDatesTest.kt` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.ExperimentalMaterial3Api
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalMaterial3Api::class)
+class DateBoundsSelectableDatesTest {
+
+    @Test
+    fun `date bounds accept the days inside and reject the days outside`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+
+        assertFalse(march.isSelectableDate(FEB_28_2026))
+        assertTrue(march.isSelectableDate(MAR_1_2026))
+        assertTrue(march.isSelectableDate(MAR_31_2026 + NOON_OFFSET_MILLIS))
+        assertFalse(march.isSelectableDate(APR_1_2026))
+    }
+
+    @Test
+    fun `date bounds with one side open accept everything on that side`() {
+        assertTrue(DateBounds(minDateMillis = MAR_1_2026).isSelectableDate(APR_1_2026))
+        assertTrue(DateBounds(maxDateMillis = MAR_31_2026).isSelectableDate(FEB_28_2026))
+        assertTrue(DateBounds().isSelectableDate(FEB_29_2000))
+    }
+
+    @Test
+    fun `date bounds reject the years outside`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+
+        assertFalse(march.isSelectableYear(2025))
+        assertTrue(march.isSelectableYear(2026))
+        assertFalse(march.isSelectableYear(2027))
+    }
+
+    @Test
+    fun `and accepts a day only when both rules accept it`() {
+        val marchWeekdays = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026) and WeekdaysOnly
+
+        assertTrue(marchWeekdays.isSelectableDate(MAR_13_2026))
+        assertFalse(marchWeekdays.isSelectableDate(MAR_14_2026))
+        assertFalse(marchWeekdays.isSelectableDate(APR_1_2026))
+        assertFalse(marchWeekdays.isSelectableYear(2025))
+    }
+
+    @Test
+    fun `bounds are extracted from date bounds and intersected through and`() {
+        val march = DateBounds(minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026)
+        val fromMid = DateBounds(minDateMillis = MAR_15_2026)
+
+        assertEquals(march, march.dateBoundsOrNull())
+        assertEquals(
+            DateBounds(minDateMillis = MAR_15_2026, maxDateMillis = MAR_31_2026),
+            (march and fromMid).dateBoundsOrNull(),
+        )
+        assertEquals(march, (march and WeekdaysOnly).dateBoundsOrNull())
+        assertEquals(march, (WeekdaysOnly and march).dateBoundsOrNull())
+    }
+
+    @Test
+    fun `other rules expose no bounds`() {
+        assertNull(WeekdaysOnly.dateBoundsOrNull())
+        assertNull(DatePickerDefaults.AllDates.dateBoundsOrNull())
+        assertNull((WeekdaysOnly and NoDates).dateBoundsOrNull())
+    }
+}
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/DateBoundsTest.kt` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.DatePickerDefaults
+import androidx.compose.material3.ExperimentalMaterial3Api
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+@OptIn(ExperimentalMaterial3Api::class)
+class DateBoundsTest {
+
+    @Test
+    fun `every day is within bounds when no bounds are set`() {
+        assertTrue(isDayWithinBounds(MAR_15_2026 + NOON_OFFSET_MILLIS, minDateMillis = null, maxDateMillis = null))
+    }
+
+    @Test
+    fun `days before the minimum are rejected and the minimum day itself is accepted`() {
+        assertFalse(isDayWithinBounds(FEB_28_2026, minDateMillis = MAR_1_2026, maxDateMillis = null))
+        assertTrue(isDayWithinBounds(MAR_1_2026, minDateMillis = MAR_1_2026, maxDateMillis = null))
+    }
+
+    @Test
+    fun `days after the maximum are rejected and the maximum day itself is accepted`() {
+        assertTrue(isDayWithinBounds(MAR_31_2026, minDateMillis = null, maxDateMillis = MAR_31_2026))
+        assertFalse(isDayWithinBounds(APR_1_2026, minDateMillis = null, maxDateMillis = MAR_31_2026))
+    }
+
+    @Test
+    fun `bounds are compared at day granularity`() {
+        assertTrue(isDayWithinBounds(MAR_1_2026, minDateMillis = MAR_1_2026 + NOON_OFFSET_MILLIS, maxDateMillis = null))
+        assertTrue(isDayWithinBounds(MAR_31_2026 + NOON_OFFSET_MILLIS, minDateMillis = null, maxDateMillis = MAR_31_2026))
+    }
+
+    @Test
+    fun `years outside the bounds are rejected`() {
+        assertFalse(isYearWithinBounds(2025, minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026))
+        assertTrue(isYearWithinBounds(2026, minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026))
+        assertFalse(isYearWithinBounds(2027, minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026))
+        assertTrue(isYearWithinBounds(1999, minDateMillis = null, maxDateMillis = null))
+    }
+
+    @Test
+    fun `utc year is derived from epoch millis across year and leap boundaries`() {
+        assertEquals(1970, utcYearOf(0))
+        assertEquals(1969, utcYearOf(-1))
+        assertEquals(2000, utcYearOf(FEB_29_2000))
+        assertEquals(2024, utcYearOf(JAN_1_2025 - 1))
+        assertEquals(2025, utcYearOf(JAN_1_2025))
+        assertEquals(2026, utcYearOf(MAR_1_2026))
+    }
+
+    @Test
+    fun `clamping keeps a day inside the bounds unchanged`() {
+        assertEquals(MAR_15_2026, clampDayIntoBounds(MAR_15_2026, minDateMillis = MAR_1_2026, maxDateMillis = MAR_31_2026))
+    }
+
+    @Test
+    fun `clamping moves a day before the minimum to the start of the minimum day`() {
+        assertEquals(MAR_1_2026, clampDayIntoBounds(FEB_28_2026, minDateMillis = MAR_1_2026 + NOON_OFFSET_MILLIS, maxDateMillis = null))
+    }
+
+    @Test
+    fun `clamping moves a day after the maximum to the start of the maximum day`() {
+        assertEquals(MAR_31_2026, clampDayIntoBounds(APR_1_2026, minDateMillis = null, maxDateMillis = MAR_31_2026 + NOON_OFFSET_MILLIS))
+    }
+
+    @Test
+    fun `nearest selectable day is the start of the day itself when it is selectable`() {
+        assertEquals(
+            MAR_15_2026,
+            nearestSelectableDay(MAR_15_2026 + NOON_OFFSET_MILLIS, null, null, DatePickerDefaults.AllDates),
+        )
+    }
+
+    @Test
+    fun `nearest selectable day skips the days the rule rejects`() {
+        assertEquals(MAR_13_2026, nearestSelectableDay(MAR_14_2026, null, null, WeekdaysOnly))
+        assertEquals(MAR_16_2026, nearestSelectableDay(MAR_15_2026, null, null, WeekdaysOnly))
+    }
+
+    @Test
+    fun `nearest selectable day stays inside the bounds`() {
+        assertEquals(MAR_31_2026, nearestSelectableDay(APR_1_2026, null, MAR_31_2026, DatePickerDefaults.AllDates))
+        assertEquals(MAR_1_2026, nearestSelectableDay(FEB_28_2026, MAR_1_2026, null, DatePickerDefaults.AllDates))
+    }
+
+    @Test
+    fun `nearest selectable day is null when nothing is selectable within the search window`() {
+        assertNull(nearestSelectableDay(MAR_15_2026, null, null, NoDates, maxDistanceDays = 3))
+    }
+
+    @Test
+    fun `a picked day is kept when the bounds and the rule accept it`() {
+        assertEquals(MAR_13_2026, resolvePickedDay(MAR_13_2026, DateBounds(MAR_1_2026, MAR_31_2026), WeekdaysOnly))
+    }
+
+    @Test
+    fun `a rejected pick resolves to the nearest selectable day`() {
+        assertEquals(MAR_13_2026, resolvePickedDay(MAR_14_2026, DateBounds(), WeekdaysOnly))
+        assertEquals(MAR_31_2026, resolvePickedDay(APR_1_2026, DateBounds(maxDateMillis = MAR_31_2026), DatePickerDefaults.AllDates))
+    }
+
+    @Test
+    fun `a rejected pick is kept when nothing selectable is within reach`() {
+        assertEquals(MAR_14_2026, resolvePickedDay(MAR_14_2026, DateBounds(), NoDates))
+    }
+}
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/datepicker/TestDates.kt` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+package com.mohamedrejeb.calf.ui.datepicker
+
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.SelectableDates
+
+/** UTC start-of-day timestamp for the given number of days since 1970-01-01. */
+internal fun utcDay(daysSinceEpoch: Long): Long = daysSinceEpoch * MILLIS_PER_DAY
+
+internal const val NOON_OFFSET_MILLIS = 12L * 60 * 60 * 1000
+
+// Day counts since 1970-01-01 (UTC) for the dates used in the date picker tests.
+// 2026-03-01 is a Sunday, so 2026-03-14 is a Saturday and 2026-03-15 a Sunday.
+internal val FEB_29_2000 = utcDay(11016)
+internal val JAN_1_2025 = utcDay(20089)
+internal val FEB_28_2026 = utcDay(20512)
+internal val MAR_1_2026 = utcDay(20513)
+internal val MAR_13_2026 = utcDay(20525)
+internal val MAR_14_2026 = utcDay(20526)
+internal val MAR_15_2026 = utcDay(20527)
+internal val MAR_16_2026 = utcDay(20528)
+internal val MAR_31_2026 = utcDay(20543)
+internal val APR_1_2026 = utcDay(20544)
+
+private const val DAYS_PER_WEEK = 7L
+private const val EPOCH_DAY_OFFSET_FROM_MONDAY = 3L // 1970-01-01 was a Thursday
+private const val SATURDAY_INDEX = 5L
+
+/** Accepts Monday to Friday only, computed from the epoch day without a calendar library. */
+@OptIn(ExperimentalMaterial3Api::class)
+internal object WeekdaysOnly : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean {
+        val dayOfWeekIndex = (utcTimeMillis.floorDiv(MILLIS_PER_DAY) + EPOCH_DAY_OFFSET_FROM_MONDAY)
+            .mod(DAYS_PER_WEEK)
+        return dayOfWeekIndex < SATURDAY_INDEX
+    }
+}
+
+/** Rejects every day. */
+@OptIn(ExperimentalMaterial3Api::class)
+internal object NoDates : SelectableDates {
+    override fun isSelectableDate(utcTimeMillis: Long): Boolean = false
+}
```

---

### Incident Patch 9: `e8d01be3` (2026-09-11)
**Commit Message**: Merge pull request #540 from MohamedRejeb/fix/desktop-native-lib-cache-collision

fix(file-picker): reuse identical cached native library instead of replacing it

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibCache.kt` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+package com.mohamedrejeb.calf.picker.platform
+
+import java.io.File
+import java.nio.file.Files
+import java.nio.file.Path
+import java.nio.file.StandardCopyOption
+import java.security.MessageDigest
+
+private const val HASH_ALGORITHM = "SHA-256"
+private const val HASH_LENGTH = 16
+private const val TEMP_PREFIX = "calf-native-"
+private const val TEMP_SUFFIX = ".tmp"
+
+/**
+ * Short, stable fingerprint of a native library's bytes.
+ *
+ * Used to name the cached copy so that different builds of the library
+ * never share a file on disk.
+ */
+internal fun nativeLibraryContentHash(bytes: ByteArray): String =
+    MessageDigest.getInstance(HASH_ALGORITHM)
+        .digest(bytes)
+        .joinToString("") { "%02x".format(it) }
+        .take(HASH_LENGTH)
+
+/**
+ * Inserts [contentHash] before the extension of [libFileName],
+ * e.g. `calf_filepicker_native.dll` -> `calf_filepicker_native-<hash>.dll`.
+ */
+internal fun nativeLibraryCacheFileName(libFileName: String, contentHash: String): String {
+    val extension = libFileName.substringAfterLast('.', missingDelimiterValue = "")
+    val baseName = libFileName.substringBeforeLast('.')
+    return if (extension.isEmpty()) "$baseName-$contentHash" else "$baseName-$contentHash.$extension"
+}
+
+/**
+ * Makes [bytes] available as a file inside [cacheDir] and returns the file to load.
+ *
+ * - An existing target with identical content is reused untouched, so a library
+ *   that another process has already loaded (and locked, on Windows) is never
+ *   replaced.
+ * - Otherwise the bytes are written to a temp file and moved over the target.
+ * - If the move fails for any reason, the unique temp file itself is returned
+ *   and scheduled for deletion on exit, so loading still succeeds.
+ */
+internal fun extractNativeLibrary(bytes: ByteArray, cacheDir: File, fileName: String): File {
+    cacheDir.mkdirs()
+    val target = File(cacheDir, fileName)
+    if (hasIdenticalContent(target, bytes)) return target
+
+    val tempFile = Files.createTempFile(cacheDir.toPath(), TEMP_PREFIX, TEMP_SUFFIX)
+    Files.write(tempFile, bytes)
+
+    return runCatching { moveReplacing(tempFile, target.toPath()) }
+        .map { target }
+        .getOrElse { tempFile.toFile().also { it.deleteOnExit() } }
+}
+
+private fun hasIdenticalContent(file: File, bytes: ByteArray): Boolean =
+    file.isFile &&
+        file.length() == bytes.size.toLong() &&
+        nativeLibraryContentHash(file.readBytes()) == nativeLibraryContentHash(bytes)
+
+private fun moveReplacing(source: Path, target: Path) {
+    try {
+        Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
+    } catch (_: Exception) {
+        // ATOMIC_MOVE is not supported on every filesystem; retry with a plain replace.
+        Files.move(source, target, StandardCopyOption.REPLACE_EXISTING)
+    }
+}
```

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibLoader.kt` (modified, +40/-54)
```diff
@@ -1,84 +1,70 @@
 package com.mohamedrejeb.calf.picker.platform
 
 import java.io.File
-import java.io.InputStream
-import java.nio.file.Files
-import java.nio.file.StandardCopyOption
 
 private const val LIB_NAME = "calf_filepicker_native"
+private const val CACHE_DIR = ".cache/calf-filepicker"
 
 /**
- * Loads the native file picker library from JAR resources.
+ * Loads the native file picker library.
  *
- * The library is expected at: native/<os>-<arch>/<libFileName>
- * It is extracted to a user-scoped cache directory and loaded via [System.load].
+ * The system library path is tried first (packagers like Conveyor extract natives
+ * out of the jar). Otherwise the library is read from JAR resources at
+ * `native/<os>-<arch>/<libFileName>`, cached under a content-hashed name in a
+ * user-scoped directory, and loaded via [System.load].
  *
- * Called once from [NativeFilePickerBridge]'s object init block
+ * Called once from [NativeFilePickerBridge]'s object init block.
  */
 internal fun loadNativeLibrary() {
-    // Try the system path first (packagers like Conveyor extract natives
-    // out of the jar), then fall back to the bundled resource.
     try {
         System.loadLibrary(LIB_NAME)
         return
     } catch (_: UnsatisfiedLinkError) {
     }
 
-    val osName = System.getProperty("os.name")?.lowercase().orEmpty()
-    val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
+    val (resourcePath, libFileName) = bundledLibraryLocation()
+    val bytes = NativeFilePickerBridge::class.java.classLoader
+        ?.getResourceAsStream(resourcePath)
+        ?.use { it.readBytes() }
+        ?: error(
+            "Native library not found in JAR resources at '$resourcePath'. " +
+                "Ensure the native library is built for this platform."
+        )
 
-    val (osPart, libFileName) = when {
-        "mac" in osName || "darwin" in osName ->
-            "macos" to "lib$LIB_NAME.dylib"
+    val cacheFileName = nativeLibraryCacheFileName(libFileName, nativeLibraryContentHash(bytes))
+    val libraryFile = try {
+        extractNativeLibrary(bytes, userCacheDir(), cacheFileName)
+    } catch (e: Exception) {
+        error("Failed to extract native file picker library '$cacheFileName': ${e.message}")
+    }
 
-        "win" in osName ->
-            "windows" to "$LIB_NAME.dll"
+    @Suppress("UnsafeDynamicallyLoadedCode")
+    System.load(libraryFile.absolutePath)
+}
 
-        "nux" in osName || "nix" in osName ->
-            "linux" to "lib$LIB_NAME.so"
+/** Resource path inside the JAR and the platform file name of the bundled library. */
+private fun bundledLibraryLocation(): Pair<String, String> {
+    val osName = System.getProperty("os.name")?.lowercase().orEmpty()
+    val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
 
+    val (osPart, libFileName) = when {
+        "mac" in osName || "darwin" in osName -> "macos" to "lib$LIB_NAME.dylib"
+        "win" in osName -> "windows" to "$LIB_NAME.dll"
+        "nux" in osName || "nix" in osName -> "linux" to "lib$LIB_NAME.so"
         else -> error("Unsupported OS: $osName")
     }
 
-    val archPart = when {
-        osArch == "aarch64" || osArch == "arm64" -> "arm64"
-        osArch == "amd64" || osArch == "x86_64" -> "x64"
+    val archPart = when (osArch) {
+        "aarch64", "arm64" -> "arm64"
+        "amd64", "x86_64" -> "x64"
         else -> error("Unsupported architecture: $osArch")
     }
 
-    val resourcePath = "native/$osPart-$archPart/$libFileName"
-
-    val inputStream: InputStream = NativeFilePickerBridge::class.java.classLoader
-        ?.getResourceAsStream(resourcePath)
-        ?: error(
-            "Native library not found in JAR resources at '$resourcePath'. " +
-                "Ensure the native library is built for $osPart-$archPart."
-        )
+    return "native/$osPart-$archPart/$libFileName" to libFileName
+}
 
-    // Use a user-scoped cache directory to avoid shared /tmp security risks
+/** User-scoped cache directory, avoiding the security risks of a shared /tmp. */
+private fun userCacheDir(): File {
     val userHome = System.getProperty("user.home") ?: System.getProperty("java.io.tmpdir")
-    val cacheDir = File(userHome, ".cache/calf-filepicker")
-    cacheDir.mkdirs()
-
-    val targetFile = File(cacheDir, libFileName)
-
-    inputStream.use { input ->
-        val bytes = input.readBytes()
-        val tempFile = Files.createTempFile(cacheDir.toPath(), "calf-native-", ".tmp")
-        try {
-            Files.write(tempFile, bytes)
-            try {
-                Files.move(tempFile, targetFile.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
-            } catch (_: Exception) {
-                // ATOMIC_MOVE not supported on this filesystem, fallback to regular move
-                Files.move(tempFile, targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING)
-            }
-        } catch (e: Exception) {
-           
```

**File**: `calf-file-picker/src/desktopTest/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibCacheTest.kt` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+package com.mohamedrejeb.calf.picker.platform
+
+import java.io.File
+import kotlin.io.path.createTempDirectory
+import kotlin.test.AfterTest
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+import kotlin.test.assertContentEquals
+import kotlin.test.assertEquals
+import kotlin.test.assertNotEquals
+import kotlin.test.assertTrue
+
+class NativeLibCacheTest {
+
+    private lateinit var cacheDir: File
+
+    @BeforeTest
+    fun setUp() {
+        cacheDir = createTempDirectory("calf-native-cache-test").toFile()
+    }
+
+    @AfterTest
+    fun tearDown() {
+        cacheDir.deleteRecursively()
+    }
+
+    @Test
+    fun `cache file name inserts the hash before the extension`() {
+        assertEquals(
+            "calf_filepicker_native-0123456789abcdef.dll",
+            nativeLibraryCacheFileName("calf_filepicker_native.dll", "0123456789abcdef"),
+        )
+        assertEquals(
+            "libcalf_filepicker_native-0123456789abcdef.dylib",
+            nativeLibraryCacheFileName("libcalf_filepicker_native.dylib", "0123456789abcdef"),
+        )
+        assertEquals(
+            "libcalf_filepicker_native-0123456789abcdef.so",
+            nativeLibraryCacheFileName("libcalf_filepicker_native.so", "0123456789abcdef"),
+        )
+    }
+
+    @Test
+    fun `content hash is deterministic, differs per content and is 16 hex chars`() {
+        val first = nativeLibraryContentHash(byteArrayOf(1, 2, 3))
+        val same = nativeLibraryContentHash(byteArrayOf(1, 2, 3))
+        val other = nativeLibraryContentHash(byteArrayOf(1, 2, 4))
+
+        assertEquals(first, same)
+        assertNotEquals(first, other)
+        assertTrue(Regex("[0-9a-f]{16}").matches(first), "unexpected hash format: $first")
+    }
+
+    @Test
+    fun `extract writes the file with the exact bytes when it is missing`() {
+        val bytes = byteArrayOf(10, 20, 30, 40)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-aaaa.so")
+
+        assertEquals(File(cacheDir, "lib-aaaa.so"), loaded)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract reuses an existing identical file without rewriting it`() {
+        val bytes = byteArrayOf(7, 8, 9)
+        val target = File(cacheDir, "lib-bbbb.so").apply { writeBytes(bytes) }
+        val pastMillis = 1_000_000_000_000L
+        assertTrue(target.setLastModified(pastMillis))
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-bbbb.so")
+
+        assertEquals(target, loaded)
+        assertEquals(pastMillis, loaded.lastModified())
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract replaces an existing file whose bytes differ`() {
+        val target = File(cacheDir, "lib-cccc.so").apply { writeBytes(byteArrayOf(1, 1, 1)) }
+        val bytes = byteArrayOf(2, 2, 2, 2)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-cccc.so")
+
+        assertEquals(target, loaded)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract falls back to a unique file in the cache dir when the target cannot be replaced`() {
+        val blockedTarget = File(cacheDir, "lib-dddd.so")
+        assertTrue(blockedTarget.mkdir())
+        assertTrue(File(blockedTarget, "occupied").createNewFile())
+        val bytes = byteArrayOf(5, 5, 5)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-dddd.so")
+
+        assertNotEquals(blockedTarget, loaded)
+        assertEquals(cacheDir, loaded.parentFile)
+        assertTrue(loaded.isFile)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+}
```

**File**: `docs/filepicker.md` (modified, +6/-0)
```diff
@@ -156,6 +156,12 @@ Passing `null` (the default) allows unlimited selection. `FilePickerSelectionMod
 
 ## Desktop Setup
 
+#### Native library cache
+
+The desktop file picker relies on a small native library bundled inside the JAR. On first use it is extracted to `~/.cache/calf-filepicker/`. The cached file name includes a hash of the library's content, so several applications, product flavors, or Calf versions running on the same machine never overwrite each other's copy, and an identical library that is already present is reused as is.
+
+Packagers that place the library on the system library path (for example Conveyor) skip the extraction entirely, since the loader tries `System.loadLibrary` first.
+
 #### macOS Dark Theme
 
 The file dialog follows the application's theme. To enable dark mode support on macOS, add this JVM argument to your Gradle configuration:
```

---

### Incident Patch 10: `a1fc1000` (2026-09-11)
**Commit Message**: Merge pull request #539 from MohamedRejeb/fix/alert-dialog-single-button

fix(ui): allow single-button AdaptiveAlertDialog by making dismissText optional

**File**: `calf-ui/build.gradle.kts` (modified, +9/-0)
```diff
@@ -11,6 +11,15 @@ kotlin {
         implementation(libs.kotlinx.coroutines.core)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.activity.compose)
         implementation(libs.kotlinx.coroutines.android)
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialog.kt` (modified, +5/-2)
```diff
@@ -28,8 +28,11 @@ import com.mohamedrejeb.calf.ui.dialog.uikit.rememberAlertDialogIosProperties
  * If materialDismissButton is provided, this lambda will not be used for non-iOS platforms.
  * @param confirmText The text of the confirm button.
  * if materialConfirmButton is provided, this text will not be used for non-iOS platforms.
- * @param dismissText The text of the dismiss button.
+ * @param dismissText The text of the dismiss button. Pass null, or a blank string, to show a
+ * single-button dialog with only the confirm button.
  * if materialDismissButton is provided, this text will not be used for non-iOS platforms.
+ * On iOS the set of buttons is fixed when the dialog is first presented, so switching
+ * between null and a value while the dialog is shown only takes effect once it is shown again.
  * @param title The title of the dialog.
  * if materialTitle is provided, this text will not be used for non-iOS platforms.
  * @param text The text of the dialog.
@@ -63,7 +66,7 @@ expect fun AdaptiveAlertDialog(
     onConfirm: () -> Unit,
     onDismiss: () -> Unit,
     confirmText: String,
-    dismissText: String,
+    dismissText: String? = null,
     title: String,
     text: String,
 
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogActions.kt` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosAction
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
+
+/**
+ * Resolves the label of the dismiss button shown by [AdaptiveAlertDialog].
+ *
+ * Both null and blank text mean "no dismiss button". A blank label would otherwise
+ * render an empty but tappable button, which is never a valid dialog.
+ */
+internal fun dismissLabelOrNull(dismissText: String?): String? =
+    dismissText?.takeIf { it.isNotBlank() }
+
+/**
+ * Builds the native iOS actions shown by [AdaptiveAlertDialog].
+ *
+ * The confirm action always comes first. The dismiss action is only added when
+ * [dismissText] resolves to a label through [dismissLabelOrNull], which is how a
+ * single-button dialog is expressed.
+ */
+internal fun adaptiveAlertDialogIosActions(
+    confirmText: String,
+    dismissText: String?,
+    onConfirm: () -> Unit,
+    onDismiss: () -> Unit,
+    confirmStyle: AlertDialogIosActionStyle,
+    dismissStyle: AlertDialogIosActionStyle,
+    confirmIsPreferred: Boolean,
+): List<AlertDialogIosAction> = listOfNotNull(
+    AlertDialogIosAction(
+        title = confirmText,
+        style = confirmStyle,
+        onClick = onConfirm,
+        isPreferred = confirmIsPreferred,
+    ),
+    dismissLabelOrNull(dismissText)?.let { label ->
+        AlertDialogIosAction(
+            title = label,
+            style = dismissStyle,
+            onClick = onDismiss,
+        )
+    },
+)
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogActionsTest.kt` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+class AdaptiveAlertDialogActionsTest {
+
+    @Test
+    fun `builds only the confirm action when dismissText is null`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = null,
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        assertEquals(listOf("OK"), actions.map { it.title })
+    }
+
+    @Test
+    fun `builds only the confirm action when dismissText is blank`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "   ",
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        assertEquals(listOf("OK"), actions.map { it.title })
+    }
+
+    @Test
+    fun `builds confirm then dismiss action when dismissText is provided`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "Cancel",
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Destructive,
+            confirmIsPreferred = true,
+        )
+
+        assertEquals(listOf("OK", "Cancel"), actions.map { it.title })
+        assertEquals(
+            listOf(AlertDialogIosActionStyle.Default, AlertDialogIosActionStyle.Destructive),
+            actions.map { it.style },
+        )
+        assertEquals(listOf(true, false), actions.map { it.isPreferred })
+    }
+
+    @Test
+    fun `wires confirm and dismiss callbacks to their own actions`() {
+        var confirmed = false
+        var dismissed = false
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "Cancel",
+            onConfirm = { confirmed = true },
+            onDismiss = { dismissed = true },
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        actions[0].onClick()
+        assertTrue(confirmed)
+        assertFalse(dismissed)
+
+        actions[1].onClick()
+        assertTrue(dismissed)
+    }
+}
```

**File**: `calf-ui/src/desktopTest/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogMaterialTest.kt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import androidx.compose.material3.Text
+import androidx.compose.material3.TextButton
+import androidx.compose.ui.semantics.Role
+import androidx.compose.ui.semantics.SemanticsProperties
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.SemanticsMatcher
+import androidx.compose.ui.test.assertCountEquals
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveAlertDialogMaterialTest {
+
+    private val isButton = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)
+
+    @Test
+    fun `shows only the confirm button when dismissText is null`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = null,
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(1)
+    }
+
+    @Test
+    fun `shows only the confirm button when dismissText is blank`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = "   ",
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(1)
+    }
+
+    @Test
+    fun `renders materialDismissButton even when dismissText is null`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = null,
+                title = "Title",
+                text = "Message",
+                materialDismissButton = {
+                    TextButton(onClick = {}) {
+                        Text("Custom")
+                    }
+                },
+            )
+        }
+
+        onNodeWithText("Custom").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(2)
+    }
+
+    @Test
+    fun `shows confirm and dismiss buttons when dismissText is provided`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = "Cancel",
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onNodeWithText("Cancel").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(2)
+    }
+}
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialog.ios.kt` (modified, +9/-14)
```diff
@@ -12,7 +12,6 @@ import androidx.compose.ui.uikit.LocalUIViewController
 import androidx.compose.ui.unit.Dp
 import androidx.compose.ui.window.DialogProperties
 import com.mohamedrejeb.calf.core.InternalCalfApi
-import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosAction
 import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
 import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosProperties
 import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosStyle
@@ -23,7 +22,7 @@ actual fun AdaptiveAlertDialog(
     onConfirm: () -> Unit,
     onDismiss: () -> Unit,
     confirmText: String,
-    dismissText: String,
+    dismissText: String?,
     title: String,
     text: String,
     materialConfirmButton: @Composable (() -> Unit)?,
@@ -52,18 +51,14 @@ actual fun AdaptiveAlertDialog(
             title = title,
             text = text,
             style = iosDialogStyle,
-            actions = listOf(
-                AlertDialogIosAction(
-                    title = confirmText,
-                    style = iosConfirmButtonStyle,
-                    onClick = onConfirm,
-                    isPreferred = iosConfirmButtonIsPreferred,
-                ),
-                AlertDialogIosAction(
-                    title = dismissText,
-                    style = iosDismissButtonStyle,
-                    onClick = onDismiss,
-                )
+            actions = adaptiveAlertDialogIosActions(
+                confirmText = confirmText,
+                dismissText = dismissText,
+                onConfirm = onConfirm,
+                onDismiss = onDismiss,
+                confirmStyle = iosConfirmButtonStyle,
+                dismissStyle = iosDismissButtonStyle,
+                confirmIsPreferred = iosConfirmButtonIsPreferred,
             ),
         )
     }
```

**File**: `calf-ui/src/materialMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialog.material.kt` (modified, +13/-8)
```diff
@@ -21,7 +21,7 @@ actual fun AdaptiveAlertDialog(
     onConfirm: () -> Unit,
     onDismiss: () -> Unit,
     confirmText: String,
-    dismissText: String,
+    dismissText: String?,
     title: String,
     text: String,
     materialConfirmButton: @Composable (() -> Unit)?,
@@ -42,6 +42,17 @@ actual fun AdaptiveAlertDialog(
     properties: DialogProperties,
     modifier: Modifier,
 ) {
+    val dismissButton: (@Composable () -> Unit)? = materialDismissButton
+        ?: dismissLabelOrNull(dismissText)?.let { label ->
+            {
+                Button(
+                    onClick = onDismiss,
+                ) {
+                    Text(label)
+                }
+            }
+        }
+
     AlertDialog(
         onDismissRequest = onDismiss,
         confirmButton = materialConfirmButton ?: {
@@ -51,13 +62,7 @@ actual fun AdaptiveAlertDialog(
                 Text(confirmText)
             }
         },
-        dismissButton = materialDismissButton ?: {
-            Button(
-                onClick = onDismiss,
-            ) {
-                Text(dismissText)
-            }
-        },
+        dismissButton = dismissButton,
         icon = materialIcon,
         title = materialTitle ?: {
             Text(title)
```

**File**: `docs/ui/adaptive-alert-dialog.md` (modified, +19/-1)
```diff
@@ -13,7 +13,7 @@ Both composables use native `UIAlertController` on iOS and Material dialogs on o
 
 ## AdaptiveAlertDialog
 
-The `AdaptiveAlertDialog` composable provides a simple API with predefined confirm and dismiss buttons. It's ideal for common dialog scenarios where you just need to show a message with two action buttons.
+The `AdaptiveAlertDialog` composable provides a simple API with predefined confirm and dismiss buttons. It's ideal for common dialog scenarios where you just need to show a message with one or two action buttons.
 
 ```kotlin
 // State to control dialog visibility
@@ -49,6 +49,24 @@ if (showDialog) {
 }
 ```
 
+### Single-button dialog
+
+`dismissText` is optional. Leave it out, pass `null`, or pass a blank string to show only the confirm button. On iOS this presents a single `UIAlertAction`; on Material platforms the `AlertDialog` is rendered without a dismiss button.
+
+```kotlin
+if (showInfoDialog) {
+    AdaptiveAlertDialog(
+        onConfirm = { showInfoDialog = false },
+        onDismiss = { showInfoDialog = false },
+        confirmText = "OK",
+        title = "Saved",
+        text = "Your changes have been saved.",
+    )
+}
+```
+
+`onDismiss` is still invoked when the user taps outside the dialog or presses back, so it stays required. On iOS the set of buttons is fixed when the dialog is first presented: toggling `dismissText` between `null` and a value while the dialog is visible takes effect the next time it is shown.
+
 ## AdaptiveBasicAlertDialog
 
 The `AdaptiveBasicAlertDialog` composable provides a more flexible API that allows fully custom content on Material platforms and advanced configuration on iOS through the `iosProperties` parameter. It's marked with `@ExperimentalCalfUiApi` annotation.
```

---

### Incident Patch 11: `befc4557` (2026-09-10)
**Commit Message**: fix(file-picker): reuse identical cached native library instead of replacing it

Closes #534.

Two apps bundling the same picker extracted the native library to one fixed path, and on Windows the second app failed because the first had the DLL loaded and locked. The cached copy is now named with a content hash, an existing identical file is reused untouched, and if the target still cannot be replaced the loader falls back to a unique temp file instead of failing.

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibCache.kt` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+package com.mohamedrejeb.calf.picker.platform
+
+import java.io.File
+import java.nio.file.Files
+import java.nio.file.Path
+import java.nio.file.StandardCopyOption
+import java.security.MessageDigest
+
+private const val HASH_ALGORITHM = "SHA-256"
+private const val HASH_LENGTH = 16
+private const val TEMP_PREFIX = "calf-native-"
+private const val TEMP_SUFFIX = ".tmp"
+
+/**
+ * Short, stable fingerprint of a native library's bytes.
+ *
+ * Used to name the cached copy so that different builds of the library
+ * never share a file on disk.
+ */
+internal fun nativeLibraryContentHash(bytes: ByteArray): String =
+    MessageDigest.getInstance(HASH_ALGORITHM)
+        .digest(bytes)
+        .joinToString("") { "%02x".format(it) }
+        .take(HASH_LENGTH)
+
+/**
+ * Inserts [contentHash] before the extension of [libFileName],
+ * e.g. `calf_filepicker_native.dll` -> `calf_filepicker_native-<hash>.dll`.
+ */
+internal fun nativeLibraryCacheFileName(libFileName: String, contentHash: String): String {
+    val extension = libFileName.substringAfterLast('.', missingDelimiterValue = "")
+    val baseName = libFileName.substringBeforeLast('.')
+    return if (extension.isEmpty()) "$baseName-$contentHash" else "$baseName-$contentHash.$extension"
+}
+
+/**
+ * Makes [bytes] available as a file inside [cacheDir] and returns the file to load.
+ *
+ * - An existing target with identical content is reused untouched, so a library
+ *   that another process has already loaded (and locked, on Windows) is never
+ *   replaced.
+ * - Otherwise the bytes are written to a temp file and moved over the target.
+ * - If the move fails for any reason, the unique temp file itself is returned
+ *   and scheduled for deletion on exit, so loading still succeeds.
+ */
+internal fun extractNativeLibrary(bytes: ByteArray, cacheDir: File, fileName: String): File {
+    cacheDir.mkdirs()
+    val target = File(cacheDir, fileName)
+    if (hasIdenticalContent(target, bytes)) return target
+
+    val tempFile = Files.createTempFile(cacheDir.toPath(), TEMP_PREFIX, TEMP_SUFFIX)
+    Files.write(tempFile, bytes)
+
+    return runCatching { moveReplacing(tempFile, target.toPath()) }
+        .map { target }
+        .getOrElse { tempFile.toFile().also { it.deleteOnExit() } }
+}
+
+private fun hasIdenticalContent(file: File, bytes: ByteArray): Boolean =
+    file.isFile &&
+        file.length() == bytes.size.toLong() &&
+        nativeLibraryContentHash(file.readBytes()) == nativeLibraryContentHash(bytes)
+
+private fun moveReplacing(source: Path, target: Path) {
+    try {
+        Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
+    } catch (_: Exception) {
+        // ATOMIC_MOVE is not supported on every filesystem; retry with a plain replace.
+        Files.move(source, target, StandardCopyOption.REPLACE_EXISTING)
+    }
+}
```

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibLoader.kt` (modified, +40/-54)
```diff
@@ -1,84 +1,70 @@
 package com.mohamedrejeb.calf.picker.platform
 
 import java.io.File
-import java.io.InputStream
-import java.nio.file.Files
-import java.nio.file.StandardCopyOption
 
 private const val LIB_NAME = "calf_filepicker_native"
+private const val CACHE_DIR = ".cache/calf-filepicker"
 
 /**
- * Loads the native file picker library from JAR resources.
+ * Loads the native file picker library.
  *
- * The library is expected at: native/<os>-<arch>/<libFileName>
- * It is extracted to a user-scoped cache directory and loaded via [System.load].
+ * The system library path is tried first (packagers like Conveyor extract natives
+ * out of the jar). Otherwise the library is read from JAR resources at
+ * `native/<os>-<arch>/<libFileName>`, cached under a content-hashed name in a
+ * user-scoped directory, and loaded via [System.load].
  *
- * Called once from [NativeFilePickerBridge]'s object init block
+ * Called once from [NativeFilePickerBridge]'s object init block.
  */
 internal fun loadNativeLibrary() {
-    // Try the system path first (packagers like Conveyor extract natives
-    // out of the jar), then fall back to the bundled resource.
     try {
         System.loadLibrary(LIB_NAME)
         return
     } catch (_: UnsatisfiedLinkError) {
     }
 
-    val osName = System.getProperty("os.name")?.lowercase().orEmpty()
-    val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
+    val (resourcePath, libFileName) = bundledLibraryLocation()
+    val bytes = NativeFilePickerBridge::class.java.classLoader
+        ?.getResourceAsStream(resourcePath)
+        ?.use { it.readBytes() }
+        ?: error(
+            "Native library not found in JAR resources at '$resourcePath'. " +
+                "Ensure the native library is built for this platform."
+        )
 
-    val (osPart, libFileName) = when {
-        "mac" in osName || "darwin" in osName ->
-            "macos" to "lib$LIB_NAME.dylib"
+    val cacheFileName = nativeLibraryCacheFileName(libFileName, nativeLibraryContentHash(bytes))
+    val libraryFile = try {
+        extractNativeLibrary(bytes, userCacheDir(), cacheFileName)
+    } catch (e: Exception) {
+        error("Failed to extract native file picker library '$cacheFileName': ${e.message}")
+    }
 
-        "win" in osName ->
-            "windows" to "$LIB_NAME.dll"
+    @Suppress("UnsafeDynamicallyLoadedCode")
+    System.load(libraryFile.absolutePath)
+}
 
-        "nux" in osName || "nix" in osName ->
-            "linux" to "lib$LIB_NAME.so"
+/** Resource path inside the JAR and the platform file name of the bundled library. */
+private fun bundledLibraryLocation(): Pair<String, String> {
+    val osName = System.getProperty("os.name")?.lowercase().orEmpty()
+    val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
 
+    val (osPart, libFileName) = when {
+        "mac" in osName || "darwin" in osName -> "macos" to "lib$LIB_NAME.dylib"
+        "win" in osName -> "windows" to "$LIB_NAME.dll"
+        "nux" in osName || "nix" in osName -> "linux" to "lib$LIB_NAME.so"
         else -> error("Unsupported OS: $osName")
     }
 
-    val archPart = when {
-        osArch == "aarch64" || osArch == "arm64" -> "arm64"
-        osArch == "amd64" || osArch == "x86_64" -> "x64"
+    val archPart = when (osArch) {
+        "aarch64", "arm64" -> "arm64"
+        "amd64", "x86_64" -> "x64"
         else -> error("Unsupported architecture: $osArch")
     }
 
-    val resourcePath = "native/$osPart-$archPart/$libFileName"
-
-    val inputStream: InputStream = NativeFilePickerBridge::class.java.classLoader
-        ?.getResourceAsStream(resourcePath)
-        ?: error(
-            "Native library not found in JAR resources at '$resourcePath'. " +
-                "Ensure the native library is built for $osPart-$archPart."
-        )
+    return "native/$osPart-$archPart/$libFileName" to libFileName
+}
 
-    // Use a user-scoped cache directory to avoid shared /tmp security risks
+/** User-scoped cache directory, avoiding the security risks of a shared /tmp. */
+private fun userCacheDir(): File {
     val userHome = System.getProperty("user.home") ?: System.getProperty("java.io.tmpdir")
-    val cacheDir = File(userHome, ".cache/calf-filepicker")
-    cacheDir.mkdirs()
-
-    val targetFile = File(cacheDir, libFileName)
-
-    inputStream.use { input ->
-        val bytes = input.readBytes()
-        val tempFile = Files.createTempFile(cacheDir.toPath(), "calf-native-", ".tmp")
-        try {
-            Files.write(tempFile, bytes)
-            try {
-                Files.move(tempFile, targetFile.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
-            } catch (_: Exception) {
-                // ATOMIC_MOVE not supported on this filesystem, fallback to regular move
-                Files.move(tempFile, targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING)
-            }
-        } catch (e: Exception) {
-           
```

**File**: `calf-file-picker/src/desktopTest/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibCacheTest.kt` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+package com.mohamedrejeb.calf.picker.platform
+
+import java.io.File
+import kotlin.io.path.createTempDirectory
+import kotlin.test.AfterTest
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+import kotlin.test.assertContentEquals
+import kotlin.test.assertEquals
+import kotlin.test.assertNotEquals
+import kotlin.test.assertTrue
+
+class NativeLibCacheTest {
+
+    private lateinit var cacheDir: File
+
+    @BeforeTest
+    fun setUp() {
+        cacheDir = createTempDirectory("calf-native-cache-test").toFile()
+    }
+
+    @AfterTest
+    fun tearDown() {
+        cacheDir.deleteRecursively()
+    }
+
+    @Test
+    fun `cache file name inserts the hash before the extension`() {
+        assertEquals(
+            "calf_filepicker_native-0123456789abcdef.dll",
+            nativeLibraryCacheFileName("calf_filepicker_native.dll", "0123456789abcdef"),
+        )
+        assertEquals(
+            "libcalf_filepicker_native-0123456789abcdef.dylib",
+            nativeLibraryCacheFileName("libcalf_filepicker_native.dylib", "0123456789abcdef"),
+        )
+        assertEquals(
+            "libcalf_filepicker_native-0123456789abcdef.so",
+            nativeLibraryCacheFileName("libcalf_filepicker_native.so", "0123456789abcdef"),
+        )
+    }
+
+    @Test
+    fun `content hash is deterministic, differs per content and is 16 hex chars`() {
+        val first = nativeLibraryContentHash(byteArrayOf(1, 2, 3))
+        val same = nativeLibraryContentHash(byteArrayOf(1, 2, 3))
+        val other = nativeLibraryContentHash(byteArrayOf(1, 2, 4))
+
+        assertEquals(first, same)
+        assertNotEquals(first, other)
+        assertTrue(Regex("[0-9a-f]{16}").matches(first), "unexpected hash format: $first")
+    }
+
+    @Test
+    fun `extract writes the file with the exact bytes when it is missing`() {
+        val bytes = byteArrayOf(10, 20, 30, 40)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-aaaa.so")
+
+        assertEquals(File(cacheDir, "lib-aaaa.so"), loaded)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract reuses an existing identical file without rewriting it`() {
+        val bytes = byteArrayOf(7, 8, 9)
+        val target = File(cacheDir, "lib-bbbb.so").apply { writeBytes(bytes) }
+        val pastMillis = 1_000_000_000_000L
+        assertTrue(target.setLastModified(pastMillis))
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-bbbb.so")
+
+        assertEquals(target, loaded)
+        assertEquals(pastMillis, loaded.lastModified())
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract replaces an existing file whose bytes differ`() {
+        val target = File(cacheDir, "lib-cccc.so").apply { writeBytes(byteArrayOf(1, 1, 1)) }
+        val bytes = byteArrayOf(2, 2, 2, 2)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-cccc.so")
+
+        assertEquals(target, loaded)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+
+    @Test
+    fun `extract falls back to a unique file in the cache dir when the target cannot be replaced`() {
+        val blockedTarget = File(cacheDir, "lib-dddd.so")
+        assertTrue(blockedTarget.mkdir())
+        assertTrue(File(blockedTarget, "occupied").createNewFile())
+        val bytes = byteArrayOf(5, 5, 5)
+
+        val loaded = extractNativeLibrary(bytes, cacheDir, "lib-dddd.so")
+
+        assertNotEquals(blockedTarget, loaded)
+        assertEquals(cacheDir, loaded.parentFile)
+        assertTrue(loaded.isFile)
+        assertContentEquals(bytes, loaded.readBytes())
+    }
+}
```

**File**: `docs/filepicker.md` (modified, +6/-0)
```diff
@@ -156,6 +156,12 @@ Passing `null` (the default) allows unlimited selection. `FilePickerSelectionMod
 
 ## Desktop Setup
 
+#### Native library cache
+
+The desktop file picker relies on a small native library bundled inside the JAR. On first use it is extracted to `~/.cache/calf-filepicker/`. The cached file name includes a hash of the library's content, so several applications, product flavors, or Calf versions running on the same machine never overwrite each other's copy, and an identical library that is already present is reused as is.
+
+Packagers that place the library on the system library path (for example Conveyor) skip the extraction entirely, since the loader tries `System.loadLibrary` first.
+
 #### macOS Dark Theme
 
 The file dialog follows the application's theme. To enable dark mode support on macOS, add this JVM argument to your Gradle configuration:
```

---

### Incident Patch 12: `248fd08e` (2026-09-10)
**Commit Message**: fix(ui): allow single-button AdaptiveAlertDialog by making dismissText optional

Closes #536.

AdaptiveAlertDialog always rendered two buttons, so on iOS an empty
dismissText produced a blank UIAlertAction and on Material an empty
button. dismissText is now `String? = null`; null or blank text drops
the dismiss action/button on every platform.

- Extract the iOS action list into adaptiveAlertDialogIosActions
  (commonMain, internal) so the logic is unit-tested without a simulator
- Add dismissLabelOrNull shared by the iOS and Material actuals
- Add calf-ui commonTest and desktopTest (Compose ui-test on desktop)
- Sample: "Single Button Alert Dialog" section in AlertDialogScreen
- Docs: single-button section in docs/ui/adaptive-alert-dialog.md

**File**: `calf-ui/build.gradle.kts` (modified, +9/-0)
```diff
@@ -11,6 +11,15 @@ kotlin {
         implementation(libs.kotlinx.coroutines.core)
     }
 
+    sourceSets.commonTest.dependencies {
+        implementation(libs.kotlin.test)
+    }
+
+    sourceSets.desktopTest.dependencies {
+        implementation(libs.compose.ui.test)
+        implementation(compose.desktop.currentOs)
+    }
+
     sourceSets.androidMain.dependencies {
         implementation(libs.activity.compose)
         implementation(libs.kotlinx.coroutines.android)
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialog.kt` (modified, +5/-2)
```diff
@@ -28,8 +28,11 @@ import com.mohamedrejeb.calf.ui.dialog.uikit.rememberAlertDialogIosProperties
  * If materialDismissButton is provided, this lambda will not be used for non-iOS platforms.
  * @param confirmText The text of the confirm button.
  * if materialConfirmButton is provided, this text will not be used for non-iOS platforms.
- * @param dismissText The text of the dismiss button.
+ * @param dismissText The text of the dismiss button. Pass null, or a blank string, to show a
+ * single-button dialog with only the confirm button.
  * if materialDismissButton is provided, this text will not be used for non-iOS platforms.
+ * On iOS the set of buttons is fixed when the dialog is first presented, so switching
+ * between null and a value while the dialog is shown only takes effect once it is shown again.
  * @param title The title of the dialog.
  * if materialTitle is provided, this text will not be used for non-iOS platforms.
  * @param text The text of the dialog.
@@ -63,7 +66,7 @@ expect fun AdaptiveAlertDialog(
     onConfirm: () -> Unit,
     onDismiss: () -> Unit,
     confirmText: String,
-    dismissText: String,
+    dismissText: String? = null,
     title: String,
     text: String,
 
```

**File**: `calf-ui/src/commonMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogActions.kt` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosAction
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
+
+/**
+ * Resolves the label of the dismiss button shown by [AdaptiveAlertDialog].
+ *
+ * Both null and blank text mean "no dismiss button". A blank label would otherwise
+ * render an empty but tappable button, which is never a valid dialog.
+ */
+internal fun dismissLabelOrNull(dismissText: String?): String? =
+    dismissText?.takeIf { it.isNotBlank() }
+
+/**
+ * Builds the native iOS actions shown by [AdaptiveAlertDialog].
+ *
+ * The confirm action always comes first. The dismiss action is only added when
+ * [dismissText] resolves to a label through [dismissLabelOrNull], which is how a
+ * single-button dialog is expressed.
+ */
+internal fun adaptiveAlertDialogIosActions(
+    confirmText: String,
+    dismissText: String?,
+    onConfirm: () -> Unit,
+    onDismiss: () -> Unit,
+    confirmStyle: AlertDialogIosActionStyle,
+    dismissStyle: AlertDialogIosActionStyle,
+    confirmIsPreferred: Boolean,
+): List<AlertDialogIosAction> = listOfNotNull(
+    AlertDialogIosAction(
+        title = confirmText,
+        style = confirmStyle,
+        onClick = onConfirm,
+        isPreferred = confirmIsPreferred,
+    ),
+    dismissLabelOrNull(dismissText)?.let { label ->
+        AlertDialogIosAction(
+            title = label,
+            style = dismissStyle,
+            onClick = onDismiss,
+        )
+    },
+)
```

**File**: `calf-ui/src/commonTest/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogActionsTest.kt` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+class AdaptiveAlertDialogActionsTest {
+
+    @Test
+    fun `builds only the confirm action when dismissText is null`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = null,
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        assertEquals(listOf("OK"), actions.map { it.title })
+    }
+
+    @Test
+    fun `builds only the confirm action when dismissText is blank`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "   ",
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        assertEquals(listOf("OK"), actions.map { it.title })
+    }
+
+    @Test
+    fun `builds confirm then dismiss action when dismissText is provided`() {
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "Cancel",
+            onConfirm = {},
+            onDismiss = {},
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Destructive,
+            confirmIsPreferred = true,
+        )
+
+        assertEquals(listOf("OK", "Cancel"), actions.map { it.title })
+        assertEquals(
+            listOf(AlertDialogIosActionStyle.Default, AlertDialogIosActionStyle.Destructive),
+            actions.map { it.style },
+        )
+        assertEquals(listOf(true, false), actions.map { it.isPreferred })
+    }
+
+    @Test
+    fun `wires confirm and dismiss callbacks to their own actions`() {
+        var confirmed = false
+        var dismissed = false
+        val actions = adaptiveAlertDialogIosActions(
+            confirmText = "OK",
+            dismissText = "Cancel",
+            onConfirm = { confirmed = true },
+            onDismiss = { dismissed = true },
+            confirmStyle = AlertDialogIosActionStyle.Default,
+            dismissStyle = AlertDialogIosActionStyle.Cancel,
+            confirmIsPreferred = false,
+        )
+
+        actions[0].onClick()
+        assertTrue(confirmed)
+        assertFalse(dismissed)
+
+        actions[1].onClick()
+        assertTrue(dismissed)
+    }
+}
```

**File**: `calf-ui/src/desktopTest/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialogMaterialTest.kt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package com.mohamedrejeb.calf.ui.dialog
+
+import androidx.compose.material3.Text
+import androidx.compose.material3.TextButton
+import androidx.compose.ui.semantics.Role
+import androidx.compose.ui.semantics.SemanticsProperties
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.SemanticsMatcher
+import androidx.compose.ui.test.assertCountEquals
+import androidx.compose.ui.test.assertIsDisplayed
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.v2.runComposeUiTest
+import kotlin.test.Test
+
+@OptIn(ExperimentalTestApi::class)
+class AdaptiveAlertDialogMaterialTest {
+
+    private val isButton = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)
+
+    @Test
+    fun `shows only the confirm button when dismissText is null`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = null,
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(1)
+    }
+
+    @Test
+    fun `shows only the confirm button when dismissText is blank`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = "   ",
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(1)
+    }
+
+    @Test
+    fun `renders materialDismissButton even when dismissText is null`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = null,
+                title = "Title",
+                text = "Message",
+                materialDismissButton = {
+                    TextButton(onClick = {}) {
+                        Text("Custom")
+                    }
+                },
+            )
+        }
+
+        onNodeWithText("Custom").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(2)
+    }
+
+    @Test
+    fun `shows confirm and dismiss buttons when dismissText is provided`() = runComposeUiTest {
+        setContent {
+            AdaptiveAlertDialog(
+                onConfirm = {},
+                onDismiss = {},
+                confirmText = "OK",
+                dismissText = "Cancel",
+                title = "Title",
+                text = "Message",
+            )
+        }
+
+        onNodeWithText("OK").assertIsDisplayed()
+        onNodeWithText("Cancel").assertIsDisplayed()
+        onAllNodes(isButton).assertCountEquals(2)
+    }
+}
```

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialog.ios.kt` (modified, +9/-14)
```diff
@@ -12,7 +12,6 @@ import androidx.compose.ui.uikit.LocalUIViewController
 import androidx.compose.ui.unit.Dp
 import androidx.compose.ui.window.DialogProperties
 import com.mohamedrejeb.calf.core.InternalCalfApi
-import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosAction
 import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosActionStyle
 import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosProperties
 import com.mohamedrejeb.calf.ui.dialog.uikit.AlertDialogIosStyle
@@ -23,7 +22,7 @@ actual fun AdaptiveAlertDialog(
     onConfirm: () -> Unit,
     onDismiss: () -> Unit,
     confirmText: String,
-    dismissText: String,
+    dismissText: String?,
     title: String,
     text: String,
     materialConfirmButton: @Composable (() -> Unit)?,
@@ -52,18 +51,14 @@ actual fun AdaptiveAlertDialog(
             title = title,
             text = text,
             style = iosDialogStyle,
-            actions = listOf(
-                AlertDialogIosAction(
-                    title = confirmText,
-                    style = iosConfirmButtonStyle,
-                    onClick = onConfirm,
-                    isPreferred = iosConfirmButtonIsPreferred,
-                ),
-                AlertDialogIosAction(
-                    title = dismissText,
-                    style = iosDismissButtonStyle,
-                    onClick = onDismiss,
-                )
+            actions = adaptiveAlertDialogIosActions(
+                confirmText = confirmText,
+                dismissText = dismissText,
+                onConfirm = onConfirm,
+                onDismiss = onDismiss,
+                confirmStyle = iosConfirmButtonStyle,
+                dismissStyle = iosDismissButtonStyle,
+                confirmIsPreferred = iosConfirmButtonIsPreferred,
             ),
         )
     }
```

**File**: `calf-ui/src/materialMain/kotlin/com/mohamedrejeb/calf/ui/dialog/AdaptiveAlertDialog.material.kt` (modified, +13/-8)
```diff
@@ -21,7 +21,7 @@ actual fun AdaptiveAlertDialog(
     onConfirm: () -> Unit,
     onDismiss: () -> Unit,
     confirmText: String,
-    dismissText: String,
+    dismissText: String?,
     title: String,
     text: String,
     materialConfirmButton: @Composable (() -> Unit)?,
@@ -42,6 +42,17 @@ actual fun AdaptiveAlertDialog(
     properties: DialogProperties,
     modifier: Modifier,
 ) {
+    val dismissButton: (@Composable () -> Unit)? = materialDismissButton
+        ?: dismissLabelOrNull(dismissText)?.let { label ->
+            {
+                Button(
+                    onClick = onDismiss,
+                ) {
+                    Text(label)
+                }
+            }
+        }
+
     AlertDialog(
         onDismissRequest = onDismiss,
         confirmButton = materialConfirmButton ?: {
@@ -51,13 +62,7 @@ actual fun AdaptiveAlertDialog(
                 Text(confirmText)
             }
         },
-        dismissButton = materialDismissButton ?: {
-            Button(
-                onClick = onDismiss,
-            ) {
-                Text(dismissText)
-            }
-        },
+        dismissButton = dismissButton,
         icon = materialIcon,
         title = materialTitle ?: {
             Text(title)
```

**File**: `docs/ui/adaptive-alert-dialog.md` (modified, +19/-1)
```diff
@@ -13,7 +13,7 @@ Both composables use native `UIAlertController` on iOS and Material dialogs on o
 
 ## AdaptiveAlertDialog
 
-The `AdaptiveAlertDialog` composable provides a simple API with predefined confirm and dismiss buttons. It's ideal for common dialog scenarios where you just need to show a message with two action buttons.
+The `AdaptiveAlertDialog` composable provides a simple API with predefined confirm and dismiss buttons. It's ideal for common dialog scenarios where you just need to show a message with one or two action buttons.
 
 ```kotlin
 // State to control dialog visibility
@@ -49,6 +49,24 @@ if (showDialog) {
 }
 ```
 
+### Single-button dialog
+
+`dismissText` is optional. Leave it out, pass `null`, or pass a blank string to show only the confirm button. On iOS this presents a single `UIAlertAction`; on Material platforms the `AlertDialog` is rendered without a dismiss button.
+
+```kotlin
+if (showInfoDialog) {
+    AdaptiveAlertDialog(
+        onConfirm = { showInfoDialog = false },
+        onDismiss = { showInfoDialog = false },
+        confirmText = "OK",
+        title = "Saved",
+        text = "Your changes have been saved.",
+    )
+}
+```
+
+`onDismiss` is still invoked when the user taps outside the dialog or presses back, so it stays required. On iOS the set of buttons is fixed when the dialog is first presented: toggling `dismissText` between `null` and a value while the dialog is visible takes effect the next time it is shown.
+
 ## AdaptiveBasicAlertDialog
 
 The `AdaptiveBasicAlertDialog` composable provides a more flexible API that allows fully custom content on Material platforms and advanced configuration on iOS through the `iosProperties` parameter. It's marked with `@ExperimentalCalfUiApi` annotation.
```

---

### Incident Patch 13: `b2a90d51` (2026-07-26)
**Commit Message**: fix(sample): remove stale CanvasBasedWindow imports from web samples

**File**: `sample/web-js/src/jsMain/kotlin/Main.kt` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.ui.ExperimentalComposeUiApi
 import androidx.compose.ui.Modifier
-import androidx.compose.ui.window.CanvasBasedWindow
 import androidx.compose.ui.window.ComposeViewport
 import com.mohamedrejeb.calf.sample.App
 import org.jetbrains.skiko.wasm.onWasmReady
```

**File**: `sample/web-wasm/src/wasmJsMain/kotlin/Main.kt` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.ui.ExperimentalComposeUiApi
 import androidx.compose.ui.Modifier
-import androidx.compose.ui.window.CanvasBasedWindow
 import androidx.compose.ui.window.ComposeViewport
 import com.mohamedrejeb.calf.sample.App
 
```

---

### Incident Patch 14: `ce4af64a` (2026-07-26)
**Commit Message**: fix(ios): convert Skia shader to Compose shader in InteractiveHighlight

**File**: `calf-ui/src/iosMain/kotlin/com/mohamedrejeb/calf/ui/utils/InteractiveHighlight.kt` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@ import androidx.compose.ui.geometry.Size
 import androidx.compose.ui.graphics.BlendMode
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.ShaderBrush
+import androidx.compose.ui.graphics.asComposeShader
 import androidx.compose.ui.input.pointer.pointerInput
 import androidx.compose.ui.util.fastCoerceIn
 import com.kyant.backdrop.RuntimeShader
@@ -79,7 +80,7 @@ half4 main(float2 coord) {
                         )
                     }
                     drawRect(
-                        ShaderBrush(shader.asSkikoRuntimeShader().makeShader()),
+                        ShaderBrush(shader.asSkikoRuntimeShader().makeShader().asComposeShader()),
                         blendMode = BlendMode.Plus
                     )
                 } else {
```

---

### Incident Patch 15: `6331db22` (2026-07-26)
**Commit Message**: fix(desktop): load native libraries from the system path before JAR extraction

Packagers like Conveyor's extract-native-libraries move native libs out
of the JARs into the JVM lib dir and rewrite the JARs without them — the
in-JAR resource lookup then fails and the app crashes ("Native library
not found in JAR resources"). Try System.loadLibrary first (the same
pattern that keeps Skiko compatible) and fall back to the bundled-
resource extraction used by dev runs and jpackage builds. Applies to
both calf-file-picker and calf-share desktop loaders.

**File**: `calf-file-picker/src/desktopMain/kotlin/com/mohamedrejeb/calf/picker/platform/NativeLibLoader.kt` (modified, +8/-0)
```diff
@@ -16,6 +16,14 @@ private const val LIB_NAME = "calf_filepicker_native"
  * Called once from [NativeFilePickerBridge]'s object init block
  */
 internal fun loadNativeLibrary() {
+    // Try the system path first (packagers like Conveyor extract natives
+    // out of the jar), then fall back to the bundled resource.
+    try {
+        System.loadLibrary(LIB_NAME)
+        return
+    } catch (_: UnsatisfiedLinkError) {
+    }
+
     val osName = System.getProperty("os.name")?.lowercase().orEmpty()
     val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
 
```

**File**: `calf-share/src/desktopMain/kotlin/com/mohamedrejeb/calf/share/platform/NativeLibLoader.kt` (modified, +8/-0)
```diff
@@ -14,6 +14,14 @@ private const val LIB_NAME = "calf_share_native"
  * It is extracted to a user-scoped cache directory and loaded via [System.load].
  */
 internal fun loadNativeLibrary() {
+    // Try the system path first (packagers like Conveyor extract natives
+    // out of the jar), then fall back to the bundled resource.
+    try {
+        System.loadLibrary(LIB_NAME)
+        return
+    } catch (_: UnsatisfiedLinkError) {
+    }
+
     val osName = System.getProperty("os.name")?.lowercase().orEmpty()
     val osArch = System.getProperty("os.arch")?.lowercase().orEmpty()
 
```

#### Recent Merged Pull Requests:
- **PR #550** (2026-09-19): Enabled parallel sync for Gradle 9.4+ (@kevinguitar)
- **PR #549** (2026-09-20): Support full combinedClickable capability in adaptiveClickable modifier (@kevinguitar)
- **PR #547** (closed): Update version to 0.14.0 (@github-actions[bot])
- **PR #546** (2026-09-13): Prepare 0.14.0: Kotlin 2.4.20, Compose 1.12.0, AGP 9.4, compileSdk 37 (@MohamedRejeb)
- **PR #545** (2026-09-12): feat(io): add KmpFile.source() for streaming reads with kotlinx-io (@MohamedRejeb)
- **PR #544** (2026-09-12): feat(ui): add AdaptiveDateRangePicker (@MohamedRejeb)
- **PR #543** (2026-09-12): feat(ui): add AdaptiveCompactDatePicker (@MohamedRejeb)
- **PR #542** (2026-09-12): fix(navigation): keep each destination's saved state while it is on the back stack (@MohamedRejeb)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
