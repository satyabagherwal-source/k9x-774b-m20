# Forensic Learning Record (Deep Inspection): TabbyML/tabby

> **Canonical Artifact**: `07_PROJECT_LEARNING/tabbyml-tabby-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TabbyML/tabby](https://github.com/TabbyML/tabby))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:16:23.309Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TabbyML/tabby`
- **Description**: Self-hosted AI coding assistant
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 33895 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `clients/intellij/src/main/kotlin/com/tabbyml/intellijtabby/completion/InlineCompletionRenderer.kt`
```
package com.tabbyml.intellijtabby.completion

import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorCustomElementRenderer
import com.intellij.openapi.editor.Inlay
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.openapi.editor.impl.FontInfo
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.TextRange
import com.intellij.ui.JBColor
import com.intellij.util.ui.UIUtil
import java.awt.Font
import java.awt.Graphics
import java.awt.Rectangle

class InlineCompletionRenderer {
  private val logger = Logger.getInstance(InlineCompletionRenderer::class.java)

  data class RenderingContext(
    val id: String,
    val editor: Editor,
    val offset: Int,
    val completionItem: InlineCompletionItem,
    val inlays: List<Inlay<*>>,
    val markups: List<RangeHighlighter>,
    val displayAt: Long,
  ) {
    fun calcElapsed(): Long {
      return System.currentTimeMillis() - displayAt
    }
  }

  var current: RenderingContext? = null
    private set

  fun show(
    editor: Editor, offset: Int, completion: InlineCompletionItem, callback: (context: RenderingContext) -> Unit = {}
  ) {
    invokeLater {
      current?.let {
        it.inlays.forEach(Disposer::dispose)
        it.markups.forEach { markup ->
          it.editor.markupModel.removeHighlighter(markup)
        }
        current = null
      }

      if (editor.caretModel.offset != offset) {
        return@invokeLater
      }

      logger.debug("Showing inline completion at $offset: $completion")

      val cmplId = completion.data?.eventId?.completionId?.replace("cmpl-", "") ?: "noCmplId"
      val displayAt = System.currentTimeMillis()
      val id = "view-${cmplId}-at-${displayAt}"

      val prefixReplaceLength = offset - completion.replaceRange.start
      val suffixReplaceLength = completion.replaceRange.end - offset
      val text = completion.insertText.substring(prefixReplaceLength)
      if (text.isEmpty()) {
        // Nothing to display
        return@invokeLater
      }
      val currentLineNumber = editor.document.getLineNumber(offset)
      val currentLineEndOffset = editor.document.getLineEndOffset(currentLineNumber)
      val currentLineSuffix = editor.document.getText(TextRange(offset, currentLineEndOffset))

      val textLines = text.lines().toMutableList()

      val inlays = mutableListOf<Inlay<*>>()
      val markups = mutableListOf<RangeHighlighter>()
      if (suffixReplaceLength == 0) {
        // No replace range to handle
        createInlayText(editor, textLines[0], offset, 0)?.let { inlays.add(it) }
        if (textLines.size > 1) {
          if (currentLineSuffix.isNotEmpty()) {
            markupReplaceText(editor, offset, currentLineEndOffset).let { markups.add(it) }
            textLines[textLines.lastIndex] += currentLineSuffix
          }
          textLines.forEachIndexed { index, line ->
            if (index > 0) {
              createInlayText(editor, line, offset, index)?.let { inlays.add(it) }
            }
          }
        }
      } else if (suffixReplaceLength == 1) {
        // Replace range contains one char
        val replaceChar = currentLineSuffix[0]
        // Insert part is substring of first line that before the char
        // Append part is substring of first line that after the char
        // If first line doesn't contain the char, insert part is full first line, append part is empty
        val insertPart = if (textLines[0].startsWith(replaceChar)) {
          ""
        } else {
          textLines[0].split(replaceChar).first()
        }
        val appendPart = if (insertPart.length < textLines[0].length) {
          textLines[0].substring(insertPart.length + 1)
        } else {
          ""
        }
        if (insertPart.isNotEmpty()) {
          createInlayText(editor, insertPart, offset, 0)?.let { inlays.add(it) }
        }
        if (appendPart.isNotEmpty()) {
          createInlayText(editor, appendPart, offset + 1, 0)?.let { inlays.add(it) }
        }
        if (textLines.size > 1) {
          if (currentLineSuffix.isNotEmpty()) {
            val startOffset = if (insertPart.length < textLines[0].length) {
              // First line contains the char
              offset + 1
            } else {
              // First line doesn't contain the char
              offset
            }
            markupReplaceText(editor, startOffset, currentLineEndOffset).let { markups.add(it) }
            textLines[textLines.lastIndex] += currentLineSuffix.substring(1)
          }
          textLines.forEachIndexed { index, line ->
            if (index > 0) {
              createInlayText(editor, line, offset, index)?.let { inlays.add(it) }
            }
          }
        }
      } else {
        // Replace range contains multiple chars
        // It's hard to match these chars in the insertion text, we just mark them up
        createInlayText(editor, textLines[0], offset, 0)?.let { inlays.add(it) }
        markupReplaceText(editor, offset, offset + suffixReplaceLength).let { markups.add(it) }
        if (textLines.size > 1) {
          if (currentLineSuffix.length > suffixReplaceLength) {
            markupReplaceText(editor, offset + suffixReplaceLength, currentLineEndOffset).let { markups.add(it) }
            textLines[textLines.lastIndex] += currentLineSuffix.substring(suffixReplaceLength)
          }
          textLines.forEachIndexed { index, line ->
            if (index > 0) {
              createInlayText(editor, line, offset, index)?.let { inlays.add(it) }
            }
          }
        }
      }
      val context = RenderingContext(id, editor, offset, completion, inlays, markups, displayAt)
      current = context
      callback(context)
    }
  }

  fun hide() {
    current?.let {
      invokeLater {
        it.inlays.forEach(Disposer::dispose)
        it.markups.forEach { markup ->
          it.editor.markupModel.removeHighlighter(markup)
        }
      }
      current = null
    }
  }

  private fun createInlayText(editor: Editor, text: String, offset: Int, lineOffset: Int): Inlay<*>? {
    val renderer = object : EditorCustomElementRenderer {
      override fun getContextMenuGroupId(inlay: Inlay<*>): String {
        return "Tabby.InlineCompletionContextMenu"
      }

      override fun calcWidthInPixels(inlay: Inlay<*>): Int {
        return maxOf(getWidth(inlay.editor, text), 1)
      }

      override fun paint(inlay: Inlay<*>, graphics: Graphics, targetRect: Rectangle, textAttributes: TextAttributes) {
        graphics.font = getFont(inlay.editor)
        graphics.color = JBColor.GRAY
        graphics.drawString(text, targetRect.x, targetRect.y + inlay.editor.ascent)
      }

      private fun getFont(editor: Editor): Font {
        return editor.colorsScheme.getFont(EditorFontType.ITALIC).let {
          UIUtil.getFontWithFallbackIfNeeded(it, text).deriveFont(editor.colorsScheme.editorFontSize)
        }
      }

      private fun getWidth(editor: Editor, line: String): Int {
        val font = getFont(editor)
        val metrics = FontInfo.getFontMetrics(font, FontInfo.getFontRenderContext(editor.contentComponent))
        return metrics.stringWidth(line)
      }
    }
    return if (lineOffset == 0) {
      editor.inlayModel.addInlineElement(offset, true, renderer)
    } else {
      editor.inlayModel.addBlockElement(offset, true, false, -lineOffset, renderer)
    }
  }

  private fun markupReplaceText(editor: Editor, startOffset: Int, endOffset: Int): RangeHighlighter {
    val textAttributes = TextAttributes().apply {
      foregroundColor = JBColor.background()
      backgroundColor = JBColor.background()
    }
    return editor.markupModel.addRangeHighlighter(
      startOffset, endOffset, HighlighterLayer.LAST + 1000, textAttributes, HighlighterTargetArea.EXACT_RANGE
    )
  }
}

```

### Core Architecture Module: `clients/intellij/src/main/kotlin/com/tabbyml/intellijtabby/events/CombinedState.kt`
```
package com.tabbyml.intellijtabby.events

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.util.messages.Topic
import com.tabbyml.intellijtabby.lsp.ConnectionService
import com.tabbyml.intellijtabby.lsp.LanguageClient
import com.tabbyml.intellijtabby.lsp.protocol.Config
import com.tabbyml.intellijtabby.lsp.protocol.StatusInfo
import com.tabbyml.intellijtabby.notifications.hideAuthRequiredNotification
import com.tabbyml.intellijtabby.notifications.notifyAuthRequired
import com.tabbyml.intellijtabby.safeSyncPublisher
import com.tabbyml.intellijtabby.settings.SettingsService

@Service(Service.Level.PROJECT)
class CombinedState(private val project: Project) : Disposable {
  private val messageBusConnection = project.messageBus.connect()

  data class State(
    val settings: SettingsService.Settings,
    val connectionState: ConnectionService.State,
    val agentStatus: StatusInfo?,
    val agentConfig: Config?,
  ) {
    fun withSettings(settings: SettingsService.Settings): State {
      return State(settings, connectionState, agentStatus, agentConfig)
    }

    fun withConnectionState(connectionState: ConnectionService.State): State {
      return State(settings, connectionState, agentStatus, agentConfig)
    }

    fun withStatus(status: StatusInfo): State {
      return State(settings, connectionState, status, agentConfig)
    }

    fun withConfig(config: Config): State {
      return State(settings, connectionState, agentStatus, config)
    }
  }

  var state = State(
    service<SettingsService>().settings(),
    ConnectionService.State.INITIALIZING,
    null,
    null,
  )
    private set

  init {
    messageBusConnection.subscribe(SettingsService.Listener.TOPIC, object : SettingsService.Listener {
      override fun settingsChanged(settings: SettingsService.Settings) {
        state = state.withSettings(settings)
        project.safeSyncPublisher(Listener.TOPIC)?.stateChanged(state)
      }
    })
    messageBusConnection.subscribe(ConnectionService.Listener.TOPIC, object : ConnectionService.Listener {
      override fun connectionStateChanged(state: ConnectionService.State) {
        this@CombinedState.state = this@CombinedState.state.withConnectionState(state)
        project.safeSyncPublisher(Listener.TOPIC)?.stateChanged(this@CombinedState.state)
      }
    })
    messageBusConnection.subscribe(LanguageClient.StatusListener.TOPIC, object : LanguageClient.StatusListener {
      override fun statusChanged(status: StatusInfo) {
        state = state.withStatus(status)
        project.safeSyncPublisher(Listener.TOPIC)?.stateChanged(state)

        if (status.status == StatusInfo.Status.UNAUTHORIZED) {
          notifyAuthRequired()
        } else {
          hideAuthRequiredNotification()
        }
      }
    })
    messageBusConnection.subscribe(LanguageClient.ConfigListener.TOPIC, object : LanguageClient.ConfigListener {
      override fun configChanged(config: Config) {
        state = state.withConfig(config)
        project.safeSyncPublisher(Listener.TOPIC)?.stateChanged(state)
      }
    })
  }

  override fun dispose() {
    messageBusConnection.dispose()
  }

  interface Listener {
    fun stateChanged(state: State) {}

    companion object {
      @Topic.ProjectLevel
      val TOPIC = Topic(Listener::class.java, Topic.BroadcastDirection.NONE)
    }
  }
}
```

### Core Architecture Module: `clients/intellij/src/main/kotlin/com/tabbyml/intellijtabby/events/FeaturesState.kt`
```
package com.tabbyml.intellijtabby.events

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.util.messages.Topic
import com.tabbyml.intellijtabby.lsp.LanguageClient
import com.tabbyml.intellijtabby.safeSyncPublisher

@Service(Service.Level.PROJECT)
class FeaturesState(private val project: Project) : Disposable {
  private val messageBusConnection = project.messageBus.connect()
  private val registrations = mutableMapOf<String, Pair<String, Any>>()

  data class Features(
    val inlineCompletion: Boolean,
    val chat: Boolean,
  )

  val features: Features
    get() = Features(
      inlineCompletion = registrations.containsKey("textDocument/inlineCompletion"),
      chat = registrations.containsKey("tabby/chat"),
    )

  init {
    messageBusConnection.subscribe(
      LanguageClient.CapabilityRegistrationListener.TOPIC,
      object : LanguageClient.CapabilityRegistrationListener {
        override fun onRegisterCapability(id: String, method: String, options: Any) {
          registrations[method] = Pair(id, options)
          project.safeSyncPublisher(Listener.TOPIC)?.stateChanged(features)
        }

        override fun onUnregisterCapability(id: String, method: String) {
          registrations.remove(method)
          project.safeSyncPublisher(Listener.TOPIC)?.stateChanged(features)
        }
      })
  }

  override fun dispose() {
    messageBusConnection.dispose()
  }

  interface Listener {
    fun stateChanged(features: Features) {}

    companion object {
      @Topic.ProjectLevel
      val TOPIC = Topic(Listener::class.java, Topic.BroadcastDirection.NONE)
    }
  }
}
```

