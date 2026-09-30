# Forensic Learning Record (Deep Inspection): rsuite/rsuite

> **Canonical Artifact**: `07_PROJECT_LEARNING/rsuite-rsuite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rsuite/rsuite](https://github.com/rsuite/rsuite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:30:52.439Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rsuite/rsuite`
- **Description**: 🧱 A suite of React components .  
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8694 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `babel.config.js`
```
module.exports = (api, options) => {
  const { NODE_ENV } = options || process.env;
  const dev = NODE_ENV === 'development';
  const modules = NODE_ENV === 'esm' ? false : 'commonjs';

  if (api) {
    api.cache(() => NODE_ENV);
  }

  const plugins = [
    'lodash',
    '@babel/plugin-proposal-export-default-from',
    ['@babel/plugin-transform-runtime', { useESModules: !modules }],
    [
      'transform-inline-environment-variables',
      {
        include: ['RUN_ENV']
      }
    ],
    [
      'module-resolver',
      {
        root: ['./src/'],
        alias: {
          '^@/internals/(.+)': ([, name]) => {
            return `./src/internals/${name}`;
          }
        }
      }
    ]
  ];

  return {
    presets: [
      ['@babel/preset-env', { modules, loose: true }],
      ['@babel/preset-react', { development: dev }],
      '@babel/preset-typescript'
    ],
    plugins,
    env: {
      coverage: {
        plugins: [
          [
            'istanbul',
            {
              exclude: ['src/**/*Spec.js', 'src/**/*Spec.tsx', 'test/**/*']
            }
          ]
        ]
      }
    }
  };
};

```

### Core Architecture Module: `commitlint.config.js`
```
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-case': [0]
  }
};

```

### Core Architecture Module: `eslint.config.mjs`
```
import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import eslintConfigPrettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    ignores: ['src/styles/plugins/*']
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-namespace': 'off',
      'react/prop-types': 'off'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    // Test files
    files: ['**/test/*.{js,mjs,cjs,ts,jsx,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'react/display-name': 'off'
    }
  },
  {
    // Config files and scripts
    files: [
      'webpack.*.js',
      'gulpfile.js',
      'docs/next.config.js',
      'postcss.config.cjs',
      'docs/scripts/*.js',
      'scripts/*.js'
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
];

```

### Core Architecture Module: `examples/create-react-app/craco.config.js`
```
module.exports = {
  // CRACO configuration for create-react-app customization
  // Currently no custom configuration needed
  // Can be extended in the future for webpack customizations
};

```

### Core Architecture Module: `examples/create-react-app/src/App.js`
```
import React from 'react';
import {
  Button,
  CustomProvider,
  Container,
  Stack,
  Toggle,
  Heading,
  Text,
  Panel,
  ButtonToolbar
} from 'rsuite';
import { Icon } from '@rsuite/icons';
import { FaMoon, FaSun, FaGithub, FaBook } from 'react-icons/fa';
import Logo from './Logo';
import './App.css';
import 'rsuite/dist/rsuite.min.css';

function App() {
  const [theme, setTheme] = React.useState('dark');

  const toggleTheme = checked => {
    setTheme(checked ? 'light' : 'dark');
  };

  return (
    <CustomProvider theme={theme}>
      <Container className="app">
        <header className="app-header">
          <Panel bordered shaded className="welcome-panel">
            <Stack direction="column" spacing={20} alignItems="center">
              <Logo />
              
              <Heading level={2}>Welcome to React Suite</Heading>
              
              <Text muted size="lg" align="center">
                A suite of React components, sensible UI design, and a friendly development experience.
              </Text>

              <Stack spacing={10} alignItems="center">
                <Text muted>Theme:</Text>
                <Toggle
                  size="lg"
                  checked={theme === 'light'}
                  checkedChildren={<Icon as={FaSun} style={{ fontSize: 18 }} />}
                  unCheckedChildren={<Icon as={FaMoon} style={{ fontSize: 18 }} />}
                  onChange={toggleTheme}
                />
              </Stack>

              <ButtonToolbar>
                <Button
                  appearance="primary"
                  size="lg"
                  href="https://rsuitejs.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<Icon as={FaBook} />}
                >
                  Documentation
                </Button>

                <Button
                  appearance="subtle"
                  size="lg"
                  href="https://github.com/rsuite/rsuite"
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<Icon as={FaGithub} />}
                >
                  GitHub
                </Button>
              </ButtonToolbar>

              <Text size="sm" muted>
                Edit <code>src/App.js</code> and save to reload.
              </Text>
            </Stack>
          </Panel>
        </header>
      </Container>
    </CustomProvider>
  );
}

export default App;

```

### Core Architecture Module: `examples/create-react-app/src/Logo/Logo.js`
```
import React from 'react';

export default function Logo({ width, height, className = '' }) {
  const style = { width, height, display: 'inline-block' };
  return (
    <div
      style={style}
      className={`rsuite-logo logo-animated logo-animated-delay-half-seconds bounce-in ${className} `}
    >
      <svg
        viewBox="0 0 120 138"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMin slice"
      >
        <title>React Suite Logo</title>
        <defs>
          <linearGradient
            x1="71.5906675%"
            y1="12.5658792%"
            x2="45.577567%"
            y2="114.749969%"
            id="linearGradient-1"
          >
            <stop stopColor="#6594ED" offset="0%" />
            <stop stopColor="#316BD9" offset="100%" />
          </linearGradient>
          <linearGradient x1="67.6269531%" y1="0%" x2="50%" y2="78.0639648%" id="linearGradient-2">
            <stop stopColor="#EC5060" offset="0%" />
            <stop stopColor="#EA7480" offset="100%" />
          </linearGradient>
          <linearGradient x1="67.6269531%" y1="0%" x2="50%" y2="79.2449951%" id="linearGradient-3">
            <stop stopColor="#EC5060" offset="0%" />
            <stop stopColor="#EA7480" offset="100%" />
          </linearGradient>
        </defs>
        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
          <g transform="translate(3.000000, 6.000000)">
            <polyline
              className="polyline-axis"
              stroke="url(#linearGradient-1)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="111 31 57 0 19 22 95 104 57 126 3 95"
            />
            <polyline
              className="polyline-limb"
              stroke="url(#linearGradient-2)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(22.000000, 63.000000) scale(-1, -1) translate(-22.000000, -63.000000) "
              points="41 31 3 54 41 95 41 52"
            />
            <polyline
              className="polyline-limb"
              stroke="url(#linearGradient-3)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="111 31 73 54 111 95 111 52"
            />
            <circle className="circle" fill="#6594ED" cx="3" cy="95" r="3" />
            <circle fill="#6594ED" cx="111" cy="31" r="3" />
          </g>
        </g>
      </svg>
    </div>
  );
}

```

### Core Architecture Module: `examples/create-react-app/src/Logo/index.js`
```
import Logo from './Logo';

export default Logo;

```

