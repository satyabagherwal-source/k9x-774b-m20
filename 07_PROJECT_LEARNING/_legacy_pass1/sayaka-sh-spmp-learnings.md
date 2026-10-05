# Forensic Learning Record (Deep Inspection): sayaka-sh/spmp

> **Canonical Artifact**: `07_PROJECT_LEARNING/sayaka-sh-spmp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sayaka-sh/spmp](https://github.com/sayaka-sh/spmp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T02:08:30.857Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sayaka-sh/spmp`
- **Description**: SpMp has been succeeded by Kanon, see README --- A YouTube Music client with a focus on customisation of colours and song metadata. Built with Compose Multiplatform for Android and desktop.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1451 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `OrganiseStrings.py`
```
import os
from xmltodict import parse as xmltodict

TODO_COMMENT = "<!--TODO-->"

ASSETS_DIR = "shared/src/commonMain/composeResources/"
BASE_STRINGS_XML_PATH = "shared/src/commonMain/composeResources/values/strings.xml"

UNTRANSLATABLE_MATCH = "translatable=\"false\""
STRING_START = "    <string name=\""
STRING_ARRAY_START = "    <string-array name=\""
STRING_ARRAY_ITEM_START = "        <item>"
STRING_ARRAY_ITEM_END = "</item>"

def isPathInPath(path: str, in_path: str):
    return os.path.realpath(path).startswith(os.path.realpath(in_path) + os.sep)

def organiseAllStrings(assets_dir: str = ASSETS_DIR, base_xml_path: str = BASE_STRINGS_XML_PATH, stage_files: bool = False, move_todos_to_top: bool = False):
    for item in os.listdir(assets_dir):
        item_path = os.path.join(assets_dir, item)

        if not os.path.isdir(item_path) or not item.startswith("values"):
            continue

        # Skip directory containing base_xml_path
        if isPathInPath(base_xml_path, item_path):
            continue

        strings_xml_path = os.path.join(item_path, "strings.xml")
        if not os.path.isfile(strings_xml_path):
            continue

        if stage_files:
            print(f"Staging {item}")
            os.system(f"git add {strings_xml_path}")

        organiseStringsFile(strings_xml_path, base_xml_path, move_todos_to_top = move_todos_to_top)

def organiseStringsFile(xml_path: str, base_xml_path: str = BASE_STRINGS_XML_PATH, out_path: str | None = None, move_todos_to_top: bool = False):
    print(f"Organising {xml_path.removeprefix(ASSETS_DIR)} based on {base_xml_path.removeprefix(ASSETS_DIR)}")

    xml_data = xmltodict(open(xml_path, "r").read())["resources"]
    out_path = out_path or xml_path

    def getString(key: str) -> str | None:
        for item in xml_data["string"]:
            if item["@name"] == key:
                if not "#text" in item:
                    return None
                return item["#text"].replace("\n", "&#xA;")
        return None

    def getStringArray(key: str) -> list[str] | None:
        for array in xml_data["string-array"]:
            if array["@name"] == key:
                if "item" not in array:
                    return None
                return [item.replace("\n", "&#xA;") for item in array["item"]]
        return None

    file_lines = open(base_xml_path, "r").readlines()
    i = 0

    lines = []
    first_added = False

    def addString(line: str):
        key = line.split("\"")[1]

        original_value = line.split(">")[1].split("<")[0]
        if len(original_value) == 0:
            lines.append(line)
            return

        localised = getString(key)
        new_line = line.replace(original_value, localised or "")
        if localised is None:
            new_line = new_line.replace("\n", f" {TODO_COMMENT}\n")

        lines.append(new_line)

    def addStringArray(array: list[str]):
        key = array[0].split("\"")[1]
        localised = getStringArray(key)

        lines.append(array[0])

        if localised is not None:
            for item in localised:
                lines.append(STRING_ARRAY_ITEM_START + item + STRING_ARRAY_ITEM_END + "\n")
        else:
            lines.append(f"    {TODO_COMMENT}\n")

        lines.append(array[-1])

    while i < len(file_lines):
        line = file_lines[i]
        i += 1

        if line.isspace() and not first_added:
            continue

        if UNTRANSLATABLE_MATCH in line:
            continue

        if line.startswith(STRING_START):
            addString(line)
            first_added = True

        elif line.startswith(STRING_ARRAY_START):
            array_lines = [line]

            line = file_lines[i]
            i += 1

            while line.startswith(STRING_ARRAY_ITEM_START):
                array_lines.append(line)
                line = file_lines[i]
                i += 1

            # Array end
            array_lines.append(line)

            addStringArray(array_lines)
            first_added = True

        else:
            lines.append(line)

    open(out_path, "w").writelines(lines)

    if move_todos_to_top:
        moveTodoLinesToTop(out_path)

def moveTodoLinesToTop(xml_path: str, file_lines: list[str] | None = None):
    lines = []

    top_lines_index = None

    for line in file_lines or open(xml_path, "r").readlines():
        if top_lines_index is None and line.startswith(STRING_START) or line.startswith(STRING_ARRAY_START):
            top_lines_index = len(lines)
            lines.append("\n")

        if TODO_COMMENT in line:
            lines.insert(top_lines_index or len(lines), line)
        else:
            lines.append(line)

    open(xml_path, "w").writelines(lines)

def promptYesNo(message: str) -> bool:
    answer = None
    while answer != "y" and answer != "n":
        answer = input(f"{message} ( y / n ) ").lower()
    return answer == "y"

def main():
    stage = promptYesNo("Stage files before modification?")
    move_todos = promptYesNo("Move TODOs to the top of files?")

    organiseAllStrings(stage_files = stage == "y", move_todos_to_top = move_todos)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `ReplaceStrings.py`
```
import os
import re

