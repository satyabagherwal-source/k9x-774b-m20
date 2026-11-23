# Verification Protocol: Verification Protocol: Empirical Defect Shield for iplug2-iplug2-learnings

<!-- PROVENANCE_START
{
  "source_repository": "iplug2-iplug2-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T20:22:15.113Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-iplug2-iplug2-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iplug2-iplug2-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T20:22:15.113Z`  
> **Learning ID**: `LEARN-EVO-iplug2-iplug2-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `iplug2-iplug2-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/iplug2-iplug2-learnings.md`  
> **Source**: github ([https://github.com/iPlug2/iPlug2](https://github.com/iPlug2/iPlug2))  
> **Source Version**: `3d378017`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T20:22:00.422Z  
> **Learning ID**: `learn-github-iplug2-iplug2`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): iPlug2/iPlug2

> **Canonical Artifact**: `07_PROJECT_LEARNING/iplug2-iplug2-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iPlug2/iPlug2](https://github.com/iPlug2/iPlug2))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T20:22:00.417Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iPlug2/iPlug2`
- **Description**: C++ Audio Plug-in Framework for desktop, mobile, xr and web
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2453 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Dependencies/IGraphics/NanoVG/src/nanovg_gl_utils.h`
```
//
// Copyright (c) 2009-2013 Mikko Mononen memon@inside.org
//
// This software is provided 'as-is', without any express or implied
// warranty.  In no event will the authors be held liable for any damages
// arising from the use of this software.
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
// 1. The origin of this software must not be misrepresented; you must not
//    claim that you wrote the original software. If you use this software
//    in a product, an acknowledgment in the product documentation would be
//    appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//    misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.
//
#ifndef NANOVG_GL_UTILS_H
#define NANOVG_GL_UTILS_H

struct NVGLUframebuffer {
	NVGcontext* ctx;
	GLuint fbo;
	GLuint rbo;
	GLuint texture;
	int image;
};
typedef struct NVGLUframebuffer NVGLUframebuffer;

// Helper function to create GL frame buffer to render to.
void nvgluBindFramebuffer(NVGLUframebuffer* fb);
NVGLUframebuffer* nvgluCreateFramebuffer(NVGcontext* ctx, int w, int h, int imageFlags);
void nvgluDeleteFramebuffer(NVGLUframebuffer* fb);

#endif // NANOVG_GL_UTILS_H

#ifdef NANOVG_GL_IMPLEMENTATION

#if defined(NANOVG_GL3) || defined(NANOVG_GLES2) || defined(NANOVG_GLES3)
// FBO is core in OpenGL 3>.
#	define NANOVG_FBO_VALID 1
#elif defined(NANOVG_GL2)
// On OS X including glext defines FBO on GL2 too.
#	ifdef __APPLE__
#		include <OpenGL/glext.h>
#		define NANOVG_FBO_VALID 1
#	endif
#endif

static GLint defaultFBO = -1;

NVGLUframebuffer* nvgluCreateFramebuffer(NVGcontext* ctx, int w, int h, int imageFlags)
{
#ifdef NANOVG_FBO_VALID
	GLint defaultFBO;
	GLint defaultRBO;
	NVGLUframebuffer* fb = NULL;

	glGetIntegerv(GL_FRAMEBUFFER_BINDING, &defaultFBO);
	glGetIntegerv(GL_RENDERBUFFER_BINDING, &defaultRBO);

	fb = (NVGLUframebuffer*)malloc(sizeof(NVGLUframebuffer));
	if (fb == NULL) goto error;
	memset(fb, 0, sizeof(NVGLUframebuffer));

	fb->image = nvgCreateImageRGBA(ctx, w, h, imageFlags | NVG_IMAGE_FLIPY | NVG_IMAGE_PREMULTIPLIED, NULL);

#if defined NANOVG_GL2
	fb->texture = nvglImageHandleGL2(ctx, fb->image);
#elif defined NANOVG_GL3
	fb->texture = nvglImageHandleGL3(ctx, fb->image);
#elif defined NANOVG_GLES2
	fb->texture = nvglImageHandleGLES2(ctx, fb->image);
#elif defined NANOVG_GLES3
	fb->texture = nvglImageHandleGLES3(ctx, fb->image);
#endif

	fb->ctx = ctx;

	// frame buffer object
	glGenFramebuffers(1, &fb->fbo);
	glBindFramebuffer(GL_FRAMEBUFFER, fb->fbo);

	// render buffer object
	glGenRenderbuffers(1, &fb->rbo);
	glBindRenderbuffer(GL_RENDERBUFFER, fb->rbo);
	glRenderbufferStorage(GL_RENDERBUFFER, GL_STENCIL_INDEX8, w, h);

	// combine all
	glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, fb->texture, 0);
	glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_STENCIL_ATTACHMENT, GL_RENDERBUFFER, fb->rbo);

	if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
#ifdef GL_DEPTH24_STENCIL8
		// If GL_STENCIL_INDEX8 is not supported, try GL_DEPTH24_STENCIL8 as a fallback.
		// Some graphics cards require a depth buffer along with a stencil.
		glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, w, h);
		glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, fb->texture, 0);
		glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_STENCIL_ATTACHMENT, GL_RENDERBUFFER, fb->rbo);

		if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
#endif // GL_DEPTH24_STENCIL8
			goto error;
	}

	glBindFramebuffer(GL_FRAMEBUFFER, defaultFBO);
	glBindRenderbuffer(GL_RENDERBUFFER, defaultRBO);
	return fb;
error:
	glBindFramebuffer(GL_FRAMEBUFFER, defaultFBO);
	glBindRenderbuffer(GL_RENDERBUFFER, defaultRBO);
	nvgluDeleteFramebuffer(fb);
	return NULL;
#else
	NVG_NOTUSED(ctx);
	NVG_NOTUSED(w);
	NVG_NOTUSED(h);
	NVG_NOTUSED(imageFlags);
	return NULL;
#endif
}

void nvgluBindFramebuffer(NVGLUframebuffer* fb)
{
#ifdef NANOVG_FBO_VALID
	if (defaultFBO == -1) glGetIntegerv(GL_FRAMEBUFFER_BINDING, &defaultFBO);
	glBindFramebuffer(GL_FRAMEBUFFER, fb != NULL ? fb->fbo : defaultFBO);
#else
	NVG_NOTUSED(fb);
#endif
}

void nvgluDeleteFramebuffer(NVGLUframebuffer* fb)
{
#ifdef NANOVG_FBO_VALID
	if (fb == NULL) return;
	if (fb->fbo != 0)
		glDeleteFramebuffers(1, &fb->fbo);
	if (fb->rbo != 0)
		glDeleteRenderbuffers(1, &fb->rbo);
	if (fb->image >= 0)
		nvgDeleteImage(fb->ctx, fb->image);
	fb->ctx = NULL;
	fb->fbo = 0;
	fb->rbo = 0;
	fb->texture = 0;
	fb->image = -1;
	free(fb);
#else
	NVG_NOTUSED(fb);
#endif
}

#endif // NANOVG_GL_IMPLEMENTATION

```

### Core Architecture Module: `Examples/IPlugConvoEngine/IPlugConvoEngine.cpp`
```
#include "IPlugConvoEngine.h"
#include "IPlug_include_in_plug_src.h"

IPlugConvoEngine::IPlugConvoEngine(const InstanceInfo& info)
: iplug::Plugin(info, MakeConfig(kNumParams, kNumPresets))
{
  GetParam(kParamDry)->InitDouble("Dry", 0., 0., 1., 0.001);
  GetParam(kParamWet)->InitDouble("Wet", 1., 0., 1., 0.001);
}

#if IPLUG_DSP
void IPlugConvoEngine::ProcessBlock(sample** inputs, sample** outputs, int nFrames)
{
  sample* inputL = inputs[0];
  sample* outputL = outputs[0];
  
  mEngine.Add(inputs, nFrames, 1);

  int nAvailableSamples = std::min(mEngine.Avail(nFrames), nFrames);

  const sample dryGain = GetParam(kParamDry)->Value();
  const sample wetGain = GetParam(kParamWet)->Value();

  // If not enough samples are available yet, then only output the dry signal
  for (auto i = 0; i < nFrames - nAvailableSamples; ++i)
  {
    *outputL++ = dryGain * *inputL++;
  }

  // Output samples from the convolution engine
  if (nAvailableSamples > 0)
  {
    // Apply the dry/wet mix
    WDL_FFT_REAL* pWetSignal = mEngine.Get()[0];
    for (auto i = 0; i < nAvailableSamples; ++i)
    {
      *outputL++ = dryGain * *inputL++ + wetGain * *pWetSignal++;
    }

    // Remove the sample block from the convolution engine's buffer
    mEngine.Advance(nAvailableSamples);
  }
}

void IPlugConvoEngine::OnReset()
{
  if (GetSampleRate() != mSampleRate)
  {
    mSampleRate = GetSampleRate();

    static constexpr int irLength = sizeof(mIR) / sizeof(mIR[0]);
    static constexpr double irSampleRate = 44100.;
    mImpulse.SetNumChannels(1);

#if defined USE_WDL_RESAMPLER
    mResampler.SetMode(false, 0, true); // Sinc, default size
    mResampler.SetFeedMode(true); // Input driven
#elif defined USE_R8BRAIN
    mResampler = std::make_unique<CDSPResampler16IR>(irSampleRate, mSampleRate, mBlockLength);
#endif

    // Resample the impulse response.
    auto len = mImpulse.SetLength(ResampleLength(irLength, irSampleRate, mSampleRate));
    if (len)
    {
      Resample(mIR, irLength, irSampleRate, mImpulse.impulses[0].Get(), len, mSampleRate);
    }
    
    // Tie the impulse response to the convolution engine.
    mEngine.SetImpulse(&mImpulse);
    
    SetLatency(mEngine.GetLatency());
  }
}

