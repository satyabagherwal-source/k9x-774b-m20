# Forensic Learning Record (Deep Inspection): DouyinFE/semi-design

> **Canonical Artifact**: `07_PROJECT_LEARNING/douyinfe-semi-design-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DouyinFE/semi-design](https://github.com/DouyinFE/semi-design))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:41:01.653Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DouyinFE/semi-design`
- **Description**: 🚀A modern, comprehensive, flexible design system and React UI library, AI-friendly built-in.🎨Provide 3000+ Design Tokens, easy to build your design system. Make Semi Design to Any Design.🧑🏻‍💻 Design to Code in one click
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10398 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.codesandbox/examples/pr-story/src/App.jsx`
```
import React from "react";

import { Button, Empty } from "@douyinfe/semi-ui";
import { IconDoubleChevronLeft, IconDoubleChevronRight  } from "@douyinfe/semi-icons";
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from "@douyinfe/semi-illustrations";

import "./App.css";

/**
 * Write a demo based on this PR
 */
export default function App() {
  return (
    <div className="app">
      {/* ------- your code start ------- DON'T DELETE THIS LINE -------  */}
        <IconDoubleChevronLeft />
        <IconDoubleChevronRight />
      {/* ------- your code end ------- DON'T DELETE THIS LINE ------- */}
    </div>
  );
}

```

### Core Architecture Module: `.codesandbox/examples/pr-story/src/index.js`
```
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

```

### Core Architecture Module: `.commitlintrc.js`
```
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'subject-case': [0, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
        'header-max-length': [0, 'always', 120],
    },
};

