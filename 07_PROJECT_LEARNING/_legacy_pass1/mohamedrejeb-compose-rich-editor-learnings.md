# Forensic Learning Record (Deep Inspection): MohamedRejeb/compose-rich-editor

> **Canonical Artifact**: `07_PROJECT_LEARNING/mohamedrejeb-compose-rich-editor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MohamedRejeb/compose-rich-editor](https://github.com/MohamedRejeb/compose-rich-editor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:56:04.575Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MohamedRejeb/compose-rich-editor`
- **Description**: A Rich text editor library for both Jetpack Compose and Compose Multiplatform, fully customizable, supports HTML and Markdown.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1858 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `richeditor-compose-json/karma.config.d/mocha-timeout.js`
```
// Raise the per-test timeout for browser test targets. The seeded fuzz suites
// (RichTextEditCorruptionFuzzTest, RichTextHtmlRoundTripFuzzTest, Issue716StringIndexFuzzTest,
// RichTextJsonRoundTripFuzzTest) run hundreds of scenarios inside a single test method and
// exceed mocha's 2s default on slow CI runners, failing with a bare "Error" and no message.
config.set({
    client: {
        mocha: {
            timeout: 120000
        }
    }
});

```

### Core Architecture Module: `richeditor-compose/karma.config.d/mocha-timeout.js`
```
// Raise the per-test timeout for browser test targets. The seeded fuzz suites
// (RichTextEditCorruptionFuzzTest, RichTextHtmlRoundTripFuzzTest, Issue716StringIndexFuzzTest,
// RichTextJsonRoundTripFuzzTest) run hundreds of scenarios inside a single test method and
// exceed mocha's 2s default on slow CI runners, failing with a bare "Error" and no message.
config.set({
    client: {
        mocha: {
            timeout: 120000
        }
    }
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #741** (2026-07-20): **if underline and strikethrough are combiled then underline will not be rendered.**
  *Symptoms*: Steps to reproduce  1>open the demo site https://compose-richeditor.netlify.app/ 2>go to html to rich text and enter following `<p><u><s>this is sample line</s></u></p>` 3>Underline willl not be visible.  case 2: `<p><s><u>this is sample line</u></s></p>` now it will not render Strikethrough.  same issue in markdown
  **Post-Mortem & Fix Analysis**:
  > this issue is not related to #740 
  > I can confirm this behavior as well.  My `RichTextState.toHtml()` output is the following:  ``` <p><u><s> This text should be a strikethrough and underlined&period;</s></u></p> ``` but in my case, only strikethrough is rendered.   Should it be outputting the s and u tags, or should it output span + text-decoration when executing `RichTextState.toHtml`?  (Or something to that effect.)  edit: here's a pair of failing tests -- it appears the the order of style applications matters; the "outer" style seems to be discarded. ```     fun testParsingStruckthroughThenUnderlined() {         val html = "<p><u><s>This text should also be struck and underlined&period;</s></u></p>"          val richTextState = RichTextStateHtmlParser.encode(html)          val parsedHtml = RichTextStateHtmlParser.decode(richTextState)                  /* Fails with:         Expected :<p><u><s>This text should also be struck and underlined&period;</s></u></p>         Actual   :<p><s>This text should also be struck and
  > Thanks for reporting this issue, I'm checking it

- **Issue #709** (2026-07-14): **Typing immediately after a hyperlink span inserts text into the wrong paragraph when the editor has multiple paragraphs**
  *Symptoms*: In a RichTextEditor with multiple paragraphs (e.g., body paragraph containing a hyperlink, followed by a signature paragraph), typing immediately after the hyperlink causes the typed characters to appear in the last paragraph instead of the paragraph containing the link.  Steps to reproduce: 1. Create a RichTextState with HTML such as: <p>See <a href="https://example.com">this link</a> </p><p>-- Signature</p> 2. Position the cursor immediately after the link text (at the link's right edge) 3. Type any character  Expected: Character appears inline after the link in the body paragraph Actual: Character appears prepended to the signature (last paragraph)  Root Cause — Two bugs in RichParagraph.getRichSpanByTextIndex:  Bug 1 — Cross-paragraph false positive: RichSpanStyle.Link has acceptNewTextInTheEdges = false. When the cursor is at textIndex == fullTextRange.max - 1 (the link's right edge), RichSpan.getRichSpanByTextIndex correctly rejects the position and returns (K+4, null). The parent RichParagraph.getRichSpanByTextIndex then moves on to the next paragraph. There, the check if (index > textIndex) is true (because index carries the running offset from paragraph 1), so paragraph 2 returns its first child (the signature span) as the owner of the cursor position — a false positive.  Fix: Guard with textIndex >= offset so a paragraph only claims indices within its own content window:    if (index > textIndex) {       if (textIndex >= offset)           return index to getFirstNon
  **Post-Mortem & Fix Analysis**:
  > Hello Thanks for reporting this issue, I will check it
  > Thanks for the fix! Any plans for a release with this included in it soon?
  > Yes I will release a new version either today or tomorrow hopefully.

- **Issue #595** (2026-04-24): **KMP - iOS build fails with Compose Rich Editor**
  *Symptoms*: Hi, first of all thanks for your work on this library.  I'm using richeditor-compose in my Kotlin Multiplatform project with Compose Multiplatform. It works perfectly on Android to render Markdown content, but I’m running into a build error on iOS.  I’ve attached the full error message and I’ve also tested the sample project you provide in this repository — it also fails to compile on iOS with the same issue. Maybe, this seems to be caused because the framework generated by Kotlin/Native is static by default (isStatic = true), and Apple restricts static frameworks from linking with some system dynamic libraries like SwiftUI.  Could you consider updating the sample project and/or documentation to reflect this requirement for iOS compatibility? Thanks again!  **Module gradle:**  - **iOS**  ``` listOf(         iosX64(),         iosArm64(),         iosSimulatorArm64()     ).forEach { iosTarget ->         iosTarget.binaries.framework {             baseName = "Compose"             isStatic = true         }     } ```  - **Dependencies:**  ``` richtextMarkdown = "1.0.0-rc12" richtext-markdown-compose = { module = "com.mohamedrejeb.richeditor:richeditor-compose", version.ref = "richtextMarkdown" }  commonMain.dependencies {             implementation(compose.runtime)             implementation(compose.foundation)             implementation(compose.material3)             implementation(compose.ui)             implementation(compose.components.resources)             implementation(compo
  **Post-Mortem & Fix Analysis**:
  > +1 for this. Here are some more logs:  <details> <summary>Logs</summary>  ``` Undefined symbols for architecture arm64:   "_kfun:androidx.compose.material3#androidx_compose_material3_MaterialTheme$stableprop_getter$artificial(){}kotlin.Int", referenced from:       _kfun:com.mohamedrejeb.richeditor.ui.material3#toColor__at__com.mohamedrejeb.richeditor.ui.material3.tokens.ColorSchemeKeyTokens(androidx.compose.runtime.Composer?;kotlin.Int){}androidx.compose.ui.graphics.Color in ComposeApp[2871](libcom.mohamedrejeb.richeditor:richeditor-compose-cache.a.o)       _kfun:com.mohamedrejeb.richeditor.ui.material3#CommonDecorationBox(com.mohamedrejeb.richeditor.ui.material3.TextFieldType;kotlin.String;kotlin.Function2<androidx.compose.runtime.Composer,kotlin.Int,kotlin.Unit>;androidx.compose.ui.text.input.VisualTransformation;kotlin.Function2<androidx.compose.runtime.Composer,kotlin.Int,kotlin.Unit>?;kotlin.Function2<androidx.compose.runtime.Composer,kotlin.Int,kotlin.Unit>?;kotlin.Function2<andr
  > Giving this a bump since this is a major holdback for our company at the moment.
  > iOS support critical for us too. Please attend ASAP 🙏 

- **Issue #574** (2026-04-11): **Custom ordered list start values always reset to 1**
  *Symptoms*: ### **Issue Description** When creating or loading ordered lists with custom start values (e.g., a list starting at 10), the editor always resets the numbering to start at 1 regardless of the start attribute being set correctly in the HTML.  **Expected Behaviour** When setting HTML content with `<ol start="10">` the rendered list should display numbers starting at 10. When toggling an ordered list with a custom start value, the list should maintain that start value.  **Actual Behaviour** Lists always reset to start at 1 regardless of the start attribute in the HTML. Even after fixing the numbering programmatically, the editor reverts back to 1-based numbering.  ### **Reproduction Steps** Create HTML content with a custom list start: `<ol start="10"><li>Item</li>...</ol>` Set this content via richTextState.setHtml(html) The list renders with numbers 1, 2, 3... instead of 10, 11, 12...   ### **Attempted Solutions**  Tried setting the start attribute in the HTML Implemented post-processing to correct the numbering after rendering Used direct text manipulation to replace numbers None of these solutions work reliably as the editor actively resets the numbering  ### **Environment**  Library Version: : richeditor-compose:1.0.0-rc12  ### **Additional Context** The HTML being rendered correctly includes the start attribute and proper value attributes on list items, but these attributes are ignored or overridden by the editor's rendering logic.
  **Post-Mortem & Fix Analysis**:
  > Hello Thanks for reporting this issue, working on it

- **Issue #390** (2026-04-24): **Crash on iOS with compose 1.7.0-rc01 when fast typing 'return/enter' button**
  *Symptoms*: When using compose 1.7.0-rc01 application crash when fast typing 'return/enter' button. Sometimes it happens when fast typing multiline text  Here minimal reproduce example. https://github.com/GimazDo/KMPExample You can find app in examples/ruch-text-editor  Logs  ``` Uncaught Kotlin exception: kotlin.IllegalStateException: OffsetMapping.transformedToOriginal returned invalid mapping: 97 -> 97 is not in range of original text [0, 96]     at 0   KMPExampleRichText.debug.dylib      0x107b5554b        kfun:kotlin.Throwable#<init>(kotlin.String?){} + 119      at 1   KMPExampleRichText.debug.dylib      0x107b4ea13        kfun:kotlin.Exception#<init>(kotlin.String?){} + 115      at 2   KMPExampleRichText.debug.dylib      0x107b4ec33        kfun:kotlin.RuntimeException#<init>(kotlin.String?){} + 115      at 3   KMPExampleRichText.debug.dylib      0x107b4f1d3        kfun:kotlin.IllegalStateException#<init>(kotlin.String?){} + 115      at 4   KMPExampleRichText.debug.dylib      0x1078dfb03        kfun:androidx.compose.foundation.text.validateTransformedToOriginal#internal + 731      at 5   KMPExampleRichText.debug.dylib      0x1078df18b        kfun:androidx.compose.foundation.text#throwIfNotValidTransform__at__androidx.compose.ui.text.input.TransformedText(kotlin.Int;kotlin.Int){} + 779      at 6   KMPExampleRichText.debug.dylib      0x1078df283        kfun:androidx.compose.foundation.text#throwIfNotValidTransform$default__at__androidx.compose.ui.text.input.TransformedTe
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening this issue, I will check it.
  > same in android as well!
  > same here 

- **Issue #385** (2024-10-19): **Crash when initial markdown contains "<br>" tag **
  *Symptoms*: If we set to editor some text , containing `<br>`, and try typing some text, a crash occurs.  Of course, we can just remove/replace problematic parts before setting the text to the editor, but I think the crash is still worth to look at. Also, should we be aware of some other tags that can potentially cause similar issues?  https://github.com/user-attachments/assets/2c47607e-bfe1-421e-812c-b7e5c502f1e9  Library version: 1.0.0-rc09  ``` java.lang.StringIndexOutOfBoundsException: begin 3, end 4, length 3                  	at java.lang.String.checkBoundsBeginEnd(String.java:4500)                  	at java.lang.String.substring(String.java:2527)                  	at com.mohamedrejeb.richeditor.utils.AnnotatedStringExtKt.append-UJKp_GQ(AnnotatedStringExt.kt:119)                  	at com.mohamedrejeb.richeditor.utils.AnnotatedStringExtKt.appendRichSpan-XtCa3Zc(AnnotatedStringExt.kt:58)                  	at com.mohamedrejeb.richeditor.utils.AnnotatedStringExtKt.appendRichSpan-XtCa3Zc$default(AnnotatedStringExt.kt:43)                  	at com.mohamedrejeb.richeditor.utils.AnnotatedStringExtKt.append-UJKp_GQ(AnnotatedStringExt.kt:30)                  	at com.mohamedrejeb.richeditor.model.RichTextState.updateAnnotatedString$richeditor_compose_release(RichTextState.kt:1216)                  	at com.mohamedrejeb.richeditor.model.RichTextState.updateTextFieldValue(RichTextState.kt:1163)                  	at com.mohamedrejeb.richeditor.model.RichTextState.updateTextFieldV
  **Post-Mortem & Fix Analysis**:
  > This shouldn't happen. I will check it. For now only br HTML tag is supported in Markdown, so using any other tag will just return the tag as a text and shouldn't cause a crash.
  > br tag is mainly needed in Markdown to support multiple successive line breaks, hopefully in the future I will start supporting all other HTML tags in Markdown.  <img width="503" alt="Screenshot 2024-10-02 at 4 26 31 PM" src="https://github.com/user-attachments/assets/feba7a0c-4c8f-4d16-8874-f5b705931e9c"> 
  > I can repro it.   This is due to the incorrect initial state of markdown text that contains empty lines. See more details at #392.

- **Issue #376** (2024-10-01): **Cursor and line become out of sync when deleting rows of text**
  *Symptoms*: When you delete many lines with select delete, it leaves the cursor in a bad state    https://github.com/user-attachments/assets/15beff4f-b623-4b84-89e2-c55d65901712  Bug is present on the 2 I have tested, Web and Desktop.  
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this issue. I will check it.

- **Issue #361** (2024-09-29): **Bold-italic text is not recongnized when setting initial text**
  *Symptoms*: Set some text, containing **_bold-italic_** text (text with three asterisks `***bold-italic***`) to `RichTextState.setMarkdown`.  The text is displayed as bold, without italic formatting.  https://github.com/user-attachments/assets/0e91e588-427a-4d9f-b9f7-8cd648238055  In the video I decode markdown text from the editor, then but the same markdown back.
  **Post-Mortem & Fix Analysis**:
  > Thanks for all the issues that you are reporting. Your contribution will help me a lot to improve the library.
  > I will release a new version today that will contain all the fixes.

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

### Incident Patch 1: `d52000ac` (2026-09-30)
**Commit Message**: fix: an IME rewrite keeps the style of the text it replaces

**File**: `docs/rich_text_state.md` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ richTextState.selection = TextRange(richTextState.annotatedString.text.length)
 
 ### Replacing a selection
 
-Typing, an IME commit, or a plain-text paste over a non-collapsed selection styles the inserted text from the replaced range's start (the platform typing-attributes convention), not from the character before the caret. The restyle is part of the same edit, so undo treats the replacement as a single entry. Rich span styles are inherited only when they accept edge text and are not atomic, so replacing a whole link or image never linkifies or atomizes the typed text.
+Typing, an IME commit, or a plain-text paste over a non-collapsed selection styles the inserted text from the replaced range's start (the platform typing-attributes convention), not from the character before the caret. The same goes for an IME autocorrect or suggestion pick that rewrites a word while the caret is collapsed: the new text takes the style of the first character it replaces. The restyle is part of the same edit, so undo treats the replacement as a single entry. Rich span styles are inherited only when they accept edge text and are not atomic, so replacing a whole link or image never linkifies or atomizes the typed text.
 
 ### Text Modification
 
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +40/-9)
```diff
@@ -2131,36 +2131,67 @@ public class RichTextState internal constructor(
         replace("\r\n", "\n").replace('\r', '\n')
 
     /**
-     * The styles at the start of a non-collapsed selection an edit is about to replace,
-     * captured before the tree mutates so the inserted text can inherit them (the platform
-     * typing-attributes convention) instead of the style before the caret.
+     * The styles of the first character an edit is about to replace, captured before the tree
+     * mutates so the inserted text can inherit them (the platform typing-attributes convention)
+     * instead of the style before the caret.
      */
     private class ReplacedSelectionStyles(
         val insertedRange: TextRange,
         val spanStyle: SpanStyle,
         val richSpanStyle: RichSpanStyle,
     )
 
+    /**
+     * The replaced range is the old selection when it describes the edit (typing or pasting
+     * over it), else the changed region of the text: an IME autocorrect or suggestion pick
+     * rewrites a word while the caret stays collapsed.
+     */
     @OptIn(ExperimentalRichTextApi::class)
     private fun captureReplacedSelectionStyles(
         old: TextFieldValue,
         new: TextFieldValue,
     ): ReplacedSelectionStyles? {
         if (new.text == old.text) return null
+        val insertedRange = selectionReplacement(old, new)
+            ?: diffReplacement(old.text, new.text)
+            ?: return null
+
+        val firstReplacedSpan = getRichSpanByTextIndex(insertedRange.min, true) ?: return null
+        return ReplacedSelectionStyles(
+            insertedRange = insertedRange,
+            spanStyle = firstReplacedSpan.fullSpanStyle,
+            richSpanStyle = firstReplacedSpan.fullStyle,
+        )
+    }
+
+    /** Range of [new]'s text that took the place of [old]'s non-collapsed selection, or null. */
+    private fun selectionReplacement(old: TextFieldValue, new: TextFieldValue): TextRange? {
         val selMin = old.selection.min
         val selMax = old.selection.max
         if (selMin == selMax) return null
         val insertedLength = new.text.length - (old.text.length - (selMax - selMin))
         if (insertedLength <= 0 || selMin + insertedLength > new.text.length) return null
         if (!new.text.regionMatches(0, old.text, 0, selMin)) return null
         if (!new.text.regionMatches(selMin + insertedLength, old.text, selMax, old.text.length - selMax)) return null
+        return TextRange(selMin, selMin + insertedLength)
+    }
 
-        val selectionStartSpan = getRichSpanByTextIndex(selMin, true) ?: return null
-        return ReplacedSelectionStyles(
-            insertedRange = TextRange(selMin, selMin + insertedLength),
-            spanStyle = selectionStartSpan.fullSpanStyle,
-            richSpanStyle = selectionStartSpan.fullStyle,
-        )
+    /**
+     * Range of [newText] that took the place of removed characters, from the common prefix and
+     * suffix, or null for a pure insertion or removal.
+     */
+    private fun diffReplacement(oldText: String, newText: String): TextRange? {
+        val maxCommon = minOf(oldText.length, newText.length)
+        var prefix = 0
+        while (prefix < maxCommon && oldText[prefix] == newText[prefix]) prefix++
+        var suffix = 0
+        while (
+            suffix < maxCommon - prefix &&
+            oldText[oldText.lastIndex - suffix] == newText[newText.lastIndex - suffix]
+        ) suffix++
+        val removedLength = oldText.length - prefix - suffix
+        val insertedLength = newText.length - prefix - suffix
+        return if (removedLength > 0 && insertedLength > 0) TextRange(prefix, prefix + insertedLength) else null
     }
 
     /**
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/RichTextReplaceSelectionInheritanceTest.kt` (modified, +69/-0)
```diff
@@ -115,4 +115,73 @@ class RichTextReplaceSelectionInheritanceTest {
                 .any { it is RichTextSpanMark.TextColor && it.range == 6..11 && it.argb == redArgb },
         )
     }
+
+    @Test
+    fun `IME rewrite of a styled word with a collapsed caret inherits the first replaced character`() {
+        val state = stateWithRedWorld()
+        imeRewriteWorld(state, "World")
+
+        assertEquals("Hello World", state.toText())
+        assertTrue((6..10).all { state.isRedAt(it) })
+    }
+
+    @Test
+    fun `IME rewrite does not inherit the style before the replaced word`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.addSpanStyle(SpanStyle(fontWeight = FontWeight.Bold), TextRange(0, 6))
+        imeRewriteWorld(state, "World")
+
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .none { it is RichTextSpanMark.Bold && 6 in it.range },
+        )
+    }
+
+    @Test
+    fun `IME rewrite inherits the custom rich span style of the replaced word`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.addRichSpan(FontRunStyle(slug = "amiri"), TextRange(6, 11))
+        imeRewriteWorld(state, "World")
+
+        assertTrue(
+            (6..10).all { index ->
+                state.toRichTextDocument().blocks.single().spans.any {
+                    it is RichTextSpanMark.Custom && index in it.range && it.style == FontRunStyle(slug = "amiri")
+                }
+            },
+        )
+    }
+
+    @Test
+    fun `IME rewrite restyling is a single undo entry`() {
+        val state = stateWithRedWorld()
+        val before = state.toRichTextDocument()
+        imeRewriteWorld(state, "World")
+        val after = state.toRichTextDocument()
+
+        state.history.undo()
+        assertEquals(before, state.toRichTextDocument())
+        state.history.redo()
+        assertEquals(after, state.toRichTextDocument())
+    }
+
+    /**
+     * An autocorrect as Gboard sends it: the caret stays collapsed after "world" while the
+     * IME composes it, then commits [replacement] in its place.
+     */
+    private fun imeRewriteWorld(state: RichTextState, replacement: String) {
+        state.selection = TextRange(11)
+        state.onTextFieldValueChange(
+            TextFieldValue("Hello world", selection = TextRange(11), composition = TextRange(6, 11)),
+        )
+        state.onTextFieldValueChange(
+            TextFieldValue("Hello $replacement", selection = TextRange(6 + replacement.length)),
+        )
+    }
+
+    private fun RichTextState.isRedAt(index: Int): Boolean =
+        toRichTextDocument().blocks.single().spans
+            .any { it is RichTextSpanMark.TextColor && index in it.range && it.argb == redArgb }
 }