STRING_REGEX = r"getString\(\"([^\"]+)\"\)"
STRING_REGEX_REPLACEMENT = r"stringResource(Res.string.\1)"

def formatStringKey(key: str) -> str:
    if "$" in key:
        return f"`{key}`"

    return key

def getImportsForReplacements(replacements: list[re.Match]) -> list[str]:
    imports = [
        "org.jetbrains.compose.resources.stringResource",
        "spmp.shared.generated.resources.Res"
    ]

    for replacement in replacements:
        call = replacement.string[replacement.start() : replacement.end()]
        string_key = call[11:-2]

        imports.append(f"spmp.shared.generated.resources.{formatStringKey(string_key)}")

    return [f"import {imp}" for imp in imports]

def processKotlinFile(path: str):
    f = open(path, "r")
    content = f.read()
    f.close()

    replacements = list(re.finditer(STRING_REGEX, content))
    if len(replacements) == 0:
        return

    content = re.sub(STRING_REGEX, STRING_REGEX_REPLACEMENT, content)

    imports_start_line = None
    package_line = None

    lines = content.split("\n")

    for index, line in enumerate(lines):
        line = line.strip()
        if line.startswith("package "):
            package_line = index
        elif line.startswith("import "):
            imports_start_line = index

    if imports_start_line is None:
        imports_start_line = package_line + 1
    else:
        imports_start_line += 1

    for index, import_line in enumerate(getImportsForReplacements(replacements)):
        lines.insert(imports_start_line + index, import_line)

    f = open(path, "w")
    f.write("\n".join(lines))
    f.close()

def main():
    for root, dirs, files in os.walk("."):
        for file in files:
            if file.endswith(".kt"):
                processKotlinFile(os.path.join(root, file))

if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #452** (2025-02-21): **SpMp fails to get the video stream URL for any song.**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  1. Open SpMp 2. Play any song you see 3. Doesn't play at all  ### Expected behavior  Should play  ### Actual behavior  Doesn't play  ### Screenshots / recordings  https://github.com/user-attachments/assets/2019bba5-0113-4e20-9a3e-ce96c5bde7ef  ### Logs  `java.lang.RuntimeException: Getting video stream url for XqoanTj5pNY failed         at dev.toastbits.spms.mpv.MpvClientImpl.onMpvHook-z13BHRw$library(MpvClientImpl.kt:282)         at dev.toastbits.spms.mpv.MpvClientImpl$onMpvHook$1.invokeSuspend(MpvClientImpl.kt)         at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:33)         at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:104)         at kotlinx.coroutines.internal.LimitedDispatcher$Worker.run(LimitedDispatcher.kt:111)         at kotlinx.coroutines.scheduling.TaskImpl.run(Tasks.kt:99)         at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:585)         at kotlinx.coroutines.
  **Post-Mortem & Fix Analysis**:
  > This happens for all stream/download methods.
  > Duplicate of #416

