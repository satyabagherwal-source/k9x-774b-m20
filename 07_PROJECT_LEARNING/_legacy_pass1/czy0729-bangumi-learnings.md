# Forensic Learning Record (Deep Inspection): czy0729/Bangumi

> **Canonical Artifact**: `07_PROJECT_LEARNING/czy0729-bangumi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/czy0729/Bangumi](https://github.com/czy0729/Bangumi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:19:48.892Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `czy0729/Bangumi`
- **Description**: :electron: An unofficial https://bgm.tv ui first app client for Android and iOS, built with React Native. 一个无广告、以爱好为驱动、不以盈利为目的、专门做 ACG 的类似豆瓣的追番记录，bgm.tv 第三方客户端。为移动端重新设计，内置大量加强的网页端难以实现的功能，且提供了相当的自定义选项。 目前已适配 iOS / Android。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json
- **Stars / Engagement**: 6000 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
/*
 * @Author: czy0729
 * @Date: 2019-03-13 05:15:36
 * @Last Modified by: czy0729
 * @Last Modified time: 2026-08-08 10:17:54
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'react-hooks', 'prettier', 'bangumi'],
  ignorePatterns: [
    '/components/@/*',
    '/eslint-rules',
    '/ext',
    '/node_modules',
    '/src/utils/thirdParty/*',
    '/workers/*',
    'babel.config.js',
    'jsconfig.json'
  ],
  globals: {
    JSX: true,
    Proxy: true,
    React: true,
    Response: true,
    URL: true,
    XMLHttpRequest: true,
    __DEV__: true,
    clearInterval: true,
    clearTimeout: true,
    console: true,
    fetch: true,
    global: true,
    globalThis: true,
    log: true,
    performance: true,
    process: true,
    requestAnimationFrame: true,
    require: true,
    rerender: true,
    setInterval: true,
    setTimeout: true,
    warn: true,
    window: true
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      env: {
        jest: true,
        node: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-unsafe-argument': 0,
        '@typescript-eslint/no-unsafe-assignment': 0,
        '@typescript-eslint/no-unsafe-call': 0,
        '@typescript-eslint/no-unsafe-member-access': 0,
        '@typescript-eslint/no-unsafe-return': 0
      }
    }
  ],
  rules: {
    /** 禁止显式使用 any 类型 */
    '@typescript-eslint/no-explicit-any': 'warn',

    /** 禁止 any 类型赋值 */
    '@typescript-eslint/no-unsafe-assignment': 'warn',

    /** 禁止访问 any 类型的成员 */
    '@typescript-eslint/no-unsafe-member-access': 'warn',

    /** 禁止调用 any 类型 */
    '@typescript-eslint/no-unsafe-call': 'warn',

    /** 禁止返回 any 类型 */
    '@typescript-eslint/no-unsafe-return': 'warn',

    /** 禁止将 any 作为参数传递 */
    '@typescript-eslint/no-unsafe-argument': 'warn',

    /** 要求函数参数有类型注解 */
    '@typescript-eslint/typedef': [
      'warn',
      {
        parameter: true
      }
    ],

    /** 允许变量与外部作用域同名 */
    '@typescript-eslint/no-shadow': 0,

    /** 禁止未使用的变量 */
    '@typescript-eslint/no-unused-vars': [
      2,
      {
        ignoreRestSiblings: true,
        caughtErrors: 'none',

        /** factory 实例仅用于 typeof 导出类型（如 const f = factory(Store)） */
        varsIgnorePattern: '^f$'
      }
    ],

    /** 强制类型使用 import type */
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
        fixStyle: 'inline-type-imports'
      }
    ],

    /** 单行最大长度 200 */
    'max-len': ['error', 200],

    /** 允许相同变量名 */
    'no-shadow': 0,

    /** 禁止 console，警告级别 */
    'no-console': ['warn'],

    /** 优先使用 const */
    'prefer-const': [
      'error',
      {
        ignoreReadBeforeAssign: true
      }
    ],

    /** 允许在 didMount 中 setState */
    'react/no-did-mount-set-state': 0,

    /** 允许嵌套组件 */
    'react/no-unstable-nested-components': 0,

    /** 允许使用 == */
    eqeqeq: 0,

    /** parseInt 允许不填进制 */
    radix: 0,

    /** 设置最大嵌套深度 */
    'max-depth': ['warn', 5],

    /** useEffect 依赖检查 */
    'react-hooks/exhaustive-deps': 'warn',

    /** memoStyles 中要求使用 computed */
    'bangumi/require-computed-in-memo-styles': 'warn',

    /** create 中禁止使用 computed */
    'bangumi/forbid-computed-in-create': 'warn',

    /** 禁止未使用的样式 key */
    'bangumi/no-unused-style-key': 'warn',

    /** 样式值小数应取整 */
    'bangumi/floor-decimal-in-styles': 'warn'
  }
}

```

