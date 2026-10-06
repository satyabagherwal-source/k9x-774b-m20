# Forensic Learning Record (Deep Inspection): MohamedRejeb/compose-rich-editor

> **Canonical Artifact**: `07_PROJECT_LEARNING/mohamedrejeb-compose-rich-editor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MohamedRejeb/compose-rich-editor](https://github.com/MohamedRejeb/compose-rich-editor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:13:10.473Z  
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
                    val paragraphType = encodeHtmlElementToRichParagraphType(lastOpenedTag!!, currentListLevel, orderedListCounters, orderedListStartValues)
                    currentRichParagraph.type = paragraphType

                    val cssParagraphStyle = CssEncoder.parseCssStyleMapToParagraphStyle(cssStyleMap, attributes)
                    currentRichParagraph.paragraphStyle = currentRichParagraph.paragraphStyle.merge(cssParagraphStyle)
                }

                if (isCurrentTagBlockElement) {
                    val newRichParagraph =
                        if (isCurrentRichParagraphBlank)
                            currentRichParagraph
                        else
                            RichParagraph()

                    // A recycled paragraph stops being the spare added after the
                    // previous block close; forget its spare bookkeeping so an
                    // explicitly empty element closing on it can be detected (#779).
                    if (isCurrentRichParagraphBlank)
                        toKeepEmptyParagraphIndexSet.remove(richParagraphList.lastIndex)

                    // Only assign paragraph type if not already handled above
                    val paragraphType: ParagraphType =
                        if (isFirstLiInBlankParagraph)
                            cu
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
    val spanStyle = richSpan.spanStyle.merge(resolveRichSpanStyleStyle(state, richSpan.richSpanStyle))
    val inheritedDecoration = richSpan.parent?.fullSpanStyle?.textDecoration ?: return spanStyle
    val ownDecoration = spanStyle.textDecoration ?: return spanStyle
    if (inheritedDecoration == ownDecoration) return spanStyle
    return spanStyle.copy(
        textDecoration = TextDecoration.combine(listOf(inheritedDecoration, ownDecoration)),
    )
}

@OptIn(ExperimentalRichTextApi::class)
private fun resolveRichSpanStyleStyle(
    state: RichTextState,
    richSpanStyle: RichSpanStyle,
): SpanStyle {
    if (richSpanStyle is RichSpanStyle.Token) {
        val trigger = state.findTrigger(richSpanStyle.triggerId)
        if (trigger != null) return trigger.style(state.config)
    }
    return richSpanStyle.getSpanStyle(state.conf
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

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/utils/InlineContent.kt`
```
package com.mohamedrejeb.richeditor.utils

/**
 * Placeholder character used by Compose `appendInlineContent` (default
 * `alternateText`). An image span in the editor owns exactly one such
 * char in the underlying raw text so that span `textRange`s stay in
 * sync with the rendered `annotatedString` that inline content emits.
 *
 * See issue #466.
 */
internal const val InlineContentPlaceholder: String = "\uFFFD"

```

