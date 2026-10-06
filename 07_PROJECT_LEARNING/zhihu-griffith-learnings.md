# Forensic Learning Record (Deep Inspection): zhihu/griffith

> **Canonical Artifact**: `07_PROJECT_LEARNING/zhihu-griffith-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zhihu/griffith](https://github.com/zhihu/griffith))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:53:06.294Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zhihu/griffith`
- **Description**: A React-based web video player
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2507 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example/src/utils.ts`
```
/* eslint-disable no-console */

import throttle from 'lodash/throttle'
import {EVENTS} from 'griffith'

const createGroupedLogger = (label = 'Log', wait = 100) => {
  const logs: any[] = []
  const flush = throttle(() => {
    console.groupCollapsed?.(`[Click to expand]: ${label}, ${logs.length} logs`)
    let log
    while ((log = logs.shift())) {
      console.info(...log)
    }
    console.groupEnd?.()
  }, wait)
  return (...args: any[]) => {
    logs.push(args)
    flush()
  }
}

const groupedLogger = createGroupedLogger('TIMEUPDATE', 2000)

export const logEvent = (e: string, data: any) => {
  const args = ['onEvent', e, data]
  if (e === EVENTS.TIMEUPDATE) {
    groupedLogger(...args)
  } else {
    console.log(...args)
  }
}

```

### Core Architecture Module: `packages/griffith-hls/src/utils/createMasterM3U8.ts`
```
type Item = {
  bandwidth: number
  resolution: {
    height: number
    width: number
  }
  source: string
}

export default function createMasterM3U8(list: Item[]) {
  const result = []
  result.push('#EXTM3U')

  list.forEach((item) => {
    const meta: Record<string, unknown> = {
      'PROGRAM-ID': '1',
      BANDWIDTH: String(item.bandwidth),
    }
    if (item.resolution) {
      const {width, height} = item.resolution
      meta.RESOLUTION = `${width}x${height}`
    }
    result.push(
      `#EXT-X-STREAM-INF:${Object.entries(meta)
        .map(([key, value]) => `${key}=${value as string}`)
        .join(',')}`
    )

    result.push(item.source)
  })

  return result.join('\n')
}

```

### Core Architecture Module: `packages/griffith-hls/src/utils/getMasterM3U8Blob.ts`
```
import {Source} from '../types'
import createMasterM3U8 from './createMasterM3U8'

export default (sources: Source[]): Blob => {
  const list = sources.map((item) => ({
    source: item.source,
    bandwidth: item.bitrate * 1024,

    resolution: {
      width: item.width,
      height: item.height,
    },
  }))

  return new Blob([createMasterM3U8(list)], {
    type: 'application/vnd.apple.mpegURL',
  })
}

```

### Core Architecture Module: `packages/griffith-hls/src/utils/index.ts`
```
import createMasterM3U8 from './createMasterM3U8'
import getMasterM3U8Blob from './getMasterM3U8Blob'

export {createMasterM3U8, getMasterM3U8Blob}

