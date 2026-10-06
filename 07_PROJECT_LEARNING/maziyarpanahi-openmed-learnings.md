# Forensic Learning Record (Deep Inspection): maziyarpanahi/openmed

> **Canonical Artifact**: `07_PROJECT_LEARNING/maziyarpanahi-openmed-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:56:48.642Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maziyarpanahi/openmed`
- **Description**: Local-first healthcare AI: clinical NER & HIPAA PII de-identification that runs 100% on-device. 2,200+ medical models, 21 languages, Apple MLX + Python, no cloud, no patient data leaving your network. Apache-2.0
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5449 stars

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

### Core Architecture Module: `openmed/clinical/review_queue_sla.py`
```
"""Deterministic, PHI-safe SLA summaries for human-review queues.

The module deliberately requires an injected clock.  Queue entries are
classified locally using their enqueue time, priority, and expiry deadline;
the report contains counts only.  Detailed records retain an opaque,
deterministic key instead of the input case key.

This is an operational review aid, not a compliance certification or a
clinical decision mechanism.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from math import isfinite
from types import MappingProxyType
from typing import Any, TypeAlias

__all__ = [
    "AGE_BUCKETS",
    "DEFAULT_OPAQUE_KEY_NAMESPACE",
    "DEFAULT_PRIORITY_SLA",
    "EXPIRY_BUCKETS",
    "OVERDUE_BUCKETS",
    "PRIORITY_LEVELS",
    "REVIEW_SLA_SCHEMA_VERSION",
    "ReviewQueueCase",
    "ReviewSLARecord",
    "ReviewSLAReport",
    "build_review_sla_report",
    "build_sla_report",
    "compute_review_sla",
    "opaque_case_key",
    "render_review_sla_report",
    "render_sla_report",
]

REVIEW_SLA_SCHEMA_VERSION = "review-sla.v1"
DEFAULT_OPAQUE_KEY_NAMESPACE = "openmed-review-sla.v1"

PRIORITY_LEVELS = ("urgent", "high", "normal", "low")
DEFAULT_PRIORITY_SLA: Mapping[str, timedelta] = MappingProxyType(
    {
        "urgent": timedelta(hours=4),
        "high": timedelta(hours=8),
        "normal": timedelta(hours=24),
        "low": timedelta(hours=72),
    }
)

AGE_BUCKETS = ("0-1h", "1-4h", "4-24h", "24h+")
EXPIRY_BUCKETS = ("expired", "due-within-4h", "due-after-4h")
OVERDUE_BUCKETS = ("on-time", "0-24h-overdue", "24h+-overdue")

_EXPIRY_SOON = timedelta(hours=4)
_OVERDUE_DAY = timedelta(hours=24)
_MISSING = object()
_CASE_KEY_FIELDS = ("case_key", "case_id", "id", "key")
_QUEUED_AT_FIELDS = ("queued_at", "enqueued_at", "created_at", "submitted_at")
_PRIORITY_FIELDS = ("priority", "urgency")
_EXPIRY_FIELDS = ("expires_at", "expiry_at", "due_at")
_SLA_FIELDS = ("sla", "sla_duration", "sla_seconds")

Clock: TypeAlias = Callable[[], datetime]


@dataclass(frozen=True)
class ReviewQueueCase:
    """Input-only queue entry used by :func:`compute_review_sla`.

    ``case_key`` is accepted for local classification but is never emitted by
    this module.  ``expires_at`` takes precedence over ``sla``; when neither
    is supplied, the default duration for the canonical priority is used.
    """

    case_key: str | int = field(repr=False)
    queued_at: datetime
    priority: str = "normal"
    expires_at: datetime | None = None
    sla: timedelta | int | float | None = None


@dataclass(frozen=True)
class ReviewSLARecord:
    """PHI-safe classification for one queue entry.

    The ``case_key`` property and serialized ``case_key`` field are opaque
    hashes.  No raw input key, case contents, reviewer identity, or metadata
    is retained.
    """

    opaque_case_key: str
    queued_at: str
    priority: str
    age_seconds: int
    age_bucket: str
    expires_at: str
    expiry_bucket: str
    overdue_seconds: int
    overdue_bucket: str

    def __post_init__(self) -> None:
        if not isinstance(self.opaque_case_key, str) or not re.fullmatch(
            r"sha256:[0-9a-f]{64}", self.opaque_case_key
        ):
            raise ValueError("case key must be an opaque SHA-256 digest")
        for value, labels in (
            (self.priority, PRIORITY_LEVELS),
            (self.age_bucket, AGE_BUCKETS),
            (self.expiry_bucket, EXPIRY_BUCKETS),
            (self.overdue_bucket, OVERDUE_BUCKETS),
        ):
            if value not in labels:
                raise ValueError("record contains an unsupported bucket")
        if any(
            type(value) is not int or value < 0
            for value in (self.age_seconds, self.overdue_seconds)
        ):
            raise ValueError("record durations must be non-negative integers")
        for name in ("queued_at", "expires_at"):
            object.__setattr__(
                self, name, _coerce_datetime(getattr(self, name), name).isoformat()
            )

    @property
    def case_key(self) -> str:
        """Return the stable opaque key used in this record."""

        return self.opaque_case_key

    @property
    def is_overdue(self) -> bool:
        """Whether the entry is past its expiry deadline."""

        return self.overdue_seconds > 0 or self.overdue_bucket != "on-time"

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-compatible record without raw case data."""

        return {
            "case_key": self.opaque_case_key,
            "queued_at": self.queued_at,
            "priority": self.priority,
            "age_seconds": self.age_seconds,
            "age_bucket": self.age_bucket,
            "expires_at": self.expires_at,
            "expiry_bucket": self.expiry_bucket,
            "overdue_seconds": self.overdue_seconds,
            "overdue_bucket": self.overdue_bucket,
        }


@dataclass(frozen=True)
class ReviewSLAReport:
    """Counts-only SLA report for one injected point in time."""

    as_of: str
    total_cases: int
    priority_counts: Mapping[str, int]
    age_counts: Mapping[str, int]
    expiry_counts: Mapping[str, int]
    overdue_counts: Mapping[str, int]

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "as_of", _coerce_datetime(self.as_of, "as_of").isoformat()
        )
        if (
            isinstance(self.total_cases, bool)
            or not isinstance(self.total_cases, int)
            or self.total_cases < 0
        ):
            raise ValueError("total_cases must be a non-negative integer")
        for field_name, labels in (
            ("priority_counts", PRIORITY_LEVELS),
            ("age_counts", AGE_BUCKETS),
            ("expiry_counts", EXPIRY_BUCKETS),
            ("overdue_counts", OVERDUE_BUCKETS),
        ):
            counts = getattr(self, field_name)
            normalized: dict[str, int] = {}
            for label in labels:
                value = counts.get(label, 0)
                if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                    raise ValueError("report counts must be non-negative integers")
                normalized[label] = value
            if set(counts) - set(labels):
                raise ValueError("report contains an unsupported bucket")
            if sum(normalized.values()) != self.total_cases:
                raise ValueError("bucket counts must sum to total_cases")
            object.__setattr__(self, field_name, MappingProxyType(normalized))

    @property
    def priority_buckets(self) -> Mapping[str, int]:
        """Alias for priority counts."""

        return self.priority_counts

    @property
    def age_buckets(self) -> Mapping[str, int]:
        """Alias for age counts."""

        return self.age_counts

    @property
    def expiry_buckets(self) -> Mapping[str, int]:
        """Alias for expiry counts."""

        return self.expiry_counts

    @property
    def overdue_buckets(self) -> Mapping[str, int]:
        """Alias for overdue counts."""

        return self.overdue_counts

    def to_dict(self) -> dict[str, Any]:
        """Return the deterministic counts-only report payload."""

        return {
            "schema_version": REVIEW_SLA_SCHEMA_VERSION,
            "as_of": self.as_of,
            "total_cases": self.total_cases,
            "priority_counts": dict(self.priority_counts),
            "age_counts": dict(self.age_counts),
            "expiry_counts": dict(self.expiry_counts),
            "overdue_counts": dict(self.overdue_counts),
        }

    def to_json(self) -> str:
        """Serialize the report with a stable key and bucket order."""

        return json.dumps(
            self.to_dict(),
            allow_nan=False,
            separators=(",", ":"),
        )


def opaque_case_key(
    case_key: str | int,
    *,
    namespace: str = DEFAULT_OPAQUE_KEY_NAMESPACE,
) -> str:
    """Return a stable SHA-256 key without exposing the input value.

    The namespace is part of the digest domain so the same synthetic key can
    be used safely by separate local report types.  Callers that need a
    deployment-specific pseudonym can provide a stable, non-sensitive
    namespace; no random value is generated by default.
    """

    normalized_key = _normalize_case_key(case_key)
    if not isinstance(namespace, str) or not namespace:
        raise ValueError("namespace must be a non-empty string")
    digest = sha256(
        namespace.encode("utf-8") + b"\0" + normalized_key.encode("utf-8")
    ).hexdigest()
    return f"sha256:{digest}"


def compute_review_sla(
    cases: Iterable[ReviewQueueCase | Mapping[str, Any] | object],
    *,
    now: datetime | str | None = None,
    clock: Clock | object | None = None,
    priority_sla: Mapping[str, timedelta | int | float] | None = None,
    namespace: str = DEFAULT_OPAQUE_KEY_NAMESPACE,
) -> tuple[ReviewSLARecord, ...]:
    """Classify queue entries at an explicitly injected point in time.

    Args:
        cases: Queue entries or mappings containing a case key, a
            ``queued_at``/``enqueued_at`` timestamp, and an optional priority.
            Mappings may provide ``expires_at`` or a positive ``sla`` duration
            in seconds.  The input key is hashed and never copied to output.
        now: Fixed clock value.  Mutually exclusive with ``clock``.
        clock: Callable returning a clock value, or an object exposing a
            callable ``now()`` method.  One of ``now`` or ``clock`` is
            required; the system clock is never consulted.
        priority_sla: Optional overrides, in seconds or timedeltas, merged
            with :data:`DEFAULT_PRIORITY_SLA`.
        namespace: Stable digest namespace for opaque case keys.

    Returns:
        De
```

### Core Architecture Module: `openmed/clinical/review_state_machine.py`
```
"""Deterministic, privacy-safe validation for clinical review transitions.

This module models the human-review state machine independently from any
clinical inference.  A transition is accepted only when the configured policy
allows it and the caller supplies an opaque event identifier plus a provenance
fingerprint.  Transition records intentionally contain no reviewer identity,
case content, timestamps, or free-text notes.

The state machine is a local validation primitive.  It makes no network calls,
does not make clinical decisions, and does not imply that a review outcome is
clinically correct.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from enum import Enum
from types import MappingProxyType
from typing import Any, TypeAlias

REVIEW_TRANSITIONS_SCHEMA_VERSION = "openmed.clinical_review_transitions.v1"
REVIEW_TRANSITION_ADVISORY = (
    "Clinical review-state transitions are deterministic assistive workflow "
    "metadata, not a medical-device decision or a substitute for qualified "
    "clinical judgment."
)


class ReviewState(str, Enum):
    """States supported by the guarded clinical review workflow."""

    QUEUED = "queued"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    REOPENED = "reopened"


REVIEW_STATES = tuple(state.value for state in ReviewState)

# The default graph deliberately makes reopening pass through ``reopened`` and
# then ``in_review``.  A previously approved, rejected, or expired result can
# never be approved again without a new review transition.
DEFAULT_REVIEW_TRANSITIONS: Mapping[ReviewState, tuple[ReviewState, ...]] = (
    MappingProxyType(
        {
            ReviewState.QUEUED: (ReviewState.IN_REVIEW, ReviewState.EXPIRED),
            ReviewState.IN_REVIEW: (
                ReviewState.APPROVED,
                ReviewState.REJECTED,
                ReviewState.EXPIRED,
            ),
            ReviewState.APPROVED: (ReviewState.REOPENED,),
            ReviewState.REJECTED: (ReviewState.REOPENED,),
            ReviewState.EXPIRED: (ReviewState.REOPENED,),
            ReviewState.REOPENED: (ReviewState.IN_REVIEW,),
        }
    )
)

_EVENT_ID_RE = re.compile(
    r"^(?:evt_[0-9a-f]{16,128}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-"
    r"[89ab][0-9a-f]{3}-[0-9a-f]{12})$",
    re.IGNORECASE,
)
_FINGERPRINT_RE = re.compile(r"^(?:sha256:)?[0-9a-f]{64}$", re.IGNORECASE)
_IDENTIFIER_RE = re.compile(r"^[a-z][a-z0-9_.:-]{0,63}$")
_REASON_CODE_RE = re.compile(r"^[a-z][a-z0-9_.:-]{0,63}$")


class ReviewTransitionValidationError(ValueError):
    """Raised when a review transition fails a safe workflow invariant.

    The exception message contains only a stable diagnostic code and known
    review-state values.  It never echoes event identifiers, fingerprints,
    policy inputs, reviewer identities, or case content.
    """

    def __init__(
        self,
        code: str,
        *,
        from_state: ReviewState | None = None,
        to_state: ReviewState | None = None,
    ) -> None:
        safe_code = (
            code
            if isinstance(code, str) and _IDENTIFIER_RE.fullmatch(code)
            else "validation_error"
        )
        self.code = safe_code
        self.from_state = from_state
        self.to_state = to_state
        from_value = (
            from_state.value if isinstance(from_state, ReviewState) else "unknown"
        )
        to_value = to_state.value if isinstance(to_state, ReviewState) else "unknown"
        super().__init__(
            "review transition rejected: "
            f"code={safe_code} from_state={from_value} to_state={to_value}"
        )


# Short aliases make the validation error discoverable without duplicating the
# implementation or changing the safe diagnostic contract.
ReviewTransitionError = ReviewTransitionValidationError
TransitionValidationError = ReviewTransitionValidationError


def _coerce_state(
    value: ReviewState | str,
    *,
    from_state: ReviewState | None = None,
    to_state: ReviewState | None = None,
) -> ReviewState:
    if isinstance(value, ReviewState):
        return value
    if isinstance(value, str):
        try:
            return ReviewState(value.strip().casefold())
        except ValueError:
            pass
    raise ReviewTransitionValidationError(
        "invalid_state",
        from_state=from_state,
        to_state=to_state,
    )


def _state_set(
    values: Iterable[ReviewState | str],
    *,
    from_state: ReviewState | None = None,
    to_state: ReviewState | None = None,
) -> frozenset[ReviewState]:
    try:
        return frozenset(
            _coerce_state(
                value,
                from_state=from_state,
                to_state=to_state,
            )
            for value in values
        )
    except TypeError as exc:
        raise ReviewTransitionValidationError(
            "invalid_state_set",
            from_state=from_state,
            to_state=to_state,
        ) from exc


def _normalise_event_id(
    value: object,
    *,
    from_state: ReviewState | None = None,
    to_state: ReviewState | None = None,
) -> str:
    if not isinstance(value, str) or not _EVENT_ID_RE.fullmatch(value):
        raise ReviewTransitionValidationError(
            "opaque_event_id_required",
            from_state=from_state,
            to_state=to_state,
        )
    return value.lower()


def _normalise_fingerprint(
    value: object,
    *,
    from_state: ReviewState | None = None,
    to_state: ReviewState | None = None,
) -> str:
    if not isinstance(value, str) or not _FINGERPRINT_RE.fullmatch(value):
        raise ReviewTransitionValidationError(
            "provenance_fingerprint_required",
            from_state=from_state,
            to_state=to_state,
        )
    digest = value.lower().removeprefix("sha256:")
    return f"sha256:{digest}"


def _normalise_reason(
    value: str | None,
    *,
    from_state: ReviewState | None = None,
    to_state: ReviewState | None = None,
) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not _REASON_CODE_RE.fullmatch(value):
        raise ReviewTransitionValidationError(
            "safe_reason_code_required",
            from_state=from_state,
            to_state=to_state,
        )
    return value.lower()


def _normalise_policy_id(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("policy_id must be a safe identifier")
    normalized = value.strip().casefold()
    if not _IDENTIFIER_RE.fullmatch(normalized):
        raise ValueError("policy_id must be a safe identifier")
    return normalized


def _canonical_bytes(value: Any) -> bytes:
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return value.encode("utf-8")
    try:
        encoded = json.dumps(
            value,
            allow_nan=False,
            ensure_ascii=True,
            separators=(",", ":"),
            sort_keys=True,
        )
    except (TypeError, ValueError) as exc:
        raise ValueError("fingerprint input must be JSON-compatible") from exc
    return encoded.encode("utf-8")


def compute_provenance_fingerprint(provenance: Any) -> str:
    """Return a deterministic SHA-256 fingerprint for safe provenance input.

    The input is hashed and is never retained by this module.  Callers should
    provide only non-sensitive provenance such as a schema version, policy
    identifier, or upstream artifact digest; case contents and reviewer
    identities are not valid provenance payloads for a review record.
    """

    digest = hashlib.sha256(_canonical_bytes(provenance)).hexdigest()
    return f"sha256:{digest}"


def make_opaque_event_id(seed: Any) -> str:
    """Derive a deterministic opaque event identifier from caller input.

    Only the derived token is returned.  The seed is not stored in a review
    record, so callers can use a synthetic sequence or an existing safe event
    digest without introducing free text into the audit surface.
    """

    digest = hashlib.sha256(_canonical_bytes(seed)).hexdigest()
    return f"evt_{digest[:32]}"


# Readable aliases for callers that prefer noun-first helper names.
provenance_fingerprint = compute_provenance_fingerprint
opaque_event_id = make_opaque_event_id
make_event_id = make_opaque_event_id


@dataclass(frozen=True)
class ReviewTransitionRequest:
    """PHI-free inputs presented to a transition policy rule."""

    from_state: ReviewState
    to_state: ReviewState
    event_id: str
    provenance_fingerprint: str
    reason_code: str | None = None

    def __post_init__(self) -> None:
        from_state = _coerce_state(self.from_state)
        to_state = _coerce_state(self.to_state, from_state=from_state)
        event_id = _normalise_event_id(
            self.event_id,
            from_state=from_state,
            to_state=to_state,
        )
        fingerprint = _normalise_fingerprint(
            self.provenance_fingerprint,
            from_state=from_state,
            to_state=to_state,
        )
        reason = _normalise_reason(
            self.reason_code,
            from_state=from_state,
            to_state=to_state,
        )
        object.__setattr__(self, "from_state", from_state)
        object.__setattr__(self, "to_state", to_state)
        object.__setattr__(self, "event_id", event_id)
        object.__setattr__(self, "provenance_fingerprint", fingerprint)
        object.__setattr__(self, "reason_code", reason)

    def to_dict(self) -> dict[str, Any]:
        """Return the safe policy-input representation."""

        return {
            "from_state": self.from_state.value,
            "to_state": self.to_state.value,
            "event_id": self.event_id,
            "provenance_fingerprint": self.provenance_fingerprint,
         
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3730** (2026-10-03): **Declare tomli for Python 3.10 so openmed.clinical and the CLI import on core installs**
  *Symptoms*: ## Problem and existing coverage  `openmed/risk/dependency_report.py` imports `tomllib` with a module-level fallback to `tomli`, but `tomli` is declared only in the `dev` extra. With Python 3.10 and only the core dependencies (`pysbd`, `faker`, `jieba`, `pyyaml`), `import openmed.clinical`, `from openmed.service.brief import brief_response` and the `openmed` console entry point (`openmed --version`) fail with `ModuleNotFoundError: No module named 'tomli'` through `clinical -> care_gaps -> measures -> structured -> risk`. `requires-python` is `>=3.10`; the 3.10 CI lane installs `--extra dev`, the core-wheel import-budget job imports only `openmed` on 3.11, and the publish smoke job also runs on 3.11, so the failure is masked. `openmed/core/config_provenance.py` and `openmed/interop/capabilities.py` already import TOML lazily.  Related work: #3660, #3721, PR #3650. Release scope: #3193.  ## Implementation  - Make the TOML import lazy inside the lock-file parsing functions of `dependency_report.py`, or declare `tomli>=2; python_version < '3.11'` as a core dependency; record the choice in the packaging docs. - Add a base-install lane on the minimum supported Python that installs the built wheel without extras, imports every public subpackage (`openmed.clinical`, `openmed.structured`, `openmed.risk`, `openmed.cli.main`, `openmed.service.brief`) and runs `openmed --version` and `openmed brief --help`. - Add a static check that third-party modules imported at module level are in the

- **Issue #3553** (2026-09-28): **fix: recover punctuation-split structured identifiers**
  *Symptoms*: ## Description Recover punctuation-split structured identifiers in the deterministic safety sweep while keeping spans on the original text and guarding clinical numerics.  ## Type of Change - [x] Bug fix - [x] Documentation update - [x] Test addition/improvement  ## Changes Made - Match bounded SSN, card, MRN, and IBAN shapes containing visible separator mutations. Require SSN and card context, a card or IBAN checksum, or an explicit MRN prefix. - Preserve the full original matched surface and offsets for redaction. - Add synthetic AC-02 recovery, blind-detector critical-leakage, and clinical false-positive regressions; update the threat-model status and residual boundary.  ## Testing - [x] `make format`, `make lint`, `make format-check` - [x] `.venv/bin/python -m pytest tests/unit/security/test_redactor_leakage_bypass.py tests/unit/core -q` — 3,245 passed, 3 skipped on the initial base - [x] `.venv/bin/python -m pytest tests/unit/eval/test_directid_evidence.py tests/unit/eval/test_directid_release.py tests/unit/risk/test_regression_suites.py -q` — 18 passed - [x] `make docs-build` — strict build passed - [x] `.venv/bin/python -m pytest tests/unit/security/test_redactor_leakage_bypass.py tests/unit/core/test_safety_sweep.py tests/unit/core/test_script_detect.py tests/unit/test_pii_i18n.py -q` — 1,036 passed on the refreshed base - [x] `.venv/bin/python -m pytest tests/ -q` — 21,684 passed, 174 skipped on the refreshed base with macOS sysctl access  Tested PR head: `33d1a1f5cc
  **Post-Mortem & Fix Analysis**:
  > Reviewed against #1345 and current master. Fixed two additional split-identifier regressions: MRN colon/hash prefixes now retain the complete source span, and overlong separated digit runs cannot be accepted as partial identifiers. Added eight regression cases.  Validation on exact head 90ddb2f01a0b7e3e816d30dd26116d76daa7902b: canonical format/lint/format-check passed; 63 focused privacy/direct-identifier tests passed; the full offline suite passed 21,878 tests with 174 skips; strict documentation staging passed; both staged-artifact manifest/budget checks passed; repository and license policies passed.  Hosted jobs on this new head are still queued/running; no failing result is reported. Local Python/privacy/docs gates above validate the exact reviewed source. Cross-platform/container/Nix results are not claimed as rerun locally. Master has no required status checks or repository rulesets. This scoped three-file repair is ready for a head-guarded squash merge based on the exact-head 

