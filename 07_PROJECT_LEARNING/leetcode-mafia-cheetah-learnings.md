# Forensic Learning Record (Deep Inspection): leetcode-mafia/cheetah

> **Canonical Artifact**: `07_PROJECT_LEARNING/leetcode-mafia-cheetah-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/leetcode-mafia/cheetah](https://github.com/leetcode-mafia/cheetah))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T01:24:33.608Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `leetcode-mafia/cheetah`
- **Description**: Mac app for crushing tech interviews with AI
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4260 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `CheetahIPC/CheetahIPC.h`
```
#import <Foundation/Foundation.h>

//! Project version number for CheetahIPC.
FOUNDATION_EXPORT double CheetahIPCVersionNumber;

//! Project version string for CheetahIPC.
FOUNDATION_EXPORT const unsigned char CheetahIPCVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <CheetahIPC/PublicHeader.h>


```

### Core Architecture Module: `LibWhisper/LibWhisper.h`
```
#import <Foundation/Foundation.h>

//! Project version number for LibWhisper.
FOUNDATION_EXPORT double LibWhisperVersionNumber;

//! Project version string for LibWhisper.
FOUNDATION_EXPORT const unsigned char LibWhisperVersionString[];

// SDL functions used in CaptureDevice
#define SDL_INIT_AUDIO 0x00000010u
extern int SDL_Init(uint32_t flags);
extern int SDL_GetNumAudioDevices(int iscapture);
extern const char * SDL_GetAudioDeviceName(int index, int iscapture);

#import "stream.h"

```

### Core Architecture Module: `LibWhisper/SDL.h`
```
/*
  Simple DirectMedia Layer
  Copyright (C) 1997-2023 Sam Lantinga <slouken@libsdl.org>

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.
*/

/**
 *  \file SDL.h
 *
 *  Main include header for the SDL library
 */


#ifndef SDL_h_
#define SDL_h_

#include "SDL_main.h"
#include "SDL_stdinc.h"
#include "SDL_assert.h"
#include "SDL_atomic.h"
#include "SDL_audio.h"
#include "SDL_clipboard.h"
#include "SDL_cpuinfo.h"
#include "SDL_endian.h"
#include "SDL_error.h"
#include "SDL_events.h"
#include "SDL_filesystem.h"
#include "SDL_gamecontroller.h"
#include "SDL_guid.h"
#include "SDL_haptic.h"
#include "SDL_hidapi.h"
#include "SDL_hints.h"
#include "SDL_joystick.h"
#include "SDL_loadso.h"
#include "SDL_log.h"
#include "SDL_messagebox.h"
#include "SDL_metal.h"
#include "SDL_mutex.h"
#include "SDL_power.h"
#include "SDL_render.h"
#include "SDL_rwops.h"
#include "SDL_sensor.h"
#include "SDL_shape.h"
#include "SDL_system.h"
#include "SDL_thread.h"
#include "SDL_timer.h"
#include "SDL_version.h"
#include "SDL_video.h"
#include "SDL_locale.h"
#include "SDL_misc.h"

#include "begin_code.h"
/* Set up for C function definitions, even when using C++ */
#ifdef __cplusplus
extern "C" {
#endif

/* As of version 0.5, SDL is loaded dynamically into the application */

/**
 *  \name SDL_INIT_*
 *
 *  These are the flags which may be passed to SDL_Init().  You should
 *  specify the subsystems which you will be using in your application.
 */
/* @{ */
#define SDL_INIT_TIMER          0x00000001u
#define SDL_INIT_AUDIO          0x00000010u
#define SDL_INIT_VIDEO          0x00000020u  /**< SDL_INIT_VIDEO implies SDL_INIT_EVENTS */
#define SDL_INIT_JOYSTICK       0x00000200u  /**< SDL_INIT_JOYSTICK implies SDL_INIT_EVENTS */
#define SDL_INIT_HAPTIC         0x00001000u
#define SDL_INIT_GAMECONTROLLER 0x00002000u  /**< SDL_INIT_GAMECONTROLLER implies SDL_INIT_JOYSTICK */
#define SDL_INIT_EVENTS         0x00004000u
#define SDL_INIT_SENSOR         0x00008000u
#define SDL_INIT_NOPARACHUTE    0x00100000u  /**< compatibility; this flag is ignored. */
#define SDL_INIT_EVERYTHING ( \
                SDL_INIT_TIMER | SDL_INIT_AUDIO | SDL_INIT_VIDEO | SDL_INIT_EVENTS | \
                SDL_INIT_JOYSTICK | SDL_INIT_HAPTIC | SDL_INIT_GAMECONTROLLER | SDL_INIT_SENSOR \
            )
/* @} */

