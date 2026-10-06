# Forensic Learning Record (Deep Inspection): rsuite/rsuite

> **Canonical Artifact**: `07_PROJECT_LEARNING/rsuite-rsuite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rsuite/rsuite](https://github.com/rsuite/rsuite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:39:42.800Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rsuite/rsuite`
- **Description**: 🧱 A suite of React components .  
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8690 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/with-electron/src/renderer.js`
```
/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  ButtonToolbar,
  Badge,
  Message,
  toaster,
  Panel,
  Stack,
  Divider,
  Toggle,
  Heading,
  Text
} from 'rsuite';
import { Check, Close } from '@rsuite/icons';
import 'rsuite/dist/rsuite.min.css';
import './index.css';

function App() {
  const [clickCount, setClickCount] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);

  const handleClick = () => {
    setClickCount(c => c + 1);
  };

  const handleNotify = () => {
    toaster.push(
      <Message showIcon type="success" closable>
        <strong>Success!</strong> You clicked the button {clickCount} times.
      </Message>,
      { placement: 'topEnd' }
    );
  };

  const handleToggle = checked => {
    setIsEnabled(checked);
    toaster.push(
      <Message showIcon type="info">
        Feature {checked ? 'enabled' : 'disabled'}
      </Message>,
      { placement: 'topEnd' }
    );
  };

  // Log version info (with fallback if preload didn't load)
  const versions = window.versions || {
    node: () => 'N/A',
    chrome: () => 'N/A',
    electron: () => 'N/A',
  };

  console.log(`🚀 React Suite + Electron
───────────────────────────
Node: ${versions.node()}
Chrome: ${versions.chrome()}
Electron: ${versions.electron()}
───────────────────────────
  `);

  return (
    <div id="app-container">
      <div className="header">
        <Heading level={1}>💖 React Suite + Electron</Heading>
        <Text muted>A modern desktop application example</Text>
      </div>

      <Stack direction="column" spacing={20}>
        {/* Click Counter Demo */}
        <Panel bordered shaded header={<Heading level={4}>Click Counter</Heading>}>
          <Stack direction="column" spacing={16}>
            <Stack spacing={12} alignItems="center">
              <Text>You clicked</Text>
              <Badge content={clickCount} />
              <Text>times</Text>
            </Stack>

            <ButtonToolbar>
              <Button appearance="primary" onClick={handleClick}>
                Click Me
              </Button>
              <Button appearance="ghost" onClick={handleNotify}>
                Show Notification
              </Button>
              <Button
                appearance="subtle"
                onClick={() => setClickCount(0)}
                disabled={clickCount === 0}
              >
                Reset
              </Button>
            </ButtonToolbar>
          </Stack>
        </Panel>

        {/* Toggle Demo */}
        <Panel bordered shaded header={<Heading level={4}>Toggle Feature</Heading>}>
          <Stack spacing={12} alignItems="center">
            <Text>Feature Status:</Text>
            <Toggle
              size="lg"
              checked={isEnabled}
              onChange={handleToggle}
              checkedChildren={<Check />}
              unCheckedChildren={<Close />}
            />
            <Badge
              content={isEnabled ? 'Enabled' : 'Disabled'}
              color={isEnabled ? 'green' : 'red'}
            />
          </Stack>
        </Panel>

        <Divider />

        {/* Version Info */}
        <Panel bordered header={<Heading level={4}>Environment Info</Heading>}>
          <div className="version-info">
            <div>
              <strong>Node.js:</strong> {window.versions?.node() || 'N/A'}
            </div>
            <div>
              <strong>Chrome:</strong> {window.versions?.chrome() || 'N/A'}
            </div>
            <div>
              <strong>Electron:</strong> {window.versions?.electron() || 'N/A'}
            </div>
            <div>
              <strong>Platform:</strong> {navigator.platform}
            </div>
          </div>
        </Panel>
      </Stack>
    </div>
  );
}

console.log('👋 React Suite Electron Example - Renderer Process');

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

```

### Core Architecture Module: `examples/with-electron/webpack.renderer.config.js`
```
// Renderer process uses different rules (no asset-relocator-loader)
const rules = [
  // Babel loader for JSX and modern JavaScript
  {
    test: /\.jsx?$/,
    exclude: /node_modules/,
    use: 'babel-loader',
  },
  // CSS loader
  {
    test: /\.css$/,
    use: ['style-loader', 'css-loader'],
  },
];

module.exports = {
  module: {
    rules,
  },
  target: 'web',
};

```

### Core Architecture Module: `examples/with-flow/flow-typed/npm/@babel/core_vx.x.x.js`
```
// flow-typed signature: 94435a161a1be5e19af4afd06cd5b220
// flow-typed version: <<STUB>>/@babel/core_v^7.0.0/flow_v0.83.0

/**
 * This is an autogenerated libdef stub for:
 *
 *   '@babel/core'
 *
 * Fill this stub out by replacing all the `any` types.
 *
 * Once filled out, we encourage you to share your work with the
 * community by sending a pull request to:
 * https://github.com/flowtype/flow-typed
 */

declare module '@babel/core' {
  declare module.exports: any;
}

/**
 * We include stubs for each file inside this npm package in case you need to
 * require those files directly. Feel free to delete any files that aren't
 * needed.
 */
declare module '@babel/core/lib/config/caching' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/config-chain' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/config-descriptors' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/files/configuration' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/files/index-browser' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/files/index' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/files/package' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/files/plugins' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/files/types' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/files/utils' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/full' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/helpers/config-api' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/helpers/environment' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/index' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/item' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/partial' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/pattern-to-regex' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/plugin' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/util' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/validation/option-assertions' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/validation/options' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/validation/plugins' {
  declare module.exports: any;
}

declare module '@babel/core/lib/config/validation/removed' {
  declare module.exports: any;
}

declare module '@babel/core/lib/index' {
  declare module.exports: any;
}

declare module '@babel/core/lib/parse' {
  declare module.exports: any;
}

declare module '@babel/core/lib/tools/build-external-helpers' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transform-ast' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transform-file-browser' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transform-file-sync-browser' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transform-file' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transform' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/block-hoist-plugin' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/file/file' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/file/generate' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/file/merge-map' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/index' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/normalize-file' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/normalize-opts' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/plugin-pass' {
  declare module.exports: any;
}

declare module '@babel/core/lib/transformation/util/missing-plugin-helper' {
  declare module.exports: any;
}

// Filename aliases
declare module '@babel/core/lib/config/caching.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/caching'>;
}
declare module '@babel/core/lib/config/config-chain.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/config-chain'>;
}
declare module '@babel/core/lib/config/config-descriptors.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/config-descriptors'>;
}
declare module '@babel/core/lib/config/files/configuration.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/files/configuration'>;
}
declare module '@babel/core/lib/config/files/index-browser.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/files/index-browser'>;
}
declare module '@babel/core/lib/config/files/index.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/files/index'>;
}
declare module '@babel/core/lib/config/files/package.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/files/package'>;
}
declare module '@babel/core/lib/config/files/plugins.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/files/plugins'>;
}
declare module '@babel/core/lib/config/files/types.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/files/types'>;
}
declare module '@babel/core/lib/config/files/utils.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/files/utils'>;
}
declare module '@babel/core/lib/config/full.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/full'>;
}
declare module '@babel/core/lib/config/helpers/config-api.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/helpers/config-api'>;
}
declare module '@babel/core/lib/config/helpers/environment.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/helpers/environment'>;
}
declare module '@babel/core/lib/config/index.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/index'>;
}
declare module '@babel/core/lib/config/item.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/item'>;
}
declare module '@babel/core/lib/config/partial.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/partial'>;
}
declare module '@babel/core/lib/config/pattern-to-regex.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/pattern-to-regex'>;
}
declare module '@babel/core/lib/config/plugin.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/plugin'>;
}
declare module '@babel/core/lib/config/util.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/util'>;
}
declare module '@babel/core/lib/config/validation/option-assertions.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/validation/option-assertions'>;
}
declare module '@babel/core/lib/config/validation/options.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/validation/options'>;
}
declare module '@babel/core/lib/config/validation/plugins.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/validation/plugins'>;
}
declare module '@babel/core/lib/config/validation/removed.js' {
  declare module.exports: $Exports<'@babel/core/lib/config/validation/removed'>;
}
declare module '@babel/core/lib/index.js' {
  declare module.exports: $Exports<'@babel/core/lib/index'>;
}
declare module '@babel/core/lib/parse.js' {
  declare module.exports: $Exports<'@babel/core/lib/parse'>;
}
declare module '@babel/core/lib/tools/build-external-helpers.js' {
  declare module.exports: $Exports<'@babel/core/lib/tools/build-external-helpers'>;
}
declare module '@babel/core/lib/transform-ast.js' {
  declare module.exports: $Exports<'@babel/core/lib/transform-ast'>;
}
declare module '@babel/core/lib/transform-file-browser.js' {
  declare module.exports: $Exports<'@babel/core/lib/transform-file-browser'>;
}
declare module '@babel/core/lib/transform-file-sync-browser.js' {
  declare module.exports: $Exports<'@babel/core/lib/transform-file-sync-browser'>;
}
declare module '@babel/core/lib/transform-file.js' {
  declare module.exports: $Exports<'@babel/core/lib/transform-file'>;
}
declare module '@babel/core/lib/transform.js' {
  declare module.exports: $Exports<'@babel/core/lib/transform'>;
}
declare module '@babel/core/lib/transformation/block-hoist-plugin.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/block-hoist-plugin'>;
}
declare module '@babel/core/lib/transformation/file/file.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/file/file'>;
}
declare module '@babel/core/lib/transformation/file/generate.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/file/generate'>;
}
declare module '@babel/core/lib/transformation/file/merge-map.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/file/merge-map'>;
}
declare module '@babel/core/lib/transformation/index.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/index'>;
}
declare module '@babel/core/lib/transformation/normalize-file.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/normalize-file'>;
}
declare module '@babel/core/lib/transformation/normalize-opts.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/normalize-opts'>;
}
declare module '@babel/core/lib/transformation/plugin-pass.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/plugin-pass'>;
}
declare module '@babel/core/lib/transformation/util/missing-plugin-helper.js' {
  declare module.exports: $Exports<'@babel/core/lib/transformation/util/missing-plugin-helper'>;
}

```

### Core Architecture Module: `examples/with-rtlcss/src/utils.js`
```
export function loadCssFile(url, id = 'rsuite-theme') {
  return new Promise((resolve) => {
    const container = document.getElementsByTagName('head')[0];
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.onload = function () {
      resolve();
    };
    container.appendChild(link);
  });
}

export const readDirection = () => localStorage.getItem('direction');
export const writeDirection = (dir) => {
  localStorage.setItem('direction', dir);
  const cssFile = dir === 'rtl' ? '/css/style.rtl.css' : '/css/style.css';
  document.getElementById('rsuite-theme').href = cssFile;
  document.dir = dir;
};

```

### Core Architecture Module: `skills/rsuite/scripts/list_hooks.mjs`
```
#!/usr/bin/env node
// List all React Suite custom hooks.
const BASE_URL = (process.env.RSUITE_BASE_URL || 'https://rsuitejs.com').replace(/\/+$/, '');

