> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/maziyarpanahi-openmed-learnings.md`  
> **Source**: github ([https://github.com/maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed))  
> **Source Version**: `4a3b5899`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T23:22:27.389Z  
> **Learning ID**: `learn-github-maziyarpanahi-openmed`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): maziyarpanahi/openmed

> **Canonical Artifact**: `07_PROJECT_LEARNING/maziyarpanahi-openmed-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-31T23:22:26.835Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maziyarpanahi/openmed`
- **Description**: Local-first healthcare AI: clinical NER and HIPAA PII de-identification on hardware you control. 2,200+ medical models, 35 model-backed PII languages, and Python, MLX, Android and browser runtimes. Apache-2.0 SDK.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5744 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/OpenMedMapleDemo/app/src/main/java/org/openmed/maple/MapleOnnxEngine.kt`
```
package org.openmed.maple

import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer
import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OnnxTensorLike
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import java.io.Closeable
import java.nio.DoubleBuffer
import java.nio.FloatBuffer
import java.nio.ShortBuffer
import kotlin.math.exp
import kotlin.random.Random
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

data class MapleGenerationRequest(
    val prompt: String,
    val maxNewTokens: Int,
    val temperature: Float,
    val topK: Int = 24,
    val repetitionPenalty: Float = 1.08f,
)

data class MapleGenerationResult(
    val text: String,
    val generatedTokens: Int,
    val elapsedMillis: Long,
) {
    val tokensPerSecond: Double = if (elapsedMillis <= 0L) {
        0.0
    } else {
        generatedTokens * 1000.0 / elapsedMillis
    }
}

internal fun mapleInitialCacheShape(
    inputName: String,
    declaredShape: LongArray,
): LongArray {
    requireBundle(
        declaredShape.size == 4,
        "Cache input $inputName must have rank 4 [batch, heads, past_sequence, head_dim]",
    )
    requireBundle(
        declaredShape[0] == 1L || declaredShape[0] < 0L,
        "Cache input $inputName must support batch size 1",
    )
    requireBundle(
        declaredShape[1] > 0L && declaredShape[3] > 0L,
        "Cache input $inputName must declare static head count and head dimension",
    )
    requireBundle(
        declaredShape[2] <= 0L,
        "Cache input $inputName must allow a zero-length past sequence",
    )
    return longArrayOf(1L, declaredShape[1], 0L, declaredShape[3])
}

class MapleOnnxEngine private constructor(
    private val bundle: InstalledMapleBundle,
    private val environment: OrtEnvironment,
    private val prefillSession: OrtSession,
    private val decodeSession: OrtSession?,
    private val tokenizer: HuggingFaceTokenizer,
) : Closeable {
    @Volatile
    private var closed = false

    suspend fun generate(
        request: MapleGenerationRequest,
        onPartial: suspend (text: String, tokenCount: Int) -> Unit = { _, _ -> },
    ): MapleGenerationResult = withContext(Dispatchers.Default) {
        check(!closed) { "Maple engine is closed" }
        val encoded = tokenizer.encode(request.prompt, false, false).ids
        val limits = bundle.manifest.generation
        require(encoded.isNotEmpty()) { "The tokenizer returned an empty prompt" }
        require(encoded.size <= limits.maxInputTokens) {
            "Input is ${encoded.size} tokens; this mobile bundle allows ${limits.maxInputTokens}"
        }
        val maxNewTokens = request.maxNewTokens.coerceAtMost(
            limits.maxContextTokens - encoded.size,
        )
        require(maxNewTokens > 0) { "The prompt leaves no room for generation" }

        val generated = ArrayList<Long>(maxNewTokens)
        val random = Random(request.prompt.hashCode())
        var retainedResult: OrtSession.Result? = null
        val startNanos = System.nanoTime()
        try {
            for (step in 0 until maxNewTokens) {
                currentCoroutineContext().ensureActive()
                val cachedDecode = step > 0 && decodeSession != null
                val session = if (cachedDecode) decodeSession!! else prefillSession
                val context = LongArray(encoded.size + generated.size) { index ->
                    if (index < encoded.size) encoded[index] else generated[index - encoded.size]
                }
                val stepInputIds = if (cachedDecode) {
                    longArrayOf(context.last())
                } else {
                    context
                }
                val nextResult = runStep(
                    session = session,
                    inputIds = stepInputIds,
                    fullContextLength = context.size,
                    cachedResult = if (cachedDecode) retainedResult else null,
                )
                val nextToken = try {
                    sampleNextToken(
                        result = nextResult,
                        generated = generated,
                        temperature = request.temperature,
                        topK = request.topK,
                        repetitionPenalty = request.repetitionPenalty,
                        random = random,
                    )
                } catch (error: Throwable) {
                    nextResult.close()
                    throw error
                }
                val previousResult = retainedResult
                retainedResult = nextResult
                previousResult?.close()
                if (nextToken in limits.eosTokenIds) {
                    break
                }
                generated += nextToken
                val partial = tokenizer.decode(generated.toLongArray(), true)
                onPartial(partial, generated.size)
            }
        } finally {
            retainedResult?.close()
        }
        val elapsedMillis = (System.nanoTime() - startNanos) / 1_000_000L
        MapleGenerationResult(
            text = tokenizer.decode(generated.toLongArray(), true),
            generatedTokens = generated.size,
            elapsedMillis = elapsedMillis,
        )
    }

    override fun close() {
        if (closed) return
        closed = true
        var failure: Throwable? = null
        listOfNotNull(decodeSession, prefillSession).distinct().forEach { session ->
            try {
                session.close()
            } catch (error: Throwable) {
                if (failure == null) failure = error else failure?.addSuppressed(error)
            }
        }
        try {
            tokenizer.close()
        } catch (error: Throwable) {
            if (failure == null) failure = error else failure?.addSuppressed(error)
        }
        failure?.let { throw it }
    }

    private fun runStep(
        session: OrtSession,
        inputIds: LongArray,
        fullContextLength: Int,
        cachedResult: OrtSession.Result?,
    ): OrtSession.Result {
        val contract = bundle.manifest.graphs
        val created = mutableListOf<OnnxTensor>()
        val inputs = mutableMapOf<String, OnnxTensorLike>()
        fun addLongInput(name: String, values: LongArray) {
            if (name !in session.inputNames) return
            val tensor = OnnxTensor.createTensor(environment, arrayOf(values))
            created += tensor
            inputs[name] = tensor
        }

        try {
            addLongInput(contract.inputIdsName, inputIds)
            addLongInput(contract.attentionMaskName, LongArray(fullContextLength) { 1L })
            addLongInput(
                contract.positionIdsName,
                if (inputIds.size == 1 && fullContextLength > 1) {
                    longArrayOf((fullContextLength - 1).toLong())
                } else {
                    LongArray(inputIds.size) { it.toLong() }
                },
            )

            val cache = bundle.manifest.cache
            val cacheInputNames = cache?.let { cacheContract ->
                session.inputNames.filter { it.startsWith(cacheContract.pastInputPrefix) }
            }.orEmpty()
            if (cachedResult == null) {
                val inputInfo = session.inputInfo
                cacheInputNames.forEach { inputName ->
                    val tensorInfo = inputInfo[inputName]?.info as? TensorInfo
                        ?: throw MapleBundleException(
                            "Cache input is missing tensor metadata: $inputName",
                        )
                    val initialShape = mapleInitialCacheShape(
                        inputName = inputName,
                        declaredShape = tensorInfo.shape,
                    )
                    val tensor = createInitialCacheTensor(initialShape, tensorInfo.type)
                    created += tensor
                    inputs[inputName] = tensor
                }
            } else {
                val cacheContract = cache
                    ?: throw MapleBundleException("Cached decoding needs a cache contract")
                cacheInputNames.forEach { inputName ->
                    val suffix = inputName.removePrefix(cacheContract.pastInputPrefix)
                    val outputName = cacheContract.presentOutputPrefix + suffix
                    val value = cachedResult.get(outputName).orElseThrow {
                        MapleBundleException("Missing cache output: $outputName")
                    }
                    val tensor = value as? OnnxTensorLike
                        ?: throw MapleBundleException("Cache output is not a tensor: $outputName")
                    inputs[inputName] = tensor
                }
            }

            val supported = buildSet {
                add(contract.inputIdsName)
                add(contract.attentionMaskName)
                add(contract.positionIdsName)
                bundle.manifest.cache?.let { cacheContract ->
                    addAll(
                        session.inputNames.filter {
                            it.startsWith(cacheContract.pastInputPrefix)
                        },
                    )
                }
            }
            val unsupported = session.inputNames - supported
            requireBundle(
                unsupported.isEmpty(),
                "Export graph has unsupported required inputs: " +
                    unsupported.sorted().joinToString(),
            )
            return session.run(inputs)
        } finally {
            created.forEach(OnnxTensor::close)
        }
    }

    private fun createInitialCacheTensor(
        shape: LongArray,
        type: OnnxJavaType,
    ): OnnxTensor = when (type) {
        OnnxJavaType.FLOAT -> OnnxTensor.createTensor(
            environment,
    
```

### Core Architecture Module: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/deid/DeidentifyEngine.kt`
```
package com.openmed.openmedkit.deid

import java.nio.charset.StandardCharsets
import java.util.Locale
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.max
import kotlin.math.min

/**
 * Rewrites detected identifier spans into de-identified text.
 *
 * The engine accepts original-text offsets and applies replacements from
 * right to left, so each span is replaced at its original offsets even when
 * earlier spans expand or shrink the output.
 */
class DeidentifyEngine(
    hashSalt: ByteArray = DEFAULT_HASH_SALT.toByteArray(StandardCharsets.UTF_8),
) {
    private val hashKey = hashSalt.copyOf()

    init {
        require(hashKey.isNotEmpty()) { "hashSalt must not be empty" }
    }

    fun deidentify(
        text: String,
        spans: List<OpenMedSpan>,
        method: DeidentifyMethod,
    ): DeidentifyResult = deidentify(text, spans) { method }

    fun deidentify(
        text: String,
        spans: List<OpenMedSpan>,
        actionsByLabel: Map<String, DeidentifyMethod>,
        defaultMethod: DeidentifyMethod = DeidentifyMethod.MASK,
    ): DeidentifyResult {
        val normalizedActions = actionsByLabel.mapKeys { normalizeLabel(it.key) }
        return deidentify(text, spans) { span ->
            normalizedActions[normalizeLabel(span.canonicalLabel)] ?: defaultMethod
        }
    }

    fun deidentify(
        text: String,
        spans: List<OpenMedSpan>,
        actionForSpan: (OpenMedSpan) -> DeidentifyMethod,
    ): DeidentifyResult {
        if (spans.isEmpty()) {
            return DeidentifyResult(text, emptyList())
        }

        validateBounds(text, spans)
        val replacementState = ReplacementState()
        val orderedSpans = resolveOverlaps(spans)
        val actions = mutableListOf<DeidentifyAction>()
        var outputDelta = 0

        for (span in orderedSpans) {
            val method = actionForSpan(span)
            val surface = text.substring(span.start, span.end)
            val label = normalizeLabel(span.canonicalLabel)
            val textHash = hmacDigest(label, surface)
            val replacement = replacementFor(method, label, surface, replacementState)
            val outputStart = span.start + outputDelta
            val outputEnd = outputStart + replacement.length
            val appliedSpan = span.copy(
                canonicalLabel = label,
                textHash = textHash,
                action = method,
                replacement = replacement,
            )

            actions += DeidentifyAction(
                span = appliedSpan,
                method = method,
                replacement = replacement,
                outputStart = outputStart,
                outputEnd = outputEnd,
            )
            outputDelta += replacement.length - (span.end - span.start)
        }

        val redacted = StringBuilder(text)
        for (action in actions.asReversed()) {
            redacted.replace(action.span.start, action.span.end, action.replacement)
        }

        return DeidentifyResult(redacted.toString(), actions)
    }

    private fun validateBounds(text: String, spans: List<OpenMedSpan>) {
        for (span in spans) {
            require(span.end <= text.length) {
                "span end ${span.end} exceeds text length ${text.length}"
            }
            require(span.end > span.start) {
                "span must cover at least one character"
            }
        }
    }

    private fun resolveOverlaps(spans: List<OpenMedSpan>): List<OpenMedSpan> {
        val sorted = spans.sortedWith(
            compareBy<OpenMedSpan> { it.start }
                .thenByDescending { it.end }
                .thenByDescending { it.score ?: -1.0 }
                .thenBy { normalizeLabel(it.canonicalLabel) },
        )
        val resolved = mutableListOf<OpenMedSpan>()
        var current = sorted.first()
        var selected = current

        for (next in sorted.drop(1)) {
            if (next.start < current.end) {
                selected = chooseOverlapLabel(selected, next)
                current = selected.copy(
                    start = min(current.start, next.start),
                    end = max(current.end, next.end),
                    textHash = null,
                    action = null,
                    replacement = null,
                )
            } else {
                resolved += current
                current = next
                selected = next
            }
        }

        resolved += current
        return resolved
    }

    private fun chooseOverlapLabel(left: OpenMedSpan, right: OpenMedSpan): OpenMedSpan {
        val leftScore = left.score ?: -1.0
        val rightScore = right.score ?: -1.0
        if (rightScore != leftScore) {
            return if (rightScore > leftScore) right else left
        }

        val leftLength = left.end - left.start
        val rightLength = right.end - right.start
        if (rightLength != leftLength) {
            return if (rightLength > leftLength) right else left
        }

        return if (right.start < left.start) right else left
    }

    private fun replacementFor(
        method: DeidentifyMethod,
        label: String,
        surface: String,
        state: ReplacementState,
    ): String {
        return when (method) {
            DeidentifyMethod.MASK -> state.tokenFor(
                method = method,
                label = label,
                surface = surface,
            ) { tokenLabel, index -> bracketedToken(tokenLabel, index) }

            DeidentifyMethod.REMOVE -> ""
            DeidentifyMethod.REPLACE -> state.tokenFor(
                method = method,
                label = label,
                surface = surface,
            ) { tokenLabel, index -> surrogateToken(tokenLabel, index) }

            DeidentifyMethod.HASH -> hmacDigest(label, surface)
        }
    }

    private fun bracketedToken(label: String, index: Int): String {
        return if (index == 1) "[$label]" else "[${label}_$index]"
    }

    private fun surrogateToken(label: String, index: Int): String {
        return if (index == 1) {
            "${label}_SURROGATE"
        } else {
            "${label}_SURROGATE_$index"
        }
    }

    private fun hmacDigest(label: String, surface: String): String {
        val mac = Mac.getInstance(HMAC_SHA256)
        mac.init(SecretKeySpec(hashKey, HMAC_SHA256))
        val payload = "$label\u0000$surface".toByteArray(StandardCharsets.UTF_8)
        return "hmac-sha256:${mac.doFinal(payload).toHex()}"
    }

    private data class ReplacementKey(
        val method: DeidentifyMethod,
        val label: String,
        val surface: String,
    )

    private class ReplacementState {
        private val counters = mutableMapOf<String, Int>()
        private val tokens = mutableMapOf<ReplacementKey, String>()

        fun tokenFor(
            method: DeidentifyMethod,
            label: String,
            surface: String,
            format: (String, Int) -> String,
        ): String {
            val key = ReplacementKey(method, label, surface)
            return tokens.getOrPut(key) {
                val nextIndex = (counters[label] ?: 0) + 1
                counters[label] = nextIndex
                format(label, nextIndex)
            }
        }
    }

    private fun ByteArray.toHex(): String {
        val chars = CharArray(size * 2)
        forEachIndexed { index, byte ->
            val value = byte.toInt() and 0xff
            chars[index * 2] = HEX_CHARS[value ushr 4]
            chars[index * 2 + 1] = HEX_CHARS[value and 0x0f]
        }
        return String(chars)
    }

    companion object {
        private const val DEFAULT_HASH_SALT = "openmed-android-deidentify-v1"
        private const val HMAC_SHA256 = "HmacSHA256"
        private val HEX_CHARS = "0123456789abcdef".toCharArray()

        fun normalizeLabel(label: String): String {
            val normalized = label.trim()
                .uppercase(Locale.US)
                .replace(Regex("[^A-Z0-9]+"), "_")
                .trim('_')
            return normalized.ifEmpty { "PII" }
        }
    }
}

```

