# Forensic Learning Record (Deep Inspection): oblador/react-native-vector-icons

> **Canonical Artifact**: `07_PROJECT_LEARNING/oblador-react-native-vector-icons-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oblador/react-native-vector-icons](https://github.com/oblador/react-native-vector-icons))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:46:30.833Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oblador/react-native-vector-icons`
- **Description**: Customizable Icons for React Native with support for image source and full styling.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17917 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/directory/src/App.tsx`
```
import {
  type ChangeEvent,
  type FormEvent,
  type HTMLProps,
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import './App.css';

import IconFamilies from './generated/glyphmapIndex.json';

const WAITING_INTERVAL = 300;

type Match = { family: string; names: string[] };

const Icon = memo(function Icon({
  family,
  name,
  ...props
}: { family: string; name: string } & HTMLProps<HTMLSpanElement>) {
  return (
    <span style={{ fontFamily: family }} {...props}>
      {String.fromCodePoint(
        IconFamilies[family as keyof typeof IconFamilies][
          name as keyof (typeof IconFamilies)[keyof typeof IconFamilies]
        ],
      )}
    </span>
  );
});

const FamiliesLinks = ({ matches = [] }: { matches: Match[] }) => (
  <div className="Family-Links-Container">
    <div className="Family-Links-Content">
      <h2 className="Family-Links-Title">Icon Families:</h2>
      <div className="Family-Links-List">
        {matches.map((match) => {
          const { family } = match;

          return (
            <a key={family} className="Family-Links-Link" href={`#${family}`}>
              {family}
            </a>
          );
        })}
      </div>
    </div>
  </div>
);

const HeaderBar = () => (
  <div className="Header-Container">
    <div className="Header-Content">
      <h1 className="Header-Title">react-native-vector-icons directory</h1>
    </div>
  </div>
);

const SearchBar = ({ onSubmit }: { onSubmit: (text?: string) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (inputRef.current?.value) {
        onSubmit(inputRef.current.value);
      }
    },
    [onSubmit],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setTimeout(() => onSubmit(inputRef.current?.value), WAITING_INTERVAL);
    },
    [onSubmit],
  );

  return (
    <div className="Search-Container">
      <div className="Search-Content">
        <form className="Search-Form" onSubmit={handleSubmit}>
          {/* Clicking the Label focuses the cursor onto the form input */}
          <label htmlFor="Search-Input" className="Search-Label">
            <Icon family="FontAwesome" name="search" className="Search-Icon" />
          </label>
          <input
            type="text"
            id="Search-Input"
            className="Search-Input"
            ref={inputRef}
            onChange={handleChange}
            placeholder="Search for an icon..."
          />
        </form>
      </div>
    </div>
  );
};

const renderIcon = (family: string, name: string) => (
  <div className="Result-Icon-Container" key={name}>
    <Icon family={family} name={name} className="Result-Icon" />
    <h4 className="Result-Icon-Name">{name}</h4>
  </div>
);

const renderMatch = ({ family, names }: Match) => (
  <div className="Result-Row" key={family}>
    <h2 className="Result-Title" id={family}>
      {family}
    </h2>

    <div className="Result-List">{names.map((name) => renderIcon(family, name))}</div>
  </div>
);

const renderNotFound = () => (
  <div className="Result-Row">
    <h2 className="Result-Title">Icon not found.</h2>
  </div>
);

const getMatches = (query: string) =>
  Object.keys(IconFamilies)
    .sort()
    .map((family) => {
      const icons = IconFamilies[family as keyof typeof IconFamilies];
      const names = Object.keys(icons);
      const results = names.filter((name) => name.indexOf(query) >= 0);
      return { family, names: results };
    })
    .filter(({ names }) => names.length);

const App = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const handleSubmit = useCallback((text = '') => {
    setMatches(getMatches(text));
  }, []);
  useLayoutEffect(() => handleSubmit(''), [handleSubmit]);

  return (
    <div className="App">
      <HeaderBar />
      <SearchBar onSubmit={handleSubmit} />
      <FamiliesLinks matches={matches} />
      <div className="Container">{matches.length === 0 ? renderNotFound() : matches.map(renderMatch)}</div>
    </div>
  );
};

export default App;

```

### Core Architecture Module: `apps/directory/src/index.tsx`
```
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import reportWebVitals from './reportWebVitals';

import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

```

### Core Architecture Module: `apps/directory/src/react-app-env.d.ts`
```
/// <reference types="react-scripts" />

```

### Core Architecture Module: `apps/directory/src/reportWebVitals.ts`
```
import type { MetricType } from 'web-vitals';

const reportWebVitals = (onPerfEntry?: (metric: MetricType) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      onCLS(onPerfEntry);
      onINP(onPerfEntry);
      onFCP(onPerfEntry);
      onLCP(onPerfEntry);
      onTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;

```

### Core Architecture Module: `apps/icon-explorer/babel.config.js`
```
module.exports = {
  presets: ['@rnx-kit/babel-preset-metro-react-native'],
};

```

### Core Architecture Module: `apps/icon-explorer/index.js`
```
/**
 * @format
 */

import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import App from './src/App';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `apps/icon-explorer/jest.config.js`
```
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  testTimeout: 30 * 1000,
  verbose: true,
};

```

### Core Architecture Module: `apps/icon-explorer/metro.config.js`
```
const path = require('node:path');

const { makeMetroConfig } = require('@rnx-kit/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

module.exports = makeMetroConfig({
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules'), path.resolve(monorepoRoot, 'node_modules')],
  },
});

```

### Core Architecture Module: `apps/icon-explorer/react-native.config.js`
```
const project = (() => {
  try {
    const { configureProjects } = require('react-native-test-app');
    return configureProjects({
      android: {
        sourceDir: 'android',
      },
      ios: {
        sourceDir: 'ios',
      },
      windows: {
        sourceDir: 'windows',
        solutionFile: 'windows/IconExplorer.sln',
      },
    });
  } catch (_) {
    return undefined;
  }
})();

module.exports = {
  ...(project ? { project } : undefined),
};

```

### Core Architecture Module: `apps/icon-explorer/scripts/create-pro-font-stubs.mjs`
```
/**
 * Pro fonts are behind a paid license so we create empty stub .ttf files
 * with the expected names. This satisfies the podspec/gradle validation
 * and lets the build compile without real font assets.
 * This is secure and works for forks too.
 *
 * To test with real pro fonts locally, use `pnpm fetch-pro-fonts` instead.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packagesDir = resolve(currentDir, '../../../packages');
const explorerDir = resolve(currentDir, '..');

for (const dir of ['fontawesome5-pro', 'fontawesome6-pro']) {
  const destDir = join(explorerDir, 'rnvi-fonts', dir);
  mkdirSync(destDir, { recursive: true });

  const yorc = join(packagesDir, dir, '.yo-rc.json');
  const yo = JSON.parse(readFileSync(yorc, 'utf8'));
  const styles = yo['generator-react-native-vector-icons'].meta.styles;

  for (const s of Object.values(styles)) {
    writeFileSync(join(destDir, s.name), '');
    console.log(`  Created stub: ${dir}/${s.name}`);
  }
}

```

### Core Architecture Module: `apps/icon-explorer/scripts/fetch-pro-fonts.ts`
```
/**
 * Downloads FontAwesome Pro fonts and places them in rnvi-fonts/ for testing.
 * Renames files to match the fontFileName expected by the library.
 * Requires a FontAwesome npm token (https://fontawesome.com/account).
 *
 * Usage: tsx scripts/fetch-pro-fonts.ts
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const root = join(__dirname, '..');
const packagesDir = join(root, '..', '..', 'packages');

function ensureAuthToken(): Promise<void> {
  const config = execSync('npm config get', { encoding: 'utf8' });
  if (config.includes('//npm.fontawesome.com/:_authToken')) {
    return Promise.resolve();
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question('Please enter your FontAwesome npm token: ', (token) => {
      rl.close();
      execSync(`npm config set '//npm.fontawesome.com/:_authToken' '${token.trim()}'`);
      resolve();
    }),
  );
}

/**
 * Read the PostScript name from a .ttf file using fontTools (python3).
 */
function getPostScriptName(ttfPath: string): string | null {
  try {
    const result = execSync(
      `python3 -c "
from fontTools.ttLib import TTFont
font = TTFont('${ttfPath}')
for r in font['name'].names:
    if r.nameID == 6 and r.platformID == 3:
        print(r.toUnicode())
        break
"`,
      { encoding: 'utf8' },
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

interface StyleMeta {
  family: string;
  name: string;
  weight: number;
}

/**
 * Build a mapping from PostScript name -> expected fontFileName
 * by reading the .yo-rc.json of the target package.
 */
function buildPostScriptToFileNameMap(packageName: string): Record<string, string> {
  const yoRcPath = join(packagesDir, packageName, '.yo-rc.json');
  const yoRc = JSON.parse(readFileSync(yoRcPath, 'utf8'));
  const styles: Record<string, StyleMeta> = yoRc['generator-react-native-vector-icons'].meta.styles;

  const map: Record<string, string> = {};
  for (const { family, name } of Object.values(styles)) {
    // family is the PostScript name (e.g. "FontAwesome6Pro-Solid")
    map[family] = name;
  }
  return map;
}

function fetchAndExtract(version: number, packageName: string, dest: string): void {
  const tmp = mkdtempSync(join(tmpdir(), `fa-pro-v${version}-`));
  try {
    console.log(`Fetching @fortawesome/fontawesome-pro@^${version}...`);
    execSync(`npm config set '@fortawesome:registry' https://npm.fontawesome.com/`);
    const archive = execSync(`npm pack @fortawesome/fontawesome-pro@^${version} --silent`, {
      cwd: tmp,
      encoding: 'utf8',
    }).trim();
    execSync(`tar -xzf ${archive} --strip-components=1`, { cwd: tmp });

    const psNameToFileName = buildPostScriptToFileNameMap(packageName);
    const webfonts = join(tmp, 'webfonts');
    const destPath = join(root, dest);
    mkdirSync(destPath, { recursive: true });

    const fonts = readdirSync(webfonts).filter((f) => f.endsWith('.ttf'));
    for (const font of fonts) {
      const srcPath = join(webfonts, font);
      const psName = getPostScriptName(srcPath);
      if (!psName) {
        console.log(`  skipping ${font} (could not read PostScript name)`);
        continue;
      }

      const targetName = psNameToFileName[psName];
      if (!targetName) {
        console.log(`  skipping ${font} (${psName} not in ${packageName})`);
        continue;
      }

      cpSync(srcPath, join(destPath, targetName));
      console.log(`  ${font} -> ${dest}/${targetName}`);
    }
  } finally {
    rmSync(tmp, { recursive: true });
  }
}

async function main() {
  await ensureAuthToken();
  fetchAndExtract(5, 'fontawesome5-pro', 'rnvi-fonts/fontawesome5-pro');
  fetchAndExtract(6, 'fontawesome6-pro', 'rnvi-fonts/fontawesome6-pro');
  console.log('Done.');
}

main();

```

### Core Architecture Module: `apps/icon-explorer/src/App.tsx`
```
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Home } from './Home';
import { IconList, MultiIconList } from './IconList';
import type { IconName } from './IconSets';
import { TestMode } from './TestMode';

type NavType =
  | { view: 'Home' }
  | { view: 'IconSet'; iconName: IconName; iconStyle?: string }
  | { view: 'MultiIconSet'; iconName: IconName }
  | { view: 'TestMode' };

const App = () => {
  const [state, setState] = useState<NavType>({ view: 'Home' });

  const navigateToIconSet = (iconName: IconName) => {
    setState({ view: 'IconSet', iconName });
  };

  const navigateToMultiIconSet = (iconName: IconName) => {
    setState({ view: 'MultiIconSet', iconName });
  };

  const navigateToIconSetWithStyle = (iconStyle: string, iconName: IconName) => {
    setState({ view: 'IconSet', iconName, iconStyle });
  };

  const toggleTestMode = () =>
    setState((prevState) => (prevState.view === 'TestMode' ? { view: 'Home' } : { view: 'TestMode' }));

  const handleHome = () => {
    setState({ view: 'Home' });
  };

  const handleBackPress = useCallback(() => {
    if (state.view === 'IconSet' && state.iconStyle) {
      setState({ view: 'MultiIconSet', iconName: state.iconName });

      return true;
    }

    if (['IconSet', 'MultiIconSet', 'TestMode'].includes(state.view)) {
      setState({ view: 'Home' });

      return true;
    }

    return false;
  }, [state]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return handler.remove;
  }, [handleBackPress]);

  const renderContent = () => {
    switch (state.view) {
      case 'Home':
        return <Home navigator={navigateToIconSet} multiNavigator={navigateToMultiIconSet} />;
      case 'IconSet':
        return <IconList iconName={state.iconName} iconStyle={state.iconStyle} />;
      case 'MultiIconSet':
        return <MultiIconList iconName={state.iconName} navigator={navigateToIconSetWithStyle} />;
      case 'TestMode':
        return <TestMode />;
      default:
        throw new Error(`Invalid view`);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <View style={{ flex: 1 }}>{renderContent()}</View>
        <View style={styles.buttonBar}>
          <Pressable
            testID="Home"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleHome}
          >
            <Text style={styles.buttonText}>Home</Text>
          </Pressable>
          <Pressable
            testID="TestMode"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={toggleTestMode}
          >
            <Text style={styles.buttonText}>Test Mode</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  buttonBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: '#ddd',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});

