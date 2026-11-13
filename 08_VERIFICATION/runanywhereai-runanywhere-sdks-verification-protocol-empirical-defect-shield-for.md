# Verification Protocol: Verification Protocol: Empirical Defect Shield for runanywhereai/runanywhere/sdks

<!-- PROVENANCE_START
{
  "source_repository": "runanywhereai/runanywhere/sdks",
  "source_url": "https://github.com/runanywhereai/runanywhere/sdks",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [runanywhereai/runanywhere/sdks](https://github.com/runanywhereai/runanywhere/sdks) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `runanywhereai/runanywhere/sdks` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/runanywhereai-runanywhere-sdks-learnings.md`  
> **Source**: github ([https://github.com/RunanywhereAI/runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks))  
> **Source Version**: `87865ea8`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T22:28:41.990Z  
> **Learning ID**: `learn-github-runanywhereai-runanywhere-sdks`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): RunanywhereAI/runanywhere-sdks

> **Canonical Artifact**: `07_PROJECT_LEARNING/runanywhereai-runanywhere-sdks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RunanywhereAI/runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-06T22:28:40.737Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RunanywhereAI/runanywhere-sdks`
- **Description**: Production ready toolkit to run AI locally
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10332 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bindings/electron/example/src/renderer.ts`
```
/**
 * Renderer. One prompt box, one button, one streamed answer.
 *
 * Everything reaches the SDK through `window.runanywhere`, which the SDK's own
 * preload publishes. The page never loads the native addon and never sequences a
 * download or a load: naming the model is enough.
 */
import type { GenerationEvent, RunAnywhereApi } from '@runanywhere/electron';

/**
 * What the SDK's preload publishes, narrowed to what this app uses.
 *
 * The core members are FUNCTIONS rather than the facade's getters because
 * contextBridge clones what it exposes — a getter would be read once, before
 * `initialize()` had anything to report.
 */
interface RunAnywhereBridge {
  /** Brings up the native runtime and seeds the staged catalog into commons. */
  initialize(secureDir?: string, baseDir?: string): Promise<void>;
  /** This app's staged table, read back for its ids. */
  catalog(): Readonly<Record<string, unknown>>;
  llm: RunAnywhereApi['llm'];
}

declare global {
  interface Window {
    readonly runanywhere: RunAnywhereBridge;
  }
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id} in index.html`);
  return found as T;
}

const promptEl = element<HTMLTextAreaElement>('prompt');
const generateEl = element<HTMLButtonElement>('generate');
const statusEl = element<HTMLParagraphElement>('status');
const outputEl = element<HTMLPreElement>('output');

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The single row `src/catalog.ts` stages; the SDK fetches it on first use. */
function modelId(): string {
  const [id] = Object.keys(window.runanywhere.catalog());
  if (!id) throw new Error('the preload staged no catalog rows');
  return id;
}

function render(event: GenerationEvent): void {
  // Only the three arms this UI has something to say about; `started`, `usage`
  // and the tool arms are streamed too and simply need no rendering here.
  if (event.type === 'textDelta') {
    outputEl.textContent += event.text;
  } else if (event.type === 'completed') {
    setStatus(
      `Done — ${event.result.outputTokens} tokens at ${event.result.tokensPerSecond.toFixed(1)} tok/s.`
    );
  } else if (event.type === 'failed') {
    setStatus(`Generation failed: ${event.error.message}`);
  }
}

/** Stream one answer. The first run also downloads and loads the model. */
async function generate(): Promise<void> {
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  generateEl.disabled = true;
  outputEl.textContent = '';
  setStatus('Generating (the first run downloads the model)…');

  try {
    const stream = window.runanywhere.llm.generateStream(prompt, {
      model: modelId(),
      maxOutputTokens: 128,
    });
    // contextBridge's structured clone drops symbol keys, so `for await` cannot
    // iterate a bridged stream. Drive `next()` by hand instead.
    for (;;) {
      const step = await stream.next();
      if (step.done) break;
      render(step.value);
    }
  } catch (error) {
    setStatus(`Generation failed: ${describe(error)}`);
  } finally {
    generateEl.disabled = false;
  }
}

generateEl.addEventListener('click', () => {
  void generate();
});

// `initialize()` waits for the MessagePort the main process brokers in, so there
// is nothing to sequence ahead of it.
window.runanywhere.initialize().then(
  () => {
    generateEl.disabled = false;
    setStatus('Ready.');
  },
  (error: unknown) => setStatus(`Startup failed: ${describe(error)}`)
);

```

### Core Architecture Module: `bindings/electron/src/backend/engines.ts`
```
// engines.ts — runtime engine-registry helpers for the thin-addon / core-alone path.
//
// Fat builds statically link backends into runanywhere_native.node; thin builds
// load librunanywhere_* via rac_registry_load_plugin. When thin + zero plugins,
// initialize() must still succeed, but ensure()/capability probes throw a typed
// SDKException (never a crash). B5 wires capabilities() fully; this module is
// the shared probe both paths use.

import type { UnavailablePlugin } from '../bridge';
import { SDKException } from '../errors';
import { InferenceFramework } from '../api/types';
import type { UnavailableCapability } from '../api/types';
import { BackendPluginId } from './plugin-registry';

/**
 * What is serving right now — all a routing decision needs.
 *
 * Kept separate from {@link EngineRegistrySnapshot} so the load-path guards
 * below depend only on this: whether a backend failed is irrelevant to "can I
 * load a model", and a guard that demanded the failure list too would force
 * every caller to fetch data it does not use.
 */
export interface RegisteredEngines {
  /** True when the .node was built with RAC_ELECTRON_THIN_ADDON. */
  readonly thinAddon: boolean;
  /** Engine names currently in commons' plugin registry (`listPlugins()`). */
  readonly pluginNames: readonly string[];
}

/** Snapshot used by capabilities probes: what serves, plus what failed. */
export interface EngineRegistrySnapshot extends RegisteredEngines {
  /**
   * Backends that tried to register and were refused
   * (`listUnavailablePlugins()`). Empty on a healthy build. Kept beside
   * `pluginNames` because "what is serving" and "what is broken" are two
   * halves of the same answer — without this half, a backend that failed to
   * load is indistinguishable from one the app never asked for.
   */
  readonly unavailablePlugins: readonly UnavailablePlugin[];
}

/**
 * Map registry / package ids to {@link InferenceFramework} values.
 * Unknown names are ignored (cloud/mlx shells, test plugins, …).
 */
export function frameworksFromPluginNames(
  names: readonly string[]
): readonly InferenceFramework[] {
  const out: InferenceFramework[] = [];
  const seen = new Set<InferenceFramework>();
  for (const raw of names) {
    const id = normalizePluginName(raw);
    const framework = frameworkForPluginId(id);
    if (framework === undefined || seen.has(framework)) continue;
    seen.add(framework);
    out.push(framework);
  }
  return out;
}

function normalizePluginName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  // Accept "llamacpp", "runanywhere_llamacpp", "librunanywhere_llamacpp".
  const stripped = trimmed
    .replace(/^lib/, '')
    .replace(/^runanywhere_/, '');
  return stripped;
}

function frameworkForPluginId(id: string): InferenceFramework | undefined {
  switch (id) {
    case BackendPluginId.LlamaCPP:
    case 'llama.cpp':
    case 'llama_cpp':
      return InferenceFramework.LLAMA_CPP;
    case BackendPluginId.ONNX:
      return InferenceFramework.ONNX;
    case BackendPluginId.Sherpa:
    case 'sherpa-onnx':
      return InferenceFramework.SHERPA;
    // The engine's CMake target is rac_backend_qhexrt, so a registry that
    // reports the target stem rather than the plugin stem still maps here.
    case BackendPluginId.QHexRT:
    case 'rac_backend_qhexrt':
      return InferenceFramework.QHEXRT;
    // The engine's identity is `neurt`; the FRAMEWORK it executes is Core ML
    // (see `@runanywhere/electron-neurt`'s README) — same distinction as
    // qhexrt's target-stem alias above.
    case BackendPluginId.NeuRT:
    case 'rac_backend_neurt':
      return InferenceFramework.COREML;
    default:
      return undefined;
  }
}

/** Fat-addon default: all three engines are linked into the .node. */
export const FAT_ADDON_FRAMEWORKS: readonly InferenceFramework[] = [
  InferenceFramework.LLAMA_CPP,
  InferenceFramework.ONNX,
  InferenceFramework.SHERPA,
];

/**
 * {@link RegisteredEngines} plus the ledger, when the caller has it.
 *
 * The ledger is optional rather than required so the load-path guards keep
 * their narrower dependency: {@link EngineRegistrySnapshot} satisfies this
 * type, and a caller that only knows what is registered still gets an answer.
 */
type BackendQuery = RegisteredEngines & {
  readonly unavailablePlugins?: readonly UnavailablePlugin[];
};

/**
 * Backends this process can actually reach.
 *
 * Thin + empty registry → `[]` (core-alone). Fat starts from the compile-time
 * set, because a statically linked engine is a fact about the binary that is
 * true even before `initialize()` has populated the registry.
 *
 * Then the ledger subtracts. A statically linked backend can still be REFUSED
 * at registration (a stub build whose `capability_check` declines, an
 * unsupported machine) — and `UnavailablePlugin.path` is empty for exactly
 * that case, so there is no path to filter on, only the name. Without this
 * subtraction a refused engine is reported as both available (its modalities)
 * and unavailable (the ledger entry) in the same capability snapshot, which is
 * worse than either answer alone: an app that trusts `modalities` calls a
 * feature that cannot work.
 */
export function backendsForRegistry(snapshot: BackendQuery): readonly InferenceFramework[] {
  const base = snapshot.thinAddon
    ? frameworksFromPluginNames(snapshot.pluginNames)
    : FAT_ADDON_FRAMEWORKS;
  const refused = snapshot.unavailablePlugins;
  if (refused === undefined || refused.length === 0) return base;
  const refusedFrameworks = new Set(frameworksFromPluginNames(refused.map((p) => p.name)));
  if (refusedFrameworks.size === 0) return base;
  // The registry is the stronger witness. Commons drops a ledger entry the
  // moment the same name registers successfully
  // (`rac_plugin_availability_forget`), so a framework in BOTH lists is
  // serving — a stale entry must never retract a backend that answers.
  const serving = new Set(frameworksFromPluginNames(snapshot.pluginNames));
  return base.filter((framework) => !refusedFrameworks.has(framework) || serving.has(framework));
}

/**
 * `rac_result_t` values a refused backend actually comes back with, in the
 * words an app can show a user. Anything else falls back to the raw code —
 * better an unfamiliar number than a confident wrong explanation.
 */
const UNAVAILABLE_REASONS: ReadonlyMap<number, string> = new Map([
  // RAC_ERROR_CAPABILITY_UNSUPPORTED
  [
    -811,
    'the plugin declined registration (capability_check) — this build of the backend ' +
      'was compiled without its engine, or the hardware does not support it',
  ],
  // RAC_ERROR_PLUGIN_LOAD_FAILED
  [
    -820,
    'the plugin library could not be loaded (missing file, wrong architecture, or unresolved symbols)',
  ],
  // RAC_ERROR_ABI_VERSION_MISMATCH
  [-810, 'the plugin was built against a different plugin ABI than this SDK'],
  // RAC_ERROR_BACKEND_UNAVAILABLE
  [-604, 'the backend reported itself unavailable on this machine'],
]);

/**
 * Render commons' unavailability ledger as capability entries.
 *
 * This is what turns "speech silently does nothing" into "sherpa is
 * unavailable, and here is why" at the one place apps already look.
 */
export function unavailableCapabilities(
  plugins: readonly UnavailablePlugin[]
): UnavailableCapability[] {
  return plugins.map((plugin) => ({
    name: `backend:${plugin.name}`,
    reason:
      UNAVAILABLE_REASONS.get(plugin.status) ??
      `the plugin failed to register (rac_result_t ${plugin.status})`,
  }));
}

/** Typed failure when a thin core has no registered engines. */
export function noBackendEnginesException(): SDKException {
  return SDKException.noBackendEngines();
}

/**
 * Guard for model load / ensure paths.
 * Fat addons always pass. Thin addons with an empty registry throw
 * {@link noBackendEnginesException}.
 */
export function assertBackendEnginesRegistered(snapshot: RegisteredEngines): void {
  if (!snapshot.thinAddon) return;
  if (snapshot.pluginNames.length > 0) return;
  throw noBackendEnginesException();
}

```

### Core Architecture Module: `bindings/kotlin/modules/runanywhere-core-llamacpp/src/main/kotlin/com/runanywhere/sdk/llm/llamacpp/LlamaCPP.kt`
```
package com.runanywhere.sdk.llm.llamacpp

import com.runanywhere.sdk.infrastructure.logging.SDKLogger
import com.runanywhere.sdk.native.bridge.RunAnywhereBridge
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * LlamaCPP module for LLM text generation.
 *
 * Provides large language model capabilities using llama.cpp
 * with GGUF models and Metal/GPU acceleration.
 *
 * This is a thin wrapper that calls C++ backend registration.
 * All business logic is handled by the C++ commons layer.
 *
 * ## Registration
 *
 * ```kotlin
 * import com.runanywhere.sdk.llm.llamacpp.LlamaCPP
 *
 * // Register the backend (suspend, called once during SDK bootstrap)
 * LlamaCPP.register()
 * ```
 *
 * ## Usage
 *
 * LLM services are accessed through the main SDK APIs - the C++ backend handles
 * service creation and lifecycle internally:
 *
 * ```kotlin
 * // Generate text via public API
 * val response = RunAnywhere.generate("Hello!")
 *
 * // Stream text via public API
 * RunAnywhere.generateStream("Tell me a story").collect { event ->
 *     if (!event.is_final) print(event.token_)
 * }
 * ```
 *
 * Matches iOS LlamaCPP.swift exactly.
 */
object LlamaCPP {
    private val logger = SDKLogger.llamacpp

    // MARK: - Module Info

    /** Current version of the LlamaCPP Runtime module */
    const val version = "2.0.0"

    /** LlamaCPP library version (underlying C++ library) */
    const val llamaCppVersion = "runanywhere-b10453.8"

    /** Human-readable module name (LlamaCPP). */
    const val moduleName: String = "LlamaCPP"

    // MARK: - Registration State

    @Volatile
    private var isRegistered = false
    private val registrationMutex = Mutex()
    private val registrationLock = Any()

    // MARK: - Registration

    /**
     * Register LlamaCPP backend with the C++ service registry.
     *
     * Mirrors iOS `LlamaCPP.register()`. The unified `rac_backend_llamacpp_register()`
     * registers a single vtable that exposes both LLM and VLM modality slots, so
     * there is no separate VLM registration step.
     * Suspend so that callers can await module bootstrap from a coroutine scope.
     */
    suspend fun register() {
        registrationMutex.withLock {
            registerInternal()
        }
    }

    /**
     * Unregister the LlamaCPP backend from C++ registry.
     */
    suspend fun unregister() {
        registrationMutex.withLock {
            if (!isRegistered) return

            unregisterNative()
            isRegistered = false
            logger.info("LlamaCPP backend unregistered")
        }
    }

    private fun registerInternal() {
        if (isRegistered) {
            logger.debug("LlamaCPP already registered, returning")
            return
        }

        logger.info("Registering LlamaCPP backend with C++ registry...")

        val result = registerNative()

        // Success or already registered is OK
        if (result != 0 && result != -4) { // RAC_ERROR_MODULE_ALREADY_REGISTERED = -4
            logger.error("LlamaCPP registration failed with code: $result")
            // Don't throw - registration failure shouldn't crash the app
            return
        }

        isRegistered = true
        logger.info("LlamaCPP backend registered successfully (covers both LLM and VLM)")
    }

    // `canHandle(modelId)` deleted per gaps/kotlin.md — mirrors
    // SWIFT-DUP-CANHANDLE. The C++ plugin router (`rac_router_*`) is the
    // only routing authority; Kotlin-side file-extension matching was never
    // called from the dispatch path and could drift from C++ format tables.

    // MARK: - Auto-Registration

    /**
     * Enable auto-registration for this module.
     * Access this property to trigger C++ backend registration.
     */
    val autoRegister: Unit by lazy {
        synchronized(registrationLock) {
            registerInternal()
        }
    }
}

private val logger = SDKLogger.llamacpp

/**
 * JVM/Android implementation of LlamaCPP native registration.
 *
 * Uses the self-contained LlamaCPPBridge to register the backend,
 * mirroring the Swift LlamaCPPBackend XCFramework architecture.
 *
 * The LlamaCPP module has its own JNI library (librac_backend_llamacpp_jni.so)
 * that provides backend registration, separate from the main commons JNI.
 */
internal fun LlamaCPP.registerNative(): Int {
    logger.debug("Ensuring commons JNI is loaded for service registry")
    // Ensure commons JNI is loaded first (provides service registry)
    RunAnywhereBridge.ensureNativeLibraryLoaded()

    logger.debug("Loading dedicated LlamaCPP JNI library")
    // Load and use the dedicated LlamaCPP JNI
    if (!LlamaCPPBridge.ensureNativeLibraryLoaded()) {
        logger.error("Failed to load LlamaCPP native library")
        throw UnsatisfiedLinkError("Failed to load LlamaCPP native library")
    }

    logger.debug("Calling native register")
    val result = LlamaCPPBridge.nativeRegister()
    logger.debug("Native register returned: $result")
    return result
}

/**
 * JVM/Android implementation of LlamaCPP native unregistration.
 */
internal fun LlamaCPP.unregisterNative(): Int {
    logger.debug("Calling native unregister")
    val result = LlamaCPPBridge.nativeUnregister()
    logger.debug("Native unregister returned: $result")
    return result
}

```

### Core Architecture Module: `bindings/kotlin/modules/runanywhere-core-llamacpp/src/main/kotlin/com/runanywhere/sdk/llm/llamacpp/LlamaCPPBridge.kt`
```
/*
 * Copyright 2026 RunAnywhere SDK
 * SPDX-License-Identifier: Apache-2.0
 *
 * LlamaCPP Native Bridge
 *
 * Self-contained JNI bridge for the LlamaCPP backend module.
 * This mirrors the Swift LlamaCPPBackend XCFramework architecture.
 *
 * The native library (librac_backend_llamacpp_jni.so) contains:
 * - rac_backend_llamacpp_register()
 * - rac_backend_llamacpp_unregister()
 */

package com.runanywhere.sdk.llm.llamacpp

import com.runanywhere.sdk.infrastructure.logging.SDKLogger

/**
 * Native bridge for LlamaCPP backend registration.
 *
 * This object handles loading the LlamaCPP-specific JNI library and provides
 * JNI methods for backend registration with the C++ service registry.
 *
 * Architecture:
 * - librac_backend_llamacpp_jni.so - LlamaCPP JNI (this bridge)
 * - Links to librac_backend_llamacpp.so - LlamaCPP C++ backend
 * - Links to librac_commons.so - Commons library with service registry
 */
internal object LlamaCPPBridge {
    private val logger = SDKLogger.llamacpp

    @Volatile
    private var nativeLibraryLoaded = false

    private val loadLock = Any()

    /**
     * Ensure the LlamaCPP JNI library is loaded.
     *
     * Loads librac_backend_llamacpp_jni.so and its dependencies:
     * - librac_backend_llamacpp.so (LlamaCPP C++ backend)
     * - librac_commons.so (commons library - must be loaded first)
     * - librunanywhere_llamacpp.so (from runanywhere-core)
     *
     * @return true if loaded successfully, false otherwise
     */
    fun ensureNativeLibraryLoaded(): Boolean {
        if (nativeLibraryLoaded) return true

        synchronized(loadLock) {
            if (nativeLibraryLoaded) return true

            logger.info("Loading LlamaCPP native library...")

            try {
                // The main SDK's librunanywhere_jni.so must be loaded first
                // (provides librac_commons.so with service registry).
                // The LlamaCPP JNI provides backend registration functions.
                System.loadLibrary("rac_backend_llamacpp_jni")
                nativeLibraryLoaded = true
                logger.info("LlamaCPP native library loaded successfully")
                return true
            } catch (e: UnsatisfiedLinkError) {
                logger.error("Failed to load LlamaCPP native library: ${e.message}", throwable = e)
                return false
            } catch (e: Exception) {
                logger.error("Unexpected error loading LlamaCPP native library: ${e.message}", throwable = e)
                return false
            }
        }
    }

    /**
     * Check if the native library is loaded.
     */
    val isLoaded: Boolean
        get() = nativeLibraryLoaded

    // ==========================================================================
    // JNI Methods
    // ==========================================================================

    /**
     * Register the LlamaCPP backend with the C++ service registry.
     *
     * @return 0 (RAC_SUCCESS) on success, error code on failure
     */
    @JvmStatic
    external fun nativeRegister(): Int

    /**
     * Unregister the LlamaCPP backend from the C++ service registry.
     *
     * @return 0 (RAC_SUCCESS) on success, error code on failure
     */
    @JvmStatic
    external fun nativeUnregister(): Int
}

```

### Core Architecture Module: `bindings/kotlin/modules/runanywhere-core-onnx/src/main/kotlin/com/runanywhere/sdk/core/onnx/ONNX.kt`
```
package com.runanywhere.sdk.core.onnx

import com.runanywhere.sdk.infrastructure.logging.SDKLogger
import com.runanywhere.sdk.native.bridge.RunAnywhereBridge
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * ONNX Runtime module for embedding services.
 *
 * Provides text-embedding capabilities using ONNX Runtime with models like
 * all-MiniLM. Speech primitives (STT/TTS/VAD) are served by the sherpa module.
 *
 * This is a thin wrapper that calls C++ backend registration.
 * All business logic is handled by the C++ commons layer.
 *
 * ## Registration
 *
 * ```kotlin
 * import com.runanywhere.sdk.core.onnx.ONNX
 *
 * // Register the backend (suspend, called once during SDK bootstrap)
 * ONNX.register()
 * ```
 *
 * ## Usage
 *
 * Services are accessed through the main SDK APIs - the C++ backend handles
 * service creation and lifecycle internally:
 *
 * ```kotlin
 * // Embeddings via public API
 * val embedding = RunAnywhere.embed(text, modelId = "all-minilm-l6-v2")
 * ```
 *
 * Matches iOS ONNX.swift exactly.
 */
object ONNX {
    private val logger = SDKLogger.onnx

    // MARK: - Module Info

    /** Current version of the ONNX Runtime module */
    const val version = "2.0.0"

    /** ONNX Runtime library version (underlying C library) */
    const val onnxRuntimeVersion = "1.28.0"

    /** Human-readable module name (ONNX). */
    const val moduleName: String = "ONNX"

    // MARK: - Registration State

    @Volatile
    private var isRegistered = false

    @Volatile
    private var isSherpaRegistered = false
    private val registrationMutex = Mutex()
    private val registrationLock = Any()

    // MARK: - Registration

    /**
     * Register ONNX backend with the C++ service registry.
     *
     * Calls `rac_backend_onnx_register()` to register the ONNX embedding
     * provider with the C++ commons layer. Suspend so that callers can
     * await module bootstrap from a coroutine scope.
     */
    suspend fun register() {
        registrationMutex.withLock {
            registerInternal()
        }
    }

    /**
     * Unregister the ONNX backend from C++ registry.
     */
    suspend fun unregister() {
        registrationMutex.withLock {
            if (!isRegistered) return

            if (isSherpaRegistered) {
                unregisterSherpaNative()
                isSherpaRegistered = false
                logger.info("Sherpa backend unregistered")
            }

            if (isRegistered) {
                unregisterNative()
                isRegistered = false
                logger.info("ONNX backend unregistered")
            }
        }
    }

    private fun registerInternal() {
        if (isRegistered) {
            logger.debug("ONNX already registered, returning")
            return
        }

        logger.info("Registering ONNX backend with C++ registry...")

        val result = registerNative()

        // Success or already registered is OK
        if (result != 0 && result != -4) { // RAC_ERROR_MODULE_ALREADY_REGISTERED = -4
            logger.error("ONNX registration failed with code: $result")
            // Don't throw - registration failure shouldn't crash the app
            return
        }

        isRegistered = true
        logger.info("ONNX backend registered successfully (embeddings)")
    }

    internal fun markSherpaRegistered() {
        isSherpaRegistered = true
    }

    // `canHandleSTT` / `canHandleTTS` / `canHandleVAD` deleted per
    // gaps/kotlin.md — mirrors SWIFT-DUP-CANHANDLE. The C++ plugin router
    // (`rac_router_*` / `rac_plugin_route`) is the only routing authority;
    // Kotlin-side substring matching was never called from the dispatch path.

    // MARK: - Auto-Registration

    /**
     * Enable auto-registration for this module.
     * Access this property to trigger C++ backend registration.
     */
    val autoRegister: Unit by lazy {
        synchronized(registrationLock) {
            registerInternal()
        }
    }
}

private val logger = SDKLogger.onnx

/**
 * JVM/Android implementation of ONNX native registration.
 *
 * Uses the self-contained ONNXBridge to register the backend,
 * mirroring the Swift ONNXBackend XCFramework architecture.
 *
 * The ONNX module has its own JNI library (librac_backend_onnx_jni.so)
 * that provides backend registration, separate from the main commons JNI.
 */
internal fun ONNX.registerNative(): Int {
    logger.debug("Ensuring commons JNI is loaded for service registry")
    // Ensure commons JNI is loaded first (provides service registry)
    RunAnywhereBridge.ensureNativeLibraryLoaded()

    logger.debug("Loading ONNX JNI library")
    // Load and use the dedicated ONNX JNI
    if (!ONNXBridge.ensureNativeLibraryLoaded()) {
        logger.error("Failed to load ONNX native library")
        throw UnsatisfiedLinkError("Failed to load ONNX native library")
    }

    logger.debug("Calling native ONNX register")
    val result = ONNXBridge.nativeRegister()
    logger.debug("Native ONNX register returned: $result")

    if (ONNXBridge.isSherpaLoaded) {
        val sherpaResult = ONNXBridge.nativeRegisterSherpa()
        if (sherpaResult == 0 || sherpaResult == -4) {
            ONNX.markSherpaRegistered()
            logger.info("Sherpa backend registered successfully")
        } else {
            logger.warning("Sherpa registration returned code: $sherpaResult")
        }
    } else {
        logger.info("Sherpa backend library not packaged; continuing with ONNX backend only")
    }
    return result
}

/**
 * JVM/Android implementation of ONNX native unregistration.
 */
internal fun ONNX.unregisterNative(): Int {
    logger.debug("Calling native ONNX unregister")
    val result = ONNXBridge.nativeUnregister()
    logger.debug("Native ONNX unregister returned: $result")
    return result
}

internal fun ONNX.unregisterSherpaNative(): Int {
    logger.debug("Calling native Sherpa unregister")
    val result = ONNXBridge.nativeUnregisterSherpa()
    logger.debug("Native Sherpa unregister returned: $result")
    return result
}

```

### Core Architecture Module: `bindings/kotlin/modules/runanywhere-core-onnx/src/main/kotlin/com/runanywhere/sdk/core/onnx/ONNXAndroidInit.kt`
```
/*
 * Copyright 2026 RunAnywhere SDK
 * SPDX-License-Identifier: Apache-2.0
 *
 * Android-specific initialization for ONNX module.
 */

package com.runanywhere.sdk.core.onnx

import android.content.Context
import android.util.Log
import java.lang.ref.WeakReference

/**
 * Android-specific initialization for ONNX module.
 *
 * Usage:
 * ```kotlin
 * AndroidPlatformContext.initialize(this)
 * ONNXAndroid.initialize(this)
 * ONNX.register()
 * ```
 */
object ONNXAndroid {
    private const val TAG = "ONNXAndroid"

    @Volatile
    private var contextRef: WeakReference<Context>? = null

    @Volatile
    private var isInitialized = false

    /**
     * Initialize the ONNX Android module.
     *
     * @param context Application context
     */
    @JvmStatic
    fun initialize(context: Context) {
        if (isInitialized) {
            Log.d(TAG, "ONNXAndroid already initialized")
            return
        }

        Log.i(TAG, "Initializing ONNX Android module")

        contextRef = WeakReference(context.applicationContext)
        isInitialized = true
        Log.i(TAG, "ONNX Android module initialized")
    }

    @JvmStatic
    fun getContext(): Context? = contextRef?.get()

    @JvmStatic
    fun isInitialized(): Boolean = isInitialized
}

```

### Core Architecture Module: `bindings/kotlin/modules/runanywhere-core-onnx/src/main/kotlin/com/runanywhere/sdk/core/onnx/ONNXBridge.kt`
```
/*
 * Copyright 2026 RunAnywhere SDK
 * SPDX-License-Identifier: Apache-2.0
 *
 * ONNX Native Bridge
 *
 * Self-contained JNI bridge for the ONNX backend module.
 * This mirrors the Swift ONNXBackend XCFramework architecture.
 *
 * The native library (librac_backend_onnx_jni.so) contains:
 * - rac_backend_onnx_register()
 * - rac_backend_onnx_unregister()
 */

package com.runanywhere.sdk.core.onnx

import com.runanywhere.sdk.infrastructure.logging.SDKLogger

/**
 * Native bridge for ONNX backend registration.
 *
 * This object handles loading the ONNX-specific JNI library and provides
 * JNI methods for backend registration with the C++ service registry.
 *
 * Architecture:
 * - librac_backend_onnx_jni.so - ONNX JNI (this bridge)
 * - Links to librac_backend_onnx.so - ONNX C++ backend (STT, TTS, VAD)
 * - Links to librac_commons.so - Commons library with service registry
 */
internal object ONNXBridge {
    private val logger = SDKLogger.onnx

    @Volatile
    private var nativeLibraryLoaded = false

    @Volatile
    private var sherpaLibraryLoaded = false

    private val loadLock = Any()

    /**
     * Ensure the ONNX JNI library is loaded.
     *
     * Loads librac_backend_onnx_jni.so and its dependencies:
     * - librac_backend_onnx.so (ONNX C++ backend)
     * - librac_commons.so (commons library - must be loaded first)
     * - libonnxruntime.so
     * - libsherpa-onnx-c-api.so
     *
     * @return true if loaded successfully, false otherwise
     */
    fun ensureNativeLibraryLoaded(): Boolean {
        if (nativeLibraryLoaded) return true

        synchronized(loadLock) {
            if (nativeLibraryLoaded) return true

            logger.info("Loading ONNX native library...")

            try {
                // The main SDK's librunanywhere_jni.so must be loaded first
                // (provides librac_commons.so with service registry).
                // The ONNX JNI provides backend registration functions.
                System.loadLibrary("rac_backend_onnx_jni")
                // B-RN-10-001 / B-FL-10-001: explicitly load librac_backend_sherpa.so so its
                // ELF __attribute__((constructor)) auto-registers Sherpa STT/TTS/VAD
                // primitives with the unified plugin registry. Without this load,
                // `rac_plugin_route(STT/TTS/VAD)` returns -423 even though the .so ships
                // in the APK. Wrapped in try/catch so non-Sherpa builds aren't blocked.
                try {
                    System.loadLibrary("rac_backend_sherpa")
                    sherpaLibraryLoaded = true
                    logger.info("rac_backend_sherpa loaded; Sherpa autoregister fired")
                } catch (e: UnsatisfiedLinkError) {
                    sherpaLibraryLoaded = false
                    logger.warning("rac_backend_sherpa not present: ${e.message}")
                }
                nativeLibraryLoaded = true
                logger.info("ONNX native library loaded successfully")
                return true
            } catch (e: UnsatisfiedLinkError) {
                logger.error("Failed to load ONNX native library: ${e.message}", throwable = e)
                return false
            } catch (e: Exception) {
                logger.error("Unexpected error loading ONNX native library: ${e.message}", throwable = e)
                return false
            }
        }
    }

    /**
     * Check if the native library is loaded.
     */
    val isLoaded: Boolean
        get() = nativeLibraryLoaded

    val isSherpaLoaded: Boolean
        get() = sherpaLibraryLoaded

    // ==========================================================================
    // JNI Methods
    // ==========================================================================

    /**
     * Register the ONNX backend with the C++ service registry.
     * This registers all ONNX services: STT, TTS, VAD.
     *
     * @return 0 (RAC_SUCCESS) on success, error code on failure
     */
    @JvmStatic
    external fun nativeRegister(): Int

    @JvmStatic
    external fun nativeRegisterSherpa(): Int

    /**
     * Unregister the ONNX backend from the C++ service registry.
     *
     * @return 0 (RAC_SUCCESS) on success, error code on failure
     */
    @JvmStatic
    external fun nativeUnregister(): Int

    @JvmStatic
    external fun nativeUnregisterSherpa(): Int
}

```

### Core Architecture Module: `bindings/kotlin/modules/runanywhere-core-qhexrt/src/main/kotlin/com/runanywhere/sdk/npu/qhexrt/QHexRT.kt`
```
package com.runanywhere.sdk.npu.qhexrt

import ai.runanywhere.proto.v1.ErrorCode
import ai.runanywhere.proto.v1.HexagonArch
import ai.runanywhere.proto.v1.NpuCapability
import com.runanywhere.sdk.infrastructure.logging.SDKLogger
import com.runanywhere.sdk.native.bridge.RunAnywhereBridge
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

// RunAnywhereBridge doesn't expose this one; derived the same way as its
// RAC_ERROR_* constants (signed C ABI value = negated proto-enum magnitude).
private val RAC_ERROR_BACKEND_UNAVAILABLE = -ErrorCode.ERROR_CODE_BACKEND_UNAVAILABLE.value
private val RAC_ERROR_CAPABILITY_UNSUPPORTED = -ErrorCode.ERROR_CODE_CAPABILITY_UNSUPPORTED.value

/**
 * QHexRT module — RunAnywhere's Qualcomm Hexagon NPU backend.
 *
 * Runs prebuilt QNN context binaries on Snapdragon V75/V79/V81 NPUs, serving
 * LLM, VLM, STT, TTS, embeddings, and diffusion through the standard SDK APIs
 * once registered. A thin wrapper over C++ backend registration; all inference
 * lives in the C++ commons layer.
 *
 * ## Pre-flight
 * ```kotlin
 * val npu = QHexRT.probeNpu()
 * if (!npu.supported) { /* warn; fall back to CPU engines */ }
 * ```
 *
 * ## Registration
 * ```kotlin
 * QHexRT.register()   // once during bootstrap, on a supported device
 * ```
 */
object QHexRT {
    private val logger = SDKLogger("QHexRT")

    /** Current version of the QHexRT module, as reported by the native bridge. */
    val version: String
        get() {
            RunAnywhereBridge.ensureNativeLibraryLoaded()
            return if (QHexRTBridge.ensureNativeLibraryLoaded()) {
                QHexRTBridge.nativeGetVersion()
            } else {
                "unknown"
            }
        }

    /** Human-readable module name. */
    const val moduleName: String = "QHexRT"

    /** Whether the QHexRT backend has registered successfully. */
    @Volatile
    var isRegistered = false
        private set
    private val registrationMutex = Mutex()
    private val registrationLock = Any()

    /**
     * Probe the device's Hexagon NPU without loading QNN. Safe to call on any
     * device; returns the all-default [NpuCapability] (unknown arch,
     * `supported = false`) on unsupported/unknown parts or probe
     * failure.
     */
    fun probeNpu(): NpuCapability {
        RunAnywhereBridge.ensureNativeLibraryLoaded()
        if (!QHexRTBridge.ensureNativeLibraryLoaded()) {
            logger.info("QHexRT native library unavailable; reporting unsupported NPU")
            return NpuCapability()
        }
        return try {
            NpuCapability.ADAPTER.decode(QHexRTBridge.nativeProbeNpuProto())
        } catch (e: Exception) {
            logger.error("Failed to decode NPU probe proto: ${e.message}", throwable = e)
            NpuCapability()
        }
    }

    /**
     * Return whether [arch] is supported by this QHexRT build.
     *
     * The support boundary is owned by `librac_backend_qhexrt.so`; Kotlin
     * forwards the generated protobuf enum value without duplicating the
     * V75/V79/V81 set.
     */
    fun isArchitectureSupported(arch: HexagonArch): Boolean {
        RunAnywhereBridge.ensureNativeLibraryLoaded()
        if (!QHexRTBridge.ensureNativeLibraryLoaded()) return false
        return QHexRTBridge.nativeArchIsSupported(arch.value)
    }

    /**
     * Register the QHexRT backend with the C++ plugin registry. Suspend so
     * callers can await module bootstrap from a coroutine scope. Safe to call on
     * unsupported devices — registration is rejected and the app falls back to
     * CPU engines.
     */
    suspend fun register() {
        registrationMutex.withLock { registerInternal() }
    }

    /** Unregister the QHexRT backend from the C++ registry. */
    suspend fun unregister() {
        registrationMutex.withLock {
            if (!isRegistered) return
            unregisterNative()
            isRegistered = false
            logger.info("QHexRT backend unregistered")
        }
    }

    private fun registerInternal() {
        if (isRegistered) {
            logger.debug("QHexRT already registered, returning")
            return
        }
        logger.info("Registering QHexRT backend with C++ registry...")
        when (val result = registerNative()) {
            RunAnywhereBridge.RAC_SUCCESS,
            RunAnywhereBridge.RAC_ERROR_MODULE_ALREADY_REGISTERED,
            -> {
                isRegistered = true
                logger.info("QHexRT backend registered successfully (LLM/VLM/STT/TTS/embed/diffusion)")
            }
            RAC_ERROR_BACKEND_UNAVAILABLE,
            RAC_ERROR_CAPABILITY_UNSUPPORTED,
            -> {
                logger.info("QHexRT not registered: no supported Hexagon NPU on this device")
            }
            else -> {
                logger.error("QHexRT registration failed with code: $result")
            }
        }
    }

    /**
     * Enable auto-registration. Access this property to trigger C++ backend
     * registration once.
     */
    val autoRegister: Unit by lazy {
        synchronized(registrationLock) { registerInternal() }
    }
}

private val logger = SDKLogger("QHexRT")

internal fun QHexRT.registerNative(): Int {
    RunAnywhereBridge.ensureNativeLibraryLoaded()
    val skelDirectory = QHexRTSkelInstaller.installIfAvailable()
    if (!QHexRTBridge.ensureNativeLibraryLoaded()) {
        logger.info("QHexRT native library unavailable; skipping backend registration")
        return RAC_ERROR_BACKEND_UNAVAILABLE
    }
    QHexRTBridge.nativeSetSkelDirectory(skelDirectory)
    return QHexRTBridge.nativeRegister()
}

internal fun QHexRT.unregisterNative(): Int =
    if (QHexRTBridge.ensureNativeLibraryLoaded()) {
        QHexRTBridge.nativeUnregister()
    } else {
        RAC_ERROR_BACKEND_UNAVAILABLE
    }

```

### Core Architecture Module: `bindings/kotlin/modules/runanywhere-core-qhexrt/src/main/kotlin/com/runanywhere/sdk/npu/qhexrt/QHexRTBridge.kt`
```
/*
 * Copyright 2026 RunAnywhere SDK
 * SPDX-License-Identifier: Apache-2.0
 *
 * QHexRT Native Bridge
 *
 * Self-contained JNI bridge for the QHexRT (Qualcomm Hexagon NPU)
 * backend module. The native library (librac_backend_qhexrt_jni.so) exposes:
 * - rac_backend_qhexrt_register() / rac_backend_qhexrt_unregister()
 * - rac_qhexrt_probe_proto() (pre-flight Hexagon arch detection)
 * - QHexRT-owned architecture support checks
 */

package com.runanywhere.sdk.npu.qhexrt

import com.runanywhere.sdk.infrastructure.logging.SDKLogger

/**
 * Native bridge for QHexRT backend registration + NPU capability probe.
 *
 * Architecture:
 * - librac_backend_qhexrt_jni.so  - QHexRT JNI (this bridge)
 * - links librac_backend_qhexrt.so - QHexRT C++ engine (QNN runtime baked in)
 * - links librac_commons.so        - commons (plugin registry + npu probe)
 */
internal object QHexRTBridge {
    private val logger = SDKLogger("QHexRT")

    @Volatile
    private var nativeLibraryLoaded = false

    private val loadLock = Any()

    /**
     * Ensure the QHexRT JNI library is loaded. librac_commons.so (via the main
     * SDK's librunanywhere_jni.so) must already be loaded so the registry +
     * npu-probe symbols resolve.
     *
     * @return true if loaded successfully, false otherwise
     */
    fun ensureNativeLibraryLoaded(): Boolean {
        if (nativeLibraryLoaded) return true

        synchronized(loadLock) {
            if (nativeLibraryLoaded) return true

            logger.info("Loading QHexRT native library...")
            try {
                System.loadLibrary("rac_backend_qhexrt_jni")
                nativeLibraryLoaded = true
                logger.info("QHexRT native library loaded successfully")
                return true
            } catch (e: UnsatisfiedLinkError) {
                logger.error("Failed to load QHexRT native library: ${e.message}", throwable = e)
                return false
            } catch (e: Exception) {
                logger.error("Unexpected error loading QHexRT native library: ${e.message}", throwable = e)
                return false
            }
        }
    }

    /** Whether the native library is loaded. */
    val isLoaded: Boolean
        get() = nativeLibraryLoaded

    // ==========================================================================
    // JNI Methods
    // ==========================================================================

    /** Register the QHexRT backend with the C++ plugin registry. 0 = success. */
    @JvmStatic
    external fun nativeRegister(): Int

    /** Unregister the QHexRT backend. 0 = success. */
    @JvmStatic
    external fun nativeUnregister(): Int

    /**
     * Pre-flight Hexagon NPU probe. Returns serialized
     * `runanywhere.v1.NpuCapability` proto bytes (decode with the generated
     * Wire adapter); empty on failure, which decodes to the all-default
     * (unknown/unsupported) capability. Works on any device (no QNN load),
     * including parts outside the validated V75/V79/V81 set.
     */
    @JvmStatic
    external fun nativeProbeNpuProto(): ByteArray

    /** True when [arch] is in QHexRT's native device-validated support set. */
    @JvmStatic
    external fun nativeArchIsSupported(arch: Int): Boolean

    /** QHexRT module version string (RAC_QHEXRT_VERSION baked into the JNI lib). */
    @JvmStatic
    external fun nativeGetVersion(): String

    /** App-private directory containing extracted QNN DSP skel libraries. */
    @JvmStatic
    external fun nativeSetSkelDirectory(path: String?)
}

```

### Core Architecture Module: `bindings/kotlin/modules/runanywhere-core-qhexrt/src/main/kotlin/com/runanywhere/sdk/npu/qhexrt/QHexRTSkelInstaller.kt`
```
package com.runanywhere.sdk.npu.qhexrt

import android.os.Build
import com.runanywhere.sdk.foundation.security.AndroidPlatformContext
import com.runanywhere.sdk.infrastructure.logging.SDKLogger
import java.io.File

internal object QHexRTSkelInstaller {
    private const val ASSET_ROOT = "runanywhere/qhexrt/skels"
    private const val ABI_ARM64 = "arm64-v8a"

    private val logger = SDKLogger("QHexRT")
    private val lock = Any()

    @Volatile
    private var installedPath: String? = null

    fun installIfAvailable(): String? {
        if (!AndroidPlatformContext.isInitialized()) {
            logger.warning("AndroidPlatformContext is not initialized; QHexRT skels are not installed")
            return null
        }
        if (Build.SUPPORTED_ABIS.none { it == ABI_ARM64 }) {
            return null
        }

        synchronized(lock) {
            installedPath?.let { path ->
                if (File(path).containsSkel()) {
                    return path
                }
            }

            val context = AndroidPlatformContext.applicationContext
            val assetDir = "$ASSET_ROOT/$ABI_ARM64"
            val skelNames =
                context.assets
                    .list(assetDir)
                    ?.filter {
                        (it.startsWith("libQnnHtpV") && it.endsWith("Skel.so")) ||
                            it == "libQnnBonsaiBitnet.so" ||
                            // Bonsai fully-on-NPU 1-bit decoder FastRPC skel: the cDSP
                            // resolves it by name via ADSP_LIBRARY_PATH, so it must be
                            // installed into the skel dir alongside the QNN skels.
                            it == "librun_main_on_hexagon_skel.so"
                    }.orEmpty()
                    .sorted()
            if (skelNames.isEmpty()) {
                logger.warning("QHexRT DSP skel assets missing at $assetDir")
                return null
            }

            val outputDir =
                File(
                    context.codeCacheDir,
                    "runanywhere/qhexrt/skels/${context.applicationInfoVersionKey()}/$ABI_ARM64",
                )
            if (!outputDir.exists() && !outputDir.mkdirs()) {
                logger.warning("Unable to create QHexRT skel directory: ${outputDir.absolutePath}")
                return null
            }

            for (name in skelNames) {
                val assetPath = "$assetDir/$name"
                val output = File(outputDir, name)
                context.assets.open(assetPath).use { input ->
                    val expectedBytes = input.available().toLong()
                    if (output.isFile && output.length() == expectedBytes) {
                        return@use
                    }
                    val tmp = File(outputDir, "$name.tmp")
                    tmp.outputStream().use { input.copyTo(it) }
                    if (output.exists() && !output.delete()) {
                        logger.warning("Unable to replace QHexRT skel: ${output.absolutePath}")
                    }
                    if (!tmp.renameTo(output)) {
                        tmp.copyTo(output, overwrite = true)
                        tmp.delete()
                    }
                }
            }

            return outputDir.absolutePath.also {
                installedPath = it
                logger.info("QHexRT DSP skels installed to $it")
            }
        }
    }

    private fun File.containsSkel(): Boolean =
        isDirectory &&
            listFiles()?.any {
                it.name.startsWith("libQnnHtpV") && it.name.endsWith("Skel.so")
            } == true

    private fun android.content.Context.applicationInfoVersionKey(): String =
        runCatching {
            val packageInfo = packageManager.getPackageInfo(packageName, 0)
            "${packageInfo.safeVersionCode()}-${packageInfo.lastUpdateTime}"
        }.getOrElse {
            "current"
        }

    @Suppress("DEPRECATION")
    private fun android.content.pm.PackageInfo.safeVersionCode(): Long =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            longVersionCode
        } else {
            versionCode.toLong()
        }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1262** (2026-11-04): **Make rac_classify_null_directory_listing decode UTF-8 paths on Windows**
  *Symptoms*: Follow-up from #1261 by @mlzerotoheroyoutube - thanks again for that PR!  ## What `rac_directory_probe.h:40` documents `path` as UTF-8, but `core/src/infrastructure/file_management/directory_probe.cpp:25` passes the `const char*` straight to `std::filesystem::status`. On Windows that overload decodes with the ANSI code page, so an existing directory with a non-ASCII name can come back as `RAC_ERROR_FILE_NOT_FOUND` (or an inconclusive read failure).  ## Why it matters The function is now public API, so Windows consumers (Electron, Python, cpp-desktop) can reach it. A wrong `FILE_NOT_FOUND` lets orphan pruning clear registry state for a folder that still exists. Not an issue on Android, which is the only caller today.  ## Suggested approach Under `#if defined(_WIN32)` build the path from `rac_to_wstring(path)` (`core/src/core/internal/platform_compat.h`) inside the existing `try` block, or use the desktop UTF-8 path helper if it fits. Alternatively narrow the header doc to say UTF-8 is guaranteed on POSIX only.  ## Done when - [ ] A non-ASCII directory path is classified correctly on Windows, or the header documents the limitation.  Not blocking #1261. @mlzerotoheroyoutube, you know this code well now - you're welcome to take this one if you're interested.  _Opened with help from Claude Code and Codex._  _Reviewed with help from Claude Code and Codex._ <!-- oss-pr-review-merge v1 kind=followup-issue head=80349e4 pr=1261 t=fa04a838d1 --> 

- **Issue #1257** (2026-11-05): **Voice agent initialize path ignores config.vad_config (VAD threshold never applied)**
  *Symptoms*: Follow-up from #1255 by @ayaangazali - thanks again for that PR!  ## What The standalone voice-agent compose path builds its config in `core/src/features/voice_agent/voice_agent_d7_abi.cpp` (~line 1347) and passes it to `rac_voice_agent_initialize`, which never reads `config.vad_config`. Only `voice_agent_proto_abi.cpp` (~lines 175-181) configures the VAD component, and it discards the return code with `(void)`. So the presence-aware `activation_threshold` that #1255 now preserves in `config_from_proto` (`voice_agent_internal_helpers.cpp:437`) is ignored on the d7 path.  ## Why it matters A caller who sets `vad_config.activation_threshold` (including an explicit 0.0) through the d7 create path gets the VAD component's default instead. The gap predates #1255.  ## Suggested approach Apply `config.vad_config` to the VAD component in the initialize path through a helper shared with `voice_agent_proto_abi.cpp`, and check its return code instead of discarding it.  ## Done when - [ ] A threshold set through the d7 compose path reaches the VAD component. - [ ] The VAD configure result is checked on both paths.  Not blocking #1255. @ayaangazali, you know this code well now - you're welcome to take this one if you're interested.  _Opened with help from Claude Code and Codex._  _Reviewed with help from Claude Code and Codex._ <!-- oss-pr-review-merge v1 kind=followup-issue head=43d6aff pr=1255 t=6943186997 --> 
  **Post-Mortem & Fix Analysis**:
  > Thanks, I'll take this one. One thing I noticed while answering the thread: `rac_voice_agent_initialize` drops all of `vad_config` on that path, so sample rate and frame length are lost too, not only the threshold. Electron's `voice_bridge.cpp` and Flutter's `dart_bridge_voice_agent.dart` both create through `rac_voice_agent_component_create_proto`, so they're the callers that hit it. I'll aim for applying it once inside `rac_voice_agent_initialize` so both create paths share it, and check the result there. PR should be up tomorrow. 

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

### Incident Patch 1: `65b3ace3` (2026-11-04)
**Commit Message**: fix(model-registry): preserve downloads on inconclusive fs probes (#1267)

* fix(model-registry): preserve downloads on inconclusive fs probes

Directory listing adapters now return FILE_NOT_FOUND only for confirmed missing or non-directory paths, and FILE_READ_FAILED for denied or inconclusive reads. A failed child type probe aborts the listing instead of being emitted as a regular file.

Before pruning an incomplete model folder, commons requires a successful exhaustive bounded walk of the whole folder tree, so a readable root companion cannot hide an unreadable nested directory. The locked recheck and atomic commit from #1170 are unchanged.

* fix: address review findings for permission-safe pruning

Treat vanished or unprobeable child entries as inconclusive while still listing dangling symlinks as non-directories. Reject partial, saturated, and oversized-name listings instead of returning success.

Walk the whole tree before pruning folders with no finished artifact, include hidden directories in desktop/Web enumeration, and align the desktop adapter with the missing-vs-inconclusive contract.

* fix(web): define FILE_READ_FAILED for listing errors

* fix: complete adapter cont

**File**: `bindings/electron/native/posix_platform_adapter.cpp` (modified, +64/-7)
```diff
@@ -27,6 +27,7 @@
 #include "posix_platform_adapter.h"
 
 #include "rac/core/rac_error.h"
+#include "rac/core/rac_logger.h"
 #include "rac/core/rac_types.h"
 
 namespace fs = std::filesystem;
@@ -37,6 +38,36 @@ namespace {
 // so the "callbacks may run on any thread" contract holds without locking.
 std::string g_secure_dir;
 
+// Distinguish a confirmed missing/non-directory path from a permission or I/O
+// failure. The boolean std::filesystem probes collapse both into false, which
+// lets orphan pruning mistake an unreadable download folder for a vanished one.
+bool is_confirmed_missing(const std::error_code& ec) {
+    return ec == std::errc::no_such_file_or_directory || ec == std::errc::not_a_directory;
+}
+
+// Confirm that `directory` exists and is a directory. Only an affirmative
+// missing/non-directory result maps to FILE_NOT_FOUND; denied or unknown
+// probes stay inconclusive for callers that preserve registry state.
+rac_result_t classify_directory_probe(const fs::path& directory) {
+    std::error_code ec;
+    const fs::file_status status = fs::status(directory, ec);
+    if (is_confirmed_missing(ec)) {
+        return RAC_ERROR_FILE_NOT_FOUND;
+    }
+    if (ec) {
+        return RAC_ERROR_FILE_READ_FAILED;
+    }
+    switch (status.type()) {
+        case fs::file_type::not_found:
+            return RAC_ERROR_FILE_NOT_FOUND;
+        case fs::file_type::none:
+        case fs::file_type::unknown:
+            return RAC_ERROR_FILE_READ_FAILED;
+        default:
+            return fs::is_directory(status) ? RAC_SUCCESS : RAC_ERROR_FILE_NOT_FOUND;
+    }
+}
+
 const char* level_name(rac_log_level_t lvl) {
     switch (lvl) {
         case RAC_LOG_TRACE: return "TRACE";
@@ -290,28 +321,54 @@ rac_result_t posix_list_dir(const char* dir_path, rac_directory_entry_t* out_ent
     if (!dir_path || !in_out_count) return RAC_ERROR_INVALID_ARGUMENT;
     std::error_code ec;
     fs::path dir(dir_path);
-    if (!fs::is_directory(dir, ec) || ec) return RAC_ERROR_FILE_NOT_FOUND;
+    const rac_result_t probe_rc = classify_directory_probe(dir);
+    if (probe_rc != RAC_SUCCESS) return probe_rc;
     const size_t cap = out_entries ? *in_out_count : 0;
     size_t written = 0, total = 0;
     for (fs::directory_iterator it(dir, ec), end; !ec && it != end; it.increment(ec)) {
         ++total;
         if (!out_entries || written >= cap) continue;
         std::string name = it->path().filename().string();
-        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) continue;  // skip oversized
+        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) {
+            // A skipped name makes this a partial listing; callers must not
+            // mistake it for a complete directory.
+            RAC_LOG_WARNING("PlatformAdapter", "oversized entry in %s", dir_path);
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        // The type probe decides whether the walk recurses. A failed probe
+        // must stay inconclusive instead of reporting a regular file.
+        std::error_code type_ec;
+        fs::file_status child_status = fs::status(it->path(), type_ec);
+        if (is_confirmed_missing(type_ec)) {
+            // A dangling symlink has a missing target but is still a
+            // non-directory entry; a vanished entry stays inconclusive.
+            type_ec.clear();
+            child_status = fs::symlink_status(it->path(), type_ec);
+        }
+        if (type_ec || child_status.type() == fs::file_type::none ||
+            child_status.type() == fs::file_type::unknown ||
+            child_status.type() == fs::file_type::not_found) {
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        const bool is_dir = fs::is_directory(child_status);
         std::strncpy(out_entries[written].name, name.c_str(), RAC_DIRECTORY_ENTRY_NAME_MAX - 1);
         out_entries[written].name[RAC_DIRECTORY_ENTRY_NAME_MAX - 1] = '\0';
-        std::error_code ec2;
-        bool is_dir = fs::is_directory(it->path(), ec2);
         out_entries[written].is_dir = is_dir ? RAC_TRUE : RAC_FALSE;
-        out_entries[written].size_bytes =
-            is_dir ? 0 : static_cast<int64_t>(fs::file_size(it->path(), ec2));
-        if (ec2) {
+        if (is_dir) {
             out_entries[written].size_bytes = 0;
+        } else {
+            std::error_code size_ec;
+            const auto size = fs::file_size(it->path(), size_ec);
+            out_entries[written].size_bytes = size_ec ? 0 : static_cast<int64_t>(size);
         }
         ++written;
     }
     // A failed open/advance is an I/O error, not an empty or shorter listing.
     if (ec) return RAC_ERROR_FILE_READ_FAILED;
+    if (out_entries && total > cap) {
+        // The caller's buffer was too small: a partial fill is not a listing.
+        return RAC_ERROR_FILE_READ_FAILED;
+    }
     *in_out_count = out_entries ? written : total;
     return RAC_SUCCESS;
 }
```

**File**: `bindings/electron/native/win32_platform_adapter.cpp` (modified, +64/-7)
```diff
@@ -18,6 +18,7 @@
 #include "win32_platform_adapter.h"
 
 #include "rac/core/rac_error.h"
+#include "rac/core/rac_logger.h"
 #include "rac/core/rac_types.h"
 
 namespace fs = std::filesystem;
@@ -28,6 +29,36 @@ namespace {
 // so the "callbacks may run on any thread" contract holds without locking.
 std::string g_secure_dir;
 
+// Distinguish a confirmed missing/non-directory path from a permission or I/O
+// failure. The boolean std::filesystem probes collapse both into false, which
+// lets orphan pruning mistake an unreadable download folder for a vanished one.
+bool is_confirmed_missing(const std::error_code& ec) {
+    return ec == std::errc::no_such_file_or_directory || ec == std::errc::not_a_directory;
+}
+
+// Confirm that `directory` exists and is a directory. Only an affirmative
+// missing/non-directory result maps to FILE_NOT_FOUND; denied or unknown
+// probes stay inconclusive for callers that preserve registry state.
+rac_result_t classify_directory_probe(const fs::path& directory) {
+    std::error_code ec;
+    const fs::file_status status = fs::status(directory, ec);
+    if (is_confirmed_missing(ec)) {
+        return RAC_ERROR_FILE_NOT_FOUND;
+    }
+    if (ec) {
+        return RAC_ERROR_FILE_READ_FAILED;
+    }
+    switch (status.type()) {
+        case fs::file_type::not_found:
+            return RAC_ERROR_FILE_NOT_FOUND;
+        case fs::file_type::none:
+        case fs::file_type::unknown:
+            return RAC_ERROR_FILE_READ_FAILED;
+        default:
+            return fs::is_directory(status) ? RAC_SUCCESS : RAC_ERROR_FILE_NOT_FOUND;
+    }
+}
+
 const char* level_name(rac_log_level_t lvl) {
     switch (lvl) {
         case RAC_LOG_TRACE: return "TRACE";
@@ -259,28 +290,54 @@ rac_result_t win_list_dir(const char* dir_path, rac_directory_entry_t* out_entri
     if (!dir_path || !in_out_count) return RAC_ERROR_INVALID_ARGUMENT;
     std::error_code ec;
     fs::path dir = utf8_path(dir_path);
-    if (!fs::is_directory(dir, ec) || ec) return RAC_ERROR_FILE_NOT_FOUND;
+    const rac_result_t probe_rc = classify_directory_probe(dir);
+    if (probe_rc != RAC_SUCCESS) return probe_rc;
     const size_t cap = out_entries ? *in_out_count : 0;
     size_t written = 0, total = 0;
     for (fs::directory_iterator it(dir, ec), end; !ec && it != end; it.increment(ec)) {
         ++total;
         if (!out_entries || written >= cap) continue;
         std::string name = wide_to_utf8(it->path().filename().wstring());  // UTF-8 contract
-        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) continue;  // skip oversized
+        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) {
+            // A skipped name makes this a partial listing; callers must not
+            // mistake it for a complete directory.
+            RAC_LOG_WARNING("PlatformAdapter", "oversized entry in %s", dir_path);
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        // The type probe decides whether the walk recurses. A failed probe
+        // must stay inconclusive instead of reporting a regular file.
+        std::error_code type_ec;
+        fs::file_status child_status = fs::status(it->path(), type_ec);
+        if (is_confirmed_missing(type_ec)) {
+            // A dangling symlink has a missing target but is still a
+            // non-directory entry; a vanished entry stays inconclusive.
+            type_ec.clear();
+            child_status = fs::symlink_status(it->path(), type_ec);
+        }
+        if (type_ec || child_status.type() == fs::file_type::none ||
+            child_status.type() == fs::file_type::unknown ||
+            child_status.type() == fs::file_type::not_found) {
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        const bool is_dir = fs::is_directory(child_status);
         std::strncpy(out_entries[written].name, name.c_str(), RAC_DIRECTORY_ENTRY_NAME_MAX - 1);
         out_entries[written].name[RAC_DIRECTORY_ENTRY_NAME_MAX - 1] = '\0';
-        std::error_code ec2;
-        bool is_dir = fs::is_directory(it->path(), ec2);
         out_entries[written].is_dir = is_dir ? RAC_TRUE : RAC_FALSE;
-        out_entries[written].size_bytes =
-            is_dir ? 0 : static_cast<int64_t>(fs::file_size(it->path(), ec2));
-        if (ec2) {
+        if (is_dir) {
             out_entries[written].size_bytes = 0;
+        } else {
+            std::error_code size_ec;
+            const auto size = fs::file_size(it->path(), size_ec);
+            out_entries[written].size_bytes = size_ec ? 0 : static_cast<int64_t>(size);
         }
         ++written;
     }
     // A failed open/advance is an I/O error, not an empty or shorter listing.
     if (ec) return RAC_ERROR_FILE_READ_FAILED;
+    if (out_entries && total > cap) {
+        // The caller's buffer was too small: a partial fill is not a listing.
+        return RAC_ERROR_FILE_READ_FAILED;
+    }
     *in_out_count = out_entries ? written : total;
     return RAC_SUCCESS;
 }
```

**File**: `bindings/kotlin/src/main/kotlin/com/runanywhere/sdk/foundation/bridge/extensions/CppBridgePlatformAdapter.kt` (modified, +50/-27)
```diff
@@ -10,6 +10,9 @@
 
 package com.runanywhere.sdk.foundation.bridge.extensions
 
+import android.system.ErrnoException
+import android.system.Os
+import android.system.OsConstants
 import com.runanywhere.sdk.infrastructure.logging.SDKLogger
 import com.runanywhere.sdk.native.bridge.RunAnywhereBridge
 import java.io.File
@@ -27,7 +30,7 @@ import java.io.IOException
  * @property name UTF-8 entry name (no path component). MUST fit in
  *                [CppBridgePlatformAdapter.NAME_MAX_BYTES] including the
  *                trailing NUL byte that the JNI layer appends; oversized
- *                entries MUST be filtered by the producer (we do this in
+ *                entries MUST make the listing fail (enforced by
  *                [CppBridgePlatformAdapter.fileListDirectory]).
  * @property isDir true when the entry is a directory.
  * @property sizeBytes file size in bytes; 0 for directories or unknown.
@@ -74,10 +77,8 @@ object CppBridgePlatformAdapter {
      * returned via [RacDirectoryEntry]. Mirrors
      * `RAC_DIRECTORY_ENTRY_NAME_MAX` in `rac_platform_adapter.h`.
      *
-     * Per the truncation contract on `rac_directory_entry_t::name`,
-     * oversized entries MUST be skipped rather than truncated so the
-     * no-error path never returns a half-name that could alias a
-     * different on-disk artifact.
+     * Per the contract on `rac_directory_entry_t::name`, oversized entries
+     * make the listing inconclusive. They are never skipped or truncated.
      */
     const val NAME_MAX_BYTES: Int = 512
 
@@ -361,51 +362,73 @@ object CppBridgePlatformAdapter {
      * JNI confirms missing/non-directory paths with an error-aware native probe
      * before returning RAC_ERROR_FILE_NOT_FOUND; denied or inconclusive probes
      * preserve the registered download path. Thrown failures propagate to JNI
-     * as RAC_ERROR_INTERNAL. A successful empty listing remains an empty array.
-     *
-     * Truncation contract (per `rac_directory_entry_t::name`): entries
-     * whose UTF-8 byte length plus the trailing NUL exceed
-     * [NAME_MAX_BYTES] MUST be skipped rather than silently truncated. We
-     * emit a single WARN log per call that summarises how many entries
-     * were skipped so operators can detect the rare event without flooding
-     * logcat.
+     * as RAC_ERROR_FILE_READ_FAILED. A successful empty listing remains an
+     * empty array.
+     *
+     * Truncation contract (per `rac_directory_entry_t::name`): an entry whose
+     * UTF-8 byte length plus the trailing NUL exceeds [NAME_MAX_BYTES] makes
+     * the listing inconclusive. We log a WARN and throw instead of returning a
+     * partial listing.
      */
     @JvmStatic
     fun fileListDirectoryCallback(dirPath: String): Array<RacDirectoryEntry>? = readDirectoryEntries(File(dirPath))
 
+    /**
+     * Probe an entry with stat(2)/lstat(2). A failed probe is inconclusive and
+     * must not be emitted as a regular file; a dangling symlink remains a
+     * non-directory entry. FIFOs, sockets, and device nodes are rejected.
+     */
+    private fun probeDirectoryEntry(child: File): Pair<Boolean, Long> {
+        val path = child.absolutePath
+        val info =
+            try {
+                Os.stat(path)
+            } catch (error: ErrnoException) {
+                if (error.errno == OsConstants.ENOENT || error.errno == OsConstants.ENOTDIR) {
+                    try {
+                        Os.lstat(path)
+                        return false to 0L
+                    } catch (_: ErrnoException) {
+                        throw IOException("Directory entry vanished while listing: '$path'", error)
+                    }
+                }
+                throw IOException("Unable to probe directory entry '$path'", error)
+            }
+        val isDir = OsConstants.S_ISDIR(info.st_mode)
+        if (!isDir && !OsConstants.S_ISREG(info.st_mode)) {
+            throw IOException("Unsupported directory entry type: '$path'")
+        }
+        return isDir to if (isDir) 0L else info.st_size
+    }
+
     /**
      * Read directory entries, preserving probe and enumeration errors for JNI.
+     * The entry probe is separate so host JVM checks can use their filesystem.
      *
      * @throws IOException if an existing directory cannot be enumerated
      * @throws SecurityException if the filesystem denies a probe or listing
      */
-    internal fun readDirectoryEntries(dir: File): Array<RacDirectoryEntry>? {
+    internal fun readDirectoryEntries(
+        dir: File,
+        probeEntry: (File) -> Pair<Boolean, Long> = ::probeDirectoryEntry,
+    ): Array<RacDirectoryEntry>? {
         if (!dir.exists() || !dir.isDirectory) {
             // JNI rechecks null because Java can hide stat errors behind false.
             return null
         }
         // A null listing means I/O failure, not a successful empty directory.
         val children = dir.listFiles() ?: throw IOException("Unable to enumerat
```

**File**: `bindings/kotlin/src/test/kotlin/com/runanywhere/sdk/foundation/bridge/extensions/CppBridgePlatformAdapterDirectoryTest.kt` (modified, +9/-1)
```diff
@@ -9,6 +9,8 @@ import org.junit.Rule
 import org.junit.rules.TemporaryFolder
 import java.io.File
 import java.io.IOException
+import java.nio.file.Files
+import java.nio.file.attribute.BasicFileAttributes
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertFailsWith
@@ -50,7 +52,13 @@ class CppBridgePlatformAdapterDirectoryTest {
         File(directory, "weights.gguf").writeBytes(ByteArray(42))
         assertTrue(File(directory, "nested").mkdir())
 
-        val entries = assertNotNull(CppBridgePlatformAdapter.fileListDirectoryCallback(directory.path)).associateBy { it.name }
+        val entries =
+            assertNotNull(
+                CppBridgePlatformAdapter.readDirectoryEntries(directory) { child ->
+                    val attributes = Files.readAttributes(child.toPath(), BasicFileAttributes::class.java)
+                    attributes.isDirectory to if (attributes.isDirectory) 0L else attributes.size()
+                },
+            ).associateBy { it.name }
 
         assertEquals(setOf("weights.gguf", "nested"), entries.keys)
         assertEquals(RacDirectoryEntry("weights.gguf", false, 42), entries["weights.gguf"])
```

**File**: `bindings/python/native/posix_platform_adapter.cpp` (modified, +64/-7)
```diff
@@ -27,6 +27,7 @@
 #include "posix_platform_adapter.h"
 
 #include "rac/core/rac_error.h"
+#include "rac/core/rac_logger.h"
 #include "rac/core/rac_types.h"
 
 namespace fs = std::filesystem;
@@ -37,6 +38,36 @@ namespace {
 // so the "callbacks may run on any thread" contract holds without locking.
 std::string g_secure_dir;
 
+// Distinguish a confirmed missing/non-directory path from a permission or I/O
+// failure. The boolean std::filesystem probes collapse both into false, which
+// lets orphan pruning mistake an unreadable download folder for a vanished one.
+bool is_confirmed_missing(const std::error_code& ec) {
+    return ec == std::errc::no_such_file_or_directory || ec == std::errc::not_a_directory;
+}
+
+// Confirm that `directory` exists and is a directory. Only an affirmative
+// missing/non-directory result maps to FILE_NOT_FOUND; denied or unknown
+// probes stay inconclusive for callers that preserve registry state.
+rac_result_t classify_directory_probe(const fs::path& directory) {
+    std::error_code ec;
+    const fs::file_status status = fs::status(directory, ec);
+    if (is_confirmed_missing(ec)) {
+        return RAC_ERROR_FILE_NOT_FOUND;
+    }
+    if (ec) {
+        return RAC_ERROR_FILE_READ_FAILED;
+    }
+    switch (status.type()) {
+        case fs::file_type::not_found:
+            return RAC_ERROR_FILE_NOT_FOUND;
+        case fs::file_type::none:
+        case fs::file_type::unknown:
+            return RAC_ERROR_FILE_READ_FAILED;
+        default:
+            return fs::is_directory(status) ? RAC_SUCCESS : RAC_ERROR_FILE_NOT_FOUND;
+    }
+}
+
 const char* level_name(rac_log_level_t lvl) {
     switch (lvl) {
         case RAC_LOG_TRACE: return "TRACE";
@@ -290,28 +321,54 @@ rac_result_t posix_list_dir(const char* dir_path, rac_directory_entry_t* out_ent
     if (!dir_path || !in_out_count) return RAC_ERROR_INVALID_ARGUMENT;
     std::error_code ec;
     fs::path dir(dir_path);
-    if (!fs::is_directory(dir, ec) || ec) return RAC_ERROR_FILE_NOT_FOUND;
+    const rac_result_t probe_rc = classify_directory_probe(dir);
+    if (probe_rc != RAC_SUCCESS) return probe_rc;
     const size_t cap = out_entries ? *in_out_count : 0;
     size_t written = 0, total = 0;
     for (fs::directory_iterator it(dir, ec), end; !ec && it != end; it.increment(ec)) {
         ++total;
         if (!out_entries || written >= cap) continue;
         std::string name = it->path().filename().string();
-        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) continue;  // skip oversized
+        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) {
+            // A skipped name makes this a partial listing; callers must not
+            // mistake it for a complete directory.
+            RAC_LOG_WARNING("PlatformAdapter", "oversized entry in %s", dir_path);
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        // The type probe decides whether the walk recurses. A failed probe
+        // must stay inconclusive instead of reporting a regular file.
+        std::error_code type_ec;
+        fs::file_status child_status = fs::status(it->path(), type_ec);
+        if (is_confirmed_missing(type_ec)) {
+            // A dangling symlink has a missing target but is still a
+            // non-directory entry; a vanished entry stays inconclusive.
+            type_ec.clear();
+            child_status = fs::symlink_status(it->path(), type_ec);
+        }
+        if (type_ec || child_status.type() == fs::file_type::none ||
+            child_status.type() == fs::file_type::unknown ||
+            child_status.type() == fs::file_type::not_found) {
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        const bool is_dir = fs::is_directory(child_status);
         std::strncpy(out_entries[written].name, name.c_str(), RAC_DIRECTORY_ENTRY_NAME_MAX - 1);
         out_entries[written].name[RAC_DIRECTORY_ENTRY_NAME_MAX - 1] = '\0';
-        std::error_code ec2;
-        bool is_dir = fs::is_directory(it->path(), ec2);
         out_entries[written].is_dir = is_dir ? RAC_TRUE : RAC_FALSE;
-        out_entries[written].size_bytes =
-            is_dir ? 0 : static_cast<int64_t>(fs::file_size(it->path(), ec2));
-        if (ec2) {
+        if (is_dir) {
             out_entries[written].size_bytes = 0;
+        } else {
+            std::error_code size_ec;
+            const auto size = fs::file_size(it->path(), size_ec);
+            out_entries[written].size_bytes = size_ec ? 0 : static_cast<int64_t>(size);
         }
         ++written;
     }
     // A failed open/advance is an I/O error, not an empty or shorter listing.
     if (ec) return RAC_ERROR_FILE_READ_FAILED;
+    if (out_entries && total > cap) {
+        // The caller's buffer was too small: a partial fill is not a listing.
+        return RAC_ERROR_FILE_READ_FAILED;
+    }
     *in_out_count = out_entries ? written : total;
     return RAC_SUCCESS;
 }
```

**File**: `bindings/python/native/win32_platform_adapter.cpp` (modified, +64/-7)
```diff
@@ -21,6 +21,7 @@
 #include "win32_platform_adapter.h"
 
 #include "rac/core/rac_error.h"
+#include "rac/core/rac_logger.h"
 #include "rac/core/rac_types.h"
 
 namespace fs = std::filesystem;
@@ -31,6 +32,36 @@ namespace {
 // so the "callbacks may run on any thread" contract holds without locking.
 std::string g_secure_dir;
 
+// Distinguish a confirmed missing/non-directory path from a permission or I/O
+// failure. The boolean std::filesystem probes collapse both into false, which
+// lets orphan pruning mistake an unreadable download folder for a vanished one.
+bool is_confirmed_missing(const std::error_code& ec) {
+    return ec == std::errc::no_such_file_or_directory || ec == std::errc::not_a_directory;
+}
+
+// Confirm that `directory` exists and is a directory. Only an affirmative
+// missing/non-directory result maps to FILE_NOT_FOUND; denied or unknown
+// probes stay inconclusive for callers that preserve registry state.
+rac_result_t classify_directory_probe(const fs::path& directory) {
+    std::error_code ec;
+    const fs::file_status status = fs::status(directory, ec);
+    if (is_confirmed_missing(ec)) {
+        return RAC_ERROR_FILE_NOT_FOUND;
+    }
+    if (ec) {
+        return RAC_ERROR_FILE_READ_FAILED;
+    }
+    switch (status.type()) {
+        case fs::file_type::not_found:
+            return RAC_ERROR_FILE_NOT_FOUND;
+        case fs::file_type::none:
+        case fs::file_type::unknown:
+            return RAC_ERROR_FILE_READ_FAILED;
+        default:
+            return fs::is_directory(status) ? RAC_SUCCESS : RAC_ERROR_FILE_NOT_FOUND;
+    }
+}
+
 const char* level_name(rac_log_level_t lvl) {
     switch (lvl) {
         case RAC_LOG_TRACE: return "TRACE";
@@ -245,28 +276,54 @@ rac_result_t win_list_dir(const char* dir_path, rac_directory_entry_t* out_entri
     if (!dir_path || !in_out_count) return RAC_ERROR_INVALID_ARGUMENT;
     std::error_code ec;
     fs::path dir = utf8_path(dir_path);
-    if (!fs::is_directory(dir, ec) || ec) return RAC_ERROR_FILE_NOT_FOUND;
+    const rac_result_t probe_rc = classify_directory_probe(dir);
+    if (probe_rc != RAC_SUCCESS) return probe_rc;
     const size_t cap = out_entries ? *in_out_count : 0;
     size_t written = 0, total = 0;
     for (fs::directory_iterator it(dir, ec), end; !ec && it != end; it.increment(ec)) {
         ++total;
         if (!out_entries || written >= cap) continue;
         std::string name = wide_to_utf8(it->path().filename().wstring());  // UTF-8 contract
-        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) continue;  // skip oversized
+        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) {
+            // A skipped name makes this a partial listing; callers must not
+            // mistake it for a complete directory.
+            RAC_LOG_WARNING("PlatformAdapter", "oversized entry in %s", dir_path);
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        // The type probe decides whether the walk recurses. A failed probe
+        // must stay inconclusive instead of reporting a regular file.
+        std::error_code type_ec;
+        fs::file_status child_status = fs::status(it->path(), type_ec);
+        if (is_confirmed_missing(type_ec)) {
+            // A dangling symlink has a missing target but is still a
+            // non-directory entry; a vanished entry stays inconclusive.
+            type_ec.clear();
+            child_status = fs::symlink_status(it->path(), type_ec);
+        }
+        if (type_ec || child_status.type() == fs::file_type::none ||
+            child_status.type() == fs::file_type::unknown ||
+            child_status.type() == fs::file_type::not_found) {
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        const bool is_dir = fs::is_directory(child_status);
         std::strncpy(out_entries[written].name, name.c_str(), RAC_DIRECTORY_ENTRY_NAME_MAX - 1);
         out_entries[written].name[RAC_DIRECTORY_ENTRY_NAME_MAX - 1] = '\0';
-        std::error_code ec2;
-        bool is_dir = fs::is_directory(it->path(), ec2);
         out_entries[written].is_dir = is_dir ? RAC_TRUE : RAC_FALSE;
-        out_entries[written].size_bytes =
-            is_dir ? 0 : static_cast<int64_t>(fs::file_size(it->path(), ec2));
-        if (ec2) {
+        if (is_dir) {
             out_entries[written].size_bytes = 0;
+        } else {
+            std::error_code size_ec;
+            const auto size = fs::file_size(it->path(), size_ec);
+            out_entries[written].size_bytes = size_ec ? 0 : static_cast<int64_t>(size);
         }
         ++written;
     }
     // A failed open/advance is an I/O error, not an empty or shorter listing.
     if (ec) return RAC_ERROR_FILE_READ_FAILED;
+    if (out_entries && total > cap) {
+        // The caller's buffer was too small: a partial fill is not a listing.
+        return RAC_ERROR_FILE_READ_FAILED;
+    }
     *in_out_count = out_entries ? written : total;
     return RAC_SUCCESS;
 }
```

**File**: `bindings/react-native/packages/core/android/src/main/java/com/margelo/nitro/runanywhere/PlatformAdapterBridge.kt` (modified, +41/-15)
```diff
@@ -19,6 +19,9 @@ import android.os.BatteryManager
 import android.os.Build
 import android.os.PowerManager
 import android.provider.Settings
+import android.system.ErrnoException
+import android.system.Os
+import android.system.OsConstants
 import android.util.Log
 import com.margelo.nitro.NitroModules
 import com.runanywhere.sdk.generated.RADefaults
@@ -699,20 +702,46 @@ object PlatformAdapterBridge {
 
     /**
      * Maximum entry name length (incl. NUL) per `RAC_DIRECTORY_ENTRY_NAME_MAX`.
-     * Oversized entries are skipped per the truncation contract in
-     * `rac_platform_adapter.h::rac_directory_entry_t::name`.
+     * Oversized entries make the listing inconclusive per the truncation
+     * contract in `rac_platform_adapter.h::rac_directory_entry_t::name`.
      */
     private const val DIRECTORY_ENTRY_NAME_MAX = 512
 
+    /**
+     * Probe an entry with stat(2)/lstat(2). A failed probe is inconclusive and
+     * must not be emitted as a regular file; a dangling symlink remains a
+     * non-directory entry.
+     */
+    private fun probeDirectoryEntry(child: File): Pair<Boolean, Long> {
+        val path = child.absolutePath
+        val info = try {
+            Os.stat(path)
+        } catch (error: ErrnoException) {
+            if (error.errno == OsConstants.ENOENT || error.errno == OsConstants.ENOTDIR) {
+                try {
+                    Os.lstat(path)
+                    return false to 0L
+                } catch (_: ErrnoException) {
+                    throw IOException("Directory entry vanished while listing: '$path'", error)
+                }
+            }
+            throw IOException("Unable to probe directory entry '$path'", error)
+        }
+        val isDir = OsConstants.S_ISDIR(info.st_mode)
+        if (!isDir && !OsConstants.S_ISREG(info.st_mode)) {
+            throw IOException("Unsupported directory entry type: '$path'")
+        }
+        return isDir to if (isDir) 0L else info.st_size
+    }
+
     /**
      * Enumerate directory entries via java.io.File.listFiles().
      *
      * @return Array of RacDirectoryEntry or null if the path does not exist /
-     *         is not a directory. Oversized names (UTF-8 + NUL > 512) are
-     *         filtered out with a single WARN summary; the C++ layer enforces
-     *         the same contract defensively.
-     * @throws IOException if an existing directory cannot be enumerated; the
-     *         JNI caller reports any thrown failure as RAC_ERROR_INTERNAL.
+     *         is not a directory.
+     * @throws IOException if an existing directory cannot be enumerated or an
+     *         entry name exceeds [DIRECTORY_ENTRY_NAME_MAX]; the JNI caller
+     *         reports any thrown failure as RAC_ERROR_FILE_READ_FAILED.
      */
     @JvmStatic
     fun fileListDirectory(dirPath: String): Array<RacDirectoryEntry>? {
@@ -723,26 +752,23 @@ object PlatformAdapterBridge {
         // A null listing means I/O failure, not a successful empty directory.
         val children = dir.listFiles() ?: throw IOException("Unable to enumerate directory '$dirPath'")
 
-        var skipped = 0
         val entries = ArrayList<RacDirectoryEntry>(children.size)
         for (child in children) {
             val name = child.name
             val utf8Bytes = name.toByteArray(Charsets.UTF_8)
             if (utf8Bytes.size + 1 > DIRECTORY_ENTRY_NAME_MAX) {
-                skipped++
-                continue
+                Log.w(TAG, "fileListDirectory: oversized entry name in $dirPath")
+                throw IOException("Oversized directory entry name in '$dirPath'")
             }
+            val (isDir, sizeBytes) = probeDirectoryEntry(child)
             entries.add(
                 RacDirectoryEntry(
                     name = name,
-                    isDir = child.isDirectory,
-                    sizeBytes = if (child.isFile) child.length() else 0L,
+                    isDir = isDir,
+                    sizeBytes = sizeBytes,
                 ),
             )
         }
-        if (skipped > 0) {
-            Log.w(TAG, "fileListDirectory: skipped $skipped oversized entry name(s) in $dirPath")
-        }
         return entries.toTypedArray()
     }
 
```

**File**: `bindings/react-native/packages/core/cpp/bridges/InitBridge.cpp` (modified, +39/-15)
```diff
@@ -12,6 +12,7 @@
 #include "ExternalConfigGuard.hpp"
 #include "HTTPBridge.hpp"
 #include "PlatformDownloadBridge.h"
+#include "rac/core/rac_logger.h"
 #include "rac/foundation/rac_proto_buffer.h"
 #include "rac/foundation/rac_sha256.h"
 #include "rac/infrastructure/device/rac_device_identity.h" // rac_device_get_or_create_persistent_id
@@ -570,6 +571,10 @@ namespace AndroidBridge {
         return callStaticString(g_getTimezoneIdentifierMethod, "getTimezoneIdentifier");
     }
 
+    // Directory enumeration via
+    // java.io.File.listFiles(). Two-call semantics matching
+    // rac_file_list_directory_fn. An oversized name makes the listing
+    // inconclusive; Kotlin throws and this layer also defends against one.
     static rac_result_t classifyNullDirectoryListing(const char* dir_path) {
         if (!dir_path) {
             return RAC_ERROR_INVALID_ARGUMENT;
@@ -586,9 +591,8 @@ namespace AndroidBridge {
 
     // Directory enumeration via
     // java.io.File.listFiles(). Two-call semantics matching
-    // rac_file_list_directory_fn. Truncation contract: skip oversized
-    // names rather than write a half-name that aliases a different
-    // artifact (Kotlin side already filters; we defend on this side too).
+    // rac_file_list_directory_fn. An oversized name makes the listing
+    // inconclusive; Kotlin throws and this layer also defends against one.
     rac_result_t fileListDirectory(const char* dir_path,
                                    rac_directory_entry_t* out_entries,
                                    size_t* in_out_count) {
@@ -612,7 +616,7 @@ namespace AndroidBridge {
         if (env->ExceptionCheck()) {
             env->ExceptionClear();
             LOGE("Exception in fileListDirectory");
-            return RAC_ERROR_INTERNAL;
+            return RAC_ERROR_FILE_READ_FAILED;
         }
         // Kotlin returns null when File.exists()/isDirectory() are false, but
         // those also return false on stat errors. Confirm absence before
@@ -631,14 +635,19 @@ namespace AndroidBridge {
         }
 
         const size_t capacity = *in_out_count;
-        const size_t write_count =
-            (capacity < static_cast<size_t>(total)) ? capacity : static_cast<size_t>(total);
+        if (static_cast<size_t>(total) > capacity) {
+            // A partial fill is not a complete listing.
+            env->DeleteLocalRef(result);
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        const size_t write_count = static_cast<size_t>(total);
         size_t written = 0;
 
         for (size_t i = 0; i < write_count; ++i) {
             jobject entryObj = env->GetObjectArrayElement(result, static_cast<jsize>(i));
             if (!entryObj) {
-                continue;
+                env->DeleteLocalRef(result);
+                return RAC_ERROR_FILE_READ_FAILED;
             }
             jclass entryClass = env->GetObjectClass(entryObj);
             jfieldID nameField = env->GetFieldID(entryClass, "name", "Ljava/lang/String;");
@@ -651,17 +660,32 @@ namespace AndroidBridge {
 
             const char* nameChars =
                 jName ? env->GetStringUTFChars(jName, nullptr) : nullptr;
-            if (nameChars) {
-                const size_t nameLen = std::strlen(nameChars);
-                if (nameLen + 1 <= RAC_DIRECTORY_ENTRY_NAME_MAX) {
-                    std::memset(out_entries[written].name, 0, RAC_DIRECTORY_ENTRY_NAME_MAX);
-                    std::memcpy(out_entries[written].name, nameChars, nameLen);
-                    out_entries[written].is_dir = jIsDir ? RAC_TRUE : RAC_FALSE;
-                    out_entries[written].size_bytes = static_cast<int64_t>(jSize);
-                    written++;
+            if (!nameChars) {
+                env->ExceptionClear();
+                if (jName) {
+                    env->DeleteLocalRef(jName);
                 }
+                env->DeleteLocalRef(entryClass);
+                env->DeleteLocalRef(entryObj);
+                env->DeleteLocalRef(result);
+                return RAC_ERROR_FILE_READ_FAILED;
+            }
+            const size_t nameLen = std::strlen(nameChars);
+            if (nameLen + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) {
+                RAC_LOG_WARNING("PlatformAdapter", "oversized entry in %s", dir_path);
                 env->ReleaseStringUTFChars(jName, nameChars);
+                env->DeleteLocalRef(jName);
+                env->DeleteLocalRef(entryClass);
+                env->DeleteLocalRef(entryObj);
+                env->DeleteLocalRef(result);
+                return RAC_ERROR_FILE_READ_FAILED;
             }
+            std::memset(out_entries[written].name, 0, RAC_DIRECTORY_ENTRY_NAME_MAX);
+            std::memcpy(out_entries[written].name, nameChars, nameLen);
+            out_entries[written].is_dir = jIsDir ? RAC_TRUE : RAC_FALSE;
+            out_entries[written].size_bytes = static_cast<int64_t>(jSize);
+            written++;
+            env->ReleaseStringUT
```

---

### Incident Patch 2: `7845f05c` (2026-11-04)
**Commit Message**: fix(android): contain JNI file callback exceptions (#1276)

Every jni_fc_* file callback in runanywhere_commons_jni.cpp now checks and
clears pending Java exceptions after its NewStringUTF/Call*Method calls, and
only publishes out-params on a successful call.

- jni_fc_create_directory / jni_fc_delete_path / jni_fc_get_file_size: clear a
  pending exception from NewStringUTF and from the Call*Method, returning
  RAC_ERROR_OUT_OF_MEMORY or RAC_ERROR_INTERNAL instead of a stale result.
- jni_fc_path_exists: zeroes *out_is_directory up front, refuses to run the
  is_directory probe using a result from an exceptional call, and reports
  false when the callback throws.
- jni_fc_get_available_space / jni_fc_get_total_space: return -1 when the
  callback throws.
- jni_fc_list_directory: clears exceptions after GetArrayLength,
  GetObjectArrayElement and GetStringUTFChars, and resets out-params before
  any early return.

CppBridgeFileManager's FileCallbackProvider wraps listDirectory, pathExists,
isDirectory, getFileSize, getAvailableSpace and getTotalSpace in try/catch (as
createDirectory and deletePath already were), so a Kotlin failure becomes a
sentinel value instead of a pending exce

**File**: `bindings/kotlin/src/main/kotlin/com/runanywhere/sdk/foundation/bridge/extensions/CppBridgeFileManager.kt` (modified, +34/-8)
```diff
@@ -174,32 +174,58 @@ object CppBridgeFileManager {
 
         @Suppress("unused") // Called from JNI
         fun listDirectory(path: String): Array<String>? {
-            return File(path).list()
+            return try {
+                File(path).list()
+            } catch (_: Exception) {
+                null
+            }
         }
 
         @Suppress("unused") // Called from JNI
         fun pathExists(path: String): Boolean {
-            return File(path).exists()
+            return try {
+                File(path).exists()
+            } catch (_: Exception) {
+                false
+            }
         }
 
         @Suppress("unused") // Called from JNI
         fun isDirectory(path: String): Boolean {
-            return File(path).isDirectory
+            return try {
+                File(path).isDirectory
+            } catch (_: Exception) {
+                false
+            }
         }
 
         @Suppress("unused") // Called from JNI
         fun getFileSize(path: String): Long {
-            val file = File(path)
-            return if (file.isFile) file.length() else -1L
+            return try {
+                val file = File(path)
+                if (file.isFile) file.length() else -1L
+            } catch (_: Exception) {
+                -1L
+            }
         }
 
         @Suppress("unused") // Called from JNI
-        fun getAvailableSpace(): Long = CppBridgeFileManager.availableSpace()
+        fun getAvailableSpace(): Long {
+            return try {
+                CppBridgeFileManager.availableSpace()
+            } catch (_: Exception) {
+                -1L
+            }
+        }
 
         @Suppress("unused") // Called from JNI
         fun getTotalSpace(): Long {
-            val baseDir = File(CppBridgeModelPaths.getBaseDirectory())
-            return baseDir.totalSpace
+            return try {
+                val baseDir = File(CppBridgeModelPaths.getBaseDirectory())
+                baseDir.totalSpace
+            } catch (_: Exception) {
+                -1L
+            }
         }
     }
 }
```

**File**: `core/src/jni/runanywhere_commons_jni.cpp` (modified, +68/-35)
```diff
@@ -4124,62 +4124,80 @@ static void free_directory_entry_copies(char** entries, size_t count) {
 
 // JNI file callback implementations
 static rac_result_t jni_fc_create_directory(const char* path, int recursive, void* user_data) {
+    if (path == nullptr)
+        return RAC_ERROR_NULL_POINTER;
     JNIEnv* env = getJNIEnv();
     if (env == nullptr || g_file_callbacks_obj == nullptr || g_fc_create_directory == nullptr)
         return RAC_ERROR_NOT_INITIALIZED;
     jstring jPath = env->NewStringUTF(path);
+    if (jniClearPendingException(env) || jPath == nullptr) {
+        env->DeleteLocalRef(jPath);
+        return RAC_ERROR_OUT_OF_MEMORY;
+    }
     jint result = env->CallIntMethod(g_file_callbacks_obj, g_fc_create_directory, jPath,
                                      static_cast<jboolean>(recursive != 0));
+    const bool failed = jniClearPendingException(env);
     env->DeleteLocalRef(jPath);
-    return static_cast<rac_result_t>(result);
+    return failed ? RAC_ERROR_INTERNAL : static_cast<rac_result_t>(result);
 }
 
 static rac_result_t jni_fc_delete_path(const char* path, int recursive, void* user_data) {
+    if (path == nullptr)
+        return RAC_ERROR_NULL_POINTER;
     JNIEnv* env = getJNIEnv();
     if (env == nullptr || g_file_callbacks_obj == nullptr || g_fc_delete_path == nullptr)
         return RAC_ERROR_NOT_INITIALIZED;
     jstring jPath = env->NewStringUTF(path);
+    if (jniClearPendingException(env) || jPath == nullptr) {
+        env->DeleteLocalRef(jPath);
+        return RAC_ERROR_OUT_OF_MEMORY;
+    }
     jint result = env->CallIntMethod(g_file_callbacks_obj, g_fc_delete_path, jPath,
                                      static_cast<jboolean>(recursive != 0));
+    const bool failed = jniClearPendingException(env);
     env->DeleteLocalRef(jPath);
-    return static_cast<rac_result_t>(result);
+    return failed ? RAC_ERROR_INTERNAL : static_cast<rac_result_t>(result);
 }
 
 static rac_result_t jni_fc_list_directory(const char* path, char*** out_entries, size_t* out_count,
                                           void* user_data) {
+    if (out_entries != nullptr) {
+        *out_entries = nullptr;
+    }
+    if (out_count != nullptr) {
+        *out_count = 0;
+    }
     if (path == nullptr || out_entries == nullptr || out_count == nullptr) {
         return RAC_ERROR_NULL_POINTER;
     }
-    *out_entries = nullptr;
-    *out_count = 0;
 
     JNIEnv* env = getJNIEnv();
     if (env == nullptr || g_file_callbacks_obj == nullptr || g_fc_list_directory == nullptr)
         return RAC_ERROR_NOT_INITIALIZED;
 
     jstring jPath = env->NewStringUTF(path);
-    if (jPath == nullptr) {
-        if (env->ExceptionCheck() == JNI_TRUE) {
-            env->ExceptionClear();
-        }
+    if (jniClearPendingException(env) || jPath == nullptr) {
+        env->DeleteLocalRef(jPath);
         return RAC_ERROR_OUT_OF_MEMORY;
     }
     jobjectArray jEntries = static_cast<jobjectArray>(
         env->CallObjectMethod(g_file_callbacks_obj, g_fc_list_directory, jPath));
+    const bool failed = jniClearPendingException(env);
     env->DeleteLocalRef(jPath);
 
-    if (env->ExceptionCheck() == JNI_TRUE) {
-        env->ExceptionClear();
-        if (jEntries != nullptr) {
-            env->DeleteLocalRef(jEntries);
-        }
+    if (failed) {
+        env->DeleteLocalRef(jEntries);
         return RAC_ERROR_INTERNAL;
     }
     if (jEntries == nullptr) {
         return RAC_ERROR_FILE_NOT_FOUND;
     }
 
     const jsize count = env->GetArrayLength(jEntries);
+    if (jniClearPendingException(env)) {
+        env->DeleteLocalRef(jEntries);
+        return RAC_ERROR_INTERNAL;
+    }
     if (count == 0) {
         env->DeleteLocalRef(jEntries);
         return RAC_SUCCESS;
@@ -4197,25 +4215,20 @@ static rac_result_t jni_fc_list_directory(const char* path, char*** out_entries,
         return RAC_ERROR_OUT_OF_MEMORY;
     }
 
-    // Copy the entries transactionally: any failed JNI/string allocation
-    // frees what has already been copied and reports RAC_ERROR_OUT_OF_MEMORY
-    // instead of returning a partially initialized array or strdup(nullptr).
+    // Publish only a complete listing; any failed copy rolls back the initialized prefix.
     for (jsize i = 0; i < count; i++) {
         auto jEntry = static_cast<jstring>(env->GetObjectArrayElement(jEntries, i));
-        if (jEntry == nullptr) {
-            const bool has_exception = env->ExceptionCheck() == JNI_TRUE;
-            if (has_exception) {
-                env->ExceptionClear();
-            }
+        const bool entry_failed = jniClearPendingException(env);
+        if (entry_failed || jEntry == nullptr) {
+            env->DeleteLocalRef(jEntry);
             free_directory_entry_copies(entries, static_cast<size_t>(i));
             env->DeleteLocalRef(jEntries);
-            return has_exception ? RAC_ERROR_INTERNAL : RAC_ERROR_INVALID_ARGUMENT;
+            return entry_failed ? RAC_ERROR_INTERNAL : RAC
```

---

### Incident Patch 3: `f0efd0ec` (2026-11-04)
**Commit Message**: fix(commons): decode the directory-probe path as UTF-8 on Windows (#1264)

* fix(commons): decode the probe path as UTF-8 on Windows (#1262)

std::filesystem::status(const char*) decodes with the ANSI code page on
Windows, so an existing directory with a non-ASCII name could be reported
as FILE_NOT_FOUND and lose its registry state to orphan pruning. Convert
the UTF-8 path to UTF-16 strictly (MB_ERR_INVALID_CHARS) before probing,
and treat malformed UTF-8 as inconclusive (READ_FAILED) rather than
probing a substituted path. POSIX behaviour is unchanged.

Add non-ASCII existing/missing cases to test_jni_directory_probe (all
platforms) and a malformed-UTF-8 case on Windows; give the test target
core/src for platform_compat.h; wrap the 103-column assertion.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* refactor(commons): share strict UTF-8 conversion; scope probe docs to Windows

- Move the strict converter into platform_compat.h as rac_to_wstring_strict
  (next to rac_to_wstring) so other Windows path callers can reuse it.
- Header: strict decoding and READ_FAILED-on-malformed are Windows-only;
  POSIX passes bytes through (file names are byte strings there).
- Test: build e

**File**: `core/include/rac/infrastructure/file_management/rac_directory_probe.h` (modified, +4/-0)
```diff
@@ -35,6 +35,10 @@ extern "C" {
  *   so callers keep any registered path until a later refresh.
  * - `RAC_ERROR_INVALID_ARGUMENT`: @p path is NULL.
  *
+ * @p path is UTF-8. On Windows it is strictly converted to UTF-16 before
+ * probing, and malformed UTF-8 is inconclusive (READ_FAILED). On POSIX the
+ * bytes are passed through unchanged, since file names there are byte strings.
+ *
  * Never throws; safe to call across a JNI boundary.
  *
  * @param path Directory path the platform failed to list (UTF-8).
```

**File**: `core/src/core/internal/platform_compat.h` (modified, +21/-0)
```diff
@@ -219,6 +219,27 @@ inline std::wstring rac_to_wstring(const char* s) {
         return {};
     return rac_to_wstring(std::string(s));
 }
+/* Strict variant for paths: rac_to_wstring() replaces malformed bytes with
+ * U+FFFD, which can silently name a different file. This fails instead.
+ * Returns false (and clears *out) on NULL or malformed UTF-8; an empty string
+ * converts to an empty wstring. May throw std::bad_alloc. */
+inline bool rac_to_wstring_strict(const char* s, std::wstring* out) {
+    out->clear();
+    if (!s)
+        return false;
+    if (!*s)
+        return true;
+    int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, s, -1, nullptr, 0);
+    if (size <= 0)
+        return false;
+    out->resize(static_cast<size_t>(size));
+    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, s, -1, &(*out)[0], size) != size) {
+        out->clear();
+        return false;
+    }
+    out->resize(static_cast<size_t>(size - 1)); /* drop the terminating NUL */
+    return true;
+}
 #endif
 // ONNX Runtime path handling:
 //   - On Windows, use `std::wstring wp = rac_to_wstring(p); session(env, wp.c_str(), opts);`
```

**File**: `core/src/infrastructure/file_management/directory_probe.cpp` (modified, +18/-0)
```diff
@@ -8,6 +8,13 @@
 
 #include "rac/infrastructure/file_management/rac_directory_probe.h"
 
+#if defined(_WIN32)
+#include <string>
+
+// rac_to_wstring_strict; also brings in <windows.h> with the repo's macro guards.
+#include "core/internal/platform_compat.h"
+#endif
+
 // File.exists()/isDirectory() hide stat errors behind false. After the platform
 // returns a null listing, confirm absence using a probe that retains its error.
 // An existing directory is inconclusive too: it may have become accessible
@@ -19,7 +26,18 @@ extern "C" rac_result_t rac_classify_null_directory_listing(const char* path) {
     std::error_code error;
     std::filesystem::file_status status;
     try {
+#if defined(_WIN32)
+        // The narrow std::filesystem::path constructor uses the ANSI code page
+        // on Windows, so convert the UTF-8 path to UTF-16 first.
+        std::wstring wide;
+        if (!rac_to_wstring_strict(path, &wide)) {
+            // Can't name the path reliably, so don't claim it's missing.
+            return RAC_ERROR_FILE_READ_FAILED;
+        }
+        status = std::filesystem::status(std::filesystem::path(wide), error);
+#else
         status = std::filesystem::status(path, error);
+#endif
     } catch (...) {
         // Path construction can allocate even with the error-code overload.
         // Keep failures inconclusive instead of letting them escape through JNI.
```

**File**: `core/tests/CMakeLists.txt` (modified, +2/-0)
```diff
@@ -104,6 +104,8 @@ add_executable(test_jni_directory_probe test_jni_directory_probe.cpp
     ${CMAKE_CURRENT_LIST_DIR}/../src/infrastructure/file_management/directory_probe.cpp)
 target_include_directories(test_jni_directory_probe PRIVATE
     ${CMAKE_CURRENT_LIST_DIR}/../include
+    # directory_probe.cpp includes core/internal/platform_compat.h on Windows.
+    ${CMAKE_CURRENT_LIST_DIR}/../src
 )
 target_compile_features(test_jni_directory_probe PRIVATE cxx_std_20)
 add_test(NAME jni_directory_probe_tests COMMAND test_jni_directory_probe)
```

**File**: `core/tests/test_jni_directory_probe.cpp` (modified, +27/-5)
```diff
@@ -7,6 +7,7 @@
 #include <cstdio>
 #include <filesystem>
 #include <fstream>
+#include <string>
 #include <system_error>
 
 #include "rac/infrastructure/file_management/rac_directory_probe.h"
@@ -15,6 +16,12 @@ namespace {
 
 namespace fs = std::filesystem;
 
+// The probe takes UTF-8. path::string() uses the ANSI code page on Windows.
+std::string to_utf8(const fs::path& p) {
+    const auto u8 = p.u8string();
+    return std::string(u8.begin(), u8.end());
+}
+
 #define EXPECT_EQ(actual, expected)                                                          \
     do {                                                                                     \
         if ((actual) != (expected)) {                                                        \
@@ -54,15 +61,30 @@ int main() {
     EXPECT_EQ(fs::is_regular_file(file), true);
 
     EXPECT_EQ(rac_classify_null_directory_listing(nullptr), RAC_ERROR_INVALID_ARGUMENT);
-    EXPECT_EQ(rac_classify_null_directory_listing(missing.string().c_str()), RAC_ERROR_FILE_NOT_FOUND);
-    EXPECT_EQ(rac_classify_null_directory_listing(file.string().c_str()), RAC_ERROR_FILE_NOT_FOUND);
+    EXPECT_EQ(rac_classify_null_directory_listing(to_utf8(missing).c_str()),
+              RAC_ERROR_FILE_NOT_FOUND);
+    EXPECT_EQ(rac_classify_null_directory_listing(to_utf8(file).c_str()), RAC_ERROR_FILE_NOT_FOUND);
     const auto beneath_file = file / "model";
-    EXPECT_EQ(rac_classify_null_directory_listing(beneath_file.string().c_str()),
+    EXPECT_EQ(rac_classify_null_directory_listing(to_utf8(beneath_file).c_str()),
               RAC_ERROR_FILE_NOT_FOUND);
     // A null Java result followed by an existing directory is inconclusive.
-    EXPECT_EQ(rac_classify_null_directory_listing(fixture.model.string().c_str()),
+    EXPECT_EQ(rac_classify_null_directory_listing(to_utf8(fixture.model).c_str()),
               RAC_ERROR_FILE_READ_FAILED);
 
+    // The path argument is UTF-8 on every platform. On Windows a narrow-path
+    // probe would decode it with the ANSI code page and miss this directory.
+    const auto non_ascii = fixture.root / fs::path(u8"modèle-模型");
+    fs::create_directories(non_ascii);
+    EXPECT_EQ(rac_classify_null_directory_listing(to_utf8(non_ascii).c_str()),
+              RAC_ERROR_FILE_READ_FAILED);
+    EXPECT_EQ(rac_classify_null_directory_listing(to_utf8(non_ascii / u8"缺").c_str()),
+              RAC_ERROR_FILE_NOT_FOUND);
+#if defined(_WIN32)
+    // Malformed UTF-8 cannot name a path reliably, so it must stay inconclusive.
+    const std::string malformed = to_utf8(fixture.root) + "\\bad\xC3\x28name";
+    EXPECT_EQ(rac_classify_null_directory_listing(malformed.c_str()), RAC_ERROR_FILE_READ_FAILED);
+#endif
+
     std::error_code error;
     fs::permissions(fixture.blocked, fs::perms::none, error);
     if (error) {
@@ -76,7 +98,7 @@ int main() {
     }
     // No synthetic File overrides: the existing model cannot be stat'ed
     // through its denied ancestor, and must not become a missing-download result.
-    EXPECT_EQ(rac_classify_null_directory_listing(fixture.model.string().c_str()),
+    EXPECT_EQ(rac_classify_null_directory_listing(to_utf8(fixture.model).c_str()),
               RAC_ERROR_FILE_READ_FAILED);
     std::puts("JNI directory probe tests passed, including real permission denial");
     return 0;
```

#### Recent Merged Pull Requests:
- **PR #1278** (2026-11-05): fix(voice-agent): apply vad_config in rac_voice_agent_initialize and report a rejected config (@ayaangazali)
- **PR #1276** (2026-11-04): fix(android): contain JNI file callback exceptions (@shubhamsinnh)
- **PR #1270** (2026-11-04): fix(electron): check seek results and size bounds in win_file_read (#904) (@shubhamsinnh)
- **PR #1268** (closed): fix(engines): preserve backend state when plugin unregister is refused (@shubhamsinnh)
- **PR #1267** (2026-11-04): fix(model-registry): preserve downloads on inconclusive fs probes (@shubhamsinnh)
- **PR #1266** (2026-11-04): fix: make backend unregister honor RAC_ERROR_PLUGIN_BUSY (@Kathircpe)

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

## X. model-registry): preserve downloads on inconclusive fs probes (#1267)

**RULE**:
When implementing operations in `bindings/electron/native/posix_platform_adapter.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RunanywhereAI/runanywhere-sdks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `65b3ace3`: model-registry): preserve downloads on inconclusive fs probes (#1267). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `bindings/electron/native/posix_platform_adapter.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include "rac/core/rac_logger.h"
// Distinguish a confirmed missing/non-directory path from a permission or I/O
// failure. The boolean std::filesystem probes collapse both into false, which
// lets orphan pruning mistake an unreadable download folder for a vanished one.
bool is_confirmed_missing(const std::error_code& ec) {
    return ec == std::errc::no_such_file_or_directory || ec == std::errc::not_a_directory;
}

// Confirm that `directory` exists and is a directory. Only an affirmative
// missing/non-directory result maps to FILE_NOT_FOUND; denied or unknown
// probes stay inconclusive for callers that preserve registry state.
rac_result_t classify_directory_probe(const fs::path& directory) {
    std::error_code ec;
    const fs::file_status status = fs::status(directory, ec);
    if (is_confirmed_missing(ec)) {
        return RAC_ERROR_FILE_NOT_FOUND;
    }
    if (ec) {
        return RAC_ERROR_FILE_READ_FAILED;
    }
    switch (status.type()) {
        case fs::file_type::not_found:
            return RAC_ERROR_FILE_NOT_FOUND;
        case fs::file_type::none:
        case fs::file_type::unknown:
            return RAC_ERROR_FILE_READ_FAILED;
        default:
            r
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
    if (!fs::is_directory(dir, ec) || ec) return RAC_ERROR_FILE_NOT_FOUND;
        if (name.size() + 1 > RAC_DIRECTORY_ENTRY_NAME_MAX) continue;  // skip oversized
        std::error_code ec2;
        bool is_dir = fs::is_directory(it->path(), ec2);
        out_entries[written].size_bytes =
            is_dir ? 0 : static_cast<int64_t>(fs::file_size(it->path(), ec2));
        if (ec2) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `65b3ace3` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
