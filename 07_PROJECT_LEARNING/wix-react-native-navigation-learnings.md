# Forensic Learning Record (Deep Inspection): wix/react-native-navigation

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-react-native-navigation-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/react-native-navigation](https://github.com/wix/react-native-navigation))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:24:14.332Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/react-native-navigation`
- **Description**: A complete native navigation solution for React Native
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13176 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  extends: ['@react-native', 'prettier', 'prettier/@typescript-eslint', 'prettier/react'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    jest: true,
  },
};


```

### Core Architecture Module: `.grenrc.js`
```
module.exports = {
  template: {
    commit: ({message, url, author, name}) =>
      `- [${message}](${url}) - ${author ? `@${author}` : name}`,
    issue: ({name, labels, text, url, user_login, user_url}) => `${processLabels(labels)}${name} [${text}](${url}) by [${user_login}](${user_url})`,
    label: '[**{{label}}**]',
    noLabel: 'closed',
    group: '\n## {{heading}}\n',
    changelogTitle: '# Changelog\n\n',
    release: '## {{release}} ({{date}})\n{{body}}',
    releaseSeparator: '\n---\n\n',
  },
  groupBy: {
    'Enhancements:': ['type: accepted/enhancement', 'internal'],
    'Fixed:': ['type: accepted/bug'],
    Features: ['feature'],
  },
  groupPostProcessor: (groupContent) => {
    const lines = groupContent.split('\n');
    const iosIssues = [];
    const androidIssues = [];
    const otherIssues = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('## ') || line === '') continue;
      else if (line.includes('[iOS] ')) iosIssues.push(line.replace('[iOS] ', ''));
      else if (line.includes('[Android] ')) androidIssues.push(line.replace('[Android] ', ''));
      else otherIssues.push(line);
    }

    const groupHeader = groupContent.substr(0, groupContent.indexOf(':\n'));
    return `${groupHeader}${generateSection(undefined, otherIssues)}${generateSection('iOS', iosIssues)}${generateSection('Android', androidIssues)}`;
  },
  ignoreIssuesWith: ['skip-changelog'],
  ignoreTagsWith: ['snapshot', 'v1', 'v2', '0\..\..', '1\..\..', '2\..\..', '3\..\..', '4\..\..', '5\..\..', '6\..\..'],
  dataSource: 'prs',
  changelogFilename: 'CHANGELOG.gren.md',
  override: true,
  generate: true,
  tags: 'all'
};

function generateSection(name, issues) {
  if (!issues.length) return '';
  let section = `\n${name ? `### ${name}\n` : ''}`;

  issues.forEach(issue => {
    section += `- ${issue}\n`;
  });

  return `${section}\n`;
}

function processLabels(labels) {
  const includesIOS = labels.includes('**platform: iOS**');
  const includesAndroid = labels.includes('**platform: Android**');
  if (includesIOS && includesAndroid) {
    return '';
  } else if (includesIOS) {
    return '[iOS] '
  } else if (includesAndroid) {
    return '[Android] '
  }

  return '';
}

```

### Core Architecture Module: `__mocks__/react-native-webview.js`
```
const React = require('react');

const WebView = (props) => React.createElement('WebView', props);

module.exports = { WebView };

```

### Core Architecture Module: `autolink/postlink/__helpers__/fixtures.js`
```
const prepareFixtureDuplicate = ({ rnVersion, userFixtureFileName, patchedFixtureFileName }) => {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');

  const userFixtureRelPath = _getRelativeFixturePath(rnVersion, userFixtureFileName);

  const userFixturePath = path.resolve(userFixtureRelPath);
  const patchedFixturePath = path.resolve(os.tmpdir(), patchedFixtureFileName);
  fs.copyFileSync(userFixturePath, patchedFixturePath);

  return patchedFixturePath;
};

const _getRelativeFixturePath = (rnVersion, fixtureFileName) => {
  const path = require('node:path');
  return path.join('autolink', 'fixtures', `rn${rnVersion}`, fixtureFileName);
};

module.exports = {
  prepareFixtureDuplicate,
  prepareFixtureDuplicate77: ({ userFixtureFileName, patchedFixtureFileName }) =>
    prepareFixtureDuplicate({ rnVersion: '77', userFixtureFileName, patchedFixtureFileName }),
  prepareFixtureDuplicate79: ({ userFixtureFileName, patchedFixtureFileName }) =>
    prepareFixtureDuplicate({ rnVersion: '79', userFixtureFileName, patchedFixtureFileName }),
};

```

### Core Architecture Module: `autolink/postlink/__helpers__/generate_version_header.js`
```
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { getReactNativeVersion, findProjectPackageJson } = require('./reactNativeVersion');

