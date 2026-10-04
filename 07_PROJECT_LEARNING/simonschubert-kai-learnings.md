# Forensic Learning Record (Deep Inspection): SimonSchubert/Kai

> **Canonical Artifact**: `07_PROJECT_LEARNING/simonschubert-kai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SimonSchubert/Kai](https://github.com/SimonSchubert/Kai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:19:11.520Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SimonSchubert/Kai`
- **Description**: OpenClaw alternative in your pocket
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1271 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `composeApp/src/androidMain/kotlin/com/inspiredandroid/kai/inference/LocalInferenceEngineProvider.android.kt`
```
package com.inspiredandroid.kai.inference

actual fun createLocalInferenceEngine(): LocalInferenceEngine? = if (android.os.Build.SUPPORTED_64_BIT_ABIS.isNotEmpty()) LiteRTInferenceEngine() else null

```

### Core Architecture Module: `composeApp/src/androidMain/kotlin/com/inspiredandroid/kai/sandbox/SandboxState.kt`
```
package com.inspiredandroid.kai.sandbox

import com.inspiredandroid.kai.SandboxStatusLabel

sealed interface SandboxState {
    data object NotInstalled : SandboxState
    data class Downloading(val progress: Float) : SandboxState
    data object Extracting : SandboxState
    data class Installing(val label: SandboxStatusLabel = SandboxStatusLabel.Installing) : SandboxState
    data object Ready : SandboxState
    data class Error(val label: SandboxStatusLabel.Failure) : SandboxState
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/data/PendingQueue.kt`
```
package com.inspiredandroid.kai.data

import kotlinx.serialization.KSerializer

/**
 * Capped FIFO queue persisted as JSON via [SettingsJsonList]. Generic over the item type [T]
 * and a stable key type [K] used to identify items for removal. Shared by `EmailStore`,
 * `SmsStore`, and `NotificationStore` to enforce a uniform pending-buffer discipline.
 */
class PendingQueue<T, K>(
    readJson: () -> String,
    writeJson: (String) -> Unit,
    serializer: KSerializer<T>,
    label: String,
    private val keyOf: (T) -> K,
    private val maxSize: Int = 100,
) {
    private val persisted = SettingsJsonList(
        read = readJson,
        write = writeJson,
        itemSerializer = serializer,
        label = label,
    )

    fun get(): List<T> = persisted.get()

    suspend fun add(items: List<T>) {
        if (items.isEmpty()) return
        persisted.update { (it + items).takeLast(maxSize) }
    }

    suspend fun remove(items: List<T>) {
        if (items.isEmpty()) return
        val keys = items.map(keyOf).toSet()
        persisted.update { current -> current.filterNot { keyOf(it) in keys } }
    }

    suspend fun clear() {
        persisted.update { emptyList() }
    }
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/inference/LocalInferenceEngine.kt`
```
package com.inspiredandroid.kai.inference

import io.github.vinceglb.filekit.PlatformFile
import kotlinx.coroutines.flow.StateFlow

data class LocalModel(
    val id: String,
    val displayName: String,
    val fileName: String,
    val sizeBytes: Long,
    val downloadUrl: String,
    /**
     * Expected SHA-256 of the downloaded file, lowercase hex. Blank for imported models,
     * whose bytes the user supplies directly and for which no digest is known.
     */
    val sha256: String = "",
    val gpuMemoryMb: Int,
    val defaultContextTokens: Int,
    val maxContextTokens: Int,
    val kvPerTokenBytes: Int,
    val isRecommended: Boolean = false,
    /** True for user-imported models that are not in [MODEL_CATALOG]. */
    val isImported: Boolean = false,
)

enum class DevicePerformance {
    GOOD,
    OK,
    POOR,
}

fun estimateGpuMemoryMb(model: LocalModel, contextTokens: Int): Int {
    val modelFileMb = (model.sizeBytes / (1024 * 1024)).toInt()
    val extraTokens = contextTokens - model.defaultContextTokens
    val extraMemoryMb = (extraTokens.toLong() * model.kvPerTokenBytes) / (1024 * 1024)
    return modelFileMb + model.gpuMemoryMb + extraMemoryMb.toInt()
}

fun calculateDevicePerformance(totalMemoryBytes: Long, estimatedGpuMemoryMb: Int): DevicePerformance {
    val gpuMemoryBytes = estimatedGpuMemoryMb.toLong() * 1024 * 1024
    val ratio = totalMemoryBytes.toDouble() / gpuMemoryBytes
    return when {
        ratio >= 2.5 -> DevicePerformance.GOOD
        ratio >= 1.85 -> DevicePerformance.OK
        else -> DevicePerformance.POOR
    }
}

data class DownloadedModel(
    val id: String,
    val displayName: String,
    val filePath: String,
    val sizeBytes: Long,
)

enum class EngineState {
    UNINITIALIZED,
    INITIALIZING,
    READY,
    ERROR,
}

data class InferenceMessage(
    val role: String,
    val content: String,
)

/**
 * A tool definition handed to the on-device inference engine.
 *
 * @param name the tool's identifier as the model will see it
 * @param descriptionJsonString a complete OpenAPI/OpenAI-style JSON object describing the
 *        tool, e.g. `{"name":"get_time","description":"...","parameters":{"type":"object",...}}`
 * @param execute receives the JSON arguments object as a string and returns the
 *        JSON-encoded result string
 */
data class LocalTool(
    val name: String,
    val descriptionJsonString: String,
    val execute: suspend (jsonArgs: String) -> String,
)

/**
 * Sampling defaults a `.litertlm` bundle ships for itself. Models converted from different
 * upstream families want different values — one hardcoded triple is right for none of them.
 */
data class LocalSamplerDefaults(
    val temperature: Float,
    val topK: Int,
    val topP: Float,
)

/**
 * The bundle's declared sampling defaults, or null when it declares none. A bundle with
 * nothing to say reports zeroes, and passing those straight through would pin the model to
 * greedy decoding — so zero (or negative) means "no opinion", not "sample greedily".
 */
fun localSamplerDefaultsOrNull(temperature: Float, topK: Int, topP: Float): LocalSamplerDefaults? = if (topK > 0 && temperature > 0f) LocalSamplerDefaults(temperature, topK, topP) else null

/**
 * What a model file declares about itself, read from the `.litertlm` bundle's own metadata.
 *
 * A model that does not declare function calling carries no tool section in its chat
 * template. Handing it tools anyway does not make it ignore them — it makes it invent the
 * answer a tool would have produced, which is exactly how Qwen3 0.6B reports a fictional
 * time instead of calling `get_local_time`.
 */
data class LocalModelCapabilities(
    val supportsFunctionCalling: Boolean,
    val supportsThinking: Boolean,
    val supportsVision: Boolean,
    val supportsAudio: Boolean,
    /** Null when the bundle declares no usable defaults; callers keep their own values. */
    val sampler: LocalSamplerDefaults?,
)

class InsufficientMemoryException : Exception()
class InferenceTimeoutException : Exception()
class NoModelDownloadedException : Exception()

/** A model file on disk did not match the digest pinned in the catalog and was removed. */
class ModelIntegrityException : Exception()

enum class DownloadError {
    NOT_ENOUGH_DISK_SPACE,
    NETWORK_ERROR,
    DOWNLOAD_INCOMPLETE,
    CHECKSUM_MISMATCH,
}

interface LocalInferenceEngine {
    val engineState: StateFlow<EngineState>
    val downloadingModelId: StateFlow<String?>
    val downloadProgress: StateFlow<Float?>
    val downloadError: StateFlow<DownloadError?>

    /** Non-null file name while a local import copy is in progress. */
    val importingFileName: StateFlow<String?>
    val importProgress: StateFlow<Float?>
    val importError: StateFlow<ModelImportError?>

    val currentModelId: String?

    /**
     * What the model file for [modelId] declares it can do. Reads the bundle's own
     * metadata, so it answers before the model is ever loaded, and the answer is cached
     * for as long as the file stays put.
     *
     * Null means *unknown*, not *incapable* — the id may not be downloaded, the bundle's
     * metadata may predate the declaration, or the platform may not implement the probe at
     * all (the iOS bridge predates it). Callers that get null must fall back to their own
     * assumptions rather than treat the model as supporting nothing.
     */
    suspend fun modelCapabilities(modelId: String): LocalModelCapabilities? = null

    suspend fun initialize(model: DownloadedModel, contextTokens: Int = 0)
    suspend fun release()

    /**
     * Fire-and-forget release, run on the engine's own coroutine scope. Called from
     * non-suspend contexts (e.g. Settings UI when the user picks a different model) so
     * the GPU driver has time to reclaim memory before the next inference.
     */
    fun releaseInBackground()

    suspend fun chat(
        messages: List<InferenceMessage>,
        systemPrompt: String?,
        tools: List<LocalTool> = emptyList(),
    ): String

    fun getDownloadedModels(): List<DownloadedModel>
    fun getAvailableModels(): List<LocalModel>

    /**
     * Synthetic [LocalModel] entries for user-imported files under `imports/`, so the
     * settings UI can show context sliders and performance labels.
     */
    fun getImportedLocalModels(): List<LocalModel>

    fun getFreeSpaceBytes(): Long
    fun startDownload(model: LocalModel)
    fun cancelDownload()
    suspend fun deleteModel(modelId: String)

    /**
     * Copy a user-picked `.litertlm` into app storage. Streams bytes — never loads the
     * full file into memory. Catalog file names land in the matching catalog path;
     * everything else goes under `imports/`.
     */
    suspend fun importModel(source: PlatformFile): ModelImportResult
    fun cancelImport()
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/inference/LocalInferenceEngineProvider.kt`
```
package com.inspiredandroid.kai.inference

expect fun createLocalInferenceEngine(): LocalInferenceEngine?

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/tools/HtmlUtils.kt`
```
package com.inspiredandroid.kai.tools

internal fun String.decodeHtmlEntities(): String = this
    .replace("&nbsp;", " ")
    .replace("&amp;", "&")
    .replace("&lt;", "<")
    .replace("&gt;", ">")
    .replace("&quot;", "\"")
    .replace("&#39;", "'")

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/chat/ChatUiState.kt`
```
@file:OptIn(ExperimentalUuidApi::class, ExperimentalEncodingApi::class)

package com.inspiredandroid.kai.ui.chat

import androidx.compose.runtime.Immutable
import com.inspiredandroid.kai.data.Attachment
import com.inspiredandroid.kai.data.FallbackStatus
import com.inspiredandroid.kai.data.ReasoningRequestMode
import com.inspiredandroid.kai.data.ServiceEntry
import com.inspiredandroid.kai.data.SharedJson
import com.inspiredandroid.kai.data.SmsDraft
import com.inspiredandroid.kai.data.UiSubmission
import com.inspiredandroid.kai.network.UiError
import com.inspiredandroid.kai.network.dtos.gemini.GeminiChatRequestDto
import com.inspiredandroid.kai.network.dtos.openaicompatible.OpenAICompatibleChatRequestDto
import io.github.vinceglb.filekit.PlatformFile
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.persistentListOf
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.compose.resources.StringResource
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

private fun String.isTextMimeType(): Boolean = startsWith("text/") || this == "application/json" || this == "application/xml" ||
    this == "application/javascript" || this == "application/x-yaml" || this == "application/yaml"

/**
 * Splits attachments into the text that should be prepended to the user's message
 * (decoded text files with filename headers) and the remaining binary attachments
 * (images, PDFs) that become standalone content blocks in provider-specific formats.
 */
private data class AttachmentSplit(
    val textPrefix: String,
    val binaries: List<Attachment>,
)

private fun List<Attachment>.splitForMessage(): AttachmentSplit {
    if (isEmpty()) return AttachmentSplit("", emptyList())
    val prefix = StringBuilder()
    val binaries = mutableListOf<Attachment>()
    for (att in this) {
        if (att.mimeType.isTextMimeType()) {
            val decoded = Base64.decode(att.data).decodeToString()
            if (att.fileName != null) prefix.append("--- ${att.fileName} ---\n")
            prefix.append(decoded).append("\n\n")
        } else {
            binaries.add(att)
        }
    }
    return AttachmentSplit(prefix.toString(), binaries)
}

@Immutable
data class ConversationSummary(
    val id: String,
    val title: String,
    val updatedAt: Long,
    val isHeartbeat: Boolean = false,
    val isInteractive: Boolean = false,
)

@Immutable
data class ChatUiState(
    val actions: ChatActions,
    val history: ImmutableList<History> = persistentListOf(),
    val isSpeechOutputEnabled: Boolean = false,
    val isLoading: Boolean = false,
    val error: UiError? = null,
    val showFreeProviderSuggestions: Boolean = false,
    val warning: StringResource? = null,
    val showPrivacyInfo: Boolean = false,
    val supportedFileExtensions: ImmutableList<String> = persistentListOf(),
    val isSpeaking: Boolean = false,
    val isSpeakingContentId: String = "",
    val files: ImmutableList<PlatformFile> = persistentListOf(),
    val availableServices: ImmutableList<ServiceEntry> = persistentListOf(),
    val savedConversations: ImmutableList<ConversationSummary> = persistentListOf(),
    val currentConversationId: String? = null,
    val hasUnreadHeartbeat: Boolean = false,
    val smsDrafts: ImmutableList<SmsDraft> = persistentListOf(),
    val snackbarMessage: StringResource? = null,
    val pendingConversationDeletion: String? = null,
    val isInteractiveMode: Boolean = false,
    val fallbackStatus: FallbackStatus? = null,
    val isRestoring: Boolean = true,
    val installedSkills: ImmutableList<com.inspiredandroid.kai.skills.SkillManifest> = persistentListOf(),
    val composerPrefill: String? = null,
) {
    val heartbeatConversationId: String?
        get() = savedConversations.firstOrNull { it.isHeartbeat }?.id
}

@Immutable
data class History(
    val id: String = Uuid.random().toString(),
    val role: Role,
    val content: String,
    val attachments: ImmutableList<Attachment> = persistentListOf(),
    val toolCallId: String? = null,
    val toolName: String? = null,
    val toolCalls: ImmutableList<ToolCallInfo>? = null,
    val isThinking: Boolean = false,
    val isStatusMessage: Boolean = false,
    val fallbackServiceName: String? = null,
    val uiSubmission: UiSubmission? = null,
    // Preserved from a tool-call assistant turn so it can be round-tripped
    // back to providers (e.g. DeepSeek) that require it on the next request.
    val reasoningContent: String? = null,
) {
    enum class Role {
        USER,
        ASSISTANT,
        TOOL_EXECUTING,
        TOOL,
    }
}

/** Latest assistant message that should render in the UI (non-empty content, not a thinking-only entry). */
fun List<History>.lastRenderedAssistant(): History? = lastOrNull { it.role == History.Role.ASSISTANT && it.content.isNotEmpty() && !it.isThinking }

@Immutable
data class ToolCallInfo(
    val id: String,
    val name: String,
    val arguments: String,
    val thoughtSignature: String? = null,
)

fun History.toGroqMessageDto(
    reasoningMode: ReasoningRequestMode = ReasoningRequestMode.NONE,
    supportsImages: Boolean = true,
): OpenAICompatibleChatRequestDto.Message = when (role) {
    History.Role.USER -> {
        val split = attachments.splitForMessage()
        // Images become image_url parts; PDFs are dropped (OpenAI-compatible has no native PDF
        // support, matching the prior behavior). Text files get merged into the text prefix.
        // When the target service can't accept content-parts (e.g. the kai9000 proxy whose
        // Groq fallback uses text-only models), drop images and emit a plain string.
        val imageAttachments = if (supportsImages) {
            split.binaries.filter { it.mimeType.startsWith("image/") }
        } else {
            emptyList()
        }
        val fullText = "${split.textPrefix}$content"
        val messageContent: JsonElement = if (imageAttachments.isEmpty()) {
            JsonPrimitive(fullText)
        } else {
            JsonArray(
                buildList {
                    add(
                        buildJsonObject {
                            put("type", "text")
                            put("text", fullText)
                        },
                    )
                    for (att in imageAttachments) {
                        add(
                            buildJsonObject {
                                put("type", "image_url")
                                put(
                                    "image_url",
                                    buildJsonObject {
                                        put("url", "data:${att.mimeType};base64,${att.data}")
                                    },
                                )
                            },
                        )
                    }
                },
            )
        }
        OpenAICompatibleChatRequestDto.Message(role = "user", content = messageContent)
    }

    History.Role.ASSISTANT -> {
        if (toolCalls != null) {
            // When isThinking is true, History.content actually holds the reasoning text
            // (the provider returned no real content). Don't send it as `content`; it will
            // be carried by reasoning_content instead.
            val realContent = if (isThinking || content.isEmpty()) null else JsonPrimitive(content)
            val emittedReasoning = when (reasoningMode) {
                ReasoningRequestMode.REASONING_CONTENT -> reasoningContent
                ReasoningRequestMode.NONE -> null
            }
            OpenAICompatibleChatRequestDto.Message(
                role = "assistant",
                content = realContent,
                tool_calls = toolCalls.map { tc ->
                    OpenAICompatibleChatRequestDto.ToolCall(
                        id = tc.id,
                        function = OpenAICompatibleChatRequestDto.FunctionCall(
                            name = tc.name,
                            arguments = tc.arguments,
                        ),
                    )
                },
                reasoningContent = emittedReasoning,
            )
        } else {
            OpenAICompatibleChatRequestDto.Message(role = "assistant", content = JsonPrimitive(content))
        }
    }

    History.Role.TOOL -> OpenAICompatibleChatRequestDto.Message(
        role = "tool",
        content = JsonPrimitive(content),
        tool_call_id = toolCallId,
    )

    History.Role.TOOL_EXECUTING -> OpenAICompatibleChatRequestDto.Message(role = "assistant", content = JsonPrimitive(content))
}

fun History.toAnthropicContentBlocks(): JsonElement = when (role) {
    History.Role.USER -> {
        val split = attachments.splitForMessage()
        val fullText = "${split.textPrefix}$content"
        if (split.binaries.isEmpty()) {
            JsonPrimitive(fullText)
        } else {
            JsonArray(
                buildList {
                    for (att in split.binaries) {
                        if (att.mimeType == "application/pdf") {
                            add(
                                buildJsonObject {
                                    put("type", "document")
                                    put(
                                        "source",
                                        buildJsonObject {
                                            put("type", "base64")
                                            put("media_type", "application/pdf")
                                            put("data", att.data)
                                        },
                                    )
                                
```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/chat/composables/EmptyState.kt`
```
package com.inspiredandroid.kai.ui.chat.composables

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.inspiredandroid.kai.ui.components.LogoAnimation
import com.inspiredandroid.kai.ui.components.animatedGradientBorder
import com.inspiredandroid.kai.ui.handCursor
import kai.composeapp.generated.resources.Res
import kai.composeapp.generated.resources.kai_build_open
import kai.composeapp.generated.resources.privacy_agree_prefix
import kai.composeapp.generated.resources.privacy_policy
import kai.composeapp.generated.resources.start_interactive_ui
import kai.composeapp.generated.resources.welcome_message
import org.jetbrains.compose.resources.stringResource

