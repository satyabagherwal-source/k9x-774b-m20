# Forensic Learning Record (Deep Inspection): KunAgent/Kun

> **Canonical Artifact**: `07_PROJECT_LEARNING/kunagent-kun-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/KunAgent/Kun](https://github.com/KunAgent/Kun))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:58:24.084Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `KunAgent/Kun`
- **Description**: Local-first AI agent workspace for coding, writing, design, research, and automation — one runtime for desktop GUI and TUI.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6317 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/advanced-render-support.ts`
```
import { createHash } from 'node:crypto'
import { engineError } from './errors.js'
import {
  ADVANCED_RENDER_LIMITS,
  type AdvancedAudioCodec,
  type AdvancedEffectExecutionPlan,
  type AdvancedExportFormat,
  type AdvancedExportQuality,
  type AdvancedExportSettings,
  type AdvancedRenderCapabilities,
  type AdvancedRenderIssue,
  type GpuRenderDeviceCapabilities,
  type NegotiatedExportFormat,
  type RenderAccelerationPreference,
  type RenderPerformanceLimits
} from './advanced-render.js'
import {
  renderIrDigest,
  validateRenderIr,
  type CanonicalRenderIr,
  type RenderIrEffect
} from './render-ir.js'
import type { Rational } from './schema.js'
import { containsNullOrLineBreak } from '../text-safety.js'

type EffectCatalogEntry = {
  cpuFilter: string
  gpuFilter?: string
  complexity: number
  compile(parameters: Readonly<Record<string, number | string | boolean>>, filter: string): string
}

export const EFFECT_CATALOG: Readonly<Record<string, EffectCatalogEntry>> = Object.freeze({
  'color.basic': {
    cpuFilter: 'eq',
    complexity: 1.25,
    compile(parameters, filter) {
      const values = exactNumericParameters(parameters, {
        brightness: [-1, 1, 0],
        contrast: [0, 2, 1],
        saturation: [0, 3, 1],
        gamma: [0.1, 10, 1]
      })
      return `${filter}=brightness=${decimal(values.brightness!)}:contrast=${decimal(values.contrast!)}:` +
        `saturation=${decimal(values.saturation!)}:gamma=${decimal(values.gamma!)}`
    }
  },
  'color.temperature': {
    cpuFilter: 'colorbalance',
    complexity: 1.5,
    compile(parameters, filter) {
      const values = exactNumericParameters(parameters, {
        temperature: [-1, 1, 0],
        tint: [-1, 1, 0]
      })
      const temperature = values.temperature!
      const tint = values.tint!
      return `${filter}=rs=${decimal(temperature)}:bs=${decimal(-temperature)}:` +
        `gm=${decimal(tint)}`
    }
  },
  blur: {
    cpuFilter: 'boxblur',
    gpuFilter: 'avgblur_opencl',
    complexity: 2.5,
    compile(parameters, filter) {
      const values = exactNumericParameters(parameters, { radius: [0, 100, 2] })
      const radius = Math.max(1, Math.round(values.radius!))
      return filter === 'avgblur_opencl'
        ? `${filter}=sizeX=${radius}:sizeY=${radius}`
        : `${filter}=luma_radius=${radius}:luma_power=1:chroma_radius=${radius}:chroma_power=1`
    }
  },
  sharpen: {
    cpuFilter: 'unsharp',
    gpuFilter: 'unsharp_opencl',
    complexity: 2,
    compile(parameters, filter) {
      const values = exactNumericParameters(parameters, { amount: [0, 5, 1] })
      return filter === 'unsharp_opencl'
        ? `${filter}=luma_msize_x=5:luma_msize_y=5:luma_amount=${decimal(values.amount!)}`
        : `${filter}=5:5:${decimal(values.amount!)}:5:5:0`
    }
  },
  vignette: {
    cpuFilter: 'vignette',
    complexity: 1.75,
    compile(parameters, filter) {
      const values = exactNumericParameters(parameters, { intensity: [0, 1, 0.35] })
      const angle = Math.PI / 2 - values.intensity! * Math.PI / 3
      return `${filter}=angle=${angle.toFixed(6)}`
    }
  }
})

type EncoderCandidate = {
  encoder: string
  hardwareApi?: GpuRenderDeviceCapabilities['api']
}

export function formatCandidates(
  format: AdvancedExportFormat,
  acceleration: RenderAccelerationPreference
): EncoderCandidate[] {
  const gpu = format === 'h264-mp4'
    ? [
        { encoder: 'h264_videotoolbox', hardwareApi: 'metal' as const },
        { encoder: 'h264_nvenc', hardwareApi: 'cuda' as const },
        { encoder: 'h264_qsv', hardwareApi: 'qsv' as const },
        { encoder: 'h264_vaapi', hardwareApi: 'vaapi' as const }
      ]
    : format === 'h265-mp4'
      ? [
          { encoder: 'hevc_videotoolbox', hardwareApi: 'metal' as const },
          { encoder: 'hevc_nvenc', hardwareApi: 'cuda' as const },
          { encoder: 'hevc_qsv', hardwareApi: 'qsv' as const },
          { encoder: 'hevc_vaapi', hardwareApi: 'vaapi' as const }
        ]
      : [{ encoder: 'prores_videotoolbox', hardwareApi: 'metal' as const }]
  const cpu = format === 'h264-mp4'
    ? [{ encoder: 'libx264' }]
    : format === 'h265-mp4'
      ? [{ encoder: 'libx265' }]
      : [{ encoder: 'prores_ks' }]
  return acceleration === 'cpu' ? cpu : acceleration === 'require-gpu' ? gpu : [...gpu, ...cpu]
}

export function portableCandidates(
  format: AdvancedExportFormat,
  acceleration: RenderAccelerationPreference
): { format: NegotiatedExportFormat; candidates: EncoderCandidate[] } {
  if (format === 'prores-mov') return { format: 'ffv1-mkv', candidates: [{ encoder: 'ffv1' }] }
  if (format === 'h265-mp4') return { format: 'h264-mp4', candidates: formatCandidates('h264-mp4', acceleration) }
  return { format: 'ffv1-mkv', candidates: [{ encoder: 'ffv1' }] }
}

export function selectEncoder(
  candidates: readonly EncoderCandidate[],
  capabilities: AdvancedRenderCapabilities,
  acceleration: RenderAccelerationPreference,
  workload: { pixelsPerFrame: number; fps: number }
): { encoder: string; device?: GpuRenderDeviceCapabilities } | undefined {
  for (const candidate of candidates) {
    if (!capabilities.encoders.includes(candidate.encoder)) continue
    if (!candidate.hardwareApi) {
      if (acceleration === 'require-gpu') continue
      return { encoder: candidate.encoder }
    }
    const device = capabilities.gpuDevices.find((entry) =>
      entry.api === candidate.hardwareApi &&
      entry.encoders.includes(candidate.encoder) &&
      workload.pixelsPerFrame <= entry.maxPixelsPerFrame &&
      workload.fps <= entry.maxFps)
    if (device) return { encoder: candidate.encoder, device }
  }
  return undefined
}

export function videoEncoderArgs(
  encoder: string,
  format: NegotiatedExportFormat,
  quality: AdvancedExportQuality
): string[] {
  if (encoder === 'libx264' || encoder === 'libx265') {
    const crf = quality === 'draft' ? 30 : quality === 'balanced' ? 24 : quality === 'high' ? 19 : 14
    const preset = quality === 'draft' ? 'fast' : quality === 'master' ? 'slow' : 'medium'
    return [
      '-c:v', encoder,
      '-preset', preset,
      '-crf', String(crf),
      '-pix_fmt', 'yuv420p',
      ...(encoder === 'libx265' ? ['-tag:v', 'hvc1'] : [])
    ]
  }
  if (encoder === 'prores_ks' || encoder === 'prores_videotoolbox') {
    const profile = quality === 'draft' ? '0' : quality === 'balanced' ? '1' : quality === 'high' ? '2' : '3'
    return ['-c:v', encoder, '-profile:v', profile, '-pix_fmt', 'yuv422p10le']
  }
  if (encoder === 'ffv1') return ['-c:v', 'ffv1', '-level', '3', '-coder', '1', '-context', '1', '-pix_fmt', 'yuv422p10le']
  const qualityValue = quality === 'draft' ? '45' : quality === 'balanced' ? '60' : quality === 'high' ? '75' : '90'
  const base = ['-c:v', encoder, '-q:v', qualityValue, '-pix_fmt', 'yuv420p']
  return format === 'h265-mp4' ? [...base, '-tag:v', 'hvc1'] : base
}

export function audioArgs(audio: NonNullable<AdvancedExportSettings['audio']>): string[] {
  const encoder = audioEncoderFor(audio.codec)
  return [
    '-c:a', encoder,
    '-ar', String(audio.sampleRate),
    '-ac', String(audio.channels),
    ...(audio.codec === 'aac' ? ['-b:a', `${audio.bitrateKbps ?? 192}k`] : [])
  ]
}

export function audioEncoderFor(codec: AdvancedAudioCodec): string {
  return codec === 'pcm-s24' ? 'pcm_s24le' : codec
}

export function muxerFor(format: NegotiatedExportFormat): 'mp4' | 'mov' | 'matroska' {
  return format === 'prores-mov' ? 'mov' : format === 'ffv1-mkv' ? 'matroska' : 'mp4'
}

export function extensionFor(format: NegotiatedExportFormat): 'mp4' | 'mov' | 'mkv' {
  return format === 'prores-mov' ? 'mov' : format === 'ffv1-mkv' ? 'mkv' : 'mp4'
}

export function mimeFor(format: NegotiatedExportFormat): 'video/mp4' | 'video/quicktime' | 'video/x-matroska' {
  return format === 'prores-mov'
    ? 'video/quicktime'
    : format === 'ffv1-mkv'
      ? 'video/x-matroska'
      : 'video/mp4'
}

export function renderPerformance(
  ir: CanonicalRenderIr,
  effects: readonly RenderIrEffect[]
): AdvancedEffectExecutionPlan['performance'] {
  const width = ir.canvas.width
  const height = ir.canvas.height
  const fps = rationalValue(ir.fps)
  const durationFrames = ir.range.endFrame - ir.range.startFrame
  const megapixelFrames = width * height / 1_000_000 * durationFrames
  const complexity = effects.reduce((total, effect) => total + (EFFECT_CATALOG[effect.type]?.complexity ?? 4), 1)
  return {
    width,
    height,
    fps,
    durationFrames,
    effectNodes: effects.length,
    megapixelFrames,
    weightedMegapixelFrames: megapixelFrames * complexity
  }
}

export function addPerformanceIssues(
  ir: CanonicalRenderIr,
  limits: RenderPerformanceLimits,
  metrics: AdvancedEffectExecutionPlan['performance'],
  issues: AdvancedRenderIssue[]
): void {
  const checks: Array<[boolean, string, string, string]> = [
    [metrics.width <= limits.maxWidth, 'limit:width', `Output width ${metrics.width} exceeds ${limits.maxWidth}.`, 'Reduce output width or use a backend with a larger frame limit.'],
    [metrics.height <= limits.maxHeight, 'limit:height', `Output height ${metrics.height} exceeds ${limits.maxHeight}.`, 'Reduce output height or use a backend with a larger frame limit.'],
    [metrics.width * metrics.height <= limits.maxPixelsPerFrame, 'limit:pixels', 'Output pixels per frame exceed the backend limit.', 'Reduce resolution or use a higher-capacity backend.'],
    [metrics.fps <= limits.maxFps, 'limit:fps', `Output frame rate ${metrics.fps} exceeds ${limits.maxFps}.`, 'Reduce frame rate or use a backend with a higher frame-rate limit.'],
    [metrics.durationFrames <= limits.maxDurationFrames, 'limit:duration', 'Render duration exceeds the backend frame limit.', 'Split the render range or use a backend with a larger duration limit.'],
    [metrics.effectNodes <= limits.maxEffectNodes, 'limit:effects', 'Enabled effect count exceeds the backend limit.', 'Disable or bake effects before rendering.'],
    [metrics.weightedM
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/advanced-render.ts`
```
import { createHash } from 'node:crypto'
import { engineError } from './errors.js'
import {
  EFFECT_CATALOG,
  addPerformanceIssues,
  audioArgs,
  audioEncoderFor,
  decimal,
  digest,
  exactNumericParameters,
  extensionFor,
  formatCandidates,
  invalid,
  mimeFor,
  muxerFor,
  normalizedStrings,
  portableCandidates,
  pushIssue,
  rationalValue,
  renderIssue,
  renderPerformance,
  selectEncoder,
  validateCapabilities,
  validateExportSettings,
  videoEncoderArgs
} from './advanced-render-support.js'
import {
  renderIrDigest,
  validateRenderIr,
  type CanonicalRenderIr,
  type RenderIrEffect
} from './render-ir.js'
import type { Rational } from './schema.js'
import { containsNullOrLineBreak } from '../text-safety.js'

export const ADVANCED_RENDER_LIMITS = Object.freeze({
  capabilityEntries: 256,
  gpuDevices: 8,
  effectNodes: 128,
  issues: 64,
  width: 16_384,
  height: 16_384,
  fps: 240,
  audioChannels: 16,
  canonicalBytes: 256 * 1024
})

export type RenderAccelerationPreference = 'cpu' | 'prefer-gpu' | 'require-gpu'
export type AdvancedExportFormat = 'h264-mp4' | 'h265-mp4' | 'prores-mov'
export type NegotiatedExportFormat = AdvancedExportFormat | 'ffv1-mkv'
export type AdvancedExportQuality = 'draft' | 'balanced' | 'high' | 'master'
export type AdvancedAudioCodec = 'aac' | 'pcm-s24' | 'flac'

export type RenderPerformanceLimits = {
  maxWidth: number
  maxHeight: number
  maxPixelsPerFrame: number
  maxFps: number
  maxDurationFrames: number
  maxEffectNodes: number
  maxMegapixelFrames: number
}

export type GpuRenderDeviceCapabilities = {
  id: string
  api: 'metal' | 'cuda' | 'opencl' | 'qsv' | 'vaapi'
  filters: string[]
  encoders: string[]
  maxPixelsPerFrame: number
  maxFps: number
}

export type AdvancedRenderCapabilities = {
  id: string
  version: string
  encoders: string[]
  muxers: string[]
  filters: string[]
  effects: string[]
  colorSpaces: string[]
  gpuDevices: GpuRenderDeviceCapabilities[]
  limits: RenderPerformanceLimits
}

export type AdvancedRenderIssue = {
  nodeId: string
  capability: string
  message: string
  guidance: string
}

export type AdvancedEffectStep = {
  effectId: string
  effectType: string
  filter: string
  complexity: number
}

export type AdvancedEffectLayerPlan = {
  layerId: string
  engine: 'cpu' | 'gpu'
  deviceId?: string
  filters: AdvancedEffectStep[]
  filterChain: string
}

export type AdvancedEffectExecutionPlan = {
  supported: boolean
  target: 'preview' | 'export'
  projectId: string
  sequenceId: string
  revision: number
  renderIrDigest: string
  capabilitiesDigest: string
  renderSemanticsDigest: string
  acceleration: {
    requested: RenderAccelerationPreference
    selected: 'cpu' | 'gpu'
    deviceId?: string
    fellBackToCpu: boolean
  }
  performance: {
    width: number
    height: number
    fps: number
    durationFrames: number
    effectNodes: number
    megapixelFrames: number
    weightedMegapixelFrames: number
  }
  layers: AdvancedEffectLayerPlan[]
  warnings: AdvancedRenderIssue[]
  issues: AdvancedRenderIssue[]
}

export type AdvancedExportSettings = {
  format: AdvancedExportFormat
  width: number
  height: number
  frameRate: Rational
  quality: AdvancedExportQuality
  acceleration: RenderAccelerationPreference
  allowPortableEquivalent?: boolean
  audio?: {
    codec: AdvancedAudioCodec
    sampleRate: 44_100 | 48_000 | 96_000
    channels: number
    bitrateKbps?: number
  }
}

export type AdvancedExportCapabilityEvidence = {
  requestedFormat: AdvancedExportFormat
  selectedFormat?: NegotiatedExportFormat
  selectedEncoder?: string
  selectedMuxer?: string
  encoderCandidates: string[]
  advertisedEncoders: string[]
  advertisedMuxers: string[]
  gpuDeviceId?: string
  portableEquivalent: boolean
}

export type AdvancedExportPlan = {
  supported: boolean
  projectId: string
  sequenceId: string
  revision: number
  renderIrDigest: string
  capabilitiesDigest: string
  settingsDigest: string
  requested: AdvancedExportSettings
  selected?: {
    format: NegotiatedExportFormat
    encoder: string
    muxer: string
    extension: 'mp4' | 'mov' | 'mkv'
    mime: 'video/mp4' | 'video/quicktime' | 'video/x-matroska'
    hardwareAccelerated: boolean
    gpuDeviceId?: string
    videoFilterSuffix: string[]
    videoArgs: string[]
    audioArgs: string[]
    muxerArgs: string[]
  }
  capabilityEvidence: AdvancedExportCapabilityEvidence
  warnings: AdvancedRenderIssue[]
  issues: AdvancedRenderIssue[]
}

export function baselineAdvancedFfmpegCapabilities(): AdvancedRenderCapabilities {
  return {
    id: 'ffmpeg',
    version: 'negotiated',
    encoders: ['aac', 'ffv1', 'flac', 'libx264', 'libx265', 'pcm_s24le', 'prores_ks'],
    muxers: ['matroska', 'mov', 'mp4'],
    filters: ['avgblur_opencl', 'boxblur', 'colorbalance', 'eq', 'unsharp', 'unsharp_opencl', 'vignette'],
    effects: Object.keys(EFFECT_CATALOG).sort(),
    colorSpaces: ['bt709'],
    gpuDevices: [],
    limits: {
      maxWidth: 8_192,
      maxHeight: 8_192,
      maxPixelsPerFrame: 33_554_432,
      maxFps: 120,
      maxDurationFrames: 2_592_000,
      maxEffectNodes: ADVANCED_RENDER_LIMITS.effectNodes,
      maxMegapixelFrames: 20_000_000
    }
  }
}

export function advancedRenderCapabilitiesDigest(capabilities: AdvancedRenderCapabilities): string {
  validateCapabilities(capabilities)
  return digest({
    ...capabilities,
    encoders: normalizedStrings(capabilities.encoders),
    muxers: normalizedStrings(capabilities.muxers),
    filters: normalizedStrings(capabilities.filters),
    effects: normalizedStrings(capabilities.effects),
    colorSpaces: normalizedStrings(capabilities.colorSpaces),
    gpuDevices: [...capabilities.gpuDevices]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((device) => ({
        ...device,
        filters: normalizedStrings(device.filters),
        encoders: normalizedStrings(device.encoders)
      }))
  })
}

export function negotiateAdvancedEffects(
  ir: CanonicalRenderIr,
  capabilities: AdvancedRenderCapabilities,
  request: {
    target: 'preview' | 'export'
    acceleration: RenderAccelerationPreference
  }
): AdvancedEffectExecutionPlan {
  validateRenderIr(ir)
  validateCapabilities(capabilities)
  if (!['preview', 'export'].includes(request.target)) invalid('Advanced effect target is invalid')
  if (!['cpu', 'prefer-gpu', 'require-gpu'].includes(request.acceleration)) {
    invalid('Advanced effect acceleration preference is invalid')
  }
  const issues: AdvancedRenderIssue[] = []
  const warnings: AdvancedRenderIssue[] = []
  const enabled = ir.layers.flatMap((layer) => layer.effects
    .filter((effect) => effect.enabled)
    .map((effect) => ({ layerId: layer.id, effect })))
  const metrics = renderPerformance(ir, enabled.map(({ effect }) => effect))
  addPerformanceIssues(ir, capabilities.limits, metrics, issues)
  if (!capabilities.colorSpaces.includes(ir.canvas.colorSpace)) {
    pushIssue(issues, renderIssue(
      'canvas', `color-space:${ir.canvas.colorSpace}`,
      `Backend ${capabilities.id} does not advertise ${ir.canvas.colorSpace} output.`,
      'Select a color-managed backend or explicitly convert the project before export.'
    ))
  }
  const cpuAvailable = enabled.every(({ effect }) => {
    const catalog = EFFECT_CATALOG[effect.type]
    return Boolean(catalog && capabilities.effects.includes(effect.type) && capabilities.filters.includes(catalog.cpuFilter))
  })
  const gpuDevice = request.acceleration === 'cpu'
    ? undefined
    : capabilities.gpuDevices.find((device) =>
      metrics.width * metrics.height <= device.maxPixelsPerFrame &&
      metrics.fps <= device.maxFps &&
      enabled.every(({ effect }) => {
        const catalog = EFFECT_CATALOG[effect.type]
        return Boolean(
          catalog?.gpuFilter &&
          capabilities.effects.includes(effect.type) &&
          device.filters.includes(catalog.gpuFilter)
        )
      }))
  if (request.acceleration === 'require-gpu' && !gpuDevice && enabled.length > 0) {
    pushIssue(issues, renderIssue(
      'backend', 'acceleration:gpu',
      'No single advertised GPU device can execute every enabled effect within its performance limits.',
      'Use prefer-gpu to allow the deterministic CPU fallback, simplify effects, or select another device.'
    ))
  }
  if (!cpuAvailable && !gpuDevice) {
    for (const { layerId, effect } of enabled) {
      const catalog = EFFECT_CATALOG[effect.type]
      if (!catalog) {
        pushIssue(issues, renderIssue(
          effect.id, `effect:${effect.type}`,
          `Effect ${effect.type} on ${layerId} is outside the bounded advanced-effect catalog.`,
          'Disable the effect, bake it to a proxy, or install an adapter that explicitly implements it.'
        ))
      } else if (!capabilities.effects.includes(effect.type)) {
        pushIssue(issues, renderIssue(
          effect.id, `effect:${effect.type}`,
          `Backend ${capabilities.id} does not advertise effect ${effect.type}.`,
          'Select a backend advertising the effect or disable it.'
        ))
      } else if (!capabilities.filters.includes(catalog.cpuFilter)) {
        pushIssue(issues, renderIssue(
          effect.id, `filter:${catalog.cpuFilter}`,
          `The CPU fallback for ${effect.type} requires ${catalog.cpuFilter}.`,
          `Install an FFmpeg build with ${catalog.cpuFilter} or use a compatible GPU device.`
        ))
      }
    }
  }
  const selectedGpu = Boolean(gpuDevice && request.acceleration !== 'cpu' && issues.length === 0)
  const fellBackToCpu = request.acceleration === 'prefer-gpu' && enabled.length > 0 && !selectedGpu
  if (fellBackToCpu && cpuAvailable) {
    warnings.push(renderIssue(
      'backend', 'fallback:cpu',
      'The requested GPU path cannot execute the complete effect chain; the entire chain will use the deterministic CPU fallback.',
      'This is expected and preserves preview/export semantics; choose a capable GPU backend to accelerate i
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/audio-analysis-beats-sync.ts`
```
import { engineError } from './errors.js'
import type {
  Caption,
  SpeakerAttributionEvidence,
  SourceIdentity,
  TimelineOperation,
  TranscriptSegment,
  VideoProject
} from './schema.js'
import { applyTimelineOperations } from './timeline.js'
import { microsecondsToFrames } from './time.js'
import { containsAsciiControlCharacters } from '../text-safety.js'
import type {
  AudioSyncAnalysis,
  AudioSyncPlan,
  AudioSyncPreview,
  BeatAnalysisRecord,
  BeatMarker,
  BeatObservation,
  BeatSnapTarget,
  LocalAnalysisProvenance
} from './audio-analysis-model.js'
import {
  assertFingerprint,
  boundedInteger,
  boundedString,
  confidence,
  correlationAtLag,
  deepFreeze,
  identifier,
  provenance,
  seededCandidates,
  stableDigest64,
  stableKey,
  validateFeatureSeries
} from './audio-analysis-support.js'

export function analyzeBeatEvidence(input: {
  assetId: string
  sourceFingerprint: SourceIdentity
  observations: readonly BeatObservation[]
  beatThreshold?: number
  downbeatThreshold?: number
  tempoBpm?: number
  completeness?: 'complete' | 'partial'
  adapterId?: string
  adapterVersion?: string
  modelId?: string
  now?: () => Date
}): BeatAnalysisRecord {
  identifier(input.assetId, 'assetId')
  assertFingerprint(input.sourceFingerprint)
  const beatThreshold = confidence(input.beatThreshold ?? 0.65, 'beatThreshold')
  const downbeatThreshold = confidence(input.downbeatThreshold ?? 0.75, 'downbeatThreshold')
  const seen = new Set<string>()
  let previousUs = -1
  const markers: BeatMarker[] = []
  for (const observation of input.observations) {
    identifier(observation.id, 'beat observation ID')
    if (seen.has(observation.id)) throw engineError('invalid_operation', 'Beat observation IDs must be unique')
    seen.add(observation.id)
    boundedInteger(observation.timeUs, 0, Number.MAX_SAFE_INTEGER, `time for ${observation.id}`)
    if (observation.timeUs < previousUs) throw engineError('invalid_operation', 'Beat observations must be ordered')
    previousUs = observation.timeUs
    confidence(observation.strength, `strength for ${observation.id}`)
    confidence(observation.beatProbability, `beat probability for ${observation.id}`)
    if (observation.downbeatProbability !== undefined) confidence(observation.downbeatProbability, `downbeat probability for ${observation.id}`)
    const isDownbeat = (observation.downbeatProbability ?? 0) >= downbeatThreshold
    if (!isDownbeat && observation.beatProbability < beatThreshold) continue
    markers.push({
      id: `marker:${observation.id}`,
      assetId: input.assetId,
      sourceUs: observation.timeUs,
      kind: isDownbeat ? 'downbeat' : 'beat',
      confidence: Number((isDownbeat ? observation.downbeatProbability! : observation.beatProbability).toFixed(6)),
      strength: observation.strength
    })
  }
  if (input.tempoBpm !== undefined && (!Number.isFinite(input.tempoBpm) || input.tempoBpm < 20 || input.tempoBpm > 400)) {
    throw engineError('invalid_operation', 'Tempo must be from 20 through 400 BPM')
  }
  const recordProvenance = provenance({
    assetId: input.assetId,
    sourceFingerprint: input.sourceFingerprint,
    adapterId: input.adapterId ?? 'kun.local.beat-evidence',
    adapterVersion: input.adapterVersion ?? '1.0.0',
    modelId: input.modelId,
    algorithm: 'thresholded-beat-marker',
    algorithmVersion: '1.0.0',
    parameters: [beatThreshold, downbeatThreshold, input.tempoBpm ?? 'unknown'],
    now: input.now
  })
  return deepFreeze({
    schemaVersion: 1,
    id: `analysis:beats:${recordProvenance.cacheKey}`,
    kind: 'beat-grid',
    assetId: input.assetId,
    provenance: recordProvenance,
    ...(input.tempoBpm === undefined ? {} : { tempoBpm: input.tempoBpm }),
    markers,
    completeness: input.completeness ?? 'complete',
    immutable: true
  })
}

export function beatSnapTargets(project: VideoProject, record: BeatAnalysisRecord): BeatSnapTarget[] {
  const targets: BeatSnapTarget[] = []
  for (const item of project.items.filter(({ assetId }) => assetId === record.assetId)) {
    for (const marker of record.markers) {
      if (marker.sourceUs < item.sourceStartUs || marker.sourceUs >= item.sourceEndUs) continue
      const sourceDelta = marker.sourceUs - item.sourceStartUs
      const timelineUs = Math.round(sourceDelta * item.speed.denominator / item.speed.numerator)
      targets.push({
        id: `snap:${item.id}:${marker.id}`,
        itemId: item.id,
        assetId: record.assetId,
        frame: item.timelineStartFrame + microsecondsToFrames(timelineUs, project.fps),
        kind: marker.kind,
        confidence: marker.confidence,
        sourceUs: marker.sourceUs
      })
    }
  }
  return targets.sort((left, right) => left.frame - right.frame || left.id.localeCompare(right.id)).slice(0, 10_000)
}

export function beatEvidenceWindow(
  record: BeatAnalysisRecord,
  offset = 0,
  limit = 100
): {
  analysisId: string
  assetId: string
  markers: BeatMarker[]
  nextOffset?: number
  total: number
  completeness: BeatAnalysisRecord['completeness']
  provenance: LocalAnalysisProvenance
} {
  offset = boundedInteger(offset, 0, 1_000_000, 'offset')
  limit = boundedInteger(limit, 1, 500, 'limit')
  const markers = record.markers.slice(offset, offset + limit)
  const nextOffset = offset + markers.length
  return {
    analysisId: record.id,
    assetId: record.assetId,
    markers,
    ...(nextOffset < record.markers.length ? { nextOffset } : {}),
    total: record.markers.length,
    completeness: record.completeness,
    provenance: structuredClone(record.provenance)
  }
}

export function analyzeAudioSynchronization(input: {
  referenceAssetId: string
  targetAssetId: string
  referenceFeatures: readonly number[]
  targetFeatures: readonly number[]
  samplePeriodUs: number
  maximumOffsetUs: number
  seed: number
  threshold?: number
  minimumSeparation?: number
  referenceFingerprint: SourceIdentity
  targetFingerprint: SourceIdentity
  adapterId?: string
  adapterVersion?: string
  now?: () => Date
}): AudioSyncAnalysis {
  identifier(input.referenceAssetId, 'referenceAssetId')
  identifier(input.targetAssetId, 'targetAssetId')
  if (input.referenceAssetId === input.targetAssetId) throw engineError('invalid_operation', 'Audio sync requires two different assets')
  assertFingerprint(input.referenceFingerprint)
  assertFingerprint(input.targetFingerprint)
  const samplePeriodUs = boundedInteger(input.samplePeriodUs, 1, 10_000_000, 'samplePeriodUs')
  const maximumOffsetUs = boundedInteger(input.maximumOffsetUs, 0, 3_600_000_000, 'maximumOffsetUs')
  const seed = boundedInteger(input.seed, 0, 0x7fffffff, 'seed')
  const threshold = confidence(input.threshold ?? 0.82, 'sync threshold')
  const minimumSeparation = confidence(input.minimumSeparation ?? 0.03, 'sync minimum separation')
  validateFeatureSeries(input.referenceFeatures, 'referenceFeatures')
  validateFeatureSeries(input.targetFeatures, 'targetFeatures')
  const maxLag = Math.floor(maximumOffsetUs / samplePeriodUs)
  const candidates = seededCandidates(maxLag, seed)
  const ranked = candidates.flatMap((lag, rank) => {
    const correlation = correlationAtLag(input.referenceFeatures, input.targetFeatures, lag)
    return correlation === undefined ? [] : [{ lag, correlation, rank }]
  }).sort((left, right) =>
    right.correlation - left.correlation || left.rank - right.rank || Math.abs(left.lag) - Math.abs(right.lag)
  )
  const best = ranked[0]
  if (!best) throw engineError('invalid_operation', 'Audio feature evidence has insufficient overlap for synchronization')
  const runnerUp = ranked.find(({ lag }) => Math.abs(lag - best.lag) > 1) ?? ranked[1]
  const bestCorrelation = Number(best.correlation.toFixed(8))
  const runnerUpCorrelation = Number((runnerUp?.correlation ?? -1).toFixed(8))
  const syncConfidence = Number(Math.max(0, Math.min(1, (best.correlation + 1) / 2)).toFixed(8))
  const separation = Number(Math.max(0, best.correlation - (runnerUp?.correlation ?? -1)).toFixed(8))
  const refusalReason = syncConfidence < threshold
    ? 'confidence-below-threshold' as const
    : separation < minimumSeparation
      ? 'ambiguous-correlation' as const
      : undefined
  const combinedFingerprint = combineAudioSourceFingerprints(
    input.referenceFingerprint,
    input.targetFingerprint
  )
  const analysisProvenance = provenance({
    assetId: `${input.referenceAssetId}:${input.targetAssetId}`,
    sourceFingerprint: combinedFingerprint,
    adapterId: input.adapterId ?? 'kun.local.audio-feature-correlation',
    adapterVersion: input.adapterVersion ?? '1.0.0',
    algorithm: 'seeded-normalized-cross-correlation',
    algorithmVersion: '1.0.0',
    parameters: [samplePeriodUs, maximumOffsetUs, seed, threshold, minimumSeparation],
    now: input.now
  })
  return deepFreeze({
    schemaVersion: 1,
    id: audioSyncAnalysisId({
      referenceAssetId: input.referenceAssetId,
      targetAssetId: input.targetAssetId,
      referenceFingerprint: input.referenceFingerprint,
      targetFingerprint: input.targetFingerprint,
      samplePeriodUs,
      maximumOffsetUs,
      seed,
      threshold,
      minimumSeparation,
      adapterId: input.adapterId,
      adapterVersion: input.adapterVersion
    }),
    kind: 'audio-sync',
    referenceAssetId: input.referenceAssetId,
    targetAssetId: input.targetAssetId,
    seed,
    samplePeriodUs,
    candidateCount: ranked.length,
    proposedTargetDeltaUs: -best.lag * samplePeriodUs,
    bestCorrelation,
    runnerUpCorrelation,
    confidence: syncConfidence,
    separation,
    threshold,
    minimumSeparation,
    outcome: refusalReason ? 'uncertain' : 'ready',
    ...(refusalReason ? { refusalReason } : {}),
    provenance: analysisProvenance,
    immutable: true
  })
}

export function audioSyncAnalysisId(input: {
  referenceAssetId: string
  targetAssetId: string
  referenceFingerprint: SourceIdentity
  targetFingerprint: SourceIdentity
  samplePeriodUs: number
  maximumOffsetUs: num
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/audio-analysis-model.ts`
```
import { engineError } from './errors.js'
import type {
  Caption,
  SpeakerAttributionEvidence,
  SourceIdentity,
  TimelineOperation,
  TranscriptSegment,
  VideoProject
} from './schema.js'
import { applyTimelineOperations } from './timeline.js'
import { microsecondsToFrames } from './time.js'
import { containsAsciiControlCharacters } from '../text-safety.js'
import { negotiateSpeakerAdapter } from './audio-analysis-vad-speakers.js'
import {
  boundedSpeakerLabel,
  deepFreeze,
  identifier,
  validIsoTimestamp,
  validateSpeakerDiarizationAdapterStatus
} from './audio-analysis-support.js'

export type LocalAnalysisProvenance = {
  adapterId: string
  adapterVersion: string
  modelId?: string
  modelVersion?: string
  algorithm: string
  algorithmVersion: string
  sourceFingerprint: SourceIdentity
  local: true
  networkUsed: false
  createdAt: string
  cacheKey: string
  execution: 'local' | 'import'
}

export type VadFrameEvidence = {
  id: string
  startUs: number
  endUs: number
  speechProbability: number
}

export type SilenceSuggestion = {
  id: string
  assetId: string
  sourceRange: { assetId: string; startUs: number; endUs: number }
  confidence: number
  disposition: 'safe-to-suggest' | 'review-required'
  reason: 'vad-silence'
}

export type VadAnalysisRecord = {
  schemaVersion: 1
  id: string
  kind: 'vad'
  assetId: string
  provenance: LocalAnalysisProvenance
  speechThreshold: number
  suggestionConfidenceThreshold: number
  frames: VadFrameEvidence[]
  silence: SilenceSuggestion[]
  completeness: 'complete' | 'partial'
  immutable: true
}

export type SpeakerModelDescriptor = {
  adapterId: string
  adapterVersion: string
  modelId: string
  modelVersion: string
  embeddingDimensions: number
}

export type SpeakerAdapterCapability =
  | {
      outcome: 'ready'
      adapter: SpeakerModelDescriptor & { execution: 'local' }
      networkUsedForInference: false
    }
  | {
      outcome: 'unavailable'
      code: 'speaker_model_disabled' | 'speaker_model_unverified' | 'speaker_inference_broker_unavailable'
      retryable: boolean
      remediation: string
      networkUsedForInference: false
    }

export type SpeakerRegistryEntry = {
  id: string
  label: string
  embedding: number[]
  adapterId: string
  modelId: string
  sourceEvidenceIds: string[]
  createdAt: string
}

export type SpeakerIdentity = {
  id: string
  label: string
  aliases: string[]
  sourceEvidenceIds: string[]
  createdAt: string
  updatedAt: string
}

export type SpeakerDiarizationAdapterDescriptor = {
  id: string
  version: string
  execution: 'local-model' | 'import'
  format?: 'kun-speaker-json-v1'
  modelId?: string
  modelVersion?: string
}

export type SpeakerDiarizationAdapterStatus =
  | {
      descriptor: SpeakerDiarizationAdapterDescriptor
      outcome: 'ready'
      local: true
      networkUsed: false
    }
  | {
      descriptor: SpeakerDiarizationAdapterDescriptor
      outcome: 'unavailable'
      code: 'speaker_inference_broker_unavailable' | 'speaker_model_unverified'
      remediation: string
      local: true
      networkUsed: false
    }

export type ImportedDiarizationTurn = {
  id: string
  startUs: number
  endUs: number
  status: 'identified' | 'unknown' | 'overlap'
  speakerId?: string
  overlapSpeakerIds?: string[]
  confidence: number
  sourceEvidenceIds?: string[]
}

export class SpeakerIdentityRegistry {
  private readonly entries = new Map<string, SpeakerIdentity>()

  constructor(entries: readonly SpeakerIdentity[] = []) {
    for (const entry of entries) this.upsert(entry)
  }

  upsert(entry: SpeakerIdentity): SpeakerIdentity {
    identifier(entry.id, 'speaker identity ID')
    const label = boundedSpeakerLabel(entry.label, 'speaker identity label')
    const aliases = [...new Set(entry.aliases.map((alias) => boundedSpeakerLabel(alias, 'speaker alias')))]
      .filter((alias) => alias !== label)
      .slice(0, 32)
    const sourceEvidenceIds = [...new Set(entry.sourceEvidenceIds.map((id) => {
      identifier(id, 'speaker source evidence ID')
      return id
    }))].slice(0, 256)
    const existing = this.entries.get(entry.id)
    const normalized: SpeakerIdentity = deepFreeze({
      id: entry.id,
      label,
      aliases,
      sourceEvidenceIds,
      createdAt: existing?.createdAt ?? validIsoTimestamp(entry.createdAt, 'speaker createdAt'),
      updatedAt: validIsoTimestamp(entry.updatedAt, 'speaker updatedAt')
    })
    this.entries.set(entry.id, normalized)
    return structuredClone(normalized)
  }

  get(id: string): SpeakerIdentity | undefined {
    const entry = this.entries.get(id)
    return entry ? structuredClone(entry) : undefined
  }

  list(): SpeakerIdentity[] {
    return [...this.entries.values()]
      .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
      .map((entry) => structuredClone(entry))
  }
}

export class SpeakerDiarizationAdapterRegistry {
  private readonly entries = new Map<string, SpeakerDiarizationAdapterStatus>()

  constructor(entries: readonly SpeakerDiarizationAdapterStatus[] = []) {
    for (const entry of entries) this.register(entry)
  }

  register(entry: SpeakerDiarizationAdapterStatus): void {
    validateSpeakerDiarizationAdapterStatus(entry)
    if (this.entries.has(entry.descriptor.id)) {
      throw engineError('invalid_operation', `Speaker adapter already exists: ${entry.descriptor.id}`)
    }
    this.entries.set(entry.descriptor.id, deepFreeze(structuredClone(entry)))
  }

  list(): SpeakerDiarizationAdapterStatus[] {
    return [...this.entries.values()]
      .sort((left, right) => left.descriptor.id.localeCompare(right.descriptor.id))
      .map((entry) => structuredClone(entry))
  }

  requireReady(id: string): Extract<SpeakerDiarizationAdapterStatus, { outcome: 'ready' }> {
    const entry = this.entries.get(id)
    if (!entry) throw engineError('invalid_operation', `Speaker adapter is not registered: ${id}`)
    if (entry.outcome !== 'ready') {
      throw engineError('invalid_operation', entry.remediation ?? `Speaker adapter is unavailable: ${id}`)
    }
    return structuredClone(entry) as Extract<SpeakerDiarizationAdapterStatus, { outcome: 'ready' }>
  }
}

export function defaultSpeakerDiarizationAdapterRegistry(input: {
  localDescriptor?: SpeakerModelDescriptor
  localInstallationVerified?: boolean
  localInferenceBrokerAvailable?: boolean
} = {}): SpeakerDiarizationAdapterRegistry {
  const entries: SpeakerDiarizationAdapterStatus[] = [{
    descriptor: {
      id: 'kun.imported-speaker-labels',
      version: '1.0.0',
      execution: 'import',
      format: 'kun-speaker-json-v1'
    },
    outcome: 'ready',
    local: true,
    networkUsed: false
  }]
  if (input.localDescriptor) {
    const capability = negotiateSpeakerAdapter({
      optIn: true,
      descriptor: input.localDescriptor,
      installationVerified: input.localInstallationVerified === true,
      inferenceBrokerAvailable: input.localInferenceBrokerAvailable === true
    })
    entries.push(capability.outcome === 'ready'
      ? {
          descriptor: {
            id: capability.adapter.adapterId,
            version: capability.adapter.adapterVersion,
            execution: 'local-model',
            modelId: capability.adapter.modelId,
            modelVersion: capability.adapter.modelVersion
          },
          outcome: 'ready', local: true, networkUsed: false
        }
      : {
          descriptor: {
            id: input.localDescriptor.adapterId,
            version: input.localDescriptor.adapterVersion,
            execution: 'local-model',
            modelId: input.localDescriptor.modelId,
            modelVersion: input.localDescriptor.modelVersion
          },
          outcome: 'unavailable',
          code: capability.code === 'speaker_model_disabled'
            ? 'speaker_model_unverified'
            : capability.code,
          remediation: capability.remediation,
          local: true,
          networkUsed: false
        })
  }
  return new SpeakerDiarizationAdapterRegistry(entries)
}

export type SpeakerMatch = {
  speakerId?: string
  label?: string
  confidence: number
  runnerUpConfidence?: number
  uncertain: boolean
  reason?: 'below-threshold' | 'ambiguous' | 'empty-registry' | 'unknown-speaker' | 'overlap' | 'import-low-confidence'
}

export type DiarizationTurnEvidence = {
  id: string
  startUs: number
  endUs: number
  embedding: number[]
  adapterConfidence: number
}

export type DiarizationTurn = {
  id: string
  startUs: number
  endUs: number
  speakerId?: string
  speakerLabel?: string
  confidence: number
  uncertain: boolean
  status?: SpeakerAttributionEvidence['status']
  overlapSpeakerIds?: string[]
  sourceEvidenceIds?: string[]
  reason?: SpeakerMatch['reason']
}

export type DiarizationRecord = {
  schemaVersion: 1
  id: string
  kind: 'speaker-diarization'
  assetId: string
  provenance: LocalAnalysisProvenance
  turns: DiarizationTurn[]
  uncertainTurnCount: number
  completeness: 'complete' | 'partial'
  immutable: true
}

export type SpeakerAttribution = {
  analysisId: string
  speakerId?: string
  speakerLabel?: string
  confidence: number
  uncertain: boolean
  status: SpeakerAttributionEvidence['status']
  sourceTurnIds: string[]
}

export type SpeakerAttributionPlan = {
  schemaVersion: 1
  projectId: string
  expectedRevision: number
  analysisId: string
  transcriptSegments: Array<SpeakerAttribution & { transcriptId: string; segmentId: string }>
  captions: Array<SpeakerAttribution & { captionId: string }>
  warnings: string[]
}

export type BeatObservation = {
  id: string
  timeUs: number
  strength: number
  beatProbability: number
  downbeatProbability?: number
}

export type BeatMarker = {
  id: string
  assetId: string
  sourceUs: number
  kind: 'beat' | 'downbeat'
  confidence: number
  strength: number
}

export type BeatAnalysisRecord = {
  schemaVersion: 1
  id: string
  kind: 'beat-grid'
  assetId: string
  provenance: Loc
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/audio-analysis-support.ts`
```
import { engineError } from './errors.js'
import type {
  Caption,
  SpeakerAttributionEvidence,
  SourceIdentity,
  TimelineOperation,
  TranscriptSegment,
  VideoProject
} from './schema.js'
import { applyTimelineOperations } from './timeline.js'
import { microsecondsToFrames } from './time.js'
import { containsAsciiControlCharacters } from '../text-safety.js'
import type {
  DiarizationRecord,
  LocalAnalysisProvenance,
  SpeakerAdapterCapability,
  SpeakerAttribution,
  SpeakerDiarizationAdapterStatus,
  SpeakerModelDescriptor
} from './audio-analysis-model.js'

export function attributionForRange(
  value: Pick<TranscriptSegment, 'id' | 'startUs' | 'endUs'>,
  record: DiarizationRecord
): SpeakerAttribution | undefined {
  const overlaps = record.turns.flatMap((turn) => {
    const overlap = Math.max(0, Math.min(value.endUs, turn.endUs) - Math.max(value.startUs, turn.startUs))
    return overlap > 0 ? [{ turn, overlap }] : []
  }).sort((left, right) => right.overlap - left.overlap || right.turn.confidence - left.turn.confidence)
  const best = overlaps[0]
  if (!best) return undefined
  const duration = value.endUs - value.startUs
  const confidenceValue = Number((best.turn.confidence * best.overlap / duration).toFixed(6))
  const materiallyOverlapping = overlaps.filter(({ overlap }) => overlap / duration >= 0.05)
  const identifiedSpeakerIds = new Set(materiallyOverlapping.flatMap(({ turn }) =>
    !turn.uncertain && turn.speakerId ? [turn.speakerId] : []
  ))
  const explicitOverlap = materiallyOverlapping.some(({ turn }) =>
    turn.status === 'overlap' || turn.reason === 'overlap' || (turn.overlapSpeakerIds?.length ?? 0) > 1
  )
  const containsUnknown = materiallyOverlapping.some(({ turn }) =>
    turn.status === 'unknown' || turn.reason === 'unknown-speaker'
  )
  const containsUncertain = materiallyOverlapping.some(({ turn }) => turn.uncertain)
  const bestHasIdentity = best.turn.speakerId !== undefined && best.turn.speakerLabel !== undefined
  const status: SpeakerAttributionEvidence['status'] = explicitOverlap || identifiedSpeakerIds.size > 1
    ? 'overlap'
    : containsUnknown
      ? 'unknown'
      : containsUncertain || confidenceValue < 0.5 || !bestHasIdentity
        ? 'uncertain'
        : 'identified'
  return {
    analysisId: record.id,
    ...(status === 'identified' && best.turn.speakerId
      ? { speakerId: best.turn.speakerId, speakerLabel: best.turn.speakerLabel }
      : {}),
    confidence: confidenceValue,
    uncertain: status !== 'identified',
    status,
    sourceTurnIds: overlaps.map(({ turn }) => turn.id).slice(0, 32)
  }
}

export function mergeAttributions(
  values: readonly SpeakerAttribution[],
  analysisId: string
): SpeakerAttribution | undefined {
  if (values.length === 0) return undefined
  const confident = values.filter(({ uncertain, speakerId }) => !uncertain && speakerId)
  const speakerIds = new Set(confident.map(({ speakerId }) => speakerId))
  const best = [...values].sort((left, right) => right.confidence - left.confidence)[0]!
  const explicitOverlap = values.some(({ status }) => status === 'overlap')
  const containsUnknown = values.some(({ status }) => status === 'unknown')
  const uncertain = speakerIds.size !== 1 || values.some((value) => value.uncertain)
  const status: SpeakerAttributionEvidence['status'] = explicitOverlap || speakerIds.size > 1
    ? 'overlap'
    : containsUnknown
      ? 'unknown'
      : uncertain
        ? 'uncertain'
        : 'identified'
  return {
    analysisId,
    ...(status === 'identified' && best.speakerId ? { speakerId: best.speakerId, speakerLabel: best.speakerLabel } : {}),
    confidence: best.confidence,
    uncertain: status !== 'identified',
    status,
    sourceTurnIds: [...new Set(values.flatMap(({ sourceTurnIds }) => sourceTurnIds))].slice(0, 32)
  }
}

export function provenance(input: {
  assetId: string
  sourceFingerprint: SourceIdentity
  adapterId: string
  adapterVersion: string
  modelId?: string
  algorithm: string
  algorithmVersion: string
  parameters: readonly (string | number)[]
  now?: () => Date
}): LocalAnalysisProvenance {
  assertFingerprint(input.sourceFingerprint)
  const cacheKey = stableKey([
    input.assetId,
    input.sourceFingerprint.value,
    input.adapterId,
    input.adapterVersion,
    input.modelId ?? '',
    input.algorithm,
    input.algorithmVersion,
    ...input.parameters
  ])
  return {
    adapterId: input.adapterId,
    adapterVersion: input.adapterVersion,
    ...(input.modelId ? { modelId: input.modelId } : {}),
    algorithm: input.algorithm,
    algorithmVersion: input.algorithmVersion,
    sourceFingerprint: { ...input.sourceFingerprint },
    local: true,
    networkUsed: false,
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
    cacheKey,
    execution: 'local'
  }
}

export function validateTimedEvidence(
  values: readonly { id: string; startUs: number; endUs: number }[],
  name: string
): void {
  if (values.length > 100_000) throw engineError('invalid_operation', `${name} evidence exceeds the bounded limit`)
  const ids = new Set<string>()
  let previousStart = -1
  for (const value of values) {
    identifier(value.id, `${name} ID`)
    if (ids.has(value.id)) throw engineError('invalid_operation', `${name} IDs must be unique`)
    ids.add(value.id)
    boundedInteger(value.startUs, 0, Number.MAX_SAFE_INTEGER, `${name} start`)
    boundedInteger(value.endUs, 1, Number.MAX_SAFE_INTEGER, `${name} end`)
    if (value.endUs <= value.startUs || value.startUs < previousStart) {
      throw engineError('invalid_operation', `${name} ranges must be non-empty and ordered`)
    }
    previousStart = value.startUs
  }
}

export function validateSpeakerDescriptor(value: SpeakerModelDescriptor): void {
  identifier(value.adapterId, 'speaker adapter ID')
  identifier(value.modelId, 'speaker model ID')
  boundedString(value.adapterVersion, 'speaker adapter version', 1, 64)
  boundedString(value.modelVersion, 'speaker model version', 1, 64)
  boundedInteger(value.embeddingDimensions, 1, 65_536, 'speaker embedding dimensions')
}

export function validateSpeakerDiarizationAdapterStatus(value: SpeakerDiarizationAdapterStatus): void {
  identifier(value.descriptor.id, 'speaker adapter ID')
  boundedString(value.descriptor.version, 'speaker adapter version', 1, 64)
  if (value.descriptor.execution === 'import') {
    if (value.descriptor.format !== 'kun-speaker-json-v1') {
      throw engineError('invalid_operation', 'Imported speaker adapter requires the bounded Kun speaker JSON format')
    }
    if (value.descriptor.modelId !== undefined || value.descriptor.modelVersion !== undefined) {
      throw engineError('invalid_operation', 'Imported speaker adapter cannot claim a model')
    }
  } else {
    if (!value.descriptor.modelId || !value.descriptor.modelVersion) {
      throw engineError('invalid_operation', 'Local speaker adapter requires model identity and version')
    }
    identifier(value.descriptor.modelId, 'speaker model ID')
    boundedString(value.descriptor.modelVersion, 'speaker model version', 1, 64)
  }
  if (value.outcome === 'unavailable' && !value.remediation.trim()) {
    throw engineError('invalid_operation', 'Unavailable speaker adapter requires remediation')
  }
}

export function persistedSpeakerAttribution(value: SpeakerAttribution): SpeakerAttributionEvidence {
  return {
    analysisId: value.analysisId,
    ...(value.status === 'identified' && value.speakerId && value.speakerLabel
      ? { speakerId: value.speakerId, speakerLabel: value.speakerLabel }
      : {}),
    confidence: value.confidence,
    status: value.status,
    sourceTurnIds: [...value.sourceTurnIds]
  }
}

export function boundedSpeakerLabel(value: string, name: string): string {
  const normalized = value.normalize('NFKC').trim()
  if (normalized.length < 1 || normalized.length > 128 || containsAsciiControlCharacters(normalized)) {
    throw engineError('invalid_operation', `${name} is invalid`)
  }
  return normalized
}

export function validIsoTimestamp(value: string, name: string): string {
  if (!Number.isFinite(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T/u.test(value)) {
    throw engineError('invalid_operation', `${name} must be an ISO timestamp`)
  }
  return value
}

export function speakerUnavailable(
  code: Extract<SpeakerAdapterCapability, { outcome: 'unavailable' }>['code'],
  retryable: boolean,
  remediation: string
): Extract<SpeakerAdapterCapability, { outcome: 'unavailable' }> {
  return { outcome: 'unavailable', code, retryable, remediation, networkUsedForInference: false }
}

export function validateFeatureSeries(values: readonly number[], name: string): void {
  if (values.length < 8 || values.length > 1_000_000) {
    throw engineError('invalid_operation', `${name} requires 8 through 1000000 local feature samples`)
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw engineError('invalid_operation', `${name} must contain finite numbers`)
  }
}

export function seededCandidates(maxLag: number, seed: number): number[] {
  const candidates = Array.from({ length: maxLag * 2 + 1 }, (_, index) => index - maxLag)
  let state = seed || 0x6d2b79f5
  const random = (): number => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) | 0
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[candidates[index], candidates[swap]] = [candidates[swap]!, candidates[index]!]
  }
  return candidates
}

export function correlationAtLag(
  reference: readonly number[],
  target: readonly number[],
  lag: number
): number | undefined {
  const referenceStart = Math.max(0, -lag)
  const targetStart = Math.max(0, lag)
  const length = Math.min(reference.length - referenceStart, target.length - targetStart)
  if (length < 8) ret
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/audio-analysis-vad-speakers.ts`
```
import { engineError } from './errors.js'
import type {
  Caption,
  SpeakerAttributionEvidence,
  SourceIdentity,
  TimelineOperation,
  TranscriptSegment,
  VideoProject
} from './schema.js'
import { applyTimelineOperations } from './timeline.js'
import { microsecondsToFrames } from './time.js'
import { containsAsciiControlCharacters } from '../text-safety.js'
import {
  SpeakerIdentityRegistry,
  type DiarizationRecord,
  type DiarizationTurn,
  type DiarizationTurnEvidence,
  type ImportedDiarizationTurn,
  type SilenceSuggestion,
  type SpeakerAdapterCapability,
  type SpeakerAttribution,
  type SpeakerAttributionPlan,
  type SpeakerDiarizationAdapterStatus,
  type SpeakerMatch,
  type SpeakerModelDescriptor,
  type SpeakerRegistryEntry,
  type VadAnalysisRecord,
  type VadFrameEvidence
} from './audio-analysis-model.js'
import {
  assertFingerprint,
  attributionForRange,
  boundedInteger,
  confidence,
  deepFreeze,
  dot,
  identifier,
  mergeAttributions,
  normalizedVector,
  persistedSpeakerAttribution,
  provenance,
  speakerUnavailable,
  stableDigest64,
  stableKey,
  validateSpeakerDescriptor,
  validateTimedEvidence
} from './audio-analysis-support.js'

export function analyzeVadEvidence(input: {
  assetId: string
  sourceFingerprint: SourceIdentity
  frames: readonly VadFrameEvidence[]
  speechThreshold?: number
  minimumSilenceUs?: number
  suggestionConfidenceThreshold?: number
  completeness?: 'complete' | 'partial'
  adapterId?: string
  adapterVersion?: string
  now?: () => Date
}): VadAnalysisRecord {
  identifier(input.assetId, 'assetId')
  assertFingerprint(input.sourceFingerprint)
  const speechThreshold = confidence(input.speechThreshold ?? 0.5, 'speechThreshold')
  const suggestionThreshold = confidence(
    input.suggestionConfidenceThreshold ?? 0.82,
    'suggestionConfidenceThreshold'
  )
  const minimumSilenceUs = boundedInteger(input.minimumSilenceUs ?? 300_000, 1, 60_000_000, 'minimumSilenceUs')
  const frames = input.frames.map((frame) => ({ ...frame }))
  validateTimedEvidence(frames, 'VAD frame')
  frames.forEach((frame) => confidence(frame.speechProbability, `speech probability for ${frame.id}`))
  const silence: SilenceSuggestion[] = []
  let run: VadFrameEvidence[] = []
  const flush = (): void => {
    if (run.length === 0) return
    const startUs = run[0]!.startUs
    const endUs = run.at(-1)!.endUs
    if (endUs - startUs >= minimumSilenceUs) {
      const average = run.reduce((total, frame) => total + (1 - frame.speechProbability), 0) / run.length
      const rounded = Number(average.toFixed(6))
      silence.push({
        id: `silence:${input.assetId}:${startUs}:${endUs}`,
        assetId: input.assetId,
        sourceRange: { assetId: input.assetId, startUs, endUs },
        confidence: rounded,
        disposition: rounded >= suggestionThreshold ? 'safe-to-suggest' : 'review-required',
        reason: 'vad-silence'
      })
    }
    run = []
  }
  for (const frame of frames) {
    if (frame.speechProbability < speechThreshold) run.push(frame)
    else flush()
  }
  flush()
  const vadProvenance = provenance({
    assetId: input.assetId,
    sourceFingerprint: input.sourceFingerprint,
    adapterId: input.adapterId ?? 'kun.local.vad-evidence',
    adapterVersion: input.adapterVersion ?? '1.0.0',
    algorithm: 'threshold-merge-vad',
    algorithmVersion: '1.0.0',
    parameters: [speechThreshold, minimumSilenceUs, suggestionThreshold],
    now: input.now
  })
  return deepFreeze({
    schemaVersion: 1,
    id: `analysis:vad:${vadProvenance.cacheKey}`,
    kind: 'vad',
    assetId: input.assetId,
    provenance: vadProvenance,
    speechThreshold,
    suggestionConfidenceThreshold: suggestionThreshold,
    frames,
    silence,
    completeness: input.completeness ?? 'complete',
    immutable: true
  })
}

export function negotiateSpeakerAdapter(input: {
  optIn: boolean
  descriptor: SpeakerModelDescriptor
  installationVerified: boolean
  inferenceBrokerAvailable: boolean
}): SpeakerAdapterCapability {
  validateSpeakerDescriptor(input.descriptor)
  if (!input.optIn) {
    return speakerUnavailable('speaker_model_disabled', true, 'Enable local speaker analysis for this workspace first.')
  }
  if (!input.installationVerified) {
    return speakerUnavailable(
      'speaker_model_unverified',
      true,
      'Install and verify the speaker model through an approved Host model broker.'
    )
  }
  if (!input.inferenceBrokerAvailable) {
    return speakerUnavailable(
      'speaker_inference_broker_unavailable',
      false,
      'The speaker model is verified, but this Extension API has no approved local inference broker.'
    )
  }
  return {
    outcome: 'ready',
    adapter: { ...input.descriptor, execution: 'local' },
    networkUsedForInference: false
  }
}

export class SpeakerRegistry {
  private readonly entries = new Map<string, SpeakerRegistryEntry>()

  constructor(entries: readonly SpeakerRegistryEntry[] = []) {
    for (const entry of entries) this.register(entry)
  }

  register(entry: SpeakerRegistryEntry): SpeakerRegistryEntry {
    identifier(entry.id, 'speaker ID')
    if (!entry.label.trim() || entry.label.length > 128) throw engineError('invalid_operation', 'Speaker label is invalid')
    if (this.entries.has(entry.id)) throw engineError('invalid_operation', `Speaker already exists: ${entry.id}`)
    const normalized: SpeakerRegistryEntry = {
      ...entry,
      label: entry.label.trim(),
      embedding: normalizedVector(entry.embedding, 'speaker embedding'),
      sourceEvidenceIds: [...new Set(entry.sourceEvidenceIds)].slice(0, 256)
    }
    this.entries.set(entry.id, deepFreeze(normalized))
    return structuredClone(normalized)
  }

  list(): SpeakerRegistryEntry[] {
    return [...this.entries.values()]
      .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
      .map((entry) => structuredClone(entry))
  }

  match(embedding: readonly number[], options: { threshold?: number; minimumMargin?: number } = {}): SpeakerMatch {
    const query = normalizedVector(embedding, 'speaker query')
    const threshold = confidence(options.threshold ?? 0.78, 'speaker threshold')
    const minimumMargin = confidence(options.minimumMargin ?? 0.05, 'speaker minimum margin')
    const ranked = [...this.entries.values()].map((entry) => {
      if (entry.embedding.length !== query.length) {
        throw engineError('invalid_operation', 'Speaker registry and query dimensions differ')
      }
      return { entry, score: dot(query, entry.embedding) }
    }).sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id))
    const best = ranked[0]
    if (!best) return { confidence: 0, uncertain: true, reason: 'empty-registry' }
    const runnerUp = ranked[1]?.score
    const rounded = Number(best.score.toFixed(6))
    if (best.score < threshold) {
      return { confidence: rounded, ...(runnerUp === undefined ? {} : { runnerUpConfidence: runnerUp }), uncertain: true, reason: 'below-threshold' }
    }
    if (runnerUp !== undefined && best.score - runnerUp < minimumMargin) {
      return { confidence: rounded, runnerUpConfidence: Number(runnerUp.toFixed(6)), uncertain: true, reason: 'ambiguous' }
    }
    return {
      speakerId: best.entry.id,
      label: best.entry.label,
      confidence: rounded,
      ...(runnerUp === undefined ? {} : { runnerUpConfidence: Number(runnerUp.toFixed(6)) }),
      uncertain: false
    }
  }
}

export function diarizeSpeakerEvidence(input: {
  assetId: string
  sourceFingerprint: SourceIdentity
  capability: Extract<SpeakerAdapterCapability, { outcome: 'ready' }>
  registry: SpeakerRegistry
  turns: readonly DiarizationTurnEvidence[]
  threshold?: number
  minimumMargin?: number
  completeness?: 'complete' | 'partial'
  now?: () => Date
}): DiarizationRecord {
  identifier(input.assetId, 'assetId')
  assertFingerprint(input.sourceFingerprint)
  validateTimedEvidence(input.turns, 'diarization turn')
  const turns = input.turns.map((turn): DiarizationTurn => {
    confidence(turn.adapterConfidence, `adapter confidence for ${turn.id}`)
    const match = input.registry.match(turn.embedding, {
      threshold: input.threshold,
      minimumMargin: input.minimumMargin
    })
    const combined = Number(Math.min(turn.adapterConfidence, match.confidence).toFixed(6))
    const uncertain = match.uncertain || combined < (input.threshold ?? 0.78)
    return {
      id: turn.id,
      startUs: turn.startUs,
      endUs: turn.endUs,
      ...(!uncertain && match.speakerId ? { speakerId: match.speakerId, speakerLabel: match.label } : {}),
      confidence: combined,
      uncertain,
      status: uncertain ? 'uncertain' : 'identified',
      ...(uncertain ? { reason: match.reason ?? 'below-threshold' } : {})
    }
  })
  const recordProvenance = provenance({
    assetId: input.assetId,
    sourceFingerprint: input.sourceFingerprint,
    adapterId: input.capability.adapter.adapterId,
    adapterVersion: input.capability.adapter.adapterVersion,
    modelId: `${input.capability.adapter.modelId}@${input.capability.adapter.modelVersion}`,
    algorithm: 'speaker-registry-cosine-match',
    algorithmVersion: '1.0.0',
    parameters: [input.threshold ?? 0.78, input.minimumMargin ?? 0.05],
    now: input.now
  })
  return deepFreeze({
    schemaVersion: 1,
    id: `analysis:speaker:${recordProvenance.cacheKey}`,
    kind: 'speaker-diarization',
    assetId: input.assetId,
    provenance: recordProvenance,
    turns,
    uncertainTurnCount: turns.filter(({ uncertain }) => uncertain).length,
    completeness: input.completeness ?? 'complete',
    immutable: true
  })
}

/**
 * Normalizes explicitly imported, time-bounded speaker evidence. This adapter
 * performs no inference and accepts no path or media bytes. Speaker labels are
 * resolved only through the supplied identity registry, preventing a turn from
 * smuggling an unregistered identity into project attribut
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/audio-analysis.ts`
```
export * from './audio-analysis-model.js'
export * from './audio-analysis-vad-speakers.js'
export * from './audio-analysis-beats-sync.js'

```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/command-service.ts`
```
import {
  MutationReceiptSchema,
  PROJECT_LIMITS,
  type MutationReceipt,
  type ReceiptId,
  type RevisionAuthor,
  type TimelineOperation,
  type UniformShift,
  type VideoProject
} from './schema.js'

export type CommandAttribution = {
  author: RevisionAuthor
  actorId?: string
  sourceOperation: string
  summary: string
}

export type ProjectCommand =
  | { kind: 'timeline'; operations: TimelineOperation[] }
  | { kind: 'replace-project'; project: VideoProject }
  | { kind: 'history-undo' }
  | { kind: 'history-redo' }
  | { kind: 'agent-undo'; actorId: string }
  | {
    kind: 'relink-media'
    assetId: string
    replacement?: VideoProject['assets'][number]
    mediaHandleId?: string
    workspaceRelativePath?: string
    sourceIdentity?: VideoProject['assets'][number]['sourceIdentity']
  }
  | { kind: 'cleanup-derived-cache'; derivedIds?: string[] }
  | { kind: 'confirm-recovery' }

export type ProjectCommandRequest = {
  projectId: string
  expectedRevision: number
  attribution: CommandAttribution
  command: ProjectCommand
}

export type ProjectCommandResult = {
  project: VideoProject
  receipt: MutationReceipt
}

export type ProjectSelectionPatch = Partial<Pick<
  VideoProject['selection'],
  | 'sequenceId'
  | 'playheadFrame'
  | 'selectedAssetIds'
  | 'selectedItemIds'
  | 'selectedCaptionIds'
  | 'selectedWordIds'
  | 'range'
>>

export type SelectionUpdateResult = {
  projectId: string
  revision: number
  generation: number
  eventGeneration: number
  selection: VideoProject['selection']
}

type DiffEntity = { kind: ReceiptId['kind']; id: string; value: unknown }

export function buildMutationReceipt(
  previous: VideoProject,
  next: VideoProject,
  transactionId: string,
  attribution: CommandAttribution,
  operationNotes: ReadonlyArray<MutationReceipt['notes'][number]> = []
): MutationReceipt {
  const before = collectEntities(previous)
  const after = collectEntities(next)
  const created: ReceiptId[] = []
  const changed: ReceiptId[] = []
  const removed: ReceiptId[] = []
  for (const [key, entity] of after) {
    const old = before.get(key)
    if (!old) created.push({ kind: entity.kind, id: entity.id })
    else if (JSON.stringify(old.value) !== JSON.stringify(entity.value)) {
      changed.push({ kind: entity.kind, id: entity.id })
    }
  }
  for (const [key, entity] of before) {
    if (!after.has(key)) removed.push({ kind: entity.kind, id: entity.id })
  }

  const compressed = compressedUniformShifts(previous, next)
  const compressedItemIds = new Set(compressed.itemIds)
  const actionableChanged = changed.filter(({ kind, id }) => kind !== 'item' || !compressedItemIds.has(id))
  const sequenceChanges = describeSequenceChanges(previous, next)
  const trackChanges = describeTrackChanges(previous, next)
  const notes: MutationReceipt['notes'] = [{
    code: 'command_committed',
    messageKey: 'video.receipt.commandCommitted',
    severity: 'info' as const,
    values: { operation: attribution.sourceOperation, revision: next.currentRevision }
  }, ...structuredClone(operationNotes)]

  const createdIds = bounded(created, PROJECT_LIMITS.receiptIds)
  const changedIds = bounded(actionableChanged, PROJECT_LIMITS.receiptIds)
  const removedIds = bounded(removed, PROJECT_LIMITS.receiptIds)
  const shifts = bounded(compressed.shifts, PROJECT_LIMITS.receiptShifts)
  const boundedSequenceChanges = bounded(sequenceChanges, PROJECT_LIMITS.receiptChanges)
  const boundedTrackChanges = bounded(trackChanges, PROJECT_LIMITS.receiptChanges)
  const boundedNotes = bounded(notes, PROJECT_LIMITS.receiptNotes)
  const receipt: MutationReceipt = {
    schemaVersion: 1,
    transactionId,
    projectId: next.id,
    sequenceId: next.activeSequenceId,
    previousRevision: previous.currentRevision,
    newRevision: next.currentRevision,
    generation: next.eventGeneration,
    attribution: {
      author: attribution.author,
      ...(attribution.actorId ? { actorId: attribution.actorId } : {}),
      sourceOperation: attribution.sourceOperation
    },
    createdIds,
    changedIds,
    removedIds,
    shifts,
    sequenceChanges: boundedSequenceChanges,
    trackChanges: boundedTrackChanges,
    proofInvalidated: renderState(previous) !== renderState(next),
    notes: boundedNotes,
    truncated: {
      created: Math.max(0, created.length - createdIds.length),
      changed: Math.max(0, actionableChanged.length - changedIds.length),
      removed: Math.max(0, removed.length - removedIds.length),
      shifts: Math.max(0, compressed.shifts.length - shifts.length),
      sequenceChanges: Math.max(0, sequenceChanges.length - boundedSequenceChanges.length),
      trackChanges: Math.max(0, trackChanges.length - boundedTrackChanges.length),
      notes: Math.max(0, notes.length - boundedNotes.length)
    }
  }
  return MutationReceiptSchema.parse(receipt)
}

function collectEntities(project: VideoProject): Map<string, DiffEntity> {
  const entries: DiffEntity[] = [
    ...project.assets.map((value) => ({ kind: 'asset' as const, id: value.id, value })),
    ...(project.mediaFolders ?? []).map((value) => ({ kind: 'media-folder' as const, id: value.id, value })),
    ...project.sequences.map((value) => ({
      kind: 'sequence' as const,
      id: value.id,
      value: { name: value.name, viewState: value.viewState }
    })),
    ...project.linkGroups.map((value) => ({ kind: 'link-group' as const, id: value.id, value })),
    ...project.transcripts.map((value) => ({ kind: 'transcript' as const, id: value.id, value })),
    ...project.derivedReferences.map((value) => ({ kind: 'derived' as const, id: value.id, value })),
    ...(project.multicamGroups ?? []).map((value) => ({
      kind: 'multicam-group' as const,
      id: value.id,
      value: {
        name: value.name,
        sequenceId: value.sequenceId,
        referenceMemberId: value.referenceMemberId,
        members: value.members,
        layouts: value.layouts
      }
    })),
    ...(project.multicamGroups ?? []).flatMap((group) => group.programFragments.map((value) => ({
      kind: 'multicam-fragment' as const,
      id: value.id,
      value: { groupId: group.id, ...value }
    })))
  ]
  for (const sequence of project.sequences) {
    entries.push(
      ...sequence.tracks.map((value) => ({ kind: 'track' as const, id: value.id, value })),
      ...sequence.items.map((value) => ({ kind: 'item' as const, id: value.id, value })),
      ...sequence.captions.map((value) => ({ kind: 'caption' as const, id: value.id, value }))
    )
  }
  return new Map(entries.map((entity) => [`${entity.kind}:${entity.id}`, entity]))
}

function compressedUniformShifts(
  previous: VideoProject,
  next: VideoProject
): { shifts: UniformShift[]; itemIds: string[] } {
  const previousItems = new Map(previous.items.map((item) => [item.id, item]))
  const groups = new Map<string, Array<{ id: string; frame: number; delta: number; trackId: string }>>()
  for (const item of next.items) {
    const old = previousItems.get(item.id)
    if (!old || old.timelineStartFrame === item.timelineStartFrame) continue
    const beforeRest = { ...old, timelineStartFrame: 0 }
    const afterRest = { ...item, timelineStartFrame: 0 }
    if (JSON.stringify(beforeRest) !== JSON.stringify(afterRest)) continue
    const delta = item.timelineStartFrame - old.timelineStartFrame
    const key = `${item.trackId}\u0000${delta}`
    const values = groups.get(key) ?? []
    values.push({ id: item.id, frame: old.timelineStartFrame, delta, trackId: item.trackId })
    groups.set(key, values)
  }
  const shifts: UniformShift[] = []
  const itemIds: string[] = []
  for (const values of groups.values()) {
    if (values.length < 3) continue
    values.sort((left, right) => left.frame - right.frame || left.id.localeCompare(right.id))
    shifts.push({
      sequenceId: next.activeSequenceId,
      trackId: values[0]!.trackId,
      fromFrame: values[0]!.frame,
      deltaFrames: values[0]!.delta,
      count: values.length
    })
    itemIds.push(...values.map(({ id }) => id))
  }
  shifts.sort((left, right) =>
    left.fromFrame - right.fromFrame || String(left.trackId).localeCompare(String(right.trackId))
  )
  return { shifts, itemIds }
}

function describeSequenceChanges(previous: VideoProject, next: VideoProject): string[] {
  const before = new Map(previous.sequences.map((sequence) => [sequence.id, sequence]))
  const after = new Map(next.sequences.map((sequence) => [sequence.id, sequence]))
  const changes: string[] = []
  for (const [id, sequence] of after) {
    if (!before.has(id)) changes.push(`created:${id}`)
    else if (before.get(id)!.name !== sequence.name) changes.push(`renamed:${id}`)
  }
  for (const id of before.keys()) if (!after.has(id)) changes.push(`removed:${id}`)
  if (previous.activeSequenceId !== next.activeSequenceId) changes.push(`active:${next.activeSequenceId}`)
  return changes.sort()
}

function describeTrackChanges(previous: VideoProject, next: VideoProject): string[] {
  const before = new Map(previous.tracks.map((track) => [track.id, track]))
  const after = new Map(next.tracks.map((track) => [track.id, track]))
  const changes: string[] = []
  for (const [id, track] of after) {
    if (!before.has(id)) changes.push(`created:${id}`)
    else if (JSON.stringify(before.get(id)) !== JSON.stringify(track)) changes.push(`changed:${id}`)
  }
  for (const id of before.keys()) if (!after.has(id)) changes.push(`removed:${id}`)
  return changes.sort()
}

function renderState(project: VideoProject): string {
  return JSON.stringify({
    canvas: project.canvas,
    assets: project.assets,
    sequences: project.sequences.map(({ id, tracks, items, captions }) => ({
      id,
      tracks,
      items,
      captions
    })),
    activeSequenceId: project.activeSequenceId,
    multicamGroups: project.multicamGroups ?? []
  })
}

function bounded<T>(values: readonly T[], maximum: number): T[] {
  return values.slice(0, maximum)
}

```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/denoise-metadata.ts`
```
import { createHash } from 'node:crypto'
import { engineError } from './errors.js'
import type { LocalAnalysisProvenance } from './audio-analysis.js'
import type { SourceIdentity } from './schema.js'
import { containsAsciiControlCharacters } from '../text-safety.js'

const MAX_ANALYZED_DURATION_US = 7 * 24 * 60 * 60 * 1_000_000
const MAX_SAMPLE_WINDOWS = 1_000_000
const MAX_SPECTRAL_BANDS = 32
const MAX_FREQUENCY_HZ = 192_000
const MIN_LEVEL_DBFS = -160
const MAX_LEVEL_DBFS = 0
const MAX_REDUCTION_DB = 36

export type DenoiseMetadataAdapterDescriptor = {
  adapterId: string
  adapterVersion: string
  algorithm: string
  algorithmVersion: string
  modelId?: string
  modelVersion?: string
}

export type DenoiseMetadataCapability =
  | {
      outcome: 'ready'
      descriptor: DenoiseMetadataAdapterDescriptor
      local: true
      networkUsed: false
    }
  | {
      outcome: 'unavailable'
      code:
        | 'denoise_metadata_broker_unavailable'
        | 'denoise_metadata_algorithm_unavailable'
        | 'denoise_metadata_model_unverified'
      remediation: string
      retryable: boolean
      local: true
      networkUsed: false
    }

export type DenoiseSpectralBandEvidence = {
  id: string
  lowerFrequencyHz: number
  upperFrequencyHz: number
  noiseLevelDbfs: number
  confidence: number
}

/**
 * Provider-neutral, already measured local evidence. The engine validates and
 * records these values; it never treats metadata construction as audio DSP.
 */
export type DenoiseNoiseProfileEvidence = {
  analyzedDurationUs: number
  sampleWindowCount: number
  noiseFloorDbfs: number
  averageRmsDbfs: number
  peakDbfs: number
  spectralBands: readonly DenoiseSpectralBandEvidence[]
  confidence: number
  recommendedReductionDb: number
  completeness: 'complete' | 'partial'
}

export type DenoiseMetadataRecord = {
  schemaVersion: 1
  id: string
  kind: 'denoise-metadata'
  assetId: string
  provenance: LocalAnalysisProvenance
  noiseProfile: {
    analyzedDurationUs: number
    sampleWindowCount: number
    levels: {
      noiseFloorDbfs: number
      averageRmsDbfs: number
      peakDbfs: number
      estimatedSnrDb: number
    }
    spectralBands: DenoiseSpectralBandEvidence[]
  }
  confidence: number
  confidenceThreshold: number
  status: 'ready' | 'low-confidence'
  recommendation: {
    reductionDb: number
    confidence: number
    disposition: 'preview-suggested' | 'review-required'
    autoApplyAllowed: false
    audioMutation: 'none'
  }
  completeness: 'complete' | 'partial'
  metadataOnly: true
  immutable: true
}

export function createDenoiseMetadataRecord(input: {
  assetId: string
  sourceFingerprint: SourceIdentity
  descriptor: DenoiseMetadataAdapterDescriptor
  evidence: DenoiseNoiseProfileEvidence
  confidenceThreshold?: number
  now?: () => Date
}): DenoiseMetadataRecord {
  validateIdentifier(input.assetId, 'assetId')
  validateSourceFingerprint(input.sourceFingerprint)
  validateDescriptor(input.descriptor)
  const confidenceThreshold = boundedConfidence(
    input.confidenceThreshold ?? 0.7,
    'denoise confidence threshold'
  )
  const evidence = normalizeEvidence(input.evidence)
  const cacheKey = createHash('sha256').update(JSON.stringify({
    assetId: input.assetId,
    sourceFingerprint: input.sourceFingerprint,
    descriptor: input.descriptor,
    evidence,
    confidenceThreshold
  })).digest('hex')
  const status = evidence.confidence >= confidenceThreshold ? 'ready' : 'low-confidence'
  const provenance: LocalAnalysisProvenance = {
    adapterId: input.descriptor.adapterId,
    adapterVersion: input.descriptor.adapterVersion,
    ...(input.descriptor.modelId === undefined ? {} : {
      modelId: input.descriptor.modelId,
      modelVersion: input.descriptor.modelVersion
    }),
    algorithm: input.descriptor.algorithm,
    algorithmVersion: input.descriptor.algorithmVersion,
    sourceFingerprint: structuredClone(input.sourceFingerprint),
    local: true,
    networkUsed: false,
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
    cacheKey,
    execution: 'local'
  }
  return deepFreeze({
    schemaVersion: 1,
    id: `analysis:denoise:${cacheKey}`,
    kind: 'denoise-metadata',
    assetId: input.assetId,
    provenance,
    noiseProfile: {
      analyzedDurationUs: evidence.analyzedDurationUs,
      sampleWindowCount: evidence.sampleWindowCount,
      levels: {
        noiseFloorDbfs: evidence.noiseFloorDbfs,
        averageRmsDbfs: evidence.averageRmsDbfs,
        peakDbfs: evidence.peakDbfs,
        estimatedSnrDb: rounded(evidence.averageRmsDbfs - evidence.noiseFloorDbfs)
      },
      spectralBands: evidence.spectralBands.map((band) => ({ ...band }))
    },
    confidence: evidence.confidence,
    confidenceThreshold,
    status,
    recommendation: {
      reductionDb: evidence.recommendedReductionDb,
      confidence: evidence.confidence,
      disposition: status === 'ready' ? 'preview-suggested' : 'review-required',
      autoApplyAllowed: false,
      audioMutation: 'none'
    },
    completeness: evidence.completeness,
    metadataOnly: true,
    immutable: true
  })
}

export function isValidDenoiseMetadataAdapterDescriptor(
  value: unknown
): value is DenoiseMetadataAdapterDescriptor {
  try {
    const descriptor = objectValue(value, 'denoise adapter descriptor')
    validateDescriptor({
      adapterId: stringValue(descriptor.adapterId, 'adapterId'),
      adapterVersion: stringValue(descriptor.adapterVersion, 'adapterVersion'),
      algorithm: stringValue(descriptor.algorithm, 'algorithm'),
      algorithmVersion: stringValue(descriptor.algorithmVersion, 'algorithmVersion'),
      ...(descriptor.modelId === undefined ? {} : {
        modelId: stringValue(descriptor.modelId, 'modelId'),
        modelVersion: stringValue(descriptor.modelVersion, 'modelVersion')
      })
    })
    return true
  } catch {
    return false
  }
}

/** Validates JSON-restored records before the Host lists or pages evidence. */
export function isValidDenoiseMetadataRecord(value: unknown): value is DenoiseMetadataRecord {
  try {
    const record = objectValue(value, 'denoise record')
    if (
      record.schemaVersion !== 1 || record.kind !== 'denoise-metadata' ||
      record.metadataOnly !== true || record.immutable !== true
    ) return false
    const id = stringValue(record.id, 'denoise record ID')
    const assetId = stringValue(record.assetId, 'denoise asset ID')
    validateIdentifier(assetId, 'assetId')
    const provenance = objectValue(record.provenance, 'denoise provenance')
    validateDescriptor({
      adapterId: stringValue(provenance.adapterId, 'adapterId'),
      adapterVersion: stringValue(provenance.adapterVersion, 'adapterVersion'),
      algorithm: stringValue(provenance.algorithm, 'algorithm'),
      algorithmVersion: stringValue(provenance.algorithmVersion, 'algorithmVersion'),
      ...(provenance.modelId === undefined ? {} : {
        modelId: stringValue(provenance.modelId, 'modelId'),
        modelVersion: stringValue(provenance.modelVersion, 'modelVersion')
      })
    })
    if (provenance.local !== true || provenance.networkUsed !== false || provenance.execution !== 'local') return false
    validateSourceFingerprint(objectValue(provenance.sourceFingerprint, 'source fingerprint') as SourceIdentity)
    const cacheKey = stringValue(provenance.cacheKey, 'cacheKey')
    if (!/^[a-f0-9]{64}$/u.test(cacheKey) || id !== `analysis:denoise:${cacheKey}`) return false
    if (!Number.isFinite(Date.parse(stringValue(provenance.createdAt, 'createdAt')))) return false
    const profile = objectValue(record.noiseProfile, 'noise profile')
    const levels = objectValue(profile.levels, 'noise levels')
    const spectralBands = arrayValue(profile.spectralBands, 'spectral bands')
    const evidence = normalizeEvidence({
      analyzedDurationUs: numberValue(profile.analyzedDurationUs, 'analyzedDurationUs'),
      sampleWindowCount: numberValue(profile.sampleWindowCount, 'sampleWindowCount'),
      noiseFloorDbfs: numberValue(levels.noiseFloorDbfs, 'noiseFloorDbfs'),
      averageRmsDbfs: numberValue(levels.averageRmsDbfs, 'averageRmsDbfs'),
      peakDbfs: numberValue(levels.peakDbfs, 'peakDbfs'),
      spectralBands: spectralBands.map((band) => {
        const candidate = objectValue(band, 'spectral band')
        return {
          id: stringValue(candidate.id, 'spectral band ID'),
          lowerFrequencyHz: numberValue(candidate.lowerFrequencyHz, 'lowerFrequencyHz'),
          upperFrequencyHz: numberValue(candidate.upperFrequencyHz, 'upperFrequencyHz'),
          noiseLevelDbfs: numberValue(candidate.noiseLevelDbfs, 'noiseLevelDbfs'),
          confidence: numberValue(candidate.confidence, 'band confidence')
        }
      }),
      confidence: numberValue(record.confidence, 'confidence'),
      recommendedReductionDb: numberValue(
        objectValue(record.recommendation, 'recommendation').reductionDb,
        'recommendedReductionDb'
      ),
      completeness: record.completeness === 'partial' ? 'partial' : 'complete'
    })
    if (record.completeness !== 'complete' && record.completeness !== 'partial') return false
    if (numberValue(levels.estimatedSnrDb, 'estimatedSnrDb') !== rounded(evidence.averageRmsDbfs - evidence.noiseFloorDbfs)) return false
    const confidenceThreshold = boundedConfidence(
      numberValue(record.confidenceThreshold, 'confidenceThreshold'),
      'confidenceThreshold'
    )
    const status = evidence.confidence >= confidenceThreshold ? 'ready' : 'low-confidence'
    if (record.status !== status) return false
    const recommendation = objectValue(record.recommendation, 'recommendation')
    return recommendation.confidence === evidence.confidence &&
      recommendation.disposition === (status === 'ready' ? 'preview-suggested' : 'review-required') &&
      recommendation.autoApplyAllowed === false &&
      recommendation.audioMutation === 'none'
  } catch {
    return false
  }
}

function normalizeEvid
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/derived-media-jobs.ts`
```
import { engineError } from './errors.js'
import {
  DerivedMediaStore,
  derivedDedupeKey,
  type DerivedMediaKind,
  type DerivedMediaPriority,
  type DerivedMediaRecord,
  type DerivedRequest
} from './derived-media.js'

export type BrokeredDerivedKind = 'waveform' | 'thumbnail' | 'filmstrip' | 'proxy' | 'proof' | 'preview'

export type DerivedJobPlan = {
  schemaVersion: 1
  kind: BrokeredDerivedKind
  arguments: string[]
  inputs: { source: string }
  outputs: { derived: string }
  idempotencyKey: string
  scheduling: {
    priority: DerivedMediaPriority
    maxAttempts: 3
    retryBaseDelayMs: 250
  }
  metadata: {
    derivedId: string
    dedupeKey: string
    derivedKind: BrokeredDerivedKind
    producerId: string
    producerVersion: string
    priority: DerivedMediaPriority
    sourceFingerprint: string
    projectId?: string
    assetId?: string
    pinnedRevision?: number
    derivedPhase: string
    derivedPhaseIndex: number
    derivedPhaseCount: number
  }
  expectedArtifact: {
    mediaKind: 'image' | 'video'
    mimeType: 'image/png' | 'video/mp4'
  }
  progressive: boolean
  phases: Array<{ id: string; fraction: number; partial: boolean }>
}

export type DerivedJobPlanRequest = {
  record: DerivedMediaRecord
  sourceHandleId: string
  outputHandleId: string
  pinnedRevision?: number
  seekUs?: number
  durationUs?: number
  width?: number
  height?: number
  filmstripIntervalUs?: number
  filmstripColumns?: number
  filmstripRows?: number
  phase?: {
    id: string
    index: number
    count: number
    partial: boolean
  }
}

export type DerivedWorkResult = {
  bytes: number
  artifactHandleIds: string[]
}

export type DerivedWorkRunner = (
  record: DerivedMediaRecord,
  context: {
    signal: AbortSignal
    report(progress: {
      completed: number
      total: number
      unit: string
      message?: string
      partialArtifactHandleIds?: readonly string[]
    }): Promise<void>
  }
) => Promise<DerivedWorkResult>

export type DerivedWorkTicket = {
  record: DerivedMediaRecord
  deduplicated: boolean
  completion: Promise<DerivedMediaRecord>
}

type QueueEntry = {
  request: DerivedRequest
  record: DerivedMediaRecord
  runner: DerivedWorkRunner
  controller: AbortController
  completion: Promise<DerivedMediaRecord>
  resolve(record: DerivedMediaRecord): void
  reject(error: unknown): void
}

const PRIORITY_ORDER: Readonly<Record<DerivedMediaPriority, number>> = Object.freeze({
  background: 100,
  user: 200,
  interactive: 300,
  export: 400
})

export class DerivedWorkCoordinator {
  private readonly queued: QueueEntry[] = []
  private readonly active = new Map<string, QueueEntry>()
  private readonly completions = new Map<string, Promise<DerivedMediaRecord>>()
  private running = 0
  private exportActive = false

  constructor(
    private readonly store: DerivedMediaStore,
    private readonly maxConcurrent = 2
  ) {
    if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 16) {
      throw engineError('invalid_operation', 'Derived concurrency must be from 1 through 16')
    }
  }

  async request(request: DerivedRequest, runner: DerivedWorkRunner): Promise<DerivedWorkTicket> {
    const requested = await this.store.request(request)
    const existingCompletion = this.completions.get(requested.record.id)
    if (requested.deduplicated) {
      return {
        record: requested.record,
        deduplicated: true,
        completion: existingCompletion ?? Promise.resolve(requested.record)
      }
    }
    let resolve!: (record: DerivedMediaRecord) => void
    let reject!: (error: unknown) => void
    const completion = new Promise<DerivedMediaRecord>((accept, fail) => {
      resolve = accept
      reject = fail
    })
    const entry: QueueEntry = {
      request,
      record: requested.record,
      runner,
      controller: new AbortController(),
      completion,
      resolve,
      reject
    }
    this.queued.push(entry)
    this.completions.set(entry.record.id, completion)
    this.sortQueue()
    this.pump()
    return { record: requested.record, deduplicated: false, completion }
  }

  setExportActive(active: boolean): void {
    this.exportActive = active
    if (!active) this.pump()
  }

  async cancel(recordId: string): Promise<DerivedMediaRecord> {
    const queuedIndex = this.queued.findIndex(({ record }) => record.id === recordId)
    if (queuedIndex >= 0) {
      const [entry] = this.queued.splice(queuedIndex, 1)
      entry!.controller.abort()
      const cancelled = await this.store.cancel(recordId)
      entry!.resolve(cancelled)
      this.completions.delete(recordId)
      return cancelled
    }
    const active = this.active.get(recordId)
    if (active) {
      active.controller.abort()
      return await this.store.cancel(recordId)
    }
    const record = await this.store.get(recordId, false)
    if (!record) throw engineError('invalid_operation', `Derived work does not exist: ${recordId}`)
    return record
  }

  private pump(): void {
    while (this.running < this.maxConcurrent) {
      const index = this.queued.findIndex(({ record }) =>
        !this.exportActive || record.priority === 'export'
      )
      if (index < 0) return
      const [entry] = this.queued.splice(index, 1)
      this.running += 1
      this.active.set(entry!.record.id, entry!)
      void this.run(entry!).finally(() => {
        this.running -= 1
        this.active.delete(entry!.record.id)
        this.completions.delete(entry!.record.id)
        this.pump()
      })
    }
  }

  private async run(entry: QueueEntry): Promise<void> {
    try {
      const running = await this.store.markRunning(entry.record.id, `local-derived-${entry.record.id}`)
      entry.record = running
      const result = await entry.runner(running, {
        signal: entry.controller.signal,
        report: async (progress) => {
          if (entry.controller.signal.aborted) throw abortError()
          entry.record = await this.store.reportProgress(entry.record.id, progress)
        }
      })
      if (entry.controller.signal.aborted) throw abortError()
      const ready = await this.store.complete(entry.record.id, result)
      entry.resolve(ready)
    } catch (error) {
      if (entry.controller.signal.aborted || isAbortError(error)) {
        const current = await this.store.get(entry.record.id, false)
        const cancelled = current?.status === 'cancelled'
          ? current
          : await this.store.cancel(entry.record.id)
        entry.resolve(cancelled)
        return
      }
      try {
        const failed = await this.store.fail(entry.record.id, {
          code: 'derived_failed',
          message: error instanceof Error ? error.message : String(error),
          retryable: true
        })
        entry.resolve(failed)
      } catch (transitionError) {
        entry.reject(transitionError)
      }
    }
  }

  private sortQueue(): void {
    this.queued.sort((left, right) =>
      PRIORITY_ORDER[right.record.priority] - PRIORITY_ORDER[left.record.priority] ||
      left.record.createdAt.localeCompare(right.record.createdAt) ||
      left.record.id.localeCompare(right.record.id)
    )
  }
}

export function buildDerivedJobPlan(request: DerivedJobPlanRequest): DerivedJobPlan {
  const kind = brokeredKind(request.record.kind)
  const sourceHandleId = opaqueHandle(request.sourceHandleId, 'sourceHandleId')
  const outputHandleId = opaqueHandle(request.outputHandleId, 'outputHandleId')
  const seekSeconds = secondsArgument(request.seekUs ?? 0, 'seekUs')
  const durationSeconds = secondsArgument(request.durationUs ?? 12_000_000, 'durationUs', true)
  const width = boundedInteger(request.width ?? (kind === 'thumbnail' || kind === 'proof' ? 960 : 1280), 64, 4096, 'width')
  const height = boundedInteger(request.height ?? (kind === 'waveform' ? 240 : 720), 64, 4096, 'height')
  const phase = normalizePhase(request.phase)
  let args: string[]
  let progressive = false
  let phases: DerivedJobPlan['phases']
  let mediaKind: 'image' | 'video'
  let mimeType: 'image/png' | 'video/mp4'
  switch (kind) {
    case 'waveform':
      args = [
        '-nostdin', '-ss', seekSeconds, '-t', durationSeconds,
        '-i', '{{input:source}}', '-filter_complex',
        `showwavespic=s=${width}x${height}:colors=white`, '-frames:v', '1', '-f', 'image2',
        '{{output:derived}}'
      ]
      progressive = true
      phases = progressPhases('waveform')
      mediaKind = 'image'
      mimeType = 'image/png'
      break
    case 'thumbnail':
    case 'proof':
      args = [
        '-nostdin', '-ss', seekSeconds, '-i', '{{input:source}}', '-frames:v', '1',
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease`, '-f', 'image2',
        '{{output:derived}}'
      ]
      phases = progressPhases(kind)
      mediaKind = 'image'
      mimeType = 'image/png'
      break
    case 'filmstrip': {
      const interval = secondsArgument(request.filmstripIntervalUs ?? 5_000_000, 'filmstripIntervalUs', true)
      const columns = boundedInteger(request.filmstripColumns ?? 5, 1, 12, 'filmstripColumns')
      const rows = boundedInteger(request.filmstripRows ?? 2, 1, 12, 'filmstripRows')
      args = [
        '-nostdin', '-ss', seekSeconds, '-t', durationSeconds,
        '-i', '{{input:source}}', '-vf',
        `fps=1/${interval},scale=${width}:-2,tile=${columns}x${rows}`, '-frames:v', '1', '-f', 'image2',
        '{{output:derived}}'
      ]
      progressive = true
      phases = progressPhases(kind)
      mediaKind = 'image'
      mimeType = 'image/png'
      break
    }
    case 'proxy':
    case 'preview':
      args = [
        '-nostdin', '-ss', seekSeconds, '-i', '{{input:source}}',
        '-t', durationSeconds,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', kind === 'proxy' ? '24' : '28',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-f', 'mp4',
     
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/derived-media-support.ts`
```
import { createHash } from 'node:crypto'
import { engineError } from './errors.js'
import {
  type DerivedMediaKind,
  type DerivedMediaOwner,
  type DerivedMediaPriority,
  type DerivedMediaRecord,
  type DerivedMediaSnapshot,
  type DerivedMediaStatus,
  type DerivedRequest
} from './derived-media.js'
import { assertSourceFingerprint, type SourceFingerprint } from './transcript-adapters.js'

export const MAX_PARAMETER_BYTES = 64 * 1024
export const MAX_ARTIFACTS = 16
export const PRIORITY_ORDER: Readonly<Record<DerivedMediaPriority, number>> = Object.freeze({
  background: 100,
  user: 200,
  interactive: 300,
  export: 400
})

export function derivedDedupeKey(request: DerivedRequest): string {
  validateRequest(request)
  return createHash('sha256').update(canonicalJson({
    kind: request.kind,
    owner: request.owner,
    sourceFingerprint: request.sourceFingerprint,
    normalizedParameters: request.normalizedParameters ?? {},
    producer: request.producer,
    dependencies: [...new Set(request.dependencies ?? [])].sort()
  })).digest('hex')
}

export function validateRequest(request: DerivedRequest): void {
  if (!DERIVED_KINDS.has(request.kind)) throw engineError('invalid_operation', 'Unsupported derived media kind')
  validateOwner(request.owner)
  assertSourceFingerprint(request.sourceFingerprint)
  boundedString(request.producer.id, 1, 128, 'producer.id')
  boundedString(request.producer.version, 1, 64, 'producer.version')
  const parameterBytes = new TextEncoder().encode(canonicalJson(request.normalizedParameters ?? {})).byteLength
  if (parameterBytes > MAX_PARAMETER_BYTES) throw engineError('invalid_operation', 'Derived parameters exceed 64 KiB')
  if ((request.dependencies?.length ?? 0) > 64) throw engineError('invalid_operation', 'Derived request has too many dependencies')
}

export function validateSnapshot(value: unknown, maxRecords: number): DerivedMediaSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.records) || value.records.length > maxRecords) {
    throw engineError('invalid_project', 'Derived metadata snapshot is invalid')
  }
  const records = value.records.map((record, index) => validateRecord(record, index + 1))
  const ids = new Set<string>()
  const keys = new Set<string>()
  for (const record of records) {
    if (ids.has(record.id) || keys.has(record.dedupeKey)) throw engineError('invalid_project', 'Derived metadata identities must be unique')
    ids.add(record.id)
    keys.add(record.dedupeKey)
  }
  for (const record of records) assertDependencies(records, record)
  const maximumRecordGeneration = records.reduce(
    (maximum, record) => Math.max(maximum, record.generation, record.statusGeneration),
    0
  )
  const generation = Number.isSafeInteger(value.generation) && Number(value.generation) >= 0
    ? Math.max(Number(value.generation), maximumRecordGeneration)
    : maximumRecordGeneration
  return { schemaVersion: 1, generation, records }
}

export function validateRecord(value: unknown, legacyGeneration: number): DerivedMediaRecord {
  if (!isRecord(value) || value.schemaVersion !== 1) throw engineError('invalid_project', 'Derived record is invalid')
  const record = structuredClone(value) as unknown as DerivedMediaRecord
  record.generation = positiveGeneration(value.generation, legacyGeneration, 'derived.generation')
  record.statusGeneration = positiveGeneration(
    value.statusGeneration,
    record.generation,
    'derived.statusGeneration'
  )
  if (record.statusGeneration > record.generation) {
    throw engineError('invalid_project', 'Derived status generation cannot exceed its record generation')
  }
  boundedString(record.id, 1, 128, 'derived.id')
  if (!/^[a-f0-9]{64}$/u.test(record.dedupeKey)) throw engineError('invalid_project', 'Derived dedupe key is invalid')
  if (!DERIVED_KINDS.has(record.kind) || !ALL_STATUSES.includes(record.status)) throw engineError('invalid_project', 'Derived kind or status is invalid')
  validateOwner(record.owner)
  assertSourceFingerprint(record.sourceFingerprint)
  validateRequest({
    kind: record.kind,
    owner: record.owner,
    sourceFingerprint: record.sourceFingerprint,
    normalizedParameters: record.normalizedParameters,
    producer: record.producer,
    dependencies: record.dependencies,
    priority: record.priority,
    pinned: record.pinned
  })
  if (!Object.hasOwn(PRIORITY_ORDER, record.priority) || !Number.isSafeInteger(record.bytes) || record.bytes < 0 || !Number.isSafeInteger(record.attempt) || record.attempt < 1) {
    throw engineError('invalid_project', 'Derived accounting is invalid')
  }
  record.artifactHandleIds = boundedHandles(record.artifactHandleIds)
  record.partialArtifactHandleIds = boundedHandles(record.partialArtifactHandleIds)
  for (const timestamp of [record.createdAt, record.updatedAt, record.lastAccessedAt, record.retryAfter].filter(Boolean)) {
    if (Number.isNaN(Date.parse(timestamp!))) throw engineError('invalid_project', 'Derived timestamp is invalid')
  }
  return record
}

export function positiveGeneration(value: unknown, fallback: number, path: string): number {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw engineError('invalid_project', `${path} must be a positive safe integer`)
  }
  return Number(value)
}

export function assertDependencies(records: readonly DerivedMediaRecord[], record: DerivedMediaRecord): void {
  if (record.dependencies.includes(record.id)) throw engineError('invalid_operation', 'Derived record cannot depend on itself')
  const known = new Set(records.map(({ id }) => id))
  for (const dependency of record.dependencies) {
    if (!known.has(dependency)) throw engineError('invalid_operation', `Missing derived dependency ${dependency}`)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const byId = new Map(records.map((candidate) => [candidate.id, candidate]))
  const visit = (id: string): void => {
    if (visiting.has(id)) throw engineError('invalid_operation', 'Derived dependency graph contains a cycle')
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const candidate of records) visit(candidate.id)
}

export function defaultPriority(kind: DerivedMediaKind): DerivedMediaPriority {
  if (kind === 'proof' || kind === 'preview') return 'interactive'
  if (kind === 'proxy') return 'user'
  return 'background'
}

export function retryDelayMs(attempt: number): number {
  return Math.min(60 * 60_000, 1_000 * 2 ** Math.min(12, Math.max(0, attempt - 1)))
}

export function isEvictable(records: readonly DerivedMediaRecord[], record: DerivedMediaRecord): boolean {
  return !record.pinned && !['queued', 'running', 'partial'].includes(record.status) && !hasDependent(records, record.id)
}

export function hasDependent(records: readonly DerivedMediaRecord[], id: string): boolean {
  return records.some((record) => record.dependencies.includes(id) && record.status !== 'invalid')
}

export function requiredRecord(records: readonly DerivedMediaRecord[], id: string): DerivedMediaRecord {
  const record = records.find((candidate) => candidate.id === id)
  if (!record) throw engineError('invalid_operation', `Derived record does not exist: ${id}`)
  return record
}

export function invalidTransition(record: DerivedMediaRecord, target: string): never {
  throw engineError('invalid_operation', `Derived record ${record.id} cannot move from ${record.status} to ${target}`)
}

export function ownerMatches(owner: DerivedMediaOwner, filter?: Partial<DerivedMediaOwner>): boolean {
  if (!filter) return true
  return Object.entries(filter).every(([key, value]) => owner[key as keyof DerivedMediaOwner] === value)
}

export function validateOwner(owner: DerivedMediaOwner): void {
  boundedString(owner.extensionId, 1, 256, 'owner.extensionId')
  boundedString(owner.extensionVersion, 1, 64, 'owner.extensionVersion')
  boundedString(owner.workspaceId, 1, 256, 'owner.workspaceId')
  if (owner.projectId !== undefined) boundedString(owner.projectId, 1, 128, 'owner.projectId')
  if (owner.assetId !== undefined) boundedString(owner.assetId, 1, 128, 'owner.assetId')
}

export function boundedHandles(values: readonly string[]): string[] {
  if (!Array.isArray(values) || values.length > MAX_ARTIFACTS) throw engineError('invalid_operation', 'Derived artifacts exceed the bounded limit')
  return [...new Set(values.map((value) => boundedString(value, 8, 512, 'artifactHandleId')))]
}

export function boundedString(value: string, minimum: number, maximum: number, path: string): string {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum) {
    throw engineError('invalid_operation', `${path} must contain ${minimum} through ${maximum} characters`)
  }
  return value
}

export function boundedPositive(value: number, path: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw engineError('invalid_operation', `${path} must be a positive integer`)
  return value
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export const DERIVED_KINDS = new Set<DerivedMediaKind>([
  'waveform', 'thumbnail', 'filmstrip', 'transcript', 'analysis', 'embedding', 'proxy', 'proof', 'preview'
])
export const ALL_STATUSES: readonly DerivedMediaStatus[] = [
  'queued', 'running', 'partial', 'ready', 'failed', 'cancell
```

### Core Architecture Module: `examples/extensions/kun-video-editor/src/engine/derived-media.ts`
```
import { createHash } from 'node:crypto'
import { engineError } from './errors.js'
import {
  ALL_STATUSES,
  MAX_ARTIFACTS,
  MAX_PARAMETER_BYTES,
  PRIORITY_ORDER,
  assertDependencies,
  boundedHandles,
  boundedPositive,
  boundedString,
  defaultPriority,
  derivedDedupeKey,
  hasDependent,
  invalidTransition,
  isEvictable,
  ownerMatches,
  requiredRecord,
  retryDelayMs,
  validateRequest,
  validateSnapshot
} from './derived-media-support.js'
import { assertSourceFingerprint, type SourceFingerprint } from './transcript-adapters.js'

export type DerivedMediaKind =
  | 'waveform'
  | 'thumbnail'
  | 'filmstrip'
  | 'transcript'
  | 'analysis'
  | 'embedding'
  | 'proxy'
  | 'proof'
  | 'preview'

export type DerivedMediaStatus =
  | 'queued'
  | 'running'
  | 'partial'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'invalid'

export type DerivedMediaPriority = 'background' | 'user' | 'interactive' | 'export'

export type DerivedMediaOwner = {
  extensionId: string
  extensionVersion: string
  workspaceId: string
  projectId?: string
  assetId?: string
}

export type DerivedMediaRecord = {
  schemaVersion: 1
  id: string
  /** Monotonic across every record mutation in this workspace store. */
  generation: number
  /** Generation of the most recent status transition for event consumers. */
  statusGeneration: number
  dedupeKey: string
  kind: DerivedMediaKind
  owner: DerivedMediaOwner
  sourceFingerprint: SourceFingerprint
  normalizedParameters: Readonly<Record<string, unknown>>
  producer: { id: string; version: string }
  dependencies: string[]
  status: DerivedMediaStatus
  priority: DerivedMediaPriority
  bytes: number
  pinned: boolean
  attempt: number
  jobId?: string
  artifactHandleIds: string[]
  partialArtifactHandleIds: string[]
  progress?: { completed: number; total: number; unit: string; message?: string }
  error?: { code: string; message: string; retryable: boolean }
  retryAfter?: string
  createdAt: string
  updatedAt: string
  lastAccessedAt: string
}

export type DerivedMediaSnapshot = {
  schemaVersion: 1
  generation: number
  records: DerivedMediaRecord[]
}

export interface DerivedMediaPersistence {
  load(): Promise<unknown | undefined>
  save(snapshot: DerivedMediaSnapshot): Promise<void>
}

export type DerivedMediaStoreOptions = {
  quotaBytes?: number
  maxRecords?: number
  now?: () => Date
  onEvict?: (record: DerivedMediaRecord) => Promise<void>
}

export type DerivedRequest = {
  kind: DerivedMediaKind
  owner: DerivedMediaOwner
  sourceFingerprint: SourceFingerprint
  normalizedParameters?: Readonly<Record<string, unknown>>
  producer: { id: string; version: string }
  dependencies?: readonly string[]
  priority?: DerivedMediaPriority
  pinned?: boolean
}

export type DerivedRequestResult = {
  record: DerivedMediaRecord
  deduplicated: boolean
  backoffActive: boolean
}

export type DerivedStorageUsage = {
  quotaBytes: number
  usedBytes: number
  readyBytes: number
  recordCount: number
  pinnedCount: number
  evictableCount: number
}

const DEFAULT_QUOTA_BYTES = 2 * 1024 * 1024 * 1024
const DEFAULT_MAX_RECORDS = 2_000
export class MemoryDerivedMediaPersistence implements DerivedMediaPersistence {
  snapshot?: DerivedMediaSnapshot

  async load(): Promise<unknown | undefined> {
    return this.snapshot === undefined ? undefined : structuredClone(this.snapshot)
  }

  async save(snapshot: DerivedMediaSnapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot)
  }
}

export class DerivedMediaStore {
  readonly recoveryDiagnostics: string[]
  private records: DerivedMediaRecord[]
  private generation: number
  private queue: Promise<unknown> = Promise.resolve()

  private constructor(
    private readonly persistence: DerivedMediaPersistence,
    private readonly options: Required<Pick<DerivedMediaStoreOptions, 'quotaBytes' | 'maxRecords' | 'now'>> &
      Pick<DerivedMediaStoreOptions, 'onEvict'>,
    records: DerivedMediaRecord[],
    generation: number,
    diagnostics: string[]
  ) {
    this.records = records
    this.generation = generation
    this.recoveryDiagnostics = diagnostics
  }

  static async open(
    persistence: DerivedMediaPersistence,
    options: DerivedMediaStoreOptions = {}
  ): Promise<DerivedMediaStore> {
    const normalizedOptions = {
      quotaBytes: boundedPositive(options.quotaBytes ?? DEFAULT_QUOTA_BYTES, 'quotaBytes'),
      maxRecords: Math.min(DEFAULT_MAX_RECORDS, boundedPositive(options.maxRecords ?? DEFAULT_MAX_RECORDS, 'maxRecords')),
      now: options.now ?? (() => new Date()),
      ...(options.onEvict === undefined ? {} : { onEvict: options.onEvict })
    }
    const diagnostics: string[] = []
    let records: DerivedMediaRecord[] = []
    let generation = 0
    const loaded = await persistence.load()
    if (loaded !== undefined) {
      try {
        const snapshot = validateSnapshot(loaded, normalizedOptions.maxRecords)
        records = snapshot.records
        generation = snapshot.generation
      } catch (error) {
        diagnostics.push(`Derived metadata could not be decoded and was left untouched: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return new DerivedMediaStore(persistence, normalizedOptions, records, generation, diagnostics)
  }

  async list(filter: { owner?: Partial<DerivedMediaOwner>; kinds?: readonly DerivedMediaKind[] } = {}): Promise<DerivedMediaRecord[]> {
    return await this.serialized(async () => {
      const kindSet = filter.kinds ? new Set(filter.kinds) : undefined
      const matches = this.records.filter((record) =>
        (!kindSet || kindSet.has(record.kind)) && ownerMatches(record.owner, filter.owner)
      ).sort((left, right) =>
        PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority] ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.id.localeCompare(right.id)
      )
      return structuredClone(matches)
    })
  }

  async get(id: string, touch = true): Promise<DerivedMediaRecord | undefined> {
    return await this.serialized(async () => {
      const record = this.records.find((candidate) => candidate.id === id)
      if (!record) return undefined
      if (touch) {
        record.lastAccessedAt = this.timestamp()
        this.bump(record)
        await this.persist()
      }
      return structuredClone(record)
    })
  }

  async request(request: DerivedRequest): Promise<DerivedRequestResult> {
    return await this.serialized(async () => {
      validateRequest(request)
      const dedupeKey = derivedDedupeKey(request)
      const existing = this.records.find((record) => record.dedupeKey === dedupeKey)
      const timestamp = this.timestamp()
      if (existing) {
        existing.lastAccessedAt = timestamp
        const retryAfter = existing.retryAfter ? Date.parse(existing.retryAfter) : 0
        const backoffActive = existing.status === 'failed' && retryAfter > this.options.now().getTime()
        if (
          backoffActive ||
          ['queued', 'running', 'partial', 'ready'].includes(existing.status)
        ) {
          this.bump(existing)
          await this.persist()
          return { record: structuredClone(existing), deduplicated: true, backoffActive }
        }
        existing.status = 'queued'
        existing.priority = request.priority ?? existing.priority
        existing.pinned = request.pinned ?? existing.pinned
        existing.attempt += 1
        existing.jobId = undefined
        existing.artifactHandleIds = []
        existing.partialArtifactHandleIds = []
        existing.progress = undefined
        existing.error = undefined
        existing.retryAfter = undefined
        existing.updatedAt = timestamp
        this.bump(existing, true)
        await this.persist()
        return { record: structuredClone(existing), deduplicated: false, backoffActive: false }
      }
      if (this.records.length >= this.options.maxRecords) await this.evictRecordsForCount(1)
      const record: DerivedMediaRecord = {
        schemaVersion: 1,
        id: `derived-${dedupeKey.slice(0, 32)}`,
        generation: this.generation + 1,
        statusGeneration: this.generation + 1,
        dedupeKey,
        kind: request.kind,
        owner: structuredClone(request.owner),
        sourceFingerprint: { ...request.sourceFingerprint },
        normalizedParameters: structuredClone(request.normalizedParameters ?? {}),
        producer: { ...request.producer },
        dependencies: [...new Set(request.dependencies ?? [])].sort(),
        status: 'queued',
        priority: request.priority ?? defaultPriority(request.kind),
        bytes: 0,
        pinned: request.pinned ?? false,
        attempt: 1,
        artifactHandleIds: [],
        partialArtifactHandleIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        lastAccessedAt: timestamp
      }
      this.generation += 1
      assertDependencies(this.records, record)
      this.records.push(record)
      await this.persist()
      return { record: structuredClone(record), deduplicated: false, backoffActive: false }
    })
  }

  async markRunning(id: string, jobId: string): Promise<DerivedMediaRecord> {
    return await this.transition(id, ['queued', 'interrupted', 'partial'], (record) => {
      if (record.status !== 'partial') record.status = 'running'
      record.jobId = boundedString(jobId, 8, 512, 'jobId')
      record.error = undefined
      record.retryAfter = undefined
    })
  }

  async queueNextStage(id: string): Promise<DerivedMediaRecord> {
    return await this.transition(id, ['partial'], (record) => {
      record.jobId = undefined
    })
  }

  async reportProgress(
    id: string,
    progress: { completed: number; total: number; unit: string; message?: string; partialArtifactHandleIds?: readonly string[] }
  ): Promise<DerivedMediaRecord> {
    return await this.transition(id, ['running', 'partial'], (record) => {
      if (!Number.isFinite(progress.completed) || !Number.isFinite(
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1379** (2026-10-03): **[Bug]**
  *Symptoms*: ### Summary / 问题概述  为啥最新版本有针对Windows的更新，却没有Windows的release呢  ### Steps to reproduce / 复现步骤  1  ### Expected behavior / 期望行为  增加Windows的release  ### Actual behavior / 实际行为  1  ### Kun version / Kun 版本  0.3.12  ### Operating system / 操作系统  win_x64  ### Logs / 日志  ```shell  ```  ### Checklist / 检查清单  - [x] I searched existing issues before opening this report. / 我已经搜索过现有 issue。 - [x] I removed sensitive information from logs and screenshots. / 我已经从日志和截图中移除敏感信息。
  **Post-Mortem & Fix Analysis**:
  > 👋 @zhiwanyuanluan6, thanks for your interest in Kun.  To reduce spam, this repository only accepts issues from GitHub accounts older than **180 days** (about 1 year). Your account is currently about **122 day(s)** old, so this issue has been closed automatically.  If you believe this is a mistake, please reach out through the channels listed in our contribution guide.  ---  👋 @zhiwanyuanluan6，感谢你关注 Kun。  为减少垃圾信息，本仓库仅接受注册时间超过 **180 天**（约 1 年）的 GitHub 账号创建的 issue。你的账号注册至今约 **122 天**，因此该 issue 已被自动关闭。  如果你认为这是误判，请通过贡献指南中的渠道联系我们。

- **Issue #1344** (2026-09-25): **no memory access in current projects[Bug]**
  *Symptoms*: ### Summary / 问题概述  I came across this today following up on massive frustration and delays due to the agent ignoring very clear behavioral rules, both universal and project level.  After asking the agent to list the memories to which it had access, the agent gave a very truncated list.  When I noted that this seemed to indicate the agent didnt actually have access to the full rules list it replied that access to the memories was blocked unless I gave specific approval.  I did so and the agent was still blocked from memory access apparently by design AND even the partial memory list that was returned (why, if blocked?) was retruned marked as evidence...not instruction.   ### Steps to reproduce / 复现步骤  see above  ### Expected behavior / 期望行为  I expected memory rules to be followed and have encountered MUCH nearly circular chat and wasted time and tokens just correcting and recorrecting the agent for answering without referring to project documentation, code, and files despite being instructed to in memory.  This makes the agent untrustworthy, inefficient, and very frustrating.  ### Actual behavior / 实际行为  see above  ### Kun version / Kun 版本  0.3.10  ### Operating system / 操作系统  windows 11  ### Logs / 日志  ```shell  ```  ### Checklist / 检查清单  - [x] I searched existing issues before opening this report. / 我已经搜索过现有 issue。 - [x] I removed sensitive information from logs and screenshots. / 我已经从日志和截图中移除敏感信息。
  **Post-Mortem & Fix Analysis**:
  > we will fix in 0.3.11 version

- **Issue #1342** (2026-09-24): **[Bug] 0.3.10 定时任务全部无法保存：settings:set 校验拒绝 sourcePlanId/sourceThreadId/orchestration，所有操作按钮失效**
  *Symptoms*: ### Summary / 问题概述  Windows 0.3.10 上，定时任务（Scheduled Tasks）面板能看到任务列表，但任何写操作（启用/停用、编辑、保存、删除）都失败，界面无任何提示。DevTools Console 报错：  Error invoking remote method 'settings:set': Invalid payload for settings:set: schedule.tasks.0: Unrecognized keys: "sourcePlanId", "sourceThreadId", "orchestration"  原因看起来是应用内部两条 schema 不同步：读取时会往任务对象写入这三个字段，而保存时的 patch 校验器（.strict()）不认这三个字段，导致渲染进程把刚读到的任务原样回写时必然被拒。  这是 100% 确定性复现的回归：0.3.10 之前（约 8 月）同样的两个任务可以正常改工作区、改运行时间。  补充：调度本身是好的（任务仍按计划执行），只有 GUI 写入这一条路被校验挡住。  ### Steps to reproduce / 复现步骤  1. 打开 Kun（Windows，0.3.10），确认已存在至少一个定时任务（我这里有 2 个，创建于 0.3.10 之前） 2. 进入「定时任务 / Scheduled Tasks」面板 —— 任务列表能正常显示 3. 对任意任务做任意写操作：切换启用开关、点编辑后保存、改运行时间、或删除 4. 操作无任何反应（界面无报错弹窗，按钮点了没反应） 5. 按 Ctrl+Shift+I 打开 DevTools，Console 立即出现上述 settings:set 校验错误  可复现率：100%（每次必现）  ### Expected behavior / 期望行为  定时任务的写操作应该成功保存：启用/停用、编辑提示词与运行时间、删除都应生效，且重新打开设置后仍然保持。  写入时应接受应用自己读取任务时写入的 sourcePlanId / sourceThreadId / orchestration 字段。  ### Actual behavior / 实际行为  所有写操作静默失败，界面无任何提示，任务保持原样。DevTools Console 报：  Uncaught (in promise) Error: Error invoking remote method 'settings:set': Error: Invalid payload for settings:set: schedule.tasks.0: Unrecognized keys: "sourcePlanId", "sourceThreadId", "orchestration"  附图一张： Console 中的 settings:set 校验失败  <img width="1126" height="148" alt="Image" src="https://github.com/user-attachments/assets/8a9b72e9-1b87-4bd2-98fc-ad13def38b72" />  ### Kun version / Kun 版本  0.3.10 buildId: 23e22a9b412e096964312231ce85c5bb389258f43a2ac81d01a563dae29e7fd0 serviceVersion:
  **Post-Mortem & Fix Analysis**:
  > 0.3.11修复

- **Issue #1338** (2026-09-22): **model reaching max tokens message after a prompt[Bug]**
  *Symptoms*: ### Summary / 问题概述  <img width="1068" height="377" alt="Image" src="https://github.com/user-attachments/assets/8f6bec51-9eed-4062-9b03-f0ef16a4fafb" />    ### Steps to reproduce / 复现步骤  issue prompt max tokens message returns after some time thinking  ### Expected behavior / 期望行为  proceeding with the prompt  ### Actual behavior / 实际行为  <img width="1068" height="377" alt="Image" src="https://github.com/user-attachments/assets/16625e7c-a74e-4370-8ab3-78bdd5451005" />  ### Kun version / Kun 版本  0.3.10  ### Operating system / 操作系统  windows 11  ### Logs / 日志  ```shell no attach log link but usually it shows after i create the issue and bthen comment ```  ### Checklist / 检查清单  - [x] I searched existing issues before opening this report. / 我已经搜索过现有 issue。 - [x] I removed sensitive information from logs and screenshots. / 我已经从日志和截图中移除敏感信息。
  **Post-Mortem & Fix Analysis**:
  > [kun-2026-09-22.log](https://github.com/user-attachments/files/32499671/kun-2026-09-22.log)
  > I should have noted that i have 32000 set as the max tokens for my models
  > <img width="1280" height="840" alt="Image" src="https://github.com/user-attachments/assets/353f4122-b315-49e1-8912-60e1627f65d0" />

- **Issue #1334** (2026-09-20): **[Bug] Kun 自动下载 但 无法更新 (0.3.6 → 0.3.10)**
  *Symptoms*: ### Summary / 问题概述  0.3.6 的 软件内更新功能，能够自动下载 0.3.10 的安装包，但没被安装上 更新器目录 C:\Users\Staple\AppData\Local\kun-gui-updater\pending\ 里已下载好 Kun-0.3.10-win-x64.exe 校验信息 update-info.json 也在  ### Steps to reproduce / 复现步骤  1. 打开 Kun.exe 2. 等待连接完成，点击 设置-更新，GUI更新 显示 “发现新版本：0.3.6 → 0.3.10” 3. 点击“下载更新”，Kun 自动重启 4. 重启后版本仍然为 0.3.6（和1.完全相同）  ### Expected behavior / 期望行为  Kun 应更新为 0.3.6 → 0.3.10  ### Actual behavior / 实际行为  重启后仍为 0.3.6  ### Kun version / Kun 版本  0.3.6  ### Operating system / 操作系统  Windows 11  ### Logs / 日志  ```shell [2026-09-20T07:19:19.846Z] [WARN] [health-probe] http://127.0.0.1:64092/health: fetch failed [2026-09-20T07:19:22.327Z] [WARN] [health-probe] gave up after 2000ms, last error: fetch failed [2026-09-20T07:19:22.486Z] [ERROR] [sse] SSE stream error for thread thr_b4af1ee091da4420998d7412e99a885b — detail: {   "message": "Kun Service Manager process 99064 is alive but unavailable",   "streamId": "4c579656-83a0-44c7-b2e8-554d62ac1e17" } [2026-09-20T07:19:22.486Z] [ERROR] [runtime-request] HTTP request to /v1/model-connections/events?since_revision=8&wait_ms=25000 failed — detail: {   "message": "Kun Service Manager process 99064 is alive but unavailable" } [2026-09-20T07:19:22.488Z] [ERROR] [runtime-request] HTTP request to /v1/extensions/secret-reveal-requests failed — detail: {   "message": "Kun Service Manager process 99064 is alive but unavailable" } [2026-09-20T07:19:22.488Z] [ERROR] [runtime-request] HTTP request to /v1/extensions/workbench/notifications failed — det
  **Post-Mortem & Fix Analysis**:
  > 备份了记录，删除后，官网重新下载，能解决

- **Issue #1332** (2026-09-19): **[BugI am getting messages that "the model reached its max output tokens ... but i have a paid deepseek plan and have a positive balance**
  *Symptoms*: ### Summary / 问题概述  a give task pauses and shows this:  <img width="964" height="178" alt="Image" src="https://github.com/user-attachments/assets/756c69fa-f53b-4ce5-ba27-5f162a6f8869" />  There is no information on how to increase the model's max tokens and instructions to split the task are ignored and the same message is repeated. I have a paid deepseek acount with positive balance, room on my pc, and other chats keep responding so I don't want what the max tokens message means or what to do about it.  ### Steps to reproduce / 复现步骤  see above  ### Expected behavior / 期望行为  continued chat processing  ### Actual behavior / 实际行为  <img width="1056" height="402" alt="Image" src="https://github.com/user-attachments/assets/5e842234-c1b3-4318-bf74-60b48d0f0960" />  ### Kun version / Kun 版本  0.3.10  ### Operating system / 操作系统  w11  ### Logs / 日志  ```shell no log file upload link sows and any attempt to paste the log opens in a new chrome tab. I'll revisit later as that sometimes gives me a working log fil upload link ```  ### Checklist / 检查清单  - [x] I searched existing issues before opening this report. / 我已经搜索过现有 issue。 - [x] I removed sensitive information from logs and screenshots. / 我已经从日志和截图中移除敏感信息。
  **Post-Mortem & Fix Analysis**:
  > I just noticed I now am getting a cannot reach kun message, enable autostart. but autostart IS enabled and toggling it off and on has no effect, so I'm stuck.  <img width="917" height="148" alt="Image" src="https://github.com/user-attachments/assets/937039f7-4046-4411-9e5c-7bec86fe3781" />  <img width="1044" height="178" alt="Image" src="https://github.com/user-attachments/assets/7f38af1f-ff0a-4bc0-b0a0-b9462e1aa22e" />
  > also File-Quit is now not responding.
  > I stopped kUn via Task Manager and restarted. After a fairly long delay it loaded projects and chats and now the offending chat has a warning indicator ... no idea what that means.  <img width="296" height="42" alt="Image" src="https://github.com/user-attachments/assets/5ce39a50-4763-4003-9b3d-fb99c799d752" />

- **Issue #1330** (2026-10-02): **I did a fresh install of 0.3.10 and Kun launched without difficulties. I worked for a few hours and then the agent got stuck processing a prompt.**
  *Symptoms*: ### Summary / 问题概述  I did a fresh install of 0.3.10 and Kun launched without difficulties. I worked for a few hours and then the agent got stuck processing a prompt in one project. I noticed that all other chats then had solid blue circles next to each chat in every project.  Quitting and restarting Kun makes no change.  I ultimately get a prompt to retry connection but that has no effect other than to see a modal saying "Recovering runtime stream ... view logs"  ### Steps to reproduce / 复现步骤  Open Kun, load a chat.  ### Expected behavior / 期望行为  Standard chat processing vs the freeze in thinking or analysis.  ### Actual behavior / 实际行为  see above  <img width="1525" height="825" alt="Image" src="https://github.com/user-attachments/assets/6f7be075-8596-4a12-abe9-a00474847791" />  ### Kun version / Kun 版本  0.3.10  ### Operating system / 操作系统  windows 11  ### Logs / 日志  ```shell  ```  ### Checklist / 检查清单  - [x] I searched existing issues before opening this report. / 我已经搜索过现有 issue。 - [x] I removed sensitive information from logs and screenshots. / 我已经从日志和截图中移除敏感信息。
  **Post-Mortem & Fix Analysis**:
  > [kun-2026-09-17.log](https://github.com/user-attachments/files/32373942/kun-2026-09-17.log)  I wasn't able to link a logfile yesterday. No link appeared for some reason.  Also, today on reopening Kun, most ran  ormally but a single chat is stuck in a thinking stage and appears to have made its own restart and continue until finished prompt. I didn't write that.  <img width="1483" height="795" alt="Image" src="https://github.com/user-attachments/assets/ef55a0f8-3b58-4d48-aa12-5d12025655c3" />  [kun-2026-09-18.log](https://github.com/user-attachments/files/32374027/kun-2026-09-18.log)
  > It can stop the processing but then cannot get a new prompt to upload into the chat. the upload arrow remains inactive.  <img width="1000" height="140" alt="Image" src="https://github.com/user-attachments/assets/f1978577-c919-40a3-8f1f-04e96b0bcbf8" />  I don't want to lose this entire chat if it can be avoided.

- **Issue #1329** (2026-09-16): **SSE streams (/v1/model-connections/events, /v1/thread-activity/events) reconnect every 25s — no keepalive — and the resulting load makes the runtime fail its own /health probe and force-exit, orphaning in-flight turns**
  *Symptoms*: ### Summary / 问题概述  ### Summary  Two SSE endpoints never deliver a keepalive, so the client reconnects on an exact 25,000 ms idle timeout. This runs continuously — **7,199 reconnect cycles on 2026-09-16 alone** (3,706 on `/v1/thread-activity/events`, 3,493 on `/v1/model-connections/events`).  The serious part is the consequence: on 2026-09-16 the runtime **failed its own `/health` probe** immediately after a 20,333 ms `model-connections/events` call, and the supervisor **force-exited the process**. That force-exit orphaned every in-flight turn (`marked orphaned turn(s) on 4 thread(s) as failed after restart`), leaving windows that are permanently unrenderable and unstoppable.  ### Environment  - Kun **0.3.10** (AppImage, packaged), `buildId 23e22a9b412e096964312231ce85c5bb389258f43a2ac81d01a563dae29e7fd0` - Linux Mint 22.3, kernel `7.0.0-30-generic`, x11 - Runtime: `127.0.0.1:18899`, `launchMode: gui`  ### Steps to reproduce / 复现步骤  1. Launch Kun and leave it running with any window open. 2. Watch `~/.config/Kun/logs/kun-<date>.log`.  Within ~25 s: [kun pid=610361] GET /v1/model-connections/events took 25011ms [kun pid=610361] GET /v1/thread-activity/events took 25000ms [kun pid=610361] GET /v1/model-connections/events took 25012ms [kun pid=610361] GET /v1/thread-activity/events took 25028ms ... indefinitely, alternating between the two endpoints  The interval distribution is conclusive — it is a fixed timeout, not variable work:  | duration | count | |---|---| | 25000 ms | 1
  **Post-Mortem & Fix Analysis**:
  > 👋 @umarkhanwazir, thanks for your interest in Kun.  To reduce spam, this repository only accepts issues from GitHub accounts older than **180 days** (about 1 year). Your account is currently about **98 day(s)** old, so this issue has been closed automatically.  If you believe this is a mistake, please reach out through the channels listed in our contribution guide.  ---  👋 @umarkhanwazir，感谢你关注 Kun。  为减少垃圾信息，本仓库仅接受注册时间超过 **180 天**（约 1 年）的 GitHub 账号创建的 issue。你的账号注册至今约 **98 天**，因此该 issue 已被自动关闭。  如果你认为这是误判，请通过贡献指南中的渠道联系我们。

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

### Incident Patch 1: `33372bf0` (2026-09-27)
**Commit Message**: feat(release): introduce Kun 0.3.12 with model-initiated context compression and Windows upgrade fix

- Added model-initiated context compression in Laboratory settings, allowing prompts at 25%, 50%, and 75% of context budget.
- Fixed startup issues on Windows after upgrading from previous versions, addressing path casing discrepancies.

Users can download the update via the in-app update feature and restart Kun to apply changes.

**File**: `release/release-v0.3.12.md` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+# Kun 0.3.12
+
+0.3.12 在实验室中加入模型主动上下文压缩，并修复 Windows 从旧版升级后无法启动的问题。
+
+## ✨ 新功能
+
+- **模型主动上下文压缩**：实验室新增「上下文压缩」。开启「模型主动上下文压缩」后，上下文预算到达 25%、50%、75% 时会提示模型处理，并提供 `compact_context`，沿用现有摘要压缩。再开启「窗口式上下文」后改为 `new_context`，不再写摘要。窗口式开关依赖总开关；关闭总开关时窗口式上下文一并关闭。设置从下一轮生效。无法执行所需工具的模型路由会在接纳时直接报错。
+
+## 🐛 修复与改进
+
+- **Windows 升级启动**：从 0.3.11 之前的版本升级时，已安装扩展的路径仍保留原来的大小写（如 `C:\Users\...`），而新版本会把数据目录收成小写。启动校验把这两条路径当成不同目录，Kun 在恢复阶段退出，Retry 也会重复失败。现在只接受同一安装目录的大小写差异，并改写成当前数据目录；指向其他目录的记录仍然拒绝。macOS 与 Linux 不受影响。没有安装过扩展的 Windows 用户原本就可以启动。
+
+## 更新方式
+
+通过应用内更新入口下载更新，完成后重启 Kun 安装。此更新沿用桌面应用的稳定更新通道，Kun Runtime 和终端命令随桌面应用一同更新。
+
+---
+
+## English
+
+Kun 0.3.12 adds model-initiated context compression in Laboratory settings and fixes startup after upgrading on Windows.
+
+- **Model-initiated context compression**: Laboratory gains a Context compression section. With model-initiated compression on, the model is prompted at 25%, 50%, and 75% of the context budget and can call `compact_context`, which uses Kun's existing summary compaction. Enabling windowed context as well switches that path to `new_context` and does not write a summary. Windowed context requires the parent switch and turns off with it. The change applies from the next turn. Routes that cannot run the required tools fail at admission.
+- **Windows upgrade startup**: Extensions installed before 0.3.11 keep their original path casing, such as `C:\Users\...`, while 0.3.11 stores the data directory in lowercase. Startup treated those strings as different directories, so Kun exited during recovery and Retry failed the same way. A case-only difference for the same install directory is now rewritten to the current data directory. A path that names a different directory is still rejected. macOS and Linux are unchanged. Windows installs with no extension records already started.
+
+Download the update from Kun and restart to install. The bundled runtime and terminal commands update with the desktop application.
+
+[Full changelog](https://github.com/KunAgent/Kun/compare/v0.3.11...v0.3.12)
```

---

### Incident Patch 2: `383e9849` (2026-09-27)
**Commit Message**: fix(release): allow 300 MiB signed macOS artifacts (#1348)

**File**: `scripts/check-package-size.cjs` (modified, +17/-7)
```diff
@@ -10,6 +10,13 @@ const MAC_ARM64_BUDGETS = {
   dmg: 272 * MIB,
   zip: 285 * MIB
 }
+// Keep PR ad-hoc packages on the tighter limits. Official Developer ID signed
+// and stapled artifacts have a separate 300 MiB ceiling.
+const MAC_ARM64_SIGNED_BUDGETS = {
+  ...MAC_ARM64_BUDGETS,
+  dmg: 300 * MIB,
+  zip: 300 * MIB
+}
 
 function parseArgs(argv) {
   const options = {
@@ -159,17 +166,18 @@ function buildReport(options) {
   }
 }
 
-function budgetFailures(report) {
+function budgetFailures(report, { signed = false } = {}) {
   if (report.platform !== 'darwin' || report.arch !== 'arm64') return []
+  const budgets = signed ? MAC_ARM64_SIGNED_BUDGETS : MAC_ARM64_BUDGETS
   const failures = []
-  if (report.appBytes > MAC_ARM64_BUDGETS.app) {
+  if (report.appBytes > budgets.app) {
     failures.push(
-      `application ${formatBytes(report.appBytes)} exceeds ${formatBytes(MAC_ARM64_BUDGETS.app)}`
+      `application ${formatBytes(report.appBytes)} exceeds ${formatBytes(budgets.app)}`
     )
   }
   for (const [extension, budget] of [
-    ['.dmg', MAC_ARM64_BUDGETS.dmg],
-    ['.zip', MAC_ARM64_BUDGETS.zip]
+    ['.dmg', budgets.dmg],
+    ['.zip', budgets.zip]
   ]) {
     const artifact = report.artifacts.find((entry) => entry.extension === extension)
     if (!artifact) {
@@ -273,11 +281,12 @@ function main() {
     printBaselineComparison(compareWithBaseline(report, baseline))
   }
   if (!options.enforce) return
-  const failures = budgetFailures(report)
+  const signed = process.env.MAC_SIGN === '1'
+  const failures = budgetFailures(report, { signed })
   if (failures.length > 0) {
     throw new Error(`Package size budget failed:\n${failures.map((entry) => `- ${entry}`).join('\n')}`)
   }
-  console.log('[package-size] macOS arm64 package is within the release budgets.')
+  console.log(`[package-size] macOS arm64 ${signed ? 'signed ' : ''}package is within the release budgets.`)
 }
 
 if (require.main === module) {
@@ -292,6 +301,7 @@ if (require.main === module) {
 module.exports = {
   MIB,
   MAC_ARM64_BUDGETS,
+  MAC_ARM64_SIGNED_BUDGETS,
   parseArgs,
   packagedAppPath,
   resourcesPath,
```

**File**: `scripts/check-package-size.test.cjs` (modified, +38/-1)
```diff
@@ -1,7 +1,8 @@
 'use strict'
 
 const assert = require('node:assert/strict')
-const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
+const { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } = require('node:fs')
+const { spawnSync } = require('node:child_process')
 const { tmpdir } = require('node:os')
 const { join, resolve } = require('node:path')
 const test = require('node:test')
@@ -64,6 +65,42 @@ test('enforces all macOS arm64 application and artifact budgets', () => {
   )
 })
 
+test('enforces a separate 300 MiB signed ceiling without relaxing ad-hoc budgets', () => {
+  const report = {
+    platform: 'darwin',
+    arch: 'arm64',
+    appBytes: 731 * MIB,
+    artifacts: [
+      { name: 'Kun-test-mac-arm64.dmg', extension: '.dmg', bytes: 272.6 * MIB },
+      { name: 'Kun-test-mac-arm64.zip', extension: '.zip', bytes: 286.4 * MIB }
+    ]
+  }
+  assert.equal(budgetFailures(report).length, 2)
+  assert.deepEqual(budgetFailures(report, { signed: true }), [])
+  assert.equal(budgetFailures({
+    ...report,
+    artifacts: report.artifacts.map((artifact) => ({ ...artifact, bytes: 300 * MIB + 1 }))
+  }, { signed: true }).length, 2)
+})
+
+test('CLI selects the signed budget only when MAC_SIGN is enabled', (t) => {
+  const distDir = mkdtempSync(join(tmpdir(), 'kun-package-size-signed-'))
+  t.after(() => rmSync(distDir, { recursive: true, force: true }))
+  mkdirSync(join(distDir, 'mac-arm64', 'Kun.app'), { recursive: true })
+  for (const [extension, mib] of [['dmg', 272.6], ['zip', 286.4]]) {
+    const path = join(distDir, `Kun-0.3.11-mac-arm64.${extension}`)
+    writeFileSync(path, '')
+    truncateSync(path, Math.ceil(mib * MIB))
+  }
+  const args = [join(__dirname, 'check-package-size.cjs'), '--platform', 'darwin', '--arch', 'arm64', '--dist-dir', distDir, '--enforce']
+  const unsigned = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, MAC_SIGN: '0' } })
+  const signed = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, MAC_SIGN: '1' } })
+  assert.equal(unsigned.status, 1)
+  assert.match(unsigned.stderr, /Package size budget failed/u)
+  assert.equal(signed.status, 0, signed.stderr)
+  assert.match(signed.stdout, /signed package is within the release budgets/u)
+})
+
 test('formats binary package sizes explicitly', () => {
   assert.equal(formatBytes(1.5 * MIB), '1.5 MiB')
 })
```

---

### Incident Patch 3: `51d0287f` (2026-09-27)
**Commit Message**: fix(release): stabilize paper moves and user input settlement (#1347)

* fix(paper): keep moved papers within scannable library folders

The move-to-folder dialog and IPC accepted paths deeper than the 3-level
library scan, reserved unit-internal names and paths through an existing
paper, so a moved paper could vanish from the library. Moving back to the
top level was also rejected. Create and move now share one folder-path
validator, and paper rows in nested folders are indented under them.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(kun): keep user_input settlement fast and abort-safe

The resolved-event dedup probe replayed the whole events.jsonl from seq 0
on every submission, so on very large threads a submitted answer could sit
undelivered past the abort watchdog and surface as
tool_abort_outcome_unknown. Bound the probe by the seq of the persisted
user_input_requested event, record unconditionally when the probe fails,
and let terminal writes detach instead of blocking on abort so submitted
or cancelled states always reach the item and event log. Also add kun log
warnings across the resolution hand-off (route claim, gate settle, slow
bookkeeping) where the cha

**File**: `kun/src/adapters/in-memory-user-input-gate.ts` (modified, +8/-0)
```diff
@@ -73,6 +73,14 @@ export class InMemoryUserInputGate implements UserInputGate {
     this.requests.delete(inputId)
     const resolver = this.resolvers.get(inputId)
     this.resolvers.delete(inputId)
+    if (!resolver) {
+      // The request was dropped from the map while a waiter should still be
+      // suspended: settling "successfully" would lose the answer silently.
+      console.warn(
+        `[kun] user_input gate settled ${inputId} without a live resolver ` +
+          `(thread=${request.threadId} turn=${request.turnId} status=${resolution.status})`
+      )
+    }
     resolver?.resolve(resolution)
     return 'settled'
   }
```

**File**: `kun/src/loop/interactive-tool-bridge.test.ts` (modified, +7/-1)
```diff
@@ -200,12 +200,15 @@ describe('InteractiveToolBridge', () => {
       applyItem: vi.fn(async () => { order.push('item_created') }),
       updateItem: vi.fn(async () => { order.push('item_updated') })
     } as unknown as TurnService
+    let seq = 0
     const events = {
       record: vi.fn(async (event: { kind: string; inputId?: string }) => {
         order.push(event.kind)
         if (event.kind === 'user_input_requested' && event.inputId) {
           expect(userInputGate.resolve(event.inputId, { status: 'submitted', answers: [] })).toBe('settled')
         }
+        seq += 1
+        return { seq } as never
       })
     } as unknown as RuntimeEventRecorder
     const bridge = new InteractiveToolBridge({
@@ -265,9 +268,12 @@ describe('InteractiveToolBridge', () => {
         updateItem: vi.fn(async () => undefined)
       } as unknown as TurnService
       const recorded: Array<Record<string, unknown>> = []
+      let seq = 0
       const events = {
         record: vi.fn(async (event: Record<string, unknown>) => {
           recorded.push(event)
+          seq += 1
+          return { seq } as never
         })
       } as unknown as RuntimeEventRecorder
       const bridge = new InteractiveToolBridge({
@@ -322,7 +328,7 @@ describe('InteractiveToolBridge', () => {
         updateItem: vi.fn(async () => undefined)
       } as unknown as TurnService
       const events = {
-        record: vi.fn(async () => undefined)
+        record: vi.fn(async () => ({ seq: 1 }) as never)
       } as unknown as RuntimeEventRecorder
       const bridge = new InteractiveToolBridge({
         approvalGate: new InMemoryApprovalGate(),
```

**File**: `kun/src/loop/interactive-tool-bridge.ts` (modified, +37/-38)
```diff
@@ -1,4 +1,3 @@
-import type { TurnItem } from '../contracts/items.js'
 import { makeUserInputItem } from '../domain/item.js'
 import type { ApprovalRequest, ApprovalResolution } from '../domain/approval.js'
 import type { ApprovalGate } from '../ports/approval-gate.js'
@@ -17,7 +16,7 @@ import {
   awaitAbortableGate,
   userInputRequestWithDeadline
 } from '../services/interactive-gate.js'
-import { sessionEventExists } from '../adapters/session-event-query.js'
+import { settleUserInputResolution } from '../services/user-input-settlement.js'
 
 export type InteractiveToolBridgeDeps = {
   approvalGate: ApprovalGate
@@ -193,21 +192,24 @@ export class InteractiveToolBridge {
         ? { timeoutSeconds: input.input.timeoutSeconds }
         : {})
     })
+    let requestedSeq: number | undefined
     try {
       await this.deps.turns.applyItem(input.threadId, item)
-      await this.deps.events.record({
-        kind: 'user_input_requested',
-        threadId: input.threadId,
-        turnId: input.turnId,
-        itemId: item.id,
-        inputId: input.input.id,
-        status: 'pending',
-        prompt: input.input.prompt,
-        questions: input.input.questions,
-        ...(input.input.timeoutSeconds !== undefined
-          ? { timeoutSeconds: input.input.timeoutSeconds }
-          : {})
-      })
+      requestedSeq = (
+        await this.deps.events.record({
+          kind: 'user_input_requested',
+          threadId: input.threadId,
+          turnId: input.turnId,
+          itemId: item.id,
+          inputId: input.input.id,
+          status: 'pending',
+          prompt: input.input.prompt,
+          questions: input.input.questions,
+          ...(input.input.timeoutSeconds !== undefined
+            ? { timeoutSeconds: input.input.timeoutSeconds }
+            : {})
+        })
+      ).seq
     } catch (error) {
       this.deps.userInputGate.resolve(input.input.id, { status: 'cancelled' })
       void pending.catch(() => undefined)
@@ -227,32 +229,29 @@ export class InteractiveToolBridge {
         () => { this.deps.userInputGate.resolve(input.input.id, { status: 'cancelled' }) },
         'cancelled while awaiting user input'
       )
+    } catch {
+      // The abort callback already resolved the gate as cancelled. Fall
+      // through so the terminal item state and resolution event still land
+      // instead of leaving a pending item behind an aborted turn.
+      resolution = { status: 'cancelled' }
     } finally {
       disarmTimeout()
     }
-    await this.deps.turns.updateItem(input.threadId, item.id, {
-      status: resolution.status,
-      finishedAt: this.deps.nowIso(),
-      ...(resolution.status === 'submitted' ? { answers: resolution.answers } : {})
-    } as Partial<TurnItem>)
-    const alreadyRecorded = await sessionEventExists(
-      this.deps.sessionStore,
-      input.threadId,
-      (event) => event.kind === 'user_input_resolved' && event.inputId === input.input.id
-    )
-    if (!alreadyRecorded) {
-      await this.deps.events.record({
-        kind: 'user_input_resolved',
-        threadId: input.threadId,
-        turnId: input.turnId,
-        itemId: item.id,
-        inputId: input.input.id,
-        status: resolution.status,
-        prompt: input.input.prompt,
-        questions: input.input.questions,
-        ...(resolution.status === 'submitted' ? { answers: resolution.answers } : {})
-      })
-    }
+    await settleUserInputResolution({
+      turns: this.deps.turns,
+      events: this.deps.events,
+      sessionStore: this.deps.sessionStore,
+      threadId: input.threadId,
+      turnId: input.turnId,
+      itemId: item.id,
+      inputId: input.input.id,
+      prompt: input.input.prompt,
+      questions: input.input.questions,
+      resolution,
+      requestedSeq,
+      nowIso: this.deps.nowIso,
+      signal: input.signal
+    })
     return resolution
   }
 }
```

**File**: `kun/src/runtime/agent-sdk/agent-sdk-runtime-factory-context.ts` (modified, +30/-35)
```diff
@@ -28,7 +28,7 @@ import type { TurnService } from '../../services/turn-service.js'
 import type { TurnRunOutcome } from '../../loop/turn-execution-types.js'
 import type { SessionStore } from '../../ports/session-store.js'
 import type { ThreadStore } from '../../ports/thread-store.js'
-import { sessionEventExists } from '../../adapters/session-event-query.js'
+import { settleUserInputResolution } from '../../services/user-input-settlement.js'
 import type { CapabilityRegistry } from '../../adapters/tool/capability-registry.js'
 import type { ToolHost, ToolHostContext } from '../../ports/tool-host.js'
 import { mergeRoomDeniedIds } from '../../loop/room-turn-policy.js'
@@ -66,7 +66,7 @@ import type {
   UserInputRequest,
   UserInputResolution
 } from '../../ports/user-input-gate.js'
-import { goalContextTexts, type TurnItem } from '../../contracts/items.js'
+import { goalContextTexts } from '../../contracts/items.js'
 import type { ApprovalGate } from '../../ports/approval-gate.js'
 import {
   createApprovalActionEnvelope,
@@ -211,19 +211,22 @@ export function createAgentSdkFactoryContext(deps: AgentSdkRuntimeFactoryDeps) {
           questions: input.questions,
           ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {})
         })
+        let requestedSeq: number | undefined
         try {
           await deps.turns.applyItem(threadId, item)
-          await deps.events.record({
-            kind: 'user_input_requested',
-            threadId,
-            turnId,
-            itemId: item.id,
-            inputId: input.id,
-            status: 'pending',
-            prompt: input.prompt,
-            questions: input.questions,
-            ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {})
-          })
+          requestedSeq = (
+            await deps.events.record({
+              kind: 'user_input_requested',
+              threadId,
+              turnId,
+              itemId: item.id,
+              inputId: input.id,
+              status: 'pending',
+              prompt: input.prompt,
+              questions: input.questions,
+              ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {})
+            })
+          ).seq
         } catch (error) {
           gate.resolve(input.id, { status: 'cancelled' })
           void pending.catch(() => undefined)
@@ -242,29 +245,21 @@ export function createAgentSdkFactoryContext(deps: AgentSdkRuntimeFactoryDeps) {
         } finally {
           disarmTimeout()
         }
-        await deps.turns.updateItem(threadId, item.id, {
-          status: resolution.status,
-          finishedAt: nowIso(),
-          ...(resolution.status === 'submitted' ? { answers: resolution.answers } : {})
-        } as Partial<TurnItem>)
-        const alreadyRecorded = await sessionEventExists(
-          deps.sessionStore,
+        await settleUserInputResolution({
+          turns: deps.turns,
+          events: deps.events,
+          sessionStore: deps.sessionStore,
           threadId,
-          (event) => event.kind === 'user_input_resolved' && event.inputId === input.id
-        )
-        if (!alreadyRecorded) {
-          await deps.events.record({
-            kind: 'user_input_resolved',
-            threadId,
-            turnId,
-            itemId: item.id,
-            inputId: input.id,
-            status: resolution.status,
-            prompt: input.prompt,
-            questions: input.questions,
-            ...(resolution.status === 'submitted' ? { answers: resolution.answers } : {})
-          })
-        }
+          turnId,
+          itemId: item.id,
+          inputId: input.id,
+          prompt: input.prompt,
+          questions: input.questions,
+          resolution,
+          requestedSeq,
+          nowIso,
+          signal
+        })
         return resolution
       }
     }
```

**File**: `kun/src/runtime/agent-sdk/agent-sdk-runtime-factory-native-gates.test.ts` (modified, +7/-1)
```diff
@@ -508,7 +508,12 @@ describe('createAgentSdkRuntime turn context', () => {
           turns: [{ id: 'tn', prompt: 'ask' } as ThreadRecord['turns'][number]]
         })
       } as never,
-      events: { record: async (event: { kind: string; inputId?: string }) => { events.push(event) } } as never,
+      events: {
+        record: async (event: { kind: string; inputId?: string }) => {
+          events.push(event)
+          return { seq: events.length } as never
+        }
+      } as never,
       ids: { next: (prefix) => prefix },
       prefix: { systemPrompt: '' },
       providerConfigs: {},
@@ -569,6 +574,7 @@ describe('createAgentSdkRuntime turn context', () => {
               answers: []
             }) === 'settled'
           }
+          return { seq: 1 } as never
         }
       } as never,
       ids: { next: (prefix) => `${prefix}_1` },
```

**File**: `kun/src/runtime/cursor/cursor-sdk-runtime-factory.ts` (modified, +30/-35)
```diff
@@ -8,7 +8,7 @@ import type {
 } from '../../contracts/policy.js'
 import type { ActingTurnModelRoute } from '../../contracts/turns.js'
 import type { ThreadRecord } from '../../contracts/threads.js'
-import type { TurnItem } from '../../contracts/items.js'
+
 import { makeUserInputItem } from '../../domain/item.js'
 import type { ApprovalRequest } from '../../domain/approval.js'
 import type { InstructionRuntime } from '../../instructions/instruction-runtime.js'
@@ -49,7 +49,7 @@ import {
   awaitAbortableGate,
   userInputRequestWithDeadline
 } from '../../services/interactive-gate.js'
-import { sessionEventExists } from '../../adapters/session-event-query.js'
+import { settleUserInputResolution } from '../../services/user-input-settlement.js'
 import type { SkillRuntime } from '../../skills/skill-runtime.js'
 import {
   DEFAULT_APPROVAL_REVIEWER,
@@ -184,19 +184,22 @@ export function createCursorSdkRuntime(
         questions: input.questions,
         ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {})
       })
+      let requestedSeq: number | undefined
       try {
         await deps.turns.applyItem(threadId, item)
-        await deps.events.record({
-          kind: 'user_input_requested',
-          threadId,
-          turnId,
-          itemId: item.id,
-          inputId: input.id,
-          status: 'pending',
-          prompt: input.prompt,
-          questions: input.questions,
-          ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {})
-        })
+        requestedSeq = (
+          await deps.events.record({
+            kind: 'user_input_requested',
+            threadId,
+            turnId,
+            itemId: item.id,
+            inputId: input.id,
+            status: 'pending',
+            prompt: input.prompt,
+            questions: input.questions,
+            ...(input.timeoutSeconds !== undefined ? { timeoutSeconds: input.timeoutSeconds } : {})
+          })
+        ).seq
       } catch (error) {
         userInputGate.resolve(input.id, { status: 'cancelled' })
         void pending.catch(() => undefined)
@@ -220,29 +223,21 @@ export function createCursorSdkRuntime(
       } finally {
         disarmTimeout()
       }
-      await deps.turns.updateItem(threadId, item.id, {
-        status: resolution.status,
-        finishedAt: nowIso(),
-        ...(resolution.status === 'submitted' ? { answers: resolution.answers } : {})
-      } as Partial<TurnItem>)
-      const alreadyRecorded = await sessionEventExists(
-        deps.sessionStore,
+      await settleUserInputResolution({
+        turns: deps.turns,
+        events: deps.events,
+        sessionStore: deps.sessionStore,
         threadId,
-        (event) => event.kind === 'user_input_resolved' && event.inputId === input.id
-      )
-      if (!alreadyRecorded) {
-        await deps.events.record({
-          kind: 'user_input_resolved',
-          threadId,
-          turnId,
-          itemId: item.id,
-          inputId: input.id,
-          status: resolution.status,
-          prompt: input.prompt,
-          questions: input.questions,
-          ...(resolution.status === 'submitted' ? { answers: resolution.answers } : {})
-        })
-      }
+        turnId,
+        itemId: item.id,
+        inputId: input.id,
+        prompt: input.prompt,
+        questions: input.questions,
+        resolution,
+        requestedSeq,
+        nowIso,
+        signal
+      })
       return resolution
     }
   }
```

**File**: `kun/src/server/routes/user-inputs.ts` (modified, +14/-0)
```diff
@@ -63,10 +63,24 @@ async function resolveUserInputLocked(input: {
       ...(resolution.status === 'submitted' ? { answers: resolution.answers } : {})
     })
   } catch (error) {
+    // The claim is released without settling, so a retry can still deliver
+    // the answer; log to make the interrupted hand-off visible.
+    console.warn(
+      `[kun] user_input ${input.inputId}: failed to persist resolution event ` +
+        `(thread=${claim.request.threadId} turn=${claim.request.turnId}): ` +
+        `${error instanceof Error ? error.message : String(error)}`
+    )
     claim.release()
     throw error
   }
   if (!claim.resolve(resolution)) {
+    // The durable event says resolved but the gate settled through another
+    // path (timeout/abort/reset) — log the divergence instead of a bare 409.
+    console.warn(
+      `[kun] user_input ${input.inputId}: resolution event recorded but gate ` +
+        `already settled (thread=${claim.request.threadId} turn=${claim.request.turnId} ` +
+        `status=${resolution.status})`
+    )
     return ERRORS.conflict(`user input already resolved: ${input.inputId}`)
   }
   return jsonResponse({
```

**File**: `kun/src/services/user-input-settlement.test.ts` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+import { describe, expect, it, vi } from 'vitest'
+import type { SessionStore } from '../ports/session-store.js'
+import { settleUserInputResolution } from './user-input-settlement.js'
+
+function baseInput(overrides: Partial<Parameters<typeof settleUserInputResolution>[0]> = {}) {
+  const updateItem = vi.fn(async () => null)
+  const record = vi.fn(async () => ({ seq: 10 }) as never)
+  const loadEventsSince = vi.fn(async () => [] as never[])
+  const warn = vi.fn()
+  return {
+    turns: { updateItem },
+    events: { record },
+    sessionStore: { loadEventsSince } as unknown as SessionStore,
+    threadId: 'thread_1',
+    turnId: 'turn_1',
+    itemId: 'item_in_1',
+    inputId: 'in_1',
+    prompt: 'Pick',
+    questions: [],
+    resolution: { status: 'submitted' as const, answers: [] },
+    requestedSeq: 5,
+    nowIso: () => '2026-09-27T00:00:00.000Z',
+    warn,
+    ...overrides
+  }
+}
+
+describe('settleUserInputResolution', () => {
+  it('marks the item terminal and records the resolution when nobody else did', async () => {
+    const input = baseInput()
+    await settleUserInputResolution(input)
+    expect(input.turns.updateItem).toHaveBeenCalledWith(
+      'thread_1',
+      'item_in_1',
+      expect.objectContaining({ status: 'submitted', answers: [] })
+    )
+    expect(input.events.record).toHaveBeenCalledWith(expect.objectContaining({
+      kind: 'user_input_resolved',
+      status: 'submitted'
+    }))
+    expect(input.warn).not.toHaveBeenCalled()
+  })
+
+  it('bounds the dedup probe to events after the request seq', async () => {
+    const loadEventsSince = vi.fn(async () => [] as never[])
+    const input = baseInput({
+      sessionStore: { loadEventsSince } as unknown as SessionStore,
+      requestedSeq: 42
+    })
+    await settleUserInputResolution(input)
+    expect(loadEventsSince).toHaveBeenCalledWith('thread_1', 42)
+  })
+
+  it('skips the resolved event when another writer already recorded it', async () => {
+    const input = baseInput({
+      sessionStore: {
+        loadEventsSince: async () => [{ kind: 'user_input_resolved', inputId: 'in_1' }]
+      } as unknown as SessionStore
+    })
+    await settleUserInputResolution(input)
+    expect(input.turns.updateItem).toHaveBeenCalled()
+    expect(input.events.record).not.toHaveBeenCalled()
+  })
+
+  it('records the resolution even when the dedup probe fails', async () => {
+    const input = baseInput({
+      sessionStore: {
+        loadEventsSince: async () => { throw new Error('events log unreadable') }
+      } as unknown as SessionStore
+    })
+    await settleUserInputResolution(input)
+    expect(input.warn).toHaveBeenCalledWith(expect.stringContaining('probe failed'))
+    expect(input.events.record).toHaveBeenCalledWith(expect.objectContaining({
+      kind: 'user_input_resolved'
+    }))
+  })
+
+  it('propagates bookkeeping failures while the turn is alive', async () => {
+    const input = baseInput({
+      turns: { updateItem: vi.fn(async (): Promise<null> => { throw new Error('items log locked') }) }
+    })
+    await expect(settleUserInputResolution(input)).rejects.toThrow('items log locked')
+    expect(input.warn).toHaveBeenCalledWith(expect.stringContaining('settlement failed'))
+  })
+
+  it('returns immediately on abort while terminal writes continue detached', async () => {
+    const controller = new AbortController()
+    let releaseUpdate: () => void = () => undefined
+    const updateItem = vi.fn(() => {
+      controller.abort()
+      return new Promise<null>((resolve) => { releaseUpdate = () => resolve(null) })
+    })
+    const input = baseInput({
+      turns: { updateItem },
+      signal: controller.signal
+    })
+    await settleUserInputResolution(input)
+    expect(input.warn).toHaveBeenCalledWith(expect.stringContaining('detached on abort'))
+
+    releaseUpdate()
+    await vi.waitFor(() => {
+      expect(input.events.record).toHaveBeenCalledWith(expect.objectContaining({
+        kind: 'user_input_resolved',
+        status: 'submitted'
+      }))
+    })
+  })
+
+  it('warns when settlement exceeds the slow threshold', async () => {
+    vi.useFakeTimers()
+    try {
+      const input = baseInput({
+        turns: {
+          updateItem: vi.fn(async (): Promise<null> => {
+            await vi.advanceTimersByTimeAsync(1_500)
+            return null
+          })
+        }
+      })
+      await settleUserInputResolution(input)
+      expect(input.warn).toHaveBeenCalledWith(expect.stringContaining('took'))
+    } finally {
+      vi.useRealTimers()
+    }
+  })
+})
```

---

### Incident Patch 4: `f9dc7601` (2026-09-27)
**Commit Message**: fix(manager): update service manager resolution logic and add retry mechanism for busy state (#1346)

**File**: `kun/src/manager/manager-client.ts` (modified, +9/-6)
```diff
@@ -34,8 +34,7 @@ import { ManagerResourceLeaseSchema, type ManagerResourceFence } from './resourc
 import type { ManagerRequestOptions } from './manager-client-support.js'
 import { terminateSpawnedRuntime } from '../cli/shared-runtime-launch.js'
 import {
-  inspectServiceManager,
-  resolveServiceManager
+  inspectServiceManager
 } from './manager-resolution.js'
 import {
   launchServiceManagerProcess,
@@ -253,15 +252,19 @@ export async function ensureServiceManager(
   const controlDir = input.controlDir ?? defaultKunControlDir()
   const settingsPath = input.settingsPath ?? defaultProductionSettingsPath()
   const fetchImpl = input.fetch ?? fetch
-  const existing = await resolveServiceManager(controlDir, fetchImpl)
-  if (existing) {
-    if (!managerOwnsPaths(existing.discovery, input.dataDir, settingsPath)) {
+  const inspected = await inspectServiceManager(controlDir, fetchImpl, {
+    attempts: 3,
+    deadline: Date.now() + (input.timeoutMs ?? START_TIMEOUT_MS)
+  })
+  if (inspected.state === 'ready') {
+    if (!managerOwnsPaths(inspected.discovery, input.dataDir, settingsPath)) {
       throw new Error(
         'Kun Service Manager owns a different canonical data or settings path'
       )
     }
-    return existing
+    return { discovery: inspected.discovery }
   }
+  if (inspected.state === 'unavailable') throw inspected.error
   assertManagerBootstrapAllowed(input)
   return withManagerStartLock(
     controlDir,
```

**File**: `kun/src/manager/manager-resolution.test.ts` (modified, +21/-0)
```diff
@@ -6,6 +6,7 @@ import {
   publishManagerDiscovery,
   type ManagerDiscoveryRecord
 } from './manager-discovery.js'
+import { ensureServiceManager } from './manager-client.js'
 import {
   resolveServiceManager,
   resolveServiceManagerForHandoff,
@@ -30,6 +31,26 @@ describe('Service Manager resolution', () => {
     expect(fetchImpl).toHaveBeenCalledTimes(1)
   })
 
+  it('retries a busy Manager before rejecting a development Runtime', async () => {
+    const fixture = await managerFixture([...KUN_MANAGER_CAPABILITIES])
+    const healthyFetch = managerFetch(fixture)
+    let calls = 0
+    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
+      calls += 1
+      if (calls === 1) throw new Error('health probe temporarily busy')
+      return healthyFetch(input, init)
+    }) as typeof fetch
+
+    await expect(ensureServiceManager({
+      flavor: 'development',
+      dataDir: fixture.discovery.dataDir,
+      controlDir: fixture.controlDir,
+      settingsPath: fixture.discovery.settingsPath,
+      fetch: fetchImpl
+    })).resolves.toEqual({ discovery: fixture.discovery })
+    expect(fetchImpl).toHaveBeenCalledTimes(2)
+  })
+
   it('authenticates an older same-protocol manager only for migration handoff', async () => {
     const capabilities = KUN_MANAGER_CAPABILITIES.filter((value) => value !== 'item-page-v1')
     const fixture = await managerFixture(capabilities)
```

---

### Incident Patch 5: `c121f9f3` (2026-09-27)
**Commit Message**: feat(paper): polish paper-mode search, discover and library UI

- 论文搜索 opens in Agent mode by default; direct search becomes 快速检索,
  the second tab, sharing the slim header
- quick search: Code-home layout (hero, scope chips, large search bar,
  recent and example queries); results dock the bar at the top and use
  one source row whose chips filter and retry, with the bulk bar only
  shown once papers are selected
- discover pages drop the pseudo address bar for a shared header; arXiv
  rows show authors and categories; venue years hide their scrollbar;
  feeds get a real empty state with one-click arXiv categories
- research stage: reading lists collapse after six papers instead of
  scrolling inside the transcript; pool rows keep a single meta line;
  a stalled session binds itself after a short wait
- library table drops venue, tags and added columns when narrow instead
  of scrolling sideways; the sidebar info panel starts taller and shows
  its scrollbar
- replace var() colors with /NN opacity that Tailwind silently dropped

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/renderer/src/components/chat/PaperListCard.tsx` (modified, +33/-8)
```diff
@@ -25,6 +25,8 @@ import { ImportButton } from '../paper/discover/PaperDiscoverParts'
 
 const PRIORITY_ORDER = { must: 0, should: 1, optional: 2 } as const
 
+const COLLAPSED_ENTRIES = 6
+
 function entryImportInput(entry: RendererPaperListEntry): string | undefined {
   return (entry.paper ? paperCardImportInput(entry.paper) : undefined) ?? entry.id
 }
@@ -90,6 +92,7 @@ export function PaperListCard({
   )
   const [importing, setImporting] = useState(false)
   const [copied, setCopied] = useState(false)
+  const [expanded, setExpanded] = useState(false)
 
   const groups = useMemo(() => {
     const out: Array<{ label: string; entries: RendererPaperListEntry[] }> = []
@@ -108,6 +111,19 @@ export function PaperListCard({
     return out
   }, [list.papers])
 
+  // Long lists stay compact in the transcript; no nested scroll region.
+  const visibleGroups = useMemo(() => {
+    if (expanded) return groups
+    let budget = COLLAPSED_ENTRIES
+    const out: typeof groups = []
+    for (const group of groups) {
+      if (budget <= 0) break
+      out.push({ label: group.label, entries: group.entries.slice(0, budget) })
+      budget -= group.entries.length
+    }
+    return out
+  }, [expanded, groups])
+
   const verifiedCount = list.papers.filter((entry) => entry.verified).length
   const selectedEntries = list.papers.filter((entry) => selected.has(entry.id))
 
@@ -197,11 +213,11 @@ export function PaperListCard({
         </p>
       ) : null}
 
-      <div className="max-h-[420px] overflow-y-auto">
-        {groups.map((group) => (
+      <div>
+        {visibleGroups.map((group) => (
           <div key={group.label || '__none__'}>
             {group.label ? (
-              <p className="sticky top-0 bg-ds-card/95 px-3.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-ds-faint backdrop-blur">
+              <p className="px-3.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-ds-faint">
                 {group.label}
               </p>
             ) : null}
@@ -219,6 +235,15 @@ export function PaperListCard({
             </ul>
           </div>
         ))}
+        {list.papers.length > COLLAPSED_ENTRIES ? (
+          <button
+            type="button"
+            onClick={() => setExpanded((value) => !value)}
+            className="flex w-full items-center justify-center gap-1 border-t border-ds-border-muted py-1.5 text-[11.5px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
+          >
+            {expanded ? t('paperToolShowLess') : t('paperToolShowAll', { count: list.papers.length })}
+          </button>
+        ) : null}
       </div>
 
       <footer className="flex flex-wrap items-center gap-1.5 border-t border-ds-border-muted px-3 py-2">
@@ -278,11 +303,11 @@ export function PaperListSkeleton({ title }: { title?: string }): ReactElement {
       className="rounded-xl border border-ds-border-muted bg-ds-card p-3.5"
     >
       <div className="h-4 w-48 max-w-full rounded bg-ds-subtle" />
-      <div className="mt-2 h-3 w-72 max-w-full rounded bg-ds-subtle/80" />
+      <div className="mt-2 h-3 w-72 max-w-full rounded bg-ds-subtle" />
       <div className="mt-3 space-y-2">
-        <div className="h-8 rounded bg-ds-subtle/70" />
-        <div className="h-8 rounded bg-ds-subtle/70" />
-        <div className="h-8 rounded bg-ds-subtle/70" />
+        <div className="h-8 rounded bg-ds-subtle" />
+        <div className="h-8 rounded bg-ds-subtle" />
+        <div className="h-8 rounded bg-ds-subtle" />
       </div>
     </section>
   )
@@ -306,7 +331,7 @@ function PaperListRow({
   const metaLine = entryMetaLine(entry)
   const paper = entry.paper
   return (
-    <li className="flex items-start gap-2 px-3.5 py-2 transition hover:bg-ds-hover/50">
+    <li className="flex items-start gap-2 px-3.5 py-2 transition hover:bg-ds-hover">
       <button
         type="button"
         role="checkbox"
```

**File**: `src/renderer/src/components/paper/PaperDiscoverView.tsx` (modified, +183/-173)
```diff
@@ -1,14 +1,9 @@
 import { useEffect, useState, type ReactElement } from 'react'
 import {
-  ChevronDown,
-  ChevronLeft,
-  ChevronUp,
-  Compass,
   ExternalLink,
   Loader2,
   Newspaper,
   Plus,
-  RefreshCw,
   RotateCw,
   Rss,
   Trophy,
@@ -18,7 +13,6 @@ import { useTranslation } from 'react-i18next'
 import { useWriteWorkspaceStore } from '../../write/write-workspace-store'
 import { rendererRuntimeClient } from '../../agent/runtime-client'
 import { usePaperModeStore } from '../../paper/paper-mode-store'
-import { openPaperViewTab } from '../../paper/paper-view'
 import type { PaperArxivTodayItem, PaperFeedItem } from '@shared/paper/paper-library-types'
 import {
   decodePaperSearchFeed,
@@ -28,19 +22,34 @@ import {
 } from '../../paper/paper-search-prefs'
 import { ExpandableAbstract, ImportButton } from './discover/PaperDiscoverParts'
 import { PaperVenuePane } from './discover/PaperVenuePane'
+import { PaperHeaderIconButton, PaperViewHeader } from './PaperViewHeader'
 
 export type PaperDiscoverSource = 'arxiv' | 'feeds' | 'venue'
 
+const SUGGESTED_FEEDS = [
+  { title: 'arXiv cs.CL', url: 'https://rss.arxiv.org/rss/cs.CL' },
+  { title: 'arXiv cs.LG', url: 'https://rss.arxiv.org/rss/cs.LG' },
+  { title: 'arXiv cs.AI', url: 'https://rss.arxiv.org/rss/cs.AI' },
+  { title: 'arXiv cs.SE', url: 'https://rss.arxiv.org/rss/cs.SE' },
+  { title: 'arXiv cs.CV', url: 'https://rss.arxiv.org/rss/cs.CV' }
+]
+
+/** RFC-822 / ISO feed dates → YYYY-MM-DD for display. */
+function shortDate(raw: string): string {
+  const time = Date.parse(raw)
+  return Number.isNaN(time) ? raw : new Date(time).toISOString().slice(0, 10)
+}
+
 const SOURCE_ICONS: Record<PaperDiscoverSource, ReactElement> = {
   arxiv: <Newspaper className="h-4 w-4" strokeWidth={1.8} />,
   feeds: <Rss className="h-4 w-4" strokeWidth={1.8} />,
   venue: <Trophy className="h-4 w-4" strokeWidth={1.8} />
 }
 
 /**
- * Discover virtual tab (U4/U7): one browser-like surface per source —
- * arXiv today, feed subscriptions, or a papers.cool venue listing — with a
- * pseudo address bar (back → library tab, refresh, current source label).
+ * Discover virtual tab (U4/U7): one surface per source — arXiv today, feed
+ * subscriptions, or a papers.cool venue listing — under the shared paper
+ * view header (source, current listing, refresh).
  */
 export function PaperDiscoverView({ source }: { source?: PaperDiscoverSource }): ReactElement {
   const { t } = useTranslation('common')
@@ -53,50 +62,36 @@ export function PaperDiscoverView({ source }: { source?: PaperDiscoverSource }):
   const effectiveSource = source ?? 'arxiv'
   const [reloadKey, setReloadKey] = useState(0)
 
-  const addressLabel =
+  const arxivDate = usePaperModeStore((s) => s.discover.arxivDate)
+  const meta =
     effectiveSource === 'arxiv'
-      ? 'arxiv.org · new'
+      ? arxivDate
       : effectiveSource === 'feeds'
-        ? feedTitle || t('writePaperDiscoverTab_feeds')
-        : ['papers.cool', venue || 'venue', venueGroup].filter(Boolean).join(' · ')
+        ? feedTitle
+        : [venue, venueGroup].filter(Boolean).join(' · ')
 
   return (
     <div className="flex min-h-0 min-w-0 flex-1 flex-col">
-      <div className="flex items-center gap-1.5 border-b border-ds-border-muted px-3 py-2">
-        <button
-          type="button"
-          onClick={() => openPaperViewTab('library')}
-          title={t('writePaperDiscoverBack')}
-          aria-label={t('writePaperDiscoverBack')}
-          className="write-pdf-icon-button shrink-0"
-        >
-          <ChevronLeft className="h-4 w-4" strokeWidth={1.9} />
-        </button>
-        <button
-          type="button"
-          onClick={() => setReloadKey((value) => value + 1)}
-          title={t('writePaperDiscoverRefresh')}
-          aria-label={t('writePaperDiscoverRefresh')}
-          className="write-pdf-icon-button shrink-0"
-        >
-          <RotateCw className="h-3.5 w-3.5" strokeWidth={1.9} />
-        </button>
-        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-ds-border-muted bg-ds-subtle px-3 dark:bg-white/[0.05]">
-          <span className="shrink-0 text-accent">{SOURCE_ICONS[effectiveSource]}</span>
-          <span className="min-w-0 flex-1 truncate text-[12px] text-ds-muted">
-            {addressLabel}
-          </span>
-          <Compass className="h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={1.8} />
-        </div>
-      </div>
-      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
-        {effectiveSource === 'arxiv' ? (
-          <ArxivTodayPane workspaceRoot={workspaceRoot} reloadKey={reloadKey} />
-        ) : effectiveSource === 'feeds' ? (
-          <FeedsPane workspaceRoot={workspaceRoot} reloadKey={reloadKey} />
-        ) : (
-          <PaperVenuePane workspaceRoot={workspaceRoot} reloadKey={reloadKey} />
+      <PaperViewHeader
+        icon={SOURCE_ICONS[effectiveSource]}
+        title={t(`writePaperDisc
```

**File**: `src/renderer/src/components/paper/PaperViewHeader.tsx` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import type { ReactElement, ReactNode } from 'react'
+
+/**
+ * Slim header shared by paper-mode center views (search, discover sources):
+ * leading control or icon + title on the left, view actions on the right —
+ * the same height and rhythm as the Code conversation header.
+ */
+export function PaperViewHeader({
+  leading,
+  icon,
+  title,
+  meta,
+  actions
+}: {
+  leading?: ReactNode
+  icon?: ReactNode
+  title?: ReactNode
+  meta?: ReactNode
+  actions?: ReactNode
+}): ReactElement {
+  return (
+    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-ds-border-muted px-4">
+      {leading}
+      <div className="flex min-w-0 flex-1 items-center gap-2">
+        {icon ? <span className="flex shrink-0 text-ds-muted">{icon}</span> : null}
+        {title ? <span className="min-w-0 truncate text-[13px] font-medium text-ds-ink">{title}</span> : null}
+        {meta ? <span className="min-w-0 shrink-0 truncate text-[11.5px] text-ds-faint">{meta}</span> : null}
+      </div>
+      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
+    </header>
+  )
+}
+
+/** Icon button sized for PaperViewHeader. */
+export function PaperHeaderIconButton({
+  label,
+  onClick,
+  children,
+  disabled
+}: {
+  label: string
+  onClick: () => void
+  children: ReactNode
+  disabled?: boolean
+}): ReactElement {
+  return (
+    <button
+      type="button"
+      onClick={onClick}
+      disabled={disabled}
+      aria-label={label}
+      title={label}
+      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink disabled:opacity-40"
+    >
+      {children}
+    </button>
+  )
+}
```

**File**: `src/renderer/src/components/paper/discover/PaperQuickSearchBar.tsx` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+import type { ReactElement, Ref } from 'react'
+import { ArrowRight, Loader2, Search, X } from 'lucide-react'
+import { useTranslation } from 'react-i18next'
+
+/**
+ * Quick-search input: a large hero field on the empty page, a compact one
+ * docked above results. Enter searches; the trailing button does the same.
+ */
+export function PaperQuickSearchBar({
+  value,
+  onChange,
+  onSubmit,
+  busy,
+  size,
+  inputRef
+}: {
+  value: string
+  onChange: (value: string) => void
+  onSubmit: () => void
+  busy: boolean
+  size: 'hero' | 'compact'
+  inputRef?: Ref<HTMLInputElement>
+}): ReactElement {
+  const { t } = useTranslation('common')
+  const hero = size === 'hero'
+  return (
+    <div
+      className={`flex items-center gap-2 border border-ds-border bg-ds-main shadow-sm transition focus-within:border-[var(--ds-accent)] ${
+        hero ? 'h-14 rounded-2xl pl-4 pr-2' : 'h-10 rounded-xl pl-3 pr-1.5'
+      }`}
+    >
+      <Search className={`shrink-0 text-ds-faint ${hero ? 'h-5 w-5' : 'h-4 w-4'}`} strokeWidth={1.9} />
+      <input
+        ref={inputRef}
+        value={value}
+        autoFocus={hero}
+        onChange={(event) => onChange(event.target.value)}
+        onKeyDown={(event) => {
+          if (event.key === 'Enter' && !event.nativeEvent.isComposing) onSubmit()
+        }}
+        placeholder={t('writePaperSearchQueryPlaceholder')}
+        aria-label={t('writePaperSearchQueryPlaceholder')}
+        className={`min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-ds-ink shadow-none outline-none ring-0 placeholder:text-ds-faint focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none ${hero ? 'text-[15px]' : 'text-[13.5px]'}`}
+      />
+      {value ? (
+        <button
+          type="button"
+          aria-label={t('clearSearch')}
+          onClick={() => onChange('')}
+          className="rounded p-1 text-ds-faint hover:text-ds-ink"
+        >
+          <X className="h-3.5 w-3.5" strokeWidth={2} />
+        </button>
+      ) : null}
+      <button
+        type="button"
+        onClick={onSubmit}
+        disabled={!value.trim() || busy}
+        aria-label={t('writePaperSearchRun')}
+        title={t('writePaperSearchRun')}
+        className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--ds-control)] text-[var(--ds-control-foreground)] transition hover:opacity-90 disabled:opacity-40 ${
+          hero ? 'h-10 w-10' : 'h-7 w-7'
+        }`}
+      >
+        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" strokeWidth={2.2} />}
+      </button>
+    </div>
+  )
+}
```

**File**: `src/renderer/src/components/paper/discover/PaperSearchFilters.tsx` (modified, +4/-4)
```diff
@@ -37,7 +37,7 @@ export function applyPaperSearchFilters(
   })
 }
 
-/** Filter chips + per-source status with click-to-retry (plan P5 errors). */
+/** Filter chips + per-source counts; a failed source's chip retries it. */
 export function PaperSearchFilterBar({
   result,
   filters,
@@ -104,7 +104,7 @@ export function PaperSearchFilterBar({
                 : t(`writePaperSearchSource_${source}`)
             }
             aria-pressed={filters.sources.includes(source)}
-            onClick={() => toggleSource(source)}
+            onClick={() => (failed ? onRetrySource(source) : toggleSource(source))}
             onContextMenu={(event) => {
               event.preventDefault()
               if (failed) onRetrySource(source)
@@ -118,7 +118,7 @@ export function PaperSearchFilterBar({
             }`}
           >
             {t(`writePaperSearchSource_${source}`)}
-            {failed ? <span className="text-[9px]">!</span> : null}
+            <span className="tabular-nums text-ds-faint">{failed ? t('writePaperSearchSourceFailed') : report?.count ?? 0}</span>
           </button>
         )
       })}
@@ -176,7 +176,7 @@ export function PaperSearchSelectionBar({
   t: Translate
 }): ReactElement {
   return (
-    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-ds-border-muted bg-ds-subtle/60 px-2 py-1.5">
+    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-ds-border-muted bg-ds-subtle px-2 py-1.5">
       <button
         type="button"
         onClick={onSelectAll}
```

**File**: `src/renderer/src/components/paper/discover/PaperSearchResults.tsx` (modified, +13/-27)
```diff
@@ -1,7 +1,6 @@
 import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
 import { paperViewOwnsKeyEvent } from './paper-view-keys'
 import {
-  AlertCircle,
   BookOpenText,
   CheckSquare,
   FileText,
@@ -261,29 +260,16 @@ export function PaperSearchResults({
             ? ` ${t('writePaperSearchResultFiltered', { count: result.hits.length })}`
             : ''}
         </span>
-        <span className="flex flex-wrap items-center gap-1">
-          {result.sources.map((report) => (
-            <button
-              key={report.source}
-              type="button"
-              title={
-                report.error
-                  ? `${report.error} — ${t('writePaperSearchSourceRetryHint')}`
-                  : `${(report.ms / 1000).toFixed(1)}s`
-              }
-              onClick={() => (report.error ? onRetrySource(report.source) : undefined)}
-              className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] tabular-nums transition ${
-                report.error
-                  ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900'
-                  : 'bg-ds-subtle text-ds-muted'
-              }`}
-            >
-              {report.error ? <AlertCircle className="h-3 w-3" strokeWidth={2} /> : null}
-              {t(`writePaperSearchSource_${report.source}`)}
-              <span className="text-ds-faint">{report.error ? t('writePaperSearchSourceFailed') : report.count}</span>
-            </button>
-          ))}
-        </span>
+        {hits.length && !selectedHits.length ? (
+          <button
+            type="button"
+            onClick={toggleAll}
+            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
+          >
+            <Square className="h-3.5 w-3.5" strokeWidth={1.8} />
+            {t('writePaperSearchSelectAll')}
+          </button>
+        ) : null}
         <div className="ml-auto flex h-7 items-center rounded-md border border-ds-border-muted bg-ds-subtle p-0.5">
           {SORTS.map((key) => (
             <button
@@ -322,7 +308,7 @@ export function PaperSearchResults({
         t={t}
       />
 
-      {hits.length ? (
+      {selectedHits.length ? (
         <PaperSearchSelectionBar
           total={hits.length}
           selectedCount={selectedHits.length}
@@ -426,8 +412,8 @@ function SearchHitRow({
       data-hit-index={index}
       onMouseEnter={onFocus}
       className={`rounded-lg border px-4 py-3 transition ${
-        focused ? 'border-accent/60 bg-accent-tint/[0.04]' : 'border-ds-border-muted bg-ds-card'
-      } ${detailOpen ? 'border-accent/50' : ''}`}
+        focused ? 'border-accent-tint/60 bg-accent-tint/[0.04]' : 'border-ds-border-muted bg-ds-card'
+      } ${detailOpen ? 'border-accent-tint/50' : ''}`}
     >
       <div className="flex items-start gap-3">
         <button
```

**File**: `src/renderer/src/components/paper/discover/PaperSearchScope.tsx` (modified, +2/-72)
```diff
@@ -1,78 +1,8 @@
 import type { ReactElement } from 'react'
 import { Sparkles } from 'lucide-react'
 import { useTranslation } from 'react-i18next'
-import { PAPER_SEARCH_SOURCES, type PaperSearchSource } from '@shared/paper/paper-search'
 
-/** Source chips + year range shared by direct search and new Agent research. */
-export function PaperSearchScopeRow({
-  sources,
-  onToggleSource,
-  yearFrom,
-  yearTo,
-  onYearFrom,
-  onYearTo
-}: {
-  sources: readonly PaperSearchSource[]
-  onToggleSource: (source: PaperSearchSource) => void
-  yearFrom: string
-  yearTo: string
-  onYearFrom: (value: string) => void
-  onYearTo: (value: string) => void
-}): ReactElement {
-  const { t } = useTranslation('common')
-  return (
-    <div className="mt-3 flex flex-wrap items-center gap-1.5">
-      <span className="mr-1 text-[12px] text-ds-faint">{t('writePaperSearchSources')}</span>
-      {PAPER_SEARCH_SOURCES.map((source) => {
-        const active = sources.includes(source)
-        return (
-          <button
-            key={source}
-            type="button"
-            aria-pressed={active}
-            onClick={() => onToggleSource(source)}
-            className={`h-7 rounded-md border px-2.5 text-[12px] transition ${
-              active
-                ? 'border-transparent bg-[var(--ds-sidebar-row-active)] font-medium text-ds-ink'
-                : 'border-ds-border-muted text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
-            }`}
-          >
-            {t(`writePaperSearchSource_${source}`)}
-          </button>
-        )
-      })}
-      <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ds-faint">
-        {t('writePaperSearchYears')}
-        <YearInput value={yearFrom} onChange={onYearFrom} label={t('writePaperSearchYearFrom')} />
-        <span>–</span>
-        <YearInput value={yearTo} onChange={onYearTo} label={t('writePaperSearchYearTo')} />
-      </span>
-    </div>
-  )
-}
-
-function YearInput({
-  value,
-  onChange,
-  label
-}: {
-  value: string
-  onChange: (value: string) => void
-  label: string
-}): ReactElement {
-  return (
-    <input
-      value={value}
-      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
-      placeholder={label}
-      aria-label={label}
-      inputMode="numeric"
-      className="h-7 w-16 rounded-md border border-ds-border-muted bg-ds-main px-2 text-center text-[12px] tabular-nums text-ds-ink outline-none placeholder:text-ds-faint focus:border-[var(--ds-accent)]"
-    />
-  )
-}
-
-/** Direct search / Agent research switch shown on both views. */
+/** Agent research / quick search switch shown on both search views. */
 export function PaperSearchTabs({
   tab,
   onChange,
@@ -85,7 +15,7 @@ export function PaperSearchTabs({
   const { t } = useTranslation('common')
   return (
     <div className={`flex shrink-0 items-center rounded-lg border border-ds-border-muted bg-ds-subtle p-0.5 ${compact ? 'h-8' : 'h-10'}`}>
-      {(['direct', 'agent'] as const).map((value) => (
+      {(['agent', 'direct'] as const).map((value) => (
         <button
           key={value}
           type="button"
```

**File**: `src/renderer/src/components/paper/discover/PaperSearchView.tsx` (modified, +96/-108)
```diff
@@ -1,5 +1,5 @@
 import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
-import { BellPlus, History, Loader2, Search, Sparkles, X } from 'lucide-react'
+import { BellPlus, History, Loader2, Sparkles } from 'lucide-react'
 import { useTranslation } from 'react-i18next'
 import type { PaperSearchSource } from '@shared/paper/paper-search'
 import { paperViewOwnsKeyEvent } from './paper-view-keys'
@@ -14,7 +14,10 @@ import {
   writeSearchSources,
   type PaperSearchHistoryEntry
 } from '../../../paper/paper-search-prefs'
-import { PaperSearchScopeRow, PaperSearchTabs } from './PaperSearchScope'
+import { PaperSearchTabs } from './PaperSearchScope'
+import { PaperQuickSearchBar } from './PaperQuickSearchBar'
+import { PaperHeaderIconButton, PaperViewHeader } from '../PaperViewHeader'
+import { PaperResearchScopeChips, type PaperResearchScope } from '../research/PaperResearchScopeChips'
 import { PaperResearchView } from '../research/PaperResearchView'
 import { usePaperStore } from '../../../write/paper/paper-store'
 import { useWriteWorkspaceStore } from '../../../write/write-workspace-store'
@@ -201,146 +204,131 @@ export function PaperSearchView(): ReactElement {
   if (agentTab) return <PaperResearchView onShowDirect={() => setTab('direct')} />
 
   const busy = discover.searchLoading
-  return (
-    <div ref={rootRef} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
-      <div className="mx-auto w-full max-w-[1040px] px-6 pb-10 pt-8">
-        <h1 className="text-[20px] font-semibold tracking-tight text-ds-ink">{t('writePaperSearchTitle')}</h1>
-        <p className="mt-1 text-[12.5px] text-ds-muted">{t('writePaperSearchSubtitle')}</p>
+  const hasResult = Boolean(discover.searchResult) || (busy && Boolean(discover.searchQuery))
+  const scope: PaperResearchScope = { depth: 'standard', sources, yearFrom, yearTo }
+  const updateScope = (next: PaperResearchScope): void => {
+    if (next.sources !== sources) {
+      setSources(next.sources)
+      writeSearchSources(next.sources)
+    }
+    setYearFrom(next.yearFrom)
+    setYearTo(next.yearTo)
+  }
+  const scopeChips = <PaperResearchScopeChips scope={scope} onChange={updateScope} showDepth={false} />
+  const headerActions = hasResult ? (
+    <>
+      <PaperHeaderIconButton label={t('writePaperSearchSubscribe')} onClick={subscribeSearch}>
+        <BellPlus className="h-4 w-4" strokeWidth={1.8} />
+      </PaperHeaderIconButton>
+      <button
+        type="button"
+        onClick={handOffToAgent}
+        title={t('writePaperSearchAgentHint')}
+        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
+      >
+        <Sparkles className="h-3.5 w-3.5 text-[var(--ds-accent)]" strokeWidth={1.9} />
+        {t('paperResearchHandOff')}
+      </button>
+    </>
+  ) : null
 
-        <div className="mt-5 flex items-center gap-2">
-          <PaperSearchTabs tab="direct" onChange={setTab} />
-          <label className="relative flex h-10 min-w-0 flex-1 items-center">
-            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ds-faint" strokeWidth={1.9} />
-            <input
-              ref={inputRef}
+  return (
+    <div ref={rootRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
+      <PaperViewHeader leading={<PaperSearchTabs tab="direct" compact onChange={setTab} />} actions={headerActions} />
+      <div className="min-h-0 flex-1 overflow-y-auto">
+        {hasResult ? (
+          <div className="mx-auto w-full max-w-[960px] px-6 pb-10 pt-5">
+            <PaperQuickSearchBar
               value={input}
-              autoFocus
-              list="kun-paper-search-history"
-              onChange={(event) => setInput(event.target.value)}
-              onKeyDown={(event) => {
-                if (event.key === 'Enter' && !event.nativeEvent.isComposing) runSearch()
-              }}
-              placeholder={t('writePaperSearchQueryPlaceholder')}
-              aria-label={t('writePaperSearchQueryPlaceholder')}
-              className="h-10 w-full rounded-lg border border-ds-border bg-ds-main pl-9 pr-8 text-[14px] text-ds-ink shadow-sm outline-none transition placeholder:text-ds-faint focus:border-[var(--ds-accent)]"
+              onChange={setInput}
+              onSubmit={() => runSearch()}
+              busy={busy}
+              size="compact"
+              inputRef={inputRef}
             />
-            {input ? (
-              <button
-                type="button"
-                aria-label={t('clearSearch')}
-                onClick={() => setInput('')}
-                className="absolute right-2 rounded p-1 text-ds-faint hover:text-ds-ink"
-              >
-                <X className="h-3.5 w-3.5" strokeWidth={2} />
-              </button>
+            <div className="mt-2 px-1">{scopeChips}</div>
+            {discover.searchError ? (
+              <p className=
```

---

### Incident Patch 6: `c82e4d62` (2026-09-27)
**Commit Message**: fix(paper): keep research sessions, editor focus and arXiv today honest

- the library-level conversation never resolves to a research session
  thread (it used to take over the assistant rail after a research ran)
- an editor group only takes focus from selection/edit events when it
  owns DOM focus; notes editors reporting selection on load stole focus
  from the search view, which then never bound its research session
- arXiv today parses authors, all categories and ISO dates, strips the
  "arXiv:… Announce Type: … Abstract:" boilerplate, skips replacement
  announcements, and cleans cached entries on read

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/main/services/paper/arxiv-rss.test.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { describe, expect, it } from 'vitest'
+import { arxivRssDate, cleanArxivRssAbstract, parseArxivTodayRss } from './arxiv-rss'
+
+const RSS = `<rss><channel><title>cs.CL updates</title>
+<item>
+  <title>Stable and Faithful Explanations</title>
+  <link>https://arxiv.org/abs/2609.28502</link>
+  <description>arXiv:2609.28502v1 Announce Type: new
+Abstract: Knowledge tracing models predict student performance.</description>
+  <category>cs.LG</category>
+  <category>cs.CL</category>
+  <pubDate>Sat, 26 Sep 2026 00:00:00 -0400</pubDate>
+  <arxiv:announce_type>new</arxiv:announce_type>
+  <dc:creator>Ada Lovelace, Alan Turing and Grace Hopper</dc:creator>
+</item>
+<item>
+  <title>Old paper, new version</title>
+  <link>https://arxiv.org/abs/2401.00001</link>
+  <description>arXiv:2401.00001v3 Announce Type: replace Abstract: x</description>
+  <arxiv:announce_type>replace</arxiv:announce_type>
+</item>
+</channel></rss>`
+
+describe('arXiv today RSS', () => {
+  it('extracts authors, categories, a clean abstract and an ISO date', () => {
+    expect(parseArxivTodayRss(RSS, 'cs.CL')).toEqual([{
+      arxivId: '2609.28502',
+      title: 'Stable and Faithful Explanations',
+      authors: ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'],
+      abstract: 'Knowledge tracing models predict student performance.',
+      categories: ['cs.LG', 'cs.CL'],
+      publishedAt: '2026-09-26',
+      relevance: 0
+    }])
+  })
+
+  it('cleans cached raw values', () => {
+    expect(cleanArxivRssAbstract('arXiv:2609.1v1 Announce Type: cross Abstract: Text.')).toBe('Text.')
+    expect(cleanArxivRssAbstract('Plain abstract.')).toBe('Plain abstract.')
+    expect(arxivRssDate('Sat, 26 Sep 2026 00:00:00 -0400')).toBe('2026-09-26')
+    expect(arxivRssDate('2026-09-26')).toBe('2026-09-26')
+  })
+})
```

**File**: `src/main/services/paper/arxiv-rss.ts` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+import type { PaperArxivTodayItem } from '../../../shared/paper/paper-library-types'
+import { decodeEntities, stripTags } from './coolpapers-client'
+
+/**
+ * arXiv "new submissions" RSS (rss.arxiv.org/rss/<category>). Each item's
+ * description starts with `arXiv:<id>v1 Announce Type: new Abstract: …`,
+ * authors live in one comma-separated `dc:creator`, and every category the
+ * paper is listed under is its own `<category>`.
+ */
+
+const ABS_URL_RE = /arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/[0-9]{7})(v\d+)?/i
+const ABSTRACT_PREFIX_RE = /^\s*arXiv:\S+\s+Announce Type:\s*[\w-]+\s*(?:Abstract:\s*)?/i
+
+function tagText(block: string, tag: string): string | undefined {
+  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
+  if (!m) return undefined
+  const cdata = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
+  const text = decodeEntities(stripTags(cdata)).replace(/\s+/g, ' ').trim()
+  return text || undefined
+}
+
+/** Drop the RSS boilerplate before the abstract (also cleans older cache entries). */
+export function cleanArxivRssAbstract(raw: string | undefined): string | undefined {
+  if (!raw) return undefined
+  const text = raw.replace(ABSTRACT_PREFIX_RE, '').trim()
+  return text || undefined
+}
+
+/** RFC-822 pubDate → YYYY-MM-DD; other strings pass through unchanged. */
+export function arxivRssDate(raw: string | undefined): string | undefined {
+  if (!raw) return undefined
+  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
+  const time = Date.parse(raw)
+  return Number.isNaN(time) ? raw : new Date(time).toISOString().slice(0, 10)
+}
+
+export function parseArxivTodayRss(xml: string, fallbackCategory: string): PaperArxivTodayItem[] {
+  const items: PaperArxivTodayItem[] = []
+  for (const match of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)) {
+    const block = match[1]
+    const title = tagText(block, 'title')
+    const link = tagText(block, 'link') ?? ''
+    const arxivId = ABS_URL_RE.exec(link)?.[1]
+    if (!title || !arxivId) continue
+    const announce = tagText(block, 'arxiv:announce_type')
+    // Replacements are old papers re-announced with a new version; skip them.
+    if (announce && /replace/i.test(announce)) continue
+    const categories = [...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)]
+      .map((m) => decodeEntities(stripTags(m[1])).trim())
+      .filter(Boolean)
+    const authors = (tagText(block, 'dc:creator') ?? '')
+      .split(/\s*,\s*|\s+and\s+/)
+      .map((name) => name.trim())
+      .filter(Boolean)
+    items.push({
+      arxivId,
+      title,
+      authors,
+      abstract: cleanArxivRssAbstract(tagText(block, 'description')),
+      categories: categories.length ? [...new Set(categories)] : [fallbackCategory],
+      publishedAt: arxivRssDate(tagText(block, 'pubDate')),
+      relevance: 0
+    })
+  }
+  return items
+}
```

**File**: `src/main/services/paper/paper-discover-service.ts` (modified, +13/-14)
```diff
@@ -6,6 +6,7 @@ import type {
   PaperTitleSearchCandidate
 } from '../../../shared/paper/paper-library-types'
 import { decodeEntities, stripTags } from './coolpapers-client'
+import { arxivRssDate, cleanArxivRssAbstract, parseArxivTodayRss } from './arxiv-rss'
 import type { PaperFetchContext } from './arxiv-client'
 import { searchArxivByTitle } from './arxiv-client'
 import { scholarSearchByTitle } from './scholar-client'
@@ -151,7 +152,16 @@ async function readArxivTodayCache(cacheDir: string, date: string): Promise<Arxi
   try {
     const raw = await readFile(arxivTodayCachePath(cacheDir, date), 'utf8')
     const parsed = JSON.parse(raw) as ArxivTodayCache
-    return parsed.date === date && Array.isArray(parsed.items) ? parsed : null
+    if (parsed.date !== date || !Array.isArray(parsed.items)) return null
+    // Older caches kept the raw RSS description and date; tidy them on read.
+    return {
+      ...parsed,
+      items: parsed.items.map((item) => ({
+        ...item,
+        abstract: cleanArxivRssAbstract(item.abstract),
+        publishedAt: arxivRssDate(item.publishedAt)
+      }))
+    }
   } catch {
     return null
   }
@@ -181,19 +191,8 @@ export async function fetchArxivToday(input: {
         timeoutMs: 20_000,
         maxBytes: PAPER_HTML_MAX_BYTES
       })
-      for (const item of parseRssItems(xml).items) {
-        const arxivId = ARXIV_ABS_RE.exec(item.url)?.[1]?.replace(/v\d+$/, '')
-          ?? item.arxivId
-        if (!arxivId || seen.has(arxivId)) continue
-        seen.set(arxivId, {
-          arxivId,
-          title: item.title,
-          authors: [],
-          abstract: item.summary,
-          categories: [category],
-          publishedAt: item.publishedAt,
-          relevance: 0
-        })
+      for (const item of parseArxivTodayRss(xml, category)) {
+        if (!seen.has(item.arxivId)) seen.set(item.arxivId, item)
       }
     }
   } catch (error) {
```

**File**: `src/renderer/src/components/write/WriteEditorGroups.tsx` (modified, +12/-2)
```diff
@@ -49,6 +49,13 @@ type Props = {
   onImportPaper?: () => void
   onPickWorkspace: () => void
 }
+
+/** True when keyboard focus is inside the given editor group's DOM. */
+function groupOwnsDomFocus(groupId: string): boolean {
+  if (typeof document === 'undefined') return false
+  const section = document.querySelector(`[data-editor-group-id="${CSS.escape(groupId)}"]`)
+  return Boolean(section && document.activeElement && section.contains(document.activeElement))
+}
 export function WriteEditorGroups({
   workspaceName,
   workspacePathLabel,
@@ -235,6 +242,7 @@ export function WriteEditorGroups({
               expandedGroupId && expandedGroupId !== group.id ? 'hidden' : 'flex'
             }`}
             data-focused={focused}
+            data-editor-group-id={group.id}
             style={{
               flex: expandedGroupId
                 ? (expandedGroupId === group.id ? '1 1 100%' : '0 0 0%')
@@ -317,11 +325,13 @@ export function WriteEditorGroups({
                   onRefreshWorkspace={() => void refreshWorkspace(workspaceRoot)}
                   onContentChange={(content) => { if (path) setDocumentContent(path, content) }}
                   onDocumentEdit={(edits) => {
-                    if (!focused) focusEditorGroup(group.id)
+                    if (!focused && groupOwnsDomFocus(group.id)) focusEditorGroup(group.id)
                     recordRecentEdits(edits)
                   }}
                   onSelectionChange={(selection) => {
-                    if (!focused) focusEditorGroup(group.id)
+                    // Editors report selection on load too; only a group the
+                    // user is actually in may take editor focus.
+                    if (!focused && groupOwnsDomFocus(group.id)) focusEditorGroup(group.id)
                     setSelection(selection)
                   }}
                   onPresentationViewChange={(view, source) => {
```

**File**: `src/renderer/src/paper/paper-research-sessions.test.ts` (modified, +16/-0)
```diff
@@ -63,3 +63,19 @@ describe('buildPaperResearchBrief', () => {
       .toBe('x\n\n[paper-research] depth=quick; sources=default; years=any')
   })
 })
+
+describe('library-level conversation', () => {
+  it('never resolves to a research session thread', async () => {
+    const { activeWriteThreadForWorkspace } = await import('../write/write-thread-registry')
+    let registry = emptyWriteThreadRegistry()
+    registry = markWriteThread(ROOT, 'library-thread', registry)
+    registry = markWriteThread(ROOT, 'research-thread', registry, researchResourcePath(ROOT, 'rs-aaa-000001'))
+    const threads = [
+      thread('library-thread', 'Library chat', '2026-09-01T00:00:00Z'),
+      thread('research-thread', 'Research', '2026-09-02T00:00:00Z')
+    ]
+    expect(activeWriteThreadForWorkspace(ROOT, threads, registry)?.id).toBe('library-thread')
+    expect(activeWriteThreadForWorkspace(ROOT, threads, registry, researchResourcePath(ROOT, 'rs-aaa-000001'))?.id)
+      .toBe('research-thread')
+  })
+})
```

**File**: `src/renderer/src/write/write-thread-registry.ts` (modified, +16/-2)
```diff
@@ -501,6 +501,15 @@ export function writeThreadIdsForFile(
   return [...(record.fileThreadHistoryIds[fileKey] ?? [])]
 }
 
+/** Threads bound to virtual `.kun-research/<session>` resources. */
+function researchThreadIds(record: WriteThreadWorkspaceRecord): Set<string> {
+  const ids = new Set<string>()
+  for (const [fileKey, threadIds] of Object.entries(record.fileThreadHistoryIds)) {
+    if (/\/\.kun-research\/[^/]+$/.test(fileKey)) for (const id of threadIds) ids.add(id)
+  }
+  return ids
+}
+
 export function activeWriteThreadForWorkspace(
   workspaceRoot: string,
   threads: NormalizedThread[],
@@ -512,10 +521,15 @@ export function activeWriteThreadForWorkspace(
   const record = registry.workspaces[key]
   if (!record) return null
   const fileKey = writeFileKey(filePath)
-  const targetThreadId = fileKey ? record.fileThreadIds[fileKey] : record.activeThreadId
+  // Paper research sessions own their thread; never let one stand in for the
+  // library-level (no file) conversation just because it was used last.
+  const researchIds = fileKey ? null : researchThreadIds(record)
+  const targetThreadId = fileKey
+    ? record.fileThreadIds[fileKey]
+    : researchIds?.has(record.activeThreadId) ? undefined : record.activeThreadId
   const candidateIds = fileKey
     ? record.fileThreadHistoryIds[fileKey] ?? (targetThreadId ? [targetThreadId] : [])
-    : record.threadIds
+    : record.threadIds.filter((id) => !researchIds?.has(id))
   if (fileKey && candidateIds.length === 0) return null
   const candidates = candidateIds
     .map((id) => threads.find((thread) => thread.id === id) ?? null)
```

---

### Incident Patch 7: `3b57743b` (2026-09-27)
**Commit Message**: fix(paper): pass assistant stage props to the workbench content

The Agent research stage read a null WriteAssistantStageContext because
Workbench never forwarded writeAssistantStageProps from the shell runtime,
so the stage showed "assistant not ready" instead of the conversation.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/renderer/src/components/Workbench.tsx` (modified, +2/-2)
```diff
@@ -580,7 +580,7 @@ export function Workbench(): ReactElement {
 
   const {
     chatComposerProps, conversationRuntimeBanner, imageAnnotationHost, planOverlay,
-    rightPanel, rightPanelSharedProps, writeRuntimeBanner, focusedCanvasWorkspace
+    rightPanel, rightPanelSharedProps, writeRuntimeBanner, focusedCanvasWorkspace, writeAssistantStageProps
   } = useWorkbenchShellRuntime({
     canvasFocusMode,
     exitCanvasFocusMode,
@@ -655,7 +655,7 @@ export function Workbench(): ReactElement {
     designWorkspaceRoot, workspaceRoot, designAssistantModel, resolvedDesignAssistantProviderId,
     designAssistantPickList, setDesignAssistantModel, designComposerReasoningEffort,
     composerFastMode, setDesignComposerReasoningEffort, setComposerFastMode, designContextChips,
-    removeDesignContextChip, input, rightPanel, writeRuntimeBanner, setInput, sendWritePrompt,
+    removeDesignContextChip, input, rightPanel, writeRuntimeBanner, writeAssistantStageProps, setInput, sendWritePrompt,
     conversationRuntimeBanner, activeSddDraft, rightPanelMode, toggleSddAssistantPanel,
     quoteToSddAssistant, sendSddPrototypeTurn, exploreSddRequirementInDesign, handleSddNextStep,
     dismissActiveSddDraft, sddDraftOperationStatus, stageInsetClass, uiModeCameosEnabled,
```

---

### Incident Patch 8: `05d12bf5` (2026-09-26)
**Commit Message**: test(paper): render research stage states and paper tool rows

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/renderer/src/components/chat/paper-tool-process.test.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import { describe, expect, it } from 'vitest'
+import type { ToolBlock } from '../../agent/types'
+import { paperToolName, paperToolProcessDetail, summarizePaperToolBlock } from './paper-tool-process'
+
+const t = (key: string, opts?: Record<string, unknown>): string =>
+  opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${String(v)}`).join(',')})` : key
+
+function block(toolName: string, args: Record<string, unknown>, meta: Record<string, unknown> = {}): ToolBlock {
+  return { kind: 'tool', id: 'b', summary: toolName, status: 'success', detail: JSON.stringify(args), meta: { toolName, ...meta } }
+}
+
+const SEARCH_META = {
+  version: 1,
+  query: 'agents',
+  total: 26,
+  papers: [{ id: '2401.00001', title: 'A', authors: [], sources: ['arxiv'] }],
+  sources: [
+    { source: 'arxiv', count: 10, ms: 5 },
+    { source: 'semantic_scholar', count: 0, ms: 5, error: 'HTTP 429' }
+  ]
+}
+
+describe('paper tool rows', () => {
+  it('recognizes Kun and SDK-bridged tool names', () => {
+    expect(paperToolName('paper_search')).toBe('paper_search')
+    expect(paperToolName('mcp__kun__paper_report')).toBe('paper_report')
+    expect(paperToolName('web_search')).toBeNull()
+  })
+
+  it('summarizes a search with its query, count and failed sources', () => {
+    const summary = summarizePaperToolBlock(block('paper_search', { query: 'code agents' }, { paperSearch: SEARCH_META }), 'paper_search', t)
+    expect(summary).toBe('paperToolSearch “code agents” · paperToolPaperCount(count=26) · paperToolFailed(sources=writePaperSearchSource_semantic_scholar)')
+  })
+
+  it('summarizes citation walks by direction', () => {
+    expect(summarizePaperToolBlock(block('paper_citations', { seed_id: '10.1/x', direction: 'citations' }), 'paper_citations', t))
+      .toBe('paperToolCitations · paperToolCitedBy(seed=10.1/x)')
+  })
+
+  it('exposes the hit list only for validated meta', () => {
+    expect(paperToolProcessDetail(block('paper_search', {}, { paperSearch: SEARCH_META }), 'paper_search')?.kind).toBe('paper-search')
+    expect(paperToolProcessDetail(block('paper_search', {}, { paperSearch: { version: 2 } }), 'paper_search')).toBeNull()
+    expect(paperToolProcessDetail(block('paper_report', {}), 'paper_report')).toBeNull()
+  })
+})
```

**File**: `src/renderer/src/components/paper/research/PaperResearchView.render.test.ts` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+/** @vitest-environment jsdom */
+import { act, createElement } from 'react'
+import { createRoot, type Root } from 'react-dom/client'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import type { ChatBlock, NormalizedThread } from '../../../agent/types'
+import { useChatStore } from '../../../store/chat-store'
+import { useWriteWorkspaceStore } from '../../../write/write-workspace-store'
+import { markWriteThread, readWriteThreadRegistry, saveWriteThreadRegistry } from '../../../write/write-thread-registry'
+import { researchResourcePath } from '../../../paper/paper-research-sessions'
+import { WriteAssistantStageContext, type WriteAssistantStageProps } from '../../write/WriteAssistantStageContext'
+import { PaperResearchView } from './PaperResearchView'
+
+vi.mock('../../chat/LazyMessageTimeline', () => ({
+  LazyMessageTimeline: (props: { blocks: ChatBlock[] }) =>
+    createElement('div', { 'data-testid': 'timeline' }, `blocks:${props.blocks.length}`)
+}))
+vi.mock('../../chat/FloatingComposer', () => ({
+  FloatingComposer: () => createElement('div', { 'data-testid': 'composer' })
+}))
+
+const ROOT = '/Users/me/papers-lib'
+const SESSION = 'rs-test-000001'
+
+function searchBlock(): ChatBlock {
+  return {
+    kind: 'tool',
+    id: 'tool-1',
+    summary: 'paper_search',
+    status: 'success',
+    meta: {
+      toolName: 'paper_search',
+      paperSearch: {
+        version: 1,
+        query: 'agents',
+        total: 1,
+        papers: [{ id: '2401.00001', title: 'Pool Paper About Agents', authors: ['A'], sources: ['arxiv'], arxivId: '2401.00001' }],
+        sources: [{ source: 'arxiv', count: 1, ms: 5 }]
+      }
+    }
+  }
+}
+
+function assistant(overrides: Partial<WriteAssistantStageProps> = {}): WriteAssistantStageProps {
+  return {
+    blocks: [],
+    liveReasoning: '',
+    liveAssistant: '',
+    activeThreadId: null,
+    runtimeConnection: 'ready',
+    busy: false,
+    input: '',
+    setInput: () => undefined,
+    onInterrupt: () => undefined,
+    onRetryConnection: () => undefined,
+    onOpenSettings: () => undefined,
+    ...overrides
+  } as unknown as WriteAssistantStageProps
+}
+
+let root: Root
+let host: HTMLElement
+
+async function render(props: WriteAssistantStageProps): Promise<void> {
+  await act(async () => {
+    root.render(createElement(
+      WriteAssistantStageContext.Provider,
+      { value: props },
+      createElement(PaperResearchView, { onShowDirect: () => undefined })
+    ))
+  })
+}
+
+describe('PaperResearchView', () => {
+  beforeEach(() => {
+    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
+    const data = new Map<string, string>()
+    Object.defineProperty(window, 'localStorage', {
+      configurable: true,
+      value: {
+        getItem: (key: string) => data.get(key) ?? null,
+        setItem: (key: string, value: string) => { data.set(key, String(value)) },
+        removeItem: (key: string) => { data.delete(key) },
+        clear: () => data.clear(),
+        key: (index: number) => [...data.keys()][index] ?? null,
+        get length() { return data.size }
+      }
+    })
+    host = document.createElement('div')
+    document.body.appendChild(host)
+    root = createRoot(host)
+    useWriteWorkspaceStore.setState({ workspaceRoot: ROOT, paperResearch: { agentTab: true, sessionId: null } })
+    useChatStore.setState({ threads: [] })
+  })
+
+  afterEach(async () => {
+    await act(async () => root.unmount())
+    host.remove()
+  })
+
+  it('shows the new-research form when no session is selected', async () => {
+    await render(assistant())
+    expect(host.querySelector('textarea')).not.toBeNull()
+    expect(host.textContent).toContain('Agent literature research')
+    expect(host.querySelector('[data-testid="timeline"]')).toBeNull()
+  })
+
+  it('renders the session conversation and its paper pool once the thread is bound', async () => {
+    saveWriteThreadRegistry(markWriteThread(ROOT, 'thread-1', readWriteThreadRegistry(), researchResourcePath(ROOT, SESSION)))
+    useChatStore.setState({
+      threads: [{ id: 'thread-1', title: 'Agents question', updatedAt: '2026-09-26T00:00:00Z', model: 'm', mode: 'agent', workspace: ROOT, agentSurface: 'write' } as NormalizedThread]
+    })
+    useWriteWorkspaceStore.setState({ paperResearch: { agentTab: true, sessionId: SESSION } })
+    await render(assistant({ activeThreadId: 'thread-1', blocks: [searchBlock()] }))
+    expect(host.querySelector('[data-testid="timeline"]')?.textContent).toBe('blocks:1')
+    expect(host.querySelector('[data-testid="composer"]')).not.toBeNull()
+    expect(host.textContent).toContain('Agents question')
+    expect(host.textContent).toContain('Pool Paper About Agents')
+  })
+
+  it('waits instead of showing another thread while the session is selecting', async () => {
+    saveWriteThreadRegistry(markWriteThread(ROOT, 'thread-1', readWriteThreadRegistry(),
```

---

### Incident Patch 9: `30be5060` (2026-09-26)
**Commit Message**: fix(paper): harden paper search before the research stage

- OpenReview: query forum notes only and split hyphenated terms (reviews
  and comments without titles crowded out every paper)
- dblp: report the bot-check page instead of a JSON parse error
- paper_report verifies ids per research conversation: seen stores are
  keyed by the root thread (delegated children fold into their parent)
- omitted `sources` means engine defaults within the enabled allow-list,
  not every enabled index; details cards name the index that resolved them
- Agent SDK and Cursor runtimes carry tool-result `meta` to the synthesized
  tool_result item, so paper cards render on subscription engines
- search view shortcuts only react while the view owns the keyboard, so a
  PDF or chat pane next to it keeps its arrow keys
- explicit source retry bypasses the auto-skip window
- one Semantic Scholar key (legacy scholar key migrates), and stored keys
  can be cleared explicitly instead of being unremovable

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `kun/src/adapters/tool/paper-search-tool-provider.ts` (modified, +45/-20)
```diff
@@ -17,9 +17,14 @@ import {
   type PaperSearchCredentials,
   type PaperSearchFetch,
   type PaperSearchResponse,
+  type PaperSearchSource,
   type PaperSourceHit
 } from '../../services/paper-search/paper-search.js'
-import { PaperSeenStore } from '../../services/paper-search/paper-search-seen-store.js'
+import {
+  PaperSeenScopes,
+  resolveRootThreadId,
+  type PaperSeenStore
+} from '../../services/paper-search/paper-search-seen-store.js'
 import {
   fetchPaperCitationNeighbors,
   fetchPaperDetails
@@ -60,13 +65,19 @@ export type PaperSearchToolOptions = {
   /** Test seam / shared engine state; defaults are process-wide singletons. */
   cache?: PaperSearchCache<PaperSourceHit[]>
   rateLimiter?: PaperRateLimiter
+  /** Test seam: one fixed store for every conversation. */
   seen?: PaperSeenStore
+  /**
+   * Parent link of a thread (delegated children point at their parent) so
+   * findings are recorded under the research conversation's root thread.
+   */
+  parentThreadId?: (threadId: string) => Promise<string | undefined>
 }
 
 type SharedPaperState = {
   cache: PaperSearchCache<PaperSourceHit[]>
   rateLimiter: PaperRateLimiter
-  seen: PaperSeenStore
+  seenScopes: PaperSeenScopes
 }
 
 let sharedState: SharedPaperState | undefined
@@ -75,7 +86,7 @@ function defaultSharedState(): SharedPaperState {
   sharedState ??= {
     cache: new PaperSearchCache<PaperSourceHit[]>(),
     rateLimiter: new PaperRateLimiter(),
-    seen: new PaperSeenStore()
+    seenScopes: new PaperSeenScopes()
   }
   return sharedState
 }
@@ -120,17 +131,23 @@ export function buildPaperSearchToolProvider(options: PaperSearchToolOptions): C
   const shared = defaultSharedState()
   const cache = options.cache ?? shared.cache
   const rateLimiter = options.rateLimiter ?? shared.rateLimiter
-  const seen = options.seen ?? shared.seen
+  // `paper_report` may only verify papers found in the same research
+  // conversation (root thread + its delegated children).
+  const seenFor = async (threadId: string | undefined): Promise<PaperSeenStore> => {
+    if (options.seen) return options.seen
+    const root = threadId && options.parentThreadId
+      ? await resolveRootThreadId(threadId, options.parentThreadId)
+      : threadId ?? ''
+    return shared.seenScopes.scope(root)
+  }
 
   const fetchFor = (): PaperSearchFetch | undefined => {
     const proxyUrl = options.proxyUrl()?.trim()
     return proxyUrl ? ((createProxyFetch(proxyUrl) as PaperSearchFetch | null) ?? undefined) : undefined
   }
 
-  // Session-wide seen store: delegated literature children run in their own
-  // thread, so findings are recorded process-wide for `paper_report`.
-  const remember = (cards: PaperSearchCardHit[]): void => {
-    seen.record(cards)
+  const remember = async (threadId: string | undefined, cards: PaperSearchCardHit[]): Promise<void> => {
+    ;(await seenFor(threadId)).record(cards)
   }
 
   const searchTool = LocalToolHost.defineTool({
@@ -172,16 +189,23 @@ export function buildPaperSearchToolProvider(options: PaperSearchToolOptions): C
     execute: async (args, context) => {
       const query = typeof args?.query === 'string' ? args.query.trim() : ''
       if (!query) return { output: 'paper_search failed: query is required.', isError: true }
-      const enabled = options.enabledSources?.()
-      const requested = Array.isArray(args?.sources)
-        ? args.sources.filter((s: unknown): s is string => typeof s === 'string') as never
-        : undefined
+      const known = (values: readonly unknown[]): PaperSearchSource[] =>
+        values.filter((value): value is PaperSearchSource =>
+          typeof value === 'string' && (PAPER_SEARCH_SOURCES as readonly string[]).includes(value)
+        )
+      const enabled = options.enabledSources ? known(options.enabledSources() ?? []) : []
+      const requested = Array.isArray(args?.sources) ? known(args.sources) : undefined
       const credentials = options.credentials?.()
-      const baseSources = enabled?.length
-        ? (requested ?? [...PAPER_SEARCH_SOURCES]).filter((s) => enabled.includes(s as never))
-        : requested
+      // Settings are an allow-list; an omitted `sources` arg still means the
+      // engine defaults (narrowed to what is enabled), not every enabled index.
+      let baseSources: PaperSearchSource[] | undefined = requested
+      if (enabled.length) {
+        const defaultsWithinEnabled = DEFAULT_PAPER_SEARCH_SOURCES.filter((s) => enabled.includes(s))
+        baseSources = (requested ?? (defaultsWithinEnabled.length ? defaultsWithinEnabled : enabled))
+          .filter((s) => enabled.includes(s))
+      }
       const sources = (baseSources ?? []).filter((s) => s !== 'core' || credentials?.coreApiKey)
-      if (enabled?.length && !sources.length) {
+      if (enabled.length && !sources.length) {
         return {
           output: `paper_search: none of the requested sources are enabled; enabled sources: ${enabled.join(', ')}.`,
     
```

**File**: `kun/src/adapters/tool/paper-search-tool-scopes.test.ts` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+import { afterEach, describe, expect, it, vi } from 'vitest'
+import { buildPaperSearchToolProvider } from './paper-search-tool-provider.js'
+import {
+  PaperSeenScopes,
+  resolveRootThreadId
+} from '../../services/paper-search/paper-search-seen-store.js'
+import type { ToolHostContext } from '../../ports/tool-host.js'
+
+const WORK = {
+  display_name: 'Scoped Paper About Agents',
+  publication_year: 2024,
+  doi: 'https://doi.org/10.1234/scoped'
+}
+
+function context(threadId: string): ToolHostContext {
+  return { threadId, turnId: 'turn', workspace: '/tmp/ws', agentSurface: 'write' } as ToolHostContext
+}
+
+function stubOpenAlex(): ReturnType<typeof vi.fn> {
+  const impl = vi.fn(async (input: unknown): Promise<Response> => {
+    const url = String(input)
+    if (url.includes('api.openalex.org')) return Response.json({ results: [WORK] })
+    return Response.json({ data: [], results: [], feed: '' })
+  })
+  vi.stubGlobal('fetch', impl as unknown as typeof fetch)
+  return impl
+}
+
+function tools(parents: Record<string, string> = {}, enabledSources?: string[]) {
+  const [provider] = buildPaperSearchToolProvider({
+    proxyUrl: () => undefined,
+    parentThreadId: async (id) => parents[id],
+    ...(enabledSources ? { enabledSources: () => enabledSources } : {})
+  })
+  return new Map(provider!.tools.map((tool) => [tool.name, tool]))
+}
+
+const REPORT = {
+  papers: [{ id: '10.1234/scoped', title: 'Scoped Paper About Agents', reason: 'Relevant.' }]
+}
+
+describe('paper tools per-conversation verification', () => {
+  afterEach(() => vi.unstubAllGlobals())
+
+  it('does not verify papers found in a different conversation', async () => {
+    stubOpenAlex()
+    const map = tools()
+    await map.get('paper_search')!.execute({ query: 'scoped agents a', sources: ['openalex'] }, context('scope-a'))
+    const other = await map.get('paper_report')!.execute(REPORT, context('scope-b'))
+    const otherList = other.meta?.paperList as { papers: Array<{ verified: boolean }> }
+    expect(otherList.papers[0]?.verified).toBe(false)
+    const same = await map.get('paper_report')!.execute(REPORT, context('scope-a'))
+    const sameList = same.meta?.paperList as { papers: Array<{ verified: boolean }> }
+    expect(sameList.papers[0]?.verified).toBe(true)
+  })
+
+  it('credits delegated children to the root conversation', async () => {
+    stubOpenAlex()
+    const map = tools({ 'child-1': 'root-1' })
+    await map.get('paper_search')!.execute({ query: 'scoped agents child', sources: ['openalex'] }, context('child-1'))
+    const report = await map.get('paper_report')!.execute(REPORT, context('root-1'))
+    const list = report.meta?.paperList as { papers: Array<{ verified: boolean }> }
+    expect(list.papers[0]?.verified).toBe(true)
+  })
+
+  it('uses the defaults within the enabled allow-list when sources are omitted', async () => {
+    const impl = stubOpenAlex()
+    const map = tools({}, ['openalex', 'crossref', 'europepmc'])
+    await map.get('paper_search')!.execute({ query: 'scoped agents defaults' }, context('scope-defaults'))
+    const hosts = new Set(impl.mock.calls.map(([url]) => new URL(String(url)).hostname))
+    expect([...hosts]).toEqual(['api.openalex.org'])
+  })
+})
+
+describe('paper seen scopes', () => {
+  it('walks parent links to the root and stops on cycles', async () => {
+    const parents: Record<string, string> = { c: 'b', b: 'a', loop: 'loop' }
+    const parentOf = async (id: string): Promise<string | undefined> => parents[id]
+    expect(await resolveRootThreadId('c', parentOf)).toBe('a')
+    expect(await resolveRootThreadId('loop', parentOf)).toBe('loop')
+    expect(await resolveRootThreadId('x', async () => { throw new Error('gone') })).toBe('x')
+  })
+
+  it('evicts the least recently used conversation', () => {
+    const scopes = new PaperSeenScopes(2)
+    scopes.scope('a').record([{ id: '1', title: 'Alpha paper title', authors: [], sources: ['arxiv'] }])
+    scopes.scope('b')
+    scopes.scope('a')
+    scopes.scope('c')
+    expect(scopes.scope('a').hasAny()).toBe(true)
+    expect(scopes.scope('b').hasAny()).toBe(false)
+  })
+})
```

**File**: `kun/src/runtime/agent-sdk/agent-sdk-runtime-factory-tools.ts` (modified, +4/-0)
```diff
@@ -116,6 +116,7 @@ const SDK_ON_REQUEST_AUTO_ALLOWED_TOOLS = new Set([
   'TodoWrite'
 ])
 import { isPendingReceiptOutput } from '../../services/canvas-receipt-registry.js'
+import { stashSdkToolResultMeta } from './sdk-tool-result-meta.js'
 import type { AgentSdkRuntimeFactoryDeps } from './agent-sdk-runtime-factory-contracts.js'
 import { resolveTurnPlanContext } from './agent-sdk-runtime-factory-plan.js'
 import type { AgentSdkFactoryContext } from './agent-sdk-runtime-factory-context.js'
@@ -243,6 +244,9 @@ export function createAgentSdkToolRuntimeDeps(
           if (finalized) return finalized
           return { output: 'Renderer receipt timed out; the canvas was not verified.', isError: true }
         }
+        // The SDK stream later synthesizes the tool_result item; park the
+        // client sideband so the event mapper can attach it.
+        stashSdkToolResultMeta(threadId, sdkCallId, result.item.meta)
         return { output: result.item.output, isError: result.item.isError }
       } catch (err) {
         return { output: err instanceof Error ? err.message : String(err), isError: true }
```

**File**: `kun/src/runtime/agent-sdk/sdk-event-mapper.ts` (modified, +6/-1)
```diff
@@ -30,6 +30,7 @@ import {
   makeToolCallItem,
   makeToolResultItem
 } from '../../domain/item.js'
+import { takeSdkToolResultMeta } from './sdk-tool-result-meta.js'
 import type {
   SdkApiMessage,
   SdkContentBlock,
@@ -451,6 +452,9 @@ export class SdkEventMapper {
       try { output = JSON.parse(output) } catch { /* Plain-text Kun result. */ }
     }
     this.toolNames.delete(block.tool_use_id)
+    const meta = rawToolName.startsWith('mcp__kun__')
+      ? takeSdkToolResultMeta(this.ctx.threadId, block.tool_use_id)
+      : undefined
     return {
       kind: 'tool_call_finished',
       threadId: this.ctx.threadId,
@@ -465,7 +469,8 @@ export class SdkEventMapper {
         toolKind: toolKindFor(toolName),
         output,
         isError: block.is_error === true,
-        status: block.is_error === true ? 'failed' : 'completed'
+        status: block.is_error === true ? 'failed' : 'completed',
+        ...(meta ? { meta } : {})
       })
     }
   }
```

**File**: `kun/src/runtime/agent-sdk/sdk-tool-result-meta.test.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import { afterEach, describe, expect, test } from 'vitest'
+import { SdkEventMapper } from './sdk-event-mapper.js'
+import type { SdkMessage } from './sdk-protocol.js'
+import {
+  clearSdkToolResultMetaForTests,
+  stashSdkToolResultMeta,
+  takeSdkToolResultMeta
+} from './sdk-tool-result-meta.js'
+
+function mapToolRound(mapper: SdkEventMapper, name: string, id: string): unknown {
+  mapper.map({
+    type: 'assistant',
+    parent_tool_use_id: null,
+    message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input: {} }] }
+  } as SdkMessage)
+  return mapper.map({
+    type: 'user',
+    parent_tool_use_id: null,
+    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] }
+  } as SdkMessage)[0]
+}
+
+describe('SDK tool-result meta handoff', () => {
+  afterEach(() => clearSdkToolResultMetaForTests())
+
+  test('attaches parked meta to the synthesized Kun tool_result once', () => {
+    let n = 0
+    const mapper = new SdkEventMapper({ threadId: 'th', turnId: 'tn', nextId: (p) => `${p}_${++n}` })
+    stashSdkToolResultMeta('th', 'toolu_1', { paperList: { version: 1, papers: [] } })
+    expect(mapToolRound(mapper, 'mcp__kun__paper_report', 'toolu_1')).toMatchObject({
+      item: { kind: 'tool_result', meta: { paperList: { version: 1 } } }
+    })
+    expect(takeSdkToolResultMeta('th', 'toolu_1')).toBeUndefined()
+  })
+
+  test('never attaches meta to non-Kun tools or other threads', () => {
+    let n = 0
+    const mapper = new SdkEventMapper({ threadId: 'th', turnId: 'tn', nextId: (p) => `${p}_${++n}` })
+    stashSdkToolResultMeta('other', 'toolu_2', { x: 1 })
+    stashSdkToolResultMeta('th', 'toolu_3', { x: 1 })
+    const kunOtherThread = mapToolRound(mapper, 'mcp__kun__paper_search', 'toolu_2') as { item: { meta?: unknown } }
+    const builtin = mapToolRound(mapper, 'Bash', 'toolu_3') as { item: { meta?: unknown } }
+    expect(kunOtherThread.item.meta).toBeUndefined()
+    expect(builtin.item.meta).toBeUndefined()
+  })
+})
```

**File**: `kun/src/runtime/agent-sdk/sdk-tool-result-meta.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+/**
+ * Client-facing tool-result sideband (`ToolResultTurnItem.meta`) for the
+ * Agent SDK path. The SDK only carries `output` text back through its MCP
+ * bridge, and the tool_result item is later synthesized from the SDK stream
+ * (`sdk-event-mapper`), so Kun-executed tools park their `meta` here keyed
+ * by thread + SDK tool_use id until the mapper claims it. Bounded so
+ * results the stream never reports cannot accumulate.
+ */
+
+const MAX_ENTRIES = 256
+
+const pending = new Map<string, Record<string, unknown>>()
+
+function key(threadId: string, callId: string): string {
+  return `${threadId}\u0000${callId}`
+}
+
+export function stashSdkToolResultMeta(
+  threadId: string,
+  callId: string | undefined,
+  meta: Record<string, unknown> | undefined
+): void {
+  if (!callId || !meta) return
+  const entryKey = key(threadId, callId)
+  pending.delete(entryKey)
+  pending.set(entryKey, meta)
+  while (pending.size > MAX_ENTRIES) {
+    const oldest = pending.keys().next()
+    if (oldest.done) break
+    pending.delete(oldest.value)
+  }
+}
+
+export function takeSdkToolResultMeta(
+  threadId: string,
+  callId: string
+): Record<string, unknown> | undefined {
+  const entryKey = key(threadId, callId)
+  const meta = pending.get(entryKey)
+  if (meta) pending.delete(entryKey)
+  return meta
+}
+
+export function clearSdkToolResultMetaForTests(): void {
+  pending.clear()
+}
```

**File**: `kun/src/runtime/cursor/cursor-sdk-event-mapper.ts` (modified, +4/-1)
```diff
@@ -1,4 +1,5 @@
 import type { SDKMessage, TokenUsage } from '@cursor/sdk'
+import { takeSdkToolResultMeta } from '../agent-sdk/sdk-tool-result-meta.js'
 import { DEFAULT_MODEL_STREAM_LIMITS } from '../../adapters/model/model-stream-resource-budget.js'
 import type { TurnItem } from '../../contracts/items.js'
 import {
@@ -471,6 +472,7 @@ export class CursorSdkEventMapper {
       })
     }
     const resultId = `item_cursor_result_${this.ctx.turnId}_${message.call_id}`
+    const resultMeta = takeSdkToolResultMeta(this.ctx.threadId, message.call_id)
     events.push({
       kind: 'tool_call_finished',
       threadId: this.ctx.threadId,
@@ -485,7 +487,8 @@ export class CursorSdkEventMapper {
         toolKind: state.kind,
         output: boundedOutput(message.result, this.limits.maxEventBytes),
         isError: message.status === 'error',
-        status: message.status === 'error' ? 'failed' : 'completed'
+        status: message.status === 'error' ? 'failed' : 'completed',
+        ...(resultMeta ? { meta: resultMeta } : {})
       })
     })
     return events
```

**File**: `kun/src/runtime/cursor/cursor-sdk-runtime-factory.ts` (modified, +4/-0)
```diff
@@ -1,4 +1,5 @@
 import type { CapabilityRegistry } from '../../adapters/tool/capability-registry.js'
+import { stashSdkToolResultMeta } from '../agent-sdk/sdk-tool-result-meta.js'
 import type { AttachmentStore } from '../../attachments/attachment-store.js'
 import type {
   ApprovalPolicy,
@@ -580,6 +581,9 @@ export function createCursorSdkRuntime(
                 output: result.item.output,
                 isError: result.item.isError
               }
+              // The Cursor stream synthesizes the tool_result item later; park
+              // the client sideband for the event mapper (same as the SDK path).
+              stashSdkToolResultMeta(context.threadId, toolCallId?.trim(), result.item.meta)
               if (
                 toolName === 'graph_define_plan' &&
                 delegatedGraphPlanWasCommitted(toolResult)
```

---

### Incident Patch 10: `e48894d1` (2026-09-26)
**Commit Message**: fix(work): size the write start page to its editor pane

The start page container queries measured the whole workspace view, so a
narrow split pane still used the wide two-column layout: the heading
wrapped mid-word, the side card cramped, and the refresh/switch-space
labels folded into vertical single-character columns. Measure the start
shell itself instead and scale its padding and heading with cqw units.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `src/renderer/src/components/write/WriteWorkspaceStart.tsx` (modified, +2/-2)
```diff
@@ -50,14 +50,14 @@ export function WriteWorkspaceStart({
     { label: t('writeStarterPresentation'), prompt: t('writeStarterPresentationPrompt'), icon: Presentation }
   ]
   return (
-    <div className="write-start-shell relative h-full min-h-[420px] overflow-auto rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,250,255,0.62))] px-5 py-5 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] sm:px-8 sm:py-8">
+    <div className="write-start-shell relative h-full min-h-[420px] overflow-auto rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,250,255,0.62))] p-[clamp(1.25rem,4.5cqw,2rem)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))]">
       <div className="write-start-grid mx-auto grid min-h-full w-full max-w-6xl gap-6">
         <section className="write-start-hero min-w-0 py-4">
           <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/10 px-3 py-1.5 text-[12px] font-semibold text-accent">
             <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
             <span>{t('writeStudio')}</span>
           </div>
-          <h2 className="write-start-heading mt-5 max-w-[12ch] text-[clamp(2.25rem,5vw,3.25rem)] font-semibold leading-[1.08] tracking-[0] text-ds-ink">
+          <h2 className="write-start-heading mt-5 max-w-[12ch] text-[clamp(1.75rem,6.5cqw,3.25rem)] font-semibold leading-[1.08] tracking-[0] text-ds-ink">
             {t(onboarding ? 'writeOnboardingTitle' : 'writeStartTitle')}
           </h2>
           <p className="write-start-copy mt-4 max-w-[56ch] text-[15px] leading-7 text-ds-muted">
```

**File**: `src/renderer/src/styles/surfaces-write/host-surfaces.css` (modified, +10/-3)
```diff
@@ -268,6 +268,11 @@
   justify-content: flex-end;
 }
 
+.write-start-shell {
+  container-type: inline-size;
+  container-name: write-start;
+}
+
 .write-start-grid {
   grid-template-columns: minmax(0, 1fr);
   align-items: start;
@@ -289,26 +294,28 @@
   align-self: start;
 }
 
-@container write-workspace (min-width: 700px) {
+@container write-start (min-width: 560px) {
   .write-start-primary-actions {
     justify-content: start;
     grid-template-columns: repeat(2, minmax(0, max-content));
   }
+}
 
+@container write-start (min-width: 720px) {
   .write-start-shortcuts {
     grid-template-columns: repeat(2, minmax(0, 1fr));
   }
 }
 
-@container write-workspace (min-width: 1080px) {
+@container write-start (min-width: 1080px) {
   .write-start-grid {
     grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
     align-items: center;
     gap: clamp(1.5rem, 3cqw, 2.25rem);
   }
 }
 
-@container write-workspace (min-width: 1280px) {
+@container write-start (min-width: 1280px) {
   .write-start-grid {
     grid-template-columns: minmax(0, 1fr) minmax(340px, 400px);
   }
```

---

### Incident Patch 11: `41892167` (2026-09-26)
**Commit Message**: fix(paper): keep the reader stage tint out of bg-main color-mix

The Work stylesheet contract forbids color-mix over --ds-bg-main (UI plugin
stages may theme it with gradients). Layer the text-tinted wash as a
background-image over an opaque bg-main instead.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/renderer/src/styles/surfaces-write/paper-reader.css` (modified, +5/-1)
```diff
@@ -59,7 +59,11 @@
    so page edges read clearly (tint derives from the theme text color, which
    works in both light and dark themes). */
 .paper-reader-stage {
-  background: color-mix(in srgb, var(--ds-text) 5%, var(--ds-bg-main));
+  background-color: var(--ds-bg-main);
+  background-image: linear-gradient(
+    color-mix(in srgb, var(--ds-text) 5%, transparent),
+    color-mix(in srgb, var(--ds-text) 5%, transparent)
+  );
 }
 
 .paper-reader-stage .write-pdf-page {
```

---

### Incident Patch 12: `cad7d1ad` (2026-09-26)
**Commit Message**: feat(paper): unified scholarly search workflow across GUI and agent

Implements work-paper-search-plan P1-P5: one multi-source engine serves
both the Work paper search page and agent tools, so results share
provenance, caching, rate limits and degradation state.

- paper_search/report/citations/details tools; structured paper lists
  ride a new model-invisible ToolResult meta sideband into chat cards
- connectors for OpenReview, PubMed, HAL, Zenodo, CORE, DBLP, Europe
  PMC/bioRxiv; result cache, per-source rate limiting and auto-degrade,
  fuzzy title merge for preprint/version duplicates
- settings: per-source toggles, credentials and test-source IPC; API
  keys only travel via env/hot-apply, never kun.config.json
- OA PDF chain (direct link -> arXiv -> Unpaywall -> Europe PMC -> CORE)
  with PDF title verification, 4-way dedupe and batch import
- literature-researcher read-only subagent and Work-mode prompt guidance
- search page: Agent tab, history, filters, bulk import/export/send-to-
  assistant, detail pane, keyboard navigation, saved-search feeds

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `docs/work-paper-search-plan.zh-CN.md` (added, +288/-0)
```diff
@@ -0,0 +1,288 @@
+# 论文模式：多源论文搜索与 Agent 检索计划
+
+> 状态：计划文档（2026-09-26）。P0 已在 `227fad596` 落地，P1-P5 待实现。
+> 适用范围：Work 论文模式（`workSurface: 'papers'`）、Kun `paper_search` 工具、主进程论文服务。
+
+## 1. 目标
+
+把“找论文”从单一来源的发现页，升级为一套统一的检索能力：
+
+1. **一个引擎，两种入口**：GUI 搜索页和 Agent 工具调用同一份多源检索实现，结果一致。
+2. **Agent 是主角**：用户用自然语言描述研究问题，Agent 负责拆解检索式、多轮检索、引文扩展、阅读摘要、筛选排序，最后产出可一键入库的结构化论文清单。
+3. **免费优先、来源透明**：默认只用无需 key 的公开来源；可选 key 只用于提高限额；每个来源的成功/失败/耗时都对用户可见。
+4. **检索到阅读闭环**：结果可以直接导入文献库、拿到开放获取 PDF、送进对话上下文、导出 BibTeX、订阅成每日推送。
+
+非目标：不接 Sci-Hub 等来源不合规的下载渠道；不做付费数据库（IEEE/ACM 仅保留接口占位）；不在渲染进程直接发外部请求。
+
+## 2. 现状（P0，已完成）
+
+| 层 | 位置 | 内容 |
+|---|---|---|
+| 检索引擎 | `kun/src/services/paper-search/` | 7 个来源连接器 + 并发调度 + 合并排序 + 模型输出格式化 |
+| Agent 工具 | `kun/src/adapters/tool/paper-search-tool-provider.ts` | `paper_search`，仅在 `agentSurface === 'write'` 时下发 |
+| 注册 | `kun/src/server/runtime-composition-registry.ts`、`runtime-composition-config.ts` | 启动与设置热更新两处都要注册 |
+| 主进程 | `src/main/services/paper/paper-search-service.ts` | 走应用代理调用同一引擎；IPC `paper-discover:search` |
+| 共享类型 | `src/shared/paper/paper-search.ts` | 从 kun 重导出类型与来源常量 |
+| GUI | `src/renderer/src/components/paper/discover/PaperSearchView.tsx`、`PaperSearchResults.tsx` | 搜索页、来源开关、年份、排序、导入、“Agent 深度搜索”按钮 |
+
+已接来源与实测情况（2026-09）：
+
+| 来源 id | 接口 | 摘要 | 引用数 | 备注 |
+|---|---|---|---|---|
+| `arxiv` | export.arxiv.org Atom API | 有 | 无 | 词项 AND 组合，支持 submittedDate 年份过滤 |
+| `openalex` | `works?filter=title_and_abstract.search:` | 有（倒排索引还原） | 有 | `search=` 已变为全文检索，噪声大，不要用 |
+| `semantic_scholar` | graph/v1 paper/search | 有 | 有 | 无 key 常见 429；已做一次延迟重试；env `KUN_SEMANTIC_SCHOLAR_API_KEY` |
+| `venues` | papers.cool `/venue/search` | 有 | 无 | ICLR/NeurIPS/ICML/ACL/CVPR 等录用论文 |
+| `paperscool` | papers.cool `/arxiv/search` | 有 | 无 | 与 arXiv 互补，排序不同 |
+| `crossref` | `works?query.bibliographic=` | 部分（JATS） | 有 | 全学科，相关性一般，默认关闭 |
+| `europepmc` | REST search, resultType=core | 有 | 有 | 生物医学，默认关闭 |
+
+合并规则：DOI → arXiv id → papers.cool id → 归一化标题，任一命中即合并；分数用 RRF（k=60），多来源共同靠前的论文排名更高。
+
+已知缺口：
+
+- Agent 的最终结果只是对话里的文字，不能一键导入；`paper_search` 的工具卡片显示原始文本。
+- 没有引文扩展（references / citations），Agent 只能靠关键词检索。
+- 来源 key、启用状态只能靠环境变量，没有设置界面。
+- 没有缓存和按域名限速，Agent 连续调用容易触发 429。
+- DOI 导入只用 Crossref 给的 PDF 链接，开放获取 PDF 命中率低。
+- dblp 接口被反爬页面拦截，未接入。
+
+## 3. 总体架构
+
+```
+Renderer 搜索页 ──IPC paper-discover:*──> main paper-search-service ─┐
+                                                                     ├─> kun/src/services/paper-search (引擎)
+Kun agent loop ──tool call──> paper_* tools ─────────────────────────┘        │
+      │                                                                        ├─ sources/*   (连接器)
+      └─ paper_report ──tool result meta.paperList──> kun-mapper ──> 对话 paper-list 块   ├─ cache / rate limit
+                                                                               └─ oa-resolver (P3)
+```
+
+原则：
+
+- 引擎代码只依赖 `fetch`，不依赖 Electron 或 Kun 运行时，方便两边复用和单测。
+- 所有外部请求在 main 或 Kun 进程；渲染进程只拿结构化结果。
+- 工具 schema 只在 Work 界面下发，保持 Code/Design 的稳定前缀和缓存命中不受影响。
+- 新增来源只改 `kun/src/services/paper-search/`，GUI 从 `PAPER_SEARCH_SOURCES` 自动生成开关。
+
+## 4. 分阶段计划
+
+### P1 Agent 结果结构化（最高优先级）
+
+目标：Agent 检索的过程和结论在对话里以论文卡片呈现，可勾选、批量导入、在搜索页打开。
+
+#### P1.1 `paper_search` 工具结果带结构化元数据
+
+- 工具输出改为对象：`{ text: string, papers: PaperSearchHit[], sources: PaperSearchSourceReport[] }`。
+  - `text` 仍是 `formatPaperSearchForModel` 的紧凑文本，保证模型读到的内容和 token 量不变。
+  - 需要确认 `local-tool-host-runtime.ts` 对对象输出的序列化方式：若对象会被 `JSON.stringify` 整体送进模型，就改为把结构化部分放进工具结果的 `meta`（参照 `render_chart` 的 `chartSpec` 链路），`output` 只保留文本。
+- `papers` 只保留卡片需要的字段，摘要截断到 600 字，单次最多 40 条，避免事件文件膨胀（参考 `RuntimeEventRecorder` 的体积约束）。
+
+#### P1.2 新工具 `paper_report`
+
+Agent 在检索结束时调用，提交最终推荐清单：
+
+```ts
+// input schema
+{
+  title?: string,               // 清单标题，如 "Repository-level code agents 核心论文"
+  summary?: string,             // 2-3 句方向概括（Markdown）
+  papers: Array<{
+    id: string,                 // arXiv id / DOI / papers.cool id，必须来自本轮 paper_search 结果
+    title: string,
+    reason: string,             // 一句话推荐理由
+    group?: string,             // 可选分组：基础工作 / 方法 / 基准 / 综述
+    priority?: 'must' | 'should' | 'optional'
+  }>                            // 1-30 篇
+}
+```
+
+- 执行时用本轮 `paper_search` 缓存（P2.3）补全作者、年份、venue、摘要、PDF；找不到的 id 标记为未验证，不静默丢弃。
+- 输出 `meta.paperList`；模型侧只回一行确认，不重复整张清单。
+- `shouldAdvertise` 同 `paper_search`。工具描述里说明：必须先用 `paper_search` 检索，id 不能编造。
+
+#### P1.3 渲染链路
+
+参照图表块的实现：
+
+1. `src/renderer/src/agent/paper-list-adapter.ts`：`paperListFromToolItem(item)`，做第二道 zod 校验，与 `chart-spec-adapter.ts` 同构。
+2. `src/renderer/src/agent/kun-mapper-events.ts`：工具结果事件中识别 `paper_report`，带出 `meta.paperList`。
+3. `src/renderer/src/store/chat-projection-reducer.ts`：新增 `kind: 'paper-list'` 块；`src/renderer/src/agent/types.ts` 增加类型。
+4. `src/renderer/src/components/chat/derive-turn-sections.ts`：新块参与排序，位置与图表块一致。
+5. `src/renderer/src/components/chat/PaperListBlock.tsx`（新）：
+   - 顶部是标题、概括、“全部导入”和“在搜索页打开”；
+   - 卡片按分组展示，含标题、作者、年份·venue、推荐理由、优先级标记、导入按钮、已在库中标记；

```

**File**: `kun/src/adapters/tool/local-tool-host-core.ts` (modified, +18/-5)
```diff
@@ -375,7 +375,14 @@ export class LocalToolHost implements ToolHost {
     const replayed = this.operationJournal.getCompleted(operationIdentity)
     if (replayed) {
       return {
-        item: this.completedToolResult(context, activeCall, tool, replayed.output, replayed.isError),
+        item: this.completedToolResult(
+          context,
+          activeCall,
+          tool,
+          replayed.output,
+          replayed.isError,
+          replayed.meta
+        ),
         approved: !needsApproval
       }
     }
@@ -408,6 +415,7 @@ export class LocalToolHost implements ToolHost {
           toolKind: activeCall.toolKind ?? tool.toolKind,
           output: update.output,
           isError: update.isError,
+          ...(update.meta ? { meta: update.meta } : {}),
           status: 'running'
         })
         await onUpdate(partialItem)
@@ -431,6 +439,9 @@ export class LocalToolHost implements ToolHost {
         approved: true
       }
     }
+    // `meta` is tool-owned structured sideband for clients; hooks only
+    // rewrite the model-facing output, so capture it before the hook run.
+    const meta = result.meta
     let hookedResult: PostToolUseOutcome
     try {
       hookedResult = await runPostToolUseHooks(components.hooks, {
@@ -455,8 +466,8 @@ export class LocalToolHost implements ToolHost {
       isError
     })
     if (!isError) output = await offloadLargeToolOutput(output, activeCall.toolName, context)
-    this.operationJournal.complete(operationIdentity, { output, isError })
-    const item = this.completedToolResult(context, activeCall, tool, output, isError)
+    this.operationJournal.complete(operationIdentity, { output, isError, ...(meta ? { meta } : {}) })
+    const item = this.completedToolResult(context, activeCall, tool, output, isError, meta)
     return { item, approved: !needsApproval }
   }
 
@@ -581,7 +592,8 @@ export class LocalToolHost implements ToolHost {
     call: ToolCallLike,
     tool: LocalTool,
     output: unknown,
-    isError?: boolean
+    isError?: boolean,
+    meta?: Record<string, unknown>
   ): TurnItem {
     return makeToolResultItem({
       id: `item_${call.callId}`,
@@ -591,7 +603,8 @@ export class LocalToolHost implements ToolHost {
       toolName: call.toolName,
       toolKind: call.toolKind ?? tool.toolKind,
       output,
-      isError
+      isError,
+      ...(meta ? { meta } : {})
     })
   }
 
```

**File**: `kun/src/adapters/tool/local-tool-host-types.ts` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ export type LocalTool = {
     args: Record<string, unknown>,
     context: ToolHostContext,
     onUpdate?: (update: ToolExecutionUpdate) => Promise<void> | void
-  ) => Promise<{ output: unknown; isError?: boolean }>
+  ) => Promise<{ output: unknown; isError?: boolean; meta?: Record<string, unknown> }>
 }
 
 export type LocalToolHostOptions = {
```

**File**: `kun/src/adapters/tool/paper-search-tool-provider.test.ts` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+import { afterEach, describe, expect, it, vi } from 'vitest'
+import { buildPaperSearchToolProvider } from './paper-search-tool-provider.js'
+import { PaperSeenStore } from '../../services/paper-search/paper-search-seen-store.js'
+import type { ToolHostContext } from '../../ports/tool-host.js'
+
+const CONTEXT = {
+  threadId: 'thread-1',
+  turnId: 'turn-1',
+  workspace: '/tmp/ws',
+  agentSurface: 'write' as const
+} as ToolHostContext
+
+const OPENALEX_WORK = {
+  display_name: 'RepoAudit: Autonomous LLM Agents for Repository Auditing',
+  publication_year: 2024,
+  doi: 'https://doi.org/10.1145/repoaudit',
+  cited_by_count: 12,
+  authorships: [{ author: { display_name: 'Jinyao Guo' } }],
+  primary_location: { landing_page_url: 'https://openreview.net/forum?id=x', source: { display_name: 'ICLR' } },
+  best_oa_location: { pdf_url: 'https://openreview.net/pdf?id=x' }
+}
+
+const S2_PAPER = {
+  title: 'RepoAudit: Autonomous LLM Agents for Repository Auditing',
+  year: 2024,
+  venue: 'ICLR',
+  url: 'https://www.semanticscholar.org/paper/x',
+  citationCount: 12,
+  authors: [{ name: 'Jinyao Guo' }],
+  externalIds: { DOI: '10.1145/repoaudit' },
+  openAccessPdf: { url: 'https://openreview.net/pdf?id=x' }
+}
+
+function stubFetch(): ReturnType<typeof vi.fn> {
+  const impl = vi.fn(async (input: unknown): Promise<Response> => {
+    const url = String(input)
+    if (url.includes('api.openalex.org')) {
+      return Response.json({ results: [OPENALEX_WORK] })
+    }
+    if (url.includes('api.semanticscholar.org')) {
+      // Neighbor endpoints wrap each row; direct paper lookups do not.
+      const wrapped = url.includes('/citations') || url.includes('/references')
+      return Response.json(
+        wrapped ? { data: [{ citingPaper: S2_PAPER, citedPaper: S2_PAPER }] } : { data: [S2_PAPER] }
+      )
+    }
+    return new Response('unexpected url', { status: 404 })
+  })
+  vi.stubGlobal('fetch', impl as unknown as typeof fetch)
+  return impl
+}
+
+function toolMap(seen = new PaperSeenStore()) {
+  const providers = buildPaperSearchToolProvider({ proxyUrl: () => undefined, seen })
+  const tools = new Map(providers[0]!.tools.map((tool) => [tool.name, tool]))
+  return { tools, seen }
+}
+
+describe('paper search tool provider (P1.1/P4)', () => {
+  afterEach(() => vi.unstubAllGlobals())
+
+  it('advertises the four paper tools only on the write surface', () => {
+    const { tools } = toolMap()
+    expect([...tools.keys()].sort()).toEqual([
+      'paper_citations',
+      'paper_details',
+      'paper_report',
+      'paper_search'
+    ])
+    const search = tools.get('paper_search')!
+    expect(search.shouldAdvertise?.(CONTEXT)).toBe(true)
+    expect(search.shouldAdvertise?.({ ...CONTEXT, agentSurface: 'code' })).toBe(false)
+  })
+
+  it('paper_search returns compact text plus meta.paperSearch and remembers cards', async () => {
+    stubFetch()
+    const { tools, seen } = toolMap()
+    const result = await tools.get('paper_search')!.execute(
+      { query: 'repository auditing agents', sources: ['openalex'] },
+      CONTEXT
+    )
+    expect(result.isError).toBeUndefined()
+    expect(String(result.output)).toContain('RepoAudit')
+    const meta = result.meta?.paperSearch as {
+      version: number
+      papers: Array<{ id: string; title: string; doi?: string }>
+      sources: Array<{ source: string; count: number }>
+    }
+    expect(meta.version).toBe(1)
+    expect(meta.papers).toHaveLength(1)
+    expect(meta.papers[0]).toMatchObject({ doi: '10.1145/repoaudit' })
+    expect(meta.sources).toEqual([{ source: 'openalex', count: 1, ms: expect.any(Number) }])
+    expect(seen.hasAny()).toBe(true)
+    expect(seen.resolve('10.1145/repoaudit')?.title).toContain('RepoAudit')
+  })
+
+  it('paper_search errors on a blank query', async () => {
+    const { tools } = toolMap()
+    const result = await tools.get('paper_search')!.execute({ query: '  ' }, CONTEXT)
+    expect(result.isError).toBe(true)
+    expect(String(result.output)).toContain('query is required')
+  })
+
+  it('paper_search respects the enabled-sources capability', async () => {
+    const impl = stubFetch()
+    const providers = buildPaperSearchToolProvider({
+      proxyUrl: () => undefined,
+      seen: new PaperSeenStore(),
+      enabledSources: () => ['arxiv']
+    })
+    const search = providers[0]!.tools.find((tool) => tool.name === 'paper_search')!
+    const result = await search.execute({ query: 'x', sources: ['openalex'] }, CONTEXT)
+    expect(result.isError).toBe(true)
+    expect(String(result.output)).toContain('enabled')
+    expect(impl).not.toHaveBeenCalled()
+  })
+
+  it('paper_report verifies ids against the seen store and flags the rest', async () => {
+    stubFetch()
+    const { tools } = toolMap()
+    await tools.get('paper_search')!.execute({ query: 'audit', sources: ['openalex'] }, CONTEXT)
+    const result = await tools.get('paper_report')!.execute(
+      {
+  
```

**File**: `kun/src/adapters/tool/paper-search-tool-provider.ts` (modified, +400/-70)
```diff
@@ -1,37 +1,426 @@
 import type { CapabilityToolProvider } from './capability-registry.js'
+import type { PaperSearchCapabilityConfig } from '../../contracts/capabilities-core.js'
 import { LocalToolHost } from './local-tool-host.js'
 import { createProxyFetch } from '../model/proxy-fetch.js'
 import {
   DEFAULT_PAPER_SEARCH_SOURCES,
   PAPER_SEARCH_SOURCES,
+  PAPER_SEARCH_SOURCE_LABELS,
+  PaperSearchCache,
+  PaperRateLimiter,
+  buildPaperSearchMeta,
   formatPaperSearchForModel,
+  mergePaperSearchResults,
+  paperHitToCard,
   runPaperSearch,
-  type PaperSearchFetch
+  type PaperSearchCardHit,
+  type PaperSearchCredentials,
+  type PaperSearchFetch,
+  type PaperSearchResponse,
+  type PaperSourceHit
 } from '../../services/paper-search/paper-search.js'
+import { PaperSeenStore } from '../../services/paper-search/paper-search-seen-store.js'
+import {
+  fetchPaperCitationNeighbors,
+  fetchPaperDetails
+} from '../../services/paper-search/paper-search-lookup.js'
+import type { PaperListEntryMeta, PaperReportPriority } from '../../services/paper-search/paper-search-types.js'
 import { KUN_VERSION } from '../../version.js'
 
 export const PAPER_SEARCH_TOOL_NAME = 'paper_search' as const
+export const PAPER_REPORT_TOOL_NAME = 'paper_report' as const
+export const PAPER_CITATIONS_TOOL_NAME = 'paper_citations' as const
+export const PAPER_DETAILS_TOOL_NAME = 'paper_details' as const
 export const PAPER_SEARCH_PROVIDER_ID = 'paper-search' as const
 
+/** Merge capability credentials with env fallbacks (`KUN_*` overrides unset). */
+export function resolvePaperSearchCredentials(
+  paper: PaperSearchCapabilityConfig | undefined
+): PaperSearchCredentials {
+  const env = (key: string) => process.env[key]?.trim() || undefined
+  return {
+    semanticScholarApiKey: paper?.semanticScholarApiKey?.trim() || env('KUN_SEMANTIC_SCHOLAR_API_KEY'),
+    coreApiKey: paper?.coreApiKey?.trim() || env('KUN_CORE_API_KEY'),
+    openAlexMailto: paper?.openAlexMailto?.trim() || env('KUN_OPENALEX_MAILTO'),
+    unpaywallEmail: paper?.unpaywallEmail?.trim() || env('KUN_UNPAYWALL_EMAIL')
+  }
+}
+
 export type PaperSearchToolOptions = {
   /** Outbound proxy shared with model requests; blank means direct. */
   proxyUrl: () => string | undefined
-  semanticScholarApiKey?: () => string | undefined
+  /** Runtime credentials (settings + env fallbacks resolved upstream). */
+  credentials?: () => PaperSearchCredentials | undefined
+  /**
+   * Capability-level source allow-list from `capabilities.paperSearch`.
+   * Empty/absent means "engine defaults"; a non-empty list intersects with
+   * the `sources` arg so disabled sources are silently skipped.
+   */
+  enabledSources?: () => readonly string[] | undefined
+  /** Test seam / shared engine state; defaults are process-wide singletons. */
+  cache?: PaperSearchCache<PaperSourceHit[]>
+  rateLimiter?: PaperRateLimiter
+  seen?: PaperSeenStore
+}
+
+type SharedPaperState = {
+  cache: PaperSearchCache<PaperSourceHit[]>
+  rateLimiter: PaperRateLimiter
+  seen: PaperSeenStore
 }
 
-const description = [
+let sharedState: SharedPaperState | undefined
+
+function defaultSharedState(): SharedPaperState {
+  sharedState ??= {
+    cache: new PaperSearchCache<PaperSourceHit[]>(),
+    rateLimiter: new PaperRateLimiter(),
+    seen: new PaperSeenStore()
+  }
+  return sharedState
+}
+
+const SEARCH_DESCRIPTION = [
   'Search scholarly literature across several open indexes at once and get one merged, deduplicated, ranked list',
   '(title, authors, year, venue, citations, arXiv id / DOI, abstract excerpt, and which sources returned it).',
   'Sources: arxiv (preprints), openalex (broad metadata incl. journals), semantic_scholar (CS/AI with citations),',
   'venues (accepted papers of ML/NLP/CV/systems conferences such as ICLR, NeurIPS, ICML, ACL, CVPR via papers.cool),',
-  'paperscool (arXiv with abstracts via papers.cool), crossref (DOI registry, all fields), europepmc (biomedical).',
+  'paperscool (arXiv with abstracts via papers.cool), crossref (DOI registry, all fields), europepmc (biomedical),',
+  'openreview (ML conference submissions + reviews), pubmed (PubMed), hal (HAL open archive), zenodo (Zenodo),',
+  'core (open-access aggregator, needs key), biorxiv (bioRxiv/medRxiv preprints), dblp (CS bibliography).',
   `Default sources: ${DEFAULT_PAPER_SEARCH_SOURCES.join(', ')}.`,
   'Write queries as short English keyword phrases (3-8 terms), not questions. For a literature survey, run several',
   'queries that cover synonyms, sub-topics and key method names, narrow with year_from/year_to, then judge relevance',
-  'from the abstracts before recommending papers. Cite papers by title plus arXiv id or DOI so the user can import them.'
+  'from the abstracts before recommending papers. When the user asks for a curated reading list, finish with a',
+  'paper_report call whose ids come ONLY from papers this conversation already found.'
+].join(' ')
+
+const REPORT_DESCRIPTION = [
```

**File**: `kun/src/contracts/capabilities-core.ts` (modified, +24/-1)
```diff
@@ -258,6 +258,24 @@ export const WebCapabilityConfig = CapabilityToggleConfig.extend({
 }).strict()
 export type WebCapabilityConfig = z.infer<typeof WebCapabilityConfig>
 
+/**
+ * Scholarly-search capability: which connectors the paper engine may use and
+ * the credentials/connectivity hints for each. `enabledSources` is a
+ * capability-level allow-list layered on top of the tool's `sources` arg;
+ * empty means the engine default set.
+ */
+export const PaperSearchCapabilityConfig = z
+  .object({
+    enabledSources: z.array(z.string().min(1)).default([]),
+    semanticScholarApiKey: z.string().max(512).default(''),
+    coreApiKey: z.string().max(512).default(''),
+    /** Polite-pool identifiers (shared by OpenAlex + Crossref). */
+    openAlexMailto: z.string().max(320).default(''),
+    unpaywallEmail: z.string().max(320).default('')
+  })
+  .strict()
+export type PaperSearchCapabilityConfig = z.infer<typeof PaperSearchCapabilityConfig>
+
 export const SkillsCapabilityConfig = CapabilityToggleConfig.extend({
   roots: z.array(z.string().min(1)).default([]),
   workspaceRoots: z.array(z.string().min(1)).default([]),
@@ -322,7 +340,12 @@ export const SUBAGENT_READ_ONLY_TOOL_NAMES = [
   'repo_map',
   'fast_context',
   'web_fetch',
-  'web_search'
+  'web_search',
+  // Scholarly retrieval is read-only; literature subagents need the same
+  // search/citation tools as the parent Work surface.
+  'paper_search',
+  'paper_citations',
+  'paper_details'
 ] as const
 
 export const SubagentProfileConfig = z
```

**File**: `kun/src/contracts/capabilities-media.ts` (modified, +3/-1)
```diff
@@ -8,6 +8,7 @@ import {
   McpCapabilityConfig,
   McpToolDiscoveryMode,
   ModelCapabilityMetadata,
+  PaperSearchCapabilityConfig,
   ProactiveSubagentRetryConfig,
   RUNTIME_CAPABILITY_CONTRACT_VERSION,
   RuntimeCapabilityState,
@@ -191,7 +192,8 @@ export const KunCapabilitiesConfig = z
     musicGen: MusicGenCapabilityConfig.default(() => MusicGenCapabilityConfig.parse({})),
     videoGen: VideoGenCapabilityConfig.default(() => VideoGenCapabilityConfig.parse({})),
     computerUse: ComputerUseCapabilityConfig.default(() => ComputerUseCapabilityConfig.parse({})),
-    browserUse: BrowserUseCapabilityConfig.default(() => BrowserUseCapabilityConfig.parse({}))
+    browserUse: BrowserUseCapabilityConfig.default(() => BrowserUseCapabilityConfig.parse({})),
+    paperSearch: PaperSearchCapabilityConfig.default(() => PaperSearchCapabilityConfig.parse({}))
   })
   .strict()
 export type KunCapabilitiesConfig = z.infer<typeof KunCapabilitiesConfig>
```

**File**: `kun/src/contracts/capabilities.ts` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ export {
   McpServerConfig,
   McpCapabilityConfig,
   WebCapabilityConfig,
+  PaperSearchCapabilityConfig,
   SkillsCapabilityConfig,
   InstructionsCapabilityConfig,
   SubagentToolPolicy,
```

---

### Incident Patch 13: `b9d50dc1` (2026-09-25)
**Commit Message**: fix(memory): harden directive migration, live policy, and reactivation

- Create memory_records_authority_idx only after the authority column exists
  so existing V1 SQLite indexes upgrade instead of failing and pinning the
  store to filesystem fallback.
- Pass the caller's live memory policy through listDirectives so the shared
  manager repository honors directive enablement and budgets per request.
- Require authority=directive (forced user decision) for memory_update calls
  that re-enable, re-time, or rewrite an existing directive.
- Respect policy.scopes in directive selection and memory_list.
- Add a V1 -> V2 index migration test and fix the stale schema version
  assertion in the hybrid store test.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `kun/src/adapters/hybrid/hybrid-memory-migrations.test.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { describe, expect, it } from 'vitest'
+import {
+  MEMORY_INDEX_SCHEMA_VERSION,
+  memoryIndexSchemaVersion,
+  migrateMemoryIndex
+} from './hybrid-memory-migrations.js'
+
+type SqliteDatabase = import('better-sqlite3').Database
+
+async function openMemoryDatabase(): Promise<SqliteDatabase | null> {
+  try {
+    const Database = (await import('better-sqlite3')).default
+    return new Database(':memory:')
+  } catch {
+    return null
+  }
+}
+
+/** The V1 memory_records layout shipped before the authority column existed. */
+function createV1MemoryIndex(db: SqliteDatabase): void {
+  db.exec(`
+    CREATE TABLE memory_index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
+    INSERT INTO memory_index_meta(key, value) VALUES('schema_version', '1');
+    CREATE TABLE memory_records (
+      id TEXT PRIMARY KEY,
+      scope TEXT NOT NULL,
+      workspace TEXT,
+      project TEXT,
+      lifecycle TEXT NOT NULL,
+      type TEXT NOT NULL,
+      confidence REAL NOT NULL,
+      importance REAL NOT NULL,
+      observed_at TEXT NOT NULL,
+      valid_from TEXT,
+      valid_to TEXT,
+      expires_at TEXT,
+      updated_at TEXT NOT NULL,
+      canonical_hash TEXT NOT NULL,
+      search_tokens TEXT NOT NULL,
+      source_summaries_json TEXT NOT NULL,
+      record_json TEXT NOT NULL
+    );
+    INSERT INTO memory_records VALUES (
+      'mem_v1', 'user', NULL, NULL, 'active', 'fact', 1, 0.5,
+      '2026-01-01T00:00:00.000Z', NULL, NULL, NULL, '2026-01-01T00:00:00.000Z',
+      'hash', 'alpha', '[]', '{}'
+    );
+  `)
+}
+
+describe('migrateMemoryIndex', () => {
+  it('upgrades a V1 index by adding authority before indexing it', async () => {
+    const db = await openMemoryDatabase()
+    if (!db) return
+    try {
+      createV1MemoryIndex(db)
+      expect(() => migrateMemoryIndex(db)).not.toThrow()
+      expect(memoryIndexSchemaVersion(db)).toBe(MEMORY_INDEX_SCHEMA_VERSION)
+      const row = db.prepare("SELECT authority FROM memory_records WHERE id = 'mem_v1'").get() as
+        | { authority: string }
+        | undefined
+      expect(row?.authority).toBe('reference')
+      const indexes = db.prepare('PRAGMA index_list(memory_records)').all() as Array<{ name: string }>
+      expect(indexes.map((index) => index.name)).toContain('memory_records_authority_idx')
+      // Re-running on an already migrated database stays idempotent.
+      expect(() => migrateMemoryIndex(db)).not.toThrow()
+    } finally {
+      db.close()
+    }
+  })
+
+  it('creates the authority column and index on a fresh database', async () => {
+    const db = await openMemoryDatabase()
+    if (!db) return
+    try {
+      migrateMemoryIndex(db)
+      const columns = db.prepare('PRAGMA table_info(memory_records)').all() as Array<{ name: string }>
+      expect(columns.map((column) => column.name)).toContain('authority')
+    } finally {
+      db.close()
+    }
+  })
+})
```

**File**: `kun/src/adapters/hybrid/hybrid-memory-migrations.ts` (modified, +6/-3)
```diff
@@ -42,8 +42,6 @@ export function migrateMemoryIndex(db: BetterSqliteDatabase): void {
       ON memory_records(updated_at DESC, id ASC);
     CREATE INDEX IF NOT EXISTS memory_records_type_idx
       ON memory_records(type, scope, lifecycle);
-    CREATE INDEX IF NOT EXISTS memory_records_authority_idx
-      ON memory_records(authority, scope);
     CREATE TABLE IF NOT EXISTS memory_sources (
       memory_id TEXT NOT NULL,
       source_id TEXT NOT NULL,
@@ -63,10 +61,15 @@ export function migrateMemoryIndex(db: BetterSqliteDatabase): void {
       tokenize='unicode61'
     );
   `)
-  if (currentVersion < 2 && !memoryRecordsHasColumn(db, 'authority')) {
+  if (!memoryRecordsHasColumn(db, 'authority')) {
     // Existing V1 rows only ever stored 'reference'; the default backfills them.
     db.exec("ALTER TABLE memory_records ADD COLUMN authority TEXT NOT NULL DEFAULT 'reference'")
   }
+  // Must run after the column exists: a V1 table only gains it via ALTER above.
+  db.exec(`
+    CREATE INDEX IF NOT EXISTS memory_records_authority_idx
+      ON memory_records(authority, scope);
+  `)
   db.prepare(`
     INSERT INTO memory_index_meta(key, value) VALUES('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value
```

**File**: `kun/src/adapters/hybrid/hybrid-memory-store.test.ts` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ describe('HybridMemoryStore', () => {
       .resolves.toMatchObject([{ id: 'mem_cjk' }])
     const diagnostics = await store.diagnostics()
     expect(diagnostics).toMatchObject({
-      canonicalCount: 2, indexedCount: 2, staleCount: 0, indexState: 'ready', indexSchemaVersion: 1
+      canonicalCount: 2, indexedCount: 2, staleCount: 0, indexState: 'ready', indexSchemaVersion: 2
     })
     expect(diagnostics.lastRetrieval?.mode).toBe('sqlite-fts5')
     await store.shutdown()
```

**File**: `kun/src/adapters/hybrid/hybrid-memory-store.ts` (modified, +5/-3)
```diff
@@ -192,9 +192,11 @@ export class HybridMemoryStore implements MemoryStore {
     return records
   }
 
-  async listDirectives(access: MemoryAccess = {}): Promise<MemoryDirectiveResult> {
+  async listDirectives(
+    access: MemoryAccess = {},
+    policy: MemoryCapabilityConfig = this.config()
+  ): Promise<MemoryDirectiveResult> {
     await this.ready()
-    const policy = this.config()
     if (this.indexReady()) {
       try {
         this.options.beforeIndexQuery?.('list')
@@ -212,7 +214,7 @@ export class HybridMemoryStore implements MemoryStore {
         this.degraded.fail('directive query', error)
       }
     }
-    const result = await this.canonical.listDirectives(access)
+    const result = await this.canonical.listDirectives(access, policy)
     this.lastDirectiveInjection = result
     this.reconcileStaleIndex()
     return result
```

**File**: `kun/src/adapters/tool/memory-read-tools.ts` (modified, +16/-3)
```diff
@@ -114,7 +114,8 @@ export function buildMemoryReadTools(store: MemoryStore): LocalTool[] {
         const page = await listActiveMemoryPage(store, access, filter.value, {
           limit,
           before,
-          nowMs
+          nowMs,
+          allowedScopes: allowedMemoryScopes(context.memoryPolicy?.scopes)
         })
         return {
           output: {
@@ -158,7 +159,12 @@ async function listActiveMemoryPage(
   store: MemoryStore,
   access: { workspace?: string },
   filter: MemoryToolFilter,
-  options: { limit: number; before?: { updatedAt: string; id: string }; nowMs: number }
+  options: {
+    limit: number
+    before?: { updatedAt: string; id: string }
+    nowMs: number
+    allowedScopes: readonly MemoryRecord['scope'][]
+  }
 ): Promise<{
   records: MemoryRecord[]
   nextCursor?: string
@@ -186,6 +192,7 @@ async function listActiveMemoryPage(
     before = { updatedAt: batch[batch.length - 1].updatedAt, id: batch[batch.length - 1].id }
     for (const record of filterActiveMemories(batch, options.nowMs)) {
       if (filter.scope && record.scope !== filter.scope) continue
+      if (!options.allowedScopes.includes(record.scope)) continue
       scannedTotal += 1
       if (records.length < options.limit) records.push(record)
     }
@@ -255,14 +262,20 @@ function enumArgument<T extends string>(
     : { ok: false }
 }
 
+/** Scopes the memory policy enables for this turn; unknown names are ignored. */
+function allowedMemoryScopes(scopes: readonly string[] | undefined): MemoryRecord['scope'][] {
+  if (!scopes) return [...MemoryScope.options]
+  return MemoryScope.options.filter((scope) => scopes.includes(scope))
+}
+
 /** Tool lookups apply their own record cap instead of the injection cap. */
 function toolMemoryPolicy(
   memoryPolicy: { enabled: boolean; scopes?: readonly string[] } | undefined,
   limit: number
 ): MemoryCapabilityConfig {
   return {
     enabled: memoryPolicy?.enabled === true,
-    scopes: (memoryPolicy?.scopes ?? ['user', 'workspace', 'project']) as MemoryCapabilityConfig['scopes'],
+    scopes: allowedMemoryScopes(memoryPolicy?.scopes),
     maxInjectedRecords: limit,
     distillation: { enabled: false },
     directives: { enabled: true, maxRecords: 20, maxCharacters: 4_000 }
```

**File**: `kun/src/adapters/tool/memory-tool-provider.test.ts` (modified, +40/-0)
```diff
@@ -240,6 +240,46 @@ describe('memory tool provider', () => {
     }, context())
     expect(approved.isError).not.toBe(true)
   })
+
+  it('rejects re-enabling or re-timing a directive without authority=directive', async () => {
+    const store = await createStore('mem_tool_dir_revive')
+    await store.createWithId('mem_rule', {
+      content: 'Reply in English', scope: 'user', authority: 'directive', disabled: true
+    })
+    const tool = memoryTool(store, 'memory_update')
+    for (const patch of [
+      { disabled: false },
+      { expiresAt: null },
+      { validTo: null },
+      { validFrom: '2026-08-01T00:00:00.000Z' }
+    ]) {
+      await expect(tool.execute({ id: 'mem_rule', ...patch }, context()))
+        .resolves.toMatchObject({ isError: true })
+    }
+    expect((await store.getById('mem_rule')).disabledAt).toBeDefined()
+    // Removing a rule stays on the ordinary path.
+    const demoted = await tool.execute({ id: 'mem_rule', authority: 'reference' }, context())
+    expect(demoted.isError).not.toBe(true)
+    // Reference memories keep the ordinary update path.
+    await store.createWithId('mem_fact', { content: 'Uses pnpm', scope: 'user', disabled: true })
+    const revived = await tool.execute({ id: 'mem_fact', disabled: false }, context())
+    expect(revived.isError).not.toBe(true)
+  })
+
+  it('hides memories from scopes the memory policy disables in memory_list', async () => {
+    const store = await createStore('mem_tool_scopes')
+    await store.createWithId('mem_user_scope', { content: 'Prefers tabs', scope: 'user' })
+    await store.createWithId('mem_ws_scope', {
+      content: 'Uses pnpm', scope: 'workspace', workspace: '/workspace-a'
+    })
+    const tool = memoryTool(store, 'memory_list')
+    const result = await tool.execute({}, {
+      ...context(),
+      memoryPolicy: { enabled: true, scopes: ['workspace'] }
+    })
+    const output = result.output as { memories: Array<{ id: string }> }
+    expect(output.memories.map((memory) => memory.id)).toEqual(['mem_ws_scope'])
+  })
 })
 
 async function createStore(id: string): Promise<FileMemoryStore> {
```

**File**: `kun/src/adapters/tool/memory-tool-provider.ts` (modified, +19/-5)
```diff
@@ -173,11 +173,14 @@ export function buildMemoryToolProviders(store: MemoryStore | undefined): Capabi
           }
           const parsed = MemoryUpdateRequest.safeParse(patch)
           if (!parsed.success) return invalidArguments('update', parsed.error.issues)
-          // Rewriting an existing directive's text must repeat the explicit
-          // user approval: require the call to carry authority='directive'.
-          if (patch.content !== undefined && patch.authority !== 'directive' && store.getById) {
-            const existing = await store.getById(id, { workspace: context.workspace }).catch(() => undefined)
-            if (existing?.authority === 'directive') {
+          // Rewriting, re-enabling, or re-timing an existing directive changes
+          // what is injected as a user instruction, so it must repeat the
+          // explicit user approval by carrying authority='directive'.
+          if (patch.authority === undefined && touchesDirectiveEffect(patch)) {
+            const existing = store.getById
+              ? await store.getById(id, { workspace: context.workspace }).catch(() => undefined)
+              : undefined
+            if (!store.getById || existing?.authority === 'directive') {
               return {
                 output: { error: 'updating a directive requires authority=directive' },
                 isError: true
@@ -212,6 +215,17 @@ export function buildMemoryToolProviders(store: MemoryStore | undefined): Capabi
   }]
 }
 
+/**
+ * Fields that change a directive's text or bring it back into effect. Disabling
+ * (`disabled: true`) and demoting (`authority: 'reference'`) only remove a rule
+ * and stay available under the ordinary memory approval policy.
+ */
+const DIRECTIVE_EFFECT_FIELDS = ['content', 'expiresAt', 'validFrom', 'validTo'] as const
+
+function touchesDirectiveEffect(patch: Record<string, unknown>): boolean {
+  return DIRECTIVE_EFFECT_FIELDS.some((key) => hasOwn(patch, key)) || patch.disabled === false
+}
+
 function hasOwn(value: Record<string, unknown>, key: string): boolean {
   return Object.prototype.hasOwnProperty.call(value, key)
 }
```

**File**: `kun/src/manager/shared-data-store-implementation.ts` (modified, +1/-1)
```diff
@@ -273,7 +273,7 @@ export class ManagerSharedDataStore extends ManagerSharedDataStoreCore {
             agent: AgentMemoryAccessSchema.optional()
           }).strict().parse(body.value ?? {})
           if (!store.listDirectives) throw new Error('memory directive listing is unavailable')
-          return store.listDirectives(access)
+          return store.listDirectives(access, body.config)
         }
         case 'retrieve': {
           const request = z.object({
```

---

### Incident Patch 14: `16e2b78d` (2026-09-25)
**Commit Message**: feat(memory): add model-facing read tools and user-approved directives

Give the agent read-only memory_search/memory_list tools (no approval) so
it can enumerate and recall long-term memories, and add authority=directive
for user-approved standing rules that are injected every turn across the
native loop, Agent SDK, and Cursor SDK paths. Ordinary memories stay
untrusted reference evidence; directive creation/update always requires an
explicit human decision, imports and distillation can never produce
directives, and the GUI gains authority filters, rule promotion, directive
diagnostics, chat chips, and approval hints.

Refs KunAgent/Kun#1344

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `docs/memory-foundation.en.md` (modified, +25/-2)
```diff
@@ -2,14 +2,37 @@
 
 The canonical store is `{dataDir}/memory/*.json`; `{dataDir}/memory-index.sqlite3` is a disposable,
 rebuildable FTS5 projection. Records are normalized to schema V2 on read without eagerly rewriting
-legacy JSON. Every record has `authority: reference`, so user, imported, tool, web, and inferred text
-remains untrusted evidence rather than model instructions.
+legacy JSON. Every record has `authority: reference` (default) or `directive`. `reference` records —
+including user, imported, tool, web, and inferred text — remain untrusted evidence rather than model
+instructions. `directive` records are user-approved standing rules and can only be created through
+explicit user approval (the settings page, or a `memory_create`/`memory_update` approval carrying
+`authority: 'directive'`); imports and distillation always produce `reference`.
 
 Retrieval filters scope and lifecycle before FTS ranking. It combines lexical relevance (0.55), scope
 affinity (0.10), type affinity (0.10), freshness (0.10), importance (0.075), and confidence (0.075),
 then applies live record and character budgets. Injected memory stays outside the immutable system
 prefix and is wrapped as `MEMORY_REFERENCE_DATA` with `untrusted="true"`.
 
+## User rules (directive)
+
+`authority: 'directive'` records are standing user-approved rules. Unlike reference memories they are
+not relevance-gated: every turn injects them as a user-authority `<kun_memory_directives>` block.
+Rules are limited to `user`/`workspace` scope, 1,000 characters each, and per-turn budgets
+(`capabilities.memory.directives.maxRecords`/`maxCharacters`, defaults 20/4,000). Creating or
+promoting a rule always requires a human decision — even under full-access auto-allow — and editing a
+rule requires `authority: 'directive'` on the update. Imports (kunpack, `kun-memory-v2` archives,
+profile import) are downgraded to `reference` and reported; distillation never writes rules. Rules
+guide behavior but cannot override Kun policy, sandboxing, tool permissions, approval requirements,
+or the latest explicit user instruction. They complement `AGENTS.md`: rules are cross-workspace,
+short, and manageable in Settings -> Memory; `AGENTS.md` suits project-level conventions.
+
+## Read-only model tools
+
+Besides the approval-gated `memory_create`/`memory_update`/`memory_delete`, the model can call the
+read-only, approval-free `memory_search` (query + scope/authority/type filters) and `memory_list`
+(paginated enumeration with `includeDisabled`). Neither exposes hidden agent-context memories nor
+mutates retrieval diagnostics.
+
 Canonical writes commit before index projection. Startup reconciliation repairs missing or stale index
 rows by stable hash. Missing native SQLite/FTS5 support, corruption, migration/query/projection errors,
 and backfill windows fall back to bounded filesystem/n-gram retrieval without deleting malformed
```

**File**: `docs/memory-foundation.md` (modified, +40/-2)
```diff
@@ -6,8 +6,10 @@
 ## 核心约束
 
 - `{dataDir}/memory/*.json` 是唯一标准数据；SQLite 只是可删除、可重建的检索投影。
-- 每条记录的 `authority` 固定为 `reference`。用户、导入、工具、网页和推断内容都不能成为
-  system/user instruction，也不能覆盖审批、sandbox 或工具策略。
+- 每条记录的 `authority` 为 `reference`（默认）或 `directive`。`directive` 只能经由用户明确
+  确认产生——设置页编辑或 `authority=directive` 的 memory_create/memory_update 审批——导入与
+  蒸馏永远不会产生。规则以 user 权威注入，但不能覆盖审批、sandbox、工具策略或最新的显式
+  用户指令；`reference` 记录始终是不可信证据，不是指令。
 - `confidence`、`freshness`、`importance`、相关性与作用域亲和度是独立信号；不会再通过修改
   置信度来模拟时间衰减。
 - 检索先执行作用域和生命周期过滤，再执行 FTS5 与排序。未授权、已删除、已禁用、被替代、
@@ -66,6 +68,37 @@ npm run dev
 `MEMORY_REFERENCE_DATA untrusted="true" authority="reference"` 中。每条记录附带类型、
 置信度、新鲜度等级和有界来源标签；内容即使写着“忽略先前指令”也只作为不可信证据。
 
+## 用户规则（directive）
+
+`authority: 'directive'` 的记录是用户批准的长期规则。与参考记忆不同，它们不做相关性过滤：
+每一轮都会以 user 权威注入到动态上下文（`<kun_memory_directives>` 块），因此“回复一律使用
+英文”这类偏好会被可靠遵循。约束如下：
+
+- 只允许 `user` 与 `workspace` 作用域；`project` 与 agent 作用域的记录不能成为规则。
+- 单条内容上限 `MEMORY_DIRECTIVE_MAX_CONTENT_CHARS`（1_000 字符）；每轮注入受
+  `capabilities.memory.directives.maxRecords`（默认 20）与 `maxCharacters`（默认 4_000）
+  预算约束，超出部分记录到 `lastDirectiveInjection.excludedByBudget`。
+- 创建或提升为规则始终需要人工批准（`requiresUserDecision`），即使在 full-access 模式下；
+  修改规则的 `memory_update` 也必须显式携带 `authority: 'directive'`。
+- 导入（kunpack、`kun-memory-v2` 归档、profile 导入）一律降级为 `reference`，设置页导入
+  报告会列出被降级的记录数；蒸馏写入也永远是 `reference`。
+- 规则可以改写行为但不能提升权限：它们不能覆盖 Kun 策略、sandbox、工具权限、审批要求或
+  最新的显式用户指令。
+
+规则与 `AGENTS.md` 的区别：规则跨 workspace、短小、可在设置页逐条启用/禁用；
+`AGENTS.md` 适合项目级的长文档约定。
+
+## 模型可用的只读工具
+
+除 `memory_create` / `memory_update` / `memory_delete`（均需审批）外，模型还可用两个
+只读工具，无需审批：
+
+- `memory_search`：按查询词 + scope/authority/type 过滤检索活动记忆。
+- `memory_list`：分页枚举活动记忆，支持 scope/authority/type 过滤与 `includeDisabled`。
+
+两者都不返回隐藏的 agent 上下文记忆，查询不写入检索诊断，结果标注规则与参考记忆的
+区分信息。
+
 ## 诊断
 
 `GET /v1/memory/diagnostics` 和设置页 Memory 概览提供：
@@ -239,6 +272,11 @@ git diff --check
 5. 分别验证编辑、禁用、恢复、删除、导入和导出；导入记录应显示 `imported/imported` 来源。
 6. 切换到其他 workspace，确认 workspace/project 记忆不会泄漏；用户级记忆也必须先相关才注入。
 7. 使用 `KUN_MEMORY_STORE_BACKEND=file` 重启，确认状态显示文件回退且 CRUD/检索仍可用。
+8. 在设置页新建一条 user 作用域规则（如“回复一律使用英文”），开新会话问一个无关问题，
+   确认模型遵守该规则且聊天 chip 显示注入的规则数；同内容存为普通记忆则不应被当作指令。
+9. 对一条记忆点击“设为规则/取消规则”，确认需要 PATCH `authority` 生效且 project 作用域
+   无法提升；导出含规则的归档再导入，确认导入报告列出降级条数且记录为 `reference`。
+10. 让模型调用 `memory_list`/`memory_search`，确认无需审批即可枚举记忆。
 
 本地默认数据目录通常是 `~/.kun/data`；Windows 对应当前用户目录下的 `.kun\data`。测试前如需
 隔离真实数据，应使用单独的 `--data-dir` 或测试配置，不要直接删除日常数据目录。
```

**File**: `kun/src/adapters/hybrid/hybrid-memory-distillation.test.ts` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ async function setup(action: 'update' | 'supersede') {
   let time = '2026-09-03T01:00:00.000Z'
   const store = new HybridMemoryStore({ dataDir, nowIso: () => time,
     config: { enabled: true, scopes: ['workspace'], maxInjectedRecords: 8,
-      distillation: { enabled: true } } })
+      distillation: { enabled: true }, directives: { enabled: true, maxRecords: 20, maxCharacters: 4_000 } } })
   cleanup.push(() => store.shutdown())
   await store.ready()
   const target = await store.createWithId('target', {
```

**File**: `kun/src/adapters/hybrid/hybrid-memory-index.ts` (modified, +11/-3)
```diff
@@ -49,16 +49,16 @@ export class HybridMemoryIndex {
     this.db.transaction(() => {
       this.db.prepare(`
         INSERT INTO memory_records (
-          id, scope, workspace, project, lifecycle, type, confidence, importance,
+          id, scope, workspace, project, lifecycle, type, authority, confidence, importance,
           observed_at, valid_from, valid_to, expires_at, updated_at, canonical_hash,
           search_tokens, source_summaries_json, record_json
         ) VALUES (
-          @id, @scope, @workspace, @project, @lifecycle, @type, @confidence, @importance,
+          @id, @scope, @workspace, @project, @lifecycle, @type, @authority, @confidence, @importance,
           @observedAt, @validFrom, @validTo, @expiresAt, @updatedAt, @canonicalHash,
           @searchTokens, @sourceSummariesJson, @recordJson
         ) ON CONFLICT(id) DO UPDATE SET
           scope=excluded.scope, workspace=excluded.workspace, project=excluded.project,
-          lifecycle=excluded.lifecycle, type=excluded.type, confidence=excluded.confidence,
+          lifecycle=excluded.lifecycle, type=excluded.type, authority=excluded.authority, confidence=excluded.confidence,
           importance=excluded.importance, observed_at=excluded.observed_at,
           valid_from=excluded.valid_from, valid_to=excluded.valid_to, expires_at=excluded.expires_at,
           updated_at=excluded.updated_at, canonical_hash=excluded.canonical_hash,
@@ -71,6 +71,7 @@ export class HybridMemoryIndex {
         project: record.project ?? null,
         lifecycle,
         type: record.type,
+        authority: record.authority,
         confidence: record.confidence,
         importance: record.importance,
         observedAt: record.observedAt,
@@ -112,6 +113,8 @@ export class HybridMemoryIndex {
     if (!filter.includeDeleted) where.push("lifecycle != 'deleted'")
     if (!filter.all) addScopeWhere(where, params, filter, ['user', 'workspace', 'project'])
     else agentMemoryScopeSql(where, params, filter)
+    if (filter.authority) { where.push('authority=@filterAuthority'); params.filterAuthority = filter.authority }
+    if (filter.type) { where.push('type=@filterType'); params.filterType = filter.type }
     if (filter.before) {
       where.push('(updated_at<@beforeUpdated OR (updated_at=@beforeUpdated AND id>@beforeId))')
       params.beforeUpdated = filter.before.updatedAt; params.beforeId = filter.before.id
@@ -140,6 +143,11 @@ export class HybridMemoryIndex {
     ]
     const params: Record<string, unknown> = { nowIso }
     addScopeWhere(where, params, request, policy.scopes, 'r')
+    // Push explicit tool-purpose filters into the candidate query so a narrow
+    // authority/scope/type lookup is not crowded out by unrelated rows.
+    if (request.filter?.authority) { where.push('r.authority=@filterAuthority'); params.filterAuthority = request.filter.authority }
+    if (request.filter?.scope) { where.push('r.scope=@filterScope'); params.filterScope = request.filter.scope }
+    if (request.filter?.type) { where.push('r.type=@filterType'); params.filterType = request.filter.type }
     const candidateLimit = Math.max(16, Math.min(256, Math.max(request.limit, policy.maxInjectedRecords) * 16))
     params.candidateLimit = candidateLimit
     const rows = new Map<string, MemoryRow>()
```

**File**: `kun/src/adapters/hybrid/hybrid-memory-migrations.ts` (modified, +13/-1)
```diff
@@ -1,6 +1,6 @@
 import type { Database as BetterSqliteDatabase } from 'better-sqlite3'
 
-export const MEMORY_INDEX_SCHEMA_VERSION = 1
+export const MEMORY_INDEX_SCHEMA_VERSION = 2
 
 export function migrateMemoryIndex(db: BetterSqliteDatabase): void {
   db.exec(`
@@ -23,6 +23,7 @@ export function migrateMemoryIndex(db: BetterSqliteDatabase): void {
       project TEXT,
       lifecycle TEXT NOT NULL,
       type TEXT NOT NULL,
+      authority TEXT NOT NULL DEFAULT 'reference',
       confidence REAL NOT NULL,
       importance REAL NOT NULL,
       observed_at TEXT NOT NULL,
@@ -41,6 +42,8 @@ export function migrateMemoryIndex(db: BetterSqliteDatabase): void {
       ON memory_records(updated_at DESC, id ASC);
     CREATE INDEX IF NOT EXISTS memory_records_type_idx
       ON memory_records(type, scope, lifecycle);
+    CREATE INDEX IF NOT EXISTS memory_records_authority_idx
+      ON memory_records(authority, scope);
     CREATE TABLE IF NOT EXISTS memory_sources (
       memory_id TEXT NOT NULL,
       source_id TEXT NOT NULL,
@@ -60,12 +63,21 @@ export function migrateMemoryIndex(db: BetterSqliteDatabase): void {
       tokenize='unicode61'
     );
   `)
+  if (currentVersion < 2 && !memoryRecordsHasColumn(db, 'authority')) {
+    // Existing V1 rows only ever stored 'reference'; the default backfills them.
+    db.exec("ALTER TABLE memory_records ADD COLUMN authority TEXT NOT NULL DEFAULT 'reference'")
+  }
   db.prepare(`
     INSERT INTO memory_index_meta(key, value) VALUES('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value
   `).run(String(MEMORY_INDEX_SCHEMA_VERSION))
 }
 
+function memoryRecordsHasColumn(db: BetterSqliteDatabase, column: string): boolean {
+  const rows = db.prepare('PRAGMA table_info(memory_records)').all() as Array<{ name: string }>
+  return rows.some((row) => row.name === column)
+}
+
 export function memoryIndexSchemaVersion(db: BetterSqliteDatabase): number {
   const row = db.prepare("SELECT value FROM memory_index_meta WHERE key = 'schema_version'").get() as
     | { value: string }
```

**File**: `kun/src/adapters/hybrid/hybrid-memory-store.test.ts` (modified, +2/-1)
```diff
@@ -11,7 +11,8 @@ const policy: MemoryCapabilityConfig = {
   enabled: true,
   scopes: ['user', 'workspace', 'project'],
   maxInjectedRecords: 8,
-  distillation: { enabled: false }
+  distillation: { enabled: false },
+  directives: { enabled: true, maxRecords: 20, maxCharacters: 4_000 },
 }
 
 afterEach(async () => {
```

**File**: `kun/src/adapters/hybrid/hybrid-memory-store.ts` (modified, +47/-3)
```diff
@@ -23,6 +23,10 @@ import {
   type MemoryStore
 } from '../../memory/memory-store.js'
 import { memoryLifecycleState } from '../../memory/memory-ranking.js'
+import {
+  selectMemoryDirectives,
+  type MemoryDirectiveResult
+} from '../../memory/memory-directives.js'
 import { retrieveMemoryRecords, type MemoryRetrieveRequest } from '../../memory/memory-retrieval.js'
 import { MEMORY_MAX_QUERY_SEARCH_TOKENS, memorySearchTokens } from '../../memory/memory-search-tokens.js'
 import { yieldToEventLoop } from './hybrid-thread-support.js'
@@ -54,6 +58,7 @@ export class HybridMemoryStore implements MemoryStore {
   private indexStale = false
   private lastRetrieval: MemoryRetrievalTrace | undefined
   private lastInjectedIds: string[] = []
+  private lastDirectiveInjection: MemoryDirectiveResult | undefined
   private mutationQueue: Promise<unknown> = Promise.resolve()
   private mutationGeneration = 0
 
@@ -187,6 +192,32 @@ export class HybridMemoryStore implements MemoryStore {
     return records
   }
 
+  async listDirectives(access: MemoryAccess = {}): Promise<MemoryDirectiveResult> {
+    await this.ready()
+    const policy = this.config()
+    if (this.indexReady()) {
+      try {
+        this.options.beforeIndexQuery?.('list')
+        const rows = this.index!.list({ ...access, authority: 'directive', includeDeleted: false })
+        const result = selectMemoryDirectives({
+          records: rows,
+          access,
+          policy,
+          nowMs: Date.parse(this.now())
+        })
+        this.lastDirectiveInjection = result
+        this.degraded.recover()
+        return result
+      } catch (error) {
+        this.degraded.fail('directive query', error)
+      }
+    }
+    const result = await this.canonical.listDirectives(access)
+    this.lastDirectiveInjection = result
+    this.reconcileStaleIndex()
+    return result
+  }
+
   async retrieve(request: MemoryRetrieveRequest): Promise<MemoryRecord[]> {
     await this.ready()
     const policy = request.policy ?? this.config()
@@ -208,8 +239,10 @@ export class HybridMemoryStore implements MemoryStore {
           channels: candidates.channels,
           preFiltered: candidates.filtered
         })
-        this.lastRetrieval = result.trace
-        this.lastInjectedIds = [...result.trace.selectedIds]
+        if (request.purpose !== 'tool') {
+          this.lastRetrieval = result.trace
+          this.lastInjectedIds = [...result.trace.selectedIds]
+        }
         this.degraded.recover()
         return result.records
       } catch (error) {
@@ -274,7 +307,18 @@ export class HybridMemoryStore implements MemoryStore {
       staleCount,
       backfill: this.backfillState,
       degradedReason: reason,
-      lastRetrieval: this.lastRetrieval
+      lastRetrieval: this.lastRetrieval,
+      directiveCount: canonical.records.filter((record) =>
+        record.authority === 'directive' && memoryLifecycleState(record, nowMs) === 'active'
+      ).length,
+      ...(this.lastDirectiveInjection ? {
+        lastDirectiveInjection: {
+          ids: this.lastDirectiveInjection.records.map((record) => record.id),
+          excludedByBudget: this.lastDirectiveInjection.excludedByBudget,
+          truncatedIds: this.lastDirectiveInjection.truncatedIds,
+          characters: this.lastDirectiveInjection.characters
+        }
+      } : {})
     })
   }
 
```

**File**: `kun/src/adapters/hybrid/hybrid-thread-projection.ts` (modified, +3/-1)
```diff
@@ -164,6 +164,8 @@ function mergeTurnMetadata(previous: Turn, next: Turn): Turn {
     activeSkillIds: mergeStringArrays(previous.activeSkillIds, next.activeSkillIds),
     injectedMemoryIds: mergeStringArrays(previous.injectedMemoryIds, next.injectedMemoryIds),
     injectedMemorySummaries: next.injectedMemorySummaries.length > 0 ? next.injectedMemorySummaries : previous.injectedMemorySummaries,
+    injectedDirectiveIds: mergeStringArrays(previous.injectedDirectiveIds, next.injectedDirectiveIds),
+    injectedDirectiveSummaries: next.injectedDirectiveSummaries.length > 0 ? next.injectedDirectiveSummaries : previous.injectedDirectiveSummaries,
     injectedInstructionSources: next.injectedInstructionSources.length > 0 ? next.injectedInstructionSources : previous.injectedInstructionSources,
     items: mergeTurnItems(previous.items, next.items)
   }
@@ -209,7 +211,7 @@ function turnFromItems(threadId: string, turnId: string, items: TurnItem[], fall
     id: turnId, threadId,
     status: hasOpenItem ? 'running' : hasFailedItem ? 'failed' : 'completed',
     prompt, orchestration: 'direct', steering: [], attachmentIds: attachmentIdsFromItems(items), activeSkillIds: [],
-    injectedMemoryIds: [], injectedMemorySummaries: [], injectedInstructionSources: [],
+    injectedMemoryIds: [], injectedMemorySummaries: [], injectedDirectiveIds: [], injectedDirectiveSummaries: [], injectedInstructionSources: [],
     createdAt,
     finishedAt: hasOpenItem ? undefined : items[items.length - 1]?.finishedAt ?? fallbackTime,
     items
```

---

### Incident Patch 15: `7d2bef62` (2026-09-25)
**Commit Message**: feat(paper): rebuild reading experience with overlays, marks, and research tools

R0: split the PDF reader monolith into PaperUnitPdfReader plus focused
hooks (selection, position, translate card, immersive, page translate)
and a PaperPageStack render layer.

R1: reader layout presets (⌥1/2/3, persisted), immersive mode (F,
data-immersive, fullscreen sync), 250ms-stable auto selection translation
with a collapsible card, comment gutter connector lines with anti-overlap
layout and <900px dot mode, info-panel external links, and tree-row
actions/status dots.

R2: pure pdf text-block extraction, per-page translation overlays with
batched IPC + cache + stop, optional side-by-side translated mirror with
scroll/zoom sync, ⌘. region visual marks with PNG capture and composer
attach, and link/citation hover cards.

R3: reading heat bar driven by a cached reading-activity IPC, copyable
page-deep-linked citations from gutter/drawer/visual cards, and a
citation-neighbor graph in the references drawer.

New IPC follows schema -> trusted handler -> preload -> shared contract;
translations reuse paper-translate-service; seven locales updated.

Generated with [Devin](https://devin.ai)

Co-Authore

**File**: `src/main/ipc/app-ipc-schemas/paper-library.ts` (modified, +2/-0)
```diff
@@ -32,6 +32,8 @@ const metaPatchSchema = z
 
 export const paperLibraryListPayloadSchema = z.object({ ...workspaceScoped }).strict()
 
+export const paperReadingActivityPayloadSchema = z.object({ ...workspaceScoped }).strict()
+
 export const paperLibraryDetectPayloadSchema = z
   .object({
     workspaceRoots: z.array(trimmedString(MAX_PATH_LENGTH)).max(64),
```

**File**: `src/main/ipc/app-ipc-schemas/paper-reader.ts` (modified, +45/-0)
```diff
@@ -41,6 +41,51 @@ export const paperTranslateDocumentPayloadSchema = z
   })
   .strict()
 
+/** R2.2: overlay block translation — blocks arrive already ⟦n⟧-masked. */
+export const paperTranslateBlocksPayloadSchema = z
+  .object({
+    ...workspaceUnitScoped,
+    blocks: z
+      .array(
+        z
+          .object({
+            id: z.string().trim().min(1).max(80),
+            text: z.string().min(1).max(8_000)
+          })
+          .strict()
+      )
+      .min(1)
+      .max(400),
+    targetLanguage: z.enum(['zh', 'en']),
+    ...translateModel
+  })
+  .strict()
+
+/**
+ * R2.4 region capture: renderer crops the PNG itself and sends base64 +
+ * the card fields. The main side validates the PNG magic and size before
+ * writing `marks/assets/<id>.png` + `marks/<id>.json`.
+ */
+export const paperSaveVisualMarkPayloadSchema = z
+  .object({
+    ...workspaceUnitScoped,
+    mark: z
+      .object({
+        id: z.string().trim().min(1).max(80),
+        page: z.number().int().min(1).max(10_000),
+        rect: z.tuple([
+          z.number().min(0).max(1),
+          z.number().min(0).max(1),
+          z.number().min(0).max(1),
+          z.number().min(0).max(1)
+        ]),
+        comment: z.string().max(8_000).optional()
+      })
+      .strict(),
+    pngBase64: z.string().min(8).max(6_000_000)
+  })
+  .strict()
+
 export const paperReferencesPayloadSchema = z
   .object({
     ...workspaceUnitScoped,
```

**File**: `src/main/ipc/register-app-paper-library-ipc-handlers.ts` (modified, +30/-1)
```diff
@@ -7,6 +7,7 @@ import {
   paperLocalStateReadPayloadSchema,
   paperLocalStateWritePayloadSchema,
   paperMoveToGroupPayloadSchema,
+  paperReadingActivityPayloadSchema,
   paperTrashUnitPayloadSchema,
   paperUpdateMetaPayloadSchema
 } from './app-ipc-schemas/paper-library'
@@ -22,7 +23,8 @@ import type {
   PaperLibraryEntriesResult,
   PaperLibraryTrashResult,
   PaperLocalLibraryState,
-  PaperMoveToGroupResult
+  PaperMoveToGroupResult,
+  PaperReadingActivityResult
 } from '../../shared/paper/paper-library-types'
 import type { PaperUnitMetaV2 } from '../../shared/paper/paper-meta-v2'
 import {
@@ -48,6 +50,7 @@ import {
   readPaperLocalLibraryState,
   writePaperLocalUnitState
 } from '../services/paper/paper-local-state-store'
+import { readPaperReadingActivity } from '../services/paper/paper-reading-activity-service'
 
 function resolvePath(raw: string): string {
   return resolve(expandHomePath(raw.trim()))
@@ -270,6 +273,32 @@ export function registerAppPaperLibraryIpcHandlers(
     }
   )
 
+  ipcMain.handle(
+    'paper-library:reading-activity',
+    async (event, payload: unknown): Promise<PaperReadingActivityResult> => {
+      assertTrustedWorkbenchSender(event, getMainWindow)
+      const request = parseIpcPayload(
+        'paper-library:reading-activity',
+        paperReadingActivityPayloadSchema,
+        payload
+      )
+      try {
+        const workspacePath = await canonicalPath(resolvePath(request.workspaceRoot))
+        const papersDir = await papersDirFor(request.papersDir)
+        const papersDirAbs = await resolveTargetPathWithinWorkspace(papersDir, workspacePath)
+        const [units, local] = await Promise.all([
+          scanPaperLibrary(workspacePath, papersDirAbs),
+          readPaperLocalLibraryState(userDataDir(), workspacePath)
+        ])
+        const activity = await readPaperReadingActivity(units, local)
+        return { ok: true, activity }
+      } catch (error) {
+        logError?.('paper-library', 'paper-library:reading-activity failed', error)
+        return paperErrorResult<PaperReadingActivityResult>(error, 'invalid-root')
+      }
+    }
+  )
+
   ipcMain.handle(
     'paper-library:local-state-read',
     async (event, payload: unknown): Promise<PaperLocalLibraryState> => {
```

**File**: `src/main/ipc/register-app-paper-reader-ipc-handlers.ts` (modified, +83/-2)
```diff
@@ -9,8 +9,10 @@ import {
   paperMarksReadPayloadSchema,
   paperMarksWritePayloadSchema,
   paperReferencesPayloadSchema,
+  paperSaveVisualMarkPayloadSchema,
   paperResolveDoiPayloadSchema,
   paperSearchTitlePayloadSchema,
+  paperTranslateBlocksPayloadSchema,
   paperTranslateDocumentPayloadSchema,
   paperTranslateSelectionPayloadSchema,
   paperUrlMetaPayloadSchema
@@ -22,6 +24,7 @@ import type {
   PaperBibtexImportResult,
   PaperMarksResult,
   PaperReferencesResult,
+  PaperTranslateBlocksResult,
   PaperTranslateDocumentResult,
   PaperTranslateTextResult
 } from '../../shared/paper/paper-library-types'
@@ -44,15 +47,18 @@ import {
   importPaperBibtex
 } from '../services/paper/paper-library-service'
 import {
+  deletePaperMarkCard,
   listPaperMarkCards,
   mergeWritePaperAnnotations,
   readPaperAnnotations,
-  writePaperMarkCard
+  writePaperMarkCard,
+  writePaperVisualMarkPng
 } from '../services/paper/paper-marks-service'
 import {
   translatePaperDocument,
   translatePaperSelection
 } from '../services/paper/paper-translate-service'
+import { translatePaperBlocks } from '../services/paper/paper-block-translate'
 import { resolvePaperReferences } from '../services/paper/paper-references-service'
 import {
   fetchArxivToday,
@@ -139,11 +145,14 @@ export function registerAppPaperReaderIpcHandlers(
           (request.items as { kind?: string }[]).filter((item) => item?.kind === 'highlight')
         )
         const cards = (request.items as { kind?: string }[]).filter(
-          (item) => item && (item.kind === 'translate' || item.kind === 'ask')
+          (item) => item && (item.kind === 'translate' || item.kind === 'ask' || item.kind === 'visual')
         )
         for (const card of cards) {
           await writePaperMarkCard(unitDirAbs, card)
         }
+        for (const removedId of request.removedIds ?? []) {
+          await deletePaperMarkCard(unitDirAbs, removedId)
+        }
         const merged = await mergeWritePaperAnnotations(
           unitDirAbs,
           highlights,
@@ -157,6 +166,47 @@ export function registerAppPaperReaderIpcHandlers(
     }
   )
 
+  ipcMain.handle(
+    'paper-reader:save-visual-mark',
+    async (event, payload: unknown) => {
+      assertTrustedWorkbenchSender(event, getMainWindow)
+      const request = parseIpcPayload(
+        'paper-reader:save-visual-mark',
+        paperSaveVisualMarkPayloadSchema,
+        payload
+      )
+      try {
+        const png = Buffer.from(request.pngBase64, 'base64')
+        const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
+        if (png.length < 8 || !png.subarray(0, 8).equals(PNG_MAGIC) || png.length > 4 * 1024 * 1024) {
+          return { ok: false as const, code: 'invalid-image' as const, message: 'Invalid PNG payload.' }
+        }
+        const { unitDirAbs } = await unitDirAbsFor(request.workspaceRoot, request.unitDir)
+        const meta = await readPaperUnitMetaV2(unitDirAbs)
+        if (!meta) {
+          return { ok: false as const, code: 'invalid-unit' as const, message: 'paper.json is missing or invalid.' }
+        }
+        const imagePath = await writePaperVisualMarkPng(unitDirAbs, request.mark.id, png)
+        const now = new Date().toISOString()
+        const card = {
+          id: request.mark.id,
+          kind: 'visual' as const,
+          page: request.mark.page,
+          rect: request.mark.rect,
+          ...(request.mark.comment ? { comment: request.mark.comment } : {}),
+          image: { path: imagePath },
+          createdAt: now,
+          updatedAt: now
+        }
+        await writePaperMarkCard(unitDirAbs, card)
+        return { ok: true as const, mark: card }
+      } catch (error) {
+        logError?.('paper-reader', 'save-visual-mark failed', error)
+        return paperError<unknown>(error, 'io', 'Failed to save the region mark.')
+      }
+    }
+  )
+
   // ---- translation ------------------------------------------------------------
 
   ipcMain.handle(
@@ -221,6 +271,37 @@ export function registerAppPaperReaderIpcHandlers(
     }
   )
 
+  ipcMain.handle(
+    'paper-reader:translate-blocks',
+    async (event, payload: unknown): Promise<PaperTranslateBlocksResult> => {
+      assertTrustedWorkbenchSender(event, getMainWindow)
+      const request = parseIpcPayload(
+        'paper-reader:translate-blocks',
+        paperTranslateBlocksPayloadSchema,
+        payload
+      )
+      try {
+        const { unitDirAbs } = await unitDirAbsFor(request.workspaceRoot, request.unitDir)
+        const meta = await readPaperUnitMetaV2(unitDirAbs)
+        if (!meta) {
+          return { ok: false, code: 'invalid-unit', message: 'paper.json is missing or invalid.' }
+        }
+        const settings = await store.load()
+        return await translatePaperBlocks({
+          settings,
+          unitDirAbs,
+          blocks: request.blocks,
+          targetLanguage: request.targetLanguage,
+          providerId: r
```

**File**: `src/main/services/paper/paper-block-translate.test.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import { describe, expect, it } from 'vitest'
+import {
+  buildBlockBatchPrompt,
+  groupBlocksIntoBatches,
+  parseBlockBatchReply
+} from './paper-block-translate'
+
+describe('groupBlocksIntoBatches', () => {
+  const blocks = (sizes: number[]) =>
+    sizes.map((size, i) => ({ id: `b${i}`, text: 'x'.repeat(size) }))
+
+  it('packs blocks sequentially under the char cap', () => {
+    const batches = groupBlocksIntoBatches(blocks([2000, 2000, 2000]), 4500)
+    expect(batches.map((b) => b.length)).toEqual([2, 1])
+  })
+
+  it('keeps an oversized block in its own batch', () => {
+    const batches = groupBlocksIntoBatches(blocks([100, 9000, 100]), 4500)
+    expect(batches.map((b) => b.length)).toEqual([1, 1, 1])
+  })
+})
+
+describe('buildBlockBatchPrompt + parseBlockBatchReply', () => {
+  const batch = [
+    { id: 'a', text: 'Hello world' },
+    { id: 'b', text: 'Second block' }
+  ]
+
+  it('round-trips a well-formed reply', () => {
+    const prompt = buildBlockBatchPrompt(batch)
+    expect(prompt).toBe('[[0]]\nHello world\n\n[[1]]\nSecond block')
+    const reply = '[[0]]\n你好世界\n\n[[1]]\n第二段'
+    expect(parseBlockBatchReply(reply, batch)).toEqual({ a: '你好世界', b: '第二段' })
+  })
+
+  it('tolerates whitespace inside markers', () => {
+    const reply = '[[ 0 ]]你好\n\n[[1]] 第二段'
+    expect(parseBlockBatchReply(reply, batch)).toEqual({ a: '你好', b: '第二段' })
+  })
+
+  it('returns null when a marker is missing (fallback to per-block)', () => {
+    expect(parseBlockBatchReply('[[0]]\n你好', batch)).toBeNull()
+    expect(parseBlockBatchReply('no markers at all', batch)).toBeNull()
+  })
+})
```

**File**: `src/main/services/paper/paper-block-translate.ts` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+import { createHash } from 'node:crypto'
+import { mkdir, readFile, writeFile } from 'node:fs/promises'
+import { join } from 'node:path'
+import { PAPER_CACHE_DIR_NAME } from '../../../shared/paper/paper-types'
+import type { AppSettingsV1 } from '../../../shared/app-settings'
+import { oneShotModelRequest } from '../one-shot-model-request'
+import { resolvePaperTranslateModel } from './paper-translate-service'
+
+/**
+ * R2.2 overlay block translation: the renderer sends pre-masked text blocks
+ * (`⟦n⟧` placeholders keep math/URLs/citations opaque). Blocks batch into
+ * ≤4500-char requests behind `[[n]]` markers so one model call translates a
+ * whole batch; a marker-count mismatch degrades the batch to per-block
+ * requests. Translations cache per block (sha1 of the masked source) in
+ * `.cache/translate-blocks-<lang>-<modelHash>.json` — same convention as the
+ * whole-document translator.
+ */
+
+export const BLOCK_BATCH_MAX_CHARS = 4_500
+const BLOCK_BATCH_CONCURRENCY = 2
+const BLOCK_TRANSLATE_TIMEOUT_MS = 90_000
+
+export type TranslateBlockInput = { id: string; text: string }
+
+type TranslateCache = Record<string, string>
+
+/** Sequential packing: a batch is blocks whose joined text fits `maxChars`. */
+export function groupBlocksIntoBatches(
+  blocks: readonly TranslateBlockInput[],
+  maxChars: number = BLOCK_BATCH_MAX_CHARS
+): TranslateBlockInput[][] {
+  const batches: TranslateBlockInput[][] = []
+  let current: TranslateBlockInput[] = []
+  let size = 0
+  for (const block of blocks) {
+    const blockSize = block.text.length + 8 // `[[n]]` marker + newlines
+    if (current.length && size + blockSize > maxChars) {
+      batches.push(current)
+      current = []
+      size = 0
+    }
+    current.push(block)
+    size += blockSize
+    // An oversized single block still forms its own batch — the fallback path
+    // translates it alone when the marker parse fails.
+    if (size >= maxChars) {
+      batches.push(current)
+      current = []
+      size = 0
+    }
+  }
+  if (current.length) batches.push(current)
+  return batches
+}
+
+/** Each block is prefixed `[[index-in-batch]]` on its own line. */
+export function buildBlockBatchPrompt(batch: readonly TranslateBlockInput[]): string {
+  return batch.map((block, index) => `[[${index}]]\n${block.text}`).join('\n\n')
+}
+
+/**
+ * Split a reply on `[[n]]` markers back into per-block text. Returns null
+ * when any expected marker is missing — the caller then falls back to
+ * translating that batch one block at a time.
+ */
+export function parseBlockBatchReply(
+  reply: string,
+  batch: readonly TranslateBlockInput[]
+): Record<string, string> | null {
+  const parts = reply.split(/\[\[\s*(\d+)\s*\]\]/)
+  // parts alternates: [prefix, n, text, n, text, …]
+  const byIndex = new Map<number, string>()
+  for (let i = 1; i + 1 < parts.length; i += 2) {
+    const index = Number(parts[i])
+    const text = parts[i + 1].trim()
+    if (!byIndex.has(index)) byIndex.set(index, text)
+  }
+  const out: Record<string, string> = {}
+  for (const [index, block] of batch.entries()) {
+    const text = byIndex.get(index)
+    if (text === undefined) return null
+    out[block.id] = text
+  }
+  return out
+}
+
+const blockKey = (text: string): string => createHash('sha1').update(text).digest('hex')
+
+function blockTranslateSystemPrompt(targetLanguage: 'zh' | 'en'): string {
+  return [
+    `You are an academic-paper translator. Translate every [[n]]-marked block into ${targetLanguage === 'zh' ? 'Simplified Chinese' : 'English'}.`,
+    'Rules: keep the [[n]] markers, the block order and the block count verbatim; keep ⟦n⟧ tokens,',
+    'formulas, citation markers, figure/table numbers and inline code unchanged; on the first',
+    'occurrence of a technical term append the original in parentheses; output only the translated',
+    'blocks — no explanations, no commentary.'
+  ].join(' ')
+}
+
+async function readTranslateCache(path: string): Promise<TranslateCache> {
+  try {
+    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
+    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
+      return parsed as TranslateCache
+    }
+  } catch {
+    // Missing or corrupt cache is fine — retranslate.
+  }
+  return {}
+}
+
+export async function translatePaperBlocks(input: {
+  settings: AppSettingsV1
+  unitDirAbs: string
+  blocks: TranslateBlockInput[]
+  targetLanguage: 'zh' | 'en'
+  providerId?: string
+  model?: string
+}): Promise<
+  | { ok: true; translations: Record<string, string>; cachedBlocks: number; translatedBlocks: number }
+  | { ok: false; code: 'network' | 'timeout' | 'config' | 'io' | 'invalid-unit' | 'invalid-input'; message: string }
+> {
+  const model = resolvePaperTranslateModel(input.settings, {
+    providerId: input.providerId,
+    model: input.model
+  })
+  if (!model) return { ok: false, code: 'config', message: 'No translation model configured.' }
+  i
```

**File**: `src/main/services/paper/paper-marks-service.ts` (modified, +37/-2)
```diff
@@ -1,12 +1,14 @@
-import { mkdir, readFile, readdir } from 'node:fs/promises'
+import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
 import { join } from 'node:path'
 import {
   PAPER_MARKS_ANNOTATIONS_FILE,
+  PAPER_MARKS_ASSETS_DIR,
   PAPER_MARKS_DIR_NAME,
   mergePaperHighlights,
   paperAnnotationsFileSchema,
   paperAskMarkSchema,
   paperTranslateMarkSchema,
+  paperVisualMarkSchema,
   type PaperAnnotationsFile,
   type PaperHighlight
 } from '../../../shared/paper/paper-marks-types'
@@ -83,6 +85,8 @@ export async function readPaperMarkCard(
     if (translate.success) return translate.data
     const ask = paperAskMarkSchema.safeParse(json)
     if (ask.success) return ask.data
+    const visual = paperVisualMarkSchema.safeParse(json)
+    if (visual.success) return visual.data
     return null
   } catch {
     return null
@@ -95,7 +99,14 @@ export async function writePaperMarkCard(
 ): Promise<void> {
   const translate = paperTranslateMarkSchema.safeParse(card)
   const ask = translate.success ? null : paperAskMarkSchema.safeParse(card)
-  const parsed = translate.success ? translate.data : ask?.success ? ask.data : null
+  const visual = !translate.success && !ask?.success ? paperVisualMarkSchema.safeParse(card) : null
+  const parsed = translate.success
+    ? translate.data
+    : ask?.success
+      ? ask.data
+      : visual?.success
+        ? visual.data
+        : null
   if (!parsed || !MARK_ID_RE.test(parsed.id)) {
     throw new Error('Invalid mark card payload.')
   }
@@ -106,6 +117,30 @@ export async function writePaperMarkCard(
   )
 }
 
+/** R2.4: store a captured region PNG under `marks/assets/<id>.png`. */
+export async function writePaperVisualMarkPng(
+  unitDirAbs: string,
+  markId: string,
+  png: Buffer
+): Promise<string> {
+  if (!MARK_ID_RE.test(markId)) throw new Error('Invalid mark id.')
+  const dir = join(marksDir(unitDirAbs), PAPER_MARKS_ASSETS_DIR)
+  await mkdir(dir, { recursive: true })
+  const filePath = join(dir, `${markId}.png`)
+  await writeFile(filePath, png)
+  return `${PAPER_MARKS_ASSETS_DIR}/${markId}.png`
+}
+
+/**
+ * Remove a per-id card file plus any visual-mark asset it owns. Called from
+ * the marks-write merge when `removedIds` contains a card id.
+ */
+export async function deletePaperMarkCard(unitDirAbs: string, markId: string): Promise<void> {
+  if (!MARK_ID_RE.test(markId)) return
+  await rm(join(marksDir(unitDirAbs), `${markId}.json`), { force: true })
+  await rm(join(marksDir(unitDirAbs), PAPER_MARKS_ASSETS_DIR, `${markId}.png`), { force: true })
+}
+
 export async function listPaperMarkCards(unitDirAbs: string): Promise<unknown[]> {
   try {
     const names = await readdir(marksDir(unitDirAbs))
```

**File**: `src/main/services/paper/paper-reading-activity-service.test.ts` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { afterEach, beforeEach, describe, expect, it } from 'vitest'
+import {
+  readPaperReadingActivity,
+  resetPaperReadingActivityCache
+} from './paper-reading-activity-service'
+import type { ScannedPaperUnit } from './paper-library-service'
+
+function unit(dirAbs: string, unitDir: string): ScannedPaperUnit {
+  return {
+    dirAbs,
+    unitDir,
+    meta: { version: 2, title: 't', slug: 't', importedAt: '2025-01-01T00:00:00.000Z', authors: [] },
+    group: '',
+    hasPdf: true,
+    hasNotes: false,
+    interpretationCount: 0
+  }
+}
+
+describe('readPaperReadingActivity', () => {
+  let root = ''
+
+  beforeEach(async () => {
+    root = await mkdtemp(join(tmpdir(), 'paper-activity-'))
+    resetPaperReadingActivityCache()
+  })
+
+  afterEach(async () => {
+    await rm(root, { recursive: true, force: true })
+  })
+
+  it('counts annotations and card pages per unit', async () => {
+    const marks = join(root, 'u1', 'marks')
+    await mkdir(marks, { recursive: true })
+    await writeFile(join(marks, 'annotations.json'), JSON.stringify({
+      version: 1,
+      items: [
+        { id: 'a', kind: 'highlight', color: 'yellow', page: 1, rects: [[0, 0, 0.1, 0.1]], quote: 'q', createdAt: 'x', updatedAt: 'x' },
+        { id: 'b', kind: 'highlight', color: 'blue', page: 1, rects: [[0, 0, 0.1, 0.1]], quote: 'q', createdAt: 'x', updatedAt: 'x' },
+        { id: 'c', kind: 'highlight', color: 'pink', page: 4, rects: [[0, 0, 0.1, 0.1]], quote: 'q', createdAt: 'x', updatedAt: 'x' }
+      ]
+    }))
+    await writeFile(join(marks, 't1.json'), JSON.stringify({ id: 't1', kind: 'translate', page: 2, quote: 'q', translation: 'x', targetLanguage: 'zh', model: 'm', createdAt: 'x' }))
+    await writeFile(join(marks, 'v1.json'), JSON.stringify({ id: 'v1', kind: 'visual', page: 2, rect: [0, 0, 0.5, 0.5], image: { path: 'assets/v1.png' }, createdAt: 'x', updatedAt: 'x' }))
+    // Corrupt file is skipped, not fatal.
+    await writeFile(join(marks, 'broken.json'), '{oops')
+
+    const activity = await readPaperReadingActivity(
+      [unit(join(root, 'u1'), 'papers/u1')],
+      { version: 1, units: { 'papers/u1': { lastPage: 6, pageCount: 10 } } }
+    )
+    expect(activity['papers/u1']).toEqual({
+      pages: [2, 2, 0, 1],
+      pageCount: 10,
+      lastPage: 6
+    })
+  })
+
+  it('omits units with no marks and no local state', async () => {
+    await mkdir(join(root, 'empty'), { recursive: true })
+    const activity = await readPaperReadingActivity(
+      [unit(join(root, 'empty'), 'papers/empty')],
+      { version: 1, units: {} }
+    )
+    expect(activity).toEqual({})
+  })
+
+  it('serves repeated reads from the mtime cache', async () => {
+    const marks = join(root, 'u2', 'marks')
+    await mkdir(marks, { recursive: true })
+    await writeFile(join(marks, 'annotations.json'), JSON.stringify({
+      version: 1,
+      items: [{ id: 'a', kind: 'highlight', color: 'yellow', page: 3, rects: [[0, 0, 0.1, 0.1]], quote: 'q', createdAt: 'x', updatedAt: 'x' }]
+    }))
+    const scanned = [unit(join(root, 'u2'), 'papers/u2')]
+    const first = await readPaperReadingActivity(scanned, { version: 1, units: {} })
+    expect(first['papers/u2'].pages).toEqual([0, 0, 1])
+    // Add a card file — signature change must invalidate the cache.
+    await writeFile(join(marks, 'ask1.json'), JSON.stringify({ id: 'ask1', kind: 'ask', page: 3, quote: 'q', question: '?', createdAt: 'x' }))
+    const second = await readPaperReadingActivity(scanned, { version: 1, units: {} })
+    expect(second['papers/u2'].pages).toEqual([0, 0, 2])
+  })
+})
```

#### Recent Merged Pull Requests:
- **PR #1385** (2026-10-06): feat(paper): add version-bound evidence and bounded reading (@XingYu-Zhong)
- **PR #1384** (2026-10-05): fix(reliability): harden queued recovery, updates, and workflows (@XingYu-Zhong)
- **PR #1383** (2026-10-05): feat(rooms): confirm Agent models and expose scoped model management (@XingYu-Zhong)
- **PR #1382** (2026-10-05): fix(agents): restore personal avatar and new-chat permissions (@XingYu-Zhong)
- **PR #1381** (2026-10-05): fix(speech): restore verified offline read-aloud downloads (@XingYu-Zhong)
- **PR #1380** (2026-10-05): feat(gateway): connect clients through safe routed model access (@XingYu-Zhong)
- **PR #1378** (2026-10-03): feat(agents): require explicit readiness-checked enablement (@XingYu-Zhong)
- **PR #1376** (2026-10-02): feat(agents): add voice input to conversational Agent composer (@XingYu-Zhong)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