### Core Architecture Module: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/intake/PdfPageRenderer.kt`
```
package com.openmed.openmedkit.intake

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import kotlin.math.roundToInt

/**
 * A rendered PDF page ready for OCR.
 */
data class RenderedPdfPage(
    val page: Int,
    val bitmap: Bitmap,
)

/**
 * Source of rendered PDF page bitmaps.
 */
fun interface PdfPageSource {
    suspend fun renderEach(
        context: Context,
        uri: Uri,
        block: suspend (RenderedPdfPage) -> Unit,
    )
}

/**
 * Renders PDF pages on-device with [PdfRenderer].
 */
class PdfPageRenderer(
    private val scale: Float = 2.0f,
) : PdfPageSource {
    init {
        require(scale > 0.0f) { "scale must be positive" }
    }

    override suspend fun renderEach(
        context: Context,
        uri: Uri,
        block: suspend (RenderedPdfPage) -> Unit,
    ) {
        val descriptor = requireNotNull(context.contentResolver.openFileDescriptor(uri, "r")) {
            "Unable to open PDF document"
        }
        descriptor.use { fileDescriptor ->
            val renderer = PdfRenderer(fileDescriptor)
            try {
                for (pageIndex in 0 until renderer.pageCount) {
                    val page = renderer.openPage(pageIndex)
                    try {
                        val bitmap = Bitmap.createBitmap(
                            (page.width * scale).roundToInt().coerceAtLeast(1),
                            (page.height * scale).roundToInt().coerceAtLeast(1),
                            Bitmap.Config.ARGB_8888,
                        )
                        bitmap.eraseColor(Color.WHITE)
                        page.render(
                            bitmap,
                            null,
                            null,
                            PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY,
                        )
                        try {
                            block(RenderedPdfPage(page = pageIndex, bitmap = bitmap))
                        } finally {
                            bitmap.recycle()
                        }
                    } finally {
                        page.close()
                    }
                }
            } finally {
                renderer.close()
            }
        }
    }
}

```

### Core Architecture Module: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/util/SafeLog.kt`
```
package com.openmed.openmedkit.util

import com.openmed.openmedkit.EntityPrediction
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicReference

/** Inference operations that may emit PHI-safe diagnostic metadata. */
internal enum class SafeLogOperation {
    ANALYZE_TEXT,
    EXTRACT_PII,
    EXTRACT_PII_CHUNKED,
    DEIDENTIFY,
}

/**
 * A diagnostic span containing provenance only, never the detected surface text.
 */
internal data class SafeLogSpan(
    val label: String,
    val start: Int,
    val end: Int,
    val textSha256: String,
) {
    init {
        require(label.matches(SAFE_LABEL_PATTERN)) { "label is not PHI-safe metadata" }
        require(start >= 0) { "start must be non-negative" }
        require(end >= start) { "end must not precede start" }
        require(textSha256.matches(SHA256_PATTERN)) { "textSha256 must be lowercase SHA-256" }
    }

    private companion object {
        val SAFE_LABEL_PATTERN = Regex("[A-Za-z0-9_.:-]{1,128}")
        val SHA256_PATTERN = Regex("[0-9a-f]{64}")
    }
}

/** A complete PHI-free diagnostic event. */
internal data class SafeLogEvent(
    val operation: SafeLogOperation,
    val spans: List<SafeLogSpan>,
)

/** Sink seam kept internal so telemetry remains disabled by default. */
internal fun interface SafeLogSink {
    fun write(event: SafeLogEvent)
}

/**
 * The only OpenMedKit inference logging boundary.
 *
 * [record] accepts typed PHI-free records rather than arbitrary messages or raw
 * span text. The default sink is `null`, so the library emits no logs or
 * telemetry unless an internal host integration explicitly installs a sink.
 */
internal object SafeLog {
    private val sink = AtomicReference<SafeLogSink?>(null)

    fun record(
        operation: SafeLogOperation,
        spans: List<SafeLogSpan>,
    ) {
        val activeSink = sink.get() ?: return
        activeSink.write(SafeLogEvent(operation, spans.toList()))
    }

    /** Replace the sink for an isolated test and return the previous value. */
    fun installSinkForTesting(replacement: SafeLogSink?): SafeLogSink? =
        sink.getAndSet(replacement)
}

/** Convert an entity to label/offset/hash evidence before it reaches [SafeLog]. */
internal fun EntityPrediction.toSafeLogSpan(): SafeLogSpan = SafeLogSpan(
    label = phiSafeLabel(label),
    start = start,
    end = end,
    textSha256 = sha256Hex(text),
)

internal fun phiSafeLabel(label: String): String {
    val candidate = label.trim()
    return if (candidate.matches(Regex("[A-Za-z0-9_.:-]{1,128}"))) {
        candidate
    } else {
        "label_${sha256Hex(candidate).take(16)}"
    }
}

internal fun sha256Hex(value: String): String =
    MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(StandardCharsets.UTF_8))
        .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }

```

### Core Architecture Module: `js/openmedkit-electron/src/utility-process.ts`
```
import childProcess from "node:child_process";
import dgram from "node:dgram";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import http from "node:http";
import http2 from "node:http2";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

import {
  deidentify,
  loadTokenClassificationPipeline,
  type TokenClassificationPipeline,
} from "openmed";

import {
  assertRendererSpans,
  toRendererOpenMedSpan,
  type UtilityDeidentifyRequest,
  type UtilityDeidentifyResponse,
} from "./ipc";
import { inferenceFailure, isUtilityDeidentifyMessage } from "./main-service";

export interface UtilityMessageEvent {
  data: unknown;
}

export interface UtilityParentPortLike {
  on(event: "message", listener: (event: UtilityMessageEvent) => void): this;
  postMessage(message: unknown): void;
}

export interface UtilityHandlerOptions {
  loadPipeline?: (modelPath: string) => Promise<TokenClassificationPipeline>;
}

export function createUtilityDeidentifyHandler(
  options: UtilityHandlerOptions = {},
): (message: unknown) => Promise<UtilityDeidentifyResponse> {
  const modelCache = new Map<string, Promise<TokenClassificationPipeline>>();
  let inferenceQueue: Promise<void> = Promise.resolve();
  const loadPipeline =
    options.loadPipeline ??
    ((modelPath: string) =>
      loadTokenClassificationPipeline(modelPath, {
        allowRemoteModels: false,
        localFilesOnly: true,
      }));

  const run = async (
    message: UtilityDeidentifyRequest,
  ): Promise<UtilityDeidentifyResponse> => {
    try {
      let pipeline = modelCache.get(message.modelPath);
      if (!pipeline) {
        pipeline = loadPipeline(message.modelPath);
        modelCache.set(message.modelPath, pipeline);
      }
      const result = await deidentify(message.text, {
        pipeline: await pipeline,
        docId: "electron-document",
        detector: "electron-utility-process",
      });
      const spans = result.spans.map(toRendererOpenMedSpan);
      assertRendererSpans(spans, message.text.length);
      return {
        type: "deidentify-result",
        requestId: message.requestId,
        ok: true,
        spans,
      };
    } catch {
      modelCache.delete(message.modelPath);
      return inferenceFailure(message.requestId, "INFERENCE_FAILED");
    }
  };

  return async (message: unknown): Promise<UtilityDeidentifyResponse> => {
    if (!isUtilityDeidentifyMessage(message)) {
      return inferenceFailure(requestIdFrom(message), "INVALID_REQUEST");
    }
    const response = inferenceQueue.then(() => run(message));
    inferenceQueue = response.then(
      () => undefined,
      () => undefined,
    );
    return response;
  };
}

export function installOfflineNetworkGuard(): () => void {
  const restorers: Array<() => void> = [];
  const blocked = (): never => {
    throw new Error("Network access is disabled in the OpenMed utility process.");
  };

  blockMethods(globalThis, ["fetch", "WebSocket", "EventSource"], blocked, restorers);
  blockMethods(http, ["request", "get"], blocked, restorers);
  blockMethods(https, ["request", "get"], blocked, restorers);
  blockMethods(http2, ["connect"], blocked, restorers);
  blockMethods(net, ["connect", "createConnection"], blocked, restorers);
  blockMethods(tls, ["connect"], blocked, restorers);
  blockMethods(dgram, ["createSocket"], blocked, restorers);
  blockMethods(
    dns,
    [
      "lookup",
      "lookupService",
      "resolve",
      "resolve4",
      "resolve6",
      "resolveAny",
      "resolveCaa",
      "resolveCname",
      "resolveMx",
      "resolveNaptr",
      "resolveNs",
      "resolvePtr",
      "resolveSoa",
      "resolveSrv",
      "resolveTxt",
      "reverse",
    ],
    blocked,
    restorers,
  );
  blockMethods(
    dnsPromises,
    [
      "lookup",
      "lookupService",
      "resolve",
      "resolve4",
      "resolve6",
      "resolveAny",
      "resolveCaa",
      "resolveCname",
      "resolveMx",
      "resolveNaptr",
      "resolveNs",
      "resolvePtr",
      "resolveSoa",
      "resolveSrv",
      "resolveTxt",
      "reverse",
    ],
    blocked,
    restorers,
  );
  blockMethods(
    childProcess,
    ["exec", "execFile", "execFileSync", "execSync", "fork", "spawn", "spawnSync"],
    blocked,
    restorers,
  );

  return () => {
    for (const restore of restorers.reverse()) {
      restore();
    }
  };
}

export function startUtilityProcess(parentPort: UtilityParentPortLike): void {
  installOfflineNetworkGuard();
  const handleMessage = createUtilityDeidentifyHandler();
  parentPort.on("message", (event) => {
    void handleMessage(event.data).then((response) => {
      try {
        parentPort.postMessage(response);
      } catch {
        // The main process timeout owns recovery; never serialize process errors.
      }
    });
  });
}

function blockMethods(
  target: object,
  methodNames: readonly string[],
  blocked: () => never,
  restorers: Array<() => void>,
): void {
  const mutableTarget = target as Record<string, unknown>;
  for (const methodName of methodNames) {
    const original = mutableTarget[methodName];
    if (typeof original !== "function") {
      continue;
    }
    mutableTarget[methodName] = blocked;
    restorers.push(() => {
      mutableTarget[methodName] = original;
    });
  }
}

function requestIdFrom(message: unknown): string {
  if (typeof message === "object" && message !== null) {
    const requestId = (message as Record<string, unknown>).requestId;
    if (
      typeof requestId === "string" &&
      requestId.length > 0 &&
      requestId.length <= 80 &&
      /^[A-Za-z0-9_-]+$/.test(requestId)
    ) {
      return requestId;
    }
  }
  return "invalid-request";
}

const electronProcess = process as NodeJS.Process & {
  parentPort?: UtilityParentPortLike | null;
};
if (electronProcess.parentPort) {
  startUtilityProcess(electronProcess.parentPort);
}

```

### Core Architecture Module: `openmed/clinical/coref/__init__.py`
```
"""Clinical mention coreference and document-level entity linking."""

from .clustering import (
    COMPATIBILITY_SCORER_VERSION,
    COMPATIBILITY_WEIGHTS,
    COREFERENCE_ADVISORY,
    DEFAULT_LINK_THRESHOLD,
    ClusteringMetric,
    CoreferenceResult,
    EntityCluster,
    PairCompatibility,
    ResolvedCoreferenceCluster,
    ResolvedCoreferenceResult,
    bcubed_precision_recall_f1,
    link_mentions,
    resolve_coreference,
    score_mention_pair,
)
from .mentions import (
    DEFAULT_ABBREVIATION_EXPANSIONS,
    DEFAULT_CANONICAL_ALIASES,
    DEFAULT_DOCUMENT_ID,
    EVENT_COREFERENCE_SEMANTIC_TYPES,
    CanonicalMention,
    SpanOffset,
    canonicalize_mentions,
    canonicalize_text,
    event_coreference_mentions,
)

__all__ = [
    "COREFERENCE_ADVISORY",
    "COMPATIBILITY_SCORER_VERSION",
    "COMPATIBILITY_WEIGHTS",
    "DEFAULT_ABBREVIATION_EXPANSIONS",
    "DEFAULT_CANONICAL_ALIASES",
    "DEFAULT_DOCUMENT_ID",
    "DEFAULT_LINK_THRESHOLD",
    "EVENT_COREFERENCE_SEMANTIC_TYPES",
    "CanonicalMention",
    "ClusteringMetric",
    "CoreferenceResult",
    "EntityCluster",
    "PairCompatibility",
    "ResolvedCoreferenceCluster",
    "ResolvedCoreferenceResult",
    "SpanOffset",
    "bcubed_precision_recall_f1",
    "canonicalize_mentions",
    "canonicalize_text",
    "event_coreference_mentions",
    "link_mentions",
    "resolve_coreference",
    "score_mention_pair",
]

```