template <class I, class O>
void IPlugConvoEngine::Resample(const I* pSrc, int srcLength, double srcRate, O* pDest, int dstLength, double dstRate)
{
  if (dstLength == srcLength)
  {
    // Copy
    for (int i = 0; i < dstLength; ++i) *pDest++ = (O)*pSrc++;
    return;
  }

  // Resample using WDL's resampler.
  #if defined USE_WDL_RESAMPLER
  mResampler.SetRates(srcRate, dstRate);
  double scale = srcRate / dstRate;
  while (dstLength > 0)
  {
    WDL_ResampleSample* p;
    int n = mResampler.ResamplePrepare(mBlockLength, 1, &p), m = n;
    if (n > srcLength) n = srcLength;
    for (int i = 0; i < n; ++i) *p++ = (WDL_ResampleSample)*pSrc++;
    if (n < m) memset(p, 0, (m - n) * sizeof(WDL_ResampleSample));
    srcLength -= n;

    WDL_ResampleSample buf[mBlockLength];
    n = mResampler.ResampleOut(buf, m, m, 1);
    if (n > dstLength) n = dstLength;
    p = buf;
    for (int i = 0; i < n; ++i) *pDest++ = (O)(scale * *p++);
    dstLength -= n;
  }
  mResampler.Reset();

  // Resample using r8brain-free
  #elif defined USE_R8BRAIN
  double scale = srcRate / dstRate;
  while (dstLength > 0)
  {
    double buf[mBlockLength], *p = buf;
    int n = mBlockLength;
    if (n > srcLength) n = srcLength;
    for (int i = 0; i < n; ++i) *p++ = (double)*pSrc++;
    if (n < mBlockLength) memset(p, 0, (mBlockLength - n) * sizeof(double));
    srcLength -= n;

    n = mResampler->process(buf, mBlockLength, p);
    if (n > dstLength) n = dstLength;
    for (int i = 0; i < n; ++i) *pDest++ = (O)(scale * *p++);
    dstLength -= n;
  }
  mResampler->clear();

  // Resample using linear interpolation.
  #else
  double pos = 0.;
  double delta = srcRate / dstRate;
  for (int i = 0; i < dstLength; ++i)
  {
    int idx = int(pos);
    if (idx < srcLength)
    {
      double frac = pos - floor(pos);
      double interp = (1. - frac) * pSrc[idx];
      if (++idx < srcLength) interp += frac * pSrc[idx];
      pos += delta;
      *pDest++ = (O)(delta * interp);
    }
    else
    {
      *pDest++ = 0;
    }
  }
  #endif
}

const float IPlugConvoEngine::mIR[] =
{
  #include "ir.h"
};
#endif


```

### Core Architecture Module: `Examples/IPlugConvoEngine/IPlugConvoEngine.h`
```
#pragma once

#include "IPlug_include_in_plug_hdr.h"


#ifdef SAMPLE_TYPE_FLOAT
  #define WDL_FFT_REALSIZE 4
#else
  #define WDL_FFT_REALSIZE 8
#endif

#include "convoengine.h"

#if defined USE_WDL_RESAMPLER
  #include "resample.h"
#elif defined USE_R8BRAIN
  #include "CDSPResampler.h"
  using namespace r8b;
#endif

const int kNumPresets = 1;

enum EParams
{
  kParamDry = 0,
  kParamWet,
  kNumParams
};

using namespace iplug;

class IPlugConvoEngine final : public Plugin
{
public:
  IPlugConvoEngine(const InstanceInfo& info);

#if IPLUG_DSP // http://bit.ly/2S64BDd
  void ProcessBlock(sample** inputs, sample** outputs, int nFrames) override;
  void OnReset() override;
private:
  // Returns destination length
  inline int ResampleLength(int srcLength, double srcRate, double destRate) const
  {
    return int(destRate / srcRate * (double)srcLength + 0.5);
  }

  template <class I, class O> void Resample(const I* pSrc, int srcLength, double srcRate, O* pDst, int dstLength, double dstRate);
  
  static const float mIR[512];

  WDL_ImpulseBuffer mImpulse;
//  WDL_ConvolutionEngine_Div mEngine; // < low latency version
  WDL_ConvolutionEngine mEngine;
  
  static constexpr int mBlockLength = 64;

  #if defined USE_WDL_RESAMPLER
  WDL_Resampler mResampler;
  #elif defined USE_R8BRAIN
  std::unique_ptr<CDSPResampler16IR> mResampler;
  #endif

  double mSampleRate = 0.0;
#endif
};

```

### Core Architecture Module: `Examples/IPlugConvoEngine/config.h`
```
#define PLUG_NAME "IPlugConvoEngine"
#define PLUG_MFR "AcmeInc"
#define PLUG_VERSION_HEX 0x00010000
#define PLUG_VERSION_STR "1.0.0"
#define PLUG_UNIQUE_ID 'zo82'
#define PLUG_MFR_ID 'Acme'
#define PLUG_URL_STR "https://iplug2.github.io"
#define PLUG_EMAIL_STR "spam@me.com"
#define PLUG_COPYRIGHT_STR "Copyright 2025 Acme Inc"
#define PLUG_CLASS_NAME IPlugConvoEngine

#define BUNDLE_NAME "IPlugConvoEngine"
#define BUNDLE_MFR "AcmeInc"
#define BUNDLE_DOMAIN "com"

#define SHARED_RESOURCES_SUBPATH "IPlugConvoEngine"

#define PLUG_CHANNEL_IO "1-1"

#define PLUG_LATENCY 0
#define PLUG_TYPE 0
#define PLUG_DOES_MIDI_IN 0
#define PLUG_DOES_MIDI_OUT 0
#define PLUG_DOES_MPE 0
#define PLUG_DOES_STATE_CHUNKS 0
#define PLUG_HAS_UI 0

#define PLUG_WIDTH 600
#define PLUG_HEIGHT 600
#define PLUG_FPS 60
#define PLUG_SHARED_RESOURCES 0
#define PLUG_HOST_RESIZE 0

#define AUV2_ENTRY IPlugConvoEngine_Entry
#define AUV2_ENTRY_STR "IPlugConvoEngine_Entry"
#define AUV2_FACTORY IPlugConvoEngine_Factory
#define AUV2_VIEW_CLASS IPlugConvoEngine_View
#define AUV2_VIEW_CLASS_STR "IPlugConvoEngine_View"

#define AAX_TYPE_IDS 'IEF1', 'IEF2'
#define AAX_TYPE_IDS_AUDIOSUITE 'IEA1', 'IEA2'
#define AAX_PLUG_MFR_STR "Acme"
#define AAX_PLUG_NAME_STR "IPlugConvoEngine\nIPEF"
#define AAX_PLUG_CATEGORY_STR "Effect"
#define AAX_DOES_AUDIOSUITE 1

#define VST3_SUBCATEGORY "Fx"

#define APP_NUM_CHANNELS 1
#define APP_N_VECTOR_WAIT 0
#define APP_MULT 1
#define APP_COPY_AUV3 0
#define APP_SIGNAL_VECTOR_SIZE 64

