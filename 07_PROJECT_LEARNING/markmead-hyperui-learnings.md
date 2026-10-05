# Forensic Learning Record (Deep Inspection): markmead/hyperui

> **Canonical Artifact**: `07_PROJECT_LEARNING/markmead-hyperui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/markmead/hyperui](https://github.com/markmead/hyperui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:36:25.302Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `markmead/hyperui`
- **Description**: Free Tailwind CSS v4 components for your next project, designed to enhance your web development with the latest features and styles 🚀
- **Primary Language / Ecosystem**: Astro
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12253 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/lib/dark-mode/rule-renderer.js`
```
const INSPECTOR_ABORT_KEY = Symbol('inspectorAbortController')
const INSPECTOR_FLUSH_KEY = Symbol('inspectorFlush')

function parseCommaSeparatedList(inputValue, isLowercase = false) {
  return inputValue
    .split(',')
    .map((rawEntry) => (isLowercase ? rawEntry.trim().toLowerCase() : rawEntry.trim()))
    .filter(Boolean)
}

function formatDefaultRuleName(ruleIndex) {
  return `Rule ${ruleIndex + 1}`
}

export function buildRuleListItem(ruleData, ruleIndex, { onConfigure, onDelete, onToggleEnabled }) {
  const ruleListItem = document.createElement('li')
  ruleListItem.className =
    'flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2'

  const defaultRuleName = formatDefaultRuleName(ruleIndex)

  ruleListItem.innerHTML = `
    <input
      type="checkbox"
      class="rule-enabled size-4 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900 focus:ring-offset-1"
      aria-label="Enable rule"
    />
    <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-700"></span>
    <button
      type="button"
      data-configure-rule
      class="shrink-0 rounded px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >Configure</button>
    <button
      type="button"
      class="rule-delete shrink-0 rounded p-0.5 text-gray-600 transition-colors hover:text-red-600"
      aria-label="Delete rule"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    </button>
  `

  const enabledCheckbox = ruleListItem.querySelector('.rule-enabled')
  enabledCheckbox.checked = ruleData.enabled
  enabledCheckbox.addEventListener('change', () => {
    ruleData.enabled = enabledCheckbox.checked
    onToggleEnabled()
  })

  ruleListItem.querySelector('span').textContent = ruleData.name || defaultRuleName

  ruleListItem.querySelector('[data-configure-rule]').addEventListener('click', () => {
    onConfigure(ruleData.id)
  })

  ruleListItem.querySelector('.rule-delete').addEventListener('click', () => {
    onDelete(ruleData.id)
  })

  return ruleListItem
}

export function bindInspector(inspectorElement, ruleData, ruleIndex, { onChange, onNameChange }) {
  const previousFlush = inspectorElement[INSPECTOR_FLUSH_KEY]
  if (previousFlush) {
    previousFlush()
  }

  if (inspectorElement[INSPECTOR_ABORT_KEY]) {
    inspectorElement[INSPECTOR_ABORT_KEY].abort()
  }

  const abortController = new AbortController()
  inspectorElement[INSPECTOR_ABORT_KEY] = abortController
  const { signal: abortSignal } = abortController

  const defaultRuleName = formatDefaultRuleName(ruleIndex)

  const nameDisplay = inspectorElement.querySelector('[data-inspector-name-display]')
  const nameEditButton = inspectorElement.querySelector('[data-inspector-name-edit]')
  const nameInput = inspectorElement.querySelector('[data-inspector-name]')
  const utilitiesInput = inspectorElement.querySelector('[data-inspector-utilities]')
  const shadeInput = inspectorElement.querySelector('[data-inspector-shade]')
  const colorsInput = inspectorElement.querySelector('[data-inspector-colors]')
  const darkShadeInput = inspectorElement.querySelector('[data-inspector-dark-shade]')
  const darkColorInput = inspectorElement.querySelector('[data-inspector-dark-color]')
  const excludeElementsInput = inspectorElement.querySelector('[data-inspector-exclude-elements]')
  const excludeColorsInput = inspectorElement.querySelector('[data-inspector-exclude-colors]')

  nameDisplay.textContent = ruleData.name || defaultRuleName
  nameInput.value = ruleData.name || ''
  nameInput.placeholder = defaultRuleName
  utilitiesInput.value = (ruleData.utilities ?? []).join(', ')
  shadeInput.value = ruleData.shade !== null ? String(ruleData.shade) : ''
  colorsInput.value = (ruleData.colors ?? []).join(', ')
  darkShadeInput.value = ruleData.darkShade !== null ? String(ruleData.darkShade) : ''
  darkColorInput.value = ruleData.darkColor ?? ''
  excludeElementsInput.value = ruleData.excludeElements.join(', ')
  excludeColorsInput.value = ruleData.excludeColors.join(', ')

  nameInput.classList.add('hidden')
  nameDisplay.classList.remove('hidden')
  nameEditButton.classList.remove('hidden')

  inspectorElement[INSPECTOR_FLUSH_KEY] = () => {
    if (!nameInput.classList.contains('hidden')) {
      const pendingName = nameInput.value.trim()
      if (pendingName !== (ruleData.name || '')) {
        ruleData.name = pendingName
        onNameChange()
      }
    }
    inspectorElement[INSPECTOR_FLUSH_KEY] = null
  }

  nameEditButton.addEventListener(
    'click',
    () => {
      nameInput.value = ruleData.name || ''
      nameDisplay.classList.add('hidden')
      nameEditButton.classList.add('hidden')
      nameInput.classList.remove('hidden')
      nameInput.focus()
      nameInput.select()
    },
    { signal: abortSignal },
  )

  nameInput.addEventListener(
    'keydown',
    (keyEvent) => {
      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault()
        nameInput.blur()
      }
      if (keyEvent.key === 'Escape') {
        nameInput.value = ruleData.name || ''
        nameInput.blur()
      }
    },
    { signal: abortSignal },
  )

  nameInput.addEventListener(
    'blur',
    () => {
      const updatedName = nameInput.value.trim()
      if (updatedName !== (ruleData.name || '')) {
        ruleData.name = updatedName
        nameDisplay.textContent = updatedName || defaultRuleName
        onNameChange()
      } else {
        nameDisplay.textContent = ruleData.name || defaultRuleName
      }
      nameInput.classList.add('hidden')
      nameDisplay.classList.remove('hidden')
      nameEditButton.classList.remove('hidden')
    },
    { signal: abortSignal },
  )

  utilitiesInput.addEventListener(
    'change',
    () => {
      const parsedItems = parseCommaSeparatedList(utilitiesInput.value)
      ruleData.utilities = parsedItems.length > 0 ? parsedItems : null
      onChange()
    },
    { signal: abortSignal },
  )

  shadeInput.addEventListener(
    'change',
    () => {
      const parsedNumber = parseInt(shadeInput.value, 10)
      ruleData.shade = isNaN(parsedNumber) ? null : parsedNumber
      onChange()
    },
    { signal: abortSignal },
  )

  colorsInput.addEventListener(
    'change',
    () => {
      const parsedItems = parseCommaSeparatedList(colorsInput.value)
      ruleData.colors = parsedItems.length > 0 ? parsedItems : null
      onChange()
    },
    { signal: abortSignal },
  )

  darkShadeInput.addEventListener(
    'change',
    () => {
      const parsedNumber = parseInt(darkShadeInput.value, 10)
      ruleData.darkShade = isNaN(parsedNumber) ? null : parsedNumber
      onChange()
    },
    { signal: abortSignal },
  )

  darkColorInput.addEventListener(
    'change',
    () => {
      ruleData.darkColor = darkColorInput.value.trim() || null
      onChange()
    },
    { signal: abortSignal },
  )

  excludeElementsInput.addEventListener(
    'change',
    () => {
      ruleData.excludeElements = parseCommaSeparatedList(excludeElementsInput.value, true)
      onChange()
    },
    { signal: abortSignal },
  )

  excludeColorsInput.addEventListener(
    'change',
    () => {
      ruleData.excludeColors = parseCommaSeparatedList(excludeColorsInput.value)
      onChange()
    },
    { signal: abortSignal },
  )
}

```

### Core Architecture Module: `src/lib/dark-mode/ui-renderer.js`
```
import { INPUT_NO_SPINNER, ICON_MOVE_RIGHT, ICON_PLUS, ICON_MINUS } from './element-constants.js'
import { buildRuleListItem } from './rule-renderer.js'

export function renderUtilityToggles(containerElement, configData, onChangeCallback) {
  containerElement.innerHTML = ''

  for (const [utilityName, isEnabled] of Object.entries(configData.utilities)) {
    const toggleLabel = document.createElement('label')
    toggleLabel.className = 'cursor-pointer'

    const toggleCheckbox = document.createElement('input')
    toggleCheckbox.type = 'checkbox'
    toggleCheckbox.className = 'sr-only peer'
    toggleCheckbox.checked = isEnabled
    toggleCheckbox.setAttribute('aria-label', `${isEnabled ? 'Disable' : 'Enable'} ${utilityName}`)

    toggleCheckbox.addEventListener('change', () => {
      configData.utilities[utilityName] = toggleCheckbox.checked
      toggleCheckbox.setAttribute(
        'aria-label',
        `${toggleCheckbox.checked ? 'Disable' : 'Enable'} ${utilityName}`,
      )
      onChangeCallback()
    })

    const disabledPill = document.createElement('span')
    disabledPill.className =
      'peer-checked:hidden inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-500'
    disabledPill.innerHTML = ICON_PLUS
    disabledPill.appendChild(document.createTextNode(utilityName))

    const enabledPill = document.createElement('span')
    enabledPill.className =
      'hidden peer-checked:inline-flex items-center gap-1 rounded-full border border-gray-900 bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white'
    enabledPill.innerHTML = ICON_MINUS
    enabledPill.appendChild(document.createTextNode(utilityName))

    toggleLabel.appendChild(toggleCheckbox)
    toggleLabel.appendChild(disabledPill)
    toggleLabel.appendChild(enabledPill)
    containerElement.appendChild(toggleLabel)
  }
}

export function renderShadeMap(containerElement, configData, onChangeCallback) {
  containerElement.innerHTML = ''

  for (const [shadeValue, darkShadeValue] of Object.entries(configData.shadeMap)) {
    const shadeWrapper = document.createElement('div')
    shadeWrapper.className = 'flex items-center gap-2'

    const shadeLabel = document.createElement('span')
    shadeLabel.className = 'w-8 text-right shrink-0 text-sm font-medium text-gray-700'
    shadeLabel.textContent = shadeValue

    const iconWrapper = document.createElement('span')
    iconWrapper.innerHTML = ICON_MOVE_RIGHT

    const inputId = `dark-mode-shade-${shadeValue}`

    const visualLabel = document.createElement('label')
    visualLabel.className = 'sr-only'
    visualLabel.setAttribute('for', inputId)
    visualLabel.textContent = `Dark shade for shade-${shadeValue}`

    const shadeInput = document.createElement('input')
    shadeInput.type = 'number'
    shadeInput.id = inputId
    shadeInput.className = `w-16 rounded-md border-gray-200 align-bottom text-sm ${INPUT_NO_SPINNER}`
    shadeInput.value = String(darkShadeValue)
    shadeInput.min = '50'
    shadeInput.max = '950'
    shadeInput.step = '50'

    shadeInput.addEventListener('change', () => {
      const parsedValue = parseInt(shadeInput.value, 10)
      if (!isNaN(parsedValue)) {
        configData.shadeMap[parseInt(shadeValue, 10)] = parsedValue
        onChangeCallback()
      }
    })

    shadeWrapper.appendChild(visualLabel)
    shadeWrapper.appendChild(shadeLabel)
    shadeWrapper.appendChild(iconWrapper)
    shadeWrapper.appendChild(shadeInput)
    containerElement.appendChild(shadeWrapper)
  }
}

export function renderRules(containerElement, configData, { onDelete, onChange, onConfigure }) {
  containerElement.innerHTML = ''

  if (configData.rules.length === 0) {
    const emptyMessage = document.createElement('p')
    emptyMessage.className = 'text-sm text-gray-600'
    emptyMessage.textContent = 'No rules. Add one to override shade map defaults.'
    containerElement.appendChild(emptyMessage)
    return
  }

  configData.rules.forEach((ruleData, ruleIndex) => {
    containerElement.appendChild(
      buildRuleListItem(ruleData, ruleIndex, {
        onConfigure,
        onDelete,
        onToggleEnabled: onChange,
      }),
    )
  })
}

```

### Core Architecture Module: `src/utils/componentMarkup.ts`
```
const BODY_CONTENT_PATTERN = /<body[^>]*>([\s\S]*?)<\/body>/i

const rawComponentFileMap = import.meta.glob('../../public/examples/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const componentMarkupMap: Record<string, string> = {}

for (const [filePath, fileContent] of Object.entries(rawComponentFileMap)) {
  const normalizedSrc = filePath.replace(/^.*\/public/, '')

  componentMarkupMap[normalizedSrc] = fileContent
}

export function readComponentMarkup(componentSrc: string): string {
  const rawFileContent = componentMarkupMap[componentSrc]

  if (!rawFileContent) {
    return ''
  }

  const bodyContentMatch = rawFileContent.match(BODY_CONTENT_PATTERN)

  if (!bodyContentMatch) {
    return ''
  }

  return (bodyContentMatch[1] ?? '')
    .split('\n')
    .map((markupLine) => markupLine.replace(/^\s{4}/, ''))
    .join('\n')
    .trim()
}

```

### Core Architecture Module: `src/utils/readingTime.ts`
```
export function calculateReadingTime(text: string): number {
  const WORDS_PER_MINUTE = 200

  const trimmed = text.trim()

  if (trimmed.length === 0) {
    return 0
  }

  const words = trimmed.split(/\s+/).length

  return Math.ceil(words / WORDS_PER_MINUTE)
}

```

### Core Architecture Module: `src/utils/status.ts`
```
export type Status = 'beta' | 'coming-soon' | 'fresh' | 'stable' | 'updated'

const STATUS_MAP: Record<Status, { color: string; label: string }> = {
  beta: {
    color: 'bg-amber-500',
    label: 'Beta',
  },
  'coming-soon': {
    color: 'bg-gray-400',
    label: 'Coming Soon',
  },
  fresh: {
    color: 'bg-green-600',
    label: 'New',
  },
  stable: {
    color: 'bg-green-600',
    label: 'Stable',
  },
  updated: {
    color: 'bg-blue-500',
    label: 'Updated',
  },
}

export const getStatus = (status: Status): { color: string; label: string } => {
  const statusEntry = STATUS_MAP[status]

  if (!statusEntry) {
    throw new Error(`Unknown status: "${status}"`)
  }

  return statusEntry
}

```

### Core Architecture Module: `worker-configuration.d.ts`
```
/* eslint-disable */
// Generated by Wrangler by running `wrangler types` (hash: 4f9fe9ddb2ea1e2c41e1be5910da8551)
// Runtime types generated with workerd@1.20260923.1 2026-04-07 global_fetch_strictly_public
interface __BaseEnv_Env {
	ASSETS: Fetcher;
}
declare namespace Cloudflare {
	interface Env extends __BaseEnv_Env {}
}
interface Env extends __BaseEnv_Env {}

// Begin runtime types
/*! *****************************************************************************
Copyright (c) Cloudflare. All rights reserved.
Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0
THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.
See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* eslint-disable */
// noinspection JSUnusedGlobalSymbols
declare var onmessage: never;
/**
 * The **`DOMException`** interface represents an abnormal event (called an exception) that occurs as a result of calling a method or accessing a property of a web API. This is how error conditions are described in web APIs.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException)
 */
declare class DOMException extends Error {
    constructor(message?: string, name?: string);
    /**
     * The **`message`** read-only property of the DOMException interface returns a string representing a message or description associated with the given error name.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/message)
     */
    readonly message: string;
    /**
     * The **`name`** read-only property of the DOMException interface returns a string that contains one of the strings associated with an error name.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/name)
     */
    readonly name: string;
    /**
     * The **`code`** read-only property of the DOMException interface returns one of the legacy error code constants, or 0 if none match.
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/code)
     */
    readonly code: number;
    static readonly INDEX_SIZE_ERR: number;
    static readonly DOMSTRING_SIZE_ERR: number;
    static readonly HIERARCHY_REQUEST_ERR: number;
    static readonly WRONG_DOCUMENT_ERR: number;
    static readonly INVALID_CHARACTER_ERR: number;
    static readonly NO_DATA_ALLOWED_ERR: number;
    static readonly NO_MODIFICATION_ALLOWED_ERR: number;
    static readonly NOT_FOUND_ERR: number;
    static readonly NOT_SUPPORTED_ERR: number;
    static readonly INUSE_ATTRIBUTE_ERR: number;
    static readonly INVALID_STATE_ERR: number;
    static readonly SYNTAX_ERR: number;
    static readonly INVALID_MODIFICATION_ERR: number;
    static readonly NAMESPACE_ERR: number;
    static readonly INVALID_ACCESS_ERR: number;
    static readonly VALIDATION_ERR: number;
    static readonly TYPE_MISMATCH_ERR: number;
    static readonly SECURITY_ERR: number;
    static readonly NETWORK_ERR: number;
    static readonly ABORT_ERR: number;
    static readonly URL_MISMATCH_ERR: number;
    static readonly QUOTA_EXCEEDED_ERR: number;
    static readonly TIMEOUT_ERR: number;
    static readonly INVALID_NODE_TYPE_ERR: number;
    static readonly DATA_CLONE_ERR: number;
    get stack(): any;
    set stack(value: any);
}
type WorkerGlobalScopeEventMap = {
    fetch: FetchEvent;
    scheduled: ScheduledEvent;
    queue: QueueEvent;
    unhandledrejection: PromiseRejectionEvent;
    rejectionhandled: PromiseRejectionEvent;
};
declare abstract class WorkerGlobalScope extends EventTarget<WorkerGlobalScopeEventMap> {
    EventTarget: typeof EventTarget;
}
/* The **`console`** object provides access to the debugging console (e.g., the Web console in Firefox). *
 * The **`console`** object provides access to the debugging console (e.g., the Web console in Firefox).
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console)
 */
interface Console {
    "assert"(condition?: boolean, ...data: any[]): void;
    /**
     * The **`console.clear()`** static method clears the console if possible.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/clear_static)
     */
    clear(): void;
    /**
     * The **`console.count()`** static method logs the number of times that this particular call to count() has been called.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/count_static)
     */
    count(label?: string): void;
    /**
     * The **`console.countReset()`** static method resets counter used with console.count().
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/countReset_static)
     */
    countReset(label?: string): void;
    /**
     * The **`console.debug()`** static method outputs a message to the console at the "debug" log level. The message is only displayed to the user if the console is configured to display debug output. In most cases, the log level is configured within the console UI. This log level might correspond to the Debug or Verbose log level.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/debug_static)
     */
    debug(...data: any[]): void;
    /**
     * The **`console.dir()`** static method displays a list of the properties of the specified JavaScript object. In browser consoles, the output is presented as a hierarchical listing with disclosure triangles that let you see the contents of child objects.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/dir_static)
     */
    dir(item?: any, options?: any): void;
    /**
     * The **`console.dirxml()`** static method displays an interactive tree of the descendant elements of the specified XML/HTML element. If it is not possible to display as an element the JavaScript Object view is shown instead. The output is presented as a hierarchical listing of expandable nodes that let you see the contents of child nodes.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/dirxml_static)
     */
    dirxml(...data: any[]): void;
    /**
     * The **`console.error()`** static method outputs a message to the console at the "error" log level. The message is only displayed to the user if the console is configured to display error output. In most cases, the log level is configured within the console UI. The message may be formatted as an error, with red colors and call stack information.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/error_static)
     */
    error(...data: any[]): void;
    /**
     * The **`console.group()`** static method creates a new inline group in the Web console log, causing any subsequent console messages to be indented by an additional level, until console.groupEnd() is called.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/group_static)
     */
    group(...data: any[]): void;
    /**
     * The **`console.groupCollapsed()`** static method creates a new inline group in the console. Unlike console.group(), however, the new group is created collapsed. The user will need to use the disclosure button next to it to expand it, revealing the entries created in the group.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/groupCollapsed_static)
     */
    groupCollapsed(...data: any[]): void;
    /**
     * The **`console.groupEnd()`** static method exits the current inline group in the console. See Using groups in the console in the console documentation for details and examples.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/groupEnd_static)
     */
    groupEnd(): void;
    /**
     * The **`console.info()`** static method outputs a message to the console at the "info" log level. The message is only displayed to the user if the console is configured to display info output. In most cases, the log level is configured within the console UI. The message may receive special formatting, such as a small "i" icon next to it.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/info_static)
     */
    info(...data: any[]): void;
    /**
     * The **`console.log()`** static method outputs a message to the console.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/log_static)
     */
    log(...data: any[]): void;
    /**
     * The **`console.table()`** static method displays tabular data as a table.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/table_static)
     */
    table(tabularData?: any, properties?: string[]): void;
    /**
     * The **`console.time()`** static method starts a timer you can use to track how long an operation takes. You give each timer a unique name, and may have up to 10,000 timers running on a given page. When you call console.timeEnd() with the same name, the browser will output the time, in milliseconds, that elapsed since the timer was started.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/time_static)
     */
    time(label?: string): void;
    /**
     * The **`console.timeEnd()`** static method stops a timer that was previously started by calling console.time().
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/timeEnd_static)
     */
    timeEnd(label?: string): void;
    /**

```