### Core Architecture Module: `examples/create-react-app/src/index.js`
```
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'rsuite/dist/rsuite.min.css';
import './index.css';

import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4598** (2026-08-21): **fix(Image): prevent SSR hydration mismatch**
  *Symptoms*: ## Summary  - replace DOM-dependent styled-system property detection with a deterministic static allow-list - keep native image attributes such as `src`, `srcSet`, and `loading` out of Box styling while preserving all public CSS system props - add a real Node SSR to Chromium hydration regression test and run it for React 18 and React 19 in CI  ## Testing  - `npm run test:ssr` - `npm run test:component -- --browser.name=chromium --browser.headless --no-file-parallelism` (5299 passed, 4 skipped) - `npm run lint` - `npm run format:check` - `npm run build:types`  Fixes #4597 
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/image-ssr-hydration-mismatch?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/image-ssr-hydration-mismatch&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/image-ssr-hydration-mismatch&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/image-ssr-hydration-mismatch?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4598/builds/690821) or the icon next to each commit SHA.
  > [vc]: #9EnhGTEjVdKbV23IWMvUDcLy+TgapbpHv/y3v2Y1FPU=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX2Y1SWtXeUNMQVdIOFp4TE9lcXY2NXlRSDBoZnMiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1maXgtaW1hZ2Utc3NyLWh5ZHJhdGlvbi1taXNtYXRjaC1yc3VpdGUudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vcnN1aXRlL3JzdWl0ZS1zdG9yeWJvb2svOWhoR2hYb3dpS3RuRFVxOENtN2pxS055R0FVeCIsInByZXZpZXdVcmwiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1maXgtaW1hZ2Utc3NyLWh5ZHJhdGlvbi1taXNtYXRjaC1yc3VpdGUudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6InJzdWl0ZS1tYWluIiwicHJvamVjdElkIjoicHJqX215SGprUjBtSWVyaDhEeDllQjRWVjRwck8zM0ciLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOiJkb2NzIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6InJzdWl0ZS1tYWluLWdpdC1maXgtaW1hZ2Utc3NyLWh5ZHJhdGlvbi1taXNtYXRjaC1y

- **Issue #4597** (2026-08-21): **SSR hydration mismatch on Image: client adds data-rs="box" and rs-box-* class, server does not**
  *Symptoms*: ### What version of rsuite are you using?  6.2.2  ### What version of React are you using?  19.2.x  ### What version of TypeScript are you using (if any)?  _No response_  ### What browser are you using?  Chrome  ### Describe the Bug  When `<Image>` is rendered with SSR, React hydration warns that the server HTML does not match the client render.  The mismatch is only on the underlying `<img>`:  | | Server | Client | |---|---|---| | `data-rs` | `null` / omitted | `"box"` | | `className` | `rs-image rs-image-rounded` | `rs-image rs-image-rounded rs-box-_R_…` |  React reports:  > A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.  This matches the “server/client branch (`typeof window !== 'undefined'` / `canUseDOM`)” class of hydration bugs.  ### Expected Behavior  Server HTML and the first client render should produce the same attributes on <img> (data-rs and className included).  ### To Reproduce  SSR + React 19 (also reproduced on Meteor `hydrateRoot`). Next.js App Router is enough:  ```tsx import { Image, CustomProvider } from 'rsuite';  export default function Page() {   return (     <CustomProvider>       <Image         alt="demo"         src="/demo.png"         srcSet="/demo.png 1x, /demo@2x.png 2x"         fit="cover"         position="top"         loading="lazy"       />     </CustomProvider>   ); } ```  Open the page with JavaScript enabled after SSR. The hydration warning points at the <img> inside Image → Box.  No widt
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. This was a real SSR hydration issue caused by DOM-dependent CSS property detection in `Box`: native image attributes such as `src` could be classified differently during server rendering and the browser's first render.  This has been fixed in #4598. `Box` and styled-system now use a deterministic static property allow-list, so the server markup and the initial client markup remain consistent while `src`, `srcSet`, `loading`, `alt`, and other native attributes continue to be passed to the `<img>` element.  The fix also includes a real Node SSR → Chromium `hydrateRoot` regression test to prevent this mismatch from returning.  The fix is available in [rsuite v6.2.4](https://github.com/rsuite/rsuite/releases/tag/v6.2.4). Please upgrade to `rsuite@6.2.4` or later. Thanks again! 

- **Issue #4596** (2026-08-21): **fix(DatePicker): calculate disabled months correctly**
  *Symptoms*: ## Summary  - calculate the number of days from the current 1-based `PlainYearMonth` instead of the previous month - prevent overflow dates such as April 31 and June 31 from making fully disabled months appear selectable - align the DatePicker month-disable comment with the existing all-days-disabled behavior - add utility coverage for leap years, February, 30-day months, and 31-day months, plus a DatePicker regression for January through June  ## Test plan  - `npx vitest run src/internals/utils/date/test/plainDate.spec.ts src/DatePicker/test/DatePicker.spec.tsx` (140 passed, 1 skipped) - `npx vitest run src/Calendar/test` (149 passed) - `npm run lint:ts` - `npm run format:check`  Closes #4594
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/4594-date-picker-disabled-month?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/4594-date-picker-disabled-month&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/4594-date-picker-disabled-month&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/4594-date-picker-disabled-month?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4596/builds/690785) or the icon next to each commit SHA.
  > [vc]: #yqcIEzw60zjtbg4uHCoeEosYwR73eMblFmrRpr8z79w=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtbWFpbiIsInByb2plY3RJZCI6InByal9teUhqa1IwbUllcmg4RHg5ZUI0VlY0cHJPMzNHIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiZG9jcyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtbWFpbi1naXQtZml4LTQ1OTQtZGF0ZS1waWNrZXItZGlzYWJsZWQtbW9udGgtcnN1aXRlLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3JzdWl0ZS9yc3VpdGUtbWFpbi9GamRFUnJGdjFpU0NqQ1pvU3FLVGNzeHV2RWY3IiwicHJldmlld1VybCI6InJzdWl0ZS1tYWluLWdpdC1maXgtNDU5NC1kYXRlLXBpY2tlci1kaXNhYmxlZC1tb250aC1yc3VpdGUudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6InJzdWl0ZS12NSIsInByb2plY3RJZCI6InByal80ZFZGQUt2OHR2YjVTOXRBYWxJdDhhMnlUTTd3Iiwicm9vdERpcmVjdG9yeSI6ImRvY3MiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9yc3VpdGUvcnN1aXRlLXY1L0JwQ3Bkb2hCRUhDamY5NXZBWExH

- **Issue #4595** (2026-08-21): **fix(picker): expose responsive control for all pickers**
  *Symptoms*: ## Summary  - expose `responsive` from the shared `PickerBaseProps` and explicitly thread it through all picker triggers - preserve existing defaults while allowing positioned popups with `responsive={false}` inside Modal and Drawer overlays - add a searchable responsive Drawer experience for InputPicker and TagPicker, including focus management, filtering, keyboard selection, and creatable tags - keep AutoComplete non-responsive and exclude the prop from its public API - update bilingual documentation, responsive examples, and generated API metadata for all 12 pickers  ## Test plan  - `npx vitest run` for SelectPicker, CheckPicker, TreePicker, CheckTreePicker, Cascader, MultiCascader, DatePicker, DateRangePicker, TimePicker, TimeRangePicker, InputPicker, and TagPicker (1109 passed, 3 skipped) - `npm run lint:ts` - `npx eslint test/cases/testPickers.tsx` - `npm run format:check` - `npm --prefix docs run generate-types` - generated API validation confirming the 12 pickers expose `responsive` and AutoComplete does not  Closes #4592
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/4592-picker-responsive?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/4592-picker-responsive&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/4592-picker-responsive&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/4592-picker-responsive?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4595/builds/690784) or the icon next to each commit SHA.
  > [vc]: #81UTarGWk6iwQKaWRmNDp3BSUH0AM5/Kjl3miR9CUwE=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX2Y1SWtXeUNMQVdIOFp4TE9lcXY2NXlRSDBoZnMiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1maXgtNDU5Mi1waWNrZXItcmVzcG9uc2l2ZS1yc3VpdGUudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vcnN1aXRlL3JzdWl0ZS1zdG9yeWJvb2svQXlxTmhKZjNpeDdaR0VONGVHOWUyWngzR2JHciIsInByZXZpZXdVcmwiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1maXgtNDU5Mi1waWNrZXItcmVzcG9uc2l2ZS1yc3VpdGUudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6InJzdWl0ZS1tYWluIiwicHJvamVjdElkIjoicHJqX215SGprUjBtSWVyaDhEeDllQjRWVjRwck8zM0ciLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOiJkb2NzIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6InJzdWl0ZS1tYWluLWdpdC1maXgtNDU5Mi1waWNrZXItcmVzcG9uc2l2ZS1yc3VpdGUudmVyY2VsLmFwcCJ9

- **Issue #4594** (2026-08-21): **DatePicker -  shouldDisableDate**
  *Symptoms*: ### What version of rsuite are you using?  ^6.2.2  ### What version of React are you using?  ^19.2.7  ### What version of TypeScript are you using (if any)?  _No response_  ### What browser are you using?  Chrome  ### Describe the Bug  DatePicker component is not processing values from props correctly.   First bug: `shouldDisableDate={(date) => {                                     const month = date.getMonth()                                     return month < 4                                 }}`   <img width="601" height="375" alt="Image" src="https://github.com/user-attachments/assets/a9aef14a-490c-4e8e-b968-119059db5998" />  In the right way, component should to return only valids months from May. But user can click on April as well, after that - component will change border color to sign unwanted value - but its pointles...  Second bug: `shouldDisableDate={(date) => {                                     const month = date.getMonth()                                     return month <= 5                                 }}`  <img width="595" height="369" alt="Image" src="https://github.com/user-attachments/assets/6e088771-2f22-4a0a-9bdf-a291e2710a70" />  component should only return months lower than June. As you can see on the second img, user can also select Jun as well. Which is also undesirable.      ### Expected Behavior  _No response_  ### To Reproduce  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. This was a confirmed bug and has been fixed in **v6.2.3** via #4596.  The month view was calculating the number of days from the previous month. For 30-day months such as April and June, it consequently checked a nonexistent 31st day, which JavaScript normalized into the following month. That made a fully disabled month appear selectable even though the selected value was later marked invalid.  The month-day calculation and regression coverage for February, leap years, 30-day months, and 31-day months have now been corrected. Your first predicate is valid; as a reminder, `Date#getMonth()` is zero-based, so `month <= 5` disables January through June.  Please upgrade to `rsuite@6.2.3` and let us know if the issue persists.
  > Hi, Simon,  thanks for quick response. After update, it works very well and without any problems now :).  

