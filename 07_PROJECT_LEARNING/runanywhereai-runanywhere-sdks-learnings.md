# Forensic Learning Record (Deep Inspection): RunanywhereAI/runanywhere-sdks

> **Canonical Artifact**: `07_PROJECT_LEARNING/runanywhereai-runanywhere-sdks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RunanywhereAI/runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:51:06.804Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RunanywhereAI/runanywhere-sdks`
- **Description**: Production ready toolkit to run AI locally
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10319 stars

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
    const val llamaCppVersion = "runanywhere-b10453.6"

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

### Core Architecture Module: `bindings/kotlin/src/main/kotlin/com/runanywhere/sdk/foundation/bridge/extensions/CppBridgeModelLifecycle.kt`
```
/*
 * Copyright 2026 RunAnywhere SDK
 * SPDX-License-Identifier: Apache-2.0
 */

package com.runanywhere.sdk.foundation.bridge.extensions

import ai.runanywhere.proto.v1.ComponentLifecycleSnapshot
import ai.runanywhere.proto.v1.CurrentModelRequest
import ai.runanywhere.proto.v1.CurrentModelResult
import ai.runanywhere.proto.v1.ModelLoadRequest
import ai.runanywhere.proto.v1.ModelLoadResult
import ai.runanywhere.proto.v1.ModelUnloadRequest
import ai.runanywhere.proto.v1.ModelUnloadResult
import ai.runanywhere.proto.v1.SDKComponent
import com.runanywhere.sdk.native.bridge.RunAnywhereBridge
import com.runanywhere.sdk.public.types.RAModelLoadRequest
import com.runanywhere.sdk.public.types.RAModelLoadResult
import com.squareup.wire.Message
import com.squareup.wire.ProtoAdapter

private fun <M : Message<M, *>> decodeOrNull(
    adapter: ProtoAdapter<M>,
    bytes: ByteArray?,
    operation: String,
): M? {
    if (bytes == null) return null
    return try {
        adapter.decode(bytes)
    } catch (e: Exception) {
        CppBridgePlatformAdapter.logCallback(
            CppBridgePlatformAdapter.LogLevel.WARN,
            "CppBridgeModelLifecycle",
            "Failed to decode $operation result: ${e.message}",
        )
        null
    }
}

/**
 * Thin generated-proto facade over the canonical model lifecycle ABI.
 *
 * Mirrors iOS [CppBridge+ModelLifecycle.swift](../../../../../../../../../../../../bindings/swift/Sources/RunAnywhere/Foundation/Bridge/Extensions/CppBridge+ModelLifecycle.swift).
 */
object CppBridgeModelLifecycle {
    fun load(request: RAModelLoadRequest): RAModelLoadResult? =
        decodeOrNull(
            ModelLoadResult.ADAPTER,
            RunAnywhereBridge.racModelLifecycleLoadProto(ModelLoadRequest.ADAPTER.encode(request)),
            "modelLifecycleLoad",
        )

    fun unload(request: ModelUnloadRequest): ModelUnloadResult? =
        decodeOrNull(
            ModelUnloadResult.ADAPTER,
            RunAnywhereBridge.racModelLifecycleUnloadProto(ModelUnloadRequest.ADAPTER.encode(request)),
            "modelLifecycleUnload",
        )

    fun currentModel(request: CurrentModelRequest): CurrentModelResult? =
        decodeOrNull(
            CurrentModelResult.ADAPTER,
            RunAnywhereBridge.racModelLifecycleCurrentModelProto(CurrentModelRequest.ADAPTER.encode(request)),
            "modelLifecycleCurrentModel",
        )

    fun snapshot(component: SDKComponent): ComponentLifecycleSnapshot? =
        decodeOrNull(
            ComponentLifecycleSnapshot.ADAPTER,
            RunAnywhereBridge.racComponentLifecycleSnapshotProto(component.value),
            "componentLifecycleSnapshot",
        )

    fun reset(): Int = RunAnywhereBridge.racModelLifecycleReset()
}

```

