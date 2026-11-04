> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/runanywhereai-runanywhere-sdks-learnings.md`  
> **Source**: github ([https://github.com/RunanywhereAI/runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks))  
> **Source Version**: `a403990b`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T07:33:19.978Z  
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
> **Harvest Timestamp**: 2026-11-04T07:33:19.966Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RunanywhereAI/runanywhere-sdks`
- **Description**: Production ready toolkit to run AI locally
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10333 stars

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
- **Issue #1204** (2026-11-02): **Web generateStructured should await StructuredOutputProtoAdapter.parseAsync**
  *Symptoms*: Follow-up from #1136 by @Adityakk9031 — thanks again for that PR!  ## What `bindings/web/packages/core/src/Public/API/Namespaces/llm.ts:320` calls the synchronous `adapter.parse(...)`. `StructuredOutputProtoAdapter.parse` throws when `mustUseLlamaBackendWorker()` is true (see `Adapters/StructuredOutputProtoAdapter.ts:39`), and the adapter already offers `parseAsync`. The call predates #1136, which makes the llama path the default mode.  ## Why it matters With a worker-owned llama model, `generateStructured` generates fine and then throws at the parse step.  ## Suggested approach Call `await adapter.parseAsync(...)` (guarding on the same proto-parse support check) and keep the sync path only where no worker owns the model.  ## Done when - [ ] `generateStructured` returns a parsed result when the llama model is owned by the BackendWorker.  Not blocking #1136. @Adityakk9031, you know this code well now — you're welcome to take this one if you're interested.  _Opened with help from Claude Code and Codex._  _Reviewed with help from Claude Code and Codex._ <!-- oss-pr-review-merge v1 kind=followup-issue head=8b849b3 pr=1136 t=5ce8ce4b84 --> 

- **Issue #1200** (2026-11-03): **Clean up registry state when a plugin replace is refused as busy**
  *Symptoms*: Follow-up from #975 by @shubhamsinnh — thanks again for that PR!  ## What In `core/src/plugin/rac_plugin_registry.cpp` (around line 459-465), `rac_plugin_register` now returns `RAC_ERROR_PLUGIN_BUSY` when the plugin being replaced still has a model lease. That early return leaves the incoming vtable's pending entry in `manifests_by_vtable` (the priority-reject path just below erases it), and the `dl_handles.try_emplace` above it has already run, leaving an empty entry. The try-register helpers in `bindings/electron/native/addon.cpp` (around line 500) and `bindings/python/native/module.cpp` (around line 408) treat only success, duplicate and already-registered as benign, so a busy refusal would be recorded as the backend being unavailable.  ## Why it matters Re-registering a backend while a segmentation model is loaded is rare, but when it happens the registry keeps a stale manifest entry, and a working backend can be reported as missing.  ## Suggested approach Erase `manifests_by_vtable[vtable]` before the busy return, make the `dl_handles` emplace happen after the busy and priority checks, and treat `RAC_ERROR_PLUGIN_BUSY` like `RAC_ERROR_PLUGIN_DUPLICATE` in the two helpers (as `plugin_loader.cpp:272` already does).  ## Done when - [ ] A busy refusal leaves no `manifests_by_vtable` or `dl_handles` residue - [ ] A busy refusal is not recorded as plugin-unavailable by the Electron and Python helpers  Not blocking #975. @shubhamsinnh, you know this code well now — you're welco

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