- **Issue #3542** (2026-09-27): **fix: load prefetched models offline with Transformers 5**
  *Symptoms*: ## Description Fix #1983 for models prefetched into the standard Hugging Face cache when OpenMed runs offline. The earlier resolution claim was premature: the old change handled a verified local path, while the broader cache fix in #2020 was never merged.  ## Type of Change - [x] Bug fix (non-breaking change which fixes an issue) - [x] Test addition/improvement  ## Changes Made - Resolve locally cached Hub snapshots from both the configured OpenMed cache and the standard Hugging Face cache, including a requested revision. - Remove local_files_only from pipeline model_kwargs before passing it to Transformers 5, which already supplies that keyword separately. - Preserve strict integrity behavior so an unverified snapshot cannot bypass require_integrity=True. - Add regression tests for the prefetched-cache path, nested local-only kwargs, revision handling, and strict integrity; update the changelog.  ## Testing - [x] Tests prove the reported failure path and its fix - [x] New and existing unit tests pass locally - [x] Tested model and pipeline loading with a real cached OpenMed PII model - Full suite: 21,542 passed, 217 skipped. - Final focused run: 78 passed. - Real offline smoke: transformers==5.17.0, huggingface-hub==1.33.0, with OPENMED_OFFLINE=1, HF_HUB_OFFLINE=1, and TRANSFORMERS_OFFLINE=1; prefetch_model, load_model, and extract_pii succeeded from a standard Hub cache snapshot and a separate OpenMed cache. - make format, make lint, make format-check, m

- **Issue #2967** (2026-08-26): **Refresh v2.3 wheel-size release budget**
  *Symptoms*: # Pull Request  ## Description Refreshes the committed wheel-size baseline from the v2.2 release-candidate measurement to the exact final v2.3 Linux CI measurement. The existing 10% headroom policy is preserved unchanged.  ## Type of Change - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update - [ ] Code refactoring - [ ] Performance improvement - [x] Test/release-gate repair  ## Changes Made - Set the wheel baseline to the final v2.3 Linux CI measurement: 4,618,352 bytes. - Recalculate the maximum at the existing 10% headroom: 5,080,188 bytes. - Leave package contents, dependencies, and enforcement logic unchanged.  ## Testing - [x] New and existing release unit tests pass locally - [x] Real wheel-size gate passes against the final v2.3 wheel - [x] Built-wheel license policy passes  Commands run:  - python -m pytest tests/unit/release -q — 183 passed - python scripts/release/check_size_budget.py --skip-build --wheel-dir <final-v2.3-wheel> — passed at 4,618,569 / 5,080,188 bytes locally - python scripts/release/check_license_policy.py --wheel <final-v2.3-wheel> — passed  ## Documentation - [x] No documentation change is needed for a release-budget baseline refresh - [ ] I have updated the CHANGELOG.md  ## Code Quality - [x] I have performed a self-review - [x] The committed maximum
  **Post-Mortem & Fix Analysis**:
  > Release-blocker review complete on exact head 91b6e9d81f68f10ddc09b8c404a51042e65c5208. The PR changes only the committed wheel baseline and its derived maximum: 4,618,352 bytes with the existing 10% headroom, yielding 5,080,188 bytes. Package contents, dependencies, and enforcement logic are unchanged. Validation: all 183 release unit tests passed; the real wheel-size gate passed at 4,618,569 / 5,080,188 bytes on the local build; built-wheel license policy passed; diff and ancestry checks are clean; and there are no unresolved review threads. GitHub reports no hosted checks for this head, and the repository has no required status contexts or rulesets. Ready to merge. Closes #2966.

- **Issue #2966** (2026-08-26): **Refresh v2.3 wheel-size release budget**
  *Symptoms*: ## Summary  The final v2.3 package wheel is 4,618,352 bytes in Linux CI, while the committed maximum is 4,483,996 bytes. The current baseline of 4,076,360 bytes was recorded for the v2.2 release candidate and does not include the accepted v2.3 package modules. The release build therefore fails deterministically by 134,356 bytes even though package construction and license checks pass.  ## Acceptance criteria  - Refresh the committed wheel baseline to the exact final v2.3 Linux CI measurement of 4,618,352 bytes. - Preserve the existing 10% headroom policy, with a calculated maximum of 5,080,188 bytes. - Keep package contents and dependencies unchanged. - Pass the focused size-budget tests, wheel build, wheel license policy, and the real size-budget command.  ## Release impact  This is a v2.3 release blocker because the current master build job cannot pass the committed wheel-size gate.

- **Issue #2965** (2026-08-26): **Fix multi-stage container digest policy gate**
  *Symptoms*: # Pull Request  ## Description Updates the container digest policy test for the multi-stage service image introduced in #2947 while strengthening the gate to validate every root Dockerfile stage.  ## Type of Change - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update - [ ] Code refactoring - [ ] Performance improvement - [x] Test addition/improvement  ## Changes Made - Accept a valid alias on the digest-pinned Python build stage. - Parse all root Dockerfile stage images. - Require every parsed stage image to carry a full SHA-256 digest.  ## Testing - [x] I have added tests that prove my fix is effective or that my feature works - [x] New and existing unit tests pass locally with my changes - [ ] I have tested this change with different models/inputs  Commands run:  - `python -m pytest tests/unit/deploy/test_container_multiarch.py -q` — 7 passed - `python -m pytest --last-failed -q` outside the restricted sandbox — 26 passed - `ruff check tests/unit/deploy/test_container_multiarch.py` - `ruff format --check tests/unit/deploy/test_container_multiarch.py`  ## Documentation - [x] No documentation change is needed for this test-only policy repair - [ ] I have added docstrings to new functions/classes - [ ] I have updated the CHANGELOG.md  ## Code Quality - [x] I ran the scoped canonica
  **Post-Mortem & Fix Analysis**:
  > Maintainer completion receipt for exact head `aad67c43f1fac6bdb34209c52080ca346e7c8241`.  - Issue gate: #2964 is maintainer-authored, open in milestone `v2.3`, and the implementation matches its release-blocking acceptance criteria. The PR label union exactly mirrors the issue: `roadmap-v2`, `bug`, `P1`. - Review gate: inspected the PR description, issue, conversation, single owner-authored commit, and complete one-file diff. Normal merge applies. - Repair: the pinned Python-stage policy now accepts a valid Docker stage alias, and the root policy extracts every `FROM` image and requires every stage to carry a full SHA-256 digest. This preserves the existing deployment-image assertion while covering the multi-stage runtime introduced in #2947. - Exact-head validation: full repository suite passed with 13,649 passed and 116 skipped. The focused container policy suite passed 7/7. Ruff check, Ruff format-check, and `git diff --check` passed for the changed file. - Failure classification: t

- **Issue #2964** (2026-08-26): **Fix multi-stage container digest policy gate**
  *Symptoms*: ## Summary  The root service image became a digest-pinned multi-stage Dockerfile in #2947. The existing container policy test still accepts only an unaliased single-stage Python `FROM` line, so the full test suite now fails even though both image stages are pinned.  ## Acceptance criteria  - Accept the digest-pinned Python build stage when it has a valid stage alias. - Parse every root Dockerfile `FROM` instruction and require each stage image to use a full SHA-256 digest. - Preserve the deployment Dockerfile's pinned Python-base assertion. - Pass the focused container policy tests, Ruff, format-check, and the previously failing audit subset.  ## Release impact  This is a v2.3 release blocker because current `master` does not pass the repository's full unit-test policy gate. 

- **Issue #2962** (2026-08-25): **Remove hosted model publication automation**
  *Symptoms*: # Pull Request  ## Description  Removes GitHub-hosted model conversion and Hugging Face publication automation, along with the scheduled model gate and real-model Apple Silicon conversion job. Model release tooling remains available for deliberate local maintainer use on explicitly provisioned hardware.  ## Type of Change  - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [x] Documentation update - [ ] Code refactoring - [ ] Performance improvement - [x] Test addition/improvement  ## Changes Made  - Delete the hosted conversion/publication and nightly release workflows. - Remove the daily release-gate schedule while retaining explicit manual and metadata-only rollback dispatches. - Remove the automatic macOS real-model conversion job while retaining mocked, no-hardware MLX unit coverage. - Document model conversion, evaluation, and publication as explicit local maintainer operations. - Add a workflow-policy regression test that rejects hosted model conversion/publication commands, credentials, environments, and schedules. - Preserve the PyPI publishing workflow and local model release tooling.  ## Testing  - [x] I have added tests that prove my fix is effective or that my feature works - [x] New and existing unit tests pass locally with my changes - [ ] I have tested this change with different models/i
  **Post-Mortem & Fix Analysis**:
  > Reviewed against #2961 and the current `master` branch.  This removes the hosted model conversion/publication workflows, the scheduled model gate, and the real-model macOS conversion job while preserving explicit local release tooling, manual gate dispatch, mocked MLX unit coverage, and the unchanged PyPI publishing workflow.  Validation is complete: 13,108 local tests passed with 130 skips; the focused workflow/release/PyPI safety suite passed; lint, formatting, pre-commit, actionlint, strict docs, package builds, policy scans, and every exact-head hosted check passed. No Hugging Face repository content or visibility was changed.  This satisfies #2961 and is ready to merge. 

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

### Incident Patch 1: `a88fe2fe` (2026-09-29)
**Commit Message**: Add offline clinical brief walkthrough and golden regression (#3613)

* Add native guarded clinical brief interoperability

* Add offline synthetic clinical brief walkthrough

* Invalidate verified brief when source changes

* Account for reviewed brief documentation payload

* Account for measured clinical walkthrough documentation

* Bind citation-support metrics to generated claim spans

* Index the clinical brief walkthrough in the cookbook

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # Changelog
 
+- Add the offline synthetic clinical-brief walkthrough, golden pipeline test,
+  explicit fixture-provider disclaimers and a recording script.
 - Add OpenMedKit guarded clinical-brief packets, local Maple brief generation,
   native leakage/envelope/citation validation and shared Python wire fixtures.
 - Add fail-closed summary release gates, seeded synthetic benchmark execution,
```

**File**: `README.hi.md` (modified, +19/-0)
```diff
@@ -89,6 +89,25 @@ for entity in result.entities:
 
 ---
 
+## 30 सेकंड में क्लिनिकल सारांश का उदाहरण
+
+सोर्स चेकआउट से केवल CPU पर चलने वाला सिंथेटिक इंटरफ़ेस प्रदर्शन चलाएँ:
+
+```bash
+python examples/v30_clinical_brief.py
+# वैकल्पिक: --model mlx; Apple silicon पर निश्चित मॉडल पहले से कैश होना चाहिए।
+```
+
+यह अंतर्निहित नोट का डी-आइडेंटिफिकेशन, एंटिटी निष्कर्षण और कॉन्सेप्ट मिलान करके
+स्रोत-संदर्भ वाला सारांश, सत्यापन परिणाम और मूल मानों के बिना समीक्षा पैकेट दिखाता है।
+**NER/NLI प्रदाता स्पष्ट रूप से सिंथेटिक टेस्ट डबल हैं; ये प्रशिक्षित मॉडल या
+क्लिनिकल सत्यापन नहीं हैं।** बाहरी नोट इनपुट स्वीकार नहीं किया जाता। MLX असमर्थित
+आउटपुट को अस्वीकार कर सकता है; सुरक्षा जाँच कभी नहीं छोड़ी जाती।
+[सारांश गाइड](docs/clinical/clinical-brief.md) और
+[डेमो स्क्रिप्ट](docs/demo/clinical-brief.md) में सीमाएँ और स्थानीय सेटअप देखें।
+
+---
+
 ## एजेंट के साथ बना रहे हैं?
 
 [उपभोक्ता एजेंट-उपयोग गाइड](docs/agent-usage.md) से शुरू करें या चुनी हुई
```

**File**: `README.md` (modified, +18/-0)
```diff
@@ -89,6 +89,24 @@ A clinical NER model using the local runtime after its required artifacts are av
 
 ---
 
+## Clinical brief in 30 seconds
+
+From a source checkout, run the CPU-only synthetic contract demonstration:
+
+```bash
+python examples/v30_clinical_brief.py
+# Optional: --model mlx, with the pinned model already cached on Apple silicon.
+```
+
+It de-identifies an embedded note, extracts and grounds a finding, then prints
+a cited brief, verdicts and a value-free review packet. **NER/NLI providers are
+explicit synthetic test doubles, not trained-model or clinical validation.**
+No external note input is accepted. The MLX option may refuse unsupported output;
+it never bypasses the guards. See the [brief guide](docs/clinical/clinical-brief.md)
+and [demo script](docs/demo/clinical-brief.md) for the boundaries and local setup.
+
+---
+
 ## Building with an agent?
 
 Start with the [consumer agent-usage guide](docs/agent-usage.md), or load the
```

**File**: `README.sw.md` (modified, +20/-0)
```diff
@@ -89,6 +89,26 @@ Modeli ya NER ya kliniki hutumia runtime ya ndani baada ya vipengee vinavyohitaj
 
 ---
 
+## Mfano wa muhtasari wa kliniki kwa sekunde 30
+
+Kutoka kwenye nakala ya msimbo, endesha onyesho la mikataba ya kiolesura kwa data
+sintetiki kwa kutumia CPU pekee:
+
+```bash
+python examples/v30_clinical_brief.py
+# Hiari: --model mlx; modeli ya toleo lililowekwa ihifadhiwe mapema kwenye Apple silicon.
+```
+
+Mfano huondoa utambulisho kwenye dokezo lililojumuishwa, hutoa na kuoanisha dhana,
+kisha huonyesha muhtasari wenye marejeo, matokeo ya ukaguzi na pakiti ya mapitio
+isiyo na thamani ghafi. **Watoa huduma wa NER/NLI ni vibadala vya majaribio ya
+data sintetiki, si modeli zilizofunzwa wala uthibitisho wa kliniki.** Haukubali
+madokezo ya nje. MLX inaweza kukataa matokeo yasiyoungwa mkono; haipiti ukaguzi
+wa usalama. Angalia [mwongozo](docs/clinical/clinical-brief.md) na
+[hati ya onyesho](docs/demo/clinical-brief.md) kwa mipaka na usanidi wa ndani.
+
+---
+
 ## Unajenga kwa wakala?
 
 Anza na [mwongozo wa matumizi ya wakala](docs/agent-usage.md), au pakia
```

**File**: `README.zh-CN.md` (modified, +17/-0)
```diff
@@ -89,6 +89,23 @@ for entity in result.entities:
 
 ---
 
+## 30 秒运行临床摘要示例
+
+在源码检出目录中运行仅使用 CPU 的合成数据接口演示：
+
+```bash
+python examples/v30_clinical_brief.py
+# 可选：--model mlx，需要在 Apple 芯片设备上预先缓存固定版本的模型。
+```
+
+该示例对内置记录进行去标识化、实体抽取和概念匹配，然后输出带来源引用的摘要、
+核验结果和不含原始值的审核包。**NER/NLI 提供程序是明确标注的合成测试替身，
+不是经过训练的模型，也不代表临床验证。** 不接受外部记录输入。
+MLX 输出若缺乏证据支持会被拒绝，不会绕过保护检查。
+详见[摘要指南](docs/clinical/clinical-brief.md)和[演示脚本](docs/demo/clinical-brief.md)。
+
+---
+
 ## 使用智能体构建？
 
 请从[面向使用者的智能体指南](docs/agent-usage.md)开始，或加载精选的
```

**File**: `docs/brand/system/publication.yml` (modified, +1/-0)
```diff
@@ -265,6 +265,7 @@ classification:
     - clinical/relation-deduplication.md
     - clinical/summary-section-planning.md
     - clinical/clinical-brief.md
+    - demo/clinical-brief.md
     - clinical/summary-template-profiles.md
     - clinical/summary-length-budgets.md
     - clinical/summary-empty-evidence.md
```

**File**: `docs/clinical/clinical-brief.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # Guarded clinical brief
 
+Start with the [local summarizer](summarization.md), the
+[clinical NLI gate](nli-verification.md), and the
+[synthetic walkthrough and recording script](../demo/clinical-brief.md).
+
 `openmed.clinical.build_clinical_brief()` composes the existing local clinical
 guards into an immutable `ClinicalBrief`. It never treats a generated summary as
 a diagnosis or as approval to act. Successful results still need human review.
```

**File**: `docs/cookbook.md` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ using the same workflow with real data.
 
 | Use when you want to... | Script |
 | --- | --- |
+| Build a cited synthetic brief offline with explicitly labelled fixture NER/NLI providers | [`examples/v30_clinical_brief.py`](https://github.com/maziyarpanahi/openmed/blob/master/examples/v30_clinical_brief.py) |
 | Compare clinical and biomedical NER families | [`examples/clinical_ner_families.py`](https://github.com/maziyarpanahi/openmed/blob/master/examples/clinical_ner_families.py) |
 | Redact, extract, and build a FHIR Bundle | [`examples/first_five_minutes_redact_extract_fhir.py`](https://github.com/maziyarpanahi/openmed/blob/master/examples/first_five_minutes_redact_extract_fhir.py) |
 | Export grounded spans for FHIR and OMOP workflows | [`examples/interop_fhir_export.py`](https://github.com/maziyarpanahi/openmed/blob/master/examples/interop_fhir_export.py) |
```

---

### Incident Patch 2: `3cb7c28d` (2026-09-28)
**Commit Message**: Update registry assertions for explicit suite tasks

**File**: `tests/unit/clinical/grounding/test_calibration.py` (modified, +1/-0)
```diff
@@ -188,6 +188,7 @@ def test_grounding_calibration_suite_reads_local_gold_and_writes_report(
     assert len(load_suite_fixtures(GROUNDING_CALIBRATION, path=gold_path)) == 2
     assert suite_metadata(GROUNDING_CALIBRATION, gold_path=gold_path) == {
         "suite": GROUNDING_CALIBRATION,
+        "task": "grounding_calibration",
         "offline": True,
         "gold_path": str(gold_path),
     }
```

**File**: `tests/unit/eval/suites/test_temporal_consistency.py` (modified, +4/-1)
```diff
@@ -115,7 +115,10 @@ def test_registry_selects_temporal_consistency_suite() -> None:
     assert load_suite_fixtures(TEMPORAL_CONSISTENCY) == list(
         load_temporal_consistency_fixtures()
     )
-    assert suite_metadata(TEMPORAL_CONSISTENCY) == temporal_consistency_metadata()
+    assert suite_metadata(TEMPORAL_CONSISTENCY) == {
+        **temporal_consistency_metadata(),
+        "task": "temporal_assertion_consistency",
+    }
 
 
 def test_shared_harness_runs_temporal_consistency_suite() -> None:
```

**File**: `tests/unit/eval/test_domain_coverage.py` (modified, +4/-1)
```diff
@@ -230,7 +230,10 @@ def test_orphan_label_fails_and_report_never_contains_fixture_text(
 
 def test_suite_registry_and_metadata_are_discoverable() -> None:
     assert validate_suite_name(CLINICAL_DOMAIN_COVERAGE) == CLINICAL_DOMAIN_COVERAGE
-    assert suite_metadata(CLINICAL_DOMAIN_COVERAGE) == domain_coverage_metadata()
+    assert suite_metadata(CLINICAL_DOMAIN_COVERAGE) == {
+        **domain_coverage_metadata(),
+        "task": "clinical_domain_coverage",
+    }
     with pytest.raises(ValueError, match="aggregate gate"):
         load_suite_fixtures(CLINICAL_DOMAIN_COVERAGE)
 
```

---

### Incident Patch 3: `0ac068f9` (2026-09-28)
**Commit Message**: Merge pull request #3475 from maziyarpanahi/feature/v3-schema-guided-extraction

feat: add schema-guided JSON extraction

**File**: `docs/brand/system/publication.yml` (modified, +1/-0)
```diff
@@ -295,6 +295,7 @@ classification:
     - clinical/relation-unit-compatibility.md
     - clinical/sig-parser.md
     - clinical/summarization.md
+    - structured/schema-guided-extraction.md
     - medical-tokenizer.md
     - indic-normalization.md
     - configuration.md
```

**File**: `docs/structured/schema-guided-extraction.md` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+# Schema-Guided JSON Extraction
+
+`openmed.structured.extract_to_schema` projects a clinical note onto a
+caller-supplied **target schema**: you declare the fields you want and their
+types, and the API returns a typed JSON object plus per-field source offsets.
+It binds material that has *already* been detected -- named entities, inline
+`key: value` lines, and reconstructed table cells -- to the schema slots,
+coercing each raw value to the declared type. It performs no model inference and
+no free-form extraction; everything is deterministic and offline.
+
+## The target schema
+
+The schema is a small, standard subset of JSON Schema: a top-level object with
+`properties` and an optional `required` list. Each property declares one scalar
+`type` -- `string`, `integer`, `number`, or `boolean`. Unsupported validation
+keywords raise `SchemaDefinitionError` rather than being silently ignored.
+
+Extraction hints ride along as extension keywords that a standard JSON Schema
+validator ignores:
+
+| Keyword | Meaning |
+| --- | --- |
+| `aliases` | Alternative slot labels to match in `key: value` lines and table rows, in addition to the humanized field name. |
+| `entity` | An entity label (or list of labels) to bind from detected entities. |
+| `enum` | The permitted values must match the slot type. String matching is case-insensitive and returns the canonical spelling. |
+| `pattern` | A regular expression the raw value must fully match. |
+
+```python
+schema = {
+    "type": "object",
+    "required": ["patient_age", "sex"],
+    "properties": {
+        "patient_age": {"type": "integer", "aliases": ["age"]},
+        "sex": {"type": "string", "enum": ["Male", "Female"]},
+        "temperature": {"type": "number", "aliases": ["temp"]},
+        "smoker": {"type": "boolean", "aliases": ["current smoker"]},
+        "facility": {"type": "string", "entity": "HOSPITAL"},
+    },
+}
+```
+
+## Extracting
+
+```python
+from openmed.structured import extract_to_schema
+
+note = (
+    "Patient Age: 54 years\n"
+    "Sex: Female\n"
+    "Temperature: 37.8 C\n"
+    "Current Smoker: no\n"
+)
+
+result = extract_to_schema(note, schema)
+
+result["data"]
+# {'patient_age': 54, 'sex': 'Female', 'temperature': 37.8, 'smoker': False}
+
+result["missing_required"]
+# []  (both required slots filled)
+```
+
+Detected entities and reconstructed tables are passed alongside the text and
+take priority over inline text:
+
+```python
+entities = [{"label": "HOSPITAL", "text": "Mercy General", "start": 8, "end": 21}]
+result = extract_to_schema(note, schema, entities=entities, tables=tables)
+```
+
+## What comes back
+
+`extract_to_schema` returns a `SchemaExtraction` mapping:
+
+- **`data`** -- the validated object. Only slots that filled *and* passed
+  coercion and constraint checks appear here, so its values always conform to
+  the declared types.
+- **`bindings`** -- per-field provenance: the coerced `value`, the `raw`
+  substring, its `start`/`end` offsets into the source text, and the `source`
+  (`entity`, `table`, or `key_value`).
+- **`missing_required`** -- required slots that no source filled (or whose only
+  candidate failed validation). These are reported, never silently dropped.
+- **`missing_required_details`** -- each missing field with its declared
+  `expected_type`, so partial results remain inspectable without guessing the
+  intended value type.
+- **`errors`** -- candidate values that were found but rejected, each with the
+  reason, the raw text, and its offsets.
+
+## Determinism and precedence
+
+For every slot the sources are consulted in a fixed priority order --
+**entities, then table cells, then inline `key: value` lines** -- and the first
+source to yield a candidate wins. Within a single source, the earliest offset in
+the document wins. The same inputs therefore always produce the same object.
+
+A malformed *schema* raises `SchemaDefinitionError`. A malformed or empty
+*document* never raises: partial extraction always returns a result, with the
+gaps recorded in `missing_required` and `errors`.
+
+`data`, `bindings`, and `errors` contain extracted values in memory. Keep the
+result inside the caller's protected workflow; do not write those values to
+logs or audit artifacts.
+
+## Bounded extraction
+
+Notes are limited to 1 MiB, input collections and table cells to 4,096 entries,
+and candidate values to 4,096 characters. Invalid or oversized source iterables
+are reported as value-free entries in `errors` (empty field/raw and zero offsets);
+other valid sources can still fill slots. Duplicate table coordinates are
+rejected instead of being resolved by input order. Numeric ranges, fractions,
+scientific notation and multiple numeric tokens are not guessed or truncated.
+
+Schemas allow at most 256 properties/aliases/enum values. Regex patterns are
+limited to 256 characters and a non-branching subset: literals, anchors, character
+classes, exact repetitions up to 256
```

**File**: `mkdocs.yml` (modified, +1/-0)
```diff
@@ -220,6 +220,7 @@ nav:
       - Quantitative Relation Unit Compatibility: clinical/relation-unit-compatibility.md
       - Medication Sig Parser: clinical/sig-parser.md
       - Post-de-identification Summarization: clinical/summarization.md
+      - Schema-Guided JSON Extraction: structured/schema-guided-extraction.md
       - Medical Tokenizer: medical-tokenizer.md
       - Indic Unicode Normalization: indic-normalization.md
       - Configuration & Validation: configuration.md
```

**File**: `openmed/structured/__init__.py` (modified, +22/-0)
```diff
@@ -332,6 +332,18 @@
     TableRoleScan,
 )
 from .scan import scan_table as scan_column_roles
