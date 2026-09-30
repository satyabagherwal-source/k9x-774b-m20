# Forensic Learning Record (Deep Inspection): arco-design/arco-design-vue

> **Canonical Artifact**: `07_PROJECT_LEARNING/arco-design-arco-design-vue-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arco-design/arco-design-vue](https://github.com/arco-design/arco-design-vue))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:41.675Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arco-design/arco-design-vue`
- **Description**: A Vue.js 3 UI Library based on Arco Design
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3106 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
// Adapt to vscode.
// This file will be found in the root directory of vscode.
// If it cannot be found, it will report an error and cannot run eslint in the editor.
module.exports = {};

```

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  tabWidth: 2,
  semi: true,
  printWidth: 80,
  singleQuote: true,
  quoteProps: 'consistent',
  endOfLine: 'lf',
  htmlWhitespaceSensitivity: 'strict',
};

```

### Core Architecture Module: `commitlint.config.js`
```
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'enhance',
        'refactor',
        'revert',
        'style',
        'test',
      ],
    ],
  },
};

```

### Core Architecture Module: `packages/arco-changelog/.eslintrc.js`
```
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
  },
  env: {
    node: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    // Airbnb JavaScript Style Guide https://github.com/airbnb/javascript
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  rules: {
    'prettier/prettier': 1,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/no-empty-function': 1,
    '@typescript-eslint/ban-ts-comment': 0,
    'import/extensions': [
      'error',
      'ignorePackages',
      { js: 'never', jsx: 'never', ts: 'never', tsx: 'never' },
    ],
    'import/no-extraneous-dependencies': 0,
    'import/no-unresolved': [2, { caseSensitive: false }],
    'import/prefer-default-export': 0,
    'no-underscore-dangle': 0,
    'no-nested-ternary': 0,
    'no-shadow': 0,
    'prefer-template': 1,
    'no-param-reassign': 0,
    'no-plusplus': 0,
    'no-use-before-define': 0,
    'no-restricted-syntax': 0,
    'no-empty': [2, { allowEmptyCatch: true }],
    'no-bitwise': 0,
    'no-return-assign': 0,
    'no-unused-expressions': [
      'error',
      { allowShortCircuit: true, allowTernary: true },
    ],
    'no-continue': 0,
  },
};

```

### Core Architecture Module: `packages/arco-changelog/.prettierrc.js`
```
module.exports = {
  tabWidth: 2,
  semi: true,
  printWidth: 80,
  singleQuote: true,
  quoteProps: 'consistent',
  endOfLine: 'auto',
  htmlWhitespaceSensitivity: 'strict',
};

```

### Core Architecture Module: `packages/arco-changelog/copy-template.js`
```
#!/usr/bin/env node

const fs = require('fs-extra');

fs.copySync('src/vue/template.en-US.njk', 'dist/vue/template.en-US.njk', {
  overwrite: true,
});
fs.copySync('src/vue/template.zh-CN.njk', 'dist/vue/template.zh-CN.njk', {
  overwrite: true,
});
fs.copySync(
  'src/default/template.en-US.njk',
  'dist/default/template.en-US.njk',
  {
    overwrite: true,
  }
);
fs.copySync(
  'src/default/template.zh-CN.njk',
  'dist/default/template.zh-CN.njk',
  {
    overwrite: true,
  }
);
fs.copySync('src/.github', 'dist/.github', {
  overwrite: true,
});
fs.copySync('src/.gitlab', 'dist/.gitlab', {
  overwrite: true,
});

```

### Core Architecture Module: `packages/arco-changelog/src/changelog.ts`
```
import marked, { Tokens } from 'marked';
import { invertKeyValues } from './utils/invert';
import { ChangelogData } from './interface';

export const getChangelogList = (
  content: string,
  config: {
    pr: any;
    typeDict: Record<string, string>;
    keyDict: Record<string, string>;
  }
) => {
  const _content = content.replace(/\r\n/g, '\n');
  const _typeDict = invertKeyValues(config.typeDict);
  const _keyDict = invertKeyValues(config.keyDict);

  const typeRule = new RegExp(
    '##\\s*Types? of changes.+?\\[\\s*[xX]\\s*]\\s*(.+?)(?:\\n|$)',
    'si'
  );
  const typeMatch = _content.match(typeRule)?.[1].trim();
  const defaultType = typeMatch && _typeDict[typeMatch];

  const rule = new RegExp('##\\s*Changelog\\n(.+?)(?:##|$)', 'si');
  const match = _content.match(rule)?.[1];
  if (!match) return undefined;
  const tokens = marked.lexer(match);
  const table = tokens.filter(
    (token) => token.type === 'table'
  )[0] as Tokens.Table;
  if (!table) return undefined;

  const keys = table.header.map((header) => {
    return _keyDict[header];
  });

  return table.cells.reduce((list, cur) => {
    const data = cur.reduce(
      (data, value, index) => {
        const key = keys[index];
        if (key === 'type') {
          data[key] = _typeDict[value];
        } else if (key === 'issues') {
          data[key] = value
            .split(',')
            .map((item) => item.match(/#\d+/)?.[0])
            .filter((item) => Boolean(item)) as string[];
        } else {
          data[key] = value;
        }

        return data;
      },
      {
        type: defaultType,
        pr: config.pr,
      } as ChangelogData
    );

    list.push(data);
    return list;
  }, [] as ChangelogData[]);
};

```

