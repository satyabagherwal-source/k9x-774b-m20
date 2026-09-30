# Forensic Learning Record (Deep Inspection): RunanywhereAI/runanywhere-sdks

> **Canonical Artifact**: `07_PROJECT_LEARNING/runanywhereai-runanywhere-sdks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RunanywhereAI/runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:35:20.280Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RunanywhereAI/runanywhere-sdks`
- **Description**: Production ready toolkit to run AI locally
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10318 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bindings/electron/example/src/catalog.ts`
```
/**
 * THIS APP's model table — one row.
 *
 * The SDK owns the entry SHAPE (`Catalog` / `registerCatalog`); the app owns
 * WHICH models it offers, exactly as on every other platform in this repo. The
 * SDK ships no built-in table, so a generation that names an id the registry has
 * never seen fails before it reaches a backend.
 *
 * Registration is PER PROCESS and two processes here resolve models: the preload
 * (whose `initialize()` seeds the rows into the commons registry) and the forked
 * utility host (which downloads them). The host receives this module's PATH from
 * the main process and loads it with a raw `require()` — which is why nothing
 * here may import a generated proto module, and why every import below is an
 * `import type` that erases at emit.
 */
import type { Catalog } from '@runanywhere/electron';

export const CATALOG: Catalog = {
  'smollm2-360m-q8_0': {
    type: 'llm',
    files: [
      {
        url: 'https://huggingface.co/prithivMLmods/SmolLM2-360M-GGUF/resolve/main/SmolLM2-360M.Q8_0.gguf',
        as: 'model.gguf',
      },
    ],
    primary: 'model.gguf',
    label: 'SmolLM2 360M Q8_0',
    sizeMB: 386,
  },
};

```

### Core Architecture Module: `bindings/electron/example/src/main.ts`
```
/**
 * Electron MAIN process.
 *
 * Three jobs and nothing else:
 *   1. Record the backend plugin. Registration is main-process only (security):
 *      `RunAnywhereMain` copies the recorded paths into RUNANYWHERE_PLUGIN_PATHS
 *      when it forks the utility host — never over renderer RPC.
 *   2. Fork that host and broker its MessagePort into the window. Inference runs
 *      there, so neither this process nor the renderer ever loads the addon.
 *   3. Open one window.
 */
import * as path from 'node:path';

import { app, BrowserWindow } from 'electron';

import { RunAnywhereMain } from '@runanywhere/electron/main';
import { LlamaCPP } from '@runanywhere/electron-llamacpp';

// Before any connect(): the fork reads the queue this fills.
LlamaCPP.register();

// The host is what turns a catalog id into files on disk, and catalog
// registration is per process — so it needs this app's table as a CommonJS
// module on disk. `catalog.js` is what tsc emits from `src/catalog.ts`.
const runAnywhere = new RunAnywhereMain({
  catalogPath: path.join(__dirname, 'catalog.js'),
});

function createWindow(): void {
  const win = new BrowserWindow({
    width: 720,
    height: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // The preload requires SDK modules, which a sandboxed preload cannot do.
      // contextIsolation stays on (the default), so the page still gets only
      // what contextBridge publishes.
      sandbox: false,
    },
  });
  // Connect after the page exists, so the port lands in a live renderer. This
  // fires again on reload, which is exactly when a fresh port is needed.
  win.webContents.on('did-finish-load', () => runAnywhere.connect(win.webContents));
  void win.loadFile(path.join(__dirname, '..', 'index.html'));
}

void app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());

```

### Core Architecture Module: `bindings/electron/example/src/preload.ts`
```
/**
 * Electron PRELOAD.
 *
 * The ORDER of the two statements below is load-bearing: the catalog must be
 * staged BEFORE the SDK's preload is loaded, because registration is per process
 * and the SDK's `initialize()` seeds whatever is staged into the commons
 * registry. tsc emits a CommonJS `require` at the position of its import, so the
 * side-effect import really does run last — do NOT hoist it for tidiness.
 *
 * That side-effect import is the whole of the rest of this file: it publishes
 * `window.runanywhere` over contextBridge. This app adds no bridge of its own.
 */
import { registerCatalog } from '@runanywhere/electron';

import { CATALOG } from './catalog';

registerCatalog(CATALOG);

import '@runanywhere/electron/preload';

```

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

### Core Architecture Module: `bindings/electron/native/addon.cpp`
```
// addon.cpp — RunAnywhere Electron N-API addon.
//
// Binds the rac_* C ABI (reusing the Win32 platform adapter proven by the M0
// harness) for on-device inference in Node/Electron. Node-API only, so one
// prebuilt spans Node/Electron versions. Streaming uses a bounded
// Napi::ThreadSafeFunction on a worker thread (BlockingCall = backpressure) and
// resolves a Promise in the TSFN finalizer.
//
// Modalities: LLM (generate) and VLM (generateVlm, image + prompt) — both
// served by the already-linked llama.cpp engine.

#include <napi.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

#ifdef _WIN32
#include "win32_platform_adapter.h"
#else
#include "posix_platform_adapter.h"
#endif

#include "rac/core/rac_core.h"
// RAC_LOG_* is used unconditionally (load_plugins_from_env), so it cannot ride
// in on the desktop-adapter block below. Without this, a build with
// RAC_DESKTOP_ADAPTER=OFF — the win-arm64 / QHexRT lane — still sees the
// `rac_log_level_t` enum via rac_core.h but not the macro, so
// `RAC_LOG_WARNING(...)` parses as a call on an enum constant and fails with
// "C2064: term does not evaluate to a function taking 4 arguments".
#include "rac/core/rac_logger.h"
#include "rac/plugin/rac_plugin_loader.h"
#ifdef RAC_HAVE_BACKEND_NEURT
#include "rac/plugin/rac_plugin_entry.h"
#include "rac/plugin/rac_plugin_entry_neurt.h"
#endif
#include "audio_bridge.h"
#include "data_bridge.h"
#include "download_bridge.h"
#include "llm_bridge.h"
#include "logging_bridge.h"
#include "lora_bridge.h"
#include "model_bridge.h"
#include "proto_bridge.h"
#include "speech_bridge.h"
#include "tool_bridge.h"
#include "vlm_bridge.h"
#include "voice_bridge.h"