```

---

### Incident Patch 2: `274363c6` (2026-08-29)
**Commit Message**: fix: migrate json module build script to the AGP 9 multiplatform plugin

**File**: `richeditor-compose-json/build.gradle.kts` (modified, +10/-17)
```diff
@@ -8,7 +8,7 @@ plugins {
     alias(libs.plugins.kotlinMultiplatform)
     alias(libs.plugins.compose.compiler)
     alias(libs.plugins.composeMultiplatform)
-    alias(libs.plugins.androidLibrary)
+    alias(libs.plugins.androidKotlinMultiplatformLibrary)
     alias(libs.plugins.bcv)
     id("module.publication")
 }
@@ -17,8 +17,13 @@ kotlin {
     explicitApi()
     applyDefaultHierarchyTemplate()
 
-    androidTarget {
-        publishLibraryVariants("release")
+    android {
+        namespace = "com.mohamedrejeb.richeditor.json"
+        compileSdk = libs.versions.android.compileSdk.get().toInt()
+        minSdk = libs.versions.android.minSdk.get().toInt()
+
+        withHostTestBuilder {}
+
         @OptIn(ExperimentalKotlinGradlePluginApi::class)
         compilerOptions {
             jvmTarget.set(JvmTarget.JVM_17)
@@ -38,6 +43,7 @@ kotlin {
                 enabled = false
             }
         }
+        binaries.executable()
     }
 
     wasmJs {
@@ -46,6 +52,7 @@ kotlin {
                 enabled = true
             }
         }
+        binaries.executable()
     }
 
     iosArm64()
@@ -64,20 +71,6 @@ kotlin {
     }
 }
 
