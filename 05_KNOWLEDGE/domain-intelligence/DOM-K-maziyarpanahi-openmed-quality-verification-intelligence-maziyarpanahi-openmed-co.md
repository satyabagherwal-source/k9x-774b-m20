# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: maziyarpanahi/openmed Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "maziyarpanahi/openmed",
  "source_url": "https://github.com/maziyarpanahi/openmed",
  "source_version": "5b79cae5",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T19:18:15.798Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-maziyarpanahi-openmed",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed) (Revision: `5b79cae5`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T19:18:15.798Z`  
> **Learning ID**: `learn-github-maziyarpanahi-openmed`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 51%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from maziyarpanahi/openmed:

# Forensic Learning Record (Deep Inspection): maziyarpanahi/openmed

> **Canonical Artifact**: `07_PROJECT_LEARNING/maziyarpanahi-openmed-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T19:18:13.819Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maziyarpanahi/openmed`
- **Description**: Local-first healthcare AI: clinical NER and HIPAA PII de-identification on hardware you control. 2,200+ medical models, 35 model-backed PII languages, and Python, MLX, Android and browser runtimes. Apache-2.0 SDK.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5854 stars

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

### Core Architecture Module: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/OpenMedLifecycle.kt`
```
package com.openmed.openmedkit

import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import java.io.Closeable
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Value-free memory-pressure levels understood by [OpenMedRuntime].
 *
 * Levels are ordered by severity. [OpenMedRuntimePolicy] decides which level
 * releases idle sessions and which level stops admission.
 */
enum class OpenMedMemoryPressure {
    /** Pressure has cleared; a memory-pressure admission pause is lifted. */
    NONE,

    /** Informational; the default policy takes no action. */
    MODERATE,

    /** Release idle sessions; admission stays open. */
    LOW,

    /** Stop admission and release sessions once they are idle. */
    CRITICAL,
    ;

    companion object {
        /**
         * Map an Android `ComponentCallbacks2.onTrimMemory` level.
         *
         * | Android level | Pressure |
         * | --- | --- |
         * | `TRIM_MEMORY_RUNNING_MODERATE` | [MODERATE] |
         * | `TRIM_MEMORY_RUNNING_LOW` | [LOW] |
         * | `TRIM_MEMORY_RUNNING_CRITICAL` | [CRITICAL] |
         * | `TRIM_MEMORY_UI_HIDDEN` | [MODERATE] |
         * | `TRIM_MEMORY_BACKGROUND`, `TRIM_MEMORY_MODERATE` | [LOW] |
         * | `TRIM_MEMORY_COMPLETE` and above | [CRITICAL] |
         *
         * Unknown levels below `TRIM_MEMORY_RUNNING_MODERATE` map to
         * [MODERATE] so an unrecognised signal never lifts a pause.
         *
         * @param level The raw Android trim level.
         * @return The value-free pressure level.
         */
        @JvmStatic
        fun fromTrimLevel(level: Int): OpenMedMemoryPressure = when {
            level >= ComponentCallbacks2.TRIM_MEMORY_COMPLETE -> CRITICAL
            level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND -> LOW
            level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN -> MODERATE
            level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL -> CRITICAL
            level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW -> LOW
            else -> MODERATE
        }
    }
}

/**
 * Host lifecycle signals an [OpenMedRuntime] reacts to.
 *
 * Signals carry no host object, so a runtime never retains an Activity,
 * a bridge context, or caller input through this interface.
 */
interface OpenMedLifecycleObserver {
    /** The host process moved to the foreground. */
    fun onHostForeground()

    /** The host process moved to the background. */
    fun onHostBackground()

    /**
     * The platform reported memory pressure.
     *
     * @param pressure The value-free pressure level.
     */
    fun onMemoryPressure(pressure: OpenMedMemoryPressure)
}

/**
 * A source of host lifecycle signals, such as `ProcessLifecycleOwner` or trim-memory callbacks.
 *
 * OpenMedKit does not depend on `androidx.lifecycle`; hosts adapt their own
 * lifecycle owner with a few lines (see `docs/android-integration.md`).
 */
fun interface OpenMedLifecycleSource {
    /**
     * Start delivering signals to [observer].
     *
     * @param observer The runtime that receives signals.
     * @return A handle that stops delivery and drops the observer when closed.
     */
    fun subscribe(observer: OpenMedLifecycleObserver): Closeable
}

/**
 * `ComponentCallbacks2` adapter that forwards trim-memory signals.
 *
 * @param observer The runtime that receives value-free pressure levels.
 */
class OpenMedComponentCallbacks(
    private val observer: OpenMedLifecycleObserver,
) : ComponentCallbacks2 {
    override fun onTrimMemory(level: Int) {
        observer.onMemoryPressure(OpenMedMemoryPressure.fromTrimLevel(level))
    }

    override fun onLowMemory() {
        observer.onMemoryPressure(OpenMedMemoryPressure.CRITICAL)
    }

    override fun onConfigurationChanged(newConfig: Configuration) = Unit
}

/**
 * Trim-memory source registered on the application context.
 *
 * Only the application context is retained, so binding from an Activity or a
 * bridge module never keeps that host alive after it is recreated.
 *
 * @param context Any context; its application context is used.
 */
class OpenMedTrimMemorySource(context: Context) : OpenMedLifecycleSource {
    private val applicationContext: Context = context.applicationContext ?: context

    override fun subscribe(observer: OpenMedLifecycleObserver): Closeable {
        val callbacks = OpenMedComponentCallbacks(observer)
        applicationContext.registerComponentCallbacks(callbacks)
        val open = AtomicBoolean(true)
        return Closeable {
            if (open.compareAndSet(true, false)) {
                applicationContext.unregisterComponentCallbacks(callbacks)
            }
        }
    }
}

```