export default App;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1923** (2026-08-20): **React Native 0.87 Support**
  *Symptoms*: ### Which package are you using?  @react-native-vector-icons/*  ### What platform(s) does this occur on?  iOS, Android  ### Minimal reproducible example  aaaa  ### What happened?  https://github.com/oblador/react-native-vector-icons/blob/bec977593ca46eef85b84b95eca84651de41b616/packages/common/src/dynamicLoading/dynamic-font-loading.ts#L2  Dynamic font loading depends on @react-native/assets-registry, but React Native no longer includes that dependency as of 0.87, so you need to add it manually:  `yarn add @react-native/assets-registry@0.87.0`   ### Relevant log output  ```shell  ```  ### Your computer environment  ```text System:   OS: macOS 26.6.1   CPU: (10) arm64 Apple M5   Memory: 306.58 MB / 24.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 24.15.0     path: /Users/xxx/.nvm/versions/node/v24.15.0/bin/node   Yarn:     version: 1.22.22     path: /Users/xxx/.nvm/versions/node/v24.15.0/bin/yarn   npm:     version: 11.12.1     path: /Users/xxx/.nvm/versions/node/v24.15.0/bin/npm   Watchman:     version: 2026.05.04.00     path: /opt/homebrew/bin/watchman Managers:   CocoaPods:     version: 1.16.2     path: /Users/xxx/.rbenv/shims/pod SDKs:   iOS SDK:     Platforms:       - DriverKit 25.5       - iOS 26.5       - macOS 26.5       - tvOS 26.5       - visionOS 26.5       - watchOS 26.5   Android SDK: Not Found IDEs:   Android Studio: 2025.3 AI-253.32098.37.2534.15336583   Xcode:     version: 26.6/17F113     path: /usr/bin/xcodebuild Languages
  **Post-Mortem & Fix Analysis**:
  > Hi,  Adding @react-native/assets-registry as a dependency works as a stopgap, but I don't think it's the right long-term fix.                                                                                                                                                                                                                                                                                                                       Starting with RN 0.87, react-native no longer depends on @react-native/assets-registry at all — AssetRegistry was internalized into RN core (react-native/src/private/assets/AssetRegistry.js). RN's own source even documents the intended replacement, in react-native/src/asset-registry.js:                                                                                                                                                                                                                         // This is an untyped secondary entry point intended to be r
  > Sorry, I rushed my reply. This mechanism only works if RN >= 0.87. To avoid forcing the React Native version in `peerDependencies`, you need to handle both approaches.  Maybe something like that :  const { getAssetByID } = require('react-native').AssetRegistry                                                                                                                                   ▎   ?? require('@react-native/assets-registry/registry');  

- **Issue #1917** (2026-05-26): **createIconSet renders empty on web when font is loaded externally (Firefox-visible race)**
  *Symptoms*: ### Which package are you using?  @react-native-vector-icons/*  ### What platform(s) does this occur on?  web  ### Minimal reproducible example  https://github.com/raffaelgyr/rnvi-firefox-repro  ### What happened?  ## Summary  When `createIconSet` is called in its positional/string form (no `fontSource` option) and the font is loaded externally — e.g. via `expo-font`'s `Font.loadAsync` at app startup — the rendered `<Text>` stays empty on web (the PUA codepoint never appears in the DOM) and never recovers.  The symptom is browser-dependent because it hinges on the timing of `ExpoFontLoader.getLoadedFonts()` at first render:  - **Chrome** returns the externally-loaded font in its loaded set in time → initial `useState` sees `true` → glyph renders. - **Firefox** does not → initial `useState` sees `false` → glyph is `''` and there is no listener to flip it later.  The underlying race exists in both browsers; Chrome is just the lucky side.  ## Root cause  In [`packages/common/src/create-icon-set.tsx`](https://github.com/oblador/react-native-vector-icons/blob/master/packages/common/src/create-icon-set.tsx) (lines around 105–128):  ```tsx const [isFontLoaded, setIsFontLoaded] = React.useState(   isDynamicLoadingEnabled() ? dynamicLoader.isLoaded(fontReference) : true, ); const glyph = isFontLoaded && name ? resolveGlyph(name) : '';  useEffect(() => {   let isMounted = true;   if (     !isFontLoaded &&     typeof postScriptNameOrOptions === 'object' &&     typeof postScriptNameOrOpt
  **Post-Mortem & Fix Analysis**:
  > hi @raffaelgyr can you tell me if this helps? https://github.com/oblador/react-native-vector-icons/pull/1916  the important part is   ``` // requiring `expo-font` on web calls registerWebModule, thanks to which `getIsDynamicLoadingSupported` can return true on web if (Platform.OS === 'web' && globalThis.expo) {   try {     require('expo-font');   } catch (_err) {} } ```  Thank you
  > No, It doesn't appear to help.  But maybe I was doing it wrong? I have added that code snippet to the file located at `./node_modules/@react-native-vector-icons/common/lib/module/dynamicLoading/dynamic-loading-setting.js` without making any other modifications.
  > @raffaelgyr can you also add a console.log to double-check it executes :) there's also the same file built in `/node_modules/@react-native-vector-icons/common/lib/commonjs/...` so if you don't see the console print, add it there also  thanks!

- **Issue #1908** (2026-04-23): **Expo prebuild fails: "Unable to resolve a valid config plugin for..."**
  *Symptoms*: ### Which package are you using?  @react-native-vector-icons/*  ### What platform(s) does this occur on?  Android  ### Minimal reproducible example  https://github.com/KammererTob/expo-icon-bug  ### What happened?  I tried to add @react-native-vector-icons/material-icons to my project and followed the Expo instructions. This fails at the `npx expo prebuild` step with the log below.  The reproduction is just a project created with   ```  npx create-expo-app@latest --template bare-minimum expo-icon-bug ```  And then added  `@react-native-vector-icons/material-icons` as described.  ### Relevant log output  ```shell PluginError: Unable to resolve a valid config plugin for @react-native-vector-icons/material-icons. • No "app.plugin.js" file found in @react-native-vector-icons/material-icons: config plugins are typically exported from an "app.plugin.js" file in the package root. • main export of @react-native-vector-icons/material-icons does not appear to be a config plugin: the following error was thrown when importing \open-source\expo-font-bug\node_modules\@react-native-vector-icons\material-icons\lib\commonjs\index.js: Unexpected token 'typeof' Verify that @react-native-vector-icons/material-icons includes a config plugin. If it does not, then remove the entry from plugins in your app config file. Learn more: https://docs.expo.dev/guides/config-plugins/ SyntaxError: Unexpected token 'typeof'     at compileSourceTextModule (node:internal/modules/esm/utils:318:16)     at ModuleLo
  **Post-Mortem & Fix Analysis**:
  > I think this is caused by the exports in the `package.json` exporting the name `app.plugin` instead of `app.plugin.js`. Expo looks for app.plugin.js file by default. I can do a PR for those if this is the correct fix.
  > Hi! Thanks for flagging! Yes please open a PR, Thanks.
  > fyi I'll open a PR in a few hours unless you beat me to it, thanks :)