async function main() {
  const res = await fetch(`${BASE_URL}/api/types/index`);
  if (!res.ok) {
    console.error(`Failed to fetch index: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  const hooks = data?.hooks || [];
  for (const h of hooks) {
    if (typeof h === 'string') {
      console.log(h);
    } else if (h && typeof h === 'object') {
      const name = h.id || h.name;
      if (name) console.log(name);
    }
  }
  console.error(`\n${hooks.length} hooks.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

```

### Core Architecture Module: `src/Animation/utils.ts`
```
export function getAnimationEnd() {
  const style = document.createElement('div').style;
  if ('webkitAnimation' in style) {
    return 'webkitAnimationEnd';
  }

  return 'animationend';
}

```

### Core Architecture Module: `src/AutoComplete/utils.ts`
```
import trim from 'lodash/trim';

export function transformData(data: any[]) {
  if (!data) {
    return [];
  }
  return data.map(item => {
    if (typeof item === 'string') {
      return {
        value: item,
        label: item
      };
    }

    if (typeof item === 'object') {
      return item;
    }
  });
}

export const shouldDisplay = <TItem extends { label: string }>(
  filterBy: ((value: string, item: TItem) => boolean) | undefined,
  value: string
) => {
  return (item: TItem) => {
    if (typeof filterBy === 'function') {
      return filterBy(value, item);
    }

    if (!trim(value)) {
      return false;
    }
    const keyword = value.toLocaleLowerCase();
    return `${item.label}`.toLocaleLowerCase().indexOf(keyword) >= 0;
  };
};

```

### Core Architecture Module: `src/Calendar/TimeDropdown/utils/formatWithLeadingZero.ts`
```
export const formatWithLeadingZero = (number: number) => {
  return String(number).padStart(2, '0');
};

```

### Core Architecture Module: `src/Calendar/TimeDropdown/utils/getClockTime.ts`
```
import { getHours, getMinutes, getSeconds } from '@/internals/utils/date';

export interface ClockTime {
  hours?: number | null;
  minutes?: number | null;
  seconds?: number | null;
  meridiem?: 'AM' | 'PM' | null;
}

/**
 * Convert the 24-hour clock to the 12-hour clock
 * @param hours
 */
function getMeridiemHours(hours: number): number {
  return hours >= 12 ? hours - 12 : hours;
}

export function getClockTime(props: { date?: Date; format?: string; showMeridiem: boolean }) {
  const { format, date, showMeridiem } = props;
  const clockTime: ClockTime = {
    hours: null,
    minutes: null,
    seconds: null,
    meridiem: null
  };

  if (!format) {
    return clockTime;
  }

  // If date is provided, extract hours and meridiem
  if (/(H|h)/.test(format) && date) {
    const hours = getHours(date);

    clockTime.hours = showMeridiem ? getMeridiemHours(hours) : hours;
    clockTime.meridiem = hours >= 12 ? 'PM' : 'AM';
  }
  // Extract minutes if 'm' is present in format and date is provided
  if (/m/.test(format) && date) {
    clockTime.minutes = getMinutes(date);
  }
  // // Extract seconds if 's' is present in format and date is provided
  if (/s/.test(format) && date) {
    clockTime.seconds = getSeconds(date);
  }
  return clockTime;
}

```

### Core Architecture Module: `src/Calendar/TimeDropdown/utils/getTimeLimits.ts`
```
interface TimeRange {
  start: number;
  end: number;
}

interface TimeLimits {
  hours: TimeRange;
  minutes: TimeRange;
  seconds: TimeRange;
}

export function getTimeLimits(isMeridiem: boolean): TimeLimits {
  const HOURS_24H = { start: 0, end: 23 };
  const HOURS_12H = { start: 0, end: 11 };
  const MINUTES_SECONDS = { start: 0, end: 59 };

  return {
    hours: isMeridiem ? HOURS_12H : HOURS_24H,
    minutes: MINUTES_SECONDS,
    seconds: MINUTES_SECONDS
  };
}

```

### Core Architecture Module: `src/Calendar/TimeDropdown/utils/index.ts`
```
export { getTimeLimits } from './getTimeLimits';
export { formatWithLeadingZero } from './formatWithLeadingZero';
export { scrollToTime } from './scrollToTime';
export * from './getClockTime';

```

### Core Architecture Module: `src/Calendar/TimeDropdown/utils/scrollToTime.ts`
```
import getPosition from 'dom-lib/getPosition';
import scrollTop from 'dom-lib/scrollTop';
import type { ClockTime } from './getClockTime';

export function scrollToTime(time: ClockTime, row: HTMLDivElement | null) {
  if (!row) return;

  const scrollToPosition = (container: HTMLElement, value: number, type: string) => {
    const node = container.querySelector(`[data-key="${type}-${value}"]`);
    if (node) {
      const position = getPosition(node as HTMLElement, container);
      if (position) {
        scrollTop(container, position.top);
      }
    }
  };

  Object.entries(time).forEach(([type, value]: [string, number]) => {
    const container = row.querySelector(`[data-type="${type}"]`) as HTMLElement;
    if (container) {
      scrollToPosition(container, value, type);
    }
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4698** (2026-10-06): **fix(Form): preserve terminal parent validation errors**
  *Symptoms*: `Form.check()` throws a TypeError when a shaped `ObjectType` fails required or priority validation at the parent. Stop child traversal when the invalid native result has no object aggregate, preserving the parent error and the normal `onCheck`/`onError` callbacks.  Adds three permanent regressions for an own `undefined` required parent, a primitive rejected by a priority parent rule, and the existing nested child-message aggregate.  Validation: TypeScript, ESLint and Prettier pass. On this PR's current head (`504fa4b`, based on `d1f96bd`), all 77 selected Form tests—74 existing FormValidation cases plus the three regressions—pass with React 19.0.0 in actual Chromium 141 and Firefox 142. The frozen `001c802` baseline reproduces both exceptions in both browsers. Local Firefox verification is separate from the hosted Firefox-labelled jobs, whose logs report Chromium. 
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/form-parent-terminal-errors?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/form-parent-terminal-errors&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/form-parent-terminal-errors&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/form-parent-terminal-errors?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4698/builds/693401) or the icon next to each commit SHA.
  > [vc]: #TjqJ1jHxODR/UFL5Wi+r/XXH9Tbdbg2TR0iGZTPMzFo=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX2Y1SWtXeUNMQVdIOFp4TE9lcXY2NXlRSDBoZnMiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1maXgtZm9ybS1wYXJlbnQtdGVybWluYWwtZXJyb3JzLXJzdWl0ZS52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9yc3VpdGUvcnN1aXRlLXN0b3J5Ym9vay8zR0JlaG5KdHZIVFp6dVY1ZjQxTTZTUW84NkZ5IiwicHJldmlld1VybCI6InJzdWl0ZS1zdG9yeWJvb2stZ2l0LWZpeC1mb3JtLXBhcmVudC10ZXJtaW5hbC1lcnJvcnMtcnN1aXRlLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifSx7Im5hbWUiOiJyc3VpdGUtbWFpbiIsInByb2plY3RJZCI6InByal9teUhqa1IwbUllcmg4RHg5ZUI0VlY0cHJPMzNHIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiZG9jcyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtbWFpbi1naXQtZml4LWZvcm0tcGFyZW50LXRlcm1pbmFsLWVycm9ycy1yc3Vp

- **Issue #4691** (2026-10-06): **fix(AutoComplete): respect composing keyboard events**
  *Symptoms*: When an open AutoComplete menu receives a composing Enter, arrow or Escape key, its internal keyboard handlers can prevent the input event, select a suggestion or dismiss the menu. Skip both menu and focus handling when the native event reports `isComposing` or legacy `keyCode === 229`, while retaining the existing closed-menu gate and public `onKeyDown` callback ordering. Ordinary keyboard behavior and the callback remain unchanged.  Add 38 public regressions for controlled/uncontrolled menus, native composition flags and legacy 229, selection/focus/close/default-prevention behavior, composition boundaries, public callback identity and deliberate `preventDefault`, ordinary keys, and empty-data disabled/readOnly/closed-overlay controls. The fixture dispatches real constructed DOM events and verifies their native properties; it does not simulate trusted hardware or an OS IME candidate-confirmation sequence.  Validation:  - Unchanged-source React 19.0.0 baseline: Chromium and Firefox each reproduce 20 failed composition assertions and 18 passing controls with the identical fixture. - React/ReactDOM 18.2.0, 19.0.0 and 19.3.0 × Chromium 141.0.7390.37 / Firefox 142.0.1: all six target groups pass 38/38; all six 12-file AutoComplete/Picker family groups pass 197/197, including the same 38 regressions. No skips. Native provider, renderer, private React identity, single-engine launch, and before/after source/dependency-byte guards passed. - Node 22.22.3 / TypeScript 5.7.3 full-source
  **Post-Mortem & Fix Analysis**:
  > [vc]: #rVYVeSz/zHnbB7DKLHCYMfyaZifqFZpbV/07Ofy8j94=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtbWFpbiIsInByb2plY3RJZCI6InByal9teUhqa1IwbUllcmg4RHg5ZUI0VlY0cHJPMzNHIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9yc3VpdGUvcnN1aXRlLW1haW4vRTJBNGpZRmdLUDE4Rk0zUEJqUkNiem5mb1lmaiIsInByZXZpZXdVcmwiOiJyc3VpdGUtbWFpbi1naXQtZml4LWF1dG9jb21wbGV0ZS1pbWUtY29tcG9zaXRpb24tcnN1aXRlLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicnN1aXRlLW1haW4tZ2l0LWZpeC1hdXRvY29tcGxldGUtaW1lLWNvbXBvc2l0aW9uLXJzdWl0ZS52ZXJjZWwuYXBwIn19LHsibmFtZSI6InJzdWl0ZS12NSIsInByb2plY3RJZCI6InByal80ZFZGQUt2OHR2YjVTOXRBYWxJdDhhMnlUTTd3Iiwicm9vdERpcmVjdG9yeSI6ImRvY3MiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9yc3VpdGUvcnN1aXRlLXY1Lzl0NWd3S0NMV1RGUmp4Qlh2bzN3SjluMXFu
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/autocomplete-ime-composition?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/autocomplete-ime-composition&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/autocomplete-ime-composition&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/autocomplete-ime-composition?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4691/builds/693334) or the icon next to each commit SHA.

- **Issue #4682** (2026-10-04): **fix(docs): patch all locked SVGO instances**
  *Symptoms*: The docs lockfile contains three SVGO instances: direct v2 and v3 copies used by SVGR and PostCSS. Raise the direct floor to `^2.8.4` and update both nested copies to `3.3.5`, covering the current upstream security backports without changing major versions.  Replace the unsupported `@trysound/sax` fork with the required `sax@1.5.0`. The old fork has exactly those three consumers. All other package versions and metadata remain unchanged, and all four dependent package ranges accept the new SVGO versions.  This overlaps Dependabot #4557, which targets `2.8.2` / `3.3.3`; those versions remain below the latest patched floors. The new floors also cover the later script-removal hardening:  - [Namespace and control-character bypasses](https://github.com/svg/svgo/security/advisories/GHSA-w27v-7q3p-w38r) - [Executable HTML inside foreignObject](https://github.com/svg/svgo/security/advisories/GHSA-4vpr-x523-8j87) - [Prefixed scripts and mixed-case executable URLs](https://github.com/svg/svgo/security/advisories/GHSA-2p49-hgcm-8545) - [Custom XML entity expansion](https://github.com/svg/svgo/security/advisories/GHSA-xpqw-6gx7-v673)  Validation used isolated copies of the exact 134-package SVGO/adapter dependency closure, under Node `22.22.3`, with lifecycle scripts disabled:  - The same public native fixtures produce 37 expected failures on the old versions and 92 passes on the patched versions. Script-removal assertions explicitly enable the opt-in `removeScriptElement` plugin. The ent
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/docs-svgo-security?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/docs-svgo-security&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/docs-svgo-security&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/docs-svgo-security?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4682/builds/693311) or the icon next to each commit SHA.
  > ## [Codecov](https://app.codecov.io/gh/rsuite/rsuite/pull/4682?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 94.59%. Comparing base ([`684e17d`](https://app.codecov.io/gh/rsuite/rsuite/commit/684e17d440c30223d29b17b504289fd8219e3fdd?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite)) to head ([`da6e7ba`](https://app.codecov.io/gh/rsuite/rsuite/commit/da6e7bac07c3987cdae4d1c32528aa9b98e68d65?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite)).  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/rsuite/rsuite/pull/4682/graphs/tree.svg?width=650&height=150&src=pr&token

- **Issue #4623** (2026-10-05): **fix(NumberInput): use standard wheel delta for step direction**
  *Symptoms*: NumberInput currently prefers nonstandard `wheelDelta` over `deltaY`, reversing vertical wheel steps and changing the value during horizontal-only scrolling. Use standard `deltaY`: down decrements and up increments by the configured step; a zero vertical delta leaves the value unchanged.  Validation: - React 19.0.0 with actual Chromium 141 and Firefox 142: four baseline/candidate rows, nine observation cases and 15 trusted physical wheel commands per row. Both browsers reproduce the old behavior and confirm the fix, including controlled ownership, fractional steps, bounds and locked inputs. - The existing family suite has 73 raw passing assertions in each actual browser on React 19. Its evidence reader reported a retained `+0`/`0` title-format mismatch; the raw tests and their results were unchanged. - TypeScript and consumer typing, ESLint, Prettier and diff checks pass.  CI qualification: the existing jobs labelled Firefox actually ran Chromium because of the matrix issue addressed by #4620. Actual Firefox proof above comes from separate local browser runs. Four Vercel checks remain failed due to build-rate limits. This validation does not claim a current full-library sweep or React 18 Firefox coverage. 
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/number-input-wheel-delta?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/number-input-wheel-delta&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/number-input-wheel-delta&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/number-input-wheel-delta?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4623/builds/693221) or the icon next to each commit SHA.
  > ## [Codecov](https://app.codecov.io/gh/rsuite/rsuite/pull/4623?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 94.59%. Comparing base ([`684e17d`](https://app.codecov.io/gh/rsuite/rsuite/commit/684e17d440c30223d29b17b504289fd8219e3fdd?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite)) to head ([`22f7f4b`](https://app.codecov.io/gh/rsuite/rsuite/commit/22f7f4b1c0c57a53ed276dc17cc18fd8b1587cce?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=rsuite)).  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/rsuite/rsuite/pull/4623/graphs/tree.svg?width=650&height=150&src=pr&token

- **Issue #4615** (2026-10-05): **fix(Stat): format zero values consistently**
  *Symptoms*: When a dashboard metric is zero, `Stat.Value` renders a bare `0` and skips `formatOptions`, losing currency, percent and decimal formatting. Route zero through the existing number formatter. Null and undefined continue to omit the number while preserving children.  Validation: - On current main `e75a7bc` plus the exact two-file PR change, all six Stat test files pass: 51 tests each in actual Chromium and Firefox, React 19.0 / Node 22, with no failures or skips. - Regression coverage includes four zero formats and children with null/undefined values. Existing assertions are retained. - Whole-source TypeScript, source ESLint, both changed files' Prettier and `git diff --check` pass.  The older hosted run has one DateInput KeyPress failure, “Should reset the value rather than concatenate the value,” outside the changed Stat files, and three cancelled test jobs. Its job labelled Firefox actually reports Chromium. These hosted outcomes remain recorded; the new local checks cover the prospective Stat scope. 
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/stat-zero-format?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/stat-zero-format&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/stat-zero-format&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/stat-zero-format?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4615/builds/693212) or the icon next to each commit SHA.
  > [vc]: #HDG0J209YdQ0J8Uhg5Lacx1sNrBO895JN3pjrR3uVsw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtbWFpbiIsInByb2plY3RJZCI6InByal9teUhqa1IwbUllcmg4RHg5ZUI0VlY0cHJPMzNHIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiZG9jcyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtbWFpbi1naXQtZml4LXN0YXQtemVyby1mb3JtYXQtcnN1aXRlLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3JzdWl0ZS9yc3VpdGUtbWFpbi9DVHp4eGd0WnRrbkJUczJXTk5GNlBWMkxETGdoIiwicHJldmlld1VybCI6InJzdWl0ZS1tYWluLWdpdC1maXgtc3RhdC16ZXJvLWZvcm1hdC1yc3VpdGUudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6InJzdWl0ZS1zdG9yeWJvb2siLCJwcm9qZWN0SWQiOiJwcmpfZjVJa1d5Q0xBV0g4WnhMT2VxdjY1eVFIMGhmcyIsInYwIjpmYWxzZSwicm9vdERpcmVjdG9yeSI6bnVsbCwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6InJzdWl0ZS1zdG9yeWJvb2stZ2l0LWZpeC1zdGF0LXplcm8tZm9ybWF0LXJzdWl0ZS52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVy

- **Issue #4611** (2026-10-05): **fix(Toggle): preserve native form state and accessible names**
  *Symptoms*: Locked input, label and Space activation on an uncontrolled Toggle can change the native checkbox and submitted form value while readOnly/loading suppresses onChange. Cancel locked activation after synchronizing the checkbox value so its native value stays stable and the next unlocked change still calls onChange. Keep controlled values owner-driven and preserve uncontrolled form.reset() values across unrelated parent rerenders.  Preserve caller-provided aria-label and aria-labelledby. Explicit accessible names take precedence over generated visible or inner labels.  Validation:  - The original 57 Toggle behavior/style cases and 5 native-reset regressions passed in Chromium 141 and Firefox 142 with React/react-dom 18.2.0, 19.0.0 and 19.3.0: 62 passed per version/browser, 372 passed overall, no failures or skips. - The same two reset observers ran against clean main 676bd255 and the prospective corrected merge in both browsers with React/react-dom 19.0.0. Native checked values, FormData and callback records match the baseline through reset and parent rerender. - Source and consumer TypeScript, ESLint, Prettier, diff checks, and the repository lint-staged/commitlint hooks passed. - All 4,262 predicted merged file modes and Git blobs match the tested prospective source.  The pre-existing visual/ARIA lag after native form.reset() remains a separate follow-up. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #/KycCErxst4In/at1vXOndSibXHkVcel6sgGRWdaiAU=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX2Y1SWtXeUNMQVdIOFp4TE9lcXY2NXlRSDBoZnMiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9yc3VpdGUvcnN1aXRlLXN0b3J5Ym9vay80QzJvZlFSQzNyclI0bnVmUzdjSjJ4c2ZBRVZqIiwicHJldmlld1VybCI6InJzdWl0ZS1zdG9yeWJvb2stZ2l0LWZpeC10b2dnbGUtbG9ja2VkLXN0YXRlLXJzdWl0ZS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6InJzdWl0ZS1zdG9yeWJvb2stZ2l0LWZpeC10b2dnbGUtbG9ja2VkLXN0YXRlLXJzdWl0ZS52ZXJjZWwuYXBwIn19LHsibmFtZSI6InJzdWl0ZS12NSIsInByb2plY3RJZCI6InByal80ZFZGQUt2OHR2YjVTOXRBYWxJdDhhMnlUTTd3Iiwicm9vdERpcmVjdG9yeSI6ImRvY3MiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vcnN1aXRlL3JzdWl0ZS12NS9wR1p1SlVON05aNmh4ZXVFTVRSUHFySlR5ZzNZIiwicHJldmlld1VybCI6InJzdWl0ZS12NS1naXQtZml4LXRvZ2dsZS1sb2NrZWQtc3RhdGUtcnN1aXRlLnZl
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/toggle-locked-state?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/toggle-locked-state&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/toggle-locked-state&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/toggle-locked-state?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4611/builds/693351) or the icon next to each commit SHA.

- **Issue #4607** (2026-10-04): **fix(Affix): support server-side rendering**
  *Symptoms*: Rendering Affix on the server throws `ReferenceError: window is not defined` because its resize and scroll listeners evaluate `window` during render. Resolve their targets after mounting through the existing event-listener hook, so Affix can render without browser globals while retaining its browser behavior.  Adds a Node SSR regression that verifies content and custom attributes render, positioning is not fixed before mounting, and the container callback is not evaluated.  Validation: - Full SSR suite: 10 passed. - Chromium Affix suite: 4 passed. - Changed-file ESLint and Prettier checks passed. - `tsc --noEmit --preserveSymlinks` passed in the isolated worktree. 
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/affix-ssr?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/affix-ssr&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/affix-ssr&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/affix-ssr?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > [vc]: #Nqmg7Km45RkYd5pJUw8jKBQxXZxXiaSOelmWxkuzXqM=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtdjUiLCJwcm9qZWN0SWQiOiJwcmpfNGRWRkFLdjh0dmI1Uzl0QWFsSXQ4YTJ5VE03dyIsInJvb3REaXJlY3RvcnkiOiJkb2NzIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vcnN1aXRlL3JzdWl0ZS12NS9ER3JSZFJaYUtacldMQ05NUDg0R1E4dDhONnRLIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQifSx7Im5hbWUiOiJyc3VpdGUtc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX2Y1SWtXeUNMQVdIOFp4TE9lcXY2NXlRSDBoZnMiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1maXgtYWZmaXgtc3NyLXJzdWl0ZS52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9yc3VpdGUvcnN1aXRlLXN0b3J5Ym9vay9ISDd4ZzdFeHlyVTJLVWZqYXRMUGFvZ0o2emFIIiwicHJldmlld1VybCI6InJzdWl0ZS1zdG9yeWJvb2stZ2l0LWZpeC1hZmZpeC1zc3ItcnN1aXRlLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVz
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4607/builds/693204) or the icon next to each commit SHA.

