# Forensic Learning Record (Deep Inspection): callstack/react-native-builder-bob

> **Canonical Artifact**: `07_PROJECT_LEARNING/callstack-react-native-builder-bob-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/callstack/react-native-builder-bob](https://github.com/callstack/react-native-builder-bob))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:44:19.242Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/react-native-builder-bob`
- **Description**: Simple set of CLIs to scaffold and build React Native libraries for different targets
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3231 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/create-react-native-library/src/utils/assert.ts`
```
import kleur from 'kleur';
import { spawn } from './spawn.ts';

export async function assertNpxExists() {
  try {
    await spawn('npx', ['--help']);
  } catch (error) {
    // @ts-expect-error: TS doesn't know about `code`
    if (error != null && error.code === 'ENOENT') {
      throw new Error(
        `Couldn't find ${kleur.blue(
          'npx'
        )}! Please install it by running ${kleur.blue('npm install -g npx')}`
      );
    } else {
      throw error;
    }
  }
}

```

### Core Architecture Module: `packages/create-react-native-library/src/utils/configureTools.ts`
```
import path from 'node:path';
import fs from 'fs-extra';
import { applyTemplate, type TemplateConfiguration } from '../template.ts';
import sortObjectKeys from './sortObjectKeys.ts';

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
};

type Tool = {
  name: string;
  description: string;
  condition?: (context: Pick<TemplateConfiguration, 'example'>) => boolean;
  postprocess?: (options: {
    config: TemplateConfiguration;
    root: string;
  }) => void | Promise<void>;
};

type Options = {
  tools: string[];
  root: string;
  packageJson: PackageJson;
  config: TemplateConfiguration;
};

const ESLINT = {
  name: 'ESLint with Prettier',
  description: 'Lint and format code',
};

const LEFTHOOK = {
  name: 'Lefthook with Commitlint',
  description: 'Manage Git hooks and lint commit messages',
};

const RELEASE_IT = {
  name: 'Release It',
  description: 'Automate versioning and package publishing tasks',
};

const JEST = {
  name: 'Jest',
  description: 'Test JavaScript and TypeScript code',
};

const TURBOREPO = {
  name: 'Turborepo',
  description: 'Cache build outputs on CI',
};

const VITE: Tool = {
  name: 'Vite',
  description: 'Add web support to the example app',
  condition: (config) => config.example != null && config.example !== 'expo',
  postprocess: async ({ root }) => {
    const examplePkgPath = path.join(root, 'example', 'package.json');

    if (!fs.existsSync(examplePkgPath)) {
      throw new Error("Couldn't find the example app's package.json.");
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const examplePackageJson = (await fs.readJson(
      examplePkgPath
    )) as PackageJson;

    const reactVersion =
      examplePackageJson.dependencies?.react ??
      examplePackageJson.devDependencies?.react;

    if (reactVersion == null) {
      throw new Error("Couldn't find the package 'react' in the example app.");
    }

    examplePackageJson.dependencies = sortObjectKeys({
      ...examplePackageJson.dependencies,
      'react-dom': reactVersion,
    });

    await fs.writeJson(examplePkgPath, examplePackageJson, { spaces: 2 });
  },
};

export const AVAILABLE_TOOLS = {
  eslint: ESLINT,
  jest: JEST,
  lefthook: LEFTHOOK,
  'release-it': RELEASE_IT,
  vite: VITE,
} as const satisfies Record<string, Tool>;

const REQUIRED_TOOLS = {
  turborepo: TURBOREPO,
} as const satisfies Record<string, Tool>;

const ALL_TOOLS = {
  ...AVAILABLE_TOOLS,
  ...REQUIRED_TOOLS,
} as const;

export async function configureTools({
  tools,
  config,
  root,
  packageJson,
}: Options) {
  for (const key of [
    ...tools,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ...(Object.keys(REQUIRED_TOOLS) as (keyof typeof REQUIRED_TOOLS)[]),
  ]) {
    if (!(key in ALL_TOOLS)) {
      throw new Error(
        `Invalid tool '${key}'. Available tools are: ${Object.keys(
          AVAILABLE_TOOLS
        ).join(', ')}.`
      );
    }

    // @ts-expect-error: We checked the key above
    const tool: Tool = ALL_TOOLS[key];

    if (tool.condition && !tool.condition(config)) {
      continue;
    }

    const toolDir = path.resolve(
      import.meta.dirname,
      `../../../templates/tools/${key}`
    );

    if (fs.existsSync(toolDir)) {
      await applyTemplate(config, toolDir, root);
    }

    const examplePkgPath = path.join(toolDir, 'example', '~package.json');

    await mergePackageJsonTemplate(
      path.join(toolDir, '~package.json'),
      packageJson
    );

    if (fs.existsSync(examplePkgPath)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const existingExamplePackageJson = (await fs.readJson(
        path.join(root, 'example', 'package.json')
      )) as PackageJson;

      await mergePackageJsonTemplate(
        examplePkgPath,
        existingExamplePackageJson
      );

      await fs.writeJson(
        path.join(root, 'example', 'package.json'),
        existingExamplePackageJson,
        {
          spaces: 2,
        }
      );
    }

    await tool.postprocess?.({ config, root });
  }
}

async function mergePackageJsonTemplate(
  templatePath: string,
  packageJson: PackageJson
) {
  if (!fs.existsSync(templatePath)) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const template = (await fs.readJson(templatePath)) as PackageJson;

  for (const [field, value] of Object.entries(template)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (
        typeof packageJson[field] === 'object' ||
        packageJson[field] == null
      ) {
        packageJson[field] = {
          ...packageJson[field],
          ...value,
        };

        if (
          field === 'dependencies' ||
          field === 'devDependencies' ||
          field === 'peerDependencies'
        ) {
          packageJson[field] = sortObjectKeys(packageJson[field]);
        }
      } else {
        throw new Error(
          `Cannot merge '${field}' field because it is not an object (got '${String(packageJson[field])}').`
        );
      }
    } else {
      packageJson[field] = value;
    }
  }
}

```

### Core Architecture Module: `packages/create-react-native-library/src/utils/createMetadata.ts`
```
import pack from '../../package.json' with { type: 'json' };
import type { Answers } from '../prompt.ts';

export function createMetadata(answers: Partial<Answers>) {
  // Some of the passed args can already be derived from the generated package.json file.
  const ignoredAnswers: (keyof Answers)[] = [
    'name',
    'directory',
    'slug',
    'description',
    'authorName',
    'authorEmail',
    'authorUrl',
    'repoUrl',
    'example',
    'reactNativeVersion',
    'local',
  ];

  const libraryMetadata = Object.fromEntries(
    Object.entries(answers).filter(
      ([answer]) =>
        !ignoredAnswers.includes(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          answer as keyof Answers
        )
    )
  );

  libraryMetadata.version = pack.version;

  return libraryMetadata;
}

```

### Core Architecture Module: `packages/create-react-native-library/src/utils/initialCommit.ts`
```
import { spawn } from './spawn.ts';

export async function createInitialGitCommit(
  folder: string,
  signal?: AbortSignal
) {
  let isInGitRepo = false;

  try {
    isInGitRepo =
      (await spawn('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: folder,
        signal,
      })) === 'true';
  } catch (error) {
    // Ignore errors
  }

  if (!isInGitRepo) {
    await spawn('git', ['init'], { cwd: folder, signal });
    await spawn('git', ['branch', '-M', 'main'], { cwd: folder, signal });
    await spawn('git', ['add', '.'], { cwd: folder, signal });
    await spawn('git', ['commit', '-m', 'chore: initial commit'], {
      cwd: folder,
      signal,
    });
  }
}

```

### Core Architecture Module: `packages/create-react-native-library/src/utils/local.ts`
```
import path from 'node:path';
import fs from 'fs-extra';
import type { TemplateConfiguration } from '../template.ts';

type PackageJson = {
  dependencies?: Record<string, string>;
};

/** @returns `true` if successfull */
export async function addNitroDependencyToLocalLibrary(
  config: TemplateConfiguration
): Promise<boolean> {
  if (config.versions.nitro === undefined) {
    return false;
  }

  const appPackageJsonPath = await findAppPackageJsonPath();
  if (appPackageJsonPath === null) {
    return false;
  }

  const appPackageJson: PackageJson = await fs.readJson(appPackageJsonPath);
  const dependencies = appPackageJson['dependencies'] ?? {};

  dependencies['react-native-nitro-modules'] = config.versions.nitro;

  appPackageJson['dependencies'] = dependencies;
  await fs.writeJson(appPackageJsonPath, appPackageJson, {
    spaces: 2,
  });

  return true;
}

/** @returns `true` if successfull */
export async function linkLocalLibrary(
  config: TemplateConfiguration,
  folder: string,
  packageManager: string
): Promise<boolean> {
  const appPackageJsonPath = await findAppPackageJsonPath();
  if (appPackageJsonPath === null) {
    return false;
  }

  const appPackageJson: PackageJson = await fs.readJson(appPackageJsonPath);

  const isReactNativeProject = Boolean(
    appPackageJson.dependencies?.['react-native']
  );

  if (!isReactNativeProject) {
    return false;
  }

  const dependencies = appPackageJson['dependencies'] ?? {};
  dependencies[config.project.slug] =
    packageManager === 'yarn'
      ? `link:./${path.relative(process.cwd(), folder)}`
      : `file:./${path.relative(process.cwd(), folder)}`;

  await fs.writeJSON(appPackageJsonPath, appPackageJson, {
    spaces: 2,
  });

  return true;
}

async function findAppPackageJsonPath(): Promise<string | null> {
  const cwdPackageJson = path.join(process.cwd(), 'package.json');
  if (!(await fs.pathExists(cwdPackageJson))) {
    return null;
  }

  return cwdPackageJson;
}

```

### Core Architecture Module: `packages/create-react-native-library/src/utils/packageManager.ts`
```
import fs from 'fs-extra';
import path from 'path';

export async function determinePackageManager() {
  return (await fs.pathExists(path.join(process.cwd(), 'yarn.lock')))
    ? 'yarn'
    : 'npm';
}

```

### Core Architecture Module: `packages/create-react-native-library/src/utils/resolveNpmPackageVersion.ts`
```
import { spawn } from './spawn.ts';