```

### Core Architecture Module: `.eslintrc.js`
```
/* eslint-disable */
module.exports = {
    env: {
        'browser': true,
        'node': true
    },
    settings: {
        react: {
            "version": "detect"
        }
    },
    extends: ["plugin:markdown/recommended"],
    overrides: [
        {
            files: ['**/__test__/**/*.{js,jsx,ts,tsx}', '**/_story/**/*.{js,jsx,ts,tsx}'],
            globals: {
                afterAll: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                beforeEach: 'readonly',
                describe: 'readonly',
                expect: 'readonly',
                it: 'readonly',
                mount: 'readonly',
                React: 'readonly',
                render: 'readonly',
                rs: 'readonly',
                rstest: 'readonly',
                shallow: 'readonly',
                sinon: 'readonly',
                test: 'readonly',
                testRender: 'readonly',
            },
        },
        {
            files: ['*.js', '*.jsx'],
            extends: ['plugin:react/recommended', 'plugin:import/recommended', 'plugin:import/errors', 'plugin:import/warnings', 'plugin:jsx-a11y/recommended'],
            parser: '@babel/eslint-parser',
            plugins: ['react', 'react-hooks', 'import'],
            rules: {
                // 因为历史原因，现有项目基本全部是4个空格
                indent: ['error', 4, {'SwitchCase': 1}],
                'comma-spacing': ["error", {"before": false, "after": true}],
                'no-multi-spaces': ["error", {ignoreEOLComments: true}],
                'no-unused-vars': 'off', // We need to consider many scenarios of deconstruction and rest, this rule is not reasonable in component library scenarios, so turn it off globally
                'react/display-name': 'off',
                'key-spacing': ["error", {"beforeColon": false}],
                'react/jsx-indent': ['error', 4],
                'react/jsx-indent-props': ['error', 4],
                'react/no-find-dom-node': 'off',
                'react/prop-types': 'off',
                'react/prefer-stateless-function': 'off',
                'jsx-a11y/alt-text': ["warn"],
                'operator-linebreak': ['warn', 'after', {'overrides': {'?': 'before', ':': 'before'}}],
                'import/no-unresolved': 'off',
                'semi': ['error', 'always'],
                'keyword-spacing': ["error", {"before": true, "after": true}],
                'jsx-a11y/click-events-have-key-events': ['warn'],
                'jsx-a11y/no-noninteractive-element-interactions': ['warn'],
                'jsx-a11y/no-autofocus': ['warn'],
                'jsx-a11y/no-static-element-interactions': ['warn'],
                'jsx-a11y/html-has-lang': ['warn'],
                'jsx-a11y/mouse-events-have-key-events': ['warn'],
                'object-curly-spacing': ['error', 'always'],
                'space-before-blocks': ['error', 'always'],
                "space-infix-ops": "error",
                'max-len': 'off',
                'react/forbid-foreign-prop-types': ['error', { "allowInPropTypes": true }]
            },
            globals: {
                "sinon": "readonly",
            },
        },
        {
            files: ['*.ts', '*.tsx'],
            excludedFiles: ['content/**'],
            extends: ['plugin:@typescript-eslint/recommended', 'plugin:import/typescript', 'plugin:react/recommended', 'plugin:jsx-a11y/recommended'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: ['./tsconfig.eslint.json'],
            },
            plugins: ['react', 'react-hooks', 'import', '@typescript-eslint', 'semi-design'],
            rules: {
                // 因为历史原因，现有项目基本全部是4个空格
                "arrow-spacing": ["error", { "before": true, "after": true }],
                indent: 'off',
                'comma-spacing': ["error", {"before": false, "after": true}],
                'no-multi-spaces': ["error", {ignoreEOLComments: true}],
                'no-unused-vars': 'off', // We need to consider many scenarios of deconstruction and rest, this rule is not reasonable in component library scenarios, so turn it off globally
                'key-spacing': ["error", {"beforeColon": false, "afterColon": true}],
                '@typescript-eslint/indent': ['error', 4, {
                    SwitchCase: 1,
                    ignoredNodes: [
                        'JSXElement',
                        'JSXElement > *',
                        'JSXAttribute',
                        'JSXIdentifier',
                        'JSXNamespacedName',
                        'JSXMemberExpression',
                        'JSXSpreadAttribute',
                        'JSXExpressionContainer',
                        'JSXOpeningElement',
                        'JSXClosingElement',
                        'JSXFragment',
                        'JSXOpeningFragment',
                        'JSXClosingFragment',
                        'JSXText',
                        'JSXEmptyExpression',
                        'JSXSpreadChild',
                    ],
                }],
                'react/display-name': 'off',
                'react/jsx-indent': ['error', 4],
                'react/jsx-indent-props': ['error', 4],
                'react/no-find-dom-node': 'off',
                'react/prop-types': 'off',
                "react/no-unknown-property": ['error', { 
                    ignore: [
                        'x-semi-prop',
                        'x-placement',
                        'x-type',
                        'x-label-pos',
                        'x-prompt-pos',
                        'x-field-id',
                        'x-extra-pos',
                        'x-open-type',
                        'x-panel-yearandmonth-open-type',
                        'x-insetinput',
                        'x-preset-position',
                        'x-form-id'
                    ]}],
                'react-hooks/rules-of-hooks': 'error',
                'react-hooks/exhaustive-deps': 'warn',
                'react/prefer-stateless-function': 'off',
                '@typescript-eslint/explicit-module-boundary-types': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/no-empty-interface': 'off',
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/naming-convention': 'off',
                '@typescript-eslint/ban-ts-comment': 'off',
                '@typescript-eslint/no-var-requires': 'warn',
                '@typescript-eslint/no-inferrable-types': 'off',
                '@typescript-eslint/no-this-alias': 'off',
                '@typescript-eslint/no-empty-function': 'off',
                // In scenarios where specific rest props need to be passed, some keys may be taken out first, so set 'no-unused-vars' to off
                '@typescript-eslint/no-unused-vars': 'off',
                'import/no-unresolved': 'off',
                'max-len': 'off',
                'semi': ['error', 'always'],
                'keyword-spacing': ["error", {"before": true, "after": true}],
                'jsx-a11y/click-events-have-key-events': ['warn'],
                'jsx-a11y/no-noninteractive-element-interactions': ['warn'],
                'jsx-a11y/no-autofocus': ['warn'],
                'jsx-a11y/no-static-element-interactions': ['warn'],
                'jsx-a11y/alt-text': ["warn"],
                'jsx-a11y/mouse-events-have-key-events': ["warn"],
                'jsx-a11y/html-has-lang': ['warn'],
                'object-curly-spacing': ['error', 'always'],
                'prefer-const': 'off',
                'semi-design/no-import': 'error',
                "space-infix-ops": ["error", { "int32Hint": false }],
                'space-before-blocks': ['error', 'always'],
                "space-infix-ops": "error",
                '@t
```

### Core Architecture Module: `.lighthouserc.js`
```

/**
 * lighthouse config
 * https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */
 module.exports = {
    ci: {
      collect: {
          staticDistDir: './storybook-static',
          url: ['http://localhost/iframe.html?id=base--semi-a-11-y&args=&viewMode=story'],
          isSinglePageApplication: true,
      },
      upload: {
        target: "temporary-public-storage",
      },
    },
  };
  
```

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
    proseWrap: 'never',
    printWidth: 120,
    tabWidth: 4,
    trailingComma: 'es5',
    bracketSpacing: true,
    singleQuote: true,
    useTabs: false,
    semi: true,
};

```

### Core Architecture Module: `.storybook/animation/react/main.js`
```
const config = require('../../base/base');

module.exports = {
  ...config,
  "stories": [
    '../../../packages/(semi-animation-react|semi-animation-styled)/_story/*.react.stories.(js|jsx)',
  ],
  typescript: {
    check: false,
    checkOptions: {}
  },
};

```

### Core Architecture Module: `.storybook/base/base.js`
```

const path = require('path');
const _ = require('lodash');
const chalk = require('chalk').default;
const utils = require('./utils');
const fs = require('fs');
let AnalyzePlugin = null
if(process.env.__ENABLE_ANALYZE__ === 'true') {
    AnalyzePlugin = require("@ies/semi-page-analyze-inject/src/AnalyzePlugin")
}

function resolve(...dirs) {
    return path.join(__dirname, '../..', ...dirs);
}

/**
 * 当我们想获取 Cypress 代码覆盖率时，需要将 TEST_ENV 设置为 true。
 * 
 * 这时会打开 babel-loader 配置，去掉 esbuild 配置，并在 babel plugin 中注入 babel-plugin-istanbul
 * 
 * @see https://github.com/istanbuljs/babel-plugin-istanbul
 */
function getAddons() {
    let addons = [
        // for performance reason, only open `@storybook/addon-a11y` when dev a11y
        // '@storybook/addon-a11y',
        '@storybook/addon-toolbars',
    ];

    if (!utils.isTest()) {
        console.log(chalk.yellow(`if you want to get cypress code coverage, set TEST_ENV=test, now it is '${process.env.TEST_ENV}'`));
    }

    return addons;
}

module.exports = {
    framework: {
        name: "@storybook/react-webpack5",
        options: {
            fastRefresh: true
        },
    },
    addons: getAddons(),
    webpackFinal: async (config) => {
        const rules =
            (config.module.rules &&
                config.module.rules.filter(rule => {
                    const test = _.toString(rule && rule.test);
                    if (/\.css/i.test(test) || /\.s(c|a)ss/i.test(test)) {
                        return false;
                    }
                    return true;
                })) ||
            [];
        rules.push(
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
        );
        rules.push(
            {
                test: /\.s(a|c)ss$/,
                include: [resolve('packages/semi-ui'), resolve('packages/semi-foundation'), resolve('packages/semi-icons')],
                use: ['style-loader', 'css-loader', 'sass-loader', resolve('packages/semi-webpack/lib/semi-theme-loader.js')],
            }
        );
        AnalyzePlugin && rules.push({
            test: /\.tsx?$/,
            include: [resolve('packages/semi-ui'), resolve('packages/semi-foundation')],
            exclude:/node_modules/,
            use: [
                {
                    loader: "babel-loader",
                    options: {
                        plugins: [AnalyzePlugin],
                    }
                },
            ]
        })
        rules.push({
            test: /jsonWorkerManager\.ts$/,
            use: [
                {
                    loader: 'webpack-replace-loader',
                    options: {
                        search: '%WORKER_RAW%',
                        replace: () => {
                            const workFilePath = resolve('packages/semi-json-viewer-core/workerLib/worker.js');
                            const result = fs.readFileSync(workFilePath, 'utf-8');
                            const encodedResult = encodeURIComponent(result);
                            return encodedResult;
                        }
                    }
                }
            ]
        });
        config.module.rules = rules;
        config.resolve.extensions.push('.js', '.jsx', '.ts', '.tsx');
        config.resolve.symlinks = false;
        config.mode = "development";
        config.resolve.alias = {
            '@douyinfe/semi-foundation': resolve('packages/semi-foundation'),
            '@douyinfe/semi-icons': resolve('packages/semi-icons/src'),
            '@douyinfe/semi-icons-lab': resolve('packages/semi-icons-lab/src'),
            '@douyinfe/semi-ui': resolve('packages/semi-ui'),
            '@douyinfe/semi-theme-default': resolve('packages/semi-theme-default'),
            '@douyinfe/semi-illustrations': resolve('packages/semi-illustrations/src'),
            '@douyinfe/semi-animation': resolve('packages/semi-animation'),
            '@douyinfe/semi-animation-react': resolve('packages/semi-animation-react'),
            '@douyinfe/semi-animation-styled': resolve('packages/semi-animation-styled'),
            '@douyinfe/semi-json-viewer-core': resolve('packages/semi-json-viewer-core/src'),
        };
        config.devtool = 'source-map';
        // config.output.publicPath = "/storybook/"

        return config;
    }
};


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3296** (2026-05-21): **[BUG][Cascader] 搜索忽略大小写，但高亮要求精确匹配，命中结果可能没有高亮**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Cascader  ### Semi Version  @douyinfe/semi-ui@2.98.0（官网最新版本可复现）  ### Current Behavior  Cascader 默认的 `filterTreeNode`（传入 `true` 走内置过滤器）实现是 **忽略大小写** 的：  ```ts // packages/semi-foundation/cascader/util.ts filterFn = (targetVal: string, val: string) => {     const input = targetVal.toLowerCase();     return val.toLowerCase().includes(input); }; ```  而下拉项的高亮渲染却是 **大小写敏感** 的：  ```tsx // packages/semi-ui/cascader/item.tsx highlight = (searchText) => {     ...     if (typeof item === 'string' && includes(item, keyword)) {         item.split(keyword).forEach(...);     }     ... }; ```  因此在选项 label 与搜索关键词大小写不一致的场景下，会出现「搜索能匹配上、但下拉中命中项里的关键词完全没有高亮」的现象。  ### Expected Behavior  搜索的匹配规则与高亮的匹配规则应保持一致：  - 当 `filterTreeNode={true}` 走内置过滤器（不区分大小写）时，高亮也应不区分大小写，按命中位置加粗显示原文。 - 当用户传入自定义 `filterTreeNode` 函数时，至少应让高亮策略对大小写不敏感的命中也能够正确加亮（或暴露相应配置/约定）。  ### Steps To Reproduce  1. 打开 [官网 Cascader「可搜索的」示例](https://semi.design/zh-CN/input/cascader#可搜索的)。 2. 在 demo 中将 treeData 修改为带有英文大写字母的数据（或直接用下方的 ReproducibleCode 在「在线编辑」里运行）。 3. 在搜索框中输入小写 `bei`。 4. 观察下拉结果：可以看到 `Beijing / Haidian` 等项被正确过滤出来，但其中的 `Bei` 没有任何高亮样式。  ### ReproducibleCode  ```jsx import React from 'react'; import { Cascader } from '@douyinfe/semi-ui';  () => {     const treeData = [         {             label: 'Beijing',             value: 'beijing',             children: [                 { label: 'Haidian', value: 'haidian' },             

- **Issue #3295** (2026-05-21): **[BUG][Cascader] 搜索选中后，选项的高亮丢失，且 separator 中的空格被吞掉**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Cascader  ### Semi Version  @douyinfe/semi-ui@2.98.0（官网最新版本可复现）  ### Current Behavior  在可搜索的 Cascader（`filterTreeNode` 开启）中：  1. 输入关键词进行搜索后，下拉中命中的选项会以「父节点 / 子节点 / 叶子节点」这种带空格的路径形式展示，且关键词文字会被加粗高亮。 2. 当点击其中一项进行选中后，再次点开下拉，会发现：    - **高亮丢失**：刚刚选中的那一项里，关键词不再被高亮（虽然搜索框里的关键词仍然存在）。    - **路径中的空格丢失**：路径分隔符 `separator` 默认为 ` / `（前后各有一个空格）。在某些渲染分支下（比如关键词刚好与 `separator` 相邻、或者 `searchText` 中混入了 `separator` 字符串），高亮拆分后路径里 ` / ` 两边的空格会被吃掉，视觉上变成了 `浙江省/杭州市/西湖区`，与未搜索时的展示不一致。  可在 [官网 Cascader「可搜索的」示例](https://semi.design/zh-CN/input/cascader#可搜索的) 直接复现。  ### Expected Behavior  1. 选中某个搜索结果后，下次打开下拉，搜索框关键词存在时，对应已选中项中的关键词应继续保持高亮态，与刚搜索时一致。 2. 高亮渲染过程不应该改变 `separator` 中的空格，路径分隔符在视觉上应该保持原样，例如默认情况下始终展示为 `A / B / C`，前后空格不丢失。  ### Steps To Reproduce  1. 打开 https://semi.design/zh-CN/input/cascader#可搜索的 2. 在第一个「默认对 label 值进行搜索」的 Cascader 输入框中输入 `杭`。 3. 在下拉列表中点击 `浙江省 / 杭州市 / 西湖区`。 4. 观察 trigger 中回填的文本，以及再次点开下拉时该选中项的渲染。 5. 可以看到：    - 选中项里 `杭` 不再以高亮色加粗显示；    - 路径中 `/` 两边的空格出现丢失，与初次搜索时显示的样式不一致。  ### ReproducibleCode  ```jsx import React from 'react'; import { Cascader } from '@douyinfe/semi-ui';  () => {     const treeData = [         {             label: '浙江省',             value: 'zhejiang',             children: [                 {                     label: '杭州市',                     value: 'hangzhou',                     children: [                         { label: '西湖区', value: 'xihu' },                  

- **Issue #2908** (2026-05-09): **[JsonViewer] 多行替换时光标位置不符合预期**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  JsonViewer  ### Semi Version  latest   ### Current Behavior 多行替换时光标位置不符合预期 ![Image](https://github.com/user-attachments/assets/d41425aa-0486-477b-9218-116af7c7828e)  ### Expected Behavior    ### Steps To Reproduce  _No response_  ### ReproducibleCode  ```markdown  ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else?  _No response_

- **Issue #2870** (2025-06-20): **[DatePicker] type monthRange 且英文 locale 下点击月份后，不会自动滚动到非禁用项目**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  DatePicker  ### Semi Version  latest  ### Current Behavior  type monthRange 且在英文 locale 下点击月份后，不会自动滚动到非禁用项目 ![Image](https://github.com/user-attachments/assets/27eb540f-8040-4cc4-aeb0-50a0c9ce7aec)  ### Expected Behavior  对其中文 locale 下的表现，在type monthRange 且英文 locale 下点击月份后，会自动滚动到非禁用项目  ### Steps To Reproduce  _No response_  ### ReproducibleCode  ```markdown import React from 'react'; import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB'; import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN'; import { LocaleProvider } from '@douyinfe/semi-ui';  class I18nDemo extends React.Component {     constructor(props) {         super(props);     }     render() {            return (             <>                   <LocaleProvider locale={en_GB}>                     <DatePicker type="monthRange" onChange={(date, dateString) => console.log(dateString)} />                 </LocaleProvider>                 <LocaleProvider locale={zh_CN}>                     <DatePicker type="monthRange" onChange={(date, dateString) => console.log(dateString)} />                 </LocaleProvider>             </>         );     } } ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else?  _No response_

- **Issue #2863** (2026-03-20): **[TEST] 时间范围类型的 DatePicker 组件中的 Input 在 active/hover 时，背景色样式优先级不够高导致样式被覆盖**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  DatePicker  ### Semi Version  _No response_  ### Current Behavior  时间范围类型的 DatePicker 组件中的 Input 在 active/hover 时，背景色样式优先级不够高导致样式被覆盖  ### Expected Behavior  时间范围类型的 DatePicker 组件中的 Input 在 active/hover 时，背景色正确  ### Steps To Reproduce  _No response_  ### ReproducibleCode  ```markdown  ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else?  _No response_

- **Issue #2853** (2025-06-09): **[Select] Select 在分组 label 为 reactnode 情况下filter 搜索展示错误**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Select  ### Semi Version  latest  ### Current Behavior  先搜索 a，再搜索 b，列表中出现两个 b  ### Expected Behavior  先搜索 a，再搜索 b，列表中仍然只有一个 b  ### Steps To Reproduce  ![Image](https://github.com/user-attachments/assets/6a7a0ad7-d1f4-4235-85ec-499bc371f735)  ### ReproducibleCode  ```markdown import React from 'react'; import { Select } from '@douyinfe/semi-ui';  () => (     <Select placeholder="" style={{ width: 180 }} filter>         <Select.OptGroup label={<div>a</div>} key="a">             <Select.Option value="a-1">a-1</Select.Option>             <Select.Option value="a-2">a-2</Select.Option>         </Select.OptGroup>         <Select.OptGroup label={<div>b</div>} key="b">             <Select.Option value="b-1">b-1</Select.Option>             <Select.Option value="b-2">b-2</Select.Option>         </Select.OptGroup>         <Select.OptGroup label={<div>c</div>} key="c">             <Select.Option value="c-1">c-1</Select.Option>         </Select.OptGroup>     </Select> ); ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else?  _No response_

- **Issue #2801** (2026-04-08): **[BUG] Resizable 中的 handler 的 z-index 过高，会浮在 modal 之上**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Resizable  ### Semi Version  2.78.0  ### Current Behavior  ![Image](https://github.com/user-attachments/assets/723f8b94-e912-444f-898a-166960df1735)  ### Expected Behavior  handler 不应该在弹出层的上方  ### Steps To Reproduce  _No response_  ### ReproducibleCode  ```markdown import React, { useState } from 'react'; import { ResizeItem, ResizeHandler, ResizeGroup, Toast } from '@douyinfe/semi-ui';  function Demo() {     const [text, setText] = useState('Drag to resize');     const [visible, setVisible] = useState(false);     const showDialog = () => {         setVisible(true);     };     const handleOk = () => {         setVisible(false);         console.log('Ok button clicked');     };     const handleCancel = () => {         setVisible(false);         console.log('Cancel button clicked');     };     const handleAfterClose = () => {         console.log('After Close callback executed');     };     return (         <div style={{ width: '1000px', height: '100px' }}>             <ResizeGroup direction="horizontal">                 <ResizeItem                     style={{                         backgroundColor: 'rgba(var(--semi-grey-1), 1)',                         border: 'var(--semi-color-border) 1px solid',                     }}                     defaultSize={'400px'}                     min={'10%'}                     onChange={() => {                         setText('resizing')
  **Post-Mortem & Fix Analysis**:
  > modal 有个zIndex属性来控制遮罩的层级 @YyumeiZhang 

- **Issue #2781** (2025-04-08): **[BUG] collapsible Tabs 设置 activeKey 不会自动滚动到当前 active tab 的位置**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Which Component  Tabs  ### Semi Version  latest  ### Current Behavior  collapsible Tabs 设置 activeKey 不会自动滚动到当前 active tab 的位置  ### Expected Behavior  collapsible Tabs 设置 activeKey 初始化时希望能自动滚动到当前 active tab 的位置   ### ReproducibleCode  ```markdown import React from 'react'; import { Tabs, TabPane } from '@douyinfe/semi-ui';  class App extends React.Component {     render() {         return (             <Tabs style={{ width: '60%', margin: '20px' }} defaultActiveKey="Tab-7" type="card" collapsible>                 {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (                     <TabPane tab={`Tab-${i}`} itemKey={`Tab-${i}`} key={i}>                         Content of card tab {i}                     </TabPane>                 ))}             </Tabs>         );     } } ```  ### Environment  ```markdown - OS: - browser: ```  ### Anything else? **问题归因** 现在 tabs 仅在 componentDidUpdate 的时候根据 activeKey 和 collapsible 判断需不需要执行 scrollActiveTabItemIntoView 操作，需要手动改变一下 activeKey 的值才能成功执行 scrollActiveTabItemIntoView，感觉这个行为像 bug，可以按照下述方式临时规避下。 ```markdown import React from 'react'; import { Tabs, TabPane } from '@douyinfe/semi-ui'; class App extends React.Component {      constructor(props) {         super(props);         this.state = {             activeKey: 'Tab-8'          };     }     componentDidMount() {         this.setState({ activeKey: 'Tab-9' });     }     render() {         return (             

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

### Incident Patch 1: `2a4ec362` (2026-09-15)
**Commit Message**: Merge pull request #3348 from chuhuangvio-itch/fix/unhandled-regexp-syntaxerror-on-user-inp

fix(timePicker): escape regExp special characters in format separator to avoid SyntaxError

**File**: `packages/semi-foundation/timePicker/utils/index.ts` (modified, +2/-1)
```diff
@@ -131,7 +131,8 @@ export const isTimeFormatLike = (time: string, formatToken: string) => {
     const hmsReg = /[H|m|s]{1,2}/;
     const formatSplitted = formatToken.split(formatNotSupportChReg); // => ['HH', 'mm'];
     const timeSeparator = formatToken.replace(formatSupportChReg, ''); // => :
-    const timeReg = new RegExp(`[${timeSeparator}]`, 'g'); // => /[:]/g
+    const escapedTimeSeparator = timeSeparator.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'); // escape regExp special characters to avoid invalid regExp, e.g. format="HH\\mm"
+    const timeReg = new RegExp(`[${escapedTimeSeparator}]`, 'g'); // => /[:]/g
     const timeSplitted = time.split(timeReg); // => ['12', '0]
 
     if (formatSplitted.length !== timeSplitted.length) {
```

**File**: `packages/semi-ui/timePicker/__test__/timePicker.test.js` (modified, +5/-0)
```diff
@@ -300,6 +300,11 @@ describe(`TimePicker`, () => {
             ['上午 12:00:02', 'a h:mm:ss', true],
             ['上午 12:00:0', 'a h:mm:ss', false],
             ['上午 12:0:00', 'a h:mm:ss', false],
+            // format separator containing a regExp-special character should not throw (regression test,
+            // previously threw "SyntaxError: Invalid regular expression" because the separator was
+            // interpolated into a RegExp character class without escaping)
+            ['12\\00', 'HH\\mm', true],
+            ['12.00', 'HH.mm', true],
         ];
 
         testCases.forEach(test => {
```

---

### Incident Patch 2: `2e0964d0` (2026-09-15)
**Commit Message**: Merge pull request #3355 from toyeshhm/fix-doc-typos

docs: fix typos across component docs and contributing guide

**File**: `CONTRIBUTING-en-US.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ cd semi-design
 ```bash
 git checkout -b <TOPIC_BRANCH_NAME>
 ```
->Before installing the enviroment,make sure that there is a dependency of `lerna` and `yarn` locally, if not, should run:
+>Before installing the environment, make sure that there is a dependency of `lerna` and `yarn` locally, if not, should run:
 ```base
 corepack enable
 ```
```

**File**: `content/advanced/design-to-code/index-en-US.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ For more detailed usage instructions, you can visit <a href="/code" target="_bla
 
 Here is a link to the Figma example mockup and its corresponding Codesandbox transpiled using the Semi Figma plugin.
 
-| Screenshot & Figma URL                                                                                                                                                                                                                                                                                                                         | Draft Type                                                                                        | Desciption                                                                                          | Codesandbox                                                                                  |
+| Screenshot & Figma URL                                                                                                                                                                                                                                                                                                                         | Draft Type                                                                                        | Description                                                                                          | Codesandbox                                                                                  |
 |------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
 | <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=5%3A2092' target="_blank" rel="noreferrer noopener"><img src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/semi-linker/simple-demo-1.jpg' style={{ width:  400 }} /></a>                                               | A module with simple content without components                                                   | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/w1z9yx' target="_blank" rel="noreferrer noopener">Link</a> |
 | <a href='https://www.figma.com/file/TlLeWouyImYUexTmhdLiIn/D2C-Getting-Start-Demo?node-id=1%3A275' target="_blank" rel="noreferrer noopener"><img src='https://lf3-files.qingfuwucdn.net/obj/inspirecloud-file/baas/tt38q7/2468f1c4f1756bc0_1676603194364.png' style={{ width:  400 }} /></a>                                                  | Modules that do not contain components, have more content, or have a slightly more complex layout | Can be used to quickly restore layout and content                                                   | <a href='https://codesandbox.io/s/905ncn' target="_blank" rel="noreferrer noopener">Link</a> |
```

**File**: `content/basic/button/index-en-US.md` (modified, +1/-1)
```diff
@@ -332,7 +332,7 @@ function ButtonDemo() {
         <div>
             <Button disabled>Disabled</Button>
             <Button disabled theme="borderless">No background and disabled</Button>
-            <Button disabled theme="light">Light and disbaled</Button>
+            <Button disabled theme="light">Light and disabled</Button>
             <Button disabled theme="borderless" type="primary">No background, primary and disabled</Button>
             <Button disabled theme="solid" type="warning">Solid, warning and disabled</Button>
         </div>
```

**File**: `content/basic/typography/index-en-US.md` (modified, +4/-4)
```diff
@@ -46,7 +46,7 @@ function Demo() {
 
 ### Text
 
-Text component has different built-in styles. You could also pass `icon` to use the build-in styles for icon. Different from passing icon to children, using `icon` for link will have no underline in compliance with Semi Design principles.
+Text component has different built-in styles. You could also pass `icon` to use the built-in styles for icon. Different from passing icon to children, using `icon` for link will have no underline in compliance with Semi Design principles.
 
 ```jsx live=true
 import React from 'react';
@@ -427,7 +427,7 @@ function Demo() {
             <Text 
                 ellipsis={{ 
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation' }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation' }
                     }
                 }}
                 style={{ width: 150 }}
@@ -438,7 +438,7 @@ function Demo() {
             <Text 
                 ellipsis={{ 
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation', className: 'components-typography-demo' }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation', className: 'components-typography-demo' }
                     }
                 }}
                 style={{ width: 150 }}
@@ -449,7 +449,7 @@ function Demo() {
             <Text 
                 ellipsis={{
                     showTooltip: {
-                        opts: { content: 'Insfrastructure|Data-inf|bytegraph.cheetah.user_relation', style: { wordBreak: 'break-all' } }
+                        opts: { content: 'Infrastructure|Data-inf|bytegraph.cheetah.user_relation', style: { wordBreak: 'break-all' } }
                     }
                 }}
                 style={{ width: 150 }}
```

**File**: `content/ecosystem/faq/index-en-US.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ No plans for this. Specific reasons: [Issue 311](https://github.com/DouyinFE/sem
 
 
 #### What is the relationship between Semi 2.x (open source version) and Semi 1.x?
- - The Semi v2.0 version is refactored based on v1.x using ts, which brings a better ts experience, bettter a11y support and a more out-of-the-box engineering solution, which solves the coexistence of multi-component libraries in the micro front-end scenario Style conflict issues, etc. All subsequent long-term work of the Semi team will be based on the v2.x version
+ - The Semi v2.0 version is refactored based on v1.x using ts, which brings a better ts experience, better a11y support and a more out-of-the-box engineering solution, which solves the coexistence of multi-component libraries in the micro front-end scenario Style conflict issues, etc. All subsequent long-term work of the Semi team will be based on the v2.x version
  - v1.x has stopped iterative maintenance, no more feature additions or complex changes, only necessary bug fix changes are provided.
  - For new projects, we recommend that you directly use 2.x [@douyin/semi-ui](https://semi.design) for development. For existing projects, we also recommend that you upgrade as soon as possible. In order to reduce the cost of upgrading, we provide a cli tool one-click migration (@ies/semi-codemod-v2) that can help you automatically complete up to 90% of the migration and modification (limited by the AST implementation principle, there are still a small number of cases that require manual labor review modification, but not much 😉)
  - Upgrade from Semi 1.x to Semi 2.x for detailed operation steps [From v1 to v2](https://semi.design/en-US/start/update-to-v2)
```

---

### Incident Patch 3: `381e57be` (2026-09-15)
**Commit Message**: Merge pull request #3357 from DouyinFE/codex/fix-3350-radio-icon-center

【Auto】Fix: Radio 选中白点在 Safari 下偏移（显式 SVG 尺寸替代 em）

**File**: `packages/semi-foundation/radio/radio.scss` (modified, +9/-0)
```diff
@@ -236,6 +236,15 @@ $inner-width: $width-icon-medium;
                 width: 100%;
                 height: 100%;
                 font-size: 14px;
+
+                // #3350: 显式设置 svg 尺寸并 block 化，替代 svg 自带的 width/height="1em"。
+                // Safari 对以 em 指定尺寸的内联 SVG 存在渲染偏差，会导致 checked 状态
+                // 的白点视觉偏移；100% 让 svg 与图标容器严格同尺寸，无偏移空间。
+                svg {
+                    display: block;
+                    width: 100%;
+                    height: 100%;
+                }
             }
         }
     }
```

---

### Incident Patch 4: `f4b63a35` (2026-09-15)
**Commit Message**: fix(radio): explicit svg sizing for checked icon to avoid Safari offset (#3350)

**File**: `packages/semi-foundation/radio/radio.scss` (modified, +9/-0)
```diff
@@ -236,6 +236,15 @@ $inner-width: $width-icon-medium;
                 width: 100%;
                 height: 100%;
                 font-size: 14px;
+
+                // #3350: 显式设置 svg 尺寸并 block 化，替代 svg 自带的 width/height="1em"。
+                // Safari 对以 em 指定尺寸的内联 SVG 存在渲染偏差，会导致 checked 状态
+                // 的白点视觉偏移；100% 让 svg 与图标容器严格同尺寸，无偏移空间。
+                svg {
+                    display: block;
+                    width: 100%;
+                    height: 100%;
+                }
             }
         }
     }
