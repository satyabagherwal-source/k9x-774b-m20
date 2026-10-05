# Forensic Learning Record (Deep Inspection): zacharee/Bifrost

> **Canonical Artifact**: `07_PROJECT_LEARNING/zacharee-bifrost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zacharee/Bifrost](https://github.com/zacharee/Bifrost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:33:01.331Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zacharee/Bifrost`
- **Description**: Cross-platform tool for downloading Samsung mobile device firmware.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1610 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `common/src/nativeInterop/cinterop/Bugsnag/Bugsnag.h`
```
// The following are snippets from the Bugsnag Cocoa SDK used to generate Kotlin stubs.
//
// https://github.com/bugsnag/bugsnag-cocoa/blob/6bcd46f5f8dc06ac26537875d501f02b27d219a9/Bugsnag/include/Bugsnag/Bugsnag.h
//
// Copyright (c) 2012 Bugsnag, https://bugsnag.com/
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the Software
// is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

#import <Foundation/Foundation.h>
#import <BugsnagBreadcrumb.h>
#import <BugsnagEvent.h>

@interface Bugsnag : NSObject

typedef BOOL (^BugsnagOnErrorBlock)(BugsnagEvent *_Nonnull event);

+ (void)leaveBreadcrumbWithMessage:(NSString *_Nonnull)message
        metadata:(NSDictionary *_Nullable)metadata
        andType:(BSGBreadcrumbType)type;

+ (void)notify:(NSException *_Nonnull)exception block:(BugsnagOnErrorBlock _Nullable)block;

@end

```

### Core Architecture Module: `common/src/nativeInterop/cinterop/Bugsnag/BugsnagBreadcrumb.h`
```
#import <Foundation/Foundation.h>

typedef NS_ENUM(NSUInteger, BSGBreadcrumbType) {
/**
 *  Any breadcrumb sent via Bugsnag.leaveBreadcrumb()
 */
BSGBreadcrumbTypeManual,
/**
 *  A call to Bugsnag.notify() (internal use only)
 */
BSGBreadcrumbTypeError,
/**
 *  A log message
 */
BSGBreadcrumbTypeLog,
/**
 *  A navigation action, such as pushing a view controller or dismissing an alert
 */
BSGBreadcrumbTypeNavigation,
/**
 *  A background process, such performing a database query
 */
BSGBreadcrumbTypeProcess,
/**
 *  A network request
 */
BSGBreadcrumbTypeRequest,
/**
 *  Change in application or view state
 */
BSGBreadcrumbTypeState,
/**
 *  A user event, such as authentication or control events
 */
BSGBreadcrumbTypeUser,
};

```

### Core Architecture Module: `common/src/nativeInterop/cinterop/Bugsnag/BugsnagError.h`
```
// The following are snippets from the Bugsnag Cocoa SDK used to generate Kotlin stubs.
//
// https://github.com/bugsnag/bugsnag-cocoa/blob/6bcd46f5f8dc06ac26537875d501f02b27d219a9/Bugsnag/include/Bugsnag/BugsnagError.h
//
// Copyright (c) 2012 Bugsnag, https://bugsnag.com/
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the Software
// is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

#import <Foundation/Foundation.h>
#import <BugsnagStackframe.h>

typedef NS_OPTIONS(NSUInteger, BSGErrorType) {
BSGErrorTypeCocoa,
BSGErrorTypeC,
BSGErrorTypeReactNativeJs
};

@interface BugsnagError : NSObject

@property (copy, nullable, nonatomic) NSString *errorClass;
@property (copy, nullable, nonatomic) NSString *errorMessage;
@property (copy, nonnull, nonatomic) NSArray<BugsnagStackframe *> *stacktrace;
@property (nonatomic) BSGErrorType type;

@end

```

### Core Architecture Module: `common/src/nativeInterop/cinterop/Bugsnag/BugsnagEvent.h`
```
// The following are snippets from the Bugsnag Cocoa SDK used to generate Kotlin stubs.
//
// https://github.com/bugsnag/bugsnag-cocoa/blob/6bcd46f5f8dc06ac26537875d501f02b27d219a9/Bugsnag/include/Bugsnag/BugsnagEvent.h
//
// Copyright (c) 2012 Bugsnag, https://bugsnag.com/
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the Software
// is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

#import <Foundation/Foundation.h>
#import <BugsnagError.h>
#import <BugsnagFeatureFlag.h>

typedef NS_ENUM(NSUInteger, BSGSeverity) {
    BSGSeverityError,
    BSGSeverityWarning,
    BSGSeverityInfo,
};

@interface BugsnagEvent : NSObject

@property (readwrite, nonatomic) BSGSeverity severity;
@property (readwrite, copy, nonnull, nonatomic) NSArray<BugsnagError *> *errors;
@property (readonly, strong, nonnull, nonatomic) NSArray<BugsnagFeatureFlag *> *featureFlags;
@property (readwrite, nonatomic) BOOL unhandled;

@end
```

### Core Architecture Module: `common/src/nativeInterop/cinterop/Bugsnag/BugsnagFeatureFlag.h`
```
// The following are snippets from the Bugsnag Cocoa SDK used to generate Kotlin stubs.
//
// https://github.com/bugsnag/bugsnag-cocoa/blob/6bcd46f5f8dc06ac26537875d501f02b27d219a9/Bugsnag/include/Bugsnag/BugsnagFeatureFlag.h
//
// Copyright (c) 2012 Bugsnag, https://bugsnag.com/
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the Software
// is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

#import <Foundation/Foundation.h>

@interface BugsnagFeatureFlag : NSObject

@property (readonly, nonatomic, nonnull) NSString *name;

@end

```

