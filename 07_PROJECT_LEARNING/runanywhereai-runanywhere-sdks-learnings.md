> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/runanywhereai-runanywhere-sdks-learnings.md`  
> **Source**: github ([https://github.com/RunanywhereAI/runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks))  
> **Source Version**: `259521e2`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T00:22:52.409Z  
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
> **Harvest Timestamp**: 2026-10-19T00:22:50.881Z  
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
import ai.runanywhere.proto.v1.ModelInfo
import ai.runanywhere.proto.v1.NpuCapability
import ai.runanywhere.proto.v1.RegisterModelFromUrlRequest
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

    @Volatile
    private var isRegistered = false
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
     * Match native product catalog policy for [modelId] against [arch].
     */
    fun modelSupportsArchitecture(
        modelId: String,
        arch: HexagonArch,
    ): Boolean {
        RunAnywhereBridge.ensureNativeLibraryLoaded()
        if (!QHexRTBridge.ensureNativeLibraryLoaded()) return false
        return QHexRTBridge.nativeCatalogModelSupportsArch(modelId, arch.value)
    }

    /** Whether native product policy marks [modelId] as HF-authenticated. */
    fun modelRequiresHfAuth(modelId: String): Boolean {
        RunAnywhereBridge.ensureNativeLibraryLoaded()
        if (!QHexRTBridge.ensureNativeLibraryLoaded()) return false
        return QHexRTBridge.nativeCatalogModelRequiresHfAuth(modelId)
    }

    /**
     * Register [request] only when native product policy allows it here.
     *
     * The app remains the source of the model URL and presentation metadata.
     * QHexRT owns device probing and architecture selection, then composes the
     * shared C++ URL-registration/download pipeline. Returns `null` for the
     * normal "model is not eligible on this device" outcome.
     */
    suspend fun registerModelForDevice(request: RegisterModelFromUrlRequest): ModelInfo? {
        RunAnywhereBridge.ensureNativeLibraryLoaded()
        if (!QHexRTBridge.ensureNativeLibraryLoaded()) return null
        val bytes =
            QHexRTBridge.nativeCatalogRegisterModelProto(QHexRTCatalogWire.encodeRequest(request))
                ?: return null
        return QHexRTCatalogWire.decodeModel(bytes)
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

/** Byte/enum transport only; all QHexRT catalog policy stays native. */
internal object QHexRTCatalogWire {
    fun encodeRequest(request: RegisterModelFromUrlRequest): ByteArray =
        RegisterModelFromUrlRequest.ADAPTER.encode(request)

    fun decodeModel(bytes: ByteArray): ModelInfo = ModelInfo.ADAPTER.decode(bytes)
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
 * - QHexRT-owned architecture matching and device-aware model registration
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

    /** Match the native product catalog policy for [modelId] against [arch]. */
    @JvmStatic
    external fun nativeCatalogModelSupportsArch(
        modelId: String,
        arch: Int,
    ): Boolean

    /** Whether the native product catalog marks [modelId] as HF-authenticated. */
    @JvmStatic
    external fun nativeCatalogModelRequiresHfAuth(modelId: String): Boolean

    /**
     * Register one serialized `RegisterModelFromUrlRequest` only when the
     * native product catalog allows it on the current device. A null result is
     * the normal ineligible/private-without-token outcome.
     */
    @JvmStatic
    external fun nativeCatalogRegisterModelProto(requestBytes: ByteArray): ByteArray?

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
- **Issue #1083** (2026-10-16): **core: RAC_LLM_OPTIONS_DEFAULT.min_p disagrees with the IDL's annotated default**
  *Symptoms*: Follow-up from #1073 by @VanshBhardwaj24 — thanks again for that PR!  ## What `idl/llm_options.proto:79` annotates `min_p` with `(runanywhere.v1.rac_default) = "0.05"`, and the IDL's own comment above the message says top_k/min_p/repeat_penalty default ON to match llama.cpp and Ollama. But the C ABI struct hardcodes `.min_p = 0.0f` (`core/include/rac/features/llm/rac_llm_types.h:178`), and the struct's comment a few lines above describes min_p as a field with no annotation default — which is wrong for this one field. Every other annotated knob in the same struct uses the generated macro (`.max_tokens = RAC_DEFAULT_LLM_GENERATION_OPTIONS_MAX_OUTPUT_TOKENS`, and so on), and the VLM struct already gets it right (`.min_p = RAC_DEFAULT_LLM_GENERATION_OPTIONS_MIN_P` at `core/include/rac/features/vlm/rac_vlm_types.h:276`).  ## Why it matters An absent `min_p` reaches the engine as 0.0 (min-p sampling disabled) on the LLM path while the IDL, the generated per-SDK `defaults()` helpers and the VLM path all say 0.05 — so a Swift or Kotlin caller who reads their SDK's documented default and a Python caller who leaves it unset get different sampling. It is pre-existing (the same divergence is on base at `llm_module.cpp`'s LLM path), and #1073 neither introduced nor worsened it.  ## Suggested approach Set `.min_p = RAC_DEFAULT_LLM_GENERATION_OPTIONS_MIN_P` in `RAC_LLM_OPTIONS_DEFAULT` and correct the struct comment. This changes behaviour on both the LLM and the RAG paths wherever min_p is

- **Issue #1082** (2026-10-16): **bindings: Electron and Python RAG query builders still drop the six generation knobs**
  *Symptoms*: Follow-up from #1073 by @VanshBhardwaj24 — thanks again for that PR!  ## What #1073 makes the commons RAG query path honour `repeat_penalty`, `frequency_penalty`, `presence_penalty`, `min_p`, `seed` and `stop_sequences`, each when present. Six of the seven SDK entry points already forward them — Swift (`bindings/swift/Sources/RunAnywhere/Public/API/Options.swift:183-190`), Kotlin (`bindings/kotlin/src/main/kotlin/com/runanywhere/sdk/public/api/MappingOptions.kt:247-256`), Flutter, React Native and Web all build the full `LLMGenerationOptions`. Two do not:  - Electron — `toRagGeneration` (`bindings/electron/src/api/data.ts:220-240`) copies only `maxOutputTokens`, `temperature`, `topP`, `topK` and `systemPrompt`, each gated on `!== undefined`, so `LlmOptions.minP` / `seed` / `stopSequences` / `repetitionPenalty` / `frequencyPenalty` / `presencePenalty` (declared on the shared interface at `bindings/electron/src/api/options.ts:66-71`) never reach `query.generation`. The comment three lines above it (`data.ts:217-219`) says it carries "only the sampling knobs commons' RAG pipeline reads", which #1073 makes false. The LLM path in the same package does forward all six (`bindings/electron/src/api/llm-abi.ts:103-112`). - Python — `build_query` (`bindings/python/runanywhere/_rag_bridge.py:116-130`) assigns only `max_output_tokens`, `temperature`, `top_p`, `top_k`, `system_prompt` and `reasoning` into `query.generation`, while `LlmOptions` (`bindings/python/runanywhere/options.py:125-1

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