### Core Architecture Module: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/deid/DeidentifyEngine.kt`
```
package com.openmed.openmedkit.deid

import com.openmed.openmedkit.secrets.OpenMedSecretException
import com.openmed.openmedkit.secrets.OpenMedSecretFailure
import com.openmed.openmedkit.secrets.OpenMedSecretPolicy
import com.openmed.openmedkit.secrets.OpenMedSecretProvider
import com.openmed.openmedkit.secrets.OpenMedSecretPurpose
import com.openmed.openmedkit.secrets.OpenMedSecretReference
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Locale
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.max
import kotlin.math.min

/** How a [DeidentifyEngine] treats the public, pre-4.0 default hash key. */
enum class HashKeyPolicy {
    /** Refuse the public default key however it is supplied (default). */
    STRICT,

    /** Accept the public default key only to reproduce pre-4.0 digests. */
    ALLOW_LEGACY_PUBLIC_SALT,
}

/**
 * Rewrites detected identifier spans into de-identified text.
 *
 * The engine accepts original-text offsets and applies replacements from
 * right to left, so each span is replaced at its original offsets even when
 * earlier spans expand or shrink the output.
 *
 * Hashing, meaning the [DeidentifyMethod.HASH] replacement and each applied
 * span's `textHash`, is keyed through an [OpenMedSecretProvider] such as
 * `AndroidKeystoreSecretProvider`, so the key never sits in app memory. An
 * engine built without a provider omits span digests and refuses
 * [DeidentifyMethod.HASH] with [OpenMedSecretException]
 * ([OpenMedSecretFailure.MISSING]); it never falls back to a public key.
 */
class DeidentifyEngine private constructor(
    private val hashKeys: HashKeySource?,
) {
    /** Keyless engine: masks, removes, and replaces; refuses hashing. */
    constructor() : this(null)

    /**
     * Engine whose hashing runs inside [secretProvider].
     *
     * Each `deidentify` call resolves the newest key version, so a rotation
     * takes effect on the next call. Provider failures surface as
     * [OpenMedSecretException] before any output is produced.
     *
     * @param secretProvider Custody boundary that holds the hash key.
     * @param hashKeyReference Reference with purpose
     *   [OpenMedSecretPurpose.DEIDENTIFY_HASH].
     * @param secretPolicy Protection the hash key must have.
     * @param hashKeyPolicy [HashKeyPolicy.STRICT] refuses a provider key that
     *   equals the public default salt.
     */
    constructor(
        secretProvider: OpenMedSecretProvider,
        hashKeyReference: OpenMedSecretReference = OpenMedSecretReference.DEIDENTIFY_HASH,
        secretPolicy: OpenMedSecretPolicy = OpenMedSecretPolicy.DEFAULT,
        hashKeyPolicy: HashKeyPolicy = HashKeyPolicy.STRICT,
    ) : this(ProviderHashKeys(secretProvider, hashKeyReference, secretPolicy, hashKeyPolicy))

    /**
     * Engine keyed by raw salt bytes held in app memory.
     *
     * Under [HashKeyPolicy.STRICT] the public [LEGACY_PUBLIC_HASH_SALT] is
     * refused with [OpenMedSecretFailure.PUBLIC_DEFAULT].
     */
    @Deprecated(
        "Raw salts live in app memory. Hold the hash key in an OpenMedSecretProvider.",
        ReplaceWith(
            "DeidentifyEngine(AndroidKeystoreSecretProvider())",
            "com.openmed.openmedkit.secrets.AndroidKeystoreSecretProvider",
        ),
    )
    constructor(
        hashSalt: ByteArray,
        hashKeyPolicy: HashKeyPolicy = HashKeyPolicy.STRICT,
    ) : this(RawSaltHashKeys(hashSalt, hashKeyPolicy))

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
        val mac = hashKeys?.open()
        val replacementState = ReplacementState()
        val orderedSpans = resolveOverlaps(spans)
        val actions = mutableListOf<DeidentifyAction>()
        var outputDelta = 0

        for (span in orderedSpans) {
            val method = actionForSpan(span)
            val surface = text.substring(span.start, span.end)
            val label = normalizeLabel(span.canonicalLabel)
            val textHash = mac?.let { hmacDigest(it, label, surface) }
            val replacement = replacementFor(method, label, surface, replacementState, textHash)
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
        textHash: String?,
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

            DeidentifyMethod.HASH ->
                textHash ?: throw OpenMedSecretException(OpenMedSecretFailure.MISSING)
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

    private fun hmacDigest(
        mac: (ByteArray) -> ByteArray,
        label: String,
        surface: String,
    ): String {
        val payload = "$label\u0000$surface".toByteArray(StandardCharsets.UTF_8)
        return "hmac-sha256:${mac(payload).toHex()}"
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
            r
```