```

### Core Architecture Module: `Examples/IPlugConvoEngine/ir.h`
```
4.24553603e-002f,
1.57741010e-001f,
2.75210112e-001f,
3.31389189e-001f,
3.22611272e-001f,
2.56686091e-001f,
1.50433525e-001f,
2.59184130e-002f,
-9.38406885e-002f,
-1.88903138e-001f,
-2.45514110e-001f,
-2.57848084e-001f,
-2.28224143e-001f,
-1.65906787e-001f,
-8.48367736e-002f,
-7.85613025e-004f,
7.15227947e-002f,
1.20827675e-001f,
1.40916467e-001f,
1.31190225e-001f,
9.62128937e-002f,
4.44219559e-002f,
-1.36966864e-002f,
-6.76043034e-002f,
-1.08517379e-001f,
-1.30737290e-001f,
-1.32321209e-001f,
-1.15044467e-001f,
-8.37305114e-002f,
-4.51255366e-002f,
-6.55501662e-003f,
2.53864527e-002f,
4.58912142e-002f,
5.25848605e-002f,
4.56926264e-002f,
2.77446639e-002f,
2.91607482e-003f,
-2.38494333e-002f,
-4.77610342e-002f,
-6.49853200e-002f,
-7.32078031e-002f,
-7.18792304e-002f,
-6.21357113e-002f,
-4.64383438e-002f,
-2.80217435e-002f,
-1.02645550e-002f,
3.90263856e-003f,
1.24544278e-002f,
1.45278005e-002f,
1.04551753e-002f,
1.58968475e-003f,
-1.00269374e-002f,
-2.20815465e-002f,
-3.24120969e-002f,
-3.93626876e-002f,
-4.20170203e-002f,
-4.02823575e-002f,
-3.48243192e-002f,
-2.68783644e-002f,
-1.79823823e-002f,
-9.68388468e-003f,
-3.27440957e-003f,
4.06127423e-004f,
1.06853864e-003f,
-1.03049958e-003f,
-5.18621225e-003f,
-1.04105128e-002f,
-1.56290159e-002f,
-1.98734049e-002f,
-2.24367008e-002f,
-2.29685213e-002f,
-2.14999635e-002f,
-1.84007604e-002f,
-1.42827407e-002f,
-9.87138506e-003f,
-5.87059138e-003f,
-2.84445286e-003f,
-1.13460829e-003f,
-8.23779963e-004f,
-1.74720073e-003f,
-3.54524865e-003f,
-5.74422861e-003f,
-7.84870796e-003f,
-9.42846946e-003f,
-1.01857455e-002f,
-9.99316294e-003f,
-8.89880303e-003f,
-7.10074743e-003f,
-4.89846850e-003f,
-2.63166684e-003f,
-6.18249178e-004f,
8.97854741e-004f,
1.78108003e-003f,
2.01669056e-003f,
1.70134660e-003f,
1.01554662e-003f,
1.84444172e-004f,
-5.65112161e-004f,
-1.04359468e-003f,
-1.12758286e-003f,
-7.74402695e-004f,
-2.15096497e-005f,
1.02777628e-003f,
2.22839927e-003f,
3.42245935e-003f,
4.46745707e-003f,
5.25912084e-003f,
5.74544957e-003f,
5.93042793e-003f,
5.86780393e-003f,
5.64696500e-003f,
5.37411263e-003f,
5.15241455e-003f,
5.06463693e-003f,
5.16097480e-003f,
5.45365736e-003f,
5.91858150e-003f,
6.50299806e-003f,
7.13734608e-003f,
7.74879754e-003f,
8.27402435e-003f,
8.66909046e-003f,
8.91504623e-003f,
9.01870336e-003f,
9.00892820e-003f,
8.92952457e-003f,
8.83026980e-003f,
8.75780731e-003f,
8.74797720e-003f,
8.82075541e-003f,
8.97839759e-003f,
9.20680631e-003f,
9.47956089e-003f,
9.76365432e-003f,
1.00258011e-002f,
1.02381650e-002f,
1.03825936e-002f,
1.04527855e-002f,
1.04542077e-002f,
1.04020201e-002f,
1.03175361e-002f,
1.02239912e-002f,
1.01423934e-002f,
1.00881653e-002f,
1.00690769e-002f,
1.00846905e-002f,
1.01272622e-002f,
1.01838093e-002f,
1.02388700e-002f,
1.02774138e-002f,
1.02873957e-002f,
1.02615468e-002f,
1.01981694e-002f,
1.01009086e-002f,
9.97762661e-003f,
9.83866863e-003f,
9.69487615e-003f,
9.55571420e-003f,
9.42781288e-003f,
9.31414496e-003f,
9.21390485e-003f,
9.12304781e-003f,
9.03533772e-003f,
8.94365087e-003f,
8.84132273e-003f,
8.72326735e-003f,
8.58672708e-003f,
8.43154639e-003f,
8.25997163e-003f,
8.07606801e-003f,
7.88487121e-003f,
7.69146904e-003f,
7.50015210e-003f,
7.31379818e-003f,
7.13354675e-003f,
6.95881061e-003f,
6.78757951e-003f,
6.61693607e-003f,
6.44367747e-003f,
6.26492500e-003f,
6.07861578e-003f,
5.88380918e-003f,
5.68076875e-003f,
5.47083002e-003f,
5.25610009e-003f,
5.03905164e-003f,
4.82209539e-003f,
4.60720574e-003f,
4.39565629e-003f,
4.18790150e-003f,
3.98361124e-003f,
3.78183229e-003f,
3.58124427e-003f,
3.38045019e-003f,
3.17825121e-003f,
2.97386106e-003f,
2.76702782e-003f,
2.55805138e-003f,
2.34770519e-003f,
2.13708286e-003f,
1.92740688e-003f,
1.71983056e-003f,
1.51527382e-003f,
1.31431257e-003f,
1.11713749e-003f,
9.23583575e-004f,
7.33215071e-004f,
5.45449206e-004f,
3.59691825e-004f,
1.75460897e-004f,
-7.52183087e-006f,
-1.89283703e-004f,
-3.69602203e-004f,
-5.48049342e-004f,
-7.24067329e-004f,
-8.97059857e-004f,
-1.06648135e-003f,
-1.23190973e-003f,
-1.39309128e-003f,
-1.54995278e-003f,
-1.70258316e-003f,
-1.85118837e-003f,
-1.99603289e-003f,
-2.13737669e-003f,
-2.27541965e-003f,
-2.41026422e-003f,
-2.54189596e-003f,
-2.67018983e-003f,
-2.79493327e-003f,
-2.91586365e-003f,
-3.03271133e-003f,
-3.14523955e-003f,
-3.25327599e-003f,
-3.35673080e-003f,
-3.45559930e-003f,
-3.54995066e-003f,
-3.63990525e-003f,
-3.72560672e-003f,
-3.80719220e-003f,
-3.88476974e-003f,
-3.95839987e-003f,
-4.02809121e-003f,
-4.09380440e-003f,
-4.15546307e-003f,
-4.21297364e-003f,
-4.26624482e-003f,
-4.31520445e-003f,
-4.35981434e-003f,
-4.40007728e-003f,
-4.43603517e-003f,
-4.46776487e-003f,
-4.49536415e-003f,
-4.51894198e-003f,
-4.53860126e-003f,
-4.55443189e-003f,
-4.56650043e-003f,
-4.57485160e-003f,
-4.57950868e-003f,
-4.58048098e-003f,
-4.57777129e-003f,
-4.57138661e-003f,
-4.56134509e-003f,
-4.54768259e-003f,
-4.53045312e-003f,
-4.50973073e-003f,
-4.48560482e-003f,
-4.45817364e-003f,
-4.42753918e-003f,
-4.39380109e-003f,
-4.35705157e-003f,
-4.31737211e-003f,
-4.27483488e-003f,
-4.22950182e-003f,
-4.18143021e-003f,
-4.13067406e-003f,
-4.07729158e-003f,
-4.02134517e-003f,
-3.96290747e-003f,
-3.90205812e-003f,
-3.83888627e-003f,
-3.77348741e-003f,
-3.70596047e-003f,
-3.63640557e-003f,
-3.56492004e-003f,
-3.49159772e-003f,
-3.41652730e-003f,
-3.33979214e-003f,
-3.26147093e-003f,
-3.18164006e-003f,
-3.10037448e-003f,
-3.01775034e-003f,
-2.93384655e-003f,
-2.84874439e-003f,
-2.76253000e-003f,
-2.67529138e-003f,
-2.58711912e-003f,
-2.49810494e-003f,
-2.40833918e-003f,
-2.31791055e-003f,
-2.22690497e-003f,
-2.13540508e-003f,
-2.04349053e-003f,
-1.95123744e-003f,
-1.85872091e-003f,
-1.76601403e-003f,
-1.67319004e-003f,
-1.58032239e-003f,
-1.48748502e-003f,
-1.39475265e-003f,
-1.30220037e-003f,
-1.20990304e-003f,
-1.11793494e-003f,
-1.02636847e-003f,
-9.35274351e-004f,
-8.44720867e-004f,
-7.54773559e-004f,
-6.65495580e-004f,
-5.76947758e-004f,
-4.89188882e-004f,
-4.02276404e-004f,
-3.16266436e-004f,
-2.31214275e-004f,
-1.47174447e-004f,
-6.42006416e-005f,
1.76543708e-005f,
9.83390419e-005f,
1.77803347e-004f,
2.55999039e-004f,
3.32879979e-004f,
4.08402208e-004f,
4.82524018e-004f,
5.55205974e-004f,
6.26410707e-004f,
6.96102681e-004f,
7.64248136e-004f,
8.30814941e-004f,
8.95772188e-004f,
9.59090481e-004f,
1.02074177e-003f,
1.08069950e-003f,
1.13893847e-003f,
1.19543541e-003f,
1.25016889e-003f,
1.30311900e-003f,
1.35426840e-003f,
1.40360114e-003f,
1.45110337e-003f,
1.49676332e-003f,
1.54057052e-003f,
1.58251647e-003f,
1.62259396e-003f,
1.66079728e-003f,
1.69712235e-003f,
1.73156615e-003f,
1.76412740e-003f,
1.79480610e-003f,
1.82360387e-003f,
1.85052375e-003f,
1.87557051e-003f,
1.89875020e-003f,
1.92007073e-003f,
1.93954131e-003f,
1.95717253e-003f,
1.97297661e-003f,
1.98696670e-003f,
1.99915748e-003f,
2.00956455e-003f,
2.01820466e-003f,
2.02509598e-003f,
2.03025737e-003f,
2.03370932e-003f,
2.03547254e-003f,
2.03556987e-003f,
2.03402434e-003f,
2.03086087e-003f,
2.02610437e-003f,
2.01978162e-003f,
2.01192009e-003f,
2.00254773e-003f,
1.99169340e-003f,
1.97938737e-003f,
1.96565990e-003f,
1.95054186e-003f,
1.93406548e-003f,
1.91626314e-003f,
1.89716765e-003f,
1.87681289e-003f,
1.85523275e-003f,
1.83246215e-003f,
1.80853624e-003f,
1.78349065e-003f,
1.75736146e-003f,
1.73018500e-003f,
1.70199818e-003f,
1.67283800e-003f,
1.64274173e-003f,
1.61174696e-003f,
1.57989131e-003f,
1.54721260e-003f,
1.51374890e-003f,
1.47953816e-003f,
1.44461857e-003f,
1.40902831e-003f,
1.37280533e-003f,
1.33598805e-003f,
1.29861443e-003f,
1.26072252e-003f,
1.22235017e-003f,
1.18353509e-003f,
1.14431512e-003f,
1.10472727e-003f,
1.06480892e-003f,
1.02459674e-003f,
9.84127517e-004f,
9.43437277e-004f,
9.02561995e-004f,
8.61537294e-004f,
8.20398272e-004f,
7.79179740e-004f,
7.37916096e-004f,
6.96641160e-004f,
6.55388460e-004f,
6.14190882e-004f,
5.73080964e-004f,
5.32090489e-004f,
4.91250888e-004f,
4.50592954e-004f,
4.10146866e-004f,
3.69942252e-004f,
3.30008130e-004f,
2.90372787e-004f,
2.51063990e-004f,
2.12108804e-004f,
1.73533612e-004f,
1.35364156e-004f,
9.76254742e-005f,
5.95479178e-005f,
2.29176349e-005f,
-1.22622696e-005f,
-4.59905932e-005f,
-7.82679781e-005f,
-1.09096894e-004f,
-1.38481570e-004f,
-1.66427970e-004f,
-1.92943728e-004f,
-2.18038127e-004f,
-2.41722009e-004f,
-2.64007802e-004f,
-2.84909329e-004f,
-3.04441957e-004f,
-3.22622363e-004f,
-3.39468650e-004f,
-3.55000055e-004f,
-3.69237212e-004f,
-3.82201863e-004f,
-3.93916911e-004f,
-4.04406252e-004f,
-4.13694885e-004f,
-4.21808858e-004f,
-4.28774947e-004f,
-4.34620975e-004f,
-4.39375435e-004f,
-4.43067664e-004f,
-4.45727695e-004f,
-4.47386235e-004f,
-4.48074512e-004f,
-4.47824365e-004f,
-4.46668157e-004f,
-4.44638688e-004f,
-4.41769138e-004f,
-4.38092946e-004f,
-4.33644047e-004f,
-4.28456435e-004f,
-4.22564452e-004f,
-4.16002498e-004f,
-4.08805121e-004f,
-4.01006895e-004f,
-3.92642512e-004f,
-3.83746432e-004f,
-3.74353258e-004f,
-3.64497391e-004f,
-3.54213029e-004f,
-3.43534251e-004f,
-3.32494819e-004f,
-3.21128318e-004f,
-3.09467956e-004f,
-2.97546561e-004f,
-2.85396643e-004f,
-2.73050275e-004f,
-2.60539062e-004f,
-2.47894117e-004f,
-2.35146057e-004f,
-2.22324932e-004f,
-2.09460253e-004f,
-1.96580891e-004f,
-1.83715136e-004f,
-1.70890547e-004f,
-1.58134077e-004f,
-1.45471975e-004f,
-1.32929752e-004f,
-1.20532168e-004f,
-1.08303233e-004f,
-9.62662016e-005f,
-8.44435126e-005f,
-7.28568120e-005f,
-6.15269164e-005f,
-5.04738091e-005f,
-3.97166368e-005f,
-2.92736822e-005f,
-1.91623694e-005f,
-9.39925121e-006f,
0.00000000e+000f,

```

### Core Architecture Module: `Examples/IPlugConvoEngine/resources/AUv3Framework.h`
```

#include <TargetConditionals.h>
#if TARGET_OS_IOS == 1 || TARGET_OS_VISION == 1
#import <UIKit/UIKit.h>
#else
#import <Cocoa/Cocoa.h>
#endif

//! Project version number for AUv3Framework.
FOUNDATION_EXPORT double AUv3FrameworkVersionNumber;

//! Project version string for AUv3Framework.
FOUNDATION_EXPORT const unsigned char AUv3FrameworkVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <AUv3Framework/PublicHeader.h>
@class IPlugAUViewController_vIPlugConvoEngine;

```

### Core Architecture Module: `Examples/IPlugConvoEngine/resources/resource.h`
```
//{{NO_DEPENDENCIES}}
// Microsoft Visual C++ generated include file.
// Used by main.rc

