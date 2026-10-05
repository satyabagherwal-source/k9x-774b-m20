# Forensic Learning Record (Deep Inspection): tusen-ai/naive-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/tusen-ai-naive-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tusen-ai/naive-ui](https://github.com/tusen-ai/naive-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:18:28.797Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tusen-ai/naive-ui`
- **Description**: A Vue 3 Component Library. Fairly Complete. Theme Customizable. Uses TypeScript. Fast.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 18568 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demo/utils/ComponentDemos.tsx`
```
import { computed, defineComponent, Fragment, h } from 'vue'
import { useIsMobile, useIsSmallDesktop, useIsTablet } from './composables'

export default defineComponent({
  name: 'ComponentDemos',
  props: {
    span: {
      type: Number,
      default: 2
    }
  },
  setup(props) {
    const isMobileRef = useIsMobile()
    const isTabletRef = useIsTablet()
    const isSmallDesktop = useIsSmallDesktop()
    const mergedColsRef = computed(() => {
      return isMobileRef.value || isTabletRef.value || isSmallDesktop.value
        ? 1
        : props.span
    })
    return {
      mergedCols: mergedColsRef
    }
  },
  render() {
    const children = this.$slots.default?.() ?? []
    const { mergedCols } = this
    return (
      <div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns:
            mergedCols === 1 ? '100%' : 'minmax(0, 1fr) minmax(0, 1fr)',
          alignItems: 'flex-start'
        }}
      >
        {mergedCols === 1 ? (
          children
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gap: '16px',
                gridTemplateColumns: '100%'
              }}
            >
              {children.filter((_, index) => index % 2 === 0)}
            </div>
            <div
              style={{
                display: 'grid',
                gap: '16px',
                gridTemplateColumns: '100%'
              }}
            >
              {children.filter((_, index) => index % 2 === 1)}
            </div>
          </>
        )}
      </div>
    )
  }
})

```

### Core Architecture Module: `demo/utils/codesandbox.js`
```
import { getParameters } from 'codesandbox/lib/api/define'

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Naive UI Demo</title>
    <style>
      body {
        padding: 24px;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`

const appVue = `<template>
<n-loading-bar-provider>
  <n-message-provider>
    <n-notification-provider>
      <n-modal-provider>
        <n-dialog-provider>
          <demo />
        </n-dialog-provider>
      </n-modal-provider>
    </n-notification-provider>
  </n-message-provider>
</n-loading-bar-provider>
</template>

<script>
import { defineComponent } from "vue";
import Demo from "./Demo.vue";

export default defineComponent({
components: {
  Demo,
},
});
</script>`

const mainJs = `import { createApp } from "vue";
import naive from "naive-ui";
import App from "./App.vue";

const app = createApp(App);

app.use(naive);

app.mount("#app");
`

function getDeps(code) {
  return (code.match(/from '([^']+)'\n/g) || [])
    .map(v => v.slice(6, v.length - 2))
    .reduce((prevV, dep) => {
      prevV[dep] = 'latest'
      return prevV
    }, {})
}

export function getCodeSandboxParams(code) {
  return getParameters({
    files: {
      'package.json': {
        content: {
          dependencies: {
            ...getDeps(code),
            vue: 'latest',
            'vue-router': 'latest',
            'naive-ui': 'latest'
          },
          devDependencies: {
            '@vue/cli-plugin-babel': '~4.5.0',
            typescript: '~4.6.3'
          }
        }
      },
      'index.html': {
        content: indexHtml
      },
      'src/Demo.vue': {
        content: code
      },
      'src/App.vue': {
        content: appVue
      },
      'src/main.js': {
        content: mainJs
      }
    }
  })
}

```

### Core Architecture Module: `demo/utils/composables.js`
```
import { useBreakpoint, useMemo } from 'vooks'
import { inject, provide, reactive, toRef, watchEffect } from 'vue'

export function useIsMobile() {
  const breakpointRef = useBreakpoint()
  return useMemo(() => {
    return breakpointRef.value === 'xs'
  })
}

export function useIsTablet() {
  const breakpointRef = useBreakpoint()
  return useMemo(() => {
    return breakpointRef.value === 's'
  })
}

export function useIsSmallDesktop() {
  const breakpointRef = useBreakpoint()
  return useMemo(() => {
    return breakpointRef.value === 'm'
  })
}

export function i18n(data) {
  const localeReactive = inject('i18n', null)
  return {
    locale: toRef(localeReactive, 'locale'),
    t(key) {
      const { locale } = localeReactive
      return data[locale][key]
    }
  }
}

i18n.provide = function (localeRef) {
  const localeReactive = reactive({})
  watchEffect(() => {
    localeReactive.locale = localeRef.value
  })
  provide('i18n', localeReactive)
}

```

### Core Architecture Module: `demo/utils/composables.ts`
```
import { useBreakpoint, useMemo } from 'vooks'
import { inject, provide, reactive, toRef, watchEffect } from 'vue'

export function useIsMobile() {
  const breakpointRef = useBreakpoint()
  return useMemo(() => {
    return breakpointRef.value === 'xs'
  })
}

export function useIsTablet() {
  const breakpointRef = useBreakpoint()
  return useMemo(() => {
    return breakpointRef.value === 's'
  })
}

export function useIsSmallDesktop() {
  const breakpointRef = useBreakpoint()
  return useMemo(() => {
    return breakpointRef.value === 'm'
  })
}

export function i18n(data: Record<string, Record<string, string>>) {
  const localeReactive = inject<{ locale: string } | null>('i18n', null)
  if (!localeReactive) {
    throw new Error('i18n context not provided')
  }
  return {
    locale: toRef(localeReactive, 'locale'),
    t(key) {
      const { locale } = localeReactive
      return data[locale][key]
    }
  }
}

i18n.provide = function (localeRef) {
  const localeReactive = reactive<{ locale: string }>({ locale: '' })
  watchEffect(() => {
    localeReactive.locale = localeRef.value
  })
  provide('i18n', localeReactive)
}

```

### Core Architecture Module: `demo/utils/github-url.js`
```
export const repoUrl = 'https://github.com/tusen-ai/naive-ui'
export const blobUrl = `${repoUrl}/blob/main/`

```

### Core Architecture Module: `demo/utils/playground.js`
```
export const playgroundUrl = 'https://play-naive.pro-components.cn'
export const appCode = `<template>
  <n-config-provider>
    <n-loading-bar-provider>
      <n-message-provider>
        <n-notification-provider>
          <n-modal-provider>
            <n-dialog-provider>
              <Demo />
            </n-dialog-provider>
          </n-modal-provider>
        </n-notification-provider>
      </n-message-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import Demo from './Demo.vue'
</script>
`

```

### Core Architecture Module: `demo/utils/route.js`
```
export function findMenuValue(options, path) {
  for (const option of options) {
    if (option.children) {
      const value = findMenuValue(option.children, path)
      if (value)
        return value
    }
    if (option.path === path) {
      return option.key
    }
  }
  return undefined
}

```

### Core Architecture Module: `scripts/utils/collect-vars.ts`
```
const pattern = /var\(([^)]+)\)/g
const patternDetail = /var\(([^)]+)\)/
const commentPattern = /^( *)(\*|(\S\S)|(\S\*))/g

export function collectVars(code: string): string[] {
  const vars = new Set<string>()
  const lines = code.split('\n')
  lines.forEach((line) => {
    if (line.match(commentPattern)) {
      return
    }
    const result = line.match(pattern)
    if (result) {
      result.forEach((varExpr) => {
        const match = varExpr.match(patternDetail)
        if (match)
          vars.add(match[1])
      })
    }
  })
  return Array.from(vars).sort()
}

export function genDts(vars: string[]): string {
  console.log(vars)
  return `interface CssVars {
${vars.map(v => `  '${v}': string`).join('\n')}
}`
}

```

### Core Architecture Module: `scripts/utils/index.ts`
```
import { promises as fs } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

export async function* walk(dir: string): AsyncGenerator<string> {
  for await (const d of await fs.opendir(dir)) {
    const entry = join(dir, d.name)
    if (d.isDirectory()) {
      yield* walk(entry)
    }
    else if (d.isFile()) {
      yield entry
    }
  }
}

export const outDirs = ['es', 'lib'].map(d => resolve(process.cwd(), d))

export const srcDir = resolve(process.cwd(), 'src')

export { replaceDefine } from './replace-define'

```

### Core Architecture Module: `scripts/utils/loader.ts`
```
import type { TokensList } from 'marked'
import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import { marked } from 'marked'

const fileRegex = /\.demo\.md$/

interface DemoParts {
  template: string | null
  script: string | null
  style: string | null
  title: string | null
  content: string | null
}

interface FileInfo {
  path: string
  dir: string
  file: string
  name: string
}

function getPartsOfMdDemo(tokens: TokensList): DemoParts {
  let template = null
  let script = null
  let style = null
  let title = null
  let content = null
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 1) {
      title = token.text
    }
    else if (
      token.type === 'code'
      && (token.lang === 'template' || token.lang === 'html')
    ) {
      template = token.text
    }
    else if (
      token.type === 'code'
      && (token.lang === 'script' || token.lang === 'js' || token.lang === 'ts')
    ) {
      script = token.text
    }
    else if (
      token.type === 'code'
      && (token.lang === 'style' || token.lang === 'css')
    ) {
      style = token.text
    }
    else if (token.type === 'paragraph') {
      content = token.text
    }
  }
  return {
    template,
    script,
    style,
    title,
    content
  }
}

function createBlockTemplate(
  tag: string,
  content: string,
  attrs?: Record<string, string>
): string {
  const attrsStr = attrs
    ? Object.keys(attrs).reduce((attrsStr, key) => {
        return `${attrsStr} ${key}="${attrs[key]}"`
      }, '')
    : ''
  return `<${tag}${attrsStr}>\n${content}\n</${tag}>`
}

async function loadFile(filepath: string): Promise<string | undefined> {
  if (fs.existsSync(filepath)) {
    return await fs.readFile(filepath, 'utf-8')
  }
  return undefined
}

async function loadAllMdFile(filePathArr: string[]): Promise<FileInfo[]> {
  const filesArr: FileInfo[] = []
  for (let i = 0; i < filePathArr.length; i++) {
    const filePath = filePathArr[i]
    if (fs.existsSync(filePath)) {
      const files = await fs.readdir(filePath)
      const filesObjArr = files
        .filter(file => fileRegex.test(file))
        .map((file) => {
          const index = file.lastIndexOf('.')
          return {
            path: `${filePath}/${file}`,
            dir: filePath,
            file,
            name: file.slice(0, index)
          }
        })
      filesArr.push(...filesObjArr)
    }
  }
  return filesArr
}

async function updateIndexEntryDemo(file: FileInfo): Promise<void> {
  let indexFileContent = await loadFile(
    path.resolve(file.dir, './index.demo-entry.md')
  )
  if (indexFileContent) {
    const index = file.name.indexOf('.')
    const name = file.name.slice(0, index)
    indexFileContent = indexFileContent.replace(name, `${name}.vue`)
    fs.writeFileSync(
      path.resolve(file.dir, './index.demo-entry.md'),
      indexFileContent
    )
  }
}

const LINE_SPACE = '\n\n'
async function transformMdToVueAndUpdateEntryFile(
  files: FileInfo[]
): Promise<void> {
  for (const file of files) {
    const fileString = await loadFile(file.path)
    if (fileString) {
      const tokens = marked.lexer(fileString)
      const parts = getPartsOfMdDemo(tokens)
      const vueDemoBlocks: string[] = []
      if (parts.title || parts.content) {
        vueDemoBlocks.push(
          createBlockTemplate(
            'markdown',
            `# ${parts.title}${parts.content ? `${LINE_SPACE}${parts.content}` : ''}`
          )
        )
      }
      if (parts.template) {
        vueDemoBlocks.push(createBlockTemplate('template', parts.template))
      }
      if (parts.script) {
        vueDemoBlocks.push(
          createBlockTemplate('script', parts.script, {
            lang: 'ts'
          })
        )
      }
      if (parts.style) {
        vueDemoBlocks.push(createBlockTemplate('style', parts.style))
      }
      await fs.remove(file.path)
      await fs.ensureDir(file.dir)
      fs.writeFileSync(
        path.resolve(file.dir, `./${file.name}.vue`),
        `${vueDemoBlocks.join(LINE_SPACE)}\n`
      )
      // should be able to be modified together
      await updateIndexEntryDemo(file)
    }
  }
}

const COMPONENT_ROOT = path.resolve(process.cwd(), 'src')

export async function convertFilesByComponentName(
  componentName: string
): Promise<void> {
  const folders = ['zhCN', 'enUS'].map(item =>
    path.resolve(COMPONENT_ROOT, `${componentName}/demos/${item}`)
  )
  if (folders.length) {
    const files = await loadAllMdFile(folders)
    transformMdToVueAndUpdateEntryFile(files)
  }
}

```

### Core Architecture Module: `scripts/utils/replace-define.ts`
```
import { promises as fs } from 'node:fs'
import { walk } from '.'

export async function replaceDefine(
  dirs: string[],
  defines: Record<string, string>
): Promise<void> {
  const defineKeys = Object.keys(defines)
  const patterns: Record<string, RegExp> = {}
  defineKeys.forEach((key) => {
    patterns[key] = new RegExp(key, 'g')
  })
  for (const dir of dirs) {
    for await (const p of walk(dir)) {
      if (p.endsWith('.vue'))
        continue
      let code = await fs.readFile(p, 'utf-8')
      for (const key of defineKeys) {
        const pattern = patterns[key]
        if (pattern.test(code)) {
          code = code.replace(pattern, defines[key])
        }
      }
      await fs.writeFile(p, code)
    }
  }
}

```

### Core Architecture Module: `src/_utils/color/index.ts`
```
import { composite } from 'seemly'

export function createHoverColor(rgb: string): string {
  return composite(rgb, [255, 255, 255, 0.16])
}