### Core Architecture Module: `clients/intellij/src/main/kotlin/com/tabbyml/intellijtabby/inlineChat/util.kt`
```
package com.tabbyml.intellijtabby.inlineChat

import com.intellij.openapi.components.serviceOrNull
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.tabbyml.intellijtabby.lsp.ConnectionService
import com.tabbyml.intellijtabby.lsp.protocol.ChatEditCommand
import com.tabbyml.intellijtabby.lsp.protocol.ChatEditCommandParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.eclipse.lsp4j.*
import java.util.concurrent.CompletableFuture

data class LocationInfo(val location: Location, val startOffset: Int)

fun getCurrentLocation(editor: Editor): LocationInfo {
    val fileUri = editor.virtualFile.url
    val location = Location()
    location.uri = fileUri
    val selectionModel = editor.selectionModel
    val document = editor.document
    val caretOffset = editor.caretModel.offset
    var startOffset = caretOffset
    var endOffset = caretOffset
    if (selectionModel.hasSelection()) {
        startOffset = selectionModel.selectionStart
        endOffset = selectionModel.selectionEnd
    }
    val startPosition = Position(document.getLineNumber(startOffset), 0)
    val endChar = endOffset - document.getLineStartOffset(document.getLineNumber(endOffset))
    val endLine = if (endChar == 0) document.getLineNumber(endOffset) else document.getLineNumber(endOffset) + 1
    val endPosition = Position(endLine, 0)
    location.range = Range(startPosition, endPosition)
    return LocationInfo(location, startOffset)
}

fun getCodeLenses(project: Project, uri: String): CompletableFuture<List<CodeLens>?> {
    val scope = CoroutineScope(Dispatchers.IO)
    val params = CodeLensParams(TextDocumentIdentifier(uri))
    return CompletableFuture<List<CodeLens>?>().also { future ->
        scope.launch {
            try {
                val server = project.serviceOrNull<ConnectionService>()?.getServerAsync() ?: run {
                    future.complete(null)
                    return@launch
                }
                val result = server.textDocumentFeature.codeLens(params)
                future.complete(result.get())
            } catch (e: Exception) {
                future.completeExceptionally(e)
            }
        }
    }
}

fun getSuggestedCommands(project: Project, location: Location): CompletableFuture<List<ChatEditCommand>?> {
    val scope = CoroutineScope(Dispatchers.IO)
    val params = ChatEditCommandParams(location)
    return CompletableFuture<List<ChatEditCommand>?>().also { future ->
        scope.launch {
            try {
                val server = project.serviceOrNull<ConnectionService>()?.getServerAsync() ?: run {
                    future.complete(null)
                    return@launch
                }
                val result = server.chatFeature.editCommand(params)
                future.complete(result.get())
            } catch (e: Exception) {
                future.completeExceptionally(e)
            }
        }
    }
}
```

### Core Architecture Module: `clients/intellij/src/main/kotlin/com/tabbyml/intellijtabby/settings/SettingsState.kt`
```
package com.tabbyml.intellijtabby.settings

import com.intellij.openapi.components.BaseState


class SettingsState : BaseState() {
  enum class TriggerMode {
    MANUAL, AUTOMATIC,
  }

  var completionTriggerMode by enum(TriggerMode.AUTOMATIC)
  var serverEndpoint by string()
  var serverToken by string()
  var nodeBinary by string()
  var isAnonymousUsageTrackingDisabled by property(false)
}
```

### Core Architecture Module: `clients/tabby-agent/src/chat/utils.ts`
```
//chat related utils functions

import { Readable } from "stream";
import {
  Range,
  Location,
  ShowDocumentParams,
  ShowDocumentRequest,
  WorkspaceEdit,
} from "vscode-languageserver-protocol";
import { Connection } from "vscode-languageserver";
import * as Diff from "diff";
import { ApplyWorkspaceEditParams, ApplyWorkspaceEditRequest } from "../protocol";
import { isBlank } from "../utils/string";

export type Edit = {
  id: string;
  location: Location;
  languageId: string;
  originalText: string;
  editedRange: Range;
  editedText: string;
  comments: string;
  buffer: string;
  state: "editing" | "stopped" | "completed";
};

export async function readResponseStream(
  stream: Readable,
  connection: Connection,
  currentEdit: Edit | undefined,
  mutexAbortController: AbortController | undefined,
  resetEditAndMutexAbortController: () => void,
  responseDocumentTag: string[],
  responseCommentTag?: string[],
): Promise<void> {
  const applyEdit = async (edit: Edit, isFirst: boolean = false, isLast: boolean = false) => {
    if (isFirst) {
      const workspaceEdit: WorkspaceEdit = {
        changes: {
          [edit.location.uri]: [
            {
              range: {
                start: { line: edit.editedRange.start.line, character: 0 },
                end: { line: edit.editedRange.start.line, character: 0 },
              },
              newText: `<<<<<<< ${edit.id}\n`,
            },
          ],
        },
      };

      await applyWorkspaceEdit(
        {
          edit: workspaceEdit,
          options: {
            undoStopBefore: true,
            undoStopAfter: false,
          },
        },
        connection,
      );

      edit.editedRange = {
        start: { line: edit.editedRange.start.line + 1, character: 0 },
        end: { line: edit.editedRange.end.line + 1, character: 0 },
      };
    }

    const editedLines = generateChangesPreview(edit);
    const workspaceEdit: WorkspaceEdit = {
      changes: {
        [edit.location.uri]: [
          {
            range: edit.editedRange,
            newText: editedLines.join("\n") + "\n",
          },
        ],
      },
    };

    await applyWorkspaceEdit(
      {
        edit: workspaceEdit,
        options: {
          undoStopBefore: false,
          undoStopAfter: isLast,
        },
      },
      connection,
    );

    edit.editedRange = {
      start: { line: edit.editedRange.start.line, character: 0 },
      end: { line: edit.editedRange.start.line + editedLines.length, character: 0 },
    };
  };

  const processBuffer = (edit: Edit, inTag: "document" | "comment", openTag: string, closeTag: string) => {
    if (edit.buffer.startsWith(openTag)) {
      edit.buffer = edit.buffer.substring(openTag.length);
    }

    const reg = createCloseTagMatcher(closeTag);
    const match = reg.exec(edit.buffer);
    if (!match) {
      edit[inTag === "document" ? "editedText" : "comments"] += edit.buffer;
      edit.buffer = "";
    } else {
      edit[inTag === "document" ? "editedText" : "comments"] += edit.buffer.substring(0, match.index);
      edit.buffer = edit.buffer.substring(match.index);
      return match[0] === closeTag ? false : inTag;
    }
    return inTag;
  };
  const findOpenTag = (
    buffer: string,
    responseDocumentTag: string[],
    responseCommentTag?: string[],
  ): "document" | "comment" | false => {
    const openTags = [responseDocumentTag[0], responseCommentTag?.[0]].filter(Boolean);
    if (openTags.length < 1) return false;

    const reg = new RegExp(openTags.join("|"), "g");
    const match = reg.exec(buffer);
    if (match && match[0]) {
      if (match[0] === responseDocumentTag[0]) {
        return "document";
      } else if (match[0] === responseCommentTag?.[0]) {
        return "comment";
      }
    }
    return false;
  };

  try {
    if (!currentEdit) {
      throw new Error("No current edit");
    }

    let inTag: "document" | "comment" | false = false;

    // Insert the first line as early as possible so codelens can be shown
    await applyEdit(currentEdit, true, false);

    for await (const item of stream) {
      if (!mutexAbortController || mutexAbortController.signal.aborted) {
        break;
      }
      const delta = typeof item === "string" ? item : "";
      const edit = currentEdit;
      edit.buffer += delta;

      if (!inTag) {
        inTag = findOpenTag(edit.buffer, responseDocumentTag, responseCommentTag);
      }

      if (inTag) {
        const openTag = inTag === "document" ? responseDocumentTag[0] : responseCommentTag?.[0];
        const closeTag = inTag === "document" ? responseDocumentTag[1] : responseCommentTag?.[1];
        if (!closeTag || !openTag) break;
        inTag = processBuffer(edit, inTag, openTag, closeTag);
        if (delta.includes("\n")) {
          await applyEdit(edit, false, false);
        }
      }
    }

    if (currentEdit) {
      currentEdit.state = "completed";
      await applyEdit(currentEdit, false, true);
    }
  } catch (error) {
    if (currentEdit) {
      currentEdit.state = "stopped";
      await applyEdit(currentEdit, false, true);
    }
    if (!(error instanceof TypeError && error.message.startsWith("terminated"))) {
      throw error;
    }
  } finally {
    resetEditAndMutexAbortController();
  }
}

export async function applyWorkspaceEdit(
  params: ApplyWorkspaceEditParams,
  lspConnection: Connection,
): Promise<boolean> {
  if (!lspConnection) {
    return false;
  }
  try {
    // FIXME(Sma1lboy): adding client capabilities to indicate if client support this method rather than try-catch
    const result = await lspConnection.sendRequest(ApplyWorkspaceEditRequest.type, params);
    return result;
  } catch (error) {
    try {
      await lspConnection.workspace.applyEdit({
        edit: params.edit,
        label: params.label,
      });
      return true;
    } catch (fallbackError) {
      return false;
    }
  }
}

export async function showDocument(params: ShowDocumentParams, lspConnection: Connection): Promise<boolean> {
  if (!lspConnection) {
    return false;
  }

  try {
    const result = await lspConnection.sendRequest(ShowDocumentRequest.type, params);
    return result.success;
  } catch (error) {
    return false;
  }
}

// header line
// <<<<<<< Editing by Tabby <.#=+->
// markers:
// [<] header
// [#] comments
// [.] waiting
// [|] in progress
// [=] unchanged
// [+] inserted
// [-] deleted
// [>] footer
// footer line
// >>>>>>> End of changes
export function generateChangesPreview(edit: Edit): string[] {
  const lines: string[] = [];
  let markers = "";
  // lines.push(`<<<<<<< ${stateDescription} {{markers}}[${edit.id}]`);
  markers += "[";
  // comments: split by new line or 80 chars
  const commentLines = edit.comments
    .trim()
    .split(/\n|(.{1,80})(?:\s|$)/g)
    .filter((input) => !isBlank(input));
  const commentPrefix = getCommentPrefix(edit.languageId);
  for (const line of commentLines) {
    lines.push(commentPrefix + line);
    markers += "#";
  }
  const pushDiffValue = (diffValue: string, marker: string) => {
    diffValue
      .replace(/\n$/, "")
      .split("\n")
      .forEach((line) => {
        lines.push(line);
        markers += marker;
      });
  };
  // diffs
  const diffs = Diff.diffLines(edit.originalText, edit.editedText);
  if (edit.state === "completed") {
    diffs.forEach((diff) => {
      if (diff.added) {
        pushDiffValue(diff.value, "+");
      } else if (diff.removed) {
        pushDiffValue(diff.value, "-");
      } else {
        pushDiffValue(diff.value, "=");
      }
    });
  } else {
    let inProgressChunk = 0;
    const lastDiff = diffs[diffs.length - 1];
    if (lastDiff && lastDiff.added) {
      inProgressChunk = 1;
    }
    let waitingChunks = 0;
    for (let i = diffs.length - inProgressChunk - 1; i >= 0; i--) {
      if (diffs[i]?.removed) {
        waitingChunks++;
      } else {
        break;
      }
    }
    let lineIndex = 0;
    while (lineIndex < diffs.length - inProgressChunk - waitingChunks) {
      const diff = diffs[lineIndex];
      if (!diff) {
        break;
      }
      if (diff.added) {
        pushDiffValue(diff.value, "+");
      } else if (diff.removed) {
        pushDiffValue(diff.value, "-");
      } else {
        pushDiffValue(diff.value, "=");
      }
      lineIndex++;
    }
    if (inProgressChunk && lastDiff) {
      if (edit.state === "stopped") {
        pushDiffValue(lastDiff.value, "+");
      } else {
        pushDiffValue(lastDiff.value, "|");
      }
    }
    while (lineIndex < diffs.length - inProgressChunk) {
      const diff = diffs[lineIndex];
      if (!diff) {
        break;
      }
      if (edit.state === "stopped") {
        pushDiffValue(diff.value, "=");
      } else {
        pushDiffValue(diff.value, ".");
      }
      lineIndex++;
    }
  }
  // footer
  lines.push(`>>>>>>> ${edit.id} {{markers}}`);
  markers += "]";
  // replace markers
  // lines[0] = lines[0]!.replace("{{markers}}", markers);
  lines[lines.length - 1] = lines[lines.length - 1]!.replace("{{markers}}", markers);
  return lines;
}

export function createCloseTagMatcher(tag: string): RegExp {
  let reg = `${tag}`;
  for (let length = tag.length - 1; length > 0; length--) {
    reg += "|" + tag.substring(0, length) + "$";
  }
  return new RegExp(reg, "g");
}

// FIXME: improve this
export function getCommentPrefix(languageId: string) {
  if (["plaintext", "markdown"].includes(languageId)) {
    return "";
  }
  if (["python", "ruby"].includes(languageId)) {
    return "#";
  }
  if (
    [
      "c",
      "cpp",
      "java",
      "javascript",
      "typescript",
      "javascriptreact",
      "typescriptreact",
      "go",
      "rust",
      "swift",
      "kotlin",
    ].includes(languageId)
  ) {
    return "//";
  }
  return "";
}

export function truncateFileContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  content = content.slice(0, maxLength
```

### Core Architecture Module: `clients/tabby-agent/src/utils/array.ts`
```
declare global {
  interface Array<T> {
    distinct(identity?: (x: T) => any): Array<T>;
    mapAsync<U>(callbackfn: (value: T, index: number, array: T[]) => U | Promise<U>, thisArg?: any): Promise<U[]>;
  }
}

if (!Array.prototype.distinct) {
  Array.prototype.distinct = function <T>(this: T[], identity?: (x: T) => any): T[] {
    return [...new Map(this.map((item) => [identity?.(item) ?? item, item])).values()];
  };
}

if (!Array.prototype.mapAsync) {
  Array.prototype.mapAsync = async function <T, U>(
    this: T[],
    callbackfn: (value: T, index: number, array: T[]) => U | Promise<U>,
    thisArg?: any,
  ): Promise<U[]> {
    return await Promise.all(this.map((item, index) => callbackfn.call(thisArg, item, index, this)));
  };
}

export default {};

```

