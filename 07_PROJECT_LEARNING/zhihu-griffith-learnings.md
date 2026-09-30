# Forensic Learning Record (Deep Inspection): zhihu/griffith

> **Canonical Artifact**: `07_PROJECT_LEARNING/zhihu-griffith-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zhihu/griffith](https://github.com/zhihu/griffith))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:39:11.116Z  
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

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  // https://eslint.org/docs/user-guide/configuring#specifying-parser-options
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module',
    ecmaFeatures: {
      // Supports JSX syntax (not the same as supporting React).
      jsx: true,
    },
  },

  // commonly used envs
  env: {
    browser: true,
    node: true,
    es6: true,
    jest: true,
  },

  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['**/tsconfig.json'],
      },
      extends: [
        'plugin:import/typescript',
        // https://www.npmjs.com/package/@typescript-eslint/eslint-plugin
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        // NOTE: To override other configs, Prettier must be the last extension
        'plugin:prettier/recommended',
      ],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],

  // we use recommended configurations
  extends: [
    // https://eslint.org/docs/rules/
    'eslint:recommended',
    // https://github.com/yannickcr/eslint-plugin-react
    'plugin:react/recommended',
    // https://www.npmjs.com/package/eslint-plugin-react-hooks
    'plugin:react-hooks/recommended',
    // https://github.com/benmosher/eslint-plugin-import
    'plugin:import/recommended',
    // NOTE: To override other configs, Prettier must be the last extension
    // https://github.com/prettier/eslint-plugin-prettier
    'plugin:prettier/recommended',
  ],

  plugins: ['react-hooks', '@typescript-eslint'],

  rules: {
    // disable nice-to-have rules for migrate convenience
    'react/prop-types': 'off',
    'react/no-find-dom-node': 'off',
    'react/display-name': 'off',

    // recommended rules
    'prefer-const': 'error',
    'no-var': 'error',

    // hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
  },

  settings: {
    // https://github.com/yannickcr/eslint-plugin-react#configuration
    react: {
      version: '16',
    },
  },
}

```

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  bracketSpacing: false,
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
}

```

### Core Architecture Module: `example/src/App.tsx`
```
import React from 'react'
import {BrowserRouter as Router, Link, Route, Routes} from 'react-router-dom'
import FMP4Page from './FMP4Page'
import HLSPage from './HLSPage'
import IframePage from './IframePage'
import InlinePage from './InlinePage'
import MP4Page from './MP4Page'

const nonav = new URLSearchParams(location.search).has('nonav')

const NavLinks = () => {
  return (
    <nav>
      <ul>
        <li>
          <Link to="/mp4">/mp4</Link>
          <br />
          <Link to="/mp4?sd">/mp4?sd</Link>
          <br />
          <Link to="/mp4?logo">/mp4?logo</Link>
          <br />
          <Link to="/mp4?loop">/mp4?loop</Link>
          <br />
          <Link to="/mp4?hls">/mp4?hls</Link>
          <br />
          <Link to="/mp4?key=0&autoplay=0">/mp4?key=0&autoplay=0</Link>
        </li>
        <li>
          <Link to="/mp4-mse">/mp4-mse</Link>
        </li>
        <li>
          <Link to="/hls">/hls</Link>
          <br />
          <Link to="/hls?autoplay">/hls?autoplay</Link>
        </li>
        <li>
          <Link to="/inline">inline</Link>
        </li>
        <li>
          <Link to="/iframe">iframe</Link>
        </li>
      </ul>
    </nav>
  )
}

function App() {
  return (
    <Router>
      {!nonav && <NavLinks />}

      <Routes>
        <Route path="/mp4" element={<MP4Page />} />
        <Route path="/mp4-mse" element={<FMP4Page />} />
        <Route path="/hls" element={<HLSPage />} />
        <Route path="/inline" element={<InlinePage />} />
        <Route path="/iframe" element={<IframePage />} />
      </Routes>
    </Router>
  )
}

export default App

```

### Core Architecture Module: `example/src/FMP4Page.tsx`
```
import Player, {PlayerProps} from 'griffith'
import React from 'react'
import {logEvent} from './utils'

const duration = 182

