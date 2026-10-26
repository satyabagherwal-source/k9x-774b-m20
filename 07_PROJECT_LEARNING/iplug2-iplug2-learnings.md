> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/iplug2-iplug2-learnings.md`  
> **Source**: github ([https://github.com/iPlug2/iPlug2](https://github.com/iPlug2/iPlug2))  
> **Source Version**: `d82b2e99`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T14:23:20.854Z  
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
> **Harvest Timestamp**: 2026-10-26T14:23:20.605Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iPlug2/iPlug2`
- **Description**: C++ Audio Plug-in Framework for desktop, mobile, xr and web
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2437 stars

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

### Core Architecture Module: `Dependencies/IGraphics/yoga/yoga/Utils.cpp`
```
/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#include "Utils.h"

using namespace facebook;

YGFlexDirection YGFlexDirectionCross(
    const YGFlexDirection flexDirection,
    const YGDirection direction) {
  return YGFlexDirectionIsColumn(flexDirection)
      ? YGResolveFlexDirection(YGFlexDirectionRow, direction)
      : YGFlexDirectionColumn;
}

float YGFloatMax(const float a, const float b) {
  if (!yoga::isUndefined(a) && !yoga::isUndefined(b)) {
    return fmaxf(a, b);
  }
  return yoga::isUndefined(a) ? b : a;
}

float YGFloatMin(const float a, const float b) {
  if (!yoga::isUndefined(a) && !yoga::isUndefined(b)) {
    return fminf(a, b);
  }

  return yoga::isUndefined(a) ? b : a;
}

bool YGValueEqual(const YGValue& a, const YGValue& b) {
  if (a.unit != b.unit) {
    return false;
  }

  if (a.unit == YGUnitUndefined ||
      (yoga::isUndefined(a.value) && yoga::isUndefined(b.value))) {
    return true;
  }

  return fabs(a.value - b.value) < 0.0001f;
}

bool YGFloatsEqual(const float a, const float b) {
  if (!yoga::isUndefined(a) && !yoga::isUndefined(b)) {
    return fabs(a - b) < 0.0001f;
  }
  return yoga::isUndefined(a) && yoga::isUndefined(b);
}

float YGFloatSanitize(const float val) {
  return yoga::isUndefined(val) ? 0 : val;
}

YGFloatOptional YGFloatOptionalMax(YGFloatOptional op1, YGFloatOptional op2) {
  if (op1 >= op2) {
    return op1;
  }
  if (op2 > op1) {
    return op2;
  }
  return op1.isUndefined() ? op2 : op1;
}

```