#define IDR_ACCELERATOR1                40000
#define IDD_DIALOG_MAIN                 40001
#define IDD_DIALOG_PREF                 40002
#define IDI_ICON1                       40003
#define IDR_MENU1                       40004
#define ID_ABOUT                        40005
#define ID_PREFERENCES                  40006
#define ID_QUIT                         40007
#define ID_HELP                         40008
#define IDC_COMBO_AUDIO_DRIVER          40009
#define IDC_COMBO_AUDIO_IN_DEV          40010
#define IDC_COMBO_AUDIO_OUT_DEV         40011
#define IDC_COMBO_AUDIO_BUF_SIZE        40012
#define IDC_COMBO_AUDIO_SR              40013
#define IDC_COMBO_AUDIO_IN_L            40014
#define IDC_COMBO_AUDIO_IN_R            40015
#define IDC_COMBO_AUDIO_OUT_R           40016
#define IDC_COMBO_AUDIO_OUT_L           40017
#define IDC_COMBO_MIDI_IN_DEV           40018
#define IDC_COMBO_MIDI_OUT_DEV          40019
#define IDC_COMBO_MIDI_IN_CHAN          40020
#define IDC_COMBO_MIDI_OUT_CHAN         40021
#define IDC_BUTTON_OS_DEV_SETTINGS      40022
#define IDC_CB_MONO_INPUT               40023
#define IDAPPLY                         40024
#define ID_LIVE_EDIT                    40025
#define ID_SHOW_DRAWN                   40026
#define ID_SHOW_FPS                     40027
#define ID_SHOW_BOUNDS                  40028
#define ID_SCREENSHOT                   40029

// Next default values for new objects
//
#ifdef APSTUDIO_INVOKED
#ifndef APSTUDIO_READONLY_SYMBOLS
#define _APS_NEXT_RESOURCE_VALUE        105
#define _APS_NEXT_COMMAND_VALUE         40001
#define _APS_NEXT_CONTROL_VALUE         1011
#define _APS_NEXT_SYMED_VALUE           101
#endif
#endif

```

### Core Architecture Module: `Examples/IPlugConvoEngine/scripts/prepare_resources-ios.py`
```
#!/usr/bin/python3

# this script will create/update info plist files based on config.h

kAudioUnitType_MusicDevice      = "aumu"
kAudioUnitType_MusicEffect      = "aumf"
kAudioUnitType_Effect           = "aufx"
kAudioUnitType_MIDIProcessor    = "aumi"

import plistlib, os, datetime, fileinput, glob, sys, string, shutil

scriptpath = os.path.dirname(os.path.realpath(__file__))
projectpath = os.path.abspath(os.path.join(scriptpath, os.pardir))

IPLUG2_ROOT = "../../.."

sys.path.insert(0, os.path.join(os.getcwd(), IPLUG2_ROOT + '/Scripts'))

from parse_config import parse_config, parse_xcconfig

def copy_resources_to_destination(projectpath, dst, label=""):
  """Copy image and font resources from project to destination folder."""
  display_dst = label if label else dst

  if os.path.exists(projectpath + "/resources/img/"):
    for img in os.listdir(projectpath + "/resources/img/"):
      print("copying " + img + " to " + display_dst)
      shutil.copy(projectpath + "/resources/img/" + img, dst)

  if os.path.exists(projectpath + "/resources/fonts/"):
    for font in os.listdir(projectpath + "/resources/fonts/"):
      print("copying " + font + " to " + display_dst)
      shutil.copy(projectpath + "/resources/fonts/" + font, dst)

def main():
  if(len(sys.argv) == 2):
     if(sys.argv[1] == "app"):
       print("Copying resources ...")
       dst = os.environ["TARGET_BUILD_DIR"] + "/" + os.environ["UNLOCALIZED_RESOURCES_FOLDER_PATH"]
       copy_resources_to_destination(projectpath, dst)

  config = parse_config(projectpath)
  xcconfig = parse_xcconfig(os.path.join(os.getcwd(), IPLUG2_ROOT +  '/common-ios.xcconfig'))

  CFBundleGetInfoString = config['BUNDLE_NAME'] + " v" + config['FULL_VER_STR'] + " " + config['PLUG_COPYRIGHT_STR']
  CFBundleVersion = config['FULL_VER_STR']
  CFBundlePackageType = "BNDL"
  CSResourcesFileMapped = True
  LSMinimumSystemVersion = xcconfig['DEPLOYMENT_TARGET']

  print("Processing Info.plist files...")

# AUDIOUNIT v3

  if config['PLUG_TYPE'] == 0:
    if config['PLUG_DOES_MIDI_IN']:
      COMPONENT_TYPE = kAudioUnitType_MusicEffect
    else:
      COMPONENT_TYPE = kAudioUnitType_Effect
  elif config['PLUG_TYPE'] == 1:
    COMPONENT_TYPE = kAudioUnitType_MusicDevice
  elif config['PLUG_TYPE'] == 2:
    COMPONENT_TYPE = kAudioUnitType_MIDIProcessor

  if config['PLUG_HAS_UI'] == 1:
    NSEXTENSIONPOINTIDENTIFIER  = "com.apple.AudioUnit-UI"
  else:
    NSEXTENSIONPOINTIDENTIFIER  = "com.apple.AudioUnit"

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-iOS-AUv3-Info.plist"
  
  NSEXTENSIONATTRDICT = dict(
    NSExtensionAttributes = dict(AudioComponents = [{}]),
    NSExtensionPointIdentifier = NSEXTENSIONPOINTIDENTIFIER
  )
  with open(plistpath, 'rb') as fp:
    auv3 = plistlib.load(fp)
  auv3['CFBundleExecutable'] = config['BUNDLE_NAME'] + "AppExtension"
  auv3['CFBundleIdentifier'] = "$(PRODUCT_BUNDLE_IDENTIFIER)"
  auv3['CFBundleName'] = config['BUNDLE_NAME'] + "AppExtension"
  auv3['CFBundleDisplayName'] = config['BUNDLE_NAME'] + "AppExtension"
  auv3['CFBundleVersion'] = CFBundleVersion
  auv3['CFBundleShortVersionString'] = CFBundleVersion
  auv3['CFBundlePackageType'] = "XPC!"
  auv3['NSExtension'] = NSEXTENSIONATTRDICT
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'] = [{}]
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['description'] = config['PLUG_NAME']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['manufacturer'] = config['PLUG_MFR_ID']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['name'] = config['PLUG_MFR'] + ": " + config['PLUG_NAME']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['subtype'] = config['PLUG_UNIQUE_ID']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['type'] = COMPONENT_TYPE
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['version'] = config['PLUG_VERSION_INT']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['sandboxSafe'] = True
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'] = ["",""]

  if config['PLUG_TYPE'] == 1:
    auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'][0] = "Synth"
  else:
    auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'][0] = "Effects"
    
  if config['PLUG_HAS_UI'] == 1:
    auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'][1] = "size:{" + str(config['PLUG_WIDTH']) + "," + str(config['PLUG_HEIGHT']) + "}"
    auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['factoryFunction'] = "IPlugAUViewController_vIPlugConvoEngine"
    auv3['NSExtension']['NSExtensionMainStoryboard'] = config['BUNDLE_NAME'] + "-iOS-MainInterface"
  else:
    auv3['NSExtension']['NSExtensionPrincipalClass'] = "IPlugAUViewController_vIPlugConvoEngine"

  with open(plistpath, 'wb') as fp:
    plistlib.dump(auv3, fp)
# Standalone APP

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-iOS-Info.plist"
  with open(plistpath, 'rb') as fp:
    iOSapp = plistlib.load(fp)
  iOSapp['CFBundleExecutable'] = config['BUNDLE_NAME']
  iOSapp['CFBundleIdentifier'] = "$(PRODUCT_BUNDLE_IDENTIFIER)"
  iOSapp['CFBundleName'] = config['BUNDLE_NAME']
  iOSapp['CFBundleVersion'] = CFBundleVersion
  iOSapp['CFBundleShortVersionString'] = CFBundleVersion
  iOSapp['CFBundlePackageType'] = "APPL"
  iOSapp['LSApplicationCategoryType'] = "public.app-category.music"

  with open(plistpath, 'wb') as fp:
    plistlib.dump(iOSapp, fp)
if __name__ == '__main__':
  main()

```

### Core Architecture Module: `Examples/IPlugConvoEngine/scripts/prepare_resources-mac.py`
```
#!/usr/bin/python3

# this script will create/update info plist files based on config.h and copy resources to the ~/Music/PLUG_NAME folder or the bundle depending on PLUG_SHARED_RESOURCES

kAudioUnitType_MusicDevice      = "aumu"
kAudioUnitType_MusicEffect      = "aumf"
kAudioUnitType_Effect           = "aufx"
kAudioUnitType_MIDIProcessor    = "aumi"

DONT_COPY = ("")

import plistlib, os, datetime, fileinput, glob, sys, string, shutil

scriptpath = os.path.dirname(os.path.realpath(__file__))
projectpath = os.path.abspath(os.path.join(scriptpath, os.pardir))

IPLUG2_ROOT = "../../.."

sys.path.insert(0, os.path.join(os.getcwd(), IPLUG2_ROOT + '/Scripts'))

from parse_config import parse_config, parse_xcconfig

def copy_resources_to_destination(projectpath, dst, label=""):
  """Copy image and font resources from project to destination folder."""
  display_dst = label if label else dst

  if os.path.exists(projectpath + "/resources/img/"):
    for img in os.listdir(projectpath + "/resources/img/"):
      print("copying " + img + " to " + display_dst)
      shutil.copy(projectpath + "/resources/img/" + img, dst)

  if os.path.exists(projectpath + "/resources/fonts/"):
    for font in os.listdir(projectpath + "/resources/fonts/"):
      print("copying " + font + " to " + display_dst)
      shutil.copy(projectpath + "/resources/fonts/" + font, dst)