```

---

### Incident Patch 5: `d418618e` (2026-09-15)
**Commit Message**: Merge pull request #3339 from kakiuwang-ui/fix/resize-group-display-none-recalc

fix(Resizable): recalculate ResizeGroup item sizes after it becomes visible (#3336)

**File**: `packages/semi-foundation/resizable/group/index.ts` (modified, +19/-0)
```diff
@@ -73,6 +73,9 @@ export class ResizeGroupFoundation<P = Record<string, any>, S = Record<string, a
     totalMinus: number;
     itemPercentMap: Map<number, number>; // 内部维护一个百分比数组，消除浮点计算误差
     type?: ResizeEventType;
+    // 首次 initSpace 时 group 是否可测量（非 display:none）。
+    // Whether the group was measurable (not inside display:none) on the first initSpace run. #3336
+    sizeInitialized: boolean = false;
 
 
     init(): void {
@@ -81,6 +84,19 @@ export class ResizeGroupFoundation<P = Record<string, any>, S = Record<string, a
         this.itemPercentMap = new Map();
         this.initSpace();
     }
+
+    /**
+     * When the group is initially mounted inside a display:none container, its own size
+     * and the handler sizes are all 0, so item sizes are computed with a `- 0px` handler
+     * offset and never corrected once the container becomes visible. Recalculate the layout
+     * the first time the group becomes measurable. Once it has a valid size, later resizes
+     * must NOT re-run initSpace, otherwise the user's manual drag results would be reset. #3336
+     */
+    handleGroupResize = () => {
+        if (!this.sizeInitialized && this.groupSize > 0) {
+            this.initSpace();
+        }
+    }
     get window(): Window | null {
         return this.groupRef.ownerDocument.defaultView as Window ?? null;
     }