### Core Architecture Module: `common/src/nativeInterop/cinterop/Bugsnag/BugsnagStackframe.h`
```
// The following are snippets from the Bugsnag Cocoa SDK used to generate Kotlin stubs.
//
// https://github.com/bugsnag/bugsnag-cocoa/blob/bd0465cd0e753ca42eef59fef4d5ceda80da1222/Bugsnag/include/Bugsnag/BugsnagStackframe.h
//
// Copyright (c) 2012 Bugsnag, https://bugsnag.com/
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the Software
// is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

#import <Foundation/Foundation.h>

@interface BugsnagStackframe : NSObject

+ (NSArray<BugsnagStackframe *> *_Nonnull)stackframesWithCallStackReturnAddresses:(NSArray<NSNumber *> *_Nonnull)callStackReturnAddresses;

@end
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #137** (2024-02-12): **Program runs with GUI without text.**
  *Symptoms*: **Describe the bug** When I run the program it runs the GUI with no text, no errors in the command prompt. It used to before but after reinstalling windows 10 it doesn't.  **To Reproduce** Steps to reproduce the behavior: 1. Go to 'bifrost-1.16.14-windows-amd64\bin\' 2. Click on 'Bifrost.exe'  **Expected behavior** GUI is supposed to show with text on textboxes, buttons etc.  **Screenshots** ![image](https://github.com/zacharee/SamloaderKotlin/assets/157152820/7a3e6222-64ba-488b-80ff-ebf57af812af)  **Desktop (please complete the following information):**  - OS: Windows 10 Build 19045  - Graphics Card: ATI Mobility Radeon HD 4650  - Processor: Intel Core2 Duo T6400  
  **Post-Mortem & Fix Analysis**:
  > Does this work? https://github.com/zacharee/SamloaderKotlin/releases/tag/1.16.15-test
  > Unfortunately it doesn't. ![image](https://github.com/zacharee/SamloaderKotlin/assets/157152820/2e59f8eb-7206-4dca-9bb3-32298a2e71e3) ![image](https://github.com/zacharee/SamloaderKotlin/assets/157152820/d2f2b921-faf9-43ab-a615-062254962259) 
  > Do you have the ATI drivers installed?

- **Issue #123** (2024-01-15): **java.lang.IllegalStateException: Could not load font**
  *Symptoms*: I am running archlinux, and I downloaded the latest release.  It complains about not being able to load a font, not showing what font. I installed by downloading the tar.gz, extracting, cd'ing into the directory, and running `bin/bifrost`.  Here is the stacktrace (all output): <details> <summary>stacktrace (click to expand)</summary>  ``` Dec 10, 2023 6:42:43 PM java.util.prefs.FileSystemPreferences$6 run WARNING: Prefs file removed in background /home/vosje/.java/.userPrefs/prefs.xml java.lang.IllegalStateException: Could not load font         at androidx.compose.ui.text.font.TypefaceRequestCache.runCached(FontFamilyResolver.kt:200)         at androidx.compose.ui.text.font.FontFamilyResolverImpl.resolve(FontFamilyResolver.kt:92)         at androidx.compose.ui.text.font.FontFamilyResolverImpl.resolve-DPcqOEQ(FontFamilyResolver.kt:79)         at androidx.compose.ui.text.platform.ComputedStyle.toSkTextStyle(SkiaParagraph.skiko.kt:227)         at androidx.compose.ui.text.platform.ParagraphBuilder$makeSkTextStyle$1.invoke(SkiaParagraph.skiko.kt:548)         at androidx.compose.ui.text.platform.ParagraphBuilder$makeSkTextStyle$1.invoke(SkiaParagraph.skiko.kt:547)         at androidx.compose.ui.text.WeakKeysCache.get(Cache.jvm.kt:24)         at androidx.compose.ui.text.platform.ParagraphBuilder.makeSkTextStyle(SkiaParagraph.skiko.kt:547)         at androidx.compose.ui.text.platform.ParagraphBuilder.textStyleToParagraphStyle(SkiaParagraph.skiko.kt:513)         a
  **Post-Mortem & Fix Analysis**:
  > Can you tell me: - Which version of Arch are you using? - Which window manager are you running? - Which desktop environment are you using?
  > > Which version of Arch are you using?  The latest, I installed a couple of months ago, but kept updating since then. As far as I know arch does not have os versions the way ubuntu/debian/fedora for example has them, the only version is the ISO. Edit: Just looked this up, it indeed doesn't have a *version*, it's a rolling release distro.  > Which window manager are you running?  hyprland 0.33.1-2  > Which desktop environment are you using?   None.
  > Trying on Arch with KDE, Bifrost launches and runs just fine.  I haven't been able to get an instance of Hyprland working to test. Arch base + manual install crashes randomly and silently fails to launch Bifrost. ArcolinuxB boots to a black screen on the live image.  I don't think this is something I can fix, unfortunately.

- **Issue #116** (2026-03-11): **Samsung is now requiring matching IMEIs or serial numbers to download firmware**
  *Symptoms*: In order to download firmware from Samsung's servers, an IMEI or serial number that matches the given model needs to be provided.  This issue is for discussing workarounds and approaches to retrieving firmware in light of the new requirement.
  **Post-Mortem & Fix Analysis**:
  > Posting here just for reference. Using this model: `SM-A346M` and this CSC: `TPA` I get this error:  `"Bad return status: toIndex(62) is greater than size (32)" ` Trying a couple of hours later I get a 401 error so I guess it is probably related to this? I was going to open a new issue before I saw the 401.  EDIT: using a service like https://samfw.com/firmware/SM-A346M/TPA/A346MUBU4BWK2 that probably gets the same url does work.
  > For SM-A336B EUX I also get toIndex (62) is greater than size (32)  With several versions: * A336BXXU7DWK6/A336BOXM7DWK6/A336BXXU7DWK6/A336BXXU7DWK6 * A336BXXS7CWJ1/A336BOXM7CWH2/A336BXXS7CWJ1/A336BXXS7CWJ1 (55 is greater than size 32) * A336BXXU7CWH2/A336BOXM7CWH2/A336BXXU7CWH2/A336BXXU7CWH2 (index 3 out of bounds for length 3)
  > Someone who's better at reverse engineering Windows apps than I am will need to find the new method in Smart Switch. I have a feeling it's not only the key that's changed.

- **Issue #105** (2024-01-16): **Text Typed Into Entries Is Scrambled.**
  *Symptoms*: When I type text into any entry, it becomes slightly scrambled. For example, "SM-A525F" turns into "S-A525FM" , "SM-A52F5", or "SM-A55F2" (these are all real examples). Another interesting example is me sliding my fingers over "QWERTYUIOP", which, although it works fine here, turns into "QWERYUIOPT", "WERTYUIOPQ", or "QERTYUIOPW" in Bifrost (also real examples). I've included a screen recording so you can _see_ what I'm talking about. It's not a big deal, but it _is_ annoying. :smile: TIA.  https://github.com/zacharee/SamloaderKotlin/assets/141518185/9830a9db-551c-457e-86b2-97a9dadde4e6  
  **Post-Mortem & Fix Analysis**:
  > Yeah I've noticed this only happens on the Linux builds for me as well
  > > Yeah I've noticed this only happens on the Linux builds for me as well  This was on on Debian. It's like the cursor doesn't keep up. You can see it also skipped deleting the "2" in the Firmware entry.
  > Compose Multiplatform sometimes has issues with text tracking on certain platforms. It might work better in 1.14.3, since I've updated the version of Compose used.