### Core Architecture Module: `.ondevice/doctools.js`
```
/*
 * @Author: czy0729
 * @Date: 2024-01-13 22:05:53
 * @Last Modified by:   czy0729
 * @Last Modified time: 2024-01-13 22:05:53
 */
import { extractArgTypes } from '@storybook/react/dist/modern/client/docs/extractArgTypes'
import { addArgTypesEnhancer, addParameters } from '@storybook/react-native'
import { enhanceArgTypes } from '@storybook/docs-tools'

addArgTypesEnhancer(enhanceArgTypes)
addParameters({
  docs: {
    extractArgTypes
  }
})

```

### Core Architecture Module: `.ondevice/index.jsx`
```
/*
 * @Author: czy0729
 * @Date: 2024-01-13 22:06:21
 * @Last Modified by:   czy0729
 * @Last Modified time: 2024-01-13 22:06:21
 */
import { getStorybookUI } from '@storybook/react-native'
// import "./doctools";
import './storybook.requires'

const StorybookUIRoot = getStorybookUI({})

export default StorybookUIRoot

```

### Core Architecture Module: `.ondevice/main.js`
```
/*
 * @Author: czy0729
 * @Date: 2024-01-13 22:05:57
 * @Last Modified by:   czy0729
 * @Last Modified time: 2024-01-13 22:05:57
 */
module.exports = {
  stories: ['../src/**/*.stories.?(ts|tsx|js|jsx)'],
  addons: [
    '@storybook/addon-ondevice-notes',
    '@storybook/addon-ondevice-controls',
    '@storybook/addon-ondevice-backgrounds',
    '@storybook/addon-ondevice-actions'
  ]
}

```

### Core Architecture Module: `.ondevice/preview.js`
```
/*
 * @Author: czy0729
 * @Date: 2024-01-13 22:06:00
 * @Last Modified by:   czy0729
 * @Last Modified time: 2024-01-13 22:06:00
 */
import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds'

export const decorators = [withBackgrounds]
export const parameters = {
  backgrounds: [
    { name: 'plain', value: 'white', default: true },
    { name: 'warm', value: 'hotpink' },
    { name: 'cool', value: 'deepskyblue' }
  ],
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/
    }
  }
}

```

### Core Architecture Module: `.ondevice/storybook.requires.js`
```
/*
 * @Author: czy0729
 * @Date: 2024-01-13 22:06:03
 * @Last Modified by:   czy0729
 * @Last Modified time: 2024-01-13 22:06:03
 */
/* do not change this file, it is auto generated by storybook. */
import {
  configure,
  addDecorator,
  addParameters,
  addArgsEnhancer,
  clearDecorators
} from '@storybook/react-native'
import '@storybook/addon-ondevice-notes/register'
import '@storybook/addon-ondevice-controls/register'
import '@storybook/addon-ondevice-backgrounds/register'
import '@storybook/addon-ondevice-actions/register'

global.STORIES = [
  {
    titlePrefix: '',
    directory: './stories',
    files: '**/*.stories.?(ts|tsx|js|jsx)',
    importPathMatcher:
      '^\\.[\\\\/](?:stories(?:\\/(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\/|\\/|$)(?!\\.)(?=.)[^/]*?\\.stories\\.(?:ts|tsx|js|jsx)?)$'
  }
]

import { argsEnhancers } from '@storybook/addon-actions/dist/modern/preset/addArgs'

import { decorators, parameters } from './preview'

if (decorators) {
  if (__DEV__) {
    // stops the warning from showing on every HMR
    require('react-native').LogBox.ignoreLogs([
      '`clearDecorators` is deprecated and will be removed in Storybook 7.0'
    ])
  }
  // workaround for global decorators getting infinitely applied on HMR, see https://github.com/storybookjs/react-native/issues/185
  clearDecorators()
  decorators.forEach(decorator => addDecorator(decorator))
}

if (parameters) {
  addParameters(parameters)
}

try {
  argsEnhancers.forEach(enhancer => addArgsEnhancer(enhancer))
} catch {}

const getStories = () => {
  return {
    './stories/MyButton.stories.js': require('../stories/MyButton.stories.js')
  }
}

configure(getStories, module, false)

```

### Core Architecture Module: `.storybook/ds.js`
```
/*
 * @Author: czy0729
 * @Date: 2023-11-02 15:07:05
 * @Last Modified by: czy0729
 * @Last Modified time: 2024-01-13 22:06:38
 */
import Provider from '@components/provider'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AppCommon } from '@_/base/app-common'
import theme from '@styles/theme'
import { styles } from './styles'

export const parameters = {
  options: {
    title: 'Bangumi 番组计划'
  },
  darkMode: {
    current: 'dark',
    darkClass: 'dark',
    classTarget: 'html',
    stylePreview: true
  },
  actions: {
    argTypesRegex: '^on[A-Z].*'
  },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/
    }
  }
}

export const decorators = [
  Story => (
    <Provider theme={theme}>
      <GestureHandlerRootView style={styles.container}>
        <Story />
        <AppCommon />
      </GestureHandlerRootView>
    </Provider>
  )
]

```

