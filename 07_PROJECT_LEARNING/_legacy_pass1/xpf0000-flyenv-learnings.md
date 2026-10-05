# Forensic Learning Record (Deep Inspection): xpf0000/FlyEnv

> **Canonical Artifact**: `07_PROJECT_LEARNING/xpf0000-flyenv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xpf0000/FlyEnv](https://github.com/xpf0000/FlyEnv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:36:54.794Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xpf0000/FlyEnv`
- **Description**: Native local development environment for Windows, macOS & Linux. A modern alternative to XAMPP, MAMP, Laragon and Laravel Herd, with runtimes, databases, web servers, local sites, HTTPS, AI coding tools and MCP.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3249 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `configs/element-plus-locales.ts`
```
export const ElementPlusLocaleModules = [
  'element-plus/es/locale/lang/ar',
  'element-plus/es/locale/lang/az',
  'element-plus/es/locale/lang/bg',
  'element-plus/es/locale/lang/bn',
  'element-plus/es/locale/lang/cs',
  'element-plus/es/locale/lang/da',
  'element-plus/es/locale/lang/de',
  'element-plus/es/locale/lang/el',
  'element-plus/es/locale/lang/en',
  'element-plus/es/locale/lang/es',
  'element-plus/es/locale/lang/fi',
  'element-plus/es/locale/lang/fr',
  'element-plus/es/locale/lang/hr',
  'element-plus/es/locale/lang/hu',
  'element-plus/es/locale/lang/id',
  'element-plus/es/locale/lang/it',
  'element-plus/es/locale/lang/ja',
  'element-plus/es/locale/lang/ko',
  'element-plus/es/locale/lang/nl',
  'element-plus/es/locale/lang/no',
  'element-plus/es/locale/lang/pl',
  'element-plus/es/locale/lang/pt',
  'element-plus/es/locale/lang/pt-br',
  'element-plus/es/locale/lang/ro',
  'element-plus/es/locale/lang/ru',
  'element-plus/es/locale/lang/sv',
  'element-plus/es/locale/lang/tr',
  'element-plus/es/locale/lang/uk',
  'element-plus/es/locale/lang/vi',
  'element-plus/es/locale/lang/zh-cn',
  'element-plus/es/locale/lang/zh-tw'
] as const

```

### Core Architecture Module: `configs/publish.ts`
```
import type { GithubOptions } from 'builder-util-runtime'

const conf: GithubOptions = {
  provider: 'github',
  owner: 'xpf0000',
  repo: 'FlyEnv'
}

export default conf

```

### Core Architecture Module: `configs/vite.config.ts`
```
import type { UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import * as path from 'path'
import { ViteDevPort } from './vite.port'
import vueJsx from '@vitejs/plugin-vue-jsx'
import wasm from 'vite-plugin-wasm'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import { ElementPlusLocaleModules } from './element-plus-locales'
const require = createRequire(import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))

const renderPath = path.resolve(__dirname, '../src/render/')
const sharePath = path.resolve(__dirname, '../src/shared/')
const langPath = path.resolve(__dirname, '../src/lang/')

const monacoEditorPlugin = require('vite-plugin-monaco-editor').default

const config: UserConfig = {
  base: './',
  plugins: [
    monacoEditorPlugin({}),
    wasm(),
    vue({
      include: [/\.vue$/, /\.md$/] // <-- allows Vue to compile Markdown files
    }),
    vueJsx({
      transformOn: true,
      mergeProps: true
    })
  ],
  esbuild: {
    jsx: 'preserve',
    target: 'esnext',
    supported: {
      'top-level-await': true
    }
  },
  assetsInclude: ['**/*.node'],
  optimizeDeps: {
    include: [...ElementPlusLocaleModules],
    esbuildOptions: {
      jsx: 'preserve',
      target: 'esnext',
      supported: {
        'top-level-await': true
      }
    }
  },
  root: renderPath,
  resolve: {
    alias: {
      '@': renderPath,
      '@shared': sharePath,
      '@lang': langPath
    }
  },
  css: {
    // CSS preprocessor
    preprocessorOptions: {
      scss: {}
    }
  }
}

const serverConfig: UserConfig = {
  server: {
    port: ViteDevPort,
    hmr: true
  },
  ...config
}

const serveConfig: UserConfig = {
  server: {
    port: ViteDevPort,
    open: true,
    hmr: true
  },
  ...config
}

const buildConfig: UserConfig = {
  mode: 'production',
  build: {
    outDir: '../../dist/render',
    assetsDir: 'static',
    commonjsOptions: {
      transformMixedEsModules: true,
      ignoreDynamicRequires: true
    },
    rollupOptions: {
      external: [],
      input: {
        main: path.resolve(__dirname, '../src/render/index.html'),
        tray: path.resolve(__dirname, '../src/render/tray.html'),
        capturer: path.resolve(__dirname, '../src/render/capturer/capturer.html')
      },
      output: {
        entryFileNames: 'static/js/[name].[hash].js',
        chunkFileNames: 'static/js/[name].[hash].js',
        assetFileNames: 'static/[ext]/[name].[hash].[ext]',
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/')
          const elementLocale = normalizedId.match(/element-plus\/es\/locale\/lang\/([^/.]+)/)
          if (elementLocale) {
            return `element-plus-locale-${elementLocale[1]}`
          }
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString()
          }
          return undefined
        }
      }
    },
    minify: 'esbuild'
  },
  ...config,
  ...{
    esbuild: {
      jsx: 'preserve',
      target: 'esnext',
      supported: {
        'top-level-await': true
      },
      drop: ['console', 'debugger']
    }
  }
}

export default {
  serveConfig,
  serverConfig,
  buildConfig
}

```

### Core Architecture Module: `configs/vite.port.ts`
```
export const ViteDevPort = 4000

```

### Core Architecture Module: `eslint.config.mjs`
```
// eslint.config.js

import { defineConfig, globalIgnores } from 'eslint/config' // Used for type hinting and potential future utilities
// Core ESLint recommended rules
import js from '@eslint/js'

// TypeScript ESLint plugin and recommended flat configs
import tseslint from 'typescript-eslint'

// Prettier plugin and config
import prettierConfig from 'eslint-config-prettier' // This is the 'config' part to disable conflicting rules
import prettierPlugin from 'eslint-plugin-prettier'

import {
  defineConfigWithVueTs,
  vueTsConfigs,
  configureVueProject
} from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import vuePlugin from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
configureVueProject({ scriptLangs: ['js', 'jsx', 'ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

const vueConfig = defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  skipFormatting
)

vueConfig.forEach((v) => {
  if (v?.plugins) {
    v.plugins.prettier = prettierPlugin
  }
})

export default defineConfig([
  {
    languageOptions: {
      globals: {
        ...globals.browser, // 浏览器环境（包含 console, window 等）
        ...globals.node // 如果是 Node.js 环境
      }
    }
  },
  // 1. Global ignores (always apply)
  // Ensure paths are relative to the config file or absolute
  {
    ignores: [
      'src/assets/**', // Ignore all files in src/assets
      'src/icons/**', // Ignore all files in src/icons
      '**/public/**', // Ignore all files in any 'public' directory
      '**/dist/**', // Ignore all files in any 'dist' directory
      '**/node_modules/**' // Ignore all files in any 'node_modules' directory
    ]
  },

  // 2. ESLint's own recommended rules
  js.configs.recommended,

  // 3. TypeScript ESLint recommended configuration
  // Spreading the recommended configs from typescript-eslint
  ...tseslint.configs.recommended,

  // VUE
  { name: 'app/files-to-lint', files: ['**/*.{ts,mts,tsx,vue}'] },
  {
    name: 'globalIgnores 0',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**']
  },
  {
    name: 'vue/base/setup',
    plugins: { vue: vuePlugin, prettier: prettierPlugin },
    languageOptions: { sourceType: 'module' }
  },
  {
    name: 'vue/base/setup-for-vue',
    files: ['*.vue', '**/*.vue'],
    plugins: { vue: vuePlugin, prettier: prettierPlugin },
    languageOptions: { parser: vueParser, sourceType: 'module' },
    rules: { 'vue/comment-directive': 'error', 'vue/jsx-uses-vars': 'error' },
    processor: 'vue/vue'
  },
  {
    name: 'vue/essential/rules',
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-arrow-functions-in-watch': 'error',
      'vue/no-async-in-computed-properties': 'error',
      'vue/no-child-content': 'error',
      'vue/no-computed-properties-in-data': 'error',
      'vue/no-deprecated-data-object-declaration': 'error',
      'vue/no-deprecated-delete-set': 'error',
      'vue/no-deprecated-destroyed-lifecycle': 'error',
      'vue/no-deprecated-dollar-listeners-api': 'error',
      'vue/no-deprecated-dollar-scopedslots-api': 'error',
      'vue/no-deprecated-events-api': 'error',
      'vue/no-deprecated-filter': 'error',
      'vue/no-deprecated-functional-template': 'error',
      'vue/no-deprecated-html-element-is': 'error',
      'vue/no-deprecated-inline-template': 'error',
      'vue/no-deprecated-model-definition': 'error',
      'vue/no-deprecated-props-default-this': 'error',
      'vue/no-deprecated-router-link-tag-prop': 'error',
      'vue/no-deprecated-scope-attribute': 'error',
      'vue/no-deprecated-slot-attribute': 'error',
      'vue/no-deprecated-slot-scope-attribute': 'error',
      'vue/no-deprecated-v-bind-sync': 'error',
      'vue/no-deprecated-v-is': 'error',
      'vue/no-deprecated-v-on-native-modifier': 'error',
      'vue/no-deprecated-v-on-number-modifiers': 'error',
      'vue/no-deprecated-vue-config-keycodes': 'error',
      'vue/no-dupe-keys': 'error',
      'vue/no-dupe-v-else-if': 'error',
      'vue/no-duplicate-attributes': 'error',
      'vue/no-export-in-script-setup': 'error',
      'vue/no-expose-after-await': 'error',
      'vue/no-lifecycle-after-await': 'error',
      'vue/no-mutating-props': 'error',
      'vue/no-parsing-error': 'error',
      'vue/no-ref-as-operand': 'error',
      'vue/no-reserved-component-names': 'error',
      'vue/no-reserved-keys': 'error',
      'vue/no-reserved-props': 'error',
      'vue/no-shared-component-data': 'error',
      'vue/no-side-effects-in-computed-properties': 'error',
      'vue/no-template-key': 'error',
      'vue/no-textarea-mustache': 'error',
      'vue/no-unused-components': 'error',
      'vue/no-unused-vars': 'error',
      'vue/no-use-computed-property-like-method': 'error',
      'vue/no-use-v-if-with-v-for': 'error',
      'vue/no-useless-template-attributes': 'error',
      'vue/no-v-for-template-key-on-child': 'error',
      'vue/no-v-text-v-html-on-component': 'error',
      'vue/no-watch-after-await': 'error',
      'vue/prefer-import-from-vue': 'error',
      'vue/require-component-is': 'error',
      'vue/require-prop-type-constructor': 'error',
      'vue/require-render-return': 'error',
      'vue/require-slots-as-functions': 'error',
      'vue/require-toggle-inside-transition': 'error',
      'vue/require-v-for-key': 'error',
      'vue/require-valid-default-prop': 'error',
      'vue/return-in-computed-property': 'error',
      'vue/return-in-emits-validator': 'error',
      'vue/use-v-on-exact': 'error',
      'vue/valid-attribute-name': 'error',
      'vue/valid-define-emits': 'error',
      'vue/valid-define-options': 'error',
      'vue/valid-define-props': 'error',
      'vue/valid-next-tick': 'error',
      'vue/valid-template-root': 'error',
      'vue/valid-v-bind': 'error',
      'vue/valid-v-cloak': 'error',
      'vue/valid-v-else-if': 'error',
      'vue/valid-v-else': 'error',
      'vue/valid-v-for': 'error',
      'vue/valid-v-html': 'error',
      'vue/valid-v-if': 'error',
      'vue/valid-v-is': 'error',
      'vue/valid-v-memo': 'error',
      'vue/valid-v-model': 'error',
      'vue/valid-v-on': 'error',
      'vue/valid-v-once': 'error',
      'vue/valid-v-pre': 'error',
      'vue/valid-v-show': 'error',
      'vue/valid-v-slot': 'error',
      'vue/valid-v-text': 'error'
    }
  },
  {
    name: 'vue/strongly-recommended/rules',
    rules: {
      'vue/attribute-hyphenation': 'warn',
      'vue/component-definition-name-casing': 'warn',
      'vue/first-attribute-linebreak': 'warn',
      'vue/html-closing-bracket-newline': 'warn',
      'vue/html-closing-bracket-spacing': 'warn',
      'vue/html-end-tags': 'warn',
      'vue/html-indent': 'warn',
      'vue/html-quotes': 'warn',
      'vue/html-self-closing': 'warn',
      'vue/max-attributes-per-line': 'warn',
      'vue/multiline-html-element-content-newline': 'warn',
      'vue/mustache-interpolation-spacing': 'warn',
      'vue/no-multi-spaces': 'warn',
      'vue/no-spaces-around-equal-signs-in-attribute': 'warn',
      'vue/no-template-shadow': 'warn',
      'vue/one-component-per-file': 'warn',
      'vue/prop-name-casing': 'warn',
      'vue/require-default-prop': 'warn',
      'vue/require-explicit-emits': 'warn',
      'vue/require-prop-types': 'warn',
      'vue/singleline-html-element-content-newline': 'warn',
      'vue/v-bind-style': 'warn',
      'vue/v-on-event-hyphenation': [
        'warn',
        'always',
        {
          autofix: true
        }
      ],
      'vue/v-on-style': 'warn',
      'vue/v-slot-style': 'warn'
    }
  },
  
```