### Core Architecture Module: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/intake/PdfPageRenderer.kt`
```
package com.openmed.openmedkit.intake

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import java.io.IOException
import kotlin.math.roundToInt

/**
 * A rendered PDF page ready for OCR.
 *
 * @param page Zero-based page index.
 * @param bitmap Upright rendering of the page, or of its declared crop.
 * @param geometry Original page geometry for evidence coordinates. When null,
 *   the bitmap itself is treated as the original page, in pixels.
 */
data class RenderedPdfPage(
    val page: Int,
    val bitmap: Bitmap,
    val geometry: DocumentPageGeometry? = null,
)

/**
 * One declared PDF page: rendered, or unavailable with a value-free reason.
 */
sealed class PdfPageEvent {
    /** A rendered page; the source recycles the bitmap after the callback. */
    data class Rendered(val page: RenderedPdfPage) : PdfPageEvent()

    /**
     * A declared page that could not be read, for example
     * [DocumentIntakeReason.PAGE_MISSING] or [DocumentIntakeReason.PERMISSION_LOST].
     */
    data class Unavailable(
        val page: Int,
        val reason: DocumentIntakeReason,
    ) : PdfPageEvent()
}

/**
 * Source of rendered PDF page bitmaps.
 */
fun interface PdfPageSource {
    suspend fun renderEach(
        context: Context,
        uri: Uri,
        block: suspend (RenderedPdfPage) -> Unit,
    )

    /**
     * Renders every declared page in order, reporting unreadable pages instead
     * of skipping them.
     *
     * Throw [DocumentIntakeException] for document-level failures such as
     * [DocumentIntakeReason.PERMISSION_DENIED]. The default adapts [renderEach].
     */
    suspend fun renderPages(
        context: Context,
        uri: Uri,
        block: suspend (PdfPageEvent) -> Unit,
    ) {
        renderEach(context, uri) { page -> block(PdfPageEvent.Rendered(page)) }
    }
}

/**
 * Renders PDF pages on-device with [PdfRenderer].
 *
 * [PdfRenderer] exposes only the displayed page size, so evidence from this
 * source is in displayed page points with no separate crop or rotation. A
 * [PdfPageSource] that reads the media box, crop box and `/Rotate` can declare
 * them through [RenderedPdfPage.geometry]. Bitmaps stay in memory and are
 * recycled after each callback; nothing is written to storage.
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
        renderPages(context, uri) { event ->
            when (event) {
                is PdfPageEvent.Rendered -> block(event.page)
                is PdfPageEvent.Unavailable -> throw DocumentIntakeException(event.reason)
            }
        }
    }

    override suspend fun renderPages(
        context: Context,
        uri: Uri,
        block: suspend (PdfPageEvent) -> Unit,
    ) {
        val descriptor = try {
            context.contentResolver.openFileDescriptor(uri, "r")
        } catch (_: SecurityException) {
            null
        } catch (_: IOException) {
            null
        } ?: throw DocumentIntakeException(DocumentIntakeReason.PERMISSION_DENIED)
        descriptor.use { fileDescriptor ->
            val renderer = try {
                PdfRenderer(fileDescriptor)
            } catch (_: SecurityException) {
                throw DocumentIntakeException(DocumentIntakeReason.DOCUMENT_LOCKED)
            } catch (_: IOException) {
                throw DocumentIntakeException(DocumentIntakeReason.UNSUPPORTED_DOCUMENT)
            }
            try {
                for (pageIndex in 0 until renderer.pageCount) {
                    val rendered = try {
                        render(renderer, pageIndex)
                    } catch (_: IllegalStateException) {
                        null
                    } catch (_: IllegalArgumentException) {
                        null
                    }
                    if (rendered == null) {
                        block(PdfPageEvent.Unavailable(pageIndex, DocumentIntakeReason.PAGE_MISSING))
                        continue
                    }
                    try {
                        block(PdfPageEvent.Rendered(rendered))
                    } finally {
                        rendered.bitmap.recycle()
                    }
                }
            } finally {
                renderer.close()
            }
        }
    }

    private fun render(renderer: PdfRenderer, pageIndex: Int): RenderedPdfPage {
        val page = renderer.openPage(pageIndex)
        try {
            val bitmap = Bitmap.createBitmap(
                (page.width * scale).roundToInt().coerceAtLeast(1),
                (page.height * scale).roundToInt().coerceAtLeast(1),
                Bitmap.Config.ARGB_8888,
            )
            try {
                bitmap.eraseColor(Color.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            } catch (error: RuntimeException) {
                bitmap.recycle()
                throw error
            }
            return RenderedPdfPage(
                page = pageIndex,
                bitmap = bitmap,
                geometry = DocumentPageGeometry(
                    width = page.width.toDouble(),
                    height = page.height.toDouble(),
                    unit = DocumentSpatialUnit.POINT,
                ),
            )
        } finally {
            page.close()
        }
    }
}

```

