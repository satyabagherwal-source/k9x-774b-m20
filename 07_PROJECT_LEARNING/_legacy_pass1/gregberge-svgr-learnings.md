# Forensic Learning Record (Deep Inspection): gregberge/svgr

> **Canonical Artifact**: `07_PROJECT_LEARNING/gregberge-svgr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gregberge/svgr](https://github.com/gregberge/svgr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:15.015Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gregberge/svgr`
- **Description**: Transform SVGs into React components 🦁
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11061 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `__fixtures__/custom-index-template.js`
```
const path = require('path')

function indexTemplate(files) {
  const exportEntries = files.map(({path: file}) => {
    const basename = path.basename(file, path.extname(file))
    return `export { ${basename} } from './${basename}';`
  })
  return exportEntries.join('\n')
}

module.exports = indexTemplate

```

### Core Architecture Module: `__fixtures__/custom-index.config.js`
```
const indexTemplate = require('./custom-index-template.js')

function template(
  { imports, componentName, props, jsx, exports },
  { tpl }
) {
  return tpl`${imports}
export function ${componentName}(${props}) {
  return ${jsx};
}
`
}

module.exports = {
  template,
  indexTemplate,
}

```

### Core Architecture Module: `__fixtures__/overrides.config.js`
```
module.exports = {
  expandProps: false,
  dimensions: false,
  svgo: false,
  prettier: false,
}

```

### Core Architecture Module: `__fixtures__/simple-existing/File..js`
```
import * as React from 'react'

function SvgFile(props) {
  return (
    <svg width={48} height={1} {...props}>
      <path d="M0 0h48v1H0z" fill="#063855" fillRule="evenodd" />
    </svg>
  )
}

export default SvgFile

```

### Core Architecture Module: `__fixtures__/simple-existing/File.js`
```
// nothing
```

### Core Architecture Module: `__fixtures__/simple-existing/index..js`
```
export { default as File } from './File'
```

### Core Architecture Module: `__fixtures__/template.js`
```
module.exports = () => (code, state) => `
import * as React from 'react'

export default function ${state.componentName}() {
  return ${code}
}
`

```