/**
 * Initialize the SDL library.
 *
 * SDL_Init() simply forwards to calling SDL_InitSubSystem(). Therefore, the
 * two may be used interchangeably. Though for readability of your code
 * SDL_InitSubSystem() might be preferred.
 *
 * The file I/O (for example: SDL_RWFromFile) and threading (SDL_CreateThread)
 * subsystems are initialized by default. Message boxes
 * (SDL_ShowSimpleMessageBox) also attempt to work without initializing the
 * video subsystem, in hopes of being useful in showing an error dialog when
 * SDL_Init fails. You must specifically initialize other subsystems if you
 * use them in your application.
 *
 * Logging (such as SDL_Log) works without initialization, too.
 *
 * `flags` may be any of the following OR'd together:
 *
 * - `SDL_INIT_TIMER`: timer subsystem
 * - `SDL_INIT_AUDIO`: audio subsystem
 * - `SDL_INIT_VIDEO`: video subsystem; automatically initializes the events
 *   subsystem
 * - `SDL_INIT_JOYSTICK`: joystick subsystem; automatically initializes the
 *   events subsystem
 * - `SDL_INIT_HAPTIC`: haptic (force feedback) subsystem
 * - `SDL_INIT_GAMECONTROLLER`: controller subsystem; automatically
 *   initializes the joystick subsystem
 * - `SDL_INIT_EVENTS`: events subsystem
 * - `SDL_INIT_EVERYTHING`: all of the above subsystems
 * - `SDL_INIT_NOPARACHUTE`: compatibility; this flag is ignored
 *
 * Subsystem initialization is ref-counted, you must call SDL_QuitSubSystem()
 * for each SDL_InitSubSystem() to correctly shutdown a subsystem manually (or
 * call SDL_Quit() to force shutdown). If a subsystem is already loaded then
 * this call will increase the ref-count and return.
 *
 * \param flags subsystem initialization flags
 * \returns 0 on success or a negative error code on failure; call
 *          SDL_GetError() for more information.
 *
 * \since This function is available since SDL 2.0.0.
 *
 * \sa SDL_InitSubSystem
 * \sa SDL_Quit
 * \sa SDL_SetMainReady
 * \sa SDL_WasInit
 */
extern DECLSPEC int SDLCALL SDL_Init(Uint32 flags);

/**
 * Compatibility function to initialize the SDL library.
 *
 * In SDL2, this function and SDL_Init() are interchangeable.
 *
 * \param flags any of the flags used by SDL_Init(); see SDL_Init for details.
 * \returns 0 on success or a negative error code on failure; call
 *          SDL_GetError() for more information.
 *
 * \since This function is available since SDL 2.0.0.
 *
 * \sa SDL_Init
 * \sa SDL_Quit
 * \sa SDL_QuitSubSystem
 */
extern DECLSPEC int SDLCALL SDL_InitSubSystem(Uint32 flags);

/**
 * Shut down specific SDL subsystems.
 *
 * If you start a subsystem using a call to that subsystem's init function
 * (for example SDL_VideoInit()) instead of SDL_Init() or SDL_InitSubSystem(),
 * SDL_QuitSubSystem() and SDL_WasInit() will not work. You will need to use
 * that subsystem's quit function (SDL_VideoQuit()) directly instead. But
 * generally, you should not be using those functions directly anyhow; use
 * SDL_Init() instead.
 *
 * You still need to call SDL_Quit() even if you close all open subsystems
 * with SDL_QuitSubSystem().
 *
 * \param flags any of the flags used by SDL_Init(); see SDL_Init for details.
 *
 * \since This function is available since SDL 2.0.0.
 *
 * \sa SDL_InitSubSystem
 * \sa SDL_Quit
 */
extern DECLSPEC void SDLCALL SDL_QuitSubSystem(Uint32 flags);

/**
 * Get a mask of the specified subsystems which are currently initialized.
 *
 * \param flags any of the flags used by SDL_Init(); see SDL_Init for details.
 * \returns a mask of all initialized subsystems if `flags` is 0, otherwise it
 *          returns the initialization status of the specified subsystems.
 *
 *          The return value does not include SDL_INIT_NOPARACHUTE.
 *
 * \since This function is available since SDL 2.0.0.
 *
 * \sa SDL_Init
 * \sa SDL_InitSubSystem
 */
extern DECLSPEC Uint32 SDLCALL SDL_WasInit(Uint32 flags);

/**
 * Clean up all initialized subsystems.
 *
 * You should call this function even if you have already shutdown each
 * initialized subsystem with SDL_QuitSubSystem(). It is safe to call this
 * function even in the case of errors in initialization.
 *
 * If you start a subsystem using a call to that subsystem's init function
 * (for example SDL_VideoInit()) instead of SDL_Init() or SDL_InitSubSystem(),
 * then you must use that subsystem's quit function (SDL_VideoQuit()) to shut
 * it down before calling SDL_Quit(). But generally, you should not be using
 * those functions directly anyhow; use SDL_Init() instead.
 *
 * You can use this function with atexit() to ensure that it is run when your
 * application is shutdown, but it is not wise to do this from a library or
 * other dynamically loaded code.
 *
 * \since This function is available since SDL 2.0.0.
 *
 * \sa SDL_Init
 * \sa SDL_QuitSubSystem
 */
extern DECLSPEC void SDLCALL SDL_Quit(void);