### Core Architecture Module: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/policy/PolicyEngine.kt`
```
package com.openmed.openmedkit.policy

import com.openmed.openmedkit.KitParity
import com.openmed.openmedkit.KitParityResult
import com.openmed.openmedkit.KitParitySpan
import com.openmed.openmedkit.UnicodeOffsetContract
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * One normalized detector span offered to [PolicyEngine.decide].
 *
 * Offsets are half-open Unicode scalar offsets into the source text.
 * [source] is `model` for model spans or `semantic` for pattern units;
 * [validated] reports whether a semantic unit's pattern validator passed.
 */
data class PolicyDetection(
    val label: String,
    val start: Int,
    val end: Int,
    val confidencePpm: Int,
    val source: String = "model",
    val validated: Boolean = true,
)

/** Value-free decision record for one candidate span. */
data class PolicyDecision(
    val inputs: List<Int>,
    /** `model`, `merged`, or `semantic_only`. */
    val kind: String,
    val label: String,
    val canonicalLabel: String,
    val recognized: Boolean,
    val start: Int,
    val end: Int,
    val confidencePpm: Int,
    val keepFloorPpm: Int,
    val escalate: Boolean,
    val action: String,
    val strictUpgrade: Boolean,
    /** `applied`, `overlap_loser`, `duplicate`, or `below_threshold`. */
    val outcome: String,
    val span: Int?,
)

/** Output of [PolicyEngine.decide]. */
data class PolicyDecisionResult(
    val policyName: String,
    val policyDigest: String,
    val result: KitParityResult,
    val decisions: List<PolicyDecision>,
)

/**
 * The portable policy decision engine (`openmed.portable_merge` version 1).
 *
 * Mirrors `openmed.core.portable_policy.decide`: validation, label
 * normalization, semantic-unit merging, integer parts-per-million threshold
 * decisions, action lookup with caller overrides and the strict no-leak
 * upgrade, exact-duplicate collapse, overlap clustering into union spans, and
 * right-to-left rendering at scalar offsets. Shared vectors in
 * `tests/fixtures/parity/portable_policy_vectors.json` pin the behavior.
 */
object PolicyEngine {
    const val SURROGATE_KEY_MIN_BYTES = 16
    const val SURROGATE_KEY_MAX_BYTES = 64
    private const val SURROGATE_DOMAIN = "openmed.portable_surrogate.v1"
    private val labelPattern = Regex("^[A-Za-z][A-Za-z0-9_:-]{0,79}$")

    /**
     * Apply [policy] to normalized [detections].
     *
     * Without a [surrogateKey], `replace` renders `[LABEL_REPLACED]`; with a
     * 16-to-64-byte caller key it renders a deterministic keyed surrogate.
     */
    fun decide(
        policy: PolicyProfile,
        text: String,
        detections: List<PolicyDetection>,
        overrides: Map<String, String> = emptyMap(),
        surrogateKey: ByteArray? = null,
    ): PolicyDecisionResult {
        validate(detections, UnicodeOffsetContract.scalarLength(text))
        val resolvedOverrides = validate(overrides, policy.taxonomy)
        if (surrogateKey != null && surrogateKey.size !in SURROGATE_KEY_MIN_BYTES..SURROGATE_KEY_MAX_BYTES) {
            throw PolicyProfileException("surrogate_key_invalid", "$.surrogate_key")
        }

        val candidates = buildCandidates(policy.taxonomy, detections)
        for (candidate in candidates) {
            val threshold = policy.thresholdFor(candidate.canonicalLabel)
            candidate.keepFloorPpm = threshold.keepFloorPpm
            val configured = resolvedOverrides[candidate.canonicalLabel]
                ?: policy.configuredAction(candidate.canonicalLabel)
            if (policy.strictNoLeak && configured == PolicyAction.KEEP) {
                candidate.action = PolicyAction.MASK
                candidate.strictUpgrade = true
            } else {
                candidate.action = configured
            }
            if (candidate.confidencePpm >= threshold.keepFloorPpm) {
                candidate.outcome = "retained"
                candidate.escalate = candidate.confidencePpm < threshold.escalateBelowPpm
            }
        }

        val retained = candidates.filter { it.outcome == "retained" }
        val unique = collapseDuplicates(retained, policy)
        val spans = mutableListOf<KitParitySpan>()
        for (cluster in clusters(unique)) {
            val representative = representative(cluster, policy)
            val start = cluster.minOf { it.start }
            val end = cluster.maxOf { it.end }
            for (member in cluster) {
                member.outcome = if (member === representative) "applied" else "overlap_loser"
                member.span = spans.size
            }
            val surface = UnicodeOffsetContract.substring(text, start, end)
            spans += KitParitySpan(
                label = representative.label,
                canonicalLabel = representative.canonicalLabel,
                action = representative.action.wireName,
                start = start,
                end = end,
                confidencePpm = representative.confidencePpm,
                replacement = replacement(
                    representative.action,
                    representative.canonicalLabel,
                    surface,
                    surrogateKey,
                ),
            )
        }
        for (item in retained) {
            if (item.outcome == "duplicate") {
                item.span = unique.first { duplicateKey(it) == duplicateKey(item) }.span
            }
        }

        val output = KitParity.applySpans(text, spans)
        val result = KitParityResult(output, spans).also(KitParity::validate)
        val decisions = candidates.map {
            PolicyDecision(
                inputs = it.inputs,
                kind = it.kind,
                label = it.label,
                canonicalLabel = it.canonicalLabel,
                recognized = it.recognized,
                start = it.start,
                end = it.end,
                confidencePpm = it.confidencePpm,
                keepFloorPpm = it.keepFloorPpm,
                escalate = it.escalate,
                action = it.action.wireName,
                strictUpgrade = it.strictUpgrade,
                outcome = it.outcome,
                span = it.span,
            )
        }
        return PolicyDecisionResult(policy.name, policy.digest, result, decisions)
    }

    /** Replacement text for one output span; `null` for `keep`. */
    fun replacement(
        action: PolicyAction,
        canonicalLabel: String,
        surface: String,
        surrogateKey: ByteArray? = null,
    ): String? = when (action) {
        PolicyAction.KEEP -> null
        PolicyAction.MASK, PolicyAction.REDACT -> "[$canonicalLabel]"
        PolicyAction.REMOVE -> ""
        PolicyAction.REPLACE -> if (surrogateKey == null) {
            "[${canonicalLabel}_REPLACED]"
        } else {
            "[${canonicalLabel}_${surrogateToken(surrogateKey, canonicalLabel, surface)}]"
        }
        PolicyAction.HASH -> {
            val digest = MessageDigest.getInstance("SHA-256").digest(surface.toByteArray(Charsets.UTF_8))
            "${canonicalLabel}_${hex(digest.copyOf(12))}"
        }
    }

    /**
     * Deterministic keyed surrogate token: HMAC-SHA256 over
     * `"openmed.portable_surrogate.v1" 0x00 label 0x00 surface`, first 8 bytes
     * as lowercase hex. The key never leaves the caller.
     */
    fun surrogateToken(key: ByteArray, canonicalLabel: String, surface: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        mac.update(SURROGATE_DOMAIN.toByteArray(Charsets.UTF_8))
        mac.update(0)
        mac.update(canonicalLabel.toByteArray(Charsets.UTF_8))
        mac.update(0)
        mac.update(surface.toByteArray(Charsets.UTF_8))
        return hex(mac.doFinal().copyOf(8))
    }

    private class Candidate(
        val inputs: List<Int>,
        val kind: String,
        val label: String,
        val canonicalLabel: String,
        val recognized: Boolean,
        val start: Int,
        val end: Int,
        val confidencePpm: Int,
    ) {
        var keepFloorPpm = 0
        var escalate = false
        var action = PolicyAction.KEEP
        var strictUpgrade = false
        var outcome = "below_threshold"
        var span: Int? = null
    }

    private class Normalized(
        val index: Int,
        val detection: PolicyDetection,
        val canonicalLabel: String,
        val recognized: Boolean,
    )

    private fun validate(detections: List<PolicyDetection>, length: Int) {
        detections.forEachIndexed { index, detection ->
            val path = "$.detections[$index]"
            if (!labelPattern.matches(detection.label)) {
                throw PolicyProfileException("detection_label_invalid", "$path.label")
            }
            if (detection.start < 0) {
                throw PolicyProfileException("detection_offset_invalid", "$path.start")
            }
            if (detection.end <= detection.start) {
                throw PolicyProfileException("detection_offset_invalid", "$path.end")
            }
            if (detection.end > length) {
                throw PolicyProfileException("detection_offset_out_of_bounds", "$path.end")
            }
            if (detection.confidencePpm !in 0..KitParity.CONFIDENCE_SCALE) {
                throw PolicyProfileException("detection_confidence_invalid", "$path.confidence_ppm")
            }
            if (detection.source != "model" && detection.source != "semantic") {
                throw PolicyProfileException("detection_source_invalid", "$path.source")
            }
        }
    }

    private fun validate(overrides: Map<String, String>, taxonomy: PolicyTaxonomy): Map<String, PolicyAction> {
        val resolved = mutableMapOf<String, PolicyAction>()
        for (label in overrides.keys.sorted()) {
            if (label !in taxonomy.policyLabels) {
                throw PolicyProfileException("override_label_unknown", "$.overrides
```