-android {
-    namespace = "com.mohamedrejeb.richeditor.json"
-    compileSdk = libs.versions.android.compileSdk.get().toInt()
-
-    defaultConfig {
-        minSdk = libs.versions.android.minSdk.get().toInt()
-    }
-
-    compileOptions {
-        sourceCompatibility = JavaVersion.VERSION_17
-        targetCompatibility = JavaVersion.VERSION_17
-    }
-}
-
 apiValidation {
     @OptIn(kotlinx.validation.ExperimentalBCVApi::class)
     klib {
```

---

### Incident Patch 3: `05462ee9` (2026-08-20)
**Commit Message**: Merge pull request #794 from MohamedRejeb/fix/change-selection-style-undo

feat: inherit the replaced selection's style when typing or pasting over it

**File**: `.github/workflows/gradle.yml` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ jobs:
 
       - name: Deploy snapshot
         env:
-          VERSION: 1.0.0-SNAPSHOT
+          VERSION: 1.1.0-SNAPSHOT
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.OSSRH_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.OSSRH_PASSWORD }}
           ORG_GRADLE_PROJECT_signingInMemoryKeyId: ${{ secrets.OSSRH_GPG_SECRET_KEY_ID }}
```

**File**: `docs/rich_text_state.md` (modified, +4/-0)
```diff
@@ -81,6 +81,10 @@ richTextState.selection = TextRange(0, richTextState.annotatedString.text.length
 richTextState.selection = TextRange(richTextState.annotatedString.text.length)
 ```
 
+### Replacing a selection
+
+Typing, an IME commit, or a plain-text paste over a non-collapsed selection styles the inserted text from the replaced range's start (the platform typing-attributes convention), not from the character before the caret. The restyle is part of the same edit, so undo treats the replacement as a single entry. Rich span styles are inherited only when they accept edge text and are not atomic, so replacing a whole link or image never linkifies or atomizes the typed text.
+
 ### Text Modification
 
 The `RichTextState` provides methods to modify text while preserving styles:
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +77/-0)
```diff
@@ -2073,6 +2073,9 @@ public class RichTextState internal constructor(
         val pendingHtml = pendingClipboardHtml.takeIf { config.richClipboardEnabled }
         val isPaste = pendingHtml != null &&
                 isPasteTextChange(textFieldValue, newTextFieldValue, pendingClipboardPlainText)
+        val replacedStyles =
+            if (isPaste) null
+            else captureReplacedSelectionStyles(textFieldValue, newTextFieldValue)
         val trigger: CommitTrigger? = when {
             isPaste -> CommitTrigger.Paste
             else -> classifyTextChange(newTextFieldValue)
@@ -2083,6 +2086,9 @@ public class RichTextState internal constructor(
 
         try {
             onTextFieldValueChangeInner(newTextFieldValue, isPaste, pendingHtml)
+            if (replacedStyles != null) {
+                applyReplacedSelectionStyles(replacedStyles)
+            }
         } finally {
             if (trigger != null) finishHistoryRecord(trigger, before)
             if (
@@ -2124,6 +2130,77 @@ public class RichTextState internal constructor(
     private fun String.normalizeNewlines(): String =
         replace("\r\n", "\n").replace('\r', '\n')
 
+    /**
+     * The styles at the start of a non-collapsed selection an edit is about to replace,
+     * captured before the tree mutates so the inserted text can inherit them (the platform
+     * typing-attributes convention) instead of the style before the caret.
+     */
+    private class ReplacedSelectionStyles(
+        val insertedRange: TextRange,
+        val spanStyle: SpanStyle,
+        val richSpanStyle: RichSpanStyle,
+    )
+
+    @OptIn(ExperimentalRichTextApi::class)
+    private fun captureReplacedSelectionStyles(
+        old: TextFieldValue,
+        new: TextFieldValue,
+    ): ReplacedSelectionStyles? {
+        if (new.text == old.text) return null
+        val selMin = old.selection.min
+        val selMax = old.selection.max
+        if (selMin == selMax) return null
+        val insertedLength = new.text.length - (old.text.length - (selMax - selMin))
+        if (insertedLength <= 0 || selMin + insertedLength > new.text.length) return null
+        if (!new.text.regionMatches(0, old.text, 0, selMin)) return null
+        if (!new.text.regionMatches(selMin + insertedLength, old.text, selMax, old.text.length - selMax)) return null
+
+        val selectionStartSpan = getRichSpanByTextIndex(selMin, true) ?: return null
+        return ReplacedSelectionStyles(
+            insertedRange = TextRange(selMin, selMin + insertedLength),
+            spanStyle = selectionStartSpan.fullSpanStyle,
+            richSpanStyle = selectionStartSpan.fullStyle,
+        )
+    }
+
+    /**
+     * Restyles the text that replaced a selection to the captured selection-start styles.
+     * Runs inside the surrounding history record, so the edit stays a single undo entry.
+     * Rich span styles are only inherited when they accept edge text and are not atomic,
+     * so replacing a whole link or image never linkifies or atomizes the typed text.
+     */
+    @OptIn(ExperimentalRichTextApi::class)
+    private fun applyReplacedSelectionStyles(replaced: ReplacedSelectionStyles) {
+        val range = replaced.insertedRange
+        val insertedSpan = getRichSpanByTextIndex(range.min, true) ?: return
+        val currentSpanStyle = insertedSpan.fullSpanStyle
+        val currentRichSpanStyle = insertedSpan.fullStyle
+
+        val inheritRich = replaced.richSpanStyle.acceptsNewTextAtEdges && !replaced.richSpanStyle.isAtomic
+        val spanDiffers = currentSpanStyle != replaced.spanStyle
+        val richDiffers = inheritRich && currentRichSpanStyle != replaced.richSpanStyle
+        if (!spanDiffers && !richDiffers) return
+
+        val wasSuppressed = suppressHistoryRecording
+        suppressHistoryRecording = true
+        val oldToAddRichSpanStyle = toAddRichSpanStyle
+        val oldToRemoveRichSpanStyleKClass = toRemoveRichSpanStyleKClass
+        try {
+      
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/RichTextReplaceSelectionInheritanceTest.kt` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.text.SpanStyle
+import androidx.compose.ui.text.TextRange
+import androidx.compose.ui.text.font.FontWeight
+import androidx.compose.ui.text.input.TextFieldValue
+import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
+import com.mohamedrejeb.richeditor.document.FontRunStyle
+import com.mohamedrejeb.richeditor.document.RichTextSpanMark
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+/**
+ * Typing or pasting over a non-collapsed selection styles the inserted text from the
+ * replaced range's start (the platform typing-attributes convention), not from the
+ * character before the caret, and the restyle is part of the same edit so undo/redo
+ * see a single entry.
+ */
+@OptIn(ExperimentalRichTextApi::class)
+class RichTextReplaceSelectionInheritanceTest {
+
+    private val redArgb = 0xFFFF0000L
+
+    private fun stateWithRedWorld(): RichTextState {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.addSpanStyle(SpanStyle(color = Color(redArgb.toInt())), TextRange(6, 11))
+        return state
+    }
+
+    @Test
+    fun `typing over a colored selection inherits the replaced color`() {
+        val state = stateWithRedWorld()
+        state.selection = TextRange(6, 11)
+
+        state.onTextFieldValueChange(TextFieldValue("Hello X", selection = TextRange(7)))
+
+        assertEquals("Hello X", state.toText())
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .any { it is RichTextSpanMark.TextColor && it.range == 6..6 && it.argb == redArgb },
+        )
+    }
+
+    @Test
+    fun `typing over a selection does not inherit the style before the caret`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.addSpanStyle(SpanStyle(fontWeight = FontWeight.Bold), TextRange(0, 6))
+        state.selection = TextRange(6, 11)
+
+        state.onTextFieldValueChange(TextFieldValue("Hello X", selection = TextRange(7)))
+
+        assertEquals("Hello X", state.toText())
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .none { it is RichTextSpanMark.Bold && 6 in it.range },
+        )
+    }
+
+    @Test
+    fun `replacement styling is a single undo entry`() {
+        val state = stateWithRedWorld()
+        val before = state.toRichTextDocument()
+        state.selection = TextRange(6, 11)
+
+        state.onTextFieldValueChange(TextFieldValue("Hello X", selection = TextRange(7)))
+
+        state.history.undo()
+        assertEquals(before, state.toRichTextDocument())
+    }
+
+    @Test
+    fun `custom rich span style is inherited when replacing its text`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.addRichSpan(FontRunStyle(slug = "amiri"), TextRange(6, 11))
+        state.selection = TextRange(6, 11)
+
+        state.onTextFieldValueChange(TextFieldValue("Hello X", selection = TextRange(7)))
+
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .any { it is RichTextSpanMark.Custom && it.range == 6..6 && it.style == FontRunStyle(slug = "amiri") },
+        )
+    }
+
+    @Test
+    fun `link is not inherited when replacing the whole link`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.addRichSpan(RichSpanStyle.Link(url = "https://example.com"), TextRange(6, 11))
+        state.selection = TextRange(6, 11)
+
+        state.onTextFieldValueChange(TextFieldValue("Hello X", selection = TextRange(7)))
+
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .none { it is RichTextSpanMark.Link },
+        )
+    }
+
+    @Test
+    fun `plain paste over a styled selection inherits the re
```

