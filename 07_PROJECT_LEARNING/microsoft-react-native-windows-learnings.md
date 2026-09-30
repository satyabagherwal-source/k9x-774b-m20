# Forensic Learning Record (Deep Inspection): microsoft/react-native-windows

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-react-native-windows-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/react-native-windows](https://github.com/microsoft/react-native-windows))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:42:31.887Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/react-native-windows`
- **Description**: A framework for building native Windows apps with React.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17349 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.ado/scripts/npmAddUser.js`
```
#!/usr/bin/env node
// @ts-check

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const username = process.argv[2];
const password = process.argv[3];
const email = process.argv[4];
const registry = process.argv[5];

if (!username) {
  console.error("Please specify username");
  process.exit(1);
}

if (!password) {
  console.error("Please specify password");
  process.exit(1);
}

if (!email) {
  console.error("Please specify email");
  process.exit(1);
}

const registryUrl = registry || "http://localhost:4873";

// First set the registry
console.log(`Setting npm registry to ${registryUrl}`);
const setRegistry = child_process.spawnSync('npm', ['config', 'set', 'registry', registryUrl], {
  stdio: 'inherit',
  shell: true
});

if (setRegistry.status !== 0) {
  console.error('Failed to set registry');
  process.exit(1);
}

// Create auth token for verdaccio
const authString = Buffer.from(`${username}:${password}`).toString('base64');
const registryPath = registryUrl.replace(/^https?:/, '');

// Set auth in npm config
console.log('Setting authentication...');
const setAuth = child_process.spawnSync('npm', ['config', 'set', `${registryPath}/:_auth`, authString], {
  stdio: 'inherit',
  shell: true
});

if (setAuth.status !== 0) {
  console.error('Failed to set auth');
  process.exit(1);
}

// Set email
const setEmail = child_process.spawnSync('npm', ['config', 'set', 'email', email], {
  stdio: 'inherit',
  shell: true
});

// Verify authentication
console.log('Verifying authentication...');
const whoami = child_process.spawnSync('npm', ['whoami', '--registry', registryUrl], {
  encoding: 'utf8',
  shell: true
});

if (whoami.status === 0 && whoami.stdout.trim()) {
  console.log(`Logged in as ${whoami.stdout.trim()} on ${registryUrl}`);
  process.exit(0);
} else {
  console.error('Authentication verification failed');
  if (whoami.stderr) console.error('Error:', whoami.stderr);
  process.exit(1);
}

```

### Core Architecture Module: `.ado/scripts/npmPack.js`
```
#!/usr/bin/env node
// @ts-check

/**
 * npmPack.js - Pack all non-private workspace packages to tgz files
 *
 * Usage:
 *   node npmPack.js [targetDir] [--clean] [--check-npm] [--registry <url>] [--no-pack]
 *
 * Arguments:
 *   targetDir    - Target directory for .tgz files (default: npm-pkgs in repo root)
 *   --clean      - Clean target directory if it's not empty
 *   --check-npm  - Check each package against a registry and remove already published ones
 *   --registry   - Registry to check against (default: the npm-configured registry)
 *   --no-pack    - Skip packing, only check and clean target folder
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { parseArgs } = require('util');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/** @type {boolean} */
let useColors = true;

/**
 * Colorize text if colors are enabled
 * @param {string} text - Text to colorize
 * @param {string} color - Color code from colors object
 * @returns {string} Colorized text
 */
function colorize(text, color) {
  if (!useColors) {
    return text;
  }
  return color + text + colors.reset;
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
npmPack.js - Pack all non-private workspace packages to tgz files

Usage:
  node npmPack.js [options] [targetDir]

Arguments:
  targetDir           Target directory for .tgz files
                      Default: npm-pkgs (in repository root)

Options:
  --clean             Clean target directory if it's not empty
  --check-npm         Check each package against a registry and remove already published ones
  --registry <url>    Registry to check against (default: the npm-configured registry)
  --no-pack           Skip packing, only check and clean target folder
  --no-color          Disable colored output
  --help, -h          Show this help message

Examples:
  node npmPack.js
  node npmPack.js --clean
  node npmPack.js --check-npm
  node npmPack.js --no-pack --check-npm
  node npmPack.js --no-pack --check-npm --registry https://example/npm/registry/ path/to/output
  node npmPack.js path/to/output
  node npmPack.js --clean --no-color path/to/output
`);
}

/**
 * Find the enlistment root by going up two directories from script location
 * @returns {string} Repository root path
 */
function findEnlistmentRoot() {
  const scriptDir = __dirname;
  const repoRoot = path.resolve(scriptDir, '..', '..');

  // Verify this is the repo root by checking for package.json
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Could not find package.json at ${packageJsonPath}`);
  }

  return repoRoot;
}

/**
 * Get workspace package paths from root package.json
 * @param {string} repoRoot - Repository root directory
 * @returns {string[]} Array of workspace patterns
 */
function getWorkspacePackages(repoRoot) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (!packageJson.workspaces || !packageJson.workspaces.packages) {
    throw new Error('No workspaces.packages found in root package.json');
  }

  return packageJson.workspaces.packages;
}

/**
 * Recursively find all package.json files in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} results - Accumulated results
 * @returns {string[]} Array of package.json file paths
 */
function findPackageJsonsRecursive(dir, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules directories
      if (entry.name === 'node_modules') {
        continue;
      }
      findPackageJsonsRecursive(fullPath, results);
    } else if (entry.isFile() && entry.name === 'package.json') {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Match a pattern against a path
 * Supports patterns like "packages/*" or "packages/@react-native-windows/*"
 * @param {string} pattern - Workspace pattern to match
 * @param {string} basePath - Base path to resolve pattern from
 * @returns {string[]} Array of matching package.json paths
 */
function matchPattern(pattern, basePath) {
  // Remove trailing /* if present
  const cleanPattern = pattern.replace(/\/\*$/, '');
  const patternPath = path.join(basePath, cleanPattern);

  const results = [];

  // Check if pattern ends with /*
  if (pattern.endsWith('/*')) {
    // Pattern like "packages/*" - find all direct subdirectories
    if (fs.existsSync(patternPath)) {
      const entries = fs.readdirSync(patternPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packageJsonPath = path.join(patternPath, entry.name, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            results.push(packageJsonPath);
          }
        }
      }
    }
  } else {
    // Exact path - check if package.json exists
    const packageJsonPath = path.join(patternPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      results.push(packageJsonPath);
    }
  }

  return results;
}

/**
 * Find all package.json files matching workspace patterns
 * @param {string} repoRoot - Repository root directory
 * @param {string[]} workspacePatterns - Array of workspace patterns
 * @returns {string[]} Array of package.json file paths
 */
function findWorkspacePackageJsons(repoRoot, workspacePatterns) {
  const packageJsonPaths = [];

  for (const pattern of workspacePatterns) {
    const matches = matchPattern(pattern, repoRoot);
    packageJsonPaths.push(...matches);
  }

  return packageJsonPaths;
}

/**
 * Check if a package is private
 * @param {string} packageJsonPath - Path to package.json file
 * @returns {boolean} True if package is private
 */
function isPrivatePackage(packageJsonPath) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.private === true;
}

/**
 * Check if a package version is already published to the target registry
 * @param {string} packageName - Name of the package
 * @param {string} version - Version to check
 * @param {string} [registry] - Registry to query (defaults to the npm-configured registry)
 * @returns {boolean} True if the package version is already published
 */