+from .schema_extract import (
+    SCHEMA_EXTRACT_ADVISORY,
+    FieldBinding,
+    FieldSource,
+    MissingRequiredField,
+    ScalarType,
+    SchemaDefinitionError,
+    SchemaExtraction,
+    SchemaValidationIssue,
+    extract_to_schema,
+    normalize_field_key,
+)
 from .schema_policy import (
     ACTION_DATE_SHIFT,
     ACTION_DEIDENTIFY,
@@ -841,4 +853,14 @@
     "write_table",
     "structured_privacy_fixture",
     "validate_schema_policy",
+    "SCHEMA_EXTRACT_ADVISORY",
+    "FieldBinding",
+    "FieldSource",
+    "MissingRequiredField",
+    "ScalarType",
+    "SchemaDefinitionError",
+    "SchemaExtraction",
+    "SchemaValidationIssue",
+    "extract_to_schema",
+    "normalize_field_key",
 ]
```

**File**: `openmed/structured/schema_extract.py` (added, +688/-0)
```diff
@@ -0,0 +1,688 @@
+"""Schema-guided JSON extraction (roadmap section 4.2).
+
+Consumers frequently need a document reduced to a fixed JSON shape: a target
+schema declares the fields and their types, and the note must be projected onto
+those typed slots deterministically. This module binds already-detected material
+-- named entities, inline ``key: value`` pairs, and reconstructed table cells --
+to the slots of a caller-supplied JSON Schema, coercing each raw value to the
+declared type and recording the character offsets it came from.
+
+The schema is a small, standard subset of JSON Schema: a top-level object with
+``properties`` (each carrying a scalar ``type`` of ``string``/``integer``/
+``number``/``boolean``) and an optional ``required`` list. Extraction hints ride
+along as extension keywords that a standard validator ignores: ``aliases`` lists
+alternative slot labels, ``entity`` names an entity label to bind, ``pattern`` is
+a full-match constraint, and ``enum`` restricts the allowed values. A malformed
+*schema* raises ``SchemaDefinitionError``; a malformed *document* never raises --
+unfilled required slots and per-field coercion failures are reported instead, so
+partial extraction always yields a result. Extraction is deterministic and
+offline: no network, no model inference, and a fixed source-priority and
+source-order tie-break so the same inputs always produce the same object.
+"""
+
+from __future__ import annotations
+
+import re
+from collections.abc import Iterable, Mapping
+from functools import wraps
+from itertools import islice
+from math import isfinite
+from typing import Any, Literal, TypedDict
+
+SCHEMA_EXTRACT_ADVISORY = (
+    "Schema-guided extraction binds already-detected entities, key-value pairs "
+    "and table cells to declared JSON slots deterministically, coercing to the "
+    "declared type and keeping source offsets. It does not perform free-form or "
+    "model-based extraction and never invents values for unfilled slots."
+)
+
+ScalarType = Literal["string", "integer", "number", "boolean"]
+FieldSource = Literal["entity", "table", "key_value"]
+
+_SCALAR_TYPES: frozenset[str] = frozenset({"string", "integer", "number", "boolean"})
+_ROOT_SCHEMA_KEYS = frozenset(
+    {
+        "$schema",
+        "$id",
+        "title",
+        "description",
+        "type",
+        "properties",
+        "required",
+        "additionalProperties",
+    }
+)
+_FIELD_SCHEMA_KEYS = frozenset(
+    {"title", "description", "type", "aliases", "entity", "enum", "pattern"}
+)
+# Sources are consulted in this fixed order; the first source that yields a
+# candidate for a slot wins, and within a source the earliest source offset wins.
+_SOURCE_PRIORITY: tuple[FieldSource, ...] = ("entity", "table", "key_value")
+
+# One inline ``Key: Value`` line. The key is a short label of letters, digits and
+# a few separators; the value is the remainder of the line.
+_KEY_VALUE_RE = re.compile(
+    r"^[ \t]*(?P<key>[A-Za-z][A-Za-z0-9 /_.-]*?)[ \t]*[:：][ \t]*(?P<value>\S.*?)[ \t]*$"
+)
+# Match one complete decimal token without accepting a prefix of a malformed
+# decimal such as ``3,5``. Integer slots inspect the same token and reject a
+# fractional value instead of silently truncating it.
+_NUMBER_TOKEN_RE = re.compile(r"(?<![\d.,])[+-]?\d+(?:\.\d+)?(?![\d.,])")
+_TRUE_TOKENS = frozenset({"true", "yes", "y", "positive", "present", "1"})
+_FALSE_TOKENS = frozenset({"false", "no", "n", "negative", "absent", "0"})
+
+
+class SchemaDefinitionError(ValueError):
+    """Raised when the supplied target schema is itself malformed."""
+
+
+class FieldBinding(TypedDict):
+    """A filled slot with its coerced value and source provenance."""
+
+    field: str
+    value: Any
+    raw: str
+    start: int
+    end: int
+    source: FieldSource
+
+
+class SchemaValidationIssue(TypedDict):
+    """A candidate value that was found but failed to satisfy the slot."""
+
+    field: str
+    reason: str
+    raw: str
+    start: int
+    end: int
+    source: FieldSource
+
+
+class MissingRequiredField(TypedDict):
+    """An unfilled required slot and its declared scalar type."""
+
+    field: str
+    expected_type: ScalarType
+
+
+class SchemaExtraction(TypedDict):
+    """The projection of a note onto a target schema.
+
+    ``data`` holds only slots that filled and validated, so its values conform to
+    the declared types and constraints. ``bindings`` carries per-field source
+    provenance for those same slots. ``missing_required`` lists required slots
+    that no source filled, and ``missing_required_details`` keeps each slot's
+    expected scalar type. ``errors`` lists candidate values that were found but
+    rejected -- neither is silently dropped.
+    """
+
+    data: dict[str, Any]
+    bindings: dict[str, FieldBinding]
+    missing_required: list[str]
+    missing_required_details: list[MissingRequiredField]
+    errors: list[SchemaValidationIssue]
+
+
+class _Candidate(TypedDict):
+  
```

**File**: `tests/browser/brand/budgets.json` (modified, +5/-4)
```diff
@@ -1,8 +1,8 @@
 {
   "schema_version": 2,
   "artifact": {
-    "maximum_total_bytes": 91057780,
-    "maximum_unique_payload_bytes": 90693267,
+    "maximum_total_bytes": 91301710,
+    "maximum_unique_payload_bytes": 90937197,
     "maximum_duplicate_payload_bytes": 458752,
     "maximum_source_map_files": 0
   },
@@ -12,13 +12,13 @@
     "html": 2359296,
     "image": 262144,
     "javascript": 716800,
-    "json": 4406142
+    "json": 4413273
   },
   "governed_payload_bytes": {
     "docs/assets/javascripts/lunr/wordcut.js": 716800,
     "docs/model-tokenizer-script-coverage/index.html": 2359296,
     "docs/model-tokenizer-script-coverage.json": 1572864,
-    "docs/search/search_index.json": 4406142
+    "docs/search/search_index.json": 4413273
   },
   "route_transfer_bytes": {
     "/": 3145728,
@@ -31,6 +31,7 @@
     "representative_interaction_latency_ms": 200
   },
   "notes": [
+    "The reviewed schema-guided extraction build measures 91186224 total bytes, 90821711 unique bytes, and 4407481 search bytes. Ceilings retain the prior 115486-byte aggregate and 5792-byte search allowances; other limits are unchanged.",
     "The reviewed document-routing evaluation stack build measures 90942294 total bytes, 90577781 unique bytes, and 4400350 search bytes. Ceilings retain the prior 115486-byte aggregate and 5792-byte search allowances; other limits are unchanged.",
     "The combined OCR geometry and layout build measures 90485620 total bytes, 90121107 unique bytes, and 4389641 search bytes. Ceilings retain the prior 115486-byte aggregate and 5792-byte search allowances; other limits are unchanged.",
     "The validated OCR clinical layout build measures 90263261 total bytes, 89898748 unique bytes, and 4387239 search bytes. Ceilings retain the prior 115486-byte aggregate and 5792-byte search allowances; other limits are unchanged.",
```

**File**: `tests/unit/structured/test_schema_extract.py` (added, +442/-0)
```diff
@@ -0,0 +1,442 @@
+"""Tests for the schema-guided JSON extraction API."""
+
+from __future__ import annotations
+
+from typing import Any
+
+import pytest
+from jsonschema import Draft202012Validator
+
+from openmed.structured.schema_extract import (
+    SCHEMA_EXTRACT_ADVISORY,
+    SchemaDefinitionError,
+    extract_to_schema,
+    normalize_field_key,
+)
+
+# A synthetic clinical note built so every value can be located by ``str.index``
+# rather than a hand-counted offset. No real patient data is used.
+NOTE = (
+    "Chief Complaint: cough\n"
+    "Patient Age: 54 years\n"
+    "Sex: Female\n"
+    "Temperature: 37.8 C\n"
+    "Current Smoker: no\n"
+    "MRN: 481529\n"
+)
+
+SCHEMA: dict[str, Any] = {
+    "type": "object",
+    "required": ["patient_age", "sex", "diagnosis"],
+    "properties": {
+        "patient_age": {"type": "integer", "aliases": ["age"]},
+        "sex": {"type": "string", "enum": ["Male", "Female"]},
+        "temperature": {"type": "number", "aliases": ["temp"]},
+        "smoker": {"type": "boolean", "aliases": ["current smoker"]},
+        "mrn": {"type": "string", "pattern": r"\d{6}"},
+        "diagnosis": {"type": "string"},
+    },
+}
+
+
+def _span(text: str, value: str) -> tuple[int, int]:
+    start = text.index(value)
+    return start, start + len(value)
+
+
+# --------------------------------------------------------------------------
+# Key-value binding, coercion and offset provenance
+# --------------------------------------------------------------------------
+
+
+def test_returns_schema_valid_object_with_typed_values():
+    result = extract_to_schema(NOTE, SCHEMA)
+
+    assert result["data"]["patient_age"] == 54
+    assert result["data"]["sex"] == "Female"
+    assert result["data"]["temperature"] == 37.8
+    assert result["data"]["smoker"] is False
+    assert result["data"]["mrn"] == "481529"
+
+
+def test_each_filled_field_carries_source_offsets():
+    result = extract_to_schema(NOTE, SCHEMA)
+
+    for field, raw in (
+        ("patient_age", "54 years"),
+        ("sex", "Female"),
+        ("temperature", "37.8 C"),
+        ("mrn", "481529"),
+    ):
+        binding = result["bindings"][field]
+        start, end = _span(NOTE, raw)
+        assert (binding["start"], binding["end"]) == (start, end)
+        assert NOTE[binding["start"] : binding["end"]] == binding["raw"]
+        assert binding["source"] == "key_value"
+
+
+def test_aliases_match_alternative_labels():
+    schema = {"properties": {"age": {"type": "integer", "aliases": ["patient age"]}}}
+    result = extract_to_schema(NOTE, schema)
+
+    assert result["data"]["age"] == 54
+
+
+# --------------------------------------------------------------------------
+# Missing required slots and validation failures are reported, not dropped
+# --------------------------------------------------------------------------
+
+
+def test_missing_required_field_is_reported():
+    result = extract_to_schema(NOTE, SCHEMA)
+
+    # ``diagnosis`` is required but appears nowhere in the note.
+    assert "diagnosis" in result["missing_required"]
+    assert result["missing_required_details"] == [
+        {"field": "diagnosis", "expected_type": "string"}
+    ]
+    assert "diagnosis" not in result["data"]
+
+
+def test_coercion_failure_is_reported_and_slot_left_unfilled():
+    text = "Patient Age: unknown\nSex: Female\nDiagnosis: asthma\n"
+    result = extract_to_schema(text, SCHEMA)
+
+    assert "patient_age" not in result["data"]
+    assert "patient_age" in result["missing_required"]
+    issue = next(e for e in result["errors"] if e["field"] == "patient_age")
+    assert issue["reason"] == "expected an integer value"
+    assert issue["raw"] == "unknown"
+    assert text[issue["start"] : issue["end"]] == "unknown"
+
+
+@pytest.mark.parametrize("raw", ["3.9", "3,5"])
+def test_integer_coercion_rejects_fractional_values_instead_of_truncating(raw):
+    text = f"Stage: {raw}\n"
+    schema = {
+        "required": ["stage"],
+        "properties": {"stage": {"type": "integer"}},
+    }
+
+    result = extract_to_schema(text, schema)
+
+    assert "stage" not in result["data"]
+    assert result["missing_required"] == ["stage"]
+    assert result["errors"][0]["reason"] == "expected an integer value"
+    assert result["errors"][0]["raw"] == raw
+
+
+def test_pattern_violation_is_reported():
+    text = "MRN: 12AB\n"
+    schema = {"properties": {"mrn": {"type": "string", "pattern": r"\d{6}"}}}
+    result = extract_to_schema(text, schema)
+
+    assert "mrn" not in result["data"]
+    assert result["errors"][0]["reason"] == "value does not match required pattern"
+
+
+def test_enum_violation_is_reported():
+    text = "Sex: Unspecified\n"
+    schema = {"properties": {"sex": {"type": "string", "enum": ["Male", "Female"]}}}
+    result = extract_to_schema(text, schema)
+
+    assert "sex" not in result["data"]
+    assert result["errors"][0]["reason"] == (
+        "value is not one of the permitted enu
```

---

### Incident Patch 4: `d0df2391` (2026-09-28)
**Commit Message**: Complete clinical document routing and regression evaluation (#3593)

* Route discharge extraction by note type (#3474)

* feat: route discharge extraction by note type

* fix: make clinical routing abstain on invalid confidence and empty spans

* Record measured note-routing documentation budget

* Add bounded clinical document fixture generators (#2488)

* feat: add synthetic clinical fixture generator

* fix: calibrate clinical fixture documentation budget

* fix: validate synthetic fixture imports and safe artifact boundaries

* Record validated synthetic fixture documentation budget

---------

Co-authored-by: Maziyar Panahi <[REDACTED_EMAIL]>

* Add bounded OCR and note-routing evaluation (#2441)

* feat: add OCR routing evaluation harness

* feat: add synthetic clinical fixture generator

* feat: normalize OCR box coordinates

* feat: add OCR page rotation transforms

* fix: preserve artifact bytes in SDK readiness fixtures

* feat: route discharge extraction by note type

* fix: keep OCR page size exports distinct

* feat: reconstruct clinical layout from OCR boxes

* fix: validate OCR layout geometry inputs

* fix: infer isolated OCR bands without page metadata

* fix: sco

**File**: `docs/brand/system/publication.yml` (modified, +2/-0)
```diff
@@ -409,8 +409,10 @@ classification:
     - export-awq.md
     - export-gptq.md
     - export-gguf.md
+    - evaluation/clinical-fixtures.md
     - multimodal/box-normalization.md
     - multimodal/page-rotation.md
+    - evaluation/ocr-routing.md
     - multimodal/dicom-sr-provenance.md
     - clinical/lab-reference-ranges.md
     - clinical/lab-measurements.md
```

**File**: `docs/clinical/note-routing.md` (modified, +40/-0)
```diff
@@ -72,3 +72,43 @@ The router itself is deterministic, rules-first, and offline. It does not load
 a model, fetch terminology, read credentials, or make a mandatory network
 call. It is assistive extraction plumbing and does not make clinical
 decisions.
+
+## Route extraction by document type
+
+`openmed.clinical.routing` uses the local `classify_document` result to select
+radiology, pathology, or discharge-summary extraction scopes. The discharge
+route reuses the existing discharge profile's source section boundaries for
+diagnoses, procedures, medications, follow-up, and instructions. Medication
+candidates stay in discharge medications; problem mentions stay in discharge
+diagnoses. Every route includes the selected profile, classifier confidence,
+and a fallback reason when routing abstains.
+
+```python
+from openmed.clinical.routing import build_extraction_plan
+
+plan = build_extraction_plan(
+    "DISCHARGE SUMMARY\nDischarge Medications:\n- Synthetic tablet 5 mg daily.",
+)
+assert plan.profile.name == "discharge_summary"
+assert plan.routing_provenance.fallback_reason is None
+```
+
+Unknown labels and invalid or low-confidence predictions use the generic pass-through
+profile. The generic route keeps the existing entity list and order. The
+specialized profiles reject zero-length entities and retain absolute source offsets and do not infer clinical
+decisions.
+
+The committed synthetic fixture harness in
+`tests/unit/clinical/test_note_type_routing.py` compares unscoped candidate
+entities with routed stage inputs. It includes one deliberate irrelevant
+candidate per document type and uses exact span identity as the match key:
+
+| Synthetic type | Unscoped entity F1 | Routed entity F1 | Gain |
+| --- | ---: | ---: | ---: |
+| Radiology | 0.80 | 1.00 | +0.20 |
+| Pathology | 0.86 | 1.00 | +0.14 |
+| Discharge summary | 0.80 | 1.00 | +0.20 |
+
+These are deterministic fixture checks of routing precision, not estimates of
+clinical accuracy. The fixtures contain only synthetic text and no restricted
+corpus material.
```

**File**: `docs/evaluation/clinical-fixtures.md` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+# Synthetic clinical fixture generator
+
+`openmed.eval.clinical_fixtures` provides small, deterministic documents for
+offline extraction-profile evaluation. The generator uses only the Python
+standard library; it does not download models, terminology, or datasets and it
+does not modify global random state.
+
+These are synthetic evaluation inputs, not clinical ground truth, a medical
+device, or a substitute for qualified clinical judgment.
+
+## Generate fixtures
+
+```python
+from openmed.eval.clinical_fixtures import generate_fixtures
+
+fixtures = generate_fixtures(
+    profiles=("progress_note", "radiology_report"),
+    seed=17,
+)
+
+fixture = fixtures[0]
+document = fixture.text  # Pass to a local extraction runner.
+gold_spans = fixture.gold_spans
+expected_fields = fixture.expected_structured_fields
+```
+
+The canonical profiles are:
+
+| Profile | Coverage |
+|---|---|
+| `progress_note` | history, negation, historical context, assessment, and plan |
+| `radiology_report` | indication, modality, anatomy, findings, and uncertainty |
+| `lab_report` | coded test, quantity, unit, and interpretation |
+| `discharge_summary` | diagnosis, absent finding, medication, and follow-up |
+| `pathology_report` | specimen, microscopy, and diagnostic uncertainty |
+
+`generic`, `clinical_note`, `radiology`, `lab`, `discharge`, `progress`, and
+`pathology` are accepted as short aliases. A profile-specific derivation of the
+requested seed makes each document stable even when the order of a selected
+profile list changes.
+
+## Gold contract
+
+Each `GoldSpan` contains `start` and `end` character offsets, a label, its
+section, assertion axes, and an optional `CodedValue`. It intentionally does
+not require a copied mention string for scoring. `fixture.span_text(span)` is
+available when a local model test needs the in-memory substring.
+
+Codes use the `openmed.synthetic` system and local code tokens. They exercise
+code-system and code propagation without bundling a restricted terminology
+vocabulary or making a network call.
+
+`ExpectedField` records link structured output expectations to span IDs. This
+keeps field assertions traceable without duplicating source text. The fixture
+validates that section ranges, span ranges, and field references are
+consistent when it is created.
+
+## Privacy-safe artifacts
+
+`fixture.to_dict()` and `fixture.to_json()` omit the document and span text by
+default. They retain only offsets, labels, assertion axes, code identities (without display text), field
+references, synthetic metadata, and a `sha256:` document fingerprint; scalar
+field values are also omitted. This is the safe form for reports, logs, and
+audit artifacts:
+
+```python
+safe_report = fixture.to_dict()
+assert "text" not in safe_report
+```
+
+`include_text=True` is an explicit local round-trip opt-in that also retains
+scalar expected-field values. Do not use that form for reports or logs. The
+committed tests and generated metadata are synthetic-only and mark
+`synthetic=True` and `phi=False`.
+
+The generator is an evaluation aid only. It does not certify privacy, coding
+accuracy, clinical safety, or production model behavior.
+
+Imported offsets must be integers, and supplied schema versions, document hashes, and synthetic/no-PHI markers must agree. Collections are limited to 4096 entries, documents to 1 MiB of characters, string metadata to 4096 characters, and seeds to signed 64-bit integers. Validation exceptions omit caller values. Typed values are revalidated before fixture serialization.
+
+Custom fixture IDs, labels, code identities, and field names must be non-sensitive controlled identifiers. Synthetic/no-PHI markers describe caller-provided provenance; they do not anonymize arbitrary input or certify privacy. Code display text is included only with the explicit text-inclusive fixture serialization.
```

**File**: `docs/evaluation/ocr-routing.md` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+# OCR document-routing evaluation
+
+`openmed.eval.ocr_routing` provides a deterministic, offline evaluation harness
+for routing clinical documents after OCR. It exercises the local document
+classifier and the existing routing profiles with synthetic examples for
+radiology, pathology, progress, discharge, operative, consult, and unknown
+documents.
+
+Radiology, pathology, and discharge summaries expect their specialized local
+profiles. Other document families exercise the generic pass-through fallback.
+
+The harness is an evaluation of the routing pipeline, not a compliance
+certification or a clinical decision guarantee. It does not load a model, make
+a network request, or call an external OCR service.
+
+## Run the default corpus
+
+```python
+from openmed.eval.ocr_routing import assert_ocr_routing_gate
+
+report = assert_ocr_routing_gate()
+print(report.metrics.to_dict())
+```
+
+`run_ocr_routing_eval()` returns a report without raising when a case fails.
+`assert_ocr_routing_gate()` raises an `AssertionError` whose diagnostic names
+only fixture IDs, failure categories, and safe structural details.
+
+## What is scored
+
+The report includes three aggregate surfaces:
+
+- `route_selection_accuracy` compares the predicted document type with the
+  fixture's expected family.
+- `offset_projection_accuracy` compares section labels and canonical
+  half-open offsets after projecting detector output from OCR text back to the
+  canonical coordinate space. Precision, recall, and F1 are also reported.
+- `safe_fallback_rate` checks that unknown, unsupported, or low-confidence
+  classifications select the generic pass-through profile and preserve all
+  offset-bearing sections and probe entities.
+
+OCR-to-canonical alignment uses Python's standard-library
+`difflib.SequenceMatcher`. Equal runs retain exact boundaries; insertions,
+deletions, and replacements are mapped monotonically. Callers can build the
+map directly with `build_offset_projection(source_text, target_text)` and
+project a range with `projection.project_span(start, end)`.
+
+## Privacy and fixture policy
+
+The default corpus is synthetic and lives in memory. Fixture manifests and
+reports contain lengths, labels, offsets, counts, confidence values, fixture
+IDs, and domain-separated SHA-256 digests. They do not serialize canonical or
+OCR text. Custom fixtures should use synthetic offline values and should not
+place source text in logs, exception messages, committed golden data, or
+evaluation artifacts.
+
+The routing result is an engineering signal. Downstream clinical review,
+privacy controls, and application-specific safety gates remain required.
+
+## Limits and interpretation
+
+This is a fixture regression gate, not model-accuracy evidence. Unless supplied
+explicitly, gold section boundaries are produced by the same local detector on
+canonical text. A complete mismatch scores zero F1; an empty/empty comparison
+scores one by convention. Every case must pass, even when aggregate thresholds
+are relaxed.
+
+Each text is limited to 4,096 characters and each alignment to 4,000,000
+source/target character pairs. A run accepts at most 512 fixtures and each
+section collection at most 4,096 entries. Oversized inputs fail closed before
+alignment. These limits bound this small offline harness, not the production
+document pipeline.
+
+Classifier and detector errors use fixed categories. Unknown document types
+map to `unknown`; unknown section labels are domain-separated hashes. Callback
+errors do not trigger a second detector invocation. Invalid confidence values
+fall back conservatively to zero.
+
+Fixture IDs and language metadata are caller-owned identifiers: use
+non-sensitive values. Excluding document text is not anonymization of those
+identifiers or proof that a caller-supplied fixture is synthetic.
```

**File**: `mkdocs.yml` (modified, +2/-0)
```diff
@@ -334,8 +334,10 @@ nav:
       - AWQ Export: export-awq.md
       - GPTQ Export: export-gptq.md
       - GGUF Embedding Export: export-gguf.md
+      - Synthetic Clinical Fixtures: evaluation/clinical-fixtures.md
       - OCR box-coordinate normalization: multimodal/box-normalization.md
       - OCR page-rotation transforms: multimodal/page-rotation.md
+      - OCR document-routing evaluation: evaluation/ocr-routing.md
       - DICOM-SR provenance mapping: multimodal/dicom-sr-provenance.md
       - Typed laboratory reference-range provenance: clinical/lab-reference-ranges.md
       - Lab Measurement Normalization: clinical/lab-measurements.md
```

**File**: `openmed/clinical/__init__.py` (modified, +6/-0)
```diff
@@ -1303,13 +1303,16 @@
     validate_transition,
 )
 from .routing import (
+    DISCHARGE_NOTE_TYPE_PROFILE,
+    DISCHARGE_PROFILE,
     GENERIC_NOTE_TYPE_PROFILE,
     GENERIC_PROFILE,
     PATHOLOGY_NOTE_TYPE_PROFILE,
     PATHOLOGY_PROFILE,
     RADIOLOGY_NOTE_TYPE_PROFILE,
     RADIOLOGY_PROFILE,
     ROUTING_PROVENANCE_KEY,
+    DischargeNoteTypeProfile,
     ExtractionPlan,
     GenericProfile,
     NoteTypeProfile,
@@ -2742,12 +2745,15 @@
     "extract_pathology_result",
     "GENERIC_NOTE_TYPE_PROFILE",
     "GENERIC_PROFILE",
+    "DISCHARGE_NOTE_TYPE_PROFILE",
+    "DISCHARGE_PROFILE",
     "PATHOLOGY_NOTE_TYPE_PROFILE",
     "PATHOLOGY_PROFILE",
     "RADIOLOGY_NOTE_TYPE_PROFILE",
     "RADIOLOGY_PROFILE",
     "ROUTING_PROVENANCE_KEY",
     "ExtractionPlan",
+    "DischargeNoteTypeProfile",
     "GenericProfile",
     "NoteTypeProfile",
     "PathologyNoteTypeProfile",
```

**File**: `openmed/clinical/routing.py` (modified, +83/-10)
```diff
@@ -40,6 +40,7 @@
 GENERIC_PROFILE_NAME = "generic"
 RADIOLOGY_PROFILE_NAME = "radiology"
 PATHOLOGY_PROFILE_NAME = "pathology"
+DISCHARGE_PROFILE_NAME = "discharge_summary"
 
 ROUTING_STAGE_NAMES = ("medication", "problem_list", "lab_values")
 ROUTING_SECTION_LABELS = frozenset(
@@ -52,10 +53,17 @@
         "synoptic",
         "staging",
         "grading",
+        "diagnoses",
+        "procedures",
+        "medications",
+        "follow_up",
+        "instructions",
     }
 )
 
-_TARGET_DOCUMENT_TYPES = frozenset({"radiology_report", "pathology_report"})
+_TARGET_DOCUMENT_TYPES = frozenset(
+    {"radiology_report", "pathology_report", "discharge_summary"}
+)
 _STAGE_ALIASES = {
     "medications": "medication",
     "medication": "medication",
@@ -427,15 +435,49 @@ def __init__(self) -> None:
         )
 
 
+class DischargeNoteTypeProfile(NoteTypeProfile):
+    """Section-scoped route over the existing local discharge profile."""
+
+    def __init__(self) -> None:
+        sections = (
+            "diagnoses",
+            "procedures",
+            "medications",
+            "follow_up",
+            "instructions",
+        )
+        super().__init__(
+            name=DISCHARGE_PROFILE_NAME,
+            document_types=("discharge_summary",),
+            expected_sections=sections,
+            entity_priorities=(
+                "diagnosis",
+                "procedure",
+                "medication",
+                "follow_up",
+                "instruction",
+            ),
+            section_scoped_stage_config={
+                "medication": ("medications",),
+                "problem_list": ("diagnoses",),
+                "lab_values": ("diagnoses", "procedures"),
+            },
+            cue_terms={},
+            thresholds={},
+        )
+
+
 GENERIC_PROFILE = GenericProfile()
 RADIOLOGY_PROFILE = RadiologyProfile()
 PATHOLOGY_PROFILE = PathologyProfile()
+DISCHARGE_PROFILE = DischargeNoteTypeProfile()
 
 # Explicit aliases make the profile constants discoverable without requiring a
 # caller to know whether the surrounding code says "note type" or "document".
 GENERIC_NOTE_TYPE_PROFILE = GENERIC_PROFILE
 RADIOLOGY_NOTE_TYPE_PROFILE = RADIOLOGY_PROFILE
 PATHOLOGY_NOTE_TYPE_PROFILE = PATHOLOGY_PROFILE
+DISCHARGE_NOTE_TYPE_PROFILE = DISCHARGE_PROFILE
 RadiologyNoteTypeProfile = RadiologyProfile
 PathologyNoteTypeProfile = PathologyProfile
 
@@ -478,11 +520,11 @@ def _safe_confidence(value: object) -> float:
         return 0.0
     try:
         confidence = float(value)
-    except (TypeError, ValueError):
+    except (TypeError, ValueError, OverflowError):
         return 0.0
-    if not isfinite(confidence):
+    if not isfinite(confidence) or not 0.0 <= confidence <= 1.0:
         return 0.0
-    return min(max(confidence, 0.0), 1.0)
+    return confidence
 
 
 def resolve_profile(classify_document_result: object) -> RoutingSelection:
@@ -511,6 +553,9 @@ def resolve_profile(classify_document_result: object) -> RoutingSelection:
         elif document_type == "radiology_report":
             reason = None
             profile = RADIOLOGY_PROFILE
+        elif document_type == "discharge_summary":
+            reason = None
+            profile = DISCHARGE_PROFILE
         else:
             reason = None
             profile = PATHOLOGY_PROFILE
@@ -528,7 +573,7 @@ def resolve_profile(classify_document_result: object) -> RoutingSelection:
 
 
 def select_profile(classify_document_result: object) -> NoteTypeProfile:
-    """Select the radiology, pathology, or generic profile.
+    """Select the radiology, pathology, discharge, or generic profile.
 
     The function intentionally returns the profile itself.  Call
     :func:`resolve_profile` or :func:`routing_provenance` when the caller also
@@ -603,7 +648,7 @@ def _entity_offsets(entity: object) -> tuple[int, int] | None:
         or not isinstance(end, int)
         or isinstance(end, bool)
         or start < 0
-        or end < start
+        or end <= start
     ):
         return None
     return start, end