- **Issue #4592** (2026-08-21): **CheckPicker doesn't expose responsive={false}**
  *Symptoms*: ### What version of rsuite are you using?  6.2.1  ### What version of React are you using?  18  ### What version of TypeScript are you using (if any)?  5.9.3  ### What browser are you using?  Chrome  ### Describe the Bug  CheckPicker and SelectPicker behaviour in mobile pops up a drawer on mobile. This is not ideal when filter is in drawer or modal and creates multiple overlays.   ### Expected Behavior  Expose responsive={false} which behaves like desktop dropdown  ### To Reproduce  See examples on mobile https://www.rsuitejs.com/components/checkbox/
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. This has been fixed in **v6.2.3** via #4595.  Picker components now expose the `responsive` prop. In particular, you can keep a positioned popup at every viewport size when a picker is already inside a Modal or Drawer:  ```jsx <CheckPicker responsive={false} /> ```  Setting `responsive` to `true` uses the full-width Drawer on extra-small screens, while omitting it preserves each picker's existing default behavior. Please upgrade to `rsuite@6.2.3` and let us know if you encounter any further issues.

- **Issue #4590** (2026-07-15): **docs(i18n): add missing supported locales**
  *Symptoms*: This pull request updates the language documentation to include two additional supported languages. The changes ensure that both the English and Chinese guides reflect the latest list of available languages.  **Documentation updates:**  * Added Gujarati (`gu-IN`, `guIN`) and Norwegian Bokmål (`nb-NO`, `nbNO`) to the list of supported languages in the English guide (`docs/pages/guide/i18n/en-US/index.md`). * Added Gujarati (`gu-IN`, `guIN`) and Norwegian Bokmål (`nb-NO`, `nbNO`) to the list of supported languages in the Chinese guide (`docs/pages/guide/i18n/zh-CN/index.md`).
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/docs/add-missing-locales?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=docs/add-missing-locales&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=docs/add-missing-locales&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/docs/add-missing-locales?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4590/builds/688342) or the icon next to each commit SHA.
  > [vc]: #JedkRujuhEEAG+BljR/g+D+kBen2i3mTtHk9xOwN0Es=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX2Y1SWtXeUNMQVdIOFp4TE9lcXY2NXlRSDBoZnMiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1kb2NzLWFkZC1taXNzaW5nLWxvY2FsZXMtcnN1aXRlLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3JzdWl0ZS9yc3VpdGUtc3Rvcnlib29rLzVKd25xN29LUW1xR1NENUtSOWVqdGRrZXVMbTUiLCJwcmV2aWV3VXJsIjoicnN1aXRlLXN0b3J5Ym9vay1naXQtZG9jcy1hZGQtbWlzc2luZy1sb2NhbGVzLXJzdWl0ZS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn0seyJuYW1lIjoicnN1aXRlLW1haW4iLCJwcm9qZWN0SWQiOiJwcmpfbXlIamtSMG1JZXJoOER4OWVCNFZWNHByTzMzRyIsInYwIjpmYWxzZSwicm9vdERpcmVjdG9yeSI6ImRvY3MiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicnN1aXRlLW1haW4tZ2l0LWRvY3MtYWRkLW1pc3NpbmctbG9jYWxlcy1yc3VpdGUudmVyY2VsLmFwcCJ9LCJpbnNw

- **Issue #4589** (2026-07-15): **fix(ci): use Node 24 for npm publishing**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/npm-publish-workflow?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/npm-publish-workflow&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/npm-publish-workflow&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/npm-publish-workflow?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4589/builds/688311) or the icon next to each commit SHA.
  > ## [Codecov](https://app.codecov.io/gh/rsuite/rsuite/pull/4589?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 94.60%. Comparing base ([`d567712`](https://app.codecov.io/gh/rsuite/rsuite/commit/d5677123f767d38ccbf804f83386bbce828a22ca?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite)) to head ([`4d89700`](https://app.codecov.io/gh/rsuite/rsuite/commit/4d8970067446b21c41d04415f0134eb9073d382d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite)). :warning: Report is 1 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/rsuite/rsuite/pull/458

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