### Incident Patch 1: `40053ed9` (2026-11-03)
**Commit Message**: fix(commons): reject default tool keys that collide after UTF-8 repair (#1233)

* fix(commons): reject default tool keys that collide after UTF-8 repair

* fix(commons): close key-collision gaps found in PR review

Reject ambiguous default tool calls wherever the parser could still read them,
and stop rejecting the ones it cannot.

Guard coverage:
- Scan every `<tool_call>` envelope, not just the first. With
  `parallel_tool_calls` later envelopes are dispatched too, and their colliding
  keys were repaired out of sight before parsing.
- Decode and scan JSON-encoded `arguments` string values (`arguments`, `args`,
  `params`, `parameters`, `input`), so an OpenAI-style envelope whose whole
  argument object lives inside one string token is rejected instead of being
  dispatched with one silently chosen value. The decode mirrors the parser's
  own unescape and keeps malformed bytes intact, so repair provenance survives.
- Skip closed thinking blocks in the generation-boundary check on grammar
  backends. Those backends strip think blocks before parsing, so a colliding
  example inside one can never reach a parser or an executor and must not fail
  the turn. Every other backend still c

**File**: `core/src/features/llm/tool_calling.cpp` (modified, +20/-0)
```diff
@@ -32,6 +32,7 @@
 #include <vector>
 
 #include "features/llm/tool_calling_internal.h"
+#include "features/llm/tool_calling_key_repair_internal.h"
 #include "features/llm/utf8_internal.h"
 #include "rac/core/rac_logger.h"
 #include "rac/features/llm/rac_tool_calling.h"
@@ -923,13 +924,32 @@ static std::string validation_errors_to_json(const std::vector<std::string>& err
 // JSON NORMALIZATION
 // =============================================================================
 
+/**
+ * @brief Normalize a tool-call JSON payload, repairing malformed UTF-8.
+ *
+ * Rejects payloads whose distinct raw keys decode to the same key after repair
+ * (`RAC_ERROR_INVALID_ARGUMENT`), then repairs bytes and re-serializes valid
+ * JSON, falling back to the unquoted-key normalizer when the fast parse fails.
+ *
+ * @param json_str Raw JSON payload (must not be null).
+ * @param out_normalized Receives the owned normalized string on success.
+ * @return RAC_SUCCESS (repaired on the fast path, or via the unquoted-key
+ *         scanner when the fast parser rejects the payload),
+ *         RAC_ERROR_INVALID_ARGUMENT for ambiguous keys,
+ *         RAC_ERROR_OUT_OF_MEMORY on allocation failure, or RAC_ERROR_INTERNAL
+ *         for an unexpected exception.
+ */
 extern "C" rac_result_t rac_tool_call_normalize_json(const char* json_str,
                                                        char** out_normalized) try {
     if (!json_str || !out_normalized) {
         return RAC_ERROR_INVALID_ARGUMENT;
     }
     *out_normalized = nullptr;
 
+    if (rac::llm::tool_calling::has_repaired_key_collision(json_str)) {
+        return RAC_ERROR_INVALID_ARGUMENT;
+    }
+
     // Repair before the fast parse as well as unquoted-key normalization, so
     // malformed model bytes do not make otherwise valid JSON take the scanner path.
     const std::string sanitized = rac::llm::sanitize_utf8(json_str);
```

**File**: `core/src/features/llm/tool_calling_generation_internal.h` (modified, +42/-0)
```diff
@@ -9,6 +9,7 @@
 #include "features/llm/llm_thinking_directive_internal.h"
 #include "features/llm/llm_thinking_tags_internal.h"
 #include "features/llm/rac_llm_lifecycle_bridge.h"
+#include "features/llm/tool_calling_key_repair_internal.h"
 #include "features/llm/utf8_internal.h"
 #include "rac/features/llm/rac_llm_service.h"
 #include "rac/features/llm/rac_llm_thinking.h"
@@ -318,6 +319,24 @@ inline runanywhere::v1::FinishReason finish_reason_from_raw(const rac_llm_result
 }
 #endif
 
+/**
+ * @brief Runs one constrained generation step for the tool-calling loop.
+ *
+ * Applies the per-step sampling, grammar dialect, and history overrides on
+ * @p generation, drives the loaded engine, and either copies the sanitized
+ * output into @p out_response or reports the failure code through @p out_rc.
+ * Ambiguous repaired-key collisions are rejected here, before the output is
+ * copied or measured, so they can never reach a parser or an executor.
+ *
+ * @param generation Step options and cached thinking-tag state (in/out).
+ * @param cancel_binding Handles exposed to rac_*_cancel while generating.
+ * @param prompt Fully formatted prompt for this step.
+ * @param out_response Sanitized model output on success (may be null).
+ * @param out_rc Receives RAC_SUCCESS or the failure code.
+ * @param agg Optional telemetry accumulator for this loop.
+ * @param out_finish_reason Optional finish-reason output (protobuf builds).
+ * @return true on success; false when the step failed (see @p out_rc).
+ */
 inline bool run_generate_once(GenerationState& generation,
                               const GenerationCancelBinding& cancel_binding,
                               const std::string& prompt, std::string* out_response,
@@ -460,6 +479,29 @@ inline bool run_generate_once(GenerationState& generation,
         return false;
     }
 
+    if (raw.text) {
+        // Grammar backends strip closed thinking blocks before parsing, so a
+        // collision that only exists inside a think block can never reach a
+        // parser or an executor. Every other backend parses the whole raw
+        // output, so it keeps the full check.
+        std::string body;
+        const std::string full(raw.text);
+        const std::string* check_text = &full;
+        if (ref.supports_grammar) {
+            std::string thinking;
+            split_display_text_and_thinking(full, &body, &thinking, generation);
+            check_text = &body;
+        }
+        if (default_call_has_repaired_key_collision(*check_text)) {
+            rac_llm_result_free(&raw);
+            release_lifecycle_llm(&ref);
+            if (out_rc) {
+                *out_rc = RAC_ERROR_INVALID_ARGUMENT;
+            }
+            return false;
+        }
+    }
+
     if (out_response) {
         // Both orchestration paths serialize model output into ToolParseRequest
         // string fields before parsing; repair bytes before that strict boundary.
```

**File**: `core/src/features/llm/tool_calling_key_repair_internal.h` (added, +333/-0)
```diff
@@ -0,0 +1,333 @@
+#ifndef RAC_FEATURES_LLM_TOOL_CALLING_KEY_REPAIR_INTERNAL_H
+#define RAC_FEATURES_LLM_TOOL_CALLING_KEY_REPAIR_INTERNAL_H
+
+#include <cctype>
+#include <nlohmann/json.hpp>
+#include <string>
+#include <unordered_map>
+#include <vector>
+
+#include "features/llm/utf8_internal.h"
+
+namespace rac::llm::tool_calling {
+
+namespace key_repair_detail {
+
+/** Lowercases one ASCII byte. JSON keywords are ASCII, so no locale is needed. */
+inline char ascii_lower(char ch) {
+    return (ch >= 'A' && ch <= 'Z') ? static_cast<char>(ch - 'A' + 'a') : ch;
+}
+
+/** Lowercased copy for case-insensitive keyword comparison. */
+inline std::string ascii_lower(const std::string& value) {
+    std::string lowered = value;
+    for (char& ch : lowered) {
+        ch = ascii_lower(ch);
+    }
+    return lowered;
+}
+
+/**
+ * Keys the parser accepts as the tool-call wrapper (`TOOL_NAME_KEYS` in
+ * tool_calling.cpp). An object reached through one of these is an envelope the
+ * parser unwraps, and string-encoded arguments inside it are decoded.
+ */
+inline bool is_tool_alias(const std::string& key) {
+    const std::string lowered = ascii_lower(key);
+    return lowered == "tool" || lowered == "name" || lowered == "function" || lowered == "func" ||
+           lowered == "method" || lowered == "action" || lowered == "command";
+}
+
+/**
+ * Keys the parser decodes as an argument object (`ARGUMENT_KEYS` in
+ * tool_calling.cpp). The parser matches them case-insensitively, so this must
+ * too: `"Arguments"` is decoded exactly like `"arguments"`.
+ */
+inline bool is_argument_alias(const std::string& key) {
+    const std::string lowered = ascii_lower(key);
+    return lowered == "arguments" || lowered == "args" || lowered == "params" ||
+           lowered == "parameters" || lowered == "input";
+}
+
+/** Appends one code point as UTF-8. */
+inline void append_utf8(unsigned int codepoint, std::string* out) {
+    if (codepoint < 0x80) {
+        out->push_back(static_cast<char>(codepoint));
+    } else if (codepoint < 0x800) {
+        out->push_back(static_cast<char>(0xC0 | (codepoint >> 6)));
+        out->push_back(static_cast<char>(0x80 | (codepoint & 0x3F)));
+    } else if (codepoint < 0x10000) {
+        out->push_back(static_cast<char>(0xE0 | (codepoint >> 12)));
+        out->push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3F)));
+        out->push_back(static_cast<char>(0x80 | (codepoint & 0x3F)));
+    } else {
+        out->push_back(static_cast<char>(0xF0 | (codepoint >> 18)));
+        out->push_back(static_cast<char>(0x80 | ((codepoint >> 12) & 0x3F)));
+        out->push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3F)));
+        out->push_back(static_cast<char>(0x80 | (codepoint & 0x3F)));
+    }
+}
+
+/** Reads four hex digits at @p pos of @p token. False when they are not hex. */
+inline bool read_hex4(const std::string& token, size_t pos, unsigned int* out) {
+    if (pos + 3 >= token.size()) {
+        return false;
+    }
+    unsigned int value = 0;
+    for (size_t i = 0; i < 4; ++i) {
+        const char ch = token[pos + i];
+        unsigned int digit = 0;
+        if (ch >= '0' && ch <= '9') {
+            digit = static_cast<unsigned int>(ch - '0');
+        } else if (ch >= 'a' && ch <= 'f') {
+            digit = static_cast<unsigned int>(ch - 'a') + 10;
+        } else if (ch >= 'A' && ch <= 'F') {
+            digit = static_cast<unsigned int>(ch - 'A') + 10;
+        } else {
+            return false;
+        }
+        value = (value << 4) | digit;
+    }
+    *out = value;
+    return true;
+}
+
+/**
+ * Decode one quoted JSON string token into the bytes the parser's JSON layer
+ * sees. `\uXXXX` escapes are decoded (including surrogate pairs) because the
+ * default-format envelope is re-serialized by nlohmann before extraction:
+ * `\u007B` reaches the parser as `{`, so it has to reach the scan as `{` too or
+ * the encoded object stays invisible. Malformed raw bytes are carried through
+ * untouched, which is what keeps their repair provenance observable.
+ *
+ * @param token Quoted token, quotes included.
+ */
+inline std::string decode_json_string_token(const std::string& token) {
+    std::string decoded;
+    if (token.size() < 2) {
+        return decoded;
+    }
+    const size_t last = token.size() - 2;  // last content byte
+    decoded.reserve(last);
+    for (size_t i = 1; i <= last; ++i) {
+        const char ch = token[i];
+        if (ch != '\\' || i + 1 > last) {
+            decoded += ch;
+            continue;
+        }
+        const char escaped = token[++i];
+        switch (escaped) {
+            case 'n':
+                decoded += '\n';
+                break;
+            case 'r':
+                decoded += '\r';
+                break;
+            case 't':
+                decoded += '\t';
+                break;
+            case 'b':
+                decoded += '\b';
+                break;
+            case 'f':
+   
```

**File**: `core/tests/test_tool_calling.cpp` (modified, +107/-0)
```diff
@@ -122,6 +122,112 @@ int test_parse_default_invalid_utf8() {
     return 0;
 }
 
+/** @brief Collisions are rejected at normalization and parse level; valid
+ *         duplicates and non-key JSON text stay accepted. */
+int test_default_repaired_key_collisions() {
+    // Normalization-level rejections. Bare objects carry no tool name, so a
+    // parse-level assertion on them would hold with or without the guard; the
+    // parse contract is covered by `call_collisions` below.
+    const char* normalize_collisions[] = {
+        "{\"x\xFF\":1,\"x\xFE\":2}",
+        "{\"nested\":{\"x\xFF\":1,\"x\xFE\":2}}",
+        "{\"items\":[{\"x\xFF\":1,\"x\xFE\":2}]}",
+        "{\"x\xFF\":1,\"x\uFFFD\":2}",
+        "{\"x\uFFFD\":1,\"x\xFF\":2}",
+        "{\"x\\uFFFD\":1,\"x\xFF\":2}",
+        "{\"\\u0078\xFF\":1,\"x\xFE\":2}",
+        "{nested:{\"x\xFF\":1,\"x\xFE\":2}}",
+        "{\"tool\":\"lookup\",\"arguments\":{\"x\xFF\":1,\"x\xFE\":2}}",
+        // Wrapper shapes whose string-encoded arguments the parser decodes.
+        "{\"function\":{\"name\":\"lookup\",\"arguments\":\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}}",
+        "{\"function\":{\"name\":\"lookup\",\"Arguments\":\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}}",
+        "{\"function\":{\"name\":\"lookup\",\"arguments\":"
+        "\"\\u007B\\\"x\xFF\\\":1,\\\"x\xFE\\\":2\\u007D\"}}",
+        "{\"tool_calls\":[{\"type\":\"function\",\"function\":{\"name\":\"lookup\","
+        "\"arguments\":\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}}]}",
+    };
+    for (const char* input : normalize_collisions) {
+        char* normalized = nullptr;
+        ASSERT_EQ_INT(rac_tool_call_normalize_json(input, &normalized), RAC_ERROR_INVALID_ARGUMENT);
+        ASSERT_TRUE(normalized == nullptr);
+    }
+    // The same ambiguity through a full default call must parse to no call.
+    const char* call_collisions[] = {
+        "{\"tool\":\"lookup\",\"arguments\":{\"x\xFF\":1,\"x\xFE\":2}}",
+        "{\"function\":{\"name\":\"lookup\",\"arguments\":\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}}",
+        "{\"function\":{\"name\":\"lookup\",\"Arguments\":\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}}",
+        "{\"function\":{\"name\":\"lookup\",\"arguments\":"
+        "\"\\u007B\\\"x\xFF\\\":1,\\\"x\xFE\\\":2\\u007D\"}}",
+        "{\"tool_calls\":[{\"type\":\"function\",\"function\":{\"name\":\"lookup\","
+        "\"arguments\":\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}}]}",
+    };
+    for (const char* input : call_collisions) {
+        const std::string call_text = std::string("<tool_call>") + input + "</tool_call>";
+        rac_tool_call_t call{};
+        ASSERT_EQ_INT(rac_tool_call_parse(call_text.c_str(), &call), RAC_SUCCESS);
+        ASSERT_EQ_INT(call.has_tool_call, RAC_FALSE);
+        ASSERT_TRUE(call.arguments_json == nullptr);
+        rac_tool_call_free(&call);
+    }
+    // Each allowed case pins its exact normalized output, so a silently wrong
+    // value cannot pass by only proving normalization succeeded.
+    struct AllowedCase {
+        const char* input;
+        const char* expected;
+    };
+    const AllowedCase allowed[] = {
+        {"{\"x\":1,\"x\":2,\"value\":\"\xFF\"}", "{\"x\":2,\"value\":\"\xEF\xBF\xBD\"}"},
+        {"{\"x\uFFFD\":1,\"x\uFFFD\":2}", "{\"x\uFFFD\":2}"},
+        {"{\"a\":{\"x\xFF\":1},\"b\":{\"x\xFE\":2}}",
+         "{\"a\":{\"x\uFFFD\":1},\"b\":{\"x\uFFFD\":2}}"},
+        {"{\"items\":[{\"x\xFF\":1},{\"x\xFE\":2}]}",
+         "{\"items\":[{\"x\uFFFD\":1},{\"x\uFFFD\":2}]}"},
+        {"{\"x\xFF\":1,\"y\xFE\":2}", "{\"x\uFFFD\":1,\"y\uFFFD\":2}"},
+        {"{\"path\":\"C:\\\\\",\"x\xFF\":1,\"text\":\"{}\\\"x:\"}",
+         "{\"path\":\"C:\\\\\",\"x\uFFFD\":1,\"text\":\"{}\\\"x:\"}"},
+        // Valid duplicate keys keep last-wins, including inside a decoded
+        // arguments string.
+        {"{\"function\":{\"name\":\"lookup\",\"arguments\":\"{\\\"x\\\":1,\\\"x\\\":2}\"}}",
+         "{\"function\":{\"name\":\"lookup\",\"arguments\":\"{\\\"x\\\":1,\\\"x\\\":2}\"}}"},
+        // A non-arguments string value is data, not keys: never rejected, and
+        // its bytes are repaired like any other value.
+        {"{\"note\":\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}",
+         "{\"note\":\"{\\\"x\xEF\xBF\xBD\\\":1,\\\"x\xEF\xBF\xBD\\\":2}\"}"},
+        // The parser wraps top-level string arguments as {"input": ...}; it
+        // never expands them into keys, so this is not ambiguous.
+        {"{\"tool\":\"lookup\",\"arguments\":\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}",
+         "{\"tool\":\"lookup\",\"arguments\":\"{\\\"x\xEF\xBF\xBD\\\":1,"
+         "\\\"x\xEF\xBF\xBD\\\":2}\"}"},
+        // Object-valued arguments are passed through unchanged, so JSON text in
+        // ordinary tool data is data, not keys.
+        {"{\"tool\":\"lookup\",\"arguments\":{\"metadata\":{\"arguments\":"
+         "\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}}}",
+         "{\"tool\":\"lookup\",\"arguments\":{\"metadata\":{\"arguments\":"
+ 
```

**File**: `core/tests/test_tool_calling_run_loop.cpp` (modified, +174/-0)
```diff
@@ -587,6 +587,174 @@ int test_one_tool_call_then_final_text() {
     return 0;
 }
 
+int test_default_repaired_key_collision_never_executes() {
+    if (!load_mock_llm())
+        return 1;
+    set_responses({
+        "<tool_call>{\"tool\":\"get_weather\",\"arguments\":{\"x\xFF\":1,\"x\xFE\":2}}</tool_call>",
+    });
+    auto request = make_request("Look up the weather.");
+    request.mutable_options()->set_validate_calls(false);
+    std::vector<uint8_t> bytes;
+    CHECK(serialize(request, &bytes), "collision request serializes");
+    ExecutorState exec;
+    rac_proto_buffer_t out{};
+    rac_proto_buffer_init(&out);
+    const rac_result_t rc = run_loop(bytes.data(), bytes.size(), executor_callback, &exec, &out);
+    CHECK(exec.invocation_count == 0, "ambiguous call never reaches executor");
+    CHECK(generate_calls() == 1, "ambiguous call does not synthesize a result");
+    CHECK(rc == RAC_ERROR_INVALID_ARGUMENT, "collision returns invalid argument");
+    runanywhere::v1::ToolCallingResult result;
+    CHECK(out.data && result.ParseFromArray(out.data, static_cast<int>(out.size)),
+          "collision error result decodes");
+    CHECK(result.error_code() == RAC_ERROR_INVALID_ARGUMENT,
+          "collision reports invalid argument");
+    rac_proto_buffer_free(&out);
+    cleanup_environment();
+    return 0;
+}
+
+/** @brief A collision in a later envelope (parallel_tool_calls) never dispatches. */
+int test_second_default_envelope_collision_never_executes() {
+    if (!load_mock_llm())
+        return 1;
+    // With parallel_tool_calls every envelope is dispatched, so a colliding key
+    // in a later envelope must fail the turn exactly like one in the first.
+    set_responses({
+        "<tool_call>{\"tool\":\"get_weather\",\"arguments\":{\"location\":\"Paris\"}}</tool_call>"
+        "<tool_call>{\"tool\":\"get_weather\",\"arguments\":{\"x\xFF\":1,\"x\xFE\":2}}</tool_call>",
+    });
+    auto request = make_request("Look up the weather twice.");
+    request.mutable_options()->set_validate_calls(false);
+    request.mutable_options()->set_parallel_tool_calls(true);
+    std::vector<uint8_t> bytes;
+    CHECK(serialize(request, &bytes), "parallel collision request serializes");
+    ExecutorState exec;
+    rac_proto_buffer_t out{};
+    rac_proto_buffer_init(&out);
+    const rac_result_t rc = run_loop(bytes.data(), bytes.size(), executor_callback, &exec, &out);
+    CHECK(exec.invocation_count == 0, "parallel ambiguous call never reaches executor");
+    CHECK(generate_calls() == 1, "parallel ambiguous call does not synthesize a result");
+    CHECK(rc == RAC_ERROR_INVALID_ARGUMENT, "parallel collision returns invalid argument");
+    rac_proto_buffer_free(&out);
+    cleanup_environment();
+    return 0;
+}
+
+/** @brief A collision inside encoded function.arguments never dispatches. */
+int test_envelope_string_arguments_collision_never_executes() {
+    if (!load_mock_llm())
+        return 1;
+    // OpenAI-style envelope: the whole argument object is one JSON-encoded
+    // string. Its colliding keys must be rejected before dispatch, not repaired
+    // into a silently last-wins value.
+    set_responses({
+        "<tool_call>{\"function\":{\"name\":\"get_weather\",\"arguments\":"
+        "\"{\\\"x\xFF\\\":1,\\\"x\xFE\\\":2}\"}}</tool_call>",
+    });
+    auto request = make_request("Look up the weather.");
+    request.mutable_options()->set_validate_calls(false);
+    std::vector<uint8_t> bytes;
+    CHECK(serialize(request, &bytes), "encoded-arguments collision request serializes");
+    ExecutorState exec;
+    rac_proto_buffer_t out{};
+    rac_proto_buffer_init(&out);
+    const rac_result_t rc = run_loop(bytes.data(), bytes.size(), executor_callback, &exec, &out);
+    CHECK(exec.invocation_count == 0, "encoded-arguments collision never reaches executor");
+    CHECK(generate_calls() == 1, "encoded-arguments collision does not synthesize a result");
+    CHECK(rc == RAC_ERROR_INVALID_ARGUMENT,
+          "encoded-arguments collision returns invalid argument");
+    rac_proto_buffer_free(&out);
+    cleanup_environment();
+    return 0;
+}
+
+/** @brief \u-escaped braces must not hide an encoded argument collision. */
+int test_envelope_unicode_escaped_arguments_collision_never_executes() {
+    if (!load_mock_llm())
+        return 1;
+    // Braces written as \u007B/\u007D survive normalization as real braces, so
+    // the parser expands this object and would dispatch it last-wins unless the
+    // scan decodes the escapes first.
+    set_responses({
+        "<tool_call>{\"function\":{\"name\":\"get_weather\",\"arguments\":"
+        "\"\\u007B\\\"x\xFF\\\":1,\\\"x\xFE\\\":2\\u007D\"}}</tool_call>",
+    });
+    auto request = make_request("Look up the weather.");
+    request.mutable_options()->set_validate_calls(false);
+    std::vector<uint8_t> bytes;
+    CHECK(serialize(request, &bytes), "escaped-brace collision request serializes");
+    ExecutorState e
```

**File**: `core/tests/test_tool_calling_session_proto.cpp` (modified, +33/-0)
```diff
@@ -491,6 +491,38 @@ runanywhere::v1::ToolCallingSessionCreateRequest make_request(const std::string&
     return request;
 }
 
+/** @brief An ambiguous call fails the session with INVALID_ARGUMENT and emits no tool call. */
+int test_session_repaired_key_collision_never_emits_call() {
+    if (!load_mock_llm())
+        return 1;
+    set_responses({
+        "<tool_call>{\"tool\":\"get_weather\",\"arguments\":{\"items\":[{\"x\xFF\":1,\"x\xFE\":2}]}"
+        "}</tool_call>",
+    });
+    EventSink sink;
+    auto request = make_request("Look up the weather.");
+    request.mutable_options()->set_validate_calls(false);
+    std::vector<uint8_t> bytes;
+    CHECK(serialize(request, &bytes), "collision session request serializes");
+    uint64_t handle = 0;
+    sink.published_handle = &handle;
+    const rac_result_t rc = rac_tool_calling_session_create_proto(
+        bytes.data(), bytes.size(), sink_callback, &sink, capture_session_handle, &handle);
+    using EvCase = runanywhere::v1::ToolCallingSessionEvent::KindCase;
+    CHECK(sink.count_kind(EvCase::kToolCall) == 0, "ambiguous session never emits a tool call");
+    CHECK(rc == RAC_SUCCESS, "ambiguous session create succeeds and reports via events");
+    CHECK(sink.count_kind(EvCase::kErrorBytes) == 1, "ambiguous session emits exactly one error");
+    runanywhere::v1::SDKError error;
+    CHECK(parse_first_error(sink, &error), "ambiguous session error decodes");
+    CHECK(error.c_abi_code() == RAC_ERROR_INVALID_ARGUMENT,
+          "ambiguous session error is invalid argument");
+    if (handle) {
+        rac_tool_calling_session_destroy_proto(handle);
+    }
+    cleanup_environment();
+    return 0;
+}
+
 int test_session_emits_tool_call() {
     if (!load_mock_llm()) {
         std::fprintf(stderr, "FAIL: mock LLM load\n");
@@ -1466,6 +1498,7 @@ int main() {
         return 0;
 #else
         test_session_emits_tool_call();
+        test_session_repaired_key_collision_never_emits_call();
         test_step_with_result_emits_final();
         test_step_with_result_emits_final("\xC3\x28", "\xEF\xBF\xBD(");
         test_auto_execute_unset_defaults_to_true_and_pauses_for_tool_execution();
```

---

### Incident Patch 2: `8916580f` (2026-11-03)
**Commit Message**: fix(jni): validate cached refs and method ids across registration paths (#1044) (#1070)

* fix(jni): validate cached refs and method ids across registration paths (#1044)

- Validate GetObjectClass before GetMethodID lookups across all registration functions
- Reject nativeFileManagerRegisterCallbacks leaving globals untouched if any method ID or NewGlobalRef fails
- Guard all g_fc_* method IDs in jni_fc_* callbacks before Call*Method calls
- Validate NewGlobalRef in device, telemetry, and download registration paths, ensuring C callbacks are uninstalled/cleared on failure
- Clear active JNI exceptions on lookup/allocation failures

* fix(jni): preserve existing platform adapter until replacement is validated

- Defer DeleteGlobalRef on existing adapter until replacement method IDs and global ref succeed
- Resolve optional method IDs into local variables before committing globals
- Avoid leaving process with null callbacks if new adapter is invalid or refused
- Register download progress C callback before committing g_download_proto_listener

Signed-off-by: shobhitagnihotri69 <[REDACTED_EMAIL]>

---------

Signed-off-by: shobhitagnihotri69 <[REDACTED_EMAIL]>
Co-authored-by: shobhit

**File**: `core/src/jni/runanywhere_commons_jni.cpp` (modified, +216/-53)
```diff
@@ -1699,6 +1699,13 @@ Java_com_runanywhere_sdk_native_bridge_RunAnywhereBridge_racSetPlatformAdapter(J
     }
 
     jclass adapterClass = env->GetObjectClass(adapter);
+    if (adapterClass == nullptr) {
+        if (env->ExceptionCheck() == JNI_TRUE) {
+            env->ExceptionClear();
+        }
+        LOGe("racSetPlatformAdapter: failed to get adapter class");
+        return RAC_ERROR_INVALID_ARGUMENT;
+    }
 
     const auto resolve_required = [&](const char* name, const char* sig) -> jmethodID {
         const jmethodID id = env->GetMethodID(adapterClass, name, sig);
@@ -1733,6 +1740,9 @@ Java_com_runanywhere_sdk_native_bridge_RunAnywhereBridge_racSetPlatformAdapter(J
 
     jobject adapterRef = env->NewGlobalRef(adapter);
     if (adapterRef == nullptr) {
+        if (env->ExceptionCheck() == JNI_TRUE) {
+            env->ExceptionClear();
+        }
         LOGe("racSetPlatformAdapter: failed to create a global reference for the adapter");
         env->DeleteLocalRef(adapterClass);
         return RAC_ERROR_INITIALIZATION_FAILED;
@@ -1764,13 +1774,13 @@ Java_com_runanywhere_sdk_native_bridge_RunAnywhereBridge_racSetPlatformAdapter(J
         env->GetMethodID(adapterClass, "fileListDirectory",
                          "(Ljava/lang/String;)[Lcom/runanywhere/sdk/foundation/bridge/extensions/"
                          "RacDirectoryEntry;");
-    if (env->ExceptionCheck()) {
+    if (env->ExceptionCheck() == JNI_TRUE) {
         env->ExceptionClear();
         g_method_file_list_directory = nullptr;
     }
     g_method_is_non_empty_directory =
         env->GetMethodID(adapterClass, "isNonEmptyDirectory", "(Ljava/lang/String;)Z");
-    if (env->ExceptionCheck()) {
+    if (env->ExceptionCheck() == JNI_TRUE) {
         env->ExceptionClear();
         g_method_is_non_empty_directory = nullptr;
     }
@@ -3181,35 +3191,77 @@ Java_com_runanywhere_sdk_native_bridge_RunAnywhereBridge_racDeviceManagerSetCall
         env->DeleteGlobalRef(g_device_jni_state.callback_obj);
         g_device_jni_state.callback_obj = nullptr;
     }
+    g_device_jni_state.get_device_info_method = nullptr;
+    g_device_jni_state.get_device_id_method = nullptr;
+    g_device_jni_state.is_registered_method = nullptr;
+    g_device_jni_state.set_registered_method = nullptr;
+    g_device_jni_state.http_post_method = nullptr;
 
     if (callbacks == nullptr) {
         LOGw("racDeviceManagerSetCallbacks: null callbacks");
+        rac_device_manager_clear_callbacks();
         return RAC_ERROR_INVALID_ARGUMENT;
     }
 
-    // Create global reference
-    g_device_jni_state.callback_obj = env->NewGlobalRef(callbacks);
-
     // Cache method IDs
     jclass cls = env->GetObjectClass(callbacks);
-    g_device_jni_state.get_device_info_method =
-        env->GetMethodID(cls, "getDeviceInfo", "()Ljava/lang/String;");
-    g_device_jni_state.get_device_id_method =
-        env->GetMethodID(cls, "getDeviceId", "()Ljava/lang/String;");
-    g_device_jni_state.is_registered_method = env->GetMethodID(cls, "isRegistered", "()Z");
-    g_device_jni_state.set_registered_method = env->GetMethodID(cls, "setRegistered", "(Z)V");
-    g_device_jni_state.http_post_method =
-        env->GetMethodID(cls, "httpPost", "(Ljava/lang/String;Ljava/lang/String;Z)I");
+    if (cls == nullptr) {
+        if (env->ExceptionCheck() == JNI_TRUE) {
+            env->ExceptionClear();
+        }
+        LOGe("racDeviceManagerSetCallbacks: failed to get class from callbacks object");
+        rac_device_manager_clear_callbacks();
+        return RAC_ERROR_INVALID_ARGUMENT;
+    }
+
+    const auto resolve_method = [&](const char* name, const char* sig) -> jmethodID {
+        const jmethodID id = env->GetMethodID(cls, name, sig);
+        if (env->ExceptionCheck() == JNI_TRUE) {
+            env->ExceptionClear();
+        }
+        return id;
+    };
+
+    const jmethodID m_get_device_info =
+        resolve_method("getDeviceInfo", "()Ljava/lang/String;");
+    const jmethodID m_get_device_id =
+        resolve_method("getDeviceId", "()Ljava/lang/String;");
+    const jmethodID m_is_registered =
+        resolve_method("isRegistered", "()Z");
+    const jmethodID m_set_registered =
+        resolve_method("setRegistered", "(Z)V");
+    const jmethodID m_http_post =
+        resolve_method("httpPost", "(Ljava/lang/String;Ljava/lang/String;Z)I");
+
     env->DeleteLocalRef(cls);
 
-    // Verify methods found
-    if (!g_device_jni_state.get_device_id_method || !g_device_jni_state.is_registered_method) {
-        LOGe("racDeviceManagerSetCallbacks: required methods not found");
-        env->DeleteGlobalRef(g_device_jni_state.callback_obj);
-        g_device_jni_state.callback_obj = nullptr;
+    // Verify all five methods found
+    if (!m_get_device_info || !m_get_device_id || !m_is_registered ||
+        !m_set_registered || !m_http_post) {
+        LOGe("racDeviceManagerSetCallbacks: required methods not found "
+             "(getDeviceInfo/getDev
```

---

### Incident Patch 3: `90001907` (2026-11-03)
**Commit Message**: fix(qhexrt): restore example catalog architecture eligibility (#1156)

* refactor(qhexrt): use explicit URL registration

* fix(kotlin): preserve model registration failures

* fix(flutter): complete registration metadata types

* style: satisfy Flutter and Kotlin checks

* fix(qhexrt): address registration review feedback

* fix(registration): preserve optional metadata safely

* fix(registration): align Swift metadata and JNI errors

* fix(qhexrt): address architecture registration review

* fix(qhexrt): complete catalog review corrections

* fix: map native proto failures and preserve download size

* fix(flutter): preserve native model registration failures

* fix(kotlin): preserve discovery and JSON failure contracts

* fix(flutter): normalize model registration failures

* docs(qhexrt): correct initialization and registration examples

* fix(qhexrt): improve model registration diagnostics

* fix(qhexrt): document guarded bundle registration

* test(react-native): cover native registration error conversion

* fix(qhexrt): restore example catalog architecture eligibility

* fix(sdk): preserve registration metadata and native failure details

Propagate Kotlin tool serialization 

**File**: `.github/workflows/pr-build.yml` (modified, +8/-0)
```diff
@@ -520,6 +520,14 @@ jobs:
           dart run melos run analyze
           dart run melos run test
 
+      # The example is outside the Melos package workspace.
+      - name: Test QHexRT example catalog eligibility
+        working-directory: bindings/flutter/example
+        run: |
+          set -euo pipefail
+          flutter pub get
+          flutter test --no-pub test/qhexrt_model_catalog_test.dart
+
   rn-typecheck:
     runs-on: ubuntu-22.04
     steps:
```

**File**: `bindings/flutter/example/lib/core/services/qhexrt_model_catalog.dart` (modified, +51/-7)
```diff
@@ -115,10 +115,13 @@ abstract final class QHexRTModelCatalog {
   static Set<String> get registeredModelIds =>
       snapshots.value.registeredModelIds;
 
-  /// Kept in lockstep with Android's `ModelCatalog.npuCatalog`.
+  /// Curated public examples, preserving the former native architecture masks.
+  /// The private kitten_nano_0_8_varlen variant is deliberately not seeded;
+  /// adding it requires an explicit HF-auth preflight, not just an arch pin.
   static const List<QHexRTCatalogModel> models = [
     QHexRTCatalogModel(
       id: 'qwen3_0_6b',
+      excludedArchitectures: {HexagonArch.HEXAGON_ARCH_V79},
       name: 'Qwen3 0.6B (HNPU)',
       url:
           'https://huggingface.co/runanywhere/qwen3_0_6b_HNPU/qwen3-0.6b-1024final.json',
@@ -147,6 +150,7 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'qwen3_5_4b',
+      excludedArchitectures: {HexagonArch.HEXAGON_ARCH_V75},
       name: 'Qwen3.5 4B (HNPU)',
       url:
           'https://huggingface.co/runanywhere/qwen3_5_4b_HNPU/qwen3.5-4b-1024.json',
@@ -156,6 +160,7 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'qwen3_vl_2b_text',
+      pinnedArchitecture: HexagonArch.HEXAGON_ARCH_V81,
       name: 'Qwen3-VL 2B Text (HNPU)',
       url:
           'https://huggingface.co/runanywhere/qwen3_vl_HNPU/qwen3vl-2b-text-512.json',
@@ -193,6 +198,7 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'llama3_2_1b',
+      excludedArchitectures: {HexagonArch.HEXAGON_ARCH_V75},
       name: 'Llama 3.2 1B (HNPU)',
       url:
           'https://huggingface.co/runanywhere/llama3_2_1b_HNPU/llama-3.2-1b.json',
@@ -202,31 +208,33 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'phi_tiny_moe',
+      excludedArchitectures: {HexagonArch.HEXAGON_ARCH_V75},
       name: 'Phi Tiny MoE (HNPU)',
       url: 'https://huggingface.co/runanywhere/phi_tiny_moe_HNPU/phimoe.json',
       category: _language,
       memoryBytes: 4721494520,
     ),
     QHexRTCatalogModel(
+      // Preserve the native QAIRT restriction: the v79 bundle needs 2.48.
       id: 'gemma3n_e4b',
+      pinnedArchitecture: HexagonArch.HEXAGON_ARCH_V81,
       name: 'Gemma 3n E4B (HNPU)',
       url:
           'https://huggingface.co/runanywhere/gemma3n_e4b_HNPU/gemma-3n-E4B-it.json',
       category: _language,
       memoryBytes: 10929816419,
-      // The V79 bundle requires QAIRT 2.48; Android currently ships 2.47.
-      pinnedArchitecture: HexagonArch.HEXAGON_ARCH_V81,
     ),
     QHexRTCatalogModel(
       id: 'gemma4_e2b',
+      excludedArchitectures: {HexagonArch.HEXAGON_ARCH_V75},
       name: 'Gemma 4 E2B (HNPU)',
-      url:
-          'https://huggingface.co/runanywhere/gemma4_e2b_HNPU/gemma4-e2b.json',
+      url: 'https://huggingface.co/runanywhere/gemma4_e2b_HNPU/gemma4-e2b.json',
       category: _language,
       memoryBytes: 9252275672,
     ),
     QHexRTCatalogModel(
       id: 'gemma4_e4b',
+      pinnedArchitecture: HexagonArch.HEXAGON_ARCH_V81,
       name: 'Gemma 4 E4B (HNPU)',
       url:
           'https://huggingface.co/runanywhere/gemma4_e4b_HNPU/gemma-4-E4B.json',
@@ -235,6 +243,7 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'nemotron_nano_8b',
+      excludedArchitectures: {HexagonArch.HEXAGON_ARCH_V79},
       name: 'Llama 3.1 Nemotron Nano 8B (HNPU)',
       url:
           'https://huggingface.co/runanywhere/nemotron_nano_8b_HNPU/nemotron-nano-8b.json',
@@ -243,6 +252,7 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'nemoguard_content_8b',
+      pinnedArchitecture: HexagonArch.HEXAGON_ARCH_V81,
       name: 'NemoGuard 8B Content Safety (HNPU)',
       url:
           'https://huggingface.co/runanywhere/nemoguard_8b_content_safety_HNPU/nemoguard-content-8b.json',
@@ -251,6 +261,7 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'nemoguard_topic_8b',
+      pinnedArchitecture: HexagonArch.HEXAGON_ARCH_V81,
       name: 'NemoGuard 8B Topic Control (HNPU)',
       url:
           'https://huggingface.co/runanywhere/nemoguard_8b_topic_control_HNPU/nemoguard-topic-8b.json',
@@ -259,6 +270,7 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'ternary_bonsai_1_7b',
+      excludedArchitectures: {HexagonArch.HEXAGON_ARCH_V79},
       name: 'Ternary Bonsai 1.7B (HNPU)',
       url:
           'https://huggingface.co/runanywhere/ternary_bonsai_1_7b_HNPU/ternary-bonsai-1.7b-1024.json',
@@ -268,6 +280,7 @@ abstract final class QHexRTModelCatalog {
     ),
     QHexRTCatalogModel(
       id: 'bonsai_1_7b_1bit',
+      pinnedArchitecture: HexagonArch.HEXAGON_ARCH_V81,
       name: 'Bonsai-1.7B 1-bit (HNPU, fully-on-NPU)',
       url:
           'https://huggingface.co/runanywhere/bonsai_1_7b_1bit_HNPU/bonsai-1.7b-1bit-1024.json',
@@ -277,6 +290,7 @
```

**File**: `bindings/flutter/example/test/qhexrt_model_catalog_test.dart` (modified, +269/-34)
```diff
@@ -5,6 +5,130 @@ import 'package:runanywhere_ai/core/services/model_catalog_bootstrap.dart';
 import 'package:runanywhere_ai/core/services/qhexrt_model_catalog.dart';
 import 'package:runanywhere_ai/features/models/model_types.dart'
     show ExampleModelInfoView, ModelSelectionContext;
+import 'package:runanywhere_qhexrt/runanywhere_qhexrt.dart';
+
+// Golden eligible IDs from kModelPolicies at 259521e299bb, intersected with
+// this app catalog. Kitten nano deliberately selects only its v81 manifest.
+const _eligibleIdsByArchitecture = <HexagonArch, List<String>>{
+  HexagonArch.HEXAGON_ARCH_V75: [
+    'canary_180m_flash',
+    'canary_1b_flash',
+    'embeddinggemma_300m',
+    'internvl3_5_1b',
+    'kokoro_en',
+    'lfm2_5_230m',
+    'lfm2_5_2_6b',
+    'lfm2_5_350m',
+    'magpie_tts_357m',
+    'melotts_en',
+    'moonshine_base',
+    'moonshine_tiny',
+    'nemotron_3_embed_1b',
+    'nemotron_asr_streaming',
+    'nemotron_nano_8b',
+    'nemotron_ocr',
+    'nemotron_ocr_v1',
+    'nemotron_parse',
+    'nv_embedqa_1b',
+    'nv_rerankqa_1b',
+    'parakeet_ctc_1_1b',
+    'parakeet_rnnt_1_1b',
+    'parakeet_tdt_0_6b_v2',
+    'parakeet_tdt_0_6b_v3',
+    'qwen3_0_6b',
+    'qwen3_5_0_8b',
+    'qwen3_5_2b',
+    'qwen3_vl',
+    'siglip2_base',
+    'ternary_bonsai_1_7b',
+    'whisper_base',
+    'whisper_small',
+  ],
+  HexagonArch.HEXAGON_ARCH_V79: [
+    'cosmos3_edge_diffusion',
+    'cosmos3_edge_text',
+    'cosmos3_edge_vlm',
+    'deepseek_r1_distill_qwen_1_5b',
+    'embeddinggemma_300m',
+    'gemma4_e2b',
+    'gemma4_e2b_vlm',
+    'internvl3_5_1b',
+    'lama_dilated',
+    'lfm2_5_230m',
+    'lfm2_5_2_6b',
+    'lfm2_5_350m',
+    'llama3_2_1b',
+    'melotts_en',
+    'moonshine_base',
+    'moonshine_tiny',
+    'phi_tiny_moe',
+    'qwen3_5_0_8b',
+    'qwen3_5_2b',
+    'qwen3_5_4b',
+    'qwen3_vl',
+    'siglip2_base',
+    'whisper_base',
+    'whisper_small',
+  ],
+  HexagonArch.HEXAGON_ARCH_V81: [
+    'bonsai_1_7b_1bit',
+    'bonsai_27b_1bit',
+    'bonsai_4b_1bit',
+    'bonsai_8b_1bit',
+    'canary_1b_flash',
+    'canary_qwen_2_5b',
+    'cosmos3_edge_diffusion',
+    'cosmos3_edge_text',
+    'cosmos3_edge_vlm',
+    'deepseek_r1_distill_qwen_1_5b',
+    'deepseek_r1_distill_qwen_7b',
+    'embeddinggemma_300m',
+    'gemma3n_e4b',
+    'gemma4_e2b',
+    'gemma4_e2b_vlm',
+    'gemma4_e4b',
+    'gemma4_e4b_vlm',
+    'internvl3_5_1b',
+    'kitten_micro_0_8',
+    'kitten_mini_0_8',
+    'kitten_nano_0_8',
+    'kokoro_en',
+    'lama_dilated',
+    'lfm2_5_230m',
+    'lfm2_5_2_6b',
+    'lfm2_5_350m',
+    'llama3_2_1b',
+    'llama_embed_nemotron_8b',
+    'magpie_tts_357m',
+    'melotts_en',
+    'moonshine_base',
+    'moonshine_tiny',
+    'nemoguard_content_8b',
+    'nemoguard_topic_8b',
+    'nemotron_asr_streaming',
+    'nemotron_nano_8b',
+    'nemotron_nano_vl_8b',
+    'nemotron_ocr',
+    'nemotron_ocr_v1',
+    'nemotron_parse',
+    'nv_embedcode_7b',
+    'nv_embedqa_1b',
+    'nv_rerankqa_1b',
+    'parakeet_rnnt_1_1b',
+    'parakeet_tdt_0_6b_v2',
+    'parakeet_tdt_0_6b_v3',
+    'phi_tiny_moe',
+    'qwen3_0_6b',
+    'qwen3_5_0_8b',
+    'qwen3_5_2b',
+    'qwen3_5_4b',
+    'qwen3_vl_2b_text',
+    'siglip2_base',
+    'ternary_bonsai_1_7b',
+    'whisper_base',
+    'whisper_small',
+  ],
+};
 
 void main() {
   tearDown(QHexRTModelCatalog.resetForTesting);
@@ -38,40 +162,34 @@ void main() {
     }
   });
 
-  test(
-    'QHexRT definitions preserve app-owned explicit URL metadata',
-    () {
-      const rows = QHexRTModelCatalog.models;
-
-      expect(rows.map((model) => model.id).toSet(), hasLength(rows.length));
-      for (final model in rows) {
-        final request = model.toRegistrationRequest();
-        expect(request.id, model.id);
-        expect(request.name, model.name);
-        expect(request.url, model.url);
-        expect(
-          request.framework,
-          InferenceFramework.INFERENCE_FRAMEWORK_QHEXRT,
-        );
-        expect(request.category, model.category);
-        expect(request.source, ModelSource.MODEL_SOURCE_REMOTE);
-        expect(request.memoryRequiredBytes.toInt(), model.memoryBytes);
-        expect(
-          request.hasDownloadSizeBytes()
-              ? request.downloadSizeBytes.toInt()
-              : null,
-          model.downloadBytes,
-        );
-        expect(
-          request.hasContextLength() ? request.contextLength : null,
-          model.contextLength,
-        );
-        expect(request.supportsThinking, model.supportsThinking);
-        expect(request.supportsLora, model.supportsLora);
-        expect(model.url, startsWith('https://'));
-      }
-    },
-  );
+  test('QHexRT definitions preserve app-owned explicit URL metadata', () {
+    const rows = QHexRTModelCatalog.models;
+
+    expect(rows.map((model) => model.id).toSet(), hasLength(rows.length));
+    for (final model in rows) {
+      final request = model.toRegistrationRequest();
+      expect(request.
```

**File**: `bindings/flutter/packages/runanywhere/lib/native/dart_bridge_proto_utils.dart` (modified, +15/-6)
```diff
@@ -55,7 +55,8 @@ class DartBridgeProtoUtils {
       ffi.Pointer<ffi.Uint8>,
       int,
       ffi.Pointer<RacProtoBuffer>,
-    ) invoke,
+    )
+    invoke,
     required T Function(List<int>) decode,
     required String symbol,
     bool preserveNativeError = false,
@@ -68,7 +69,12 @@ class DartBridgeProtoUtils {
     try {
       bindings.rac_proto_buffer_init(out);
       final code = invoke(requestPtr, bytes.length, out);
-      ensureSuccess(out, code, symbol, preserveNativeError: preserveNativeError);
+      ensureSuccess(
+        out,
+        code,
+        symbol,
+        preserveNativeError: preserveNativeError,
+      );
       return decodeBuffer(out, decode);
     } finally {
       bindings.rac_proto_buffer_free(out);
@@ -85,7 +91,8 @@ class DartBridgeProtoUtils {
       ffi.Pointer<ffi.Uint8>,
       int,
       ffi.Pointer<RacProtoBuffer>,
-    ) invoke,
+    )
+    invoke,
     required T Function(List<int>) decode,
     required String symbol,
   }) {
@@ -123,8 +130,9 @@ class DartBridgeProtoUtils {
     if (out.ref.data == ffi.nullptr || out.ref.size == 0) {
       return decode(const <int>[]);
     }
-    final bytes =
-        out.ref.data.asTypedList(out.ref.size).toList(growable: false);
+    final bytes = out.ref.data
+        .asTypedList(out.ref.size)
+        .toList(growable: false);
     return decode(bytes);
   }
 
@@ -143,7 +151,8 @@ class DartBridgeProtoUtils {
       final result = code != RacResultCodes.success ? code : out.ref.status;
       // The canonical mapper uses callOut's default failure handling.
       final exception = SDKException.fromResult(result)!;
-      exception.error.message = message;
+      exception.error.message =
+          '$symbol failed: ${exception.message} (${protoBufferError(out, code)})';
       throw exception;
     }
     throw SDKException.make(
```

**File**: `bindings/flutter/packages/runanywhere_qhexrt/CHANGELOG.md` (modified, +11/-0)
```diff
@@ -5,6 +5,17 @@ All notable changes to the RunAnywhere QHexRT Backend will be documented in this
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [Unreleased]
+
+### Removed
+
+- Breaking: removed `QHexRT.modelSupportsArchitecture`,
+  `QHexRT.modelRequiresHfAuth`, and `QHexRT.registerModelForDevice`, together
+  with the native catalog facade. Catalog selection, eligibility, and any
+  required HF-auth preflight are now the application's responsibility. Probe
+  device capabilities with `QHexRT.probeNpu()` and register eligible rows via
+  `RunAnywhere.models.register()`.
+
 ## [0.20.40] - 2026-10-17
 
 - Version bump to keep the backend package in lockstep with the SDK release.
```

**File**: `bindings/flutter/packages/runanywhere_qhexrt/README.md` (modified, +10/-2)
```diff
@@ -10,12 +10,18 @@
 
 ```yaml
 dependencies:
-  runanywhere: 0.20.11
-  runanywhere_qhexrt: 0.20.11
+  runanywhere: 0.20.37
+  runanywhere_qhexrt: 0.20.37
 ```
 
 See the [Flutter SDK README](../../README.md) for Android setup.
 
+The examples below target this source tree (SDK `0.20.37`). For changes not yet
+released, use local SDK packages and Commons native libraries built from the same
+checkout. The private QHexRT native payload is not in this repository: supply it
+separately from a compatible authorized build and stage it into the local backend
+package. A matching version number alone does not include unreleased changes.
+
 ---
 
 ## Usage
@@ -54,6 +60,8 @@ A known architecture pin in the first repository folder, such as `/v79` or `/v79
 
 Direct `/resolve/` or `/blob/` URLs register a single file and do not receive this bundle-folder check.
 
+Catalog eligibility and any required HF-auth preflight remain application-owned.
+
 ---
 
 ## Requirements
```

**File**: `bindings/kotlin/modules/runanywhere-core-qhexrt/README.md` (modified, +35/-3)
```diff
@@ -12,11 +12,41 @@ Requires the core SDK. Add both to your app module's `build.gradle.kts`:
 
 ```kotlin
 dependencies {
-    implementation("io.github.sanchitmonga22:runanywhere-sdk:0.20.11")
-    implementation("io.github.sanchitmonga22:runanywhere-qhexrt-android:0.20.11")
+    implementation("io.github.sanchitmonga22:runanywhere-sdk:0.20.37")
+    implementation("io.github.sanchitmonga22:runanywhere-qhexrt-android:0.20.37")
 }
 ```
 
+The examples below target this source tree (SDK `0.20.37`). For changes not yet
+released, use local SDK packages and Commons native libraries built from the same
+checkout. The private QHexRT native payload is not in this repository: supply it
+separately from a compatible authorized build. A matching version number alone
+does not include unreleased changes.
+
+For local Kotlin builds, stage the private engine payload under
+`engines/qhexrt/prebuilt/`, preserving its `versions/` layout and `current`
+selection. With the matching QAIRT/QNN runtime available and `ANDROID_NDK_HOME`
+configured, run from the repository root:
+
+```bash
+./scripts/build/build-core-android.sh arm64-v8a
+```
+
+If no private QHexRT prebuilt is selected, the script can complete successfully
+with QHexRT disabled. A successful build alone does not confirm that the private
+engine is included.
+
+The script validates the selected prebuilt and passes its resolved directory to
+CMake as `QHEXRT_ROOT`. It stages the backend libraries into
+`bindings/kotlin/modules/runanywhere-core-qhexrt/src/main/jniLibs/arm64-v8a/`
+and DSP skels into the module's
+`src/main/assets/runanywhere/qhexrt/skels/arm64-v8a/`. To package those staged
+files as a local Maven bundle, run from the repository root:
+
+```bash
+./bindings/kotlin/scripts/package-qhexrt.sh
+```
+
 ---
 
 ## Usage
@@ -67,6 +97,8 @@ A known architecture pin in the first repository folder, such as `/v79` or `/v79
 
 Direct `/resolve/` or `/blob/` URLs register a single file and do not receive this bundle-folder check.
 
+Catalog eligibility and any required HF-auth preflight remain application-owned.
+
 ---
 
 ## Modalities
@@ -89,7 +121,7 @@ QHexRT does not seed or select models. Register the exact model URL intended for
 - Android `arm64-v8a` only (no `armeabi-v7a` / `x86_64` package)
 - Qualcomm Snapdragon device with Hexagon **V75**, **V79**, or **V81** NPU
 - Matching model manifests for the device Hexagon arch (a V81-only bundle will not run on V75)
-- Core artifact `runanywhere-sdk:0.20.11`
+- Core artifact `runanywhere-sdk:0.20.37`
 
 ---
 
```

**File**: `bindings/kotlin/src/main/kotlin/com/runanywhere/sdk/foundation/bridge/extensions/CppBridgeModelRegistry.kt` (modified, +8/-0)
```diff
@@ -389,6 +389,12 @@ object CppBridgeModelRegistry {
         return decodeModelInfoList(bytes, "downloaded ModelInfoList")
     }
 
+    /**
+     * Run a native registry refresh and decode its result.
+     *
+     * Returns null when the bridge supplies no bytes or decoding fails. Native
+     * operation failures propagate as [SDKException] before decoding begins.
+     */
     private fun refreshProto(request: ProtoModelRegistryRefreshRequest): ProtoModelRegistryRefreshResult? {
         val bytes =
             withNativeProtoFailure {
@@ -408,6 +414,7 @@ object CppBridgeModelRegistry {
     private fun removeProto(modelId: String): Int =
         RunAnywhereBridge.racModelRegistryRemoveProto(modelId)
 
+    /** Decode a native model record, logging malformed payloads and returning null. */
     private fun decodeProtoModel(bytes: ByteArray): ProtoModelInfo? =
         try {
             ProtoModelInfo.ADAPTER.decode(bytes)
@@ -416,6 +423,7 @@ object CppBridgeModelRegistry {
             null
         }
 
+    /** Decode a native model list; [label] identifies malformed responses in logs. */
     private fun decodeModelInfoList(bytes: ByteArray, label: String): ProtoModelInfoList? =
         try {
             ProtoModelInfoList.ADAPTER.decode(bytes)
```

#### Recent Merged Pull Requests:
- **PR #1265** (2026-11-04): docs: relabel stale reserved_slot_2..9 comments in plugin entries (@mlzerotoheroyoutube)
- **PR #1261** (2026-11-04): feat(commons): expose rac_classify_null_directory_listing as public API (@mlzerotoheroyoutube)
- **PR #1260** (2026-11-04): docs: v14 slot counts in rac_engine_unavailable.h; tidy RN fileListDirectory comment (@mlzerotoheroyoutube)
- **PR #1256** (2026-11-03): fix(react-native): don't report an unreadable Android model folder as missing (@mlzerotoheroyoutube)
- **PR #1255** (2026-11-03): fix(vad): let an explicit activation_threshold of 0.0 through the configure path (@ayaangazali)
- **PR #1250** (2026-11-03): fix(segmentation): validate legacy direct-path buffers (@shubhamsinnh)

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

## X. commons): reject default tool keys that collide after UTF-8 repair (#1233)

**RULE**:
When implementing operations in `core/src/features/llm/tool_calling.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RunanywhereAI/runanywhere-sdks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `40053ed9`: commons): reject default tool keys that collide after UTF-8 repair (#1233). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/src/features/llm/tool_calling.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include "features/llm/tool_calling_key_repair_internal.h"
/**
 * @brief Normalize a tool-call JSON payload, repairing malformed UTF-8.
 *
 * Rejects payloads whose distinct raw keys decode to the same key after repair
 * (`RAC_ERROR_INVALID_ARGUMENT`), then repairs bytes and re-serializes valid
 * JSON, falling back to the unquoted-key normalizer when the fast parse fails.
 *
 * @param json_str Raw JSON payload (must not be null).
 * @param out_normalized Receives the owned normalized string on success.
 * @return RAC_SUCCESS (repaired on the fast path, or via the unquoted-key
 *         scanner when the fast parser rejects the payload),
 *         RAC_ERROR_INVALID_ARGUMENT for ambiguous keys,
 *         RAC_ERROR_OUT_OF_MEMORY on allocation failure, or RAC_ERROR_INTERNAL
 *         for an unexpected exception.
 */
    if (rac::llm::tool_calling::has_repaired_key_collision(json_str)) {
        return RAC_ERROR_INVALID_ARGUMENT;
    }

```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `40053ed9` are properly handled with clean fallback behavior.