### Core Architecture Module: `ide.config.js`
```
/* Configure webpack output file path */
const path = require('path')
const resolve = (dir) => {
  return path.join(__dirname, dir)
}
module.exports = {
  module: 'esnext',
  resolve: {
    alias: {
      '@': resolve('src/render'),
      '@shared': resolve('src/shared'),
      '@lang': resolve('src/lang'),
      '@web': resolve('web')
    }
  }
}

```

### Core Architecture Module: `plugins/kafka/fork/Kafka/index.ts`
```
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { createConnection } from 'net'
import { Base } from '@fork/module/Base'
import { I18nT } from '@lang/runtime'
import type { OnlineVersionItem, SoftInstalled } from '@shared/app'
import {
  AppLog,
  execPromiseWithEnv,
  mkdirp,
  moveChildDirToParent,
  readdir,
  readFile,
  remove,
  serviceStartExecCMD,
  versionBinVersion,
  versionDirCache,
  versionFilterSame,
  versionFixed,
  versionLocalFetch,
  versionSort,
  waitTime,
  writeFile,
  zipUnpack
} from '@fork/Fn'
import { serviceStartSpawn } from '@fork/util/ServiceStart'
import { ForkPromise } from '@shared/ForkPromise'
import TaskQueue from '@fork/TaskQueue'
import EnvSync from '@shared/EnvSync'
import { isLinux, isMacOS, isWindows, pathFixedToUnix } from '@shared/utils'
import { ProcessListSearch } from '@shared/Process.win'
import { validateKafkaJava, KAFKA_MIN_JAVA_MAJOR } from './policy'
import { KafkaT } from '../lang'
import KafkaVersionFetch from './version'

const KAFKA_STARTUP_CHECK_TIMES = 60
const KAFKA_VERSION_COMMAND_TIMEOUT_MS = 60_000
const KAFKA_TOPIC_COMMAND_TIMEOUT_MS = 60_000
const KAFKA_DEFAULT_BOOTSTRAP_SERVER = '127.0.0.1:9092'

export type KafkaStartParams = {
  javaHome?: string
}

class Kafka extends Base {
  baseDir: string = ''

  constructor() {
    super()
    this.type = 'kafka'
  }

  init() {
    this.baseDir = join(global.Server.BaseDir!, 'kafka')
    this.pidPath = join(this.baseDir, 'kafka.pid')
    mkdirp(this.baseDir).catch()
  }

  private _instanceDir(version: SoftInstalled): string {
    return join(this.baseDir, `kafka-${version?.version ?? ''}`.split(' ').join(''))
  }

  private _instancePaths(version: SoftInstalled) {
    const instanceDir = this._instanceDir(version)
    const configDir = join(instanceDir, 'config')
    const dataDir = join(instanceDir, 'data')
    const logsDir = join(instanceDir, 'logs')
    return {
      instanceDir,
      configDir,
      dataDir,
      logsDir,
      serverProperties: join(configDir, 'server.properties'),
      serverDefaultProperties: join(configDir, 'server-default.properties')
    }
  }

  private startupLogFiles(version: SoftInstalled) {
    const versionStr = version?.version?.trim() ?? ''
    const instanceDir = this._instanceDir(version)
    return [
      {
        name: `${this.type}-${versionStr}-start-out.log`,
        path: join(instanceDir, `${this.type}-${versionStr}-start-out.log`.split(' ').join(''))
      },
      {
        name: `${this.type}-${versionStr}-start-error.log`,
        path: join(instanceDir, `${this.type}-${versionStr}-start-error.log`.split(' ').join(''))
      }
    ]
  }

  private async startupDiagnostics(version: SoftInstalled): Promise<string> {
    const messages: string[] = []
    for (const file of this.startupLogFiles(version)) {
      if (!existsSync(file.path)) continue
      try {
        const content = (await readFile(file.path, 'utf-8')).trim()
        if (content) messages.push(`${file.name}:\n${content}`)
      } catch {}
    }
    return messages.join('\n')
  }

  private _serverPropertiesContent(dataDir: string): string {
    return `process.roles=broker,controller
node.id=1
controller.quorum.voters=1@127.0.0.1:9093
listeners=PLAINTEXT://127.0.0.1:9092,CONTROLLER://127.0.0.1:9093
advertised.listeners=PLAINTEXT://127.0.0.1:9092
controller.listener.names=CONTROLLER
log.dirs=${pathFixedToUnix(dataDir)}
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
`
  }

  initConfig(version: SoftInstalled): ForkPromise<string> {
    return new ForkPromise(async (resolve, reject, on) => {
      if (!existsSync(version?.bin)) {
        reject(new Error(I18nT('fork.binNotFound')))
        return
      }
      if (!version?.version) {
        reject(new Error(I18nT('fork.versionNotFound')))
        return
      }
      const paths = this._instancePaths(version)
      await mkdirp(paths.configDir)
      const content = this._serverPropertiesContent(paths.dataDir)
      if (!existsSync(paths.serverProperties)) {
        on({
          'APP-On-Log': AppLog('info', I18nT('appLog.confInit'))
        })
        await writeFile(paths.serverProperties, content)
        on({
          'APP-On-Log': AppLog(
            'info',
            I18nT('appLog.confInitSuccess', { file: paths.serverProperties })
          )
        })
      }
      await writeFile(paths.serverDefaultProperties, content)
      resolve(paths.serverProperties)
    })
  }

  private _storageBin(version: SoftInstalled): string {
    if (isWindows()) {
      return join(version.path, 'bin/windows/kafka-storage.bat')
    }
    return join(version.path, 'bin/kafka-storage.sh')
  }

  private async _javaEnv(javaHome: string): Promise<Record<string, string>> {
    const env = await EnvSync.sync().catch(() => process.env as Record<string, string>)
    const currentPath = env?.PATH ?? env?.Path ?? process.env.PATH ?? ''
    const sep = isWindows() ? ';' : ':'
    return {
      JAVA_HOME: javaHome,
      PATH: [join(javaHome, 'bin'), currentPath].filter(Boolean).join(sep)
    }
  }

  private async _initKRaft(version: SoftInstalled, javaHome: string) {
    const paths = this._instancePaths(version)
    if (existsSync(join(paths.dataDir, 'meta.properties'))) {
      return
    }
    const storageBin = this._storageBin(version)
    const env = await this._javaEnv(javaHome)
    const opt = {
      cwd: version.path,
      env,
      timeout: KAFKA_VERSION_COMMAND_TIMEOUT_MS
    }
    let uuid = ''
    try {
      const res = await execPromiseWithEnv(`"${storageBin}" random-uuid`, opt)
      uuid =
        res.stdout
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .pop() ?? ''
    } catch (e: any) {
      throw new Error(KafkaT('kraftUuidFailed', { error: e?.stderr ?? e?.message ?? e }))
    }
    if (!uuid) {
      throw new Error(KafkaT('kraftUuidEmpty'))
    }
    try {
      // Static quorum: controller.quorum.voters is set in server.properties, so
      // `format` must run WITHOUT --standalone/--initial-controllers (Kafka rejects
      // combining them: "You cannot specify controller.quorum.voters and format
      // the node with --initial-controllers or --standalone").
      await execPromiseWithEnv(
        `"${storageBin}" format -t ${uuid} -c "${paths.serverProperties}"`,
        opt
      )
    } catch (e: any) {
      throw new Error(KafkaT('kraftFormatFailed', { error: e?.stderr ?? e?.message ?? e }))
    }
  }

  _startServer(version: SoftInstalled, params?: KafkaStartParams) {
    return new ForkPromise(async (resolve, reject, on) => {
      on({
        'APP-On-Log': AppLog(
          'info',
          I18nT('appLog.startServiceBegin', { service: `${this.type}-${version.version}` })
        )
      })
      let java: { javaHome: string; javaBin: string; javaMajor: number }
      try {
        java = await validateKafkaJava(params?.javaHome)
      } catch (e) {
        reject(e)
        return
      }
      const paths = this._instancePaths(version)
      try {
        await this._fixRunClassBat(version.bin)
        await this.initConfig(version).on(on)
        await mkdirp(paths.dataDir)
        await mkdirp(paths.logsDir)
        await this._initKRaft(version, java.javaHome)
      } catch (e) {
        reject(e)
        return
      }

      for (const file of this.startupLogFiles(version)) {
        try {
          await writeFile(file.path, '')
        } catch {}
      }

      const failStart = async (cause?: unknown) => {
        const diagnostics = await this.startupDiagnostics(version)
        const causeText = cause instanceof Error ? cause.message : `${cause ?? ''}`
        const error = [diagnostics, causeText].filter((item) => item.trim()).join('\n')
        const message = error || I18nT('fork.startFail')
        on({
          'APP-On-Log': AppLog(
            'error',
            I18nT('appLog.execStartCommandFail
```