- **Issue #73** (2022-07-22): **Resource files\heart.svg not found**
  *Symptoms*: In the last update, I am getting an error _Resource files\heart.svg not found_. The android version is working fine. The windows version is not.  ![image](https://user-images.githubusercontent.com/68565388/178379152-5401b7a8-9496-4530-a284-2bba3b04c8bc.png) 
  **Post-Mortem & Fix Analysis**:
  > Should be fixed in 1.0.10: https://github.com/zacharee/SamloaderKotlin/releases/tag/1.0.10.

- **Issue #65** (2022-07-23): **Getting strange error and download doesnt start**
  *Symptoms*: ![Screenshot_1](https://user-images.githubusercontent.com/13099434/170837781-aa05f766-e48e-412c-9223-d95a14d9e458.png) 
  **Post-Mortem & Fix Analysis**:
  > What model and region are you entering?
  > I get the same when entering SM-G781U1 with XAA region. 
  > @Ickerday I can't reproduce the issue with that combination on 1.0.10.

- **Issue #47** (2022-07-22): **Blank page when I start the SamloaderKotlin**
  *Symptoms*: Hi guys!  On my notebook I am trying to start the software, but unfortunately when I start I only get a blank page (nothing more). No logs etc. I also tried starting it with admin privileges  My Notebook and Windows version: Edition: Windows 10 Home 21H2 64Bit  Build System: 19044.1415 Processor: Intel(R) Core(TM) i5-3317U CPU @ 1.70GHz   1.70 GHz but in windows 11 it's working and is perfect.  Thanks!!!!  p.s this is a screenshot:  https://ibb.co/gmbkW9b    
  **Post-Mortem & Fix Analysis**:
  > Can you see if 1.0.4 works any better?
  > Hi! i have the 1.0.5 and nothing... Blank Page... https://ibb.co/3rTc5S4
  > Does running the program as an administrator help?

- **Issue #34** (2022-05-16): **Strange issue on Arch Linux (latest, KDE)**
  *Symptoms*: Just when I try to download latest firmware for SM-A207F region SER it opens a window that is not rendering (transparent in KDE)  When I close that window, the download ends. With keeping it opened nothing happens. No logs found.  Using original python samloader works.
  **Post-Mortem & Fix Analysis**:
  > That should be the file picker. If I remember correctly, I've tested in KDE without issue. Make sure you have Dolphin installed.
  > It is installed. Maybe some dependencies are missing? Any other app can open this dialog.
  > I'm not sure. I'll test it out on a KDE machine to see what's going on. What OS and version are you using?

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

### Incident Patch 1: `0536b9d6` (2026-09-05)
**Commit Message**: Fix iOS build and work on reading auth_param.dat on iOS

**File**: `common/src/iosMain/kotlin/tk/zwander/common/tools/CryptUtils.ios.kt` (modified, +22/-23)
```diff
@@ -1,22 +1,11 @@
 package tk.zwander.common.tools
 
 import dev.zwander.kotlin.file.PlatformFile
-import kotlinx.cinterop.ExperimentalForeignApi
-import kotlinx.cinterop.UByteVarOf
-import kotlinx.cinterop.allocArray
-import kotlinx.cinterop.memScoped
-import kotlinx.cinterop.readBytes
+import kotlinx.cinterop.*
 import kotlinx.io.asSource
-import platform.Foundation.NSDocumentDirectory
-import platform.Foundation.NSFileManager
-import platform.Foundation.NSInputStream
-import platform.Foundation.NSNumber
-import platform.Foundation.NSStreamFileCurrentOffsetKey
-import platform.Foundation.NSURL
-import platform.Foundation.NSUserDomainMask
-import platform.Foundation.numberWithUnsignedLong
+import platform.Foundation.*
+import tk.zwander.common.generated.resources.Res
 import tk.zwander.common.util.RandomAccessStream
-import tk.zwander.samloaderkotlin.resources.MR
 
 @OptIn(ExperimentalForeignApi::class)
 actual object AuthParamsHandler {
@@ -29,36 +18,46 @@ actual object AuthParamsHandler {
         ),
         "auth_param.dat",
     )
-    val stream = NSInputStream(NSURL.fileURLWithPath(tempFile.getAbsolutePath()))
 
     actual suspend fun extractFile() {
         tempFile.delete()
         tempFile.createNewFile()
-        NSInputStream(MR.files.auth_param_dat.url).asSource().use { input ->
+        NSInputStream(NSURL.URLWithString(Res.getUri("files/auth_param.dat"))!!).asSource().use { input ->
             tempFile.openOutputStream(append = false, truncate = false)?.use { output ->
                 output.transferFrom(input)
             }
         }
+
+        println("TEMP FILE ${tempFile.getAbsolutePath()} ${tempFile.getLength()}")
     }
 
+    @OptIn(BetaInteropApi::class)
     actual suspend fun getAuthParamStream(): RandomAccessStream {
         return object : RandomAccessStream {
+            val stream = NSFileHandle.fileHandleForReadingAtPath(tempFile.getAbsolutePath())
+
             override fun get(pos: Long): UByte {
                 return get(pos, 1).first()
             }
 
             override fun get(pos: Long, len: Int): UByteArray {
-                stream.setProperty(
-                    NSNumber.numberWithUnsignedLong(pos.toULong()),
-                    NSStreamFileCurrentOffsetKey,
-                )
 
                 return memScoped {
-                    val buffer = allocArray<UByteVarOf<UByte>>(len)
+                    val error = alloc<ObjCObjectVar<NSError?>>()
+                    stream?.seekToOffset(pos.toULong(), error.ptr)
 
-                    stream.read(buffer, len.toULong())
+                    if (error.value != null) {
+                        throw IllegalStateException(error.value?.toString())
+                    }
 
-                    buffer.readBytes(len).toUByteArray()
+                    try {
+                        stream?.readDataUpToLength(len.toULong(), error.ptr)?.bytes?.readBytes(len)
+                            ?.toUByteArray() ?: ubyteArrayOf()
+                    } finally {
+                        if (error.value != null) {
+                            throw IllegalStateException(error.value?.toString())
+                        }
+                    }
                 }
             }
         }
```

**File**: `common/src/iosMain/kotlin/tk/zwander/common/util/ResourceUtils.ios.kt` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-package tk.zwander.common.util
-
-import dev.icerock.moko.resources.FileResource
-import dev.icerock.moko.resources.StringResource
-import dev.icerock.moko.resources.desc.desc
-import dev.icerock.moko.resources.format
-import io.ktor.utils.io.core.toByteArray
-
-actual operator fun StringResource.invoke(vararg args: Any): String {
-    return if (args.isNotEmpty()) {
-        format(*args)
-    } else {
-        this.desc()
-    }.localized()
-}
-
-actual operator fun FileResource.invoke(): ByteArray? {
-    return this.readText().toByteArray()
-}
\ No newline at end of file
```

**File**: `iosApp/iosApp.xcodeproj/project.pbxproj` (modified, +8/-38)
```diff
@@ -1039,8 +1039,6 @@
 				7555FF77242A565900829871 /* Sources */,
 				7555FF79242A565900829871 /* Resources */,
 				F85CB1118929364A9C6EFABC /* Frameworks */,
-				B6F2AC352A18218400C5FE22 /* ShellScript */,
-				B6EBA03F2C22903E009A3B98 /* ShellScript */,
 				B67DC2052A317566008FB35B /* ShellScript */,
 				352089910975609D0A648AA6 /* Upload Bugsnag dSYM */,
 				F10D73DC47BF6D968C5038D8 /* [CP] Copy Pods Resources */,
@@ -1194,10 +1192,14 @@
 			inputFileListPaths = (
 				"${PODS_ROOT}/Target Support Files/Pods-iosApp/Pods-iosApp-frameworks-${CONFIGURATION}-input-files.xcfilelist",
 			);
+			inputPaths = (
+			);
 			name = "[CP] Embed Pods Frameworks";
 			outputFileListPaths = (
 				"${PODS_ROOT}/Target Support Files/Pods-iosApp/Pods-iosApp-frameworks-${CONFIGURATION}-output-files.xcfilelist",
 			);
+			outputPaths = (
+			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
 			shellScript = "\"${PODS_ROOT}/Target Support Files/Pods-iosApp/Pods-iosApp-frameworks.sh\"\n";
@@ -1222,42 +1224,6 @@
 			shellPath = /usr/bin/ruby;
 			shellScript = "api_key = '6cefc5a9296f11ea3be1a707f17201b4'\n\nif ENV['ENABLE_USER_SCRIPT_SANDBOXING'] == 'YES'\n  count = ENV['SCRIPT_INPUT_FILE_COUNT'].to_i\n  abort 'error: dSYMs must be specified as build phase \"Input Files\" because ENABLE_USER_SCRIPT_SANDBOXING is enabled' unless count > 0\n  dsyms = []\n  for i in 0 .. count - 1\n    dsym = ENV[\"SCRIPT_INPUT_FILE_#{i}\"]\n    if File.exist? dsym\n      dsyms.append dsym\n    else\n      abort \"error: cannot read #{dsym}\" unless ENV['DEBUG_INFORMATION_FORMAT'] != 'dwarf-with-dsym'\n    end\n  end\nelse\n  dsyms = Dir[\"#{ENV['DWARF_DSYM_FOLDER_PATH']}/*/Contents/Resources/DWARF/*\"]\nend\n\ndsyms.each do |dsym|\n  Process.detach Process.spawn('/usr/bin/curl', '--http1.1',\n    '-F', \"apiKey=#{api_key}\",\n    '-F', \"dsym=@#{dsym}\",\n    '-F', \"projectRoot=#{ENV['PROJECT_DIR']}\",\n    'https://upload.bugsnag.com/'\n  )\nend\n";
 		};
-		B6EBA03F2C22903E009A3B98 /* ShellScript */ = {
-			isa = PBXShellScriptBuildPhase;
-			alwaysOutOfDate = 1;
-			buildActionMask = 2147483647;
-			files = (
-			);
-			inputFileListPaths = (
-			);
-			inputPaths = (
-			);
-			outputFileListPaths = (
-			);
-			outputPaths = (
-			);
-			runOnlyForDeploymentPostprocessing = 0;
-			shellPath = /bin/sh;
-			shellScript = "\"$SRCROOT/../gradlew\" -p \"$SRCROOT/../\" :common:copyFrameworkResourcesToApp \\\n    -Pmoko.resources.BUILT_PRODUCTS_DIR=\"$BUILT_PRODUCTS_DIR\" \\\n    -Pmoko.resources.CONTENTS_FOLDER_PATH=\"$CONTENTS_FOLDER_PATH\" \\\n    -Pkotlin.native.cocoapods.platform=\"$PLATFORM_NAME\" \\\n    -Pkotlin.native.cocoapods.archs=\"$ARCHS\" \\\n    -Pkotlin.native.cocoapods.configuration=\"$CONFIGURATION\" \n";
-		};
-		B6F2AC352A18218400C5FE22 /* ShellScript */ = {
-			isa = PBXShellScriptBuildPhase;
-			alwaysOutOfDate = 1;
-			buildActionMask = 2147483647;
-			files = (
-			);
-			inputFileListPaths = (
-			);
-			inputPaths = (
-			);
-			outputFileListPaths = (
-			);
-			outputPaths = (
-			);
-			runOnlyForDeploymentPostprocessing = 0;
-			shellPath = /bin/sh;
-			shellScript = "\"$SRCROOT/../gradlew\" -p \"$SRCROOT/../\" :common:copyPodFrameworkResourcesToApp \\\n    -Pmoko.resources.BUILT_PRODUCTS_DIR=\"$BUILT_PRODUCTS_DIR\" \\\n    -Pmoko.resources.CONTENTS_FOLDER_PATH=\"$CONTENTS_FOLDER_PATH\" \\\n    -Pkotlin.native.cocoapods.platform=\"$PLATFORM_NAME\" \\\n    -Pkotlin.native.cocoapods.archs=\"$ARCHS\" \\\n    -Pkotlin.native.cocoapods.configuration=\"$CONFIGURATION\" \n";
-		};
 		F10D73DC47BF6D968C5038D8 /* [CP] Copy Pods Resources */ = {
 			isa = PBXShellScriptBuildPhase;
 			buildActionMask = 2147483647;
@@ -1266,10 +1232,14 @@
 			inputFileListPaths = (
 				"${PODS_ROOT}/Target Support Files/Pods-iosApp/Pods-iosApp-resources-${CONFIGURATION}-input-files.xcfilelist",
 			);
+			inputPaths = (
+			);
 			name = "[CP] Copy Pods Resources";
 			outputFileListPaths = (
 				"${PODS_ROOT}/Target Support Fi
```

---

### Incident Patch 2: `b807aad6` (2026-09-05)
**Commit Message**: Fix Android build

**File**: `android/src/main/java/tk/zwander/samsungfirmwaredownloader/DownloaderService.kt` (modified, +51/-42)
```diff
@@ -19,8 +19,13 @@ import android.widget.RemoteViews
 import androidx.core.app.NotificationCompat
 import androidx.core.app.ServiceCompat
 import androidx.core.content.ContextCompat
+import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.MainScope
+import kotlinx.coroutines.launch
 import tk.zwander.common.IDownloaderService
 import tk.zwander.common.R
+import tk.zwander.common.generated.resources.Res
+import tk.zwander.common.generated.resources.*
 import tk.zwander.common.util.Event
 import tk.zwander.common.util.EventManager
 import tk.zwander.common.util.eventManager
@@ -33,7 +38,7 @@ import kotlin.time.ExperimentalTime
  * app running when it's in the background. It will run as long as the app is running.
  */
 @OptIn(ExperimentalTime::class)
-class DownloaderService : Service(), EventManager.EventListener {
+class DownloaderService : Service(), EventManager.EventListener, CoroutineScope by MainScope() {
     companion object {
         /**
          * Start the Service.
@@ -71,29 +76,31 @@ class DownloaderService : Service(), EventManager.EventListener {
         set(value) {
             field = value
 
-            if (value == 0) {
-                nm.cancel(100)
-                nm.notify(100, makeForegroundNotification(null))
-            }
+            launch {
+                if (value == 0) {
+                    nm.cancel(100)
+                    nm.notify(100, makeForegroundNotification(null))
+                }
 
-            if (value == 0 && !activityRunning) {
-                nm.notify(
-                    100,
-                    NotificationCompat.Builder(this, "notification")
-                        .setContentTitle(getString(R.string.notification_finished_channel_name))
-                        .setContentText(getString(R.string.notification_finished_channel_text))
-                        .setSmallIcon(R.mipmap.ic_launcher_foreground)
-                        .setContentIntent(
-                            PendingIntent.getActivity(
-                                this, 101,
-                                Intent(this, MainActivity::class.java),
-                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
+                if (value == 0 && !activityRunning) {
+                    nm.notify(
+                        100,
+                        NotificationCompat.Builder(this@DownloaderService, "notification")
+                            .setContentTitle(org.jetbrains.compose.resources.getString(Res.string.notification_finished_channel_name))
+                            .setContentText(org.jetbrains.compose.resources.getString(Res.string.notification_finished_channel_text))
+                            .setSmallIcon(R.mipmap.ic_launcher_foreground)
+                            .setContentIntent(
+                                PendingIntent.getActivity(
+                                    this@DownloaderService, 101,
+                                    Intent(this@DownloaderService, MainActivity::class.java),
+                                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
+                                )
                             )
-                        )
-                        .build()
-                )
+                            .build()
+                    )
 
-                stopSelf()
+                    stopSelf()
+                }
             }
         }
     private var activityRunning = false
@@ -130,28 +137,30 @@ class DownloaderService : Service(), EventManager.EventListener {
         eventManager.addListener(this)
         application.registerActivityLifecycleCallbacks(lifecycleCallbacks)
 
-        //Create the notification channel if applicable.
-        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.N_MR1) {
-            nm.createNotificationChannel(
-                NotificationChannel(
-                    "progress", getString(R.string.notification_progress_channel
```

**File**: `common/src/androidMain/kotlin/tk/zwander/common/tools/CryptUtils.android.kt` (modified, +2/-2)
```diff
@@ -2,8 +2,8 @@ package tk.zwander.common.tools
 
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.withContext
+import tk.zwander.common.generated.resources.Res
 import tk.zwander.common.util.RandomAccessStream
-import tk.zwander.samloaderkotlin.resources.MR
 import tk.zwander.samsungfirmwaredownloader.App
 import java.io.File
 import java.io.RandomAccessFile
@@ -25,7 +25,7 @@ actual object AuthParamsHandler {
         tempFile.delete()
         tempFile.createNewFile()
         withContext(Dispatchers.IO) {
-            App.instance.resources.openRawResource(MR.files.auth_param_dat.rawResId).use { input ->
+            App.instance.resources.assets.open("files/auth_param.dat").use { input ->
                 tempFile.outputStream().use { output ->
                     input.copyTo(output)
                 }
```

**File**: `common/src/androidMain/kotlin/tk/zwander/common/util/ResourceUtils.kt` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-package tk.zwander.common.util
-
-import dev.icerock.moko.resources.FileResource
-import dev.icerock.moko.resources.StringResource
-import dev.icerock.moko.resources.desc.desc
-import dev.icerock.moko.resources.format
-import tk.zwander.samsungfirmwaredownloader.App
-
-actual operator fun StringResource.invoke(vararg args: Any): String {
-    return if (args.isNotEmpty()) {
-        format(*args)
-    } else {
-        this.desc()
-    }.toString(App.instance)
-}
-
-actual operator fun FileResource.invoke(): ByteArray? {
-    return App.instance.resources.openRawResource(rawResId).use { it.readBytes() }
-}
```

**File**: `common/src/androidMain/res/layout/progress.xml` (modified, +1/-2)
```diff
@@ -11,7 +11,6 @@
             android:id="@+id/title"
             android:layout_width="match_parent"
             android:layout_height="wrap_content"
-            android:text="@string/notification_progress_text"
             android:textAppearance="@style/TextAppearance.Compat.Notification"
             />
 
@@ -42,4 +41,4 @@
 
     </LinearLayout>
 
-</LinearLayout>
\ No newline at end of file
+</LinearLayout>
```

---

### Incident Patch 3: `c83ccd5a` (2026-09-05)
**Commit Message**: Fix iOS build

**File**: `.idea/modules.xml` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 <project version="4">
   <component name="ProjectModuleManager">
     <modules>
+      <module fileurl="file://$PROJECT_DIR$/.idea/modules/android/SamloaderKotlin.android.main.iml" filepath="$PROJECT_DIR$/.idea/modules/android/SamloaderKotlin.android.main.iml" />
       <module fileurl="file://$PROJECT_DIR$/.idea/SamloaderKotlin.iosApp.iml" filepath="$PROJECT_DIR$/.idea/SamloaderKotlin.iosApp.iml" />
     </modules>
   </component>
```

**File**: `common/build.gradle.kts` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ kotlin {
         version = versionCode.toString()
         summary = "Bifrost"
         homepage = "https://zwander.dev"
-        ios.deploymentTarget = "14.0"
+        ios.deploymentTarget = "15.0"
         osx.deploymentTarget = "10.13"
         podfile = project.file("../iosApp/Podfile")
         framework {
```

**File**: `common/common.podspec` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Pod::Spec.new do |spec|
     spec.summary                  = 'Bifrost'
     spec.vendored_frameworks      = 'build/cocoapods/framework/common.framework'
     spec.libraries                = 'c++'
-    spec.ios.deployment_target    = '14.0'
+    spec.ios.deployment_target    = '15.0'
     spec.osx.deployment_target    = '10.13'
     if !Dir.exist?('build/cocoapods/framework/common.framework') || Dir.empty?('build/cocoapods/framework/common.framework')
         raise "
```

**File**: `iosApp/Podfile` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ end
 post_install do |installer|
   installer.pods_project.targets.each do |target|
     target.build_configurations.each do |config|
-     config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '14.0'
+     config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
     end
   end
 end
```

**File**: `iosApp/Podfile.lock` (modified, +2/-2)
```diff
@@ -16,8 +16,8 @@ EXTERNAL SOURCES:
 
 SPEC CHECKSUMS:
   BugsnagPerformance: 1ce529b5ade51e2048019850fd0f8da5bcb8ee39
-  common: cbb97a48d0f1a45104cb986ca5cf5307b7c4692a
+  common: 2d4885da482ac1ea7ddfac608b8b39b8b0c7be7e
 
-PODFILE CHECKSUM: 000b91682bffe8883f1f0a58c28b251dc5538a59
+PODFILE CHECKSUM: 2918ec99ad8aaa312908d7e0435d7ccd491ef0ab
 
 COCOAPODS: 1.17.0
```

---

### Incident Patch 4: `2613e9d2` (2026-08-24)
**Commit Message**: Fix resuming and unify download process logic

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/FusClient.kt` (modified, +5/-107)
```diff
@@ -172,113 +172,11 @@ object FusClient : IFusClient<FusClient.Request> {
         return body
     }
 
-    /**
-     * Download a file from Samsung's server.
-     * @param fileName the name of the file to download.
-     * @param start an optional offset. Used for resuming downloads.
-     */
-    override suspend fun downloadFile(
-        fileName: String,
-        start: Long,
-        size: Long,
-        dest: IPlatformFile,
-        progressCallback: suspend (current: Long, max: Long, bps: Long) -> Unit,
-    ): String? {
-        val authV = getAuthV(cloud = true)
-        val url = getDownloadUrl(fileName)
-
-        val md5Request = globalHttpClient.prepareRequest {
-            method = HttpMethod.Get
-            url(url)
-            headers {
-                append("Authorization", authV)
-                append("User-Agent", "SMART 2.0")
-                if (start > 0) {
-                    append("Range", "bytes=${start}-")
-                }
-            }
-            timeout {
-                this.requestTimeoutMillis = HttpTimeoutConfig.INFINITE_TIMEOUT_MS
-                this.socketTimeoutMillis = HttpTimeoutConfig.INFINITE_TIMEOUT_MS
-                this.connectTimeoutMillis = HttpTimeoutConfig.INFINITE_TIMEOUT_MS
-            }
-        }
-
-        val md5 = md5Request.execute { response ->
-            response.headers["Content-MD5"]
-        }
-
-//        val existingTask = try {
-//            ketch.tasks.value.find { it.request.value.url == url }
-//                ?.let { download ->
-//                    download.updateHeaders(
-//                        mapOf(
-//                            "Authorization" to authV.also { println(it) },
-//                            "User-Agent" to "SMART 2.0",
-//                            "Cache-Control" to "no-cache",
-//                        ),
-//                    )
-//                    try {
-//                        download.resume(Destination(dest.getAbsolutePath()))
-//                        download.takeIf {
-//                            it.state.value !is DownloadState.Completed
-//                        }
-//                    } catch (e: KetchError.Unknown) {
-//                        download.remove()
-//                        null
-//                    }
-//                }
-//        } catch (e: KetchError.Http) {
-//            if (e.code == 401) {
-//                ketch.tasks.value.findLast { it.request.value.url == url }?.remove()
-//                null
-//            } else {
-//                throw e
-//            }
-//        }
-
-        val task = ketch.download(
-            DownloadRequest(
-                url = url,
-                destination = Destination(dest.getAbsolutePath()),
-                headers = mapOf(
-                    "Authorization" to authV.also { println(it) },
-                    "User-Agent" to "SMART 2.0",
-                    "Cache-Control" to "no-cache",
-                ),
-            ),
+    override suspend fun createHeaders(authV: String): Map<String, String> {
+        return mapOf(
+            "Authorization" to authV.also { println(it) },
+            "User-Agent" to "SMART 2.0",
+            "Cache-Control" to "no-cache",
         )
-
-        CoroutineScope(currentCoroutineContext()).launch(Dispatchers.IO) {
-            task.state.collect {
-                if (it is DownloadState.Downloading) {
-                    progressCallback(
-                        it.progress.downloadedBytes,
-                        size,
-                        it.progress.bytesPerSecond,
-                    )
-                }
-            }
-        }
-
-        try {
-            while (true) {
-                val result = task.await()
-
-                if (result.isSuccess) {
-                    break
-                }
-
-                (result.exceptionOrNull() as? KetchError)?.let { error ->
-                    if (!error.isRetryable) {
-                        throw err
```

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/FusClientLegacy.kt` (modified, +7/-0)
```diff
@@ -212,4 +212,11 @@ object FusClientLegacy : IFusClient<FusClientLegacy.Request> {
 
         return body
     }
+
+    override suspend fun createHeaders(authV: String): Map<String, String> {
+        return mapOf(
+            "Authorization" to authV,
+            "User-Agent" to "Kiss2.0_FUS",
+        )
+    }
 }
```

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/IFusClient.kt` (modified, +107/-97)
```diff
@@ -1,31 +1,16 @@
 package tk.zwander.common.tools
 
 import com.fleeksoft.ksoup.Ksoup
-import com.linroid.ketch.api.Destination
-import com.linroid.ketch.api.DownloadRequest
-import com.linroid.ketch.api.DownloadState
-import com.linroid.ketch.api.KetchError
-import dev.zwander.kmp.platform.HostOS
+import com.linroid.ketch.api.*
 import dev.zwander.kotlin.file.IPlatformFile
-import io.ktor.client.plugins.HttpTimeoutConfig
-import io.ktor.client.plugins.timeout
-import io.ktor.client.request.headers
-import io.ktor.client.request.prepareRequest
-import io.ktor.client.request.url
-import io.ktor.client.statement.HttpResponse
-import io.ktor.client.statement.bodyAsChannel
-import io.ktor.http.HttpMethod
-import io.ktor.utils.io.readTo
-import kotlinx.coroutines.CancellationException
-import kotlinx.coroutines.CoroutineScope
-import kotlinx.coroutines.Dispatchers
-import kotlinx.coroutines.IO
-import kotlinx.coroutines.currentCoroutineContext
-import kotlinx.coroutines.launch
+import io.ktor.client.plugins.*
+import io.ktor.client.request.*
+import io.ktor.client.statement.*
+import io.ktor.http.*
+import kotlinx.coroutines.*
 import tk.zwander.common.util.firstElementByTagName
 import tk.zwander.common.util.globalHttpClient
 import tk.zwander.common.util.ketch
-import tk.zwander.common.util.trackOperationProgress
 
 interface IFusClient<Request : IFusClient.IRequest> {
     sealed interface IRequest
@@ -44,6 +29,62 @@ interface IFusClient<Request : IFusClient.IRequest> {
         signature: String? = null,
         includeNonce: Boolean = true,
     ): String
+    suspend fun createHeaders(authV: String): Map<String, String>
+
+    suspend fun createDownloadTask(
+        url: String,
+        fileName: String,
+        start: Long = 0,
+        size: Long,
+        dest: IPlatformFile,
+        headers: Map<String, String>,
+        progressCallback: suspend (current: Long, max: Long, bps: Long) -> Unit,
+    ): DownloadTask {
+        val existingTask = try {
+            ketch.tasks.value.find { it.request.value.url == url }
+                ?.let { download ->
+                    println(download.state.value)
+                    if (download.state.value !is DownloadState.Completed) {
+                        download.updateHeaders(headers)
+                        download.resume(Destination(dest.getAbsolutePath()))
+                        download
+                    } else {
+                        download.remove()
+                        null
+                    }
+                }
+        } catch (e: KetchError.Http) {
+            e.printStackTrace()
+            if (e.code == 401) {
+                ketch.tasks.value.findLast { it.request.value.url == url }?.remove()
+                null
+            } else {
+                throw e
+            }
+        }
+
+        val task = existingTask ?: ketch.download(
+            DownloadRequest(
+                url = url,
+                destination = Destination(dest.getAbsolutePath()),
+                headers = headers,
+            ),
+        )
+
+        CoroutineScope(currentCoroutineContext()).launch(Dispatchers.IO) {
+            task.state.collect {
+                if (it is DownloadState.Downloading) {
+                    progressCallback(
+                        it.progress.downloadedBytes,
+                        size,
+                        it.progress.bytesPerSecond,
+                    )
+                }
+            }
+        }
+
+        return task
+    }
 
     /**
      * Download a file from Samsung's server.
@@ -57,98 +98,67 @@ interface IFusClient<Request : IFusClient.IRequest> {
         dest: IPlatformFile,
         progressCallback: suspend (current: Long, max: Long, bps: Long) -> Unit,
     ): String? {
-        val authV = FusClientLegacy.getAuthV()
-        val url = FusClientLegacy.getDownloadUrl(fileName)
+        val authV = getAuthV()
+        val url = getDownloadUrl(fileName)
+        val headers = createHeaders(au
```

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/delegates/Downloader.kt` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 package tk.zwander.common.tools.delegates
 
 import com.linroid.ketch.api.KetchError
+import dev.zwander.kmp.platform.HostOS
 import io.ktor.utils.io.core.toByteArray
 import kotlinx.coroutines.CancellationException
 import kotlinx.coroutines.Dispatchers
@@ -212,7 +213,7 @@ object Downloader {
                 }
             }
 
-            val md5 = if (extractedEncFile.getLength() < size) {
+            val md5 = if (HostOS.current != HostOS.Android || extractedEncFile.getLength() < size) {
                 IFusClient.downloadFile(
                     fileName = path + fileName,
                     start = encFile.getLength(),
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ githubApi = "2.0-rc.7"
 google-material = "1.14.0"
 jna = "5.19.1"
 jsystemthemedetector = "ff1818c9c9"
-ketch = "0.0.1-rc9"
+ketch = "0.0.2-dev1"
 kmpfile = "0.8.0"
 kmpplatform = "0.1.0"
 kotlin = "2.4.10"
```

---

### Incident Patch 5: `10ff1732` (2026-08-23)
**Commit Message**: Fix legacy downloading and fall back to it when receiving a 401

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/CryptUtils.kt` (modified, +2/-5)
```diff
@@ -22,8 +22,6 @@ import tk.zwander.common.util.RandomAccessStream
 import tk.zwander.common.util.streamOperationWithProgress
 import tk.zwander.common.util.trackOperationProgress
 import kotlin.io.encoding.Base64
-import kotlin.io.encoding.ExperimentalEncodingApi
-import kotlin.math.max
 
 /**
  * Handle encryption and decryption stuff.
@@ -136,7 +134,6 @@ object CryptUtils {
          * @param nonce the nonce seed.
          * @return an auth token based on the nonce.
          */
-        @OptIn(ExperimentalEncodingApi::class)
         fun getAuth(nonce: String): String {
             val keyData = nonce.map { (it.code % 16).toByte() }.toByteArray()
             val fKey = getFKey(keyData)
@@ -145,10 +142,10 @@ object CryptUtils {
         }
 
         /**
-        @@ -139,10 +163,8 @@ object CryptUtils {
+         * Decrypt a provided nonce string.
+         * @param input the nonce to decrypt.
          * @return the decrypted nonce.
          */
-        @OptIn(ExperimentalEncodingApi::class)
         fun decryptNonce(input: String): String {
             val d = Base64.decode(input)
             return aesDecrypt(d, KEY_1.toByteArray())
```

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/FusClient.kt` (modified, +18/-6)
```diff
@@ -9,6 +9,7 @@ import com.linroid.ketch.api.DownloadState
 import com.linroid.ketch.api.KetchError
 import dev.zwander.kotlin.file.IPlatformFile
 import io.ktor.client.plugins.HttpTimeoutConfig
+import io.ktor.client.plugins.auth.clearAuthTokens
 import io.ktor.client.plugins.timeout
 import io.ktor.client.request.headers
 import io.ktor.client.request.prepareRequest
@@ -210,13 +211,24 @@ object FusClient : IFusClient<FusClient.Request> {
             response.headers["Content-MD5"]
         }
 
-        val task = ketch.tasks.value.find { it.request.url == url }
-            ?.let { download ->
-                download.resume(Destination(dest.getAbsolutePath()))
-                download.takeIf {
-                    it.state.value !is DownloadState.Completed
+        val existingTask = try {
+            ketch.tasks.value.find { it.request.url == url }
+                ?.let { download ->
+                    download.resume(Destination(dest.getAbsolutePath()))
+                    download.takeIf {
+                        it.state.value !is DownloadState.Completed
+                    }
                 }
-            } ?: ketch.download(
+        } catch (e: KetchError.Http) {
+            if (e.code == 401) {
+                ketch.tasks.value.findLast { it.request.url == url }?.remove()
+                null
+            } else {
+                throw e
+            }
+        }
+
+        val task = existingTask ?: ketch.download(
             DownloadRequest(
                 url = url,
                 destination = Destination(dest.getAbsolutePath()),
```

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/FusClientLegacy.kt` (modified, +105/-24)
```diff
@@ -2,7 +2,6 @@
 
 package tk.zwander.common.tools
 
-import com.fleeksoft.io.exception.ArrayIndexOutOfBoundsException
 import io.ktor.client.request.headers
 import io.ktor.client.request.request
 import io.ktor.client.request.setBody
@@ -24,11 +23,35 @@ object FusClientLegacy : IFusClient<FusClientLegacy.Request> {
         BINARY_INIT("NF_DownloadBinaryInitForMass.do")
     }
 
+    /**
+     * Nonces from the legacy endpoints no longer decrypt with [CryptUtils.Legacy]'s
+     * hardcoded key: the plaintext comes back as high-entropy binary rather than 16
+     * characters followed by 0x10 padding (verified against OpenSSL, so the AES-CBC
+     * implementation itself is correct).
+     *
+     * When true, sign legacy requests with the current auth_params scheme that
+     * [FusClient] uses, while keeping the legacy endpoints and request bodies. Flip to
+     * false to go back to the hardcoded-key scheme.
+     */
+    private const val USE_MODERN_AUTH = true
+
     private var encNonce = ""
     private var nonce = ""
 
     private var auth: String = ""
-    private var sessionId: String = ""
+
+    private var jSessionId: String = ""
+    private var session: String = ""
+
+    /**
+     * Echo back only the cookies the server actually set. Reconstructing this from a
+     * single stored value meant sending `SESSION=<the JSESSIONID value>`, and sending
+     * `;SESSION=` unconditionally was a difference from the older builds that still work.
+     */
+    private fun cookieHeader(): String = listOfNotNull(
+        jSessionId.takeIf { it.isNotBlank() }?.let { "JSESSIONID=$it" },
+        session.takeIf { it.isNotBlank() }?.let { "SESSION=$it" },
+    ).joinToString(";")
 
     override suspend fun getNonce(): String {
         if (nonce.isBlank()) {
@@ -56,6 +79,15 @@ object FusClientLegacy : IFusClient<FusClientLegacy.Request> {
     }
 
     override suspend fun getAuthV(includeNonce: Boolean, signature: String?, cloud: Boolean): String {
+        if (USE_MODERN_AUTH) {
+            // Match FusClient's header, not just its signature. Two differences that were
+            // left in place last time: it always sends the nonce for non-cloud requests
+            // (its includeNonce only gates the cloud branch), and it never sends newauth.
+            val headerNonce = if (cloud && !includeNonce) "" else nonce
+
+            return "FUS nonce=\"$headerNonce\", signature=\"$auth\", nc=\"\", type=\"\", realm=\"\""
+        }
+
         return "FUS nonce=\"${if (includeNonce) encNonce else ""}\", signature=\"${this.auth}\", nc=\"\", type=\"\", realm=\"\", newauth=\"1\""
     }
 
@@ -87,48 +119,97 @@ object FusClientLegacy : IFusClient<FusClientLegacy.Request> {
                 headers {
                     append("Authorization", authV)
                     append("User-Agent", "Kiss2.0_FUS")
-                    append("Cookie", "JSESSIONID=${sessionId}")
-                    append("Set-Cookie", "JSESSIONID=${sessionId}")
+                    append("Cookie", cookieHeader())
+                    append("Set-Cookie", cookieHeader())
                     append(HttpHeaders.ContentLength, "${data.toByteArray().size}")
                 }
                 setBody(data)
             }
 
         val body = response.bodyAsText()
 
-        println(request)
-
-        if (request != Request.GENERATE_NONCE && response.is401(body)) {
-            generateNonce()
+        println("$request -> HTTP ${response.status.value}")
+        println("  sent Authorization: $authV")
+        println("  sent Cookie: ${cookieHeader()}")
+        response.headers.entries().forEach { (name, values) ->
+            println("  <- $name: ${values.joinToString(", ")}")
+        }
 
-            return makeReq(request = request, data = data, signature = signature, includeNonce = includeNonce)
+        if (USE_MODERN_AUTH && request == Request.GENERATE_NONCE) {
+            // The auth_params blob that authenticateBlock() reads is deleted on l
```

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/IFusClient.kt` (modified, +2/-2)
```diff
@@ -76,7 +76,7 @@ interface IFusClient<Request : IFusClient.IRequest> {
                     destination = Destination(dest.getAbsolutePath()),
                     headers = mapOf(
                         "Authorization" to authV,
-                        "User-Agent" to "Kies2.0_FUS",
+                        "User-Agent" to "Kiss2.0_FUS",
                     ),
                 ),
             )
@@ -120,7 +120,7 @@ interface IFusClient<Request : IFusClient.IRequest> {
                 url(url)
                 headers {
                     append("Authorization", authV)
-                    append("User-Agent", "Kies2.0_FUS")
+                    append("User-Agent", "Kiss2.0_FUS")
                     if (start > 0) {
                         append("Range", "bytes=${start}-")
                     }
```

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/Request.kt` (modified, +12/-7)
```diff
@@ -24,7 +24,6 @@ import tk.zwander.common.util.isAccessoryModel
 import tk.zwander.common.util.textNode
 import tk.zwander.samloaderkotlin.resources.MR
 import kotlin.time.Duration.Companion.milliseconds
-import kotlin.time.ExperimentalTime
 
 /**
  * Handle some requests to Samsung's servers.
@@ -217,15 +216,22 @@ object Request {
         legacy: Boolean,
     ): String {
         val logicCheck = run {
-            val special = fileName.slice(fileName.length - 25 until fileName.length - 9)
+            val special = if (legacy) {
+                fileName.split(".").first().run { slice(this.length - (16 % this.length)..this.lastIndex) }
+            } else {
+                fileName.slice(fileName.length - 25 until fileName.length - 9)
+            }
             getLogicCheck(special, nonce)
         }
 
         val xml = xml("FUSMsg") {
             "FUSHdr" {
-                textNode("ProtoVer", "1")
-                textNode("SessionID", "0")
-                textNode("MsgID", "1")
+                textNode("ProtoVer", if (legacy) "1.0" else "1")
+
+                if (!legacy) {
+                    textNode("SessionID", "0")
+                    textNode("MsgID", "1")
+                }
             }
             "FUSBody" {
                 "Put" {
@@ -284,7 +290,6 @@ object Request {
      * @param region the device region.
      * @return a BinaryFileInfo instance representing the file.
      */
-    @OptIn(ExperimentalTime::class)
     private suspend fun getBinaryFile(
         fw: String,
         model: String,
@@ -411,7 +416,7 @@ object Request {
 
                 val v4Key = try {
                     responseXml.extractV4Key()
-                        ?: CryptUtils.getV4Key(fw, model, region, imeiSerial)
+                        ?: CryptUtils.getV4Key(fw, model, region, imeiSerial, legacy = legacy)
                 } catch (e: Exception) {
                     e.printStackTrace()
                     null
```

---

### Incident Patch 6: `e3f7840d` (2026-07-13)
**Commit Message**: Fix Info.plist updater

**File**: `common/build.gradle.kts` (modified, +32/-24)
```diff
@@ -284,31 +284,39 @@ afterEvaluate {
     val versionName: String = rootProject.extra["versionName"] as String
     val versionCode: Int = rootProject.extra["versionCode"] as Int
 
-    try {
-        providers.exec {
-            commandLine(
-                "plutil",
-                "-replace",
-                "CFBundleShortVersionString",
-                "-string",
-                versionName,
-                "../iosApp/iosApp/Info.plist",
-            )
-        }
-    } catch (_: Throwable) {
+    val setVersionName = providers.exec {
+        isIgnoreExitValue = true
+
+        commandLine(
+            "/usr/bin/plutil",
+            "-replace",
+            "CFBundleShortVersionString",
+            "-string",
+            versionName,
+            "${rootProject.layout.projectDirectory.asFile.absolutePath}/iosApp/iosApp/Info.plist",
+        )
     }
 
-    try {
-        providers.exec {
-            commandLine(
-                "plutil",
-                "-replace",
-                "CFBundleVersion",
-                "-string",
-                "$versionCode",
-                "../iosApp/iosApp/Info.plist",
-            )
-        }
-    } catch (_: Throwable) {
+    val setVersionCode = providers.exec {
+        isIgnoreExitValue = true
+
+        commandLine(
+            "/usr/bin/plutil",
+            "-replace",
+            "CFBundleVersion",
+            "-string",
+            "$versionCode",
+            "${rootProject.layout.projectDirectory.asFile.absolutePath}/iosApp/iosApp/Info.plist",
+        )
+    }
+
+    setVersionName.result.get()
+    setVersionCode.result.get()
+
+    setVersionName.standardError.asText.get().takeIf { it.isNotBlank() }?.let {
+        println(it)
+    }
+    setVersionCode.standardError.asText.get().takeIf { it.isNotBlank() }?.let {
+        println(it)
     }
 }
```

---

### Incident Patch 7: `ed0c5bd0` (2026-07-13)
**Commit Message**: Fix IMEI slice in permission request result

**File**: `common/src/androidMain/kotlin/tk/zwander/common/util/PhoneInfoUtils.kt` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ fun rememberPhoneInfo(): PhoneInfo? {
         context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
     }
     val permissionRequester = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { result ->
-        permissionContinuation?.resume(if (result) telephonyManager.imei?.slice(0..7) else null)
+        permissionContinuation?.resume(if (result) telephonyManager.imei?.takeIf { it.length >= 8 }?.slice(0..7) else null)
         permissionContinuation = null
     }
 
```

---

### Incident Patch 8: `02521cad` (2026-07-13)
**Commit Message**: Update jSystemThemeDetector to fix NPE on Linux

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ flatlaf = "3.7.2"
 githubApi = "2.0-rc.7"
 google-material = "1.14.0"
 jna = "5.19.1"
-jsystemthemedetector = "dc3ca477a9"
+jsystemthemedetector = "ff1818c9c9"
 ketch = "0.0.1-rc9"
 kmpfile = "0.8.0"
 kmpplatform = "0.1.0"
```

---

### Incident Patch 9: `989c3338` (2026-05-19)
**Commit Message**: Fix history fetching

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/FusClient.kt` (modified, +5/-1)
```diff
@@ -96,7 +96,11 @@ object FusClient {
             includeNonce -> nonce
             else -> ""
         }
-        return "FUS nonce=\"${if (cloud) nonce else ""}\", signature=\"${makeSignatureHash(signature?.takeIf { !it.isBlank() }) ?: this.auth}\", nc=\"${if (hasSignature) "00000001" else ""}\", type=\"${if (hasSignature) "auth" else ""}\", realm=\"${if (hasSignature) "auth" else ""}\""
+        return "FUS nonce=\"${if (cloud) nonce else this.nonce}\", " +
+                "signature=\"${makeSignatureHash(signature?.takeIf { !it.isBlank() }) ?: this.auth}\", " +
+                "nc=\"${if (hasSignature) "00000001" else ""}\", " +
+                "type=\"${if (hasSignature) "auth" else ""}\", " +
+                "realm=\"${if (hasSignature) "interface" else ""}\""
     }
 
     private fun getDownloadUrl(path: String): String {
```

---

### Incident Patch 10: `57425fe6` (2026-05-19)
**Commit Message**: Fix session cookie retrieval

**File**: `common/src/commonMain/kotlin/tk/zwander/common/tools/FusClient.kt` (modified, +10/-6)
```diff
@@ -123,8 +123,8 @@ object FusClient {
                 headers {
                     append("Authorization", authV)
                     append("User-Agent", "SMART 2.0")
-                    append("Cookie", "JSESSIONID=${sessionId}")
-                    append("Set-Cookie", "JSESSIONID=${sessionId}")
+                    append("Cookie", "JSESSIONID=${sessionId};SESSION=${sessionId}")
+                    append("Set-Cookie", "JSESSIONID=${sessionId};SESSION=${sessionId}")
                     append(HttpHeaders.ContentLength, "${data.toByteArray().size}")
                 }
                 setBody(data)
@@ -159,12 +159,16 @@ object FusClient {
 
         if (response.headers["Set-Cookie"] != null || response.headers["set-cookie"] != null) {
             sessionId = response.headers.entries()
-                .find { it.value.any { value -> value.contains("JSESSIONID=") } }
-                ?.value?.find {
-                    it.contains("JSESSIONID=")
+                .firstNotNullOfOrNull { headers ->
+                    headers.value.find { value ->
+                        value.contains("JSESSIONID=") ||
+                                value.contains("SESSION=")
+                    }
                 }
                 ?.replace("JSESSIONID=", "")
-                ?.replace(Regex(";.*$"), "") ?: sessionId
+                ?.replace("SESSION=", "")
+                ?.replace(Regex(";.*$"), "")
+                ?: sessionId
         }
 
         return body
```

#### Recent Merged Pull Requests:
- **PR #489** (2026-09-05): New Crowdin updates (@zacharee)
- **PR #488** (2026-09-05): New Crowdin updates (@zacharee)
- **PR #443** (closed): Android only dev (@panchuanxiang-svg)
- **PR #442** (closed): refactor: 精简为纯 Android 架构 (移除 desktop/iosApp) - 阶段一 (@panchuanxiang-svg)
- **PR #422** (2026-03-10): Implement a new request method that doesn't IMEIs and works with watches (@zacharee)
- **PR #405** (2026-02-19): Add TAC for SM-F968N (@Manouchehri)
- **PR #356** (closed): Create SECURITY.md (@Isaac-2e)
- **PR #314** (2025-02-16): Add TACs (@saadelasfur)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