const sources = {
  hd: {
    bitrate: 2005,
    size: 46723282,
    duration,
    format: 'mp4',
    width: 1280,
    height: 720,
    play_url: 'https://zhstatic.zhihu.com/cfe/griffith/zhihu2018_hd.mp4',
  },
  sd: {
    bitrate: 900.49,
    size: 20633151,
    duration,
    format: 'mp4',
    width: 320,
    height: 240,
    play_url: 'https://zhstatic.zhihu.com/cfe/griffith/zhihu2018_sd.mp4',
  },
}

const props: PlayerProps = {
  id: 'zhihu2018',
  standalone: true,
  title: '2018 我们如何与世界相处？',
  cover: 'https://zhstatic.zhihu.com/cfe/griffith/zhihu2018.jpg',
  duration,
  sources,
  shouldObserveResize: true,
  useMSE: true,
  // FIXME: 有无 autoplay 都有 bug
  autoplay: true,
  onEvent: logEvent,
}

const App = () => <Player {...props} />
export default App

```

### Core Architecture Module: `example/src/HLSPage.tsx`
```
import Player, {PlayerProps} from 'griffith'
import React from 'react'
import {logEvent} from './utils'
import {useSearchParams} from 'react-router-dom'

export const sources = {
  // 注意，这里手动提供了 auto 品质的 source，因此会无视 useAutoQuality 的配置
  auto: {
    format: 'm3u8',
    play_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  sd: {
    format: 'm3u8',
    play_url:
      'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8',
  },
}

const props: PlayerProps = {
  id: 'test-hls-video',
  title: 'Test HLS Video',
  standalone: true,
  cover: 'https://zhstatic.zhihu.com/cfe/griffith/player.png',
  sources,
  shouldObserveResize: true,
  hiddenTimeline: true,
  hiddenTime: true,
  onEvent: logEvent,
}

const App = () => {
  const [searchParams] = useSearchParams()
  const autoplay = searchParams.has('autoplay')

  return (
    <Player
      {...props}
      // FIXME: 无 autoplay 播放中正常，https://github.com/zhihu/griffith/issues/231
      autoplay={autoplay}
      // Player 没有响应 autoplay
      key={String(autoplay)}
    />
  )
}

export default App

```

### Core Architecture Module: `example/src/IframePage.tsx`
```
import React, {useCallback, useEffect, useRef, useState} from 'react'
import {EVENTS, ACTIONS, createMessageHelper} from 'griffith-message'

export default function IframePage(): JSX.Element {
  const [iframeRefs] = useState(() =>
    [...Array(4).keys()].map(() => React.createRef<HTMLIFrameElement>())
  )
  const timeInputRef = useRef<HTMLInputElement>(null)
  const helperRef = useRef<ReturnType<typeof createMessageHelper>>()

  useEffect(() => {
    helperRef.current = createMessageHelper()

    function pauseAllOtherVideos(source: MessageEventSource) {
      iframeRefs
        .map((ref) => ref.current!.contentWindow!)
        .filter((w) => w !== source)
        .forEach((w) => helperRef.current!.dispatchMessage(w, ACTIONS.PAUSE))
    }

    helperRef.current.subscribeMessage(EVENTS.PLAY, (data, source) => {
      pauseAllOtherVideos(source!)
    })

    return () => {
      helperRef.current?.dispose()
    }
  }, [iframeRefs])

  const getFirstWindow = useCallback(
    () => iframeRefs[0].current!.contentWindow!,
    [iframeRefs]
  )

  return (
    <>
      <p>本页面可以测试播放器在 iframe 中的效果，还可以测试跨窗口消息接口</p>
      <div>
        {iframeRefs.map((ref, i) => (
          <iframe
            ref={ref}
            key={i}
            src="/mp4?nonav"
            allowFullScreen
            frameBorder="0"
          />
        ))}
      </div>
      <section>
        <h2>场景演示</h2>
        <button
          onClick={() => {
            helperRef.current!.dispatchMessage(getFirstWindow(), ACTIONS.PAUSE)
          }}
        >
          暂停第一个视频
        </button>
        <button
          onClick={() => {
            helperRef.current!.dispatchMessage(getFirstWindow(), ACTIONS.PLAY)
          }}
        >
          播放第一个视频（暂停其他视频）
        </button>
        <div>
          <input ref={timeInputRef} />
          <button
            onClick={() => {
              const currentTime = Number(timeInputRef.current!.value)
              helperRef.current!.dispatchMessage(
                getFirstWindow(),
                ACTIONS.TIME_UPDATE,
                {currentTime}
              )
            }}
          >
            手动 seek 第一个视频
          </button>
        </div>
        <button
          onClick={() => {
            helperRef.current!.dispatchMessage(
              getFirstWindow(),
              ACTIONS.SHOW_CONTROLLER
            )
          }}
        >
          让第一个视频显示进度条
        </button>
        <button
          onClick={() => {
            helperRef.current!.dispatchMessage(
              getFirstWindow(),
              ACTIONS.SET_VOLUME,
              {volume: 0}
            )
          }}
        >
          让第一个视频静音
        </button>
      </section>
    </>
  )
}

```

### Core Architecture Module: `example/src/InlinePage.tsx`
```
import React from 'react'
import Player, {Layer} from 'griffith'
import {logEvent} from './utils'

const watermarkStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.5)',
  color: 'white',
  borderRadius: '5px',
  margin: '5px',
  padding: '5px',
  display: 'inline-block',
}