@@ -231,6 +247,9 @@ export class ResizeGroupFoundation<P = Record<string, any>, S = Record<string, a
         // calculate accurate space for group item
         let handlerSizes = new Array(this._adapter.getHandlerCount()).fill(0);
         let parentSize = this.groupSize;
+        // Mark whether the group is measurable now; if not (e.g. inside display:none),
+        // handleGroupResize will re-run initSpace once it becomes visible. #3336
+        this.sizeInitialized = parentSize > 0;
         this.totalMinus = 0;
         for (let i = 0; i < this._adapter.getHandlerCount(); i++) {
             let handlerSize = direction === 'horizontal' ? this._adapter.getHandler(i).offsetWidth : this._adapter.getHandler(i).offsetHeight;
```

**File**: `packages/semi-ui/resizable/__test__/resizeGroupFoundation.test.js` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import { ResizeGroupFoundation } from '../../../semi-foundation/resizable/group';
+
+/**
+ * Reproduces #3336 at the foundation level: when a ResizeGroup is mounted inside a
+ * display:none container, the group and its handlers report offset size 0, so item
+ * sizes are computed with a `- 0px` handler offset. After the container becomes
+ * visible the sizes must be recalculated (handleGroupResize), otherwise the two items
+ * plus the handler overflow the group by the handler size.
+ *
+ * The jsdom ResizeObserver mock never fires a callback, so we drive handleGroupResize
+ * directly to emulate the group becoming measurable.
+ */
+function createMockAdapter({ groupEl, handlerEls, itemEls, direction }) {
+    return {
+        getProp: key => ({ direction }[key]),
+        getProps: () => ({ direction }),
+        getState: () => undefined,
+        getStates: () => ({}),
+        getContext: () => undefined,
+        getContexts: () => ({}),
+        getGroupRef: () => groupEl,
+        getHandler: i => handlerEls[i],
+        getHandlerCount: () => handlerEls.length,
+        getItem: i => itemEls[i],
+        getItemCount: () => itemEls.length,
+        getItemMin: () => undefined,
+        getItemMax: () => undefined,
+        getItemDefaultSize: () => undefined,
+        getItemStart: () => undefined,
+        getItemChange: () => undefined,
+        getItemEnd: () => undefined,
+        registerEvents: () => {},
+        unregisterEvents: () => {},
+    };
+}
+
+const makeEl = size => ({ offsetWidth: size, offsetHeight: size, style: {} });
+
+describe('ResizeGroupFoundation - recalc after becoming visible (#3336)', () => {
+    it('recalculates item sizes with the handler offset once the group is measurable', () => {
+        // vertical group, 2 items + 1 handler, mounted inside display:none => all sizes 0
+        const groupEl = makeEl(0);
+        const handlerEls = [makeEl(0)];
+        const itemEls = [makeEl(0), makeEl(0)];
+        const adapter = createMockAdapter({ groupEl, handlerEls, itemEls, direction: 'vertical' });
+        const foundation = new ResizeGroupFoundation(adapter);
+
+        foundation.init();
+
+        // initial (hidden) layout: 50% each, handler offset 0 => `- 0px`
+        expect(foundation.sizeInitialized).toBe(false);
+        expect(itemEls[0].style.height).toContain('- 0px');
+        expect(itemEls[1].style.height).toContain('- 0px');
+
+        // become visible: group 100px tall, handler 10px
+        groupEl.offsetHeight = 100;
+        groupEl.offsetWidth = 100;
+        handlerEls[0].offsetHeight = 10;
+        handlerEls[0].offsetWidth = 10;
+
+        foundation.handleGroupResize();
+
+        // recalculated: each item reserves half of the handler (10 / 2 = 5px)
+        expect(foundation.sizeInitialized).toBe(true);
+        expect(itemEls[0].style.height).toBe('calc(50% - 5px)');
+        expect(itemEls[1].style.height).toBe('calc(50% - 5px)');
+    });
+
+    it('does not re-run initSpace on later resizes (keeps user drag results)', () => {
+        const groupEl = makeEl(100);
+        const handlerEls = [makeEl(10)];
+        const itemEls = [makeEl(50), makeEl(50)];
+        const adapter = createMockAdapter({ groupEl, handlerEls, itemEls, direction: 'vertical' });
+        const foundation = new ResizeGroupFoundation(adapter);
+
+        foundation.init();
+        expect(foundation.sizeInitialized).toBe(true);
+
+        // simulate the user having dragged item 0
+        itemEls[0].style.height = 'calc(70% - 5px)';
+        itemEls[1].style.height = 'calc(30% - 5px)';
+
+        // a later group resize must not reset the layout back to the default 50/50
+        groupEl.offsetHeight = 200;
+        foundation.handleGroupResize();
+
+        expect(itemEls[0].style.height).toBe('calc(70% - 5px)');
+        expect(itemEls[1].style.height).toBe('calc(30% - 5px)');
+    });
+});
```

**File**: `packages/semi-ui/resizable/group/resizeGroup.tsx` (modified, +13/-0)
```diff
@@ -72,6 +72,7 @@ class ResizeGroup extends BaseComponent<ResizeGroupProps, ResizeGroupState> {
     groupRef: React.RefObject<HTMLDivElement>;
     groupSize: number;
     availableSize: number;
+    resizeObserver: ResizeObserver | null = null;
     static contextType = ResizeContext;
     context: ResizeGroupProps;
     // 在context中使用的属性需要考虑在strictMode下会执行两次，所以用Map来维护
@@ -89,6 +90,14 @@ class ResizeGroup extends BaseComponent<ResizeGroupProps, ResizeGroupState> {
         this.foundation.init();
         // 监听窗口大小变化，保证一些限制仍生效
         window.addEventListener('resize', this.foundation.ensureConstraint);
+        // 当 group 初次挂载在 display:none 容器内时 offset 尺寸为 0，item 尺寸会以 0px handler 计算且不再更新；
+        // 监听 group 自身尺寸变化，待其可见（可测量）后重新计算一次布局。#3336
+        if (typeof ResizeObserver !== 'undefined' && this.groupRef.current) {
+            this.resizeObserver = new ResizeObserver(() => {
+                this.foundation.handleGroupResize();
+            });
+            this.resizeObserver.observe(this.groupRef.current);
+        }
     }
 
     componentDidUpdate(prevProps: ResizeGroupProps) {
@@ -108,6 +117,10 @@ class ResizeGroup extends BaseComponent<ResizeGroupProps, ResizeGroupState> {
     componentWillUnmount() {
         this.foundation.destroy();
         window.removeEventListener('resize', this.foundation.ensureConstraint);
+        if (this.resizeObserver) {
+            this.resizeObserver.disconnect();
+            this.resizeObserver = null;
+        }
     }
 
     get adapter(): ResizeGroupAdapter<ResizeGroupProps, ResizeGroupState> {
```

---

### Incident Patch 6: `f777b9a8` (2026-09-15)
**Commit Message**: Merge pull request #3352 from dvd233/fix/modal-esc-top-only

fix(modal): ESC closes only the top-most modal

**File**: `packages/semi-foundation/modal/modalContentFoundation.ts` (modified, +22/-0)
```diff
@@ -30,6 +30,15 @@ export interface ModalContentAdapter extends DefaultAdapter<ModalContentProps, M
     prevFocusElementReFocus: () => void
 }
 
+/**
+ * Stack of `handleKeyDown` handlers for modals that currently listen on
+ * `document`. Every ModalContent registers its own document-level keydown
+ * listener, so `stopPropagation()` cannot stop sibling listeners on the same
+ * node — one ESC used to close every open dialog. Only the most recently
+ * mounted (top-most) listener should respond.
+ */
+const escListenerStack: Array<(e: any) => void> = [];
+
 export default class ModalContentFoundation extends BaseFoundation<ModalContentAdapter> {
 
     constructor(adapter: ModalContentAdapter) {
@@ -53,6 +62,12 @@ export default class ModalContentFoundation extends BaseFoundation<ModalContentA
     handleKeyDown = (e: any) => {
         const { closeOnEsc } = this.getProps();
         if (closeOnEsc && e.keyCode === KeyCode.ESC) {
+            // Multiple open modals each registered a document-level keydown
+            // listener; only the top-most (most recently mounted) one may
+            // close, so a single ESC closes dialogs one at a time.
+            if (escListenerStack[escListenerStack.length - 1] !== this.handleKeyDown) {
+                return;
+            }
             e.stopPropagation();
             this.close(e);
             return;
@@ -61,10 +76,17 @@ export default class ModalContentFoundation extends BaseFoundation<ModalContentA
 
     handleKeyDownEventListenerMount() {
         this._adapter.addKeyDownEventListener();
+        if (this.getProps().closeOnEsc) {
+            escListenerStack.push(this.handleKeyDown);
+        }
     }
 
     handleKeyDownEventListenerUnmount() {
         this._adapter.removeKeyDownEventListener();
+        const index = escListenerStack.indexOf(this.handleKeyDown);
+        if (index !== -1) {
+            escListenerStack.splice(index, 1);
+        }
     }
 
     getMouseState() {
```

**File**: `packages/semi-ui/modal/__test__/modal.test.js` (modified, +45/-0)
```diff
@@ -336,4 +336,49 @@ describe('modal', () => {
         expect(modal.exists(`div.${testClass}`)).toEqual(true);
         modal.unmount();
     });
+
+    it('esc closes only the top-most modal when multiple are open', () => {
+        const onCancelOuter = jest.fn();
+        const onCancelInner = jest.fn();
+        class StackedModals extends React.Component {
+            state = {
+                outerVisible: true,
+                innerVisible: true,
+            };
+
+            handleOuterCancel = (e) => {
+                onCancelOuter(e);
+                this.setState({ outerVisible: false });
+            };
+
+            handleInnerCancel = (e) => {
+                onCancelInner(e);
+                this.setState({ innerVisible: false });
+            };
+
+            render() {
+                return (
+                    <>
+                        {getModal({ visible: this.state.outerVisible, onCancel: this.handleOuterCancel })}
+                        {getModal({ visible: this.state.innerVisible, onCancel: this.handleInnerCancel })}
+                    </>
+                );
+            }
+        }
+
+        const stacked = mount(<StackedModals />, { attachTo: document.getElementById('container') });
+
+        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
+
+        // Only the most recently mounted (top-most) modal should close.
+        expect(onCancelInner).toHaveBeenCalledTimes(1);
+        expect(onCancelOuter).toHaveBeenCalledTimes(0);
+
+        // After the top modal unmounts, the next ESC reaches the outer one.
+        stacked.update();
+        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
+        expect(onCancelOuter).toHaveBeenCalledTimes(1);
+
+        stacked.unmount();
+    });
 })
```

---

### Incident Patch 7: `17055c72` (2026-09-15)
**Commit Message**: Merge pull request #3356 from DouyinFE/codex/fix-3354-datepicker-popup-flash

【Auto】Fix: DatePicker 弹层打开时位置闪烁（等待尺寸稳定后定位）

**File**: `packages/semi-ui/tooltip/__test__/tooltip.test.js` (modified, +55/-2)
```diff
@@ -376,7 +376,8 @@ describe(`Tooltip`, () => {
       // Browser lays out portal-inner, then ResizeObserver fires
       laidOut = true;
       observers.forEach(o => o.cb && o.cb());
-      await sleep(10);
+      // #3354: 首次定位会等待尺寸稳定（32ms 稳定窗口）后再执行
+      await sleep(60);
 
       // The layout-driven ResizeObserver callback should have triggered positioning
       expect(calcSpy.called).toBe(true);
@@ -411,7 +412,8 @@ describe(`Tooltip`, () => {
           <Button>trigger</Button>
         </Tooltip>
       );
-      await sleep(10);
+      // #3354: 等待首次定位完成（尺寸稳定窗口 32ms）后再制造内容增长
+      await sleep(60);
 
       const instance = demo.find(Tooltip).instance();
       const calcSpy = sinon.spy(instance.foundation, 'calcPosition');
@@ -420,9 +422,60 @@ describe(`Tooltip`, () => {
       // against a valid, but incomplete, initial size.
       popupHeight = 342;
       observers.forEach(o => o.cb && o.cb());
+      await sleep(30);
+
+      expect(calcSpy.calledOnce).toBe(true);
+      calcSpy.restore();
+      demo.unmount();
+    } finally {
+      global.ResizeObserver = realResizeObserver;
+      Object.defineProperty(global.HTMLElement.prototype, 'offsetWidth', offsetWidthDesc);
+      Object.defineProperty(global.HTMLElement.prototype, 'offsetHeight', offsetHeightDesc);
+    }
+  });
+
+  it(`positions once after popup size stabilizes to avoid flicker (#3354)`, async () => {
+    const realResizeObserver = global.ResizeObserver;
+    const offsetWidthDesc = Object.getOwnPropertyDescriptor(global.HTMLElement.prototype, 'offsetWidth');
+    const offsetHeightDesc = Object.getOwnPropertyDescriptor(global.HTMLElement.prototype, 'offsetHeight');
+
+    const observers = [];
+    // DatePicker-like popup: a small non-zero size first, then it grows.
+    // Positioning against that intermediate size causes a flip/jump once the
+    // final size arrives, which is visible as flickering.
+    let popupHeight = 32;
+    global.ResizeObserver = class {
+      constructor(cb) { this.cb = cb; observers.push(this); }
+      observe() {}
+      unobserve() {}
+      disconnect() {}
+    };
+    Object.defineProperty(global.HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return 120; } });
+    Object.defineProperty(global.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return popupHeight; } });
+
+    try {
+      const demo = mount(
+        <Tooltip motion={false} content={'Content'} visible={true} trigger={'custom'} position="bottom">
+          <Button>trigger</Button>
+        </Tooltip>
+      );
+      await sleep(10);
+
+      const instance = demo.find(Tooltip).instance();
+      const calcSpy = sinon.spy(instance.foundation, 'calcPosition');
+
+      // The popup grows before the size-stabilize window elapses
+      popupHeight = 342;
+      observers.forEach(o => o.cb && o.cb());
       await sleep(10);
 
+      // Must not position against the unstable intermediate size
+      expect(calcSpy.called).toBe(false);
+
+      // After the size stabilizes, positioning runs exactly once
+      await sleep(60);
       expect(calcSpy.calledOnce).toBe(true);
+
       calcSpy.restore();
       demo.unmount();
     } finally {
```

**File**: `packages/semi-ui/tooltip/index.tsx` (modified, +26/-4)
```diff
@@ -204,6 +204,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
     scrollHandler: any;
     popupResizeObserver: ResizeObserver;
     popupResizeTimer: ReturnType<typeof setTimeout>;
+    popupSizeStabilizeTimer: ReturnType<typeof setTimeout>;
     getPopupContainer: () => HTMLElement;
     containerPosition: string;
     foundation: TooltipFoundation;
@@ -291,6 +292,18 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                                     emit();
                                 }
                             };
