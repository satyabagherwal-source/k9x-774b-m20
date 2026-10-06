# Forensic Learning Record (Deep Inspection): arco-design/arco-design-vue

> **Canonical Artifact**: `07_PROJECT_LEARNING/arco-design-arco-design-vue-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arco-design/arco-design-vue](https://github.com/arco-design/arco-design-vue))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:17:11.232Z  
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

### Core Architecture Module: `packages/arco-changelog/src/utils/config.ts`
```
import path from 'path';
import fs from 'fs-extra';

export const getConfig = async () => {
  const filename = path.resolve(process.cwd(), 'changelog.config.ts');
  try {
    await fs.access(filename);
    return import(filename);
  } catch {
    return {};
  }
};
let packageCache: Record<string, any>;

export const getPackage = async (): Promise<Record<string, any>> => {
  if (!packageCache) {
    const content = await fs.readFile(
      path.resolve(process.cwd(), 'package.json'),
      'utf8'
    );
    try {
      packageCache = JSON.parse(content);
    } catch {}
  }

  return packageCache ?? {};
};

```

### Core Architecture Module: `packages/arco-changelog/src/utils/convert-case.ts`
```
export const toKebabCase = (string: string): string => {
  return string.replace(/[A-Z]+/g, (match, offset) => {
    return `${offset > 0 ? '-' : ''}${match.toLocaleLowerCase()}`;
  });
};

export const toPascalCase = (string: string): string => {
  return string
    .replace(/^./, (match) => match.toLocaleUpperCase())
    .replace(/-(.)/g, (match, p1: string) => {
      return p1.toLocaleUpperCase();
    });
};

```

### Core Architecture Module: `packages/arco-changelog/src/utils/invert.ts`
```
export const invertKeyValues = (obj: Record<string, string>) => {
  return Object.keys(obj).reduce((acc, key) => {
    acc[obj[key]] = key;
    return acc;
  }, {} as Record<string, string>);
};