- **Issue #1892** (2026-03-27): **@13.0  (fontello IOS "fontDir")**
  *Symptoms*: ### Which package are you using?  @react-native-vector-icons/*  ### What platform(s) does this occur on?  iOS  ### Minimal reproducible example  https://github.com/oblador/react-native-vector-icons/blob/master/README.md#setup  ### What happened?  **Since 13.0** the fontDir reference from package.json won't comply... Downgrading the version to **^12.4.0 does the trick**  ```json   "reactNativeVectorIcons": {     "fontDir": "src/assets/fonts"   } ```  ### Relevant log output  ```shell ╔══════════════════════════════════════════════════════════════════════════════╗                         🍎✨ IOS INSTALL SCRIPT ✨🍎                         ╚══════════════════════════════════════════════════════════════════════════════╝  🔍 💎 Installing Ruby gems and CocoaPods dependencies... Bundle complete! 8 Gemfile dependencies, 46 gems now installed. Bundled gems are installed into `../vendor/bundle`  [!] Invalid `Podfile` file:  [!] Invalid `react-native-vector-icons-fontello.podspec` file: (RNVI-fontello) Custom fonts directory not found: ............/src/assets/fonts/fontello. ```  ### Your computer environment  ```text info Fetching system and libraries information... System:   OS: macOS 26.3.1   CPU: (8) arm64 Apple M1   Memory: 383.77 MB / 16.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 20.19.6     path: /Users/loginnove/.nvm/versions/node/v20.19.6/bin/node   Yarn: Not Found   npm:     version: 11.7.0     path: /Users/loginnove/.nvm/versions/node/
  **Post-Mortem & Fix Analysis**:
  > :wave: @Izocel, sorry you're having an issue. As the issue template explains, it's required that you provide a runnable example that reproduces your issue (see the [issue template](https://github.com/oblador/react-native-vector-icons/blob/master/.github/ISSUE_TEMPLATE/bug_report.yml)). The reason is that a bug report is not actionable without a reproducer. Try to minimize the superfluous code and focus only on reproducing the bug. Please create a new issue with this and one of the maintainers will do their best to review it!

- **Issue #1887** (2026-04-18): **IcoMoon V2 JSON**
  *Symptoms*: ### Which package are you using?  @react-native-vector-icons/*  ### What platform(s) does this occur on?  Android  ### Minimal reproducible example  https://github.com/oblador/react-native-vector-icons/blob/master/packages/icomoon/README.md  ### What happened?  IcoMoon App v2 does not export a "selection.json" IcoMoonConfig The JSON format has changed so the createIconSet does not work.  (The v2 introduce supports for stroke export to svg)  ### Relevant log output  ```shell  ```  ### Your computer environment  ```text info Fetching system and libraries information... System:   OS: Windows 11 10.0.26100   CPU: (12) x64 Intel(R) Core(TM) i7-5820K CPU @ 3.30GHz   Memory: 11.12 GB / 31.91 GB Binaries:   Node:     version: 22.20.0     path: C:\Program Files\nodejs\node.EXE   Yarn: Not Found   npm:     version: 11.11.0     path: C:\Program Files\nodejs\npm.CMD   Watchman:     version: 20231008.002904.0     path: C:\ProgramData\chocolatey\bin\watchman.EXE SDKs:   Android SDK:     API Levels:       - "28"       - "33"       - "34"       - "35"       - "36"     Build Tools:       - 28.0.3       - 30.0.3       - 33.0.0       - 33.0.1       - 34.0.0       - 35.0.0       - 36.0.0       - 36.1.0     System Images:       - android-19 | Google APIs Intel x86 Atom       - android-24 | Google Play Intel x86 Atom       - android-30 | Google APIs Intel x86_64 Atom       - android-34 | Google Play Intel x86_64 Atom       - android-35 | Google Play Intel x86_64 Atom       - android-36 | Google Pl
  **Post-Mortem & Fix Analysis**:
  > Reopen needed ?  https://github.com/oblador/react-native-vector-icons/pull/1905#issuecomment-4576182700

- **Issue #1869** (2026-02-27): **package `@react-native-vector-icons/ionicons` is not being updated**
  *Symptoms*: ### Which package are you using?  @react-native-vector-icons/ionicons  ### Minimal reproducible example  https://www.npmjs.com/package/@react-native-vector-icons/ionicons  ### What happened?  the package version was update in commit https://github.com/oblador/react-native-vector-icons/commit/99da2af9f9cebd39414cdfcb9570197c87dbfbbc  <img width="2559" height="781" alt="Image" src="https://github.com/user-attachments/assets/3a07ed01-b2ed-4626-886c-dd91d585858a" />  However, on the npmjs.com, the `ionicons` package is still the old version. (Others have been correctly updated.) https://www.npmjs.com/package/@react-native-vector-icons/ionicons <img width="1571" height="1204" alt="Image" src="https://github.com/user-attachments/assets/18ef2d87-ff7a-47b3-86c5-4038e2e29257" /> 
  **Post-Mortem & Fix Analysis**:
  > Has been fixed and published now!

- **Issue #1864** (2025-12-21): **icon is not showing on iOS if we have multiple .plist**
  *Symptoms*: ### Which package are you using?  @react-native-vector-icons/*  ### What platform(s) does this occur on?  iOS  ### Minimal reproducible example  Just integrated with react-native-configs library and add multiple .plist for different scheme  ### What happened?  I had multi .plist file as im using react-native-configs for different scheme, but after i follow the iOS documentation, the icon is still not showing, i had added ALL the UIAppFonts in ALL the .plist file i had, but the icon still not showing.  Just wondering is it due to have multiple .plist ? When i run my project, it definitely grabbing the correct .plist file.  Or please correct me if my steps is wrong.   Below is the cmd i run for my multiple .plist:- npx rnvi-update-plist package.json ios/AppName/Info.plist npx rnvi-update-plist package.json ios/schemeA.plist npx rnvi-update-plist package.json ios/schemeB.plist npx rnvi-update-plist package.json ios/schemeC.plist  ### Relevant log output  ```shell  ```  ### Your computer environment  ```text System:   OS: macOS 26.2   CPU: (14) arm64 Apple M4 Pro   Memory: 1.97 GB / 48.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 24.7.0     path: /opt/homebrew/bin/node   Yarn:     version: 1.22.22     path: /opt/homebrew/bin/yarn   npm:     version: 11.5.1     path: /opt/homebrew/bin/npm   Watchman:     version: 2025.09.01.00     path: /opt/homebrew/bin/watchman Managers:   CocoaPods:     version: 1.16.2     path: /opt/homebrew/bin/pod SDKs:

- **Issue #1862** (2025-12-05): **Unable to resolve MaterialDesignIcons.ttf from material-design-icons/lib/common/index.js file**
  *Symptoms*: ### Which package are you using?  @react-native-vector-icons/*  ### What platform(s) does this occur on?  Android  ### Minimal reproducible example  None  ### What happened?  I've upgraded from React Native version 0.74.2 to 0.79.7 and also migrated the `react-native-vector-icons` library to `react-native-vector-icons/material-design-icons`. The Android build started failing after this upgrade + migration.  Everything seems correct, and I correctly follow the documentation. Also, in the build failed logs, it says `MaterialDesignIcons.ttf` file doesn't exist, but it does exist at the location referenced in the `index.js` file. I don't know if something is wrong in the library or my setup.  I tried with the `ant-design` package, but still the same error for missing `AntDesign.ttf` file.  ### Relevant log output  ```shell > Task :app:createBundleReleaseJsAndAssets  WARN  the transform cache was reset.                 Welcome to Metro v0.82.5               Fast - Scalable - Integrated   error Unable to resolve module ../../fonts/MaterialDesignIcons.ttf from /Users/rohitverma/GitHub/movitanz_mobile_app/node_modules/@react-native-vector-icons/material-design-icons/lib/commonjs/index.js:  Error: Unable to resolve module ../../fonts/MaterialDesignIcons.ttf from /Users/rohitverma/GitHub/movitanz_mobile_app/node_modules/@react-native-vector-icons/material-design-icons/lib/commonjs/index.js:    None of these files exist: None of these files exist:   * node_modules/@react-native-vector-i
  **Post-Mortem & Fix Analysis**:
  > @rohit9625   Can i get a listing of these directories? * /Users/rohitverma/GitHub/movitanz_mobile_app/node_modules/@react-native-vector-icons/material-design-icons/ * /Users/rohitverma/GitHub/movitanz_mobile_app/node_modules/@react-native-vector-icons/material-design-icons/fonts
  > Thank you @johnf for quick response :) This is the directory structure within node_modules for icons:  <img width="410" height="705" alt="Image" src="https://github.com/user-attachments/assets/f3df7543-0b0f-4d07-8300-ab77083bc25c" />
  > Hi @johnf, any luck with this issue?

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

### Incident Patch 1: `867bd315` (2026-09-07)
**Commit Message**: fix(android): skip explicit Kotlin plugin when AGP registers the kotlin extension (#1928)

AGP 9 ships built-in Kotlin support and registers the kotlin extension
itself. Applying the Kotlin plugin again fails configuration with
"Cannot add extension with name 'kotlin'". Check for the extension
directly, which needs no AGP version table and covers AGP 10, where the
android.builtInKotlin opt-out is removed.

**File**: `packages/ant-design/android/build.gradle` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ def safeExtGet(prop, fallback) {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+  apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
   apply plugin: "com.facebook.react"
```

**File**: `packages/entypo/android/build.gradle` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ def safeExtGet(prop, fallback) {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+  apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
   apply plugin: "com.facebook.react"
```

**File**: `packages/evil-icons/android/build.gradle` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ def safeExtGet(prop, fallback) {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+  apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
   apply plugin: "com.facebook.react"
```

**File**: `packages/feather/android/build.gradle` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ def safeExtGet(prop, fallback) {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+  apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
   apply plugin: "com.facebook.react"
```

**File**: `packages/fontawesome-free-brands/android/build.gradle` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ def safeExtGet(prop, fallback) {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+  apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
   apply plugin: "com.facebook.react"
```

**File**: `packages/fontawesome-free-regular/android/build.gradle` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ def safeExtGet(prop, fallback) {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+  apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
   apply plugin: "com.facebook.react"
```

**File**: `packages/fontawesome-free-solid/android/build.gradle` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ def safeExtGet(prop, fallback) {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+  apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
   apply plugin: "com.facebook.react"
```

**File**: `packages/fontawesome-pro-brands/android/build.gradle` (modified, +7/-1)
```diff
@@ -10,7 +10,13 @@ def safeExtGet(prop, fallback) {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+  apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
   apply plugin: "com.facebook.react"
```

---

### Incident Patch 2: `6e91e092` (2026-08-20)
**Commit Message**: fix: resolve asset registry on react-native 0.87 (#1924)

React Native 0.87 moved the asset registry into core and dropped its
dependency on `@react-native/assets-registry`. The static import of that
package therefore failed to resolve and broke the Metro build.

Look up `AssetRegistry` on `react-native` first, then fall back to the
standalone package for React Native 0.86 and older. Both lookups sit in a
`try` block, so Metro treats them as optional dependencies and does not
fail the build when one is absent.

React Native core must come first: on 0.87 Metro registers assets into
core, so that is the only registry guaranteed to hold them.

`AssetRegistry` is missing from React Native's default TypeScript types,
so the entry type stays declared locally.

Fixes #1923

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `packages/common/src/dynamicLoading/asset-registry.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+type PackagerAsset = {
+  name: string;
+  httpServerLocation: string;
+  hash: string;
+  type: string; // file extension
+};
+
+type GetAssetByID = (assetId: number) => PackagerAsset | undefined;
+
+/*
+ * React Native 0.87 moved the asset registry into core and stopped depending on
+ * `@react-native/assets-registry`, so that package is no longer installed by default.
+ * React Native 0.86 and older do not expose `AssetRegistry`, so the standalone package
+ * stays as a fallback. Both lookups sit in a `try` block, which makes Metro treat them
+ * as optional dependencies instead of failing the build when one is absent.
+ * */
+const resolveGetAssetByID = (): GetAssetByID | undefined => {
+  try {
+    // react-native >= 0.87. `AssetRegistry` is absent from the default typings.
+    const { AssetRegistry } = require('react-native') as {
+      AssetRegistry?: { getAssetByID: GetAssetByID };
+    };
+    if (AssetRegistry) {
+      return AssetRegistry.getAssetByID;
+    }
+  } catch {}
+
+  try {
+    return require('@react-native/assets-registry/registry').getAssetByID;
+  } catch {}
+
+  return undefined;
+};
+
+const getAssetByIDImpl = resolveGetAssetByID();
+
+export const getAssetByID: GetAssetByID = (assetId) => {
+  if (!getAssetByIDImpl) {
+    throw new Error(
+      'No asset registry found. Upgrade to react-native 0.87 or newer, or install `@react-native/assets-registry`.',
+    );
+  }
+  return getAssetByIDImpl(assetId);
+};
```

**File**: `packages/common/src/dynamicLoading/dynamic-font-loading.ts` (modified, +2/-15)
```diff
@@ -1,12 +1,6 @@
-// @ts-expect-error missing types
-import { getAssetByID } from '@react-native/assets-registry/registry';
-
-/*
- * The following imports are always present when react native is installed
- * in the future, more explicit apis will be exposed by the core, including typings
- * */
 import { Image, Platform } from 'react-native';
 
+import { getAssetByID } from './asset-registry';
 import { assertExpoModulesPresent, getErrorCallback, type LoadAsyncAsset } from './dynamic-loading-setting';
 import type { DynamicLoader, FontSource } from './types';
 
@@ -55,15 +49,8 @@ const loadFontAsync = async (fontFamily: string, fontSource: FontSource): Promis
   return loadPromises[fontFamily];
 };
 
-type AssetRegistryEntry = {
-  name: string;
-  httpServerLocation: string;
-  hash: string;
-  type: string; // file extension
-};
-
 const getLocalFontUrl = (fontModuleId: number, fontFamily: string) => {
-  const assetMeta: AssetRegistryEntry = getAssetByID(fontModuleId);
+  const assetMeta = getAssetByID(fontModuleId);
   if (!assetMeta) {
     throw new Error(`no asset found for font family "${fontFamily}", moduleId: ${String(fontModuleId)}`);
   }
```

---

### Incident Patch 3: `bec97759` (2026-05-26)
**Commit Message**: chore(build): typescript 6 (#1915)

**File**: `apps/directory/package.json` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
     "react": "^19.2.4",
     "react-dom": "^19.2.4",
     "react-scripts": "5.0.1",
-    "typescript": "^5.7.2",
+    "typescript": "^6.0.3",
     "web-vitals": "^5.2.0"
   },
   "scripts": {
```

**File**: `apps/icon-explorer/package.json` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@
     "react-native-test-app": "^5.1.0",
     "react-test-renderer": "19.2.4",
     "ts-jest": "^29.4.9",
-    "typescript": "^5.7.2"
+    "typescript": "^6.0.3"
   },
   "engines": {
     "node": ">=18"
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
     "generator-react-native-vector-icons": "workspace:*",
     "knip": "^6.2.0",
     "nx": "^22.6.4",
-    "typescript": "^5.9.3",
+    "typescript": "^6.0.3",
     "yo": "^7.0.0"
   },
   "engines": {
```

**File**: `packages/ant-design/package.json` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@
     "del-cli": "^7.0.0",
     "onchange": "^7.1.0",
     "react-native-builder-bob": "^0.35.2",
-    "typescript": "^5.7.2",
+    "typescript": "^6.0.3",
     "@ant-design/icons-svg": "4.4.2"
   },
   "peerDependencies": {
```

**File**: `packages/codemod/package.json` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@
     "onchange": "^7.1.0",
     "react-native-builder-bob": "^0.35.2",
     "ts-jest": "^29.4.9",
-    "typescript": "^5.7.2"
+    "typescript": "^6.0.3"
   },
   "engines": {
     "node": ">= 18.0.0"
```

**File**: `packages/codemod/tsconfig.json` (modified, +5/-1)
```diff
@@ -8,7 +8,7 @@
     "jsx": "react",
     "lib": ["esnext"],
     "module": "esnext",
-    "moduleResolution": "node",
+    "moduleResolution": "Bundler",
     "noFallthroughCasesInSwitch": true,
     "noImplicitReturns": true,
     "noImplicitUseStrict": false,
@@ -19,6 +19,10 @@
     "resolveJsonModule": true,
     "skipLibCheck": true,
     "strict": true,
+    "types": [
+      "node",
+      "jest"
+    ],
     "target": "esnext",
     "verbatimModuleSyntax": true
   }
```

**File**: `packages/common/package.json` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@
     "del-cli": "^7.0.0",
     "onchange": "^7.1.0",
     "react-native-builder-bob": "^0.35.2",
-    "typescript": "^5.7.2"
+    "typescript": "^6.0.3"
   },
   "peerDependencies": {
     "@react-native-vector-icons/get-image": "workspace:^",
```

**File**: `packages/entypo/package.json` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@
     "del-cli": "^7.0.0",
     "onchange": "^7.1.0",
     "react-native-builder-bob": "^0.35.2",
-    "typescript": "^5.7.2",
+    "typescript": "^6.0.3",
     "@entypo-icons/core": "1.0.1"
   },
   "peerDependencies": {
```

---

### Incident Patch 4: `e4215d2f` (2026-05-24)
**Commit Message**: fix: icons did not render on expo web (#1916)

**File**: `.knip.jsonc` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
     },
     "packages/common": {
       "entry": ["src/index.{ts,tsx}", "src/scripts/{getFonts,updatePlist}.{ts,tsx}"],
-      "ignoreDependencies": ["@react-native/assets-registry", "@react-native-vector-icons/get-image"]
+      "ignoreDependencies": ["@react-native/assets-registry", "@react-native-vector-icons/get-image", "expo-font"]
     },
     "packages/get-image": {
       "entry": ["src/index.{ts,tsx}"],
```

**File**: `packages/common/package.json` (modified, +4/-0)
```diff
@@ -92,6 +92,7 @@
   "peerDependencies": {
     "@react-native-vector-icons/get-image": "workspace:^",
     "@react-native/assets-registry": "*",
+    "expo-font": "*",
     "react": "*",
     "react-native": "*"
   },
@@ -101,6 +102,9 @@
     },
     "@react-native-vector-icons/get-image": {
       "optional": true
+    },
+    "expo-font": {
+      "optional": true
     }
   },
   "engines": {
```

**File**: `packages/common/src/dynamicLoading/dynamic-loading-setting.ts` (modified, +15/-65)
```diff
@@ -1,67 +1,15 @@
 import { Platform } from 'react-native';
 
+import type { ExpoAssetModule, ExpoFontLoaderModule, ExpoFontUtilsModule } from './expo-global';
 import type { FontSource } from './types';
 
-type ExpoAssetModule = {
-  // definition from
-  // https://github.com/expo/expo/blob/1f5a5991d14aad09282d1ce1612b44d30e7e7d3d/packages/expo-asset/ios/AssetModule.swift#L23
-  downloadAsync: (uri: string, hash: string | undefined, type: string) => Promise<string>;
-};
-
-// this is a file:// uri on native, or an object with uri and display on web
-export type LoadAsyncAsset = string | { uri: string; display: string };
-
-type ExpoFontLoaderModule = {
-  // definition from
-  // https://github.com/expo/expo/blob/1f5a5991d14aad09282d1ce1612b44d30e7e7d3d/packages/expo-font/ios/FontLoaderModule.swift#L18
-  getLoadedFonts: () => string[];
-  loadAsync: (fontFamilyAlias: string, asset: LoadAsyncAsset) => Promise<void>;
-};
-
-// RenderToImageResult needs to be usable as the `source` prop for image,
-// so it must stay compatible with ImageURISource type
-type RenderToImageResult = {
-  /**
-   * The file uri to the image.
-   */
-  uri: string;
-  /**
-   * Image width in dp.
-   */
-  width: number;
-  /**
-   * Image height in dp.
-   */
-  height: number;
-
-  /**
-   * Scale factor of the image. Multiply the dp dimensions by this value to get the dimensions in pixels.
-   * */
-  scale: number;
-};
-
-type ExpoFontUtilsModule = {
-  renderToImageAsync: (
-    glyph: string,
-    options: {
-      fontFamily: string;
-      size?: number;
-      lineHeight?: number;
-      color?: number;
-    },
-  ) => Promise<RenderToImageResult>;
-};
-
-declare global {
-  interface ExpoGlobal {
-    modules: {
-      ExpoAsset?: ExpoAssetModule;
-      ExpoFontLoader?: ExpoFontLoaderModule;
-      ExpoFontUtils?: ExpoFontUtilsModule;
-    };
-  }
+export type { LoadAsyncAsset } from './expo-global';
 
-  var expo: ExpoGlobal | undefined;
+// requiring `expo-font` on web calls registerWebModule, thanks to which `getIsDynamicLoadingSupported` can return true on web
+if (Platform.OS === 'web' && globalThis.expo) {
+  try {
+    require('expo-font');
+  } catch (_err) {}
 }
 
 type ExpoGlobalType = {
@@ -75,11 +23,12 @@ type ExpoGlobalType = {
 function getIsDynamicLoadingSupported(globalObj: any): globalObj is {
   expo: ExpoGlobalType;
 } {
+  const expoModules = globalObj?.expo?.modules;
   return (
-    globalObj?.expo &&
-    (Platform.OS === 'web' || typeof globalObj.expo.modules?.ExpoAsset?.downloadAsync === 'function') &&
-    typeof globalObj.expo.modules?.ExpoFontLoader?.getLoadedFonts === 'function' &&
-    typeof globalObj.expo.modules?.ExpoFontLoader?.loadAsync === 'function'
+    !!expoModules &&
+    (Platform.OS === 'web' || typeof expoModules.ExpoAsset?.downloadAsync === 'function') &&
+    typeof expoModules.ExpoFontLoader?.getLoadedFonts === 'function' &&
+    typeof expoModules.ExpoFontLoader?.loadAsync === 'function'
   );
 }
 
@@ -91,7 +40,7 @@ export function getIsRenderToImageSupported(globalObj: any): globalObj is {
     };
   };
 } {
-  return globalObj?.expo && typeof globalObj.expo.modules?.ExpoFontUtils?.renderToImageAsync === 'function';
+  return typeof globalObj?.expo?.modules?.ExpoFontUtils?.renderToImageAsync === 'function';
 }
 
 export function assertExpoModulesPresent(globalObj: unknown): asserts globalObj is { expo: ExpoGlobalType } {
@@ -119,8 +68,9 @@ export const isDynamicLoadingSupported = () => getIsDynamicLoadingSupported(glob
 export const setDynamicLoadingEnabled = (value: boolean): boolean => {
   if (!getIsDynamicLoadingSupported(globalThis)) {
     if (process.env.NODE_ENV !== 'production' && !!value) {
+      const expoModules = globalThis.expo?.modules;
       const hasNecessaryExpoModules =
-        (Platform.OS === 'web' || !!globalThis.expo?.modules?.ExpoAsset) && !!globalThis.expo?.modules?.ExpoFontLoader;
+        (Platform.OS === 'web' || !!expoModules?.ExpoAsset) && !!expoModules?.ExpoFontLoader;
       const message = hasNecessaryExpoModules
         ? 'Expo is installed, but does not support dynamic font loading. Make sure to use Expo SDK 54 or newer.'
         : 'Necessary Expo modules not found. Dynamic font loading is not available when necessary Expo modules are not present.';
```

**File**: `packages/common/src/dynamicLoading/expo-global.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+// this is a file:// uri on native, or an object with uri and display on web
+export type LoadAsyncAsset = string | { uri: string; display: string };
+
+export type ExpoAssetModule = {
+  // definition from
+  // https://github.com/expo/expo/blob/1f5a5991d14aad09282d1ce1612b44d30e7e7d3d/packages/expo-asset/ios/AssetModule.swift#L23
+  downloadAsync: (uri: string, hash: string | undefined, type: string) => Promise<string>;
+};
+
+export type ExpoFontLoaderModule = {
+  // definition from
+  // https://github.com/expo/expo/blob/1f5a5991d14aad09282d1ce1612b44d30e7e7d3d/packages/expo-font/ios/FontLoaderModule.swift#L18
+  getLoadedFonts: () => string[];
+  loadAsync: (fontFamilyAlias: string, asset: LoadAsyncAsset) => Promise<void>;
+};
+
+// RenderToImageResult needs to be usable as the `source` prop for image,
+// so it must stay compatible with ImageURISource type
+type RenderToImageResult = {
+  /**
+   * The file uri to the image.
+   */
+  uri: string;
+  /**
+   * Image width in dp.
+   */
+  width: number;
+  /**
+   * Image height in dp.
+   */
+  height: number;
+
+  /**
+   * Scale factor of the image. Multiply the dp dimensions by this value to get the dimensions in pixels.
+   * */
+  scale: number;
+};
+
+export type ExpoFontUtilsModule = {
+  renderToImageAsync: (
+    glyph: string,
+    options: {
+      fontFamily: string;
+      size?: number;
+      lineHeight?: number;
+      color?: number;
+    },
+  ) => Promise<RenderToImageResult>;
+};
+
+declare global {
+  interface ExpoGlobal {
+    modules: {
+      ExpoAsset?: ExpoAssetModule;
+      ExpoFontLoader?: ExpoFontLoaderModule;
+      ExpoFontUtils?: ExpoFontUtilsModule;
+    };
+  }
+
+  var expo: ExpoGlobal | undefined;
+}
```

**File**: `pnpm-lock.yaml` (modified, +1442/-40)
```diff
@@ -200,13 +200,13 @@ importers:
         version: 0.84.1
       '@rnx-kit/align-deps':
         specifier: ^3.4.3
-        version: 3.4.3(metro@0.83.5)
+        version: 3.4.3(metro@0.83.7)
       '@rnx-kit/babel-preset-metro-react-native':
         specifier: ^3.0.2
         version: 3.0.2(@babel/core@7.29.0)(@babel/plugin-transform-typescript@7.28.5(@babel/core@7.29.0))(@babel/runtime@7.29.2)(@react-native/babel-preset@0.84.1(@babel/core@7.29.0))
       '@rnx-kit/metro-config':
         specifier: ^2.2.4
-        version: 2.2.4(@react-native/metro-config@0.84.1(@babel/core@7.29.0))(metro@0.83.5)(react-native@0.84.1(@babel/core@7.29.0)(@react-native-community/cli@20.1.3(typescript@5.9.3))(@react-native/metro-config@0.84.1(@babel/core@7.29.0))(@types/react@19.2.14)(react@19.2.4))(react@19.2.4)
+        version: 2.2.4(@react-native/metro-config@0.84.1(@babel/core@7.29.0))(metro@0.83.7)(react-native@0.84.1(@babel/core@7.29.0)(@react-native-community/cli@20.1.3(typescript@5.9.3))(@react-native/metro-config@0.84.1(@babel/core@7.29.0))(@types/react@19.2.14)(react@19.2.4))(react@19.2.4)
       '@types/jest':
         specifier: ^30.0.0
         version: 30.0.0
@@ -227,7 +227,7 @@ importers:
         version: 30.3.0(@types/node@24.12.0)(babel-plugin-macros@3.1.0)(ts-node@10.9.1(@types/node@24.12.0)(typescript@5.9.3))
       react-native-test-app:
         specifier: ^5.1.0
-        version: 5.1.0(@expo/config-plugins@8.0.11)(metro@0.83.5)(react-native@0.84.1(@babel/core@7.29.0)(@react-native-community/cli@20.1.3(typescript@5.9.3))(@react-native/metro-config@0.84.1(@babel/core@7.29.0))(@types/react@19.2.14)(react@19.2.4))(react@19.2.4)
+        version: 5.1.0(@expo/config-plugins@8.0.11)(metro@0.83.7)(react-native@0.84.1(@babel/core@7.29.0)(@react-native-community/cli@20.1.3(typescript@5.9.3))(@react-native/metro-config@0.84.1(@babel/core@7.29.0))(@types/react@19.2.14)(react@19.2.4))(react@19.2.4)
       react-test-renderer:
         specifier: 19.2.4
         version: 19.2.4(react@19.2.4)
@@ -326,6 +326,9 @@ importers:
       '@react-native/assets-registry':
         specifier: '*'
         version: 0.84.1
+      expo-font:
+        specifier: '*'
+        version: 56.0.4(expo@55.0.24)(react-native@0.84.1(@babel/core@7.29.0)(@react-native-community/cli@20.1.3(typescript@5.9.3))(@react-native/metro-config@0.84.1(@babel/core@7.29.0))(@types/react@19.2.14)(react@19.2.4))(react@19.2.4)
       find-up:
         specifier: ^8.0.0
         version: 8.0.0
@@ -2770,9 +2773,28 @@ packages:
     os: [darwin, linux, win32]
     hasBin: true
 
+  '@expo/cli@55.0.30':
+    resolution: {integrity: sha512-luWcCgompncWtCi1HqQfY32MVOuD0kUeARpr1Le1LeKVtZykjOwnz7YWXZo5zjISiD7L/gQnBNGVrRjvREsJqg==}
+    hasBin: true
+    peerDependencies:
+      expo: '*'
+      expo-router: '*'
+      react-native: '*'
+    peerDependenciesMeta:
+      expo-router:
+        optional: true
+      react-native:
+        optional: true
+
+  '@expo/code-signing-certificates@0.0.6':
+    resolution: {integrity: sha512-iNe0puxwBNEcuua9gmTGzq+SuMDa0iATai1FlFTMHJ/vUmKvN/V//drXoLJkVb5i5H3iE/n/qIJxyoBnXouD0w==}
+
   '@expo/config-plugins@55.0.7':
     resolution: {integrity: sha512-XZUoDWrsHEkH3yasnDSJABM/UxP5a1ixzRwU/M+BToyn/f0nTrSJJe/Ay/FpxkI4JSNz2n0e06I23b2bleXKVA==}
 
+  '@expo/config-plugins@55.0.9':
+    resolution: {integrity: sha512-jLfpxru8dTo7eU0cqeTWuQav7byyjb37eF/mbXl1/3eTBHBvFU1VGxpeKxanUdTQAAjqzH8KGgWb0fWcce+z1w==}
+
   '@expo/config-plugins@8.0.11':
     resolution: {integrity: sha512-oALE1HwnLFthrobAcC9ocnR9KXLzfWEjgIe4CPe+rDsfC6GDs8dGYCXfRFoCEzoLN4TGYs9RdZ8r0KoCcNrm2A==}
 
@@ -2782,21 +2804,150 @@ packages:
   '@expo/config-types@55.0.5':
     resolution: {integrity: sha512-sCmSUZG4mZ/ySXvfyyBdhjivz8Q539X1NondwDdYG7s3SBsk+wsgPJzYsqgAG/P9+l0xWjUD2F+kQ1cAJ6NNLg==}
 
+  '@expo/config@55.0.17':
+    resolution: {integrity: sha512-Y3VaRg7Jllg3MhlUOTQqHm6/dttsqcjYlnS9enhAllZvPUpTHnRA4YPETtUZlxkdMJy6y3UZe986pd/KfJ6OTg==}
+
+  '@expo/devcert@1.2.1':
+    resolution: {integrity: sha512-qC4eaxmKMTmJC2ahwyui6ud8f3W60Ss7pMkpBq40Hu3zyiAaugPXnZ24145U7K36qO9UHdZUVxsCvIpz2RYYCA==}
+
+  '@expo/devtools@55.0.3':
+    resolution: {integrity: sha512-KoIDgo0NoXeWLsIcOdZqtAG/1LlsM+JL0DA3bo0vCYaOYTBLXi/ZvRBqa20Ub8D2vKLNa+FgRQW0gRg04Ps1Pg==}
+    peerDependencies:
+      react: '*'
+      react-native: '*'
+    peerDependenciesMeta:
+      react:
+        optional: true
+      react-native:
+        optional: true
+
+  '@expo/dom-webview@55.0.6':
+    resolution: {integrity: sha512-ZNm8tiNEZysxrr36J0x4mOCGyJDcaIvL/3tMxBz0VJIJDcV19xjuJAhJQxHovu+jKx6s9tRyEAINa1mdrzV39g==}
+    peerDependencies:
+      expo: '*'
+      react: '*'
+      react-native: '*'
+
+  '@expo/env@2.1.2':
+    resolution: {integrity: sha512-RJtGFfj/ygO/6zcVbV3cckHf4THcEkv5IZft1GjCB3dfT6axvzvIwXE9EiQqQYmGHcQ+ZrvC8xZcIhiHba0pYg==}
+    engines: {node: '>=20.12.0'}
+
+  '@expo/fingerprint@0.16.7':
+    resolution: {integrity: sha512-BH8sicYOqZ1iBMwCVEGIz6uTTfylosjc49FoMmCYIzKOiYdiVehsfoYBwyfxwWIiya1
```

---

### Incident Patch 5: `3f963bed` (2026-05-01)
**Commit Message**: fix(codemod): check project path exists early (#1914)

**File**: `MIGRATION.md` (modified, +5/-3)
```diff
@@ -6,9 +6,11 @@ We provide a codemod to migrate from `@expo/vector-icons` or the legacy `react-n
 > Make sure your code is committed to git before running the codemod. Review all codemod changes before committing them.
 
 ```sh
-npx @react-native-vector-icons/codemod .
+npx @react-native-vector-icons/codemod
 ```
 
+By default the codemod runs in the current directory; pass a path to target a different one (e.g. `npx @react-native-vector-icons/codemod ./apps/mobile`).
+
 The codemod auto-detects which migration to run based on the dependencies in your `package.json`.
 
 ## What the codemod does not do
@@ -31,8 +33,8 @@ It auto-detects whether you're using a development build (has `expo-dev-client`,
 To skip the prompt, pass `--static` or `--dynamic`:
 
 ```sh
-npx @react-native-vector-icons/codemod . --static
-npx @react-native-vector-icons/codemod . --dynamic
+npx @react-native-vector-icons/codemod --static
+npx @react-native-vector-icons/codemod --dynamic
 ```
 
 ### Import transforms
```

**File**: `packages/codemod/src/expo/index.ts` (modified, +1/-2)
```diff
@@ -42,8 +42,7 @@ type RunOptions = {
 export async function runExpoMigration(dir: string, { useStatic: useStaticOverride }: RunOptions = {}) {
   const transformPath = require.resolve('./import-transform');
 
-  process.chdir(dir);
-  console.log(`🚀 Running Expo codemod in directory: ${path.resolve(dir)}`);
+  console.log(`🚀 Running Expo codemod in directory: ${dir}`);
 
   let useStatic: boolean;
   if (useStaticOverride !== undefined) {
```

**File**: `packages/codemod/src/index.ts` (modified, +10/-1)
```diff
@@ -1,5 +1,6 @@
 #!/usr/bin/env node
 
+import fs from 'node:fs';
 import path from 'node:path';
 
 import semver from 'semver';
@@ -23,7 +24,15 @@ function parseArgs(argv: string[]): { dir: string; useStatic: boolean | undefine
 }
 
 async function main() {
-  const { dir, useStatic } = parseArgs(process.argv.slice(2));
+  const { dir: dirArg, useStatic } = parseArgs(process.argv.slice(2));
+  const dir = path.resolve(dirArg);
+
+  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
+    console.error(`Directory does not exist: ${dir}`);
+    process.exit(1);
+  }
+
+  process.chdir(dir);
 
   checkGitStatus(dir);
 
```

---

### Incident Patch 6: `e5e16319` (2026-04-29)
**Commit Message**: chore: fix repo links (#1912)

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ body:
       value: |
         Thanks for taking the time to fill out this bug report!
         Before filing a bug report:
-        - Review the documentation: https://github.com/react-native-vector-icons/react-native-vector-icons
+        - Review the documentation: https://github.com/oblador/react-native-vector-icons
         - Search for existing issues (including closed issues): https://github.com/oblador/react-native-vector-icons/issues?q=is%3Aissue+
 
   - type: dropdown
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ For the integration of `.svg` files natively, you can explore [`react-native-vec
 - [Animation](#animation)
 - [Dynamic icon font loading](#dynamic-icon-font-loading)
 - [Usage Examples](#usage-examples)
-- [Changelog](https://github.com/react-native-vector-icons/react-native-vector-icons/releases)
+- [Changelog](https://github.com/oblador/react-native-vector-icons/releases)
 - [License](#license)
 
 ## Sponsorship
```

**File**: `docs/SETUP-EXPO.md` (modified, +2/-2)
```diff
@@ -19,9 +19,9 @@ The default entry imports the `.ttf`, so Metro bundles it as a JS asset. When th
 import { MaterialIcons } from "@react-native-vector-icons/material-icons/static";
 ```
 
-In a development build, autolinking picks up each package's `build.gradle` / `.podspec` and copies the `.ttf` into the native binary. Using the dynamic import on top of that means the same font also ships as a JS asset — so it's bundled twice.
+In a development build, autolinking picks up each package's `build.gradle` / `.podspec` and copies the `.ttf` into the native binary at build time. Using the dynamic import on top of that means the same font also ships as a JS asset — so it's bundled twice.
 
-The `/static` entry skips the `.ttf` import on the JS side, so Metro doesn't bundle it. The font reaches the device through the native build only, and the package's Expo config plugin registers it with iOS by adding it to `UIAppFonts` in `Info.plist`. Add the icon packages you use to the `plugins` array in your `app.json` or `app.config.js`:
+The `/static` entry skips the `.ttf` import on the JS side, so Metro doesn't bundle it. The font reaches the device through the native build only, and the package's Expo config plugin registers it with iOS by adding it to `UIAppFonts` in `Info.plist`. To do that, add the icon packages you use to the `plugins` array in your `app.json` or `app.config.js`. For example:
 
 ```json
 {
```

**File**: `packages/codemod/package.json` (modified, +2/-2)
```diff
@@ -60,9 +60,9 @@
     "name": "Joel Arvidsson",
     "email": "joel@oblador.se"
   },
-  "homepage": "https://github.com/react-native-vector-icons/react-native-vector-icons",
+  "homepage": "https://github.com/oblador/react-native-vector-icons",
   "bugs": {
-    "url": "https://github.com/react-native-vector-icons/react-native-vector-icons/issues"
+    "url": "https://github.com/oblador/react-native-vector-icons/issues"
   },
   "repository": {
     "type": "git",
```

---

### Incident Patch 7: `834cedce` (2026-04-23)
**Commit Message**: fix: expo plugin exports (#1909)

**File**: `MIGRATION.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ We provide a `codemod` to help migrate your code and settings between major vers
 npx @react-native-vector-icons/codemod
 ```
 
-## Expo
+## Expo projects
 
 To migrate from `@expo/vector-icons`, run the codemod in your Expo project. If you use `createIconSetFromIcoMoon` or `createIconSetFromFontello`, there may be some manual steps required after running the codemod:
 
```

**File**: `packages/ant-design/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     },
     "./glyphmaps/*.json": "./glyphmaps/*.json",
     "./fonts/*.ttf": "./fonts/*.ttf",
-    "./app.plugin": "./app.plugin.js"
+    "./app.plugin.js": "./app.plugin.js"
   },
   "files": [
     "src",
```

**File**: `packages/entypo/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     },
     "./glyphmaps/*.json": "./glyphmaps/*.json",
     "./fonts/*.ttf": "./fonts/*.ttf",
-    "./app.plugin": "./app.plugin.js"
+    "./app.plugin.js": "./app.plugin.js"
   },
   "files": [
     "src",
```

**File**: `packages/evil-icons/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     },
     "./glyphmaps/*.json": "./glyphmaps/*.json",
     "./fonts/*.ttf": "./fonts/*.ttf",
-    "./app.plugin": "./app.plugin.js"
+    "./app.plugin.js": "./app.plugin.js"
   },
   "files": [
     "src",
```

**File**: `packages/feather/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     },
     "./glyphmaps/*.json": "./glyphmaps/*.json",
     "./fonts/*.ttf": "./fonts/*.ttf",
-    "./app.plugin": "./app.plugin.js"
+    "./app.plugin.js": "./app.plugin.js"
   },
   "files": [
     "src",
```

**File**: `packages/fontawesome-free-brands/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     },
     "./glyphmaps/*.json": "./glyphmaps/*.json",
     "./fonts/*.ttf": "./fonts/*.ttf",
-    "./app.plugin": "./app.plugin.js"
+    "./app.plugin.js": "./app.plugin.js"
   },
   "files": [
     "src",
```

**File**: `packages/fontawesome-free-regular/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     },
     "./glyphmaps/*.json": "./glyphmaps/*.json",
     "./fonts/*.ttf": "./fonts/*.ttf",
-    "./app.plugin": "./app.plugin.js"
+    "./app.plugin.js": "./app.plugin.js"
   },
   "files": [
     "src",
```

**File**: `packages/fontawesome-free-solid/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     },
     "./glyphmaps/*.json": "./glyphmaps/*.json",
     "./fonts/*.ttf": "./fonts/*.ttf",
-    "./app.plugin": "./app.plugin.js"
+    "./app.plugin.js": "./app.plugin.js"
   },
   "files": [
     "src",
```

---

### Incident Patch 8: `23bf6e6f` (2026-04-18)
**Commit Message**: fix: improve expo codemod instructions (#1906)

**File**: `packages/codemod/src/checkGitStatus.ts` (modified, +0/-2)
```diff
@@ -17,8 +17,6 @@ export function checkGitStatus(dir: string): void {
       console.error(status);
       process.exit(1);
     }
-
-    console.log('✅ Git repository is clean');
   } catch {
     // If git rev-parse fails, the directory is not a git repository
     console.log('!  Directory is not a git repository. Proceeding without git status check.');
```

**File**: `packages/codemod/src/expo/index.ts` (modified, +15/-9)
```diff
@@ -1,37 +1,43 @@
+import fs from 'node:fs';
+import path from 'node:path';
+
 import { run as jscodeshift } from 'jscodeshift/src/Runner';
 import resolveFrom from 'resolve-from';
 
 import { updatePackageJson } from './package-json';
 
-async function shouldUseStaticImports(dir: string): Promise<boolean> {
+function detectDevClient(dir: string): boolean {
   const hasExpoDevClient = resolveFrom.silent(dir, 'expo-dev-client/package.json') != null;
+  const hasAndroidDir = fs.existsSync(path.join(dir, 'android'));
+  const hasIosDir = fs.existsSync(path.join(dir, 'ios'));
+  const hasDevClient = hasExpoDevClient || hasAndroidDir || hasIosDir;
 
-  if (hasExpoDevClient) {
+  if (hasDevClient) {
     console.log(
-      '\nDetected expo-dev-client. Defaulting to /static imports (e.g. @react-native-vector-icons/material-icons/static).',
+      '\n🔧 Detected Expo development build. Defaulting to `/static` imports (e.g. `@react-native-vector-icons/material-icons/static`).',
     );
   } else {
     console.log(
-      '\nNo expo-dev-client detected (assuming Expo Go). Using default imports (e.g. @react-native-vector-icons/material-icons).',
+      '\n🔧 No Expo development build detected (assuming Expo Go). Using default imports (e.g. `@react-native-vector-icons/material-icons`).',
     );
   }
-  return hasExpoDevClient;
+  return hasDevClient;
 }
 
 export async function runExpoMigration(dir: string) {
   const transformPath = require.resolve('./import-transform');
 
   process.chdir(dir);
-  console.log(`Running Expo codemod in directory: ${dir}`);
+  console.log(`🚀 Running Expo codemod in directory: ${path.resolve(dir)}`);
 
-  const useStatic = await shouldUseStaticImports(dir);
+  const hasDevClient = detectDevClient(dir);
 
   await jscodeshift(transformPath, ['.'], {
     verbose: process.env.VERBOSE === 'true' || process.env.VERBOSE === '1',
     extensions: 'js,jsx,ts,tsx',
     parser: 'tsx',
     ignorePattern: '**/node_modules/**',
-    useStatic,
+    useStatic: hasDevClient,
   });
-  await updatePackageJson(dir);
+  await updatePackageJson(dir, hasDevClient);
 }
```

**File**: `packages/codemod/src/expo/package-json.ts` (modified, +20/-9)
```diff
@@ -1,11 +1,11 @@
-import { execSync } from 'node:child_process';
 import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
 
+import { getVersion } from '../getVersion';
 import { getNewFontImports } from './newFontImports';
 
-export async function updatePackageJson(dir: string) {
+export async function updatePackageJson(dir: string, hasExpoDevClient: boolean) {
   const packageJsonPath = path.join(dir, 'package.json');
 
   if (!fs.existsSync(packageJsonPath)) {
@@ -28,16 +28,27 @@ export async function updatePackageJson(dir: string) {
   }
 
   const newFontImports = getNewFontImports();
+  const versions = await Promise.all(newFontImports.map((pkg) => getVersion(pkg)));
 
-  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + os.EOL);
-
-  execSync(`npx expo install ${newFontImports.join(' ')}`, {
-    cwd: dir,
-    stdio: 'inherit',
+  newFontImports.forEach((pkg, i) => {
+    packageJson.dependencies[pkg] = versions[i];
   });
 
+  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + os.EOL);
+
   console.log(
-    `@expo/vector-icons was removed from package.json. As a replacement, the following ${newFontImports.length} packages were added: ${newFontImports.join(', ')}.`,
+    `📦 \`@expo/vector-icons\` was removed from package.json. As a replacement, the following ${newFontImports.length} packages were added: ${newFontImports.join(', ')}.`,
   );
-  console.log('If you need to, you can add @expo/vector-icons back by running `npx expo install @expo/vector-icons`');
+
+  console.log('\n👉 Run `npx expo install` to install the new dependencies.');
+
+  if (hasExpoDevClient) {
+    const pluginsList = newFontImports.map((name) => `    "${name}"`).join(',\n');
+    console.warn(
+      `\n⚠️  ACTION REQUIRED: Because you are using a development build, you have to enable each new package's Expo config plugin so the icon fonts are registered natively.\n` +
+        `Add the following entries to the "plugins" array in your app config (app.json / app.config.js / app.config.ts):\n\n` +
+        `  "plugins": [\n${pluginsList}\n  ]\n\n` +
+        `Then rebuild your development build (\`npx expo prebuild --clean\` followed by \`npx expo run:ios\` / \`npx expo run:android\`, or rebuild via EAS).`,
+    );
+  }
 }
```

**File**: `packages/codemod/src/getVersion.ts` (modified, +8/-4)
```diff
@@ -1,6 +1,10 @@
 export const getVersion = async (pkg: string) => {
-  const packageJson = await fetch(`https://registry.npmjs.org/${pkg}/latest`).then(
-    (res) => res.json() as unknown as { version: string },
-  );
-  return `^${packageJson.version}`;
+  try {
+    const packageJson = await fetch(`https://registry.npmjs.org/${pkg}/latest`).then(
+      (res) => res.json() as unknown as { version: string },
+    );
+    return `^${packageJson.version}`;
+  } catch {
+    return 'latest';
+  }
 };
```

**File**: `packages/codemod/src/index.ts` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ async function main() {
 
     if (!version) {
       console.error(
-        `Have not found anything to migrate. Do you have "react-native-vector-icons" or "@expo/vector-icons" at ${path.join(dir, 'package.json')}?`,
+        `Have not found anything to migrate. Do you have "react-native-vector-icons" or "@expo/vector-icons" in ${path.join(dir, 'package.json')}?`,
       );
       process.exit(1);
     }
```

---

### Incident Patch 9: `4fb83a31` (2026-04-13)
**Commit Message**: chore: improve supply chain security (#1903)

**File**: `pnpm-workspace.yaml` (modified, +5/-0)
```diff
@@ -3,5 +3,10 @@ packages:
   - apps/*
 allowBuilds:
   "@evilmartians/lefthook": true
+  core-js-pure: true
   nx: true
+  unrs-resolver: true
   yo: true
+blockExoticSubdeps: true
+minimumReleaseAge: 1440
+trustPolicy: no-downgrade
```

---

### Incident Patch 10: `266ae230` (2026-04-06)
**Commit Message**: fix: upgrade Octicons to v19.23.1 (#1902)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ RNVI comes with the following supported icons. You can [search NPM](https://www.
 - [`Foundation`](http://zurb.com/playground/foundation-icon-fonts-3) by ZURB, Inc. (v3.0 with _283_ icons)
 - [`Ionicons`](https://ionic.io/ionicons) crafted by Ionic (v8.0.9 containing _1,357_ icons)
 - [`MaterialDesignIcons`](https://pictogrammers.com/library/mdi/) from MaterialDesignIcons.com (v7.4.47 including _7448_ icons)
-- [`Octicons`](https://primer.style/foundations/icons) designed by GitHub, Inc. (v19.22.0 with _339_ icons)
+- [`Octicons`](https://primer.style/foundations/icons) designed by GitHub, Inc. (v19.23.1 with _370_ icons)
 - [`Lucide`](https://lucide.dev/) designed by Lucide, (v0.576.0 with _1,639_ icons)
 
 ### No longer maintained upstream
```

**File**: `packages/octicons/.fontcustom-manifest.json` (modified, +6/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "checksum": {
-    "previous": "fd9a60b515041398881b0181628154702913f13d8e3ef4646e83a01b8bc4af1b",
-    "current": "fd9a60b515041398881b0181628154702913f13d8e3ef4646e83a01b8bc4af1b"
+    "previous": "7964f0d24b2643bd5ac8e27d1fc994ee68b3001293f6ba8b086d42a51baefea0",
+    "current": "7964f0d24b2643bd5ac8e27d1fc994ee68b3001293f6ba8b086d42a51baefea0"
   },
   "fonts": [
     "Octicons/Octicons.ttf",
@@ -827,6 +827,10 @@
       "codepoint": 61874,
       "source": "renamedSVGs/lock.svg"
     },
+    "lockup-github": {
+      "codepoint": 62065,
+      "source": "renamedSVGs/lockup-github.svg"
+    },
     "log": {
       "codepoint": 61875,
       "source": "renamedSVGs/log.svg"
```

**File**: `packages/octicons/.yo-rc.json` (modified, +4/-0)
```diff
@@ -28,6 +28,10 @@
       {
         "rnvi": "20.4.1",
         "upstream": "19.22.0"
+      },
+      {
+        "rnvi": "21.0.0",
+        "upstream": "19.23.1"
       }
     ]
   }
```

**File**: `packages/octicons/README.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ The table below tracks which font version is included in each package version.
 | &gt; 12.0.0 | 19.15.0 |
 | &gt; 12.0.1 | 19.15.3 |
 | &gt; 20.4.1 | 19.22.0 |
+| &gt; 21.0.0 | 19.23.1 |
 
 ## Contributing
 
```

**File**: `packages/octicons/glyphmaps/Octicons.json` (modified, +1/-0)
```diff
@@ -203,6 +203,7 @@
   "list-unordered": 61872,
   "location": 61873,
   "lock": 61874,
+  "lockup-github": 62065,
   "log": 61875,
   "logo-gist": 61876,
   "logo-github": 61877,
```

**File**: `packages/octicons/package.json` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@
     "onchange": "^7.1.0",
     "react-native-builder-bob": "^0.35.2",
     "typescript": "^5.7.2",
-    "@primer/octicons": "19.22.0"
+    "@primer/octicons": "19.23.1"
   },
   "peerDependencies": {
     "react": "*",
```

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -1508,8 +1508,8 @@ importers:
         version: 0.84.1(@babel/core@7.29.0)(@react-native-community/cli@20.1.3(typescript@5.9.3))(@react-native/metro-config@0.84.1(@babel/core@7.29.0))(@types/react@19.2.14)(react@19.2.4)
     devDependencies:
       '@primer/octicons':
-        specifier: 19.22.0
-        version: 19.22.0
+        specifier: 19.23.1
+        version: 19.23.1
       '@types/react':
         specifier: ^19.1.0
         version: 19.2.14
@@ -3784,8 +3784,8 @@ packages:
     resolution: {integrity: sha512-h104Kh26rR8tm+a3Qkc5S4VLYint3FE48as7+/5oCEcKR2idC/pF1G6AhIXKI+eHPJa/3J9i5z0Al47IeGHPkA==}
     engines: {node: '>=12'}
 
-  '@primer/octicons@19.22.0':
-    resolution: {integrity: sha512-nWoh9PlE6u7xbiZF3KcUm3ktLpN2rQPt11trwp/t4EsKuYRNVWVbBp1LkCBsvZq7ScckNKUURLigIU0wS1FQdw==}
+  '@primer/octicons@19.23.1':
+    resolution: {integrity: sha512-CzjGmxkmNhyst6EekrS3SJPdtzgIkUMP/LSJch65y99/kmiFXbO1a+q7zoYe3hnI9NaOM0IN+ydDIbOmd8YqcA==}
 
   '@react-native-community/cli-clean@20.1.3':
     resolution: {integrity: sha512-sFLdLzapfC0scjgzBJJWYDY2RhHPjuuPkA5r6q0gc/UQH/izXpMpLrhh1DW84cMDraNACK0U62tU7ebNaQ1LMQ==}
@@ -14585,7 +14585,7 @@ snapshots:
       '@pnpm/network.ca-file': 1.0.2
       config-chain: 1.1.13
 
-  '@primer/octicons@19.22.0':
+  '@primer/octicons@19.23.1':
     dependencies:
       object-assign: 4.1.1
 
```

---

### Incident Patch 11: `a2b13906` (2026-04-06)
**Commit Message**: chore: fix missing README.md update for ionicons (#1900)

**File**: `packages/ionicons/README.md` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ The table below tracks which font version is included in each package version.
 | ------------ | ---------------- |
 | &gt; 12.0.0 | 7.4.0 |
 | &gt; 12.0.1 | 8.0.8 |
+| &gt; 12.4.1 | 8.0.13 |
 
 ## Contributing
 
```

---

### Incident Patch 12: `29897d47` (2026-04-04)
**Commit Message**: chore: fix pro font stub creator (#1899)

* chore: fix pro font stub creator
* chore: trigger native tests when icon-explorer changes
* fix: incorrect path for icon-explorer font stubs

**File**: `.github/workflows/tests.yaml` (modified, +2/-2)
```diff
@@ -8,14 +8,14 @@ on:
     paths:
       - ".github/workflows/tests.yaml"
       - "packages/**"
-      - "!apps/directory/**"
       - "!packages/codemod/**"
+      - "apps/icon-explorer"
   pull_request:
     paths:
       - ".github/workflows/tests.yaml"
       - "packages/**"
-      - "!apps/directory/**"
       - "!packages/codemod/**"
+      - "apps/icon-explorer"
   workflow_dispatch:
 
 jobs:
```

**File**: `apps/icon-explorer/scripts/create-pro-font-stubs.mjs` (modified, +5/-3)
```diff
@@ -11,13 +11,15 @@ import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
 import { dirname, join, resolve } from 'node:path';
 import { fileURLToPath } from 'node:url';
 
-const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
+const currentDir = dirname(fileURLToPath(import.meta.url));
+const packagesDir = resolve(currentDir, '../../../packages');
+const explorerDir = resolve(currentDir, '..');
 
 for (const dir of ['fontawesome5-pro', 'fontawesome6-pro']) {
-  const destDir = join(root, 'rnvi-fonts', dir);
+  const destDir = join(explorerDir, 'rnvi-fonts', dir);
   mkdirSync(destDir, { recursive: true });
 
-  const yorc = join(root, '..', dir, '.yo-rc.json');
+  const yorc = join(packagesDir, dir, '.yo-rc.json');
   const yo = JSON.parse(readFileSync(yorc, 'utf8'));
   const styles = yo['generator-react-native-vector-icons'].meta.styles;
 
```

---

### Incident Patch 13: `62bc5f8d` (2026-04-03)
**Commit Message**: fix: broken tests (#1898)

**File**: `apps/directory/bin/generate-glyphmap-index.mts` (modified, +4/-4)
```diff
@@ -7,23 +7,23 @@ import { globSync } from 'glob';
 const glyphMapFiles = globSync('../*/glyphmaps/*.json', { ignore: '../fontawesome[56]*/**' });
 
 const fontAwesome5Glyphmap = (
-  await import(path.join(import.meta.dirname, '../../fontawesome5/glyphmaps/', 'FontAwesome5.json'), {
+  await import(path.join(import.meta.dirname, '../../../packages/fontawesome5/glyphmaps/', 'FontAwesome5.json'), {
     with: { type: 'json' },
   })
 ).default;
 const fontAwesome5Meta = (
-  await import(path.join(import.meta.dirname, '../../fontawesome5/glyphmaps/', 'FontAwesome5_meta.json'), {
+  await import(path.join(import.meta.dirname, '../../../packages/fontawesome5/glyphmaps/', 'FontAwesome5_meta.json'), {
     with: { type: 'json' },
   })
 ).default;
 
 const fontAwesome6Glyphmap = (
-  await import(path.join(import.meta.dirname, '../../fontawesome6/glyphmaps/', 'FontAwesome6.json'), {
+  await import(path.join(import.meta.dirname, '../../../packages/fontawesome6/glyphmaps/', 'FontAwesome6.json'), {
     with: { type: 'json' },
   })
 ).default;
 const fontAwesome6Meta = (
-  await import(path.join(import.meta.dirname, '../../fontawesome6/glyphmaps/', 'FontAwesome6_meta.json'), {
+  await import(path.join(import.meta.dirname, '../../../packages/fontawesome6/glyphmaps/', 'FontAwesome6_meta.json'), {
     with: { type: 'json' },
   })
 ).default;
```

**File**: `apps/directory/package.json` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
     "test": "react-scripts test",
     "eject": "react-scripts eject",
     "generate-glyphmap-index": "mkdir -p src/generated &&  bin/generate-glyphmap-index.mts > src/generated/glyphmapIndex.json",
-    "generate-font-index": "mkdir -p src/generated/fonts && cp ../*/fonts/*.ttf src/generated/fonts && bin/generate-font-styles.mts > src/generated/fonts.css",
+    "generate-font-index": "mkdir -p src/generated/fonts && cp ../../packages/*/fonts/*.ttf src/generated/fonts && bin/generate-font-styles.mts > src/generated/fonts.css",
     "prepare": "rm -rf src/generated && pnpm run generate-glyphmap-index && pnpm run generate-font-index"
   },
   "browserslist": {
```

---

### Incident Patch 14: `7ec1e243` (2026-03-25)
**Commit Message**: chore: fix knip checks (#1890)

**File**: `.eslintrc.js` (modified, +6/-1)
```diff
@@ -1,5 +1,10 @@
 module.exports = {
-  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react/recommended'],
+  extends: [
+    'eslint:recommended',
+    'plugin:@typescript-eslint/recommended',
+    'plugin:react/recommended',
+    'plugin:react-hooks/recommended',
+  ],
   env: {
     browser: true,
     es2021: true,
```

**File**: `.knip.jsonc` (modified, +43/-57)
```diff
@@ -1,159 +1,145 @@
 {
-  "$schema": "https://unpkg.com/knip@5/schema-jsonc.json",
-  "ignore": ["**/*.web.ts"],
+  "$schema": "https://unpkg.com/knip@6/schema-jsonc.json",
+  "ignore": ["**/*.web.{ts,tsx}"],
+  "ignoreWorkspaces": ["packages/generator-react-native-vector-icons"],
   "babel": true,
   "workspaces": {
     ".": {
       "ignoreDependencies": [
         "yo",
-        "eslint-config-airbnb-typescript",
         "generator-react-native-vector-icons",
         "@commitlint/config-conventional",
         "@nx/js",
         "@evilmartians/lefthook"
       ],
-      "ignoreBinaries": ["scripts/generate-fonts.sh"]
-    },
-    "packages/*": {
-      "entry": [
-        "{index,cli,main}.{js,mjs,cjs,jsx,ts,tsx,mts,cts}!",
-        "src/{index,cli,main}.{js,mjs,cjs,jsx,ts,tsx,mts,cts}!"
-      ]
+      "ignoreBinaries": ["scripts/generate-fonts.sh"],
+      "entry": ["scripts/fix-glyphmaps.mjs"]
     },
     "packages/common": {
-      "entry": ["src/index.ts", "src/scripts/{getFonts,updatePlist}.ts"],
+      "entry": ["src/index.{ts,tsx}", "src/scripts/{getFonts,updatePlist}.{ts,tsx}"],
       "ignoreDependencies": ["@react-native/assets-registry", "@react-native-vector-icons/get-image"]
     },
     "packages/get-image": {
-      "entry": ["src/index.ts"],
+      "entry": ["src/index.{ts,tsx}"],
       "ignoreDependencies": ["turbo"],
-      "ignore": ["src/NativeVectorIcons.ts", "react-native.config.js"]
+      "ignore": ["src/NativeVectorIcons.{ts,tsx}", "react-native.config.js"]
     },
     "packages/fontawesome-common": {
       "entry": ["scripts/generate-fontawesome-metadata.js", "scripts/generate-fontawesome-glyphmap.mts"],
-      "ignore": ["generators/app/templates/src/*"],
-      "ignoreDependencies": ["@types/react"]
+      "ignore": ["generators/app/templates/src/*"]
     },
     "packages/codemod": {
-      "entry": ["src/index.ts", "src/{11,12}.0/transform.ts"]
+      "entry": ["src/index.{ts,tsx}", "src/{11,12}.0/transform.{ts,tsx}"]
     },
     "packages/directory": {
       "entry": [
         "src/index.tsx",
         "src/App.test.tsx",
-        "src/reportWebVitals.ts",
+        "src/reportWebVitals.{ts,tsx}",
         "src/setupTests.js",
         "bin/generate-font-styles.mts",
         "bin/generate-glyphmap-index.mts"
       ],
-      "ignoreDependencies": ["@testing-library/user-event"],
       "ignoreBinaries": ["bin/generate-font-styles.mts", "bin/generate-glyphmap-index.mts"]
     },
     "packages/icon-explorer": {
-      "entry": ["index.js", "react-native.config.js", "configPlugin.js", "src/Types.tsx"],
-      "ignore": ["metro.config.js"],
+      "entry": ["index.js", "src/Types.tsx"],
+      "ignore": ["metro.config.js", "configPlugin.js"],
+      "metro": false,
       "ignoreDependencies": [
         "@react-native-vector-icons/get-image",
         "@babel/preset-env",
         "@react-native/eslint-config",
         "@rnx-kit/align-deps",
         "react-test-renderer",
         "@types/react-test-renderer",
-        "@react-native-community/cli",
-        "@react-native-community/cli-platform-android",
-        "@react-native-community/cli-platform-ios"
-      ]
-    },
-    "packages/generator-react-native-vector-icons": {
-      "entry": ["src/app/index.ts"],
-      "ignore": ["src/app/templates/**", "generators/app/templates/**"],
-      "ignoreDependencies": ["oslllo-svg-fixer"]
+        "@react-native/metro-config",
+        "@rnx-kit/metro-config"
+      ],
+      "ignoreBinaries": ["tsx"]
     },
     "packages/ant-design": {
-      "ignore": ["src/NativeVectorIconsAntDesign.ts"],
+      "entry": ["src/index.{ts,tsx}", "src/static.{ts,tsx}"],
       "ignoreDependencies": ["@ant-design/icons-svg"]
     },
     "packages/entypo": {
-      "ignore": ["src/NativeVectorIconsEntypo.ts"],
+      "entry": ["src/index.{ts,tsx}", "src/static.{ts,tsx}"],
       "ignoreDependencies": ["@entypo-icons/core"]
     },
     "packages/evil-icons": {
-      "ignore": ["src/NativeVectorIconsEvilIcons.ts"],
+      "entry": ["src/index.{ts,tsx}", "src/static.{ts,tsx}"],
       "ignoreDependencies": ["evil-icons"]
     },
     "packages/feather": {
-      "ignore": ["src/NativeVectorIconsFeather.ts"],
+      "entry": ["src/index.{ts,tsx}", "src/static.{ts,tsx}"],
       "ignoreDependencies": ["feather-icons"]
     },
     "packages/fontawesome": {
-      "ignore": ["src/NativeVectorIconsFontAwesome.ts"],
+      "entry": ["src/index.{ts,tsx}", "src/static.{ts,tsx}"],
       "ignoreDependencies": ["font-awesome"]
     },
     "packages/fontawesome-free-brands": {
+      "entry": ["src/index.{ts,tsx}", "src/static.{ts,tsx}"],
       "ignoreDependencies": ["@fortawesome/fontawesome-free"]
     },
     "packages/fontawesome-free-regular": {
+      "entry": ["src/index.{ts,tsx}", "src/static.{ts,tsx}"],
       "ignoreDependencies": ["@fortawesome/fontawesome-free"]
     },
     "packages/fontawesome-free-solid": {
+      "entry": ["src/index.{ts,tsx}", "src/static.{ts,tsx}"],
     
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
     "eslint-plugin-react": "^7.37.5",
     "eslint-plugin-react-hooks": "^5.1.0",
     "generator-react-native-vector-icons": "workspace:*",
-    "knip": "^5.66.2",
+    "knip": "^6.0.5",
     "nx": "^22.5.2",
     "typescript": "^5.9.3",
     "yo": "^5.1.0"
```

**File**: `packages/directory/package.json` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@
     "@testing-library/dom": "^10.4.0",
     "@testing-library/jest-dom": "^6.6.3",
     "@testing-library/react": "^16.3.0",
-    "@testing-library/user-event": "^13.5.0",
     "@types/jest": "^27.5.2",
     "@types/node": "^20.17.11",
     "@types/react": "^19.1.0",
```

**File**: `packages/fontawesome-common/package.json` (modified, +0/-1)
```diff
@@ -49,7 +49,6 @@
     "registry": "https://registry.npmjs.org/"
   },
   "devDependencies": {
-    "@types/react": "^19.0.12",
     "typescript": "^5.7.2",
     "yargs": "^17.7.2"
   },
```

**File**: `pnpm-lock.yaml` (modified, +388/-126)
```diff
@@ -57,8 +57,8 @@ importers:
         specifier: workspace:*
         version: link:packages/generator-react-native-vector-icons
       knip:
-        specifier: ^5.66.2
-        version: 5.66.2(@types/node@20.19.23)(typescript@5.9.3)
+        specifier: ^6.0.5
+        version: 6.0.5
       nx:
         specifier: ^22.5.2
         version: 22.5.2
@@ -200,9 +200,6 @@ importers:
       '@testing-library/react':
         specifier: ^16.3.0
         version: 16.3.0(@testing-library/dom@10.4.0)(@types/react-dom@19.1.6(@types/react@19.1.8))(@types/react@19.1.8)(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
-      '@testing-library/user-event':
-        specifier: ^13.5.0
-        version: 13.5.0(@testing-library/dom@10.4.0)
       '@types/jest':
         specifier: ^27.5.2
         version: 27.5.2
@@ -360,9 +357,6 @@ importers:
 
   packages/fontawesome-common:
     devDependencies:
-      '@types/react':
-        specifier: ^19.0.12
-        version: 19.1.8
       typescript:
         specifier: ^5.7.2
         version: 5.9.3
@@ -2668,12 +2662,21 @@ packages:
   '@emnapi/core@1.6.0':
     resolution: {integrity: sha512-zq/ay+9fNIJJtJiZxdTnXS20PllcYMX3OE23ESc4HK/bdYu3cOWYVhsOhVnXALfU/uqJIxn5NBPd9z4v+SfoSg==}
 
+  '@emnapi/core@1.9.1':
+    resolution: {integrity: sha512-mukuNALVsoix/w1BJwFzwXBN/dHeejQtuVzcDsfOEsdpCumXb/E9j8w11h5S54tT1xhifGfbbSm/ICrObRb3KA==}
+
   '@emnapi/runtime@1.6.0':
     resolution: {integrity: sha512-obtUmAHTMjll499P+D9A3axeJFlhdjOWdKUNs/U6QIGT7V5RjcUW1xToAzjvmgTSQhDbYn/NwfTRoJcQ2rNBxA==}
 
+  '@emnapi/runtime@1.9.1':
+    resolution: {integrity: sha512-VYi5+ZVLhpgK4hQ0TAjiQiZ6ol0oe4mBx7mVv7IflsiEp0OWoVsp/+f9Vc1hOhE0TtkORVrI1GvzyreqpgWtkA==}
+
   '@emnapi/wasi-threads@1.1.0':
     resolution: {integrity: sha512-WI0DdZ8xFSbgMjR1sFsKABJ/C5OnRrjT06JXbZKexJGrDuPTzZdDYfFlsgcCXCyf+suG5QU2e/y1Wo2V/OapLQ==}
 
+  '@emnapi/wasi-threads@1.2.0':
+    resolution: {integrity: sha512-N10dEJNSsUx41Z6pZsXU8FjPjpBEplgH24sfkmITrBED1/U2Esum9F3lfLrMjKHHjmi557zQn7kR9R+XWXu5Rg==}
+
   '@entypo-icons/core@1.0.1':
     resolution: {integrity: sha512-BHywDzBXI3GPZwOluZtGmZ1nEHqZMtH0ideZRWfsWAhCCmRSrGzPQgFdPZLH3vxK38LMcP2atAfZ/8Ui72mFuQ==}
 
@@ -3258,8 +3261,8 @@ packages:
   '@napi-rs/wasm-runtime@0.2.4':
     resolution: {integrity: sha512-9zESzOO5aDByvhIAsOy9TbpZ0Ur2AJbUI7UT73kcUTS2mxAMHOBaa1st/jAymNoCtvrit99kkzT1FZuXVcgfIQ==}
 
-  '@napi-rs/wasm-runtime@1.0.7':
-    resolution: {integrity: sha512-SeDnOO0Tk7Okiq6DbXmmBODgOAb9dp9gjlphokTUxmt8U3liIP1ZsozBahH69j/RJv+Rfs6IwUKHTgQYJ/HBAw==}
+  '@napi-rs/wasm-runtime@1.1.1':
+    resolution: {integrity: sha512-p64ah1M1ld8xjWv3qbvFwHiFVWrq1yFvV4f7w+mzaqiR4IlSgkqhcRdHwsGgomwzBH51sRY4NEowLxnaBjcW/A==}
 
   '@nicolo-ribaudo/eslint-scope-5-internals@5.1.1-v1':
     resolution: {integrity: sha512-54/JRvkLIzzDWshCWfuhadfrfZVPiElY8Fcgmg1HroEly/EDSszzhBAsarCux+D/kOslTRquNzuyGSmUSTTHGg==}
@@ -3464,98 +3467,225 @@ packages:
   '@octokit/types@13.8.0':
     resolution: {integrity: sha512-x7DjTIbEpEWXK99DMd01QfWy0hd5h4EN+Q7shkdKds3otGQP+oWE/y0A76i1OvH9fygo4ddvNf7ZvF0t78P98A==}
 
-  '@oxc-resolver/binding-android-arm-eabi@11.11.1':
-    resolution: {integrity: sha512-v5rtczLD5d8lasBdP6GXoM7VQ1Av9pZyWGXF5afQawRZcWTVvncrIzu9nhKpvIhhmC4C6MYdXA3CNZc60LvUig==}
+  '@oxc-parser/binding-android-arm-eabi@0.120.0':
+    resolution: {integrity: sha512-WU3qtINx802wOl8RxAF1v0VvmC2O4D9M8Sv486nLeQ7iPHVmncYZrtBhB4SYyX+XZxj2PNnCcN+PW21jHgiOxg==}
+    engines: {node: ^20.19.0 || >=22.12.0}
+    cpu: [arm]
+    os: [android]
+
+  '@oxc-parser/binding-android-arm64@0.120.0':
+    resolution: {integrity: sha512-SEf80EHdhlbjZEgzeWm0ZA/br4GKMenDW3QB/gtyeTV1gStvvZeFi40ioHDZvds2m4Z9J1bUAUL8yn1/+A6iGg==}
+    engines: {node: ^20.19.0 || >=22.12.0}
+    cpu: [arm64]
+    os: [android]
+
+  '@oxc-parser/binding-darwin-arm64@0.120.0':
+    resolution: {integrity: sha512-xVrrbCai8R8CUIBu3CjryutQnEYhZqs1maIqDvtUCFZb8vY33H7uh9mHpL3a0JBIKoBUKjPH8+rzyAeXnS2d6A==}
+    engines: {node: ^20.19.0 || >=22.12.0}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@oxc-parser/binding-darwin-x64@0.120.0':
+    resolution: {integrity: sha512-xyHBbnJ6mydnQUH7MAcafOkkrNzQC6T+LXgDH/3InEq2BWl/g424IMRiJVSpVqGjB+p2bd0h0WRR8iIwzjU7rw==}
+    engines: {node: ^20.19.0 || >=22.12.0}
+    cpu: [x64]
+    os: [darwin]
+
+  '@oxc-parser/binding-freebsd-x64@0.120.0':
+    resolution: {integrity: sha512-UMnVRllquXUYTeNfFKmxTTEdZ/ix1nLl0ducDzMSREoWYGVIHnOOxoKMWlCOvRr9Wk/HZqo2rh1jeumbPGPV9A==}
+    engines: {node: ^20.19.0 || >=22.12.0}
+    cpu: [x64]
+    os: [freebsd]
+
+  '@oxc-parser/binding-linux-arm-gnueabihf@0.120.0':
+    resolution: {integrity: sha512-tkvn2CQ7QdcsMnpfiX3fd3wA3EFsWKYlcQzq9cFw/xc89Al7W6Y4O0FgLVkVQpo0Tnq/qtE1XfkJOnRRA9S/NA==}
+    engines: {node: ^20.19.0 || >=22.12.0}
+    cpu: [arm]
+    os: [linux]
+
+  '@oxc-parser/binding-linux-arm-musleabihf@0.120.0':
+    resolution: {integrity: sha512-WN5y135Ic42gQDk9grbwY9++fDhqf8knN6fnP+0WALlAUh4odY/BDK1nfTJRSfpJD9P3r1BwU0m3pW2DU89whQ==}
+    engines: {node: ^20.19.0 || >=22.12.0}
+  
```

---

### Incident Patch 15: `e760a47c` (2026-03-17)
**Commit Message**: fix: simplify createIconSourceCache and remove error caching (#1883)

**File**: `packages/common/src/create-icon-set.tsx` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import React, { forwardRef, type Ref, useEffect } from 'react';
 // eslint-disable-next-line import/no-extraneous-dependencies
 import { Platform, Text, type TextProps, type TextStyle } from 'react-native';
 
-import createIconSourceCache from './create-icon-source-cache';
+import { createIconSourceCache } from './create-icon-source-cache';
 import { DEFAULT_ICON_COLOR, DEFAULT_ICON_SIZE } from './defaults';
 import { dynamicLoader } from './dynamicLoading/dynamic-font-loading';
 import { isDynamicLoadingEnabled } from './dynamicLoading/dynamic-loading-setting';
```

**File**: `packages/common/src/create-icon-source-cache.ts` (modified, +5/-23)
```diff
@@ -1,29 +1,11 @@
-const TYPE_VALUE = 'value';
-const TYPE_ERROR = 'error';
-
 type ValueData = { uri: string; scale: number };
 
-type Value = { type: typeof TYPE_VALUE; data: ValueData } | { type: typeof TYPE_ERROR; data: Error };
-
-export default function createIconSourceCache() {
-  const cache = new Map<string, Value>();
-
-  const setValue = (key: string, value: ValueData) => cache.set(key, { type: TYPE_VALUE, data: value });
-
-  const setError = (key: string, error: Error) => cache.set(key, { type: TYPE_ERROR, data: error });
+export function createIconSourceCache() {
+  const cache = new Map<string, ValueData>();
 
-  const get = (key: string) => {
-    const value = cache.get(key);
-    if (!value) {
-      return undefined;
-    }
+  const setValue = (key: string, value: ValueData) => cache.set(key, value);
 
-    const { type, data } = value;
-    if (type === TYPE_ERROR) {
-      throw data;
-    }
-    return data;
-  };
+  const get = (key: string) => cache.get(key);
 
-  return { setValue, setError, get };
+  return { setValue, get };
 }
```

**File**: `packages/common/src/get-image-source.ts` (modified, +14/-31)
```diff
@@ -1,7 +1,7 @@
 import type { TextStyle } from 'react-native';
 import { PixelRatio, processColor } from 'react-native';
 
-import type createIconSourceCache from './create-icon-source-cache';
+import type { createIconSourceCache } from './create-icon-source-cache';
 import { DEFAULT_ICON_COLOR, DEFAULT_ICON_SIZE } from './defaults';
 import { ensureGetImageAvailable } from './get-image-library';
 
@@ -19,24 +19,18 @@ export const getImageSourceSync = (
 
   const maybeCachedValue = imageSourceCache.get(cacheKey);
   if (maybeCachedValue !== undefined) {
-    // FIXME: Should this check if it's an error and throw it again?
     return maybeCachedValue;
   }
 
-  try {
-    const imagePath = NativeIconAPI.getImageForFontSync(
-      fontReference,
-      glyph,
-      size,
-      processedColor as number, // FIXME what if a non existent colour was passed in?
-    );
-    const value = { uri: imagePath, scale: PixelRatio.get() };
-    imageSourceCache.setValue(cacheKey, value);
-    return value;
-  } catch (error) {
-    imageSourceCache.setError(cacheKey, error as Error);
-    throw error;
-  }
+  const imagePath = NativeIconAPI.getImageForFontSync(
+    fontReference,
+    glyph,
+    size,
+    processedColor as number, // FIXME what if a non existent colour was passed in?,
+  );
+  const value = { uri: imagePath, scale: PixelRatio.get() };
+  imageSourceCache.setValue(cacheKey, value);
+  return value;
 };
 
 export const getImageSource = async (
@@ -53,22 +47,11 @@ export const getImageSource = async (
 
   const maybeCachedValue = imageSourceCache.get(cacheKey);
   if (maybeCachedValue !== undefined) {
-    // FIXME: Should this check if it's an error and throw it again?
     return maybeCachedValue;
   }
 
-  try {
-    const imagePath = await NativeIconAPI.getImageForFont(
-      fontReference,
-      glyph,
-      size,
-      processedColor as number, // FIXME what if a non existent colour was passed in?
-    );
-    const value = { uri: imagePath, scale: PixelRatio.get() };
-    imageSourceCache.setValue(cacheKey, value);
-    return value;
-  } catch (error) {
-    imageSourceCache.setError(cacheKey, error as Error);
-    throw error;
-  }
+  const imagePath = await NativeIconAPI.getImageForFont(fontReference, glyph, size, processedColor as number);
+  const value = { uri: imagePath, scale: PixelRatio.get() };
+  imageSourceCache.setValue(cacheKey, value);
+  return value;
 };
```

#### Recent Merged Pull Requests:
- **PR #1928** (2026-09-07): fix(android): skip explicit Kotlin plugin when AGP registers the kotlin extension (@gabrieldonadel)
- **PR #1927** (2026-08-30): chore: remove spam link (@Jeroen-G)
- **PR #1924** (2026-08-20): fix: resolve asset registry on react-native 0.87 (@vonovak)
- **PR #1916** (2026-05-24): fix: icons did not render on expo web (@vonovak)
- **PR #1915** (2026-05-26): chore(build): typescript 6 (@oblador)
- **PR #1914** (2026-05-01): fix(codemod): check project path exists early (@vonovak)
- **PR #1913** (2026-04-29): feat: allow user to specify static / dynamic imports with expo codemod (@vonovak)
- **PR #1912** (2026-04-29): chore: fix repo links (@vonovak)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