+                            // #3354: 等待 popup 尺寸稳定后再做首次定位。
+                            // DatePicker 等内容会先以较小的非零尺寸完成初次布局，
+                            // 若此时立即定位（快路径或首次 RO 回调），尺寸扩展后会因
+                            // 溢出判定变化而翻转，视觉上表现为位置跳变（闪烁）。
+                            const scheduleStableEmit = () => {
+                                clearTimeout(this.popupSizeStabilizeTimer);
+                                this.popupSizeStabilizeTimer = setTimeout(() => {
+                                    if (!emitted && this.cachedLatestTransitionState === 'enter') {
+                                        emitOnce();
+                                    }
+                                }, 32);
+                            };
                             const ro = new ResizeObserver(() => {
                                 const width = el.offsetWidth;
                                 const height = el.offsetHeight;
@@ -301,7 +314,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                                 lastWidth = width;
                                 lastHeight = height;
                                 if (!emitted) {
-                                    emitOnce();
+                                    scheduleStableEmit();
                                 } else if (sizeChanged && this.cachedLatestTransitionState === 'enter') {
                                     clearTimeout(this.popupResizeTimer);
                                     this.popupResizeTimer = setTimeout(() => {
@@ -314,14 +327,14 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                             this.popupResizeObserver = ro;
                             ro.observe(el);
                             if (lastWidth > 0 && lastHeight > 0) {
-                                emitOnce();
+                                scheduleStableEmit();
                             }
-                            // Safety net: bail out after 50ms even if RO never fires
+                            // Safety net: bail out after 100ms even if RO never fires
                             setTimeout(() => {
                                 if (!emitted) {
                                     emitOnce();
                                 }
-                            }, 50);
+                            }, 100);
                             return;
                         }
                         // Fallback for browsers without ResizeObserver.
@@ -374,6 +387,14 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                         scrollLeft: container.scrollLeft,
                         scrollTop: container.scrollTop,
                     };
+                    // #3354: body 的高度通常只是内容高度，而弹层实际可显示区域是视口；
+                    // 用 body 边界做溢出判断会把正常能放下的弹层误判为溢出并 pin 到错误位置。
+                    // 这里使用 clientWidth/clientHeight（视口内容区，不含滚动条），
+                    // 避免在 Windows/Linux 经典滚动条下弹层贴边时被滚动条遮挡。
+                    if (container === document.body) {
+                        rect.right = Math.max(boundingRect.right, document.documentElement.clientWidth);
+                        rect.bottom = Math.max(boundingRect.bottom, document.documentElement.clientHeight);
+                    }
                 }
 
                 return rect;