// Logging helper that writes to both stderr and a log file
function log(message) {
  console.error(message);

  // Also write to a log file for debugging if stderr is suppressed
  try {
    const logFile = path.join(__dirname, '../../../ios/rnn_version_detection.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`, 'utf8');
  } catch (e) {
    // Ignore log file errors
  }
}

function generateVersionHeader() {
  const startDir = __dirname;

  log(`[RNN] === React Native Version Detection ===`);
  log(`[RNN] Script location (__dirname): ${startDir}`);
  log(`[RNN] Working directory (cwd): ${process.cwd()}`);

  const packageJsonPath = findProjectPackageJson();

  if (!packageJsonPath) {
    log('[RNN] ❌ ERROR: Project package.json not found');
    log('[RNN] This usually means the script could not locate your React Native project.');
    return;
  }

  log(`[RNN] ✓ Found package.json: ${packageJsonPath}`);

  // Determine actual source of version
  const projectRoot = path.dirname(packageJsonPath);
  const rnPackageJsonPath = path.join(projectRoot, 'node_modules', 'react-native', 'package.json');
  let versionSource = packageJsonPath;
  let versionSourceType = 'package.json';

  if (fs.existsSync(rnPackageJsonPath)) {
    versionSource = rnPackageJsonPath;
    versionSourceType = 'node_modules/react-native/package.json (installed version)';
  }

  const versionInfo = getReactNativeVersion();

  if (!versionInfo) {
    log('[RNN] ❌ ERROR: react-native not found in package.json or node_modules');
    log('[RNN] Make sure react-native is installed and listed as a dependency.');
    return;
  }

  log(`[RNN] ✓ React Native ${versionInfo.raw} (source: ${versionSourceType})`);

  const { major, minor, patch } = versionInfo;

  // Generate header content
  const headerContent = `//
  // ReactNativeVersionExtracted.h
  // React Native version: ${versionInfo.raw}
  // Generated on: ${new Date().toISOString()}
  // Source: ${versionSource}
  //
  
  #ifndef ReactNativeVersionExtracted_h
  #define ReactNativeVersionExtracted_h
  
  static const int REACT_NATIVE_VERSION_MAJOR = ${major};
  static const int REACT_NATIVE_VERSION_MINOR = ${minor};
  static const int REACT_NATIVE_VERSION_PATCH = ${patch};
  
  #define RN_VERSION_MAJOR ${major}
  #define RN_VERSION_MINOR ${minor}
  #define RN_VERSION_PATCH ${patch}
  
  #endif
  `;

  // Find RNN root by looking upwards from script location for RNN's package.json
  let currentDir = __dirname;
  let rnnPackageJson = null;

  for (let i = 0; i < 5; i++) {
    const potential = path.join(currentDir, 'package.json');
    if (fs.existsSync(potential)) {
      const pkg = JSON.parse(fs.readFileSync(potential, 'utf8'));
      // This is RNN's package.json if name matches
      if (pkg.name === 'react-native-navigation') {
        rnnPackageJson = currentDir;
        break;
      }
    }
    currentDir = path.resolve(currentDir, '..');
  }

  if (!rnnPackageJson) {
    log('[RNN] ❌ ERROR: Could not find react-native-navigation root directory');
    return;
  }

  const outputFile = path.join(rnnPackageJson, 'ios/ReactNativeVersionExtracted.h');

  fs.writeFileSync(outputFile, headerContent, 'utf8');
  log(`[RNN] ✅ Generated header: ${outputFile}`);
  log(`[RNN] ✅ Version constants: ${major}.${minor}.${patch}`);
  log(`[RNN] === Completed Successfully ===`);
}

// Run if called directly
if (require.main === module) {
  generateVersionHeader();
}

module.exports = { generateVersionHeader };
```

### Core Architecture Module: `autolink/postlink/__helpers__/reactNativeVersion.js`
```
// @ts-check
var fs = require('fs');
var nodePath = require('path');
var { warnn } = require('../log');

/**
 * Find the project root package.json
 * @returns {string|null} Path to project's package.json or null if not found
 */
function findProjectPackageJson() {
    var searchDirs = [process.cwd(), __dirname];

    // PRIORITY: Check if we're in RNN's own directory structure (workspace/CI scenario)
    // In this case, __dirname would be like: /path/to/rnn/autolink/postlink/__helpers__
    // And we want to find: /path/to/rnn/playground/package.json
    var currentPath = __dirname;

    // Walk up to find RNN root (containing this autolink folder)
    for (var k = 0; k < 5; k++) {
        // Check if this looks like RNN root by checking for playground subdirectory
        var playgroundPath = nodePath.join(currentPath, 'playground');
        var playgroundPackageJson = nodePath.join(playgroundPath, 'package.json');

        if (fs.existsSync(playgroundPackageJson)) {
            try {
                var pkg = JSON.parse(fs.readFileSync(playgroundPackageJson, 'utf8'));
                if ((pkg.dependencies && pkg.dependencies['react-native']) ||
                    (pkg.devDependencies && pkg.devDependencies['react-native'])) {
                    // Found it! Prioritize this path
                    searchDirs.unshift(playgroundPath);
                    break;
                }
            } catch (e) { }
        }

        var parent = nodePath.dirname(currentPath);
        if (parent === currentPath) break;
        currentPath = parent;
    }

    // If we're inside a package (like in node_modules or a workspace), 
    // also try searching from common project locations
    currentPath = __dirname;
    for (var k = 0; k < 10; k++) {
        var basename = nodePath.basename(currentPath);

        // If we're in node_modules, the parent is likely the project root
        if (basename === 'node_modules') {
            searchDirs.push(nodePath.dirname(currentPath));
            break;
        }

        // If we find a workspace scenario (e.g., we're in the workspace root but project is in subdirectory)
        // Check for common subdirectories like 'playground', 'example', 'app'
        var commonProjectDirs = ['playground', 'example', 'app', 'demo'];
        for (var m = 0; m < commonProjectDirs.length; m++) {
            var potentialProjectDir = nodePath.join(currentPath, commonProjectDirs[m]);
            if (fs.existsSync(potentialProjectDir)) {
                searchDirs.push(potentialProjectDir);
            }
        }

        var parent = nodePath.dirname(currentPath);
        if (parent === currentPath) break;
        currentPath = parent;
    }

    for (var j = 0; j < searchDirs.length; j++) {
        var searchDir = searchDirs[j];
        for (var i = 0; i < 10; i++) {
            var packagePath = nodePath.join(searchDir, 'package.json');
            if (fs.existsSync(packagePath)) {
                try {
                    var pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                    if ((pkg.dependencies && pkg.dependencies['react-native']) ||
                        (pkg.devDependencies && pkg.devDependencies['react-native'])) {
                        // Exclude react-native-navigation's own package.json to avoid false positives
                        // in workspace/monorepo scenarios
                        if (pkg.name !== 'react-native-navigation') {
                            return packagePath;
                        }
                    }
                } catch (e) { }
            }
            var parent = nodePath.dirname(searchDir);
            if (parent === searchDir) break;
            searchDir = parent;
        }
    }

    return null;
}

/**
 * Get React Native version as parsed object from node_modules
 * @returns {Object|null} { major, minor, patch, raw } or null
 */
function getReactNativeVersion() {
    var projectPackageJsonPath = findProjectPackageJson();
    if (!projectPackageJsonPath) {
        warnn('Could not find package.json to detect React Native version');
        return null;
    }

    var projectRoot = nodePath.dirname(projectPackageJsonPath);

    // First, try to read from node_modules/react-native/package.json (actual installed version)
    var rnPackageJsonPath = nodePath.join(projectRoot, 'node_modules', 'react-native', 'package.json');

    try {
        if (fs.existsSync(rnPackageJsonPath)) {
            var rnPackageJson = JSON.parse(fs.readFileSync(rnPackageJsonPath, 'utf8'));
            var rnVersion = rnPackageJson.version;

            if (rnVersion) {
                var parts = rnVersion.split('.');
                return {
                    major: parseInt(parts[0]) || 0,
                    minor: parseInt(parts[1]) || 0,
                    patch: parseInt(parts[2]) || 0,
                    raw: rnVersion
                };
            }
        }
    } catch (e) {
        // Fall through to backup method
    }

    // Fallback: read from project's package.json dependencies
    try {
        var packageJson = JSON.parse(fs.readFileSync(projectPackageJsonPath, 'utf8'));
        var rnVersion = packageJson.dependencies && packageJson.dependencies['react-native'] ||
            packageJson.devDependencies && packageJson.devDependencies['react-native'];

        if (!rnVersion) {
            warnn('React Native not found in package.json or node_modules');
            return null;
        }

        // Parse version (remove ^, ~, >=, etc.)
        var cleanVersion = rnVersion.replace(/^[\^~>=<]+/, '');
        var parts = cleanVersion.split('.');

        return {
            major: parseInt(parts[0]) || 0,
            minor: parseInt(parts[1]) || 0,
            patch: parseInt(parts[2]) || 0,
            raw: rnVersion
        };
    } catch (e) {
        warnn('Error detecting React Native version: ' + e.message);
        return null;
    }
}

module.exports = {
    findProjectPackageJson: findProjectPackageJson,
    getReactNativeVersion: getReactNativeVersion
};


```

### Core Architecture Module: `autolink/postlink/__mocks__/log.js`
```
module.exports = {
  log: console.log,
  logn: console.log,
  warn: console.log,
  warnn: console.log,
  info: console.log,
  infon: console.log,
  debug: console.log,
  debugn: console.log,
  errorn: console.log,
};

```

### Core Architecture Module: `autolink/postlink/activityLinker.js`
```
// @ts-check
var path = require('./path');
var fs = require('fs');
var { errorn, warnn, logn, infon, debugn } = require('./log');

class ActivityLinker {
  constructor() {
    this.activityPath = path.mainActivityKotlin
    this.extendNavigationActivitySuccess = false;
    this.removeGetMainComponentNameSuccess = false;
    this.removeCreateReactActivityDelegate = false;
  }

  link() {
    if (!this.activityPath) {
      errorn(
        '   MainActivity.kt not found! Does the file exist in the correct folder?\n   Please check the manual installation docs:\n   https://wix.github.io/react-native-navigation/docs/installing#2-update-mainactivityjava'
      );
      return;
    }

    logn('Linking MainActivity...');

    var activityContent = fs.readFileSync(this.activityPath, 'utf8');

    try {
      activityContent = this._extendNavigationActivity(activityContent);
      this.extendNavigationActivitySuccess = true;
    } catch (e) {
      errorn('   ' + e.message);
    }

    try {
      activityContent = this._removeGetMainComponentName(activityContent);
      this.removeGetMainComponentNameSuccess = true;
    } catch (e) {
      errorn('   ' + e.message);
    }

    activityContent = this._removeCreateReactActivityDelegate(activityContent);

    fs.writeFileSync(this.activityPath, activityContent);
    if (this.extendNavigationActivitySuccess && this.removeGetMainComponentNameSuccess) {
      infon('MainActivity.kt linked successfully!\n');
    } else if (!this.extendNavigationActivitySuccess && !this.removeGetMainComponentNameSuccess) {
      errorn(
        'MainActivity.kt was not linked. Please check the logs above for more information and proceed with manual linking of the MainActivity file in Android:\nhttps://wix.github.io/react-native-navigation/docs/installing#2-update-mainactivityjava'
      );
    } else {
      warnn(
        'MainActivity.kt was only partially linked. Please check the logs above for more information and proceed with manual linking for the failed steps:\nhttps://wix.github.io/react-native-navigation/docs/installing#2-update-mainactivityjava'
      );
    }
  }

  _removeGetMainComponentName(contents) {
    var match = /(\/\*\*[\s\S]*?\*\/\s*)?override\s+fun\s+getMainComponentName\s*\(\s*\)\s*:\s*String\s*(\{\s*return[\s\S]*?\}|=[\s\S]*?)/.exec(
      contents
    );
    if (match) {
      debugn('   Removing getMainComponentName function');
      return contents.replace(
        /(\/\*\*[\s\S]*?\*\/\s*)?override\s+fun\s+getMainComponentName\s*\(\s*\)\s*:\s*String\s*(\{\s*return[\s\S]*?\}|=[\s\S]*?(?=\n\s*(?:\/\*\*|override|fun|\}|$)))/,
        ''
      );
    }
    warnn('   getMainComponentName function was not found.');
    return contents;
  }

  _extendNavigationActivity(activityContent) {
    if (this._hasAlreadyExtendNavigationActivity(activityContent)) {
      warnn('   MainActivity already extends NavigationActivity');
      return activityContent;
    }

    if (this._doesActivityExtendReactActivity(activityContent)) {
      debugn('   Extending NavigationActivity');
      return activityContent
        .replace(/:\s*ReactActivity\(\)\s*/, ': NavigationActivity() ')
        .replace(
          'import com.facebook.react.ReactActivity',
          'import com.reactnativenavigation.NavigationActivity'
        );
    }

    throw new Error(
      'MainActivity was not successfully replaced. Please check the documentation and proceed manually.'
    );
  }

  _doesActivityExtendReactActivity(activityContent) {
    return /class\s+MainActivity\s*:\s*ReactActivity\(\)\s*/.test(activityContent);
  }

  _hasAlreadyExtendNavigationActivity(activityContent) {
    return /class\s+MainActivity\s*:\s*NavigationActivity\(\)\s*/.test(activityContent);
  }

  _removeCreateReactActivityDelegate(activityContent) {
    if (this._hasCreateReactActivityDelegate(activityContent)) {
      debugn('   Removing createReactActivityDelegate function');
      return activityContent.replace(
        /(\/\*\*[\s\S]*?\*\/\s*)?override\s+fun\s+createReactActivityDelegate\s*\(\s*\)\s*:\s*ReactActivityDelegate\s*(\{\s*return[\s\S]*?\}|=[\s\S]*?(?=\n\s*(?:\/\*\*|override|fun|\}|$)))/,
        ''
      );
    } else {
      warnn('   createReactActivityDelegate is already not defined in MainActivity');
      return activityContent;
    }
  }

  _hasCreateReactActivityDelegate(activityContent) {
    return /(\/\*\*[\s\S]*?\*\/\s*)?override\s+fun\s+createReactActivityDelegate\s*\(\s*\)\s*:\s*ReactActivityDelegate\s*(\{\s*return[\s\S]*?\}|=[\s\S]*?)/.test(
      activityContent
    );
  }
}