### Core Architecture Module: `bindings/kotlin/src/main/kotlin/com/runanywhere/sdk/foundation/bridge/extensions/CppBridgeState.kt`
```
/*
 * Copyright 2026 RunAnywhere SDK
 * SPDX-License-Identifier: Apache-2.0
 *
 * State bridge extension for C++ interop.
 *
 * Two concerns live in this object:
 *
 *  1. Centralised SDK runtime gate flags — the four volatile booleans
 *     that `CppBridge` uses to gate Phase 1 / Phase 2 initialisation.
 *     Owning them here lets future refactors split the coordinator
 *     (`CppBridge`) from the shared mutable state without churning every
 *     consumer call site.
 *
 *  2. Persisted backend state accessors — environment, base URL, API
 *     key, device ID, device-registration flag, plus init/shutdown.
 *     These read/write the global `rac_sdk_state` (non-auth state) and
 *     `rac_auth_manager` (auth state) singletons via the `racState*` /
 *     `racAuth*` JNI thunks.
 *
 * Mirrors iOS source of truth:
 *   bindings/swift/Sources/RunAnywhere/Foundation/Bridge/Extensions/
 *     CppBridge+State.swift
 *
 * This object is the canonical owner of the four runtime gate flags
 * (`isInitialized`, `servicesInitialized`, `servicesInitializing`,
 * `nativeLibraryLoaded`). `CppBridge.kt` no longer holds private
 * duplicates — its public properties delegate to the volatiles below
 * and writes inside `CppBridge.initialize()` /
 * `CppBridge.completeServicesInitialization()` /
 * `CppBridge.shutdownSuspending()` mutate this object directly under
 * the coordinator's `synchronized(lock)` guards.
 */

package com.runanywhere.sdk.foundation.bridge.extensions

import com.runanywhere.sdk.foundation.constants.SDKConstants
import com.runanywhere.sdk.infrastructure.logging.SDKLogger
import com.runanywhere.sdk.native.bridge.RunAnywhereBridge
import com.runanywhere.sdk.public.configuration.SDKEnvironment
import com.runanywhere.sdk.public.configuration.cEnvironment

/**
 * Shared SDK state used by `CppBridge`.
 *
 * On Swift, the matching `CppBridge.State` enum exposes both the
 * persisted backend state (`rac_state_*` accessors) and the runtime
 * gate flags (`_isInitialized`, etc.). Kotlin mirrors that surface
 * here.
 *
 * Thread safety: all in-memory writes use `@Volatile`. Coordination
 * across fields (e.g. clearing `servicesInitializing` on failure) must
 * still be wrapped in a synchronised block by the caller — the same
 * shape the Swift coordinator uses around its `OSAllocatedUnfairLock`.
 */
object CppBridgeState {
    private val logger = SDKLogger("CppBridgeState")

    // Runtime gate flags (Kotlin-only — Swift inlines these into
    // CppBridgeSharedState; here they live alongside the persisted
    // accessors so the future refactor can retire the duplicates in
    // CppBridge.kt without breaking callers).

    /**
     * Whether Phase 1 (synchronous core init) has completed. Mirrors
     * Swift's `_isInitialized`.
     */
    @Volatile
    var isInitialized: Boolean = false

    /**
     * Whether Phase 2 (async services init) has completed. Mirrors
     * Swift's `_servicesInitialized` flag inside `CppBridge`.
     */
    @Volatile
    var servicesInitialized: Boolean = false

    /**
     * Whether Phase 2 is currently running. Used to deduplicate
     * concurrent `initializeServices()` calls. Mirrors Swift's
     * `_servicesInitializing` flag.
     */
    @Volatile
    var servicesInitializing: Boolean = false

    /**
     * Whether the native commons library was successfully loaded by
     * `RunAnywhereBridge.ensureNativeLibraryLoaded()`. The SDK is still
     * functional for non-inference paths when this is `false`.
     */
    @Volatile
    var nativeLibraryLoaded: Boolean = false

    // Initialization / Shutdown (Swift parity)

    /**
     * Initialize the C++ state manager.
     *
     * Mirrors Swift's `CppBridge.State.initialize(environment:apiKey:baseURL:deviceId:)`
     * which calls `rac_state_initialize` followed by `rac_sdk_init` to
     * populate both the runtime state singleton and the SDK config used
     * by device registration.
     *
     * On Kotlin we don't have a separate `rac_state_initialize` JNI
     * binding yet — `racSdkInit` already populates the SDK state with
     * environment / api key / base URL / device ID, so we route through
     * it here for parity. When the dedicated state-init thunk lands a
     * follow-up can split the two calls.
     */
    fun initialize(
        environment: SDKEnvironment,
        apiKey: String,
        baseURL: String,
        deviceId: String,
    ) {
        val rc =
            RunAnywhereBridge.racSdkInit(
                environment = environment.cEnvironment,
                deviceId = deviceId.ifEmpty { null },
                platform = SDKConstants.SDK_PLATFORM,
                sdkVersion = SDKConstants.SDK_VERSION,
                apiKey = apiKey.ifEmpty { null },
                baseUrl = baseURL.ifEmpty { null },
            )
        if (rc != 0) {
            logger.warn("rac_sdk_init returned $rc during state initialize")
        }
        logger.debug("C++ state initialized")
    }

    /** Reset Kotlin-side lifetime gates after the canonical native shutdown. */
    fun shutdown() {
        CppBridgeAuth.resetInitializationState()
        reset()
    }

    // Persisted state accessors (rac_sdk_state — non-auth)

    /**
     * Current SDK environment as stored in the C++ state singleton.
     *
     * Mirrors Swift's `CppBridge.State.environment` computed property
     * which delegates to `Environment.fromC(rac_state_get_environment())`.
     */
    val environment: SDKEnvironment
        get() = CppBridgeEnvironment.fromC(RunAnywhereBridge.racStateGetEnvironment())

    /**
     * Configured backend base URL, or `null` if unset / empty.
     * Mirrors Swift's `CppBridge.State.baseURL`.
     */
    val baseURL: String?
        get() = RunAnywhereBridge.racStateGetBaseUrl()?.takeIf { it.isNotEmpty() }

    /**
     * Configured API key, or `null` if unset / empty.
     * Mirrors Swift's `CppBridge.State.apiKey`.
     */
    val apiKey: String?
        get() = RunAnywhereBridge.racStateGetApiKey()?.takeIf { it.isNotEmpty() }

    /**
     * Persistent device ID, or `null` if unset / empty.
     * Mirrors Swift's `CppBridge.State.deviceId`.
     */
    val deviceId: String?
        get() = RunAnywhereBridge.racStateGetDeviceId()?.takeIf { it.isNotEmpty() }

    /**
     * Set the device-registered flag in the C++ state singleton.
     * Mirrors Swift's `CppBridge.State.setDeviceRegistered(_:)`.
     */
    fun setDeviceRegistered(registered: Boolean) {
        RunAnywhereBridge.racStateSetDeviceRegistered(registered)
    }

    /**
     * Whether the device-registered flag is set in the C++ state singleton.
     * Mirrors Swift's `CppBridge.State.isDeviceRegistered`.
     */
    val isDeviceRegistered: Boolean
        get() = RunAnywhereBridge.racStateIsDeviceRegistered()

    // Auth state (delegated to rac_auth_manager)

    // Runtime-gate helpers

    /**
     * Reset every runtime gate flag back to its pre-init state. Used by
     * `shutdown` paths and by tests that want a clean slate between
     * cases.
     *
     * Mirrors Swift's `CppBridge.State.reset()`.
     */
    fun reset() {
        isInitialized = false
        servicesInitialized = false
        servicesInitializing = false
        nativeLibraryLoaded = false
    }

    /**
     * Convenience query that asks the native side whether `rac_init`
     * already returned success. Mirrors Swift's
     * `CppBridge.State.isInitialized` (the property — distinct from the
     * Kotlin gate flag above).
     *
     * Returns `false` when Phase 1 hasn't completed or the native
     * library isn't loaded; otherwise delegates to
     * `RunAnywhereBridge.racIsInitialized()`.
     */
    fun isNativeInitialized(): Boolean {
        if (!isInitialized || !nativeLibraryLoaded) return false
        return RunAnywhereBridge.racIsInitialized()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #983** (2026-10-02): **flutter: ship generated trees in the runanywhere pub package**
  *Symptoms*: The root .gitignore excludes lib/generated/ and the Kotlin generated dir, and pub applies it when packaging, so the published archive had none of them and consumers hit hundreds of missing-file errors. A package-level .pubignore re-includes both. package-sdk.sh now requires that exact file for runanywhere.  Tested by installing the built archive in a clean app: 2683 compile errors without the file, 0 with it.  Fixes #982  <!-- This is an auto-generated description by cubic. --> --- ## Summary by cubic Fixes the `runanywhere` pub package shipping without its codegen outputs, which caused 2683 missing-file errors for consumers. The repo-root `.gitignore` excludes `lib/generated/` and the Kotlin generated dir, and pub applies that ignore when packaging; a package-level `.pubignore` now re-includes both trees.  - Adds `.pubignore` to `bindings/flutter/packages/runanywhere/` re-including the two generated directories. - Updates `package-sdk.sh` to require that exact `.pubignore` and fail if it drifts from the generated-tree contract.  <sup>Written for commit da517ba4cc8be5cff9a64943d8d448d6f29f2be2. Summary will update on new commits.</sup>  <a href="https://cubic.dev/pr/RunanywhereAI/runanywhere-sdks/pull/983?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cu
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/983?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **R
  > @sanchitmonga22 ready for review. The failing `centralization` check is the missing runanywhere-swift 0.20.37 tag, not this change.
  > Folded into #987 (verified together: flutter melos analyze+test green, RN jest 13/13, package-sdk dry-run clean, URLSession alloc-fail contract verified in all three copies). Will be re-opened against temp/development only if #987 is rejected.

- **Issue #972** (2026-10-02): **fix(electron): reopen the preload gate before retrying auth after a host restart**
  *Symptoms*: ## Description  **Bug:** an Electron app that passes control-plane options never recovers from a utility-host crash. This means any app that calls `window.runanywhere.initialize(secureDir, baseDir, { apiKey })`. After one host exit, every later SDK call in that renderer stays pending until the app is restarted.  **Why it hangs.** `src/process/preload.ts` handles a replacement port as follows: 1. `runanywhere-host-exited` re-arms the `ready` gate. 2. The replacement-port branch posts `v3.initialize` raw. It then awaited `v3.auth.retry()` and only called `markReady()` in `.finally`. 3. `v3` is built on `RpcBackend` → `send()`, and `send()` begins with `ready.then(...)`.  So the retry waits on the gate, and the gate waits on the retry. On the new port, `v3.initialize` is the only message that is ever posted. `ready()`, `version()` and every other call stay pending. Without a control plane the branch skips the retry, so the deadlock only appears when an apiKey/baseUrl was configured.  **Fix:** open the gate as soon as the replayed `initialize` settles, then start `auth.retry()`. The retry updates the facade's control-plane state the same way it did before, and its failure is still reported through `auth.state()`. Behavior without a control plane is unchanged: the gate opens after the replayed `initialize`, exactly as before.  ## Type of Change - [x] Bug fix - [ ] New feature - [ ] Documentation update - [ ] Refactoring  ## Testing - [x] Lint passes locally. The Electron package h
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/972"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL > 
  > CodeRabbit nitpick on `preload.test.ts` 415-416 (assert `v3.auth.retry`): applied in 72486fc79. The control-plane case now enables the control plane (with `baseUrl` and `hasControlPlane: true`) and asserts that `v3.retryControlPlane` is posted to the replacement host. It fails when the restart retry is removed and passes with the fix. Electron unit suite 243/243, typecheck clean.  @coderabbitai review
  > <!-- This is an auto-generated reply by CodeRabbit --> <!-- CodeRabbit review command invocation: v2:eb39e6fe9daed5fef3cb1b936a593292d8484a46d9617d550342dc9f51c760da --> <details> <summary>⚠️ Action not completed</summary>  Already reviewed the last commit. Use `@coderabbitai full review` to rerun a review of the entire changeset.  > Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits. This command is applicable only when automatic reviews are paused.  </details>

- **Issue #971** (2026-10-02): **fix(electron): validate resumed download content ranges**
  *Symptoms*: ## Description When downloadFile() resumes a .part file, it sends a Range request. Previously, a 206 Partial Content response was appended without validating its Content-Range, so a response for a different byte offset or representation could corrupt the downloaded model.  This change validates the byte range, requested offset, range bounds, and Content-Length when present. Completion is checked against the representation total. Incomplete contiguous responses remain resumable but are not published, and excess bytes beyond the declared range are removed before returning an error.  Reviewer focus: verify that malformed or misaligned range metadata is rejected and that incomplete or overlong responses cannot be finalized as a complete model.  ## Type of Change - [x] Bug fix - [ ] New feature - [ ] Documentation update - [ ] Refactoring  ## Testing - [ ] Lint passes locally — the Electron package has no lint script. - [x] Added/updated tests for changes  Passed: npm run build, npm run typecheck, and npm test (247 tests, including the new range regressions).  ### Platform-Specific Testing (check all that apply) This change is covered by the Electron package's local HTTP unit tests; it does not change any of the listed mobile or browser sample apps. **Swift SDK / iOS Sample:** - [ ] Tested on iPhone (Simulator or Device) - [ ] Tested on iPad / Tablet - [ ] Tested on Mac (macOS target)  **Kotlin SDK / Android Sample:** - [ ] Tested on Android Phone (Emulator or Device) - [ ] Tested
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/971"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL > 
  > Folded into #986 (verified together: Electron 311 tests, Web 253 tests, Python 456 tests, macOS ctest 100/101 green). Will be re-opened against temp/development only if #986 is rejected.

- **Issue #956** (2026-10-02): **Preserve registration metadata across SDKs**
  *Symptoms*: ## Summary - Preserve download size, context length, source, and description across React Native URL, archive, and multi-file registration. - Add equivalent registration metadata and read-back behavior for Web, Electron, and Python. - Use the generated `ModelSource` contract in Electron. - Keep Python physical file size distinct from declared download size. - Validate explicit Web model-source values before registration.  Fixes #857  ## Validation - Electron build and type checking passed; 241 unit tests passed. - Web type checking, build, module-resolution verification, lint, and 253 unit tests passed. - Python focused runtime suite passed 28 tests. - Python full suite: 517 passed and 23 skipped; one source-checkout-only version assertion requires installed package metadata. - Diff whitespace validation passed.  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **New Features**   - Model registration now supports download size, context length, source, description, and optional names across supported SDKs.   - Registered model details can be retrieved even when models are not part of the catalog.   - Model source types are publicly available for Electron and Python integrations.   - React Native registration supports additional metadata for local files and archives.  - **Bug Fixes**   - Web registration now rejects invalid model source values with a clear validation error.   - Model metadata is preserved consistently durin
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/956#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/956#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review
  > Addressed in a55a84d; the follow-up review reports no actionable CodeRabbit findings. Resolving the addressed CodeRabbit threads.
  > Folded into #986 (verified together: Electron 311 tests, Web 253 tests, Python 456 tests, macOS ctest 100/101 green). Will be re-opened against temp/development only if #986 is rejected.

- **Issue #946** (2026-10-02): **fix(electron): validate Win32 file reads**
  *Symptoms*: ## Summary  - Validate both Win32 seek operations before using the file size or reading. - Reject file sizes that cannot be represented by `size_t` before conversion. - Preserve successful reads for empty files with an owned, freeable buffer and a logical size of zero. - Reuse the validated size for reading, comparison, and output.  ## Validation  - Focused Windows x64 C++20 syntax compilation - Electron package build - Electron package type checking - Electron unit suite: 241 passed - Diff whitespace validation  Fixes #904  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Improved file reading reliability on Windows by handling file-positioning failures.   * Prevented oversized files from causing invalid memory allocation attempts.   * Empty files can now be read successfully and correctly return zero bytes.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/946#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/946#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review
  > Folded into #986 (verified together: Electron 311 tests, Web 253 tests, Python 456 tests, macOS ctest 100/101 green). Will be re-opened against temp/development only if #986 is rejected.

- **Issue #942** (2026-10-02): **fix(desktop bindings): report secure-set close failures (#903)**
  *Symptoms*: ## Description  Follow-up to #794. Resolves #903: Make the Electron and Python POSIX/Win32 platform adapters report `RAC_ERROR_SECURE_STORAGE_FAILED` when `fclose()` or `::close()` fails after writing out the secure key blob.  This accounts for delayed writeback and disk-full errors reported during close and matches the canonical Commons desktop adapter behavior (`core/src/desktop/desktop_secure_store.cpp`), preventing silent persistence failures where stdio/kernel buffer flush errors during close leave truncated or empty secrets on disk (such as the persisted device identity UUID).  Closes #903.  ## Type of Change  - [x] Bug fix - [ ] New feature - [ ] Documentation update - [ ] Refactoring  ## Testing  - [x] `git diff --check` - [x] Parity verified across all 4 desktop platform adapter implementations (Electron and Python x POSIX and Win32) and with `core/src/desktop/desktop_secure_store.cpp` - [x] Docstrings added for 100% coverage of touched and neighboring secure store adapter functions - [ ] Added/updated unit tests — not requested for this change (native OS `close()` / `fclose()` failure injection requires LD_PRELOAD/filesystem fault injection not available in desktop adapter unit test harness, matching PR #794)  ## Checklist  - [x] Code follows project style guidelines - [x] Self-review completed - [x] Full Doxygen docstring coverage for all touched adapter functions - [x] Documentation updated (if needed)  ## Labels  - bug - desktop 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/942#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/942#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review
  > Folded into #986 (verified together: Electron 311 tests, Web 253 tests, Python 456 tests, macOS ctest 100/101 green). Will be re-opened against temp/development only if #986 is rejected.

- **Issue #941** (2026-10-02): **fix(embeddings): honour normalize=false in ONNX and reject in QHexRT (#918)**
  *Symptoms*: ## Description Follow-up to #841. Addresses #918: - In \engines/onnx/onnx_embedding_provider.cpp\ and \onnx_embedding_provider.h\, allow callers to request unnormalized embeddings via \ ormalize = true/false\. When \ ormalize = false\ (\RAC_EMBEDDINGS_NORMALIZE_NONE\), \ ormalize_vector(pooled)\ is skipped in \embed\, \embed_batch\, and \embed_sub_batch\. - In \engines/onnx/rac_onnx_embeddings_register.cpp\, derive \ ormalize = options == nullptr || options->normalize != RAC_EMBEDDINGS_NORMALIZE_NONE\ and pass to provider's \embed()\ and \embed_batch()\. - In \engines/qhexrt/qhexrt_embeddings_ops.cpp\, explicitly reject \options != nullptr && options->normalize == RAC_EMBEDDINGS_NORMALIZE_NONE\ with \RAC_ERROR_NOT_SUPPORTED\ and log an informative error message, as the baked DSP/HTP model graph produces unit-length vectors. - In \indings/electron/test/feature/embeddings.feature.test.ts\, update the test assertion for \ ormalize: 'NONE'\ to verify non-unit magnitude (unnormalized vector) now that ONNX honours the flag.  Closes #918.  ## Type of Change - [x] Bug fix - [ ] New feature - [ ] Documentation update - [ ] Refactoring  ## Testing - [x] Lint passes locally - [x] Added/updated tests for changes  ## Checklist - [x] Code follows project style guidelines - [x] Self-review completed - [x] Documentation updated (if needed)  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  - **New Features**   - ONNX embedding generation no
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/941#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/941#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `96eb1231-4f6a-4f35-8959-acd3867930e9`  
  > Folded into #986 (verified together: Electron 311 tests, Web 253 tests, Python 456 tests, macOS ctest 100/101 green). Will be re-opened against temp/development only if #986 is rejected.

- **Issue #933** (2026-10-02): **fix(bindings): surface directory iterator errors**
  *Symptoms*: ## Description  - Mirror the core desktop adapter's structured filesystem-error mapping in all four Electron and Python directory-listing adapters. - Return mapped errors from both the directory probe and iteration instead of reporting failures as missing directories or successful partial listings.  Fixes #890  ## Type of Change  - [x] Bug fix - [ ] New feature - [ ] Documentation update - [ ] Refactoring  ## Testing  - [ ] Lint passes locally (clang-format is unavailable on this host) - [ ] Added/updated tests for changes (no new test work requested) - [x] git diff --check - [x] C++20 syntax compilation for both Win32 adapter translation units - [ ] POSIX syntax compilation (no POSIX toolchain or WSL distribution is installed on this host)  ## Checklist  - [x] Code follows project style guidelines - [x] Self-review completed - [x] Documentation updated (not needed)  ## Screenshots  Not applicable; native error-handling change only.  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **Bug Fixes**   - Improved directory-listing error reporting across supported platforms.   - Missing paths, permission failures, and storage exhaustion now return more specific errors.   - Directory checks no longer incorrectly classify probe failures as missing directories.   - Errors encountered while reading directory contents are no longer treated as successful completion.  <!-- end of auto-generated comment: release notes by coderabbit.ai 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/933#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/933#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review
  > Hey @sanchitmonga22, please rerun the failed `swift-spm` check when you get time.  The GitHub-hosted runner failed while downloading `nlohmann/json` because it couldn’t resolve `github.com` through DNS:  ```text fatal: unable to access 'https://github.com/nlohmann/json.git/': Could not resolve host: github.com ```  All other checks passed, so this appears to be a transient runner network issue rather than a code failure. Thanks!
  > Folded into #986 (verified together: Electron 311 tests, Web 253 tests, Python 456 tests, macOS ctest 100/101 green). Will be re-opened against temp/development only if #986 is rejected.

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

### Incident Patch 1: `46654ef7` (2026-09-22)
**Commit Message**: fix(server): support local coding harness tool conversations (#964)

* server: restore published context configuration and CMake target

* fix(server): preserve local harness conversations and structured tool streams

* fix(kit): restore local harness build prerequisites

Bring the public desktop kit presets, Linux packaging, and shared llama.cpp log callback from release/v0.20.37 onto main so regenerated kits retain the features already required by Wally. Restores release changes 057c226977, a49575e100, and 992dc54e7c without changing versions or schema pins.

* ci: document restored desktop backend configuration boundary

* Preserve raw MLX tool-call text for commons parsing

* fix(mlx): preserve framed protocols and usage at text stops

* test: run local server regressions in debug and sanitizer CI

* test(mlx): verify cancellation usage and fix kit thread dependency

* commons: demote unsupported capability logs

* swift: close MLX streaming regressions

* llamacpp: route startup logs before initialization

* kit: export Linux Sherpa runtime

* test: allow tool loop regressions to finish

* feat: add structured prompt caching

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* build:

**File**: `.github/workflows/cpp-desktop-kit.yml` (modified, +41/-1)
```diff
@@ -118,6 +118,45 @@ jobs:
             dist/RunAnywhere-cpp-desktop-windows-x64-v*.tar.gz.sha256
           if-no-files-found: error
 
