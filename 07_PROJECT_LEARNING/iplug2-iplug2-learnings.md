# Forensic Learning Record (Deep Inspection): iPlug2/iPlug2

> **Canonical Artifact**: `07_PROJECT_LEARNING/iplug2-iplug2-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iPlug2/iPlug2](https://github.com/iPlug2/iPlug2))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:27:31.548Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iPlug2/iPlug2`
- **Description**: C++ Audio Plug-in Framework for desktop, mobile, xr and web
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2421 stars

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
  auv3['LSMinimumSystemVersion'] = "10.12.0"
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
  macOSapp['CF
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
  **Post-Mortem & Fix Analysis**:
  > reverted
  > Thanks

- **Issue #1075** (2024-03-17): **Missing color search info the background of IVControls**
  *Symptoms*: It seems that a constant is being directly interpreted as a color, when it should be being used as the index to find the relevant color from the style.  https://github.com/iPlug2/iPlug2/blob/1a1239123e254dd442064cd1a4b3c9852607deff/IGraphics/IControl.h#L1665
  **Post-Mortem & Fix Analysis**:
  > good catch

- **Issue #1013** (2023-11-05): **IOS native popups disabled items act incorrectly**
  *Symptoms*: **Describe the bug** When using native popup menus on IOS that have disabled items some arbitrary menu items are displayed as disabled when this has not been requested  **To Reproduce** Build and IOS app with the native popup and a menu with some disabled items.  **Expected behaviour** Only items marked as disabled are greyed out.  **IMPORTANT DETAILS** * What plug-in format does it relate to - AUv3 * What platform does it relate to - iOS * What IGRAPHICS_BACKEND does it relate to, ALL? 

- **Issue #995** (2023-08-12): **Time info AUv3 transport bug**
  *Symptoms*: https://github.com/iPlug2/iPlug2/blob/a8f3246f5880e6e48f3b8f16eb98df358933f9bb/IPlug/AUv3/IPlugAUAudioUnit.mm#L623 https://github.com/iPlug2/iPlug2/blob/a8f3246f5880e6e48f3b8f16eb98df358933f9bb/IPlug/AUv3/IPlugAUAudioUnit.mm#L624  Shouldn't this be a bitwise check instead? 
  **Post-Mortem & Fix Analysis**:
  > Yes - it looks like the three "==" should be "&". The logical or is correct, but it could also be achieved by or'ing the two flags before the bit mask.
  > I have tested in Logic on iPad and it's definitely a bitwise check
  > Great - would you be able to make a PR @Youlean 

- **Issue #993** (2023-09-19): **AUv3 never calls OnParamReset()**
  *Symptoms*: **Describe the bug** Engine parameters may never be received on AUv3, as OnParamReset() is never called.  **Expected behaviour** OnParamReset() is called before the plugin starts procesing  @olilarkin can you take a look and see where you think is best to add this? I can add before the call to OnReset() and it fixes the issue for me, but there might be somewhere better to do this - it's more about initalising the plugin. I don't know AUv3 well enough to be sure I'm making the best positioning choice.  The call that is needed is trivial:  `  mPlug->OnParamReset(kReset); `
  **Post-Mortem & Fix Analysis**:
  > does this method sound appropriate?  https://developer.apple.com/documentation/audiotoolbox/auaudiounit/1387620-allocaterenderresourcesandreturn?language=objc
  > Yes - that aligns with what we do for AUv2.
  > I'll put it in. I think that might be where I had it anyway, but I'll make a PR.

- **Issue #981** (2023-06-25): **iOS Examples crashing on load**
  *Symptoms*: See here:  https://iplug2.discourse.group/t/crashing-ios-examples/795/3  reproduced on iPad 9th generation emulator (on intel and ARM desktops) using iPlugEffect
  **Post-Mortem & Fix Analysis**:
  > The crash happens from here when the completion hander is called with an error (and then an error is caused that is unhandled):  https://github.com/iPlug2/iPlug2/blob/c259b038ca70a43266d388c56f837990e18a96be/IPlug/AUv3/iOSApp/IPlugAUPlayer.mm#L42 
  > Actually the above is incorrect - the error returns as nil and then the following line crashes:  https://github.com/iPlug2/iPlug2/blob/c259b038ca70a43266d388c56f837990e18a96be/IPlug/AUv3/iOSApp/IPlugAUPlayer.mm#L90  Possibly this doesn't work on emulator? @olilarkin - do you know anything about this?
  > IIRC, This is a problem on the simulator when the macOS audio device is not the built-in apple I/O. I get the crash when my babyface pro is the default interface, but not when built-in is the default. Here is a WIP fix I did at somepoint, i don't think it is correct:  ``` diff --git forkSrcPrefix/IPlug/AUv3/iOSApp/IPlugAUPlayer.mm forkDstPrefix/IPlug/AUv3/iOSApp/IPlugAUPlayer.mm index 159513a624a776092e3bdae25c2e1bc4c710c170..f88c2be0d8099a3bd5fd52182760783490981ac1 100644 --- forkSrcPrefix/IPlug/AUv3/iOSApp/IPlugAUPlayer.mm +++ forkDstPrefix/IPlug/AUv3/iOSApp/IPlugAUPlayer.mm @@ -62,7 +62,6 @@    [session setCategory: AVAudioSessionCategoryPlayAndRecord error:&error];  #endif     -  [session setPreferredSampleRate:iplug::DEFAULT_SAMPLE_RATE error:nil];    [session setPreferredIOBufferDuration:128.0/iplug::DEFAULT_SAMPLE_RATE error:nil];    AVAudioMixerNode* mainMixer = [audioEngine mainMixerNode];    mainMixer.outputVolume = 1; @@ -72,7 +71,8 @@    AVAudioFormat* micIn

- **Issue #968** (2023-05-18): **IOS platform text entry cancel button doesn't cancel (still commits the edit)**
  *Symptoms*: **Describe the bug** When entering values on IOS using the platform text entry the cancel button doesn't cancel and the the edit is still committed.  **To Reproduce** Do as described above.  **Expected behaviour** The edit should be cancelled and have no effect.  **IMPORTANT DETAILS** * What plug-in format does it relate to - VST2, VST3, AUv2, AUv3, AAX, APP or ALL? * What platform does it relate to - Windows/macOS/iOS/Linux or ALL? * What IGRAPHICS_BACKEND does it relate to, IGRAPHICS_NANOVG, IGRAPHICS_SKIA or ALL?  IOS AUv3 only.
  **Post-Mortem & Fix Analysis**:
  > LG, but i think we need weak references to self otherwise we create a retain cycle. from chatGPT:   In Objective-C, you should use a weak reference to `self` in a completion handler (or any other block that is stored and executed later) to avoid a retain cycle, also known as a strong reference cycle or a memory leak.   A retain cycle occurs when two or more objects hold strong references to each other, preventing each other from being deallocated even when they're no longer needed. This can lead to an increased memory footprint and potentially cause your app to crash if it consumes too much memory.  Here's an example of how you might create a retain cycle:  ```objc // Assuming you're inside a method of 'self' self.completionHandler = ^{     [self doSomething];  // This creates a retain cycle }; ```  In the above example, `self` holds a strong reference to the block via `self.completionHandler`, and the block holds a strong reference to `self` because it captures `self` i
  > I've updated to address this.
  > oops i commented on the issue not the pr

- **Issue #965** (2023-05-18): **IOS menu selection cannot trigger a text entry or other presentation from the view controller**
  *Symptoms*: **Describe the bug** The IOS menu handling does not dismiss the view controller until after the selection is handled. Thus if yo  **To Reproduce** Create a plugin with a UI in which a menu selection directly triggers CreateTextEntry. The text entry does not work and an error ensues because the view controller is already presenting.  **Expected behaviour** There is a text entry triggered (which there is on desktop)  **IMPORTANT DETAILS** * What plug-in format does it relate to - VST2, VST3, AUv2, AUv3, AAX, APP or ALL? * What platform does it relate to - Windows/macOS/iOS/Linux or ALL? * What IGRAPHICS_BACKEND does it relate to, IGRAPHICS_NANOVG, IGRAPHICS_SKIA or ALL?  Auv3 on IOS only (works on desktop)

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

### Incident Patch 1: `d54f6905` (2026-08-19)
**Commit Message**: Merge pull request #1406 from iPlug2/cmake/fix-surround-effect

Cmake:define CUSTOM_BUSTYPE_FUNC for IPlugSurroundEffect

**File**: `Examples/IPlugSurroundEffect/CMakeLists.txt` (modified, +2/-0)
```diff
@@ -9,6 +9,8 @@ include(${IPLUG2_DIR}/iPlug2.cmake)
 find_package(iPlug2 REQUIRED)
 
 iplug_add_plugin(${PROJECT_NAME}
+  DEFINES
+    CUSTOM_BUSTYPE_FUNC
   SOURCES
     IPlugSurroundEffect.cpp
     IPlugSurroundEffect.h
```

---

### Incident Patch 2: `f202f864` (2026-07-15)
**Commit Message**: ReaperExt: fix WebView double-scaling on DPI-aware hosts

MainDlgProc passed physical client pixels (GetClientRect) straight to
OnParentWindowResize, but the WebView delegate's SetWebViewBounds scales
logical->physical internally via GetScaleForHWND. On a per-monitor DPI-aware
host like REAPER at 200% this counted the scale twice, so the WebView HWND
ended up ~2x the window and its right/bottom edge (e.g. the gain slider)
fell outside the visible window.

Convert the client size to logical (divide by scale) before calling
OnParentWindowResize for the WebView delegate. IGraphics is unaffected (it
expects physical and divides internally); no-op at 100% and on macOS where
GetScaleForHWND returns 1.

**File**: `IPlug/ReaperExt/ReaperExtBase.cpp` (modified, +14/-0)
```diff
@@ -440,6 +440,14 @@ WDL_DLGRET ReaperExtBase::MainDlgProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARA
         GetClientRect(hwnd, &r);
         int w = r.right - r.left;
         int h = r.bottom - r.top;
+#ifdef WEBVIEW_EDITOR_DELEGATE
+        // GetClientRect returns physical pixels. The WebView delegate expects logical
+        // (DPI-independent) dimensions and scales to physical internally, so convert here.
+        // (IGraphics, by contrast, wants physical and divides internally.) On a DPI-aware
+        // host like REAPER at 200%, skipping this would double-scale and clip the WebView.
+        w = static_cast<int>(w / scale);
+        h = static_cast<int>(h / scale);
+#endif
         if (w > 0 && h > 0)
           gPlug->OnParentWindowResize(w, h);
       }
@@ -468,6 +476,12 @@ WDL_DLGRET ReaperExtBase::MainDlgProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARA
         GetClientRect(hwnd, &r);
         int w = r.right - r.left;
         int h = r.bottom - r.top;
+#ifdef WEBVIEW_EDITOR_DELEGATE
+        // See WM_INITDIALOG: convert physical client size to logical for the WebView delegate.
+        const float scale = GetScaleForHWND(hwnd);
+        w = static_cast<int>(w / scale);
+        h = static_cast<int>(h / scale);
+#endif
         if (w > 0 && h > 0)
           gPlug->OnParentWindowResize(w, h);
       }
```

---

### Incident Patch 3: `85fd53c1` (2026-07-15)
**Commit Message**: Fix undefined `status` in SMMFD MIDI log in WebView examples

The SMMFD "from delegate" handler logged the undefined global `status`
instead of its `statusByte` parameter. Fix the active log in IPlugWebUI and
the commented-out line in IPlugP5js, matching the new IPlugReaperExtensionWebUI
example. Reported by Claude review on #1383.

**File**: `Examples/IPlugP5js/resources/web/script.js` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ function SAMFD(msgTag, dataSize, msg) {
 
 function SMMFD(statusByte, dataByte1, dataByte2) {
   OnMidiMsg(statusByte, dataByte1, dataByte2);
-//  console.log("Got MIDI Message" + status + ":" + dataByte1 + ":" + dataByte2);
+//  console.log("Got MIDI Message" + statusByte + ":" + dataByte1 + ":" + dataByte2);
 }
 
 function SSMFD(offset, size, msg) {
```

**File**: `Examples/IPlugWebUI/resources/web/script.js` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ function SAMFD(msgTag, dataSize, msg) {
 }
 
 function SMMFD(statusByte, dataByte1, dataByte2) {
-  console.log("Got MIDI Message" + status + ":" + dataByte1 + ":" + dataByte2);
+  console.log("Got MIDI Message" + statusByte + ":" + dataByte1 + ":" + dataByte2);
 }
 
 function SSMFD(offset, size, msg) {
```

---

### Incident Patch 4: `9bb4deee` (2026-07-15)
**Commit Message**: Fix IPlugReaperExtension DLL name

**File**: `Examples/IPlugReaperExtension/config/IPlugReaperExtension.props` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 <Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
   <PropertyGroup Label="UserMacros">
     <IPLUG2_ROOT>$(ProjectDir)..\..\..</IPLUG2_ROOT>
-    <BINARY_NAME>reaper_ReaperExtension</BINARY_NAME>
+    <BINARY_NAME>reaper_IPlugReaperExtension</BINARY_NAME>
     <EXTRA_ALL_DEFS>IGRAPHICS_NANOVG;IGRAPHICS_GL2</EXTRA_ALL_DEFS>
     <EXTRA_DEBUG_DEFS />
     <EXTRA_RELEASE_DEFS />
```

---

### Incident Patch 5: `1c332479` (2026-07-09)
**Commit Message**: Add IPlugReaperExtensionWebUI example

A REAPER extension with a WebView UI, showing the pieces an extension needs beyond a
plain iPlug2 plugin: registering actions, docking, per-project state, reacting to
project edits, and offline-processing a media item.

The offline process reads the selected item through an audio accessor, applies the gain
set in the WebView, writes a new .wav and inserts it under the original.

Notes on the file it writes, since these are easy to get wrong:

- The output goes to the project's media/recording directory (GetProjectPathEx), not
  next to the source file, which may live on read-only or shared storage.
- It is named <stem>-<PLUG_CLASS_NAME>[-NNN].wav, uniquified against existing files so a
  second run never overwrites output that is already open in the project. The extension
  name comes from PLUG_CLASS_NAME so it follows Scripts/duplicate.py.
- The extension is stripped from the filename component only, so a dot in a directory
  name doesn't truncate the path.
- Section sources (reversed, looped or trimmed takes) report no filename, so the name is
  resolved through GetMediaSourceParent(); takes with no media file at all are rejected.
- WDL's Wa

**File**: `Examples/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -32,4 +32,5 @@ endif()
 # REAPER examples
 set(CMAKE_FOLDER "Examples/REAPER")
 add_subdirectory(IPlugReaperExtension)
+add_subdirectory(IPlugReaperExtensionWebUI)
 add_subdirectory(IPlugReaperPlugin)
```

**File**: `Examples/IPlugReaperExtensionWebUI/.gitignore` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+*.vs
+*.exe
+*.sdf
+*.opensdf
+*.zip
+*.suo
+*.ncb
+*.vcproj.*
+*.pkg
+*.dmg
+*.depend
+*.layout
+*.mode1v3
+*.db
+*.LSOverride
+*.xcuserdata
+*.xcschememanagement.plist
+build-*
+ipch/*
+gui/*
+
+Icon?
+.DS_Stor*
+
+# The test project has no media directory configured, so audio processed by the extension
+# is written here, alongside REAPER's peak caches for it
+*.wav
+peaks/
\ No newline at end of file
```

**File**: `Examples/IPlugReaperExtensionWebUI/CMakeLists.txt` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+cmake_minimum_required(VERSION 3.14)
+project(IPlugReaperExtensionWebUI VERSION 1.0.0)
+
+# REAPER Extensions are macOS and Windows only (no iOS, no Emscripten)
+if(IOS OR CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
+  message(STATUS "IPlugReaperExtensionWebUI is not supported on ${CMAKE_SYSTEM_NAME}. Skipping.")
+  return()
+endif()
+
+# The WebView editor delegate uses std::filesystem, which requires macOS 10.15+
+# (iPlug2.cmake otherwise defaults to 10.13). Set before including iPlug2.cmake.
+if(APPLE AND NOT CMAKE_OSX_DEPLOYMENT_TARGET)
+  set(CMAKE_OSX_DEPLOYMENT_TARGET "10.15" CACHE STRING "Minimum macOS version")
+endif()
+
+# Discover IPLUG2_DIR if not already set (for independent builds)
+if(NOT DEFINED IPLUG2_DIR)
+  set(IPLUG2_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../.." CACHE PATH "iPlug2 root directory")
+endif()
+
+# Include iPlug2 CMake configuration
+include(${IPLUG2_DIR}/iPlug2.cmake)
+find_package(iPlug2 REQUIRED)
+
+# Include REAPER Extension module
+include(${IPLUG2_CMAKE_DIR}/ReaperExt.cmake)
+
+# Include WebView module (WebViewEditorDelegate instead of IGraphics)
+include(${IPLUG2_CMAKE_DIR}/WebView.cmake)
+
+# Standard plugin setup
+set(PROJECT_DIR ${CMAKE_CURRENT_SOURCE_DIR})
+set(PLUG_RESOURCES_DIR ${PROJECT_DIR}/resources)
+
+set(SOURCE_FILES
+  IPlugReaperExtensionWebUI.cpp
+  IPlugReaperExtensionWebUI.h
+  resources/resource.h
+  resources/web/index.html
+  resources/web/script.js
+)
+
+# Add Windows resources
+if(WIN32)
+  list(APPEND SOURCE_FILES ${PLUG_RESOURCES_DIR}/main.rc)
+endif()
+
+# Build as a shared library (MODULE for dynamic loading)
+add_library(${PROJECT_NAME} MODULE ${SOURCE_FILES})
+
+# Base configuration - use the WebView UI instead of IGraphics
+iplug_add_target(${PROJECT_NAME} PUBLIC
+  INCLUDE ${PROJECT_DIR} ${PROJECT_DIR}/resources
+  LINK iPlug2::WebView
+)
+
+# Configure as REAPER extension (sets up output, deployment, etc.)
+iplug_configure_reaperext(${PROJECT_NAME} ${PROJECT_NAME})
+
+# Deploy the WebView UI next to the extension so Release builds can load index.html at runtime.
+# (In Debug the extension loads directly from the source tree via __FILE__.) The destination
+# subfolder must match SHARED_RESOURCES_SUBPATH in config.h.
+if(IPLUG_DEPLOY_PLUGINS)
+  iplug_get_default_deploy_path(REAPEREXT)
+  if(IPLUG_DEPLOY_PATH_REAPEREXT)
+    add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
+      COMMAND ${CMAKE_COMMAND} -E copy_directory
+        "${PROJECT_DIR}/resources/web"
+        "${IPLUG_DEPLOY_PATH_REAPEREXT}/IPlugReaperExtensionWebUI"
+      COMMENT "Deploying WebView UI to ${IPLUG_DEPLOY_PATH_REAPEREXT}/IPlugReaperExtensionWebUI"
+      VERBATIM
+    )
+  endif()
+endif()
```

**File**: `Examples/IPlugReaperExtensionWebUI/IPlugReaperExtensionWebUI.RPP` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+<REAPER_PROJECT 0.1 "5.965/OSX64" 1547315578
+  RIPPLE 0
+  GROUPOVERRIDE 0 0 0
+  AUTOXFADE 1
+  ENVATTACH 0
+  POOLEDENVATTACH 0
+  MIXERUIFLAGS 11 48
+  PEAKGAIN 1
+  FEEDBACK 0
+  PANLAW 1
+  PROJOFFS 0 0 0
+  MAXPROJLEN 0 600
+  GRID 3199 8 1 8 1 0 0 0
+  TIMEMODE 1 5 -1 30 0
+  VIDEO_CONFIG 0 0 256
+  PANMODE 3
+  CURSOR 0
+  ZOOM 100 0 0
+  VZOOMEX 6
+  USE_REC_CFG 0
+  RECMODE 1
+  SMPTESYNC 0 30 100 40 1000 300 0 0 1 0 0
+  LOOP 0
+  LOOPGRAN 0 4
+  RECORD_PATH "" ""
+  <RECORD_CFG
+  >
+  <APPLYFX_CFG
+  >
+  RENDER_FILE ""
+  RENDER_PATTERN ""
+  RENDER_FMT 0 2 0
+  RENDER_1X 0
+  RENDER_RANGE 1 0 0 18 1000
+  RENDER_RESAMPLE 3 0 1
+  RENDER_ADDTOPROJ 0
+  RENDER_STEMS 0
+  RENDER_DITHER 0
+  TIMELOCKMODE 1
+  TEMPOENVLOCKMODE 1
+  ITEMMIX 0
+  DEFPITCHMODE 589824
+  TAKELANE 1
+  SAMPLERATE 44100 0 0
+  <RENDER_CFG
+  >
+  LOCK 1
+  <METRONOME 6 2
+    VOL 0.25 0.125
+    FREQ 800 1600 1
+    BEATLEN 4
+    SAMPLES "" ""
+    PATTERN 2863311530 2863311529
+  >
+  GLOBAL_AUTO -1
+  TEMPO 120 4 4
+  PLAYRATE 1 0 0.25 4
+  SELECTION 0 0
+  SELECTION2 0 0
+  MASTERAUTOMODE 0
+  MASTERTRACKHEIGHT 0 0
+  MASTERPEAKCOL 16576
+  MASTERMUTESOLO 0
+  MASTERTRACKVIEW 0 0.6667 0.5 0.5 0 0 0
+  MASTERHWOUT 0 0 1 0 0 0 0 -1
+  MASTER_NCH 2 2
+  MASTER_VOLUME 1 0 -1 -1 1
+  MASTER_FX 1
+  MASTER_SEL 0
+  <MASTERPLAYSPEEDENV
+    ACT 0 -1
+    VIS 0 1 1
+    LANEHEIGHT 0 0
+    ARM 0
+    DEFSHAPE 0 -1 -1
+  >
+  <TEMPOENVEX
+    ACT 0 -1
+    VIS 1 0 1
+    LANEHEIGHT 0 0
+    ARM 0
+    DEFSHAPE 1 -1 -1
+  >
+  <PROJBAY
+  >
+>
```

**File**: `Examples/IPlugReaperExtensionWebUI/IPlugReaperExtensionWebUI.cpp` (added, +408/-0)
```diff
@@ -0,0 +1,408 @@
+#include "IPlugReaperExtensionWebUI.h"
+#include "ReaperExt_include_in_plug_src.h"
+
+#include "wavwrite.h"
+
+#include <algorithm>
+#include <vector>
+#include <string>
+#include <cstdio>
+
+IPlugReaperExtensionWebUI::IPlugReaperExtensionWebUI(reaper_plugin_info_t* pRec)
+: ReaperExtBase(pRec)
+{
+  //Use IMPAPI to register any Reaper APIs that you need to use
+  IMPAPI(GetNumTracks);
+  IMPAPI(CountTracks);
+  IMPAPI(InsertTrackAtIndex);
+  IMPAPI(ShowConsoleMsg);
+  IMPAPI(UpdateArrange);
+
+  // APIs for offline processing of a selected media item
+  IMPAPI(CountSelectedMediaItems);
+  IMPAPI(GetSelectedMediaItem);
+  IMPAPI(GetActiveTake);
+  IMPAPI(GetMediaItemTake_Source);
+  IMPAPI(GetMediaSourceNumChannels);
+  IMPAPI(GetMediaSourceSampleRate);
+  IMPAPI(GetMediaSourceFileName);
+  IMPAPI(GetMediaSourceParent);
+  IMPAPI(CreateTakeAudioAccessor);
+  IMPAPI(GetAudioAccessorStartTime);
+  IMPAPI(GetAudioAccessorEndTime);
+  IMPAPI(GetAudioAccessorSamples);
+  IMPAPI(DestroyAudioAccessor);
+  IMPAPI(InsertMedia);
+  IMPAPI(GetMediaItemInfo_Value);
+  IMPAPI(GetCursorPosition);
+  IMPAPI(SetEditCurPos);
+
+  // APIs for choosing where to write the processed file
+  IMPAPI(GetProjectPathEx);
+  IMPAPI(RecursiveCreateDirectory);
+  IMPAPI(file_exists);
+
+#ifdef _DEBUG
+  SetEnableDevTools(true);
+#endif
+
+  // The WebView loads its UI from resources/web/index.html.
+  mEditorInitFunc = [&]() {
+#ifdef _DEBUG
+    // Debug: load straight from the source tree so edits to the HTML/JS hot-reload on reopen.
+    LoadIndexHtml(__FILE__, "");
+#else
+    // Release: a REAPER extension has no bundle, so LoadIndexHtml's bundle branch doesn't apply.
+    // The post-build step deploys resources/web into REAPER's UserPlugins under
+    // SHARED_RESOURCES_SUBPATH; load index.html from there via the REAPER resource path.
+    WDL_String indexPath;
+    indexPath.SetFormatted(2048, "%s/UserPlugins/%s/index.html", GetResourcePath(), SHARED_RESOURCES_SUBPATH);
+    LoadFile(indexPath.Get(), nullptr);
+#endif
+    EnableScroll(false);
+  };
+
+  //Define some lambdas that can be called from either GUI widgets or in response to commands
+  auto action1 = [](){
+    MessageBox(gParent, "Action 1!", "Reaper extension test", MB_OK); //gParent
+  };
+
+  auto action2 = [](){
+    InsertTrackAtIndex(GetNumTracks(), false);
+  };
+
+  //Register an action. args: name, lambda, add to Extensions submenu, toggle ptr, context menu id, menu label
+  RegisterAction("IPlugReaperExtensionWebUI: Action 1 - MsgBox", action1, true, nullptr, nullptr, "Action 1 - MsgBox");
+  RegisterAction("IPlugReaperExtensionWebUI: Action 2 - AddTrack", action2);
+  RegisterAction("IPlugReaperExtensionWebUI: Action 3 - Show/Hide UI", [&]() { ShowHideMainWindow(); }, true, GetWindowTogglePtr(), nullptr, "Show/Hide UI");
+  RegisterAction("IPlugReaperExtensionWebUI: Toggle dock UI", [&]() { ToggleDocking(); }, true, GetDockTogglePtr(), nullptr, "Toggle dock UI");
+
+  // Also expose the offline process on the media item right-click menu. It uses the
+  // last gain set from the UI (defaults to 100%). Unlike our Extensions submenu, that menu is
+  // shared with every other extension, so the label names us explicitly.
+  RegisterAction("IPlugReaperExtensionWebUI: Process selected item", [&]() { ProcessSelectedItem(mGain); }, false, nullptr, "Media item context",
+                 "Process selected item with " IPLUG_STRINGIFY(PLUG_CLASS_NAME));
+}
+
+void IPlugReaperExtensionWebUI::SendArbitraryMsgFromUI(int msgTag, int ctrlTag, int dataSize, const void* pData)
+{
+  switch (msgTag)
+  {
+    case kMsgTagAddTrack:
+      InsertTrackAtIndex(GetNumTracks(), false);
+      break;
+    case kMsgTagSetGain:
+      // ctrlTag carries the gain as a 0..100 percentage. Keep mGain current as the slider
+      // moves so the media-item context-menu action (which reads mGain) uses the latest value,
+      // and so it persists with the project even if the Process button is never clicked.
+      mGain = static_cast<double>(ctrlTag) / 100.0;
+      break;
+    case kMsgTagProcessItem:
+      // ctrlTag carries the gain as a 0..100 percentage
+      mGain = static_cast<double>(ctrlTag) / 100.0;
+      ProcessSelectedItem(mGain);
+      break;
+    case kMsgTagToggleDock:
+      ToggleDocking(); // recreates the window; OnUIOpen() re-pushes state afterwards
+      break;
+    default:
+      break;
+  }
+}
+
+namespace
+{
+
+#ifdef OS_WIN
+constexpr char kPathSep = '\\';
+#else
+constexpr char kPathSep = '/';
+#endif
+
+/** Splits a full path into its directory (no trailing separator) and the file's stem (the
+ * filename with any extension removed). Both separators are accepted when splitting, because
+ * REAPER hands back backslashes on Windows. The extension is stripped from the filename only,
+ * so a dot in a directory name doesn't truncate the path. */
+void SplitPath(const std::string& path, std::string& dirOut, std::string& stemOut)
+{
+  cons
```

**File**: `Examples/IPlugReaperExtensionWebUI/IPlugReaperExtensionWebUI.h` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+#pragma once
+
+#include "ReaperExt_include_in_plug_hdr.h"
+
+enum EMsgTags
+{
+  kMsgTagAddTrack = 0,
+  kMsgTagProcessItem = 1,
+  kMsgTagToggleDock = 2,
+  kMsgTagSetGain = 3, // gain (0..100) carried in ctrlTag; keeps mGain current as the slider moves
+  kNumMsgTags
+};
+
+using namespace iplug;
+
+class IPlugReaperExtensionWebUI : public ReaperExtBase
+{
+public:
+  IPlugReaperExtensionWebUI(reaper_plugin_info_t* pRec);
+  void OnIdle() override;
+
+  // Messages sent from the WebView UI arrive here
+  void SendArbitraryMsgFromUI(int msgTag, int ctrlTag, int dataSize, const void* pData) override;
+
+  // Called once the WebView content has loaded - push current state to the fresh UI
+  void OnUIOpen() override;
+
+  // hookpostcommand: react to project edits immediately (no polling lag)
+  void OnActionRun(int commandId, int flag) override;
+
+  // projectconfig: persist the gain in the .RPP
+  void SaveProjectState(ProjectStateContext* ctx) override;
+  bool LoadProjectStateLine(const char* line) override;
+  void OnBeginLoadProjectState(bool isUndo) override;
+
+private:
+  // Offline-process the first selected media item, applying gain (0..1), writing a
+  // new file next to the original and inserting it into the project.
+  void ProcessSelectedItem(double gain);
+
+  void PushTrackCount(bool force); // send track count to the WebView (if changed or forced)
+  void PushGain();                 // send the current gain to the WebView slider
+  void PushDockState();            // tell the WebView whether the window is docked
+
+  int mPrevTrackCount = -1;
+  double mGain = 1.0; // last gain set from the UI; persisted per-project; used by the right-click action
+};
```

**File**: `Examples/IPlugReaperExtensionWebUI/IPlugReaperExtensionWebUI.sln` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+﻿
+Microsoft Visual Studio Solution File, Format Version 12.00
+# Visual Studio 15
+VisualStudioVersion = 15.0.28010.2016
+MinimumVisualStudioVersion = 10.0.40219.1
+Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "IPlugReaperExtensionWebUI", "projects\IPlugReaperExtensionWebUI.vcxproj", "{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}"
+EndProject
+Global
+	GlobalSection(SolutionConfigurationPlatforms) = preSolution
+		Debug|x64 = Debug|x64
+		Debug|x86 = Debug|x86
+		Release|x64 = Release|x64
+		Release|x86 = Release|x86
+	EndGlobalSection
+	GlobalSection(ProjectConfigurationPlatforms) = postSolution
+		{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}.Debug|x64.ActiveCfg = Debug|x64
+		{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}.Debug|x64.Build.0 = Debug|x64
+		{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}.Debug|x86.ActiveCfg = Debug|ARM64EC
+		{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}.Debug|x86.Build.0 = Debug|ARM64EC
+		{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}.Release|x64.ActiveCfg = Release|x64
+		{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}.Release|x64.Build.0 = Release|x64
+		{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}.Release|x86.ActiveCfg = Release|ARM64EC
+		{1A3BED56-CF76-47A1-BCA3-54B14697C1D3}.Release|x86.Build.0 = Release|ARM64EC
+	EndGlobalSection
+	GlobalSection(SolutionProperties) = preSolution
+		HideSolutionNode = FALSE
+	EndGlobalSection
+	GlobalSection(ExtensibilityGlobals) = postSolution
+		SolutionGuid = {C617B0F9-17D9-4733-9A50-B47429F81049}
+	EndGlobalSection
+EndGlobal
```

**File**: `Examples/IPlugReaperExtensionWebUI/IPlugReaperExtensionWebUI.xcworkspace/contents.xcworkspacedata` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<Workspace
+   version = "1.0">
+   <FileRef
+      location = "group:projects/IPlugReaperExtensionWebUI-macOS.xcodeproj">
+   </FileRef>
+</Workspace>
```

---

### Incident Patch 6: `eeca3930` (2026-07-13)
**Commit Message**: Merge remote-tracking branch 'origin/pre_linux_kb'

**File**: `WDL/swell/swell-generic-gdk.cpp` (modified, +38/-9)
```diff
@@ -2458,6 +2458,7 @@ struct bridgeState {
   Display *native_disp;
   GdkWindow *cur_parent;
   Window cur_parent_xid;
+  Window cur_parent_xid2; // first child in xid, if any, otherwise cur_parent_xid
   HWND hwnd_child;
 
   bool lastvis;
@@ -2498,6 +2499,18 @@ bridgeState::~bridgeState()
     XDestroyWindow(native_disp,native_w);
   }
 }
+
+static Window get_x11_first_child(Display *disp, Window xid)
+{
+  Window root, par, *list=NULL;
+  unsigned int nlist=0;
+  if (!disp || !xid || !XQueryTree(disp,xid,&root,&par,&list, &nlist)) return xid;
+  Window ret = xid;
+  if (list && nlist>0) ret = list[0];
+  if (list) XFree(list);
+  return ret;
+}
+
 bridgeState::bridgeState(bool needrep, GdkWindow *_w, Window _nw, Display *_disp, GdkWindow *_curpar, HWND _hwnd_child)
 {
   hwnd_child = _hwnd_child;
@@ -2509,6 +2522,7 @@ bridgeState::bridgeState(bool needrep, GdkWindow *_w, Window _nw, Display *_disp
   need_reparent=needrep;
   cur_parent = _curpar;
   cur_parent_xid = _curpar ? GDK_WINDOW_XID(_curpar) : 0;
+  cur_parent_xid2 = get_x11_first_child(_disp, cur_parent_xid);
   memset(&lastrect,0,sizeof(lastrect));
   filter_windows.Add(this);
 }
@@ -2657,6 +2671,7 @@ static LRESULT xbridgeProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
 
               bs->cur_parent = h->m_oswindow;
               bs->cur_parent_xid = h->m_oswindow ? GDK_WINDOW_XID(h->m_oswindow) : 0;
+              bs->cur_parent_xid2 = get_x11_first_child(bs->native_disp, bs->cur_parent_xid);
               bs->need_reparent=false;
               if (vis && bs->lastvis) gdk_window_show(bs->w);
             }
@@ -3109,7 +3124,7 @@ static bool want_key_embed_redirect(Display *disp, Window scan_id, Window *new_d
   {
     bridgeState *bs = filter_windows.Get(x);
     if (bs && bs->cur_parent &&
-        bs->cur_parent_xid == scan_id &&
+        (bs->cur_parent_xid == scan_id || bs->cur_parent_xid2 == scan_id) &&
         bs->native_disp == disp)
     {
       HWND foc = GetFocus();
@@ -3139,7 +3154,7 @@ static bool want_key_embed_redirect(Display *disp, Window scan_id, Window *new_d
 
 static GdkFilterReturn filterCreateShowProc(GdkXEvent *xev, GdkEvent *event, gpointer data)
 {
-  const XEvent *xevent = (XEvent *)xev;
+  XEvent *xevent = (XEvent *)xev;
   if (WDL_NOT_NORMALLY(!xev)) return GDK_FILTER_CONTINUE;
 
   switch (xevent->type)
@@ -3151,7 +3166,7 @@ static GdkFilterReturn filterCreateShowProc(GdkXEvent *xev, GdkEvent *event, gpo
         Window dest;
         Display *disp = xevent->xany.display;
         if (!xevent->xany.send_event &&
-            want_key_embed_redirect(disp,xevent->xkey.window - 1, &dest, xevent->xkey.keycode, xevent->xkey.state))
+            want_key_embed_redirect(disp,xevent->xkey.window, &dest, xevent->xkey.keycode, xevent->xkey.state))
         {
           XEvent k;
           memset(&k,0,sizeof(k));
@@ -3160,18 +3175,32 @@ static GdkFilterReturn filterCreateShowProc(GdkXEvent *xev, GdkEvent *event, gpo
           XSendEvent(disp, dest, False, NoEventMask, &k);
           return GDK_FILTER_REMOVE;
         }
+        else if (xevent->xany.send_event)
+        {
+          Window scan_id = xevent->xkey.window;
+          for (int x=0;x<filter_windows.GetSize(); x++)
+          {
+            bridgeState *bs = filter_windows.Get(x);
+            if (bs && bs->native_disp == disp && bs->cur_parent_xid && bs->native_w == scan_id)
+            {
+              // redirect to the parent window for processing
+              xevent->xkey.window = bs->cur_parent_xid;
+              return GDK_FILTER_CONTINUE;
+            }
+          }
+        }
       }
     break;
     case FocusIn:
       {
         // only used if gdk_disable_multidevice() was called prior to gdk_init_ (maybe some env var too?)
         Display *disp = xevent->xany.display;
-        Window scan_id = xevent->xfocus.window - 1;
+        Window scan_id = xevent->xfocus.window;
         for (int x=0;x<filter_windows.GetSize(); x++)
         {
           bridgeState *bs = filter_windows.Get(x);
           if (bs && bs->cur_parent &&
-              bs->cur_parent_xid == scan_id &&
+              (bs->cur_parent_xid == scan_id || bs->cur_parent_xid2 == scan_id) &&
               bs->native_disp == disp)
           {
             POINT pt;
@@ -3197,7 +3226,7 @@ static GdkFilterReturn filterCreateShowProc(GdkXEvent *xev, GdkEvent *event, gpo
         {
           Window dest;
           Display *disp = xevent->xany.display;
-          if (want_key_embed_redirect(disp,xievent->event-1, &dest, xievent->detail, xievent->mods.effective))
+          if (want_key_embed_redirect(disp,xievent->event, &dest, xievent->detail, xievent->mods.effective))
           {
             XEvent k;
             if (xievent->evtype == XI_KeyPress) k.xkey.type = KeyPress;
@@ -3224,12 +3253,12 @@ static GdkFilterReturn filterCreateShowProc(GdkXEvent *xev, GdkEvent *event, gpo
         {
           Display *disp = xevent->xany.display;
           XIFocusInEvent *foc
```

---

### Incident Patch 7: `5ee7bbc6` (2026-07-13)
**Commit Message**: Revert "swell-generic-gdk: mark bridge window as accepting keyboard events"

This reverts commit 18fa0b070028cf2b42625062d1faee47960c61b7. -- from fdde22ba

**File**: `WDL/swell/swell-generic-gdk.cpp` (modified, +1/-4)
```diff
@@ -3352,13 +3352,10 @@ HWND SWELL_CreateXBridgeWindow(HWND viewpar, void **wref, const RECT *r)
   }
 
   Display *disp = gdk_x11_display_get_xdisplay(gdk_window_get_display(ospar));
-  XSetWindowAttributes attr;
-  memset(&attr,0,sizeof(attr));
-  attr.event_mask = KeyPress|KeyRelease;
   Window w = XCreateWindow(disp,GDK_WINDOW_XID(ospar),0,0,
       wdl_max(r->right-r->left,1),
       wdl_max(r->bottom-r->top,1),
-      0,CopyFromParent, InputOutput, CopyFromParent, CWEventMask, &attr);
+      0,CopyFromParent, InputOutput, CopyFromParent, 0, NULL);
   GdkWindow *gdkw = w ? gdk_x11_window_foreign_new_for_display(gdk_display_get_default(),w) : NULL;
 
   hwnd = new HWND__(viewpar,0,r,NULL, true, xbridgeProc);
```

---

### Incident Patch 8: `45a6d045` (2026-07-09)
**Commit Message**: Merge pull request #1381 from iPlug2/reaper-ext-menu-toggle-fix

Reaper Extension Improvements

**File**: `Examples/IPlugReaperExtension/IPlugReaperExtension.cpp` (modified, +3/-3)
```diff
@@ -25,10 +25,10 @@ IPlugReaperExtension::IPlugReaperExtension(reaper_plugin_info_t* pRec)
     InsertTrackAtIndex(GetNumTracks(), false);
   };
   
-  //Register an action. args: name: lambda, add menu item,
-  RegisterAction("IPlugReaperExtension: Action 1 - MsgBox", action1, true);
+  //Register an action. args: name, lambda, add to Extensions submenu, toggle ptr, context menu id, menu label
+  RegisterAction("IPlugReaperExtension: Action 1 - MsgBox", action1, true, nullptr, nullptr, "Action 1 - MsgBox");
   RegisterAction("IPlugReaperExtension: Action 2 - AddTrack", action2);
-  RegisterAction("IPlugReaperExtension: Action 3 - Show/Hide UI", [&]() { ShowHideMainWindow(); mGUIToggle = !mGUIToggle; }, true, &mGUIToggle);
+  RegisterAction("IPlugReaperExtension: Action 3 - Show/Hide UI", [&]() { ShowHideMainWindow(); }, true, GetWindowTogglePtr(), nullptr, "Show/Hide UI");
   
   mLayoutFunc = [&](IGraphics* pGraphics) {
     const IRECT bounds = pGraphics->GetBounds();
```

**File**: `Examples/IPlugReaperExtension/IPlugReaperExtension.h` (modified, +1/-3)
```diff
@@ -16,10 +16,8 @@ class IPlugReaperExtension : public ReaperExtBase
 public:
   IPlugReaperExtension(reaper_plugin_info_t* pRec);
   void OnIdle() override;
-  void OnUIClose() override { mGUIToggle = 0; }
-  
+
 private:
   int mPrevTrackCount = 0;
-  int mGUIToggle = 0;
 };
 
```

**File**: `IPlug/ReaperExt/ReaperExtBase.cpp` (modified, +155/-40)
```diff
@@ -8,8 +8,9 @@ ReaperExtBase::ReaperExtBase(reaper_plugin_info_t* pRec)
 {
   mTimer = std::unique_ptr<Timer>(Timer::Create(std::bind(&ReaperExtBase::OnTimer, this, std::placeholders::_1), IDLE_TIMER_RATE));
   mDockId.Set(IPLUG_STRINGIFY(PLUG_CLASS_NAME));
+  mMenuName.Set(IPLUG_STRINGIFY(PLUG_CLASS_NAME));
   memset(&mDockState, 0, sizeof(ReaperExtDockState));
-  // Note: LoadDockState() is called lazily in CreateMainWindow() after API imports
+  // Note: LoadDockState() is called lazily via EnsureStateLoaded() after API imports
 }
 
 ReaperExtBase::~ReaperExtBase()
@@ -67,19 +68,37 @@ bool ReaperExtBase::EditorResizeFromUI(int viewWidth, int viewHeight, bool needs
   return false;
 }
 
+/** Reads the persisted dock state on first use. Deferred out of the constructor because
+ * the REAPER API function pointers aren't imported yet at that point */
+void ReaperExtBase::EnsureStateLoaded()
+{
+  if (mStateLoaded)
+    return;
+
+  LoadDockState();
+  mStateLoaded = true;
+  UpdateToggleStates();
+}
+
 void ReaperExtBase::CreateMainWindow()
 {
   if (gHWND != NULL)
     return;
 
-  // Lazy load state on first window creation (after API imports are done)
-  if (!mStateLoaded)
-  {
-    LoadDockState();
-    mStateLoaded = true;
-  }
+  EnsureStateLoaded();
 
   gHWND = CreateDialog(gHINSTANCE, MAKEINTRESOURCE(IDD_DIALOG_MAIN), gParent, ReaperExtBase::MainDlgProc);
+
+  UpdateToggleStates();
+}
+
+/** Keeps the toggle ints in sync with the real state, so any action registered with
+ * GetWindowTogglePtr()/GetDockTogglePtr() reports the truth to REAPER. Dockedness is a
+ * persisted preference that applies whether or not the window is currently open */
+void ReaperExtBase::UpdateToggleStates()
+{
+  mWindowToggle = (gHWND != NULL) ? 1 : 0;
+  mDockToggle = IsDocked() ? 1 : 0;
 }
 
 void ReaperExtBase::DestroyMainWindow()
@@ -92,6 +111,8 @@ void ReaperExtBase::DestroyMainWindow()
   DockWindowRemove(gHWND);
   DestroyWindow(gHWND);
   gHWND = NULL;
+
+  UpdateToggleStates();
 }
 
 void ReaperExtBase::ShowHideMainWindow()
@@ -110,8 +131,16 @@ void ReaperExtBase::ShowHideMainWindow()
 
 void ReaperExtBase::ToggleDocking()
 {
+  EnsureStateLoaded();
+
+  // With no window open, just flip the persisted preference so the next open honours it
   if (gHWND == NULL)
+  {
+    mDockState.state ^= 2;
+    SaveDockState();
+    UpdateToggleStates();
     return;
+  }
 
   // Save floating position before toggling
   if (!IsDocked())
@@ -180,47 +209,134 @@ void ReaperExtBase::LoadDockState()
   }
 }
 
-void ReaperExtBase::RegisterAction(const char* actionName, std::function<void()> func, bool addMenuItem, int* pToggle, const char* contextMenuId/*, IKeyPress keyCmd*/)
+void ReaperExtBase::RegisterAction(const char* actionName, std::function<void()> func, bool addMenuItem, int* pToggle, const char* contextMenuId, const char* menuLabel/*, IKeyPress keyCmd*/)
 {
   ReaperAction action;
-  
+
   int commandID = mRec->Register("command_id", (void*) actionName /* ?? */);
-  
+
   assert(commandID);
-  
+
   action.func = func;
   action.accel.accel.cmd = commandID;
   action.accel.desc = actionName;
   action.addMenuItem = addMenuItem;
   action.pToggle = pToggle;
-  
+
   action.contextMenuId = contextMenuId;
+  action.menuLabel = menuLabel ? menuLabel : actionName;
   gActions.push_back(action);
-  
+
   mRec->Register("gaccel", (void*) &gActions.back().accel);
 }
 
+/** Sets the check state of the item with the given command id, searching nested submenus.
+ * SWELL's CheckMenuItem() searches submenus when passed MF_BYCOMMAND, but the native Win32
+ * one is not documented to, and our items live in a submenu we create. So find the item
+ * explicitly and check it by position, which is unambiguous on both platforms.
+ * @return true if the item was found */
+static bool CheckActionMenuItem(HMENU hMenu, int commandId, bool checked)
+{
+  const int nItems = GetMenuItemCount(hMenu);
+
+  for (int i = 0; i < nItems; i++)
+  {
+    MENUITEMINFO mi = { sizeof(MENUITEMINFO), };
+    mi.fMask = MIIM_ID | MIIM_SUBMENU;
+
+    if (!GetMenuItemInfo(hMenu, i, TRUE, &mi))
+      continue;
+
+    if (mi.hSubMenu)
+    {
+      if (CheckActionMenuItem(mi.hSubMenu, commandId, checked))
+        return true;
+    }
+    else if (static_cast<int>(mi.wID) == commandId)
+    {
+      CheckMenuItem(hMenu, i, MF_BYPOSITION | (checked ? MF_CHECKED : MF_UNCHECKED));
+      return true;
+    }
+  }
+
+  return false;
+}
+
+static void AppendActionMenuItem(HMENU hMenu, const ReaperAction& action)
+{
+  MENUITEMINFO mi = { sizeof(MENUITEMINFO), };
+  mi.fMask = MIIM_TYPE | MIIM_ID;
+  mi.fType = MFT_STRING;
+  mi.dwTypeData = LPSTR(action.menuLabel);
+  mi.wID = action.accel.accel.cmd;
+  // Append to the end of the menu (works regardless of user customization)
+  InsertMenuItem(hMenu, GetMenuItemCount(hMenu), TRUE, &mi);
+}
+
 //static
 void ReaperExtBase::MenuHook(const char* menuidstr, void* menu, int flag)
 {
-  // flag==0: the default menu is being 
```

**File**: `IPlug/ReaperExt/ReaperExtBase.h` (modified, +28/-4)
```diff
@@ -76,13 +76,18 @@ class ReaperExtBase : public EDITOR_DELEGATE_CLASS
   virtual void OnBeginLoadProjectState(bool isUndo) {}; // NO-OP
 
   /** Registers an action with the REAPER extension system
-   * @param actionName The name of the action to register
+   * @param actionName The name of the action to register, as shown in the action list.
+   *        Must be a persistent pointer (e.g. a string literal)
    * @param func The function to call when the action is executed
-   * @param addMenuItem If true, adds a menu item for this action to the Extensions menu
+   * @param addMenuItem If true, adds a menu item for this action to the extension's
+   *        submenu of REAPER's Extensions menu
    * @param pToggle Optional pointer to an int for toggle state
    * @param contextMenuId Optional REAPER context-menu id to also add this action to,
-   *        e.g. "Media item context", "Track control panel context". nullptr = none. */
-  void RegisterAction(const char* actionName, std::function<void()> func, bool addMenuItem = false, int* pToggle = nullptr, const char* contextMenuId = nullptr/*, IKeyPress keyCmd*/);
+   *        e.g. "Media item context", "Track control panel context". nullptr = none.
+   * @param menuLabel Optional shorter label to use for menu items, since actionName is
+   *        usually prefixed to disambiguate it in the action list. Must be a persistent
+   *        pointer. nullptr = use actionName. */
+  void RegisterAction(const char* actionName, std::function<void()> func, bool addMenuItem = false, int* pToggle = nullptr, const char* contextMenuId = nullptr, const char* menuLabel = nullptr/*, IKeyPress keyCmd*/);
 
   /** Toggles the visibility of the main extension window */
   void ShowHideMainWindow();
@@ -93,10 +98,24 @@ class ReaperExtBase : public EDITOR_DELEGATE_CLASS
   /** Returns true if the window is currently docked */
   bool IsDocked() const { return (mDockState.state & 2) == 2; }
 
+  /** Toggle state for an action that shows/hides the main window. Pass to RegisterAction()
+   * as pToggle so the action gets a tick in menus and the action list while the window is open */
+  int* GetWindowTogglePtr() { return &mWindowToggle; }
+
+  /** Toggle state for an action that docks/undocks the main window. Pass to RegisterAction()
+   * as pToggle so the action gets a tick in menus and the action list while docked. Reflects
+   * the persisted preference, so it is meaningful even when the window is closed */
+  int* GetDockTogglePtr() { return &mDockToggle; }
+
   /** Sets the unique identifier used for dock state persistence
    * @param id Unique identifier string (defaults to PLUG_CLASS_NAME) */
   void SetDockId(const char* id) { mDockId.Set(id); }
 
+  /** Sets the title of the submenu that this extension's actions are added to,
+   * inside REAPER's Extensions menu
+   * @param name Submenu title (defaults to PLUG_CLASS_NAME) */
+  void SetMenuName(const char* name) { mMenuName.Set(name); }
+
 public:
   // Reaper calls back to this when it wants to execute an action registered by the extension plugin
   static bool HookCommandProc(int command, int flag);
@@ -125,13 +144,18 @@ class ReaperExtBase : public EDITOR_DELEGATE_CLASS
   void DestroyMainWindow();
   void SaveDockState();
   void LoadDockState();
+  void EnsureStateLoaded();
+  void UpdateToggleStates();
 
   reaper_plugin_info_t* mRec = nullptr;
   std::unique_ptr<Timer> mTimer;
   ReaperExtDockState mDockState = {};
   WDL_FastString mDockId;
+  WDL_FastString mMenuName;
   bool mSaveStateOnDestroy = true;
   bool mStateLoaded = false;
+  int mWindowToggle = 0;
+  int mDockToggle = 0;
 };
 
 END_IPLUG_NAMESPACE
```

**File**: `IPlug/ReaperExt/ReaperExt_include_in_plug_src.h` (modified, +4/-24)
```diff
@@ -30,6 +30,7 @@ struct ReaperAction
   std::function<void()> func;
   bool addMenuItem = false;
   const char* contextMenuId = nullptr; // REAPER context menu to add this action to, if any
+  const char* menuLabel = nullptr;     // label used in menus, defaults to the action name
 };
 
 // std::deque (not std::vector) so element addresses stay stable: REAPER keeps the
@@ -88,32 +89,11 @@ extern "C"
       pRec->Register("hookpostcommand", (void*) ReaperExtBase::PostCommandProc);
       pRec->Register("projectconfig", (void*) &gProjectConfig);
       
+      // Creates the Extensions main menu if it doesn't exist yet. It is populated from
+      // ReaperExtBase::MenuHook(), which REAPER calls with menuidstr "Main extensions".
       AddExtensionsMainMenu();
-      
+
       gParent = pRec->hwnd_main;
-      
-      HMENU hMenu = GetSubMenu(GetMenu(gParent),
-#ifdef OS_WIN
-                               8
-#else // OS X has one extra menu
-                               9
-#endif
-                               );
-      
-      int menuIdx = 6;
-      
-      for(auto& action : gActions)
-      {
-        if(action.addMenuItem)
-        {
-          MENUITEMINFO mi={sizeof(MENUITEMINFO),};
-          mi.fMask = MIIM_TYPE | MIIM_ID;
-          mi.fType = MFT_STRING;
-          mi.dwTypeData = LPSTR(action.accel.desc);
-          mi.wID = action.accel.accel.cmd;
-          InsertMenuItem(hMenu, menuIdx++, TRUE, &mi);
-        }
-      }
 
       return 1;
     }
```

---

### Incident Patch 9: `ac4e9336` (2026-07-09)
**Commit Message**: ReaperExt: fix toggle state being claimed by the first-loaded extension

An iPlug2 REAPER extension broke the toggle state of every other extension
loaded after it. ToggleActionCallback returned 0 for unknown command ids,
but "toggleaction" is a chain that REAPER walks until a hook claims the
command: 0 means "mine, currently off", -1 means "not mine". Claiming every
command id meant the first-loaded extension answered "off" for all of them,
so REAPER never queried the others and their toggle actions never showed a
tick. Return -1 instead.

HookCommandProc had the same shape of bug, always returning false even
after running the action. Per the SDK it must return true when it handles a
command, to stop further hooks and the default action from running.

Window and dock toggle state now live in ReaperExtBase, recomputed from the
real state and exposed via GetWindowTogglePtr()/GetDockTogglePtr(). The
example's own toggle int was flipped after OnUIClose() had already cleared
it, so it stuck on after the first close, and closing the window with its
close box never updated it at all.

Dockedness is a persisted preference rather than a property of the live
window, so ToggleDocking() now f

**File**: `Examples/IPlugReaperExtension/IPlugReaperExtension.cpp` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ IPlugReaperExtension::IPlugReaperExtension(reaper_plugin_info_t* pRec)
   //Register an action. args: name: lambda, add menu item,
   RegisterAction("IPlugReaperExtension: Action 1 - MsgBox", action1, true);
   RegisterAction("IPlugReaperExtension: Action 2 - AddTrack", action2);
-  RegisterAction("IPlugReaperExtension: Action 3 - Show/Hide UI", [&]() { ShowHideMainWindow(); mGUIToggle = !mGUIToggle; }, true, &mGUIToggle);
+  RegisterAction("IPlugReaperExtension: Action 3 - Show/Hide UI", [&]() { ShowHideMainWindow(); }, true, GetWindowTogglePtr());
   
   mLayoutFunc = [&](IGraphics* pGraphics) {
     const IRECT bounds = pGraphics->GetBounds();
```

**File**: `Examples/IPlugReaperExtension/IPlugReaperExtension.h` (modified, +1/-3)
```diff
@@ -16,10 +16,8 @@ class IPlugReaperExtension : public ReaperExtBase
 public:
   IPlugReaperExtension(reaper_plugin_info_t* pRec);
   void OnIdle() override;
-  void OnUIClose() override { mGUIToggle = 0; }
-  
+
 private:
   int mPrevTrackCount = 0;
-  int mGUIToggle = 0;
 };
 
```

**File**: `IPlug/ReaperExt/ReaperExtBase.cpp` (modified, +50/-23)
```diff
@@ -9,7 +9,7 @@ ReaperExtBase::ReaperExtBase(reaper_plugin_info_t* pRec)
   mTimer = std::unique_ptr<Timer>(Timer::Create(std::bind(&ReaperExtBase::OnTimer, this, std::placeholders::_1), IDLE_TIMER_RATE));
   mDockId.Set(IPLUG_STRINGIFY(PLUG_CLASS_NAME));
   memset(&mDockState, 0, sizeof(ReaperExtDockState));
-  // Note: LoadDockState() is called lazily in CreateMainWindow() after API imports
+  // Note: LoadDockState() is called lazily via EnsureStateLoaded() after API imports
 }
 
 ReaperExtBase::~ReaperExtBase()
@@ -67,19 +67,37 @@ bool ReaperExtBase::EditorResizeFromUI(int viewWidth, int viewHeight, bool needs
   return false;
 }
 
+/** Reads the persisted dock state on first use. Deferred out of the constructor because
+ * the REAPER API function pointers aren't imported yet at that point */
+void ReaperExtBase::EnsureStateLoaded()
+{
+  if (mStateLoaded)
+    return;
+
+  LoadDockState();
+  mStateLoaded = true;
+  UpdateToggleStates();
+}
+
 void ReaperExtBase::CreateMainWindow()
 {
   if (gHWND != NULL)
     return;
 
-  // Lazy load state on first window creation (after API imports are done)
-  if (!mStateLoaded)
-  {
-    LoadDockState();
-    mStateLoaded = true;
-  }
+  EnsureStateLoaded();
 
   gHWND = CreateDialog(gHINSTANCE, MAKEINTRESOURCE(IDD_DIALOG_MAIN), gParent, ReaperExtBase::MainDlgProc);
+
+  UpdateToggleStates();
+}
+
+/** Keeps the toggle ints in sync with the real state, so any action registered with
+ * GetWindowTogglePtr()/GetDockTogglePtr() reports the truth to REAPER. Dockedness is a
+ * persisted preference that applies whether or not the window is currently open */
+void ReaperExtBase::UpdateToggleStates()
+{
+  mWindowToggle = (gHWND != NULL) ? 1 : 0;
+  mDockToggle = IsDocked() ? 1 : 0;
 }
 
 void ReaperExtBase::DestroyMainWindow()
@@ -92,6 +110,8 @@ void ReaperExtBase::DestroyMainWindow()
   DockWindowRemove(gHWND);
   DestroyWindow(gHWND);
   gHWND = NULL;
+
+  UpdateToggleStates();
 }
 
 void ReaperExtBase::ShowHideMainWindow()
@@ -110,8 +130,16 @@ void ReaperExtBase::ShowHideMainWindow()
 
 void ReaperExtBase::ToggleDocking()
 {
+  EnsureStateLoaded();
+
+  // With no window open, just flip the persisted preference so the next open honours it
   if (gHWND == NULL)
+  {
+    mDockState.state ^= 2;
+    SaveDockState();
+    UpdateToggleStates();
     return;
+  }
 
   // Save floating position before toggling
   if (!IsDocked())
@@ -256,28 +284,26 @@ bool ReaperExtBase::HookCommandProc(int command, int flag)
 {
   auto it = std::find_if (gActions.begin(), gActions.end(), [&](const auto& e) { return e.accel.accel.cmd == command; });
 
-  if(it != gActions.end())
-  {
-    it->func();
-  }
-  
-  return false;
+  if (it == gActions.end())
+    return false; // not ours - let REAPER pass it to the next hook
+
+  it->func();
+
+  return true; // handled; stop further hooks and the default action from running
 }
 
 //static
 int ReaperExtBase::ToggleActionCallback(int command)
 {
   auto it = std::find_if (gActions.begin(), gActions.end(), [&](const auto& e) { return e.accel.accel.cmd == command; });
-  
-  if(it != gActions.end())
-  {
-    if(it->pToggle == nullptr)
-      return -1;
-    else
-      return *it->pToggle;
-  }
-  
-  return 0;
+
+  // -1 means "not this extension's action, or it doesn't toggle". Returning 0 here would
+  // claim every other extension's commands and report them as off, since REAPER walks the
+  // registered toggleaction hooks until one of them answers.
+  if (it == gActions.end() || it->pToggle == nullptr)
+    return -1;
+
+  return *it->pToggle;
 }
 
 //static
@@ -341,6 +367,7 @@ WDL_DLGRET ReaperExtBase::MainDlgProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARA
 
       DockWindowRemove(hwnd);
       gHWND = NULL;
+      gPlug->UpdateToggleStates(); // also covers the user closing the window directly
       return 0;
     }
     case WM_SIZE:
```

**File**: `IPlug/ReaperExt/ReaperExtBase.h` (modified, +13/-0)
```diff
@@ -93,6 +93,15 @@ class ReaperExtBase : public EDITOR_DELEGATE_CLASS
   /** Returns true if the window is currently docked */
   bool IsDocked() const { return (mDockState.state & 2) == 2; }
 
+  /** Toggle state for an action that shows/hides the main window. Pass to RegisterAction()
+   * as pToggle so the action gets a tick in menus and the action list while the window is open */
+  int* GetWindowTogglePtr() { return &mWindowToggle; }
+
+  /** Toggle state for an action that docks/undocks the main window. Pass to RegisterAction()
+   * as pToggle so the action gets a tick in menus and the action list while docked. Reflects
+   * the persisted preference, so it is meaningful even when the window is closed */
+  int* GetDockTogglePtr() { return &mDockToggle; }
+
   /** Sets the unique identifier used for dock state persistence
    * @param id Unique identifier string (defaults to PLUG_CLASS_NAME) */
   void SetDockId(const char* id) { mDockId.Set(id); }
@@ -125,13 +134,17 @@ class ReaperExtBase : public EDITOR_DELEGATE_CLASS
   void DestroyMainWindow();
   void SaveDockState();
   void LoadDockState();
+  void EnsureStateLoaded();
+  void UpdateToggleStates();
 
   reaper_plugin_info_t* mRec = nullptr;
   std::unique_ptr<Timer> mTimer;
   ReaperExtDockState mDockState = {};
   WDL_FastString mDockId;
   bool mSaveStateOnDestroy = true;
   bool mStateLoaded = false;
+  int mWindowToggle = 0;
+  int mDockToggle = 0;
 };
 
 END_IPLUG_NAMESPACE
```

---

### Incident Patch 10: `e58a03ae` (2026-07-08)
**Commit Message**: Fix non IGraphics Extensions

**File**: `IPlug/ReaperExt/ReaperExtBase.cpp` (modified, +2/-0)
```diff
@@ -293,7 +293,9 @@ WDL_DLGRET ReaperExtBase::MainDlgProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARA
     }
     case WM_SIZE:
     {
+#ifndef NO_IGRAPHICS
       if (gPlug->GetUI())
+#endif
       {
         RECT r;
         GetClientRect(hwnd, &r);
```

---

### Incident Patch 11: `0fe0cd5b` (2026-07-08)
**Commit Message**: Cmake: Fix Reaper Extension

**File**: `Scripts/cmake/ReaperExt.cmake` (modified, +23/-13)
```diff
@@ -45,19 +45,17 @@ if(NOT TARGET iPlug2::ReaperExt)
       iPlug2::IPlug
     )
   elseif(APPLE)
-    # macOS needs SWELL for dialogs and window management
+    # macOS needs SWELL for dialogs and window management. A REAPER extension runs
+    # inside REAPER, which already provides SWELL, so we compile ONLY the module stub
+    # (swell-modstub.mm). Built with SWELL_PROVIDED_BY_APP it defines the SWELL API as
+    # function pointers and binds them to REAPER's SWELL at load time (and exports
+    # SWELL_dllMain). Compiling the full SWELL sources here would instead produce empty
+    # objects (they are all wrapped in #ifndef SWELL_PROVIDED_BY_APP), leaving the SWELL
+    # symbols undefined so the extension fails to load.
     target_include_directories(iPlug2::ReaperExt INTERFACE ${SWELL_DIR})
 
     set(SWELL_SRC
-      "${SWELL_DIR}/swell.cpp"
-      "${SWELL_DIR}/swell-ini.cpp"
-      "${SWELL_DIR}/swell-dlg.mm"
-      "${SWELL_DIR}/swell-gdi.mm"
-      "${SWELL_DIR}/swell-kb.mm"
-      "${SWELL_DIR}/swell-menu.mm"
-      "${SWELL_DIR}/swell-misc.mm"
-      "${SWELL_DIR}/swell-miscdlg.mm"
-      "${SWELL_DIR}/swell-wnd.mm"
+      "${SWELL_DIR}/swell-modstub.mm"
     )
 
     target_sources(iPlug2::ReaperExt INTERFACE ${SWELL_SRC})
@@ -85,6 +83,9 @@ endif()
 function(iplug_configure_reaperext target project_name)
   target_link_libraries(${target} PUBLIC iPlug2::ReaperExt)
 
+  # REAPER only loads extensions whose filename starts with "reaper_"
+  set(reaper_ext_name "reaper_${project_name}")
+
   set_target_properties(${target} PROPERTIES
     CXX_STANDARD ${IPLUG2_CXX_STANDARD}
     CXX_STANDARD_REQUIRED ON
@@ -100,7 +101,7 @@ function(iplug_configure_reaperext target project_name)
   if(WIN32)
     set(REAPER_EXT_OUTPUT_DIR "${CMAKE_BINARY_DIR}/out")
     set_target_properties(${target} PROPERTIES
-      OUTPUT_NAME "${project_name}"
+      OUTPUT_NAME "${reaper_ext_name}"
       LIBRARY_OUTPUT_DIRECTORY "${REAPER_EXT_OUTPUT_DIR}"
       LIBRARY_OUTPUT_DIRECTORY_DEBUG "${REAPER_EXT_OUTPUT_DIR}"
       LIBRARY_OUTPUT_DIRECTORY_RELEASE "${REAPER_EXT_OUTPUT_DIR}"
@@ -109,7 +110,7 @@ function(iplug_configure_reaperext target project_name)
   elseif(APPLE)
     set(REAPER_EXT_OUTPUT_DIR "${CMAKE_BINARY_DIR}/out")
     set_target_properties(${target} PROPERTIES
-      OUTPUT_NAME "${project_name}"
+      OUTPUT_NAME "${reaper_ext_name}"
       LIBRARY_OUTPUT_DIRECTORY "${REAPER_EXT_OUTPUT_DIR}"
       LIBRARY_OUTPUT_DIRECTORY_DEBUG "${REAPER_EXT_OUTPUT_DIR}"
       LIBRARY_OUTPUT_DIRECTORY_RELEASE "${REAPER_EXT_OUTPUT_DIR}"
@@ -118,10 +119,19 @@ function(iplug_configure_reaperext target project_name)
       # Skip code signing during build
       XCODE_ATTRIBUTE_CODE_SIGNING_ALLOWED "NO"
     )
+
+    # Restrict exports to the two entry points REAPER/SWELL need: ReaperPluginEntry
+    # (the extension entry) and SWELL_dllMain (marks this as a SWELL-enabled module).
+    # Mirrors GCC_SYMBOLS_PRIVATE_EXTERN=YES in the native project so we don't leak
+    # ~2000 internal C++/REAPER-API symbols from the module.
+    target_link_options(${target} PRIVATE
+      "LINKER:-exported_symbol,_ReaperPluginEntry"
+      "LINKER:-exported_symbol,_SWELL_dllMain"
+    )
   endif()
 
   # Auto-deploy to REAPER UserPlugins if enabled
   if(IPLUG_DEPLOY_PLUGINS)
-    iplug_deploy_target(${target} REAPEREXT ${project_name})
+    iplug_deploy_target(${target} REAPEREXT ${reaper_ext_name})
   endif()
 endfunction()
```

---

### Incident Patch 12: `584df5a3` (2026-06-12)
**Commit Message**: Merge pull request #1370 from iPlug2/wasm/makefile-build

Improve WebUI/wasm examples & makefile build

**File**: `Examples/IPlugP5js/IPlugP5js.cpp` (modified, +24/-4)
```diff
@@ -1,12 +1,17 @@
 #include "IPlugP5js.h"
 #include "IPlug_include_in_plug_src.h"
 
-#include <cstring>
+namespace
+{
+constexpr double kOctaveFrequencies[] = {110., 220., 440., 880., 1760.};
+constexpr int kNumOctaves = static_cast<int>(sizeof(kOctaveFrequencies) / sizeof(kOctaveFrequencies[0]));
+}
 
 IPlugP5js::IPlugP5js(const InstanceInfo& info)
 : iplug::Plugin(info, MakeConfig(kNumParams, kNumPresets))
 {
-  GetParam(kGain)->InitGain("Gain", -70., -70, 0.);
+  GetParam(kGain)->InitGain("Gain", -12., -70, 0.);
+  GetParam(kOctave)->InitEnum("Octave", 0, {"110 Hz", "220 Hz", "440 Hz", "880 Hz", "1760 Hz"});
 
 #ifdef WEBVIEW_EDITOR_DELEGATE
   SetCustomUrlScheme("iplug2");
@@ -26,11 +31,26 @@ void IPlugP5js::ProcessBlock(sample** inputs, sample** outputs, int nFrames)
 {
   (void) inputs;
 
+  const auto gain = static_cast<sample>(GetParam(kGain)->DBToAmp());
+  // kOctave is an InitEnum param, so Int() is already bounded to [0, kNumOctaves-1].
+  const int octave = GetParam(kOctave)->Int();
   const int nChans = NOutChansConnected();
 
-  for (int c = 0; c < nChans; c++)
+  mOscillator.SetFreqCPS(kOctaveFrequencies[octave]);
+
+  for (int s = 0; s < nFrames; s++)
   {
-    memset(outputs[c], 0, nFrames * sizeof(sample));
+    const sample output = mOscillator.Process() * gain;
+
+    for (int c = 0; c < nChans; c++)
+    {
+      outputs[c][s] = output;
+    }
   }
 }
+
+void IPlugP5js::OnReset()
+{
+  mOscillator.SetSampleRate(GetSampleRate());
+}
 #endif
```

**File**: `Examples/IPlugP5js/IPlugP5js.h` (modified, +8/-0)
```diff
@@ -1,14 +1,18 @@
 #pragma once
 
 #include "IPlug_include_in_plug_hdr.h"
+#include "Oscillator.h"
 
 using namespace iplug;
 
 const int kNumPresets = 1;
 
+// NB: resources/web/sketch.js mirrors kOctave's index (kParamOctave) and the
+// octave count - keep them in sync if this enum changes.
 enum EParams
 {
   kGain = 0,
+  kOctave,
   kNumParams
 };
 
@@ -19,5 +23,9 @@ class IPlugP5js final : public Plugin
 
 #if IPLUG_DSP
   void ProcessBlock(sample** inputs, sample** outputs, int nFrames) override;
+  void OnReset() override;
 #endif
+
+private:
+  FastSinOscillator<sample> mOscillator {0., 110.};
 };
```

**File**: `Examples/IPlugP5js/config/IPlugP5js-wasm.mk` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# IPLUG2_ROOT should point to the top level IPLUG2 folder from the project folder
+# By default, that is three directories up from /Examples/IPlugP5js/config
+IPLUG2_ROOT = ../../..
+
+include ../../../common-wasm.mk
+
+SRC += $(PROJECT_ROOT)/IPlugP5js.cpp
+
+# DSP module flags
+WASM_DSP_CFLAGS +=
+
+WASM_DSP_LDFLAGS += -O3 -s ASSERTIONS=0
+
+# WebView UI module flags
+# Redirect the generic UI vars to the WebView variants so the shared
+# -wasm-ui.mk rules build the WebView module (no IGraphics).
+WASM_UI_SRC = $(WASM_WEBVIEW_UI_SRC)
+WASM_UI_EXPORTS = $(WASM_WEBVIEW_UI_EXPORTS)
+
+WASM_UI_CFLAGS += $(WEBVIEW_CFLAGS)
+
+WASM_UI_LDFLAGS += -O3 -s ASSERTIONS=0
```

**File**: `Examples/IPlugP5js/projects/IPlugP5js-wasm-dsp.mk` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+include ../config/IPlugP5js-wasm.mk
+
+TARGET = ../build-web-wasm/scripts/IPlugP5js-dsp.js
+
+SRC += $(WASM_DSP_SRC)
+CFLAGS += $(WASM_DSP_CFLAGS)
+CFLAGS += $(EXTRA_CFLAGS)
+LDFLAGS += $(WASM_DSP_LDFLAGS) \
+-s EXPORTED_FUNCTIONS=$(WASM_DSP_EXPORTS)
+
+$(TARGET): $(OBJECTS)
+	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(SRC)
```

**File**: `Examples/IPlugP5js/projects/IPlugP5js-wasm-ui.mk` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+include ../config/IPlugP5js-wasm.mk
+
+TARGET = ../build-web-wasm/scripts/IPlugP5js-ui.js
+
+SRC += $(WASM_UI_SRC)
+CFLAGS += $(WASM_UI_CFLAGS)
+CFLAGS += $(EXTRA_CFLAGS)
+LDFLAGS += $(WASM_UI_LDFLAGS) \
+-s EXPORTED_FUNCTIONS=$(WASM_UI_EXPORTS)
+
+$(TARGET): $(OBJECTS)
+	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(SRC)
```

**File**: `Examples/IPlugP5js/resources/web/index.html` (modified, +19/-6)
```diff
@@ -4,16 +4,26 @@
     <meta charset="utf-8">
     <!-- <meta name="viewport" width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0> -->
     <style type="text/css">
+      html,
       body {
+        width: 100%;
+        height: 100%;
         padding: 0;
         margin: 0;
         overflow: hidden;
       }
+
+      #sketch {
+        width: 100%;
+        height: 100%;
+        overflow: hidden;
+      }
+
+      #sketch canvas {
+        display: block;
+      }
     </style>
-     <script src="p5.min.js" type="text/javascript"></script>
-     <script src="sketch.js"></script>
-    <script src="script.js"></script>
-    <title>Shader</title>
+    <title>IPlugP5js</title>
     <script>
       function OnParamChange(param, value) {
 
@@ -29,9 +39,12 @@
       
       function onLoad() {
       }
-  </script>
+    </script>
+    <script src="script.js"></script>
+    <script src="p5.min.js" type="text/javascript"></script>
+    <script src="sketch.js"></script>
   </head>
   <body onload="onLoad()">
-<!--  <p>Hello, edit the file "IPlugP5js.app/Contents/Resources/web/index.html" to change this</p>-->
+    <main id="sketch"></main>
   </body>
 </html>
```

**File**: `Examples/IPlugP5js/resources/web/script.js` (modified, +12/-6)
```diff
@@ -1,5 +1,11 @@
 // FROM DELEGATE
 
+function IPlugPostMessage(message) {
+  if (typeof IPlugSendMsg === 'function') {
+    IPlugSendMsg(message);
+  }
+}
+
 function SPVFD(paramIdx, val) {
 //  console.log("paramIdx: " + paramIdx + " value:" + val);
   OnParamChange(paramIdx, val);
@@ -39,7 +45,7 @@ function SAMFUI(msgTag, ctrlTag = -1, data = 0) {
     "data": data
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 function SMMFUI(statusByte, dataByte1, dataByte2) {
@@ -50,7 +56,7 @@ function SMMFUI(statusByte, dataByte1, dataByte2) {
     "dataByte2": dataByte2
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 // data should be a base64 encoded string
@@ -60,7 +66,7 @@ function SSMFUI(data = 0) {
     "data": data
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 function EPCFUI(paramIdx) {
@@ -69,7 +75,7 @@ function EPCFUI(paramIdx) {
     "paramIdx": paramIdx,
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 function BPCFUI(paramIdx) {
@@ -78,7 +84,7 @@ function BPCFUI(paramIdx) {
     "paramIdx": paramIdx,
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 function SPVFUI(paramIdx, value) {
@@ -88,5 +94,5 @@ function SPVFUI(paramIdx, value) {
     "value": value
   };
 
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
```

**File**: `Examples/IPlugP5js/resources/web/sketch.js` (modified, +55/-5)
```diff
@@ -6,6 +6,10 @@
 
  // this variable will hold our shader object
  let theShader;
+ // Must match the kOctave enum index and the octave count in IPlugP5js.h.
+ const kParamOctave = 1;
+ const kNumOctaves = 5;
+ let lastOctave = -1;
 
  function preload(){
    // load the shader
@@ -14,24 +18,70 @@
 
  function setup() {
    // shaders require WEBGL mode to work
-   createCanvas(windowWidth, windowHeight, WEBGL);
+   const size = getSketchSize();
+   const canvas = createCanvas(size.width, size.height, WEBGL);
+   canvas.parent('sketch');
    noStroke();
  }
 
  function draw() {
    // shader() sets the active shader with our shader
    shader(theShader);
 
+   const mouseShape = getMouseShape();
+   sendOctave(getOctaveForShape(mouseShape));
+
    // lets send the resolution, mouse, and time to our shader
    // before sending mouse + time we modify the data so it's more easily usable by the shader
    theShader.setUniform('resolution', [width, height]);
-   theShader.setUniform('mouse', map(mouseX, 0, width, 0, 7));
+   theShader.setUniform('mouse', mouseShape);
    theShader.setUniform('time', frameCount * 0.01);
 
-   // rect gives us some geometry on the screen
-   rect(0,0,width, height);
+   // In WEBGL mode the origin is the centre of the canvas.
+   rect(-width / 2, -height / 2, width, height);
  }
 
 function windowResized() {
-  resizeCanvas(windowWidth, windowHeight);
+  const size = getSketchSize();
+  resizeCanvas(size.width, size.height);
+}
+
+function getSketchSize() {
+  const sketch = document.getElementById('sketch');
+  const bounds = sketch ? sketch.getBoundingClientRect() : null;
+
+  // Clamp to a min of 1: bounds and window.inner* can be 0 before layout/in headless contexts.
+  return {
+    width: Math.max(1, Math.round(bounds?.width || window.innerWidth || 1)),
+    height: Math.max(1, Math.round(bounds?.height || window.innerHeight || 1))
+  };
+}
+
+function getMouseShape() {
+  const normalizedX = Math.max(0, Math.min(1, mouseX / Math.max(1, width)));
+  return normalizedX * 7;
+}
+
+function getOctaveForShape(shape) {
+  return Math.min(kNumOctaves - 1, Math.floor((shape / 7) * kNumOctaves));
+}
+
+function sendOctave(octave) {
+  if (octave === lastOctave || typeof SPVFUI !== 'function') {
+    return;
+  }
+
+  lastOctave = octave;
+  // SPVFUI expects a 0..1 normalised value; iPlug maps it back to the enum index on the C++ side.
+  const normalizedOctave = octave / (kNumOctaves - 1);
+
+  if (typeof BPCFUI === 'function') {
+    BPCFUI(kParamOctave);
+  }
+
+  SPVFUI(kParamOctave, normalizedOctave);
+
+  if (typeof EPCFUI === 'function') {
+    EPCFUI(kParamOctave);
+  }
 }
```

---

### Incident Patch 13: `859611d3` (2026-06-07)
**Commit Message**: Improve IPlugWebUI example resizing

**File**: `Examples/IPlugWebUI/resources/web/button-control.js` (modified, +17/-8)
```diff
@@ -10,27 +10,36 @@ class ButtonControl extends HTMLElement {
         }
         
         button {
-          background-color: #f3f4f6;
-          border: 2px solid #d1d5db;
+          background-color: var(--surface, #ffffff);
+          border: 1px solid var(--border, #c9ced6);
           border-radius: 6px;
-          color: #374151;
+          color: var(--text, #18202d);
           cursor: pointer;
           font-family: system-ui, -apple-system, sans-serif;
-          font-size: 14px;
+          font-size: var(--control-font-size, 14px);
           font-weight: 500;
-          padding: 8px 16px;
+          line-height: 1.2;
+          min-height: var(--control-min-height, 36px);
+          padding: var(--control-padding-block, 8px) var(--control-padding-inline, 16px);
+          white-space: nowrap;
+          box-shadow: 0 1px 1px rgba(24, 32, 45, 0.05);
           transition: all 0.2s ease;
         }
 
         button:hover {
-          background-color: #e5e7eb;
-          border-color: #9ca3af;
+          background-color: var(--surface-hover, #e8edf3);
+          border-color: var(--border-strong, #98a2b3);
         }
 
         button:active {
-          background-color: #d1d5db;
+          background-color: var(--surface-subtle, #eef1f5);
           transform: translateY(1px);
         }
+
+        button:focus-visible {
+          outline: 2px solid var(--accent, #2563eb);
+          outline-offset: 2px;
+        }
       </style>
       <button><slot></slot></button>
     `;
```

**File**: `Examples/IPlugWebUI/resources/web/index.html` (modified, +273/-54)
```diff
@@ -4,7 +4,29 @@
   <meta charset="utf-8" />
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <style type="text/css">
+    :root {
+      --bg: #f4f6f8;
+      --surface: #ffffff;
+      --surface-subtle: #eef1f5;
+      --surface-hover: #e8edf3;
+      --text: #18202d;
+      --muted-text: #5d6675;
+      --border: #c9ced6;
+      --border-strong: #98a2b3;
+      --accent: #2563eb;
+      --accent-soft: #dbeafe;
+      --success-soft: #e6f6ee;
+      --control-font-size: 14px;
+      --control-min-height: 36px;
+      --control-padding-block: 8px;
+      --control-padding-inline: 16px;
+      --knob-size: 80px;
+      --knob-label-gap: 8px;
+      --knob-value-gap: 8px;
+    }
+
     * {
+      box-sizing: border-box;
       -webkit-touch-callout: none;
       -webkit-user-select: none;
     }
@@ -13,12 +35,39 @@
       pointer-events: none;
     }
     
+    html,
+    body {
+      width: 100%;
+      height: 100%;
+      margin: 0;
+    }
+
     body {
-      overflow: hidden;
-      padding: 0 20px;
+      overflow: auto;
+      padding: 28px;
       -webkit-overflow-scrolling: touch;
-      background-color: #ffffff;
+      background-color: var(--bg);
+      color: var(--text);
       font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
+      font-size: 15px;
+      line-height: 1.4;
+    }
+
+    .ui-shell {
+      width: 100%;
+      max-width: 920px;
+      min-height: calc(100vh - 56px);
+      display: flex;
+      flex-direction: column;
+      justify-content: flex-start;
+    }
+
+    h1 {
+      margin: 0 0 20px;
+      color: var(--text);
+      font-size: 28px;
+      line-height: 1.1;
+      font-weight: 700;
     }
   
     .left {
@@ -54,10 +103,14 @@
     }
 
     .dropzone {
-        border: 4px dashed #d1d5db;
-        border-radius: 0.5rem;
+        width: 100%;
+        min-height: 96px;
+        padding: 20px;
+        border: 2px dashed var(--border);
+        border-radius: 8px;
+        color: var(--text);
         text-align: center;
-        background-color: #f3f4f6;
+        background-color: var(--surface-subtle);
         transition: all 0.2s ease;
         display: flex;
         flex-direction: column;
@@ -66,12 +119,12 @@
     }
 
     .dropzone.dragover {
-        border-color: #3b82f6;
-        background-color: #eff6ff;
+        border-color: var(--accent);
+        background-color: var(--accent-soft);
     }
 
     .dropzone.has-file {
-        background-color: #f0fdf4;
+        background-color: var(--success-soft);
     }
 
     .icon {
@@ -83,34 +136,42 @@
     .filename {
         font-size: 1.125rem;
         font-weight: 600;
-        color: #374151;
+        color: var(--text);
         margin: 0.5rem 0;
     }
 
     .filesize {
         font-size: 0.875rem;
-        color: #6b7280;
+        color: var(--muted-text);
         margin-bottom: 1rem;
     }
 
     .file-content {
         cursor: move;
         user-select: none;
+        max-width: 100%;
     }
 
     .drag-instructions {
         font-size: 0.875rem;
-        color: #4b5563;
+        color: var(--muted-text);
         margin-top: 1rem;
     }
 
+    .instructions {
+        margin: 0;
+        color: var(--text);
+        font-size: 15px;
+        font-weight: 600;
+    }
+
     /* Drag image styles */
     .drag-image {
         display: flex;
         align-items: center;
         gap: 12px;
         padding: 12px;
-        background: white;
+        background: var(--surface);
         border-radius: 8px;
         box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
         max-width: 300px;
@@ -125,7 +186,7 @@
         display: flex;
         align-items: center;
         justify-content: center;
-        background: #4f46e5;
+        background: var(--accent);
         border-radius: 6px;
         padding: 6px;
     }
@@ -145,19 +206,19 @@
 
     .drag-image .file-name {
         font-weight: 500;
-        color: #1f2937;
+        color: var(--text);
         font-size: 14px;
     }
 
     .drag-image .file-type {
-        color: #6b7280;
+        color: var(--muted-text);
         font-size: 12px;
     }
 
     .controls-container {
       display: flex;
       flex-direction: column;
-      gap: 20px;
+      gap: 16px;
     }
 
     .button-group {
@@ -179,20 +240,173 @@
     }
 
     .file-input-group {
-      margin-top: 10px;
+      margin-top: 2px;
     }
 
     input[type="file"] {
-      padding: 10px;
-      border: 2px solid #d1d5db;
+      width: min(100%, 340px);
+      max-width: 100%;
+      padding: 9px 10px;
+      border: 1px solid var(--border);
       border-radius: 6px;
-      /* width: 100%; */
+      color: var(--text);
+      background-color: var(--surface);
+      font: inherit;
     }
 
     button-control,
     knob-control {
       font-family: inherit;
     }
+
+    .knob-container {
+      display: inline-flex;
+      align-items: center;
+      align-self: flex-start;
+      min-height: 124p
```

**File**: `Examples/IPlugWebUI/resources/web/knob-control.js` (modified, +16/-9)
```diff
@@ -13,20 +13,21 @@ class KnobControl extends HTMLElement {
     const units = this.getAttribute('units') || '';
     const minAngle = parseFloat(this.getAttribute('min-angle')) || -135;
     const maxAngle = parseFloat(this.getAttribute('max-angle')) || 135;
-    const circleStrokeColor = this.getAttribute('circle-stroke-color') || '#fff';
+    const circleStrokeColor = this.getAttribute('circle-stroke-color') || '#eef1f5';
     const circleStrokeWidth = parseFloat(this.getAttribute('circle-stroke-width')) || 2;
-    const circleFillColor = this.getAttribute('circle-fill-color') || '#000';
-    const pointerColor = this.getAttribute('pointer-color') || '#f00';
+    const circleFillColor = this.getAttribute('circle-fill-color') || '#18202d';
+    const pointerColor = this.getAttribute('pointer-color') || '#2563eb';
     const pointerWidth = parseFloat(this.getAttribute('pointer-width')) || 4;
-    const valueArcColor = this.getAttribute('value-arc-color') || '#f00';
+    const valueArcColor = this.getAttribute('value-arc-color') || '#2563eb';
     const valueArcWidth = parseFloat(this.getAttribute('value-arc-width')) || 3;
-    const trackBgColor = this.getAttribute('track-bg-color') || '#999';
+    const trackBgColor = this.getAttribute('track-bg-color') || '#c9ced6';
     
     this.attachShadow({ mode: 'open' });
     this.shadowRoot.innerHTML = `
     <style>
     :host {
       display: inline-block;
+      color: var(--text, #18202d);
     }
     .container {
       display: flex;
@@ -37,17 +38,23 @@ class KnobControl extends HTMLElement {
       height: 100%;
     }
     .label {
-      margin-bottom: 8px;
-      color: black;
+      margin-bottom: var(--knob-label-gap, 8px);
+      color: var(--text, #18202d);
       font-size: 14px;
+      font-weight: 600;
       pointer-events: none;
     }
     .value {
-      margin-top: 8px;
-      color: white;
+      margin-top: var(--knob-value-gap, 8px);
+      color: var(--muted-text, #5d6675);
       font-size: 12px;
+      min-height: 17px;
       pointer-events: none;
     }
+    svg {
+      width: var(--knob-size, 80px);
+      height: var(--knob-size, 80px);
+    }
     .hidden-cursor {
       cursor: none;
     }
```

---

### Incident Patch 14: `a8c2b996` (2026-06-07)
**Commit Message**: Update p5Js example with audio/resizing fix

**File**: `Examples/IPlugP5js/IPlugP5js.cpp` (modified, +24/-4)
```diff
@@ -1,12 +1,17 @@
 #include "IPlugP5js.h"
 #include "IPlug_include_in_plug_src.h"
 
-#include <cstring>
+namespace
+{
+constexpr double kOctaveFrequencies[] = {110., 220., 440., 880., 1760.};
+constexpr int kNumOctaves = static_cast<int>(sizeof(kOctaveFrequencies) / sizeof(kOctaveFrequencies[0]));
+}
 
 IPlugP5js::IPlugP5js(const InstanceInfo& info)
 : iplug::Plugin(info, MakeConfig(kNumParams, kNumPresets))
 {
-  GetParam(kGain)->InitGain("Gain", -70., -70, 0.);
+  GetParam(kGain)->InitGain("Gain", -12., -70, 0.);
+  GetParam(kOctave)->InitEnum("Octave", 0, {"110 Hz", "220 Hz", "440 Hz", "880 Hz", "1760 Hz"});
 
 #ifdef WEBVIEW_EDITOR_DELEGATE
   SetCustomUrlScheme("iplug2");
@@ -26,11 +31,26 @@ void IPlugP5js::ProcessBlock(sample** inputs, sample** outputs, int nFrames)
 {
   (void) inputs;
 
+  const auto gain = static_cast<sample>(GetParam(kGain)->DBToAmp());
+  // kOctave is an InitEnum param, so Int() is already bounded to [0, kNumOctaves-1].
+  const int octave = GetParam(kOctave)->Int();
   const int nChans = NOutChansConnected();
 
-  for (int c = 0; c < nChans; c++)
+  mOscillator.SetFreqCPS(kOctaveFrequencies[octave]);
+
+  for (int s = 0; s < nFrames; s++)
   {
-    memset(outputs[c], 0, nFrames * sizeof(sample));
+    const sample output = mOscillator.Process() * gain;
+
+    for (int c = 0; c < nChans; c++)
+    {
+      outputs[c][s] = output;
+    }
   }
 }
+
+void IPlugP5js::OnReset()
+{
+  mOscillator.SetSampleRate(GetSampleRate());
+}
 #endif
```

**File**: `Examples/IPlugP5js/IPlugP5js.h` (modified, +8/-0)
```diff
@@ -1,14 +1,18 @@
 #pragma once
 
 #include "IPlug_include_in_plug_hdr.h"
+#include "Oscillator.h"
 
 using namespace iplug;
 
 const int kNumPresets = 1;
 
+// NB: resources/web/sketch.js mirrors kOctave's index (kParamOctave) and the
+// octave count - keep them in sync if this enum changes.
 enum EParams
 {
   kGain = 0,
+  kOctave,
   kNumParams
 };
 
@@ -19,5 +23,9 @@ class IPlugP5js final : public Plugin
 
 #if IPLUG_DSP
   void ProcessBlock(sample** inputs, sample** outputs, int nFrames) override;
+  void OnReset() override;
 #endif
+
+private:
+  FastSinOscillator<sample> mOscillator {0., 110.};
 };
```

**File**: `Examples/IPlugP5js/resources/web/index.html` (modified, +19/-6)
```diff
@@ -4,16 +4,26 @@
     <meta charset="utf-8">
     <!-- <meta name="viewport" width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0> -->
     <style type="text/css">
+      html,
       body {
+        width: 100%;
+        height: 100%;
         padding: 0;
         margin: 0;
         overflow: hidden;
       }
+
+      #sketch {
+        width: 100%;
+        height: 100%;
+        overflow: hidden;
+      }
+
+      #sketch canvas {
+        display: block;
+      }
     </style>
-     <script src="p5.min.js" type="text/javascript"></script>
-     <script src="sketch.js"></script>
-    <script src="script.js"></script>
-    <title>Shader</title>
+    <title>IPlugP5js</title>
     <script>
       function OnParamChange(param, value) {
 
@@ -29,9 +39,12 @@
       
       function onLoad() {
       }
-  </script>
+    </script>
+    <script src="script.js"></script>
+    <script src="p5.min.js" type="text/javascript"></script>
+    <script src="sketch.js"></script>
   </head>
   <body onload="onLoad()">
-<!--  <p>Hello, edit the file "IPlugP5js.app/Contents/Resources/web/index.html" to change this</p>-->
+    <main id="sketch"></main>
   </body>
 </html>
```

**File**: `Examples/IPlugP5js/resources/web/script.js` (modified, +12/-6)
```diff
@@ -1,5 +1,11 @@
 // FROM DELEGATE
 
+function IPlugPostMessage(message) {
+  if (typeof IPlugSendMsg === 'function') {
+    IPlugSendMsg(message);
+  }
+}
+
 function SPVFD(paramIdx, val) {
 //  console.log("paramIdx: " + paramIdx + " value:" + val);
   OnParamChange(paramIdx, val);
@@ -39,7 +45,7 @@ function SAMFUI(msgTag, ctrlTag = -1, data = 0) {
     "data": data
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 function SMMFUI(statusByte, dataByte1, dataByte2) {
@@ -50,7 +56,7 @@ function SMMFUI(statusByte, dataByte1, dataByte2) {
     "dataByte2": dataByte2
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 // data should be a base64 encoded string
@@ -60,7 +66,7 @@ function SSMFUI(data = 0) {
     "data": data
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 function EPCFUI(paramIdx) {
@@ -69,7 +75,7 @@ function EPCFUI(paramIdx) {
     "paramIdx": paramIdx,
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 function BPCFUI(paramIdx) {
@@ -78,7 +84,7 @@ function BPCFUI(paramIdx) {
     "paramIdx": paramIdx,
   };
   
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
 
 function SPVFUI(paramIdx, value) {
@@ -88,5 +94,5 @@ function SPVFUI(paramIdx, value) {
     "value": value
   };
 
-  IPlugSendMsg(message);
+  IPlugPostMessage(message);
 }
```

**File**: `Examples/IPlugP5js/resources/web/sketch.js` (modified, +55/-5)
```diff
@@ -6,6 +6,10 @@
 
  // this variable will hold our shader object
  let theShader;
+ // Must match the kOctave enum index and the octave count in IPlugP5js.h.
+ const kParamOctave = 1;
+ const kNumOctaves = 5;
+ let lastOctave = -1;
 
  function preload(){
    // load the shader
@@ -14,24 +18,70 @@
 
  function setup() {
    // shaders require WEBGL mode to work
-   createCanvas(windowWidth, windowHeight, WEBGL);
+   const size = getSketchSize();
+   const canvas = createCanvas(size.width, size.height, WEBGL);
+   canvas.parent('sketch');
    noStroke();
  }
 
  function draw() {
    // shader() sets the active shader with our shader
    shader(theShader);
 
+   const mouseShape = getMouseShape();
+   sendOctave(getOctaveForShape(mouseShape));
+
    // lets send the resolution, mouse, and time to our shader
    // before sending mouse + time we modify the data so it's more easily usable by the shader
    theShader.setUniform('resolution', [width, height]);
-   theShader.setUniform('mouse', map(mouseX, 0, width, 0, 7));
+   theShader.setUniform('mouse', mouseShape);
    theShader.setUniform('time', frameCount * 0.01);
 
-   // rect gives us some geometry on the screen
-   rect(0,0,width, height);
+   // In WEBGL mode the origin is the centre of the canvas.
+   rect(-width / 2, -height / 2, width, height);
  }
 
 function windowResized() {
-  resizeCanvas(windowWidth, windowHeight);
+  const size = getSketchSize();
+  resizeCanvas(size.width, size.height);
+}
+
+function getSketchSize() {
+  const sketch = document.getElementById('sketch');
+  const bounds = sketch ? sketch.getBoundingClientRect() : null;
+
+  // Clamp to a min of 1: bounds and window.inner* can be 0 before layout/in headless contexts.
+  return {
+    width: Math.max(1, Math.round(bounds?.width || window.innerWidth || 1)),
+    height: Math.max(1, Math.round(bounds?.height || window.innerHeight || 1))
+  };
+}
+
+function getMouseShape() {
+  const normalizedX = Math.max(0, Math.min(1, mouseX / Math.max(1, width)));
+  return normalizedX * 7;
+}
+
+function getOctaveForShape(shape) {
+  return Math.min(kNumOctaves - 1, Math.floor((shape / 7) * kNumOctaves));
+}
+
+function sendOctave(octave) {
+  if (octave === lastOctave || typeof SPVFUI !== 'function') {
+    return;
+  }
+
+  lastOctave = octave;
+  // SPVFUI expects a 0..1 normalised value; iPlug maps it back to the enum index on the C++ side.
+  const normalizedOctave = octave / (kNumOctaves - 1);
+
+  if (typeof BPCFUI === 'function') {
+    BPCFUI(kParamOctave);
+  }
+
+  SPVFUI(kParamOctave, normalizedOctave);
+
+  if (typeof EPCFUI === 'function') {
+    EPCFUI(kParamOctave);
+  }
 }
```

---

### Incident Patch 15: `a1640b76` (2026-06-12)
**Commit Message**: Merge pull request #1375 from iPlug2/cmake/wasm-ui-dist-co-build

CMake: Improve WASM split build

**File**: `Scripts/cmake/WASMDist.cmake` (modified, +17/-0)
```diff
@@ -574,6 +574,13 @@ function(iplug_build_wasm_dsp_dist project_name)
       ${project_name}_wasm_dsp_templates
     COMMENT "Building Wasm DSP distribution for ${project_name}"
   )
+
+  # The UI dist helpers add this target to their DEPENDS when it already
+  # exists; handle the opposite call order (UI dist created first) here so
+  # the co-build wiring is order-independent.
+  if(TARGET ${project_name}-wasm-ui-dist)
+    add_dependencies(${project_name}-wasm-ui-dist ${project_name}-wasm-dsp-dist)
+  endif()
 endfunction()
 
 # ============================================================================
@@ -619,6 +626,9 @@ function(iplug_build_wasm_webview_ui_dist project_name)
   if(TARGET ${project_name}_wasm_webview_resources)
     list(APPEND UI_DEPENDS ${project_name}_wasm_webview_resources)
   endif()
+  if(TARGET ${project_name}-wasm-dsp-dist)
+    list(APPEND UI_DEPENDS ${project_name}-wasm-dsp-dist)
+  endif()
 
   add_custom_target(${project_name}-wasm-ui-dist ALL
     DEPENDS ${UI_DEPENDS}
@@ -680,6 +690,13 @@ function(iplug_build_wasm_ui_dist project_name)
   if(TARGET ${project_name}_wasm_resources)
     list(APPEND UI_DEPENDS ${project_name}_wasm_resources)
   endif()
+  # The UI bundle loads scripts/<name>-dsp.js at runtime, so make sure the
+  # DSP dist (which stages it plus -processor.js) is co-built whenever the
+  # caller has also asked for WASM_DSP. Without this dependency, building
+  # just `<name>-wasm-ui-dist` produces a staged dir that 404s at audio start.
+  if(TARGET ${project_name}-wasm-dsp-dist)
+    list(APPEND UI_DEPENDS ${project_name}-wasm-dsp-dist)
+  endif()
 
   add_custom_target(${project_name}-wasm-ui-dist ALL
     DEPENDS ${UI_DEPENDS}
```

#### Recent Merged Pull Requests:
- **PR #1406** (2026-08-19): Cmake:define CUSTOM_BUSTYPE_FUNC for IPlugSurroundEffect (@olilarkin)
- **PR #1388** (2026-07-31): ReaperExt: add WEB_RESOURCES_DIR to iplug_configure_reaperext() (@olilarkin)
- **PR #1383** (2026-07-15): Improve reaper extension support - add webview example (@olilarkin)
- **PR #1381** (2026-07-09): Reaper Extension Improvements (@olilarkin)
- **PR #1380** (2026-07-08): Improve Reaper Extension support (@olilarkin)
- **PR #1379** (2026-07-08): Cmake: Fix Reaper Extension (@olilarkin)
- **PR #1377** (closed): build(deps-dev): bump vite from 8.0.13 to 8.0.16 in /Examples/IPlugSvelteUI/web-ui (@dependabot[bot])
- **PR #1375** (2026-06-12): CMake: Improve WASM split build (@olilarkin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