def main():
  config = parse_config(projectpath)
  xcconfig = parse_xcconfig(os.path.join(os.getcwd(), IPLUG2_ROOT +  '/common-mac.xcconfig'))

  CFBundleGetInfoString = config['BUNDLE_NAME'] + " v" + config['FULL_VER_STR'] + " " + config['PLUG_COPYRIGHT_STR']
  CFBundleVersion = config['FULL_VER_STR']
  CFBundlePackageType = "BNDL"
  CSResourcesFileMapped = True
  LSMinimumSystemVersion = xcconfig['DEPLOYMENT_TARGET']

  print("Copying resources ...")

  if config['PLUG_SHARED_RESOURCES']:
    dst = os.path.expanduser("~") + "/Music/" + config['BUNDLE_NAME'] + "/Resources"
  else:
    dst = os.path.join(os.environ["TARGET_BUILD_DIR"], os.environ["UNLOCALIZED_RESOURCES_FOLDER_PATH"].lstrip('/'))

  if os.path.exists(dst) == False:
    os.makedirs(dst + "/", 0o0755 )

  copy_resources_to_destination(projectpath, dst)

  # Also copy resources to AUv3 Framework for macOS sandbox compatibility
  # (AUv3 appex cannot access container app's resources in sandbox)
  if not config['PLUG_SHARED_RESOURCES']:
    target_build_dir = os.environ.get("TARGET_BUILD_DIR", "")
    if target_build_dir:
      framework_dst = os.path.join(target_build_dir, config['BUNDLE_NAME'] + ".app/Contents/Frameworks/AUv3Framework.framework/Versions/A/Resources")

      if os.path.exists(os.path.dirname(framework_dst)):
        if not os.path.exists(framework_dst):
          os.makedirs(framework_dst, 0o0755)

        copy_resources_to_destination(projectpath, framework_dst, "AUv3 Framework")

  print("Processing Info.plist files...")