### Core Architecture Module: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/util/LeaseGate.kt`
```
package com.openmed.openmedkit.util

/**
 * Reference-counted close guard for a native resource.
 *
 * Every use of the resource runs between [tryAcquire] and [release]. [close]
 * stops new acquisitions immediately but defers [onRelease] until the final
 * active lease is released, so a native session is never freed while a run
 * still holds it. [onRelease] runs at most once.
 *
 * A failure thrown by an immediate release propagates to the [close] caller.
 * A deferred release runs on the thread that drops the final lease; its
 * failure has no caller to report to and is suppressed so it can never replace
 * the result or failure of the run that triggered it.
 */
internal class LeaseGate(
    private val onRelease: () -> Unit,
) {
    private var active = 0
    private var closeRequested = false
    private var released = false

    /** Number of uses currently holding the resource. */
    val activeLeases: Int
        @Synchronized get() = active

    /** True once [close] has been requested. */
    val isClosed: Boolean
        @Synchronized get() = closeRequested

    /** True once [onRelease] has run. */
    val isReleased: Boolean
        @Synchronized get() = released

    /** Take a lease, or return false when the resource is closing or closed. */
    @Synchronized
    fun tryAcquire(): Boolean {
        if (closeRequested) {
            return false
        }
        active += 1
        return true
    }

    /** Drop a lease taken with [tryAcquire]. */
    fun release() {
        val releaseNow = synchronized(this) {
            check(active > 0) { "lease released more times than acquired" }
            active -= 1
            claimReleaseLocked()
        }
        if (releaseNow) {
            try {
                onRelease()
            } catch (_: Exception) {
                // Deferred release has no caller; see the class documentation.
            }
        }
    }

    /** Stop new leases and release the resource once no lease remains. */
    fun close() {
        val releaseNow = synchronized(this) {
            if (closeRequested) {
                return
            }
            closeRequested = true
            claimReleaseLocked()
        }
        if (releaseNow) {
            onRelease()
        }
    }

    private fun claimReleaseLocked(): Boolean {
        if (!closeRequested || active != 0 || released) {
            return false
        }
        released = true
        return true
    }
}

/** Run [block] under a lease, throwing [onClosed] when the gate is closed. */
internal inline fun <T> LeaseGate.withLease(
    onClosed: () -> Nothing,
    block: () -> T,
): T {
    if (!tryAcquire()) {
        onClosed()
    }
    try {
        return block()
    } finally {
        release()
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

### Core Architecture Module: `js/openmedkit-electron/harness/src/renderer.ts`
```
/**
 * Renderer page script of the packaged harness.
 *
 * It only reaches OpenMed through `window.openmed` (the production bridge)
 * and reports value-free outcomes back to the main process: span offsets,
 * labels, bundle references and error codes. It never logs or stores text.
 */
import type { ElectronDeidentifyResponse, ElectronDeidentifyTask } from "../../src/ipc";

interface HarnessBridge {
  isolation: { sandboxed: boolean; contextIsolated: boolean };
  onCommand(listener: (command: HarnessCommand) => void): void;
  reply(message: unknown): void;
}

type HarnessCommand =
  | { id: string; op: "probe" }
  | { id: string; op: "submit"; text: string }
  | { id: string; op: "cancel"; target: string }
  | { id: string; op: "navigate" }
  | { id: string; op: "attack"; channel: string; payload: unknown };

declare global {
  interface Window {
    openmed?: { submit(text: string): ElectronDeidentifyTask };
    openmedHarness?: HarnessBridge;
    openmedAttack?: { invoke(channel: string, payload: unknown): Promise<unknown> };
    __openmedInlineRan?: boolean;
  }
}

const harness = window.openmedHarness;
const tasks = new Map<string, ElectronDeidentifyTask>();
let cspViolations = 0;
document.addEventListener("securitypolicyviolation", () => {
  cspViolations += 1;
});

function codeOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "UNTYPED_ERROR";
}

function outcome(response: ElectronDeidentifyResponse) {
  return {
    ok: true,
    requestId: response.requestId,
    spans: response.spans,
    bundle: response.bundle,
  };
}

async function probe() {
  const scope = globalThis as unknown as Record<string, unknown>;
  let evalBlocked = false;
  try {
    (0, eval)("1");
  } catch {
    evalBlocked = true;
  }
  let functionBlocked = false;
  try {
    new Function("return 1")();
  } catch {
    functionBlocked = true;
  }
  const inline = document.createElement("script");
  inline.textContent = "window.__openmedInlineRan = true;";
  document.body.appendChild(inline);
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  const fetchBlocked = await fetch("https://example.invalid/model.onnx").then(
    () => false,
    () => true,
  );
  const popup = window.open("https://example.invalid/", "_blank");
  return {
    requireType: typeof scope.require,
    processType: typeof scope.process,
    moduleType: typeof scope.module,
    bufferType: typeof scope.Buffer,
    ipcRendererExposed: "ipcRenderer" in scope,
    bridgeKeys: Object.keys(window.openmed ?? {}).sort(),
    sandboxed: harness?.isolation.sandboxed === true,
    contextIsolated: harness?.isolation.contextIsolated === true,
    evalBlocked,
    functionBlocked,
    inlineScriptBlocked: window.__openmedInlineRan !== true,
    fetchBlocked,
    windowOpenBlocked: popup === null,
    cspViolations,
    origin: `${location.protocol}//${location.host}`,
  };
}