### Core Architecture Module: `.storybook/main.js`
```
/*
 * @Author: czy0729
 * @Date: 2023-04-10 16:27:31
 * @Last Modified by: czy0729
 * @Last Modified time: 2024-11-14 22:45:17
 */
const path = require('path')
const sass = require('node-sass')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { GenerateSW } = require('workbox-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

const serviceWorker = true
const analyzer = false

module.exports = {
  title: 'Bangumi 番组计划',
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    // '@storybook/addon-actions',
    // '@storybook/addon-links',
    // '@storybook/addon-essentials',
    '@storybook/addon-react-native-web',
    {
      name: 'storybook-dark-mode',
      parameters: {
        defaultTheme: 'Dark'
      }
    }
  ],
  core: {
    builder: 'webpack5',
    options: {
      fsCache: true,
      lazyCompilation: true,
      cache: {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename]
        }
      }
    }
  },
  framework: '@storybook/react',
  previewHead: head => {
    const isProduction = process.env.NODE_ENV === 'production'
    if (!isProduction) return head

    const prefix = isProduction ? 'production.min' : 'development'
    return `
      ${head}
      <script src="https://unpkg.com/react@18.3.1/umd/react.${prefix}.js" crossorigin="anonymous"></script>
      <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.${prefix}.js" crossorigin="anonymous"></script>
    `
  },
  webpackFinal: async (config, { configType }) => {
    /** ========== SASS ========== */
    config.module.rules.push({
      test: /\.scss$/,
      use: [
        {
          loader: 'thread-loader',
          options: {
            workers: 2 // 根据需要设置工作线程数
          }
        },
        'style-loader',
        'css-loader',
        {
          loader: 'sass-loader',
          options: {
            implementation: sass
          }
        }
      ]
    })

    config.resolve.alias = {
      ...config.resolve.alias,
      stream: require.resolve('stream-browserify')
    }

    /** ========== Public Assets ========== */
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, '../src/assets'),
            to: 'assets',
            filter: resourcePath => {
              return /\.(bin|proto|ico|json|jpg|png|woff2)$/.test(resourcePath)
            }
          }
        ]
      })
    )

    if (configType === 'PRODUCTION') {
      config.externals = {
        react: 'React',
        'react-dom': 'ReactDOM'
      }

      /** ========== ServiceWorker Workbox ========== */
      if (serviceWorker) {
        config.plugins.push(
          new GenerateSW({
            swDest: 'service-worker.js',
            clientsClaim: true,
            skipWaiting: true,
            runtimeCaching: [
              {
                urlPattern: /\.(png|jpe?g|gif|svg)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images',
                  expiration: {
                    maxEntries: 1000,
                    maxAgeSeconds: 60 * 60 * 24 * 30
                  }
                }
              },
              {
                urlPattern: /\.(ttf|woff|woff2|eot)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'fonts',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 30
                  }
                }
              },
              {
                urlPattern: /\.(proto|bin)$/,
                handler: 'NetworkFirst'
              }
            ],
            maximumFileSizeToCacheInBytes: 15 * 1024 * 1024
          })
        )
      }

      /** ========== webpack-bundle-analyzer ========== */
      if (analyzer) {
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'report.html'
          })
        )
      }

      /** ========== 压缩代码 ========== */
      // Replace or add TerserPlugin
      const existingTerserPluginIndex = config.optimization.minimizer.findIndex(
        plugin => plugin.constructor.name === 'TerserPlugin'
      )

      if (existingTerserPluginIndex > -1) {
        config.optimization.minimizer.splice(existingTerserPluginIndex, 1, new TerserPlugin())
      } else {
        config.optimization.minimizer.push(new TerserPlugin())
      }

      /** ========== 分割代码 ========== */
      config.optimization.splitChunks = {
        chunks: 'all',
        maxSize: 1024 * 1024
      }
    }

    return config
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #415** (2026-09-14): **下沉逻辑修改**
  *Symptoms*:  版本号：8.39.4 目前选了“app排序”和“条目自动下沉”，可以看到10月未播番剧排在9月在播番剧之上，个人认为不太符合逻辑，希望未播番剧下沉到在播番剧下面 ![Screenshot_2026-09-11-07-36-39-215_com.czy0729.bangumi.jpg](https://github.com/user-attachments/assets/7d3891f3-5299-48dc-8647-220a3fb0c4fa)  
  **Post-Mortem & Fix Analysis**:
  > 我思考了一下，现在还是2026夏，2026秋的番还没开始放送，是10月1日（前后几日）后，如果是这样，可以下沉到2026年整个大分组的最下方，这样也不会完全找不到新番

- **Issue #414** (2026-09-05): **新版8.39.2的bug**
  *Symptoms*: 点好友评分的那里会稳定触发致命错误 ![Screenshot_20260905_221338.jpg](https://github.com/user-attachments/assets/eca531df-b14c-427f-982c-189c3d506740)  ![Screenshot_20260905_221901.jpg](https://github.com/user-attachments/assets/29509799-0a48-45b5-a770-c358d2253a72)  

- **Issue #413** (2026-09-01): **已收录至Awesome Zhuiju Free追剧资源指南**
  *Symptoms*: **GitHub仓库**：https://github.com/laoma2053/awesome-zhuiju-free  - 免费无广告的追剧资源指南，人工精选资源、每天检测资源有效性。  - 收录在线影视、影视APP、网盘搜索、磁力BT、字幕、TVBox / 影视仓空壳软件/配置地址、IPTV直播源、会员拼团、影视相关开源项目。  - 开源，社区共同维护。  <img width="1153" height="879" alt="Image" src="https://github.com/user-attachments/assets/446ed3ce-4abb-4e3d-bea8-f3e371667fc4" />

- **Issue #412** (2026-08-27): **feat: 将 unsigned IPA workflow 升级到 Expo 54**
  *Symptoms*: ## 背景  当前 `packages/ipa` 仍是 Expo 52 / React Native 0.76。8.39.0 引入 `react-native-worklets` 后，IPA 只能回退到 Reanimated，无法使用主分支已经采用的 Expo 54 原生依赖。  主分支根依赖本身已经是 Expo 54 / RN 0.81，所以这里直接让 IPA 构建复用主 iOS 依赖并重新 prebuild，避免再维护一个 Expo 53 中间环境。  ## 修改  - 不再执行 `node packages/env.js ipa` - 使用根部 Expo 54 依赖和 `packages/ios/patches` - 每次构建运行 `expo prebuild --platform ios --clean` - 开启 RN 新架构并链接 RNWorklets - 将 `@react-native-community/blur` 临时升级至 4.4.1，修复旧 Podspec 锁定 RCT-Folly - 保留原 Info.plist 的 ATS、方向、深浅色、推送 entitlement，以及 AppDelegate 图片磁盘缓存 - iOS Worklets 入口恢复为原生 `react-native-worklets` - workflow 增加 Expo 54 / RN 0.81 / 新架构 / RNWorklets 校验  ## 验证  在 Xcode 27 + Node 20.20.2 下完成 clean prebuild、Pod install 和 unsigned Release 全量构建。  最终 IPA：  - Expo 54.0.22 - React Native 0.81.4 - Reanimated 4.1.2 - RNWorklets 0.5.1 - New Architecture enabled - `CFBundleShortVersionString = 8.39.0` - `unzip -t` 通过 - `codesign` 确认为未签名  测试 IPA（不会覆盖旧 Expo 52 资产）： https://github.com/AvalonUltra/Bangumi/releases/download/upstream-8.39.0/Bangumi-8.39.0-expo54-unsigned.ipa  SHA-256： `3026acd9b7ca9abc1e0c6c15bd6c34c33bbd879f46f13e98d9d53892e5794ba6`
  **Post-Mortem & Fix Analysis**:
  > 有点问题，再修一修
  > 我晕了，手机上面被强制升到 expo@57 了😭，其实这东西不难升，难是难在 react-native-reanimated 上面
  > > 我晕了，手机上面被强制升到 expo@57 了😭，其实这东西不难升，难是难在 react-native-reanimated 上面  其实主要是升级收益不是很大，所以之前一直没高兴升级，这一版有个主题跟随系统没适配好所以关了，现在应该是搞定了，马上再提个pr

- **Issue #411** (2026-08-27): **fix: 修复 IPA workflow 的 worklets 打包失败**
  *Symptoms*: ## 问题  8.39.0 之后，IPA workflow 在 `Build Release app` 阶段打包 Metro bundle 时失败：  ```text Unable to resolve module react-native-worklets from src/utils/worklets/index.ts ```  `packages/ipa` 仍使用 Expo 52 / Reanimated 3，未安装 `react-native-worklets`。虽然 IPA 运行时会走 Reanimated fallback，但 Metro 会静态解析条件分支里的 `require('react-native-worklets')`，因此构建提前失败。  ## 修改  在 IPA Prepare 阶段将 `scheduleOnRN` 和 `scheduleOnUI` 的 worklets 引用替换为现有 Reanimated fallback，只影响下载到 runner 的 IPA 构建源码，不改应用源码或其他平台。  ## 验证  - YAML 解析及 Node 脚本语法检查通过 - 本地 `expo export --platform ios` 成功，7163 modules 完成 bundle - fork 的 8.39.0 unsigned IPA workflow 完整通过，包括依赖、Pods、xcodebuild、IPA 校验与 Release 上传 - 成功 run：https://github.com/AvalonUltra/Bangumi/actions/runs/33000129695 - 产物：https://github.com/AvalonUltra/Bangumi/releases/tag/upstream-8.39.0
  **Post-Mortem & Fix Analysis**:
  > 感觉我上一个提交等于白写了，虽然我也就是试试行不行，打包出错其实我也没管他。 看来还是得花时间去处理掉 IPA 环境升到 Expo@53 的问题。

- **Issue #409** (2026-08-25): **有适配纯血鸿蒙计划吗**
  *Symptoms*: 希望能够适配纯血鸿蒙
  **Post-Mortem & Fix Analysis**:
  > 且不说你站，个人做鸿蒙基本都不太可能 而且你站什么性质还没弄清楚吗，还能活着就已经很好了╮(╯▽╰)╭
  > > 且不说你站，个人做鸿蒙基本都不太可能 而且你站什么性质还没弄清楚吗，还能活着就已经很好了╮(╯▽╰)╭  鸿蒙有侧载方案

- **Issue #408** (2026-08-22): **镜像站bangumi.pro无法在App中使用**
  *Symptoms*: bangumi.pro是之前bangumi.lol被gfw识别后新换的镜像站，加入了cf识别。经测试无法在App中访问，但可在Chrome中通过cf识别。  <img width="1440" height="3168" alt="Image" src="https://github.com/user-attachments/assets/74d9bda1-442e-4e8c-8fca-e5989e355585" />
  **Post-Mortem & Fix Analysis**:
  > 无法处理，能处理就不叫cf了。 可以尝试使用ECH。

- **Issue #406** (2026-08-27): **[Bug] 动态表情栏无法划到底**
  *Symptoms*: ## 环境版本  - 系统版本：MagicOS 10.0.0.170 - 应用版本：8.38.2  ## 问题描述  动态表情栏超出屏幕范围时无法划到底，会差一点点没有显示完全。  ## 视频示例  https://github.com/user-attachments/assets/da439c95-b77a-49b2-8f3b-1b4c4711bc2e 

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

### Incident Patch 1: `088ffc72` (2026-09-14)
**Commit Message**: - [进度] 优化下沉逻辑，现在若一个季度还没开始，若分组没有放送的下沉到年分组的底部 (fixed #415)

**File**: `src/screens/home/v2/store/__test__/computed.test.ts` (modified, +75/-6)
```diff
@@ -16,6 +16,7 @@ import {
   calcSortWeightOnair,
   getSeasonKey,
   getTopMap,
+  hasAiredEp,
   hasNewEp,
   isOnairNextDay,
   isOnairToday,
@@ -90,6 +91,61 @@ describe('calcSortWeightClient', () => {
     })
     expect(result).toBe(1_100_000)
   })
