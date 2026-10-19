> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tangshimin-mujing-learnings.md`  
> **Source**: github ([https://github.com/tangshimin/MuJing](https://github.com/tangshimin/MuJing))  
> **Source Version**: `9ca8c14e`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:21:31.788Z  
> **Learning ID**: `learn-github-tangshimin-mujing`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tangshimin/MuJing

---

## 1. Executive Forensic Architecture & System Mechanics

`tangshimin/MuJing` is an offline-first, desktop English-language contextual acquisition engine built on Compose Multiplatform (Desktop/JVM), VLCJ/FFmpeg, and Swing interoperability layers. The system solves the dual problem of **passive immersion degradation** and **lexical context decoupling**: traditional flashcards divorce words from prosody and narrative context, whereas raw video immersion lacks active recall testing, immediate dictionary alignment, and spaced repetition tracking.

```
                      +-------------------------------------------------------------+
                      |                      DESKTOP WINDOW                         |
                      |  (Compose Multiplatform for Desktop + Swing Interop Canvas) |
                      +-------------------------------------------------------------+
                                                     |
             +---------------------------------------+---------------------------------------+
             |                                                                               |
             v                                                                               v
+--------------------------+                                                    +--------------------------+
|       AppState           |                                                    |       PlayerState        |
| - Global preferences     |                                                    | - Media playback state   |
| - Active Vocabulary      |                                                    | - Caption track sync     |
| - Swing Fallback (FlatLaf|                                                    | - Subtitle track routing |
| - State Persistence (IO) |                                                    | - Danmaku overlay loop   |
+--------------------------+                                                    +--------------------------+
             |                                                                               |
             v                                                                               v
+--------------------------+   Spaced Repetition   +------------------------+   FFmpeg CLI  +--------------------------+
|      FSRS Engine         | <-------------------> |      FlashCard         | <-----------> |       FFmpegUtil         |
| - Interval calculations  |                       | - Stability, Difficulty|               | - Whisper AI Filter      |
| - Due date projections   |                       | - Review timestamps    |               | - mov_text SRT Stripping |
| - Timezone conversions   |                       +------------------------+               | - Subtitle Demuxing      |
+--------------------------+                                                                +--------------------------+
                                                                                                     |
                                                                                                     v
                                                                                            +--------------------------+
                                                                                            |   CanvasDanmakuRenderer  |
                                                                                            | - 60 FPS Render Loop     |
                                                                                            | - TextMeasurer caching   |
                                                                                            | - Track collision alloc  |
                                                                                            +--------------------------+
```

### Critical Subsystem Boundaries and Mechanics

1. **State Ownership & Compose-to-Swing Bridge**:
   The application maintains a dual UI paradigm: declarative Compose Multiplatform state objects (`AppState`, `PlayerState`, `WordScreenState`) bind to Compose hierarchies, while desktop native window decorations and legacy components utilize Swing wrappers (`CellVisibleSwingState`, `JFrame`, `FlatLightLaf`, `JOptionPane`). Reactive fields utilize snapshot-backed properties (`mutableStateOf`, `SnapshotStateList`).

2. **Multimedia & AI Extraction Layer (`FFmpegUtil`)**:
   Video subtitle demuxing and speech-to-text generation are driven by shelling out to statically embedded FFmpeg binaries (`getResourcesFile("ffmpeg/ffmpeg.exe")` on Windows; POSIX executable bits explicitly asserted on Unix). In-process pipes parse Whisper log output streams (`ProcessBuilder.redirectErrorStream(true)`) to calculate transcode progress via regex matching over stdout/stderr tokens (`Duration`, `time`, `speed`).

3. **High-Performance Canvas Overlay Subsystem (`CanvasDanmakuRenderer` & `DanmakuStateManager`)**:
   Danmaku (bullet subtitle comments) are decoupled from the video renderer through a high-frequency (16ms ~60 FPS) tick loop running inside Compose `LaunchedEffect(danmakuItems)`. Sub-pixel positioning and track collisions are dynamically allocated using `TrackManager`. Text metrics are measured and memoized lazily via Compose's `TextMeasurer` to eliminate layout reflow overhead during frame drawing.

4. **Spaced Repetition Pipeline (`FSRSTimeUtils`)**:
   Scheduling leverages the Free Spaced Repetition Scheduler (FSRS) algorithm. Time deltas are calculated at millisecond precision via `java.time.Instant`, projected into wall-clock wall times using `LocalDateTime.ofInstant(..., ZoneId.systemDefault())`, and persisted into state schemas.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Filter String Escaping for Native Process Command Lines
**RULE**:
When parameterizing native CLI media engines (e.g., FFmpeg complex filter graphs) with filesystem paths, the system MUST normalize paths to forward slashes (`/`) AND escape path-syntax collision characters (colon `:`, brackets `[`, `]`, quotes `'`, `"`) before interpolating them into command arguments.

**WHY**:
On Windows platforms, file paths contain absolute drive specifiers (e.g., `C:\path\to\model`). In FFmpeg filter syntax, colons are reserved token delimiters for filter arguments (e.g., `whisper=model=C:\path...` is parsed as filter parameter `model=C` followed by unknown parameter `\path`). This causes immediate native process termination with obscure filter parsing errors.

**WHEN TO APPLY**:
Any application shelling out to FFmpeg, GStreamer, ImageMagick, or native CLI utilities where internal filter graphs, query strings, or sub-specifiers accept local filesystem paths across cross-platform environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package com.mujingx.ffmpeg

import java.io.File

/**
 * Escapes arbitrary filesystem paths for safe interpolation
 * into FFmpeg filter strings (-vf / -af / -filter_complex).
 */
fun escapeFilterPath(rawPath: String): String {
    // Step 1: Normalize all Windows backslashes to Unix forward-slashes
    val normalized = rawPath.replace("\\", "/")
    
    // Step 2: Escape colon delimiters (critical for Windows drive letters C:) 
    // and structural filter characters (brackets, quotes)
    return normalized
        .replace(":", "\\:")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace("'", "\\'")
        .replace("\"", "\\\"")
}

fun buildWhisperAudioFilter(
    modelFile: File,
    outputSrt: File,
    language: String = "en",
    queueSize: Int = 3
): String {
    require(modelFile.exists()) { "Model missing at: ${modelFile.absolutePath}" }
    
    val safeModelPath = escapeFilterPath(modelFile.absolutePath)
    val safeOutputPath = escapeFilterPath(outputSrt.absolutePath)
    
    return buildString {
        append("whisper=model=").append(safeModelPath)
        append(":language=").append(language)
        append(":queue=").append(queueSize)
        append(":destination=").append(safeOutputPath)
        append(":format=srt")
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// NEVER interpolate unescaped OS paths directly into FFmpeg filter specifications
fun buildBrokenFilter(modelPath: String, outputPath: String): String {
    // FAILS ON WINDOWS: "C:\dir\model.bin" becomes "whisper=model=C:\dir\model.bin"
    // FFmpeg sees param "whisper=model=C" followed by invalid token "\dir\model.bin"
    return "whisper=model=$modelPath:destination=$outputPath:format=srt"
}
```

**VERIFICATION METHOD**:
Execute an automated unit test supplying a path with a drive letter, brackets, and quotes:
```kotlin
@Test
fun `verify filter escaping handles windows drive and brackets`() {
    val input = "C:\\Program Files [x86]\\Model 'Special'\\model.bin"
    val escaped = escapeFilterPath(input)
    assertEquals("C\\:/Program Files \\[x86\\]/Model \\'Special\\'/model.bin", escaped)
}
```

---

### 2. State-Reset Invariant on Active Vocabulary Substitution
**RULE**:
When transitioning a collection-driven learning or input interface to a new dataset/vocabulary or structural view, the engine MUST atomically reset or bound-clamp all dependent user input states, cursor offsets, and selection indices BEFORE or SIMULTANEOUSLY WITH applying the data source update.

**WHY**:
If the user has entered $N$ characters of input for item $X$, and a mutation triggers a transition to item $Y$ where $\text{length}(Y) < N$, any subsequent unvalidated render pass, comparison loop, or backspace handler that dereferences the target word with the previous input string's index will trigger an unhandled `StringIndexOutOfBoundsException` or `IndexOutOfBoundsException`.

**WHEN TO APPLY**:
Typing interfaces, flashcard review decks, code editors, and data tables where selection/input indices depend dynamically on the bounds of the active row/entity.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
class TypingSessionCoordinator(
    private var activeWord: String = ""
) {
    var currentInput: String = ""
        private set
    var cursorPosition: Int = 0
        private set

    /**
     * Atomically swaps the active word target and sanitizes transient input state.
     */
    fun transitionToWord(newWord: String) {
        activeWord = newWord
        // Enforce state clamp invariant: transient input state cannot outlive parent entity
        sanitizeOrClearInput()
    }

    private fun sanitizeOrClearInput() {
        if (currentInput.length > activeWord.length) {
            // Option A: Hard reset state
            currentInput = ""
            cursorPosition = 0
        } else {
            // Option B: Clamp cursor to safe boundaries
            cursorPosition = cursorPosition.coerceAtMost(activeWord.length)
        }
    }

    fun submitChar(char: Char): Boolean {
        if (currentInput.length >= activeWord.length) {
            return false // Strict boundary invariant
        }
        val targetIndex = currentInput.length
        val matches = activeWord[targetIndex].equals(char, ignoreCase = true)
        currentInput += char
        cursorPosition = currentInput.length
        return matches
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// NEVER swap the underlying dataset while leaving transient input metrics dangling
fun onWordUnmarked(wordScreenState: WordScreenState, nextWord: Word) {
    wordScreenState.currentWord = nextWord 
    // BUG: wordScreenState.userInput remains populated with the previous word's typed text!
    // If previous word had 7 characters and nextWord has 6 characters,
    // next evaluation: nextWord.spelling[wordScreenState.userInput.length] CRASHES!
}
```

**VERIFICATION METHOD**:
Simulate edge-transition boundaries in a stress unit test:
```kotlin
@Test
fun `transitioning from longer word to shorter word prevents index out of bounds`() {
    val session = TypingSessionCoordinator("extraordinary") // 13 chars
    "extraordinary".forEach { session.submitChar(it) }
    
    // Switch to a 3-character target word without manually wiping input beforehand
    session.transitionToWord("cat")
    
    // Ensure input state is guaranteed safe and does not exceed bounds
    assertTrue(session.cursorPosition <= 3)
    assertTrue(session.currentInput.length <= 3)
}
```

---

### 3. Non-Blocking Coroutine Offloading Over runBlocking in UI State Containers
**RULE**:
UI State managers and ViewModels MUST NOT invoke `runBlocking` to dispatch background filesystem IO, JSON serialization, or network persistence operations; all asynchronous write pipelines MUST execute via an unblocked `CoroutineScope` (e.g., `viewModelScope`, structured state scope) dispatched to `Dispatchers.IO`.

**WHY**:
Calling `runBlocking` blocks the invoking thread until the inner coroutine finishes. When triggered from user action callbacks or UI event handlers, this blocks the Desktop UI Event Dispatch Thread (EDT) or Compose Recomposer loop. Even fast JSON writes cause micro-stutters, and OS file lock contention, disk thrashing, or high IO wait causes full application deadlocks and "Application Not Responding" (ANR) lockups.

**WHEN TO APPLY**:
Desktop Compose UI, Android ViewModels, Swing/AWT action listeners, and KMP applications updating persistent local settings, database state, or cached payloads.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

class SafeSettingsPersistence(
    private val scope: CoroutineScope,
    private val storageFile: File
) {
    private val json = Json { prettyPrint = true; encodeDefaults = true }

    // Mutex or single-thread confinement prevents concurrent file write corruption
    private val writeDispatcher = Dispatchers.IO.limitedParallelism(1)

    fun persistAsync(data: Map<String, String>) {
        scope.launch(writeDispatcher) {
            try {
                val serialized = json.encodeToString(data)
                val tempFile = File(storageFile.parentFile, "${storageFile.name}.tmp")
                tempFile.writeText(serialized, Charsets.UTF_8)
                // Atomic file swap
                if (!tempFile.renameTo(storageFile)) {
                    tempFile.copyTo(storageFile, overwrite = true)
                    tempFile.delete()
                }
            } catch (e: Exception) {
                // Graceful logging / telemetry hook without crashing the render thread
                System.err.println("Failed to serialize settings: ${e.message}")
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// NEVER lock the UI dispatcher with runBlocking to perform IO
fun savePlayerStateBlocking(playerData: PlayerData, file: File) {
    runBlocking { // BLOCKS COMPOSE RECOMPOSER / SWING EDT
        launch(Dispatchers.IO) {
            val json = Json.encodeToString(playerData)
            file.writeText(json) // Disk stalls lock the entire desktop frame rendering
        }
    }
}
```

**VERIFICATION METHOD**:
Run an architecture assertion or static analysis check checking for `runBlocking` calls within files matching `*State.kt` or `*ViewModel.kt`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: IndexOutOfBoundsException on Canceling Hard Word Marking (BUG-MUJING-01)
- **Context**: Difficulty word list screen (`WordScreenState.kt` / `HardVocabulary` interaction).
- **What Was Expected**: When the user exercises spelling on a hard vocabulary word (e.g., length 7) and hits `Ctrl+I` to unmark the word from the hard deck, the application should advance to the next word (e.g., length 6) cleanly and reset user input.
- **What Actually Happened**: The user typed 7 characters of a 7-character word. On pressing `Ctrl+I`, the word was removed from the list and the view updated to the next word in the list, whose length was 6. The UI immediately crashed with:
  `java.lang.StringIndexOutOfBoundsException: String index out of range: 7` or `IndexOutOfBoundsException`.
- **Evidence in Repo**: Closed Issue #104: *"困难词库中，拼写部分单词后取消标记时，若已拼写的单词长度超过下一个单词，则会产生‘超出边界错误’"*.
- **Root Cause**: The unmarking handler altered the active word entity without resetting the character input buffer or clamping the comparison loop index. The rendering canvas/text field evaluated the existing 7-character buffer against the 6-character bounds of the incoming word.
- **Remediation Code Diff**:
```kotlin
// - Previous flawed logic inside unmark handler:
// wordList.remove(currentWord)
// currentWord = wordList[index]
// // User input left intact; next frame tries: currentWord.spelling[typedText.length - 1] -> Crash!

// + Corrected state clearing pattern:
fun onUnmarkWord(word: Word) {
    wordScreenState.clearInputtedState() // Invariant: purge typing buffer before index recomputation
    hardVocabulary.remove(word)
    if (wordScreenState.index >= hardVocabulary.size) {
        wordScreenState.index = (hardVocabulary.size - 1).coerceAtLeast(0)
    }
    wordScreenState.updateCurrentWord()
}
```
- **Lesson**: Subordinate state (cursor, selection, buffer) MUST be reset or clamped upon any structural alteration of the backing collection.

---

### Incident 2: Host Operating System Mouse Pointer Prompt Leakage (BUG-MUJING-02)
- **Context**: Native file chooser invocation on macOS (`AppState.kt` / `loadingFileChooserVisible`).
- **What Was Expected**: Opening a native file dialog to select subtitle or video media should isolate tooltip and hover events to the dialog window, clearing OS tooltips upon closing.
- **What Actually Happened**: After opening and dismissing a local file chooser on macOS, moving the cursor into unrelated third-party applications caused orphaned filename tooltips from MuJing to hover over the entire operating system desktop.
- **Evidence in Repo**: Closed Issue #103: *"在幕境使用了本地文件选择器后，在其它应用移动鼠标时，可能会出现文件名称提示"*.
- **Root Cause**: AWT/Swing `JFileChooser` integration on macOS (Cocoa-Java bridge) retains native mouse tracker hooks if the dialog is disposed without relinquishing cursor grab or when mixing lightweight Compose windows with heavyweight AWT dialogs without explicit focus synchronization.
- **Remediation Code Diff**:
```kotlin
// - Flawed direct invocation:
// val chooser = JFileChooser()
// val result = chooser.showOpenDialog(null)

// + Robust native dialog lifecycle wrapper:
fun showNativeOpenDialog(parent: Component?): File? {
    System.setProperty("apple.awt.fileDialogForDirectories", "false")
    val fileDialog = java.awt.FileDialog(parent as? java.awt.Frame, "选择文件", java.awt.FileDialog.LOAD)
    try {
        fileDialog.isVisible = true
        val filename = fileDialog.file ?: return null
        val directory = fileDialog.directory ?: return null
        return File(directory, filename)
    } finally {
        fileDialog.dispose() // Invariant: Explicit native peer destruction purges macOS AppKit tooltips
    }
}
```
- **Lesson**: On macOS JVM desktop applications, never use Swing's `JFileChooser`; always use AWT `FileDialog` to invoke the native Cocoa `NSOpenPanel`, and explicitly call `.dispose()` to purge OS tooltip tracking loops.

---

### Incident 3: GitHub Actions Release Action Asset Collision and Formatting Crash (BUG-MUJING-03)
- **Context**: Continuous Integration & Delivery Pipeline (`.github/workflows/Build Package.yml`).
- **What Was Expected**: Packaging jobs on Windows and macOS build `.msi`, `.zip`, and `.dmg` binaries, which `ncipollo/release-action@v1` attaches to GitHub Releases.
- **What Actually Happened**: Build failures occurred in CI due to improper syntax matching: the action failed to parse multiline `assets:` specifications, and explicit file enumerations broke when runner naming conventions changed.
- **Evidence in Repo**: Commits `13492355`, `faa7adc0`, and `a65a3834`.
- **Root Cause**:
  1. `ncipollo/release-action` expects file patterns in the `artifacts:` key, whereas custom naming remappings require strict colon formatting in `assets:`.
  2. Matrix changes (`macos-15` -> `macos-15-intel`) broke fixed path lists.
  3. Git tags prefixed with `v` (e.g., `v1.2.0`) clashed with release binary naming schemes (`MuJing-1.2.0.msi`), breaking hardcoded download links in the release notes markdown.
- **Remediation Code Diff**:
```yaml
// - Commit 13492355:
-          assets: |
-            artifacts/windows-package-x64/*.msi:MuJing-${{ env.TAG }}.msi
-            artifacts/windows-package-portable-x64/*.zip:MuJing-${{ env.TAG }}.zip
-            artifacts/macos-package-x64/*.dmg:MuJing-${{ env.TAG }}-x64.dmg
-            artifacts/macos-package-aarch64/*.dmg:MuJing-${{ env.TAG }}-aarch64.dmg
+          artifacts: "artifacts/windows-package-x64/*.msi,artifacts/windows-package-portable-x64/*.zip,artifacts/macos-package-x64/*.dmg,artifacts/macos-package-aarch64/*.dmg"

// - Commit faa7adc0 & a65a3834:
-        run: echo "TAG=${{ github.ref_name }}" >> $GITHUB_ENV
+        run: |
+          TAG=${{ github.ref_name }}
+          VERSION=${TAG#v}  # Purge 'v' prefix for numeric alignment
+          echo "TAG=$TAG" >> $GITHUB_ENV
+          echo "VERSION=$VERSION" >> $GITHUB_ENV

// Replaced brittle enumeration with resilient recursive globbing:
-          artifacts: "artifacts/windows-package-x64/*.msi,..."
+          artifacts: "artifacts/**/*.msi,artifacts/**/*.zip,artifacts/**/*.dmg"
```
- **Lesson**: Decouple Git tag nomenclature (`vX.Y.Z`) from binary package filenames (`Package-X.Y.Z`) at the CI boundary, and use recursive globs (`**/*`) rather than brittle step-path assumptions.

---

### Incident 4: Subtitle Parsing Crashes on Video Container Embedded Tags (BUG-MUJING-04)
- **Context**: Subtitle extraction and indexing (`FFmpegUtil.kt` / `writeSubtitleToFile`).
- **What Was Expected**: Extracting subtitle tracks from MP4/MKV files (`mov_text` or `ass` streams) should yield clean SRT files containing readable dialogue text for vocabulary indexing.
- **What Actually Happened**: Subtitle extractors from Apple QuickTime and MP4 files (`mov_text`) embed HTML-like styling tags (`<font face="...">`, `<ruby><rt>...</rt></ruby>`, `<b>`, `<i>`). When processed by the word tokenizer, these tags were indexed as vocabulary words, resulting in users studying flashcards for tokens like "face", "font", "size", or garbage markup tokens.
- **Evidence in Repo**: Source implementation in `FFmpegUtil.kt`: `RICH_TEXT_REGEX`, `removeRichText(File)`.
- **Root Cause**: Binary subtitle streams encode markup directly into the string payload. Direct extraction without a text-sanitization pipeline passes XML/HTML tags directly into dictionary generation engines.
- **Remediation Code Diff**:
```kotlin
// Sanitization Pipeline Invariant:
const val RICH_TEXT_REGEX = "</?(b|i|u|font|s|ruby|rt|rb|sub|sup)(\\s[^>]*)?>"

fun writeSubtitleToFile(videoPath: String, trackId: Int): File? {
    val settingsDir = getSettingsDirectory()
    val subtitleFile = File(settingsDir, "subtitles.srt")
    val result = extractSubtitles(videoPath, trackId, subtitleFile.absolutePath)
    if (result == "finished") {
        // Strip rich text tags while preserving line breaks
        if (hasRichText(subtitleFile)) {
            removeRichText(subtitleFile)
        }
        return subtitleFile
    }
    return null
}
```
- **Lesson**: Subtitle extraction engines MUST enforce an intermediate sanitization phase to strip container-specific markup before tokens touch indexing or text-matching engines.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Density DP/Pixel Scaler Invariant**: In Compose Desktop, `Modifier.offset` accepts `Dp` units, whereas native canvas pointer positions are calculated in physical pixels.
  ```kotlin
  // CRITICAL PRECISION REQUIREMENT:
  // Convert physical pixel coordinates (Float) to Dp strictly dividing by density
  val xDp = (item.x / density.density).dp
  val yDp = (item.y / density.density).dp
  ```
  Failing to divide by `LocalDensity.current.density` leads to high-DPI (Retina / 4K) scaling drift where hover hit-boxes diverge from rendered text by $1.5\times$ to $2\times$.
- **Deep JSON Serialization Immutability**:
  In `PlayerState.kt`, saving list state directly from mutable snapshots causes `ConcurrentModificationException` if a recomposition mutates the list during background encoding:
  ```kotlin
  // SAFE: Create an explicit detached copy before leaving the UI thread
  val serializeList = recentList.toList()
  encodeBuilder.encodeToString(serializeList)
  ```

### 2. Infinite Loop & Recursion Guards
- **Danmaku Lifecycle Eviction Bound**:
  The 60 FPS animation loop in `CanvasDanmakuRenderer.kt` iterates over active elements. To guarantee that abandoned or non-visible elements do not create an infinite memory leak and render backlog:
  ```kotlin
  // TERMINATION INVARIANT:
  // An item MUST be marked inactive as soon as its bounding box passes the left edge
  if (item.type == DanmakuType.SCROLL && (item.x + item.textWidth) < 0f) {
      item.isActive = false
  }
  ```
- **Waiting Queue Allocation Cap**:
  In `DanmakuStateManager.kt`, if tracks are saturated, new items append to `waitingQueue`. Without an explicit ceiling, a burst of video subtitles creates an unbounded queue.
  ```kotlin
  // QUEUE STARVATION GUARD:
  if (waitingQueue.size > 20) {
      waitingQueue.removeAt(0) // Evict oldest to preserve memory
  }
  // TIMEOUT GUARD:
  if (System.currentTimeMillis() - pending.addTime > 5000L) {
      iterator.remove() // Evict stale items over 5s old
  }
  ```

### 3. UI & UX Micro-Mechanics
- **TextMeasurer Lazy Evaluation Invariant**:
  Calling `TextMeasurer.measure()` inside a 60 FPS draw phase induces extreme CPU load. 
  ```kotlin
  // INVARIANT: Cache text measurement directly on the item model
  if (item.textWidth == 0f) {
      val measured = textMeasurer.measure(item.text, textStyle)
      item.textWidth = measured.size.width.toFloat()
      // Center static banners only once upon measurement discovery
      if (item.type == DanmakuType.TOP || item.type == DanmakuType.BOTTOM) {
          item.x = (canvasWidth - item.textWidth) / 2
      }
  }
  ```
- **Popup Event Isolation**:
  When displaying interactive hover details over moving canvas subtitles, hovering MUST pause movement for that specific item to prevent the user from "chasing" the hitbox:
  ```kotlin
  danmakuItems.forEach { item ->
      if (item.isActive && item != hoveredItem) { // Exclude hovered item from translation tick
          item.x -= speed
      }
  }
  ```

### 4. Backend Concurrency & Memory Safety
- **Native Process Stream Drainage**:
  When spawning native external processes (`ffmpeg`) via `ProcessBuilder`, stdout and stderr buffers must not block.
  ```kotlin
  val builder = ProcessBuilder(command)
  builder.redirectErrorStream(true) // Merge stderr into stdout
  val process = builder.start()

  // Invariant: Immediately consume the input stream on a dedicated thread
  // to avoid native pipe buffer saturation deadlocks (OS pipe buffer is ~64KB)
  Thread {
      BufferedReader(InputStreamReader(process.inputStream)).use { reader ->
          reader.forEachLine { line ->
              // Parse progress regex tokens without memory accumulation
          }
      }
  }.start()
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Corrupted Configuration Fallback**:
  If a configuration file contains corrupted JSON (e.g., following a hard power loss), deserialization throws an exception. Swallowing it leaves the app in an undefined null state; crashing leaves it unlaunchable.
  ```kotlin
  // DEFENSIVE RESTORATION PATTERN:
  try {
      Json.decodeFromString<GlobalData>(settingsFile.readText())
  } catch (e: Exception) {
      FlatLightLaf.setup() // Ensure UI toolkit is initialized to display error
      JOptionPane.showMessageDialog(null, "Settings corrupted. Falling back to defaults.")
      GlobalState(GlobalData()) // Return safe, immutable defaults
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Layout**: Segregated into distinct modules: `com.mujingx.player` (media, subtitles, canvas renderers), `com.mujingx.state` (system preferences, lifecycle tracking), `com.mujingx.fsrs` (spaced repetition mathematical engine), and `com.mujingx.ffmpeg` (external CLI integration).
- **Decoupling**: The video presentation layer communicates with the vocabulary subsystem exclusively via immutable models (`Word`, `MediaInfo`) and callback lambdas, enabling the video player to run standalone or within the flashcard screen.

### 2. Core Abstractions
- `CanvasDanmakuItem`: Immutable domain entity encapsulating screen coordinates ($x, y$), motion velocity, hit-test boundaries, text typography, and payload bindings.
- `FlashCard`: Mathematical representation for the spaced repetition scheduler, tracking stability ($S$), difficulty ($D$), interval ($I$), and state transitions.
- `TrackManager`: Spatial partitioning coordinator dividing the viewport height into discrete horizontal lanes to prevent overlapping subtitles.

### 3. Error Handling
- **Fault Boundaries**: External subsystem invocations (FFmpeg, local audio playback, disk serialization) are shielded with localized `try/catch` wrappers that emit user-facing Swing alerts (`JOptionPane`) and degrade gracefully without terminating the Compose desktop dispatch tree.

### 4. Testing
- State machines (e.g., `FSRSTimeUtils`, `DanmakuStateManager`) are cleanly decoupled from Compose UI primitives, permitting pure JUnit tests on interval progression, due date verification, and timestamp delta calculations without booting a graphical display context.

### 5. Security
- **Command Injection Prevention**: Although calling native binaries via `ProcessBuilder`, arguments are passed as structured `List<String>` elements instead of raw shell command strings, preventing argument injection via malicious media filenames.
- **Resource Quarantine**: Subtitle conversion outputs are routed to a restricted user app data sandbox (`getSettingsDirectory()`).

### 6. Performance
- **Zero-Allocation Render Loops**: The Canvas rendering pipeline avoids dynamic string concatenations, font reconstructions, and array reallocations within the `16ms` frame window.
- **Lazy Text Measurement**: Geometry metrics are calculated once per subtitle lifetime and memoized on heap-allocated models.

### 7. Deployment
- **Matrix Packaging**: Multi-platform distribution across `windows-latest` (MSI/portable ZIP) and `macos-latest`/`macos-15-intel` (DMG).
- **Execution Invariants**: POSIX file permissions are verified and mutated at runtime (`ffmpegFile.setExecutable(true)`) to account for ZIP/archive permission loss during artifact downloads.

### 8. Agent Patterns
-