function isPublishedOnNpm(packageName, version, registry) {
  // Shell-free npm invocation (node + its CLI, values as argv) so a caller-controlled
  // registry/package/version can't inject; npm's Windows .cmd shim needs a shell otherwise.
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const args = [npmCli, 'view', `${packageName}@${version}`, 'version'];
  if (registry) {
    args.push('--registry', registry);
  }
  try {
    execFileSync(process.execPath, args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch (error) {
    // If npm view fails, the version doesn't exist
    return false;
  }
}

/**
 * Extract package name and version from a .tgz file by reading its package.json
 * @param {string} tgzPath - Full path to the .tgz file
 * @returns {{name: string, version: string, error?: string} | null} Package info or null if extraction fails
 */
function getPackageInfoFromTgz(tgzPath) {
  try {
    // Convert Windows path to Unix-style path for tar command
    // tar on Windows (via Git Bash) expects forward slashes
    const unixPath = tgzPath.replace(/\\/g, '/');

    // Use tar to extract package/package.json from the tarball
    // The -xzf extracts from gzipped ta
```

### Core Architecture Module: `.ado/scripts/setVersionEnvVars.js`
```
// @ts-check
const fs = require('fs');
const path = require('path');
const process = require('process');
const child_process = require('child_process');

const pkgJsonPath = path.resolve(__dirname, "../../vnext/package.json");
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

// Record commit number, so that additional build tasks can record that commit in the NuGet
const commitId = child_process.execSync(`git rev-list HEAD -n 1`).toString().trim();

const buildEnvironment = process.argv[2];
let isPr = buildEnvironment.endsWith("PullRequest");
let isCi = buildEnvironment === "Continuous"
if (!isPr && !isCi) {
  throw new Error("Must pass argument indicating if this is for a 'PullRequest' or 'Continuous");
}
const buildId = process.argv[3];
if (buildId == undefined) {
  throw new Error("Missing argument for the buildid")
}

// Optional: isReleaseBuild flag from CI setup detection step.
// When present, it is included in the VersionEnvVars artifact so the Release
// pipeline can read the authoritative release/developer classification without
// re-deriving it from commit messages.
const isReleaseBuild = process.argv[4] === 'True' ? 'True' : 'False';
if (process.argv[4] == null) {
  console.log("##[warning]isReleaseBuild argument not provided, defaulting to False");
}

let adoBuildVersion=pkgJson.version;
if (isPr) {
  adoBuildVersion += `.pr${buildId}`;
}

const versionSegments = pkgJson.version.split('.');

const versionEnvVars = {
  RNW_PKG_VERSION_STR: pkgJson.version,
  RNW_PKG_VERSION_MAJOR: versionSegments[0],
  RNW_PKG_VERSION_MINOR: versionSegments[1],
  RNW_PKG_VERSION_PATCH: versionSegments[2],
  npmVersion: pkgJson.version,
  publishCommitId: commitId,
  reactDevDependency: pkgJson.devDependencies['react'],
  reactNativeDevDependency: pkgJson.devDependencies['react-native'],
  npmDistTag: pkgJson?.beachball?.defaultNpmTag?.trim(),
  IsReleaseBuild: isReleaseBuild,
}

if (!versionEnvVars.npmDistTag) {
  throw new Error('defaultNpmTag is missing in vnext/package.json');
}

// Set the build number so the build in the publish pipeline and the release pipeline are named with the convenient version
// See: https://docs.microsoft.com/en-us/azure/devops/pipelines/scripts/logging-commands?view=azure-devops&tabs=bash#updatebuildnumber-override-the-automatically-generated-build-number
// CI builds include [Release] or [Dev] tag for at-a-glance identification in pipeline history.
let buildNumber = `RNW_${adoBuildVersion}`;
if (!isPr) {
  buildNumber += isReleaseBuild === 'True' ? ' [Release]' : ' [Dev]';
}
console.log(`##vso[build.updatebuildnumber]${buildNumber}`)

// Set env variable to allow VS to build dll with correct version information
console.log(`##vso[task.setvariable variable=RNW_PKG_VERSION_STR]${versionEnvVars.RNW_PKG_VERSION_STR}`);
console.log(`##vso[task.setvariable variable=RNW_PKG_VERSION_MAJOR]${versionEnvVars.RNW_PKG_VERSION_MAJOR}`);
console.log(`##vso[task.setvariable variable=RNW_PKG_VERSION_MINOR]${versionEnvVars.RNW_PKG_VERSION_MINOR}`);
console.log(`##vso[task.setvariable variable=RNW_PKG_VERSION_PATCH]${versionEnvVars.RNW_PKG_VERSION_PATCH}`);

// Set other version related variables used by CI
console.log(`##vso[task.setvariable variable=npmVersion]${versionEnvVars.npmVersion}`);
console.log(`##vso[task.setvariable variable=publishCommitId]${versionEnvVars.publishCommitId}`);
console.log(`##vso[task.setvariable variable=reactDevDependency]${versionEnvVars.reactDevDependency}`);
console.log(`##vso[task.setvariable variable=reactNativeDevDependency]${versionEnvVars.reactNativeDevDependency}`);
console.log(`##vso[task.setvariable variable=NpmDistTag]${versionEnvVars.npmDistTag}`);
console.log(`##vso[task.setvariable variable=IsReleaseBuild]${versionEnvVars.IsReleaseBuild}`);

const runnerTemp = process.env.RUNNER_TEMP;
if (!runnerTemp) {
  throw new Error('RUNNER_TEMP environment variable is not set');
}

const dirPath = path.resolve(runnerTemp, 'versionEnvVars');
fs.mkdirSync(dirPath, {recursive: true});

fs.writeFileSync(path.resolve(dirPath, 'versionEnvVars.js'),
`
console.log("##vso[task.setvariable variable=RNW_PKG_VERSION_STR]${versionEnvVars.RNW_PKG_VERSION_STR}");
console.log("##vso[task.setvariable variable=RNW_PKG_VERSION_MAJOR]${versionEnvVars.RNW_PKG_VERSION_MAJOR}");
console.log("##vso[task.setvariable variable=RNW_PKG_VERSION_MINOR]${versionEnvVars.RNW_PKG_VERSION_MINOR}");
console.log("##vso[task.setvariable variable=RNW_PKG_VERSION_PATCH]${versionEnvVars.RNW_PKG_VERSION_PATCH}");
console.log("##vso[task.setvariable variable=npmVersion]${versionEnvVars.npmVersion}");
console.log("##vso[task.setvariable variable=publishCommitId]${versionEnvVars.publishCommitId}");
console.log("##vso[task.setvariable variable=reactDevDependency]${versionEnvVars.reactDevDependency}");
console.log("##vso[task.setvariable variable=reactNativeDevDependency]${versionEnvVars.reactNativeDevDependency}");
console.log("##vso[task.setvariable variable=NpmDistTag]${versionEnvVars.npmDistTag}");
console.log("##vso[task.setvariable variable=IsReleaseBuild]${versionEnvVars.IsReleaseBuild}");
`);

```

### Core Architecture Module: `.ado/scripts/waitForVerdaccio.js`
```
#!/usr/bin/env node
// @ts-check

const http = require('http');

function queryForServerStatus() {

  http.get('http://localhost:4873', res => {
    console.log(`Server status: ${res.statusCode}`);
    if (res.statusCode != 200) {
      setTimeout(queryForServerStatus, 2000);
    }
  }).on('error', err => {
    console.log(err.message);
    setTimeout(queryForServerStatus, 2000);
  });
}

console.log('Waiting for verdaccio instance to respond...');

queryForServerStatus();

```

### Core Architecture Module: `.ado/verdaccio/generate-config.js`
```
// Verdaccio's JavaScript config support is deprecated, so emit YAML instead.
const fs = require('node:fs');
const path = require('node:path');

const AUTHENTICATED_FEED_URL =
  'https://pkgs.dev.azure.com/ms/react-native/_packaging/react-native-public/npm/registry/';
const ANONYMOUS_FEED_URL = 'https://packagefeedproxy.microsoft.io/npm/';
const TOKEN_ENV = 'RNW_NPM_FEED_TOKEN';
const feedUrl = process.env[TOKEN_ENV]
  ? AUTHENTICATED_FEED_URL
  : ANONYMOUS_FEED_URL;

const lines = [
  'storage: ./storage',
  'auth:',
  '  htpasswd:',
  '    file: ./htpasswd',
  'uplinks:',
  '  npmFeed:',
  `    url: ${feedUrl}`,
  '    max_fails: 40',
  '    maxage: 30m',
  '    timeout: 60s',
  '    fail_timeout: 10m',
  '    cache: false',
  '    agent_options:',
  '      keepAlive: true',
  '      maxSockets: 40',
  '      maxFreeSockets: 10',
];

// Unauthenticated reads only resolve packages the feed has already cached.
if (process.env[TOKEN_ENV]) {
  lines.push('    auth:', '      type: bearer', `      token_env: ${TOKEN_ENV}`);
}

// Without a feed token the uplink liveness check fails, so publish local packages regardless of uplink state.
lines.push('publish:', '  allow_offline: true');

lines.push(
  'packages:',
  "  '@*/*':",
  '    access: $all',
  '    publish: $all',
  '    proxy: npmFeed',
  "  '**':",
  '    access: $all',
  '    publish: $all',
  '    proxy: npmFeed',
  'logs:',
  '  - {type: file, path: verdaccio.log, format: pretty, level: debug}',
);

const outputPath = path.join(__dirname, 'config.generated.yaml');
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);

console.log(
  `Wrote ${outputPath} (feed authentication ${process.env[TOKEN_ENV] ? 'enabled' : 'disabled'}, uplink ${feedUrl})`,
);

```

### Core Architecture Module: `beachball.config.js`
```
module.exports = require("@rnw-scripts/beachball-config");

```

### Core Architecture Module: `jest.config.js`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 * @format
 * @ts-check
 */

console.error(
  "\x1b[31mThe react-native-windows-repo doesn't support running jest directly from its root. Please run 'yarn test' instead.\x1b[0m",
);

// Jest should support running across multiple-projects, but doesn't seem to
// fully respect their configs when doing so. Don't run any tests if someone
// tries to run Jest from the repo root (e.g. using the VS code with the Jest
// extension opened to the repo root).
module.exports = {
  roots: [],
};

```

### Core Architecture Module: `lage.config.js`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 * @format
 */

module.exports = {
  pipeline: {
    build: ["^build"],
    lint: ["build"],
    'lint:fix': [],
    test: ["build"],
    format: [],
    'format:verify': [],
    clean: [],
  },
  cacheOptions: {
    outputGlob: [
      'js/**',
      "lib/**",
      "lib-commonjs/**",
    ],
  }
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16141** (2026-07-08): **TextInput renders text outside of text field for certain scales**
  *Symptoms*: ### Problem Description  At certain display scales (reproducible at 100%), the `<TextInput/>` component renders text outside the boundaries of the text field. When typing into the TextInput, the entered text overflows and appears outside the input container rather than being properly contained within it.  ### Steps To Reproduce  This issue is reproducible consistently at the affected display scale (in my testing at 100% scale). Simply rendering a multiline TextInput and typing any text will cause the text to appear outside the field boundaries. ``` import { View, StyleSheet } from 'react-native'; import { TextInput } from 'react-native-windows';  export const ReproExample = () => {     return (         <View style={styles.container}>             <TextInput                 style={styles.textInput}                 placeholder="Type here..." ```  In the following `<TextInput/>` I just wrote "This is a test" and the text was renderer outside of the text field.  <img width="210" height="113" alt="Image" src="https://github.com/user-attachments/assets/02d1a173-eac0-4e9d-9335-5c98a37f7e31" />  ### Expected Results  _No response_  ### CLI version  20.0.0  ### Environment  ```markdown info Fetching system and libraries information... System:   OS: Windows 11 10.0.26100   CPU: (12) x64 13th Gen Intel(R) Core(TM) i7-1365U   Memory: 5.44 GB / 31.64 GB Binaries:   Node:     version: 22.13.0     path: C:\nvm4w\nodejs\node.exe   Yarn:     version: 1.22.22     path: C:\Program Files (x86)\Ya
  **Post-Mortem & Fix Analysis**:
  > I have seen this intermittently when switching monitors. It seems to happen when building the app on a display with 150% scale then moving the app to a display with 100% scale. Sometimes the text will be completely invisible, although the text cursor is still visible.  OS: windows 11 24H2 26100.8246 react: 19.2.5 react-native: 0.81.6 react-native-windows: 0.81.15
  > Confirmed this exists in 0.81.28 also. Seems to be reproducible with laptop monitor at 175% and second monitor at 100% scaling.  - Launch app on main screen scaled at 175% with TextInput hidden with a button - Drag app to second monitor at 100% scaling - Make TextInput visible, text in box is not visible.
  > @acoates-ms  Also exists in 0.83, reproduced in a clean minimal project.

- **Issue #16085** (2026-05-20): **Release builds fail on ARM Windows**
  *Symptoms*: ### Problem Description  A follow-up to #16084.  Even if I override the msbuild build props to use x64 Hermes on ARM Windows instead of x86 Hermes (by adding this build prop that sets `release\x64\hermes.exe`):  ```xml <HermesCompilerCommand Condition="'$(HermesCompilerCommand)' == ''">$(HermesPackage)\tools\native\release\x64\hermes.exe</HermesCompilerCommand> ```  ... the build still fails:  ```  √ Found Solution: C:\Users\jamie\Downloads\MyApp123\windows\MyApp123.sln  i Build configuration: Release  i Build platform: ARM64  × Building Solution: C:\Users\jamie\Downloads\MyApp123\node_modules\react-native-windows\PropertySheets\Bundle.C...  × Build failed with message C:\Users\jamie\Downloads\MyApp123\node_modules\react-native-windows\PropertySheets\Bundle.Common.targets(22,5): error MSB3075: ???? "C:\Users\jamie\.nuget\packages\microsoft.javascript.hermes\0.0.0-2511.7001-d7ca19b3\tools\native\release\x64\hermes.exe -emit-binary -out "C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\Bundle\index.windows.bundle.hbc" "C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\Bundle\index.windows.bundle" -O -output-source-map" ???? 5 ???????????????????????????????????????? [C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\MyApp123.vcxproj]. Check your build configuration.  × It is possible your installation is missing required software dependencies. Dependencies can be automatically installed by running C:\Users\jamie\Downloads\MyApp123\node_modules\react-native-windows\scripts\r
  **Post-Mortem & Fix Analysis**:
  > @shirakaba - I think this is caused by issues in your template.  Instead of changing   settings.JavaScriptBundleFile(L".expo/.virtual-metro-entry"); you should set settings.DebugBundlePath(L".expo/.virtual-metro-entry");  And inside your vcxproj you should add <BundleEntryFile>index.ts</BundleEntryFile>  Basically, it's actually the bundle command before the hermes bytecode command that is failing.  I also hit an issue where metro wasn't being told windows was a platform, so had to add: config.resolver.platforms.push("windows"); Not sure if thats something that the expo config breaks... I didn't look into it too much.
  > @acoates-ms Thanks for catching this!  # `ReactNativeHost` instance settings  My template is derived from the [cpp-app](https://github.com/microsoft/react-native-windows/blob/main/vnext/templates/cpp-app/windows/MyApp/MyApp.cpp#L53).  Currently I'm making this change:  ```diff   #if BUNDLE     // Load the JS bundle from a file (not Metro):     // Set the path (on disk) where the .bundle file is located     settings.BundleRootPath(std::wstring(L"file://").append(appDirectory).append(L"\\Bundle\\").c_str());     // Set the name of the bundle file (without the .bundle extension)     settings.JavaScriptBundleFile(L"index.windows");     // Disable hot reload     settings.UseFastRefresh(false);   #else     // Load the JS bundle from Metro -   settings.JavaScriptBundleFile(L"index"); +   settings.JavaScriptBundleFile(L".expo/.virtual-metro-entry");     // Enable hot reload     settings.UseFastRefresh(true);   #endif ```  Are you suggesting that I make this change instead:  ```diff   #if BUNDL
  > > I assumed that "macos" and "windows" would be in any Metro config from `@rnx-kit/metro-config` by default. I swear I've been able to resolve `.windows.js` and `.macos.js` files just fine without that change in the past, though. CC [@tido64](https://github.com/tido64)  If you have a repro, hmu on Discord and I'll take a look.

- **Issue #16060** (2026-05-27): **accessibilityState={{ selected }} is crashing the app**
  *Symptoms*: ### Problem Description  The app is crashing for any component using `accessibilityState={{ selected }}`. While dev testing some changes, we noticed the app crashes when Narrator is active and when we navigate to these elements using Tab.  Looks like this was introduced by RNW (https://github.com/microsoft/react-native-windows/pull/14019)  shipped in 0.81.3+,  I believe. Narrator queries SelectionItemPattern and hits a null pointer in RNW's `get_SelectionContainer()`.  We managed to avoid the crash by setting the state to checked, but it provides wrong accessibility information.  ### Steps To Reproduce  1. Make sure you have an interactive element with `accessibilityState={{ selected }}` 2. Enable the screen reader Narrator 3. Navigate to this component 4. App should crash  ### Expected Results  Narrator should read the element with the correct selected state and the app shouldn't crash.  ### CLI version  20.0.0  ### Environment  ```markdown System:   OS: Windows 11 10.0.26100   CPU: (16) x64 Intel(R) Core(TM) Ultra 7 265H   Memory: 31.73 GB / 63.43 GB Binaries:   Node:     version: 22.22.0     path: C:\Program Files\nodejs\node.exe   Yarn:     version: 1.22.22     path: C:\Program Files (x86)\Yarn\bin\yarn.CMD   npm:     version: 10.9.4     path: C:\Program Files\nodejs\npm.CMD   Watchman: Not Found SDKs:   Android SDK: Not Found   Windows SDK:     AllowDevelopmentWithoutDevLicense: Enabled     AllowAllTrustedApps: Enabled     Versions:       - 10.0.19041.0       - 10.0.2262
  **Post-Mortem & Fix Analysis**:
  > the issue has been resolved

- **Issue #16047** (2026-05-05): **Scrolling Views not working with touch screen devices**
  *Symptoms*: ### Problem Description  When using a ScrollView, FlatList or VirtualizedList on a touch screen device if you have pressables or touchableOpacities inside after you scroll the view it seems to keep where you started scrolling pressed.  After this point other buttons no longer press normally and pressing in spots can trigger the button that was under your finger when you scrolled the view. Clicking buttons with a mouse still does work but when you click or press outside of buttons it triggers a press at where the scroll started  While this is happening I am also getting an error about touch identifier being greater then expected not sure if this is relevant  ### Steps To Reproduce  1. Using the [Scroll View Snap Sample](https://github.com/microsoft/react-native-windows/blob/main/packages/playground/Samples/scrollViewSnapSample.tsx) from the Playground repo 2. Scroll the component 3. Attempt to press the buttons inside of the view  https://github.com/user-attachments/assets/876fe052-fe07-454b-bc0f-b6e3ea04d315   ### Expected Results  Scroll should work and then afterwards buttons should still be pressable  ### CLI version  20.0.0  ### Environment  ```markdown System:   OS: Windows 11 10.0.26200   CPU: (20) x64 13th Gen Intel(R) Core(TM) i7-13800H   Memory: 34.63 GB / 63.83 GB Binaries:   Node:     version: 22.20.0     path: C:\nvm4w\nodejs\node.EXE   Yarn:     version: 1.22.22     path: C:\Program Files (x86)\Yarn\bin\yarn.CMD   npm:     version: 10.9.3     path: C:\nvm4w\nodej
  **Post-Mortem & Fix Analysis**:
  > I've seen that same issue. Try after https://github.com/microsoft/react-native-windows/pull/16048 gets backported to your version
  > > I've seen that same issue. Try after [#16048](https://github.com/microsoft/react-native-windows/pull/16048) gets backported to your version  Tested this on `0.84.0-preview.6` and still seeing this issue so don't believe those changes fix this
  > @Ben-Nipp Confirmed, i'm seeing this in my app as well 

- **Issue #15999** (2026-04-30): **SectionList scrollbar not visible without getItemLayout prop**
  *Symptoms*: ### Problem Description  When using a `SectionList` component without the `getItemLayout` prop (i.e., with dynamic/variable height items), the vertical scrollbar does not render at all. The list content is still scrollable via mouse wheel, but no scrollbar indicator is visible.  When `getItemLayout` is provided (even with an inaccurate estimated fixed height), the scrollbar appears. However, providing getItemLayout with a fixed height is not suitable for all use cases of React Native Windows.  My understanding is that the `SectionList` should display a scrollbar when content overflows, regardless of whether `getItemLayout` is provided.  ### Steps To Reproduce  1. Create a `SectionList` with multiple sections and enough items to overflow the container, using variable-height items (no `getItemLayout` prop):      ```tsx     <SectionList         sections={sections}         keyExtractor={(item) => item.id}         renderItem={({ item }) => <VariableHeightItem item={item} />}         renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}     />     ```  2. Run the app 3. Observe that the list content is scrollable (mouse wheel / touch), but no scrollbar is visible. 4. Now add a `getItemLayout` prop with any fixed height estimate:      ```tsx     <SectionList         sections={sections}         keyExtractor={(item) => item.id}         renderItem={({ item }) => <VariableHeightItem item={item} />}         renderSectionHeader={({ section }) => <SectionHeader tit
  **Post-Mortem & Fix Analysis**:
  > I have tried reproducing this issue in RNW 0.81.13 , but I could not reproduce it. I have attached my jsx here for reference.  Please have a look and let me know if I am missing something.  https://github.com/user-attachments/assets/ab1e5a47-8928-451d-9d3a-f62a17b21b5f  [App.tsx.txt](https://github.com/user-attachments/files/26771923/App.tsx.txt)
  > This issue has been automatically marked as stale because it has been marked as requiring author feedback but has not had any activity for **7 days**. It will be closed if no further activity occurs **within 7 days of this comment**. <!-- Policy app identification https://img.shields.io/static/v1?label=PullRequestIssueManagement. -->

- **Issue #15927** (2026-07-16): **0.84 Release Status**
  *Symptoms*: ### Problem Description    ### Summary   0.84 Release Status   [https://github.com/facebook/react-native/tree/0.84-stable](https://github.com/facebook/react-native/tree/0.84-stable)    ## Checklist    ### **Month before Preview** - [x] Check that the [CI pipeline](https://dev.azure.com/ms/react-native-windows/_build?definitionId=468&branchFilter=46671%2C46671) is passing on main. If it's not, file github issues to resolve as you will need them to pass for the PR pipeline for the stable branch. (**@protikbiswas100**)    ---  ### **Before Preview** - [x] Draft GitHub release notes from commit log (**@protikbiswas100**)   - [x] Promote canary build to preview using [wiki instructions](https://github.com/microsoft/react-native-windows/wiki/How-to-promote-a-release) (**@protikbiswas100**)   - [x] Push build to stable branch (**@protikbiswas100**)   - [x] Enable CI schedule for new branch of [CI pipeline](https://dev.azure.com/ms/react-native-windows/_apps/hub/ms.vss-ciworkflow.build-ci-hub?_a=edit-build-definition&id=468&view=Tab_Triggers) (**@protikbiswas100**)   - [x] Update [dashboard @ms](https://dev.azure.com/ms/react-native-windows/_dashboards/dashboard/28deb05d-f5bb-43e6-8aa9-36ad5e5476fb) with an entry for `CI ${version}` (**@protikbiswas100**)   - [x] Add release schedule for the new stable branch of [publish pipeline](https://dev.azure.com/microsoft/ReactNative/_apps/hub/ms.vss-ciworkflow.build-ci-hub?_a=edit-build-definition&id=63081&view=Tab_Triggers) (**@protikbiswas1
  **Post-Mortem & Fix Analysis**:
  > Any updates on this?

- **Issue #15851** (2026-03-27): **Cherry pick button property in 0.83**
  *Symptoms*: cherry pick in 0.83 https://github.com/microsoft/react-native-windows/pull/15819
  **Post-Mortem & Fix Analysis**:
  > @protikbiswas100 once the build is stable we need to cherry pick these changes
  > PR merged

- **Issue #15829** (2026-03-23): **📦 Bump sanitize-filename from 1.6.3 to 1.6.4**
  *Symptoms*: Bumps [sanitize-filename](https://github.com/parshap/node-sanitize-filename) from 1.6.3 to 1.6.4. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/parshap/node-sanitize-filename/commit/6e5155272a856e32b6a89b116bf2dfbbb637d38c"><code>6e51552</code></a> 1.6.4</li> <li><a href="https://github.com/parshap/node-sanitize-filename/commit/9848644ef690ae1aa08b2af80072bf391691bea1"><code>9848644</code></a> Do not use vulnerable regex</li> <li><a href="https://github.com/parshap/node-sanitize-filename/commit/209c39b914c8eb48ee27bcbde64b2c7822fdf3de"><code>209c39b</code></a> Bump brace-expansion from 1.1.6 to 1.1.11 (<a href="https://redirect.github.com/parshap/node-sanitize-filename/issues/54">#54</a>)</li> <li>See full diff in <a href="https://github.com/parshap/node-sanitize-filename/compare/v1.6.3...v1.6.4">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=sanitize-filename&package-manager=npm_and_yarn&previous-version=1.6.3&new-version=1.6.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot co
  **Post-Mortem & Fix Analysis**:
  > /azp run PR
  > <samp> Azure Pipelines successfully started running 1 pipeline(s).<br>  </samp>

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

### Incident Patch 1: `42e7afc4` (2026-09-10)
**Commit Message**:  Fix inactive Modal title bar contrast (#16434)

* Change files

* Fix inactive Modal title bar contrast

Use theme-aware AppWindowTitleBar colors for active and inactive Modal caption states while preserving true window activation and runtime theme updates.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

Copilot-Session: 8f4dac7d-4a14-4053-bd3b-a7cda2967006

---------

Co-authored-by: Anukrati Agrawal <anuagra@microsoft.com>
Copilot-Session: 8f4dac7d-4a14-4053-bd3b-a7cda2967006

**File**: `change/react-native-windows-580ee5e2-c630-4ce8-a1a3-14ee5a18a571.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix Modal title bar contrast when the native window is inactive",
+  "packageName": "react-native-windows",
+  "email": "anuagra@microsoft.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/Modal/WindowsModalHostViewComponentView.cpp` (modified, +107/-0)
```diff
@@ -15,6 +15,22 @@
 
 namespace winrt::Microsoft::ReactNative::Composition::implementation {
 
+static winrt::Windows::UI::Color CompositeOverOpaqueBackground(
+    const winrt::Windows::UI::Color &foreground,
+    const winrt::Windows::UI::Color &background) noexcept {
+  const uint32_t alpha = foreground.A;
+  const uint32_t inverseAlpha = 0xFF - alpha;
+  const auto compositeChannel = [alpha, inverseAlpha](uint8_t foregroundChannel, uint8_t backgroundChannel) {
+    return static_cast<uint8_t>((foregroundChannel * alpha + backgroundChannel * inverseAlpha + 0x7F) / 0xFF);
+  };
+
+  return {
+      0xFF,
+      compositeChannel(foreground.R, background.R),
+      compositeChannel(foreground.G, background.G),
+      compositeChannel(foreground.B, background.B)};
+}
+
 struct ModalHostState
     : winrt::implements<ModalHostState, winrt::Microsoft::ReactNative::Composition::IPortalStateData> {
   ModalHostState(winrt::Microsoft::ReactNative::LayoutConstraints layoutConstraints, float scaleFactor)
@@ -36,6 +52,8 @@ struct ModalHostState
 struct ModalHostView : public winrt::implements<ModalHostView, winrt::Windows::Foundation::IInspectable>,
                        ::Microsoft::ReactNativeSpecs::BaseModalHostView<ModalHostView> {
   ~ModalHostView() {
+    UnsubscribeFromThemeChanges();
+
     if (m_popUp) {
       // Unregister closing event handler
       if (m_appWindowClosingToken) {
@@ -171,16 +189,55 @@ struct ModalHostView : public winrt::implements<ModalHostView, winrt::Windows::F
 
  private:
   void OnMounted(const winrt::Microsoft::ReactNative::ComponentView &view) noexcept {
+    SubscribeToThemeChanges(view);
     m_mounted = true;
     if (m_visible) {
       QueueShow(view);
     }
   }
 
   void OnUnmounted(const winrt::Microsoft::ReactNative::ComponentView & /*view*/) noexcept {
+    UnsubscribeFromThemeChanges();
     m_mounted = false;
   }
 
+  void SubscribeToThemeChanges(const winrt::Microsoft::ReactNative::ComponentView &view) noexcept {
+    UnsubscribeFromThemeChanges();
+
+    auto themeSource = view.Parent().as<winrt::Microsoft::ReactNative::Composition::ComponentView>();
+    m_themeSource = winrt::make_weak(themeSource);
+    m_theme = themeSource.Theme();
+    const auto themeSubscriptionGeneration = m_themeSubscriptionGeneration;
+    m_themeChangedToken = themeSource.ThemeChanged([wkThis = get_weak(), themeSubscriptionGeneration](
+                                                       const winrt::Windows::Foundation::IInspectable &sender,
+                                                       const winrt::Windows::Foundation::IInspectable & /*args*/) {
+      auto theme = sender.as<winrt::Microsoft::ReactNative::Composition::ComponentView>().Theme();
+      if (auto strongThis = wkThis.get()) {
+        strongThis->m_reactContext.UIDispatcher().Post([wkThis, theme, themeSubscriptionGeneration]() {
+          if (auto strongThis = wkThis.get()) {
+            if (strongThis->m_themeSubscriptionGeneration != themeSubscriptionGeneration) {
+              return;
+            }
+            strongThis->m_theme = theme;
+            strongThis->UpdateTitleBarColors();
+          }
+        });
+      }
+    });
+  }
+
+  void UnsubscribeFromThemeChanges() noexcept {
+    if (m_themeChangedToken) {
+      if (auto themeSource = m_themeSource.get()) {
+        themeSource.ThemeChanged(m_themeChangedToken);
+      }
+      m_themeChangedToken = {};
+    }
+    m_themeSource = {};
+    m_theme = nullptr;
+    ++m_themeSubscriptionGeneration;
+  }
+
   void AdjustWindowSize(const winrt::Microsoft::ReactNative::LayoutMetrics &layoutMetrics) noexcept {
     if (!m_rnWindow) {
       return;
@@ -318,6 +375,52 @@ struct ModalHostView : public winrt::implements<ModalHostView, winrt::Windows::F
 
       titleBar.IconShowOptions(winrt::Microsoft::UI::Windowing::IconShowOptions::HideIconAndSystemMenu);
     }
+
+    UpdateTitleBarColors();
+  }
+
+  void UpdateTitleBarColors() noexcept {
+    if (!m_rnWindow ||
```

---

### Incident Patch 2: `0bab52cf` (2026-09-01)
**Commit Message**: Fix use-after-free when an Image is destroyed mid-download (#11) (#16345)

**File**: `change/react-native-windows-eba3d592-2ea0-4067-8880-2beea6638837.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix use-after-free crash when an Image is destroyed while its download is still in flight",
+  "packageName": "react-native-windows",
+  "email": "gordomacmaster@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/WindowsImageManager.cpp` (modified, +40/-13)
```diff
@@ -186,6 +186,16 @@ facebook::react::ImageRequest WindowsImageManager::requestImage(
   auto weakObserverCoordinator = (std::weak_ptr<const facebook::react::ImageResponseObserverCoordinator>)
                                      imageRequest.getSharedObserverCoordinator();
 
+  // ImageResponseObserverCoordinator copies its observer list under a lock but dereferences the raw
+  // observer pointers after releasing it. Observers are added and removed on the UI thread (from
+  // ImageComponentView::setStateAndResubscribeImageResponseObserver), and that is also where the
+  // owning ImageComponentView - and with it the WindowsImageResponseObserver - is destroyed. Notifying
+  // the coordinator from the download/completion threads therefore races that teardown and can call
+  // into a freed observer. Marshal every notification onto the UI thread so subscription and
+  // notification are serialized on the same thread. Image decoding deliberately stays off the UI
+  // thread; only the notification itself is posted.
+  auto uiDispatcher = m_reactContext.UIDispatcher();
+
   auto rnImageSource = winrt::Microsoft::ReactNative::Composition::implementation::MakeImageSource(imageSource);
   auto provider = m_uriImageManager->TryGetUriImageProvider(m_reactContext.Handle(), rnImageSource);
 
@@ -202,45 +212,62 @@ facebook::react::ImageRequest WindowsImageManager::requestImage(
     source.sourceType = ImageSourceType::Download;
     source.body = imageSource.body;
 
-    auto progressCallback = [weakObserverCoordinator](int64_t loaded, int64_t total) {
-      if (auto observerCoordinator = weakObserverCoordinator.lock()) {
-        float progress = total > 0 ? static_cast<float>(loaded) / static_cast<float>(total) : 1.0f;
-        observerCoordinator->nativeImageResponseProgress(progress, loaded, total);
-      }
+    auto progressCallback = [weakObserverCoordinator, uiDispatcher](int64_t loaded, int64_t total) {
+      float progress = total > 0 ? static_cast<float>(loaded) / static_cast<float>(total) : 1.0f;
+      uiDispatcher.Post([weakObserverCoordinator, progress, loaded, total]() {
+        if (auto observerCoordinator = weakObserverCoordinator.lock()) {
+          observerCoordinator->nativeImageResponseProgress(progress, loaded, total);
+        }
+      });
     };
     imageResponseTask = GetImageRandomAccessStreamAsync(source, progressCallback);
   }
 
-  imageResponseTask.Completed([weakObserverCoordinator](auto asyncOp, auto status) {
-    auto observerCoordinator = weakObserverCoordinator.lock();
-    if (!observerCoordinator) {
+  imageResponseTask.Completed([weakObserverCoordinator, uiDispatcher](auto asyncOp, auto status) {
+    if (weakObserverCoordinator.expired()) {
       return;
     }
 
+    auto postComplete = [weakObserverCoordinator, uiDispatcher](auto image) {
+      uiDispatcher.Post([weakObserverCoordinator, image = std::move(image)]() {
+        if (auto observerCoordinator = weakObserverCoordinator.lock()) {
+          observerCoordinator->nativeImageResponseComplete(facebook::react::ImageResponse(image, nullptr /*metadata*/));
+        }
+      });
+    };
+
+    auto postFailure = [weakObserverCoordinator,
+                        uiDispatcher](std::shared_ptr<facebook::react::ImageErrorInfo> errorInfo) {
+      uiDispatcher.Post([weakObserverCoordinator, errorInfo = std::move(errorInfo)]() {
+        if (auto observerCoordinator = weakObserverCoordinator.lock()) {
+          observerCoordinator->nativeImageResponseFailed(facebook::react::ImageLoadError(errorInfo));
+        }
+      });
+    };
+
     switch (status) {
       case winrt::Windows::Foundation::AsyncStatus::Completed: {
         auto imageResponse = asyncOp.GetResults();
         auto selfImageResponse =
             winrt::get_self<winrt::Microsoft::ReactNative::Composition::implementation::ImageResponse>(imageResponse);
         auto imageResultOrError = selfImageResponse->ResolveImage();
         if (imageResultOrError.image) {
-  
```

---

### Incident Patch 3: `ba65c6b4` (2026-08-21)
**Commit Message**: Fix crash modifying outline property (#16386)

* Fix crash modifying outline property

* Change files

**File**: `change/react-native-windows-c1af9f4d-e4f1-4dea-9a73-b66033f3bb8d.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix crash modifying outline property",
+  "packageName": "react-native-windows",
+  "email": "30809111+acoates-ms@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/BorderPrimitive.cpp` (modified, +1/-1)
```diff
@@ -713,7 +713,7 @@ BorderPrimitive::BorderPrimitive(
     : m_outer(&outer), m_rootVisual(rootVisual), m_ownsRootVisual(false) {}
 
 BorderPrimitive::BorderPrimitive(winrt::Microsoft::ReactNative::Composition::implementation::ComponentView &outer)
-    : m_outer(&outer), m_rootVisual(outer.CompositionContext().CreateSpriteVisual()) {}
+    : m_outer(&outer), m_rootVisual(outer.CompositionContext().CreateSpriteVisual()), m_ownsRootVisual(true) {}
 
 winrt::Microsoft::ReactNative::Composition::Experimental::IVisual BorderPrimitive::RootVisual() const noexcept {
   return m_rootVisual;
```

---

### Incident Patch 4: `124897f1` (2026-08-20)
**Commit Message**: Fix CI pipeline and add warn-feed script (#16379)

**File**: `.ado/image/rnw-img-vs2026-node24.json` (modified, +45/-3)
```diff
@@ -21,6 +21,9 @@
         {
             "name": "windows-gitinstall"
         },
+        {
+            "name": "windows-git-lfs"
+        },
         {
             "name": "windows-AzPipeline-ImageHelpers"
         },
@@ -33,18 +36,32 @@
         {
             "name": "windows-AzPipeline-7zip"
         },
+        {
+            "name": "windows-chocolatey",
+            "parameters": {
+                "packages": "nasm"
+            }
+        },
         {
             "name": "windows-visualstudio-bootstrapper",
             "parameters": {
-                "Workloads": "--add Microsoft.VisualStudio.Workload.ManagedDesktop --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Workload.Universal --add Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core --add Microsoft.VisualStudio.ComponentGroup.UWP.Support --add Microsoft.VisualStudio.ComponentGroup.UWP.VC --add Microsoft.Component.MSBuild --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended --includeOptional",
+                "Workloads": "--add Microsoft.VisualStudio.Workload.ManagedDesktop --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Workload.Universal --add Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core --add Microsoft.VisualStudio.ComponentGroup.UWP.Support --add Microsoft.VisualStudio.ComponentGroup.UWP.VC --add Microsoft.Component.MSBuild --add Microsoft.VisualStudio.Component.VC.CoreBuildTools --add Microsoft.VisualStudio.Component.VC.CoreIde --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --add Microsoft.VisualStudio.Component.VC.Llvm.Clang --add Microsoft.VisualStudio.Component.VC.Llvm.ClangToolset --add Microsoft.VisualStudio.Component.VC.CMake.Project --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --add Microsoft.VisualStudio.Component.Windows11Sdk.WindowsPerformanceToolkit --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --add Microsoft.VisualStudio.Component.VC.ATL --add Microsoft.VisualStudio.Component.VC.ATL.ARM64 --add Microsoft.VisualStudio.Component.VC.ATLMFC --add Microsoft.VisualStudio.Component.VC.MFC.ARM64 --add Microsoft.VisualStudio.Component.UWP.VC.ARM64 --add Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre --add Microsoft.VisualStudio.Component.VC.Runtimes.ARM64.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.ARM64.Spectre --includeRecommended --includeOptional",
                 "SKU": "Enterprise",
                 "VSBootstrapperURL": "https://aka.ms/vs/18/stable/vs_Enterprise.exe"
             }
         },
         {
             "name": "Windows-NodeJS",
             "parameters": {
-                "Version": "24.16.0"
+                "Version": "24.x",
+                "UseARM": "false"
+            }
+        },
+        {
+            "name": "windows-install-python",
+            "parameters": {
+                "Version": "latest",
+                "Architecture": "x64"
             }
         },
         {
@@ -56,11 +73,36 @@
         {
             "name": "windows-dotnetcore-sdk",
             "parameters": {
-                "DotNetCoreVersion": "10.0.300"
+                "DotNetCoreVersion": "latest",
+                "Channel": "10.0"
+            }
+        },
+        {
+            "name": "windows-1es-pt-prerequisites-v2",
+            "parameters": {
+                "KVSecret_AppSecret": "https://pipelinesidentity.vault.azure.net/secrets/1es-gpt-read-only-app-secret"
             }
         },
         {
             "name": "Windows-AzureCLI"
+        },
+        {
+            "name": "windows-updateregistry",
+            "parameters": {
+                "RegistryPath": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\VisualStudio\\Setup",
+                "RegistryKey": "BackgroundDownloadDisabled"
```

**File**: `.ado/release-pipeline.yml` (modified, +36/-0)
```diff
@@ -229,6 +229,42 @@ extends:
             owners: 'vmorozov@microsoft.com'
             approvers: 'khosany@microsoft.com'
 
+      - job: PushNpmPublicAdo
+        displayName: ADO - npm - react-native-public
+        timeoutInMinutes: 30
+        templateContext:
+          type: releaseJob
+          isProduction: true
+          inputs:
+          - input: pipelineArtifact
+            pipeline: 'CI'
+            artifactName: 'NpmPackedTarballs'
+            targetPath: '$(Pipeline.Workspace)/npm-feed-packages'
+        steps:
+        - template: .ado/templates/publish-npm-to-ado-feed.yml@self
+          parameters:
+            npmFeedRegistry: 'https://pkgs.dev.azure.com/ms/react-native/_packaging/react-native-public/npm/registry/'
+            packagesPath: '$(Pipeline.Workspace)/npm-feed-packages'
+            feedDisplayName: 'ms/react-native-public'
+
+      - job: PushNpmPrivateAdo
+        displayName: ADO - npm - react-native
+        timeoutInMinutes: 30
+        templateContext:
+          type: releaseJob
+          isProduction: true
+          inputs:
+          - input: pipelineArtifact
+            pipeline: 'CI'
+            artifactName: 'NpmPackedTarballs'
+            targetPath: '$(Pipeline.Workspace)/npm-feed-packages'
+        steps:
+        - template: .ado/templates/publish-npm-to-ado-feed.yml@self
+          parameters:
+            npmFeedRegistry: 'https://pkgs.dev.azure.com/ms/_packaging/react-native/npm/registry/'
+            packagesPath: '$(Pipeline.Workspace)/npm-feed-packages'
+            feedDisplayName: 'ms/react-native'
+
       - job: PushPrivateAdo
         displayName: ADO - nuget - react-native
         timeoutInMinutes: 30
```

**File**: `.ado/templates/msbuild-sln.yml` (modified, +0/-1)
```diff
@@ -47,7 +47,6 @@ steps:
         /p:PlatformToolset=${{parameters.platformToolset}}
         /p:PublishToolDuringBuild=true
         /p:RestoreLockedMode=true
-        /p:RestoreForceEvaluate=true
         /bl:$(BuildLogDirectory)\MsBuild.binlog
         /flp1:errorsonly;logfile=$(BuildLogDirectory)\MsBuild.err.log
         /flp2:warningsonly;logfile=$(BuildLogDirectory)\MsBuild.wrn.log
```

**File**: `.ado/templates/prepare-build-env.yml` (modified, +4/-4)
```diff
@@ -31,15 +31,15 @@ parameters:
     # invoked. Example: ['RNTesterApp-Fabric', 'Playground'].
 
 steps:
-  # The VS Installer's background auto-update service otherwise wakes up mid-build and
-  # downloads VS updates from the MS CDN, which trips the network isolation policy.
-  # Follow-up: bake this into the agent image so it doesn't have to run per job.
+  # VS Installer's background auto-update (BackgroundDownload.exe) fetches VS updates from the MS
+  # CDN mid-build and trips network isolation. Interim belt; the durable fix is BackgroundDownloadDisabled=1
+  # baked into the agent image JSON (.ado/image/rnw-img-vs2026-node24.json) — remove once that image ships.
   - pwsh: |
       foreach ($key in @(
           'HKLM:\SOFTWARE\Microsoft\VisualStudio\Setup',
           'HKLM:\SOFTWARE\Policies\Microsoft\VisualStudio\Setup')) {
         New-Item -Path $key -Force | Out-Null
-        New-ItemProperty -Path $key -Name BackgroundDownload -PropertyType DWord -Value 0 -Force | Out-Null
+        New-ItemProperty -Path $key -Name BackgroundDownloadDisabled -PropertyType DWord -Value 1 -Force | Out-Null
       }
       Get-Process -Name BackgroundDownload -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
     displayName: Disable VS Installer background download
```

**File**: `.ado/templates/publish-npm-to-ado-feed.yml` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# Publishes packed npm tarballs to an Azure Artifacts feed's npm registry, mirroring
+# publish-nuget-to-ado-feed.yml. Auth uses the shared managed identity (same identity/
+# resource the NuGet feed publish uses).
+parameters:
+- name: azureSubscription
+  type: string
+  default: 'Office-Hermes-Windows-Bot'
+- name: npmFeedRegistry
+  type: string
+- name: packagesPath
+  type: string
+- name: feedDisplayName
+  type: string
+
+steps:
+- task: AzureCLI@2
+  displayName: Acquire ${{ parameters.feedDisplayName }} feed token
+  inputs:
+    azureSubscription: ${{ parameters.azureSubscription }}
+    visibleAzLogin: false
+    scriptType: pscore
+    scriptLocation: inlineScript
+    inlineScript: |
+      $token = az account get-access-token --query accessToken --resource 499b84ac-1321-427f-aa17-267ca6975798 -o tsv
+      if ([string]::IsNullOrWhiteSpace($token)) { throw 'Failed to acquire a feed access token.' }
+      Write-Host "##vso[task.setsecret]$token"
+      Write-Host "##vso[task.setvariable variable=AdoNpmFeedToken;issecret=true]$token"
+
+- pwsh: |
+    # The .npmrc holds only the ${NPM_FEED_TOKEN} placeholder; npm expands it from the masked env
+    # var at run time, so the raw token never lands in a file. A version already present in the feed
+    # (locally or via its npmjs upstream) returns 409, which we treat as success.
+    $registry = '${{ parameters.npmFeedRegistry }}'
+    $key = ($registry -replace '^https?:', '')
+    Set-Content -Path (Join-Path $env:USERPROFILE '.npmrc') -Encoding ascii -Value @(
+      "registry=$registry"
+      "${key}:_authToken=`${NPM_FEED_TOKEN}"
+    )
+    $tgzs = @(Get-ChildItem -Path '${{ parameters.packagesPath }}' -Filter *.tgz -Recurse)
+    Write-Host "Publishing $($tgzs.Count) package(s) to ${{ parameters.feedDisplayName }}"
+    $failed = @()
+    foreach ($tgz in $tgzs) {
+      $out = & npm publish $tgz.FullName --registry $registry 2>&1 | Out-String
+      if ($LASTEXITCODE -eq 0) { Write-Host "published $($tgz.Name)" }
+      elseif ($out -match 'already exists|EPUBLISHCONFLICT|cannot publish over|\b409\b') { Write-Host "skipped (already in feed): $($tgz.Name)" }
+      else { Write-Host "##[error]Failed to publish $($tgz.Name): $out"; $failed += $tgz.Name }
+    }
+    if ($failed.Count -gt 0) { throw "Failed to publish $($failed.Count) package(s) to ${{ parameters.feedDisplayName }}." }
+  displayName: Publish npm packages to ${{ parameters.feedDisplayName }}
+  env:
+    NPM_FEED_TOKEN: $(AdoNpmFeedToken)
```

---

### Incident Patch 5: `36939f87` (2026-08-10)
**Commit Message**: fix(pointer): null-check the capturing component view before notifying OnPointerCaptureLost (#16337)

CapturePointer and releasePointerCapture look the capturing component up by its
cached m_pointerCapturingComponentTag and dereference the result unguarded. That
tag can outlive the component it names: when list/ScrollView virtualization
recycles the capturing row mid-pan, componentViewDescriptorWithTag returns a
descriptor whose .view is null, so winrt::get_self(...)->OnPointerCaptureLost()
dereferences null and terminates the process with 0xc0000005.

Null-check targetComponentView at both sites. Skipping the notify loses no state
transition: CapturePointer overwrites the stale tag immediately below, and
releasePointerCapture clears it via the existing m_capturedPointers.empty()
branch.

main twin of #16334 (0.83-stable).

**File**: `change/react-native-windows-capture-null-guard-main.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"type":"prerelease","dependentChangeType":"patch","email":"collindanielschneide@gmail.com","packageName":"react-native-windows","comment":"Null-check the capturing component view before notifying OnPointerCaptureLost (crash when the capturing component was unmounted)"}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/CompositionEventHandler.cpp` (modified, +17/-4)
```diff
@@ -1520,8 +1520,16 @@ bool CompositionEventHandler::CapturePointer(
       auto targetComponentView =
           fabricuiManager->GetViewRegistry().componentViewDescriptorWithTag(m_pointerCapturingComponentTag).view;
 
-      winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
-          ->OnPointerCaptureLost();
+      // Guard against a stale capturing tag. If the previously-capturing component
+      // was unmounted (e.g. list/ScrollView virtualization recycled it during a pan)
+      // without releasing capture, componentViewDescriptorWithTag returns a
+      // descriptor whose .view is null - and the unguarded get_self(...) call then
+      // dereferences null and crashes the process (0xc0000005). Skip the notify when
+      // the view is gone; the tag is overwritten just below.
+      if (targetComponentView) {
+        winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
+            ->OnPointerCaptureLost();
+      }
     }
   }
 
@@ -1550,8 +1558,13 @@ bool CompositionEventHandler::releasePointerCapture(PointerId pointerId, faceboo
       auto targetComponentView =
           fabricuiManager->GetViewRegistry().componentViewDescriptorWithTag(m_pointerCapturingComponentTag).view;
 
-      winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
-          ->OnPointerCaptureLost();
+      // Same stale-tag null-view guard as CapturePointer above: a pointer release
+      // after the capturing component was unmounted would otherwise dereference a
+      // null view and crash (0xc0000005).
+      if (targetComponentView) {
+        winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
+            ->OnPointerCaptureLost();
+      }
     }
 
     if (m_capturedPointers.empty()) {
```

---

### Incident Patch 6: `5411eac2` (2026-08-10)
**Commit Message**: fix(pointer): label a touch/pen contact as the primary button (#16338)

onPointerPressed maps ActiveTouch.button exclusively from PointerUpdateKind, a
mouse-only concept. A touch or pen contact matches no case, falls through to
default: button = -1, and the derived W3C buttons bitmask becomes 0. The
pointerdown delivered to JS therefore claims no button is pressed, so
pointer-event-driven press handling discards finger contacts while identical
mouse clicks work.

Per W3C pointer-events a touch/pen contact IS the primary button: button 0,
buttons 1. Set that after the switch when the mouse mapping left it negative.

main counterpart of the button-labeling change in #16333 (0.83-stable), tracking
#16332. Ports only that change: main already covers the tag == -1 release leak
and the stale-pointer-reuse leak via #16048 (dispatching a synthesized touch
Cancel), and cancels capture loss per pointer. #16333's cancel-all loop,
IsPrimary purge and stale-touch backstop are deliberately not ported - they do
not exist on main and their necessity there has not been assessed.

**File**: `change/react-native-windows-touch-primary-button-main.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix(fabric): dispatch touch/pen contacts with the W3C primary button (button 0, buttons 1) instead of button -1 / buttons 0, so pointer-event-driven press handling responds to finger taps the same as mouse left-clicks",
+  "packageName": "react-native-windows",
+  "email": "collindanielschneide@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/CompositionEventHandler.cpp` (modified, +10/-0)
```diff
@@ -1413,6 +1413,16 @@ void CompositionEventHandler::onPointerPressed(
         break;
     }
 
+    // A touch (or pen) contact has no mouse PointerUpdateKind, so it fell
+    // through to button = -1 — and the derived W3C buttons bitmask became 0.
+    // The dispatched pointerdown therefore told JS "no button is pressed", so
+    // press machinery driven by pointer events ignored finger taps while
+    // identical mouse clicks (button 0 / buttons 1) worked. Per W3C
+    // pointer-event semantics a touch/pen contact IS the primary button.
+    if (pointerPoint.PointerDeviceType() != Composition::Input::PointerDeviceType::Mouse && activeTouch.button < 0) {
+      activeTouch.button = 0;
+    }
+
     while (targetComponentView) {
       if (auto eventEmitter =
               winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
```

---

### Incident Patch 7: `031b6acd` (2026-08-05)
**Commit Message**: fix(textinput): correct placeholder layout constraints (px vs DIP) and no-op NaN fontSize guard (#16317)

* fix(textinput): correct placeholder layout constraints (px vs DIP) and no-op NaN fontSize guard

Forward-port of #16303 (0.83-stable) to main.

CreatePlaceholderLayout fed m_imgWidth/m_imgHeight - which are physical
pixels (frame * pointScaleFactor) - into LayoutConstraints, which are
expressed in DIPs. The placeholder was laid out in a box pointScaleFactor
times too large, so it measured and positioned at a different height than
the typed text. Divide by pointScaleFactor.

The NaN fontSize guard was also a no-op: it evaluated
defaultTextAttributes().fontSize as a discarded expression statement
instead of assigning it, so a placeholder with no fontSize never picked
up the default.

* add beachball change file

* Update release type to prerelease

Change type from 'patch' to 'prerelease' for react-native-windows.

---------

Co-authored-by: Andrew Coates <30809111+acoates-ms@users.noreply.github.com>

**File**: `change/react-native-windows-fix-textinput-placeholder-main.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix placeholder layout constraints fed physical px instead of DIPs; fix no-op NaN fontSize guard in CreatePlaceholderLayout",
+  "packageName": "react-native-windows",
+  "email": "collindanielschneide@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/TextInput/WindowsTextInputComponentView.cpp` (modified, +7/-3)
```diff
@@ -1743,16 +1743,20 @@ winrt::com_ptr<::IDWriteTextLayout> WindowsTextInputComponentView::CreatePlaceho
   const auto &props = windowsTextInputProps();
   facebook::react::TextAttributes textAttributes = props.textAttributes;
   if (std::isnan(props.textAttributes.fontSize)) {
-    facebook::react::TextAttributes::defaultTextAttributes().fontSize;
+    textAttributes.fontSize = facebook::react::TextAttributes::defaultTextAttributes().fontSize;
   }
   textAttributes.fontSizeMultiplier = m_fontSizeMultiplier;
   fragment1.string = props.placeholder;
   fragment1.textAttributes = textAttributes;
   attributedString.appendFragment(std::move(fragment1));
 
   facebook::react::LayoutConstraints constraints;
-  constraints.maximumSize.width = static_cast<FLOAT>(m_imgWidth);
-  constraints.maximumSize.height = static_cast<FLOAT>(m_imgHeight);
+  // m_imgWidth/m_imgHeight are physical pixels (frame * pointScaleFactor), but
+  // LayoutConstraints are expressed in DIPs. Feeding physical px laid the
+  // placeholder out in a box pointScaleFactor x too large, so the placeholder was
+  // measured/positioned at a different height than the typed text. Convert to DIPs.
+  constraints.maximumSize.width = static_cast<FLOAT>(m_imgWidth) / m_layoutMetrics.pointScaleFactor;
+  constraints.maximumSize.height = static_cast<FLOAT>(m_imgHeight) / m_layoutMetrics.pointScaleFactor;
 
   facebook::react::WindowsTextLayoutManager::GetTextLayout(
       facebook::react::AttributedStringBox(attributedString), {} /*TODO*/, constraints, textLayout);
```

---

### Incident Patch 8: `c470288a` (2026-08-05)
**Commit Message**: fix(scrollview): honor programmatic scrollTo when scrollEnabled={false} (#16336)

scrollEnabled={false} must only disable user scroll gestures, matching iOS and
Android where setContentOffset / scrollToOffset still work when scrolling is
disabled. The scrollTo command (and scrollToIndex / scrollToOffset, which route
through it) previously hit a scrollEnabled early-return and was silently
dropped. User-gesture input is gated separately via m_scrollVisual.ScrollEnabled
(set from scrollEnabled in updateProps), so honoring a programmatic scroll here
does not re-enable user scrolling.

main-branch twin of #16304 (0.83-stable).

**File**: `change/react-native-windows-scrollto-scrollenabled-main.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"type":"prerelease","dependentChangeType":"patch","email":"collindanielschneide@gmail.com","packageName":"react-native-windows","comment":"Honor programmatic scrollTo when scrollEnabled={false}, matching iOS/Android"}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/ScrollViewComponentView.cpp` (modified, +8/-4)
```diff
@@ -1192,10 +1192,14 @@ void ScrollViewComponentView::HandleCommand(const winrt::Microsoft::ReactNative:
 }
 
 void ScrollViewComponentView::scrollTo(winrt::Windows::Foundation::Numerics::float3 offset, bool animate) noexcept {
-  if (!std::static_pointer_cast<const facebook::react::ScrollViewProps>(viewProps())->scrollEnabled) {
-    return;
-  }
-
+  // scrollEnabled={false} must only disable *user* scroll gestures, matching
+  // iOS and Android where setContentOffset / scrollToOffset still work when
+  // scrolling is disabled. Programmatic scrolls - the scrollTo command, and
+  // scrollToIndex / scrollToOffset which route through it - previously hit a
+  // scrollEnabled early-return here and were silently dropped. User-gesture
+  // input is gated separately (m_scrollVisual.ScrollEnabled, set from
+  // scrollEnabled in updateProps), so it is safe to always honor a
+  // programmatic scroll here.
   m_scrollVisual.TryUpdatePosition(offset, animate);
 }
 
```

---

### Incident Patch 9: `b85e8dca` (2026-07-14)
**Commit Message**: Fix a crash calling CallInvoker during shutdown (#16310)

* Fix a crash calling CallInvoker during shutdown

* Change files

* build fix

**File**: `change/react-native-windows-4672fa37-ea7f-4ffd-82cd-40e7d8b41de5.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix a crash calling CallInvoker during shutdown",
+  "packageName": "react-native-windows",
+  "email": "30809111+acoates-ms@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative.Cxx/TurboModuleProvider.cpp` (modified, +14/-8)
```diff
@@ -13,17 +13,23 @@ struct AbiCallInvoker final : facebook::react::CallInvoker {
   AbiCallInvoker(IReactContext const &context) : m_context(context) {}
 
   void invokeAsync(facebook::react::CallFunc &&func) noexcept override {
-    m_context.CallInvoker().InvokeAsync(
-        [context = m_context, func = std::move(func)](const winrt::Windows::Foundation::IInspectable &runtimeHandle) {
-          func(GetOrCreateContextRuntime(context, runtimeHandle));
-        });
+    auto callInvoker = m_context.CallInvoker();
+    if (callInvoker) {
+      callInvoker.InvokeAsync(
+          [context = m_context, func = std::move(func)](const winrt::Windows::Foundation::IInspectable &runtimeHandle) {
+            func(GetOrCreateContextRuntime(context, runtimeHandle));
+          });
+    }
   }
 
   void invokeSync(facebook::react::CallFunc &&func) override {
-    m_context.CallInvoker().InvokeSync(
-        [context = m_context, func = std::move(func)](const winrt::Windows::Foundation::IInspectable &runtimeHandle) {
-          func(GetOrCreateContextRuntime(context, runtimeHandle));
-        });
+    auto callInvoker = m_context.CallInvoker();
+    if (callInvoker) {
+      callInvoker.InvokeSync(
+          [context = m_context, func = std::move(func)](const winrt::Windows::Foundation::IInspectable &runtimeHandle) {
+            func(GetOrCreateContextRuntime(context, runtimeHandle));
+          });
+    }
   }
 
  private:
```

---

### Incident Patch 10: `b3683c52` (2026-07-07)
**Commit Message**: Fix: text input scaling with different screen scales (#16288)

* Fixes misalginment with TextInput on different display scales

* Change files

**File**: `change/react-native-windows-7d9b1431-48aa-416e-b5eb-712e0d1c34be.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fixes misalginment with TextInput on different display scales",
+  "packageName": "react-native-windows",
+  "email": "dlucas@seabird.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/TextInput/WindowsTextInputComponentView.cpp` (modified, +1/-1)
```diff
@@ -1329,7 +1329,7 @@ void WindowsTextInputComponentView::updateLayoutMetrics(
     facebook::react::LayoutMetrics const &oldLayoutMetrics) noexcept {
   // Set Position & Size Properties
 
-  if ((layoutMetrics.pointScaleFactor != m_layoutMetrics.pointScaleFactor)) {
+  if (m_textServices && layoutMetrics.pointScaleFactor > 0) {
     LRESULT res;
     winrt::check_hresult(m_textServices->TxSendMessage(
         (WM_USER + 328), // EM_SETDPI
```

#### Recent Merged Pull Requests:
- **PR #16459** (closed): 📦 Bump the all-dependencies group across 1 directory with 9 updates (@dependabot[bot])
- **PR #16458** (2026-09-26): Warm the CLI-init app closure in warm-feed (@vmoroz)
- **PR #16457** (closed): 📦 [0.81]: Bump the all-dependencies group across 1 directory with 25 updates (@dependabot[bot])
- **PR #16455** (closed): 📦 [0.84]: Bump the all-dependencies group across 1 directory with 16 updates (@dependabot[bot])
- **PR #16454** (2026-09-25): RELEASE: Releasing 12 package(s) (0.85-stable) (@azure-pipelines[bot])
- **PR #16453** (2026-09-24): Integrate React Native 0.87.0-nightly-20260704-e04ff69ab (July 4th) (@anuagragith)
- **PR #16450** (closed): 📦 Bump the all-dependencies group across 1 directory with 8 updates (@dependabot[bot])
- **PR #16449** (2026-09-24): [0.85] Fix inactive Modal title bar contrast (@anuagragith)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