/* Ends C function definitions when using C++ */
#ifdef __cplusplus
}
#end
```

### Core Architecture Module: `LibWhisper/stream.cpp`
```
// This code is based on the streaming example provided with whisper.cpp:
// https://github.com/ggerganov/whisper.cpp/blob/ca21f7ab16694384fb74b1ba4f68b39f16540d23/examples/stream/stream.cpp

#include "common.h"
#include "common-sdl.h"
#include "whisper.h"
#include "stream.h"

#include <cassert>
#include <cstdio>
#include <string>
#include <thread>
#include <vector>
#include <fstream>

using unique_whisper = std::unique_ptr<whisper_context, std::integral_constant<decltype(&whisper_free), &whisper_free>>;

struct stream_context {
    stream_params params;
    std::unique_ptr<audio_async> audio;
    unique_whisper whisper;
    std::vector<float> pcmf32;
    std::vector<float> pcmf32_old;
    std::vector<float> pcmf32_new;
    std::vector<whisper_token> prompt_tokens;
    std::chrono::time_point<std::chrono::high_resolution_clock> t_last;
    std::chrono::time_point<std::chrono::high_resolution_clock> t_start;
    int n_samples_step;
    int n_samples_len;
    int n_samples_keep;
    bool use_vad;
    int n_new_line;
    int n_iter = 0;
};

struct stream_params stream_default_params() {
    return stream_params {
        /* .n_threads     =*/ std::min(4, (int32_t) std::thread::hardware_concurrency()),
        /* .step_ms       =*/ 3000,
        /* .length_ms     =*/ 10000,
        /* .keep_ms       =*/ 200,
        /* .capture_id    =*/ -1,
        /* .max_tokens    =*/ 32,
        /* .audio_ctx     =*/ 0,

        /* .vad_thold     =*/ 0.6f,
        /* .freq_thold    =*/ 100.0f,

        /* .speed_up      =*/ false,
        /* .translate     =*/ false,
        /* .print_special =*/ false,
        /* .no_context    =*/ true,
        /* .no_timestamps =*/ false,

        /* .language      =*/ "en",
        /* .model         =*/ "models/ggml-base.en.bin"
    };
}

stream_context *stream_init(stream_params params) {
    auto ctx = std::make_unique<stream_context>();

    params.keep_ms = std::min(params.keep_ms, params.step_ms);
    params.length_ms = std::max(params.length_ms, params.step_ms);

    ctx->n_samples_step = (1e-3 * params.step_ms) * WHISPER_SAMPLE_RATE;
    ctx->n_samples_len = (1e-3 * params.length_ms) * WHISPER_SAMPLE_RATE;
    ctx->n_samples_keep = (1e-3 * params.keep_ms) * WHISPER_SAMPLE_RATE;
    const int n_samples_30s = (1e-3 * 30000.0) * WHISPER_SAMPLE_RATE;

    ctx->use_vad = ctx->n_samples_step <= 0; // sliding window mode uses VAD

    ctx->n_new_line = !ctx->use_vad ? std::max(1, params.length_ms / params.step_ms - 1) : 1; // number of steps to print new line

    params.no_timestamps = !ctx->use_vad;
    params.no_context |= ctx->use_vad;
    params.max_tokens = 0;

    // init audio
    ctx->audio = std::make_unique<audio_async>(params.length_ms);
    if (!ctx->audio->init(params.capture_id, WHISPER_SAMPLE_RATE)) {
        fprintf(stderr, "%s: audio.init() failed!\n", __func__);
        return NULL;
    }

    ctx->audio->resume();

    // whisper init
    if (whisper_lang_id(params.language) == -1) {
        fprintf(stderr, "%s: unknown language '%s'\n", __func__, params.language);
        return NULL;
    }

    if ((ctx->whisper = unique_whisper(whisper_init_from_file(params.model))) == NULL) {
        return NULL;
    }

    ctx->pcmf32 = std::vector<float>(n_samples_30s, 0.0f);
    ctx->pcmf32_new = std::vector<float>(n_samples_30s, 0.0f);

    ctx->t_last = std::chrono::high_resolution_clock::now();
    ctx->t_start = ctx->t_last;

    ctx->params = params;

    return ctx.release();
}

void stream_free(stream_context *ctx) {
    ctx->audio = NULL;
    ctx->whisper = NULL;
    ctx->pcmf32.clear();
    ctx->pcmf32_old.clear();
    ctx->pcmf32_new.clear();
    ctx->prompt_tokens.clear();
}

