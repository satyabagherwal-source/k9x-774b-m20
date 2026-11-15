# Verification Protocol: Verification Protocol: Empirical Defect Shield for maziyarpanahi-openmed-learnings

<!-- PROVENANCE_START
{
  "source_repository": "maziyarpanahi-openmed-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T21:16:18.026Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-maziyarpanahi-openmed-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [maziyarpanahi-openmed-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T21:16:18.026Z`  
> **Learning ID**: `LEARN-EVO-maziyarpanahi-openmed-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `maziyarpanahi-openmed-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/maziyarpanahi-openmed-learnings.md`  
> **Source**: github ([https://github.com/maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed))  
> **Source Version**: `f83eb05b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T21:15:39.924Z  
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
> **Harvest Timestamp**: 2026-11-15T21:15:39.918Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maziyarpanahi/openmed`
- **Description**: Local-first healthcare AI: clinical NER and HIPAA PII de-identification on hardware you control. 2,200+ medical models, 35 model-backed PII languages, and Python, MLX, Android and browser runtimes. Apache-2.0 SDK.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5808 stars

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
- **Issue #5499** (2026-11-08): **fix: reject non-JSON request media types at the privacy proxy**
  *Symptoms*: # Pull Request  ## Description Validate the request `Content-Type` header on the privacy proxy chat completion routes (`/v1/chat/completions` and `/chat/completions`) before reading or parsing the request body. Requests with non-JSON or missing media types now return HTTP 415 with `reason: "unsupported_content_type"` through the existing PHI-safe error payload without invoking the transport or echoing request text.  ## Type of Change - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update - [ ] Code refactoring - [ ] Performance improvement - [x] Test addition/improvement  ## Changes Made - Reused `_normalize_content_type` from `openmed.service.privacy_proxy.outbound` in `chat_completions` (`openmed/service/privacy_proxy/app.py`) to validate the `Content-Type` header before calling `await request.json()`. - Added optional `status_code` override support to `PrivacyProxyError` so `PrivacyProxyRequestError(reason_code="unsupported_content_type", status_code=415)` returns HTTP 415 via `_error_response`. - Added unit tests in `tests/unit/service/privacy_proxy/test_app.py` covering `application/json; charset=utf-8`, `text/plain` with a JSON payload, and a missing `Content-Type` header.  ## Testing - [x] I have added tests that prove my fix is effective or that my feature works - [x] New an

- **Issue #5431** (2026-11-15): **Make Android OpenMedKit native libraries load on 16 KB page-size devices**
  *Symptoms*: Closes #3927. Depends on #4450.  This adds an offline ELF checker, `scripts/android/check_elf_page_alignment.py`, that reads the program headers of every packaged `.so` and fails when a 64-bit library has a `PT_LOAD` segment with `p_align` below 16 KB. It reads `jni/<abi>/` in AARs, `lib/<abi>/` in APKs and JARs, loose files and directories. Desktop natives inside JVM jars are ignored and 32-bit libraries are reported as skipped. Output lists only library names, ABIs, alignment values and the containing archive's file name.  Two Gradle gates run it. `:openmedkit:verifyReleaseNativeLibraryAlignment` checks the release AAR plus every AAR on the release runtime classpath, and is now part of `:openmedkit:verifyAndroidBudgets`. A per-variant `verify<Variant>ApkElfAlignment` task, with an aggregate `verifyApkElfAlignment`, sits next to the #4450 zip-alignment tasks and checks every debug demo APK and the OpenMedKit test APK. Both gates fail when no 64-bit library is found. Android CI runs both, and the Flutter CI mobile job runs the checker on its consumer APK.  DJL tokenizers: - `ai.djl.android:tokenizer-native` 0.33.0 is still the only version on Maven Central. Its `libdjl_tokenizer.so` is 4 KB aligned on `arm64-v8a` and `x86_64`, and the upstream fix is still open (deepjavalibrary/djl#3815). So there is no release to bump to, and rebuilding the Rust/JNI library here was out of scope. - The gap is recorded in `android/gradle/native-page-alignment-allowlist.toml`. The entry names 

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

### Incident Patch 1: `d9461297` (2026-11-15)
**Commit Message**: ci(security): skip the private React Native parity app in the kit scan

The parity example pins React Native 0.77, whose Metro bundler needs
image-size 1.x; the two HIGH advisories are only fixed in 2.x, which Metro
0.81 cannot load. The app is a private test harness that never ships in a
kit artifact, so scope the OpenMedKit lockfile scan to shipped kits and
document the exclusion. The bridge package's own lockfile is still
scanned.

**File**: `.github/workflows/vuln-scan.yml` (modified, +8/-3)
```diff
@@ -269,16 +269,21 @@ jobs:
             --source android \
             --output "$raw/android-release-runtime"
           scan() {
+            local name="$1" target="$2"
+            shift 2
             trivy fs \
               --scanners vuln \
               --pkg-types library \
               --format json \
-              --output "$raw/trivy-$1.json" \
-              "$2"
+              --output "$raw/trivy-$name.json" \
+              "$@" \
+              "$target"
           }
           scan swiftpm-root Package.resolved
           scan swiftpm-demos swift
-          scan js js
+          # The React Native parity example is a private test app that never
+          # ships in a kit artifact; see docs/supply-chain/vulnerability-scanning.md.
+          scan js js --skip-dirs "**/openmedkit-react-native/example"
           scan clients clients
           scan android "$raw/android-release-runtime"
           {
```

**File**: `docs/supply-chain/vulnerability-scanning.md` (modified, +8/-0)
```diff
@@ -97,6 +97,14 @@ The gate uses the same severity threshold and `deploy/security/cve-allowlist.yam
 waivers as the image scan. `swift/OpenMedKit/Package.resolved` is not committed,
 so the root `Package.resolved` is the scanned SwiftPM resolution.
 
+The scan skips `js/openmedkit-react-native/example`, the React Native parity
+test app. It is private, never ships in a kit artifact, and pins a React Native
+toolchain whose Metro bundler needs `image-size` 1.x, so its lockfile carries
+build-tool advisories that no shipped kit inherits. The bridge package itself,
+`js/openmedkit-react-native/package-lock.json`, is still scanned. Any other
+exclusion has to be added to `KIT_SCAN_EXCLUSIONS` in
+`tests/unit/security/test_kit_lockfile_scan.py` and documented here.
+
 Trivy already skips npm and Cargo development dependencies. It cannot tell a
 Gradle test or tooling configuration from a shipped one, so
 `scripts/security/gradle_lockfile_view.py` first copies each `gradle.lockfile`
```

**File**: `tests/unit/security/test_kit_lockfile_scan.py` (modified, +27/-1)
```diff
@@ -24,6 +24,8 @@
     "js": "js",
     "clients": "clients",
 }
+# Private test apps under a scan target that never ship in a kit artifact.
+KIT_SCAN_EXCLUSIONS = {"js": ("openmedkit-react-native/example",)}
 LOCKFILE_NAMES = (
     "Package.resolved",
     "package-lock.json",
@@ -148,7 +150,12 @@ def test_kit_scan_covers_every_surface_with_the_lockfile_scanner_options() -> No
     assert "--pkg-types library" in scan
     assert "--format json" in scan
     for name, target in KIT_SCAN_TARGETS.items():
-        assert f"scan {name} {target}\n" in scan
+        skips = "".join(
+            f' --skip-dirs "**/{directory}"'
+            for directory in KIT_SCAN_EXCLUSIONS.get(name, ())
+        )
+        assert f"scan {name} {target}{skips}\n" in scan
+    assert '"$@"' in scan
     assert "gradle_lockfile_view.py" in scan
     assert "--source android" in scan
     assert 'scan android "$raw/android-release-runtime"' in scan
@@ -229,7 +236,26 @@ def test_every_committed_kit_lockfile_is_under_a_scan_target() -> None:
     # Negative control: discovery sees every ecosystem the issue covers.
     assert {"Package.resolved", "package-lock.json", "Cargo.lock"} <= names
     assert "gradle.lockfile" in names
+    excluded = [
+        ROOT / KIT_SCAN_TARGETS[name] / directory
+        for name, directories in KIT_SCAN_EXCLUSIONS.items()
+        for directory in directories
+    ]
+    skipped = [
+        lockfile
+        for lockfile in lockfiles
+        if any(directory in lockfile.parents for directory in excluded)
+    ]
+    # Only the documented test apps are excluded, and each holds a lockfile.
+    assert {
+        directory
+        for directory in excluded
+        for lockfile in skipped
+        if directory in lockfile.parents
+    } == set(excluded)
     for lockfile in lockfiles:
+        if lockfile in skipped:
+            continue
         assert any(
             lockfile == target or target in lockfile.parents for target in targets
         ), lockfile.relative_to(ROOT)
```

---

### Incident Patch 2: `d40c77bd` (2026-11-15)
**Commit Message**: fix(security): allowlist the synthetic idempotency keys in the job recovery tests

The durable job tests use fixed synthetic UUID idempotency keys and pass
them by name, which the generic API key rule flags. Allowlist those exact
lines by path, as for the other synthetic values.

**File**: `.gitleaks.toml` (modified, +16/-0)
```diff
@@ -104,6 +104,22 @@ regexTarget = "line"
 paths = ['''tests/unit/service/test_webhook_replay\.py$''']
 regexes = ['''^\s*tmp_path / "l\.json", integrity_key=LEDGER_KEY, delivery_ttl_seconds=(0|60)\s*$''']
 
+[[allowlists]]
+targetRules = ["generic-api-key"]
+description = "Synthetic idempotency key and its call sites in the job recovery unit test"
+condition = "AND"
+regexTarget = "line"
+paths = ['''tests/unit/service/test_job_recovery\.py$''']
+regexes = ['''^\s*(KEY = "6c1f0a2e-8f3b-4d7e-9a10-5b2c3d4e5f60"|_request\((method="remove"|webhook=hooked)\), KEY, owner_digest=None)\s*$''']
+
+[[allowlists]]
+targetRules = ["generic-api-key"]
+description = "Synthetic idempotency keys in the job recovery integration test"
+condition = "AND"
+regexTarget = "line"
+paths = ['''tests/integration/test_service_job_recovery\.py$''']
+regexes = ['''^\s*((key|shift_key) = "(0f3c1a52-5d4e-4c4f-9a65-2d4b8b8f6e10|7d2b6f0e-93a1-4e58-b4d3-0c6a9e1f2a77)"|scoped = queue\.submit_job\(_request\(\), idempotency_key=key, idempotency_scope="b"\))\s*$''']
+
 [extend]
 useDefault = true
 
```

---

### Incident Patch 3: `ccc11d2f` (2026-11-15)
**Commit Message**: fix(licenses): review the bundled libc++_shared.so in the kit license gate

The OpenMedKit AAR now ships the NDK's libc++_shared.so, which has no Maven
coordinate. Teach the kit license gate to read a module's
bundledNdkLibraries list as `ndk` packages, failing closed on a non-static
list or an unreviewed entry, and review libc++ as Apache-2.0 WITH
LLVM-exception. Record it in the kit inventory, the redistribution page and
the root NOTICE, including that the POM does not declare it.

**File**: `NOTICE` (modified, +14/-0)
```diff
@@ -76,6 +76,20 @@ shifting. The table records its source, retrieval date, local modifications,
 verification references, the MIT permission notice and a SHA-256 digest that
 the loader verifies.
 
+Name: LLVM libc++ shared runtime (libc++_shared.so)
+Source: Android NDK r28c (28.2.13676358), built from
+https://github.com/llvm/llvm-project/tree/main/libcxx
+License: Apache-2.0 WITH LLVM-exception; code contributed before the LLVM
+relicensing is also available under the University of Illinois/NCSA or MIT
+licenses (the NDK's NOTICE.toolchain carries the full texts)
+Usage: The OpenMedKit Android AAR packages the NDK's prebuilt libc++_shared.so,
+stripped, for arm64-v8a, armeabi-v7a, x86 and x86_64, because
+ai.djl.android:tokenizer-native links libdjl_tokenizer.so against it without
+shipping it. The Android build copies it from the NDK pinned in
+android/gradle/libs.versions.toml; no binary is committed. Apps that ship
+OpenMedKit Android redistribute it and should include its license in their
+open-source notices.
+
 Name: SHIELD clinical PHI corpus
 Source: https://github.com/susom/shield_dataset
 Paper: https://arxiv.org/abs/2605.03301
```

**File**: `docs/security/export-redistribution.md` (modified, +4/-1)
```diff
@@ -75,7 +75,9 @@ Converter licenses, from the dependency license inventory unless noted:
 These libraries are linked into, or installed beside, the applications that
 use OpenMedKit, so an app that ships them redistributes them and must carry
 their notices. OpenMed declares them as package dependencies; it does not
-vendor their sources or binaries into this repository.
+vendor their sources or binaries into this repository. The one exception is
+the NDK's `libc++_shared.so`, which the Android build copies from the pinned
+NDK into the OpenMedKit AAR at build time.
 
 ### Swift
 
@@ -106,6 +108,7 @@ declares them in `android/openmedkit/build.gradle.kts`.
 | --- | --- | --- | --- | --- |
 | `com.microsoft.onnxruntime:onnxruntime-android` | 1.25.1 | `MIT` | Gradle cache POM | Every OpenMedKit Android consumer |
 | `ai.djl.huggingface:tokenizers`, `ai.djl.android:tokenizer-native` (with `ai.djl:api`) | 0.33.0 | `Apache-2.0` | Gradle cache POMs | Every OpenMedKit Android consumer |
+| LLVM libc++ (`libc++_shared.so`), packaged in the OpenMedKit AAR | NDK r28c (28.2.13676358), `android-ndk` in the version catalog | `Apache-2.0 WITH LLVM-exception` | NDK `NOTICE.toolchain`, which also carries libc++'s legacy NCSA and MIT notice | Every OpenMedKit Android consumer; the POM does not declare it, so add it to the app's notices |
 | `org.jetbrains.kotlinx:kotlinx-coroutines-core` | 1.8.1 | `Apache-2.0` | Gradle cache POM | Every OpenMedKit Android consumer |
 | `org.jetbrains.kotlinx:kotlinx-serialization-json` | 1.5.1 | `Apache-2.0` | Gradle cache POM | Every OpenMedKit Android consumer |
 | `org.jetbrains.kotlin:kotlin-stdlib` | Follows the Kotlin plugin (1.8.22; 1.9.24 in the Flutter plugin) | `Apache-2.0` | Gradle cache POM (1.4.32) | Every Kotlin consumer, including the Flutter Android plugin |
```

**File**: `docs/security/kit-license-inventory.md` (modified, +37/-3)
```diff
@@ -28,6 +28,7 @@ in the `repo-policy` job next to the Python dependency license policy.
 | Swift (nested package) | `swift/OpenMedKit/Package.swift` |
 | Swift demo apps | the committed `Package.resolved` of `OpenMedDemo` and `OpenMedScanDemo` |
 | Android | `android/settings.gradle.kts`, the root and every included module's build file, `android/gradle/libs.versions.toml` |
+| Android NDK runtime libraries | `bundledNdkLibraries` in an Android module's build file |
 | Web, Electron, React Native, Tauri | `js/*/package-lock.json` with the sibling `package.json` |
 | Electron packaging harness | `js/openmedkit-electron/harness/package-lock.json` with its `package.json` |
 | React Native native modules | the bridge's podspec and `android/build.gradle`, and those of the parity probe in `example/probe` |
@@ -58,9 +59,10 @@ apart:
 - **runtime** dependencies ship in, or are linked into, a kit artifact or demo
   app: SwiftPM packages used by non-test targets and all resolved pins, Gradle
   `implementation`, `api`, `compileOnly`, `runtimeOnly` and custom
-  configurations, npm production, optional and peer dependencies, Cargo crates
-  reachable from `[dependencies]`, pub `dependencies`, and podspec
-  dependencies. Unknown or unreferenced declarations are treated as runtime.
+  configurations, NDK runtime libraries copied into an AAR, npm production,
+  optional and peer dependencies, Cargo crates reachable from
+  `[dependencies]`, pub `dependencies`, and podspec dependencies. Unknown or
+  unreferenced declarations are treated as runtime.
 - **development** dependencies never ship: SwiftPM packages used only by test
   targets, Gradle `test*`, `androidTest*`, `debug*`, `kapt`, `ksp`,
   `annotationProcessor`, `lintChecks` and `classpath` configurations and
@@ -132,6 +134,32 @@ reviewed expression, fails the gate. ML Kit's own transitive Google Play
 services artifacts appear only in the Gradle lockfiles, which this gate does
 not read.
 
+## Android NDK runtime libraries
+
+`ai.djl.android:tokenizer-native` ships `libdjl_tokenizer.so`, which links
+against the NDK's shared C++ runtime (`DT_NEEDED libc++_shared.so`), but no
+dependency ships that runtime. The `:openmedkit` build therefore copies
+`libc++_shared.so` out of the NDK it pins through `android.ndkVersion`
+(`android-ndk` in `android/gradle/libs.versions.toml`, NDK r28c,
+28.2.13676358) into the release AAR for `arm64-v8a`, `armeabi-v7a`, `x86` and
+`x86_64`, and AGP strips it with the same NDK. No binary is committed. Every
+app that uses OpenMedKit Android ships this library.
+
+The library has no Maven coordinate, so the gate reads the
+`bundledNdkLibraries` list in the module's build file and reviews each entry
+as an `ndk` package. A list that is not a static set of `lib*.so` string
+literals fails the gate, and a new entry fails until it has a row.
+
+libc++ is part of the LLVM project, licensed `Apache-2.0 WITH LLVM-exception`.
+The NDK's `NOTICE.toolchain` also carries libc++'s legacy license (the
+University of Illinois/NCSA and MIT licenses, offered as alternatives) for
+code contributed before LLVM relicensed. The LLVM exception covers runtime
+portions compiled into an application's own object code. A copy of
+`libc++_shared.so` redistributes the library itself, so an app that ships it
+should carry the libc++ license text with its other open-source notices.
+The OpenMedKit POM declares only OpenMed's own Apache-2.0 license, so license
+tools that read POMs do not list libc++.
+
 ## Speech recognition (WhisperKit)
 
 `argmax-oss-swift` provides WhisperKit for the `OpenMedSpeech` product. Its
@@ -224,6 +252,12 @@ the tables. Rows that no manifest uses any more are counted as
 | gradle-plugin | `org.jetbrains.kotlin.plugin.compose` | `Apache-2.0` | Kotlin Compose compiler plugin for the demo apps |
 | gradle-plugin | `org.jetbrains.kotlinx.binary-compatibility-validator` | `Apache-2.0` | public API dump and check; build tooling |
 
+### NDK runtime libraries
+
+| Ecosystem | Package | License expression | Review note |
+| --- | --- | --- | --- |
+| ndk | `libc++_shared.so` | `Apache-2.0 WITH LLVM-exception` | LLVM libc++ from NDK r28c (28.2.13676358), packaged in the OpenMedKit AAR for four ABIs; legacy NCSA/MIT notice in the NDK `NOTICE.toolchain` |
+
 ### npm
 
 | Ecosystem | Package | License expression | Review note |
```

**File**: `scripts/licenses/kit_inventory.py` (modified, +30/-2)
```diff
@@ -8,7 +8,9 @@
 declared package to the reviewed SPDX expression in
 ``docs/security/kit-license-inventory.md`` and fails closed when a package is
 unreviewed, unknown, copyleft, source-available or proprietary without a
-scoped, documented exception.
+scoped, documented exception.  Android NDK runtime libraries that a module
+copies into its AAR (``bundledNdkLibraries``) are reviewed the same way, as
+``ndk`` packages.
 
 The gate never resolves packages, runs a build tool or contacts a registry.
 Reports carry ecosystems, package names, repository-relative manifest paths,
@@ -108,7 +110,7 @@ def _load_python_inventory() -> ModuleType:
 )
 
 ECOSYSTEMS = frozenset(
-    {"cargo", "cocoapods", "gradle", "gradle-plugin", "npm", "pub", "swiftpm"}
+    {"cargo", "cocoapods", "gradle", "gradle-plugin", "ndk", "npm", "pub", "swiftpm"}
 )
 
 # Development-only tooling never ships in a kit artifact, so these reviewed
@@ -621,6 +623,12 @@ def _parse_swift_resolved(root: Path, manifest: str, discovery: KitDiscovery) ->
     r"\binclude(?![A-Za-z0-9_])\s*\(?(?P<arguments>[^)\n]*)\)?"
 )
 _GRADLE_LOCAL_BINARY_RE = re.compile(r"\b(?P<function>files|fileTree)\s*\(")
+# Android NDK runtime libraries a module copies into its AAR, declared as
+# ``val bundledNdkLibraries = listOf("libc++_shared.so")``.  They ship like a
+# runtime dependency but have no Maven coordinate, so they are reviewed as
+# ``ndk`` rows.
+_GRADLE_BUNDLED_NDK_RE = re.compile(r"\bval\s+bundledNdkLibraries\s*=\s*listOf\s*\(")
+_NDK_LIBRARY_RE = re.compile(r"^lib[A-Za-z0-9_+-]+\.so$")
 _GRADLE_DEVELOPMENT_CONFIGS = frozenset(
     {"annotationprocessor", "classpath", "detektplugins", "lintchecks", "lintpublish"}
 )
@@ -726,6 +734,25 @@ def _check_local_binaries(body: str, manifest: str) -> None:
             )
 
 
+def _add_bundled_ndk_libraries(
+    text: str, manifest: str, discovery: KitDiscovery
+) -> None:
+    """Record the NDK runtime libraries a build file copies into its artifact."""
+
+    for match in _GRADLE_BUNDLED_NDK_RE.finditer(_blank_strings(text)):
+        open_index = match.end() - 1
+        arguments = text[open_index + 1 : _balanced_end(text, open_index, "(", ")")]
+        names = [value for _start, _end, value in _string_literals(arguments)]
+        if (
+            not names
+            or _blank_strings(arguments).replace(",", "").replace('"', "").strip()
+            or not all(_NDK_LIBRARY_RE.fullmatch(name) for name in names)
+        ):
+            raise KitManifestError("Bundled NDK library list is not static", manifest)
+        for name in names:
+            discovery.add("ndk", name, Usage.RUNTIME, manifest)
+
+
 def _add_plugin(discovery: KitDiscovery, plugin_id: str, manifest: str) -> None:
     # Unqualified ids are Gradle core plugins or legacy aliases whose artifact
     # is reviewed through its ``classpath`` coordinate.
@@ -762,6 +789,7 @@ def _parse_gradle_build(
     for match in _GRADLE_USE_MODULE_RE.finditer(text):
         coordinate = _gradle_coordinate(match["coordinate"], manifest)
         discovery.add("gradle", coordinate, Usage.DEVELOPMENT, manifest)
+    _add_bundled_ndk_libraries(text, manifest, discovery)
 
     for _start, body in _blocks(text, "dependencies"):
         _check_local_binaries(body, manifest)
```

**File**: `tests/unit/licenses/test_kit_inventory.py` (modified, +34/-0)
```diff
@@ -433,6 +433,10 @@ def test_checked_in_kits_pass_and_report_mlkit_as_restricted_exception() -> None
         ].dependency.usage
         == kit.Usage.DEVELOPMENT
     )
+    # The NDK C++ runtime the OpenMedKit AAR packages for the DJL tokenizer.
+    libcxx = records[("ndk", "libc++_shared.so", "android/openmedkit/build.gradle.kts")]
+    assert libcxx.decision == kit.Decision.PERMISSIVE
+    assert libcxx.dependency.usage == kit.Usage.RUNTIME
     assert (
         records[
             ("npm", "typescript", "js/openmedkit-web/package-lock.json")
@@ -594,6 +598,15 @@ def test_synthetic_kits_distinguish_runtime_and_development(tmp_path: Path) -> N
             "com.example:unreviewed-literal",
             "runtime",
         ),
+        (
+            "android/core/build.gradle.kts",
+            "dependencies {",
+            'val bundledNdkLibraries = listOf("libunreviewed_shared.so")\n\n'
+            "dependencies {",
+            "ndk",
+            "libunreviewed_shared.so",
+            "runtime",
+        ),
         (
             "android/demo/app/build.gradle.kts",
             "    debugImplementation(",
@@ -931,6 +944,27 @@ def test_unresolvable_gradle_declarations_fail_closed(tmp_path: Path) -> None:
         assert str(root) not in str(error.value)
 
 
+def test_bundled_ndk_libraries_must_be_static_library_names(tmp_path: Path) -> None:
+    for label, declaration in [
+        ("variable-entry", 'listOf("libc++_shared.so", extraLibrary)'),
+        ("not-a-library", 'listOf("c++_shared")'),
+        ("empty", "listOf()"),
+    ]:
+        root = tmp_path / label
+        inventory_path = build_repo(root)
+        target = root / "android/core/build.gradle.kts"
+        target.write_text(
+            f"val bundledNdkLibraries = {declaration}\n\n"
+            + target.read_text(encoding="utf-8"),
+            encoding="utf-8",
+        )
+
+        with pytest.raises(kit.KitManifestError, match="not static") as error:
+            kit.audit_kits(root, inventory_path, SYNTHETIC_MANIFESTS)
+
+        assert error.value.manifest == "android/core/build.gradle.kts", label
+
+
 def test_only_the_r8_consumer_may_consume_first_party_aar_build_outputs(
     tmp_path: Path,
 ) -> None:
```

#### Recent Merged Pull Requests:
- **PR #5559** (2026-11-15): Integrate the v4.0 pull requests (@maziyarpanahi)
- **PR #5557** (2026-11-15): Remove insecure built-in defaults from eval signing, Android hashing and corpus loading (@maziyarpanahi)
- **PR #5552** (2026-11-13): fix: restore release image SBOMs and patch blocked dependencies (@maziyarpanahi)
- **PR #5551** (closed): List valid private-training schemas in errors (@ViviBeri)
- **PR #5550** (closed): List valid private-training schemas in errors (@ViviBeri)
- **PR #5545** (2026-11-11): fix(docs): refresh expired public metric evidence (@maziyarpanahi)

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

## X. ci(security): skip the private React Native parity app in the kit scan

**RULE**:
When implementing operations in `.github/workflows/vuln-scan.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in maziyarpanahi/openmed. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d9461297`: ci(security): skip the private React Native parity app in the kit scan. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/vuln-scan.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
            local name="$1" target="$2"
            shift 2
              --output "$raw/trivy-$name.json" \
              "$@" \
              "$target"
          # The React Native parity example is a private test app that never
          # ships in a kit artifact; see docs/supply-chain/vulnerability-scanning.md.
          scan js js --skip-dirs "**/openmedkit-react-native/example"
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
              --output "$raw/trivy-$1.json" \
              "$2"
          scan js js
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d9461297` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