+  linux-x64:
+    runs-on: ubuntu-24.04
+    timeout-minutes: 90
+    steps:
+      - uses: actions/checkout@v4
+      - name: Install build deps
+        run: |
+          set -euo pipefail
+          sudo apt-get update
+          # No libprotobuf-dev: Ubuntu 24.04 ships protobuf 3.21, which is
+          # below RAC_PROTOBUF_MIN_VERSION=5.0 and would register a system
+          # IMPORTED protobuf::libprotobuf before FetchContent can add its
+          # own ALIAS (see the linux-debug job in pr-build.yml). Leaving it
+          # out forces the vendored FetchContent path cleanly.
+          sudo apt-get install -y ninja-build libcurl4-openssl-dev
+      - name: Sherpa-ONNX prebuilts (required for a ROUTABLE sherpa backend)
+        run: bash core/scripts/linux/download-sherpa-onnx.sh
+      - name: Configure + package
+        run: |
+          set -euo pipefail
+          cmake --preset cpp-desktop-linux-x64
+          cmake --build --preset cpp-desktop-linux-x64 --target package-cpp-desktop-tarball \
+            -j "$(nproc)"
+          ls -la dist/RunAnywhere-cpp-desktop-linux-x64-v*.tar.gz
+          tar=$(echo dist/RunAnywhere-cpp-desktop-linux-x64-v*.tar.gz)
+          python3 scripts/ci/verify_cpp_desktop_kit.py "$tar" --source-root . --linux --forbid-private-engines
+          (
+            cd dist
+            name="RunAnywhere-cpp-desktop-linux-x64-v$(tr -d '[:space:]' < ../core/VERSION).tar.gz"
+            sha256sum "$name" | tee "$name.sha256"
+          )
+      - uses: actions/upload-artifact@v4
+        with:
+          name: cpp-desktop-linux-x64
+          path: |
+            dist/RunAnywhere-cpp-desktop-linux-x64-v*.tar.gz
+            dist/RunAnywhere-cpp-desktop-linux-x64-v*.tar.gz.sha256
+          if-no-files-found: error
+
   windows-arm64:
     runs-on: windows-11-arm
     timeout-minutes: 90
@@ -255,7 +294,7 @@ jobs:
 
   attach-release:
     if: github.event_name == 'workflow_dispatch' && inputs.attach_tag != ''
-    needs: [macos-arm64, windows-x64, windows-arm64]
+    needs: [macos-arm64, windows-x64, windows-arm64, linux-x64]
     runs-on: ubuntu-24.04
     permissions:
       contents: write
@@ -278,4 +317,5 @@ jobs:
             artifacts/RunAnywhere-cpp-desktop-macos-arm64-v*.tar.gz* \
             artifacts/RunAnywhere-cpp-desktop-windows-x64-v*.tar.gz* \
             artifacts/RunAnywhere-cpp-desktop-windows-arm64-v*.tar.gz* \
+            artifacts/RunAnywhere-cpp-desktop-linux-x64-v*.tar.gz* \
             --repo "${{ github.repository }}" --clobber
```

**File**: `.github/workflows/pr-build.yml` (modified, +9/-3)
```diff
@@ -125,11 +125,17 @@ jobs:
       - name: Install ninja + protobuf
         run: brew install ninja protobuf
       - name: Configure
-        run: cmake --preset macos-debug
+        run: cmake --preset macos-debug -DRAC_BUILD_SERVER=ON
       - name: Build
         run: cmake --build --preset macos-debug
       - name: Test
         run: ctest --preset macos-debug
+      - name: MLX raw text stop regressions (no model required)
+        run: |
+          swiftc bindings/swift/Sources/MLXRuntime/MLXTextStopFilter.swift \
+            bindings/swift/Tests/MLXRuntimeStandalone/MLXTextStopFilterTests.swift \
+            -o "$RUNNER_TEMP/mlx-text-stop-tests"
+          "$RUNNER_TEMP/mlx-text-stop-tests"
 
   macos-release:
     # Keep the release compile on the canonical Apple toolchain too. Metal is
@@ -158,7 +164,7 @@ jobs:
       - uses: actions/checkout@v7
       - name: Install ninja
         run: sudo apt-get update && sudo apt-get install -y ninja-build
-      - run: cmake --preset linux-debug
+      - run: cmake --preset linux-debug -DRAC_BUILD_SERVER=ON
       - run: cmake --build --preset linux-debug
       - run: ctest --preset linux-debug
 
@@ -167,7 +173,7 @@ jobs:
     steps:
       - uses: actions/checkout@v7
       - run: sudo apt-get update && sudo apt-get install -y ninja-build
-      - run: cmake --preset linux-asan
+      - run: cmake --preset linux-asan -DRAC_BUILD_SERVER=ON
       - run: cmake --build --preset linux-asan
       - run: ctest --preset linux-asan
 
```

**File**: `CMakePresets.json` (modified, +29/-3)
```diff
@@ -103,7 +103,7 @@
                 "RAC_RUNTIME_ONNXRT": "ON",
                 "RAC_RUNTIME_COREML": "ON",
                 "RAC_BACKEND_RAG": "ON",
-                "RAC_BUILD_SERVER": "OFF",
+                "RAC_BUILD_SERVER": "ON",
                 "RAC_STATIC_PLUGINS": "ON",
                 "RAC_BUILD_SHARED": "OFF",
                 "RAC_BUILD_PLATFORM": "ON",
@@ -132,13 +132,38 @@
                 "RAC_BACKEND_QHEXRT": "OFF",
                 "RAC_RUNTIME_ONNXRT": "ON",
                 "RAC_BACKEND_RAG": "OFF",
-                "RAC_BUILD_SERVER": "OFF",
+                "RAC_BUILD_SERVER": "ON",
                 "RAC_STATIC_PLUGINS": "ON",
                 "RAC_BUILD_SHARED": "OFF",
                 "RAC_BUILD_PLATFORM": "OFF"
             },
             "condition": { "type": "equals", "lhs": "${hostSystemName}", "rhs": "Windows" }
         },