### Core Architecture Module: `astro.config.ts`
```
import { defineConfig, fontProviders } from 'astro/config'

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

import tailwindcss from '@tailwindcss/vite'

import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  site: 'https://hyperui.dev',

  integrations: [mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    syntaxHighlight: false,
  },

  fonts: [
    {
      cssVariable: '--font-google-sans-flex',
      name: 'Google Sans Flex',
      provider: fontProviders.google(),
      weights: [400, 500, 600, 700, 800],
    },
  ],

  adapter: cloudflare(),
})

```

### Core Architecture Module: `eslint.config.ts`
```
import { defineConfig, globalIgnores } from 'eslint/config'

import astro from 'eslint-plugin-astro'
import js from '@eslint/js'
import globals from 'globals'
import typescript from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', '.astro', '*.d.ts']),

  js.configs.recommended,
  ...typescript.configs.recommended,
  ...astro.configs.recommended,

  {
    files: ['public/**', 'src/**'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: ['scripts/**'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
    },
  },
])

```

### Core Architecture Module: `playwright.config.js`
```
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4321/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})

```

### Core Architecture Module: `public/component.js`
```
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    if (e.target.closest('a, input[type="file"]')) {
      e.preventDefault()
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' && e.target.closest('a, input[type="file"]')) {
      e.preventDefault()
    }
  })

  document.addEventListener('submit', (e) => {
    e.preventDefault()
  })

  globalThis.addEventListener('message', (event) => {
    if (event.source !== globalThis.parent) {
      return
    }

    if (event.origin !== globalThis.location.origin) {
      return
    }

    if (typeof event.data !== 'object' || event.data === null) {
      return
    }

    if (event.data.type !== 'hyperui:preview-direction' || typeof event.data.ltr !== 'boolean') {
      return
    }

    document.documentElement.setAttribute('dir', event.data.ltr ? 'ltr' : 'rtl')
  })
})

```

### Core Architecture Module: `scripts/generate-git-metadata.js`
```
#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import fs from 'node:fs'
import path from 'node:path'

const commitShaPattern = /^[0-9a-f]{7,40}$/i
const scriptFilePath = fileURLToPath(import.meta.url)
const repositoryRootPath = path.resolve(path.dirname(scriptFilePath), '..')

const commitSearchLimit = 500
const highVolumeHtmlCommitThreshold = 250
const highVolumeMdxCommitThreshold = 10

const changedHtmlFileCountCache = new Map()
const changedMdxFileCountCache = new Map()

function getCommitEntriesForPath(targetPath) {
  try {
    const gitLogResult = execFileSync(
      'git',
      ['log', `--max-count=${commitSearchLimit}`, '--format=%H%x00%cI', '--', targetPath],
      {
        cwd: repositoryRootPath,
        encoding: 'utf8',
      },
    ).trim()

    return gitLogResult ? gitLogResult.split(/\r?\n/) : []
  } catch {
    return []
  }
}

function getChangedFileCount(
  commitSha,
  changeScopePath,
  targetFileExtension,
  changedFileCountCache,
) {
  if (changedFileCountCache.has(commitSha)) {
    return changedFileCountCache.get(commitSha) ?? 0
  }

  try {
    const changedFileList = execFileSync(
      'git',
      ['diff-tree', '--no-commit-id', '--name-only', '-r', commitSha, '--', changeScopePath],
      {
        cwd: repositoryRootPath,
        encoding: 'utf8',
      },
    ).trim()

    const changedTargetFiles = changedFileList
      ? changedFileList
          .split(/\r?\n/)
          .filter((changedFilePath) => changedFilePath.endsWith(targetFileExtension))
      : []

    const changedFileCount = changedTargetFiles.length

    changedFileCountCache.set(commitSha, changedFileCount)

    return changedFileCount
  } catch {
    changedFileCountCache.set(commitSha, Number.POSITIVE_INFINITY)

    return Number.POSITIVE_INFINITY
  }
}

function getCollectionUpdated(collectionCategory, componentSlug) {
  const componentExamplesPath = `public/examples/${collectionCategory}/${componentSlug}`
  const componentContentPath = `src/content/collection/${collectionCategory}/${componentSlug}.mdx`

  let updatedMetadata

  const commitSearchTargets = [
    {
      targetPath: componentExamplesPath,
      countScopePath: 'public/examples',
      targetFileExtension: '.html',
      changedFileCountCache: changedHtmlFileCountCache,
      highVolumeCommitThreshold: highVolumeHtmlCommitThreshold,
    },
    {
      targetPath: componentContentPath,
      countScopePath: 'src/content/collection',
      targetFileExtension: '.mdx',
      changedFileCountCache: changedMdxFileCountCache,
      highVolumeCommitThreshold: highVolumeMdxCommitThreshold,
    },
  ]

  for (const commitSearchTarget of commitSearchTargets) {
    const commitEntries = getCommitEntriesForPath(commitSearchTarget.targetPath)

    for (const commitEntry of commitEntries) {
      const [commitSha, commitDate] = commitEntry.split('\x00')

      if (!commitSha || !commitDate) {
        continue
      }

      if (!commitShaPattern.test(commitSha)) {
        continue
      }

      const changedFileCount = getChangedFileCount(
        commitSha,
        commitSearchTarget.countScopePath,
        commitSearchTarget.targetFileExtension,
        commitSearchTarget.changedFileCountCache,
      )

      if (changedFileCount >= commitSearchTarget.highVolumeCommitThreshold) {
        continue
      }

      updatedMetadata = {
        commit: commitSha,
        date: commitDate, // Preserve ISO string directly for JSON
      }

      break
    }

    if (updatedMetadata) {
      break
    }
  }

  return updatedMetadata
}

function generateMetadata() {
  console.log(
    '🔍 Generating Git metadata for local collections (checking both MDX pages and HTML examples)...',
  )

  const collectionsDir = path.join(repositoryRootPath, 'src/content/collection')
  const collectionCategories = ['application', 'marketing', 'neobrutalism', 'templates']

  const fileMetadata = {}

  for (const categoryItem of collectionCategories) {
    const categoryPath = path.join(collectionsDir, categoryItem)

    if (!fs.existsSync(categoryPath)) {
      continue
    }

    const collectionFiles = fs
      .readdirSync(categoryPath)
      .filter((fileItem) => fileItem.endsWith('.mdx'))
      .sort((a, b) => a.localeCompare(b))

    for (const fileItem of collectionFiles) {
      const collectionSlug = path.basename(fileItem, '.mdx')
      const mdxPath = `src/content/collection/${categoryItem}/${collectionSlug}.mdx`
      const htmlDir = `public/examples/${categoryItem}/${collectionSlug}`

      console.log(`📦 Analyzing: ${categoryItem}/${collectionSlug}`)
      console.log(`   ├─ MDX file: ${mdxPath}`)
      console.log(`   └─ HTML directory: ${htmlDir}`)

      const updatedInfo = getCollectionUpdated(categoryItem, collectionSlug)

      if (updatedInfo) {
        fileMetadata[`${categoryItem}/${collectionSlug}`] = updatedInfo
        console.log(
          `   ✨ Last updated commit: ${updatedInfo.commit.slice(0, 7)} on ${updatedInfo.date}\n`,
        )
      } else {
        console.log(`   ⚠️ No commit metadata found\n`)
      }
    }
  }

  const outputDir = path.join(repositoryRootPath, 'src/data')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, 'git-metadata.json')

  fs.writeFileSync(outputPath, JSON.stringify(fileMetadata, null, 2), 'utf8')

  console.log(`✅ Finished! Git metadata written to: src/data/git-metadata.json`)
}

generateMetadata()

```

### Core Architecture Module: `src/constants/dark-mode.js`
```
export const STORAGE_KEY = 'hyperui:dark-mode-generator'

export const SHADE_MAP = {
  50: 800,
  100: 800,
  200: 700,
  300: 600,
  400: 500,
  500: 400,
  600: 300,
  700: 200,
  800: 100,
  900: 50,
}

export const COLOR_MAP = {
  white: 'black',
  black: 'white',
}

export const COLOR_FAMILIES = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #730** (2026-06-26): **Bugfix - Source copied component HTML from build-time file, not live iframe**
  *Symptoms*: ## Problem  Users reported a `<script src="/cdn-cgi/challenge-platform/scripts/...">` and a hidden `<iframe>` appearing in the HTML when previewing/copying components. This is **Cloudflare's JS Detection** (Bot Fight Mode) injecting into HTML responses at the edge — not anything in the repo.  The copy/code-view path serialized the **live iframe document** (`iframeEl.contentDocument` → `body.innerHTML`), so whatever Cloudflare injected at runtime was scooped up into the copied output.  ## Fix  Inline the authored component markup from `public/examples/**` at **build time** and embed it into the `<pre>`. `getContent()` now reads that embedded source instead of cloning the live iframe.  - New `src/utils/componentMarkup.ts` — loads every example via `import.meta.glob('../../public/examples/**/*.html', { query: '?raw', eager: true })`, keyed by `src`. `readComponentMarkup(src)` extracts `<body>` content, dedents one level, trims. - `ComponentPreview.astro` — embeds source via `<pre set:text={sourceHtml}>`; removed the now-redundant `sanitizeContent` helper and the `viewHandler` text rewrite.  ## Why this approach  - **Immune to all runtime injection** — Cloudflare edge *and* browser extensions — because the string is materialized at build before any live document exists. - A runtime `fetch()` would not fix it: Cloudflare injects into any `text/html` response, including fetches. - **`import.meta.glob ?raw`, not `node:fs`** — the Cloudflare adapter prerenders in a Workers runtime wi
  **Post-Mortem & Fix Analysis**:
  > ## Deploying with &nbsp;<a href="https://workers.dev"><img alt="Cloudflare Workers" src="https://workers.cloudflare.com/logo.svg" width="16"></a> &nbsp;Cloudflare Workers The latest updates on your project. Learn more about [integrating Git with Workers](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/).  | Status | Name | Latest Commit | Preview URL | Updated (UTC) | | -|-|-|-|-| | ✅ Deployment successful! <br>[View logs](https://dash.cloudflare.com/?to=/d2a882f3bead7fab912bdc40db24e240/workers/services/view/hyperui/production/builds/a23f3d7c-ac79-4433-95a1-4a3ea1a15a8d) | hyperui | 496f8761 | <a href='https://c22f4b75-hyperui.mm-dev.workers.dev'>Commit Preview URL</a><br><br><a href='https://fix-cloudflare-injection-in-copied-html-hyperui.mm-dev.workers.dev'>Branch Preview URL</a> | Jun 26 2026, 07:06 PM |

- **Issue #729** (2026-06-26): **Some components ship with an unrelated script**
  *Symptoms*: I was browsing https://www.hyperui.dev/components/marketing/feature-grids/ and noticed that some components ship with the following script: ```html <script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'a11c250a0e23c115',t:'MTc4MjQ3NjIwMg=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script><iframe height="1" width="1" style="position: absolute; top: 0px; left: 0px; border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; visibility: hidden;"></iframe> ```  I noticed this script on the following components:   - Grid with content - Grid with content (Dark) - List with content - List with content (Dark)
  **Post-Mortem & Fix Analysis**:
  > > [!IMPORTANT] > `/cdn-cgi/` is a Cloudflare feature, but it shouldn't be appearing here. Working on it now.  They definitely don't. However, I can see that appearing as well. I'll take a look.
  > Pushed a fix. Please reopen the issue if you see it again @Kenny1291 – thank you for the report, great spot! 👏 

- **Issue #717** (2026-05-29): **Hide broken code-preview toggle and keep interactive preview only**
  *Symptoms*: Recent iframe/content handling changes broke code-view rendering in component previews. This PR removes the preview/code mode toggle so previews stay in interactive iframe mode only until the underlying iframe pipeline is stabilized.  - **UI behavior change**   - Removed the `PreviewView` control from preview headers in `PreviewWrapper.astro`.   - Users now always see the interactive preview; no mode switch to HTML/code view is exposed.  - **Test alignment**   - Updated preview spec assertions to reflect the temporary UX:     - no `Toggle preview mode` button is rendered,     - iframe preview remains visible,     - code block view (`pre[data-html]`) is not shown.  - **Implementation excerpt**   ```astro   <div class="hidden shrink-0 items-center gap-2 md:flex">     <PreviewBreakpoints {src} {breakpoints} />     <PreviewDirection {src} />     <PreviewCopy {src} />   </div>   ```
  **Post-Mortem & Fix Analysis**:
  > ## Deploying with &nbsp;<a href="https://workers.dev"><img alt="Cloudflare Workers" src="https://workers.cloudflare.com/logo.svg" width="16"></a> &nbsp;Cloudflare Workers The latest updates on your project. Learn more about [integrating Git with Workers](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/).  | Status | Name | Latest Commit | Preview URL | Updated (UTC) | | -|-|-|-|-| | ✅ Deployment successful! <br>[View logs](https://dash.cloudflare.com/?to=/d2a882f3bead7fab912bdc40db24e240/workers/services/view/hyperui/production/builds/5873bc71-729c-4ee8-beed-97df6f1c2d97) | hyperui | 9295d444 | <a href='https://6bb60f65-hyperui.mm-dev.workers.dev'>Commit Preview URL</a><br><br><a href='https://copilot-hide-preview-toggle-button-hyperui.mm-dev.workers.dev'>Branch Preview URL</a> | May 29 2026, 10:15 AM |

- **Issue #716** (2026-05-29): **Code preview is broken**
  *Symptoms*: Sorry about that – I'll hide the button for now.  It's an issue with some recent changes to how the `<iframe>` elements handle the HTML content, but this shouldn't be a problem once #715 is complete 🤞 

- **Issue #677** (2026-01-07): **Bugfix - Preserve element trailing slash when copying HTML**
  *Symptoms*: ## Description Fixes issue where `<input>` elements lose their trailing slash (`/>`) when copied from the HTML view.  ## Problem When using the "Copy HTML" feature, the `innerHTML` serialization in the browser removes trailing slashes from self-closing tags like `<input />`, resulting in `<input>` instead. This creates inconsistency with the source files in the repository.  ## Solution Added post-processing in the `sanitizeContent()` method to restore trailing slashes specifically for `<input>` elements after `innerHTML` serialization, maintaining consistency with the codebase.  ## Changes - Modified `src/components/ComponentPreview.astro` - Updated `sanitizeContent()` method to handle:   - `<input>` (no attributes) → `<input />`   - `<input attributes>` (with attributes) → `<input attributes />`  ## Testing - Tested locally with `npm run dev` - Verified input elements with attributes get trailing slash - Verified input elements without attributes get trailing slash - Confirmed existing input elements with trailing slash remain unchanged - No breaking changes to other components  Closes #[675]
  **Post-Mortem & Fix Analysis**:
  > @Indrawan-maker is attempting to deploy a commit to the **Mark M - Team** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Mark%20M%20-%20Team&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2239a2df852a0581fcf27865976b4dcecdc616126e%22%7D%2C%22id%22%3A%22QmVhXit1NRUFfXkZeQ86voRcZ93wtP1wz9QEdFqDiVEN53%22%2C%22org%22%3A%22markmead%22%2C%22prId%22%3A677%2C%22repo%22%3A%22hyperui%22%7D).  
  > This isn't a bug @Indrawan-maker as both versions (`<input>` and `<input />`) are valid HTML.