### Core Architecture Module: `__fixtures__/withSvgoConfig/svgo.config.js`
```
module.exports = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeTitle: false,
        },
      },
    },
  ]
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1015** (2025-10-05): **chore: update next.mdx to align with Next.js 15 Turbopack changes**
  *Symptoms*: Please merge this PR — bc it was quite challenging for me to find it for the first time.   
  **Post-Mortem & Fix Analysis**:
  > @vipulkumar-dev is attempting to deploy a commit to the **Greg Berg's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Greg%20Berg's%20projects&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22359b86ef0baf3ff00ecf8bdec5e47df6f4023476%22%7D%2C%22id%22%3A%22Qmb9WEHBq57p4yW46dBaj8zXDyysZEga6tWR7D1RhTdNXp%22%2C%22org%22%3A%22gregberge%22%2C%22prId%22%3A1015%2C%22repo%22%3A%22svgr%22%7D).  

- **Issue #1010** (2025-08-26): **[docs] update index-template API Override docs**
  *Symptoms*: <!-- Thanks for submitting a pull request! Please provide enough information so that others can review your pull request. The two fields below are mandatory. -->  ## Summary  <!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? --> in fact, the `@svgr/cli` can accept indexTemplate option, but marked as `not available` on docs  ## Test plan  <!-- Demonstrate the code is solid. Example: The exact commands you ran and their output, screenshots / videos if the pull request changes UI. --> 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #qRAMqTHlTgXQdn/W2gKrB6IpJvX5ArWCtca73hIDN7Q=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdmdyIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2dyZWctYmVyZ3MtcHJvamVjdHMvc3Znci9FZkQ0QzR3SkF2cENDWTZQWTN6ZGZjVk5UcmFrIiwicHJldmlld1VybCI6InN2Z3ItZ2l0LWZvcmstc2hvd29ubmUtcGF0Y2gtMS1ncmVnLWJlcmdzLXByb2plY3RzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoic3Znci1naXQtZm9yay1zaG93b25uZS1wYXRjaC0xLWdyZWctYmVyZ3MtcHJvamVjdHMudmVyY2VsLmFwcCJ9LCJyb290RGlyZWN0b3J5IjoiYXBpIn1dfQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | [svgr](https://vercel.com/greg-bergs-projects/svgr) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/greg-bergs-projects/svgr/EfD4C4wJAvpC

- **Issue #1003** (2025-10-24): **docs: add Turbopack configuration instructions to Next.js documentation**
  *Symptoms*: ## Summary  This PR adds documentation about using SVGR with Next.js when using Turbopack as the bundler. While SVGR already works with Next.js using webpack, there are specific configuration requirements when using Turbopack that weren't previously documented. This addition will help developers who are migrating to Turbopack or starting new Next.js projects with Turbopack to properly integrate SVGR for SVG imports.  ## Test plan  I've verified these instructions in a Next.js project using Turbopack by: 1. Setting up a basic Next.js project with Turbopack enabled 2. Implementing the configuration as documented 3. Successfully importing and rendering SVG files as React components  The documentation accurately reflects the steps needed to make SVGR work properly in this environment. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #H08N54m8zL2OdxllflQD366zSdPm6m+bgCHIcTtSnb0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdmdyIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2dyZWctYmVyZ3MtcHJvamVjdHMvc3Znci84Tk40V0s4MnUzcXlkU0Z0NEs5TjZROFRVSEtGIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sInJvb3REaXJlY3RvcnkiOiJhcGkifV19 **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | **svgr** | ❌ Failed ([Inspect](https://vercel.com/greg-bergs-projects/svgr/8NN4WK82u3qydSFt4K9N6Q8TUHKF)) |  |  | May 18, 2025 7:36am |  

- **Issue #1001** (2025-05-10): **Remove unknown attributes for Krita editor**
  *Symptoms*: Please, remove all `krita:` atributes for all tags, by example:  ``` <text       krita:textVersion={3}       krita:useRichText="true"       fill="#44546a"       stroke="#000" ```  This attributes are generated by Krita is used by Krita but is not in the SVG or ReactJS. This attribute generate a warning in the React project.  The SVG: https://github.com/user-attachments/assets/20bb4ee8-4ee4-4b76-9b06-1a49ed7752d9
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this!  We can resolve this in SVGO directly, so I'll migrate your issue over to [svg/svgo](https://github.com/svg/svgo).  For a workaround you can do immediately, SVGO already allows you to specify additional editor namespaces you'd like to remove. You can do this by overriding the [SVGO config option](https://github.com/gregberge/svgr/blob/main/website/pages/docs/options.mdx#svgo-config) to something like:  ```js {   plugins: [     'preset-default',     {       name: 'removeEditorsNSData',       params: {         additionalNamespaces: [ 'http://krita.org/namespaces/svg/krita' ]       },     },   ], }; ```  I did check just in case, and can confirm the result looks visually identical on Firefox.  I've created an issue in svg/SVGO, and we can make this the default behavior in the next release:  * https://github.com/svg/svgo/issues/2130

- **Issue #996** (2025-03-13): **Next.js SVG Configuration: Unable to apply custom colors to SVGs with dual import strategy**
  *Symptoms*: **Summary** I'm trying to implement a dual SVG import strategy in Next.js where some SVGs retain their original colors and others can be customized with Tailwind classes. Despite configuring webpack with separate rules for colorable and non-colorable SVGs, I can't get custom colors to apply.  GOAL: when custom color is not passed keep original color, otherwise show custom colored svg  **Additional information** ``` /** @type {import('next').NextConfig} */ import createNextIntlPlugin from 'next-intl/plugin'; import path from 'path'; import { fileURLToPath } from 'url'; const __dirname = path.dirname(fileURLToPath(import.meta.url)); const withNextIntl = createNextIntlPlugin();  const nextConfig = {   webpack(config, { isServer }) {     if (!isServer) {       config.resolve.alias['yjs'] = path.resolve(__dirname, 'node_modules/yjs');     }     const fileLoaderRule = config.module.rules.find((rule) =>       rule.test?.test?.('.svg'),     );      // Rule for URL imports     config.module.rules.push({       ...fileLoaderRule,       test: /\.svg$/i,       resourceQuery: /url/,     });      // Rule for colorable SVGs     config.module.rules.push({       test: /\.svg$/i,       resourceQuery: /colorable/,       use: [         {           loader: '@svgr/webpack',           options: {             svgo: true,             svgoConfig: {               plugins: [                 {                   name: 'removeViewBox',                   active: false,                 },                 {    
  **Post-Mortem & Fix Analysis**:
  > After some reasearch I have found out the solution, which says to create `svgrrc.json` file in root and add this code. Leaving here in case some needs ``` {     "dimensions": false,     "svgoConfig": {       "plugins": [         "removeDimensions",         {           "name": "convertColors",           "params": {             "currentColor": true           }         },         {           "name": "preset-default",           "params": {             "overrides": {               "removeTitle": false             }           }         }       ]     }   } ```

- **Issue #995** (2025-03-14): **Svgr declaration is being overwritten by Next JS ts(2604)**
  *Symptoms*:  ## 🐛 Bug Report **Ts error : JSX element type '...' does not have any construct or call signatures.** TypeScript declarations for SVG imports are not being properly recognized in a Next.js project. When importing SVG files, TypeScript shows them as string paths (`${string}.svg`) instead of React components as defined in the custom type declarations.    ## To Reproduce 1. Set up a Next.js project with TypeScript 2. Add custom SVG type declarations to a `.d.ts` file:    ```typescript    declare module '*.svg' {      import { FC, SVGProps } from 'react';      const content: FC<SVGProps<SVGElement>>;      export default content;    }     declare module '*.svg?url' {      const content: any;      export default content;    }    ``` 3. Include the declaration file in `tsconfig.json` 4. Import an SVG in a component: `import login from '@/public/icons/login.svg';` 5. Observe that TypeScript shows the incorrect type:     ```    (alias) module login    (alias) var login: `${string}.svg`    import login    ```    Instead of:    ```    (alias) const login: any    import login    ``` 6. tsconfig.json ```   "include": [     "svgr.d.ts",     "**/*.ts",     "**/*.mjs",     "**/*.tsx",     "**/*.jsx",     "**/*.d.ts",     "next-env.d.ts",     ".next/types/**/*.ts"   ], ```  ## Expected behavior TypeScript should recognize SVG imports according to the custom type declarations, showing them as React components with the proper typing.    ## Additional context - The issue persists despite prope
  **Post-Mortem & Fix Analysis**:
  > @salahbm What was the fix for this?
  > @iwasrobbed  1. remove .next folder 2. make sure svgr.d.ts located in the root folder 3.     "**/*.d.ts locate this after svgr.d.ts in the tsconfig  I cant say smth was wrong here in my code, just removed folders and restarted `Typescript` helped me

- **Issue #991** (2025-02-27): **glob upgraded to v11, v8 is deprecated**
  *Symptoms*: glob v8 is currently depricated, this PR upgrade glob to latest v11.  <!-- Thanks for submitting a pull request! Please provide enough information so that others can review your pull request. The two fields below are mandatory. -->  ## Summary  <!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? -->  ## Test plan  <!-- Demonstrate the code is solid. Example: The exact commands you ran and their output, screenshots / videos if the pull request changes UI. --> 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #vVOH9Ydf3PtMPe6s5Tp+0cwkB5zwEbuLtAEBbzSm0gQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdmdyIiwicm9vdERpcmVjdG9yeSI6ImFwaSIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9ncmVnLWJlcmdzLXByb2plY3RzL3N2Z3IvQWFkUHFwem1CRmtFWWlKeDZhWDQ3d2JrZVhNSCIsInByZXZpZXdVcmwiOiJzdmdyLWdpdC1mb3JrLXNoaXZhbWtqLW1haW4tZ3JlZy1iZXJncy1wcm9qZWN0cy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6InN2Z3ItZ2l0LWZvcmstc2hpdmFta2otbWFpbi1ncmVnLWJlcmdzLXByb2plY3RzLnZlcmNlbC5hcHAifX1dfQ== **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | **svgr** | ✅ Ready ([Inspect](https://vercel.com/greg-bergs-projects/svgr/AadPqpzmBFkEYiJx6aX47wbkeXMH)) | [Visit Preview](https://svgr-git-fork-shivamkj-main-greg-bergs-projects.verc

- **Issue #988** (2025-01-01): **Revert "Update LICENSE, fix copyright license year"**
  *Symptoms*: Reverts gregberge/svgr#987
  **Post-Mortem & Fix Analysis**:
  > [vc]: #PMY/YBMNNib12++HBrxeECNlqHwYUciA7yyxoeMjmBA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzdmdyIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2dyZWctYmVyZ3MtcHJvamVjdHMvc3Znci9CUnpuUVh0N3cyaFB0SmhvV0VDN1R6NkE0dldRIiwicHJldmlld1VybCI6InN2Z3ItZ2l0LXJldmVydC05ODctbWFpbi1ncmVnLWJlcmdzLXByb2plY3RzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiUEVORElORyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJzdmdyLWdpdC1yZXZlcnQtOTg3LW1haW4tZ3JlZy1iZXJncy1wcm9qZWN0cy52ZXJjZWwuYXBwIn19XX0= **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | **svgr** | 🔄 Building ([Inspect](https://vercel.com/greg-bergs-projects/svgr/BRznQXt7w2hPtJhoWEC7Tz6A4vWQ)) | [Visit Preview](https://svgr-git-revert-987-main-greg-bergs-projects.vercel.app) | 💬 [**Add feedback**](https:/

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

### Incident Patch 1: `6b329ac8` (2025-01-01)
**Commit Message**: Revert "Update LICENSE, fix license year (#987)" (#988)

This reverts commit bd70f5aab39bde7beb401c9f9444fa418097079c.

**File**: `LICENSE` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-Copyright 2025 Smooth Code
+Copyright 2017 Smooth Code
 
 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
```

---

### Incident Patch 2: `bd70f5aa` (2025-01-01)
**Commit Message**: Update LICENSE, fix license year (#987)

**File**: `LICENSE` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-Copyright 2017 Smooth Code
+Copyright 2025 Smooth Code
 
 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
```

---

### Incident Patch 3: `0ae0413e` (2023-11-22)
**Commit Message**: docs: fix build

**File**: `website/netlify.toml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 [build]
   base = "website/"
   publish = "public/"
-  command = "npm run build"
\ No newline at end of file
+  command = "npm ci && npm run build"
\ No newline at end of file
```

---

### Incident Patch 4: `0111cf58` (2023-11-22)
**Commit Message**: docs: fix website deployment



---

### Incident Patch 5: `f73f14d8` (2023-09-28)
**Commit Message**: fix: check for type imports in transform-react-native-svg (#907)

Signed-off-by: Yash Srivastav <yashsriv@meta.com>

**File**: `packages/babel-plugin-transform-react-native-svg/src/index.test.ts` (modified, +25/-0)
```diff
@@ -26,4 +26,29 @@ describe('plugin', () => {
       <Svg><G /></Svg>;"
     `)
   })
+
+  it('should add deal with type imports properly', () => {
+    const code = transform(
+      `
+      import Svg from 'react-native-svg';
+      import type { SvgProps } from "react-native-svg";
+
+      const ComponentSvg = () => <svg><g /></svg>;
+    `,
+      {
+        plugins: [
+          '@babel/plugin-syntax-jsx',
+          ['@babel/plugin-syntax-typescript', { isTSX: true }],
+          plugin,
+        ],
+        configFile: false,
+      },
+    )?.code
+
+    expect(code).toMatchInlineSnapshot(`
+      "import Svg, { G } from 'react-native-svg';
+      import type { SvgProps } from "react-native-svg";
+      const ComponentSvg = () => <Svg><G /></Svg>;"
+    `)
+  })
 })