export async function resolveNpmPackageVersion(
  name: string,
  fallback: string,
  timeout: number = 1000
): Promise<string> {
  let result: string;

  try {
    const promise = spawn('npm', ['view', name, 'dist-tags.latest']);

    result = await Promise.race([
      new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve(fallback);
        }, timeout);
      }),
      promise,
    ]);
  } catch (e) {
    result = fallback;
  }

  return result;
}

```

### Core Architecture Module: `packages/create-react-native-library/src/utils/sortObjectKeys.ts`
```
export default function sortObjectKeys<T extends Record<string, unknown>>(
  obj: T
): T {
  // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
  return (Object.keys(obj) as (keyof T)[]).sort().reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  }, {} as T);
}

```

### Core Architecture Module: `packages/create-react-native-library/src/utils/spawn.ts`
```
import crossSpawn from 'cross-spawn';

export const spawn = async (...args: Parameters<typeof crossSpawn>) => {
  return new Promise<string>((resolve, reject) => {
    const child = crossSpawn(...args);

    let stdout = '';
    let stderr = '';

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (data: string) => {
      stdout += data;
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (data: string) => {
      stderr += data;
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim()));
      }
    });
  });
};

```

### Core Architecture Module: `eslint.config.mjs`
```
import { defineConfig, globalIgnores } from 'eslint/config';
import { recommended, vitest, typechecked } from 'eslint-config-satya164';
import globals from 'globals';

export default defineConfig(
  recommended,
  vitest,
  typechecked,

  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',

      'import-x/extensions': ['error', 'ignorePackages'],
    },
  },

  {
    files: ['scripts/**'],
    languageOptions: {
      globals: globals.node,
    },
  },

  globalIgnores([
    '**/.next/',
    '**/.expo/',
    '**/.yarn/',
    '**/.vscode/',
    '**/node_modules/',
    '**/coverage/',
    '**/doc_build/',
    '**/out/',
    '**/lib/',
    '**/templates/',
    '**/__fixtures__/',
  ])
);

```

### Core Architecture Module: `packages/create-react-native-library/src/constants.ts`
```
export const FALLBACK_BOB_VERSION = '0.43.0';
export const FALLBACK_NITRO_MODULES_VERSION = '0.36.5';
export const SUPPORTED_MONOREPO_CONFIG_VERSION = '0.4.0';
export const SUPPORTED_REACT_NATIVE_VERSION = '0.86.2';
export const SUPPORTED_EXPO_SDK_VERSION = '57';

```

### Core Architecture Module: `packages/create-react-native-library/src/exampleApp/dependencies.ts`
```
import path from 'node:path';
import fs from 'fs-extra';
import sortObjectKeys from '../utils/sortObjectKeys.ts';

type PackageJson = {
  devDependencies?: Record<string, string>;
  'react-native-builder-bob'?: {
    targets?: (string | [string, unknown])[];
  };
};