@@ -630,6 +675,30 @@ def _entity_in_sections(
     )
 
 
+def _detect_profile_sections(
+    text: str,
+    profile: NoteTypeProfile,
+    language: str | None,
+) -> tuple[SectionSpan, ...]:
+    if not isinstance(profile, DischargeNoteTypeProfile):
+        return detect_sections(text, language=language)
+
+    # The general section lexicon does not cover discharge-specific headings.
+    # Reuse the existing local discharge parser's source boundaries instead.
+    from .discharge_profile import extract_discharge_profile
+
+    return tuple(
+        SectionSpan(
+            label=section.field,
+            start=section.start,
+            end=section.end,
+            content_start=section.content_start,
+            source="discharge_profile",
+        )
+        for section in extract_discharge_profile(text, language=language).sections
+    )
+
+
 def resolve_profile_sections(
     text: str,
     profile:
```

**File**: `openmed/eval/__init__.py` (modified, +94/-0)
```diff
@@ -117,6 +117,28 @@
     run_citation_support_metrics,
     score_citation_support,
 )
+from openmed.eval.clinical_fixtures import (
+    ASSERTION_VALUES,
+    CERTAINTY_VALUES,
+    CLINICAL_FIXTURE_DISCLAIMER,
+    CLINICAL_FIXTURE_SCHEMA_VERSION,
+    DEFAULT_PROFILES,
+    DEFAULT_SEED,
+    SYNTHETIC_CODE_SYSTEM,
+    TEMPORALITY_VALUES,
+    ClinicalFixture,
+    ClinicalSection,
+    CodedValue,
+    ExpectedField,
+    GoldSpan,
+    available_profiles,
+    generate_clinical_fixture,
+    generate_clinical_fixtures,
+    generate_fixture,
+    generate_fixtures,
+    normalize_profile,
+    validate_fixture,
+)
 from openmed.eval.comparator import (
     BaselineAdapter,
     ComparatorBudget,
@@ -781,6 +803,33 @@
     score_multilingual_norm_fixture,
     score_multilingual_norm_records,
 )