- **Issue #448** (2025-01-29): **Does not play anything**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  1. Choose any one of the three playback methods 2. Try to play anything  ### Expected behavior  The song should play  ### Actual behavior  The app endlessly “loads”, nothing happens, not even the length of the song  ### Screenshots / recordings  https://github.com/user-attachments/assets/7d37484c-c479-48b8-9e63-0e877de56a25  ### Logs  No crash  ### SpMp version  0.4.2  ### SpMp platform  Android  ### OS version  Android 14  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #416.

- **Issue #447** (2025-01-27): **Playback is stuck indefinitely**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. (actually there are closed ones but it didn't help) - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  1. Search a song. For example "Sucker" cover by Itsuki. 2. Play it  ### Expected behavior  The song plays. It used to work fine.  ### Actual behavior  It's stuck indefinitely.   ### Screenshots / recordings  ![Image](https://github.com/user-attachments/assets/920d3c1a-55f7-436e-ac7a-0742913e8c66)   ### Logs  1737937203.314 10088  2792  2792 E ActivityManagerWrapper: getRecentTasks: taskId=24647   userId=0   baseIntent=Intent { act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=com.toasterofbread.spmp.debug/com.toasterofbread.spmp.MainActivity } 1737937203.326 10088  2792  2792 D TaskView: TaskView bind task, task=[id=24647 stackId=24647 windowingMode=1 user=0 lastActiveTime=501729358, component=ComponentInfo{com.toasterofbread.spmp.debug/com.toasterofbread.spmp.MainActivity}] SpMp (debug), isLock=false 1737937203.328 10088  2792  2956 D IconLoader: Loading icon: id=24647 sta
  **Post-Mortem & Fix Analysis**:
  > I have the same problem with youtubei
  > Duplicate of #416.
  > @toasterofbread Is it? I'm not getting any getVideoFormats error. No error popup, and no such error in my log. What makes you think it's the same issue?

- **Issue #443** (2025-01-22): **Takes an indefinite amount of time to load a song**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  1. Login to YouTube  2. Play a song  ### Expected behavior  Songs should load without waiting indefinitely  ### Actual behavior  Songs takes a long time to load  ### Screenshots / recordings  _No response_  ### Logs   None  ### SpMp version  0.4.2  ### SpMp platform  Android  ### OS version  Android 13  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #416

- **Issue #441** (2025-01-22): **Unable to download songs**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  Select download song, Song unable to download  ### Expected behavior  Song should be downloaded  ### Actual behavior  Error promt: java.lang.RuntimeException: No valid formats returned by getVideoFormats(NfxKuAHDC3s)     at com.toasterofbread.spmp.model.mediaitem.song.SongAudioQualityKt.getSongFormats(Unknown Source:141)     at com.toasterofbread.spmp.model.mediaitem.song.SongAudioQualityKt$getSongFormats$1.invokeSuspend(Unknown Source:10)     at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(Unknown Source:8)     at kotlinx.coroutines.DispatchedTask.run(Unknown Source:112)     at androidx.core.app.ActivityRecreator$1.run(Unknown Source:98)     at kotlinx.coroutines.scheduling.TaskImpl.run(Unknown Source:2)     at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(Unknown Source:95)  ### Screenshots / recordings  _No response_  ### Logs  java.lang.RuntimeException: No valid formats returned by getVideoFormats(NfxKuAHDC3s)     at com.toast
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #416.

- **Issue #437** (2025-01-08): **Runtime Exception**
  *Symptoms*: ### Checklist  - [X] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [X] I've checked that there is no open or closed issue about this bug. - [X] This issue contains only one bug. - [X] The title of this issue accurately describes the bug.  ### Steps to reproduce  >play some music >In some case throw a notification saying "RunTimeException" >In some cases don't play radio playlist of the same artist's songs  ### Expected behavior  Don't appear the notification saying RunTimeException   ### Actual behavior  Apeear notification saying RunTimeException   ### Screenshots / recordings  ![Screenshot_2025-01-07-22-15-54-778_com toasterofbread spmp](https://github.com/user-attachments/assets/fe4177f6-0875-4292-9c02-6a2e9536bd37) ![Screenshot_2025-01-07-22-17-19-074_com toasterofbread spmp](https://github.com/user-attachments/assets/2eb8ff86-9542-4d9d-948a-4553156bc048) ![Screenshot_2025-01-07-22-15-48-346_com toasterofbread spmp](https://github.com/user-attachments/assets/5c296a91-fe92-4679-8360-3a6ef6a114b1)   ### Logs  java.lang.RuntimeException: No valid formats returned by getVideoFormats(FF3leCRssIc) 	at com.toasterofbread.spmp.model.mediaitem.song.SongAudioQualityKt.getSongFormats(Unknown Source:141) 	at com.toasterof
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #416 (this is the pinned issue, did you really check for duplicates?).