---

### Incident Patch 4: `f48a2232` (2026-08-19)
**Commit Message**: fix: recognize paste over a longer selection via clipboard plain text

Clipboard managers stash the clipboard's plain text next to the HTML; the
next text change is a paste when it replaces the old selection with exactly
that text, so pastes shorter than the replaced selection keep formatting.
Falls back to the legacy grow-only heuristic when no plain text is stashed.

**File**: `richeditor-compose/src/androidMain/kotlin/com/mohamedrejeb/richeditor/clipboard/AndroidRichTextClipboardManager.kt` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ internal class AndroidRichTextClipboardManager(
                 val htmlText = clipData.getItemAt(0).htmlText
                 if (htmlText != null) {
                     richTextState.pendingClipboardHtml = htmlText
+                    richTextState.pendingClipboardPlainText =
+                        clipData.getItemAt(0).text?.toString()
                 }
             }
             return entry
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +39/-1)
```diff
@@ -159,6 +159,13 @@ public class RichTextState internal constructor(
      */
     internal var pendingClipboardHtml: String? = null
 
+    /**
+     * The plain text of the same clipboard content as [pendingClipboardHtml], stashed by the
+     * platform clipboard managers. It is what the platform inserts on paste, so the next
+     * text change can be recognized as a paste structurally instead of by length growth.
+     */
+    internal var pendingClipboardPlainText: String? = null
+
     /**
      * The last non-collapsed selection. Updated whenever the selection changes from a
      * non-collapsed range to a different value. Used by clipboard managers on platforms
@@ -2065,7 +2072,7 @@ public class RichTextState internal constructor(
         // through the normal insertion path, inheriting styles at the caret like typed text.
         val pendingHtml = pendingClipboardHtml.takeIf { config.richClipboardEnabled }
         val isPaste = pendingHtml != null &&
-                newTextFieldValue.text.length > textFieldValue.text.length
+                isPasteTextChange(textFieldValue, newTextFieldValue, pendingClipboardPlainText)
         val trigger: CommitTrigger? = when {
             isPaste -> CommitTrigger.Paste
             else -> classifyTextChange(newTextFieldValue)
@@ -2088,13 +2095,43 @@ public class RichTextState internal constructor(
         }
     }
 
+    /**
+     * Whether the change from [old] to [new] is the paste that follows a clipboard read.
+     * With [expectedPlainText] available, a paste is recognized structurally: the old
+     * selection replaced by exactly that text (newline-normalized), which also covers
+     * pastes shorter than the replaced selection. Without it, the legacy grow-only
+     * heuristic applies, which keeps a stale stash from hijacking typing or deletion.
+     */
+    private fun isPasteTextChange(
+        old: TextFieldValue,
+        new: TextFieldValue,
+        expectedPlainText: String?,
+    ): Boolean {
+        if (expectedPlainText == null)
+            return new.text.length > old.text.length
+
+        val selMin = old.selection.min
+        val selMax = old.selection.max
+        val insertedLength = new.text.length - (old.text.length - (selMax - selMin))
+        if (insertedLength <= 0 || selMin + insertedLength > new.text.length) return false
+        if (!new.text.regionMatches(0, old.text, 0, selMin)) return false
+        if (!new.text.regionMatches(selMin + insertedLength, old.text, selMax, old.text.length - selMax)) return false
+
+        val inserted = new.text.substring(selMin, selMin + insertedLength)
+        return inserted.normalizeNewlines() == expectedPlainText.normalizeNewlines()
+    }
+
+    private fun String.normalizeNewlines(): String =
+        replace("\r\n", "\n").replace('\r', '\n')
+
     private fun onTextFieldValueChangeInner(
         newTextFieldValue: TextFieldValue,
         isPaste: Boolean,
         pendingHtml: String?,
     ) {
         if (isPaste) {
             pendingClipboardHtml = null
+            pendingClipboardPlainText = null
             val position = selection.min
             // Suppress nested history captures during the remove+insert so the entire
             // paste is a single undo group attributable to the top-level trigger.
@@ -2109,6 +2146,7 @@ public class RichTextState internal constructor(
             return
         }
         pendingClipboardHtml = null
+        pendingClipboardPlainText = null
 
         tempTextFieldValue = newTextFieldValue
 
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/RichTextPasteClassificationTest.kt` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.text.TextRange
+import androidx.compose.ui.text.input.TextFieldValue
+import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
+import com.mohamedrejeb.richeditor.document.RichTextSpanMark
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+/**
+ * Classifying the text change that follows a clipboard read. The platform inserts the
+ * clipboard's plain text; when the managers stashed it, a paste is recognized structurally
+ * (old selection replaced by exactly that text) even when the result is shorter than the
+ * replaced selection. Without the plain text, the legacy grow-only heuristic applies.
+ */
+@OptIn(ExperimentalRichTextApi::class)
+class RichTextPasteClassificationTest {
+
+    @Test
+    fun `paste over a longer selection keeps rich formatting`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.selection = TextRange(0, 11)
+        state.pendingClipboardHtml = "<b>Hi</b>"
+        state.pendingClipboardPlainText = "Hi"
+
+        state.onTextFieldValueChange(TextFieldValue("Hi", selection = TextRange(2)))
+
+        assertEquals("Hi", state.toText())
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .any { it is RichTextSpanMark.Bold && it.range == 0..1 },
+        )
+    }
+
+    @Test
+    fun `paste over an equal length selection keeps rich formatting`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.selection = TextRange(0, 2)
+        state.pendingClipboardHtml = "<b>Hi</b>"
+        state.pendingClipboardPlainText = "Hi"
+
+        state.onTextFieldValueChange(TextFieldValue("Hillo world", selection = TextRange(2)))
+
+        assertEquals("Hillo world", state.toText())
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .any { it is RichTextSpanMark.Bold && it.range == 0..1 },
+        )
+    }
+
+    @Test
+    fun `typing over a selection after a clipboard read stays plain`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.selection = TextRange(0, 5)
+        state.pendingClipboardHtml = "<b>clipboard content</b>"
+        state.pendingClipboardPlainText = "clipboard content"
+
+        state.onTextFieldValueChange(TextFieldValue("X world", selection = TextRange(1)))
+
+        assertEquals("X world", state.toText())
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .none { it is RichTextSpanMark.Bold },
+        )
+    }
+
+    @Test
+    fun `deleting the selection after a clipboard read is not a paste`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.selection = TextRange(0, 6)
+        state.pendingClipboardHtml = "<b>Hi</b>"
+        state.pendingClipboardPlainText = "Hi"
+
+        state.onTextFieldValueChange(TextFieldValue("world", selection = TextRange(0)))
+
+        assertEquals("world", state.toText())
+        assertTrue(
+            state.toRichTextDocument().blocks.single().spans
+                .none { it is RichTextSpanMark.Bold },
+        )
+    }
+
+    @Test
+    fun `windows line endings in the stashed plain text still match`() {
+        val state = RichTextState()
+        state.setText("Hello world")
+        state.selection = TextRange(0, 11)
+        state.pendingClipboardHtml = "<p><b>a</b></p><p>b</p>"
+        state.pendingClipboardPlainText = "a\r\nb"
+
+        state.onTextFieldValueChange(TextFieldValue("a\nb", selection = TextRange(3)))
+
+        assertEquals("a\nb", state.toText())
+        val document = state.toRichTextDocument()
+        assertEquals(2, document.blocks.size)
+        assertTrue(document.blocks.first().spans.any { it is RichTextSpanMark.Bold })
+    }
+
+    @Test
+    fun `growth heuristic
```