- **Issue #4606** (2026-10-03): **fix(useMediaQuery): support dynamic enabled changes**
  *Symptoms*: Changing a picker's `responsive` prop after it mounts can throw React Hook errors because `useMediaQuery` returns before calling the remaining Hooks when `enabled` is false. This PR allows the same picker instance to switch between a positioned popup and a responsive Drawer without those errors.  Always call `useSyncExternalStore` and keep a cached store for the current queries and enabled state. Disabled queries return `false` without subscribing; disabling or unmounting removes listeners, and re-enabling reads the current screen size. Query changes rebuild the store, and server rendering uses a stable unmatched snapshot.  Regression coverage includes enabled transitions, viewport changes while disabled, listener cleanup, query changes, SSR, and dynamic `responsive` changes across all 12 picker components.  Validation:  - Chromium component and Hook suites: **1258 passed, 3 skipped** (using an isolated Vite cache and pre-optimized dependencies to avoid local dependency reload failures). - `RUN_ENV=ssr vitest --run src/useMediaQuery/test/useMediaQuery.ssr.test.ts`: **2 passed**. - `npm run lint:ts`, ESLint for the shared picker tests, Prettier checks, and `git diff --check`: passed. 
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/use-media-query-enabled?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/use-media-query-enabled&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/use-media-query-enabled&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/use-media-query-enabled?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/rsuite/rsuite/pr/4606/builds/693200) or the icon next to each commit SHA.
  > [vc]: #ICgK9e8HiuwztQhuUTCPulFouNIdNNkBU3BtaB9t6hg=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX2Y1SWtXeUNMQVdIOFp4TE9lcXY2NXlRSDBoZnMiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1maXgtdXNlLW1lZGlhLXF1ZXJ5LWVuYWJsZWQtcnN1aXRlLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3JzdWl0ZS9yc3VpdGUtc3Rvcnlib29rLzdQd3ZnOFhoTnNOaEtEQmNidjg2WUJBM004VU0iLCJwcmV2aWV3VXJsIjoicnN1aXRlLXN0b3J5Ym9vay1naXQtZml4LXVzZS1tZWRpYS1xdWVyeS1lbmFibGVkLXJzdWl0ZS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn0seyJuYW1lIjoicnN1aXRlLW1haW4iLCJwcm9qZWN0SWQiOiJwcmpfbXlIamtSMG1JZXJoOER4OWVCNFZWNHByTzMzRyIsInYwIjpmYWxzZSwicm9vdERpcmVjdG9yeSI6ImRvY3MiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicnN1aXRlLW1haW4tZ2l0LWZpeC11c2UtbWVkaWEtcXVlcnktZW5hYmxlZC1yc3VpdGUudmVyY2VsLmFw

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