```

### Core Architecture Module: `packages/griffith-mp4/src/fmp4/utils/concatTypedArray.ts`
```
export default function concatTypedArray(...arrays: any[]) {
  let totalLength = 0
  for (const arr of arrays) {
    totalLength += arr.length
  }
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

```

### Core Architecture Module: `packages/griffith-mp4/src/fmp4/utils/constants.ts`
```
// prettier-ignore
export const MATRIX_TYPED_ARRAY = new Uint8Array([
  0x00, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x40, 0x00, 0x00, 0x00, 
])

```

### Core Architecture Module: `packages/griffith-mp4/src/fmp4/utils/generateBox.ts`
```
import {num2FourBytes} from './num2Bytes'
import str2TypedArray from './str2TypedArray'
import concatTypedArray from './concatTypedArray'

export default function generateBox(
  type: string,
  content: Uint8Array | number[]
) {
  return concatTypedArray(
    num2FourBytes(content.length + 8),
    str2TypedArray(type),
    content
  )
}

```

### Core Architecture Module: `packages/griffith-mp4/src/fmp4/utils/generateBytes.ts`
```
export function generatePredefined(length: any) {
  return generateZeroBytes(length)
}

export function generateReserved(length: any) {
  return generateZeroBytes(length)
}

function generateZeroBytes(bytes: any) {
  return new Uint8Array(bytes)
}

```

### Core Architecture Module: `packages/griffith-mp4/src/fmp4/utils/generateVersionAndFlags.ts`
```
export default function generateVersionAndFlags(version: number, flag: number) {
  return new Uint8Array([
    version & 0xff,
    (flag >> 16) & 0xff,
    (flag >> 8) & 0xff,
    flag & 0xff,
  ])
}

```

### Core Architecture Module: `packages/griffith-mp4/src/fmp4/utils/index.ts`
```
import generateVersionAndFlags from './generateVersionAndFlags'
import concatTypedArray from './concatTypedArray'
import generateBox from './generateBox'
import str2TypedArray from './str2TypedArray'
import {generatePredefined, generateReserved} from './generateBytes'
import {num2FourBytes, num2EightBytes} from './num2Bytes'

export {
  generateVersionAndFlags,
  concatTypedArray,
  generateBox,
  str2TypedArray,
  generatePredefined,
  generateReserved,
  num2FourBytes,
  num2EightBytes,
}

```

### Core Architecture Module: `packages/griffith-mp4/src/fmp4/utils/num2Bytes.ts`
```
export function num2FourBytes(num: number) {
  return new Uint8Array([
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ])
}

export function num2EightBytes(num: number) {
  const upper = num / Math.pow(2, 32)
  const lower = num % Math.pow(2, 32)
  return new Uint8Array([
    (upper >>> 24) & 0xff,
    (upper >>> 16) & 0xff,
    (upper >>> 8) & 0xff,
    upper & 0xff,
    (lower >>> 24) & 0xff,
    (lower >>> 16) & 0xff,
    (lower >>> 8) & 0xff,
    lower & 0xff,
  ])
}

```

### Core Architecture Module: `packages/griffith-mp4/src/fmp4/utils/str2TypedArray.ts`
```
const char2Hex = (char: string) => char.charCodeAt(0)

const str2TypedArray = (str: string) => {
  // 字符串转 uint8 array
  // 应该使用 Uint8Array.from/TextEncoder
  return new Uint8Array(
    Array.prototype.map.call(str, char2Hex) as Iterable<number>
  )
}

export default str2TypedArray

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #309** (2026-06-15): **feat(griffith): support customPlayer, customHeaders and cover-loaded play gate**
  *Symptoms*: Pull Request Template Description 本 PR 为 Griffith Player 扩展三项能力，便于业务侧自定义播放行为与封面交互体验：  1. 封面加载完成前禁止播放（Cover-loaded play gate） 新增 isCoverLoaded 状态，跟踪封面图加载进度 封面未加载完成时：展示 Loader、隐藏播放按钮、禁止点击封面触发播放 支持 onLoad / onError 及浏览器缓存命中（img.complete）场景 cover prop 变化时自动重置加载状态 2. customHeaders 透传 Player 新增 customHeaders?: Record<string, string> prop 经 Player → Video → VideoWithMessage → 底层 VideoComponent 透传 为业务侧在自定义播放插件中注入 HTTP 请求头（如鉴权 Token）预留接口 Note: 当前仅完成 props 链路透传；griffith-hls / griffith-mp4 / NormalVideo 尚未消费该字段。若需默认插件支持，需在对应包中实现（如 HLS 的 xhrSetup）。  3. customPlayer 自定义 MP4 MSE 插件注入 Player 新增 customPlayer?: VideoPlugin prop 新增 VideoPlugin 类型（结构与 griffith-mp4 / griffith-hls 默认导出一致） selectVideo 在 format === 'mp4' && useMSE 时优先使用 customPlayer，否则回退至 griffith-mp4，再回退至 NormalVideo 切清晰度时的 willHandleSrcChange 逻辑同步支持自定义插件 Motivation: 业务需要替换默认 MP4 MSE 实现（如自定义 fetch / 鉴权），并避免封面未加载时用户误触播放；同时为请求头自定义预留扩展点。  Dependencies: 无新增外部依赖。  Fixes # (issue)  How Has This Been Tested?   有 cover 时：封面加载中显示 Loader，加载完成后才显示播放按钮并可点击播放   封面加载失败（onError）时：仍可正常点击播放   无 cover 时：行为与改动前一致，不受影响   传入 customPlayer（useMSE={true} + MP4 源）时：使用自定义 VideoComponent 播放   未传 customPlayer 时：仍使用默认 griffith-mp4 插件   切换清晰度时：willHandleSrcChange 与自定义插件行为一致   HLS（m3u8）播放：不受 customPlayer 影响，行为与改动前一致 Test configuration: 本地 example 或业务集成环境，Chrome / Safari，MP4 MSE 与 HLS 场景各验证一次。  

- **Issue #308** (2025-05-20): **fix: does not render 0 when duration and current time both are 0**
  *Symptoms*: the expression `0 && 0 === 0 && elem` returns 0, so it renders weird 0 at first few frames and disappears afterwards.

- **Issue #306** (2024-03-18): **feat: upgrade Rollup to v4, TypeScript to v5**
  *Symptoms*: # Pull Request Template  ## Description  - 更新全部开发依赖（Jest/ESlint/Prettier/TypeScript...），避免当前在 Node 20 下构建不了（切至 16 能构建），同时避免这个：https://github.blog/changelog/2023-09-22-github-actions-transitioning-from-node-16-to-node-20/ - 更新 React 版本范围到 18，示例也同步 - Yarn 升级到 v4 - 移除没有使用过的 website 目录下的文件  Fixes # (issue)  ## How Has This Been Tested?  Please describe the tests that you ran to verify your changes. Please also note any relevant details for your test configuration.  - [ ] Test A - [ ] Test B  ## Checklist:  - [ ] My code follows the style guidelines of this project - [ ] I have performed a self-review of my own code - [ ] I have commented my code, particularly in hard-to-understand areas - [ ] I have made corresponding changes to the documentation - [ ] My changes generate no new warnings - [ ] Any dependent changes have been merged and published in downstream modules 

- **Issue #305** (2024-03-18): **feat: 透传 video 标签 crossorigin**
  *Symptoms*: # Pull Request Template  ## Description  提供能够透传 video 原生属性 crossorigin 的能力 

- **Issue #303** (2023-11-06): **useEffect中使用messageContextRef无效**
  *Symptoms*: 我在父组件中通过改变url props 来改变当前要播放时的视频源，但是我需要切换时从0开始播放。 当我这么写的时候，ACTION触发无效： ``` export default function IVideo({ url, ...props }) {   const messageContextRef = useMessageContextRef();    useEffect(() => {           messageContextRef .dispatchAction(ACTIONS.TIME_UPDATE, { currentTime: 0 });           messageContextRef .dispatchAction(ACTIONS.PLAY);   }, [url]);    return (     <div className={style.videoPlayer} {...props}>       <Player         messageContextRef={messageContextRef}         shouldObserveResize={true}         initialObjectFit={'contain'}         className={style.player}         locale="zh-Hans"         // autoplay={true}         disablePictureInPicture={true}         hiddenQualityMenu={true}         sources={{           hd: {             play_url: url,           },         }}       />     </div>   ); }  ```  但是使用button 添加onClick的时候dispatchAction有效，但是我实际触发的方式是父组件监听了键盘事件来切换url。 为此我使用了各种方法，最后通过useEffect向外抛出ref实现了： ``` export default function IVideo({ url, exposeRef = () => {}, ...props }) {   const messageContextRef = useMessageContextRef();    useEffect(() => {     exposeRef(messageContextRef);   }, [messageContextRef]);    return (     <div className={style.videoPlayer} {...props}>       <Player         messageContextRef={messageContextRef}         shouldObserveResize={true}         initialObjectFit={'contain'}         className={style.player}         locale="zh-Hans"         // autoplay={true}         disablePictur
  **Post-Mortem & Fix Analysis**:
  > duplicate of #302 

- **Issue #302** (2025-01-25): **如何重置当前视频进度？**
  *Symptoms*: 我在外层通过改变传递的url props 让Player播放不同的视频，但是怎么才能当url切换时重置或者将currentTime设置为0呢？ 我尝试了 ``` useEffect(()=>{     messageContextRef.dispatchAction(ACTIONS.TIME_UPDATE,{currentTime:0}) },[url])  ``` 并不生效  组件如下： ``` export default function IVideo({ url, ...props }) {   return (     <div className={style.videoPlayer} {...props}>       <Player         shouldObserveResize={true}         initialObjectFit={'contain'}         className={style.player}         locale="zh-Hans"         autoplay={true}         disablePictureInPicture={true}         hiddenQualityMenu={true}         sources={{           hd: {             play_url: url,           },         }}       />     </div>   ); } ```
  **Post-Mortem & Fix Analysis**:
  > 按项目示例下的使用是有效的，如果可以的话，请提供一个示例。

- **Issue #300** (2023-04-13): **如果视频链接播放需要携带cookie，但是目前不支持withCredentials**
  *Symptoms*: 

- **Issue #299** (2023-03-27): **chore: add video size for events payload**
  *Symptoms*: # Pull Request Template  ## Description  Add `videoWidth` and `videoHeight` properties to events payload.  ## How Has This Been Tested?  - [x] Run examples locally, listeners can receive these properties.  ## Checklist:  - [x] My code follows the style guidelines of this project - [x] I have performed a self-review of my own code - [x] I have commented my code, particularly in hard-to-understand areas - [x] I have made corresponding changes to the documentation - [x] My changes generate no new warnings - [x] Any dependent changes have been merged and published in downstream modules 

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

### Incident Patch 1: `9fe8e768` (2025-05-20)
**Commit Message**: fix: does not render 0 when duration and current time both are 0

**File**: `packages/griffith/src/components/Player.tsx` (modified, +1/-1)
```diff
@@ -679,7 +679,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
               )}
             </ObjectFitContext.Consumer>
           )}