### Core Architecture Module: `clients/tabby-agent/src/utils/diff.ts`
```
import { Range, Position } from "vscode-languageserver";
import { linesDiffComputers, Range as DiffRange } from "codiff";

interface CodeDiffResult {
  originRanges: Range[];
  modifiedRanges: Range[];
}

function splitRangeToSingleLine(range: DiffRange, codeLines: string[]): DiffRange[] {
  if (range.isSingleLine()) {
    return [range];
  }
  const resultRanges: DiffRange[] = [];
  for (let i = range.startLineNumber; i <= range.endLineNumber; i++) {
    const singlelineRange = new DiffRange(
      i,
      i === range.startLineNumber ? range.startColumn : 1,
      i,
      i === range.endLineNumber ? range.endColumn : codeLines[i - 1]?.length ?? 1,
    );
    resultRanges.push(singlelineRange);
  }
  return resultRanges;
}

function mapDiffRangeToEditorRange(diffRange: DiffRange, editorRanges: Range[]): Range | undefined {
  if (diffRange.isEmpty()) {
    return undefined;
  }

  /**
   * diff range must be splited to single line before being mapped to editor range.
   */
  if (!diffRange.isSingleLine()) {
    return undefined;
  }

  const start: Position = {
    line: editorRanges[diffRange.startLineNumber - 1]?.start.line ?? 0,
    character: diffRange.startColumn - 1,
  };

  const end = {
    line: editorRanges[diffRange.startLineNumber - 1]?.start.line ?? 0,
    character: diffRange.endColumn - 1,
  };

  return {
    start,
    end,
  };
}

/**
 * Diff code and mapping the diff result range to editor range
 */
export function codeDiff(
  originCode: string[],
  originCodeRanges: Range[],
  modifiedCode: string[],
  modifiedCodeRanges: Range[],
): CodeDiffResult {
  const originRanges: Range[] = [];
  const modifiedRanges: Range[] = [];

  const diffResult = linesDiffComputers.getDefault().computeDiff(originCode, modifiedCode, {
    computeMoves: false,
    ignoreTrimWhitespace: true,
    maxComputationTimeMs: 100,
  });

  diffResult.changes.forEach((change) => {
    change.innerChanges?.forEach((innerChange) => {
      splitRangeToSingleLine(innerChange.originalRange, originCode).forEach((singleLineRange) => {
        const originRange = mapDiffRangeToEditorRange(singleLineRange, originCodeRanges);
        if (originRange) {
          originRanges.push(originRange);
        }
      });

      splitRangeToSingleLine(innerChange.modifiedRange, modifiedCode).forEach((singleLineRange) => {
        const modifiedRange = mapDiffRangeToEditorRange(singleLineRange, modifiedCodeRanges);
        if (modifiedRange) {
          modifiedRanges.push(modifiedRange);
        }
      });
    });
  });

  return {
    modifiedRanges,
    originRanges,
  };
}

```

### Core Architecture Module: `clients/tabby-agent/src/utils/error.ts`
```
// Http Error
export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly response: Response;

  constructor(response: Response) {
    super(`${response.status} ${response.statusText}`);
    this.name = "HttpError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
  }
}

export class MutexAbortError extends Error {
  constructor() {
    super("Aborted due to new request.");
    this.name = "AbortError";
  }
}

export function isTimeoutError(error: any) {
  return (
    (error instanceof Error && error.name === "TimeoutError") ||
    (error instanceof HttpError && [408, 499].includes(error.status))
  );
}

export function isCanceledError(error: any) {
  return error instanceof Error && error.name === "AbortError";
}

export function isUnauthorizedError(error: any) {
  return error instanceof HttpError && [401, 403].includes(error.status);
}

export function isRateLimitExceededError(error: any) {
  return error instanceof HttpError && error.status === 429;
}

function errorToString(error: Error) {
  let message = error.message || error.toString();
  if (error.cause instanceof Error) {
    message += "\nCaused by: " + errorToString(error.cause);
  }
  return message;
}

export function formatErrorMessage(error: unknown) {
  return error instanceof Error ? errorToString(error) : JSON.stringify(error);
}

```

### Core Architecture Module: `clients/tabby-agent/src/utils/languageId.ts`
```
import * as path from "path";

// https://code.visualstudio.com/docs/languages/identifiers

export function getLanguageId(uri: string): string {
  const extensionToLanguageId: { [key: string]: string } = {
    ".abap": "abap",
    ".bat": "bat",
    ".bib": "bibtex",
    ".clj": "clojure",
    ".coffee": "coffeescript",
    ".c": "c",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".css": "css",
    ".cu": "cuda-cpp",
    ".d": "d",
    ".dart": "dart",
    ".pas": "pascal",
    ".diff": "diff",
    ".dockerfile": "dockerfile",
    ".erl": "erlang",
    ".fs": "fsharp",
    ".go": "go",
    ".groovy": "groovy",
    ".hbs": "handlebars",
    ".haml": "haml",
    ".hs": "haskell",
    ".html": "html",
    ".ini": "ini",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".json": "json",
    ".jsonc": "jsonc",
    ".jl": "julia",
    ".tex": "latex",
    ".less": "less",
    ".lua": "lua",
    ".m": "objective-c",
    ".mm": "objective-cpp",
    ".ml": "ocaml",
    ".pl": "perl",
    ".php": "php",
    ".txt": "plaintext",
    ".ps1": "powershell",
    ".pug": "pug",
    ".py": "python",
    ".r": "r",
    ".cshtml": "razor",
    ".rb": "ruby",
    ".rs": "rust",
    ".scss": "scss",
    ".sass": "sass",
    ".shader": "shaderlab",
    ".sh": "shellscript",
    ".slim": "slim",
    ".sql": "sql",
    ".styl": "stylus",
    ".svelte": "svelte",
    ".swift": "swift",
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".vb": "vb",
    ".vue": "vue",
    ".xml": "xml",
    ".xsl": "xsl",
    ".yaml": "yaml",
    ".yml": "yaml",
    // Add more extensions as needed
  };

  const basenameToLanguageId: { [key: string]: string } = {
    Dockerfile: "dockerfile",
    Makefile: "makefile",
    "git-commit": "git-commit",
    "git-rebase": "git-rebase",
    // Add more special filenames as needed
  };

  const basename = path.basename(uri);
  if (basenameToLanguageId[basename]) {
    return basenameToLanguageId[basename];
  }

  const ext = path.extname(uri).toLowerCase();
  if (extensionToLanguageId[ext]) {
    return extensionToLanguageId[ext];
  }

  // Return extname without the dot as default
  return ext ? ext.slice(1) : "plaintext";
}

```

### Core Architecture Module: `clients/tabby-agent/src/utils/range.ts`
```
import { Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

export function isPositionEqual(a: Position, b: Position): boolean {
  return a.line === b.line && a.character === b.character;
}
export function isPositionBefore(a: Position, b: Position): boolean {
  return a.line < b.line || (a.line === b.line && a.character < b.character);
}
export function isPositionAfter(a: Position, b: Position): boolean {
  return a.line > b.line || (a.line === b.line && a.character > b.character);
}
export function isPositionBeforeOrEqual(a: Position, b: Position): boolean {
  return a.line < b.line || (a.line === b.line && a.character <= b.character);
}
export function isPositionAfterOrEqual(a: Position, b: Position): boolean {
  return a.line > b.line || (a.line === b.line && a.character >= b.character);
}
export function isPositionInRange(a: Position, b: Range): boolean {
  return isPositionBeforeOrEqual(b.start, a) && isPositionBeforeOrEqual(a, b.end);
}
export function isRangeEqual(a: Range, b: Range): boolean {
  return isPositionEqual(a.start, b.start) && isPositionEqual(a.end, b.end);
}
export function isEmptyRange(a: Range): boolean {
  return isPositionAfterOrEqual(a.start, a.end);
}
export function unionRange(a: Range, b: Range): Range {
  return {
    start: isPositionBefore(a.start, b.start)
      ? { line: a.start.line, character: a.start.character }
      : { line: b.start.line, character: b.start.character },
    end: isPositionAfter(a.end, b.end)
      ? { line: a.end.line, character: a.end.character }
      : { line: b.end.line, character: b.end.character },
  };
}
export function intersectionRange(a: Range, b: Range): Range | null {
  const range = {
    start: isPositionAfter(a.start, b.start)
      ? { line: a.start.line, character: a.start.character }
      : { line: b.start.line, character: b.start.character },
    end: isPositionBefore(a.end, b.end)
      ? { line: a.end.line, character: a.end.character }
      : { line: b.end.line, character: b.end.character },
  };
  return isEmptyRange(range) ? null : range;
}
export function documentRange(doc: TextDocument): Range {
  return {
    start: {
      line: 0,
      character: 0,
    },
    end: {
      line: doc.lineCount,
      character: 0,
    },
  };
}
export function rangeInDocument(a: Range, doc: TextDocument): Range | null {
  return intersectionRange(a, documentRange(doc));
}

```

### Core Architecture Module: `clients/tabby-agent/src/utils/signal.ts`
```
// Polyfill for AbortSignal.any(signals) which added in Node.js v20.
export function abortSignalFromAnyOf(signals: (AbortSignal | undefined)[]) {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal?.aborted) {
      controller.abort(signal.reason);
      return signal;
    }
    signal?.addEventListener("abort", () => controller.abort(signal.reason), {
      signal: controller.signal,
    });
  }
  return controller.signal;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4400** (2025-12-15): **Registration of invited users - Email is case sensitive**
  *Symptoms*: **Describe the bug** When I invite users with the company emails as they appear in MS Teams, i.e. Firstname.Lastname@company.com with names capitalized, the users aren't able to register unless they enter their email with the same capitalization. Emails can technically be case sensitive in the local part, but this is uncommon and leads to confusion if checked against. In the case of an invite link, the email field could be omitted altogether, since the invite is already tied to an email address.  **Information about your version** `tabby 0.31.2`  **Information about your GPU** ``` +-----------------------------------------------------------------------------------------+ | NVIDIA-SMI 570.195.03             Driver Version: 570.195.03     CUDA Version: 12.8     | |-----------------------------------------+------------------------+----------------------+ | GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC | | Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. | |                                         |                        |               MIG M. | |=========================================+========================+======================| |   0  NVIDIA GeForce RTX 4090        Off |   00000000:00:05.0 Off |                  Off | | 30%   35C    P0             57W /  450W |   18530MiB /  24564MiB |      0%      Default | |                                         |                        |                
  **Post-Mortem & Fix Analysis**:
  > Thank you for the bug report. This is indeed a side effect of invitation validation, and we will address it in the next release.

