# Verification Protocol: Verification Protocol: Empirical Defect Shield for mohamedrejeb-compose-rich-editor-learnings

<!-- PROVENANCE_START
{
  "source_repository": "mohamedrejeb-compose-rich-editor-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:41:55.940Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-mohamedrejeb-compose-rich-editor-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mohamedrejeb-compose-rich-editor-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:41:55.940Z`  
> **Learning ID**: `LEARN-REEXTRACT-mohamedrejeb-compose-rich-editor-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `mohamedrejeb-compose-rich-editor-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mohamedrejeb-compose-rich-editor-learnings.md`  
> **Source**: github ([https://github.com/MohamedRejeb/compose-rich-editor](https://github.com/MohamedRejeb/compose-rich-editor))  
> **Source Version**: `3254ff75`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T20:22:55.438Z  
> **Learning ID**: `learn-github-mohamedrejeb-compose-rich-editor`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): MohamedRejeb/compose-rich-editor

> **Canonical Artifact**: `07_PROJECT_LEARNING/mohamedrejeb-compose-rich-editor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MohamedRejeb/compose-rich-editor](https://github.com/MohamedRejeb/compose-rich-editor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T20:18:28.923Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MohamedRejeb/compose-rich-editor`
- **Description**: A Rich text editor library for both Jetpack Compose and Compose Multiplatform, fully customizable, supports HTML and Markdown.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1866 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `richeditor-compose-json/src/commonMain/kotlin/com/mohamedrejeb/richeditor/json/RichTextStateJson.kt`
```
package com.mohamedrejeb.richeditor.json

import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
import com.mohamedrejeb.richeditor.model.RichTextState

/**
 * Serializes the editor content to versioned rich text JSON (schema v1). Custom span styles
 * are carried when a matching descriptor on [RichTextState.spanStyleRegistry] opts into the
 * JSON format.
 */
@ExperimentalRichTextApi
public fun RichTextState.toJson(): String =
    RichTextDocumentCodec.encodeToString(toRichTextDocument(), spanStyleRegistry)

/**
 * Replaces the editor content from rich text JSON produced by [toJson]. Unknown mark kinds
 * survive document decoding but are not applied to the editor state.
 *
 * @throws MalformedRichTextJsonException on structurally invalid input
 * @throws UnsupportedRichTextJsonVersionException when the document is from a newer schema
 */
@ExperimentalRichTextApi
public fun RichTextState.setJson(json: String): RichTextState =
    setRichTextDocument(RichTextDocumentCodec.decodeFromString(json, spanStyleRegistry))

```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt`
```
package com.mohamedrejeb.richeditor.model

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.input.OutputTransformation
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isAltPressed
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.*
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.mohamedrejeb.richeditor.annotation.InternalRichTextApi
import androidx.compose.ui.util.fastCoerceAtLeast
import androidx.compose.ui.util.fastFirstOrNull
import androidx.compose.ui.util.fastForEach
import androidx.compose.ui.util.fastForEachIndexed
import androidx.compose.ui.util.fastForEachReversed
import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
import com.mohamedrejeb.richeditor.document.RichTextDocument
import com.mohamedrejeb.richeditor.document.RichTextDocumentDecoder
import com.mohamedrejeb.richeditor.document.RichTextDocumentEncoder
import com.mohamedrejeb.richeditor.model.history.CommitTrigger
import com.mohamedrejeb.richeditor.model.history.RichTextHistory
import com.mohamedrejeb.richeditor.model.history.RichTextHistoryHost
import com.mohamedrejeb.richeditor.model.history.RichTextSnapshot
import com.mohamedrejeb.richeditor.model.history.deepCopy
import com.mohamedrejeb.richeditor.model.trigger.Trigger
import com.mohamedrejeb.richeditor.model.trigger.TriggerQuery
import com.mohamedrejeb.richeditor.model.trigger.detectActiveTrigger
import com.mohamedrejeb.richeditor.paragraph.RichParagraph
import com.mohamedrejeb.richeditor.paragraph.type.*
import com.mohamedrejeb.richeditor.platform.currentPlatform
import com.mohamedrejeb.richeditor.paragraph.type.ParagraphType.Companion.startText
import com.mohamedrejeb.richeditor.parser.html.RichTextStateHtmlParser
import com.mohamedrejeb.richeditor.parser.markdown.RichTextStateMarkdownParser
import com.mohamedrejeb.richeditor.utils.*
import kotlin.math.absoluteValue
import kotlin.math.max
import kotlin.reflect.KClass
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

private val RichTextStateHistoryClockStart = kotlin.time.TimeSource.Monotonic.markNow()

// Window after a physical key press during which a caret step is treated as
// keyboard navigation rather than an IME batch edit (#779), and a selection change
// as the keyboard's rather than a gesture's.
private const val PhysicalKeyNavigationWindowMs = 300L

// Window after an IME edit during which a caret step over a paragraph separator
// is treated as the follow-up of a split suggestion-pick batch (#779).
private const val ImeEditFollowUpWindowMs = 300L

// Window after a pointer press during which a caret step over a paragraph separator is
// treated as the press's own caret placement rather than an IME batch edit (#779).
private const val PressCaretWindowMs = 300L

/**
 * Keeps a selection gesture live across Android's press Cancel at long-press start
 * and short mid-drag pauses.
 */
private val SelectionGestureGrace = 1.seconds

/**
 * A pointer position older than this must not clamp: handle drags never cross the
 * editor node and leave the observed position stale.
 */
private val SelectionGesturePointerFreshness = 500.milliseconds

@Composable
public fun rememberRichTextState(
    historyLimit: Int = 100,
    coalesceWindowMs: Long = 500L,
): RichTextState {
    return rememberSaveable(saver = RichTextState.Saver) {
        RichTextState(historyLimit = historyLimit, coalesceWindowMs = coalesceWindowMs)
    }
}

/**
 * Creates and remembers a [RichTextState] that starts with content.
 *
 * [initialContent] runs once on the new state, before the first composition uses it. Call
 * whichever setter matches the content: [RichTextState.setText], [RichTextState.setHtml],
 * [RichTextState.setMarkdown] or [RichTextState.setRichTextDocument].
 *
 * ```
 * val state = rememberRichTextState { setHtml(html) }
 * ```
 *
 * The block is an initializer, not a binding: it does not run again when the values it reads
 * change, and it does not run when the state is restored from saved instance state, where
 * the saved content wins. To replace the content later, call the setter on the state.
 *
 * What the block does is the starting point of the undo history, not a step in it.
 */
@ExperimentalRichTextApi
@Composable
public fun rememberRichTextState(
    historyLimit: Int = 100,
    coalesceWindowMs: Long = 500L,
    initialContent: RichTextState.() -> Unit,
): RichTextState {
    return rememberSaveable(saver = RichTextState.Saver) {
        RichTextState(historyLimit = historyLimit, coalesceWindowMs = coalesceWindowMs).apply {
            initialContent()
            history.onProgrammaticReplace()
        }
    }
}

@OptIn(ExperimentalRichTextApi::class)
public class RichTextState internal constructor(
    initialRichParagraphList: List<RichParagraph>,
    historyLimit: Int = 100,
    coalesceWindowMs: Long = 500L,
) {
    public constructor(
        historyLimit: Int = 100,
        coalesceWindowMs: Long = 500L,
    ) : this(listOf(RichParagraph()), historyLimit, coalesceWindowMs)

    /**
     * Undo/redo history for this editor. Snapshots the full rich-text tree
     * (paragraphs, spans, list prefixes, selection, staged styles) and overrides
     * `BasicTextField`'s native undo so rich content never desyncs from plain text.
     */
    public val history: RichTextHistory = RichTextHistory(
        host = HistoryHostImpl(),
        limit = historyLimit,
        coalesceWindowMs = coalesceWindowMs,
    )

    /**
     * When true, mutating entry points skip history capture. Used while restoring a
     * snapshot (so the restore itself is not recorded) and as a public opt-out for
     * internal replays.
     */
    private var suppressHistoryRecording: Boolean = false

    /**
     * Re-entrancy guard: prevents inner public-API calls from recording their own
     * history entries when they happen inside an outer public call that is already
     * recording.
     */
    private var historyRecordingDepth: Int = 0

    /**
     * When true, [onPreviewKeyEvent] does not intercept `Ctrl/Cmd+Z/Y`. Controlled
     * by `BasicRichTextEditor`'s `undoBehavior` parameter.
     */
    internal var suppressUndoShortcuts: Boolean = false

    internal val richParagraphList = mutableStateListOf<RichParagraph>()

    /**
     * Computed view over [textFieldState] and [annotatedString], not a separate stored
     * value. [pendingTextDuringSync] / [pendingSelectionDuringSync] take precedence so a
     * read taken mid-[setTextFieldStateFromValue] replay (while [skipTextFieldStateSync]
     * defers the real write) still sees the intended result. The text fallback reads
     * [annotatedString] rather than [textFieldState] directly: every text-changing
     * [setTextFieldStateFromValue] call is preceded by a tree rebuild that keeps it
     * unconditionally current, so it always stays in bounds for whatever selection
     * [pendingSelectionDuringSync] may still be holding once [pendingTextDuringSync]
     * itself has been cleared. Selection-only writes (no text change) don't rebuild the
     * tree, but don't need to: [annotatedString] is already current for them too.
     */
    internal val textFieldValue: TextFieldValue
        get() {
            val text = pendingTextDuringSync ?: annotatedString.text
            val selection = pendingSelectionDuringSync ?: textFieldState.selection
            return TextFieldValue(
                text = text,
                selection = selection,
                composition = textFieldState.composition,
            )
        }

    internal val textFieldState: TextFieldState =
        TextFieldState(initialText = "", initialSelection = TextRange.Zero)

    /**
     * Scroll position of the editor's internal text area. Hoisted so span overlays and
     * app code can observe and control the editor's own scrolling.
     */
    public val scrollState: ScrollState = ScrollState(initial = 0)

    /**
     * When true, [setTextFieldStateFromValue] skips the textFieldState.edit call. Set by the
     * editor's InputTransformation while it replays a user edit: the BTF2 buffer is already
     * canonical there and a nested edit would re-enter the transformation.
     * While suppressed, [pendingTextDuringSync] and [pendingSelectionDuringSync] record the
     * intended values so consecutive primitives inside one applyChange see each other's
     * results and the InputTransformation tail can reconcile the buffer.
     */
    internal var skipTextFieldStateSync: Boolean = false

    internal var pendingTextDuringSync: String? = null

    internal var pendingSelectionDuringSync: TextRange? = null

    /**
     * When true, the editor's InputTransformation returns early without calling
     * applyChangeList. Set around every programmatic textFieldState.edit so the write is not
     * re-interpreted as user input, which would corrupt richParagraphList by routing a
     * wholesale text swap through the pr
```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/RichTextStateParser.kt`
```
package com.mohamedrejeb.richeditor.parser

import com.mohamedrejeb.richeditor.model.RichTextState

internal interface RichTextStateParser<T> {

    fun encode(input: T): RichTextState

    fun decode(richTextState: RichTextState): T

}
```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/html/RichTextStateHtmlParser.kt`
```
package com.mohamedrejeb.richeditor.parser.html

import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.unit.sp
import com.mohamedrejeb.ksoup.entities.KsoupEntities
import com.mohamedrejeb.ksoup.html.parser.KsoupHtmlHandler
import com.mohamedrejeb.ksoup.html.parser.KsoupHtmlParser
import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
import com.mohamedrejeb.richeditor.model.*
import com.mohamedrejeb.richeditor.paragraph.RichParagraph
import com.mohamedrejeb.richeditor.paragraph.type.DefaultParagraph
import com.mohamedrejeb.richeditor.paragraph.type.ListStyleTypeKeywords
import com.mohamedrejeb.richeditor.paragraph.type.OrderedList
import com.mohamedrejeb.richeditor.paragraph.type.ParagraphType
import com.mohamedrejeb.richeditor.paragraph.type.UnorderedList
import com.mohamedrejeb.richeditor.parser.RichTextStateParser
import com.mohamedrejeb.richeditor.parser.utils.*
import com.mohamedrejeb.richeditor.utils.InlineContentPlaceholder
import com.mohamedrejeb.richeditor.utils.customMerge
import androidx.compose.ui.util.fastForEach
import androidx.compose.ui.util.fastForEachIndexed
import com.mohamedrejeb.richeditor.paragraph.type.ConfigurableListLevel
import com.mohamedrejeb.richeditor.utils.diff

internal object RichTextStateHtmlParser : RichTextStateParser<String> {

    @OptIn(ExperimentalRichTextApi::class)
    override fun encode(input: String): RichTextState =
        encode(input, RichSpanStyleRegistry())

    /**
     * Parses [input] resolving custom spans (`data-richeditor-kind`) through [registry],
     * which should be the target state's [RichTextState.spanStyleRegistry].
     */
    @OptIn(ExperimentalRichTextApi::class)
    fun encode(input: String, registry: RichSpanStyleRegistry): RichTextState {
        val openedTags = mutableListOf<Pair<String, Map<String, String>>>()
        val stringBuilder = StringBuilder()
        val richParagraphList = mutableListOf(RichParagraph())
        val lineBreakParagraphIndexSet = mutableSetOf<Int>()
        val toKeepEmptyParagraphIndexSet = mutableSetOf<Int>()
        // Blank-looking paragraphs that are real content (empty <li>, entity-encoded
        // whitespace) and must survive recycling and the blank-paragraph cleanup.
        val preservedBlankParagraphs = mutableSetOf<RichParagraph>()
        // Whether each currently open <p>/heading came from an explicit tag; implied
        // opens (Ksoup normalizing invalid nesting) must not preserve blank
        // paragraphs on close. See #779.
        val explicitParagraphOpens = mutableListOf<Boolean>()
        var currentRichSpan: RichSpan? = null
        var currentListLevel = 0
        // Tracks the next item number per list nesting level for ordered lists.
        // Key = list level (1-based), Value = next number to assign.
        val orderedListCounters = mutableMapOf<Int, Int>()
        // Tracks the explicit start value per list level (from <ol start="N">).
        // Only set when start != 1. Used to propagate startFrom to the first OrderedList item.
        val orderedListStartValues = mutableMapOf<Int, Int>()
        // The `list-style-type` keyword of the open list per level, from <ol>/<ul style>.
        val listStyleKeywords = mutableMapOf<Int, String>()

        val handler = KsoupHtmlHandler
            .Builder()
            .onText {
                // In html text inside ul/ol tags is skipped
                val lastOpenedTag = openedTags.lastOrNull()?.first
                if (lastOpenedTag == "ul" || lastOpenedTag == "ol") return@onText

                if (lastOpenedTag in skippedHtmlElements) return@onText

                val addedText = KsoupEntities.decodeHtml(
                    removeHtmlTextExtraSpaces(
                        input = it,
                        // Only trim leading ASCII whitespace if the buffer already ends in a
                        // collapsible whitespace run. Non-breaking spaces (U+00A0) are preserved
                        // and must not trigger a trim, otherwise an `&nbsp;` followed by a real
                        // space would lose the space (issue #388).
                        trimStart = stringBuilder.lastOrNull()?.let(::isCollapsibleHtmlWhitespace) ?: true,
                    )
                )

                if (addedText.isEmpty()) return@onText

                stringBuilder.append(addedText)

                val currentRichParagraph = richParagraphList.last()
                val safeCurrentRichSpan = currentRichSpan ?: RichSpan(paragraph = currentRichParagraph)

                if (safeCurrentRichSpan.children.isEmpty()) {
                    safeCurrentRichSpan.text += addedText
                } else {
                    val newRichSpan = RichSpan(paragraph = currentRichParagraph)
                    newRichSpan.text = addedText
                    newRichSpan.parent = safeCurrentRichSpan
                    safeCurrentRichSpan.children.add(newRichSpan)
                }

                if (currentRichSpan == null) {
                    currentRichSpan = safeCurrentRichSpan
                    currentRichParagraph.children.add(safeCurrentRichSpan)
                }

                // Entity-encoded whitespace is real content even when the paragraph
                // looks blank ("<p>&#32;</p>", "<p>&#x20;</p>").
                if (SpaceEntityRegex.containsMatchIn(it)) {
                    preservedBlankParagraphs.add(currentRichParagraph)
                }
            }
            .onOpenTag { name, attributes, isImplied ->
                val lastOpenedTag = openedTags.lastOrNull()?.first

                openedTags.add(name to attributes)

                // Pair paragraph-like opens with their closes so an explicitly empty
                // element can be told apart from Ksoup's browser-style normalization
                // of invalid nesting (implied opens/closes). See #779.
                if (name == "p" || name in HeadingStyle.headingTags)
                    explicitParagraphOpens.add(!isImplied)

                if (name in skippedHtmlElements) {
                    return@onOpenTag
                }

                if (name == "ul" || name == "ol") {
                    // An empty <li> hosting a nested list is visible content; don't let
                    // the first nested item recycle it.
                    richParagraphList.lastOrNull()?.let { paragraph ->
                        if (paragraph.isBlank() && paragraph.type is ConfigurableListLevel) {
                            preservedBlankParagraphs.add(paragraph)
                        }
                    }

                    currentListLevel += 1
                    if (name == "ol") {
                        val startAttr = attributes["start"]?.toIntOrNull() ?: 1
                        orderedListCounters[currentListLevel] = startAttr
                        if (startAttr != 1) {
                            orderedListStartValues[currentListLevel] = startAttr
                        }
                    }
                    attributes["style"]
                        ?.let { CssEncoder.parseCssStyle(it)[ListStyleTypeCssProperty] }
                        ?.let { listStyleKeywords[currentListLevel] = it }
                    return@onOpenTag
                }

                val cssStyleMap = attributes["style"]?.let { CssEncoder.parseCssStyle(it) } ?: emptyMap()
                val cssSpanStyle = CssEncoder.parseCssStyleMapToSpanStyle(cssStyleMap)
                val tagSpanStyle = htmlElementsSpanStyleEncodeMap[name]
                val tagParagraphStyle = htmlElementsParagraphStyleEncodeMap[name]

                val currentRichParagraph = richParagraphList.lastOrNull()
                val isCurrentRichParagraphBlank = currentRichParagraph?.isBlank() == true &&
                    currentRichParagraph !in preservedBlankParagraphs
                val isCurrentTagBlockElement = name in htmlBlockElements
                val isLastOpenedTagBlockElement = lastOpenedTag in htmlBlockElements

                // Handle <li value="N"> attribute - overrides the counter for this item
                if (name == "li" && lastOpenedTag == "ol") {
                    val valueAttr = attributes["value"]?.toIntOrNull()
                    if (valueAttr != null) {
                        orderedListCounters[currentListLevel] = valueAttr
                        orderedListStartValues[currentListLevel] = valueAttr
                    }
                }

                // Browsers and Google Docs put the list style on the <li> as well as on the list
                val listStyleKeyword = cssStyleMap[ListStyleTypeCssProperty] ?: listStyleKeywords[currentListLevel]

                // For <li> tags inside <ul> or <ol> tags - reuse blank current paragraph
                val isFirstLiInBlankParagraph =
                    lastOpenedTag != null &&
                    isCurrentTagBlockElement &&
                    isLastOpenedTagBlockElement &&
                    name == "li" &&
                    currentRichParagraph != null &&
                    currentRichParagraph.type is DefaultParagraph &&
                    isCurrentRichParagraphBlank

                if (isFirstLiInBlankParagraph) {
                    val paragraphType = encodeHtmlElementToRichParagraphType(lastOpenedTag!!, currentListLevel, orderedListCounters, orderedListStartValues, listStyleKeyword)
                    currentRichParagraph.type = paragraphType

                    val cssParagraphStyle = CssEncoder.parseCssStyleMapToParagraphStyle(cssStyleMap, attributes)
                    currentRichParagraph.paragraphStyle = currentRichParagraph.paragraphStyle.merge(cssParagraphStyle)
                }

                if (isCurrentTagBlockElement) {
                    val newRichParagraph =
                        if (isCurrentRichParagraphBlank)
                            currentRichParagraph
                        
```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/markdown/MarkdownUtils.kt`
```
package com.mohamedrejeb.richeditor.parser.markdown

import androidx.compose.ui.util.fastForEach
import org.intellij.markdown.MarkdownElementTypes
import org.intellij.markdown.MarkdownTokenTypes
import org.intellij.markdown.ast.ASTNode
import org.intellij.markdown.ast.findChildOfType
import org.intellij.markdown.ast.getTextInNode
import org.intellij.markdown.flavours.gfm.GFMElementTypes
import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
import org.intellij.markdown.flavours.gfm.GFMTokenTypes
import org.intellij.markdown.parser.MarkdownParser

internal fun encodeMarkdownToRichText(
    markdown: String,
    onOpenNode: (node: ASTNode) -> Unit,
    onCloseNode: (node: ASTNode) -> Unit,
    onText: (text: String) -> Unit,
    onHtmlTag: (tag: String) -> Unit,
    onHtmlBlock: (html: String) -> Unit,
) {

    val parser = MarkdownParser(GFMFlavourDescriptor())
    val tree = parser.buildMarkdownTreeFromString(markdown)
    tree.children.fastForEach { node ->
        encodeMarkdownNodeToRichText(
            node = node,
            markdown = markdown,
            onOpenNode = onOpenNode,
            onCloseNode = onCloseNode,
            onText = onText,
            onHtmlTag = onHtmlTag,
            onHtmlBlock = onHtmlBlock,
        )
    }
}

internal fun correctMarkdownText(text: String): String {
    var newText = StringBuilder()

    var pendingSpaces = 0

    var pendingTag = ""
    val lastOpenedTags = mutableListOf<String>()

    fun isCloseTag(tag: String = pendingTag) =
        tag == lastOpenedTags.lastOrNull()

    fun addPendingSpaces() {
        if (pendingSpaces > 0)
            newText.append(" ".repeat(pendingSpaces))

        pendingSpaces = 0
    }

    fun onTag(tag: String = pendingTag) {
        if (tag.isEmpty())
            return

        if (isCloseTag(tag)) {
            // On close tag

            lastOpenedTags.removeLastOrNull()
        } else {
            // On open tag

            addPendingSpaces()

            lastOpenedTags.add(tag)
        }

        newText.append(tag)

        if (tag == pendingTag)
            pendingTag = ""
    }

    fun onPendingTag() {
        while (pendingTag.isNotEmpty()) {
            val lastOpenedTag = lastOpenedTags.lastOrNull()

            if (
                lastOpenedTag == null ||
                pendingTag.first() != lastOpenedTag.first() ||
                pendingTag.length < lastOpenedTag.length
            ) {
                // Handle open tag

                val tag =
                    if (pendingTag.length >= 3)
                        pendingTag.substring(0, 3)
                    else
                        pendingTag

                val newPendingTag =
                    if (pendingTag.length >= 3)
                        pendingTag.substring(3)
                    else
                        ""

                onTag(tag)

                pendingTag = newPendingTag
            } else {
                // Handle close tag

                val tag = lastOpenedTag

                val newPendingTag =
                    pendingTag.substring(tag.length)

                onTag(tag)

                pendingTag = newPendingTag
            }
        }
    }

    fun onTextChar(char: Char) {
        onTag()

        if (pendingTag.isEmpty() || isCloseTag())
            addPendingSpaces()

        newText.append(char)
    }

    var isLineStart = false
    var isTwoSpaceIndent = false
    var isReachedFirstIndent = false
    var spaces = 0
    // Tracks whether any non-whitespace content has been emitted on the current
    // line. A `*` is a bullet-list marker (not an emphasis delimiter) when it
    // appears before any other content on its line and is followed by a space,
    // newline, or end-of-input. See #637.
    var hasLineContent = false

    text.forEachIndexed { i, char ->
        // Change indent from 2 spaces to 4 spaces
        if (char == '\n') {
            isLineStart = true
            hasLineContent = false
        } else if (isLineStart) {
            if (char == ' ') {
                spaces++
            } else if (!isReachedFirstIndent) {
                isLineStart = false
                if (spaces == 2) {
                    newText.append("  ")
                    isTwoSpaceIndent = true
                } else {
                    isTwoSpaceIndent = false
                }

                isReachedFirstIndent = spaces >= 2

                spaces = 0
            } else {
                isLineStart = false
                if (isTwoSpaceIndent && spaces >= 2) {
                    newText.append(" ".repeat(spaces))
                }

                spaces = 0
            }
        }

        // Extract edge spaces from tags
        if (char == '*' || char == '~') {
            val nextChar = text.getOrNull(i + 1)
            val isBulletMarker =
                char == '*' &&
                    !hasLineContent &&
                    pendingTag.isEmpty() &&
                    (nextChar == null || nextChar == ' ' || nextChar == '\n')

            if (isBulletMarker) {
                // Emit the star verbatim as a list-item marker without folding the
                // surrounding spaces into a paired emphasis delimiter.
                addPendingSpaces()
                newText.append(char)
                hasLineContent = true
            } else {
                if (!pendingTag.all { it == char })
                    onPendingTag()

                pendingTag += char

                if (pendingTag.length > 2)
                    onPendingTag()

                hasLineContent = true
            }
        } else if (char == ' ') {
            if (isCloseTag())
                onTag()

            pendingSpaces++
        } else {
            onTextChar(char)
            if (char != '\n') {
                hasLineContent = true
            }
        }
    }

    onTag()
    addPendingSpaces()

    return newText.toString()
}

private fun encodeMarkdownNodeToRichText(
    node: ASTNode,
    markdown: String,
    onOpenNode: (node: ASTNode) -> Unit,
    onCloseNode: (node: ASTNode) -> Unit,
    onText: (text: String) -> Unit,
    onHtmlTag: (tag: String) -> Unit,
    onHtmlBlock: (html: String) -> Unit,
) {
    when (node.type) {
        MarkdownTokenTypes.TEXT -> onText(node.getTextInNode(markdown).toString())
        MarkdownTokenTypes.WHITE_SPACE -> onText(" ")
        MarkdownTokenTypes.SINGLE_QUOTE -> onText("'")
        MarkdownTokenTypes.DOUBLE_QUOTE -> onText("\"")
        MarkdownTokenTypes.LPAREN -> onText("(")
        MarkdownTokenTypes.RPAREN -> onText(")")
        MarkdownTokenTypes.LBRACKET -> onText("[")
        MarkdownTokenTypes.RBRACKET -> onText("]")
        MarkdownTokenTypes.LT -> onText("<")
        MarkdownTokenTypes.GT -> onText(">")
        MarkdownTokenTypes.COLON -> onText(":")
        MarkdownTokenTypes.EXCLAMATION_MARK -> onText("!")
        MarkdownTokenTypes.EMPH -> onText("*")
        GFMTokenTypes.TILDE -> onText("~")
        MarkdownElementTypes.STRONG, GFMElementTypes.STRIKETHROUGH -> {
            onOpenNode(node)
            val children = node.children.toMutableList()
            children.removeFirstOrNull()
            children.removeFirstOrNull()
            children.removeLastOrNull()
            children.removeLastOrNull()
            children.fastForEach { child ->
                encodeMarkdownNodeToRichText(
                    node = child,
                    markdown = markdown,
                    onOpenNode = onOpenNode,
                    onCloseNode = onCloseNode,
                    onText = onText,
                    onHtmlTag = onHtmlTag,
                    onHtmlBlock = onHtmlBlock,
                )
            }
            onCloseNode(node)
        }

        MarkdownElementTypes.EMPH -> {
            onOpenNode(node)
            val children = node.children.toMutableList()
            children.removeFirstOrNull()
            children.removeLastOrNull()
            children.fastForEach { child ->
                encodeMarkdownNodeToRichText(
                    node = child,
                    markdown = markdown,
                    onOpenNode = onOpenNode,
                    onCloseNode = onCloseNode,
                    onText = onText,
                    onHtmlTag = onHtmlTag,
                    onHtmlBlock = onHtmlBlock,
                )
            }
            onCloseNode(node)
        }

        MarkdownElementTypes.CODE_SPAN -> {
            onOpenNode(node)
            onText(node.getTextInNode(markdown).removeSurrounding("`").toString())
            onCloseNode(node)
        }

        MarkdownElementTypes.INLINE_LINK -> {
            onOpenNode(node)
            val linkText = node.findChildOfType(MarkdownElementTypes.LINK_TEXT)
            if (node.parent?.type == MarkdownElementTypes.IMAGE) {
                // The label of an image is its alt text, taken as written.
                onText(linkText?.getTextInNode(markdown)?.drop(1)?.dropLast(1)?.toString() ?: "")
            } else {
                // The label of a link is inline content: an image, bold, code and so on.
                val children = linkText?.children.orEmpty().toMutableList()
                children.removeFirstOrNull()
                children.removeLastOrNull()
                children.fastForEach { child ->
                    encodeMarkdownNodeToRichText(
                        node = child,
                        markdown = markdown,
                        onOpenNode = onOpenNode,
                        onCloseNode = onCloseNode,
                        onText = onText,
                        onHtmlTag = onHtmlTag,
                        onHtmlBlock = onHtmlBlock,
                    )
                }
            }
            onCloseNode(node)
        }

        MarkdownTokenTypes.HTML_TAG -> {
            onHtmlTag(node.getTextInNode(markdown).toString())
        }

        MarkdownElementTypes.HTML_BLOCK -> {
            
```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/markdown/RichTextStateMarkdownParser.kt`
```
package com.mohamedrejeb.richeditor.parser.markdown

import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.fastForEach
import androidx.compose.ui.util.fastForEachIndexed
import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
import com.mohamedrejeb.richeditor.model.HeadingStyle
import com.mohamedrejeb.richeditor.model.RichSpan
import com.mohamedrejeb.richeditor.model.RichSpanStyle
import com.mohamedrejeb.richeditor.model.RichSpanStyleRegistry
import com.mohamedrejeb.richeditor.model.RichTextState
import com.mohamedrejeb.richeditor.paragraph.RichParagraph
import com.mohamedrejeb.richeditor.paragraph.type.ConfigurableListLevel
import com.mohamedrejeb.richeditor.paragraph.type.DefaultParagraph
import com.mohamedrejeb.richeditor.paragraph.type.OrderedList
import com.mohamedrejeb.richeditor.paragraph.type.ParagraphType
import com.mohamedrejeb.richeditor.paragraph.type.UnorderedList
import com.mohamedrejeb.richeditor.parser.RichTextStateParser
import com.mohamedrejeb.ksoup.entities.KsoupEntities
import com.mohamedrejeb.richeditor.parser.html.BrElement
import com.mohamedrejeb.richeditor.parser.html.CustomSpanAttrsAttr
import com.mohamedrejeb.richeditor.parser.html.CustomSpanKindAttr
import com.mohamedrejeb.richeditor.parser.html.RichTextStateHtmlParser
import com.mohamedrejeb.richeditor.parser.html.htmlElementsSpanStyleEncodeMap
import com.mohamedrejeb.richeditor.parser.utils.*
import com.mohamedrejeb.richeditor.utils.InlineContentPlaceholder
import org.intellij.markdown.MarkdownElementTypes
import org.intellij.markdown.MarkdownTokenTypes
import org.intellij.markdown.ast.ASTNode
import org.intellij.markdown.ast.findChildOfType
import org.intellij.markdown.ast.getTextInNode
import org.intellij.markdown.flavours.gfm.GFMElementTypes
import org.intellij.markdown.flavours.gfm.GFMTokenTypes

internal object RichTextStateMarkdownParser : RichTextStateParser<String> {

    @OptIn(ExperimentalRichTextApi::class)
    override fun encode(input: String): RichTextState =
        encode(input, RichSpanStyleRegistry())

    /**
     * Parses [input] resolving custom spans in inline HTML through [registry], which should
     * be the target state's [RichTextState.spanStyleRegistry].
     */
    @OptIn(ExperimentalRichTextApi::class)
    fun encode(input: String, registry: RichSpanStyleRegistry): RichTextState {
        val openedNodes = mutableListOf<ASTNode>()
        val openedHtmlTags = mutableListOf<String>()
        val richParagraphList = mutableListOf(RichParagraph())
        var brParagraphIndices = mutableListOf<Int>()
        var currentRichSpan: RichSpan? = null
        var currentRichParagraphType: ParagraphType = DefaultParagraph()
        var currentListLevel = 0

        fun onAddLineBreak() {
            val lastParagraph = richParagraphList.lastOrNull()
            val beforeLastParagraph = richParagraphList.getOrNull(richParagraphList.lastIndex - 1)
            val lastBrIndex = brParagraphIndices.lastOrNull()
            val beforeLastBrIndex = brParagraphIndices.getOrNull(brParagraphIndices.lastIndex - 1)

            // We need this for line break to work fine with EOL
            if (
                lastParagraph?.isEmpty() != true ||
                beforeLastParagraph?.isEmpty() != true ||
                lastBrIndex == richParagraphList.lastIndex ||
                beforeLastBrIndex == richParagraphList.lastIndex - 1
            )
                richParagraphList.add(RichParagraph())

            brParagraphIndices.add(richParagraphList.lastIndex)

            currentRichSpan = null
        }

        fun onText(text: String) {
            val text = text.replace('\n', ' ')

            if (text.isEmpty()) return

            if (richParagraphList.isEmpty())
                richParagraphList.add(RichParagraph())

            val currentRichParagraph = richParagraphList.last()
            val safeCurrentRichSpan = currentRichSpan ?: RichSpan(paragraph = currentRichParagraph)

            if (safeCurrentRichSpan.children.isEmpty()) {
                safeCurrentRichSpan.text += text
            } else {
                val newRichSpan = RichSpan(
                    paragraph = currentRichParagraph,
                    parent = safeCurrentRichSpan,
                )
                newRichSpan.text = text
                safeCurrentRichSpan.children.add(newRichSpan)
            }

            if (currentRichSpan == null) {
                currentRichSpan = safeCurrentRichSpan
                currentRichParagraph.children.add(safeCurrentRichSpan)
            }

            val currentRichSpanRichSpanStyle = currentRichSpan?.richSpanStyle
            val lastOpenedNode = openedNodes.lastOrNull()

            if (lastOpenedNode?.type == MarkdownElementTypes.IMAGE && text == "!") {
                currentRichSpan?.text = ""
            }

            if (currentRichSpanRichSpanStyle is RichSpanStyle.Image) {
                currentRichSpan?.richSpanStyle =
                    RichSpanStyle.Image(
                        model = currentRichSpanRichSpanStyle.model,
                        width = currentRichSpanRichSpanStyle.width,
                        height = currentRichSpanRichSpanStyle.height,
                        contentDescription = text
                    )

                // Image owns a single placeholder char in the raw text so span
                // textRanges line up with the rendered annotated string. See #466.
                currentRichSpan?.text = InlineContentPlaceholder
            }
        }

        // Correct the markdown text first so we can use it in callbacks
        val correctedMarkdown = correctMarkdownText(input)

        encodeMarkdownToRichText(
            markdown = correctedMarkdown,
            onText = { text ->
                onText(text)
            },
            onOpenNode = { node ->
                val lastOpenedNode = openedNodes.lastOrNull()

                openedNodes.add(node)

                if (node.type == MarkdownElementTypes.LIST_ITEM) {
                    currentListLevel++
                }

                val tagSpanStyle = markdownElementsSpanStyleEncodeMap[node.type]
                val tagParagraphStyle = markdownElementsParagraphStyleEncodeMap[node.type]

                if (node.type in markdownBlockElements) {
                    val currentRichParagraph = richParagraphList.last()

                    val isList =
                        lastOpenedNode?.type == MarkdownElementTypes.ORDERED_LIST ||
                                lastOpenedNode?.type == MarkdownElementTypes.UNORDERED_LIST

                    // Get paragraph type from markdown element
                    if (currentRichParagraphType is DefaultParagraph || isList) {
                        val paragraphType = encodeRichParagraphTypeFromMarkdownElement(lastOpenedNode ?: node)
                        currentRichParagraphType = paragraphType
                    }

                    // Set paragraph type if an element is a list item
                    if (node.type == MarkdownElementTypes.LIST_ITEM) {
                        currentRichParagraphType = currentRichParagraphType.getNextParagraphType()

                        if (currentRichParagraphType is ConfigurableListLevel) {
                            (currentRichParagraphType as ConfigurableListLevel).level = currentListLevel
                        }

                        // Interrupted lists parse as separate list nodes; seed the item
                        // with the literal source number so the author's numbering
                        // survives renumbering (#734).
                        val literalNumber = node.children
                            .firstOrNull { it.type == MarkdownTokenTypes.LIST_NUMBER }
                            ?.getTextInNode(correctedMarkdown)
                            ?.toString()
                            ?.takeWhile { char -> char.isDigit() }
                            ?.toIntOrNull()
                        if (literalNumber != null) {
                            currentRichParagraphType = OrderedList(
                                number = literalNumber,
                                initialLevel = currentListLevel,
                                startFrom = literalNumber,
                            )
                        }

                        currentRichParagraph.type = currentRichParagraphType
                    }

                    // Apply paragraph style (if applicable)
                    tagParagraphStyle?.let {
                        currentRichParagraph.paragraphStyle = currentRichParagraph.paragraphStyle.merge(it)
                    }
                    // Record heading level so encoding stays semantic instead of fingerprinting.
                    if (node.type in HeadingStyle.markdownHeadingNodes) {
                        currentRichParagraph.headingStyle = when (node.type) {
                            MarkdownElementTypes.ATX_1 -> HeadingStyle.H1
                            MarkdownElementTypes.ATX_2 -> HeadingStyle.H2
                            MarkdownElementTypes.ATX_3 -> HeadingStyle.H3
                            MarkdownElementTypes.ATX_4 -> HeadingStyle.H4
                            MarkdownElementTypes.ATX_5 -> HeadingStyle.H5
                            MarkdownElementTypes.ATX_6 -> HeadingStyle.H6
                            else -> HeadingStyle.Normal
                        }
                    }

                    val newRichSpan = RichSpan(paragraph = currentRichParagraph)
                    newRichSpan.spanStyle = tagSpanStyle ?: SpanStyle()

                    if (newRichSpan.spanStyle != SpanStyle()) {
                        currentRichSpan = newRichSpan
                        currentRichParagraph.children.add(newRichSpan)
                    } e
```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/utils/ElementsParagraphStyle.kt`
```
package com.mohamedrejeb.richeditor.parser.utils

import com.mohamedrejeb.richeditor.model.HeadingStyle

internal val H1ParagraphStyle = HeadingStyle.H1.getParagraphStyle()
internal val H2ParagraphStyle = HeadingStyle.H2.getParagraphStyle()
internal val H3ParagraphStyle = HeadingStyle.H3.getParagraphStyle()
internal val H4ParagraphStyle = HeadingStyle.H4.getParagraphStyle()
internal val H5ParagraphStyle = HeadingStyle.H5.getParagraphStyle()
internal val H6ParagraphStyle = HeadingStyle.H6.getParagraphStyle()

```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/utils/ElementsSpanStyle.kt`
```
package com.mohamedrejeb.richeditor.parser.utils

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.BaselineShift
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.em
import com.mohamedrejeb.richeditor.model.HeadingStyle

internal val MarkBackgroundColor = Color.Yellow
internal val SmallFontSize = 0.8f.em

internal val BoldSpanStyle = SpanStyle(fontWeight = FontWeight.Bold)
internal val ItalicSpanStyle = SpanStyle(fontStyle = FontStyle.Italic)
internal val UnderlineSpanStyle = SpanStyle(textDecoration = TextDecoration.Underline)
internal val StrikethroughSpanStyle = SpanStyle(textDecoration = TextDecoration.LineThrough)
internal val SubscriptSpanStyle = SpanStyle(baselineShift = BaselineShift.Subscript)
internal val SuperscriptSpanStyle = SpanStyle(baselineShift = BaselineShift.Superscript)
internal val MarkSpanStyle = SpanStyle(background = MarkBackgroundColor)
internal val SmallSpanStyle = SpanStyle(fontSize = SmallFontSize)
internal val H1SpanStyle = HeadingStyle.H1.getSpanStyle()
internal val H2SpanStyle = HeadingStyle.H2.getSpanStyle()
internal val H3SpanStyle = HeadingStyle.H3.getSpanStyle()
internal val H4SpanStyle = HeadingStyle.H4.getSpanStyle()
internal val H5SpanStyle = HeadingStyle.H5.getSpanStyle()
internal val H6SpanStyle = HeadingStyle.H6.getSpanStyle()

```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/utils/AnnotatedStringExt.kt`
```
package com.mohamedrejeb.richeditor.utils

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.util.fastForEach
import androidx.compose.ui.util.fastForEachIndexed
import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
import com.mohamedrejeb.richeditor.model.RichSpan
import com.mohamedrejeb.richeditor.model.RichSpanStyle
import com.mohamedrejeb.richeditor.model.RichTextState
import com.mohamedrejeb.richeditor.model.headingTextStyleFor
import kotlin.math.max
import kotlin.math.min

/**
 * Used in [RichTextState.updateAnnotatedString]
*/
internal fun AnnotatedString.Builder.append(
    state: RichTextState,
    richSpanList: MutableList<RichSpan>,
    startIndex: Int,
    text: String,
    selection: TextRange,
    onStyledRichSpan: (RichSpan) -> Unit,
): Int {
    return appendRichSpan(
        state = state,
        richSpanList = richSpanList,
        startIndex = startIndex,
        text = text,
        selection = selection,
        onStyledRichSpan = onStyledRichSpan,
    )
}

/**
 * Used in [RichTextState.updateAnnotatedString]
 */
@OptIn(ExperimentalRichTextApi::class)
internal fun AnnotatedString.Builder.appendRichSpan(
    state: RichTextState,
    parent: RichSpan? = null,
    richSpanList: MutableList<RichSpan>,
    startIndex: Int,
    text: String,
    selection: TextRange,
    onStyledRichSpan: (RichSpan) -> Unit,
): Int {
    var index = startIndex
    var previousRichSpan = parent
    val toRemoveRichSpanIndices = mutableListOf<Int>()

    richSpanList.fastForEachIndexed { i, richSpan ->
        index = append(
            state = state,
            richSpan = richSpan,
            startIndex = index,
            text = text,
            selection = selection,
            onStyledRichSpan = onStyledRichSpan,
        )

        if (
            previousRichSpan != null &&
            previousRichSpan.spanStyle == richSpan.spanStyle &&
            previousRichSpan.richSpanStyle == richSpan.richSpanStyle &&
            previousRichSpan.children.isEmpty() &&
            richSpan.children.isEmpty()
        ) {
            previousRichSpan.text += richSpan.text
            previousRichSpan.textRange = TextRange(previousRichSpan.textRange.min, richSpan.textRange.max)
            toRemoveRichSpanIndices.add(i)
        } else {
            previousRichSpan = richSpan
        }
    }

    toRemoveRichSpanIndices.reversed().forEach { i ->
        richSpanList.removeAt(i)
    }

    if (
        parent != null &&
        parent.text.isEmpty() &&
        richSpanList.size == 1 &&
        (parent.richSpanStyle is RichSpanStyle.Default || richSpanList.first().richSpanStyle is RichSpanStyle.Default)
    ) {
        val firstChild = richSpanList.first()

        val richSpanStyle =
            if (firstChild.richSpanStyle !is RichSpanStyle.Default)
                firstChild.richSpanStyle
            else
                parent.richSpanStyle

        parent.spanStyle = parent.spanStyle.customMerge(firstChild.spanStyle)
        parent.richSpanStyle = richSpanStyle
        parent.text = firstChild.text
        parent.textRange = firstChild.textRange
        parent.children.clear()
        parent.children.addAll(firstChild.children)
        // The collapsed child is detached; its descendants now belong to parent.
        // Paragraph splitting walks these back-pointers when moving siblings.
        parent.children.fastForEach { it.parent = parent }
    }

    return index
}


/**
 * Used in [RichTextState.updateAnnotatedString]
 */
@OptIn(ExperimentalRichTextApi::class)
internal fun AnnotatedString.Builder.append(
    state: RichTextState,
    richSpan: RichSpan,
    startIndex: Int,
    text: String,
    selection: TextRange,
    onStyledRichSpan: (RichSpan) -> Unit,
): Int {
    var index = startIndex

    withStyle(effectiveSpanStyle(state, richSpan)) {
        if (richSpan.richSpanStyle is RichSpanStyle.Image) {
            // Image owns a single placeholder char in the raw text;
            // appendCustomContent (via appendInlineContent) emits that
            // char plus the inline-content annotation. Skip the normal
            // append path so the placeholder isn't duplicated. See #466.
            richSpan.textRange = TextRange(index, index + richSpan.text.length)

            with(richSpan.richSpanStyle) {
                appendCustomContent(richTextState = state)
            }

            onStyledRichSpan(richSpan)

            index += richSpan.text.length
            return@withStyle
        }

        val newText = text.substring(index, index + richSpan.text.length)

        richSpan.text = newText
        richSpan.textRange = TextRange(index, index + richSpan.text.length)

        // Ignore setting the background color for the selected text to avoid the selection being hidden
        if (
            !selection.collapsed &&
            selection.min < index + richSpan.text.length &&
            selection.max > index
        ) {
            val beforeSelection =
                if (selection.min > index)
                    richSpan.text.substring(0, selection.min - index)
                else
                    ""

            val selectedText =
                richSpan.text.substring(
                    max(0, selection.min - index),
                    min(selection.max - index, richSpan.text.length)
                )

            val afterSelection =
                if (selection.max - index < richSpan.text.length)
                    richSpan.text.substring(selection.max - index)
                else
                    ""

            append(beforeSelection)
            withStyle(SpanStyle(background = Color.Transparent)) {
                append(selectedText)
            }
            append(afterSelection)
        } else {
            append(newText)
        }

        with(richSpan.richSpanStyle) {
            appendCustomContent(
                richTextState = state
            )
        }

        if (richSpan.richSpanStyle !is RichSpanStyle.Default) {
            onStyledRichSpan(richSpan)
        }

        index += richSpan.text.length

        index = appendRichSpan(
            state = state,
            parent = richSpan,
            richSpanList = richSpan.children,
            startIndex = index,
            text = text,
            selection = selection,
            onStyledRichSpan = onStyledRichSpan,
        )
    }
    return index
}

/**
 * Used in [RichTextState.updateRichParagraphList]
 */
internal fun AnnotatedString.Builder.append(
    state: RichTextState,
    richSpanList: List<RichSpan>,
    startIndex: Int,
    onStyledRichSpan: (RichSpan) -> Unit,
): Int {
    var index = startIndex
    richSpanList.fastForEach { richSpan ->
        index = append(
            state = state,
            richSpan = richSpan,
            startIndex = index,
            onStyledRichSpan = onStyledRichSpan,
        )
    }
    return index
}

/**
 * Used in [RichTextState.updateRichParagraphList]
 */
@OptIn(ExperimentalRichTextApi::class)
internal fun AnnotatedString.Builder.append(
    state: RichTextState,
    richSpan: RichSpan,
    startIndex: Int,
    onStyledRichSpan: (RichSpan) -> Unit,
): Int {
    var index = startIndex

    withStyle(effectiveSpanStyle(state, richSpan)) {
        richSpan.textRange = TextRange(index, index + richSpan.text.length)

        // Image owns a single placeholder char in the raw text;
        // appendCustomContent (via appendInlineContent) emits that
        // char plus the inline-content annotation. Skip append(text)
        // for images so the placeholder isn't duplicated. See #466.
        if (richSpan.richSpanStyle !is RichSpanStyle.Image) {
            append(richSpan.text)
        }

        with(richSpan.richSpanStyle) {
            appendCustomContent(
                richTextState = state,
            )
        }

        if (richSpan.richSpanStyle !is RichSpanStyle.Default) {
            onStyledRichSpan(richSpan)
        }

        index += richSpan.text.length
        richSpan.children.fastForEach { richSpan ->
            index = append(
                state = state,
                richSpan = richSpan,
                startIndex = index,
                onStyledRichSpan = onStyledRichSpan,
            )
        }
    }
    return index
}

/**
 * Resolve a span's render-time [SpanStyle], preferring the registered [Trigger]'s style
 * for [RichSpanStyle.Token] spans when the trigger is known. Falls back to the style
 * encoded on the [RichSpanStyle] itself (which, for Token, is a neutral default).
 */

/**
 * The style pushed for a span: its own style merged with its [RichSpanStyle]'s, with
 * the textDecoration combined with the inherited one. Builder nesting would let this
 * span's decoration replace the parent's, dropping underline or strikethrough when
 * the two are nested.
 */
@OptIn(ExperimentalRichTextApi::class)
private fun effectiveSpanStyle(state: RichTextState, richSpan: RichSpan): SpanStyle {
    // A restyled heading renders its typography from the config around the whole paragraph,
    // so the level's default kept on the span is dropped here, the same way the HTML
    // encoder drops it to tell the heading's own typography from styles added on top.
    val headingStyle = richSpan.paragraph.headingStyle
    val ownSpanStyle =
        if (state.config.headingTextStyleFor(headingStyle) == null)
            richSpan.spanStyle
        else
            richSpan.spanStyle.diff(headingStyle.defaultSpanStyle)
    val spanStyle = ownSpanStyle.merge(resolveRichSpanStyleStyle(state, richSpan.richSpanStyle))
    val inheritedDecoration = richSpan.parent?.fullSpanStyle?.textDecoration ?: return spanStyle
    val ownDecoration = spanStyle.textDecoration ?: return spanStyl
```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/utils/FloatUtils.kt`
```
package com.mohamedrejeb.richeditor.utils

import kotlin.math.pow
import kotlin.math.roundToInt

public fun Float.maxDecimals(decimals: Int): Float {
    val multiplier = 10.0.pow(decimals.toDouble()).toFloat()
    return (this * multiplier).roundToInt() / multiplier
}
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

- **Issue #715** (2026-10-04): **Web sample pasting in link dialog doesn't work and gets consumed by the editor**
  *Symptoms*: 

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

### Incident Patch 1: `3254ff75` (2026-11-11)
**Commit Message**: Merge pull request #860 from MohamedRejeb/fix/issue-857-exit-list-paragraph-below

fix: leaving a list with Enter no longer damages the paragraph below

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +14/-0)
```diff
@@ -4443,12 +4443,26 @@ public class RichTextState internal constructor(
                     richSpan.paragraph.isEmpty() &&
                     richSpan.paragraph.type is ConfigurableListLevel
                 ) {
+                    // No paragraph is added, so the newline leaves the text as well: left in, the
+                    // scan meets it again behind the dropped prefix and splits the paragraph below.
+                    tempTextFieldValue = tempTextFieldValue.copy(
+                        text = tempTextFieldValue.text.removeRange(index, index + 1),
+                        selection = TextRange(tempTextFieldValue.selection.min - 1),
+                    )
+
                     // Exit list by removing list formatting
                     tempTextFieldValue = updateParagraphType(
                         paragraph = richSpan.paragraph,
                         newType = DefaultParagraph(),
                         textFieldValue = tempTextFieldValue,
                     )
+
+                    // Numbered items below are a list of their own now
+                    tempTextFieldValue = adjustOrderedListsNumbers(
+                        startParagraphIndex = paragraphIndex + 1,
+                        startNumber = 1,
+                        textFieldValue = tempTextFieldValue,
+                    )
                     newParagraphFirstRichSpan.spanStyle = SpanStyle()
                     newParagraphFirstRichSpan.richSpanStyle = RichSpanStyle.Default
 
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/Issue857ExitListAboveParagraphTest.kt` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.foundation.text.input.TextFieldBuffer
+import androidx.compose.foundation.text.input.toTextFieldBuffer
+import androidx.compose.ui.text.TextRange
+import androidx.compose.ui.text.input.TextFieldValue
+import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
+import com.mohamedrejeb.richeditor.paragraph.type.DefaultParagraph
+import com.mohamedrejeb.richeditor.paragraph.type.OrderedList
+import com.mohamedrejeb.richeditor.paragraph.type.UnorderedList
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertIs
+
+/**
+ * Issue 857: Enter on an empty list item leaves the list. With a paragraph below the list, that
+ * paragraph lost its first character and an extra empty paragraph appeared.
+ *
+ * Cause: the exit turned the empty item into a plain paragraph and skipped the new paragraph, but
+ * left the typed newline in the pending text. Dropping the list prefix moved that newline back, so
+ * the paragraph scan met it a second time and split the paragraph below, removing its first
+ * character as if it were the newline. With the list at the end of the document nothing was there
+ * to split, which hid the bug.
+ *
+ * Fix: the exit removes the typed newline from the pending text and steps the caret back with it.
+ * Numbered items below the exit used to keep their old numbers; they restart at 1, the way they
+ * are exported.
+ */
+@OptIn(ExperimentalRichTextApi::class)
+class Issue857ExitListAboveParagraphTest {
+
+    private fun RichTextState.imeBatch(edit: TextFieldBuffer.() -> Unit) {
+        val buffer = textFieldState.toTextFieldBuffer()
+        buffer.edit()
+        applyChangeList(buffer)
+        reconcileBufferWithModel(buffer)
+        val text = buffer.asCharSequence().toString()
+        val selection = buffer.selection
+        pendingSelectionDuringSync = null
+        setTextFieldStateFromValue(text, selection)
+        handleSelectionChanged(textFieldState.selection, fromGestureObserver = true)
+    }
+
+    private fun RichTextState.type(text: String) {
+        val at = selection.min
+        imeBatch {
+            replace(at, at, text)
+            selection = TextRange(at + text.length)
+        }
+    }
+
+    /** Types through the [RichTextState.onTextFieldValueChange] bridge instead of a change list. */
+    private fun RichTextState.typeThroughBridge(text: String) {
+        val at = selection.min
+        val current = annotatedString.text
+        onTextFieldValueChange(
+            TextFieldValue(
+                text = current.substring(0, at) + text + current.substring(at),
+                selection = TextRange(at + text.length),
+            )
+        )
+    }
+
+    /** A list with one item and an empty second item holding the caret, above [below]. */
+    private fun listAbove(
+        below: String,
+        ordered: Boolean = false,
+        typing: RichTextState.(String) -> Unit = { type(it) },
+    ): RichTextState =
+        RichTextState().apply {
+            setHtml("<p></p>$below")
+            selection = TextRange(0)
+            if (ordered) toggleOrderedList() else toggleUnorderedList()
+            typing("Item")
+            typing("\n")
+        }
+
+    @Test
+    fun `leaving a bullet list keeps the paragraph below intact`() {
+        val state = listAbove("<p>Next line</p>")
+
+        state.type("\n")
+
+        assertEquals(3, state.richParagraphList.size)
+        assertIs<UnorderedList>(state.richParagraphList[0].type)
+        assertIs<DefaultParagraph>(state.richParagraphList[1].type)
+        assertEquals("• Item  Next line", state.annotatedString.text)
+        assertEquals(TextRange(7), state.selection)
+
+        state.type("Typed")
+
+        assertEquals(
+            "<ul><li>Item</li></ul><p>Typed</p><p>Next line</p>",
+            state.toHtml(),
+        )
+    }
+
+    @Test
+    fun `leaving a numbered list keeps the paragraph below intact`() {
+        val state = listAbove("<p>Next line</p>", ordered = true)
+
+        state.type("\n")
+
+        assertEquals(3, state.richParagraphList.size)
+        assertIs<OrderedList>(state.richParagraphList[0].type)
+        assertIs<DefaultParagraph>(state.richParagraphList[1].type)
+
+        state.type("Typed")
+
+        assertEquals(
+            "<ol><li>Item</li></ol><p>Typed</p><p>Next line</p>",
+            state.toHtml(),
+        )
+    }
+
+    @Test
+    fun `leaving a list keeps every paragraph below intact`() {
+        val state = listAbove("<p>First</p><p>Second</p>")
+
+        state.type("\n")
+        state.type("Typed")
+
+        assertEquals(
+            "<ul><li>Item</li></ul><p>Typed</p><p>First</p><p>Second</p>",
+            state.toHtml(),
+        )
+    }
+
+    @Test
+    fun `leaving a list above another list keeps that list intact`() {
+        val state = listAbove("<ol><li>One</li><li>Two</li></ol>")
+
+        state.type("\
```

---

### Incident Patch 2: `3e4ae7e4` (2026-11-11)
**Commit Message**: Merge pull request #853 from MohamedRejeb/fix/list-indent-first-frame

fix: list items keep their indent from the first frame of a read-only view

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextConfig.kt` (modified, +2/-0)
```diff
@@ -347,6 +347,8 @@ internal fun RichTextConfig.headingSpanStyleFor(headingStyle: HeadingStyle): Spa
 
 internal const val DefaultListIndent = 38
 
+internal const val StartTextWidthSentinel = "x"
+
 internal val DefaultUnorderedListStyleType =
     UnorderedListStyleType.from("•", "◦", "▪")
 
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +49/-1)
```diff
@@ -5553,7 +5553,11 @@ public class RichTextState internal constructor(
                     paragraphType is ConfigurableStartTextWidth &&
                     paragraphType.startText.isNotEmpty() &&
                     paragraphType.startRichSpan.textRange.min >= 0 &&
-                    paragraphType.startRichSpan.textRange.max <= offsetLimit
+                    paragraphType.startRichSpan.textRange.max <= offsetLimit &&
+                    // A prefix whose end wrapped to the next line has no width to read here,
+                    // and feeding the bogus distance back into the indent never settles.
+                    textLayoutResult.getLineForOffset(paragraphType.startRichSpan.textRange.min) ==
+                    textLayoutResult.getLineForOffset(paragraphType.startRichSpan.textRange.max)
                 ) {
                     val start =
                         textLayoutResult.getHorizontalPosition(
@@ -5605,6 +5609,50 @@ public class RichTextState internal constructor(
         }
     }
 
+    /**
+     * Measures the prefix of every list paragraph that has no width yet, so a state that has
+     * never been laid out renders its first frame with the final `TextIndent`. The layout pass
+     * in [adjustRichParagraphLayout] still has the last word on the width.
+     */
+    internal fun measureStartTextWidths(
+        textMeasurer: TextMeasurer,
+        style: TextStyle,
+        density: Density,
+    ) {
+        val widths = mutableMapOf<Pair<String, SpanStyle>, TextUnit>()
+        var isParagraphUpdated = false
+
+        richParagraphList.fastForEach { paragraph ->
+            val type = paragraph.type
+            if (type !is ConfigurableStartTextWidth || type.startText.isEmpty() || type.startTextWidth != 0.sp)
+                return@fastForEach
+
+            val markerStyle = paragraph.getListMarkerSpanStyle(
+                config.listMarkerStyleBehavior,
+                config.listMarkerStyle,
+                config.headingSpanStyleFor(paragraph.headingStyle),
+            )
+            type.startTextWidth = widths.getOrPut(type.startText to markerStyle) {
+                // The prefix ends with a space, which a line does not count when it is last:
+                // measure up to a character placed after it instead.
+                val layout = textMeasurer.measure(
+                    text = AnnotatedString(type.startText + StartTextWidthSentinel, markerStyle),
+                    style = style,
+                    softWrap = false,
+                )
+                with(density) {
+                    layout.getHorizontalPosition(type.startText.length, usePrimaryDirection = true)
+                        .absoluteValue
+                        .toSp()
+                }
+            }
+            isParagraphUpdated = true
+        }
+
+        if (isParagraphUpdated)
+            updateTextFieldValue(textFieldValue)
+    }
+
     /**
      * Test-only: simulates an `adjustRichParagraphLayout` pass having recorded a
      * measured prefix width for [startText]. Used to verify the cache → render
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/ui/BasicRichText.kt` (modified, +4/-0)
```diff
@@ -19,6 +19,7 @@ import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.platform.LocalUriHandler
 import androidx.compose.ui.text.TextLayoutResult
 import androidx.compose.ui.text.TextStyle
+import androidx.compose.ui.text.rememberTextMeasurer
 import androidx.compose.ui.text.style.TextOverflow
 import androidx.compose.ui.unit.TextUnit
 import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
@@ -63,6 +64,9 @@ public fun BasicRichText(
     }
     val maxImageWidthProvider = remember { RichTextMaxImageWidthProvider() }
 
+    // Before the first read of the annotated string, so the first frame has the final indent.
+    state.measureStartTextWidths(rememberTextMeasurer(), style, density)
+
     val text = remember(state.annotatedString, state.highlights) {
         state.annotatedString.withHighlights(state.highlights)
     }
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/StreamedListIndentStabilityTest.kt` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.width
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.TextRange
+import androidx.compose.ui.text.TextStyle
+import androidx.compose.ui.unit.dp
+import androidx.compose.ui.unit.sp
+import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
+import com.mohamedrejeb.richeditor.model.HeadingStyle
+import com.mohamedrejeb.richeditor.model.RichTextState
+import com.mohamedrejeb.richeditor.paragraph.type.ConfigurableStartTextWidth
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+/**
+ * A read-only view that shows streamed Markdown gets new content on every chunk, often in a
+ * state that has never been laid out. Its list items must sit at their final indent on the
+ * first frame: a frame at the unmeasured indent followed by a corrected one makes every item
+ * jump sideways on each chunk.
+ */
+@OptIn(ExperimentalTestApi::class, ExperimentalRichTextApi::class)
+class StreamedListIndentStabilityTest {
+
+    private val style = TextStyle(fontSize = 16.sp)
+
+    private val bulletChunks = listOf("- one", "- one\n- two", "- one\n- two\n- three and more")
+
+    private val numberedChunks = listOf(
+        "1. a",
+        (1..9).joinToString("\n") { "$it. item" },
+        (1..10).joinToString("\n") { "$it. item" },
+    )
+
+    /**
+     * Streams [chunks] into a view and returns, for every text layout, where the text of the
+     * first list item starts. [newStatePerChunk] rebuilds the state for each chunk instead of
+     * calling `setMarkdown` on the same one.
+     */
+    private fun firstItemTextStarts(
+        chunks: List<String>,
+        newStatePerChunk: Boolean,
+        prefixLength: Int,
+    ): List<Float> {
+        val starts = mutableListOf<Float>()
+        runDesktopComposeUiTest(width = 500, height = 600) {
+            var markdown by mutableStateOf(chunks.first())
+            val sharedState = RichTextState()
+            setContent {
+                val state =
+                    if (newStatePerChunk)
+                        remember(markdown) { RichTextState().apply { setMarkdown(markdown) } }
+                    else
+                        remember(markdown) { sharedState.apply { setMarkdown(markdown) } }
+                BasicRichText(
+                    state = state,
+                    style = style,
+                    modifier = Modifier.width(400.dp),
+                    onTextLayout = { starts += it.getHorizontalPosition(prefixLength, true) },
+                )
+            }
+            waitForIdle()
+            chunks.drop(1).forEach { chunk ->
+                markdown = chunk
+                waitForIdle()
+            }
+        }
+        return starts
+    }
+
+    private fun assertStable(starts: List<Float>) {
+        assertTrue(starts.isNotEmpty(), "Expected at least one text layout")
+        assertEquals(1, starts.distinct().size, "List item moved between layouts: $starts")
+    }
+
+    @Test
+    fun `bullet items keep their indent when every chunk builds a new state`() =
+        assertStable(firstItemTextStarts(bulletChunks, newStatePerChunk = true, prefixLength = 2))
+
+    @Test
+    fun `bullet items keep their indent when chunks are set on the same state`() =
+        assertStable(firstItemTextStarts(bulletChunks, newStatePerChunk = false, prefixLength = 2))
+
+    @Test
+    fun `numbered items keep their indent when every chunk builds a new state`() =
+        assertStable(firstItemTextStarts(numberedChunks, newStatePerChunk = true, prefixLength = 3))
+
+    @Test
+    fun `numbered items keep their indent when chunks are set on the same state`() =
+        assertStable(firstItemTextStarts(numberedChunks, newStatePerChunk = false, prefixLength = 3))
+
+    @Test
+    fun `a heading item restyled by the config keeps its indent`() {
+        val starts = mutableListOf<Float>()
+        runDesktopComposeUiTest(width = 500, height = 600) {
+            val state = RichTextState().apply {
+                config.headingTextStyles = mapOf(HeadingStyle.H1 to TextStyle(fontSize = 40.sp))
+                setMarkdown("- one")
+                selection = TextRange(annotatedString.text.length)
+                setHeadingStyle(HeadingStyle.H1)
+            }
+            setContent {
+                BasicRichText(
+                    state = state,
+                    style = style,
+                    modifier = Modifier.width(400.dp),
+                    onTextLayout = { starts += it.getHorizontalPosition(2, true) },
+                )

```

---

### Incident Patch 3: `ebab3ffe` (2026-11-11)
**Commit Message**: fix: a heading list item restyled by the config keeps its indent from the first frame

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +5/-2)
```diff
@@ -5627,8 +5627,11 @@ public class RichTextState internal constructor(
             if (type !is ConfigurableStartTextWidth || type.startText.isEmpty() || type.startTextWidth != 0.sp)
                 return@fastForEach
 
-            val markerStyle =
-                paragraph.getListMarkerSpanStyle(config.listMarkerStyleBehavior, config.listMarkerStyle)
+            val markerStyle = paragraph.getListMarkerSpanStyle(
+                config.listMarkerStyleBehavior,
+                config.listMarkerStyle,
+                config.headingSpanStyleFor(paragraph.headingStyle),
+            )
             type.startTextWidth = widths.getOrPut(type.startText to markerStyle) {
                 // The prefix ends with a space, which a line does not count when it is last:
                 // measure up to a character placed after it instead.
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/StreamedListIndentStabilityTest.kt` (modified, +27/-1)
```diff
@@ -9,9 +9,12 @@ import androidx.compose.runtime.setValue
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.test.ExperimentalTestApi
 import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.TextRange
 import androidx.compose.ui.text.TextStyle
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.sp
+import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
+import com.mohamedrejeb.richeditor.model.HeadingStyle
 import com.mohamedrejeb.richeditor.model.RichTextState
 import com.mohamedrejeb.richeditor.paragraph.type.ConfigurableStartTextWidth
 import kotlin.test.Test
@@ -24,7 +27,7 @@ import kotlin.test.assertTrue
  * first frame: a frame at the unmeasured indent followed by a corrected one makes every item
  * jump sideways on each chunk.
  */
-@OptIn(ExperimentalTestApi::class)
+@OptIn(ExperimentalTestApi::class, ExperimentalRichTextApi::class)
 class StreamedListIndentStabilityTest {
 
     private val style = TextStyle(fontSize = 16.sp)
@@ -94,6 +97,29 @@ class StreamedListIndentStabilityTest {
     fun `numbered items keep their indent when chunks are set on the same state`() =
         assertStable(firstItemTextStarts(numberedChunks, newStatePerChunk = false, prefixLength = 3))
 
+    @Test
+    fun `a heading item restyled by the config keeps its indent`() {
+        val starts = mutableListOf<Float>()
+        runDesktopComposeUiTest(width = 500, height = 600) {
+            val state = RichTextState().apply {
+                config.headingTextStyles = mapOf(HeadingStyle.H1 to TextStyle(fontSize = 40.sp))
+                setMarkdown("- one")
+                selection = TextRange(annotatedString.text.length)
+                setHeadingStyle(HeadingStyle.H1)
+            }
+            setContent {
+                BasicRichText(
+                    state = state,
+                    style = style,
+                    modifier = Modifier.width(400.dp),
+                    onTextLayout = { starts += it.getHorizontalPosition(2, true) },
+                )
+            }
+            waitForIdle()
+        }
+        assertStable(starts)
+    }
+
     private fun RichTextState.firstPrefixWidth() =
         (richParagraphList.first().type as ConfigurableStartTextWidth).startTextWidth
 
```

#### Recent Merged Pull Requests:
- **PR #860** (2026-11-11): fix: leaving a list with Enter no longer damages the paragraph below (@MohamedRejeb)
- **PR #854** (closed): feat: paragraph spacing in RichText through an experimental config property (@MohamedRejeb)
- **PR #853** (2026-11-11): fix: list items keep their indent from the first frame of a read-only view (@MohamedRejeb)
- **PR #849** (2026-11-11): chore(deps): bump kotlin from 2.4.10 to 2.4.20 (@dependabot[bot])
- **PR #845** (2026-10-06): feat: a list keeps its style type through HTML, the document model and JSON (@MohamedRejeb)
- **PR #844** (2026-10-06): feat: Markdown typing shortcuts for headings and inline formatting (@MohamedRejeb)

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

## X. Merge pull request #860 from MohamedRejeb/fix/issue-857-exit-list-paragraph-belo

**RULE**:
When implementing operations in `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MohamedRejeb/compose-rich-editor. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3254ff75`: Merge pull request #860 from MohamedRejeb/fix/issue-857-exit-list-paragraph-below. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
                    // No paragraph is added, so the newline leaves the text as well: left in, the
                    // scan meets it again behind the dropped prefix and splits the paragraph below.
                    tempTextFieldValue = tempTextFieldValue.copy(
                        text = tempTextFieldValue.text.removeRange(index, index + 1),
                        selection = TextRange(tempTextFieldValue.selection.min - 1),
                    )


                    // Numbered items below are a list of their own now
                    tempTextFieldValue = adjustOrderedListsNumbers(
                        startParagraphIndex = paragraphIndex + 1,
                        startNumber = 1,
                        textFieldValue = tempTextFieldValue,
                    )
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3254ff75` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