module.exports = ActivityLinker;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8363** (2026-09-09): **iOS: Fix bottom tabs visibility on iOS 18**
  *Symptoms*: Restore bottom-tabs visibility across iOS versions after adopting the iOS 18 API. Resolved visibility now reconciles native state while retaining OS animation semantics.  - reconcile resolved `bottomTabs.visible` on iOS 18+; preserve legacy stack guard - default `bottomTabs.animate` to true; honor explicit and global false - keep initial layout visibility non-animated - avoid UIKit mutations when visibility already matches - add presenter and controller regression coverage - validate 57 native tests and full local iOS Detox: 20 suites, 173 passed
  **Post-Mortem & Fix Analysis**:
  > #rebuild
  > guycamon, it's been 21 days!!1 This is very important for our customer.

- **Issue #8342** (2026-08-12): **Update doc how to setup library with react native >= 0.85**
  *Symptoms*: How to properly setup MainApplication.kt with react native 0.85.2

- **Issue #8337** (2026-07-30): **[BottomTabsCustomRow] Fix crash attaching custom row to non-AppCompat activities**
  *Symptoms*: #### Problem  `BottomTabsCustomRowAttacher` is registered as process-wide `Application.ActivityLifecycleCallbacks`, so `tryAttach()` runs for **every** activity in the host app (from `onActivityCreated`, `onActivityStarted`, `onActivityResumed`, `registerOnce` and `rescan`).  `tryAttach()` resolved the overlay host with `Activity.findViewById(android.R.id.content)`. On an AppCompat activity that call routes through `AppCompatDelegateImpl.findViewById()`, which calls `ensureSubDecor()` -> `createSubDecor()`. `createSubDecor()` validates the theme and throws:  ``` java.lang.IllegalStateException: You need to use a Theme.AppCompat theme (or descendant) with this activity.   at androidx.appcompat.app.AppCompatDelegateImpl.createSubDecor(AppCompatDelegateImpl.java:902)   at androidx.appcompat.app.AppCompatActivity.findViewById(AppCompatActivity.java:264)   at com.reactnativenavigation.customrow.BottomTabsCustomRowAttacher.tryAttach(BottomTabsCustomRowAttacher.kt:96)   at com.reactnativenavigation.customrow.BottomTabsCustomRowAttacher.onActivityCreated(BottomTabsCustomRowAttacher.kt:55)   at android.app.Application.dispatchActivityCreated(Application.java:368) ```  The exception escapes `onActivityCreated`, so `performLaunchActivity()` raises a `RuntimeException` and Android force-finishes the activity. There is no `try/catch` on the path.  Any activity in the process that inherits a theme which is not a `Theme.AppCompat` descendant therefore crashes on creation, even though it has

- **Issue #8336** (2026-07-30): **fix(customrow): only attach BottomTabs custom row to NavigationActivity**
  *Symptoms*: ## Problem  Owner (Android) crashes during OAuth login. When AppAuth's `RedirectUriReceiverActivity` (the relay that receives the OAuth redirect) is created, the app dies with:  ``` RuntimeException: Unable to start activity ... RedirectUriReceiverActivity: IllegalStateException: You need to use a Theme.AppCompat theme (or descendant) with this activity.   at BottomTabsCustomRowAttacher.tryAttach(BottomTabsCustomRowAttacher.kt:96)   at BottomTabsCustomRowAttacher.onActivityCreated(BottomTabsCustomRowAttacher.kt:55) ```  **Sentry:** [WIX-ONE-APP-9GFHV](https://wix-o.sentry.io/issues/7535493012/) — ~5.9k events / 1.6k users, Android-only, still active.  ## Root cause  `BottomTabsCustomRowAttacher` is a **global** `Application.ActivityLifecycleCallbacks` and runs `tryAttach()` → `findViewById(android.R.id.content)` on **every** activity in the process. For a foreign, non-AppCompat-themed activity (AppAuth's relay), that `findViewById` forces `AppCompatDelegate` sub-decor inflation, which requires a `Theme.AppCompat` and throws. Any third-party non-AppCompat activity (OAuth relays, SDK login flows, etc.) hits this, not just AppAuth.  ## Fix  Guard the observer to RNN's own `NavigationActivity` — the only place `BottomTabs` (and thus the custom row) ever live. Foreign activities are skipped, so `findViewById` is never called on them.  ```kotlin private fun ensureLayoutObserver(activity: Activity) {     if (activity !is NavigationActivity) return     ... } private fun tryAttach(act

- **Issue #8333** (2026-06-23): **playground: regenerate Android buttons navbar snapshot**
  *Symptoms*: ## Summary - Regenerate `playground/e2e/assets/buttons_navbar.android.png` from the current Android `Buttons` screen rendering on `master` - Refresh the snapshot to match the current top-bar layout after the recent Android custom-button measurement changes - Keep the change scoped to the Android PNG asset only  ## Validation - `rtk ./gradlew app:generateCodegenArtifactsFromSchema react-native-webview:generateCodegenArtifactsFromSchema d11_react-native-fast-image:generateCodegenArtifactsFromSchema react-native-community_datetimepicker:generateCodegenArtifactsFromSchema react-native-gesture-handler:generateCodegenArtifactsFromSchema --no-daemon` - `rtk npx detox build --configuration android.emu.release` - `adb exec-out screencap -p` on the Android emulator, cropped to the top-bar bounds (`1080x154` at `y=66`) - SSIM check between the regenerated asset and the fresh crop: `1.000000000000`  ## Not Run - `rtk npx detox test --configuration android.emu.release e2e/Buttons.test.js --testNamePattern "should render top/navigation-bar buttons in the right order" --headless -w 1 --retries 2`   This remained blocked locally by an emulator window-focus issue caused by a system `Bluetooth keeps stopping` dialog, so the snapshot was regenerated from a stable `adb` capture instead.  ## Risks - Low: snapshot-only change with no source-code modifications - The main risk is that local `adb` capture could differ slightly from CI rendering, though it was taken from the current release build on t

- **Issue #8332** (2026-06-23): **android: restore vertical centering for content-hugging custom top-bar buttons**
  *Symptoms*: ## Summary Custom React top-bar buttons (`topBar.leftButtons` / `rightButtons` with `{ component }`) that have **no explicit `height`** render **pinned to the top of the bar** instead of vertically centered on Android. It affects **any content-hugging button — both text (e.g. an Owner-app "Publish" button) and fixed-size images (the profile-picture / avatar left button)** — not just text.  This is the vertical-alignment regression that came back with #8328 (RNN 8.8.9). #8328 correctly fixed the New-Architecture width collapse, but as part of it changed the no-explicit-dimension **height** spec from `AT_MOST` (what #8326 used) to `EXACTLY` the full bar height.  ## Root cause With `EXACTLY` full-bar height, the hosted `ReactSurfaceView` is forced to fill the whole bar. Centering then relies entirely on the **content centering itself** (a flex container with `justifyContent: 'center'`). #8328 was validated only against such a self-centering flex button, so it missed the common case: a content-hugging button (`<View><Text>…</Text></View>`, or a fixed-size avatar image) is laid out at the **top** of the filled box → top-aligned.  The `CENTER_VERTICAL` gravity applied in `onViewAdded()` (added in #8326) is still present but is **moot under a filled height** — the child fills the parent, so there is nothing left to center.  ## Fix Make the no-explicit-dimension **height** bounded (`AT_MOST`) again, keeping #8328's content-hugging **width** (`AT_MOST`) untouched. The surface then siz

- **Issue #8331** (2026-06-21): **Update package.json version to 8.8.9**
  *Symptoms*: Automated version bump to 8.8.9 from CI release.

- **Issue #8328** (2026-06-14): **android: size custom top-bar component buttons to content (Fabric collapse fix)**
  *Symptoms*: ## Summary - Fixes custom React-component top bar buttons (`topBar.leftButtons` / `rightButtons` with `{ component }`) collapsing to ~1px (invisible) on Android under the **New Architecture (Fabric)** when they don't declare explicit `width`/`height`. A content-hugging button (e.g. `<View><Text/></View>`) disappears entirely; as a left button it also takes the back-button slot, so the back affordance appears to vanish too. Reproduces on **RN 0.78.3 and 0.85.2** (it was masked on 0.85 by flex-content buttons, which fill the constraint). - **Root cause:** the two-pass measurement from #8320/#8326 re-measured the hosted `ReactSurfaceView` with an `EXACTLY` box derived from the first (often still-empty) discovery pass. That forced box is pushed to Fabric via `updateLayoutSpecs`, so Fabric keeps laying the content out into the collapsed box and the button never recovers. - **Fix:** a single bounded measure pass —   - **Width `AT_MOST`** so the surface sizes to its content (`ReactSurfaceView` reports max-of-children under `AT_MOST`). Never push a forced `EXACTLY` *width*: that's what re-collapses the content.   - **Height `EXACTLY`** the available bar height, so content that centers itself (a flex container with `justifyContent:'center'`) stays vertically centered — matching the legacy layout. Forcing the height does not cause the width collapse.   - Explicit `width`/`height` still measure `EXACTLY` (unchanged for those buttons).  ## Validation - **Unit tests:** `TitleBarReactButto

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