### Core Architecture Module: `openmed/clinical/coref/clustering.py`
```
"""Deterministic clinical mention coreference and entity linking."""

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

from openmed.clinical.context import FAMILY_EXPERIENCER, PATIENT_EXPERIENCER

from .mentions import (
    DEFAULT_DOCUMENT_ID,
    CanonicalMention,
    SpanOffset,
    canonicalize_mentions,
    event_coreference_mentions,
)

COREFERENCE_ADVISORY = (
    "Clinical mention coreference and entity linking are deterministic "
    "assistive grouping aids for review and downstream organization, not a "
    "clinical decision."
)

COMPATIBILITY_SCORER_VERSION = "clinical-coref-compat-v1"

# Versioned feature weights for COMPATIBILITY_SCORER_VERSION. The features are
# intentionally transparent: lexical canonicalization carries most of the
# signal, semantic type and code agreement add conservative support, clinical
# context prevents unsafe merges, and distance is only a weak tie-breaker.
COMPATIBILITY_WEIGHTS: dict[str, float] = {
    "string_similarity": 0.42,
    "semantic_type": 0.18,
    "section_temporality": 0.14,
    "distance": 0.10,
    "code": 0.16,
}

DEFAULT_LINK_THRESHOLD = 0.72


@dataclass(frozen=True)
class PairCompatibility:
    """Feature-based mention-pair compatibility score and constraints."""

    score: float
    features: Mapping[str, float]
    version: str
    must_link: bool = False
    cannot_link: bool = False
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class EntityCluster:
    """A deterministic per-document entity cluster with provenance offsets."""

    entity_id: str
    document_id: str
    representative: str
    canonical_text: str
    semantic_type: str | None
    members: tuple[CanonicalMention, ...]
    member_offsets: tuple[SpanOffset, ...]
    advisory: str = COREFERENCE_ADVISORY


@dataclass(frozen=True)
class ResolvedCoreferenceCluster:
    """Privacy-safe cluster record for public event-coreference output."""

    cluster_id: str
    document_id: str
    semantic_type: str | None
    member_offsets: tuple[SpanOffset, ...]
    member_hashes: tuple[str, ...]
    canonical_hash: str
    mention_count: int
    advisory: str = COREFERENCE_ADVISORY

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-compatible cluster without raw mention text."""

        return {
            "cluster_id": self.cluster_id,
            "document_id": self.document_id,
            "semantic_type": self.semantic_type,
            "member_offsets": [list(offset) for offset in self.member_offsets],
            "member_hashes": list(self.member_hashes),
            "canonical_hash": self.canonical_hash,
            "mention_count": self.mention_count,
            "advisory": self.advisory,
        }


@dataclass(frozen=True)
class ResolvedCoreferenceResult:
    """Privacy-safe event clusters returned by ``resolve_coreference``."""

    clusters: tuple[ResolvedCoreferenceCluster, ...]
    advisory: str = COREFERENCE_ADVISORY
    scorer_version: str = COMPATIBILITY_SCORER_VERSION

    def cluster_ids_by_offset(self) -> dict[tuple[str, SpanOffset], str]:
        """Return one canonical cluster id for every event mention offset."""

        return {
            (cluster.document_id, offset): cluster.cluster_id
            for cluster in self.clusters
            for offset in cluster.member_offsets
        }

    def entity_ids_by_offset(self) -> dict[tuple[str, SpanOffset], str]:
        """Return the event cluster index under its compatibility name."""

        return self.cluster_ids_by_offset()

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-compatible result without raw mention text."""

        return {
            "advisory": self.advisory,
            "scorer_version": self.scorer_version,
            "clusters": [cluster.to_dict() for cluster in self.clusters],
        }


@dataclass(frozen=True)
class CoreferenceResult:
    """Document-level coreference output returned by ``link_mentions``."""

    clusters: tuple[EntityCluster, ...]
    advisory: str = COREFERENCE_ADVISORY
    scorer_version: str = COMPATIBILITY_SCORER_VERSION

    def entity_ids_by_offset(self) -> dict[tuple[str, SpanOffset], str]:
        """Return ``(document_id, offset) -> entity_id`` for all members."""

        return {
            (cluster.document_id, member.offset): cluster.entity_id
            for cluster in self.clusters
            for member in cluster.members
        }


@dataclass(frozen=True)
class ClusteringMetric:
    """Precision/recall/F1 metric result for clustering evaluations."""

    precision: float
    recall: float
    f1: float


def link_mentions(
    mentions: Iterable[Any],
    *,
    document_text: str | None = None,
    abbreviation_expansions: Mapping[str, str] | None = None,
    canonical_aliases: Mapping[str, str] | None = None,
    threshold: float = DEFAULT_LINK_THRESHOLD,
) -> CoreferenceResult:
    """Link clinical mentions into deterministic per-document entity clusters.

    Args:
        mentions: Candidate mention mappings or objects with text and offsets.
        document_text: Optional source text used by canonicalization when
            mentions need to be located or validated.
        abbreviation_expansions: Optional expansion hook for local clinical
            abbreviations.
        canonical_aliases: Optional alias hook for local surface-form variants.
        threshold: Minimum pair compatibility score for an agglomerative link.

    Returns:
        A ``CoreferenceResult`` containing stable entity ids, cluster members,
        member offsets, representative mentions, and the advisory disclaimer.
    """

    canonical_mentions = canonicalize_mentions(
        mentions,
        document_text=document_text,
        abbreviation_expansions=abbreviation_expansions,
        canonical_aliases=canonical_aliases,
    )
    if not canonical_mentions:
        return CoreferenceResult(clusters=())
    if not 0 <= threshold <= 1:
        raise ValueError("coreference threshold must be between 0 and 1")

    parents = list(range(len(canonical_mentions)))
    pair_scores = _pair_scores(canonical_mentions)
    candidates = [
        (left, right, compatibility)
        for (left, right), compatibility in pair_scores.items()
        if compatibility.must_link or compatibility.score >= threshold
    ]
    candidates.sort(
        key=lambda item: (
            not item[2].must_link,
            -item[2].score,
            canonical_mentions[item[0]].stable_key,
            canonical_mentions[item[1]].stable_key,
        )
    )

    for left, right, compatibility in candidates:
        if compatibility.cannot_link:
            continue
        left_root = _find(parents, left)
        right_root = _find(parents, right)
        if left_root == right_root:
            continue
        if _would_violate_cannot_link(
            parents,
            left_root,
            right_root,
            pair_scores,
            len(canonical_mentions),
        ):
            continue
        _union(parents, left_root, right_root, canonical_mentions)

    clusters = _build_clusters(canonical_mentions, parents)
    return CoreferenceResult(clusters=clusters)


def resolve_coreference(
    mentions: Iterable[Any] | None = None,
    *,
    document_text: str | None = None,
    document_id: str = DEFAULT_DOCUMENT_ID,
    include_anaphora: bool = True,
    abbreviation_expansions: Mapping[str, str] | None = None,
    canonical_aliases: Mapping[str, str] | None = None,
    threshold: float = DEFAULT_LINK_THRESHOLD,
    hash_secret: str | bytes | None = None,
) -> ResolvedCoreferenceResult:
    """Resolve clinical event mentions into privacy-safe document clusters.

    With ``document_text``, typed PROBLEM-, TEST-, and TREATMENT-like seed
    spans are augmented with definite-NP and pronoun candidates before
    clustering. Public clusters retain ids, offsets, hashes, safe type metadata,
    and counts; they never retain raw or canonical mention text.

    Args:
        mentions: Typed seed spans or candidate mappings.
        document_text: Optional source text used to validate spans and detect
            anaphoric candidates.
        document_id: Fallback document id for seeds without one.
        include_anaphora: Whether to detect definite-NP and pronoun candidates.
        abbreviation_expansions: Optional clinical abbreviation overrides.
        canonical_aliases: Optional local canonical-surface aliases.
        threshold: Minimum pair compatibility score for a cluster link.
        hash_secret: Optional HMAC key for returned content hashes. Without a
            key, deterministic SHA-256 fingerprints are returned.

    Returns:
        Sanitized document clusters with no raw mention text.
    """

    if not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string")
    if hash_secret is not None and not isinstance(hash_secret, (str, bytes)):
        raise TypeError("hash_secret must be a string or bytes when provided")
    source_mentions: Iterable[Any]
    validation_text: str | None
    if document_text is not None:
        source_mentions = event_coreference_mentions(
            document_text,
            tuple(mentions or ()),
            document_id=document_id,
            include_anaphora=include_anaphora,
        )
        validation_text = document_text
    else:
        source_mentions = tuple(mentions or ())
        validation_text = None

    linked = link_mentions(
        source_mentions,
        document_text=validation_text,
        abbreviation_expansions=abbreviation_expansions,
        canonical_aliases=canonical_aliases,
        threshold=threshold,
    )
    return ResolvedCoreferenceResult(
        clusters=tuple(
            _sanitize_cluster(cluster, hash_secret=hash_secret)
            for
```

### Core Architecture Module: `openmed/clinical/coref/mentions.py`
```
"""Canonical clinical mention normalization for document-level coreference."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any, cast

from openmed.clinical.context import (
    AFFIRMED,
    CERTAIN,
    FAMILY_EXPERIENCER,
    NEGATION_VALUES,
    PATIENT_EXPERIENCER,
    RECENT,
    TEMPORALITY_VALUES,
    ClinicalAssertion,
    Negation,
    apply_section_context,
    canonical_section_name,
    resolve_negation,
    resolve_temporality,
)
from openmed.clinical.sections import UNSECTIONED_SECTION, detect_sections

SpanOffset = tuple[int, int]

DEFAULT_DOCUMENT_ID = "document"

DEFAULT_ABBREVIATION_EXPANSIONS: dict[str, str] = {
    "af": "atrial fibrillation",
    "afib": "atrial fibrillation",
    "cad": "coronary artery disease",
    "chf": "congestive heart failure",
    "ckd": "chronic kidney disease",
    "copd": "chronic obstructive pulmonary disease",
    "dm": "diabetes mellitus",
    "gerd": "gastroesophageal reflux disease",
    "hld": "hyperlipidemia",
    "htn": "hypertension",
    "mi": "myocardial infarction",
    "t2dm": "diabetes mellitus",
    "uti": "urinary tract infection",
}

DEFAULT_CANONICAL_ALIASES: dict[str, str] = {
    "blood glucose": "diabetes mellitus",
    "blood sugar": "diabetes mellitus",
    "blood sugars": "diabetes mellitus",
    "diabetes": "diabetes mellitus",
    "elevated blood glucose": "diabetes mellitus",
    "elevated blood sugar": "diabetes mellitus",
    "elevated sugar": "diabetes mellitus",
    "elevated sugars": "diabetes mellitus",
    "heart attack": "myocardial infarction",
    "high blood pressure": "hypertension",
    "kidney disease": "chronic kidney disease",
    "sugar": "diabetes mellitus",
    "sugars": "diabetes mellitus",
}

_TEXT_KEYS = (
    "text",
    "surface",
    "mention",
    "label",
    "name",
    "term",
    "literal",
    "value",
)
_DOCUMENT_ID_KEYS = ("document_id", "doc_id", "source_doc_id")
_START_KEYS = ("start", "start_char", "start_offset", "begin", "offset_start")
_END_KEYS = ("end", "end_char", "end_offset", "stop", "offset_end")
_OCCURRENCE_KEYS = ("occurrence", "text_occurrence", "occurrence_index")
_SEMANTIC_TYPE_KEYS = (
    "semantic_type",
    "entity_type",
    "label",
    "role",
    "type",
    "category",
    "canonical_label",
)
_EVENT_TEXT_KEYS = ("text", "surface", "mention", "name", "term", "literal", "value")
_SECTION_KEYS = ("section", "section_label", "section_name")
_SYSTEM_KEYS = ("system", "coding_system", "code_system")
_CODE_KEYS = ("code", "concept_code", "coding_code")
_COREF_ENTITY_KEYS = ("coref_entity_id", "entity_id", "cluster_id")
_CANONICAL_TEXT_KEYS = (
    "canonical_text",
    "canonical_mention",
    "referent_text",
    "antecedent_text",
)
_TEXT_HASH_KEYS = ("text_hash", "mention_hash", "surface_hash")
_NEGATION_KEYS = ("negation", "polarity")
_TEMPORALITY_KEYS = ("temporality", "temporal_status")
_EXPERIENCER_KEYS = ("experiencer",)
_WHITESPACE_RE = re.compile(r"\s+")
_SAFE_TEXT_HASH_RE = re.compile(r"^(?:hmac-)?sha256:[0-9a-f]{64}$")
_PUNCTUATION_RE = re.compile(r"[^a-z0-9/+]+")
_POSSESSIVE_RE = re.compile(r"\b([a-z]+)'s\b")
_LEADING_CONTEXT_RE = re.compile(
    r"^(?:"
    r"past medical history of|family history of|history of|hx of|h/o|"
    r"status post|s/p|patient has|patient with|the patient has|"
    r"the patient with|mother with|father with|mother had|father had"
    r")\s+"
)
_STOPWORDS = {
    "a",
    "an",
    "and",
    "her",
    "his",
    "of",
    "patient",
    "patients",
    "the",
    "their",
    "with",
}
_SINGULAR_EXCEPTIONS = {
    "asbestosis",
    "diabetes",
    "fibrosis",
    "hyperlipidemia",
    "necrosis",
    "sepsis",
    "status",
}
EVENT_COREFERENCE_SEMANTIC_TYPES = frozenset(
    {
        "analyte",
        "condition",
        "diagnosis",
        "disease",
        "drug",
        "finding",
        "lab",
        "laboratory",
        "lab_test",
        "medication",
        "medication_name",
        "medicine",
        "problem",
        "procedure",
        "test",
        "treatment",
    }
)
_EVENT_SEMANTIC_ALIASES = {
    "analyte": "test",
    "condition": "problem",
    "diagnosis": "problem",
    "disease": "problem",
    "drug": "treatment",
    "finding": "problem",
    "lab": "test",
    "laboratory": "test",
    "lab_test": "test",
    "medication": "treatment",
    "medication_name": "treatment",
    "medicine": "treatment",
    "problem": "problem",
    "procedure": "treatment",
    "test": "test",
    "treatment": "treatment",
}
_DEFINITE_EVENT_NP_RE = re.compile(
    r"\b(?:the|this|that|these|those)\s+"
    r"(?P<head>"
    r"antibiotics?|conditions?|coughs?|diseases?|drugs?|findings?|"
    r"infections?|labs?|lesions?|masses|medications?|medicines?|"
    r"nodules?|pneumonia|problems?|results?|studies|study|tests?|"
    r"treatments?|tumou?rs?"
    r")\b",
    re.IGNORECASE,
)
_PRONOUN_RE = re.compile(r"\b(?:it|this|that|they|them|these|those)\b", re.IGNORECASE)
_TIME_ANAPHORA_FOLLOWERS = {
    "afternoon",
    "am",
    "evening",
    "morning",
    "night",
    "pm",
    "week",
}
_ANAPHORA_WINDOW_CHARS = 700


@dataclass(frozen=True)
class CanonicalMention:
    """Clinical mention normalized for deterministic document coreference.

    ``text``, ``start``, and ``end`` preserve the original surface form and
    document offsets. ``canonical_text`` is the comparison key after
    abbreviation expansion, alias hooks, and conservative morphological
    normalization.
    """

    document_id: str
    source_index: int
    text: str
    start: int
    end: int
    normalized_text: str
    canonical_text: str
    semantic_type: str | None = None
    section: str | None = None
    canonical_section: str | None = None
    negation: Negation = AFFIRMED
    temporality: str = RECENT
    experiencer: str = PATIENT_EXPERIENCER
    system: str | None = None
    code: str | None = None
    coref_entity_id: str | None = None
    text_hash: str | None = None

    @property
    def offset(self) -> SpanOffset:
        """Return the preserved source span offsets."""

        return self.start, self.end

    @property
    def stable_key(self) -> tuple[str, int, int, str, str]:
        """Return a deterministic key independent of input iteration order."""

        return (
            self.document_id,
            self.start,
            self.end,
            self.canonical_text,
            self.text.casefold(),
        )


def canonicalize_mentions(
    mentions: Iterable[Any],
    *,
    document_text: str | None = None,
    abbreviation_expansions: Mapping[str, str] | None = None,
    canonical_aliases: Mapping[str, str] | None = None,
) -> tuple[CanonicalMention, ...]:
    """Canonicalize candidate mentions while preserving provenance offsets.

    Args:
        mentions: Candidate mention mappings or objects. Each mention must
            expose a text-like field plus ``start``/``end`` offsets, an
            ``offset`` pair, or enough information to be located in
            ``document_text``.
        document_text: Optional source text used to locate mentions without
            explicit offsets and to validate provided offsets.
        abbreviation_expansions: Optional hook for project- or caller-specific
            abbreviation expansion. Values override the default clinical
            abbreviations for matching keys.
        canonical_aliases: Optional hook for surface-form aliases that should
            normalize to one canonical clinical concept.

    Returns:
        Canonical mentions sorted by document id and source offsets. Sorting
        makes downstream clustering deterministic and order-invariant after
        canonicalization.
    """

    expansions = _normalized_mapping(DEFAULT_ABBREVIATION_EXPANSIONS)
    if abbreviation_expansions:
        expansions.update(_normalized_mapping(abbreviation_expansions))

    aliases = _normalized_mapping(DEFAULT_CANONICAL_ALIASES)
    if canonical_aliases:
        aliases.update(_normalized_mapping(canonical_aliases))

    canonicalized = [
        _coerce_mention(
            mention,
            source_index=index,
            document_text=document_text,
            abbreviation_expansions=expansions,
            canonical_aliases=aliases,
        )
        for index, mention in enumerate(mentions)
    ]
    return tuple(sorted(canonicalized, key=lambda mention: mention.stable_key))


def canonicalize_text(
    text: str,
    *,
    abbreviation_expansions: Mapping[str, str] | None = None,
    canonical_aliases: Mapping[str, str] | None = None,
) -> str:
    """Return the canonical comparison key for a mention surface form."""

    if not isinstance(text, str):
        raise TypeError("mention text must be a string")
    normalized = _normalize_surface(text)

    expansions = _normalized_mapping(DEFAULT_ABBREVIATION_EXPANSIONS)
    if abbreviation_expansions:
        expansions.update(_normalized_mapping(abbreviation_expansions))

    aliases = _normalized_mapping(DEFAULT_CANONICAL_ALIASES)
    if canonical_aliases:
        aliases.update(_normalized_mapping(canonical_aliases))

    return _canonicalize_normalized_text(normalized, expansions, aliases)


def event_coreference_mentions(
    document_text: str,
    mentions: Iterable[Any],
    *,
    document_id: str = DEFAULT_DOCUMENT_ID,
    include_anaphora: bool = True,
) -> tuple[Mapping[str, Any], ...]:
    """Detect event-coreference candidates from typed clinical spans.

    Only PROBLEM-, TEST-, and TREATMENT-like seed spans are retained. When
    requested, the detector adds conservative definite noun phrases and simple
    pronouns that have an earlier compatible event antecedent. Raw surfaces are
    kept only in these internal candidate records; public clustering output is
    sanitized by :func:`openmed.clinical.coref.resolve_coreference`.

    Args:
        document_text: Source text for a single synthetic or clini
```

