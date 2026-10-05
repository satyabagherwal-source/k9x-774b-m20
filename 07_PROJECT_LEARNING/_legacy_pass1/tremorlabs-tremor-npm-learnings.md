# Forensic Learning Record (Deep Inspection): tremorlabs/tremor-npm

> **Canonical Artifact**: `07_PROJECT_LEARNING/tremorlabs-tremor-npm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tremorlabs/tremor-npm](https://github.com/tremorlabs/tremor-npm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:25:43.551Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tremorlabs/tremor-npm`
- **Description**: React components to build charts and dashboards
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16488 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.storybook/main.js`
```
var path = require("path");

module.exports = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],

  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-styling-webpack",
    "@storybook/addon-themes",
    "@storybook/addon-a11y",
    {
      name: "@storybook/addon-styling-webpack",
      options: {
        rules: [
          {
            test: /\.css$/,
            sideEffects: true,
            use: [
              require.resolve("style-loader"),
              {
                loader: require.resolve("css-loader"),
                options: {
                  importLoaders: 1,
                },
              },
              {
                loader: require.resolve("postcss-loader"),
                options: {
                  implementation: require.resolve("postcss"),
                },
              },
            ],
          },
        ],
      },
    },
    "@storybook/addon-webpack5-compiler-babel",
    "@chromatic-com/storybook",
  ],

  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },

  features: {
    previewMdx2: true,
  },

  webpackFinal: async (config) => {
    config.resolve.modules = [...(config.resolve.modules || []), path.resolve(__dirname, "../src")];

    return config;
  },

  docs: {},

  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
};

```

### Core Architecture Module: `.storybook/manager.js`
```
import { addons } from "@storybook/manager-api";
import { themes } from "@storybook/theming";
import tremorTheme from "./tremorTheme";

addons.setConfig({
  theme: tremorTheme,
});

```

### Core Architecture Module: `.storybook/preview.js`
```
import "../src/styles.css";
import { withThemeByDataAttribute } from "@storybook/addon-themes";

export const parameters = {
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  backgrounds: {
    default: "light",
    values: [
      {
        name: "light",
        value: "#ffffff",
      },
      {
        name: "dark",
        value: "#0f172a",
      },
    ],
  },
};

export const decorators = [
  withThemeByDataAttribute({
    themes: {
      light: "light",
      dark: "dark",
    },
    defaultTheme: "light",
    attributeName: "data-mode",
  }),
];
export const tags = ["autodocs"];

```

### Core Architecture Module: `.storybook/tremorTheme.js`
```
import { create } from "@storybook/theming/create";

export default create({
  base: "light",
  brandTitle: "Tremor Storybook",
  brandUrl: "https://storybook.tremor.so",
  //   brandImage: 'images/tremor-logo.svg',
  brandTarget: "_self",
  //
  colorSecondary: "#3b82f6",

  // UI
  appBg: "#ffffff",
  appContentBg: "#ffffff",
  //   appBorderColor: '#585C6D',
  appBorderRadius: 0,
  //
  barTextColor: "#9E9E9E",
  barSelectedColor: "#3b82f6",
  barBg: "#ffffff",
});

```

### Core Architecture Module: `babel.config.js`
```
/* eslint-disable no-undef */
module.exports = {
  presets: ["@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript"],
};

```

### Core Architecture Module: `jest.config.js`
```
/* eslint-disable no-undef */
module.exports = {
  testEnvironment: "jsdom",
  moduleDirectories: ["node_modules", "src"],
  moduleNameMapper: {
    ".(css|less|scss)$": "identity-obj-proxy",
    "components/(.*)": "<rootDir>/src/components/$1",
    "assets/(.*)": "<rootDir>/src/assets/$1",
  },
  transformIgnorePatterns: ["<rootDir>/node_modules/(?!react-dnd|dnd-core|@react-dnd)"],
};