- **Issue #4337** (2025-08-14): **Llms.txt parsing is broken**
  *Symptoms*: Tabby 0.30.2, [ref Slack topic](https://tabbyml.slack.com/archives/C05CWLZ0Y85/p1752749364857119)  ---  I've added custom docs, and it says  ``` Fetched and split llms-full.txt successfully. Indexing 17 sections. ```  in the job. Makes sense, as my llms-full.txt contains ~17 # (h1) sections, a big Markdown amalgamation. However, whatever my question is for the AnswerEngine, it's always attaching the last document only.  Just one, the last one, not anything else from other 16 documents, regardless of the contents of my question.   ---  The problem persists.  I've added https://vuejs.org/ as custom context provider.  I'm using OpenAI embeddings.  Again, it only attaches the latest indexed document (it will ALWAYS attach the "Ways of using Vue", which is the latest section).  <img width="907" height="195" alt="Image" src="https://github.com/user-attachments/assets/1c9e9812-4bfa-40d3-954c-b9155e9dcf6e" />  <img width="909" height="231" alt="Image" src="https://github.com/user-attachments/assets/fee2c3a6-c2a6-4d93-9c90-1ae866c3ecf5" />  <img width="956" height="548" alt="Image" src="https://github.com/user-attachments/assets/3682aa1b-554a-41d6-863d-6b0df2f6653b" />  <img width="447" height="413" alt="Image" src="https://github.com/user-attachments/assets/d50abd8e-de19-4eec-88b1-aee87d3ba52e" />  

- **Issue #4298** (2025-06-30): **Unable to load multi-model ggml files**
  *Symptoms*: **Describe the bug** Tabby server fails to start if multi-model ggml (`model-00001-of-00002.gguf`, `model-00002-of-00002.gguf`) files are used.   It works only if _single_ model ggml `model-00001-of-00001.gguf` file is present.  The Tabby [model spec](https://github.com/TabbyML/tabby/blob/main/MODEL_SPEC.md#ggml) seems to indicate that multiple ggml files should be supported or am I reading it wrong?  My local model folder has multiple `model-{index}-of-{count}.gguf` files, following the llama.cpp naming [convention](https://github.com/ggml-org/llama.cpp/discussions/6404#discussioncomment-9083339).  **Are multi-model ggml files (already or planned to be) supported?**  **Information about your version** Please provide output of `tabby --version` ```shell tabby 0.29.0 ``` **Note**: I use [Docker image](https://tabby.tabbyml.com/docs/quick-start/installation/docker-compose/) to run tabby.  **Information about your GPU** ```shell  /usr/lib/wsl/lib/nvidia-smi                                                                           photon: Wed Jun 25 17:44:34 2025  Wed Jun 25 17:44:34 2025 +-----------------------------------------------------------------------------------------+ | NVIDIA-SMI 570.152                Driver Version: 573.24         CUDA Version: 12.8     | |-----------------------------------------+------------------------+----------------------+ | GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC | | Fan  Temp   Perf          Pw
  **Post-Mortem & Fix Analysis**:
  > Hi @visitsb, thank you for the report. I have looked into it and identified the issue. We support the split model from our registry but not the local model. I will submit a PR today to address this.

- **Issue #4089** (2025-05-28): **repeated "content-type" in headers when send https request to models api**
  *Symptoms*: **Describe the bug** When sending a request to the api point of a model, the "content-type" will be repeated twice, like this following:  POST /compatible-mode/v1/embeddings HTTP/1.1 content-type: application/json content-type: application/json authorization: Bearer sk-abc accept: */* host: dashscope.aliyuncs.com content-length: 53  {"input":["hello Tabby"],"model":"text-embedding-v3"}  This may cause the model http api providers return an error.  **Information about your version** tabby 0.26.0  **Information about your GPU** (I use remote model http api, so I think it is irrelevant) NVIDIA-SMI 470.141.03   Driver Version: 470.141.03   CUDA Version: 11.4   **Additional context** Some model http api providers may require very strict http schema, even they claim the apis are compatible with openai.  This could happen when use [alibaba cloud model studio](https://www.alibabacloud.com/help/en/model-studio/embedding-interfaces-compatible-with-openai). I found the alibaba  embedding model api keep returning errors. After remove the redundant `content-type` in requests, the api works fine.  In this code snippet in file /crates/http-api-bindings/src/embedding/openai.rs: ```         let request_builder = self             .client             .post(&self.api_endpoint)             .json(&request)             .header("content-type", "application/json")             .bearer_auth(&self.api_key); ``` I don't think the line `.header("content-type", "application/json")` is necessary, because th
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting the bug. It appears that the simplest solution is to remove the line `.header("content-type", "application/json")`
  > Hi! I'd like to work on this if it's available. Can I assign this to myself?

- **Issue #3961** (2025-03-27): **Context Provider: Fail to repeat-scan large codebase (Chromium fork) after first successful scan**
  *Symptoms*: **Describe the bug** After a successful scan of a Chromium sized repo (it is a Chromium fork) as a Context Provider, the repeat scans fail to conclude. I get no status info in the logs in the dashboard, and the CL output repeats the same log over and over (see provided additional details).  I have ran this in a WSL2 environment, first with a 12gb cap on memory, then a 24gb cap, neither caps were reached but found it worth to try at least.  Additionally I have ran this both with `--device cuda` and without. The noticeable difference was a 50% less memory usage (9.4gb vs +-4gb with/without), but neither provided resolution.  **Information about your version** Please provide output of `tabby --version` ```bash ***:~/tabby$ ./tabby --version tabby 0.25.1 ```  **Information about your GPU** Please provide output of `nvidia-smi` ```bash ***:~/tabby$ nvidia-smi Thu Mar  6 15:58:03 2025 +-----------------------------------------------------------------------------------------+ | NVIDIA-SMI 570.86.09              Driver Version: 571.96         CUDA Version: 12.8     | |-----------------------------------------+------------------------+----------------------+ | GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC | | Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. | |                                         |                        |               MIG M. | |=========================================+=============
  **Post-Mortem & Fix Analysis**:
  > Hi - thanks for reporting the issue. Before looking this into depth, could you verify you're actually able to access files in the repo? e.g `/chrome/test/data/encoding_tests/alias_mapping/ISO-8859-13.html`? How do you configure the context provider?
  > Hey, the paths were modified in the log for security reasons. I access it as a local provider `file:///{path-to-local-git-checkout}/`. The directories co-exist with tabby in wsl2, so they are all 'local' in the sense that no mounting of volumes is going on etc.. The repo's are fully checked out on disk and accessible.  It did build the index fine (weighs in around 4gb according to the system dashboard). I have 2 other repos (much smaller), that went fine.  By comparison the Chromium repo has about 500.000 files, the 2 smaller repos have <1000 files each.
  > I just wrapped up a test with removing the offending files, and it resulted in the same log: ``` WARN tabby_webserver::service::background_job::helper::logger: ee/tabby-webserver/src/service/background_job/helper/logger.rs:90: Failed to send log record: no available capacity ``` , but with no preceding warnings now (which makes sense as those files are no longer there). So it looks like those warnings might be a red herring.

- **Issue #3914** (2025-03-26): **katana 1.1.2 changes its content format, breaking the crawler**
  *Symptoms*: **Describe the bug** Katana dosn't crawl on any sites (Crawled 0 documents) ``` 2025-02-26T12:03:29.498362+03:00 [INFO]: Starting doc index pipeline for https://docs.docker.com/ 2025-02-26T12:03:29.549084+03:00 [INFO]:  2025-02-26T12:03:29.549096+03:00 [INFO]:    __        __                 2025-02-26T12:03:29.549099+03:00 [INFO]:   / /_____ _/ /____ ____  ___ _ 2025-02-26T12:03:29.549102+03:00 [INFO]:  /  '_/ _  / __/ _  / _ \/ _  / 2025-02-26T12:03:29.549106+03:00 [INFO]: /_/\_\\_,_/\__/\_,_/_//_/\_,_/							  2025-02-26T12:03:29.549110+03:00 [INFO]:  2025-02-26T12:03:29.549112+03:00 [INFO]: 		projectdiscovery.io 2025-02-26T12:03:29.549115+03:00 [INFO]:  2025-02-26T12:03:29.966096+03:00 [INFO]: [INF] Current katana version v1.1.2 (latest) 2025-02-26T12:03:29.975756+03:00 [INFO]: [INF] Started standard crawling for => https://docs.docker.com/ 2025-02-26T12:03:54.745328+03:00 [INFO]: Crawled 0 documents from 'https://docs.docker.com/' 2025-02-26T12:03:54.749115+03:00 [INFO]: Job completed successfully ```  **Information about your version** Please provide output of `tabby --version` Version 0.25.1  **Information about your GPU** Please provide output of `nvidia-smi` ``` Thu Feb 27 10:55:08 2025        +-----------------------------------------------------------------------------------------+ | NVIDIA-SMI 550.120                Driver Version: 550.120        CUDA Version: 12.4     | |-----------------------------------------+------------------------+----------------------+ | 
  **Post-Mortem & Fix Analysis**:
  > For website heavily utilize client side rendering, you need to turn on https://demo.tabbyml.com/files/github/TabbyML/tabby/-/blob/3477544c2d54b8dcdf237ed1f3d1184b7dcc08dd/crates/tabby-crawler/src/lib.rs#L21 to enable headless browser for crawling.
  > > For website heavily utilize client side rendering, you need to turn on https://demo.tabbyml.com/files/github/TabbyML/tabby/-/blob/3477544c2d54b8dcdf237ed1f3d1184b7dcc08dd/crates/tabby-crawler/src/lib.rs#L21 to enable headless browser for crawling.  I have enabled this env, but it's not helping. I tried to run katana with the same arguments locally, everything loaded fine.  ``` katana -headless -headless-options --disable-gpu -u https://docs.docker.com/     __        __                   / /_____ _/ /____ ____  ___ _  /  '_/ _  / __/ _  / _ \/ _  / /_/\_\\_,_/\__/\_,_/_//_/\_,_/							   		projectdiscovery.io  [INF] Current katana version v1.1.2 (latest) [INF] Started headless crawling for => https://docs.docker.com/ https://docs.docker.com/css/styles.min.6cf4825d17631ae59d150b53dcd71fd448a7c5cb17b83ed4853902a925893a60.css https://docs.docker.com/scripts.js https://docs.docker.com/ https://docs.docker.com/contribute/ https://docs.docker.com/contribute/style/voice-tone https://www.dock
  > run by ``` RUST_LOG=debug TABBY_CRAWL_ENABLE_HEADLESS=true TABBY_DISABLE_USAGE_COLLECTION=true TABBY_OLLAMA_ALLOW_PULL=yes TABBY_ROOT=~/.tabby TABBY_MODEL_CACHE_ROOT=~/.tabby/models TABBY_WEBSERVER_JWT_TOKEN_SECRET=<redacted> ~/repos/tabby/target/release/tabby serve --port 1122 --model Qwen2.5-Coder-7B --device cuda --chat-model Qwen2.5-Coder-1.5B-Instruct ```

- **Issue #3871** (2025-02-21): **Chat does not work with LiteLLM proxy server v1.61.8 and Tabby v0.24.0**
  *Symptoms*: **Describe the bug** When attempting to chat through Tabby with any of the models I have configured in a LiteLLM proxy, I see the error message  ``` 2025-02-18T16:48:25.387034Z ERROR tabby_webserver::service::answer: ee/tabby-webserver/src/service/answer.rs:227: Failed to get chat completion chunk: JSONDeserialize(Error("missing field `finish_reason`", line: 1, column: 445)) ```  ![Image](https://github.com/user-attachments/assets/517284e8-ca8b-4bef-8f48-17665aa4bbda)  If I try to issue a manual request to the server using cURL, e.g.,  ```bash curl -s -X POST 'http://0.0.0.0:4000/chat/completions' \         -H 'Content-Type: application/json' \         -d '{       "model": "'azure-openai-gpt-4o'",       "messages": [           {               "role": "system",               "content": "You are a helpful assistant."           },           {               "role": "user",               "content": "What model are you?"           }       ]     }' ```  I get the expected, well-formatted response from the proxy server, which includes a "finish_reason": "stop":  ``` {"id":"chatcmpl-B2L6jtfdEFiOt16nmr3331FZ1JjZm","created":1739897493,"model":"gpt-4o-2024-11-20","object":"chat.completion","system_fingerprint":"fp_f3927aa00d","choices":[{"finish_reason":"stop","index":0,"message":{"content":"I am OpenAI's GPT-4, a language model designed to assist with a variety of tasks, answer questions, and provide helpful information. How can I assist you today?","role":"assistant","tool_calls":null
  **Post-Mortem & Fix Analysis**:
  > In case it helps to understand the issue, this is the full (verbose) log of the streamed response from LiteLLM's side, in response to the chat message sent by Tabby:  ``` INFO:     127.0.0.1:56218 - "POST /chat/completions HTTP/1.1" 200 OK PROCESSED ASYNC CHUNK PRE CHUNK CREATOR: ChatCompletionChunk(id='', choices=[], created=0, model='', object='', service_tier=None, system_fingerprint=None, usage=None, prompt_filter_results=[{'prompt_index': 0, 'content_filter_results': {'hate': {'filtered': False, 'severity': 'safe'}, 'jailbreak': {'filtered': False, 'detected': False}, 'self_harm': {'filtered': False, 'severity': 'safe'}, 'sexual': {'filtered': False, 'severity': 'safe'}, 'violence': {'filtered': False, 'severity': 'safe'}}}])  Raw OpenAI Chunk ChatCompletionChunk(id='', choices=[], created=0, model='', object='', service_tier=None, system_fingerprint=None, usage=None, prompt_filter_results=[{'prompt_index': 0, 'content_filter_results': {'hate': {'filtered': False, 'severity': 'saf
  > Hello @joaodinissf, could you please share your configuration here and attempt to run Tabby with `RUST_LOG=ERROR` as follows:  ```bash RUST_LOG=ERROR ./tabby serve ```  Afterward, please retry the request and post the logs here, we can dive deeper into it
  > Thanks, @zwpaper.  Here is the error log after setting `RUST_LOG=ERROR`: ``` 2025-02-19T17:53:37.070463Z ERROR async_openai_alt::error: /root/.cargo/registry/src/index.crates.io-6f17d22bba15001f/async-openai-alt-0.26.1/src/error.rs:71: failed deserialization of: {"id":"chatcmpl-B2iYKyW67OdNuCVhUWbpJ0huXMW0N","created":1739987617,"model":"gpt-4o-2024-11-20","object":"chat.completion.chunk","system_fingerprint":"fp_f3927aa00d","choices":[{"content_filter_results":{"hate":{"filtered":false,"severity":"safe"},"self_harm":{"filtered":false,"severity":"safe"},"sexual":{"filtered":false,"severity":"safe"},"violence":{"filtered":false,"severity":"safe"}},"index":0,"delta":{"content":"I","role":"assistant"}}]} 2025-02-19T17:53:37.070505Z ERROR tabby_webserver::service::answer: ee/tabby-webserver/src/service/answer.rs:227: Failed to get chat completion chunk: JSONDeserialize(Error("missing field `finish_reason`", line: 1, column: 445)) 2025-02-19T17:53:37.070570Z ERROR async_openai_alt::error: /

- **Issue #3838** (2025-02-20): **Eclipse plugin is always "Loading chat panel..."**
  *Symptoms*: **Describe the bug** I installed the plug-in according to the following documents. During the "launch of an Eclipse application", tabby chat was fine. However, after the Export and re-installation, Tabby Chat is always "Loading chat panel...".  Console error log: LANGUAGE_SERVER_TO_LSP4E com.tabbyml.tabby4eclipse.languageServer: {"jsonrpc":"2.0","id":"5","error":{"code":-32603,"message":"Request tabby/status failed with message: Cannot read properties of null (reading 'inlineCompletion')"}}  https://github.com/TabbyML/tabby/blob/main/clients/eclipse/README.md  **Information about your version** tabby 0.24.0 eclipse 2024-12 tabby eclipse plugin 0.0.2.31 (Built in the main branch)  **Information about your GPU** Geforce RTX 2080Ti  **Additional context**  ![Image](https://github.com/user-attachments/assets/51cca1c8-6f25-4a1b-94db-aaa2949ebc6d)
  **Post-Mortem & Fix Analysis**:
  > Hi @13535048320,  Thank you for reporting this issue.  Could you please provide the full logs related to this error? It will be very helpful.   You can enable language server logs for Tabby by navigating to `Window -> Preferences -> Language Servers -> Log`.  Thank you! 
  > > Hi [@13535048320](https://github.com/13535048320), >  > Thank you for reporting this issue. >  > Could you please provide the full logs related to this error? It will be very helpful. You can enable language server logs for Tabby by navigating to `Window -> Preferences -> Language Servers -> Log`. >  > Thank you!  @icycodes This is the log file, thanks! [com.tabbyml.tabby4eclipse.languageServer.log](https://github.com/user-attachments/files/18793768/com.tabbyml.tabby4eclipse.languageServer.log)
  > I am closing this issue since https://github.com/TabbyML/tabby/releases/tag/v0.25.0 has been released, please verify your issues with the latest version of Tabby, and feel free to reopen if it's not resolved.

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

### Incident Patch 1: `21b29048` (2026-06-30)
**Commit Message**: Revert "feat: add Avian as a model provider (#4448)" (#4510)

This reverts commit e8608d6d8f4016b9836a72037f72630d7e993468.

**File**: `website/docs/references/models-http-api/avian.md` (removed, +0/-50)
```diff
@@ -1,50 +0,0 @@
-# Avian
-
-[Avian](https://avian.io/) is an inference API provider offering access to frontier open-source models through an OpenAI-compatible endpoint. Available models include DeepSeek V3.2, Kimi K2.5, GLM-5, and MiniMax M2.5.
-
-## Chat Model
-
-Avian provides an OpenAI-compatible chat API interface.
-
-```toml title="~/.tabby/config.toml"
-[model.chat.http]
-kind = "openai/chat"
-model_name = "deepseek/deepseek-v3.2"
-api_endpoint = "https://api.avian.io/v1"
-api_key = "your-api-key"
-```
-
-You can also configure multi-model support to switch between available models:
-
-```toml title="~/.tabby/config.toml"
-[model.chat.http]
-kind = "openai/chat"
-model_name = "deepseek/deepseek-v3.2"
-supported_models = [
-  "deepseek/deepseek-v3.2",
-  "moonshotai/kimi-k2.5",
-  "z-ai/glm-5",
-  "minimax/minimax-m2.5"
-]
-api_endpoint = "https://api.avian.io/v1"
-api_key = "your-api-key"
-```
-
-## Completion Model
-
-Avian does not currently offer a dedicated completion (FIM) API endpoint.
-
-## Embeddings Model
-
-Avian does not currently offer embedding model APIs.
-
-## Available Models
-
-| Model | Context Length | Max Output |
-|---|---|---|
-| `deepseek/deepseek-v3.2` | 164K | 65K |
-| `moonshotai/kimi-k2.5` | 131K | 8K |
-| `z-ai/glm-5` | 131K | 16K |
-| `minimax/minimax-m2.5` | 1M | 1M |
-
-For the latest model list and pricing, visit [Avian](https://avian.io/).
```

---

### Incident Patch 2: `57311042` (2026-02-09)
**Commit Message**: fix: correct typo 'seperated' to 'separated' (#4437)

Co-authored-by: thecaptain789 <[REDACTED_EMAIL]>

**File**: `python/tabby-eval/modal/predict.py` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ def read_dataframe_from_file(language: str, file: str) -> pd.DataFrame:
 
 @stub.local_entrypoint()
 async def main(language: str, files: str):
-    #Multiple files seperated by ','
+    #Multiple files separated by ','
     
     model = Model()
 
```

---

### Incident Patch 3: `1881e9cf` (2026-01-22)
**Commit Message**: fix(context-provider): fix the issue that failed to get branch splited by slash (#4427)

**File**: `crates/tabby-git/src/lib.rs` (modified, +9/-1)
```diff
@@ -110,8 +110,16 @@ pub fn sync_refs(root: &Path, url: &str, refs: &Vec<String>) -> anyhow::Result<(
     }
 
     for ref_name in refs {
-        let branch = ref_name.rsplit('/').next().unwrap_or(ref_name);
+        let branch = if let Some(branch) = ref_name.strip_prefix("refs/heads/") {
+            branch
+        } else if let Some(tag) = ref_name.strip_prefix("refs/tags/") {
+            tag
+        } else {
+            ref_name
+        };
+
         // get the current branch name without refs/ prefix
+
         let output = Command::new("git")
             .current_dir(root)
             .arg("symbolic-ref")
```

**File**: `ee/tabby-webserver/src/service/repository/git.rs` (modified, +21/-8)
```diff
@@ -155,15 +155,28 @@ fn to_git_repository(repo: RepositoryDAO, job_info: JobInfo) -> GitRepository {
 
     let refs = if let Some(refs) = &repo.refs {
         let config_refs: Vec<String> = serde_json::from_str(refs).unwrap_or_default();
-        all_refs
+        config_refs
             .into_iter()
-            .filter(|r| {
-                let ref_name = r.name.rsplit('/').next().unwrap_or(&r.name);
-                config_refs.iter().any(|cr| cr == ref_name)
-            })
-            .map(|r| GitReference {
-                name: r.name,
-                commit: r.commit,
+            .map(|name| {
+                let ref_name = all_refs
+                    .iter()
+                    .find(|r| {
+                        r.name == format!("refs/heads/{}", name)
+                            || r.name == format!("refs/tags/{}", name)
+                    })
+                    .map(|r| r.name.clone())
+                    .unwrap_or(format!("refs/heads/{}", name));
+
+                let commit = all_refs
+                    .iter()
+                    .find(|r| r.name == ref_name)
+                    .map(|r| r.commit.clone())
+                    .unwrap_or_default();
+
+                GitReference {
+                    name: ref_name,
+                    commit,
+                }
             })
             .collect()
     } else {
```

**File**: `ee/tabby-webserver/src/service/repository/third_party.rs` (modified, +11/-2)
```diff
@@ -312,14 +312,23 @@ fn to_provided_repository(value: ProvidedRepositoryDAO, job_info: JobInfo) -> Pr
         config_refs
             .into_iter()
             .map(|name| {
+                let ref_name = all_refs
+                    .iter()
+                    .find(|r| {
+                        r.name == format!("refs/heads/{}", name)
+                            || r.name == format!("refs/tags/{}", name)
+                    })
+                    .map(|r| r.name.clone())
+                    .unwrap_or(format!("refs/heads/{}", name));
+
                 let commit = all_refs
                     .iter()
-                    .find(|r| r.name.rsplit('/').next().unwrap_or(&r.name) == name.as_str())
+                    .find(|r| r.name == ref_name)
                     .map(|r| r.commit.clone())
                     .unwrap_or_default();
 
                 GitReference {
-                    name: format!("refs/heads/{name}"),
+                    name: ref_name,
                     commit,
                 }
             })
```

---

### Incident Patch 4: `91c12a6d` (2025-12-25)
**Commit Message**: Revert "feat: omit email when sign up using invitation (#4402)" (#4416)

**File**: `ee/tabby-schema/graphql/schema.graphql` (modified, +1/-1)
```diff
@@ -840,7 +840,7 @@ type Mutation {
   updateUserRole(id: ID!, isAdmin: Boolean!): Boolean!
   uploadUserAvatarBase64(id: ID!, avatarBase64: String): Boolean!
   updateUserName(id: ID!, name: String!): Boolean!
-  register(email: String, password1: String!, password2: String!, invitationCode: String, name: String!): RegisterResponse!
+  register(email: String!, password1: String!, password2: String!, invitationCode: String, name: String!): RegisterResponse!
   tokenAuth(email: String!, password: String!): TokenAuthResponse!
   tokenAuthLdap(userId: String!, password: String!): TokenAuthResponse!
   verifyToken(token: String!): Boolean!
```

**File**: `ee/tabby-schema/src/schema/auth.rs` (modified, +2/-33)
```diff
@@ -89,7 +89,7 @@ pub struct RegisterInput {
         code = "email",
         message = "Email must be at most 128 characters"
     ))]
-    pub email: Option<String>,
+    pub email: String,
     #[validate(length(
         min = 8,
         max = 20,
@@ -454,7 +454,7 @@ pub struct LdapCredential {
 pub trait AuthenticationService: Send + Sync {
     async fn register(
         &self,
-        email: Option<String>,
+        email: String,
         password1: String,
         invitation_code: Option<String>,
         name: Option<String>,
@@ -575,34 +575,3 @@ fn validate_password_impl(
 
     Ok(())
 }
-
-#[cfg(test)]
-mod tests {
-    use validator::Validate;
-
-    use super::*;
-
-    #[test]
-    fn test_register_input_validation() {
-        let input = RegisterInput {
-            email: None,
-            password1: "Password123!".to_string(),
-            password2: "Password123!".to_string(),
-        };
-        assert!(input.validate().is_ok());
-
-        let input = RegisterInput {
-            email: Some("test@example.com".to_string()),
-            password1: "Password123!".to_string(),
-            password2: "Password123!".to_string(),
-        };
-        assert!(input.validate().is_ok());
-
-        let input = RegisterInput {
-            email: Some("invalid-email".to_string()),
-            password1: "Password123!".to_string(),
-            password2: "Password123!".to_string(),
-        };
-        assert!(input.validate().is_err());
-    }
-}
```

**File**: `ee/tabby-schema/src/schema/mod.rs` (modified, +1/-1)
```diff
@@ -1210,7 +1210,7 @@ impl Mutation {
 
     async fn register(
         ctx: &Context,
-        email: Option<String>,
+        email: String,
         password1: String,
         password2: String,
         invitation_code: Option<String>,
```

**File**: `ee/tabby-ui/app/auth/signup/components/user-register-form.tsx` (modified, +29/-42)
```diff
@@ -31,7 +31,7 @@ import {
 export const registerUser = graphql(/* GraphQL */ `
   mutation register(
     $name: String!
-    $email: String
+    $email: String!
     $password1: String!
     $password2: String!
     $invitationCode: String
@@ -49,24 +49,13 @@ export const registerUser = graphql(/* GraphQL */ `
   }
 `)
 
-const formSchema = z
-  .object({
-    name: z.string(),
-    email: z.string().optional(),
-    password1: z.string(),
-    password2: z.string(),
-    invitationCode: z.string().optional()
-  })
-  .refine(
-    data => {
-      if (data.invitationCode) return true
-      return z.string().email().safeParse(data.email).success
-    },
-    {
-      message: 'Invalid email address',
-      path: ['email']
-    }
-  )
+const formSchema = z.object({
+  name: z.string(),
+  email: z.string().email('Invalid email address'),
+  password1: z.string(),
+  password2: z.string(),
+  invitationCode: z.string().optional()
+})
 
 interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
   invitationCode?: string
@@ -131,29 +120,27 @@ export function UserAuthForm({
               </FormItem>
             )}
           />
-          {!invitationCode && (
-            <FormField
-              control={form.control}
-              name="email"
-              render={({ field }) => (
-                <FormItem>
-                  <FormLabel>Email</FormLabel>
-                  <FormControl>
-                    <Input
-                      placeholder={`e.g. ${PLACEHOLDER_EMAIL_FORM}`}
-                      type="email"
-                      autoCapitalize="none"
-                      autoComplete="email"
-                      autoCorrect="off"
-                      {...field}
-                      value={field.value ?? ''}
-                    />
-                  </FormControl>
-                  <FormMessage />
-                </FormItem>
-              )}
-            />
-          )}
+          <FormField
+            control={form.control}
+            name="email"
+            render={({ field }) => (
+              <FormItem>
+                <FormLabel>Email</FormLabel>
+                <FormControl>
+                  <Input
+                    placeholder={`e.g. ${PLACEHOLDER_EMAIL_FORM}`}
+                    type="email"
+                    autoCapitalize="none"
+                    autoComplete="email"
+                    autoCorrect="off"
+                    {...field}
+                    value={field.value ?? ''}
+                  />
+                </FormControl>
+                <FormMessage />
+              </FormItem>
+            )}
+          />
           <div>
             <FormField
               control={form.control}
```

**File**: `ee/tabby-webserver/src/service/auth.rs` (modified, +15/-25)
```diff
@@ -94,7 +94,7 @@ fn create_impl(
 impl AuthenticationService for AuthenticationServiceImpl {
     async fn register(
         &self,
-        email: Option<String>,
+        email: String,
         password: String,
         invitation_code: Option<String>,
         name: Option<String>,
@@ -103,18 +103,8 @@ impl AuthenticationService for AuthenticationServiceImpl {
         if is_admin_initialized && is_demo_mode() {
             bail!("Registering new users is disabled in demo mode");
         }
-        let invitation = check_invitation(&self.db, is_admin_initialized, invitation_code).await?;
-
-        let email = match email {
-            Some(email) => email,
-            None => {
-                if let Some(invitation) = &invitation {
-                    invitation.email.clone()
-                } else {
-                    bail!("Email is required");
-                }
-            }
-        };
+        let invitation =
+            check_invitation(&self.db, is_admin_initialized, invitation_code, &email).await?;
 
         // check if email exists
         if self.db.get_user_by_email(&email).await?.is_some() {
@@ -842,6 +832,7 @@ async fn check_invitation(
     db: &DbConn,
     is_admin_initialized: bool,
     invitation_code: Option<String>,
+    email: &str,
 ) -> Result<Option<InvitationDAO>> {
     if !is_admin_initialized {
         // Creating the admin user, no invitation required
@@ -857,6 +848,10 @@ async fn check_invitation(
         return err;
     };
 
+    if invitation.email != email {
+        bail!("Invitation code is not for this email address");
+    }
+
     Ok(Some(invitation))
 }
 
@@ -1009,7 +1004,7 @@ mod tests {
     async fn register_admin_user(service: &impl AuthenticationService) -> RegisterResponse {
         service
             .register(
-                Some(ADMIN_EMAIL.to_owned()),
+                ADMIN_EMAIL.to_owned(),
                 ADMIN_PASSWORD.to_owned(),
                 None,
                 None,
@@ -1068,7 +1063,7 @@ mod tests {
         // Admin initialized, registeration requires a invitation code;
         assert_matches!(
             service
-                .register(Some(email.to_owned()), password.to_owned(), None, None)
+                .register(email.to_owned(), password.to_owned(), None, None)
                 .await,
             Err(_)
         );
@@ -1077,7 +1072,7 @@ mod tests {
         assert_matches!(
             service
                 .register(
-                    Some(email.to_owned()),
+                    email.to_owned(),
                     password.to_owned(),
                     Some("abc".to_owned()),
                     None
@@ -1089,7 +1084,7 @@ mod tests {
         // Register success.
         assert!(service
             .register(
-                Some(email.to_owned()),
+                email.to_owned(),
                 password.to_owned(),
                 Some(invitation.code.clone()),
                 None
@@ -1101,7 +1096,7 @@ mod tests {
         assert_matches!(
             service
                 .register(
-                    Some(email.to_owned()),
+                    email.to_owned(),
                     password.to_owned(),
                     Some(invitation.code.clone()),
                     None
@@ -1300,12 +1295,7 @@ mod tests {
             .unwrap();
 
         service
-            .register(
-                Some("test@example.com".into()),
-                "".into(),
-                Some(code.code),
-                None,
-            )
+            .register("test@example.com".into(), "".into(), Some(code.code), None)
             .await
             .unwrap();
 
@@ -1591,7 +1581,7 @@ mod tests {
 
         // Create owner user.
         service
-            .register(Some("a@example.com".into()), "pass".into(), None, None)
+            .register("a@example.com".into(), "pass".into(), None, None)
             .await
             .unwrap();
 
```

**File**: `ee/tabby-webserver/src/service/auth/testutils.rs` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ impl FakeAuthService {
 impl AuthenticationService for FakeAuthService {
     async fn register(
         &self,
-        _email: Option<String>,
+        _email: String,
         _password: String,
         _invitation_code: Option<String>,
         _name: Option<String>,
```

---

### Incident Patch 5: `ca4f9008` (2025-11-10)
**Commit Message**: docs(wsl): repair linux guide link path (#4391)

🤖 Generated with [Pochi](https://getpochi.com)

Co-authored-by: Pochi <[REDACTED_EMAIL]>

**File**: `website/docs/quick-start/installation/wsl.mdx` (modified, +6/-5)
```diff
@@ -12,8 +12,8 @@ You can install either **Ubuntu 22.04** or **Ubuntu 24.04** — both work with T
 
 > **Which version should I choose?**
 >
-> - Ubuntu **22.04** is the default and used in Tabby’s Docker image  
-> - Ubuntu **24.04** is newer and confirmed to work well with this guide  
+> - Ubuntu **22.04** is the default and used in Tabby’s Docker image
+> - Ubuntu **24.04** is newer and confirmed to work well with this guide
 >
 > To install WSL2: https://learn.microsoft.com/en-us/windows/wsl/install
 
@@ -27,11 +27,12 @@ After installation, reboot if required, then launch Ubuntu and set up your UNIX
 
 ## 2. Follow the Linux installation guide
 
-Once inside your Ubuntu WSL terminal, just follow the [Linux instructions](./linux). No extra steps
+Once inside your Ubuntu WSL terminal, just follow the [Linux instructions](../linux/). No extra steps
 needed — Tabby will run locally and privately, with GPU passthrough handled by WSL2 and Windows.
 
+
 ## 3. Access Tabby from Windows
 
-Once Tabby is running in Ubuntu, it will usually be available at:  
+Once Tabby is running in Ubuntu, it will usually be available at:
 
-`http://localhost:8080` (or your chosen port)
+`http://localhost:8080` (or your chosen port)
\ No newline at end of file
```

---

### Incident Patch 6: `e36de824` (2025-11-03)
**Commit Message**: docs(faq): add how to enable debug log (#4389)w

Adds a new entry to the FAQ page explaining how to enable debug logging in the Tabby server.

🤖 Generated with [Pochi](https://getpochi.com)

Co-authored-by: Pochi <[REDACTED_EMAIL]>

**File**: `website/docs/faq.mdx` (modified, +19/-0)
```diff
@@ -61,3 +61,22 @@ For more technical details about this limitation, please refer to the SQLite doc
 [Filesystems with broken or missing lock implementations](https://sqlite.org/howtocorrupt.html#_filesystems_with_broken_or_missing_lock_implementations).
 
 </Collapse>
+
+<Collapse title="How do I enable debug logging in the Tabby server?">
+
+The Tabby server utilizes the `RUST_LOG` environment variable to control logging levels.
+To enable debug logging, you can set this variable when you start the server.
+
+For example, if you are running Tabby from the command line, you can do so like this:
+
+```bash
+RUST_LOG=debug tabby serve
+```
+
+If you are using Docker, you can pass the environment variable using the `-e` flag:
+
+```bash
+docker run -e RUST_LOG=debug ...
+```
+
+</Collapse>
\ No newline at end of file
```

---

### Incident Patch 7: `e6ee6cc3` (2025-08-26)
**Commit Message**: fix(db): improve connection pool configuration for database creation (#4350)

Co-authored-by: Pochi <[REDACTED_EMAIL]>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `ee/tabby-db/src/lib.rs` (modified, +17/-10)
```diff
@@ -1,4 +1,4 @@
-use std::{path::Path, sync::Arc};
+use std::{path::Path, sync::Arc, time::Duration};
 
 use anyhow::anyhow;
 pub use attachment::{
@@ -21,7 +21,11 @@ pub use pages::{PageDAO, PageSectionDAO};
 pub use provided_repositories::ProvidedRepositoryDAO;
 pub use repositories::RepositoryDAO;
 pub use server_setting::ServerSettingDAO;
-use sqlx::{query, query_scalar, sqlite::SqliteQueryResult, Pool, Sqlite, SqlitePool};
+use sqlx::{
+    query, query_scalar,
+    sqlite::{SqlitePoolOptions, SqliteQueryResult},
+    Pool, Sqlite, SqlitePool,
+};
 pub use threads::{ThreadDAO, ThreadMessageDAO};
 use tokio::sync::Mutex;
 use user_completions::UserCompletionDailyStatsDAO;
@@ -115,17 +119,13 @@ fn make_pagination_query_with_condition(
 impl DbConn {
     #[cfg(any(test, feature = "testutils"))]
     pub async fn new_in_memory() -> Result<Self> {
-        use std::{str::FromStr, time::Duration};
+        use std::str::FromStr;
 
         use sqlx::sqlite::SqlitePoolOptions;
 
         let options = SqliteConnectOptions::from_str("sqlite::memory:")?;
-        let pool: Pool<Sqlite> = SqlitePoolOptions::new()
-            .max_connections(20)
-            .min_connections(2)
-            .acquire_timeout(Duration::from_secs(6))
-            .idle_timeout(Duration::from_secs(300))
-            .max_lifetime(Duration::from_secs(3600))
+        let pool = SqlitePoolOptions::new()
+            .max_connections(1)
             .connect_with(options)
             .await?;
         DbConn::init_db(pool).await
@@ -173,7 +173,14 @@ impl DbConn {
             .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
             .filename(db_file)
             .create_if_missing(true);
-        let pool = SqlitePool::connect_with(options).await?;
+        let pool = SqlitePoolOptions::new()
+            .max_connections(64)
+            .min_connections(2)
+            .acquire_timeout(Duration::from_secs(6))
+            .idle_timeout(Duration::from_secs(300))
+            .max_lifetime(Duration::from_secs(3600))
+            .connect_with(options)
+            .await?;
         Self::backup_db(db_file, &pool).await?;
         Self::init_db(pool).await
     }
```

---

### Incident Patch 8: `eabca773` (2025-08-26)
**Commit Message**: fix(db): improve connection pool configuration for in-memory databases (#4349)

- Increase max_connections from 1 to 20
- Add min_connections setting (2)
- Add acquire_timeout (6 seconds)
- Add idle_timeout (5 minutes)
- Add max_lifetime (1 hour)
- Add explicit type annotation for pool

These changes should improve performance and stability for in-memory databases
used in tests and test utilities.

🤖 Generated with [Pochi](https://getpochi.com)

Co-authored-by: Pochi <[REDACTED_EMAIL]>

**File**: `ee/tabby-db/src/lib.rs` (modified, +7/-3)
```diff
@@ -115,13 +115,17 @@ fn make_pagination_query_with_condition(
 impl DbConn {
     #[cfg(any(test, feature = "testutils"))]
     pub async fn new_in_memory() -> Result<Self> {
-        use std::str::FromStr;
+        use std::{str::FromStr, time::Duration};
 
         use sqlx::sqlite::SqlitePoolOptions;
 
         let options = SqliteConnectOptions::from_str("sqlite::memory:")?;
-        let pool = SqlitePoolOptions::new()
-            .max_connections(1)
+        let pool: Pool<Sqlite> = SqlitePoolOptions::new()
+            .max_connections(20)
+            .min_connections(2)
+            .acquire_timeout(Duration::from_secs(6))
+            .idle_timeout(Duration::from_secs(300))
+            .max_lifetime(Duration::from_secs(3600))
             .connect_with(options)
             .await?;
         DbConn::init_db(pool).await
```

---

### Incident Patch 9: `1d3fbba5` (2025-08-18)
**Commit Message**: fix(ui): correct branding form initialization logic (#4342)

**File**: `ee/tabby-ui/app/(dashboard)/settings/general/components/branding-form.tsx` (modified, +2/-2)
```diff
@@ -264,7 +264,7 @@ const BrandingForm: React.FC<BrandingFormProps> = ({
 }
 
 export const GeneralBrandingForm = () => {
-  const [{ data, stale }, reexecuteQuery] = useQuery({
+  const [{ data, fetching, stale }, reexecuteQuery] = useQuery({
     query: brandingSettingQuery
   })
 
@@ -274,7 +274,7 @@ export const GeneralBrandingForm = () => {
 
   return (
     <div className="min-h-[160px]">
-      <LoadingWrapper loading={stale} fallback={<FormSkeleton />}>
+      <LoadingWrapper loading={fetching || stale} fallback={<FormSkeleton />}>
         <BrandingForm
           defaultValues={{
             brandingLogo: data?.brandingSetting?.brandingLogo ?? undefined,
```

---

### Incident Patch 10: `06cac2c0` (2025-08-18)
**Commit Message**: fix(server): ensure proper license validation for branding settings (#4341)

**File**: `ee/tabby-schema/src/schema/license.rs` (modified, +1/-0)
```diff
@@ -97,6 +97,7 @@ impl LicenseInfo {
     }
 
     pub fn ensure_available_features(&self, feature: LicenseFeature) -> Result<()> {
+        self.ensure_valid_license()?;
         if let Some(features) = &self.features {
             if features.contains(&feature) {
                 return Ok(());
```

**File**: `ee/tabby-ui/app/(dashboard)/settings/general/components/general.tsx` (modified, +17/-2)
```diff
@@ -2,7 +2,11 @@
 
 import React from 'react'
 
-import { LicenseFeature } from '@/lib/gql/generates/graphql'
+import {
+  GetLicenseInfoQuery,
+  LicenseFeature,
+  LicenseStatus
+} from '@/lib/gql/generates/graphql'
 import { useLicense } from '@/lib/hooks/use-license'
 import { Separator } from '@/components/ui/separator'
 
@@ -18,7 +22,7 @@ export default function General() {
       <GeneralFormSection title="Network">
         <GeneralNetworkForm />
       </GeneralFormSection>
-      {data?.license.features?.includes(LicenseFeature.CustomLogo) && (
+      {hasValidLicenseFeature(data, LicenseFeature.CustomLogo) && (
         <>
           <Separator className="mb-8" />
           <GeneralFormSection title="Branding">
@@ -33,3 +37,14 @@ export default function General() {
     </div>
   )
 }
+
+const hasValidLicenseFeature = (
+  licenseData: GetLicenseInfoQuery | undefined,
+  feature: LicenseFeature
+): boolean => {
+  return (
+    !!licenseData?.license &&
+    licenseData.license.status === LicenseStatus.Ok &&
+    !!licenseData.license.features?.includes(feature)
+  )
+}
```

---

### Incident Patch 11: `5a312157` (2025-08-14)
**Commit Message**: fix(crawler): append URL-encoded section titles as fragments to llms.txt URLs (#4338)

* feat(crawler): append URL-encoded section titles as fragments to llms.txt URLs

This enhancement ensures that each section in llms.txt files gets a unique URL
by appending the URL-encoded section title as a fragment. This prevents URL
collisions when multiple sections share the same base URL and improves
navigation within crawled documents.

Changes:
- Add percent-encoding dependency for URL encoding
- Modify split_llms_content to append encoded titles as URL fragments
- Update metadata description to use base URL instead of full URL
- Add comprehensive tests for the new fragment URL behavior

🤖 Generated with [Pochi](https://getpochi.com)

Co-Authored-By: Pochi <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Co-authored-by: Pochi <[REDACTED_EMAIL]>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -5561,6 +5561,7 @@ dependencies = [
  "futures",
  "htmd",
  "logkit",
+ "percent-encoding",
  "readable-readability",
  "regex",
  "reqwest",
```

**File**: `crates/tabby-crawler/Cargo.toml` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ tokio = { workspace = true, features = ["io-util", "process", "rt"] }
 anyhow.workspace = true
 tracing.workspace = true
 url.workspace = true
+percent-encoding = "2.3"
 readable-readability = "0.4.0"
 futures.workspace = true
 async-stream.workspace = true
```

**File**: `crates/tabby-crawler/src/llms_txt_parser.rs` (modified, +68/-14)
```diff
@@ -1,3 +1,5 @@
+use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
+
 use crate::types::{CrawledDocument, CrawledMetadata};
 
 pub fn split_llms_content(content: &str, base_url: &str) -> Vec<CrawledDocument> {
@@ -13,10 +15,13 @@ pub fn split_llms_content(content: &str, base_url: &str) -> Vec<CrawledDocument>
             // If we already have a section in progress, finalize it.
             if let Some(title) = current_title.take() {
                 // Use the URL from the section if available; otherwise, fallback to base_url.
-                let url = current_url.take().unwrap_or_else(|| base_url.to_owned());
+                let base_url_str = current_url.take().unwrap_or_else(|| base_url.to_owned());
+                // URL-encode the title and append it as a fragment
+                let encoded_title = utf8_percent_encode(&title, NON_ALPHANUMERIC).to_string();
+                let url = format!("{base_url_str}#{encoded_title}");
                 let metadata = CrawledMetadata {
                     title: title.into(),
-                    description: url.clone().into(),
+                    description: base_url_str.into(),
                 };
                 docs.push(CrawledDocument::new(
                     url,
@@ -39,10 +44,13 @@ pub fn split_llms_content(content: &str, base_url: &str) -> Vec<CrawledDocument>
 
     // Finalize the last section if any.
     if let Some(title) = current_title {
-        let url = current_url.unwrap_or_else(|| base_url.to_owned());
+        let base_url_str = current_url.unwrap_or_else(|| base_url.to_owned());
+        // URL-encode the title and append it as a fragment
+        let encoded_title = utf8_percent_encode(&title, NON_ALPHANUMERIC).to_string();
+        let url = format!("{base_url_str}#{encoded_title}");
         let metadata = CrawledMetadata {
             title: title.into(),
-            description: url.clone().into(),
+            description: base_url_str.into(),
         };
         docs.push(CrawledDocument::new(
             url,
@@ -74,8 +82,11 @@ More text on the same section.
         let doc = &docs[0];
         // The title is taken from the heading.
         assert_eq!(doc.metadata.title, Some("Test Title with URL".to_string()));
-        // The URL should be extracted from the URL: line.
-        assert_eq!(doc.url, "https://developers.cloudflare.com");
+        // The URL should be extracted from the URL: line with encoded title appended.
+        assert_eq!(
+            doc.url,
+            "https://developers.cloudflare.com#Test%20Title%20with%20URL"
+        );
         // The body should contain the text after the URL line.
         assert_eq!(
             doc.markdown,
@@ -101,8 +112,11 @@ Line two of body.
             doc.metadata.title,
             Some("Test Title with Source".to_string())
         );
-        // The URL should be extracted from the Source: line.
-        assert_eq!(doc.url, "https://docs.perplexity.ai");
+        // The URL should be extracted from the Source: line with encoded title appended.
+        assert_eq!(
+            doc.url,
+            "https://docs.perplexity.ai#Test%20Title%20with%20Source"
+        );
         assert_eq!(
             doc.markdown,
             "This is another test body.\nLine two of body."
@@ -126,8 +140,11 @@ Additional content line.
             doc.metadata.title,
             Some("Test Title without URL or Source".to_string())
         );
-        // Fallback to the provided base_url.
-        assert_eq!(doc.url, "example.com");
+        // Fallback to the provided base_url with encoded title appended.
+        assert_eq!(
+            doc.url,
+            "example.com#Test%20Title%20without%20URL%20or%20Source"
+        );
         assert_eq!(
             doc.markdown,
             "This is test body with no explicit URL.\nAdditional content line."
@@ -156,22 +173,59 @@ Content for section three with no metadata.
         // Section One.
         let doc1 = &docs[0];
         assert_eq!(doc1.metadata.title, Some("Section One".to_string()));
-        assert_eq!(doc1.url, "https://developers.cloudflare.com");
+        assert_eq!(doc1.url, "https://developers.cloudflare.com#Section%20One");
         assert!(doc1.markdown.contains("Content for section one."));
 
         // Section Two.
         let doc2 = &docs[1];
         assert_eq!(doc2.metadata.title, Some("Section Two".to_string()));
-        assert_eq!(doc2.url, "https://docs.perplexity.ai");
+        assert_eq!(doc2.url, "https://docs.perplexity.ai#Section%20Two");
         assert!(doc2.markdown.contains("Content for section two."));
 
         // Section Three.
         let doc3 = &docs[2];
         assert_eq!(doc3.metadata.title, Some("Section Three".to_string()));
-        // Since no URL/Source is provided, fallback to base_url.
-        assert_eq!(doc3.url, "example.com");
+        // Since no URL/Source is provided, fallback to base_url with encoded title appended.
+        assert_eq
```

---

### Incident Patch 12: `f9ac6218` (2025-08-07)
**Commit Message**: feat(server, ui): support custom logo (#4334)

* feat(server): support white label

* update: ui

* refetch branding logo

* update

* update

* update: query

* revert caddy change

* [autofix.ci] apply automated fixes

* lint

* [autofix.ci] apply automated fixes

* update: remove image button

* [autofix.ci] apply automated fixes

* update

* [autofix.ci] apply automated fixes

* update: license key

* update

* update: remove branding_name

* update

* update: feature enum

* update: lint

---------

Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `ee/tabby-db/migrations/0048_add-branding-column.down.sql` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+ALTER TABLE server_setting DROP COLUMN branding_logo;
+ALTER TABLE server_setting DROP COLUMN branding_icon;
```

**File**: `ee/tabby-db/migrations/0048_add-branding-column.up.sql` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+ALTER TABLE server_setting ADD COLUMN branding_logo TEXT DEFAULT NULL;
+ALTER TABLE server_setting ADD COLUMN branding_icon TEXT DEFAULT NULL;
```

**File**: `ee/tabby-db/schema/schema.sql` (modified, +3/-1)
```diff
@@ -64,7 +64,9 @@ CREATE TABLE server_setting(
   network_external_url STRING NOT NULL DEFAULT 'http://localhost:8080'
   ,
   billing_enterprise_license STRING,
-  security_disable_password_login BOOLEAN NOT NULL DEFAULT FALSE
+  security_disable_password_login BOOLEAN NOT NULL DEFAULT FALSE,
+  branding_logo TEXT DEFAULT NULL,
+  branding_icon TEXT DEFAULT NULL
 );
 CREATE TABLE email_setting(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
```

**File**: `ee/tabby-db/src/server_setting.rs` (modified, +24/-1)
```diff
@@ -10,6 +10,8 @@ pub struct ServerSettingDAO {
     pub security_disable_client_side_telemetry: bool,
     pub security_disable_password_login: bool,
     pub network_external_url: String,
+    pub branding_logo: Option<String>,
+    pub branding_icon: Option<String>,
 }
 
 const SERVER_SETTING_ROW_ID: i32 = 1;
@@ -35,7 +37,9 @@ impl DbConn {
                 network_external_url,
                 security_allowed_register_domain_list,
                 billing_enterprise_license,
-                security_disable_password_login
+                security_disable_password_login,
+                branding_logo,
+                branding_icon
             FROM server_setting
             WHERE id = ?;",
         )
@@ -106,6 +110,23 @@ impl DbConn {
         Ok(())
     }
 
+    pub async fn update_branding_setting(
+        &self,
+        branding_logo: Option<String>,
+        branding_icon: Option<String>,
+    ) -> Result<()> {
+        sqlx::query!(
+            "UPDATE server_setting SET branding_logo = ?, branding_icon = ? WHERE id = ?",
+            branding_logo,
+            branding_icon,
+            SERVER_SETTING_ROW_ID
+        )
+        .execute(&self.pool)
+        .await?;
+
+        Ok(())
+    }
+
     pub async fn read_enterprise_license(&self) -> Result<Option<String>> {
         Ok(sqlx::query_scalar(
             "SELECT billing_enterprise_license FROM server_setting WHERE id = ?;",
@@ -142,6 +163,8 @@ mod tests {
             security_disable_client_side_telemetry: false,
             security_disable_password_login: false,
             network_external_url: "http://localhost:8080".into(),
+            branding_logo: None,
+            branding_icon: None,
         }
     }
     #[test]
```

**File**: `ee/tabby-schema/graphql/schema.graphql` (modified, +17/-0)
```diff
@@ -78,6 +78,10 @@ enum LdapEncryptionKind {
   LDAPS
 }
 
+enum LicenseFeature {
+  CUSTOM_LOGO
+}
+
 enum LicenseStatus {
   OK
   EXPIRED
@@ -121,6 +125,11 @@ enum Role {
   ASSISTANT
 }
 
+input BrandingSettingInput {
+  brandingLogo: String
+  brandingIcon: String
+}
+
 input CodeQueryInput {
   filepath: String
   language: String
@@ -468,6 +477,11 @@ type AuthProvider {
   kind: AuthProviderKind!
 }
 
+type BrandingSetting {
+  brandingLogo: String
+  brandingIcon: String
+}
+
 type ChatCompletionMessage {
   role: String!
   content: String!
@@ -692,6 +706,7 @@ type LicenseInfo {
   seatsUsed: Int!
   issuedAt: DateTime
   expiresAt: DateTime
+  features: [LicenseFeature!]
 }
 
 type Message {
@@ -845,6 +860,7 @@ type Mutation {
   updateEmailSetting(input: EmailSettingInput!): Boolean!
   updateSecuritySetting(input: SecuritySettingInput!): Boolean!
   updateNetworkSetting(input: NetworkSettingInput!): Boolean!
+  updateBrandingSetting(input: BrandingSettingInput!): Boolean!
   deleteEmailSetting: Boolean!
   uploadLicense(license: String!): Boolean!
   resetLicense: Boolean!
@@ -1085,6 +1101,7 @@ type Query {
   emailSetting: EmailSetting
   networkSetting: NetworkSetting!
   securitySetting: SecuritySetting!
+  brandingSetting: BrandingSetting!
   gitRepositories(after: String, before: String, first: Int, last: Int): RepositoryConnection!
   "Search files that matches the pattern in the repository."
   repositorySearch(kind: RepositoryKind!, id: ID!, rev: String, pattern: String!): [FileEntrySearchResult!]!
```

**File**: `ee/tabby-schema/src/dao.rs` (modified, +10/-0)
```diff
@@ -30,6 +30,7 @@ use crate::{
         user_event::{EventKind, UserEvent},
         CoreError,
     },
+    setting::BrandingSetting,
     thread::{self},
 };
 
@@ -132,6 +133,15 @@ impl From<ServerSettingDAO> for NetworkSetting {
     }
 }
 
+impl From<ServerSettingDAO> for BrandingSetting {
+    fn from(value: ServerSettingDAO) -> Self {
+        Self {
+            branding_logo: value.branding_logo,
+            branding_icon: value.branding_icon,
+        }
+    }
+}
+
 impl TryFrom<IntegrationDAO> for Integration {
     type Error = anyhow::Error;
     fn try_from(value: IntegrationDAO) -> anyhow::Result<Self> {
```

**File**: `ee/tabby-schema/src/schema/license.rs` (modified, +18/-0)
```diff
@@ -23,6 +23,11 @@ pub enum LicenseStatus {
     SeatsExceeded,
 }
 
+#[derive(GraphQLEnum, PartialEq, Debug, Clone, Deserialize)]
+pub enum LicenseFeature {
+    CustomLogo,
+}
+
 #[derive(GraphQLObject)]
 pub struct LicenseInfo {
     pub r#type: LicenseType,
@@ -31,6 +36,7 @@ pub struct LicenseInfo {
     pub seats_used: i32,
     pub issued_at: Option<DateTime<Utc>>,
     pub expires_at: Option<DateTime<Utc>>,
+    pub features: Option<Vec<LicenseFeature>>,
 }
 
 impl LicenseInfo {
@@ -89,6 +95,18 @@ impl LicenseInfo {
             duration.num_days()
         })
     }
+
+    pub fn ensure_available_features(&self, feature: LicenseFeature) -> Result<()> {
+        if let Some(features) = &self.features {
+            if features.contains(&feature) {
+                return Ok(());
+            }
+        }
+
+        Err(CoreError::InvalidLicense(
+            "Your plan doesn't include support for this feature.",
+        ))
+    }
 }
 
 #[async_trait]
```

**File**: `ee/tabby-schema/src/schema/mod.rs` (modified, +20/-1)
```diff
@@ -87,7 +87,8 @@ use self::{
         RepositoryKind, RepositoryService, UpdateIntegrationInput,
     },
     setting::{
-        NetworkSetting, NetworkSettingInput, SecuritySetting, SecuritySettingInput, SettingService,
+        BrandingSetting, NetworkSetting, NetworkSettingInput, SecuritySetting,
+        SecuritySettingInput, SettingService,
     },
     user_event::{UserEvent, UserEventService},
     web_documents::{CreateCustomDocumentInput, CustomWebDocument, WebDocumentService},
@@ -422,6 +423,12 @@ impl Query {
         ctx.locator.setting().read_security_setting().await
     }
 
+    async fn branding_setting(ctx: &Context) -> Result<BrandingSetting> {
+        let license = ctx.locator.license().read().await?;
+        license.ensure_available_features(license::LicenseFeature::CustomLogo)?;
+        ctx.locator.setting().read_branding_setting().await
+    }
+
     async fn git_repositories(
         &self,
         ctx: &Context,
@@ -1375,6 +1382,18 @@ impl Mutation {
         Ok(true)
     }
 
+    async fn update_branding_setting(
+        ctx: &Context,
+        input: setting::BrandingSettingInput,
+    ) -> Result<bool> {
+        check_admin(ctx).await?;
+        let license = ctx.locator.license().read().await?;
+        license.ensure_available_features(license::LicenseFeature::CustomLogo)?;
+        input.validate()?;
+        ctx.locator.setting().update_branding_setting(input).await?;
+        Ok(true)
+    }
+
     async fn delete_email_setting(ctx: &Context) -> Result<bool> {
         check_admin(ctx).await?;
         ctx.locator.email().delete_setting().await?;
```

---

### Incident Patch 13: `e86449e1` (2025-08-01)
**Commit Message**: chore(ci): fix download llama from upstream and drop cuda11.7 release (#4331)

**File**: `.github/workflows/release.yml` (modified, +3/-9)
```diff
@@ -33,7 +33,6 @@ jobs:
           - aarch64-apple-darwin
           - x86_64-manylinux_2_28
           - x86_64-manylinux_2_28-cuda123
-          - x86_64-windows-msvc
         include:
           - os: macos-latest
             target: aarch64-apple-darwin
@@ -49,11 +48,6 @@ jobs:
             binary: x86_64-manylinux_2_28-cuda123
             container: sameli/manylinux_2_28_x86_64_cuda_12.3@sha256:e12416bf249ab312f9dcfdebd7939b968dd6f1b6f810abbede818df875e86a7c
             build_args: --features binary,cuda
-          - os: windows-2022
-            target: x86_64-pc-windows-msvc
-            binary: x86_64-windows-msvc
-            build_args: --features binary
-            ext: .exe
 
     env:
       SCCACHE_GHA_ENABLED: true
@@ -235,13 +229,13 @@ jobs:
       - name: Display structure of downloaded files
         run: ls -R
 
-      - name: Package CUDA 11.7 for Windows
+      - name: Package CPU for Windows
         run: >
-          LLAMA_CPP_PLATFORM=win-cuda-cu11.7-x64 OUTPUT_NAME=tabby_x86_64-windows-msvc-cuda117 ./ci/package-from-upstream.sh
+          LLAMA_CPP_PLATFORM=win-cpu-x64 OUTPUT_NAME=tabby_x86_64-windows-msvc-cpu ./ci/package-from-upstream.sh
 
       - name: Package CUDA 12.4 for Windows
         run: >
-          LLAMA_CPP_PLATFORM=win-cuda-cu12.4-x64 OUTPUT_NAME=tabby_x86_64-windows-msvc-cuda124 ./ci/package-from-upstream.sh
+          LLAMA_CPP_PLATFORM=win-cuda-12.4-x64 OUTPUT_NAME=tabby_x86_64-windows-msvc-cuda124 ./ci/package-from-upstream.sh
 
       - name: Package Vulkan for Windows
         run: >
```

**File**: `ci/package-from-upstream.sh` (modified, +7/-4)
```diff
@@ -1,18 +1,21 @@
 #!/bin/bash
 
+set -e
+
 # get current bash file directory
 PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 LLAMA_CPP_PATH="${PROJECT_ROOT}/crates/llama-cpp-server/llama.cpp"
 
 # Input variables
 LLAMA_CPP_VERSION=${LLAMA_CPP_VERSION:-$(cd ${LLAMA_CPP_PATH} && git fetch --tags origin >/dev/null && git describe --tags --abbrev=0)}
 echo "LLAMA_CPP_VERSION=${LLAMA_CPP_VERSION}"
-LLAMA_CPP_PLATFORM=${LLAMA_CPP_PLATFORM:-win-cuda-cu11.7-x64}
-OUTPUT_NAME=${OUTPUT_NAME:-tabby_x86_64-windows-msvc-cuda117}
+LLAMA_CPP_PLATFORM=${LLAMA_CPP_PLATFORM:-win-cuda-12.4-x64}
 
 NAME=llama-${LLAMA_CPP_VERSION}-bin-${LLAMA_CPP_PLATFORM}
 ZIP_FILE=${NAME}.zip
 
+OUTPUT_NAME=${OUTPUT_NAME:-tabby_x86_64-windows-msvc-cuda124}
+
 if [[ ${LLAMA_CPP_PLATFORM} == win* ]]; then
     TABBY_BINARY=${TABBY_BINARY:-tabby_x86_64-windows-msvc.exe}
     TABBY_EXTENSION=.exe
@@ -27,7 +30,7 @@ cp "./${TABBY_BINARY}"/${TABBY_BINARY} ${OUTPUT_NAME}/tabby${TABBY_EXTENSION}
 
 pushd ${OUTPUT_NAME}
 if [[ ${LLAMA_CPP_PLATFORM} == win* ]]; then
-    rm $(ls *.exe | grep -v -e "tabby" -e "llama-server")
+    rm -f $(ls *.exe | grep -v -e "tabby" -e "llama-server")
 
     popd
     zip -r ${OUTPUT_NAME}.zip ${OUTPUT_NAME}
@@ -36,7 +39,7 @@ else
     mv build/bin/* .
     rm -r build
 
-    rm $(ls . | grep -v -e "tabby" -e "llama-server" -e '.so$' -e "LICENSE")
+    rm -f $(ls . | grep -v -e "tabby" -e "llama-server" -e '.so$' -e "LICENSE")
     mv LICENSE LICENSE-llama-server
     chmod +x llama-server tabby
 
```

---

### Incident Patch 14: `56661ba6` (2025-07-29)
**Commit Message**: fix(sqlx): use 0.7.3 sqlx to avoid pool timeout (#4328)

* fix(sqlx): use 0.7.3 sqlx to avoid pool timeout

* update

**File**: `Cargo.lock` (modified, +45/-14)
```diff
@@ -269,6 +269,16 @@ version = "1.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"
 
+[[package]]
+name = "atomic-write-file"
+version = "0.1.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cbf54d4588732bdfc5ebc3eb9f74f20e027112fc31de412fc7ff0cd1c6896dae"
+dependencies = [
+ "nix",
+ "rand 0.8.5",
+]
+
 [[package]]
 name = "auto_enums"
 version = "0.8.5"
@@ -636,6 +646,12 @@ version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "baf1de4339761588bc0619e3cbc0120ee582ebb74b53b4efbf79117bd2da40fd"
 
+[[package]]
+name = "cfg_aliases"
+version = "0.1.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "fd16c4719339c4530435d38e511904438d07cce7950afa3718a84ac36c10e89e"
+
 [[package]]
 name = "chrono"
 version = "0.4.38"
@@ -3050,6 +3066,18 @@ version = "1.0.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "650eef8c711430f1a879fdd01d4745a7deea475becfb90269c06775983bbf086"
 
+[[package]]
+name = "nix"
+version = "0.28.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ab2156c4fce2f8df6c499cc1c763e4394b7482525bf2a9701c9d79d215f519e4"
+dependencies = [
+ "bitflags 2.6.0",
+ "cfg-if",
+ "cfg_aliases",
+ "libc",
+]
+
 [[package]]
 name = "nodrop"
 version = "0.1.14"
@@ -5024,8 +5052,8 @@ dependencies = [
 
 [[package]]
 name = "sqlx"
-version = "0.7.4"
-source = "git+https://github.com/wsxiaoys/sqlx?rev=8ca573c#8ca573cc0e323a637261a8f2cbc4a7c3c7b4e133"
+version = "0.7.3"
+source = "git+https://github.com/wsxiaoys/sqlx?rev=77eb94d#77eb94dd672531bf1fec190aadf2f742cfb5a8db"
 dependencies = [
  "sqlx-core",
  "sqlx-macros",
@@ -5036,8 +5064,8 @@ dependencies = [
 
 [[package]]
 name = "sqlx-core"
-version = "0.7.4"
-source = "git+https://github.com/wsxiaoys/sqlx?rev=8ca573c#8ca573cc0e323a637261a8f2cbc4a7c3c7b4e133"
+version = "0.7.3"
+source = "git+https://github.com/wsxiaoys/sqlx?rev=77eb94d#77eb94dd672531bf1fec190aadf2f742cfb5a8db"
 dependencies = [
  "ahash",
  "atoi",
@@ -5046,6 +5074,7 @@ dependencies = [
  "chrono",
  "crc",
  "crossbeam-queue",
+ "dotenvy",
  "either",
  "event-listener",
  "futures-channel",
@@ -5075,8 +5104,8 @@ dependencies = [
 
 [[package]]
 name = "sqlx-macros"
-version = "0.7.4"
-source = "git+https://github.com/wsxiaoys/sqlx?rev=8ca573c#8ca573cc0e323a637261a8f2cbc4a7c3c7b4e133"
+version = "0.7.3"
+source = "git+https://github.com/wsxiaoys/sqlx?rev=77eb94d#77eb94dd672531bf1fec190aadf2f742cfb5a8db"
 dependencies = [
  "proc-macro2",
  "quote",
@@ -5087,9 +5116,10 @@ dependencies = [
 
 [[package]]
 name = "sqlx-macros-core"
-version = "0.7.4"
-source = "git+https://github.com/wsxiaoys/sqlx?rev=8ca573c#8ca573cc0e323a637261a8f2cbc4a7c3c7b4e133"
+version = "0.7.3"
+source = "git+https://github.com/wsxiaoys/sqlx?rev=77eb94d#77eb94dd672531bf1fec190aadf2f742cfb5a8db"
 dependencies = [
+ "atomic-write-file",
  "dotenvy",
  "either",
  "heck 0.4.1",
@@ -5124,8 +5154,8 @@ dependencies = [
 
 [[package]]
 name = "sqlx-mysql"
-version = "0.7.4"
-source = "git+https://github.com/wsxiaoys/sqlx?rev=8ca573c#8ca573cc0e323a637261a8f2cbc4a7c3c7b4e133"
+version = "0.7.3"
+source = "git+https://github.com/wsxiaoys/sqlx?rev=77eb94d#77eb94dd672531bf1fec190aadf2f742cfb5a8db"
 dependencies = [
  "atoi",
  "base64 0.21.7",
@@ -5166,8 +5196,8 @@ dependencies = [
 
 [[package]]
 name = "sqlx-postgres"
-version = "0.7.4"
-source = "git+https://github.com/wsxiaoys/sqlx?rev=8ca573c#8ca573cc0e323a637261a8f2cbc4a7c3c7b4e133"
+version = "0.7.3"
+source = "git+https://github.com/wsxiaoys/sqlx?rev=77eb94d#77eb94dd672531bf1fec190aadf2f742cfb5a8db"
 dependencies = [
  "atoi",
  "base64 0.21.7",
@@ -5193,6 +5223,7 @@ dependencies = [
  "rand 0.8.5",
  "serde",
  "serde_json",
+ "sha1",
  "sha2",
  "smallvec",
  "sqlx-core",
@@ -5215,8 +5246,8 @@ dependencies = [
 
 [[package]]
 name = "sqlx-sqlite"
-version = "0.7.4"
-source = "git+https://github.com/wsxiaoys/sqlx?rev=8ca573c#8ca573cc0e323a637261a8f2cbc4a7c3c7b4e133"
+version = "0.7.3"
+source = "git+https://github.com/wsxiaoys/sqlx?rev=77eb94d#77eb94dd672531bf1fec190aadf2f742cfb5a8db"
 dependencies = [
  "atoi",
  "chrono",
```

**File**: `Cargo.toml` (modified, +11/-5)
```diff
@@ -37,7 +37,7 @@ serde_json = "1"
 serdeconv = "0.4.1"
 tokio = "1.28"
 tokio-retry = "0.3.0"
-tokio-util = { version="0.7.10", features = ["full"] }
+tokio-util = { version = "0.7.10", features = ["full"] }
 tracing = "0.1"
 tokio-cron-scheduler = "0.9.4"
 tracing-subscriber = "0.3"
@@ -79,11 +79,17 @@ clap = "4.3.0"
 ratelimit = "0.10"
 tracing-opentelemetry = "0.28.0"
 opentelemetry = { version = "0.27.0", features = ["trace", "metrics"] }
-opentelemetry_sdk = { version = "0.27.0", default-features = false, features = ["trace", "rt-tokio"] }
+opentelemetry_sdk = { version = "0.27.0", default-features = false, features = [
+    "trace",
+    "rt-tokio",
+] }
 opentelemetry-otlp = { version = "0.27.0" }
-opentelemetry-semantic-conventions = { version = "0.27.0", features = ["semconv_experimental"] }
-# https://github.com/wsxiaoys/sqlx/tree/fix-0-7-4-remove-datetime-utc-encode
-sqlx = { git = "https://github.com/wsxiaoys/sqlx", rev = "8ca573c" }
+opentelemetry-semantic-conventions = { version = "0.27.0", features = [
+    "semconv_experimental",
+] }
+# https://github.com/launchbadge/sqlx/issues/3241#issuecomment-2260797292
+# https://github.com/wsxiaoys/sqlx/tree/fix-0-7-3-remove-date-time-encoding
+sqlx = { git = "https://github.com/wsxiaoys/sqlx", rev = "77eb94d" }
 validator = { version = "0.18.1", features = ["derive"] }
 
 [workspace.dependencies.uuid]
```

**File**: `crates/aim-downloader/src/https.rs` (modified, +1/-1)
```diff
@@ -153,7 +153,7 @@ impl HTTPSHandler {
         let mut stream = res.bytes_stream();
         while let Some(item) = stream.next().await {
             let chunk = item
-                .map_err(|e| format!("Error while downloading: {:?}", e))
+                .map_err(|e| format!("Error while downloading: {e:?}"))
                 .unwrap();
             out.write_all(&chunk)
                 .map_err(|_| "Error while writing to output.")
```

**File**: `crates/http-api-bindings/src/completion/llama.rs` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ impl LlamaCppEngine {
 
         Box::new(Self {
             client,
-            api_endpoint: format!("{}/completion", api_endpoint),
+            api_endpoint: format!("{api_endpoint}/completion"),
             api_key,
         })
     }
```

**File**: `crates/http-api-bindings/src/completion/mod.rs` (modified, +3/-4)
```diff
@@ -45,10 +45,9 @@ pub async fn create(model: &HttpModelConfig) -> Arc<dyn CompletionStream> {
             model.api_key.clone(),
             false,
         ),
-        unsupported_kind => panic!(
-            "Unsupported model kind for http completion: {}",
-            unsupported_kind
-        ),
+        unsupported_kind => {
+            panic!("Unsupported model kind for http completion: {unsupported_kind}")
+        }
     };
 
     Arc::new(rate_limit::new_completion(
```

**File**: `crates/http-api-bindings/src/completion/openai.rs` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ impl OpenAICompletionEngine {
         Box::new(Self {
             client,
             model_name,
-            api_endpoint: format!("{}/completions", api_endpoint),
+            api_endpoint: format!("{api_endpoint}/completions"),
             api_key,
             support_fim,
         })
```

**File**: `crates/http-api-bindings/src/embedding/llama.rs` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ impl Embedding for LlamaCppEngine {
                 }
             },
             |e: &reqwest::Error| {
-                let message = format!("{:?}", e);
+                let message = format!("{e:?}");
                 e.is_request()
                     && (message.contains("Connection reset by peer")
                         || message.contains("Broken pipe"))
```

**File**: `crates/http-api-bindings/src/embedding/openai.rs` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ impl OpenAIEmbeddingEngine {
         let client = Client::new();
         Box::new(Self {
             client,
-            api_endpoint: format!("{}/embeddings", api_endpoint),
+            api_endpoint: format!("{api_endpoint}/embeddings"),
             api_key: api_key.unwrap_or_default().to_owned(),
             model_name: model_name.to_owned(),
         })
```

---

### Incident Patch 15: `4130c148` (2025-07-18)
**Commit Message**: docs: add Katana install and WSL2 setup guide (#4324)

Co-authored-by: Juan G. Carmona <[REDACTED_EMAIL]>
Co-authored-by: Pochi <[REDACTED_EMAIL]>

**File**: `website/docs/quick-start/installation/linux/index.mdx` (modified, +19/-1)
```diff
@@ -28,6 +28,24 @@ Running Tabby on Linux using Tabby's standalone executable distribution.
   * Check your local CUDA version by running the following command in a terminal: `nvcc --version`
 * For the Vulkan version you'll need the vulkan library. In ubuntu, this would be `sudo apt install libvulkan1`.
 
+## Katana (optional but recommended)
+
+Tabby utilizes [Katana](https://github.com/projectdiscovery/katana) as a crawling backend for the `developer docs` context provider.
+To import and analyze `developer docs` when llms.txt is unavailable at the specified link, Katana is required.
+Please be aware that the minimum Katana version required is `1.1.2`.
+
+The simplest way to install Katana is to download a prebuilt binary from the official releases:
+
+```bash
+curl -L https://github.com/projectdiscovery/katana/releases/download/v1.1.2/katana_1.1.2_linux_amd64.zip -o katana.zip
+unzip katana.zip katana
+sudo mv katana /usr/bin/
+rm katana.zip
+```
+This works well for most Linux environments. If you're using a different environment, please refer to the 
+[official installation instructions](https://github.com/projectdiscovery/katana#installation).
+
+
 ## Find the Linux executable file
 * Unzip the file you downloaded. The `tabby` executable will be in a subdirectory of dist.
 * Change to this subdirectory or relocate `tabby` to a folder of your choice.
@@ -46,4 +64,4 @@ You can choose different models, as shown in [the model registry](https://tabby.
 You should see a success message similar to the one in the screenshot below. After that, you can visit http://localhost:8080 to access your Tabby instance.
 <div align="left">
   <img src={successImage} alt="Linux running success" style={{ width: 800 }} />
-</div>
+</div>
\ No newline at end of file
```

**File**: `website/docs/quick-start/installation/wsl.mdx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+---
+sidebar_position: 4
+---
+
+# Windows Subsystem for Linux (WSL2)
+
+Run Tabby on Windows using **Ubuntu via WSL2** for a native Linux experience with full GPU support and advanced developer control.
+
+## 1. Install WSL2 and Ubuntu
+
+You can install either **Ubuntu 22.04** or **Ubuntu 24.04** — both work with Tabby.
+
+> **Which version should I choose?**
+>
+> - Ubuntu **22.04** is the default and used in Tabby’s Docker image  
+> - Ubuntu **24.04** is newer and confirmed to work well with this guide  
+>
+> To install WSL2: https://learn.microsoft.com/en-us/windows/wsl/install
+
+Install your preferred Ubuntu version:
+
+```powershell
+wsl --install -d Ubuntu        # for Ubuntu 22.04
+wsl --install -d Ubuntu-24.04  # for Ubuntu 24.04
+```
+After installation, reboot if required, then launch Ubuntu and set up your UNIX user.
+
+## 2. Follow the Linux installation guide
+
+Once inside your Ubuntu WSL terminal, just follow the [Linux instructions](./linux). No extra steps
+needed — Tabby will run locally and privately, with GPU passthrough handled by WSL2 and Windows.
+
+## 3. Access Tabby from Windows
+
+Once Tabby is running in Ubuntu, it will usually be available at:  
+
+`http://localhost:8080` (or your chosen port)
```

#### Recent Merged Pull Requests:
- **PR #4536** (closed): feat(http-api-bindings): accept llmman model kinds (@ericcurtin)
- **PR #4521** (closed): chore(ci): pin nightly workflow action versions (@Solaris-star)
- **PR #4518** (closed): docs(model): add DaoXE OpenAI-compatible chat example (@seven7763)
- **PR #4510** (2026-06-30): Revert "feat: add Avian as a model provider" (@wsxiaoys)
- **PR #4497** (closed): fix: handle Windows file:// URL with three slashes in resolve_dir (@1795771535y-cell)
- **PR #4448** (2026-03-02): feat: add Avian as a model provider (@avianion)
- **PR #4444** (closed): Fix panic when .netrc entry has no password (@aviu16)
- **PR #4443** (2026-02-24): chore(ci): build cpu only tabby image (@zwpaper)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