export async function alignDependencyVersionsWithExampleApp(
  pkg: PackageJson,
  folder: string
) {
  const examplePackageJson = await fs.readJSON(
    path.join(folder, 'example', 'package.json')
  );

  const PACKAGES_TO_COPY = [
    'react',
    'react-native',
    '@types/react',
    '@react-native/babel-preset',
  ];

  const usesCodegen =
    pkg['react-native-builder-bob']?.targets?.some((target) =>
      Array.isArray(target) ? target[0] === 'codegen' : target === 'codegen'
    ) ?? false;

  if (usesCodegen) {
    PACKAGES_TO_COPY.push('@react-native-community/cli');
  }

  const devDependencies: Record<string, string> = {};

  PACKAGES_TO_COPY.forEach((name) => {
    if (name) {
      const version =
        examplePackageJson.dependencies?.[name] ??
        examplePackageJson.devDependencies?.[name];

      if (version != null) {
        devDependencies[name] = version;
      } else if (pkg.devDependencies?.[name] == null) {
        throw new Error(
          `Couldn't find the package "${name}" in the example app.`
        );
      }
    }
  });

  pkg['devDependencies'] = sortObjectKeys({
    ...pkg['devDependencies'],
    ...devDependencies,
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #943** (2026-05-19): **yarn start - error**
  *Symptoms*: ### Description  run  npx create-react-native-library@latest    cd test yarn  cd example  yarn start  C:\test>cd test C:\test\test>yarn C:\test\test>cd example C:\test\test\example>yarn start error Error loading Metro config at: C:\test\test\example\metro.config.js (baseConfig.resolver.blockList || []) is not iterable. TypeError: (baseConfig.resolver.blockList || []) is not iterable     at withMetroConfig (file:///C:/test/test/example/node_modules/react-native-monorepo-config/index.js:189:53)     at Object.<anonymous> (C:\test\test\example\metro.config.js:13:16)     at Module._compile (node:internal/modules/cjs/loader:1692:14)     at Object..js (node:internal/modules/cjs/loader:1824:10)     at Module.load (node:internal/modules/cjs/loader:1427:32)     at Module._load (node:internal/modules/cjs/loader:1250:12)     at TracingChannel.traceSync (node:diagnostics_channel:322:14)     at wrapModuleLoad (node:internal/modules/cjs/loader:235:24)     at cjsLoader (node:internal/modules/esm/translators:316:5)     at ModuleWrap.<anonymous> (node:internal/modules/esm/translators:208:7)  C:\test\test\example>   ### Packages  - [x] create-react-native-library - [ ] react-native-builder-bob  ### Selected options  C:\test>npx create-react-native-library@latest │ ✔ Where do you want to create the library? │ test │ ✔ What do you want to name the npm package? │ react-native-test │ ✔ How would you describe the package? │ test │ ✔ What is the name of the package author? │ test │ ✔ What is the emai
  **Post-Mortem & Fix Analysis**:
  > hey @Alexufo, please try generating a new project, or if you have an existing project, upgrade `react-native-monorepo-config` to 0.3.5

- **Issue #917** (2025-12-12): **create-react-native-library JS Library not working on docker after being created on windows**
  *Symptoms*: ### Description  after create-react-native-library on windows and yarn install. dockerfile below is not working:  ``` FROM node:24-alpine WORKDIR /app COPY package.json yarn.lock ./ RUN  corepack enable RUN  yarn set version 4.11.0 RUN yarn install --immutable ```  <img width="1521" height="669" alt="Image" src="https://github.com/user-attachments/assets/9218463f-552e-4e81-9687-7744c602df21" />  ### Packages  - [x] create-react-native-library - [ ] react-native-builder-bob  ### Selected options  <img width="750" height="229" alt="Image" src="https://github.com/user-attachments/assets/03b15b73-a60d-4031-bc66-428846590cf6" />  ### Link to repro  n/a  ### Environment  info Fetching system and libraries information... System:   OS: Windows 11 10.0.26200   CPU: (8) x64 Intel(R) Core(TM) Ultra 7 256V   Memory: 1.91 GB / 15.60 GB Binaries:   Node:     version: 24.11.1     path: C:\nvm4w\nodejs\node.EXE   Yarn:     version: 4.11.0     path: C:\Users\myuser\AppData\Roaming\npm\yarn.CMD   npm:     version: 11.6.2     path: C:\nvm4w\nodejs\npm.CMD   Watchman: Not Found SDKs:   Android SDK: Not Found   Windows SDK:     AllowDevelopmentWithoutDevLicense: Enabled IDEs:   Android Studio: AI-252.25557.131.2521.14432022   Visual Studio: Not Found Languages:   Java:     version: 17.0.17     path: C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot\bin\javac.EXE   Ruby: Not Found npmPackages:   "@react-native-community/cli":     installed: 20.0.2     wanted: ^20.0.2   react: Not Found   react-nat
  **Post-Mortem & Fix Analysis**:
  > After trying to understand its seems the problem is related to a depency that works on windows but not on linux. I´ve removed the "example" project workspace dependency on the root package.json and was able to make it work since it isolate node_modules depencies.  Didnt find the root issue yet but:  why is the "example" project being tied to root library (trought workspace)?  this decision brings example dependcies to root library yarn.lock and many problem since it has to be commited. As far as I know, the root library should be fully decoupled from example project.  btw, follow bellow all extra dependencies attached to the it when workspacing example: ``` pcb19a0 → ✓ @babel/helper-define-polyfill-provider@npm:0.6.5 [b493f] doesn't provide @types/supports-color to debug@npm:4.4.3 [8ccf6] p11839c → ✓ @babel/helper-define-polyfill-provider@npm:0.6.5 [b493f] doesn't provide supports-color to debug@npm:4.4.3 [8ccf6] p02bfd6 → ✓ @expo/cli@npm:54.0.18 [c074b] doesn't provide @types/bufferut
  > It's a monorepo - containing the library and example app - to simplify development. So it is expected that if you only copy the root `package.json`, then the `yarn.lock` will change.  If you don't want a monorepo, then you can remove the `workspaces` field. However, you'd then need to ensure that you install dependencies separately for the root and example app during development.  > this decision brings example dependcies to root library yarn.lock and many problem since it has to be commited. > As far as I know, the root library should be fully decoupled from example project.  We haven't had any issues due to this. If this is what you want, then you're free to change it for your project.  

- **Issue #913** (2025-12-10): **create-react-native-library --tools inconveniences**
  *Symptoms*: ### Description  0.55.0 added `--tools` which introduces a few inconveniences:  1. `--tools` eagerly consumes all further arguments that don't start with `-`. Notably you cannot put the library name at the end of the command anymore:  ``` $ npx create-react-native-library@latest [...] --tools eslint mylib Unzulässige Werte:   Argument: tools, Gegeben: "mylib", Möglichkeiten: "eslint", "lefthook", "release-it", "jest" ```  2. I couldn't find a way to select _no_ tools without setting `--local true`. I might not want any of these tools despite creating a non-local library though.  3. The addition of `--tools` is a breaking change as it is required and has no default value. It would be helpful if this could be called out in the release notes or through semantic versioning.  ### Packages  - [x] create-react-native-library - [ ] react-native-builder-bob  ### Selected options  See above  ### Link to repro  -  ### Environment  -
  **Post-Mortem & Fix Analysis**:
  > Hey @Johennes, I'm working on a [refactor](https://github.com/callstack/react-native-builder-bob/pull/915) that will allow specifying `--tools=` without any values to say that you don't want to configure any tools.  The `--tools eslint jest` format is an artifact of the yargs library - but after the refactor yargs is no longer used, so it won't treat positionals as the value of the argument, but require `--tools eslint --tools jest` to specify multiple tools.  As the CLI is still 0.x, breaking changes can still happen due to semver, but I'll try to document CLI related changes in the changelog.
  > This sounds excellent, thank you. 👍

- **Issue #912** (2026-01-11): **Cannot read property 'useContext' of null**
  *Symptoms*: ### Description  problem happened after changing default project to return an element ("Text") mainly on windows  <img width="575" height="911" alt="Image" src="https://github.com/user-attachments/assets/27188b67-f114-47de-ac60-5c99ac3aab5b" />  <img width="506" height="260" alt="Image" src="https://github.com/user-attachments/assets/7a45b1bc-181f-4548-be1b-b2f8ec643223" />  i tested it in different enviroments and OS. was able to make it work only 1 version of ubuntu  ### Packages  - [x] create-react-native-library - [ ] react-native-builder-bob  ### Selected options  <img width="632" height="220" alt="Image" src="https://github.com/user-attachments/assets/8199ed5d-ed05-4934-9a4a-12c812de43f7" />  ### Link to repro  notpublished  ### Environment  @react-native-community/cli": "latest" nvm -v  1.2.2 npm -v 11.6.2 yarn -v 1.22.22
  **Post-Mortem & Fix Analysis**:
  > the problem happens its been deployed with react, and react-native on devDependecies of package.json. Removing it will fix it
  > after digging deeper the problem happened because of different react and react-native dependecies since they are being used in dev and peer dependencies at the same time
  > I have released a new version that should fix this on Windows. You can try upgrading `react-native-builder-bob` and `react-native-monorepo-config` packages in your project.

- **Issue #909** (2026-02-26): **Pod install - LoadError - cannot load such file -- kconv**
  *Symptoms*: ### Description  If you have xcframework and use default rn-bb template for Ruby 3.4.0 you can see this exception on pod install.  https://github.com/CocoaPods/CocoaPods/issues/12805  I add   gem 'nkf' gem 'base64'  to Gemfile   ### Packages  - [ ] create-react-native-library - [x] react-native-builder-bob  ### Selected options  -  ### Link to repro  .  ### Environment  default
  **Post-Mortem & Fix Analysis**:
  > Experiencing the same issue with our example app in MapLibre RN. @Alexufo how did you come up with that fix?  I'm wondering what broke, because I think I haven't changed dependencies or my setup.
  > It's an upstream issue: https://github.com/ckruse/CFPropertyList/issues/74
  > gem 'nkf' - should be sufficient

- **Issue #908** (2025-11-14): **Unable to build android using local module in expo sdk 53**
  *Symptoms*: ### Description  I am getting below issues when i initiated the local module   ``` > Task :react-native-vision-camera:generateCodegenSchemaFromJavaScript No modules to process in combine-js-to-schema-cli. If this is unexpected, please check if you set up your NativeComponent correctly. See combine-js-to-schema.js for how codegen finds modules.  > Task :react-native-posedetection:compileDebugKotlin FAILED e: file:///Users/itech/Desktop/Learning_Room/Office-reactnative-template/reactnativetemplateapp/node_modules/react-native-posedetection/android/src/main/java/com/posedetection/PosedetectionModule.kt:8:3 Unresolved reference 'NativePosedetectionSpec'. e: file:///Users/itech/Desktop/Learning_Room/Office-reactnative-template/reactnativetemplateapp/node_modules/react-native-posedetection/android/src/main/java/com/posedetection/PosedetectionModule.kt:10:3 'getName' overrides nothing. e: file:///Users/itech/Desktop/Learning_Room/Office-reactnative-template/reactnativetemplateapp/node_modules/react-native-posedetection/android/src/main/java/com/posedetection/PosedetectionPackage.kt:12:12 Return type mismatch: expected 'com.facebook.react.bridge.NativeModule?', actual 'com.posedetection.PosedetectionModule?'.  [Incubating] Problems report is available at: file:///Users/itech/Desktop/Learning_Room/Office-reactnative-template/reactnativetemplateapp/android/build/reports/problems/problems-report.html  FAILURE: Build failed with an exception.  * What went wrong: Execution failed for task
  **Post-Mortem & Fix Analysis**:
  > My Bad, I added setup turbomodules in package.json and it worked

- **Issue #892** (2025-10-04): **Outdated Nitro Module Template**
  *Symptoms*: ### Description  The Nitro Module Template seems outdated or broken, the dependency `nitro-codegen` has been deprecated and removed from NPM, hence the scaffolding breaks.  ``` DEPRECATED ⚠️  - Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.  dist .tarball: https://registry.npmjs.org/nitro-codegen/-/nitro-codegen-0.29.4.tgz .shasum: 27b331f2a6d2e8030a19554d04d724853e78492e .integrity: sha512-jHLm8JuSqxWco7zhPnv2wUnm0zwgCDKVzrekRSnCqdEKxDUDyA6sVNNTeeOUx1k8Pit51J2bXnf3/sJBXwut5g== .unpackedSize: 422 B ```  ### Packages  - [x] create-react-native-library - [ ] react-native-builder-bob  ### Selected options  Nitro Module  ### Link to repro  https://empty  ### Environment  Empty
  **Post-Mortem & Fix Analysis**:
  > Fixed in create-react-native-library@0.54.4

- **Issue #888** (2025-09-30): **Example Project Fails to Start – “Error: Unable to resolve module react-native”**
  *Symptoms*: ### Description  After creating a new project using ‎`create-react-native-library`, I followed the standard steps to set up and run the example project. However, running ‎`npm start` results in a error:  ```   BUNDLE  ./index.js  ERROR  Error: Unable to resolve module react-native from /Users/foo/code/create-react-native-library-example/example/index.js: react-native could not be found within the project or in these directories:   node_modules   ../node_modules   /Users/foo/code/create-react-native-library-example/node_modules/react-native > 1 | import { AppRegistry } from 'react-native';     |                              ^   2 | import App from './src/App';   3 | import { name as appName } from './app.json';   4 |     at ModuleResolver.resolveDependency (/Users/foo/code/create-react-native-library-example/node_modules/metro/src/node-haste/DependencyGraph/ModuleResolution.js:150:15)     at DependencyGraph.resolveDependency (/Users/foo/code/create-react-native-library-example/node_modules/metro/src/node-haste/DependencyGraph.js:239:43)     at /Users/foo/code/create-react-native-library-example/node_modules/metro/src/lib/transformHelpers.js:161:21     at resolveDependencies (/Users/foo/code/create-react-native-library-example/node_modules/metro/src/DeltaBundler/buildSubgraph.js:43:25)     at visit (/Users/foo/code/create-react-native-library-example/node_modules/metro/src/DeltaBundler/buildSubgraph.js:81:30)     at process.processTicksAndRejections (node:internal/process/task_
  **Post-Mortem & Fix Analysis**:
  > try reproduce in ubuntu, using yarn and node 22.20.0 and not getting error
  > facing same issue on mac and windows
  > As outlined in the generated project's development workflow, it's configured to use Yarn workspaces, not npm. You'll need to use yarn, or modify the project to work with npm.

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

### Incident Patch 1: `e7b11cab` (2026-09-08)
**Commit Message**: fix: fix bob init producing incorrect paths on windows (#954)

Co-authored-by: Kallinikos Milonakis <[REDACTED_EMAIL]>

**File**: `.gitattributes` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+* text=auto eol=lf
+*.bat text eol=crlf
+*.cmd text eol=crlf
```

**File**: `.github/workflows/check-project.yml` (modified, +15/-3)
```diff
@@ -28,8 +28,20 @@ jobs:
       - name: Typecheck
         run: yarn typecheck
 
-      - name: Test
-        run: yarn test
-
       - name: Build packages
         run: yarn lerna run prepare
+
+  test:
+    strategy:
+      matrix:
+        os: [ubuntu-latest, windows-latest]
+    runs-on: ${{ matrix.os }}
+    steps:
+      - name: Checkout
+        uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
+
+      - name: Setup
+        uses: ./.github/actions/setup
+
+      - name: Test
+        run: yarn test
```

**File**: `packages/react-native-builder-bob/src/init.ts` (modified, +5/-5)
```diff
@@ -157,11 +157,11 @@ export async function init() {
 
   if (targets.includes('module')) {
     esm = true;
-    entries.module = `./${path.join(output, 'module', 'index.js')}`;
+    entries.module = `./${path.posix.join(output, 'module', 'index.js')}`;
   }
 
   if (targets.includes('commonjs')) {
-    entries.commonjs = `./${path.join(output, 'commonjs', 'index.js')}`;
+    entries.commonjs = `./${path.posix.join(output, 'commonjs', 'index.js')}`;
   }
 
   const types: {
@@ -170,23 +170,23 @@ export async function init() {
 
   if (targets.includes('typescript')) {
     if (targets.includes('commonjs') && targets.includes('module')) {
-      types.require = `./${path.join(
+      types.require = `./${path.posix.join(
         output,
         'typescript',
         'commonjs',
         source,
         'index.d.ts'
       )}`;
 
-      types.import = `./${path.join(
+      types.import = `./${path.posix.join(
         output,
         'typescript',
         'module',
         source,
         'index.d.ts'
       )}`;
     } else {
-      types.require = `./${path.join(
+      types.require = `./${path.posix.join(
         output,
         'typescript',
         source,
```

---

### Incident Patch 2: `844957e9` (2026-09-08)
**Commit Message**: fix: add ndkVersion to nitro library templates (#951)

<!-- Please provide enough information so that others can review your
pull request. -->
<!-- Keep pull requests small and focused on a single change. -->

### Summary
This fixes an issue where library and app compiles with different NDKs.
Please refer to my issue here
https://github.com/react/react-native/issues/58005 for more details
<!-- What existing problem does the pull request solve? Can you solve
the issue with a different approach? -->

### Test plan

<!-- List the steps with which we can test this change. Provide
screenshots if this changes anything visual. -->|
Before (2Ndks 27 & 28) 
<img width="1486" height="166" alt="image"
src="https://github.com/user-attachments/assets/9eedd526-1ea5-4374-9602-e7cccd8da9de"
/>
After (1Ndk 27) 
<img width="1445" height="135" alt="image"
src="https://github.com/user-attachments/assets/de5f23b3-3eef-4795-a914-9cd8a1263152"
/>

---------

Co-authored-by: Satyajit Sahoo <[REDACTED_EMAIL]>

**File**: `packages/create-react-native-library/templates/native-common/android/build.gradle` (modified, +4/-0)
```diff
@@ -77,6 +77,10 @@ android {
   }
 <% if (project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
 
+  if (rootProject.ext.has("ndkVersion")) {
+    ndkVersion rootProject.ext.ndkVersion
+  }
+
   externalNativeBuild {
     cmake {
       path "CMakeLists.txt"
```

---

### Incident Patch 3: `79195350` (2026-09-08)
**Commit Message**: fix: handle AGP9's built-in kotlin support

**File**: `packages/create-react-native-library/templates/native-common/android/build.gradle` (modified, +5/-1)
```diff
@@ -33,7 +33,11 @@ def reactNativeArchitectures() {
 <% } -%>
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+
+if (project.extensions.findByName("kotlin") == null) {
+  apply plugin: "kotlin-android"
+}
+
 <% if (project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
 apply from: '../nitrogen/generated/android/<%- project.package_cpp -%>+autolinking.gradle'
 <% } -%>
```

---

### Incident Patch 4: `dab4b2a6` (2026-09-08)
**Commit Message**: fix: remove expo-dev-client from expo example

it shows onboarding sheet and tools button by default,
which is annoying for tests and automation.

if users want it, they can easily install it back.

**File**: `packages/create-react-native-library/src/exampleApp/generateExampleApp.ts` (modified, +0/-10)
```diff
@@ -48,10 +48,6 @@ const PACKAGES_TO_ADD_EXPO_WEB = {
   'react-native-web': '~0.21.0',
 };
 
-const PACKAGES_TO_ADD_DEV_EXPO_NATIVE = {
-  'expo-dev-client': '~57.0.10',
-};
-
 async function fetchReactNativeVersion(version: string) {
   const matchedReactNativeVersion = /(\d+\.\d+[-.0-9a-z]*)/.test(version)
     ? version
@@ -367,12 +363,6 @@ export default async function generateExampleApp({
     }
 
     if (config.project.native) {
-      Object.entries(PACKAGES_TO_ADD_DEV_EXPO_NATIVE).forEach(
-        ([name, version]) => {
-          devDependencies[name] = bundledNativeModules[name] || version;
-        }
-      );
-
       scripts.start = 'expo start --dev-client';
       scripts.android = 'expo run:android';
       scripts.ios = 'expo run:ios';
```

---

### Incident Patch 5: `ca7bdc0e` (2026-08-05)
**Commit Message**: fix: gracefully handle expo calling babel config without a filename

**File**: `packages/react-native-builder-bob/src/configs/babel-config.cjs` (modified, +3/-1)
```diff
@@ -34,7 +34,9 @@ const getConfig = (defaultConfig, { root }) => {
     overrides: [
       ...(defaultConfig.overrides == null ? [] : defaultConfig.overrides),
       {
-        include: path.join(root, source),
+        include: (filename) =>
+          filename != null &&
+          filename.startsWith(`${path.join(root, source)}${path.sep}`),
         presets: [
           [
             require.resolve('./babel-preset.cjs'),
```

---

### Incident Patch 6: `e73deb65` (2026-06-11)
**Commit Message**: ci: add workflow to test building local libraries (#947)

**File**: `.github/workflows/build-local-libraries.yml` (added, +239/-0)
```diff
@@ -0,0 +1,239 @@
+name: Build local library
+on:
+  workflow_dispatch:
+  schedule:
+    - cron: "0 0 * * *"
+  push:
+    branches:
+      - main
+      - next
+  pull_request:
+    branches:
+      - main
+      - next
+  merge_group:
+    types:
+      - checks_requested
+
+permissions:
+  contents: read
+
+jobs:
+  build:
+    env:
+      XCODE_VERSION: 26
+      RCT_REMOVE_LEGACY_ARCH: 1
+      RCT_USE_RN_DEP: 1
+      RCT_USE_PREBUILT_RNCORE: 1
+      REACT_NATIVE_VERSION: 0.85.0
+      EXPO_SDK_VERSION: 55
+      APP_NAME: LocalLibraryApp
+      LIBRARY_NAME: TestLibrary
+      LIBRARY_DIR: modules/TestLibrary
+
+    strategy:
+      fail-fast: false
+      matrix:
+        os:
+          - ubuntu-latest
+          - macos-latest
+        app:
+          - community-cli
+          - expo
+        type:
+          - name: turbo-module
+            language: kotlin-objc
+          - name: nitro-module
+            language: kotlin-swift
+
+    concurrency:
+      group: ${{ github.workflow }}-${{ github.ref }}-${{ matrix.os }}-${{ matrix.app }}-${{ matrix.type.name }}-${{ matrix.type.language }}
+      cancel-in-progress: true
+
+    runs-on: ${{ matrix.os }}
+
+    steps:
+      - name: Checkout
+        uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
+
+      - name: Setup
+        uses: ./.github/actions/setup
+
+      - name: Build package
+        run: |
+          yarn workspace create-react-native-library prepare
+
+      - name: Create app
+        shell: bash
+        run: |
+          if [[ "${{ matrix.app }}" == "community-cli" ]]; then
+            npx @react-native-community/cli init "$APP_NAME" \
+              --directory "$APP_NAME" \
+              --version "$REACT_NATIVE_VERSION" \
+              --skip-install \
+              --skip-git-init \
+              --pm npm \
+              --package-name com.locallibraryapp
+          else
+            npx create-expo-app@latest "$APP_NAME" \
+              --no-install \
+              --template "blank@sdk-$EXPO_SDK_VERSION"
+          fi
+
+      - name: Create local library
+        working-directory: ${{ env.APP_NAME }}
+        shell: bash
+        run: |
+          ../packages/create-react-native-library/bin/create-react-native-library "$LIBRARY_NAME" \
+            --local \
+            --directory "$LIBRARY_DIR" \
+            --slug @bob/react-native-test \
+            --description test \
+            --type ${{ matrix.type.name }} \
+            --languages ${{ matrix.type.language }}
+
+      - name: Restore dependencies of app
+        id: app-npm-cache
+        uses: actions/cache/restore@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
+        with:
+          path: |
+            ${{ env.APP_NAME }}/node_modules
+            ${{ env.APP_NAME }}/package-lock.json
+          key: ${{ runner.os }}-local-library-npm-${{ matrix.app }}-${{ matrix.type.name }}-${{ matrix.type.language }}-${{ hashFiles(format('{0}/package.json', env.APP_NAME), format('{0}/modules/**/package.json', env.APP_NAME)) }}
+          restore-keys: |
+            ${{ runner.os }}-local-library-npm-${{ matrix.app }}-${{ matrix.type.name }}-${{ matrix.type.language }}-
+            ${{ runner.os }}-local-library-npm-${{ matrix.app }}-
+
+      - name: Install dependencies of app
+        if: steps.app-npm-cache.outputs.cache-hit != 'true'
+        working-directory: ${{ env.APP_NAME }}
+        run: |
+          npm install --no-audit --no-fund
+
+      - name: Cache dependencies of app
+        if: steps.app-npm-cache.outputs.cache-hit != 'true'
+        uses: actions/cache/save@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
+        with:
+          path: |
+            ${{ env.APP_NAME }}/node_modules
+            ${{ env.APP_NAME }}/package-lock.json
+          key: ${{ steps.app-npm-cache.outputs.cache-primary-key }}
+
+      - name: Generate nitrogen code
+        if: matrix.type.name == 'nitro-module'
+        working-directory: ${{ env.APP_NAME }}/${{ env.LIBRARY_DIR }}
+        shell: bash
+        run: |
+          nitro_version=$(node -p "require('../../package.json').dependencies['react-native-nitro-modules']")
+          npm exec --yes --package "nitrogen@$nitro_version" -- nitrogen
+
+      - name: Check local build cache
+        if: github.event_name != 'schedule'
+        id: local-build-cache
+        uses: actions/cache/restore@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
+        with:
+          lookup-only: true
+          path: ${{ env.APP_NAME }}/.local-build-cache
+          key: ${{ runner.os }}-local-library-build-${{ matrix.app }}-${{ matrix.type.name }}-${{ matrix.type.language }}-${{ env.REACT_NATIVE_VERSION }}-${{ env.EXPO_SDK_VERSION }}-${{ hashFiles('yarn.lock', 'package.json', '.github/workflows/build-local-libraries.yml', 'packages/create-react-native-library/package.json', 'packages/create-react-native-library/src/**', 'packages/create-react-native-library/templates/**') }}
+
+      
```

**File**: `.github/workflows/build-templates.yml` (modified, +4/-1)
```diff
@@ -15,6 +15,9 @@ on:
     types:
       - checks_requested
 
+permissions:
+  contents: read
+
 jobs:
   build:
     env:
@@ -30,7 +33,7 @@ jobs:
       matrix:
         os:
           - ubuntu-latest
-          - macos-15
+          - macos-latest
         type:
           - name: turbo-module
             language: kotlin-objc
```

**File**: `packages/create-react-native-library/package.json` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@
     "github-username": "^9.0.0",
     "kleur": "^4.1.5",
     "ora": "^9.3.0",
-    "pigment": "^0.4.4",
+    "pigment": "^0.4.5",
     "typescript": "^6.0.3",
     "validate-npm-package-name": "^7.0.2"
   },
```

**File**: `packages/create-react-native-library/src/index.ts` (modified, +5/-1)
```diff
@@ -48,6 +48,10 @@ async function create() {
 
   console.log(''); // Empty new line after prompts
 
+  if (answers.directory == null) {
+    throw new Error('Missing required option: --directory');
+  }
+
   const bobVersion = await bobVersionPromise;
   const nitroModulesVersion =
     answers.type === 'nitro-module' || answers.type === 'nitro-view'
@@ -101,7 +105,7 @@ async function create() {
     spinner.text = 'Configuring tools';
 
     await configureTools({
-      tools: answers.tools,
+      tools: config.tools,
       config,
       root: folder,
       packageJson: rootPackageJson,
```

**File**: `packages/create-react-native-library/src/prompt.ts` (modified, +5/-0)
```diff
@@ -172,6 +172,7 @@ export const prompt = create(['[name]'], {
       return answers.name;
     },
     validate: validateDirectory,
+    required: true,
     skip: () => {
       const answers = prompt.read();
 
@@ -261,6 +262,7 @@ export const prompt = create(['[name]'], {
     message: 'What is the name of the package author?',
     default: async () => getGitConfig('user.name'),
     validate: (input) => Boolean(input) || 'Cannot be empty',
+    required: true,
     skip: (): boolean => prompt.read().local === true,
   },
   authorEmail: {
@@ -270,6 +272,7 @@ export const prompt = create(['[name]'], {
     default: async () => getGitConfig('user.email'),
     validate: (input) =>
       /^\S+@\S+$/.test(input) || 'Must be a valid email address',
+    required: true,
     skip: (): boolean => prompt.read().local === true,
   },
   authorUrl: {
@@ -296,6 +299,7 @@ export const prompt = create(['[name]'], {
       return undefined;
     },
     validate: (input) => /^https?:\/\//.test(input) || 'Must be a valid URL',
+    required: true,
     skip: (): boolean => prompt.read().local === true,
   },
   repoUrl: {
@@ -318,6 +322,7 @@ export const prompt = create(['[name]'], {
       return undefined;
     },
     validate: (input) => /^https?:\/\//.test(input) || 'Must be a valid URL',
+    required: true,
     skip: (): boolean => prompt.read().local === true,
   },
   type: {
```

**File**: `packages/create-react-native-library/src/template.ts` (modified, +30/-5)
```diff
@@ -151,6 +151,31 @@ export function generateTemplateConfiguration({
 }): TemplateConfiguration {
   const { slug, languages, type } = answers;
 
+  let { authorName, authorEmail, authorUrl, repoUrl } = answers;
+
+  if (answers.local) {
+    authorName = '';
+    authorEmail = '';
+    authorUrl = '';
+    repoUrl = '';
+  } else {
+    if (authorName == null) {
+      throw new Error('Missing required option: --author-name');
+    }
+
+    if (authorEmail == null) {
+      throw new Error('Missing required option: --author-email');
+    }
+
+    if (authorUrl == null) {
+      throw new Error('Missing required option: --author-url');
+    }
+
+    if (repoUrl == null) {
+      throw new Error('Missing required option: --repo-url');
+    }
+  }
+
   const project = slug.replace(/^(react-native-|@[^/]+\/)/, '');
   let namespace: string | undefined;
 
@@ -190,13 +215,13 @@ export function generateTemplateConfiguration({
       moduleConfig: getModuleConfig(type),
     },
     author: {
-      name: answers.authorName,
-      email: answers.authorEmail,
-      url: answers.authorUrl,
+      name: authorName,
+      email: authorEmail,
+      url: authorUrl,
     },
-    repo: answers.repoUrl,
+    repo: repoUrl,
     example: answers.example,
-    tools: answers.tools,
+    tools: answers.tools ?? [],
     year: new Date().getFullYear(),
   };
 }
```

**File**: `packages/create-react-native-library/templates/common-local/$package.json` (modified, +13/-1)
```diff
@@ -6,7 +6,19 @@
   "codegenConfig": {
     "name": "<%- project.name -%><%- project.viewConfig !== null ? 'View': '' -%>Spec",
     "type": <%- project.viewConfig !== null ? '"all"': '"modules"' %>,
-    "jsSrcsDir": "src"
+    "jsSrcsDir": "src",
+    "android": {
+      "javaPackageName": "com.<%- project.package %>"
+    <% if (project.viewConfig === 'fabric-view') { -%>
+    },
+    "ios": {
+      "components": {
+        "<%- project.name -%>View": {
+          "className": "<%- project.name -%>View"
+        }
+      }
+    <% } -%>
+    }
   },
   "author": "<%- author.name -%> <<%- author.email -%>> (<%- author.url -%>)",
   "license": "UNLICENSED",
```

**File**: `yarn.lock` (modified, +5/-5)
```diff
@@ -5347,7 +5347,7 @@ __metadata:
     github-username: "npm:^9.0.0"
     kleur: "npm:^4.1.5"
     ora: "npm:^9.3.0"
-    pigment: "npm:^0.4.4"
+    pigment: "npm:^0.4.5"
     typescript: "npm:^6.0.3"
     validate-npm-package-name: "npm:^7.0.2"
   bin:
@@ -10105,13 +10105,13 @@ __metadata:
   languageName: node
   linkType: hard
 
-"pigment@npm:^0.4.4":
-  version: 0.4.4
-  resolution: "pigment@npm:0.4.4"
+"pigment@npm:^0.4.5":
+  version: 0.4.5
+  resolution: "pigment@npm:0.4.5"
   dependencies:
     ansi-escapes: "npm:^7.2.0"
     wrap-ansi: "npm:^9.0.2"
-  checksum: 10c0/d2663d4e44603ed4bdab7b1c7c73c0c8a42390599c7f7f880dc91b2cb00f252667e9e22606ca7c56db6bd36e4a6067e68141afd17d1e7d03867da8866bde5bb0
+  checksum: 10c0/696ba9feee6f22d59de62a37e31ced40845dc061c78175b18805eb9550215685e5fd6612e355025742152d8bc093b56ef258044e5dae7265d781cd2b353b3aac
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 7: `499d8228` (2026-06-10)
**Commit Message**: fix: scope name of local library with app name by default

**File**: `packages/create-react-native-library/src/prompt.ts` (modified, +30/-0)
```diff
@@ -204,6 +204,36 @@ export const prompt = create(['[name]'], {
       const basename = path.basename(value);
 
       if (validateNpmPackage(basename).validForNewPackages) {
+        if (answers.local) {
+          try {
+            const { name }: { name?: string } = JSON.parse(
+              fs.readFileSync(
+                path.resolve(process.cwd(), 'package.json'),
+                'utf8'
+              )
+            );
+
+            const scopeOrName = name?.split('/')?.[0];
+
+            if (scopeOrName) {
+              const scope = scopeOrName?.startsWith('@')
+                ? scopeOrName
+                : `@${scopeOrName}`;
+
+              const packageName = `${scope}/${basename}`;
+
+              if (
+                scopeOrName &&
+                validateNpmPackage(packageName).validForNewPackages
+              ) {
+                return packageName;
+              }
+            }
+          } catch {
+            // Ignore invalid package.json and use the regular default.
+          }
+        }
+
         if (/^(@|react-native)/.test(basename)) {
           return basename;
         }
```

---

### Incident Patch 8: `8fc9f227` (2026-06-10)
**Commit Message**: refactor: simplify and update build.gradle (#946)

**File**: `packages/create-react-native-library/templates/native-common/android/build.gradle` (modified, +33/-43)
```diff
@@ -2,8 +2,7 @@ buildscript {
   ext.<%- project.name -%> = [
     kotlinVersion: "2.0.21",
     minSdkVersion: 24,
-    compileSdkVersion: 36,
-    targetSdkVersion: 36
+    compileSdkVersion: 36
   ]
 
   ext.getExtOrDefault = { prop ->
@@ -26,7 +25,7 @@ buildscript {
   }
 }
 
-<% if (project.cpp || project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
+<% if (project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
 def reactNativeArchitectures() {
   def value = rootProject.getProperties().get("reactNativeArchitectures")
   return value ? value.split(",") : ["armeabi-v7a", "x86", "x86_64", "arm64-v8a"]
@@ -52,8 +51,7 @@ android {
 
   defaultConfig {
     minSdkVersion getExtOrDefault("minSdkVersion")
-    targetSdkVersion getExtOrDefault("targetSdkVersion")
-<% if (project.cpp || project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
+<% if (project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
 
     externalNativeBuild {
       cmake {
@@ -73,58 +71,50 @@ android {
     }
 <% } -%>
   }
-<% if (project.cpp || project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
+<% if (project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
 
   externalNativeBuild {
     cmake {
       path "CMakeLists.txt"
     }
   }
-<% } -%>
-<% if (project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
 
-  packagingOptions {
-    excludes = [
-      "META-INF",
-      "META-INF/**",
-      "**/libc++_shared.so",
-      "**/libfbjni.so",
-      "**/libjsi.so",
-      "**/libfolly_json.so",
-      "**/libfolly_runtime.so",
-      "**/libglog.so",
-      "**/libhermes.so",
-      "**/libhermes-executor-debug.so",
-      "**/libhermes_executor.so",
-      "**/libreactnative.so",
-      "**/libreactnativejni.so",
-      "**/libturbomodulejsijni.so",
-      "**/libreact_nativemodule_core.so",
-      "**/libjscexecutor.so"
-    ]
-  }
-<% } -%>
-
-  buildFeatures {
-    buildConfig true
-<% if (project.moduleConfig === 'nitro-modules' || project.viewConfig === 'nitro-view') { -%>
-    prefab true
-<% } -%>
-  }
+  packaging {
+    resources {
+      excludes += [
+        "META-INF",
+        "META-INF/**"
+      ]
+    }
 
-  buildTypes {
-    release {
-      minifyEnabled false
+    jniLibs {
+      excludes += [
+        "**/libc++_shared.so",
+        "**/libfbjni.so",
+        "**/libjsi.so",
+        "**/libfolly_json.so",
+        "**/libfolly_runtime.so",
+        "**/libglog.so",
+        "**/libhermes.so",
+        "**/libhermes-executor-debug.so",
+        "**/libhermes_executor.so",
+        "**/libreactnative.so",
+        "**/libreactnativejni.so",
+        "**/libturbomodulejsijni.so",
+        "**/libreact_nativemodule_core.so",
+        "**/libjscexecutor.so"
+      ]
     }
   }
 
-  lint {
-    disable "GradleCompatible"
+  buildFeatures {
+    prefab true
   }
+<% } -%>
 
   compileOptions {
-    sourceCompatibility JavaVersion.VERSION_1_8
-    targetCompatibility JavaVersion.VERSION_1_8
+    sourceCompatibility JavaVersion.VERSION_17
+    targetCompatibility JavaVersion.VERSION_17
   }
 }
 
```

---

### Incident Patch 9: `17225a95` (2026-06-08)
**Commit Message**: fix: rework typescript binary resolution to use node resolution

**File**: `packages/react-native-builder-bob/src/__tests__/typescript-declarations.test.ts` (removed, +0/-269)
```diff
@@ -1,269 +0,0 @@
-import os from 'node:os';
-import path from 'node:path';
-import { decode } from '@jridgewell/sourcemap-codec';
-import fs from 'fs-extra';
-import { expect, test, vi } from 'vitest';
-import build from '../targets/typescript.ts';
-import type { Report } from '../types.ts';
-import { spawn } from '../utils/spawn.ts';
-
-const tsc = path.resolve(
-  import.meta.dirname,
-  '../../../../node_modules/.bin',
-  process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
-);
-
-const report: Report = {
-  info: vi.fn(),
-  warn: vi.fn(),
-  success: vi.fn(),
-  error: vi.fn(),
-};
-
-const readDeclarationMap = async (filepath: string) => {
-  const value: unknown = await fs.readJSON(filepath);
-
-  if (
-    value == null ||
-    typeof value !== 'object' ||
-    !('mappings' in value) ||
-    typeof value.mappings !== 'string' ||
-    !('sources' in value) ||
-    !Array.isArray(value.sources) ||
-    !value.sources.every((source) => typeof source === 'string')
-  ) {
-    throw new Error('Invalid declaration map.');
-  }
-
-  return {
-    mappings: value.mappings,
-    sources: value.sources,
-  };
-};
-
-const buildLibrary = async (
-  root: string,
-  {
-    files,
-    compilerOptions,
-    packageJson,
-  }: {
-    files: Record<string, string>;
-    compilerOptions?: Record<string, unknown>;
-    packageJson?: Record<string, unknown>;
-  }
-) => {
-  await fs.writeJSON(path.join(root, 'package.json'), {
-    name: 'library',
-    version: '1.0.0',
-    type: 'module',
-    exports: {
-      '.': {
-        types: './lib/typescript/src/index.d.ts',
-      },
-    },
-    ...packageJson,
-  });
-
-  await fs.writeJSON(path.join(root, 'tsconfig.json'), {
-    compilerOptions: {
-      module: 'ESNext',
-      moduleResolution: 'Bundler',
-      rootDir: '.',
-      strict: true,
-      target: 'ESNext',
-      ...compilerOptions,
-    },
-    include: ['src/**/*'],
-  });
-
-  await Promise.all(
-    Object.entries(files).map(async ([name, content]) =>
-      fs.outputFile(path.join(root, name), content)
-    )
-  );
-
-  await build({
-    root,
-    source: path.join(root, 'src'),
-    output: path.join(root, 'lib/typescript'),
-    report,
-    options: { project: 'tsconfig.json', tsc },
-    esm: true,
-    variants: { module: true },
-  });
-};
-
-const typeCheckConsumer = async (root: string, index: string) => {
-  const consumer = path.join(root, 'consumer');
-
-  await fs.ensureSymlink(root, path.join(consumer, 'node_modules/library'));
-  await fs.writeJSON(path.join(consumer, 'package.json'), {
-    type: 'module',
-  });
-  await fs.writeJSON(path.join(consumer, 'tsconfig.json'), {
-    compilerOptions: {
-      module: 'NodeNext',
-      moduleResolution: 'NodeNext',
-      strict: true,
-      target: 'ESNext',
-    },
-    include: ['index.ts'],
-  });
-  await fs.outputFile(path.join(consumer, 'index.ts'), index);
-
-  try {
-    await spawn(tsc, ['--noEmit', '--project', 'tsconfig.json'], {
-      cwd: consumer,
-    });
-
-    return undefined;
-  } catch (error) {
-    if (
-      error != null &&
-      typeof error === 'object' &&
-      'stdout' in error &&
-      typeof error.stdout === 'string'
-    ) {
-      return error.stdout;
-    }
-
-    throw error;
-  }
-};
-
-test('adds extensions to declarations for NodeNext resolution', async () => {
-  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bob-typescript-'));
-
-  try {
-    await buildLibrary(root, {
-      compilerOptions: { allowImportingTsExtensions: true },
-      files: {
-        'src/index.ts': [
-          "export { type Foo } from './foo';",
-          "export * from './star';",
-          "export { type Bar } from './nested';",
-          "export { type Baz } from './explicit.ts';",
-          "export type UsesImportType = import('./foo').Foo;",
-        ].join('\n'),
-        'src/foo.ts': 'export type Foo = { value: string };\n',
-        'src/star.ts': 'export type Star = { value: string };\n',
-        'src/nested/index.ts': 'export type Bar = { value: string };\n',
-        'src/explicit.ts': 'export type Baz = { value: string };\n',
-      },
-    });
-
-    const declaration = await fs.readFile(
-      path.join(root, 'lib/typescript/src/index.d.ts'),
-      'utf-8'
-    );
-
-    expect(declaration).toContain("from './foo.js'");
-    expect(declaration).toContain("from './star.js'");
-    expect(declaration).toContain("from './nested/index.js'");
-    expect(declaration).toContain("from './explicit.js'");
-    expect(declaration).toContain("import('./foo.js').Foo");
-
-    const declarationMap = await readDeclarationMap(
-      path.join(root, 'lib/typescript/src/index.d.ts.map')
-    );
-
-    expect(declarationMap.mappings).toEqual(expect.any(String));
-    expect(
-      declarationMap.sources.some((source) => source.endsWith('/src/index.ts'))
-    ).toBe(true);
-
-    const firstLine = declaration.split('\n')[0];
-    const firstLineColumns = decode(declarationMap.mappings)[0]?.map(
-      (s
```

**File**: `packages/react-native-builder-bob/src/__tests__/typescript.test.ts` (modified, +235/-299)
```diff
@@ -1,333 +1,269 @@
+import os from 'node:os';
 import path from 'node:path';
-import mockFs from 'mock-fs';
-import { afterEach, beforeEach, expect, test, vi } from 'vitest';
-import build, { findBinInAncestorNodeModules } from '../targets/typescript.ts';
+import { decode } from '@jridgewell/sourcemap-codec';
+import fs from 'fs-extra';
+import { expect, test, vi } from 'vitest';
+import build from '../targets/typescript.ts';
 import type { Report } from '../types.ts';
 import { spawn } from '../utils/spawn.ts';
 
-const whichMock = vi.hoisted(() =>
-  vi.fn<(cmd: string, options: { nothrow: true }) => Promise<string | null>>()
+const tsc = path.resolve(
+  import.meta.dirname,
+  '../../../../node_modules/.bin',
+  process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
 );
 
-vi.mock('which', () => ({
-  default: whichMock,
-}));
+const report: Report = {
+  info: vi.fn(),
+  warn: vi.fn(),
+  success: vi.fn(),
+  error: vi.fn(),
+};
+
+const readDeclarationMap = async (filepath: string) => {
+  const value: unknown = await fs.readJSON(filepath);
+
+  if (
+    value == null ||
+    typeof value !== 'object' ||
+    !('mappings' in value) ||
+    typeof value.mappings !== 'string' ||
+    !('sources' in value) ||
+    !Array.isArray(value.sources) ||
+    !value.sources.every((source) => typeof source === 'string')
+  ) {
+    throw new Error('Invalid declaration map.');
+  }
 
-vi.mock('../utils/spawn.ts', () => ({
-  spawn: vi.fn(),
-}));
-
-const workspace = path.resolve('/workspace');
-const packageRoot = path.join(workspace, 'packages', 'library');
-const source = path.join(packageRoot, 'src');
-const output = path.join(packageRoot, 'lib');
-const spawnMock = vi.mocked(spawn);
-
-function createReport(): Report {
-  return {
-    error: vi.fn(),
-    info: vi.fn(),
-    success: vi.fn(),
-    warn: vi.fn(),
-  };
-}
-
-function library(files = {}) {
   return {
-    'package.json': JSON.stringify({ name: 'library' }),
-    'tsconfig.json': '{}',
-    src: {},
-    ...files,
+    mappings: value.mappings,
+    sources: value.sources,
   };
-}
-
-async function buildTypescript(options?: { tsc?: string }) {
-  const report = createReport();
-
-  await build({
-    root: packageRoot,
-    source,
-    output,
-    report,
-    options,
-    variants: { commonjs: true },
-    esm: false,
-  });
-
-  return report;
-}
-
-beforeEach(() => {
-  whichMock.mockResolvedValue(null);
-  spawnMock.mockResolvedValue('');
-});
-
-afterEach(() => {
-  mockFs.restore();
-  vi.clearAllMocks();
-});
-
-test('finds the nearest binary before the lookup limit', async () => {
-  const localTsc = path.join(packageRoot, 'node_modules', '.bin', 'tsc');
-
-  mockFs({
-    [workspace]: {
-      packages: {
-        library: {
-          node_modules: {
-            '.bin': {
-              tsc: '',
-            },
-          },
-        },
-      },
-      node_modules: {
-        '.bin': {
-          tsc: '',
-        },
+};
+
+const buildLibrary = async (
+  root: string,
+  {
+    files,
+    compilerOptions,
+    packageJson,
+  }: {
+    files: Record<string, string>;
+    compilerOptions?: Record<string, unknown>;
+    packageJson?: Record<string, unknown>;
+  }
+) => {
+  await fs.writeJSON(path.join(root, 'package.json'), {
+    name: 'library',
+    version: '1.0.0',
+    type: 'module',
+    exports: {
+      '.': {
+        types: './lib/typescript/src/index.d.ts',
       },
     },
+    ...packageJson,
   });
 
-  await expect(
-    findBinInAncestorNodeModules(packageRoot, 'tsc', workspace)
-  ).resolves.toBe(localTsc);
-});
-
-test('stops looking for binaries at the lookup limit', async () => {
-  const home = path.resolve('/home/user');
-  const workspace = path.join(home, 'workspace');
-  const packageRoot = path.join(workspace, 'packages', 'library');
-
-  mockFs({
-    [home]: {
-      node_modules: {
-        '.bin': {
-          tsc: '',
-        },
-      },
-      workspace: {
-        packages: {
-          library: {},
-        },
-      },
+  await fs.writeJSON(path.join(root, 'tsconfig.json'), {
+    compilerOptions: {
+      module: 'ESNext',
+      moduleResolution: 'Bundler',
+      rootDir: '.',
+      strict: true,
+      target: 'ESNext',
+      ...compilerOptions,
     },
+    include: ['src/**/*'],
   });
 
-  await expect(
-    findBinInAncestorNodeModules(packageRoot, 'tsc', workspace)
-  ).resolves.toBeUndefined();
-});
-
-test('finds Windows command binaries before the lookup limit', async () => {
-  const tsc = path.join(workspace, 'node_modules', '.bin', 'tsc.cmd');
+  await Promise.all(
+    Object.entries(files).map(async ([name, content]) =>
+      fs.outputFile(path.join(root, name), content)
+    )
+  );
 
-  mockFs({
-    [workspace]: {
-      packages: {
-        library: {},
-      },
-      node_modules: {
-        '.bin': {
-          'tsc.cmd': '',
-        },
-      },
-    },
+  await build({
+    root,
+    source: path.join(root, 'src'),
+    output: path.join(root, 'lib/typescrip
```

**File**: `packages/react-native-builder-bob/src/targets/typescript.ts` (modified, +49/-122)
```diff
@@ -1,3 +1,4 @@
+import { createRequire } from 'node:module';
 import { platform } from 'node:os';
 import path from 'node:path';
 import { deleteAsync } from 'del';
@@ -33,14 +34,6 @@ type Field = {
   message: string | undefined;
 };
 
-const LOCKFILES = [
-  'bun.lock',
-  'bun.lockb',
-  'package-lock.json',
-  'pnpm-lock.yaml',
-  'yarn.lock',
-];
-
 const DECLARATION_EXTENSIONS = [{ source: 'd.ts', output: 'js' }];
 
 const EXPLICIT_SOURCE_EXTENSIONS = ['ts', 'tsx'].map((source) => ({
@@ -50,61 +43,6 @@ const EXPLICIT_SOURCE_EXTENSIONS = ['ts', 'tsx'].map((source) => ({
 
 const DECLARATION_REWRITE_BATCH_SIZE = 32;
 
-function isPathInside(root: string, file: string) {
-  const relative = path.relative(root, file);
-  const isOutside = relative === '..' || relative.startsWith(`..${path.sep}`);
-
-  return relative === '' || (!isOutside && !path.isAbsolute(relative));
-}
-
-async function findWorkspaceRoot(root: string) {
-  let current = root;
-
-  while (true) {
-    for (const lockfile of LOCKFILES) {
-      if (await fs.pathExists(path.join(current, lockfile))) {
-        return current;
-      }
-    }
-
-    const parent = path.dirname(current);
-
-    if (parent === current) {
-      return root;
-    }
-
-    current = parent;
-  }
-}
-
-export async function findBinInAncestorNodeModules(
-  root: string,
-  binary: string,
-  limit: string
-) {
-  let current = root;
-
-  while (true) {
-    const candidate = path.resolve(current, 'node_modules', '.bin', binary);
-
-    if (await fs.pathExists(candidate)) {
-      return candidate;
-    }
-
-    if (current === limit) {
-      return undefined;
-    }
-
-    const parent = path.dirname(current);
-
-    if (parent === current) {
-      return undefined;
-    }
-
-    current = parent;
-  }
-}
-
 const getModuleSpecifier = (node: ts.Node) => {
   if (
     (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
@@ -303,73 +241,75 @@ export default async function build({
       );
     }
 
-    let tsc: string | null | undefined;
+    const args = [
+      '--pretty',
+      '--declaration',
+      '--declarationMap',
+      '--noEmit',
+      'false',
+      '--emitDeclarationOnly',
+      '--project',
+      project,
+    ];
+
+    let command: string | null;
 
     if (options?.tsc) {
-      tsc = path.resolve(root, options.tsc);
+      command = path.resolve(root, options.tsc);
 
-      if (!(await fs.pathExists(tsc))) {
+      if (!(await fs.pathExists(command))) {
         throw new Error(
           `The ${kleur.blue(
             'tsc'
           )} binary doesn't seem to be installed at ${kleur.blue(
-            tsc
+            command
           )}. Please specify the correct path in options or remove it to use the workspace's version.`
         );
       }
     } else {
-      const binary = platform() === 'win32' ? 'tsc.cmd' : 'tsc';
-
-      tsc = path.resolve(root, 'node_modules', '.bin', binary);
+      try {
+        const manifest = createRequire(path.join(root, 'package.json')).resolve(
+          'typescript/package.json'
+        );
 
-      if (!(await fs.pathExists(tsc))) {
-        tsc = await which(binary, { nothrow: true });
-      }
+        const { bin } = JSON.parse(await fs.readFile(manifest, 'utf-8'));
 
-      let workspaceRoot: string | undefined;
+        // Run the binary with node command
+        command = process.execPath;
+        args.unshift(path.join(path.dirname(manifest), bin.tsc));
+      } catch {
+        const binary = platform() === 'win32' ? 'tsc.cmd' : 'tsc';
 
-      if (tsc != null && !isPathInside(root, tsc)) {
-        workspaceRoot = await findWorkspaceRoot(root);
+        command = await which(binary, { nothrow: true });
 
-        if (!isPathInside(workspaceRoot, tsc)) {
-          report.warn(
-            `Found ${kleur.blue('tsc')} in ${kleur.blue(
-              'PATH'
-            )} at ${kleur.blue(
-              tsc
-            )}, but it is outside the workspace root at ${kleur.blue(
-              workspaceRoot
-            )}. Consider adding ${kleur.blue(
+        if (command == null) {
+          throw new Error(
+            `The ${kleur.blue(
+              'tsc'
+            )} binary doesn't seem to be installed in the workspace or present in $PATH. Make sure you have added ${kleur.blue(
               'typescript'
             )} to your ${kleur.blue(
               'devDependencies'
-            )} or specifying the ${kleur.blue(
-              'tsc'
-            )} option for the typescript target.`
+            )} or specify the ${kleur.blue('tsc')} option for typescript.`
           );
         }
-      }
 
-      if (tsc == null) {
-        workspaceRoot ??= await findWorkspaceRoot(root);
-        tsc = await findBinInAncestorNodeModules(root, binary, workspaceRoot);
+        report.warn(
+          `Failed to resolve ${kleur.blue(
+            'tsc'
+          )} in the workspace. Falling back to the binary found in ${kleur.blue(
+            'PATH'
+   
```

---

### Incident Patch 10: `ff44a198` (2026-06-07)
**Commit Message**: fix: resolve hoisted tsc binaries (#944)

**File**: `packages/react-native-builder-bob/src/__tests__/typescript.test.ts` (added, +333/-0)
```diff
@@ -0,0 +1,333 @@
+import path from 'node:path';
+import mockFs from 'mock-fs';
+import { afterEach, beforeEach, expect, test, vi } from 'vitest';
+import build, { findBinInAncestorNodeModules } from '../targets/typescript.ts';
+import type { Report } from '../types.ts';
+import { spawn } from '../utils/spawn.ts';
+
+const whichMock = vi.hoisted(() =>
+  vi.fn<(cmd: string, options: { nothrow: true }) => Promise<string | null>>()
+);
+
+vi.mock('which', () => ({
+  default: whichMock,
+}));
+
+vi.mock('../utils/spawn.ts', () => ({
+  spawn: vi.fn(),
+}));
+
+const workspace = path.resolve('/workspace');
+const packageRoot = path.join(workspace, 'packages', 'library');
+const source = path.join(packageRoot, 'src');
+const output = path.join(packageRoot, 'lib');
+const spawnMock = vi.mocked(spawn);
+
+function createReport(): Report {
+  return {
+    error: vi.fn(),
+    info: vi.fn(),
+    success: vi.fn(),
+    warn: vi.fn(),
+  };
+}
+
+function library(files = {}) {
+  return {
+    'package.json': JSON.stringify({ name: 'library' }),
+    'tsconfig.json': '{}',
+    src: {},
+    ...files,
+  };
+}
+
+async function buildTypescript(options?: { tsc?: string }) {
+  const report = createReport();
+
+  await build({
+    root: packageRoot,
+    source,
+    output,
+    report,
+    options,
+    variants: { commonjs: true },
+    esm: false,
+  });
+
+  return report;
+}
+
+beforeEach(() => {
+  whichMock.mockResolvedValue(null);
+  spawnMock.mockResolvedValue('');
+});
+
+afterEach(() => {
+  mockFs.restore();
+  vi.clearAllMocks();
+});
+
+test('finds the nearest binary before the lookup limit', async () => {
+  const localTsc = path.join(packageRoot, 'node_modules', '.bin', 'tsc');
+
+  mockFs({
+    [workspace]: {
+      packages: {
+        library: {
+          node_modules: {
+            '.bin': {
+              tsc: '',
+            },
+          },
+        },
+      },
+      node_modules: {
+        '.bin': {
+          tsc: '',
+        },
+      },
+    },
+  });
+
+  await expect(
+    findBinInAncestorNodeModules(packageRoot, 'tsc', workspace)
+  ).resolves.toBe(localTsc);
+});
+
+test('stops looking for binaries at the lookup limit', async () => {
+  const home = path.resolve('/home/user');
+  const workspace = path.join(home, 'workspace');
+  const packageRoot = path.join(workspace, 'packages', 'library');
+
+  mockFs({
+    [home]: {
+      node_modules: {
+        '.bin': {
+          tsc: '',
+        },
+      },
+      workspace: {
+        packages: {
+          library: {},
+        },
+      },
+    },
+  });
+
+  await expect(
+    findBinInAncestorNodeModules(packageRoot, 'tsc', workspace)
+  ).resolves.toBeUndefined();
+});
+
+test('finds Windows command binaries before the lookup limit', async () => {
+  const tsc = path.join(workspace, 'node_modules', '.bin', 'tsc.cmd');
+
+  mockFs({
+    [workspace]: {
+      packages: {
+        library: {},
+      },
+      node_modules: {
+        '.bin': {
+          'tsc.cmd': '',
+        },
+      },
+    },
+  });
+
+  await expect(
+    findBinInAncestorNodeModules(packageRoot, 'tsc.cmd', workspace)
+  ).resolves.toBe(tsc);
+});
+
+test('uses explicit tsc option without automatic lookup', async () => {
+  const tsc = path.join(packageRoot, 'scripts', 'tsc');
+
+  mockFs({
+    [workspace]: {
+      'yarn.lock': '',
+      packages: {
+        library: library({
+          scripts: {
+            tsc: '',
+          },
+        }),
+      },
+    },
+  });
+
+  whichMock.mockResolvedValue(
+    path.join(workspace, 'node_modules', '.bin', 'tsc')
+  );
+
+  await buildTypescript({ tsc: 'scripts/tsc' });
+
+  expect(whichMock).not.toHaveBeenCalled();
+  expect(spawnMock).toHaveBeenCalledWith(
+    tsc,
+    expect.any(Array),
+    expect.any(Object)
+  );
+});
+
+test('prefers package node_modules tsc over PATH', async () => {
+  const localTsc = path.join(packageRoot, 'node_modules', '.bin', 'tsc');
+
+  mockFs({
+    [workspace]: {
+      'yarn.lock': '',
+      packages: {
+        library: library({
+          node_modules: {
+            '.bin': {
+              tsc: '',
+            },
+          },
+        }),
+      },
+    },
+  });
+
+  whichMock.mockResolvedValue(
+    path.join(workspace, 'node_modules', '.bin', 'tsc')
+  );
+
+  await buildTypescript();
+
+  expect(whichMock).not.toHaveBeenCalled();
+  expect(spawnMock).toHaveBeenCalledWith(
+    localTsc,
+    expect.any(Array),
+    expect.any(Object)
+  );
+});
+
+test('uses tsc from PATH when package node_modules does not contain it', async () => {
+  const tsc = path.join(workspace, 'node_modules', '.bin', 'tsc');
+
+  mockFs({
+    [workspace]: {
+      'yarn.lock': '',
+      node_modules: {
+        '.bin': {
+          tsc: '',
+        },
+      },
+      packages: {
+        library: library(),
+      },
+    },
+  });
+
+  whichMock.mockResolvedValue(tsc);
+
+  const report = await buildTypescript();
+
+  expect(report.warn).not.toHaveBeenCalledWith(
+    ex
```

**File**: `packages/react-native-builder-bob/src/targets/typescript.ts` (modified, +84/-28)
```diff
@@ -25,6 +25,69 @@ type Field = {
   message: string | undefined;
 };
 
+const LOCKFILES = [
+  'bun.lock',
+  'bun.lockb',
+  'package-lock.json',
+  'pnpm-lock.yaml',
+  'yarn.lock',
+];
+
+function isPathInside(root: string, file: string) {
+  const relative = path.relative(root, file);
+  const isOutside = relative === '..' || relative.startsWith(`..${path.sep}`);
+
+  return relative === '' || (!isOutside && !path.isAbsolute(relative));
+}
+
+async function findWorkspaceRoot(root: string) {
+  let current = root;
+
+  while (true) {
+    for (const lockfile of LOCKFILES) {
+      if (await fs.pathExists(path.join(current, lockfile))) {
+        return current;
+      }
+    }
+
+    const parent = path.dirname(current);
+
+    if (parent === current) {
+      return root;
+    }
+
+    current = parent;
+  }
+}
+
+export async function findBinInAncestorNodeModules(
+  root: string,
+  binary: string,
+  limit: string
+) {
+  let current = root;
+
+  while (true) {
+    const candidate = path.resolve(current, 'node_modules', '.bin', binary);
+
+    if (await fs.pathExists(candidate)) {
+      return candidate;
+    }
+
+    if (current === limit) {
+      return undefined;
+    }
+
+    const parent = path.dirname(current);
+
+    if (parent === current) {
+      return undefined;
+    }
+
+    current = parent;
+  }
+}
+
 export default async function build({
   source,
   root,
@@ -89,7 +152,7 @@ export default async function build({
       );
     }
 
-    let tsc;
+    let tsc: string | null | undefined;
 
     if (options?.tsc) {
       tsc = path.resolve(root, options.tsc);
@@ -104,38 +167,28 @@ export default async function build({
         );
       }
     } else {
-      const execpath = process.env.npm_execpath;
-      const cli = execpath?.split(path.sep).pop()?.includes('yarn')
-        ? 'yarn'
-        : 'npm';
-
-      if (cli === 'yarn') {
-        const result = await spawn('yarn', ['bin', 'tsc'], {
-          cwd: root,
-          env: { ...process.env, FORCE_COLOR: '0' },
-        });
+      const binary = platform() === 'win32' ? 'tsc.cmd' : 'tsc';
 
-        tsc = result.trim();
-      } else {
-        tsc = path.resolve(root, 'node_modules', '.bin', 'tsc');
-      }
+      tsc = path.resolve(root, 'node_modules', '.bin', binary);
 
-      if (platform() === 'win32' && !tsc.endsWith('.cmd')) {
-        tsc += '.cmd';
+      if (!(await fs.pathExists(tsc))) {
+        tsc = await which(binary, { nothrow: true });
       }
-    }
 
-    if (!(await fs.pathExists(tsc))) {
-      try {
-        tsc = await which('tsc');
+      let workspaceRoot: string | undefined;
+
+      if (tsc != null && !isPathInside(root, tsc)) {
+        workspaceRoot = await findWorkspaceRoot(root);
 
-        if (await fs.pathExists(tsc)) {
+        if (!isPathInside(workspaceRoot, tsc)) {
           report.warn(
-            `Failed to locate ${kleur.blue(
-              'tsc'
-            )} in the workspace. Falling back to the binary found in ${kleur.blue(
+            `Found ${kleur.blue('tsc')} in ${kleur.blue(
               'PATH'
-            )} at ${kleur.blue(tsc)}. Consider adding ${kleur.blue(
+            )} at ${kleur.blue(
+              tsc
+            )}, but it is outside the workspace root at ${kleur.blue(
+              workspaceRoot
+            )}. Consider adding ${kleur.blue(
               'typescript'
             )} to your ${kleur.blue(
               'devDependencies'
@@ -144,8 +197,11 @@ export default async function build({
             )} option for the typescript target.`
           );
         }
-      } catch (e) {
-        // Ignore
+      }
+
+      if (tsc == null) {
+        workspaceRoot ??= await findWorkspaceRoot(root);
+        tsc = await findBinInAncestorNodeModules(root, binary, workspaceRoot);
       }
     }
 
```

---

### Incident Patch 11: `65283008` (2026-04-07)
**Commit Message**: fix: fix delay before the CLI exits

**File**: `packages/create-react-native-library/src/index.ts` (modified, +6/-1)
```diff
@@ -154,6 +154,8 @@ async function create() {
   } else {
     spinner.text = 'Initializing git repository';
 
+    let timer;
+
     try {
       const abortController = new AbortController();
 
@@ -163,7 +165,7 @@ async function create() {
       await Promise.race([
         createInitialGitCommit(folder, abortController.signal),
         new Promise<void>((_resolve, reject) => {
-          setTimeout(() => {
+          timer = setTimeout(() => {
             const error = new Error('Creating git repository took too long');
 
             abortController.abort(error.message);
@@ -173,6 +175,9 @@ async function create() {
       ]);
     } catch (error) {
       spinner.warn('Failed to create git repository');
+    } finally {
+      // The process waits for the timer if we don't clear it here
+      clearTimeout(timer);
     }
 
     printSuccessMessage();
```

---

### Incident Patch 12: `800bb43f` (2026-04-02)
**Commit Message**: fix: use package name instead of hardcoded value

**File**: `packages/create-react-native-library/templates/tools/vite/example/vite.config.mjs` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ export default defineConfig((env) =>
   mergeConfig(config(env), {
     resolve: {
       alias: {
-        '<%- project.slug -%>': new URL('..', import.meta.url),
+        [pack.name]: new URL('..', import.meta.url),
       },
       dedupe: Object.keys(pack.peerDependencies),
     },
```

---

### Incident Patch 13: `62c9e6cb` (2026-04-02)
**Commit Message**: fix: dedupe peer dependencies for vite

**File**: `packages/create-react-native-library/templates/tools/vite/example/vite.config.mjs` (modified, +5/-5)
```diff
@@ -1,15 +1,15 @@
-import { fileURLToPath } from 'node:url';
-
 import { defineConfig, mergeConfig } from 'vite';
 
-import bobConfig from 'react-native-builder-bob/vite-config';
+import config from 'react-native-builder-bob/vite-config';
+import pack from '../package.json' with { type: 'json' };
 
 export default defineConfig((env) =>
-  mergeConfig(bobConfig(env), {
+  mergeConfig(config(env), {
     resolve: {
       alias: {
-        '<%- project.slug -%>': fileURLToPath(new URL('..', import.meta.url)),
+        '<%- project.slug -%>': new URL('..', import.meta.url),
       },
+      dedupe: Object.keys(pack.peerDependencies),
     },
   })
 );
```

---

### Incident Patch 14: `410945ec` (2026-04-01)
**Commit Message**: fix: update nitro config

**File**: `packages/create-react-native-library/templates/nitro-common/nitro.json` (modified, +8/-2)
```diff
@@ -9,8 +9,14 @@
   },
   "autolinking": {
     "<%- project.name -%>": {
-      "swift": "<% if (project.viewConfig === 'nitro-view') { -%>Hybrid<% } -%><%- project.name -%>",
-      "kotlin": "<% if (project.viewConfig === 'nitro-view') { -%>Hybrid<% } -%><%- project.name -%>"
+      "ios": {
+        "language": "swift",
+        "implementationClassName": "<% if (project.viewConfig === 'nitro-view') { -%>Hybrid<% } -%><%- project.name -%>"
+      },
+      "android": {
+        "language": "kotlin",
+        "implementationClassName": "<% if (project.viewConfig === 'nitro-view') { -%>Hybrid<% } -%><%- project.name -%>"
+      }
     }
   },
   "ignorePaths": ["node_modules"]
```

---

### Incident Patch 15: `568f092c` (2026-02-12)
**Commit Message**: fix: don't generate test workflow if jest isn't picked

**File**: `packages/create-react-native-library/templates/common/$.github/workflows/ci.yml` (modified, +2/-0)
```diff
@@ -33,6 +33,7 @@ jobs:
       - name: Typecheck files
         run: yarn typecheck
 
+<% if (tools.includes('jest')) { -%>
   test:
     runs-on: ubuntu-latest
 
@@ -45,6 +46,7 @@ jobs:
 
       - name: Run unit tests
         run: yarn test --maxWorkers=2 --coverage
+<% } -%>
 
   build-library:
     runs-on: ubuntu-latest
```

#### Recent Merged Pull Requests:
- **PR #954** (2026-09-08): ci: run unit tests on windows (@satya164)
- **PR #953** (2026-09-08): fix(init): use posix separators for the paths written into package.json (@KallinikosMil)
- **PR #951** (2026-09-08): fix: add ndkVersion to library templates (@riteshshukla04)
- **PR #950** (2026-08-04): chore: upgrade dependencies (@satya164)
- **PR #948** (2026-06-16): feat: use a unique name for the exports condition for source (@satya164)
- **PR #947** (2026-06-11): ci: add workflow to test building local libraries (@satya164)
- **PR #946** (2026-06-10): refactor: simplify and update build.gradle (@satya164)
- **PR #945** (2026-06-08): feat: add extensions in .d.ts files for nodenext compat (@satya164)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