### Incident Patch 1: `ab31cbfd` (2026-10-14)
**Commit Message**: fix(swift): return the Sendable handle ref from RagSession, not the raw pointer (#1015)

* fix(swift): return the Sendable handle ref from RagSession, not the raw pointer

`main` has failed `swift-spm` since #979 merged. `RunAnywhere+Solutions.swift:63`
returned `rac_handle_t` (`UnsafeMutableRawPointer`) out of the `RagSession`
actor to a nonisolated caller, which Swift 6 rejects:

    error: non-Sendable 'rac_handle_t'-typed result can not be returned from
    actor-isolated instance method 'nativeHandleForSolution()' to nonisolated
    context

`RagSessionHandleRef` (`@unchecked Sendable`) already exists in
`RagSession.swift` and is used by other internal methods there. Hand it back
from the actor instead, and widen it `private` -> `internal` to match the
method's visibility. The call site then needs no wrapper of its own, so
`SolutionRAGSessionHandleRef` is removed as dead.

Found by CI on Xcode 26.6 (swiftlang-6.3.3.1.3). Not reproducible locally: this
machine's compiler is 6.4 (swiftlang-6.4.0.34.1) and accepts the broken shape.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* fix(swift): reach ragEvents through eventBus in the solutions test

The `swift-spm` job on this bra

**File**: `bindings/swift/Sources/RunAnywhere/Public/API/Rag/RagSession.swift` (modified, +3/-3)
```diff
@@ -11,7 +11,7 @@ import Foundation
 
 /// Carries the opaque native session pointer across a `@Sendable` boundary; the
 /// handle is only ever read and handed straight back to the C ABI.
-private struct RagSessionHandleRef: @unchecked Sendable {
+internal struct RagSessionHandleRef: @unchecked Sendable {
     let handle: rac_handle_t
 }
 
@@ -202,9 +202,9 @@ public actor RagSession {
     ///
     /// Used by `SolutionHandle.attachRagSession(_:)`; ownership remains with
     /// this actor and callers must not destroy the returned handle.
-    internal func nativeHandleForSolution() throws -> rac_handle_t {
+    internal func nativeHandleForSolution() throws -> RagSessionHandleRef {
         try requireOpen()
-        return handle
+        return RagSessionHandleRef(handle: handle)
     }
 
     // MARK: - Private
```

**File**: `bindings/swift/Sources/RunAnywhere/Public/Extensions/Solutions/RunAnywhere+Solutions.swift` (modified, +1/-9)
```diff
@@ -18,12 +18,6 @@ import Foundation
 import os
 import SwiftProtobuf
 
-/// Carries a borrowed RAG session handle across the `@Sendable` closure used
-/// by `SolutionHandle.withHandle`. Ownership remains with `RagSession`.
-private struct SolutionRAGSessionHandleRef: @unchecked Sendable {
-    let handle: rac_handle_t
-}
-
 // MARK: - SolutionHandle
 
 /// Opaque, ARC-safe wrapper around a `rac_solution_handle_t`.
@@ -59,9 +53,7 @@ public final class SolutionHandle: @unchecked Sendable {
     /// as long as this solution can execute retrieval. Call this before
     /// `start()`, because native operator nodes are materialized at start time.
     public func attachRagSession(_ session: RagSession) async throws {
-        let sessionRef = SolutionRAGSessionHandleRef(
-            handle: try await session.nativeHandleForSolution()
-        )
+        let sessionRef = try await session.nativeHandleForSolution()
         try withHandle { solutionHandle in
             rac_solution_attach_rag_session(solutionHandle, sessionRef.handle)
         }
```

**File**: `bindings/swift/Tests/RunAnywhereTests/SolutionsSurfaceTests.swift` (modified, +38/-21)
```diff
@@ -159,27 +159,17 @@ final class SolutionsSurfaceTests: XCTestCase {
         try await CppBridge.ModelRegistry.shared.save(embeddingModel)
         try await CppBridge.ModelRegistry.shared.save(llmModel)
 
-        // MiniLM needs its vocabulary sidecar. Build the generated proto via
-        // protobuf JSON so this test does not depend on hand-maintained Swift
-        // spellings for snake_case IDL fields.
-        let embeddingConfigData = try JSONSerialization.data(
-            withJSONObject: ["vocab_path": vocabularyPath]
+        let ragConfig = try makeRAGConfig(
+            embeddingID: embeddingID, llmID: llmID, vocabularyPath: vocabularyPath
         )
-        let embeddingConfig = String(decoding: embeddingConfigData, as: UTF8.self)
-        let ragConfigData = try JSONSerialization.data(withJSONObject: [
-            "embeddingModelId": embeddingID,
-            "llmModelId": llmID,
-            "embeddingConfigJson": embeddingConfig,
-            "topK": 4,
-            "chunkSize": 64,
-            "chunkOverlap": 8,
-            "maxContextTokens": 1024
-        ])
-        let ragConfig = try RARAGConfiguration(jsonUTF8Data: ragConfigData)
 
-        let nativeSession = try await CppBridge.RAG.shared.createPipeline(ragConfig)
+        // Hand the borrowed handle straight to the actor, which takes ownership:
+        // `RagSession.close()` calls `destroySession` itself, so there is no
+        // local `defer` to race with. Production does the same at
+        // RagNamespace.swift:56.
+        let nativeSession = try CppBridge.RAG.shared.createPipeline(ragConfig)
         let session = RagSession(handle: nativeSession, llmModelId: llmID, defaultTopK: 4)
-        defer { CppBridge.RAG.shared.destroySession(handle: nativeSession) }
+        defer { Task { await session.close() } }
 
         let document = """
         The Zephyr Protocol avoids transmitting duplicate data by assigning a
@@ -210,10 +200,10 @@ final class SolutionsSurfaceTests: XCTestCase {
         // session rather than merely accepting the handle at attach time.
         let queryCompleted = expectation(description: "RAG solution query completed")
         var completionSubscription: AnyCancellable?
-        completionSubscription = RunAnywhere.events.ragEvents.sink { event in
+        completionSubscription = RunAnywhere.eventBus.ragEvents.sink { event in
             guard event.operationID == "rag.query",
-                  event.hasCapability,
-                  event.capability.kind.rawValue == 14 else { return }
+                  case .capability(let capability)? = event.event,
+                  capability.kind == .ragQueryCompleted else { return }
             queryCompleted.fulfill()
         }
         defer { completionSubscription?.cancel() }
@@ -226,6 +216,33 @@ final class SolutionsSurfaceTests: XCTestCase {
         await fulfillment(of: [queryCompleted], timeout: 120.0)
     }
 
+    /// Build the RAG configuration the live-session test feeds to the pipeline.
+    ///
+    /// MiniLM needs its vocabulary sidecar, and the generated proto is built via
+    /// protobuf JSON so the test does not depend on hand-maintained Swift
+    /// spellings for snake_case IDL fields. Extracted from the test body to keep
+    /// that function inside SwiftLint's `function_body_length` limit.
+    private func makeRAGConfig(
+        embeddingID: String,
+        llmID: String,
+        vocabularyPath: String
+    ) throws -> RARAGConfiguration {
+        let embeddingConfigData = try JSONSerialization.data(
+            withJSONObject: ["vocab_path": vocabularyPath]
+        )
+        let embeddingConfig = String(bytes: embeddingConfigData, encoding: .utf8) ?? ""
+        let ragConfigData = try JSONSerialization.data(withJSONObject: [
+            "embeddingModelId": embeddingID,
+            "llmModelId": llmID,
+            "embeddingConfigJson": embeddingConfig,
+            "topK": 4,
+            "chunkSize": 64,
+            "chunkOverlap": 8,
+            "maxContextTokens": 1024
+        ])
+        return try RARAGConfiguration(jsonUTF8Data: ragConfigData)
+    }
+
     /// The generated handle descriptor carries its canonical fields.
     func testGeneratedSolutionHandleCarriesCanonicalFields() {
         var handle = RASolutionHandle()
```

---

### Incident Patch 2: `c130ad6a` (2026-10-14)
**Commit Message**: fix(swift,rn): honor LoadOptions contextLength and ordered backendPreferences (#950)

* docs: record the v0.20.33 release traps

Four lessons from cutting v0.20.33, which took four candidates. Two were real
defects that would have shipped an SDK where TTS does not link.

The expensive one: a new NeuRT archive must be added in FOUR places, and three
only fail in a build configuration a dev Mac never produces. Miss the force-load
lists and every native job is green while validate_consumer_flutter dies an hour
later on `Undefined symbol: _g_neurt_tts_ops` -- the engine registers, all CMake
targets compile, only a CONSUMER's link fails. Miss the `#if RAC_NEURT_ROUTABLE`
guard on the vtable entry and the opposite happens: routable builds are fine and
every PR job without NEURUN_TOKEN fails, because the non-routable shell still
references a symbol nothing defines. A machine with the payload staged is
routable and reproduces neither.

This file already notes that prose alone did not stop the checksum-staleness bug
recurring twice, so the archive-list half now has a mechanism:
`neurt_assert_no_unlisted_archives` fails packaging by name. The vtable guard has
none -- hence the instruction to

**File**: `bindings/react-native/packages/core/src/Public/Api/LoadOptionsSupport.ts` (modified, +21/-13)
```diff
@@ -1,20 +1,32 @@
 /**
- * `LoadOptions` fields `commons ModelLoadRequest` has no wire path for yet.
+ * Load-option support and lossless protobuf validation for this binding.
  *
- * Only `backendPreferences[0]` (equivalently the deprecated `framework`)
- * reaches commons at load time; `contextLength`, `threads`, a real
- * `accelerator` choice, and ordered fallback across multiple
- * `backendPreferences` are not yet carried by the native load ABI (tracked
- * as a follow-up — see PR #605 review follow-up issue 8). Per the v4 public
- * API spec, "every accepted field is implemented end to end or fails
- * preflight" — `models.load` throws when one of these is set rather than
- * silently dropping it.
+ * `contextLength` and the ordered `backendPreferences` list now ride
+ * `ModelLoadRequest.context_length`/`.backend_preferences`, so only `threads`
+ * (retired from the load ABI — reserved tag 7) and `accelerator` remain
+ * unsupported by this React Native binding. Accelerator policy has a wire
+ * field, but this binding does not forward it yet.
  *
  * Kept in its own module (no native/Nitro imports) so it stays unit-testable
  * under the Node jest runner alongside the other pure-TS helpers.
  */
 
 import type { LoadOptions } from './Types';
+import { SDKException } from '../../Foundation/Errors/SDKException';
+
+/** Reject context values that would be changed by int32 protobuf encoding. */
+export function requireValidContextLength(contextLength?: number): void {
+  if (
+    contextLength !== undefined &&
+    (!Number.isInteger(contextLength) ||
+      contextLength < 0 ||
+      contextLength > 2_147_483_647)
+  ) {
+    throw SDKException.invalidInput(
+      'LoadOptions.contextLength must be a non-negative integer that fits int32'
+    );
+  }
+}
 
 export function resolvedBackendPreferences(options?: LoadOptions) {
   if (options?.backendPreferences?.length) return options.backendPreferences;
@@ -32,11 +44,7 @@ export function resolvedAccelerator(options?: LoadOptions) {
 
 export function unsupportedLoadOptionKeys(options?: LoadOptions): string[] {
   return [
-    options?.contextLength !== undefined ? 'contextLength' : undefined,
     options?.threads !== undefined ? 'threads' : undefined,
     resolvedAccelerator(options) !== undefined ? 'accelerator' : undefined,
-    resolvedBackendPreferences(options).length > 1
-      ? 'backendPreferences (only the first preference reaches commons; ordered fallback is not carried)'
-      : undefined,
   ].filter((key): key is string => key !== undefined);
 }
```

**File**: `bindings/react-native/packages/core/src/Public/Api/Models.ts` (modified, +36/-8)
```diff
@@ -4,6 +4,7 @@
 
 import {
   ArchiveStructure,
+  InferenceFramework,
   ModelArtifactType,
   ModelCategory,
   ModelGetRequest,
@@ -47,7 +48,11 @@ import type {
   ModelRegistration,
   ModelsState,
 } from './Types';
-import { resolvedBackendPreferences, unsupportedLoadOptionKeys } from './LoadOptionsSupport';
+import {
+  requireValidContextLength,
+  resolvedBackendPreferences,
+  unsupportedLoadOptionKeys,
+} from './LoadOptionsSupport';
 
 const CATEGORIES: ModelCategory[] = [
   ModelCategory.MODEL_CATEGORY_LANGUAGE,
@@ -328,29 +333,51 @@ export const models = {
   /**
    * Load a model now instead of paying for it on the first generation.
    *
-   * Only `options.backendPreferences[0]` (equivalently the deprecated
-   * `framework`) reaches commons today; `contextLength`, `threads`, and a
-   * real `accelerator` choice are not yet carried by the native load ABI.
+   * `contextLength` and the ordered `backendPreferences` list are forwarded on
+   * `ModelLoadRequest`. A `required` backend preference is rejected because
+   * `backend_preferences` carries framework enums only.
+   * Context length is advisory at the engine boundary; engines may use their
+   * defaults. Native load warnings are exposed through `fallbackReason`.
    *
    * @throws SDKException when the model is unknown, or `options` sets a
    * placement knob the load ABI cannot honor yet.
    */
   async load(id: string, options?: LoadOptions): Promise<LoadedModel> {
+    requireValidContextLength(options?.contextLength);
     const model = await requireModel(id);
     const unsupported = unsupportedLoadOptionKeys(options);
     if (unsupported.length > 0) {
       throw SDKException.invalidInput(
-        `LoadOptions.${unsupported.join(', ')} cannot be carried by the native load ABI yet`
+        `LoadOptions.${unsupported.join(', ')} is not supported by this React Native binding`
+      );
+    }
+    if (
+      options?.backendPreferences?.some((preference) => preference.required)
+    ) {
+      throw SDKException.invalidInput(
+        'LoadOptions.backendPreferences.required cannot be carried by ModelLoadRequest ' +
+          'because backend_preferences contains framework enums only. ' +
+          'Remove required or pass one preferred backend.'
       );
     }
-    const requestedBackend = resolvedBackendPreferences(options)[0];
+    const preferences = resolvedBackendPreferences(options);
+    const requestedBackend = preferences[0];
+    // A lone deprecated UNSPECIFIED choice keeps catalog-based routing. In a
+    // longer list it must not introduce a catalog pin ahead of later choices.
+    const pinRequestedBackend =
+      requestedBackend &&
+      (requestedBackend.backend !==
+        InferenceFramework.INFERENCE_FRAMEWORK_UNSPECIFIED ||
+        preferences.length > 1);
     const result = await loadModel(
       ModelLoadRequest.fromPartial({
         modelId: id,
         category: model.category,
-        ...(requestedBackend ? { framework: requestedBackend.backend } : {}),
+        ...(pinRequestedBackend ? { framework: requestedBackend.backend } : {}),
         forceReload: options?.forceReload ?? false,
         validateAvailability: true,
+        contextLength: options?.contextLength,
+        backendPreferences: preferences.map((preference) => preference.backend),
       })
     );
     if (result.error) {
@@ -360,8 +387,9 @@ export const models = {
       id,
       category: model.category,
       ...(requestedBackend ? { requestedBackend } : {}),
-      actualBackend: requestedBackend?.backend ?? model.framework,
+      actualBackend: result.framework,
       actualDevice: 'unknown',
+      fallbackReason: result.fallbackReason ?? result.warnings[0],
       async close(): Promise<void> {
         await models.unload(id);
       },
```

**File**: `bindings/react-native/packages/core/src/Public/Api/Types.ts` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ export type AcceleratorPolicy = 'auto' | 'cpu' | 'gpu' | 'npu';
 /** One ranked backend choice for {@link LoadOptions.backendPreferences}. */
 export interface BackendPreference {
   backend: InferenceFramework;
-  /** `true` fails the load instead of falling back past this entry. */
+  /** Hard fallback boundary. React Native rejects `true` until the load wire can carry it. */
   required?: boolean;
 }
 
```

**File**: `bindings/react-native/packages/core/tests/unit/Public/Api/LoadOptionsSupport.test.ts` (modified, +45/-22)
```diff
@@ -1,12 +1,20 @@
 /**
  * Characterizes which `LoadOptions` fields `models.load()` rejects at
- * preflight because the commons load ABI has no wire path for them yet
+ * preflight because this binding does not support them yet
  * (PR #605 review issue 8). Per the v4 public API spec, silently dropping
  * an accepted field is forbidden, so unsupported knobs are reported for
  * `models.load` to throw on rather than merely warn about.
+ *
+ * `contextLength` and the ordered `backendPreferences` list are carried by
+ * `ModelLoadRequest` now, so only `threads` (retired) and `accelerator`
+ * remain unsupported.
  */
 
-import { unsupportedLoadOptionKeys } from '../../../../src/Public/Api/LoadOptionsSupport';
+import {
+  requireValidContextLength,
+  unsupportedLoadOptionKeys,
+} from '../../../../src/Public/Api/LoadOptionsSupport';
+import { SDKException } from '../../../../src/Foundation/Errors/SDKException';
 import { InferenceFramework } from '@runanywhere/proto-ts/model_types';
 
 describe('unsupportedLoadOptionKeys', () => {
@@ -22,32 +30,29 @@ describe('unsupportedLoadOptionKeys', () => {
     ).toEqual([]);
   });
 
-  it('does not report a single backendPreferences entry', () => {
+  it('does not report contextLength, which now reaches commons', () => {
+    expect(unsupportedLoadOptionKeys({ contextLength: 4096 })).toEqual([]);
+  });
+
+  it('does not report ordered backendPreferences, which now reach commons', () => {
     expect(
       unsupportedLoadOptionKeys({
-        backendPreferences: [{ backend: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP }],
+        backendPreferences: [
+          { backend: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP },
+          { backend: InferenceFramework.INFERENCE_FRAMEWORK_ONNX },
+        ],
       })
     ).toEqual([]);
   });
 
-  it('reports contextLength, threads, and accelerator individually', () => {
-    expect(unsupportedLoadOptionKeys({ contextLength: 4096 })).toEqual([
-      'contextLength',
-    ]);
+  it('reports threads and accelerator individually', () => {
     expect(unsupportedLoadOptionKeys({ threads: 4 })).toEqual(['threads']);
-    expect(unsupportedLoadOptionKeys({ accelerator: 'gpu' })).toEqual(['accelerator']);
-    expect(unsupportedLoadOptionKeys({ useGpu: true })).toEqual(['accelerator']);
-  });
-
-  it('reports multiple backendPreferences entries', () => {
-    const keys = unsupportedLoadOptionKeys({
-      backendPreferences: [
-        { backend: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP },
-        { backend: InferenceFramework.INFERENCE_FRAMEWORK_ONNX },
-      ],
-    });
-    expect(keys).toHaveLength(1);
-    expect(keys[0]).toMatch(/^backendPreferences/);
+    expect(unsupportedLoadOptionKeys({ accelerator: 'gpu' })).toEqual([
+      'accelerator',
+    ]);
+    expect(unsupportedLoadOptionKeys({ useGpu: true })).toEqual([
+      'accelerator',
+    ]);
   });
 
   it('combines every unsupported knob in a stable order', () => {
@@ -57,6 +62,24 @@ describe('unsupportedLoadOptionKeys', () => {
         threads: 4,
         accelerator: 'cpu',
       })
-    ).toEqual(['contextLength', 'threads', 'accelerator']);
+    ).toEqual(['threads', 'accelerator']);
   });
 });
+
+describe('requireValidContextLength', () => {
+  it.each([undefined, 0, 4096, 2_147_483_647])(
+    'preserves the valid context value %s',
+    (contextLength) => {
+      expect(() => requireValidContextLength(contextLength)).not.toThrow();
+    }
+  );
+
+  it.each([-1, 0.5, NaN, Infinity, -Infinity, 2_147_483_648])(
+    'rejects the context value %s before protobuf encoding',
+    (contextLength) => {
+      expect(() => requireValidContextLength(contextLength)).toThrow(
+        SDKException
+      );
+    }
+  );
+});
```

**File**: `bindings/swift/Sources/RunAnywhere/Public/API/Handles.swift` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ public enum AcceleratorPolicy: Sendable {
 /// Ordered backend preference for model load.
 public struct BackendPreference: Sendable {
     public var backend: InferenceFramework
+    /// Hard fallback boundary. Swift rejects `true` until the load wire can carry it.
     public var required: Bool
 
     public init(backend: InferenceFramework, required: Bool = false) {
```

**File**: `bindings/swift/Sources/RunAnywhere/Public/API/Namespaces/ModelsNamespace.swift` (modified, +61/-26)
```diff
@@ -233,11 +233,12 @@ public extension RunAnywhere {
 
         /// Load a model now instead of waiting for the first generation call.
         ///
-        /// Only `LoadOptions.backendPreferences.first` (equivalently the
-        /// deprecated `framework`) reaches commons today. `contextLength`,
-        /// `threads`, `accelerator`, and additional ordered `backendPreferences`
-        /// are not yet carried by the native load ABI, so passing them throws
-        /// rather than being silently dropped.
+        /// `contextLength` and the ordered `backendPreferences` list are
+        /// forwarded on `ModelLoadRequest`; a `required` backend preference is
+        /// rejected because `backend_preferences` carries framework enums only.
+        /// `threads` (retired) and `accelerator` still fail preflight.
+        /// Context length is advisory at the engine boundary; engines may use
+        /// their defaults. Native load warnings are exposed as `fallbackReason`.
         ///
         /// - Throws: `SDKException` when the model cannot be loaded, or when
         ///   `options` sets a placement knob the load ABI cannot honor yet.
@@ -479,12 +480,31 @@ extension RunAnywhere {
         return modelId
     }
 
+    /// Load the validated request shared by explicit and automatic loading.
     @discardableResult
     internal static func loadResolved(
         model: ModelInfo,
         category: ModelCategory,
         options: LoadOptions?
     ) async throws -> RAModelLoadResult {
+        let request = try modelLoadRequest(model: model, category: category, options: options)
+        let result = await performLoad(request)
+        guard !result.hasError else {
+            throw SDKException(
+                code: .modelLoadFailed,
+                message: "Model '\(model.id)': \(result.error.message)",
+                category: .component
+            )
+        }
+        return result
+    }
+
+    /// Build the exact protobuf request used by `models.load` before native work.
+    internal static func modelLoadRequest(
+        model: ModelInfo,
+        category: ModelCategory,
+        options: LoadOptions?
+    ) throws -> RAModelLoadRequest {
         if let options {
             try options.requireCarriableByLoadABI()
         }
@@ -493,42 +513,57 @@ extension RunAnywhere {
         request.modelID = model.id
         request.category = category == .unspecified ? category.defaultLoadCategory : category
         request.forceReload = options?.forceReload ?? false
-        if let backend = options?.backendPreferences.first?.backend, backend != .unspecified {
-            request.framework = backend
+        // A lone unspecified choice leaves native catalog preference resolution
+        // intact. In a longer list, preserve it ahead of later caller choices.
+        if let backend = options?.backendPreferences.first?.backend {
+            if backend != .unspecified || (options?.backendPreferences.count ?? 0) > 1 {
+                request.framework = backend
+            }
         } else if model.framework != .unspecified {
             request.framework = model.framework
         }
+        if let contextLength = options?.contextLength {
+            guard contextLength >= 0, let wireContextLength = Int32(exactly: contextLength) else {
+                throw SDKException.invalidConfiguration(
+                    "LoadOptions.contextLength must be non-negative and fit ModelLoadRequest.context_length (int32)"
+                )
+            }
+            request.contextLength = wireContextLength
+        }
+        // The full ordered list rides `backend_preferences`; `.framework` above
+        // pins its first entry except for a lone unspecified preference.
+        request.backendPreferences = options?.backendPreferences.map(\.backend) ?? []
         request.validateAvailability = true
 
-        let result = await performLoad(request)
-        guard !result.hasError else {
-            throw SDKException(
-                code: .modelLoadFailed,
-                message: "Model '\(model.id)': \(result.error.message)",
-                category: .component
-            )
-        }
-        return result
+        return request
     }
 }
 
 private extension LoadOptions {
-    /// `backendPreferences.first` reaches commons through the same
-    /// `RAModelLoadRequest.framework` field the deprecated `framework:`
-    /// property already uses. Everything else the native load ABI cannot
-    /// carry yet — honoring it silently would violate the "every accepted
-    /// field is implemented end to end or fails preflight" contract.
+    /// `contextLength` and the ordered `backendPreferences` list reach commons
+    /// through `RAModelLoadRequest.context_length`/`.backend_preferences`;
+    /// `backendPreferences.first` also pins the legacy `.framework` field,
+    /// except when a lone unspecified preference defers to catalog routing.
+    /// `threads` was retired from the load A
```

**File**: `bindings/swift/Sources/RunAnywhere/Public/RunAnywhere.swift` (modified, +3/-4)
```diff
@@ -633,12 +633,11 @@ extension RunAnywhere {
                     name: "generateStructured.constrained",
                     reason: "Engine-constrained decoding is not wired in yet; use .validationOnly or .repair"
                 ),
-                .init(name: "loadOptions.contextLength", reason: "Not carried by the native load ABI yet"),
                 .init(name: "loadOptions.threads", reason: "Not carried by the native load ABI yet"),
-                .init(name: "loadOptions.accelerator", reason: "Not carried by the native load ABI yet"),
+                .init(name: "loadOptions.accelerator", reason: "Not forwarded by this Swift binding"),
                 .init(
-                    name: "loadOptions.backendPreferences.fallback",
-                    reason: "Only the first backend preference reaches commons; ordered fallback is not carried"
+                    name: "loadOptions.backendPreferences.required",
+                    reason: "The required flag cannot be carried by the framework-only preference list"
                 )
             ]
         )
```

**File**: `bindings/swift/Tests/RunAnywhereTests/ModelLoadOptionsTests.swift` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+import XCTest
+
+@testable import RunAnywhere
+
+final class ModelLoadOptionsTests: XCTestCase {
+    func testRequestPreservesContextAndOrderedPreferencesOnTheWire() throws {
+        let request = try makeRequest(options: LoadOptions(
+            backendPreferences: [
+                BackendPreference(backend: .onnx),
+                BackendPreference(backend: .llamaCpp)
+            ],
+            contextLength: 4096
+        ))
+        let decoded = try RAModelLoadRequest(serializedBytes: request.serializedData())
+
+        XCTAssertEqual(decoded.contextLength, 4096)
+        XCTAssertEqual(decoded.framework, .onnx)
+        XCTAssertEqual(decoded.backendPreferences, [.onnx, .llamaCpp])
+    }
+
+    func testOmittedAndZeroContextRemainDistinct() throws {
+        XCTAssertFalse(try makeRequest(options: nil).hasContextLength)
+        let request = try makeRequest(options: LoadOptions(contextLength: 0))
+        XCTAssertTrue(request.hasContextLength)
+        XCTAssertEqual(request.contextLength, 0)
+    }
+
+    func testContextBoundaries() throws {
+        XCTAssertEqual(
+            try makeRequest(options: LoadOptions(contextLength: Int(Int32.max))).contextLength,
+            Int32.max
+        )
+        for invalid in [-1, Int(Int32.max) + 1] {
+            XCTAssertThrowsError(try makeRequest(options: LoadOptions(contextLength: invalid)))
+        }
+    }
+
+    func testRequiredPreferenceIsRejectedEvenAfterTheFirstEntry() {
+        let options = LoadOptions(backendPreferences: [
+            BackendPreference(backend: .onnx),
+            BackendPreference(backend: .llamaCpp, required: true)
+        ])
+        XCTAssertThrowsError(try makeRequest(options: options))
+        XCTAssertTrue(RunAnywhere.capabilities().unavailable.contains {
+            $0.name == "loadOptions.backendPreferences.required"
+        })
+    }
+
+    func testLoadResolvedRejectsRequiredPreferenceBeforeCallingNativeCode() async {
+        var model = ModelInfo()
+        model.id = "demo-model"
+        do {
+            _ = try await RunAnywhere.loadResolved(
+                model: model,
+                category: .language,
+                options: LoadOptions(backendPreferences: [
+                    BackendPreference(backend: .llamaCpp, required: true)
+                ])
+            )
+            XCTFail("A required preference must fail preflight")
+        } catch {
+            XCTAssertTrue(error is SDKException)
+        }
+    }
+
+    func testLoneUnspecifiedPreferenceKeepsCatalogRouting() throws {
+        var model = ModelInfo()
+        model.id = "demo-model"
+        model.framework = .llamaCpp
+        model.preferredFramework = .mlx
+        let request = try RunAnywhere.modelLoadRequest(
+            model: model,
+            category: .language,
+            options: LoadOptions(backendPreferences: [
+                BackendPreference(backend: .unspecified)
+            ])
+        )
+        let decoded = try RAModelLoadRequest(serializedBytes: request.serializedData())
+
+        XCTAssertFalse(request.hasFramework)
+        XCTAssertFalse(decoded.hasFramework)
+        XCTAssertEqual(decoded.backendPreferences, [.unspecified])
+    }
+
+    func testUnspecifiedFirstEntryDoesNotPinCatalogAheadOfLaterPreferences() throws {
+        let request = try makeRequest(options: LoadOptions(backendPreferences: [
+            BackendPreference(backend: .unspecified),
+            BackendPreference(backend: .onnx)
+        ]))
+        XCTAssertTrue(request.hasFramework)
+        XCTAssertEqual(request.framework, .unspecified)
+        XCTAssertEqual(request.backendPreferences, [.unspecified, .onnx])
+    }
+
+    private func makeRequest(options: LoadOptions?) throws -> RAModelLoadRequest {
+        var model = ModelInfo()
+        model.id = "demo-model"
+        model.framework = .llamaCpp
+        return try RunAnywhere.modelLoadRequest(model: model, category: .language, options: options)
+    }
+}
```

---

### Incident Patch 3: `0de53c25` (2026-10-13)
**Commit Message**: fix(gates): fail on deprecated-surface exemptions that match nothing (#965)

* docs: record the v0.20.33 release traps

Four lessons from cutting v0.20.33, which took four candidates. Two were real
defects that would have shipped an SDK where TTS does not link.

The expensive one: a new NeuRT archive must be added in FOUR places, and three
only fail in a build configuration a dev Mac never produces. Miss the force-load
lists and every native job is green while validate_consumer_flutter dies an hour
later on `Undefined symbol: _g_neurt_tts_ops` -- the engine registers, all CMake
targets compile, only a CONSUMER's link fails. Miss the `#if RAC_NEURT_ROUTABLE`
guard on the vtable entry and the opposite happens: routable builds are fine and
every PR job without NEURUN_TOKEN fails, because the non-routable shell still
references a symbol nothing defines. A machine with the payload staged is
routable and reproduces neither.

This file already notes that prose alone did not stop the checksum-staleness bug
recurring twice, so the archive-list half now has a mechanism:
`neurt_assert_no_unlisted_archives` fails packaging by name. The vtable guard has
none -- hence the instruction to audit al

**File**: `scripts/validation/gates/check_deprecated_surfaces.sh` (modified, +33/-2)
```diff
@@ -5,7 +5,9 @@
 # hand-written DTOs, JSON bridges, string-based enums, or deprecated facades.
 #
 # Exits 0 when all detected violations are present in the allowlist.
-# Exits 1 when NEW (non-allowlisted) violations are found.
+# Exits 1 when NEW (non-allowlisted) violations are found, or when an allowlist
+# entry matched nothing this run (a stale entry would silently exempt a later
+# reintroduction of that exact surface in that exact file).
 #
 # Can run standalone or as a step within run_global_source_checks.sh.
 set -euo pipefail
@@ -57,14 +59,18 @@ is_allowed() {
 # Counters and temp files for collecting results.
 VIOLATIONS_FILE="$(mktemp)"
 ALLOWLISTED_FILE="$(mktemp)"
-trap 'rm -f "${VIOLATIONS_FILE}" "${ALLOWLISTED_FILE}"' EXIT
+# path|category of every allowlist entry that exempted at least one hit.
+USED_ENTRIES_FILE="$(mktemp)"
+STALE_FILE="$(mktemp)"
+trap 'rm -f "${VIOLATIONS_FILE}" "${ALLOWLISTED_FILE}" "${USED_ENTRIES_FILE}" "${STALE_FILE}"' EXIT
 
 # Record a hit. $1 = relative path from repo root, $2 = category description.
 record_hit() {
   local rel_path="$1"
   local category="$2"
   if is_allowed "${rel_path}" "${category}"; then
     printf "%s  (%s)\n" "${rel_path}" "${category}" >> "${ALLOWLISTED_FILE}"
+    printf "%s|%s\n" "${rel_path}" "${category}" >> "${USED_ENTRIES_FILE}"
   else
     printf "%s  (%s)\n" "${rel_path}" "${category}" >> "${VIOLATIONS_FILE}"
   fi
@@ -345,6 +351,27 @@ if [[ -s "${ALLOWLISTED_FILE}" ]]; then
   printf "\n"
 fi
 
+# An allowlist entry that exempted nothing is stale. Report it before any new
+# violations so a renamed file shows both halves of its fix in a single run.
+if [[ -n "${ALLOWLIST_ENTRIES}" ]]; then
+  while IFS= read -r entry; do
+    grep -qxF "${entry}" "${USED_ENTRIES_FILE}" || printf "%s\n" "${entry}" >> "${STALE_FILE}"
+  done <<< "${ALLOWLIST_ENTRIES}"
+fi
+
+STALE_COUNT=0
+if [[ -s "${STALE_FILE}" ]]; then
+  STALE_COUNT=$(wc -l < "${STALE_FILE}" | tr -d ' ')
+  printf "STALE EXCEPTIONS (%s entries) -- they match no detected surface; delete or correct them:\n" "${STALE_COUNT}"
+  while IFS= read -r entry; do
+    printf "  [FAIL] %s\n" "${entry}"
+  done < "${STALE_FILE}"
+  printf "\n"
+  printf "Stale entries are path|category lines in:\n"
+  printf "  %s\n" "${ALLOWLIST_FILE}"
+  printf "\n"
+fi
+
 VIOLATION_COUNT=0
 if [[ -s "${VIOLATIONS_FILE}" ]]; then
   VIOLATION_COUNT=$(wc -l < "${VIOLATIONS_FILE}" | tr -d ' ')
@@ -358,5 +385,9 @@ if [[ -s "${VIOLATIONS_FILE}" ]]; then
   exit 1
 fi
 
+if [[ "${STALE_COUNT}" -gt 0 ]]; then
+  exit 1
+fi
+
 printf "All detected surfaces match documented exceptions. No new regressions.\n"
 exit 0
```

#### Recent Merged Pull Requests:
- **PR #1132** (2026-10-17): test(connect): pin display_name and framework in the repeat host-start regression (#1105) (@Adityakk9031)
- **PR #1111** (2026-10-16): fix(tool-calling): unwrap a single call in OpenAI's tool_calls array (@Atharvsinh-codez)
- **PR #1091** (2026-10-16): fix(llm): give RAC_LLM_OPTIONS_DEFAULT the IDL's annotated min_p (#1083) (@Adityakk9031)
- **PR #1089** (2026-10-16): fix(connect): reject a repeat host start that changes any model descriptor field (#1077) (@Adityakk9031)
- **PR #1088** (2026-10-16): fix(bindings): forward the six RAG generation knobs from Electron and Python (#1082) (@Adityakk9031)
- **PR #1073** (2026-10-16): fix(rag): the RAG query path rewrites explicit 0s and drops six generation knobs (@VanshBhardwaj24)

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

## X. swift): return the Sendable handle ref from RagSession, not the raw pointer (#10

**RULE**:
When implementing operations in `bindings/swift/Sources/RunAnywhere/Public/API/Rag/RagSession.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RunanywhereAI/runanywhere-sdks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ab31cbfd`: swift): return the Sendable handle ref from RagSession, not the raw pointer (#1015). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `bindings/swift/Sources/RunAnywhere/Public/API/Rag/RagSession.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
internal struct RagSessionHandleRef: @unchecked Sendable {
    internal func nativeHandleForSolution() throws -> RagSessionHandleRef {
        return RagSessionHandleRef(handle: handle)
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
private struct RagSessionHandleRef: @unchecked Sendable {
    internal func nativeHandleForSolution() throws -> rac_handle_t {
        return handle
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ab31cbfd` are properly handled with clean fallback behavior.