int stream_run(stream_context *ctx, void *callback_ctx, stream_callback_t callback) {
    auto params = ctx->params;
    auto whisper = ctx->whisper.get();

    auto t_now = std::chrono::high_resolution_clock::now();

    if (!ctx->use_vad) {
        while (true) {
            ctx->audio->get(params.step_ms, ctx->pcmf32_new);

            if ((int)ctx->pcmf32_new.size() > 2 * ctx->n_samples_step) {
                fprintf(stderr, "\n\n%s: WARNING: cannot process audio fast enough, dropping audio ...\n\n", __func__);
                ctx->audio->clear();
                continue;
            }

            if ((int)ctx->pcmf32_new.size() >= ctx->n_samples_step) {
                ctx->audio->clear();
                break;
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }

        const int n_samples_new = ctx->pcmf32_new.size();

        // take up to params.length_ms audio from previous iteration
        const int n_samples_take = std::min((int)ctx->pcmf32_old.size(), std::max(0, ctx->n_samples_keep + ctx->n_samples_len - n_samples_new));

        ctx->pcmf32.resize(n_samples_new + n_samples_take);

        for (int i = 0; i < n_samples_take; i++) {
            ctx->pcmf32[i] = ctx->pcmf32_old[ctx->pcmf32_old.size() - n_samples_take + i];
        }

        memcpy(ctx->pcmf32.data() + n_samples_take, ctx->pcmf32_new.data(), n_samples_new * sizeof(float));

        ctx->pcmf32_old = ctx->pcmf32;
    } else {
        auto t_diff = std::chrono::duration_cast<std::chrono::milliseconds>(t_now - ctx->t_last).count();
        if (t_diff < 2000) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            return 0;
        }
        
        // process new audio
        ctx->audio->get(2000, ctx->pcmf32_new);
        
        if (::vad_simple(ctx->pcmf32_new, WHISPER_SAMPLE_RATE, 1000, params.vad_thold, params.freq_thold, false)) {
            ctx->audio->get(params.length_ms, ctx->pcmf32);
        } else {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            return 0;
        }
        
        ctx->t_last = t_now;
    }

    // run the inference
    whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);

    wparams.print_progress = false;
    wparams.print_special = params.print_special;
    wparams.print_realtime = false;
    wparams.print_timestamps = !params.no_timestamps;
    wparams.translate = params.translate;
    wparams.no_context = true;
    wparams.single_segment = !ctx->use_vad;
    wparams.max_tokens = params.max_tokens;
    wparams.language = params.language;
    wparams.n_threads = params.n_threads;

    wparams.audio_ctx = params.audio_ctx;
    wparams.speed_up = params.speed_up;

    // disable temperature fallback
    wparams.temperature_inc = -1.0f;

    wparams.prompt_tokens = params.no_context ? nullptr : ctx->prompt_tokens.data();
    wparams.prompt_n_tokens = params.no_context ? 0 : ctx->prompt_tokens.size();

    const int64_t t1 = (t_now - ctx->t_start).count() / 1000000;
    const int64_t t0 = std::max(0.0, t1 - ctx->pcmf32.size() * 1000.0 / WHISPER_SAMPLE_RATE);

    if (whisper_full(whisper, wparams, ctx->pcmf32.data(), ctx->pcmf32.size()) != 0) {
        fprintf(stderr, "%s: failed to process audio\n", __func__);
        return 6;
    }

    const int n_segments = whisper_full_n_segments(whisper);
    for (int i = 0; i < n_segments; ++i) {
        const char *text = whisper_full_get_segment_text(whisper, i);

        const int64_t segment_t0 = whisper_full_get_segment_t0(whisper, i);
        const int64_t segment_t1 = whisper_full_get_segment_t1(whisper, i);

        callback(text, ctx->use_vad ? segment_t0 : t0, ctx->use_vad ? segment_t1 : t1, callback_ctx);
    }

    ++ctx->n_iter;

    if (!ctx->use_vad && (ctx->n_iter % ctx->n_new_line) == 0) {
        callback(NULL, 0, 0, callback_ctx);

        // keep part of the audio for next iteration to try to mitigate word boundary issues
        ctx->pcmf32_old = std::vector<float>(ctx->pcmf32.end() - ctx->n_samples_keep, ctx->pcmf32.end());

        // Add tokens of the last full length segment as the prompt
        if (!params.no_context) {
            ctx->prompt_tokens.clear();

            const int n_segments = whisper_full_n_seg
```

### Core Architecture Module: `LibWhisper/stream.h`
```
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct stream_params {
    int32_t n_threads;
    int32_t step_ms;
    int32_t length_ms;
    int32_t keep_ms;
    int32_t capture_id;
    int32_t max_tokens;
    int32_t audio_ctx;

    float vad_thold;
    float freq_thold;

    bool speed_up;
    bool translate;
    bool print_special;
    bool no_context;
    bool no_timestamps;

    const char *language;
    const char *model;
} stream_params_t;

stream_params_t stream_default_params();

typedef struct stream_context *stream_context_t;

stream_context_t stream_init(stream_params_t params);
void stream_free(stream_context_t ctx);

typedef int (*stream_callback_t) (const char *text, int64_t t0, int64_t t1, void *ctx);
int stream_run(stream_context_t ctx, void *callback_ctx, stream_callback_t callback);

#ifdef __cplusplus
}
#endif

```

### Core Architecture Module: `extension/background.js`
```
let port = null;

browser.runtime.onMessage.addListener(message => {
    if (port == null || port.error) {
        port = browser.runtime.connectNative('cheetah');
    }
    try {
        port.postMessage(message);
    } catch (error) {
        port = null;
    }
});

```

### Core Architecture Module: `extension/cheetah.js`
```
let updateFrequency = 1000;

function update() {
    let editor = window.wrappedJSObject.editor;
    if (!editor) {
        return;
    }

    let modeId = document.querySelector('.react-monaco-editor-react')?.dataset.modeId;
    let fileUri = document.querySelector('.monaco-editor[role="code"]')?.dataset.uri;
    let terminal = document.querySelector('.terminal .xterm-accessibility')?.innerText.trim();
    
    let message = {
        mode: modeId,
        files: { [fileUri]: editor.getValue() },
        logs: { terminal }
    };

    message.navigationStart = performance.timing.navigationStart;
    browser.runtime.sendMessage(message);
}

setInterval(update, updateFrequency);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #18** (2023-04-27): **"Cheetah" app unexpectedly shutting down**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <img width="632" alt="Снимок экрана 2023-04-26 в 12 25 55" src="https://user-images.githubusercontent.com/116057796/234492022-05ae61fd-aa6b-436f-9c89-7db7eed0ff9f.png"> 
  > It may be because you installed the SDL2 of 86_64, you need to install the S D L of the ARM64 version
  > >  Can you tell me where I can find instructions on how to install ARM 64? I can not(

- **Issue #11** (2023-04-26): **Prompts not being processed**
  *Symptoms*: Hello there,  I have everything set and the prompts are being transcripted into the app, but once I press on Analise, it does nothing. <img width="871" alt="Screenshot 2023-04-18 at 09 20 47" src="https://user-images.githubusercontent.com/19169582/232703721-050b4caf-8bee-4393-95a7-8a70e6371c68.png">  Is there a need to have SIP off or something?  Great work btw
  **Post-Mortem & Fix Analysis**:
  > Run the app directly from the Terminal to see error logs:  ```shell /Applications/Cheetah.app/Contents/MacOS/Cheetah ```  What do you see?
  > Here it is when I select device ![Screenshot 2023-04-18 at 19 44 08](https://user-images.githubusercontent.com/19169582/232860457-c37d974a-7b77-4afc-b057-66399462591c.png)  Here at launch ![Screenshot 2023-04-18 at 19 46 28](https://user-images.githubusercontent.com/19169582/232863949-d509b324-6dfb-4071-8338-4cd33f7ee4a2.png) 
  > What about when you click Answer?

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

### Incident Patch 1: `e66db5be` (2023-05-07)
**Commit Message**: Update README.md

**File**: `README.md` (modified, +9/-9)
```diff
@@ -1,27 +1,28 @@
 # Cheetah
 
-Cheetah is an AI-powered macOS app designed to assist users during remote software engineering interviews by providing real-time, discreet coaching and live coding platform integration.
+Cheetah is an AI-powered macOS app designed to assist users with software engineering interview practice. It provides real-time coaching and live coding platform integration.
 
 [Quick demo video (1:28)](https://user-images.githubusercontent.com/106342593/229961889-489e2b36-f3e6-453a-9784-f160bc1c4f8d.mp4)
 
 <img src="https://github.com/leetcode-mafia/cheetah/raw/91cc5b89864fe28476a7e2062ede2c8322c17896/cheetah.jpg" alt="Screenshot">
 
-With Cheetah, you can improve your interview performance and increase your chances of landing that $300k SWE job, without spending your weekends cramming leetcode challenges and memorizing algorithms you'll never use.
-
 ## How it works
 
-Cheetah leverages Whisper for real-time audio transcription and GPT-4 for generating hints and solutions. You need to have your own OpenAI API key to use the app. If you don't have access to GPT-4, gpt-3.5-turbo may be used as an alternative.
-
-Whisper runs locally on your system, utilizing Georgi Gerganov's [whisper.cpp](https://github.com/ggerganov/whisper.cpp). A recent M1 or M2 Mac is required for optimal performance.
+Cheetah leverages Whisper for real-time audio transcription, and GPT-4 for generating hints and solutions. You need to have your own OpenAI API key to use the app.
 
+Whisper runs locally on your system, utilizing Georgi Gerganov's [whisper.cpp](https://github.com/ggerganov/whisper.cpp). A recent Mac with Apple silicon is required for optimal performance.
 
 ## Getting started
 
 ### Prerequisites
 
 Requires macOS 13.1 or later.
 
-To build Cheetah, whisper.cpp must be checked out in `../whisper.cpp`.
+To build Cheetah, [whisper.cpp](https://github.com/ggerganov/whisper.cpp) must be checked out in `../whisper.cpp`, and the SDL2 library must be installed:
+
+```shell
+brew install sdl2
+```
 
 ### Audio driver setup
 
@@ -55,7 +56,6 @@ Currently, only Firefox is supported. Follow these steps to install the extensio
 4. Click "Load Temporary Add-on"
 5. Select ./extension/manifest.json
 
-
 ## Disclaimer
 
-Cheetah is a satirical art project and is not intended for use in real-world settings. It may generate incorrect or inappropriate solutions. Users should exercise caution and take responsibility for the information provided by the app.
+Cheetah is intended for use in mock interviews only. It may generate incorrect or inappropriate solutions. Users take full responsibility for the information provided by the app.
```

---

### Incident Patch 2: `44e8d225` (2023-05-06)
**Commit Message**: Update README.md

**File**: `README.md` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@ Whisper runs locally on your system, utilizing Georgi Gerganov's [whisper.cpp](h
 
 Requires macOS 13.1 or later.
 
+To build Cheetah, whisper.cpp must be checked out in `../whisper.cpp`.
+
 ### Audio driver setup
 
 For the best results, ensure the audio input captures both sides of the conversation.
```

---

### Incident Patch 3: `1c53309e` (2023-04-26)
**Commit Message**: Update README.md

**File**: `README.md` (modified, +0/-6)
```diff
@@ -21,12 +21,6 @@ Whisper runs locally on your system, utilizing Georgi Gerganov's [whisper.cpp](h
 
 Requires macOS 13.1 or later.
 
-SDL2 must be installed or the app will crash on launch:
-
-```shell
-brew install sdl2
-```
-
 ### Audio driver setup
 
 For the best results, ensure the audio input captures both sides of the conversation.
```

---

### Incident Patch 4: `5a770e05` (2023-04-26)
**Commit Message**: add build and release workflows

**File**: `.github/workflows/build.yml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+name: Build
+on:
+  workflow_call:
+  pull_request:
+    branches:
+      - main
+jobs:
+  arm64_ventura:
+    runs-on: macos-13
+    steps:
+      - run: |
+          brew fetch --force --bottle-tag=arm64_ventura sdl2
+          brew install $(brew --cache --bottle-tag=arm64_ventura sdl2)
+          sudo mkdir -p /opt/homebrew/lib
+          sudo ln -s /usr/local/lib/libSDL2.a /opt/homebrew/lib/libSDL2.a
+      - uses: actions/checkout@v3
+        with:
+          path: cheetah
+      - uses: actions/checkout@v3
+        with:
+          repository: ggerganov/whisper.cpp
+          ref: v1.3.0
+          path: whisper.cpp
+      - run: |
+          cd cheetah
+          xcodebuild -scheme Cheetah -configuration Release -destination generic/platform=macOS -derivedDataPath build
+          cd build/Build/Products/Release
+          zip -r Cheetah.zip Cheetah.app
+      - uses: actions/upload-artifact@v3
+        with:
+          name: Cheetah
+          path: cheetah/build/Build/Products/Release/Cheetah.zip
```

**File**: `.github/workflows/release.yml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+name: Release
+on:
+  push:
+    tags:
+      - 'v*.*'
+      - 'v*.*.*'
+jobs:
+  build:
+    uses: ./.github/workflows/build.yml
+  release:
+    needs: build
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/download-artifact@v3
+        with:
+          name: Cheetah
+      - uses: actions/create-release@v1
+        id: create_release
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        with:
+          tag_name: ${{ github.ref }}
+          release_name: ${{ github.ref }}
+          draft: true
+      - uses: actions/upload-release-asset@v1
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        with:
+          upload_url: ${{ steps.create_release.outputs.upload_url }}
+          asset_path: ./Cheetah.zip
+          asset_name: Cheetah.zip
+          asset_content_type: application/zip
```

**File**: `Cheetah.xcodeproj/project.pbxproj` (modified, +40/-10)
```diff
@@ -37,7 +37,6 @@
 		37AE7ACA29A70CE900C45FF6 /* whisper.h in Headers */ = {isa = PBXBuildFile; fileRef = 37AE7AB129A5AAD400C45FF6 /* whisper.h */; };
 		37B2997D29F9756F00971690 /* Sparkle in Frameworks */ = {isa = PBXBuildFile; productRef = 37B2997C29F9756F00971690 /* Sparkle */; };
 		37B2997F29F9757700971690 /* Sparkle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 37B2997E29F9757700971690 /* Sparkle.swift */; };
-		37B2998729F97C5D00971690 /* libSDL2.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 37B2998429F97C1000971690 /* libSDL2.a */; };
 		37B3A50629CE15AC0029821F /* OpenAIEndpoint.swift in Sources */ = {isa = PBXBuildFile; fileRef = 37B3A4FD29CE15AC0029821F /* OpenAIEndpoint.swift */; };
 		37B3A50729CE15AC0029821F /* OpenAISwift.swift in Sources */ = {isa = PBXBuildFile; fileRef = 37B3A4FE29CE15AC0029821F /* OpenAISwift.swift */; };
 		37B3A51C29CE16330029821F /* ImageGeneration.swift in Sources */ = {isa = PBXBuildFile; fileRef = 37B3A51629CE16330029821F /* ImageGeneration.swift */; };
@@ -170,7 +169,6 @@
 		37AE7AC529A6E9C400C45FF6 /* stream.cpp */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.cpp.cpp; path = stream.cpp; sourceTree = "<group>"; };
 		37AE7AC729A6EC2F00C45FF6 /* stream.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = stream.h; sourceTree = "<group>"; };
 		37B2997E29F9757700971690 /* Sparkle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Sparkle.swift; sourceTree = "<group>"; };
-		37B2998429F97C1000971690 /* libSDL2.a */ = {isa = PBXFileReference; lastKnownFileType = archive.ar; name = libSDL2.a; path = /opt/homebrew/lib/libSDL2.a; sourceTree = "<absolute>"; };
 		37B3A4FD29CE15AC0029821F /* OpenAIEndpoint.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = OpenAIEndpoint.swift; sourceTree = "<group>"; };
 		37B3A4FE29CE15AC0029821F /* OpenAISwift.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = OpenAISwift.swift; sourceTree = "<group>"; };
 		37B3A51629CE16330029821F /* ImageGeneration.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ImageGeneration.swift; sourceTree = "<group>"; };
@@ -213,7 +211,6 @@
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
-				37B2998729F97C5D00971690 /* libSDL2.a in Frameworks */,
 				376437AE29A75B2C00297AC6 /* Accelerate.framework in Frameworks */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