#include "rac/core/rac_types.h"
#include "rac/features/diarization/rac_diarization_service.h"
#include "rac/features/diarization/rac_diarization_types.h"
#include "rac/features/embeddings/rac_embeddings_service.h"
#include "rac/features/embeddings/rac_embeddings_types.h"
#include "rac/features/llm/rac_llm_component.h"
#include "rac/features/rag/rac_rag.h"
#include "rac/features/rerank/rac_rerank_service.h"
#include "rac/features/rerank/rac_rerank_types.h"
#include "rac/features/segmentation/rac_segmentation_service.h"
#include "rac/features/segmentation/rac_segmentation_types.h"
#include "rac/features/stt/rac_stt_component.h"
#include "rac/features/stt/rac_stt_types.h"
#include "rac/features/tts/rac_tts_component.h"
#include "rac/features/tts/rac_tts_types.h"
#include "rac/features/vad/rac_vad_component.h"
#include "rac/features/vad/rac_vad_stream.h"
#include "rac/features/vad/rac_vad_types.h"
#include "rac/features/vlm/rac_vlm_component.h"
#include "rac/features/vlm/rac_vlm_types.h"
#include "rac/foundation/rac_proto_buffer.h"
#include "rac/infrastructure/http/rac_http_client.h"
#include "rac/infrastructure/model_management/rac_model_paths.h"
#include "rac/infrastructure/model_management/rac_model_registry.h"
#include "rac/infrastructure/model_management/rac_model_types.h"
// Desktop control plane (telemetry + auth). Compiled only when the desktop
// adapter — which carries the libcurl HTTP transport — is linked into commons
// (RAC_ELECTRON_HAVE_DESKTOP, set by native/CMakeLists.txt when
// RAC_DESKTOP_ADAPTER=ON).
#ifdef RAC_ELECTRON_HAVE_DESKTOP
#include "rac/core/rac_sdk_state.h"
#include "rac/desktop/rac_desktop.h"
#include "rac/infrastructure/device/rac_device_identity.h"
#include "rac/infrastructure/device/rac_device_manager.h"
#include "rac/infrastructure/events/rac_sdk_event_stream.h"
#include "rac/infrastructure/http/rac_http_client.h"
#include "rac/infrastructure/http/rac_http_transport.h"
#include "rac/infrastructure/network/rac_auth_manager.h"
#include "rac/infrastructure/network/rac_client_info.h"
#include "rac/infrastructure/network/rac_dev_config.h"
#include "rac/infrastructure/network/rac_endpoints.h"
#include "rac/infrastructure/network/rac_environment.h"
#include "rac/infrastructure/telemetry/rac_telemetry_manager.h"
#include "rac/lifecycle/rac_sdk_init.h"
#endif

// Engine backends — linked when present (see native/CMakeLists.txt foreach).
// Required backends keep their commons headers; optional ones declare register
// only.
#ifdef RAC_HAVE_BACKEND_LLAMACPP
#include "rac/backends/rac_llm_llamacpp.h"
#endif
#ifdef RAC_HAVE_BACKEND_ONNX
#include "rac/plugin/rac_plugin_entry_onnx.h"
#endif
#ifdef RAC_HAVE_BACKEND_SHERPA
#include "rac/plugin/rac_plugin_entry_sherpa.h"
#endif
extern "C" {
#ifdef RAC_HAVE_BACKEND_QHEXRT
rac_result_t rac_backend_qhexrt_register(void);
#endif
#ifdef RAC_HAVE_BACKEND_MLX
rac_result_t rac_backend_mlx_register(void);
#endif
#ifdef RAC_HAVE_BACKEND_CLOUD
rac_result_t rac_backend_cloud_register(void);
#endif
}

// Internal (non-proto) embeddings service factory — its header lives under
// commons/src/, not include/, so re-declare the prototype here. The addon
// static-links rac_commons, so the symbol resolves at link time.
namespace rac {
namespace embeddings {
rac_result_t create_service(const char* model_id, const char* config_json,
                            rac_handle_t* out_handle);
}  // namespace embeddings
}  // namespace rac