# VST3

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-VST3-Info.plist"
  with open(plistpath, 'rb') as fp:
    vst3 = plistlib.load(fp)
  vst3['CFBundleExecutable'] = config['BUNDLE_NAME']
  vst3['CFBundleGetInfoString'] = CFBundleGetInfoString
  vst3['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".vst3." + config['BUNDLE_NAME'] + ""
  vst3['CFBundleName'] = config['BUNDLE_NAME']
  vst3['CFBundleVersion'] = CFBundleVersion
  vst3['CFBundleShortVersionString'] = CFBundleVersion
  vst3['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  vst3['CFBundlePackageType'] = CFBundlePackageType
  vst3['CFBundleSignature'] = config['PLUG_UNIQUE_ID']
  vst3['CSResourcesFileMapped'] = CSResourcesFileMapped

  with open(plistpath, 'wb') as fp:
    plistlib.dump(vst3, fp)
# VST2

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-VST2-Info.plist"
  with open(plistpath, 'rb') as fp:
    vst2 = plistlib.load(fp)
  vst2['CFBundleExecutable'] = config['BUNDLE_NAME']
  vst2['CFBundleGetInfoString'] = CFBundleGetInfoString
  vst2['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".vst." + config['BUNDLE_NAME'] + ""
  vst2['CFBundleName'] = config['BUNDLE_NAME']
  vst2['CFBundleVersion'] = CFBundleVersion
  vst2['CFBundleShortVersionString'] = CFBundleVersion
  vst2['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  vst2['CFBundlePackageType'] = CFBundlePackageType
  vst2['CFBundleSignature'] = config['PLUG_UNIQUE_ID']
  vst2['CSResourcesFileMapped'] = CSResourcesFileMapped

  with open(plistpath, 'wb') as fp:
    plistlib.dump(vst2, fp)
# AUDIOUNIT v2

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-AU-Info.plist"
  with open(plistpath, 'rb') as fp:
    auv2 = plistlib.load(fp)
  auv2['CFBundleExecutable'] = config['BUNDLE_NAME']
  auv2['CFBundleGetInfoString'] = CFBundleGetInfoString
  auv2['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".audiounit." + config['BUNDLE_NAME'] + ""
  auv2['CFBundleName'] = config['BUNDLE_NAME']
  auv2['CFBundleVersion'] = CFBundleVersion
  auv2['CFBundleShortVersionString'] = CFBundleVersion
  auv2['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  auv2['CFBundlePackageType'] = CFBundlePackageType
  auv2['CFBundleSignature'] = config['PLUG_UNIQUE_ID']
  auv2['CSResourcesFileMapped'] = CSResourcesFileMapped

  if config['PLUG_TYPE'] == 0:
    if config['PLUG_DOES_MIDI_IN']:
      COMPONENT_TYPE = kAudioUnitType_MusicEffect
    else:
      COMPONENT_TYPE = kAudioUnitType_Effect
  elif config['PLUG_TYPE'] == 1:
    COMPONENT_TYPE = kAudioUnitType_MusicDevice
  elif config['PLUG_TYPE'] == 2:
    COMPONENT_TYPE = kAudioUnitType_MIDIProcessor

  auv2['AudioUnit Version'] = config['PLUG_VERSION_HEX']
  auv2['AudioComponents'] = [{}]
  auv2['AudioComponents'][0]['description'] = config['PLUG_NAME']
  auv2['AudioComponents'][0]['factoryFunction'] = config['AUV2_FACTORY']
  auv2['AudioComponents'][0]['manufacturer'] = config['PLUG_MFR_ID']
  auv2['AudioComponents'][0]['name'] = config['PLUG_MFR'] + ": " + config['PLUG_NAME']
  auv2['AudioComponents'][0]['subtype'] = config['PLUG_UNIQUE_ID']
  auv2['AudioComponents'][0]['type'] = COMPONENT_TYPE
  auv2['AudioComponents'][0]['version'] = config['PLUG_VERSION_INT']
  auv2['AudioComponents'][0]['sandboxSafe'] = True

  with open(plistpath, 'wb') as fp:
    plistlib.dump(auv2, fp)
# AUDIOUNIT v3

  if config['PLUG_HAS_UI']:
    NSEXTENSIONPOINTIDENTIFIER  = "com.apple.AudioUnit-UI"
  else:
    NSEXTENSIONPOINTIDENTIFIER  = "com.apple.AudioUnit"

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-macOS-AUv3-Info.plist"
  with open(plistpath, 'rb') as fp:
    auv3 = plistlib.load(fp)
  auv3['CFBundleExecutable'] = config['BUNDLE_NAME']
  auv3['CFBundleGetInfoString'] = CFBundleGetInfoString
  auv3['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".app." + config['BUNDLE_NAME'] + ".AUv3"
  auv3['CFBundleName'] = config['BUNDLE_NAME']
  auv3['CFBundleVersion'] = CFBundleVersion
  auv3['CFBundleShortVersionString'] = CFBundleVersion
  auv3['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  auv3['CFBundlePackageType'] = "XPC!"
  auv3['NSExtension'] = dict(
  NSExtensionAttributes = dict(
                               AudioComponentBundle = "com.AcmeInc.app." + config['BUNDLE_NAME'] + ".AUv3Framework",
                               AudioComponents = [{}]),
#                               NSExtensionServiceRoleType = "NSExtensionServiceRoleTypeEditor",
  NSExtensionPointIdentifier = NSEXTENSIONPOINTIDENTIFIER,
  NSExtensionPrincipalClass = "IPlugAUViewController_vIPlugConvoEngine"
                             )
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'] = [{}]
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['description'] = config['PLUG_NAME']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['manufacturer'] = config['PLUG_MFR_ID']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['name'] = config['PLUG_MFR'] + ": " + config['PLUG_NAME']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['subtype'] = config['PLUG_UNIQUE_ID']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['type'] = COMPONENT_TYPE
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['version'] = config['PLUG_VERSION_INT']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['sandboxSafe'] = True
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'] = [{}]

  if config['PLUG_TYPE'] == 1:
    auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'][0] = "Synth"
  else:
    auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'][0] = "Effects"

  with open(plistpath, 'wb') as fp:
    plistlib.dump(auv3, fp)
# AAX

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-AAX-Info.plist"
  with open(plistpath, 'rb') as fp:
    aax = plistlib.load(fp)
  aax['CFBundleExecutable'] = config['BUNDLE_NAME']
  aax['CFBundleGetInfoString'] = CFBundleGetInfoString
  aax['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".aax." + config['BUNDLE_NAME'] + ""
  aax['CFBundleName'] = config['BUNDLE_NAME']
  aax['CFBundleVersion'] = CFBundleVersion
  aax['CFBundleShortVersionString'] = CFBundleVersion
  aax['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  aax['CSResourcesFileMapped'] = CSResourcesFileMapped

  with open(plistpath, 'wb') as fp:
    plistlib.dump(aax, fp)
# APP

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-macOS-Info.plist"
  with open(plistpath, 'rb') as fp:
    macOSapp = plistlib.load(fp)
  macOSapp['CFBundleExecutable'] = config['BUNDLE_NAME']
  macOSapp['CFBundleGetInfoString'] = CFBundleGetInfoString
  macOSapp['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".app." + config['BUNDLE_NAME'] + ""
  macOSapp['CFBundleName'] = config['BUNDLE_NAME']
 
```

### Core Architecture Module: `Examples/IPlugConvoEngine/scripts/prepare_resources-win.py`
```
#!/usr/bin/python3

import plistlib, os, datetime, fileinput, glob, sys, string, shutil

scriptpath = os.path.dirname(os.path.realpath(__file__))
projectpath = os.path.abspath(os.path.join(scriptpath, os.pardir))

IPLUG2_ROOT = "../../.."

sys.path.insert(0, os.path.join(os.getcwd(), IPLUG2_ROOT + '/Scripts'))

from parse_config import parse_config

def main():
  print("not modifying rc file");
  # config = parse_config(projectpath)
  
  # rc = open(projectpath + "/resources/main.rc", "w")
  
  # rc.write("\n")
  # rc.write("/////////////////////////////////////////////////////////////////////////////\n")
  # rc.write("// Version\n")
  # rc.write("/////////////////////////////////////////////////////////////////////////////\n")
  # rc.write("VS_VERSION_INFO VERSIONINFO\n")
  # rc.write("FILEVERSION " + config['MAJOR_STR'] + "," + config['MINOR_STR'] + "," + config['BUGFIX_STR'] + ",0\n")
  # rc.write("PRODUCTVERSION " + config['MAJOR_STR'] + "," + config['MINOR_STR'] + "," + config['BUGFIX_STR'] + ",0\n")
  # rc.write(" FILEFLAGSMASK 0x3fL\n")
  # rc.write("#ifdef _DEBUG\n")
  # rc.write(" FILEFLAGS 0x1L\n")
  # rc.write("#else\n")
  # rc.write(" FILEFLAGS 0x0L\n")
  # rc.write("#endif\n")
  # rc.write(" FILEOS 0x40004L\n")
  # rc.write(" FILETYPE 0x1L\n")
  # rc.write(" FILESUBTYPE 0x0L\n")
  # rc.write("BEGIN\n")
  # rc.write('    BLOCK "StringFileInfo"\n')
  # rc.write("    BEGIN\n")
  # rc.write('        BLOCK "040004e4"\n')
  # rc.write("        BEGIN\n")
  # rc.write('            VALUE "FileVersion", "' + config['FULL_VER_STR'] + '"\0\n')
  # rc.write('            VALUE "ProductVersion", "' + config['FULL_VER_STR'] + '"0\n')
  # rc.write("#ifdef VST2_API\n")
  # rc.write('            VALUE "OriginalFilename", "' + config['BUNDLE_NAME'] + '.dll"\0\n')
  # rc.write("#elif defined VST3_API\n")
  # rc.write('            VALUE "OriginalFilename", "' + config['BUNDLE_NAME'] + '.vst3"\0\n')
  # rc.write("#elif defined AAX_API\n")
  # rc.write('            VALUE "OriginalFilename", "' + config['BUNDLE_NAME'] + '.aaxplugin"\0\n')
  # rc.write("#elif defined APP_API\n")
  # rc.write('            VALUE "OriginalFilename", "' + config['BUNDLE_NAME'] + '.exe"\0\n')
  # rc.write("#endif\n")  
  # rc.write('            VALUE "FileDescription", "' + config['PLUG_NAME'] + '"\0\n')
  # rc.write('            VALUE "InternalName", "' + config['PLUG_NAME'] + '"\0\n')
  # rc.write('            VALUE "ProductName", "' + config['PLUG_NAME'] + '"\0\n')
  # rc.write('            VALUE "CompanyName", "' + config['PLUG_MFR'] + '"\0\n')
  # rc.write('            VALUE "LegalCopyright", "' + config['PLUG_COPYRIGHT_STR'] + '"\0\n')
  # rc.write('            VALUE "LegalTrademarks", "' + config['PLUG_TRADEMARKS'] + '"\0\n')
  # rc.write("        END\n")
  # rc.write("    END\n")
  # rc.write('    BLOCK "VarFileInfo"\n')
  # rc.write("    BEGIN\n")
  # rc.write('        VALUE "Translation", 0x400, 1252\n')
  # rc.write("    END\n")
  # rc.write("END\n")
  # rc.write("\n")

if __name__ == '__main__':
  main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1110** (2024-07-13): **Changes to IGraphics Mac View breaks platform edit text positioning**
  *Symptoms*: **Describe the bug** fe1ca6fe86e102a5af28f417b50bc3167f006aaa means that text is not correctly vertically aligned in some cases within the platform text edit.  The commit has two parts - one that shrinks the rectangle by 3 pixels on each side and the other that stops negative adjustments being applied - this second part creates the problem.  **To Reproduce** Will repro for certain fonts at a given size.  **Expected behaviour** Text is vertically centred.  **Screenshots**  Before and After  <img width="122" alt="Screenshot 2024-07-13 at 07 49 59" src="https://github.com/user-attachments/assets/1fb92b36-92cf-4f37-873f-3e4e433fa14d">  <img width="116" alt="Screenshot 2024-07-13 at 07 39 22" src="https://github.com/user-attachments/assets/c9032b78-83d8-45ca-88bd-7af8075ce487">  **IMPORTANT DETAILS** Mac only - IGraphics with platform text entry. 

- **Issue #1075** (2024-03-17): **Missing color search info the background of IVControls**
  *Symptoms*: It seems that a constant is being directly interpreted as a color, when it should be being used as the index to find the relevant color from the style.  https://github.com/iPlug2/iPlug2/blob/1a1239123e254dd442064cd1a4b3c9852607deff/IGraphics/IControl.h#L1665
  **Post-Mortem & Fix Analysis**:
  > good catch

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

### Incident Patch 1: `4e118ffc` (2026-11-22)
**Commit Message**: ARA: synchronize rendering with model edits and harden the example archive

- Lock the playback and editor renderers out of the ARA model graph during host editing
  cycles and sample access changes (as in Celemony's ARA test plug-in), so that sample cache
  updates and region destruction cannot race with the audio thread. The audio thread never
  blocks: while locked out it skips rendering for that block.
- Balance analysis progress start/completion when an analysis is aborted.
- Drop stale analysis results when the host reports changed audio source samples.
- Version the document archive, write notes field by field rather than as raw structs, and
  bound-check note counts and ID lengths against the remaining archive bytes. Bump the
  example's archive ID accordingly.
- Move the note/pitch detection into IPlugARAExample_Analysis.h.
- Smooth the gain parameter, add missing includes and document nearest-sample rendering.
- Log ignored ARA 1 binding attempts and clarify ARA_ANALYZEABLE_CONTENT_TYPES usage.
- Add IPLUG2_ARA_FETCH_SDK to opt out of fetching the ARA SDK during configure.

**File**: `Examples/IPlugARAExample/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ iplug_add_plugin(${PROJECT_NAME}
     IPlugARAExample.cpp
     IPlugARAExample.h
     IPlugARAExample_ARA.h
+    IPlugARAExample_Analysis.h
     IPlugARAExample_Controls.h
     config.h
   RESOURCES
```

**File**: `Examples/IPlugARAExample/IPlugARAExample.cpp` (modified, +11/-3)
```diff
@@ -68,10 +68,18 @@ void IPlugARAExample::ProcessBlock(sample** inputs, sample** outputs, int nFrame
   if (auto* pEditorRenderer = GetARAEditorRenderer<IPlugARAExampleEditorRenderer>())
     pEditorRenderer->RenderPreview(outputs, nChans, GetSampleRate(), nFrames);
 
-  for (int c = 0; c < nChans; c++)
+  for (int s = 0; s < nFrames; s++)
   {
-    for (int s = 0; s < nFrames; s++)
-      outputs[c][s] *= gain;
+    const sample smoothedGain = mGainSmoother.Process(gain);
+
+    for (int c = 0; c < nChans; c++)
+      outputs[c][s] *= smoothedGain;
   }
 }
+
+void IPlugARAExample::OnReset()
+{
+  mGainSmoother.SetSmoothTime(20., GetSampleRate());
+  mGainSmoother.SetValue(GetParam(kGain)->Value() / 100.);
+}
 #endif
```

**File**: `Examples/IPlugARAExample/IPlugARAExample.h` (modified, +6/-0)
```diff
@@ -4,6 +4,7 @@
 
 #include "IPlug_include_in_plug_hdr.h"
 #include "IPlugARAExample_ARA.h"
+#include "Smoothers.h"
 
 const int kNumPresets = 1;
 
@@ -22,6 +23,7 @@ class IPlugARAExample final : public Plugin
 
 #if IPLUG_DSP
   void ProcessBlock(sample** inputs, sample** outputs, int nFrames) override;
+  void OnReset() override;
 #endif
 
   /** @return the last transport position seen by the audio thread, in seconds */
@@ -31,6 +33,10 @@ class IPlugARAExample final : public Plugin
   bool GetTransportWasRunning() const { return mTransportRunning.load(std::memory_order_relaxed); }
 
 private:
+#if IPLUG_DSP
+  LogParamSmooth<sample> mGainSmoother {20., 1.};
+#endif
+
   std::atomic<double> mPlayheadPos {0.};
   std::atomic<bool> mTransportRunning {false};
 };
```

**File**: `Examples/IPlugARAExample/IPlugARAExample_ARA.h` (modified, +250/-231)
```diff
@@ -2,14 +2,18 @@
 
 #include <algorithm>
 #include <atomic>
+#include <chrono>
 #include <cmath>
+#include <cstdint>
 #include <cstring>
 #include <mutex>
 #include <string>
 #include <thread>
+#include <type_traits>
 #include <vector>
 
 #include "IPlugARA.h"
+#include "IPlugARAExample_Analysis.h"
 
 
 /** Results of the (simulated) offline analysis of an audio source: an overall peak/RMS plus a list
@@ -26,10 +30,10 @@ struct IPlugARAExampleAnalysisResult
 /** An ARA audio source that caches all its samples in memory, so that the playback renderer
  * can access them from the realtime audio thread, and runs a background analysis over that cache
  * which produces the results persisted in the ARA document archive.
- * N.B. for the sake of simplicity this example does not synchronize sample cache updates
- * (main thread) with rendering (audio thread) - a real plug-in must add appropriate
- * synchronization. The analysis results are properly guarded, since they are produced on a
- * background thread. */
+ * The sample cache is only modified on the main thread while the document controller has locked
+ * the renderers out of the model graph (see IPlugARAExampleDocumentController::RendererAccess),
+ * and only after the analysis thread that reads it has been stopped. The analysis results are
+ * guarded by a mutex, since they are produced on the background thread. */
 class IPlugARAExampleAudioSource : public ARA::PlugIn::AudioSource
 {
 public:
@@ -100,6 +104,15 @@ class IPlugARAExampleAudioSource : public ARA::PlugIn::AudioSource
     return mAnalysis;
   }
 
+  /** Discard the analysis results, e.g. because the audio source samples changed */
+  void ClearAnalysis()
+  {
+    mHasAnalysis.store(false, std::memory_order_release);
+
+    std::lock_guard<std::mutex> lock(mAnalysisMutex);
+    mAnalysis = IPlugARAExampleAnalysisResult();
+  }
+
   /** Called when restoring from an archive - the archived results stand in for a re-analysis,
    * which is the whole point of persisting them */
   void SetAnalysis(const IPlugARAExampleAnalysisResult& result)
@@ -123,6 +136,15 @@ class IPlugARAExampleAudioSource : public ARA::PlugIn::AudioSource
 private:
   void RunAnalysis()
   {
+    // the ARA Library requires every progress start to be balanced by a completion, including
+    // when the analysis is aborted - otherwise the host may show the progress forever.
+    // N.B. unlike most document controller functions, the progress notifications may be called
+    // from any thread: the ARA Library queues them and sends them from notifyModelUpdates().
+    const auto finish = [this]() {
+      mAnalysing.store(false, std::memory_order_release);
+      getDocumentController()->notifyAudioSourceAnalysisProgressCompleted(this);
+    };
+
     IPlugARAExampleAnalysisResult result;
 
     const auto nChans = static_cast<int>(getChannelCount());
@@ -152,7 +174,7 @@ class IPlugARAExampleAudioSource : public ARA::PlugIn::AudioSource
     {
       if (mAnalysisAbort.load(std::memory_order_relaxed))
       {
-        mAnalysing.store(false, std::memory_order_release);
+        finish();
         return;
       }
 
@@ -184,7 +206,7 @@ class IPlugARAExampleAudioSource : public ARA::PlugIn::AudioSource
 
     result.peak = peak;
     result.rms = (nFrames > 0) ? std::sqrt(sumSq / (static_cast<double>(nFrames) * kFrame)) : 0.;
-    result.notes = DetectNotes(mono, envelope, kHop, kFrame, sampleRate);
+    result.notes = IPlugARAExampleAnalysis::DetectNotes(mono, envelope, kHop, kFrame, sampleRate);
 
     {
       std::lock_guard<std::mutex> lock(mAnalysisMutex);
@@ -193,151 +215,13 @@ class IPlugARAExampleAudioSource : public ARA::PlugIn::AudioSource
 
     mAnalysisProgress.store(1.f, std::memory_order_relaxed);
     mHasAnalysis.store(true, std::memory_order_release);
-    mAnalysing.store(false, std::memory_order_release);
-
-    getDocumentController()->notifyAudioSourceAnalysisProgressCompleted(this);
+    finish();
 
     // the content update itself must go out from the main thread - flag it for the document
     // controller to pick up in willNotifyModelUpdates()
     mAnalysisCompleted.store(true, std::memory_order_release);
   }
 
-  /** Segment the envelope into notes and estimate a pitch for each by autocorrelation.
-   * Crude by design - it stands in for the real detection a pitch editor would perform. */
-  static std::vector<ARA::ARAContentNote> DetectNotes(const std::vector<float>& mono, const std::vector<float>& envelope, int hop, int frame, double sampleRate)
-  {
-    std::vector<ARA::ARAContentNote> notes;
-
-    if (envelope.empty() || sampleRate <= 0.)
-      return notes;
-
-    const float threshold = std::max(0.005f, *std::max_element(envelope.begin(), envelope.end()) * 0.2f);
-
-    int noteStartFrame = -1;
-
-    const auto emitNote = [&](int startFrame, int endFrame) {
-      const auto startSample = static_cast<size_t>(startFrame) * static_cast<size_t>(hop);
-      const auto endSample = static
```

**File**: `Examples/IPlugARAExample/IPlugARAExample_Analysis.h` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+#pragma once
+
+/** The (deliberately crude) signal analysis behind IPlugARAExample's note detection: onset
+ * segmentation of an RMS envelope plus a normalized-autocorrelation pitch estimate. It stands in
+ * for the real detection a pitch editor would perform, and is kept apart from the ARA model code
+ * because none of it is ARA specific. */
+
+#include <algorithm>
+#include <cmath>
+#include <vector>
+
+#include "ARA_API/ARAInterface.h"
+#include "IPlugUtilities.h"
+
+namespace IPlugARAExampleAnalysis
+{
+
+/** Normalized autocorrelation pitch estimate over one window,
+ * @return frequency in Hz, or 0 if the window has no clear pitch */
+inline double EstimatePitch(const std::vector<float>& mono, size_t start, size_t windowSize, double sampleRate)
+{
+  constexpr double kMinFreq = 50.;
+  constexpr double kMaxFreq = 2000.;
+  constexpr double kPeakThreshold = 0.85; // fraction of the best score a peak must reach to count
+
+  const auto minLag = static_cast<size_t>(sampleRate / kMaxFreq);
+  const auto maxLag = static_cast<size_t>(sampleRate / kMinFreq);
+
+  if (start + windowSize + maxLag > mono.size() || maxLag <= minLag)
+    return 0.;
+
+  double energy = 0.;
+  for (size_t i = 0; i < windowSize; i++)
+    energy += static_cast<double>(mono[start + i]) * mono[start + i];
+
+  if (energy <= 0.)
+    return 0.;
+
+  // normalized correlation per lag - dividing by the energy of the lagged window as well keeps
+  // the score comparable across lags, which matters for the peak picking below
+  std::vector<double> scores(maxLag - minLag + 1, 0.);
+
+  for (size_t lag = minLag; lag <= maxLag; lag++)
+  {
+    double corr = 0.;
+    double lagEnergy = 0.;
+
+    for (size_t i = 0; i < windowSize; i++)
+    {
+      const double a = mono[start + i];
+      const double b = mono[start + i + lag];
+      corr += a * b;
+      lagEnergy += b * b;
+    }
+
+    const double norm = std::sqrt(energy * lagEnergy);
+    scores[lag - minLag] = (norm > 0.) ? (corr / norm) : 0.;
+  }
+
+  const double maxScore = *std::max_element(scores.begin(), scores.end());
+
+  if (maxScore < 0.5)
+    return 0.;
+
+  // A periodic signal correlates just as well at every multiple of its period, so simply taking
+  // the highest score picks an arbitrary subharmonic (an octave-down error). Take the *first*
+  // local peak that gets close to the best score instead - that is the fundamental period.
+  for (size_t i = 1; i + 1 < scores.size(); i++)
+  {
+    if (scores[i] >= kPeakThreshold * maxScore && scores[i] >= scores[i - 1] && scores[i] >= scores[i + 1])
+    {
+      // parabolic interpolation around the peak for sub-sample period accuracy
+      const double s0 = scores[i - 1];
+      const double s1 = scores[i];
+      const double s2 = scores[i + 1];
+      const double denom = (2. * s1) - s0 - s2;
+      const double offset = (denom != 0.) ? (0.5 * (s0 - s2) / denom) : 0.;
+
+      const double lag = static_cast<double>(minLag + i) + iplug::Clip(offset, -1., 1.);
+      return (lag > 0.) ? (sampleRate / lag) : 0.;
+    }
+  }
+
+  return 0.;
+}
+
+/** Segment an RMS envelope (one value per hop) into notes and estimate a pitch for each */
+inline std::vector<ARA::ARAContentNote> DetectNotes(const std::vector<float>& mono, const std::vector<float>& envelope, int hop, int frame, double sampleRate)
+{
+  std::vector<ARA::ARAContentNote> notes;
+
+  if (envelope.empty() || sampleRate <= 0.)
+    return notes;
+
+  const float threshold = std::max(0.005f, *std::max_element(envelope.begin(), envelope.end()) * 0.2f);
+
+  int noteStartFrame = -1;
+
+  const auto emitNote = [&](int startFrame, int endFrame) {
+    const auto startSample = static_cast<size_t>(startFrame) * static_cast<size_t>(hop);
+    const auto endSample = static_cast<size_t>(endFrame) * static_cast<size_t>(hop);
+
+    if (endSample <= startSample || endSample > mono.size())
+      return;
+
+    ARA::ARAContentNote note {};
+    note.startPosition = static_cast<double>(startSample) / sampleRate;
+    note.noteDuration = static_cast<double>(endSample - startSample) / sampleRate;
+    note.signalDuration = note.noteDuration;
+    note.attackDuration = std::min(0.01, note.noteDuration);
+
+    float envPeak = 0.f;
+    for (int f = startFrame; f < endFrame && f < static_cast<int>(envelope.size()); f++)
+      envPeak = std::max(envPeak, envelope[static_cast<size_t>(f)]);
+
+    note.volume = std::min(1.f, envPeak);
+
+    const double freq = EstimatePitch(mono, startSample, static_cast<size_t>(frame), sampleRate);
+
+    if (freq > 0.)
+    {
+      note.frequency = static_cast<float>(freq);
+      note.pitchNumber = static_cast<ARA::ARAPitchNumber>(std::lround(69. + 12. * std::log2(freq / 440.)));
+    }
+    else
+    {
+      note.frequency = ARA::kARAInvalidFrequency;
+      note.pitchNumber = ARA::kARAInvalidPitchNumber;
+    }
+
+    notes.push_back(note);
+  };
+
+  for (int f = 0; f < static_cast<int>(envelope.size()); f++)
+  {
+   
```

**File**: `Examples/IPlugARAExample/README.md` (modified, +14/-5)
```diff
@@ -94,10 +94,16 @@ editor renderer, right-click to toggle the modification's reverse edit.
 It also uses the `"Fx|OnlyARA"` VST3 subcategory, which marks a plug-in that requires ARA to
 operate. Plug-ins that also work without ARA should use `"Fx|ARA"` instead.
 
-N.B. For clarity this example does not synchronize ARA model edits (main thread) with rendering
-(audio thread) - a real plug-in must do so. Its archive format is also simplified (native endian),
-and the note detection is deliberately crude, standing in for the real analysis a pitch editor
-would perform.
+**Synchronizing rendering with model edits.** The host edits the ARA model on the main thread
+while the renderers read it on the audio thread. Following Celemony's ARA test plug-in, the
+document controller locks the renderers out of the model for the duration of each host editing
+cycle (and while sample access is toggled). The audio thread never blocks - while locked out it
+outputs silence for that block. See `IPlugARAExampleDocumentController::RendererAccess`.
+
+N.B. The archive format is simplified (native endian, but versioned and bounds checked), and the
+note detection in `IPlugARAExample_Analysis.h` is deliberately crude, standing in for the real
+analysis a pitch editor would perform. Regions are rendered with nearest-sample lookup, so
+stretched regions alias.
 
 ## Building
 
@@ -109,7 +115,10 @@ cmake --build build --target IPlugARAExample-vst3-ara
 The ARA SDK (`ARA_API` + `ARA_Library`, Apache 2.0 licensed) is fetched automatically via CMake
 FetchContent, pinned to an ARA SDK release tag. To use a local copy instead, clone
 [Celemony/ARA_SDK](https://github.com/Celemony/ARA_SDK) (with submodules) into
-`Dependencies/IPlug/ARA_SDK`, or pass `-DARA_SDK_DIR=/path/to/ARA_SDK`.
+`Dependencies/IPlug/ARA_SDK`, or pass `-DARA_SDK_DIR=/path/to/ARA_SDK`. To configure without
+network access and without ARA targets, pass `-DIPLUG2_ARA_FETCH_SDK=OFF`.
+
+The example builds on macOS, Windows and Linux, and CI builds it on all three.
 
 The VST3 SDK must be present in `Dependencies/IPlug/VST3_SDK` (see
 `Dependencies/IPlug/download-vst3-sdk.sh`).
```

**File**: `Examples/IPlugARAExample/config.h` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
 
 #define ARA_DOC_CONTROLLER_CLASS IPlugARAExampleDocumentController
 #define ARA_FACTORY_ID "com.AcmeInc.IPlugARAExample.arafactory"
-#define ARA_DOC_ARCHIVE_ID "com.AcmeInc.IPlugARAExample.aradocumentarchive.2"
+#define ARA_DOC_ARCHIVE_ID "com.AcmeInc.IPlugARAExample.aradocumentarchive.3"
 
 // This plug-in stretches playback regions to fit the borders the host gives them, so hosts may
 // let the user drag a region's borders independently of its content
```

**File**: `IPlug/ARA/IPlugARA_include_in_plug_src.h` (modified, +4/-1)
```diff
@@ -38,7 +38,10 @@ DEF_CLASS_IID(ARA::IPlugInEntryPoint2)
 #endif
 
 /** Comma separated list of ARA::ARAContentType values that the plug-in can analyze and then
- * export to the host, e.g. ARA::kARAContentTypeNotes. Hosts use this both to decide which
+ * export to the host, without enclosing braces, e.g.
+ * #define ARA_ANALYZEABLE_CONTENT_TYPES ARA::kARAContentTypeNotes, ARA::kARAContentTypeKeySignatures
+ * The list is used to initialize an array, so if defined it must not be empty - leave the macro
+ * undefined if the plug-in does not analyze any content. Hosts use this both to decide which
  * content to request and to show the plug-in's capabilities in their UI. */
 #ifdef ARA_ANALYZEABLE_CONTENT_TYPES
   #define ARA_HAS_ANALYZEABLE_CONTENT_TYPES 1
```

---

### Incident Patch 2: `c1245e20` (2026-11-21)
**Commit Message**: Bump devalue from 5.8.1 to 5.9.4 in /Examples/IPlugSvelteUI/web-ui

Bumps [devalue](https://github.com/sveltejs/devalue) from 5.8.1 to 5.9.4.
- [Release notes](https://github.com/sveltejs/devalue/releases)
- [Changelog](https://github.com/sveltejs/devalue/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sveltejs/devalue/compare/v5.8.1...v5.9.4)

---
updated-dependencies:
- dependency-name: devalue
  dependency-version: 5.9.4
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Examples/IPlugSvelteUI/web-ui/package-lock.json` (modified, +3/-3)
```diff
@@ -535,9 +535,9 @@
       }
     },
     "node_modules/devalue": {
-      "version": "5.8.1",
-      "resolved": "https://registry.npmjs.org/devalue/-/devalue-5.8.1.tgz",
-      "integrity": "sha512-4CXDYRBGqN+57wVJkuXBYmpAVUSg3L6JAQa/DFqm238G73E1wuyc/JhGQJzN7vUf/CMphYau2zXbfWzDR5aTEw==",
+      "version": "5.9.4",
+      "resolved": "https://registry.npmjs.org/devalue/-/devalue-5.9.4.tgz",
+      "integrity": "sha512-sPAT4pztbu6586/hrhOnMKS17IJrvg12mXiSPSS3W5qDeN2RGgvZ0diZCm31dBbnevfVmujNO3IM2wrS4Y2Rhg==",
       "dev": true,
       "license": "MIT"
     },
```

---

### Incident Patch 3: `ecd7309a` (2026-11-21)
**Commit Message**: Bump vite from 8.1.4 to 8.3.8 in /Examples/IPlugSvelteUI/web-ui

Bumps [vite](https://github.com/vitejs/vite/tree/HEAD/packages/vite) from 8.1.4 to 8.3.8.
- [Release notes](https://github.com/vitejs/vite/releases)
- [Changelog](https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md)
- [Commits](https://github.com/vitejs/vite/commits/v8.3.8/packages/vite)

---
updated-dependencies:
- dependency-name: vite
  dependency-version: 8.3.8
  dependency-type: direct:development
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Examples/IPlugSvelteUI/web-ui/package-lock.json` (modified, +200/-167)
```diff
@@ -11,25 +11,25 @@
         "@sveltejs/vite-plugin-svelte": "^7.1.2",
         "@tsconfig/svelte": "^5.0.8",
         "svelte": "^5.55.7",
-        "vite": "^8.1.4"
+        "vite": "^8.3.8"
       }
     },
     "node_modules/@emnapi/core": {
-      "version": "1.11.1",
-      "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-1.11.1.tgz",
-      "integrity": "sha512-RSvbQmHzdKzNsLYa/wHrbc3KN4sYLKAdPZxqiM2HATqv/SBk2/ENSHpvXGaLOMcsAyz0poEGqkmmKYG3OWiJEQ==",
+      "version": "2.0.0-beta.2",
+      "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-2.0.0-beta.2.tgz",
+      "integrity": "sha512-MzCVoWtcg4Pm2B3je5mMvYMvj3MmBKw+fU7vbsJc9/iT8ip6/eYIHo/Dsm/mr+wsHB6SEyJDuxB09Yy6r/8+4A==",
       "dev": true,
       "license": "MIT",
       "optional": true,
       "dependencies": {
-        "@emnapi/wasi-threads": "1.2.2",
+        "@emnapi/wasi-threads": "2.2.0",
         "tslib": "^2.4.0"
       }
     },
     "node_modules/@emnapi/runtime": {
-      "version": "1.11.1",
-      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.1.tgz",
-      "integrity": "sha512-vgj7R3y3Wgx24IQaGPA/R6YFXLHVMOZ0uVEyIQPaWs+rd1AzfEMXlAC22FYwO1XkKR6NPsq7mUandH8oIRdZFw==",
+      "version": "2.0.0-beta.2",
+      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-2.0.0-beta.2.tgz",
+      "integrity": "sha512-JcrSPzPvZuNZvJqPTF9Fw25LbOJ8avzFVlaf2grmH4Cku0oGP47tRgqPZadcfj3YoZMHkFVnCYFbQM8I+i5QEw==",
       "dev": true,
       "license": "MIT",
       "optional": true,
@@ -38,9 +38,9 @@
       }
     },
     "node_modules/@emnapi/wasi-threads": {
-      "version": "1.2.2",
-      "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-1.2.2.tgz",
-      "integrity": "sha512-c95qOXkHdydNKhscBTebqEC1CVAZpyqOfVfBzQ1qgzyl3gfeldUjIggDbIZgDKsHLgnsM+igH7TJ/eAasaVuMA==",
+      "version": "2.2.0",
+      "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-2.2.0.tgz",
+      "integrity": "sha512-JP7OYH38Q7+pyTAe14raZHLQIK7BDKbdwji+Xi3pcd/6QkJYQH3SX4wu6EplGrGJWRepoNzedfm0G3B9Z4e9Rw==",
       "dev": true,
       "license": "MIT",
       "optional": true,
@@ -99,38 +99,58 @@
       }
     },
     "node_modules/@napi-rs/wasm-runtime": {
-      "version": "1.1.6",
-      "resolved": "https://registry.npmjs.org/@napi-rs/wasm-runtime/-/wasm-runtime-1.1.6.tgz",
-      "integrity": "sha512-ZLv/JdUfkvOy9eCnnBaGfiO+XimbjebAeO+MRQqD/B+FR1tnRN0tpKSJHRbE8sFfS6aqsXZ67TQjfwfsxULVbg==",
+      "version": "1.2.6",
+      "resolved": "https://registry.npmjs.org/@napi-rs/wasm-runtime/-/wasm-runtime-1.2.6.tgz",
+      "integrity": "sha512-mRyDmEw9/fCDXCGfL1sbgIw/GUK0PVxRW4YwgPN61F3LQ+fSyoBFarJVzgGyhF6kRzEQZ0FejDqm4WLXSeqQmw==",
       "dev": true,
       "license": "MIT",
       "optional": true,
       "dependencies": {
         "@tybys/wasm-util": "^0.10.3"
       },
+      "engines": {
+        "node": "^20.19.0 || ^22.13.0 || >=23.5.0"
+      },
       "funding": {
         "type": "github",
         "url": "https://github.com/sponsors/Brooooooklyn"
       },
       "peerDependencies": {
-        "@emnapi/core": "^1.7.1",
-        "@emnapi/runtime": "^1.7.1"
+        "@emnapi/core": "^1.7.1 || 2.0.0-beta.2",
+        "@emnapi/runtime": "^1.7.1 || 2.0.0-beta.2"
       }
     },
     "node_modules/@oxc-project/types": {
-      "version": "0.139.0",
-      "resolved": "https://registry.npmjs.org/@oxc-project/types/-/types-0.139.0.tgz",
-      "integrity": "sha512-r9gHphtCs+1M7J0pw6Sn/hh/Wpa/iQrOOkrNAlVLF/gHq+/CJmHIWKKUUhdWjcD6CIa8idarspCsASiXCXvFUw==",
+      "version": "0.156.0",
+      "resolved": "https://registry.npmjs.org/@oxc-project/types/-/types-0.156.0.tgz",
+      "integrity": "sha512-1Duyg48TdJNdyhEB8Xn1L36bT9Pv6GUtlKjHxOys8xkaF/rQq3XJE+bAurSK/AgIz5mGFsb77cn9Pb20+WCScw==",
       "dev": true,
       "license": "MIT",
       "funding": {
-        "url": "https://github.com/sponsors/Boshen"
+        "url": "https://github.com/sponsors/oxc-project"
+      }
+    },
+    "node_modules/@rolldown/binding-android-arm-eabi": {
+      "version": "1.2.19",
+      "resolved": "https://registry.npmjs.org/@rolldown/binding-android-arm-eabi/-/binding-android-arm-eabi-1.2.19.tgz",
+      "integrity": "sha512-e+Ebe0WT+9tbXmNKPIiC8YrWAHYwug3m6i4p3rZGGulfZri1jtI4HslT+OZnFf/OIHowWF71DTlHwXBP2SiA7A==",
+      "cpu": [
+        "arm"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "android"
+      ],
+      "engines": {
+        "node": "^20.19.0 || >=22.12.0"
       }
     },
     "node_modules/@rolldown/binding-android-arm64": {
-      "version": "1.1.5",
-      "resolved": "https://registry.npmjs.org/@rolldown/binding-android-arm64/-/binding-android-arm64-1.1.5.tgz",
-      "integrity": "sha512-lZg8fqIv2v7FF237bwMgzGZEJvGL79/s5knJ/i6FmsGF4XXlzccZ4jb+TrFIxtSSxFtIpdsgrPZeMk1I9AFcyQ==",
+      "version": "1.2.19",
+      "resolved": "https://registry.npmjs.org/@rolldown/binding-android-arm64/-/binding-android-arm64-1.2.
```

**File**: `Examples/IPlugSvelteUI/web-ui/package.json` (modified, +1/-1)
```diff
@@ -12,6 +12,6 @@
     "@sveltejs/vite-plugin-svelte": "^7.1.2",
     "@tsconfig/svelte": "^5.0.8",
     "svelte": "^5.55.7",
-    "vite": "^8.1.4"
+    "vite": "^8.3.8"
   }
 }
```

#### Recent Merged Pull Requests:
- **PR #1487** (2026-11-23): Update vendored Yoga to v3.2.2 (@olilarkin)
- **PR #1486** (2026-11-22): cmake: RC_INCLUDE_DIRS option and Windows bundle folder icons (@olilarkin)
- **PR #1484** (2026-11-21): Bump devalue from 5.8.1 to 5.9.4 in /Examples/IPlugSvelteUI/web-ui (@dependabot[bot])
- **PR #1483** (2026-11-21): Bump vite from 8.1.4 to 8.3.8 in /Examples/IPlugSvelteUI/web-ui (@dependabot[bot])
- **PR #1482** (2026-11-21): Bump source-map-js from 1.2.1 to 1.2.4 in /Examples/IPlugSvelteUI/web-ui (@dependabot[bot])
- **PR #1480** (closed): Fixes to cmake scripts on Windows (resources and icons) (@pressplay-music)

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

## X. ARA: synchronize rendering with model edits and harden the example archive

**RULE**:
When implementing operations in `Examples/IPlugARAExample/CMakeLists.txt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in iPlug2/iPlug2. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4e118ffc`: ARA: synchronize rendering with model edits and harden the example archive. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `Examples/IPlugARAExample/CMakeLists.txt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
    IPlugARAExample_Analysis.h
```

**NEGATIVE CONSTRAINT**:
```c
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4e118ffc` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