**File**: `richeditor-compose/src/desktopMain/kotlin/com/mohamedrejeb/richeditor/clipboard/DesktopRichTextClipboardManager.kt` (modified, +6/-0)
```diff
@@ -51,6 +51,12 @@ internal class DesktopRichTextClipboardManager(
                         transferable.getTransferData(DataFlavor.fragmentHtmlFlavor)
                     } as String
                 richTextState.pendingClipboardHtml = rawHtmlText
+                if (transferable.isDataFlavorSupported(DataFlavor.stringFlavor)) {
+                    richTextState.pendingClipboardPlainText =
+                        withContext(Dispatchers.IO) {
+                            transferable.getTransferData(DataFlavor.stringFlavor)
+                        } as? String
+                }
             }
         } catch (e: Exception) {
             e.printStackTrace()
```

**File**: `richeditor-compose/src/iosMain/kotlin/com/mohamedrejeb/richeditor/clipboard/IosRichTextClipboardManager.kt` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@ internal class IosRichTextClipboardManager(
                     ?.toString()
                 if (html != null) {
                     richTextState.pendingClipboardHtml = html
+                    richTextState.pendingClipboardPlainText = pasteboard.string
                 }
             }
         } catch (e: Exception) {
```

---

### Incident Patch 5: `2c8a3636` (2026-08-19)
**Commit Message**: fix: write plain text from toText when rich clipboard is disabled

**File**: `richeditor-compose/src/androidMain/kotlin/com/mohamedrejeb/richeditor/clipboard/AndroidRichTextClipboardManager.kt` (modified, +9/-1)
```diff
@@ -55,7 +55,15 @@ internal class AndroidRichTextClipboardManager(
 
     override suspend fun setClipEntry(clipEntry: ClipEntry?) {
         if (!richTextState.config.richClipboardEnabled) {
-            clipboard.setClipEntry(clipEntry)
+            val copySelection = richTextState.copySelection
+            if (clipEntry == null || copySelection == null || copySelection.collapsed) {
+                clipboard.setClipEntry(clipEntry)
+                return
+            }
+            // The raw ClipEntry carries the editor's internal rendering (paragraphs joined
+            // by spaces, list prefixes included); a plain-text copy must use toText.
+            val text = richTextState.toText(copySelection)
+            clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("text", text)))
             return
         }
 
```

**File**: `richeditor-compose/src/desktopMain/kotlin/com/mohamedrejeb/richeditor/clipboard/DesktopRichTextClipboardManager.kt` (modified, +8/-1)
```diff
@@ -61,7 +61,14 @@ internal class DesktopRichTextClipboardManager(
 
     override suspend fun setClipEntry(clipEntry: ClipEntry?) {
         if (!richTextState.config.richClipboardEnabled) {
-            clipboard.setClipEntry(clipEntry)
+            val copySelection = richTextState.copySelection
+            if (clipEntry == null || copySelection == null || copySelection.collapsed) {
+                clipboard.setClipEntry(clipEntry)
+                return
+            }
+            // The raw ClipEntry carries the editor's internal rendering (paragraphs joined
+            // by spaces, list prefixes included); a plain-text copy must use toText.
+            awtClipboard?.setContents(StringSelection(richTextState.toText(copySelection)), null)
             return
         }
 
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/clipboard/DesktopRichTextClipboardManagerConfigTest.kt` (modified, +24/-4)
```diff
@@ -52,17 +52,37 @@ class DesktopRichTextClipboardManagerConfigTest {
     }
 
     @Test
-    fun `disabled rich clipboard delegates copy to the plain clipboard`() = runBlocking {
-        val state = stateWithSelection()
+    fun `disabled rich clipboard writes newline joined plain text without html`() = runBlocking {
+        val state = RichTextState()
+        state.setHtml("<p>Hello</p><p>World</p>")
+        state.selection = TextRange(0, state.annotatedString.text.length)
+        state.config.richClipboardEnabled = false
+        val clipboard = FakeClipboard()
+        val manager = createRichTextClipboardManager(state, clipboard)
+
+        manager.setClipEntry(ClipEntry(StringSelection("raw")))
+
+        val contents = clipboard.awt.getContents(null)
+        assertTrue(contents != null && !contents.isDataFlavorSupported(DataFlavor.fragmentHtmlFlavor))
+        assertEquals(
+            "Hello\nWorld",
+            contents.getTransferData(DataFlavor.stringFlavor) as String,
+        )
+        assertEquals(0, clipboard.delegateCalls)
+    }
+
+    @Test
+    fun `disabled rich clipboard without a selection delegates the raw entry`() = runBlocking {
+        val state = RichTextState()
+        state.setText("Hello")
         state.config.richClipboardEnabled = false
         val clipboard = FakeClipboard()
         val manager = createRichTextClipboardManager(state, clipboard)
 
-        val entry = ClipEntry(StringSelection("Hello"))
+        val entry = ClipEntry(StringSelection("raw"))
         manager.setClipEntry(entry)
 
         assertEquals(1, clipboard.delegateCalls)
         assertSame(entry, clipboard.delegatedEntry)
-        assertTrue(clipboard.awt.getContents(null) == null)
     }
 }
```

**File**: `richeditor-compose/src/iosMain/kotlin/com/mohamedrejeb/richeditor/clipboard/IosRichTextClipboardManager.kt` (modified, +8/-1)
```diff
@@ -61,7 +61,14 @@ internal class IosRichTextClipboardManager(
 
     override suspend fun setClipEntry(clipEntry: ClipEntry?) {
         if (!richTextState.config.richClipboardEnabled) {
-            clipboard.setClipEntry(clipEntry)
+            val copySelection = richTextState.copySelection
+            if (clipEntry == null || copySelection == null || copySelection.collapsed) {
+                clipboard.setClipEntry(clipEntry)
+                return
+            }
+            // The raw ClipEntry carries the editor's internal rendering (paragraphs joined
+            // by spaces, list prefixes included); a plain-text copy must use toText.
+            clipboard.nativeClipboard.string = richTextState.toText(copySelection)
             return
         }
 
```

**File**: `richeditor-compose/src/jsMain/kotlin/com/mohamedrejeb/richeditor/clipboard/JsRichTextClipboardManager.kt` (modified, +22/-1)
```diff
@@ -66,7 +66,19 @@ internal class JsRichTextClipboardManager(
 
     override suspend fun setClipEntry(clipEntry: ClipEntry?) {
         if (!richTextState.config.richClipboardEnabled) {
-            clipboard.setClipEntry(clipEntry)
+            val copySelection = richTextState.copySelection
+            if (clipEntry == null || copySelection == null || copySelection.collapsed) {
+                clipboard.setClipEntry(clipEntry)
+                return
+            }
+            // The raw ClipEntry carries the editor's internal rendering (paragraphs joined
+            // by spaces, list prefixes included); a plain-text copy must use toText.
+            try {
+                val item = createTextClipboardItem(richTextState.toText(copySelection))
+                clipboard.nativeClipboard.write(item).await<Nothing>()
+            } catch (e: Exception) {
+                clipboard.setClipEntry(clipEntry)
+            }
             return
         }
 
@@ -110,3 +122,12 @@ private fun createHtmlClipboardItem(html: String, text: String): Array<Clipboard
     })]
     """
 )
+
+@OptIn(ExperimentalComposeUiApi::class)
+private fun createTextClipboardItem(text: String): Array<ClipboardItem> = js(
+    """
+    [new ClipboardItem({
+        'text/plain': new Blob([text], { type: 'text/plain' })
+    })]
+    """
+)
```

---

### Incident Patch 6: `ca9e4ea4` (2026-08-16)
**Commit Message**: fix: raise mocha timeout for browser fuzz tests, split empty-range model test

**File**: `richeditor-compose-json/karma.config.d/mocha-timeout.js` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+// Raise the per-test timeout for browser test targets. The seeded fuzz suites
+// (RichTextEditCorruptionFuzzTest, RichTextHtmlRoundTripFuzzTest, Issue716StringIndexFuzzTest,
+// RichTextJsonRoundTripFuzzTest) run hundreds of scenarios inside a single test method and
+// exceed mocha's 2s default on slow CI runners, failing with a bare "Error" and no message.
+config.set({
+    client: {
+        mocha: {
+            timeout: 120000
+        }
+    }
+});
```

**File**: `richeditor-compose/karma.config.d/mocha-timeout.js` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+// Raise the per-test timeout for browser test targets. The seeded fuzz suites
+// (RichTextEditCorruptionFuzzTest, RichTextHtmlRoundTripFuzzTest, Issue716StringIndexFuzzTest,
+// RichTextJsonRoundTripFuzzTest) run hundreds of scenarios inside a single test method and
+// exceed mocha's 2s default on slow CI runners, failing with a bare "Error" and no message.
+config.set({
+    client: {
+        mocha: {
+            timeout: 120000
+        }
+    }
+});
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/document/RichTextDocumentModelTest.kt` (modified, +5/-0)
```diff
@@ -25,6 +25,11 @@ class RichTextDocumentModelTest {
         assertFailsWith<IllegalArgumentException> {
             RichTextBlock(text = "ab", spans = listOf(RichTextSpanMark.Bold(range = 0..2)))
         }
+    }
+
+    @Test
+    fun `block rejects empty mark range`() {
+        // 1..0 is an empty IntRange: a mark must cover at least one character.
         assertFailsWith<IllegalArgumentException> {
             RichTextBlock(text = "ab", spans = listOf(RichTextSpanMark.Bold(range = 1..0)))
         }
```

---

### Incident Patch 7: `7eb313c8` (2026-08-13)
**Commit Message**: fix: remove commas from test names for kotlin native

**File**: `richeditor-compose-json/src/commonTest/kotlin/com/mohamedrejeb/richeditor/json/JsonCodecReviewRegressionTest.kt` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ class JsonCodecReviewRegressionTest {
     }
 
     @Test
-    fun `negative list indent is malformed, not a raw exception`() {
+    fun `negative list indent is malformed and not a raw exception`() {
         val failure = assertFailsWith<MalformedRichTextJsonException> {
             RichTextDocumentCodec.decodeFromString(
                 """{"v":1,"blocks":[{"id":"b0","type":"list-item","ordered":true,"indent":-1,"text":"x","spans":[]}]}"""
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/ToggleStyleNestedSpanRemovalCrashTest.kt` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ import kotlin.test.assertTrue
 class ToggleStyleNestedSpanRemovalCrashTest {
 
     @Test
-    fun `seeded edit sequence with heading, code span, and style toggles does not crash`() {
+    fun `seeded edit sequence with heading and code span and style toggles does not crash`() {
         val random = Random(1_013L)
         val state = RichTextState()
         repeat(20) { applyOperation(state, random) }
```

---

### Incident Patch 8: `b8eeba83` (2026-08-13)
**Commit Message**: fix: guard nested previous-span removal in handleRemovingStyleFromRichSpan

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +9/-8)
```diff
@@ -3965,11 +3965,12 @@ public class RichTextState internal constructor(
                     index + 1,
                     toShiftRichSpanList
                 )
-            }
 
-            // Remove empty RichSpan.
-            if (previousRichSpan?.isEmpty() == true) {
-                richSpan.paragraph.children.removeAt(index)
+                // Remove empty RichSpan. Guarded by the index check: previousRichSpan may
+                // be nested rather than a direct child, in which case indexOf returns -1.
+                if (previousRichSpan?.isEmpty() == true) {
+                    richSpan.paragraph.children.removeAt(index)
+                }
             }
         } else {
             val index = parentRichSpan.children.indexOf(previousRichSpan)
@@ -3978,11 +3979,11 @@ public class RichTextState internal constructor(
                     index + 1,
                     toShiftRichSpanList
                 )
-            }
 
-            // Remove empty RichSpan.
-            if (previousRichSpan?.isEmpty() == true) {
-                parentRichSpan.children.removeAt(index)
+                // Remove empty RichSpan. Guarded by the index check, same as above.
+                if (previousRichSpan?.isEmpty() == true) {
+                    parentRichSpan.children.removeAt(index)
+                }
             }
         }
 
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/ToggleStyleNestedSpanRemovalCrashTest.kt` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.text.SpanStyle
+import androidx.compose.ui.text.TextRange
+import androidx.compose.ui.text.font.FontStyle
+import androidx.compose.ui.text.font.FontWeight
+import androidx.compose.ui.unit.sp
+import kotlin.random.Random
+import kotlin.test.Test
+import kotlin.test.assertTrue
+
+/**
+ * Regression pin for a crash in handleRemovingStyleFromRichSpan found by the JSON
+ * round-trip fuzzer: when a style toggle removes styling from a span whose previous
+ * sibling is not a direct child of the containing list, indexOf returns -1 and the
+ * unguarded removeAt(-1) threw IndexOutOfBoundsException.
+ *
+ * The crash needs a specific nesting shape (heading + background + code span + partial
+ * color toggle on a list item), reproduced here by replaying the exact seeded edit
+ * sequence that found it (seed 1013, ops: ul, ol, setText, h2, bg 4..9, code 3..9,
+ * color 2..5).
+ */
+class ToggleStyleNestedSpanRemovalCrashTest {
+
+    @Test
+    fun `seeded edit sequence with heading, code span, and style toggles does not crash`() {
+        val random = Random(1_013L)
+        val state = RichTextState()
+        repeat(20) { applyOperation(state, random) }
+        assertTrue(state.annotatedString.text.isNotEmpty())
+    }
+
+    private fun applyOperation(state: RichTextState, random: Random) {
+        val length = state.annotatedString.text.length
+        when (random.nextInt(12)) {
+            0 -> state.setText(state.annotatedString.text + " word${random.nextInt(100)}")
+            1 -> if (length > 1) {
+                state.selection = randomRange(random, length)
+                state.toggleSpanStyle(SpanStyle(fontWeight = FontWeight.Bold))
+            }
+            2 -> if (length > 1) {
+                state.selection = randomRange(random, length)
+                state.toggleSpanStyle(SpanStyle(fontStyle = FontStyle.Italic))
+            }
+            3 -> state.toggleOrderedList()
+            4 -> state.toggleUnorderedList()
+            5 -> if (length > 1) {
+                state.selection = randomRange(random, length)
+                state.addLinkToSelection("https://example.com/${random.nextInt(10)}")
+            }
+            6 -> if (length > 1) {
+                state.selection = randomRange(random, length)
+                state.toggleCodeSpan()
+            }
+            7 -> state.setHeadingStyle(HeadingStyle.fromLevel(random.nextInt(7)))
+            8 -> if (length > 1) {
+                state.selection = randomRange(random, length)
+                state.toggleSpanStyle(SpanStyle(fontSize = (12 + random.nextInt(3) * 8).sp))
+            }
+            9 -> if (length > 1) {
+                state.selection = randomRange(random, length)
+                state.toggleSpanStyle(SpanStyle(color = if (random.nextBoolean()) Color.Red else Color.Blue))
+            }
+            10 -> if (length > 1) {
+                state.selection = randomRange(random, length)
+                state.toggleSpanStyle(SpanStyle(background = Color.Yellow))
+            }
+            11 -> if (length > 1) {
+                state.selection = randomRange(random, length)
+                state.toggleSpanStyle(SpanStyle(letterSpacing = 2.sp))
+            }
+        }
+    }
+
+    private fun randomRange(random: Random, length: Int): TextRange {
+        val a = random.nextInt(length)
+        val b = random.nextInt(length)
+        return TextRange(minOf(a, b), maxOf(a, b) + 1)
+    }
+}
```

---

### Incident Patch 9: `00007926` (2026-08-13)
**Commit Message**: fix: harden JSON codec validation and unknown mark encoding

**File**: `richeditor-compose-json/src/commonMain/kotlin/com/mohamedrejeb/richeditor/json/internal/BlockJson.kt` (modified, +17/-14)
```diff
@@ -28,22 +28,25 @@ internal fun decodeBlock(json: JsonObject): RichTextBlock {
         decodeMark(markObject)
     } ?: emptyList()
 
-    val (type, headingLevel) = when (typeName) {
-        "paragraph" -> RichTextBlockType.Paragraph to 0
-        "heading" -> RichTextBlockType.Paragraph to json.requireBlockInt("level")
-        "list-item" -> {
-            val ordered = (json["ordered"] as? JsonPrimitive)?.booleanOrNull
-                ?: throw MalformedRichTextJsonException("list-item block is missing its \"ordered\" field")
-            RichTextBlockType.ListItem(
-                ordered = ordered,
-                indent = (json["indent"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0,
-                startNumber = if (ordered) (json["start"] as? JsonPrimitive)?.content?.toIntOrNull() else null,
-            ) to ((json["heading"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0)
+    // The model types validate their own invariants (indent bounds, heading range, mark
+    // bounds); everything constructed here stays inside the try so those violations
+    // surface as MalformedRichTextJsonException, never as raw IllegalArgumentException.
+    return try {
+        val (type, headingLevel) = when (typeName) {
+            "paragraph" -> RichTextBlockType.Paragraph to 0
+            "heading" -> RichTextBlockType.Paragraph to json.requireBlockInt("level")
+            "list-item" -> {
+                val ordered = (json["ordered"] as? JsonPrimitive)?.booleanOrNull
+                    ?: throw MalformedRichTextJsonException("list-item block is missing its \"ordered\" field")
+                RichTextBlockType.ListItem(
+                    ordered = ordered,
+                    indent = (json["indent"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0,
+                    startNumber = if (ordered) (json["start"] as? JsonPrimitive)?.content?.toIntOrNull() else null,
+                ) to ((json["heading"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0)
+            }
+            else -> throw MalformedRichTextJsonException("Unknown block type: $typeName")
         }
-        else -> throw MalformedRichTextJsonException("Unknown block type: $typeName")
-    }
 
-    return try {
         RichTextBlock(
             text = text,
             type = type,
```

**File**: `richeditor-compose-json/src/commonMain/kotlin/com/mohamedrejeb/richeditor/json/internal/JsonValueCodecs.kt` (modified, +14/-5)
```diff
@@ -13,19 +13,24 @@ import kotlinx.serialization.json.contentOrNull
 import kotlinx.serialization.json.put
 
 internal fun Long.toArgbHex(): String =
-    toString(16).uppercase().padStart(8, '0')
+    (this and 0xFFFFFFFFL).toString(16).uppercase().padStart(8, '0')
 
-internal fun String.parseArgbHex(): Long =
-    toLongOrNull(16) ?: throw MalformedRichTextJsonException("Invalid argb hex value: $this")
+internal fun String.parseArgbHex(): Long {
+    val isValid = length == 8 && all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }
+    if (!isValid) {
+        throw MalformedRichTextJsonException("argb must be exactly 8 hex digits, was \"$this\"")
+    }
+    return toLong(16)
+}
 
 internal fun TextUnit.toJsonObject(): JsonObject = buildJsonObject {
     put("value", value.toDouble())
     put("unit", if (type == TextUnitType.Em) "em" else "sp")
 }
 
 internal fun textUnitFromJson(json: JsonObject): TextUnit {
-    val value = (json["value"] as? JsonPrimitive)?.doubleOrNull
-        ?: throw MalformedRichTextJsonException("Missing \"value\" in unit object")
+    val value = (json["value"] as? JsonPrimitive)?.doubleOrNull?.takeIf { it.isFinite() }
+        ?: throw MalformedRichTextJsonException("Missing or non-finite \"value\" in unit object")
     val unit = (json["unit"] as? JsonPrimitive)?.contentOrNull
         ?: throw MalformedRichTextJsonException("Missing \"unit\" in unit object")
     val type = when (unit) {
@@ -60,12 +65,16 @@ internal fun TextDirection.toJsonName(): String? = when (this) {
     TextDirection.Ltr -> "ltr"
     TextDirection.Rtl -> "rtl"
     TextDirection.Content -> "content"
+    TextDirection.ContentOrLtr -> "content-or-ltr"
+    TextDirection.ContentOrRtl -> "content-or-rtl"
     else -> null
 }
 
 internal fun textDirectionFromJson(name: String): TextDirection = when (name) {
     "ltr" -> TextDirection.Ltr
     "rtl" -> TextDirection.Rtl
     "content" -> TextDirection.Content
+    "content-or-ltr" -> TextDirection.ContentOrLtr
+    "content-or-rtl" -> TextDirection.ContentOrRtl
     else -> throw MalformedRichTextJsonException("Unknown dir value: $name")
 }
```

**File**: `richeditor-compose-json/src/commonMain/kotlin/com/mohamedrejeb/richeditor/json/internal/SpanMarkJson.kt` (modified, +16/-6)
```diff
@@ -16,12 +16,14 @@ import kotlinx.serialization.json.put
 
 internal fun encodeMark(mark: RichTextSpanMark): JsonObject {
     if (mark is RichTextSpanMark.Unknown) {
-        // Re-emit the preserved payload verbatim, but keep k and r authoritative.
-        val raw = Json.parseToJsonElement(mark.rawJson).jsonObject
+        // Re-emit the preserved payload verbatim, but keep k and r authoritative. rawJson
+        // is a public, unvalidated field, so a payload that is not a JSON object degrades
+        // to a bare mark instead of crashing the encode.
+        val raw = runCatching { Json.parseToJsonElement(mark.rawJson).jsonObject }.getOrNull()
         return buildJsonObject {
             put("k", mark.kind)
             putRange(mark.range)
-            raw.forEach { (key, value) -> if (key != "k" && key != "r") put(key, value) }
+            raw?.forEach { (key, value) -> if (key != "k" && key != "r") put(key, value) }
         }
     }
     return buildJsonObject {
@@ -90,7 +92,13 @@ internal fun decodeMark(json: JsonObject): RichTextSpanMark {
         "color" -> RichTextSpanMark.TextColor(range, argb = json.requireString("argb", kind).parseArgbHex())
         "highlight" -> RichTextSpanMark.Highlight(range, argb = json.requireString("argb", kind).parseArgbHex())
         "font-size" -> RichTextSpanMark.FontSize(range, size = textUnitFromJson(json))
-        "font-weight" -> RichTextSpanMark.FontWeight(range, weight = json.requireInt("value", kind))
+        "font-weight" -> {
+            val weight = json.requireInt("value", kind)
+            if (weight !in 1..1000) {
+                throw MalformedRichTextJsonException("font-weight value must be in 1..1000, was $weight")
+            }
+            RichTextSpanMark.FontWeight(range, weight = weight)
+        }
         "letter-spacing" -> RichTextSpanMark.LetterSpacing(range, size = textUnitFromJson(json))
         "baseline-shift" -> RichTextSpanMark.BaselineShift(range, multiplier = json.requireFloat("value", kind))
         "shadow" -> RichTextSpanMark.Shadow(
@@ -146,8 +154,10 @@ private fun JsonObject.requireInt(key: String, kind: String): Int =
         ?: throw MalformedRichTextJsonException("Mark \"$kind\" is missing its \"$key\" field")
 
 private fun JsonObject.requireFloat(key: String, kind: String): Float =
-    (this[key] as? JsonPrimitive)?.content?.toFloatOrNull()
-        ?: throw MalformedRichTextJsonException("Mark \"$kind\" is missing its \"$key\" field")
+    (this[key] as? JsonPrimitive)?.content?.toFloatOrNull()?.takeIf { it.isFinite() }
+        ?: throw MalformedRichTextJsonException(
+            "Mark \"$kind\" is missing a finite \"$key\" field"
+        )
 
 internal fun RichTextSpanMark.kindName(): String = when (this) {
     is RichTextSpanMark.Bold -> "bold"
```

**File**: `richeditor-compose-json/src/commonTest/kotlin/com/mohamedrejeb/richeditor/json/JsonCodecReviewRegressionTest.kt` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+package com.mohamedrejeb.richeditor.json
+
+import androidx.compose.ui.text.style.TextDirection
+import com.mohamedrejeb.richeditor.document.RichTextBlock
+import com.mohamedrejeb.richeditor.document.RichTextBlockType
+import com.mohamedrejeb.richeditor.document.RichTextDocument
+import com.mohamedrejeb.richeditor.document.RichTextSpanMark
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFailsWith
+import kotlin.test.assertTrue
+
+/**
+ * Regression pins for the pre-merge code review of the JSON codec: every input the decoder
+ * accepts must re-encode without crashing, and every rejection must surface as
+ * [MalformedRichTextJsonException], never as a raw [IllegalArgumentException] subtype leak.
+ */
+class JsonCodecReviewRegressionTest {
+
+    private fun blockJson(spans: String): String =
+        """{"v":1,"blocks":[{"id":"b0","type":"paragraph","text":"ab","spans":[$spans]}]}"""
+
+    @Test
+    fun `non-finite float values are malformed`() {
+        assertFailsWith<MalformedRichTextJsonException> {
+            RichTextDocumentCodec.decodeFromString(blockJson("""{"k":"baseline-shift","r":[0,0],"value":"NaN"}"""))
+        }
+        assertFailsWith<MalformedRichTextJsonException> {
+            RichTextDocumentCodec.decodeFromString(
+                blockJson("""{"k":"font-size","r":[0,0],"value":"Infinity","unit":"sp"}""")
+            )
+        }
+        assertFailsWith<MalformedRichTextJsonException> {
+            RichTextDocumentCodec.decodeFromString(
+                blockJson("""{"k":"shadow","r":[0,0],"argb":"FF000000","x":"NaN","y":0,"blur":0}""")
+            )
+        }
+    }
+
+    @Test
+    fun `font weight outside 1 to 1000 is malformed`() {
+        assertFailsWith<MalformedRichTextJsonException> {
+            RichTextDocumentCodec.decodeFromString(blockJson("""{"k":"font-weight","r":[0,0],"value":5000}"""))
+        }
+        assertFailsWith<MalformedRichTextJsonException> {
+            RichTextDocumentCodec.decodeFromString(blockJson("""{"k":"font-weight","r":[0,0],"value":0}"""))
+        }
+    }
+
+    @Test
+    fun `negative list indent is malformed, not a raw exception`() {
+        val failure = assertFailsWith<MalformedRichTextJsonException> {
+            RichTextDocumentCodec.decodeFromString(
+                """{"v":1,"blocks":[{"id":"b0","type":"list-item","ordered":true,"indent":-1,"text":"x","spans":[]}]}"""
+            )
+        }
+        assertTrue(failure.message.orEmpty().contains("indent"))
+    }
+
+    @Test
+    fun `negative ordered start decodes successfully`() {
+        val doc = RichTextDocumentCodec.decodeFromString(
+            """{"v":1,"blocks":[{"id":"b0","type":"list-item","ordered":true,"indent":0,"start":-5,"text":"x","spans":[]}]}"""
+        )
+        assertEquals(
+            RichTextBlockType.ListItem(ordered = true, indent = 0, startNumber = -5),
+            doc.blocks.single().type,
+        )
+    }
+
+    @Test
+    fun `argb must be exactly 8 hex digits`() {
+        listOf("FF0000", "-FF00000", "1FFFFFFFF", "GG000000", "").forEach { bad ->
+            assertFailsWith<MalformedRichTextJsonException>("accepted argb \"$bad\"") {
+                RichTextDocumentCodec.decodeFromString(blockJson("""{"k":"color","r":[0,0],"argb":"$bad"}"""))
+            }
+        }
+    }
+
+    @Test
+    fun `encode masks argb to 32 bits`() {
+        val json = RichTextDocumentCodec.encodeToString(
+            RichTextDocument(
+                blocks = listOf(
+                    RichTextBlock(
+                        text = "x",
+                        spans = listOf(RichTextSpanMark.TextColor(range = 0..0, argb = -1L)),
+                    ),
+                ),
+            ),
+        )
+        assertTrue(json.contains("\"argb\":\"FFFFFFFF\""), json)
+        RichTextDocumentCodec.decodeFromString(json)
+    }
+
+    @Test
+    fun `unknown mark with invalid rawJson still encodes`() {
+     
```

---

### Incident Patch 10: `dab451b1` (2026-08-13)
**Commit Message**: fix: review findings in document model, encoder, decoder, and range extraction

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/document/RichTextBlockType.kt` (modified, +2/-2)
```diff
@@ -6,7 +6,8 @@ public sealed interface RichTextBlockType {
 
     /**
      * A list item. [indent] is the 0-based nesting depth. [startNumber] restarts ordered
-     * numbering at this item (only meaningful for ordered lists).
+     * numbering at this item (only meaningful for ordered lists). Negative values are
+     * allowed, matching the HTML `start` attribute.
      */
     public data class ListItem(
         public val ordered: Boolean,
@@ -16,7 +17,6 @@ public sealed interface RichTextBlockType {
         init {
             require(indent >= 0) { "indent must be >= 0, was $indent" }
             require(startNumber == null || ordered) { "startNumber requires an ordered list" }
-            require(startNumber == null || startNumber >= 0) { "startNumber must be >= 0" }
         }
     }
 }
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/document/RichTextDocumentDecoder.kt` (modified, +10/-3)
```diff
@@ -19,6 +19,7 @@ import com.mohamedrejeb.richeditor.paragraph.RichParagraph
 import com.mohamedrejeb.richeditor.paragraph.type.OrderedList
 import com.mohamedrejeb.richeditor.paragraph.type.UnorderedList
 import com.mohamedrejeb.richeditor.utils.InlineContentPlaceholder
+import com.mohamedrejeb.richeditor.utils.customMerge
 
 @OptIn(ExperimentalRichTextApi::class)
 internal object RichTextDocumentDecoder {
@@ -81,10 +82,16 @@ internal object RichTextDocumentDecoder {
             paragraph.children += RichSpan(paragraph = paragraph)
         }
 
-        // Applied after children exist so the heading visuals get baked into the spans,
-        // matching what parsers and toggleHeading produce.
+        // Bake heading visuals the way parsers do: heading defaults act as the base style
+        // and user marks win over them, so explicit overrides (font size, weight 400) are
+        // never clobbered on decode. Direct headingStyle assignment is the parser path.
         if (block.headingLevel > 0) {
-            paragraph.applyHeadingStyle(HeadingStyle.fromLevel(block.headingLevel))
+            val headingStyle = HeadingStyle.fromLevel(block.headingLevel)
+            paragraph.headingStyle = headingStyle
+            paragraph.children.forEach { span ->
+                span.spanStyle = headingStyle.defaultSpanStyle.customMerge(span.spanStyle)
+            }
+            paragraph.paragraphStyle = headingStyle.defaultParagraphStyle.merge(paragraph.paragraphStyle)
         }
         return paragraph
     }
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/document/RichTextDocumentEncoder.kt` (modified, +47/-18)
```diff
@@ -7,6 +7,7 @@ import androidx.compose.ui.text.SpanStyle
 import androidx.compose.ui.text.font.FontStyle
 import androidx.compose.ui.text.font.FontWeight
 import androidx.compose.ui.text.style.TextDecoration
+import androidx.compose.ui.unit.TextUnit
 import androidx.compose.ui.unit.isSpecified
 import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
 import com.mohamedrejeb.richeditor.model.HeadingStyle
@@ -24,12 +25,14 @@ internal const val InlineImagePlaceholder: Char = '￼'
 @OptIn(ExperimentalRichTextApi::class)
 internal object RichTextDocumentEncoder {
 
-    fun encode(state: RichTextState): RichTextDocument =
-        RichTextDocument(
+    fun encode(state: RichTextState): RichTextDocument {
+        val orderedCounters = mutableMapOf<Int, Int>()
+        return RichTextDocument(
             blocks = state.richParagraphList
-                .map { paragraph -> encodeParagraph(paragraph) }
+                .map { paragraph -> encodeParagraph(paragraph, orderedCounters) }
                 .ifEmpty { listOf(RichTextBlock(text = "")) },
         )
+    }
 
     private data class Leaf(
         val start: Int,
@@ -38,22 +41,39 @@ internal object RichTextDocumentEncoder {
         val richSpanStyle: RichSpanStyle,
     )
 
-    private fun encodeParagraph(paragraph: RichParagraph): RichTextBlock {
+    private fun encodeParagraph(
+        paragraph: RichParagraph,
+        orderedCounters: MutableMap<Int, Int>,
+    ): RichTextBlock {
         val text = StringBuilder()
         val leaves = mutableListOf<Leaf>()
         paragraph.children.forEach { collectLeaves(it, text, leaves) }
 
         val type = when (val paragraphType = paragraph.type) {
-            is OrderedList -> RichTextBlockType.ListItem(
-                ordered = true,
-                indent = paragraphType.level - 1,
-                startNumber = paragraphType.startFrom.takeIf { it != 1 },
-            )
-            is UnorderedList -> RichTextBlockType.ListItem(
-                ordered = false,
-                indent = paragraphType.level - 1,
-            )
-            else -> RichTextBlockType.Paragraph
+            is OrderedList -> {
+                // Emit startNumber whenever the visible number differs from what document
+                // order alone would derive, so restarted lists and partial range snapshots
+                // keep the numbers the user actually sees.
+                orderedCounters.keys.filter { it > paragraphType.level }.forEach(orderedCounters::remove)
+                val derivedNumber = (orderedCounters[paragraphType.level] ?: 0) + 1
+                orderedCounters[paragraphType.level] = paragraphType.number
+                RichTextBlockType.ListItem(
+                    ordered = true,
+                    indent = paragraphType.level - 1,
+                    startNumber = paragraphType.number.takeIf { it != derivedNumber },
+                )
+            }
+            is UnorderedList -> {
+                orderedCounters.keys.filter { it >= paragraphType.level }.forEach(orderedCounters::remove)
+                RichTextBlockType.ListItem(
+                    ordered = false,
+                    indent = paragraphType.level - 1,
+                )
+            }
+            else -> {
+                orderedCounters.clear()
+                RichTextBlockType.Paragraph
+            }
         }
 
         // Heading visuals are baked into the paragraph style by parsers and toggleHeading;
@@ -84,8 +104,10 @@ internal object RichTextDocumentEncoder {
     private fun collectLeaves(span: RichSpan, out: StringBuilder, leaves: MutableList<Leaf>) {
         val richStyle = span.richSpanStyle
         val text = when {
+            // Range extraction empties the text of out-of-range atomic spans but keeps the
+            // node; an image only occupies a slot while its own placeholder text survives.
             richStyle is RichSpanStyle.Image ->
-                if (richStyle.model is Stri
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +16/-2)
```diff
@@ -5488,7 +5488,10 @@ public class RichTextState internal constructor(
      * @param range The [TextRange] to extract.
      * @return A new [RichTextState] with only the content in the range.
      */
-    private fun extractRangeState(range: TextRange): RichTextState {
+    private fun extractRangeState(
+        range: TextRange,
+        preserveListNumbers: Boolean = false,
+    ): RichTextState {
         val textLength = annotatedString.text.length
         val rangeStart = range.min.coerceIn(0, textLength)
         val rangeEnd = range.max.coerceIn(0, textLength)
@@ -5526,6 +5529,15 @@ public class RichTextState internal constructor(
             // This paragraph has content within the range, copy and trim
             val newParagraph = paragraph.copy()
 
+            // Document snapshots pin the visible number as the copy's start value, since
+            // the extracted state renumbers first-at-level items from startFrom. Clipboard
+            // copies keep the default and deliberately restart at 1.
+            if (preserveListNumbers) {
+                (paragraph.type as? OrderedList)?.let { orderedList ->
+                    newParagraph.type = orderedList.copy(startFrom = orderedList.number)
+                }
+            }
+
             // Trim children spans to only include text within [rangeStart, rangeEnd)
             trimSpanList(newParagraph.children, rangeStart, rangeEnd)
             newParagraph.removeEmptyChildren()
@@ -5663,7 +5675,9 @@ public class RichTextState internal constructor(
      */
     public fun toRichTextDocument(range: TextRange): RichTextDocument {
         annotatedString
-        return RichTextDocumentEncoder.encode(extractRangeState(range))
+        return RichTextDocumentEncoder.encode(
+            extractRangeState(range, preserveListNumbers = true),
+        )
     }
 
     /**
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/paragraph/type/OrderedList.kt` (modified, +8/-0)
```diff
@@ -154,6 +154,14 @@ internal class OrderedList private constructor(
         )
 
     override fun copy(): ParagraphType =
+        copy(startFrom = startFrom)
+
+    /**
+     * Full-fidelity copy with a different [startFrom]. Used by range extraction to pin the
+     * item's visible [number] as the extract's starting number, so a snapshot beginning
+     * mid-list keeps the numbering the user sees.
+     */
+    fun copy(startFrom: Int): OrderedList =
         OrderedList(
             number = number,
             initialIndent = indent,
```

#### Recent Merged Pull Requests:
- **PR #812** (2026-09-30): fix: an IME rewrite keeps the style of the text it replaces (@MohamedRejeb)
- **PR #806** (2026-09-05): chore(deps): bump coil from 3.6.0 to 3.6.1 (@dependabot[bot])
- **PR #804** (2026-09-05): chore(deps): bump com.mohamedrejeb.richeditor:richeditor-compose from 1.0.0 to 1.2.0 (@dependabot[bot])
- **PR #801** (closed): chore(deps): bump com.mohamedrejeb.richeditor:richeditor-compose from 1.0.0 to 1.1.0 (@dependabot[bot])
- **PR #800** (closed): chore(deps): bump agp from 9.3.0 to 9.3.2 (@dependabot[bot])
- **PR #797** (2026-08-30): Prepare 1.2.0: fix json module build on AGP 9, bump version references (@MohamedRejeb)
- **PR #796** (2026-08-29): chore(deps): bump actions/setup-java from 5 to 6 (@dependabot[bot])
- **PR #795** (2026-08-29): chore(deps): bump org.jetbrains:markdown from 0.7.8 to 0.7.9 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