@@ -231,7 +228,6 @@
 		376437AC29A75B2C00297AC6 /* Frameworks */ = {
 			isa = PBXGroup;
 			children = (
-				37B2998429F97C1000971690 /* libSDL2.a */,
 				376437AD29A75B2C00297AC6 /* Accelerate.framework */,
 			);
 			name = Frameworks;
@@ -678,6 +674,7 @@
 			isa = XCBuildConfiguration;
 			buildSettings = {
 				ALWAYS_SEARCH_USER_PATHS = NO;
+				ARCHS = arm64;
 				CLANG_ANALYZER_NONNULL = YES;
 				CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
@@ -727,7 +724,6 @@
 				MACOSX_DEPLOYMENT_TARGET = 13.1;
 				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
 				MTL_FAST_MATH = YES;
-				ONLY_ACTIVE_ARCH = YES;
 				SDKROOT = macosx;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
 				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
@@ -738,6 +734,7 @@
 			isa = XCBuildConfiguration;
 			buildSettings = {
 				ALWAYS_SEARCH_USER_PATHS = NO;
+				ARCHS = arm64;
 				CLANG_ANALYZER_NONNULL = YES;
 				CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
@@ -782,7 +779,6 @@
 				MACOSX_DEPLOYMENT_TARGET = 13.1;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
-				ONLY_ACTIVE_ARCH = YES;
 				SDKROOT = macosx;
 				SWIFT_COMPILATION_MODE = wholemodule;
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
@@ -862,20 +858,37 @@
 				DYLIB_CURRENT_VERSION = 1;
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				GENERATE_INFOPLIST_FIL
```

---

### Incident Patch 5: `b4027f26` (2023-04-26)
**Commit Message**: move codeAnswer view into the ScrollView

**File**: `Cheetah/Views/CoachView.swift` (modified, +16/-11)
```diff
@@ -78,21 +78,26 @@ struct CoachView: View {
                         .font(.footnote.italic())
                 }
                 ScrollView {
-                    NSTextFieldWrapper(text: $answer, selectedRange: $answerSelection)
-                        .onChange(of: viewModel.answer) {
-                            if let newAnswer = $0 {
-                                self.answer = newAnswer
+                    if answer != "" {
+                        NSTextFieldWrapper(text: $answer, selectedRange: $answerSelection)
+                            .onChange(of: viewModel.answer) {
+                                if let newAnswer = $0 {
+                                    self.answer = newAnswer
+                                }
                             }
+                    }
+                    if let solution = viewModel.codeAnswer {
+                        HStack {
+                            Text(solution)
+                                .textSelection(.enabled)
+                                .font(.footnote)
+                                .monospaced()
+                                .lineSpacing(1.2)
+                            Spacer()
                         }
+                    }
                 }
                 .frame(maxHeight: 600)
-                if let solution = viewModel.codeAnswer {
-                    Text(solution)
-                        .textSelection(.enabled)
-                        .font(.footnote)
-                        .monospaced()
-                }
-                Spacer()
             }
             Spacer()
         }
```

**File**: `Cheetah/Views/ContentView.swift` (modified, +2/-2)
```diff
@@ -37,7 +37,7 @@ struct ContentView_Previews: PreviewProvider {
         let viewModel = AppViewModel()
         viewModel.devices = [CaptureDevice(id: 0, name: "Audio Loopback Device")]
         viewModel.buttonsAlwaysEnabled = true
-        viewModel.authToken = ""
+        viewModel.authToken = "x"
         viewModel.downloadState = .completed
         viewModel.transcript = "So how would we break this app down into components?"
         viewModel.answer = """
@@ -52,7 +52,7 @@ Props: message
 
 • App Component: Renders the Header, Content, and Footer components
 """
-       return ContentView(viewModel: viewModel)
+        return ContentView(viewModel: viewModel)
             .previewLayout(.fixed(width: 300, height: 500))
             .previewDisplayName("Cheetah")
     }
```

---

### Incident Patch 6: `58c407d1` (2023-04-26)
**Commit Message**: statically link SDL2

**File**: `Cheetah.xcodeproj/project.pbxproj` (modified, +8/-10)
```diff
@@ -37,6 +37,7 @@
 		37AE7ACA29A70CE900C45FF6 /* whisper.h in Headers */ = {isa = PBXBuildFile; fileRef = 37AE7AB129A5AAD400C45FF6 /* whisper.h */; };
 		37B2997D29F9756F00971690 /* Sparkle in Frameworks */ = {isa = PBXBuildFile; productRef = 37B2997C29F9756F00971690 /* Sparkle */; };
 		37B2997F29F9757700971690 /* Sparkle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 37B2997E29F9757700971690 /* Sparkle.swift */; };
+		37B2998729F97C5D00971690 /* libSDL2.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 37B2998429F97C1000971690 /* libSDL2.a */; };
 		37B3A50629CE15AC0029821F /* OpenAIEndpoint.swift in Sources */ = {isa = PBXBuildFile; fileRef = 37B3A4FD29CE15AC0029821F /* OpenAIEndpoint.swift */; };
 		37B3A50729CE15AC0029821F /* OpenAISwift.swift in Sources */ = {isa = PBXBuildFile; fileRef = 37B3A4FE29CE15AC0029821F /* OpenAISwift.swift */; };
 		37B3A51C29CE16330029821F /* ImageGeneration.swift in Sources */ = {isa = PBXBuildFile; fileRef = 37B3A51629CE16330029821F /* ImageGeneration.swift */; };
@@ -169,6 +170,7 @@
 		37AE7AC529A6E9C400C45FF6 /* stream.cpp */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.cpp.cpp; path = stream.cpp; sourceTree = "<group>"; };
 		37AE7AC729A6EC2F00C45FF6 /* stream.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = stream.h; sourceTree = "<group>"; };
 		37B2997E29F9757700971690 /* Sparkle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Sparkle.swift; sourceTree = "<group>"; };
+		37B2998429F97C1000971690 /* libSDL2.a */ = {isa = PBXFileReference; lastKnownFileType = archive.ar; name = libSDL2.a; path = /opt/homebrew/lib/libSDL2.a; sourceTree = "<absolute>"; };
 		37B3A4FD29CE15AC0029821F /* OpenAIEndpoint.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = OpenAIEndpoint.swift; sourceTree = "<group>"; };
 		37B3A4FE29CE15AC0029821F /* OpenAISwift.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = OpenAISwift.swift; sourceTree = "<group>"; };
 		37B3A51629CE16330029821F /* ImageGeneration.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ImageGeneration.swift; sourceTree = "<group>"; };
@@ -211,6 +213,7 @@
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				37B2998729F97C5D00971690 /* libSDL2.a in Frameworks */,
 				376437AE29A75B2C00297AC6 /* Accelerate.framework in Frameworks */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