### Core Architecture Module: `plugins/kafka/fork/Kafka/policy.ts`
```
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { spawnPromiseWithEnv } from '@shared/child-process'
import { isWindows } from '@shared/utils'
import { KafkaT } from '../lang'

export const KAFKA_MIN_JAVA_MAJOR = 17

/**
 * Parse the major version from `java -version` output. Handles both the modern
 * scheme (`openjdk version "17.0.9"`) and the legacy 1.x scheme
 * (`java version "1.8.0_292"` -> 8).
 */
export function javaMajorFromVersion(output: string | null | undefined): number {
  const value = `${output ?? ''}`
  const match =
    value.match(/version\s+"(\d+)(?:\.(\d+))?/i) ?? value.match(/(?:^|[^\d])(\d+)(?:\.(\d+))?/)
  if (!match) return 0
  const first = Number(match[1])
  if (first === 1) {
    const second = Number(match[2])
    return Number.isNaN(second) ? 0 : second
  }
  return first
}

function javaBinForHome(javaHome: string): string {
  return join(javaHome, 'bin', isWindows() ? 'java.exe' : 'java')
}

async function detectJavaMajor(javaBin: string): Promise<number> {
  const result = await spawnPromiseWithEnv(javaBin, ['-version'], {
    cwd: dirname(javaBin),
    shell: false,
    trimOutput: false
  })
  return javaMajorFromVersion(`${result.stdout}\n${result.stderr}`)
}

export async function validateKafkaJava(
  javaHome: string | null | undefined
): Promise<{ javaHome: string; javaBin: string; javaMajor: number }> {
  const home = `${javaHome ?? ''}`.trim()
  if (!home) {
    throw new Error(KafkaT('javaBindRequired', { min: KAFKA_MIN_JAVA_MAJOR }))
  }
  const javaBin = javaBinForHome(home)
  if (!existsSync(javaBin)) {
    throw new Error(KafkaT('javaBinNotFound', { bin: javaBin }))
  }
  const javaMajor = await detectJavaMajor(javaBin)
  if (!javaMajor || javaMajor < KAFKA_MIN_JAVA_MAJOR) {
    throw new Error(
      KafkaT('javaVersionTooOld', { min: KAFKA_MIN_JAVA_MAJOR, major: javaMajor || 'unknown' })
    )
  }
  return { javaHome: home, javaBin, javaMajor }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #871** (2026-09-29): **feat: 将数据库启动参数改为读取配置**
  *Symptoms*: 

- **Issue #869** (2026-09-29): **Invisible overlay blocks mouse clicks on macOS after updating to v4.19.0**
  *Symptoms*: After updating FlyEnv to v4.19.0, an issue arose involving an invisible element or window that blocks mouse clicks.  The affected area extends from the top-left corner to approximately the middle of the left side of the screen. Within this zone, it is impossible to click on windows, buttons, links, or other elements.  It appears there is an invisible window or overlay from FlyEnv sitting on top of all other macOS windows and intercepting clicks.  Once FlyEnv is fully closed, the problem disappears immediately, and everything returns to normal operation.  I have attached a video showing how the cursor changes when hovering over a link and which parts of the screen respond to clicks.  I am using Firefox in the video solely for demonstration purposes. The issue is not browser-related; the invisible element sits above the entire operating system and blocks clicks in other applications as well.  https://github.com/user-attachments/assets/58344094-3e85-4b71-ae1e-360439105c0f  Environment FlyEnv: v4.19.0 Device: MacBook Pro M4 macOS: 15.7.7  @xpf0000 
  **Post-Mortem & Fix Analysis**:
  > I've found the cause of the issue. It's related to the tray UI style.  For now, please go to FlyEnv Settings and switch to the **Classic Tray Popup** style.  I'll fix this issue as soon as possible.
  > https://github.com/xpf0000/FlyEnv/releases/tag/v4.19.1   fixed this issues

- **Issue #868** (2026-09-26): **fix(tray): keep popup visible on every taskbar edge**
  *Symptoms*: ## 摘要 / Summary  修复 Windows 上托盘弹窗的三个问题：任务栏不在底部时（最新版win11和win10，均支持任务栏调整到屏幕上下左右），右键flyenv 弹窗被裁到屏幕外、弹窗出现时先画错布局再跳动、每次显示都会被系统重放一次约 300ms 的整窗淡入。另含为消除淡入改用「屏外驻留」后必须补回的焦点处理。  Fixes the Windows tray popup: it was clipped off-screen whenever the taskbar was not at the bottom, it re-laid-out right after appearing, and every hidden→visible transition got a ~300ms OS window fade replayed on top of it.  ## 复现 / Reproduce    把任务栏拖到屏幕顶部，右键flyenv托盘图标。  - 改动前：弹窗算出的 y 是负数（`bounds.y - 445`），整体落到屏幕外，只在屏幕顶端露出最下面一条「显示主界面 / 退出」。 - 另外每次打开都能看到整窗从半透明渐变到不透明，约 165ms。 <img width="362" height="237" alt="image" src="https://github.com/user-attachments/assets/1a18441a-6f8b-4c04-a274-ba3fc7512c00" />   ## 根因 / Root causes  1. **定位写死"任务栏在底部"**：`TrayManager.handleTrayClick` 在 Windows 上直接 `bounds.y - 445` 把弹窗放在图标上方；任务栏拖到顶部时图标 `y≈12`，算出 `y≈-433`。左右竖直任务栏同样落到屏幕外。 2. **显示后才改布局**：箭头/内边距原本是静态平台类（Windows 一律贴底边），改成四边适配后变成动态类，方向指令在 `show()` 之后才到达 → 内容平移 7px、箭头从底边跳到顶边。 3. **透明窗口的系统淡入**：Electron/Windows 对透明无边框窗口每次 hidden→visible 都会在 HWND 层重放一次约 300ms 的整窗淡入（electron#15947），DOM 层控制不了，`DWMWA_TRANSITIONS_FORCEDISABLED` 对它也无效。 4. **焦点依赖 show()**：旧代码靠 `show()` 附带激活来拿焦点，才有点弹窗外面触发 `blur` 自动关闭；改成屏外驻留后位置/透明度变更都不激活窗口，这条链路会断；关闭时若不主动交还，那个看不见的屏外窗口还会一直攥着键盘输入。  ## 改动 / Changes  - 由**任务栏所在边**决定弹窗方向（top/bottom/left/right）：托盘图标落在 `workArea` 之外的那一侧即为任务栏边；四个方向各有定位规则，首选方向放不下时退到备选，最后兜底把 y 钳进可用区。 - 方向与箭头偏移**先于显示**同步给渲染层；渲染端新增 `popup-up/down/left/right` 四个类，箭头贴在朝向图标的那条边上，偏移量按轴分别落在 `left`/`top`。 - 弹窗窗口**先在屏幕外 `showInacti

- **Issue #867** (2026-09-26): **Add plugin system MVP**
  *Symptoms*: ## Summary  Adds the first FlyEnv plugin-system MVP without changing the existing built-in module architecture.  ### Included - root-level `plugins/` development convention - `plugin.json` manifest + validation - `plugin:dev <name>` - `plugin:build <name>` - `plugin:debug <name>` - Main-process `PluginManager` - installed plugin scanning from the FlyEnv data directory - Renderer plugin loading merged into the existing `AppModules` - Fork fallback loading when `BaseManager` does not match a built-in module - Promise-based Fork plugin module cache - shared host Vue / Pinia / Vue Router runtime for Renderer plugins - plugin visibility integration in Settings → Modules - plugin-aware installed-version scanning during renderer startup - real Mailpit full-stack plugin example - plugin build/wiring test  ## Settings → Modules  Installed Renderer plugins are part of the existing module catalog and use the same `setup.common.showItem` persistence as built-in modules.  Plugin entries are explicitly marked with a **Plugin** badge and expose plugin id/version in the tooltip.  Hiding a service plugin: - persists the visibility state - hides its Aside entry - triggers the existing module visibility watcher, which stops running versions  Showing it again triggers installed-version discovery through the plugin Fork.  ## Installed-version startup scanning  Built-in modules are unchanged and still use:  ``` app-fork:version -> Version.allInstalledVersions(...) ```  Plugin modules do not modify

- **Issue #866** (2026-09-26): **fix(mysql): set root password on the right port on first start**
  *Symptoms*: This should fix #773.  On Windows the first start of a MySQL instance works like this: the data dir gets initialized with `--initialize-insecure` (so root starts out with an empty password), the server starts, and then FlyEnv sets the real password by running      mysqladmin.exe --host="127.0.0.1" -uroot password "..."  Problem: this command has no `--port`, so mysqladmin always talks to port 3306. If the instance is configured on a different port, the password init fails with `Access denied for user 'root'@'localhost' (using password: NO)` — that's exactly the log posted in #773, and you can see in that log that the command has no `--port` in it. The instance then keeps its empty password while FlyEnv keeps trying to connect with the default one, which is the "created with empty password but flyenv connects with default password" behavior from the issue.  `MariaDB/_initPassword` already handles this correctly, so I just mirrored what it does: resolve `my-<major>.<minor>.cnf`, parse the port out of it and pass `--defaults-file`, `--protocol=tcp` and `--port` to mysqladmin.  Two small things I changed while I was in there: - the init now retries 3 times (1s apart), so a server that is a bit slow to accept connections doesn't end up stuck with an empty password - the success log always printed "root" as the password, even when a custom one was set — now it prints the actual password  Added a small test script (`scripts/mysql-init-password-port-test.ts`, runs with `yarn test:mys

- **Issue #863** (2026-09-26): **fix(podman): gate Rosetta UI by version and clarify global drop-in**
  *Symptoms*: Follow-up to #855 / #800.  ## Summary  Two small usability hardenings on top of the merged #855 and the maintainer's follow-up commits (d319fc6c, 54542ea9):  1. **Version-gated Rosetta switch (UI)**: the switch is now disabled with a short tip only when the installed Podman version is *known* and below 5.1.0 (the version that introduced the `[machine] rosetta` containers.conf toggle). An empty/unknown version must **not** false-disable the switch — the backend already gates the write, and `podmanInit` may not have returned yet when the dialog opens. A `watch` resets the toggle to off if a too-old version is detected. 2. **Clarify scope**: a small tip text notes that the Rosetta preference applies as a **global** Podman preference for Apple Silicon machines (containers.conf), not a per-VM setting. 3. **Self-documenting drop-in**: the managed `flyenv-podman.conf` now carries an ASCII header comment ("Managed by FlyEnv … safe to delete"), so users who find the file in `containers.conf.d/` know where it came from and how to remove it.  ## Details  - Version parsing/comparison moved to a shared helper `src/shared/podman-rosetta.ts`, reusing the existing `compareVersions` from `src/shared/compare-versions.ts` (no new wheel). - The maintainer's XDG_CONFIG_HOME resolution and `CONTAINERS_CONF_OVERRIDE` injection from d319fc6c / 54542ea9 are kept intact. - i18n: `rosettaGlobalTip` / `rosettaNeedVersion` added to `en` and `zh`; other locales fall back to EN per convention. - Extended `

- **Issue #859** (2026-09-12): **无法安装go，所有版本都是安装不了**
  *Symptoms*: 系统环境：Windows 10 企业版 22H2 软件版本： 4.18.2  无法安装的具体表现是：点击安装后，按钮会变成loading状态，出现0%的进度条，但是没有进度变化，大概3秒左右，就直接退出了，go版本库列表好像刷新了一下  查看app日志只有这种记录 [2026/09/11 23:18:31] [info] : 开始安装Go-1.27.1 [2026/09/11 23:18:34] [info] : 开始安装Go-1.26.8 [2026/09/11 23:18:44] [info] : 开始安装Go-1.25.14 [2026/09/11 23:18:48] [info] : 开始安装Go-1.24.13 [2026/09/11 23:18:58] [info] : 开始安装Go-1.23.12 [2026/09/11 23:19:02] [info] : 开始安装Go-1.22.12 [2026/09/11 23:19:05] [info] : 开始安装Go-1.21.13  查看flyenv-debug.log文件里面也没有任何相关的日志  网络问题都尝试过了，关闭代理、全局代理都试过也是安装不了   如果我自己到官网下载，应该安装到什么目录是flyenv的默认目录
  **Post-Mortem & Fix Analysis**:
  > 1. 这个确认是网络问题, 我刚试了下, 能正常下载安装.  需要在FlyEnv的设置里添加并启用代理.  2. 不限制目录, FlyEnv里可以直接添加自定义版本, 放哪都行. 添加自定义版本时选择放的文件夹就行了.  <img width="2722" height="1800" alt="Image" src="https://github.com/user-attachments/assets/380eb963-22f0-4041-9432-9868773ac57f" />  <img width="2722" height="1800" alt="Image" src="https://github.com/user-attachments/assets/9954c8a1-165f-406c-b259-e6a4709d2516" />
  > > 1. 这个确认是网络问题, 我刚试了下, 能正常下载安装.  需要在FlyEnv的设置里添加并启用代理. > 2. 不限制目录, FlyEnv里可以直接添加自定义版本, 放哪都行. 添加自定义版本时选择放的文件夹就行了.   最后找到原因是由于没有使用管理员权限打开flyenv，感谢迅速的解答。 