namespace {

using rac_electron::RunNativeCall;

// The adapter struct is caller-owned and must outlive rac_shutdown().
rac_platform_adapter_t g_adapter;
std::atomic<bool> g_initialized{false};

#ifdef RAC_ELECTRON_HAVE_DESKTOP
// Owns the telemetry manager for the process lifetime so the flush at shutdown
// can deliver through our HTTP callback before teardown. Guarded by
// g_handles_mutex on create/destroy.
rac_telemetry_manager_t* g_telemetry_manager = nullptr;
#endif

// Handles are exposed to JS as small integer ids. LLM and VLM components use
// distinct rac_*_component_destroy calls, so they live in separate maps.
std::mutex g_handles_mutex;
std::unordered_map<int32_t, rac_handle_t> g_llm_handles;
std::unordered_map<int32_t, rac_handle_t> g_vlm_handles;
std::unordered_map<int32_t, rac_handle_t> g_embed_handles;
std::unordered_map<int32_t, rac_handle_t> g_stt_handles;
std::unordered_map<int32_t, rac_handle_t> g_tts_handles;
std::unordered_map<int32_t, rac_handle_t> g_vad_handles;
std::unordered_map<int32_t, rac_handle_t> g_rag_handles;
std::unordered_map<int32_t, rac_handle_t> g_rerank_handles;
std::unordered_map<int32_t, rac_handle_t> g_diar_handles;
std::unordered_map<int32_t, rac_handle_t> g_seg_handles;
int32_t g_next_handle_id = 1;

// Adapters applied to a live LLM component, tracked per handle so lora.list()
// can report state the C ABI does not query back (no rac_llm_component_*_lora
// getter exists — apply/remove/clear are write-only).
std::unordered_map<int32_t, std::vector<std::pair<std::string, float>>> g_lora_applied;

rac_handle_t handle_for(const std::unordered_map<int32_t, rac_handle_t>& map, int32_t id) {
    std::lock_guard<std::mutex> lock(g_handles_mutex);
    auto it = map.find(id);
    return (it == map.end()) ? nullptr : it->second;
}

// =============================================================================
// In-flight operation tracking — prevents destroy-during-call use-after-free.
//
// Blocking rac_* calls (generate/embed/transcribe/synthesize/rag_*) may run on
// a worker thread while another thread calls unload_*()/shutdown(). Mark a
// handle busy for every blocking op (keyed by the globally-unique integer id)
// and make unload/shutdown WAIT for the handle to go idle before destroying it.
// =============================================================================
std::condition_variable g_inflight_cv;
std::unordered_map<int32_t, int> g_inflight;  // handle id -> active blocking-op count

// A component is not re-entrant. While every blocking op ran on the JS thread
// the event loop serialised them for free; now that they run on the libuv pool,
// two awaited-in-parallel c
```

### Core Architecture Module: `bindings/electron/native/audio_bridge.cpp`
```
// audio_bridge.cpp — sync N-API wrappers over rac_audio_* DSP.
//
// Same shape as downloadProgressPercent: cheap, synchronous commons calls so
// the TypeScript audio helpers never re-implement PCM/WAV/resample/RMS math.

#include "audio_bridge.h"

#include "proto_bridge.h"

#include <cstdint>
#include <cstring>
#include <vector>

#include "rac/core/rac_audio_utils.h"
#include "rac/core/rac_types.h"

namespace rac_electron {
namespace {

void ThrowAudioError(Napi::Env env, rac_result_t code, const char* context) {
    ThrowProtoError(env, code, context);
}

Napi::Value Float32ToPcm16(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsTypedArray() ||
        info[0].As<Napi::TypedArray>().TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "audioFloat32ToPcm16(Float32Array)").ThrowAsJavaScriptException();
        return env.Null();
    }
    auto in = info[0].As<Napi::Float32Array>();
    const size_t n = in.ElementLength();
    auto out = Napi::Int16Array::New(env, n);
    const rac_result_t rc = rac_audio_float32_to_pcm16(in.Data(), n, out.Data());
    if (rc != RAC_SUCCESS) {
        ThrowAudioError(env, rc, "rac_audio_float32_to_pcm16");
        return env.Null();
    }
    return out;
}

Napi::Value Pcm16ToFloat32(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsTypedArray() ||
        info[0].As<Napi::TypedArray>().TypedArrayType() != napi_int16_array) {
        Napi::TypeError::New(env, "audioPcm16ToFloat32(Int16Array)").ThrowAsJavaScriptException();
        return env.Null();
    }
    auto in = info[0].As<Napi::Int16Array>();
    const size_t n = in.ElementLength();
    auto out = Napi::Float32Array::New(env, n);
    const rac_result_t rc = rac_audio_pcm16_to_float32(in.Data(), n, out.Data());
    if (rc != RAC_SUCCESS) {
        ThrowAudioError(env, rc, "rac_audio_pcm16_to_float32");
        return env.Null();
    }
    return out;
}

Napi::Value ResampleF32(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 3 || !info[0].IsTypedArray() ||
        info[0].As<Napi::TypedArray>().TypedArrayType() != napi_float32_array ||
        !info[1].IsNumber() || !info[2].IsNumber()) {
        Napi::TypeError::New(env, "audioResampleF32(Float32Array, inRate, outRate)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    auto in = info[0].As<Napi::Float32Array>();
    const int32_t in_rate = info[1].As<Napi::Number>().Int32Value();
    const int32_t out_rate = info[2].As<Napi::Number>().Int32Value();
    float* out = nullptr;
    size_t out_frames = 0;
    const rac_result_t rc =
        rac_audio_resample_f32(in.Data(), in.ElementLength(), in_rate, out_rate, &out, &out_frames);
    if (rc != RAC_SUCCESS) {
        ThrowAudioError(env, rc, "rac_audio_resample_f32");
        return env.Null();
    }
    auto arr = Napi::Float32Array::New(env, out_frames);
    if (out_frames && out) {
        std::memcpy(arr.Data(), out, out_frames * sizeof(float));
    }
    rac_free(out);
    return arr;
}

Napi::Value ComputeRms(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsTypedArray() ||
        info[0].As<Napi::TypedArray>().TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "audioComputeRms(Float32Array)").ThrowAsJavaScriptException();
        return env.Null();
    }
    auto in = info[0].As<Napi::Float32Array>();
    float rms = 0.0f;
    const rac_result_t rc = rac_audio_compute_rms(in.Data(), in.ElementLength(), &rms);
    if (rc != RAC_SUCCESS) {
        ThrowAudioError(env, rc, "rac_audio_compute_rms");
        return env.Null();
    }
    return Napi::Number::New(env, rms);
}