### Incident Patch 1: `1de39e0d` (2026-09-09)
**Commit Message**: iOS: Fix bottom tabs visibility on iOS 18 (#8363)

* fix(ios): handle bottom tab visibility on iOS 18

* Stop verifying against RN77

* fix(ios): reconcile bottom tabs visibility

* fix(ios): honor default bottom tabs animation

* fix(ios): avoid initial tab bar animation

* fix(ios): centralize initial tab bar visibility

**File**: `.buildkite/jobs/pipeline.android_rn_77.yml` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-  - label: ":android: Android (RN 0.77.3)"
-    env:
-      JAVA_HOME: /opt/openjdk/jdk-17.0.9.jdk/Contents/Home/
-      REACT_NATIVE_VERSION: 0.77.3
-    command:
-    - "nvm install"
-    - "./scripts/ci.android.sh"
-    key: "android_rn_77"
-    timeout_in_minutes: 60
-    artifact_paths: "/Users/builder/uibuilder/work/playground/artifacts/**/*"
-    retry:
-      automatic:
-      - exit_status: [1, -1]
-        limit: 2
-
-
```

**File**: `.buildkite/jobs/pipeline.ios_rn_77.yml` (removed, +0/-15)
```diff
@@ -1,15 +0,0 @@
-  - label: ":ios: iOS (RN 0.77.3)"
-    env:
-      REACT_NATIVE_VERSION: 0.77.3
-    command:
-    - "nvm install"
-    - "./scripts/ci.ios.sh"
-    key: "ios_rn_77"
-    timeout_in_minutes: 60
-    artifact_paths: "/Users/builder/uibuilder/work/playground/artifacts/**/*"
-    retry:
-      automatic:
-      - exit_status: [1, -1]
-        limit: 2
-
-
```

**File**: `.buildkite/pipeline.sh` (modified, +0/-2)
```diff
@@ -3,11 +3,9 @@
 echo "steps:"
 
 cat .buildkite/jobs/pipeline.release.yml
-cat .buildkite/jobs/pipeline.android_rn_77.yml
 cat .buildkite/jobs/pipeline.android_rn_78.yml
 cat .buildkite/jobs/pipeline.android_rn_84.yml
 cat .buildkite/jobs/pipeline.android_rn_85.yml
-cat .buildkite/jobs/pipeline.ios_rn_77.yml
 cat .buildkite/jobs/pipeline.ios_rn_78.yml
 cat .buildkite/jobs/pipeline.ios_rn_84.yml
 cat .buildkite/jobs/pipeline.ios_rn_85.yml
```

**File**: `ios/BottomTabsBasePresenter.mm` (modified, +25/-9)
```diff
@@ -3,12 +3,30 @@
 #import "RNNConvert.h"
 #import "UIImage+utils.h"
 
-@implementation BottomTabsBasePresenter
+@implementation BottomTabsBasePresenter {
+    BOOL _didApplyInitialTabBarVisibility;
+}
+
+- (BOOL)tabBarVisibilityAnimation:(BOOL)animated {
+    if (@available(iOS 18.0, *)) {
+        return animated;
+    }
+    if (_didApplyInitialTabBarVisibility) {
+        return animated;
+    }
+
+    _didApplyInitialTabBarVisibility = YES;
+    return NO;
+}
 
 - (void)applyOptionsOnInit:(RNNNavigationOptions *)options {
     [super applyOptionsOnInit:options];
-    UITabBarController *bottomTabs = self.tabBarController;
+    RNNBottomTabsController *bottomTabs = self.tabBarController;
     RNNNavigationOptions *withDefault = [options withDefault:[self defaultOptions]];
+    if (@available(iOS 18.0, *)) {
+        [bottomTabs setTabBarVisible:[withDefault.bottomTabs.visible withDefault:YES]
+                            animated:NO];
+    }
     [bottomTabs setCurrentTabIndex:[withDefault.bottomTabs.currentTabIndex withDefault:0]];
     if (withDefault.bottomTabs.currentTabId.hasValue) {
         [bottomTabs setCurrentTabID:withDefault.bottomTabs.currentTabId.get];
@@ -24,7 +42,9 @@ - (void)applyOptions:(RNNNavigationOptions *)options {
     RNNNavigationOptions *withDefault = [options withDefault:[self defaultOptions]];
 
     [bottomTabs setTabBarTestID:[withDefault.bottomTabs.testID withDefault:nil]];
-    [bottomTabs setTabBarVisible:[withDefault.bottomTabs.visible withDefault:YES]];
+    [bottomTabs reconcileTabBarVisible:[withDefault.bottomTabs.visible withDefault:YES]
+                              animated:[self tabBarVisibilityAnimation:
+                                                 [withDefault.bottomTabs.animate withDefault:YES]]];
 
     [bottomTabs.view setBackgroundColor:[withDefault.layout.backgroundColor withDefault:nil]];
     [bottomTabs setTabBarHideShadow:[withDefault.bottomTabs.hideShadow withDefault:NO]];
@@ -74,12 +94,8 @@ - (void)mergeOptions:(RNNNavigationOptions *)mergeOptions
     }
 
     if (mergeOptions.bottomTabs.visible.hasValue) {
-        if (mergeOptions.bottomTabs.animate.hasValue) {
-            [bottomTabs setTabBarVisible:mergeOptions.bottomTabs.visible.get
-                                animated:[mergeOptions.bottomTabs.animate withDefault:NO]];
-        } else {
-            [bottomTabs setTabBarVisible:mergeOptions.bottomTabs.visible.get animated:NO];
-        }
+        [bottomTabs setTabBarVisible:mergeOptions.bottomTabs.visible.get
+                            animated:[withDefault.bottomTabs.animate withDefault:YES]];
     }
 
     if (mergeOptions.layout.backgroundColor.hasValue) {
```

**File**: `ios/RNNBottomTabsController.h` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@
 
 - (void)setTabBarVisible:(BOOL)visible;
 
+- (void)reconcileTabBarVisible:(BOOL)visible animated:(BOOL)animated;
+
 - (void)handleTabBarLongPress:(CGPoint)locationInTabBar;
 
 @end
```

---

### Incident Patch 2: `92e3bf13` (2026-07-30)
**Commit Message**: fix(customrow): only attach BottomTabs custom row to NavigationActivity (#8336)

BottomTabsCustomRowAttacher is a global Application.ActivityLifecycleCallbacks
that ran tryAttach()/findViewById() on every activity in the process. On a
foreign, non-AppCompat-themed activity (e.g. AppAuth RedirectUriReceiverActivity
during OAuth login) this forces AppCompat sub-decor inflation and crashes with
'You need to use a Theme.AppCompat theme'. Guard so the observer only touches
RNN's own NavigationActivity, where BottomTabs actually live.

Sentry: WIX-ONE-APP-9GFHV

Co-authored-by: Yedidya Kennard <yedidyak@wix.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `android/src/main/java/com/reactnativenavigation/customrow/BottomTabsCustomRowAttacher.kt` (modified, +9/-0)
```diff
@@ -9,6 +9,7 @@ import android.view.ViewGroup
 import android.view.ViewTreeObserver
 import android.view.WindowInsets
 import android.widget.FrameLayout
+import com.reactnativenavigation.NavigationActivity
 import com.reactnativenavigation.views.bottomtabs.BottomTabs
 
 /**
@@ -77,6 +78,13 @@ internal object BottomTabsCustomRowAttacher : Application.ActivityLifecycleCallb
     }
 
     private fun ensureLayoutObserver(activity: Activity) {
+        // BottomTabs only ever live inside RNN's own NavigationActivity (an
+        // AppCompatActivity). Touching any other activity — e.g. a third-party
+        // relay such as AppAuth's RedirectUriReceiverActivity, whose theme is not
+        // a Theme.AppCompat descendant — forces AppCompat sub-decor inflation and
+        // crashes with "You need to use a Theme.AppCompat theme". Guard here so the
+        // global lifecycle observer never operates on foreign activities.
+        if (activity !is NavigationActivity) return
         val decor = activity.window?.decorView as? ViewGroup ?: return
         if (decor.getTag(TAG_OBSERVING) == true) return
         decor.setTag(TAG_OBSERVING, true)
@@ -90,6 +98,7 @@ internal object BottomTabsCustomRowAttacher : Application.ActivityLifecycleCallb
     }
 
     private fun tryAttach(activity: Activity) {
+        if (activity !is NavigationActivity) return
         val scanRoot = activity.window?.decorView as? ViewGroup ?: return
         // Resolve through the view tree: AppCompatActivity.findViewById() forces
         // createSubDecor(), which throws unless the activity's theme is Theme.AppCompat.
```

---

### Incident Patch 3: `a563e9d7` (2026-07-30)
**Commit Message**: Fix crash attaching custom row to non-AppCompat activities (#8337)

BottomTabsCustomRowAttacher is registered process-wide, so tryAttach() runs
for every activity in the app. It called Activity.findViewById(), which on an
AppCompat activity routes through AppCompatDelegateImpl and forces
createSubDecor() -- that throws IllegalStateException unless the activity's
theme derives from Theme.AppCompat.

Any activity inheriting a non-AppCompat theme therefore crashed on creation.
Resolve android.R.id.content through the decor view instead, which never
engages AppCompatDelegate. Activity.findViewById() already delegates to
getWindow().getDecorView().findViewById(), so behaviour is unchanged for
activities that do have a compatible theme.

Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `android/src/main/java/com/reactnativenavigation/customrow/BottomTabsCustomRowAttacher.kt` (modified, +4/-4)
```diff
@@ -90,10 +90,10 @@ internal object BottomTabsCustomRowAttacher : Application.ActivityLifecycleCallb
     }
 
     private fun tryAttach(activity: Activity) {
-        val scanRoot = activity.window?.decorView as? ViewGroup
-            ?: activity.findViewById<View>(android.R.id.content) as? ViewGroup
-            ?: return
-        val overlayHost = activity.findViewById<View>(android.R.id.content) as? ViewGroup
+        val scanRoot = activity.window?.decorView as? ViewGroup ?: return
+        // Resolve through the view tree: AppCompatActivity.findViewById() forces
+        // createSubDecor(), which throws unless the activity's theme is Theme.AppCompat.
+        val overlayHost = scanRoot.findViewById<View>(android.R.id.content) as? ViewGroup
             ?: scanRoot
 
         forEachBottomTabs(scanRoot) { bottomTabs ->
```

---

### Incident Patch 4: `34ca8b5a` (2026-06-14)
**Commit Message**: android: size custom top-bar component buttons to content (Fabric collapse fix) (#8328)

* android: re-measure custom top bar button when async React content reports its size

On the New Architecture (Fabric), a custom React-component top bar button
without explicit width/height could collapse to ~1px. The hosted React
surface lays out asynchronously, off the native measure pass, so the first
onMeasure often observes a 0-sized child and freezes the button at the ~1px
floor with no subsequent re-measure.

Attach an OnLayoutChangeListener to the hosted child that re-requests layout
when the content's size changes (so onMeasure re-runs and sizes the button to
the content). The size-changed guard makes it converge once the button
matches the content. The explicit-dimensions check is done inside the listener
because onViewAdded fires from the superclass constructor (before `component`
is assigned) for the React surface view we need to observe.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

* chore: re-trigger CI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

* remove `require-label.yml` workflow (as Yogi suggested 😀)

* test: make collaps

**File**: `.github/workflows/require-label.yml` (removed, +0/-13)
```diff
@@ -1,13 +0,0 @@
-name: Enforce PR label
-
-on:
-  pull_request:
-    types: [labeled, unlabeled, opened, edited, synchronize]
-
-jobs:
-  enforce-label:
-    runs-on: ubuntu-latest
-    steps:
-    - uses: yogevbd/enforce-label-action@2.2.2
-      with:
-        REQUIRED_LABELS_ANY: "type: accepted/bug,type: accepted/enhancement,Infrastructure,type: documentation"
```

**File**: `android/src/main/java/com/reactnativenavigation/views/stack/topbar/titlebar/TitleBarReactButtonView.java` (modified, +14/-25)
```diff
@@ -18,7 +18,6 @@
 
 @SuppressLint("ViewConstructor")
 public class TitleBarReactButtonView extends ReactView {
-    private static final float FINAL_WIDTH_PADDING_DP = 1f;
     private final ComponentOptions component;
 
     public TitleBarReactButtonView(Context context, ComponentOptions component) {
@@ -45,46 +44,36 @@ protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
             this.setId(View.NO_ID);
         }
 
-        int initialWidthSpec = component.width.hasValue()
+        // Width: bounded (AT_MOST) so the hosted React surface sizes itself to its content. Under
+        // Fabric, ReactSurfaceView reports max-of-children under AT_MOST (the laid-out content width)
+        // and pushes that to the async layout. Crucially we must NOT push a forced EXACTLY *width*:
+        // before the content has laid out that width is collapsed (~1px), Fabric lays the content into
+        // it and the button never recovers (#8320/#8326 did this and regressed under the New Arch).
+        //
+        // Height: EXACTLY the available bar height. Giving the surface a filled height (rather than a
+        // content-hugging AT_MOST height) lets content that centers itself (e.g. a flex container with
+        // justifyContent: 'center') sit vertically centered in the bar, matching the legacy layout.
+        // It does not cause the width collapse — only a forced width does.
+        int widthSpec = component.width.hasValue()
                 ? createExactSpec(component.width)
                 : makeMeasureSpec(resolveAvailableWidth(widthMeasureSpec), AT_MOST);
-        int initialHeightSpec = createHeightSpec(heightMeasureSpec, component.height);
-
-        // First discover the content size without forcing every custom button to actionBarSize.
-        super.onMeasure(initialWidthSpec, initialHeightSpec);
-
-        if (component.width.hasValue() && component.height.hasValue()) {
-            return;
-        }
-
-        // Then give RN/Yoga a stable exact final box for compatibility with centered button layouts.
-        // A small allowance avoids clipping implicit RN padding/subpixel layout while staying content-based.
-        int finalWidth = component.width.hasValue()
-                ? MeasureSpec.getSize(initialWidthSpec)
-                : resolveFinalWidth(getMeasuredWidth());
-        int finalHeight = component.height.hasValue()
-                ? MeasureSpec.getSize(initialHeightSpec)
-                : Math.max(getMeasuredHeight(), 1);
-        super.onMeasure(makeMeasureSpec(finalWidth, EXACTLY), makeMeasureSpec(finalHeight, EXACTLY));
+        int heightSpec = createHeightSpec(heightMeasureSpec, component.height);
+        super.onMeasure(widthSpec, heightSpec);
     }
 
     private int createHeightSpec(int measureSpec, Number dimension) {
         if (dimension.hasValue()) {
             return createExactSpec(dimension);
         }
         int availableSize = MeasureSpec.getSize(measureSpec);
-        return makeMeasureSpec(availableSize > 0 ? availableSize : Math.max(resolveActionBarSize(), 1), AT_MOST);
+        return makeMeasureSpec(availableSize > 0 ? availableSize : Math.max(resolveActionBarSize(), 1), EXACTLY);
     }
 
     private int resolveAvailableWidth(int measureSpec) {
         int availableSize = MeasureSpec.getSize(measureSpec);
         return availableSize > 0 ? availableSize : Math.max(getResources().getDisplayMetrics().widthPixels, 1);
     }
 
-    private int resolveFinalWidth(int measuredContentWidth) {
-        return Math.max(measuredContentWidth + (int) Math.ceil(dpToPx(getContext(), FINAL_WIDTH_PADDING_DP)), 1);
-    }
-
     private int createExactSpec(Number dimension) {
         return makeMeasureSpec(MeasureSpec.getSize(dpToPx(getContext(), dimension.get())), EXACTLY);
     }
```

**File**: `android/src/test/java/com/reactnativenavigation/views/TitleBarReactButtonViewTest.java` (modified, +18/-41)
```diff
@@ -32,26 +32,28 @@ public class TitleBarReactButtonViewTest extends BaseTest {
     private static final int CHILD_WIDTH = 24;
     private static final int CHILD_HEIGHT = 16;
 
+    // Without explicit dimensions the button measures the hosted React surface ONCE:
+    //  - width  AT_MOST  → the surface sizes itself to its content (max-of-children under Fabric).
+    //  - height EXACTLY the available bar height → the surface gets a filled box so content that
+    //    centers itself (flex justifyContent: 'center') stays vertically centered in the bar.
+    // It deliberately does not push a forced EXACTLY *width*; under the New Architecture that re-pushes
+    // a (initially collapsed) width to the async Fabric layout and the button never recovers.
     @Test
-    public void missingDimensionsMeasureToContentThenRemeasureExactForStableAlignment() {
+    public void missingDimensionsSizeWidthToContentAndFillHeight() {
         Activity activity = newActivity();
         TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
         RecordingContentView child = new RecordingContentView(activity);
         setContentView(uut, child);
 
         uut.measure(makeMeasureSpec(PARENT_WIDTH, AT_MOST), makeMeasureSpec(PARENT_HEIGHT, AT_MOST));
 
-        assertThat(uut.getMeasuredWidth()).isEqualTo(finalWidth(activity));
-        assertThat(uut.getMeasuredHeight()).isEqualTo(CHILD_HEIGHT);
-        assertThat(child.widthMeasureSpecs.size()).isEqualTo(2);
+        assertThat(uut.getMeasuredWidth()).isEqualTo(CHILD_WIDTH);
+        assertThat(uut.getMeasuredHeight()).isEqualTo(PARENT_HEIGHT);
+        assertThat(child.widthMeasureSpecs.size()).isEqualTo(1);
         assertThat(getMode(child.widthMeasureSpecs.get(0))).isEqualTo(AT_MOST);
         assertThat(getSize(child.widthMeasureSpecs.get(0))).isEqualTo(PARENT_WIDTH);
-        assertThat(getMode(child.heightMeasureSpecs.get(0))).isEqualTo(AT_MOST);
+        assertThat(getMode(child.heightMeasureSpecs.get(0))).isEqualTo(EXACTLY);
         assertThat(getSize(child.heightMeasureSpecs.get(0))).isEqualTo(PARENT_HEIGHT);
-        assertThat(getMode(child.widthMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.widthMeasureSpecs.get(1))).isEqualTo(finalWidth(activity));
-        assertThat(getMode(child.heightMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.heightMeasureSpecs.get(1))).isEqualTo(CHILD_HEIGHT);
     }
 
     @Test
@@ -76,28 +78,24 @@ public void explicitDimensionsMeasureExactly() {
     }
 
     @Test
-    public void zeroParentSpecsFallbackToBoundedAtMostSpecs() {
+    public void zeroParentSpecsFallBackToScreenWidthAndActionBarHeight() {
         Activity activity = newActivity();
         TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
         RecordingContentView child = new RecordingContentView(activity);
         setContentView(uut, child);
 
         uut.measure(makeMeasureSpec(0, AT_MOST), makeMeasureSpec(0, AT_MOST));
 
-        assertThat(child.widthMeasureSpecs.size()).isEqualTo(2);
+        assertThat(child.widthMeasureSpecs.size()).isEqualTo(1);
         assertThat(getMode(child.widthMeasureSpecs.get(0))).isEqualTo(AT_MOST);
         assertThat(getSize(child.widthMeasureSpecs.get(0)))
                 .isEqualTo(Math.max(activity.getResources().getDisplayMetrics().widthPixels, 1));
-        assertThat(getMode(child.widthMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.widthMeasureSpecs.get(1))).isEqualTo(finalWidth(activity));
-        assertThat(getMode(child.heightMeasureSpecs.get(0))).isEqualTo(AT_MOST);
+        assertThat(getMode(child.heightMeasureSpecs.get(0))).isEqualTo(EXACTLY);
         assertThat(getSize(child.heightMeasureSpecs.get(0))).isEqualTo(Math.max(resolveActionBarSize(activity), 1));
-        assertThat(getMode(child.heightMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.heightMeasureSpe
```

---

### Incident Patch 5: `59086389` (2026-06-02)
**Commit Message**: android: fix custom top bar button measurement (#8320)

* android: fix custom top bar button measurement

* android: align custom button measurement snapshot

**File**: `android/src/main/java/com/reactnativenavigation/views/stack/topbar/titlebar/TitleBarReactButtonView.java` (modified, +27/-11)
```diff
@@ -5,11 +5,11 @@
 import android.util.TypedValue;
 import android.view.View;
 
-import com.facebook.react.ReactInstanceManager;
 import com.reactnativenavigation.options.ComponentOptions;
 import com.reactnativenavigation.options.params.Number;
 import com.reactnativenavigation.react.ReactView;
 
+import static android.view.View.MeasureSpec.AT_MOST;
 import static android.view.View.MeasureSpec.EXACTLY;
 import static android.view.View.MeasureSpec.makeMeasureSpec;
 import static com.reactnativenavigation.utils.UiUtils.dpToPx;
@@ -25,28 +25,44 @@ public TitleBarReactButtonView(Context context, ComponentOptions component) {
 
     @Override
     protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
-        
-        //This is a workaround, ReactNative throws exception when views have ids, On android MenuItems 
+        // This is a workaround, ReactNative throws exception when views have ids, On android MenuItems
         // With ActionViews like this got an id, see #7253
         if (!this.isAttachedToWindow()) {
             this.setId(View.NO_ID);
         }
 
-        super.onMeasure(createSpec(widthMeasureSpec, component.width), createSpec(heightMeasureSpec, component.height));
+        super.onMeasure(
+                createWidthSpec(widthMeasureSpec, component.width),
+                createHeightSpec(heightMeasureSpec, component.height)
+        );
     }
 
-    private int createSpec(int measureSpec, Number dimension) {
+    private int createWidthSpec(int measureSpec, Number dimension) {
+        return createSpec(measureSpec, dimension, Math.max(getResources().getDisplayMetrics().widthPixels, 1));
+    }
+
+    private int createHeightSpec(int measureSpec, Number dimension) {
+        if (dimension.hasValue()) {
+            return createExactSpec(dimension);
+        }
+        return makeMeasureSpec(Math.max(resolveActionBarSize(), 1), EXACTLY);
+    }
+
+    private int createSpec(int measureSpec, Number dimension, int fallbackSize) {
         if (dimension.hasValue()) {
-            return makeMeasureSpec(MeasureSpec.getSize(dpToPx(getContext(), dimension.get())), EXACTLY);
+            return createExactSpec(dimension);
         } else {
-            // When JS doesn't pass width/height, default to the theme's actionBarSize (48dp on Material).
-            // Yoga's intrinsic measurement of the React view collapses `paddingHorizontal` on the
-            // trailing edge in RTL (RN/Fabric measurement quirk), so we cannot trust UNSPECIFIED here -
-            // it produces a 0dp visible inset against the screen edge in RTL.
-            return makeMeasureSpec(resolveActionBarSize(), EXACTLY);
+            // Use bounded wrap-content width to avoid RN/Yoga RTL padding issues caused by
+            // UNSPECIFIED, without forcing every custom button to actionBarSize width.
+            int availableSize = MeasureSpec.getSize(measureSpec);
+            return makeMeasureSpec(availableSize > 0 ? availableSize : fallbackSize, AT_MOST);
         }
     }
 
+    private int createExactSpec(Number dimension) {
+        return makeMeasureSpec(MeasureSpec.getSize(dpToPx(getContext(), dimension.get())), EXACTLY);
+    }
+
     private int resolveActionBarSize() {
         TypedValue tv = new TypedValue();
         if (getContext().getTheme().resolveAttribute(android.R.attr.actionBarSize, tv, true)) {
```

**File**: `android/src/test/java/com/reactnativenavigation/views/TitleAndButtonsContainerTest.kt` (modified, +15/-1)
```diff
@@ -294,6 +294,20 @@ class TitleAndButtonsContainerTest : BaseTest() {
         assertThat(uut.getTitleComponent().right).isEqualTo(UUT_WIDTH - rightBarWidth - DEFAULT_LEFT_MARGIN_PX)
     }
 
+    @Test
+    fun `Component - title width shrinks by measured right buttons only`() {
+        val rightButtonsWidth = 48
+        setup(
+                rightBarWidth = rightButtonsWidth,
+                componentWidth = UUT_WIDTH,
+                alignment = Alignment.Default
+        )
+
+        idleMainLooper()
+        assertThat(uut.getTitleComponent().left).isEqualTo(DEFAULT_LEFT_MARGIN_PX)
+        assertThat(uut.getTitleComponent().right).isEqualTo(UUT_WIDTH - rightButtonsWidth - DEFAULT_LEFT_MARGIN_PX)
+    }
+
     @Test
     fun `Component - should place title between the toolbars`() {
         val leftBarWidth = 50
@@ -475,4 +489,4 @@ class TitleAndButtonsContainerTest : BaseTest() {
     }
 
     private fun getTitleSubtitleView() = (uut.getTitleComponent() as TitleSubTitleLayout)
-}
\ No newline at end of file
+}
```

**File**: `android/src/test/java/com/reactnativenavigation/views/TitleBarReactButtonViewTest.java` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+package com.reactnativenavigation.views;
+
+import static android.view.View.MeasureSpec.AT_MOST;
+import static android.view.View.MeasureSpec.EXACTLY;
+import static android.view.View.MeasureSpec.getMode;
+import static android.view.View.MeasureSpec.getSize;
+import static android.view.View.MeasureSpec.makeMeasureSpec;
+import static org.assertj.core.api.Java6Assertions.assertThat;
+
+import android.app.Activity;
+import android.util.TypedValue;
+import android.view.View;
+import android.view.ViewGroup;
+
+import com.reactnativenavigation.BaseTest;
+import com.reactnativenavigation.options.ComponentOptions;
+import com.reactnativenavigation.options.params.Number;
+import com.reactnativenavigation.options.params.Text;
+import com.reactnativenavigation.utils.UiUtils;
+import com.reactnativenavigation.views.stack.topbar.titlebar.TitleBarReactButtonView;
+
+import org.junit.Test;
+
+public class TitleBarReactButtonViewTest extends BaseTest {
+    private static final int PARENT_WIDTH = 200;
+    private static final int PARENT_HEIGHT = 100;
+    private static final int CHILD_WIDTH = 24;
+    private static final int CHILD_HEIGHT = 16;
+
+    @Test
+    public void missingDimensionsMeasureToContentWithinParentBounds() {
+        Activity activity = newActivity();
+        TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
+        uut.addView(new FixedSizeView(activity), new ViewGroup.LayoutParams(CHILD_WIDTH, CHILD_HEIGHT));
+
+        uut.measure(makeMeasureSpec(PARENT_WIDTH, AT_MOST), makeMeasureSpec(PARENT_HEIGHT, AT_MOST));
+
+        assertThat(uut.getMeasuredWidth()).isEqualTo(CHILD_WIDTH);
+        assertThat(uut.getMeasuredHeight()).isEqualTo(resolveActionBarSize(activity));
+    }
+
+    @Test
+    public void explicitDimensionsMeasureExactly() {
+        Activity activity = newActivity();
+        ComponentOptions component = new ComponentOptions();
+        component.width = new Number(72);
+        component.height = new Number(32);
+        TitleBarReactButtonView uut = createView(activity, component);
+        uut.addView(new FixedSizeView(activity), new ViewGroup.LayoutParams(CHILD_WIDTH, CHILD_HEIGHT));
+
+        uut.measure(makeMeasureSpec(PARENT_WIDTH, AT_MOST), makeMeasureSpec(PARENT_HEIGHT, AT_MOST));
+
+        assertThat(uut.getMeasuredWidth()).isEqualTo(UiUtils.dpToPx(activity, 72));
+        assertThat(uut.getMeasuredHeight()).isEqualTo(UiUtils.dpToPx(activity, 32));
+    }
+
+    @Test
+    public void zeroParentWidthFallbacksToBoundedAtMostSpecAndHeightUsesActionBarSize() {
+        Activity activity = newActivity();
+        TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
+        RecordingView child = new RecordingView(activity);
+        uut.addView(child, new ViewGroup.LayoutParams(
+                ViewGroup.LayoutParams.MATCH_PARENT,
+                ViewGroup.LayoutParams.MATCH_PARENT
+        ));
+
+        uut.measure(makeMeasureSpec(0, AT_MOST), makeMeasureSpec(0, AT_MOST));
+
+        assertThat(getMode(child.lastWidthMeasureSpec)).isEqualTo(AT_MOST);
+        assertThat(getSize(child.lastWidthMeasureSpec))
+                .isEqualTo(Math.max(activity.getResources().getDisplayMetrics().widthPixels, 1));
+        assertThat(getMode(child.lastHeightMeasureSpec)).isEqualTo(EXACTLY);
+        assertThat(getSize(child.lastHeightMeasureSpec)).isEqualTo(Math.max(resolveActionBarSize(activity), 1));
+    }
+
+    @Test
+    public void rtlMissingDimensionsUseBoundedSpecs() {
+        Activity activity = newActivity();
+        TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
+        RecordingView child = new RecordingView(activity);
+        uut.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
+        uut.addView(child, new ViewGroup.LayoutParams(
+                ViewGroup.LayoutParams.MATCH_PARENT,
+                ViewGroup.LayoutParams.MATCH_PARENT
+        ));
+
+        uut.measure(makeMeasureSpe
```

---

### Incident Patch 6: `8e2fb2f7` (2026-05-26)
**Commit Message**: android: fix system navigation bar overlay color (#8314)

**File**: `android/src/main/java/com/reactnativenavigation/utils/SystemUiUtils.kt` (modified, +17/-7)
```diff
@@ -79,7 +79,7 @@ object SystemUiUtils {
     @JvmStatic
     fun setupSystemBarBackgrounds(activity: Activity, contentLayout: ViewGroup) {
         setupStatusBarBackground(activity)
-        setupNavigationBarBackground(contentLayout)
+        setupNavigationBarBackground(activity.window, contentLayout)
     }
 
     private fun setupStatusBarBackground(activity: Activity) {
@@ -117,10 +117,10 @@ object SystemUiUtils {
         return view
     }
 
-    private fun setupNavigationBarBackground(contentLayout: ViewGroup) {
+    private fun setupNavigationBarBackground(window: Window?, contentLayout: ViewGroup) {
         if (navBarBackgroundView != null) return
         val view = View(contentLayout.context).apply {
-            setBackgroundColor(Color.BLACK)
+            setBackgroundColor(getNavigationBarBackgroundColor(window))
         }
         val params = FrameLayout.LayoutParams(
             FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM
@@ -134,7 +134,7 @@ object SystemUiUtils {
             val wasThreeButton = isThreeButtonNav
             isThreeButtonNav = tappableHeight > 0
             if (isThreeButtonNav != wasThreeButton) {
-                val color = lastExplicitNavBarColor ?: getDefaultNavBarColor()
+                val color = lastExplicitNavBarColor ?: getNavigationBarBackgroundColor(v)
                 v.setBackgroundColor(color)
             }
             val lp = v.layoutParams
@@ -147,6 +147,17 @@ object SystemUiUtils {
         view.requestApplyInsets()
     }
 
+    private fun getNavigationBarBackgroundColor(window: Window?): Int {
+        lastExplicitNavBarColor?.let { return it }
+        @Suppress("DEPRECATION")
+        return window?.navigationBarColor ?: getDefaultNavBarColor()
+    }
+
+    private fun getNavigationBarBackgroundColor(view: View): Int {
+        lastExplicitNavBarColor?.let { return it }
+        return (view.background as? ColorDrawable)?.color ?: getDefaultNavBarColor()
+    }
+
     /**
      * Returns the default navigation bar color, applying 80% opacity for 3-button navigation.
      * Gesture navigation gets a fully opaque color since the bar is minimal.
@@ -321,9 +332,8 @@ object SystemUiUtils {
         window?.let {
             WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = lightColor
         }
-        if (isEdgeToEdgeActive) {
-            navBarBackgroundView?.setBackgroundColor(color)
-        } else {
+        navBarBackgroundView?.setBackgroundColor(color)
+        if (!isEdgeToEdgeActive) {
             @Suppress("DEPRECATION")
             window?.navigationBarColor = color
         }
```

**File**: `android/src/test/java/com/reactnativenavigation/utils/SystemUiUtilsTest.kt` (modified, +64/-1)
```diff
@@ -1,16 +1,28 @@
 package com.reactnativenavigation.utils
 
 import android.graphics.Color
+import android.graphics.drawable.ColorDrawable
+import android.view.View
 import android.view.Window
+import android.widget.FrameLayout
+import androidx.appcompat.app.AppCompatActivity
 import com.reactnativenavigation.BaseRobolectricTest
 import com.reactnativenavigation.utils.SystemUiUtils.STATUS_BAR_HEIGHT_TRANSLUCENCY
+import org.assertj.core.api.Java6Assertions.assertThat
+import org.junit.After
 import org.junit.Test
 import org.mockito.Mockito
 import org.mockito.kotlin.verify
+import org.robolectric.Robolectric
 import kotlin.math.ceil
 
 class SystemUiUtilsTest : BaseRobolectricTest() {
 
+    @After
+    fun afterEach() {
+        SystemUiUtils.tearDown()
+    }
+
     @Test
     fun `setStatusBarColor - should change color considering alpha`() {
         val window = Mockito.mock(Window::class.java)
@@ -24,4 +36,55 @@ class SystemUiUtilsTest : BaseRobolectricTest() {
 
         verify(window).statusBarColor = Color.argb(ceil(STATUS_BAR_HEIGHT_TRANSLUCENCY*255).toInt(), 22, 255, 255)
     }
-}
\ No newline at end of file
+
+    @Test
+    fun `setupSystemBarBackgrounds - initializes navigation bar background from resolved color`() {
+        val activity = Robolectric.setupActivity(AppCompatActivity::class.java)
+        val contentLayout = FrameLayout(activity)
+        val initialColor = Color.RED
+        SystemUiUtils.setNavigationBarBackgroundColor(activity.window, initialColor, false)
+
+        SystemUiUtils.setupSystemBarBackgrounds(activity, contentLayout)
+
+        assertThat(getBackgroundColor(getNavigationBarBackground(contentLayout))).isEqualTo(initialColor)
+    }
+
+    @Test
+    fun `setNavigationBarBackgroundColor - updates view and window color when edge-to-edge is inactive`() {
+        val activity = Robolectric.setupActivity(AppCompatActivity::class.java)
+        val contentLayout = FrameLayout(activity)
+        @Suppress("DEPRECATION")
+        activity.window.navigationBarColor = Color.BLACK
+        SystemUiUtils.setupSystemBarBackgrounds(activity, contentLayout)
+
+        SystemUiUtils.setNavigationBarBackgroundColor(activity.window, Color.WHITE, true)
+
+        assertThat(getBackgroundColor(getNavigationBarBackground(contentLayout))).isEqualTo(Color.WHITE)
+        assertThat(activity.window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
+            .isEqualTo(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
+    }
+
+    @Test
+    fun `setNavigationBarBackgroundColor - updates view and icon appearance when edge-to-edge is active`() {
+        val activity = Robolectric.setupActivity(AppCompatActivity::class.java)
+        val contentLayout = FrameLayout(activity)
+        val initialColor = Color.RED
+        SystemUiUtils.setNavigationBarBackgroundColor(activity.window, initialColor, false)
+        SystemUiUtils.setupSystemBarBackgrounds(activity, contentLayout)
+        SystemUiUtils.activateEdgeToEdge()
+
+        SystemUiUtils.setNavigationBarBackgroundColor(activity.window, Color.WHITE, true)
+
+        assertThat(getBackgroundColor(getNavigationBarBackground(contentLayout))).isEqualTo(Color.WHITE)
+        assertThat(activity.window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
+            .isEqualTo(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
+    }
+
+    private fun getNavigationBarBackground(contentLayout: FrameLayout): View {
+        return contentLayout.getChildAt(contentLayout.childCount - 1)
+    }
+
+    private fun getBackgroundColor(view: View): Int {
+        return (view.background as ColorDrawable).color
+    }
+}
```

---

### Incident Patch 7: `48fca784` (2026-05-24)
**Commit Message**: fix for mis-alignment on iOS 26 (#8310)

**File**: `ios/RNNReactTitleView.mm` (modified, +26/-5)
```diff
@@ -1,5 +1,7 @@
 #import "RNNReactTitleView.h"
 
+static const CGFloat kTitleViewDefaultHeight = 44.0;
+
 @implementation RNNReactTitleView {
     BOOL _fillParent;
     CGFloat _expectedHeight;
@@ -11,19 +13,30 @@ - (NSString *)componentType {
 
 - (CGSize)intrinsicContentSize {
     if (_fillParent) {
-        return CGSizeMake(UILayoutFittingExpandedSize.width, _expectedHeight > 0 ? _expectedHeight : 44);
-    } else {
-        return [super intrinsicContentSize];
+        return CGSizeMake(UILayoutFittingExpandedSize.width,
+                          _expectedHeight > 0 ? _expectedHeight : kTitleViewDefaultHeight);
     }
+    return [super intrinsicContentSize];
+}
+
+- (CGSize)sizeThatFits:(CGSize)size {
+    if (_fillParent) {
+        return size;
+    }
+    return [super sizeThatFits:size];
 }
 
 - (void)setAlignment:(NSString *)alignment inFrame:(CGRect)frame {
     if ([alignment isEqualToString:@"fill"]) {
         _fillParent = YES;
-        _expectedHeight = frame.size.height;
-        self.translatesAutoresizingMaskIntoConstraints = NO;
+        _expectedHeight = frame.size.height > 0 ? frame.size.height : kTitleViewDefaultHeight;
+        self.frame = frame;
+        self.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleLeftMargin |
+                                UIViewAutoresizingFlexibleRightMargin | UIViewAutoresizingFlexibleHeight;
         self.sizeFlexibility = RCTRootViewSizeFlexibilityNone;
     } else {
+        _fillParent = NO;
+        self.autoresizingMask = UIViewAutoresizingNone;
         self.sizeFlexibility = RCTRootViewSizeFlexibilityWidthAndHeight;
         __weak RNNReactView *weakSelf = self;
         [self setRootViewDidChangeIntrinsicSize:^(CGSize intrinsicSize) {
@@ -32,6 +45,14 @@ - (void)setAlignment:(NSString *)alignment inFrame:(CGRect)frame {
     }
 }
 
+- (void)layoutSubviews {
+    [super layoutSubviews];
+    if (_fillParent && self.bounds.size.height > 0 && _expectedHeight != self.bounds.size.height) {
+        _expectedHeight = self.bounds.size.height;
+        [self invalidateIntrinsicContentSize];
+    }
+}
+
 - (void)setRootViewDidChangeIntrinsicSize:(void (^)(CGSize))rootViewDidChangeIntrinsicSize {
     _rootViewDidChangeIntrinsicSize = rootViewDidChangeIntrinsicSize;
     self.delegate = self;
```

**File**: `ios/TopBarTitlePresenter.mm` (modified, +16/-2)
```diff
@@ -83,12 +83,26 @@ - (void)setCustomNavigationTitleView:(RNNTopBarOptions *)options
                    reactViewReadyBlock:readyBlock];
         _customTitleView.backgroundColor = UIColor.clearColor;
         NSString *alignment = [options.title.component.alignment withDefault:@""];
-        [_customTitleView setAlignment:alignment
-                               inFrame:viewController.navigationController.navigationBar.frame];
+        UINavigationBar *navigationBar = viewController.navigationController.navigationBar;
+        CGRect barBounds = navigationBar.bounds;
+        [_customTitleView setAlignment:alignment inFrame:barBounds];
         [_customTitleView layoutIfNeeded];
 
         viewController.navigationItem.titleView = nil;
         viewController.navigationItem.titleView = _customTitleView;
+
+        __weak RNNReactTitleView *weakTitleView = _customTitleView;
+        __weak UIViewController *weakViewController = viewController;
+        dispatch_async(dispatch_get_main_queue(), ^{
+            UINavigationController *navigationController = weakViewController.navigationController;
+            if (!navigationController || !weakTitleView) {
+                return;
+            }
+            [weakTitleView setAlignment:alignment inFrame:navigationController.navigationBar.bounds];
+            weakViewController.navigationItem.titleView = weakTitleView;
+            [weakTitleView setNeedsLayout];
+            [weakTitleView layoutIfNeeded];
+        });
         [_customTitleView componentWillAppear];
         [_customTitleView componentDidAppear];
     } else {
```

**File**: `playground/src/screens/CustomTopBar.tsx` (modified, +2/-2)
```diff
@@ -25,10 +25,10 @@ export default class CustomTopBar extends React.Component<Props> {
 
 const styles = StyleSheet.create({
   container: {
-    alignSelf: 'baseline',
+    flex: 1,
+    justifyContent: 'center',
   },
   text: {
-    alignSelf: 'flex-start',
     color: 'black',
     fontSize: 16,
   },
```

**File**: `playground/src/screens/TopBarTitleTestScreen.tsx` (modified, +4/-4)
```diff
@@ -18,8 +18,8 @@ const {
 // TopBar title component WITH subtitle
 function TopBarWithSubtitle() {
     return (
-        <View style={{ flex: 1 }}>
-            <View style={{ flexDirection: 'row' }}>
+        <View style={{ flex: 1, justifyContent: 'center' }}>
+            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                 <View
                     testID={TOPBAR_TITLE_AVATAR}
                     style={{ alignSelf: 'center', marginRight: 20, width: 10, height: 10, backgroundColor: 'red' }}
@@ -38,8 +38,8 @@ function TopBarWithSubtitle() {
 // TopBar title component WITHOUT subtitle - this triggers the bug on Android
 function TopBarWithoutSubtitle() {
     return (
-        <View style={{ flex: 1 }}>
-            <View style={{ flexDirection: 'row' }}>
+        <View style={{ flex: 1, justifyContent: 'center' }}>
+            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                 <View
                     testID={TOPBAR_TITLE_AVATAR}
                     style={{ alignSelf: 'center', marginRight: 20, width: 10, height: 10, backgroundColor: 'red' }}
```

---

### Incident Patch 8: `a25439a9` (2026-05-18)
**Commit Message**: RTL fix for top bar icons (#8306)

**File**: `android/src/main/java/com/reactnativenavigation/views/stack/topbar/titlebar/TitleBarReactButtonView.java` (modified, +14/-2)
```diff
@@ -2,6 +2,7 @@
 
 import android.annotation.SuppressLint;
 import android.content.Context;
+import android.util.TypedValue;
 import android.view.View;
 
 import com.facebook.react.ReactInstanceManager;
@@ -10,7 +11,6 @@
 import com.reactnativenavigation.react.ReactView;
 
 import static android.view.View.MeasureSpec.EXACTLY;
-import static android.view.View.MeasureSpec.UNSPECIFIED;
 import static android.view.View.MeasureSpec.makeMeasureSpec;
 import static com.reactnativenavigation.utils.UiUtils.dpToPx;
 
@@ -39,7 +39,19 @@ private int createSpec(int measureSpec, Number dimension) {
         if (dimension.hasValue()) {
             return makeMeasureSpec(MeasureSpec.getSize(dpToPx(getContext(), dimension.get())), EXACTLY);
         } else {
-            return makeMeasureSpec(MeasureSpec.getSize(measureSpec), UNSPECIFIED);
+            // When JS doesn't pass width/height, default to the theme's actionBarSize (48dp on Material).
+            // Yoga's intrinsic measurement of the React view collapses `paddingHorizontal` on the
+            // trailing edge in RTL (RN/Fabric measurement quirk), so we cannot trust UNSPECIFIED here -
+            // it produces a 0dp visible inset against the screen edge in RTL.
+            return makeMeasureSpec(resolveActionBarSize(), EXACTLY);
         }
     }
+
+    private int resolveActionBarSize() {
+        TypedValue tv = new TypedValue();
+        if (getContext().getTheme().resolveAttribute(android.R.attr.actionBarSize, tv, true)) {
+            return TypedValue.complexToDimensionPixelSize(tv.data, getContext().getResources().getDisplayMetrics());
+        }
+        return (int) dpToPx(getContext(), 48f);
+    }
 }
```

---

### Incident Patch 9: `6e4ad628` (2026-05-17)
**Commit Message**: android test fix (#8305)

**File**: `playground/e2e/Buttons.test.js` (modified, +16/-8)
```diff
@@ -1,3 +1,4 @@
+import { Platform } from 'react-native';
 import Utils from './Utils';
 import TestIDs from '../src/testIDs';
 
@@ -22,14 +23,21 @@ describe('Buttons', () => {
   });
 
   it(':android: should not effect left buttons when hiding back button', async () => {
-    await elementById(TestIDs.TOGGLE_BACK).tap();
-    await expect(elementById(TestIDs.LEFT_BUTTON)).toBeVisible();
-    await expect(elementById(TestIDs.TEXTUAL_LEFT_BUTTON)).toBeVisible();
-    await expect(elementById(TestIDs.BACK_BUTTON)).toBeVisible();
-
-    await elementById(TestIDs.TOGGLE_BACK).tap();
-    await expect(elementById(TestIDs.LEFT_BUTTON)).toBeVisible();
-    await expect(elementById(TestIDs.TEXTUAL_LEFT_BUTTON)).toBeVisible();
+    // Jest mock runs with Platform.OS === 'ios'; this test asserts Android-only topBar behavior.
+    const platform = Platform.OS;
+    Platform.OS = 'android';
+    try {
+      await elementById(TestIDs.TOGGLE_BACK).tap();
+      await expect(elementById(TestIDs.LEFT_BUTTON)).toBeVisible();
+      await expect(elementById(TestIDs.TEXTUAL_LEFT_BUTTON)).toBeVisible();
+      await expect(elementById(TestIDs.BACK_BUTTON)).toBeVisible();
+
+      await elementById(TestIDs.TOGGLE_BACK).tap();
+      await expect(elementById(TestIDs.LEFT_BUTTON)).toBeVisible();
+      await expect(elementById(TestIDs.TEXTUAL_LEFT_BUTTON)).toBeVisible();
+    } finally {
+      Platform.OS = platform;
+    }
   });
   it('sets right buttons', async () => {
     await expect(elementById(TestIDs.BUTTON_ONE)).toBeVisible();
```

---

### Incident Patch 10: `889a74de` (2026-05-14)
**Commit Message**: buttons screen back button fix (#8303)

**File**: `playground/src/screens/ButtonsScreen.tsx` (modified, +17/-10)
```diff
@@ -1,5 +1,6 @@
 /* eslint-disable prettier/prettier */
 import React from 'react';
+import { Platform } from 'react-native';
 import { NavigationComponent, Options, OptionsTopBarButton } from 'react-native-navigation';
 import Root from '../components/Root';
 import Button from '../components/Button';
@@ -139,17 +140,23 @@ export default class ButtonOptions extends NavigationComponent {
     );
   }
 
-  toggleBack= ()=> {
+  toggleBack = () => {
     this.backButtonVisibile = !this.backButtonVisibile;
-    Navigation.mergeOptions(this.props.componentId,{
-      topBar:{
-        backButton:{
-          testID:BACK_BUTTON,
-          visible:this.backButtonVisibile
-        }
-      }
-    })
-  }
+    Navigation.mergeOptions(this.props.componentId, {
+      topBar: {
+        backButton: {
+          testID: BACK_BUTTON,
+          visible: this.backButtonVisibile,
+        },
+        // iOS: leftButtons replace the back chevron slot, so the back button
+        // can't render unless leftButtons are cleared. Android's back
+        // affordance is independent of leftButtons.
+        ...(Platform.OS === 'ios' && this.backButtonVisibile
+          ? { leftButtons: [] }
+          : {}),
+      },
+    });
+  };
 
   setRightButtons = () =>
     Navigation.mergeOptions(this, {
```

#### Recent Merged Pull Requests:
- **PR #8363** (2026-09-09): iOS: Fix bottom tabs visibility on iOS 18 (@guyca)
- **PR #8337** (2026-07-30): [BottomTabsCustomRow] Fix crash attaching custom row to non-AppCompat activities (@avithalker-wix)
- **PR #8336** (2026-07-30): fix(customrow): only attach BottomTabs custom row to NavigationActivity (@Yoavpagir)
- **PR #8333** (2026-06-23): playground: regenerate Android buttons navbar snapshot (@yedidyak)
- **PR #8332** (2026-06-23): android: restore vertical centering for content-hugging custom top-bar buttons (@Yoavpagir)
- **PR #8331** (2026-06-21): Update package.json version to 8.8.9 (@mobileoss)
- **PR #8328** (2026-06-14): android: size custom top-bar component buttons to content (Fabric collapse fix) (@israelko)
- **PR #8326** (2026-06-08): android: stabilize custom top bar button layout (@yedidyak)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