### Incident Patch 1: `decbdbe3` (2026-08-21)
**Commit Message**: fix(Box): make CSS prop detection SSR-safe (#4598)

**File**: `.github/workflows/nodejs-ci.yml` (modified, +4/-0)
```diff
@@ -91,6 +91,10 @@ jobs:
           CI: true
           BROWSER: ${{ matrix.browser }}
 
+      - name: Run SSR hydration tests
+        if: ${{ matrix.browser == 'chromium' }}
+        run: npm run test:ssr
+
       - name: Upload coverage to Codecov
         uses: codecov/codecov-action@v4.2.0
         with:
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@
     "test:ci": "cross-env RUN_ENV=ci vitest --run --coverage",
     "test:component": "cross-env RUN_ENV=test vitest --run",
     "test:coverage": "cross-env RUN_ENV=test vitest --run --coverage",
+    "test:ssr": "cross-env RUN_ENV=ssr vitest --run",
     "prepare": "husky install",
     "release": "node scripts/release.js",
     "version": "npm run changelog && git add -A",
```

**File**: `src/Image/test/Image.spec.tsx` (modified, +36/-0)
```diff
@@ -3,6 +3,7 @@ import Image from '../Image';
 import { describe, expect, it } from 'vitest';
 import { render, screen, waitFor } from '@testing-library/react';
 import { testStandardProps } from '@test/cases';
+import CustomProvider from '@/CustomProvider';
 
 describe('Image', () => {
   testStandardProps(<Image />);
@@ -82,6 +83,41 @@ describe('Image', () => {
     expect(screen.getByRole('img')).to.have.attr('loading', 'lazy');
   });
 
+  it('Should not treat native image props as Box style props', () => {
+    render(
+      <CustomProvider>
+        <Image
+          alt="demo"
+          src="/demo.png"
+          srcSet="/demo.png 1x, /demo@2x.png 2x"
+          fit="cover"
+          position="top"
+          loading="lazy"
+        />
+      </CustomProvider>
+    );
+
+    const image = screen.getByRole('img');
+
+    expect(image).to.not.have.attr('data-rs');
+    expect(image.className).to.not.match(/\brs-box-/);
+    expect(image).to.have.attr('src', '/demo.png');
+    expect(image).to.have.attr('srcset', '/demo.png 1x, /demo@2x.png 2x');
+    expect(image).to.have.attr('loading', 'lazy');
+    expect(image).to.have.style('--rs-object-fit', 'cover');
+    expect(image).to.have.style('--rs-object-position', 'top');
+  });
+
+  it('Should enable Box styling when a supported style prop is provided', () => {
+    render(<Image src="/demo.png" transform="scale(1)" />);
+
+    const image = screen.getByRole('img');
+
+    expect(image).to.have.attr('data-rs', 'box');
+    expect(image.className).to.match(/\brs-box-/);
+    expect(image).to.have.attr('src', '/demo.png');
+  });
+
   it('Should load fallback image when main image fails to load', async () => {
     const invalidSrc = 'invalid-image-url';
     const fallbackSrc = 'fallback-image-url';
```

**File**: `src/Image/test/Image.ssr.test.tsx` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import React from 'react';
+import type { AddressInfo } from 'node:net';
+import { afterAll, beforeAll, describe, expect, it } from 'vitest';
+import { renderToString } from 'react-dom/server';
+import { chromium, type Browser } from 'playwright';
+import react from '@vitejs/plugin-react';
+import { createServer, type ViteDevServer } from 'vite';
+import tsconfigPaths from 'vite-tsconfig-paths';
+import ImageHydrationFixture from './ImageHydrationFixture';
+import type { HydrationResult } from './ImageHydration.client';
+
+const transparentPng = Buffer.from(
+  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
+  'base64'
+);
+
+describe('Image SSR hydration', () => {
+  let browser: Browser;
+  let server: ViteDevServer;
+  let serverMarkup: string;
+  let serverUrl: string;
+
+  beforeAll(async () => {
+    serverMarkup = renderToString(<ImageHydrationFixture />);
+
+    server = await createServer({
+      appType: 'custom',
+      configFile: false,
+      logLevel: 'silent',
+      plugins: [tsconfigPaths(), react()],
+      root: process.cwd(),
+      server: {
+        host: '127.0.0.1',
+        port: 0
+      }
+    });
+
+    server.middlewares.use(async (request, response, next) => {
+      if (request.url === '/demo.png' || request.url === '/demo@2x.png') {
+        response.statusCode = 200;
+        response.setHeader('Content-Type', 'image/png');
+        response.end(transparentPng);
+        return;
+      }
+
+      if (request.url !== '/') {
+        next();
+        return;
+      }
+
+      const html = await server.transformIndexHtml(
+        '/',
+        `<!doctype html>
+          <html>
+            <head><meta charset="UTF-8" /></head>
+            <body>
+              <div id="root">${serverMarkup}</div>
+              <script type="module" src="/src/Image/test/ImageHydration.client.tsx"></script>
+            </body>
+          </html>`
+      );
+
+      response.statusCode = 200;
+      response.setHeader('Content-Type', 'text/html');
+      response.end(html);
+    });
+
+    await server.listen();
+
+    const address = server.httpServer?.address() as AddressInfo;
+    serverUrl = `http://127.0.0.1:${address.port}`;
+    browser = await chromium.launch({ headless: true });
+  });
+
+  afterAll(async () => {
+    await browser?.close();
+    await server?.close();
+  });
+
+  it('hydrates without changing Image attributes or reporting errors', async () => {
+    expect(serverMarkup).not.toContain('data-rs="box"');
+    expect(serverMarkup).not.toMatch(/\brs-box-/);
+
+    const page = await browser.newPage();
+    const consoleErrors: string[] = [];
+
+    page.on('console', message => {
+      if (message.type() === 'error') {
+        consoleErrors.push(message.text());
+      }
+    });
+
+    await page.goto(serverUrl);
+    await page.waitForFunction(() => Boolean(window.__RSUITE_HYDRATION_RESULT__));
+
+    const result = await page.evaluate(() => window.__RSUITE_HYDRATION_RESULT__ as HydrationResult);
+    const imageAttributes = await page.locator('img').evaluate(image => ({
+      className: image.className,
+      dataRs: image.getAttribute('data-rs'),
+      loading: image.getAttribute('loading'),
+      src: image.getAttribute('src'),
+      srcSet: image.getAttribute('srcset')
+    }));
+
+    expect(result.errors).toEqual([]);
+    expect(consoleErrors).toEqual([]);
+    expect(result.hydratedMarkup).toBe(result.initialMarkup);
+    expect(imageAttributes).toMatchObject({
+      dataRs: null,
+      loading: 'lazy',
+      src: '/demo.png',
+      srcSet: '/demo.png 1x, /demo@2x.png 2x'
+    });
+    expect(imageAttributes.className).not.toMatch(/\brs-box-/);
+
+    await page.close();
+  });
+});
```

**File**: `src/Image/test/ImageHydration.client.tsx` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import React from 'react';
+import { hydrateRoot } from 'react-dom/client';
+import ImageHydrationFixture from './ImageHydrationFixture';
+
+export interface HydrationResult {
+  errors: string[];
+  initialMarkup: string;
+  hydratedMarkup: string;
+}
+
+declare global {
+  interface Window {
+    __RSUITE_HYDRATION_RESULT__?: HydrationResult;
+  }
+}
+
+const container = document.getElementById('root');
+
+if (!container) {
+  throw new Error('Missing hydration root');
+}
+
+const errors: string[] = [];
+const initialMarkup = container.innerHTML;
+const originalConsoleError = console.error;
+
+console.error = (...args: unknown[]) => {
+  errors.push(args.map(String).join(' '));
+  originalConsoleError(...args);
+};
+
+hydrateRoot(container, <ImageHydrationFixture />, {
+  onRecoverableError(error) {
+    errors.push(error instanceof Error ? error.message : String(error));
+  }
+});
+
+requestAnimationFrame(() => {
+  requestAnimationFrame(() => {
+    window.__RSUITE_HYDRATION_RESULT__ = {
+      errors,
+      initialMarkup,
+      hydratedMarkup: container.innerHTML
+    };
+  });
+});
```

---

### Incident Patch 2: `54592f7a` (2026-08-21)
**Commit Message**: fix(DatePicker): calculate disabled months correctly (#4596)

**File**: `src/DatePicker/DatePicker.tsx` (modified, +1/-1)
```diff
@@ -360,7 +360,7 @@ const DatePicker = forwardRef<'div', DatePickerProps>((props: DatePickerProps, r
 
   /**
    * Check whether the month is disabled.
-   * If any day in the month is disabled, the entire month is disabled
+   * If every day in the month is disabled, the entire month is disabled.
    */
   const isMonthDisabled = (date: Date): boolean => {
     return isEveryDateInMonth(date.getFullYear(), date.getMonth(), isDateDisabled);
```

**File**: `src/DatePicker/test/DatePicker.spec.tsx` (modified, +11/-5)
```diff
@@ -1160,20 +1160,26 @@ describe('DatePicker', () => {
           shouldDisableDate={date => {
             const month = date.getMonth();
             const year = date.getFullYear();
-            return month === 0 && year === 2024;
+            return month <= 5 && year === 2024;
           }}
           onSelect={onSelect}
           format="yyyy-MM"
           open
         />
       );
 
-      const gridcell = screen.getByRole('gridcell', { name: 'Jan 2024' });
+      const january = screen.getByRole('gridcell', { name: 'Jan 2024' });
+      const april = screen.getByRole('gridcell', { name: 'Apr 2024' });
+      const june = screen.getByRole('gridcell', { name: 'Jun 2024' });
+      const july = screen.getByRole('gridcell', { name: 'Jul 2024' });
 
-      expect(gridcell).to.have.class('disabled');
-      expect(gridcell).to.have.attribute('aria-disabled', 'true');
+      expect(january).to.have.class('disabled');
+      expect(april).to.have.class('disabled');
+      expect(june).to.have.class('disabled');
+      expect(july).not.to.have.class('disabled');
+      expect(june).to.have.attribute('aria-disabled', 'true');
 
-      fireEvent.click(gridcell);
+      fireEvent.click(june);
 
       expect(onSelect).not.toHaveBeenCalled();
     });
```

**File**: `src/internals/utils/date/plainDate.ts` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ export function plainYearMonthToString(yearMonth: PlainYearMonth): string {
  * @see https://tc39.es/proposal-temporal/docs/plainyearmonth.html#daysInMonth
  */
 function getDaysInMonth(yearMonth: PlainYearMonth): number {
-  return new Date(yearMonth.year, yearMonth.month - 1, 0).getDate();
+  return new Date(yearMonth.year, yearMonth.month, 0).getDate();
 }
 
 export function isEveryDayInMonth(
```

**File**: `src/internals/utils/date/test/plainDate.spec.ts` (modified, +18/-2)
```diff
@@ -1,5 +1,5 @@
-import { describe, test, expect } from 'vitest';
-import { isSameDay, addDays } from '../plainDate';
+import { describe, test, expect, vi } from 'vitest';
+import { isSameDay, addDays, isEveryDayInMonth } from '../plainDate';
 
 describe('isSameDay', () => {
   test('should return true if year, month, day all match', () => {
@@ -28,3 +28,19 @@ describe('addDays', () => {
     expect(addDays(date, 365)).toEqual({ year: 2026, month: 8, day: 9 });
   });
 });
+
+describe('isEveryDayInMonth', () => {
+  test.each([
+    [2023, 2, 28],
+    [2024, 2, 29],
+    [2024, 4, 30],
+    [2024, 6, 30],
+    [2024, 7, 31]
+  ])('should check every day in %i-%i', (year, month, daysInMonth) => {
+    const predicate = vi.fn(() => true);
+
+    expect(isEveryDayInMonth({ year, month }, predicate)).toBe(true);
+    expect(predicate).toHaveBeenCalledTimes(daysInMonth);
+    expect(predicate).toHaveBeenLastCalledWith({ year, month, day: daysInMonth });
+  });
+});
```

---

### Incident Patch 3: `c5d592f5` (2026-08-21)
**Commit Message**: fix(picker): expose responsive popup control (#4595)

**File**: `docs/pages/components/cascader/en-US/index.md` (modified, +3/-0)
```diff
@@ -52,6 +52,8 @@ This tree allows the use of the `getChildren` option and the length of the child
 
 ## Responsive
 
+On extra-small screens, the popup is displayed as a full-width Drawer by default. Set `responsive={false}` to keep a positioned popup, such as when the picker is already inside a Modal or Drawer.
+
 <!--{include:<example-responsive>}-->
 
 ## Accessibility
@@ -122,6 +124,7 @@ This tree allows the use of the `getChildren` option and the length of the child
 | renderSearchItem   | (node: ReactNode, items: [Option][item][]) => ReactNode                           | Custom render function for search result items              |
 | renderTreeNode     | (node: ReactNode, item: [Option][item]) => ReactNode                              | Custom render function for tree nodes                       |
 | renderValue        | (value: string, selectedPaths: [Option][item][], selected:ReactNode) => ReactNode | Custom render function for selected items                   |
+| responsive         | boolean `(true)`                                                                  | Whether to display the popup as a full-width Drawer on extra-small screens |
 | searchable         | boolean `(true)`                                                                  | Whether the component is searchable                         |
 | size               | 'lg' \| 'md' \| 'sm' \| 'xs' `('md')`                                             | Size of the component                                       |
 | toggleAs           | ElementType `('a')`                                                               | Custom element for the component                            |
```

**File**: `docs/pages/components/cascader/zh-CN/index.md` (modified, +3/-0)
```diff
@@ -52,6 +52,8 @@
 
 ## 响应式
 
+在超小屏幕上，弹出层默认显示为全宽 Drawer。当选择器已经位于 Modal 或 Drawer 中时，可设置 `responsive={false}` 保持定位浮层，避免嵌套遮罩。
+
 <!--{include:<example-responsive>}-->
 
 ## 可访问性
@@ -122,6 +124,7 @@
 | renderSearchItem   | (node: ReactNode, items: [Option][item][]) => ReactNode                          | 自定义渲染搜索结果选项                             |
 | renderTreeNode     | (node: ReactNode, item: [Option][item]) => ReactNode                             | 自定义选项                                         |
 | renderValue        | (value:string, selectedPaths: [Option][item][], selected:ReactNode) => ReactNode | 自定义被选中的选项                                 |
+| responsive         | boolean `(true)`                                                                 | 是否在超小屏幕上将弹出层显示为全宽 Drawer          |
 | searchable         | boolean `(true)`                                                                 | 可以搜索                                           |
 | size               | 'lg' \| 'md' \| 'sm' \| 'xs' `('md')`                                            | 设置组件尺寸                                       |
 | toggleAs           | ElementType `('a')`                                                              | 为组件自定义元素类型                               |
```

**File**: `docs/pages/components/check-picker/en-US/index.md` (modified, +3/-0)
```diff
@@ -81,6 +81,8 @@ Customize a select all function.
 
 ## Responsive
 
+On extra-small screens, the popup is displayed as a full-width Drawer by default. Set `responsive={false}` to keep a positioned popup, such as when the picker is already inside a Modal or Drawer.
+
 <!--{include:<example-responsive>}-->
 
 ## Accessibility
@@ -150,6 +152,7 @@ Customize a select all function.
 | renderOption       | (label: ReactNode, item:[Option][item]) => ReactNode                              | Custom render function for options                          |
 | renderOptionGroup  | (title: ReactNode, item:[Option][item]) => ReactNode                              | Custom render function for option groups                    |
 | renderValue        | (value: [Value][value], items: [Option][item][], selected:ReactNode) => ReactNode | Custom render function for selected items                   |
+| responsive         | boolean `(true)`                                                                  | Whether to display the popup as a full-width Drawer on extra-small screens |
 | searchable         | boolean `(true)`                                                                  | Whether to display search input box                         |
 | searchBy           | (keyword: string, label: ReactNode, item: Option) => boolean                      | Custom search function                                      |
 | size               | 'lg' \| 'md' \| 'sm' \| 'xs' `('md')`                                             | Size of the picker                                          |
```

**File**: `docs/pages/components/check-picker/zh-CN/index.md` (modified, +3/-0)
```diff
@@ -81,6 +81,8 @@
 
 ## 响应式
 
+在超小屏幕上，弹出层默认显示为全宽 Drawer。当选择器已经位于 Modal 或 Drawer 中时，可设置 `responsive={false}` 保持定位浮层，避免嵌套遮罩。
+
 <!--{include:<example-responsive>}-->
 
 ## 可访问性
@@ -150,6 +152,7 @@
 | renderOption       | (label: ReactNode, item: [Option][item]) => ReactNode                 | 自定义选项                           |
 | renderOptionGroup  | (title: ReactNode, item: [Option][item]) => ReactNode                 | 自定义选项组                         |
 | renderValue        | (value: [Value][value], items: any[],selected:ReactNode) => ReactNode | 自定义被选中的选项                   |
+| responsive         | boolean `(true)`                                                      | 是否在超小屏幕上将弹出层显示为全宽 Drawer |
 | searchable         | boolean `(true)`                                                      | 可以搜索                             |
 | searchBy           | (keyword: string, label: ReactNode, item: [Option][item]) => boolean  | 自定义搜索规则                       |
 | size               | 'lg' \| 'md' \| 'sm' \| 'xs' `('md')`                                 | 设置组件尺寸                         |
```

**File**: `docs/pages/components/check-tree-picker/en-US/index.md` (modified, +3/-0)
```diff
@@ -52,6 +52,8 @@ The cascade attribute can set whether or not CheckTreePicker can consider the ca
 
 ## Responsive
 
+On extra-small screens, the popup is displayed as a full-width Drawer by default. Set `responsive={false}` to keep a positioned popup, such as when the picker is already inside a Modal or Drawer.
+
 <!--{include:<example-responsive>}-->
 
 ## Accessibility
@@ -141,6 +143,7 @@ The cascade attribute can set whether or not CheckTreePicker can consider the ca
 | renderTreeIcon          | (item:[TreeNode][node], expanded: boolean) => ReactNode                                        | Custom render tree node icon                                |
 | renderTreeNode          | (item:[TreeNode][node]) => ReactNode                                                           | Custom render tree node                                     |
 | renderValue             | (values:string[], checkedItems:[TreeNode][node][],selectedElement: ReactNode) => ReactNode     | Custom render selected items                                |
+| responsive              | boolean `(true)`                                                                               | Whether to display the popup as a full-width Drawer on extra-small screens |
 | searchable              | boolean `(true)`                                                                               | Whether display search input box                            |
 | searchBy                | (keyword: string, label: ReactNode, item: [TreeNode][node]) => boolean                         | Custom search method                                        |
 | showIndentLine          | boolean                                                                                        | Whether to show the indent line                             |
```

---

### Incident Patch 4: `d5e12c76` (2026-08-09)
**Commit Message**: fix(ci): select npm dist-tag for releases

**File**: `.github/workflows/nodejs-publish.yml` (modified, +21/-1)
```diff
@@ -25,6 +25,26 @@ jobs:
         run: npm i --legacy-peer-deps
       - name: Build
         run: npm run build
+      - name: Resolve npm dist-tag
+        id: npm-dist-tag
+        shell: bash
+        run: |
+          VERSION=$(node -p "require('./lib/package.json').version")
+          TAG_VERSION="${GITHUB_REF_NAME#v}"
+
+          if [ "$VERSION" != "$TAG_VERSION" ]; then
+            echo "::error::Git tag $GITHUB_REF_NAME does not match package version $VERSION"
+            exit 1
+          fi
+
+          case "$VERSION" in
+            *-canary|*-canary.*|*-canary-*) DIST_TAG=canary ;;
+            *-*) DIST_TAG=next ;;
+            *) DIST_TAG=latest ;;
+          esac
+
+          echo "tag=$DIST_TAG" >> "$GITHUB_OUTPUT"
+          echo "Publishing rsuite@$VERSION with dist-tag $DIST_TAG"
       - name: Publish
         working-directory: ./lib
-        run: npm publish --access public --provenance
+        run: npm publish --tag "${{ steps.npm-dist-tag.outputs.tag }}" --access public --provenance
```

---

### Incident Patch 5: `7b354c4c` (2026-07-15)
**Commit Message**: fix(ci): use Node 24 for npm publishing (#4589)

**File**: `.github/workflows/nodejs-publish.yml` (modified, +1/-3)
```diff
@@ -19,10 +19,8 @@ jobs:
       # Setup .npmrc file to publish to npm
       - uses: actions/setup-node@v4
         with:
-          node-version: '20.x'
+          node-version: '24.x'
           registry-url: 'https://registry.npmjs.org'
-      - name: Upgrade npm to latest
-        run: npm install -g npm@latest
       - name: Install dependencies
         run: npm i --legacy-peer-deps
       - name: Build
```

---

### Incident Patch 6: `2bd4f655` (2026-07-15)
**Commit Message**: fix(docs): repair online sandbox examples (#4588)

**File**: `docs/components/CodeView/CodeView.tsx` (modified, +15/-6)
```diff
@@ -12,7 +12,7 @@ import AdCarbonInline from '../AdCarbon/AdCarbonInline';
 import { Divider, IconButton, Tooltip, Whisper, Placeholder } from 'rsuite';
 import { TransparentIcon, CodesandboxIcon, StackBlitzIcon } from '@/components/icons';
 import { useApp } from '@/hooks/useApp';
-import { html, css, dependencies as codeDependencies } from './utils';
+import { viteHtml, css, dependencies as codeDependencies, createVitePackageJson } from './utils';
 
 export interface CustomCodeViewProps {
   className?: string;
@@ -85,20 +85,29 @@ const CodeView = (props: CustomCodeViewProps) => {
 
   const openStackBlitz = useCallback(() => {
     const depsFiles = {};
+    const projectDependencies = { ...codeDependencies, ...sandboxDependencies };
 
     sandboxFiles?.forEach(file => {
-      depsFiles[file.name] = file.content;
+      depsFiles[`src/${file.name}`] = file.content;
     });
 
     const project: Project = {
       title: 'rsuite example',
       description: 'Example from rsuitejs.com',
-      template: 'create-react-app',
-      dependencies: { ...codeDependencies, ...sandboxDependencies },
-      files: { 'index.js': code, 'index.html': html, 'styles.css': css, ...depsFiles }
+      template: 'node',
+      files: {
+        'package.json': createVitePackageJson(projectDependencies),
+        'index.html': viteHtml,
+        'src/index.jsx': code,
+        'src/styles.css': css,
+        ...depsFiles
+      }
     };
 
-    stackBlitzSDK.openProject(project);
+    stackBlitzSDK.openProject(project, {
+      openFile: 'src/index.jsx',
+      startScript: 'dev'
+    });
   }, [code, sandboxFiles, sandboxDependencies]);
 
   const withWhisper = useCallback(
```

**File**: `docs/components/CodeView/utils.ts` (modified, +22/-2)
```diff
@@ -1,9 +1,29 @@
 export const html = '<div id="root"></div>';
+export const viteHtml = `${html}\n<script type="module" src="/src/index.jsx"></script>`;
 export const css = '@import "rsuite/dist/rsuite.css";\n\n#root{ padding: 10px; }';
 export const dependencies = {
-  react: '^17.0.0 || ^18.0.0',
-  'react-dom': '^17.0.0 || ^18.0.0',
+  react: '^18.0.0',
+  'react-dom': '^18.0.0',
   rsuite: 'latest',
   '@rsuite/icons': 'latest',
   '@babel/runtime': '^7.8.4'
 };
+
+export function createVitePackageJson(projectDependencies: Record<string, string>) {
+  return JSON.stringify(
+    {
+      name: 'rsuite-example',
+      private: true,
+      version: '0.0.0',
+      scripts: {
+        dev: 'vite --host 0.0.0.0'
+      },
+      dependencies: projectDependencies,
+      devDependencies: {
+        vite: '^7.0.0'
+      }
+    },
+    null,
+    2
+  );
+}
```

---

### Incident Patch 7: `81c0b0fb` (2026-07-02)
**Commit Message**: fix(InputPicker): ignore Enter during IME composition when selecting an item (#4585)

**File**: `src/InputPicker/InputPicker.tsx` (modified, +5/-0)
```diff
@@ -369,6 +369,11 @@ const InputPicker = forwardRef<'div', InputPickerProps>((props, ref) => {
   });
 
   const handleMenuItemKeyPress = useEventCallback((event: React.KeyboardEvent) => {
+    // When composing, ignore the keypress event.
+    if (event.nativeEvent.isComposing) {
+      return;
+    }
+
     if (!focusItemValue || !controlledData) {
       return;
     }
```

**File**: `src/InputPicker/test/InputPicker.spec.tsx` (modified, +9/-0)
```diff
@@ -296,6 +296,15 @@ describe('InputPicker', () => {
     expect(onChange).toHaveBeenCalledTimes(1);
   });
 
+  it('Should not call `onChange` when Enter is pressed during IME composition', () => {
+    const onChange = vi.fn();
+    render(<InputPicker defaultOpen data={data} onChange={onChange} defaultValue={'Kariane'} />);
+
+    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });
+
+    expect(onChange).not.toHaveBeenCalled();
+  });
+
   it('Should call onBlur callback', () => {
     const onBlur = vi.fn();
     render(<InputPicker data={[]} onBlur={onBlur} />);
```

---

### Incident Patch 8: `d52842b0` (2026-06-12)
**Commit Message**: fix(picker): hide caret when clear button is shown (#4581)

**File**: `src/DatePicker/test/DatePicker.spec.tsx` (modified, +14/-0)
```diff
@@ -70,6 +70,13 @@ describe('DatePicker', () => {
     expect(screen.getByTestId('picker')).to.have.attr('data-cleanable', 'true');
   });
 
+  it('Should hide the default caret when the clear button is shown', () => {
+    render(<DatePicker value={new Date()} />);
+
+    expect(screen.getByRole('button', { name: /clear/i })).to.exist;
+    expect(screen.getByTestId('picker')).to.not.have.contain('.rs-picker-caret-icon');
+  });
+
   it('Should be not cleanable', () => {
     render(<DatePicker cleanable={false} value={new Date()} />);
 
@@ -573,6 +580,13 @@ describe('DatePicker', () => {
     expect(screen.getByLabelText('gear')).to.have.class('rs-icon');
   });
 
+  it('Should hide custom caret when the clear button is shown', () => {
+    render(<DatePicker caretAs={GearIcon} value={new Date(2024, 0, 1)} />);
+
+    expect(screen.getByRole('button', { name: /clear/i })).to.exist;
+    expect(screen.queryByLabelText('gear')).to.not.exist;
+  });
+
   it('Should switch to the previous or next element via the tab key', () => {
     render(
       <>
```

**File**: `src/DateRangePicker/test/DateRangePicker.spec.tsx` (modified, +10/-2)
```diff
@@ -103,6 +103,13 @@ describe('DateRangePicker', () => {
     expect(screen.getByTestId('picker')).to.have.attr('data-cleanable', 'true');
   });
 
+  it('Should hide the default caret when the clear button is shown', () => {
+    render(<DateRangePicker value={[new Date(), new Date()]} />);
+
+    expect(screen.getByRole('button', { name: /clear/i })).to.exist;
+    expect(screen.getByTestId('picker')).to.not.have.contain('.rs-picker-caret-icon');
+  });
+
   it('Should output custom value with time', () => {
     const value = [new Date(2019, 10, 11, 1, 0, 0), new Date(2019, 10, 12, 1, 0, 0)] as [
       Date,
@@ -445,12 +452,13 @@ describe('DateRangePicker', () => {
     expect(screen.getByLabelText('gear')).to.have.class('rs-icon');
   });
 
-  it('Should render custom caret when value is set', () => {
+  it('Should hide custom caret when the clear button is shown', () => {
     render(
       <DateRangePicker caretAs={GearIcon} value={[new Date(2024, 0, 1), new Date(2024, 1, 1)]} />
     );
 
-    expect(screen.getByLabelText('gear')).to.have.class('rs-icon');
+    expect(screen.getByRole('button', { name: /clear/i })).to.exist;
+    expect(screen.queryByLabelText('gear')).to.not.exist;
   });
 
   it('Should render a custom calendar title', () => {
```

**File**: `src/internals/Picker/PickerIndicator.tsx` (modified, +14/-19)
```diff
@@ -40,31 +40,26 @@ const PickerIndicator = ({
       );
     }
 
-    const caret = caretAs && (
-      <Icon as={caretAs} className={prefix('caret-icon')} data-testid="caret" />
-    );
-    const cleanButton = showCleanButton && !disabled && (
-      <CloseButton
-        className={prefix('clean')}
-        tabIndex={-1}
-        locale={{ closeLabel: clear }}
-        onClick={onClose}
-      />
-    );
-
-    if (caret && cleanButton) {
+    if (showCleanButton && !disabled) {
       return (
-        <>
-          {caret}
-          {cleanButton}
-        </>
+        <CloseButton
+          className={prefix('clean')}
+          tabIndex={-1}
+          locale={{ closeLabel: clear }}
+          onClick={onClose}
+        />
       );
     }
 
-    return cleanButton || caret || null;
+    return caretAs && <Icon as={caretAs} className={prefix('caret-icon')} data-testid="caret" />;
   };
 
-  const props = Component === InputGroup.Addon ? { disabled } : undefined;
+  const props =
+    Component === InputGroup.Addon
+      ? { className: prefix('toggle-indicator'), disabled }
+      : Component === React.Fragment
+        ? undefined
+        : { className: prefix('toggle-indicator') };
 
   return <Component {...props}>{addon()}</Component>;
 };
```

**File**: `src/internals/Picker/styles/index.scss` (modified, +3/-0)
```diff
@@ -367,6 +367,9 @@
 
   // Picker clear button
   .rs-picker-clean {
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
     color: var(--rs-text-secondary);
     transition: 0.2s color linear;
     cursor: pointer;
```

**File**: `src/internals/Picker/test/PickerToggle.spec.tsx` (modified, +2/-2)
```diff
@@ -129,11 +129,11 @@ describe('<PickerToggle>', () => {
     expect(screen.getByTestId('caret')).to.have.class('rs-picker-caret-icon');
   });
 
-  it('Should show both caret icon and clean button when it has value', () => {
+  it('Should not show caret icon when it has value', () => {
     render(<Toggle hasValue cleanable />);
 
     expect(screen.getByRole('button', { name: /clear/i })).to.exist;
-    expect(screen.getByRole('combobox')).to.have.contain('.rs-picker-caret-icon');
+    expect(screen.getByRole('combobox')).to.not.have.contain('.rs-picker-caret-icon');
   });
 
   describe('Placement', () => {
```

---

### Incident Patch 9: `fc86644b` (2026-06-12)
**Commit Message**: fix(CheckTreePicker,CheckTree): fix infinite loop with cascade and defaultExpandAll (#4579)

* fix(CheckTreePicker,CheckTree): fix infinite loop with cascade and defaultExpandAll

The infinite loop was caused by commit afaaf2d80 which added 'data' to
Effect 2's dependency array in useFlattenTree to fix async loading via
getChildren (#3973). Having both effects depend on 'data' caused them to
overlap in responsibility, each calling forceUpdate(), creating a render
cascade when combined with useMount's value churn.

Changes:
- useFlattenTree.ts: Effect 1 now handles check state update when data
  changes (covers #3973 async load case). Effect 2 depends only on
  [value], removing the overlapping 'data' dependency that caused
  the regression.
- CheckTree/utils.ts: getCheckTreeDefaultValue now returns the original
  array reference when no values are filtered out, preventing
  unnecessary value reference changes on mount.

Closes #4541

* fix(AutoComplete): add inputRef prop to expose the underlying input element

AutoComplete did not expose a way to get a ref to the underlying
<input> element, making it impossible to programmatically focus or
access the input. Added inputRef prop whi

**File**: `src/AutoComplete/AutoComplete.tsx` (modified, +5/-0)
```diff
@@ -80,6 +80,9 @@ export interface AutoCompleteProps<T = string>
 
   /** Called on close */
   onClose?: () => void;
+
+  /** Ref to the input element */
+  inputRef?: React.Ref<HTMLInputElement>;
 }
 
 /**
@@ -122,6 +125,7 @@ const AutoComplete = forwardRef<'div', AutoCompleteProps>((props: any, ref) => {
     onFocus,
     onBlur,
     onMenuFocus,
+    inputRef,
     ...rest
   } = propsWithDefaults;
 
@@ -300,6 +304,7 @@ const AutoComplete = forwardRef<'div', AutoCompleteProps>((props: any, ref) => {
         onFocus={handleInputFocus}
         onChange={handleChange}
         onKeyDown={handleKeyDownEvent}
+        inputRef={inputRef}
       />
     </PickerToggleTrigger>
   );
```

**File**: `src/AutoComplete/test/AutoComplete.spec.tsx` (modified, +8/-0)
```diff
@@ -258,4 +258,12 @@ describe('AutoComplete', () => {
 
     expect(screen.getByTestId('test').querySelector('input')).to.have.attribute('name', 'username');
   });
+
+  it('Should expose input element via inputRef', () => {
+    const ref = React.createRef<HTMLInputElement>();
+
+    render(<AutoComplete data={data} inputRef={ref} />);
+
+    expect(ref.current).to.be.instanceOf(HTMLInputElement);
+  });
 });
```

**File**: `src/CheckTree/test/CheckTree.spec.tsx` (modified, +61/-0)
```diff
@@ -762,4 +762,65 @@ describe('CheckTree', () => {
       expect(onSearch).toHaveBeenCalled();
     });
   });
+
+  describe('Regression: Infinite loop prevention', () => {
+    it('Should render without infinite loop when using cascade with defaultExpandAll', () => {
+      const treeData = [
+        {
+          label: 'Parent',
+          value: 'parent',
+          children: [
+            { label: 'Child 1', value: 'child1' },
+            { label: 'Child 2', value: 'child2' }
+          ]
+        }
+      ];
+
+      const { container } = render(<CheckTree data={treeData} defaultExpandAll cascade />);
+
+      expect(container.firstChild).to.exist;
+      expect(screen.getByRole('tree')).to.exist;
+    });
+
+    it('Should maintain correct check state when value changes with cascade', () => {
+      const treeData = [
+        {
+          label: 'Parent',
+          value: 'parent',
+          children: [
+            { label: 'Child 1', value: 'child1' },
+            { label: 'Child 2', value: 'child2' }
+          ]
+        }
+      ];
+
+      const { rerender } = render(
+        <CheckTree data={treeData} defaultExpandAll cascade defaultValue={['child1']} />
+      );
+
+      // Initially only child1 checked, parent should be indeterminate
+      const parentCheckbox = screen.getByRole('checkbox', { name: 'Parent' });
+      expect(parentCheckbox).to.have.attribute('aria-checked', 'mixed');
+
+      // Change value to include both children, parent should become fully checked
+      rerender(
+        <CheckTree
+          data={treeData}
+          defaultExpandAll
+          cascade
+          value={['parent', 'child1', 'child2']}
+        />
+      );
+
+      expect(screen.getByRole('checkbox', { name: 'Parent' })).to.have.attribute(
+        'aria-checked',
+        'true'
+      );
+    });
+
+    // Regression test for the async load fix (#3973) that originally introduced the infinite loop.
+    // This is covered by the existing "Should load children nodes and check the state of the node"
+    // test in the "Async load children nodes" suite above, which already validates that cascading
+    // check state is correctly maintained after loading children via getChildren.
+  });
 });
```

**File**: `src/CheckTree/test/utils.spec.ts` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import { getCheckTreeDefaultValue } from '../utils';
+import { describe, expect, it } from 'vitest';
+
+describe('CheckTree utils', () => {
+  describe('getCheckTreeDefaultValue', () => {
+    it('Should return the original array reference when no values are filtered out', () => {
+      const value = ['a', 'b', 'c'];
+      const uncheckableItemValues: string[] = [];
+
+      const result = getCheckTreeDefaultValue(value, uncheckableItemValues);
+
+      expect(result).to.equal(value);
+    });
+
+    it('Should filter out uncheckable values and return a new reference', () => {
+      const value = ['a', 'b', 'c'];
+      const uncheckableItemValues = ['b'];
+
+      const result = getCheckTreeDefaultValue(value, uncheckableItemValues);
+
+      expect(result).to.not.equal(value);
+      expect(result).to.deep.equal(['a', 'c']);
+    });
+
+    it('Should preserve empty array reference', () => {
+      const value: string[] = [];
+      const uncheckableItemValues: string[] = [];
+
+      const result = getCheckTreeDefaultValue(value, uncheckableItemValues);
+
+      expect(result).to.equal(value);
+    });
+
+    it('Should handle non-array value', () => {
+      const result = getCheckTreeDefaultValue('single-value' as any, ['other'] as any);
+
+      expect(result).to.equal('single-value');
+    });
+  });
+});
```

**File**: `src/CheckTree/utils.ts` (modified, +2/-1)
```diff
@@ -235,7 +235,8 @@ export function getDisabledState(
  */
 export function getCheckTreeDefaultValue<T = any>(value: T, uncheckableItemValues: T) {
   if (Array.isArray(value) && Array.isArray(uncheckableItemValues)) {
-    return value.filter(v => !uncheckableItemValues.includes(v));
+    const filtered = value.filter(v => !uncheckableItemValues.includes(v));
+    return filtered.length === value.length ? value : filtered;
   }
 
   return value;
```

---

### Incident Patch 10: `e064f4cc` (2026-06-12)
**Commit Message**: fix(Uploader): prevent horizontal overflow and width increase (#4580)

Picture mode (listType='picture'):
- Added flex-wrap: wrap to the container and file-items list to allow
  items to wrap when the container is narrower than the total width
  of all items, preventing horizontal scrollbar.

Text mode (listType='text'):
- Added min-width: 0 to .rs-uploader-file-item-title to override
  the flexbox default min-width: auto, allowing the file name to
  properly truncate with ellipsis instead of pushing the container
  beyond its parent width.

Closes #4536

**File**: `src/Uploader/styles/index.scss` (modified, +3/-0)
```diff
@@ -109,6 +109,7 @@
       @include utils.ellipsis-basic;
 
       flex: 1 1 auto;
+      min-width: 0;
     }
 
     &-size {
@@ -169,6 +170,7 @@
 .rs-uploader[data-list-type='picture'] {
   display: inline-flex;
   flex-direction: row;
+  flex-wrap: wrap;
   gap: var(--rs-uploader-item-spacing);
 
   .rs-uploader-trigger-btn {
@@ -213,6 +215,7 @@
 
   .rs-uploader-file-items {
     display: inline-flex;
+    flex-wrap: wrap;
     gap: var(--rs-uploader-item-spacing);
   }
 
```

#### Recent Merged Pull Requests:
- **PR #4598** (2026-08-21): fix(Image): prevent SSR hydration mismatch (@simonguo)
- **PR #4596** (2026-08-21): fix(DatePicker): calculate disabled months correctly (@simonguo)
- **PR #4595** (2026-08-21): fix(picker): expose responsive control for all pickers (@simonguo)
- **PR #4590** (2026-07-15): docs(i18n): add missing supported locales (@simonguo)
- **PR #4589** (2026-07-15): fix(ci): use Node 24 for npm publishing (@simonguo)
- **PR #4588** (2026-07-15): fix(docs): repair online sandbox examples (@simonguo)
- **PR #4585** (2026-07-02): fix(InputPicker): ignore Enter during IME composition when selecting an item (@mahirhir)
- **PR #4583** (2026-06-22): feat(locales): add Norwegian Bokmål (nb_NO) locale (@arvindfroi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