### Core Architecture Module: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/utils/ListExt.kt`
```
package com.mohamedrejeb.richeditor.utils

import kotlin.contracts.ExperimentalContracts
import kotlin.contracts.contract

@OptIn(ExperimentalContracts::class)
internal inline fun <R> fastMapRange(
    start: Int,
    end: Int,
    transform: (Int) -> R
): List<R> {
    contract { callsInPlace(transform) }
    val destination = ArrayList<R>(/* initialCapacity = */ end - start + 1)
    for (i in start..end) {
        destination.add(transform(i))
    }
    return destination
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
  > Thanks for reporting this issue, I'm checking it

- **Issue #715** (2026-10-04): **Web sample pasting in link dialog doesn't work and gets consumed by the editor**
  *Symptoms*: 

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

### Incident Patch 1: `294f5e94` (2026-10-05)
**Commit Message**: Merge pull request #832 from MohamedRejeb/fix/heading-on-line-break-block

fix: a heading set on one line of a <br> block only cuts the links it breaks

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +26/-7)
```diff
@@ -1499,20 +1499,21 @@ public class RichTextState internal constructor(
      * [HeadingStyle.Normal], any existing heading style is removed from those paragraphs;
      * otherwise the specified heading style replaces any previous one. Wrapped in
      * [recordHistory] so undo/redo restores heading changes alongside other formatting.
+     *
+     * The lines of an imported `<br>` block look like any other paragraphs in the editor, so
+     * the heading applies to the selected ones only. A line whose level now differs from its
+     * neighbour's leaves the block; lines that still share a level stay linked.
      */
     public fun setHeadingStyle(headingStyle: HeadingStyle) {
         if (headingStyle != HeadingStyle.Normal && RichTextFeature.Heading !in config.features) return
         recordHistory(CommitTrigger.Formatting) {
             val paragraphs = getRichParagraphListByTextRange(selection)
             if (paragraphs.isEmpty()) return@recordHistory
 
-            paragraphs.forEach { paragraph ->
-                if (paragraph.headingStyle == headingStyle) return@forEach
-                paragraph.applyHeadingStyle(headingStyle)
-                // A continuation has no heading of its own in html. Unlike addParagraphStyle,
-                // which severs unconditionally, a level that did not change severs nothing.
-                clearLineBreakContinuations(paragraph)
-            }
+            val changed = paragraphs.filter { it.headingStyle != headingStyle }
+            changed.forEach { it.applyHeadingStyle(headingStyle) }
+            // After every level is set, so two selected lines that end up alike stay linked.
+            changed.forEach { cutLineBreakLinksAcrossHeadingLevels(it) }
 
             updateAnnotatedString()
             updateCurrentSpanStyle()
@@ -5157,6 +5158,24 @@ public class RichTextState internal constructor(
         return richSpanList.getCommonStyle() ?: RichSpanStyle.DefaultSpanStyle
     }
 
+    /**
+     * A `<br>` continuation is written inside the tag of the line it continues, so the two
+     * must share a heading level. Cuts the links of [paragraph] to the line above and to the
+     * line below where the levels differ. Links further along the block are not its concern.
+     */
+    private fun cutLineBreakLinksAcrossHeadingLevels(paragraph: RichParagraph) {
+        val index = richParagraphList.indexOf(paragraph)
+        if (index < 0) return
+
+        val previous = richParagraphList.getOrNull(index - 1)
+        if (previous == null || previous.headingStyle != paragraph.headingStyle)
+            paragraph.isFromLineBreak = false
+
+        val next = richParagraphList.getOrNull(index + 1)
+        if (next != null && next.headingStyle != paragraph.headingStyle)
+            next.isFromLineBreak = false
+    }
+
     /**
      * Clears [RichParagraph.isFromLineBreak] on the given paragraph and all
      * consecutive trailing paragraphs that have `isFromLineBreak = true`.
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/ContinuationSeveringMatrixTest.kt` (modified, +5/-5)
```diff
@@ -91,17 +91,17 @@ class ContinuationSeveringMatrixTest {
     }
 
     @Test
-    fun `a heading on the head severs the whole chain`() {
-        // Same rule as addParagraphStyle on the head: the continuations were not touched by
-        // the user, so they must not silently become part of the heading.
+    fun `a heading on the head severs it and leaves the rest of the chain linked`() {
+        // The continuations were not touched by the user, so they do not become part of the
+        // heading. They still share a level with each other, so their own link stays.
         val state = continuationDocument()
         state.selection = TextRange(1)
 
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals(listOf(false, false, false), structure(state).continuations)
+        assertEquals(listOf(false, false, true), structure(state).continuations)
         assertEquals(listOf(HeadingStyle.H1, HeadingStyle.Normal, HeadingStyle.Normal), structure(state).headings)
-        assertEquals("<h1>a</h1><p>b</p><p>c</p>", state.toHtml())
+        assertEquals("<h1>a</h1><p>b<br>c</p>", state.toHtml())
         assertReloadAgrees(state)
     }
 
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/HeadingLineBreakBlockTest.kt` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.text.TextRange
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * Headings and `<br>` blocks.
+ *
+ * The lines of `<p>a<br>b<br>c</p>` are separate paragraphs in the model, linked as line break
+ * continuations of the first one. Such a block only comes from imported html; in the editor
+ * its lines look like any other paragraphs. So an imported heading covers every line of its
+ * block, while a heading set in the editor applies to the selected lines only: a line whose
+ * level now differs from its neighbour's leaves the block, and the other links stay.
+ *
+ * Setting a heading on the first line used to cut every link in the block, including the one
+ * between lines the change did not touch.
+ */
+class HeadingLineBreakBlockTest {
+
+    @Test
+    fun `an imported heading block has the heading on every line`() {
+        val state = stateOf("<h1>a<br>b<br>c</h1>")
+
+        assertEquals(List(3) { HeadingStyle.H1 }, state.richParagraphList.map { it.headingStyle })
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading on the first line leaves the other two linked`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = FIRST_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<h1>a</h1><p>b<br>c</p>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading on the middle line separates all three`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = SECOND_LINE
+        state.setHeadingStyle(HeadingStyle.H2)
+
+        assertEquals("<p>a</p><h2>b</h2><p>c</p>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading on the last line leaves the first two linked`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = THIRD_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<p>a<br>b</p><h1>c</h1>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading on two selected lines keeps those two linked`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = TextRange(0, 3)
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<h1>a<br>b</h1><p>c</p>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading on every line keeps the block whole`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = TextRange(0, 5)
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+    }
+
+    @Test
+    fun `removing the heading from one line of a heading block takes that line out`() {
+        val state = stateOf("<h1>a<br>b<br>c</h1>")
+
+        state.selection = THIRD_LINE
+        state.setHeadingStyle(HeadingStyle.Normal)
+
+        assertEquals("<h1>a<br>b</h1><p>c</p>", state.toHtml())
+    }
+
+    @Test
+    fun `only the selected line reports the heading`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+        state.selection = FIRST_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        val levels = listOf(FIRST_LINE, SECOND_LINE, THIRD_LINE).map { line ->
+            state.selection = line
+            state.currentHeadingStyle
+        }
+
+        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.Normal, HeadingStyle.Normal), levels)
+    }
+
+    @Test
+    fun `the blocks around it are left alone`() {
+        val state = stateOf("<p>x<br>y</p><p>a<br>b</p><p>after</p>")
+
+        // "x y a b after": the line "a" is at 4.
+        state.selection = TextRange(4, 5)
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<p>x<br>y</p><h1>a</h1><p>b</p><p>after</p>", state.toHtml())
+    }
+
+    @Test
+    fun `undo restores the block as it was`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+        state.selection = FIRST_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        state.history.undo()
+
+        assertEquals("<p>a<br>b<br>c</p>", state.toHtml())
+    }
+
+    @Test
+    fun `the result survives an html round trip`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+        state.selection = FIRST_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        val reloaded = stateOf(state.toHtml())
+
+        assertEquals("<h1>a</h1><p>b<br>c</p>", reloaded.toHtml())
+    }
+
+    private fun stateOf(html: String): RichTextState = RichTextState().apply { setHtml(html) }
+
+    private companion object {
+        // "a b c": one character per line, one separator between lines.
+        val FIRST_LINE = TextRange(0, 1)
+        val SECOND_LINE = TextRange(2, 3)
+        val THIRD_LINE = TextRange(4, 5)
+    }
+}
```

---

### Incident Patch 2: `f63ec23e` (2026-10-05)
**Commit Message**: fix: a heading applies to the selected lines only and cuts only the <br> links it breaks

**File**: `docs/headings.md` (modified, +0/-4)
```diff
@@ -21,10 +21,6 @@ richTextState.setHeadingStyle(HeadingStyle.Normal)
 selection**. Wrap the call in `recordHistory` automatically so undo/redo
 restores heading changes alongside other formatting.
 
-Lines separated by a `<br>` inside one block, such as `<p>a<br>b</p>`, share that block's
-tag. A heading set on any of those lines applies to the whole block, and the result is
-`<h2>a<br>b</h2>`.
-
 ### Reading the current level
 
 ```kotlin
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +21/-20)
```diff
@@ -1500,18 +1500,20 @@ public class RichTextState internal constructor(
      * otherwise the specified heading style replaces any previous one. Wrapped in
      * [recordHistory] so undo/redo restores heading changes alongside other formatting.
      *
-     * The lines of a `<br>` block share one tag in html, so a heading set on one of them
-     * applies to the whole block.
+     * The lines of an imported `<br>` block look like any other paragraphs in the editor, so
+     * the heading applies to the selected ones only. A line whose level now differs from its
+     * neighbour's leaves the block; lines that still share a level stay linked.
      */
     public fun setHeadingStyle(headingStyle: HeadingStyle) {
         if (headingStyle != HeadingStyle.Normal && RichTextFeature.Heading !in config.features) return
         recordHistory(CommitTrigger.Formatting) {
-            val paragraphs = withLineBreakBlocks(getRichParagraphListByTextRange(selection))
+            val paragraphs = getRichParagraphListByTextRange(selection)
             if (paragraphs.isEmpty()) return@recordHistory
 
-            paragraphs.forEach { paragraph ->
-                if (paragraph.headingStyle != headingStyle) paragraph.applyHeadingStyle(headingStyle)
-            }
+            val changed = paragraphs.filter { it.headingStyle != headingStyle }
+            changed.forEach { it.applyHeadingStyle(headingStyle) }
+            // After every level is set, so two selected lines that end up alike stay linked.
+            changed.forEach { cutLineBreakLinksAcrossHeadingLevels(it) }
 
             updateAnnotatedString()
             updateCurrentSpanStyle()
@@ -5157,22 +5159,21 @@ public class RichTextState internal constructor(
     }
 
     /**
-     * [paragraphs] widened to the `<br>` blocks they belong to: the paragraph that opens each
-     * block and every line break continuation that follows it, in document order.
+     * A `<br>` continuation is written inside the tag of the line it continues, so the two
+     * must share a heading level. Cuts the links of [paragraph] to the line above and to the
+     * line below where the levels differ. Links further along the block are not its concern.
      */
-    private fun withLineBreakBlocks(paragraphs: List<RichParagraph>): List<RichParagraph> {
-        val indices = mutableSetOf<Int>()
-        paragraphs.forEach { paragraph ->
-            val index = richParagraphList.indexOf(paragraph)
-            if (index < 0) return@forEach
+    private fun cutLineBreakLinksAcrossHeadingLevels(paragraph: RichParagraph) {
+        val index = richParagraphList.indexOf(paragraph)
+        if (index < 0) return
 
-            var first = index
-            while (first > 0 && richParagraphList[first].isFromLineBreak) first--
-            var last = index
-            while (last < richParagraphList.lastIndex && richParagraphList[last + 1].isFromLineBreak) last++
-            indices.addAll(first..last)
-        }
-        return indices.sorted().map { richParagraphList[it] }
+        val previous = richParagraphList.getOrNull(index - 1)
+        if (previous == null || previous.headingStyle != paragraph.headingStyle)
+            paragraph.isFromLineBreak = false
+
+        val next = richParagraphList.getOrNull(index + 1)
+        if (next != null && next.headingStyle != paragraph.headingStyle)
+            next.isFromLineBreak = false
     }
 
     /**
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/ContinuationSeveringMatrixTest.kt` (modified, +19/-19)
```diff
@@ -14,13 +14,11 @@ import kotlin.test.Test
 import kotlin.test.assertEquals
 
 /**
- * A paragraph-level mutator applied to a `<br>` continuation must leave a document the html
- * encoder can write. The encoder can only write a continuation inside the tag of the paragraph
- * it continues, so a continuation that became a list item or a centered paragraph has no
- * faithful `<br>` form: its type or alignment would be dropped on save, or smeared over the
- * paragraph it continues. Those mutators sever it, and the chain behind it, into independent
- * paragraphs. A heading is the exception: it is the block's own tag, so it applies to every
- * line of the block and the block stays whole (see [HeadingLineBreakBlockTest]).
+ * Every paragraph-level mutator applied to a `<br>` continuation must sever it, and the chain
+ * behind it, into independent paragraphs. The html encoder can only write a continuation inside
+ * the tag of the paragraph it continues, so a continuation that became a heading, a list item or
+ * a centered paragraph has no faithful `<br>` form: its level, type or alignment would be dropped
+ * on save, or smeared over the paragraph it continues.
  *
  * The document is `<p>a<br>b<br>c</p>` with the caret in `b`. Each row asserts the triple: the
  * model (the continuation flags of all three paragraphs plus the mutated property), the exact
@@ -67,41 +65,43 @@ class ContinuationSeveringMatrixTest {
     // setHeadingStyle
 
     @Test
-    fun `a heading on a middle continuation applies to the block and keeps it whole`() {
+    fun `a heading on a middle continuation severs it and its chain`() {
         val state = continuationDocument()
         state.selection = TextRange(3)
 
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals(listOf(false, true, true), structure(state).continuations)
-        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.H1, HeadingStyle.H1), structure(state).headings)
-        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+        assertEquals(listOf(false, false, false), structure(state).continuations)
+        assertEquals(listOf(HeadingStyle.Normal, HeadingStyle.H1, HeadingStyle.Normal), structure(state).headings)
+        assertEquals("<p>a</p><h1>b</h1><p>c</p>", state.toHtml())
         assertReloadAgrees(state)
     }
 
     @Test
-    fun `a heading on the last continuation applies to the block and keeps it whole`() {
+    fun `a heading on the last continuation severs it`() {
         val state = continuationDocument("<p>a<br>b</p>")
         state.selection = TextRange(3)
 
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals(listOf(false, true), structure(state).continuations)
-        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.H1), structure(state).headings)
-        assertEquals("<h1>a<br>b</h1>", state.toHtml())
+        assertEquals(listOf(false, false), structure(state).continuations)
+        assertEquals(listOf(HeadingStyle.Normal, HeadingStyle.H1), structure(state).headings)
+        assertEquals("<p>a</p><h1>b</h1>", state.toHtml())
         assertReloadAgrees(state)
     }
 
     @Test
-    fun `a heading on the head applies to its continuations and keeps the block whole`() {
+    fun `a heading on the head severs it and leaves the rest of the chain linked`() {
+        // The continuations were not touched by the user, so they do not become part of the
+        // heading. They still share a level with each other, so their own link stays.
         val state = continuationDocument()
         state.selection = TextRange(1)
 
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals(listOf(false, true, true), structure(state).continuations)
-        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.H1, HeadingStyle.H1), structure(state).headings)
-        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+        assertEquals(listOf(false, false, true), structure(state).continuations)
+        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.Normal, HeadingStyle.Normal), structure(state).headings)
+        assertEquals("<h1>a</h1><p>b<br>c</p>", state.toHtml())
         assertReloadAgrees(state)
     }
 
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/HeadingLineBreakBlockTest.kt` (modified, +50/-46)
```diff
@@ -5,112 +5,116 @@ import kotlin.test.Test
 import kotlin.test.assertEquals
 
 /**
- * A heading set on one line of a `<br>` block applies to the whole block.
+ * Headings and `<br>` blocks.
  *
  * The lines of `<p>a<br>b<br>c</p>` are separate paragraphs in the model, linked as line break
- * continuations of the first one. In html a block has one tag, so a heading belongs to all of
- * its lines: setting it on a single line used to cut the block into separate paragraphs.
+ * continuations of the first one. Such a block only comes from imported html; in the editor
+ * its lines look like any other paragraphs. So an imported heading covers every line of its
+ * block, while a heading set in the editor applies to the selected lines only: a line whose
+ * level now differs from its neighbour's leaves the block, and the other links stay.
+ *
+ * Setting a heading on the first line used to cut every link in the block, including the one
+ * between lines the change did not touch.
  */
 class HeadingLineBreakBlockTest {
 
     @Test
-    fun `a heading set on the first line applies to every line of the block`() {
+    fun `an imported heading block has the heading on every line`() {
+        val state = stateOf("<h1>a<br>b<br>c</h1>")
+
+        assertEquals(List(3) { HeadingStyle.H1 }, state.richParagraphList.map { it.headingStyle })
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading on the first line leaves the other two linked`() {
         val state = stateOf("<p>a<br>b<br>c</p>")
 
         state.selection = FIRST_LINE
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+        assertEquals("<h1>a</h1><p>b<br>c</p>", state.toHtml())
     }
 
     @Test
-    fun `a heading set on a middle line applies to every line of the block`() {
+    fun `a heading on the middle line separates all three`() {
         val state = stateOf("<p>a<br>b<br>c</p>")
 
         state.selection = SECOND_LINE
         state.setHeadingStyle(HeadingStyle.H2)
 
-        assertEquals("<h2>a<br>b<br>c</h2>", state.toHtml())
+        assertEquals("<p>a</p><h2>b</h2><p>c</p>", state.toHtml())
     }
 
     @Test
-    fun `a heading set on the last line applies to every line of the block`() {
+    fun `a heading on the last line leaves the first two linked`() {
         val state = stateOf("<p>a<br>b<br>c</p>")
 
         state.selection = THIRD_LINE
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+        assertEquals("<p>a<br>b</p><h1>c</h1>", state.toHtml())
     }
 
     @Test
-    fun `a heading set with the caret in a line applies to the block`() {
+    fun `a heading on two selected lines keeps those two linked`() {
         val state = stateOf("<p>a<br>b<br>c</p>")
 
-        state.selection = TextRange(3)
+        state.selection = TextRange(0, 3)
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+        assertEquals("<h1>a<br>b</h1><p>c</p>", state.toHtml())
     }
 
     @Test
-    fun `removing the heading from one line removes it from the block`() {
-        val state = stateOf("<h1>a<br>b<br>c</h1>")
+    fun `a heading on every line keeps the block whole`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
 
-        state.selection = SECOND_LINE
-        state.setHeadingStyle(HeadingStyle.Normal)
+        state.selection = TextRange(0, 5)
+        state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals("<p>a<br>b<br>c</p>", state.toHtml())
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
     }
 
     @Test
-    fun `changing the level on one line changes the block`() {
+    fun `removing the heading from one line of a heading block takes that line out`() {
         val state = stateOf("<h1>a<br>b<br>c</h1>")
 
         state.selection = THIRD_LINE
-        state.setHeadingStyle(HeadingStyle.H3)
+        state.setHeadingStyle(HeadingStyle.Normal)
 
-        assertEquals("<h3>a<br>b<br>c</h3>", state.toHtml())
+        assertEquals("<h1>a<br>b</h1><p>c</p>", state.toHtml())
     }
 
     @Test
-    fun `the blocks around it are left alone`() {
-        val state = stateOf("<p>before</p><p>a<br>b</p><p>after</p>")
-
-        // "before a b after": the line "b" starts at 9.
-        state.selection = TextRange(9, 10)
+    fun `only the selected line reports the heading`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+        state.selection = FIRST_LINE
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals("<p>before</p><h1>a<br>b</h1><p>after</p>", state.toHtml())
-    }
-
-    @Test
-    fun `a selection across two blocks applies to both in full`() {
-        val state = stateOf("<p>a<br>b</p><p>c<br>d</p>")
-
-        // "a b c d": from the line "b" to the line "c".
-        state.selection = TextRange(2, 5)
-        state.setHeadingStyle(H
```

---

### Incident Patch 3: `b0584fac` (2026-10-05)
**Commit Message**: fix: a heading set on one line of a <br> block applies to the whole block

**File**: `docs/headings.md` (modified, +4/-0)
```diff
@@ -21,6 +21,10 @@ richTextState.setHeadingStyle(HeadingStyle.Normal)
 selection**. Wrap the call in `recordHistory` automatically so undo/redo
 restores heading changes alongside other formatting.
 
+Lines separated by a `<br>` inside one block, such as `<p>a<br>b</p>`, share that block's
+tag. A heading set on any of those lines applies to the whole block, and the result is
+`<h2>a<br>b</h2>`.
+
 ### Reading the current level
 
 ```kotlin
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +24/-6)
```diff
@@ -1499,19 +1499,18 @@ public class RichTextState internal constructor(
      * [HeadingStyle.Normal], any existing heading style is removed from those paragraphs;
      * otherwise the specified heading style replaces any previous one. Wrapped in
      * [recordHistory] so undo/redo restores heading changes alongside other formatting.
+     *
+     * The lines of a `<br>` block share one tag in html, so a heading set on one of them
+     * applies to the whole block.
      */
     public fun setHeadingStyle(headingStyle: HeadingStyle) {
         if (headingStyle != HeadingStyle.Normal && RichTextFeature.Heading !in config.features) return
         recordHistory(CommitTrigger.Formatting) {
-            val paragraphs = getRichParagraphListByTextRange(selection)
+            val paragraphs = withLineBreakBlocks(getRichParagraphListByTextRange(selection))
             if (paragraphs.isEmpty()) return@recordHistory
 
             paragraphs.forEach { paragraph ->
-                if (paragraph.headingStyle == headingStyle) return@forEach
-                paragraph.applyHeadingStyle(headingStyle)
-                // A continuation has no heading of its own in html. Unlike addParagraphStyle,
-                // which severs unconditionally, a level that did not change severs nothing.
-                clearLineBreakContinuations(paragraph)
+                if (paragraph.headingStyle != headingStyle) paragraph.applyHeadingStyle(headingStyle)
             }
 
             updateAnnotatedString()
@@ -5157,6 +5156,25 @@ public class RichTextState internal constructor(
         return richSpanList.getCommonStyle() ?: RichSpanStyle.DefaultSpanStyle
     }
 
+    /**
+     * [paragraphs] widened to the `<br>` blocks they belong to: the paragraph that opens each
+     * block and every line break continuation that follows it, in document order.
+     */
+    private fun withLineBreakBlocks(paragraphs: List<RichParagraph>): List<RichParagraph> {
+        val indices = mutableSetOf<Int>()
+        paragraphs.forEach { paragraph ->
+            val index = richParagraphList.indexOf(paragraph)
+            if (index < 0) return@forEach
+
+            var first = index
+            while (first > 0 && richParagraphList[first].isFromLineBreak) first--
+            var last = index
+            while (last < richParagraphList.lastIndex && richParagraphList[last + 1].isFromLineBreak) last++
+            indices.addAll(first..last)
+        }
+        return indices.sorted().map { richParagraphList[it] }
+    }
+
     /**
      * Clears [RichParagraph.isFromLineBreak] on the given paragraph and all
      * consecutive trailing paragraphs that have `isFromLineBreak = true`.
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/ContinuationSeveringMatrixTest.kt` (modified, +19/-19)
```diff
@@ -14,11 +14,13 @@ import kotlin.test.Test
 import kotlin.test.assertEquals
 
 /**
- * Every paragraph-level mutator applied to a `<br>` continuation must sever it, and the chain
- * behind it, into independent paragraphs. The html encoder can only write a continuation inside
- * the tag of the paragraph it continues, so a continuation that became a heading, a list item or
- * a centered paragraph has no faithful `<br>` form: its level, type or alignment would be dropped
- * on save, or smeared over the paragraph it continues.
+ * A paragraph-level mutator applied to a `<br>` continuation must leave a document the html
+ * encoder can write. The encoder can only write a continuation inside the tag of the paragraph
+ * it continues, so a continuation that became a list item or a centered paragraph has no
+ * faithful `<br>` form: its type or alignment would be dropped on save, or smeared over the
+ * paragraph it continues. Those mutators sever it, and the chain behind it, into independent
+ * paragraphs. A heading is the exception: it is the block's own tag, so it applies to every
+ * line of the block and the block stays whole (see [HeadingLineBreakBlockTest]).
  *
  * The document is `<p>a<br>b<br>c</p>` with the caret in `b`. Each row asserts the triple: the
  * model (the continuation flags of all three paragraphs plus the mutated property), the exact
@@ -65,43 +67,41 @@ class ContinuationSeveringMatrixTest {
     // setHeadingStyle
 
     @Test
-    fun `a heading on a middle continuation severs it and its chain`() {
+    fun `a heading on a middle continuation applies to the block and keeps it whole`() {
         val state = continuationDocument()
         state.selection = TextRange(3)
 
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals(listOf(false, false, false), structure(state).continuations)
-        assertEquals(listOf(HeadingStyle.Normal, HeadingStyle.H1, HeadingStyle.Normal), structure(state).headings)
-        assertEquals("<p>a</p><h1>b</h1><p>c</p>", state.toHtml())
+        assertEquals(listOf(false, true, true), structure(state).continuations)
+        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.H1, HeadingStyle.H1), structure(state).headings)
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
         assertReloadAgrees(state)
     }
 
     @Test
-    fun `a heading on the last continuation severs it`() {
+    fun `a heading on the last continuation applies to the block and keeps it whole`() {
         val state = continuationDocument("<p>a<br>b</p>")
         state.selection = TextRange(3)
 
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals(listOf(false, false), structure(state).continuations)
-        assertEquals(listOf(HeadingStyle.Normal, HeadingStyle.H1), structure(state).headings)
-        assertEquals("<p>a</p><h1>b</h1>", state.toHtml())
+        assertEquals(listOf(false, true), structure(state).continuations)
+        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.H1), structure(state).headings)
+        assertEquals("<h1>a<br>b</h1>", state.toHtml())
         assertReloadAgrees(state)
     }
 
     @Test
-    fun `a heading on the head severs the whole chain`() {
-        // Same rule as addParagraphStyle on the head: the continuations were not touched by
-        // the user, so they must not silently become part of the heading.
+    fun `a heading on the head applies to its continuations and keeps the block whole`() {
         val state = continuationDocument()
         state.selection = TextRange(1)
 
         state.setHeadingStyle(HeadingStyle.H1)
 
-        assertEquals(listOf(false, false, false), structure(state).continuations)
-        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.Normal, HeadingStyle.Normal), structure(state).headings)
-        assertEquals("<h1>a</h1><p>b</p><p>c</p>", state.toHtml())
+        assertEquals(listOf(false, true, true), structure(state).continuations)
+        assertEquals(listOf(HeadingStyle.H1, HeadingStyle.H1, HeadingStyle.H1), structure(state).headings)
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
         assertReloadAgrees(state)
     }
 
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/HeadingLineBreakBlockTest.kt` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.text.TextRange
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * A heading set on one line of a `<br>` block applies to the whole block.
+ *
+ * The lines of `<p>a<br>b<br>c</p>` are separate paragraphs in the model, linked as line break
+ * continuations of the first one. In html a block has one tag, so a heading belongs to all of
+ * its lines: setting it on a single line used to cut the block into separate paragraphs.
+ */
+class HeadingLineBreakBlockTest {
+
+    @Test
+    fun `a heading set on the first line applies to every line of the block`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = FIRST_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading set on a middle line applies to every line of the block`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = SECOND_LINE
+        state.setHeadingStyle(HeadingStyle.H2)
+
+        assertEquals("<h2>a<br>b<br>c</h2>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading set on the last line applies to every line of the block`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = THIRD_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+    }
+
+    @Test
+    fun `a heading set with the caret in a line applies to the block`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+
+        state.selection = TextRange(3)
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<h1>a<br>b<br>c</h1>", state.toHtml())
+    }
+
+    @Test
+    fun `removing the heading from one line removes it from the block`() {
+        val state = stateOf("<h1>a<br>b<br>c</h1>")
+
+        state.selection = SECOND_LINE
+        state.setHeadingStyle(HeadingStyle.Normal)
+
+        assertEquals("<p>a<br>b<br>c</p>", state.toHtml())
+    }
+
+    @Test
+    fun `changing the level on one line changes the block`() {
+        val state = stateOf("<h1>a<br>b<br>c</h1>")
+
+        state.selection = THIRD_LINE
+        state.setHeadingStyle(HeadingStyle.H3)
+
+        assertEquals("<h3>a<br>b<br>c</h3>", state.toHtml())
+    }
+
+    @Test
+    fun `the blocks around it are left alone`() {
+        val state = stateOf("<p>before</p><p>a<br>b</p><p>after</p>")
+
+        // "before a b after": the line "b" starts at 9.
+        state.selection = TextRange(9, 10)
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<p>before</p><h1>a<br>b</h1><p>after</p>", state.toHtml())
+    }
+
+    @Test
+    fun `a selection across two blocks applies to both in full`() {
+        val state = stateOf("<p>a<br>b</p><p>c<br>d</p>")
+
+        // "a b c d": from the line "b" to the line "c".
+        state.selection = TextRange(2, 5)
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        assertEquals("<h1>a<br>b</h1><h1>c<br>d</h1>", state.toHtml())
+    }
+
+    @Test
+    fun `every line of the block reports the heading`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+        state.selection = FIRST_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        listOf(FIRST_LINE, SECOND_LINE, THIRD_LINE).forEach { line ->
+            state.selection = line
+            assertEquals(HeadingStyle.H1, state.currentHeadingStyle, "line at $line")
+        }
+    }
+
+    @Test
+    fun `undo restores the block as it was`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+        state.selection = SECOND_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        state.history.undo()
+
+        assertEquals("<p>a<br>b<br>c</p>", state.toHtml())
+    }
+
+    @Test
+    fun `the block survives an html round trip`() {
+        val state = stateOf("<p>a<br>b<br>c</p>")
+        state.selection = FIRST_LINE
+        state.setHeadingStyle(HeadingStyle.H1)
+
+        val reloaded = stateOf(state.toHtml())
+
+        assertEquals("<h1>a<br>b<br>c</h1>", reloaded.toHtml())
+    }
+
+    private fun stateOf(html: String): RichTextState = RichTextState().apply { setHtml(html) }
+
+    private companion object {
+        // "a b c": one character per line, one separator between lines.
+        val FIRST_LINE = TextRange(0, 1)
+        val SECOND_LINE = TextRange(2, 3)
+        val THIRD_LINE = TextRange(4, 5)
+    }
+}
```

---

### Incident Patch 4: `8a5d54cd` (2026-10-05)
**Commit Message**: Merge pull request #826 from MohamedRejeb/fix/issue-369-caret-size-empty-paragraph

fix: caret on an empty paragraph takes the paragraph's font size

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/CaretHandleCorrection.kt` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ internal fun RichTextState.holdCaretHandleOnParagraphEnd(): Boolean {
 
     val text = textFieldState.text.toString()
     val layout = textLayoutResult ?: return false
-    if (layout.layoutInput.text.length != text.length) return false
+    if (!layout.isForModelText(text.length)) return false
 
     val step = CaretHandleStep(from = previous.start, to = caret.start, before = beforePrevious)
     if (!layout.handleIsPastParagraphEnd(step)) return false
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/EditPipeline.kt` (modified, +98/-36)
```diff
@@ -4,6 +4,8 @@ import androidx.compose.foundation.ExperimentalFoundationApi
 import androidx.compose.foundation.text.input.TextFieldBuffer
 import androidx.compose.ui.text.AnnotatedString
 import androidx.compose.ui.text.ParagraphStyle
+import androidx.compose.ui.text.SpanStyle
+import androidx.compose.ui.text.TextLayoutResult
 import androidx.compose.ui.text.TextRange
 import com.mohamedrejeb.richeditor.model.history.CommitTrigger
 
@@ -293,58 +295,118 @@ internal fun RichTextState.reconcileBufferWithModel(buffer: TextFieldBuffer) {
 }
 
 /**
- * Makes a trailing empty paragraph render its line by turning the separator space in front of it
- * into a newline in the output buffer.
+ * What the output buffer appends for a trailing empty paragraph: a zero-width space.
  *
  * The builder appends each paragraph separator inside the *previous* paragraph's range, so a
- * trailing empty paragraph gets a zero-length range at the end of the text. BTF2 styles the buffer
- * through tracked ranges and drops collapsed ones, so that paragraph renders nothing. Shifting the
- * ranges instead cannot work on an all-empty document: N empty paragraphs own only N-1 separators,
- * so one line always goes missing. A newline makes MultiParagraph split natively, no range needed.
+ * trailing empty paragraph gets a zero-length range at the end of the text, and BTF2 drops
+ * collapsed style ranges. The anchor gives that paragraph one character to carry its
+ * ParagraphStyle and its font, so its line renders with its own alignment and height.
  *
- * The substitution is output-only (the model text keeps its space) and same-length, so every style
- * offset stays valid and the caret at the end of the text lands on the new line.
- *
- * Known limitation: the trailing empty paragraph still has no range of its own, so its own
- * ParagraphStyle is not attributed until it holds a character; the substituted newline lives inside
- * the previous paragraph's range and inherits that paragraph's style. Centering an empty trailing
- * line therefore shows as a one-keystroke alignment jump: the line renders with the previous
- * paragraph's alignment until the first character turns the range non-degenerate.
+ * It is output-only and always last, so every model offset is also a valid layout offset. The
+ * layout text is one character longer than the model text while it is there, see
+ * [isForModelText].
  */
-internal fun substituteTrailingSeparatorWithNewline(
-    buffer: TextFieldBuffer,
-    ranges: List<AnnotatedString.Range<ParagraphStyle>>,
-): Boolean {
-    val last = ranges.lastOrNull() ?: return false
-    if (last.start != last.end) return false
-    if (last.start != buffer.length || buffer.length == 0) return false
-    if (buffer.asCharSequence()[buffer.length - 1] != ' ') return false
-    buffer.replace(buffer.length - 1, buffer.length, "\n")
-    return true
+internal const val EmptyLineAnchor: String = "\u200B"
+
+/** Whether this layout was computed for a model text of [modelLength] characters. */
+internal fun TextLayoutResult.isForModelText(modelLength: Int): Boolean {
+    val text = layoutInput.text.text
+    return text.length == modelLength ||
+        (text.length == modelLength + EmptyLineAnchor.length && text.endsWith(EmptyLineAnchor))
 }
 
 /**
- * Projects annotatedString's style ranges into the BTF2 output buffer. Collapsed paragraph ranges
- * are skipped, since BTF2 drops them anyway; the trailing one stands for a line that
- * [substituteTrailingSeparatorWithNewline] renders instead. A collapsed range anywhere else (a
- * shape only singleParagraphMode or a transient desync can produce) is deliberately unhandled and
- * simply dropped here. Inter-paragraph spacing comes from the caller's text style alone: each
- * paragraph range is laid out with the caller's `lineHeight` and `lineHeightStyle` as given.
+ * Projects annotatedString's style ranges into the BTF2 output buffer.
  *
- * The substitution runs before any addStyle call: TextFieldBuffer only tracks styles added after
- * the last edit, so styles emitted first would be discarded by the replace.
+ * A trailing empty paragraph has a collapsed range, which BTF2 would drop: it gets the
+ * [EmptyLineAnchor] and its ParagraphStyle on it. A collapsed range anywhere else (a shape only
+ * singleParagraphMode or a transient desync can produce) is deliberately unhandled and simply
+ * dropped here. Inter-paragraph spacing comes from the caller's text style alone: each paragraph
+ * range is laid out with the caller's `lineHeight` and `lineHeightStyle` as given.
+ *
+ * The anchor is appended before any addStyle call: TextFieldBuffer only tracks styles added
+ * after the last edit, so styles emitted first would be discarded by the append.
  */
 internal fun RichTextState.applyRichTextStyles(buffer: TextFieldBuffer) {
     val annotated = annotatedString
-    substituteTrailingSeparatorWithNewline(buffer, annotated.paragraphStyles)
+    val modelLength = 
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/ParagraphNavigation.kt` (modified, +2/-2)
```diff
@@ -52,9 +52,9 @@ internal fun RichTextState.correctTripleClickSelection(buffer: TextFieldBuffer)
 
     val press = pressForCaretCorrection() ?: return
     val layout = textLayoutResult ?: return
-    if (layout.layoutInput.text.length != buffer.length) return
+    if (!layout.isForModelText(buffer.length)) return
 
-    var offset = layout.getOffsetForPosition(press)
+    var offset = layout.getOffsetForPosition(press).coerceAtMost(buffer.length)
     // A press past the end of a line reports the next paragraph's start (see
     // [correctPressCaret]); the pressed line decides.
     val pressedLine = layout.getLineForVerticalPosition(
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/PressCaretCorrection.kt` (modified, +20/-2)
```diff
@@ -2,6 +2,7 @@ package com.mohamedrejeb.richeditor.model
 
 import androidx.compose.foundation.ExperimentalFoundationApi
 import androidx.compose.foundation.text.input.TextFieldBuffer
+import androidx.compose.ui.text.TextLayoutResult
 import androidx.compose.ui.text.TextRange
 
 /**
@@ -24,17 +25,34 @@ internal fun RichTextState.correctPressCaret(buffer: TextFieldBuffer) {
     if (singleParagraphMode || buffer.changes.changeCount != 0) return
 
     val caret = buffer.selection
-    if (!caret.collapsed || !isLaterParagraphStart(caret.start)) return
+    if (!caret.collapsed) return
 
     val layout = textLayoutResult ?: return
-    if (layout.layoutInput.text.length != buffer.length) return
+    if (!layout.isForModelText(buffer.length)) return
 
     val pressedLine = layout.getLineForVerticalPosition(
         press.y.coerceIn(0f, layout.size.height.toFloat())
     )
+    if (layout.isPressOnEmptyLastLine(caret.start, buffer.length, pressedLine)) {
+        buffer.selection = TextRange(buffer.length)
+        pressCorrectedCaret = buffer.length
+        return
+    }
+    if (!isLaterParagraphStart(caret.start)) return
     if (layout.getLineForOffset(caret.start) <= pressedLine) return
 
     // One back is the separator's own position, which renders at the end of the pressed line.
     buffer.selection = TextRange(caret.start - 1)
     pressCorrectedCaret = caret.start - 1
 }
+
+/**
+ * Whether a press on the empty last paragraph's line left the caret on the separator in front
+ * of it. The [EmptyLineAnchor] replaces that separator with two characters, and a hit between
+ * them maps back to the separator, which renders at the end of the line above.
+ */
+internal fun TextLayoutResult.isPressOnEmptyLastLine(caret: Int, modelLength: Int, pressedLine: Int): Boolean =
+    caret == modelLength - 1 &&
+        layoutInput.text.length > modelLength &&
+        pressedLine == lineCount - 1 &&
+        getLineForOffset(caret) < pressedLine
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +14/-7)
```diff
@@ -887,15 +887,21 @@ public class RichTextState internal constructor(
         val press = pressForCaretCorrection() ?: return
 
         val caret = textFieldState.selection
-        if (singleParagraphMode || !caret.collapsed || !isLaterParagraphStart(caret.start)) return
+        if (singleParagraphMode || !caret.collapsed) return
 
         val text = textFieldState.text.toString()
         val layout = textLayoutResult ?: return
-        if (layout.layoutInput.text.length != text.length) return
+        if (!layout.isForModelText(text.length)) return
 
         val pressedLine = layout.getLineForVerticalPosition(
             press.y.coerceIn(0f, layout.size.height.toFloat())
         )
+        if (layout.isPressOnEmptyLastLine(caret.start, text.length, pressedLine)) {
+            pressCorrectedCaret = text.length
+            setTextFieldStateFromValue(text = text, selection = TextRange(text.length))
+            return
+        }
+        if (!isLaterParagraphStart(caret.start)) return
         if (layout.getLineForOffset(caret.start) <= pressedLine) return
 
         pressCorrectedCaret = caret.start - 1
@@ -3365,8 +3371,8 @@ public class RichTextState internal constructor(
                             // a boundary offset to the later paragraph, so without it the caret could
                             // never sit after the last character of a non-last paragraph. A space and
                             // not a newline, because a newline between paragraphs inside a
-                            // ParagraphStyle range renders an extra blank line (only the trailing empty
-                            // paragraph swaps one in, see substituteTrailingSeparatorWithNewline).
+                            // ParagraphStyle range renders an extra blank line (the trailing empty
+                            // paragraph gets a character of its own instead, see applyRichTextStyles).
                             if (i != richParagraphList.lastIndex && index < newText.length) {
                                 append(' ')
                                 index++
@@ -5240,10 +5246,10 @@ public class RichTextState internal constructor(
         var isParagraphUpdated = false
 
         textLayoutResult?.let { textLayoutResult ->
-            val layoutTextLength = textLayoutResult.layoutInput.text.text.length
+            val layoutTextLength = annotatedString.text.length
 
             // Skip if the layout result is stale (text changed since layout was computed)
-            if (layoutTextLength != annotatedString.text.length) return
+            if (!textLayoutResult.isForModelText(layoutTextLength)) return
 
             val multiParagraph = textLayoutResult.multiParagraph
             val offsetLimit =
@@ -5381,6 +5387,7 @@ public class RichTextState internal constructor(
     private fun getRichSpanByOffset(offset: Offset): RichSpan? {
         this.textLayoutResult?.let { textLayoutResult ->
             val position = textLayoutResult.getOffsetForPosition(offset)
+                .coerceAtMost(textFieldState.text.length)
             return getRichSpanByTextIndex(position, true)
         }
         return null
@@ -5446,7 +5453,7 @@ public class RichTextState internal constructor(
             pointer != null &&
             pointerFresh &&
             layout != null &&
-            layout.layoutInput.text.length == textFieldValue.text.length
+            layout.isForModelText(textFieldValue.text.length)
         ) {
             val pointerLine = layout.getLineForVerticalPosition(
                 pointer.y.coerceIn(0f, layout.size.height.toFloat())
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/EditPipelineStyleEmissionTest.kt` (modified, +4/-5)
```diff
@@ -10,8 +10,8 @@ import kotlin.test.assertTrue
 /**
  * Pins the paragraph-range shapes [applyRichTextStyles] emits from. The builder appends each
  * separator inside the previous paragraph's block, so only the final range can be degenerate; the
- * emission drops collapsed ranges and relies on [substituteTrailingSeparatorWithNewline] to render
- * the line the trailing one stands for.
+ * emission drops collapsed ranges and appends the [EmptyLineAnchor] to render the line the
+ * trailing one stands for.
  */
 @OptIn(ExperimentalFoundationApi::class)
 class EditPipelineStyleEmissionTest {
@@ -48,13 +48,12 @@ class EditPipelineStyleEmissionTest {
     }
 
     @Test
-    fun `emission turns the trailing separator into a newline of the same length`() {
+    fun `emission appends the anchor for a trailing empty paragraph`() {
         val state = RichTextState().setText("a\n")
         val buffer = bufferOf(state.annotatedString.text)
 
         state.applyRichTextStyles(buffer)
 
-        assertEquals("a\n", buffer.asCharSequence().toString())
-        assertEquals(state.annotatedString.text.length, buffer.length)
+        assertEquals("a $EmptyLineAnchor", buffer.asCharSequence().toString())
     }
 }
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/EditPipelineTrailingParagraphTest.kt` (modified, +39/-55)
```diff
@@ -7,98 +7,82 @@ import androidx.compose.ui.text.AnnotatedString
 import androidx.compose.ui.text.ParagraphStyle
 import kotlin.test.Test
 import kotlin.test.assertEquals
-import kotlin.test.assertFalse
-import kotlin.test.assertTrue
+import kotlin.test.assertNull
+import kotlin.test.assertSame
 
 /**
- * Unit coverage for [substituteTrailingSeparatorWithNewline]. The builder puts each paragraph
- * separator inside the previous paragraph's range, so a trailing empty paragraph arrives with a
- * zero-length range that BTF2 drops; the newline makes MultiParagraph render that line instead.
+ * Unit coverage for the trailing empty paragraph. The builder puts each paragraph separator
+ * inside the previous paragraph's range, so a trailing empty paragraph arrives with a zero-length
+ * range that BTF2 drops; the output buffer appends the [EmptyLineAnchor] for it instead.
  */
 @OptIn(ExperimentalFoundationApi::class)
 class EditPipelineTrailingParagraphTest {
 
     private fun range(start: Int, end: Int) =
         AnnotatedString.Range(ParagraphStyle(), start, end)
 
-    private fun bufferOf(text: String) = TextFieldState(text).toTextFieldBuffer()
+    private fun outputOf(state: RichTextState): String {
+        val buffer = TextFieldState(state.annotatedString.text).toTextFieldBuffer()
+        state.applyRichTextStyles(buffer)
+        return buffer.asCharSequence().toString()
+    }
 
     @Test
-    fun `a trailing empty paragraph turns its separator into a newline`() {
-        // "a " + "" : the empty paragraph has no separator of its own.
-        val buffer = bufferOf("a ")
+    fun `a collapsed last range at the end of the text is the trailing empty paragraph`() {
+        val ranges = listOf(range(0, 2), range(2, 2))
 
-        assertTrue(substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 2), range(2, 2))))
-        assertEquals("a\n", buffer.asCharSequence().toString())
+        assertSame(ranges.last(), trailingEmptyParagraphRange(ranges, textLength = 2))
     }
 
     @Test
-    fun `two empty paragraphs own a single separator and still render a newline`() {
-        // The all-empty document: two paragraphs share one separator space.
-        val buffer = bufferOf(" ")
+    fun `an empty document is a trailing empty paragraph`() {
+        val ranges = listOf(range(0, 0))
 
-        assertTrue(substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 1), range(1, 1))))
-        assertEquals("\n", buffer.asCharSequence().toString())
+        assertSame(ranges.last(), trailingEmptyParagraphRange(ranges, textLength = 0))
     }
 
     @Test
-    fun `the substitution keeps the buffer length so style offsets stay valid`() {
-        val buffer = bufferOf("ab ")
-
-        substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 3), range(3, 3)))
-
-        assertEquals(3, buffer.length)
+    fun `a last range that holds text is not one`() {
+        assertNull(trailingEmptyParagraphRange(listOf(range(0, 2), range(2, 3)), textLength = 3))
     }
 
     @Test
-    fun `a document without a trailing empty paragraph is left untouched`() {
-        val buffer = bufferOf("a b")
+    fun `a collapsed range before the last one is never mistaken for the trailing one`() {
+        assertNull(
+            trailingEmptyParagraphRange(listOf(range(0, 2), range(2, 2), range(2, 5)), textLength = 5)
+        )
+    }
 
-        assertFalse(substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 2), range(2, 3))))
-        assertEquals("a b", buffer.asCharSequence().toString())
-        assertEquals(0, buffer.changes.changeCount)
+    @Test
+    fun `a collapsed last range that is not at the end of the text is not one`() {
+        assertNull(trailingEmptyParagraphRange(listOf(range(0, 2), range(2, 2)), textLength = 3))
     }
 
     @Test
-    fun `an empty document is left untouched`() {
-        val buffer = bufferOf("")
+    fun `the output appends the anchor after the model text and keeps the separator`() {
+        val state = RichTextState().setText("a\n")
 
-        assertFalse(substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 0))))
-        assertEquals("", buffer.asCharSequence().toString())
+        assertEquals(state.annotatedString.text + EmptyLineAnchor, outputOf(state))
     }
 
     @Test
-    fun `a collapsed range before the last one is never mistaken for the trailing one`() {
-        val buffer = bufferOf("ab cd")
+    fun `two empty paragraphs own a single separator and the anchor`() {
+        val state = RichTextState().setText("\n")
 
-        assertFalse(
-            substituteTrailingSeparatorWithNewline(
-                buffer,
-                listOf(range(0, 2), range(2, 2), range(2, 5)),
-            )
-        )
-        assertEquals("ab cd", buffer.asCharSequence().toString())
-        assertEquals(0, buffer.changes.changeCount)
+        assertEquals(" $EmptyLineAnchor", outputOf(state))
     }
 
     @Test
-    fun `a collapsed range b
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/Issue369CaretSizeEmptyParagraphTest.kt` (added, +296/-0)
```diff
@@ -0,0 +1,296 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.DesktopComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.click
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.test.performKeyInput
+import androidx.compose.ui.test.performMouseInput
+import androidx.compose.ui.test.performTextInput
+import androidx.compose.ui.test.performTouchInput
+import androidx.compose.ui.test.pressKey
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.ParagraphStyle
+import androidx.compose.ui.text.SpanStyle
+import androidx.compose.ui.text.TextRange
+import androidx.compose.ui.text.TextStyle
+import androidx.compose.ui.text.style.TextAlign
+import androidx.compose.ui.unit.sp
+import com.mohamedrejeb.richeditor.model.EmptyLineAnchor
+import com.mohamedrejeb.richeditor.model.RichTextState
+import com.mohamedrejeb.richeditor.model.isForModelText
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+/**
+ * Issue 369: the caret on an empty paragraph fell back to the editor's base font size, then
+ * jumped to the right size on the first typed character.
+ *
+ * Cause: an empty paragraph renders no character of its own, so nothing gave its line a font.
+ * Fix: the output buffer styles the one character that stands for the empty line (its
+ * separator, or the anchor appended for a trailing empty paragraph) with the font the next
+ * typed character would have.
+ */
+@OptIn(ExperimentalTestApi::class)
+class Issue369CaretSizeEmptyParagraphTest {
+
+    @Test
+    fun `enter after big text keeps the caret big on the new empty paragraph`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        onNodeWithTag(EDITOR_TAG).performTextInput("Big")
+        waitForIdle()
+        val typedCaret = caretHeight(state)
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput { pressKey(Key.Enter) }
+        waitForIdle()
+
+        assertEquals(typedCaret, caretHeight(state), 1f)
+    }
+
+    @Test
+    fun `a staged font size on an empty editor sizes the caret`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        val baseCaret = caretHeight(state)
+
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        waitForIdle()
+
+        assertTrue(caretHeight(state) > baseCaret * 1.5f, "base=$baseCaret staged=${caretHeight(state)}")
+    }
+
+    @Test
+    fun `deleting all the big text keeps the caret big`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        onNodeWithTag(EDITOR_TAG).performTextInput("Hi")
+        waitForIdle()
+        val typedCaret = caretHeight(state)
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput {
+            pressKey(Key.Backspace)
+            pressKey(Key.Backspace)
+        }
+        waitForIdle()
+
+        assertEquals(typedCaret, caretHeight(state), 1f)
+    }
+
+    @Test
+    fun `an empty paragraph between big paragraphs has a big caret`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        state.setHtml("<p><span style=\"font-size: 40px\">One</span></p><p><span style=\"font-size: 40px\"></span></p><p><span style=\"font-size: 40px\">Two</span></p>")
+        waitForIdle()
+        state.selection = TextRange(1)
+        waitForIdle()
+        val bigCaret = caretHeight(state)
+        state.selection = TextRange(4)
+        waitForIdle()
+
+        assertEquals(bigCaret, caretHeight(state), 1f)
+    }
+
+    @Test
+    fun `removing the staged font size shrinks the caret back`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        val baseCaret = caretHeight(state)
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        waitForIdle()
+
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        waitForIdle()
+
+        assertEquals(baseCaret, caretHeight(state), 1f)
+    }
+
+    @Test
+    fun `a bigger empty last paragraph leaves the line above at its own height`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        onNodeWithTag(EDITOR_TAG).performTextInput("small")
+        waitForIdle()
+        val smallLine = caretHeight(state)
+        onNodeWithTag(EDITOR_TAG).performKeyInput { pressKey(Key.Enter) }
+        waitForIdle()
+
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        waitForIdle()
+
+        val layout = checkNotNull(state.textLayoutResult)
+        a
```

---

### Incident Patch 5: `eb2d5fde` (2026-10-05)
**Commit Message**: Merge branch 'main' into fix/issue-369-caret-size-empty-paragraph

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/EditPipeline.kt` (modified, +42/-1)
```diff
@@ -58,7 +58,9 @@ internal fun RichTextState.applyChangeList(buffer: TextFieldBuffer) {
             originalRange = originalRange,
             newText = buffer.asCharSequence().substring(newRange.min, newRange.max),
         )
-    }.sortedBy { it.originalRange.min }.mapNotNull { keepSeparatorUnderTrailingSpace(it) }
+    }.sortedBy { it.originalRange.min }
+        .mapNotNull { trimWholeTextRewrite(it, buffer) }
+        .mapNotNull { keepSeparatorUnderTrailingSpace(it) }
     if (deltas.isEmpty()) {
         // The whole batch was a kept separator deletion: the reconciliation puts the separator
         // back and must leave the caret in front of it, or the caret would land in the next
@@ -146,6 +148,45 @@ internal fun RichTextState.applyChangeList(buffer: TextFieldBuffer) {
     if (refreshed) clearImeEditWindow() else noteImeEdit(caret = textFieldValue.selection.min)
 }
 
+/**
+ * Compose web commits every typed character as one change from the whole old text to the whole
+ * new text. Replayed as it is, that replaces the document with a single unformatted paragraph,
+ * so such a change is cut down to the part that differs. A change over the whole text that
+ * matches the selection is a real replacement (select all, then type) and is left alone.
+ * Returns null when nothing differs.
+ */
+@OptIn(ExperimentalFoundationApi::class)
+private fun trimWholeTextRewrite(delta: InputDelta, buffer: TextFieldBuffer): InputDelta? {
+    val original = buffer.originalText
+    val coversWholeText = delta.originalRange.min == 0 && delta.originalRange.max == original.length
+    if (!coversWholeText || original.isEmpty() || delta.originalRange == buffer.originalSelection) return delta
+    return differingPart(original = original, rewritten = delta.newText, caret = buffer.selection.min)
+}
+
+/**
+ * The smallest single edit that turns [original] into [rewritten], or null when they are equal.
+ * Where it could sit in more than one place (a character typed into a run of the same one), it
+ * is the one that ends at [caret], which is where a typed character leaves the caret.
+ */
+internal fun differingPart(original: CharSequence, rewritten: CharSequence, caret: Int): InputDelta? {
+    val shorter = minOf(original.length, rewritten.length)
+    val prefix = original.commonPrefixWith(rewritten).length
+    val suffix = original.commonSuffixWith(rewritten).length.coerceAtMost(shorter - prefix)
+    if (prefix == original.length && prefix == rewritten.length) return null
+
+    // The same edit also fits anywhere down to the shortest prefix a full suffix match allows.
+    val fullSuffix = original.commonSuffixWith(rewritten).length
+    val minPrefix = (shorter - fullSuffix).coerceIn(0, prefix)
+    val shift = (rewritten.length - suffix - caret).coerceIn(0, prefix - minPrefix)
+
+    val start = prefix - shift
+    val kept = suffix + shift
+    return InputDelta(
+        originalRange = TextRange(start, original.length - kept),
+        newText = rewritten.substring(start, rewritten.length - kept),
+    )
+}
+
 /**
  * An IME puts a space after a word by replacing the character that follows it when that
  * character is already a space: Gboard selects it and commits " ", Samsung deletes it and
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/DifferingPartTest.kt` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.text.TextRange
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNull
+
+/** Unit coverage for [differingPart], the edit a whole text rewrite is cut down to. */
+class DifferingPartTest {
+
+    @Test
+    fun `equal texts differ nowhere`() {
+        assertNull(differingPart(original = "abc", rewritten = "abc", caret = 3))
+    }
+
+    @Test
+    fun `an appended character is an insertion at the end`() {
+        assertEquals(
+            InputDelta(TextRange(3), "d"),
+            differingPart(original = "abc", rewritten = "abcd", caret = 4),
+        )
+    }
+
+    @Test
+    fun `an inserted character is an insertion at its place`() {
+        assertEquals(
+            InputDelta(TextRange(1), "x"),
+            differingPart(original = "abc", rewritten = "axbc", caret = 2),
+        )
+    }
+
+    @Test
+    fun `a removed character is a deletion of it`() {
+        assertEquals(
+            InputDelta(TextRange(1, 2), ""),
+            differingPart(original = "abc", rewritten = "ac", caret = 1),
+        )
+    }
+
+    @Test
+    fun `a replaced word keeps what surrounds it`() {
+        assertEquals(
+            InputDelta(TextRange(4, 7), "new"),
+            differingPart(original = "one old two", rewritten = "one new two", caret = 7),
+        )
+    }
+
+    @Test
+    fun `a character typed into a run of the same one goes in at the caret`() {
+        assertEquals(
+            InputDelta(TextRange(1), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 2),
+        )
+        assertEquals(
+            InputDelta(TextRange(0), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 1),
+        )
+        assertEquals(
+            InputDelta(TextRange(3), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 4),
+        )
+    }
+
+    @Test
+    fun `a character deleted from a run of the same one comes out at the caret`() {
+        assertEquals(
+            InputDelta(TextRange(1, 2), ""),
+            differingPart(original = "aaa", rewritten = "aa", caret = 1),
+        )
+    }
+
+    @Test
+    fun `a caret before every placement takes the earliest one`() {
+        assertEquals(
+            InputDelta(TextRange(0), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 0),
+        )
+    }
+
+    @Test
+    fun `texts with nothing in common are replaced whole`() {
+        assertEquals(
+            InputDelta(TextRange(0, 3), "xyz"),
+            differingPart(original = "abc", rewritten = "xyz", caret = 3),
+        )
+    }
+
+    @Test
+    fun `an emptied text is a deletion of everything`() {
+        assertEquals(
+            InputDelta(TextRange(0, 3), ""),
+            differingPart(original = "abc", rewritten = "", caret = 0),
+        )
+    }
+}
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/WholeTextRewriteEditTest.kt` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.DesktopComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.click
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.test.performMouseInput
+import androidx.compose.ui.test.performTextReplacement
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.TextRange
+import com.mohamedrejeb.richeditor.model.RichTextState
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * An edit that reaches the editor as a rewrite of the whole text must only change what differs.
+ *
+ * Compose web commits every typed character that way: the text field reports one change from
+ * the whole old text to the whole new text. Replayed literally, it replaced the document with a
+ * single unformatted paragraph. The pipeline now trims such a change to the part that differs.
+ * `performTextReplacement` produces the same change shape on desktop.
+ */
+@OptIn(ExperimentalTestApi::class)
+class WholeTextRewriteEditTest {
+
+    @Test
+    fun `a character appended by a whole text rewrite keeps paragraphs and formatting`() = runEditorTest { state ->
+        rewrite(state, caret = state.textFieldState.text.length) { "${it}q" }
+
+        assertEquals("<p>One <b>bold</b> word</p><p>Second lineq</p>", state.toHtml())
+        assertEquals(TextRange(SOURCE_TEXT.length + 1), state.selection)
+    }
+
+    @Test
+    fun `a character inserted in the first paragraph keeps the rest`() = runEditorTest { state ->
+        rewrite(state, caret = 2) { it.replaceRange(2, 2, "x") }
+
+        assertEquals("<p>Onxe <b>bold</b> word</p><p>Second line</p>", state.toHtml())
+    }
+
+    @Test
+    fun `a character deleted by a whole text rewrite keeps the rest`() = runEditorTest { state ->
+        rewrite(state, caret = 4) { it.removeRange(4, 5) }
+
+        assertEquals("<p>One <b>old</b> word</p><p>Second line</p>", state.toHtml())
+    }
+
+    @Test
+    fun `typing over a select all still replaces everything`() = runEditorTest { state ->
+        state.selection = TextRange(0, state.textFieldState.text.length)
+        waitForIdle()
+
+        onNodeWithTag(EDITOR_TAG).performTextReplacement("One")
+        waitForIdle()
+
+        assertEquals("One", state.toText())
+        assertEquals(1, state.richParagraphList.size)
+    }
+
+    private fun runEditorTest(block: DesktopComposeUiTest.(RichTextState) -> Unit) = runDesktopComposeUiTest {
+        val state = RichTextState().apply { setHtml(SOURCE_HTML) }
+        setEditor(state)
+        assertEquals(SOURCE_TEXT, state.textFieldState.text.toString())
+        block(state)
+    }
+
+    private fun DesktopComposeUiTest.setEditor(state: RichTextState) {
+        setContent { BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth().testTag(EDITOR_TAG)) }
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(5f, 5f)) }
+        waitForIdle()
+    }
+
+    /** Places the caret, then commits [change] applied to the whole text as one rewrite. */
+    private fun DesktopComposeUiTest.rewrite(state: RichTextState, caret: Int, change: (String) -> String) {
+        state.selection = TextRange(caret)
+        waitForIdle()
+        onNodeWithTag(EDITOR_TAG).performTextReplacement(change(state.textFieldState.text.toString()))
+        waitForIdle()
+    }
+
+    private companion object {
+        const val EDITOR_TAG = "editor"
+        const val SOURCE_HTML = "<p>One <b>bold</b> word</p><p>Second line</p>"
+        const val SOURCE_TEXT = "One bold word Second line"
+    }
+}
```

---

### Incident Patch 6: `2f86ddf3` (2026-10-05)
**Commit Message**: Merge pull request #831 from MohamedRejeb/fix/web-typing-flattens-document

fix: typing on web no longer flattens the document

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/EditPipeline.kt` (modified, +42/-1)
```diff
@@ -56,7 +56,9 @@ internal fun RichTextState.applyChangeList(buffer: TextFieldBuffer) {
             originalRange = originalRange,
             newText = buffer.asCharSequence().substring(newRange.min, newRange.max),
         )
-    }.sortedBy { it.originalRange.min }.mapNotNull { keepSeparatorUnderTrailingSpace(it) }
+    }.sortedBy { it.originalRange.min }
+        .mapNotNull { trimWholeTextRewrite(it, buffer) }
+        .mapNotNull { keepSeparatorUnderTrailingSpace(it) }
     if (deltas.isEmpty()) {
         // The whole batch was a kept separator deletion: the reconciliation puts the separator
         // back and must leave the caret in front of it, or the caret would land in the next
@@ -144,6 +146,45 @@ internal fun RichTextState.applyChangeList(buffer: TextFieldBuffer) {
     if (refreshed) clearImeEditWindow() else noteImeEdit(caret = textFieldValue.selection.min)
 }
 
+/**
+ * Compose web commits every typed character as one change from the whole old text to the whole
+ * new text. Replayed as it is, that replaces the document with a single unformatted paragraph,
+ * so such a change is cut down to the part that differs. A change over the whole text that
+ * matches the selection is a real replacement (select all, then type) and is left alone.
+ * Returns null when nothing differs.
+ */
+@OptIn(ExperimentalFoundationApi::class)
+private fun trimWholeTextRewrite(delta: InputDelta, buffer: TextFieldBuffer): InputDelta? {
+    val original = buffer.originalText
+    val coversWholeText = delta.originalRange.min == 0 && delta.originalRange.max == original.length
+    if (!coversWholeText || original.isEmpty() || delta.originalRange == buffer.originalSelection) return delta
+    return differingPart(original = original, rewritten = delta.newText, caret = buffer.selection.min)
+}
+
+/**
+ * The smallest single edit that turns [original] into [rewritten], or null when they are equal.
+ * Where it could sit in more than one place (a character typed into a run of the same one), it
+ * is the one that ends at [caret], which is where a typed character leaves the caret.
+ */
+internal fun differingPart(original: CharSequence, rewritten: CharSequence, caret: Int): InputDelta? {
+    val shorter = minOf(original.length, rewritten.length)
+    val prefix = original.commonPrefixWith(rewritten).length
+    val suffix = original.commonSuffixWith(rewritten).length.coerceAtMost(shorter - prefix)
+    if (prefix == original.length && prefix == rewritten.length) return null
+
+    // The same edit also fits anywhere down to the shortest prefix a full suffix match allows.
+    val fullSuffix = original.commonSuffixWith(rewritten).length
+    val minPrefix = (shorter - fullSuffix).coerceIn(0, prefix)
+    val shift = (rewritten.length - suffix - caret).coerceIn(0, prefix - minPrefix)
+
+    val start = prefix - shift
+    val kept = suffix + shift
+    return InputDelta(
+        originalRange = TextRange(start, original.length - kept),
+        newText = rewritten.substring(start, rewritten.length - kept),
+    )
+}
+
 /**
  * An IME puts a space after a word by replacing the character that follows it when that
  * character is already a space: Gboard selects it and commits " ", Samsung deletes it and
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/DifferingPartTest.kt` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.text.TextRange
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNull
+
+/** Unit coverage for [differingPart], the edit a whole text rewrite is cut down to. */
+class DifferingPartTest {
+
+    @Test
+    fun `equal texts differ nowhere`() {
+        assertNull(differingPart(original = "abc", rewritten = "abc", caret = 3))
+    }
+
+    @Test
+    fun `an appended character is an insertion at the end`() {
+        assertEquals(
+            InputDelta(TextRange(3), "d"),
+            differingPart(original = "abc", rewritten = "abcd", caret = 4),
+        )
+    }
+
+    @Test
+    fun `an inserted character is an insertion at its place`() {
+        assertEquals(
+            InputDelta(TextRange(1), "x"),
+            differingPart(original = "abc", rewritten = "axbc", caret = 2),
+        )
+    }
+
+    @Test
+    fun `a removed character is a deletion of it`() {
+        assertEquals(
+            InputDelta(TextRange(1, 2), ""),
+            differingPart(original = "abc", rewritten = "ac", caret = 1),
+        )
+    }
+
+    @Test
+    fun `a replaced word keeps what surrounds it`() {
+        assertEquals(
+            InputDelta(TextRange(4, 7), "new"),
+            differingPart(original = "one old two", rewritten = "one new two", caret = 7),
+        )
+    }
+
+    @Test
+    fun `a character typed into a run of the same one goes in at the caret`() {
+        assertEquals(
+            InputDelta(TextRange(1), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 2),
+        )
+        assertEquals(
+            InputDelta(TextRange(0), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 1),
+        )
+        assertEquals(
+            InputDelta(TextRange(3), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 4),
+        )
+    }
+
+    @Test
+    fun `a character deleted from a run of the same one comes out at the caret`() {
+        assertEquals(
+            InputDelta(TextRange(1, 2), ""),
+            differingPart(original = "aaa", rewritten = "aa", caret = 1),
+        )
+    }
+
+    @Test
+    fun `a caret before every placement takes the earliest one`() {
+        assertEquals(
+            InputDelta(TextRange(0), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 0),
+        )
+    }
+
+    @Test
+    fun `texts with nothing in common are replaced whole`() {
+        assertEquals(
+            InputDelta(TextRange(0, 3), "xyz"),
+            differingPart(original = "abc", rewritten = "xyz", caret = 3),
+        )
+    }
+
+    @Test
+    fun `an emptied text is a deletion of everything`() {
+        assertEquals(
+            InputDelta(TextRange(0, 3), ""),
+            differingPart(original = "abc", rewritten = "", caret = 0),
+        )
+    }
+}
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/WholeTextRewriteEditTest.kt` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.DesktopComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.click
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.test.performMouseInput
+import androidx.compose.ui.test.performTextReplacement
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.TextRange
+import com.mohamedrejeb.richeditor.model.RichTextState
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * An edit that reaches the editor as a rewrite of the whole text must only change what differs.
+ *
+ * Compose web commits every typed character that way: the text field reports one change from
+ * the whole old text to the whole new text. Replayed literally, it replaced the document with a
+ * single unformatted paragraph. The pipeline now trims such a change to the part that differs.
+ * `performTextReplacement` produces the same change shape on desktop.
+ */
+@OptIn(ExperimentalTestApi::class)
+class WholeTextRewriteEditTest {
+
+    @Test
+    fun `a character appended by a whole text rewrite keeps paragraphs and formatting`() = runEditorTest { state ->
+        rewrite(state, caret = state.textFieldState.text.length) { "${it}q" }
+
+        assertEquals("<p>One <b>bold</b> word</p><p>Second lineq</p>", state.toHtml())
+        assertEquals(TextRange(SOURCE_TEXT.length + 1), state.selection)
+    }
+
+    @Test
+    fun `a character inserted in the first paragraph keeps the rest`() = runEditorTest { state ->
+        rewrite(state, caret = 2) { it.replaceRange(2, 2, "x") }
+
+        assertEquals("<p>Onxe <b>bold</b> word</p><p>Second line</p>", state.toHtml())
+    }
+
+    @Test
+    fun `a character deleted by a whole text rewrite keeps the rest`() = runEditorTest { state ->
+        rewrite(state, caret = 4) { it.removeRange(4, 5) }
+
+        assertEquals("<p>One <b>old</b> word</p><p>Second line</p>", state.toHtml())
+    }
+
+    @Test
+    fun `typing over a select all still replaces everything`() = runEditorTest { state ->
+        state.selection = TextRange(0, state.textFieldState.text.length)
+        waitForIdle()
+
+        onNodeWithTag(EDITOR_TAG).performTextReplacement("One")
+        waitForIdle()
+
+        assertEquals("One", state.toText())
+        assertEquals(1, state.richParagraphList.size)
+    }
+
+    private fun runEditorTest(block: DesktopComposeUiTest.(RichTextState) -> Unit) = runDesktopComposeUiTest {
+        val state = RichTextState().apply { setHtml(SOURCE_HTML) }
+        setEditor(state)
+        assertEquals(SOURCE_TEXT, state.textFieldState.text.toString())
+        block(state)
+    }
+
+    private fun DesktopComposeUiTest.setEditor(state: RichTextState) {
+        setContent { BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth().testTag(EDITOR_TAG)) }
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(5f, 5f)) }
+        waitForIdle()
+    }
+
+    /** Places the caret, then commits [change] applied to the whole text as one rewrite. */
+    private fun DesktopComposeUiTest.rewrite(state: RichTextState, caret: Int, change: (String) -> String) {
+        state.selection = TextRange(caret)
+        waitForIdle()
+        onNodeWithTag(EDITOR_TAG).performTextReplacement(change(state.textFieldState.text.toString()))
+        waitForIdle()
+    }
+
+    private companion object {
+        const val EDITOR_TAG = "editor"
+        const val SOURCE_HTML = "<p>One <b>bold</b> word</p><p>Second line</p>"
+        const val SOURCE_TEXT = "One bold word Second line"
+    }
+}
```

---

### Incident Patch 7: `d47016dc` (2026-10-05)
**Commit Message**: fix: typing on web no longer replaces the document with one plain paragraph

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/EditPipeline.kt` (modified, +42/-1)
```diff
@@ -56,7 +56,9 @@ internal fun RichTextState.applyChangeList(buffer: TextFieldBuffer) {
             originalRange = originalRange,
             newText = buffer.asCharSequence().substring(newRange.min, newRange.max),
         )
-    }.sortedBy { it.originalRange.min }.mapNotNull { keepSeparatorUnderTrailingSpace(it) }
+    }.sortedBy { it.originalRange.min }
+        .mapNotNull { trimWholeTextRewrite(it, buffer) }
+        .mapNotNull { keepSeparatorUnderTrailingSpace(it) }
     if (deltas.isEmpty()) {
         // The whole batch was a kept separator deletion: the reconciliation puts the separator
         // back and must leave the caret in front of it, or the caret would land in the next
@@ -144,6 +146,45 @@ internal fun RichTextState.applyChangeList(buffer: TextFieldBuffer) {
     if (refreshed) clearImeEditWindow() else noteImeEdit(caret = textFieldValue.selection.min)
 }
 
+/**
+ * Compose web commits every typed character as one change from the whole old text to the whole
+ * new text. Replayed as it is, that replaces the document with a single unformatted paragraph,
+ * so such a change is cut down to the part that differs. A change over the whole text that
+ * matches the selection is a real replacement (select all, then type) and is left alone.
+ * Returns null when nothing differs.
+ */
+@OptIn(ExperimentalFoundationApi::class)
+private fun trimWholeTextRewrite(delta: InputDelta, buffer: TextFieldBuffer): InputDelta? {
+    val original = buffer.originalText
+    val coversWholeText = delta.originalRange.min == 0 && delta.originalRange.max == original.length
+    if (!coversWholeText || original.isEmpty() || delta.originalRange == buffer.originalSelection) return delta
+    return differingPart(original = original, rewritten = delta.newText, caret = buffer.selection.min)
+}
+
+/**
+ * The smallest single edit that turns [original] into [rewritten], or null when they are equal.
+ * Where it could sit in more than one place (a character typed into a run of the same one), it
+ * is the one that ends at [caret], which is where a typed character leaves the caret.
+ */
+internal fun differingPart(original: CharSequence, rewritten: CharSequence, caret: Int): InputDelta? {
+    val shorter = minOf(original.length, rewritten.length)
+    val prefix = original.commonPrefixWith(rewritten).length
+    val suffix = original.commonSuffixWith(rewritten).length.coerceAtMost(shorter - prefix)
+    if (prefix == original.length && prefix == rewritten.length) return null
+
+    // The same edit also fits anywhere down to the shortest prefix a full suffix match allows.
+    val fullSuffix = original.commonSuffixWith(rewritten).length
+    val minPrefix = (shorter - fullSuffix).coerceIn(0, prefix)
+    val shift = (rewritten.length - suffix - caret).coerceIn(0, prefix - minPrefix)
+
+    val start = prefix - shift
+    val kept = suffix + shift
+    return InputDelta(
+        originalRange = TextRange(start, original.length - kept),
+        newText = rewritten.substring(start, rewritten.length - kept),
+    )
+}
+
 /**
  * An IME puts a space after a word by replacing the character that follows it when that
  * character is already a space: Gboard selects it and commits " ", Samsung deletes it and
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/DifferingPartTest.kt` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.text.TextRange
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNull
+
+/** Unit coverage for [differingPart], the edit a whole text rewrite is cut down to. */
+class DifferingPartTest {
+
+    @Test
+    fun `equal texts differ nowhere`() {
+        assertNull(differingPart(original = "abc", rewritten = "abc", caret = 3))
+    }
+
+    @Test
+    fun `an appended character is an insertion at the end`() {
+        assertEquals(
+            InputDelta(TextRange(3), "d"),
+            differingPart(original = "abc", rewritten = "abcd", caret = 4),
+        )
+    }
+
+    @Test
+    fun `an inserted character is an insertion at its place`() {
+        assertEquals(
+            InputDelta(TextRange(1), "x"),
+            differingPart(original = "abc", rewritten = "axbc", caret = 2),
+        )
+    }
+
+    @Test
+    fun `a removed character is a deletion of it`() {
+        assertEquals(
+            InputDelta(TextRange(1, 2), ""),
+            differingPart(original = "abc", rewritten = "ac", caret = 1),
+        )
+    }
+
+    @Test
+    fun `a replaced word keeps what surrounds it`() {
+        assertEquals(
+            InputDelta(TextRange(4, 7), "new"),
+            differingPart(original = "one old two", rewritten = "one new two", caret = 7),
+        )
+    }
+
+    @Test
+    fun `a character typed into a run of the same one goes in at the caret`() {
+        assertEquals(
+            InputDelta(TextRange(1), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 2),
+        )
+        assertEquals(
+            InputDelta(TextRange(0), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 1),
+        )
+        assertEquals(
+            InputDelta(TextRange(3), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 4),
+        )
+    }
+
+    @Test
+    fun `a character deleted from a run of the same one comes out at the caret`() {
+        assertEquals(
+            InputDelta(TextRange(1, 2), ""),
+            differingPart(original = "aaa", rewritten = "aa", caret = 1),
+        )
+    }
+
+    @Test
+    fun `a caret before every placement takes the earliest one`() {
+        assertEquals(
+            InputDelta(TextRange(0), "a"),
+            differingPart(original = "aaa", rewritten = "aaaa", caret = 0),
+        )
+    }
+
+    @Test
+    fun `texts with nothing in common are replaced whole`() {
+        assertEquals(
+            InputDelta(TextRange(0, 3), "xyz"),
+            differingPart(original = "abc", rewritten = "xyz", caret = 3),
+        )
+    }
+
+    @Test
+    fun `an emptied text is a deletion of everything`() {
+        assertEquals(
+            InputDelta(TextRange(0, 3), ""),
+            differingPart(original = "abc", rewritten = "", caret = 0),
+        )
+    }
+}
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/WholeTextRewriteEditTest.kt` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.DesktopComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.click
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.test.performMouseInput
+import androidx.compose.ui.test.performTextReplacement
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.TextRange
+import com.mohamedrejeb.richeditor.model.RichTextState
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * An edit that reaches the editor as a rewrite of the whole text must only change what differs.
+ *
+ * Compose web commits every typed character that way: the text field reports one change from
+ * the whole old text to the whole new text. Replayed literally, it replaced the document with a
+ * single unformatted paragraph. The pipeline now trims such a change to the part that differs.
+ * `performTextReplacement` produces the same change shape on desktop.
+ */
+@OptIn(ExperimentalTestApi::class)
+class WholeTextRewriteEditTest {
+
+    @Test
+    fun `a character appended by a whole text rewrite keeps paragraphs and formatting`() = runEditorTest { state ->
+        rewrite(state, caret = state.textFieldState.text.length) { "${it}q" }
+
+        assertEquals("<p>One <b>bold</b> word</p><p>Second lineq</p>", state.toHtml())
+        assertEquals(TextRange(SOURCE_TEXT.length + 1), state.selection)
+    }
+
+    @Test
+    fun `a character inserted in the first paragraph keeps the rest`() = runEditorTest { state ->
+        rewrite(state, caret = 2) { it.replaceRange(2, 2, "x") }
+
+        assertEquals("<p>Onxe <b>bold</b> word</p><p>Second line</p>", state.toHtml())
+    }
+
+    @Test
+    fun `a character deleted by a whole text rewrite keeps the rest`() = runEditorTest { state ->
+        rewrite(state, caret = 4) { it.removeRange(4, 5) }
+
+        assertEquals("<p>One <b>old</b> word</p><p>Second line</p>", state.toHtml())
+    }
+
+    @Test
+    fun `typing over a select all still replaces everything`() = runEditorTest { state ->
+        state.selection = TextRange(0, state.textFieldState.text.length)
+        waitForIdle()
+
+        onNodeWithTag(EDITOR_TAG).performTextReplacement("One")
+        waitForIdle()
+
+        assertEquals("One", state.toText())
+        assertEquals(1, state.richParagraphList.size)
+    }
+
+    private fun runEditorTest(block: DesktopComposeUiTest.(RichTextState) -> Unit) = runDesktopComposeUiTest {
+        val state = RichTextState().apply { setHtml(SOURCE_HTML) }
+        setEditor(state)
+        assertEquals(SOURCE_TEXT, state.textFieldState.text.toString())
+        block(state)
+    }
+
+    private fun DesktopComposeUiTest.setEditor(state: RichTextState) {
+        setContent { BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth().testTag(EDITOR_TAG)) }
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(5f, 5f)) }
+        waitForIdle()
+    }
+
+    /** Places the caret, then commits [change] applied to the whole text as one rewrite. */
+    private fun DesktopComposeUiTest.rewrite(state: RichTextState, caret: Int, change: (String) -> String) {
+        state.selection = TextRange(caret)
+        waitForIdle()
+        onNodeWithTag(EDITOR_TAG).performTextReplacement(change(state.textFieldState.text.toString()))
+        waitForIdle()
+    }
+
+    private companion object {
+        const val EDITOR_TAG = "editor"
+        const val SOURCE_HTML = "<p>One <b>bold</b> word</p><p>Second line</p>"
+        const val SOURCE_TEXT = "One bold word Second line"
+    }
+}
```

---

### Incident Patch 8: `a44c5382` (2026-10-05)
**Commit Message**: fix: add the empty last line's anchor by replacing its separator, and correct taps on that line

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/EditPipeline.kt` (modified, +24/-2)
```diff
@@ -291,7 +291,7 @@ internal fun RichTextState.applyRichTextStyles(buffer: TextFieldBuffer) {
     val modelLength = buffer.length
     val paragraphRanges = annotated.paragraphStyles
     val trailingEmpty = trailingEmptyParagraphRange(paragraphRanges, modelLength)
-    if (trailingEmpty != null) buffer.append(EmptyLineAnchor)
+    if (trailingEmpty != null) appendEmptyLineAnchor(buffer)
 
     annotated.spanStyles.forEach { range ->
         if (range.start in 0..modelLength && range.end in 0..modelLength) {
@@ -303,11 +303,33 @@ internal fun RichTextState.applyRichTextStyles(buffer: TextFieldBuffer) {
             buffer.addStyle(range.item, range.start, range.end)
         }
     }
-    if (trailingEmpty != null) buffer.addStyle(trailingEmpty.item, modelLength, buffer.length)
+    if (trailingEmpty != null && buffer.length > modelLength) {
+        buffer.addStyle(trailingEmpty.item, modelLength, buffer.length)
+    }
 
     applyEmptyParagraphFonts(buffer, paragraphRanges, modelLength)
 }
 
+/**
+ * Adds the [EmptyLineAnchor] by replacing the separator in front of it with the separator and
+ * the anchor, not by inserting after it. BTF2 gives inserted output text two caret positions for
+ * one model position, and the first Backspace or arrow key after a tap on the line would only
+ * switch between them. A replacement maps both of its ends to distinct model offsets.
+ *
+ * An empty document has no separator to replace. Inserting is harmless there: no key can move
+ * or delete anything.
+ */
+private fun appendEmptyLineAnchor(buffer: TextFieldBuffer) {
+    val length = buffer.length
+    when {
+        length == 0 -> buffer.append(EmptyLineAnchor)
+        buffer.asCharSequence()[length - 1] == ParagraphSeparator ->
+            buffer.replace(length - 1, length, ParagraphSeparator + EmptyLineAnchor)
+    }
+}
+
+private const val ParagraphSeparator = ' '
+
 internal fun trailingEmptyParagraphRange(
     ranges: List<AnnotatedString.Range<ParagraphStyle>>,
     textLength: Int,
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/PressCaretCorrection.kt` (modified, +19/-1)
```diff
@@ -2,6 +2,7 @@ package com.mohamedrejeb.richeditor.model
 
 import androidx.compose.foundation.ExperimentalFoundationApi
 import androidx.compose.foundation.text.input.TextFieldBuffer
+import androidx.compose.ui.text.TextLayoutResult
 import androidx.compose.ui.text.TextRange
 
 /**
@@ -24,17 +25,34 @@ internal fun RichTextState.correctPressCaret(buffer: TextFieldBuffer) {
     if (singleParagraphMode || buffer.changes.changeCount != 0) return
 
     val caret = buffer.selection
-    if (!caret.collapsed || !isLaterParagraphStart(caret.start)) return
+    if (!caret.collapsed) return
 
     val layout = textLayoutResult ?: return
     if (!layout.isForModelText(buffer.length)) return
 
     val pressedLine = layout.getLineForVerticalPosition(
         press.y.coerceIn(0f, layout.size.height.toFloat())
     )
+    if (layout.isPressOnEmptyLastLine(caret.start, buffer.length, pressedLine)) {
+        buffer.selection = TextRange(buffer.length)
+        pressCorrectedCaret = buffer.length
+        return
+    }
+    if (!isLaterParagraphStart(caret.start)) return
     if (layout.getLineForOffset(caret.start) <= pressedLine) return
 
     // One back is the separator's own position, which renders at the end of the pressed line.
     buffer.selection = TextRange(caret.start - 1)
     pressCorrectedCaret = caret.start - 1
 }
+
+/**
+ * Whether a press on the empty last paragraph's line left the caret on the separator in front
+ * of it. The [EmptyLineAnchor] replaces that separator with two characters, and a hit between
+ * them maps back to the separator, which renders at the end of the line above.
+ */
+internal fun TextLayoutResult.isPressOnEmptyLastLine(caret: Int, modelLength: Int, pressedLine: Int): Boolean =
+    caret == modelLength - 1 &&
+        layoutInput.text.length > modelLength &&
+        pressedLine == lineCount - 1 &&
+        getLineForOffset(caret) < pressedLine
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +7/-1)
```diff
@@ -887,7 +887,7 @@ public class RichTextState internal constructor(
         val press = pressForCaretCorrection() ?: return
 
         val caret = textFieldState.selection
-        if (singleParagraphMode || !caret.collapsed || !isLaterParagraphStart(caret.start)) return
+        if (singleParagraphMode || !caret.collapsed) return
 
         val text = textFieldState.text.toString()
         val layout = textLayoutResult ?: return
@@ -896,6 +896,12 @@ public class RichTextState internal constructor(
         val pressedLine = layout.getLineForVerticalPosition(
             press.y.coerceIn(0f, layout.size.height.toFloat())
         )
+        if (layout.isPressOnEmptyLastLine(caret.start, text.length, pressedLine)) {
+            pressCorrectedCaret = text.length
+            setTextFieldStateFromValue(text = text, selection = TextRange(text.length))
+            return
+        }
+        if (!isLaterParagraphStart(caret.start)) return
         if (layout.getLineForOffset(caret.start) <= pressedLine) return
 
         pressCorrectedCaret = caret.start - 1
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/Issue369CaretSizeEmptyParagraphTest.kt` (modified, +111/-0)
```diff
@@ -12,6 +12,7 @@ import androidx.compose.ui.test.onNodeWithTag
 import androidx.compose.ui.test.performKeyInput
 import androidx.compose.ui.test.performMouseInput
 import androidx.compose.ui.test.performTextInput
+import androidx.compose.ui.test.performTouchInput
 import androidx.compose.ui.test.pressKey
 import androidx.compose.ui.test.runDesktopComposeUiTest
 import androidx.compose.ui.text.ParagraphStyle
@@ -161,6 +162,116 @@ class Issue369CaretSizeEmptyParagraphTest {
         assertEquals(2, layout.lineCount)
     }
 
+    @Test
+    fun `one backspace after a click on the empty last line merges it back`() = runDesktopComposeUiTest {
+        val state = editorWithEmptyLastLine()
+        clickEmptyLastLine(state)
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput { pressKey(Key.Backspace) }
+        waitForIdle()
+
+        assertEquals("text", state.toText())
+        assertEquals(TextRange(4), state.selection)
+    }
+
+    @Test
+    fun `one left arrow after a click on the empty last line leaves it`() = runDesktopComposeUiTest {
+        val state = editorWithEmptyLastLine()
+        clickEmptyLastLine(state)
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput { pressKey(Key.DirectionLeft) }
+        waitForIdle()
+
+        assertEquals(TextRange(4), state.selection)
+    }
+
+    @Test
+    fun `left then right returns to the empty last line`() = runDesktopComposeUiTest {
+        val state = editorWithEmptyLastLine()
+        clickEmptyLastLine(state)
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput {
+            pressKey(Key.DirectionLeft)
+            pressKey(Key.DirectionRight)
+        }
+        waitForIdle()
+
+        assertEquals(TextRange(5), state.selection)
+        val layout = checkNotNull(state.textLayoutResult)
+        assertEquals(layout.getLineTop(1), layout.getCursorRect(layout.layoutInput.text.length).top, 1f)
+    }
+
+    @Test
+    fun `typing after a click on the empty last line lands on it`() = runDesktopComposeUiTest {
+        val state = editorWithEmptyLastLine()
+        clickEmptyLastLine(state)
+
+        onNodeWithTag(EDITOR_TAG).performTextInput("x")
+        waitForIdle()
+
+        assertEquals("text\nx", state.toText())
+    }
+
+    @Test
+    fun `a click at the left edge of the empty last line lands on it`() = runDesktopComposeUiTest {
+        val state = editorWithEmptyLastLine()
+        clickEmptyLastLine(state, x = 0f)
+
+        assertEquals(TextRange(5), state.selection)
+    }
+
+    @Test
+    fun `a second click on the empty last line from the line above lands on it`() = runDesktopComposeUiTest {
+        val state = editorWithEmptyLastLine()
+        val layout = checkNotNull(state.textLayoutResult)
+        state.selection = TextRange(4)
+        waitForIdle()
+
+        val lastLineMiddle = (layout.getLineTop(1) + layout.getLineBottom(1)) / 2f
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(0f, lastLineMiddle)) }
+        waitForIdle()
+
+        assertEquals(TextRange(5), state.selection)
+    }
+
+    @Test
+    fun `a touch tap on the empty last line lands on it`() = runDesktopComposeUiTest {
+        val state = editorWithEmptyLastLine()
+        val layout = checkNotNull(state.textLayoutResult)
+        state.selection = TextRange(2)
+        waitForIdle()
+
+        val lastLineMiddle = (layout.getLineTop(1) + layout.getLineBottom(1)) / 2f
+        for (x in listOf(0f, 1f, 40f, 200f)) {
+            onNodeWithTag(EDITOR_TAG).performTouchInput { click(Offset(x, lastLineMiddle)) }
+            waitForIdle()
+            assertEquals(TextRange(5), state.selection, "tap at x=$x")
+            state.selection = TextRange(2)
+            waitForIdle()
+        }
+    }
+
+    private fun DesktopComposeUiTest.editorWithEmptyLastLine(): RichTextState {
+        val state = RichTextState()
+        setEditor(state)
+        onNodeWithTag(EDITOR_TAG).performTextInput("text")
+        onNodeWithTag(EDITOR_TAG).performKeyInput { pressKey(Key.Enter) }
+        waitForIdle()
+        return state
+    }
+
+    /** Clicks the first line, then the empty last one, so the caret arrives there by a click. */
+    private fun DesktopComposeUiTest.clickEmptyLastLine(state: RichTextState, x: Float = 40f) {
+        val layout = checkNotNull(state.textLayoutResult)
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(5f, layout.getLineBottom(0) / 2f)) }
+        waitForIdle()
+        assertTrue(state.selection.max < 5)
+        val lastLineMiddle = (layout.getLineTop(1) + layout.getLineBottom(1)) / 2f
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(x, lastLineMiddle)) }
+        waitForIdle()
+        assertEquals(TextRange(5), state.selection)
+    }
+
     private fun DesktopComposeUiTest.setEditor(state: RichTextState) {
         setContent {
             BasicRichTextEditor(
```

---

### Incident Patch 9: `a011308b` (2026-10-05)
**Commit Message**: fix: caret and line on an empty paragraph take the paragraph's font size

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/CaretHandleCorrection.kt` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ internal fun RichTextState.holdCaretHandleOnParagraphEnd(): Boolean {
 
     val text = textFieldState.text.toString()
     val layout = textLayoutResult ?: return false
-    if (layout.layoutInput.text.length != text.length) return false
+    if (!layout.isForModelText(text.length)) return false
 
     val step = CaretHandleStep(from = previous.start, to = caret.start, before = beforePrevious)
     if (!layout.handleIsPastParagraphEnd(step)) return false
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/EditPipeline.kt` (modified, +76/-36)
```diff
@@ -4,6 +4,8 @@ import androidx.compose.foundation.ExperimentalFoundationApi
 import androidx.compose.foundation.text.input.TextFieldBuffer
 import androidx.compose.ui.text.AnnotatedString
 import androidx.compose.ui.text.ParagraphStyle
+import androidx.compose.ui.text.SpanStyle
+import androidx.compose.ui.text.TextLayoutResult
 import androidx.compose.ui.text.TextRange
 import com.mohamedrejeb.richeditor.model.history.CommitTrigger
 
@@ -252,58 +254,96 @@ internal fun RichTextState.reconcileBufferWithModel(buffer: TextFieldBuffer) {
 }
 
 /**
- * Makes a trailing empty paragraph render its line by turning the separator space in front of it
- * into a newline in the output buffer.
+ * What the output buffer appends for a trailing empty paragraph: a zero-width space.
  *
  * The builder appends each paragraph separator inside the *previous* paragraph's range, so a
- * trailing empty paragraph gets a zero-length range at the end of the text. BTF2 styles the buffer
- * through tracked ranges and drops collapsed ones, so that paragraph renders nothing. Shifting the
- * ranges instead cannot work on an all-empty document: N empty paragraphs own only N-1 separators,
- * so one line always goes missing. A newline makes MultiParagraph split natively, no range needed.
+ * trailing empty paragraph gets a zero-length range at the end of the text, and BTF2 drops
+ * collapsed style ranges. The anchor gives that paragraph one character to carry its
+ * ParagraphStyle and its font, so its line renders with its own alignment and height.
  *
- * The substitution is output-only (the model text keeps its space) and same-length, so every style
- * offset stays valid and the caret at the end of the text lands on the new line.
- *
- * Known limitation: the trailing empty paragraph still has no range of its own, so its own
- * ParagraphStyle is not attributed until it holds a character; the substituted newline lives inside
- * the previous paragraph's range and inherits that paragraph's style. Centering an empty trailing
- * line therefore shows as a one-keystroke alignment jump: the line renders with the previous
- * paragraph's alignment until the first character turns the range non-degenerate.
+ * It is output-only and always last, so every model offset is also a valid layout offset. The
+ * layout text is one character longer than the model text while it is there, see
+ * [isForModelText].
  */
-internal fun substituteTrailingSeparatorWithNewline(
-    buffer: TextFieldBuffer,
-    ranges: List<AnnotatedString.Range<ParagraphStyle>>,
-): Boolean {
-    val last = ranges.lastOrNull() ?: return false
-    if (last.start != last.end) return false
-    if (last.start != buffer.length || buffer.length == 0) return false
-    if (buffer.asCharSequence()[buffer.length - 1] != ' ') return false
-    buffer.replace(buffer.length - 1, buffer.length, "\n")
-    return true
+internal const val EmptyLineAnchor: String = "\u200B"
+
+/** Whether this layout was computed for a model text of [modelLength] characters. */
+internal fun TextLayoutResult.isForModelText(modelLength: Int): Boolean {
+    val text = layoutInput.text.text
+    return text.length == modelLength ||
+        (text.length == modelLength + EmptyLineAnchor.length && text.endsWith(EmptyLineAnchor))
 }
 
 /**
- * Projects annotatedString's style ranges into the BTF2 output buffer. Collapsed paragraph ranges
- * are skipped, since BTF2 drops them anyway; the trailing one stands for a line that
- * [substituteTrailingSeparatorWithNewline] renders instead. A collapsed range anywhere else (a
- * shape only singleParagraphMode or a transient desync can produce) is deliberately unhandled and
- * simply dropped here. Inter-paragraph spacing comes from the caller's text style alone: each
- * paragraph range is laid out with the caller's `lineHeight` and `lineHeightStyle` as given.
+ * Projects annotatedString's style ranges into the BTF2 output buffer.
  *
- * The substitution runs before any addStyle call: TextFieldBuffer only tracks styles added after
- * the last edit, so styles emitted first would be discarded by the replace.
+ * A trailing empty paragraph has a collapsed range, which BTF2 would drop: it gets the
+ * [EmptyLineAnchor] and its ParagraphStyle on it. A collapsed range anywhere else (a shape only
+ * singleParagraphMode or a transient desync can produce) is deliberately unhandled and simply
+ * dropped here. Inter-paragraph spacing comes from the caller's text style alone: each paragraph
+ * range is laid out with the caller's `lineHeight` and `lineHeightStyle` as given.
+ *
+ * The anchor is appended before any addStyle call: TextFieldBuffer only tracks styles added
+ * after the last edit, so styles emitted first would be discarded by the append.
  */
 internal fun RichTextState.applyRichTextStyles(buffer: TextFieldBuffer) {
     val annotated = annotatedString
-    substituteTrailingSeparatorWithNewline(buffer, annotated.paragraphStyles)
+    val modelLength = b
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/ParagraphNavigation.kt` (modified, +2/-2)
```diff
@@ -52,9 +52,9 @@ internal fun RichTextState.correctTripleClickSelection(buffer: TextFieldBuffer)
 
     val press = pressForCaretCorrection() ?: return
     val layout = textLayoutResult ?: return
-    if (layout.layoutInput.text.length != buffer.length) return
+    if (!layout.isForModelText(buffer.length)) return
 
-    var offset = layout.getOffsetForPosition(press)
+    var offset = layout.getOffsetForPosition(press).coerceAtMost(buffer.length)
     // A press past the end of a line reports the next paragraph's start (see
     // [correctPressCaret]); the pressed line decides.
     val pressedLine = layout.getLineForVerticalPosition(
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/PressCaretCorrection.kt` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ internal fun RichTextState.correctPressCaret(buffer: TextFieldBuffer) {
     if (!caret.collapsed || !isLaterParagraphStart(caret.start)) return
 
     val layout = textLayoutResult ?: return
-    if (layout.layoutInput.text.length != buffer.length) return
+    if (!layout.isForModelText(buffer.length)) return
 
     val pressedLine = layout.getLineForVerticalPosition(
         press.y.coerceIn(0f, layout.size.height.toFloat())
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +7/-6)
```diff
@@ -891,7 +891,7 @@ public class RichTextState internal constructor(
 
         val text = textFieldState.text.toString()
         val layout = textLayoutResult ?: return
-        if (layout.layoutInput.text.length != text.length) return
+        if (!layout.isForModelText(text.length)) return
 
         val pressedLine = layout.getLineForVerticalPosition(
             press.y.coerceIn(0f, layout.size.height.toFloat())
@@ -3365,8 +3365,8 @@ public class RichTextState internal constructor(
                             // a boundary offset to the later paragraph, so without it the caret could
                             // never sit after the last character of a non-last paragraph. A space and
                             // not a newline, because a newline between paragraphs inside a
-                            // ParagraphStyle range renders an extra blank line (only the trailing empty
-                            // paragraph swaps one in, see substituteTrailingSeparatorWithNewline).
+                            // ParagraphStyle range renders an extra blank line (the trailing empty
+                            // paragraph gets a character of its own instead, see applyRichTextStyles).
                             if (i != richParagraphList.lastIndex && index < newText.length) {
                                 append(' ')
                                 index++
@@ -5240,10 +5240,10 @@ public class RichTextState internal constructor(
         var isParagraphUpdated = false
 
         textLayoutResult?.let { textLayoutResult ->
-            val layoutTextLength = textLayoutResult.layoutInput.text.text.length
+            val layoutTextLength = annotatedString.text.length
 
             // Skip if the layout result is stale (text changed since layout was computed)
-            if (layoutTextLength != annotatedString.text.length) return
+            if (!textLayoutResult.isForModelText(layoutTextLength)) return
 
             val multiParagraph = textLayoutResult.multiParagraph
             val offsetLimit =
@@ -5381,6 +5381,7 @@ public class RichTextState internal constructor(
     private fun getRichSpanByOffset(offset: Offset): RichSpan? {
         this.textLayoutResult?.let { textLayoutResult ->
             val position = textLayoutResult.getOffsetForPosition(offset)
+                .coerceAtMost(textFieldState.text.length)
             return getRichSpanByTextIndex(position, true)
         }
         return null
@@ -5446,7 +5447,7 @@ public class RichTextState internal constructor(
             pointer != null &&
             pointerFresh &&
             layout != null &&
-            layout.layoutInput.text.length == textFieldValue.text.length
+            layout.isForModelText(textFieldValue.text.length)
         ) {
             val pointerLine = layout.getLineForVerticalPosition(
                 pointer.y.coerceIn(0f, layout.size.height.toFloat())
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/EditPipelineStyleEmissionTest.kt` (modified, +4/-5)
```diff
@@ -10,8 +10,8 @@ import kotlin.test.assertTrue
 /**
  * Pins the paragraph-range shapes [applyRichTextStyles] emits from. The builder appends each
  * separator inside the previous paragraph's block, so only the final range can be degenerate; the
- * emission drops collapsed ranges and relies on [substituteTrailingSeparatorWithNewline] to render
- * the line the trailing one stands for.
+ * emission drops collapsed ranges and appends the [EmptyLineAnchor] to render the line the
+ * trailing one stands for.
  */
 @OptIn(ExperimentalFoundationApi::class)
 class EditPipelineStyleEmissionTest {
@@ -48,13 +48,12 @@ class EditPipelineStyleEmissionTest {
     }
 
     @Test
-    fun `emission turns the trailing separator into a newline of the same length`() {
+    fun `emission appends the anchor for a trailing empty paragraph`() {
         val state = RichTextState().setText("a\n")
         val buffer = bufferOf(state.annotatedString.text)
 
         state.applyRichTextStyles(buffer)
 
-        assertEquals("a\n", buffer.asCharSequence().toString())
-        assertEquals(state.annotatedString.text.length, buffer.length)
+        assertEquals("a $EmptyLineAnchor", buffer.asCharSequence().toString())
     }
 }
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/model/EditPipelineTrailingParagraphTest.kt` (modified, +39/-55)
```diff
@@ -7,98 +7,82 @@ import androidx.compose.ui.text.AnnotatedString
 import androidx.compose.ui.text.ParagraphStyle
 import kotlin.test.Test
 import kotlin.test.assertEquals
-import kotlin.test.assertFalse
-import kotlin.test.assertTrue
+import kotlin.test.assertNull
+import kotlin.test.assertSame
 
 /**
- * Unit coverage for [substituteTrailingSeparatorWithNewline]. The builder puts each paragraph
- * separator inside the previous paragraph's range, so a trailing empty paragraph arrives with a
- * zero-length range that BTF2 drops; the newline makes MultiParagraph render that line instead.
+ * Unit coverage for the trailing empty paragraph. The builder puts each paragraph separator
+ * inside the previous paragraph's range, so a trailing empty paragraph arrives with a zero-length
+ * range that BTF2 drops; the output buffer appends the [EmptyLineAnchor] for it instead.
  */
 @OptIn(ExperimentalFoundationApi::class)
 class EditPipelineTrailingParagraphTest {
 
     private fun range(start: Int, end: Int) =
         AnnotatedString.Range(ParagraphStyle(), start, end)
 
-    private fun bufferOf(text: String) = TextFieldState(text).toTextFieldBuffer()
+    private fun outputOf(state: RichTextState): String {
+        val buffer = TextFieldState(state.annotatedString.text).toTextFieldBuffer()
+        state.applyRichTextStyles(buffer)
+        return buffer.asCharSequence().toString()
+    }
 
     @Test
-    fun `a trailing empty paragraph turns its separator into a newline`() {
-        // "a " + "" : the empty paragraph has no separator of its own.
-        val buffer = bufferOf("a ")
+    fun `a collapsed last range at the end of the text is the trailing empty paragraph`() {
+        val ranges = listOf(range(0, 2), range(2, 2))
 
-        assertTrue(substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 2), range(2, 2))))
-        assertEquals("a\n", buffer.asCharSequence().toString())
+        assertSame(ranges.last(), trailingEmptyParagraphRange(ranges, textLength = 2))
     }
 
     @Test
-    fun `two empty paragraphs own a single separator and still render a newline`() {
-        // The all-empty document: two paragraphs share one separator space.
-        val buffer = bufferOf(" ")
+    fun `an empty document is a trailing empty paragraph`() {
+        val ranges = listOf(range(0, 0))
 
-        assertTrue(substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 1), range(1, 1))))
-        assertEquals("\n", buffer.asCharSequence().toString())
+        assertSame(ranges.last(), trailingEmptyParagraphRange(ranges, textLength = 0))
     }
 
     @Test
-    fun `the substitution keeps the buffer length so style offsets stay valid`() {
-        val buffer = bufferOf("ab ")
-
-        substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 3), range(3, 3)))
-
-        assertEquals(3, buffer.length)
+    fun `a last range that holds text is not one`() {
+        assertNull(trailingEmptyParagraphRange(listOf(range(0, 2), range(2, 3)), textLength = 3))
     }
 
     @Test
-    fun `a document without a trailing empty paragraph is left untouched`() {
-        val buffer = bufferOf("a b")
+    fun `a collapsed range before the last one is never mistaken for the trailing one`() {
+        assertNull(
+            trailingEmptyParagraphRange(listOf(range(0, 2), range(2, 2), range(2, 5)), textLength = 5)
+        )
+    }
 
-        assertFalse(substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 2), range(2, 3))))
-        assertEquals("a b", buffer.asCharSequence().toString())
-        assertEquals(0, buffer.changes.changeCount)
+    @Test
+    fun `a collapsed last range that is not at the end of the text is not one`() {
+        assertNull(trailingEmptyParagraphRange(listOf(range(0, 2), range(2, 2)), textLength = 3))
     }
 
     @Test
-    fun `an empty document is left untouched`() {
-        val buffer = bufferOf("")
+    fun `the output appends the anchor after the model text and keeps the separator`() {
+        val state = RichTextState().setText("a\n")
 
-        assertFalse(substituteTrailingSeparatorWithNewline(buffer, listOf(range(0, 0))))
-        assertEquals("", buffer.asCharSequence().toString())
+        assertEquals(state.annotatedString.text + EmptyLineAnchor, outputOf(state))
     }
 
     @Test
-    fun `a collapsed range before the last one is never mistaken for the trailing one`() {
-        val buffer = bufferOf("ab cd")
+    fun `two empty paragraphs own a single separator and the anchor`() {
+        val state = RichTextState().setText("\n")
 
-        assertFalse(
-            substituteTrailingSeparatorWithNewline(
-                buffer,
-                listOf(range(0, 2), range(2, 2), range(2, 5)),
-            )
-        )
-        assertEquals("ab cd", buffer.asCharSequence().toString())
-        assertEquals(0, buffer.changes.changeCount)
+        assertEquals(" $EmptyLineAnchor", outputOf(state))
     }
 
     @Test
-    fun `a collapsed range b
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/Issue369CaretSizeEmptyParagraphTest.kt` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.DesktopComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.click
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.test.performKeyInput
+import androidx.compose.ui.test.performMouseInput
+import androidx.compose.ui.test.performTextInput
+import androidx.compose.ui.test.pressKey
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.ParagraphStyle
+import androidx.compose.ui.text.SpanStyle
+import androidx.compose.ui.text.TextRange
+import androidx.compose.ui.text.TextStyle
+import androidx.compose.ui.text.style.TextAlign
+import androidx.compose.ui.unit.sp
+import com.mohamedrejeb.richeditor.model.EmptyLineAnchor
+import com.mohamedrejeb.richeditor.model.RichTextState
+import com.mohamedrejeb.richeditor.model.isForModelText
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+/**
+ * Issue 369: the caret on an empty paragraph fell back to the editor's base font size, then
+ * jumped to the right size on the first typed character.
+ *
+ * Cause: an empty paragraph renders no character of its own, so nothing gave its line a font.
+ * Fix: the output buffer styles the one character that stands for the empty line (its
+ * separator, or the anchor appended for a trailing empty paragraph) with the font the next
+ * typed character would have.
+ */
+@OptIn(ExperimentalTestApi::class)
+class Issue369CaretSizeEmptyParagraphTest {
+
+    @Test
+    fun `enter after big text keeps the caret big on the new empty paragraph`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        onNodeWithTag(EDITOR_TAG).performTextInput("Big")
+        waitForIdle()
+        val typedCaret = caretHeight(state)
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput { pressKey(Key.Enter) }
+        waitForIdle()
+
+        assertEquals(typedCaret, caretHeight(state), 1f)
+    }
+
+    @Test
+    fun `a staged font size on an empty editor sizes the caret`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        val baseCaret = caretHeight(state)
+
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        waitForIdle()
+
+        assertTrue(caretHeight(state) > baseCaret * 1.5f, "base=$baseCaret staged=${caretHeight(state)}")
+    }
+
+    @Test
+    fun `deleting all the big text keeps the caret big`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        onNodeWithTag(EDITOR_TAG).performTextInput("Hi")
+        waitForIdle()
+        val typedCaret = caretHeight(state)
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput {
+            pressKey(Key.Backspace)
+            pressKey(Key.Backspace)
+        }
+        waitForIdle()
+
+        assertEquals(typedCaret, caretHeight(state), 1f)
+    }
+
+    @Test
+    fun `an empty paragraph between big paragraphs has a big caret`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        state.setHtml("<p><span style=\"font-size: 40px\">One</span></p><p><span style=\"font-size: 40px\"></span></p><p><span style=\"font-size: 40px\">Two</span></p>")
+        waitForIdle()
+        state.selection = TextRange(1)
+        waitForIdle()
+        val bigCaret = caretHeight(state)
+        state.selection = TextRange(4)
+        waitForIdle()
+
+        assertEquals(bigCaret, caretHeight(state), 1f)
+    }
+
+    @Test
+    fun `removing the staged font size shrinks the caret back`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        val baseCaret = caretHeight(state)
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        waitForIdle()
+
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        waitForIdle()
+
+        assertEquals(baseCaret, caretHeight(state), 1f)
+    }
+
+    @Test
+    fun `a bigger empty last paragraph leaves the line above at its own height`() = runDesktopComposeUiTest {
+        val state = RichTextState()
+        setEditor(state)
+        onNodeWithTag(EDITOR_TAG).performTextInput("small")
+        waitForIdle()
+        val smallLine = caretHeight(state)
+        onNodeWithTag(EDITOR_TAG).performKeyInput { pressKey(Key.Enter) }
+        waitForIdle()
+
+        state.toggleSpanStyle(SpanStyle(fontSize = BIG))
+        waitForIdle()
+
+        val layout = checkNotNull(state.textLayoutResult)
+        assertEquals(smallLine, layout.getLineBottom(0) - la
```

---

### Incident Patch 10: `3ade9955` (2026-10-05)
**Commit Message**: Merge pull request #825 from MohamedRejeb/fix/issue-584-preserve-selection-on-focus-loss

feat: opt-in config to keep the selection when the editor loses focus

**File**: `docs/rich_text_state.md` (modified, +34/-0)
```diff
@@ -84,6 +84,40 @@ richTextState.selection = TextRange(0, richTextState.annotatedString.text.length
 richTextState.selection = TextRange(richTextState.annotatedString.text.length)
 ```
 
+### Selection and focus
+
+The Compose text field collapses its selection when it loses focus. A toolbar button that takes focus on click therefore finds no selection to style. There are three ways to handle this, pick the one that fits your UI.
+
+**Keep the toolbar out of the focus order.** Make each formatting control non-focusable, so the editor never loses focus. This is what the sample toolbars do:
+
+```kotlin
+IconButton(
+    onClick = { richTextState.toggleSpanStyle(SpanStyle(fontWeight = FontWeight.Bold)) },
+    modifier = Modifier.focusProperties { canFocus = false },
+) {
+    Icon(Icons.Outlined.FormatBold, contentDescription = "Bold")
+}
+```
+
+**Save and restore the selection.** For a real focus move in the same window, such as a URL field next to the editor, read the selection before focus moves and assign it back afterwards:
+
+```kotlin
+val savedSelection = richTextState.selection
+// ... focus moves to the other field, the user confirms ...
+richTextState.selection = savedSelection
+```
+
+A `Dialog` or `Popup` is a separate layer and does not take focus from the editor underneath, so the selection survives it without any of this.
+
+**Let the editor keep its selection.** Set `preserveSelectionOnFocusLoss` and the editor keeps the selected range, and its highlight, while it is unfocused:
+
+```kotlin
+@OptIn(ExperimentalRichTextApi::class)
+richTextState.config.preserveSelectionOnFocusLoss = true
+```
+
+Focusable controls can then style the selection directly. Clicking back into the editor places the caret as usual. With two editors on one screen, each keeps its own highlight, so both can show a selection at once. The flag defaults to `false` and is marked `@ExperimentalRichTextApi`: the behavior may change.
+
 ### Replacing a selection
 
 Typing, an IME commit, or a plain-text paste over a non-collapsed selection styles the inserted text from the replaced range's start (the platform typing-attributes convention), not from the character before the caret. The same goes for an IME autocorrect or suggestion pick that rewrites a word while the caret is collapsed: the new text takes the style of the first character it replaces. The restyle is part of the same edit, so undo treats the replacement as a single entry. Rich span styles are inherited only when they accept edge text and are not atomic, so replacing a whole link or image never linkifies or atomizes the typed text.
```

**File**: `richeditor-compose/api/desktop/richeditor-compose.api` (modified, +2/-0)
```diff
@@ -506,6 +506,7 @@ public final class com/mohamedrejeb/richeditor/model/RichTextConfig {
 	public final fun getListTypingShortcutsEnabled ()Z
 	public final fun getOrderedListIndent ()I
 	public final fun getOrderedListStyleType ()Lcom/mohamedrejeb/richeditor/paragraph/type/OrderedListStyleType;
+	public final fun getPreserveSelectionOnFocusLoss ()Z
 	public final fun getPreserveStyleOnEmptyLine ()Z
 	public final fun getRichClipboardEnabled ()Z
 	public final fun getUnorderedListIndent ()I
@@ -526,6 +527,7 @@ public final class com/mohamedrejeb/richeditor/model/RichTextConfig {
 	public final fun setListTypingShortcutsEnabled (Z)V
 	public final fun setOrderedListIndent (I)V
 	public final fun setOrderedListStyleType (Lcom/mohamedrejeb/richeditor/paragraph/type/OrderedListStyleType;)V
+	public final fun setPreserveSelectionOnFocusLoss (Z)V
 	public final fun setPreserveStyleOnEmptyLine (Z)V
 	public final fun setRichClipboardEnabled (Z)V
 	public final fun setUnorderedListIndent (I)V
```

**File**: `richeditor-compose/api/richeditor-compose.klib.api` (modified, +3/-0)
```diff
@@ -777,6 +777,9 @@ final class com.mohamedrejeb.richeditor.model/RichTextConfig { // com.mohamedrej
     final var orderedListStyleType // com.mohamedrejeb.richeditor.model/RichTextConfig.orderedListStyleType|{}orderedListStyleType[0]
         final fun <get-orderedListStyleType>(): com.mohamedrejeb.richeditor.paragraph.type/OrderedListStyleType // com.mohamedrejeb.richeditor.model/RichTextConfig.orderedListStyleType.<get-orderedListStyleType>|<get-orderedListStyleType>(){}[0]
         final fun <set-orderedListStyleType>(com.mohamedrejeb.richeditor.paragraph.type/OrderedListStyleType) // com.mohamedrejeb.richeditor.model/RichTextConfig.orderedListStyleType.<set-orderedListStyleType>|<set-orderedListStyleType>(com.mohamedrejeb.richeditor.paragraph.type.OrderedListStyleType){}[0]
+    final var preserveSelectionOnFocusLoss // com.mohamedrejeb.richeditor.model/RichTextConfig.preserveSelectionOnFocusLoss|{}preserveSelectionOnFocusLoss[0]
+        final fun <get-preserveSelectionOnFocusLoss>(): kotlin/Boolean // com.mohamedrejeb.richeditor.model/RichTextConfig.preserveSelectionOnFocusLoss.<get-preserveSelectionOnFocusLoss>|<get-preserveSelectionOnFocusLoss>(){}[0]
+        final fun <set-preserveSelectionOnFocusLoss>(kotlin/Boolean) // com.mohamedrejeb.richeditor.model/RichTextConfig.preserveSelectionOnFocusLoss.<set-preserveSelectionOnFocusLoss>|<set-preserveSelectionOnFocusLoss>(kotlin.Boolean){}[0]
     final var preserveStyleOnEmptyLine // com.mohamedrejeb.richeditor.model/RichTextConfig.preserveStyleOnEmptyLine|{}preserveStyleOnEmptyLine[0]
         final fun <get-preserveStyleOnEmptyLine>(): kotlin/Boolean // com.mohamedrejeb.richeditor.model/RichTextConfig.preserveStyleOnEmptyLine.<get-preserveStyleOnEmptyLine>|<get-preserveStyleOnEmptyLine>(){}[0]
         final fun <set-preserveStyleOnEmptyLine>(kotlin/Boolean) // com.mohamedrejeb.richeditor.model/RichTextConfig.preserveStyleOnEmptyLine.<set-preserveStyleOnEmptyLine>|<set-preserveStyleOnEmptyLine>(kotlin.Boolean){}[0]
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextConfig.kt` (modified, +12/-0)
```diff
@@ -200,6 +200,18 @@ public class RichTextConfig internal constructor(
      */
     public var listTypingShortcutsEnabled: Boolean = true
 
+    /**
+     * Whether the editor keeps its selection when it loses focus.
+     *
+     * The Compose text field collapses the selection as soon as focus moves to another
+     * focusable, so a focusable toolbar button finds nothing to style. When true the editor
+     * keeps the range, and its highlight, while it is unfocused.
+     *
+     * Default is `false`.
+     */
+    @ExperimentalRichTextApi
+    public var preserveSelectionOnFocusLoss: Boolean = false
+
     /**
      * Whether copy and paste carry rich text (HTML) formatting.
      *
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +29/-0)
```diff
@@ -300,6 +300,34 @@ public class RichTextState internal constructor(
      */
     internal var isFocused: Boolean = false
 
+    internal fun onFocusChanged(focused: Boolean) {
+        isFocused = focused
+        if (!focused) restoreSelectionCollapsedByFocusLoss()
+    }
+
+    /**
+     * The range a user selection change just collapsed to its end, the shape of the collapse
+     * the text field makes when it loses focus (CMP-2569). A focus loss reports through
+     * [onFocusChanged] in the same dispatch; the editor clears a range still pending a frame
+     * later, since that collapse was the user's own. Only set under
+     * [RichTextConfig.preserveSelectionOnFocusLoss].
+     */
+    internal var selectionCollapsedToEndFrom: TextRange? by mutableStateOf(null)
+
+    internal fun noteUserSelectionChange(original: TextRange, current: TextRange, textChanged: Boolean) {
+        if (!config.preserveSelectionOnFocusLoss) return
+        val collapsedToEnd = !textChanged && !original.collapsed && current == TextRange(original.max)
+        selectionCollapsedToEndFrom = if (collapsedToEnd) original else null
+    }
+
+    private fun restoreSelectionCollapsedByFocusLoss() {
+        val lost = selectionCollapsedToEndFrom ?: return
+        selectionCollapsedToEndFrom = null
+        if (lost.max > textFieldState.text.length) return
+        if (textFieldState.selection != TextRange(lost.max)) return
+        setTextFieldStateFromValue(text = textFieldState.text.toString(), selection = lost)
+    }
+
     /**
      * Set when the editor receives a copy, cut or paste shortcut key press. Key events only
      * reach the top layer, so the web clipboard handlers use it to tell a shortcut pressed in
@@ -5669,6 +5697,7 @@ public class RichTextState internal constructor(
         richTextState.config.preserveStyleOnEmptyLine = config.preserveStyleOnEmptyLine
         richTextState.config.exitListOnEmptyItem = config.exitListOnEmptyItem
         richTextState.config.listTypingShortcutsEnabled = config.listTypingShortcutsEnabled
+        richTextState.config.preserveSelectionOnFocusLoss = config.preserveSelectionOnFocusLoss
         richTextState.config.features = config.features
 
         return richTextState
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/ui/BasicRichTextEditor.kt` (modified, +13/-1)
```diff
@@ -275,6 +275,17 @@ public fun BasicRichTextEditor(
             .collect { composition -> state.handleCompositionChanged(composition) }
     }
 
+    // A focus loss consumes the range in the dispatch that set it; one still pending a
+    // frame later came from the user collapsing the selection.
+    LaunchedEffect(state) {
+        snapshotFlow { state.selectionCollapsedToEndFrom }
+            .collect { collapsedFrom ->
+                if (collapsedFrom == null) return@collect
+                withFrameNanos { }
+                state.selectionCollapsedToEndFrom = null
+            }
+    }
+
     LaunchedEffect(singleParagraph) {
         state.singleParagraphMode = singleParagraph
     }
@@ -353,7 +364,7 @@ public fun BasicRichTextEditor(
             state = state.textFieldState,
             modifier = modifier
                 .onFocusChanged { focusState ->
-                    state.isFocused = focusState.isFocused
+                    state.onFocusChanged(focusState.isFocused)
                 }
                 .onPreviewKeyEvent { event ->
                     if (event.isClipboardShortcutKeyDown())
@@ -437,6 +448,7 @@ public fun BasicRichTextEditor(
                 state.selectionBeforeUserSelectionChange = originalSelection
                 @OptIn(ExperimentalFoundationApi::class)
                 val textChanged = changes.changeCount > 0
+                state.noteUserSelectionChange(originalSelection, selection, textChanged)
                 if (readOnly && textChanged) {
                     revertAllChanges()
                     return@InputTransformation
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/Issue584SelectionOnFocusLossTest.kt` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.clickable
+import androidx.compose.foundation.focusable
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.size
+import androidx.compose.foundation.text.BasicTextField
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.focus.FocusRequester
+import androidx.compose.ui.focus.focusRequester
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.DesktopComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.click
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.test.performKeyInput
+import androidx.compose.ui.test.performMouseInput
+import androidx.compose.ui.test.pressKey
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.SpanStyle
+import androidx.compose.ui.text.TextRange
+import androidx.compose.ui.text.font.FontWeight
+import androidx.compose.ui.unit.dp
+import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
+import com.mohamedrejeb.richeditor.model.RichTextState
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+/**
+ * Issue 584: the selection is cleared when the editor loses focus, so a focusable toolbar
+ * button cannot style it.
+ *
+ * Cause: the Compose text field collapses its selection to the end when it loses focus
+ * (CMP-2569). Fix: with `RichTextConfig.preserveSelectionOnFocusLoss` the editor puts the
+ * range back as soon as it sees the focus loss. The default keeps the Compose behavior.
+ */
+@OptIn(ExperimentalTestApi::class, ExperimentalRichTextApi::class)
+class Issue584SelectionOnFocusLossTest {
+
+    @Test
+    fun `by default the selection collapses when focus moves away`() = runDesktopComposeUiTest {
+        val state = editorState(preserve = false)
+        val otherFocus = FocusRequester()
+        setContent { EditorWithFocusable(state, otherFocus = otherFocus) }
+        focusEditorAndSelect(state)
+
+        runOnIdle { otherFocus.requestFocus() }
+        waitForIdle()
+
+        assertFalse(state.isFocused)
+        assertEquals(TextRange(SELECTED.max), state.selection)
+    }
+
+    @Test
+    fun `the selection survives focus moving to another focusable`() = runDesktopComposeUiTest {
+        val state = editorState()
+        val otherFocus = FocusRequester()
+        setContent { EditorWithFocusable(state, otherFocus = otherFocus) }
+        focusEditorAndSelect(state)
+
+        runOnIdle { otherFocus.requestFocus() }
+        waitForIdle()
+
+        assertFalse(state.isFocused)
+        assertEquals(SELECTED, state.selection)
+    }
+
+    @Test
+    fun `a focusable toolbar button styles the selected range`() = runDesktopComposeUiTest {
+        val state = editorState()
+        setContent {
+            Column {
+                BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth().testTag(EDITOR_TAG))
+                Box(
+                    Modifier
+                        .size(40.dp)
+                        .testTag(BUTTON_TAG)
+                        .clickable { state.toggleSpanStyle(SpanStyle(fontWeight = FontWeight.Bold)) }
+                )
+            }
+        }
+        focusEditorAndSelect(state)
+
+        onNodeWithTag(BUTTON_TAG).performMouseInput { click() }
+        waitForIdle()
+
+        assertFalse(state.isFocused)
+        assertEquals(SELECTED, state.selection)
+        assertTrue("<b>Hello</b>" in state.toHtml(), state.toHtml())
+    }
+
+    @Test
+    fun `the selection survives focus moving to another text field`() = runDesktopComposeUiTest {
+        val state = editorState()
+        setContent {
+            Column {
+                BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth().testTag(EDITOR_TAG))
+                var url by remember { mutableStateOf("") }
+                BasicTextField(
+                    value = url,
+                    onValueChange = { url = it },
+                    modifier = Modifier.fillMaxWidth().testTag(FIELD_TAG),
+                )
+            }
+        }
+        focusEditorAndSelect(state)
+
+        onNodeWithTag(FIELD_TAG).performMouseInput { click() }
+        waitForIdle()
+
+        assertFalse(state.isFocused)
+        assertEquals(SELECTED, state.selection)
+    }
+
+    @Test
+    fun `the selection is still there when focus returns to the editor`() = runDesktopComposeUiTest
```

**File**: `sample/common/src/commonMain/kotlin/com/mohamedrejeb/richeditor/sample/common/lab/EditorLabScreen.kt` (modified, +21/-1)
```diff
@@ -67,13 +67,18 @@ fun EditorLabScreen(navigateBack: () -> Unit) {
     var loadedScenarioName by rememberSaveable { mutableStateOf<String?>(null) }
     var readOnly by rememberSaveable { mutableStateOf(false) }
     var featuresName by rememberSaveable { mutableStateOf(LabFeatures.All.name) }
+    var keepSelection by rememberSaveable { mutableStateOf(false) }
     val scenario = LabScenario.valueOf(scenarioName)
     val features = LabFeatures.valueOf(featuresName)
 
     LaunchedEffect(state, features) {
         state.config.features = features.features
     }
 
+    LaunchedEffect(state, keepSelection) {
+        state.config.preserveSelectionOnFocusLoss = keepSelection
+    }
+
     LaunchedEffect(state, scenario) {
         if (loadedScenarioName != scenario.name) {
             state.setHtml(scenario.html)
@@ -113,8 +118,21 @@ fun EditorLabScreen(navigateBack: () -> Unit) {
                 selected = features,
                 onSelect = { featuresName = it.name },
             )
+            // The paste field at the bottom takes the focus from the editor for this check.
+            FilterChip(
+                selected = keepSelection,
+                onClick = { keepSelection = !keepSelection },
+                label = { Text("Keep selection on focus loss") },
+                modifier = Modifier.focusProperties { canFocus = false },
+            )
             LabEditor(state = state, scenario = scenario, readOnly = readOnly)
-            StateReadout(state = state, pageScroll = pageScroll, readOnly = readOnly, features = features)
+            StateReadout(
+                state = state,
+                pageScroll = pageScroll,
+                readOnly = readOnly,
+                features = features,
+                keepSelection = keepSelection,
+            )
             LabLogPanel(log = log)
             PasteTarget()
             Spacer(Modifier.height(24.dp))
@@ -231,10 +249,12 @@ private fun StateReadout(
     pageScroll: ScrollState,
     readOnly: Boolean,
     features: LabFeatures,
+    keepSelection: Boolean,
 ) {
     val lines = listOf(
         "read only      $readOnly",
         "features       ${features.name}",
+        "keep selection $keepSelection",
         "selection      ${state.selection.describe()}",
         "composition    ${state.composition?.describe() ?: "none"}",
         "bold           ${state.isBold()}",
```

---

### Incident Patch 11: `6036bc63` (2026-10-04)
**Commit Message**: Merge pull request #822 from MohamedRejeb/fix/issue-482-markdown-image-in-link

fix: a Markdown link label is parsed, so an image or bold text inside a link works

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/markdown/MarkdownUtils.kt` (modified, +21/-7)
```diff
@@ -282,13 +282,27 @@ private fun encodeMarkdownNodeToRichText(
 
         MarkdownElementTypes.INLINE_LINK -> {
             onOpenNode(node)
-            val text = node
-                .findChildOfType(MarkdownElementTypes.LINK_TEXT)
-                ?.getTextInNode(markdown)
-                ?.drop(1)
-                ?.dropLast(1)
-                ?.toString()
-            onText(text ?: "")
+            val linkText = node.findChildOfType(MarkdownElementTypes.LINK_TEXT)
+            if (node.parent?.type == MarkdownElementTypes.IMAGE) {
+                // The label of an image is its alt text, taken as written.
+                onText(linkText?.getTextInNode(markdown)?.drop(1)?.dropLast(1)?.toString() ?: "")
+            } else {
+                // The label of a link is inline content: an image, bold, code and so on.
+                val children = linkText?.children.orEmpty().toMutableList()
+                children.removeFirstOrNull()
+                children.removeLastOrNull()
+                children.fastForEach { child ->
+                    encodeMarkdownNodeToRichText(
+                        node = child,
+                        markdown = markdown,
+                        onOpenNode = onOpenNode,
+                        onCloseNode = onCloseNode,
+                        onText = onText,
+                        onHtmlTag = onHtmlTag,
+                        onHtmlBlock = onHtmlBlock,
+                    )
+                }
+            }
             onCloseNode(node)
         }
 
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/markdown/RichTextStateMarkdownParser.kt` (modified, +24/-12)
```diff
@@ -284,13 +284,20 @@ internal object RichTextStateMarkdownParser : RichTextStateParser<String> {
                         currentRichSpan?.paragraph?.children?.remove(currentRichSpan)
                 }
 
-                // Merge spans with only one child
-                if (currentRichSpan?.text?.isEmpty() == true && currentRichSpan?.children?.size == 1) {
-                    currentRichSpan?.children?.firstOrNull()?.let { child ->
+                // Merge spans with only one child. A span holds one rich span style, so a
+                // link around an image or a code span has to stay two nested spans.
+                val onlyChild = currentRichSpan?.children?.singleOrNull()
+                if (
+                    currentRichSpan?.text?.isEmpty() == true &&
+                    onlyChild != null &&
+                    (currentRichSpan?.richSpanStyle is RichSpanStyle.Default || onlyChild.richSpanStyle is RichSpanStyle.Default)
+                ) {
+                    onlyChild.let { child ->
                         currentRichSpan?.text = child.text
                         currentRichSpan?.spanStyle =
                             currentRichSpan?.spanStyle?.merge(child.spanStyle) ?: child.spanStyle
-                        currentRichSpan?.richSpanStyle = child.richSpanStyle
+                        if (child.richSpanStyle !is RichSpanStyle.Default)
+                            currentRichSpan?.richSpanStyle = child.richSpanStyle
                         currentRichSpan?.children?.clear()
                         currentRichSpan?.children?.addAll(child.children)
                         // The grandchildren now belong to the surviving span.
@@ -543,15 +550,20 @@ internal object RichTextStateMarkdownParser : RichTextStateParser<String> {
         if (!isBlank && markdownOpen.isNotEmpty())
             stringBuilder.append(markdownOpen.joinToString(separator = ""))
 
-        // Apply rich span style to markdown
-        val spanMarkdown = decodeMarkdownElementFromRichSpan(richSpan.text, richSpan.richSpanStyle)
-
-        // Append text
-        stringBuilder.append(spanMarkdown)
+        val childrenMarkdown = buildString {
+            richSpan.children.fastForEach { child ->
+                append(decodeRichSpanToMarkdown(child, isHeading = isHeading))
+            }
+        }
 
-        // Append children
-        richSpan.children.fastForEach { child ->
-            stringBuilder.append(decodeRichSpanToMarkdown(child, isHeading = isHeading))
+        // A link's label is everything inside it, so its children go between the brackets.
+        if (richSpan.richSpanStyle is RichSpanStyle.Link) {
+            stringBuilder.append(
+                decodeMarkdownElementFromRichSpan(richSpan.text + childrenMarkdown, richSpan.richSpanStyle)
+            )
+        } else {
+            stringBuilder.append(decodeMarkdownElementFromRichSpan(richSpan.text, richSpan.richSpanStyle))
+            stringBuilder.append(childrenMarkdown)
         }
 
         // Append markdown close
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/parser/markdown/Issue482LinkedImageMarkdownTest.kt` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+package com.mohamedrejeb.richeditor.parser.markdown
+
+import androidx.compose.ui.text.font.FontWeight
+import com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi
+import com.mohamedrejeb.richeditor.model.RichSpan
+import com.mohamedrejeb.richeditor.model.RichSpanStyle
+import com.mohamedrejeb.richeditor.model.RichTextState
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNotNull
+
+/**
+ * Issue 482: a Markdown image wrapped in a link, the usual README badge
+ * (`[![alt](image)](url)`), was imported as a link showing the raw image markup.
+ *
+ * Cause: the link handler emitted the text between the brackets as is instead of parsing it,
+ * so nothing inside a link label was interpreted: no image, and no bold or italic either.
+ * Fix: the label is walked like any other inline content, a link keeps its own span when its
+ * only child carries another rich span style, and the Markdown writer puts a link's children
+ * inside the brackets.
+ */
+@OptIn(ExperimentalRichTextApi::class)
+class Issue482LinkedImageMarkdownTest {
+
+    private fun RichTextState.spans(): List<RichSpan> {
+        val result = mutableListOf<RichSpan>()
+        fun visit(span: RichSpan) {
+            result += span
+            span.children.forEach(::visit)
+        }
+        richParagraphList.forEach { it.children.forEach(::visit) }
+        return result
+    }
+
+    private fun RichSpan.enclosingLink(): RichSpanStyle.Link? =
+        generateSequence(this) { it.parent }.firstNotNullOfOrNull { it.richSpanStyle as? RichSpanStyle.Link }
+
+    @Test
+    fun `an image inside a link is an image that links`() {
+        val state = RichTextState().apply {
+            setMarkdown("[![Kotlin](https://img.example/kotlin.svg)](https://kotlinlang.org)")
+        }
+
+        val imageSpan = assertNotNull(state.spans().firstOrNull { it.richSpanStyle is RichSpanStyle.Image })
+        val image = imageSpan.richSpanStyle as RichSpanStyle.Image
+        assertEquals("https://img.example/kotlin.svg", image.model)
+        assertEquals("Kotlin", image.contentDescription)
+        assertEquals("https://kotlinlang.org", imageSpan.enclosingLink()?.url)
+        assertFalse(state.toText().contains("!["), "the image markup must not show as text: ${state.toText()}")
+    }
+
+    @Test
+    fun `two badges on consecutive lines are two linked images`() {
+        val state = RichTextState().apply {
+            setMarkdown(
+                "[![Kotlin](https://img.example/kotlin.svg)](https://kotlinlang.org)\n" +
+                    "[![Compose](https://img.example/compose.svg)](https://www.jetbrains.com/lp/compose-multiplatform)"
+            )
+        }
+
+        val images = state.spans().filter { it.richSpanStyle is RichSpanStyle.Image }
+        assertEquals(
+            listOf("https://kotlinlang.org", "https://www.jetbrains.com/lp/compose-multiplatform"),
+            images.map { it.enclosingLink()?.url },
+        )
+    }
+
+    @Test
+    fun `a linked image survives a markdown round trip`() {
+        val markdown = "[![Kotlin](https://img.example/kotlin.svg)](https://kotlinlang.org)"
+        val state = RichTextState().apply { setMarkdown(markdown) }
+
+        assertEquals(markdown, state.toMarkdown())
+    }
+
+    @Test
+    fun `a link with formatted parts in its label survives a markdown round trip`() {
+        val markdown = "[**bold** text](https://example.com)"
+        val state = RichTextState().apply { setMarkdown(markdown) }
+
+        assertEquals(markdown, state.toMarkdown())
+    }
+
+    @Test
+    fun `bold inside a link label is applied`() {
+        val state = RichTextState().apply { setMarkdown("[**bold** text](https://example.com)") }
+
+        assertEquals("bold text", state.toText())
+        val bold = assertNotNull(state.spans().firstOrNull { it.text == "bold" })
+        assertEquals(FontWeight.Bold, bold.fullSpanStyle.fontWeight)
+        assertEquals("https://example.com", bold.enclosingLink()?.url)
+        assertEquals("https://example.com", state.spans().first { it.text.contains("text") }.enclosingLink()?.url)
+    }
+
+    @Test
+    fun `a link whose whole label is bold or code stays a link`() {
+        val bold = RichTextState().apply { setMarkdown("[**bold**](https://example.com)") }
+        val boldSpan = bold.spans().first { it.text == "bold" }
+        assertEquals(FontWeight.Bold, boldSpan.fullSpanStyle.fontWeight)
+        assertEquals("https://example.com", boldSpan.enclosingLink()?.url)
+
+        val code = RichTextState().apply { setMarkdown("[`code`](https://example.com)") }
+        val codeSpan = code.spans().first { it.text == "code" }
+        assertEquals("https://example.com", codeSpan.enclosingLink()?.url)
+        assertNotNull(generateSequence(codeSpan) { it.parent }.firstOrNull { it.richSpanStyle is RichSpanStyle.Code })
+    }
+
+    @Test
+    fun `a plain link and a plain
```

---

### Incident Patch 12: `ab332761` (2026-10-04)
**Commit Message**: Merge pull request #820 from MohamedRejeb/chore/fix-doc-errors

docs: correct token attributes, inline style support, image rendering and add missing notes

**File**: `docs/faq.md` (modified, +19/-0)
```diff
@@ -70,6 +70,25 @@ CompositionLocalProvider(LocalUriHandler provides myUriHandler) {
 
 `RichTextEditorDecorationBox` and `OutlinedRichTextEditorDecorationBox` (in `RichTextEditorDefaults`) have overloads that accept a `visualTransformation` parameter. Those overloads are deprecated: the editor renders its styled output through an `OutputTransformation` it installs on the text field itself, so the parameter is no longer applied and has no effect. Switch to the overload without `visualTransformation`.
 
+### How do I react to changes? There is no `onValueChange`
+
+The editor is state based, like Compose's `BasicTextField(state)`, so there is no `value` / `onValueChange` pair. Observe the state instead:
+
+```kotlin
+LaunchedEffect(richTextState) {
+    snapshotFlow { richTextState.annotatedString }
+        .collect { onHtmlChanged(richTextState.toHtml()) }
+}
+```
+
+This also fires for your own `setHtml` calls. If you write the value back into the editor, only do so when it differs from what the editor already holds, otherwise the two will feed each other:
+
+```kotlin
+LaunchedEffect(html) {
+    if (html != richTextState.toHtml()) richTextState.setHtml(html)
+}
+```
+
 ### How do I save/restore editor content?
 
 You can convert the editor content to HTML or Markdown for storage:
```

**File**: `docs/html_import_export.md` (modified, +3/-3)
```diff
@@ -30,7 +30,7 @@ val complexHtml = """
             <li>Ordered list item 2</li>
         </ol>
         <p>Link to <a href="https://example.com">Example</a></p>
-        <pre><code>Code block example</code></pre>
+        <p>Inline <code>code</code> example</p>
     </div>
 """
 richTextState.setHtml(complexHtml)
@@ -70,7 +70,7 @@ The following HTML tags are supported:
 
 ### Rich Content
 - `<img src="..." width="..." height="..." alt="...">` - Inline images (see [Images](images.md))
-- `<span data-trigger-id="..." data-token-id="...">` - Mention/hashtag/command tokens (see [Mentions & Triggers](mentions_and_triggers.md))
+- `<span data-trigger="..." data-id="...">` - Mention/hashtag/command tokens (see [Mentions & Triggers](mentions_and_triggers.md))
 
 ## Line breaks and empty blocks
 
@@ -89,6 +89,6 @@ HTML saved by earlier versions of the library, which wrote empty paragraphs as b
 
 - Unsupported HTML tags will be ignored during import
 - Nested lists are supported
-- Custom styles (using style attribute) are not currently supported
+- Inline `style` attributes are read for these properties: `color`, `background` / `background-color`, `font-size`, `font-weight`, `font-style`, `letter-spacing`, `text-decoration`, `text-shadow`, `baseline-shift`, `text-align`, `direction`, `line-height` and `text-indent`. `<style>` blocks and class selectors are not supported
 - The HTML output is clean and properly formatted
 - Register triggers **before** calling `setHtml` with content that contains tokens, otherwise tokens fall back to plain text
```

**File**: `docs/images.md` (modified, +3/-3)
```diff
@@ -2,9 +2,9 @@
 
 The Rich Text Editor supports **inline images** via the `RichSpanStyle.Image`
 span, with pluggable loading through the `ImageLoader` interface. Images render
-inside the editor's text flow as atomic inline content, round-trip through HTML
-(`<img>`), and are automatically clamped to the editor's container width so
-oversized sources don't overflow the layout.
+in the read-only `RichText` as atomic inline content, round-trip through HTML
+(`<img>`), and are automatically clamped to the container width so oversized
+sources don't overflow the layout.
 
 > **Note:** The image APIs are marked `@ExperimentalRichTextApi` and may change
 > in a future release. Images currently render in the read-only `RichText` view;
```

**File**: `docs/markdown_import_export.md` (modified, +1/-0)
```diff
@@ -77,4 +77,5 @@ The following Markdown syntax elements are supported:
 - Nested lists are supported with proper indentation
 - The Markdown output is clean and properly formatted
 - Markdown has no native width/height syntax for images, so explicit dimensions are lost in a Markdown round-trip. Use HTML if you need to preserve them
+- HTML inside Markdown is partly supported: inline formatting tags such as `<b>`, `<i>`, `<u>`, `<br>` and `<span>` are applied, and block-level HTML is passed to the HTML parser. Inline `<a>` and `<img>` tags are not converted to links or images
 - Tables are planned for future releases
```

**File**: `docs/mentions_and_triggers.md` (modified, +2/-2)
```diff
@@ -292,8 +292,8 @@ so server-side rendering stays consistent.
 
 ### HTML
 
-Committed tokens are serialized as `<span>` elements carrying `data-trigger-id`
-and `data-token-id` attributes. On `setHtml`, unknown trigger ids render as
+Committed tokens are serialized as `<span>` elements carrying `data-trigger`
+and `data-id` attributes. On `setHtml`, unknown trigger ids render as
 plain text - so make sure to `registerTrigger(...)` **before** loading content
 that contains tokens.
 
```

**File**: `docs/paragraph_style.md` (modified, +0/-1)
```diff
@@ -3,7 +3,6 @@
 The Rich Text Editor provides comprehensive support for paragraph styling, allowing you to control:
 - Text alignment
 - Line spacing
-- Paragraph spacing
 - Text direction
 - Text indentation
 
```

**File**: `docs/rich_text_state.md` (modified, +9/-0)
```diff
@@ -134,6 +134,15 @@ richTextState.setHtml(savedHtml)
 richTextState.setMarkdown(savedMarkdown)
 ```
 
+### Exporting a Range
+
+`toText`, `toHtml`, `toMarkdown` and `toRichTextDocument` also take a `TextRange` and export only that part of the content with its formatting. Pass the selection to get what the user selected:
+
+```kotlin
+val selectedHtml = richTextState.toHtml(richTextState.selection)
+val selectedMarkdown = richTextState.toMarkdown(richTextState.selection)
+```
+
 ## Undo / Redo
 
 `RichTextState` ships its own undo/redo stack that snapshots the full rich-text
```

---

### Incident Patch 13: `02ecf775` (2026-10-04)
**Commit Message**: Merge pull request #821 from MohamedRejeb/fix/issue-479-html-before-body

fix: HTML content before the body tag is kept on import

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/parser/html/RichTextStateHtmlParser.kt` (modified, +0/-7)
```diff
@@ -137,13 +137,6 @@ internal object RichTextStateHtmlParser : RichTextStateParser<String> {
                     return@onOpenTag
                 }
 
-                if (name == "body") {
-                    stringBuilder.clear()
-                    richParagraphList.clear()
-                    richParagraphList.add(RichParagraph())
-                    currentRichSpan = null
-                }
-
                 val cssStyleMap = attributes["style"]?.let { CssEncoder.parseCssStyle(it) } ?: emptyMap()
                 val cssSpanStyle = CssEncoder.parseCssStyleMapToSpanStyle(cssStyleMap)
                 val tagSpanStyle = htmlElementsSpanStyleEncodeMap[name]
```

**File**: `richeditor-compose/src/commonTest/kotlin/com/mohamedrejeb/richeditor/parser/html/Issue479HtmlOutsideBodyTest.kt` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+package com.mohamedrejeb.richeditor.parser.html
+
+import com.mohamedrejeb.richeditor.model.RichTextState
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * Issue 479: HTML content placed before the `<body>` tag was dropped on import.
+ *
+ * Cause: the parser cleared everything it had collected when it reached `<body>`. That reset
+ * was meant to discard the document head, but `head`, `title`, `style` and `script` are
+ * already skipped on their own. Fix: the reset is gone, so content before, inside and after
+ * `<body>` is all kept.
+ */
+class Issue479HtmlOutsideBodyTest {
+
+    private fun textOf(html: String): String = RichTextState().apply { setHtml(html) }.toText()
+
+    @Test
+    fun `text before the body tag is kept`() {
+        assertEquals("before\ninside", textOf("<p>before</p><body><p>inside</p></body>"))
+    }
+
+    @Test
+    fun `bare text before the body tag is kept`() {
+        assertEquals("before\ninside", textOf("before<body><p>inside</p></body>"))
+    }
+
+    @Test
+    fun `text after the body tag is kept`() {
+        assertEquals("inside\nafter", textOf("<body><p>inside</p></body><p>after</p>"))
+    }
+
+    @Test
+    fun `the document head is still skipped`() {
+        val html = "<html><head><title>Title</title><style>p { color: red; }</style>" +
+            "<script>var a = 1;</script></head><body><p>inside</p></body></html>"
+
+        assertEquals("inside", textOf(html))
+    }
+
+    @Test
+    fun `formatting before the body tag is kept`() {
+        val state = RichTextState().apply { setHtml("<p><b>bold</b></p><body><p>inside</p></body>") }
+
+        assertEquals("<p><b>bold</b></p><p>inside</p>", state.toHtml())
+    }
+}
```

---

### Incident Patch 14: `08c7699f` (2026-10-04)
**Commit Message**: Merge pull request #818 from MohamedRejeb/fix/issue-715-web-paste-behind-dialog

fix: a web paste, copy or cut in a dialog is no longer taken by the editor behind it

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +7/-0)
```diff
@@ -300,6 +300,13 @@ public class RichTextState internal constructor(
      */
     internal var isFocused: Boolean = false
 
+    /**
+     * Set when the editor receives a copy, cut or paste shortcut key press. Key events only
+     * reach the top layer, so the web clipboard handlers use it to tell a shortcut pressed in
+     * the editor from one pressed in a dialog above it.
+     */
+    internal var sawClipboardShortcutKey: Boolean = false
+
     /**
      * The annotated string representing the rich text.
      */
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/ui/BasicRichTextEditor.kt` (modified, +21/-0)
```diff
@@ -24,7 +24,13 @@ import androidx.compose.ui.geometry.Offset
 import androidx.compose.ui.graphics.Brush
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.SolidColor
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.input.key.KeyEvent
 import androidx.compose.ui.input.key.KeyEventType
+import androidx.compose.ui.input.key.isCtrlPressed
+import androidx.compose.ui.input.key.isMetaPressed
+import androidx.compose.ui.input.key.isShiftPressed
+import androidx.compose.ui.input.key.key
 import androidx.compose.ui.input.key.onPreviewKeyEvent
 import androidx.compose.ui.input.key.type
 import androidx.compose.ui.input.pointer.PointerEventPass
@@ -350,6 +356,9 @@ public fun BasicRichTextEditor(
                     state.isFocused = focusState.isFocused
                 }
                 .onPreviewKeyEvent { event ->
+                    if (event.isClipboardShortcutKeyDown())
+                        state.sawClipboardShortcutKey = true
+
                     if (readOnly) {
                         // The selection keys still work in a read-only editor, and the state
                         // tells their changes from gestures by the key press.
@@ -466,6 +475,18 @@ public fun BasicRichTextEditor(
     }
 }
 
+/** Ctrl or Cmd with C, X or V, and the Insert and Delete forms (Ctrl+Insert, Shift+Insert, Shift+Delete). */
+private fun KeyEvent.isClipboardShortcutKeyDown(): Boolean {
+    if (type != KeyEventType.KeyDown) return false
+    val command = isCtrlPressed || isMetaPressed
+    return when (key) {
+        Key.C, Key.X, Key.V -> command
+        Key.Insert -> command || isShiftPressed
+        Key.Delete -> isShiftPressed
+        else -> false
+    }
+}
+
 private fun computeLineLimits(
     singleLine: Boolean,
     minLines: Int,
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/Issue715ClipboardShortcutRoutingTest.kt` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.text.BasicTextField
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.click
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.test.performKeyInput
+import androidx.compose.ui.test.performMouseInput
+import androidx.compose.ui.test.pressKey
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.window.Dialog
+import com.mohamedrejeb.richeditor.model.RichTextState
+import kotlin.test.Test
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+/**
+ * Issue 715: on web, a paste into a text field inside a dialog was taken by the editor behind
+ * the dialog.
+ *
+ * Cause: a dialog is a separate layer with its own focus, so the editor underneath stays
+ * focused, and the web clipboard handlers listen on the document and only checked that focus.
+ * Fix: Compose routes key events to the top layer only, so the editor records the clipboard
+ * shortcuts it receives and the web handlers ignore a keyboard clipboard event whose shortcut
+ * the editor never saw. This pins the routing that fix relies on.
+ */
+@OptIn(ExperimentalTestApi::class)
+class Issue715ClipboardShortcutRoutingTest {
+
+    @Test
+    fun `the editor records a clipboard shortcut pressed in it`() = runDesktopComposeUiTest {
+        val state = RichTextState().apply { setText("Hello") }
+        setContent { BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth().testTag(EDITOR_TAG)) }
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(5f, 5f)) }
+        waitForIdle()
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput {
+            keyDown(Key.CtrlLeft)
+            pressKey(Key.V)
+            keyUp(Key.CtrlLeft)
+        }
+        waitForIdle()
+
+        assertTrue(state.sawClipboardShortcutKey)
+    }
+
+    @Test
+    fun `typing is not a clipboard shortcut`() = runDesktopComposeUiTest {
+        val state = RichTextState().apply { setText("Hello") }
+        setContent { BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth().testTag(EDITOR_TAG)) }
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(5f, 5f)) }
+        waitForIdle()
+
+        onNodeWithTag(EDITOR_TAG).performKeyInput { pressKey(Key.V) }
+        waitForIdle()
+
+        assertFalse(state.sawClipboardShortcutKey)
+    }
+
+    @Test
+    fun `a clipboard shortcut pressed in a dialog does not reach the editor behind it`() = runDesktopComposeUiTest {
+        val state = RichTextState().apply { setText("Hello") }
+        var showDialog by mutableStateOf(false)
+        setContent {
+            Column {
+                BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth().testTag(EDITOR_TAG))
+                if (showDialog) {
+                    Dialog(onDismissRequest = { showDialog = false }) {
+                        var url by remember { mutableStateOf("") }
+                        BasicTextField(
+                            value = url,
+                            onValueChange = { url = it },
+                            modifier = Modifier.fillMaxWidth().testTag(DIALOG_FIELD_TAG),
+                        )
+                    }
+                }
+            }
+        }
+        onNodeWithTag(EDITOR_TAG).performMouseInput { click(Offset(5f, 5f)) }
+        waitForIdle()
+        showDialog = true
+        waitForIdle()
+        onNodeWithTag(DIALOG_FIELD_TAG).performMouseInput { click() }
+        waitForIdle()
+
+        onNodeWithTag(DIALOG_FIELD_TAG).performKeyInput {
+            keyDown(Key.CtrlLeft)
+            pressKey(Key.V)
+            keyUp(Key.CtrlLeft)
+        }
+        waitForIdle()
+
+        assertTrue(state.isFocused, "the editor behind a dialog keeps its focus, which is why focus alone cannot decide")
+        assertFalse(state.sawClipboardShortcutKey)
+    }
+
+    private companion object {
+        const val EDITOR_TAG = "editor"
+        const val DIALOG_FIELD_TAG = "dialogField"
+    }
+}
```

**File**: `richeditor-compose/src/jsMain/kotlin/com/mohamedrejeb/richeditor/clipboard/ClipboardEventEffect.kt` (modified, +37/-3)
```diff
@@ -10,6 +10,7 @@ import com.mohamedrejeb.richeditor.model.RichTextState
 import com.mohamedrejeb.richeditor.model.richPasteEnabled
 import kotlinx.browser.document
 import org.w3c.dom.events.Event
+import org.w3c.dom.events.KeyboardEvent
 
 @Composable
 internal actual fun ClipboardEventEffect(
@@ -18,16 +19,34 @@ internal actual fun ClipboardEventEffect(
 ) {
     val isReadOnly by rememberUpdatedState(readOnly)
     DisposableEffect(richTextState) {
+        // A dialog or popup is its own layer with its own focus, so the editor underneath
+        // stays focused while a field in that layer is used. Key events only reach the top
+        // layer though: a clipboard event that follows a shortcut the editor never received
+        // belongs to that layer. One with no shortcut (browser menu, touch) falls back to focus.
+        var shortcutPressed = false
+
+        val keyDownHandler: (Event) -> Unit = { event ->
+            if (isClipboardShortcut(event as KeyboardEvent)) {
+                shortcutPressed = true
+                richTextState.sawClipboardShortcutKey = false
+            }
+        }
+
+        val keyUpHandler: (Event) -> Unit = { shortcutPressed = false }
+
+        fun ownsClipboardEvents() =
+            richTextState.isFocused && (!shortcutPressed || richTextState.sawClipboardShortcutKey)
+
         val pasteHandler: (Event) -> Unit = { event ->
-            if (richTextState.isFocused && !isReadOnly) richTextState.pasteFrom(event)
+            if (ownsClipboardEvents() && !isReadOnly) richTextState.pasteFrom(event)
         }
 
         val copyHandler: (Event) -> Unit = { event ->
-            if (richTextState.isFocused) richTextState.copySelectionTo(event)
+            if (ownsClipboardEvents()) richTextState.copySelectionTo(event)
         }
 
         val cutHandler: (Event) -> Unit = { event ->
-            if (richTextState.isFocused && !isReadOnly && richTextState.copySelectionTo(event)) {
+            if (ownsClipboardEvents() && !isReadOnly && richTextState.copySelectionTo(event)) {
                 richTextState.removeSelectedText()
             }
         }
@@ -36,15 +55,30 @@ internal actual fun ClipboardEventEffect(
         document.addEventListener("paste", pasteHandler, true)
         document.addEventListener("copy", copyHandler, true)
         document.addEventListener("cut", cutHandler, true)
+        // Capture phase so the reset in keyDownHandler runs before Compose delivers the key.
+        document.addEventListener("keydown", keyDownHandler, true)
+        document.addEventListener("keyup", keyUpHandler, true)
 
         onDispose {
             document.removeEventListener("paste", pasteHandler, true)
             document.removeEventListener("copy", copyHandler, true)
             document.removeEventListener("cut", cutHandler, true)
+            document.removeEventListener("keydown", keyDownHandler, true)
+            document.removeEventListener("keyup", keyUpHandler, true)
         }
     }
 }
 
+private fun isClipboardShortcut(event: KeyboardEvent): Boolean {
+    val command = event.ctrlKey || event.metaKey
+    return when (event.key.lowercase()) {
+        "c", "x", "v" -> command
+        "insert" -> command || event.shiftKey
+        "delete" -> event.shiftKey
+        else -> false
+    }
+}
+
 private fun RichTextState.pasteFrom(event: Event) {
     val html =
         if (config.richPasteEnabled) getClipboardDataHtml(event)
```

**File**: `richeditor-compose/src/wasmJsMain/kotlin/com/mohamedrejeb/richeditor/clipboard/ClipboardEventEffect.kt` (modified, +37/-3)
```diff
@@ -10,6 +10,7 @@ import com.mohamedrejeb.richeditor.model.RichTextState
 import com.mohamedrejeb.richeditor.model.richPasteEnabled
 import kotlinx.browser.document
 import org.w3c.dom.events.Event
+import org.w3c.dom.events.KeyboardEvent
 
 @Composable
 internal actual fun ClipboardEventEffect(
@@ -18,16 +19,34 @@ internal actual fun ClipboardEventEffect(
 ) {
     val isReadOnly by rememberUpdatedState(readOnly)
     DisposableEffect(richTextState) {
+        // A dialog or popup is its own layer with its own focus, so the editor underneath
+        // stays focused while a field in that layer is used. Key events only reach the top
+        // layer though: a clipboard event that follows a shortcut the editor never received
+        // belongs to that layer. One with no shortcut (browser menu, touch) falls back to focus.
+        var shortcutPressed = false
+
+        val keyDownHandler: (Event) -> Unit = { event ->
+            if (isClipboardShortcut(event as KeyboardEvent)) {
+                shortcutPressed = true
+                richTextState.sawClipboardShortcutKey = false
+            }
+        }
+
+        val keyUpHandler: (Event) -> Unit = { shortcutPressed = false }
+
+        fun ownsClipboardEvents() =
+            richTextState.isFocused && (!shortcutPressed || richTextState.sawClipboardShortcutKey)
+
         val pasteHandler: (Event) -> Unit = { event ->
-            if (richTextState.isFocused && !isReadOnly) richTextState.pasteFrom(event)
+            if (ownsClipboardEvents() && !isReadOnly) richTextState.pasteFrom(event)
         }
 
         val copyHandler: (Event) -> Unit = { event ->
-            if (richTextState.isFocused) richTextState.copySelectionTo(event)
+            if (ownsClipboardEvents()) richTextState.copySelectionTo(event)
         }
 
         val cutHandler: (Event) -> Unit = { event ->
-            if (richTextState.isFocused && !isReadOnly && richTextState.copySelectionTo(event)) {
+            if (ownsClipboardEvents() && !isReadOnly && richTextState.copySelectionTo(event)) {
                 richTextState.removeSelectedText()
             }
         }
@@ -36,15 +55,30 @@ internal actual fun ClipboardEventEffect(
         document.addEventListener("paste", pasteHandler, true)
         document.addEventListener("copy", copyHandler, true)
         document.addEventListener("cut", cutHandler, true)
+        // Capture phase so the reset in keyDownHandler runs before Compose delivers the key.
+        document.addEventListener("keydown", keyDownHandler, true)
+        document.addEventListener("keyup", keyUpHandler, true)
 
         onDispose {
             document.removeEventListener("paste", pasteHandler, true)
             document.removeEventListener("copy", copyHandler, true)
             document.removeEventListener("cut", cutHandler, true)
+            document.removeEventListener("keydown", keyDownHandler, true)
+            document.removeEventListener("keyup", keyUpHandler, true)
         }
     }
 }
 
+private fun isClipboardShortcut(event: KeyboardEvent): Boolean {
+    val command = event.ctrlKey || event.metaKey
+    return when (event.key.lowercase()) {
+        "c", "x", "v" -> command
+        "insert" -> command || event.shiftKey
+        "delete" -> event.shiftKey
+        else -> false
+    }
+}
+
 private fun RichTextState.pasteFrom(event: Event) {
     val html =
         if (config.richPasteEnabled) getClipboardDataHtml(event)?.toString()
```

---

### Incident Patch 15: `f709b63c` (2026-10-04)
**Commit Message**: Merge pull request #823 from MohamedRejeb/fix/issue-304-caret-handle-paragraph-end

fix: a caret handle dragged past a paragraph end stays on that paragraph

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/CaretHandleCorrection.kt` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+package com.mohamedrejeb.richeditor.model
+
+import androidx.compose.ui.text.TextLayoutResult
+import androidx.compose.ui.text.TextRange
+import kotlin.math.abs
+
+/**
+ * Puts a caret that a caret handle step moved onto the next paragraph's start back on the end
+ * of the paragraph above it, when that is where the handle is, and reports whether it did.
+ *
+ * The handle lives in a popup, so the editor never sees its pointer, and a hit in the empty
+ * space after a paragraph's last line reports the next paragraph's first offset (see
+ * [correctPressCaret]). A keyboard cursor step from a paragraph end has the same offsets, so
+ * this runs only when the text field reports a handle move, which it does through the haptic
+ * it plays after every handle step and never for the keyboard.
+ *
+ * Without the pointer, where the caret came from decides:
+ * - From the paragraph's own last line: held, unless it came from that line's start. A handle
+ *   moved straight down along the leading edge, or down from an empty paragraph, means the
+ *   next line.
+ * - From any other line: held when the handle can be right of the paragraph's end, which is
+ *   when the caret was further along its line than that end is, or rested on its line's end
+ *   (the handle may then be anywhere past it). A handle moved vertically from there lands in
+ *   the empty space. Not held when the caret was travelling back along the next paragraph's
+ *   first line, by a single step or over the last two steps: that is heading for its start.
+ */
+internal fun RichTextState.holdCaretHandleOnParagraphEnd(): Boolean {
+    val caret = textFieldState.selection
+    val previous = selectionBeforeUserSelectionChange
+
+    // Where the step before this one came from, when the two are consecutive.
+    val beforePrevious = lastCaretHandleStep?.takeIf { it.second == previous.start }?.first
+    lastCaretHandleStep = if (caret.collapsed && previous.collapsed) previous.start to caret.start else null
+
+    if (singleParagraphMode || !caret.collapsed || !previous.collapsed) return false
+    if (!isLaterParagraphStart(caret.start)) return false
+
+    val text = textFieldState.text.toString()
+    val layout = textLayoutResult ?: return false
+    if (layout.layoutInput.text.length != text.length) return false
+
+    val step = CaretHandleStep(from = previous.start, to = caret.start, before = beforePrevious)
+    if (!layout.handleIsPastParagraphEnd(step)) return false
+
+    val paragraphEnd = caret.start - 1
+    lastCaretHandleStep = previous.start to paragraphEnd
+    setTextFieldStateFromValue(text = text, selection = TextRange(paragraphEnd))
+    return true
+}
+
+/** A caret handle step onto a paragraph start [to], from [from], which was reached from [before]. */
+private class CaretHandleStep(val from: Int, val to: Int, val before: Int?)
+
+private fun TextLayoutResult.handleIsPastParagraphEnd(step: CaretHandleStep): Boolean {
+    val paragraphEnd = step.to - 1
+    val lastLine = getLineForOffset(paragraphEnd)
+    if (step.from <= paragraphEnd && getLineForOffset(step.from) == lastLine)
+        return step.from > getLineStart(lastLine)
+
+    return !isHeadingForStart(step) && canBeRightOf(paragraphEnd, step.from)
+}
+
+/** Whether the caret was travelling back along the paragraph's first line towards its start. */
+private fun TextLayoutResult.isHeadingForStart(step: CaretHandleStep): Boolean {
+    if (step.from == step.to + 1) return true
+    val before = step.before ?: return false
+    val startLine = getLineForOffset(step.to)
+    return getLineForOffset(step.from) == startLine &&
+        getLineForOffset(before) == startLine &&
+        step.from < before
+}
+
+/** Whether a handle whose caret is at [offset] can be further along than [paragraphEnd] is. */
+private fun TextLayoutResult.canBeRightOf(paragraphEnd: Int, offset: Int): Boolean =
+    offset == getLineEnd(getLineForOffset(offset), visibleEnd = true) ||
+        advanceInLine(offset) > advanceInLine(paragraphEnd)
+
+/** How far [offset] is from the start of its line, in either text direction. */
+private fun TextLayoutResult.advanceInLine(offset: Int): Float {
+    val lineStart = getLineStart(getLineForOffset(offset))
+    return abs(
+        getHorizontalPosition(offset, usePrimaryDirection = true) -
+            getHorizontalPosition(lineStart, usePrimaryDirection = true)
+    )
+}
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/model/RichTextState.kt` (modified, +45/-1)
```diff
@@ -801,6 +801,7 @@ public class RichTextState internal constructor(
     private var pressSeriesCount = 0
     private var pressSeriesUptimeMs = 0L
     private var pressSeriesPosition: Offset? = null
+    private var pressSlop = 0f
 
     // True from a third press until its selection has been seen by
     // [correctTripleClickSelection] or the pointer is up.
@@ -824,14 +825,48 @@ public class RichTextState internal constructor(
         pressSeriesCount = if (continuesSeries) pressSeriesCount + 1 else 1
         pressSeriesUptimeMs = uptimeMillis
         pressSeriesPosition = position
+        pressSlop = slop
         tripleClickArmed = pressSeriesCount >= 3 && !shiftPressed
     }
 
-    internal fun onSelectionGesturePointerUp() {
+    /**
+     * @param releasePosition where the pointer came up, in the coordinates the press was
+     * reported in, or null when unknown.
+     */
+    internal fun onSelectionGesturePointerUp(releasePosition: Offset? = null) {
+        if (pressCaretCorrectionArmed && releasePosition != null)
+            correctTapOnUnchangedCaret(releasePosition)
         pressCaretCorrectionArmed = false
         tripleClickArmed = false
     }
 
+    /**
+     * [correctPressCaret] only runs when a press changes the selection. A tap in the empty
+     * space after a paragraph while the caret already sits on the next paragraph's start
+     * reports that same offset, so nothing changes and nothing is corrected. This covers that
+     * tap once it is over. A press that moved further than the slop is a scroll or a drag.
+     */
+    private fun correctTapOnUnchangedCaret(releasePosition: Offset) {
+        val pressPosition = pressSeriesPosition ?: return
+        if ((releasePosition - pressPosition).getDistance() >= pressSlop) return
+        val press = pressForCaretCorrection() ?: return
+
+        val caret = textFieldState.selection
+        if (singleParagraphMode || !caret.collapsed || !isLaterParagraphStart(caret.start)) return
+
+        val text = textFieldState.text.toString()
+        val layout = textLayoutResult ?: return
+        if (layout.layoutInput.text.length != text.length) return
+
+        val pressedLine = layout.getLineForVerticalPosition(
+            press.y.coerceIn(0f, layout.size.height.toFloat())
+        )
+        if (layout.getLineForOffset(caret.start) <= pressedLine) return
+
+        pressCorrectedCaret = caret.start - 1
+        setTextFieldStateFromValue(text = text, selection = TextRange(caret.start - 1))
+    }
+
     internal fun pressForCaretCorrection(): Offset? {
         if (!pressCaretCorrectionArmed) return null
 
@@ -844,6 +879,15 @@ public class RichTextState internal constructor(
     // it is press driven, however much it looks like the one that ends an IME pick (#779).
     internal var pressCorrectedCaret: Int? = null
 
+    /**
+     * The selection before the latest user selection change or edit, recorded by the
+     * InputTransformation. [holdCaretHandleOnParagraphEnd] reads where a handle step came from.
+     */
+    internal var selectionBeforeUserSelectionChange: TextRange = TextRange.Zero
+
+    /** The caret before and after the latest caret handle step. */
+    internal var lastCaretHandleStep: Pair<Int, Int>? = null
+
     internal fun isLaterParagraphStart(offset: Int): Boolean =
         richParagraphList
             .asSequence()
```

**File**: `richeditor-compose/src/commonMain/kotlin/com/mohamedrejeb/richeditor/ui/BasicRichTextEditor.kt` (modified, +23/-2)
```diff
@@ -18,6 +18,8 @@ import androidx.compose.runtime.*
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.alpha
 import androidx.compose.ui.focus.onFocusChanged
+import androidx.compose.ui.hapticfeedback.HapticFeedback
+import androidx.compose.ui.hapticfeedback.HapticFeedbackType
 import androidx.compose.ui.geometry.Offset
 import androidx.compose.ui.graphics.Brush
 import androidx.compose.ui.graphics.Color
@@ -35,6 +37,7 @@ import androidx.compose.ui.layout.LayoutCoordinates
 import androidx.compose.ui.layout.onPlaced
 import androidx.compose.ui.layout.positionInWindow
 import androidx.compose.ui.node.Ref
+import androidx.compose.ui.platform.LocalHapticFeedback
 import androidx.compose.ui.platform.LocalClipboard
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.platform.LocalLayoutDirection
@@ -49,6 +52,7 @@ import com.mohamedrejeb.richeditor.clipboard.createRichTextClipboardManager
 import com.mohamedrejeb.richeditor.model.RichTextState
 import com.mohamedrejeb.richeditor.model.applyChangeList
 import com.mohamedrejeb.richeditor.model.correctPressCaret
+import com.mohamedrejeb.richeditor.model.holdCaretHandleOnParagraphEnd
 import com.mohamedrejeb.richeditor.model.correctTripleClickSelection
 import com.mohamedrejeb.richeditor.model.reconcileBufferWithModel
 
@@ -290,7 +294,23 @@ public fun BasicRichTextEditor(
     val editorCoordinates = remember { Ref<LayoutCoordinates>() }
     val innerTextFieldCoordinates = remember { Ref<LayoutCoordinates>() }
 
-    CompositionLocalProvider(LocalClipboard provides richClipboardManager) {
+    // The text field plays this haptic after every caret or selection handle step, which is
+    // the only sign of a handle drag the editor gets: the handles live in popups.
+    val hapticFeedback = LocalHapticFeedback.current
+    val handleAwareHapticFeedback = remember(hapticFeedback, state) {
+        object : HapticFeedback {
+            override fun performHapticFeedback(hapticFeedbackType: HapticFeedbackType) {
+                val undone = hapticFeedbackType == HapticFeedbackType.TextHandleMove &&
+                    state.holdCaretHandleOnParagraphEnd()
+                if (!undone) hapticFeedback.performHapticFeedback(hapticFeedbackType)
+            }
+        }
+    }
+
+    CompositionLocalProvider(
+        LocalClipboard provides richClipboardManager,
+        LocalHapticFeedback provides handleAwareHapticFeedback,
+    ) {
         // Capture position on the innerTextField (the actual text content composable),
         // not on the outer BasicTextField, so trigger-suggestion popups can anchor
         // precisely at the text content's origin - not at the top of the decorated
@@ -380,7 +400,7 @@ public fun BasicRichTextEditor(
                                             // Every caret placement the press causes is made by
                                             // the time its release has been dispatched.
                                             awaitPointerEvent(PointerEventPass.Final)
-                                            state.onSelectionGesturePointerUp()
+                                            state.onSelectionGesturePointerUp(releasePosition = change.position)
                                         }
                                     }
                                 }
@@ -405,6 +425,7 @@ public fun BasicRichTextEditor(
                 }
                 // Selection changes pass: a read-only editor can be focused and selected like
                 // a read-only BasicTextField, only its text is frozen.
+                state.selectionBeforeUserSelectionChange = originalSelection
                 @OptIn(ExperimentalFoundationApi::class)
                 val textChanged = changes.changeCount > 0
                 if (readOnly && textChanged) {
```

**File**: `richeditor-compose/src/desktopTest/kotlin/com/mohamedrejeb/richeditor/ui/Issue304CaretHandleParagraphEndTest.kt` (added, +323/-0)
```diff
@@ -0,0 +1,323 @@
+package com.mohamedrejeb.richeditor.ui
+
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.click
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.test.performMouseInput
+import androidx.compose.ui.test.performTouchInput
+import androidx.compose.ui.test.DesktopComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.runDesktopComposeUiTest
+import androidx.compose.ui.text.TextRange
+import com.mohamedrejeb.richeditor.model.RichTextState
+import com.mohamedrejeb.richeditor.model.holdCaretHandleOnParagraphEnd
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+/**
+ * Issue 304: dragging the caret handle into the empty space after a paragraph's last line
+ * made the caret jump to the start of the next paragraph.
+ *
+ * Cause: the hit test reports the next paragraph's start for that empty space. A tap there is
+ * corrected from the press position and a selection handle by its own rule, but a caret
+ * handle lives in a popup, delivers no pointer, and its one step move is the same shape a
+ * keyboard cursor step produces, so it was left alone.
+ * Fix: the text field fires a "handle moved" haptic after every handle step and never for a
+ * keyboard step. On that signal a caret that landed on the next paragraph's start is put back
+ * on the paragraph's end when the handle is in that empty space, judged from where the caret
+ * came from. A tap there while the caret already rests on the next paragraph's start changes
+ * nothing, so it is corrected when the tap is over.
+ */
+@OptIn(ExperimentalTestApi::class)
+class Issue304CaretHandleParagraphEndTest {
+
+    /** "Hi" ends at 2, "Next line here" starts at 3. */
+    private fun runEditor(
+        text: String = "Hi\nNext line here",
+        block: DesktopComposeUiTest.(RichTextState) -> Unit,
+    ) = runDesktopComposeUiTest {
+        val state = RichTextState().apply { setText(text) }
+        setContent { BasicRichTextEditor(state = state, modifier = Modifier.fillMaxWidth()) }
+        waitForIdle()
+        block(state)
+    }
+
+    /**
+     * One caret handle step as the text field delivers it: the caret is written as a user
+     * selection change, then the handle haptic fires. Returns whether the step was undone.
+     */
+    private fun DesktopComposeUiTest.caretHandleStep(state: RichTextState, to: TextRange): Boolean {
+        state.selectionBeforeUserSelectionChange = state.textFieldState.selection
+        state.writeSelection(to)
+        val held = state.holdCaretHandleOnParagraphEnd()
+        waitForIdle()
+        return held
+    }
+
+    private fun RichTextState.writeSelection(newSelection: TextRange) {
+        val previous = isApplyingProgrammaticSync
+        isApplyingProgrammaticSync = true
+        try {
+            textFieldState.edit { selection = newSelection }
+        } finally {
+            isApplyingProgrammaticSync = previous
+        }
+    }
+
+    private fun DesktopComposeUiTest.placeCaret(state: RichTextState, at: Int) {
+        state.writeSelection(TextRange(at))
+        waitForIdle()
+    }
+
+    @Test
+    fun `a caret handle dragged past a paragraph end stays on the paragraph end`() = runEditor { state ->
+        placeCaret(state, 1)
+
+        assertFalse(caretHandleStep(state, TextRange(2)))
+        assertTrue(caretHandleStep(state, TextRange(3)))
+
+        assertEquals(TextRange(2), state.selection)
+    }
+
+    @Test
+    fun `the caret stays on the paragraph end while the handle keeps reporting the next paragraph`() = runEditor { state ->
+        placeCaret(state, 2)
+
+        repeat(3) { assertTrue(caretHandleStep(state, TextRange(3))) }
+
+        assertEquals(TextRange(2), state.selection)
+    }
+
+    @Test
+    fun `a fast drag that skips the paragraph end is held too`() = runEditor { state ->
+        placeCaret(state, 1)
+
+        assertTrue(caretHandleStep(state, TextRange(3)))
+
+        assertEquals(TextRange(2), state.selection)
+    }
+
+    @Test
+    fun `a handle moved down along the left edge reaches the next paragraph start`() = runEditor { state ->
+        placeCaret(state, 0)
+
+        assertFalse(caretHandleStep(state, TextRange(3)))
+
+        assertEquals(TextRange(3), state.selection)
+    }
+
+    @Test
+    fun `a handle moved down from an empty paragraph reaches the next paragraph`() = runEditor(text = "\nNext") { state ->
+        placeCaret(state, 0)
+
+        assertFalse(caretHandleStep(state, TextRange(1)))
+
+        assertEquals(TextRange(1), state.selection)
+    }
+
+    @Test
+    fun `a handle moving back along the next paragraph reaches its start`() = runEditor { state ->
+        placeCaret(state, 6)
+
+        for (caret in listOf(
```

#### Recent Merged Pull Requests:
- **PR #835** (2026-10-05): feat: rememberRichTextState can start with content (@MohamedRejeb)
- **PR #834** (2026-10-05): feat: RichTextConfig.listMarkerStyle styles list markers on their own (@MohamedRejeb)
- **PR #833** (2026-10-05): chore: align navigation with Compose Multiplatform 1.12.1 (@MohamedRejeb)
- **PR #832** (2026-10-05): fix: a heading set on one line of a <br> block only cuts the links it breaks (@MohamedRejeb)
- **PR #831** (2026-10-05): fix: typing on web no longer flattens the document (@MohamedRejeb)
- **PR #830** (2026-10-05): chore(deps): bump com.mohamedrejeb.richeditor:richeditor-compose from 1.2.0 to 1.2.1 (@dependabot[bot])
- **PR #829** (2026-10-05): chore(deps): bump ktor from 3.5.2 to 3.6.0 (@dependabot[bot])
- **PR #828** (2026-10-05): chore(deps): bump compose from 1.12.0 to 1.12.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