/**
 * Phosphor green for the Kai Build button, taken from the ANSI palette its own
 * terminal paints with: the bright green on dark backgrounds, the darker normal
 * green where a light one would wash it out. Colors only — the button keeps the
 * shape and label style it shares with the rest of the empty state.
 */
private val TerminalGreenOnDark = Color(0xFF16C60C)
private val TerminalGreenOnLight = Color(0xFF13A10E)

@Composable
internal fun EmptyState(
    modifier: Modifier,
    isUsingSharedKey: Boolean,
    onStartInteractiveMode: (() -> Unit)? = null,
    onOpenKaiBuild: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        LogoAnimation()
        Spacer(Modifier.height(16.dp))
        Text(
            text = stringResource(Res.string.welcome_message),
            modifier = Modifier.padding(horizontal = 16.dp),
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onBackground,
        )
        if (onStartInteractiveMode != null) {
            Spacer(Modifier.height(16.dp))
            AnimatedBorderButton(
                text = stringResource(Res.string.start_interactive_ui),
                onClick = onStartInteractiveMode,
            )
            Spacer(Modifier.height(8.dp))
        }
        if (onOpenKaiBuild != null) {
            val terminalGreen = if (MaterialTheme.colorScheme.background.luminance() < 0.5f) {
                TerminalGreenOnDark
            } else {
                TerminalGreenOnLight
            }
            OutlinedButton(
                onClick = onOpenKaiBuild,
                modifier = Modifier.handCursor(),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = terminalGreen),
                border = BorderStroke(1.dp, terminalGreen.copy(alpha = 0.6f)),
            ) {
                Icon(
                    imageVector = Icons.Default.Terminal,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(stringResource(Res.string.kai_build_open))
            }
            Spacer(Modifier.height(8.dp))
        }
        if (isUsingSharedKey) {
            val linkColor = MaterialTheme.colorScheme.primary
            val prefixText = stringResource(Res.string.privacy_agree_prefix)
            val policyText = stringResource(Res.string.privacy_policy)
            val annotatedString = remember(prefixText, policyText, linkColor) {
                buildAnnotatedString {
                    append(prefixText)
                    withLink(LinkAnnotation.Url(url = "https://schubert-simon.de/privacy/kai.txt")) {
                        withStyle(style = SpanStyle(color = linkColor)) {
                            append(policyText)
                        }
                    }
                }
            }
            Text(
                annotatedString,
                modifier = Modifier.padding(horizontal = 16.dp),
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onBackground,
            )
        }
    }
}