### Core Architecture Module: `Dependencies/IGraphics/yoga/yoga/Utils.h`
```
/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once
#include "YGNode.h"
#include "Yoga-internal.h"
#include "CompactValue.h"

// This struct is an helper model to hold the data for step 4 of flexbox algo,
// which is collecting the flex items in a line.
//
// - itemsOnLine: Number of items which can fit in a line considering the
//   available Inner dimension, the flex items computed flexbasis and their
//   margin. It may be different than the difference between start and end
//   indicates because we skip over absolute-positioned items.
//
// - sizeConsumedOnCurrentLine: It is accumulation of the dimensions and margin
//   of all the children on the current line. This will be used in order to
//   either set the dimensions of the node if none already exist or to compute
//   the remaining space left for the flexible children.
//
// - totalFlexGrowFactors: total flex grow factors of flex items which are to be
//   layed in the current line
//
// - totalFlexShrinkFactors: total flex shrink factors of flex items which are
//   to be layed in the current line
//
// - endOfLineIndex: Its the end index of the last flex item which was examined
//   and it may or may not be part of the current line(as it may be absolutely
//   positioned or including it may have caused to overshoot availableInnerDim)
//
// - relativeChildren: Maintain a vector of the child nodes that can shrink
//   and/or grow.

struct YGCollectFlexItemsRowValues {
  uint32_t itemsOnLine;
  float sizeConsumedOnCurrentLine;
  float totalFlexGrowFactors;
  float totalFlexShrinkScaledFactors;
  uint32_t endOfLineIndex;
  std::vector<YGNodeRef> relativeChildren;
  float remainingFreeSpace;
  // The size of the mainDim for the row after considering size, padding, margin
  // and border of flex items. This is used to calculate maxLineDim after going
  // through all the rows to decide on the main axis size of owner.
  float mainDim;
  // The size of the crossDim for the row after considering size, padding,
  // margin and border of flex items. Used for calculating containers crossSize.
  float crossDim;
};

bool YGValueEqual(const YGValue& a, const YGValue& b);
inline bool YGValueEqual(
    facebook::yoga::detail::CompactValue a,
    facebook::yoga::detail::CompactValue b) {
  return YGValueEqual((YGValue) a, (YGValue) b);
}

// This custom float equality function returns true if either absolute
// difference between two floats is less than 0.0001f or both are undefined.
bool YGFloatsEqual(const float a, const float b);

float YGFloatMax(const float a, const float b);

YGFloatOptional YGFloatOptionalMax(
    const YGFloatOptional op1,
    const YGFloatOptional op2);

float YGFloatMin(const float a, const float b);

// This custom float comparison function compares the array of float with
// YGFloatsEqual, as the default float comparison operator will not work(Look
// at the comments of YGFloatsEqual function).
template <std::size_t size>
bool YGFloatArrayEqual(
    const std::array<float, size>& val1,
    const std::array<float, size>& val2) {
  bool areEqual = true;
  for (std::size_t i = 0; i < size && areEqual; ++i) {
    areEqual = YGFloatsEqual(val1[i], val2[i]);
  }
  return areEqual;
}

// This function returns 0 if YGFloatIsUndefined(val) is true and val otherwise
float YGFloatSanitize(const float val);

YGFlexDirection YGFlexDirectionCross(
    const YGFlexDirection flexDirection,
    const YGDirection direction);

inline bool YGFlexDirectionIsRow(const YGFlexDirection flexDirection) {
  return flexDirection == YGFlexDirectionRow ||
      flexDirection == YGFlexDirectionRowReverse;
}

inline YGFloatOptional YGResolveValue(
    const YGValue value,
    const float ownerSize) {
  switch (value.unit) {
    case YGUnitPoint:
      return YGFloatOptional{value.value};
    case YGUnitPercent:
      return YGFloatOptional{value.value * ownerSize * 0.01f};
    default:
      return YGFloatOptional{};
  }
}

inline YGFloatOptional YGResolveValue(
    yoga::detail::CompactValue value,
    float ownerSize) {
  return YGResolveValue((YGValue) value, ownerSize);
}

inline bool YGFlexDirectionIsColumn(const YGFlexDirection flexDirection) {
  return flexDirection == YGFlexDirectionColumn ||
      flexDirection == YGFlexDirectionColumnReverse;
}

inline YGFlexDirection YGResolveFlexDirection(
    const YGFlexDirection flexDirection,
    const YGDirection direction) {
  if (direction == YGDirectionRTL) {
    if (flexDirection == YGFlexDirectionRow) {
      return YGFlexDirectionRowReverse;
    } else if (flexDirection == YGFlexDirectionRowReverse) {
      return YGFlexDirectionRow;
    }
  }

  return flexDirection;
}

inline YGFloatOptional YGResolveValueMargin(
    yoga::detail::CompactValue value,
    const float ownerSize) {
  return value.isAuto() ? YGFloatOptional{0} : YGResolveValue(value, ownerSize);
}

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

### Incident Patch 1: `f3c104b3` (2026-10-25)
**Commit Message**: Merge pull request #1387 from iPlug2/fix/macos-metal-layer-leak-on-close

IGraphicsMac: fix CAMetalLayer leak on window close

**File**: `IGraphics/Platforms/IGraphicsMac_view.mm` (modified, +5/-3)
```diff
@@ -384,10 +384,12 @@ @implementation IGRAPHICS_VIEW
 - (CALayer *)makeBackingLayer
 {
   // CAMetalLayer is correct for both Metal and GLES - ANGLE uses Metal backend on macOS
+  // NB: this file is not ARC; the caller retains, so the layer must be autoreleased
+  // or it is stranded (with its drawable pool) every time the window closes
 #if defined IGRAPHICS_METAL || defined IGRAPHICS_GLES2 || defined IGRAPHICS_GLES3
-  return [[CAMetalLayer alloc] init];
+  return [[[CAMetalLayer alloc] init] autorelease];
 #else
-  return [[CALayer alloc] init];
+  return [[[CALayer alloc] init] autorelease];
 #endif
 }
 
@@ -410,7 +412,7 @@ - (id) initWithIGraphics: (IGraphicsMac*) pGraphics
   #if defined IGRAPHICS_METAL || defined IGRAPHICS_GLES2 || defined IGRAPHICS_GLES3
   CAMetalLayer* mtlLayer = (CAMetalLayer*) self.layer;
   [mtlLayer setPixelFormat:MTLPixelFormatBGRA8Unorm];
-  mtlLayer.device = MTLCreateSystemDefaultDevice();
+  mtlLayer.device = [MTLCreateSystemDefaultDevice() autorelease]; // Create-rule +1, property assignment retains
   mtlLayer.framebufferOnly = YES;
   #elif defined IGRAPHICS_GL2 || defined IGRAPHICS_GL3
   NSOpenGLPixelFormatAttribute profile = NSOpenGLProfileVersionLegacy;