@@ -586,6 +607,7
```

---

### Incident Patch 8: `dacca934` (2026-09-15)
**Commit Message**: fix(tooltip): use viewport client size for popup container overflow bounds (#3354)

**File**: `packages/semi-ui/tooltip/index.tsx` (modified, +4/-2)
```diff
@@ -389,9 +389,11 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                     };
                     // #3354: body 的高度通常只是内容高度，而弹层实际可显示区域是视口；
                     // 用 body 边界做溢出判断会把正常能放下的弹层误判为溢出并 pin 到错误位置。
+                    // 这里使用 clientWidth/clientHeight（视口内容区，不含滚动条），
+                    // 避免在 Windows/Linux 经典滚动条下弹层贴边时被滚动条遮挡。
                     if (container === document.body) {
-                        rect.right = Math.max(boundingRect.right, window.innerWidth);
-                        rect.bottom = Math.max(boundingRect.bottom, window.innerHeight);
+                        rect.right = Math.max(boundingRect.right, document.documentElement.clientWidth);
+                        rect.bottom = Math.max(boundingRect.bottom, document.documentElement.clientHeight);
                     }
                 }
 
```

---

### Incident Patch 9: `b4b781e0` (2026-09-15)
**Commit Message**: fix(tooltip): wait for stable popup size before initial positioning (#3354)

**File**: `packages/semi-ui/tooltip/__test__/tooltip.test.js` (modified, +55/-2)
```diff
@@ -376,7 +376,8 @@ describe(`Tooltip`, () => {
       // Browser lays out portal-inner, then ResizeObserver fires
       laidOut = true;
       observers.forEach(o => o.cb && o.cb());
-      await sleep(10);
+      // #3354: 首次定位会等待尺寸稳定（32ms 稳定窗口）后再执行
+      await sleep(60);
 
       // The layout-driven ResizeObserver callback should have triggered positioning
       expect(calcSpy.called).toBe(true);
@@ -411,7 +412,8 @@ describe(`Tooltip`, () => {
           <Button>trigger</Button>
         </Tooltip>
       );
-      await sleep(10);
+      // #3354: 等待首次定位完成（尺寸稳定窗口 32ms）后再制造内容增长
+      await sleep(60);
 
       const instance = demo.find(Tooltip).instance();
       const calcSpy = sinon.spy(instance.foundation, 'calcPosition');
@@ -420,9 +422,60 @@ describe(`Tooltip`, () => {
       // against a valid, but incomplete, initial size.
       popupHeight = 342;
       observers.forEach(o => o.cb && o.cb());
+      await sleep(30);
+
+      expect(calcSpy.calledOnce).toBe(true);
+      calcSpy.restore();
+      demo.unmount();
+    } finally {
+      global.ResizeObserver = realResizeObserver;
+      Object.defineProperty(global.HTMLElement.prototype, 'offsetWidth', offsetWidthDesc);
+      Object.defineProperty(global.HTMLElement.prototype, 'offsetHeight', offsetHeightDesc);
+    }
+  });
+
+  it(`positions once after popup size stabilizes to avoid flicker (#3354)`, async () => {
+    const realResizeObserver = global.ResizeObserver;
+    const offsetWidthDesc = Object.getOwnPropertyDescriptor(global.HTMLElement.prototype, 'offsetWidth');
+    const offsetHeightDesc = Object.getOwnPropertyDescriptor(global.HTMLElement.prototype, 'offsetHeight');
+
+    const observers = [];
+    // DatePicker-like popup: a small non-zero size first, then it grows.
+    // Positioning against that intermediate size causes a flip/jump once the
+    // final size arrives, which is visible as flickering.
+    let popupHeight = 32;
+    global.ResizeObserver = class {
+      constructor(cb) { this.cb = cb; observers.push(this); }
+      observe() {}
+      unobserve() {}
+      disconnect() {}
+    };
+    Object.defineProperty(global.HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return 120; } });
+    Object.defineProperty(global.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return popupHeight; } });
+
+    try {
+      const demo = mount(
+        <Tooltip motion={false} content={'Content'} visible={true} trigger={'custom'} position="bottom">
+          <Button>trigger</Button>
+        </Tooltip>
+      );
+      await sleep(10);
+
+      const instance = demo.find(Tooltip).instance();
+      const calcSpy = sinon.spy(instance.foundation, 'calcPosition');
+
+      // The popup grows before the size-stabilize window elapses
+      popupHeight = 342;
+      observers.forEach(o => o.cb && o.cb());
       await sleep(10);
 
+      // Must not position against the unstable intermediate size
+      expect(calcSpy.called).toBe(false);
+
+      // After the size stabilizes, positioning runs exactly once
+      await sleep(60);
       expect(calcSpy.calledOnce).toBe(true);
+
       calcSpy.restore();
       demo.unmount();
     } finally {
```

**File**: `packages/semi-ui/tooltip/index.tsx` (modified, +24/-4)
```diff
@@ -204,6 +204,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
     scrollHandler: any;
     popupResizeObserver: ResizeObserver;
     popupResizeTimer: ReturnType<typeof setTimeout>;
+    popupSizeStabilizeTimer: ReturnType<typeof setTimeout>;
     getPopupContainer: () => HTMLElement;
     containerPosition: string;
     foundation: TooltipFoundation;
@@ -291,6 +292,18 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                                     emit();
                                 }
                             };