### Incident Patch 1: `5d6c7c2c` (2026-10-06)
**Commit Message**: fix(AutoComplete): respect composing keyboard events (#4691)

**File**: `src/AutoComplete/AutoComplete.tsx` (modified, +7/-5)
```diff
@@ -153,11 +153,13 @@ const AutoComplete = forwardRef<'div', AutoCompleteProps>((props: any, ref) => {
     if (!overlay.current) {
       return;
     }
-    onMenuKeyDown(event, {
-      enter: selectOnEnter ? selectFocusMenuItem : undefined,
-      esc: handleClose
-    });
-    handleKeyDown(event);
+    if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
+      onMenuKeyDown(event, {
+        enter: selectOnEnter ? selectFocusMenuItem : undefined,
+        esc: handleClose
+      });
+      handleKeyDown(event);
+    }
     onKeyDown?.(event);
   };
 
```

**File**: `src/AutoComplete/test/AutoComplete.composition.spec.tsx` (added, +283/-0)
```diff
@@ -0,0 +1,283 @@
+import React from 'react';
+import { act, render, screen } from '@testing-library/react';
+import { describe, expect, it, vi } from 'vitest';
+import AutoComplete from '../AutoComplete';
+
+const modes = ['controlled', 'uncontrolled'] as const;
+const keys = ['Enter', 'ArrowDown', 'ArrowUp', 'Escape'] as const;
+const signals = [
+  { name: 'native isComposing', isComposing: true, keyCode: 0 },
+  { name: 'legacy keyCode 229', isComposing: false, keyCode: 229 }
+] as const;
+
+type Key = (typeof keys)[number];
+type Signal = (typeof signals)[number];
+
+const ordinaryKeyCodes: Record<Key, number> = {
+  Enter: 13,
+  ArrowDown: 40,
+  ArrowUp: 38,
+  Escape: 27
+};
+
+// These are browser-created DOM events, not trusted hardware or OS IME input.
+// Guard their actual properties instead of assigning a fake nativeEvent object.
+function dispatchKey(input: HTMLInputElement, key: Key, signal?: Signal) {
+  const keyCode = signal?.keyCode ?? ordinaryKeyCodes[key];
+  const event = new KeyboardEvent('keydown', {
+    key,
+    keyCode,
+    isComposing: signal?.isComposing ?? false,
+    bubbles: true,
+    cancelable: true
+  });
+
+  expect(event.key).toBe(key);
+  expect(event.keyCode).toBe(keyCode);
+  expect(event.isComposing).toBe(signal?.isComposing ?? false);
+  expect(event.isTrusted).toBe(false);
+
+  act(() => {
+    input.dispatchEvent(event);
+  });
+
+  return event;
+}
+
+function renderFixture(mode: (typeof modes)[number], selectOnEnter = true) {
+  const onChange = vi.fn();
+  const onSelect = vi.fn();
+  const onClose = vi.fn();
+  const onMenuFocus = vi.fn();
+  const onKeyDown = vi.fn();
+  const onCompositionStart = vi.fn();
+  const onCompositionEnd = vi.fn();
+
+  function Fixture() {
+    const [value, setValue] = React.useState('a');
+
+    return (
+      <AutoComplete
+        data={['a', 'ab', 'ac']}
+        {...(mode === 'controlled' ? { value, open: true } : { defaultValue: 'a' })}
+        selectOnEnter={selectOnEnter}
+        onChange={(nextValue, event) => {
+          onChange(nextValue, event);
+          if (mode === 'controlled') setValue(nextValue);
+        }}
+        onSelect={onSelect}
+        onClose={onClose}
+        onMenuFocus={onMenuFocus}
+        onKeyDown={onKeyDown}
+        onCompositionStart={onCompositionStart}
+        onCompositionEnd={onCompositionEnd}
+      />
+    );
+  }
+
+  render(<Fixture />);
+  const input = screen.getByRole('combobox') as HTMLInputElement;
+  act(() => input.focus());
+
+  expect(document.activeElement).toBe(input);
+  expect(input.value).toBe('a');
+  expect(input.getAttribute('aria-expanded')).toBe('true');
+  expect(screen.getByRole('listbox')).toBeTruthy();
+
+  // A normal key proves the input event reaches the real menu/focus handlers.
+  const prime = dispatchKey(input, 'ArrowDown');
+  expect(prime.defaultPrevented).toBe(true);
+  expect(onMenuFocus).toHaveBeenCalledTimes(1);
+  expect(onMenuFocus.mock.calls[0][0]).toBe('ab');
+  expect(onKeyDown).toHaveBeenCalledTimes(1);
+  expect(onKeyDown.mock.calls[0][0].nativeEvent).toBe(prime);
+  const activeId = input.getAttribute('aria-activedescendant');
+  expect(activeId).toBeTruthy();
+  expect(document.getElementById(activeId!)?.textContent).toBe('ab');
+
+  [onChange, onSelect, onClose, onMenuFocus, onKeyDown].forEach(callback => callback.mockClear());
+
+  return {
+    input,
+    activeId,
+    onChange,
+    onSelect,
+    onClose,
+    onMenuFocus,
+    onKeyDown,
+    onCompositionStart,
+    onCompositionEnd
+  };
+}
+
+describe.each(modes)('AutoComplete composition dispatch (%s)', mode => {
+  describe.each(signals)('$name', signal => {
+    it.each(keys)('leaves %s to composition and reports the public event once', key => {
+      const fixture = renderFixture(mode);
+      const { input, activeId, onChange, onSelect, onClose, onMenuFocus, onKeyDown } = fixture;
+      const event = dispatchKey(input, key, signal);
+
+      expect(onKeyDown).toHaveBeenCalledTimes(1);
+      expect(onKeyDown.mock.calls[0][0].nativeEvent).toBe(event);
+      expect(onKeyDown.mock.calls[0][0].target).toBe(input);
+      expect(event.defaultPrevented).toBe(false);
+      expect(onSelect).not.toHaveBeenCalled();
+      expect(onChange).not.toHaveBeenCalled();
+      expect(onClose).not.toHaveBeenCalled();
+      expect(onMenuFocus).not.toHaveBeenCalled();
+      expect(input.value).toBe('a');
+      expect(input.getAttribute('aria-activedescendant')).toBe(activeId);
+      expect(input.getAttribute('aria-expanded')).toBe('true');
+      expect(screen.getByRole('listbox')).toBeTruthy();
+      expect(document.activeElement).toBe(input);
+    });
+  });
+
+  it('keeps ordinary arrows and Enter functional', () => {
+    const { input, onChange, onSelect, onMenuFocus, onKeyDown } = renderFixture(mode);
+    const down = dispatchKey(input, 'ArrowDown');
+    const up = dispatchKey(input, 'ArrowUp');
+    const enter = dispatchKey(input, 'Enter');
+
+    expect(down.de
```

---

### Incident Patch 2: `8dc919b7` (2026-10-06)
**Commit Message**: fix(Form): preserve terminal parent validation errors (#4698)

**File**: `src/Form/hooks/useFormValidate.ts` (modified, +3/-0)
```diff
@@ -92,6 +92,9 @@ export default function useFormValidate(_formError: any, props: FormErrorProps)
       if (checkResult.hasError === true) {
         errorCount += 1;
         formErrorObj[key] = checkResult?.errorMessage || checkResult;
+        if (!checkResult.object) {
+          return;
+        }
       }
 
       // Check nested object
```

**File**: `src/Form/test/Form.parent-error.spec.tsx` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+import React from 'react';
+import { act, render } from '@testing-library/react';
+import { ObjectType, SchemaModel, StringType } from 'schema-typed';
+import { describe, expect, it, vi } from 'vitest';
+import Form from '../Form';
+import type { FormInstance } from '../hooks/useFormRef';
+
+describe('Form terminal parent errors', () => {
+  it('preserves a required shaped parent error for an own undefined value', () => {
+    const childRule = vi.fn(() => false);
+    const parent = ObjectType()
+      .isRequired('User required')
+      .shape({ code: StringType().addRule(childRule, 'Code invalid', true) });
+    const model = SchemaModel({ user: parent });
+    const values = { user: undefined };
+    const onCheck = vi.fn();
+    const onError = vi.fn();
+    const form = React.createRef<FormInstance>();
+
+    expect(Object.prototype.hasOwnProperty.call(values, 'user')).toBe(true);
+    const nativeResult = model.check(values);
+    expect(nativeResult.user).toEqual({ hasError: true, errorMessage: 'User required' });
+    expect(nativeResult.user).not.toHaveProperty('object');
+    expect(childRule).toHaveBeenCalledTimes(0);
+
+    const view = render(
+      <Form
+        ref={form}
+        model={model}
+        formValue={values}
+        checkTrigger={null}
+        onCheck={onCheck}
+        onError={onError}
+      />
+    );
+
+    try {
+      let valid = true;
+      act(() => {
+        valid = form.current!.check();
+      });
+
+      expect(valid).toBe(false);
+      expect(onCheck).toHaveBeenCalledTimes(1);
+      expect(onError).toHaveBeenCalledTimes(1);
+      expect(onCheck.mock.calls[0][0]).toEqual({ user: 'User required' });
+      expect(onError.mock.calls[0][0]).toBe(onCheck.mock.calls[0][0]);
+      expect(childRule).toHaveBeenCalledTimes(0);
+    } finally {
+      view.unmount();
+    }
+  });
+
+  it('preserves a shaped parent priority error for a primitive value', () => {
+    const childRule = vi.fn(() => false);
+    const parentRule = vi.fn((value: unknown) => typeof value === 'object');
+    const parent = ObjectType()
+      .shape({ code: StringType().addRule(childRule, 'Code invalid', true) })
+      .addRule(parentRule, 'User must be an object', true);
+    const model = SchemaModel({ user: parent });
+    const values = { user: 'invalid' };
+    const onCheck = vi.fn();
+    const onError = vi.fn();
+    const form = React.createRef<FormInstance>();
+
+    const nativeResult = model.check(values);
+    expect(nativeResult.user).toEqual({ hasError: true, errorMessage: 'User must be an object' });
+    expect(nativeResult.user).not.toHaveProperty('object');
+    expect(childRule).toHaveBeenCalledTimes(0);
+
+    const view = render(
+      <Form
+        ref={form}
+        model={model}
+        formValue={values}
+        checkTrigger={null}
+        onCheck={onCheck}
+        onError={onError}
+      />
+    );
+
+    try {
+      let valid = true;
+      act(() => {
+        valid = form.current!.check();
+      });
+
+      expect(valid).toBe(false);
+      expect(onCheck).toHaveBeenCalledTimes(1);
+      expect(onError).toHaveBeenCalledTimes(1);
+      expect(onCheck.mock.calls[0][0]).toEqual({ user: 'User must be an object' });
+      expect(onError.mock.calls[0][0]).toBe(onCheck.mock.calls[0][0]);
+      expect(childRule).toHaveBeenCalledTimes(0);
+      expect(parentRule).toHaveBeenCalledTimes(2);
+    } finally {
+      view.unmount();
+    }
+  });
+
+  it('retains child string messages inside an original object error aggregate', () => {
+    const childRule = vi.fn(() => false);
+    const parent = ObjectType().shape({
+      code: StringType().addRule(childRule, 'Code invalid', true)
+    });
+    const model = SchemaModel({ user: parent });
+    const values = { user: { code: 'invalid' } };
+    const onCheck = vi.fn();
+    const onError = vi.fn();
+    const form = React.createRef<FormInstance>();
+
+    const nativeResult = model.check(values);
+    expect(nativeResult.user).toEqual({
+      hasError: true,
+      object: { code: { hasError: true, errorMessage: 'Code invalid' } }
+    });
+    expect(childRule).toHaveBeenCalledTimes(1);
+
+    const view = render(
+      <Form
+        ref={form}
+        model={model}
+        formValue={values}
+        checkTrigger={null}
+        onCheck={onCheck}
+        onError={onError}
+      />
+    );
+
+    try {
+      let valid = true;
+      act(() => {
+        valid = form.current!.check();
+      });
+
+      expect(valid).toBe(false);
+      expect(onCheck).toHaveBeenCalledTimes(1);
+      expect(onError).toHaveBeenCalledTimes(1);
+      expect(onCheck.mock.calls[0][0]).toEqual({
+        user: { hasError: true, object: { code: 'Code invalid' } }
+      });
+      expect(onError.mock.calls[0][0]).toBe(onCheck.mock.calls[0][0]);
+      expect(childRule).toHaveBeenCalledTimes(3);
+    } finally {
+      view.unmount();
+    }
+  });
+});
```

---

### Incident Patch 3: `d1f96bd6` (2026-10-05)
**Commit Message**: fix(NumberInput): use standard wheel delta for step direction (#4623)

**File**: `src/NumberInput/hooks/useEvents.ts` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ export function useEvents(params: UseEventsParams) {
     }
     if (!disabled && !readOnly && event.target === document.activeElement) {
       event.preventDefault();
-      const delta: number = (event as any).wheelDelta || -event.deltaY || -event.detail;
+      const delta = event.deltaY;
       if (delta > 0) {
         onStepDown(event);
       }
```

**File**: `src/NumberInput/test/NumberInput.spec.tsx` (modified, +60/-0)
```diff
@@ -210,6 +210,66 @@ describe('NumberInput', () => {
     expect(onWheel).toHaveBeenCalledTimes(1);
   });
 
+  it.each([
+    { deltaY: 60, wheelDelta: -120, expectedValue: '-1' },
+    { deltaY: -60, wheelDelta: 120, expectedValue: '1' }
+  ])(
+    'Should use the vertical delta when legacy wheel delta has the opposite sign ($deltaY)',
+    ({ deltaY, wheelDelta, expectedValue }) => {
+      const onChange = vi.fn();
+      render(<NumberInput value={0} onChange={onChange} />);
+      const input = screen.getByRole('textbox');
+      const wheelEvent = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY });
+
+      // Match the opposite delta signs reported by native wheel events.
+      Object.defineProperty(wheelEvent, 'wheelDelta', { value: wheelDelta });
+      act(() => input.focus());
+      fireEvent(input, wheelEvent);
+
+      expect(onChange).toHaveBeenCalledTimes(1);
+      expect(onChange).toHaveBeenCalledWith(expectedValue, expect.any(Object));
+    }
+  );
+
+  it.each([
+    { deltaMode: WheelEvent.DOM_DELTA_PIXEL, deltaY: 0.5 },
+    { deltaMode: WheelEvent.DOM_DELTA_LINE, deltaY: 3 },
+    { deltaMode: WheelEvent.DOM_DELTA_PAGE, deltaY: 1 }
+  ])(
+    'Should apply the configured step for wheel delta mode $deltaMode',
+    ({ deltaMode, deltaY }) => {
+      const onChange = vi.fn();
+      render(<NumberInput value={2} step={0.25} onChange={onChange} />);
+      const input = screen.getByRole('textbox');
+
+      act(() => input.focus());
+      fireEvent.wheel(input, { deltaMode, deltaY });
+
+      expect(onChange).toHaveBeenCalledTimes(1);
+      expect(onChange).toHaveBeenCalledWith('1.75', expect.any(Object));
+      onChange.mockClear();
+
+      fireEvent.wheel(input, { deltaMode, deltaY: -deltaY });
+
+      expect(onChange).toHaveBeenCalledTimes(1);
+      expect(onChange).toHaveBeenCalledWith('2.25', expect.any(Object));
+    }
+  );
+
+  it('Should preserve the value when scrolling horizontally without a vertical delta', () => {
+    const onChange = vi.fn();
+    const onWheel = vi.fn();
+    render(<NumberInput value={2} onChange={onChange} onWheel={onWheel} />);
+    const input = screen.getByRole('textbox');
+
+    act(() => input.focus());
+    fireEvent.wheel(input, { deltaX: 40, deltaY: 0 });
+
+    expect(onChange).not.toHaveBeenCalled();
+    expect(onWheel).toHaveBeenCalledTimes(1);
+    expect(input).to.have.value('2');
+  });
+
   it('Should not call onWheel callback when `scrollable` is false', () => {
     const onWheel = vi.fn();
     render(<NumberInput onWheel={onWheel} scrollable={false} />);
```

---

### Incident Patch 4: `001c8026` (2026-10-05)
**Commit Message**: fix(Toggle): preserve native form state and accessible names (#4611)

* fix(Toggle): preserve checked state while readonly or loading

* fix(Toggle): retain native form values across locked state changes

**File**: `src/Toggle/Toggle.tsx` (modified, +19/-7)
```diff
@@ -94,6 +94,8 @@ export interface ToggleProps extends Omit<BoxProps, 'height' | 'width'>, Sanitiz
 const Toggle = forwardRef<'label', ToggleProps>((props, ref) => {
   const { propsWithDefaults } = useCustom('Toggle', props);
   const {
+    'aria-label': ariaLabel,
+    'aria-labelledby': ariaLabelledby,
     as = 'label',
     disabled,
     readOnly,
@@ -106,7 +108,7 @@ const Toggle = forwardRef<'label', ToggleProps>((props, ref) => {
     unCheckedChildren,
     classPrefix = 'toggle',
     checked: checkedProp,
-    defaultChecked,
+    defaultChecked = false,
     size = 'md',
     locale,
     label = children,
@@ -125,18 +127,27 @@ const Toggle = forwardRef<'label', ToggleProps>((props, ref) => {
 
   const labelId = useUniqueId('rs-label');
   const innerId = inner ? labelId + '-inner' : undefined;
-  const labelledby = label ? labelId : innerId;
+  const labelledby =
+    ariaLabelledby ?? (ariaLabel !== undefined ? undefined : label ? labelId : innerId);
 
   const [htmlInputProps, restProps] = partitionHTMLProps(rest);
 
+  const handleInputClick = useEventCallback((e: React.MouseEvent<HTMLInputElement>) => {
+    if (disabled || readOnly || loading) {
+      e.currentTarget.checked = checkedProp === undefined ? !e.currentTarget.checked : checked;
+      e.preventDefault();
+    }
+    htmlInputProps.onClick?.(e);
+  });
+
   const handleInputChange = useEventCallback((e: React.ChangeEvent<HTMLInputElement>) => {
     if (disabled || readOnly || loading) {
       return;
     }
-    const { checked } = e.target;
+    const nextChecked = e.target.checked;
 
-    setChecked(checked);
-    onChange?.(checked, e);
+    setChecked(nextChecked);
+    onChange?.(nextChecked, e);
   });
 
   if (plaintext) {
@@ -161,16 +172,17 @@ const Toggle = forwardRef<'label', ToggleProps>((props, ref) => {
         ref={inputRef}
         type="checkbox"
         checked={checkedProp}
-        defaultChecked={defaultChecked}
+        defaultChecked={checkedProp === undefined ? defaultChecked : undefined}
         disabled={disabled}
         readOnly={readOnly}
+        onClick={handleInputClick}
         onChange={handleInputChange}
         className={prefix('input')}
         role="switch"
         aria-checked={checked}
         aria-disabled={disabled}
         aria-labelledby={labelledby}
-        aria-label={labelledby ? undefined : innerLabel}
+        aria-label={ariaLabel ?? (labelledby ? undefined : innerLabel)}
         aria-busy={loading || undefined}
       />
       <span className={prefix('track')}>
```

**File**: `src/Toggle/test/Toggle.native-reset.spec.tsx` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+import React from 'react';
+import { act, fireEvent, render } from '@testing-library/react';
+import { describe, expect, it, vi } from 'vitest';
+import Toggle from '../Toggle';
+
+function assertUncontrolledReset(initialChecked: boolean) {
+  const onChange = vi.fn();
+  function View({ tick }: { tick: number }) {
+    return (
+      <form data-parent-tick={tick}>
+        <Toggle name="choice" defaultChecked={initialChecked} onChange={onChange} />
+      </form>
+    );
+  }
+  const mounted = render(<View tick={0} />);
+  const form = mounted.container.querySelector('form')!;
+  const input = mounted.getByRole('switch') as HTMLInputElement;
+  const expectedDefaultValue = initialChecked ? ['on'] : [];
+
+  expect(input.checked).toBe(initialChecked);
+  expect(input.defaultChecked).toBe(initialChecked);
+  expect(new FormData(form).getAll('choice')).toEqual(expectedDefaultValue);
+
+  fireEvent.click(input);
+  expect(input.checked).toBe(!initialChecked);
+  expect(input.getAttribute('aria-checked')).toBe(String(!initialChecked));
+  expect(new FormData(form).getAll('choice')).toEqual(initialChecked ? [] : ['on']);
+  expect(onChange).toHaveBeenCalledTimes(1);
+  expect(onChange).toHaveBeenNthCalledWith(1, !initialChecked, expect.any(Object));
+
+  act(() => form.reset());
+  expect(input.checked).toBe(initialChecked);
+  expect(input.defaultChecked).toBe(initialChecked);
+  expect(new FormData(form).getAll('choice')).toEqual(expectedDefaultValue);
+  expect(onChange).toHaveBeenCalledTimes(1);
+
+  mounted.rerender(<View tick={1} />);
+  expect(mounted.getByRole('switch')).toBe(input);
+  expect(form.getAttribute('data-parent-tick')).toBe('1');
+  expect(input.checked).toBe(initialChecked);
+  expect(input.defaultChecked).toBe(initialChecked);
+  expect(new FormData(form).getAll('choice')).toEqual(expectedDefaultValue);
+  expect(onChange).toHaveBeenCalledTimes(1);
+  mounted.unmount();
+}
+
+describe('Toggle native reset retention', () => {
+  it('TNR-01 preserves native default true after click reset and parent render', () => {
+    assertUncontrolledReset(true);
+  });
+
+  it('TNR-02 preserves native default false after click reset and parent render', () => {
+    assertUncontrolledReset(false);
+  });
+
+  it('TNR-03 retains controlled ownership without checked and defaultChecked warnings', () => {
+    const onChange = vi.fn();
+    function View({ tick, checked }: { tick: number; checked: boolean }) {
+      return (
+        <form data-parent-tick={tick}>
+          <Toggle name="choice" checked={checked} defaultChecked={!checked} onChange={onChange} />
+        </form>
+      );
+    }
+    const mounted = render(<View tick={0} checked />);
+    const form = mounted.container.querySelector('form')!;
+    const input = mounted.getByRole('switch') as HTMLInputElement;
+
+    fireEvent.click(input);
+    expect(input.checked).toBe(true);
+    expect(new FormData(form).getAll('choice')).toEqual(['on']);
+    expect(onChange).toHaveBeenNthCalledWith(1, false, expect.any(Object));
+
+    act(() => form.reset());
+    mounted.rerender(<View tick={1} checked />);
+    expect(input.checked).toBe(true);
+    expect(input.getAttribute('aria-checked')).toBe('true');
+    expect(new FormData(form).getAll('choice')).toEqual(['on']);
+    expect(onChange).toHaveBeenCalledTimes(1);
+
+    mounted.rerender(<View tick={2} checked={false} />);
+    fireEvent.click(input);
+    expect(input.checked).toBe(false);
+    expect(input.getAttribute('aria-checked')).toBe('false');
+    expect(new FormData(form).getAll('choice')).toEqual([]);
+    expect(onChange).toHaveBeenNthCalledWith(2, true, expect.any(Object));
+    expect(onChange).toHaveBeenCalledTimes(2);
+    expect(console.error).not.toHaveBeenCalled();
+    mounted.unmount();
+  });
+
+  it('TNR-04 rejects readOnly and loading changes to native checked and FormData', () => {
+    for (const lockedProp of ['readOnly', 'loading'] as const) {
+      for (const initialChecked of [false, true]) {
+        const onChange = vi.fn();
+        const onClick = vi.fn();
+        function View({ tick }: { tick: number }) {
+          return (
+            <form data-parent-tick={tick}>
+              <Toggle
+                name="choice"
+                label="Choice"
+                defaultChecked={initialChecked}
+                onChange={onChange}
+                onClick={onClick}
+                {...{ [lockedProp]: true }}
+              />
+            </form>
+          );
+        }
+        const mounted = render(<View tick={0} />);
+        const form = mounted.container.querySelector('form')!;
+        const input = mounted.getByRole('switch') as HTMLInputElement;
+        const expectedValue = initialChecked ? ['on'] : [];
+
+        fireEvent.click(input);
+        expect(input.checked).toBe(initialChecked);
+        expect(input.getAttribute('aria-checked')).toBe(String(initialChecked));
+        expect(new FormData(form).getAll('choic
```

**File**: `src/Toggle/test/Toggle.spec.tsx` (modified, +113/-0)
```diff
@@ -32,6 +32,30 @@ describe('Toggle', () => {
     expect(container.firstChild).to.have.attr('data-checked', 'true');
   });
 
+  it('Should start unchecked when no checked state is provided', () => {
+    render(<Toggle />);
+
+    expect(screen.getByRole('switch')).not.to.be.checked;
+    expect(screen.getByRole('switch')).to.have.attr('aria-checked', 'false');
+  });
+
+  it('Should keep controlled checked state until the prop changes', () => {
+    const onChange = vi.fn();
+    const { rerender } = render(<Toggle checked defaultChecked={false} onChange={onChange} />);
+
+    userEvent.click(screen.getByRole('switch'));
+
+    expect(onChange).toHaveBeenCalledWith(false, expect.any(Object));
+    expect(screen.getByRole('switch')).to.be.checked;
+    expect(screen.getByRole('switch')).to.have.attr('aria-checked', 'true');
+    expect(console.error).not.toHaveBeenCalled();
+
+    rerender(<Toggle checked={false} onChange={onChange} />);
+
+    expect(screen.getByRole('switch')).not.to.be.checked;
+    expect(screen.getByRole('switch')).to.have.attr('aria-checked', 'false');
+  });
+
   it('Should render checkedChildren', () => {
     render(<Toggle unCheckedChildren="off" />);
     expect(screen.getByText('off')).to.have.class('rs-toggle-inner');
@@ -163,7 +187,96 @@ describe('Toggle', () => {
     });
   });
 
+  describe.each(['readOnly', 'loading'] as const)('%s state', lockedProp => {
+    it.each([
+      [false, 'input click'],
+      [true, 'input click'],
+      [false, 'label click'],
+      [true, 'label click'],
+      [false, 'Space'],
+      [true, 'Space']
+    ] as const)(
+      'Should preserve checked=%s and form value after %s, then allow changes when unlocked',
+      (initialChecked, action) => {
+        const onChange = vi.fn();
+        const { container, rerender } = render(
+          <form>
+            <Toggle
+              name="notifications"
+              label="Notifications"
+              defaultChecked={initialChecked}
+              onChange={onChange}
+              {...{ [lockedProp]: true }}
+            />
+          </form>
+        );
+        const input = screen.getByRole('switch') as HTMLInputElement;
+        const form = container.querySelector('form') as HTMLFormElement;
+
+        if (action === 'Space') {
+          input.focus();
+          userEvent.keyboard(' ');
+        } else {
+          userEvent.click(action === 'label click' ? screen.getByText('Notifications') : input);
+        }
+
+        expect(onChange).not.toHaveBeenCalled();
+        expect(input.checked).to.equal(initialChecked);
+        expect(input).to.have.attr('aria-checked', String(initialChecked));
+        expect(new FormData(form).has('notifications')).to.equal(initialChecked);
+
+        rerender(
+          <form>
+            <Toggle
+              name="notifications"
+              label="Notifications"
+              defaultChecked={initialChecked}
+              onChange={onChange}
+            />
+          </form>
+        );
+        userEvent.click(input);
+
+        expect(onChange).toHaveBeenCalledWith(!initialChecked, expect.any(Object));
+        expect(input.checked).to.equal(!initialChecked);
+        expect(input).to.have.attr('aria-checked', String(!initialChecked));
+        expect(new FormData(form).has('notifications')).to.equal(!initialChecked);
+      }
+    );
+  });
+
   describe('Label', () => {
+    it('Should preserve an explicit aria-label', () => {
+      render(<Toggle aria-label="Enable notifications" />);
+
+      expect(screen.getByRole('switch', { name: 'Enable notifications' })).to.exist;
+    });
+
+    it.each(['visible label', 'inner label'])('Should let aria-label override the %s', label => {
+      render(
+        <Toggle
+          aria-label="Enable notifications"
+          label={label === 'visible label' ? 'Notifications' : undefined}
+          unCheckedChildren={label === 'inner label' ? 'Off' : undefined}
+        />
+      );
+
+      expect(screen.getByRole('switch', { name: 'Enable notifications' })).to.exist;
+      expect(screen.getByRole('switch')).not.to.have.attr('aria-labelledby');
+    });
+
+    it('Should preserve an explicit aria-labelledby over generated labels', () => {
+      render(
+        <>
+          <span id="notifications-label">Enable notifications</span>
+          <Toggle label="Notifications" aria-labelledby="notifications-label" />
+        </>
+      );
+
+      expect(screen.getByRole('switch', { name: 'Enable notifications' })).to.exist;
+      expect(screen.getByRole('switch')).to.have.attr('aria-labelledby', 'notifications-label');
+    });
+
     it('Should render label when provided as a prop', () => {
       render(<Toggle label="Custom Label" />);
 
```

---

### Incident Patch 5: `676bd255` (2026-10-05)
**Commit Message**: fix(Stat): format zero values consistently (#4615)

**File**: `src/Stat/StatValue.tsx` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ const StatValue = forwardRef<'dd', StatValueProps>((props, ref) => {
 
   return (
     <Box as={as} ref={ref} className={classes} {...rest}>
-      {value && <FormattedNumber value={value} formatOptions={formatOptions} />}
+      {value != null && <FormattedNumber value={value} formatOptions={formatOptions} />}
       {children}
     </Box>
   );
```

**File**: `src/Stat/test/StatValue.spec.tsx` (modified, +23/-0)
```diff
@@ -24,4 +24,27 @@ describe('StatValue', () => {
 
     expect(screen.getByText('US$1,000.00')).to.exist;
   });
+
+  const zeroFormats: { formatOptions?: Intl.NumberFormatOptions; expected: string }[] = [
+    { expected: '0' },
+    { formatOptions: { minimumFractionDigits: 2 }, expected: '0.00' },
+    { formatOptions: { style: 'currency', currency: 'USD' }, expected: 'US$0.00' },
+    { formatOptions: { style: 'percent' }, expected: '0%' }
+  ];
+
+  it.each(zeroFormats)('Should render a zero value as $expected', ({ formatOptions, expected }) => {
+    render(<StatValue value={0} formatOptions={formatOptions} />);
+
+    expect(screen.getByText(expected)).to.exist;
+  });
+
+  it.each([undefined, null])('Should preserve children when value is %j', value => {
+    const { container } = render(
+      <StatValue value={value as any} formatOptions={{ style: 'currency', currency: 'USD' }}>
+        No data
+      </StatValue>
+    );
+
+    expect(container.firstChild).to.have.text('No data');
+  });
 });
```

---

### Incident Patch 6: `e75a7bc3` (2026-10-04)
**Commit Message**: fix(Affix): defer window access until mounting (#4607)

**File**: `src/Affix/Affix.tsx` (modified, +3/-3)
```diff
@@ -63,10 +63,10 @@ function useOffset(
   useMount(updateOffset);
 
   // Update after window size changes
-  useEventListener(window, 'resize', updateOffset, false);
+  useEventListener(() => window, 'resize', updateOffset, false);
 
   // Update after window scroll
-  useEventListener(window, 'scroll', debounce(updateOffset, 100), false);
+  useEventListener(() => window, 'scroll', debounce(updateOffset, 100), false);
 
   return offset;
 }
@@ -119,7 +119,7 @@ function useFixed(offset: Offset | null, containerOffset: Offset | null, props:
   }, [offset, top, containerOffset, fixed, onChange]);
 
   // Add scroll event to window
-  useEventListener(window, 'scroll', handleScroll, false);
+  useEventListener(() => window, 'scroll', handleScroll, false);
 
   return fixed;
 }
```

**File**: `src/Affix/test/Affix.ssr.test.tsx` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import React from 'react';
+import { renderToString } from 'react-dom/server';
+import { describe, expect, it, vi } from 'vitest';
+import Affix from '../Affix';
+
+describe('Affix server rendering', () => {
+  it('renders its content without evaluating browser-only targets', () => {
+    const container = vi.fn(() => {
+      throw new Error('The container should only be resolved after mounting');
+    });
+
+    const html = renderToString(
+      <Affix as="section" container={container} top={24} aria-label="Actions">
+        <button>Save</button>
+      </Affix>
+    );
+
+    expect(html).toContain('<section');
+    expect(html).toContain('aria-label="Actions"');
+    expect(html).toContain('<button>Save</button>');
+    expect(html).not.toContain('position:fixed');
+    expect(container).not.toHaveBeenCalled();
+  });
+});
```

---

### Incident Patch 7: `7f61e613` (2026-10-04)
**Commit Message**: fix(docs): patch all locked SVGO instances (#4682)

**File**: `docs/package-lock.json` (modified, +23/-23)
```diff
@@ -54,7 +54,7 @@
         "rsuite": "^6.2.5",
         "superstruct": "^2.0.2",
         "svg-sprite-loader": "^6.0.11",
-        "svgo": "^2.3.1",
+        "svgo": "^2.8.4",
         "svgo-loader": "^3.0.3",
         "tinycolor2": "^1.4.1",
         "typanion": "^3.14.0",
@@ -3336,18 +3336,18 @@
       "dev": true
     },
     "node_modules/@svgr/plugin-svgo/node_modules/svgo": {
-      "version": "3.3.2",
-      "resolved": "https://registry.npmjs.org/svgo/-/svgo-3.3.2.tgz",
-      "integrity": "sha512-OoohrmuUlBs8B8o6MB2Aevn+pRIH9zDALSR+6hhqVfa6fRwG/Qw9VUMSMW9VNg2CFc/MTIfabtdOVl9ODIJjpw==",
+      "version": "3.3.5",
+      "resolved": "https://registry.npmjs.org/svgo/-/svgo-3.3.5.tgz",
+      "integrity": "sha512-8SQMzdrvWaD8deUmrnYB+ASyxBVgWUOilg+A75nE/76WdLpj6LopCwiAVvkzkcqy/9b7t2Mg7faFLjg0ZRcZ3w==",
       "dev": true,
       "dependencies": {
-        "@trysound/sax": "0.2.0",
         "commander": "^7.2.0",
         "css-select": "^5.1.0",
         "css-tree": "^2.3.1",
         "css-what": "^6.1.0",
         "csso": "^5.0.5",
-        "picocolors": "^1.0.0"
+        "picocolors": "^1.0.0",
+        "sax": "^1.5.0"
       },
       "bin": {
         "svgo": "bin/svgo"
@@ -3397,14 +3397,6 @@
         "tslib": "^2.4.0"
       }
     },
-    "node_modules/@trysound/sax": {
-      "version": "0.2.0",
-      "resolved": "https://registry.npmjs.org/@trysound/sax/-/sax-0.2.0.tgz",
-      "integrity": "sha512-L7z9BgrNEcYyUYtF+HaEfiS5ebkh9jXqbszz7pC0hRBPaatV0XjSD3+eHrpqFemQfgwiFF0QPIarnIihIDn7OA==",
-      "engines": {
-        "node": ">=10.13.0"
-      }
-    },
     "node_modules/@types/codemirror": {
       "version": "5.60.5",
       "resolved": "https://registry.npmjs.org/@types/codemirror/-/codemirror-5.60.5.tgz",
@@ -9067,18 +9059,18 @@
       "dev": true
     },
     "node_modules/postcss-svgo/node_modules/svgo": {
-      "version": "3.3.2",
-      "resolved": "https://registry.npmjs.org/svgo/-/svgo-3.3.2.tgz",
-      "integrity": "sha512-OoohrmuUlBs8B8o6MB2Aevn+pRIH9zDALSR+6hhqVfa6fRwG/Qw9VUMSMW9VNg2CFc/MTIfabtdOVl9ODIJjpw==",
+      "version": "3.3.5",
+      "resolved": "https://registry.npmjs.org/svgo/-/svgo-3.3.5.tgz",
+      "integrity": "sha512-8SQMzdrvWaD8deUmrnYB+ASyxBVgWUOilg+A75nE/76WdLpj6LopCwiAVvkzkcqy/9b7t2Mg7faFLjg0ZRcZ3w==",
       "dev": true,
       "dependencies": {
-        "@trysound/sax": "0.2.0",
         "commander": "^7.2.0",
         "css-select": "^5.1.0",
         "css-tree": "^2.3.1",
         "css-what": "^6.1.0",
         "csso": "^5.0.5",
-        "picocolors": "^1.0.0"
+        "picocolors": "^1.0.0",
+        "sax": "^1.5.0"
       },
       "bin": {
         "svgo": "bin/svgo"
@@ -9982,6 +9974,14 @@
         }
       }
     },
+    "node_modules/sax": {
+      "version": "1.5.0",
+      "resolved": "https://registry.npmjs.org/sax/-/sax-1.5.0.tgz",
+      "integrity": "sha512-21IYA3Q5cQf089Z6tgaUTr7lDAyzoTPx5HRtbhsME8Udispad8dC/+sziTNugOEx54ilvatQ9YCzl4KQLPcRHA==",
+      "engines": {
+        "node": ">=11.0.0"
+      }
+    },
     "node_modules/scheduler": {
       "version": "0.23.2",
       "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.23.2.tgz",
@@ -10875,16 +10875,16 @@
       }
     },
     "node_modules/svgo": {
-      "version": "2.8.0",
-      "resolved": "https://registry.npmjs.org/svgo/-/svgo-2.8.0.tgz",
-      "integrity": "sha512-+N/Q9kV1+F+UeWYoSiULYo4xYSDQlTgb+ayMobAXPwMnLvop7oxKMo9OzIrX5x3eS4L4f2UHhc9axXwY8DpChg==",
+      "version": "2.8.4",
+      "resolved": "https://registry.npmjs.org/svgo/-/svgo-2.8.4.tgz",
+      "integrity": "sha512-2GJ4h3rl13qYTdwllaK6QlL8tG+UrM8626V2Ylcd/yBUv2Y/EwLsYisVV6UDCRmlk+C74G8nMpxJCk0RWPdDCw==",
       "dependencies": {
-        "@trysound/sax": "0.2.0",
         "commander": "^7.2.0",
         "css-select": "^4.1.3",
         "css-tree": "^1.1.3",
         "csso": "^4.2.0",
         "picocolors": "^1.0.0",
+        "sax": "^1.5.0",
         "stable": "^0.1.8"
       },
       "bin": {
```

**File**: `docs/package.json` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@
     "rsuite": "^6.2.5",
     "superstruct": "^2.0.2",
     "svg-sprite-loader": "^6.0.11",
-    "svgo": "^2.3.1",
+    "svgo": "^2.8.4",
     "svgo-loader": "^3.0.3",
     "tinycolor2": "^1.4.1",
     "typanion": "^3.14.0",
```

---

### Incident Patch 8: `b3a4a5da` (2026-10-04)
**Commit Message**: build(docs): bump rsuite 6.2.5

**File**: `docs/package-lock.json` (modified, +6/-6)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "docs",
-  "version": "6.2.4",
+  "version": "6.2.5",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "docs",
-      "version": "6.2.4",
+      "version": "6.2.5",
       "license": "MIT",
       "dependencies": {
         "@docsearch/react": "^3.2.1",
@@ -51,7 +51,7 @@
         "react-icons": "^5.0.1",
         "react-json-tree": "^0.20.0",
         "react-select": "^5.5.9",
-        "rsuite": "^6.2.4",
+        "rsuite": "^6.2.5",
         "superstruct": "^2.0.2",
         "svg-sprite-loader": "^6.0.11",
         "svgo": "^2.3.1",
@@ -9808,9 +9808,9 @@
       }
     },
     "node_modules/rsuite": {
-      "version": "6.2.4",
-      "resolved": "https://registry.npmjs.org/rsuite/-/rsuite-6.2.4.tgz",
-      "integrity": "sha512-Wb8bMg0YCGGE0Ni0UpJW5QOXm/En5g7QpHBhOtFlkBg+NPwbt4AJE7VuQQr/ALNvmt2R5ijtc5+wfOgS/6CXdw==",
+      "version": "6.2.5",
+      "resolved": "https://registry.npmjs.org/rsuite/-/rsuite-6.2.5.tgz",
+      "integrity": "sha512-53A+M7LUxoPaq09DLtbvl50jBnFpW9qAxeHouJaToxt91XiwTbni6d7G6fAK8fZDsCxV2VtKilDNYtuHXLIAqw==",
       "license": "MIT",
       "dependencies": {
         "@babel/runtime": "^7.26.0",
```

**File**: `docs/package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "docs",
-  "version": "6.2.4",
+  "version": "6.2.5",
   "license": "MIT",
   "private": true,
   "scripts": {
@@ -66,7 +66,7 @@
     "react-icons": "^5.0.1",
     "react-json-tree": "^0.20.0",
     "react-select": "^5.5.9",
-    "rsuite": "^6.2.4",
+    "rsuite": "^6.2.5",
     "superstruct": "^2.0.2",
     "svg-sprite-loader": "^6.0.11",
     "svgo": "^2.3.1",
```

---

### Incident Patch 9: `139b8842` (2026-10-04)
**Commit Message**: build: bump 6.2.5

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -1,3 +1,15 @@
+## [6.2.5](https://github.com/rsuite/rsuite/compare/v6.2.4...v6.2.5) (2026-10-04)
+
+
+### Bug Fixes
+
+* **ButtonGroup:** support Badge-wrapped buttons ([#4605](https://github.com/rsuite/rsuite/issues/4605)) ([684e17d](https://github.com/rsuite/rsuite/commit/684e17d440c30223d29b17b504289fd8219e3fdd))
+* **DateRangePicker:** clear value on Backspace ([#4602](https://github.com/rsuite/rsuite/issues/4602)) ([cc79b66](https://github.com/rsuite/rsuite/commit/cc79b66600dcb2e071ea137cb88bcd9fe36bb1d6)), closes [#4601](https://github.com/rsuite/rsuite/issues/4601)
+* **useDialog:** support Enter and Escape keyboard actions ([#4604](https://github.com/rsuite/rsuite/issues/4604)) ([3f5adff](https://github.com/rsuite/rsuite/commit/3f5adffcddd387060045d95de9e1323e117b3673))
+* **useMediaQuery:** support dynamic enabled changes ([#4606](https://github.com/rsuite/rsuite/issues/4606)) ([fd24054](https://github.com/rsuite/rsuite/commit/fd240542630692ae9512348de14572f47b7fdb88))
+
+
+
 ## [6.2.4](https://github.com/rsuite/rsuite/compare/v6.2.3...v6.2.4) (2026-08-21)
 
 
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "rsuite",
-  "version": "6.2.4",
+  "version": "6.2.5",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "rsuite",
-      "version": "6.2.4",
+      "version": "6.2.5",
       "license": "MIT",
       "dependencies": {
         "@babel/runtime": "^7.26.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "rsuite",
-  "version": "6.2.4",
+  "version": "6.2.5",
   "description": "A suite of react components",
   "main": "lib/cjs/index.js",
   "module": "lib/esm/index.js",
```

---

### Incident Patch 10: `684e17d4` (2026-10-03)
**Commit Message**: fix(ButtonGroup): support Badge-wrapped buttons (#4605)

* fix(ButtonGroup): support Badge-wrapped buttons

* fix(ButtonGroup): guard Badge layout eligibility

* test(ButtonGroup): assert raw SSR markup

**File**: `src/Badge/Badge.tsx` (modified, +18/-2)
```diff
@@ -1,4 +1,6 @@
-import React, { useMemo } from 'react';
+import React, { useContext, useMemo } from 'react';
+import ButtonGroupContext from '../ButtonGroup/ButtonGroupContext';
+import { CustomContext } from '@/internals/Provider/CustomContext';
 import Box, { BoxProps } from '@/internals/Box';
 import { useStyles, useCustom } from '@/internals/hooks';
 import {
@@ -73,6 +75,8 @@ export interface BadgeProps extends BoxProps {
  */
 const Badge = forwardRef<'div', BadgeProps>((props: BadgeProps, ref) => {
   const { propsWithDefaults } = useCustom('Badge', props);
+  const buttonGroup = useContext(ButtonGroupContext);
+  const { components } = useContext(CustomContext);
   const {
     as,
     content,
@@ -92,6 +96,10 @@ const Badge = forwardRef<'div', BadgeProps>((props: BadgeProps, ref) => {
     ...rest
   } = propsWithDefaults;
 
+  const isButtonGroupItem =
+    (as === undefined || typeof as === 'string') &&
+    buttonGroup?.isBadgeButton?.(children, components);
+
   const { withPrefix, prefix, merge } = useStyles(classPrefix);
   const text = typeof content === 'number' && content > maxCount ? `${maxCount}+` : content;
   const isOneChar = useMemo(() => String(content)?.length === 1, [content]);
@@ -130,7 +138,15 @@ const Badge = forwardRef<'div', BadgeProps>((props: BadgeProps, ref) => {
     );
   }
   return (
-    <Box as={as} ref={ref} className={classes} style={styles} {...dataAttributes} {...rest}>
+    <Box
+      as={as}
+      ref={ref}
+      className={classes}
+      style={styles}
+      {...dataAttributes}
+      {...rest}
+      data-button-group-item={isButtonGroupItem || undefined}
+    >
       {children}
       <div className={prefix('content')}>{text}</div>
     </Box>
```

**File**: `src/Button/Button.tsx` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import React, { useContext, useMemo } from 'react';
 import Ripple from '@/internals/Ripple';
 import Box, { BoxProps } from '@/internals/Box';
 import SafeAnchor from '@/internals/SafeAnchor';
-import { ButtonGroupContext } from '../ButtonGroup';
+import ButtonGroupContext from '../ButtonGroup/ButtonGroupContext';
 import { forwardRef, isOneOf, isDisableableElement } from '@/internals/utils';
 import { useStyles, useCustom, useControlled, useEventCallback } from '@/internals/hooks';
 import { Color, BasicSize, AppearanceType } from '@/internals/types';
```

**File**: `src/ButtonGroup/ButtonGroup.tsx` (modified, +11/-2)
```diff
@@ -1,5 +1,7 @@
-import React, { useMemo } from 'react';
+import React, { useContext, useMemo } from 'react';
 import ButtonGroupContext from './ButtonGroupContext';
+import isBadgeButton, { canJustifyBadgeButtons } from './isBadgeButton';
+import { CustomContext } from '@/internals/Provider/CustomContext';
 import Box, { BoxProps } from '@/internals/Box';
 import { forwardRef } from '@/internals/utils';
 import { useStyles, useCustom } from '@/internals/hooks';
@@ -38,6 +40,7 @@ export interface ButtonGroupProps extends BoxProps {
  */
 const ButtonGroup = forwardRef<'div', ButtonGroupProps>((props: ButtonGroupProps, ref) => {
   const { propsWithDefaults } = useCustom('ButtonGroup', props);
+  const { components } = useContext(CustomContext);
   const {
     as,
     classPrefix = 'btn-group',
@@ -55,7 +58,12 @@ const ButtonGroup = forwardRef<'div', ButtonGroupProps>((props: ButtonGroupProps
 
   const { withPrefix, merge } = useStyles(classPrefix);
   const classes = merge(className, withPrefix());
-  const contextValue = useMemo(() => ({ size, disabled }), [disabled, size]);
+  const contextValue = useMemo(() => ({ size, disabled, isBadgeButton }), [disabled, size]);
+  const badgeLayout =
+    justified &&
+    !vertical &&
+    (as === undefined || typeof as === 'string') &&
+    canJustifyBadgeButtons(children, components);
 
   return (
     <ButtonGroupContext.Provider value={contextValue}>
@@ -70,6 +78,7 @@ const ButtonGroup = forwardRef<'div', ButtonGroupProps>((props: ButtonGroupProps
         data-vertical={vertical}
         data-justified={justified}
         data-divided={divided}
+        data-badge-layout={badgeLayout || undefined}
       >
         {children}
       </Box>
```

**File**: `src/ButtonGroup/ButtonGroupContext.ts` (modified, +7/-0)
```diff
@@ -1,9 +1,16 @@
 import React from 'react';
 import { Size } from '@/internals/types';
+import type { ReactSuiteComponents } from '@/internals/Provider/types';
 
 export interface ButtonGroupContextProps {
   size?: Size;
   disabled?: boolean;
+
+  /** @internal Checks whether Badge children can participate in the group layout. */
+  isBadgeButton?: (
+    children: React.ReactNode,
+    components?: Partial<ReactSuiteComponents>
+  ) => boolean;
 }
 
 const ButtonGroupContext = React.createContext<ButtonGroupContextProps | null>(null);
```

**File**: `src/ButtonGroup/isBadgeButton.ts` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+import React from 'react';
+import Button from '../Button/Button';
+import IconButton from '../IconButton/IconButton';
+import Badge from '../Badge/Badge';
+import type { BadgeProps } from '../Badge/Badge';
+import SafeAnchor from '@/internals/SafeAnchor';
+import type { ButtonProps } from '../Button/Button';
+import type { ReactSuiteComponents } from '@/internals/Provider/types';
+
+function getChildren(children: React.ReactNode) {
+  const nodes: React.ReactNode[] = [];
+  const collect = (child: React.ReactNode) => {
+    if (child === null || child === undefined || typeof child === 'boolean') {
+      return;
+    }
+    if (Array.isArray(child)) {
+      child.forEach(collect);
+    } else if (
+      React.isValidElement<{ children?: React.ReactNode }>(child) &&
+      child.type === React.Fragment
+    ) {
+      collect(child.props.children);
+    } else {
+      // Leave unknown nodes intact, including iterables that inspection could consume.
+      nodes.push(child);
+    }
+  };
+  collect(children);
+  return nodes;
+}
+
+function getComponentType(child: React.ReactElement) {
+  let type: unknown = child.type;
+  // A custom comparator may retain output that no longer matches the current props.
+  while (
+    typeof type === 'object' &&
+    type !== null &&
+    '$$typeof' in type &&
+    type.$$typeof === Symbol.for('react.memo') &&
+    (!('compare' in type) || type.compare === null || type.compare === undefined) &&
+    'type' in type
+  ) {
+    type = type.type;
+  }
+  return type;
+}
+
+function isButton(child: React.ReactNode, components: Partial<ReactSuiteComponents>) {
+  if (!React.isValidElement<ButtonProps>(child)) {
+    return false;
+  }
+  const type = getComponentType(child);
+  if (type !== Button && type !== IconButton) {
+    return false;
+  }
+
+  const props = {
+    ...components.Button?.defaultProps,
+    ...(type === IconButton ? components.IconButton?.defaultProps : undefined),
+    ...child.props
+  };
+  const as = props.as || (props.href ? SafeAnchor : 'button');
+  if (as === SafeAnchor) {
+    const anchorAs = components.SafeAnchor?.defaultProps?.as;
+    return anchorAs === undefined || typeof anchorAs === 'string';
+  }
+  return typeof as === 'string';
+}
+
+/** Only known buttons with a single DOM root can participate in Badge group layouts. */
+function isBadgeButton(children: React.ReactNode, components: Partial<ReactSuiteComponents> = {}) {
+  const nodes = getChildren(children);
+  return nodes.length === 1 && isButton(nodes[0], components);
+}
+
+/** Text and unknown component output can create anonymous grid items. */
+export function canJustifyBadgeButtons(
+  children: React.ReactNode,
+  components: Partial<ReactSuiteComponents> = {}
+) {
+  return getChildren(children).every(child => {
+    if (isButton(child, components)) {
+      return true;
+    }
+    if (!React.isValidElement<BadgeProps>(child) || getComponentType(child) !== Badge) {
+      return false;
+    }
+    const props = { ...components.Badge?.defaultProps, ...child.props };
+    return (
+      (props.as === undefined || typeof props.as === 'string') &&
+      isBadgeButton(props.children, components)
+    );
+  });
+}
+
+export default isBadgeButton;
```

**File**: `src/ButtonGroup/styles/index.scss` (modified, +118/-0)
```diff
@@ -1,6 +1,17 @@
 @use '../../internals/Box/styles/index' as box;
 @use '../../styles/mixins/utilities' as utils;
 
+// React also checks text nodes and custom components before marking a wrapper.
+$single-badge-button: '.rs-btn:first-child:nth-last-child(2)';
+$badge-button-wrapper: '.rs-badge-wrapper[data-button-group-item="true"]:has(> #{$single-badge-button})';
+$badge-ghost-wrapper: '#{$badge-button-wrapper}:has(> .rs-btn[data-appearance="ghost"])';
+$unsupported-group-items: (
+  '> :not(.rs-btn, .rs-badge-wrapper[data-button-group-item="true"])',
+  '> .rs-badge-wrapper > :not(.rs-btn, .rs-badge-content)',
+  '> .rs-badge-wrapper > .rs-btn ~ .rs-btn',
+  '> .rs-badge-wrapper > :first-child:not(.rs-btn)'
+);
+
 //
 // Button groups
 // --------------------------------------------------
@@ -20,6 +31,18 @@
       z-index: 2;
     }
   }
+
+  > #{$badge-button-wrapper} {
+    position: relative;
+
+    &:has(> .rs-btn:focus, > .rs-btn:active) {
+      z-index: 2;
+    }
+
+    > .rs-btn {
+      position: relative;
+    }
+  }
 }
 
 // Horizontal Button remove border radius
@@ -36,16 +59,38 @@
     }
   }
 
+  > #{$badge-button-wrapper} {
+    float: inline-start;
+
+    &:not(:last-child) > .rs-btn {
+      @include utils.border-right-radius(0);
+    }
+
+    &:not(:first-child) > .rs-btn {
+      @include utils.border-left-radius(0);
+    }
+  }
+
   // collapse border
   > .rs-btn[data-appearance='ghost'] + .rs-btn[data-appearance='ghost'] {
     margin-inline-start: -1px;
   }
 
+  > .rs-btn[data-appearance='ghost'] + #{$badge-ghost-wrapper},
+  > #{$badge-ghost-wrapper} + .rs-btn[data-appearance='ghost'],
+  > #{$badge-ghost-wrapper} + #{$badge-ghost-wrapper} {
+    margin-inline-start: -1px;
+  }
+
   &[data-divided='true'] > .rs-btn {
     &:not(:last-child) {
       border-right-width: 1px;
     }
   }
+
+  &[data-divided='true'] > #{$badge-button-wrapper}:not(:last-child) > .rs-btn {
+    border-right-width: 1px;
+  }
 }
 
 // Vertical button groups
@@ -66,17 +111,47 @@
     }
   }
 
+  > #{$badge-button-wrapper} {
+    display: block;
+    width: 100%;
+    max-width: 100%;
+
+    > .rs-btn {
+      display: block;
+      width: 100%;
+      max-width: 100%;
+    }
+
+    &:not(:last-child) > .rs-btn {
+      @include utils.border-bottom-radius(0);
+    }
+
+    &:not(:first-child) > .rs-btn {
+      @include utils.border-top-radius(0);
+    }
+  }
+
   // collapse border
   > .rs-btn[data-appearance='ghost'] + .rs-btn[data-appearance='ghost'] {
     margin-top: -1px;
   }
 
+  > .rs-btn[data-appearance='ghost'] + #{$badge-ghost-wrapper},
+  > #{$badge-ghost-wrapper} + .rs-btn[data-appearance='ghost'],
+  > #{$badge-ghost-wrapper} + #{$badge-ghost-wrapper} {
+    margin-top: -1px;
+  }
+
   &[data-divided='true'] > .rs-btn {
     &:not(:last-child) {
       border-bottom-width: 1px;
     }
   }
 
+  &[data-divided='true'] > #{$badge-button-wrapper}:not(:last-child) > .rs-btn {
+    border-bottom-width: 1px;
+  }
+
   &[data-block='true'] {
     width: 100%;
   }
@@ -93,4 +168,47 @@
     flex: 1 1 1%;
     @include utils.ellipsis-basic;
   }
+
+  > #{$badge-button-wrapper} {
+    display: flex;
+    flex: 1 1 1%;
+    min-width: 0;
+
+    > .rs-btn {
+      width: 100%;
+      min-width: 0;
+
+      @include utils.ellipsis-basic;
+    }
+  }
+
+  // Grid gives buttons and their unpadded Badge wrappers equal outer widths.
+  &[data-badge-layout='true']:not([data-vertical='true']):has(
+      > .rs-badge-wrapper[data-button-group-item='true'] > #{$single-badge-button}
+    ):not(:has(#{$unsupported-group-items})) {
+    display: grid;
+    grid-auto-flow: column;
+    grid-auto-columns: minmax(0, 1fr);
+
+    > .rs-btn {
+      width: 100%;
+      min-width: 0;
+    }
+
+    // Share ghost borders without changing the equal grid item widths.
+    > .rs-btn[data-appearance='ghost'] + .rs-btn[data-appearance='ghost'],
+    > #{$badge-ghost-wrapper} + .rs-btn[data-appearance='ghost'] {
+      margin-inline-start: 0;
+      border-inline-start-width: 0;
+    }
+
+    > .rs-btn[data-appearance='ghost'] + #{$badge-ghost-wrapper},
+    > #{$badge-ghost-wrapper} + #{$badge-ghost-wrapper} {
+      margin-inline-start: 0;
+
+      > .rs-btn {
+        border-inline-start-width: 0;
+      }
+    }
+  }
 }
```

**File**: `src/ButtonGroup/test/ButtonGroup.badge.styles.spec.tsx` (added, +435/-0)
```diff
@@ -0,0 +1,435 @@
+import React from 'react';
+import { createRoot, Root } from 'react-dom/client';
+import { flushSync } from 'react-dom';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { userEvent } from '@vitest/browser/context';
+import SearchIcon from '@rsuite/icons/Search';
+import ButtonGroup from '../ButtonGroup';
+import Button from '../../Button';
+import IconButton from '../../IconButton';
+import Badge from '../../Badge';
+import Avatar from '../../Avatar';
+
+import '../../IconButton/styles/index.scss';
+import '../../Badge/styles/index.scss';
+import '../../Avatar/styles/index.scss';
+import '../styles/index.scss';
+
+const mounts: { root: Root; container: HTMLDivElement }[] = [];
+
+// Keep style measurements synchronous with React 19's concurrent root.
+function mount(element: React.ReactNode) {
+  const container = document.createElement('div');
+  document.body.appendChild(container);
+  const root = createRoot(container);
+  mounts.push({ root, container });
+  flushSync(() => root.render(element));
+  return container;
+}
+
+afterEach(() => {
+  mounts.splice(0).forEach(({ root, container }) => {
+    flushSync(() => root.unmount());
+    container.remove();
+  });
+});
+
+const buttonsIn = (container: HTMLElement) =>
+  Array.from(container.querySelectorAll<HTMLButtonElement>('.rs-btn'));
+const rect = (element: HTMLElement) => element.getBoundingClientRect();
+const css = (element: HTMLElement) => getComputedStyle(element);
+const corners = (element: HTMLElement) => {
+  const style = css(element);
+  return [
+    style.borderStartStartRadius,
+    style.borderStartEndRadius,
+    style.borderEndStartRadius,
+    style.borderEndEndRadius
+  ].map(parseFloat);
+};
+
+describe('ButtonGroup with Badge styles', () => {
+  it.each(
+    (['default', 'ghost'] as const).flatMap(appearance =>
+      [120, 270, 360].map(width => ({ appearance, width }))
+    )
+  )(
+    'justifies $appearance buttons at $width px without clipping badge or long label',
+    ({ appearance, width }) => {
+      const container = mount(
+        <ButtonGroup justified style={{ width, marginTop: 40 }}>
+          <Button appearance={appearance}>Short</Button>
+          <Badge content="12">
+            <Button appearance={appearance}>
+              A very long button label that needs to be truncated
+            </Button>
+          </Badge>
+          <Badge content="3">
+            <IconButton appearance={appearance} aria-label="Search" icon={<SearchIcon />} />
+          </Badge>
+        </ButtonGroup>
+      );
+      const buttons = buttonsIn(container);
+      const wrappers = Array.from(container.querySelectorAll<HTMLElement>('.rs-badge-wrapper'));
+      const expectedWidth = width / 3;
+      buttons.forEach(button => expect(rect(button).width).toBeCloseTo(expectedWidth, 1));
+      wrappers.forEach(wrapper => {
+        expect(rect(wrapper).width).toBeCloseTo(expectedWidth, 1);
+        expect(css(wrapper).overflow).toBe('visible');
+        const content = wrapper.querySelector<HTMLElement>('.rs-badge-content')!;
+        expect(rect(content).right).toBeGreaterThan(rect(wrapper).right);
+        expect(
+          content.contains(
+            document.elementFromPoint(rect(content).right - 3, rect(content).top + 5)
+          )
+        ).toBe(true);
+      });
+      expect(css(buttons[1]).textOverflow).toBe('ellipsis');
+      expect(css(buttons[1]).overflow).toBe('hidden');
+      expect(buttons[1].scrollWidth).toBeGreaterThan(buttons[1].clientWidth);
+      if (appearance === 'ghost') {
+        expect(buttons.map(button => css(button).borderInlineStartWidth)).toEqual([
+          '1px',
+          '0px',
+          '0px'
+        ]);
+        buttons.slice(1).forEach((button, index) => {
+          expect(rect(button).left).toBeCloseTo(rect(buttons[index]).right, 1);
+        });
+      }
+    }
+  );
+
+  [false, true].forEach(vertical => {
+    const direction = vertical ? 'vertical' : 'horizontal';
+
+    [false, true].forEach(allBadged => {
+      it(`preserves first, middle and last corners for ${direction} ${allBadged ? 'badged' : 'mixed'} buttons`, () => {
+        const container = mount(
+          <ButtonGroup vertical={vertical} style={{ width: 300 }}>
+            {[0, 1, 2].map(index => {
+              const button = <Button key={index}>Button {index}</Button>;
+              return allBadged || index === 1 ? (
+                <Badge key={index} content="1">
+                  {button}
+                </Badge>
+              ) : (
+                button
+              );
+            })}
+          </ButtonGroup>
+        );
+        const buttons = buttonsIn(container);
+        const rounded = corners(buttons[0])[0];
+        expect(rounded).toBeGreaterThan(0);
+        expect(corners(buttons[0])).toEqual(
+          vertical ? [rounded, rounded, 0, 0] : [rounded, 0, rounded, 0]
+        );
+        expect(corners(buttons[1])).toEqual([0, 0, 0, 0]);

```

**File**: `src/ButtonGroup/test/ButtonGroup.badgeEligibility.styles.spec.tsx` (added, +426/-0)
```diff
@@ -0,0 +1,426 @@
+import React from 'react';
+import { createRoot, Root } from 'react-dom/client';
+import { flushSync } from 'react-dom';
+import { afterEach, describe, expect, it } from 'vitest';
+import SearchIcon from '@rsuite/icons/Search';
+import ButtonGroup from '../ButtonGroup';
+import Button from '../../Button';
+import IconButton from '../../IconButton';
+import Badge from '../../Badge';
+import CustomProvider from '../../CustomProvider';
+
+import '../../IconButton/styles/index.scss';
+import '../../Badge/styles/index.scss';
+import '../styles/index.scss';
+
+const mounts: { root: Root; container: HTMLDivElement }[] = [];
+
+function mount(element: React.ReactNode) {
+  const container = document.createElement('div');
+  document.body.appendChild(container);
+  const root = createRoot(container);
+  mounts.push({ root, container });
+  const render = (node: React.ReactNode) => flushSync(() => root.render(node));
+  render(element);
+  return { container, render };
+}
+
+afterEach(() => {
+  mounts.splice(0).forEach(({ root, container }) => {
+    flushSync(() => root.unmount());
+    container.remove();
+  });
+});
+
+const css = (element: HTMLElement) => getComputedStyle(element);
+const width = (element: HTMLElement) => element.getBoundingClientRect().width;
+const properties = [
+  'display',
+  'float',
+  'flex',
+  'min-width',
+  'max-width',
+  'overflow',
+  'margin-top',
+  'margin-inline-start',
+  'z-index',
+  'border-top-width',
+  'border-right-width',
+  'border-bottom-width',
+  'border-left-width',
+  'border-start-start-radius',
+  'border-start-end-radius',
+  'border-end-start-radius',
+  'border-end-end-radius'
+];
+const styles = (element: HTMLElement) =>
+  properties.map(property => css(element).getPropertyValue(property));
+const modes = [
+  { name: 'horizontal', props: {} },
+  { name: 'justified', props: { justified: true } },
+  { name: 'vertical', props: { vertical: true } },
+  { name: 'divided', props: { divided: true } }
+];
+const formats = [
+  { name: 'direct', wrap: (nodes: React.ReactNode[]) => nodes },
+  { name: 'Fragment', wrap: (nodes: React.ReactNode[]) => <>{nodes}</> },
+  { name: 'array', wrap: (nodes: React.ReactNode[]) => [nodes] },
+  { name: 'nested Fragments', wrap: (nodes: React.ReactNode[]) => <>{<>{nodes}</>}</> }
+];
+type Appearance = 'default' | 'ghost';
+const CustomMultiple = ({ appearance }: { appearance: Appearance }) => (
+  <>
+    <Button appearance={appearance}>Candidate</Button>
+    text
+  </>
+);
+const MemoMultiple = React.memo(CustomMultiple);
+const MemoButton = React.memo(Button);
+const MemoIconButton = React.memo(IconButton);
+const RetainedButton = React.memo(Button, () => true);
+const CustomButton = () => <Button>Short</Button>;
+const MultipleRoots = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
+  <>
+    <span {...props}>{children}</span>text
+  </>
+);
+const DroppedAttributes = () => (
+  <>
+    <Button>Short</Button>text
+  </>
+);
+const AppendedTextRoot = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
+  <div {...props}>{children}text</div>
+);
+const unsupported = (['element', 'text', 'zero'] as const).flatMap(kind =>
+  [false, true].flatMap(before =>
+    formats.map(({ name, wrap }) => ({
+      name: `${kind} ${before ? 'before' : 'after'} in ${name}`,
+      children: (appearance: Appearance) => {
+        const button = (
+          <Button key="button" appearance={appearance}>
+            Candidate
+          </Button>
+        );
+        const sibling =
+          kind === 'element' ? <span key="sibling">text</span> : kind === 'text' ? 'text' : 0;
+        return wrap(before ? [sibling, button] : [button, sibling]);
+      }
+    }))
+  )
+);
+unsupported.push(
+  {
+    name: 'custom component',
+    children: appearance => <CustomMultiple appearance={appearance} />
+  },
+  { name: 'memo component', children: appearance => <MemoMultiple appearance={appearance} /> }
+);
+
+describe('ButtonGroup Badge eligibility styles', () => {
+  it.each(
+    modes.flatMap(mode =>
+      unsupported.map(candidate => ({ ...mode, ...candidate, mode: mode.name }))
+    )
+  )('preserves an unsupported $name in a $mode group', ({ props, children }) => {
+    (['default', 'ghost'] as const).forEach(appearance => {
+      const items = (
+        <>
+          <Badge content="1">
+            <Button appearance={appearance}>Eligible</Button>
+          </Badge>
+          <Badge content="2" data-testid="candidate">
+            {children(appearance)}
+          </Badge>
+          <Button appearance={appearance}>Bare</Button>
+        </>
+      );
+      const { container } = mount(
+        <>
+          <div
+            data-testid="control"
+            style={{ display: 'justified' in props ? 'flex' : 'inline-block', width: 420 }}
+          >
+            {items}
+          </div>
+          <ButtonGroup {...props} style={{ width: 420 }}>
+            {items}
+        
```

---

### Incident Patch 11: `fd240542` (2026-10-03)
**Commit Message**: fix(useMediaQuery): support dynamic enabled changes (#4606)

**File**: `src/useMediaQuery/test/useMediaQuery.spec.ts` (modified, +87/-7)
```diff
@@ -1,6 +1,6 @@
 import MatchMediaMock from '@test/mocks/matchmedia-mock';
 import useMediaQuery from '../useMediaQuery';
-import { describe, expect, it, beforeEach, afterEach } from 'vitest';
+import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
 import { act, renderHook } from '@testing-library/react';
 
 let matchMedia: MatchMediaMock;
@@ -246,12 +246,92 @@ describe('useMediaQuery', () => {
   it('Should respond to enabled prop changes', () => {
     act(() => window.resizeTo(768, 1000));
 
-    // Test with enabled=true
-    const { result: enabledResult } = renderHook(() => useMediaQuery('md', true));
-    expect(enabledResult.current).to.be.deep.equal([true]);
+    const { result, rerender } = renderHook(({ enabled }) => useMediaQuery('md', enabled), {
+      initialProps: { enabled: true }
+    });
+    expect(result.current).to.be.deep.equal([true]);
+
+    rerender({ enabled: false });
+    expect(result.current).to.be.deep.equal([false]);
+
+    rerender({ enabled: true });
+    expect(result.current).to.be.deep.equal([true]);
+  });
+
+  it('Should read the current screen size when enabled after mounting', () => {
+    act(() => window.resizeTo(767, 1000));
+    const { result, rerender } = renderHook(({ enabled }) => useMediaQuery('md', enabled), {
+      initialProps: { enabled: false }
+    });
+    expect(result.current).to.be.deep.equal([false]);
+
+    act(() => window.resizeTo(768, 1000));
+    rerender({ enabled: true });
+    expect(result.current).to.be.deep.equal([true]);
+
+    rerender({ enabled: false });
+    act(() => window.resizeTo(767, 1000));
+    rerender({ enabled: true });
+    expect(result.current).to.be.deep.equal([false]);
 
-    // Test with enabled=false
-    const { result: disabledResult } = renderHook(() => useMediaQuery('md', false));
-    expect(disabledResult.current).to.be.deep.equal([false]);
+    act(() => window.resizeTo(768, 1000));
+    expect(result.current).to.be.deep.equal([true]);
+  });
+
+  it('Should stop listening when disabled and clean up after unmounting', () => {
+    const addListener = vi.fn();
+    const removeListener = vi.fn();
+    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
+      matches: true,
+      addEventListener: addListener,
+      removeEventListener: removeListener
+    } as unknown as MediaQueryList);
+
+    try {
+      const { result, rerender, unmount } = renderHook(
+        ({ enabled }) => useMediaQuery('md', enabled),
+        { initialProps: { enabled: false } }
+      );
+      expect(result.current).to.be.deep.equal([false]);
+      expect(matchMediaSpy).not.toHaveBeenCalled();
+
+      rerender({ enabled: true });
+      expect(result.current).to.be.deep.equal([true]);
+      expect(addListener).toHaveBeenCalledTimes(1);
+
+      rerender({ enabled: false });
+      expect(removeListener).toHaveBeenCalledWith('change', addListener.mock.calls[0][1]);
+      const callsBeforeRerender = matchMediaSpy.mock.calls.length;
+      rerender({ enabled: false });
+      expect(matchMediaSpy).toHaveBeenCalledTimes(callsBeforeRerender);
+
+      rerender({ enabled: true });
+      expect(addListener).toHaveBeenCalledTimes(2);
+      unmount();
+      expect(removeListener).toHaveBeenCalledTimes(2);
+      expect(removeListener).toHaveBeenLastCalledWith('change', addListener.mock.calls[1][1]);
+    } finally {
+      matchMediaSpy.mockRestore();
+    }
+  });
+
+  it('Should update the queried breakpoints when re-enabled', () => {
+    act(() => window.resizeTo(768, 1000));
+    const { result, rerender } = renderHook(({ query, enabled }) => useMediaQuery(query, enabled), {
+      initialProps: { query: ['md'], enabled: true }
+    });
+    expect(result.current).to.be.deep.equal([true]);
+
+    rerender({ query: ['lg', 'md'], enabled: false });
+    expect(result.current).to.be.deep.equal([false, false]);
+
+    rerender({ query: ['lg', 'md'], enabled: true });
+    expect(result.current).to.be.deep.equal([false, true]);
+
+    rerender({ query: ['md', 'lg', 'md'], enabled: true });
+    expect(result.current).to.be.deep.equal([true, false, true]);
+
+    act(() => window.resizeTo(992, 1000));
+    expect(result.current).to.be.deep.equal([true, true, true]);
   });
 });
```

**File**: `src/useMediaQuery/test/useMediaQuery.ssr.test.ts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import React from 'react';
+import { renderToString } from 'react-dom/server';
+import { describe, expect, it } from 'vitest';
+import useMediaQuery from '../useMediaQuery';
+
+describe('useMediaQuery SSR', () => {
+  it.each([true, false])('Should return unmatched queries when enabled=%s', enabled => {
+    function MediaQueries() {
+      const matches = useMediaQuery(['xs', 'md'], enabled);
+      return React.createElement('span', null, JSON.stringify(matches));
+    }
+
+    expect(renderToString(React.createElement(MediaQueries))).toBe('<span>[false,false]</span>');
+  });
+});
```

**File**: `src/useMediaQuery/useMediaQuery.ts` (modified, +34/-48)
```diff
@@ -1,6 +1,6 @@
 import canUseDOM from 'dom-lib/canUseDOM';
 import { breakpointValues } from '@/internals/styled-system';
-import { useSyncExternalStore, useCallback, useRef, useMemo } from 'react';
+import { useSyncExternalStore, useMemo } from 'react';
 import { createBreakpoints } from './breakpoints';
 import type { Query } from './types';
 
@@ -33,59 +33,45 @@ const matchMedia = (query: string) => {
  * @param enabled - Whether to enable the media query, defaults to true
  */
 export function useMediaQuery(query: Query | Query[], enabled: boolean = true): boolean[] {
-  const queries = Array.isArray(query) ? query : [query];
-
-  const mediaQueries = useMemo(
-    () => queries.map(query => mediaQuerySizeMap[query] || query),
-    [...queries]
-  );
-
-  // If not enabled, we don't need to set up any media queries
-  if (!enabled) {
-    return queries.map(() => false);
-  }
-
-  const mediaQueryArray = useRef<boolean[]>(mediaQueries.map(query => matchMedia(query).matches));
-
-  const subscribe = useCallback(
-    callback => {
-      const list = mediaQueries.map(query => matchMedia(query));
-
-      const handleChange = (event: MediaQueryListEvent) => {
-        const index = list.findIndex(item => item.media === event.media);
-        if (index !== -1) {
-          // The store snapshot returned by getSnapshot must be immutable. So we need to create a new array.
-          const nextMediaQueryArray = mediaQueryArray.current.slice();
-          nextMediaQueryArray[index] = event.matches;
-
-          mediaQueryArray.current = nextMediaQueryArray;
+  const queryKey = JSON.stringify(Array.isArray(query) ? query : [query]);
+
+  const store = useMemo(() => {
+    const mediaQueries = (JSON.parse(queryKey) as Query[]).map(
+      query => mediaQuerySizeMap[query] || query
+    );
+    const serverSnapshot = mediaQueries.map(() => false);
+    let snapshot = serverSnapshot;
+
+    return {
+      subscribe: (callback: () => void) => {
+        if (!enabled) {
+          return () => {};
         }
 
-        callback();
-      };
-
-      list.forEach(query => {
-        query.addEventListener('change', handleChange);
-      });
+        const list = mediaQueries.map(query => matchMedia(query));
+        list.forEach(query => query.addEventListener('change', callback));
 
-      return () => {
-        list.forEach(query => {
-          query.removeEventListener('change', handleChange);
-        });
-      };
-    },
-    [mediaQueries]
-  );
+        return () => {
+          list.forEach(query => query.removeEventListener('change', callback));
+        };
+      },
+      getSnapshot: () => {
+        if (!enabled) {
+          return serverSnapshot;
+        }
 
-  const getSnapshot = useCallback(() => {
-    return mediaQueryArray.current;
-  }, []);
+        const nextSnapshot = mediaQueries.map(query => matchMedia(query).matches);
+        if (nextSnapshot.some((matches, index) => matches !== snapshot[index])) {
+          snapshot = nextSnapshot;
+        }
 
-  const getServerSnapshot = useCallback(() => {
-    return mediaQueryArray.current;
-  }, []);
+        return snapshot;
+      },
+      getServerSnapshot: () => serverSnapshot
+    };
+  }, [queryKey, enabled]);
 
-  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
+  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
 }
 
 export default useMediaQuery;
```

**File**: `test/cases/testPickers.tsx` (modified, +18/-0)
```diff
@@ -98,6 +98,24 @@ export function testPickers(TestComponent: React.ComponentType<any>, options?: T
         expect(screen.getByTestId('picker')).not.to.have.attr('responsive');
       });
 
+      it('Should switch responsive popup behavior when the prop changes', () => {
+        const { rerender } = render(<TestComponent data={data} open responsive={false} />);
+
+        expect(screen.getByTestId('picker-popup').closest('.rs-drawer')).to.be.null;
+
+        [true, false, true].forEach(responsive => {
+          rerender(<TestComponent data={data} open responsive={responsive} />);
+
+          const drawer = screen.getByTestId('picker-popup').closest('.rs-drawer');
+
+          if (responsive) {
+            expect(drawer).to.exist;
+          } else {
+            expect(drawer).to.be.null;
+          }
+        });
+      });
+
       it('Should support a responsive default from CustomProvider', () => {
         render(
           <CustomProvider
```

---

### Incident Patch 12: `3f5adffc` (2026-10-03)
**Commit Message**: fix(useDialog): support Enter and Escape keyboard actions (#4604)

**File**: `src/useDialog/Dialog.tsx` (modified, +60/-7)
```diff
@@ -18,6 +18,7 @@ export interface DialogProps extends ModalProps {
   defaultValue?: string;
   validate?: (value: string) => [isValid: boolean, errorMessage?: string];
   onClose?: (result?: any) => void;
+  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
 }
 
 const severityMap: Record<'info' | 'success' | 'warning' | 'error', Color> = {
@@ -40,12 +41,14 @@ const Dialog = forwardRef((props: DialogProps, ref) => {
     defaultValue = '',
     validate,
     onClose,
+    onKeyDown,
     ...rest
   } = propsWithDefaults;
   const [isOpen, setIsOpen] = useState(true);
   const [validationError, setValidationError] = useState<string>();
   const inputRef = useRef<HTMLInputElement>(null);
   const inputValue = useRef(defaultValue);
+  const isClosing = useRef(false);
   const showCancelButton = type === 'confirm' || type === 'prompt';
 
   useEffect(() => {
@@ -56,6 +59,9 @@ const Dialog = forwardRef((props: DialogProps, ref) => {
 
   const handleCancel = useCallback(
     (result?: any) => {
+      if (isClosing.current) return;
+
+      isClosing.current = true;
       setIsOpen(false);
 
       setTimeout(() => {
@@ -66,6 +72,8 @@ const Dialog = forwardRef((props: DialogProps, ref) => {
   );
 
   const handleConfirm = useCallback(() => {
+    if (isClosing.current) return;
+
     if (type === 'prompt') {
       const value = inputValue.current;
       if (validate) {
@@ -83,13 +91,51 @@ const Dialog = forwardRef((props: DialogProps, ref) => {
 
   const handleClose = useCallback(() => handleCancel(false), [handleCancel]);
 
-  const handleInputKeyDown = useCallback(
-    (event: React.KeyboardEvent<HTMLInputElement>) => {
-      if (event.key === 'Enter') {
-        handleConfirm();
+  const handleModalClose = useCallback(
+    (event?: React.SyntheticEvent) => {
+      const keyboardEvent = (event?.nativeEvent ?? event) as KeyboardEvent | undefined;
+
+      if (
+        keyboardEvent?.key === 'Escape' &&
+        (keyboardEvent.defaultPrevented ||
+          keyboardEvent.isComposing ||
+          keyboardEvent.keyCode === 229)
+      ) {
+        return;
+      }
+
+      handleClose();
+    },
+    [handleClose]
+  );
+
+  const handleKeyDown = useCallback(
+    (event: React.KeyboardEvent<HTMLElement>) => {
+      onKeyDown?.(event);
+
+      if (
+        event.key !== 'Enter' ||
+        event.defaultPrevented ||
+        event.nativeEvent.isComposing ||
+        event.keyCode === 229 ||
+        event.repeat ||
+        event.altKey ||
+        event.ctrlKey ||
+        event.metaKey ||
+        event.shiftKey
+      ) {
+        return;
       }
+
+      // Let buttons and custom content handle their own keyboard interactions.
+      if (event.target !== event.currentTarget && event.target !== inputRef.current) {
+        return;
+      }
+
+      event.preventDefault();
+      handleConfirm();
     },
-    [handleConfirm]
+    [handleConfirm, onKeyDown]
   );
 
   const handlePromptInputChange = useCallback(
@@ -101,7 +147,15 @@ const Dialog = forwardRef((props: DialogProps, ref) => {
   );
 
   return (
-    <Modal ref={ref} open={isOpen} size="xs" backdrop="static" {...rest}>
+    <Modal
+      ref={ref}
+      open={isOpen}
+      size="xs"
+      backdrop="static"
+      {...rest}
+      onClose={handleModalClose}
+      onKeyDown={handleKeyDown}
+    >
       <Modal.Header closeButton={false}>
         <Modal.Title>{title}</Modal.Title>
       </Modal.Header>
@@ -117,7 +171,6 @@ const Dialog = forwardRef((props: DialogProps, ref) => {
                 id="rs-prompt-input"
                 defaultValue={defaultValue}
                 onChange={handlePromptInputChange}
-                onKeyDown={handleInputKeyDown}
               />
               {validationError && <Text color="red">{validationError}</Text>}
             </>
```

**File**: `src/useDialog/test/Dialog.keyboard.spec.tsx` (added, +423/-0)
```diff
@@ -0,0 +1,423 @@
+import React from 'react';
+import { createPortal } from 'react-dom';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { userEvent } from '@vitest/browser/context';
+import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
+import Dialog, { DialogProps } from '../Dialog';
+import useDialog from '../useDialog';
+import CustomProvider from '../../CustomProvider';
+import Modal from '../../Modal';
+
+describe('Dialog keyboard interactions', () => {
+  beforeEach(() => {
+    vi.useFakeTimers();
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  const finishAnimations = () => {
+    act(() => {
+      vi.advanceTimersByTime(1000);
+    });
+  };
+
+  const renderDialog = (props: Omit<Partial<DialogProps>, 'onClose'> = {}) => {
+    const onClose = vi.fn();
+
+    render(<Dialog type="confirm" content="Dialog content" onClose={onClose} {...props} />);
+    finishAnimations();
+
+    return { onClose, wrapper: screen.getAllByTestId('modal-wrapper')[0] };
+  };
+
+  it.each(['alert', 'confirm'] as const)(
+    'Should confirm %s when Enter is pressed on the initially focused container',
+    async type => {
+      const { onClose, wrapper } = renderDialog({ type });
+
+      expect(document.activeElement).to.equal(wrapper);
+      await act(async () => {
+        await userEvent.keyboard('{Enter}');
+      });
+      finishAnimations();
+
+      expect(onClose).toHaveBeenCalledExactlyOnceWith(true);
+      expect(screen.queryByRole('dialog')).to.not.exist;
+    }
+  );
+
+  it.each(['alert', 'confirm', 'prompt'] as const)(
+    'Should cancel %s when Escape is pressed',
+    type => {
+      const { onClose } = renderDialog({ type, defaultValue: 'Prompt value' });
+
+      fireEvent.keyDown(document, { key: 'Escape' });
+      finishAnimations();
+
+      expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
+      expect(screen.queryByRole('dialog')).to.not.exist;
+    }
+  );
+
+  it('Should return the same result for prompt cancellation with Escape and Cancel', () => {
+    const escapeClose = renderDialog({ type: 'prompt', defaultValue: 'Prompt value' }).onClose;
+
+    fireEvent.keyDown(document, { key: 'Escape' });
+    finishAnimations();
+
+    const cancelClose = renderDialog({ type: 'prompt', defaultValue: 'Prompt value' }).onClose;
+
+    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
+    finishAnimations();
+
+    expect(escapeClose).toHaveBeenCalledExactlyOnceWith(false);
+    expect(cancelClose).toHaveBeenCalledExactlyOnceWith(false);
+  });
+
+  it.each([
+    ['an active composition', { isComposing: true }],
+    ['the IME processing key code', { keyCode: 229 }]
+  ] as const)('Should not cancel a prompt with Escape during %s', (_description, eventOptions) => {
+    const { onClose } = renderDialog({ type: 'prompt', defaultValue: 'Prompt value' });
+
+    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape', ...eventOptions });
+    finishAnimations();
+
+    expect(onClose).not.toHaveBeenCalled();
+    expect(screen.getByRole('dialog')).to.exist;
+
+    fireEvent.keyDown(document, { key: 'Escape' });
+    finishAnimations();
+
+    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
+  });
+
+  it('Should allow custom content to prevent Escape cancellation', () => {
+    const { onClose } = renderDialog({
+      content: <input aria-label="Custom input" onKeyDown={event => event.preventDefault()} />
+    });
+
+    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
+    finishAnimations();
+
+    expect(onClose).not.toHaveBeenCalled();
+    expect(screen.getByRole('dialog')).to.exist;
+
+    fireEvent.keyDown(document, { key: 'Escape' });
+    finishAnimations();
+
+    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
+  });
+
+  it('Should allow onEsc to prevent Escape cancellation', () => {
+    const onEsc = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
+    const { onClose } = renderDialog({ onEsc });
+
+    fireEvent.keyDown(document, { key: 'Escape' });
+    finishAnimations();
+
+    expect(onEsc).toHaveBeenCalledTimes(1);
+    expect(onClose).not.toHaveBeenCalled();
+    expect(screen.getByRole('dialog')).to.exist;
+
+    onEsc.mockImplementation(() => {});
+    fireEvent.keyDown(document, { key: 'Escape' });
+    finishAnimations();
+
+    expect(onEsc).toHaveBeenCalledTimes(2);
+    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
+  });
+
+  it('Should validate prompt input before confirming with Enter', () => {
+    const validate = vi.fn((value: string): [boolean, string?] => [
+      value.length >= 3,
+      'Please enter at least three characters'
+    ]);
+    const { onClose } = renderDialog({ type: 'prompt', validate });
+    const input = screen.getByRole('textbox');
+
+    fireEvent.change(input, { target: { value: 'Jo' } });
+    fireEvent.keyDown(input, { key: 'Enter' });
+    finishAnimations();
+

```

---

### Incident Patch 13: `cc79b666` (2026-10-03)
**Commit Message**: fix(DateRangePicker): clear value on Backspace (#4602)

Clearing the input with Backspace makes DateRangeInput call onChange
with null, which DateRangePicker ignored: onChange was never called,
the clear button stayed visible and the previous range was restored
when the input was focused again.

Forward null through setDateRange so it behaves like the clear button
and like DatePicker.

Fixes #4601

**File**: `src/DateRangePicker/DateRangePicker.tsx` (modified, +1/-0)
```diff
@@ -767,6 +767,7 @@ const DateRangePicker = forwardRef<'div', DateRangePickerProps, typeof StaticMet
      */
     const handleInputChange = useEventCallback((value: [Date, Date] | null, event) => {
       if (!value) {
+        setDateRange(event, null, false);
         return;
       }
 
```

**File**: `src/DateRangePicker/test/DateRangePicker.spec.tsx` (modified, +26/-0)
```diff
@@ -222,6 +222,32 @@ describe('DateRangePicker', () => {
     expect(onClean).toHaveBeenCalledTimes(1);
   });
 
+  it('Should clear the value when the input text is removed with Backspace', () => {
+    const onChange = vi.fn();
+    render(
+      <DateRangePicker
+        format="yyyy-MM-dd"
+        defaultValue={[new Date('2023-10-01'), new Date('2023-10-02')]}
+        onChange={onChange}
+      />
+    );
+
+    const input = screen.getByRole('textbox') as HTMLInputElement;
+
+    fireEvent.focus(input);
+    input.select();
+    fireEvent.keyDown(input, { key: 'Backspace' });
+
+    expect(onChange).toHaveBeenCalledTimes(1);
+    expect(onChange.mock.calls[0][0]).to.be.null;
+    expect(screen.queryByRole('button', { name: 'Clear' })).to.not.exist;
+
+    fireEvent.blur(input);
+    fireEvent.focus(input);
+
+    expect(input).to.have.value('yyyy-MM-dd ~ yyyy-MM-dd');
+  });
+
   it('Should call `onOpen` callback', async () => {
     const onOpen = vi.fn();
     render(<DateRangePicker onOpen={onOpen} />);
```

---

### Incident Patch 14: `72b8c7e8` (2026-08-21)
**Commit Message**: build(docs): bump rsuite 6.2.4

**File**: `docs/package-lock.json` (modified, +6/-6)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "docs",
-  "version": "6.2.3",
+  "version": "6.2.4",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "docs",
-      "version": "6.2.3",
+      "version": "6.2.4",
       "license": "MIT",
       "dependencies": {
         "@docsearch/react": "^3.2.1",
@@ -51,7 +51,7 @@
         "react-icons": "^5.0.1",
         "react-json-tree": "^0.20.0",
         "react-select": "^5.5.9",
-        "rsuite": "^6.2.3",
+        "rsuite": "^6.2.4",
         "superstruct": "^2.0.2",
         "svg-sprite-loader": "^6.0.11",
         "svgo": "^2.3.1",
@@ -9808,9 +9808,9 @@
       }
     },
     "node_modules/rsuite": {
-      "version": "6.2.3",
-      "resolved": "https://registry.npmjs.org/rsuite/-/rsuite-6.2.3.tgz",
-      "integrity": "sha512-kyGQWFQC3IYMZT3aE9GNyxWmSokBe4DmWlzBJvVqq7Ze5TSbf/85Gv3CxKNkSxKU91CAgvAInglwpw8p7kD1Pg==",
+      "version": "6.2.4",
+      "resolved": "https://registry.npmjs.org/rsuite/-/rsuite-6.2.4.tgz",
+      "integrity": "sha512-Wb8bMg0YCGGE0Ni0UpJW5QOXm/En5g7QpHBhOtFlkBg+NPwbt4AJE7VuQQr/ALNvmt2R5ijtc5+wfOgS/6CXdw==",
       "license": "MIT",
       "dependencies": {
         "@babel/runtime": "^7.26.0",
```

**File**: `docs/package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "docs",
-  "version": "6.2.3",
+  "version": "6.2.4",
   "license": "MIT",
   "private": true,
   "scripts": {
@@ -66,7 +66,7 @@
     "react-icons": "^5.0.1",
     "react-json-tree": "^0.20.0",
     "react-select": "^5.5.9",
-    "rsuite": "^6.2.3",
+    "rsuite": "^6.2.4",
     "superstruct": "^2.0.2",
     "svg-sprite-loader": "^6.0.11",
     "svgo": "^2.3.1",
```

---

### Incident Patch 15: `781c71a9` (2026-08-21)
**Commit Message**: build: bump 6.2.4

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -1,3 +1,12 @@
+## [6.2.4](https://github.com/rsuite/rsuite/compare/v6.2.3...v6.2.4) (2026-08-21)
+
+
+### Bug Fixes
+
+* **Box:** make CSS prop detection SSR-safe ([#4598](https://github.com/rsuite/rsuite/issues/4598)) ([decbdbe](https://github.com/rsuite/rsuite/commit/decbdbe3c95aa0b0f7e67a19dd91be225c27e7d0))
+
+
+
 ## [6.2.3](https://github.com/rsuite/rsuite/compare/v6.2.2...v6.2.3) (2026-08-21)
 
 
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "rsuite",
-  "version": "6.2.3",
+  "version": "6.2.4",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "rsuite",
-      "version": "6.2.3",
+      "version": "6.2.4",
       "license": "MIT",
       "dependencies": {
         "@babel/runtime": "^7.26.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "rsuite",
-  "version": "6.2.3",
+  "version": "6.2.4",
   "description": "A suite of react components",
   "main": "lib/cjs/index.js",
   "module": "lib/esm/index.js",
```

#### Recent Merged Pull Requests:
- **PR #4698** (2026-10-06): fix(Form): preserve terminal parent validation errors (@simonguo)
- **PR #4691** (2026-10-06): fix(AutoComplete): respect composing keyboard events (@simonguo)
- **PR #4682** (2026-10-04): fix(docs): patch all locked SVGO instances (@simonguo)
- **PR #4623** (2026-10-05): fix(NumberInput): use standard wheel delta for step direction (@simonguo)
- **PR #4615** (2026-10-05): fix(Stat): format zero values consistently (@simonguo)
- **PR #4611** (2026-10-05): fix(Toggle): preserve native form state and accessible names (@simonguo)
- **PR #4607** (2026-10-04): fix(Affix): support server-side rendering (@simonguo)
- **PR #4606** (2026-10-03): fix(useMediaQuery): support dynamic enabled changes (@simonguo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