harness?.onCommand((command) => {
  void (async () => {
    switch (command.op) {
      case "probe":
        harness.reply({ id: command.id, op: "probe", probe: await probe() });
        return;
      case "submit": {
        const openmed = window.openmed;
        if (openmed === undefined) {
          harness.reply({ id: command.id, op: "result", ok: false, errorCode: "NO_BRIDGE" });
          return;
        }
        const task = openmed.submit(command.text);
        tasks.set(command.id, task);
        harness.reply({ id: command.id, op: "submitted", requestId: task.requestId });
        // `contextBridge` copies errors without their `code`; `outcome` keeps it.
        task.outcome.then(
          (response) =>
            harness.reply(
              response.ok
                ? { id: command.id, op: "result", ...outcome(response) }
                : { id: command.id, op: "result", ok: false, errorCode: response.errorCode },
            ),
          (error: unknown) =>
            harness.reply({ id: command.id, op: "result", ok: false, errorCode: codeOf(error) }),
        );
        return;
      }
      case "cancel": {
        const task = tasks.get(command.target);
        const acknowledged = task === undefined ? false : await task.cancel();
        harness.reply({ id: command.id, op: "cancelled", acknowledged });
        return;
      }
      case "navigate":
        harness.reply({ id: command.id, op: "navigating" });
        location.href = "https://example.invalid/";
        return;
      case "attack": {
        const attack = window.openmedAttack;
        if (attack === undefined) {
          harness.reply({ id: command.id, op: "attack", threw: true, response: null });
          return;
        }
        try {
          const response = (await attack.invoke(command.channel, command.payload)) as Record<
            string,
            unknown
          >;
          harness.reply({
            id: command.id,
            op: "attack",
            threw: false,
            response: {
              ok: response?.ok ?? null,
              errorCode: response?.errorCode ?? null,
              cancelled: response?.cancelled ?? null,
            },
          });
        } catch {
          harness.reply({ id: command.id, op: "attack", threw: true, response: null });
        }
        return;
      }
    }
  })();
});

harness?.reply({ id: "ready", op: "ready" });

```

### Core Architecture Module: `js/openmedkit-electron/harness/src/worker.ts`
```
/**
 * Utility-process entrypoint of the packaged harness.
 *
 * It runs the production OpenMed utility loop (`startUtilityProcess`) with the
 * production bundle verifier. Only the pipeline loader is synthetic: it
 * refuses to build a pipeline unless the verified bundle bytes contain the
 * label map and the selected runtime's entrypoint.
 */
import dns from "node:dns";
import net from "node:net";

import {
  startUtilityProcess,
  type UtilityParentPortLike,
  type VerifiedElectronBundle,
} from "../../src/utility-runtime";
import { createSyntheticPipeline } from "./synthetic-model";

function probeNetwork(): void {
  const attempts: Array<() => unknown> = [
    () => globalThis.fetch("https://example.invalid/model.onnx"),
    () => net.connect(443, "example.invalid"),
    () => dns.lookup("example.invalid", () => undefined),
  ];
  for (const attempt of attempts) {
    let blocked = false;
    try {
      attempt();
    } catch {
      blocked = true;
    }
    if (!blocked) {
      throw new Error("network probe was not blocked");
    }
  }
}

async function loadBundlePipeline(bundle: VerifiedElectronBundle) {
  const labels = bundle.files.get("id2label.json");
  const entrypoint = bundle.files.get(bundle.runtime.entrypoint);
  if (labels === undefined || entrypoint === undefined || entrypoint.length === 0) {
    throw new Error("verified bundle is incomplete");
  }
  JSON.parse(new TextDecoder().decode(labels));
  return createSyntheticPipeline({
    crash: () => {
      process.crash();
      throw new Error("unreachable");
    },
    probeNetwork,
  });
}

const parentPort = (process as NodeJS.Process & { parentPort?: UtilityParentPortLike })
  .parentPort;
if (parentPort) {
  startUtilityProcess(parentPort, { loadBundlePipeline });
}

```

### Core Architecture Module: `js/openmedkit-electron/src/utility-process.ts`
```
/**
 * Default OpenMed utility-process entrypoint.
 *
 * Bundle this module as the app's utility-process script. When it runs inside
 * an Electron utility process it starts the OpenMed loop with the default
 * `openmed` loaders. Apps that need a custom pipeline loader should build
 * their own entrypoint around `startUtilityProcess` from
 * `@openmed/openmedkit-electron/utility-runtime` instead, so only one loop
 * starts.
 */
import { startUtilityProcess, type UtilityParentPortLike } from "./utility-runtime";

export {
  createUtilityDeidentifyHandler,
  installOfflineNetworkGuard,
  loadVerifiedBundlePipeline,
  startUtilityProcess,
  type UtilityHandlerOptions,
  type UtilityMessageEvent,
  type UtilityMessageHandler,
  type UtilityParentPortLike,
  type VerifiedBundleRuntime,
  type VerifiedElectronBundle,
} from "./utility-runtime";