+
+  it('完全未播放 (未来季 + 无已放送章节) 季键值降为所属年份底部', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+
+    // 2026 秋 (8108) => 2026 组底部 8104.5; 当前季 2026 夏 (8107)
+    expect(
+      calcSortWeightClient({
+        ...base,
+        hasAiredEp: false,
+        seasonKey: getSeasonKey('2026-10'),
+        currentSeasonKey: getSeasonKey('2026-09')
+      })
+    ).toBe(81_045_000_000 + 1 - 100001)
+  })
+
+  it('未来季但有已放送章节 (提前放送) 时不下沉', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+
+    // 保持 2026 秋 原季键 8108, 未被降级
+    expect(
+      calcSortWeightClient({
+        ...base,
+        hasAiredEp: true,
+        hasNewEp: true,
+        air: 1,
+        seasonKey: getSeasonKey('2026-10'),
+        currentSeasonKey: getSeasonKey('2026-09')
+      })
+    ).toBe(81_080_000_000 + 500_000 + 50_000)
+  })
+
+  it('未开启下沉时不降级未来季', () => {
+    expect(
+      calcSortWeightClient({
+        ...base,
+        hasAiredEp: false,
+        seasonKey: getSeasonKey('2026-10'),
+        currentSeasonKey: getSeasonKey('2026-09')
+      })
+    ).toBe(81_080_000_000 + 1)
+  })
+
+  it('当季无已放送章节不做年份下沉 (仍只走既有下沉惩罚)', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+
+    // seasonKey === currentSeasonKey (2026 夏), 不满足「未来季」条件
+    expect(
+      calcSortWeightClient({
+        ...base,
+        hasAiredEp: false,
+        seasonKey: getSeasonKey('2026-07'),
+        currentSeasonKey: getSeasonKey('2026-09')
+      })
+    ).toBe(81_070_000_000 + 1 - 100001)
+  })
 })
 
 // ==================== sortByWeightAndTop ====================