- **Issue #675** (2026-01-07): **Missing closing tag on footer component**
  *Symptoms*: hey when i want try to copy paste the footer i get an error, i already solve it myself on my project, it's on input element, but i found it and wanna fix this, because i found it, then i want to help and fix this issue here.
  **Post-Mortem & Fix Analysis**:
  > Good spot @Indrawan-maker! Happy for you to handle the fix.
  > Why was this closed? @Indrawan-maker 
  > > Why was this closed? [@Indrawan-maker](https://github.com/Indrawan-maker)  i'm just try the button, sorry it cause you trouble.

- **Issue #674** (2025-12-15): **Rating poll component star issue**
  *Symptoms*: I believe for the ratings all the stars on the left of the rated stars should get yellow rather than just the rated star. I think there is an error so please let me know and look into it.
  **Post-Mortem & Fix Analysis**:
  > Comment in the components HTML gives you detail:  > This is a pure HTML implementation. Highlighting all previous stars when selecting a rating is not possible without additional JavaScript.
  > Oh I see

- **Issue #671** (2025-11-28): **Update - Rename and splitting categories**
  *Symptoms*: Renaming the category from Neo-Brutalist to Neobrutalism and splitting them out into individual Astro collections. Doing so resolves the bug where collections with the same `slug` conflicted.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #lQDS8ZrEudvIoH+NqM91/OJdEND4UCsu1YaNHt3BKLU=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJoeXBlcnVpIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL21hcmttL2h5cGVydWkvQ1JMRWp4MkszbVV4SzV5UVZXTUNkYU52dnNEQiIsInByZXZpZXdVcmwiOiJoeXBlcnVpLWdpdC11cGRhdGUtc3BsaXQtY29sbGVjdGlvbnMtbWFya20udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Preview | Updated (UTC) | | :--- | :----- | :------ | :------ | | [hyperui](https://vercel.com/markm/hyperui) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/markm/hyperui/CRLEjx2K3mUxK5yQVWMCdaNvvsDB) | [Preview](https://hyperui-git-update-split-collections-markm.vercel.app) | Nov 28, 2025 9:16pm |  

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

### Incident Patch 1: `2dfb3ef2` (2026-08-31)
**Commit Message**: Bugfix - Give dark example HTML files an explicit dark background (#754)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `public/examples/application/accordions/1-dark.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <link href="/component.css" rel="stylesheet" />
     <script src="/component.js" defer></script>
   </head>
-  <body class="mx-auto max-w-3xl p-6">
+  <body class="mx-auto max-w-3xl p-6 dark:bg-gray-900">
     <div class="space-y-2">
       <details class="group [&_summary::-webkit-details-marker]:hidden">
         <summary
```

**File**: `public/examples/application/accordions/2-dark.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <link href="/component.css" rel="stylesheet" />
     <script src="/component.js" defer></script>
   </head>
-  <body class="mx-auto max-w-3xl p-6">
+  <body class="mx-auto max-w-3xl p-6 dark:bg-gray-900">
     <div class="space-y-2">
       <details class="group [&_summary::-webkit-details-marker]:hidden">
         <summary
```

**File**: `public/examples/application/accordions/3-dark.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <link href="/component.css" rel="stylesheet" />
     <script src="/component.js" defer></script>
   </head>
-  <body class="mx-auto max-w-3xl p-6">
+  <body class="mx-auto max-w-3xl p-6 dark:bg-gray-900">
     <div class="-mx-4 -my-2 space-y-0 divide-y divide-gray-200 dark:divide-gray-700">
       <details class="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
         <summary
```

**File**: `public/examples/application/accordions/4-dark.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <link href="/component.css" rel="stylesheet" />
     <script src="/component.js" defer></script>
   </head>
-  <body class="mx-auto max-w-3xl p-6">
+  <body class="mx-auto max-w-3xl p-6 dark:bg-gray-900">
     <div class="space-y-2">
       <details class="group space-y-2 [&_summary::-webkit-details-marker]:hidden" open>
         <summary
```

**File**: `public/examples/application/accordions/5-dark.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <link href="/component.css" rel="stylesheet" />
     <script src="/component.js" defer></script>
   </head>
-  <body class="mx-auto max-w-3xl p-6">
+  <body class="mx-auto max-w-3xl p-6 dark:bg-gray-900">
     <div class="space-y-1">
       <details class="group [&_summary::-webkit-details-marker]:hidden">
         <summary
```

**File**: `public/examples/application/badges/1-dark.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <link href="/component.css" rel="stylesheet" />
     <script src="/component.js" defer></script>
   </head>
-  <body class="flex flex-wrap justify-center gap-4 p-6">
+  <body class="flex flex-wrap justify-center gap-4 p-6 dark:bg-gray-900">
     <span
       class="rounded-full bg-purple-100 px-2.5 py-0.5 text-sm whitespace-nowrap text-purple-700 dark:bg-purple-700 dark:text-purple-100"
     >
```

**File**: `public/examples/application/badges/2-dark.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <link href="/component.css" rel="stylesheet" />
     <script src="/component.js" defer></script>
   </head>
-  <body class="flex flex-wrap justify-center gap-4 p-6">
+  <body class="flex flex-wrap justify-center gap-4 p-6 dark:bg-gray-900">
     <span
       class="inline-flex items-center justify-center rounded-full bg-purple-100 px-2.5 py-0.5 text-purple-700 dark:bg-purple-700 dark:text-purple-100"
     >
```

**File**: `public/examples/application/badges/3-dark.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <link href="/component.css" rel="stylesheet" />
     <script src="/component.js" defer></script>
   </head>
-  <body class="flex flex-wrap justify-center gap-4 p-6">
+  <body class="flex flex-wrap justify-center gap-4 p-6 dark:bg-gray-900">
     <span
       class="inline-flex items-center justify-center rounded-full bg-purple-100 px-2.5 py-0.5 text-purple-700 dark:bg-purple-700 dark:text-purple-100"
     >
```

---

### Incident Patch 2: `b399416f` (2026-08-29)
**Commit Message**: Bugfix - Fix RTL layout bugs from physical transform and inset utilities (#750)

**File**: `public/examples/application/inputs/2-dark.html` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
         />
 
         <span
-          class="absolute inset-y-0 right-0 grid w-8 place-content-center text-gray-700 dark:text-gray-200"
+          class="absolute inset-y-0 end-0 grid w-8 place-content-center text-gray-700 dark:text-gray-200"
         >
           <svg
             aria-hidden="true"
```

**File**: `public/examples/application/inputs/2.html` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
           class="mt-0.5 w-full rounded border-gray-300 pe-8 shadow-sm sm:text-sm"
         />
 
-        <span class="absolute inset-y-0 right-0 grid w-8 place-content-center text-gray-700">
+        <span class="absolute inset-y-0 end-0 grid w-8 place-content-center text-gray-700">
           <svg
             aria-hidden="true"
             xmlns="http://www.w3.org/2000/svg"
```

**File**: `public/examples/application/selects/3-dark.html` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
         />
 
         <span
-          class="absolute inset-y-0 right-0 grid w-8 place-content-center text-gray-700 dark:text-gray-200"
+          class="absolute inset-y-0 end-0 grid w-8 place-content-center text-gray-700 dark:text-gray-200"
         >
           <svg
             aria-hidden="true"
```

**File**: `public/examples/application/selects/3.html` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
           class="mt-0.5 w-full rounded border-gray-300 pe-8 shadow-sm sm:text-sm [&::-webkit-calendar-picker-indicator]:opacity-0"
         />
 
-        <span class="absolute inset-y-0 right-0 grid w-8 place-content-center text-gray-700">
+        <span class="absolute inset-y-0 end-0 grid w-8 place-content-center text-gray-700">
           <svg
             aria-hidden="true"
             xmlns="http://www.w3.org/2000/svg"
```

**File**: `public/examples/neobrutalism/selects/3-dark.html` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
           class="mt-0.5 w-full border-2 border-black bg-white placeholder-black shadow-[4px_4px_0_0] shadow-black focus:ring-2 focus:ring-yellow-300 sm:text-sm dark:border-white dark:bg-gray-900 dark:placeholder-white dark:shadow-white dark:focus:ring-yellow-600 [&::-webkit-calendar-picker-indicator]:opacity-0"
         />
 
-        <span class="absolute inset-y-0 right-0 grid w-8 place-content-center">
+        <span class="absolute inset-y-0 end-0 grid w-8 place-content-center">
           <svg
             aria-hidden="true"
             xmlns="http://www.w3.org/2000/svg"
```

**File**: `public/examples/neobrutalism/selects/3.html` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
           class="mt-0.5 w-full border-2 border-black bg-white placeholder-black shadow-[4px_4px_0_0] shadow-black focus:ring-2 focus:ring-yellow-300 sm:text-sm [&::-webkit-calendar-picker-indicator]:opacity-0"
         />
 
-        <span class="absolute inset-y-0 right-0 grid w-8 place-content-center">
+        <span class="absolute inset-y-0 end-0 grid w-8 place-content-center">
           <svg
             aria-hidden="true"
             xmlns="http://www.w3.org/2000/svg"
```

**File**: `public/examples/templates/analytics-dashboard/1.html` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 
     <div
       id="dashboard-sidebar"
-      class="fixed inset-y-0 start-0 z-40 flex w-64 -translate-x-full flex-col justify-between overflow-y-auto border-e border-gray-200 bg-white transition-transform duration-300 peer-checked:translate-x-0 lg:static lg:shrink-0 lg:translate-x-0"
+      class="fixed inset-y-0 start-0 z-40 flex w-64 -translate-x-full max-lg:rtl:translate-x-full flex-col justify-between overflow-y-auto border-e border-gray-200 bg-white transition-transform duration-300 peer-checked:translate-x-0 lg:static lg:shrink-0 lg:translate-x-0"
     >
       <div class="p-4">
         <span
```

**File**: `public/examples/templates/analytics-dashboard/2.html` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 
     <div
       id="dashboard-sidebar"
-      class="fixed inset-y-0 start-0 z-40 flex w-64 -translate-x-full flex-col justify-between overflow-y-auto border-e border-gray-200 bg-white transition-transform duration-300 peer-checked:translate-x-0 lg:static lg:shrink-0 lg:translate-x-0"
+      class="fixed inset-y-0 start-0 z-40 flex w-64 -translate-x-full max-lg:rtl:translate-x-full flex-col justify-between overflow-y-auto border-e border-gray-200 bg-white transition-transform duration-300 peer-checked:translate-x-0 lg:static lg:shrink-0 lg:translate-x-0"
     >
       <div class="p-4">
         <span
```

---

### Incident Patch 3: `1e01655c` (2026-08-24)
**Commit Message**: Bugfix - Remove GitHub star banner (#744)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `src/layouts/BaseLayout.astro` (modified, +0/-11)
```diff
@@ -27,17 +27,6 @@ const { title, description } = Astro.props
 
     <SiteHeader />
 
-    <aside
-      class="border-b border-gray-200 bg-gray-50 p-4 text-center text-sm font-medium text-gray-700"
-    >
-      Enjoying HyperUI? Consider <a
-        href="https://github.com/markmead/hyperui"
-        class="underline transition-colors hover:text-gray-900"
-        target="_blank"
-        rel="noreferrer">starring the repository on GitHub</a
-      > to show your support!
-    </aside>
-
     <div class="flex flex-1 flex-col *:w-full">
       <slot />
     </div>
```

---

### Incident Patch 4: `076b25db` (2026-07-11)
**Commit Message**: Bugfix - Resolve astro check errors in TypographyMapper

wrangler types generates a global Element interface (from the
HTMLRewriter API) whose remove() signature conflicts with
HTMLSelectElement's, breaking querySelector's generic constraint.
Cast through unknown instead of using the generic parameter.

**File**: `src/components/TypographyMapper.astro` (modified, +4/-2)
```diff
@@ -659,8 +659,10 @@ import { MoveRight, Percent } from '@lucide/astro'
       this.lineHeightInputElement = this.querySelector<HTMLInputElement>('[data-line-height-input]')!
       this.letterSpacingInputElement = this.querySelector<HTMLInputElement>('[data-letter-spacing-input]')!
       this.classNameInputElement = this.querySelector<HTMLInputElement>('[data-class-name-input]')!
-      this.fontWeightSelectElement = this.querySelector<HTMLSelectElement>('[data-font-weight-select]')!
-      this.textTransformSelectElement = this.querySelector<HTMLSelectElement>('[data-text-transform-select]')!
+      // wrangler types augments the global Element interface with an incompatible
+      // remove() signature, so HTMLSelectElement fails querySelector's generic constraint
+      this.fontWeightSelectElement = this.querySelector('[data-font-weight-select]') as unknown as HTMLSelectElement
+      this.textTransformSelectElement = this.querySelector('[data-text-transform-select]') as unknown as HTMLSelectElement
       this.copyButtonElement = this.querySelector<HTMLButtonElement>('[data-copy-button]')!
       this.copyButtonTextElement = this.querySelector<HTMLElement>('[data-copy-button-text]')!
       this.copyLiveRegionElement = this.querySelector<HTMLElement>('[data-copy-live-region]')!
```

---

### Incident Patch 5: `926008d1` (2026-07-04)
**Commit Message**: Update - Fix missing space in "Updated:" date label

**File**: `src/layouts/ComponentPost.astro` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ const componentPageSchema = {
         }
 
         <span>
-          Updated:
+          Updated:{' '}
           {
             updated?.commit ? (
               <a
```

---

### Incident Patch 6: `3cffa30c` (2026-07-04)
**Commit Message**: Update - Regenerate git metadata after accessibility fixes merge

**File**: `src/data/git-metadata.json` (modified, +143/-47)
```diff
@@ -1,115 +1,211 @@
 {
   "application/accordions": {
-    "commit": "353ed370d7c3c242ed3ea4474c13e0c110285bd0",
-    "date": "2025-11-04T10:39:59Z"
+    "commit": "ca954941be16124a2d13190533f580d0d9e4d4f5",
+    "date": "2026-07-04T18:12:21+01:00"
+  },
+  "application/badges": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/breadcrumbs": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/button-groups": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/dividers": {
     "commit": "353ed370d7c3c242ed3ea4474c13e0c110285bd0",
     "date": "2025-11-04T10:39:59Z"
   },
   "application/dropdown": {
-    "commit": "03c543128aea1430cc6dca66fd9193bad5f75e41",
-    "date": "2026-05-28T20:00:13+01:00"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/empty-states": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/file-uploaders": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/filters": {
-    "commit": "03c543128aea1430cc6dca66fd9193bad5f75e41",
-    "date": "2026-05-28T20:00:13+01:00"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/inputs": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/loaders": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/modals": {
-    "commit": "03c543128aea1430cc6dca66fd9193bad5f75e41",
-    "date": "2026-05-28T20:00:13+01:00"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/pagination": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/progress-bars": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/range-inputs": {
     "commit": "3524e095f57ae94dc07a91ed4941d73bc1d0ca07",
     "date": "2025-11-14T09:08:30Z"
   },
   "application/selects": {
-    "commit": "03c543128aea1430cc6dca66fd9193bad5f75e41",
-    "date": "2026-05-28T20:00:13+01:00"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/side-menu": {
-    "commit": "9f9df088bd44a637d8806e0735abbe0428d4bcc0",
-    "date": "2026-05-21T15:48:22+01:00"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/stats": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/steps": {
-    "commit": "03c543128aea1430cc6dca66fd9193bad5f75e41",
-    "date": "2026-05-28T20:00:13+01:00"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/tabs": {
-    "commit": "03c543128aea1430cc6dca66fd9193bad5f75e41",
-    "date": "2026-05-28T20:00:13+01:00"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/toasts": {
-    "commit": "353ed370d7c3c242ed3ea4474c13e0c110285bd0",
-    "date": "2025-11-04T10:39:59Z"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "application/toggles": {
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
   },
   "application/vertical-menu": {
-    "commit": "353ed370d7c3c242ed3ea4474c13e0c110285bd0",
-    "date": "2025-11-04T10:39:59Z"
+    "commit": "47a41dec4b1821d2be447606b23511160b89ea9b",
+    "date": "2026-07-04T19:16:57+01:00"
+  },
+  "marketing/announcements": {
+    "commit": "a24d52ef3b9a111e8030d94d1a0b72c505d4b0ed",
+    "date": "2026-07-04T19:18:53+01:00"
+  },
+  "marketing/banners": {
+    "commit": "a24d52ef3b9a111e8030d94d1a0b72c505d4b0ed",
+    "date": "2026-07-04T19:18:53+01:00"
+  },
+  "marketing/blog-cards": {
+    "commit": "a24d52ef3b9a111e8030d94d1a0b72c505d4b0ed",
+    "date": "2026-07-04T19:18:53+01:00"
   },
   "marketing/buttons": {
-    "commit": "17a85a46cd7430cfe54e965c8ef1e76716bfed7e",
-    "date": "2026-05-30T16:01:07+01:00"
+    "commit": "a24d52ef3b9a111e8030d94d1a0b72c505d4b0ed",
+    "date": "2026-07-04T19:18:53+01:00"
+  },
+  "marketing/cards": {
+    "commit": "a24d52ef3b9a111e8030d94d1a0b72c505d4b0ed",
+    "date": "2026-07-04T19:18:53+01:00"
   },
   "marketing/carts": {
-    "commit": "9f9df088bd44a637d8806e0735abbe0428d4bcc0",
-    "date": "2026-05-21T15:48:2
```

---

### Incident Patch 7: `a24d52ef` (2026-07-04)
**Commit Message**: Update - Fix accessibility issues across marketing component examples (#735)

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `public/examples/marketing/announcements/2-dark.html` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
         class="rounded border border-gray-300 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
       >
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           fill="none"
           viewBox="0 0 24 24"
```

**File**: `public/examples/marketing/announcements/2.html` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
         class="rounded border border-gray-300 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50"
       >
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           fill="none"
           viewBox="0 0 24 24"
```

**File**: `public/examples/marketing/announcements/4-dark.html` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
         class="rounded border border-gray-300 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
       >
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           fill="none"
           viewBox="0 0 24 24"
```

**File**: `public/examples/marketing/announcements/4.html` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
         class="rounded border border-gray-300 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50"
       >
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           fill="none"
           viewBox="0 0 24 24"
```

**File**: `public/examples/marketing/announcements/6-dark.html` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
           class="rounded border border-gray-300 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
         >
           <svg
+            aria-hidden="true"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
             viewBox="0 0 24 24"
```

**File**: `public/examples/marketing/announcements/6.html` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
           class="rounded border border-gray-300 bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-50"
         >
           <svg
+            aria-hidden="true"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
             viewBox="0 0 24 24"
```

**File**: `public/examples/marketing/banners/3-dark.html` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ <h1 class="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">
         </div>
 
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 1024 768"
           class="mx-auto hidden max-w-md text-gray-900 md:block dark:text-white"
```

**File**: `public/examples/marketing/banners/3.html` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ <h1 class="text-4xl font-bold text-gray-900 sm:text-5xl">
         </div>
 
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 1024 768"
           class="mx-auto hidden max-w-md text-gray-900 md:block"
```

---

### Incident Patch 8: `b2275369` (2026-07-04)
**Commit Message**: Update - Fix accessibility issues across neobrutalism component examples (#734)

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `public/examples/neobrutalism/accordions/1-dark.html` (modified, +3/-0)
```diff
@@ -15,6 +15,7 @@
           <span class="font-semibold">What are the basic features?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -47,6 +48,7 @@
           <span class="font-semibold">How do I get started?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -79,6 +81,7 @@
           <span class="font-semibold">What support options are available?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
```

**File**: `public/examples/neobrutalism/accordions/1.html` (modified, +3/-0)
```diff
@@ -15,6 +15,7 @@
           <span class="font-semibold">What are the basic features?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -47,6 +48,7 @@
           <span class="font-semibold">How do I get started?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -79,6 +81,7 @@
           <span class="font-semibold">What support options are available?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
```

**File**: `public/examples/neobrutalism/accordions/2-dark.html` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
           <span class="font-semibold">What are the basic features?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -51,6 +52,7 @@
           <span class="font-semibold">How do I get started?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -85,6 +87,7 @@
           <span class="font-semibold">What support options are available?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
```

**File**: `public/examples/neobrutalism/accordions/2.html` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
           <span class="font-semibold">What are the basic features?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -51,6 +52,7 @@
           <span class="font-semibold">How do I get started?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -85,6 +87,7 @@
           <span class="font-semibold">What support options are available?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
```

**File**: `public/examples/neobrutalism/accordions/3-dark.html` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
           <span class="font-semibold">What are the basic features?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -49,6 +50,7 @@
           <span class="font-semibold">How do I get started?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -81,6 +83,7 @@
           <span class="font-semibold">What support options are available?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
```

**File**: `public/examples/neobrutalism/accordions/3.html` (modified, +3/-0)
```diff
@@ -15,6 +15,7 @@
           <span class="font-semibold">What are the basic features?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -47,6 +48,7 @@
           <span class="font-semibold">How do I get started?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
@@ -79,6 +81,7 @@
           <span class="font-semibold">What support options are available?</span>
 
           <svg
+            aria-hidden="true"
             class="size-5 shrink-0 group-open:-rotate-180"
             xmlns="http://www.w3.org/2000/svg"
             fill="none"
```

**File**: `public/examples/neobrutalism/alerts/1-dark.html` (modified, +2/-0)
```diff
@@ -13,6 +13,7 @@
     >
       <div class="flex items-start gap-3">
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 16 16"
           fill="currentColor"
@@ -26,6 +27,7 @@
         </svg>
 
         <strong class="block flex-1 leading-tight font-semibold">
+          <span class="sr-only">Info: </span>
           Lorem ipsum dolor sit amet consectetur adipisicing elit. Quas, eos!
         </strong>
       </div>
```

**File**: `public/examples/neobrutalism/alerts/1.html` (modified, +2/-0)
```diff
@@ -13,6 +13,7 @@
     >
       <div class="flex items-start gap-3">
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 16 16"
           fill="currentColor"
@@ -26,6 +27,7 @@
         </svg>
 
         <strong class="block flex-1 leading-tight font-semibold">
+          <span class="sr-only">Info: </span>
           Lorem ipsum dolor sit amet consectetur adipisicing elit. Quas, eos!
         </strong>
       </div>
```

---

### Incident Patch 9: `47a41dec` (2026-07-04)
**Commit Message**: Update - Fix accessibility issues across application component examples (#733)

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `public/examples/application/badges/2-dark.html` (modified, +2/-0)
```diff
@@ -11,6 +11,7 @@
       class="inline-flex items-center justify-center rounded-full bg-purple-100 px-2.5 py-0.5 text-purple-700 dark:bg-purple-700 dark:text-purple-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -32,6 +33,7 @@
       class="inline-flex items-center justify-center rounded-full border border-purple-500 px-2.5 py-0.5 text-purple-700 dark:text-purple-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
```

**File**: `public/examples/application/badges/2.html` (modified, +2/-0)
```diff
@@ -11,6 +11,7 @@
       class="inline-flex items-center justify-center rounded-full bg-purple-100 px-2.5 py-0.5 text-purple-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -32,6 +33,7 @@
       class="inline-flex items-center justify-center rounded-full border border-purple-500 px-2.5 py-0.5 text-purple-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
```

**File**: `public/examples/application/badges/3-dark.html` (modified, +2/-0)
```diff
@@ -18,6 +18,7 @@
         <span class="sr-only">Remove badge</span>
 
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           fill="none"
           viewBox="0 0 24 24"
@@ -41,6 +42,7 @@
         <span class="sr-only">Remove badge</span>
 
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           fill="none"
           viewBox="0 0 24 24"
```

**File**: `public/examples/application/badges/3.html` (modified, +2/-0)
```diff
@@ -18,6 +18,7 @@
         <span class="sr-only">Remove badge</span>
 
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           fill="none"
           viewBox="0 0 24 24"
@@ -41,6 +42,7 @@
         <span class="sr-only">Remove badge</span>
 
         <svg
+          aria-hidden="true"
           xmlns="http://www.w3.org/2000/svg"
           fill="none"
           viewBox="0 0 24 24"
```

**File**: `public/examples/application/badges/4-dark.html` (modified, +2/-0)
```diff
@@ -11,6 +11,7 @@
       class="inline-flex items-center justify-center rounded-full bg-purple-100 px-2.5 py-1 text-purple-700 dark:bg-purple-700 dark:text-purple-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -30,6 +31,7 @@
       class="inline-flex items-center justify-center rounded-full border border-purple-500 px-2.5 py-1 text-purple-700 dark:text-purple-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
```

**File**: `public/examples/application/badges/4.html` (modified, +2/-0)
```diff
@@ -11,6 +11,7 @@
       class="inline-flex items-center justify-center rounded-full bg-purple-100 px-2.5 py-1 text-purple-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -30,6 +31,7 @@
       class="inline-flex items-center justify-center rounded-full border border-purple-500 px-2.5 py-1 text-purple-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
```

**File**: `public/examples/application/badges/5-dark.html` (modified, +6/-0)
```diff
@@ -11,6 +11,7 @@
       class="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700 dark:bg-emerald-700 dark:text-emerald-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -32,6 +33,7 @@
       class="inline-flex items-center justify-center rounded-full border border-emerald-500 px-2.5 py-0.5 text-emerald-700 dark:text-emerald-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -53,6 +55,7 @@
       class="inline-flex items-center justify-center rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700 dark:bg-amber-700 dark:text-amber-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -74,6 +77,7 @@
       class="inline-flex items-center justify-center rounded-full border border-amber-500 px-2.5 py-0.5 text-amber-700 dark:text-amber-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -95,6 +99,7 @@
       class="inline-flex items-center justify-center rounded-full bg-red-100 px-2.5 py-0.5 text-red-700 dark:bg-red-700 dark:text-red-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -116,6 +121,7 @@
       class="inline-flex items-center justify-center rounded-full border border-red-500 px-2.5 py-0.5 text-red-700 dark:text-red-100"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
```

**File**: `public/examples/application/badges/5.html` (modified, +6/-0)
```diff
@@ -11,6 +11,7 @@
       class="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -32,6 +33,7 @@
       class="inline-flex items-center justify-center rounded-full border border-emerald-500 px-2.5 py-0.5 text-emerald-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -53,6 +55,7 @@
       class="inline-flex items-center justify-center rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -74,6 +77,7 @@
       class="inline-flex items-center justify-center rounded-full border border-amber-500 px-2.5 py-0.5 text-amber-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -95,6 +99,7 @@
       class="inline-flex items-center justify-center rounded-full bg-red-100 px-2.5 py-0.5 text-red-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
@@ -116,6 +121,7 @@
       class="inline-flex items-center justify-center rounded-full border border-red-500 px-2.5 py-0.5 text-red-700"
     >
       <svg
+        aria-hidden="true"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
```

---

### Incident Patch 10: `32b3b402` (2026-07-04)
**Commit Message**: Update - Fix homepage skip-link target and match button styles

Wrap the hero section in <main id="main-content"> so the skip link
lands at the top of visible content like every other page, instead of
jumping past the h1 and intro copy. Also align the "Browse tools"
button classes with the GitHub header button for consistency, and pick
up a pending Prettier formatting fix in SiteFooter.astro.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `src/components/SiteFooter.astro` (modified, +2/-5)
```diff
@@ -12,15 +12,12 @@
     </p>
 
     <p class="text-sm text-gray-700">
-      Released under the
-      <a
+      Released under the <a
         href="https://github.com/markmead/hyperui/blob/main/LICENSE"
         target="_blank"
         rel="noreferrer"
-        class="underline transition-colors hover:text-gray-900"
+        class="underline transition-colors hover:text-gray-900">MIT License</a
       >
-        MIT License
-      </a>
     </p>
   </div>
 </footer>
```

**File**: `src/pages/index.astro` (modified, +55/-53)
```diff
@@ -30,65 +30,67 @@ const neobrutalism = neobrutalismRaw
 ---
 
 <BaseLayout title={SEO_TITLE_SITE} description={SEO_DESCRIPTION_SITE}>
-  <section class="bg-white">
-    <div class="mx-auto max-w-4xl space-y-6 px-4 py-8 text-center md:py-16">
-      <h1 class="text-6xl font-medium tracking-tight md:text-7xl lg:text-8xl">HyperUI</h1>
+  <main id="main-content">
+    <section class="bg-white">
+      <div class="mx-auto max-w-4xl space-y-6 px-4 py-8 text-center md:py-16">
+        <h1 class="text-6xl font-medium tracking-tight md:text-7xl lg:text-8xl">HyperUI</h1>
 
-      <h2 class="text-xl text-gray-600 md:text-2xl">Free Open Source Tailwind CSS Components</h2>
+        <h2 class="text-xl text-gray-600 md:text-2xl">Free Open Source Tailwind CSS Components</h2>
 
-      <p class="mx-auto max-w-2xl text-gray-600">
-        HyperUI is a collection of free Tailwind CSS components that can be used in your next
-        project. With a range of components, you can build your next marketing website, admin
-        dashboard, eCommerce store and much more.
-      </p>
+        <p class="mx-auto max-w-2xl text-gray-600">
+          HyperUI is a collection of free Tailwind CSS components that can be used in your next
+          project. With a range of components, you can build your next marketing website, admin
+          dashboard, eCommerce store and much more.
+        </p>
 
-      <div class="*:mx-auto">
-        <BaseAd />
-      </div>
-    </div>
-  </section>
-
-  <main id="main-content" class="mx-auto max-w-7xl divide-y divide-gray-200 px-4">
-    <section class="py-16">
-      <div
-        class="flex items-center justify-between gap-8 rounded-lg border border-gray-200 bg-gray-50 p-8"
-      >
-        <div>
-          <h2 class="text-2xl font-medium">HyperUI Tools</h2>
-
-          <p class="mt-2 text-gray-600">
-            Generate dark mode variants and map typography scales — all in the browser.
-          </p>
+        <div class="*:mx-auto">
+          <BaseAd />
         </div>
-
-        <a
-          href="/tools"
-          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-gray-800 hover:bg-gray-800"
-        >
-          Browse tools
-        </a>
       </div>
     </section>
 
-    <CollectionFeature
-      title="Application Components"
-      description="Components for building application user interfaces."
-      slug="application"
-      components={application}
-    />
-
-    <CollectionFeature
-      title="Marketing Components"
-      description="Components for building marketing websites and landing pages."
-      slug="marketing"
-      components={marketing}
-    />
-
-    <CollectionFeature
-      title="Neobrutalism Components"
-      description="Components for building neobrutalist designs."
-      slug="neobrutalism"
-      components={neobrutalism}
-    />
+    <div class="mx-auto max-w-7xl divide-y divide-gray-200 px-4">
+      <section class="py-16">
+        <div
+          class="flex flex-col items-start gap-x-8 gap-y-4 rounded-lg border border-gray-200 bg-gray-50 p-8 sm:flex-row sm:items-center sm:justify-between"
+        >
+          <div>
+            <h2 class="text-2xl font-medium">HyperUI Tools</h2>
+
+            <p class="mt-2 text-gray-600">
+              Generate dark mode variants and map typography scales — all in the browser.
+            </p>
+          </div>
+
+          <a
+            href="/tools"
+            class="inline-flex items-center justify-center gap-2 rounded-md border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-gray-800 hover:bg-gray-800"
+          >
+            Browse tools
+          </a>
+        </div>
+      </section>
+
+      <CollectionFeature
+        title="Application Components"
+        description="Components for building application user interfaces."
+        slug="application"
+        components={application}
+      />
+
+      <CollectionFeature
+        title="Marketing Components"
+        description="Components for building marketing websites and landing pages."
+        slug="marketing"
+        components={marketing}
+      />
+
+      <CollectionFeature
+        title="Neobrutalism Components"
+        description="Components for building neobrutalist designs."
+        slug="neobrutalism"
+        components={neobrutalism}
+      />
+    </div>
   </main>
 </BaseLayout>
```

---

### Incident Patch 11: `2b86d736` (2026-07-04)
**Commit Message**: Update - Remove stale modern-web-guidance entry from skills-lock.json

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `skills-lock.json` (modified, +0/-6)
```diff
@@ -19,12 +19,6 @@
       "skillPath": "skills/frontend-design/SKILL.md",
       "computedHash": "4eabc66183767153e404b39d1b839b1c37f2d82d86f0a0d7e880a579d8d62336"
     },
-    "modern-web-guidance": {
-      "source": "GoogleChrome/modern-web-guidance",
-      "sourceType": "github",
-      "skillPath": "skills/modern-web-guidance/SKILL.md",
-      "computedHash": "5ba7a1367448fb7892112f0b629e9e23d1ba73eda5193aa0cadade6e8d2a83ba"
-    },
     "web-design-guidelines": {
       "source": "vercel-labs/agent-skills",
       "sourceType": "github",
```

---

### Incident Patch 12: `e135d309` (2026-07-04)
**Commit Message**: Update - Sync installed skills, swap modern-web-guidance for accessibility-review, frontend-design, and web-design-guidelines

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `.agents/skills/accessibility-review/SKILL.md` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+---
+name: accessibility-review
+description: Run a WCAG 2.1 AA accessibility audit on a design or page. Trigger with "audit accessibility", "check a11y", "is this accessible?", or when reviewing a design for color contrast, keyboard navigation, touch target size, or screen reader behavior before handoff.
+argument-hint: "<Figma URL, URL, or description>"
+---
+
+# /accessibility-review
+
+> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).
+
+Audit a design or page for WCAG 2.1 AA accessibility compliance.
+
+## Usage
+
+```
+/accessibility-review $ARGUMENTS
+```
+
+Audit for accessibility: @$1
+
+## WCAG 2.1 AA Quick Reference
+
+### Perceivable
+- **1.1.1** Non-text content has alt text
+- **1.3.1** Info and structure conveyed semantically
+- **1.4.3** Contrast ratio >= 4.5:1 (normal text), >= 3:1 (large text)
+- **1.4.11** Non-text contrast >= 3:1 (UI components, graphics)
+
+### Operable
+- **2.1.1** All functionality available via keyboard
+- **2.4.3** Logical focus order
+- **2.4.7** Visible focus indicator
+- **2.5.5** Touch target >= 44x44 CSS pixels
+
+### Understandable
+- **3.2.1** Predictable on focus (no unexpected changes)
+- **3.3.1** Error identification (describe the error)
+- **3.3.2** Labels or instructions for inputs
+
+### Robust
+- **4.1.2** Name, role, value for all UI components
+
+## Common Issues
+
+1. Insufficient color contrast
+2. Missing form labels
+3. No keyboard access to interactive elements
+4. Missing alt text on meaningful images
+5. Focus traps in modals
+6. Missing ARIA landmarks
+7. Auto-playing media without controls
+8. Time limits without extension options
+
+## Testing Approach
+
+1. Automated scan (catches ~30% of issues)
+2. Keyboard-only navigation
+3. Screen reader testing (VoiceOver, NVDA)
+4. Color contrast verification
+5. Zoom to 200% — does layout break?
+
+## Output
+
+```markdown
+## Accessibility Audit: [Design/Page Name]
+**Standard:** WCAG 2.1 AA | **Date:** [Date]
+
+### Summary
+**Issues found:** [X] | **Critical:** [X] | **Major:** [X] | **Minor:** [X]
+
+### Findings
+
+#### Perceivable
+| # | Issue | WCAG Criterion | Severity | Recommendation |
+|---|-------|---------------|----------|----------------|
+| 1 | [Issue] | [1.4.3 Contrast] | 🔴 Critical | [Fix] |
+
+#### Operable
+| # | Issue | WCAG Criterion | Severity | Recommendation |
+|---|-------|---------------|----------|----------------|
+| 1 | [Issue] | [2.1.1 Keyboard] | 🟡 Major | [Fix] |
+
+#### Understandable
+| # | Issue | WCAG Criterion | Severity | Recommendation |
+|---|-------|---------------|----------|----------------|
+| 1 | [Issue] | [3.3.2 Labels] | 🟢 Minor | [Fix] |
+
+#### Robust
+| # | Issue | WCAG Criterion | Severity | Recommendation |
+|---|-------|---------------|----------|----------------|
+| 1 | [Issue] | [4.1.2 Name, Role, Value] | 🟡 Major | [Fix] |
+
+### Color Contrast Check
+| Element | Foreground | Background | Ratio | Required | Pass? |
+|---------|-----------|------------|-------|----------|-------|
+| [Body text] | [color] | [color] | [X]:1 | 4.5:1 | ✅/❌ |
+
+### Keyboard Navigation
+| Element | Tab Order | Enter/Space | Escape | Arrow Keys |
+|---------|-----------|-------------|--------|------------|
+| [Element] | [Order] | [Behavior] | [Behavior] | [Behavior] |
+
+### Screen Reader
+| Element | Announced As | Issue |
+|---------|-------------|-------|
+| [Element] | [What SR says] | [Problem if any] |
+
+### Priority Fixes
+1. **[Critical fix]** — Affects [who] and blocks [what]
+2. **[Major fix]** — Improves [what] for [who]
+3. **[Minor fix]** — Nice to have
+```
+
+## If Connectors Available
+
+If **~~design tool** is connected:
+- Inspect color values, font sizes, and touch targets directly from Figma
+- Check component ARIA roles and keyboard behavior in the design spec
+
+If **~~project tracker** is connected:
+- Create tickets for each accessibility finding with severity and WCAG criterion
+- Link findings to existing accessibility remediation epics
+
+## Tips
+
+1. **Start with contrast and keyboard** — These catch the most common and impactful issues.
+2. **Test with real assistive technology** — My audit is a great start, but manual testing with VoiceOver/NVDA catches things I can't.
+3. **Prioritize by impact** — Fix issues that block users first, polish later.
```

**File**: `.agents/skills/frontend-design/LICENSE.txt` (added, +177/-0)
```diff
@@ -0,0 +1,177 @@
+
+                                 Apache License
+                           Version 2.0, January 2004
+                        http://www.apache.org/licenses/
+
+   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
+
+   1. Definitions.
+
+      "License" shall mean the terms and conditions for use, reproduction,
+      and distribution as defined by Sections 1 through 9 of this document.
+
+      "Licensor" shall mean the copyright owner or entity authorized by
+      the copyright owner that is granting the License.
+
+      "Legal Entity" shall mean the union of the acting entity and all
+      other entities that control, are controlled by, or are under common
+      control with that entity. For the purposes of this definition,
+      "control" means (i) the power, direct or indirect, to cause the
+      direction or management of such entity, whether by contract or
+      otherwise, or (ii) ownership of fifty percent (50%) or more of the
+      outstanding shares, or (iii) beneficial ownership of such entity.
+
+      "You" (or "Your") shall mean an individual or Legal Entity
+      exercising permissions granted by this License.
+
+      "Source" form shall mean the preferred form for making modifications,
+      including but not limited to software source code, documentation
+      source, and configuration files.
+
+      "Object" form shall mean any form resulting from mechanical
+      transformation or translation of a Source form, including but
+      not limited to compiled object code, generated documentation,
+      and conversions to other media types.
+
+      "Work" shall mean the work of authorship, whether in Source or
+      Object form, made available under the License, as indicated by a
+      copyright notice that is included in or attached to the work
+      (an example is provided in the Appendix below).
+
+      "Derivative Works" shall mean any work, whether in Source or Object
+      form, that is based on (or derived from) the Work and for which the
+      editorial revisions, annotations, elaborations, or other modifications
+      represent, as a whole, an original work of authorship. For the purposes
+      of this License, Derivative Works shall not include works that remain
+      separable from, or merely link (or bind by name) to the interfaces of,
+      the Work and Derivative Works thereof.
+
+      "Contribution" shall mean any work of authorship, including
+      the original version of the Work and any modifications or additions
+      to that Work or Derivative Works thereof, that is intentionally
+      submitted to Licensor for inclusion in the Work by the copyright owner
+      or by an individual or Legal Entity authorized to submit on behalf of
+      the copyright owner. For the purposes of this definition, "submitted"
+      means any form of electronic, verbal, or written communication sent
+      to the Licensor or its representatives, including but not limited to
+      communication on electronic mailing lists, source code control systems,
+      and issue tracking systems that are managed by, or on behalf of, the
+      Licensor for the purpose of discussing and improving the Work, but
+      excluding communication that is conspicuously marked or otherwise
+      designated in writing by the copyright owner as "Not a Contribution."
+
+      "Contributor" shall mean Licensor and any individual or Legal Entity
+      on behalf of whom a Contribution has been received by Licensor and
+      subsequently incorporated within the Work.
+
+   2. Grant of Copyright License. Subject to the terms and conditions of
+      this License, each Contributor hereby grants to You a perpetual,
+      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+      copyright license to reproduce, prepare Derivative Works of,
+      publicly display, publicly perform, sublicense, and distribute the
+      Work and such Derivative Works in Source or Object form.
+
+   3. Grant of Patent License. Subject to the terms and conditions of
+      this License, each Contributor hereby grants to You a perpetual,
+      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+      (except as stated in this section) patent license to make, have made,
+      use, offer to sell, sell, import, and otherwise transfer the Work,
+      where such license applies only to those patent claims licensable
+      by such Contributor that are necessarily infringed by their
+      Contribution(s) alone or by combination of their Contribution(s)
+      with the Work to which such Contribution(s) was submitted. If You
+      institute patent litigation against any entity (including a
+      cross-claim or counterclaim in a lawsuit) alleging that the Work
+      or a Contribution incorporated within the Work constitutes direct
+      or contributory patent infringement, then any patent licenses
+      granted to You under this License for that Work shal
```

**File**: `.agents/skills/frontend-design/SKILL.md` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+name: frontend-design
+description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.
+license: Complete terms in LICENSE.txt
+---
+
+# Frontend Design
+
+Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. This client has already rejected proposals that felt templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take one real aesthetic risk you can justify.
+
+## Ground it in the subject
+
+If the brief does not pin down what the product or subject is, pin it yourself before designing: name one concrete subject, its audience, and the page's single job, and state your choice. If there's any information in your memory about the human's preferences, context about what they're building, or designs you've made before – use that as a hint. The subject's own world, its materials, instruments, artifacts, and vernacular, is where distinctive choices come from. Build with the brief's real content and subject matter throughout.
+
+## Design principles
+
+For web designs, the hero is a thesis. Open with the most characteristic thing in the subject's world, in whatever form makes sense for it: a headline, an image, an animation, a live demo, an interactive moment. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the template answer, only use if that's truly the best option.
+
+Typography carries the personality of the page. Pair the display and body faces deliberately, not the same families you would reach for on any other project, and set a clear type scale with intentional weights, widths, and spacing. Make the type treatment itself a memorable part of the design, not a neutral delivery vehicle for the content.
+
+Structure is information. Structural devices, numbering, eyebrows, dividers, labels, should encode something true about the content, not decorate it. Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence - like a real process or a typed timeline where order carries information the reader needs. Question if choices like numbered markers actually make sense before incorporating them.
+
+Leverage motion deliberately. Think about where and if animation can serve the subject: a page-load sequence, a scroll-triggered reveal, hover micro-interactions, ambient atmosphere. An orchestrated moment usually lands harder than scattered effects; choose what the direction calls for. However, sometimes less is more, and extra animation contributes to the feeling that the design is AI-generated.
+
+Match complexity to the vision. Maximalist directions need elaborate execution; minimal directions need precision in spacing, type, and detail. Elegance is executing the chosen vision well.
+
+Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy. Copy can make a design feel as templated as the design itself. See the below section on writing for more guidance.
+
+## Process: brainstorm, explore, plan, critique, build, critique again
+
+For calibration: AI-generated design right now clusters around three looks: (1) a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta accent; (2) a near-black background with a single bright acid-green or vermilion accent; (3) a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns. All three are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject. Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks. Where it leaves an axis free, don't spend that freedom on one of these defaults. Just like a human designer who's hired, there's often a careful balance between doing what you're good at and taking each project as a chance to experiment and learn.
+
+Work in two passes. First, brainstorm a short design plan based on the human's design brief: create a compact token system with color, type, layout, and signature. Color: describe the palette as 4–6 named hex values. Type: the typefaces for 2+ roles (a characterful display face that's used with restraint, a complementary body face, and a utility face for captions or data if needed). Layout: a layout concept, using one-sentence prose descriptions and ASCII wireframes to ideate and compare. Signature: the single unique element this page will be remembered by that embodies the brief in an appropriate way.
+
+Then review that plan against the brief before b
```

**File**: `.agents/skills/hyperui-code-style/SKILL.md` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
----
-name: hyperui-code-style
-description: Naming conventions and style guidelines for JavaScript and TypeScript code within HyperUI.
----
-
-# Code Style Rules
-
-- Use descriptive variable names with a minimum of two words.
-- No exceptions.
```

**File**: `.agents/skills/hyperui-component-builder/SKILL.md` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
----
-name: hyperui-component-builder
-description: Guidelines for building, styling, and structuring HyperUI component blocks.
----
-
-# HyperUI Component Philosophy
-
-- **Goal**: Clean, neutral, copy-paste-friendly building blocks. No marketing fluff.
-- **Do**: Neutral palettes (grays, black, white, 1 primary accent), Tailwind v4 utilities only, subtle hover states, text hierarchy via weight/size.
-- **Do NOT**: Decorative gradients, dark mode (unless requested), animations, external dependencies, or opinionated branding.
-- **Structure**: Semantic HTML, responsive, accessible, obvious actions. No finished websites; provide minimal building blocks.
```

**File**: `.agents/skills/hyperui-github-manager/SKILL.md` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
----
-name: hyperui-github-manager
-description: Validates and generates GitHub PR and issue titles following HyperUI casing conventions.
----
-
-# PR Naming Automation
-
-When generating or reviewing PR titles, strictly enforce: `<Feature|Bugfix|Update|Epic> - Description` using sentence case.
```

**File**: `.agents/skills/modern-web-guidance/SKILL.md` (removed, +0/-114)
```diff
@@ -1,114 +0,0 @@
----
-name: modern-web-guidance
-description: |
-  Search tool for modern web development best practices. MANDATORY: Execute FIRST for all HTML/CSS and clientside JS tasks. Do NOT skip — web APIs evolve rapidly and training weights contain obsolete patterns.
-
-  Trigger immediately for:
-  - UI/Layout: Modals, dialogs, popovers, Glassmorphism/backdrop-filters, anchor positioning, container queries, `:has()`, `:user-valid`.
-  - Scroll/Motion: View Transitions, Scroll-driven animations, scroll parallax/reveals.
-  - Performance: CWV (LCP, INP), content-visibility, Fetch Priority, image optimization.
-  - System/APIs: Local filesystem access, WebUSB, WebSockets sync, WebAssembly widgets.
-  - Frameworks: Adapting layout/styles in React, Vue, Angular.
-  - General Frontend: Forms, autofill, advanced inputs, custom scrollbars, modern component states, etc.
-
-  DO NOT trigger for:
-  - Backend: Database SQL, ORMs, Express API routes.
-  - Pipelines: CI/CD deployment, Docker, Actions.
-  - Generic: Local scripts (Python/Go tools), ESLint, Git.
----
-
-# Modern Web Guidance
-
-A skill to search for specific web development use cases and retrieve their corresponding best practice guides.
-
-## When to use
-
-Must use this skill:
-- At the **start** of implementing any web feature.
-- Before creating a new component, to check if a standardized pattern already exists.
-- To avoid implementing ad-hoc solutions or loading large dependencies unnecessarily.
-
-## Usage Instructions
-
-### Step 1. Search Use Cases
-
-Search with an action-oriented query summarizing what you want to achieve using the `search` command. Run `modern-web-guidance` directly with `npx`.
-
-```sh
-npx -y modern-web-guidance@latest search "<query>" --skill-version 2026_05_16-c5e7870
-```
-
-**Example Output**:
-```json
-[
-  {
-    "id": "optimize-image-priority",
-    "description": "Optimize the loading priority of Largest Contentful Paint (LCP) candidate images.",
-    "category": "performance",
-    "featuresUsed": [ "Fetch priority" ],
-    "tokenCount": 985,
-    "similarity": 0.7289
-  },
-  {
-    "id": "defer-rendering-heavy-content",
-    "description": "Reduce rendering times in content-heavy web pages by deferring rendering for offscreen content.",
-    "category": "performance",
-    "featuresUsed": [ "content-visibility", "hidden=\"until-found\"" ],
-    "tokenCount": 1250,
-    "similarity": 0.6961
-  }
-]
-```
-
-> **Note**: If search results are vague, return no matches, or show low similarity scores, run the `list` command to browse all guides:
-> ```sh
-> npx -y modern-web-guidance@latest list
-> ```
-
----
-
-### Step 2. Retrieve Best Practices
-
-Once you have a relevant `id` from the search results, call this script using the `retrieve` command to get the full guide. You can pass multiple IDs separated by commas.
-
-```sh
-npx -y modern-web-guidance@latest retrieve "<id>"
-```
-
-
-**Example Output**:
-`The markdown content of the guide describing implementation steps...`
-
-## Using npx
-
--   IMPORTANT: on Windows, using `npx` may fail. Use `npx.cmd ...` instead.
--   Network access is required for fetching npm packages needed by the task.
--   If the `npx -y modern-web-guidance…` command hangs, you may be offline. Try running again in offline
-    mode: `npx --offline …`.
--   The `--skill-version` flag is used to determine if this SKILL.md is out of date. If it is, a warning
-    message is logged to stderr.
-
-## Guidelines
-
--   Always search **first** to find the most relevant guides.
--   These guides are usually framework-agnostic; adapt them correctly to your setup.
--   Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.
-
-
-## Interpreting Browser Support & Fallbacks
-
-* **Default Behavior**: All guides assume **Baseline Widely available** features are safe to use without fallbacks. For features that are not Baseline widely available, you **MUST** follow the fallback recommendations in the guide, unless the user has specified a custom browser support policy.
-* **Custom Policies**: If the user has already defined explicit browser support requirements, use the browser compatibility data in the guide to determine if a fallback can be safely ignored.
-  - For Baseline YYYY targets, a feature satisfies this target if its "Baseline since" date is <= YYYY.
-  - **Policy Examples**:
-    - _"Do not implement feature fallbacks."_ (for exploratory prototypes of the cutting-edge web)
-    - _"Safari 17.4+"_ (for internal tools targeting macOS or Tauri-based desktop apps)
-    - _"Never recommend or implement polyfills; if a Baseline Newly Available feature is required for core functionality, provide a lightweight custom fallback or redesign the approach."_ (to minimize bundle size and avoid technical debt)
-    - _"Assume a modern execution environment where Baseline Newly Available features can be used natively, provided they are strictly feat
```

**File**: `.agents/skills/modern-web-guidance/guides/accessibility/accessibility.md` (removed, +0/-463)
```diff
@@ -1,463 +0,0 @@
-# Accessibility Coding Guidelines
-
-This guide provides actionable DOs and DON'Ts for AI coding agents to ensure web applications are accessible to all users, including those using assistive technologies.
-
-Keep these principles in mind throughout:
-
-- **Accessibility is the minimum, not the ceiling.** Conformance to standards is the floor; aim for genuine usability.
-- **Patterns are use-case specific.** No checklist replaces real testing — including testing with disabled users — to confirm a given implementation is actually accessible in context.
-
-## 1. Content Navigability and Structure
-
-### Actionable Guidelines
-
-#### DOs
-- **Place all content within landmarks**: Wrap the page in `<header>`, `<nav>`, `<main>`, `<aside>`, and `<footer>` so assistive-tech users can jump between regions.
-- **Structure main content with headings**: Use `<h1>`–`<h6>` sequentially (no jumping `<h1>` → `<h4>`) so screen-reader users get a navigable outline.
-- **Use lists for repeated, contiguous content**: `<ul>`/`<ol>` give assistive tech a count up front and let users skip the entire group.
-- **Provide skip links** prior to repeated content like site headers with navigation or long/infinite lists, so that keyboard users can easily bypass them. Make sure the target is focusable (e.g. `<main id="content" tabindex="-1">`).
-- **Semantic Tables**: Use `<caption>` and `<th scope="col">` (or `<th scope="row">`) for data tables.
-
-#### DON'Ts
-- **Don't use fake headings**: Never style `<div>` or `<span>` to look like headings without standard `<h1>`–`<h6>` tags.
-- **Don't place headings inside `<summary>`, and avoid relying on headings inside `<details>` content**: Headings inside `<summary>` may be hidden from screen-reader heading lists and heading-navigation shortcuts entirely; headings inside `<details>` content are only reachable via heading navigation when the disclosure is open.
-  - **Caveat**: If a heading must act as a disclosure trigger, use a more robust alternative to `<details>`/`<summary>` instead, e.g. an accordion or a disclosure implemented with ARIA where the heading wraps the button.
-- **Don't use tables for layout**: Use CSS Grid/Flexbox for visual layouts.
-- **Don't overuse landmarks**: Too many landmarks dilute their value. In particular, avoid labeling a `<section>` (which turns it into a `region` landmark) — `region` should be a last resort when no other landmark fits.
-
-### Code Examples
-
-```html
-<!-- Good: Semantic landmarks, heading hierarchy, skip link -->
-<header>
-  <a href="#content" class="skip-link visually-hidden">Skip to content</a>
-  <nav aria-label="Primary">
-    <ul>
-      <li><a href="/">Home</a></li>
-    </ul>
-  </nav>
-</header>
-<main id="content" tabindex="-1">
-  <h1>Platform Dashboard</h1>
-  <section>
-    <h2>User Statistics</h2>
-    <table>
-      <caption>Monthly active users</caption>
-      <tr>
-        <th scope="col">Month</th>
-        <th scope="col">Users</th>
-      </tr>
-      <tr>
-        <td>January</td>
-        <td>12,000</td>
-      </tr>
-    </table>
-  </section>
-</main>
-```
-
-## 2. Semantic HTML and ARIA
-
-### Actionable Guidelines
-
-#### DOs
-- **Prefer HTML elements and attributes to ARIA**: A native element comes with the right role and behavior. `<button>` already implies `role="button"`; `required` already implies `aria-required`.
-- **Match ARIA implementations to actual behavior**: If you set `role="tab"`, the element must behave like a tab — including keyboard interactions. Many ARIA patterns can't be implemented in CSS alone and need JavaScript.
-- **Be deliberate about `disabled` vs `aria-disabled`**: `disabled` removes the element from the focus order entirely (and `tabindex="0"` won't bring it back), which is often wrong for toolbar buttons or links. `aria-disabled="true"` keeps the element focusable so users can land on it and learn it's disabled.
-
-#### DON'Ts
-- **Don't use ARIA when native HTML exists**: Avoid `<div role="button">` or `<a role="button">` if `<button>` works.
-- **Don't add redundant ARIA roles or properties**: Avoid `<ul role="list">`, `<nav role="navigation">`, or `<input required aria-required="true">`.
-  - **Caveat**: Safari removes list semantics from `<ul>`/`<ol>` outside `<nav>` when `list-style: none` or `display: flex`/`grid` is applied. In that case `role="list"` is required to restore them.
-- **Don't assume custom elements have no ARIA**: Custom elements can attach ARIA via `ElementInternals`, which some automated test tools can't see — so the absence of `role`/`aria-*` attributes in markup doesn't prove the element has no semantics. Verify with the browser's accessibility-tree inspector.
-
-## 3. Accessible Names and Descriptions
-
-Every interactive element and some landmarks need an accessible name, and many benefit from an accessible description. Names are short and identify the element; descriptions add context.
-
-### Actionable Guidelines
-
-#### DOs
-- **Pr
```

---

### Incident Patch 13: `b7fb4be0` (2026-06-26)
**Commit Message**: Bugfix - Source copied component HTML from build-time file, not live iframe (#730)

Co-authored-by: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `src/components/ComponentPreview.astro` (modified, +10/-22)
```diff
@@ -1,4 +1,6 @@
 ---
+import { readComponentMarkup } from '../utils/componentMarkup'
+
 interface Props {
   src: string
   title: string
@@ -8,6 +10,8 @@ interface Props {
 }
 
 const { src, title, dark = false, index = 1, wrapper = '' } = Astro.props
+
+const sourceHtml = readComponentMarkup(src)
 ---
 
 <component-preview data-src={src} class="block">
@@ -27,7 +31,7 @@ const { src, title, dark = false, index = 1, wrapper = '' } = Astro.props
     data-preview="true"
     class="prose prose-pre:m-0 prose-pre:rounded-none max-w-none data-[preview=true]:hidden"
   >
-    <pre data-html></pre>
+    <pre data-html set:text={sourceHtml} />
   </div>
 </component-preview>
 
@@ -98,16 +102,10 @@ const { src, title, dark = false, index = 1, wrapper = '' } = Astro.props
       this.viewHandler = (viewEvent) => {
         const isPreviewing = viewEvent.detail.previewing
 
-        const previewEls = this.querySelectorAll('[data-preview]')
+        const previewToggleElements = this.querySelectorAll('[data-preview]')
 
-        const contentHtml = this.getContent()
-
-        if (contentHtml && this.previewEl) {
-          this.previewEl.textContent = contentHtml
-        }
-
-        previewEls.forEach((previewEl) => {
-          previewEl.setAttribute('data-preview', isPreviewing ? 'true' : 'false')
+        previewToggleElements.forEach((previewToggleElement) => {
+          previewToggleElement.setAttribute('data-preview', isPreviewing ? 'true' : 'false')
         })
       }
 
@@ -125,24 +123,14 @@ const { src, title, dark = false, index = 1, wrapper = '' } = Astro.props
         return this.contentHtml
       }
 
-      if (this.iframeEl?.contentDocument) {
-        const docClone = this.iframeEl.contentDocument.cloneNode(true) as Document
-
-        this.contentHtml = this.sanitizeContent(docClone.body.innerHTML)
+      if (this.previewEl) {
+        this.contentHtml = this.previewEl.textContent?.trim() || null
 
         return this.contentHtml
       }
 
       return null
     }
-
-    private sanitizeContent(contentHtml: string): string {
-      return contentHtml
-        .split('\n')
-        .map((htmlLine) => htmlLine.replace(/^\s{4}/, ''))
-        .join('\n')
-        .trim()
-    }
   }
 
   customElements.define('component-preview', ComponentPreview)
```

**File**: `src/components/TypographyMapper.astro` (modified, +14/-18)
```diff
@@ -1,6 +1,5 @@
 ---
 import { MoveRight, Percent } from '@lucide/astro'
-
 ---
 
 <typography-mapper class="flex flex-1 flex-col">
@@ -87,7 +86,6 @@ import { MoveRight, Percent } from '@lucide/astro'
         <option value="900">Black (900)</option>
       </select>
     </label>
-
   </div>
 
   <div class="mt-4 flex flex-1 flex-col">
@@ -115,10 +113,7 @@ import { MoveRight, Percent } from '@lucide/astro'
                 class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
               ></span>
 
-              <span
-                data-letter-spacing-label-badge
-                class="hidden"
-              ></span>
+              <span data-letter-spacing-label-badge class="hidden"></span>
             </div>
           </div>
 
@@ -246,18 +241,13 @@ import { MoveRight, Percent } from '@lucide/astro'
           <pre data-config-pre class="overflow-x-auto p-4 font-mono text-sm text-gray-900"></pre>
 
           <div class="absolute top-3 right-3">
-            <button
-              data-copy-config-button
-              type="button"
-              class="hidden"
-            >
+            <button data-copy-config-button type="button" class="hidden">
               <span data-copy-config-button-text>Copy</span>
               <span data-copy-config-live-region aria-live="polite" class="sr-only"></span>
             </button>
           </div>
         </div>
       </div>
-
     </div>
   </div>
 </typography-mapper>
@@ -544,7 +534,6 @@ import { MoveRight, Percent } from '@lucide/astro'
     return 'Arbitrary font size and line height'
   }
 
-
   function buildThemeConfig(
     mappingResult: TypographyMappingResult,
     fontSizePixelValue: number,
@@ -636,7 +625,9 @@ import { MoveRight, Percent } from '@lucide/astro'
       await navigator.clipboard.writeText(textToCopy)
       buttonTextElement.textContent = 'Copied'
       liveRegionElement.textContent = 'Copied to clipboard.'
-      if (existingTimerId) { clearTimeout(existingTimerId) }
+      if (existingTimerId) {
+        clearTimeout(existingTimerId)
+      }
       return setTimeout(() => {
         buttonTextElement.textContent = 'Copy'
         liveRegionElement.textContent = ''
@@ -758,7 +749,9 @@ import { MoveRight, Percent } from '@lucide/astro'
       configCopyButtonElement.addEventListener('click', async () => {
         const configPreElement = this.querySelector<HTMLPreElement>('[data-config-pre]')!
         const configText = configPreElement.textContent ?? ''
-        if (!configText.trim()) { return }
+        if (!configText.trim()) {
+          return
+        }
         this.configCopyTimerId = await copyTextToClipboard(
           configText,
           configCopyButtonTextElement,
@@ -774,7 +767,9 @@ import { MoveRight, Percent } from '@lucide/astro'
       const copyLiveRegionElement = this.querySelector<HTMLElement>('[data-copy-live-region]')!
 
       copyButtonElement.addEventListener('click', async () => {
-        if (!this.currentCombinedClass) { return }
+        if (!this.currentCombinedClass) {
+          return
+        }
         this.clipboardCopyTimerId = await copyTextToClipboard(
           this.currentCombinedClass,
           copyButtonTextElement,
@@ -807,7 +802,9 @@ import { MoveRight, Percent } from '@lucide/astro'
       const customClassName = classNameInputElement.value.trim() || null
 
       const fontWeightUtilityClass =
-        !customClassName && fontWeightValue !== '400' ? FONT_WEIGHT_UTILITY_MAP[fontWeightValue] : ''
+        !customClassName && fontWeightValue !== '400'
+          ? FONT_WEIGHT_UTILITY_MAP[fontWeightValue]
+          : ''
       const combinedClassWithWeight = fontWeightUtilityClass
         ? `${mappingResult.combinedClass} ${fontWeightUtilityClass}`
         : mappingResult.combinedClass
@@ -926,7 +923,6 @@ import { MoveRight, Percent } from '@lucide/astro'
         ? 'inline-flex items-center justify-center rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800'
         : 'hidden'
     }
-
   }
 
   customElements.define('typography-mapper', TypographyMapper)
```

**File**: `src/pages/index.astro` (modified, +4/-2)
```diff
@@ -50,7 +50,9 @@ const neobrutalism = neobrutalismRaw
 
   <main id="main-content" class="mx-auto max-w-7xl divide-y divide-gray-200 px-4">
     <section class="py-16">
-      <div class="flex items-center justify-between gap-8 rounded-lg border border-gray-200 bg-gray-50 p-8">
+      <div
+        class="flex items-center justify-between gap-8 rounded-lg border border-gray-200 bg-gray-50 p-8"
+      >
         <div>
           <h2 class="text-2xl font-medium">HyperUI Tools</h2>
 
@@ -61,7 +63,7 @@ const neobrutalism = neobrutalismRaw
 
         <a
           href="/tools"
-          class="shrink-0 inline-flex items-center justify-center gap-2 rounded-md border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-gray-800 hover:bg-gray-800"
+          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-gray-800 hover:bg-gray-800"
         >
           Browse tools
         </a>
```

**File**: `src/utils/componentMarkup.ts` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+const BODY_CONTENT_PATTERN = /<body[^>]*>([\s\S]*?)<\/body>/i
+
+const rawComponentFileMap = import.meta.glob('../../public/examples/**/*.html', {
+  query: '?raw',
+  import: 'default',
+  eager: true,
+}) as Record<string, string>
+
+const componentMarkupMap: Record<string, string> = {}
+
+for (const [filePath, fileContent] of Object.entries(rawComponentFileMap)) {
+  const normalizedSrc = filePath.replace(/^.*\/public/, '')
+
+  componentMarkupMap[normalizedSrc] = fileContent
+}
+
+export function readComponentMarkup(componentSrc: string): string {
+  const rawFileContent = componentMarkupMap[componentSrc]
+
+  if (!rawFileContent) {
+    return ''
+  }
+
+  const bodyContentMatch = rawFileContent.match(BODY_CONTENT_PATTERN)
+
+  if (!bodyContentMatch) {
+    return ''
+  }
+
+  return bodyContentMatch[1]
+    .split('\n')
+    .map((markupLine) => markupLine.replace(/^\s{4}/, ''))
+    .join('\n')
+    .trim()
+}
```

---

### Incident Patch 14: `ab44e960` (2026-06-03)
**Commit Message**: Add HyperUI skills & update Copilot instructions

Add three HyperUI skill definitions: hyperui-code-style, hyperui-component-builder, and hyperui-github-manager under .agents/skills. Remove the generic find-skills skill. Streamline .github/copilot-instructions.md to a concise role/context for the HyperUI maintainer with strict terse guidance and tech stack notes.

**File**: `.agents/skills/find-skills/SKILL.md` (removed, +0/-142)
```diff
@@ -1,142 +0,0 @@
----
-name: find-skills
-description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.
----
-
-# Find Skills
-
-This skill helps you discover and install skills from the open agent skills ecosystem.
-
-## When to Use This Skill
-
-Use this skill when the user:
-
-- Asks "how do I do X" where X might be a common task with an existing skill
-- Says "find a skill for X" or "is there a skill for X"
-- Asks "can you do X" where X is a specialized capability
-- Expresses interest in extending agent capabilities
-- Wants to search for tools, templates, or workflows
-- Mentions they wish they had help with a specific domain (design, testing, deployment, etc.)
-
-## What is the Skills CLI?
-
-The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem. Skills are modular packages that extend agent capabilities with specialized knowledge, workflows, and tools.
-
-**Key commands:**
-
-- `npx skills find [query]` - Search for skills interactively or by keyword
-- `npx skills add <package>` - Install a skill from GitHub or other sources
-- `npx skills check` - Check for skill updates
-- `npx skills update` - Update all installed skills
-
-**Browse skills at:** https://skills.sh/
-
-## How to Help Users Find Skills
-
-### Step 1: Understand What They Need
-
-When a user asks for help with something, identify:
-
-1. The domain (e.g., React, testing, design, deployment)
-2. The specific task (e.g., writing tests, creating animations, reviewing PRs)
-3. Whether this is a common enough task that a skill likely exists
-
-### Step 2: Check the Leaderboard First
-
-Before running a CLI search, check the [skills.sh leaderboard](https://skills.sh/) to see if a well-known skill already exists for the domain. The leaderboard ranks skills by total installs, surfacing the most popular and battle-tested options.
-
-For example, top skills for web development include:
-- `vercel-labs/agent-skills` — React, Next.js, web design (100K+ installs each)
-- `anthropics/skills` — Frontend design, document processing (100K+ installs)
-
-### Step 3: Search for Skills
-
-If the leaderboard doesn't cover the user's need, run the find command:
-
-```bash
-npx skills find [query]
-```
-
-For example:
-
-- User asks "how do I make my React app faster?" → `npx skills find react performance`
-- User asks "can you help me with PR reviews?" → `npx skills find pr review`
-- User asks "I need to create a changelog" → `npx skills find changelog`
-
-### Step 4: Verify Quality Before Recommending
-
-**Do not recommend a skill based solely on search results.** Always verify:
-
-1. **Install count** — Prefer skills with 1K+ installs. Be cautious with anything under 100.
-2. **Source reputation** — Official sources (`vercel-labs`, `anthropics`, `microsoft`) are more trustworthy than unknown authors.
-3. **GitHub stars** — Check the source repository. A skill from a repo with <100 stars should be treated with skepticism.
-
-### Step 5: Present Options to the User
-
-When you find relevant skills, present them to the user with:
-
-1. The skill name and what it does
-2. The install count and source
-3. The install command they can run
-4. A link to learn more at skills.sh
-
-Example response:
-
-```
-I found a skill that might help! The "react-best-practices" skill provides
-React and Next.js performance optimization guidelines from Vercel Engineering.
-(185K installs)
-
-To install it:
-npx skills add vercel-labs/agent-skills@react-best-practices
-
-Learn more: https://skills.sh/vercel-labs/agent-skills/react-best-practices
-```
-
-### Step 6: Offer to Install
-
-If the user wants to proceed, you can install the skill for them:
-
-```bash
-npx skills add <owner/repo@skill> -g -y
-```
-
-The `-g` flag installs globally (user-level) and `-y` skips confirmation prompts.
-
-## Common Skill Categories
-
-When searching, consider these common categories:
-
-| Category        | Example Queries                          |
-| --------------- | ---------------------------------------- |
-| Web Development | react, nextjs, typescript, css, tailwind |
-| Testing         | testing, jest, playwright, e2e           |
-| DevOps          | deploy, docker, kubernetes, ci-cd        |
-| Documentation   | docs, readme, changelog, api-docs        |
-| Code Quality    | review, lint, refactor, best-practices   |
-| Design          | ui, ux, design-system, accessibility     |
-| Productivity    | workflow, automation, git                |
-
-## Tips for Effective Searches
-
-1. **Use specific keywords**: "react testing" is better than just "testing"
-2. **Try alternative terms**: If "deploy" doesn't work, try "deployment" or "ci-cd"
-3. **Check popular sources**: Many skills come from `verce
```

**File**: `.agents/skills/hyperui-code-style/SKILL.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+name: hyperui-code-style
+description: Naming conventions and style guidelines for JavaScript and TypeScript code within HyperUI.
+---
+
+# Code Style Rules
+
+- Use descriptive variable names with a minimum of two words.
+- No exceptions.
```

**File**: `.agents/skills/hyperui-component-builder/SKILL.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+name: hyperui-component-builder
+description: Guidelines for building, styling, and structuring HyperUI component blocks.
+---
+
+# HyperUI Component Philosophy
+
+- **Goal**: Clean, neutral, copy-paste-friendly building blocks. No marketing fluff.
+- **Do**: Neutral palettes (grays, black, white, 1 primary accent), Tailwind v4 utilities only, subtle hover states, text hierarchy via weight/size.
+- **Do NOT**: Decorative gradients, dark mode (unless requested), animations, external dependencies, or opinionated branding.
+- **Structure**: Semantic HTML, responsive, accessible, obvious actions. No finished websites; provide minimal building blocks.
```

**File**: `.agents/skills/hyperui-github-manager/SKILL.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+name: hyperui-github-manager
+description: Validates and generates GitHub PR and issue titles following HyperUI casing conventions.
+---
+
+# PR Naming Automation
+
+When generating or reviewing PR titles, strictly enforce: `<Feature|Bugfix|Update|Epic> - Description` using sentence case.
```

**File**: `.github/copilot-instructions.md` (modified, +4/-85)
```diff
@@ -1,86 +1,5 @@
-# Role & Tone
+# Role & Context
 
-- You are a senior frontend developer maintaining HyperUI.
-- **Be concise.** Give direct answers and code. Avoid conversational filler.
-- If a request violates the component guidelines below, briefly explain why and offer a compliant alternative.
-
-# Tech Stack
-
-- **Tailwind CSS v4**: This project uses v4.
-  - Use `@theme` (Tailwind v4) where configuration is needed.
-  - Use `size-*` utilities where appropriate.
-  - Assume modern browser support (no vendor prefixes needed).
-- **Astro**: The documentation site is built with Astro.
-- **HTML**: Use semantic elements (`<nav>`, `<main>`, `<article>`) and ARIA attributes for accessibility.
-
-# Component Guidelines
-
-## Core Philosophy
-
-HyperUI is a **component library for developers**. Components should be:
-
-1. **Clean and neutral** - Use minimal styling that focuses on structure and usability
-2. **Easily customizable** - Avoid unnecessary decorative styling (gradients, excessive color) that developers can't easily override
-3. **Semantic and accessible** - Proper HTML structure, accessible markup, ARIA labels where needed
-4. **Production-ready** - Components that can be dropped directly into projects with Tailwind CSS v4
-5. **Copy-paste friendly** - Developers should understand and be able to modify the code easily
-
-## What We DON'T Do
-
-- ❌ Decorative gradients on backgrounds (unless essential to component function)
-- ❌ Overly branded styling with proprietary color schemes
-- ❌ Unnecessary animations or effects that don't improve UX
-- ❌ External dependencies (date pickers, carousels, third-party libraries)
-- ❌ Opinionated styling that forces a specific design direction
-- ❌ Dark mode variants unless explicitly requested
-
-## What We DO Do
-
-- ✅ Neutral color palettes (grays, blacks, whites, primary accent color)
-- ✅ Tailwind CSS v4 utilities only (no custom CSS where possible)
-- ✅ Clear semantic HTML structure
-- ✅ Accessibility-first approach
-- ✅ Multiple variants that show different use cases, not different "themes"
-- ✅ Components that are **blocks developers can build with**, not marketing fluff
-
-## Styling Approach
-
-- **Primary accent color**: Use for CTAs and interactive elements
-- **Neutrals**: Grays for borders, text, secondary content
-- **Backgrounds**: Prefer white/transparent or very subtle grays
-- **Hover states**: Subtle color changes, not dramatic transformations
-- **Text hierarchy**: Use font weights and sizes, not colors
-
-## Component Structure
-
-Each component should have:
-
-1. Clear, descriptive title
-2. Semantic HTML
-3. Accessible ARIA attributes where needed
-4. Responsive design (if applicable)
-5. Obvious primary/secondary actions
-6. No unnecessary decoration
-
-## For Future Development
-
-When adding new collections or components:
-
-1. Ask: "Can a developer easily customize this?"
-2. Ask: "Is this decoration or is it essential?"
-3. Ask: "Would this work with any brand's color scheme?"
-4. If the answer to any is no, reconsider the approach
-
-**Remember**: We're not designing finished websites. We're providing building blocks that developers can use to build their own designs. Default to minimal, neutral output unless explicitly asked otherwise.
-
-# Issue and PR Naming
-
-- Use consistent casing for all GitHub issue and pull request titles.
-- Use sentence case for the description part.
-- Keep descriptions concise and specific.
-- Pull request titles must follow this exact format: `<Feature|Bugfix|Update|Epic> - Description`
-- Valid examples:
-  - `Feature - Add new card variants`
-  - `Bugfix - Fix mobile menu focus trap`
-  - `Update - Refresh accordion documentation`
-  - `Epic - Rework component search experience`
+- Senior Frontend Developer maintaining HyperUI (Tailwind CSS v4 component library, Astro documentation site).
+- **CRITICAL**: Be highly terse. Code only. No conversational filler or explanations unless explicitly requested.
+- **Tech Stack**: Tailwind CSS v4, Astro, Semantic HTML, ARIA accessibility.
```

**File**: `skills-lock.json` (modified, +0/-6)
```diff
@@ -7,12 +7,6 @@
       "skillPath": "skills/building-components/SKILL.md",
       "computedHash": "20889af7cb9b3abca1e38824f7fffaa873eb0cc4d45187967b97bd85462cf934"
     },
-    "find-skills": {
-      "source": "vercel-labs/skills",
-      "sourceType": "github",
-      "skillPath": "skills/find-skills/SKILL.md",
-      "computedHash": "9e1c8b3103f92fa8092568a44fe64858de7c5c9dc65ce4bea8f168080e889cfd"
-    },
     "modern-web-guidance": {
       "source": "GoogleChrome/modern-web-guidance",
       "sourceType": "github",
```

---

### Incident Patch 15: `5b040b2f` (2026-05-30)
**Commit Message**: Add building-components skill and refs

Introduce a new "building-components" skill with a top-level SKILL.md and a comprehensive set of reference guides (accessibility, as-child, composition, data-attributes, definitions, design-tokens, docs, marketplaces, npm, polymorphism, principles, registry, state, styling, types). Also add/adjust related SKILL entry for find-skills. Update package.json and lockfiles (pnpm-lock.yaml, skills-lock.json) to reflect dependency changes.

**File**: `.agents/skills/building-components/SKILL.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+---
+name: building-components
+description: Guide for building modern, accessible, and composable UI components. Use when building new components, implementing accessibility, creating composable APIs, setting up design tokens, publishing to npm/registry, or writing component documentation.
+---
+
+# Building Components
+
+## When to use this skill
+
+Use when the user is:
+
+- Building new UI components (primitives, components, blocks, templates)
+- Implementing accessibility features (ARIA, keyboard navigation, focus management)
+- Creating composable component APIs (slots, render props, controlled/uncontrolled state)
+- Setting up design tokens and theming systems
+- Publishing components to npm or a registry
+- Writing component documentation
+- Implementing polymorphism or as-child patterns
+- Working with data attributes for styling/state
+
+## References
+
+- [definitions.mdx](./references/definitions.mdx) - Artifact taxonomy (primitives, components, blocks, templates)
+- [principles.mdx](./references/principles.mdx) - Core principles for component design
+- [accessibility.mdx](./references/accessibility.mdx) - ARIA, keyboard navigation, WCAG compliance
+- [composition.mdx](./references/composition.mdx) - Composable component patterns
+- [as-child.mdx](./references/as-child.mdx) - The as-child pattern for element polymorphism
+- [polymorphism.mdx](./references/polymorphism.mdx) - Polymorphic component patterns
+- [types.mdx](./references/types.mdx) - TypeScript typing patterns for components
+- [state.mdx](./references/state.mdx) - Controlled vs uncontrolled state management
+- [data-attributes.mdx](./references/data-attributes.mdx) - Using data attributes for styling and state
+- [design-tokens.mdx](./references/design-tokens.mdx) - Design token systems and theming
+- [styling.mdx](./references/styling.mdx) - Component styling approaches
+- [registry.mdx](./references/registry.mdx) - shadcn-style registry distribution
+- [npm.mdx](./references/npm.mdx) - Publishing components to npm
+- [marketplaces.mdx](./references/marketplaces.mdx) - Component marketplace distribution
+- [docs.mdx](./references/docs.mdx) - Writing component documentation
```

**File**: `.agents/skills/building-components/references/accessibility.mdx` (added, +819/-0)
```diff
@@ -0,0 +1,819 @@
+---
+title: Accessibility
+description: Building components that are usable by everyone, including users with disabilities who rely on assistive technologies.
+type: guide
+summary: Semantic HTML, keyboard navigation, ARIA patterns, focus management, color contrast, and common accessibility pitfalls.
+prerequisites:
+  - /definitions
+  - /composition
+related:
+  - /data-attributes
+  - /types
+---
+
+Accessibility (a11y) is not an optional feature—it's a fundamental requirement for modern web components. Every component must be usable by everyone, including people with visual, motor, auditory, or cognitive disabilities.
+
+This guide is a non-exhaustive list of accessibility principles and patterns that you should follow when building components. It's not a comprehensive guide, but it should give you a sense of the types of issues you should be aware of.
+
+If you use a linter with strong accessibility rules like [Ultracite](https://www.ultracite.ai), these types of issues will likely be caught automatically, but it's still important to understand the principles.
+
+## Core Principles
+
+### 1. Semantic HTML First
+
+Always start with the most appropriate HTML element. Semantic HTML provides built-in accessibility features that custom implementations often miss.
+
+```tsx
+// ❌ Don't reinvent the wheel
+<div onClick={handleClick} className="button">
+  Click me
+</div>
+
+// ✅ Use semantic elements
+<button onClick={handleClick}>
+  Click me
+</button>
+```
+
+Semantic elements come with proper role announcements, keyboard interaction, focus management, and form participation.
+
+### 2. Keyboard Navigation
+
+Every interactive element must be keyboard accessible. Users should be able to navigate, activate, and interact with all functionality using only a keyboard.
+
+```tsx
+// ✅ Complete keyboard support
+function Menu() {
+  const handleKeyDown = (e: React.KeyboardEvent) => {
+    switch (e.key) {
+      case "ArrowDown":
+        focusNextItem();
+        break;
+      case "ArrowUp":
+        focusPreviousItem();
+        break;
+      case "Home":
+        focusFirstItem();
+        break;
+      case "End":
+        focusLastItem();
+        break;
+      case "Escape":
+        closeMenu();
+        break;
+    }
+  };
+
+  return (
+    <div role="menu" onKeyDown={handleKeyDown}>
+      {/* menu items */}
+    </div>
+  );
+}
+```
+
+### 3. Screen Reader Support
+
+Ensure all content and interactions are announced properly to screen readers using ARIA attributes when necessary.
+
+```tsx
+// ✅ Proper ARIA labeling
+<nav aria-label="Main navigation">
+  <ul>
+    <li><a href="/" aria-current="page">Home</a></li>
+    <li><a href="/about">About</a></li>
+  </ul>
+</nav>
+
+// ✅ Dynamic content announcements
+<div aria-live="polite" aria-atomic="true">
+  {isLoading && <span>Loading results...</span>}
+  {results && <span>{results.length} results found</span>}
+</div>
+```
+
+### 4. Visual Accessibility
+
+Support users with visual impairments through proper contrast, focus indicators, and responsive text sizing.
+
+```css
+/* ✅ Visible focus indicators */
+button:focus-visible {
+  outline: 2px solid var(--color-focus);
+  outline-offset: 2px;
+}
+
+/* ✅ Sufficient color contrast (4.5:1 for normal text, 3:1 for large text) */
+.text {
+  color: #333; /* Against white: 12.6:1 ratio */
+  background: white;
+}
+
+/* ✅ Responsive text sizing */
+.text {
+  font-size: 1rem; /* Respects user preferences */
+}
+```
+
+## ARIA Patterns
+
+### Understanding ARIA
+
+ARIA (Accessible Rich Internet Applications) provides semantic information about elements to assistive technologies. Use ARIA to enhance, not replace, semantic HTML.
+
+It has a few rules that you should follow:
+
+1. Don't use ARIA if you can use semantic HTML
+2. Don't change native semantics unless necessary
+3. All interactive elements must be keyboard accessible
+4. Don't hide focusable elements from assistive technologies
+5. All interactive elements must have accessible names
+
+### Common ARIA Attributes
+
+#### Roles
+
+Define what an element is:
+
+```tsx
+// Widget roles
+<div role="button" tabIndex={0} onClick={handleClick}>
+  Custom Button
+</div>
+
+// Landmark roles
+<div role="navigation" aria-label="Breadcrumb">
+  {/* breadcrumb items */}
+</div>
+
+// Live region roles
+<div role="alert">
+  Error: Invalid email address
+</div>
+```
+
+#### States
+
+Describe the current state of an element:
+
+```tsx
+// Checked state
+<div
+  role="checkbox"
+  aria-checked={isChecked}
+  tabIndex={0}
+>
+  Accept terms
+</div>
+
+// Expanded state
+<button
+  aria-expanded={isOpen}
+  aria-controls="panel-1"
+>
+  Toggle Panel
+</button>
+<div id="panel-1" hidden={!isOpen}>
+  Panel content
+</div>
+
+// Selected state
+<li
+  role="option"
+  aria-selected={isSelected}
+>
+  Option 1
+</li>
+```
+
+#### Properties
+
+Provide additional information:
+
+```tsx
+// Labels and descriptions
+<input
+  aria-label="Search"
+  a
```

**File**: `.agents/skills/building-components/references/as-child.mdx` (added, +324/-0)
```diff
@@ -0,0 +1,324 @@
+---
+title: asChild
+description: How to use the `asChild` prop to render a custom element within the component.
+type: reference
+summary: Using the asChild prop to replace default markup with custom elements while preserving component functionality and event handlers.
+prerequisites:
+  - /composition
+  - /types
+related:
+  - /polymorphism
+  - /state
+---
+
+The `asChild` prop is a powerful pattern in modern React component libraries. Popularized by [Radix UI](https://www.radix-ui.com/primitives/docs/guides/composition) and adopted by [shadcn/ui](https://ui.shadcn.com), this pattern allows you to replace default markup with custom elements while maintaining the component's functionality.
+
+## Understanding `asChild`
+
+At its core, `asChild` changes how a component renders. When set to `true`, instead of rendering its default DOM element, the component merges its props, behaviors, and event handlers with its immediate child element.
+
+### Without `asChild`
+
+```tsx
+<Dialog.Trigger>
+  <button>Open Dialog</button>
+</Dialog.Trigger>
+```
+
+This renders nested elements:
+
+```html
+<button data-state="closed">
+  <button>Open Dialog</button>
+</button>
+```
+
+### With `asChild`
+
+```tsx
+<Dialog.Trigger asChild>
+  <button>Open Dialog</button>
+</Dialog.Trigger>
+```
+
+This renders a single, merged element:
+
+```html
+<button data-state="closed">Open Dialog</button>
+```
+
+The Dialog.Trigger's functionality is composed onto your button, eliminating unnecessary wrapper elements.
+
+## How It Works
+
+Under the hood, `asChild` uses React's composition capabilities to merge components:
+
+```tsx
+// Simplified implementation
+function Component({ asChild, children, ...props }) {
+  if (asChild) {
+    // Clone child and merge props
+    return React.cloneElement(children, {
+      ...props,
+      ...children.props,
+      // Merge event handlers
+      onClick: (e) => {
+        props.onClick?.(e);
+        children.props.onClick?.(e);
+      },
+    });
+  }
+
+  // Render default element
+  return <button {...props}>{children}</button>;
+}
+```
+
+The component:
+
+1. Checks if `asChild` is true
+2. Clones the child element
+3. Merges props from both parent and child
+4. Combines event handlers
+5. Returns the enhanced child
+
+## Key Benefits
+
+### 1. Semantic HTML
+
+`asChild` lets you use the most appropriate HTML element for your use case:
+
+```tsx
+// Use a link for navigation
+<AlertDialog.Trigger asChild>
+  <a href="/delete">Delete Account</a>
+</AlertDialog.Trigger>
+
+// Use a custom button component
+<Tooltip.Trigger asChild>
+  <IconButton icon={<InfoIcon />} />
+</Tooltip.Trigger>
+```
+
+### 2. Clean DOM Structure
+
+Traditional composition often creates deeply nested DOM structures. `asChild` eliminates this "wrapper hell":
+
+```tsx
+// Without asChild: Nested wrappers
+<TooltipProvider>
+  <Tooltip>
+    <TooltipTrigger>
+      <button>
+        <span>Hover me</span>
+      </button>
+    </TooltipTrigger>
+  </Tooltip>
+</TooltipProvider>
+
+// With asChild: Clean structure
+<TooltipProvider>
+  <Tooltip>
+    <TooltipTrigger asChild>
+      <button>Hover me</button>
+    </TooltipTrigger>
+  </Tooltip>
+</TooltipProvider>
+```
+
+### 3. Design System Integration
+
+`asChild` enables seamless integration with your existing design system components:
+
+```tsx
+import { Button } from "@/components/ui/button";
+
+<DropdownMenu.Trigger asChild>
+  <Button variant="outline" size="icon">
+    <MoreVertical className="h-4 w-4" />
+  </Button>
+</DropdownMenu.Trigger>;
+```
+
+Your Button component receives all the necessary dropdown trigger behavior without modification.
+
+### 4. Component Composition
+
+You can compose multiple behaviors onto a single element:
+
+```tsx
+<Dialog.Trigger asChild>
+  <Tooltip.Trigger asChild>
+    <button>Open dialog (with tooltip)</button>
+  </Tooltip.Trigger>
+</Dialog.Trigger>
+```
+
+This creates a button that both opens a dialog and shows a tooltip on hover.
+
+## Common Use Cases
+
+### Custom Trigger Elements
+
+Replace default triggers with custom components:
+
+```tsx
+// Custom link trigger
+<Collapsible.Trigger asChild>
+  <a href="#" className="text-blue-600 underline">
+    Toggle Details
+  </a>
+</Collapsible.Trigger>
+
+// Icon-only trigger
+<Popover.Trigger asChild>
+  <IconButton>
+    <Settings className="h-4 w-4" />
+  </IconButton>
+</Popover.Trigger>
+```
+
+### Accessible Navigation
+
+Maintain proper semantics for navigation elements:
+
+```tsx
+<NavigationMenu.Link asChild>
+  <Link href="/products" className="nav-link">
+    Products
+  </Link>
+</NavigationMenu.Link>
+```
+
+### Form Integration
+
+Integrate with form libraries while preserving functionality:
+
+```tsx
+<FormField
+  control={form.control}
+  name="acceptTerms"
+  render={({ field }) => (
+    <FormItem>
+      <Checkbox.Root asChild>
+        <input type="checkbox" {...field} className="sr-only" />
+      </Checkbox.Root>
+    </FormI
```

**File**: `.agents/skills/building-components/references/composition.mdx` (added, +239/-0)
```diff
@@ -0,0 +1,239 @@
+---
+title: Composition
+description: The foundation of building modern UI components.
+type: conceptual
+summary: How to break monolithic components into smaller, focused subcomponents using the compound component pattern and naming conventions.
+prerequisites:
+  - /definitions
+related:
+  - /types
+  - /state
+  - /as-child
+  - /polymorphism
+---
+
+Composition, or composability, is the foundation of building modern UI components. It is one of the most powerful techniques for creating flexible, reusable components that can handle complex requirements without sacrificing API clarity.
+
+Instead of cramming all functionality into a single component with dozens of props, composition distributes responsibility across multiple cooperating components.
+
+Fernando gave a great talk about this at React Universe Conf 2025, where he shared his approach to rebuilding Slack's Message Composer as a composable component.
+
+
+## Making a component composable
+
+To make a component composable, you need to break it down into smaller, more focused components. For example, let's take this Accordion component:
+
+```tsx title="accordion.tsx"
+import { Accordion } from "@/components/ui/accordion";
+
+const data = [
+  {
+    title: "Accordion 1",
+    content: "Accordion 1 content",
+  },
+  {
+    title: "Accordion 2",
+    content: "Accordion 2 content",
+  },
+  {
+    title: "Accordion 3",
+    content: "Accordion 3 content",
+  },
+];
+
+return <Accordion data={data} />;
+```
+
+While this Accordion component might seem simple, it's handling too many responsibilities. It's responsible for rendering the container, trigger and content; as well as handling the accordion state and data.
+
+Customizing the styling of this component is difficult because it's tightly coupled. It likely requires global CSS overrides. Additionally, adding new functionality or tweaking the behavior requires modifying the component source code.
+
+To solve this, we can break this down into smaller, more focused components.
+
+### 1. Root Component
+
+First, let's focus on the container - the component that holds everything together i.e. the trigger and content. This container doesn't need to know about the data, but it does need to keep track of the open state.
+
+However, we also want this state to be accessible by child components. So, let's use the Context API to create a context for the open state.
+
+Finally, to allow for modification of the `div` element, we'll extend the default HTML attributes.
+
+We'll call this component the "Root" component.
+
+```tsx title="@/components/ui/accordion.tsx"
+type AccordionProps = React.ComponentProps<"div"> & {
+  open: boolean;
+  setOpen: (open: boolean) => void;
+};
+
+const AccordionContext = createContext<AccordionProps>({
+  open: false,
+  setOpen: () => {},
+});
+
+export type AccordionRootProps = React.ComponentProps<"div"> & {
+  open: boolean;
+  setOpen: (open: boolean) => void;
+};
+
+export const Root = ({
+  children,
+  open,
+  setOpen,
+  ...props
+}: AccordionRootProps) => (
+  <AccordionContext.Provider value={{ open, setOpen }}>
+    <div {...props}>{children}</div>
+  </AccordionContext.Provider>
+);
+```
+
+### 2. Item Component
+
+The Item component is the element that contains the accordion item. It is simply a wrapper for each item in the accordion.
+
+```tsx title="@/components/ui/accordion.tsx"
+export type AccordionItemProps = React.ComponentProps<"div">;
+
+export const Item = (props: AccordionItemProps) => <div {...props} />;
+```
+
+### 3. Trigger Component
+
+The Trigger component is the element that opens the accordion when activated. It is responsible for:
+
+- Rendering as a button by default (can be customized with `asChild`)
+- Handling click events to open the accordion
+- Managing focus when accordion closes
+- Providing proper ARIA attributes
+
+Let's add this component to our Accordion component.
+
+```tsx title="@/components/ui/accordion.tsx"
+export type AccordionTriggerProps = React.ComponentProps<"button"> & {
+  asChild?: boolean;
+};
+
+export const Trigger = ({ asChild, ...props }: AccordionTriggerProps) => (
+  <AccordionContext.Consumer>
+    {({ open, setOpen }) => (
+      <button onClick={() => setOpen(!open)} {...props} />
+    )}
+  </AccordionContext.Consumer>
+);
+```
+
+### 4. Content Component
+
+The Content component is the element that contains the accordion content. It is responsible for:
+
+- Rendering the content when the accordion is open
+- Providing proper ARIA attributes
+
+Let's add this component to our Accordion component.
+
+```tsx title="@/components/ui/accordion.tsx"
+export type AccordionContentProps = React.ComponentProps<"div"> & {
+  asChild?: boolean;
+};
+
+export const Content = ({ asChild, ...props }: AccordionContentProps) => (
+  <AccordionContext.Consumer>
+    {({ open }) => <div {...props} />}
+  </AccordionContext.Consumer>
+);
+```
+
+### 5. Putting it all together
+
+Now that we have all the co
```

**File**: `.agents/skills/building-components/references/data-attributes.mdx` (added, +413/-0)
```diff
@@ -0,0 +1,413 @@
+---
+title: Data Attributes
+description: Using data attributes for declarative styling and component identification.
+type: reference
+summary: Using data-state for declarative visual state styling and data-slot for stable component identification in Tailwind-based systems.
+prerequisites:
+  - /composition
+  - /styling
+related:
+  - /design-tokens
+  - /accessibility
+---
+
+Data attributes provide a powerful way to expose component state and structure to consumers, enabling flexible styling without prop explosion. Modern component libraries use two primary patterns: `data-state` for visual states and `data-slot` for component identification.
+
+## Styling state with data-state
+
+One of the most common anti-patterns in component styling is exposing separate className props for different states.
+
+In less modern components, you'll often see APIs like this:
+
+```tsx
+<Dialog
+  openClassName="bg-black"
+  closedClassName="bg-white"
+  classes={{
+    open: "opacity-100",
+    closed: "opacity-0",
+  }}
+/>
+```
+
+This approach has several problems:
+
+- It couples the component's internal state to its styling API
+- It creates an explosion of props as components grow more complex
+- It makes the component harder to use and maintain
+- It prevents styling based on state combinations
+
+### The solution: data-state attributes
+
+Instead, use `data-*` attributes to expose component state declaratively. This allows consumers to style components based on state using standard CSS selectors:
+
+```tsx title="component.tsx"
+const Dialog = ({ className, ...props }: DialogProps) => {
+  const [isOpen, setIsOpen] = useState(false);
+
+  return (
+    <div
+      data-state={isOpen ? "open" : "closed"}
+      className={cn("transition-all", className)}
+      {...props}
+    />
+  );
+};
+```
+
+Now consumers can style the component based on state from the outside:
+
+```tsx title="app.tsx"
+<Dialog className="data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
+```
+
+### Benefits of this approach
+
+1. **Single className prop** - No need for multiple state-specific className props
+2. **Composable** - Combine multiple data attributes for complex states
+3. **Standard CSS** - Works with any CSS-in-JS solution or plain CSS
+4. **Type-safe** - TypeScript can infer data attribute values
+5. **Inspectable** - States are visible in DevTools as HTML attributes
+
+### Common state patterns
+
+Use data attributes for all kinds of component state:
+
+```tsx
+// Open/closed state
+<Accordion data-state={isOpen ? 'open' : 'closed'} />
+
+// Selected state
+<Tab data-state={isSelected ? 'active' : 'inactive'} />
+
+// Disabled state (in addition to disabled attribute)
+<Button data-disabled={isDisabled} disabled={isDisabled} />
+
+// Loading state
+<Button data-loading={isLoading} />
+
+// Orientation
+<Slider data-orientation="horizontal" />
+
+// Side/position
+<Tooltip data-side="top" />
+```
+
+### Styling with Tailwind
+
+Tailwind supports arbitrary variants, making data attribute styling elegant:
+
+```tsx
+<Dialog
+  className={cn(
+    // Base styles
+    "rounded-lg border p-4",
+    // State-based styles
+    "data-[state=open]:animate-in data-[state=open]:fade-in",
+    "data-[state=closed]:animate-out data-[state=closed]:fade-out",
+    // Multiple attributes
+    "data-[state=open][data-side=top]:slide-in-from-top-2",
+  )}
+/>
+```
+
+For commonly-used states, you can extend Tailwind's configuration:
+
+```js title="tailwind.config.js"
+module.exports = {
+  theme: {
+    extend: {
+      data: {
+        open: 'state="open"',
+        closed: 'state="closed"',
+        active: 'state="active"',
+      },
+    },
+  },
+};
+```
+
+Now you can use shorthand:
+
+```tsx
+<Dialog className="data-open:opacity-100 data-closed:opacity-0" />
+```
+
+### Integration with Radix UI
+
+This pattern is used extensively by [Radix UI](https://www.radix-ui.com/), which automatically applies data attributes to its primitives:
+
+```tsx
+import * as Dialog from "@radix-ui/react-dialog";
+
+<Dialog.Root>
+  <Dialog.Trigger />
+  <Dialog.Portal>
+    {/* Radix automatically adds data-state="open" | "closed" */}
+    <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out" />
+    <Dialog.Content className="data-[state=open]:fade-in data-[state=closed]:fade-out" />
+  </Dialog.Portal>
+</Dialog.Root>;
+```
+
+Other data attributes Radix provides include:
+
+- `data-state` - open/closed, active/inactive, on/off
+- `data-side` - top/right/bottom/left (for positioned elements)
+- `data-align` - start/center/end (for positioned elements)
+- `data-orientation` - horizontal/vertical
+- `data-disabled` - present when disabled
+- `data-placeholder` - present when showing placeholder
+
+## Component identification with data-slot
+
+While `data-state` tracks visual states, `data-slot` identifies component types within a composition. This pattern, popularized by [shadcn/ui](http
```

**File**: `.agents/skills/building-components/references/definitions.mdx` (added, +258/-0)
```diff
@@ -0,0 +1,258 @@
+---
+title: Definitions
+description: This page establishes precise terminology used throughout the specification. Terms are intentionally framework agnostic, but we will use React for examples.
+type: reference
+summary: Precise terminology for the specification covering primitives, components, patterns, blocks, pages, templates, and utilities.
+related:
+  - /principles
+  - /composition
+---
+
+## 1. Artifact Taxonomy
+
+### 1.1 Primitive
+
+A primitive (or, unstyled component) is the **lowest‑level building block** that provides behavior and accessibility without any styling.
+
+Primitives are completely headless (i.e. unstyled) and encapsulate semantics, focus management, keyboard interaction, layering/portals, ARIA wiring, measurement, and similar concerns. They provide the behavioral foundation but require styling to become finished UI.
+
+Examples:
+
+- [Radix UI Primitives](https://www.radix-ui.com/primitives) (Dialog, Popover, Tooltip, etc.)
+- [React Aria Components](https://react-spectrum.adobe.com/react-aria)
+- [Base UI](https://base-ui.com)
+- [Headless UI](https://headlessui.com/)
+
+Expectations:
+
+- Completely unstyled (headless).
+- Single responsibility; composable into styled components.
+- Ships with exhaustive a11y behavior for its role.
+- Versioning favors stability; breaking changes are rare and documented.
+
+<Callout>
+  The terms primitive and component are typically used interchangeably across
+  the web, but they are not the same.
+</Callout>
+
+### 1.2 Component
+
+A component is a styled, reusable UI unit that adds visual design to primitives or composes multiple elements to create complete, functional interface elements.
+
+Components are still relatively low-level but include styling, making them immediately usable in applications. They typically wrap unstyled primitives with default visual design while remaining customizable.
+
+Examples:
+
+- [shadcn/ui components](https://ui.shadcn.com/) (styled wrappers of Radix primitives)
+- [Material UI components](https://mui.com/components/)
+- [Ant Design components](https://ant.design/components/overview/)
+
+Expectations:
+
+- Clear props API; supports controlled and uncontrolled usage where applicable.
+- Includes default styling but remains override-friendly (classes, tokens, slots).
+- Fully keyboard accessible and screen-reader friendly (inherits from primitives).
+- Composable (children/slots, render props, or compound subcomponents).
+- May be built from primitives or implement behavior directly with styling.
+
+### 1.3 Pattern
+
+Patterns are a specific composition of primitives or components that are used to solve a specific UI/UX problem.
+
+Examples:
+
+- Form validation with inline errors
+- Confirming destructive actions
+- Typeahead search
+- Optimistic UI
+
+Expectations.
+
+- Describes behavior, a11y, keyboard map, and failure modes.
+- May include reference implementations in multiple frameworks.
+
+### 1.4 Block
+
+An opinionated, production-ready composition of components that solves a concrete interface use case (often product-specific) with content scaffolding. Blocks trade generality for speed of adoption.
+
+Examples:
+
+- Pricing table
+- Auth screens
+- Onboarding stepper
+- AI chat panel
+- Billing settings form
+
+Expectations.
+
+- Strong defaults, copy-paste friendly, easily branded/themed.
+- Minimal logic beyond layout and orchestration; domain logic is stubbed via handlers.
+- Accepts data via props; never hides data behind fetches without a documented adapter.
+
+<AuthorNote
+  name="Rob Austin"
+  role="Founder of shadcnblocks.com"
+  githubUsername="JugglerX"
+  link="https://www.shadcnblocks.com/"
+>
+  Blocks are typically not reusable like a component. You don't import them, but
+  they typically import components and primitives. This makes them good
+  candidates for a [Registry](/registry) distribution method.
+</AuthorNote>
+
+### 1.5 Page
+
+A complete, single-route view composed of multiple blocks arranged to serve a specific user-facing purpose. Pages combine blocks into a cohesive layout that represents one destination in an application.
+
+Examples:
+
+- Landing page (hero block + features block + pricing block + footer block)
+- Product detail page (image gallery block + product info block + reviews block)
+- Dashboard page (stats block + chart block + activity feed block)
+
+Expectations:
+
+- Combines multiple blocks into a unified layout for a single route.
+- Focuses on layout and block orchestration rather than component-level details.
+- May include page-specific logic for data coordination between blocks.
+- Self-contained for a single URL/route; not intended to be reused across routes.
+
+### 1.6 Template
+
+A multi-page collection or full-site scaffold that bundles pages, routing configuration, shared layouts, global providers, and project structure. Templates are complete starting points for entire applications or major application sections.
+
+Examples
```

**File**: `.agents/skills/building-components/references/design-tokens.mdx` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+---
+title: Design Tokens
+description: How semantic naming conventions and design tokens create a flexible, maintainable theming system.
+type: conceptual
+summary: Semantic CSS variable architecture for theming with layers of abstraction that separate what something is from how it looks.
+prerequisites:
+  - /styling
+related:
+  - /data-attributes
+---
+
+One of the core foundations of modern component libraries lies in their thoughtful approach to styling. Rather than hardcoding colors or creating rigid class systems, we can employ a semantic naming convention that separates the concerns of theme, context, and usage.
+
+This semantic naming convention is known as design tokens. This architectural decision creates a maintainable, flexible system that scales beautifully across applications.
+
+## The Philosophy of Semantic CSS Variables
+
+Traditional CSS approaches often couple color values directly to their usage contexts, creating brittle systems that are difficult to maintain. Design tokens take a different approach by creating layers of abstraction that separate what something is from how it looks.
+
+## Understanding the Variable Architecture
+
+Let's examine how we can structure our CSS variables to create this flexible system:
+
+```css title="globals.css"
+@import "tailwindcss";
+@import "tw-animate-css";
+
+@custom-variant dark (&:is(.dark *));
+
+@theme inline {
+  --color-background: var(--background);
+  --color-foreground: var(--foreground);
+  --color-primary: var(--primary);
+  --color-primary-foreground: var(--primary-foreground);
+}
+
+:root {
+  --background: oklch(1 0 0);
+  --foreground: oklch(0.145 0 0);
+  --primary: oklch(0.205 0 0);
+  --primary-foreground: oklch(0.985 0 0);
+}
+
+.dark {
+  --background: oklch(0.145 0 0);
+  --foreground: oklch(0.985 0 0);
+  --primary: oklch(0.922 0 0);
+  --primary-foreground: oklch(0.205 0 0);
+}
+```
+
+In the above example, we have four design tokens:
+
+- `--background`, which is used for background colors (primarily the background of the page)
+- `--foreground`, which is used for foreground colors (the general text color)
+- `--primary`, which is used for primary colors (the main color of the brand)
+- `--primary-foreground`, which is used for primary foreground colors (the text color, as seen against the primary color)
```

**File**: `.agents/skills/building-components/references/docs.mdx` (added, +155/-0)
```diff
@@ -0,0 +1,155 @@
+---
+title: Docs
+description: How to document your components.
+type: guide
+summary: Essential documentation sections for components including demos, installation, API reference, accessibility notes, and changelog.
+prerequisites:
+  - /composition
+related:
+  - /registry
+  - /npm
+  - /marketplaces
+---
+
+Good documentation is essential for making your components accessible and easy to use. This guide outlines the key elements every component documentation page should include.
+
+## Documentation Framework
+
+To scale your documentation, you can use a documentation framework. There are many options available depending on your projects' language and project needs. Popular options include:
+
+- [Fumadocs](https://fumadocs.dev/) - Fast, feature-rich documentation framework for Next.js
+- [Nextra](https://nextra.site/) - Markdown-based documentation with built-in search and theming
+- [Content Collections](https://content-collections.dev/) - Type-safe content management for documentation
+- [Docusaurus](https://docusaurus.io/) - Feature-rich documentation sites with versioning support
+- [VitePress](https://vitepress.dev/) - Vue-powered static site generator optimized for documentation
+
+Preferably, your framework choice should support syntax highlighting, custom components and be generally well designed.
+
+## Essential Documentation Sections
+
+### Overview
+
+Start with a brief introduction explaining what the component does and when to use it.
+
+### Demo, Source Code, and Preview
+
+For a great first impression for developers, you should include a demo that shows the component in action, as well as the code used to create the demo.
+
+If you're using an open source [Registry](/registry), you can also include a preview of the source code that is used to create the component.
+
+Use code blocks with syntax highlighting and copy-to-clipboard functionality. Consider using tabbed interfaces to switch between these views without cluttering the page.
+
+### Installation
+
+Include a clear instruction on how to install the component. Preferably this should be a single command you can copy and paste into your terminal.
+
+If you're building on shadcn/ui, you can use the [shadcn CLI](https://ui.shadcn.com/docs/cli) to install the component e.g.
+
+```package-install
+npx shadcn@latest add <your-component-url>
+```
+
+If you're publishing to a [Marketplace](/marketplaces), you can use the marketplace's CLI to install the component e.g.
+
+```package-install
+npx shadcn@latest add https://21st.dev/r/<your-author>/<your-component>
+```
+
+If you're not using shadcn/ui but you are building a [Registry](/registry), you could build your own CLI to install the component, e.g.
+
+```package-install
+npx your-registry-cli@latest add <your-component-url>
+```
+
+Lastly, if you're publishing to npm, you can use the npm CLI to install the component e.g.
+
+```package-install
+npm install <your-component-name>
+```
+
+<Callout>
+  To show multiple installation options like we've done above, you can use
+  something like Fumadocs' [`package-install`
+  syntax](https://fumadocs.dev/docs/headless/mdx/install).
+</Callout>
+
+### Features
+
+List the key features of your component to help users quickly understand its capabilities and advantages. For example:
+
+- **Customizable** – Easily adjust styles, sizes, and behavior to fit your needs.
+- **Accessible by default** – Follows best practices for keyboard navigation, ARIA roles, and screen reader support.
+- **Composable** – Designed to work seamlessly with other components and patterns.
+- **Type-safe** – Ships with comprehensive TypeScript types for maximum safety and autocomplete.
+- **Theming support** – Integrates with your design tokens or theme system.
+- **Lightweight** – Minimal dependencies and optimized for performance.
+- **SSR/SSG ready** – Works with server-side and static rendering frameworks.
+- **Well-documented** – Includes clear usage examples and API reference.
+
+Tailor this list to your specific component. Highlight what makes it unique or especially useful for developers.
+
+### Examples
+
+Demonstrate the component's flexibility with practical examples:
+
+- **Variants** - Different visual styles or sizes available
+- **States** - Loading, disabled, error, or success states
+- **Advanced Usage** - Complex scenarios and edge cases
+- **Composition** - How the component works with other components
+- **Responsive Behavior** - How it adapts to different screen sizes
+
+Each example should include both the rendered output and the corresponding code.
+
+### Props and API Reference
+
+Document all available props, methods, and configuration options. Consider grouping related props together and highlighting commonly used ones. For each prop, include:
+
+- **Name** - The prop identifier
+- **Type** - TypeScript type definition
+- **Default** - Default value if not specified
+- **Required** - Whether the prop is mandatory
+- **Description**
```

#### Recent Merged Pull Requests:
- **PR #757** (closed): Bump devalue from 5.9.0 to 5.9.2 (@dependabot[bot])
- **PR #756** (closed): Bump astro from 7.2.3 to 7.2.8 (@dependabot[bot])
- **PR #755** (closed): Bugfix - Resolve breadcrumbs dark-mode hover visibility report on the house-style branch (@markmead)
- **PR #754** (2026-08-31): Bugfix - Give dark example HTML files an explicit dark background (@markmead)
- **PR #752** (closed): Feature - Establish house-style color system and migrate collections to it (@markmead)
- **PR #751** (closed): Feature - Add dark variant generator script and collection-level dark mode opt-out (@markmead)
- **PR #750** (2026-08-29): Bugfix - Fix RTL layout bugs from physical transform and inset utilities (@nank1ro)
- **PR #748** (2026-08-27): Bugfix - Fix Storefront, Portfolio, and Support Inbox template issues (@markmead)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