Napi::Value Float32ToWav(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsTypedArray() ||
        info[0].As<Napi::TypedArray>().TypedArrayType() != napi_float32_array ||
        !info[1].IsNumber()) {
        Napi::TypeError::New(env, "audioFloat32ToWav(Float32Array, sampleRate)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    auto in = info[0].As<Napi::Float32Array>();
    const int32_t sample_rate = info[1].As<Napi::Number>().Int32Value();
    void* wav = nullptr;
    size_t wav_size = 0;
    const rac_result_t rc = rac_audio_float32_to_wav(in.Data(), in.ByteLength(), sample_rate, &wav,
                                                    &wav_size);
    if (rc != RAC_SUCCESS) {
        ThrowAudioError(env, rc, "rac_audio_float32_to_wav");
        return env.Null();
    }
    auto buf = Napi::Buffer<uint8_t>::Copy(env, static_cast<const uint8_t*>(wav), wav_size);
    rac_free(wav);
    return buf;
}

Napi::Value PcmBytesToMs(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsObject()) {
        Napi::TypeError::New(env, "audioPcmBytesToMs(byteCount, { sampleRate, channels?, bitsPerSample? })")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    const size_t byte_count = static_cast<size_t>(info[0].As<Napi::Number>().Int64Value());
    Napi::Object fmt_obj = info[1].As<Napi::Object>();
    rac_audio_format_t format{};
    format.sample_rate =
        fmt_obj.Has("sampleRate") ? fmt_obj.Get("sampleRate").ToNumber().Int32Value() : 0;
    format.channels =
        fmt_obj.Has("channels") ? fmt_obj.Get("channels").ToNumber().Int32Value() : 1;
    format.bits_per_sample =
        fmt_obj.Has("bitsPerSample") ? fmt_obj.Get("bitsPerSample").ToNumber().Int32Value() : 32;
    int64_t out_ms = 0;
    const rac_result_t rc = rac_audio_pcm_bytes_to_ms(byte_count, &format, &out_ms);
    if (rc != RAC_SUCCESS) {
        // Missing / invalid format → 0 (commons owns the policy; SDKs must not invent).
        return Napi::Number::New(env, 0);
    }
    return Napi::Number::New(env, static_cast<double>(out_ms));
}

Napi::Value WavToFloat32(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !(info[0].IsBuffer() || info[0].IsTypedArray())) {
        Napi::TypeError::New(env, "audioWavToFloat32(Buffer|Uint8Array)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    const uint8_t* data = nullptr;
    size_t size = 0;
    if (info[0].IsBuffer()) {
        auto buf = info[0].As<Napi::Buffer<uint8_t>>();
        data = buf.Data();
        size = buf.Length();
    } else {
        auto ta = info[0].As<Napi::TypedArray>();
        if (ta.TypedArrayType() != napi_uint8_array) {
            Napi::TypeError::New(env, "audioWavToFloat32(Buffer|Uint8Array)")
                .ThrowAsJavaScriptException();
            return env.Null();
        }
        auto u8 = info[0].As<Napi::Uint8Array>();
        data = u8.Data();
        size = u8.ByteLength();
    }

    float* samples = nullptr;
    size_t n_samples = 0;
    int32_t sample_rate = 0;
    const rac_result_t rc =
        rac_audio_wav_to_float32(data, size, &samples, &n_samples, &sample_rate);
    if (rc != RAC_SUCCESS) {
        ThrowAudioError(env, rc, "rac_audio_wav_to_float32");
        return env.Null();
    }

    auto arr = Napi::Float32Array::New(env, n_samples);
    if (n_samples && samples) {
        std::memcpy(arr.Data(), samples, n_samples * sizeof(float));
    }
    rac_free(samples);

    Napi::Object out = Napi::Object::New(env);
    out.Set("sampleRate", Napi::Number::New(env, sample_rate));
    out.Set("samples", arr);
    return out;
}

}  // namespace

void RegisterAudioBridge(Napi::Env env, Napi::Object exports) {
    exports.Set("audioFloat32ToPcm16", Napi::Function::New(env, Float32ToPcm16));
    exports.Set("audioPcm16ToFloat32", Napi::Function::New(env, Pcm16ToFloat32));
    exports.Set("audioResampleF32", Napi::Function::New(env, ResampleF32));
    exports.Set("audioComputeRms", Napi::F
```

### Core Architecture Module: `bindings/electron/native/audio_bridge.h`
```
#ifndef RUNANYWHERE_ELECTRON_AUDIO_BRIDGE_H
#define RUNANYWHERE_ELECTRON_AUDIO_BRIDGE_H

#include <napi.h>

namespace rac_electron {

void RegisterAudioBridge(Napi::Env env, Napi::Object exports);

}  // namespace rac_electron

#endif  // RUNANYWHERE_ELECTRON_AUDIO_BRIDGE_H

```

### Core Architecture Module: `bindings/electron/native/data_bridge.cpp`
```
// data_bridge.cpp — embeddings, rerank, diarization, and segmentation over the
// proto ABI, plus sync commons vector math (norm / cosine similarity).
//
// Three of the four are lifecycle-owned and handle-free like the rest of the
// migrated surface. Rerank is the exception: commons exposes only
// rac_rerank_component_rerank_proto, which takes the component handle, so the
// handle is threaded in from the TypeScript side that owns the slot.
//
// embeddingsNorm / embeddingsSimilarity mirror audio_bridge's sync DSP shape so
// TypeScript never re-implements vector math.

#include "data_bridge.h"

#include "proto_bridge.h"

#include <cstdint>

#include "rac/features/diarization/rac_diarization_service.h"
#include "rac/features/embeddings/rac_embeddings_service.h"
#include "rac/features/embeddings/rac_embeddings_types.h"
#include "rac/features/rerank/rac_rerank_component.h"
#include "rac/features/segmentation/rac_segmentation_service.h"

namespace rac_electron {
namespace {

Napi::Value EmbedBatch(const Napi::CallbackInfo& info) {
    return RunProtoUnary(info.Env(), "embeddings_embed_batch",
                         rac_embeddings_embed_batch_lifecycle_proto,
                         RequireProtoBytes(info, 0, "embedBatchProto(requestBytes)"));
}

Napi::Value Rerank(const Napi::CallbackInfo& info) {
    if (info.Length() < 1 || !info[0].IsNumber()) {
        throw Napi::TypeError::New(info.Env(),
                                   "rerankProto(handle, requestBytes) expects a handle");
    }
    const auto handle = reinterpret_cast<rac_handle_t>(
        static_cast<intptr_t>(info[0].As<Napi::Number>().Int64Value()));
    return RunProtoOnHandle(info.Env(), "rerank", rac_rerank_component_rerank_proto, handle,
                            RequireProtoBytes(info, 1, "rerankProto(handle, requestBytes)"),
                            nullptr);
}

Napi::Value Diarize(const Napi::CallbackInfo& info) {
    return RunProtoUnary(info.Env(), "diarization_diarize",
                         rac_diarization_diarize_lifecycle_proto,
                         RequireProtoBytes(info, 0, "diarizeProto(requestBytes)"));
}

Napi::Value Segment(const Napi::CallbackInfo& info) {
    return RunProtoUnary(info.Env(), "segmentation_segment",
                         rac_segmentation_segment_lifecycle_proto,
                         RequireProtoBytes(info, 0, "segmentProto(requestBytes)"));
}

Napi::Value EmbeddingsNorm(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsTypedArray() ||
        info[0].As<Napi::TypedArray>().TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "embeddingsNorm(Float32Array)").ThrowAsJavaScriptException();
        return env.Null();
    }
    auto in = info[0].As<Napi::Float32Array>();
    float norm = 0.0f;
    const rac_result_t rc = rac_embeddings_norm(in.Data(), in.ElementLength(), &norm);
    if (rc != RAC_SUCCESS) {
        ThrowProtoError(env, rc, "rac_embeddings_norm");
        return env.Null();
    }
    return Napi::Number::New(env, norm);
}

Napi::Value EmbeddingsSimilarity(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsTypedArray() || !info[1].IsTypedArray() ||
        info[0].As<Napi::TypedArray>().TypedArrayType() != napi_float32_array ||
        info[1].As<Napi::TypedArray>().TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "embeddingsSimilarity(Float32Array, Float32Array)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    auto lhs = info[0].As<Napi::Float32Array>();
    auto rhs = info[1].As<Napi::Float32Array>();
    float similarity = 0.0f;
    const rac_result_t rc = rac_embeddings_similarity(
        lhs.Data(), lhs.ElementLength(), rhs.Data(), rhs.ElementLength(), &similarity);
    if (rc != RAC_SUCCESS) {
        ThrowProtoError(env, rc, "rac_embeddings_similarity");
        return env.Null();
    }
    return Napi::Number::New(env, similarity);
}

}  // namespace

void RegisterDataBridge(Napi::Env env, Napi::Object exports) {
    exports.Set("embedBatchProto", Napi::Function::New(env, EmbedBatch));
    exports.Set("rerankProto", Napi::Function::New(env, Rerank));
    exports.Set("diarizeProto", Napi::Function::New(env, Diarize));
    exports.Set("segmentProto", Napi::Function::New(env, Segment));
    exports.Set("embeddingsNorm", Napi::Function::New(env, EmbeddingsNorm));
    exports.Set("embeddingsSimilarity", Napi::Function::New(env, EmbeddingsSimilarity));
}

}  // namespace rac_electron

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #906** (2026-09-11): **Flutter's generateStructured skips include_schema_in_prompt entirely**
  *Symptoms*: Follow-up from #825 by @ayaangazali -- thanks again for that PR!  ## What The fix in #825 makes commons (`structured_output_config_from_options` in `core/src/features/llm/structured_output.cpp:342-349`) honor `include_schema_in_prompt`'s documented default (`true`) when the field is unset. But Swift (`bindings/swift/Sources/RunAnywhere/Public/Extensions/LLM/RunAnywhere+StructuredOutput.swift:75`), Kotlin (`bindings/kotlin/.../RunAnywhereStructuredOutput.kt:55`, checked `== true`) and Flutter (`bindings/flutter/packages/runanywhere/lib/public/extensions/runanywhere_structured_output.dart:76`) each gate on the SDK-side value of the flag *before* ever calling into commons, so an unset flag never reaches the fixed code path. Flutter is the worst-affected: `RunAnywhere.llm.generateStructured` builds `StructuredOutputOptions(schema: schema)` without ever setting the flag, so the gate is always skipped and the model never sees the schema in the prompt on that path.  ## Why it matters Web already normalizes an unset flag to `true` (`bindings/web/packages/core/src/Public/Extensions/RunAnywhere+StructuredOutput.ts:119`), so the bundled SDKs currently disagree on the default, and Flutter's public `generateStructured` silently drops the schema from the prompt on every call -- the same class of bug #825 fixes, just one layer up in the SDK gating instead of in commons.  ## Suggested approach Either drop the SDK-side gate so every SDK always calls into commons and lets the (now-correct) def
  **Post-Mortem & Fix Analysis**:
  > Fixed by #840.

- **Issue #852** (2026-09-11): **React Native: models.refresh() skips the local rescan when services init fails**
  *Symptoms*: Follow-up from #720 by @ayaangazali — thanks again for that PR!  ## What `RunAnywhere.models.refresh()` (added in #720) forwards to `refreshModelRegistry` in `bindings/react-native/packages/core/src/Public/Extensions/Models/RunAnywhere+ModelRegistry.ts`. At lines 1063-1070 that helper awaits the throwing `ensureServicesReady()` inside the same `try` as `native.refreshModelRegistry(...)`. If the guard rejects, the native call never runs, so neither the downloaded-model discovery pre-pass nor the registry refresh happens. The guard rejects when `completeServicesInitialization` rethrows (`Public/RunAnywhere.ts:222`) or when `retryHTTPSetupInternal` rethrows (`Public/RunAnywhere.ts:631`). Swift (`RunAnywhere+ModelRegistry.swift:48-52`, `try? await ensureServicesReady()`) and Kotlin (`RunAnywhereModelRegistry.kt:143-151`, catch and continue) still rescan in that case.  ## Why it matters `models.refresh()` is the only React Native call that picks up model files changed on disk, and it is a local-only operation. When the network phase or HTTP retry fails, the call currently does nothing and gives no signal, while Swift and Kotlin still reconcile the registry. `Foundation/Initialization/ServicesReadyGuard.ts:36-38` already names `refreshModelRegistry` as a call site that should use `ensureServicesReadyOrIgnore()`.  ## Suggested approach - Call `await ensureServicesReadyOrIgnore();` before the `try`. It is already imported at line 24, and `listModels` and `getModel` use it at lines 40
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to pick this up! I'll follow the suggested approach to ensure models.refresh() still reaches the native refresh even if the guard rejects.

- **Issue #693** (2026-08-16): **Every Swift release after v0.20.14 is unusable: ONNX plugin stops registering, 0.20.18 does not compile, v0.20.19 has no artifacts**
  *Symptoms*: @sanchitmonga22  Ambient is stuck on `89de67bb4` (v0.20.14 + 2, cut by @Siddhesh2377). That one works. Everything released after it breaks for us, three separate ways.  **0.20.15 / 0.20.16 / 0.20.17.** The ONNX plugin stops registering. Diarization fails with `no registered backend serves the requested primitive`, and ONNX embeddings go with it. Sherpa still registers, so speech keeps working and nothing looks wrong until a load fails. Engine sources are identical to 0.20.14, so this arrived with the rebuilt binaries. Guess: the ABI v8 to v9 bump against a stale ONNX archive.  **0.20.18.** #666 untracked the generated Swift sources (42 files down to 1). CMake regenerates them for C++ and Gradle for Kotlin, but SwiftPM has no equivalent hook, so `RunAnywhere` no longer compiles for any SwiftPM consumer.  **v0.20.19.** Tag with no release, so the binaries 404. Any `from:` requirement resolves to it and fails.  ### How we found it  Rebuilt Ambient on each version. Diarization loads on 0.20.14 and fails from 0.20.16 up, with MLX unlinked, so it is not something on our side.  ### What we are doing  Staying pinned to `89de67bb4` until 0.20.x registers ONNX again. We are testing MLX on macOS against that pin: LLM and embeddings both run through it fine.  ### One fix we have ready to PR  `architectureHints(from:)` in `MLXRuntime/MLX.swift` reads only `model_type`, `architecture` and `architectures`. NeMo configs name the class in `target`, which is where `nemo.collections.asr.models`
  **Post-Mortem & Fix Analysis**:
  > Two more findings from wiring ANE into Ambient.  **ANE cannot serve ASR at all.** `engines/neurt/rac_plugin_entry_neurt.cpp` has `stt_ops = nullptr`; only `llm_ops` and `diffusion_ops` are filled. So the published `parakeet-*_ANE` and `whisper-*_ANE` bundles have nothing to drive them. This is a NeuRT feature, not an SDK patch, so I have not touched it.  **Registering a published `_ANE` bundle by repo URL downloads it incomplete.** With `runanywhere/Qwen3-0.6B_ANE` and `framework: .coreml`, everything lands except the two `*.mlpackage/Data/com.apple.CoreML/weights/weight.bin` blobs (880 MB and 311 MB). The registry then correctly refuses it:  ``` Folder '.../CoreML/qwen3-0.6b-ane' incomplete for model 'qwen3-0.6b-ane'   (first missing: qwen3_0_6b_decode.mlpackage/Data/com.apple.CoreML/weights/weight.bin) Refresh rescan: 'qwen3-0.6b-ane' folder is incomplete — leaving unlinked ```  Not depth or LFS: `qwen3_0_6b_embed_f16.bin` (311 MB, LFS) and both `model.mlmodel` files come down fine, 
  > Closing this. It was opened to get a review rather than to track a single defect, and the six claims in it have gone six different ways, so it is not a useful unit of work any more.  Where each one landed, audited against main at 0.20.22 and the published artifacts:  | Claim | State | |---|---| | MLX Parakeet unreachable without the `target` hint | Fixed in #694 | | v0.20.19 tagged with no release | Fixed, the release is published with 55 assets | | 0.20.18 does not compile for SwiftPM | Working as intended for the monorepo; consumers use `runanywhere-swift`, which carries all 42 generated files at .17, .18 and .19 | | ONNX plugin stops registering | Still real, see below | | ANE cannot serve ASR | Still real, `stt_ops` is `nullptr` in `rac_plugin_entry_neurt.cpp` | | `_ANE` bundle downloads incomplete by repo URL | Not verified |  The one worth carrying forward is ONNX, and it is broader than the report said. `librac_backend_onnx.a` is byte-identical between v0.20.17 and v0.20.19:  ``

- **Issue #636** (2026-08-16): **rac_model_storage_metrics_t has no documented free function for the strings get_model_metrics allocates**
  *Symptoms*: `rac_storage_analyzer_get_model_metrics` fills the out struct with three heap copies:  ```cpp out_metrics->model_id = model->id ? strdup(model->id) : nullptr; out_metrics->model_name = model->name ? strdup(model->name) : nullptr; ... out_metrics->local_path = strdup(model->local_path); ```  The header (`include/rac/infrastructure/storage/rac_storage_analyzer.h`) documents no free function for `rac_model_storage_metrics_t`, and `rac_storage_info_free` covers the array-returning call rather than this one. So a caller of the single-model function has no documented way to release those three strings.  Every SDK reaches this through the C ABI, so if there is no intended owner the leak is per call on all of them.  Three ways this could go, and I do not know which you intend:  1. A `rac_model_storage_metrics_free` exists and I missed it, in which case the header should reference it from `get_model_metrics`. 2. The caller is meant to free the fields directly, in which case documenting that on the function is enough. 3. It is a genuine gap and wants a new free function, which is ABI surface and your call.  Raising rather than guessing, since adding a public function is not something to slip into a bug fix. Noticed while working on #625, which fixes an unrelated error-path issue in the same function. 

- **Issue #633** (2026-08-11): **fix(rcli): complete the FNV-1a digest behind local model ids**
  *Symptoms*: ## What  `id_for_local_path` pins a local model's id to its full path, because the basename alone collides:  > The basename alone collides — every `.../model.mlpackage` sanitizes to the same string — so pin the id to the whole path with an FNV-1a digest.  Two things stopped it being that digest.  **1. The offset basis is a digit short.**  ```cpp uint64_t hash = 1469598103934665603ULL; ```  The FNV-1a 64-bit basis is `14695981039346656037` (`0xcbf29ce484222325`), 20 digits. The literal is that value with the trailing digit dropped, 19 digits. The prime on the next line is the correct `1099511628211`, so the intent is unambiguous.  **2. Half the hash never reaches the id.**  ```cpp for (int shift = 28; shift >= 0; shift -= 4) { ```  That emits 8 nibbles, so only bits 31-0 of a 64-bit hash are used. A 64-bit value needs shifts 60 down to 0.  ## Why it matters  The digest exists so two bundles sharing a basename get distinct ids. Truncating to 32 bits shrinks that guarantee from 2^64 to 2^32, and paths differing solely above bit 31 collide outright. When they do, the second registration lands on the first one's id.  Concretely, for two different paths with the same basename:  ``` /Users/me/models/model.mlpackage   before: local-model.mlpackage-eb4d5469          (8 hex)   after : local-model.mlpackage-f57ae22d33b5f963  (16 hex)  /var/lib/ra/model.mlpackage   before: local-model.mlpackage-555bb248          (8 hex)   after : local-model.mlpackage-3377f1976fc23a32  (16 hex) ```  ## T
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/633?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review paused by coderabbit.ai -->  > [!NOTE] > ## Reviews paused >  > It looks like this branch is under active development. To avoid overwhelming you with review comments due to an influx of new commits, CodeRabbit has automatically paused this review. You can configure this behavior by changing the `reviews.auto_review.auto_pause_after_reviewed_commits` setting. >  > Use the following commands to manage reviews: > - `@coderabbitai resume` to resume automatic reviews. > - `@coderabbitai review` to trigger a single review. >  > Use the checkbox
  > These failures are a GitHub Actions outage, not this diff. Every failing job died on the same step, before any of them reached the code:  ``` Failed to resolve action download info. Error: Service Unavailable ##[error]Service Unavailable ```  That is identical across `rcli-macos`, `kotlin-android`, `linux-asan`, `centralization` and `Gitleaks Secret Scan`, with nine further jobs cancelled as collateral. `rcli-macos` never got as far as building, so nothing here exercised the change.  Two other signals that it is platform-side: another branch (`siddhesh/sdk-fixes-v2`) has four runs failing in the same window, and `Legacy file blocklist` passed on this branch during it. `main` has no failing checks.  A run is still in progress, so I am leaving it to finish rather than force-pushing over it. If it settles red on the same error I will re-trigger with an identical diff.  For what it is worth locally: `test_rcli_unit --run-all` is 25 passed, 0 failed with this change, configured with `-DRAC_
  > Adding the decisive detail, since these keep getting read as code failures.  Each of the six failing jobs contains exactly **one** step, and it is `Set up job`:  | job | steps | |---|---| | centralization | `failure: Set up job` | | Gitleaks Secret Scan | `failure: Set up job` | | linux-asan | `failure: Set up job` | | rcli-macos | `failure: Set up job` | | android-arm64 | `failure: Set up job` | | kotlin-android | `failure: Set up job` |  There is no checkout step, no build step and no test step in any of them. The runner failed while resolving the actions themselves:  ``` Failed to resolve action download info. Error: Service Unavailable ```  So the branch was never fetched onto the runner, and nothing in this diff was compiled or executed. A one-line change in `model_ref.cpp` cannot affect `Set up job`, and it certainly cannot affect Gitleaks or kotlin-android.  Still not pushing a speculative fix. These need a re-run once the platform is healthy, which is not something I can trigge

- **Issue #631** (2026-08-11): **test(qhexrt): enumerate lfm2_5_2_6b under v75 and v81**
  *Symptoms*: ## What  `test_native_catalog_owns_arch_and_auth_policy` checks per-arch support against exact set membership:  ```cpp ASSERT_EQ(rac_qhexrt_catalog_model_supports_arch(id.c_str(), RAC_QHEXRT_HEXAGON_ARCH_V75),           v75.count(id) == 0 ? RAC_FALSE : RAC_TRUE); ```  `lfm2_5_2_6b` is enumerated only in the `v79` set, but the catalog grants it every supported arch:  ```cpp {"lfm2_5_2_6b", kAllSupportedArches, false},   // kV75 | kV79 | kV81 ```  and the accessor answers straight off that mask:  ```cpp return policy != nullptr && (policy->arch_mask & arch_mask(arch)) != 0 ? RAC_TRUE : RAC_FALSE; ```  So for V75 and V81 the catalog returns `RAC_TRUE` while the test expects `RAC_FALSE`. Two assertions contradict the policy they exist to pin.  Looks like a seam between the two PRs: #624 added v79 support and enumerated it, then #628 widened the policy to v75/v81 (its title and the row's comment both say so) without extending the sets.  The union feeds the count assertion, and the id was already in `v79`, so `all.size()` is unchanged by this and `ASSERT_EQ(all.size(), rac_qhexrt_catalog_model_count())` still holds.  ## Why it went unnoticed  The target is gated on the private Hexagon backend:  ```cmake if(RAC_BACKEND_QHEXRT AND TARGET rac_backend_qhexrt AND NOT TARGET test_qhexrt_model_catalog) ```  so it is not built by the macOS or Linux CI lanes, and `main` stays green with the contradiction in place. It surfaces on a build that actually enables the qhexrt backend, which is the
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/631?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `c1408a3b-1cdc-47a6-b532-52593fef79ce`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 78d62246c8a75e0dd6efe7c706d5a9ac4be85163 and 4fd0f59b128f6a2423c60e40fc260bdc61488b89.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `eng
  > Closing as already-landed: a byte-identical hunk went in via `ac9aebbcd5` (#641) four days after you opened this. Thanks for catching it independently.  One thing worth knowing for next time: this patch wouldn't have gone green on its own. `cosmos3_edge_text`, `cosmos3_edge_vlm` and `cosmos3_edge_diffusion` had the same V79 mismatch, and #641 had to fix all four together.  **Follow-up I'd genuinely like:** the arch expectations are three hand-copied `unordered_set` literals, which is why they drift. Deriving them from the policy table instead would make this class of mismatch impossible. Related — the `all.size() == model_count()` guard is structurally blind to a mask widening, so it can't catch the failure it looks like it's guarding. Either of those would be a real improvement.

- **Issue #623** (2026-08-11): **fix(python): stop the async stream dropping its terminal sentinel**
  *Symptoms*: ## What  `_AsyncBridge` signals both completion and failure with a bare `put_nowait` posted to the loop thread:  ```python def _on_done(self) -> None:     self._loop.call_soon_threadsafe(self._q.put_nowait, _DONE)  def _on_error(self) -> None:     self._loop.call_soon_threadsafe(self._q.put_nowait, _ERROR) ```  The queue is bounded (`maxsize` defaults to 64). When it is saturated at that moment, `put_nowait` raises `asyncio.QueueFull` **inside the loop callback**, where the event loop's exception handler logs it and moves on. The sentinel is simply gone, and nothing else will post one.  `aiter_tokens` is then parked on `await bridge.get()` forever, so the caller's `async for` never ends and the worker thread is never joined.  ## Why this is an oversight rather than a choice  Every sibling path in the same file already handles it:  - **Tokens, same class:** `_enqueue` catches `QueueFull` and reschedules itself until the consumer drains. That is the file's own backpressure mechanism, so the author knew the queue fills. - **Sync bridge:** `_on_done` / `_on_error` use a blocking `self._q.put(...)`, which waits for space and cannot lose the sentinel.  The async terminal path was the only one that could drop its message. This routes both sentinels through the same reschedule, bailing out when `_stop` is set, since by then the consumer has gone and there is nobody to hand it to.  The trigger is ordinary: a consumer slower than the producer, which is the normal case for a local model
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/RunanywhereAI/runanywhere-sdks/pull/623?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `682d8d41-c656-4ddf-a0c0-b468dc0ee880`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between ac9aebbcd5c1f49395cc25c0376bedb7bf1bb7f1 and 3e7645fb777f3808aae424c727f18d5e954abb03.  </details>  <details> <summary>📒 Files selected for processing (2)</summary>  * `sdk
  > <!-- This is an auto-generated comment by CodeRabbit --> > [!NOTE] > GitHub couldn't provide a complete incremental comparison for this pull request, so CodeRabbit is performing a full review instead. This review may take a little longer.

- **Issue #577** (2026-08-16): **[Bug]: LlamaCpp backend crashes on every model load: bad free() inside gguf_kv_to_str (SIGSEGV/SIGABRT)**
  *Symptoms*: ### Component  Android SDK  ### Bug Description  **Package:** `runanywhere_llamacpp` 0.20.10 (also `runanywhere` 0.20.10) **Native lib BuildId:** `0937032a10f017dca1485a032d095e92a4000f5f` (`librac_backend_llamacpp.so`)      ## Summary       Every call to `RunAnywhere.loadModel(...)` for a LlamaCpp/GGUF model crashes the app natively during model loading.   Reproduced on **2 different GGUF models** across **2 different devices/OS versions/allocators**, always breaking at the exact   same call path: `llama_model_loader` constructor → `gguf_kv_to_str` → an invalid `free()`.      This is not a corrupt/truncated download or a bad model file — see verification steps below. It looks like a   heap-corruption/invalid-free bug inside the vendored `gguf_kv_to_str` in this backend build.     ## Repro (minimal)                                                                                                                                                                                                                                              ```dart                                                                                                                         void main() async {                                                                                                               WidgetsFlutterBinding.ensureInitialized();                                                                                      await RunAnywhere.initialize(); // SDK_ENVIRONMENT_DEVELOPMENT    
  **Post-Mortem & Fix Analysis**:
  > @Siddhesh2377 can you take a look ? 
  > Closing as stale. 0.20.10 is a long way behind, and the build you crashed on no longer exists in any current release.  The llama.cpp base changed underneath this. 0.20.10 pinned `LLAMACPP_VERSION=b9959` from upstream; from 0.20.13 onward the SDK builds against a different fork entirely, `prism-b9591-62061f9` from `PrismML-Eng/llama.cpp`. So `gguf_kv_to_str` in today's `librac_backend_llamacpp.so` is not the function your BuildId `0937032a10f017dca1485a032d095e92a4000f5f` was built from, and re-reading that code would not tell us anything about your crash.  @kapil708 thank you for the report, it was unusually careful. Ruling out truncation by `Content-Length`, hand-parsing the GGUF v3 KV entries on both files, and catching the tagged-pointer abort on the POCO device is exactly the evidence that makes a native crash actionable.  If it still reproduces, please open a fresh issue against the current release rather than reopening this one, and include:  - the SDK version and the new `librac

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

Co-authored-by: Cursor <cursoragent@cursor.com>

* 

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
+        disableThinking = v
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

```

#### Recent Merged Pull Requests:
- **PR #967** (2026-09-23): release: sync v0.20.37 Apple checksums (@Siddhesh2377)
- **PR #964** (2026-09-22): fix(server): support local coding harness tool conversations (@sanchitmonga22)
- **PR #955** (closed): Preserve registration metadata across SDKs (@shubhamsinnh)
- **PR #858** (2026-09-11): fix(rn-sdk): use ensureServicesReadyOrIgnore in refreshModelRegistry (@kragent66-glitch)
- **PR #847** (2026-09-11): fix(rag): every chunk of a CJK document is invalid UTF-8 (@ayaangazali)
- **PR #846** (2026-09-22): commons: log capability-unsupported at DEBUG, not WARN (0.20.37) (@Siddhesh2377)
- **PR #845** (2026-09-11): fix(rag): rerank snippets are cut mid-UTF-8 character (@ayaangazali)
- **PR #841** (2026-09-11): fix(embeddings): an explicit normalize=false never reaches the engine (@ayaangazali)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