export function createPressedColor(rgb: string): string {
  return composite(rgb, [0, 0, 0, 0.12])
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8191** (2026-08-21): **Ellipsis 组件 bug**
  *Symptoms*: ### 描述错误  引入 naive-ui 版本大于等于2.45.0 后，会触发错误 ``` runtime-core.esm-bundler.js:268  Uncaught TypeError: handleClickRef.value is not a function ```  当引入 naive-ui版本小于2.45.0，则没有问题  ### 复现步骤   # 这是引入版本号大于等于2.45.0 的 naive-ui  打包后的文件 ## naive-ui/es/ellipsis/src/Ellipsis.mjs ```javascript  const handleClickRef = computed(() => {       return props.expandTrigger === "click" ? () => {         const {           value: expanded         } = expandedRef;         if (expanded) tooltipRef.value?.setShow(false);         expandedRef.value = !expanded;       } : void 0;     });     onDeactivated(() => {       if (props.tooltip) tooltipRef.value?.setShow(false);     });     const renderTrigger = () => (() => {       const _cache = createVNodeCache("c61f52eafd841df5");       return openBlock(), createElementBlock("span", mergeProps(mergeProps(attrs, {         class: [`${mergedClsPrefixRef.value}-ellipsis`, props.lineClamp !== void 0 ? createLineClampClass(mergedClsPrefixRef.value) : void 0, props.expandTrigger === "click" ? createCursorClass(mergedClsPrefixRef.value, "pointer") : void 0],         style: ellipsisStyleRef.value       }), {         ref: "triggerRef",         onClick: _cache[0] || (_cache[0] = (...args) => handleClickRef.value(...args)),         onMouseenter: _cache[1] || (_cache[1] = props.expandTrigger === "click" ? getTooltipDisabled : void 0)       }), [props.lineClamp ? (openBlock(), createElementBlock(Fragment, {         key: 0       }, [normalizeVNode(() => slots.default?.())], 6

- **Issue #8188** (2026-08-21): **<n-model /> positive-click prop doesn't work**
  *Symptoms*: ### Describe the bug  <n-modal @positive-click="" />  positive-click doesn't work. naive-ui@2.45.0  ### Steps to reproduce  <template>   <n-button @click="showModal = true">     来吧   </n-button>   <n-modal     v-model:show="showModal"     preset="dialog"     title="确认"     content="你确认?"     positive-text="确认"     negative-text="算了"     @positive-click="submitCallback"   /> </template>  <script setup lang="ts"> import { useMessage } from 'naive-ui' import { ref } from 'vue'  const message = useMessage() const showModal = ref(false)  function submitCallback() {   message.success('Submit') } </script>   positive-click doesn't work.  ### Link to minimal reproduction  https://play-naive.pro-components.cn/#eNqVk81uEzEUhV/F8iap1CQLWEUpFEoXIBUQZTkbx/FM3XjskX/SSFG2rNmxQgIJxC4PgMTblJ/H4F47M50200jdZe537rWvz8mKPquq4SIIOqYTL8pKMS+eZJqQiR5wo3NZDCprFnImbCxHoAybSV0MpszepZGXwjlWiF0WqTZe5pIzL43ukqQRZsZUN418JpkyO3drSV6I0pDR3cbR/k7k956McP/dY3v37ojufTaEu489GbUMgU/Hraw8ccKHiiimi6OMepdRoLKsjPUk7pxbU5LecIQf6GwPJ6VeUNJDWoMuy6fBe6PJMVeSz2G+uzBXZ/gg5Ih4G0Q8Dff58/n7748/6suntnpIfMEkW+CHUGOc0x6X0cQrK2AfIMmVuuylVwKqf79u/m2+1VV4Ii80qq9/fUnoaTPIOOnlQgy8WKLidqcWBVjWoptP1z8/1PS4aW7WDtNS+hOm1JTxedJhlh5uyYoEJ85SJsh6a45meFiQYE0jsyJveHIt07Cw82SbKHDgZlT/oKZth2BGP2fKCaCZzoPmmFNye5v+AVnhPtuxQxc4h5/93nmU9aB33YoMBMa7FM7hpTMaUhPbM8pNWUkl7JsKT4Gtx2kwMjjLXL2KNYzNYV3nF4LPO+qXbom1jL7FQNgFBK1hntlC+IRPz1+Dgy0I8QoK1HvgO+GMCnjHJHse9Ayu3dLF276MTsD/8707XULOXL1UzD0o11GfUXDnZM/qN9d9NHwc++BB6fo/LAjV5Q==  ### System Info  ```Shell w
  **Post-Mortem & Fix Analysis**:
  > fixed in the latest version

- **Issue #8186** (2026-08-19): **useDialog onPositiveClick got Array**
  *Symptoms*: ### 描述错误  2.44.1 无此问题，2.45.0 存在，传入 Function 被识别为 Array，不传此字段则不会报错  ### 复现步骤  ```javascript   const Dialog = useDialog()   console.log(config)   console.log(Dialog[mode](config)) ```  <img width="802" height="688" alt="Image" src="https://github.com/user-attachments/assets/a558f9d2-98bd-4f6d-ab26-b6f06549d66d" />  ### 最小复现链接  https://play.pro-components.cn/#eNp9krFu2zAQhl+F4BIHiKShnQzZQOtkaIc0aDtqYaWzwoQiCZJSjAp699xRsaw4iheC5Pcf7+4/9vybtWnXAl/zPEBjlQiwLTRjuXUmKY3eyzrBbScrcGytTCkUbAr+/3F3X/CoRK1OlBGV1HXyT7hJ/kYjb8B7UcNHFqk2Qe5lKYI0ekkyPmEqoZZp5JUUypyKPROg5BYaw7LzwOxyJPFPMxO8XHsMX+6d0Ke25dmC/0jybDYlPPrSSRuYh9BapoSucTbBx8nIxhoXWM9oVmxge2cadkXPaiE7SFp5NYmiNaMgzehAfwJxno0J8Dl+w4+APss8cax4Std6uI2GTjln+UiJXXlMOWo2J/3qmui4T1+E0+jMqmdGPxgvAz6xU7J8XrPVNdtsWT+wAQNmFeLh/ReuZLfNM1rPjMNegh/NTZ+80dhQTxEFL01jpQL3y9I80cg1i4SYUMq8/Ix3wbVwc7wvH6F8Xrh/8ge6K/iDAw+ug4JPLAhXQxjx3Z97OOB+gvjfWoXqC/A3eKNaqnGUfW91hWXPdLHaH3Eo6ONff3cIoP2xKSqUlEPUFxynurvQ+qncL+nXGFfogQ+vespjSQ==  ### 系统信息  ```Shell Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 ```  ### 使用的包管理器  pnpm  ### 验证  - [x] 阅读 [贡献指南](https://github.com/tusen-ai/naive-ui/blob/main/CONTRIBUTING.zh-CN.md)。 - [x] 阅读 [文档](https://www.naiveui.com/zh-CN/)。 - [x] 检查是否已经存在[相同问题的问题](https://github.com/tusen-ai/naive-ui/issues)，以避免创建重复的问题。 - [x] 确保这是一个具体的 bug。有关问题和答案，请打开 [GitHub 讨论](https://github.com/tusen-ai/naive-ui/discussions)。 - [x] 提供的复现是[最小可复现的示例](https://stackoverflow.com/help/mi
  **Post-Mortem & Fix Analysis**:
  > 我也遇到这个问题，回退到2.44.1就好了
  > Root cause confirmed — this is a duplicate `onPositiveClick` prop being merged into an array by Vue, not a type regression.  ### Mechanism  `DialogEnvironment.tsx` spreads the user's props and then re-declares the same handler:  ```tsx <NDialog   {...keep(this.$props, dialogPropKeys)}   // <- already contains the user's onPositiveClick   titleClass={...}   style={this.internalStyle}   onClose={handleCloseClick}   onNegativeClick={handleNegativeClick}   onPositiveClick={handlePositiveClick}    // <- second one, same key /> ```  `dialogPropKeys` is `keysOf(dialogProps)`, and `dialogProps` declares `onPositiveClick` (`dialogProps.ts:39`), so the user's handler is included in the spread. JSX compiles the spread + explicit prop into `mergeProps`, and for any key matching `isOn()` Vue concatenates instead of overwriting (`runtime-core/src/vnode.ts:907-916`):  ```js } else if (isOn(key)) {   const existing = ret[key]   const incoming = toMerge[key]   if (incoming && existing !== incoming && !
  > 我也查出这个问题： **naive-ui 版本**：2.45.0（2026-08-16 发布） **Vue 版本**：3.5.41 **回归**：2.44.1 完全正常  ### 症状  所有通过 `useDialog()` / `createDiscreteApi` 创建的对话框，只要传了回调，点击确定/取消按钮或关闭时即报错：  ``` Uncaught TypeError: onPositiveClick is not a function Uncaught TypeError: onNegativeClick is not a function Uncaught TypeError: onClose is not a function [Vue Warn] Invalid prop: type check failed for prop "onPositiveClick". Expected Function, got Array ```  ### 根因  `DialogEnvironment.mjs` 在 2.44.1 → 2.45.0 之间改了渲染逻辑：  **2.44.1**（正常 —— 覆盖语义，用户回调由 DialogEnvironment 层调用）： ```js h(NDialog, Object.assign({}, keep(this.$props, dialogPropKeys), {   onClose: handleCloseClick,   onNegativeClick: handleNegativeClick,   onPositiveClick: handlePositiveClick }), null, 16, ...) ```  **2.45.0**（异常）： ```js createBlock(NDialog, mergeProps(keep(this.$props, dialogPropKeys), {   onClose: handleCloseClick,   onNegativeClick: handleNegativeClick,   onPositiveClick: handlePositiveClick }), null, 16, ...) ```  `keep(this.$props, dialogProp

- **Issue #7528** (2026-03-15): **color picker行为改变**
  *Symptoms*: ### 描述错误  更新之后color picker组件传递的style 、click事件均不生效 Extraneous non-props attributes (style) were passed to component but could not be automatically inherited because component renders fragment or text or teleport root nodes.   ### 复现步骤  <n-color-picker style="margin-top: 8px"/>  ### 最小复现链接  /  ### 系统信息  ```Shell windows10 chrome145 naive-ui v2.44.1 ```  ### 使用的包管理器  pnpm  ### 验证  - [x] 阅读 [贡献指南](https://github.com/tusen-ai/naive-ui/blob/main/CONTRIBUTING.zh-CN.md)。 - [x] 阅读 [文档](https://www.naiveui.com/zh-CN/)。 - [x] 检查是否已经存在[相同问题的问题](https://github.com/tusen-ai/naive-ui/issues)，以避免创建重复的问题。 - [x] 确保这是一个具体的 bug。有关问题和答案，请打开 [GitHub 讨论](https://github.com/tusen-ai/naive-ui/discussions)。 - [x] 提供的复现是[最小可复现的示例](https://stackoverflow.com/help/minimal-reproducible-example)。
  **Post-Mortem & Fix Analysis**:
  > confirmed, will fix
  > fixed in 5f09de95

- **Issue #7406** (2026-06-28): **n-tabs 组件，当切换tab，tabs slots  suffix 内容宽度变化，tab标签切换过渡动画失效**
  *Symptoms*: ### Describe the bug  n-tabs 组件，当切换tab，tabs slots  suffix 内容宽度变化，tab标签切换过渡动画失效  <!-- Failed to upload "20260107-143119.mp4" -->  ### Steps to reproduce  1. tab1 选中的  suffix 卡槽中有内容； 2. 切换到 其他tab， suffix 卡槽中是没有内容； 3. 其实就是 suffix 卡槽宽度变化 会影响，tab切换过渡效果  ### Link to minimal reproduction  https://play-naive.pro-components.cn/#eNqVU7FuE0EQ/ZXRURxIsR0ElbFBJESCFASRSDTXbO7G9pq93dPu3tmW5YqChoaSgjaipKTgcwJS/oLZvdz5HJ+N0t3Om3nzZubdMniZZd0ix6AfDCymmWAWn0cSYCA7sZIjPu5kWhU8Qe3DHhCKJVyOO5dM30U9nqIxbIzbmEelsnzEY2a5km0pJYVKmGhHPZ5wJtSWtkbKK0wV9O4W9vZXOnxnZwfu1+7L22d30M61OXB72YNe4yD0NLHmmQWDNs9AMDkeRoE1UUAoTzOlLfiZR1qlEHZ77uEuGzqmspYyg4OgAtpObtmlgcLtAEW/YCJHahLnWqO0F+wyCqCap6qEB5nGEZ/XS3jnn9XUGw2qFp2MSQTJUseumOE0BVCcXmflq2b7oCRtY8aEWO+xYtjNaSd4hMwKXBNTCOpYTf8aF3CaJ3gf8ilbHE9UXjP/+frj7/ef17+vGrzXvz7dfP5yc/VtN/F6gSYfNRc4SHgBfWMXwnVbznhiJ31YHwGGwyGEfm0hvIDw8eFhNg+hDyHLrQpXJOPcMw56xFT7b/PUpSDzP5u1+2wJdGNY3VrNeexZJMnAxm7IdFkPb4U+ariQPGhN6ffu1ChJRlw6UeQ0lWZcoD7L3A9GPfvgEYeRBdTs1MeszvGgiscTjD+2xKdm7mJRQIY0qAuMghqzTI/RlvDJ+Vuc03cNkvlzQdl7wPdolMidxjLtKJcJyW7kebVv/Lrol78wJ3OL0lRDOaEuc+Xzo4BWeLxn9LXcJ92nvi6Sq2D1D2cS3rE=  ### System Info  ```Shell System:     OS: Windows 11 10.0.26100     CPU: (12) x64 12th Gen Intel(R) Core(TM) i7-1265U     Memory: 13.78 GB / 31.64 GB   Binaries:     Node: 18.16.1 - C:\Users\vn55h9c\node\nodejs\node.EXE     npm: 9.5.1 - C:\Users\vn55h9c\node\nodejs\npm.CMD     pnpm: 10.15.0 - C:\Users\vn55h9c\node\nodejs\pnpm.CMD   Browsers:     Chrome: 143.0.7499.170     Edge: Chromium (14
  **Post-Mortem & Fix Analysis**:
  >  @07akioni  @jahnli  大佬 帮忙看看 是否 有必要 兼容一下 
  > @blackawn 大佬 看看 是否有必要 兼容一下 
  > 看起来是个 bug

- **Issue #7341** (2025-12-01): **模态框 Modal 开启拖拽后，会内存泄漏**
  *Symptoms*: ### 描述错误  模态框 Modal 开启拖拽后，会内存泄漏，我用官方的界面做演示，检查源码发现cleanUp有问题     ### 复现步骤  1.打开模态框之前检查dom node  <img width="506" height="258" alt="Image" src="https://github.com/user-attachments/assets/554ac564-ff41-4488-8622-0436c09cac6b" />  2.打开后检查dom node  <img width="1132" height="699" alt="Image" src="https://github.com/user-attachments/assets/a6509b31-5447-47bf-95c2-6f8117e3b722" />  3.关闭后再检查  <img width="1134" height="575" alt="Image" src="https://github.com/user-attachments/assets/978e0079-d29f-48b2-8c43-8de9ce37c588" />  4.重复n次后再检查  <img width="609" height="623" alt="Image" src="https://github.com/user-attachments/assets/61d41f10-8159-4730-8531-f979ee6ba1b2" />  5.最后进行源码检查  <img width="1407" height="441" alt="Image" src="https://github.com/user-attachments/assets/7706bc01-f4f9-4f4b-a9cd-a0a5c5ec6971" />  这里应该是解绑，而不是绑定新的。不然会不停的产生内存泄漏。  ### 最小复现链接  https://www.naiveui.com/zh-CN/os-theme/components/modal  ### 系统信息  ```Shell 浏览器 ```  ### 使用的包管理器  pnpm  ### 验证  - [x] 阅读 [贡献指南](https://github.com/tusen-ai/naive-ui/blob/main/CONTRIBUTING.zh-CN.md)。 - [x] 阅读 [文档](https://www.naiveui.com/zh-CN/)。 - [x] 检查是否已经存在[相同问题的问题](https://github.com/tusen-ai/naive-ui/issues)，以避免创建重复的问题。 - [x] 确保这是一个具体的 bug。有关问题和答案，请打开 [GitHub 讨论](https://github.com/tusen-ai/naive-ui/discussions)。 - [x] 提供的复现是[最小可复现的示例](https://stackoverflow.com/help/minimal-reproducible-example)。
  **Post-Mortem & Fix Analysis**:
  > 已解决

- **Issue #7172** (2025-09-12): **NProgress组件同时使用多个时 渐变色会被第一个组件覆盖**
  *Symptoms*: ### Describe the bug  NProgress组件同时使用多个时 渐变色会被第一个组件覆盖  传递了正确的颜色  ### Steps to reproduce  复现链接https://codesandbox.io/p/sandbox/dazzling-dewdney-y3ql39?file=%2Fsrc%2FDemo.vue%3A12%2C51  <img width="1232" height="728" alt="Image" src="https://github.com/user-attachments/assets/6da418b4-f968-4af4-8507-ee0c0afe4260" />  ### Link to minimal reproduction  https://codesandbox.io/p/sandbox/dazzling-dewdney-y3ql39?file=%2Fsrc%2FDemo.vue%3A12%2C51  ### System Info  ```Shell System:     OS: Windows 10 10.0.19045     CPU: (4) x64 Intel(R) Core(TM) i5-7400 CPU @ 3.00GHz     Memory: 3.85 GB / 23.94 GB   Binaries:     Node: 20.18.0 - C:\Program Files\nodejs\node.EXE         Yarn: 1.22.22 - C:\Program Files\nodejs\yarn.CMD         npm: 10.8.2 - C:\Program Files\nodejs\npm.CMD            pnpm: 10.6.5 - C:\Program Files\nodejs\pnpm.CMD          bun: 1.1.37 - C:\Program Files\nodejs\bun.CMD          Browsers:     Edge: Chromium (137.0.3296.93)     Internet Explorer: 11.0.19041.5794   npmPackages:     naive-ui: ^2.42.0 => 2.42.0      vue: ^3.5.8 => 3.5.17 ```  ### Used Package Manager  pnpm  ### Validations  - [x] Read the [Contributing Guidelines](https://github.com/tusen-ai/naive-ui/blob/main/CONTRIBUTING.md). - [x] Read the [docs](https://www.naiveui.com/en-US/). - [x] Check that there isn't [already an issue](https://github.com/tusen-ai/naive-ui/issues) that reports the same bug to avoid creating a duplicate. - [x] Check that this is a concrete bug. For Q&A open a [GitHub Discussion](https://
  **Post-Mortem & Fix Analysis**:
  > 确实是个 bug 我会修复

- **Issue #6923** (2025-11-30): **将 n-menu 组件的indent设置为0时选中样式异常**
  *Symptoms*: ### 描述错误  将 n-menu 组件的indent设置为0时选中样式异常  ### 复现步骤  1.代码： `          <n-menu             v-model:value="activeKey"             :root-indent="0"             :indent="0"             :options="menuOptions"           />` 2.页面显示：  ![Image](https://github.com/user-attachments/assets/2c926225-5e8f-40d2-87f8-dadc86ffbb6c)  ### 最小复现链接  无  ### 系统信息  ```Shell "naive-ui": "^2.42.0","vue": "^3.5.16", ```  ### 使用的包管理器  pnpm  ### 验证  - [x] 阅读 [贡献指南](https://github.com/tusen-ai/naive-ui/blob/main/CONTRIBUTING.zh-CN.md)。 - [x] 阅读 [文档](https://www.naiveui.com/zh-CN/)。 - [x] 检查是否已经存在[相同问题的问题](https://github.com/tusen-ai/naive-ui/issues)，以避免创建重复的问题。 - [x] 确保这是一个具体的 bug。有关问题和答案，请打开 [GitHub 讨论](https://github.com/tusen-ai/naive-ui/discussions)。 - [x] 提供的复现是[最小可复现的示例](https://stackoverflow.com/help/minimal-reproducible-example)。
  **Post-Mortem & Fix Analysis**:
  > 你是想把菜单变成扁平化的样式吗
  > > 你是想把菜单变成扁平化的样式吗  对 @blackawn 
  > > > 你是想把菜单变成扁平化的样式吗 >  > 对 [@blackawn](https://github.com/blackawn)  你可以这样 ```vue <template>   <n-menu     :root-indent="8"     :indent="0"     style="padding-left: 8px;"   /> </template> <style> .n-menu .n-menu-item-content::before{   left: 0!important; } </style> ```  或着`:indent="-4"`， 我觉得`0`在有图标和没图标的情况下看起来匀称一些 

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

### Incident Patch 1: `8b249214` (2026-10-05)
**Commit Message**: Update CHANGELOG for version 2.45.3 fixes

**File**: `CHANGELOG.en-US.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## 2.45.3
 
+`2026-08-28`
+
 ### Fixes
 
 - Fix `n-pagination` throwing when jumping from a high page back to page 1.
```

---

### Incident Patch 2: `7c3c81a8` (2026-10-05)
**Commit Message**: Update CHANGELOG for version 2.45.3 fixes

修复了多个组件在特定情况下的错误。

**File**: `CHANGELOG.zh-CN.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## 2.45.3
 
+`2026-08-28`
+
 ### Fixes
 
 - 修复 `n-pagination` 页数较多时从末页跳回首页报错的问题
```

---

### Incident Patch 3: `2bb9b6fa` (2026-08-26)
**Commit Message**: fix(pagination): prevent error when jumping from last page to first page; update tests for pagination behavior

**File**: `CHANGELOG.en-US.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 ### Fixes
 
+- Fix `n-pagination` throwing when jumping from a high page back to page 1.
 - Fix `n-ellipsis` throwing an error on click when `expand-trigger` is not set, closes [#8191](https://github.com/tusen-ai/naive-ui/issues/8191).
 - Fix `n-select`, `n-cascader`, `n-tree-select`, `n-date-picker` and `n-time-picker` throwing an error when focus leaves their menu.
 - Fix `n-modal`'s `positive-click`/`negative-click`/`close` events not working with `dialog` and `confirm` presets, and `close` firing twice with `card` preset, closes [#8188](https://github.com/tusen-ai/naive-ui/issues/8188).
```

**File**: `CHANGELOG.zh-CN.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 ### Fixes
 
+- 修复 `n-pagination` 页数较多时从末页跳回首页报错的问题
 - 修复 `n-ellipsis` 在未设置 `expand-trigger` 时点击报错的问题，关闭 [#8191](https://github.com/tusen-ai/naive-ui/issues/8191)
 - 修复 `n-select`、`n-cascader`、`n-tree-select`、`n-date-picker`、`n-time-picker` 在焦点离开菜单时报错的问题
 - 修复 `n-modal` 在 `dialog`、`confirm` 预设下 `positive-click`、`negative-click`、`close` 事件不生效，以及 `card` 预设下 `close` 事件被触发两次的问题，关闭 [#8188](https://github.com/tusen-ai/naive-ui/issues/8188)
```

**File**: `src/pagination/src/Pagination.tsx` (modified, +54/-71)
```diff
@@ -644,7 +644,7 @@ export default defineComponent({
           switch (part) {
             case 'pages':
               return (
-                <Fragment>
+                <Fragment key="pages">
                   <div
                     class={[
                       `${mergedClsPrefix}-pagination-item`,
@@ -694,11 +694,13 @@ export default defineComponent({
                       {mergedPageCount}
                     </Fragment>
                   ) : (
-                    pageItems.map((pageItem, index) => {
+                    pageItems.map((pageItem) => {
                       let contentNode: VNodeChild
                       let onMouseenter: undefined | (() => void)
                       let onMouseleave: undefined | (() => void)
                       const { type } = pageItem
+                      const itemKey
+                        = type === 'page' ? `page-${pageItem.label}` : type
                       switch (type) {
                         case 'page':
                           // eslint-disable-next-line no-case-declarations
@@ -783,7 +785,7 @@ export default defineComponent({
                       }
                       const itemNode = (
                         <div
-                          key={index}
+                          key={itemKey}
                           class={[
                             `${mergedClsPrefix}-pagination-item`,
                             pageItem.active
@@ -808,82 +810,63 @@ export default defineComponent({
                           {contentNode}
                         </div>
                       )
-                      if (
-                        type === 'page'
-                        && !pageItem.mayBeFastBackward
-                        && !pageItem.mayBeFastForward
-                      ) {
+                      // Do not reuse NPopselect between a page button and the
+                      // fast-jump ellipsis. Patching a popover that still owns a
+                      // large virtualized option list into a plain page button
+                      // can throw during insertBefore.
+                      if (type === 'page' || !pageItem.options) {
                         return itemNode
                       }
-                      else {
-                        const key
-                          = pageItem.type === 'page'
-                            ? pageItem.mayBeFastBackward
-                              ? 'fast-backward'
-                              : 'fast-forward'
-                            : pageItem.type
-                        if (pageItem.type !== 'page' && !pageItem.options) {
-                          return itemNode
-                        }
-                        return (
-                          <NPopselect
-                            to={this.to}
-                            key={key}
-                            disabled={disabled}
-                            trigger="hover"
-                            virtualScroll
-                            style={{ width: '60px' }}
-                            theme={mergedTheme.peers.Popselect}
-                            themeOverrides={mergedTheme.peerOverrides.Popselect}
-                            builtinThemeOverrides={{
-                              peers: {
-                                InternalSelectMenu: {
-                                  height: 'calc(var(--n-option-height) * 4.6)'
-                                }
-                              }
-                            }}
-                            nodeProps={() => ({
-                              style: {
-                                justifyContent: 'center'
+                      return (
+                        <NPopselect
+                          to={this.to}
+                          key={itemKey}
+                          disabled={disabled}
+                          trigger="hover"
+                          virtualScroll
+                          style={{ width: '60px' }}
+                          theme={mergedTheme.peers.Popselect}
+                          themeOverrides={mergedTheme.peerOverrides.Popselect}
+                          builtinThemeOverrides={{
+                            peers: {
+                              InternalSelectMenu: {
+                                height: 'calc(var(--n-option-height) * 4.6)'
                               }
-                            })}
-                            show={
-                              type === 'page'
-                                ? false
-                                : type === 'fast-backward'
-                                  ? this.showFastBackwardMenu
-                                  : this.showFastForwardMenu
                             }
-                            onUpdateShow={(value) => {
-                              if (type === 'page')
-                                return
-                              if (value) {
-                   
```

**File**: `src/pagination/tests/Pagination.spec.tsx` (modified, +64/-1)
```diff
@@ -1,8 +1,40 @@
+import type { VueWrapper } from '@vue/test-utils'
 import type { PaginationInfo, PaginationRenderLabel } from '../index'
 import { mount } from '@vue/test-utils'
-import { h } from 'vue'
+import { h, nextTick } from 'vue'
 import { NPagination } from '../index'
 
+function findPageItem(
+  wrapper: VueWrapper,
+  label: string
+): ReturnType<VueWrapper['findAll']>[number] | undefined {
+  return wrapper
+    .findAll('.n-pagination-item')
+    .find(item => item.text() === label)
+}
+
+async function collectRuntimeErrors(
+  run: (pushError: (error: unknown) => void) => Promise<void>
+): Promise<unknown[]> {
+  const errors: unknown[] = []
+  const pushError = (error: unknown): void => {
+    errors.push(error)
+  }
+  const handleRejection = (event: PromiseRejectionEvent): void => {
+    pushError(event.reason)
+  }
+  window.addEventListener('unhandledrejection', handleRejection)
+  try {
+    await run(pushError)
+    await nextTick()
+    await nextTick()
+  }
+  finally {
+    window.removeEventListener('unhandledrejection', handleRejection)
+  }
+  return errors
+}
+
 describe('n-pagination', () => {
   it('should work with import on demand', () => {
     mount(NPagination)
@@ -98,6 +130,37 @@ describe('n-pagination', () => {
     )
     wrapper.unmount()
   })
+  it('should not throw when jumping from last page to first page', async () => {
+    const errors = await collectRuntimeErrors(async (pushError) => {
+      const wrapper = mount(NPagination, {
+        attachTo: document.body,
+        props: {
+          page: 1,
+          pageCount: 200,
+          'onUpdate:page': (page: number) => {
+            void wrapper.setProps({ page })
+          }
+        },
+        global: {
+          config: {
+            errorHandler: (error) => {
+              pushError(error)
+            }
+          }
+        }
+      })
+      const lastPage = findPageItem(wrapper, '200')
+      expect(lastPage).toBeTruthy()
+      await lastPage!.trigger('click')
+      expect(wrapper.props('page')).toBe(200)
+      const firstPage = findPageItem(wrapper, '1')
+      expect(firstPage).toBeTruthy()
+      await firstPage!.trigger('click')
+      expect(wrapper.props('page')).toBe(1)
+      wrapper.unmount()
+    })
+    expect(errors).toEqual([])
+  })
 })
 it('should work with label slot', async () => {
   const labelSlot: PaginationRenderLabel = (props) => {
```

**File**: `src/pagination/tests/Pagination.virtual-jump.browser.spec.tsx` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import { locators, page } from 'vitest/browser'
+import { createApp, defineComponent, nextTick, ref } from 'vue'
+import { NPagination } from '../index'
+
+declare module 'vitest/browser' {
+  interface LocatorSelectors {
+    getByClass: (className: string) => import('vitest/browser').Locator
+  }
+}
+
+locators.extend({
+  getByClass(className: string) {
+    return `.${className}`
+  }
+})
+
+function collectPageItems(): HTMLElement[] {
+  return Array.from(document.querySelectorAll('.n-pagination-item'))
+}
+
+function findFastJumpIndex(): number {
+  const index = collectPageItems().findIndex((element, itemIndex, items) => {
+    return (
+      itemIndex > 0
+      && itemIndex < items.length - 1
+      && element.querySelector('.n-base-icon')
+    )
+  })
+  if (index === -1)
+    throw new Error('fast-jump pagination item not found')
+  return index
+}
+
+async function mountPagination() {
+  await page.viewport(900, 400)
+  const host = document.createElement('div')
+  document.body.append(host)
+
+  const currentPage = ref(1)
+  const errors: unknown[] = []
+  const handleRejection = (event: PromiseRejectionEvent): void => {
+    errors.push(event.reason)
+  }
+  const handleError = (event: ErrorEvent): void => {
+    errors.push(event.error ?? event.message)
+  }
+  window.addEventListener('unhandledrejection', handleRejection)
+  window.addEventListener('error', handleError)
+
+  const App = defineComponent({
+    setup() {
+      return () => (
+        <NPagination
+          page={currentPage.value}
+          pageCount={200}
+          onUpdatePage={(pageNumber: number) => {
+            currentPage.value = pageNumber
+          }}
+        />
+      )
+    }
+  })
+
+  const app = createApp(App)
+  app.config.errorHandler = (error) => {
+    errors.push(error)
+  }
+  app.mount(host)
+  await nextTick()
+  await expect.element(page.getByClass('n-pagination')).toBeVisible()
+
+  return {
+    currentPage,
+    errors,
+    unmount() {
+      window.removeEventListener('unhandledrejection', handleRejection)
+      window.removeEventListener('error', handleError)
+      app.unmount()
+      host.remove()
+    }
+  }
+}
+
+async function clickPage(label: string): Promise<void> {
+  const item = collectPageItems().find(
+    element => element.textContent?.trim() === label
+  )
+  if (!item)
+    throw new Error(`pagination item "${label}" not found`)
+  item.click()
+  await nextTick()
+}
+
+async function hoverFastJumpAndWaitForVirtualMenu(): Promise<void> {
+  await page.getByClass('n-pagination-item').nth(findFastJumpIndex()).hover()
+  await expect.element(page.getByClass('n-virtual-list')).toBeVisible()
+  await expect.element(page.getByClass('n-base-select-menu')).toBeVisible()
+}
+
+describe('n-pagination virtual jump (browser)', () => {
+  it('should not throw when a virtualized fast-jump menu is open and jumping to page 1', async () => {
+    const pagination = await mountPagination()
+    try {
+      await clickPage('200')
+      expect(pagination.currentPage.value).toBe(200)
+
+      await hoverFastJumpAndWaitForVirtualMenu()
+
+      await clickPage('1')
+      await nextTick()
+      expect(pagination.currentPage.value).toBe(1)
+      expect(pagination.errors).toEqual([])
+    }
+    finally {
+      pagination.unmount()
+    }
+  })
+})
```

---

### Incident Patch 4: `2ac0b01e` (2026-08-21)
**Commit Message**: fix(modal): forward positive/negative-click and close handlers only once to dialog and confirm presets (#8189)

* fix(modal): forward positive/negative-click and close handlers only once to dialog and confirm presets

* address review: mention card preset fix in changelog, clarify comment, align test naming/click style

- CHANGELOG: note that the fix also stops onClose double-firing on the card preset
- presetProps.ts: expand the exclusion comment and fix the component name (NModalBodyWrapper)
- Modal.spec.tsx: rename new tests to match kebab-case prop-name convention used by
  sibling tests, and use dispatchEvent+nextTick with an unambiguous selector instead
  of clicking a positionally-indexed button

---------

Co-authored-by: 07akioni <[REDACTED_EMAIL]>

**File**: `CHANGELOG.en-US.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 
 - Fix `n-ellipsis` throwing an error on click when `expand-trigger` is not set, closes [#8191](https://github.com/tusen-ai/naive-ui/issues/8191).
 - Fix `n-select`, `n-cascader`, `n-tree-select`, `n-date-picker` and `n-time-picker` throwing an error when focus leaves their menu.
+- Fix `n-modal`'s `positive-click`/`negative-click`/`close` events not working with `dialog` and `confirm` presets, and `close` firing twice with `card` preset, closes [#8188](https://github.com/tusen-ai/naive-ui/issues/8188).
 
 ## 2.45.2
 
```

**File**: `CHANGELOG.zh-CN.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 
 - 修复 `n-ellipsis` 在未设置 `expand-trigger` 时点击报错的问题，关闭 [#8191](https://github.com/tusen-ai/naive-ui/issues/8191)
 - 修复 `n-select`、`n-cascader`、`n-tree-select`、`n-date-picker`、`n-time-picker` 在焦点离开菜单时报错的问题
+- 修复 `n-modal` 在 `dialog`、`confirm` 预设下 `positive-click`、`negative-click`、`close` 事件不生效，以及 `card` 预设下 `close` 事件被触发两次的问题，关闭 [#8188](https://github.com/tusen-ai/naive-ui/issues/8188)
 
 ## 2.45.2
 
```

**File**: `src/modal/src/Modal.tsx` (modified, +2/-2)
```diff
@@ -33,7 +33,7 @@ import { dialogProviderInjectionKey } from '../../dialog/src/context'
 import { modalLight } from '../styles'
 import NModalBodyWrapper from './BodyWrapper'
 import { modalInjectionKey, modalProviderInjectionKey } from './interface'
-import { presetProps, presetPropsKeys } from './presetProps'
+import { forwardedPresetPropsKeys, presetProps } from './presetProps'
 import style from './styles/index.cssr'
 
 export const modalProps = {
@@ -296,7 +296,7 @@ export default defineComponent({
       isMounted: isMountedRef,
       containerRef,
       presetProps: computed(() => {
-        const pickedProps = keep(props, presetPropsKeys)
+        const pickedProps = keep(props, forwardedPresetPropsKeys)
         // TODO: remove as any after vue fix the issue introduced in 3.2.27
         return omit(pickedProps, [
           'onClose',
```

**File**: `src/modal/src/presetProps.ts` (modified, +9/-1)
```diff
@@ -10,4 +10,12 @@ const presetProps = {
 
 const presetPropsKeys = keysOf(presetProps)
 
-export { presetProps, presetPropsKeys }
+// Modal explicitly passes its own wrapped onClose/onPositiveClick/onNegativeClick
+// to NModalBodyWrapper, so exclude them here — otherwise Vue merges each pair into
+// an array and BodyWrapper's direct `props.onPositiveClick()` call breaks.
+const forwardedPresetPropsKeys = presetPropsKeys.filter(
+  key =>
+    key !== 'onClose' && key !== 'onPositiveClick' && key !== 'onNegativeClick'
+)
+
+export { forwardedPresetPropsKeys, presetProps, presetPropsKeys }
```

**File**: `src/modal/tests/Modal.spec.tsx` (modified, +36/-0)
```diff
@@ -153,6 +153,42 @@ describe('n-modal', () => {
     wrapper.unmount()
   })
 
+  it('should work with `positive-click` prop on dialog preset', async () => {
+    const onPositiveClick = vi.fn()
+    const wrapper = mountModal({
+      modalProps: {
+        preset: 'dialog',
+        positiveText: 'confirm',
+        onPositiveClick
+      }
+    })
+    await wrapper.find('button').trigger('click')
+    document
+      .querySelector('.n-dialog__action button')
+      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
+    await nextTick()
+    expect(onPositiveClick).toHaveBeenCalledTimes(1)
+    wrapper.unmount()
+  })
+
+  it('should work with `negative-click` prop on dialog preset', async () => {
+    const onNegativeClick = vi.fn()
+    const wrapper = mountModal({
+      modalProps: {
+        preset: 'dialog',
+        negativeText: 'cancel',
+        onNegativeClick
+      }
+    })
+    await wrapper.find('button').trigger('click')
+    document
+      .querySelector('.n-dialog__action button')
+      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
+    await nextTick()
+    expect(onNegativeClick).toHaveBeenCalledTimes(1)
+    wrapper.unmount()
+  })
+
   it('should work with `content-scrollable` prop on card preset', async () => {
     const wrapper = mountModal({
       modalProps: {
```

---

### Incident Patch 5: `c229afd7` (2026-08-21)
**Commit Message**: fix(ellipsis, focus-detector): error when an optional event handler prop is not set (#8192)

* fix(ellipsis): error on click when `expand-trigger` is not set, closes #8191

* fix(focus-detector): error on blur when `on-blur` is not set

---------

Co-authored-by: 07akioni <[REDACTED_EMAIL]>

**File**: `CHANGELOG.en-US.md` (modified, +7/-0)
```diff
@@ -1,5 +1,12 @@
 # CHANGELOG
 
+## NEXT_VERSION
+
+### Fixes
+
+- Fix `n-ellipsis` throwing an error on click when `expand-trigger` is not set, closes [#8191](https://github.com/tusen-ai/naive-ui/issues/8191).
+- Fix `n-select`, `n-cascader`, `n-tree-select`, `n-date-picker` and `n-time-picker` throwing an error when focus leaves their menu.
+
 ## 2.45.2
 
 `2026-08-21`
```

**File**: `CHANGELOG.zh-CN.md` (modified, +7/-0)
```diff
@@ -1,5 +1,12 @@
 # CHANGELOG
 
+## NEXT_VERSION
+
+### Fixes
+
+- 修复 `n-ellipsis` 在未设置 `expand-trigger` 时点击报错的问题，关闭 [#8191](https://github.com/tusen-ai/naive-ui/issues/8191)
+- 修复 `n-select`、`n-cascader`、`n-tree-select`、`n-date-picker`、`n-time-picker` 在焦点离开菜单时报错的问题
+
 ## 2.45.2
 
 `2026-08-21`
```

**File**: `src/_internal/focus-detector/src/FocusDetector.tsx` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@ export default defineComponent({
       <div
         style="width: 0; height: 0"
         tabindex={0}
-        onFocus={props.onFocus}
-        onBlur={props.onBlur}
+        onFocus={e => props.onFocus?.(e)}
+        onBlur={e => props.onBlur?.(e)}
       />
     )
   }
```

**File**: `src/_internal/focus-detector/tests/FocusDetector.spec.tsx` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import { mount } from '@vue/test-utils'
+import NFocusDetector from '../index'
+
+describe('n-focus-detector', () => {
+  it('should not throw an error on blur without `on-blur` prop', async () => {
+    const errorHandler = vi.fn()
+    const wrapper = mount(NFocusDetector, {
+      props: { onFocus: () => {} },
+      global: { config: { errorHandler } }
+    })
+
+    await wrapper.trigger('blur')
+    expect(errorHandler).not.toHaveBeenCalled()
+    wrapper.unmount()
+  })
+})
```

**File**: `src/ellipsis/tests/Ellipsis.spec.tsx` (modified, +13/-0)
```diff
@@ -102,4 +102,17 @@ describe('n-ellipsis', () => {
     )
     wrapper.unmount()
   })
+
+  it('should not throw an error on click without `expand-trigger` prop', async () => {
+    const errorHandler = vi.fn()
+    const wrapper = mount(NEllipsis, {
+      props: { tooltip: false },
+      slots: { default: () => 'test n-ellipsis' },
+      global: { config: { errorHandler } }
+    })
+
+    await wrapper.trigger('click')
+    expect(errorHandler).not.toHaveBeenCalled()
+    wrapper.unmount()
+  })
 })
```

---

### Incident Patch 6: `2d88c1d5` (2026-08-20)
**Commit Message**: fix(data-table): resetting header horizontal scroll when data becomes empty

**File**: `.github/workflows/node.js.yml` (modified, +27/-0)
```diff
@@ -67,3 +67,30 @@ jobs:
         with:
           token: ${{ secrets.CODECOV_TOKEN }}
           files: coverage/lcov.info
+
+  test-browser:
+    environment: test
+
+    runs-on: ubuntu-latest
+
+    strategy:
+      matrix:
+        node-version: [24]
+    steps:
+      - uses: actions/checkout@v6
+
+      - name: Install pnpm
+        run: corepack enable
+
+      - name: Use Node.js ${{ matrix.node-version }}
+        uses: actions/setup-node@v6
+        with:
+          node-version: ${{ matrix.node-version }}
+
+      - run: pnpm install
+
+      - name: Install Playwright Chromium
+        run: pnpm exec playwright install chromium --with-deps
+
+      - name: Browser tests
+        run: pnpm run test:browser
```

**File**: `.gitignore` (modified, +7/-1)
```diff
@@ -27,4 +27,10 @@ web-types.json
 ~*
 .pnpm-debug.log
 .history
-.pnpm-store
\ No newline at end of file
+.pnpm-store
+test-results
+playwright-report
+blob-report
+.playwright
+.vitest-attachments
+**/__screenshots__/
\ No newline at end of file
```

**File**: `CHANGELOG.en-US.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 
 - Fix `n-ellipsis` throwing when clicked without `expand-trigger`.
 - Fix `n-modal` not closing when clicking the mask.
+- Fix `n-data-table` resetting header horizontal scroll when data becomes empty.
 
 ## 2.45.1
 
```

**File**: `CHANGELOG.zh-CN.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 
 - 修复 `n-ellipsis` 未设置 `expand-trigger` 时点击报错的问题
 - 修复 `n-modal` 点击遮罩无法关闭的问题
+- 修复 `n-data-table` 数据变为空时表头横向滚动位置被重置的问题
 
 ## 2.45.1
 
```

**File**: `package.json` (modified, +4/-1)
```diff
@@ -60,6 +60,7 @@
     "test:update": "tsc -p tsconfig.test.json --noEmit --pretty false && vitest --run --update",
     "test:cov": "tsc -p tsconfig.test.json --noEmit --pretty false && vitest run --coverage",
     "test:watch": "vitest --watch",
+    "test:browser": "tsc -p tsconfig.test.json --noEmit --pretty false && vitest run --config vitest.browser.config.mts",
     "test:umd": "vitest run umd-test/index.spec.js",
     "test:esm": "vitest run esm-test/index.spec.js",
     "gen-version": "tsx scripts/gen-version.ts",
@@ -114,6 +115,7 @@
     "@vicons/ionicons4": "^0.13.0",
     "@vicons/ionicons5": "^0.13.0",
     "@vitejs/plugin-vue": "^6.0.6",
+    "@vitest/browser-playwright": "^4.1.11",
     "@vitest/coverage-v8": "^4.1.5",
     "@vue/compiler-sfc": "^3.5.21",
     "@vue/server-renderer": "^3.5.21",
@@ -136,6 +138,7 @@
     "lint-staged": "^16.1.6",
     "marked": "^12.0.2",
     "oxc-transform": "^0.128.0",
+    "playwright": "^1.62.1",
     "prettier": "^3.6.2",
     "rimraf": "^6.0.1",
     "superagent": "^10.2.2",
@@ -144,7 +147,7 @@
     "typescript": "^6.0.3",
     "vfonts": "^0.0.3",
     "vite": "^8.0.10",
-    "vitest": "^4.1.5",
+    "vitest": "^4.1.11",
     "vue": "^3.5.21",
     "vue-jsx-vapor": "^3.2.19",
     "vue-router": "^4.5.1",
```

**File**: `src/data-table/src/DataTable.tsx` (modified, +2/-1)
```diff
@@ -222,7 +222,8 @@ export default defineComponent({
       mainTableInstRef,
       mergedCurrentPageRef,
       maxHeightRef,
-      mergedTableLayoutRef
+      mergedTableLayoutRef,
+      mergedEmptyRef
     })
     const { localeRef } = useLocale('DataTable')
 
```

**File**: `src/data-table/src/MainTable.tsx` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ export default defineComponent({
     })
     function handleBodyResize(entry: ResizeObserverEntry): void {
       bodyWidthRef.value = entry.contentRect.width
-      syncScrollState()
+      syncScrollState('layout')
       if (!fixedStateInitializedRef.value) {
         fixedStateInitializedRef.value = true
       }
```

**File**: `src/data-table/src/interface.ts` (modified, +1/-1)
```diff
@@ -454,7 +454,7 @@ export interface DataTableInjection {
   doUncheck: (rowKey: RowKey | RowKey[], rowInfo: RowData) => void
   handleTableHeaderScroll: (e: Event) => void
   handleTableBodyScroll: (e: Event) => void
-  syncScrollState: (deltaX?: number, deltaY?: number) => void
+  syncScrollState: (source: 'head' | 'body' | 'layout') => void
   setHeaderScrollLeft: (scrollLeft: number) => void
   renderCell: Ref<
     | undefined
```

---

### Incident Patch 7: `f6c78e2e` (2026-08-20)
**Commit Message**: fix(modal): not closing when clicking the mask

**File**: `CHANGELOG.en-US.md` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
 ### Fixes
 
 - Fix `n-ellipsis` throwing when clicked without `expand-trigger`.
+- Fix `n-modal` not closing when clicking the mask.
 
 ## 2.45.1
 
```

**File**: `CHANGELOG.zh-CN.md` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
 ### Fixes
 
 - 修复 `n-ellipsis` 未设置 `expand-trigger` 时点击报错的问题
+- 修复 `n-modal` 点击遮罩无法关闭的问题
 
 ## 2.45.1
 
```

**File**: `src/dialog/tests/Dialog.spec.tsx` (modified, +6/-6)
```diff
@@ -112,9 +112,9 @@ describe('n-dialog', () => {
     const wrapper = mount(() => (
       <Provider>{{ default: () => <Test /> }}</Provider>
     ))
-    document
-      .querySelector('.n-modal-mask')
-      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
+    const overlay = document.querySelector('.n-modal-scroll-content')
+    overlay?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
+    overlay?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
     await nextTick()
     expect(document.querySelector('.n-dialog')).not.toBeNull()
     wrapper.unmount()
@@ -139,9 +139,9 @@ describe('n-dialog', () => {
       <Provider>{{ default: () => <Test /> }}</Provider>
     ))
     await nextTick()
-    document
-      .querySelector('.n-modal-mask')
-      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
+    const overlay = document.querySelector('.n-modal-scroll-content')
+    overlay?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
+    overlay?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
     expect(onMaskClick).toHaveBeenCalled()
     wrapper.unmount()
   })
```

**File**: `src/modal/src/BodyWrapper.tsx` (modified, +10/-10)
```diff
@@ -75,7 +75,10 @@ export default defineComponent({
     maskHidden: Boolean,
     ...presetProps,
     // events
-    onClickoutside: Function as PropType<(e: MouseEvent) => void>,
+    onClickoutside: {
+      type: Function as PropType<(e: MouseEvent) => void>,
+      required: true
+    },
     onBeforeLeave: {
       type: Function,
       required: true
@@ -333,15 +336,12 @@ export default defineComponent({
                               const dirs: DirectiveArguments = [
                                 [vShow, this.show]
                               ]
-                              const { onClickoutside } = this
-                              if (onClickoutside) {
-                                dirs.push([
-                                  clickoutside,
-                                  this.onClickoutside,
-                                  undefined,
-                                  { capture: true }
-                                ])
-                              }
+                              dirs.push([
+                                clickoutside,
+                                this.onClickoutside,
+                                undefined,
+                                { capture: true }
+                              ])
                               return withDirectives(
                                 (this.preset === 'confirm'
                                   || this.preset === 'dialog' ? (
```

**File**: `src/modal/src/Modal.tsx` (modified, +1/-4)
```diff
@@ -350,7 +350,6 @@ export default defineComponent({
                           <div
                             aria-hidden
                             class={`${mergedClsPrefix}-modal-mask`}
-                            onClick={this.handleClickoutside}
                           />
                         ) : null
                       }
@@ -377,9 +376,7 @@ export default defineComponent({
                   onBeforeLeave={this.handleBeforeLeave}
                   onAfterEnter={this.onAfterEnter}
                   onAfterLeave={this.handleAfterLeave}
-                  onClickoutside={
-                    showMask ? undefined : this.handleClickoutside
-                  }
+                  onClickoutside={this.handleClickoutside}
                 >
                   {this.$slots}
                 </NModalBodyWrapper>
```

**File**: `src/modal/src/styles/index.cssr.ts` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import { fadeInScaleUpTransition } from '../../../_styles/transitions/fade-in-scale-up.cssr'
 import { fadeInTransition } from '../../../_styles/transitions/fade-in.cssr'
-import { c, cB, cM, } from '../../../_utils/cssr'
+import { c, cB, cM } from '../../../_utils/cssr'
 import { DRAGGABLE_CLASS } from '../composables'
 
 // vars:
```

**File**: `src/modal/tests/Modal.spec.tsx` (modified, +50/-6)
```diff
@@ -5,6 +5,11 @@ import { defineComponent, h, nextTick, ref, unref } from 'vue'
 import { NButton } from '../../button'
 import { NModal, NModalProvider, useModal } from '../index'
 
+function dispatchOutsideClick(el: Element | null): void {
+  el?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
+  el?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
+}
+
 function mountModal({
   modalProps,
   show
@@ -68,9 +73,7 @@ describe('n-modal', () => {
         return 0
       })
 
-    document
-      .querySelector('.n-modal-mask')
-      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
+    dispatchOutsideClick(document.querySelector('.n-modal-scroll-content'))
     await nextTick()
     expect(document.querySelector('.n-modal-body-wrapper')).toEqual(null)
     wrapper.unmount()
@@ -79,9 +82,7 @@ describe('n-modal', () => {
     await wrapper.find('button').trigger('click')
     expect(document.querySelector('.n-modal-body-wrapper')).not.toEqual(null)
 
-    document
-      .querySelector('.n-modal-mask')
-      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
+    dispatchOutsideClick(document.querySelector('.n-modal-scroll-content'))
     await nextTick()
     expect(
       document.querySelector('.n-modal-body-wrapper')?.children.length
@@ -93,6 +94,49 @@ describe('n-modal', () => {
     wrapper.unmount()
   })
 
+  it('should close when clicking the mask area', async () => {
+    const onMaskClick = vi.fn()
+    const wrapper = mountModal({
+      show: true,
+      modalProps: { onMaskClick }
+    })
+    await nextTick()
+    expect(document.querySelector('.n-modal-body-wrapper')).not.toEqual(null)
+
+    using _rafSpy = vi
+      .spyOn(window, 'requestAnimationFrame')
+      .mockImplementation((cb: FrameRequestCallback): number => {
+        cb(0)
+        return 0
+      })
+    dispatchOutsideClick(document.querySelector('.n-modal-scroll-content'))
+    await nextTick()
+    expect(onMaskClick).toHaveBeenCalledTimes(1)
+    expect(document.querySelector('.n-modal-body-wrapper')).toEqual(null)
+    wrapper.unmount()
+  })
+
+  it('should not close when clicking modal content', async () => {
+    const wrapper = mountModal({ show: true })
+    await nextTick()
+    dispatchOutsideClick(document.querySelector('.n-modal'))
+    await nextTick()
+    expect(document.querySelector('.n-modal-body-wrapper')).not.toEqual(null)
+    wrapper.unmount()
+  })
+
+  it('should not close when clicking the mask area if `mask-closable` is false', async () => {
+    const wrapper = mountModal({
+      show: true,
+      modalProps: { maskClosable: false }
+    })
+    await nextTick()
+    dispatchOutsideClick(document.querySelector('.n-modal-scroll-content'))
+    await nextTick()
+    expect(document.querySelector('.n-modal-body-wrapper')).not.toEqual(null)
+    wrapper.unmount()
+  })
+
   it('should work with `preset` prop', async () => {
     let wrapper = mountModal({ modalProps: { preset: 'card' } })
     expect(document.querySelector('.n-modal-body-wrapper')).toEqual(null)
```

---

### Incident Patch 8: `9d1962ff` (2026-08-19)
**Commit Message**: fix(ellipsis): throwing when clicked without `expand-trigger`

**File**: `CHANGELOG.en-US.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # CHANGELOG
 
+## NEXT_VERSION
+
+### Fixes
+
+- Fix `n-ellipsis` throwing when clicked without `expand-trigger`.
+
 ## 2.45.1
 
 `2026-08-20`
```

**File**: `CHANGELOG.zh-CN.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # CHANGELOG
 
+## NEXT_VERSION
+
+### Fixes
+
+- 修复 `n-ellipsis` 未设置 `expand-trigger` 时点击报错的问题
+
 ## 2.45.1
 
 `2026-08-20`
```

**File**: `src/data-table/tests/DataTable.spec.tsx` (modified, +38/-0)
```diff
@@ -1628,4 +1628,42 @@ describe('props.columns', () => {
 
     wrapper.unmount()
   })
+
+  it('should not throw when selecting from selection extra menu', async () => {
+    const errors: unknown[] = []
+    const wrapper = mount(NDataTable, {
+      attachTo: document.body,
+      global: {
+        config: {
+          errorHandler: (err) => {
+            errors.push(err)
+          }
+        }
+      },
+      props: {
+        columns: [
+          {
+            type: 'selection',
+            options: ['all', 'none']
+          },
+          {
+            title: 'Name',
+            key: 'name'
+          }
+        ],
+        data: [
+          { name: 'a', key: 1 },
+          { name: 'b', key: 2 }
+        ],
+        rowKey: (row: { key: number }) => row.key
+      }
+    })
+
+    expect(wrapper.find('.n-data-table-check-extra').exists()).toBe(true)
+    wrapper.findComponent({ name: 'Dropdown' }).vm.$emit('select', 'all')
+    await nextTick()
+    expect(errors).toEqual([])
+
+    wrapper.unmount()
+  })
 })
```

**File**: `src/ellipsis/src/Ellipsis.tsx` (modified, +11/-13)
```diff
@@ -104,17 +104,16 @@ export default defineComponent({
       }
       return tooltipDisabled
     }
-    const handleClickRef = computed(() => {
-      return props.expandTrigger === 'click'
-        ? () => {
-            const { value: expanded } = expandedRef
-            if (expanded) {
-              tooltipRef.value?.setShow(false)
-            }
-            expandedRef.value = !expanded
-          }
-        : undefined
-    })
+    // HACK: restore it after vue-jsx-vapor can handle it correctly
+    function handleClick(): void {
+      if (props.expandTrigger !== 'click')
+        return
+      const { value: expanded } = expandedRef
+      if (expanded) {
+        tooltipRef.value?.setShow(false)
+      }
+      expandedRef.value = !expanded
+    }
     onDeactivated(() => {
       if (props.tooltip) {
         tooltipRef.value?.setShow(false)
@@ -135,7 +134,7 @@ export default defineComponent({
           style: ellipsisStyleRef.value
         })}
         ref="triggerRef"
-        onClick={handleClickRef.value}
+        onClick={handleClick}
         onMouseenter={
           // get tooltip disabled will derive cursor style
           props.expandTrigger === 'click' ? getTooltipDisabled : undefined
@@ -200,7 +199,6 @@ export default defineComponent({
       triggerInnerRef,
       // reduce dts: string ref only, type unused in render
       tooltipRef: tooltipRef as unknown,
-      handleClick: handleClickRef,
       renderTrigger,
       getTooltipDisabled
     }
```

**File**: `src/ellipsis/tests/Ellipsis.spec.tsx` (modified, +40/-0)
```diff
@@ -42,6 +42,46 @@ describe('n-ellipsis', () => {
     wrapper.unmount()
   })
 
+  it('should not throw when clicking without expand-trigger', async () => {
+    const errors: unknown[] = []
+    const wrapper = mount(NEllipsis, {
+      global: {
+        config: {
+          errorHandler: (err) => {
+            errors.push(err)
+          }
+        }
+      },
+      slots: { default: () => 'test n-ellipsis' }
+    })
+
+    await wrapper.find('.n-ellipsis').trigger('click')
+    expect(errors).toEqual([])
+    wrapper.unmount()
+  })
+
+  it('should not throw when clicking without expand-trigger and tooltip', async () => {
+    const errors: unknown[] = []
+    const wrapper = mount(NEllipsis, {
+      global: {
+        config: {
+          errorHandler: (err) => {
+            errors.push(err)
+          }
+        }
+      },
+      props: { tooltip: false },
+      slots: { default: () => 'test n-ellipsis' }
+    })
+
+    await wrapper.trigger('click')
+    expect(errors).toEqual([])
+    expect(wrapper.find('.n-ellipsis').attributes('style')).toContain(
+      'text-overflow: ellipsis;'
+    )
+    wrapper.unmount()
+  })
+
   it('should work with `expand-trigger` prop', async () => {
     const wrapper = mount(NEllipsis, {
       props: {
```

**File**: `src/transfer/tests/Transfer.spec.ts` (modified, +29/-0)
```diff
@@ -67,4 +67,33 @@ describe('n-transfer', () => {
     })
     expect(wrapper.find('.n-input__placeholder').text()).toBe(test)
   })
+
+  it('should not throw when clicking header buttons', async () => {
+    const errors: unknown[] = []
+    const wrapper = mount(NTransfer, {
+      global: {
+        config: {
+          errorHandler: (err) => {
+            errors.push(err)
+          }
+        }
+      },
+      props: {
+        options: [
+          { label: 'a', value: 'a' },
+          { label: 'b', value: 'b' }
+        ],
+        defaultValue: ['a']
+      }
+    })
+
+    await wrapper
+      .find('.n-transfer-list--source .n-transfer-list-header__button')
+      .trigger('click')
+    await wrapper
+      .find('.n-transfer-list--target .n-transfer-list-header__button')
+      .trigger('click')
+    expect(errors).toEqual([])
+    wrapper.unmount()
+  })
 })
```

**File**: `src/tree/tests/Tree.spec.ts` (modified, +59/-1)
```diff
@@ -1,8 +1,10 @@
 import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
 import type { TreeOption } from '../index'
 import { mount } from '@vue/test-utils'
-import { nextTick } from 'vue'
+import { defineComponent, h, nextTick, provide, ref } from 'vue'
 import { NTree } from '../index'
+import { treeInjectionKey } from '../src/interface'
+import TreeNodeSwitcher from '../src/TreeNodeSwitcher'
 
 function getTreeNodes(wrapper: VueWrapper) {
   return wrapper.findAll('.n-tree-node')
@@ -652,4 +654,60 @@ describe('n-tree', () => {
 
     wrapper.unmount()
   })
+
+  it('should not throw when clicking switcher', async () => {
+    const errors: unknown[] = []
+    const wrapper = mount(NTree, {
+      global: {
+        config: {
+          errorHandler: (err) => {
+            errors.push(err)
+          }
+        }
+      },
+      props: {
+        data: [
+          {
+            label: 'parent',
+            key: 'parent',
+            children: [{ label: 'child', key: 'child' }]
+          }
+        ]
+      }
+    })
+    await wrapper.find('.n-tree-node-switcher').trigger('click')
+    expect(errors).toEqual([])
+    wrapper.unmount()
+  })
+
+  it('should not throw when clicking switcher without onClick', async () => {
+    const errors: unknown[] = []
+    const Host = defineComponent({
+      setup() {
+        provide(treeInjectionKey, {
+          renderSwitcherIconRef: ref(undefined),
+          spinPropsRef: ref(undefined)
+        } as any)
+        return () =>
+          h(TreeNodeSwitcher, {
+            clsPrefix: 'n',
+            indent: 24,
+            tmNode: { rawNode: {} } as any
+          })
+      }
+    })
+    const wrapper = mount(Host, {
+      global: {
+        config: {
+          errorHandler: (err) => {
+            errors.push(err)
+          }
+        }
+      }
+    })
+    expect(wrapper.find('[data-switcher]').exists()).toBe(true)
+    await wrapper.find('[data-switcher]').trigger('click')
+    expect(errors).toEqual([])
+    wrapper.unmount()
+  })
 })
```

---

### Incident Patch 9: `91a9438a` (2026-08-19)
**Commit Message**: fix(data-table): may throw an error when reactivated inside `keep-alive`

**File**: `CHANGELOG.en-US.md` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
 - Fix `useNotification` treating `onClose` as an array.
 - Fix `n-modal` / `useModal` treating dialog action callbacks as arrays.
 - Fix `n-dropdown` `on-update:show` being called twice.
+- Fix `n-data-table` may throw an error when reactivated inside `keep-alive`.
 
 ## 2.45.0
 
```

**File**: `CHANGELOG.zh-CN.md` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
 - 修复 `useNotification` 的 `onClose` 被识别为数组的问题
 - 修复 `n-modal` / `useModal` 对话框操作回调被识别为数组的问题
 - 修复 `n-dropdown` 的 `on-update:show` 被触发两次的问题
+- 修复 `n-data-table` 在 `keep-alive` 内恢复显示时可能报错
 
 ## 2.45.0
 
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@
     "treemate": "^0.3.11",
     "vdirs": "^0.1.8",
     "vooks": "^0.2.12",
-    "vueuc": "^0.4.65"
+    "vueuc": "^0.4.66"
   },
   "devDependencies": {
     "@antfu/eslint-config": "^5.3.0",
```

**File**: `pnpm-workspace.yaml` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@ packages:
   - '.'
 allowBuilds:
   esbuild: true
+minimumReleaseAgeExclude:
+  - vueuc@0.4.66
 onlyBuiltDependencies:
   - esbuild
 overrides:
```

---

### Incident Patch 10: `51743f49` (2026-08-19)
**Commit Message**: feat(i18n): add many new locales, and fix ugCN locale export

**File**: `CHANGELOG.en-US.md` (modified, +5/-0)
```diff
@@ -2,8 +2,13 @@
 
 ## NEXT_VERSION
 
+### i18n
+
+- Add afZA, amET, beBY, bgBG, bnBD, caES, elGR, esES, euES, fiFI, filPH, glES, guIN, heIL, hiIN, hrHR, huHU, hyAM, isIS, kaGE, kkKZ, knIN, kyKG, loLA, ltLT, lvLV, mkMK, mlIN, mnMN, mrIN, msMY, myMM, neNP, paIN, ptPT, rmCH, roRO, siLK, slSI, sqAL, srRS, swKE, taIN, teIN, urPK and zuZA locales.
+
 ### Fixes
 
+- Fix `ugCN` locale not being exported.
 - Fix `n-data-table` and `n-equation` warning `injection "n-config-provider" not found` when used without `n-config-provider`.
 - Fix `useDialog` treating `onPositiveClick`, `onNegativeClick` and `onClose` as arrays, closes [#8186](https://github.com/tusen-ai/naive-ui/issues/8186).
 - Fix `useNotification` treating `onClose` as an array.
```

**File**: `CHANGELOG.zh-CN.md` (modified, +5/-0)
```diff
@@ -2,8 +2,13 @@
 
 ## NEXT_VERSION
 
+### i18n
+
+- 新增 afZA、amET、beBY、bgBG、bnBD、caES、elGR、esES、euES、fiFI、filPH、glES、guIN、heIL、hiIN、hrHR、huHU、hyAM、isIS、kaGE、kkKZ、knIN、kyKG、loLA、ltLT、lvLV、mkMK、mlIN、mnMN、mrIN、msMY、myMM、neNP、paIN、ptPT、rmCH、roRO、siLK、slSI、sqAL、srRS、swKE、taIN、teIN、urPK、zuZA locale
+
 ### Fixes
 
+- 修复 `ugCN` locale 未导出的问题
 - 修复 `n-data-table`、`n-equation` 在未包裹 `n-config-provider` 时出现 `injection "n-config-provider" not found` 警告
 - 修复 `useDialog` 的 `onPositiveClick`、`onNegativeClick`、`onClose` 被识别为数组的问题，关闭 [#8186](https://github.com/tusen-ai/naive-ui/issues/8186)
 - 修复 `useNotification` 的 `onClose` 被识别为数组的问题
```

**File**: `demo/pages/docs/i18n/enUS/index.md` (modified, +81/-35)
```diff
@@ -44,41 +44,87 @@ PRs are welcomed for locales that are not supported yet!
 
 The following list is sorted by 'Config' column.
 
-| Language                   | Config | Date config | Version |
-| -------------------------- | ------ | ----------- | ------- |
-| Arabic (العربية)           | arDZ   | dateArDZ    | 2.34.0  |
-| Azerbaijani (Azərbaycanca) | azAZ   | dateAzAZ    | 2.39.0  |
-| Czech (Czechia)            | csCZ   | dateCsCz    | 2.38.2  |
-| Danish (Denmark)           | daDK   | dateDaDK    | 2.43.0  |
-| German (Germany)           | deDE   | dateDeDE    |         |
-| English (British)          | enGB   | dateEnGB    | 2.25.1  |
-| English                    | enUS   | dateEnUS    |         |
-| Esperanto                  | eo     | dateEo      | 2.25.2  |
-| Spanish (Argentina)        | esAR   | dateEsAR    | 2.24.2  |
-| Estonian                   | etEE   | dateEtEE    | 2.38.0  |
-| Persian                    | faIR   | dateFaIR    | 2.34.4  |
-| French                     | frFR   | dateFrFR    |         |
-| Bahasa Indonesia           | idID   | dateIdID    |         |
-| Italiano                   | itIT   | dateItIT    | 2.24.2  |
-| Japanese                   | jaJP   | dateJaJP    |         |
-| Khmer (Cambodia)           | kmKH   | dateKmKH    | 2.41.0  |
-| Korean (South Korea)       | koKR   | dateKoKR    | 2.28.1  |
-| Norwegian Bokmål (Norway)  | nbNO   | dateNbNO    |         |
-| Norwegian Nynorsk (Norway) | nnNO   | dateNnNO    |         |
-| Dutch (Netherlands)        | nlNL   | dateNlNL    | 2.29.0  |
-| Polish (Poland)            | plPL   | datePlPL    | 2.25.2  |
-| Portuguese (Brazil)        | ptBR   | datePtBR    | 2.28.1  |
-| Russian                    | ruRU   | dateRuRU    |         |
-| Slovak                     | skSK   | dateSkSK    | 2.25.3  |
-| Swedish                    | svSE   | dateSvSE    | 2.35.0  |
-| Thai (Thailand)            | thTH   | dateThTH    | 2.27.0  |
-| Turkish                    | trTR   | dateTrTR    | 2.34.0  |
-| Uyghur (China)             | ugCN   | dateUgCN    |         |
-| Ukrainian                  | ukUA   | dateUkUA    |         |
-| Uzbek (Uzbekistan)         | uzUZ   | dateUzUZ    | 2.39.0  |
-| Vietnamese (Vietnam)       | viVN   | dateViVN    | 2.30.7  |
-| Chinese (Simplified)       | zhCN   | dateZhCN    |         |
-| Chinese (Traditional)      | zhTW   | dateZhTW    |         |
+| Language                     | Config | Date config | Version |
+| ---------------------------- | ------ | ----------- | ------- |
+| Afrikaans (South Africa)     | afZA   | dateAfZA    |         |
+| Amharic (Ethiopia)           | amET   | dateAmET    |         |
+| Arabic (العربية)             | arDZ   | dateArDZ    | 2.34.0  |
+| Azerbaijani (Azərbaycanca)   | azAZ   | dateAzAZ    | 2.39.0  |
+| Belarusian (Belarus)         | beBY   | dateBeBY    |         |
+| Bulgarian (Bulgaria)         | bgBG   | dateBgBG    |         |
+| Bengali (Bangladesh)         | bnBD   | dateBnBD    |         |
+| Catalan (Spain)              | caES   | dateCaES    |         |
+| Czech (Czechia)              | csCZ   | dateCsCZ    | 2.38.2  |
+| Danish (Denmark)             | daDK   | dateDaDK    | 2.43.0  |
+| German (Germany)             | deDE   | dateDeDE    |         |
+| Greek (Greece)               | elGR   | dateElGR    |         |
+| English (British)            | enGB   | dateEnGB    | 2.25.1  |
+| English                      | enUS   | dateEnUS    |         |
+| Esperanto                    | eo     | dateEo      | 2.25.2  |
+| Spanish (Argentina)          | esAR   | dateEsAR    | 2.24.2  |
+| Spanish (Spain)              | esES   | dateEsES    |         |
+| Estonian                     | etEE   | dateEtEE    | 2.38.0  |
+| Basque (Spain)               | euES   | dateEuES    |         |
+| Persian                      | faIR   | dateFaIR    | 2.34.4  |
+| Finnish (Finland)            | fiFI   | dateFiFI    |         |
+| Filipino (Philippines)       | filPH  | dateFilPH   |         |
+| French                       | frFR   | dateFrFR    |         |
+| Galician (Spain)             | glES   | dateGlES    |         |
+| Gujarati (India)             | guIN   | dateGuIN    |         |
+| Hebrew (Israel)              | heIL   | dateHeIL    |         |
+| Hindi (India)                | hiIN   | dateHiIN    |         |
+| Croatian (Croatia)           | hrHR   | dateHrHR    |         |
+| Hungarian (Hungary)          | huHU   | dateHuHU    |         |
+| Armenian (Armenia)           | hyAM   | dateHyAM    |         |
+| Bahasa Indonesia             | idID   | dateIdID    |         |
+| Icelandic (Iceland)          | isIS   | dateIsIS    |         |
+| Italiano                     | itIT   | dateItIT    | 2.24.2  |
+| Japanese                     | jaJP   | dateJaJP    |         |
+| Georgian (Georgia)           | kaGE   | dateKaGE    |         |
+| Kazakh (Kazakhstan)          | kkKZ   | dateKkKZ    |         |
+| Khmer (Cambodia)             | kmKH   | dateK
```

**File**: `demo/pages/docs/i18n/zhCN/index.md` (modified, +81/-35)
```diff
@@ -44,41 +44,87 @@ Naive-ui 通过使用 `n-config-provider` 调整语言，默认情况下所有
 
 以下列表依据“配置”列排序。
 
-| 语言               | 配置 | 日期配置 | 版本   |
-| ------------------ | ---- | -------- | ------ |
-| 阿拉伯语           | arDZ | dateArDZ | 2.34.0 |
-| 阿塞拜疆语         | azAZ | dateAzAZ | 2.39.0 |
-| 捷克语（捷克）     | csCZ | dateCsCz | 2.38.2 |
-| 丹麦               | daDK | dateDaDK | 2.43.0 |
-| 德语               | deDE | dateDeDE |        |
-| 英国英语           | enGB | dateEnGB | 2.25.1 |
-| 英语               | enUS | dateEnUS |        |
-| 世界语             | eo   | dateEo   | 2.25.2 |
-| 西班牙语（阿根廷） | esAR | dateEsAR | 2.24.2 |
-| 爱沙尼亚语         | etEE | dateEtEE | 2.38.0 |
-| 波斯语             | faIR | dateFaIR | 2.34.4 |
-| 法语               | frFR | dateFrFR |        |
-| 印度尼西亚语       | idID | dateIdID |        |
-| 意大利语           | itIT | dateItIT | 2.24.2 |
-| 日语               | jaJP | dateJaJP |        |
-| 高棉语（柬埔寨）   | kmKH | dateKmKH | 2.41.0 |
-| 韩语               | koKR | dateKoKR | 2.28.1 |
-| 书面挪威语         | nbNO | dateNbNO |        |
-| 新挪威语           | nnNO | dateNnNO |        |
-| 荷兰语（荷兰）     | nlNL | dateNlNL | 2.29.0 |
-| 波兰语（波兰）     | plPL | datePlPL | 2.25.2 |
-| 葡萄牙语 (巴西)    | ptBR | datePtBR | 2.28.1 |
-| 俄罗斯语           | ruRU | dateRuRU |        |
-| 斯洛伐克语         | skSK | dateSkSK | 2.25.3 |
-| 瑞典語             | svSE | dateSvSE | 2.35.0 |
-| 泰语（泰国）       | thTH | dateThTH | 2.27.0 |
-| 土耳其语           | trTR | dateTrTR | 2.34.0 |
-| 维吾尔语           | ugCN | dateUgCN | 2.41.0 |
-| 乌克兰语           | ukUA | dateUkUA |        |
-| 乌兹别克语         | uzUZ | dateUzUZ | 2.39.0 |
-| 越南语（越南）     | viVN | dateViVN | 2.30.7 |
-| 简体中文           | zhCN | dateZhCN |        |
-| 繁体中文           | zhTW | dateZhTW |        |
+| 语言                       | 配置  | 日期配置  | 版本   |
+| -------------------------- | ----- | --------- | ------ |
+| 南非荷兰语（南非）         | afZA  | dateAfZA  |        |
+| 阿姆哈拉语（埃塞俄比亚）   | amET  | dateAmET  |        |
+| 阿拉伯语                   | arDZ  | dateArDZ  | 2.34.0 |
+| 阿塞拜疆语                 | azAZ  | dateAzAZ  | 2.39.0 |
+| 白俄罗斯语（白俄罗斯）     | beBY  | dateBeBY  |        |
+| 保加利亚语（保加利亚）     | bgBG  | dateBgBG  |        |
+| 孟加拉语（孟加拉）         | bnBD  | dateBnBD  |        |
+| 加泰罗尼亚语（西班牙）     | caES  | dateCaES  |        |
+| 捷克语（捷克）             | csCZ  | dateCsCZ  | 2.38.2 |
+| 丹麦                       | daDK  | dateDaDK  | 2.43.0 |
+| 德语                       | deDE  | dateDeDE  |        |
+| 希腊语（希腊）             | elGR  | dateElGR  |        |
+| 英国英语                   | enGB  | dateEnGB  | 2.25.1 |
+| 英语                       | enUS  | dateEnUS  |        |
+| 世界语                     | eo    | dateEo    | 2.25.2 |
+| 西班牙语（阿根廷）         | esAR  | dateEsAR  | 2.24.2 |
+| 西班牙语（西班牙）         | esES  | dateEsES  |        |
+| 爱沙尼亚语                 | etEE  | dateEtEE  | 2.38.0 |
+| 巴斯克语（西班牙）         | euES  | dateEuES  |        |
+| 波斯语                     | faIR  | dateFaIR  | 2.34.4 |
+| 芬兰语（芬兰）             | fiFI  | dateFiFI  |        |
+| 菲律宾语（菲律宾）         | filPH | dateFilPH |        |
+| 法语                       | frFR  | dateFrFR  |        |
+| 加利西亚语（西班牙）       | glES  | dateGlES  |        |
+| 古吉拉特语（印度）         | guIN  | dateGuIN  |        |
+| 希伯来语（以色列）         | heIL  | dateHeIL  |        |
+| 印地语（印度）             | hiIN  | dateHiIN  |        |
+| 克罗地亚语（克罗地亚）     | hrHR  | dateHrHR  |        |
+| 匈牙利语（匈牙利）         | huHU  | dateHuHU  |        |
+| 亚美尼亚语（亚美尼亚）     | hyAM  | dateHyAM  |        |
+| 印度尼西亚语               | idID  | dateIdID  |        |
+| 冰岛语（冰岛）             | isIS  | dateIsIS  |        |
+| 意大利语                   | itIT  | dateItIT  | 2.24.2 |
+| 日语                       | jaJP  | dateJaJP  |        |
+| 格鲁吉亚语（格鲁吉亚）     | kaGE  | dateKaGE  |        |
+| 哈萨克语（哈萨克斯坦）     | kkKZ  | dateKkKZ  |        |
+| 高棉语（柬埔寨）           | kmKH  | dateKmKH  | 2.41.0 |
+| 卡纳达语（印度）           | knIN  | dateKnIN  |        |
+| 韩语                       | koKR  | dateKoKR  | 2.28.1 |
+| 吉尔吉斯语（吉尔吉斯斯坦） | kyKG  | dateKyKG  |        |
+| 老挝语（老挝）             | loLA  | dateLoLA  |        |
+| 立陶宛语（立陶宛）         | ltLT  | dateLtLT  |        |
+| 拉脱维亚语（拉脱维亚）     | lvLV  | dateLvLV  |        |
+| 马其顿语（北马其顿）       | mkMK  | dateMkMK  |        |
+| 马拉雅拉姆语（印度）       | mlIN  | dateMlIN  |        |
+| 蒙古语（蒙古）             | mnMN  | dateMnMN  |        |
+| 马拉地语（印度）           | mrIN  | dateMrIN  |        |
+| 马来语（马来西亚）         | msMY  | dateMsMY  |        |
+| 缅甸语（缅甸）             | myMM  | dateMyMM  |        |
+| 书面挪威语                 | nbNO  | dateNbNO  |        |
+| 尼泊尔语（尼泊尔）         | neNP  | dateNeNP  |        |
+| 荷兰语（荷兰）             | nlNL  | dateNlNL  | 2.29.0 |
+| 新挪威语                   | nnNO  | dateNnNO  |        |
+| 旁遮普语（印度）           | paIN  | datePaIN  |        |
+| 波兰语（波兰）             | plPL  | datePlPL  | 2.25.2 |
+| 葡萄牙语 (巴西)            | ptBR  | datePtBR  | 2.28.1 |
+| 葡萄牙语（葡萄牙）         | ptPT  | datePtPT  |        |
+| 罗曼什语（瑞士）           | rmCH  | dateRmCH  |        |
+| 罗马尼亚语（罗马尼亚）     | roRO  | dateRoRO  |        |
+| 俄罗斯语           
```

**File**: `src/locales/common/afZA.ts` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+import type { NLocale } from './enUS'
+
+const afZA: NLocale = {
+  name: 'af-ZA',
+  global: {
+    undo: 'Ontdoen',
+    redo: 'Herdoen',
+    confirm: 'Bevestig',
+    clear: 'Maak skoon'
+  },
+  Popconfirm: {
+    positiveText: 'Bevestig',
+    negativeText: 'Kanselleer'
+  },
+  Cascader: {
+    placeholder: 'Kies asseblief',
+    loading: 'Laai tans',
+    loadingRequiredMessage: (label: string): string =>
+      `Laai asseblief al ${label} se afstammelinge voordat u dit kies.`
+  },
+  Time: {
+    dateFormat: 'yyyy-MM-dd',
+    dateTimeFormat: 'yyyy-MM-dd HH:mm:ss'
+  },
+  DatePicker: {
+    yearFormat: 'yyyy',
+    monthFormat: 'MMM',
+    dayFormat: 'eeeeee',
+    yearTypeFormat: 'yyyy',
+    monthTypeFormat: 'yyyy-MM',
+    dateFormat: 'yyyy-MM-dd',
+    dateTimeFormat: 'yyyy-MM-dd HH:mm:ss',
+    quarterFormat: 'yyyy-qqq',
+    weekFormat: 'YYYY-w',
+    clear: 'Maak skoon',
+    now: 'Nou',
+    confirm: 'Bevestig',
+    selectTime: 'Kies tyd',
+    selectDate: 'Kies datum',
+    datePlaceholder: 'Kies datum',
+    datetimePlaceholder: 'Kies datum en tyd',
+    monthPlaceholder: 'Kies maand',
+    yearPlaceholder: 'Kies jaar',
+    quarterPlaceholder: 'Kies kwartaal',
+    weekPlaceholder: 'Kies week',
+    startDatePlaceholder: 'Begindatum',
+    endDatePlaceholder: 'Einddatum',
+    startDatetimePlaceholder: 'Begin datum en tyd',
+    endDatetimePlaceholder: 'Eind datum en tyd',
+    startMonthPlaceholder: 'Beginmaand',
+    endMonthPlaceholder: 'Eindmaand',
+    monthBeforeYear: true,
+    firstDayOfWeek: 6 as 0 | 1 | 2 | 3 | 4 | 5 | 6,
+    today: 'Vandag'
+  },
+  DataTable: {
+    checkTableAll: 'Kies alles in die tabel',
+    uncheckTableAll: 'Ontkies alles in die tabel',
+    confirm: 'Bevestig',
+    clear: 'Maak skoon'
+  },
+  LegacyTransfer: {
+    sourceTitle: 'Bron',
+    targetTitle: 'Teiken'
+  },
+  Transfer: {
+    selectAll: 'Kies alles',
+    unselectAll: 'Ontkies alles',
+    clearAll: 'Maak skoon',
+    total: (num: number): string => `Totaal ${num} items`,
+    selected: (num: number): string => `${num} items gekies`
+  },
+  Empty: {
+    description: 'Geen data'
+  },
+  Select: {
+    placeholder: 'Kies asseblief'
+  },
+  TimePicker: {
+    placeholder: 'Kies tyd',
+    positiveText: 'OK',
+    negativeText: 'Kanselleer',
+    now: 'Nou',
+    clear: 'Maak skoon'
+  },
+  Pagination: {
+    goto: 'Gaan na',
+    selectionSuffix: 'bladsy'
+  },
+  DynamicTags: {
+    add: 'Voeg by'
+  },
+  Log: {
+    loading: 'Laai tans'
+  },
+  Input: {
+    placeholder: 'Voer asseblief in'
+  },
+  InputNumber: {
+    placeholder: 'Voer asseblief in'
+  },
+  DynamicInput: {
+    create: 'Skep'
+  },
+  ThemeEditor: {
+    title: 'Tema-redigeerder',
+    clearAllVars: 'Vee alle veranderlikes uit',
+    clearSearch: 'Maak soektog skoon',
+    filterCompName: 'Filter komponentnaam',
+    filterVarName: 'Filter veranderlikenaam',
+    import: 'Voer in',
+    export: 'Voer uit',
+    restore: 'Herstel na verstek'
+  },
+  Image: {
+    tipPrevious: 'Vorige prent (←)',
+    tipNext: 'Volgende prent (→)',
+    tipCounterclockwise: 'Teen die kloksgewys',
+    tipClockwise: 'Kloksgewys',
+    tipZoomOut: 'Zoem uit',
+    tipZoomIn: 'Zoem in',
+    tipDownload: 'Aflaai',
+    tipClose: 'Sluit (Esc)',
+    tipOriginalSize: 'Zoem na oorspronklike grootte'
+  },
+  Heatmap: {
+    less: 'minder',
+    more: 'meer',
+    monthFormat: 'MMM',
+    weekdayFormat: 'eeeeee'
+  }
+}
+
+export default afZA
```

**File**: `src/locales/common/amET.ts` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+import type { NLocale } from './enUS'
+
+const amET: NLocale = {
+  name: 'am-ET',
+  global: {
+    undo: 'ቀልብስ',
+    redo: 'ድገም',
+    confirm: 'አረጋግጥ',
+    clear: 'አጽዳ'
+  },
+  Popconfirm: {
+    positiveText: 'አረጋግጥ',
+    negativeText: 'ሰርዝ'
+  },
+  Cascader: {
+    placeholder: 'እባክዎ ይምረጡ',
+    loading: 'በመጫን ላይ',
+    loadingRequiredMessage: (label: string): string =>
+      `ከመምረጥዎ በፊት የ${label}ን ሁሉንም ልጆች ይጫኑ።`
+  },
+  Time: {
+    dateFormat: 'dd/MM/yyyy',
+    dateTimeFormat: 'dd/MM/yyyy HH:mm:ss'
+  },
+  DatePicker: {
+    yearFormat: 'yyyy',
+    monthFormat: 'MMM',
+    dayFormat: 'eeeeee',
+    yearTypeFormat: 'yyyy',
+    monthTypeFormat: 'MM/yyyy',
+    dateFormat: 'dd/MM/yyyy',
+    dateTimeFormat: 'dd/MM/yyyy HH:mm:ss',
+    quarterFormat: 'yyyy-qqq',
+    weekFormat: 'YYYY-w',
+    clear: 'አጽዳ',
+    now: 'አሁን',
+    confirm: 'አረጋግጥ',
+    selectTime: 'ሰዓት ይምረጡ',
+    selectDate: 'ቀን ይምረጡ',
+    datePlaceholder: 'ቀን ይምረጡ',
+    datetimePlaceholder: 'ቀን እና ሰዓት ይምረጡ',
+    monthPlaceholder: 'ወር ይምረጡ',
+    yearPlaceholder: 'ዓመት ይምረጡ',
+    quarterPlaceholder: 'ሩብ ዓመት ይምረጡ',
+    weekPlaceholder: 'ሳምንት ይምረጡ',
+    startDatePlaceholder: 'መጀመሪያ ቀን',
+    endDatePlaceholder: 'መጨረሻ ቀን',
+    startDatetimePlaceholder: 'መጀመሪያ ቀን እና ሰዓት',
+    endDatetimePlaceholder: 'መጨረሻ ቀን እና ሰዓት',
+    startMonthPlaceholder: 'መጀመሪያ ወር',
+    endMonthPlaceholder: 'መጨረሻ ወር',
+    monthBeforeYear: true,
+    firstDayOfWeek: 6 as 0 | 1 | 2 | 3 | 4 | 5 | 6,
+    today: 'ዛሬ'
+  },
+  DataTable: {
+    checkTableAll: 'በሰንጠረዡ ሁሉንም ምረጥ',
+    uncheckTableAll: 'በሰንጠረዡ ሁሉንም አንሳ',
+    confirm: 'አረጋግጥ',
+    clear: 'አጽዳ'
+  },
+  LegacyTransfer: {
+    sourceTitle: 'ምንጭ',
+    targetTitle: 'መድረሻ'
+  },
+  Transfer: {
+    selectAll: 'ሁሉንም ምረጥ',
+    unselectAll: 'ሁሉንም አንሳ',
+    clearAll: 'አጽዳ',
+    total: (num: number): string => `በጠቅላላ ${num} ንጥሎች`,
+    selected: (num: number): string => `${num} ንጥሎች ተመርጠዋል`
+  },
+  Empty: {
+    description: 'መረጃ የለም'
+  },
+  Select: {
+    placeholder: 'እባክዎ ይምረጡ'
+  },
+  TimePicker: {
+    placeholder: 'ሰዓት ይምረጡ',
+    positiveText: 'እሺ',
+    negativeText: 'ሰርዝ',
+    now: 'አሁን',
+    clear: 'አጽዳ'
+  },
+  Pagination: {
+    goto: 'ሂድ ወደ',
+    selectionSuffix: 'ገጽ'
+  },
+  DynamicTags: {
+    add: 'ጨምር'
+  },
+  Log: {
+    loading: 'በመጫን ላይ'
+  },
+  Input: {
+    placeholder: 'እባክዎ ያስገቡ'
+  },
+  InputNumber: {
+    placeholder: 'እባክዎ ያስገቡ'
+  },
+  DynamicInput: {
+    create: 'ፍጠር'
+  },
+  ThemeEditor: {
+    title: 'የገጽታ አርታኢ',
+    clearAllVars: 'ሁሉንም ተለዋዋጮች አጽዳ',
+    clearSearch: 'ፍለጋን አጽዳ',
+    filterCompName: 'የአካል ስም አጣራ',
+    filterVarName: 'የተለዋዋጭ ስም አጣራ',
+    import: 'አስመጣ',
+    export: 'ወደ ውጭ ላክ',
+    restore: 'ወደ ነባሪ መልስ'
+  },
+  Image: {
+    tipPrevious: 'ቀዳሚ ምስል (←)',
+    tipNext: 'ቀጣይ ምስል (→)',
+    tipCounterclockwise: 'ከሰዓት በተቃራኒ',
+    tipClockwise: 'ከሰዓት አቅጣጫ',
+    tipZoomOut: 'አሳንስ',
+    tipZoomIn: 'አጉላ',
+    tipDownload: 'አውርድ',
+    tipClose: 'ዝጋ (Esc)',
+    tipOriginalSize: 'ወደ ኦሪጂናል መጠን አጉላ'
+  },
+  Heatmap: {
+    less: 'ያነሰ',
+    more: 'ተጨማሪ',
+    monthFormat: 'MMM',
+    weekdayFormat: 'eeeeee'
+  }
+}
+
+export default amET
```

**File**: `src/locales/common/beBY.ts` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+import type { NLocale } from './enUS'
+
+const beBY: NLocale = {
+  name: 'be-BY',
+  global: {
+    undo: 'Адмяніць',
+    redo: 'Паўтарыць',
+    confirm: 'Пацвердзіць',
+    clear: 'Ачысціць'
+  },
+  Popconfirm: {
+    positiveText: 'Пацвердзіць',
+    negativeText: 'Скасаваць'
+  },
+  Cascader: {
+    placeholder: 'Калі ласка, выберыце',
+    loading: 'Загрузка',
+    loadingRequiredMessage: (label: string): string =>
+      `Загрузіце ўсе нашчадкі ${label} перад выбарам.`
+  },
+  Time: {
+    dateFormat: 'dd.MM.yyyy',
+    dateTimeFormat: 'dd.MM.yyyy HH:mm:ss'
+  },
+  DatePicker: {
+    yearFormat: 'yyyy',
+    monthFormat: 'MMM',
+    dayFormat: 'eeeeee',
+    yearTypeFormat: 'yyyy',
+    monthTypeFormat: 'MM.yyyy',
+    dateFormat: 'dd.MM.yyyy',
+    dateTimeFormat: 'dd.MM.yyyy HH:mm:ss',
+    quarterFormat: 'yyyy-qqq',
+    weekFormat: 'YYYY-w',
+    clear: 'Ачысціць',
+    now: 'Зараз',
+    confirm: 'Пацвердзіць',
+    selectTime: 'Выбраць час',
+    selectDate: 'Выбраць дату',
+    datePlaceholder: 'Выбраць дату',
+    datetimePlaceholder: 'Выбраць дату і час',
+    monthPlaceholder: 'Выбраць месяц',
+    yearPlaceholder: 'Выбраць год',
+    quarterPlaceholder: 'Выбраць квартал',
+    weekPlaceholder: 'Выбраць тыдзень',
+    startDatePlaceholder: 'Дата пачатку',
+    endDatePlaceholder: 'Дата заканчэння',
+    startDatetimePlaceholder: 'Дата і час пачатку',
+    endDatetimePlaceholder: 'Дата і час заканчэння',
+    startMonthPlaceholder: 'Месяц пачатку',
+    endMonthPlaceholder: 'Месяц заканчэння',
+    monthBeforeYear: true,
+    firstDayOfWeek: 0 as 0 | 1 | 2 | 3 | 4 | 5 | 6,
+    today: 'Сёння'
+  },
+  DataTable: {
+    checkTableAll: 'Выбраць усё ў табліцы',
+    uncheckTableAll: 'Зняць выбар з усяго ў табліцы',
+    confirm: 'Пацвердзіць',
+    clear: 'Ачысціць'
+  },
+  LegacyTransfer: {
+    sourceTitle: 'Крыніца',
+    targetTitle: 'Прызначэнне'
+  },
+  Transfer: {
+    selectAll: 'Выбраць усё',
+    unselectAll: 'Зняць выбар',
+    clearAll: 'Ачысціць',
+    total: (num: number): string => `Усяго ${num} элементаў`,
+    selected: (num: number): string => `Выбрана ${num} элементаў`
+  },
+  Empty: {
+    description: 'Няма даных'
+  },
+  Select: {
+    placeholder: 'Калі ласка, выберыце'
+  },
+  TimePicker: {
+    placeholder: 'Выбраць час',
+    positiveText: 'ОК',
+    negativeText: 'Скасаваць',
+    now: 'Зараз',
+    clear: 'Ачысціць'
+  },
+  Pagination: {
+    goto: 'Перайсці да',
+    selectionSuffix: 'старонка'
+  },
+  DynamicTags: {
+    add: 'Дадаць'
+  },
+  Log: {
+    loading: 'Загрузка'
+  },
+  Input: {
+    placeholder: 'Калі ласка, увядзіце'
+  },
+  InputNumber: {
+    placeholder: 'Калі ласка, увядзіце'
+  },
+  DynamicInput: {
+    create: 'Стварыць'
+  },
+  ThemeEditor: {
+    title: 'Рэдактар тэмы',
+    clearAllVars: 'Ачысціць усе зменныя',
+    clearSearch: 'Ачысціць пошук',
+    filterCompName: 'Фільтр назвы кампанента',
+    filterVarName: 'Фільтр назвы зменнай',
+    import: 'Імпартаваць',
+    export: 'Экспартаваць',
+    restore: 'Скінуць да прадвызначаных'
+  },
+  Image: {
+    tipPrevious: 'Папярэдняя выява (←)',
+    tipNext: 'Наступная выява (→)',
+    tipCounterclockwise: 'Супраць гадзіннікавай стрэлкі',
+    tipClockwise: 'Па гадзіннікавай стрэлцы',
+    tipZoomOut: 'Паменшыць',
+    tipZoomIn: 'Павялічыць',
+    tipDownload: 'Спампаваць',
+    tipClose: 'Закрыць (Esc)',
+    tipOriginalSize: 'Маштаб да зыходнага памеру'
+  },
+  Heatmap: {
+    less: 'менш',
+    more: 'больш',
+    monthFormat: 'MMM',
+    weekdayFormat: 'eeeeee'
+  }
+}
+
+export default beBY
```

**File**: `src/locales/common/bgBG.ts` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+import type { NLocale } from './enUS'
+
+const bgBG: NLocale = {
+  name: 'bg-BG',
+  global: {
+    undo: 'Отмени',
+    redo: 'Повтори',
+    confirm: 'Потвърди',
+    clear: 'Изчисти'
+  },
+  Popconfirm: {
+    positiveText: 'Потвърди',
+    negativeText: 'Отказ'
+  },
+  Cascader: {
+    placeholder: 'Моля, изберете',
+    loading: 'Зареждане',
+    loadingRequiredMessage: (label: string): string =>
+      `Моля, заредете всички наследници на ${label} преди да го изберете.`
+  },
+  Time: {
+    dateFormat: 'dd.MM.yyyy',
+    dateTimeFormat: 'dd.MM.yyyy HH:mm:ss'
+  },
+  DatePicker: {
+    yearFormat: 'yyyy',
+    monthFormat: 'MMM',
+    dayFormat: 'eeeeee',
+    yearTypeFormat: 'yyyy',
+    monthTypeFormat: 'MM.yyyy',
+    dateFormat: 'dd.MM.yyyy',
+    dateTimeFormat: 'dd.MM.yyyy HH:mm:ss',
+    quarterFormat: 'yyyy-qqq',
+    weekFormat: 'YYYY-w',
+    clear: 'Изчисти',
+    now: 'Сега',
+    confirm: 'Потвърди',
+    selectTime: 'Изберете час',
+    selectDate: 'Изберете дата',
+    datePlaceholder: 'Изберете дата',
+    datetimePlaceholder: 'Изберете дата и час',
+    monthPlaceholder: 'Изберете месец',
+    yearPlaceholder: 'Изберете година',
+    quarterPlaceholder: 'Изберете тримесечие',
+    weekPlaceholder: 'Изберете седмица',
+    startDatePlaceholder: 'Начална дата',
+    endDatePlaceholder: 'Крайна дата',
+    startDatetimePlaceholder: 'Начална дата и час',
+    endDatetimePlaceholder: 'Крайна дата и час',
+    startMonthPlaceholder: 'Начален месец',
+    endMonthPlaceholder: 'Краен месец',
+    monthBeforeYear: true,
+    firstDayOfWeek: 0 as 0 | 1 | 2 | 3 | 4 | 5 | 6,
+    today: 'Днес'
+  },
+  DataTable: {
+    checkTableAll: 'Избери всички в таблицата',
+    uncheckTableAll: 'Отмени избора в таблицата',
+    confirm: 'Потвърди',
+    clear: 'Изчисти'
+  },
+  LegacyTransfer: {
+    sourceTitle: 'Източник',
+    targetTitle: 'Цел'
+  },
+  Transfer: {
+    selectAll: 'Избери всички',
+    unselectAll: 'Отмени всички',
+    clearAll: 'Изчисти',
+    total: (num: number): string => `Общо ${num} елемента`,
+    selected: (num: number): string => `Избрани ${num} елемента`
+  },
+  Empty: {
+    description: 'Няма данни'
+  },
+  Select: {
+    placeholder: 'Моля, изберете'
+  },
+  TimePicker: {
+    placeholder: 'Изберете час',
+    positiveText: 'ОК',
+    negativeText: 'Отказ',
+    now: 'Сега',
+    clear: 'Изчисти'
+  },
+  Pagination: {
+    goto: 'Към',
+    selectionSuffix: 'страница'
+  },
+  DynamicTags: {
+    add: 'Добави'
+  },
+  Log: {
+    loading: 'Зареждане'
+  },
+  Input: {
+    placeholder: 'Моля, въведете'
+  },
+  InputNumber: {
+    placeholder: 'Моля, въведете'
+  },
+  DynamicInput: {
+    create: 'Създай'
+  },
+  ThemeEditor: {
+    title: 'Редактор на тема',
+    clearAllVars: 'Изчисти всички променливи',
+    clearSearch: 'Изчисти търсенето',
+    filterCompName: 'Филтър по име на компонент',
+    filterVarName: 'Филтър по име на променлива',
+    import: 'Импортиране',
+    export: 'Експортиране',
+    restore: 'Възстанови по подразбиране'
+  },
+  Image: {
+    tipPrevious: 'Предишно изображение (←)',
+    tipNext: 'Следващо изображение (→)',
+    tipCounterclockwise: 'Обратно на часовниковата стрелка',
+    tipClockwise: 'По часовниковата стрелка',
+    tipZoomOut: 'Намали',
+    tipZoomIn: 'Увеличи',
+    tipDownload: 'Изтегли',
+    tipClose: 'Затвори (Esc)',
+    tipOriginalSize: 'Мащаб към оригинален размер'
+  },
+  Heatmap: {
+    less: 'по-малко',
+    more: 'повече',
+    monthFormat: 'MMM',
+    weekdayFormat: 'eeeeee'
+  }
+}
+
+export default bgBG
```

---

### Incident Patch 11: `35d3a21e` (2026-08-19)
**Commit Message**: fix(dialog, notification, modal, dropdown): resolve issues with action callbacks and event handling, closes #8186

**File**: `CHANGELOG.en-US.md` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@
 ### Fixes
 
 - Fix `n-data-table` and `n-equation` warning `injection "n-config-provider" not found` when used without `n-config-provider`.
+- Fix `useDialog` treating `onPositiveClick`, `onNegativeClick` and `onClose` as arrays, closes [#8186](https://github.com/tusen-ai/naive-ui/issues/8186).
+- Fix `useNotification` treating `onClose` as an array.
+- Fix `n-modal` / `useModal` treating dialog action callbacks as arrays.
+- Fix `n-dropdown` `on-update:show` being called twice.
 
 ## 2.45.0
 
```

**File**: `CHANGELOG.zh-CN.md` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@
 ### Fixes
 
 - 修复 `n-data-table`、`n-equation` 在未包裹 `n-config-provider` 时出现 `injection "n-config-provider" not found` 警告
+- 修复 `useDialog` 的 `onPositiveClick`、`onNegativeClick`、`onClose` 被识别为数组的问题，关闭 [#8186](https://github.com/tusen-ai/naive-ui/issues/8186)
+- 修复 `useNotification` 的 `onClose` 被识别为数组的问题
+- 修复 `n-modal` / `useModal` 对话框操作回调被识别为数组的问题
+- 修复 `n-dropdown` 的 `on-update:show` 被触发两次的问题
 
 ## 2.45.0
 
```

**File**: `src/dialog/src/DialogEnvironment.tsx` (modified, +7/-6)
```diff
@@ -169,12 +169,13 @@ export const NDialogEnvironment = defineComponent({
         {{
           default: ({ draggableClass }: { draggableClass: string }) => (
             <NDialog
-              {...keep(this.$props, dialogPropKeys)}
-              titleClass={normalizeClass([this.titleClass, draggableClass])}
-              style={this.internalStyle}
-              onClose={handleCloseClick}
-              onNegativeClick={handleNegativeClick}
-              onPositiveClick={handlePositiveClick}
+              {...keep(this.$props, dialogPropKeys, {
+                titleClass: normalizeClass([this.titleClass, draggableClass]),
+                style: this.internalStyle,
+                onClose: handleCloseClick,
+                onNegativeClick: handleNegativeClick,
+                onPositiveClick: handlePositiveClick
+              })}
             />
           )
         }}
```

**File**: `src/dialog/tests/Dialog.spec.tsx` (modified, +53/-0)
```diff
@@ -285,4 +285,57 @@ describe('n-dialog', () => {
     )
     wrapper.unmount()
   })
+
+  it('should work with action callbacks', async () => {
+    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
+
+    async function mountDialog(dialogProps: DialogProps) {
+      const Test = createTestComponent('warning', dialogProps)
+      const wrapper = mount(() => (
+        <Provider>{{ default: () => <Test /> }}</Provider>
+      ))
+      await nextTick()
+      return wrapper
+    }
+
+    function hasArrayPropWarning(propName: string): boolean {
+      return warnSpy.mock.calls.some(args =>
+        String(args[0]).includes(
+          `Invalid prop: type check failed for prop "${propName}". Expected Function, got Array`
+        )
+      )
+    }
+
+    const onPositiveClick = vi.fn()
+    const positiveWrapper = await mountDialog({
+      positiveText: 'ok',
+      onPositiveClick
+    })
+    expect(hasArrayPropWarning('onPositiveClick')).toBe(false)
+    document.querySelector<HTMLElement>('.n-dialog .n-button')?.click()
+    await nextTick()
+    expect(onPositiveClick).toHaveBeenCalledTimes(1)
+    positiveWrapper.unmount()
+
+    const onNegativeClick = vi.fn()
+    const negativeWrapper = await mountDialog({
+      negativeText: 'cancel',
+      onNegativeClick
+    })
+    expect(hasArrayPropWarning('onNegativeClick')).toBe(false)
+    document.querySelector<HTMLElement>('.n-dialog .n-button')?.click()
+    await nextTick()
+    expect(onNegativeClick).toHaveBeenCalledTimes(1)
+    negativeWrapper.unmount()
+
+    const onClose = vi.fn()
+    const closeWrapper = await mountDialog({ onClose })
+    expect(hasArrayPropWarning('onClose')).toBe(false)
+    document.querySelector<HTMLElement>('.n-dialog .n-base-close')?.click()
+    await nextTick()
+    expect(onClose).toHaveBeenCalledTimes(1)
+    closeWrapper.unmount()
+
+    warnSpy.mockRestore()
+  })
 })
```

**File**: `src/dropdown/src/Dropdown.tsx` (modified, +1/-1)
```diff
@@ -488,7 +488,7 @@ export default defineComponent({
       'onUpdate:show': undefined
     }
     return (
-      <NPopover {...keep(this.$props, popoverPropKeys)} {...popoverProps}>
+      <NPopover {...keep(this.$props, popoverPropKeys, popoverProps)}>
         {{
           trigger: () => this.$slots.default?.()
         }}
```

**File**: `src/dropdown/tests/Dropdown.spec.tsx` (modified, +19/-0)
```diff
@@ -300,4 +300,23 @@ describe('n-dropdown', () => {
   it('should accept empty object in type-checking phase', () => {
     ;<NDropdown options={[{}]} />
   })
+
+  it('should call onUpdateShow once', async () => {
+    const onUpdateShow = vi.fn()
+    const wrapper = mount(NDropdown, {
+      attachTo: document.body,
+      props: {
+        options,
+        trigger: 'click',
+        onUpdateShow
+      },
+      slots: {
+        default: () => 'star kirby'
+      }
+    })
+    await wrapper.find('span').trigger('click')
+    expect(onUpdateShow).toHaveBeenCalledTimes(1)
+    expect(onUpdateShow).toHaveBeenCalledWith(true)
+    wrapper.unmount()
+  })
 })
```

**File**: `src/modal/src/Modal.tsx` (modified, +6/-1)
```diff
@@ -25,6 +25,7 @@ import {
   call,
   eventEffectNotPerformed,
   keep,
+  omit,
   useIsComposing,
   warnOnce
 } from '../../_utils'
@@ -297,7 +298,11 @@ export default defineComponent({
       presetProps: computed(() => {
         const pickedProps = keep(props, presetPropsKeys)
         // TODO: remove as any after vue fix the issue introduced in 3.2.27
-        return pickedProps as any
+        return omit(pickedProps, [
+          'onClose',
+          'onNegativeClick',
+          'onPositiveClick'
+        ]) as any
       }),
       handleEsc,
       handleAfterLeave,
```

**File**: `src/modal/src/ModalEnvironment.tsx` (modified, +13/-1)
```diff
@@ -2,6 +2,7 @@ import type { PropType } from 'vue'
 // use absolute path to make sure no circular ref of style
 // this -> modal-index -> modal-style
 import { defineComponent, h, ref } from 'vue'
+import { call, omit } from '../../_utils'
 import NModal, { modalProps } from './Modal'
 
 export const NModalEnvironment = defineComponent({
@@ -85,6 +86,11 @@ export const NModalEnvironment = defineComponent({
       showRef.value = false
     }
     function handleUpdateShow(value: boolean): void {
+      const { onUpdateShow, 'onUpdate:show': _onUpdateShow } = props
+      if (onUpdateShow)
+        call(onUpdateShow, value)
+      if (_onUpdateShow)
+        call(_onUpdateShow, value)
       showRef.value = value
     }
     return {
@@ -109,7 +115,13 @@ export const NModalEnvironment = defineComponent({
     } = this
     return (
       <NModal
-        {...this.$props}
+        {...omit(this.$props, [
+          'onUpdateShow',
+          'onUpdate:show',
+          'onMaskClick',
+          'onEsc',
+          'onAfterLeave'
+        ])}
         show={show}
         onUpdateShow={handleUpdateShow}
         onMaskClick={handleMaskClick}
```

---

### Incident Patch 12: `17a190f9` (2026-08-16)
**Commit Message**: fix(equation, data-table): warning `injection "n-config-provider" not found` when used without `n-config-provider`

**File**: `CHANGELOG.en-US.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # CHANGELOG
 
+## NEXT_VERSION
+
+### Fixes
+
+- Fix `n-data-table` and `n-equation` warning `injection "n-config-provider" not found` when used without `n-config-provider`.
+
 ## 2.45.0
 
 `2026-08-16`
```

**File**: `CHANGELOG.zh-CN.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # CHANGELOG
 
+## NEXT_VERSION
+
+### Fixes
+
+- 修复 `n-data-table`、`n-equation` 在未包裹 `n-config-provider` 时出现 `injection "n-config-provider" not found` 警告
+
 ## 2.45.0
 
 `2026-08-16`
```

**File**: `src/data-table/src/TableParts/Body.tsx` (modified, +1/-1)
```diff
@@ -205,7 +205,7 @@ export default defineComponent({
       xScrollableRef,
       explicitlyScrollableRef
     } = inject(dataTableInjectionKey)!
-    const NConfigProvider = inject(configProviderInjectionKey)
+    const NConfigProvider = inject(configProviderInjectionKey, null)
     const scrollbarInstRef = ref<ScrollbarInst | null>(null)
     const virtualListRef = ref<VirtualListInst | null>(null)
     const emptyElRef = ref<HTMLElement | null>(null)
```

**File**: `src/equation/src/Equation.tsx` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ export const Equation = defineComponent({
   name: 'Equation',
   props: equationProps,
   setup(props) {
-    const configProviderContext = inject(configProviderInjectionKey)
+    const configProviderContext = inject(configProviderInjectionKey, null)
     const extractedHtmlInfo = computed(() => {
       const outerHtml
         = (
```

---

### Incident Patch 13: `07d34958` (2026-08-16)
**Commit Message**: fix: exclude useless .d.ts in prod build

**File**: `scripts/post-build/check-artifacts.ts` (modified, +18/-2)
```diff
@@ -22,6 +22,14 @@ function isSuspiciousImportSpecifier(specifier: string): boolean {
   )
 }
 
+function isUnwantedDeclarationFile(fileName: string): boolean {
+  return (
+    fileName === 'global.d.ts'
+    || fileName === 'shims-vue.d.ts'
+    || fileName.endsWith('.d.d.ts')
+  )
+}
+
 export async function checkArtifacts(): Promise<void> {
   const roots = ['es', 'lib'].map(dir => path.resolve(process.cwd(), dir))
   const problems: string[] = []
@@ -43,8 +51,16 @@ export async function checkArtifacts(): Promise<void> {
       if (!filePath.endsWith('.d.ts'))
         continue
       const rel = path.relative(process.cwd(), filePath)
+      if (isUnwantedDeclarationFile(path.basename(filePath))) {
+        problems.push(`unwanted declaration file: ${rel}`)
+        continue
+      }
       const content = await fs.readFile(filePath, 'utf8')
       content.split('\n').forEach((line, index) => {
+        if (/\bconst\s+process\.env\b/.test(line)) {
+          problems.push(`${rel}:${index + 1}: ${line.trim()}`)
+          return
+        }
         const match = line.match(/from\s+['"]([^'"]+)['"]/)
         if (!match)
           return
@@ -66,7 +82,7 @@ export async function checkArtifacts(): Promise<void> {
     console.error(`  - ${problem}`)
   }
   throw new Error(
-    `Found ${problems.length} suspicious artifact path(s). `
-    + 'Declaration files must not embed host filesystem or node_modules paths.'
+    `Found ${problems.length} suspicious artifact issue(s). `
+    + 'Declaration files must not embed host paths, ambient shims, or define replacements.'
   )
 }
```

**File**: `tsdown.config.mts` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ const cjsLodashPlugin = {
 export default defineConfig({
   entry: [
     'src/**/*.{ts,tsx}',
+    '!src/**/*.d.ts',
     '!src/**/*.spec.*',
     '!src/vitest-setup.ts'
   ],
```

---

### Incident Patch 14: `a6d95f40` (2026-08-16)
**Commit Message**: build: release use vapor

**File**: `package.json` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@
     "build:themes": "tsc -b --force themes/tusimple/tsconfig.esm.json && tsc -b --force themes/tusimple/tsconfig.cjs.json",
     "build:site": "bash ./scripts/pre-build-site/pre-build-site.sh && cross-env NODE_ENV=production NODE_OPTIONS=--max-old-space-size=4096 vite build && bash ./scripts/post-build-site/post-build-site.sh",
     "clean": "rimraf site lib es dist node_modules/naive-ui themes/tusimple/es themes/tusimple/lib",
-    "release:package": "pnpm run test && pnpm run build:package && pnpm publish --no-git-checks",
+    "release:package": "pnpm run test && pnpm run build:package:vapor && pnpm publish --no-git-checks",
     "release:changelog": "tsx scripts/release-changelog.ts",
     "lint": "pnpm run lint:code && pnpm run lint:type",
     "lint:type": "pnpm run lint:src-type && pnpm run lint:demo-type",
```

---

### Incident Patch 15: `17e95278` (2026-08-16)
**Commit Message**: docs: update vapor build description

**File**: `CHANGELOG.en-US.md` (modified, +4/-0)
```diff
@@ -2,6 +2,10 @@
 
 ## NEXT_VERSION
 
+### Breaking Changes
+
+- Starting from this version, the package is built with vue-jsx-vapor. This is a significant change at the implementation level, but it is not expected to be breaking for end users: how you use naive-ui and how naive-ui behaves should remain the same. Being built with vue-jsx-vapor does not mean naive-ui ships as a native Vapor build; it is still VDOM-based. If you need to use naive-ui inside a pure Vapor app, you still need to enable interop.
+
 ### i18n
 
 - Add nnNO locale.
```

**File**: `CHANGELOG.zh-CN.md` (modified, +4/-0)
```diff
@@ -2,6 +2,10 @@
 
 ## NEXT_VERSION
 
+### Breaking Changes
+
+- 自此版本起，包产物改为使用 vue-jsx-vapor 构建。从底层来看，这是个较大的变更，但是此变更预期不会造成破坏性影响，即用户使用 naive-ui 的方式不会有变化，naive-ui 的表现也不会有变化。使用 vue-jsx-vapor 构建不代表 naive-ui 是原生 vapor 构建产物，它依然是 vdom 结构，如果你需要在纯 vapor app 中使用 naive-ui，仍然需要将 interop 设为 true。
+
 ### i18n
 
 - 新增 nnNO locale
```

#### Recent Merged Pull Requests:
- **PR #8206** (closed): test(pagination): import h in the virtual jump browser spec (@lazerg)
- **PR #8205** (closed): fix(modal): remove redundant omit that breaks the preset props type check (@lazerg)
- **PR #8204** (closed): fix(tree): when a scroll bar appears in the parent container, the highlighted background will be truncated (@liuzi6612)
- **PR #8199** (closed): feat: link the site header version number to the changelog (@lazerg)
- **PR #8192** (2026-08-21): fix(ellipsis, focus-detector): error when an optional event handler prop is not set (@lazerg)
- **PR #8189** (2026-08-21): fix(modal): forward positive/negative-click and close handlers only once to dialog and confirm presets (@lazerg)
- **PR #8183** (2026-08-21): docs(select): Fix typo (@iyoub)
- **PR #8182** (closed): fix(input-number): ignore Enter while IME composition is active (@lazerg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