```

### Core Architecture Module: `packages/arco-changelog/src/utils/version.ts`
```
const getLastVersion = (content: string) => {
  const match = content.match(/## (\d+\.\d+\.\d+(-beta\.\d+)?)/);
  return match?.[1];
};

const getBetaVersions = (content: string) => {
  const matches = Array.from(
    content.matchAll(/## (\d+\.\d+\.\d+(-beta\.\d+)?)/g)
  );
  const versions = [];
  for (const item of matches) {
    if (/beta/.test(item[1])) {
      versions.push(item[1]);
    } else {
      break;
    }
  }
  return versions;
};

const getVersionNumber = (version: string): number => {
  if (!version) {
    return 0;
  }
  switch (version) {
    case 'alpha':
      return -3;
    case 'beta':
      return -2;
    case 'rc':
      return -1;
    default:
      return parseInt(version, 10);
  }
};

export const compareVersion = (v1: string, v2: string) => {
  const mainArray1 = v1.split('-');
  const mainArray2 = v2.split('-');
  // Major version
  const array1 = mainArray1[0].split('.');
  const array2 = mainArray2[0].split('.');
  const maxL = Math.max(array1.length, array2.length);
  for (let i = 0; i < maxL; i++) {
    const v1 = getVersionNumber(array1[i]);
    const v2 = getVersionNumber(array2[i]);
    if (v1 !== v2) {
      return v1 > v2 ? 1 : -1;
    }
  }

  // Beta part
  const subArray1 = (mainArray1[1] ?? '').split('.');
  const subArray2 = (mainArray2[1] ?? '').split('.');
  const maxSL = Math.max(subArray1.length, subArray2.length);
  for (let i = 0; i < maxSL; i++) {
    const v1 = getVersionNumber(subArray1[i]);
    const v2 = getVersionNumber(subArray2[i]);
    if (v1 !== v2) {
      return v1 > v2 ? 1 : -1;
    }
  }

  return 0;
};

```

### Core Architecture Module: `packages/arco-vue-scripts/src/scripts/changelog/utils.ts`
```
const componentList = [
  'common',
  'alert',
  'anchor',
  'affix',
  'auto-complete',
  'avatar',
  'back-top',
  'badge',
  'breadcrumb',
  'button',
  'calendar',
  'card',
  'carousel',
  'cascader',
  'checkbox',
  'collapse',
  'comment',
  'config-provider',
  'date-picker',
  'descriptions',
  'divider',
  'drawer',
  'dropdown',
  'empty',
  'form',
  'grid',
  'icon',
  'input',
  'input-tag',
  'input-number',
  'layout',
  'link',
  'list',
  'message',
  'menu',
  'modal',
  'mention',
  'notification',
  'page-header',
  'pagination',
  'popconfirm',
  'popover',
  'progress',
  'radio',
  'rate',
  'resize-box',
  'result',
  'select',
  'skeleton',
  'slider',
  'space',
  'spin',
  'statistic',
  'steps',
  'switch',
  'table',
  'tabs',
  'tag',
  'timeline',
  'time-picker',
  'tooltip',
  'transfer',
  'tree',
  'tree-select',
  'textarea',
  'trigger',
  'typography',
  'upload',
  'image',
  'overflow-list',
  'scrollbar',
  'watermark',
  'color-picker',
  'verification-code',
];

export const isValidComponent = (component: string) => {
  return componentList.includes(component);
};

const getVersionNumber = (version: string): number => {
  if (!version) {
    return 0;
  }
  switch (version) {
    case 'alpha':
      return -3;
    case 'beta':
      return -2;
    case 'rc':
      return -1;
    default:
      return parseInt(version, 10);
  }
};

export const compareVersion = (v1: string, v2: string) => {
  const mainArray1 = v1.split('-');
  const mainArray2 = v2.split('-');
  // Major version
  const array1 = mainArray1[0].split('.');
  const array2 = mainArray2[0].split('.');
  const maxL = Math.max(array1.length, array2.length);
  for (let i = 0; i < maxL; i++) {
    const v1 = getVersionNumber(array1[i]);
    const v2 = getVersionNumber(array2[i]);
    if (v1 !== v2) {
      return v1 > v2 ? 1 : -1;
    }
  }

  // Beta part
  const subArray1 = (mainArray1[1] ?? '').split('.');
  const subArray2 = (mainArray2[1] ?? '').split('.');
  const maxSL = Math.max(subArray1.length, subArray2.length);
  for (let i = 0; i < maxSL; i++) {
    const v1 = getVersionNumber(subArray1[i]);
    const v2 = getVersionNumber(subArray2[i]);
    if (v1 !== v2) {
      return v1 > v2 ? 1 : -1;
    }
  }

  return 0;
};

```

### Core Architecture Module: `packages/arco-vue-scripts/src/scripts/docgen/utils/index.ts`
```
/**
 * 替换换行和竖线使其能在markdown中显示
 * @param str
 */
export const escapeCharacter = (str: string) => {
  return str.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
};

/**
 * 转为 kebab-case
 * @param str
 */
export const toKebabCase = (str: string): string => {
  return str.replace(/[A-Z]/g, (match, offset) => {
    return `${offset > 0 ? '-' : ''}${match.toLocaleLowerCase()}`;
  });
};

const opt = Object.prototype.toString;
export function isBoolean(obj: unknown): obj is boolean {
  return opt.call(obj) === '[object Boolean]';
}

/**
 * 去掉包裹字符串的引号
 * @param {str} string
 * @returns {string}
 */
export function unquote(str: string) {
  return str && str.replace(/^['"]|['"]$/g, '');
}

/**
 * 清理字符串前后的空格，竖线和 \n
 * @param {str} string
 * @returns {string}
 */
export function trimStr(str: string) {
  return str && str.replace(/^(\s|\||\r?\n)*|(\s|\||\r?\n)*$/g, '');
}

/**
 * 清理字符串中不符合预期的字符，如 \n
 * @param {str} string
 * @returns {string}
 */
export function cleanStr(str: string) {
  return str && str.replace(/\r?\n/g, '');
}

export const getTemplate = (src: string, lang: 'zh' | 'en') => {
  const matches = Array.from(
    src.matchAll(/##\s+(zh-CN|en-US)\n+(.+?)\n+---(?:\n|$)/gs)
  );
  for (const item of matches) {
    if (new RegExp(lang).test(item[1])) {
      src = src.replace(item[0], `${item[2]}\n`);
    } else {
      src = src.replace(item[0], '');
    }
  }

  return src;
};

```

### Core Architecture Module: `packages/arco-vue-scripts/src/scripts/docgen/utils/parse-interface.ts`
```
import { JSDocTag, Project, PropertySignature } from 'ts-morph';
import { ComponentDoc, PropDescriptor } from 'vue-docgen-api';

const project = new Project();

const formatterTags = (jsDocsTags: JSDocTag[]) => {
  const tags: PropDescriptor['tags'] = {};

  jsDocsTags.forEach((tag) => {
    const tagName = tag.getTagName();

    tags[tagName] = [
      {
        title: tagName,
        description: tag.getCommentText(),
      },
    ];
  });

  return tags;
};

const formatterProps = (properties: PropertySignature[]) => {
  const props: PropDescriptor[] = [];

  properties.forEach((p) => {
    const jsDocs = p.getJsDocs()[0];
    if (!jsDocs) {
      return;
    }

    props.push({
      name: p.getName(),
      type: {
        name: p.getTypeNode()?.getText() || '',
      },
      description: jsDocs.getDescription(),
      tags: formatterTags(jsDocs.getTags()),
    });
  });

  return props;
};

export default (filePath: string) => {
  project.addSourceFileAtPath(filePath);

  const sourceFile = project.getSourceFile(filePath);
  const componentDocList: ComponentDoc[] = [];

  if (sourceFile) {
    const interfaces = sourceFile.getInterfaces();
    interfaces.forEach((interfaceDeclaration) => {
      const properties = interfaceDeclaration.getProperties();
      const componentDoc = {
        displayName: interfaceDeclaration.getName(),
        exportName: interfaceDeclaration.getName(),
        props: formatterProps(properties),
      };

      if (componentDoc.props.length) {
        componentDocList.push(componentDoc);
      }
    });
  }

  return componentDocList;
};

```

### Core Architecture Module: `packages/arco-vue-scripts/src/scripts/docgen/utils/parse-material.ts`
```
import fs from 'fs-extra';
import { parse } from 'comment-parser';
import { parse as babelParse } from '@babel/parser';
import path from 'path';

function getMaterialData(content: string) {
  const blocks = parse(content);
  const baseNode = babelParse(content, {
    sourceType: 'module',
  });

  const materialData = [];

  for (const block of blocks) {
    const data: Record<string, any> = {
      kind: 'member',
    };
    for (const tag of block.tags) {
      if (tag.tag === 'file') {
        data.kind = 'file';
      } else {
        data[tag.tag] = tag.name;
      }
    }
    materialData.push(data);
  }

  const imports: string[] = [];
  for (const node of baseNode.program.body) {
    if (node.type === 'ImportDeclaration' && node.source?.value) {
      imports.push(node.source.value);
    }
  }

  return { materialData, imports };
}

const getMaterialMdContent = (materialData: Record<string, any>) => {
  return `\`\`\`json type=description\n${JSON.stringify(
    materialData,
    null,
    2
  )}\n\`\`\`\n`;
};

async function getDemoMdContent(filename: string) {
  const code = await fs.readFile(filename, 'utf8');
  return `\`\`\`vue\n${code}\n\`\`\`\n`;
}

export default async function parseMaterial(
  content: string,
  { matcher, dirname }: { matcher: RegExp; dirname: string }
) {
  const match = content.match(matcher);
  if (match && match[1]) {
    const filename = path.resolve(dirname, match[1]);
    const demoDirname = path.dirname(filename);
    const indexContent = await fs.readFile(filename, 'utf8');
    const { materialData, imports } = getMaterialData(indexContent);
    let result = `${getMaterialMdContent(materialData)}\n`;

    for (const item of imports) {
      const filename = path.resolve(demoDirname, item);
      result += `${await getDemoMdContent(filename)}\n`;
    }

    return content.replace(match[0], result);
  }
  return content;
}

```

### Core Architecture Module: `packages/arco-vue-scripts/src/scripts/docgen/utils/print.ts`
```
import chalk from 'chalk';

type LogLevelType = 'info' | 'warn' | 'success' | 'error';

function log(...args: unknown[]) {
  console.log(...args);
}

function print(color: string, ...args: any) {
  if (args.length > 1) {
    log(
      (chalk as any)[`bg${color.replace(/^\w/, (w) => w.toUpperCase())}`](
        ` ${args[0]} `
      ),
      (chalk as any)[color](args.slice(1))
    );
  } else {
    log((chalk as any)[color](...args));
  }
}

log.info = print.bind(null, 'gray');
log.warn = print.bind(null, 'yellow');
log.error = print.bind(null, 'red');
log.success = print.bind(null, 'green');
log.chalk = chalk;

/**
 * 打印分割线
 * @param {'info' | 'warn' | 'success' | 'error'} level
 */
log.divider = (level: LogLevelType = 'info') => {
  const logger = log[level] || log.info;
  logger(
    '---------------------------------------------------------------------------------------'
  );
};

export default log;

```

### Core Architecture Module: `packages/arco-vue-scripts/src/utils/config.ts`
```
import path from 'path';
import fs from 'fs-extra';

const CONFIG_DIR = '.config';

export const getUserConfig = async (name: string) => {
  const filename = path.resolve(process.cwd(), CONFIG_DIR, name);
  try {
    await fs.access(filename);
    return require(filename);
  } catch {
    return undefined;
  }
};

```

### Core Architecture Module: `packages/arco-vue-scripts/src/utils/convert-case.ts`
```
export const toKebabCase = (string: string): string => {
  return string.replace(/[A-Z]+/g, (match, offset) => {
    return `${offset > 0 ? '-' : ''}${match.toLocaleLowerCase()}`;
  });
};

export const toPascalCase = (string: string): string => {
  return string
    .replace(/^./, (match) => match.toLocaleUpperCase())
    .replace(/-(.)/g, (match, p1: string) => {
      return p1.toLocaleUpperCase();
    });
};

```

### Core Architecture Module: `packages/arco-vue-scripts/src/utils/get-package.ts`
```
import fs from 'fs-extra';
import path from 'path';

let cache: Record<string, any>;

export const getPackage = async () => {
  if (!cache) {
    const content = await fs.readFile(
      path.resolve(process.cwd(), 'package.json'),
      'utf8'
    );
    try {
      cache = JSON.parse(content);
    } catch {}
  }

  return cache ?? {};
};

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

Co-authored-by: renxj50 <[REDACTED_EMAIL]>

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
+  it('should warn and keep locale unchanged for unknown locale', async () => {
+    vi.resetModules();
+    const { useLocale, getLocale } = await import('../index');
+
+    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
+    const before = getLocale();
+
+    useLocale('xx-YY');
 
-    for (const item of languages) {
-      // eslint-disable-next-line no-await-in-loop
-      const lang = await import(`../lang/${item}`);
-      expect(lang.default).toMatchStructure(zhCN);
-    }
+    expect(warnSpy).toHaveBeenCalledTimes(1);
+    expect(getLocale()).toBe(before);
   });
 });
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

**File**: `packages/web-vue/components/locale/lang/id-id.ts` (modified, +48/-0)
```diff
@@ -147,6 +147,54 @@ const lang: ArcoLang = {
     collapse: 'Melipat',
     expand: 'Membuka',
   },
+  form: {
+    validateMessages: {
+      required: '#{field} wajib diisi',
+      type: {
+        string: '#{field} bukan teks yang valid',
+        number: '#{field} bukan angka yang valid',
+        boolean: '#{field} bukan nilai boolean yang valid',
+        array: '#{field} bukan array yang valid',
+        object: '#{field} bukan objek yang valid',
+        url: '#{field} bukan URL yang valid',
+        email: '#{field} bukan alamat email yang valid',
+        ip: '#{field} bukan alamat IP yang valid',
+      },
+      number: {
+        min: '`#{value}` lebih kecil dari nilai minimum `#{min}`',
+        max: '`#{value}` lebih besar dari nilai maksimum `#{max}`',
+        equal: '`#{value}` tidak sama dengan `#{equal}`',
+        range: '`#{value}` tidak berada dalam rentang `#{min} ~ #{max}`',
+        positive: '`#{value}` bukan angka positif',
+        negative: '`#{value}` bukan angka negatif',
+      },
+      array: {
+        length: 'Jumlah `#{field}` tidak sama dengan #{length}',
+        minLength: 'Jumlah `#{field}` minimal #{minLength}',
+        maxLength: 'Jumlah `#{field}` maksimal #{maxLength}',
+        includes: '#{field} tidak mengandung #{includes}',
+        deepEqual: '#{field} tidak sama dengan #{deepEqual}',
+        empty: '`#{field}` bukan array kosong',
+      },
+      string: {
+        minLength: 'Jumlah karakter minimal #{minLength}',
+        maxLength: 'Jumlah karakter maksimal #{maxLength}',
+        length: 'Jumlah karakter harus #{length}',
+        match: '`#{value}` tidak sesuai pola #{pattern}',
+        uppercase: '`#{value}` harus seluruhnya huruf kapital',
+        lowercase: '`#{value}` harus seluruhnya huruf kecil',
+      },
+      object: {
+        deepEqual: '`#{field}` tidak sama dengan nilai yang diharapkan',
+        hasKeys: '`#{field}` tidak mengandung field yang wajib',
+        empty: '`#{field}` bukan objek',
+      },
+      boolean: {
+        true: 'Nilai yang diharapkan adalah `true`',
+        false: 'Nilai yang diharapkan adalah `false`',
+      },
+    },
+  },
   colorPicker: {
     history: 'Warna sejarah',
     preset: 'Sistem preset warna',
```

**File**: `packages/web-vue/components/locale/lang/it-it.ts` (modified, +49/-0)
```diff
@@ -147,6 +147,55 @@ const lang: ArcoLang = {
     collapse: 'Piega',
     expand: 'Espandi',
   },
+  form: {
+    validateMessages: {
+      required: '#{field} è obbligatorio',
+      type: {
+        string: '#{field} non è un testo valido',
+        number: '#{field} non è un numero valido',
+        boolean: '#{field} non è un valore booleano valido',
+        array: '#{field} non è un array valido',
+        object: '#{field} non è un oggetto valido',
+        url: '#{field} non è un URL valido',
+        email: '#{field} non è un indirizzo email valido',
+        ip: '#{field} non è un indirizzo IP valido',
+      },
+      number: {
+        min: '`#{value}` è inferiore al valore minimo `#{min}`',
+        max: '`#{value}` è superiore al valore massimo `#{max}`',
+        equal: '`#{value}` non è uguale a `#{equal}`',
+        range: "`#{value}` non rientra nell'intervallo `#{min} ~ #{max}`",
+        positive: '`#{value}` non è un numero positivo',
+        negative: '`#{value}` non è un numero negativo',
+      },
+      array: {
+        length: 'Il numero di `#{field}` non è uguale a #{length}',
+        minLength: 'Il numero di `#{field}` deve essere almeno #{minLength}',
+        maxLength:
+          'Il numero di `#{field}` deve essere al massimo #{maxLength}',
+        includes: '#{field} non contiene #{includes}',
+        deepEqual: '#{field} non è uguale a #{deepEqual}',
+        empty: '`#{field}` non è un array vuoto',
+      },
+      string: {
+        minLength: 'Il numero di caratteri deve essere almeno #{minLength}',
+        maxLength: 'Il numero di caratteri deve essere al massimo #{maxLength}',
+        length: 'Il numero di caratteri deve essere #{length}',
+        match: '`#{value}` non corrisponde al pattern #{pattern}',
+        uppercase: '`#{value}` deve essere tutto in maiuscolo',
+        lowercase: '`#{value}` deve essere tutto in minuscolo',
+      },
+      object: {
+        deepEqual: '`#{field}` non è uguale al valore previsto',
+        hasKeys: '`#{field}` non contiene i campi obbligatori',
+        empty: '`#{field}` non è un oggetto',
+      },
+      boolean: {
+        true: 'Il valore atteso è `true`',
+        false: 'Il valore atteso è `false`',
+      },
+    },
+  },
   colorPicker: {
     history: 'Colori storici',
     preset: 'Colori preimpostati dal sistema',
```

**File**: `packages/web-vue/components/locale/lang/km-kh.ts` (modified, +48/-0)
```diff
@@ -146,6 +146,54 @@ const lang: ArcoLang = {
     collapse: 'បង្រួម',
     edit: 'កែសម្រួល',
   },
+  form: {
+    validateMessages: {
+      required: 'ត្រូវបំពេញ #{field}',
+      type: {
+        string: '#{field} មិនមែនជាអត្ថបទត្រឹមត្រូវ',
+        number: '#{field} មិនមែនជាលេខត្រឹមត្រូវ',
+        boolean: '#{field} មិនមែនជាតម្លៃប៊ូលីនត្រឹមត្រូវ',
+        array: '#{field} មិនមែនជាបញ្ជីទិន្នន័យត្រឹមត្រូវ',
+        object: '#{field} មិនមែនជាវត្ថុទិន្នន័យត្រឹមត្រូវ',
+        url: '#{field} មិនមែនជា URL ត្រឹមត្រូវ',
+        email: '#{field} មិនមែនជា​អ៊ីមែល​ត្រឹមត្រូវ',
+        ip: '#{field} មិនមែនជា​អាសយដ្ឋាន IP ត្រឹមត្រូវ',
+      },
+      number: {
+        min: '`#{value}` តូចជាងតម្លៃអប្បបរមា `#{min}`',
+        max: '`#{value}` ធំជាងតម្លៃអតិបរមា `#{max}`',
+        equal: '`#{value}` មិនស្មើ `#{equal}`',
+        range: '`#{value}` មិនស្ថិតក្នុងចន្លោះ `#{min} ~ #{max}`',
+        positive: '`#{value}` មិនមែនជាលេខវិជ្ជមាន',
+        negative: '`#{value}` មិនមែនជាលេខអវិជ្ជមាន',
+      },
+      array: {
+        length: 'ចំនួន `#{field}` មិនស្មើ #{length}',
+        minLength: 'ចំនួន `#{field}` តិចបំផុតត្រូវជា #{minLength}',
+        maxLength: 'ចំនួន `#{field}` អតិបរមាត្រូវជា #{maxLength}',
+        includes: '#{field} មិនមាន #{includes}',
+        deepEqual: '#{field} មិនស្មើ #{deepEqual}',
+        empty: '`#{field}` មិនមែនជា array ទទេ',
+      },
+      string: {
+        minLength: 'ចំនួនតួអក្សរតិចបំផុតត្រូវជា #{minLength}',
+        maxLength: 'ចំនួនតួអក្សរអតិបរមាត្រូវជា #{maxLength}',
+        length: 'ចំនួនតួអក្សរត្រូវជា #{length}',
+        match: '`#{value}` មិនត្រូវនឹងលំនាំ #{pattern}',
+        uppercase: '`#{value}` ត្រូវជាអក្សរធំទាំងអស់',
+        lowercase: '`#{value}` ត្រូវជាអក្សរតូចទាំងអស់',
+      },
+      object: {
+        deepEqual: '`#{field}` មិនស្មើតម្លៃដែលរំពឹងទុក',
+        hasKeys: '`#{field}` មិនមានវាលដែលត្រូវការ',
+        empty: '`#{field}` មិនមែនជាវត្ថុទិន្នន័យ',
+      },
+      boolean: {
+        true: 'តម្លៃដែលរំពឹងទុកគឺ `true`',
+        false: 'តម្លៃដែលរំពឹងទុកគឺ `false`',
+      },
+    },
+  },
   colorPicker: {
     history: 'ប្រវត្តិពណ៌',
     preset: 'ពណ៌កំណត់ជាមុន',
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
+          <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#boundary\\">Scroll Boundary</a>
+            <!--v-if-->
+          </li>
+          <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#hash\\">Hash mode</a>
+            <!--v-if-->
+          </li>
+        </ul>
+      </li>
+    </ul>
   </div>
 </div>"
 `;
 
 exports[`<anchor> demo: render [boundary] correctly 1`] = `
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
-        <li class=\\"arco-anchor-link-item\\"><a class=\\"arco-anchor-link\\" href=\\"#affix\\"> Affix 
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

---

### Incident Patch 11: `1ed094fc` (2026-04-22)
**Commit Message**: feat(button): 新增 loadingFixedWidth 和 autoInsertSpaceInButton 属性

- 为 Button 组件新增 `loadingFixedWidth` 属性，用于在加载状态时保持按钮宽度不变
- 在 ConfigProvider 中新增 `autoInsertSpaceInButton` 全局配置，当按钮文本为两个中文字符时自动插入空格以优化视觉间距
- 更新相关文档、测试用例和演示示例

**File**: `packages/web-vue/components/button/README.en-US.md` (modified, +1/-2)
```diff
@@ -28,7 +28,6 @@ description: Button is a command component that can initiate an instant operatio
 
 ## API
 
-
 ### `<button>` Props
 
 |Attribute|Description|Type|Default|
@@ -39,6 +38,7 @@ description: Button is a command component that can initiate an instant operatio
 |size|Button size|`'mini' \| 'small' \| 'medium' \| 'large'`|`'medium'`|
 |long|Whether the width of the button adapts to the container.|`boolean`|`false`|
 |loading|Whether the button is in the loading state|`boolean`|`false`|
+|loading-fixed-width|The width of the button remains unchanged on loading.|`boolean`|`false`|
 |disabled|Whether the button is disabled|`boolean`|`false`|
 |html-type|Set the native `type` attribute of `button`, optional values refer to [HTML](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-type "_blank")|`HTMLButtonElement['type']`|`'button'`|
 |autofocus|Set the native `autofocus` attribute of `button`, optional values refer to [HTML](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-type "_blank")|`boolean`|`false`|
@@ -67,4 +67,3 @@ description: Button is a command component that can initiate an instant operatio
 |size|Children button size|`'mini' \| 'small' \| 'medium' \| 'large'`|`-`|
 |disabled|All children whether the button is disabled|`boolean`|`false`|
 
-
```

**File**: `packages/web-vue/components/button/README.zh-CN.md` (modified, +1/-2)
```diff
@@ -26,7 +26,6 @@ description: 按钮是一种命令组件，可发起一个即时操作。
 
 ## API
 
-
 ### `<button>` Props
 
 |参数名|描述|类型|默认值|
@@ -37,6 +36,7 @@ description: 按钮是一种命令组件，可发起一个即时操作。
 |size|按钮的尺寸|`'mini' \| 'small' \| 'medium' \| 'large'`|`'medium'`|
 |long|按钮的宽度是否随容器自适应。|`boolean`|`false`|
 |loading|按钮是否为加载中状态|`boolean`|`false`|
+|loading-fixed-width|当 loading 的时候，不改变按钮的宽度。|`boolean`|`false`|
 |disabled|按钮是否禁用|`boolean`|`false`|
 |html-type|设置 `button` 的原生 `type` 属性，可选值参考 [HTML标准](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-type "_blank")|`HTMLButtonElement['type']`|`'button'`|
 |autofocus|设置 `button` 的原生 `autofocus` 属性，可选值参考 [HTML标准](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-type "_blank")|`boolean`|`false`|
@@ -65,4 +65,3 @@ description: 按钮是一种命令组件，可发起一个即时操作。
 |size|按钮的尺寸|`'mini' \| 'small' \| 'medium' \| 'large'`|`-`|
 |disabled|全部子按钮是否禁用|`boolean`|`false`|
 
-
```

**File**: `packages/web-vue/components/button/__demo__/loading.md` (modified, +72/-16)
```diff
@@ -7,57 +7,113 @@ title:
 ## zh-CN
 
 通过设置 `loading` 可以让按钮处于加载中状态。处于加载中状态的按钮不会触发点击事件。
+通过设置 `loading-fixed-width` 可以在加载中时保持按钮宽度不变。
 
 ---
 
 ## en-US
 
 The button can be in the loading state by setting `loading`. The button in the loading state will not trigger the `click` event.
+By setting `loading-fixed-width`, the button width remains unchanged during loading.
 
 ---
 
 ```vue
 <template>
-  <a-space>
-    <a-button type="primary" loading>Primary</a-button>
-    <a-button loading>Default</a-button>
-    <a-button type="dashed" loading>Dashed</a-button>
-    <a-button type="primary" :loading="loading1" @click="handleClick1">Click Me</a-button>
-    <a-button type="primary" :loading="loading2" @click="handleClick2">
+  <div>
+    <div :style="gridStyle">
+      <a-button type="primary" loading>Loading</a-button>
+      <a-button loading>Loading</a-button>
+      <a-button type="dashed" loading>Loading</a-button>
+      <a-button type="primary" shape="circle" loading />
+      <a-button shape="circle" loading />
+      <a-button type="dashed" shape="circle" loading />
+    </div>
+    <a-button
+      type="primary"
+      :loading="loading1"
+      style="margin: 24px"
+      @click="handleClick1"
+    >
+      Click Me
+    </a-button>
+    <a-button
+      type="primary"
+      :loading="loading2"
+      style="margin: 24px"
+      @click="handleClick2"
+    >
       <template #icon>
         <icon-plus />
       </template>
       Click Me
     </a-button>
-  </a-space>
+    <a-divider style="width: 440px; min-width: 440px">
+      loading fixed width
+    </a-divider>
+    <a-button
+      type="primary"
+      loading-fixed-width
+      :loading="loading3"
+      style="margin: 24px"
+      @click="handleClick3"
+    >
+      Search
+    </a-button>
+  </div>
 </template>
 
 <script>
 import { ref } from 'vue';
 import { IconPlus } from '@arco-design/web-vue/es/icon';
 
+const triggerLoading = (stateRef) => {
+  if (stateRef.value) {
+    return;
+  }
+  stateRef.value = true;
+  setTimeout(() => {
+    stateRef.value = false;
+  }, 4000);
+};
+
 export default {
   components: {
-    IconPlus
+    IconPlus,
   },
   setup() {
     const loading1 = ref(false);
     const loading2 = ref(false);
+    const loading3 = ref(false);
+
+    const gridStyle = {
+      display: 'grid',
+      gridTemplateColumns: 'repeat(3, 100px)',
+      rowGap: '24px',
+      columnGap: '24px',
+      marginLeft: '24px',
+    };
 
     const handleClick1 = () => {
-      loading1.value = !loading1.value
-    }
+      triggerLoading(loading1);
+    };
     const handleClick2 = () => {
-      loading2.value = !loading2.value
-    }
+      triggerLoading(loading2);
+    };
+    const handleClick3 = () => {
+      triggerLoading(loading3);
+    };
 
     return {
       loading1,
       loading2,
+      loading3,
+      gridStyle,
       handleClick1,
-      handleClick2
-    }
-  }
-}
+      handleClick2,
+      handleClick3,
+    };
+  },
+};
 </script>
 ```
```