@Composable
private fun AnimatedBorderButton(
    text: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .handCursor()
            .clip(RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .animatedGradientBorder(
                cornerRadius = 50.dp,
                borderWidth = 3.dp,
                backgroundColor = MaterialTheme.colorScheme.background,
            ),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/dynamicui/KaiUiRenderer.kt`
```
@file:OptIn(ExperimentalMaterial3Api::class)

package com.inspiredandroid.kai.ui.dynamicui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.indication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Label
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingFlat
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.Healing
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.LocalCafe
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.PieChart
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Savings
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.Work
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.run
```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/markdown/MarkdownInlineRenderer.kt`
```
package com.inspiredandroid.kai.ui.markdown

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle

@Composable
internal fun List<InlineNode>.toAnnotatedString(): AnnotatedString {
    val colors = MaterialTheme.colorScheme
    return buildAnnotatedString { appendInlines(this@toAnnotatedString, colors) }
}

private fun AnnotatedString.Builder.appendInlines(nodes: List<InlineNode>, colors: ColorScheme) {
    for (n in nodes) appendInline(n, colors)
}

private fun AnnotatedString.Builder.appendInline(node: InlineNode, colors: ColorScheme) {
    when (node) {
        is Text -> append(node.value)

        is Strong -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
            appendInlines(node.children, colors)
        }

        is Emphasis -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
            appendInlines(node.children, colors)
        }

        is Strike -> withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) {
            appendInlines(node.children, colors)
        }

        is InlineCode -> withStyle(
            SpanStyle(
                fontFamily = FontFamily.Monospace,
                background = colors.surfaceVariant,
            ),
        ) {
            append(node.code)
        }

        is Link -> withLink(
            LinkAnnotation.Url(
                url = node.href,
                styles = TextLinkStyles(
                    style = SpanStyle(
                        color = colors.primary,
                        fontWeight = FontWeight.Bold,
                        textDecoration = TextDecoration.Underline,
                    ),
                ),
            ),
        ) {
            appendInlines(node.children, colors)
        }

        is Image -> append(node.alt)

        LineBreak -> append('\n')

        is InlineMath -> withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) {
            // Fallback path: if math reaches the AnnotatedString builder it means the caller
            // didn't use [InlineContent]. Emit the raw LaTeX so nothing is lost.
            append(node.latex)
        }
    }
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/markdown/MarkdownRenderer.kt`
```
package com.inspiredandroid.kai.ui.markdown

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.inspiredandroid.kai.ui.dynamicui.FrozenSubmission
import com.inspiredandroid.kai.ui.dynamicui.KaiUiRenderer
import com.inspiredandroid.kai.ui.markdown.math.MathFormula
import kotlinx.collections.immutable.persistentListOf

/**
 * Render a parsed [MarkdownDocument] as a Compose layout. Each block becomes one child of the
 * outer [Column]; inline content is rendered as [androidx.compose.ui.text.AnnotatedString].
 *
 * Kai-UI blocks dispatch to [KaiUiRenderer]; pass `isInteractive = false` to render them as
 * read-only (completed historical messages keep their layout but disable buttons/inputs).
 */
@Composable
fun MarkdownContent(
    document: MarkdownDocument,
    modifier: Modifier = Modifier,
    isInteractive: Boolean = false,
    onUiCallback: (event: String, data: Map<String, String>) -> Unit = { _, _ -> },
    frozen: FrozenSubmission? = null,
) {
    CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onSurface) {
        Column(modifier) {
            for (block in document.blocks) {
                BlockRenderer(block, isInteractive, onUiCallback, frozen)
            }
        }
    }
}

@Composable
fun MarkdownContent(
    content: String,
    modifier: Modifier = Modifier,
    isInteractive: Boolean = false,
    onUiCallback: (event: String, data: Map<String, String>) -> Unit = { _, _ -> },
    frozen: FrozenSubmission? = null,
) {
    val doc = remember(content) {
        runCatching { parseMarkdown(content) }.getOrElse {
            MarkdownDocument(persistentListOf(Paragraph(persistentListOf(com.inspiredandroid.kai.ui.markdown.Text(content)))))
        }
    }
    MarkdownContent(doc, modifier, isInteractive, onUiCallback, frozen)
}

@Composable
private fun BlockRenderer(
    block: BlockNode,
    isInteractive: Boolean,
    onUiCallback: (String, Map<String, String>) -> Unit,
    frozen: FrozenSubmission?,
) {
    when (block) {
        is Heading -> HeadingBlock(block)

        is Paragraph -> ParagraphBlock(block)

        is CodeFence -> {
            if (block.code.isNotBlank() || !block.language.isNullOrBlank()) {
                CodeFenceBlock(
                    language = block.language,
                    code = block.code,
                    modifier = Modifier.padding(vertical = 4.dp),
                )
            }
        }

        is Blockquote -> BlockquoteBlock(block, isInteractive, onUiCallback, frozen)

        is BulletList -> BulletListBlock(block, isInteractive, onUiCallback, frozen)

        is OrderedList -> OrderedListBlock(block, isInteractive, onUiCallback, frozen)

        is Table -> TableBlock(block)

        HorizontalRule -> HorizontalDivider(Modifier.padding(vertical = 8.dp))

        is DisplayMath -> DisplayMathBlock(block)

        is KaiUiBlock -> KaiUiRenderer(
            node = block.node,
            isInteractive = isInteractive,
            onCallback = onUiCallback,
            frozen = frozen,
            modifier = Modifier.padding(vertical = 8.dp),
        )

        is KaiUiError -> CodeFenceBlock(
            language = "json",
            code = block.rawJson,
            modifier = Modifier.padding(vertical = 4.dp),
        )
    }
}

@Composable
private fun HeadingBlock(block: Heading) {
    val typography = MaterialTheme.typography
    val style = when (block.level) {
        1 -> typography.headlineSmall
        2 -> typography.titleLarge
        3 -> typography.titleMedium
        4 -> typography.titleSmall
        5 -> typography.bodyLarge.copy(fontWeight = FontWeight.Bold)
        else -> typography.bodyMedium.copy(fontWeight = FontWeight.Bold)
    }
    InlineContent(
        inlines = block.inlines,
        style = style,
        modifier = Modifier.padding(vertical = 4.dp),
    )
}

@Composable
private fun ParagraphBlock(block: Paragraph) {
    if (block.inlines.size == 1 && block.inlines[0] is Image) {
        val img = block.inlines[0] as Image
        AsyncImage(
            model = img.src,
            contentDescription = img.alt,
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        )
        return
    }
    InlineContent(
        inlines = block.inlines,
        style = MaterialTheme.typography.bodyLarge,
        modifier = Modifier.padding(vertical = 2.dp),
    )
}

@Composable
private fun DisplayMathBlock(block: DisplayMath) {
    // Wrap in horizontal scroll so wide formulas overflow cleanly instead of squishing
    // their children into a narrow column (KaTeX/MathJax use the same pattern).
    val scroll = rememberScrollState()
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .horizontalScroll(scroll),
        contentAlignment = Alignment.Center,
    ) {
        MathFormula(latex = block.latex, display = true)
    }
}

@Composable
private fun BlockquoteBlock(
    block: Blockquote,
    isInteractive: Boolean,
    onUiCallback: (String, Map<String, String>) -> Unit,
    frozen: FrozenSubmission?,
) {
    Row(modifier = Modifier.padding(vertical = 4.dp).height(IntrinsicSize.Min)) {
        VerticalDivider(
            thickness = 3.dp,
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.fillMaxHeight(),
        )
        Column(Modifier.padding(start = 8.dp)) {
            block.children.forEach { BlockRenderer(it, isInteractive, onUiCallback, frozen) }
        }
    }
}

@Composable
private fun BulletListBlock(
    block: BulletList,
    isInteractive: Boolean,
    onUiCallback: (String, Map<String, String>) -> Unit,
    frozen: FrozenSubmission?,
) {
    Column(modifier = Modifier.padding(vertical = 2.dp)) {
        for (item in block.items) {
            ListItemRow("•", 16.dp, item, isInteractive, onUiCallback, frozen)
        }
    }
}

@Composable
private fun OrderedListBlock(
    block: OrderedList,
    isInteractive: Boolean,
    onUiCallback: (String, Map<String, String>) -> Unit,
    frozen: FrozenSubmission?,
) {
    Column(modifier = Modifier.padding(vertical = 2.dp)) {
        block.items.forEachIndexed { index, item ->
            ListItemRow("${block.start + index}.", 24.dp, item, isInteractive, onUiCallback, frozen)
        }
    }
}

@Composable
private fun ListItemRow(
    marker: String,
    markerWidth: androidx.compose.ui.unit.Dp,
    item: ListItem,
    isInteractive: Boolean,
    onUiCallback: (String, Map<String, String>) -> Unit,
    frozen: FrozenSubmission?,
) {
    // The marker column is sized for the default font scale; scale it so "10." still
    // fits when body text doubles, and keep it a minimum rather than a fixed width so
    // an unusually long marker widens instead of being clipped.
    val scaledMarkerWidth = markerWidth * LocalDensity.current.fontScale
    Row {
        Text(
            text = marker,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.widthIn(min = scaledMarkerWidth).padding(end = 4.dp),
        )
        Column(Modifier.fillMaxWidth()) {
            item.children.forEach { BlockRenderer(it, isInteractive, onUiCallback, frozen) }
        }
    }
}

@Composable
private fun TableBlock(block: Table) {
    Column(Modifier.padding(vertical = 4.dp)) {
        if (block.headers.any { it.isNotEmpty() }) {
            Row {
                block.headers.forEachIndexed { i, cell ->
                    InlineContent(
                        inlines = cell,
                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                        textAlign = alignTextFor(block.alignments.getOrNull(i)),
                        modifier = Modifier.weight(1f).padding(4.dp),
                    )
                }
            }
            HorizontalDivider()
        }
        for (row in block.rows) {
            Row {
                row.forEachIndexed { i, cell ->
                    InlineContent(
                        inlines = cell,
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = alignTextFor(block.alignments.getOrNull(i)),
                        modifier = Modifier.weight(1f).padding(4.dp),
                    )
                }
            }
        }
    }
}

private fun alignTextFor(align: ColumnAlign?): TextAlign = when (align) {
    ColumnAlign.LEFT -> TextAlign.Start
    ColumnAlign.CENTER -> TextAlign.Center
    ColumnAlign.RIGHT -> TextAlign.End
    else -> TextAlign.Unspecified
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/markdown/MarkdownTextRenderer.kt`
```
package com.inspiredandroid.kai.ui.markdown

import com.inspiredandroid.kai.ui.dynamicui.collectSpeakableText

/**
 * TTS-friendly text extracted from a parsed [MarkdownDocument]. Strips markdown formatting,
 * drops code blocks, reads link text (not URLs), and walks kai-ui blocks for their human-
 * readable labels.
 */
fun MarkdownDocument.toSpeakableText(): String {
    val pieces = blocks.mapNotNull { blockToSpeakable(it).takeIf { p -> p.isNotBlank() } }
    return pieces.joinToString("\n\n").trim()
}

private fun blockToSpeakable(block: BlockNode): String = when (block) {
    is Heading -> inlinesToText(block.inlines)
    is Paragraph -> inlinesToText(block.inlines)
    is CodeFence -> ""
    is Blockquote -> block.children.joinToString(". ") { blockToSpeakable(it) }.trim()
    is BulletList -> block.items.joinToString("\n") { itemToSpeakable(it) }
    is OrderedList -> block.items.joinToString("\n") { itemToSpeakable(it) }
    is Table -> tableToSpeakable(block)
    HorizontalRule -> ""
    is DisplayMath -> block.latex
    is KaiUiBlock -> block.node.collectSpeakableText()
    is KaiUiError -> ""
}

private fun itemToSpeakable(item: ListItem): String {
    val text = item.children.joinToString(". ") { blockToSpeakable(it) }.trim()
    return ensureSentenceEnd(text)
}

private fun ensureSentenceEnd(text: String): String {
    if (text.isEmpty()) return text
    val last = text.last()
    return if (last == '.' || last == '?' || last == '!') text else "$text."
}

private fun tableToSpeakable(table: Table): String {
    val pieces = mutableListOf<String>()
    if (table.headers.any { it.isNotEmpty() }) {
        pieces += table.headers.joinToString(", ") { inlinesToText(it) }
    }
    for (row in table.rows) {
        pieces += row.joinToString(", ") { inlinesToText(it) }
    }
    return pieces.joinToString(". ")
}

private fun inlinesToText(inlines: List<InlineNode>): String {
    val sb = StringBuilder()
    for (n in inlines) appendInline(sb, n)
    return sb.toString()
}

private fun appendInline(sb: StringBuilder, node: InlineNode) {
    when (node) {
        is Text -> sb.append(node.value)
        is Emphasis -> node.children.forEach { appendInline(sb, it) }
        is Strong -> node.children.forEach { appendInline(sb, it) }
        is Strike -> node.children.forEach { appendInline(sb, it) }
        is InlineCode -> sb.append(node.code)
        is Link -> node.children.forEach { appendInline(sb, it) }
        is Image -> sb.append(node.alt)
        LineBreak -> sb.append(' ')
        is InlineMath -> sb.append(node.latex)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #507** (2026-10-01): **OpenAI GPT-6-* models fail because they require the responses API**
  *Symptoms*: ### Description  The Issue #469 reported that the models GPT-5.6-* did not work in version 3.1 because they require the responses API. Now, the newer models GPT-6-* also fail because of the same issue.  In 3.2 this was fixed by adding a condition specifically for models with GPT-5.6 in their name. However, because that does not match GPT-6-*, these models fail to use the Responses API.  I believe that the newer models form OpenAI will all use the new Responses API and will not properly support the chat/completions API.  Maybe a more robust decision system is required, rather than manually adding the model versions to use the Responses API. An idea would be to default to the Responses API if the version is greater than 5.6 or maybe decide to use the Responses API based on the features required by the model.   ### Steps to Reproduce  1. Use the OpenAI provider 2. Select GPT-6-Astra (or GPT-6-Sol or Luna) 3. Watch it fail 4. Cry    ### Kai Version  3.2.0  ### Platform  Android  ### Logs / Screenshots  _No response_

- **Issue #491** (2026-10-01): **Error when using models with GroqCloud service**
  *Symptoms*: ### Description  Unable to use any of the models in the list with GroqCloud service with an API. Getting an error that Image is too large, Try a smallet image.  ### Steps to Reproduce  I have tried all of the images in the list using my Groq API. I have reset the app and used another device and it shows the same error. Same thing shows when using Windows Desktop app. I can confirm that my Groq API works on a different AI Client app. I was unable to pull any logs related to this error. This issue is happening on all previous versions, I have been using the free tier only.  ### Kai Version  3.2.0  ### Platform  Android  ### Logs / Screenshots  <img width="1008" height="2019" alt="Image" src="https://github.com/user-attachments/assets/463de999-9885-47c4-96bf-605dc2f8d897" /> <img width="983" height="607" alt="Image" src="https://github.com/user-attachments/assets/6650077c-ff34-4c5f-8a6d-ee79e912dc3e" />

- **Issue #482** (2026-09-07): **Debian 12 installation fails with missing kai-build/tmp directory**
  *Symptoms*: ### Description  My device Samsung Galaxy S23 Ultra Android version 16  Debian 12 fails to install in Kai 9000  I tested both installation methods 1. setting > linux sandbox > debian 12 > install 2. Kai build > Opencode > Install Debian Both like fail during installation. Kai Builds shows errors that the following directory does not exist:   /data/user/0/com.inspiredandroid.kai/files/kai-build/temp  the installation then fails while trying to install the base packages.  ### Steps to Reproduce  1. Open Kai 9000 version 3.1.0. 2. Open Settings. 3. Go to Linux Sandbox. 4. Select Debian 12. 5. Tap Install.  The installation fails.  The same issue also occurs through:  Kai Build > OpenCode > Install Debian  ### Kai Version  3.1.0  ### Platform  Android  ### Logs / Screenshots  Error/Logs  Failed to install base packages: proot warning: can't sanitize binding "/data/user/0/com.inspiredandroid.kai/files/kai-build/tmp": No such file or directory proot warning: can't canonicalize /data/user/0/com.inspiredandroid.kai/files/kai-build/tmp: No such file or directory proot warning: Unable to create temp directory for f2fs bug probe: No such file or directory E: Unable to locate package bash ca-certificates curl wget git nano less unzip python3 tar coreutils  <img width="1080" height="2316" alt="Image" src="https://github.com/user-attachments/assets/7df3debb-ce9b-4b4e-a54c-735a02346ce2" />
  **Post-Mortem & Fix Analysis**:
  > (as a note, this is the same as both https://github.com/SimonSchubert/Kai/issues/468 AND https://github.com/SimonSchubert/Kai/issues/470. Can they be merged? Posting here as this one is newest) Thanks very much for making Kai.  I can confirm that this exact issue (.../kai-build/tmp not existing) occurrs exactly like that on three very different devices I have tried:  An older phone with Android 10 - kernel 4.14 (armv7l - 32bit userland on 32bit cpu) A newer googleTV box with Android 14 - kernel 5.15 (armv8l - 32bit userland on 64bit cpu) A 2025 Motorola phone with Android 16 - kernel 5.15 (aarch64 - 64bit userland on 64bit cpu)  So I don't think it's arch related...exact same error. If I can supply any other infomation that might help please let me know! Good luck!  I am anxiously awaiting this to work... I need an aarch64 glibc env to work on several things. I finally got access to a really smart model, and I've been trying to do it on ubuntu via MCP but I can't see what it's doing my
  > Got it fixed by ai, can't upload apk tho  [kai-fixes.patch](https://github.com/user-attachments/files/31866414/kai-fixes.patch)  Root cause (Debian 12 install failing): LinuxInstaller.installBasePackages() passes the whole base-package list as a string to AptPackageManager.installCommand(), which wraps it in shellQuote() as a single quoted argument:  text  apt-get install -y --no-install-recommends 'bash ca-certificates curl wget git nano less unzip python3 tar coreutils' → apt sees ONE package whose name contains spaces → E: Unable to locate package bash ca-certificates … — install always fails on v3.1.0 (any device, any arch).  Fix: quote each name separately, e.g. add to PackageManagerSpec.kt:  Kotlin  internal fun shellQuoteEach(names: String): String =     names.trim().split(Regex("\\s+")).filter { it.isNotBlank() }.joinToString(" ") { shellQuote(it) } and use it in AptPackageManager.installCommand() (and ApkPackageManager.installCommand() for symmetry). Single-name calls behave e
  > thank you for the detailed feedback. fix: d6b52d8d

- **Issue #475** (2026-09-07): **[Bug] Unexpected crash on android**
  *Symptoms*: ### Description  ```txt AndroidRuntime: FATAL EXCEPTION: DefaultDispatcher-worker-1 AndroidRuntime: Process: com.inspiredandroid.kai, PID: 28202 AndroidRuntime: android.database.sqlite.SQLiteBlobTooBigException: Row too big to fit into CursorWindow requiredPos=36, totalRows=37 AndroidRuntime: 	at android.database.sqlite.SQLiteConnection.nativeExecuteForCursorWindow(Native Method) AndroidRuntime: 	at android.database.sqlite.SQLiteConnection.executeForCursorWindow(SQLiteConnection.java:1095) AndroidRuntime: 	at android.database.sqlite.SQLiteSession.executeForCursorWindow(SQLiteSession.java:862) AndroidRuntime: 	at android.database.sqlite.SQLiteQuery.fillWindow(SQLiteQuery.java:62) AndroidRuntime: 	at android.database.sqlite.SQLiteCursor.fillWindow(SQLiteCursor.java:153) AndroidRuntime: 	at android.database.sqlite.SQLiteCursor.onMove(SQLiteCursor.java:123) AndroidRuntime: 	at android.database.AbstractCursor.moveToPosition(AbstractCursor.java:269) AndroidRuntime: 	at android.database.AbstractCursor.moveToNext(AbstractCursor.java:301) AndroidRuntime: 	at kj0.invoke(r8-map-id-b83892b0dedf950478c610df569ac445f8267599dd4415b2dac798e728bf2bec:842) AndroidRuntime: 	at tg.d(r8-map-id-b83892b0dedf950478c610df569ac445f8267599dd4415b2dac798e728bf2bec:36) AndroidRuntime: 	at y.invoke(r8-map-id-b83892b0dedf950478c610df569ac445f8267599dd4415b2dac798e728bf2bec:1269) AndroidRuntime: 	at jh.b(r8-map-id-b83892b0dedf950478c610df569ac445f8267599dd4415b2dac798e728bf2bec:30) AndroidRuntime: 	at ai3.a

- **Issue #469** (2026-09-07): **BUG? GPT-5.6 models from OpenAI always fail (they need the Responses API)**
  *Symptoms*: ### Description  Specs: Android 17 Pixel 10  OpenAI service: GPT 5.6 models such as Luna, Terra, Sol fail all requests.  When it fails it shows a message saying that this model cannot use tools+reasoning with chat/completions.  Some newer models like there require you to use the Responses API (v1/responses) instead. The chat/completions will not work properly with such models.   Tried using a custom endpoint as a workaround but the openai-compatible endpoint automatically uses chat/completions and cannot be set up to use the responses API.  Currently, GPT 5.6 luna is an amazing model for the price, it accepts much larger contexts than other models, it is more powerful and for a fraction of the price. It would be great if we could natively use it here.  Amazing project, btw :)   ### Steps to Reproduce  1. Setup OpenAI service with API key 2. Select GPT 5.6 luna 3. Try to chat 4. Fails.  ### Kai Version  0.3.1  ### Platform  Android  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hm... I wonder if OpenAI changed their API.
  > ## Update: OpenAI DID change their API. @SimonSchubert  Might want to fix this.
  > Thank you for the detailed issue, updated the api specs ✅ https://github.com/SimonSchubert/Kai/commit/662c34d359c22a5f878dd6846a10125c39d978e5

- **Issue #468** (2026-09-07): **BUG: Debian 12 fails to install on Android**
  *Symptoms*: ### Description  Specs:  - Pixel 10  - Android 17  - Installed from the Play Store  Whenever I try to install Debian 12 (Kai Build) I get the following error:  Setup failed: Failed to install base packages: proot warning: can't sanitize binding "/data/user/0/com.inspiredandroid.kai/ files/kai-build/tmp": No such file or directory proot warning: can't canonicalize /data/user/0/ com.inspiredandroid. kai/files/kai-build/tmp: No such file or directory proot warning: Unable to create temp directory for f2fs bug probe: No such file or directory E: Unable to locate package bash ca-certificates curl wget git nano less unzip python3 tar coreutils  This happens when the installer shows "Installing base packages"  ### Steps to Reproduce  1. Go to Settings -> Linux Sandbox 2. Debian 12 -> Install OR 1. Setup Kai Build 2. Follow instructions to install Debian  ### Kai Version  0.3.1  ### Platform  Android  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Happened to me too
  > Same problem. Could you pre-define the filename path in the installation package? That way, the installation process can recognize it directly without errors.  <img width="852" height="392" alt="Image" src="https://github.com/user-attachments/assets/d62009bf-1430-420b-aeb3-115cc784d3a9" />
  > Same issue

- **Issue #422** (2026-08-31): **What is your problem with Llama models?**
  *Symptoms*: ### Description  I was using my ollama server with a llama3.2 model and it won't appear in interactive mode but anything other than llama models WILL.  ### Steps to Reproduce  1. setup ollama 2. get llama model 3. Go to interactive ui with the llama model as default  ### Kai Version  3.0.0  ### Platform  Android  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > You can create a second Ollama model named something else to fix it BTW.
  > Thank you for trying out the interactive mode. some models (llama3.2:1b, llama3.2:3b, llama3.1:8b, tinyllama, codellama..) are excluded from the interactive mode because the performance of these models weren't satisfying on the tasks. how was your experience after renaming the model? and which model exactly were you using?
  > It didn't work at all.  llama3.2:1b I see why you did not allow certain models! Please include a notice in the docs or in the app itself about this in the future. Thanks!

- **Issue #416** (2026-10-02): **Se desconecta y deja de contestar**
  *Symptoms*: ### Description  Mara herramientas fuera de servicio   ### Steps to Reproduce  Resolver error de conexión o respuesta de ia  ### Kai Version  3.0.0.  ### Platform  Android  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Closing because there isn't enough detail to act on. If this still happens on the latest version, please open a new issue with the platform, app version, service/model, steps to reproduce, and logs or the exact error text.

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

### Incident Patch 1: `6d365d8c` (2026-10-02)
**Commit Message**: Auto-fix: spotlessApply and updateScreenshots [skip ci]

**File**: `iosApp/Configuration/Config.xcconfig` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 TEAM_ID=
 BUNDLE_ID=com.inspiredandroid.kai
 APP_NAME=Kai - AI
-APP_VERSION=3.2.0
+APP_VERSION=3.3.0
```

---

### Incident Patch 2: `0c638e6d` (2026-10-02)
**Commit Message**: Auto-fix: spotlessApply and updateScreenshots [skip ci]



---

### Incident Patch 3: `3591032e` (2026-10-01)
**Commit Message**: Build tool error results as JSON and treat null arguments as absent

Error messages with quotes or newlines produced invalid JSON, and an
explicit null argument reached tools as the string "null".

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/data/ToolExecutor.kt` (modified, +22/-9)
```diff
@@ -16,15 +16,26 @@ import kotlinx.serialization.json.JsonObject
 import kotlinx.serialization.json.JsonPrimitive
 import kotlinx.serialization.json.boolean
 import kotlinx.serialization.json.booleanOrNull
+import kotlinx.serialization.json.buildJsonObject
 import kotlinx.serialization.json.double
 import kotlinx.serialization.json.doubleOrNull
 import kotlinx.serialization.json.int
 import kotlinx.serialization.json.intOrNull
 import kotlinx.serialization.json.jsonObject
+import kotlinx.serialization.json.put
 import org.jetbrains.compose.resources.getString
 
 private const val MAX_TOOL_RESULT_LENGTH = 20_000
 
+/**
+ * `{"success": false, "error": message}`, built as JSON rather than by string interpolation —
+ * error messages routinely contain quotes and newlines that would otherwise produce invalid JSON.
+ */
+internal fun toolErrorJson(message: String): String = buildJsonObject {
+    put("success", false)
+    put("error", message)
+}.toString()
+
 class ToolExecutor(
     private val toolsProvider: () -> List<Tool> = { getAvailableTools() },
 ) {
@@ -38,12 +49,12 @@ class ToolExecutor(
     ): String {
         val tools = toolsProvider()
         val tool = tools.find { it.schema.name == name }
-            ?: return """{"success": false, "error": "Unknown tool: $name"}"""
+            ?: return toolErrorJson("Unknown tool: $name")
 
         val args = try {
             parseJsonToMap(arguments)
         } catch (e: Exception) {
-            return """{"success": false, "error": "Failed to parse arguments: ${e.message}"}"""
+            return toolErrorJson("Failed to parse arguments: ${e.message}")
         }
 
         return try {
@@ -66,17 +77,17 @@ class ToolExecutor(
 
                 is String -> result
 
-                else -> """{"result": "$result"}"""
+                else -> buildJsonObject { put("result", result.toString()) }.toString()
             }
             truncateResult(resultString)
         } catch (e: TimeoutCancellationException) {
-            """{"success": false, "error": "Tool '$name' timed out after ${tool.timeout}"}"""
+            toolErrorJson("Tool '$name' timed out after ${tool.timeout}")
         } catch (e: CancellationException) {
             // Cooperative cancellation (user pressed stop) must propagate, not become a
             // fake tool result the loop would keep reasoning about.
             throw e
         } catch (e: Exception) {
-            """{"success": false, "error": "Tool execution failed: ${e.message}"}"""
+            toolErrorJson("Tool execution failed: ${e.message}")
         }
     }
 
@@ -105,9 +116,11 @@ class ToolExecutor(
         return jsonObject.toMap()
     }
 
-    private fun JsonObject.toMap(): Map<String, Any> = entries.associate { (key, value) ->
-        key to jsonElementToAny(value)
-    }
+    // An explicit JSON null means "not provided": dropping the key lets tools fall back to their
+    // defaults instead of receiving the string "null".
+    private fun JsonObject.toMap(): Map<String, Any> = entries
+        .filter { (_, value) -> value !is JsonNull }
+        .associate { (key, value) -> key to jsonElementToAny(value) }
 
     private fun jsonElementToAny(element: JsonElement): Any = when (element) {
         JsonNull -> "null"
@@ -120,7 +133,7 @@ class ToolExecutor(
             else -> element.content
         }
 
-        is JsonObject -> element.entries.associate { (k, v) -> k to jsonElementToAny(v) }
+        is JsonObject -> element.toMap()
 
         is JsonArray -> element.map { jsonElementToAny(it) }
     }
```

**File**: `composeApp/src/commonTest/kotlin/com/inspiredandroid/kai/data/ToolExecutorTest.kt` (modified, +29/-0)
```diff
@@ -8,7 +8,11 @@ import kotlinx.coroutines.delay
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.runCurrent
 import kotlinx.coroutines.test.runTest
+import kotlinx.serialization.json.Json
+import kotlinx.serialization.json.jsonObject
+import kotlinx.serialization.json.jsonPrimitive
 import kotlin.test.Test
+import kotlin.test.assertEquals
 import kotlin.test.assertFailsWith
 import kotlin.test.assertTrue
 import kotlin.time.Duration
@@ -70,4 +74,29 @@ class ToolExecutorTest {
         val result = executor.executeTool("fake_tool", "{}")
         assertTrue(result.contains("Tool execution failed"))
     }
+
+    @Test
+    fun `error results stay valid JSON when the message contains quotes and newlines`() = runTest {
+        val executor = executorWith(FakeTool { throw IllegalStateException("bad \"value\"\nat line 2") })
+        val result = Json.parseToJsonElement(executor.executeTool("fake_tool", "{}")).jsonObject
+
+        assertEquals("false", result["success"]?.jsonPrimitive?.content)
+        assertEquals("Tool execution failed: bad \"value\"\nat line 2", result["error"]?.jsonPrimitive?.content)
+    }
+
+    @Test
+    fun `explicit null arguments are treated as absent`() = runTest {
+        var received: Map<String, Any>? = null
+        val tool = object : Tool {
+            override val schema = ToolSchema(name = "fake_tool", description = "test tool", parameters = emptyMap())
+            override suspend fun execute(args: Map<String, Any>): Any {
+                received = args
+                return "ok"
+            }
+        }
+        ToolExecutor(toolsProvider = { listOf(tool) })
+            .executeTool("fake_tool", """{"url": "https://a", "method": null, "opts": {"x": null, "y": 1}}""")
+
+        assertEquals(mapOf("url" to "https://a", "opts" to mapOf("y" to 1)), received)
+    }
 }
```

---

### Incident Patch 4: `ee201a35` (2026-10-01)
**Commit Message**: Don't retry provider errors that a retry can't fix

Invalid API key, unknown model, request too large, moderation, bad request
and local size/type rejections now fail straight to the next fallback
service instead of costing ~3 s of retries each.

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/data/RemoteDataRepository.kt` (modified, +30/-2)
```diff
@@ -28,11 +28,18 @@ import com.inspiredandroid.kai.mcp.McpServerConfig
 import com.inspiredandroid.kai.mcp.McpServerManager
 import com.inspiredandroid.kai.network.AllServicesFailedException
 import com.inspiredandroid.kai.network.AnthropicInsufficientCreditsException
+import com.inspiredandroid.kai.network.AnthropicInvalidApiKeyException
 import com.inspiredandroid.kai.network.ContextWindowExceededException
 import com.inspiredandroid.kai.network.FileTooLargeException
+import com.inspiredandroid.kai.network.GeminiInvalidApiKeyException
+import com.inspiredandroid.kai.network.OpenAICompatibleBadRequestException
+import com.inspiredandroid.kai.network.OpenAICompatibleContentModerationException
 import com.inspiredandroid.kai.network.OpenAICompatibleEmptyResponseException
 import com.inspiredandroid.kai.network.OpenAICompatibleGenericException
+import com.inspiredandroid.kai.network.OpenAICompatibleInvalidApiKeyException
+import com.inspiredandroid.kai.network.OpenAICompatibleModelNotFoundException
 import com.inspiredandroid.kai.network.OpenAICompatibleQuotaExhaustedException
+import com.inspiredandroid.kai.network.OpenAICompatibleRequestTooLargeException
 import com.inspiredandroid.kai.network.Requests
 import com.inspiredandroid.kai.network.ServiceCredentials
 import com.inspiredandroid.kai.network.UnsupportedFileTypeException
@@ -651,7 +658,7 @@ class RemoteDataRepository(
                 toolExecutor.executeTool(name, arguments, conversationIdForTool)
             } catch (e: Exception) {
                 if (e is kotlinx.coroutines.CancellationException) throw e
-                """{"success": false, "error": "${e.message ?: "Tool execution failed"}"}"""
+                toolErrorJson(e.message ?: "Tool execution failed")
             }
             val elapsed = Clock.System.now().toEpochMilliseconds() - startTime
             if (elapsed < MIN_TOOL_DISPLAY_MS) {
@@ -1341,7 +1348,28 @@ class RemoteDataRepository(
         }
     }
 
-    private fun isNonRetryableException(e: Exception): Boolean = e is AnthropicInsufficientCreditsException || e is OpenAICompatibleQuotaExhaustedException
+    /**
+     * Failures that a retry a second later cannot fix: exhausted credit, rejected credentials, and
+     * requests the provider refused as malformed, too large or disallowed. Retrying these only
+     * delays the fallback chain (~3 s per service). Unknown/generic errors stay retryable.
+     */
+    private fun isNonRetryableException(e: Exception): Boolean = when (e) {
+        is AnthropicInsufficientCreditsException,
+        is OpenAICompatibleQuotaExhaustedException,
+        is AnthropicInvalidApiKeyException,
+        is GeminiInvalidApiKeyException,
+        is OpenAICompatibleInvalidApiKeyException,
+        is OpenAICompatibleModelNotFoundException,
+        is OpenAICompatibleRequestTooLargeException,
+        is OpenAICompatibleContentModerationException,
+        is OpenAICompatibleBadRequestException,
+        is ContextWindowExceededException,
+        is UnsupportedFileTypeException,
+        is FileTooLargeException,
+        -> true
+
+        else -> false
+    }
 
     /**
      * Retries an API call with simple exponential backoff.
```

---

### Incident Patch 5: `de2c36a6` (2026-10-01)
**Commit Message**: Fire kai-ui countdown callbacks only from interactive messages

The timer restarts when an item re-enters composition, so older countdowns
sent unrequested callbacks after reopening or scrolling a chat.

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/dynamicui/KaiUiRenderer.kt` (modified, +5/-1)
```diff
@@ -993,6 +993,10 @@ private fun RenderCountdown(
     var remainingSeconds by remember { mutableStateOf<Long>(node.seconds.toLong()) }
     var expired by remember { mutableStateOf(false) }
     val currentOnCallback by rememberUpdatedState(onCallback)
+    // The timer restarts whenever the item re-enters composition (scrolling, reopening a chat),
+    // so only a still-interactive message may fire its callback — an older countdown must never
+    // send the model a message the user didn't ask for.
+    val currentIsInteractive by rememberUpdatedState(isInteractive)
 
     LaunchedEffect(targetMs) {
         while (true) {
@@ -1004,7 +1008,7 @@ private fun RenderCountdown(
                     node.id?.let { formState[it] = "0" }
                     try {
                         when (val action = node.action) {
-                            is CallbackAction -> {
+                            is CallbackAction -> if (currentIsInteractive) {
                                 val data = collectFormData(action, formState)
                                 currentOnCallback(action.event, data)
                             }
```

**File**: `docs/features/dynamic-ui.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # Dynamic UI (kai-ui)
 
-**Last verified:** 2026-07-18
+**Last verified:** 2026-10-01
 
 AI-generated interactive UI layouts rendered inline in chat messages. The AI produces JSON-based layout definitions wrapped in `kai-ui` code fences. Compose renders them natively with support for forms, buttons, and multi-step flows. Enabled by default; users can disable it in Settings, which removes the instructions from the system prompt. Because the system prompt is rebuilt per request, toggling the setting takes effect on the next message in any conversation. Parsing and rendering stay active regardless so existing messages with kai-ui blocks always render.
 
@@ -15,7 +15,7 @@ A `kai-ui` code fence inside an assistant message contains a JSON object describ
 - **Layout**: column, row, card, box, divider (spacing between children is fixed by the renderer — the LLM does not control it)
 - **Content**: text (with headline/title/body/caption styles), image (optional aspect ratio to prevent distortion on wide screens), icon (curated material icon set or any emoji), code (syntax-highlighted block with a built-in copy-to-clipboard icon in the top-right corner)
 - **Interactive**: button (filled/outlined/text/tonal variants), text input, checkbox, switch, select dropdown, radio group, slider, chip group (single-select, multi-select, or display-only tags)
-- **Feedback**: progress (determinate/indeterminate), countdown (relative duration with optional expiry action), alert (info/success/warning/error)
+- **Feedback**: progress (determinate/indeterminate), countdown (relative duration with optional expiry action; a callback action fires only while the message is still interactive, so older countdowns never send messages when the chat is reopened or scrolled), alert (info/success/warning/error)
 - **Navigation**: tabs (tabbed content), accordion (collapsible sections)
 - **Display**: quote (blockquote with accent border), badge (colored count/status pill), stat (large metric display), avatar (circular image or initials)
 - **Data**: list, table
```

---

### Incident Patch 6: `4b5f0f1c` (2026-10-01)
**Commit Message**: Keep chat history intact when compaction fails or a tool loop trims context

Compaction no longer drops older turns on a failed or cancelled summary while
the history still fits; the Gemini/Anthropic tool loop trims a request copy
instead of the visible conversation (dropping orphan leading tool results);
and tool spinners go to the run's own history, so heartbeat and scheduled
runs no longer leak rows into the open chat.

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/data/RemoteDataRepository.kt` (modified, +27/-16)
```diff
@@ -158,8 +158,8 @@ private interface ToolLoopStrategy {
     suspend fun bailout(history: List<History>, systemPrompt: String?, reason: BailoutReason): String
 
     /**
-     * Context budget used to trim raw history between tool rounds. Providers that send the
-     * history as-is (Gemini, Anthropic) declare their window here; the OpenAI-compatible
+     * Context budget used to trim the request copy of the history each tool round. Providers that
+     * send the history as-is (Gemini, Anthropic) declare their window here; the OpenAI-compatible
      * strategy trims the built message list inside [chat] instead and leaves this null.
      */
     val historyContextWindowTokens: Int? get() = null
@@ -1169,7 +1169,12 @@ class RemoteDataRepository(
         val recentSignatures = mutableListOf<String>()
         while (true) {
             iteration++
-            val visible = history.value.filter { it.role != History.Role.TOOL_EXECUTING }
+            val visible = history.value.filter { it.role != History.Role.TOOL_EXECUTING }.let { full ->
+                // Trim a request copy only — the history flow is the visible, persisted conversation.
+                strategy.historyContextWindowTokens
+                    ?.let { trimHistoryForContext(full, systemPrompt?.length ?: 0, it).ifEmpty { full } }
+                    ?: full
+            }
             if (iteration > MAX_TOOL_ITERATIONS) {
                 return AssistantTurn(strategy.bailout(visible, systemPrompt, BailoutReason.LIMIT_REACHED))
             }
@@ -1203,10 +1208,11 @@ class RemoteDataRepository(
 
             val toolResults = executeToolCallsInParallel(
                 result.toolCalls.map { Triple(it.id, it.name, it.arguments) },
+                history,
             )
 
             history.update { h ->
-                val merged = buildList(h.size + toolResults.size) {
+                buildList(h.size + toolResults.size) {
                     for (entry in h) {
                         if (entry.role != History.Role.TOOL_EXECUTING) add(entry)
                     }
@@ -1221,9 +1227,6 @@ class RemoteDataRepository(
                         )
                     }
                 }
-                strategy.historyContextWindowTokens
-                    ?.let { trimHistoryForContext(merged, systemPrompt?.length ?: 0, it) }
-                    ?: merged
             }
         }
     }
@@ -1283,18 +1286,20 @@ class RemoteDataRepository(
     }
 
     /**
-     * Executes tool calls in parallel, showing TOOL_EXECUTING indicators in the UI.
+     * Executes tool calls in parallel, showing TOOL_EXECUTING indicators in [history] — the run's
+     * own flow, so background runs (heartbeat, scheduled tasks) don't leak rows into the open chat.
      * Returns a list of (callId, toolName, result).
      */
     private suspend fun executeToolCallsInParallel(
         toolCalls: List<Triple<String, String, String>>,
+        history: MutableStateFlow<List<History>>,
     ): List<Triple<String, String, String>> {
         // Add all TOOL_EXECUTING indicators first
         val executingIds = toolCalls.map { Uuid.random().toString() }
         for ((index, toolCall) in toolCalls.withIndex()) {
             val (_, name, _) = toolCall
             val toolDisplayName = toolExecutor.getToolDisplayName(name)
-            chatHistory.update {
+            history.update {
                 it.toMutableList().apply {
                     add(
                         History(
@@ -1330,8 +1335,8 @@ class RemoteDataRepository(
         } finally {
             // Remove all TOOL_EXECUTING indicators — also on cancellation, so stopping a
             // run doesn't strand spinner rows in the chat. Non-suspending, safe in finally.
-            chatHistory.update { history ->
-                history.filter { h -> h.id !in executingIds }
+            history.update { h ->
+                h.filter { it.id !in executingIds }
             }
         }
     }
@@ -1459,13 +1464,16 @@ class RemoteDataRepository(
             usedChars += msgChars
         }
 
-        return kept
+        // Dropping from the front can cut a tool round in half; a tool result whose assistant
+        // tool call was trimmed away is an orphan that strict providers reject.
+        return kept.dropWhile { it.role == History.Role.TOOL }
     }
 
     /**
      * Compacts chat history by summarizing older messages via an LLM call when the history
      * exceeds a percentage of the context window. Keeps recent exchanges verbatim and replaces
-     * older ones with a single summary. Falls back to simple drop-oldest trimming on failure.
+     * older ones with a single summary. If summarization fails, drops the older turns only when the
+     * history no longer fits the context window; cancellation propagates without touching history.
      */
     private suspend fun compactHistoryIfNeeded() {
         // Use primary service's context window for compaction decisions
@
```

**File**: `docs/features/tools.md` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 # Tools
 
-**Last verified:** 2026-08-09
+**Last verified:** 2026-10-01
 
 Kai's tools feature allows the AI to execute external functions during conversations — web search, notifications, calendar events, shell commands, memory operations, and more. Tools are defined with a schema, executed with safety guards, and managed through per-tool toggles in settings.
 
@@ -192,9 +192,9 @@ Tool results longer than 20,000 characters are truncated with a note indicating
 
 ### Context trimming
 
-Between tool loop iterations, the message history is trimmed to fit within the model's context window. All three providers (OpenAI-compatible, Gemini, Anthropic) perform inter-iteration trimming. Context window sizes are estimated per model (e.g. Gemini 2.5 = 1M tokens, Claude = 200K, GPT-4o = 128K, small local models = 8–32K) and oldest messages are dropped first while preserving the system prompt.
+Before every tool loop request, the message history sent to the model is trimmed to fit within the model's context window. All three providers (OpenAI-compatible, Gemini, Anthropic) trim per request. Only the outgoing copy is trimmed: the conversation shown in the chat and saved to disk keeps every message. Context window sizes are estimated per model (e.g. Gemini 2.5 = 1M tokens, Claude = 200K, GPT-4o = 128K, small local models = 8–32K) and oldest messages are dropped first while preserving the system prompt.
 
-Trimming preserves the tool-call pairing required by strict OpenAI-compatible providers (e.g. DeepSeek via OpenCode Zen): an assistant turn that requested tool calls is dropped together with the tool responses that answer it, never split. A trailing tool result is never kept without the assistant message that requested it.
+Trimming preserves the tool-call pairing required by strict OpenAI-compatible providers (e.g. DeepSeek via OpenCode Zen): an assistant turn that requested tool calls is dropped together with the tool responses that answer it, never split. A tool result is never kept without the assistant message that requested it; on Gemini and Anthropic, tool results left at the start of the trimmed history are dropped.
 
 ### Tool-call message sanitization (OpenAI-compatible)
 
@@ -206,7 +206,7 @@ When the fallback chain is active, each fallback service is checked before use.
 
 ### Chat history compaction
 
-When conversation history exceeds 70% of the primary model's context window, an AI-powered compaction runs before the next API call. Older messages are summarized into a single compact entry via a separate LLM call, while the most recent 4 user exchanges are kept verbatim. If the summarization call fails, older messages are dropped as a fallback.
+When conversation history exceeds 70% of the primary model's context window, an AI-powered compaction runs before the next API call. Older messages are summarized into a single compact entry via a separate LLM call, while the most recent 4 user exchanges are kept verbatim. If the summarization call fails, the history is left intact while it still fits the context window; older messages are dropped only when it no longer fits at all. Stopping the request during compaction never changes the history.
 
 ## MCP Servers
 
```

---

### Incident Patch 7: `fe16ce5d` (2026-10-01)
**Commit Message**: Collapse %% in the Kai Build download label

The Compose resource formatter passes the %% escape through verbatim,
so the label read "42%%".

Fixes #512

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/build/BuildSetupContent.kt` (modified, +7/-1)
```diff
@@ -127,12 +127,18 @@ internal fun BuildSetupContent(
     }
 }
 
+/**
+ * The Compose resource formatter substitutes `%1$d` but passes the `%%` escape through verbatim,
+ * so `"%1$d%%"` would render as `42%%`. No-op once the formatter unescapes it itself.
+ */
+internal fun String.collapsePercentEscape(): String = replace("%%", "%")
+
 @Composable
 private fun stepLabel(state: BuildEnvironmentState.Installing): String = when (state.step) {
     BuildStep.Download -> stringResource(
         Res.string.kai_build_step_download,
         ((state.progress ?: 0f) * 100).toInt(),
-    )
+    ).collapsePercentEscape()
     BuildStep.Extract -> stringResource(Res.string.kai_build_step_extract)
     BuildStep.Configure -> stringResource(Res.string.kai_build_step_configure)
     BuildStep.BasePackages -> stringResource(Res.string.kai_build_step_base_packages)
```

**File**: `composeApp/src/commonTest/kotlin/com/inspiredandroid/kai/ui/build/PercentEscapeTest.kt` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+package com.inspiredandroid.kai.ui.build
+
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/** The Kai Build download label must show `42%`, not the raw `%%` escape (#512). */
+class PercentEscapeTest {
+
+    @Test
+    fun doubledPercentCollapsesToOne() {
+        assertEquals("Downloading Debian… 42%", "Downloading Debian… 42%%".collapsePercentEscape())
+    }
+
+    @Test
+    fun alreadyUnescapedLabelIsUnchanged() {
+        assertEquals("Downloading Debian… 42%", "Downloading Debian… 42%".collapsePercentEscape())
+    }
+}
```

---

### Incident Patch 8: `fa55b12f` (2026-09-29)
**Commit Message**: Add workflow to build package-registration APK

Builds a release APK signed with the release key and containing the
Android Developer Console registration token passed as a workflow input.

**File**: `.github/workflows/adi-registration.yml` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+name: ADI Registration APK
+
+# Builds a release APK signed with the release key and containing the
+# Android Developer Console package-registration token, so package ownership
+# can be proven without the keystore ever leaving GitHub secrets.
+
+on:
+  workflow_dispatch:
+    inputs:
+      snippet:
+        description: 'Snippet from the "Sign and upload an APK" step (contents of adi-registration.properties)'
+        required: true
+        type: string
+
+permissions:
+  contents: read
+
+env:
+  EXPECTED_CERT_SHA256: 9963a272dc3828e23ccdddf2121a32ad428c6633f188c5c263b74414dc20a33f
+
+jobs:
+  apk:
+    name: Build registration APK
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v4
+      - name: Setup JDK
+        uses: actions/setup-java@v4
+        with:
+          distribution: temurin
+          java-version: "21"
+      - name: Set execution flag for gradlew
+        run: chmod +x gradlew
+      - name: Setup Android SDK
+        uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
+      - name: Install Android Build Tools
+        run: |
+          sdkmanager "build-tools;36.0.0"
+          sdkmanager "build-tools;29.0.3"
+      - name: Add registration token
+        env:
+          SNIPPET: ${{ inputs.snippet }}
+        run: |
+          mkdir -p androidApp/src/main/assets
+          printf '%s\n' "$SNIPPET" > androidApp/src/main/assets/adi-registration.properties
+      - name: Build APK
+        run: bash ./gradlew :androidApp:assembleFossRelease --stacktrace
+      - name: Sign APK
+        uses: r0adkll/sign-android-release@v1
+        with:
+          releaseDirectory: androidApp/build/outputs/apk/foss/release
+          signingKeyBase64: ${{ secrets.KEYSTORE_B64 }}
+          alias: ${{ secrets.KEY_ALIAS }}
+          keyStorePassword: ${{ secrets.KEYSTORE_PASSWORD }}
+          keyPassword: ${{ secrets.KEYSTORE_PASSWORD }}
+      - name: Verify token and signing certificate
+        run: |
+          APK=androidApp/build/outputs/apk/foss/release/androidApp-foss-release-signed.apk
+          unzip -l "$APK" | grep -q 'assets/adi-registration.properties' || { echo "Token missing from APK"; exit 1; }
+          ACTUAL=$("$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs "$APK" | grep -m1 'SHA-256 digest' | awk '{print $NF}')
+          echo "Signer SHA-256: $ACTUAL"
+          [ "$ACTUAL" = "$EXPECTED_CERT_SHA256" ] || { echo "Unexpected signing certificate"; exit 1; }
+      - name: Upload APK Artifact
+        uses: actions/upload-artifact@v4
+        with:
+          name: adi-registration-apk
+          path: androidApp/build/outputs/apk/foss/release/androidApp-foss-release-signed.apk
+          retention-days: 3
```

---

### Incident Patch 9: `e0210fe6` (2026-09-16)
**Commit Message**: Fix CI: skip removed Android SDK tools package in setup-android

**File**: `.github/workflows/play-store.yml` (modified, +3/-1)
```diff
@@ -34,7 +34,9 @@ jobs:
       - name: Set execution flag for gradlew
         run: chmod +x gradlew
       - name: Setup Android SDK
-        uses: android-actions/setup-android@v3
+        uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
       - name: Decode Play Store keystore
         run: echo "${{ secrets.PLAY_STORE_KEYSTORE_B64 }}" | base64 --decode > /tmp/keystore.jks
       - name: Decode Play Store service account key
```

**File**: `.github/workflows/release.yml` (modified, +3/-1)
```diff
@@ -26,7 +26,9 @@ jobs:
       - name: Set execution flag for gradlew
         run: chmod +x gradlew
       - name: Setup Android SDK
-        uses: android-actions/setup-android@v3
+        uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
       - name: Install Android Build Tools
         run: |
           sdkmanager "build-tools;36.0.0"
```

**File**: `.github/workflows/test.yml` (modified, +3/-1)
```diff
@@ -37,7 +37,9 @@ jobs:
           fi
 
       - name: Set up Android SDK
-        uses: android-actions/setup-android@v3
+        uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
 
       - name: Set up Java
         uses: actions/setup-java@v4
```

---

### Incident Patch 10: `e5374998` (2026-09-07)
**Commit Message**: Auto-fix: spotlessApply and updateScreenshots [skip ci]

**File**: `iosApp/Configuration/Config.xcconfig` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 TEAM_ID=
 BUNDLE_ID=com.inspiredandroid.kai
 APP_NAME=Kai - AI
-APP_VERSION=3.1.0
+APP_VERSION=3.2.0
```

---

### Incident Patch 11: `d6b52d8d` (2026-09-07)
**Commit Message**: Fix Debian install failing on the base package step

apt got the whole base set as a single shell-quoted argument, so it looked
for one package literally named "bash ca-certificates curl ..." and failed
on every device. Each name is now quoted separately.

The install also wiped the tmp dir after creating it, leaving proot to bind
a /tmp that did not exist, which is where the "can't sanitize binding"
warnings in the same failure came from.

Fixes #482, #468, #470

**File**: `composeApp/src/androidMain/kotlin/com/inspiredandroid/kai/linux/LinuxInstaller.kt` (modified, +4/-1)
```diff
@@ -48,6 +48,9 @@ class LinuxInstaller(private val paths: LinuxPaths) {
         // index update (or a distro change) always re-extracts cleanly — and so
         // nothing reading the marker mid-install sees the outgoing install's.
         paths.deleteInstall()
+        // deleteInstall() takes the tmp dir with it, and proot binds that as
+        // /tmp — without this the install runs with no /tmp at all.
+        paths.ensureLayout()
 
         val archive = paths.archiveFile(spec)
         try {
@@ -144,7 +147,7 @@ class LinuxInstaller(private val paths: LinuxPaths) {
         // way its dependency solver sees the full picture.
         onStep(InstallStep.Packages(distro.basePackages))
         val result = launcher.execute(
-            manager.installCommand(distro.basePackages.joinToString(" ")),
+            manager.installCommand(distro.basePackages),
             timeoutSeconds = PACKAGE_TIMEOUT_SECONDS,
         )
         check(result.success) { "Failed to install base packages: ${result.failureDetail()}" }
```

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/linux/ApkPackageManager.kt` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ object ApkPackageManager : PackageManagerSpec {
 
     override fun searchCommand(query: String, limit: Int): String = "apk search -v ${shellQuote(query)} | head -n $limit"
 
-    override fun installCommand(name: String): String = "apk add --no-cache ${shellQuote(name)}"
+    override fun installCommand(names: List<String>): String = "apk add --no-cache ${shellQuoteAll(names)}"
 
     override fun removeCommand(name: String): String = "apk del ${shellQuote(name)}"
 
```

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/linux/AptPackageManager.kt` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ object AptPackageManager : PackageManagerSpec {
 
     // --no-install-recommends keeps a phone-sized rootfs from pulling in docs,
     // X11 and systemd dependencies it can never use.
-    override fun installCommand(name: String): String = "apt-get install -y --no-install-recommends ${shellQuote(name)}"
+    override fun installCommand(names: List<String>): String = "apt-get install -y --no-install-recommends ${shellQuoteAll(names)}"
 
     override fun removeCommand(name: String): String = "apt-get remove -y ${shellQuote(name)}"
 
```

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/linux/PackageManagerSpec.kt` (modified, +15/-1)
```diff
@@ -32,7 +32,14 @@ interface PackageManagerSpec {
     /** Searches names *and* descriptions, capped at [limit] lines, for [parseSearch]. */
     fun searchCommand(query: String, limit: Int): String
 
-    fun installCommand(name: String): String
+    /**
+     * Installs [names] in one call, each a separate shell argument. apt resolves
+     * a whole set at once, which is both faster and the only way its dependency
+     * solver sees the full picture.
+     */
+    fun installCommand(names: List<String>): String
+
+    fun installCommand(name: String): String = installCommand(listOf(name))
 
     fun removeCommand(name: String): String
 
@@ -49,3 +56,10 @@ interface PackageManagerSpec {
 
 /** Single-quotes [s] for `sh -c`, escaping any embedded quote. */
 internal fun shellQuote(s: String): String = "'" + s.replace("'", "'\\''") + "'"
+
+/**
+ * Quotes each of [names] separately. Quoting the joined string instead would
+ * hand the package manager one argument whose name contains spaces, which it
+ * can only fail to locate.
+ */
+internal fun shellQuoteAll(names: List<String>): String = names.joinToString(" ") { shellQuote(it) }
```

**File**: `composeApp/src/commonTest/kotlin/com/inspiredandroid/kai/linux/ApkPackageManagerTest.kt` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@ class ApkPackageManagerTest {
     @Test
     fun `commands single-quote the package name`() {
         assertEquals("apk add --no-cache 'py3-pip'", ApkPackageManager.installCommand("py3-pip"))
+        assertEquals("apk add --no-cache 'bash' 'curl'", ApkPackageManager.installCommand(listOf("bash", "curl")))
         assertEquals("apk del 'py3-pip'", ApkPackageManager.removeCommand("py3-pip"))
         assertEquals("apk search -v 'fast' | head -n 50", ApkPackageManager.searchCommand("fast", 50))
     }
```

**File**: `composeApp/src/commonTest/kotlin/com/inspiredandroid/kai/linux/AptPackageManagerTest.kt` (modified, +8/-0)
```diff
@@ -104,6 +104,14 @@ class AptPackageManagerTest {
         assertEquals("apt-get remove -y 'python3-pip'", AptPackageManager.removeCommand("python3-pip"))
     }
 
+    @Test
+    fun `a whole set installs as one package name per argument`() {
+        assertEquals(
+            "apt-get install -y --no-install-recommends 'bash' 'ca-certificates' 'curl'",
+            AptPackageManager.installCommand(listOf("bash", "ca-certificates", "curl")),
+        )
+    }
+
     @Test
     fun `dpkg format asks for the status field parseInstalled filters on`() {
         assertTrue(AptPackageManager.listInstalledCommand.contains("\${db:Status-Abbrev}"))
```

---

### Incident Patch 12: `9650bfd1` (2026-08-30)
**Commit Message**: Fix Play Store deploy: bump CI Ruby to 3.4

excon 1.7.0 (pulled in by fastlane) requires Ruby >= 3.3.0, so
bundle install failed with exit code 5 on the pinned Ruby 3.2.

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -312,7 +312,7 @@ jobs:
       - name: Setup Ruby
         uses: ruby/setup-ruby@v1
         with:
-          ruby-version: '3.2'
+          ruby-version: '3.4'
           bundler-cache: true
       - name: Deploy to Play Store
         run: bundle exec fastlane android deploy
```

---

### Incident Patch 13: `daa0621d` (2026-08-30)
**Commit Message**: Auto-fix: spotlessApply and updateScreenshots [skip ci]

**File**: `iosApp/Configuration/Config.xcconfig` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 TEAM_ID=
 BUNDLE_ID=com.inspiredandroid.kai
 APP_NAME=Kai - AI
-APP_VERSION=3.0.0
+APP_VERSION=3.1.0
```

---

### Incident Patch 14: `0801730e` (2026-08-30)
**Commit Message**: Auto-fix: spotlessApply and updateScreenshots [skip ci]



---

### Incident Patch 15: `949384bd` (2026-08-09)
**Commit Message**: Add rename and delete for Kai Build projects

Each project row gets an overflow menu with rename and delete, kept
behind the menu so tapping the row still opens the project. Renaming
rejects an empty name, a path separator, or one another project already
has, caught in the dialog rather than as a rename that quietly does
nothing. Deleting asks first and says how many shells are open in the
project.

Both close the project's sessions: the shells are rooted in that folder,
so once it moves or goes away they are no longer usable. The delete
walks the tree without following symlinks — a project can hold a link
into the rootfs, and following one would take the Debian install with
it.

Folders are addressed by the name the list shows rather than a sanitized
guess at it, so a project created from a shell stays reachable; new
names go through the same sanitizer as project creation.

The wording reuses the already-localized file-browser strings, which the
Files tab inside Kai Build shows anyway.

Also paints the "Open Kai Build" button on the empty chat state in the
phosphor green of the terminal it opens — same pill and label style, new
colors only, taken from the ANSI palette the terminal

**File**: `composeApp/src/androidMain/kotlin/com/inspiredandroid/kai/KaiBuildController.android.kt` (modified, +2/-0)
```diff
@@ -54,6 +54,8 @@ class AndroidKaiBuildController : KaiBuildController {
     override fun uninstall() = manager.uninstall()
     override fun refresh() = manager.refresh()
     override fun createProject(name: String): String? = manager.createProject(name)
+    override fun deleteProject(name: String) = manager.deleteProject(name)
+    override fun renameProject(name: String, newName: String): String? = manager.renameProject(name, newName)
     override fun startSession(project: String, agentId: String?) = manager.startSession(project, agentId)
     override fun selectSession(id: String) = manager.selectSession(id)
     override fun closeSession(id: String) = manager.closeSession(id)
```

**File**: `composeApp/src/androidMain/kotlin/com/inspiredandroid/kai/build/runtime/BuildEnvironmentManager.kt` (modified, +76/-2)
```diff
@@ -288,13 +288,87 @@ class BuildEnvironmentManager(
     }
 
     fun createProject(name: String): String? {
-        val folder = name.trim().replace(INVALID_NAME_CHARS, "-").trim('-', '.').take(64)
-        if (folder.isEmpty()) return null
+        val folder = sanitizeProjectName(name) ?: return null
         File(paths.projectsDir, folder).mkdirs()
         scope.launch { _state.update { it.copy(projects = scanProjects()) } }
         return folder
     }
 
+    /**
+     * Deletes the project folder and everything in it. Its shells go first: they
+     * are rooted in that folder, and one whose working directory has been unlinked
+     * is no longer a session anybody can use.
+     */
+    fun deleteProject(name: String) {
+        val dir = projectDir(name) ?: return
+        closeProjectSessions(name)
+        scope.launch {
+            deleteTree(dir)
+            _state.update { it.copy(projects = scanProjects()) }
+        }
+    }
+
+    /**
+     * Renames the project folder, returning the sanitized new name — or null when
+     * that name is unusable or already taken. Shells are closed for the same reason
+     * as a delete: their working directory is the path that just moved.
+     */
+    fun renameProject(name: String, newName: String): String? {
+        val dir = projectDir(name) ?: return null
+        val folder = sanitizeProjectName(newName) ?: return null
+        if (folder == name) return folder
+        val target = File(paths.projectsDir, folder)
+        if (target.exists()) return null
+        closeProjectSessions(name)
+        if (!dir.renameTo(target)) return null
+        scope.launch { _state.update { it.copy(projects = scanProjects()) } }
+        return folder
+    }
+
+    private fun sanitizeProjectName(name: String): String? = name.trim()
+        .replace(INVALID_NAME_CHARS, "-")
+        .trim('-', '.')
+        .take(64)
+        .takeIf { it.isNotEmpty() }
+
+    /**
+     * An existing project folder, addressed by the name the list shows. Matched
+     * as-is rather than sanitized — the list is a directory listing, so it can hold
+     * names a shell created that sanitizing would rewrite into a different folder —
+     * but never one that reaches outside the projects directory.
+     */
+    private fun projectDir(name: String): File? {
+        if (name.isEmpty() || name == "." || name == ".." || name.contains('/')) return null
+        return File(paths.projectsDir, name).takeIf { it.isDirectory }
+    }
+
+    /**
+     * Deletes [dir] and its contents without following symlinks. A project can hold
+     * a link into the rootfs (agents leave plenty), and a walk that followed one
+     * would delete the Debian install instead of the project.
+     */
+    private fun deleteTree(dir: File) {
+        runCatching {
+            Files.walkFileTree(
+                dir.toPath(),
+                object : SimpleFileVisitor<Path>() {
+                    override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
+                        runCatching { Files.deleteIfExists(file) }
+                        return FileVisitResult.CONTINUE
+                    }
+
+                    override fun visitFileFailed(file: Path, exc: IOException): FileVisitResult =
+                        FileVisitResult.CONTINUE
+
+                    override fun postVisitDirectory(dir: Path, exc: IOException?): FileVisitResult {
+                        runCatching { Files.deleteIfExists(dir) }
+                        return FileVisitResult.CONTINUE
+                    }
+                },
+            )
+        }
+    }
+
     // --- sessions --------------------------------------------------------
 
     /**
```

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/KaiBuildController.kt` (modified, +12/-0)
```diff
@@ -26,6 +26,16 @@ interface KaiBuildController {
     /** Creates `projects/<name>` and returns the sanitized folder name, or null if invalid. */
     fun createProject(name: String): String?
 
+    /** Deletes `projects/<name>` and everything in it. The project's sessions are closed with it. */
+    fun deleteProject(name: String)
+
+    /**
+     * Renames `projects/<name>`, returning the sanitized new folder name — or null
+     * when the name is unusable or already taken. The project's sessions are closed:
+     * their working directory is the folder that just moved.
+     */
+    fun renameProject(name: String, newName: String): String?
+
     /**
      * Starts an interactive PTY session in [project] and makes it the active one.
      * A non-null [agentId] launches that agent's CLI first, leaving a shell behind
@@ -77,6 +87,8 @@ class NoOpKaiBuildController : KaiBuildController {
     override fun uninstall() {}
     override fun refresh() {}
     override fun createProject(name: String): String? = null
+    override fun deleteProject(name: String) {}
+    override fun renameProject(name: String, newName: String): String? = null
     override fun startSession(project: String, agentId: String?) {}
     override fun selectSession(id: String) {}
     override fun closeSession(id: String) {}
```

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/build/BuildProjectsContent.kt` (modified, +203/-6)
```diff
@@ -2,6 +2,8 @@ package com.inspiredandroid.kai.ui.build
 
 import androidx.compose.foundation.horizontalScroll
 import androidx.compose.foundation.layout.Arrangement
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.Spacer
@@ -12,13 +14,18 @@ import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.lazy.LazyColumn
 import androidx.compose.foundation.lazy.items
 import androidx.compose.foundation.rememberScrollState
+import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.foundation.text.KeyboardActions
 import androidx.compose.foundation.text.KeyboardOptions
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.filled.Folder
+import androidx.compose.material.icons.filled.MoreVert
 import androidx.compose.material3.AlertDialog
+import androidx.compose.material3.DropdownMenu
+import androidx.compose.material3.DropdownMenuItem
 import androidx.compose.material3.HorizontalDivider
 import androidx.compose.material3.Icon
+import androidx.compose.material3.IconButton
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.OutlinedTextField
 import androidx.compose.material3.Text
@@ -59,6 +66,17 @@ import kai.composeapp.generated.resources.kai_build_system_title
 import kai.composeapp.generated.resources.kai_build_uninstall
 import kai.composeapp.generated.resources.kai_build_uninstall_message
 import kai.composeapp.generated.resources.kai_build_uninstall_title
+import kai.composeapp.generated.resources.sandbox_files_action_delete
+import kai.composeapp.generated.resources.sandbox_files_action_more
+import kai.composeapp.generated.resources.sandbox_files_action_rename
+import kai.composeapp.generated.resources.sandbox_files_delete_confirm
+import kai.composeapp.generated.resources.sandbox_files_delete_message_directory
+import kai.composeapp.generated.resources.sandbox_files_delete_title
+import kai.composeapp.generated.resources.sandbox_files_rename_confirm
+import kai.composeapp.generated.resources.sandbox_files_rename_error_collision
+import kai.composeapp.generated.resources.sandbox_files_rename_error_invalid
+import kai.composeapp.generated.resources.sandbox_files_rename_label
+import kai.composeapp.generated.resources.sandbox_files_rename_title
 import kai.composeapp.generated.resources.settings_sandbox_cancel
 import kotlinx.collections.immutable.ImmutableList
 import org.jetbrains.compose.resources.stringResource
@@ -75,11 +93,16 @@ internal fun BuildProjectsContent(
     installedAgents: ImmutableList<BuildAgent>,
     onSelectLaunchAgent: (String?) -> Unit,
     onOpenProject: (String) -> Unit,
+    onDeleteProject: (String) -> Unit,
+    onRenameProject: (name: String, newName: String) -> Unit,
     onInstallAgent: (String) -> Unit,
     onUninstall: () -> Unit,
     modifier: Modifier = Modifier,
 ) {
     var showUninstall by remember { mutableStateOf(false) }
+    // The project each dialog is about; null while it is closed.
+    var renaming by rememberSaveable { mutableStateOf<String?>(null) }
+    var deleting by rememberSaveable { mutableStateOf<String?>(null) }
     val missingAgents = remember(state.installedAgents) {
         BuildAgents.all.filterNot { it.id in state.installedAgents }
     }
@@ -138,10 +161,15 @@ internal fun BuildProjectsContent(
         items(state.projects, key = { it }) { project ->
             SettingsCard(
                 modifier = Modifier.fillMaxWidth(),
+                // The row pads itself: the menu button brings its own touch target,
+                // and a card's full padding around that makes every project tall.
+                innerPadding = false,
                 onClick = { onOpenProject(project) },
             ) {
                 Row(
-                    modifier = Modifier.fillMaxWidth(),
+                    modifier = Modifier
+                        .fillMaxWidth()
+                        .padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                     horizontalArrangement = Arrangement.spacedBy(12.dp),
                     verticalAlignment = Alignment.CenterVertically,
                 ) {
@@ -161,15 +189,15 @@ internal fun BuildProjectsContent(
                     val open = sessionCounts[project] ?: 0
                     if (open > 0) {
                         Text(
-                            text = if (open == 1) {
-                                stringResource(Res.string.kai_build_projects_session_open)
-                            } else {
-                                stringResource(Res.string.kai_build_projects_sessions_open, open)
-                            },
+                            text = openSessionsLabel(open),
                             style = MaterialTheme.typography.labelMedium,
```

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/build/KaiBuildScreen.kt` (modified, +6/-0)
```diff
@@ -63,6 +63,8 @@ data class KaiBuildActions(
     val setLaunchAgent: (String?) -> Unit,
     val openProject: (String) -> Unit,
     val createProject: (String) -> Unit,
+    val deleteProject: (String) -> Unit,
+    val renameProject: (name: String, newName: String) -> Unit,
     val closeProject: () -> Unit,
     val startSession: (String?) -> Unit,
     val selectSession: (String) -> Unit,
@@ -98,6 +100,8 @@ fun KaiBuildScreen(
             setLaunchAgent = viewModel::setLaunchAgent,
             openProject = viewModel::openProject,
             createProject = viewModel::createProject,
+            deleteProject = viewModel::deleteProject,
+            renameProject = viewModel::renameProject,
             closeProject = viewModel::closeProject,
             startSession = viewModel::startSession,
             selectSession = viewModel::selectSession,
@@ -227,6 +231,8 @@ internal fun KaiBuildScreenContent(
                         installedAgents = installedAgents,
                         onSelectLaunchAgent = actions.setLaunchAgent,
                         onOpenProject = actions.openProject,
+                        onDeleteProject = actions.deleteProject,
+                        onRenameProject = actions.renameProject,
                         onInstallAgent = actions.installAgent,
                         onUninstall = actions.uninstall,
                     )
```

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/build/KaiBuildViewModel.kt` (modified, +7/-0)
```diff
@@ -121,6 +121,13 @@ class KaiBuildViewModel(
         controller.createProject(name)?.let(::openProject)
     }
 
+    /** Both are offered from the list only, so neither can pull the ground from under an open project. */
+    fun deleteProject(name: String) = controller.deleteProject(name)
+
+    fun renameProject(name: String, newName: String) {
+        controller.renameProject(name, newName)
+    }
+
     /** Opens another session in the project the user is already in. */
     fun startSession(agentId: String?) {
         val project = openProject.value ?: return
```

**File**: `composeApp/src/commonMain/kotlin/com/inspiredandroid/kai/ui/chat/composables/EmptyState.kt` (modified, +20/-0)
```diff
@@ -1,5 +1,6 @@
 package com.inspiredandroid.kai.ui.chat.composables
 
+import androidx.compose.foundation.BorderStroke
 import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Box
@@ -12,6 +13,7 @@ import androidx.compose.foundation.layout.width
 import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.filled.Terminal
+import androidx.compose.material3.ButtonDefaults
 import androidx.compose.material3.Icon
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.OutlinedButton
@@ -22,6 +24,8 @@ import androidx.compose.runtime.remember
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.graphics.luminance
 import androidx.compose.ui.text.LinkAnnotation
 import androidx.compose.ui.text.SpanStyle
 import androidx.compose.ui.text.buildAnnotatedString
@@ -40,6 +44,15 @@ import kai.composeapp.generated.resources.start_interactive_ui
 import kai.composeapp.generated.resources.welcome_message
 import org.jetbrains.compose.resources.stringResource
 
+/**
+ * Phosphor green for the Kai Build button, taken from the ANSI palette its own
+ * terminal paints with: the bright green on dark backgrounds, the darker normal
+ * green where a light one would wash it out. Colors only — the button keeps the
+ * shape and label style it shares with the rest of the empty state.
+ */
+private val TerminalGreenOnDark = Color(0xFF16C60C)
+private val TerminalGreenOnLight = Color(0xFF13A10E)
+
 @Composable
 internal fun EmptyState(
     modifier: Modifier,
@@ -68,9 +81,16 @@ internal fun EmptyState(
             Spacer(Modifier.height(8.dp))
         }
         if (onOpenKaiBuild != null) {
+            val terminalGreen = if (MaterialTheme.colorScheme.background.luminance() < 0.5f) {
+                TerminalGreenOnDark
+            } else {
+                TerminalGreenOnLight
+            }
             OutlinedButton(
                 onClick = onOpenKaiBuild,
                 modifier = Modifier.handCursor(),
+                colors = ButtonDefaults.outlinedButtonColors(contentColor = terminalGreen),
+                border = BorderStroke(1.dp, terminalGreen.copy(alpha = 0.6f)),
             ) {
                 Icon(
                     imageVector = Icons.Default.Terminal,
```

**File**: `composeApp/src/commonTest/kotlin/com/inspiredandroid/kai/ui/build/KaiBuildViewModelTest.kt` (modified, +26/-0)
```diff
@@ -40,11 +40,26 @@ class KaiBuildViewModelTest {
         /** Agent ids passed to [startSession], oldest first. */
         val startedWith = mutableListOf<String?>()
 
+        /** Project names passed to [deleteProject], oldest first. */
+        val deleted = mutableListOf<String>()
+
+        /** Old-to-new pairs passed to [renameProject], oldest first. */
+        val renamed = mutableListOf<Pair<String, String>>()
+
         override fun install(agentIds: Set<String>) {}
         override fun cancel() {}
         override fun uninstall() {}
         override fun refresh() {}
         override fun createProject(name: String): String? = name
+        override fun deleteProject(name: String) {
+            deleted += name
+        }
+
+        override fun renameProject(name: String, newName: String): String {
+            renamed += name to newName
+            return newName
+        }
+
         override fun startSession(project: String, agentId: String?) {
             startedWith += agentId
         }
@@ -112,6 +127,17 @@ class KaiBuildViewModelTest {
         assertEquals(listOf<String?>(null), fakeController.startedWith)
     }
 
+    @Test
+    fun `deleting and renaming reach the environment`() = runTest {
+        val viewModel = KaiBuildViewModel(fakeController, fakeRepository)
+
+        viewModel.deleteProject("old-demo")
+        viewModel.renameProject("demo", "demo-2")
+
+        assertEquals(listOf("old-demo"), fakeController.deleted)
+        assertEquals(listOf("demo" to "demo-2"), fakeController.renamed)
+    }
+
     @Test
     fun `a remembered agent that is no longer installed falls back to a shell`() = runTest {
         fakeRepository.storedKaiBuildLaunchAgent = "opencode"
```

#### Recent Merged Pull Requests:
- **PR #506** (2026-10-02): Add Requesty service (@Thibaultjaigu)
- **PR #492** (closed): fix(android): let Debian apt run in work profiles and system clones (@LaCroixEdu)
- **PR #430** (closed): Improve accessibility with content descriptions and clean up code (@aeldergentics)
- **PR #429** (closed): Improve accessibility and code quality with retries and tests (@aeldergentics)
- **PR #428** (2026-08-29): 🧪 Add tests for ExtensionFunctions (@aeldergentics)
- **PR #407** (closed): Correct MiniMax-M2.7 context window to 204,800 tokens (@octo-patch)
- **PR #380** (closed): Add Dev Tools sandbox (micromamba-backed shell) for desktop Linux (@PrinceGarth)
- **PR #308** (closed): Feature/floating webview browser 16873767631590345836 (@Blackhead9918)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