- **Issue #431** (2025-01-02): **Unable to Stream or Download Music**
  *Symptoms*: ### Checklist  - [X] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [X] I've checked that there is no open or closed issue about this bug. - [X] This issue contains only one bug. - [X] The title of this issue accurately describes the bug.  ### Steps to reproduce  1) Open application 2) log into YT account 3) wait for YT music selection to appear 4) select music to stream or download 5) wait forever  ### Expected behavior  Music playback and/or download  ### Actual behavior  Infinite buffering  ### Screenshots / recordings  ![17358479899341384423398805041991](https://github.com/user-attachments/assets/a5a70593-7044-4db9-a99d-64c413fc2dad)   ### Logs  Couldn't find a file, so here's a direct-from-terminal copy:  [user@computer ~]$ flatpak run dev.toastbits.spmp Database is already up to date (version 6) Loading resource file at values/strings.xml Loading resource file at values-en-US/strings.xml SLF4J(W): No SLF4J providers were found. SLF4J(W): Defaulting to no-operation (NOP) logger implementation SLF4J(W): See https://www.slf4j.org/codes.html#noProviders for further details. Event (true, null): PROPERTY_CHANGED({key="is_playing", value=false}) Connecting to server at tcp://127.0.0
  **Post-Mortem & Fix Analysis**:
  > Also, not sure if this is separate, but the radio tab gives this:  ![20250102_151528.jpg](https://github.com/user-attachments/assets/87ad174b-a435-4b61-8e18-11b10ef75e5e)  
  > It makes sense you wouldn't realise because the error message is slightly different, but this is a duplicate of #416.

- **Issue #430** (2025-01-01): **Android Auto**
  *Symptoms*: ### Checklist  - [X] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [X] I've checked that there is no open or closed issue about this bug. - [X] This issue contains only one bug. - [X] The title of this issue accurately describes the bug.  ### Steps to reproduce  Connect phone to android auto Not able to see spmp player on car screen  ### Expected behavior  App should appear in car display after android auto connect   ### Actual behavior  App not appearing in car display after android auto connect   ### Screenshots / recordings  _No response_  ### Logs  No logs  ### SpMp version  0.4.2  ### SpMp platform  Android  ### OS version  Android 15  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #67. This is not planned.

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

### Incident Patch 1: `06adced2` (2025-03-12)
**Commit Message**: Fix desktop workflows build

**File**: `.github/workflows/build-linux.yml` (modified, +1/-6)
```diff
@@ -22,12 +22,7 @@ jobs:
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: |
-          22
-          21
-
-    - name: Set up Gradle
-      uses: gradle/gradle-build-action@v3
+        java-version: 22
 
     - name: Build tarball
       run: ./gradlew desktopApp:packageReleaseTarball
```

**File**: `.github/workflows/build-windows.yml` (modified, +1/-6)
```diff
@@ -25,9 +25,7 @@ jobs:
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: |
-          22
-          21
+        java-version: 22
 
     - name: Set PACKAGE_JAVA_HOME
       run: |
@@ -47,9 +45,6 @@ jobs:
 
     - run: dir desktopApp\build\package\windows
 
-    - name: Set up Gradle
-      uses: gradle/gradle-build-action@v3
-
     - name: Build zip and exe
       run: .\gradlew.bat desktopApp:packageReleaseZip desktopApp:packageReleaseExe -PGIT_TAG_OVERRIDE="v0.4.0"
 
```

---

### Incident Patch 2: `82a3c5af` (2025-03-12)
**Commit Message**: Fix Android workflow build

**File**: `.github/workflows/build-android.yml` (modified, +2/-7)
```diff
@@ -18,16 +18,11 @@ jobs:
       with:
         submodules: recursive
 
-    - name: Set up JDKs
+    - name: Set up JDK
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: |
-          22
-          21
-
-    - name: Set up Gradle
-      uses: gradle/gradle-build-action@v3
+        java-version: 22
 
     - name: Build debug APK
       run: ./gradlew androidApp:packageDebug
```

**File**: `androidApp/build.gradle.kts` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ android {
 
     kotlin {
         jvmToolchain {
-            version = "17"
+            version = "22"
         }
     }
 
```

**File**: `buildSrc/build.gradle.kts` (modified, +1/-1)
```diff
@@ -14,5 +14,5 @@ dependencies {
 }
 
 tasks.withType(JavaCompile::class) {
-    options.release.set(21)
+    options.release.set(22)
 }
```

**File**: `desktopApp/build.gradle.kts` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ fun getString(key: String): String {
 }
 
 kotlin {
-    jvmToolchain(21)
+    jvmToolchain(22)
 
     jvm()
     sourceSets {
```

**File**: `gradle.properties` (modified, +1/-1)
```diff
@@ -23,6 +23,6 @@ org.jetbrains.compose.experimental.wasm.enabled=true
 
 # Plugin versions
 kotlin.version=2.1.10
-agp.version=8.4.1
+agp.version=8.8.2
 compose.version=1.8.0-alpha01
 sqldelight.version=2.0.2
```

---

### Incident Patch 3: `be104052` (2025-01-30)
**Commit Message**: Fix NP background image opacity being used as theme BG opacity

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/platform/AppContext.kt` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ class AppThemeManager(
     private var accent_colour_source: AccentColourSource? by
         mutableStateOf(context.settings.Theme.ACCENT_COLOUR_SOURCE.get())
     private var background_opacity: Float by
-        mutableStateOf(context.settings.Theme.NOWPLAYING_DEFAULT_BACKGROUND_IMAGE_OPACITY.get())
+        mutableStateOf(context.settings.Theme.WINDOW_BACKGROUND_OPACITY.get())
 
     override fun selectAccentColour(values: ThemeValues, contextualColour: Color?): Color =
         when(accent_colour_source ?: AccentColourSource.THEME) {
```

---

### Incident Patch 4: `c28e8e8b` (2024-11-12)
**Commit Message**: Fix notification back button restarting song (closes #398)

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/PlayerSessionCallback.kt` (modified, +2/-2)
```diff
@@ -39,11 +39,11 @@ class PlayerSessionCallback(
     }
 
     override fun onSkipToNext() {
-        player.seekToNext()
+        player.seekToNextMediaItem()
     }
 
     override fun onSkipToPrevious() {
-        player.seekToPrevious()
+        player.seekToPreviousMediaItem()
     }
 
     override fun onPlay() {
```

---

### Incident Patch 5: `fbafb618` (2024-11-08)
**Commit Message**: Remove widget debug information display option

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/SpMpWidget.kt` (modified, +19/-35)
```diff
@@ -199,44 +199,34 @@ abstract class SpMpWidget<A: TypeWidgetClickAction, T: TypeWidgetConfig<A>>(
                             .clickable(WidgetActionCallback(configuration.type_configuration.click_action)),
                         contentAlignment = Alignment.Center
                     ) {
-                        if (base_configuration.show_debug_information) {
-                            shouldHide()
-                            hasContent()
-                        }
-                        else {
+                        WithCurrentSongImage { song, song_image ->
                             if (shouldHide() || !visible) {
-                                return@Box
+                                return@WithCurrentSongImage
                             }
 
-                            if (!hasContent() && base_configuration.hide_when_no_content) {
-                                return@Box
+                            if (!hasContent(song) && base_configuration.hide_when_no_content) {
+                                return@WithCurrentSongImage
                             }
-                        }
 
-                        GlanceBorderBox(
-                            base_configuration.border_radius_dp.dp,
-                            theme.theme.accent,
-                            GlanceModifier
-                                .fillMaxSize()
-                                .systemCornerRadius()
-                        ) {
-                            Column(
+                            GlanceBorderBox(
+                                base_configuration.border_radius_dp.dp,
+                                theme.theme.accent,
                                 GlanceModifier
                                     .fillMaxSize()
-                                    .thenIf(!custom_background) {
-                                        background(widget_background_colour)
-                                    }
                                     .systemCornerRadius()
                             ) {
-                                if (base_configuration.show_debug_information) {
-                                    DebugInfoItems(GlanceModifier)
-                                }
-
-                                Box(
-                                    GlanceModifier.fillMaxSize().defaultWeight(),
-                                    contentAlignment = Alignment.Center
+                                Column(
+                                    GlanceModifier
+                                        .fillMaxSize()
+                                        .thenIf(!custom_background) {
+                                            background(widget_background_colour)
+                                        }
+                                        .systemCornerRadius()
                                 ) {
-                                    WithCurrentSongImage { song, song_image ->
+                                    Box(
+                                        GlanceModifier.fillMaxSize().defaultWeight(),
+                                        contentAlignment = Alignment.Center
+                                    ) {
                                         Content(
                                             song, song_image, GlanceModifier.wrapContentSize(),
                                             PaddingValues(15.dp)
@@ -321,17 +311,11 @@ abstract class SpMpWidget<A: TypeWidgetClickAction, T: TypeWidgetConfig<A>>(
     )
 
     @Composable
-    protected open fun hasContent(): Boolean = true
+    protected open fun hasContent(song: Song?): Boolean = song != null
 
     @Composable
     protected open fun shouldHide(): Boolean = false
 
-    @Composable
-    protected open fun DebugInfoItems(item_modifier: GlanceModifier) {
-        WidgetText("ID: $widget_id", item_modifier)
-        WidgetText("Update: ${widget_type.getUpdateValue()}", item_modifier)
-    }
-
     @Composable
     fun
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/impl/LyricsWidget.kt` (modified, +1/-8)
```diff
@@ -53,18 +53,11 @@ internal abstract class LyricsWidget: SpMpWidget<LyricsWidgetClickAction, Lyrics
     }
 
     @Composable
-    override fun hasContent(): Boolean {
-        val song: Song? = LocalPlayerState.current.status.m_song
+    override fun hasContent(song: Song?): Boolean {
         lyrics_state = song?.let { SongLyricsLoader.rememberItemState(it, context) }
         return lyrics_state?.lyrics?.sync_type?.let { it != SongLyrics.SyncType.NONE } == true
     }
 
-    @Composable
-    override fun DebugInfoItems(item_modifier: GlanceModifier) {
-        super.DebugInfoItems(item_modifier)
-        WidgetText("Song: ${lyrics_state?.song} (${lyrics_state?.song?.observeActiveTitle()?.value})", item_modifier)
-    }
-
     @Composable
     final override fun Content(
         song: Song?,
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/impl/SongQueueWidget.kt` (modified, +0/-4)
```diff
@@ -32,10 +32,6 @@ internal class SongQueueWidget: SpMpWidget<SongQueueWidgetClickAction, SongQueue
             else -> throw IllegalStateException(action.toString())
         }
 
-    @Composable
-    override fun hasContent(): Boolean =
-        LocalPlayerState.current.status.m_song != null
-
     @Composable
     private fun Heading(text: String, modifier: GlanceModifier = GlanceModifier) {
         WidgetText(
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/impl/SplitImageControlsWidget.kt` (modified, +0/-4)
```diff
@@ -58,10 +58,6 @@ internal class SplitImageControlsWidget: SpMpWidget<SplitImageControlsWidgetClic
             else -> throw IllegalStateException(action.toString())
         }
 
-    @Composable
-    override fun hasContent(): Boolean =
-        LocalPlayerState.current.status.m_song != null
-
     @Composable
     override fun Content(
         song: Song?,
```

**File**: `shared/src/commonMain/composeResources/values-ja-rJP/strings.xml` (modified, +0/-1)
```diff
@@ -1084,7 +1084,6 @@
     <string name="widget_config_common_key_border_radius">ボーダーの半径（dp）</string>
     <string name="widget_config_common_key_hide_when_no_content">コンテンツがないときは非表示</string>
     <string name="widget_config_common_key_show_app_icon">アプリのアイコンを表示</string>
-    <string name="widget_config_common_key_show_debug_information">デバッグ情報を表示</string>
     <string name="widget_config_common_key_click_action">タップアクション</string>
     <string name="widget_config_common_key_section_theme_opacity">不透明度</string>
     <string name="widget_config_common_option_section_theme_mode_background">バックグラウンド</string>
```

---

### Incident Patch 6: `d5d25302` (2024-11-07)
**Commit Message**: Fix status bar colour not set correctly on app reopen

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/ui/layout/nowplaying/container/UpdateBarColours.kt` (modified, +6/-4)
```diff
@@ -21,10 +21,12 @@ internal fun UpdateBarColours(page_height: Dp) {
     val background_colour: Color = player.getNPBackground()
     val status_bar_height: Dp = WindowInsets.statusBars.getTop()
 
-    val status_bar_height_percent = (
-        status_bar_height.value * (if (player.context.isDisplayingAboveNavigationBar()) 1f else 0.75f)
-    ) / page_height.value
-    val under_status_bar by remember { derivedStateOf { 1f - expansion.get() < status_bar_height_percent } }
+    val status_bar_height_percent: Float =
+        (status_bar_height.value * (if (player.context.isDisplayingAboveNavigationBar()) 1f else 0.75f)) / page_height.value
+
+    val under_status_bar: Boolean by remember(status_bar_height) { derivedStateOf {
+        1f - expansion.get() < status_bar_height_percent
+    } }
 
     DisposableEffect(under_status_bar, background_colour) {
         player.bar_colour_state.status_bar.setLevelColour(
```

---

### Incident Patch 7: `46bcdc22` (2024-10-31)
**Commit Message**: Fix existing songs not skipped when starting radio from player

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/platform/playerservice/PlayerServicePlayer.kt` (modified, +0/-1)
```diff
@@ -323,7 +323,6 @@ abstract class PlayerServicePlayer(internal val service: PlayerService) {
                         },
                         onSuccessfulLoad = onSuccessfulLoad,
                         insertion_index = index,
-                        skip_existing = false,
                         clear_after = true
                     )
                 }
```

---

### Incident Patch 8: `5ef7c57d` (2024-10-31)
**Commit Message**: Fix queue clear, shuffle, and artist button appearances

**File**: `buildSrc/src/main/kotlin/plugins/spmp/Dependencies.kt` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ class SpMpDeps(extra: Map<String, Any>) {
                 license_url = "https://github.com/toasterofbread/spmp-server/blob/6dde651ffc102d604ac7ecd5ac7471b1572fd2e6/LICENSE"
             ),
             "dev.toastbits.composekit" to DependencyInfo(
-                version = "76ef6d1ac7",
+                version = "d4a289335a",
                 name = "ComposeKit",
                 author = "toasterofbread",
                 url = "https://github.com/toasterofbread/composekit",
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/ui/layout/nowplaying/queue/CurrentRadioIndicator.kt` (modified, +13/-3)
```diff
@@ -131,7 +131,13 @@ internal fun CurrentRadioIndicator(
 }
 
 @Composable
-private fun RadioFilterChip(selected: Boolean, getAccentColour: () -> Color, onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
+private fun RadioFilterChip(
+    selected: Boolean,
+    getAccentColour: () -> Color,
+    onClick: () -> Unit,
+    modifier: Modifier = Modifier,
+    content: @Composable () -> Unit
+) {
     FilterChip(
         selected,
         modifier = modifier.height(32.dp),
@@ -175,9 +181,13 @@ private fun FiltersRow(
                         radio.setRadioFilter(-1)
                     }
                 },
-                modifier = Modifier.width(48.dp)
+                modifier = Modifier.width(40.dp)
             ) {
-                Icon(MediaItemType.ARTIST.getIcon(), null, Modifier.offset(x = (-4).dp))
+                Icon(
+                    MediaItemType.ARTIST.getIcon(),
+                    null,
+                    Modifier.requiredSize(18.dp)
+                )
             }
         }
 
```

---

### Incident Patch 9: `60bb637e` (2024-10-30)
**Commit Message**: Fix notification seek position not updating on some transitions

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/PlatformExternalPlayerService.android.kt` (modified, +0/-1)
```diff
@@ -109,7 +109,6 @@ actual class PlatformExternalPlayerService: ForegroundPlayerService(play_when_re
             }
 
             override fun seekTo(index: Int, position_ms: Long) {
-                println("PROXY SEEK $index $position_ms")
                 server.seekToSong(index)
                 server.seekTo(position_ms)
             }
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/notification/NotificationState.kt` (modified, +2/-1)
```diff
@@ -7,5 +7,6 @@ data class NotificationState(
     val playback_state: Int? = PlaybackState.STATE_NONE,
     val paused: Boolean = true,
     val current_liked_status: SongLikedStatus? = null,
-    val authenticated: Boolean = false
+    val authenticated: Boolean = false,
+    val position_ms: Long? = null
 )
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/notification/NotificationStateManager.kt` (modified, +6/-7)
```diff
@@ -14,10 +14,7 @@ import kotlinx.coroutines.Job
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.withContext
 
-class NotificationStateManager(
-    private val media_session: MediaSession,
-    private val player: Player
-) {
+class NotificationStateManager(private val media_session: MediaSession) {
     var current: NotificationState = NotificationState()
         private set
 
@@ -27,14 +24,16 @@ class NotificationStateManager(
         playback_state: Int? = current.playback_state,
         paused: Boolean = current.paused,
         current_liked_status: SongLikedStatus? = current.current_liked_status,
-        authenticated: Boolean = current.authenticated
+        authenticated: Boolean = current.authenticated,
+        position_ms: Long? = current.position_ms
     ) {
         val new_state: NotificationState =
             NotificationState(
                 playback_state,
                 paused,
                 current_liked_status,
-                authenticated
+                authenticated,
+                position_ms
             )
 
         if (new_state == current) {
@@ -58,7 +57,7 @@ class NotificationStateManager(
         state_builder.setState(
             playback_state
                 ?: if (paused) PlaybackState.STATE_PAUSED else PlaybackState.STATE_PLAYING,
-            player.currentPosition,
+            position_ms ?: 0,
             if (paused) 0f else 1f,
             SystemClock.elapsedRealtime()
         )
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/notification/PlayerServiceNotificationManager.kt` (modified, +14/-3)
```diff
@@ -43,15 +43,15 @@ class PlayerServiceNotificationManager(
     private val media_session: MediaSession,
     private val notification_manager: NotificationManager,
     private val service: ForegroundPlayerService,
-    player: Player
+    private val player: Player
 ) {
     private var current_song: Song? = null
     private val thumbnail_load_scope: CoroutineScope = CoroutineScope(Job())
     private val auth_state_observe_scope: CoroutineScope = CoroutineScope(Job())
     private val song_liked_load_scope: CoroutineScope = CoroutineScope(Job())
 
     private val metadata_builder: MediaMetadata.Builder = MediaMetadata.Builder()
-    private val state: NotificationStateManager = NotificationStateManager(media_session, player)
+    private val state: NotificationStateManager = NotificationStateManager(media_session)
 
     private val notification_listener: PlayerNotificationManager.NotificationListener =
         object : PlayerNotificationManager.NotificationListener {
@@ -85,7 +85,10 @@ class PlayerServiceNotificationManager(
                 }
 
                 current_song = song
-                state.update(current_liked_status = song?.Liked?.get(context.database))
+                state.update(
+                    current_liked_status = song?.Liked?.get(context.database),
+                    position_ms = player.currentPosition
+                )
 
                 if (song != null) {
                     context.database.songQueries.likedById(song.id).addListener(song_liked_listener)
@@ -102,10 +105,18 @@ class PlayerServiceNotificationManager(
                 }
             }
 
+            override fun onSeeked(position_ms: Long) {
+                state.update(position_ms = position_ms)
+            }
+
             override fun onPlayingChanged(is_playing: Boolean) {
                 state.update(paused = !is_playing)
             }
 
+            override fun onEvents() {
+                state.update(position_ms = player.currentPosition)
+            }
+
             override fun onStateChanged(state: SpMsPlayerState) {
                 this@PlayerServiceNotificationManager.state.update(
                     playback_state =
```

---

### Incident Patch 10: `ed02270c` (2024-10-24)
**Commit Message**: Fix Android release build

**File**: `androidApp/proguard-rules.pro` (modified, +6/-0)
```diff
@@ -42,6 +42,12 @@
 # Ktor
 -dontwarn io.ktor.**
 
+-dontwarn java.beans.BeanDescriptor
+-dontwarn java.beans.BeanInfo
+-dontwarn java.beans.IntrospectionException
+-dontwarn java.beans.Introspector
+-dontwarn java.beans.PropertyDescriptor
+
 # From proguard-android-optimize.txt
 
 -optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
```

#### Recent Merged Pull Requests:
- **PR #454** (closed): hm (@nfw64)
- **PR #435** (closed): Rewrite download service (@sayaka-sh)
- **PR #421** (2024-12-22): Allow audio capture for screen recorders on Android (@kairusds)
- **PR #415** (2025-01-29): Update to new ComposeKit (@sayaka-sh)
- **PR #391** (2024-10-27): Upload binaries to nightly release (@sayaka-sh)
- **PR #386** (2024-11-06): Add Android widgets (@sayaka-sh)
- **PR #370** (2024-09-04): Add Lrclib lyrics provider (@spl3g)
- **PR #369** (closed): WIP: Add lrclib lyrics provider (@spl3g)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