**File**: `packages/web-vue/components/button/__test__/__snapshots__/demo.test.ts.snap` (modified, +7/-13)
```diff
@@ -196,19 +196,13 @@ exports[`<button> demo: render [icon] correctly 1`] = `
 `;
 
 exports[`<button> demo: render [loading] correctly 1`] = `
-"<div class=\\"arco-space arco-space-horizontal arco-space-align-center\\" style=\\"column-gap: 8px; row-gap: 8px;\\">
-  <!---->
-  <div class=\\"arco-space-item\\"><button class=\\"arco-btn arco-btn-primary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal arco-btn-loading\\" type=\\"button\\"><span class=\\"arco-btn-icon\\"><svg viewBox=\\"0 0 48 48\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\" stroke=\\"currentColor\\" class=\\"arco-icon arco-icon-loading arco-icon-spin\\" stroke-width=\\"4\\" stroke-linecap=\\"butt\\" stroke-linejoin=\\"miter\\"><path d=\\"M42 24c0 9.941-8.059 18-18 18S6 33.941 6 24 14.059 6 24 6\\"></path></svg></span>Primary</button></div>
-  <!---->
-  <div class=\\"arco-space-item\\"><button class=\\"arco-btn arco-btn-secondary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal arco-btn-loading\\" type=\\"button\\"><span class=\\"arco-btn-icon\\"><svg viewBox=\\"0 0 48 48\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\" stroke=\\"currentColor\\" class=\\"arco-icon arco-icon-loading arco-icon-spin\\" stroke-width=\\"4\\" stroke-linecap=\\"butt\\" stroke-linejoin=\\"miter\\"><path d=\\"M42 24c0 9.941-8.059 18-18 18S6 33.941 6 24 14.059 6 24 6\\"></path></svg></span>Default</button></div>
-  <!---->
-  <div class=\\"arco-space-item\\"><button class=\\"arco-btn arco-btn-dashed arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal arco-btn-loading\\" type=\\"button\\"><span class=\\"arco-btn-icon\\"><svg viewBox=\\"0 0 48 48\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\" stroke=\\"currentColor\\" class=\\"arco-icon arco-icon-loading arco-icon-spin\\" stroke-width=\\"4\\" stroke-linecap=\\"butt\\" stroke-linejoin=\\"miter\\"><path d=\\"M42 24c0 9.941-8.059 18-18 18S6 33.941 6 24 14.059 6 24 6\\"></path></svg></span>Dashed</button></div>
-  <!---->
-  <div class=\\"arco-space-item\\"><button class=\\"arco-btn arco-btn-primary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal\\" type=\\"button\\">
-      <!--v-if-->Click Me
-    </button></div>
-  <!---->
-  <div class=\\"arco-space-item\\"><button class=\\"arco-btn arco-btn-primary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal\\" type=\\"button\\"><span class=\\"arco-btn-icon\\"><svg viewBox=\\"0 0 48 48\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\" stroke=\\"currentColor\\" class=\\"arco-icon arco-icon-plus\\" stroke-width=\\"4\\" stroke-linecap=\\"butt\\" stroke-linejoin=\\"miter\\"><path d=\\"M5 24h38M24 5v38\\"></path></svg></span> Click Me </button></div>
+"<div>
+  <div style=\\"display: grid; grid-template-columns: repeat(3, 100px); row-gap: 24px; column-gap: 24px; margin-left: 24px;\\"><button class=\\"arco-btn arco-btn-primary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal arco-btn-loading\\" type=\\"button\\"><span class=\\"arco-btn-icon\\"><svg viewBox=\\"0 0 48 48\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\" stroke=\\"currentColor\\" class=\\"arco-icon arco-icon-loading arco-icon-spin\\" stroke-width=\\"4\\" stroke-linecap=\\"butt\\" stroke-linejoin=\\"miter\\"><path d=\\"M42 24c0 9.941-8.059 18-18 18S6 33.941 6 24 14.059 6 24 6\\"></path></svg></span>Loading</button><button class=\\"arco-btn arco-btn-secondary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal arco-btn-loading\\" type=\\"button\\"><span class=\\"arco-btn-icon\\"><svg viewBox=\\"0 0 48 48\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\" stroke=\\"currentColor\\" class=\\"arco-icon arco-icon-loading arco-icon-spin\\" stroke-width=\\"4\\" stroke-linecap=\\"butt\\" stroke-linejoin=\\"miter\\"><path d=\\"M42 24c0 9.941-8.059 18-18 18S6 33.941 6 24 14.059 6 24 6\\"></path></svg></span>Loading</button><button class=\\"arco-btn arco-btn-dashed arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal arco-btn-loading\\" type=\\"button\\"><span class=\\"arco-btn-icon\\"><svg viewBox=\\"0 0 48 48\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\" stroke=\\"currentColor\\" class=\\"arco-icon arco-icon-loading arco-icon-spin\\" stroke-width=\\"4\\" stroke-linecap=\\"butt\\" stroke-linejoin=\\"miter\\"><path d=\\"M42 24c0 9.941-8.059 18-18 18S6 33.941 6 24 14.059 6 24 6\\"></path></svg></span>Loading</button><button class=\\"arco-btn arco-btn-primary arco-btn-shape-circle arco-btn-size-medium arco-btn-status-normal arco-btn-loading\\" type=\\"button\\"><span class=\\"arco-btn-icon\\"><svg viewBox=\\"0 0 48 48\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\" stroke=\\"currentColor\\" class=\\"arco-icon arco-icon-loading arco-icon-spin\\" stroke-width=\\"4\\" stroke-linecap=\\"butt\\" stroke-linejoin=\\"miter\\"><path d=\\"M42 24c0 9.941-8.059 18-18 18S6 33.941 6 24 14.059 6 24 6\\"></path></svg></span></button><button class=\\"arco
```

**File**: `packages/web-vue/components/button/__test__/index.test.ts` (modified, +35/-0)
```diff
@@ -1,5 +1,6 @@
 import { mount } from '@vue/test-utils';
 import Button from '../index';