### Core Architecture Module: `packages/arco-changelog/src/cmd.ts`
```
#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { changelog } from './index';
import { run } from './copy-github';

const program = new Command();

const packageContent = fs.readFileSync(
  path.resolve(__dirname, '../package.json'),
  'utf8'
);
const packageData: any = JSON.parse(packageContent);

program
  .name('arco-changelog')
  .version(packageData.version)
  .action(async () => {
    await changelog();
  })
  .command('template')
  .option('--gitlab', 'generate gitlab template')
  .action(async ({ gitlab }) => {
    run({ gitlab });
  });

program.parse(process.argv);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3670** (2026-09-01): **docs(navbar): restore Design/Dev/Ecosystem links for GitHub Pages**
  *Symptoms*: ## Summary - Keep top-nav **设计 / 开发 / 生态产品** (not removed) - Fix broken relative \href\s on GitHub Pages by pointing tabs to absolute \https://arco.design/...\ URLs - Development tab targets Vue docs start (this is the Vue site)  ## Test plan - [ ] Open docs site navbar; confirm the three tabs still render - [ ] Click 设计 → opens arco.design design specs - [ ] Click 开发 → opens arco.design Vue docs - [ ] Dropdown items under each tab still work  Related: roadmap https://github.com/uno-arco/arco-design-vue/issues/1
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/uno-arco/arco-design-vue/docs/navbar-arco-design-links?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=uno-arco&repo=arco-design-vue&branch=docs/navbar-arco-design-links&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=uno-arco&repo=arco-design-vue&branch=docs/navbar-arco-design-links&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/uno-arco/arco-design-vue/docs/navbar-arco-design-links?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > Sorry — opened against the wrong repository by mistake. This change belongs in the community fork uno-arco/arco-design-vue, not upstream. Closing.

- **Issue #3665** (2026-06-24): **fix(image): ensure left mouse button is used for dragging**
  *Symptoms*: <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design-vue/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Component style change - [ ] Typescript definition change - [ ] Documentation change - [ ] Coding style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Breaking change - [ ] Others  ## Background and context  <!-- Explain what problem does the PR solve --> <!-- Link to related open issues if applicable -->  ## Solution  <!-- Describe how the problem is fixed in detail -->  ## How is the change tested?  <!-- Unit tests should be added/updated for bug fixes and new features, if applicable --> <!-- Please describe how you tested the change. E.g. Creating/updating unit tests or attaching a screenshot of how it works with your change -->  ## Changelog  | Component | Changelog(CN) | Changelog(EN) | Related issues | | --------- | ------------- | ------------- | -------------- | |     Image      |       确保使用鼠标左键进行拖动        |       ensure left mouse button is used for dragging        |        #3662        |  <!-- If th
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/betavs/arco-design-vue/hotfix/image-mousemove?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=betavs&repo=arco-design-vue&branch=hotfix/image-mousemove&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=betavs&repo=arco-design-vue&branch=hotfix/image-mousemove&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/betavs/arco-design-vue/hotfix/image-mousemove?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 

- **Issue #3664** (2026-06-11): **Merge Upstream**
  *Symptoms*: <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design-vue/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [ ] Bug fix - [ ] Enhancement - [ ] Component style change - [ ] Typescript definition change - [ ] Documentation change - [ ] Coding style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Breaking change - [ ] Others  ## Background and context  <!-- Explain what problem does the PR solve --> <!-- Link to related open issues if applicable -->  ## Solution  <!-- Describe how the problem is fixed in detail -->  ## How is the change tested?  <!-- Unit tests should be added/updated for bug fixes and new features, if applicable --> <!-- Please describe how you tested the change. E.g. Creating/updating unit tests or attaching a screenshot of how it works with your change -->  ## Changelog  | Component | Changelog(CN) | Changelog(EN) | Related issues | | --------- | ------------- | ------------- | -------------- | |           |               |               |                |  <!-- If there are multiple types, you can add the `Type` column in the Change
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/liunnn1994/sd-design/main?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=liunnn1994&repo=sd-design&branch=main&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=liunnn1994&repo=sd-design&branch=main&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/liunnn1994/sd-design/main?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 

- **Issue #3663** (2026-06-24): **fix: 修复trigger组件props和interface定义不一致的问题**
  *Symptoms*: ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [ ] Bug fix - [ ] Enhancement - [ ] Component style change - [x] Typescript definition change - [ ] Documentation change - [ ] Coding style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Breaking change - [ ] Others  ## Background and context  增加interface中的属性，保持和props中属性一致，解决ts中使用属性报错的问题 `error TS2353: Object literal may only specify known properties, and 'renderToBody' does not exist in type 'TriggerProps'.`  ## Solution  ## How is the change tested?  ## Changelog  | Component | Changelog(CN) | Changelog(EN) | Related issues | | --------- | ------------- | ------------- | -------------- | | trigger | 补全 `TriggerProps` 缺失的类型定义 | Add missing properties to `TriggerProps` | |  ## Checklist:  - [ ] Test suite passes (`npm run test`) - [x] Provide changelog for relevant changes (e.g. bug fixes and new features) if applicable. - [x] Changes are submitted to the appropriate branch (e.g. features should be submitted to `feature` branch and others   should be submitted to `main` branch)  ## Other information  <!-- Please describe what other information that should be taken care of. --> 
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/musishui/arco-design-vue/main?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=musishui&repo=arco-design-vue&branch=main&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=musishui&repo=arco-design-vue&branch=main&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/musishui/arco-design-vue/main?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 

- **Issue #3662** (2026-06-24): **图片 Image 组件，右键保存图片后，图片会跟随鼠标移动**
  *Symptoms*: ## 问题描述 图片 Image 组件 1. 点击图片，打开预览 2. 右键图片后，点击 图片存储为... 后 3. 在图片上移动鼠标，图片会跟随鼠标位置移动 4. 再次点击图片后，即可恢复  ## 复现路径 在 [官网文档 Image 组件里](https://arco.design/vue/component/image) 操作即可复现  ## 环境信息 - Apple M2 MacBook Air - macOS 26.3.1  - Chrome 版本 148.0.7778.216（正式版本） (arm64)  ## 库版本 ```"@arco-design/web-vue": "^2.58.0"``` 

- **Issue #3661** (2026-05-21): **关于表单组件的placeholder为null问题**
  *Symptoms*: - [x] I'm sure this does not appear in [the issue list of the repository](https://github.com/arco-design/arco-design-vue/issues)  ## 基本信息  - **依赖包名 及 版本:** @arco-design/web-vue@2.44.7 - **框架版本:** vue - **浏览器版本:** chrome146.0.0.0 - **复现地址:** https://vue-pro.arco.design/form/group  ## 预期结果 表单在未输入值的时候，无论按下什么按键placeholder都不应该会发生改变  ## 复现步骤 在表单未输入时按下 `Esc` 键，placeholder会改为null  <!--- 声明: 如果提交带有攻击性的 issue，提交者将会被禁止在 arco-design 组织下发言。 --> <!-- generated by arco-issue. DO NOT REMOVE -->
  **Post-Mortem & Fix Analysis**:
  > 此bug由 chrome 146.0.7680.165（正式版本）引起

- **Issue #3659** (2026-05-18): **fix(textarea): update value before input event**
  *Symptoms*: <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design-vue/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Component style change - [ ] Typescript definition change - [ ] Documentation change - [ ] Coding style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Breaking change - [ ] Others  ## Background and context  <!-- Explain what problem does the PR solve --> Textarea emits the `input` event before updating its internal value and `v-model`. As a result, consumers reading the bound value inside an `@input` handler can observe the previous value.  <!-- Link to related open issues if applicable --> https://github.com/arco-design/arco-design-vue/issues/3211  ## Solution  <!-- Describe how the problem is fixed in detail --> Update Textarea input handling so `updateValue(value)` runs before emitting `input`, matching the behavior of the Input component. This applies to both normal input and `compositionend`.   ## How is the change tested?  <!-- Unit tests should be added/updated for bug fixes and new features, if applicabl

- **Issue #3658** (2026-05-08): **fix(verification-code): 修复验证码输入框光标定位与聚焦行为**
  *Symptoms*: <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design-vue/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Component style change - [ ] Typescript definition change - [ ] Documentation change - [ ] Coding style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Breaking change - [ ] Others  ## Background and context  粘贴刚好填满输入时会聚焦在第一个，没有自动聚焦最后一格  ## Solution  - 粘贴时自动聚焦到内容最后 - 聚焦已有内容的输入框时光标在文字末尾  ## How is the change tested?  <!-- Unit tests should be added/updated for bug fixes and new features, if applicable --> <!-- Please describe how you tested the change. E.g. Creating/updating unit tests or attaching a screenshot of how it works with your change -->  ## Changelog  | Component | Changelog(CN) | Changelog(EN) | Related issues | | --------- | ------------- | ------------- | -------------- | | verification-code  |  修复验证码输入框光标定位与聚焦行为 | improve cursor placement and focus behavior |  Closes #3399               |  <!-- If there are multiple types, you can add the `Type` column in the Changelog, the value of the column is

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

### Incident Patch 1: `ee158dd7` (2026-06-24)
**Commit Message**: fix: 修复trigger组件props和interface定义不一致的问题 (#3663)

Co-authored-by: renxj50 <renxj50@chinaunicom.cn>

**File**: `packages/web-vue/components/trigger/interface.ts` (modified, +12/-5)
```diff
@@ -27,11 +27,11 @@ export interface TriggerProps {
   popupStyle?: CSSProperties;
   animationName?: string;
   duration?:
-    | number
-    | {
-        enter: number;
-        leave: number;
-      };
+  | number
+  | {
+    enter: number;
+    leave: number;
+  };
   mouseEnterDelay?: number;
   mouseLeaveDelay?: number;
   focusDelay?: number;
@@ -40,5 +40,12 @@ export interface TriggerProps {
   autoFixPosition?: boolean;
   popupContainer?: string | HTMLElement;
   updateAtScroll?: boolean;
+  autoFitTransformOrigin?: boolean;
+  hideEmpty?: boolean;
+  opendClass?: string | string[] | Record<string, boolean>;
   autoFitPosition?: boolean;
+  renderToBody?: boolean;
+  preventFocus?: boolean;
+  scrollToClose?: boolean;
+  scrollToCloseDistance?: number;
 }
```

---

### Incident Patch 2: `3b2fb6c3` (2026-06-24)
**Commit Message**: fix(image): ensure left mouse button is used for dragging (#3665)

**File**: `packages/web-vue/components/image/hooks/use-image-drag.ts` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ export default function useImageDrag(props: ImageDragProps) {
 
   // Grab the picture and start moving: record the initial data
   const onMoveStart = (e: MouseEvent) => {
-    if (e.target !== e.currentTarget) return;
+    if (e.target !== e.currentTarget || e.button !== 0) return;
     e.preventDefault && e.preventDefault();
     moving.value = true;
 
```

---

### Incident Patch 3: `f7ca0c0f` (2026-05-18)
**Commit Message**: fix(textarea): update value before input event (#3659)

**File**: `packages/web-vue/components/textarea/__test__/index.test.ts` (modified, +43/-0)
```diff
@@ -20,4 +20,47 @@ describe('Textarea', () => {
     await wrapper.find('.arco-textarea-clear-btn').trigger('click');
     expect(textarea.element.value).toBe('');
   });
+
+  test('should update model before input event handlers run', async () => {
+    let modelValue = '';
+    let modelValueInInput = '';
+    const wrapper = mount(Textarea, {
+      props: {
+        modelValue,
+        'onUpdate:modelValue': (value: string) => {
+          modelValue = value;
+        },
+        'onInput': () => {
+          modelValueInInput = modelValue;
+        },
+      },
+    });
+
+    await wrapper.find('textarea').setValue('textarea');
+
+    expect(modelValueInInput).toBe('textarea');
+  });
+
+  test('should update model before input event handlers run on compositionend', async () => {
+    let modelValue = '';
+    let modelValueInInput = '';
+    const wrapper = mount(Textarea, {
+      props: {
+        modelValue,
+        'onUpdate:modelValue': (value: string) => {
+          modelValue = value;
+        },
+        'onInput': () => {
+          modelValueInInput = modelValue;
+        },
+      },
+    });
+    const textarea = wrapper.find('textarea');
+
+    await textarea.trigger('compositionstart');
+    textarea.element.value = 'textarea';
+    await textarea.trigger('compositionend');
+
+    expect(modelValueInInput).toBe('textarea');
+  });
 });
```

**File**: `packages/web-vue/components/textarea/textarea.vue` (modified, +2/-2)
```diff
@@ -344,8 +344,8 @@ export default defineComponent({
           return;
         }
 
-        emit('input', value, e);
         updateValue(value);
+        emit('input', value, e);
         eventHandlers.value?.onInput?.(e);
       } else {
         isComposition.value = true;
@@ -367,8 +367,8 @@ export default defineComponent({
           return;
         }
 
-        emit('input', value, e);
         updateValue(value);
+        emit('input', value, e);
         eventHandlers.value?.onInput?.(e);
       } else {
         compositionValue.value = value;
```

---

### Incident Patch 4: `4b36fef9` (2026-05-08)
**Commit Message**: fix(verification-code): 修复验证码输入框光标定位与聚焦行为 (#3658)

**File**: `packages/web-vue/components/verification-code/__demo__/basic.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ Basic usage
 import { ref } from 'vue';
 import { Message } from '@arco-design/web-vue';
 
-const value = ref('654321');
+const value = ref('');
 const handleFinish = (value) => Message.info(`Verification code: ${value}`);
 </script>
 ```
```

**File**: `packages/web-vue/components/verification-code/__test__/__snapshots__/demo.test.ts.snap` (modified, +6/-6)
```diff
@@ -1,12 +1,12 @@
 // Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html
 
 exports[`<verification-code> demo: > render [basic] correctly 1`] = `
-<div class="arco-verification-code" style="width: 300px;"><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value="6"><!----><!----></span>
-  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value="5"><!----><!----></span>
-  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value="4"><!----><!----></span>
-  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value="3"><!----><!----></span>
-  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value="2"><!----><!----></span>
-  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value="1"><!----><!----></span>
+<div class="arco-verification-code" style="width: 300px;"><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value=""><!----><!----></span>
+  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value=""><!----><!----></span>
+  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value=""><!----><!----></span>
+  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value=""><!----><!----></span>
+  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value=""><!----><!----></span>
+  <!----><span class="arco-input-wrapper arco-input"><!----><input class="arco-input arco-input-size-medium" type="text" value=""><!----><!----></span>
   <!---->
 </div>
 `;
```

**File**: `packages/web-vue/components/verification-code/verification-code.tsx` (modified, +17/-10)
```diff
@@ -2,7 +2,7 @@ import { PropType, VNode, computed, defineComponent, ref, watch } from 'vue';
 import { Size } from '../_utils/constant';
 import { getPrefixCls } from '../_utils/global-config';
 import ArcoInput from '../input';
-import { isExist, isFunction, isString } from '../_utils/is';
+import { isExist, isFunction, isString, isUndefined } from '../_utils/is';
 import { Backspace, ArrowLeft, ArrowRight } from '../_utils/keycode';
 
 export default defineComponent({
@@ -140,15 +140,21 @@ export default defineComponent({
 
     const handleFocus = (index: number) => inputRefList?.value[index].focus();
     const focusFirstEmptyInput = (index?: number) => {
-      if (isExist(index) && innerValue.value[index as number]) {
-        return;
-      }
-      for (let i = 0; i < innerValue.value.length; i++) {
-        if (!innerValue.value[i]) {
-          handleFocus(i);
-          break;
-        }
-      }
+      const values = innerValue.value;
+      const len = values.length;
+      if (!isUndefined(index) && values[index]) return;
+      const firstEmpty = values.findIndex((v) => !v);
+      handleFocus(firstEmpty === -1 ? len - 1 : firstEmpty);
+    };
+
+    const handleCursorToEnd = (e: MouseEvent, i: number) => {
+      if (!innerValue.value[i]) return;
+      const target = e.target as HTMLInputElement;
+      if (!target?.setSelectionRange) return;
+      e.preventDefault();
+      target.focus();
+      const end = target.value.length;
+      target.setSelectionRange(end, end);
     };
 
     const handlePaste = (e: ClipboardEvent, index: number) => {
@@ -236,6 +242,7 @@ export default defineComponent({
                 // @ts-ignore
                 onKeydown={(e) => handleKeydown(i, e)}
                 onPaste={(e: ClipboardEvent) => handlePaste(e, i)}
+                onMousedown={(e: MouseEvent) => handleCursorToEnd(e, i)}
               />
               {props.separator?.(i, c)}
             </>
```

---

### Incident Patch 5: `8eab41de` (2026-05-07)
**Commit Message**: fix(locale): 修复部分国际化语言检验信息字段缺失问题 (#3656)

**File**: `packages/web-vue/components/locale/__test__/index.test.ts` (modified, +103/-36)
```diff
@@ -1,50 +1,117 @@
-import path from 'path';
-import glob from 'glob';
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+import { defineComponent } from 'vue';
+import { mount } from '@vue/test-utils';
 import zhCN from '../lang/zh-cn';
 
-function hasEqualStructure(
-  obj1: Record<string, unknown>,
-  obj2: Record<string, unknown>
-) {
-  return Object.keys(obj1).every((key) => {
-    const v = obj1[key];
+const modules = import.meta.glob<{ default: typeof zhCN }>('../lang/*.ts', {
+  eager: true,
+});
+
+const langs = Object.entries(modules)
+  .map(([fullPath, mod]) => ({
+    fileName: fullPath.split('/').pop() as string,
+    lang: mod.default,
+  }))
+  .sort((a, b) => a.fileName.localeCompare(b.fileName));
+
+const langCases = langs.map(({ fileName, lang }) => [fileName, lang] as const);
 
-    if (typeof v === 'object' && v !== null) {
-      if (!obj2[key]) {
-        return false;
-      }
+const toExpectedLocale = (fileName: string) => {
+  const [language, region] = fileName.replace('.ts', '').split('-');
+  return `${language}-${region.toUpperCase()}`;
+};
 
-      return hasEqualStructure(v, obj2[key]);
-    }
+const collectLeafKeys = (input: unknown, prefix = ''): string[] => {
+  if (Array.isArray(input)) {
+    return input.flatMap((item, index) =>
+      collectLeafKeys(item, `${prefix}[${index}]`)
+    );
+  }
 
-    return obj2.hasOwnProperty(key);
+  if (input && typeof input === 'object') {
+    return Object.entries(input as Record<string, unknown>)
+      .sort(([a], [b]) => a.localeCompare(b))
+      .flatMap(([key, value]) =>
+        collectLeafKeys(value, prefix ? `${prefix}.${key}` : key)
+      );
+  }
+
+  return [prefix];
+};
+
+describe('locale contract', () => {
+  it('should discover all language files', () => {
+    expect(langs.length).toBeGreaterThan(1);
   });
-}
 
-export default function toMatchStructure(actual, expected) {
-  const pass = hasEqualStructure(actual, expected);
+  it('should keep exactly the same deep keys as zh-CN', () => {
+    const baseKeys = collectLeafKeys(zhCN).sort();
 
-  return {
-    message: () => `expected ${expected} to match structure ${actual}`,
-    pass,
-  };
-}
+    langs.forEach(({ fileName, lang }) => {
+      expect(
+        collectLeafKeys(lang).sort(),
+        `${fileName} is missing or has extra i18n keys`
+      ).toEqual(baseKeys);
+    });
+  });
 
-expect.extend({
-  toMatchStructure,
+  it('should keep locale id consistent with file name', () => {
+    langs.forEach(({ fileName, lang }) => {
+      expect(lang.locale).toBe(toExpectedLocale(fileName));
+    });
+  });
+
+  it('should not have duplicated locale id', () => {
+    const localeIds = langs.map(({ lang }) => lang.locale);
+    expect(new Set(localeIds).size).toBe(localeIds.length);
+  });
 });
 
-describe('Locale', () => {
-  test('should have same object', async () => {
-    const languages = glob.sync('*.ts', {
-      cwd: path.resolve(__dirname, '../lang'),
-      ignore: 'zh-cn.ts',
-    });
+describe('locale runtime', () => {
+  beforeEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it.each(langCases)('%s', async (fileName, lang) => {
+    vi.resetModules();
+    const { addI18nMessages, useLocale, useI18n } = await import('../index');
+
+    addI18nMessages({ [lang.locale]: lang }, { overwrite: true });
+    useLocale(lang.locale);
+
+    let t!: (key: string, ...args: any[]) => string;
+    const wrapper = mount(
+      defineComponent({
+        setup: () => {
+          t = useI18n().t;
+          return () => null;
+        },
+      })
+    );
+
+    expect(t('drawer.okText'), `${fileName} drawer.okText`).toBe(
+      lang.drawer.okText
+    );
+    expect(
+      t('pagination.total', 123),
+      `${fileName} pagination.total`
+    ).toContain('123');
+    expect(t('not.exists.key')).toBe('not.exists.key');
+    expect(t('datePicker.placeholder')).toEqual(lang.datePicker.placeholder);
+
+    wrapper.unmount();
+  });
+
+  it('should warn and keep l
```

**File**: `packages/web-vue/components/locale/lang/ar-eg.ts` (modified, +48/-0)
```diff
@@ -146,6 +146,54 @@ const lang: ArcoLang = {
     collapse: 'يطوى',
     expand: 'وسعت',
   },
+  form: {
+    validateMessages: {
+      required: 'الحقل #{field} مطلوب',
+      type: {
+        string: '#{field} ليس نصًا صالحًا',
+        number: '#{field} ليس رقمًا صالحًا',
+        boolean: '#{field} ليس قيمة منطقية صالحة',
+        array: '#{field} ليس مصفوفة صالحة',
+        object: '#{field} ليس كائنًا صالحًا',
+        url: '#{field} ليس رابط URL صالحًا',
+        email: '#{field} ليس بريدًا إلكترونيًا صالحًا',
+        ip: '#{field} ليس عنوان IP صالحًا',
+      },
+      number: {
+        min: '`#{value}` أصغر من الحد الأدنى `#{min}`',
+        max: '`#{value}` أكبر من الحد الأقصى `#{max}`',
+        equal: '`#{value}` لا يساوي `#{equal}`',
+        range: '`#{value}` ليس ضمن النطاق `#{min} ~ #{max}`',
+        positive: '`#{value}` ليس رقمًا موجبًا',
+        negative: '`#{value}` ليس رقمًا سالبًا',
+      },
+      array: {
+        length: 'عدد عناصر `#{field}` لا يساوي #{length}',
+        minLength: 'عدد عناصر `#{field}` يجب ألا يقل عن #{minLength}',
+        maxLength: 'عدد عناصر `#{field}` يجب ألا يزيد عن #{maxLength}',
+        includes: '#{field} لا يحتوي على #{includes}',
+        deepEqual: '#{field} لا يساوي #{deepEqual}',
+        empty: '`#{field}` ليست مصفوفة فارغة',
+      },
+      string: {
+        minLength: 'عدد الأحرف يجب ألا يقل عن #{minLength}',
+        maxLength: 'عدد الأحرف يجب ألا يزيد عن #{maxLength}',
+        length: 'عدد الأحرف يجب أن يساوي #{length}',
+        match: '`#{value}` لا يطابق النمط #{pattern}',
+        uppercase: '`#{value}` يجب أن يكون بأحرف كبيرة فقط',
+        lowercase: '`#{value}` يجب أن يكون بأحرف صغيرة فقط',
+      },
+      object: {
+        deepEqual: '`#{field}` لا يساوي القيمة المتوقعة',
+        hasKeys: '`#{field}` لا يحتوي على الحقول المطلوبة',
+        empty: '`#{field}` ليس كائنًا',
+      },
+      boolean: {
+        true: 'القيمة المتوقعة هي `true`',
+        false: 'القيمة المتوقعة هي `false`',
+      },
+    },
+  },
   colorPicker: {
     history: 'ألوان تاريخية',
     preset: 'ألوان النظام المضبوطة مسبقاً',
```

**File**: `packages/web-vue/components/locale/lang/de-de.ts` (modified, +49/-0)
```diff
@@ -147,6 +147,55 @@ const lang: ArcoLang = {
     collapse: 'Falten',
     expand: 'Erweitern',
   },
+  form: {
+    validateMessages: {
+      required: '#{field} ist ein Pflichtfeld',
+      type: {
+        string: '#{field} ist kein gültiger Text',
+        number: '#{field} ist keine gültige Zahl',
+        boolean: '#{field} ist kein gültiger boolescher Wert',
+        array: '#{field} ist kein gültiges Array',
+        object: '#{field} ist kein gültiges Objekt',
+        url: '#{field} ist keine gültige URL',
+        email: '#{field} ist keine gültige E-Mail-Adresse',
+        ip: '#{field} ist keine gültige IP-Adresse',
+      },
+      number: {
+        min: '`#{value}` ist kleiner als der Mindestwert `#{min}`',
+        max: '`#{value}` ist größer als der Höchstwert `#{max}`',
+        equal: '`#{value}` ist nicht gleich `#{equal}`',
+        range: '`#{value}` liegt nicht im Bereich `#{min} ~ #{max}`',
+        positive: '`#{value}` ist keine positive Zahl',
+        negative: '`#{value}` ist keine negative Zahl',
+      },
+      array: {
+        length: 'Die Anzahl von `#{field}` ist nicht gleich #{length}',
+        minLength:
+          'Die Anzahl von `#{field}` muss mindestens #{minLength} sein',
+        maxLength: 'Die Anzahl von `#{field}` darf höchstens #{maxLength} sein',
+        includes: '#{field} enthält #{includes} nicht',
+        deepEqual: '#{field} ist nicht gleich #{deepEqual}',
+        empty: '`#{field}` ist kein leeres Array',
+      },
+      string: {
+        minLength: 'Die Zeichenanzahl muss mindestens #{minLength} sein',
+        maxLength: 'Die Zeichenanzahl darf höchstens #{maxLength} sein',
+        length: 'Die Zeichenanzahl muss #{length} sein',
+        match: '`#{value}` entspricht nicht dem Muster #{pattern}',
+        uppercase: '`#{value}` muss vollständig in Großbuchstaben sein',
+        lowercase: '`#{value}` muss vollständig in Kleinbuchstaben sein',
+      },
+      object: {
+        deepEqual: '`#{field}` entspricht nicht dem erwarteten Wert',
+        hasKeys: '`#{field}` enthält nicht die erforderlichen Felder',
+        empty: '`#{field}` ist kein Objekt',
+      },
+      boolean: {
+        true: 'Der erwartete Wert ist `true`',
+        false: 'Der erwartete Wert ist `false`',
+      },
+    },
+  },
   colorPicker: {
     history: 'Historische Farben',
     preset: 'Standardfarbe des Systems',
```

**File**: `packages/web-vue/components/locale/lang/es-es.ts` (modified, +50/-0)
```diff
@@ -146,6 +146,56 @@ const lang: ArcoLang = {
     expand: 'Expandir',
     collapse: 'Pliegue',
   },
+  form: {
+    validateMessages: {
+      required: 'El campo #{field} es obligatorio',
+      type: {
+        string: '#{field} no es un texto válido',
+        number: '#{field} no es un número válido',
+        boolean: '#{field} no es un valor booleano válido',
+        array: '#{field} no es un arreglo válido',
+        object: '#{field} no es un objeto válido',
+        url: '#{field} no es una URL válida',
+        email: '#{field} no es un correo electrónico válido',
+        ip: '#{field} no es una dirección IP válida',
+      },
+      number: {
+        min: '`#{value}` es menor que el valor mínimo `#{min}`',
+        max: '`#{value}` es mayor que el valor máximo `#{max}`',
+        equal: '`#{value}` no es igual a `#{equal}`',
+        range: '`#{value}` no está dentro del rango `#{min} ~ #{max}`',
+        positive: '`#{value}` no es un número positivo',
+        negative: '`#{value}` no es un número negativo',
+      },
+      array: {
+        length: 'La cantidad de `#{field}` no es igual a #{length}',
+        minLength: 'La cantidad de `#{field}` debe ser al menos #{minLength}',
+        maxLength:
+          'La cantidad de `#{field}` debe ser como máximo #{maxLength}',
+        includes: '#{field} no incluye #{includes}',
+        deepEqual: '#{field} no es igual a #{deepEqual}',
+        empty: '`#{field}` no es un arreglo vacío',
+      },
+      string: {
+        minLength: 'La cantidad de caracteres debe ser al menos #{minLength}',
+        maxLength:
+          'La cantidad de caracteres debe ser como máximo #{maxLength}',
+        length: 'La cantidad de caracteres debe ser #{length}',
+        match: '`#{value}` no coincide con el patrón #{pattern}',
+        uppercase: '`#{value}` debe estar completamente en mayúsculas',
+        lowercase: '`#{value}` debe estar completamente en minúsculas',
+      },
+      object: {
+        deepEqual: '`#{field}` no es igual al valor esperado',
+        hasKeys: '`#{field}` no incluye los campos obligatorios',
+        empty: '`#{field}` no es un objeto',
+      },
+      boolean: {
+        true: 'El valor esperado es `true`',
+        false: 'El valor esperado es `false`',
+      },
+    },
+  },
   colorPicker: {
     history: 'Colores históricos',
     preset: 'Colores predefinidos del sistema',
```

**File**: `packages/web-vue/components/locale/lang/fr-fr.ts` (modified, +48/-0)
```diff
@@ -148,6 +148,54 @@ const lang: ArcoLang = {
     collapse: 'Plier',
     expand: 'Étendre',
   },
+  form: {
+    validateMessages: {
+      required: '#{field} est obligatoire',
+      type: {
+        string: "#{field} n'est pas un texte valide",
+        number: "#{field} n'est pas un nombre valide",
+        boolean: "#{field} n'est pas une valeur booléenne valide",
+        array: "#{field} n'est pas un tableau valide",
+        object: "#{field} n'est pas un objet valide",
+        url: "#{field} n'est pas une URL valide",
+        email: "#{field} n'est pas une adresse e-mail valide",
+        ip: "#{field} n'est pas une adresse IP valide",
+      },
+      number: {
+        min: '`#{value}` est inférieur à la valeur minimale `#{min}`',
+        max: '`#{value}` est supérieur à la valeur maximale `#{max}`',
+        equal: "`#{value}` n'est pas égal à `#{equal}`",
+        range: "`#{value}` n'est pas dans la plage `#{min} ~ #{max}`",
+        positive: "`#{value}` n'est pas un nombre positif",
+        negative: "`#{value}` n'est pas un nombre négatif",
+      },
+      array: {
+        length: "Le nombre de `#{field}` n'est pas égal à #{length}",
+        minLength: 'Le nombre de `#{field}` doit être au moins #{minLength}',
+        maxLength: 'Le nombre de `#{field}` doit être au plus #{maxLength}',
+        includes: '#{field} ne contient pas #{includes}',
+        deepEqual: "#{field} n'est pas égal à #{deepEqual}",
+        empty: "`#{field}` n'est pas un tableau vide",
+      },
+      string: {
+        minLength: 'Le nombre de caractères doit être au moins #{minLength}',
+        maxLength: 'Le nombre de caractères doit être au plus #{maxLength}',
+        length: 'Le nombre de caractères doit être #{length}',
+        match: '`#{value}` ne correspond pas au motif #{pattern}',
+        uppercase: '`#{value}` doit être entièrement en majuscules',
+        lowercase: '`#{value}` doit être entièrement en minuscules',
+      },
+      object: {
+        deepEqual: "`#{field}` n'est pas égal à la valeur attendue",
+        hasKeys: '`#{field}` ne contient pas les champs requis',
+        empty: "`#{field}` n'est pas un objet",
+      },
+      boolean: {
+        true: 'La valeur attendue est `true`',
+        false: 'La valeur attendue est `false`',
+      },
+    },
+  },
   colorPicker: {
     history: 'Couleurs historiques',
     preset: 'Couleurs prédéfinies par le système',
```

---

### Incident Patch 6: `b17b75c1` (2026-04-30)
**Commit Message**: fix(scripts): 修复 dev-component 构建 watcher 报错 (#3654)

**File**: `packages/arco-vue-scripts/src/scripts/dev-component/index.ts` (modified, +6/-2)
```diff
@@ -1,13 +1,17 @@
 import ora from 'ora';
 import chalk from 'chalk';
 import { build, InlineConfig } from 'vite';
-import { RollupWatcher } from 'rollup';
 import config from '../../configs/vite.dev';
 
 const run = async () => {
   const spinner = ora();
   spinner.start(chalk.cyan('启动组件开发环境...\n'));
-  const watcher = (await build(config as InlineConfig)) as RollupWatcher;
+
+  const watcher = await build(config as InlineConfig);
+
+  if (Array.isArray(watcher) || !('on' in watcher)) {
+    throw new Error('当前构建结果不是 watcher，请检查 build.watch 配置');
+  }
 
   watcher.on('event', async (event) => {
     if (event.code === 'START' || event.code === 'END') {
```

---

### Incident Patch 7: `e7c9aa92` (2026-04-30)
**Commit Message**: fix(mention): 清除输入后关闭弹出层并重置测量信息 (#3653)

修复 Mention 组件在点击清除按钮后，弹出层未关闭且测量信息未重置的问题。
在 .gitattributes 中添加 *.snap 文件的行尾处理，并将 .prettierrc.js 中的 endOfLine 统一设置为 'lf'。

**File**: `.gitattributes` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@
 *.md              text eol=lf
 *.vue             text eol=lf
 *.tsx             text eol=lf
+*.snap            text eol=lf
 
 # Scripts
 *.bash            text eol=lf
```

**File**: `.prettierrc.js` (modified, +1/-1)
```diff
@@ -4,6 +4,6 @@ module.exports = {
   printWidth: 80,
   singleQuote: true,
   quoteProps: 'consistent',
-  endOfLine: 'auto',
+  endOfLine: 'lf',
   htmlWhitespaceSensitivity: 'strict',
 };
```

**File**: `packages/web-vue/components/mention/__test__/index.test.ts` (modified, +25/-0)
```diff
@@ -1,4 +1,5 @@
 import { mount } from '@vue/test-utils';
+import { nextTick } from 'vue';
 import Mention from '../index';
 
 describe('Mention', () => {
@@ -38,4 +39,28 @@ describe('Mention', () => {
     await input.trigger('keydown', { key: 'Enter' });
     expect(wrapper.emitted('change')?.[1]).toEqual(['@Bytedance']);
   });
+
+  test('should close popup after clear', async () => {
+    const wrapper = mount(Mention, {
+      props: {
+        data: ['Bytedance', 'Bytedesign', 'Bytenumner'],
+        allowClear: true,
+      },
+      attachTo: document.body,
+    });
+    const input = wrapper.find('input');
+    await input.trigger('focusin');
+    await input.setValue('@');
+    await nextTick();
+
+    const triggerVm = wrapper.findComponent({ name: 'Trigger' }).vm as any;
+    expect(triggerVm.$props.popupVisible).toBe(true);
+
+    const clearBtn = wrapper.find('.arco-input-clear-btn');
+    await clearBtn.trigger('mousedown');
+    await clearBtn.trigger('click');
+    await nextTick();
+
+    expect(triggerVm.$props.popupVisible).toBe(false);
+  });
 });
```

**File**: `packages/web-vue/components/mention/mention.tsx` (modified, +2/-0)
```diff
@@ -228,6 +228,8 @@ export default defineComponent({
 
     const handleClear = (ev: Event) => {
       _value.value = '';
+      resetMeasureInfo();
+      _popupVisible.value = false;
       emit('update:modelValue', '');
       emit('change', '');
       eventHandlers.value?.onChange?.();
```

---

### Incident Patch 8: `cd32f6de` (2026-04-28)
**Commit Message**: docs(anchor): 修正 affix 属性的默认值为 false

将 Anchor 组件中 affix 属性的默认值从 true 更正为 false，以反映组件的实际默认行为，并同步更新中英文文档。

**File**: `packages/web-vue/components/anchor/README.en-US.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ description: Through the anchor point, you can quickly find the position of the
 |---|---|---|:---:|
 |boundary|Scrolling boundary value. After setting the value to a number, it will stop scrolling when the distance is `boundary` from the scrolling container.|`'start' \| 'end' \| 'center' \| 'nearest' \| number`|`'start'`|
 |line-less|Whether to show the left axis|`boolean`|`false`|
-|affix|Whether to wrap anchor within Affix|`boolean`|`true`|
+|affix|Whether to wrap anchor within Affix|`boolean`|`false`|
 |affix-style|The style to be applied to Affix|`CSSProperties`|`-`|
 |offset-top|Offset from the top of the viewport|`number`|`0`|
 |offset-bottom|Offset from the bottom of the viewport|`number`|`-`|
```

**File**: `packages/web-vue/components/anchor/README.zh-CN.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ description: 通过锚点可以快速找到信息内容在当前页面的位置
 |---|---|---|:---:|
 |boundary|滚动边界值，设置该值为数字后，将会在距离滚动容器 `boundary` 距离时停止滚动。|`'start' \| 'end' \| 'center' \| 'nearest' \| number`|`'start'`|
 |line-less|是否显示左侧轴线|`boolean`|`false`|
-|affix|是否固定|`boolean`|`true`|
+|affix|是否固定|`boolean`|`false`|
 |affix-style|设置 Affix 组件的样式|`CSSProperties`|`-`|
 |offset-top|距离窗口顶部的偏移量|`number`|`0`|
 |offset-bottom|距离窗口底部的偏移量|`number`|`-`|
```

---

### Incident Patch 9: `1b444cb3` (2026-04-28)
**Commit Message**: fix(anchor): 将 affix 属性的默认值改为 false

避免默认行为造成意外的固定定位，让组件行为更符合用户预期

**File**: `packages/web-vue/components/anchor/__test__/__snapshots__/demo.test.ts.snap` (modified, +103/-118)
```diff
@@ -1,119 +1,107 @@
 // Jest Snapshot v1, https://goo.gl/fbAQLP
 
 exports[`<anchor> demo: render [affix] correctly 1`] = `
-"<div style=\\"position: absolute; right: -170px; top: 50%; z-index: 1;\\">
-  <!--v-if-->
-  <div class=\\"\\">
-    <div class=\\"arco-anchor\\">
-      <div class=\\"arco-anchor-line-slider\\"></div>
-      <ul class=\\"arco-anchor-list\\">
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#basic\\">Basic</a>
-          <!--v-if-->
-        </li>
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#static\\">Static</a>
-          <!--v-if-->
-        </li>
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#line-less\\">LineLess Mode</a>
-          <!--v-if-->
-        </li>
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#affix\\">Affix</a>
-          <!--v-if-->
-        </li>
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#boundary\\">Scroll Boundary</a>
-          <!--v-if-->
-        </li>
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#hash\\">Hash mode</a>
-          <!--v-if-->
-        </li>
-      </ul>
-    </div>
+"<div>
+  <div class=\\"arco-anchor\\">
+    <div class=\\"arco-anchor-line-slider\\"></div>
+    <ul class=\\"arco-anchor-list\\">
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#basic\\">Basic</a>
+        <!--v-if-->
+      </li>
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#static\\">Static</a>
+        <!--v-if-->
+      </li>
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#line-less\\">LineLess Mode</a>
+        <!--v-if-->
+      </li>
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#affix\\">Affix</a>
+        <!--v-if-->
+      </li>
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#boundary\\">Scroll Boundary</a>
+        <!--v-if-->
+      </li>
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#hash\\">Hash mode</a>
+        <!--v-if-->
+      </li>
+    </ul>
   </div>
 </div>"
 `;
 
 exports[`<anchor> demo: render [basic] correctly 1`] = `
 "<div>
-  <!--v-if-->
-  <div class=\\"\\">
-    <div class=\\"arco-anchor\\">
-      <div class=\\"arco-anchor-line-slider\\"></div>
-      <ul class=\\"arco-anchor-list\\">
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#basic\\">Basic</a>
-          <!--v-if-->
-        </li>
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#line-less\\">LineLess Mode</a>
-          <!--v-if-->
-        </li>
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#affix\\"> Affix </a>
-          <ul class=\\"arco-anchor-sublist\\">
-            <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#boundary\\">Scroll Boundary</a>
-              <!--v-if-->
-            </li>
-            <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#hash\\">Hash mode</a>
-              <!--v-if-->
-            </li>
-          </ul>
-        </li>
-      </ul>
-    </div>
+  <div class=\\"arco-anchor\\">
+    <div class=\\"arco-anchor-line-slider\\"></div>
+    <ul class=\\"arco-anchor-list\\">
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#basic\\">Basic</a>
+        <!--v-if-->
+      </li>
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#line-less\\">LineLess Mode</a>
+        <!--v-if-->
+      </li>
+      <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#affix\\"> Affix </a>
+        <ul class=\\"arco-anchor-sublist\\">
+          <li class=\\"a
```

**File**: `packages/web-vue/components/anchor/__test__/index.test.ts` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@ describe('Anchor', () => {
     );
   });
 
-  test('should wrap anchor with affix by default', () => {
+  test('should not wrap anchor with affix by default', () => {
     const wrapper = mount(Anchor, {
       props: {
         offsetTop: 80,
@@ -42,7 +42,7 @@ describe('Anchor', () => {
       },
     });
 
-    expect(wrapper.findComponent({ name: 'Affix' }).exists()).toBe(true);
+    expect(wrapper.findComponent({ name: 'Affix' }).exists()).toBe(false);
   });
 
   test('should not wrap anchor with affix when affix is false', () => {
```

**File**: `packages/web-vue/components/anchor/anchor.vue` (modified, +8/-9)
```diff
@@ -1,8 +1,5 @@
 <template>
-  <component
-    :is="wrapperComponent"
-    v-bind="wrapperProps"
-  >
+  <component :is="wrapperComponent" v-bind="wrapperProps">
     <div ref="anchorRef" :class="cls">
       <div
         v-if="!lineLess"
@@ -40,9 +37,9 @@ import { throttleByRaf } from '../_utils/throttle-by-raf';
 import Affix from '../affix';
 
 const BOUNDARY_POSITIONS = ['start', 'end', 'center', 'nearest'] as const;
-type BoundaryPosition = typeof BOUNDARY_POSITIONS[number];
+type BoundaryPosition = (typeof BOUNDARY_POSITIONS)[number];
 const DIRECTIONS = ['vertical', 'horizontal'] as const;
-type Direction = typeof DIRECTIONS[number];
+type Direction = (typeof DIRECTIONS)[number];
 
 export default defineComponent({
   name: 'Anchor',
@@ -76,7 +73,7 @@ export default defineComponent({
      */
     affix: {
       type: Boolean,
-      default: true,
+      default: false,
     },
     /**
      * @zh 设置 Affix 组件的样式
@@ -189,7 +186,8 @@ export default defineComponent({
 
     const scrollIntoView = (hash: string) => {
       try {
-        const element = getElement(hash);
+        const element =
+          getElement(hash, containerEle.value) ?? getElement(hash);
         if (!element) return;
         let block: BoundaryPosition;
         let diff = 0;
@@ -253,7 +251,8 @@ export default defineComponent({
         : containerRect.height / 2;
 
       for (const hash of Object.keys(links)) {
-        const element = getElement(hash);
+        const element =
+          getElement(hash, containerEle.value) ?? getElement(hash);
         if (element) {
           const { top } = element.getBoundingClientRect();
           const offsetTop = isWindow(scrollContainerEle.value)
```

---

### Incident Patch 10: `df047075` (2026-04-22)
**Commit Message**: fix(date-picker): 修复日期面板年份边界问题并优化日期计算

- 修复年份面板在最小年份（0年）时的显示和导航逻辑
- 统一季度和月份面板的日期计算方法，使用 methods.set 替代字符串拼接
- 优化年份面板标题显示，确保在边界情况下正确显示年份范围
- 添加导航按钮的边界检查，防止导航到小于最小年份的日期

**File**: `packages/web-vue/components/date-picker/hooks/use-header-value.ts` (modified, +33/-16)
```diff
@@ -34,6 +34,7 @@ export default function useHeaderValue(props: HeaderValueProps): {
   } = toRefs(props);
 
   const computedMode = computed(() => mode?.value || 'date');
+  const MIN_YEAR = 0;
 
   const { span, superSpan } = usePanelSpan(
     reactive({
@@ -109,24 +110,40 @@ export default function useHeaderValue(props: HeaderValueProps): {
 
   const showSingleBtn = computed(() => span.value !== superSpan.value);
 
-  const headerOperations = computed(() => ({
-    onSuperPrev: () => {
-      setHeaderValue(methods.subtract(headerValue.value, superSpan.value, 'M'));
-    },
-    onPrev: showSingleBtn.value
-      ? () => {
-          setHeaderValue(methods.subtract(headerValue.value, span.value, 'M'));
-        }
-      : undefined,
-    onNext: showSingleBtn.value
+  const canMovePrev = (months: number) =>
+    methods.subtract(headerValue.value, months, 'M').year() >= MIN_YEAR;
+
+  const headerOperations = computed(() => {
+    const onSuperPrev = canMovePrev(superSpan.value)
       ? () => {
-          setHeaderValue(methods.add(headerValue.value, span.value, 'M'));
+          setHeaderValue(
+            methods.subtract(headerValue.value, superSpan.value, 'M')
+          );
         }
-      : undefined,
-    onSuperNext: () => {
-      setHeaderValue(methods.add(headerValue.value, superSpan.value, 'M'));
-    },
-  }));
+      : undefined;
+
+    const onPrev =
+      showSingleBtn.value && canMovePrev(span.value)
+        ? () => {
+            setHeaderValue(
+              methods.subtract(headerValue.value, span.value, 'M')
+            );
+          }
+        : undefined;
+
+    return {
+      onSuperPrev,
+      onPrev,
+      onNext: showSingleBtn.value
+        ? () => {
+            setHeaderValue(methods.add(headerValue.value, span.value, 'M'));
+          }
+        : undefined,
+      onSuperNext: () => {
+        setHeaderValue(methods.add(headerValue.value, superSpan.value, 'M'));
+      },
+    };
+  });
 
   return {
     headerValue,
```

**File**: `packages/web-vue/components/date-picker/panels/month/index.vue` (modified, +3/-3)
```diff
@@ -33,7 +33,7 @@ import { computed, defineComponent, PropType, toRefs } from 'vue';
 import { Dayjs } from 'dayjs';
 import { RenderFunc } from '../../../_components/render-function';
 import { getPrefixCls } from '../../../_utils/global-config';
-import { dayjs } from '../../../_utils/date';
+import { methods } from '../../../_utils/date';
 import type {
   Cell,
   DisabledDate,
@@ -114,11 +114,11 @@ export default defineComponent({
     const headerTitle = computed(() => headerValue.value.format('YYYY'));
 
     const rows = computed(() => {
-      const year = headerValue.value.year();
       const isAbbr = props.abbreviation ? 'short' : 'long';
+      const baseValue = headerValue.value.set('date', 1);
       const flatData = newArray<Cell>(CELL_COUNT).map((_, index) => ({
         label: datePickerT(`datePicker.month.${isAbbr}.${MONTH_LIST[index]}`),
-        value: dayjs(`${year}-${index + 1}`, 'YYYY-M'),
+        value: methods.set(baseValue, 'month', index),
       }));
       const rows = newArray(ROW_COUNT).map((_, index) =>
         flatData.slice(index * COL_COUNT, (index + 1) * COL_COUNT)
```

**File**: `packages/web-vue/components/date-picker/panels/quarter/index.vue` (modified, +3/-4)
```diff
@@ -31,9 +31,8 @@
 <script lang="ts">
 import { computed, defineComponent, PropType, toRefs } from 'vue';
 import { Dayjs } from 'dayjs';
-import { padStart } from '../../../_utils/pad';
 import { getPrefixCls } from '../../../_utils/global-config';
-import { dayjs } from '../../../_utils/date';
+import { methods } from '../../../_utils/date';
 import type {
   Cell,
   DisabledDate,
@@ -89,11 +88,11 @@ export default defineComponent({
     const headerTitle = computed(() => headerValue.value.format('YYYY'));
 
     const rows = computed<Cell[][]>(() => {
-      const year = headerValue.value.year();
+      const baseValue = headerValue.value.set('date', 1);
       return [
         [1, 2, 3, 4].map((q) => ({
           label: `Q${q}`,
-          value: dayjs(`${year}-${padStart((q - 1) * 3 + 1, 2, '0')}-01`),
+          value: methods.set(baseValue, 'month', (q - 1) * 3),
         })),
       ];
     });
```

**File**: `packages/web-vue/components/date-picker/panels/year/index.vue` (modified, +20/-14)
```diff
@@ -29,7 +29,7 @@
 import { computed, defineComponent, PropType, toRefs } from 'vue';
 import { Dayjs } from 'dayjs';
 import { getPrefixCls } from '../../../_utils/global-config';
-import { dayjs } from '../../../_utils/date';
+import { methods } from '../../../_utils/date';
 import type {
   Cell,
   DisabledDate,
@@ -46,6 +46,7 @@ const ROW_COUNT = 4;
 const COL_COUNT = 3;
 const CELL_COUNT = ROW_COUNT * COL_COUNT;
 const SPAN = 10;
+const MIN_YEAR = 0;
 
 export default defineComponent({
   name: 'YearPanel',
@@ -86,14 +87,20 @@ export default defineComponent({
     const pickerPrefixCls = getPrefixCls('picker');
 
     const rows = computed(() => {
-      const startYear = Math.floor(headerValue.value.year() / SPAN) * SPAN - 1;
+      const currentYear = Math.max(headerValue.value.year(), MIN_YEAR);
+      const baseYear = Math.floor(currentYear / SPAN) * SPAN;
+      const startYear = Math.max(baseYear - 1, MIN_YEAR);
+      const baseValue = headerValue.value.set('month', 0).set('date', 1);
 
-      const flatData = newArray<Cell>(CELL_COUNT).map((_, index) => ({
-        label: startYear + index,
-        value: dayjs(`${startYear + index}`, 'YYYY'),
-        isPrev: index < 1,
-        isNext: index > SPAN,
-      }));
+      const flatData = newArray<Cell>(CELL_COUNT).map((_, index) => {
+        const year = startYear + index;
+        return {
+          label: year,
+          value: methods.set(baseValue, 'year', year),
+          isPrev: year < baseYear,
+          isNext: year > baseYear + SPAN - 1,
+        };
+      });
 
       const rows = newArray(ROW_COUNT).map((_, index) =>
         flatData.slice(index * COL_COUNT, (index + 1) * COL_COUNT)
@@ -102,12 +109,11 @@ export default defineComponent({
       return rows;
     });
 
-    const headerTitle = computed(
-      () =>
-        `${rows.value[0][1].label}-${
-          rows.value[ROW_COUNT - 1][COL_COUNT - 1].label
-        }`
-    );
+    const headerTitle = computed(() => {
+      const currentYear = Math.max(headerValue.value.year(), MIN_YEAR);
+      const baseYear = Math.floor(currentYear / SPAN) * SPAN;
+      return `${baseYear}-${baseYear + SPAN - 1}`;
+    });
 
     const isSameTime: IsSameTime = (current, target) =>
       current.isSame(target, 'year');
```

#### Recent Merged Pull Requests:
- **PR #3670** (closed): docs(navbar): restore Design/Dev/Ecosystem links for GitHub Pages (@xbmlz)
- **PR #3665** (2026-06-24): fix(image): ensure left mouse button is used for dragging (@betavs)
- **PR #3664** (closed): Merge Upstream (@liunnn1994)
- **PR #3663** (2026-06-24): fix: 修复trigger组件props和interface定义不一致的问题 (@musishui)
- **PR #3659** (2026-05-18): fix(textarea): update value before input event (@hunterMG)
- **PR #3658** (2026-05-08): fix(verification-code): 修复验证码输入框光标定位与聚焦行为 (@oljc)
- **PR #3656** (2026-05-07): fix(locale): 修复部分国际化语言检验信息字段缺失问题 (@oljc)
- **PR #3655** (2026-05-06): docs: 文档 Demo 示例统一迁移为 setup 语法风格 (@oljc)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