+        {
+            "name": "cpp-desktop-linux-x64",
+            "displayName": "C++ desktop kit — Linux x64 (no CLI)",
+            "inherits": "base-release",
+            "cacheVariables": {
+                "CMAKE_SYSTEM_PROCESSOR": "x86_64",
+                "RAC_BUILD_CLI": "OFF",
+                "RAC_PACKAGE_CPP_DESKTOP": "ON",
+                "RAC_DESKTOP_ADAPTER": "ON",
+                "RAC_BUILD_BACKENDS": "ON",
+                "RAC_BACKEND_LLAMACPP": "ON",
+                "RAC_BACKEND_SHERPA": "ON",
+                "RAC_BACKEND_ONNX": "ON",
+                "RAC_BACKEND_MLX": "OFF",
+                "RAC_BACKEND_NEURT": "OFF",
+                "RAC_BACKEND_QHEXRT": "OFF",
+                "RAC_RUNTIME_ONNXRT": "ON",
+                "RAC_BACKEND_RAG": "ON",
+                "RAC_BUILD_SERVER": "ON",
+                "RAC_STATIC_PLUGINS": "ON",
+                "RAC_BUILD_SHARED": "OFF",
+                "RAC_BUILD_PLATFORM": "OFF"
+            },
+            "condition": { "type": "equals", "lhs": "${hostSystemName}", "rhs": "Linux" }
+        },
         {
             "name": "cpp-desktop-macos-arm64-neurt",
             "displayName": "C++ desktop overlay — macOS arm64 NeuRT (private)",
@@ -173,7 +198,7 @@
                 "RAC_BACKEND_QHEXRT": "OFF",
                 "RAC_RUNTIME_ONNXRT": "OFF",
                 "RAC_BACKEND_RAG": "OFF",
-                "RAC_BUILD_SERVER": "OFF",
+                "RAC_BUILD_SERVER": "ON",
                 "RAC_STATIC_PLUGINS": "ON",
                 "RAC_BUILD_SHARED": "OFF",
                 "RAC_BUILD_PLATFORM": "OFF"
@@ -431,6 +456,7 @@
         { "name": "linux-asan",       "configurePreset": "linux-asan" },
         { "name": "cpp-desktop-macos-arm64", "configurePreset": "cpp-desktop-macos-arm64", "targets": ["package-cpp-desktop-tarball"] },
         { "name": "cpp-desktop-windows-x64", "configurePreset": "cpp-desktop-windows-x64", "targets": ["package-cpp-desktop-tarball"], "configuration": "Release" },
+        { "name": "cpp-desktop-linux-x64", "configurePreset": "cpp-desktop-linux-x64", "targets": ["package-cpp-desktop-tarball"] },
         { "name": "cpp-desktop-macos-arm64-neurt", "configurePreset": "cpp-desktop-macos-arm64-neurt" },
         { "name": "cpp-desktop-windows-arm64", "configurePreset": "cpp-desktop-windows-arm64", "targets": ["package-cpp-desktop-tarball"], "configuration": "Release" },
         { "name": "cpp-desktop-windows-arm64-qhexrt", "configurePreset": "cpp-desktop-windows-arm64-qhexrt", "configuration": "Release" },
```

**File**: `bindings/electron/test/unit/generation-metrics.test.ts` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ import { toPublicVlmMetrics } from '../../dist/api/vlm-abi';
 
 const FULL_USAGE: TokenUsage = {
   inputTokens: 12,
+  cachedInputTokens: 8,
   outputTokens: 34,
   totalTokens: 46,
   decodeTokensPerSecond: 57.5,
```

**File**: `bindings/swift/Sources/MLXRuntime/MLX.swift` (modified, +659/-25)
```diff
@@ -112,6 +112,7 @@ public enum MLX {
         callbacks.cleanup = mlxCleanup
         callbacks.destroy = mlxDestroy
         callbacks.user_data = nil
+        callbacks.llm_generate_chat_stream = nil
 
         let clearCancelResult = ra_mlx_set_clear_cancel_callback(mlxClearCancellation, nil)
         guard clearCancelResult == RAC_SUCCESS else {
@@ -127,6 +128,13 @@ public enum MLX {
             return false
         }
 
+        let chatCallbackResult = ra_mlx_set_chat_callback(mlxLLMGenerateChat, nil)
+        guard chatCallbackResult == RAC_SUCCESS else {
+            let message = String(cString: rac_error_message(chatCallbackResult))
+            logger.error("MLX structured chat registration failed: \(message)")
+            return false
+        }
+
         let registerResult = rac_backend_mlx_register()
         if registerResult != RAC_SUCCESS && registerResult != RAC_ERROR_MODULE_ALREADY_REGISTERED {
             let message = String(cString: rac_error_message(registerResult))
@@ -144,6 +152,7 @@ public enum MLX {
     public static func unregister() {
         guard isRegistered else { return }
         _ = rac_backend_mlx_unregister()
+        _ = ra_mlx_set_chat_callback(nil, nil)
         isRegistered = false
         logger.info("MLX backend unregistered")
     }
@@ -271,6 +280,7 @@ private struct TransformersTokenizerBridge: MLXLMCommon.Tokenizer {
 private struct MLXGenerationMetrics {
     var promptTokens = 0
     var completionTokens = 0
+    var cachedPromptTokens = 0
     var totalTimeMs: Int64 = 0
     var tokensPerSecond: Float = 0
 }
@@ -282,23 +292,23 @@ private struct MLXSTTOutput {
 }
 
 private struct MLXLLMOptionsSnapshot: Sendable {
-    let maxTokens: Int32
-    let temperature: Float
-    let topP: Float
-    let topK: Int32
-    let minP: Float
-    let repetitionPenalty: Float
-    let presencePenalty: Float
-    let frequencyPenalty: Float
-    let seed: Int64
-    let disableThinking: Bool
+    var maxTokens: Int32
+    var temperature: Float
+    var topP: Float
+    var topK: Int32
+    var minP: Float
+    var repetitionPenalty: Float
+    var presencePenalty: Float
+    var frequencyPenalty: Float
+    var seed: Int64
+    var disableThinking: Bool
     /// System prompt (options.system_prompt); nil when NULL/empty. MLX used to
     /// ignore this, so the model never saw the system instruction.
-    let systemPrompt: String?
+    var systemPrompt: String?
     /// Prior conversation turns (options.history/n_history), alternating
     /// user,assistant in chronological order (commons-normalized). MLX used to
     /// ignore these, so the model had no memory across turns.
-    let history: [String]
+    var history: [String]
 
     init(_ options: UnsafePointer<rac_llm_options_t>?) {
         guard let options = options?.pointee else {
@@ -341,6 +351,76 @@ private struct MLXLLMOptionsSnapshot: Sendable {
             history = []
         }
     }
+
+    init(_ view: ra_mlx_chat_options_view_t) {
+        self.init(nil)
+        if view.has_max_output_tokens == RAC_TRUE {
+            maxTokens = view.max_output_tokens
+        }
+        if view.has_temperature == RAC_TRUE {
+            temperature = view.temperature
+        }
+        if view.has_top_p == RAC_TRUE {
+            topP = view.top_p
+        }
+        if view.has_top_k == RAC_TRUE {
+            topK = view.top_k
+        }
+        if view.has_repeat_penalty == RAC_TRUE {
+            repetitionPenalty = view.repeat_penalty
+        }
+        if view.has_seed == RAC_TRUE {
+            seed = view.seed
+        }
+        if view.has_frequency_penalty == RAC_TRUE {
+            frequencyPenalty = view.frequency_penalty
+        }
+        if view.has_presence_penalty == RAC_TRUE {
+            presencePenalty = view.presence_penalty
+        }
+        if view.has_min_p == RAC_TRUE {
+            minP = view.min_p
+        }
+        systemPrompt = string(from: view.system_prompt)
+        disableThinking = view.disable_thinking == RAC_TRUE
+    }
+}
+
+private struct MLXChatToolResultSnapshot: Equatable, Sendable {
+    var id = ""
+    var name = ""
+    var resultJSON = ""
+    var error = ""
+    var isError = false
+}
+
+private struct MLXChatMessageSnapshot: Equatable, Sendable {
+    var role: Chat.Message.Role
+    var content = ""
+    var name = ""
+    var toolCallID = ""
+    var toolCalls: [ToolCall] = []
+    var toolResult: MLXChatToolResultSnapshot?
+    var hasAttachments = false
+}
+
+private struct MLXChatToolDefinitionSnapshot: Equatable, Sendable {
+    var name = ""
+    var description = ""
+    var parametersJSON = "{}"
+}
+
+private struct MLXStructuredRequestSnapshot: Sendable {
+    let modelID: String
+    let options: MLXLLMOptionsSnapshot
+    let messages: [MLXChatMessageSnapshot]
+    let tools: [MLXChatToolDefinitionSnapshot]
+}
+
+private enum MLXStructuredBridgeError: Error {
+    case invalidRequest
+    case unsupportedMessageRole
+    case unsupportedA
```

**File**: `bindings/swift/Sources/MLXRuntime/MLXTextStopFilter.swift` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import Foundation
+
+/// Preserve model-defined textual terminators while passing generated text,
+/// including tool-call framing, unchanged to the commons ABI consumer.
+struct MLXTextStopFilter {
+    let stops: [String]
+    private var pending = ""
+    private(set) var stopped = false
+
+    init(stopStrings: Set<String>) {
+        stops = stopStrings.filter { !$0.isEmpty }
+    }
+
+    mutating func process(_ chunk: String) -> String {
+        guard !stopped else { return "" }
+        pending += chunk
+        let ranges = stops.compactMap { pending.range(of: $0) }
+        if let first = ranges.min(by: { $0.lowerBound < $1.lowerBound }) {
+            let text = String(pending[..<first.lowerBound])
+            pending = ""
+            stopped = true
+            return text
+        }
+        var held = 0
+        for stop in stops {
+            let pendingScalars = pending.unicodeScalars
+            let stopScalars = stop.unicodeScalars
+            let limit = min(pendingScalars.count, stopScalars.count - 1)
+            if limit > held {
+                for size in stride(from: limit, through: held + 1, by: -1)
+                    where pendingScalars.suffix(size).elementsEqual(stopScalars.prefix(size)) {
+                    held = size
+                    break
+                }
+            }
+        }
+        let end = pending.unicodeScalars.index(pending.unicodeScalars.endIndex, offsetBy: -held)
+        let text = String(pending[..<end])
+        pending = String(pending[end...])
+        return text
+    }
+
+    mutating func finish() -> String {
+        defer { pending = "" }
+        return stopped ? "" : pending
+    }
+}
```

**File**: `bindings/swift/Sources/MLXRuntime/include/MLXBackend.h` (modified, +1/-0)
```diff
@@ -7,5 +7,6 @@
 #define MLX_BACKEND_H
 
 #include "rac_mlx.h"
+#include "rac/backends/rac_mlx_chat_bridge.h"
 
 #endif /* MLX_BACKEND_H */
```

**File**: `bindings/swift/Tests/MLXRuntimeStandalone/MLXCancellationUsageTests.swift` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+// No weights, downloads, or network: exercise the pinned MLX generation loop
+// with deterministic tokens and a tiny synthetic tensor model.
+import Foundation
+import MLX
+import MLXLMCommon
+import MLXNN
+
+private struct DeterministicTokenizer: Tokenizer {
+  var bosToken: String? { nil }
+  var eosToken: String? { nil }
+  var unknownToken: String? { nil }
+  func encode(text: String, addSpecialTokens: Bool) -> [Int] { [] }
+  func decode(tokenIds: [Int], skipSpecialTokens: Bool) -> String {
+    tokenIds.map { UnicodeScalar($0).map(String.init) ?? "\u{FFFD}" }.joined()
+  }
+  func convertTokenToId(_ token: String) -> Int? { nil }
+  func convertIdToToken(_ id: Int) -> String? { nil }
+  func applyChatTemplate(
+    messages: [[String: any Sendable]],
+    tools: [[String: any Sendable]]?,
+    additionalContext: [String: any Sendable]?
+  ) throws -> [Int] { [] }
+}
+private struct DelayedTokens: TokenIteratorProtocol {
+  let maxTokens: Int? = 1000
+  var tokenCount = 0
+  let promptPrefillTime: TimeInterval = 0
+  mutating func next() -> Int? {
+    guard tokenCount < 1000 else { return nil }
+    Thread.sleep(forTimeInterval: 0.005)
+    tokenCount += 1
+    return 120
+  }
+}
+private final class ScriptedModel: Module, LanguageModel, KVCacheDimensionProvider {
+  var kvHeads: [Int] { [] }
+  func prepare(
+    _ input: LMInput, cache: [KVCache], state: LMOutput.State?, prefill: PrefillParameters
+  ) throws -> PrepareResult {
+    .tokens(input.text)
+  }
+  func callAsFunction(_ inputs: MLXArray, cache: [KVCache]?) -> MLXArray {
+    Thread.sleep(forTimeInterval: 0.005)
+    let tokens = inputs.asArray(Int.self)
+    var logits = [Float](repeating: -100, count: tokens.count * 128)
+    let next: [Int: Int] = [
+      1: 97, 97: 98, 98: 60, 60: 69, 69: 78, 78: 68, 68: 62, 62: 120, 120: 120
+    ]
+    for (index, token) in tokens.enumerated() { logits[index * 128 + (next[token] ?? 120)] = 100 }
+    return MLXArray(logits, [1, tokens.count, 128])
+  }
+}
+@main
+struct CancellationUsageRegression {
+  static func main() async throws {
+    try await Device.withDefaultDevice(.cpu) {
+      let (events, producer) = generateTask(
+        promptTokenCount: 37,
+        modelConfiguration: ModelConfiguration(id: "hermetic/cancellation"),
+        tokenizer: DeterministicTokenizer(),
+        iterator: DelayedTokens()
+      )
+      var chunks = 0
+      var info: GenerateCompletionInfo?
+      for await event in events {
+        switch event {
+        case .chunk:
+          chunks += 1
+          producer.cancel()
+        case .info(let completion): info = completion
+        default: preconditionFailure("unexpected tool event")
+        }
+      }
+      await producer.value
+      precondition(chunks > 0 && chunks < 1000)
+      precondition(info?.promptTokenCount == 37)
+      precondition(info?.generationTokenCount == chunks)
+      guard case .cancelled = info?.stopReason else {
+        fatalError("missing cancellation terminal info")
+      }
+      let cancellationResult =
+        "Pinned MLX generateLoopTask: cancellation retained prompt=37 completion=\(chunks), final info received\n"
+      FileHandle.standardOutput.write(Data(cancellationResult.utf8))
+
+      let iterator = try TokenIterator(
+        input: LMInput(tokens: MLXArray([Int](repeating: 1, count: 37))),
+        model: ScriptedModel(),
+        parameters: GenerateParameters(maxTokens: 1000, temperature: 0)
+      )
+      let (rawEvents, rawProducer) = generateTokenTask(
+        promptTokenCount: 37,
+        modelConfiguration: ModelConfiguration(id: "hermetic/raw-cancellation"),
+        tokenizer: DeterministicTokenizer(),
+        iterator: iterator
+      )
+      var stopFilter = MLXTextStopFilter(stopStrings: ["<END>"])
+      var output = ""
+      var rawTokenCount = 0
+      var rawInfo: GenerateCompletionInfo?
+      for await event in rawEvents {
+        switch event {
+        case .token(let token):
+          rawTokenCount += 1
+          guard !stopFilter.stopped else { continue }
+          output += stopFilter.process(UnicodeScalar(token).map(String.init) ?? "\u{FFFD}")
+          if stopFilter.stopped { rawProducer.cancel() }
+        case .info(let completion): rawInfo = completion
+        }
+      }
+      await rawProducer.value
+      precondition(output == "ab")
+      precondition(stopFilter.stopped)
+      precondition(rawInfo?.promptTokenCount == 37)
+      precondition(rawInfo?.generationTokenCount == rawTokenCount)
+      precondition(rawTokenCount >= 7 && rawTokenCount < 1000)
+      guard case .cancelled = rawInfo?.stopReason else { fatalError("missing raw terminal info") }
+      let stopResult =
+        "Pinned MLX raw generation: textual stop retained prompt=37 completion=\(rawTokenCount), output=ab, no tail\n"
+      FileHandle.standardOutput.write(Data(stopResult.utf8))
+    }
+  }
+}
```

---

### Incident Patch 2: `067778a3` (2026-09-11)
**Commit Message**: fix(rn-sdk): use ensureServicesReadyOrIgnore in refreshModelRegistry (#858)

Fixes #852. When ensureServicesReady() rejects (services init fails),
the native refreshModelRegistry() call was never reached, unlike Swift
(try?) and Kotlin (catch-and-continue) which still rescan locally.

Change ensureServicesReady() to ensureServicesReadyOrIgnore() (already
imported and used by listModels/getModel in the same file) so the native
refresh runs even when services init fails.

The function is non-throwing by contract (matches Swift parity comment)
and the catch block already handles errors gracefully.

**File**: `bindings/react-native/packages/core/src/Public/Extensions/Models/RunAnywhere+ModelRegistry.ts` (modified, +1/-1)
```diff
@@ -1061,7 +1061,7 @@ export async function refreshModelRegistry(
   } = options;
   const native = requireNativeModule();
   try {
-    await ensureServicesReady();
+    await ensureServicesReadyOrIgnore();
     await native.refreshModelRegistry(
       includeRemoteCatalog,
       rescanLocal,
```

---

### Incident Patch 3: `7d5a168c` (2026-09-11)
**Commit Message**: fix(cloud): decorate g_cloud_stt_ops so it resolves across the DLL boundary (#764)

* fix(cloud): decorate g_cloud_stt_ops so it resolves across the DLL boundary

runanywhere_cloud compiles rac_plugin_entry_cloud.cpp and takes the address of
g_cloud_stt_ops, which rac_backend_cloud defines. That is a cross-image DATA
reference, and MSVC only resolves those when the declaration carries
__declspec(dllimport), so the carrier failed with LNK2001 and cloud had to be
left out of the Windows build.

llamacpp and onnx already solve this with RAC_LLAMACPP_API / RAC_ONNX_API. Add
the same macro for cloud and set its export side on rac_backend_cloud only, so
runanywhere_cloud sees dllimport.

rac_cloud_api.h goes under include/ rather than beside the sources, where
rac_onnx_api.h sits, because the carrier's include path is engines/cloud/include
only and a header at the engine root would be invisible to the one target that
needs the dllimport side.

* fix(cloud): give the g_cloud_stt_ops definition explicit external linkage

MinGW g++ rejected the previous commit:

  rac_stt_cloud.cpp:513:43: error: external linkage required for symbol
  'g_cloud_stt_ops' because of 'dllexport' attribute

A co

**File**: `engines/cloud/CMakeLists.txt` (modified, +3/-0)
```diff
@@ -75,6 +75,9 @@ rac_add_engine_plugin(cloud
     ${_CLOUD_SHARED_ONLY_ARG}
     SOURCES             ${CLOUD_BACKEND_SOURCES}
     LINK_LIBRARIES      nlohmann_json::nlohmann_json
+    # Export side of RAC_CLOUD_API. Set on this target ONLY: runanywhere_cloud
+    # compiles rac_plugin_entry_cloud.cpp too and must see the dllimport side.
+    COMPILE_DEFINITIONS RAC_CLOUD_BUILDING
     INCLUDE_DIRECTORIES ${CMAKE_CURRENT_SOURCE_DIR}
                         ${CMAKE_CURRENT_SOURCE_DIR}/include
                         ${RAC_COMMONS_ROOT_DIR}/include
```

**File**: `engines/cloud/include/rac/backends/rac_cloud_api.h` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+/**
+ * @file rac_cloud_api.h
+ * @brief Export/import decoration for symbols the cloud engine publishes to its
+ *        thin carrier.
+ *
+ * Peer of RAC_ONNX_API (engines/onnx/rac_onnx_api.h) and RAC_LLAMACPP_API.
+ *
+ * When building rac_backend_cloud: dllexport / default visibility.
+ * When the thin runanywhere_cloud carrier links that DLL on Windows: dllimport
+ * — MANDATORY for the DATA symbol g_cloud_stt_ops, because MSVC cannot fix up a
+ * cross-image data reference the way it can synthesize a function thunk.
+ * RAC_USING_SHARED is the INTERFACE define from shared rac_commons.
+ *
+ * RAC_CLOUD_BUILDING must therefore be set on rac_backend_cloud ONLY — never on
+ * runanywhere_cloud, which has to see the dllimport side.
+ *
+ * This lives under include/ rather than beside the sources, where
+ * rac_onnx_api.h sits, because the carrier target's include path is
+ * engines/cloud/include only; a header at the engine root would be invisible to
+ * exactly the target that needs the dllimport side.
+ */
+
+#ifndef RAC_CLOUD_API_H
+#define RAC_CLOUD_API_H
+
+#if defined(RAC_CLOUD_BUILDING)
+#if defined(_WIN32)
+#define RAC_CLOUD_API __declspec(dllexport)
+#elif defined(__GNUC__) || defined(__clang__)
+#define RAC_CLOUD_API __attribute__((visibility("default")))
+#else
+#define RAC_CLOUD_API
+#endif
+#elif defined(_WIN32) && defined(RAC_USING_SHARED)
+#define RAC_CLOUD_API __declspec(dllimport)
+#else
+#define RAC_CLOUD_API
+#endif
+
+#endif /* RAC_CLOUD_API_H */
```

**File**: `engines/cloud/include/rac/backends/rac_stt_cloud.h` (modified, +2/-1)
```diff
@@ -19,6 +19,7 @@
 #include "rac/core/rac_error.h"
 #include "rac/core/rac_types.h"
 #include "rac/features/stt/rac_stt_service.h"
+#include "rac/backends/rac_cloud_api.h"
 
 #ifdef __cplusplus
 extern "C" {
@@ -31,7 +32,7 @@ extern "C" {
  * or register the backend with a plugin registry. Most callers should use
  * rac_stt_cloud_create() / rac_stt_cloud_create_from_json() instead.
  */
-extern const rac_stt_service_ops_t g_cloud_stt_ops;
+extern RAC_CLOUD_API const rac_stt_service_ops_t g_cloud_stt_ops;
 
 /**
  * @brief Create a fully-wrapped cloud STT service using the default provider.
```

**File**: `engines/cloud/rac_stt_cloud.cpp` (modified, +1/-1)
```diff
@@ -510,7 +510,7 @@ rac_result_t cloud_stt_parse_flat_json(const rac_http_response_t* resp,
 // Engine ops vtable + C ABI factory
 // =============================================================================
 
-const rac_stt_service_ops_t g_cloud_stt_ops = {
+extern "C" RAC_CLOUD_API const rac_stt_service_ops_t g_cloud_stt_ops = {
     /* initialize              */ rac::cloud_stt::ops_initialize,
     /* transcribe              */ rac::cloud_stt::ops_transcribe,
     /* transcribe_stream       */ nullptr,
```

---

### Incident Patch 4: `4d110416` (2026-09-11)
**Commit Message**: fix(rag): every chunk of a CJK document is invalid UTF-8 (#847)

* fix(rag): chunker splits mid-UTF-8 on text without separators

The last-resort branch cuts on a raw byte budget. A script without spaces
reaches it routinely, since none of the default separators ("\n\n", ". ",
" ", ...) occur in CJK, so every chunk of such a document carried half a
character at each end. Those chunks are embedded, stored, and returned in
RAGResult string fields. Land the cut on a character boundary.

* fix(rag): the per-split size path cuts mid-character too

CodeRabbit caught a second size-only split in the same function: when a
piece is oversized and no finer separator remains, it sliced by raw byte
offset, which re-broke a character the first fix had just kept whole. Both
paths now share one boundary-aware helper.

**File**: `core/src/features/rag/rag_chunker.cpp` (modified, +41/-7)
```diff
@@ -8,11 +8,42 @@
 #include <algorithm>
 #include <cctype>
 #include <string_view>
+#include <vector>
 
 namespace runanywhere::rag {
 
 namespace {
 
+// Append size-budgeted slices of `text` to `out`, never cutting through a
+// UTF-8 character. Used by both size-only split paths below: the top-level
+// one when no separator matched, and the per-split one when a piece is
+// oversized and there is no finer separator left to try.
+void append_utf8_bounded_slices(std::string_view text, size_t budget,
+                                std::vector<std::string_view>& out) {
+    if (budget == 0) {
+        out.push_back(text);
+        return;
+    }
+    size_t i = 0;
+    while (i < text.length()) {
+        size_t end = std::min(i + budget, text.length());
+        while (end > i && end < text.length() &&
+               (static_cast<unsigned char>(text[end]) & 0xC0) == 0x80) {
+            --end;
+        }
+        if (end == i) {
+            // One character is wider than the whole budget: emit it intact
+            // rather than spin or hand back a partial character.
+            end = i + 1;
+            while (end < text.length() && (static_cast<unsigned char>(text[end]) & 0xC0) == 0x80) {
+                ++end;
+            }
+        }
+        out.push_back(text.substr(i, end - i));
+        i = end;
+    }
+}
+
 void perform_recursive_chunking(std::string_view text_view, const std::string& original_text,
                                 const std::vector<std::string>& separators, size_t chunk_size_chars,
                                 size_t chunk_overlap_chars, std::vector<TextChunk>& output_chunks,
@@ -61,10 +92,10 @@ void perform_recursive_chunking(std::string_view text_view, const std::string& o
 
     std::vector<std::string_view> splits;
     if (separator.empty()) {
-        for (size_t i = 0; i < text_view.length(); i += chunk_size_chars) {
-            splits.push_back(
-                text_view.substr(i, std::min(chunk_size_chars, text_view.length() - i)));
-        }
+        // Last-resort split: no separator matched, so cut on size alone. A
+        // script without spaces reaches this routinely (none of "\n\n" / ". "
+        // / " " occur in CJK), so the cut must land on a character boundary.
+        append_utf8_bounded_slices(text_view, chunk_size_chars, splits);
     } else {
         size_t start = 0;
         size_t pos = text_view.find(separator);
@@ -123,9 +154,12 @@ void perform_recursive_chunking(std::string_view text_view, const std::string& o
                 perform_recursive_chunking(split, original_text, next_separators, chunk_size_chars,
                                            chunk_overlap_chars, output_chunks, chunk_index);
             } else {
-                for (size_t j = 0; j < split.length(); j += chunk_size_chars) {
-                    std::string_view sub_split =
-                        split.substr(j, std::min(chunk_size_chars, split.length() - j));
+                // Same boundary rule as the size-only path above: this
+                // slices an oversized piece by size, so it must not cut
+                // through a character either.
+                std::vector<std::string_view> sub_splits;
+                append_utf8_bounded_slices(split, chunk_size_chars, sub_splits);
+                for (const auto& sub_split : sub_splits) {
                     current_batch.push_back(sub_split);
                     emit_chunk();
                     current_batch.clear();
```

**File**: `core/tests/test_rag_e2e.cpp` (modified, +79/-0)
```diff
@@ -29,6 +29,7 @@
 #include <string>
 #include <vector>
 
+#include "features/rag/rag_chunker.h"
 #include "rac/backends/rac_llm_llamacpp.h"
 #include "rac/core/rac_core.h"
 #include "rac/core/rac_platform_adapter.h"
@@ -421,9 +422,87 @@ void run_scoping_case(const std::string& embed_id, const std::string& llm_id,
 
 }  // namespace
 
+// The chunker needs no model, so this runs before the model gate below.
+// Its last-resort branch (no separator matched) cuts on a byte budget, and a
+// script without spaces reaches that branch routinely: none of "\n\n", ". "
+// or " " occur in CJK. Cutting there on a raw byte offset put half a
+// character at both ends of every chunk, and those chunks are what gets
+// embedded, stored, and returned in RAGResult's string fields.
+static bool chunker_utf8_boundaries_hold() {
+    auto valid_utf8 = [](const std::string& s) {
+        size_t i = 0;
+        while (i < s.size()) {
+            const unsigned char c = static_cast<unsigned char>(s[i]);
+            size_t need = 99;
+            if (c < 0x80) {
+                need = 0;
+            } else if ((c & 0xE0) == 0xC0) {
+                need = 1;
+            } else if ((c & 0xF0) == 0xE0) {
+                need = 2;
+            } else if ((c & 0xF8) == 0xF0) {
+                need = 3;
+            } else {
+                return false;  // continuation byte or invalid lead
+            }
+            for (size_t k = 1; k <= need; ++k) {
+                if (i + k >= s.size() || (static_cast<unsigned char>(s[i + k]) & 0xC0) != 0x80) {
+                    return false;  // truncated or malformed sequence
+                }
+            }
+            i += need + 1;
+        }
+        return true;
+    };
+
+    runanywhere::rag::DocumentChunker chunker{runanywhere::rag::ChunkerConfig{}};
+    bool ok = true;
+
+    // A budget narrower than one character. The size-only paths must emit the
+    // character whole rather than slice it, and must not then re-slice it.
+    {
+        runanywhere::rag::ChunkerConfig tiny;
+        tiny.chunk_size = 1;
+        tiny.chars_per_token = 2;  // 2-byte budget, narrower than a 3-byte CJK char
+        runanywhere::rag::DocumentChunker narrow{tiny};
+        std::string doc;
+        for (int i = 0; i < 40; ++i) {
+            doc += "\xe6\x9c\xba\xe5\x99\xa8";
+        }
+        for (const auto& chunk : narrow.chunk_document(doc)) {
+            if (!valid_utf8(chunk.text)) {
+                std::fprintf(stderr, "FAIL: narrow-budget chunk is not valid UTF-8\n");
+                ok = false;
+                break;
+            }
+        }
+    }
+    // The one-byte prefixes matter: an unshifted CJK string happens to land the
+    // 720-byte budget on a character boundary, so the bug hides without them.
+    for (const char* prefix : {"", "a", "ab"}) {
+        std::string doc = prefix;
+        for (int i = 0; i < 200; ++i) {
+            doc += "\xe6\x9c\xba\xe5\x99\xa8\xe5\xad\xa6\xe4\xb9\xa0";  // CJK, 3 bytes each
+        }
+        for (const auto& chunk : chunker.chunk_document(doc)) {
+            if (!valid_utf8(chunk.text)) {
+                std::fprintf(stderr, "FAIL: chunk is not valid UTF-8 (prefix=\"%s\")\n", prefix);
+                ok = false;
+                break;
+            }
+        }
+    }
+    return ok;
+}
+
 int main() {
     std::fprintf(stdout, "=== RAG end-to-end test ===\n");
 
+    if (!chunker_utf8_boundaries_hold()) {
+        return 1;
+    }
+    std::fprintf(stdout, "OK: chunker keeps UTF-8 boundaries\n");
+
     const std::string embed_model = env_or("RAG_TEST_EMBED_MODEL", "");
     const std::string embed_vocab = env_or("RAG_TEST_EMBED_VOCAB", "");
     const std::string llm_model = env_or("RAG_TEST_LLM_MODEL", "");
```

---

### Incident Patch 5: `a95e6f30` (2026-09-11)
**Commit Message**: fix(rag): rerank snippets are cut mid-UTF-8 character (#845)

* fix(rag): rerank snippets are cut mid-UTF-8 character

flatten_and_truncate stops at a byte count, so a passage in any non-Latin
script is cut mid-sequence and the snippet handed to the LLM scorer ends in
an incomplete character. Back off to a character boundary, the same walk
rag_backend.cpp already does for its source preview.

* style: keep the boundary-walk condition on one line

clang-format joins it; my earlier amend did not pick the change up.

**File**: `core/src/features/rag/rag_rerank.cpp` (modified, +10/-0)
```diff
@@ -30,6 +30,16 @@ std::string flatten_and_truncate(const std::string& text, size_t max_chars) {
             break;
         out.push_back((c == '\n' || c == '\r' || c == '\t') ? ' ' : c);
     }
+    // Back off to a UTF-8 character boundary. The budget is a byte count, so
+    // a passage in any non-Latin script is cut mid-sequence and the snippet
+    // handed to the scorer ends in an incomplete character. The whitespace
+    // substitution above is 1 byte for 1 byte, so offsets into `out` and
+    // `text` still line up. Same walk as rag_backend.cpp's source preview.
+    size_t cut = out.size();
+    while (cut > 0 && cut < text.size() && (static_cast<unsigned char>(text[cut]) & 0xC0) == 0x80) {
+        --cut;
+    }
+    out.resize(cut);
     return out;
 }
 
```

---

### Incident Patch 6: `a363442b` (2026-09-11)
**Commit Message**: fix(embeddings): an explicit normalize=false is discarded (#841)

rac_embeddings_options_from_proto hardcodes RAC_EMBEDDINGS_NORMALIZE_L2 under
a comment saying EmbeddingsOptions.normalize is a plain proto3 bool with no
unset sentinel. It is `optional` with rac_default "true", so has_normalize()
does distinguish an explicit false from unset, and the proto documents that
false is how a caller asks for the raw pooled vector.
RAC_EMBEDDINGS_NORMALIZE_NONE already exists to express it.

**File**: `core/src/foundation/rac_proto_adapters.cpp` (modified, +7/-5)
```diff
@@ -908,11 +908,13 @@ bool rac_embeddings_options_from_proto(const ::runanywhere::v1::EmbeddingsOption
         return false;
     *out = RAC_EMBEDDINGS_OPTIONS_DEFAULT;
 
-    // EmbeddingsOptions.normalize is a plain proto3 bool with no unset sentinel;
-    // the backends default to L2 unit vectors (EmbeddingsConfiguration.normalize
-    // rac_default = true), so an explicit true and the proto default both resolve
-    // to L2 here. Disabling normalization is a component-configuration concern.
-    out->normalize = RAC_EMBEDDINGS_NORMALIZE_L2;
+    // EmbeddingsOptions.normalize is `optional` with rac_default "true", so
+    // presence separates "caller said false" from "caller said nothing"
+    // (embeddings_options.proto: "Unset = true. false returns the raw pooled
+    // vector"). Unset keeps the L2 that RAC_EMBEDDINGS_OPTIONS_DEFAULT already
+    // set; an explicit false is the only way to ask for the raw vector.
+    out->normalize = (!in.has_normalize() || in.normalize()) ? RAC_EMBEDDINGS_NORMALIZE_L2
+                                                             : RAC_EMBEDDINGS_NORMALIZE_NONE;
 
     switch (in.pooling()) {
         case ::runanywhere::v1::EMBEDDINGS_POOLING_STRATEGY_UNSPECIFIED:
```

**File**: `core/tests/test_advanced_modality_proto_abi.cpp` (modified, +19/-0)
```diff
@@ -924,6 +924,25 @@ int test_embeddings_options_mapping() {
     CHECK(raw.truncate == 0, "explicit truncate=false maps exactly");
     CHECK(raw.batch_size == 32, "embedding batch size maps exactly");
 
+    // normalize is `optional` with rac_default "true": "Unset = true. false
+    // returns the raw pooled vector" (embeddings_options.proto). Explicit false
+    // is the only way to ask for the raw vector, so it has to survive the hop.
+    runanywhere::v1::EmbeddingsOptions no_normalize;
+    no_normalize.set_normalize(false);
+    raw = RAC_EMBEDDINGS_OPTIONS_DEFAULT;
+    CHECK(rac::foundation::rac_embeddings_options_from_proto(no_normalize, &raw),
+          "EmbeddingsOptions with normalize=false maps");
+    CHECK(raw.normalize == RAC_EMBEDDINGS_NORMALIZE_NONE,
+          "an explicit normalize=false reaches the C ABI as NONE");
+
+    runanywhere::v1::EmbeddingsOptions yes_normalize;
+    yes_normalize.set_normalize(true);
+    raw = RAC_EMBEDDINGS_OPTIONS_DEFAULT;
+    CHECK(rac::foundation::rac_embeddings_options_from_proto(yes_normalize, &raw),
+          "EmbeddingsOptions with normalize=true maps");
+    CHECK(raw.normalize == RAC_EMBEDDINGS_NORMALIZE_L2,
+          "an explicit normalize=true stays L2");
+
     runanywhere::v1::EmbeddingsOptions defaults;
     raw = RAC_EMBEDDINGS_OPTIONS_DEFAULT;
     CHECK(rac::foundation::rac_embeddings_options_from_proto(defaults, &raw),
```

---

### Incident Patch 7: `80918b46` (2026-09-11)
**Commit Message**: fix(flutter): generateStructured drops the schema from the prompt (#840)

generateStructured builds StructuredOutputOptions with only the schema, and
generateWithStructuredOutput then gates the preparePrompt call on
includeSchemaInPrompt. An unset optional bool reads back as false, so the
schema is never rendered into the prompt on the SDK's own convenience path.
The two sibling construction sites in this SDK already pass true.

**File**: `bindings/flutter/packages/runanywhere/lib/public/extensions/runanywhere_structured_output.dart` (modified, +4/-1)
```diff
@@ -48,7 +48,10 @@ class RunAnywhereStructuredOutput {
     if (!DartBridge.isInitialized) throw SDKException.notInitialized();
     final generation = await generateWithStructuredOutput(
       prompt: prompt,
-      structuredOutput: StructuredOutputOptions(schema: schema),
+      structuredOutput: StructuredOutputOptions(
+        schema: schema,
+        includeSchemaInPrompt: true,
+      ),
       options: options,
     );
     return RunAnywhereLLM.shared.extractStructuredOutput(
```

---

### Incident Patch 8: `99374811` (2026-09-11)
**Commit Message**: fix(solutions): RAG vector_store and BM25/RRF settings are parsed then dropped (#839)

* fix(solutions): forward the RAG retrieval knobs into the graph

config_loader.cpp parses vector_store, bm25_k1, bm25_b and rrf_k out of a
solution's YAML onto RAGConfig, but expand_rag never puts them on an
operator, so they stop at the proto. vector_store is the clearest of the
four: forwarding vector_store_path while dropping the type that selects the
backend it points into splits one setting in half.

* test(solutions): assert the forwarded RAG values, not just the keys

Presence-only checks on vector_store_path, bm25_k1 and bm25_b would be
satisfied by a converter that forwarded the wrong number. Compare against
std::to_string so the assertion tracks the converter's own formatting.

**File**: `core/src/solutions/solution_converter.cpp` (modified, +18/-0)
```diff
@@ -132,6 +132,24 @@ void expand_rag(const runanywhere::v1::RAGConfig& cfg, PipelineSpec* out) {
     if (!cfg.rerank_model_id().empty()) {
         (*retrieve->mutable_params())["rerank_model_id"] = cfg.rerank_model_id();
     }
+    // vector_store selects the backend that vector_store_path points into, so
+    // forwarding the path while dropping the type left the two halves of one
+    // setting split. Retrieval tuning goes the same way: config_loader.cpp
+    // parses bm25_k1/bm25_b/rrf_k out of the solution YAML, and without these
+    // they stop at the proto.
+    if (cfg.vector_store() != runanywhere::v1::VECTOR_STORE_UNSPECIFIED) {
+        (*retrieve->mutable_params())["vector_store"] =
+            runanywhere::v1::VectorStore_Name(cfg.vector_store());
+    }
+    if (cfg.bm25_k1() > 0.0f) {
+        (*retrieve->mutable_params())["bm25_k1"] = std::to_string(cfg.bm25_k1());
+    }
+    if (cfg.bm25_b() > 0.0f) {
+        (*retrieve->mutable_params())["bm25_b"] = std::to_string(cfg.bm25_b());
+    }
+    if (cfg.rrf_k() > 0) {
+        (*retrieve->mutable_params())["rrf_k"] = std::to_string(cfg.rrf_k());
+    }
     (void)llm;
 
     add_edge(out, "query.out", "retrieve.in");
```

**File**: `core/tests/test_solution_runner.cpp` (modified, +54/-0)
```diff
@@ -1126,6 +1126,59 @@ TEST(rag_solution_compiles) {
     runner.wait();
 }
 
+// ---------------------------------------------------------------------------
+// 10b. RAG retrieval tuning knobs reach the graph.
+//      config_loader.cpp parses vector_store / bm25_k1 / bm25_b / rrf_k out of
+//      the solution YAML. vector_store is the sharpest of the four: dropping
+//      it while forwarding vector_store_path splits one setting in half.
+// ---------------------------------------------------------------------------
+TEST(rag_retrieval_params_reach_the_retrieve_operator) {
+    ScopedSolutionStandins standins;
+
+    SolutionConfig cfg;
+    auto* rag = cfg.mutable_rag();
+    rag->set_embed_model_id("bge-small");
+    rag->set_llm_model_id("qwen3-4b");
+    rag->set_vector_store(runanywhere::v1::VECTOR_STORE_USEARCH);
+    rag->set_vector_store_path("/tmp/store");
+    rag->set_bm25_k1(1.5f);
+    rag->set_bm25_b(0.6f);
+    rag->set_rrf_k(30);
+
+    SolutionRunner runner(cfg);
+    CHECK(runner.start() == RAC_SUCCESS);
+
+    const runanywhere::v1::OperatorSpec* retrieve = nullptr;
+    for (const auto& op : runner.spec().operators()) {
+        if (op.name() == "retrieve")
+            retrieve = &op;
+    }
+    CHECK(retrieve != nullptr);
+    const auto& params = retrieve->params();
+    // The path was already forwarded; assert it and the type travel together.
+    const auto path = params.find("vector_store_path");
+    CHECK(path != params.end());
+    CHECK(path->second == "/tmp/store");
+    const auto store = params.find("vector_store");
+    CHECK(store != params.end());
+    CHECK(store->second == "VECTOR_STORE_USEARCH");
+    // Values, not just presence: a converter that forwarded the wrong number
+    // would satisfy a presence-only check. Compared against std::to_string so
+    // the assertion tracks the converter's own float formatting.
+    const auto bm25_k1 = params.find("bm25_k1");
+    CHECK(bm25_k1 != params.end());
+    CHECK(bm25_k1->second == std::to_string(1.5f));
+    const auto bm25_b = params.find("bm25_b");
+    CHECK(bm25_b != params.end());
+    CHECK(bm25_b->second == std::to_string(0.6f));
+    const auto rrf = params.find("rrf_k");
+    CHECK(rrf != params.end());
+    CHECK(rrf->second == "30");
+
+    runner.close_input();
+    runner.wait();
+}
+
 // ---------------------------------------------------------------------------
 // 11. C ABI end-to-end: proto-bytes path.
 // ---------------------------------------------------------------------------
@@ -1363,6 +1416,7 @@ int main() {
     run_test_voice_agent_solution_compiles();
     run_test_voice_agent_explicit_zero_temperature_reaches_llm_operator();
     run_test_rag_solution_compiles();
+    run_test_rag_retrieval_params_reach_the_retrieve_operator();
     run_test_c_abi_proto_bytes_lifecycle();
     run_test_voice_agent_barge_in_params_reach_the_vad_operator();
     run_test_c_abi_yaml_solution_lifecycle();
```

---

### Incident Patch 9: `21eb23a6` (2026-09-11)
**Commit Message**: fix(voice-agent): prevent conversation history race and dangling pointers during LLM generation (#838)

* fix(voice-agent): prevent conversation history race and dangling pointers during LLM generation

* fix(voice-agent): remove redundant inner locks and add docstring to d7_process_utterance

**File**: `core/src/features/voice_agent/voice_agent_d7_abi.cpp` (modified, +23/-2)
```diff
@@ -420,6 +420,23 @@ void d7_emit_cancelled(rac_voice_agent_handle_t handle,
 
 namespace rac::voice_agent::detail {
 
+/**
+ * @brief Processes a single voice utterance end-to-end (VAD -> STT -> LLM -> TTS).
+ *
+ * Runs voice activity validation, speech transcription, conversational response generation
+ * with history preservation, and speech synthesis under handle mutex synchronization.
+ *
+ * @param handle Voice agent handle instance.
+ * @param audio Raw audio buffer for the closed utterance.
+ * @param session_id Tracking session ID.
+ * @param turn_id Unique turn identifier.
+ * @param request_id Request correlation identifier.
+ * @param language_code Optional spoken language code override.
+ * @param event_callback Optional per-turn event listener callback.
+ * @param user_data User context forwarded to callback.
+ * @param out_result Output VoiceAgentResult containing synthesized response and transcript.
+ * @return RAC_SUCCESS on successful processing, or an error code on failure/cancellation.
+ */
 rac_result_t d7_process_utterance(rac_voice_agent_handle_t handle, const std::string& audio,
                                   const std::string& session_id, const std::string& turn_id,
                                   const std::string& request_id, const std::string& language_code,
@@ -762,9 +779,13 @@ rac_result_t d7_process_utterance(rac_voice_agent_handle_t handle, const std::st
     // brevity cap, and the prior conversation so replies stay short, on-topic,
     // and context-aware — instead of feeding the raw transcript with no guidance
     // (which is why responses were rambly/useless).
+    //
+    // Snapshot into local storage while handle->mutex is held so string pointers
+    // remain safely bounded to this stack frame during LLM generation.
+    const std::vector<VoiceConversationTurn> history_snapshot = handle->conversation_history;
     std::vector<const char*> history_ptrs;
-    history_ptrs.reserve(handle->conversation_history.size() * 2);
-    for (const auto& turn : handle->conversation_history) {
+    history_ptrs.reserve(history_snapshot.size() * 2);
+    for (const auto& turn : history_snapshot) {
         if (turn.user_text.empty()) {
             continue;
         }
```

---

### Incident Patch 10: `d3ea13a7` (2026-09-11)
**Commit Message**: fix(commons): support Windows path separators in service factory model resolution (#837)

* fix(commons): support Windows path separators in service factory model resolution

* docs(commons): add Doxygen docstrings to rac_service_factory_internal functions

**File**: `core/src/features/common/rac_service_factory_internal.h` (modified, +53/-26)
```diff
@@ -54,6 +54,17 @@ struct ResolvedModelReference {
     ModelInfoPtr model_info;
 };
 
+/**
+ * @brief Resolves a model ID or path reference against the model registry.
+ *
+ * Performs model resolution by ID, full path, or extracted filename component across
+ * POSIX and Windows path formats, evaluating local path preferences and fallback frameworks.
+ *
+ * @param model_id Model identifier or filesystem path to resolve.
+ * @param options Resolution configuration options including log category and defaults.
+ * @param out_reference Output struct populated with resolved path, framework, and metadata.
+ * @return RAC_SUCCESS on successful resolution, or an error code on invalid parameters.
+ */
 inline rac_result_t resolve_model_reference(const char* model_id,
                                             const ModelReferenceOptions& options,
                                             ResolvedModelReference* out_reference) {
@@ -80,7 +91,11 @@ inline rac_result_t resolve_model_reference(const char* model_id,
     }
 
     if (result != RAC_SUCCESS && options.lookup_last_path_component) {
-        const char* last_slash = strrchr(model_id, '/');
+        const char* last_fwd = strrchr(model_id, '/');
+        const char* last_bck = strrchr(model_id, '\\');
+        const char* last_slash = (last_fwd && last_bck) ? std::max(last_fwd, last_bck)
+                                 : last_fwd             ? last_fwd
+                                                        : last_bck;
         if (last_slash && last_slash[1] != '\0') {
             const char* extracted_id = last_slash + 1;
             RAC_LOG_DEBUG(options.log_cat, "Trying extracted model ID from path: %s", extracted_id);
@@ -121,8 +136,18 @@ inline rac_result_t resolve_model_reference(const char* model_id,
                 rac_model_path_resolution_free(&resolution);
             }
         }
-        if (options.prefer_input_path_when_contains &&
-            strstr(model_id, options.prefer_input_path_when_contains) != nullptr) {
+        bool prefer_input = false;
+        if (options.prefer_input_path_when_contains) {
+            if (std::strcmp(options.prefer_input_path_when_contains, "/") == 0) {
+                // Path separator match: accept either '/' or '\' for cross-platform file paths
+                prefer_input =
+                    (strchr(model_id, '/') != nullptr || strchr(model_id, '\\') != nullptr);
+            } else {
+                prefer_input =
+                    (strstr(model_id, options.prefer_input_path_when_contains) != nullptr);
+            }
+        }
+        if (prefer_input) {
             out_reference->path = model_id;
         } else {
             out_reference->path = registry_path;
@@ -157,6 +182,13 @@ struct PluginServiceCreateSpec {
     rac_inference_framework_t framework = RAC_FRAMEWORK_UNKNOWN;
 };
 
+/**
+ * @brief Returns the preferred engine plugin identifier for a framework and primitive.
+ *
+ * @param framework Inference framework enum.
+ * @param primitive Primitive operation kind enum.
+ * @return Engine identifier string constant, or nullptr if no specific preference.
+ */
 inline const char* plugin_hint_for_framework(rac_inference_framework_t framework,
                                              rac_primitive_t primitive) {
     switch (framework) {
@@ -212,33 +244,28 @@ inline const char* plugin_hint_for_framework(rac_inference_framework_t framework
     }
 }
 
-// Whether plugin_hint_for_framework()'s answer is a hard requirement rather than a
-// preference.
-//
-// The priority fallback in create_plugin_service() exists for frameworks whose hint is
-// advisory — several engines can read the same bytes, so the next-best engine is a real
-// answer. That is not true when the framework names the on-disk *format*: nothing but
-// NeuRT can open an .mlmodelc/.mlpackage tree. Falling back by priority hands a Core ML
-// bundle to MLX (safetensors), Sherpa or ONNX, which can only produce a confusing
-// load-time error far from its cause — or, for a primitive where the fallback engine
-// happens to accept the path, a silently wrong model.
-//
-// This is not hypothetical. Before COREML was routed to NeuRT unconditionally it mapped
-// to `platform` for the primitives NeuRT did not serve, and `platform` really does serve
-// SYNTHESIZE; without this guard, routing COREML to NeuRT would have sent a Core ML TTS
-// request to MLX by priority (110 > 100) instead.
-//
-// NeuRT now fills tts_ops, so that particular case no longer fires -- but the guard is not
-// therefore obsolete. It is what keeps the NEXT unfilled slot from repeating the pattern,
-// which this engine has already done twice.
-//
-// Only COREML is strict here. The other format-determined frameworks (LLAMACPP, MLX,
-// QHEXRT) have the same argument available to them, but changing their behaviour is
-// outside the scope of the ABI-10 work and untested.
+/**
+ * @brief Checks whether a framework requires its hinted 
```

---

### Incident Patch 11: `f165f475` (2026-09-11)
**Commit Message**: fix(solutions): VoiceAgent knobs the loader parses are dropped by the expansion (#836)

* fix(solutions): forward the VoiceAgent barge-in knobs into the graph

config_loader.cpp parses enable_barge_in and barge_in_threshold_ms out of a
solution's YAML and sets them on VoiceAgentConfig, but expand_voice_agent
never puts them on an operator, so they stop at the proto and no host
factory can see them. Every other knob the loader parses is forwarded
(sample_rate_hz, chunk_ms, system_prompt, max_context_tokens, temperature,
emit_partials). Carry both onto the vad op, honouring presence so an
explicit false is distinguishable from unset.

* fix(solutions): forward emit_thoughts too

The YAML's emit_thoughts lands on generation.reasoning.include_in_output,
and only system_prompt and temperature were read back off generation, so it
stopped at the proto like the barge-in pair. Guarded on has_reasoning(),
since include_in_output is a plain proto3 bool with no presence.

* test(solutions): move the barge-in case to its own slot

It shared the 9b slot and insertion point with the temperature case in
#812, so the two conflicted in test_solution_runner.cpp whenever both were
merged. Same test, d

**File**: `core/src/solutions/solution_converter.cpp` (modified, +21/-0)
```diff
@@ -72,6 +72,27 @@ void expand_voice_agent(const runanywhere::v1::VoiceAgentConfig& cfg, PipelineSp
         (*llm->mutable_params())["temperature"] = std::to_string(cfg.generation().temperature());
     }
     (*tts->mutable_params())["emit_partials"] = cfg.emit_partials() ? "true" : "false";
+    // Barge-in is detected on the VAD side (user speech arriving while the
+    // assistant is talking), which is why these ride the vad op alongside
+    // sample_rate_hz/chunk_ms rather than tts. config_loader.cpp parses both
+    // out of the solution YAML, so without forwarding them here a caller's
+    // `enable_barge_in: false` reaches the proto and then stops.
+    if (cfg.has_enable_barge_in()) {
+        (*vad->mutable_params())["enable_barge_in"] = cfg.enable_barge_in() ? "true" : "false";
+    }
+    if (cfg.barge_in_threshold_ms() > 0) {
+        (*vad->mutable_params())["barge_in_threshold_ms"] =
+            std::to_string(cfg.barge_in_threshold_ms());
+    }
+    // `emit_thoughts` in the YAML lands on generation.reasoning.include_in_output
+    // (config_loader.cpp), and only system_prompt and temperature were being
+    // read back off `generation`, so it stopped at the proto like the barge-in
+    // pair. Guarded on has_reasoning() rather than the bool, which is a plain
+    // proto3 field with no presence of its own.
+    if (cfg.has_generation() && cfg.generation().has_reasoning()) {
+        (*llm->mutable_params())["emit_thoughts"] =
+            cfg.generation().reasoning().include_in_output() ? "true" : "false";
+    }
 
     add_edge(out, "vad.out", "stt.in");
     add_edge(out, "stt.final", "llm.in");
```

**File**: `core/tests/test_solution_runner.cpp` (modified, +56/-0)
```diff
@@ -1152,6 +1152,61 @@ TEST(c_abi_proto_bytes_lifecycle) {
     rac_solution_destroy(h);
 }
 
+// ---------------------------------------------------------------------------
+// 11b. VoiceAgent barge-in knobs reach the graph.
+//     config_loader.cpp parses enable_barge_in / barge_in_threshold_ms out of
+//     the solution YAML, so the expansion has to carry them onto an operator
+//     or a caller's setting stops at the proto. Explicit false is the case
+//     that matters: it is the only way to turn barge-in off, and it is
+//     indistinguishable from "unset" unless presence is honoured.
+// ---------------------------------------------------------------------------
+TEST(voice_agent_barge_in_params_reach_the_vad_operator) {
+    ScopedSolutionStandins standins;
+
+    SolutionConfig cfg;
+    auto* va = cfg.mutable_voice_agent();
+    va->set_llm_model_id("qwen3-4b");
+    va->set_stt_model_id("whisper");
+    va->set_tts_model_id("kokoro");
+    va->set_vad_model_id("silero");
+    va->set_enable_barge_in(false);
+    va->set_barge_in_threshold_ms(250);
+    va->mutable_generation()->mutable_reasoning()->set_include_in_output(true);
+
+    SolutionRunner runner(cfg);
+    CHECK(runner.start() == RAC_SUCCESS);
+    const auto& spec = runner.spec();
+
+    const runanywhere::v1::OperatorSpec* vad = nullptr;
+    for (const auto& op : spec.operators()) {
+        if (op.name() == "vad")
+            vad = &op;
+    }
+    CHECK(vad != nullptr);
+    const auto& params = vad->params();
+    const auto enabled = params.find("enable_barge_in");
+    CHECK(enabled != params.end());
+    CHECK(enabled->second == "false");
+    const auto threshold = params.find("barge_in_threshold_ms");
+    CHECK(threshold != params.end());
+    CHECK(threshold->second == "250");
+
+    // emit_thoughts rides `generation.reasoning`, which was the other knob the
+    // loader parsed and the expansion dropped.
+    const runanywhere::v1::OperatorSpec* llm = nullptr;
+    for (const auto& op : spec.operators()) {
+        if (op.name() == "llm")
+            llm = &op;
+    }
+    CHECK(llm != nullptr);
+    const auto thoughts = llm->params().find("emit_thoughts");
+    CHECK(thoughts != llm->params().end());
+    CHECK(thoughts->second == "true");
+
+    runner.close_input();
+    runner.wait();
+}
+
 // ---------------------------------------------------------------------------
 // 12. C ABI end-to-end: YAML path (SolutionConfig shape).
 // ---------------------------------------------------------------------------
@@ -1309,6 +1364,7 @@ int main() {
     run_test_voice_agent_explicit_zero_temperature_reaches_llm_operator();
     run_test_rag_solution_compiles();
     run_test_c_abi_proto_bytes_lifecycle();
+    run_test_voice_agent_barge_in_params_reach_the_vad_operator();
     run_test_c_abi_yaml_solution_lifecycle();
     run_test_c_abi_yaml_pipeline_lifecycle();
     run_test_retrieve_without_session_handle_fails_honestly();
```

---

### Incident Patch 12: `ec1dd742` (2026-09-11)
**Commit Message**: fix(structured-output): an unset include_schema_in_prompt drops the schema (#825)

structured_output_config_from_options reads include_schema_in_prompt by
value, so an absent field becomes RAC_FALSE and overwrites the RAC_TRUE that
RAC_STRUCTURED_OUTPUT_DEFAULT just put there. The field is `optional` with
rac_default "true", and rac_structured_output_prepare_prompt returns the
prompt unchanged when the flag is off, so a request that constrains decoding
without mentioning the prompt silently gets no schema rendered into it.
Guard on presence, matching llm_module.cpp's reader of the same field.

**File**: `core/src/features/llm/structured_output.cpp` (modified, +9/-2)
```diff
@@ -337,8 +337,15 @@ static ProtoStructuredOutputConfig
 structured_output_config_from_options(const runanywhere::v1::StructuredOutputOptions& options) {
     ProtoStructuredOutputConfig converted;
     converted.json_schema = json_schema_from_options(options);
-    converted.config.include_schema_in_prompt =
-        options.include_schema_in_prompt() ? RAC_TRUE : RAC_FALSE;
+    // include_schema_in_prompt is `optional` with rac_default "true", and
+    // converted.config already carries that default from
+    // RAC_STRUCTURED_OUTPUT_DEFAULT. Reading the value unconditionally turned
+    // an absent field into RAC_FALSE and threw the default away, which makes
+    // rac_structured_output_prepare_prompt hand back the prompt untouched.
+    if (options.has_include_schema_in_prompt()) {
+        converted.config.include_schema_in_prompt =
+            options.include_schema_in_prompt() ? RAC_TRUE : RAC_FALSE;
+    }
     refresh_proto_structured_output_config(&converted);
     return converted;
 }
```

**File**: `core/tests/test_structured_output.cpp` (modified, +38/-0)
```diff
@@ -189,6 +189,42 @@ int test_prepare_prompt_proto_uses_generated_contract() {
     return 0;
 }
 
+int test_prepare_prompt_proto_defaults_schema_into_prompt() {
+    // include_schema_in_prompt is `optional bool` with rac_default "true"
+    // (idl/structured_output.proto), so a request that constrains decoding but
+    // says nothing about the prompt must still get the schema rendered in.
+    // Reading the field by value makes an absent one look like an explicit
+    // false, and prepare_prompt then returns `text` verbatim.
+    runanywhere::v1::StructuredOutputParseRequest request;
+    request.set_text("Return a status");
+    auto* options = request.mutable_options();
+    options->set_schema(
+        "{\"type\":\"object\",\"required\":[\"status\"],"
+        "\"properties\":{\"status\":{\"type\":\"string\"}}}");
+    ASSERT_TRUE(!options->has_include_schema_in_prompt());
+
+    std::string bytes;
+    ASSERT_TRUE(request.SerializeToString(&bytes));
+
+    rac_proto_buffer_t result_bytes{};
+    rac_proto_buffer_init(&result_bytes);
+    const rac_result_t rc = rac_structured_output_prepare_prompt_proto(
+        reinterpret_cast<const uint8_t*>(bytes.data()), bytes.size(), &result_bytes);
+    ASSERT_EQ_INT(rc, RAC_SUCCESS);
+    ASSERT_EQ_INT(result_bytes.status, RAC_SUCCESS);
+    ASSERT_TRUE(result_bytes.data != nullptr);
+
+    runanywhere::v1::StructuredOutputPromptResult result;
+    ASSERT_TRUE(result.ParseFromArray(result_bytes.data, static_cast<int>(result_bytes.size)));
+    ASSERT_EQ_INT(result.error().c_abi_code(), RAC_SUCCESS);
+    ASSERT_SUBSTR(result.prepared_prompt().c_str(), "Return a status");
+    ASSERT_SUBSTR(result.prepared_prompt().c_str(), "\"status\"");
+    ASSERT_TRUE(result.prepared_prompt() != "Return a status");
+
+    rac_proto_buffer_free(&result_bytes);
+    return 0;
+}
+
 int test_validate_proto_uses_generated_contract() {
     // StructuredOutputValidationRequest was deleted outright — the sole
     // request envelope shared by parse/validate/prepare-prompt is now
@@ -262,6 +298,8 @@ int main() {
          .fn = test_parse_proto_extracts_array_with_brace_in_string},
         {.name = "prepare_prompt_proto_uses_generated_contract",
          .fn = test_prepare_prompt_proto_uses_generated_contract},
+        {.name = "prepare_prompt_proto_defaults_schema_into_prompt",
+         .fn = test_prepare_prompt_proto_defaults_schema_into_prompt},
         {.name = "validate_proto_uses_generated_contract",
          .fn = test_validate_proto_uses_generated_contract},
     };
```

---

### Incident Patch 13: `aa4f08af` (2026-09-11)
**Commit Message**: fix(tool-calling): honour presence on ToolCallingOptions.auto_execute (#828)

The value read turns an absent auto_execute into RAC_FALSE, overwriting the
RAC_TRUE that RAC_TOOL_CALLING_OPTIONS_DEFAULT set, so "caller said nothing"
becomes "caller said false". The comment justifying the value read says the
field is a plain proto3 bool with no presence and that fixing it would need
an IDL change; that IDL change already happened. auto_execute is `optional`
at idl/tool_calling.proto:181 and the two other readers of this same message
already use has_auto_execute(). Guard on presence and drop the stale note.

**File**: `core/src/features/llm/tool_calling.cpp` (modified, +8/-19)
```diff
@@ -1867,25 +1867,14 @@ tool_calling_options_from_proto(const runanywhere::v1::ToolCallingOptions& proto
     ProtoToolCallingOptions converted;
     converted.tools_json = tool_definitions_proto_to_json(proto);
 
-    // PR #605 review issue #7: `converted.options` starts from
-    // RAC_TOOL_CALLING_OPTIONS_DEFAULT (auto_execute = true); the missing
-    // `else` here meant a caller's explicit `auto_execute = false` on the
-    // wire was silently discarded and this always resolved to true. Safe to
-    // fix unconditionally: `converted.options.auto_execute` is not read by
-    // anything downstream of this function today (only `tools_json`,
-    // `system_prompt`, and `format` feed the prompt-formatting callers of
-    // `tool_calling_options_from_proto`), so trusting the wire value
-    // directly changes no observed behavior while fixing the function's own
-    // contract for whenever this does get consumed.
-    //
-    // ToolCallingOptions.auto_execute is a plain (non-optional) proto3 bool
-    // with no wire presence, unlike the sibling
-    // ToolCallingSessionCreateRequest.auto_execute (`optional`, defaults to
-    // true only when *absent* -- see tool_calling_run_loop.cpp /
-    // tool_calling_session.cpp). "Explicitly false" and "field omitted" are
-    // therefore indistinguishable on this specific field; restoring real
-    // presence would need an IDL change, out of scope here.
-    converted.options.auto_execute = proto.auto_execute() ? RAC_TRUE : RAC_FALSE;
+    // `converted.options` starts from RAC_TOOL_CALLING_OPTIONS_DEFAULT
+    // (auto_execute = true), and ToolCallingOptions.auto_execute is `optional`
+    // (idl/tool_calling.proto), so presence is what distinguishes "caller said
+    // false" from "caller said nothing". Same read as the two other consumers
+    // of this message, tool_calling_run_loop.cpp and tool_calling_session.cpp.
+    if (proto.has_auto_execute()) {
+        converted.options.auto_execute = proto.auto_execute() ? RAC_TRUE : RAC_FALSE;
+    }
     // ToolCallingOptions.temperature/max_tokens were deleted outright
     // (idl/tool_calling.proto, llm-tool-options-no-shadow): they duplicated
     // the enclosing LLMGenerationOptions.temperature/max_output_tokens in
```

---

### Incident Patch 14: `f0e102db` (2026-09-11)
**Commit Message**: fix(desktop bindings): report file-write close failures (#794)

Co-authored-by: Sanchit Monga <[REDACTED_EMAIL]>

**File**: `bindings/electron/native/posix_platform_adapter.cpp` (modified, +2/-2)
```diff
@@ -93,8 +93,8 @@ rac_result_t posix_file_write(const char* path, const void* data, size_t size, v
     FILE* f = fopen(path, "wb");
     if (!f) return RAC_ERROR_FILE_WRITE_FAILED;
     size_t put = size ? fwrite(data, 1, size, f) : 0;
-    fclose(f);
-    return (put == size) ? RAC_SUCCESS : RAC_ERROR_FILE_WRITE_FAILED;
+    int close_rc = fclose(f);
+    return (put == size && close_rc == 0) ? RAC_SUCCESS : RAC_ERROR_FILE_WRITE_FAILED;
 }
 
 rac_result_t posix_file_delete(const char* path, void*) {
```

**File**: `bindings/electron/native/win32_platform_adapter.cpp` (modified, +2/-2)
```diff
@@ -138,8 +138,8 @@ rac_result_t win_file_write(const char* path, const void* data, size_t size, voi
     FILE* f = wfopen_utf8(utf8_path(path), L"wb");
     if (!f) return RAC_ERROR_FILE_WRITE_FAILED;
     size_t put = size ? fwrite(data, 1, size, f) : 0;
-    fclose(f);
-    return (put == size) ? RAC_SUCCESS : RAC_ERROR_FILE_WRITE_FAILED;
+    int close_rc = fclose(f);
+    return (put == size && close_rc == 0) ? RAC_SUCCESS : RAC_ERROR_FILE_WRITE_FAILED;
 }
 
 rac_result_t win_file_delete(const char* path, void*) {
```

**File**: `bindings/python/native/posix_platform_adapter.cpp` (modified, +2/-2)
```diff
@@ -93,8 +93,8 @@ rac_result_t posix_file_write(const char* path, const void* data, size_t size, v
     FILE* f = fopen(path, "wb");
     if (!f) return RAC_ERROR_FILE_WRITE_FAILED;
     size_t put = size ? fwrite(data, 1, size, f) : 0;
-    fclose(f);
-    return (put == size) ? RAC_SUCCESS : RAC_ERROR_FILE_WRITE_FAILED;
+    int close_rc = fclose(f);
+    return (put == size && close_rc == 0) ? RAC_SUCCESS : RAC_ERROR_FILE_WRITE_FAILED;
 }
 
 rac_result_t posix_file_delete(const char* path, void*) {
```

**File**: `bindings/python/native/win32_platform_adapter.cpp` (modified, +2/-2)
```diff
@@ -124,8 +124,8 @@ rac_result_t win_file_write(const char* path, const void* data, size_t size, voi
     FILE* f = wfopen_utf8(utf8_path(path), L"wb");
     if (!f) return RAC_ERROR_FILE_WRITE_FAILED;
     size_t put = size ? fwrite(data, 1, size, f) : 0;
-    fclose(f);
-    return (put == size) ? RAC_SUCCESS : RAC_ERROR_FILE_WRITE_FAILED;
+    int close_rc = fclose(f);
+    return (put == size && close_rc == 0) ? RAC_SUCCESS : RAC_ERROR_FILE_WRITE_FAILED;
 }
 
 rac_result_t win_file_delete(const char* path, void*) {
```

---

### Incident Patch 15: `146d8f24` (2026-09-11)
**Commit Message**: fix(rag): RAC_ENABLE_PROTOBUF=OFF cannot compile the RAG backend (#824)

rac_rag_proto_abi.cpp includes features/llm/llm_thinking_tags_internal.h
above the RAC_HAVE_PROTOBUF guard, but the commons src/ root only joins
rac_backend_rag's include path inside the protobuf branch of
core/src/features/rag/CMakeLists.txt. With RAC_ENABLE_PROTOBUF=OFF the
header is unreachable and the build stops on a fatal include error. Its
only use is inside the guard, so move the include next to the two
src-relative siblings that are already there.

**File**: `core/src/features/rag/rac_rag_proto_abi.cpp` (modified, +1/-1)
```diff
@@ -27,7 +27,6 @@
 #include <vector>
 
 #include "../embeddings/embeddings_service_internal.h"
-#include "features/llm/llm_thinking_tags_internal.h"
 #include "rac/core/rac_core.h"
 #include "rac/core/rac_error.h"
 #include "rac/core/rac_logger.h"
@@ -46,6 +45,7 @@
 #include "rag.pb.h"
 #include "sdk_events.pb.h"
 
+#include "features/llm/llm_thinking_tags_internal.h"
 #include "foundation/rac_proto_marshal_internal.h"
 #include "infrastructure/events/sdk_event_publish.h"
 #endif
```

#### Recent Merged Pull Requests:
- **PR #991** (closed): llamacpp: Windows ARM64 MSVC builds with SVE disabled (@Siddhesh2377)
- **PR #988** (2026-10-04): feat(decision): local decision models — ABI v13 + llamacpp + MLX + Swift surface (@Siddhesh2377)
- **PR #983** (closed): flutter: ship generated trees in the runanywhere pub package (@Siddhesh2377)
- **PR #972** (closed): fix(electron): reopen the preload gate before retrying auth after a host restart (@breken-ai)
- **PR #971** (closed): fix(electron): validate resumed download content ranges (@shubhamsinnh)
- **PR #970** (closed): feat: add MiniCPM5  to the React Native and Flutter example catalogs (@Caldalis)
- **PR #968** (closed): release: prepare SDK 0.20.38 (@Siddhesh2377)
- **PR #967** (2026-09-23): release: sync v0.20.37 Apple checksums (@Siddhesh2377)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