+import { configProviderInjectionKey } from '../../config-provider/context';
 
 describe('Button', () => {
   test('should emit click event', () => {
@@ -19,4 +20,38 @@ describe('Button', () => {
 
     expect(wrapper.emitted('click')).toBeUndefined();
   });
+
+  test('should add loading fixed width class when loadingFixedWidth is true', () => {
+    const wrapper = mount(Button, {
+      props: {
+        loading: true,
+        loadingFixedWidth: true,
+      },
+    });
+
+    expect(wrapper.find('button').classes()).toContain(
+      'arco-btn-loading-fixed-width'
+    );
+  });
+
+  test('should add two chinese chars class when autoInsertSpaceInButton is enabled', async () => {
+    const wrapper = mount(Button, {
+      global: {
+        provide: {
+          [configProviderInjectionKey as symbol]: {
+            autoInsertSpaceInButton: true,
+          },
+        },
+      },
+      slots: {
+        default: '测试',
+      },
+    });
+
+    await wrapper.vm.$nextTick();
+
+    expect(wrapper.find('button').classes()).toContain(
+      'arco-btn-two-chinese-chars'
+    );
+  });
 });
```

**File**: `packages/web-vue/components/button/button.vue` (modified, +57/-7)
```diff
@@ -1,6 +1,7 @@
 <template>
   <template v-if="href">
     <a
+      ref="buttonRef"
       :class="[
         cls,
         { [`${prefixCls}-only-icon`]: $slots.icon && !$slots.default },
@@ -12,11 +13,13 @@
         <icon-loading v-if="loading" spin />
         <slot v-else name="icon" />
       </span>
-      <slot />
+      <slot v-if="!isTwoCNChar" />
+      <span v-else><slot /></span>
     </a>
   </template>
   <template v-else>
     <button
+      ref="buttonRef"
       :class="[
         cls,
         { [`${prefixCls}-only-icon`]: $slots.icon && !$slots.default },
@@ -30,18 +33,23 @@
         <icon-loading v-if="loading" :spin="true" />
         <slot v-else name="icon" />
       </span>
-      <slot />
+      <slot v-if="!isTwoCNChar" />
+      <span v-else><slot /></span>
     </button>
   </template>
 </template>
 
 <script lang="ts">
-/**
- * @todo 添加loadingFixedWidth
- * @todo 添加twoChineseChars
- */
 import type { PropType } from 'vue';
-import { defineComponent, computed, toRefs, inject } from 'vue';
+import {
+  defineComponent,
+  computed,
+  toRefs,
+  inject,
+  ref,
+  onMounted,
+  onUpdated,
+} from 'vue';
 import { Status, Size, BorderShape } from '../_utils/constant';
 import { ButtonTypes } from './constants';
 import { getPrefixCls } from '../_utils/global-config';
@@ -50,6 +58,9 @@ import IconLoading from '../icon/icon-loading';
 import { useSize } from '../_hooks/use-size';
 import { useFormItem } from '../_hooks/use-form-item';
 import { buttonGroupInjectionKey } from './context';
+import { configProviderInjectionKey } from '../config-provider/context';
+
+const regexTwoCNChar = /^[\u4e00-\u9fa5]{2}$/;
 
 export default defineComponent({
   name: 'Button',
@@ -106,6 +117,14 @@ export default defineComponent({
       type: Boolean,
       default: false,
     },
+    /**
+     * @zh 当 loading 的时候，不改变按钮的宽度。
+     * @en The width of the button remains unchanged on loading.
+     */
+    loadingFixedWidth: {
+      type: Boolean,
+      default: false,
+    },
     /**
      * @zh 按钮是否禁用
      * @en Whether the button is disabled
@@ -152,7 +171,11 @@ export default defineComponent({
   setup(props, { emit }) {
     const { size, disabled } = toRefs(props);
     const prefixCls = getPrefixCls('btn');
+    const configContext = inject(configProviderInjectionKey, undefined);
     const groupContext = inject(buttonGroupInjectionKey, undefined);
+    const autoInsertSpaceInButton = computed(() =>
+      Boolean(configContext?.autoInsertSpaceInButton)
+    );
     const _size = computed(() => size.value ?? groupContext?.size);
     const _disabled = computed(() =>
       Boolean(disabled.value || groupContext?.disabled)
@@ -162,6 +185,28 @@ export default defineComponent({
       disabled: _disabled,
     });
     const { mergedSize } = useSize(_mergedSize);
+    const buttonRef = ref<HTMLAnchorElement | HTMLButtonElement>();
+    const isTwoCNChar = ref(false);
+
+    const updateIsTwoCNChar = () => {
+      if (!autoInsertSpaceInButton.value) {
+        if (isTwoCNChar.value) {
+          isTwoCNChar.value = false;
+        }
+        return;
+      }
+
+      const textContent =
+        buttonRef.value?.textContent?.replace(/\s/g, '') ?? '';
+      const value = regexTwoCNChar.test(textContent);
+
+      if (value !== isTwoCNChar.value) {
+        isTwoCNChar.value = value;
+      }
+    };
+
+    onMounted(updateIsTwoCNChar);
+    onUpdated(updateIsTwoCNChar);
 
     const cls = computed(() => [
       prefixCls,
@@ -172,8 +217,11 @@ export default defineComponent({
       {
         [`${prefixCls}-long`]: props.long,
         [`${prefixCls}-loading`]: props.loading,
+        [`${prefixCls}-loading-fixed-width`]: props.loadingFixedWidth,
         [`${prefixCls}-disabled`]: mergedDisabled.value,
         [`${prefixCls}-link`]: isString(props.href),
+        [`${prefixCls}-two-chinese-chars`]:
+          autoInsertSpaceInButton.value && isTwoCNChar.value,
       },
     ]);
 
@@ -188,6 +236,8 @@ export default defineComponent({
     return {
       prefixCls,
       cls,
+      buttonRef,
+      isTwoCNChar,
       mergedDisabled,
       handleClick,
     };
```

**File**: `packages/web-vue/components/button/interface.ts` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ export interface ButtonProps {
   size?: Size;
   long?: boolean;
   loading?: boolean;
+  loadingFixedWidth?: boolean;
   disabled?: boolean;
   htmlType?: string;
   autofocus?: boolean;
```

**File**: `packages/web-vue/components/config-provider/README.en-US.md` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ description: Configure in the outermost layer of the application, set once, and
 |prefix-cls|Component classname prefix|`string`|`'arco'`||
 |locale|Configure language pack|`ArcoLang`|`-`||
 |size|Size|`Size`|`-`|2.14.0|
+|auto-insert-space-in-button|When there are two Chinese characters in the button, a space is automatically added between two Chinese characters.|`boolean`|`false`||
 |global|Is global effect|`boolean`|`false`|2.25.0|
 |scroll-to-close|Whether to close the popover when scrolling|`boolean`|`false`|2.46.0|
 |exchange-time|Whether to exchange time|`boolean`|`true`|2.48.0|
```

---

### Incident Patch 12: `a19694d9` (2026-04-18)
**Commit Message**: feat(date-picker): 新增 inputProps 与 fixedTime 属性并支持自定义面板头部格式

- 为 DatePicker 和 RangePicker 组件新增 inputProps 属性，允许向原生输入框传递属性
- 为 RangePicker 组件新增 fixedTime 属性，用于固定时间不参与排序
- 在 locale 接口中新增 yearFormat 和 monthFormat 字段，支持自定义面板头部显示格式
- 更新工具函数 getSortedDayjsArray 以支持 fixedTime 逻辑

**File**: `packages/web-vue/components/_components/picker/input-range.vue` (modified, +73/-7)
```diff
@@ -6,14 +6,17 @@
     <div :class="getInputWrapClassName(0)">
       <input
         ref="refInput0"
+        v-bind="nativeInputProps0"
         :disabled="disabled0"
+        :readonly="readonly"
         :placeholder="placeholder[0]"
         :value="displayValue0"
-        v-bind="readonly ? { readonly: true } : {}"
         @input="onChange"
         @keydown.enter="onPressEnter"
         @keydown.tab="onPressTab"
-        @click="() => changeFocusedInput(0)"
+        @click="(e) => changeFocusedInput(0, e)"
+        @focus="(e) => onFocus(e, 0)"
+        @blur="(e) => onBlur(e, 0)"
       />
     </div>
     <span :class="`${prefixCls}-separator`">
@@ -22,14 +25,17 @@
     <div :class="getInputWrapClassName(1)">
       <input
         ref="refInput1"
+        v-bind="nativeInputProps1"
         :disabled="disabled1"
+        :readonly="readonly"
         :placeholder="placeholder[1]"
         :value="displayValue1"
-        v-bind="readonly ? { readonly: true } : {}"
         @input="onChange"
         @keydown.enter="onPressEnter"
         @keydown.tab="onPressTab"
-        @click="() => changeFocusedInput(1)"
+        @click="(e) => changeFocusedInput(1, e)"
+        @focus="(e) => onFocus(e, 1)"
+        @blur="(e) => onBlur(e, 1)"
       />
     </div>
     <div :class="`${prefixCls}-suffix`">
@@ -102,6 +108,10 @@ export default defineComponent({
     inputValue: {
       type: Array as PropType<string[]>,
     },
+    inputProps: {
+      type: Array as PropType<Record<string, any>[]>,
+      default: () => [],
+    },
     value: {
       type: Array as PropType<(Dayjs | undefined)[]>,
       default: () => [],
@@ -128,6 +138,7 @@ export default defineComponent({
       format,
       focusedIndex,
       inputValue,
+      inputProps,
     } = toRefs(props);
     const {
       mergedSize: _mergedSize,
@@ -187,25 +198,76 @@ export default defineComponent({
 
     const displayValue0 = computed(() => getDisplayValue(0));
     const displayValue1 = computed(() => getDisplayValue(1));
+    const getNativeInputProps = (index: 0 | 1) => {
+      const props = {
+        ...((inputProps?.value?.[index] as Record<string, any>) || {}),
+      };
+      delete props.onInput;
+      delete props.onChange;
+      delete props.onKeydown;
+      delete props.onKeyDown;
+      delete props.onClick;
+      delete props.onFocus;
+      delete props.onBlur;
+      return props;
+    };
+    const nativeInputProps0 = computed(() => getNativeInputProps(0));
+    const nativeInputProps1 = computed(() => getNativeInputProps(1));
+
+    const callInputPropsEvent = (
+      index: number,
+      name: string,
+      ...args: unknown[]
+    ) => {
+      const callback = inputProps?.value?.[index]?.[name];
+      if (isFunction(callback)) {
+        callback(...args);
+      }
+    };
 
-    function changeFocusedInput(index: number) {
+    function changeFocusedInput(index: number, e?: Event) {
       emit('focused-index-change', index);
       emit('update:focusedIndex', index);
+      if (e) {
+        callInputPropsEvent(index, 'onClick', e);
+      }
     }
 
     function onChange(e: Event) {
       e.stopPropagation();
+      if (focusedIndex?.value === 0 || focusedIndex?.value === 1) {
+        callInputPropsEvent(focusedIndex.value, 'onInput', e);
+        callInputPropsEvent(focusedIndex.value, 'onChange', e);
+      }
       emit('change', e);
     }
 
-    function onPressEnter() {
+    function onPressEnter(e: KeyboardEvent) {
+      if (focusedIndex?.value === 0 || focusedIndex?.value === 1) {
+        callInputPropsEvent(focusedIndex.value, 'onKeydown', e);
+        callInputPropsEvent(focusedIndex.value, 'onKeyDown', e);
+      }
       emit('press-enter');
     }
 
-    function onPressTab(e: Event) {
+    function onPressTab(e: KeyboardEvent) {
+      if (focusedIndex?.value === 0 || focusedIndex?.value === 1) {
+        callInputPropsEvent(focusedIndex.value, 'onKeydown', e);
+        callInputPropsEvent(focusedIndex.value, 'onKeyDown', e);
+      }
       e.preventDefault();
     }
 
+    function onFocus(e: Event, index: number) {
+      emit('focused-index-change', index);
+      emit('update:focusedIndex', index);
+      callInputPropsEvent(index, 'onFocus', e);
+    }
+
+    function onBlur(e: Event, index: number) {
+      callInputPropsEvent(index, 'onBlur', e);
+    }
+
     function onClear(e: Event) {
       emit('clear', e);
     }
@@ -222,10 +284,14 @@ export default defineComponent({
       getInputWrapClassName,
       displayValue0,
       displayValue1,
+      nativeInputProps0,
+      nativeInputProps1,
       changeFocusedInput,
       onChange,
       onPressEnter,
       onPressTab,
+      onFocus,
+      onBlur,
       onClear,
       feedback,
     };
```

**File**: `packages/web-vue/components/_components/picker/input.vue` (modified, +44/-4)
```diff
@@ -6,13 +6,15 @@
     <div :class="`${prefixCls}-input`">
       <input
         ref="refInput"
+        v-bind="nativeInputProps"
         :disabled="mergedDisabled"
+        :readonly="readonly"
         :placeholder="placeholder"
         :class="`${prefixCls}-start-time`"
         :value="displayValue"
-        v-bind="readonly ? { readonly: true } : {}"
         @keydown.enter="onPressEnter"
         @input="onChange"
+        @focus="onFocus"
         @blur="onBlur"
       />
     </div>
@@ -73,6 +75,9 @@ export default defineComponent({
     placeholder: {
       type: String,
     },
+    inputProps: {
+      type: Object as PropType<Record<string, any>>,
+    },
     inputValue: {
       type: String,
     },
@@ -86,8 +91,16 @@ export default defineComponent({
   },
   emits: ['clear', 'press-enter', 'change', 'blur'],
   setup(props, { emit, slots }) {
-    const { error, focused, disabled, size, value, format, inputValue } =
-      toRefs(props);
+    const {
+      error,
+      focused,
+      disabled,
+      size,
+      value,
+      format,
+      inputValue,
+      inputProps,
+    } = toRefs(props);
     const {
       mergedSize: _mergedSize,
       mergedDisabled,
@@ -117,26 +130,53 @@ export default defineComponent({
       }
       return undefined;
     });
+    const nativeInputProps = computed(() => {
+      const props = {
+        ...(inputProps?.value || {}),
+      };
+      delete props.onInput;
+      delete props.onChange;
+      delete props.onKeydown;
+      delete props.onKeyDown;
+      delete props.onFocus;
+      delete props.onBlur;
+      return props;
+    });
 
     const refInput = ref<HTMLInputElement>();
+    const callInputPropsEvent = (name: string, ...args: unknown[]) => {
+      const callback = inputProps?.value?.[name];
+      if (isFunction(callback)) {
+        callback(...args);
+      }
+    };
 
     return {
       feedback,
       prefixCls,
       classNames,
       displayValue,
+      nativeInputProps,
       mergedDisabled,
       refInput,
-      onPressEnter() {
+      onPressEnter(e: KeyboardEvent) {
+        callInputPropsEvent('onKeydown', e);
+        callInputPropsEvent('onKeyDown', e);
         emit('press-enter');
       },
       onChange(e: Event) {
+        callInputPropsEvent('onInput', e);
+        callInputPropsEvent('onChange', e);
         emit('change', e);
       },
       onClear(e: Event) {
         emit('clear', e);
       },
+      onFocus(e: Event) {
+        callInputPropsEvent('onFocus', e);
+      },
       onBlur(e: Event) {
+        callInputPropsEvent('onBlur', e);
         emit('blur', e);
       },
     };
```

**File**: `packages/web-vue/components/_utils/date.ts` (modified, +15/-2)
```diff
@@ -86,8 +86,21 @@ export function getNow() {
   return dayjs();
 }
 
-export function getSortedDayjsArray(values: Dayjs[]) {
-  return [...values].sort((a, b) => a.valueOf() - b.valueOf());
+export function getSortedDayjsArray(values: Dayjs[], fixedTime = false) {
+  const sortedValues = [...values].sort((a, b) => a.valueOf() - b.valueOf());
+
+  if (fixedTime && values.length === 2 && values[0] && values[1]) {
+    sortedValues[0] = sortedValues[0]
+      .set('hour', values[0].get('hour'))
+      .set('minute', values[0].get('minute'))
+      .set('second', values[0].get('second'));
+    sortedValues[1] = sortedValues[1]
+      .set('hour', values[1].get('hour'))
+      .set('minute', values[1].get('minute'))
+      .set('second', values[1].get('second'));
+  }
+
+  return sortedValues;
 }
 
 export function isValueChange(
```

**File**: `packages/web-vue/components/date-picker/README.en-US.md` (modified, +6/-0)
```diff
@@ -68,6 +68,7 @@ description: Choose a date. Support year, month, week, day type, support range s
 |trigger-props|You can pass in the parameters of the `Trigger` component|`TriggerProps`|`-`||
 |unmount-on-close|Whether to destroy the DOM structure when hiding|`boolean`|`false`||
 |placeholder|Prompt copy|`string`|`-`||
+|input-props|Native input attributes|`Record<string, any>`|`-`||
 |disabled|Whether to disable|`boolean`|`false`||
 |disabled-date|Unselectable date|`(current?: Date) => boolean`|`-`||
 |disabled-time|Unselectable time|`(current: Date) => DisabledTimeProps`|`-`||
@@ -190,7 +191,9 @@ description: Choose a date. Support year, month, week, day type, support range s
 |disabled-date|Non-selectable date|`(current: Date, type: 'start' \| 'end') => boolean`|`-`||
 |disabled-time|Unselectable time|`(current: Date, type: 'start' \| 'end') => DisabledTimeProps`|`-`||
 |separator|The segmentation symbol in the input box of the range selector|`string`|`-`||
+|input-props|Native input attributes|`Record<string, any>[]`|`[]`||
 |exchange-time|Whether the time will be exchanged, by default time will affect and participate in the ordering of start and end values, if you want to fix the time order, you can turn it off.|`boolean`|`true`|2.25.0|
+|fixed-time|Is it a fixed time?|`boolean`|`false`||
 |disabled-input|Whether input is disabled with the keyboard.|`boolean`|`false`|2.43.0|
 |abbreviation|Whether to enable abbreviation|`boolean`|`true`||
 ### `<range-picker>` Events
@@ -256,5 +259,8 @@ Format|Output|Description
 
 ## FAQ
 
+### Customize year/month format of panel header
+You can configure panel header format through `yearFormat` and `monthFormat` in `locale`.
+
 ### About the `locale` field
 The `locale` field can be configured using the language pack provided by the component library.
```

**File**: `packages/web-vue/components/date-picker/README.zh-CN.md` (modified, +6/-1)
```diff
@@ -66,6 +66,7 @@ description: 选择日期。支持年、月、周、日类型，支持范围选
 |trigger-props|可以传入 `Trigger` 组件的参数|`TriggerProps`|`-`||
 |unmount-on-close|是否在隐藏的时候销毁DOM结构|`boolean`|`false`||
 |placeholder|提示文案|`string`|`-`||
+|input-props|原生输入框属性|`Record<string, any>`|`-`||
 |disabled|是否禁用|`boolean`|`false`||
 |disabled-date|不可选取的日期|`(current?: Date) => boolean`|`-`||
 |disabled-time|不可选取的时间|`(current: Date) => DisabledTimeProps`|`-`||
@@ -188,7 +189,9 @@ description: 选择日期。支持年、月、周、日类型，支持范围选
 |disabled-date|不可选的日期|`(current: Date, type: 'start' \| 'end') => boolean`|`-`||
 |disabled-time|不可选取的时间|`(current: Date, type: 'start' \| 'end') => DisabledTimeProps`|`-`||
 |separator|范围选择器输入框内的分割符号|`string`|`-`||
+|input-props|原生输入框属性|`Record<string, any>[]`|`[]`||
 |exchange-time|时间是否会交换，默认情况下时间会影响和参与开始和结束值的排序，如果要固定时间顺序，可将其关闭。|`boolean`|`true`|2.25.0|
+|fixed-time|是否固定时间|`boolean`|`false`||
 |disabled-input|是否禁止键盘输入日期|`boolean`|`false`|2.43.0|
 |abbreviation|是否启用缩写|`boolean`|`true`||
 ### `<range-picker>` Events
@@ -253,6 +256,8 @@ description: 选择日期。支持年、月、周、日类型，支持范围选
 
 ## FAQ
 
+### 自定义面板头部的年份和月份格式
+可以通过 `locale` 中的 `yearFormat` 和 `monthFormat` 字段配置面板头部显示格式。
+
 ### 关于 `locale` 字段
 可以使用组件库提供的语言包配置 `locale` 字段。
-
```

**File**: `packages/web-vue/components/date-picker/interface.ts` (modified, +3/-0)
```diff
@@ -100,6 +100,7 @@ export interface BasePickerProps {
   defaultPopupVisible: boolean;
   triggerProps?: Record<string, unknown>;
   unmountOnClose: boolean;
+  inputProps?: Record<string, any>;
   valueFormat?: ValueFormat;
   previewShortcut: boolean;
   showConfirm?: boolean;
@@ -131,6 +132,8 @@ export interface RangePickerProps extends BasePickerProps {
   disabledTime?: RangeDisabledTime;
   separator?: string;
   exchangeTime: boolean;
+  inputProps?: Record<string, any>[];
+  fixedTime?: boolean;
 }
 
 export interface Cell {
```

**File**: `packages/web-vue/components/date-picker/panels/header.vue` (modified, +11/-2)
```diff
@@ -67,6 +67,7 @@ import IconDoubleLeft from '../../icon/icon-double-left';
 import IconDoubleRight from '../../icon/icon-double-right';
 import { HeaderIcons, Mode } from '../interface';
 import RenderFunction from '../../_components/render-function';
+import useDatePickerTransform from '../hooks/use-inject-datepicker-transform';
 
 type ClickCallbackFunc = (payload: MouseEvent) => void;
 
@@ -118,19 +119,27 @@ export default defineComponent({
   },
   emits: ['label-click'],
   setup(props) {
+    const datePickerT = useDatePickerTransform();
+    const getLocaleFormat = (key: string, defaultFormat: string) => {
+      const format = datePickerT(key);
+      return typeof format === 'string' && format !== key
+        ? format
+        : defaultFormat;
+    };
+
     return {
       showPrev: computed(() => isFunction(props.onPrev)),
       showSuperPrev: computed(() => isFunction(props.onSuperPrev)),
       showNext: computed(() => isFunction(props.onNext)),
       showSuperNext: computed(() => isFunction(props.onSuperNext)),
       year: computed(() =>
         ['date', 'quarter', 'month', 'week'].includes(props.mode) && props.value
-          ? props.value.format('YYYY')
+          ? props.value.format(getLocaleFormat('datePicker.yearFormat', 'YYYY'))
           : ''
       ),
       month: computed(() =>
         ['date', 'week'].includes(props.mode) && props.value
-          ? props.value.format('MM')
+          ? props.value.format(getLocaleFormat('datePicker.monthFormat', 'MM'))
           : ''
       ),
       getIconClassName: (show?: boolean) => [
```

**File**: `packages/web-vue/components/date-picker/picker.vue` (modified, +8/-0)
```diff
@@ -27,6 +27,7 @@
         :readonly="!inputEditable || disabledInput"
         :allow-clear="allowClear && !readonly"
         :placeholder="computedPlaceholder"
+        :input-props="inputProps"
         :input-value="inputValue"
         :value="needConfirm ? panelValue : selectedValue"
         :format="inputFormat"
@@ -223,6 +224,13 @@ export default defineComponent({
     placeholder: {
       type: String,
     },
+    /**
+     * @zh 原生输入框属性
+     * @en Native input attributes
+     */
+    inputProps: {
+      type: Object as PropType<Record<string, any>>,
+    },
     /**
      * @zh 是否禁用
      * @en Whether to disable
```

---

### Incident Patch 13: `46301476` (2026-01-06)
**Commit Message**: fix(date-picker): Add a disabled date function and optimize the date checking logic (#3630)

* feat(date-picker): Add a disabled date function and optimize the date checking logic

* refactor(date-picker): Optimize the logic for checking the disabled range of dates

* refactor(date-picker): optimize isDisabledDate for clarity and performance

---------

Co-authored-by: ljc <[REDACTED_EMAIL]>

**File**: `packages/web-vue/components/date-picker/panels/body.vue` (modified, +2/-5)
```diff
@@ -63,10 +63,10 @@
 import { Dayjs } from 'dayjs';
 import { computed, defineComponent, PropType, reactive, toRefs } from 'vue';
 import type { Cell, DisabledDate, IsSameTime, Mode } from '../interface';
-import { isFunction } from '../../_utils/is';
 import useCellClassName from '../hooks/use-cell-class-name';
 import RenderFunction, { RenderFunc } from '../../_components/render-function';
 import { getDateValue } from '../../_utils/date';
+import { isDisabledDate } from '../utils';
 
 export default defineComponent({
   name: 'PanelBody',
@@ -118,10 +118,7 @@ export default defineComponent({
     );
 
     const isCellDisabled = (cellData: Cell) =>
-      !!(
-        isFunction(disabledDate?.value) &&
-        disabledDate?.value(getDateValue(cellData.value))
-      );
+      isDisabledDate(cellData.value, disabledDate?.value, mode?.value);
 
     return {
       isWeek: computed(() => mode?.value === 'week'),
```

**File**: `packages/web-vue/components/date-picker/picker-panel.vue` (modified, +2/-0)
```diff
@@ -8,6 +8,7 @@
           :header-value="headerPanelHeaderValue"
           :header-icons="headerIcons"
           :header-operations="headerPanelHeaderOperations"
+          :disabled-date="disabledDate"
           @select="onHeaderPanelSelect"
         />
         <MonthPanel
@@ -16,6 +17,7 @@
           :header-icons="headerIcons"
           :header-operations="headerPanelHeaderOperations"
           :abbreviation="abbreviation"
+          :disabled-date="disabledDate"
           @select="onHeaderPanelSelect"
           @header-label-click="onMonthHeaderLabelClick"
         />
```

**File**: `packages/web-vue/components/date-picker/utils/index.ts` (modified, +51/-2)
```diff
@@ -1,7 +1,6 @@
 import { Dayjs } from 'dayjs';
-import { dayjs } from '../../_utils/date';
 import { isArray, isDayjs, isUndefined } from '../../_utils/is';
-import { CalendarValue } from '../interface';
+import { CalendarValue, DisabledDate, Mode } from '../interface';
 
 export function newArray<T>(length: number) {
   return [...Array<T>(length)];
@@ -42,3 +41,53 @@ export function mergeValueWithTime(
     .set('month', dateVal.month())
     .set('date', dateVal.date());
 }
+
+export function isDisabledDate(
+  cellDate: Dayjs,
+  disabledDate?: DisabledDate,
+  mode: Mode = 'date'
+): boolean {
+  if (typeof disabledDate !== 'function') return false;
+
+  const checkDate = (date: Dayjs) => disabledDate(date.toDate());
+
+  switch (mode) {
+    case 'date':
+    case 'week':
+      return checkDate(cellDate);
+
+    case 'month': {
+      const days = cellDate.daysInMonth();
+      for (let d = 1; d <= days; d++) {
+        if (!checkDate(cellDate.date(d))) return false;
+      }
+      return true;
+    }
+
+    case 'quarter': {
+      const startMonth = Math.floor(cellDate.month() / 3) * 3;
+      for (let m = startMonth; m < startMonth + 3; m++) {
+        const monthDate = cellDate.month(m);
+        const days = monthDate.daysInMonth();
+        for (let d = 1; d <= days; d++) {
+          if (!checkDate(monthDate.date(d))) return false;
+        }
+      }
+      return true;
+    }
+
+    case 'year': {
+      for (let m = 0; m < 12; m++) {
+        const monthDate = cellDate.month(m);
+        const days = monthDate.daysInMonth();
+        for (let d = 1; d <= days; d++) {
+          if (!checkDate(monthDate.date(d))) return false;
+        }
+      }
+      return true;
+    }
+
+    default:
+      return false;
+  }
+}
```

---

### Incident Patch 14: `1b73699b` (2025-04-03)
**Commit Message**: fix(tabs): Fixed an issue where ink cannot be followed when switching… (#3485)

* fix(tabs): Fixed an issue where ink cannot be followed when switching rtl

* fix(tabs): modify the way inkRef is defined

**File**: `packages/web-vue/components/config-provider/__demo__/rtl.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ Set the component to a view that reads from right to left.
       </template>
     </a-switch>
     <a-config-provider :rtl="rtlType">
-      <a-tabs default-active-key="2" style="margin-bottom: 20px;">
+      <a-tabs :default-active-key="2" style="margin-bottom: 20px;">
         <a-tab-pane
           v-for="i in 36"
           :key="i"
```

**File**: `packages/web-vue/components/tabs/tabs-nav-ink.vue` (modified, +6/-2)
```diff
@@ -12,7 +12,6 @@ import {
   onUpdated,
   ref,
   toRefs,
-  watch,
 } from 'vue';
 import { getPrefixCls } from '../_utils/global-config';
 import { Direction } from '../_utils/constant';
@@ -29,7 +28,7 @@ export default defineComponent({
     disabled: Boolean,
     animation: Boolean,
   },
-  setup(props) {
+  setup(props, { expose }) {
     const { activeTabRef } = toRefs(props);
     const prefixCls = getPrefixCls('tabs-nav-ink');
     const position = ref(0);
@@ -81,7 +80,12 @@ export default defineComponent({
       },
     ]);
 
+    expose({
+      getInkStyle,
+    });
+
     return {
+      getInkStyle,
       prefixCls,
       cls,
       style,
```

**File**: `packages/web-vue/components/tabs/tabs-nav.tsx` (modified, +4/-2)
```diff
@@ -1,5 +1,4 @@
 import {
-  ComponentPublicInstance,
   computed,
   defineComponent,
   nextTick,
@@ -96,7 +95,7 @@ export default defineComponent({
     const isRtlHorizontal = computed(
       () => rtl.value && direction.value === 'horizontal'
     );
-    const inkRef = ref<ComponentPublicInstance>();
+    const inkRef = ref<InstanceType<typeof TabsNavInk>>();
 
     const mergedEditable = computed(
       () =>
@@ -269,6 +268,9 @@ export default defineComponent({
     watch([activeIndex, scrollPosition, rtl], () => {
       setTimeout(() => {
         setActiveTabOffset();
+        if (inkRef.value) {
+          inkRef.value.getInkStyle();
+        }
       }, 0);
     });
 
```

---

### Incident Patch 15: `f606ae8e` (2025-04-02)
**Commit Message**: refactor(space): 使用css gap属性，重构space组件 (#3477)

* refactor: 使用css gap属性，重构space组件

* fix: space.tsx

* fix: space.tsx优化

**File**: `packages/web-vue/components/space/__demo__/split.md` (modified, +19/-3)
```diff
@@ -20,12 +20,28 @@ Set separators for adjacent child elements.
 <template>
   <a-space>
     <template #split>
-      <a-divider direction="vertical" />
+      <a-divider direction="vertical" :margin="0" />
     </template>
-    <a-tag v-if="false" color='arcoblue'>Tag</a-tag>
     <a-button type="primary">Item1</a-button>
+    <a-tag v-if="show" color='arcoblue'>Tag</a-tag>
     <a-button type="primary">Item2</a-button>
-    <a-switch defaultChecked />
+    <a-button type="primary">Item3</a-button>
+    <a-switch v-model="show"/>
+  </a-space>
+  <a-divider />
+  <a-space>
+    <template #split>
+      <a-divider direction="vertical" :margin="0" />
+    </template>
+    <a-link type="primary">Link1</a-link>
+    <a-link type="primary">Link2</a-link>
+    <a-link type="primary">Link3</a-link>
   </a-space>
 </template>
+
+<script setup>
+import { ref } from 'vue'
+
+const show = ref(false)
+</script>
 ```
```

**File**: `packages/web-vue/components/space/space.tsx` (modified, +12/-38)
```diff
@@ -84,7 +84,7 @@ export default defineComponent({
       },
     ]);
 
-    function getMargin(size: SpaceSize) {
+    function getSize(size: SpaceSize) {
       if (isNumber(size)) {
         return size;
       }
@@ -102,59 +102,33 @@ export default defineComponent({
       }
     }
 
-    const getMarginStyle = (isLast: boolean): CSSProperties => {
+    const getSpaceStyle = computed(() => {
       const style: CSSProperties = {};
+      const sizeArray = isArray(props.size)
+        ? props.size
+        : [props.size, props.size];
+      const [colGap, rowGap] = sizeArray.map(getSize);
 
-      const marginSize = `${getMargin(
-        isArray(props.size) ? props.size[0] : props.size
-      )}px`;
-      const marginBottom = `${getMargin(
-        isArray(props.size) ? props.size[1] : props.size
-      )}px`;
-
-      if (isLast) {
-        return props.wrap ? { marginBottom } : {};
-      }
-
-      if (props.direction === 'horizontal') {
-        if (rtl.value) {
-          style.marginLeft = marginSize;
-        } else {
-          style.marginRight = marginSize;
-        }
-      }
-      if (props.direction === 'vertical' || props.wrap) {
-        style.marginBottom = marginBottom;
-      }
-
+      style.columnGap = `${colGap}px`;
+      style.rowGap = `${rowGap}px`;
       return style;
-    };
+    });
 
     return () => {
       const children = getAllElements(slots.default?.(), true).filter(
         (item) => item.type !== Comment
       );
 
       return (
-        <div class={cls.value}>
+        <div class={cls.value} style={getSpaceStyle.value}>
           {children.map((child, index) => {
             const shouldRenderSplit = slots.split && index > 0;
             return (
               <Fragment key={child.key ?? `item-${index}`}>
                 {shouldRenderSplit && (
-                  <div
-                    class={`${prefixCls}-item-split`}
-                    style={getMarginStyle(false)}
-                  >
-                    {slots.split?.()}
-                  </div>
+                  <div class={`${prefixCls}-item-split`}>{slots.split?.()}</div>
                 )}
-                <div
-                  class={`${prefixCls}-item`}
-                  style={getMarginStyle(index === children.length - 1)}
-                >
-                  {child}
-                </div>
+                <div class={`${prefixCls}-item`}>{child}</div>
               </Fragment>
             );
           })}
```

**File**: `packages/web-vue/components/space/style/index.less` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@
 .@{space-prefix-cls} {
   display: inline-flex;
 
+  .@{space-prefix-cls}-item:empty {
+    display: none;
+  }
+
   &-horizontal {
     .@{space-prefix-cls}-item {
       display: flex;
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