### Core Architecture Module: `openmed/clinical/coreference.py`
```
"""Deterministic span-native clinical coreference resolution.

The resolver preserves its span-native API for already-detected
:class:`~openmed.core.schemas.OpenMedSpan` mentions and also dispatches the
event-candidate API when ``document_text`` is provided. Both modes use only
local lexical and structural features and never log source text.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from openmed.core.labels import (
    CONDITION,
    MEDICATION,
    OTHER,
    PERSON,
)
from openmed.core.schemas import OpenMedSpan

from .context import FAMILY_EXPERIENCER, PATIENT_EXPERIENCER
from .coref import (
    DEFAULT_DOCUMENT_ID,
    DEFAULT_LINK_THRESHOLD,
    ResolvedCoreferenceResult,
    canonicalize_text,
)
from .coref import (
    resolve_coreference as resolve_event_coreference,
)
from .experiencer import resolve_experiencer

SpanChainKey = tuple[str, tuple[int, int]]

COREFERENCE_RESOLUTION_ADVISORY = (
    "Clinical coreference chains are deterministic assistive annotations. "
    "Review them before clinical use."
)

COREFERENCE_FEATURES = (
    "section",
    "sentence_distance",
    "head_noun",
    "entity_type",
)

DEFAULT_COREFERENCE_THRESHOLD = 0.70

_WORD_RE = re.compile(
    r"[^\W_]+(?:['\N{RIGHT SINGLE QUOTATION MARK}-][^\W_]+)?", re.UNICODE
)
_SENTENCE_BOUNDARY_RE = re.compile(r"(?:[.!?]+(?=\s|$)|\n+)")
_SPACE_RE = re.compile(r"\s+")

_PRONOUNS = {
    "he",
    "her",
    "hers",
    "him",
    "his",
    "it",
    "its",
    "she",
    "that",
    "their",
    "theirs",
    "them",
    "these",
    "they",
    "this",
    "those",
}
_PERSON_PRONOUNS = {"he", "her", "hers", "him", "his", "she"}
_NEUTRAL_PRONOUNS = {"it", "its", "that", "this"}
_PATIENT_ANCHORS = {
    "patient",
    "the patient",
    "this patient",
}
_DETERMINERS = {
    "a",
    "an",
    "another",
    "that",
    "the",
    "these",
    "this",
    "those",
}
_POSSESSIVES = {"her", "his", "its", "their"}

_CONDITION_HEADS = {
    "condition",
    "diagnosis",
    "disease",
    "finding",
    "lesion",
    "problem",
    "symptom",
}
_MEDICATION_HEADS = {
    "agent",
    "drug",
    "medication",
    "medicine",
    "prescription",
    "therapy",
}
_PERSON_HEADS = {"individual", "person", "patient"}
_GENERIC_TYPE_HEADS = (_CONDITION_HEADS | _MEDICATION_HEADS | _PERSON_HEADS) - {
    "lesion"
}
_FAMILY_ANCHORS = {
    "aunt",
    "brother",
    "daughter",
    "father",
    "mother",
    "parent",
    "relative",
    "sibling",
    "sister",
    "son",
}

_TYPE_ALIASES = {
    "condition": CONDITION,
    "diagnosis": CONDITION,
    "disease": CONDITION,
    "finding": CONDITION,
    "lesion": CONDITION,
    "problem": CONDITION,
    "symptom": CONDITION,
    "drug": MEDICATION,
    "med": MEDICATION,
    "medication": MEDICATION,
    "medicine": MEDICATION,
    "person": PERSON,
    "patient": PERSON,
}
_UNINFORMATIVE_TYPES = {
    "clinical entity",
    "entity",
    "mention",
    "nominal",
    "pronoun",
    "unknown",
}
_CONDITION_LABELS = {
    CONDITION,
    "CKD_STAGE",
    "CLINICAL_SIGNIFICANCE",
    "DYSPNEA_GRADE",
    "ENDOSCOPIC_FINDING",
    "GI_SYMPTOM",
    "POLYP_DESCRIPTOR",
    "RESPIRATORY_FINDING",
    "URINE_FINDING",
}
_MEDICATION_LABELS = {
    MEDICATION,
    "ANESTHETIC_AGENT",
    "ANTIBIOTIC",
    "INSULIN_REGIMEN",
    "VACCINE_NAME",
}
_PERSON_LABELS = {
    PERSON,
    "FIRST_NAME",
    "LAST_NAME",
    "MIDDLE_NAME",
}


@dataclass(frozen=True)
class CoreferenceChain:
    """One resolved entity chain with source-span provenance.

    ``members`` contains the original immutable spans in document order.
    ``representative`` is the most informative non-anaphoric member when one is
    available. ``confidence`` is the mean confidence of the deterministic links
    that formed the chain; singleton chains have confidence ``1.0``.
    """

    chain_id: str
    members: tuple[OpenMedSpan, ...]
    representative: OpenMedSpan
    confidence: float
    advisory: str = COREFERENCE_RESOLUTION_ADVISORY

    @property
    def member_spans(self) -> tuple[OpenMedSpan, ...]:
        """Return ``members`` under the explicit issue-facing field name."""

        return self.members

    @property
    def representative_mention(self) -> OpenMedSpan:
        """Return the representative source mention."""

        return self.representative


@dataclass(frozen=True)
class _Mention:
    span: OpenMedSpan
    surface: str
    canonical_text: str
    head_noun: str
    form: str
    entity_class: str | None
    section: str | None
    sentence_index: int
    experiencer: str

    @property
    def key(self) -> SpanChainKey:
        return self.span.doc_id, (self.span.start, self.span.end)


def resolve_coreference(
    spans: Iterable[OpenMedSpan] | Iterable[object] | None = None,
    text: str | None = None,
    *,
    threshold: float | None = None,
    document_text: str | None = None,
    document_id: str = DEFAULT_DOCUMENT_ID,
    include_anaphora: bool = True,
    abbreviation_expansions: Mapping[str, str] | None = None,
    canonical_aliases: Mapping[str, str] | None = None,
    hash_secret: str | bytes | None = None,
) -> (
    tuple[tuple[CoreferenceChain, ...], dict[SpanChainKey, str]]
    | ResolvedCoreferenceResult
):
    """Resolve clinical coreference using the span or event-candidate API.

    The established ``resolve_coreference(spans, text)`` form returns span
    chains and an offset index. The event-specific
    ``resolve_coreference(mentions, document_text=...)`` form detects
    PROBLEM/TEST/TREATMENT anaphora and returns sanitized clusters containing
    no raw mention text.

    Args:
        spans: Existing ``OpenMedSpan`` mentions in span mode, or typed event
            seed mentions in event mode.
        text: Positional source text for the established span-native mode.
        threshold: Optional minimum deterministic compatibility score. Each
            mode uses its own stable default when omitted.
        document_text: Keyword-only source text selecting event-candidate mode.
        document_id: Fallback id for event seeds without a document id.
        include_anaphora: Whether event mode detects definite NPs and pronouns.
        abbreviation_expansions: Optional event-mode abbreviation overrides.
        canonical_aliases: Optional event-mode canonical aliases.
        hash_secret: Optional HMAC key for event-mode content hashes.

    Returns:
        Span mode returns ``(chains, span_to_chain)``. Event mode returns a
        :class:`ResolvedCoreferenceResult` containing only privacy-safe cluster
        metadata, source offsets, and hashes.

    Raises:
        TypeError: If source text or a span has the wrong type.
        ValueError: If offsets are invalid, duplicate span keys are supplied,
            spans refer to more than one document, or ``threshold`` is outside
            ``[0, 1]``.
    """

    if document_text is not None:
        if text is not None:
            raise ValueError("pass either text or document_text, not both")
        return resolve_event_coreference(
            spans,
            document_text=document_text,
            document_id=document_id,
            include_anaphora=include_anaphora,
            abbreviation_expansions=abbreviation_expansions,
            canonical_aliases=canonical_aliases,
            threshold=DEFAULT_LINK_THRESHOLD if threshold is None else threshold,
            hash_secret=hash_secret,
        )

    if text is None:
        raise TypeError("text is required for span-native coreference")
    if threshold is None:
        threshold = DEFAULT_COREFERENCE_THRESHOLD

    if not isinstance(text, str):
        raise TypeError("text must be a string")
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("coreference threshold must be between 0 and 1")

    span_list = list(() if spans is None else spans)
    if not span_list:
        return (), {}

    sentence_starts = _sentence_starts(text)
    mentions = tuple(
        sorted(
            (_build_mention(span, text, sentence_starts) for span in span_list),
            key=lambda mention: (
                mention.span.doc_id,
                mention.span.start,
                mention.span.end,
                mention.span.canonical_label,
                mention.span.entity_type,
            ),
        )
    )
    _validate_unique_keys(mentions)
    _validate_single_document(mentions)

    parents = list(range(len(mentions)))
    link_scores: dict[int, float] = {}
    for current_index, current in enumerate(mentions):
        candidate = _best_antecedent(
            mentions,
            parents,
            current_index,
            threshold,
        )
        if candidate is None:
            continue
        antecedent_index, score = candidate
        parents[current_index] = _find(parents, antecedent_index)
        link_scores[current_index] = score

    chains = _build_chains(mentions, parents, link_scores)
    span_to_chain = {
        (span.doc_id, (span.start, span.end)): chain.chain_id
        for chain in chains
        for span in chain.members
    }
    return chains, span_to_chain


def _build_mention(
    span: OpenMedSpan,
    text: str,
    sentence_starts: tuple[int, ...],
) -> _Mention:
    if not isinstance(span, OpenMedSpan):
        raise TypeError("spans must contain OpenMedSpan instances")
    if span.start == span.end:
        raise ValueError("coreference spans must not be empty")
    if span.end > len(text):
        raise ValueError("span offsets must be within text")

    surface = text[span.start : span.end]
    if not surface.strip():
        raise ValueError("coreference spans must contain non-whitespace text")

    words = _words(surface)
    if not words:
        raise ValueError("coreference spans must contain at least one word")
    normalized_surface = " ".join(words)
    form = _mention_form(normalized_surface, words)
 
```