-          {duration && currentTime === 0 && (
+          {duration !== 0 && currentTime === 0 && (
             <div
               className={css(
                 styles.coverTime,
```

---

### Incident Patch 2: `6d8de0d4` (2022-09-30)
**Commit Message**: fix: 多个播放器使用同一个 Pip 实例问题修复

**File**: `packages/griffith/src/components/Player.tsx` (modified, +14/-8)
```diff
@@ -168,6 +168,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
   const [pressed, pressedSwitch] = useBoolean()
   const [isPageFullScreen, isPageFullScreenSwitch] = useBoolean()
   const [isLoading, isLoadingSwitch] = useBoolean()
+  const pipRef = useRef<InstanceType<typeof Pip>>()
 
   useEffect(() => {
     if (durationProp && !duration) {
@@ -243,8 +244,9 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
 
   // setup pip
   useEffect(() => {
-    if (!disablePictureInPicture && videoRef.current!.root && !Pip.inited) {
-      Pip.init(
+    if (!disablePictureInPicture && videoRef.current!.root && !pipRef.current) {
+      pipRef.current = new Pip()
+      pipRef.current.init(
         videoRef.current!.root,
         () => emitEvent(EVENTS.ENTER_PIP),
         () => emitEvent(EVENTS.EXIT_PIP)
@@ -292,10 +294,10 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
       })
   })
 
-  const handlePause = () => {
+  const handlePause = useHandler(() => {
     emitEvent(EVENTS.REQUEST_PAUSE)
     isPlayingSwitch.off()
-  }
+  })
 
   const handleVideoPlay = () => {
     if (!isPlaying) {
@@ -378,7 +380,10 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
 
   const handleTogglePageFullScreen = useHandler(() => {
     // 如果当前正在全屏就先关闭全屏
-    if (Boolean(BigScreen.element) && !Pip.pictureInPictureElement) {
+    if (
+      Boolean(BigScreen.element) &&
+      !pipRef.current?.pictureInPictureElement
+    ) {
       handleToggleFullScreen()
     }
     if (isPageFullScreen) {
@@ -395,7 +400,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
       isPageFullScreenSwitch.off()
       emitEvent(EVENTS.EXIT_PAGE_FULLSCREEN)
     }
-    Pip.toggle()
+    pipRef.current?.toggle()
   })
 
   const hideControllerTimerRef = useRef(
@@ -494,7 +499,8 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
     }
   }, [autoplay, handlePlay, handleSeek, handlePause, prevSources, sources])
 
-  const isPip = Boolean(Pip.pictureInPictureElement)
+  const isPip = Boolean(pipRef.current?.pictureInPictureElement)
+
   // Safari 会将 pip 状态视为全屏
   const isFullScreen = Boolean(BigScreen.element) && !isPip
   const bufferedTime = useMemo(
@@ -593,7 +599,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
             onProgressDotHover={handleProgressDotHover}
             onProgressDotLeave={handleProgressDotLeave}
             show={showController}
-            showPip={Pip.supported && !disablePictureInPicture}
+            showPip={!disablePictureInPicture && pipRef.current?.supported}
             hiddenPlayButton={hiddenPlayButton}
             hiddenTimeline={hiddenTimeline}
             hiddenTime={hiddenTime}
```

**File**: `packages/griffith/src/utils/pip.ts` (modified, +1/-1)
```diff
@@ -62,4 +62,4 @@ class Pip {
   }
 }
 
-export default new Pip()
+export default Pip
```

---

### Incident Patch 3: `c6dabf32` (2022-09-26)
**Commit Message**: fix: no defaultQuality in qualities

**File**: `packages/griffith/src/contexts/VideoSourceProvider.tsx` (modified, +3/-1)
```diff
@@ -52,7 +52,9 @@ const VideoSourceProvider: React.FC<VideoSourceProviderProps> = ({
   }, [useAutoQuality, lastSourceMap])
 
   const [currentQuality, setCurrentQualityRaw] = useState(
-    defaultQuality || qualities[0]
+    defaultQuality && (qualities as Quality[]).indexOf(defaultQuality) !== -1
+      ? defaultQuality
+      : qualities[0]
   )
   const [playbackRate, setPlaybackRate] = useState(defaultPlaybackRate)
 
```

---

### Incident Patch 4: `d9070aab` (2022-08-03)
**Commit Message**: fix: fix the hotkey tooltip of pip (#278)

**File**: `packages/griffith/src/components/items/PipButtonItem.tsx` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ const PipButtonItem: React.FC<{
 }> = ({isPip, onClick}) => (
   <ControllerTooltip
     localeKey={isPip ? 'action-exit-pip' : 'action-enter-pip'}
-    hotkey="h"
+    hotkey="p"
   >
     <ControllerButton
       icon={isPip ? icons.exitPip : icons.pip}
```

---

### Incident Patch 5: `b58fcc18` (2022-05-18)
**Commit Message**: fix: Failed switch hls video (#276)

* fix: Failed switch hls video

* Update VideoComponent.tsx

* fix: playing state

**File**: `packages/griffith-hls/src/VideoComponent.tsx` (modified, +2/-2)
```diff
@@ -42,13 +42,13 @@ export default class VideoComponent extends Component<VideoProps> {
   }
 
   componentDidUpdate(prevProps: VideoProps) {
-    const {currentQuality, sources, paused} = this.props
+    const {currentQuality, sources, paused, src} = this.props
 
     if (!this.hls) {
       return
     }
 
-    if (currentQuality !== prevProps.currentQuality) {
+    if (currentQuality !== prevProps.currentQuality || prevProps.src !== src) {
       // 切换清晰度
       const source = sources.find((s) => s.quality === currentQuality)
       if (source) {
```

**File**: `packages/griffith/src/components/Player.tsx` (modified, +6/-2)
```diff
@@ -484,9 +484,13 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
   const prevSources = usePrevious(sources)
   useEffect(() => {
     if (prevSources && prevSources !== sources) {
-      handleSeek(0)
+      handleSeek(0) //TODO: Event
+      handlePause()
+      if (autoplay) {
+        handlePlay()
+      }
     }
-  }, [handleSeek, prevSources, sources])
+  }, [autoplay, handlePlay, handleSeek, handlePause, prevSources, sources])
 
   const isPip = Boolean(Pip.pictureInPictureElement)
   // Safari 会将 pip 状态视为全屏
```

---

### Incident Patch 6: `14099bfc` (2022-04-20)
**Commit Message**: fix: 修复loading状态下不能暂停的问题

**File**: `packages/griffith/src/components/Player.tsx` (modified, +1/-4)
```diff
@@ -292,10 +292,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
 
   const handlePause = () => {
     emitEvent(EVENTS.REQUEST_PAUSE)
-
-    if (!isLoading || hideMobileControls) {
-      isPlayingSwitch.off()
-    }
+    isPlayingSwitch.off()
   }
 
   const handleVideoPlay = () => {
```

---

### Incident Patch 7: `76b44614` (2022-03-31)
**Commit Message**: fix: 修改document.body=null的情况

**File**: `packages/griffith/src/components/items/ControllerTooltip.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ type Props = {
 }
 
 const canUseTouch =
-  typeof document !== 'undefined' && 'ontouchstart' in document.body
+  typeof document !== 'undefined' && 'ontouchstart' in document.documentElement
 
 /**
  * ControllerButton
```

---

### Incident Patch 8: `301c660c` (2022-03-28)
**Commit Message**: fix: use fixed size for time numbers (#263)

**File**: `example/index.html` (modified, +5/-0)
```diff
@@ -5,6 +5,11 @@
     <meta http-equiv="X-UA-Compatible" content="IE=edge" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <title>Demo</title>
+    <style>
+      body {
+        font-family: -apple-system,BlinkMacSystemFont,Helvetica Neue,PingFang SC,Microsoft YaHei,Source Han Sans SC,Noto Sans CJK SC,WenQuanYi Micro Hei,sans-serif;
+      }
+    </style>
   </head>
   <body>
     <div id="app"></div>
```

**File**: `packages/griffith/src/components/Controller.styles.ts` (modified, +1/-0)
```diff
@@ -80,6 +80,7 @@ export default StyleSheet.create({
     fontSize: '0.875em',
     color: 'rgba(255, 255, 255, 0.9)',
     boxSizing: 'content-box',
+    fontVariantNumeric: 'tabular-nums',
   },
 
   labelButton: {
```

**File**: `packages/griffith/src/components/items/__tests__/__snapshots__/CombinedTimeItem.spec.tsx.snap` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 exports[`CombinedTimeItem get CombinedTimeItem component 1`] = `
 <div>
-  <div class="time_i860ms-o_O-fullScreenedTime_1xxtrer">00:06 / 03:02</div>
+  <div class="time_1n8zam0-o_O-fullScreenedTime_1xxtrer">00:06 / 03:02</div>
 </div>
 
 `;
```

---

### Incident Patch 9: `ec8c6619` (2022-03-09)
**Commit Message**: chore: fix hook deps

**File**: `packages/griffith/src/components/Player.tsx` (modified, +7/-8)
```diff
@@ -227,14 +227,6 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
     }
   }, [emitEvent, showController])
 
-  const preSources = usePrevious(sources)
-  useEffect(() => {
-    if (preSources && preSources !== sources) {
-      handleSeek(0)
-    }
-    // eslint-disable-next-line react-hooks/exhaustive-deps
-  }, [sources])
-
   // sync document title
   useEffect(() => {
     if (
@@ -491,6 +483,13 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
     onSeek: handleSeek,
   })
 
+  const prevSources = usePrevious(sources)
+  useEffect(() => {
+    if (prevSources && prevSources !== sources) {
+      handleSeek(0)
+    }
+  }, [handleSeek, prevSources, sources])
+
   const isPip = Boolean(Pip.pictureInPictureElement)
   // Safari 会将 pip 状态视为全屏
   const isFullScreen = Boolean(BigScreen.element) && !isPip
```

---

### Incident Patch 10: `9adcf32e` (2022-03-09)
**Commit Message**: fix: source change & handler error (#261)

**File**: `example/src/App.tsx` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ const NavLinks = () => {
         <li>
           <Link to="/mp4">/mp4</Link>
           <br />
+          <Link to="/mp4?sd">/mp4?sd</Link>
+          <br />
           <Link to="/mp4?logo">/mp4?logo</Link>
           <br />
           <Link to="/mp4?loop">/mp4?loop</Link>
```

**File**: `example/src/MP4Page.tsx` (modified, +5/-4)
```diff
@@ -12,7 +12,7 @@ import {sources as hlsSources} from './HLSPage'
 
 const duration = 182
 
-const sources = {
+const _sources = {
   hd: {
     bitrate: 2005,
     size: 46723282,
@@ -33,14 +33,14 @@ const sources = {
   },
 }
 
-const props: PlayerProps = {
+const props: Omit<PlayerProps, 'sources'> = {
   id: 'zhihu2018',
   standalone: true,
   title: '2018 我们如何与世界相处？',
   cover: 'https://zhstatic.zhihu.com/cfe/griffith/zhihu2018.jpg',
   duration,
-  sources,
   shouldObserveResize: true,
+  defaultQuality: 'hd',
 }
 
 const App = () => {
@@ -60,6 +60,7 @@ const App = () => {
     () => 'logo' in query && isLogoVisible && <Logo />,
     [isLogoVisible, query]
   )
+  const sources = 'sd' in query ? {sd: _sources.sd} : _sources
 
   return (
     <>
@@ -68,7 +69,7 @@ const App = () => {
         // trigger re-mount
         key={query.key}
         autoplay={query.autoplay !== '0'}
-        sources={'hls' in query ? hlsSources : props.sources}
+        sources={'hls' in query ? hlsSources : sources}
         localeConfig={{
           'zh-Hans': {
             'quality-ld': {
```

**File**: `packages/griffith/src/components/Player.tsx` (modified, +17/-8)
```diff
@@ -49,6 +49,7 @@ import useBoolean from '../hooks/useBoolean'
 import useMount from '../hooks/useMount'
 import useHandler from '../hooks/useHandler'
 import usePlayerShortcuts from './usePlayerShortcuts'
+import usePrevious from '../hooks/usePrevious'
 
 const CONTROLLER_HIDE_DELAY = 3000
 
@@ -141,7 +142,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
   layerContent,
 }) => {
   const {emitEvent, subscribeAction} = useContext(InternalMessageContext)
-  const {currentSrc} = useContext(VideoSourceContext)
+  const {currentSrc, sources} = useContext(VideoSourceContext)
   const [root, setRoot] = useState<HTMLDivElement | null>(null)
   const videoRef = useRef<{
     root: HTMLVideoElement
@@ -179,7 +180,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
     }
 
     const actionSubscriptions_ = [
-      subscribeAction(ACTIONS.PLAY, () => handlePlay()),
+      subscribeAction(ACTIONS.PLAY, handlePlay),
       subscribeAction(ACTIONS.PAUSE, handlePauseAction),
       subscribeAction(ACTIONS.TIME_UPDATE, ({currentTime}) =>
         handleSeek(currentTime)
@@ -226,6 +227,14 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
     }
   }, [emitEvent, showController])
 
+  const preSources = usePrevious(sources)
+  useEffect(() => {
+    if (preSources && preSources !== sources) {
+      handleSeek(0)
+    }
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [sources])
+
   // sync document title
   useEffect(() => {
     if (
@@ -249,13 +258,13 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
     }
   }, [disablePictureInPicture, emitEvent])
 
-  const handlePauseAction = ({dontApplyOnFullScreen}: any = {}) => {
+  const handlePauseAction = useHandler(({dontApplyOnFullScreen}: any = {}) => {
     if (!isPlaying) return
 
     if (dontApplyOnFullScreen && Boolean(BigScreen.element)) return
 
     handlePause()
-  }
+  })
 
   const handleClickToTogglePlay = () => {
     // 仅点击覆盖层触发提示（控制条上的按钮点击不需要）
@@ -265,7 +274,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
     handleTogglePlay()
   }
 
-  const handlePlay = () => {
+  const handlePlay = useHandler(() => {
     emitEvent(EVENTS.REQUEST_PLAY)
     Promise.resolve(onBeforePlay?.(currentSrc))
       .then(() => {
@@ -287,7 +296,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
         emitEvent(EVENTS.PLAY_REJECTED)
         // 播放被取消
       })
-  }
+  })
 
   const handlePause = () => {
     emitEvent(EVENTS.REQUEST_PAUSE)
@@ -401,7 +410,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
   const hideControllerTimerRef = useRef(
     null
   ) as React.MutableRefObject<ReturnType<typeof setTimeout> | null>
-  const handleShowController = () => {
+  const handleShowController = useHandler(() => {
     if (!isControllerShown) {
       isControllerShownSwitch.on()
     }
@@ -412,7 +421,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
       hideControllerTimerRef.current = null
       isControllerShownSwitch.off()
     }, CONTROLLER_HIDE_DELAY)
-  }
+  })
 
   const handleHideController = () => {
     if (hideControllerTimerRef.current !== null) {
```

---

### Incident Patch 11: `d08ba7a1` (2022-02-07)
**Commit Message**: fix: do not process shortcut when event is default prevented

**File**: `packages/griffith/src/components/Slider.tsx` (modified, +12/-9)
```diff
@@ -171,20 +171,23 @@ class Slider extends Component<SliderProps, State> {
     const {reverse, value, total, step} = this.props
 
     let direction = 0
+    let handled = false
     if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
+      handled = true
       direction = -1
-    }
-    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
+    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
+      handled = true
       direction = 1
     }
-    if (reverse) {
-      direction = -direction
-    }
-
-    const result = clamp(value! + step! * direction, 0, total!)
-    if (result !== value) {
+    if (handled) {
       event.preventDefault()
-      this.handleChange(result)
+      if (reverse) {
+        direction = -direction
+      }
+      const result = clamp(value! + step! * direction, 0, total!)
+      if (result !== value) {
+        this.handleChange(result)
+      }
     }
   }
 
```

**File**: `packages/griffith/src/components/usePlayerShortcuts.ts` (modified, +24/-13)
```diff
@@ -76,6 +76,11 @@ const usePlayerShortcuts = ({
   })
 
   const handleKeyDown = useHandler((event: KeyboardEvent) => {
+    // 防止事件已经在别处被处理过（如 Slider 中）
+    if (event.defaultPrevented) {
+      return
+    }
+
     // 防止冲突，有修饰键按下时不触发自定义热键
     if (event.altKey || event.ctrlKey || event.metaKey) {
       return
@@ -105,6 +110,7 @@ const usePlayerShortcuts = ({
           onTogglePageFullScreen()
         }
         break
+
       case 'ArrowLeft':
         handleSeek(currentTime - 5)
         break
@@ -113,6 +119,15 @@ const usePlayerShortcuts = ({
         handleSeek(currentTime + 5)
         break
 
+      case 'ArrowUp':
+        // 可能静音状态调整时不切换为非静音会更好（设置临时状态，恢复音量时应用临时状态）
+        handleVolumeChange(volume + 0.05, true)
+        break
+
+      case 'ArrowDown':
+        handleVolumeChange(volume - 0.05, true)
+        break
+
       case 'j':
       case 'J':
         handleSeek(currentTime - 10)
@@ -140,15 +155,6 @@ const usePlayerShortcuts = ({
         handleVolumeChange(volume ? 0 : prevVolumeRef.current, true)
         break
 
-      case 'ArrowUp':
-        // 静音状态下调整可能不切换为非静音更好（设置一成临时的，切换后再应用临时状态）
-        handleVolumeChange(volume + 0.05, true)
-        break
-
-      case 'ArrowDown':
-        handleVolumeChange(volume - 0.05, true)
-        break
-
       case '<':
         rotatePlaybackRate('prev')
         break
@@ -167,11 +173,16 @@ const usePlayerShortcuts = ({
   })
 
   useEffect(() => {
-    const el = standalone ? document.body : root
-    if (el) {
-      el.addEventListener('keydown', handleKeyDown)
+    // 对于 React 16，需要使用 document 来处理冒泡（17 之后任何上层元素都能正常冒泡）
+    if (standalone) {
+      document.addEventListener('keydown', handleKeyDown)
+      return () => {
+        document.removeEventListener('keydown', handleKeyDown)
+      }
+    } else if (root) {
+      root.addEventListener('keydown', handleKeyDown)
       return () => {
-        el.removeEventListener('keydown', handleKeyDown)
+        root.removeEventListener('keydown', handleKeyDown)
       }
     }
   }, [handleKeyDown, root, standalone])
```

---

### Incident Patch 12: `f68c1ac3` (2022-02-08)
**Commit Message**: fix: use smooth progress transition

**File**: `packages/griffith/src/components/Slider.tsx` (modified, +37/-14)
```diff
@@ -3,7 +3,6 @@ import {css, StyleDeclarationMap} from 'aphrodite/no-important'
 import clamp from 'lodash/clamp'
 import {ProgressDot as ProgressDotType} from '../types'
 import ProgressDot, {ProgressDotsProps} from './ProgressDot'
-import formatPercent from '../utils/formatPercent'
 
 import styles, {
   horizontal as horizontalStyles,
@@ -40,6 +39,11 @@ type State = {
   slidingValue: null | number
 }
 
+const getRatio = (value: number, total?: number) =>
+  total ? clamp(value / total, 0, 1) : 0
+
+const toPercentage = (value: number) => `${value * 100}%`
+
 export type SliderProps = OwnProps //& typeof Slider.defaultProps
 
 class Slider extends Component<SliderProps, State> {
@@ -109,15 +113,38 @@ class Slider extends Component<SliderProps, State> {
     return orientation === 'horizontal' ? 'width' : 'height'
   }
 
-  getPercentage() {
+  getPercentageValue() {
     const {value, total} = this.props
     const {isSlideActive, slidingValue} = this.state
-    return formatPercent(isSlideActive ? slidingValue! : value!, total)
+    return getRatio(isSlideActive ? slidingValue! : value!, total)
+  }
+
+  getProgressStyle(value: number) {
+    const {orientation} = this.props
+    const scaleAxis = orientation === 'horizontal' ? 'scaleX' : 'scaleY'
+    return {
+      [this.getSizeKey()]: '100%',
+      transform: `${scaleAxis}(${value})`,
+      transformOrigin: this.getAlignKey(),
+    }
+  }
+
+  getProgressThumbStyle(value: number) {
+    const {orientation} = this.props
+    const horizontal = orientation === 'horizontal'
+    const translateAxis = horizontal ? 'translateX' : 'translateY'
+    return {
+      [this.getSizeKey()]: '100%',
+      transform: `${translateAxis}(${toPercentage(
+        horizontal ? value : 1 - value
+      )})`,
+      transformOrigin: this.getAlignKey(),
+    }
   }
 
-  getBufferedPercentage() {
+  getBufferedPercentageValue() {
     const {buffered, total} = this.props
-    return formatPercent(buffered!, total)
+    return getRatio(buffered!, total)
   }
 
   getSlidingValue(event: globalThis.MouseEvent) {
@@ -239,6 +266,7 @@ class Slider extends Component<SliderProps, State> {
           onKeyDown: this.handleKeyDown,
           onMouseDown: this.handleDragStart,
         }
+    const ratio = this.getPercentageValue()
     return (
       <div
         className={this.getClassName('root')}
@@ -250,18 +278,12 @@ class Slider extends Component<SliderProps, State> {
             {Boolean(buffered) && (
               <div
                 className={this.getClassName('bar', 'buffered')}
-                style={{
-                  [this.getAlignKey()]: 0,
-                  [this.getSizeKey()]: this.getBufferedPercentage(),
-                }}
+                style={this.getProgressStyle(this.getBufferedPercentageValue())}
               />
             )}
             <div
               className={this.getClassName('bar')}
-              style={{
-                [this.getAlignKey()]: 0,
-                [this.getSizeKey()]: this.getPercentage(),
-              }}
+              style={this.getProgressStyle(ratio)}
             />
             {Boolean(progressDots?.length) && (
               <ProgressDot
@@ -273,9 +295,10 @@ class Slider extends Component<SliderProps, State> {
             )}
           </div>
           {!noInteraction && (
+            // the position indicator (visible when hovering)
             <div
               className={this.getClassName('thumbWrapper')}
-              style={{[this.getAlignKey()]: this.getPercentage()}}
+              style={this.getProgressThumbStyle(ratio)}
             >
               <div
                 className={this.getClassName(
```

**File**: `packages/griffith/src/components/Video.tsx` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ class Video extends Component<VideoProps> {
   }
 
   // NOTE: 原生 `timeupdate` 事件更新频率不固定（4Hz~66Hz，由系统决定），这里以 rAF 提高了 UI 更新频率
-  // 但进度条更新仍然是不平滑的，需要考虑使用进度动画（TODO）
+  // TODO: 考虑使用回调直接操作 DOM，减少 React rendering
   notifyTimeUpdate = (isRaf: boolean) => {
     const {onCurrentTimeUpdate, paused} = this.props
 
```

**File**: `packages/griffith/src/components/__tests__/__snapshots__/MinimalTimeline.spec.tsx.snap` (modified, +6/-2)
```diff
@@ -14,7 +14,7 @@ exports[`MinimalTimeline get MinimalTimeline component 1`] = `
       >
         <div
           class="bar_1kpj1ed-o_O-bar_g2nzkb-o_O-bar_1kvrquw"
-          style="left: 0px; width: 0%"
+          style="width: 100%; transform: scaleX(0); transform-origin: left"
         ></div>
       </div>
     </div>
@@ -37,7 +37,11 @@ exports[`MinimalTimeline get MinimalTimeline component 2`] = `
       >
         <div
           class="bar_1kpj1ed-o_O-bar_g2nzkb-o_O-bar_1kvrquw"
-          style="left: 0px; width: 32.92470120833653%"
+          style="
+            width: 100%;
+            transform: scaleX(0.3292470120833653);
+            transform-origin: left;
+          "
         ></div>
       </div>
     </div>
```

**File**: `packages/griffith/src/components/__tests__/__snapshots__/VolumeSlide.spec.tsx.snap` (modified, +6/-3)
```diff
@@ -21,8 +21,9 @@ exports[`VolumeSlider get VolumeSlider component 1`] = `
           className="bar_1kpj1ed-o_O-bar_1ql2ook"
           style={
             Object {
-              "bottom": 0,
-              "height": "50%",
+              "height": "100%",
+              "transform": "scaleY(0.5)",
+              "transformOrigin": "bottom",
             }
           }
         />
@@ -31,7 +32,9 @@ exports[`VolumeSlider get VolumeSlider component 1`] = `
         className="thumbWrapper_ay4wjb-o_O-thumbWrapper_drkmbm"
         style={
           Object {
-            "bottom": "50%",
+            "height": "100%",
+            "transform": "translateY(50%)",
+            "transformOrigin": "bottom",
           }
         }
       >
```

**File**: `packages/griffith/src/components/items/__tests__/__snapshots__/TimelineItem.spec.tsx.snap` (modified, +15/-3)
```diff
@@ -15,16 +15,28 @@ exports[`TimelineItem get TimelineItem component 1`] = `
               class="
                 bar_1kpj1ed-o_O-bar_g2nzkb-o_O-bar_1kvrquw-o_O-buffered_gsgvhl
               "
-              style="left: 0px; width: 6.417112299465241%"
+              style="
+                width: 100%;
+                transform: scaleX(0.06417112299465241);
+                transform-origin: left;
+              "
             ></div>
             <div
               class="bar_1kpj1ed-o_O-bar_g2nzkb-o_O-bar_1kvrquw"
-              style="left: 0px; width: 3.7433155080213902%"
+              style="
+                width: 100%;
+                transform: scaleX(0.0374331550802139);
+                transform-origin: left;
+              "
             ></div>
           </div>
           <div
             class="thumbWrapper_ay4wjb-o_O-thumbWrapper_6t4rjm"
-            style="left: 3.7433155080213902%"
+            style="
+              width: 100%;
+              transform: translateX(3.7433155080213902%);
+              transform-origin: left;
+            "
           >
             <div class="thumb_ozdqky-o_O-thumb_1omjhz8"></div>
           </div>
```

**File**: `packages/griffith/src/components/items/__tests__/__snapshots__/VolumeItem.spec.tsx.snap` (modified, +10/-2)
```diff
@@ -22,12 +22,20 @@ exports[`VolumeItem get VolumeItem component 1`] = `
             <div class="track_1bopucd-o_O-track_31rx9n-o_O-track_ytl6g2">
               <div
                 class="bar_1kpj1ed-o_O-bar_1ql2ook"
-                style="bottom: 0px; height: 90%"
+                style="
+                  height: 100%;
+                  transform: scaleY(0.9);
+                  transform-origin: bottom;
+                "
               ></div>
             </div>
             <div
               class="thumbWrapper_ay4wjb-o_O-thumbWrapper_drkmbm"
-              style="bottom: 90%"
+              style="
+                height: 100%;
+                transform: translateY(9.999999999999998%);
+                transform-origin: bottom;
+              "
             >
               <div class="thumb_ozdqky-o_O-thumb_8gf5gg"></div>
             </div>
```

---

### Incident Patch 13: `87faf575` (2022-02-07)
**Commit Message**: fix: do not process shortcut in input fields

**File**: `packages/griffith/src/components/usePlayerShortcuts.ts` (modified, +7/-0)
```diff
@@ -22,6 +22,9 @@ type Options = {
   onSeek: (currentTime: number) => void
 }
 
+const isInput = (el: HTMLElement) =>
+  /^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable
+
 const usePlayerShortcuts = ({
   root,
   prevVolumeRef,
@@ -75,6 +78,10 @@ const usePlayerShortcuts = ({
       return
     }
 
+    if (event.target && isInput(event.target as HTMLElement)) {
+      return
+    }
+
     let handled = true
     switch (event.key) {
       case ' ':
```

---

### Incident Patch 14: `be5f5563` (2022-01-29)
**Commit Message**: fix: remove `Enter` shortcut

**File**: `packages/griffith/src/components/usePlayerShortcuts.ts` (modified, +0/-1)
```diff
@@ -86,7 +86,6 @@ const usePlayerShortcuts = ({
         onTogglePlay()
         break
 
-      case 'Enter':
       case 'f':
       case 'F':
         onToggleFullScreen()
```

---

### Incident Patch 15: `d7a69249` (2022-01-29)
**Commit Message**: fix: add isIE in ua

#18 #158

**File**: `packages/griffith-utils/src/__tests__/ua.spec.ts` (modified, +25/-9)
```diff
@@ -2,14 +2,30 @@
  * @jest-environment jsdom
  */
 
+import ua, {parseUA} from '../ua'
+
 test('ua', () => {
-  Object.defineProperty(window.navigator, 'userAgent', {
-    value:
-      'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Mobile Safari/537.36',
-  })
-  // eslint-disable-next-line @typescript-eslint/no-var-requires
-  const {isMobile, isAndroid, isSafari} = require('../ua')
-  expect(isMobile).toBe(true)
-  expect(isAndroid).toBe(true)
-  expect(isSafari).toBe(false)
+  expect(ua).toMatchInlineSnapshot(`
+    Object {
+      "isAndroid": false,
+      "isIE": false,
+      "isMobile": false,
+      "isSafari": false,
+    }
+  `)
+})
+
+test('parse', () => {
+  expect(
+    parseUA(
+      'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Mobile Safari/537.36'
+    )
+  ).toMatchInlineSnapshot(`
+    Object {
+      "isAndroid": true,
+      "isIE": false,
+      "isMobile": true,
+      "isSafari": false,
+    }
+  `)
 })
```

**File**: `packages/griffith-utils/src/ua.ts` (modified, +11/-11)
```diff
@@ -1,13 +1,13 @@
-export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
-
-export const isAndroid = /(android)/i.test(navigator.userAgent)
+export function parseUA(userAgent: string) {
+  return {
+    isIE: /MSIE|Trident/i.test(userAgent),
+    isMobile: /iPhone|iPad|iPod|Android/i.test(userAgent),
+    isAndroid: /(android)/i.test(userAgent),
+    isSafari: /^((?!chrome|android).)*safari/i.test(userAgent),
+  }
+}
 
-export const isSafari = /^((?!chrome|android).)*safari/i.test(
-  navigator.userAgent
+export default parseUA(
+  // TODO: 加一个 context 让各处访问更好
+  typeof navigator !== 'undefined' ? navigator.userAgent : ''
 )
-
-export default {
-  isMobile,
-  isAndroid,
-  isSafari,
-}
```

**File**: `packages/griffith/src/components/Player.tsx` (modified, +4/-5)
```diff
@@ -49,7 +49,6 @@ import useMount from '../hooks/useMount'
 import useHandler from '../hooks/useHandler'
 import usePlayerShortcuts from './usePlayerShortcuts'
 const CONTROLLER_HIDE_DELAY = 3000
-const {isMobile} = ua
 
 // 被 Provider 包装后的属性
 type InnerPlayerProps = {
@@ -273,7 +272,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
             isLoadingSwitch.on()
           }
           // workaround a bug in IE about replaying a video.
-          if (currentTime !== 0) {
+          if (ua.isIE && currentTime !== 0) {
             handleSeek(0)
           }
         }
@@ -488,7 +487,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
   const videoDataLoaded = !isLoading || currentTime !== 0
   const renderController = videoDataLoaded && isPlaybackStarted
 
-  const controlsOverlay = !isMobile && (
+  const controlsOverlay = !ua.isMobile && (
     <div className={css(styles.overlay, isNeverPlayed && styles.overlayMask)}>
       {isPlaybackStarted && isLoading && (
         <div className={css(styles.loader)}>
@@ -609,7 +608,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
       <div className={css(styles.video)}>
         <Video
           ref={videoRef}
-          controls={isMobile && isPlaybackStarted && !hideMobileControls}
+          controls={ua.isMobile && isPlaybackStarted && !hideMobileControls}
           paused={!isPlaying}
           volume={volume}
           loop={loop}
@@ -655,7 +654,7 @@ const InnerPlayer: React.FC<InnerPlayerProps> = ({
             <div
               className={css(
                 styles.coverTime,
-                isMobile && styles.coverTimeMobile
+                ua.isMobile && styles.coverTimeMobile
               )}
             >
               {formatDuration(duration)}
```

**File**: `packages/griffith/src/utils/parseUA.ts` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+export default function parseUA(userAgent: string) {
+  return {
+    isIE: /MSIE|Trident/i.test(userAgent),
+    isMobile: /iPhone|iPad|iPod|Android/i.test(userAgent),
+    isAndroid: /(android)/i.test(userAgent),
+    isSafari: /^((?!chrome|android).)*safari/i.test(userAgent),
+  }
+}
```

#### Recent Merged Pull Requests:
- **PR #309** (2026-06-15): feat(griffith): support customPlayer, customHeaders and cover-loaded play gate (@TungHuan)
- **PR #308** (2025-05-20): fix: does not render 0 when duration and current time both are 0 (@zidian257)
- **PR #306** (2024-03-18): feat: upgrade Rollup to v4, TypeScript to v5 (@ambar)
- **PR #305** (2024-03-18): feat: 透传 video 标签 crossorigin (@xia5517)
- **PR #299** (2023-03-27): chore: add video size for events payload (@YuJianghao)
- **PR #290** (2022-10-20): chore: export LocaleProvider (@wlw620)
- **PR #289** (closed): chore: export LocaleContext context (@wlw620)
- **PR #286** (2022-10-13): feat: enableCrossWindowMessage split away from standalone (@xia5517)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