- **Issue #858** (2026-09-10): **build(deps): bump sharp from 0.35.3 to 0.35.4**
  *Symptoms*: Bumps [sharp](https://github.com/lovell/sharp) from 0.35.3 to 0.35.4. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/lovell/sharp/releases">sharp's releases</a>.</em></p> <blockquote> <h2>v0.35.4</h2> <p><a href="https://github.com/lovell/sharp-libvips/releases/tag/v1.3.3">https://github.com/lovell/sharp-libvips/releases/tag/v1.3.3</a></p> <ul> <li> <p>Bound resize dimensions to coordinate limit.</p> </li> <li> <p>Bound composite left and top to coordinate limit. <a href="https://redirect.github.com/lovell/sharp/pull/4564">#4564</a> <a href="https://github.com/metsw24-max"><code>@​metsw24-max</code></a></p> </li> <li> <p>Round palette bit depth up for png and gif colours. <a href="https://redirect.github.com/lovell/sharp/pull/4569">#4569</a> <a href="https://github.com/metsw24-max"><code>@​metsw24-max</code></a></p> </li> <li> <p>Ensure tiff.subifd input option is used. <a href="https://redirect.github.com/lovell/sharp/pull/4572">#4572</a> <a href="https://github.com/metsw24-max"><code>@​metsw24-max</code></a></p> </li> <li> <p>Ensure <code>info.pages</code> is correct when limiting input page range. <a href="https://redirect.github.com/lovell/sharp/pull/4578">#4578</a> <a href="https://github.com/metsw24-max"><code>@​metsw24-max</code></a></p> </li> <li> <p>Improve support for input Streams finishing before output is requested. <a href="https://redirect.github.com/lovell/sharp/pull/4584">#4584</a> <a href="https://github.com/Jaybha

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

### Incident Patch 1: `5d7f349c` (2026-09-28)
**Commit Message**: 1. Fixed Issues

**File**: `README.md` (modified, +8/-8)
```diff
@@ -106,24 +106,24 @@ FlyEnv can manage complete local project stacks, not just one runtime.
 
 ### Windows
 
-- **Installer:** [FlyEnv-Setup-4.19.0.exe](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-Setup-4.19.0.exe)
-- **Portable:** [FlyEnv-Portable-4.19.0.exe](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-Portable-4.19.0.exe)
+- **Installer:** [FlyEnv-Setup-4.19.1.exe](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-Setup-4.19.1.exe)
+- **Portable:** [FlyEnv-Portable-4.19.1.exe](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-Portable-4.19.1.exe)
 
 ### macOS
 
 ```bash
 brew install flyenv
 ```
 
-- [FlyEnv-4.19.0.dmg (Intel)](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0.dmg)
-- [FlyEnv-4.19.0-arm64.dmg (Apple Silicon)](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-arm64.dmg)
+- [FlyEnv-4.19.1.dmg (Intel)](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1.dmg)
+- [FlyEnv-4.19.1-arm64.dmg (Apple Silicon)](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-arm64.dmg)
 
 ### Linux
 
-- [x86_64 `.deb`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-x64.deb)
-- [ARM64 `.deb`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-arm64.deb)
-- [x86_64 `.rpm`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-x64.rpm)
-- [ARM64 `.rpm`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.0/FlyEnv-4.19.0-arm64.rpm)
+- [x86_64 `.deb`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-x64.deb)
+- [ARM64 `.deb`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-arm64.deb)
+- [x86_64 `.rpm`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-x64.rpm)
+- [ARM64 `.rpm`](https://github.com/xpf0000/FlyEnv/releases/download/v4.19.1/FlyEnv-4.19.1-arm64.rpm)
 
 For the latest packages, see **[GitHub Releases](https://github.com/xpf0000/FlyEnv/releases)**.
 
```

**File**: `latest-linux-arm64.yml` (modified, +10/-10)
```diff
@@ -1,11 +1,11 @@
-version: 4.19.0
+version: 4.19.1
 files:
-  - url: FlyEnv-4.19.0-arm64.deb
-    sha512: m8KdS7r9Uc2LGKLFwUe0lfo7zya4z2Dhl3p9gvuh08tqQrO7JHw7YPLStzyQlUJnC3yV5f1hKLImrWPlC5aO1Q==
-    size: 133600396
-  - url: FlyEnv-4.19.0-arm64.rpm
-    sha512: ggewZixDuXcn1LHtKlX3n5OM9GxefDI73GjcUC0BR6F1vgJ+uThRoPrFdWaYMOxfFrZIzGoYdsvcISmwkMIoOA==
-    size: 113912601
-path: FlyEnv-4.19.0-arm64.deb
-sha512: m8KdS7r9Uc2LGKLFwUe0lfo7zya4z2Dhl3p9gvuh08tqQrO7JHw7YPLStzyQlUJnC3yV5f1hKLImrWPlC5aO1Q==
-releaseDate: '2026-09-26T05:31:44.783Z'
+  - url: FlyEnv-4.19.1-arm64.deb
+    sha512: 5uHo1fj/jQqQHVS+MvjrRXpwyVqSePczwAcRIUxYQYqLLH70QlSDUiZF9qQRo96cTsyEG88WHdEppR+sLHSnuA==
+    size: 133600736
+  - url: FlyEnv-4.19.1-arm64.rpm
+    sha512: LAXOGB723ytcQJqkWq9pqOZd0tuvuahpp634Vb1h94XeAtSJnf6lR/+Q+d4uAB7kk5tlasdWYJV8veTZcGYuOw==
+    size: 113899173
+path: FlyEnv-4.19.1-arm64.deb
+sha512: 5uHo1fj/jQqQHVS+MvjrRXpwyVqSePczwAcRIUxYQYqLLH70QlSDUiZF9qQRo96cTsyEG88WHdEppR+sLHSnuA==
+releaseDate: '2026-09-28T14:06:32.934Z'
```

**File**: `latest-linux.yml` (modified, +10/-10)
```diff
@@ -1,11 +1,11 @@
-version: 4.19.0
+version: 4.19.1
 files:
-  - url: FlyEnv-4.19.0-x64.deb
-    sha512: Hvlj0YbqduCYDBX6RBeKTtLOQlFSgepPN8UwXwgZVipumGKzp444sBjO2AR4VZ2hSNd3eFjSY9YxeSbjHH2bVQ==
-    size: 139942868
-  - url: FlyEnv-4.19.0-x64.rpm
-    sha512: 7GjIyIY3Ikr/TGMMw2kLLkp9RZzQ/V+/0QDnLRYZ4VSG55cTHytRDTmkpEDjn/6HedpkkZrlQ36F36tQ9pJnaA==
-    size: 119671625
-path: FlyEnv-4.19.0-x64.deb
-sha512: Hvlj0YbqduCYDBX6RBeKTtLOQlFSgepPN8UwXwgZVipumGKzp444sBjO2AR4VZ2hSNd3eFjSY9YxeSbjHH2bVQ==
-releaseDate: '2026-09-26T05:32:21.107Z'
+  - url: FlyEnv-4.19.1-x64.deb
+    sha512: cT3FP6/W5IEfJTJHXsMICa5zEOll2g3+OE3mKtxCH9bHtBQMXcJooEHi4pXyTH02G6pSMMKcj+N1eqeAzW5guw==
+    size: 139943444
+  - url: FlyEnv-4.19.1-x64.rpm
+    sha512: qYBlkqcGr5BtaCCcVgMyoacXpTW34YnsdlSJwTtNSpWiltJXOXwaTWGDhd+78On49zLtOHkavk0+S50reS0eug==
+    size: 119636993
+path: FlyEnv-4.19.1-x64.deb
+sha512: cT3FP6/W5IEfJTJHXsMICa5zEOll2g3+OE3mKtxCH9bHtBQMXcJooEHi4pXyTH02G6pSMMKcj+N1eqeAzW5guw==
+releaseDate: '2026-09-28T14:05:28.173Z'
```

**File**: `latest-mac-arm64.yml` (modified, +10/-10)
```diff
@@ -1,11 +1,11 @@
-version: 4.19.0
+version: 4.19.1
 files:
-  - url: FlyEnv-4.19.0-arm64-mac.zip
-    sha512: b/N7g3Y3Ric/nE7dCD0UfBg10q6/FoReyRuY/AXZpaKLcZWQe4T0paaq104cV6gvtVLzwNKrxc/P7NGyO49w5w==
-    size: 164488905
-  - url: FlyEnv-4.19.0-arm64.dmg
-    sha512: thKv143IdXc7l+4FvCO7KEknbkyFlBAeXErwBMucATZoWbEKhU6JbsfR2+r+XsSeItJiOqWGki5YwZaYr4jNZQ==
-    size: 172671432
-path: FlyEnv-4.19.0-arm64-mac.zip
-sha512: b/N7g3Y3Ric/nE7dCD0UfBg10q6/FoReyRuY/AXZpaKLcZWQe4T0paaq104cV6gvtVLzwNKrxc/P7NGyO49w5w==
-releaseDate: '2026-09-26T05:36:12.338Z'
+  - url: FlyEnv-4.19.1-arm64-mac.zip
+    sha512: t5vJfTFPjJVzVLNdVOtA+X8OmX/wPiQFtJiV/XGhYomQq7vu3p4kwKB1VcSwnPkPnwApSx375NnLcl/XT+f6gQ==
+    size: 164490437
+  - url: FlyEnv-4.19.1-arm64.dmg
+    sha512: WImL9Qt8w85kUPGQ06q/+CY4U8XaKWmSUJav/w0pX418b6vD+k/zV72FIzHODf7iqXNco7IMdRiBvmazfoRJ8w==
+    size: 172674596
+path: FlyEnv-4.19.1-arm64-mac.zip
+sha512: t5vJfTFPjJVzVLNdVOtA+X8OmX/wPiQFtJiV/XGhYomQq7vu3p4kwKB1VcSwnPkPnwApSx375NnLcl/XT+f6gQ==
+releaseDate: '2026-09-28T14:13:58.775Z'
```

**File**: `latest-mac.yml` (modified, +16/-16)
```diff
@@ -1,21 +1,21 @@
-version: 4.19.0
+version: 4.19.1
 files:
   -
-    url: FlyEnv-4.19.0-mac.zip
-    sha512: CK5bJYu7Ak7EaYQGCnrhk3dmJsyjNXV7rQc19+hpX4narmYYFs02tLCX3fQPIpssHd0nTf3DY6HhRnYnN0E8SQ==
-    size: 173907148
+    url: FlyEnv-4.19.1-mac.zip
+    sha512: OUSlUeUgSK2MBcRtLeuEpHhODK5jcM3gVyw+ledhhHhpzMAawueYCpAGkfxkOxiUAxUvOPutr8lZQDbd1BJ/GA==
+    size: 173908728
   -
-    url: FlyEnv-4.19.0-arm64-mac.zip
-    sha512: b/N7g3Y3Ric/nE7dCD0UfBg10q6/FoReyRuY/AXZpaKLcZWQe4T0paaq104cV6gvtVLzwNKrxc/P7NGyO49w5w==
-    size: 164488905
+    url: FlyEnv-4.19.1-arm64-mac.zip
+    sha512: t5vJfTFPjJVzVLNdVOtA+X8OmX/wPiQFtJiV/XGhYomQq7vu3p4kwKB1VcSwnPkPnwApSx375NnLcl/XT+f6gQ==
+    size: 164490437
   -
-    url: FlyEnv-4.19.0.dmg
-    sha512: mlhFSGSXtYqX1dXHEj/Xje3Mcxh4j6zfprjv7WJECJb519o3mLjLkDvrUqDLJ5K8dCPyzVcNxRFtIGeiNwr89g==
-    size: 182165654
+    url: FlyEnv-4.19.1.dmg
+    sha512: nXRl2tKz/7HgLDXIW9XhUAaf9qUumVssN5BCpJ/qtRycubZmOTsA+lbzE2t9z3rNdOSXp4I7yGQ9Bu5CVfyyKw==
+    size: 182156377
   -
-    url: FlyEnv-4.19.0-arm64.dmg
-    sha512: thKv143IdXc7l+4FvCO7KEknbkyFlBAeXErwBMucATZoWbEKhU6JbsfR2+r+XsSeItJiOqWGki5YwZaYr4jNZQ==
-    size: 172671432
-path: FlyEnv-4.19.0-mac.zip
-sha512: CK5bJYu7Ak7EaYQGCnrhk3dmJsyjNXV7rQc19+hpX4narmYYFs02tLCX3fQPIpssHd0nTf3DY6HhRnYnN0E8SQ==
-releaseDate: '2026-09-26T05:50:52.758Z'
+    url: FlyEnv-4.19.1-arm64.dmg
+    sha512: WImL9Qt8w85kUPGQ06q/+CY4U8XaKWmSUJav/w0pX418b6vD+k/zV72FIzHODf7iqXNco7IMdRiBvmazfoRJ8w==
+    size: 172674596
+path: FlyEnv-4.19.1-mac.zip
+sha512: OUSlUeUgSK2MBcRtLeuEpHhODK5jcM3gVyw+ledhhHhpzMAawueYCpAGkfxkOxiUAxUvOPutr8lZQDbd1BJ/GA==
+releaseDate: '2026-09-28T14:18:27.142Z'
```

---

### Incident Patch 2: `fab035c0` (2026-09-28)
**Commit Message**: 1. Fixed Issues

**File**: `build/linux.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 78
+version: 79
```

**File**: `build/macos.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 64
+version: 65
```

**File**: `build/windows.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 115
+version: 116
```

---

### Incident Patch 3: `c4463e7a` (2026-09-28)
**Commit Message**: 1. Fixed Issues

**File**: `package.json` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
     "test:go-gvm": "tsx scripts/go-gvm-test.ts",
     "test:sdkman-java-parser": "tsx scripts/sdkman-java-parser-test.ts",
     "test:node-tray-issues": "tsx scripts/node-tray-issues-test.ts",
+    "test:tray-popup-lifecycle": "tsx scripts/tray-popup-lifecycle-test.ts",
     "test:rust-windows-install": "tsx scripts/rust-windows-install-test.ts",
     "test:php-project-directory": "tsx scripts/php-project-directory-test.ts",
     "test:hermes-provider": "tsx scripts/hermes-provider-config-test.ts",
```

**File**: `scripts/node-tray-issues-test.ts` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ assert(
     /win\.on\('blur', this\.onBlur\)/.test(tray) &&
     /Date\.now\(\) - this\.lastBlurCloseAt < 350/.test(tray) &&
     !/win\.focus\(\)/.test(tray),
-  'Tray popup must close on outside click via a 250ms-delayed blur listener, without ever calling focus(): explicit focus lets the OS foreground restore close it instantly'
+  'Tray popup must close on blur and suppress the same tray click from reopening it, without forcing focus'
 )
 assert(
   /private getPopupSide\(display: Display, trayBounds: Rectangle\): TrayPopupSide \{/.test(tray) &&
```

**File**: `scripts/tray-popup-lifecycle-test.ts` (added, +244/-0)
```diff
@@ -0,0 +1,244 @@
+import assert from 'node:assert/strict'
+import { EventEmitter } from 'node:events'
+import { readFileSync } from 'node:fs'
+import * as path from 'node:path'
+import { test } from 'node:test'
+import { runInNewContext } from 'node:vm'
+import { transformSync } from 'esbuild'
+
+class PopupWindow extends EventEmitter {
+  visible = false
+  focused = false
+  destroyed = false
+  nonce = 0
+  webContents = {
+    send: (_channel: string, _command: string, _key: string, payload: { nonce: number }) => {
+      this.nonce = payload.nonce
+    }
+  }
+  isDestroyed() {
+    return this.destroyed
+  }
+  isFocused() {
+    return this.focused
+  }
+  setBounds() {}
+  setAlwaysOnTop() {}
+  moveTop() {}
+  show() {
+    this.visible = true
+    this.focused = true
+  }
+  blur() {
+    this.focused = false
+    this.emit('blur', { preventDefault() {} })
+  }
+  hide() {
+    this.visible = false
+  }
+}
+
+const loadClass = (filename: string, require: (id: string) => unknown, timers: object = {}) => {
+  const code = transformSync(readFileSync(filename, 'utf8'), {
+    loader: 'ts',
+    format: 'cjs'
+  }).code
+  const module = { exports: {} as { default: any } }
+  runInNewContext(code, {
+    module,
+    exports: module.exports,
+    require,
+    console,
+    global: { __static: '/test' },
+    __static: '/test',
+    ...timers
+  })
+  return module.exports.default
+}
+
+const setup = (windows = false) => {
+  const timers = new Map<number, { callback: () => void; delay: number }>()
+  let nextTimer = 0
+  const tray = new EventEmitter()
+  const image = { resize: () => image }
+  Object.assign(tray, {
+    setToolTip() {},
+    setContextMenu() {},
+    destroy() {},
+    getBounds: () => ({ x: 500, y: 0, width: 24, height: 24 })
+  })
+  const electron = {
+    Tray: function () {
+      return tray
+    },
+    nativeImage: { createFromPath: () => image },
+    screen: {
+      getDisplayNearestPoint: () => ({
+        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
+        workArea: { x: 0, y: 24, width: 1920, height: 1056 }
+      })
+    }
+  }
+  const Manager = loadClass(
+    'src/main/ui/TrayManager.ts',
+    (id) => {
+      if (id === 'events') return { EventEmitter }
+      if (id === 'path') return path
+      if (id === 'electron') return electron
+      if (id === '@shared/utils') return { isWindows: () => windows }
+      if (id === '@lang/runtime') return { I18nT: (key: string) => key }
+      if (id === '../core/Logger') return { default: { info() {} } }
+      throw new Error(`Unexpected dependency: ${id}`)
+    },
+    {
+      setTimeout: (callback: () => void, delay: number) => {
+        timers.set(++nextTimer, { callback, delay })
+        return nextTimer
+      },
+      clearTimeout: (id: number) => timers.delete(id)
+    }
+  )
+  const manager = new Manager()
+  const win = new PopupWindow()
+  manager.attachWindow(win)
+  const settle = () => {
+    for (const [id, timer] of [...timers]) {
+      timers.delete(id)
+      timer.callback()
+    }
+  }
+  const open = async () => {
+    const pending = manager.openPopup(400, 24, 'down', 15)
+    manager.notifyLayoutApplied(win.nonce)
+    await pending
+  }
+  return { manager, win, tray, timers, settle, open }
+}
+
+test('outside click immediately after showing closes the popup', async () => {
+  const { manager, win, open } = setup()
+  await open()
+  win.blur()
+  assert.equal(win.visible, false)
+  assert.equal(manager.show, false)
+  assert.equal(manager.clicking, false)
+})
+
+test('focus loss emitted while showing the popup is not missed', async () => {
+  const { manager, win, open } = setup()
+  const show = win.show.bind(win)
+  win.show = () => {
+    show()
+    win.blur()
+  }
+  await open()
+  assert.equal(win.visible, false)
+  assert.equal(manager.show, false)
+})
+
+test('Windows focus loss during opening cannot leave an unfocused popup visible', async () => {
+  const { manager, win, settle, open } = set
```

**File**: `src/main/Application.ts` (modified, +4/-1)
```diff
@@ -894,6 +894,9 @@ export default class Application extends EventEmitter {
   }
 
   show(page = 'index') {
+    if (page === 'index') {
+      this.trayManager?.closePopup()
+    }
     this.windowManager.showWindow(page)
   }
 
@@ -986,7 +989,7 @@ export default class Application extends EventEmitter {
     side: TrayPopupSide
   ) {
     if (show) {
-      // 布局同步(含渲染层回执)、移动、置顶、取焦点都由 TrayManager 在全透明状态下完成
+      // 布局同步、移动、显示及失焦关闭统一由 TrayManager 管理
       this.trayManager.openPopup(x, y, side, arrowOffset)
     } else {
       this.trayManager.closePopup()
```

**File**: `src/main/ui/TrayManager.ts` (modified, +39/-15)
```diff
@@ -31,6 +31,8 @@ export default class TrayManager extends EventEmitter {
   window: BrowserWindow | undefined
   private lastBlurCloseAt: number = 0
   private alwaysOnTopArmed: boolean = false
+  private popupGeneration: number = 0
+  private blurArmTimer: ReturnType<typeof setTimeout> | undefined
   private layoutNonce: number = 0
   private layoutAppliedResolver: (() => void) | undefined
   // 弹窗的设计尺寸(WindowManager 创建窗口时也是 270x435),任何 DPI 下 DIP 尺寸都恒定。
@@ -62,6 +64,7 @@ export default class TrayManager extends EventEmitter {
     }
     this.tray.on('right-click', this.handleTrayClick)
     this.tray.on('double-click', () => {
+      this.closePopup()
       this.emit('double-click')
     })
   }
@@ -177,28 +180,35 @@ export default class TrayManager extends EventEmitter {
    * 状态标志必须一起重置。
    */
   attachWindow(win: BrowserWindow) {
+    this.closePopup()
     this.window = win
     this.show = false
     this.clicking = false
     this.alwaysOnTopArmed = false
   }
 
-  /** 打开弹窗:先等渲染层应用布局,再钉住尺寸移动到目标位置、置顶并显示。
-   * 纯 show——不取焦点、不做透明度操作。显式 focus() 会引入 blur 竞态:溢出菜单
-   * 里的图标右键后系统会把前台还给之前的窗口,弹窗刚显示就被自己的 blur 关掉 */
+  /** 先同步布局再显示。失焦监听在 show 前绑定,避免漏掉打开时的失焦。
+   * Windows 给托盘菜单的前台切换留出短暂缓冲,结束时检查实际焦点。 */
   async openPopup(x: number, y: number, side: TrayPopupSide, arrowOffset: number) {
     const win = this.window
     if (!win || win.isDestroyed()) {
       return
     }
+    this.closePopup()
+    const generation = this.popupGeneration
     // 先置意图标志:布局回执是异步的,期间再次点击会得到正确的"关闭"切换
     this.show = true
     this.clicking = true
     win.removeListener('blur', this.onBlur)
     // 等渲染层真正应用了方向/箭头再显示;直接发 IPC 不等回执的话,窗口可见后
     // 布局才落地,箭头会以旧位置渲染一帧再跳变(肉眼可见的"闪一下")
     await this.syncPopupLayout(side, arrowOffset)
-    if (!this.show || win.isDestroyed()) {
+    if (
+      !this.show ||
+      generation !== this.popupGeneration ||
+      win !== this.window ||
+      win.isDestroyed()
+    ) {
       // 等待期间已被关闭(快速切换),放弃本次打开
       return
     }
@@ -211,25 +221,38 @@ export default class TrayManager extends EventEmitter {
       this.alwaysOnTopArmed = true
     }
     win.moveTop()
+    win.on('blur', this.onBlur)
+    this.clicking = isWindows()
     win.show()
-    setTimeout(() => {
-      if (!this.show || win.isDestroyed()) {
-        return
-      }
-      // 250ms 后再挂 blur:溢出菜单场景下系统在右键后立刻把前台还给之前的窗口,
-      // 这次 blur 落在武装之前自然忽略;之后用户点了弹窗外面,blur 才关窗。
-      // 先摘再挂:250ms 内快速关→开会叠加多个定时器,避免 onBlur 被注册多份
-      win.removeListener('blur', this.onBlur)
-      win.on('blur', this.onBlur)
-      this.clicking = false
-    }, 250)
+    if (isWindows() && this.show && generation === this.popupGeneration) {
+      this.blurArmTimer = setTimeout(() => {
+        this.blurArmTimer = undefined
+        if (!this.show || generation !== this.popupGeneration || win.isDestroyed()) {
+          return
+        }
+        this.clicking = false
+        // 缓冲期间的 blur 已发生,不能等待窗口再次失焦才关闭。
+        if (!win.isFocused()) {
+          this.lastBlurCloseAt = Date.now()
+          this.closePopup()
+        }
+      }, 250)
+    }
   }
 
   /** 关闭弹窗:真正 hide。隐藏窗口不存在也就谈不上拦截点击(issue #869),
    * 不做 setOpacity(0) 之类的伪隐藏,避免再次 show 时不合成画面 */
   closePopup() {
     const win = this.window
     this.show = false
+    this.clicking = false
+    this.popupGeneration += 1
+    if (this.blurArmTimer !== undefined) {
+      clearTimeout(this.blurArmTimer)
+      this.blurArmTimer = undefined
+    }
+    this.layoutAppliedResolver?.()
+    this.layoutAppliedResolver = undefined
     if (!win || win.isDestroyed()) {
       return
     }
@@ -418,6 +441,7 @@ export default class TrayManager extends EventEmitter {
   }
 
   destroy() {
+    this.closePopup()
     this.tray.removeAllListeners()
     this.tray.setContextMenu(null)
     this.tray.destroy()
```

---

### Incident Patch 4: `2a56c0bf` (2026-09-28)
**Commit Message**: 1. Fixed Issues

**File**: `build/linux.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 77
+version: 78
```

**File**: `build/macos.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 63
+version: 64
```

**File**: `build/windows.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 114
+version: 115
```

---

### Incident Patch 5: `11f42896` (2026-09-28)
**Commit Message**: 1. Fixed Issues

**File**: `src/render/style/dark.scss` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 html.dark {
-  --flyenv-sidebar-divider-color: rgba(63,63,70,1);
   --main-panel-bg-color: #282b3d;
   --base-bg-color: #1d2033;
   --base-bg-color-1: #32364a;
```

**File**: `src/render/style/theme/base-tokens.scss` (modified, +4/-0)
```diff
@@ -3,3 +3,7 @@ html.dark {
   --flyenv-color-success: #01cc74;
   --el-color-success: var(--flyenv-color-success);
 }
+
+html.dark {
+  --flyenv-sidebar-divider-color: rgba(63, 63, 70, 1);
+}
```

**File**: `src/render/tray.main.ts` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@ import './index.scss'
 // the tray falls back to Element Plus's default --el-color-success (#67c23a)
 // instead of FlyEnv green (#01cc74), so tray switches render a different green.
 import './style/theme/base-tokens.scss'
+import './style/theme/light-tokens.scss'
 import { createPinia } from 'pinia'
 import IPC from './util/IPC'
 import { AppStore } from './tray/store/app'
```

**File**: `src/render/tray/App.vue` (modified, +16/-19)
```diff
@@ -226,8 +226,7 @@
 
         .tray-menu-separator {
           margin: 4px 18px;
-          border-top: 1px solid currentColor;
-          opacity: 0.16;
+          border-top: 1px solid var(--flyenv-sidebar-divider-color);
         }
 
         > .bottom-tool {
@@ -336,25 +335,18 @@
     }
   }
   html.light {
-    --base-bg-color: #f4f5f6;
-    --base-bg-color-2: rgba(51, 68, 85, 0.2);
-    --base-bg-color-1: rgba(51, 68, 85, 0.15);
-
-    body {
-      background: var(--base-bg-color);
-    }
-
     #app {
       .popper-arrow {
-        background: var(--base-bg-color);
-        border: 1px solid var(--base-bg-color);
+        background: var(--flyenv-light-sidebar);
+        border: 1px solid var(--flyenv-light-sidebar);
       }
     }
     .tray-aside-inner {
-      background: var(--base-bg-color);
+      background: var(--flyenv-light-sidebar);
+      color: var(--flyenv-light-text);
 
       > .top-tool {
-        border-bottom: 1px solid var(--base-bg-color-1);
+        border-bottom: 1px solid var(--flyenv-light-border);
         > li {
           &:hover {
             background: var(--base-bg-color-2);
@@ -364,21 +356,26 @@
       }
 
       .menu {
-        color: #345;
+        color: var(--flyenv-light-text);
 
         li {
           &:hover {
-            background: var(--base-bg-color-1);
+            background: var(--base-bg-color-2);
           }
         }
 
         svg {
-          color: #345;
+          color: var(--flyenv-light-text);
         }
       }
+
       > .bottom-tool {
-        border-top: 1px solid var(--base-bg-color-1);
-        color: #345;
+        border-top: 1px solid var(--flyenv-light-border);
+        color: var(--flyenv-light-text);
+
+        > li:hover {
+          color: var(--flyenv-light-primary);
+        }
       }
     }
   }
```

---

### Incident Patch 6: `7b9b598c` (2026-09-28)
**Commit Message**: 1. Fix Issues

**File**: `scripts/node-tray-issues-test.ts` (modified, +22/-33)
```diff
@@ -57,9 +57,14 @@ assert(
   'Modern tray popup must use right-click only on Windows and both mouse buttons elsewhere'
 )
 assert(
-  /lastBlurCloseAt/.test(tray) &&
-    /!this\.show && Date\.now\(\) - this\.lastBlurCloseAt < 350/.test(tray),
-  'Tray click must ignore the click that follows a blur-triggered close, or the popup reopens instantly'
+  /onBlur\(event: Event\)/.test(tray) &&
+    /if \(!this\.clicking\) \{\s*this\.lastBlurCloseAt = Date\.now\(\)\s*this\.closePopup\(\)\s*\}/.test(
+      tray
+    ) &&
+    /win\.on\('blur', this\.onBlur\)/.test(tray) &&
+    /Date\.now\(\) - this\.lastBlurCloseAt < 350/.test(tray) &&
+    !/win\.focus\(\)/.test(tray),
+  'Tray popup must close on outside click via a 250ms-delayed blur listener, without ever calling focus(): explicit focus lets the OS foreground restore close it instantly'
 )
 assert(
   /private getPopupSide\(display: Display, trayBounds: Rectangle\): TrayPopupSide \{/.test(tray) &&
@@ -81,10 +86,8 @@ assert(
 )
 assert(
   /attachWindow\(win: BrowserWindow\)/.test(tray) &&
-    /this\.alwaysOnTopArmed = false/.test(tray) &&
-    /win\.setOpacity\(0\)/.test(tray) &&
     /this\.trayManager!\.attachWindow\(window\)/.test(windowManager),
-  'A rebuilt tray window must reset state flags and start fully transparent through attachWindow'
+  'A rebuilt tray window must re-bind through attachWindow so show state resets'
 )
 assert(
   /openPopup\(x: number, y: number, side: TrayPopupSide, arrowOffset: number\)/.test(tray) &&
@@ -95,31 +98,27 @@ assert(
   'Tray popup open/close must go through TrayManager'
 )
 assert(
-  /win\.setOpacity\(0\)\s*\n\s*win\.hide\(\)/.test(tray),
-  'Tray popup must fully hide() when closed: an invisible opacity-0 window still intercepts clicks (issue #869)'
-)
-assert(
-  /win\.show\(\)\s*\n\s*\}[\s\S]*?win\.setOpacity\(1\)/.test(tray),
-  'Tray popup must show() at opacity 0 and restore opacity after, so the Windows show-fade plays invisibly'
+  !/win\.setOpacity\(/.test(tray) &&
+    !/setIgnoreMouseEvents/.test(tray) &&
+    !/win\.focus\(\)/.test(tray) &&
+    !/primePopupWindow|parkPosition/.test(tray) &&
+    /win\.show\(\)/.test(tray) &&
+    /win\.hide\(\)/.test(tray),
+  'Tray popup must use plain show()/hide() with no focus/opacity/park tricks: all break display of a transparent frameless window'
 )
 assert(
   /await this\.syncPopupLayout\(side, arrowOffset\)/.test(tray) &&
     /notifyLayoutApplied\(nonce: number\)/.test(tray) &&
+    /nonce: this\.layoutNonce/.test(tray) &&
     /'APP:Tray-Popup-Layout-Applied'/.test(ipcHandler) &&
+    /IPC\.send\('APP:Tray-Popup-Layout-Applied', res\?\.nonce \?\? 0\)/.test(trayApp) &&
     !/'APP:Tray-Popup-Side'/.test(application) &&
-    !/'APP:Tray-Arrow-Offset'/.test(application) &&
-    /win\.focus\(\)[\s\S]*?win\.setOpacity\(1\)/.test(tray),
-  'Popup layout must be acknowledged by the renderer and focus must happen before the final reveal'
-)
-assert(
-  /IPC\.on\('APP:Tray-Popup-Layout'\)/.test(trayApp) &&
-    /IPC\.send\('APP:Tray-Popup-Layout-Applied', res\?\.nonce \?\? 0\)/.test(trayApp),
-  'Tray renderer must apply the combined layout message and send back the nonce ack'
+    !/'APP:Tray-Arrow-Offset'/.test(application),
+  'Popup layout must round-trip through the combined layout message with a renderer ack before showing'
 )
 assert(
-  /!this\.alwaysOnTopArmed/.test(tray) &&
-    /win\.setAlwaysOnTop\(true, 'screen-saver'\)\s*\n\s*this\.alwaysOnTopArmed = true/.test(tray),
-  'Always-on-top must be armed only once, not re-toggled on every open'
+  /IPC\.on\('APP:Tray-Popup-Layout'\)/.test(trayApp),
+  'Tray renderer must apply the combined layout message'
 )
 assert(
   !/win\.setPosition\(/.test(tray) &&
@@ -129,16 +128,6 @@ assert(
     /const size = this\.popupSize/.test(tray),
   'Popup moves must pin the size via setBounds: bare setPosition grows the window 1-2px per call on Win11 fractional DPI'
 )
-assert(
-  /win\.focus\(\)/.test(tray) &&
-    /if \(win\.isFocused\(
```

**File**: `src/main/ui/TrayManager.ts` (modified, +9/-23)
```diff
@@ -174,19 +174,18 @@ export default class TrayManager extends EventEmitter {
 
   /**
    * 绑定新建的弹窗窗口。托盘样式切换(modern→classic→modern)会销毁并重建窗口,
-   * 状态标志必须一起重置。新窗口先置全透明:openPopup 里 hidden→visible 的
-   * 系统淡入只对透明度 0 的窗口播放,首次打开也不能例外
+   * 状态标志必须一起重置。
    */
   attachWindow(win: BrowserWindow) {
     this.window = win
     this.show = false
     this.clicking = false
     this.alwaysOnTopArmed = false
-    win.setOpacity(0)
   }
 
-  /** 打开弹窗:先等渲染层应用布局,再在全透明状态下完成移动/置顶/取焦点,
-   * 最后恢复不透明——用户看到的第一帧就是最终状态,箭头跳变和焦点闪烁都被掩盖 */
+  /** 打开弹窗:先等渲染层应用布局,再钉住尺寸移动到目标位置、置顶并显示。
+   * 纯 show——不取焦点、不做透明度操作。显式 focus() 会引入 blur 竞态:溢出菜单
+   * 里的图标右键后系统会把前台还给之前的窗口,弹窗刚显示就被自己的 blur 关掉 */
   async openPopup(x: number, y: number, side: TrayPopupSide, arrowOffset: number) {
     const win = this.window
     if (!win || win.isDestroyed()) {
@@ -212,34 +211,22 @@ export default class TrayManager extends EventEmitter {
       this.alwaysOnTopArmed = true
     }
     win.moveTop()
-    if (!win.isVisible()) {
-      // Windows 会对透明窗口的 hidden→visible 重放约 300ms 整窗淡入。窗口 hide 前
-      // 已置为全透明(见 closePopup),这次淡入在不可见状态下播放,对用户无感
-      win.show()
-    }
-    // 移动/显示都不保证激活窗口,必须显式取焦点,否则"点弹窗外面自动关"的 blur
-    // 永远不会触发;焦点切换放在恢复不透明之前,激活瞬间的闪烁不可见
-    win.focus()
-    // 淡入作用于透明度 0 的窗口,这里恢复不透明,弹窗直接出现
-    win.setOpacity(1)
+    win.show()
     setTimeout(() => {
       if (!this.show || win.isDestroyed()) {
         return
       }
+      // 250ms 后再挂 blur:溢出菜单场景下系统在右键后立刻把前台还给之前的窗口,
+      // 这次 blur 落在武装之前自然忽略;之后用户点了弹窗外面,blur 才关窗。
       // 先摘再挂:250ms 内快速关→开会叠加多个定时器,避免 onBlur 被注册多份
       win.removeListener('blur', this.onBlur)
       win.on('blur', this.onBlur)
       this.clicking = false
     }, 250)
   }
 
-  /**
-   * 关闭弹窗:必须真正 hide。不能只用 setOpacity(0)/移出屏幕"伪隐藏"——
-   * 透明度为 0 的窗口依然存在且会拦截鼠标点击,系统还可能在显示器变化时把它
-   * 拉回屏内,表现为屏幕左上角一块区域点不动(issue #869)。
-   * hide 前先置全透明:Windows 会在下次 show() 时重放整窗淡入,淡入作用于
-   * 透明度 0 的窗口用户不可见,openPopup 再恢复不透明
-   */
+  /** 关闭弹窗:真正 hide。隐藏窗口不存在也就谈不上拦截点击(issue #869),
+   * 不做 setOpacity(0) 之类的伪隐藏,避免再次 show 时不合成画面 */
   closePopup() {
     const win = this.window
     this.show = false
@@ -251,7 +238,6 @@ export default class TrayManager extends EventEmitter {
       // 主动交还焦点,避免隐藏前窗口一直攥着键盘输入
       win.blur()
     }
-    win.setOpacity(0)
     win.hide()
   }
 
```

**File**: `src/render/tray/App.vue` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@
   const startupGroups = computed(() => store.startupGroups)
 
   // 弹窗相对托盘图标的边与箭头偏移,由主进程按任务栏位置一次性下发;
-  // 应用后必须回执,主进程收到回执才会把窗口恢复不透明,保证第一帧就是最终布局
+  // 应用后必须回执,主进程收到回执才会显示窗口,保证第一帧就是最终布局
   const side: Ref<TrayPopupSide> = ref<TrayPopupSide>(store.isWindows ? 'up' : 'down')
   const arrowOffset: Ref<number> = ref(15)
   IPC.on('APP:Tray-Popup-Layout').then((key: string, res: any) => {
```

---

### Incident Patch 7: `3e02a6d3` (2026-09-28)
**Commit Message**: 1. Fix Issues

**File**: `scripts/node-tray-issues-test.ts` (modified, +37/-9)
```diff
@@ -18,6 +18,7 @@ const tray = await read('src/main/ui/TrayManager.ts')
 const trayApp = await read('src/render/tray/App.vue')
 const application = await read('src/main/Application.ts')
 const windowManager = await read('src/main/ui/WindowManager.ts')
+const ipcHandler = await read('src/main/core/IPCHandler.ts')
 
 assert(
   /if \(\(tool === 'fnm' \|\| tool === 'nvm'\) && process\.platform === 'win32'\)/.test(nodeWin),
@@ -55,6 +56,11 @@ assert(
     /this\.tray\.on\('right-click', this\.handleTrayClick\)/.test(tray),
   'Modern tray popup must use right-click only on Windows and both mouse buttons elsewhere'
 )
+assert(
+  /lastBlurCloseAt/.test(tray) &&
+    /!this\.show && Date\.now\(\) - this\.lastBlurCloseAt < 350/.test(tray),
+  'Tray click must ignore the click that follows a blur-triggered close, or the popup reopens instantly'
+)
 assert(
   /private getPopupSide\(display: Display, trayBounds: Rectangle\): TrayPopupSide \{/.test(tray) &&
     /if \(trayBounds\.y < workArea\.y\) \{\s*return 'down'\s*\}/.test(tray) &&
@@ -70,23 +76,24 @@ assert(
   'Tray popup must stay inside the icon display on both axes'
 )
 assert(
-  /getPopupLayout\(\)/.test(tray) &&
-    /this\.syncTrayPopupLayout\(\)/.test(application) &&
+  /pushPopupLayout\(\)/.test(tray) &&
+    /this\.trayManager\.pushPopupLayout\(\)/.test(application) &&
     /this\.trayManager\.primePopupWindow\(\)/.test(application) &&
     /win\.setOpacity\(0\)\s*\n\s*win\.showInactive\(\)/.test(tray),
   'Tray popup must sync layout and consume the system fade off-screen before the first show'
 )
 assert(
   /attachWindow\(win: BrowserWindow\)/.test(tray) &&
     /this\.primed = false/.test(tray) &&
+    /this\.alwaysOnTopArmed = false/.test(tray) &&
     /this\.trayManager!\.attachWindow\(window\)/.test(windowManager),
-  'A rebuilt tray window must reset primed, or it would skip the off-screen fade pre-consume'
+  'A rebuilt tray window must reset primed and the always-on-top flag, or it would skip setup steps'
 )
 assert(
-  /openPopup\(x: number, y: number\)/.test(tray) &&
+  /openPopup\(x: number, y: number, side: TrayPopupSide, arrowOffset: number\)/.test(tray) &&
     /closePopup\(\)/.test(tray) &&
     /private parkPosition\(\)/.test(tray) &&
-    /this\.trayManager\.openPopup\(x, y\)/.test(application) &&
+    /this\.trayManager\.openPopup\(x, y, side, arrowOffset\)/.test(application) &&
     /this\.trayManager\.closePopup\(\)/.test(application) &&
     /this\.trayManager!\.closePopup\(\)/.test(windowManager),
   'Tray popup visibility must be implemented by moving the window on/off screen'
@@ -99,10 +106,31 @@ assert(
   'Tray popup must never call hide(): Windows replays a ~300ms fade on every hidden->visible'
 )
 assert(
-  /'APP:Tray-Popup-Side'/.test(application) &&
-    /'APP:Tray-Arrow-Offset'/.test(application) &&
-    /side: TrayPopupSide\s*\n\s*\) \{/.test(application),
-  'Main process must forward the popup side and arrow offset to the tray window'
+  /await this\.syncPopupLayout\(side, arrowOffset\)/.test(tray) &&
+    /notifyLayoutApplied\(nonce: number\)/.test(tray) &&
+    /'APP:Tray-Popup-Layout-Applied'/.test(ipcHandler) &&
+    !/'APP:Tray-Popup-Side'/.test(application) &&
+    !/'APP:Tray-Arrow-Offset'/.test(application) &&
+    /win\.focus\(\)\s*\n\s*win\.setOpacity\(1\)/.test(tray),
+  'Popup layout must be acknowledged by the renderer and focus must happen before the final reveal'
+)
+assert(
+  /IPC\.on\('APP:Tray-Popup-Layout'\)/.test(trayApp) &&
+    /IPC\.send\('APP:Tray-Popup-Layout-Applied', res\?\.nonce \?\? 0\)/.test(trayApp),
+  'Tray renderer must apply the combined layout message and send back the nonce ack'
+)
+assert(
+  /!this\.alwaysOnTopArmed/.test(tray) &&
+    /win\.setAlwaysOnTop\(true, 'screen-saver'\)\s*\n\s*this\.alwaysOnTopArmed = true/.test(tray),
+  'Always-on-top must be armed only once, not re-toggled on every open'
+)
+assert(
+  !/win\.setPosition\(/.test(tray) &&
+    /private popupSize = \{ width: 270, heig
```

**File**: `src/main/Application.ts` (modified, +3/-37)
```diff
@@ -963,7 +963,7 @@ export default class Application extends EventEmitter {
         )
         this.trayManager.addModernStyleListener()
         // 首次显示前先把弹窗方向/箭头同步给渲染层,并在屏幕外消耗掉系统的窗口淡入
-        this.syncTrayPopupLayout()
+        this.trayManager.pushPopupLayout()
         this.trayManager.primePopupWindow()
       })
 
@@ -979,50 +979,16 @@ export default class Application extends EventEmitter {
     this.ipcHandler.updateDependencies({ trayWindow: undefined })
   }
 
-  private syncTrayPopupLayout() {
-    if (!this.trayWindow) {
-      return
-    }
-    const layout = this.trayManager.getPopupLayout()
-    this.windowManager.sendCommandTo(
-      this.trayWindow,
-      'APP:Tray-Popup-Side',
-      'APP:Tray-Popup-Side',
-      layout.side
-    )
-    this.windowManager.sendCommandTo(
-      this.trayWindow,
-      'APP:Tray-Arrow-Offset',
-      'APP:Tray-Arrow-Offset',
-      layout.arrowOffset
-    )
-  }
-
   private handleTrayClick(
     x: number,
     y: number,
     arrowOffset: number,
     show: boolean,
     side: TrayPopupSide
   ) {
-    if (!this.trayWindow) {
-      return
-    }
     if (show) {
-      // 布局要先于显示下发,窗口恢复不透明后就不会再重排
-      this.windowManager.sendCommandTo(
-        this.trayWindow,
-        'APP:Tray-Popup-Side',
-        'APP:Tray-Popup-Side',
-        side
-      )
-      this.windowManager.sendCommandTo(
-        this.trayWindow,
-        'APP:Tray-Arrow-Offset',
-        'APP:Tray-Arrow-Offset',
-        arrowOffset
-      )
-      this.trayManager.openPopup(x, y)
+      // 布局同步(含渲染层回执)、移动、置顶、取焦点都由 TrayManager 在全透明状态下完成
+      this.trayManager.openPopup(x, y, side, arrowOffset)
     } else {
       this.trayManager.closePopup()
     }
```

**File**: `src/main/core/IPCHandler.ts` (modified, +3/-0)
```diff
@@ -450,6 +450,9 @@ export default class IPCHandler extends EventEmitter {
       case 'APP:Tray-Command':
         this.handleTrayCommand(command, args)
         break
+      case 'APP:Tray-Popup-Layout-Applied':
+        this.deps.trayManager.notifyLayoutApplied(args?.[0])
+        break
 
       // 开发工具
       case 'application:open-dev-window':
```

**File**: `src/main/ui/TrayManager.ts` (modified, +98/-22)
```diff
@@ -30,6 +30,15 @@ export default class TrayManager extends EventEmitter {
   clicking: boolean = false
   primed: boolean = false
   window: BrowserWindow | undefined
+  private lastBlurCloseAt: number = 0
+  private alwaysOnTopArmed: boolean = false
+  private layoutNonce: number = 0
+  private layoutAppliedResolver: (() => void) | undefined
+  // 弹窗的设计尺寸(WindowManager 创建窗口时也是 270x435),任何 DPI 下 DIP 尺寸都恒定。
+  // 所有移动都必须用 setBounds 把这个尺寸钉回去:Win11 分数缩放下裸 setPosition
+  // 每次调用都会让窗口膨胀 1~2px,弹窗会越开越大。钉常量而不是捕获 getBounds()
+  // 的原因:DPI 缩放变化后实际尺寸会漂移,每次开/关都重新钉回设计尺寸即可自动纠正
+  private popupSize = { width: 270, height: 435 }
 
   constructor() {
     super()
@@ -159,6 +168,7 @@ export default class TrayManager extends EventEmitter {
   onBlur(event: Event) {
     event.preventDefault()
     if (!this.clicking) {
+      this.lastBlurCloseAt = Date.now()
       this.closePopup()
     }
   }
@@ -172,6 +182,7 @@ export default class TrayManager extends EventEmitter {
     this.primed = false
     this.show = false
     this.clicking = false
+    this.alwaysOnTopArmed = false
   }
 
   /**
@@ -186,29 +197,44 @@ export default class TrayManager extends EventEmitter {
     }
     this.primed = true
     const park = this.parkPosition()
-    win.setPosition(park.x, park.y)
+    win.setBounds({ x: park.x, y: park.y, ...this.popupSize })
     win.setOpacity(0)
     win.showInactive()
   }
 
-  /** 打开弹窗:窗口一直"显示"着停在屏幕外,这里只移动位置、置顶并恢复不透明 */
-  openPopup(x: number, y: number) {
+  /** 打开弹窗:窗口一直"显示"着停在屏幕外。所有可能产生视觉抖动的操作(布局变更、
+   * 移动、置顶、取焦点)都在全透明状态下完成,最后才恢复不透明——用户看到的第一帧
+   * 就是最终状态,箭头跳变和焦点闪烁都被透明度掩盖 */
+  async openPopup(x: number, y: number, side: TrayPopupSide, arrowOffset: number) {
     const win = this.window
     if (!win || win.isDestroyed()) {
       return
     }
-    win.setPosition(Math.round(x), Math.round(y))
-    win.setAlwaysOnTop(true, 'screen-saver')
+    // 先置意图标志:布局回执是异步的,期间再次点击会得到正确的"关闭"切换
+    this.show = true
+    this.clicking = true
+    win.removeListener('blur', this.onBlur)
+    // 等渲染层真正应用了方向/箭头再显示;直接发 IPC 不等回执的话,窗口可见后
+    // 布局才落地,箭头会以旧位置渲染一帧再跳变(肉眼可见的"闪一下")
+    await this.syncPopupLayout(side, arrowOffset)
+    if (!this.show || win.isDestroyed()) {
+      // 等待期间已被关闭(快速切换),放弃本次打开
+      return
+    }
+    win.setBounds({ x: Math.round(x), y: Math.round(y), ...this.popupSize })
+    if (!this.alwaysOnTopArmed) {
+      // 置顶只需设置一次,每次重设都在挑动 z-order,可能引入额外闪烁
+      win.setAlwaysOnTop(true, 'screen-saver')
+      this.alwaysOnTopArmed = true
+    }
     win.moveTop()
-    win.setOpacity(1)
     if (!win.isVisible()) {
-      win.show()
+      win.showInactive()
     }
-    // 移动/改透明度都不会激活窗口,必须显式取焦点,否则"点弹窗外面自动关"的 blur 永远不会触发
+    // 移动/改透明度都不会激活窗口,必须显式取焦点,否则"点弹窗外面自动关"的 blur
+    // 永远不会触发;焦点切换放在恢复不透明之前,激活瞬间的闪烁不可见
     win.focus()
-    this.show = true
-    this.clicking = true
-    win.removeListener('blur', this.onBlur)
+    win.setOpacity(1)
     setTimeout(() => {
       if (!this.show || win.isDestroyed()) {
         return
@@ -220,6 +246,57 @@ export default class TrayManager extends EventEmitter {
     }, 250)
   }
 
+  /** 弹窗相对图标的方向与箭头偏移,供显示前先把布局同步给渲染层 */
+  getPopupLayout() {
+    const { side, arrowOffset } = this.resolvePlacement()
+    return { side, arrowOffset }
+  }
+
+  /** 把方向/箭头一次性推给渲染层(dom-ready 预热用,不等回执) */
+  pushPopupLayout() {
+    const { side, arrowOffset } = this.getPopupLayout()
+    this.sendPopupLayout(side, arrowOffset)
+  }
+
+  /** 渲染层已应用最新布局的回执,由 IPCHandler 转发 */
+  notifyLayoutApplied(nonce: number) {
+    if (nonce === this.layoutNonce) {
+      this.layoutAppliedResolver?.()
+      this.layoutAppliedResolver = undefined
+    }
+  }
+
+  /** 发送布局并等待渲染层回执;回执丢失时按超时兜底,绝不卡住打开流程 */
+  private syncPopupLayout(side: TrayPopupSide, arrowOffset: number): Promise<void> {
+    if (!this.sendPopupLayout(side, arrowOffset)) {
+      return Promise.resolve()
+    }
+    return new Promise((resolve) => {
+      const timer = setTimeout(() => {
+        this.layoutAppliedResolver = undefined
+        resolve(
```

**File**: `src/render/tray/App.vue` (modified, +9/-9)
```diff
@@ -58,18 +58,18 @@
   })
   const startupGroups = computed(() => store.startupGroups)
 
-  // 弹窗相对托盘图标的边,由主进程按任务栏位置下发;箭头贴在朝向图标的那条边上
+  // 弹窗相对托盘图标的边与箭头偏移,由主进程按任务栏位置一次性下发;
+  // 应用后必须回执,主进程收到回执才会把窗口恢复不透明,保证第一帧就是最终布局
   const side: Ref<TrayPopupSide> = ref<TrayPopupSide>(store.isWindows ? 'up' : 'down')
-  IPC.on('APP:Tray-Popup-Side').then((key: string, res: any) => {
-    if (res === 'up' || res === 'down' || res === 'left' || res === 'right') {
-      side.value = res
-    }
-  })
-
   const arrowOffset: Ref<number> = ref(15)
-  IPC.on('APP:Tray-Arrow-Offset').then((key: string, res: any) => {
-    const offset = Number(res)
+  IPC.on('APP:Tray-Popup-Layout').then((key: string, res: any) => {
+    const nextSide = res?.side
+    if (nextSide === 'up' || nextSide === 'down' || nextSide === 'left' || nextSide === 'right') {
+      side.value = nextSide
+    }
+    const offset = Number(res?.arrowOffset)
     arrowOffset.value = Number.isFinite(offset) ? offset : 15
+    IPC.send('APP:Tray-Popup-Layout-Applied', res?.nonce ?? 0)
   })
 
   const arrowStyle = computed(() => {
```

---

### Incident Patch 8: `acaf4fbc` (2026-09-27)
**Commit Message**: 1. Fixed Issues

**File**: `RELEASE_NOTES.md` (modified, +28/-0)
```diff
@@ -2,6 +2,34 @@
 
 All notable changes to FlyEnv will be documented in this file.
 
+## [4.19.1] - 2026-09-27
+
+# **FlyEnv v4.19.1 Update Release Notes**
+
+## **🛠️ Improvements & Bug Fixes**
+
+### **1. Fixed Invisible Tray Window Blocking Mouse Clicks on macOS**
+
+Resolved an issue where, after updating to v4.19.0, an invisible FlyEnv window could sit above all other applications and intercept mouse clicks. The affected area extended from the top-left corner of the screen down the left side, making windows, buttons, links, and desktop icons in that zone unclickable until FlyEnv was fully closed.
+
+The cause was the tray popup's "fake hide" mechanism: instead of truly hiding, the popup window was made fully transparent and parked off-screen. A transparent window still intercepts mouse input, and macOS can move off-screen windows back onto the display — leaving an invisible overlay blocking the top-left area. The tray popup now truly hides with the native window-hide call. It is set to fully transparent right before hiding, so the system window fade that Windows replays on transparent windows still plays invisibly, and full opacity is restored when the popup appears — no click blocking, and no visible fade.
+
+Thanks to [@dkoychev](https://github.com/dkoychev) for the report! [Issue #869](https://github.com/xpf0000/FlyEnv/issues/869)
+
+---
+
+## **📦 Build & Transparency**
+
+All FlyEnv installation packages are built using **[GitHub Actions](https://github.com/xpf0000/FlyEnv/actions)**. You can verify the build process and download the artifacts directly from the following links:
+
+- **Global Build History:** [GitHub Actions](https://github.com/xpf0000/FlyEnv/actions)
+
+---
+
+We welcome your continued feedback and bug reports via [GitHub Issues](https://github.com/xpf0000/FlyEnv/issues)
+
+**Enjoy the update!**
+
 ## [4.19.0] - 2026-09-26
 
 # **FlyEnv v4.19.0 Update Release Notes**
```

---

### Incident Patch 9: `ec6f40ec` (2026-09-27)
**Commit Message**: 1. Fixed Issues

**File**: `build/windows.build.yml` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version: 113
+version: 114
```

**File**: `docs/task/TASK-RELEASE.md` (modified, +2/-6)
```diff
@@ -1,11 +1,7 @@
-# FlyEnv新版本4.18.3更新日志
+# FlyEnv新版本4.19.1更新日志
 
 本次更新内容：
-1. 新增插件市场.
-2. 插件市场新增kafka插件
-3. https://github.com/xpf0000/FlyEnv/pull/863
-4. https://github.com/xpf0000/FlyEnv/pull/866
-5. https://github.com/xpf0000/FlyEnv/pull/868
+1. 修复https://github.com/xpf0000/FlyEnv/issues/869
 
 参照：
 ```
```

---

### Incident Patch 10: `b9a506ef` (2026-09-27)
**Commit Message**: 1. Fixed Issues

**File**: `configs/electron-builder.linux.ts` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ const desktop: any = {
 const conf: Configuration = {
   productName: 'FlyEnv',
   executableName: 'FlyEnv',
-  buildVersion: '4.19.0',
+  buildVersion: '4.19.1',
   electronVersion: '39.8.10',
   appId: 'com.xpf0000.flyenv',
   asar: true,
```

**File**: `configs/electron-builder.ts` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ const ptyPrebuildExcludes = [
 const conf: Configuration = {
   productName: 'FlyEnv',
   executableName: 'FlyEnv',
-  buildVersion: '4.19.0',
+  buildVersion: '4.19.1',
   electronVersion: '39.8.10',
   appId: 'phpstudy.xpfme.com',
   asar: true,
```

**File**: `configs/electron-builder.win.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import AfterSign from '../build/afterSign'
 const conf: Configuration = {
   productName: 'FlyEnv',
   executableName: 'FlyEnv',
-  buildVersion: '4.19.0',
+  buildVersion: '4.19.1',
   electronVersion: '39.8.10',
   appId: 'phpstudy.xpfme.com',
   asar: true,
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "FlyEnv",
-  "version": "4.19.0",
+  "version": "4.19.1",
   "description": "All-In-One Full-Stack Environment Management Tool",
   "author": {
     "name": "Pengfei Xu",
```

**File**: `scripts/node-tray-issues-test.ts` (modified, +10/-14)
```diff
@@ -70,33 +70,29 @@ assert(
   'Tray popup must stay inside the icon display on both axes'
 )
 assert(
-  /getPopupLayout\(\)/.test(tray) &&
-    /this\.syncTrayPopupLayout\(\)/.test(application) &&
-    /this\.trayManager\.primePopupWindow\(\)/.test(application) &&
-    /win\.setOpacity\(0\)\s*\n\s*win\.showInactive\(\)/.test(tray),
-  'Tray popup must sync layout and consume the system fade off-screen before the first show'
+  /getPopupLayout\(\)/.test(tray) && /this\.syncTrayPopupLayout\(\)/.test(application),
+  'Tray popup must sync layout before the first show'
 )
 assert(
   /attachWindow\(win: BrowserWindow\)/.test(tray) &&
-    /this\.primed = false/.test(tray) &&
     /this\.trayManager!\.attachWindow\(window\)/.test(windowManager),
-  'A rebuilt tray window must reset primed, or it would skip the off-screen fade pre-consume'
+  'A rebuilt tray window must re-bind through attachWindow so show state resets'
 )
 assert(
   /openPopup\(x: number, y: number\)/.test(tray) &&
     /closePopup\(\)/.test(tray) &&
-    /private parkPosition\(\)/.test(tray) &&
     /this\.trayManager\.openPopup\(x, y\)/.test(application) &&
     /this\.trayManager\.closePopup\(\)/.test(application) &&
     /this\.trayManager!\.closePopup\(\)/.test(windowManager),
-  'Tray popup visibility must be implemented by moving the window on/off screen'
+  'Tray popup open/close must go through TrayManager'
 )
 assert(
-  !/win\.hide\(\)/.test(tray) &&
-    /bindCloseToHide && !this\.willQuit\) \{\s*event\.preventDefault\(\)\s*\/\/[^\n]*\n\s*this\.trayManager!\.closePopup\(\)/.test(
-      windowManager
-    ),
-  'Tray popup must never call hide(): Windows replays a ~300ms fade on every hidden->visible'
+  /win\.setOpacity\(0\)\s*\n\s*win\.hide\(\)/.test(tray),
+  'Tray popup must fully hide() when closed: an invisible opacity-0 window still intercepts clicks (issue #869)'
+)
+assert(
+  /win\.show\(\)\s*\n\s*\}[\s\S]*?win\.setOpacity\(1\)/.test(tray),
+  'Tray popup must show() at opacity 0 and restore opacity after, so the Windows show-fade plays invisibly'
 )
 assert(
   /'APP:Tray-Popup-Side'/.test(application) &&
```

#### Recent Merged Pull Requests:
- **PR #871** (closed): feat: 将数据库启动参数改为读取配置 (@ieras)
- **PR #868** (2026-09-26): fix(tray): keep popup visible on every taskbar edge (@darius-gs)
- **PR #867** (2026-09-26): Add plugin system MVP (@xpf0000)
- **PR #866** (2026-09-26): fix(mysql): set root password on the right port on first start (@ulusoyomer)
- **PR #863** (2026-09-26): fix(podman): gate Rosetta UI by version and clarify global drop-in (@YoloCyber)
- **PR #858** (2026-09-10): build(deps): bump sharp from 0.35.3 to 0.35.4 (@dependabot[bot])
- **PR #855** (2026-09-10): fix(podman): replace invalid --rosetta flag with containers.conf drop-in (@YoloCyber)
- **PR #854** (2026-09-10): build(deps): bump hono from 4.13.1 to 4.13.7 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