+                            // #3354: 等待 popup 尺寸稳定后再做首次定位。
+                            // DatePicker 等内容会先以较小的非零尺寸完成初次布局，
+                            // 若此时立即定位（快路径或首次 RO 回调），尺寸扩展后会因
+                            // 溢出判定变化而翻转，视觉上表现为位置跳变（闪烁）。
+                            const scheduleStableEmit = () => {
+                                clearTimeout(this.popupSizeStabilizeTimer);
+                                this.popupSizeStabilizeTimer = setTimeout(() => {
+                                    if (!emitted && this.cachedLatestTransitionState === 'enter') {
+                                        emitOnce();
+                                    }
+                                }, 32);
+                            };
                             const ro = new ResizeObserver(() => {
                                 const width = el.offsetWidth;
                                 const height = el.offsetHeight;
@@ -301,7 +314,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                                 lastWidth = width;
                                 lastHeight = height;
                                 if (!emitted) {
-                                    emitOnce();
+                                    scheduleStableEmit();
                                 } else if (sizeChanged && this.cachedLatestTransitionState === 'enter') {
                                     clearTimeout(this.popupResizeTimer);
                                     this.popupResizeTimer = setTimeout(() => {
@@ -314,14 +327,14 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                             this.popupResizeObserver = ro;
                             ro.observe(el);
                             if (lastWidth > 0 && lastHeight > 0) {
-                                emitOnce();
+                                scheduleStableEmit();
                             }
-                            // Safety net: bail out after 50ms even if RO never fires
+                            // Safety net: bail out after 100ms even if RO never fires
                             setTimeout(() => {
                                 if (!emitted) {
                                     emitOnce();
                                 }
-                            }, 50);
+                            }, 100);
                             return;
                         }
                         // Fallback for browsers without ResizeObserver.
@@ -374,6 +387,12 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
                         scrollLeft: container.scrollLeft,
                         scrollTop: container.scrollTop,
                     };
+                    // #3354: body 的高度通常只是内容高度，而弹层实际可显示区域是视口；
+                    // 用 body 边界做溢出判断会把正常能放下的弹层误判为溢出并 pin 到错误位置。
+                    if (container === document.body) {
+                        rect.right = Math.max(boundingRect.right, window.innerWidth);
+                        rect.bottom = Math.max(boundingRect.bottom, window.innerHeight);
+                    }
                 }
 
                 return rect;