+from openmed.eval.ocr_routing import (
+    OCR_DOCUMENT_FAMILIES,
+    OCR_ROUTING_FIXTURE_VERSION,
+    OCR_ROUTING_PROFILES,
+    OCR_ROUTING_SCHEMA_VERSION,
+    OCR_ROUTING_SUITE,
+    ExpectedSection,
+    OcrRoutingCase,
+    OcrRoutingCaseResult,
+    OcrRoutingFailure,
+    OcrRoutingFixture,
+    OcrRoutingMetrics,
+    OcrRoutingReport,
+    OffsetProjection,
+    OffsetProjectionScore,
+    assert_ocr_routing_gate,
+    build_offset_projection,
+    default_ocr_routing_fixtures,
+    load_ocr_routing_fixtures,
+    ocr_routing_metadata,
+    project_offsets,
+    project_span_offsets,
+    run_ocr_routing,
+    run_ocr_routing_eval,
+    score_ocr_routing,
+    score_offset_projection,
+)
 from openmed.eval.perf import (
     DEFAULT_PERF_WORKLOAD_PATH,
     SYNTHETIC_PERF_MODEL_NAME,
@@ -1885,6 +1934,31 @@
     "compute_resource_metrics",
     "compute_section_detection_metrics",
     "compute_section_recall",
+    "OCR_DOCUMENT_FAMILIES",
+    "OCR_ROUTING_FIXTURE_VERSION",
+    "OCR_ROUTING_PROFILES",
+    "OCR_ROUTING_SCHEMA_VERSION",
+    "OCR_ROUTING_SUITE",
+    "ExpectedSection",
+    "OffsetProjection",
+    "OffsetProjectionScore",
+    "OcrRoutingCase",
+    "OcrRoutingCaseResult",
+    "OcrRoutingFailure",
+    "OcrRoutingFixture",
+    "OcrRoutingMetrics",
+    "OcrRoutingReport",
+    "assert_ocr_routing_gate",
+    "build_offset_projection",
+    "default_ocr_routing_fixtures",
+    "load_ocr_routing_fixtures",
+    "ocr_routing_metadata",
+    "project_offsets",
+    "project_span_offsets",
+    "run_ocr_routing",
+    "run_ocr_routing_eval",
+    "score_ocr_routing",
+    "score_offset_projection",
     "compute_sr_content_accuracy",
     "compute_span_grounded_faithfulness",
     "compute_strict_relation_f1",
@@ -2166,6 +2240,26 @@
     "privacy_corpus_coverage",
     "validate_privacy_corpus_manifest",
     "write_privacy_corpus_manifest",
+    "ASSERTION_VALUES",
+    "CERTAINTY_VALUES",
+    "CLINICAL_FIXTURE_DISCLAIMER",
+    "CLINICAL_FIXTURE_SCHEMA_VERSION",
+    "DEFAULT_PROFILES",
+    "DEFAULT_SEED",
+    "SYNTHETIC_CODE_SYSTEM",
+    "TEMPORALITY_VALUES",
+    "ClinicalFixture",
+    "ClinicalSection",
+    "CodedValue",
+    "ExpectedField",
+    "GoldSpan",
+    "available_profiles",
+    "generate_clinical_fixture",
+    "generate_clinical_fixtures",
+    "generate_fixture",
+    "generate_fixtures",
+    "normalize_profile",
+    "validate_fixture",
     "ADJUDICATION_CONTRADICTS",
     "ADJUDICATION_IRRELEVANT",
     "ADJUDICATION_LABELS",
```

---

### Incident Patch 5: `6d970aa4` (2026-09-28)
**Commit Message**: fix: reject unmatched numeric fragments in schema values

**File**: `openmed/structured/schema_extract.py` (modified, +8/-0)
```diff
@@ -529,12 +529,20 @@ def _coerce(spec: _FieldSpec, raw: str) -> tuple[Any, str | None]:
     elif field_type == "integer":
         matches = list(_NUMBER_TOKEN_RE.finditer(raw))
         match = matches[0] if len(matches) == 1 else None
+        if match is not None and any(
+            char.isdigit() for char in raw[: match.start()] + raw[match.end() :]
+        ):
+            match = None
         if match is None or "." in match.group():
             return None, "expected an integer value"
         value = int(match.group())
     elif field_type == "number":
         matches = list(_NUMBER_TOKEN_RE.finditer(raw))
         match = matches[0] if len(matches) == 1 else None
+        if match is not None and any(
+            char.isdigit() for char in raw[: match.start()] + raw[match.end() :]
+        ):
+            match = None
         if match is None:
             return None, "expected a numeric value"
         value = float(match.group())
```

**File**: `tests/unit/structured/test_schema_extract.py` (modified, +3/-1)
```diff
@@ -353,7 +353,9 @@ def test_advisory_exposed():
     assert isinstance(SCHEMA_EXTRACT_ADVISORY, str) and SCHEMA_EXTRACT_ADVISORY
 
 
-@pytest.mark.parametrize("raw", ["1e3", "10-20", "2 and 3", "1/2"])
+@pytest.mark.parametrize(
+    "raw", ["1e3", "10-20", "2 and 3", "1/2", "3,5 and 8", "1.2.3 and 8"]
+)
 def test_ambiguous_numeric_value_is_not_silently_truncated(raw):
     result = extract_to_schema(
         "Dose: " + raw, {"properties": {"dose": {"type": "number"}}}
```

---

### Incident Patch 6: `c77cc0db` (2026-09-28)
**Commit Message**: fix: bound schema extraction and reject ambiguous source values

**File**: `docs/structured/schema-guided-extraction.md` (modified, +17/-0)
```diff
@@ -100,3 +100,20 @@ gaps recorded in `missing_required` and `errors`.
 `data`, `bindings`, and `errors` contain extracted values in memory. Keep the
 result inside the caller's protected workflow; do not write those values to
 logs or audit artifacts.
+
+## Bounded extraction
+
+Notes are limited to 1 MiB, input collections and table cells to 4,096 entries,
+and candidate values to 4,096 characters. Invalid or oversized source iterables
+are reported as value-free entries in `errors` (empty field/raw and zero offsets);
+other valid sources can still fill slots. Duplicate table coordinates are
+rejected instead of being resolved by input order. Numeric ranges, fractions,
+scientific notation and multiple numeric tokens are not guessed or truncated.
+
+Schemas allow at most 256 properties/aliases/enum values. Regex patterns are
+limited to 256 characters and a non-branching subset: literals, anchors, character
+classes, exact repetitions up to 256, and at most one flexible repetition.
+Groups, alternatives, backreferences and nested repetitions are rejected.
+Schema errors use a fixed message without retaining source exception context.
+A partial result with missing required fields is not a valid complete instance
+of the target schema; check both `missing_required` and `errors` before use.
```

**File**: `openmed/structured/schema_extract.py` (modified, +135/-18)
```diff
@@ -24,6 +24,8 @@
 
 import re
 from collections.abc import Iterable, Mapping
+from functools import wraps
+from itertools import islice
 from math import isfinite
 from typing import Any, Literal, TypedDict
 
@@ -137,6 +139,80 @@ class _FieldSpec(TypedDict):
     pattern: re.Pattern[str] | None
 
 
+def _schema_boundary(function):
+    @wraps(function)
+    def checked(*args, **kwargs):
+        try:
+            return function(*args, **kwargs)
+        except Exception:
+            pass
+        raise SchemaDefinitionError("invalid or unsupported extraction schema")
+
+    return checked
+
+
+def _bounded(values, limit=4096):
+    result = tuple(islice(iter(values), limit + 1))
+    if len(result) > limit:
+        raise ValueError("input limit exceeded")
+    return result
+
+
+def _safe_pattern(source):
+    """Accept linear, non-branching scalar patterns, not arbitrary regex programs."""
+    if not isinstance(source, str) or len(source) > 256:
+        raise SchemaDefinitionError("invalid pattern")
+    index, flexible, atom = 0, 0, False
+    while index < len(source):
+        char = source[index]
+        if char == "\\":
+            index += 1
+            if (
+                index >= len(source)
+                or source[index].isdigit()
+                or source[index] in {"g", "k"}
+            ):
+                raise SchemaDefinitionError("unsupported regex reference")
+            atom = True
+        elif char == "[":
+            index += 1
+            if index < len(source) and source[index] == "^":
+                index += 1
+            while index < len(source) and source[index] != "]":
+                if source[index] == "\\":
+                    index += 1
+                index += 1
+            if index >= len(source):
+                raise SchemaDefinitionError("invalid character class")
+            atom = True
+        elif char in "()|":
+            raise SchemaDefinitionError("branching regex is unsupported")
+        elif char in "*+?":
+            flexible += 1
+            if not atom or flexible > 1:
+                raise SchemaDefinitionError("ambiguous regex repetition")
+            atom = False
+        elif char == "{":
+            end = source.find("}", index)
+            count = source[index + 1 : end] if end >= 0 else ""
+            if (
+                not atom
+                or not count.isascii()
+                or not count.isdigit()
+                or not 1 <= int(count) <= 256
+            ):
+                raise SchemaDefinitionError("unsupported regex repetition")
+            index, atom = end, False
+        elif char in "^$":
+            atom = False
+        elif char == "}":
+            raise SchemaDefinitionError("unsupported regex repetition")
+        else:
+            atom = True
+        index += 1
+    return re.compile(source)
+
+
 def normalize_field_key(label: str) -> str:
     """Normalize a slot name or source label to a comparable key.
 
@@ -188,15 +264,37 @@ def extract_to_schema(
 
     specs, required = _compile_schema(schema)
 
-    candidates: dict[FieldSource, dict[str, list[_Candidate]]] = {
-        "entity": _entity_candidates(text, entities),
-        "table": _table_candidates(text, tables),
-        "key_value": _key_value_candidates(text),
-    }
+    input_errors: list[SchemaValidationIssue] = []
+
+    def invalid_source(source):
+        input_errors.append(
+            SchemaValidationIssue(
+                field="",
+                reason="invalid or oversized source input",
+                raw="",
+                start=0,
+                end=0,
+                source=source,
+            )
+        )
+
+    if not isinstance(text, str) or len(text) > 1048576:
+        invalid_source("key_value")
+        text = ""
+    candidates = {"entity": {}, "table": {}, "key_value": {}}
+    for source, builder, values in (
+        ("entity", _entity_candidates, entities),
+        ("table", _table_candidates, tables),
+    ):
+        try:
+            candidates[source] = builder(text, _bounded(values))
+        except Exception:
+            invalid_source(source)
+    candidates["key_value"] = _key_value_candidates(text)
 
     data: dict[str, Any] = {}
     bindings: dict[str, FieldBinding] = {}
-    errors: list[SchemaValidationIssue] = []
+    errors: list[SchemaValidationIssue] = input_errors
     missing_required: list[str] = []
     missing_required_details: list[MissingRequiredField] = []
 
@@ -248,6 +346,7 @@ def extract_to_schema(
     )
 
 
+@_schema_boundary
 def _compile_schema(
     schema: Mapping[str, Any],
 ) -> tuple[list[_FieldSpec], frozenset[str]]:
@@ -268,9 +367,11 @@ def _compile_schema(
     if not isinstance(schema.get("additionalProperties", False), bool):
         raise SchemaDefinitionError("additionalProperties must be a boolean")
 
+    if len(properties) > 256:
+        raise SchemaDefinitionError("too many schema properties")
     specs: list[_FieldSpec] = []
  
```

**File**: `tests/unit/structured/test_schema_extract.py` (modified, +87/-0)
```diff
@@ -351,3 +351,90 @@ def test_deterministic():
 
 def test_advisory_exposed():
     assert isinstance(SCHEMA_EXTRACT_ADVISORY, str) and SCHEMA_EXTRACT_ADVISORY
+
+
+@pytest.mark.parametrize("raw", ["1e3", "10-20", "2 and 3", "1/2"])
+def test_ambiguous_numeric_value_is_not_silently_truncated(raw):
+    result = extract_to_schema(
+        "Dose: " + raw, {"properties": {"dose": {"type": "number"}}}
+    )
+    assert result["data"] == {}
+    assert result["errors"]
+
+
+@pytest.mark.parametrize(
+    "definition",
+    [
+        {"type": []},
+        {"type": "string", "aliases": 0},
+        {"type": "string", "pattern": "(a+)+$"},
+    ],
+)
+def test_malformed_or_unsafe_schema_is_a_definition_error(definition):
+    with pytest.raises(SchemaDefinitionError) as caught:
+        extract_to_schema("", {"properties": {"synthetic-sensitive-value": definition}})
+    assert "synthetic-sensitive-value" not in str(caught.value)
+    assert caught.value.__context__ is None
+
+
+def test_bad_source_iterator_returns_partial_extraction():
+    def broken():
+        raise RuntimeError("synthetic-sensitive-value")
+        yield
+
+    result = extract_to_schema(NOTE, SCHEMA, entities=broken())
+    assert result["data"]["patient_age"] == 54
+    assert result["errors"]
+    assert "synthetic-sensitive-value" not in repr(result["errors"])
+
+
+def test_oversized_integer_is_reported_without_raising():
+    result = extract_to_schema(
+        "Age: " + "9" * 5000, {"properties": {"age": {"type": "integer"}}}
+    )
+    assert result["data"] == {}
+    assert result["errors"]
+
+
+def test_ambiguous_enum_canonicalization_is_rejected():
+    with pytest.raises(SchemaDefinitionError):
+        extract_to_schema(
+            "Kind: a", {"properties": {"kind": {"type": "string", "enum": ["A", "a"]}}}
+        )
+
+
+def test_duplicate_table_cell_is_not_resolved_by_input_order():
+    text = "Age 10 20"
+    key = {"row": 0, "column": 0, "text": "Age", "start": 0, "end": 3}
+    a = {"row": 0, "column": 1, "text": "10", "start": 4, "end": 6}
+    b = {"row": 0, "column": 1, "text": "20", "start": 7, "end": 9}
+    schema = {"properties": {"age": {"type": "integer"}}}
+    first = extract_to_schema(text, schema, tables=[{"cells": [key, a, b]}])
+    second = extract_to_schema(text, schema, tables=[{"cells": [key, b, a]}])
+    assert first == second
+    assert first["data"] == {}
+    assert first["errors"]
+
+
+def test_source_collections_are_bounded():
+    result = extract_to_schema(NOTE, SCHEMA, entities=[{}] * 4097)
+    assert result["errors"]
+    assert result["data"]["patient_age"] == 54
+
+
+def test_canonical_enum_value_must_still_satisfy_pattern():
+    schema = {
+        "properties": {
+            "sex": {"type": "string", "enum": ["Female"], "pattern": "female"}
+        }
+    }
+    result = extract_to_schema("Sex: female", schema)
+    assert result["data"] == {}
+    assert result["errors"]
+
+
+def test_pattern_on_numeric_slot_is_rejected():
+    with pytest.raises(SchemaDefinitionError):
+        extract_to_schema(
+            "Age: 10", {"properties": {"age": {"type": "integer", "pattern": "[0-9]+"}}}
+        )
```

---

### Incident Patch 7: `02f6b5cb` (2026-09-28)
**Commit Message**: fix: recover punctuation-split structured identifiers (#3553)

* fix: recover punctuation-split structured identifiers

* fix: retain split-identifier regex import after merge

* Fix split identifier boundaries and MRN prefixes

**File**: `docs/security/threat-model.md` (modified, +6/-7)
```diff
@@ -161,7 +161,7 @@ published examples are **synthetic**.
 | ID | Abuse case | Vector | Mitigation | Status |
 |---|---|---|---|---|
 | **AC-01** | Zero-width / whitespace split identifier | Zero-width joiners or stray spaces inside an SSN/card/email so the ML token and the regex both break. | `normalize_for_pii_detection` strips zero-width controls; whitespace variants are matched by sweep regexes; smart-merge reunites ML fragments. Then `safety_sweep` recovers. | **Mitigated** |
-| **AC-02** | Uncanonicalized separator mutation | Some visible separator mutations can disrupt structured-identifier matching. The current document intentionally omits actionable forms and reproduction details and routes future reports through `SECURITY.md`. | No complete deterministic mitigation is claimed. The ML detector may add defense in depth but is not treated as a guaranteed control. | **Known gap** |
+| **AC-02** | Punctuation-split structured identifiers | Visible punctuation inserted between characters can defeat ordinary identifier patterns. | The deterministic safety sweep recognizes bounded split SSN, card, MRN, and IBAN shapes at their original offsets. SSN and card matches require context or a checksum; MRN requires its explicit prefix, and IBAN requires a checksum. Synthetic regression tests cover leakage and clinical-number false positives. | **Mitigated for the bounded shapes** |
 | **AC-03** | Unicode confusable / mixed-script obfuscation | Greek/Cyrillic/full-width lookalikes substituted into an identifier (`janе.doe@…` with a Cyrillic `е`). | Confusable folding maps lookalikes to Latin before detection; mixed-script is flagged in metadata; spans remap to the original. | **Mitigated** |
 | **AC-04** | Full-width digit encoding | Identifier written with full-width digits (`４１１１ …`) to dodge ASCII-digit regexes. | Full-width forms (U+FF01–FF5E) are folded to ASCII in `normalize_for_pii_detection` before the sweep. | **Mitigated** |
 | **AC-05** | Combining-mark obfuscation | Standalone combining diacritics layered over identifier characters. | Category-`Mn` combining marks are stripped offset-preservingly before detection. | **Mitigated** |
@@ -191,13 +191,12 @@ OpenMed version instead of re-exporting the legacy artifact.
 | No-telemetry / no phone-home enforcement | **OM-099** | [`no-telemetry.md`](no-telemetry.md) |
 | Adversarial-Unicode normalization | this task / de-id path | [`script_detect.py`](https://github.com/maziyarpanahi/openmed/blob/master/openmed/core/script_detect.py) |
 
-### 6.2 Open gaps (no complete mitigation today)
+### 6.2 Residual separator risk
 
-- **AC-02 — uncanonicalized separator mutation.** Some visible separator
-  transformations fall outside the normalization and deterministic-pattern
-  contracts. This remains a residual leakage class. The current document
-  intentionally omits exploit details; report new findings through the
-  vulnerability-reporting process in `SECURITY.md`.
+- **AC-02 — separator mutation outside bounded shapes.** The deterministic
+  control covers the named structured identifiers and separators above. Other
+  identifier types and separator mutations may still evade it. Report new
+  findings through the vulnerability-reporting process in `SECURITY.md`.
 
 ## 7. Residual-leakage risks
 
```

**File**: `openmed/core/safety_sweep.py` (modified, +59/-0)
```diff
@@ -3,6 +3,7 @@
 from __future__ import annotations
 
 import hashlib
+import re
 from dataclasses import dataclass
 from typing import Any, Mapping, Sequence
 
@@ -19,6 +20,24 @@
 SAFETY_SWEEP_SOURCE = "safety_sweep"
 SAFETY_SWEEP_PATTERNS_VERSION = "safety-sweep-v1"
 
+# Bound separator tolerance to structured shapes. A visible mutation must be
+# present, and the existing validator or explicit MRN context must still pass.
+_SPLIT_IDENTIFIER_PATTERNS = (
+    ("ssn", re.compile(r"(?<!\w)\d(?:[-.,· ]{0,2}\d){8}(?!\w)")),
+    (
+        "credit_debit_card",
+        re.compile(r"(?<!\w)\d(?:[-.,· ]{0,2}\d){15}(?!\w)"),
+    ),
+    (
+        "medical_record_number",
+        re.compile(r"(?<!\w)MRN[: #]*\d(?:[-.,· ]{0,2}\d){5,9}(?!\w)", re.I),
+    ),
+    (
+        "iban",
+        re.compile(r"(?<!\w)[A-Z]{2}\d{2}(?:[-.,· ]{0,2}[A-Z0-9]){11,30}(?!\w)"),
+    ),
+)
+
 
 @dataclass(frozen=True)
 class _Candidate:
@@ -154,6 +173,46 @@ def _collect_candidates(text: str, patterns: Sequence[PIIPattern]) -> list[_Cand
                 )
             )
 
+    by_label = {pattern.entity_type: pattern for pattern in patterns}
+    for label, split_pattern in _SPLIT_IDENTIFIER_PATTERNS:
+        pattern = by_label.get(label)
+        if pattern is None:
+            continue
+        for match in split_pattern.finditer(text):
+            start, end = match.span()
+            surface = match.group()
+            if not any(char in surface for char in ".,·"):
+                continue
+            if label != "iban" and (
+                re.search(r"\d[-.,· ]{0,2}$", text[max(0, start - 3) : start])
+                or re.match(r"[-.,· ]{0,2}\d", text[end : end + 3])
+            ):
+                # Never reinterpret a fragment of a longer separated digit run.
+                continue
+            canonical = re.sub(r"[-.,·\s]", "", surface)
+            if label == "medical_record_number":
+                if not re.fullmatch(r"MRN[:#]*\d{6,10}", canonical, re.I):
+                    continue
+            elif not _validated(pattern, canonical):
+                continue
+            if label == "ssn" and not _has_context(text, start, end, pattern):
+                continue
+            if label == "credit_debit_card" and not _has_context(
+                text, start, end, pattern
+            ):
+                continue
+            candidates.append(
+                _Candidate(
+                    start=start,
+                    end=end,
+                    label=label,
+                    text=surface,
+                    confidence=_confidence(text, start, end, pattern),
+                    priority=pattern.priority,
+                    pattern=pattern,
+                )
+            )
+
     candidates.sort(
         key=lambda candidate: (
             -candidate.confidence,
```

**File**: `tests/unit/security/test_redactor_leakage_bypass.py` (modified, +77/-4)
```diff
@@ -174,10 +174,83 @@ def test_ac01_zero_width_chars_are_all_stripped_offset_preserving():
     assert 0 <= start <= end <= len(text)
 
 
-# AC-02 is a known, unmitigated separator-mutation class. The current public
-# regression suite intentionally omits its actionable reproduction and routes
-# future findings through SECURITY.md. A public regression should land with the
-# coordinated fix and disclosure.
+# --- AC-02: punctuation-split structured identifiers -------------------------
+
+
+@pytest.mark.parametrize(
+    "split",
+    ["1.2.3-4.5-6.7.8.9", "1,2,3-4,5-6,7,8,9", "·".join("123456789")],
+)
+def test_ac02_split_ssn_has_exact_offsets_and_no_critical_leakage(split):
+    """The deterministic sweep recovers a synthetic split SSN without ML help."""
+    text = f"SSN {split} is synthetic."
+    normalized = normalize_for_pii_detection(text)
+    entities = safety_sweep(normalized.text, [])
+    matches = [entity for entity in entities if entity.label == "ssn"]
+    assert len(matches) == 1
+    start, end = normalized.remap_span(matches[0].start, matches[0].end)
+    assert (start, end) == (4, 4 + len(split))
+    assert text[start:end] == split
+    output = _deidentify_with_blind_model(text)
+    assert split not in output
+    assert "ssn" in output.lower()
+
+
+@pytest.mark.parametrize(
+    ("text", "label"),
+    [
+        ("Card 4.111.111.111.111.111", "credit_debit_card"),
+        ("MRN 1,2,3,4,5,6", "medical_record_number"),
+        ("IBAN GB82.WE.ST.1234.5698.7654.32", "iban"),
+    ],
+)
+def test_ac02_other_split_identifiers_are_recovered(text, label):
+    """Checksum or explicit context gates the remaining structured shapes."""
+    assert label in _swept_labels(safety_sweep(text, []))
+
+
+@pytest.mark.parametrize("prefix", ["MRN: ", "MRN #", "MRN: #", "mrn:"])
+def test_ac02_mrn_prefix_variants_preserve_full_source_span(prefix):
+    surface = f"{prefix}1,2,3,4,5,6"
+    text = f"Synthetic {surface} is recorded."
+    matches = [
+        entity
+        for entity in safety_sweep(text, [])
+        if entity.label == "medical_record_number"
+    ]
+    assert len(matches) == 1
+    assert text[matches[0].start : matches[0].end] == surface
+    assert surface not in _deidentify_with_blind_model(text)
+
+
+@pytest.mark.parametrize(
+    ("text", "label"),
+    [
+        ("SSN 1.2.3.4.5.6.7.8.9.0", "ssn"),
+        ("SSN 0.1.2.3.4.5.6.7.8.9.0", "ssn"),
+        ("Card 4.111.111.111.111.111.0", "credit_debit_card"),
+        ("MRN: 1,2,3,4,5,6,7,8,9,0,1", "medical_record_number"),
+    ],
+)
+def test_ac02_overlong_split_runs_are_not_partial_identifiers(text, label):
+    assert label not in _swept_labels(safety_sweep(text, []))
+
+
+@pytest.mark.parametrize(
+    "text",
+    [
+        "BP 1.2.3.4.5.6.7.8.9 mmHg",
+        "dose 1,2,3,4,5,6,7,8,9 mg",
+        "HbA1c 6.7, glucose 8.9 mmol/L",
+        "Card 4.111.111.111.111.112",
+    ],
+)
+def test_ac02_clinical_numbers_and_invalid_card_are_not_identifiers(text):
+    """Clinical punctuation and failed checksums do not become identifiers."""
+    labels = _swept_labels(safety_sweep(text, []))
+    assert not labels.intersection(
+        {"ssn", "credit_debit_card", "medical_record_number", "iban"}
+    )
 
 
 # --- AC-03: unicode confusable / mixed-script obfuscation ---------------------
```

---

### Incident Patch 8: `6af1d8e6` (2026-09-27)
**Commit Message**: fix: consolidate eight contributor correctness repairs (#3558)

* fix(budget): reject unknown mapping fields (#3531)

* fix(eval): preserve explicitly empty gold spans (#3533)

Co-authored-by: Maziyar Panahi <[REDACTED_EMAIL]>

* fix(eval): stream dataset content hashing (#3532)

Co-authored-by: Maziyar Panahi <[REDACTED_EMAIL]>

* fix(config): preserve hashes inside quoted values (#3525)

Co-authored-by: Maziyar Panahi <[REDACTED_EMAIL]>

* fix(processing): strip BIO prefixes only at label start (#3526)

Co-authored-by: Maziyar Panahi <[REDACTED_EMAIL]>

* fix(processing): validate sharding counts before iteration (#3536)

Co-authored-by: Maziyar Panahi <[REDACTED_EMAIL]>

* fix(processing): reject overlapping nested siblings (#3541)

Co-authored-by: Maziyar Panahi <[REDACTED_EMAIL]>

* fix(ner): isolate cached GLiNER models by device (#3520)

Co-authored-by: Maziyar Panahi <[REDACTED_EMAIL]>

---------

Co-authored-by: Belal Embaby <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +13/-1)
```diff
@@ -250,9 +250,21 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   publishing permissions are limited to the publish job.
 
 ### Fixed
-
+- Reject unsupported RequestBudget mapping keys instead of silently ignoring
+  misspelled limits (#3509).
+- Preserve hash characters inside quoted configuration values while stripping
+  trailing comments (#3502).
+- Strip BIO prefixes only at label beginnings, preserving interior labels such as
+  HLA-B-27 (#3503).
+- Key GLiNER model cache entries by requested device so a cached instance is not
+  moved under a later caller (#3501).
+
+- Hash dataset files with bounded memory (#3510).
+- Respect explicitly empty gold annotations (#3511).
 - Load prefetched Hugging Face models from the standard cache during offline
   inference, including Transformers 5.x pipeline and component loading (#1983).
+- Reject non-integer sharding counts before reading documents.
+- Reject overlapping sibling items at nested list levels.
 - Require strict decoder validation before auto-detecting ISCII, preserving
   malformed Latin-1 strings through privacy preprocessing instead of raising
   or partially rewriting the input (#3242).
```

**File**: `openmed/core/budget.py` (modified, +8/-0)
```diff
@@ -241,12 +241,20 @@ def coerce_budget(
 
     Raises:
         TypeError: If ``budget`` is not a supported type.
+        InputError: If a mapping contains unsupported fields or invalid values.
     """
     if budget is None:
         return None
     if isinstance(budget, RequestBudget):
         return None if budget.is_unlimited else budget
     if isinstance(budget, Mapping):
+        allowed_fields = ("max_wall_time", "max_input_chars")
+        if any(key not in allowed_fields for key in budget):
+            raise InputError(
+                "Budget mapping contains unsupported fields. Use max_wall_time "
+                "and max_input_chars.",
+                details={"argument": "budget", "allowed_fields": list(allowed_fields)},
+            )
         coerced = RequestBudget(
             max_wall_time=budget.get("max_wall_time"),
             max_input_chars=budget.get("max_input_chars"),
```

**File**: `openmed/core/config.py` (modified, +23/-1)
```diff
@@ -749,11 +749,33 @@ def _format_value(value: Any) -> str:
     return f'"{value}"'
 
 
+def _strip_toml_comment(line: str) -> str:
+    """Remove an inline comment outside a single-line quoted value."""
+    quote = None
+    escaped = False
+    for index, character in enumerate(line):
+        if quote == '"':
+            if escaped:
+                escaped = False
+            elif character == "\\":
+                escaped = True
+            elif character == quote:
+                quote = None
+        elif quote == "'":
+            if character == quote:
+                quote = None
+        elif character in ("'", '"'):
+            quote = character
+        elif character == "#":
+            return line[:index]
+    return line
+
+
 def _load_toml(path: Path) -> Dict[str, Any]:
     data: Dict[str, Any] = {}
     with path.open("r", encoding="utf-8") as handle:
         for raw_line in handle:
-            line = raw_line.split("#", 1)[0].strip()
+            line = _strip_toml_comment(raw_line).strip()
             if not line or "=" not in line:
                 continue
             key, value = line.split("=", 1)
```

**File**: `openmed/eval/data_provenance.py` (modified, +27/-10)
```diff
@@ -74,30 +74,48 @@ def build_dataset_provenance(
 
 
 def compute_dataset_content_hash(path: str | Path) -> str:
-    """Hash a dataset file or directory without retaining its bytes."""
+    """Hash a dataset file or directory without retaining file contents.
+
+    Files are streamed in bounded 1 MiB chunks. Directory manifests still retain
+    one digest per file, and the resulting digest encoding is unchanged.
+    """
 
     source_path = Path(path)
     if not source_path.exists():
         raise FileNotFoundError(f"dataset source does not exist: {source_path}")
     if source_path.is_file():
-        return _hash_bytes(source_path.read_bytes())
+        return _hash_file(source_path)
 
     entries = {
-        child.relative_to(source_path).as_posix(): _hash_bytes(child.read_bytes())
+        child.relative_to(source_path).as_posix(): _hash_file(child)
         for child in sorted(source_path.rglob("*"))
         if child.is_file()
     }
     return _hash_json({"files": entries})
 
 
+def _hash_file(path: Path) -> str:
+    """Hash a file with bounded read buffers and the existing digest format."""
+
+    digest = hashlib.sha256()
+    with path.open("rb") as handle:
+        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
+            digest.update(chunk)
+    return f"sha256:{digest.hexdigest()}"
+
+
 def build_training_data_manifest(
     fixtures: Iterable[Any],
     *,
     dataset_id: str,
     data_revision: str,
     source: str | None = None,
 ) -> dict[str, Any]:
-    """Build a content-addressed manifest without persisting raw text."""
+    """Build a content-addressed manifest without persisting raw text.
+
+    For mapping fixtures, the first non-None field among ``gold_spans``,
+    ``spans``, and ``entities`` is authoritative, including an empty list.
+    """
 
     entries = sorted(
         (_fixture_manifest_entry(fixture) for fixture in fixtures),
@@ -212,12 +230,11 @@ def _fixture_language(fixture: Any) -> str | None:
 
 def _fixture_spans(fixture: Any) -> Iterable[Any]:
     if isinstance(fixture, Mapping):
-        return (
-            fixture.get("gold_spans")
-            or fixture.get("spans")
-            or fixture.get("entities")
-            or []
-        )
+        for field in ("gold_spans", "spans", "entities"):
+            value = fixture.get(field)
+            if value is not None:
+                return value
+        return []
     return getattr(fixture, "gold_spans", ())
 
 
```

**File**: `openmed/ner/families/gliner.py` (modified, +15/-9)
```diff
@@ -91,13 +91,7 @@ def load_gliner_handle(
     """Load a GLiNER model and wrap it in ``GLiNERHandle``."""
 
     ensure_gliner_available()
-    model = _load_model(model_id, cache_dir or None, token or None)
-
-    if device and hasattr(model, "to"):
-        try:
-            model = model.to(device)
-        except Exception:  # pragma: no cover - defensive path
-            pass
+    model = _load_model(model_id, cache_dir or None, token or None, device or None)
 
     return GLiNERHandle(model_id=model_id, model=model)
 
@@ -109,7 +103,12 @@ def clear_gliner_cache() -> None:
 
 
 @lru_cache(maxsize=4)
-def _load_model(model_id: str, cache_dir: Optional[str], token: Optional[str]) -> Any:
+def _load_model(
+    model_id: str,
+    cache_dir: Optional[str],
+    token: Optional[str],
+    device: Optional[str] = None,
+) -> Any:
     ensure_gliner_available()
     module = importlib.import_module(_PRIMARY_IMPORT)
     loader = getattr(module, "GLiNER")
@@ -118,7 +117,14 @@ def _load_model(model_id: str, cache_dir: Optional[str], token: Optional[str]) -
         kwargs["cache_dir"] = cache_dir
     if token:
         kwargs["token"] = token
-    return loader.from_pretrained(model_id, **kwargs)
+    model = loader.from_pretrained(model_id, **kwargs)
+    # Place each cached instance once; another device must not move live handles.
+    if device and hasattr(model, "to"):
+        try:
+            model = model.to(device)
+        except Exception:  # pragma: no cover - defensive path
+            pass
+    return model
 
 
 __all__ = [
```

**File**: `openmed/processing/distributed.py` (modified, +10/-2)
```diff
@@ -128,10 +128,16 @@ def plan_document_shards(
     ``worker_count`` is accepted for executor-facing call sites but does not
     affect membership, which lets operators change workers without reshuffling
     an already planned corpus.
+
+    Both counts must be positive Python integers, excluding booleans; invalid
+    values are rejected before documents are read.
     """
     _validate_shard_count(shard_count)
-    if worker_count is not None and worker_count < 1:
-        raise ValueError("worker_count must be greater than zero")
+    if worker_count is not None:
+        if isinstance(worker_count, bool) or not isinstance(worker_count, int):
+            raise ValueError("worker_count must be a positive integer")
+        if worker_count < 1:
+            raise ValueError("worker_count must be greater than zero")
 
     normalized_id_fields = _normalize_id_fields(id_fields)
     assignments: dict[int, list[tuple[str, str]]] = defaultdict(list)
@@ -167,6 +173,8 @@ def plan_document_shards(
 
 
 def _validate_shard_count(shard_count: int) -> None:
+    if isinstance(shard_count, bool) or not isinstance(shard_count, int):
+        raise ValueError("shard_count must be a positive integer")
     if shard_count < 1:
         raise ValueError("shard_count must be greater than zero")
 
```

**File**: `openmed/processing/lists.py` (modified, +8/-0)
```diff
@@ -171,6 +171,9 @@ def parse_lists(text: str) -> list[ListItemSpan]:
 def validate_list_items(text: str, items: Sequence[ListItemSpan]) -> None:
     """Validate offsets, hierarchy, ordering, and exact source alignment.
 
+    Siblings under the same parent must not overlap; ancestor containment is
+    allowed.
+
     Args:
         text: Original source text.
         items: Candidate list items in source order.
@@ -182,6 +185,7 @@ def validate_list_items(text: str, items: Sequence[ListItemSpan]) -> None:
 
     previous_start = -1
     previous_top_end = 0
+    previous_child_ends: dict[int, int] = {}
     for index, item in enumerate(items):
         if not isinstance(item, ListItemSpan):
             raise ValueError(f"list item {index} is not a ListItemSpan")
@@ -204,6 +208,10 @@ def validate_list_items(text: str, items: Sequence[ListItemSpan]) -> None:
                 raise ValueError(f"list item {index} skips a nesting level")
             if not (parent.start <= item.start and item.end <= parent.end):
                 raise ValueError(f"list item {index} falls outside its parent")
+            previous_end = previous_child_ends.get(item.parent_index, parent.start)
+            if item.start < previous_end:
+                raise ValueError(f"nested list item {index} overlaps its sibling")
+            previous_child_ends[item.parent_index] = item.end
 
         previous_start = item.start
 
```

**File**: `openmed/processing/outputs.py` (modified, +3/-1)
```diff
@@ -184,7 +184,9 @@ def format_predictions(
             entity_text = normalized_text
 
             raw_label = pred.get("entity_group") or pred.get("entity") or ""
-            clean_label = raw_label.replace("B-", "").replace("I-", "")
+            clean_label = (
+                raw_label[2:] if raw_label.startswith(("B-", "I-")) else raw_label
+            )
             label = clean_label or raw_label or "UNKNOWN"
 
             span_metadata = None
```

---

### Incident Patch 9: `98b0dc18` (2026-09-27)
**Commit Message**: fix: calibrate schema extraction documentation budget

**File**: `tests/browser/brand/budgets.json` (modified, +3/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schema_version": 2,
   "artifact": {
-    "maximum_total_bytes": 80302400,
-    "maximum_unique_payload_bytes": 79964821,
+    "maximum_total_bytes": 80540213,
+    "maximum_unique_payload_bytes": 80202634,
     "maximum_duplicate_payload_bytes": 458752,
     "maximum_source_map_files": 0
   },
@@ -37,6 +37,7 @@
     "With the multimodal batch-memory guide, the staged artifact measures 79767347 total bytes, 79429768 unique payload bytes, and 337579 duplicate payload bytes on macOS.",
     "With the agent run commitment guide, the staged artifact measures 79975507 total bytes, 79637928 unique payload bytes, and 337579 duplicate payload bytes on macOS.",
     "With the agent action-phase guide, the staged artifact measures 80186914 total bytes, 79849335 unique payload bytes, and 337579 duplicate payload bytes on macOS.",
+    "With the schema-guided extraction guide and the current master documentation, the staged artifact measures 80424727 total bytes, 80087148 unique payload bytes, and 337579 duplicate payload bytes on macOS.",
     "The aggregate ceilings retain the largest observed 4736-byte platform delta plus 110750 bytes of bounded headroom. Per-file non-JSON caps, duplicate-byte allowance, source-map exclusion, and page metric budgets remain unchanged.",
     "The published clinical, agent, multimodal, language-pack, interoperability, governance, social-needs, outbound-privacy, evidence-recency, NLI, and guardrail guides remain searchable. The combined search index measures 4185784 bytes against its 4197641-byte JSON ceiling; the 5752-byte increase preserves its previous measured headroom.",
     "The generated 2266-row model registry remains directly accessible but is excluded from global search indexing so unrelated documentation routes do not absorb its search payload.",
```

---

### Incident Patch 10: `db464996` (2026-09-27)
**Commit Message**: Merge pull request #3477 from maziyarpanahi/feature/om-804-pipeline-golden-suite

test: pin synthetic clinical pipeline golden cases

**File**: `tests/fixtures/clinical/e2e/README.md` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Synthetic pipeline goldens
+
+These three records are generated examples, not patient records. They cover an
+English discharge note with synthetic identifiers and negation, a Spanish/English
+code-mixed note, and a hypothetical condition. The clinical vocabulary samples
+in `tests/fixtures/clinical/grounding/` are synthetic and local. The fixture
+marker and source-rights field must remain present on every case.
+
+The committed `expected_pipeline` fields pin entity offsets, assertion axes,
+selected codes, synthetic vocabulary hashes, and FHIR bundle shape. Regenerate
+them only after a reviewer has inspected an intentional behavior change:
+
+```bash
+.venv/bin/python tests/integration/test_pipeline_e2e.py --regenerate-golden
+.venv/bin/python -m pytest tests/integration/test_pipeline_e2e.py -q
+```
+
+The regeneration command requires the explicit flag and rejects records without
+`synthetic: true`. Review the JSON diff before committing. These fixtures are
+engineering regression examples, not clinical evidence or treatment guidance.
```

**File**: `tests/fixtures/clinical/e2e/code_mixed_golden.json` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+{
+  "synthetic": true,
+  "source_rights": "generated synthetic fixture",
+  "disclaimer": "Synthetic data only. Advisory pipeline output for engineering regression testing; not a medical device and not for clinical decision-making.",
+  "redacted_pii_labels": [],
+  "phi_surface_strings": [],
+  "note_id": "synthetic-code-mixed-001",
+  "language": "es-en",
+  "source_note": "Nota clínica sintética. El paciente reports fever.",
+  "expected_entities": [
+    {
+      "text": "fever",
+      "ner_label": "CONDITION",
+      "negation": "affirmed",
+      "temporality": "recent",
+      "certainty": "certain",
+      "grounding_system": "hpo",
+      "expected_code": "HP:0001945",
+      "expected_display": "Fever",
+      "fhir_resource_type": "Observation"
+    }
+  ],
+  "expected_pipeline": {
+    "entities": [
+      {
+        "text": "fever",
+        "start": 44,
+        "end": 49,
+        "label": "CONDITION",
+        "negation": "affirmed",
+        "temporality": "recent",
+        "certainty": "certain",
+        "code": "HP:0001945",
+        "system": "http://human-phenotype-ontology.org",
+        "vocab_version": "sha256:46aa1fcaee2118ef8618ff5aaf09716da89425d7a58835d35d909cdd702f886a",
+        "resource_type": "Observation",
+        "status": "active"
+      }
+    ],
+    "fhir_bundle": {
+      "resource_type": "Bundle",
+      "type": "transaction",
+      "entry_types": [
+        "Patient",
+        "Observation"
+      ]
+    }
+  }
+}
```

**File**: `tests/fixtures/clinical/e2e/discharge_summary_golden.json` (modified, +136/-1)
```diff
@@ -104,5 +104,140 @@
       "expected_display": "Seizure",
       "fhir_resource_type": "Observation"
     }
-  ]
+  ],
+  "synthetic": true,
+  "source_rights": "generated synthetic fixture",
+  "language": "en",
+  "source_note": "Synthetic discharge summary for patient DEMO-001. DOB: 1975-04-03. Contact phone: 212-555-0198. Email: demo.patient@example.test. MRN: 00123456. SSN: 123-45-6789. History of present illness: The patient reports type 2 diabetes and hypertension. Medication: metformin 500 mg twice daily and lisinopril 10 mg daily. The patient denies pneumonia. Reports headache and fever. Family history of seizure.",
+  "expected_pipeline": {
+    "entities": [
+      {
+        "text": "type 2 diabetes",
+        "start": 195,
+        "end": 210,
+        "label": "CONDITION",
+        "negation": "affirmed",
+        "temporality": "historical",
+        "certainty": "certain",
+        "code": "E11.9",
+        "system": "http://hl7.org/fhir/sid/icd-10-cm",
+        "vocab_version": "sha256:778c8a675b9d73b96930a07cec6285009a490c9de5a1db5bb74feacf7309c709",
+        "resource_type": "Condition",
+        "status": "inactive"
+      },
+      {
+        "text": "hypertension",
+        "start": 215,
+        "end": 227,
+        "label": "CONDITION",
+        "negation": "affirmed",
+        "temporality": "recent",
+        "certainty": "certain",
+        "code": "I10",
+        "system": "http://hl7.org/fhir/sid/icd-10-cm",
+        "vocab_version": "sha256:778c8a675b9d73b96930a07cec6285009a490c9de5a1db5bb74feacf7309c709",
+        "resource_type": "Condition",
+        "status": "active"
+      },
+      {
+        "text": "metformin",
+        "start": 241,
+        "end": 250,
+        "label": "MEDICATION",
+        "negation": "affirmed",
+        "temporality": "recent",
+        "certainty": "certain",
+        "code": "6809",
+        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
+        "vocab_version": "sha256:112c8c6076a28d31250d01b479bd8857d6714245e6cb06aeb9ec93fc9f1c73e2",
+        "resource_type": "MedicationStatement",
+        "status": "active"
+      },
+      {
+        "text": "lisinopril",
+        "start": 274,
+        "end": 284,
+        "label": "MEDICATION",
+        "negation": "affirmed",
+        "temporality": "recent",
+        "certainty": "certain",
+        "code": "29046",
+        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
+        "vocab_version": "sha256:112c8c6076a28d31250d01b479bd8857d6714245e6cb06aeb9ec93fc9f1c73e2",
+        "resource_type": "MedicationStatement",
+        "status": "active"
+      },
+      {
+        "text": "pneumonia",
+        "start": 317,
+        "end": 326,
+        "label": "CONDITION",
+        "negation": "negated",
+        "temporality": "recent",
+        "certainty": "certain",
+        "code": "J18.9",
+        "system": "http://hl7.org/fhir/sid/icd-10-cm",
+        "vocab_version": "sha256:778c8a675b9d73b96930a07cec6285009a490c9de5a1db5bb74feacf7309c709",
+        "resource_type": "Condition",
+        "status": "refuted"
+      },
+      {
+        "text": "headache",
+        "start": 336,
+        "end": 344,
+        "label": "CONDITION",
+        "negation": "affirmed",
+        "temporality": "recent",
+        "certainty": "certain",
+        "code": "HP:0002315",
+        "system": "http://human-phenotype-ontology.org",
+        "vocab_version": "sha256:46aa1fcaee2118ef8618ff5aaf09716da89425d7a58835d35d909cdd702f886a",
+        "resource_type": "Observation",
+        "status": "active"
+      },
+      {
+        "text": "fever",
+        "start": 349,
+        "end": 354,
+        "label": "CONDITION",
+        "negation": "affirmed",
+        "temporality": "recent",
+        "certainty": "certain",
+        "code": "HP:0001945",
+        "system": "http://human-phenotype-ontology.org",
+        "vocab_version": "sha256:46aa1fcaee2118ef8618ff5aaf09716da89425d7a58835d35d909cdd702f886a",
+        "resource_type": "Observation",
+        "status": "active"
+      },
+      {
+        "text": "seizure",
+        "start": 374,
+        "end": 381,
+        "label": "CONDITION",
+        "negation": "affirmed",
+        "temporality": "historical",
+        "certainty": "certain",
+        "code": "HP:0001250",
+        "system": "http://human-phenotype-ontology.org",
+        "vocab_version": "sha256:46aa1fcaee2118ef8618ff5aaf09716da89425d7a58835d35d909cdd702f886a",
+        "resource_type": "Observation",
+        "status": "inactive"
+      }
+    ],
+    "fhir_bundle": {
+      "resource_type": "Bundle",
+      "type": "transaction",
+      "entry_types": [
+        "Patient",
+        "Condition",
+        "Condition",
+        "MedicationStatement",
+        "MedicationStatement",
+        "Condition",
+        "Observation",
+        "Observation",
+        "Observation"
+      ]
+    }
+  }
 }
```

**File**: `tests/fixtures/clinical/e2e/hypothetical_golden.json` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+{
+  "synthetic": true,
+  "source_rights": "generated synthetic fixture",
+  "disclaimer": "Synthetic data only. Advisory pipeline output for engineering regression testing; not a medical device and not for clinical decision-making.",
+  "redacted_pii_labels": [],
+  "phi_surface_strings": [],
+  "note_id": "synthetic-hypothetical-001",
+  "language": "en",
+  "source_note": "Synthetic follow-up note. Possible pneumonia.",
+  "expected_entities": [
+    {
+      "text": "pneumonia",
+      "ner_label": "CONDITION",
+      "negation": "affirmed",
+      "temporality": "recent",
+      "certainty": "uncertain",
+      "grounding_system": "icd10cm",
+      "expected_code": "J18.9",
+      "expected_display": "Pneumonia, unspecified organism",
+      "fhir_resource_type": "Condition"
+    }
+  ],
+  "expected_pipeline": {
+    "entities": [
+      {
+        "text": "pneumonia",
+        "start": 35,
+        "end": 44,
+        "label": "CONDITION",
+        "negation": "affirmed",
+        "temporality": "recent",
+        "certainty": "uncertain",
+        "code": "J18.9",
+        "system": "http://hl7.org/fhir/sid/icd-10-cm",
+        "vocab_version": "sha256:778c8a675b9d73b96930a07cec6285009a490c9de5a1db5bb74feacf7309c709",
+        "resource_type": "Condition",
+        "status": "unconfirmed"
+      }
+    ],
+    "fhir_bundle": {
+      "resource_type": "Bundle",
+      "type": "transaction",
+      "entry_types": [
+        "Patient",
+        "Condition"
+      ]
+    }
+  }
+}
```

**File**: `tests/integration/test_pipeline_e2e.py` (renamed, +127/-1)
```diff
@@ -36,8 +36,11 @@
 
 from __future__ import annotations
 
+import argparse
 import json
+from dataclasses import replace
 from pathlib import Path
+from types import SimpleNamespace
 from typing import Any
 
 import pytest
@@ -53,6 +56,7 @@
     clinical_status_from_assertion,
     resolve_span_context,
 )
+from openmed.clinical.exporters import check_codeable_concept
 from openmed.clinical.exporters.codeable_concept import (
     GroundedSpan,
     build_reverse_index,
@@ -66,6 +70,7 @@
     available_linkers,
     get_linker,
 )
+from openmed.core.quality_gates import validate_entity_spans_strict
 
 # --------------------------------------------------------------------------- #
 # Fixtures and synthetic data (synthetic-only; no real PHI, no DUA vocab).
@@ -74,6 +79,11 @@
 _FIXTURE_ROOT = Path(__file__).resolve().parents[1] / "fixtures" / "clinical"
 _GROUNDING_FIXTURES = _FIXTURE_ROOT / "grounding"
 _GOLDEN = _FIXTURE_ROOT / "e2e" / "discharge_summary_golden.json"
+_GOLDEN_CASES = (
+    _GOLDEN,
+    _FIXTURE_ROOT / "e2e" / "code_mixed_golden.json",
+    _FIXTURE_ROOT / "e2e" / "hypothetical_golden.json",
+)
 
 # A single embedded synthetic clinical note. It carries structured PHI that the
 # deterministic safety sweep redacts offline (date / phone / email / MRN / SSN)
@@ -224,7 +234,7 @@ def _run_pipeline(golden: dict[str, Any], linkers: dict[str, Any]) -> dict[str,
 
     # Stage 1 - de-identification (real deidentify, offline safety sweep).
     deid = deidentify(
-        SYNTHETIC_NOTE,
+        golden["source_note"],
         method="mask",
         confidence_threshold=0.5,
         loader=_NoDownloadLoader(),
@@ -274,6 +284,12 @@ def _run_pipeline(golden: dict[str, Any], linkers: dict[str, Any]) -> dict[str,
         system = expected["grounding_system"]
         linker = linkers[system]
         candidates = linker.link(entity.text, canonical_label=entity.label, fuzzy=False)
+        # The synthetic local vocabulary is caller-pinned so the shared exporter
+        # exercises Coding.version provenance without a terminology download.
+        candidates = [
+            replace(candidate, vocab_version=linker._vocab.content_hash)
+            for candidate in candidates
+        ]
 
         grounded = GroundedSpan(
             text=entity.text,
@@ -703,3 +719,113 @@ def test_grounding_candidates_are_typed(pipeline):
     for row in pipeline["per_entity"]:
         for candidate in row["candidates"]:
             assert isinstance(candidate, Candidate)
+
+
+def _pipeline_snapshot(result: dict[str, Any]) -> dict[str, Any]:
+    """Capture stage outputs that reviewers approve as synthetic golden data."""
+    return {
+        "entities": [
+            {
+                "text": row["entity"].text,
+                "start": row["entity"].start,
+                "end": row["entity"].end,
+                "label": row["entity"].label,
+                "negation": row["context"].negation,
+                "temporality": row["context"].temporality,
+                "certainty": row["context"].certainty,
+                "code": row["candidates"][0].code,
+                "system": row["concept"]["coding"][0]["system"],
+                "vocab_version": row["concept"]["coding"][0]["version"],
+                "resource_type": row["resource"]["resourceType"],
+                "status": row["status"],
+            }
+            for row in result["per_entity"]
+        ],
+        "fhir_bundle": {
+            "resource_type": result["bundle"]["resourceType"],
+            "type": result["bundle"]["type"],
+            "entry_types": [
+                entry["resource"]["resourceType"] for entry in result["bundle"]["entry"]
+            ],
+        },
+    }
+
+
+@pytest.mark.integration
+@pytest.mark.parametrize("case_path", _GOLDEN_CASES, ids=lambda path: path.stem)
+def test_pipeline_cases_match_committed_golden(case_path, grounding_linkers):
+    """Pin English, code-mixed, and hypothetical full-pipeline handoffs."""
+    case = json.loads(case_path.read_text(encoding="utf-8"))
+    assert case["synthetic"] is True
+    assert case["source_rights"] == "generated synthetic fixture"
+    assert case["language"] in {"en", "es-en"}
+    result = _run_pipeline(case, grounding_linkers)
+
+    ner_check = validate_entity_spans_strict(
+        result["analysis"].entities, result["deidentified_text"]
+    )
+    grounding_check = validate_entity_spans_strict(
+        [
+            SimpleNamespace(
+                text=span.text,
+                start=span.start,
+                end=span.end,
+                label=row["entity"].label,
+                metadata={},
+            )
+            for span, row in zip(
+                result["grounded_spans"], result["per_entity"], strict=True
+            )
+        ],
+        result["deidentified_text"],
+    )
+    assert ner_check.passed and ner_check.offsetless_spans == 0, ner_check.to_dict()
+    assert grounding_check.passed and grounding_check.off
```

---

### Incident Patch 11: `24a13406` (2026-09-27)
**Commit Message**: Merge pull request #3542 from maziyarpanahi/fix/issue-1983-offline-cache-loading

fix: load prefetched models offline with Transformers 5

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -251,6 +251,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Load prefetched Hugging Face models from the standard cache during offline
+  inference, including Transformers 5.x pipeline and component loading (#1983).
 - Require strict decoder validation before auto-detecting ISCII, preserving
   malformed Latin-1 strings through privacy preprocessing instead of raising
   or partially rewriting the input (#3242).
```

**File**: `openmed/core/models.py` (modified, +50/-11)
```diff
@@ -205,6 +205,7 @@ def load_model(
                 full_model_name,
                 local_only=bool(requested_local_loading.get("local_files_only")),
                 require_integrity=True,
+                revision=kwargs.get("revision"),
             )
 
         # A model loaded earlier under the permissive policy must not silently
@@ -233,6 +234,7 @@ def load_model(
                 model_name,
                 full_model_name,
                 local_only=bool(requested_local_loading.get("local_files_only")),
+                revision=kwargs.get("revision"),
             )
 
         try:
@@ -446,6 +448,7 @@ def _create_hf_pipeline(
             model_name,
             full_model_name,
             local_only=bool(requested_local_loading.get("local_files_only")),
+            revision=kwargs.get("revision"),
         )
 
         model_kwargs: Dict[str, Any] = {}
@@ -464,28 +467,22 @@ def _create_hf_pipeline(
                 pipeline_model_reference,
                 kwargs,
             )
-            prepared_reference_is_local = (
-                self._as_existing_local_path(pipeline_model_reference) is not None
-            )
             prepared_reference_local_only = bool(
                 local_loading_kwargs.get("local_files_only")
             )
             pipeline_load_kwargs = dict(kwargs)
             model_kwargs = dict(pipeline_load_kwargs.pop("model_kwargs", {}) or {})
-            # Transformers forwards loader options through ``model_kwargs``;
-            # top-level extras are sent to the instantiated pipeline instead.
+            # The local snapshot and socket guard enforce offline loading.
+            # Transformers 5 supplies local_files_only to AutoConfig itself;
+            # forwarding it through model_kwargs passes the keyword twice.
             pipeline_load_kwargs.pop("local_files_only", None)
             model_kwargs.update(local_loading_kwargs)
+            model_kwargs.pop("local_files_only", None)
             cache_dir = pipeline_load_kwargs.pop("cache_dir", None)
             if cache_dir is None and prepared_reference_local_only:
                 cache_dir = getattr(self.config, "cache_dir", None)
             if cache_dir is not None:
                 model_kwargs.setdefault("cache_dir", cache_dir)
-            if prepared_reference_is_local:
-                # Transformers 5 already marks filesystem model references as
-                # local. Repeating the option through ``model_kwargs`` makes
-                # AutoConfig receive ``local_files_only`` twice.
-                model_kwargs.pop("local_files_only", None)
             if "quantization_config" in pipeline_load_kwargs:
                 model_kwargs.setdefault(
                     "quantization_config",
@@ -772,19 +769,57 @@ def _prepare_model_reference(
         *,
         local_only: bool,
         require_integrity: bool = False,
+        revision: Optional[str] = None,
     ) -> str:
         """Resolve and verify cached artifacts before model construction."""
         registry_info = get_model_info(requested_model_name) or get_model_info(
             resolved_model_name
         )
-        return prepare_model_reference(
+        prepared_reference = prepare_model_reference(
             resolved_model_name,
             registry_info=registry_info,
             cache_dir=str(self.config.cache_dir),
             local_only=local_only,
             token=getattr(self.config, "hf_token", None),
             require_integrity=require_integrity,
         )
+        if (
+            require_integrity
+            or not local_only
+            or self._as_existing_local_path(prepared_reference) is not None
+        ):
+            return prepared_reference
+
+        cached_snapshot = self._find_cached_hf_snapshot(
+            prepared_reference,
+            revision=revision,
+        )
+        return cached_snapshot or prepared_reference
+
+    def _find_cached_hf_snapshot(
+        self,
+        model_name: str,
+        *,
+        revision: Optional[str] = None,
+    ) -> Optional[str]:
+        """Find a model snapshot in configured or standard Hub caches offline."""
+        from .hf_hub import _import_snapshot_download
+
+        snapshot_download, local_entry_not_found = _import_snapshot_download()
+        for cache_dir in (str(self.config.cache_dir), None):
+            download_kwargs: Dict[str, Any] = {
+                "repo_id": model_name,
+                "repo_type": "model",
+                "revision": revision,
+                "local_files_only": True,
+            }
+            if cache_dir is not None:
+                download_kwargs["cache_dir"] = cache_dir
+            try:
+                return str(snapshot_download(**download_kwargs))
+            except local_entry_not_found:
+                continue
+        return None
 
     def _as_existing_local_path(self, model_name: str) -> Optional[Path]:
         """Return a filesystem path when ``model_nam
```

**File**: `tests/unit/test_offline_mode.py` (modified, +123/-2)
```diff
@@ -63,7 +63,7 @@ def test_local_only_hf_pipeline_uses_cached_files(mock_pipeline, monkeypatch):
 
     pipeline_kwargs = mock_pipeline.call_args.kwargs
     assert "local_files_only" not in pipeline_kwargs
-    assert pipeline_kwargs["model_kwargs"]["local_files_only"] is True
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
     assert pipeline_kwargs["model_kwargs"]["cache_dir"] == loader.config.cache_dir
 
 
@@ -82,7 +82,128 @@ def test_local_only_config_cannot_be_disabled_by_pipeline_kwarg(
 
     pipeline_kwargs = mock_pipeline.call_args.kwargs
     assert "local_files_only" not in pipeline_kwargs
-    assert pipeline_kwargs["model_kwargs"]["local_files_only"] is True
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+@patch("openmed.core.backends._module_available", lambda _: True)
+@patch("openmed.core.models.pipeline")
+@patch("openmed.core.models.prepare_model_reference")
+@patch("openmed.core.hf_hub._import_snapshot_download")
+def test_prefetched_standard_hub_snapshot_loads_offline_without_duplicate_kwarg(
+    mock_import_snapshot_download,
+    mock_prepare_model_reference,
+    mock_pipeline,
+    tmp_path,
+    monkeypatch,
+):
+    _clear_offline_env(monkeypatch)
+    monkeypatch.setenv(OFFLINE_ENV_VAR, "1")
+    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
+    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
+
+    model_id = "OpenMed/prefetched-pii"
+    snapshot = tmp_path / "standard-hub" / "snapshot"
+    snapshot.mkdir(parents=True)
+    openmed_cache = tmp_path / "openmed-cache"
+    calls = []
+
+    class LocalEntryNotFoundError(Exception):
+        pass
+
+    def fake_snapshot_download(**kwargs):
+        calls.append(kwargs)
+        if "cache_dir" in kwargs:
+            raise LocalEntryNotFoundError
+        return str(snapshot)
+
+    mock_prepare_model_reference.return_value = model_id
+    mock_import_snapshot_download.return_value = (
+        fake_snapshot_download,
+        LocalEntryNotFoundError,
+    )
+
+    from openmed.core.models import ModelLoader
+
+    loader = ModelLoader(
+        OpenMedConfig(local_only=True, backend="hf", cache_dir=str(openmed_cache))
+    )
+    loader.create_pipeline(model_id, revision="a" * 40)
+
+    pipeline_kwargs = mock_pipeline.call_args.kwargs
+    assert pipeline_kwargs["model"] == str(snapshot)
+    assert "local_files_only" not in pipeline_kwargs
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+    assert calls == [
+        {
+            "repo_id": model_id,
+            "repo_type": "model",
+            "revision": "a" * 40,
+            "local_files_only": True,
+            "cache_dir": str(openmed_cache),
+        },
+        {
+            "repo_id": model_id,
+            "repo_type": "model",
+            "revision": "a" * 40,
+            "local_files_only": True,
+        },
+    ]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+@patch("openmed.core.backends._module_available", lambda _: True)
+@patch("openmed.core.models.pipeline")
+def test_nested_local_only_pipeline_kwarg_uses_cached_snapshot(
+    mock_pipeline, tmp_path, monkeypatch
+):
+    _clear_offline_env(monkeypatch)
+    snapshot = tmp_path / "snapshot"
+    snapshot.mkdir()
+
+    from openmed.core.models import ModelLoader
+
+    loader = ModelLoader(OpenMedConfig(backend="hf"))
+    with patch.object(
+        loader, "_prepare_model_reference", return_value=str(snapshot)
+    ) as mock_prepare:
+        loader.create_pipeline(
+            "OpenMed/local-pii",
+            model_kwargs={"local_files_only": True},
+        )
+
+    assert mock_prepare.call_args.kwargs["local_only"] is True
+    pipeline_kwargs = mock_pipeline.call_args.kwargs
+    assert pipeline_kwargs["model"] == str(snapshot)
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+def test_integrity_required_load_rejects_unverified_standard_cache(
+    tmp_path, monkeypatch
+):
+    _clear_offline_env(monkeypatch)
+
+    from openmed.core.model_integrity import ModelIntegrityError
+    from openmed.core.models import ModelLoader
+
+    model_id = "OpenMed/OpenMed-PII-SuperClinical-Base-184M-v1"
+    loader = ModelLoader(
+        OpenMedConfig(
+            local_only=True,
+            backend="hf",
+            cache_dir=str(tmp_path / "openmed-cache"),
+        )
+    )
+    with patch.object(loader, "_find_cached_hf_snapshot") as mock_find:
+        with pytest.raises(ModelIntegrityError):
+            loader._prepare_model_reference(
+                model_id,
+                model_id,
+                local_only=True,
+                require_integrity=True,
+            )
+    mock_find.assert_not_called()
 
 
 @patch("openmed.core.models.HF_AVAILABLE", True)
```

---

### Incident Patch 12: `7dbf28b6` (2026-09-27)
**Commit Message**: Merge pull request #3498 from kokokoXUY/fix/terminal-metadata-ttl

fix(service): keep a terminal job's full metadata retention

**File**: `openmed/service/jobs.py` (modified, +9/-4)
```diff
@@ -279,12 +279,16 @@ def shutdown(self) -> None:
             self._shutdown = True
         self._executor.shutdown(wait=False, cancel_futures=True)
 
-    def _new_record(self, payload: DeidentifyJobRequest) -> dict[str, Any]:
-        now = self.clock()
+    def _expiry_timestamp(self, moment: datetime) -> str:
+        """Return the metadata expiry for a record that reached *moment*."""
         expires_at = datetime.fromtimestamp(
-            now.timestamp() + self.store.ttl_seconds,
+            moment.timestamp() + self.store.ttl_seconds,
             tz=timezone.utc,
         )
+        return _isoformat(expires_at)
+
+    def _new_record(self, payload: DeidentifyJobRequest) -> dict[str, Any]:
+        now = self.clock()
         documents = [
             _document_metadata(index, document)
             for index, document in enumerate(payload.documents)
@@ -306,7 +310,7 @@ def _new_record(self, payload: DeidentifyJobRequest) -> dict[str, Any]:
             "updated_at": _isoformat(now),
             "started_at": None,
             "completed_at": None,
-            "expires_at": _isoformat(expires_at),
+            "expires_at": self._expiry_timestamp(now),
         }
 
     def _run_job(self, item: _JobWorkItem) -> None:
@@ -339,6 +343,7 @@ def _run_job(self, item: _JobWorkItem) -> None:
             progress_percent=100.0,
             error=error,
             completed_at=_isoformat(completed_at),
+            expires_at=self._expiry_timestamp(completed_at),
         )
         self._send_terminal_webhook(item.payload.webhook, final_record)
 
```

**File**: `tests/unit/service/test_jobs_api.py` (modified, +42/-0)
```diff
@@ -197,6 +197,48 @@ def process(_payload: DeidentifyJobRequest, document: DeidentifyJobDocument):
     assert "synthetic first" not in path.read_text(encoding="utf-8")
 
 
+def test_terminal_record_keeps_its_full_metadata_ttl_after_completion(
+    monkeypatch: pytest.MonkeyPatch,
+    tmp_path: Path,
+) -> None:
+    from types import SimpleNamespace
+
+    from openmed.service.schemas import DeidentifyJobDocument, DeidentifyJobRequest
+
+    now = [datetime(2026, 1, 1, tzinfo=timezone.utc)]
+    store = jobs.LocalJobStore(
+        tmp_path / "jobs.json",
+        ttl_seconds=10,
+        clock=lambda: now[0],
+    )
+    queue = jobs.DeidentifyJobQueue(
+        SimpleNamespace(),
+        store=store,
+        clock=lambda: now[0],
+    )
+    payload = DeidentifyJobRequest(
+        documents=[DeidentifyJobDocument(id="synthetic-0", text="synthetic sample")]
+    )
+    record = queue._new_record(payload)
+    store.create(record)
+
+    def process(_payload: DeidentifyJobRequest, _document: DeidentifyJobDocument):
+        now[0] += timedelta(seconds=11)
+        return SimpleNamespace(pii_entities=[])
+
+    monkeypatch.setattr(queue, "_deidentify_document", process)
+    try:
+        queue._run_job(jobs._JobWorkItem(record["id"], payload))
+    finally:
+        queue.shutdown()
+
+    completed = store.get(record["id"])
+    assert completed is not None
+    assert completed["completed_at"] == "2026-01-01T00:00:11Z"
+    assert completed["expires_at"] == "2026-01-01T00:00:21Z"
+    assert completed["status"] == "done"
+
+
 def _wait_for_job(
     client: TestClient,
     job_id: str,
```

---

### Incident Patch 13: `45b19ff5` (2026-09-27)
**Commit Message**: Merge pull request #3492 from kokokoXUY/fix/webhook-timeout-with-supplied-client

fix(service): honour the requested timeout for supplied webhook clients

**File**: `openmed/service/webhooks.py` (modified, +9/-1)
```diff
@@ -92,6 +92,9 @@ def deliver_webhook(
 
     Each HTTP delivery attempt receives its own timestamp and nonce so a
     receiver can apply replay protection without rejecting a legitimate retry.
+    ``timeout_seconds`` bounds each attempt's connect/read/write/pool I/O and is
+    applied to every request, including when the caller supplies ``client``; a
+    supplied client's own configuration and ownership are left unchanged.
     """
     if max_attempts < 1:
         raise ValueError("max_attempts must be at least 1")
@@ -121,7 +124,12 @@ def deliver_webhook(
             )
             headers = {**base_headers, **signed_headers}
             try:
-                response = active_client.post(url, content=body, headers=headers)
+                response = active_client.post(
+                    url,
+                    content=body,
+                    headers=headers,
+                    timeout=timeout_seconds,
+                )
                 last_status_code = response.status_code
                 if 200 <= response.status_code < 300:
                     return WebhookDeliveryResult(
```

**File**: `tests/unit/service/test_webhooks.py` (modified, +118/-0)
```diff
@@ -13,6 +13,7 @@
     verify_request_signature,
 )
 from openmed.service.webhooks import (
+    DEFAULT_WEBHOOK_TIMEOUT_SECONDS,
     SIGNATURE_HEADER,
     TIMESTAMP_HEADER,
     canonical_json_bytes,
@@ -129,3 +130,120 @@ def test_canonical_json_bytes_is_stable() -> None:
         separators=(",", ":"),
         sort_keys=True,
     ).encode("utf-8")
+
+
+def _timeout_extensions(seconds: float) -> dict[str, float]:
+    return {"connect": seconds, "read": seconds, "write": seconds, "pool": seconds}
+
+
+def _recording_transport(
+    seen: list[dict[str, float]],
+    statuses: list[int] | None = None,
+) -> httpx.MockTransport:
+    remaining = list(statuses or [204])
+
+    def handler(request: httpx.Request) -> httpx.Response:
+        seen.append(dict(request.extensions["timeout"]))
+        status = remaining.pop(0) if remaining else 204
+        return httpx.Response(status)
+
+    return httpx.MockTransport(handler)
+
+
+def test_deliver_webhook_applies_timeout_to_a_supplied_client() -> None:
+    seen: list[dict[str, float]] = []
+    with httpx.Client(
+        timeout=None,
+        transport=_recording_transport(seen),
+    ) as client:
+        result = deliver_webhook(
+            "https://callbacks.example.test/openmed",
+            {"event": "job.done", "job_id": "abc", "status": "done"},
+            secret="secret",
+            client=client,
+            timeout_seconds=0.5,
+            max_attempts=1,
+        )
+
+        assert result.success is True
+        assert seen == [_timeout_extensions(0.5)]
+        assert client.is_closed is False
+
+
+def test_deliver_webhook_timeout_overrides_the_supplied_client_default() -> None:
+    seen: list[dict[str, float]] = []
+    with httpx.Client(
+        timeout=httpx.Timeout(30.0),
+        transport=_recording_transport(seen),
+    ) as client:
+        result = deliver_webhook(
+            "https://callbacks.example.test/openmed",
+            {"event": "job.done", "job_id": "abc", "status": "done"},
+            secret="secret",
+            client=client,
+            timeout_seconds=1.25,
+            max_attempts=1,
+        )
+
+        assert result.success is True
+        assert seen == [_timeout_extensions(1.25)]
+        assert client.timeout.connect == 30.0
+        assert client.timeout.read == 30.0
+
+
+def test_deliver_webhook_applies_timeout_to_every_attempt() -> None:
+    seen: list[dict[str, float]] = []
+    client = httpx.Client(
+        timeout=None,
+        transport=_recording_transport(seen, statuses=[503, 204]),
+    )
+    result = deliver_webhook(
+        "https://callbacks.example.test/openmed",
+        {"event": "job.done", "job_id": "abc", "status": "done"},
+        secret="secret",
+        client=client,
+        timeout_seconds=0.25,
+        max_attempts=2,
+        backoff_seconds=0,
+    )
+
+    assert result.success is True
+    assert result.attempts == 2
+    assert seen == [_timeout_extensions(0.25), _timeout_extensions(0.25)]
+
+
+def test_deliver_webhook_uses_the_default_timeout_when_unspecified() -> None:
+    seen: list[dict[str, float]] = []
+    with httpx.Client(
+        timeout=None,
+        transport=_recording_transport(seen),
+    ) as client:
+        deliver_webhook(
+            "https://callbacks.example.test/openmed",
+            {"event": "job.done", "job_id": "abc", "status": "done"},
+            secret="secret",
+            client=client,
+            max_attempts=1,
+        )
+
+        assert seen == [_timeout_extensions(DEFAULT_WEBHOOK_TIMEOUT_SECONDS)]
+
+
+def test_deliver_webhook_leaves_the_supplied_client_ownership_alone() -> None:
+    seen: list[dict[str, float]] = []
+    client = httpx.Client(
+        timeout=httpx.Timeout(30.0),
+        transport=_recording_transport(seen),
+    )
+    deliver_webhook(
+        "https://callbacks.example.test/openmed",
+        {"event": "job.done", "job_id": "abc", "status": "done"},
+        secret="secret",
+        client=client,
+        timeout_seconds=0.5,
+        max_attempts=1,
+    )
+
+    assert client.is_closed is False
+    assert client.timeout.connect == 30.0
+    client.close()
```

---

### Incident Patch 14: `8a23ed24` (2026-09-27)
**Commit Message**: fix: load prefetched models from Hub cache offline

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -251,6 +251,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Load prefetched Hugging Face models from the standard cache during offline
+  inference, including Transformers 5.x pipeline and component loading (#1983).
 - Require strict decoder validation before auto-detecting ISCII, preserving
   malformed Latin-1 strings through privacy preprocessing instead of raising
   or partially rewriting the input (#3242).
```

**File**: `openmed/core/models.py` (modified, +50/-11)
```diff
@@ -205,6 +205,7 @@ def load_model(
                 full_model_name,
                 local_only=bool(requested_local_loading.get("local_files_only")),
                 require_integrity=True,
+                revision=kwargs.get("revision"),
             )
 
         # A model loaded earlier under the permissive policy must not silently
@@ -233,6 +234,7 @@ def load_model(
                 model_name,
                 full_model_name,
                 local_only=bool(requested_local_loading.get("local_files_only")),
+                revision=kwargs.get("revision"),
             )
 
         try:
@@ -446,6 +448,7 @@ def _create_hf_pipeline(
             model_name,
             full_model_name,
             local_only=bool(requested_local_loading.get("local_files_only")),
+            revision=kwargs.get("revision"),
         )
 
         model_kwargs: Dict[str, Any] = {}
@@ -464,28 +467,22 @@ def _create_hf_pipeline(
                 pipeline_model_reference,
                 kwargs,
             )
-            prepared_reference_is_local = (
-                self._as_existing_local_path(pipeline_model_reference) is not None
-            )
             prepared_reference_local_only = bool(
                 local_loading_kwargs.get("local_files_only")
             )
             pipeline_load_kwargs = dict(kwargs)
             model_kwargs = dict(pipeline_load_kwargs.pop("model_kwargs", {}) or {})
-            # Transformers forwards loader options through ``model_kwargs``;
-            # top-level extras are sent to the instantiated pipeline instead.
+            # The local snapshot and socket guard enforce offline loading.
+            # Transformers 5 supplies local_files_only to AutoConfig itself;
+            # forwarding it through model_kwargs passes the keyword twice.
             pipeline_load_kwargs.pop("local_files_only", None)
             model_kwargs.update(local_loading_kwargs)
+            model_kwargs.pop("local_files_only", None)
             cache_dir = pipeline_load_kwargs.pop("cache_dir", None)
             if cache_dir is None and prepared_reference_local_only:
                 cache_dir = getattr(self.config, "cache_dir", None)
             if cache_dir is not None:
                 model_kwargs.setdefault("cache_dir", cache_dir)
-            if prepared_reference_is_local:
-                # Transformers 5 already marks filesystem model references as
-                # local. Repeating the option through ``model_kwargs`` makes
-                # AutoConfig receive ``local_files_only`` twice.
-                model_kwargs.pop("local_files_only", None)
             if "quantization_config" in pipeline_load_kwargs:
                 model_kwargs.setdefault(
                     "quantization_config",
@@ -772,19 +769,57 @@ def _prepare_model_reference(
         *,
         local_only: bool,
         require_integrity: bool = False,
+        revision: Optional[str] = None,
     ) -> str:
         """Resolve and verify cached artifacts before model construction."""
         registry_info = get_model_info(requested_model_name) or get_model_info(
             resolved_model_name
         )
-        return prepare_model_reference(
+        prepared_reference = prepare_model_reference(
             resolved_model_name,
             registry_info=registry_info,
             cache_dir=str(self.config.cache_dir),
             local_only=local_only,
             token=getattr(self.config, "hf_token", None),
             require_integrity=require_integrity,
         )
+        if (
+            require_integrity
+            or not local_only
+            or self._as_existing_local_path(prepared_reference) is not None
+        ):
+            return prepared_reference
+
+        cached_snapshot = self._find_cached_hf_snapshot(
+            prepared_reference,
+            revision=revision,
+        )
+        return cached_snapshot or prepared_reference
+
+    def _find_cached_hf_snapshot(
+        self,
+        model_name: str,
+        *,
+        revision: Optional[str] = None,
+    ) -> Optional[str]:
+        """Find a model snapshot in configured or standard Hub caches offline."""
+        from .hf_hub import _import_snapshot_download
+
+        snapshot_download, local_entry_not_found = _import_snapshot_download()
+        for cache_dir in (str(self.config.cache_dir), None):
+            download_kwargs: Dict[str, Any] = {
+                "repo_id": model_name,
+                "repo_type": "model",
+                "revision": revision,
+                "local_files_only": True,
+            }
+            if cache_dir is not None:
+                download_kwargs["cache_dir"] = cache_dir
+            try:
+                return str(snapshot_download(**download_kwargs))
+            except local_entry_not_found:
+                continue
+        return None
 
     def _as_existing_local_path(self, model_name: str) -> Optional[Path]:
         """Return a filesystem path when ``model_nam
```

**File**: `tests/unit/test_offline_mode.py` (modified, +123/-2)
```diff
@@ -63,7 +63,7 @@ def test_local_only_hf_pipeline_uses_cached_files(mock_pipeline, monkeypatch):
 
     pipeline_kwargs = mock_pipeline.call_args.kwargs
     assert "local_files_only" not in pipeline_kwargs
-    assert pipeline_kwargs["model_kwargs"]["local_files_only"] is True
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
     assert pipeline_kwargs["model_kwargs"]["cache_dir"] == loader.config.cache_dir
 
 
@@ -82,7 +82,128 @@ def test_local_only_config_cannot_be_disabled_by_pipeline_kwarg(
 
     pipeline_kwargs = mock_pipeline.call_args.kwargs
     assert "local_files_only" not in pipeline_kwargs
-    assert pipeline_kwargs["model_kwargs"]["local_files_only"] is True
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+@patch("openmed.core.backends._module_available", lambda _: True)
+@patch("openmed.core.models.pipeline")
+@patch("openmed.core.models.prepare_model_reference")
+@patch("openmed.core.hf_hub._import_snapshot_download")
+def test_prefetched_standard_hub_snapshot_loads_offline_without_duplicate_kwarg(
+    mock_import_snapshot_download,
+    mock_prepare_model_reference,
+    mock_pipeline,
+    tmp_path,
+    monkeypatch,
+):
+    _clear_offline_env(monkeypatch)
+    monkeypatch.setenv(OFFLINE_ENV_VAR, "1")
+    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
+    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
+
+    model_id = "OpenMed/prefetched-pii"
+    snapshot = tmp_path / "standard-hub" / "snapshot"
+    snapshot.mkdir(parents=True)
+    openmed_cache = tmp_path / "openmed-cache"
+    calls = []
+
+    class LocalEntryNotFoundError(Exception):
+        pass
+
+    def fake_snapshot_download(**kwargs):
+        calls.append(kwargs)
+        if "cache_dir" in kwargs:
+            raise LocalEntryNotFoundError
+        return str(snapshot)
+
+    mock_prepare_model_reference.return_value = model_id
+    mock_import_snapshot_download.return_value = (
+        fake_snapshot_download,
+        LocalEntryNotFoundError,
+    )
+
+    from openmed.core.models import ModelLoader
+
+    loader = ModelLoader(
+        OpenMedConfig(local_only=True, backend="hf", cache_dir=str(openmed_cache))
+    )
+    loader.create_pipeline(model_id, revision="a" * 40)
+
+    pipeline_kwargs = mock_pipeline.call_args.kwargs
+    assert pipeline_kwargs["model"] == str(snapshot)
+    assert "local_files_only" not in pipeline_kwargs
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+    assert calls == [
+        {
+            "repo_id": model_id,
+            "repo_type": "model",
+            "revision": "a" * 40,
+            "local_files_only": True,
+            "cache_dir": str(openmed_cache),
+        },
+        {
+            "repo_id": model_id,
+            "repo_type": "model",
+            "revision": "a" * 40,
+            "local_files_only": True,
+        },
+    ]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+@patch("openmed.core.backends._module_available", lambda _: True)
+@patch("openmed.core.models.pipeline")
+def test_nested_local_only_pipeline_kwarg_uses_cached_snapshot(
+    mock_pipeline, tmp_path, monkeypatch
+):
+    _clear_offline_env(monkeypatch)
+    snapshot = tmp_path / "snapshot"
+    snapshot.mkdir()
+
+    from openmed.core.models import ModelLoader
+
+    loader = ModelLoader(OpenMedConfig(backend="hf"))
+    with patch.object(
+        loader, "_prepare_model_reference", return_value=str(snapshot)
+    ) as mock_prepare:
+        loader.create_pipeline(
+            "OpenMed/local-pii",
+            model_kwargs={"local_files_only": True},
+        )
+
+    assert mock_prepare.call_args.kwargs["local_only"] is True
+    pipeline_kwargs = mock_pipeline.call_args.kwargs
+    assert pipeline_kwargs["model"] == str(snapshot)
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+def test_integrity_required_load_rejects_unverified_standard_cache(
+    tmp_path, monkeypatch
+):
+    _clear_offline_env(monkeypatch)
+
+    from openmed.core.model_integrity import ModelIntegrityError
+    from openmed.core.models import ModelLoader
+
+    model_id = "OpenMed/OpenMed-PII-SuperClinical-Base-184M-v1"
+    loader = ModelLoader(
+        OpenMedConfig(
+            local_only=True,
+            backend="hf",
+            cache_dir=str(tmp_path / "openmed-cache"),
+        )
+    )
+    with patch.object(loader, "_find_cached_hf_snapshot") as mock_find:
+        with pytest.raises(ModelIntegrityError):
+            loader._prepare_model_reference(
+                model_id,
+                model_id,
+                local_only=True,
+                require_integrity=True,
+            )
+    mock_find.assert_not_called()
 
 
 @patch("openmed.core.models.HF_AVAILABLE", True)
```

---

### Incident Patch 15: `6cd469ba` (2026-09-26)
**Commit Message**: fix: validate schema extraction source offsets

**File**: `openmed/structured/schema_extract.py` (modified, +34/-21)
```diff
@@ -189,8 +189,8 @@ def extract_to_schema(
     specs, required = _compile_schema(schema)
 
     candidates: dict[FieldSource, dict[str, list[_Candidate]]] = {
-        "entity": _entity_candidates(entities),
-        "table": _table_candidates(tables),
+        "entity": _entity_candidates(text, entities),
+        "table": _table_candidates(text, tables),
         "key_value": _key_value_candidates(text),
     }
 
@@ -449,55 +449,68 @@ def _coerce(spec: _FieldSpec, raw: str) -> tuple[Any, str | None]:
     return value, None
 
 
-def _entity_candidates(entities: Iterable[Any]) -> dict[str, list[_Candidate]]:
+def _entity_candidates(
+    text: str, entities: Iterable[Any]
+) -> dict[str, list[_Candidate]]:
     by_label: dict[str, list[_Candidate]] = {}
     for entity in entities:
         label = _field(entity, "label")
         start = _field(entity, "start")
         end = _field(entity, "end")
-        if not isinstance(label, str) or not _is_offset(start) or not _is_offset(end):
+        if (
+            not isinstance(label, str)
+            or not _is_offset(start)
+            or not _is_offset(end)
+            or end <= start
+            or end > len(text)
+        ):
             continue
-        raw = _field(entity, "text")
-        raw = str(raw).strip() if raw is not None else ""
-        if not raw:
+        raw = text[start:end]
+        supplied = _field(entity, "text")
+        if not raw or (supplied is not None and supplied != raw):
             continue
         by_label.setdefault(label.casefold(), []).append(
-            _Candidate(raw=raw, start=int(start), end=int(end), source="entity")
+            _Candidate(raw=raw, start=start, end=end, source="entity")
         )
     return by_label
 
 
 def _table_candidates(
+    text: str,
     tables: Iterable[Mapping[str, Any]],
 ) -> dict[str, list[_Candidate]]:
     by_key: dict[str, list[_Candidate]] = {}
     for table in tables:
         cells = table.get("cells") if isinstance(table, Mapping) else None
-        if not cells:
+        if not isinstance(cells, (list, tuple)) or not cells:
             continue
         rows: dict[int, dict[int, Mapping[str, Any]]] = {}
         for cell in cells:
             if isinstance(cell, Mapping):
-                rows.setdefault(cell["row"], {})[cell["column"]] = cell
+                row, column = cell.get("row"), cell.get("column")
+                start, end = cell.get("start"), cell.get("end")
+                if not (
+                    _is_offset(row)
+                    and _is_offset(column)
+                    and _is_offset(start)
+                    and _is_offset(end)
+                    and start < end <= len(text)
+                    and cell.get("text") == text[start:end]
+                ):
+                    continue
+                rows.setdefault(row, {})[column] = cell
         for _, columns in sorted(rows.items()):
             ordered = [columns[col] for col in sorted(columns)]
             if len(ordered) < 2:
                 continue
             key_cell, value_cell = ordered[0], ordered[1]
             key = normalize_field_key(str(key_cell.get("text", "")))
-            raw = str(value_cell.get("text", "")).strip()
-            if not key or not raw:
-                continue
             start = value_cell.get("start")
             end = value_cell.get("end")
-            if not (
-                isinstance(start, int)
-                and not isinstance(start, bool)
-                and start >= 0
-                and isinstance(end, int)
-                and not isinstance(end, bool)
-                and end >= 0
-            ):
+            if not (_is_offset(start) and _is_offset(end) and start < end <= len(text)):
+                continue
+            raw = text[start:end]
+            if not key or not raw or value_cell.get("text") != raw:
                 continue
             by_key.setdefault(key, []).append(
                 _Candidate(raw=raw, start=start, end=end, source="table")
```

**File**: `tests/unit/structured/test_schema_extract.py` (modified, +54/-0)
```diff
@@ -251,6 +251,60 @@ def test_entity_source_wins_over_key_value_for_same_slot():
     assert (binding["start"], binding["end"]) == (start, end)
 
 
+def test_entity_provenance_must_match_the_source_span():
+    text = "Stage: 2\n"
+    start, end = _span(text, "2")
+    schema = {"properties": {"stage": {"type": "integer", "entity": "STAGE"}}}
+
+    for entity in (
+        {"label": "STAGE", "text": "9", "start": start, "end": end},
+        {"label": "STAGE", "text": "2", "start": len(text), "end": len(text) + 1},
+        {"label": "STAGE", "text": "2", "start": end, "end": start},
+    ):
+        result = extract_to_schema(text, schema, entities=[entity])
+        assert result["data"] == {"stage": 2}
+        assert result["bindings"]["stage"]["source"] == "key_value"
+
+    result = extract_to_schema(
+        text, schema, entities=[{"label": "STAGE", "start": start, "end": end}]
+    )
+    assert result["bindings"]["stage"]["source"] == "entity"
+    assert text[start:end] == result["bindings"]["stage"]["raw"]
+
+
+def test_malformed_table_cells_do_not_create_false_provenance_or_raise():
+    text = "Sodium 140\n"
+    start, end = _span(text, "140")
+    schema = {
+        "required": ["sodium"],
+        "properties": {"sodium": {"type": "integer"}},
+    }
+    key_cell = {"row": 0, "column": 0, "text": "Sodium", "start": 0, "end": 6}
+
+    for bad_cell in (
+        {"row": 0, "text": "140", "start": start, "end": end},
+        {"row": 0, "column": 1, "text": "999", "start": start, "end": end},
+        {"row": 0, "column": 1, "text": "140", "start": end, "end": end + 3},
+    ):
+        result = extract_to_schema(
+            text, schema, tables=[{"cells": [key_cell, bad_cell]}]
+        )
+        assert result["data"] == {}
+        assert result["missing_required"] == ["sodium"]
+
+    assert extract_to_schema(text, schema, tables=[{"cells": 42}])["data"] == {}
+    valid = {"row": 0, "column": 1, "text": "140", "start": start, "end": end}
+    mismatched_key = {**key_cell, "text": "Potassium"}
+    result = extract_to_schema(
+        text, schema, tables=[{"cells": [mismatched_key, valid]}]
+    )
+    assert result["missing_required"] == ["sodium"]
+
+    result = extract_to_schema(text, schema, tables=[{"cells": [key_cell, valid]}])
+    assert result["data"] == {"sodium": 140}
+    assert text[start:end] == result["bindings"]["sodium"]["raw"]
+
+
 # --------------------------------------------------------------------------
 # Schema validation (bad schema raises; bad document never does)
 # --------------------------------------------------------------------------
```

#### Recent Merged Pull Requests:
- **PR #3971** (2026-10-03): Validate installed SDK compatibility across desktop Python platforms (@maziyarpanahi)
- **PR #3631** (2026-10-03): Assert the GLiNER privacy error on its rendering, not the full traceback (@kokokoXUY)
- **PR #3629** (2026-10-03): Guard POSIX file-mode assertion in brief surface tests (@kokokoXUY)
- **PR #3613** (2026-09-29): Add offline clinical brief walkthrough and golden regression (@maziyarpanahi)
- **PR #3612** (2026-09-29): Add guarded native clinical briefs and demo integration (@maziyarpanahi)
- **PR #3611** (2026-09-29): Gate summary release on measured local evidence (@maziyarpanahi)
- **PR #3610** (2026-09-29): Expose guarded clinical brief interfaces and clients (@maziyarpanahi)
- **PR #3609** (2026-09-29): Compose guarded local clinical briefs (@maziyarpanahi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