```

**File**: `packages/babel-plugin-transform-react-native-svg/src/index.ts` (modified, +5/-1)
```diff
@@ -79,9 +79,13 @@ const plugin = () => {
 
   const importDeclarationVisitor = {
     ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
+      const isNotTypeImport =
+        !path.get('importKind').hasNode() ||
+        path.node.importKind == null ||
+        path.node.importKind === 'value'
       if (
         path.get('source').isStringLiteral({ value: 'react-native-svg' }) &&
-        !path.get('importKind').hasNode()
+        isNotTypeImport
       ) {
         state.replacedComponents.forEach((component) => {
           if (
```

---

### Incident Patch 6: `571d5c8b` (2023-08-15)
**Commit Message**: fix(cli): fix default dimensions, prettier & svgo

**File**: `packages/cli/src/__snapshots__/index.test.ts.snap` (modified, +3/-8)
```diff
@@ -7,14 +7,9 @@ export { default as File } from './File'
 `;
 
 exports[`cli should not override config with cli defaults 1`] = `
-"import * as React from 'react'
-const SvgFile = () => (
-  <svg xmlns="http://www.w3.org/2000/svg" width={48} height={1}>
-    <path fill="#063855" fillRule="evenodd" d="M0 0h48v1H0z" />
-  </svg>
-)
-export default SvgFile
-
+"import * as React from "react";
+const SvgFile = () => <svg viewBox="0 0 48 1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"><title>{"Rectangle 5"}</title><desc>{"Created with Sketch."}</desc><defs /><g id="Page-1" stroke="none" strokeWidth={1} fill="none" fillRule="evenodd"><g id="19-Separator" transform="translate(-129.000000, -156.000000)" fill="#063855"><g id="Controls/Settings" transform="translate(80.000000, 0.000000)"><g id="Content" transform="translate(0.000000, 64.000000)"><g id="Group" transform="translate(24.000000, 56.000000)"><g id="Group-2"><rect id="Rectangle-5" x={25} y={36} width={48} height={1} /></g></g></g></g></g></g></svg>;
+export default SvgFile;
 "
 `;
 
```

**File**: `packages/cli/src/index.ts` (modified, +3/-0)
```diff
@@ -199,6 +199,9 @@ async function run() {
   }
 
   const programOpts = noUndefinedKeys(program.opts<Options>())
+  if (programOpts.dimensions) delete programOpts.dimensions
+  if (programOpts.svgo) delete programOpts.svgo
+  if (programOpts.prettier) delete programOpts.prettier
   const opts = (await loadConfig(programOpts, {
     filePath: process.cwd(),
   })) as Options
```

---

### Incident Patch 7: `8b972484` (2023-08-15)
**Commit Message**: fix(config): prefer cli config over rc config (#845)

**File**: `packages/core/src/config.ts` (modified, +2/-2)
```diff
@@ -119,7 +119,7 @@ export const loadConfig = async (
     state.filePath && baseConfig.runtimeConfig !== false
       ? await resolveConfig(state.filePath, configFile)
       : {}
-  return { ...DEFAULT_CONFIG, ...rcConfig, ...baseConfig }
+  return { ...DEFAULT_CONFIG, ...baseConfig, ...rcConfig }
 }
 
 loadConfig.sync = (
@@ -130,5 +130,5 @@ loadConfig.sync = (
     state.filePath && baseConfig.runtimeConfig !== false
       ? resolveConfig.sync(state.filePath, configFile)
       : {}
-  return { ...DEFAULT_CONFIG, ...rcConfig, ...baseConfig }
+  return { ...DEFAULT_CONFIG, ...baseConfig, ...rcConfig }
 }
```

---

### Incident Patch 8: `e612b6a1` (2023-08-15)
**Commit Message**: fix(react-native): fix duplicate import (#894)

When updating the imports of react-native-svg there is no check on the importKind. This would cause a wrong update import and a crash in the cli.

**File**: `packages/babel-plugin-transform-react-native-svg/src/index.ts` (modified, +4/-1)
```diff
@@ -79,7 +79,10 @@ const plugin = () => {
 
   const importDeclarationVisitor = {
     ImportDeclaration(path: NodePath<t.ImportDeclaration>, state: State) {
-      if (path.get('source').isStringLiteral({ value: 'react-native-svg' })) {
+      if (
+        path.get('source').isStringLiteral({ value: 'react-native-svg' }) &&
+        !path.get('importKind').hasNode()
+      ) {
         state.replacedComponents.forEach((component) => {
           if (
             path
```

---

### Incident Patch 9: `2e052554` (2023-05-09)
**Commit Message**: fix: fix peer dependencies

**File**: `packages/plugin-jsx/package.json` (modified, +1/-1)
```diff
@@ -44,6 +44,6 @@
     "@types/svg-parser": "^2.0.3"
   },
   "peerDependencies": {
-    "@svgr/core": "workspace:*"
+    "@svgr/core": "*"
   }
 }
```

**File**: `packages/plugin-prettier/package.json` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@
     "prepublishOnly": "pnpm run reset && pnpm run build"
   },
   "peerDependencies": {
-    "@svgr/core": "workspace:*"
+    "@svgr/core": "*"
   },
   "dependencies": {
     "deepmerge": "^4.3.1",
```

**File**: `packages/plugin-svgo/package.json` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@
     "prepublishOnly": "pnpm run reset && pnpm run build"
   },
   "peerDependencies": {
-    "@svgr/core": "workspace:*"
+    "@svgr/core": "*"
   },
   "dependencies": {
     "cosmiconfig": "^8.1.3",
```

---

### Incident Patch 10: `60bb15fb` (2023-04-05)
**Commit Message**: Merge pull request #848 from await-ovo/fix-parse-object

**File**: `website/src/components/playground/config/settings.js` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ const parseObject = (value) =>
     const [left, right] = assignment.split('=')
     return {
       ...obj,
-      [left.trim()]: right.trim(),
+      [left.trim()]: right?.trim(),
     }
   }, {})
 
```

#### Recent Merged Pull Requests:
- **PR #1015** (2025-10-05): chore: update next.mdx to align with Next.js 15 Turbopack changes (@vipulkumar-dev)
- **PR #1010** (2025-08-26): [docs] update index-template API Override docs (@showonne)
- **PR #1003** (closed): docs: add Turbopack configuration instructions to Next.js documentation (@jiaming0708)
- **PR #991** (closed): glob upgraded to v11, v8 is deprecated (@shivamkj)
- **PR #988** (2025-01-01): Revert "Update LICENSE, fix copyright license year" (@gregberge)
- **PR #972** (2024-08-29): docs: update docs about missing api options (@ale-diez)
- **PR #959** (2024-05-03): correct twitter handle link (@knotbin)
- **PR #954** (closed): [CVE-2023-45133] Bump babel-preset-env to fix CVE vulnerability (@Markbags)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