const VideoCard = ({
  data,
  height = 'auto',
  objectFit,
}: Partial<{data: any; height: number | string; objectFit: string}>) => (
  <div
    className="VideoCard"
    style={{height, width: '320px', margin: '20px auto'}}
  >
    <Player {...data} initialObjectFit={objectFit} onEvent={logEvent}>
      <Layer>
        <span style={watermarkStyle}>水印示例</span>
      </Layer>
    </Player>
  </div>
)

class App extends React.Component {
  render() {
    const duration = 182

    const sources = {
      hd: {
        bitrate: 2005,
        size: 46723282,
        duration,
        format: 'fmp4',
        width: 1280,
        height: 720,
        play_url: 'https://zhstatic.zhihu.com/cfe/griffith/zhihu2018_hd.mp4',
      },
      sd: {
        bitrate: 900.49,
        size: 20633151,
        duration,
        format: 'fmp4',
        width: 848,
        height: 478,
        play_url: 'https://zhstatic.zhihu.com/cfe/griffith/zhihu2018_sd.mp4',
      },
    }

    const data = {
      id: 'zhihu2018',
      title: '2018 我们如何与世界相处？',
      cover: 'https://zhstatic.zhihu.com/cfe/griffith/zhihu2018.jpg',
      duration,
      sources,
      src: 'https://zhstatic.zhihu.com/cfe/griffith/zhihu2018_sd.mp4',
    }

    return (
      <div style={{maxWidth: 600, margin: '0 auto'}}>
        <h1>行内视频示例</h1>
        <p>视频原始比例为 16:9</p>
        <p>暂时只支持 contain 和 cover 两种情况</p>
        <hr />
        <section>
          <h2>正方形播放器</h2>
          <h3>object-fit: contain (default)</h3>
          <p>预期：视频上下黑边；水印相对视频画面定位</p>
          <VideoCard data={data} height={320} />
          <h3>object-fit: cover</h3>
          <p>预期：视频左右裁切；水印相对播放器定位</p>
          <VideoCard data={data} height={320} objectFit="cover" />
        </section>
        <hr />
        <section>
          <h2>2:1 播放器</h2>
          <h3>object-fit: contain (default) </h3>
          <p>预期：视频左右黑边；水印相对视频画面定位</p>
          <VideoCard data={data} height={160} />
          <h3>object-fit: cover</h3>
          <p>预期：视频上下裁切；水印相对播放器定位</p>
          <VideoCard data={data} height={160} objectFit="cover" />
        </section>
        <hr />
        <section>
          <h2>不指定高度</h2>
          <p>预期：高度自适应</p>
          <VideoCard data={data} />
        </section>
      </div>
    )
  }
}

export default App

```

### Core Architecture Module: `example/src/Logo.tsx`
```
import React from 'react'
import {StyleSheet, css} from 'aphrodite/no-important'

const styles = StyleSheet.create({
  logo: {
    width: '20%',
    position: 'absolute',
    top: '3%',
    right: '4%',
  },
})

const LOGO_SRC = 'http://zhstatic.zhihu.com/assets/zhihu/web-logo@2x.png'

function Logo() {
  return <img className={css(styles.logo)} src={LOGO_SRC} />
}

export default Logo

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