@@ -586,6 +605,7 @@ export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
 
     disconnectPopupResizeObserver = () => {
         clearTimeout(this.popupRes
```

---

### Incident Patch 10: `8db432d4` (2026-09-10)
**Commit Message**: fix(modal): ESC closes only the top-most modal

Keep only the most recently mounted ModalContent keydown handler active so one ESC closes one dialog at a time. Add a controlled nested-modal regression test.

Fixes #3351

**File**: `packages/semi-foundation/modal/modalContentFoundation.ts` (modified, +22/-0)
```diff
@@ -30,6 +30,15 @@ export interface ModalContentAdapter extends DefaultAdapter<ModalContentProps, M
     prevFocusElementReFocus: () => void
 }
 
+/**
+ * Stack of `handleKeyDown` handlers for modals that currently listen on
+ * `document`. Every ModalContent registers its own document-level keydown
+ * listener, so `stopPropagation()` cannot stop sibling listeners on the same
+ * node — one ESC used to close every open dialog. Only the most recently
+ * mounted (top-most) listener should respond.
+ */
+const escListenerStack: Array<(e: any) => void> = [];
+
 export default class ModalContentFoundation extends BaseFoundation<ModalContentAdapter> {
 
     constructor(adapter: ModalContentAdapter) {
@@ -53,6 +62,12 @@ export default class ModalContentFoundation extends BaseFoundation<ModalContentA
     handleKeyDown = (e: any) => {
         const { closeOnEsc } = this.getProps();
         if (closeOnEsc && e.keyCode === KeyCode.ESC) {
+            // Multiple open modals each registered a document-level keydown
+            // listener; only the top-most (most recently mounted) one may
+            // close, so a single ESC closes dialogs one at a time.
+            if (escListenerStack[escListenerStack.length - 1] !== this.handleKeyDown) {
+                return;
+            }
             e.stopPropagation();
             this.close(e);
             return;
@@ -61,10 +76,17 @@ export default class ModalContentFoundation extends BaseFoundation<ModalContentA
 
     handleKeyDownEventListenerMount() {
         this._adapter.addKeyDownEventListener();
+        if (this.getProps().closeOnEsc) {
+            escListenerStack.push(this.handleKeyDown);
+        }
     }
 
     handleKeyDownEventListenerUnmount() {
         this._adapter.removeKeyDownEventListener();
+        const index = escListenerStack.indexOf(this.handleKeyDown);
+        if (index !== -1) {
+            escListenerStack.splice(index, 1);
+        }
     }
 
     getMouseState() {
```

**File**: `packages/semi-ui/modal/__test__/modal.test.js` (modified, +45/-0)
```diff
@@ -336,4 +336,49 @@ describe('modal', () => {
         expect(modal.exists(`div.${testClass}`)).toEqual(true);
         modal.unmount();
     });
+
+    it('esc closes only the top-most modal when multiple are open', () => {
+        const onCancelOuter = jest.fn();
+        const onCancelInner = jest.fn();
+        class StackedModals extends React.Component {
+            state = {
+                outerVisible: true,
+                innerVisible: true,
+            };
+
+            handleOuterCancel = (e) => {
+                onCancelOuter(e);
+                this.setState({ outerVisible: false });
+            };
+
+            handleInnerCancel = (e) => {
+                onCancelInner(e);
+                this.setState({ innerVisible: false });
+            };
+
+            render() {
+                return (
+                    <>
+                        {getModal({ visible: this.state.outerVisible, onCancel: this.handleOuterCancel })}
+                        {getModal({ visible: this.state.innerVisible, onCancel: this.handleInnerCancel })}
+                    </>
+                );
+            }
+        }
+
+        const stacked = mount(<StackedModals />, { attachTo: document.getElementById('container') });
+
+        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
+
+        // Only the most recently mounted (top-most) modal should close.
+        expect(onCancelInner).toHaveBeenCalledTimes(1);
+        expect(onCancelOuter).toHaveBeenCalledTimes(0);
+
+        // After the top modal unmounts, the next ESC reaches the outer one.
+        stacked.update();
+        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
+        expect(onCancelOuter).toHaveBeenCalledTimes(1);
+
+        stacked.unmount();
+    });
 })
```

#### Recent Merged Pull Requests:
- **PR #3361** (closed): fix: 修复 Modal、Toast 和 Notification 在 React 提交阶段同步卸载 root 的错误 (@smile-alive)
- **PR #3359** (closed): ci: remove CodeSandbox --ignore-engines workaround by upgrading to Node 22 (@SudoUserReal)
- **PR #3358** (closed): chore: 临时对照 - chromatic baseline 检查（请勿合并） (@SudoUserReal)
- **PR #3357** (2026-09-15): 【Auto】Fix: Radio 选中白点在 Safari 下偏移（显式 SVG 尺寸替代 em） (@SudoUserReal)
- **PR #3356** (2026-09-15): 【Auto】Fix: DatePicker 弹层打开时位置闪烁（等待尺寸稳定后定位） (@SudoUserReal)
- **PR #3355** (2026-09-15): docs: fix typos across component docs and contributing guide (@toyeshhm)
- **PR #3353** (closed): fix(Tooltip): skip showing hover-triggered tooltip when mouse is not on the trigger element (@holdxen)
- **PR #3352** (2026-09-15): fix(modal): ESC closes only the top-most modal (@dvd233)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