@@ -320,16 +376,21 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
 
   const topMap = getTopMap(topList)
 
+  // 固定为快照同期 (2026-07 与 2026-09 同属 2026 夏季), 避免依赖真实系统时间
+  const currentSeasonKey = getSeasonKey('2026-09')
+
   function loadSnapshot(name: string) {
     return require(`${snapDir}/${name}.json`) as { name: string; _comment: string }[]
   }
 
   function getWatchInfo(item: UserCollectionItem) {
     const id = item.subject_id
     const up = (upJson[id] || {}) as UserProgress
+    const eps = epsJson[id] || []
     const watchedCount = Object.values(up).filter(v => v === '看过').length
-    const hasNewEpResult = hasNewEp(epsJson[id] || [], up)
-    return { watchedCount, hasNewEp: hasNewEpResult }
+    const hasNewEpResult = hasNewEp(eps, up)
+    const hasAiredEpResult = hasAiredEp(eps)
+    return { watchedCount, hasNewEp: hasNewEpResult, hasAiredEp: hasAiredEpResult }
   }
 
   function buildRealClientWeightMap(sink: boolean) {
@@ -338,7 +399,11 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
     items.forEach(item => {
       const id = item.subject_id
       const onAir = getOnAir(onAirJson[id] || {}, {})
-      const { watchedCount, hasNewEp: hasNewEpResult } = getWatchInfo(item)
+      const {
+        watchedCount,
+        hasNewEp: hasNewEpResult,
+        hasAiredEp: hasAiredEpResult
+      } = getWatchInfo(item)
       const { air = 0 } = onAirJson[id] || {}
       const epsCount = item.subject?.eps_count
 
@@ -353,7 +418,9 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
         watchedCount,
         hasNewEp: hasNewEpResult,
         seasonKey: getSeasonKey(item.subject?.air_date),
-        epsCount
+        epsCount,
+        hasAiredEp: hasAiredEpResult,
+        currentSeasonKey
       })
     })
     return weightMap