const electronProcess = process as NodeJS.Process & {
  parentPort?: UtilityParentPortLike | null;
};
if (electronProcess.parentPort) {
  startUtilityProcess(electronProcess.parentPort);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5703** (2026-11-20): **test: expect canonical [PERSON] mask in malformed ISCII fuzz case**
  *Symptoms*: # Pull Request  ## Description Fixes the stale expectation in `test_malformed_iscii_preserves_clinical_text_and_identifier_spans`. Mask placeholders use the canonical taxonomy label (`_placeholder_label`), so a `NAME` span masks as `[PERSON]`, but the test still expected `[NAME]` and failed in all 4 subtests on `master`. The span, coverage and leakage assertions already passed; only the exact-string expectation was wrong. No library code changes.  ## Type of Change - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update - [ ] Code refactoring - [ ] Performance improvement - [x] Test addition/improvement  ## Changes Made - `tests/fuzz/test_deidentify_fuzz.py`: expect `text.replace(value, "[PERSON]")` and add a short comment pointing at `_placeholder_label`.  ## Testing - [ ] I have added tests that prove my fix is effective or that my feature works - [x] New and existing unit tests pass locally with my changes - [ ] I have tested this change with different models/inputs  Commands run: - `uv run --frozen --extra dev pytest "tests/fuzz/test_deidentify_fuzz.py::test_malformed_iscii_preserves_clinical_text_and_identifier_spans" -q` (fails 4 subtests on `master` e8325586e, passes with this change) - `uv run --frozen --extra dev pytest tests/fuzz/test_deidentify_fuzz

- **Issue #5702** (2026-11-20): **[BUG] Malformed-ISCII fuzz test expects [NAME] but mask placeholders are canonical [PERSON]**
  *Symptoms*: ### Bug description  On `master` (e8325586e), `tests/fuzz/test_deidentify_fuzz.py::test_malformed_iscii_preserves_clinical_text_and_identifier_spans` fails in all 4 subtests (`prefix` in `["", "ïB"]` x `use_safety_sweep` in `[False, True]`).  The 2-character length difference is the mask placeholder. `_mask_placeholder` renders `_placeholder_label(entity)`, which returns the canonical taxonomy label, so a `NAME` span masks as `[PERSON]`. The test's last assertion still builds the expected text with `text.replace(value, "[NAME]")`, which matched the older `f"[{entity.entity_type}]"` placeholder. The test arrived through the #4406 merge from a branch that predates canonical placeholders, so it has not passed on `master`.  The privacy invariants in the same test all pass: the canonical source text equals the input, spans are in bounds and non-overlapping, the planted identifier span is covered, and the identifier does not survive in the masked output. Only the exact-string expectation is stale. The case carries the `fuzz` marker, so the default `-m "not slow and not fuzz"` run does not catch it.  ### Minimal reproduction  uv run --frozen --extra dev pytest \   "tests/fuzz/test_deidentify_fuzz.py::test_malformed_iscii_preserves_clinical_text_and_identifier_spans" -q  ### Expected behavior  The test expects the canonical placeholder (`text.replace(value, "[PERSON]")`) and passes. This is a one-line test change; no library change is needed.  ### Error output  AssertionError: masked

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

### Incident Patch 1: `5b79cae5` (2026-11-27)
**Commit Message**: Fix Windows webhook lock initialization under contention (#5823)

**File**: `openmed/service/_state_files.py` (modified, +2/-2)
```diff
@@ -93,8 +93,8 @@ def exclusive_lock(lock_path: Path) -> Iterator[None]:
         if sys.platform == "win32":  # pragma: no cover - exercised on Windows only
             import msvcrt
 
-            if os.fstat(descriptor).st_size == 0:
-                os.write(descriptor, b"0")
+            # Windows can lock a range past EOF. Writing a marker here races
+            # with other descriptors that have already locked byte zero.
             os.lseek(descriptor, 0, os.SEEK_SET)
             msvcrt.locking(descriptor, msvcrt.LK_LOCK, 1)
         else:
```

**File**: `tests/unit/service/test_webhook_replay.py` (modified, +12/-0)
```diff
@@ -12,6 +12,7 @@
 import httpx
 import pytest
 
+from openmed.service._state_files import exclusive_lock
 from openmed.service.egress import EGRESS_RULES_ENV_VAR
 from openmed.service.signing import (
     NONCE_HEADER,
@@ -248,6 +249,17 @@ def test_replay_stays_rejected_after_a_receiver_restart(tmp_path: Path) -> None:
     assert retry.reason == "delivery_applied"
 
 
+@pytest.mark.parametrize("original", [b"", b"0"])
+def test_lock_acquisition_preserves_empty_and_existing_files(
+    tmp_path: Path, original: bytes
+) -> None:
+    path = tmp_path / "ledger.lock"
+    path.write_bytes(original)
+    with exclusive_lock(path):
+        assert path.stat().st_size == len(original)
+    assert path.read_bytes() == original
+
+
 def test_concurrent_receivers_cannot_both_claim_one_delivery(tmp_path: Path) -> None:
     # Separate receiver and ledger objects share one file, as separate worker
     # processes would; the file lock serializes their claims.
```

---

### Incident Patch 2: `bbec8495` (2026-11-26)
**Commit Message**: Fix Windows failures in the full regression suite (#5821)

**File**: `.gitattributes` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# Preserve the bytes of digest-pinned assets and reproducible artifacts on every OS.
+* text=auto eol=lf
```

**File**: `docs/testing.md` (modified, +4/-0)
```diff
@@ -59,6 +59,10 @@ Configure these markers via `pytest.ini` entries in `pyproject.toml`.
 
 ## Running the suite
 
+Git preserves LF line endings for text files on every platform through
+`.gitattributes`. This keeps digest-pinned assets and generated test fixtures
+byte-identical in Windows source checkouts.
+
 ```bash
 uv pip install ".[dev,hf]"
 make lint
```

**File**: `examples/federated_round_walkthrough.py` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@
 
 import argparse
 import json
+import sys
 from datetime import datetime, timedelta, timezone
 from typing import Any
 
@@ -189,4 +190,5 @@ def main(argv: list[str] | None = None) -> int:
 
 
 if __name__ == "__main__":
+    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
     raise SystemExit(main())
```

**File**: `openmed/core/export_provenance.py` (modified, +25/-3)
```diff
@@ -444,6 +444,25 @@ def write_observation_report(
             handle.write(content)
 
 
+def _create_observation(path: Path) -> int:
+    if os.name != "nt":
+        return os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o666)
+
+    import _winapi
+    import msvcrt
+
+    # CREATE_NEW on the reparse point itself also refuses dangling symlinks.
+    # Inherit the directory ACL and permit the same read/write sharing as os.open.
+    handle = _winapi.CreateFile(
+        str(path), _winapi.GENERIC_WRITE, 3, 0, 1, 0x00200080, 0
+    )
+    try:
+        return msvcrt.open_osfhandle(handle, os.O_WRONLY | os.O_BINARY)
+    except BaseException:
+        _winapi.CloseHandle(handle)
+        raise
+
+
 @contextmanager
 def _observation_descriptor(
     path: Path, *, create: bool = False
@@ -460,10 +479,13 @@ def _observation_descriptor(
         not stat.S_ISREG(expected.st_mode) or expected.st_nlink != 1
     ):
         raise ValueError(error)
-    flags = os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
     if expected is None:
-        flags |= os.O_CREAT | os.O_EXCL
-    descriptor = os.open(path, flags, 0o666)
+        descriptor = _create_observation(path)
+    else:
+        flags = (
+            os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
+        )
+        descriptor = os.open(path, flags)
     created = expected is None
     opened: os.stat_result | None = None
     succeeded = False
```

**File**: `openmed/eval/leaderboard.py` (modified, +5/-3)
```diff
@@ -411,13 +411,15 @@ def write_leaderboard(
     for archive in archives:
         report_output = reports_output / archive.relative_path
         report_output.parent.mkdir(parents=True, exist_ok=True)
-        report_output.write_text(_json_text(archive.payload), encoding="utf-8")
+        report_output.write_text(
+            _json_text(archive.payload), encoding="utf-8", newline="\n"
+        )
         copied_reports.append(report_output)
 
     html_path = destination / "index.html"
     json_path = destination / "leaderboard.json"
-    html_path.write_text(render_leaderboard_html(rows), encoding="utf-8")
-    json_path.write_text(render_leaderboard_json(rows), encoding="utf-8")
+    html_path.write_text(render_leaderboard_html(rows), encoding="utf-8", newline="\n")
+    json_path.write_text(render_leaderboard_json(rows), encoding="utf-8", newline="\n")
     return LeaderboardArtifacts(
         html_path=html_path,
         json_path=json_path,
```

**File**: `openmed/service/diagnostics.py` (modified, +13/-2)
```diff
@@ -889,9 +889,17 @@ def read_bytes(self, path: Path) -> bytes:
         limits = shared.limits
         shared.open_file()
         try:
-            descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NONBLOCK", 0))
+            descriptor = os.open(
+                path,
+                os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NONBLOCK", 0),
+            )
         except FileNotFoundError:
             raise _SourceProblem("source_absent") from None
+        except PermissionError:
+            # Windows refuses a directory at open, before fstat can classify it.
+            if path.is_dir():
+                raise _SourceProblem("source_unsafe") from None
+            raise _SourceProblem("source_unreadable") from None
         except OSError:
             raise _SourceProblem("source_unreadable") from None
         try:
@@ -2896,7 +2904,10 @@ def read_diagnostic_bundle(path: str | Path) -> bytes:
         OSError: If the file cannot be opened or is not a regular file.
     """
 
-    descriptor = os.open(Path(path), os.O_RDONLY | getattr(os, "O_NONBLOCK", 0))
+    descriptor = os.open(
+        Path(path),
+        os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NONBLOCK", 0),
+    )
     try:
         if not stat.S_ISREG(os.fstat(descriptor).st_mode):
             raise OSError("bundle source is not a regular file")
```

**File**: `openmed/service/secret_files.py` (modified, +7/-1)
```diff
@@ -62,6 +62,7 @@
 _READ_CHUNK_BYTES = 64 * 1024
 _OPEN_FLAGS = (
     os.O_RDONLY
+    | getattr(os, "O_BINARY", 0)
     | getattr(os, "O_CLOEXEC", 0)
     | getattr(os, "O_NOCTTY", 0)
     # A FIFO would otherwise block the open until a writer appears.
@@ -221,12 +222,17 @@ def read_secret_file(
     # Errors are raised outside ``except`` blocks so that no OSError (which
     # carries the path) is chained to, or kept as context of, the failure.
     descriptor: Optional[int]
+    open_error = SECRET_FILE_UNREADABLE
     try:
         descriptor = os.open(path, _OPEN_FLAGS)
+    except PermissionError:
+        descriptor = None
+        if os.path.isdir(path):
+            open_error = SECRET_FILE_NOT_REGULAR
     except (OSError, TypeError, ValueError):
         descriptor = None
     if descriptor is None:
-        raise SecretSourceError(setting, SECRET_FILE_UNREADABLE)
+        raise SecretSourceError(setting, open_error)
     try:
         data, code = _read_descriptor(
             descriptor,
```

**File**: `scripts/generate_grpc_stubs.py` (modified, +2/-1)
```diff
@@ -100,6 +100,7 @@ def _generate_into(output_dir: Path) -> None:
         "from . import kserve_v2_pb2, openmed_pb2, openmed_pb2_grpc\n\n"
         '__all__ = ["kserve_v2_pb2", "openmed_pb2", "openmed_pb2_grpc"]\n',
         encoding="utf-8",
+        newline="\n",
     )
 
 
@@ -109,7 +110,7 @@ def _patch_relative_import(path: Path) -> None:
         "import openmed_pb2 as openmed__pb2",
         "from . import openmed_pb2 as openmed__pb2",
     )
-    path.write_text(text, encoding="utf-8")
+    path.write_text(text, encoding="utf-8", newline="\n")
 
 
 def _diff_generated_files(expected_dir: Path, actual_dir: Path) -> list[str]:
```

---

### Incident Patch 3: `64c1746f` (2026-11-25)
**Commit Message**: Refresh documentation snapshots for the 4.0 upgrade guidance



#### Recent Merged Pull Requests:
- **PR #5823** (2026-11-27): Fix Windows webhook lock initialization under contention (@maziyarpanahi)
- **PR #5822** (2026-11-27): Authenticate ephemeral service load tests (@maziyarpanahi)
- **PR #5821** (2026-11-26): Fix Windows failures in the full regression suite (@maziyarpanahi)
- **PR #5820** (2026-11-26): Prepare OpenMed v4.0.0 release candidate (@maziyarpanahi)
- **PR #5703** (2026-11-20): test: expect canonical [PERSON] mask in malformed ISCII fuzz case (@alirezarezvani)
- **PR #5701** (2026-11-20): docs: record license provenance for body-signal model candidates (@alirezarezvani)

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

## X. Windows webhook lock initialization under contention

**RULE**:
When implementing operations in `openmed/service/_state_files.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in maziyarpanahi/openmed. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5b79cae5`: Windows webhook lock initialization under contention. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `openmed/service/_state_files.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
            # Windows can lock a range past EOF. Writing a marker here races
            # with other descriptors that have already locked byte zero.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
            if os.fstat(descriptor).st_size == 0:
                os.write(descriptor, b"0")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5b79cae5` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