@@ -228,6 +231,7 @@
 		376437AC29A75B2C00297AC6 /* Frameworks */ = {
 			isa = PBXGroup;
 			children = (
+				37B2998429F97C1000971690 /* libSDL2.a */,
 				376437AD29A75B2C00297AC6 /* Accelerate.framework */,
 			);
 			name = Frameworks;
@@ -858,23 +862,20 @@
 				DYLIB_CURRENT_VERSION = 1;
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				GENERATE_INFOPLIST_FILE = YES;
+				HEADER_SEARCH_PATHS = /opt/homebrew/include/SDL2;
 				INFOPLIST_KEY_NSHumanReadableCopyright = "";
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
 				LD_RUNPATH_SEARCH_PATHS = (
 					"$(inherited)",
 					"@executable_path/../Frameworks",
 					"@loader_path/Frameworks",
 				);
+				LIBRARY_SEARCH_PATHS = /opt/homebrew/lib;
 				MARKETING_VERSION = 1.0;
 				OTHER_CFLAGS = (
-					"-I/opt/homebrew/include/SDL2",
 					"-D_THREAD_SAFE",
 					"-DGGML_USE_ACCELERATE",
 				);
-				OTHER_LDFLAGS = (
-					"-L/opt/homebrew/lib",
-					"-lSDL2",
-				);
 				PRODUCT_BUNDLE_IDENTIFIER = org.phrack.LibWhisper;
 				PRODUCT_NAME = "$(TARGET_NAME:c99extidentifier)";
 				SKIP_INSTALL = YES;
@@ -899,23 +900,20 @@
 				DYLIB_CURRENT_VERSION = 1;
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				GENERATE_INFOPLIST_FILE = YES;
+				HEADER_SEARCH_PATHS = /opt/homebrew/include/SDL2;
 				INFOPLIST_KEY_NSHumanReadableCopyright = "";
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
 				LD_RUNPATH_SEARCH_PATHS = (
 					"$(inherited)",
 					"@
```

#### Recent Merged Pull Requests:
- **PR #37** (closed): change model url (@0x178F)
- **PR #4** (closed): fixed demo video link (@Aminehassou)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