### Core Architecture Module: `openmed/clinical/exporters/fhir/uscore.py`
```
"""Offline US Core STU9 checks for selected OpenMed FHIR R4 exports.

The checker intentionally implements a compact, OpenMed-authored subset of US
Core 9.0.0. It validates the four resource profiles used by OpenMed exports,
runs the bundled base-R4 validator first, and never downloads implementation
guide or terminology content. Findings contain only fixed messages and element
paths so clinical values are not copied into logs or audit artifacts.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from typing import Any

from ._validation_primitives import _extract_codes, _occurrence_groups
from .validate import ValidationFinding, validate_resource

__all__ = ["ConformanceResult", "US_CORE_VERSION", "check_us_core"]

US_CORE_VERSION = "9.0.0"


@dataclass(frozen=True)
class ConformanceResult:
    """Immutable findings from base R4 and US Core profile checks.

    Attributes:
        profile: Resolved US Core canonical URL, when a profile was selected.
        resource_type: FHIR resource type reported by the input, when valid.
        errors: Findings that prevent a conformance claim.
        warnings: Advisory findings, including absent must-support elements.
    """

    profile: str | None
    resource_type: str | None
    errors: tuple[ValidationFinding, ...] = ()
    warnings: tuple[ValidationFinding, ...] = ()

    @property
    def findings(self) -> tuple[ValidationFinding, ...]:
        """Return every finding, with errors before warnings."""

        return self.errors + self.warnings

    @property
    def issues(self) -> tuple[ValidationFinding, ...]:
        """Return findings for the shared OperationOutcome adapter."""

        return self.findings

    @property
    def is_valid(self) -> bool:
        """Return ``True`` when neither validation layer found an error."""

        return not self.errors

    @property
    def valid(self) -> bool:
        """Alias for :attr:`is_valid`."""

        return self.is_valid


def check_us_core(
    resource: Mapping[str, Any],
    profile: str | None = None,
) -> ConformanceResult:
    """Check one resource against base R4 and a bundled US Core profile subset.

    Supported profiles cover Condition problems/health concerns, Condition
    encounter diagnoses, laboratory Observation, MedicationRequest, and
    AllergyIntolerance. A profile can be supplied as its canonical URL, a
    versioned canonical (``url|9.0.0``), or its StructureDefinition id. When it
    is omitted, a supported canonical in ``meta.profile`` takes precedence,
    followed by the resource type's default profile.

    Args:
        resource: FHIR R4 resource mapping. Malformed resources are returned as
            structured findings rather than raising.
        profile: Optional US Core profile canonical URL or id.

    Returns:
        A :class:`ConformanceResult` containing sanitized base and profile
        findings. No network access is performed.
    """

    base_result = validate_resource(resource)
    resource_type = _resource_type(resource)
    selected, selection_finding = _select_profile(resource, resource_type, profile)

    findings = list(base_result.findings)
    if selection_finding is not None:
        findings.append(selection_finding)
    elif selected is not None:
        findings.extend(_check_profile(resource, selected))

    unique = _deduplicate(findings)
    return ConformanceResult(
        profile=selected["url"] if selected is not None else None,
        resource_type=resource_type,
        errors=tuple(item for item in unique if item.severity == "error"),
        warnings=tuple(item for item in unique if item.severity == "warning"),
    )


def _resource_type(resource: Any) -> str | None:
    if not isinstance(resource, Mapping):
        return None
    resource_type = resource.get("resourceType")
    return resource_type if isinstance(resource_type, str) and resource_type else None


def _select_profile(
    resource: Any,
    resource_type: str | None,
    requested: str | None,
) -> tuple[Mapping[str, Any] | None, ValidationFinding | None]:
    if resource_type is None:
        return None, None

    candidate = (
        requested
        or _declared_profile(resource)
        or _definitions()["defaults"].get(resource_type)
    )
    root = resource_type
    if candidate is None:
        return None, _warning(
            f"{root}.resourceType",
            "Resource type has no bundled US Core profile subset.",
            "not-supported",
        )

    canonical, version = _split_version(candidate)
    if version is not None and version != US_CORE_VERSION:
        return None, _error(
            f"{root}.meta.profile",
            "US Core profile version is not supported by the bundled subset.",
            "not-supported",
        )

    selected = _profile_aliases().get(_normalise_canonical(canonical))
    if selected is None:
        return None, _error(
            f"{root}.meta.profile",
            "US Core profile is not supported by the bundled subset.",
            "not-supported",
        )
    if selected["resourceType"] != resource_type:
        return None, _error(
            f"{root}.meta.profile",
            "US Core profile does not match the resource type.",
            "value",
        )
    return selected, None


def _declared_profile(resource: Any) -> str | None:
    if not isinstance(resource, Mapping):
        return None
    meta = resource.get("meta")
    if not isinstance(meta, Mapping):
        return None
    declared = meta.get("profile")
    if not isinstance(declared, Sequence) or isinstance(declared, (str, bytes)):
        return None
    for item in declared:
        if not isinstance(item, str):
            continue
        canonical, _ = _split_version(item)
        if _normalise_canonical(canonical) in _profile_aliases():
            return item
    return None


def _split_version(candidate: str) -> tuple[str, str | None]:
    canonical, separator, version = candidate.strip().partition("|")
    return canonical.rstrip("/"), version if separator else None


def _normalise_canonical(candidate: str) -> str:
    normalised = candidate.strip().rstrip("/")
    for prefix in ("https://hl7.org/", "https://www.hl7.org/", "http://www.hl7.org/"):
        if normalised.startswith(prefix):
            return "http://hl7.org/" + normalised[len(prefix) :]
    return normalised


@lru_cache(maxsize=1)
def _profile_aliases() -> Mapping[str, Mapping[str, Any]]:
    aliases: dict[str, Mapping[str, Any]] = {}
    for profile in _definitions()["profiles"]:
        aliases[_normalise_canonical(profile["url"])] = profile
        aliases[profile["id"]] = profile
        aliases[f"StructureDefinition/{profile['id']}"] = profile
    return aliases


def _check_profile(
    resource: Mapping[str, Any],
    profile: Mapping[str, Any],
) -> list[ValidationFinding]:
    root = profile["resourceType"]
    findings: list[ValidationFinding] = []
    for element in profile["elements"]:
        findings.extend(_check_element(resource, root, element))
    for group in profile.get("mustSupportAnyOf", ()):
        findings.extend(_check_must_support_group(resource, root, group))
    return findings


def _check_element(
    resource: Mapping[str, Any],
    root: str,
    element: Mapping[str, Any],
) -> list[ValidationFinding]:
    path = element["path"]
    groups = _occurrence_groups(resource, path.split("."), root)
    location = f"{root}.{element.get('location', path.replace('[x]', ''))}"
    findings: list[ValidationFinding] = []

    # A nested must-support child is only actionable when its parent exists.
    if not groups:
        return findings

    for group in groups:
        occurrences = tuple(group.occurrences)
        selector = element.get("selector")
        if selector is not None:
            matching = tuple(
                occurrence
                for occurrence in occurrences
                if _matches_selector(occurrence.value, selector)
            )
        else:
            matching = occurrences

        minimum = int(element.get("min", 0))
        maximum_value = element.get("max", "*")
        maximum = None if maximum_value == "*" else int(maximum_value)

        if len(matching) < minimum:
            code = (
                "code-invalid" if occurrences and selector is not None else "required"
            )
            message = (
                "Element does not satisfy the required US Core binding."
                if code == "code-invalid"
                else "Required US Core profile element is missing or empty."
            )
            findings.append(_error(location, message, code))
        if maximum is not None and len(matching) > maximum:
            findings.append(
                _error(
                    location,
                    "Maximum US Core profile element cardinality is exceeded.",
                    "structure",
                )
            )

        binding_name = element.get("binding")
        if binding_name is not None and selector is None:
            binding = _definitions()["bindings"][binding_name]
            for occurrence in occurrences:
                if not _matches_binding(occurrence.value, binding):
                    findings.append(
                        _error(
                            occurrence.expression,
                            "Element does not satisfy the required US Core binding.",
                            "code-invalid",
                        )
                    )

        if (
            element.get("mustSupport")
            and not matching
            and not any(
                item.severity == "error" and item.location == location
                for item in findings
            )
        ):
            findings.append(
                _warning(
                    location,
        
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4373** (2026-10-31): **Require patched ASN.1 decoding in the cloud extra**
  *Symptoms*: ## Description  The v3.2 candidate's vulnerability gate blocks on four HIGH pyasn1 decoder advisories in the optional cloud closure. Require `pyasn1>=0.6.5` in the cloud extra and uv constraints, and update only that package's locked version and artifact hashes. The [upstream release](https://github.com/pyasn1/pyasn1/releases/tag/v0.6.5) fixes CVE-2026-119194 through CVE-2026-119197.  ## Type of Change  - [x] Bug fix - [x] Documentation update  ## Changes Made  - Add the patched minimum to the published cloud extra. - Retain the existing lockfile format and every unrelated package record, platform marker and pin. - Document the change in the v3.2 changelog and release notes. Core dependencies, scanner policy and allowlists are unchanged.  ## Testing  - [x] CI's uv 0.13.6 accepts `uv lock --check --offline` without drift; a frozen cloud install of the final lock succeeds. - [x] Existing scanner/pip-audit policy, cloud storage, dependency report and core-import tests: 110 passed and 20 passing subtests. - [x] Networking-blocked smoke check: cloud imports, ASN.1 DER round trip, synthetic service-account signing and JWT verification pass with pyasn1 0.6.5 / pyasn1-modules 0.4.2 / google-auth 2.55.1. - [x] Canonical formatting, lint, format check, scoped pre-commit and strict complete docs staging pass. - [x] Wheel/sdist build and Twine checks pass; wheel metadata scopes the new floor to `extra == cloud`. - [x] Full final candidate suite after the license follow-ups: 24,224 passed

- **Issue #4372** (2026-10-31): **Update the cloud ASN.1 dependency before v3.2 release**
  *Symptoms*: The final v3.2 candidate vulnerability scan blocks on four HIGH advisories in `pyasn1 0.6.4`, reachable in the optional `cloud` dependency set through `gcsfs -> google-auth -> pyasn1-modules`.  Evidence: [candidate scan](https://github.com/maziyarpanahi/openmed/actions/runs/41225035698/job/124607303226), head `64526054878477acda2141167c822f416c28e038`. Findings: CVE-2026-119194, CVE-2026-119195, CVE-2026-119196 and CVE-2026-119197. The [upstream 0.6.5 release](https://github.com/pyasn1/pyasn1/releases/tag/v0.6.5) addresses all four decoder CPU-exhaustion issues.  For v3.2, require `pyasn1>=0.6.5` in the cloud extra and resolution constraints, update only the affected lock entry, verify a frozen cloud install and offline authentication/ASN.1 imports, then pass the unchanged vulnerability gate. Core dependencies, suppression policy and scanner assertions should remain unchanged. Integrate through a focused PR into `prepare/v3.2.0` / #4369.

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

### Incident Patch 1: `d5236b9c` (2026-10-30)
**Commit Message**: Qualify fixed-option decision backends offline

Closes #4258

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
+- Add offline decision-backend qualification with development-only threshold fitting, held-out evaluation, value-free reports and explicit calibration profile output.
+
 - Generate structured multilingual synthetic dialogue with grapheme-safe spans, Journey fact evidence and explicit adjudication truth (#2846).
 
 - Validate synthetic releases against disclosure, lineage, licenses, withdrawals, benchmark contamination and subgroup utility evidence (#3214).
```