```

### Core Architecture Module: `postcss.config.js`
```
/* eslint-disable no-undef */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `rollup.config.js`
```
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

import dts from "rollup-plugin-dts";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import { typescriptPaths } from "rollup-plugin-typescript-paths";
import terser from "@rollup/plugin-terser";
import preserveDirectives from "rollup-plugin-preserve-directives";

const outputOptions = {
  sourcemap: false,
  preserveModules: true,
  preserveModulesRoot: "src",
};

export default [
  {
    input: "src/index.ts",
    output: [
      {
        dir: "dist",
        format: "cjs",
        entryFileNames: "[name].cjs",
        exports: "auto",
        ...outputOptions,
      },
      {
        dir: "dist",
        format: "esm",
        ...outputOptions,
      },
    ],
    external: [/node_modules/],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      preserveDirectives(),
      terser(),
      typescript({
        tsconfig: "./tsconfig.json",
        exclude: ["**/stories/**", "**/tests/**", "./styles.css"],
      }),
      typescriptPaths(),
    ],
  },
  {
    input: "dist/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "esm" }],
    plugins: [dts()],
    external: [/\.css$/],
  },
];

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1150** (2025-01-13): **fix: icon imports**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor-npm/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  Clean up icon imports.  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here to help! --> 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #pEpB6VgqGyAu2bnePh59ldNtoctjSltCWEMPsD6BZss=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci8yZ0tFMVFOelduY3lEUEQ0RTJ4dDdhQ0NNanE0IiwicHJldmlld1VybCI6InRyZW1vci1naXQtZml4LWljb24tdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiUEVORElORyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWZpeC1pY29uLXRyZW1vci52ZXJjZWwuYXBwIn19LHsibmFtZSI6InRyZW1vci1ucG0tc3Rvcnlib29rIiwicm9vdERpcmVjdG9yeSI6bnVsbCwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3ItbnBtLXN0b3J5Ym9vay9IUkpNVHRXQWgyZzVONG51R1pxNTU0cTFMdVdFIiwicHJldmlld1VybCI6InRyZW1vci1ucG0tc3Rvcnlib29rLWdpdC1maXgtaWNvbi10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtZml4LWljb24tdHJlbW9yLnZlcmNlbC5hcHAifX1dfQ==
  > :tada: This PR is included in version 3.18.7 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@tremor/react/v/3.18.7) - [GitHub release](https://github.com/tremorlabs/tremor-npm/releases/tag/v3.18.7)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1149** (2025-01-11): **chore: readme date**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor-npm/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #LqIUukHYvpw8ev8pObBMVFsEHLtZsoQK92K9wqIOszc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci84aUViZTZndmp1RDd0Mm82aXNyQks3VnBGUFFEIiwicHJldmlld1VybCI6InRyZW1vci1naXQtY2hvcmUtcmVhZG1lLWRhdGUtdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoidHJlbW9yLWdpdC1jaG9yZS1yZWFkbWUtZGF0ZS10cmVtb3IudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yLW5wbS1zdG9yeWJvb2svNDVkb2l4VE11RTRVcmJhUW41RVBDcGJMNEc2TiIsInByZXZpZXdVcmwiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtY2hvcmUtcmVhZG1lLWRhdGUtdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoidHJlbW9yLW5wbS1zdG9yeWJvb2stZ2l0LWNob3Jl
  > :tada: This PR is included in version 3.18.7 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@tremor/react/v/3.18.7) - [GitHub release](https://github.com/tremorlabs/tremor-npm/releases/tag/v3.18.7)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1148** (2024-12-28): **chore: update urls**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  Update repository urls.  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here to help! -->  -
  **Post-Mortem & Fix Analysis**:
  > [vc]: #K8vlLfWot2Nxf0TL5WSFDpGVRNTzTqr+f/bIDQCA+GE=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci9HRjlocG9kTENIeGdQMUdSR2l0bk14ejJ4cFp4IiwicHJldmlld1VybCI6InRyZW1vci1naXQtY2hvcmUtdXJscy10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWNob3JlLXVybHMtdHJlbW9yLnZlcmNlbC5hcHAifX0seyJuYW1lIjoidHJlbW9yLW5wbS1zdG9yeWJvb2siLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci1ucG0tc3Rvcnlib29rLzZZMTJOdVBkTjZnN3JwWXFCdEVCYkxzTDVNS0IiLCJwcmV2aWV3VXJsIjoidHJlbW9yLW5wbS1zdG9yeWJvb2stZ2l0LWNob3JlLXVybHMtdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoidHJlbW9yLW5wbS1zdG9yeWJvb2stZ2l0LWNob3JlLXVybHMtdHJlbW9yLnZlcmNlbC5h
  > :tada: This PR is included in version 3.18.7 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@tremor/react/v/3.18.7) - [GitHub release](https://github.com/tremorlabs/tremor-npm/releases/tag/v3.18.7)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1147** (2024-12-22): **chore: sync remote form**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #4pEf1WUU1ClAhKEmdSZRXf7Xodjq8848q7jy278Fwrk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci8zODFEWmhuN1dIS3FINjZHUEZndDF0dWJzejFwIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19LHsibmFtZSI6InRyZW1vci1ucG0tc3Rvcnlib29rIiwicm9vdERpcmVjdG9yeSI6bnVsbCwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3ItbnBtLXN0b3J5Ym9vay80VW5Vd1JyUk11bXR6RW1OVkR1Y3Z4V0RRcDdZIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XX0= **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | **tremor** | ❌ 

- **Issue #1146** (2024-12-28): **Beta tremor v4**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here
  **Post-Mortem & Fix Analysis**:
  > [vc]: #isCFOKlEaTnn22PGIaSO50yxMPAKyir7oG2WS/CSXWc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtYmV0YS10cmVtb3ItdjQtdHJlbW9yLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3ItbnBtLXN0b3J5Ym9vay8zbWRBR1Y4V0ZXWmd1aU1ZQzVEM0tyTTdwUFZ5IiwicHJldmlld1VybCI6InRyZW1vci1ucG0tc3Rvcnlib29rLWdpdC1iZXRhLXRyZW1vci12NC10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6InRyZW1vciIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWJldGEtdHJlbW9yLXY0LXRyZW1vci52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yL0hDSm1LdGp3ODZNZGp6c3F6OFM5eGI4NTZhaFgiLCJwcmV2aWV3VXJsIjoidHJlbW9yLWdpdC1iZXRhLXRyZW1vci12NC10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21t
  > :tada: This PR is included in version 4.0.0-beta-tremor-v4.4 :tada:  The release is available on: - [npm package (@beta-tremor-v4 dist-tag)](https://www.npmjs.com/package/@tremor/react/v/4.0.0-beta-tremor-v4.4) - [GitHub release](https://github.com/tremorlabs/tremor/releases/tag/v4.0.0-beta-tremor-v4.4)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1145** (2024-12-13): **chore: Tremor v4 react19**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here
  **Post-Mortem & Fix Analysis**:
  > [vc]: #cJ6joZ3tMbXtZOKJ3ZZvq2+V7Sztk6Efr+ibX3REEb8=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yLW5wbS1zdG9yeWJvb2svRnZFVTJIN0JIWnFMNG5RaDhFWng0a3NtbkJ2MSIsInByZXZpZXdVcmwiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtdHJlbW9yLXY0LXJlYWN0MTktdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoidHJlbW9yLW5wbS1zdG9yeWJvb2stZ2l0LXRyZW1vci12NC1yZWFjdDE5LXRyZW1vci52ZXJjZWwuYXBwIn19LHsibmFtZSI6InRyZW1vciIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LXRyZW1vci12NC1yZWFjdDE5LXRyZW1vci52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yL0NuZTNDOVpEWEdGU1NCZmhXTmY5ZkpXYjh6WUQiLCJwcmV2aWV3VXJsIjoidHJlbW9yLWdpdC10cmVtb3ItdjQtcmVhY3QxOS10cmVtb3IudmVyY2VsLmFw
  > :tada: This PR is included in version 4.0.0-beta-tremor-v4.3 :tada:  The release is available on: - [npm package (@beta-tremor-v4 dist-tag)](https://www.npmjs.com/package/@tremor/react/v/4.0.0-beta-tremor-v4.3) - [GitHub release](https://github.com/tremorlabs/tremor/releases/tag/v4.0.0-beta-tremor-v4.3)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1144** (2024-12-12): **feat!: Tremor v4**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here
  **Post-Mortem & Fix Analysis**:
  > [vc]: #+XMkrvai7kL7Xr9l+FmMdt6269OqiZlcDMIH5UuWx+s=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtZmVhdC10cmVtb3ItdjQtdml0ZS1zdG9yeWJvb2stdHJlbW9yLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3ItbnBtLXN0b3J5Ym9vay81U1lXcVB4Wlg0aVZVZlFIeTk0d0cybXBTOFZ0IiwicHJldmlld1VybCI6InRyZW1vci1ucG0tc3Rvcnlib29rLWdpdC1mZWF0LXRyZW1vci12NC12aXRlLXN0b3J5Ym9vay10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6InRyZW1vciIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWZlYXQtdHJlbW9yLXY0LXZpdGUtc3Rvcnlib29rLXRyZW1vci52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yLzROM1J5eVcycmRyTm1XVjNrU1JHOVVjRFJFb3UiLCJwcmV2aWV3VXJsIjoidHJlbW9yLWdp

- **Issue #1143** (2024-12-07): **fix: minimum select width**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  This PR adds w-[var(--button-width)] to all select options. **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [x] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to
  **Post-Mortem & Fix Analysis**:
  > [vc]: #uuGMPgPx1wmfEo+DILjQcTkGY6fxOX/p4VsEVe5Tsrc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yLW5wbS1zdG9yeWJvb2svQm45NXp6aFQ5bUF4NDZickdqQ2J3bnhHOGJ3aSIsInByZXZpZXdVcmwiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtZml4LXNlbGVjdC13aWR0aC10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtZml4LXNlbGVjdC13aWR0aC10cmVtb3IudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci9EZjlpVUR6SnJLWmRSa1lXcU50cUJ5ODN5emg2IiwicHJldmlld1VybCI6InRyZW1vci1naXQtZml4LXNlbGVjdC13aWR0aC10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWZpeC1zZWxl
  > :tada: This PR is included in version 3.18.6 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@tremor/react/v/3.18.6) - [GitHub release](https://github.com/tremorlabs/tremor/releases/tag/v3.18.6)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

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

### Incident Patch 1: `7613bff6` (2025-01-13)
**Commit Message**: fix: icon imports (#1150)

**File**: `src/components/icon-elements/Icon/Icon.tsx` (modified, +1/-2)
```diff
@@ -2,8 +2,7 @@
 import React from "react";
 
 import Tooltip, { useTooltip } from "components/util-elements/Tooltip/Tooltip";
-import { makeClassName, mergeRefs, Sizes, tremorTwMerge } from "lib";
-import { Color, IconVariant, Size } from "../../../lib";
+import { makeClassName, mergeRefs, Sizes, tremorTwMerge, Color, IconVariant, Size } from "lib";
 import { getIconColors, iconSizes, shape, wrapperProportions } from "./styles";
 
 const makeIconClassName = makeClassName("Icon");
```

**File**: `src/components/input-elements/Textarea/Textarea.tsx` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 "use client";
+
 import { getSelectButtonColors, hasValue } from "components/input-elements/selectUtils";
 import { useInternalState } from "hooks";
 
```

---