@@ -365,7 +432,7 @@ describe('真实排序 vs 快照 (2026-07-17 16:00)', () => {
     items.forEach(item => {
       const id = item.subject_id
       const onAir = getOnAir(onAirJson[id] || {}, {})
-      const { hasNewEp: hasNewEpResult } = getWatchInfo(item)
+      const { hasNewEp: hasNewEpResult, hasAiredEp: hasAiredEpResult } = getWatchInfo(item)
       const { air 
```

**File**: `src/screens/home/v2/store/__test__/sort-list.test.ts` (modified, +57/-2)
```diff
@@ -2,9 +2,9 @@
  * @Author: czy0729
  * @Date: 2026-08-08 12:00:00
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-08-10 07:43:12
+ * @Last Modified time: 2026-09-15 00:46:26
  */
-import { getTopMap, sortByIds } from '../utils'
+import { getSeasonKey, getTopMap, sortByIds } from '../utils'
 
 import type { SubjectId } from '@types'
 import type { UserCollectionItem } from '@utils/fetch.v0/types'
@@ -35,6 +35,7 @@ type CtxEntry = {
   air?: number
   onAirCustom?: { weekDay: number; isOnair: boolean }
   hasNewEp?: boolean
+  hasAiredEp?: boolean
   isToday?: boolean
   isNextDay?: boolean
   watchedCount?: number
@@ -50,6 +51,8 @@ function ctxByMap(map: Record<SubjectId, CtxEntry>) {
     getAir: (id: SubjectId) => get(id, 'air', 0) as number,
     onAirCustom: (id: SubjectId) => get(id, 'onAirCustom', { weekDay: 0, isOnair: false }),
     hasNewEp: (id: SubjectId) => get(id, 'hasNewEp', false) as boolean,
+    // 默认视为已有已放送章节, 即不参与「完全未播放」的年份下沉
+    hasAiredEp: (id: SubjectId) => get(id, 'hasAiredEp', true) as boolean,
     isToday: (id: SubjectId) => get(id, 'isToday', false) as boolean,
     isNextDay: (id: SubjectId) => get(id, 'isNextDay', false) as boolean,
     watchedCount: (id: SubjectId) => get(id, 'watchedCount', 0) as number
@@ -181,6 +184,58 @@ describe('sortByIds: 客户端顺序 (默认)', () => {
     })
     expect(result.map(item => item.subject_id)).toEqual([502, 501])
   })
+
+  it('完全未播放: 沉到在播番之后, 但仍高于上一年', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+    const items = [
+      makeItem(701, { air_date: '2026-10', eps_count: 12 }), // 未来季, 一集都没放
+      makeItem(702, { air_date: '2026-07', eps_count: 12 }), // 在播
+      makeItem(703, { air_date: '2025-10', eps_count: 12 }) // 往年
+    ]
+    const result = sortByIds(items, {
+      ...ctxByMap({
+        701: { hasAiredEp: false },
+        702: { hasNewEp: true, air: 3, watchedCount: 1 },
+        703: { hasNewEp: true, air: 8, watchedCount: 2 }
+      }),
+      currentSeasonKey: getSeasonKey('2026-09')
+    })
+    expect(result.map(item => item.subject_id)).toEqual([702, 701, 703])
+  })
+
+  it('[回归] 未来季但有已放送章节 (提前放送) 不下沉, 保持季度优先', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+    const items = [
+      makeItem(801, { air_date: '2026-10', eps_count: 12 }), // 未来季, 但已有 ep 提前放送
+      makeItem(802, { air_date: '2026-07', eps_count: 12 }) // 在播
+    ]
+    const result = sortByIds(items, {
+      ...ctxByMap({
+        801: { hasAiredEp: true, hasNewEp: true, air: 1, watchedCount: 0 },
+        802: { hasAiredEp: true, hasNewEp: true, air: 3, watchedCount: 1 }
+      }),
+      currentSeasonKey: getSeasonKey('2026-09')
+    })
+    expect(result.map(item => item.subject_id)).toEqual([801, 802])
+  })
+
+  it('[回归] 跨年: 未开播的 2027 冬沉到 2027 组底部, 年份仍优先于 2026 全年', () => {
+    ;(global as any).__mockStoreState__.homeSortSink = true
+    const items = [
+      makeItem(901, { air_date: '2027-01', eps_count: 12 }), // 未开播
+      makeItem(902, { air_date: '2026-10', eps_count: 12 }), // 未开播
+      makeItem(903, { air_date: '2026-07', eps_count: 12 }) // 在播
+    ]
+    const result = sortByIds(items, {
+      ...ctxByMap({
+        901: { hasAiredEp: false },
+        902: { hasAiredEp: false },
+        903: { hasNewEp: true, air: 3, watchedCount: 1 }
+      }),
+      currentSeasonKey: getSeasonKey('2026-09')
+    })
+    expect(result.map(item => item.subject_id)).toEqual([901, 903, 902])
+  })
 })
 
 // ==================== 兜底 ====================
```

**File**: `src/screens/home/v2/store/computed/air.ts` (modified, +4/-0)
```diff
@@ -13,6 +13,7 @@ import {
   getLastWatchedSort,
   getOnlineOrigins,
   getWatchedCount,
+  hasAiredEp as checkHasAiredEp,
   hasNewEp as checkHasNewEp,
   isOnairNextDay,
   isOnairToday
@@ -76,6 +77,9 @@ export default class Air extends Subject {
     checkHasNewEp(this.epsNoSp(subjectId), this.userProgress(subjectId))
   )
 
+  /** 是否已有已放送的章节 (只看章节状态, 与用户进度无关) */
+  hasAiredEp = computedFn((subjectId: SubjectId) => checkHasAiredEp(this.epsNoSp(subjectId)))
+
   /** 猜测条目当前看到的集数 */
   countFixed = computedFn((subjectId: SubjectId, epStatus: number | string) => {
     // 直接获取第一个看过章节的 sort
```

**File**: `src/screens/home/v2/store/computed/list.ts` (modified, +1/-0)
```diff
@@ -99,6 +99,7 @@ export default class List extends Air {
       sortOnAir: this.sortOnAir,
       getAir: subjectId => calendarStore.onAir[subjectId]?.air || 0,
       onAirCustom: subjectId => this.onAirCustom(subjectId),
+      hasAiredEp: subjectId => this.hasAiredEp(subjectId),
       hasNewEp: subjectId => this.hasNewEp(subjectId),
       isToday: subjectId => this.isToday(subjectId),
       isNextDay: subjectId => this.isNextDay(subjectId),
```

**File**: `src/screens/home/v2/store/index.ts` (modified, +5/-3)
```diff
@@ -2,14 +2,15 @@
  * @Author: czy0729
  * @Date: 2023-02-27 20:26:27
  * @Last Modified by: czy0729
- * @Last Modified time: 2026-08-27 03:49:57
+ * @Last Modified time: 2026-09-15 00:08:16
  */
 import * as Device from 'expo-device'
 import { _, systemStore, userStore } from '@stores'
 import { date, feedback, getTimestamp, info, pick, postTask, sortObject } from '@utils'
 import { logger } from '@utils/dev'
 import { t } from '@utils/fetch'
 import { update } from '@utils/kv'
+import { getProxyStrategy } from '@utils/proxy'
 import { get } from '@utils/thirdParty/protobuf'
 import {
   D,
@@ -144,7 +145,7 @@ export default class ScreenHomeV2 extends Action {
     return false
   }
 
-  /** 注册设备名 */
+  /** 注册设备名，构建监测报错信息的环境变量 */
   initUser = () => {
     if (inited) return
 
@@ -172,7 +173,8 @@ export default class ScreenHomeV2 extends Action {
           direct: setting.workerProxyDirect,
           secret: setting.workerSecret.length,
           lainSecret: setting.workerLainSecret.length,
-          ech: setting.echProxyEnabled
+          ech: setting.echProxyEnabled,
+          supporter: getProxyStrategy().supporter
         },
         l: {
           statusBar: STATUS_BAR_HEIGHT,
```

---

### Incident Patch 2: `2b694e8b` (2026-09-05)
**Commit Message**: - [修复] 原生头部 headerLeft/headerRight 渲染在 StoreContext 之外拿不到页面状态机, 新增 useStoreContextBridge 桥接, HeaderV1/HeaderV2 统一包裹 Provider (fixed #414)

**File**: `src/components/header-v2/hooks.ts` (modified, +14/-4)
```diff
@@ -5,7 +5,7 @@
  * @Last Modified time: 2026-08-19 18:11:59
  */
 import { useEffect, useMemo } from 'react'
-import { _ } from '@stores'
+import { _, useStoreContextBridge } from '@stores'
 import { useNavigation } from '@utils/hooks'
 import { getHeaderTitleAlign, getHeaderTitleStyle } from './utils'
 import { COMPONENT } from './ds'
@@ -19,15 +19,25 @@ export function useHeaderV2({
   headerTitleStyle
 }: UseHeaderV2Options): UseHeaderV2Result {
   const navigation = useNavigation(COMPONENT)
+  const bridge = useStoreContextBridge()
+
+  /**
+   * 原生头部渲染 headerRight 时位于 StoreContext.Provider 之外,
+   * 需要包一层 Provider, 否则内部的 useStore 拿不到页面状态机
+   */
+  const bridgedHeaderRight = useMemo(() => {
+    if (!headerRight) return headerRight
+    return bridge(headerRight)
+  }, [headerRight, bridge])
 
   useEffect(() => {
     navigation.setOptions({
       headerShown: false,
       headerTransparent: false,
       headerShadowVisible: false,
-      headerRight
+      headerRight: bridgedHeaderRight
     })
-  }, [navigation, headerRight])
+  }, [navigation, bridgedHeaderRight])
 
   const headerTitleAlignValue = getHeaderTitleAlign(headerTitleAlign, _.isPad)
 
@@ -37,5 +47,5 @@ export function useHeaderV2({
     [headerTitleStyle, _.isPad]
   )
 
-  return { headerTitleAlignValue, headerTitleStyleValue }
+  return { bridgedHeaderRight, headerTitleAlignValue, headerTitleStyleValue }
 }
```

**File**: `src/components/header-v2/index.tsx` (modified, +2/-2)
```diff
@@ -33,7 +33,7 @@ export const HeaderV2 = observer(
     headerTitleTextStyle,
     headerRight
   }: HeaderV2Props) => {
-    const { headerTitleAlignValue, headerTitleStyleValue } = useHeaderV2({
+    const { bridgedHeaderRight, headerTitleAlignValue, headerTitleStyleValue } = useHeaderV2({
       headerRight,
       headerTitleAlign,
       headerTitleStyle
@@ -51,7 +51,7 @@ export const HeaderV2 = observer(
           headerTitleSize={headerTitleSize}
           headerTitleAppend={headerTitleAppend}
           headerTitleTextStyle={headerTitleTextStyle}
-          headerRight={headerRight}
+          headerRight={bridgedHeaderRight}
         />
         <Track title={title} domTitle={domTitle} hm={hm} alias={alias} />
       </Component>
```

**File**: `src/components/header-v2/types.ts` (modified, +3/-0)
```diff
@@ -63,6 +63,9 @@ export type UseHeaderV2Options = Pick<Props, 'headerRight' | 'headerTitleAlign'
 
 /** HeaderV2 头部逻辑返回值 */
 export type UseHeaderV2Result = {
+  /** 包裹 StoreContext.Provider 后的右侧渲染函数, 用于原生头部和自绘头部 */
+  bridgedHeaderRight?: Props['headerRight']
+
   /** 按设备适配的标题对齐 */
   headerTitleAlignValue: 'center' | 'left'
 
```

**File**: `src/components/header/index.tsx` (modified, +10/-2)
```diff
@@ -4,9 +4,9 @@
  * @Last Modified by: czy0729
  * @Last Modified time: 2026-05-16 02:10:13
  */
-import React, { useEffect } from 'react'
+import React, { useContext, useEffect } from 'react'
 import { observer } from 'mobx-react'
-import { _ } from '@stores'
+import { _, StoreContext } from '@stores'
 import { r } from '@utils/dev'
 import { useNavigation } from '@utils/hooks'
 import { WEB } from '@constants'
@@ -44,9 +44,16 @@ const Header = observer(
 
     const navigation = useNavigation()
 
+    /**
+     * 原生头部渲染 headerLeft / headerRight 时位于 StoreContext.Provider 之外,
+     * 需要把当前页面的上下文 id 传给 updateHeader, 在 options JSX 外包一层 Provider
+     */
+    const storeContextId = useContext(StoreContext)
+
     useEffect(() => {
       updateHeader({
         navigation,
+        storeContextId,
         mode,
         fixed,
         title,
@@ -59,6 +66,7 @@ const Header = observer(
       })
     }, [
       navigation,
+      storeContextId,
       mode,
       fixed,
       title,
```

**File**: `src/components/header/types.ts` (modified, +3/-0)
```diff
@@ -75,6 +75,9 @@ export type UpdateHeaderProps = Expand<
       | 'fixed'
       | 'statusBarEventsType'
     > & {
+      /** 页面 Store 上下文 id, 用于 headerLeft / headerRight 桥接 StoreContext */
+      storeContextId?: string
+
       onBackPress?: () => void
     }
   >
```

#### Recent Merged Pull Requests:
- **PR #412** (closed): feat: 将 unsigned IPA workflow 升级到 Expo 54 (@AvalonUltra)
- **PR #411** (2026-08-27): fix: 修复 IPA workflow 的 worklets 打包失败 (@AvalonUltra)
- **PR #398** (2026-07-27): 改正`buildVersion`类型，更新`alt_store.json`版本 (@BrandenXia)
- **PR #397** (2026-07-26): Update alt_store.json to 8.37.3 (@BrandenXia)
- **PR #395** (closed): [iOS] 使用系统原生底栏适配 Liquid Glass (@Souitou-iop)
- **PR #394** (closed): [iOS] 使用原生底栏适配 Liquid Glass (@Souitou-iop)
- **PR #392** (2026-07-08): 添加AltStore源相关说明 (@BrandenXia)
- **PR #390** (2026-07-07): 自动生成 `alt_store.json` 用于 altstore source (@BrandenXia)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