**File**: `docs/api/fixed-option-decisions.md` (modified, +109/-0)
```diff
@@ -395,6 +395,115 @@ It is declared read-only, non-destructive, idempotent, and closed-world. The
 tool registry is generated from the same schema used by Python and REST, and
 cross-surface drift tests compare complete synthetic results.
 
+## Qualify a backend offline
+
+Set abstention thresholds per decision on your own labelled cases before a
+backend is used in a workflow. `openmed decision-qualify` fits thresholds on a
+development file, freezes them, and reports how they hold on a separate
+evaluation file. It makes no network calls and loads nothing that is not
+already installed.
+
+```bash
+openmed decision-qualify \
+  --backend-factory my_site.decisions:build_backend \
+  --development /private/decisions/development.jsonl \
+  --evaluation /private/decisions/evaluation.jsonl \
+  --calibration-id site.triage \
+  --profile-output /private/decisions/profiles.json \
+  --json
+```
+
+Select exactly one backend. `--backend deterministic` uses the
+dependency-free lexical backend. `--backend-factory module:function` imports a
+trusted, already installed function that takes no arguments and returns a
+`DecisionBackend`, such as an `EncoderDecisionBackend` around a local model.
+The factory is called once per run. The command never registers the backend
+or its profiles as a default, and the bundled calibration profile is
+unchanged.
+
+Each line of both files is one labelled case (this one is synthetic):
+
+```json
+{"id": "case-001", "mode": "fixed_choice", "input_text": "Synthetic review priority is clearly urgent.", "options": ["urgent", "routine"], "expected_choices": ["urgent"]}
+```
+
+`mode` is `fixed_choice`, `boolean_choice`, `ordered_preference` or
+`multi_label`. Single-choice modes take exactly one expected choice; for
+`ordered_preference` it is the option expected first. `scalar_score` is not
+supported because the 1.0.0 calibration evaluator scores option choices. `id`
+is optional and opaque. Malformed lines, unknown fields, duplicate IDs and
+requests outside the limits below fail with a controlled error code and no
+input values.
+
+Thresholds are chosen per mode from the development file only:
+
+- each development case is scored once, and the candidates are the observed
+  development confidences, margins and option scores;
+- the command keeps the candidate that covers the most development cases while
+  selective accuracy stays at or above `--accuracy-floor` (default 0.9); ties
+  prefer higher accuracy, then stricter thresholds;
+- `fixed_choice`, `boolean_choice` and `ordered_preference` fit
+  `minimum_confidence` and `minimum_margin`; `multi_label` fits
+  `multi_label_threshold`. Fields that do not apply to a mode are set to 1.0,
+  so a profile reused for another mode abstains;
+- evaluation cases are scored only after the thresholds are fixed and never
+  change them.
+
+For each mode the report gives development and evaluation accuracy on covered
+cases, coverage, abstention rate, expected calibration error (from
+`evaluate_decision_calibration`) and result-state counts. Per option it gives
+development and evaluation support and evaluation recall, keyed by the
+`sha256:` digest of the option after NFKC normalization, case folding and
+whitespace collapsing. Inputs appear only as the SHA-256 digest of each file's
+bytes and a record count. The report holds no input text, option values,
+record IDs or file paths.
+
+`qualified` is true only when both files contain the same modes, no case
+(same mode, normalized text and options) or ID appears in both files, every
+declared option has at least `--min-examples-per-option` evaluation examples
+(default 20), the backend returned no errors, and evaluation accuracy and
+coverage meet `--accuracy-floor` and `--coverage-floor` (default 0.5). Data
+problems give `status: insufficient`; unmet floors or backend errors give
+`not_qualified`. The exit status is 0 only for `qualified`.
+
+Profiles appear in the report's `profiles` field, and in `--profile-output`
+(a new file with mode 0600 that is never overwritten), only when the run
+qualifies. One profile is emitted per mode and named
+`<calibration-id>.<mode>`. Its `in_domain_digest` pins the development file
+and its `out_of_domain_digest` pins the evaluation file. Calibration IDs in
+the `openmed` namespace are reserved for bundled profiles. Pass the profiles
+to `decide` explicitly:
+
+```python
+import json
+
+from openmed.structured import DecisionCalibrationProfile, DecisionRequest, decide
+
+with open("/private/decisions/profiles.json", encoding="utf-8") as handle:
+    profiles = {
+        key: DecisionCalibrationProfile(**value)
+        for key, value in json.load(handle).items()
+    }
+
+result = decide(
+    DecisionRequest(
+        mode="fixed_choice",
+        input_text="Synthetic review priority is clearly urgent.",
+        options=("urgent", "routine"),
+        calibration_id="site.triage.fixed_choice",
+    ),
+    backend=backend,
+    calibration_profiles
```

**File**: `openmed/cli/decision_qualification.py` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+"""Supported offline qualification command for local decision backends."""
+
+import argparse
+import importlib
+import json
+import os
+from pathlib import Path
+
+from ._output import CliError, add_json_flag, emit
+
+
+def add_decision_qualification_command(
+    subparsers: argparse._SubParsersAction,
+) -> None:
+    """Register the local decision-backend qualification command."""
+    parser = subparsers.add_parser(
+        "decision-qualify",
+        help="Qualify a local fixed-option decision backend on caller data.",
+    )
+    source = parser.add_mutually_exclusive_group(required=True)
+    source.add_argument(
+        "--backend",
+        choices=("deterministic",),
+        help="Built-in dependency-free lexical backend.",
+    )
+    source.add_argument(
+        "--backend-factory",
+        help="Trusted installed module:function returning a local decision backend.",
+    )
+    parser.add_argument(
+        "--development",
+        required=True,
+        type=Path,
+        help="Development JSONL used only to fit thresholds.",
+    )
+    parser.add_argument(
+        "--evaluation",
+        required=True,
+        type=Path,
+        help="Held-out evaluation JSONL; never used to fit thresholds.",
+    )
+    parser.add_argument(
+        "--calibration-id",
+        required=True,
+        help="Controlled profile prefix; each mode becomes <prefix>.<mode>.",
+    )
+    parser.add_argument(
+        "--calibration-version",
+        default="1.0.0",
+        help="Semantic version recorded in emitted profiles.",
+    )
+    parser.add_argument(
+        "--min-examples-per-option",
+        type=int,
+        default=20,
+        help="Evaluation examples required for every option before a profile.",
+    )
+    parser.add_argument(
+        "--accuracy-floor",
+        type=float,
+        default=0.9,
+        help="Selective accuracy required on development and evaluation.",
+    )
+    parser.add_argument(
+        "--coverage-floor",
+        type=float,
+        default=0.5,
+        help="Evaluation coverage required at the frozen thresholds.",
+    )
+    parser.add_argument(
+        "--profile-output",
+        type=Path,
+        help="New file for the emitted profiles; written only when qualified.",
+    )
+    add_json_flag(parser)
+    parser.set_defaults(handler=handle_decision_qualification)
+
+
+def handle_decision_qualification(args: argparse.Namespace) -> int:
+    """Emit only the value-free report; never echo inputs or backend errors."""
+    from openmed.eval.decision_qualification import (
+        DecisionQualificationError,
+        DecisionQualificationPolicy,
+        qualify_decision_backend,
+    )
+
+    code = None
+    written = False
+    try:
+        output = args.profile_output
+        if output is not None and os.path.lexists(output):
+            raise DecisionQualificationError("profile_output_exists")
+        report = qualify_decision_backend(
+            _backend(args, DecisionQualificationError),
+            development=args.development,
+            evaluation=args.evaluation,
+            calibration_id=args.calibration_id,
+            calibration_version=args.calibration_version,
+            policy=DecisionQualificationPolicy(
+                min_examples_per_option=args.min_examples_per_option,
+                accuracy_floor=args.accuracy_floor,
+                coverage_floor=args.coverage_floor,
+            ),
+        )
+        if report.qualified and output is not None:
+            profiles = report.to_dict()["profiles"]
+            try:
+                _write_new(
+                    output, json.dumps(profiles, indent=2, sort_keys=True) + "\n"
+                )
+            except OSError:
+                raise DecisionQualificationError("profile_output_unavailable") from None
+            written = True
+    except DecisionQualificationError as error:
+        code = error.code
+    except Exception:
+        code = "qualification_unavailable"
+    if code is not None:
+        raise CliError(
+            f"Decision qualification failed: {code}.",
+            code="decision_qualification_failed",
+        )
+    payload = report.to_dict()
+    notice = ""
+    if output is not None:
+        notice = " Profile written." if written else " Profile withheld."
+    emit(
+        args,
+        payload,
+        human=(
+            f"Decision qualification: {payload['status']}; "
+            f"human review required.{notice}"
+        ),
+    )
+    return 0 if payload["qualified"] else 1
+
+
+def _backend(args: argparse.Namespace, error: type[Exception]):
+    from openmed.structured.decision import (
+        DecisionBackend,
+        DecisionBackendIdentity,
+        DeterministicDecisionBackend,
+    )
+
+    if args.backend_factory is None:
+        # A fresh instance; the module-level default is never touched.
+        return DeterministicDecisionBackend()
+    parts = args.backend_factory.
```

**File**: `openmed/cli/main.py` (modified, +3/-0)
```diff
@@ -612,6 +612,9 @@ def build_parser() -> argparse.ArgumentParser:
     from .nli_qualification import add_nli_qualification_command
 
     add_nli_qualification_command(subparsers)
+    from .decision_qualification import add_decision_qualification_command
+
+    add_decision_qualification_command(subparsers)
     from .clinical_review import add_clinical_review_commands
 
     add_clinical_review_commands(subparsers)
```

**File**: `openmed/eval/decision_qualification.py` (added, +806/-0)
```diff
@@ -0,0 +1,806 @@
+"""Offline qualification of caller-selected fixed-option decision backends.
+
+Thresholds are fit per decision mode on a caller-supplied development split
+only, then frozen before a separate evaluation split is scored. Reports hold
+counts, metrics, controlled reason codes and SHA-256 digests; they never hold
+input text, option values, record identifiers or file paths. A qualified report
+attests only to the supplied files and policy. It is not clinical validation,
+and emitted calibration profiles are never registered as defaults.
+"""
+
+from __future__ import annotations
+
+import bisect
+import hashlib
+import json
+import re
+import time
+import unicodedata
+from collections import Counter
+from collections.abc import Mapping, Sequence
+from dataclasses import asdict, dataclass, field
+from pathlib import Path
+from typing import Any, Final
+
+from openmed.structured.decision import (
+    DECISION_SCHEMA_VERSION,
+    DecisionBackend,
+    DecisionBackendIdentity,
+    DecisionCalibrationExample,
+    DecisionCalibrationProfile,
+    DecisionConflictError,
+    DecisionError,
+    DecisionMode,
+    DecisionRequest,
+    DecisionResult,
+    DecisionState,
+    DecisionUnsupportedError,
+    decide,
+    evaluate_decision_calibration,
+)
+
+DECISION_QUALIFICATION_SCHEMA_VERSION: Final = "1.0.0"
+DECISION_QUALIFICATION_METHOD: Final = "development_max_coverage"
+QUALIFIABLE_DECISION_MODES: Final = (
+    DecisionMode.FIXED_CHOICE,
+    DecisionMode.BOOLEAN_CHOICE,
+    DecisionMode.ORDERED_PREFERENCE,
+    DecisionMode.MULTI_LABEL,
+)
+MAX_SPLIT_BYTES: Final = 64 * 1024 * 1024
+MAX_SPLIT_RECORDS: Final = 50_000
+_MAX_CANDIDATES: Final = 256
+_REQUIRED_FIELDS: Final = frozenset(
+    {"mode", "input_text", "options", "expected_choices"}
+)
+_RECORD_FIELDS: Final = _REQUIRED_FIELDS | {"id"}
+# Leave room for the longest ``.<mode>`` suffix inside the 128-character limit.
+_CALIBRATION_ID_RE = re.compile(r"^[a-z][a-z0-9_.:/-]{0,107}$")
+_VERSION_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
+_DATA_REASON_MARKERS: Final = (
+    "split_overlap",
+    "_missing_",
+    "_insufficient_option_support_",
+)
+
+
+class DecisionQualificationError(DecisionError):
+    """Value-free qualification failure carrying a controlled reason code."""
+
+    def __init__(self, code: str) -> None:
+        super().__init__(code)
+        self.code = code
+
+
+@dataclass(frozen=True)
+class DecisionQualificationPolicy:
+    """Caller-selected support and operating floors, not clinical norms.
+
+    Attributes:
+        min_examples_per_option: Minimum evaluation examples whose expected
+            choices include each declared option, counted per decision mode.
+            Below it, no profile is emitted.
+        accuracy_floor: Minimum selective accuracy on covered examples. The
+            development split selects thresholds against it and the
+            evaluation split must meet it at the frozen thresholds.
+        coverage_floor: Minimum evaluation coverage at the frozen thresholds.
+    """
+
+    min_examples_per_option: int = 20
+    accuracy_floor: float = 0.9
+    coverage_floor: float = 0.5
+
+    def __post_init__(self) -> None:
+        if (
+            type(self.min_examples_per_option) is not int
+            or self.min_examples_per_option < 1
+        ):
+            raise DecisionQualificationError("invalid_policy")
+        for value in (self.accuracy_floor, self.coverage_floor):
+            if type(value) not in (float, int) or not 0 <= value <= 1:
+                raise DecisionQualificationError("invalid_policy")
+
+
+@dataclass(frozen=True, slots=True)
+class DecisionQualificationReport:
+    """Immutable value-free report; profiles are present only when qualified."""
+
+    _payload: str = field(repr=False)
+
+    @property
+    def digest(self) -> str:
+        """Return the SHA-256 digest bound to the whole report payload."""
+        return "sha256:" + hashlib.sha256(self._payload.encode("utf-8")).hexdigest()
+
+    @property
+    def status(self) -> str:
+        """Return ``qualified``, ``insufficient`` or ``not_qualified``."""
+        return str(json.loads(self._payload)["status"])
+
+    @property
+    def qualified(self) -> bool:
+        """Return whether every policy check passed on the supplied data."""
+        return bool(json.loads(self._payload)["qualified"])
+
+    def profiles(self) -> dict[str, DecisionCalibrationProfile]:
+        """Return emitted profiles keyed by calibration ID for ``decide``.
+
+        Returns:
+            One profile per qualified mode, or an empty mapping when the report
+            did not qualify.
+        """
+        return {
+            key: DecisionCalibrationProfile(**value)
+            for key, value in json.loads(self._payload)["profiles"].items()
+        }
+
+    def to_dict(self) -> dict[str, Any]:
+        """Return a defensive copy including the report digest."""
+        return {**json.loads(se
```

**File**: `tests/fixtures/structured/decision_qualification/development.jsonl` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+{"id": "synthetic-dev-01", "mode": "fixed_choice", "input_text": "Synthetic review priority is clearly urgent.", "options": ["urgent", "routine"], "expected_choices": ["urgent"]}
+{"id": "synthetic-dev-02", "mode": "fixed_choice", "input_text": "Synthetic triage queue is clearly urgent.", "options": ["urgent", "routine"], "expected_choices": ["urgent"]}
+{"id": "synthetic-dev-03", "mode": "fixed_choice", "input_text": "Synthetic review priority is clearly routine.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-dev-04", "mode": "fixed_choice", "input_text": "Synthetic triage queue is clearly routine.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-dev-05", "mode": "fixed_choice", "input_text": "Synthetic review priority is likely urgent.", "options": ["urgent", "routine"], "expected_choices": ["urgent"]}
+{"id": "synthetic-dev-06", "mode": "fixed_choice", "input_text": "Synthetic review priority is likely routine.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-dev-07", "mode": "fixed_choice", "input_text": "Synthetic queue lists urgent and routine items.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-dev-08", "mode": "fixed_choice", "input_text": "Synthetic queue lists routine and urgent items.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-dev-09", "mode": "fixed_choice", "input_text": "Synthetic evidence remains unclear.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-dev-10", "mode": "fixed_choice", "input_text": "Synthetic queue status is unclear.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-dev-11", "mode": "boolean_choice", "input_text": "Synthetic eligibility flag is clearly yes.", "options": ["yes", "no"], "expected_choices": ["yes"]}
+{"id": "synthetic-dev-12", "mode": "boolean_choice", "input_text": "Synthetic consent field is clearly yes.", "options": ["yes", "no"], "expected_choices": ["yes"]}
+{"id": "synthetic-dev-13", "mode": "boolean_choice", "input_text": "Synthetic eligibility flag is clearly no.", "options": ["yes", "no"], "expected_choices": ["no"]}
+{"id": "synthetic-dev-14", "mode": "boolean_choice", "input_text": "Synthetic consent field is clearly no.", "options": ["yes", "no"], "expected_choices": ["no"]}
+{"id": "synthetic-dev-15", "mode": "boolean_choice", "input_text": "Synthetic eligibility flag is likely yes.", "options": ["yes", "no"], "expected_choices": ["yes"]}
+{"id": "synthetic-dev-16", "mode": "boolean_choice", "input_text": "Synthetic consent field is likely no.", "options": ["yes", "no"], "expected_choices": ["no"]}
+{"id": "synthetic-dev-17", "mode": "boolean_choice", "input_text": "Synthetic form shows yes and no marks.", "options": ["yes", "no"], "expected_choices": ["no"]}
+{"id": "synthetic-dev-18", "mode": "boolean_choice", "input_text": "Synthetic form answer is blank.", "options": ["yes", "no"], "expected_choices": ["no"]}
+{"id": "synthetic-dev-19", "mode": "multi_label", "input_text": "Synthetic intake clearly lists fever and cough.", "options": ["fever", "cough", "rash"], "expected_choices": ["fever", "cough"]}
+{"id": "synthetic-dev-20", "mode": "multi_label", "input_text": "Synthetic intake clearly lists rash.", "options": ["fever", "cough", "rash"], "expected_choices": ["rash"]}
+{"id": "synthetic-dev-21", "mode": "multi_label", "input_text": "Synthetic intake clearly lists cough.", "options": ["fever", "cough", "rash"], "expected_choices": ["cough"]}
+{"id": "synthetic-dev-22", "mode": "multi_label", "input_text": "Synthetic intake clearly lists fever and rash.", "options": ["fever", "cough", "rash"], "expected_choices": ["fever", "rash"]}
+{"id": "synthetic-dev-23", "mode": "multi_label", "input_text": "Synthetic intake likely lists fever.", "options": ["fever", "cough", "rash"], "expected_choices": ["fever"]}
+{"id": "synthetic-dev-24", "mode": "multi_label", "input_text": "Synthetic intake likely lists cough and rash.", "options": ["fever", "cough", "rash"], "expected_choices": ["cough", "rash"]}
+{"id": "synthetic-dev-25", "mode": "multi_label", "input_text": "Synthetic intake mentions no listed finding.", "options": ["fever", "cough", "rash"], "expected_choices": ["rash"]}
+{"id": "synthetic-dev-26", "mode": "multi_label", "input_text": "Synthetic intake lists fever only.", "options": ["fever", "cough", "rash"], "expected_choices": ["fever"]}
```

**File**: `tests/fixtures/structured/decision_qualification/evaluation.jsonl` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+{"id": "synthetic-eval-01", "mode": "fixed_choice", "input_text": "Synthetic admission priority is clearly urgent.", "options": ["urgent", "routine"], "expected_choices": ["urgent"]}
+{"id": "synthetic-eval-02", "mode": "fixed_choice", "input_text": "Synthetic admission priority is clearly routine.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-eval-03", "mode": "fixed_choice", "input_text": "Synthetic referral priority is clearly urgent.", "options": ["urgent", "routine"], "expected_choices": ["urgent"]}
+{"id": "synthetic-eval-04", "mode": "fixed_choice", "input_text": "Synthetic referral priority is likely routine.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-eval-05", "mode": "fixed_choice", "input_text": "Synthetic referral priority is likely urgent.", "options": ["urgent", "routine"], "expected_choices": ["urgent"]}
+{"id": "synthetic-eval-06", "mode": "fixed_choice", "input_text": "Synthetic referral priority is clearly routine.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-eval-07", "mode": "fixed_choice", "input_text": "Synthetic referral lists urgent and routine tasks.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-eval-08", "mode": "fixed_choice", "input_text": "Synthetic referral priority is unstated.", "options": ["urgent", "routine"], "expected_choices": ["routine"]}
+{"id": "synthetic-eval-09", "mode": "boolean_choice", "input_text": "Synthetic enrollment flag is clearly yes.", "options": ["yes", "no"], "expected_choices": ["yes"]}
+{"id": "synthetic-eval-10", "mode": "boolean_choice", "input_text": "Synthetic enrollment flag is clearly no.", "options": ["yes", "no"], "expected_choices": ["no"]}
+{"id": "synthetic-eval-11", "mode": "boolean_choice", "input_text": "Synthetic screening flag is likely yes.", "options": ["yes", "no"], "expected_choices": ["yes"]}
+{"id": "synthetic-eval-12", "mode": "boolean_choice", "input_text": "Synthetic screening flag is clearly no.", "options": ["yes", "no"], "expected_choices": ["no"]}
+{"id": "synthetic-eval-13", "mode": "boolean_choice", "input_text": "Synthetic screening answer is missing.", "options": ["yes", "no"], "expected_choices": ["no"]}
+{"id": "synthetic-eval-14", "mode": "boolean_choice", "input_text": "Synthetic enrollment form shows yes and no marks.", "options": ["yes", "no"], "expected_choices": ["yes"]}
+{"id": "synthetic-eval-15", "mode": "multi_label", "input_text": "Synthetic triage clearly lists fever.", "options": ["fever", "cough", "rash"], "expected_choices": ["fever"]}
+{"id": "synthetic-eval-16", "mode": "multi_label", "input_text": "Synthetic triage clearly lists cough and rash.", "options": ["fever", "cough", "rash"], "expected_choices": ["cough", "rash"]}
+{"id": "synthetic-eval-17", "mode": "multi_label", "input_text": "Synthetic triage likely lists fever and cough.", "options": ["fever", "cough", "rash"], "expected_choices": ["fever", "cough"]}
+{"id": "synthetic-eval-18", "mode": "multi_label", "input_text": "Synthetic triage clearly lists rash.", "options": ["fever", "cough", "rash"], "expected_choices": ["rash"]}
+{"id": "synthetic-eval-19", "mode": "multi_label", "input_text": "Synthetic triage lists cough only.", "options": ["fever", "cough", "rash"], "expected_choices": ["cough"]}
+{"id": "synthetic-eval-20", "mode": "multi_label", "input_text": "Synthetic triage mentions no listed finding.", "options": ["fever", "cough", "rash"], "expected_choices": ["fever"]}
```

**File**: `tests/integration/test_decision_qualification.py` (added, +241/-0)
```diff
@@ -0,0 +1,241 @@
+"""Offline command/library composition for decision-backend qualification."""
+
+import json
+import os
+import stat
+
+import pytest
+
+from openmed.cli.decision_qualification import handle_decision_qualification
+from openmed.cli.main import build_parser, main
+from openmed.eval.decision_qualification import (
+    DecisionQualificationPolicy,
+    qualify_decision_backend,
+)
+from openmed.structured import decision as decision_module
+from openmed.structured.decision import (
+    DecisionCalibrationProfile,
+    DecisionRequest,
+    DecisionState,
+    DeterministicDecisionBackend,
+    decide,
+)
+from tests.unit.eval import test_decision_qualification as fixtures
+
+pytestmark = pytest.mark.integration
+
+ENCODER = "tests.unit.eval.test_decision_qualification:synthetic_encoder_backend"
+SPY = "tests.unit.eval.test_decision_qualification:spy_encoder_backend"
+
+
+def command(
+    *extra, development=None, evaluation=None, backend=("--backend", "deterministic")
+):
+    return [
+        "decision-qualify",
+        *backend,
+        "--development",
+        str(development or fixtures.DEVELOPMENT),
+        "--evaluation",
+        str(evaluation or fixtures.EVALUATION),
+        "--calibration-id",
+        "site.triage",
+        *extra,
+        "--json",
+    ]
+
+
+def test_command_and_library_emit_identical_deterministic_report(capsys):
+    args = build_parser().parse_args(command("--min-examples-per-option", "2"))
+
+    assert handle_decision_qualification(args) == 0
+    envelope = json.loads(capsys.readouterr().out)
+    expected = qualify_decision_backend(
+        DeterministicDecisionBackend(),
+        development=fixtures.DEVELOPMENT,
+        evaluation=fixtures.EVALUATION,
+        calibration_id="site.triage",
+        policy=DecisionQualificationPolicy(min_examples_per_option=2),
+    ).to_dict()
+    assert envelope["command"] == "decision-qualify"
+    assert envelope["data"] == expected
+    assert envelope["data"]["status"] == "qualified"
+
+
+def test_factory_encoder_writes_private_profile_usable_by_decide(tmp_path, capsys):
+    output = tmp_path / "profiles.json"
+
+    status = main(
+        command(
+            "--min-examples-per-option",
+            "2",
+            "--profile-output",
+            str(output),
+            backend=("--backend-factory", ENCODER),
+        )
+    )
+
+    assert status == 0
+    data = json.loads(capsys.readouterr().out)["data"]
+    assert data["backend"]["kind"] == "encoder"
+    if os.name != "nt":
+        assert stat.S_IMODE(output.stat().st_mode) == 0o600
+    written = json.loads(output.read_text("utf-8"))
+    assert written == data["profiles"]
+    profiles = {
+        key: DecisionCalibrationProfile(**value) for key, value in written.items()
+    }
+    result = decide(
+        DecisionRequest(
+            mode="fixed_choice",
+            input_text="Synthetic review priority is clearly urgent.",
+            options=("urgent", "routine"),
+            calibration_id="site.triage.fixed_choice",
+        ),
+        backend=fixtures.synthetic_encoder_backend(),
+        calibration_profiles=profiles,
+    )
+    assert result.state is DecisionState.SUCCESS
+    assert result.choice == "urgent"
+
+
+def test_default_support_minimum_withholds_profile(tmp_path, capsys):
+    output = tmp_path / "profiles.json"
+
+    status = main(command("--profile-output", str(output)))
+
+    assert status == 1
+    data = json.loads(capsys.readouterr().out)["data"]
+    assert data["status"] == "insufficient"
+    assert data["policy"]["min_examples_per_option"] == 20
+    assert data["profiles"] == {}
+    assert not output.exists()
+
+
+def test_human_output_states_review_and_withheld_profile(tmp_path, capsys):
+    output = tmp_path / "profiles.json"
+    arguments = command("--profile-output", str(output))
+    arguments.remove("--json")
+
+    assert main(arguments) == 1
+    captured = capsys.readouterr()
+    assert captured.out.strip() == (
+        "Decision qualification: insufficient; human review required. Profile withheld."
+    )
+
+
+def test_evaluation_is_scored_only_after_fit_through_the_command(capsys):
+    fixtures.SCORED.clear()
+    dev_inputs = {
+        fixtures.text_digest(row["input_text"])
+        for row in fixtures.records(fixtures.DEVELOPMENT)
+    }
+    eval_inputs = {
+        fixtures.text_digest(row["input_text"])
+        for row in fixtures.records(fixtures.EVALUATION)
+    }
+
+    assert (
+        main(
+            command(
+                "--min-examples-per-option", "2", backend=("--backend-factory", SPY)
+            )
+        )
+        == 0
+    )
+    capsys.readouterr()
+
+    assert set(fixtures.SCORED[: len(dev_inputs)]) == dev_inputs
+    assert set(fixtures.SCORED[len(dev_inputs) :]) == eval_inputs
+    fixtures.SCORED.clear()
+
+
+def test_command_never_registers_the_selected_backend_as_default(capsys):
+    default_backend = decision_module.DETERMINISTIC_DEC
```

---

### Incident Patch 2: `dd39d386` (2026-10-30)
**Commit Message**: Require glyph coverage for burned-in synthetic renders

Closes #3868

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -9,6 +9,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Breaking Changes
 
+- Burned-in synthetic rendering now requires covering fonts and complex-script shaping; missing default fonts require explicit `font_fallback=True` (#3868).
+  Dataset-recipe callers can opt into checked image fallback through
+  `builtin_recipe_generators(font_fallback=True)`; the policy is provenance-bound.
+
 - Require Python 3.11 or newer for the v3.2 development line so dependency
   security fixes can be installed. Upgrade Python 3.10 environments before
   updating OpenMed; published v3.1.0 remains available for the older interpreter.
```

**File**: `docs/brand/system/publication.yml` (modified, +1/-0)
```diff
@@ -432,6 +432,7 @@ classification:
     - training/synthetic/omop-cohorts.md
     - training/synthetic/rare-case-stressors.md
     - training/synthetic/intake-conversations.md
+    - training/synthetic/burned-in-font-coverage.md
     - reference/preference-schema.md
     - multimodal/bmp-header-preflight.md
     - multimodal/gif-header-preflight.md
```

**File**: `docs/training/synthetic/burned-in-font-coverage.md` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+# Burned-in font coverage and shaping
+
+`BurnedInGenerator` draws synthetic names, dates, and MRNs into image pixels
+and returns pixel boxes as OCR truth. A box is only truthful if the font can
+draw every character and, for complex scripts, if the text is shaped. The
+generator therefore checks each span before drawing it and fails closed with a
+typed, value-free error instead of rendering missing-glyph boxes or unjoined
+letters.
+
+## What is checked
+
+For every rendered span (`PERSON`, `DATE`, `ID_NUM`):
+
+1. **Glyph coverage.** Each code point must map to a real glyph in the
+   character map (`cmap`) of the exact font bytes used to draw it. Controls
+   and default-ignorable formatting characters such as ZWJ and ZWNJ are
+   exempt. The reader follows FreeType's choice of Unicode subtable and treats
+   glyph 0 (`.notdef`) and glyph ids beyond `maxp.numGlyphs` as missing.
+2. **Complex layout.** Spans containing a script in `COMPLEX_LAYOUT_SCRIPTS`
+   (Arabic, Hebrew, Syriac, Thaana, N'Ko, the Indic scripts, Thai, Lao, Khmer,
+   Myanmar, Tibetan, Mongolian, and Ethiopic) or an unrecognised script need a
+   font whose layout engine shapes text. Pillow shapes, reorders right-to-left
+   runs, and positions marks only with its Raqm engine, which needs HarfBuzz
+   and FriBiDi at runtime. Check with
+   `PIL.features.check_feature("raqm")`; without Raqm these spans are refused.
+
+Latin, Greek, Cyrillic, Armenian, Georgian, Han, kana, and Hangul spans need
+coverage only.
+
+## Supplying fonts
+
+OpenMed does not bundle fonts. Pass font files you are licensed to use as
+`BurnedInFont` entries with an SPDX license identifier from
+`PERMISSIVE_FONT_LICENSES` (the permissive SPDX allowlist plus `OFL-1.1` and
+its RFN variants, `Bitstream-Vera`, and `CC0-1.0`). Other identifiers raise
+`BurnedInFontError` with reason `font_license_not_permissive`.
+
+```python
+from openmed.training.synthetic.burned_in import BurnedInFont, BurnedInGenerator
+
+latin = BurnedInFont("/fonts/NotoSans-Regular.ttf", license="OFL-1.1")
+thai = BurnedInFont("/fonts/NotoSansThai-Regular.ttf", license="OFL-1.1")
+
+generator = BurnedInGenerator(
+    seed=3,
+    font_names=(latin,),            # pool for dates, MRNs, and other scripts
+    script_fonts={"Thai": thai},    # used for spans that contain Thai
+)
+example = generator.generate("th")
+```
+
+Each span's font is chosen in this order: an exact per-call `font_names`
+control, then the first `script_fonts` entry matching a script in the span
+(keys come from `FONT_SCRIPTS`), then the constructor's `font_names` pool.
+Plain font names and paths are still accepted in `font_names`; they are
+recorded with license `NOASSERTION`, and the default DejaVu names with their
+declared `Bitstream-Vera` license. Use `BurnedInFont(..., index=n)` to select
+a face inside a `.ttc` collection.
+
+## Missing fonts and opt-in fallback
+
+A font that cannot be loaded raises `BurnedInFontUnavailableError`. It is
+never replaced silently. With `font_fallback=True`, a missing default DejaVu
+font is replaced by another installed default or, as a last resort, by
+Pillow's embedded Aileron Regular (`PillowDefault`, `CC0-1.0`). The
+replacement is still coverage-checked, so it can render basic Latin text but
+refuses scripts it cannot draw. The `generate_burned_in_example` helper
+accepts the same `script_fonts` and `font_fallback` arguments.
+The English dataset-recipe adapter keeps fallback disabled by default; Python
+callers can request `builtin_recipe_generators(font_fallback=True)`, with the
+choice bound into its provenance. See [dataset recipes](dataset-recipes.md).
+
+## Provenance in metadata
+
+Each `BurnedInTextBox.metadata` records `font_sha256` (SHA-256 of the font
+file bytes that were rendered), `font_license`, `font_fallback`,
+`layout_engine` (`raqm`, `basic`, or `bitmap`), and the span's `scripts`.
+`font_name` is the file name only, never the directory. The example metadata
+adds `font_fallback_allowed`, `font_fallback_used`, and `fonts`, one
+provenance record per distinct font in first-use order. The same seed, font
+digest, and Pillow build produce byte-identical images.
+
+## Errors
+
+All errors subclass `BurnedInFontError`, itself a `ValueError`. Messages and
+attributes carry only a reason code, script name, canonical label, counts,
+font digest, or an opaque `font_ref`; never span text, code points, or paths.
+
+| Error | `reason` | Raised when |
+| --- | --- | --- |
+| `BurnedInFontUnavailableError` | `font_unavailable`, `fallback_font_unavailable` | A font cannot be loaded and no usable fallback was requested. |
+| `BurnedInGlyphCoverageError` | `glyph_coverage_missing` | The selected font lacks glyphs for a span; `script`, `font_sha256`, and `missing_count` identify the gap. |
+| `BurnedInShapingUnavailableError` | `complex_layout_unavailable` | A complex-script span would be drawn without a shaping layout engine. |
+| `BurnedInFontError` | `font
```

**File**: `docs/training/synthetic/dataset-recipes.md` (modified, +20/-2)
```diff
@@ -2,7 +2,9 @@
 
 `openmed synthetic build recipe.json new-output-directory --json` runs an actual
 bounded offline recipe. Built-in adapters reuse existing social-history and
-burned-in-image generators; images require the optional Pillow dependency. No
+burned-in-image generators; images require the optional Pillow dependency. The
+default DejaVu fonts must also be available unless fallback is explicitly
+requested through the Python adapter factory below. No
 models, private datasets, generator services or publication are downloaded or
 invoked. CLI output contains only digests/counts/completion status.
 
@@ -45,10 +47,26 @@ Path("recipe.json").write_text(json.dumps(recipe))
 openmed synthetic build recipe.json synthetic-demo-output --json
 ```
 
-The output reports `complete: true`, two records and three generated artifacts.
+With the required fonts installed, the output reports `complete: true`, two
+records and three generated artifacts.
 The directory contains social-history JSONL, one PNG, its label JSON, derivation
 metadata and a completion marker. Choose a new destination for each run.
 
+For portable English examples, Python callers may explicitly opt into checked
+fallback without changing the CLI or generator defaults:
+
+```python
+from openmed.training.synthetic.dataset_recipe import (
+    builtin_recipe_generators, run_dataset_recipe,
+)
+
+registry = builtin_recipe_generators(font_fallback=True)
+result = run_dataset_recipe(recipe, "synthetic-python-output", registry=registry)
+```
+
+The burned-in adapter provenance binds this option. It still refuses missing
+glyphs or required shaping; fallback does not make unsupported scripts valid.
+
 The runner rejects unavailable generators, wrong versions, missing dependencies,
 cycles and output-limit violations. It reserves a new destination, writes into an
 owned sibling stage, validates every generator and runs local validation/capsule
```

**File**: `mkdocs.yml` (modified, +1/-0)
```diff
@@ -373,6 +373,7 @@ nav:
       - Synthetic OMOP Cohorts: training/synthetic/omop-cohorts.md
       - Rare-case Privacy Stressors: training/synthetic/rare-case-stressors.md
       - Synthetic Intake Conversations: training/synthetic/intake-conversations.md
+      - Burned-in Font Coverage: training/synthetic/burned-in-font-coverage.md
       - Preference Pair Schema: reference/preference-schema.md
       - BMP Header Preflight: multimodal/bmp-header-preflight.md
       - GIF Header Preflight: multimodal/gif-header-preflight.md
```

**File**: `openmed/training/synthetic/burned_in.py` (modified, +959/-34)
```diff
@@ -4,15 +4,40 @@
 module, :mod:`openmed.training.synthetic`, or the core :mod:`openmed` package
 therefore remains safe for installations that do not include the
 ``multimodal`` extra.
+
+Every rendered span is checked against the character map of the exact font
+bytes used to draw it, and spans in scripts that need complex text layout
+(joining, reordering, conjuncts, or mark positioning) also require a
+shaping-capable layout engine. Failures raise :class:`BurnedInFontError`
+subclasses whose messages carry only reason codes, script names, canonical
+labels, counts, and font digests. A missing font is never replaced unless the
+caller opts in with ``font_fallback=True``, and every example records the
+SHA-256 digest and declared license of each font it used.
 """
 
 from __future__ import annotations
 
+import bisect
 import hashlib
 import importlib
+import io
+import os
 import random
+import struct
+import unicodedata
 from dataclasses import dataclass, field
-from typing import TYPE_CHECKING, Any, Final, Mapping, Sequence
+from typing import (
+    TYPE_CHECKING,
+    Any,
+    Callable,
+    ClassVar,
+    Container,
+    Final,
+    Iterable,
+    Iterator,
+    Mapping,
+    Sequence,
+)
 
 from faker import Faker
 
@@ -22,6 +47,7 @@
 from openmed.training.synthetic.provider_versions import surrogate_provider_stamp
 
 from .locale_phi import LocalePhiGenerator, SyntheticPhiSpan
+from .spdx_identifier import PERMISSIVE_SPDX_IDENTIFIERS
 
 if TYPE_CHECKING:
     from PIL.Image import Image as PillowImage
@@ -38,13 +64,404 @@
 )
 BACKGROUND_MODES: Final[tuple[str, ...]] = ("solid", "gradient", "phantom")
 
+#: Declared license of the default DejaVu font names (Bitstream Vera terms;
+#: DejaVu changes are public domain). It labels the name, not a verified file.
+DEFAULT_FONT_LICENSE: Final = "Bitstream-Vera"
+#: Name and declared license of Pillow's embedded Aileron Regular font, the
+#: last resort when ``font_fallback=True`` and no default font is installed.
+PILLOW_DEFAULT_FONT_NAME: Final = "PillowDefault"
+PILLOW_DEFAULT_FONT_LICENSE: Final = "CC0-1.0"
+#: SPDX "no assertion" value recorded for plain font names without a license.
+UNDECLARED_FONT_LICENSE: Final = "NOASSERTION"
+#: Licenses accepted for :class:`BurnedInFont`. Rendering text with a font
+#: does not redistribute it, so the permissive font licenses are allowed in
+#: addition to the committed permissive SPDX allowlist.
+PERMISSIVE_FONT_LICENSES: Final[frozenset[str]] = PERMISSIVE_SPDX_IDENTIFIERS | {
+    "Bitstream-Vera",
+    "CC0-1.0",
+    "OFL-1.1",
+    "OFL-1.1-RFN",
+    "OFL-1.1-no-RFN",
+}
+
+_COMMON_SCRIPT: Final = "Common"
+_INHERITED_SCRIPT: Final = "Inherited"
+_UNKNOWN_SCRIPT: Final = "Unknown"
+
+# Block-level approximation of the Unicode Script property for the scripts
+# the locale PHI generator and common clinical documents use. Sorted, with no
+# overlaps. Letters and marks outside these ranges resolve to ``Unknown``,
+# which is treated as needing complex layout so the check fails closed.
+_SCRIPT_RANGES: Final[tuple[tuple[int, int, str], ...]] = (
+    (0x0041, 0x005A, "Latin"),
+    (0x0061, 0x007A, "Latin"),
+    (0x00AA, 0x00AA, "Latin"),
+    (0x00BA, 0x00BA, "Latin"),
+    (0x00C0, 0x00D6, "Latin"),
+    (0x00D8, 0x00F6, "Latin"),
+    (0x00F8, 0x02AF, "Latin"),
+    (0x0300, 0x036F, _INHERITED_SCRIPT),
+    (0x0370, 0x03FF, "Greek"),
+    (0x0400, 0x052F, "Cyrillic"),
+    (0x0530, 0x058F, "Armenian"),
+    (0x0590, 0x05FF, "Hebrew"),
+    (0x0600, 0x06FF, "Arabic"),
+    (0x0700, 0x074F, "Syriac"),
+    (0x0750, 0x077F, "Arabic"),
+    (0x0780, 0x07BF, "Thaana"),
+    (0x07C0, 0x07FF, "Nko"),
+    (0x0860, 0x086F, "Syriac"),
+    (0x0870, 0x08FF, "Arabic"),
+    (0x0900, 0x097F, "Devanagari"),
+    (0x0980, 0x09FF, "Bengali"),
+    (0x0A00, 0x0A7F, "Gurmukhi"),
+    (0x0A80, 0x0AFF, "Gujarati"),
+    (0x0B00, 0x0B7F, "Oriya"),
+    (0x0B80, 0x0BFF, "Tamil"),
+    (0x0C00, 0x0C7F, "Telugu"),
+    (0x0C80, 0x0CFF, "Kannada"),
+    (0x0D00, 0x0D7F, "Malayalam"),
+    (0x0D80, 0x0DFF, "Sinhala"),
+    (0x0E00, 0x0E7F, "Thai"),
+    (0x0E80, 0x0EFF, "Lao"),
+    (0x0F00, 0x0FFF, "Tibetan"),
+    (0x1000, 0x109F, "Myanmar"),
+    (0x10A0, 0x10FF, "Georgian"),
+    (0x1100, 0x11FF, "Hangul"),
+    (0x1200, 0x139F, "Ethiopic"),
+    (0x1780, 0x17FF, "Khmer"),
+    (0x1800, 0x18AF, "Mongolian"),
+    (0x19E0, 0x19FF, "Khmer"),
+    (0x1AB0, 0x1AFF, _INHERITED_SCRIPT),
+    (0x1C80, 0x1C8F, "Cyrillic"),
+    (0x1C90, 0x1CBF, "Georgian"),
+    (0x1D00, 0x1D7F, "Latin"),
+    (0x1DC0, 0x1DFF, _INHERITED_SCRIPT),
+    (0x1E00, 0x1EFF, "Latin"),
+    (0x1F00, 0x1FFF, "Greek"),
+    (0x200C, 0x200D, _INHERITED_SCRIPT),
+    (0x20D0, 0x20FF, _INHERITED_SCRIPT),
+    (0x2C60, 0x2C7F, "Latin"),
+    (0x2D00, 0x2D2F, "Georgian"),
+    (0x2D80, 0x2DDF, "Ethiopic"),
+    (0x2DE0, 0x2DFF, "Cyrillic"),
+    (0x2E80, 0x2FDF, "Han"),
+    (0x3005, 0x3005, "Han"),
+    (0x3007, 0x3007, "Han"),
+    (0x3021, 0x3029, "Han"),
+    (
```

**File**: `openmed/training/synthetic/dataset_recipe.py` (modified, +18/-5)
```diff
@@ -359,8 +359,20 @@ def run_dataset_recipe(
         raise ValueError("synthetic recipe generation or validation failed") from None
 
 
-def builtin_recipe_generators() -> dict[str, RecipeGenerator]:
-    """Return existing local social-history and burned-in-image generator adapters."""
+def builtin_recipe_generators(
+    *, font_fallback: bool = False
+) -> dict[str, RecipeGenerator]:
+    """Return local social-history and burned-in-image generator adapters.
+
+    Args:
+        font_fallback: Explicitly allow checked fallback fonts for the English
+            image adapter. The default preserves strict font availability.
+
+    Returns:
+        Adapters whose provenance binds the image fallback policy.
+    """
+    if not isinstance(font_fallback, bool):
+        raise ValueError("font_fallback must be a boolean")
 
     def social(seed, count, dependencies):
         from openmed.training.synthetic.social_history import (
@@ -378,9 +390,9 @@ def images(seed, count, dependencies):
             raise ValueError("burned-in recipe count exceeds bounded rendering limit")
         artifacts = {}
         for index in range(count):
-            example = BurnedInGenerator(seed=seed + index).generate(
-                "en", background="solid"
-            )
+            example = BurnedInGenerator(
+                seed=seed + index, font_fallback=font_fallback
+            ).generate("en", background="solid")
             buffer = io.BytesIO()
             example.image.save(buffer, format="PNG")
             item = example.to_training_item()
@@ -413,6 +425,7 @@ def validated(result):
                 {
                     "adapter_source_digest": adapter_digest,
                     "generator_source_digest": generator_digest,
+                    **({"font_fallback": font_fallback} if code == "burned_in" else {}),
                 }
             )
         ).hexdigest()
```

**File**: `tests/integration/test_synthetic_burned_in_fonts.py` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+"""Offline sweep: burned-in renders draw only covered, shaped PHI or fail closed."""
+
+from __future__ import annotations
+
+import os
+
+import pytest
+
+from openmed.training.synthetic import SUPPORTED_LOCALE_PHI_LANGUAGES
+from openmed.training.synthetic.burned_in import (
+    COMPLEX_LAYOUT_SCRIPTS,
+    DEFAULT_FONT_NAMES,
+    BurnedInFontError,
+    BurnedInGenerator,
+    read_font_character_map,
+)
+
+ImageFont = pytest.importorskip("PIL.ImageFont")
+
+pytestmark = [
+    pytest.mark.integration,
+    pytest.mark.filterwarnings("ignore:OpenMed. language:UserWarning"),
+]
+
+_SEEDS = (0, 1, 2)
+
+
+class _EveryCodePoint:
+    def __contains__(self, code_point: object) -> bool:
+        return True
+
+
+@pytest.fixture
+def platform_independent_fonts(monkeypatch):
+    """Hide the DejaVu defaults so every platform uses Pillow's embedded font."""
+
+    real_truetype = ImageFont.truetype
+
+    def truetype_without_defaults(font, *args, **kwargs):
+        if isinstance(font, (str, os.PathLike)) and (
+            os.path.basename(os.fspath(font)) in DEFAULT_FONT_NAMES
+        ):
+            raise OSError("cannot open resource")
+        return real_truetype(font, *args, **kwargs)
+
+    monkeypatch.setattr(ImageFont, "truetype", truetype_without_defaults)
+
+
+def _span_texts(language: str, seed: int) -> list[str]:
+    # Render with permissive providers only to learn the synthetic values that
+    # a refused render must never echo.
+    example = BurnedInGenerator(
+        seed=seed,
+        font_fallback=True,
+        character_map_provider=lambda data, index: _EveryCodePoint(),
+        layout_capability_provider=lambda font: True,
+    ).generate(language)
+    return [span.text for span in example.gold_spans]
+
+
+@pytest.mark.parametrize("language", SUPPORTED_LOCALE_PHI_LANGUAGES)
+def test_every_locale_renders_covered_shaped_text_or_fails_closed(
+    platform_independent_fonts, language
+):
+    coverage = read_font_character_map(ImageFont.load_default(size=12).font_bytes)
+
+    for seed in _SEEDS:
+        try:
+            example = BurnedInGenerator(seed=seed, font_fallback=True).generate(
+                language
+            )
+        except BurnedInFontError as error:
+            message = str(error)
+            assert message.isascii()
+            assert error.font_sha256 is not None
+            for text in _span_texts(language, seed):
+                assert text not in message
+            with pytest.raises(type(error)) as repeated:
+                BurnedInGenerator(seed=seed, font_fallback=True).generate(language)
+            assert str(repeated.value) == message
+            continue
+
+        repeat = BurnedInGenerator(seed=seed, font_fallback=True).generate(language)
+        assert repeat.image.tobytes() == example.image.tobytes()
+        assert repeat.metadata == example.metadata
+        for box in example.gold_boxes:
+            assert all(ord(char) in coverage for char in box.text)
+            assert box.metadata["font_fallback"] is True
+            complex_scripts = set(box.metadata["scripts"]) & COMPLEX_LAYOUT_SCRIPTS
+            assert not complex_scripts or box.metadata["layout_engine"] == "raqm"
```

---

### Incident Patch 3: `757513d9` (2026-10-30)
**Commit Message**: Align synthetic guides with locale and date capabilities

**File**: `docs/training/synthetic/burned-in.md` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ assert a.text == b.text and a.gold_boxes == b.gold_boxes
 - Text is drawn horizontally with simple backgrounds. Real scans have noise,
   skew, compression, and layouts these images do not model.
 - Values come from the locale PHI generator and Faker, so the
-  [Gregorian-ASCII-date and Faker-version caveats](locale-phi.md#known-limits)
+  [default-date and Faker-version caveats](locale-phi.md#known-limits)
   apply here too. Rendered pixels can differ slightly between Pillow or font
   versions even when the seed is unchanged.
 - The images are augmentation data, not clinical ground truth.
```

**File**: `docs/training/synthetic/locale-phi.md` (modified, +24/-10)
```diff
@@ -24,8 +24,8 @@ for example in examples:
 The first example is an English (`en_US`) note; its `PERSON`,
 `DATE_OF_BIRTH`, `ID_NUM`, `PHONE`, `STREET_ADDRESS`, and `DATE` spans each
 satisfy `text[start:end] == span.text`. `generate_locale_phi_examples` takes
-keyword-only `languages` and `seed`; with no `languages` it covers every
-supported language.
+keyword-only `languages`, `seed` and optional `date_profiles`; with no
+`languages` it retains the default model-backed language set.
 
 For a stateful generator that yields one example per call, use the class:
 
@@ -34,9 +34,16 @@ from openmed.training.synthetic import LocalePhiGenerator
 
 generator = LocalePhiGenerator(seed=7)
 english = generator.generate("en")
-everything = generator.generate_all()   # one example per supported language
+everything = generator.generate_all()   # the default model-backed set
 ```
 
+The six explicit augmentation-only routes (`ha`, `ig`, `yo`, `rw`, `tl`,
+`ne`) are also available through `generate(code)` or an explicit `languages`
+list. Use `generator.generate_all(include_augmentation_only=True)` to append
+them to the default set. Their examples record `bundled_model: False` and
+`language_route`; synthetic generation does not add bundled models or
+graduate language support.
+
 ## Training items
 
 `LocalePhiExample.to_training_item()` returns a plain dictionary ready for a
@@ -60,9 +67,10 @@ rules were applied.
 
 - `LOCALE_PHI_LABELS` lists the six labels: `PERSON`, `DATE_OF_BIRTH`,
   `ID_NUM`, `PHONE`, `STREET_ADDRESS`, `DATE`.
-- `SUPPORTED_LOCALE_PHI_LANGUAGES` lists the language codes the generator
-  accepts. Any other code raises `ValueError` and the message lists the
-  supported codes.
+- `SUPPORTED_LOCALE_PHI_LANGUAGES` lists the default model-backed template
+  set. `AUGMENTATION_ONLY_LOCALE_PHI_LANGUAGES` in
+  `openmed.training.synthetic.locale_phi` lists the six explicit extra routes.
+  Codes outside both sets raise `ValueError` with the available code lists.
 
 ```python
 from openmed.training.synthetic import LocalePhiGenerator
@@ -90,14 +98,20 @@ not reproducible. `metadata["seed"]` records which of the two was used.
 
 ## Known limits
 
-- **Dates are Gregorian and ASCII.** Dates of birth and follow-up dates are
-  rendered as ISO `YYYY-MM-DD` digits in every language, including languages
-  that normally use other numerals or calendars. A model trained only on this
-  data has not seen locale-native date writing.
+- **Default dates are Gregorian and ASCII.** Without `date_profiles=`, dates
+  of birth and follow-up dates stay ISO `YYYY-MM-DD` in every language. Opt-in
+  native-digit and native-calendar profiles are documented in the
+  [language guide](../../languages.md). Profiles carry value-free calendar,
+  numeral and detection-gap metadata; generating them does not establish
+  detector coverage or clinical validity. For example,
+  `LocalePhiGenerator(seed=7, date_profiles={"fa": "fa_solar_hijri_month_name"})`
+  opts Persian examples into that profile while other languages keep defaults.
 - **Faker-dependent values.** Names, phone numbers, and street addresses come
   from Faker locale providers, so they depend on the installed Faker version
   and on how complete that provider is for the language. Identifiers use the
   repository's checksum validators where one exists.
+  `metadata["surrogate_providers"]` records the provider stamp for later drift
+  checks; reproducibility assumes the same providers and date profiles.
 - **Approximated Faker fields.** Some language packs use a neighboring Faker
   backend for fields such as phones or generic addresses and emit a
   `UserWarning`. Script-specific providers can still generate native names
```

#### Recent Merged Pull Requests:
- **PR #4373** (2026-10-31): Require patched ASN.1 decoding in the cloud extra (@maziyarpanahi)
- **PR #4371** (2026-10-31): Preserve CJK date formats during date shifting (@maziyarpanahi)
- **PR #4370** (2026-10-31): Fix source-span alignment in escaped HTML output (@maziyarpanahi)
- **PR #4363** (2026-10-30): Qualify language support with explicit abstention and graduation gates (@maziyarpanahi)
- **PR #4362** (2026-10-30): Curate native review packets and adjudicated labels (@maziyarpanahi)
- **PR #4361** (2026-10-30): Preserve clinical labels through morphology and translation (@maziyarpanahi)

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

## X. Qualify fixed-option decision backends offline

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in maziyarpanahi/openmed. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d5236b9c`: Qualify fixed-option decision backends offline. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- Add offline decision-backend qualification with development-only threshold fitting, held-out evaluation, value-free reports and explicit calibration profile output.

```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d5236b9c` are properly handled with clean fallback behavior.