### Incident Patch 2: `252039b4` (2024-12-07)
**Commit Message**: fix: minimum select width (#1143)

**File**: `src/components/input-elements/DatePicker/DatePicker.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 "use client";
-import React, { useMemo } from "react";
 import { tremorTwMerge } from "lib";
+import React, { useMemo } from "react";
 import { DayPickerSingleProps } from "react-day-picker";
 
 import { startOfMonth, startOfToday } from "date-fns";
```

**File**: `src/components/input-elements/MultiSelect/MultiSelect.tsx` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ const MultiSelect = React.forwardRef<HTMLInputElement, MultiSelectProps>((props,
                   anchor="bottom start"
                   className={tremorTwMerge(
                     // common
-                    "z-10 divide-y overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
+                    "z-10 divide-y w-[var(--button-width)] overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
                     // light
                     "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
                     // dark
```

**File**: `src/components/input-elements/SearchSelect/SearchSelect.tsx` (modified, +9/-9)
```diff
@@ -1,7 +1,14 @@
 "use client";
-import React, { isValidElement, useMemo, useRef } from "react";
 import { useInternalState } from "hooks";
+import React, { isValidElement, useMemo, useRef } from "react";
 
+import {
+  Combobox,
+  ComboboxButton,
+  ComboboxInput,
+  ComboboxOptions,
+  Transition,
+} from "@headlessui/react";
 import { ArrowDownHeadIcon, XCircleIcon } from "assets";
 import { makeClassName, tremorTwMerge } from "lib";
 import {
@@ -10,13 +17,6 @@ import {
   getSelectButtonColors,
   hasValue,
 } from "../selectUtils";
-import {
-  Combobox,
-  ComboboxButton,
-  ComboboxInput,
-  ComboboxOptions,
-  Transition,
-} from "@headlessui/react";
 
 const makeSearchSelectClassName = makeClassName("SearchSelect");
 
@@ -237,7 +237,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
                     anchor="bottom start"
                     className={tremorTwMerge(
                       // common
-                      "z-10 divide-y overflow-y-auto outline-none rounded-tremor-default text-tremor-default max-h-[228px] border [--anchor-gap:4px]",
+                      "z-10 divide-y w-[var(--button-width)] overflow-y-auto outline-none rounded-tremor-default text-tremor-default max-h-[228px] border [--anchor-gap:4px]",
                       // light
                       "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
                       // dark
```

**File**: `src/components/input-elements/Select/Select.tsx` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 "use client";
 
-import React, { isValidElement, useMemo, Children, useRef } from "react";
 import { ArrowDownHeadIcon, XCircleIcon } from "assets";
 import { makeClassName, tremorTwMerge } from "lib";
+import React, { Children, isValidElement, useMemo, useRef } from "react";
 import { constructValueToNameMapping, getSelectButtonColors, hasValue } from "../selectUtils";
 
 import { Listbox, ListboxButton, ListboxOptions, Transition } from "@headlessui/react";
@@ -199,7 +199,7 @@ const Select = React.forwardRef<HTMLInputElement, SelectProps>((props, ref) => {
                   anchor="bottom start"
                   className={tremorTwMerge(
                     // common
-                    "z-10 divide-y overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
+                    "z-10 w-[var(--button-width)] divide-y overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
                     // light
                     "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
                     // dark
```

---

### Incident Patch 3: `6e346fcc` (2024-12-07)
**Commit Message**: fix: Upgrade HeadlessUI, new chart tests (#1142)

* fix: bump headlessui

* fix: dialog

* test: uts for areaChart, barChart, sparkAreaChart, Legend (#1065)

* uts for areaChart, barChart, sparkAreaChart, Legend

* removed test code

* lint

---------

Co-authored-by: severinlandolt <sev.landolt@gmail.com>

* fix: datepicker position

* fix: selects

* chore: min width date picker

---------

Co-authored-by: Wajahat5 <66119464+Wajahat5@users.noreply.github.com>

**File**: `.storybook/main.js` (modified, +0/-1)
```diff
@@ -10,7 +10,6 @@ module.exports = {
     "@storybook/addon-styling-webpack",
     "@storybook/addon-themes",
     "@storybook/addon-a11y",
-    "storybook-source-link",
     {
       name: "@storybook/addon-styling-webpack",
       options: {
```

**File**: `package.json` (modified, +19/-20)
```diff
@@ -25,8 +25,7 @@
   "homepage": "https://github.com/tremorlabs/tremor#readme",
   "dependencies": {
     "@floating-ui/react": "^0.19.2",
-    "@headlessui/react": "1.7.19",
-    "@headlessui/tailwindcss": "^0.2.1",
+    "@headlessui/react": "2.2.0",
     "date-fns": "^3.6.0",
     "react-day-picker": "^8.10.1",
     "react-transition-state": "^2.1.2",
@@ -38,7 +37,7 @@
     "@babel/preset-env": "^7.25.4",
     "@babel/preset-react": "^7.24.7",
     "@babel/preset-typescript": "^7.24.7",
-    "@chromatic-com/storybook": "^1.9.0",
+    "@chromatic-com/storybook": "^3.2.2",
     "@mdx-js/react": "^2.3.0",
     "@rollup/plugin-commonjs": "^21.1.0",
     "@rollup/plugin-node-resolve": "^13.3.0",
@@ -47,20 +46,21 @@
     "@semantic-release/commit-analyzer": "^13.0.0",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
-    "@storybook/addon-a11y": "^8.3.3",
-    "@storybook/addon-actions": "^8.3.3",
-    "@storybook/addon-essentials": "^8.3.3",
-    "@storybook/addon-interactions": "^8.3.3",
-    "@storybook/addon-links": "^8.3.3",
-    "@storybook/addon-styling-webpack": "^1.0.0",
-    "@storybook/addon-themes": "^8.3.3",
+    "@storybook/addon-a11y": "^8.4.7",
+    "@storybook/addon-actions": "^8.4.7",
+    "@storybook/addon-essentials": "^8.4.7",
+    "@storybook/addon-interactions": "^8.4.7",
+    "@storybook/addon-links": "^8.4.7",
+    "@storybook/addon-styling-webpack": "^1.0.1",
+    "@storybook/addon-themes": "^8.4.7",
     "@storybook/addon-webpack5-compiler-babel": "^3.0.3",
-    "@storybook/manager-api": "^8.3.3",
+    "@storybook/manager-api": "^8.4.7",
     "@storybook/mdx2-csf": "^1.1.0",
-    "@storybook/react": "^8.3.3",
-    "@storybook/react-webpack5": "^8.3.3",
-    "@storybook/test": "^8.3.3",
-    "@storybook/theming": "^8.3.3",
+    "@storybook/react": "^8.4.7",
+    "@storybook/react-vite": "^8.4.7",
+    "@storybook/react-webpack5": "^8.4.7",
+    "@storybook/test": "^8.4.7",
+    "@storybook/theming": "^8.4.7",
     "@tailwindcss/forms": "^0.5.9",
     "@testing-library/react": "^14.3.1",
     "@types/jest": "^29.5.13",
@@ -84,7 +84,7 @@
     "jest-environment-jsdom": "^29.7.0",
     "postcss": "^8.4.47",
     "postcss-loader": "^7.3.4",
-    "prettier": "3.3.3",
+    "prettier": "3.4.2",
     "prop-types": "^15.8.1",
     "react": "^18.3.1",
     "react-dom": "^18.3.1",
@@ -96,13 +96,12 @@
     "rollup-plugin-preserve-directives": "^0.1.1",
     "rollup-plugin-typescript-paths": "^1.5.0",
     "semantic-release": "^24.1.1",
-    "storybook": "^8.3.3",
-    "storybook-source-link": "^4.0.1",
+    "storybook": "^8.4.7",
     "style-loader": "^3.3.4",
-    "tailwindcss": "^3.4.13",
+    "tailwindcss": "^3.4.16",
     "tslib": "^2.7.0",
     "typescript": "^4.9.5",
-    "webpack": "^5.94.0"
+    "webpack": "^5.97.1"
   },
   "peerDependencies": {
     "react": "^18.0.0",
```

**File**: `src/components/input-elements/DatePicker/DatePicker.tsx` (modified, +7/-7)
```diff
@@ -6,7 +6,7 @@ import { DayPickerSingleProps } from "react-day-picker";
 import { startOfMonth, startOfToday } from "date-fns";
 import { enUS } from "date-fns/locale";
 
-import { Popover, Transition } from "@headlessui/react";
+import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
 import { CalendarIcon, XCircleIcon } from "assets";
 import { Calendar } from "components/input-elements/Calendar";
 import { makeDatePickerClassName } from "components/input-elements/DatePicker/datePickerUtils";
@@ -91,7 +91,7 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
       )}
       {...other}
     >
-      <Popover.Button
+      <PopoverButton
         disabled={disabled}
         className={tremorTwMerge(
           // common
@@ -116,7 +116,7 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
           aria-hidden="true"
         />
         <p className="truncate">{formattedSelection}</p>
-      </Popover.Button>
+      </PopoverButton>
       {isClearEnabled && selectedValue ? (
         <button
           type="button"
@@ -141,18 +141,18 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
         </button>
       ) : null}
       <Transition
-        className="absolute z-10 min-w-min left-0"
         enter="transition ease duration-100 transform"
         enterFrom="opacity-0 -translate-y-4"
         enterTo="opacity-100 translate-y-0"
         leave="transition ease duration-100 transform"
         leaveFrom="opacity-100 translate-y-0"
         leaveTo="opacity-0 -translate-y-4"
       >
-        <Popover.Panel
+        <PopoverPanel
+          anchor="bottom start"
           className={tremorTwMerge(
             // common
-            "divide-y overflow-y-auto outline-none rounded-tremor-default p-3 border my-1",
+            "z-10 min-w-min divide-y overflow-y-auto outline-none rounded-tremor-default p-3 border [--anchor-gap:4px]",
             // light
             "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
             // dark
@@ -178,7 +178,7 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
               enableYearNavigation={enableYearNavigation}
             />
           )}
-        </Popover.Panel>
+        </PopoverPanel>
       </Transition>
     </Popover>
   );
```

**File**: `src/components/input-elements/DateRangePicker/DateRangePicker.tsx` (modified, +21/-13)
```diff
@@ -1,6 +1,5 @@
 "use client";
 
-import { Listbox, Popover, Transition } from "@headlessui/react";
 import { CalendarIcon, XCircleIcon } from "assets";
 import { startOfMonth, startOfToday } from "date-fns";
 import { tremorTwMerge } from "lib";
@@ -26,6 +25,15 @@ import { SelectItem } from "components/input-elements/Select";
 import { enUS } from "date-fns/locale";
 import { useInternalState } from "hooks";
 import { Color } from "../../../lib/inputTypes";
+import {
+  Popover,
+  PopoverButton,
+  Transition,
+  PopoverPanel,
+  Listbox,
+  ListboxButton,
+  ListboxOptions,
+} from "@headlessui/react";
 
 const TODAY = startOfToday();
 
@@ -177,7 +185,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
         )}
       >
         <div className="relative w-full">
-          <Popover.Button
+          <PopoverButton
             onFocus={() => setIsCalendarButtonFocused(true)}
             onBlur={() => setIsCalendarButtonFocused(false)}
             disabled={disabled}
@@ -205,7 +213,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
               aria-hidden="true"
             />
             <p className="truncate">{formattedSelection}</p>
-          </Popover.Button>
+          </PopoverButton>
           {isClearEnabled && selectedStartDate ? (
             <button
               type="button"
@@ -232,19 +240,19 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
           ) : null}
         </div>
         <Transition
-          className="absolute z-10 min-w-min left-0"
           enter="transition ease duration-100 transform"
           enterFrom="opacity-0 -translate-y-4"
           enterTo="opacity-100 translate-y-0"
           leave="transition ease duration-100 transform"
           leaveFrom="opacity-100 translate-y-0"
           leaveTo="opacity-0 -translate-y-4"
         >
-          <Popover.Panel
+          <PopoverPanel
+            anchor="bottom start"
             focus={true}
             className={tremorTwMerge(
               // common
-              "divide-y overflow-y-auto outline-none rounded-tremor-default p-3 border my-1",
+              "min-w-min divide-y overflow-y-auto outline-none rounded-tremor-default p-3 border [--anchor-gap:4px]",
               // light
               "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
               // dark
@@ -280,7 +288,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
               weekStartsOn={weekStartsOn}
               {...props}
             />
-          </Popover.Panel>
+          </PopoverPanel>
         </Transition>
       </Popover>
       {enableSelect && (
@@ -297,7 +305,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
         >
           {({ value }) => (
             <>
-              <Listbox.Button
+              <ListboxButton
                 onFocus={() => setIsSelectButtonFocused(true)}
                 onBlur={() => setIsSelectButtonFocused(false)}
                 className={tremorTwMerge(
@@ -311,20 +319,20 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
                 )}
               >
                 {value ? (valueToNameMapping.get(value) ?? selectPlaceholder) : selectPlaceholder}
-              </Listbox.Button>
+              </ListboxButton>
               <Transition
-                className="absolute z-10 w-full inset-x-0 right-0"
                 enter="transition ease duration-100 transform"
                 enterFrom="opacity-0 -translate-y-4"
                 enterTo="opacity-100 translate-y-0"
                 leave="transition ease duration-100 transform"
                 leaveFrom="opacity-100 translate-y-0"
                 leaveTo="opacity-0 -translate-y-4"
               >
-                <Listbox.Options
+                <ListboxOptions
+        
```

**File**: `src/components/input-elements/DateRangePicker/DateRangePickerItem.tsx` (modified, +2/-2)
```diff
@@ -3,13 +3,13 @@ import React from "react";
 
 import { SelectItem } from "../Select";
 
-export interface DateRangePickerItemProps extends React.HTMLAttributes<HTMLLIElement> {
+export interface DateRangePickerItemProps extends React.HTMLAttributes<HTMLDivElement> {
   value: string;
   from: Date;
   to?: Date;
 }
 
-const DateRangePickerItem = React.forwardRef<HTMLLIElement, DateRangePickerItemProps>(
+const DateRangePickerItem = React.forwardRef<HTMLDivElement, DateRangePickerItemProps>(
   (props, ref) => {
     const { value, className, children, ...other } = props;
 
```

---

### Incident Patch 4: `94d9f01b` (2024-11-09)
**Commit Message**: fix: bump recharts (#1140)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
     "date-fns": "^3.6.0",
     "react-day-picker": "^8.10.1",
     "react-transition-state": "^2.1.2",
-    "recharts": "^2.12.7",
+    "recharts": "^2.13.3",
     "tailwind-merge": "^2.5.2"
   },
   "devDependencies": {
```

**File**: `pnpm-lock.yaml` (modified, +12/-7)
```diff
@@ -27,8 +27,8 @@ importers:
         specifier: ^2.1.2
         version: 2.1.2(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       recharts:
-        specifier: ^2.12.7
-        version: 2.12.7(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        specifier: ^2.13.3
+        version: 2.13.3(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       tailwind-merge:
         specifier: ^2.5.2
         version: 2.5.2
@@ -1862,6 +1862,9 @@ packages:
   '@types/qs@6.9.16':
     resolution: {integrity: sha512-7i+zxXdPD0T4cKDuxCUXJ4wHcsJLwENa6Z3dCu8cfCK743OGy5Nu1RmAGqDPsoTDINVEcdXKRvR/zre+P2Ku1A==}
 
+  '@types/qs@6.9.17':
+    resolution: {integrity: sha512-rX4/bPcfmvxHDv0XjfJELTTr+iB+tn032nPILqHm5wbthUUUuVtNGGqzhya9XUxjTP8Fpr0qYgSZZKxGY++svQ==}
+
   '@types/range-parser@1.2.7':
     resolution: {integrity: sha512-hKormJbkJqzQGhziax5PItDUTMAM9uE2XXQmM37dyd4hVM+5aVl7oVxMVUiVQn2oCQFN/LKCZdvSM0pFRqbSmQ==}
 
@@ -5241,8 +5244,8 @@ packages:
   recharts-scale@0.4.5:
     resolution: {integrity: sha512-kivNFO+0OcUNu7jQquLXAxz1FIwZj8nrj+YkOKc5694NbjCvcT6aSZiIzNzd2Kul4o4rTto8QVR9lMNtxD4G1w==}
 
-  recharts@2.12.7:
-    resolution: {integrity: sha512-hlLJMhPQfv4/3NBSAyq3gzGg4h2v69RJh6KU7b3pXYNNAELs9kEoXOjbkxdXpALqKBoVmVptGfLpxdaVYqjmXQ==}
+  recharts@2.13.3:
+    resolution: {integrity: sha512-YDZ9dOfK9t3ycwxgKbrnDlRC4BHdjlY73fet3a0C1+qGMjXVZe6+VXmpOIIhzkje5MMEL8AN4hLIe4AMskBzlA==}
     engines: {node: '>=14'}
     peerDependencies:
       react: ^16.0.0 || ^17.0.0 || ^18.0.0
@@ -8078,7 +8081,7 @@ snapshots:
       '@storybook/csf': 0.1.11
       '@storybook/global': 5.0.0
       '@storybook/types': 7.4.6
-      '@types/qs': 6.9.16
+      '@types/qs': 6.9.17
       dequal: 2.0.3
       lodash: 4.17.21
       memoizerific: 1.11.3
@@ -8425,6 +8428,8 @@ snapshots:
 
   '@types/qs@6.9.16': {}
 
+  '@types/qs@6.9.17': {}
+
   '@types/range-parser@1.2.7': {}
 
   '@types/react-dom@18.3.0':
@@ -12204,14 +12209,14 @@ snapshots:
     dependencies:
       decimal.js-light: 2.5.1
 
-  recharts@2.12.7(react-dom@18.3.1(react@18.3.1))(react@18.3.1):
+  recharts@2.13.3(react-dom@18.3.1(react@18.3.1))(react@18.3.1):
     dependencies:
       clsx: 2.1.1
       eventemitter3: 4.0.7
       lodash: 4.17.21
       react: 18.3.1
       react-dom: 18.3.1(react@18.3.1)
-      react-is: 16.13.1
+      react-is: 18.3.1
       react-smooth: 4.0.1(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       recharts-scale: 0.4.5
       tiny-invariant: 1.3.3
```

---

### Incident Patch 5: `b1ac6981` (2024-09-24)
**Commit Message**: fix: beta workflows (#1137)

* fix: Update release.yaml (#1136)

* Update release.yaml

* semantic release

* fix: update build workflow

**File**: `.github/workflows/build.yaml` (modified, +3/-3)
```diff
@@ -17,11 +17,11 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: checkout
-        uses: actions/checkout@v2.4.2
+        uses: actions/checkout@v4
       - name: node
-        uses: actions/setup-node@v3.4.1
+        uses: actions/setup-node@v4
         with:
-          node-version: 18
+          node-version: 20
           registry-url: https://registry.npmjs.org
       - name: install react
         run: npm i react
```

**File**: `.github/workflows/release.yaml` (modified, +3/-3)
```diff
@@ -13,11 +13,11 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: checkout
-        uses: actions/checkout@v2.4.2
+        uses: actions/checkout@v4
       - name: node
-        uses: actions/setup-node@v3.4.1
+        uses: actions/setup-node@v4
         with:
-          node-version: 18
+          node-version: 20
           registry-url: https://registry.npmjs.org
       - name: install react
         run: npm i react
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@
   },
   "repository": {
     "type": "git",
-    "url": "https://github.com/tremorlabs/tremor.git"
+    "url": "git+https://github.com/tremorlabs/tremor.git"
   },
   "author": "tremor",
   "license": "Apache 2.0",
@@ -44,7 +44,7 @@
     "@rollup/plugin-node-resolve": "^13.3.0",
     "@rollup/plugin-terser": "^0.4.4",
     "@rollup/plugin-typescript": "^8.5.0",
-    "@semantic-release/commit-analyzer": "^9.0.2",
+    "@semantic-release/commit-analyzer": "^13.0.0",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
     "@storybook/addon-a11y": "^8.3.3",
```

**File**: `pnpm-lock.yaml` (modified, +2/-333)
```diff
@@ -64,8 +64,8 @@ importers:
         specifier: ^8.5.0
         version: 8.5.0(rollup@2.79.1)(tslib@2.7.0)(typescript@4.9.5)
       '@semantic-release/commit-analyzer':
-        specifier: ^9.0.2
-        version: 9.0.2(semantic-release@24.1.1(typescript@4.9.5))
+        specifier: ^13.0.0
+        version: 13.0.0(semantic-release@24.1.1(typescript@4.9.5))
       '@semantic-release/github':
         specifier: github:semantic-release/github
         version: https://codeload.github.com/semantic-release/github/tar.gz/b6ed55ed8636b492854bec5dabbe01ab3ef73feb(semantic-release@24.1.1(typescript@4.9.5))
@@ -1358,12 +1358,6 @@ packages:
     peerDependencies:
       semantic-release: '>=20.1.0'
 
-  '@semantic-release/commit-analyzer@9.0.2':
-    resolution: {integrity: sha512-E+dr6L+xIHZkX4zNMe6Rnwg4YQrWNXK+rNsvwOPpdFppvZO1olE2fIgWhv89TkQErygevbjsZFSIxp+u6w2e5g==}
-    engines: {node: '>=14.17'}
-    peerDependencies:
-      semantic-release: '>=18.0.0-beta.1'
-
   '@semantic-release/error@4.0.0':
     resolution: {integrity: sha512-mgdxrHTLOjOddRVYIYDo0fR3/v61GNN1YGkfbrjuIKg/uMgCd+Qzo3UAXJ+woLQQpos4pl5Esuw5A7AoNlzjUQ==}
     engines: {node: '>=18'}
@@ -1853,9 +1847,6 @@ packages:
   '@types/mime@1.3.5':
     resolution: {integrity: sha512-/pyBZWSLD2n0dcHE3hq8s8ZvcETHtEuF+3E7XVt0Ig2nvsVQXdghHVcEkIWjy9A0wKfTn97a/PSDYohKIlnP/w==}
 
-  '@types/minimist@1.2.5':
-    resolution: {integrity: sha512-hov8bUuiLiyFPGyFPE1lwWhmzYbirOXQNNo40+y3zow8aFVTeyn3VWL0VFFfdNddA8S4Vf0Tc062rzyNr7Paag==}
-
   '@types/node@22.6.1':
     resolution: {integrity: sha512-V48tCfcKb/e6cVUigLAaJDAILdMP0fUW6BidkPK4GpGjXcfbnoHasCZDwz3N3yVt5we2RHm4XTQCpv0KJz9zqw==}
 
@@ -2045,10 +2036,6 @@ packages:
   '@xtuc/long@4.2.2':
     resolution: {integrity: sha512-NuHqBY1PB/D8xU6s/thBgOAiAP7HOYDQ32+BFZILJ8ivkUkAHQnWfn6WhL79Owj1qmUnoN/YPhktdIoucipkAQ==}
 
-  JSONStream@1.3.5:
-    resolution: {integrity: sha512-E+iruNOY8VV9s4JEbe1aNEm6MiszPRr/UfcHMz0TQh1BXSxHK+ASV1R6W4HpjBhSeS+54PIsAMCBmwD06LLsqQ==}
-    hasBin: true
-
   abab@2.0.6:
     resolution: {integrity: sha512-j2afSsaIENvHZN2B8GOpF566vZ5WVk5opAiMTvWgaQT8DkbOqsTfvNAvHoRGU2zzP8cPoqys+xHTRDWW8L+/BA==}
     deprecated: Use your platform's native atob() and btoa() methods instead
@@ -2228,10 +2215,6 @@ packages:
     resolution: {integrity: sha512-bMxMKAjg13EBSVscxTaYA4mRc5t1UAXa2kXiGTNfZ079HIWXEkKmkgFrh/nJqamaLSrXO5H4WFFkPEaLJWbs3A==}
     engines: {node: '>= 0.4'}
 
-  arrify@1.0.1:
-    resolution: {integrity: sha512-3CYzex9M9FGQjCGMGyi6/31c8GJbgb0qGyrx5HWxPd0aCwh4cB2YjMb2Xf9UuoogrMrlO9cTqnB5rI5GHZTcUA==}
-    engines: {node: '>=0.10.0'}
-
   assertion-error@2.0.1:
     resolution: {integrity: sha512-Izi8RQcffqCeNVgFigKli1ssklIbpHnCYc6AknXGYoB6grJqyeby7jv12JUQgmTAnIDnbck1uxksT4dzN3PWBA==}
     engines: {node: '>=12'}
@@ -2402,10 +2385,6 @@ packages:
     resolution: {integrity: sha512-QOSvevhslijgYwRx6Rv7zKdMF8lbRmx+uQGx2+vDc+KI/eBnsy9kit5aj23AgGu3pa4t9AgwbnXWqS+iOY+2aA==}
     engines: {node: '>= 6'}
 
-  camelcase-keys@6.2.2:
-    resolution: {integrity: sha512-YrwaA0vEKazPBkn0ipTiMpSajYDSe+KjQfrjhcBMxJt/znbvlHd8Pw/Vamaz5EB4Wfhs3SUR3Z9mwRu/P3s3Yg==}
-    engines: {node: '>=8'}
-
   camelcase@5.3.1:
     resolution: {integrity: sha512-L28STB170nwWS63UjtlEOE3dldQApaJXZkOI1uMFfzf3rRuPegHaHesyee+YxQ+W6SvRDQV6UrdOdRiR153wJg==}
     engines: {node: '>=6'}
@@ -2584,10 +2563,6 @@ packages:
     resolution: {integrity: sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==}
     engines: {node: '>= 0.6'}
 
-  conventional-changelog-angular@5.0.13:
-    resolution: {integrity: sha512-i/gipMxs7s8L/QeuavPF2hLnJgH6pEZAttySB6aiQLWcX3puWDL3ACVmvBhJGxnAy52Qc15ua26BufY6KpmrVA==}
-    engines: {node: '>=10'}
-
   conventional-changelog-angular@8.0.0:
     resolution: {integrity: sha512-CLf+zr6St0wIxos4bmaKHRXWAcsCXrJU6F4VdNDrGRK3B8LDLKoX3zuMV5GhtbGkVR/LohZ6MT6im43vZLSjmA==}
     engines: {node: '>=18'}
@@ -2601,19 +2576,10 @@ packages:
     engines: {node: '>=18'}
     hasBin: true
 
-  conv
```

---

### Incident Patch 6: `efdaee1a` (2024-09-24)
**Commit Message**: fix: update storybook and semantic-release (#1135)

**File**: `package.json` (modified, +18/-18)
```diff
@@ -47,27 +47,27 @@
     "@semantic-release/commit-analyzer": "^9.0.2",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
-    "@storybook/addon-a11y": "^8.3.2",
-    "@storybook/addon-actions": "^8.3.2",
-    "@storybook/addon-essentials": "^8.3.2",
-    "@storybook/addon-interactions": "^8.3.2",
-    "@storybook/addon-links": "^8.3.2",
+    "@storybook/addon-a11y": "^8.3.3",
+    "@storybook/addon-actions": "^8.3.3",
+    "@storybook/addon-essentials": "^8.3.3",
+    "@storybook/addon-interactions": "^8.3.3",
+    "@storybook/addon-links": "^8.3.3",
     "@storybook/addon-styling-webpack": "^1.0.0",
-    "@storybook/addon-themes": "^8.3.2",
+    "@storybook/addon-themes": "^8.3.3",
     "@storybook/addon-webpack5-compiler-babel": "^3.0.3",
-    "@storybook/manager-api": "^8.3.2",
+    "@storybook/manager-api": "^8.3.3",
     "@storybook/mdx2-csf": "^1.1.0",
-    "@storybook/react": "^8.3.2",
-    "@storybook/react-webpack5": "^8.3.2",
-    "@storybook/test": "^8.3.2",
-    "@storybook/theming": "^8.3.2",
+    "@storybook/react": "^8.3.3",
+    "@storybook/react-webpack5": "^8.3.3",
+    "@storybook/test": "^8.3.3",
+    "@storybook/theming": "^8.3.3",
     "@tailwindcss/forms": "^0.5.9",
     "@testing-library/react": "^14.3.1",
     "@types/jest": "^29.5.13",
-    "@types/node": "^22.5.5",
-    "@types/react": "^18.3.8",
-    "@typescript-eslint/eslint-plugin": "^8.6.0",
-    "@typescript-eslint/parser": "^8.6.0",
+    "@types/node": "^22.6.1",
+    "@types/react": "^18.3.9",
+    "@typescript-eslint/eslint-plugin": "^8.7.0",
+    "@typescript-eslint/parser": "^8.7.0",
     "autoprefixer": "^10.4.20",
     "babel-jest": "^27.5.1",
     "babel-loader": "^8.4.1",
@@ -95,11 +95,11 @@
     "rollup-plugin-postcss": "^4.0.2",
     "rollup-plugin-preserve-directives": "^0.1.1",
     "rollup-plugin-typescript-paths": "^1.5.0",
-    "semantic-release": "^22.0.12",
-    "storybook": "^8.3.2",
+    "semantic-release": "^24.1.1",
+    "storybook": "^8.3.3",
     "storybook-source-link": "^4.0.1",
     "style-loader": "^3.3.4",
-    "tailwindcss": "^3.4.12",
+    "tailwindcss": "^3.4.13",
     "tslib": "^2.7.0",
     "typescript": "^4.9.5",
     "webpack": "^5.94.0"
```

---

### Incident Patch 7: `59f970ec` (2024-09-24)
**Commit Message**: fix: update packages (#1134)

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ## **Contributing to Tremor**
 
-Thanks for your interest in contributing to Tremor. Please take a moment to review this document before submitting a pull request. This document will outline how to submit changes to this repository and which conventions to follow. If you are ever in doubt about anything we encourage you to reach out on [Slack](https://join.slack.com/t/tremor-community/shared_invite/zt-1u8jqmcmq-Fdr9B6MbnO7u8FkGh~2Ylg), [open a discussion](#discussions), or [shoot us an email](mailto:hello@tremor.so).
+Thanks for your interest in contributing to Tremor. Please take a moment to review this document before submitting a pull request. This document will outline how to submit changes to this repository and which conventions to follow. If you are ever in doubt about anything we encourage you to reach out on [Slack](https://tremor-community.slack.com/join/shared_invite/zt-2a95vjndc-YCKurK3HVAkYtjialnT2_A#/shared-invite/email), [open a discussion](#discussions), or [shoot us an email](mailto:hello@tremor.so).
 
 ### **Prerequisites**
 
```

**File**: `package.json` (modified, +30/-30)
```diff
@@ -31,14 +31,14 @@
     "react-day-picker": "^8.10.1",
     "react-transition-state": "^2.1.2",
     "recharts": "^2.12.7",
-    "tailwind-merge": "^1.14.0"
+    "tailwind-merge": "^2.5.2"
   },
   "devDependencies": {
     "@babel/core": "^7.25.2",
     "@babel/preset-env": "^7.25.4",
     "@babel/preset-react": "^7.24.7",
     "@babel/preset-typescript": "^7.24.7",
-    "@chromatic-com/storybook": "^1.7.0",
+    "@chromatic-com/storybook": "^1.9.0",
     "@mdx-js/react": "^2.3.0",
     "@rollup/plugin-commonjs": "^21.1.0",
     "@rollup/plugin-node-resolve": "^13.3.0",
@@ -47,43 +47,43 @@
     "@semantic-release/commit-analyzer": "^9.0.2",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
-    "@storybook/addon-a11y": "^8.2.9",
-    "@storybook/addon-actions": "^8.2.9",
-    "@storybook/addon-essentials": "^8.2.9",
-    "@storybook/addon-interactions": "^8.2.9",
-    "@storybook/addon-links": "^8.2.9",
+    "@storybook/addon-a11y": "^8.3.2",
+    "@storybook/addon-actions": "^8.3.2",
+    "@storybook/addon-essentials": "^8.3.2",
+    "@storybook/addon-interactions": "^8.3.2",
+    "@storybook/addon-links": "^8.3.2",
     "@storybook/addon-styling-webpack": "^1.0.0",
-    "@storybook/addon-themes": "^8.2.9",
+    "@storybook/addon-themes": "^8.3.2",
     "@storybook/addon-webpack5-compiler-babel": "^3.0.3",
-    "@storybook/manager-api": "^8.2.9",
+    "@storybook/manager-api": "^8.3.2",
     "@storybook/mdx2-csf": "^1.1.0",
-    "@storybook/react": "^8.2.9",
-    "@storybook/react-webpack5": "^8.2.9",
-    "@storybook/test": "^8.2.9",
-    "@storybook/theming": "^8.2.9",
-    "@tailwindcss/forms": "^0.5.8",
-    "@testing-library/react": "^14.1.2",
-    "@types/jest": "^29.5.12",
-    "@types/node": "^22.5.1",
-    "@types/react": "^18.3.4",
-    "@typescript-eslint/eslint-plugin": "^8.3.0",
-    "@typescript-eslint/parser": "^8.3.0",
+    "@storybook/react": "^8.3.2",
+    "@storybook/react-webpack5": "^8.3.2",
+    "@storybook/test": "^8.3.2",
+    "@storybook/theming": "^8.3.2",
+    "@tailwindcss/forms": "^0.5.9",
+    "@testing-library/react": "^14.3.1",
+    "@types/jest": "^29.5.13",
+    "@types/node": "^22.5.5",
+    "@types/react": "^18.3.8",
+    "@typescript-eslint/eslint-plugin": "^8.6.0",
+    "@typescript-eslint/parser": "^8.6.0",
     "autoprefixer": "^10.4.20",
     "babel-jest": "^27.5.1",
-    "babel-loader": "^8.3.0",
+    "babel-loader": "^8.4.1",
     "conventional-changelog-conventionalcommits": "^5.0.0",
-    "css-loader": "^6.8.1",
-    "eslint": "^8.57.0",
+    "css-loader": "^6.11.0",
+    "eslint": "^8.57.1",
     "eslint-config-prettier": "^9.1.0",
     "eslint-plugin-prettier": "^5.2.1",
-    "eslint-plugin-react": "^7.35.0",
+    "eslint-plugin-react": "^7.36.1",
     "eslint-plugin-react-hooks": "^4.6.2",
     "html-webpack-plugin": "^5.6.0",
     "identity-obj-proxy": "^3.0.0",
     "jest": "^29.7.0",
     "jest-environment-jsdom": "^29.7.0",
-    "postcss": "^8.4.41",
-    "postcss-loader": "^7.3.3",
+    "postcss": "^8.4.47",
+    "postcss-loader": "^7.3.4",
     "prettier": "3.3.3",
     "prop-types": "^15.8.1",
     "react": "^18.3.1",
@@ -95,11 +95,11 @@
     "rollup-plugin-postcss": "^4.0.2",
     "rollup-plugin-preserve-directives": "^0.1.1",
     "rollup-plugin-typescript-paths": "^1.5.0",
-    "semantic-release": "^22.0.8",
-    "storybook": "^8.2.9",
+    "semantic-release": "^22.0.12",
+    "storybook": "^8.3.2",
     "storybook-source-link": "^4.0.1",
-    "style-loader": "^3.3.3",
-    "tailwindcss": "^3.4.10",
+    "style-loader": "^3.3.4",
+    "tailwindcss": "^3.4.12",
     "tslib": "^2.7.0",
     "typescript": "^4.9.5",
     "webpack": "^5.94.0"
```

**File**: `src/lib/tremorTwMerge.ts` (modified, +33/-31)
```diff
@@ -1,36 +1,38 @@
 import { extendTailwindMerge } from "tailwind-merge";
 
 export const tremorTwMerge = extendTailwindMerge({
-  classGroups: {
-    boxShadow: [
-      {
-        shadow: [
-          {
-            tremor: ["input", "card", "dropdown"],
-            "dark-tremor": ["input", "card", "dropdown"],
-          },
-        ],
-      },
-    ],
-    borderRadius: [
-      {
-        rounded: [
-          {
-            tremor: ["small", "default", "full"],
-            "dark-tremor": ["small", "default", "full"],
-          },
-        ],
-      },
-    ],
-    fontSize: [
-      {
-        text: [
-          {
-            tremor: ["default", "title", "metric"],
-            "dark-tremor": ["default", "title", "metric"],
-          },
-        ],
-      },
-    ],
+  extend: {
+    classGroups: {
+      shadow: [
+        {
+          shadow: [
+            {
+              tremor: ["input", "card", "dropdown"],
+              "dark-tremor": ["input", "card", "dropdown"],
+            },
+          ],
+        },
+      ],
+      rounded: [
+        {
+          rounded: [
+            {
+              tremor: ["small", "default", "full"],
+              "dark-tremor": ["small", "default", "full"],
+            },
+          ],
+        },
+      ],
+      "font-size": [
+        {
+          text: [
+            {
+              tremor: ["default", "title", "metric"],
+              "dark-tremor": ["default", "title", "metric"],
+            },
+          ],
+        },
+      ],
+    },
   },
 });
```

---

### Incident Patch 8: `891a619c` (2024-09-15)
**Commit Message**: fix: <AreaChart /> Doesn't Display Gradient in Firefox Bug (#1132)

* fix: area chart linting and firefox id issue

---------

Co-authored-by: severinlandolt <sev.landolt@gmail.com>

**File**: `src/components/chart-elements/AreaChart/AreaChart.tsx` (modified, +84/-80)
```diff
@@ -292,6 +292,7 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
               />
             ) : null}
             {categories.map((category) => {
+              const gradientId = (categoryColors.get(category) ?? BaseColors.Gray).replace("#", "");
               return (
                 <defs key={category}>
                   {showGradient ? (
@@ -302,7 +303,7 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
                           colorPalette.text,
                         ).textColor
                       }
-                      id={categoryColors.get(category)}
+                      id={gradientId}
                       x1="0"
                       y1="0"
                       x2="0"
@@ -325,7 +326,7 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
                           colorPalette.text,
                         ).textColor
                       }
-                      id={categoryColors.get(category)}
+                      id={gradientId}
                       x1="0"
                       y1="0"
                       x2="0"
@@ -342,68 +343,22 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
                 </defs>
               );
             })}
-            {categories.map((category) => (
-              <Area
-                className={
-                  getColorClassNames(
-                    categoryColors.get(category) ?? BaseColors.Gray,
-                    colorPalette.text,
-                  ).strokeColor
-                }
-                strokeOpacity={activeDot || (activeLegend && activeLegend !== category) ? 0.3 : 1}
-                activeDot={(props: any) => {
-                  const { cx, cy, stroke, strokeLinecap, strokeLinejoin, strokeWidth, dataKey } =
-                    props;
-                  return (
-                    <Dot
-                      className={tremorTwMerge(
-                        "stroke-tremor-background dark:stroke-dark-tremor-background",
-                        onValueChange ? "cursor-pointer" : "",
-                        getColorClassNames(
-                          categoryColors.get(dataKey) ?? BaseColors.Gray,
-                          colorPalette.text,
-                        ).fillColor,
-                      )}
-                      cx={cx}
-                      cy={cy}
-                      r={5}
-                      fill=""
-                      stroke={stroke}
-                      strokeLinecap={strokeLinecap}
-                      strokeLinejoin={strokeLinejoin}
-                      strokeWidth={strokeWidth}
-                      onClick={(dotProps: any, event) => onDotClick(props, event)}
-                    />
-                  );
-                }}
-                dot={(props: any) => {
-                  const {
-                    stroke,
-                    strokeLinecap,
-                    strokeLinejoin,
-                    strokeWidth,
-                    cx,
-                    cy,
-                    dataKey,
-                    index,
-                  } = props;
-
-                  if (
-                    (hasOnlyOneValueForThisKey(data, category) &&
-                      !(activeDot || (activeLegend && activeLegend !== category))) ||
-                    (activeDot?.index === index && activeDot?.dataKey === category)
-                  ) {
+            {categories.map((category) => {
+              const gradientId = (categoryColors.get(category) ?? BaseColors.Gray).replace("#", "");
+              return (
+                <Area
+                  className={
+                    getColorClassNames(
+                      categoryColors.get(category) ?? BaseColors.Gray,
+                      colorPalette.text,
+                    ).strokeColor
+                  }
+                  strokeOpacity={activeDot || (activeLegend && activeLegen
```

---

### Incident Patch 9: `c7df68f2` (2024-09-07)
**Commit Message**: fix: remove console info (#1131)

**File**: `src/components/chart-elements/AreaChart/AreaChart.tsx` (modified, +0/-6)
```diff
@@ -139,12 +139,6 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
     }
     setActiveDot(undefined);
   }
-
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The AreaChart is also available as a copy-and-paste component. Visit https://tremor.so/docs/visualizations/area-chart (This is only shown in development)",
-    );
-  }
   return (
     <div ref={ref} className={tremorTwMerge("w-full h-80", className)} {...other}>
       <ResponsiveContainer className="h-full w-full">
```

**File**: `src/components/chart-elements/BarChart/BarChart.tsx` (modified, +0/-5)
```diff
@@ -144,11 +144,6 @@ const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>((props, ref) =>
     setActiveBar(undefined);
   }
   const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The BarChart is also available as a copy-and-paste component. Visit https://tremor.so/docs/visualizations/bar-chart (This is only shown in development)",
-    );
-  }
   return (
     <div ref={ref} className={tremorTwMerge("w-full h-80", className)} {...other}>
       <ResponsiveContainer className="h-full w-full">
```

**File**: `src/components/chart-elements/DonutChart/DonutChart.tsx` (modified, +0/-6)
```diff
@@ -124,12 +124,6 @@ const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>((props, ref
     }
   }, [activeIndex]);
 
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The DonutChart is also available as a copy-and-paste component. Visit https://tremor.so/docs/visualizations/donut-chart (This is only shown in development)",
-    );
-  }
-
   return (
     <div ref={ref} className={tremorTwMerge("w-full h-40", className)} {...other}>
       <ResponsiveContainer className="h-full w-full">
```

**File**: `src/components/chart-elements/LineChart/LineChart.tsx` (modified, +0/-6)
```diff
@@ -133,12 +133,6 @@ const LineChart = React.forwardRef<HTMLDivElement, LineChartProps>((props, ref)
     setActiveDot(undefined);
   }
 
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The LineChart is also available as a copy-and-paste component. Visit https://tremor.so/docs/visualizations/line-chart (This is only shown in development)",
-    );
-  }
-
   return (
     <div ref={ref} className={tremorTwMerge("w-full h-80", className)} {...other}>
       <ResponsiveContainer className="h-full w-full">
```

**File**: `src/components/icon-elements/Badge/Badge.tsx` (modified, +0/-6)
```diff
@@ -29,12 +29,6 @@ const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>((props, ref) => {
 
   const { tooltipProps, getReferenceProps } = useTooltip();
 
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The Badge is also available as a copy-and-paste component. Visit https://tremor.so/docs/ui/badge (This is only shown in development)",
-    );
-  }
-
   return (
     <span
       ref={mergeRefs([ref, tooltipProps.refs.setReference])}
```

---

### Incident Patch 10: `62c4bcc3` (2024-06-23)
**Commit Message**: fix: tab color and legend scroll (#1094)

* fix: tab color brand

* fix: colors seelct error

* fix: add input type search

* fix animations

* fix: legend scroll (#1093)

* fix legend scroll

Co-authored-by: mbauchet <90607026+mbauchet@users.noreply.github.com>

**File**: `src/components/input-elements/BaseInput.tsx` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import { getSelectButtonColors, hasValue } from "components/input-elements/selec
 import { mergeRefs, tremorTwMerge } from "lib";
 
 export interface BaseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
-  type?: "text" | "password" | "email" | "url" | "number";
+  type?: "text" | "password" | "email" | "url" | "number" | "search";
   defaultValue?: string | number;
   value?: string | number;
   icon?: React.ElementType | React.JSXElementConstructor<any>;
```

**File**: `src/components/input-elements/Tabs/Tab.tsx` (modified, +5/-5)
```diff
@@ -22,7 +22,10 @@ function getVariantStyles(tabVariant: TabVariant, color?: Color) {
         // brand
         color
           ? getColorClassNames(color, colorPalette.border).selectBorderColor
-          : "ui-selected:border-tremor-brand dark:ui-selected:border-dark-tremor-brand",
+          : [
+              "ui-selected:border-tremor-brand ui-selected:text-tremor-brand",
+              "ui-selected:dark:border-dark-tremor-brand ui-selected:dark:text-dark-tremor-brand",
+            ],
       );
     case "solid":
       return tremorTwMerge(
@@ -57,12 +60,9 @@ const Tab = React.forwardRef<HTMLButtonElement, TabProps>((props, ref) => {
         makeTabClassName("root"),
         // common
         "flex whitespace-nowrap truncate max-w-xs outline-none ui-focus-visible:ring text-tremor-default transition duration-100",
-        // brand
-        color && getColorClassNames(color, colorPalette.text).selectTextColor,
-        // solid ? "ui-selected:text-tremor-content-emphasis dark:ui-selected:text-dark-tremor-content-emphasis"
-        // : "ui-selected:text-tremor-brand dark:ui-selected:text-dark-tremor-brand",
         getVariantStyles(variant, color),
         className,
+        color && getColorClassNames(color, colorPalette.text).selectTextColor,
       )}
       {...other}
     >
```

**File**: `src/components/input-elements/Tabs/TabList.tsx` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
 }
 
 const TabList = React.forwardRef<HTMLDivElement, TabListProps>((props, ref) => {
-  const { color = "blue", variant = "line", children, className, ...other } = props;
+  const { color, variant = "line", children, className, ...other } = props;
 
   return (
     <Tab.List
```

**File**: `src/components/input-elements/TextInput/TextInput.tsx` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@ import { makeClassName } from "lib";
 import BaseInput, { BaseInputProps } from "../BaseInput";
 
 export type TextInputProps = Omit<BaseInputProps, "stepper" | "makeInputClassName"> & {
-  type?: "text" | "password" | "email" | "url";
   defaultValue?: string;
   value?: string;
   onValueChange?: (value: string) => void;
```

**File**: `src/components/input-elements/selectUtils.ts` (modified, +5/-2)
```diff
@@ -44,8 +44,11 @@ export const getSelectButtonColors = (
       ? "text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis"
       : "text-tremor-content dark:text-dark-tremor-content",
     isDisabled && "text-tremor-content-subtle dark:text-dark-tremor-content-subtle",
-    hasError && "text-red-500 placeholder:text-red-500",
-    hasError ? "border-red-500" : "border-tremor-border dark:border-dark-tremor-border",
+    hasError &&
+      "text-red-500 placeholder:text-red-500 dark:text-red-500 dark:placeholder:text-red-500",
+    hasError
+      ? "border-red-500 dark:border-red-500"
+      : "border-tremor-border dark:border-dark-tremor-border",
   );
 };
 
```

#### Recent Merged Pull Requests:
- **PR #1150** (2025-01-13): fix: icon imports (@severinlandolt)
- **PR #1149** (2025-01-11): chore: readme date (@severinlandolt)
- **PR #1148** (2024-12-28): chore: update urls (@severinlandolt)
- **PR #1147** (closed): chore: sync remote form (@thesergsb)
- **PR #1146** (closed): Beta tremor v4 (@severinlandolt)
- **PR #1145** (2024-12-13): chore: Tremor v4 react19 (@severinlandolt)
- **PR #1144** (closed): feat!: Tremor v4 (@severinlandolt)
- **PR #1143** (2024-12-07): fix: minimum select width (@severinlandolt)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