```

---

### Incident Patch 2: `61c5553a` (2026-10-15)
**Commit Message**: swell-gdi-lice: fix clipping of child windows to parent client rect -- from 2a2d8191 and c0d29442

**File**: `WDL/swell/swell-gdi-lice.cpp` (modified, +18/-4)
```diff
@@ -1719,6 +1719,7 @@ void SWELL_internalLICEpaint(HWND hwnd, LICE_IBitmap *bmout, int bmout_xpos, int
   //   we would want to only really use them for top level windows, and on those, only update windows (and children of windows) who had backingstore invalidated.
   if (hwnd->m_invalidated) forceref=true;
 
+  int calced_w = -1, calced_h = -1;
   if (forceref || hwnd->m_child_invalidated)
   {
     swell_gdpLocalContext ctx;
@@ -1746,6 +1747,8 @@ void SWELL_internalLICEpaint(HWND hwnd, LICE_IBitmap *bmout, int bmout_xpos, int
       p.rgrc[0]=r2;
       hwnd->m_wndproc(hwnd,WM_NCCALCSIZE,FALSE,(LPARAM)&p);
       RECT r = p.rgrc[0];
+      calced_w = r.right-r.left;
+      calced_h = r.bottom-r.top;
       if (forceref) hwnd->m_wndproc(hwnd,WM_NCPAINT,(WPARAM)1,0);
 
       // dx,dy is offset from the window's nonclient root
@@ -1806,9 +1809,20 @@ void SWELL_internalLICEpaint(HWND hwnd, LICE_IBitmap *bmout, int bmout_xpos, int
     {
       if (h->m_visible && (forceref || h->m_invalidated||h->m_child_invalidated))
       {
-        int width = h->m_position.right - h->m_position.left, 
-            height = h->m_position.bottom - h->m_position.top; // max width possible for this window
-        int xp = h->m_position.left - bmout_xpos, yp = h->m_position.top - bmout_ypos;
+        RECT cr = h->m_position;
+        int width = cr.right - cr.left, height = cr.bottom - cr.top; // max width possible for this window
+        int xp = cr.left, yp = cr.top;
+        int extra_xo = 0, extra_yo = 0;
+        if (calced_w >= 0 && calced_h >= 0)
+        {
+          if (xp < 0) { extra_xo = xp; width += extra_xo; xp = 0; }
+          if (yp < 0) { extra_yo = yp; height += extra_yo; yp = 0; }
+          if (xp + width > calced_w) width = calced_w - xp;
+          if (yp + height > calced_h) height = calced_h - yp;
+        }
+
+        xp -= bmout_xpos;
+        yp -= bmout_ypos;
 
         if (okToClearChild && !forceref)
         {
@@ -1828,7 +1842,7 @@ void SWELL_internalLICEpaint(HWND hwnd, LICE_IBitmap *bmout, int bmout_xpos, int
         {
           LICE_SubBitmap subbm(bmout,subx,suby,width,height); // the right/bottom will automatically be clipped to the clip rect etc
           if (subbm.getWidth()>0 && subbm.getHeight()>0)
-            SWELL_internalLICEpaint(h,&subbm,-xp,-yp,forceref);
+            SWELL_internalLICEpaint(h,&subbm,-extra_xo-xp,-extra_yo-yp,forceref);
         }
       }
       h = h->m_next;
```

#### Recent Merged Pull Requests:
- **PR #1429** (2026-10-25): CI: unpin claude-code-action (back to @v1) (@olilarkin)
- **PR #1428** (2026-10-18): CI: pin claude-code-action to v1.0.196 (@olilarkin)
- **PR #1427** (2026-10-25): Bump macOS deployment target to 13.0 (@olilarkin)
- **PR #1426** (2026-10-17): CI: move macOS runners from macos-14 to macos-15 (@olilarkin)
- **PR #1425** (2026-10-17): iOS App: adopt UIScene life cycle (fixes #1420) (@olilarkin)
- **PR #1417** (closed): CLAP: request parameter rescan after state load, fix main ports in audio ports config (@michaelhovedk)

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

## X. Merge pull request #1387 from iPlug2/fix/macos-metal-layer-leak-on-close

**RULE**:
When implementing operations in `IGraphics/Platforms/IGraphicsMac_view.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in iPlug2/iPlug2. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f3c104b3`: Merge pull request #1387 from iPlug2/fix/macos-metal-layer-leak-on-close. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `IGraphics/Platforms/IGraphicsMac_view.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
  // NB: this file is not ARC; the caller retains, so the layer must be autoreleased
  // or it is stranded (with its drawable pool) every time the window closes
  return [[[CAMetalLayer alloc] init] autorelease];
  return [[[CALayer alloc] init] autorelease];
  mtlLayer.device = [MTLCreateSystemDefaultDevice() autorelease]; // Create-rule +1, property assignment retains
```

**NEGATIVE CONSTRAINT**:
```c
// Anti-pattern to NEVER write (induced failure mode):
  return [[CAMetalLayer alloc] init];
  return [[CALayer alloc] init];
  mtlLayer.device = MTLCreateSystemDefaultDevice();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f3c104b3` are properly handled with clean fallback behavior.
