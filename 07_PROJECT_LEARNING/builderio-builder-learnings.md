# Forensic Learning Record (Deep Inspection): BuilderIO/builder

> **Canonical Artifact**: `07_PROJECT_LEARNING/builderio-builder-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/BuilderIO/builder](https://github.com/BuilderIO/builder))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:06:21.117Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `BuilderIO/builder`
- **Description**: Visual Development for React, Vue, Svelte, Qwik, and more
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8859 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/embed-starter-kit/plugin/src/state/settings.ts`
```
import { observable, reaction } from 'mobx'

const advancedModeLocalStorageKey = 'advancedMode'

export const settings = observable({
  advancedMode: localStorage.getItem(advancedModeLocalStorageKey) === 'true',
})

reaction(
  () => settings.advancedMode,
  (value) => {
    localStorage.setItem(advancedModeLocalStorageKey, String(value))
  }
)

```

### Core Architecture Module: `examples/qwik/src/routes/service-worker.ts`
```
/*
 * WHAT IS THIS FILE?
 *
 * The service-worker.ts file is used to have state of the art prefetching.
 * https://qwik.dev/qwikcity/prefetching/overview/
 *
 * Qwik uses a service worker to speed up your site and reduce latency, ie, not used in the traditional way of offline.
 * You can also use this file to add more functionality that runs in the service worker.
 */
import { setupServiceWorker } from '@builder.io/qwik-city/service-worker';

setupServiceWorker();

addEventListener('install', () => self.skipWaiting());

addEventListener('activate', () => self.clients.claim());

declare const self: ServiceWorkerGlobalScope;

```

### Core Architecture Module: `examples/svelte-design-system/src/hooks.ts`
```
import type { Handle } from '@sveltejs/kit';
import * as cookie from 'cookie';

export const handle: Handle = async ({ event, resolve }) => {
	const cookies = cookie.parse(event.request.headers.get('cookie') || '');
	event.locals.userid = cookies['userid'] || crypto.randomUUID();

	const response = await resolve(event);

	if (!cookies['userid']) {
		// if this is the first time the user has visited this app,
		// set a cookie so that we recognise them when they return
		response.headers.set(
			'set-cookie',
			cookie.serialize('userid', event.locals.userid, {
				path: '/',
				httpOnly: true
			})
		);
	}

	return response;
};

```

### Core Architecture Module: `examples/svelte/localized-sveltekit/src/hooks.server.js`
```
import { getLocaleFromPathname, defaultLocale, supportedLocales, isRoute } from './utils';

/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
	const { url, request } = event;
	const { pathname } = url;

	// If this request is a route request
	if (isRoute(pathname)) {
		// Try to get locale from `pathname`.
		let locale = supportedLocales.find(
			(l) => `${l}`.toLowerCase() === getLocaleFromPathname(pathname)
		);

		// If route locale is not supported
		if (!locale) {
			// Get user preferred locale
			locale = `${`${request.headers.get('accept-language')}`.match(
				/[a-zA-Z]+?(?=-|_|,|;)/
			)}`.toLowerCase();

			// Set default locale if user preferred locale does not match
			if (!supportedLocales.includes(locale)) locale = defaultLocale;
			// 301 redirect
			return new Response(undefined, {
				headers: { location: `/${locale}${pathname}${event.url.search}` },
				status: 301
			});
		}

		// Add html `lang` attribute
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace(/<html.*>/, `<html lang="${locale}">`)
		});
	}

	return resolve(event);
};

```

### Core Architecture Module: `examples/svelte/localized-sveltekit/src/utils.js`
```
export const getLocaleFromPathname = (pathname) =>
	`${pathname.match(/[^/]+?(?=\/|$)/)}`.toLowerCase();

export const defaultLocale = 'en';
// Match this with the locales defined in your builder space
export const supportedLocales = ['en', 'fr', 'de'];
export const routeRegex = new RegExp(/^\/[^.]*([?#].*)?$/);

// checks if a string is a route request (i.e not an asset request like /image.png) https://regexr.com/73ccb
export const isRoute = (pathname) => routeRegex.test(pathname);

```

### Core Architecture Module: `examples/vue/vue-storefront-2/composables/useUiState.ts`
```
import { reactive, computed } from '@nuxtjs/composition-api';

const state = reactive({
  isCartSidebarOpen: false,
  isWishlistSidebarOpen: false,
  isLoginModalOpen: false,
  isNewsletterModalOpen: false,
  isCategoryGridView: true,
  isFilterSidebarOpen: false,
  isMobileMenuOpen: false,
});

const useUiState = () => {
  const isMobileMenuOpen = computed(() => state.isMobileMenuOpen);
  const toggleMobileMenu = () => {
    state.isMobileMenuOpen = !state.isMobileMenuOpen;
  };

  const isCartSidebarOpen = computed(() => state.isCartSidebarOpen);
  const toggleCartSidebar = () => {
    if (state.isMobileMenuOpen) toggleMobileMenu();
    state.isCartSidebarOpen = !state.isCartSidebarOpen;
  };

  const isWishlistSidebarOpen = computed(() => state.isWishlistSidebarOpen);
  const toggleWishlistSidebar = () => {
    if (state.isMobileMenuOpen) toggleMobileMenu();
    state.isWishlistSidebarOpen = !state.isWishlistSidebarOpen;
  };

  const isLoginModalOpen = computed(() => state.isLoginModalOpen);
  const toggleLoginModal = () => {
    if (state.isMobileMenuOpen) toggleMobileMenu();
    state.isLoginModalOpen = !state.isLoginModalOpen;
  };

  const isNewsletterModalOpen = computed(() => state.isNewsletterModalOpen);
  const toggleNewsletterModal = () => {
    state.isNewsletterModalOpen = !state.isNewsletterModalOpen;
  };

  const isCategoryGridView = computed(() => state.isCategoryGridView);
  const changeToCategoryGridView = () => {
    state.isCategoryGridView = true;
  };
  const changeToCategoryListView = () => {
    state.isCategoryGridView = false;
  };

  const isFilterSidebarOpen = computed(() => state.isFilterSidebarOpen);
  const toggleFilterSidebar = () => {
    state.isFilterSidebarOpen = !state.isFilterSidebarOpen;
  };

  return {
    isCartSidebarOpen,
    isWishlistSidebarOpen,
    isLoginModalOpen,
    isNewsletterModalOpen,
    isCategoryGridView,
    isFilterSidebarOpen,
    isMobileMenuOpen,
    toggleCartSidebar,
    toggleWishlistSidebar,
    toggleLoginModal,
    toggleNewsletterModal,
    changeToCategoryGridView,
    changeToCategoryListView,
    toggleFilterSidebar,
    toggleMobileMenu,
  };
};

export default useUiState;

```

### Core Architecture Module: `packages/android/sdk/app/src/main/java/com/example/myapplication/RenderBlock.kt`
```
package com.example.myapplication

import android.content.ContentValues.TAG
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonElement

fun dpToPixel(dp: Dp): Int {
    return dp.value.toInt() / 2
}

@Composable
fun RenderBlock(block: BuilderBlock) {
    // TODO: only fillMaxWidth if should
    Box(
        Modifier
            .padding(
                getStyleInt(block, "marginLeft").dp,
                getStyleInt(block, "marginTop").dp,
                getStyleInt(block, "marginRight").dp,
                getStyleInt(block, "marginBottom").dp
            )
            .background(getStyleColor(block, "backgroundColor", Color.Transparent))
            .fillMaxWidth()
            .padding(
                getStyleInt(block, "paddingLeft").dp,
                getStyleInt(block, "paddingTop").dp,
                getStyleInt(block, "paddingRight").dp,
                getStyleInt(block, "paddingBottom").dp
            )
    ) {
        val name = block.component?.name

        if (name != null) {
            val factory = components.get(name)
            if (factory != null) {
                var options = block.component.options ?: emptyMap()
                factory(options as Map<String, JsonElement>, block)
            }
        } else if (block.children != null) {
            Column {
                block.children.forEach { child ->
                    RenderBlock(child)
                }
            }
        }
    }
}

typealias ComponentFactory =  @Composable (Map<String, JsonElement>, BuilderBlock) -> Unit
val components = mutableMapOf<String, ComponentFactory>()

fun registerComponent(options: ComponentOptions, component: ComponentFactory) {
    _registerComponent(options, component)
}

fun _registerComponent(options: ComponentOptions, component: ComponentFactory) {
    components[options.name] = component
}

data class ComponentOptions(val name: String, val inputs: ArrayList<ComponentInput>? = null)

data class ComponentInput(
    val type: String,
    val name: String,
    val defaultValue: Any
)
```

### Core Architecture Module: `packages/android/sdk/app/src/main/java/com/example/myapplication/RenderContent.kt`
```
package com.example.myapplication

import android.app.Activity
import android.content.ContentValues.TAG
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.PixelCopy
import android.view.View
import android.view.Window
import android.view.WindowManager
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.example.myapplication.blocks.registerColumns
import com.example.myapplication.blocks.registerImage
import com.example.myapplication.blocks.registerText
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream


// TODO: move out of here
var isEditing: Boolean = true
const val collectionName = "components"
const val docId = "00df1822dbdf48d18a1fdef36d98a315"

@Composable
fun RenderContent(content: BuilderContent) {
    var content by remember { mutableStateOf<BuilderContent?>(content) }

    val view = LocalView.current
    val context = LocalContext.current
    val lifecycleOwner = view.findViewTreeLifecycleOwner()

    LaunchedEffect(Unit, block = {
        registerComponents()
    })

    KeepScreenOn()

    Column {
        content?.data?.blocks?.forEach { block ->
            RenderBlock(block)
        }
    }
}

fun <T> debounce(
    waitMs: Long = 300L,
    coroutineScope: CoroutineScope,
    destinationFunction: (T) -> Unit
): (T) -> Unit {
    var debounceJob: Job? = null
    return { param: T ->
        debounceJob?.cancel()
        debounceJob = coroutineScope.launch {
            delay(waitMs)
            destinationFunction(param)
        }
    }
}


fun captureView(view: View, window: Window, bitmapCallback: (Bitmap) -> Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Above Android O, use PixelCopy
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        val location = IntArray(2)
        view.getLocationInWindow(location)
        PixelCopy.request(
            window,
            Rect(location[0], location[1], location[0] + view.width, location[1] + view.height),
            bitmap,
            {
                if (it == PixelCopy.SUCCESS) {
                    bitmapCallback.invoke(bitmap)
                }
            },
            Handler(Looper.getMainLooper())
        )
    } else {
        val tBitmap = Bitmap.createBitmap(
            view.width, view.height, Bitmap.Config.RGB_565
        )
        val canvas = Canvas(tBitmap)
        view.draw(canvas)
        canvas.setBitmap(null)
        bitmapCallback.invoke(tBitmap)
    }
}

@Composable
fun KeepScreenOn() {
    val context = LocalContext.current

    DisposableEffect(LocalLifecycleOwner.current) {
        val window = context.findActivity()?.window
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose {
            window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }
}

fun Context.findActivity(): Activity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is Activity) return context
        context = context.baseContext
    }
    return null
}

// TODO: find a cleaner way
fun registerComponents() {
    registerImage()
    registerColumns()
    registerText()
}
```

### Core Architecture Module: `packages/cli/src/utils.ts`
```
import fse from 'fs-extra';
import traverse from 'traverse';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import commander from 'commander';

const childrenProcesses: ChildProcess[] = [];

export const IS_YARN = (() => {
  return fse.existsSync(path.join(process.cwd(), 'yarn.lock'));
})();

export const readAsJson = async (path: string) => {
  const content = await fse.readFile(path);
  try {
    return JSON.parse(content.toString());
  } catch (e) {
    console.error(`error parsing ${path}`);
    throw e;
  }
};

export const intParam = (value: any, previous: any) => { 
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    throw new commander.InvalidArgumentError('Not a number.');
  }
  return parsedValue;
}

export const getDirectories = async (source: string) =>
  (await fse.readdir(source, { withFileTypes: true })).filter(dirent => dirent.isDirectory());

export const getFiles = async (source: string) =>
  (await fse.readdir(source, { withFileTypes: true })).filter(dirent => dirent.isFile());

export const replaceField = (json: any, newValue: string, oldValue: string) => {
  return traverse(json).map(function (field) {
    if (this.key?.includes('@')) {
      // exclude meta keys from updates
      return;
    }
    if (field === oldValue) {
      this.update(newValue);
    }
  });
};

export function writeFile(fileContents: string, filePath: string, fileName: string) {
  if (!fse.existsSync(filePath)) {
    fse.mkdirSync(filePath);
  }

  fse.writeFileSync(path.join(filePath, fileName), fileContents);
}

export function killChildren() {
  childrenProcesses.forEach(p => p.kill('SIGINT'));
}

export function installPackage(packageName: string) {
  return new Promise<void>((resolve, reject) => {
    const commands = IS_YARN
      ? ['add', packageName, '--silent', '--ignore-engines', '--no-node-version-check']
      : [
          'install',
          packageName,
          '--loglevel=error',
          '--no-audit',
          '--no-fund',
          '--no-update-notifier',
        ];

    const p = spawn(IS_YARN ? 'yarn' : 'npm', commands, {
      shell: true,
      stdio: 'inherit',
    });
    p.once('exit', () => resolve());
    p.once('error', reject);

    childrenProcesses.push(p);
  });
}

```

### Core Architecture Module: `packages/core/index.ts`
```
import {
  Builder,
  BuilderComponent,
  isBrowser,
  Input,
  Component,
  GetContentOptions,
  Class,
} from './src/builder.class';
export { Builder, BuilderComponent, isBrowser, Input, Component, GetContentOptions, Class };

export { BehaviorSubject, Subscription } from './src/classes/observable.class';

export { BuilderElement } from './src/types/element';
export { BuilderContent, BuilderContentVariation } from './src/types/content';
export { ApiVersion } from './src/types/api-version';

export { builder } from './src/constants/builder';

```

### Core Architecture Module: `packages/core/jest.config.ts`
```
/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  // All imported modules in your tests should be mocked automatically
  // automock: false,

  // Stop running tests after `n` failures
  // bail: 0,

  // The directory where Jest should store its cached dependency information
  // cacheDirectory: "/tmp/jest_rs",

  // Automatically clear mock calls, instances and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  // collectCoverageFrom: undefined,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // An array of regexp pattern strings used to skip coverage collection
  // coveragePathIgnorePatterns: [
  //   "/node_modules/"
  // ],

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',

  // A list of reporter names that Jest uses when writing coverage reports
  // coverageReporters: [
  //   "json",
  //   "text",
  //   "lcov",
  //   "clover"
  // ],

  // An object that configures minimum threshold enforcement for coverage results
  // coverageThreshold: undefined,

  // A path to a custom dependency extractor
  // dependencyExtractor: undefined,

  // Make calling deprecated APIs throw helpful error messages
  // errorOnDeprecated: false,

  // Force coverage collection from ignored files using an array of glob patterns
  // forceCoverageMatch: [],

  // A path to a module which exports an async function that is triggered once before all test suites
  // globalSetup: undefined,

  // A path to a module which exports an async function that is triggered once after all test suites
  // globalTeardown: undefined,

  // A set of global variables that need to be available in all test environments
  // globals: {},

  // The maximum amount of workers used to run your tests. Can be specified as % or a number. E.g. maxWorkers: 10% will use 10% of your CPU amount + 1 as the maximum worker number. maxWorkers: 2 will use a maximum of 2 workers.
  // maxWorkers: "50%",

  // An array of directory names to be searched recursively up from the requiring module's location
  // moduleDirectories: [
  //   "node_modules"
  // ],

  // An array of file extensions your modules use
  // moduleFileExtensions: [
  //   "js",
  //   "jsx",
  //   "ts",
  //   "tsx",
  //   "json",
  //   "node"
  // ],

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  // moduleNameMapper: {},

  // An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
  // modulePathIgnorePatterns: [],

  // Activates notifications for test results
  // notify: false,

  // An enum that specifies notification mode. Requires { notify: true }
  // notifyMode: "failure-change",

  // A preset that is used as a base for Jest's configuration
  // preset: undefined,

  // Run tests from one or more projects
  // projects: undefined,

  // Use this configuration option to add custom reporters to Jest
  // reporters: undefined,

  // Automatically reset mock state before every test
  // resetMocks: false,

  // Reset the module registry before running each individual test
  // resetModules: false,

  // A path to a custom resolver
  // resolver: undefined,

  // Automatically restore mock state and implementation before every test
  // restoreMocks: false,

  // The root directory that Jest should scan for tests and modules within
  // rootDir: undefined,

  // A list of paths to directories that Jest should use to search for files in
  // roots: [
  //   "<rootDir>"
  // ],

  // Allows you to use a custom runner instead of Jest's default test runner
  // runner: "jest-runner",

  // The paths to modules that run some code to configure or set up the testing environment before each test
  // setupFiles: [],

  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  // setupFilesAfterEnv: [],

  // The number of seconds after which a test is considered as slow and reported as such in the results.
  // slowTestThreshold: 5,

  // A list of paths to snapshot serializer modules Jest should use for snapshot testing
  // snapshotSerializers: [],

  // The test environment that will be used for testing
  testEnvironment: 'jsdom',

  // Options that will be passed to the testEnvironment
  // testEnvironmentOptions: {},

  // Adds a location field to test results
  // testLocationInResults: false,

  // The glob patterns Jest uses to detect test files
  // testMatch: [
  //   "**/__tests__/**/*.[jt]s?(x)",
  //   "**/?(*.)+(spec|test).[tj]s?(x)"
  // ],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  // testPathIgnorePatterns: [
  //   "/node_modules/"
  // ],

  // The regexp pattern or array of patterns that Jest uses to detect test files
  // testRegex: [],

  // This option allows the use of a custom results processor
  // testResultsProcessor: undefined,

  // This option allows use of a custom test runner
  // testRunner: "jest-circus/runner",

  // This option sets the URL for the jsdom environment. It is reflected in properties such as location.href
  // testURL: "http://localhost",

  // Setting this value to "fake" allows the use of fake timers for functions such as "setTimeout"
  // timers: "real",

  // A map from regular expressions to paths to transformers
  transform: {
    '\\.ts$': 'esbuild-runner/jest',
  },

  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  // transformIgnorePatterns: [
  //   "/node_modules/",
  //   "\\.pnp\\.[^\\/]+$"
  // ],

  // An array of regexp pattern strings that are matched against all modules before the module loader will automatically return a mock for them
  // unmockedModulePathPatterns: undefined,

  // Indicates whether each individual test should be reported during the run
  // verbose: undefined,

  // An array of regexp patterns that are matched against all source file paths before re-running tests in watch mode
  // watchPathIgnorePatterns: [],

  // Whether to use watchman for file crawling
  // watchman: true,
};

```

### Core Architecture Module: `packages/core/rollup.config.js`
```
import * as ts from 'typescript';
import typescript from 'rollup-plugin-typescript2';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import uglify from 'rollup-plugin-uglify';
import json from 'rollup-plugin-json';

import pkg from './package.json';

const basicOptions = {
  input: './index.ts',

  context: 'window',

  plugins: [
    typescript({
      typescript: ts,
      useTsconfigDeclarationDir: true,
    }),
    json(),
    commonjs({
      namedExports: {
        'js-cookie': ['get', 'set'],
        './node_modules/es6-promise/dist/es6-promise.j': ['polyfill'],
      },
    }),
  ],
};

const umdOptions = {
  ...basicOptions,
  output: [
    {
      format: 'umd',
      name: 'BuilderIO',
      file: 'dist/index.umd.js',
      sourcemap: true,
      amd: {
        id: '@builder.io/sdk',
      },
    },
  ],
  plugins: basicOptions.plugins.concat([resolve()]),
};

const umdMinOptions = {
  ...basicOptions,
  output: [
    {
      format: 'umd',
      name: 'BuilderIO',
      file: pkg.unpkg,
      sourcemap: true,
      amd: {
        id: '@builder.io/sdk',
      },
    },
  ],
  plugins: basicOptions.plugins.concat([resolve(), uglify()]),
};

const externalModuleOptions = {
  ...basicOptions,
  output: [
    {
      format: 'cjs',
      file: pkg.main,
      sourcemap: true,
    },
    {
      format: 'es',
      file: pkg.module,
      sourcemap: true,
    },
  ],
  external: Object.keys(pkg.dependencies || {}),
  plugins: basicOptions.plugins.concat([
    resolve({
      only: [/^\.{0,2}\//],
    }),
  ]),
};

export default [umdOptions, umdMinOptions, externalModuleOptions];

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3985** (2025-04-02): **fix[ENG-8003]: Changing the entry on a symbol does not update the preview window**
  *Symptoms*: ## Description  This PR fixes an issue where symbol content was not updating correctly. The fix compares the previous symbol entry with the incoming symbol entry—if they are not equal, it triggers `fetchSymbolContent` to ensure the latest content is loaded.    **Changes Made:**   - Added a comparison check between the previous and incoming symbol entries.   - Triggered `fetchSymbolContent` if the entries differ to update the content.    **Why This Change Was Made:**   To ensure symbol content updates correctly when the symbol entry changes, improving accuracy and consistency in the preview.   _Loom_ https://www.loom.com/share/032123ec4a7f449db7690eb9ca022f3e?sid=3964bfa8-ac48-428a-a376-91568c447213 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: eb5362fe9039425668dd59c341b5843b186d359b  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 7 packages</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk-angular      | Patch | | @builder.io/sdk-qwik         | Patch | | @builder.io/sdk-react        | Patch | | @builder.io/sdk-react-native | Patch | | @builder.io/sdk-solid        | Patch | | @builder.io/sdk-svelte       | Patch | | @builder.io/sdk-vue          | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-8003?filename=.changeset/blue-tools-complain.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patc
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67ed42bc62e2084339b8d514?utm_source=pull-request&utm_medium=comment) for commit eb5362fe9039425668dd59c341b5843b186d359b.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/qwik-city` | ✅ Succeeded | 8m 41s | [View ↗](https://cloud.nx.app/runs/ysFRNb6X6L?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nuxt` | ✅ Succeeded | 8m 11s | [View ↗](https://cloud.nx.app/runs/RTdePQ2gSw?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 8m 16s | [View ↗](https://cloud.nx.app/runs/UQoY1rk7QK?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16-ssr` | ✅ Succeeded | 6m 58s | [View ↗](https://cloud.nx.app/runs/9wOsExDNfr?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16` | ✅ Succeeded | 6m 48s | [View ↗](https://cloud.nx.app/runs/DOyaDyLSu5?utm_source=pull-request&utm_medium=comment) |
  > #### ⚠️ GitGuardian has uncovered 1 secret following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secret in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [11707119](https://dashboard.gitguardian.com/workspace/81635/incidents/11707119) | Triggered | Generic High E

- **Issue #3975** (2025-03-25): **fix: [ENG-8644] overriding omit in fetchOneEntry to be empty string**
  *Symptoms*: ### **Description:**   This PR fixes an issue where `meta.componentsUsed` is omitted by default when using `fetchOneEntry`. Previously, to include `meta.componentsUsed`, you had to explicitly set `omit: ' '` (a space) as a workaround.    ### **Changes Made:**   - Updated the logic to include `meta.componentsUsed` by default unless explicitly omitted.   - Added `omit ?? 'meta.componentsUsed'` to ensure `componentsUsed` is not omitted when `omit` is set to an empty string (`''`).    ### **Why This Change Was Made:**   To allow `meta.componentsUsed` to be included without requiring a workaround and to ensure better handling of the `omit` parameter.     __Loom__ https://www.loom.com/share/938cd062796c4e2aaaf42b408039713e?sid=f087a66d-478d-42ce-ae41-b8e809535da6 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: a75c8fe63c19a60f254019ac3f90809d59533ba7  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 10 packages</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk              | Patch | | @builder.io/react            | Patch | | @builder.io/sdk-angular      | Patch | | @builder.io/sdk-react-nextjs | Patch | | @builder.io/sdk-qwik         | Patch | | @builder.io/sdk-react        | Patch | | @builder.io/sdk-react-native | Patch | | @builder.io/sdk-solid        | Patch | | @builder.io/sdk-svelte       | Patch | | @builder.io/sdk-vue          | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67e28d5dd1aaa1684f691d15?utm_source=pull-request&utm_medium=comment) for commit 6e1b15cae6cc20e95251c36e4e1b2aa54b82501e.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/nuxt` | ✅ Succeeded | 10m 27s | [View ↗](https://cloud.nx.app/runs/7Dc4mcvTux?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/qwik-city` | ✅ Succeeded | 9m 13s | [View ↗](https://cloud.nx.app/runs/MRJbbhdNsl?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 9m 1s | [View ↗](https://cloud.nx.app/runs/hqYScRkE5y?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16` | ✅ Succeeded | 7m 29s | [View ↗](https://cloud.nx.app/runs/j9I2yLOU9g?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16-ssr` | ✅ Succeeded | 7m 27s | [View ↗](https://cloud.nx.app/runs/to7Lwsx7Gv?utm_source=pull-request&utm_medium=comment) |
  > @yash-builder could you add tests for this? https://github.com/BuilderIO/builder/blob/e3ce1d80af54cbad9a4ab982bf97011cbc6a02a6/packages/sdks-tests/src/e2e-tests/hit-content-api.spec.ts#L73 this could be a reference

- **Issue #3967** (2025-03-28): **fix: [ENG-8172] Content Inputs of type "list" do not update in the preview when changed**
  *Symptoms*: ## Description  This PR fixes an issue where content inputs of type "list" in Gen 2 SDKs were not updating in the preview when modified. Previously, changes to list item properties within symbols required a manual browser refresh to reflect updates.    ### **Changes Made:**   - Resolved the reactivity issue causing list inputs to not update in the preview.   - Ensured that changes to list properties are immediately reflected without requiring a browser refresh.    ### **Why This Change Was Made:**   To improve the editing experience by ensuring real-time updates for list-type inputs within symbols in the Gen 2 SDKs.  _Jira_ https://builder-io.atlassian.net/browse/ENG-8172  _Screenshot_ Adding soon... 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: c1ae957a1dbfae5884a0553350453e55c3b08bd3  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 7 packages</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk-angular      | Patch | | @builder.io/sdk-react-nextjs | Patch | | @builder.io/sdk-react        | Patch | | @builder.io/sdk-react-native | Patch | | @builder.io/sdk-solid        | Patch | | @builder.io/sdk-svelte       | Patch | | @builder.io/sdk-vue          | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-8172?filename=.changeset/old-avocados-cross.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67e6470e3050ae4e8f2190ae?utm_source=pull-request&utm_medium=comment) for commit c1ae957a1dbfae5884a0553350453e55c3b08bd3.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/nuxt` | ✅ Succeeded | 9m 38s | [View ↗](https://cloud.nx.app/runs/hI9JfInzx3?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/qwik-city` | ✅ Succeeded | 9m 21s | [View ↗](https://cloud.nx.app/runs/iXeWSfKGWW?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 8m 52s | [View ↗](https://cloud.nx.app/runs/cIPA2GAsFo?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/vue` | ✅ Succeeded | 6m 5s | [View ↗](https://cloud.nx.app/runs/YMMksAA0HH?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/sveltekit` | ✅ Succeeded | 6m 30s | [View ↗](https://cloud.nx.app/runs/EIaGIfL4ae?utm_source=pull-request&utm_medium=comment) | | `nx test @
  > #### ⚠️ GitGuardian has uncovered 1 secret following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secret in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [11707119](https://dashboard.gitguardian.com/workspace/81635/incidents/11707119) | Triggered | Generic High E

- **Issue #3947** (2025-04-02): **fix[qwik]: ENG-7299 Default value not updating for custom components on ContentEditor**
  *Symptoms*: ## Description  This PR addresses a critical reactivity issue in the Qwik SDK where deeply nested content updates weren't properly triggering.   The core problem was that when content was updated through the Builder.io editor, the changes were correctly stored in state but weren't causing components to re-render.   I've implemented a key-based approach for the `InteractiveElement` component that uses a dynamic key derived from the component options, forcing `Qwik` to update it's component when `options` changes. This effectively bypasses limitations in Qwik's resumability model where prop changes to dynamic components aren't always detected. While using `JSON.stringify` in keys isn't ideal for **_performance_**, but it provides a reliable solution that ensures content updates are immediately reflected in the UI without requiring page refreshes.  JIRA https://builder-io.atlassian.net/browse/ENG-7299  _Loom_ https://www.loom.com/share/2b4d1b2872fe4151b1a9f2f131bab780?sid=7fc0f143-0623-41f4-aa94-e947530dde55 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 7620d4866b6aded3844508721553ed5e2e437812  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @builder.io/sdk-qwik | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-7299?filename=.changeset/slimy-lies-accept.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch%0A%22%40sdk%2Ftests%22%3A%20patch%0A%22%40builder.io%2Fsdks%22%3A%20patch%0A%22%40e2e%2Fqwik-city%22%3A%20patch%0A%22%40e2e%2Freact%22%3A%20patch%0A---%0A%0Afix%5Bqwik%5D%3A%20ENG-7299%20Default%20value%20not%20updating%20for%20custom%20components%20on%20ContentEditor%0A
  > #### ⚠️ GitGuardian has uncovered 3 secrets following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secrets in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [2708648](https://dashboard.gitguardian.com/workspace/81635/incidents/2708648) | Triggered | Generic High E
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67ebd9041d718113934c32c6?utm_source=pull-request&utm_medium=comment) for commit 7620d4866b6aded3844508721553ed5e2e437812.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/qwik-city` | ✅ Succeeded | 8m 28s | [View ↗](https://cloud.nx.app/runs/dUpxgxOZwt?utm_source=pull-request&utm_medium=comment) |  ---  ☁️ [Nx Cloud](https://cloud.nx.app?utm_source=pull-request&utm_medium=comment) last updated this comment at `2025-04-01 12:24:40` UTC  <!-- NX_CLOUD_APP_COMMENT_END -->

- **Issue #3937** (2025-03-05): **fix[dynamic-renderer]: ENG-8440 Button links cannot be used in Angular Gen 2 SDK**
  *Symptoms*: ## Description  This PR replaces the switch-case logic with a Map for dynamically selecting components in `dynamic-renderer`. The previous approach caused an assertion error when users typed.  _Loom_ https://www.loom.com/share/1229e7974db44743921df588ca1bd1bb?sid=ea3ccc9c-41de-4efe-b499-f61ca9244cbd
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: d14b625142e05b7b9925738d24245c35bb88f119  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                    | Type  | | ----------------------- | ----- | | @builder.io/sdk-angular | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-8440?filename=.changeset/soft-jobs-invite.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch%0A%22%40sdk%2Ftests%22%3A%20patch%0A%22%40builder.io%2Fsdks%22%3A%20patch%0A%22%40builder.io%2Fsdk-angular%22%3A%20patch%0A---%0A%0Afix%5Bdynamic-renderer%5D%3A%20ENG-8440%20Button%20links%20cannot%20be%20used%20in%20Angular%20Gen%202%20SDK%0A)  
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67c737bd1fdea46784cac388?utm_source=pull-request&utm_medium=comment) for commit d14b625142e05b7b9925738d24245c35bb88f119.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/qwik-city` | ✅ Succeeded | 7m 33s | [View ↗](https://cloud.nx.app/runs/rKdtU9XvQe?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nuxt` | ✅ Succeeded | 7m 11s | [View ↗](https://cloud.nx.app/runs/5VDSBGArtD?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 7m 32s | [View ↗](https://cloud.nx.app/runs/0JmbCsY7Tp?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16-ssr` | ✅ Succeeded | 6m 48s | [View ↗](https://cloud.nx.app/runs/V7bRwDtxHT?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/angular-16` | ✅ Succeeded | 6m 41s | [View ↗](https://cloud.nx.app/runs/S2NJPyhBcq?utm_source=pull-request&utm_medium=comment) |
  > LGTM... need to consider the case for dynamic-elements for unknown. PR - https://github.com/BuilderIO/builder/pull/3892

- **Issue #3896** (2025-02-12): **fix: ensure correct variation tracking for impressions**
  *Symptoms*: ## Description  ### **Pull Request Description**    #### **What Changed?**   - Fixed an issue where **two impressions** were being tracked—one for the default content and another for the variation.   - Updated the logic to ensure that **only the variation impression is tracked**, preventing duplicate tracking.   - Added a **Playwright test** to verify that impressions are logged correctly with the right `variationId`.    #### **Why This Change?**   - Previously, the analytics data incorrectly counted extra impressions for the default content.   - Now, only the actual **winning variation** sends an impression event, ensuring accurate A/B testing results.     _Screenshot_ **Before**: _Impression for variation getting send without variationId_ <img width="1512" alt="Screenshot 2025-02-07 at 4 29 48 PM" src="https://github.com/user-attachments/assets/5b506262-b03a-4a7d-a857-a1085d4c5fc3" />  **After**: _Sending only winning variation_ <img width="1512" alt="Screenshot 2025-02-07 at 4 32 39 PM" src="https://github.com/user-attachments/assets/72ab419f-6ec9-4940-9d87-261eece01c3e" />  <img width="1512" alt="Screenshot 2025-02-07 at 4 33 22 PM" src="https://github.com/user-attachments/assets/4013386c-2937-4c9e-a941-51a3ddc704fd" /> 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 5a2aca2f39bd65a006030d5b60ba05f9ea692376  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 7 packages</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk-angular      | Patch | | @builder.io/sdk-react-nextjs | Patch | | @builder.io/sdk-qwik         | Patch | | @builder.io/sdk-react        | Patch | | @builder.io/sdk-react-native | Patch | | @builder.io/sdk-solid        | Patch | | @builder.io/sdk-svelte       | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/ENG-8180?filename=.changeset/modern-bees-repair.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67acc1fc9e5dfe5ac6ddc974?utm_source=pull-request&utm_medium=comment) for commit 5a2aca2f39bd65a006030d5b60ba05f9ea692376.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/angular-16-ssr` | ✅ Succeeded | 8m 52s | [View ↗](https://cloud.nx.app/runs/4DPzs2pKmu?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/gen1-next14-pages` | ✅ Succeeded | 8m 56s | [View ↗](https://cloud.nx.app/runs/aNE3kq9GsK?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/vue` | ✅ Succeeded | 7m 27s | [View ↗](https://cloud.nx.app/runs/w3kh1lpybF?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 8m | [View ↗](https://cloud.nx.app/runs/4a6k8Kg72S?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/qwik-city` | ✅ Succeeded | 7m 50s | [View ↗](https://cloud.nx.app/runs/Rh6t9l6D70?utm_source=pull-request&utm_medium=comment)
  > #### ⚠️ GitGuardian has uncovered 2 secrets following the scan of your pull request.  Please consider investigating the findings and remediating the incidents. Failure to do so may lead to compromising the associated services or software components.  Since your pull request originates from a forked repository, GitGuardian is not able to associate the secrets uncovered with secret incidents on your GitGuardian dashboard. Skipping this check run and merging your pull request will create secret incidents on your GitGuardian dashboard.  <details> <summary>🔎 Detected hardcoded secrets in your pull request</summary> <br>  | GitGuardian id | GitGuardian status | Secret                         | Commit           | Filename        |                      | | -------------- | ------------------ | ------------------------------ | ---------------- | --------------- | -------------------- | | [9071768](https://dashboard.gitguardian.com/workspace/81635/incidents/9071768) | Triggered | Generic High E

- **Issue #3865** (2025-02-04): **fix[qwik-sdk]: ENG-6695 visual editor hangs if editable area (<Content />) is not in the iframe viewport**
  *Symptoms*: ## Description The `CustomEvent` `"initeditingbldr"` was not triggering as expected by ensuring proper event dispatch timing and listener registration. The `useOnDocument("readystatechange")` handler was updated to dispatch the event only after the DOM is fully loaded (`document.readyState === "complete"`)  **JIRA**: https://builder-io.atlassian.net/browse/ENG-6695  **Loom** https://www.loom.com/share/0ab5296adbe24bb2b22319f0588f0bbf?sid=4e4b4066-4b18-459e-bc62-7dae1e45c1f9
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 7d6ae717744f5ad0382e664802ddbec4a295c03a  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                 | Type  | | -------------------- | ----- | | @builder.io/sdk-qwik | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/qwik-load-fix?filename=.changeset/dirty-walls-smash.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch%0A%22%40sdk%2Ftests%22%3A%20patch%0A%22%40builder.io%2Fsdks%22%3A%20patch%0A%22%40e2e%2Fqwik-city%22%3A%20patch%0A---%0A%0Afix%5Bqwik-sdk%5D%3A%20ENG-6695%20visual%20editor%20hangs%20if%20editable%20area%20(%3CContent%20%2F%3E)%20is%20not%20in%20the%20iframe%20viewp
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67a23f7e37a3c345af724314?utm_source=pull-request&utm_medium=comment) for commit 587f834f36fba42ac88cc69529823e3ca58e6818.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/qwik-city` | ✅ Succeeded | 8m 1s | [View ↗](https://cloud.nx.app/runs/bcZb2dzyOC?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 7m 48s | [View ↗](https://cloud.nx.app/runs/dTNMY1W9dH?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nuxt` | ✅ Succeeded | 7m 17s | [View ↗](https://cloud.nx.app/runs/IE5ZDXcf6K?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/svelte` | ✅ Succeeded | 5m 50s | [View ↗](https://cloud.nx.app/runs/L9toAKTHUc?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/react-native-76-fabric` | ✅ Succeeded | 5m 51s | [View ↗](https://cloud.nx.app/runs/pjt4ZsOh1Y?utm_source=pull-request&utm_medium=comment

- **Issue #3814** (2025-01-24): **perf[react-native]: Memoized Blocks Component to free up UI thread.**
  *Symptoms*: ## Description  `Suspense`: Added `React.Suspense` to defer the rendering of the `Content` component until it is fully loaded.  `Memoization`: `React.memo` to memoize computationally expensive operations within the `Blocks` component. To prevents unnecessary recalculations of processed blocks during re-renders, reducing the load on the UI thread.  _Screenshot_ Before: <img width="798" alt="Screenshot 2025-01-13 at 12 20 38 PM" src="https://github.com/user-attachments/assets/91ddb89c-2ddd-4930-b62f-7497783ad948" />  After: <img width="798" alt="Screenshot 2025-01-13 at 12 37 41 PM" src="https://github.com/user-attachments/assets/6dd776b0-3d82-46f1-a98a-7d28e553d44c" /> 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 553372047c8ee088415aaa29006e22152714b554  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 1 package</summary>    | Name                         | Type  | | ---------------------------- | ----- | | @builder.io/sdk-react-native | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/yash-builder/builder/new/perf-react-native?filename=.changeset/quiet-squids-wash.md&value=---%0A%22%40builder.io%2Fpackages%22%3A%20patch%0A%22%40sdk%2Ftests%22%3A%20patch%0A%22%40builder.io%2Fsdks%22%3A%20patch%0A%22%40builder.io%2Fsdk-react-native%22%3A%20patch%0A---%0A%0Aperf%5Breact-native%5D%3A%20Memoized%20Blocks%20Component%20to%20free%20up%20UI%20thread.%0A)  
  >  View your [CI Pipeline Execution ↗](https://cloud.nx.app/cipes/67930fdbd5bb8174179ab909?utm_source=pull-request&utm_medium=comment) for commit 553372047c8ee088415aaa29006e22152714b554.  | Command | Status | Duration | Result | |---------|--------|----------:|--------| | `nx test @e2e/nextjs-sdk-next-app` | ✅ Succeeded | 7m 45s | [View ↗](https://cloud.nx.app/runs/fgXZQdJ8HX?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/qwik-city` | ✅ Succeeded | 7m 22s | [View ↗](https://cloud.nx.app/runs/qTEevky96r?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/nuxt` | ✅ Succeeded | 6m 59s | [View ↗](https://cloud.nx.app/runs/e7krUf7NQj?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/react-sdk-next-15-app` | ✅ Succeeded | 5m 45s | [View ↗](https://cloud.nx.app/runs/Kl0at4q5zR?utm_source=pull-request&utm_medium=comment) | | `nx test @e2e/hydrogen` | ✅ Succeeded | 5m 40s | [View ↗](https://cloud.nx.app/runs/ajqmogbao8?utm_source=pull-request&utm_medium=comme
  > > I see `large-reactive-state.spec.ts` is failing for React Native now. This is an integration stress-test for SDK performance: it renders thousands of interactive elements on the same page, performs multiple state updates and makes sure it all gets done in a reasonable time frame. >  > It's a bit surprising that your PR is causing it to fail. Can you investigate this failure and make sure there aren't any unintended performance drawbacks to this solution?  Hmm...that's weird let me take a look into it

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

### Incident Patch 1: `8010710c` (2026-10-06)
**Commit Message**: fix(sdks): jsCode context functions, jsCode state reactivity, and bound id in gen2 (#4890)

## Description

Three Gen2 bugs that showed up on builder.io after the move to
`@builder.io/sdk-react` 5.3.0. All three worked in Gen1.

**jsCode can't add functions to `context`.** `Content` ran `jsCode`
against `props.context || {}`, and blocks got a different `props.context
|| {}`. When no `context` prop is passed, those are two separate
objects, so something like `context.calcHours = function () {...}` never
reached block actions (`context.calcHours is not a function`). `jsCode`
and HTTP request URL templates now use the context object blocks get.

**React: jsCode state writes after the first run don't re-render.** The
React branch of jsCode's `rootSetState` only did `Object.assign`. That's
needed for the first run, since it happens during render, but writes
from functions jsCode defines, timers, or fetch callbacks updated state
without rendering. Writes after the first run now go through
`rootSetState`.

**A binding on `id` replaced the block's Builder id.** Bindings are
written onto the block, so binding `id` overwrote `block.id`: the
element got `builder-id="slide-0"` and no DOM `id`.

**File**: `.changeset/gen2-context-and-bound-id.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+'@builder.io/sdk-angular': patch
+'@builder.io/sdk-react-nextjs': patch
+'@builder.io/sdk-qwik': patch
+'@builder.io/sdk-react': patch
+'@builder.io/sdk-react-native': patch
+'@builder.io/sdk-solid': patch
+'@builder.io/sdk-svelte': patch
+'@builder.io/sdk-vue': patch
+---
+
+Fix custom code that worked in Gen1:
+
+- Functions that content `jsCode` adds to `context` (e.g. `context.calcHours = ...`) are now callable from block actions and bindings when no `context` prop is passed to `Content`. Previously `jsCode` wrote them to a throwaway object.
+- React: state writes made by `jsCode` after its first run (from functions it defines, timers, or fetch callbacks) now re-render the content.
+- A binding on `id` sets the element's `id` attribute, as in Gen1, instead of replacing the block's Builder id.
```

**File**: `packages/sdks-tests/src/e2e-tests/countdown.spec.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { test } from '../helpers/index.js';
 test.describe('Symbol with JS Code', () => {
   test('correctly updates countdown date', async ({ page, sdk, packageName }) => {
     test.fail(
-      sdk === 'qwik' || sdk === 'react' || sdk === 'rsc',
+      sdk === 'qwik' || sdk === 'rsc',
       'jsCode in symbols does not update global state for these SDKs.'
     );
     test.skip(packageName === 'gen1-next14-pages', 'test is flaky');
```

**File**: `packages/sdks-tests/src/e2e-tests/js-code.spec.ts` (modified, +26/-0)
```diff
@@ -7,6 +7,32 @@ test.describe('JS Code', () => {
     const menuLocator = page.locator('text=jsCode text');
     await expect(menuLocator).toBeVisible();
   });
+  test('functions jsCode adds to context are callable from block actions', async ({
+    page,
+    sdk,
+  }) => {
+    test.skip(excludeTestFor(['qwik', 'rsc'], sdk));
+
+    await page.goto('/js-code-context/');
+    await expect(page.locator('text=count: 0')).toBeVisible();
+    await page.getByText('Increment').click();
+    await expect(page.locator('text=count: 1')).toBeVisible();
+  });
+  test('state writes from jsCode functions keep state merged in later', async ({ page, sdk }) => {
+    test.skip(
+      sdk !== 'react',
+      'Covers the React jsCode state writer; the route mock also cannot reach server-side httpRequests fetches.'
+    );
+
+    await page.route(/https:\/\/cdn\.builder\.io\/api\/v1\/proxy-api.*/, route =>
+      route.fulfill({ status: 200, json: { title: 'fetched' } })
+    );
+    await page.goto('/js-code-context-http/');
+    await expect(page.locator('text=article: fetched')).toBeVisible();
+    await page.getByText('Increment').click();
+    await expect(page.locator('text=count: 1')).toBeVisible();
+    await expect(page.locator('text=article: fetched')).toBeVisible();
+  });
   test('runs code (after client-side navigation)', async ({ page }) => {
     await page.goto('/');
 
```

**File**: `packages/sdks-tests/src/specs/index.ts` (modified, +3/-0)
```diff
@@ -31,6 +31,7 @@ import {
 import { CONTENT as rawImg } from './raw-img.js';
 import { INPUT_DEFAULT_VALUE } from './input-default-value.js';
 import { JS_CODE_CONTENT } from './js-code.js';
+import { JS_CODE_CONTEXT_CONTENT, JS_CODE_CONTEXT_HTTP_CONTENT } from './js-code-context.js';
 import { JS_CONTENT_IS_BROWSER } from './js-content-is-browser.js';
 import { CONTENT as linkUrl } from './link-url.js';
 import { CONTENT as nestedSymbols } from './nested-symbols.js';
@@ -140,6 +141,8 @@ export const PAGES: Record<string, Page> = {
   '/columns': { content: COLUMNS },
   '/symbols': { content: symbols },
   '/js-code': { content: JS_CODE_CONTENT },
+  '/js-code-context': { content: JS_CODE_CONTEXT_CONTENT },
+  '/js-code-context-http': { content: JS_CODE_CONTEXT_HTTP_CONTENT },
   '/symbols-without-content': { content: CONTENT_WITHOUT_SYMBOLS },
   '/symbols-with-global': { content: CONTENT_WITH_GLOBAL_SYMBOL },
   '/symbol-bindings': { content: symbolBindings },
```

**File**: `packages/sdks-tests/src/specs/js-code-context.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+export const JS_CODE_CONTEXT_CONTENT = {
+  data: {
+    title: 'js-code-context',
+    jsCode: 'state.count = 0; context.increment = function () { state.count = state.count + 1; };',
+    blocks: [
+      {
+        '@type': '@builder.io/sdk:Element',
+        '@version': 2,
+        id: 'builder-js-code-context-text',
+        bindings: {
+          'component.options.text':
+            'var _virtual_index="count: "+state.count;return _virtual_index',
+        },
+        component: { name: 'Text', options: { text: 'count: ...' } },
+      },
+      {
+        '@type': '@builder.io/sdk:Element',
+        '@version': 2,
+        id: 'builder-js-code-context-button',
+        actions: { click: 'context.increment()' },
+        component: { name: 'Core:Button', options: { text: 'Increment' } },
+      },
+    ],
+  },
+  id: 'js-code-context',
+  modelId: 'page',
+  name: 'js-code-context',
+  published: 'published',
+  query: [],
+  testRatio: 1,
+  variations: {},
+};
+
+export const JS_CODE_CONTEXT_HTTP_CONTENT = {
+  ...JS_CODE_CONTEXT_CONTENT,
+  id: 'js-code-context-http',
+  name: 'js-code-context-http',
+  data: {
+    ...JS_CODE_CONTEXT_CONTENT.data,
+    title: 'js-code-context-http',
+    httpRequests: {
+      article: 'https://cdn.builder.io/api/v1/proxy-api?url=https%3A%2F%2Fexample.com%2Farticle',
+    },
+    blocks: [
+      ...JS_CODE_CONTEXT_CONTENT.data.blocks,
+      {
+        '@type': '@builder.io/sdk:Element',
+        '@version': 2,
+        id: 'builder-js-code-context-http-text',
+        bindings: {
+          'component.options.text':
+            'var _a,_virtual_index="article: "+((_a=state.article)&&_a.title||"none");return _virtual_index',
+        },
+        component: { name: 'Text', options: { text: 'article: ...' } },
+      },
+    ],
+  },
+};
```

**File**: `packages/sdks/src/components/content/components/enable-editor.lite.tsx` (modified, +1/-1)
```diff
@@ -262,7 +262,7 @@ export default function EnableEditor(props: BuilderEditorProps) {
               String(
                 evaluate({
                   code: group,
-                  context: props.context || {},
+                  context: props.builderContextSignal.value.context,
                   localState: undefined,
                   rootState: props.builderContextSignal.value.rootState,
                   rootSetState: props.builderContextSignal.value.rootSetState,
```

**File**: `packages/sdks/src/components/content/content.helpers.test.ts` (modified, +16/-0)
```diff
@@ -1,6 +1,7 @@
 import type { RegisteredComponent } from '../../context/types.js';
 import {
   getComponentInfos,
+  getLiveRootState,
   getRegisteredComponents,
   getRootStateInitialValue,
 } from './content.helpers.js';
@@ -103,3 +104,18 @@ describe('getRegisteredComponents', () => {
     expect(infos.Custom.name).toBe('Custom');
   });
 });
+
+describe('getLiveRootState', () => {
+  test('reads and writes the current root state after it is replaced', () => {
+    let rootState: Record<string, any> = { count: 1 };
+    const live: Record<string, any> = getLiveRootState(() => rootState);
+
+    rootState = { ...rootState, article: { title: 'fetched' } };
+    live.count = live.count + 1;
+
+    expect(rootState).toEqual({ count: 2, article: { title: 'fetched' } });
+    expect(live.article.title).toBe('fetched');
+    expect('article' in live).toBe(true);
+    expect({ ...live }).toEqual(rootState);
+  });
+});
```

**File**: `packages/sdks/src/components/content/content.helpers.ts` (modified, +20/-0)
```diff
@@ -97,3 +97,23 @@ export const getContentInitialValue = ({
         meta: content?.meta,
       };
 };
+
+/**
+ * A state object whose reads and writes go to whatever `getRootState` returns
+ * when they happen, for jsCode functions that outlive the root state object
+ * they were defined against.
+ */
+export const getLiveRootState = (
+  getRootState: () => BuilderRenderState
+): BuilderRenderState =>
+  new Proxy({} as BuilderRenderState, {
+    get: (_, prop) => Reflect.get(getRootState(), prop),
+    set: (_, prop, value) => Reflect.set(getRootState(), prop, value),
+    has: (_, prop) => Reflect.has(getRootState(), prop),
+    deleteProperty: (_, prop) => Reflect.deleteProperty(getRootState(), prop),
+    ownKeys: () => Reflect.ownKeys(getRootState()),
+    getOwnPropertyDescriptor: (_, prop) => {
+      const descriptor = Reflect.getOwnPropertyDescriptor(getRootState(), prop);
+      return descriptor && { ...descriptor, configurable: true };
+    },
+  });
```

---

### Incident Patch 2: `a77fd515` (2026-10-05)
**Commit Message**: fix[sdks][personalization]: ENG-13927 dedupe personalization and A/B helper scripts across Content components (#4884)

**File**: `.changeset/tidy-pillows-crash.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+'@builder.io/sdk-react': minor
+'@builder.io/sdk-angular': minor
+'@builder.io/sdk-react-nextjs': minor
+'@builder.io/sdk-qwik': minor
+'@builder.io/sdk-react-native': minor
+'@builder.io/sdk-solid': minor
+'@builder.io/sdk-svelte': minor
+'@builder.io/sdk-vue': minor
+---
+
+Add a `BuilderScripts` component that emits the Variant Container (`window.builderIoPersonalization`, `window.filterWithCustomTargeting`, `window.updateVisibilityStylesScript`) and A/B test (`window.builderIoAbTest`, `window.builderIoRenderContent`) helper scripts once for every `Content` rendered inside it. Wrap pages that render several `Content` components to avoid shipping a copy of these scripts per `Content`. A `BuilderScripts` nested inside another one emits nothing:
+
+```tsx
+<BuilderScripts nonce={cspNonce}>{children}</BuilderScripts>
+```
```

**File**: `packages/sdks/docs/PERSONALIZATION_CONTAINER.md` (modified, +10/-0)
```diff
@@ -66,6 +66,16 @@ The component injects two scripts during SSR:
 - `updateVisibilityStylesScript`: Updates CSS to control variant visibility
 - `personalizationScript`: Handles cookie management and DOM modifications
 
+These calls rely on helper functions (`window.builderIoPersonalization`, `window.filterWithCustomTargeting`, `window.updateVisibilityStylesScript`, `window.builderIoStudioUserAttributes`) defined by the `builderio-init-personalization-variants-fns` script. That script is emitted:
+
+- once per top-level `Content` whose content contains a Personalization Container (including inlined symbols)
+- by a nested symbol `Content` only when its content was fetched separately, since the parent never saw it
+- not at all by `Content` rendered inside `BuilderScripts`, which emits the helpers (and the A/B test helpers) once for all of its children. A `BuilderScripts` nested inside another one emits nothing; sibling wrappers each emit a copy
+
+`BuilderScripts` relies on context, so it only dedupes in React, Vue, Svelte, Solid and Qwik. In the Next.js (RSC), Angular and React Native SDKs it renders its children unchanged.
+
+With `@builder.io/sdk-react` in the Next.js App Router, `BuilderScripts` and `Content` must come from the same client module graph. Importing `BuilderScripts` from the package directly in a server component (like `app/layout.tsx`) makes the browser load the SDK's `lib/node` build for it and the `lib/browser` build for `Content`. Each build has its own context, so `Content` renders its own helpers in the browser but not on the server, and hydration fails. Re-export `BuilderScripts` from a `"use client"` file and import that in the layout. See the [React SDK README](../output/react/README.md#nextjs-app-router).
+
 ### Variant Reset
 
 For SDKs requiring the reset approach (Vue, Svelte):
```

**File**: `packages/sdks/docs/SSR_AB_TEST.md` (modified, +2/-0)
```diff
@@ -155,4 +155,6 @@ On CSR, 2 scripts will run:
 
 Both scripts and the variant style tag "self-destruct" in hydration frameworks by removing themselves, as they are not needed anymore.
 
+The functions both scripts call are defined by the `builderio-init-variants-fns` script, which each `Content` with SSR'd variants emits. When several such `Content` components share a page, render them inside `BuilderScripts` to emit it once (see [PERSONALIZATION_CONTAINER.md](./PERSONALIZATION_CONTAINER.md#script-injection) for supported SDKs).
+
 And as a last extra step for Svelte/Solid: on the second CSR, we unmount everything except for the winning variant. This isn't strictly necessary, but it reduces the amount of HTML and components in the DOM which might help with performance.
```

**File**: `packages/sdks/mitosis.config.cjs` (modified, +5/-1)
```diff
@@ -843,7 +843,11 @@ module.exports = {
     "readystatechange"`
                 );
               }
-              return code;
+              // BuilderScripts is optional; Qwik useContext throws without a provider unless given a default.
+              return code.replaceAll(
+                'useContext(BuilderScriptsContext)',
+                'useContext(BuilderScriptsContext, { scriptsEmitted: false })'
+              );
             },
           },
         }),
```

**File**: `packages/sdks/output/react/README.md` (modified, +43/-0)
```diff
@@ -52,6 +52,49 @@ function App() {
 
 Look at the [examples](#examples) for more information.
 
+### Multiple `Content` components on one page
+
+Each `Content` that contains a Variant Container or an A/B test inlines a copy of the helper scripts those features need. If a page renders several `Content` components (for example a header, the page body and a footer), wrap them once in `BuilderScripts` so the helpers are emitted a single time:
+
+```tsx
+import { BuilderScripts, Content } from '@builder.io/sdk-react';
+
+export default function Layout({ children }) {
+  return <BuilderScripts nonce={cspNonce}>{children}</BuilderScripts>;
+}
+```
+
+Use one `BuilderScripts` above every `Content` that uses these features, not one around each `Content`. Sibling wrappers each emit their own copy. A `BuilderScripts` nested inside another one emits nothing, so adding an extra one lower in the tree is safe. The `nonce` prop is optional and only needed with a Content Security Policy. `BuilderScripts` always emits the helpers, even if nothing inside it uses personalization or A/B tests, so place it only around pages that do.
+
+#### Next.js App Router
+
+Don't import `BuilderScripts` from `@builder.io/sdk-react` directly in a server component such as `app/layout.tsx`. Next.js then loads a different build of the SDK for it in the browser than the one your `"use client"` component uses for `Content`, so `Content` can't see the wrapper. The server HTML has one helper script, the browser renders one per `Content`, and hydration fails.
+
+Re-export it from a client file and import that instead:
+
+```tsx
+// components/builder-scripts.tsx
+'use client';
+export { BuilderScripts } from '@builder.io/sdk-react';
+```
+
+```tsx
+// app/layout.tsx
+import { BuilderScripts } from '../components/builder-scripts';
+
+export default function RootLayout({ children }) {
+  return (
+    <html lang="en">
+      <body>
+        <BuilderScripts>{children}</BuilderScripts>
+      </body>
+    </html>
+  );
+}
+```
+
+Wrapping the `Content` components inside the same client component also works.
+
 ## Mitosis
 
 This SDK is generated by [Mitosis](https://github.com/BuilderIO/mitosis). To see the Mitosis source-code, go [here](../../).
```

**File**: `packages/sdks/overrides/react-native/src/index-helpers/blocks-exports.ts` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@ export { default as Text } from '../blocks/text/index.js';
 // export { default as Video } from '../blocks/video/video.lite';
 
 import { default as Blocks } from '../components/blocks/index.js';
+import { default as BuilderScripts } from '../components/builder-scripts.js';
 import { default as Content } from '../components/content-variants/index.js';
 
-export { Blocks, Content };
+export { Blocks, BuilderScripts, Content };
```

**File**: `packages/sdks/src/blocks/symbol/symbol.helpers.test.ts` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import { describe, expect, test } from 'vitest';
+import { isSymbolContentInlinedInParent } from './symbol.helpers.js';
+
+const symbol = { model: 'symbol', content: { data: { blocks: [] } } };
+
+describe('isSymbolContentInlinedInParent', () => {
+  test('inlined when the symbol has content and no content binding', () => {
+    expect(isSymbolContentInlinedInParent(symbol, undefined)).toBe(true);
+    expect(
+      isSymbolContentInlinedInParent(symbol, {
+        'component.options.symbol.data.title': 'state.title',
+      })
+    ).toBe(true);
+  });
+
+  test('not inlined without content', () => {
+    expect(isSymbolContentInlinedInParent({ model: 'symbol' }, undefined)).toBe(
+      false
+    );
+    expect(isSymbolContentInlinedInParent(undefined, undefined)).toBe(false);
+  });
+
+  test('not inlined when the symbol or its content comes from a binding', () => {
+    for (const key of [
+      'component.options.symbol',
+      'component.options.symbol.content',
+      'component.options.symbol.content.data.blocks',
+      'options.symbol',
+    ]) {
+      expect(
+        isSymbolContentInlinedInParent(symbol, { [key]: 'state.symbol' })
+      ).toBe(false);
+    }
+  });
+});
```

**File**: `packages/sdks/src/blocks/symbol/symbol.helpers.ts` (modified, +17/-0)
```diff
@@ -14,6 +14,23 @@ export interface SymbolInfo {
   global?: boolean;
 }
 
+const isSymbolContentBinding = (key: string) => {
+  const path = key.startsWith('component.') ? key.slice(10) : key;
+  return (
+    path === 'options.symbol' ||
+    path === 'options.symbol.content' ||
+    path.startsWith('options.symbol.content.')
+  );
+};
+
+// Bound symbol content is evaluated at render time, so it is not in the parent content JSON.
+export const isSymbolContentInlinedInParent = (
+  symbol: SymbolInfo | undefined,
+  bindings: Record<string, string> | undefined
+) =>
+  !!symbol?.content &&
+  !Object.keys(bindings || {}).some(isSymbolContentBinding);
+
 export const fetchSymbolContent = async ({
   builderContextValue,
   symbol,
```

---

### Incident Patch 3: `aebe2b88` (2026-10-02)
**Commit Message**: Run Gen 1 E2E fixtures on @builder.io/widgets 2 (#4877)

Stacked on #4875.

## What
The four Gen 1 E2E fixtures (`gen1-react`, `gen1-next14-pages`,
`gen1-next15-app`, `gen1-remix`) installed `@builder.io/widgets@1.2.24`
from npm. That meant the current 2.x release had no E2E coverage, and
the matrix listed Widgets as **Not verified**.

This PR moves all four fixtures to `^2.1.3`, the current release. The
Tabs and Accordion specs run against the widgets registered by the
fixtures. It also replaces the Widgets matrix row with the Gen 1
framework minimums those fixtures exercise:
- React 18.2.0
- Next.js 15.5.26 App Router with React 19.0.0
- Remix 1.19.3

Next.js 14 is left out, as in the Gen 1 React row.

`yarn.lock` shrinks because widgets 2 no longer pulls in the 1.x
dependency tree.

## Testing
- `yarn nx test @e2e/gen1-react` passed locally: 185 passed, 73 skipped.
- CI covers the other three fixtures.
- `yarn check:framework-support` passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Low Risk**
> Test fixtures, docs, and a CI validation script only; no production
SDK runtime changes.
> 
> **Overview**
> **Bumps G

**File**: `packages/react-tests/next14-pages/package.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   },
   "dependencies": {
     "@builder.io/react": "workspace:*",
-    "@builder.io/widgets": "^1.2.24",
+    "@builder.io/widgets": "^2.1.3",
     "@sdk/tests": "workspace:*",
     "next": "14.2.25",
     "react": "^18",
```

**File**: `packages/react-tests/next15-app/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   },
   "dependencies": {
     "@builder.io/react": "workspace:*",
-    "@builder.io/widgets": "^1.2.24",
+    "@builder.io/widgets": "^2.1.3",
     "@sdk/tests": "workspace:*",
     "next": "15.5.26",
     "react": "19.0.0",
```

**File**: `packages/react-tests/react-remix/package.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
   },
   "dependencies": {
     "@builder.io/react": "workspace:*",
-    "@builder.io/widgets": "^1.2.24",
+    "@builder.io/widgets": "^2.1.3",
     "@remix-run/node": "^1.14.3",
     "@remix-run/react": "^1.14.3",
     "@remix-run/serve": "^1.14.3",
```

**File**: `packages/react-tests/react-vite/package.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   },
   "dependencies": {
     "@builder.io/react": "workspace:*",
-    "@builder.io/widgets": "^1.2.24",
+    "@builder.io/widgets": "^2.1.3",
     "@sdk/tests": "workspace:*",
     "react": "^18.2.0",
     "react-dom": "^18.2.0"
```

**File**: `packages/sdks/README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Each version is the lowest one installed by a passing CI E2E fixture for that fr
 | [`@builder.io/react`](../react/) (Gen 1)                                   | [React](../react-tests/react-vite/package.json): `react@18.2.0` + `react-dom@18.2.0`; [Next.js App Router](../react-tests/next15-app/package.json): `next@15.5.26` + `react@19.0.0` + `react-dom@19.0.0`; [Remix](../react-tests/react-remix/package.json): `@remix-run/react@1.19.3`                                            |
 | [`@builder.io/angular`](../angular/) (Gen 1)                               | Not verified (no E2E fixture)                                                                                                                                                                                                                                                                                                    |
 | [`@builder.io/gatsby`](../gatsby/) (Gen 1)                                 | Not verified (no E2E fixture)                                                                                                                                                                                                                                                                                                    |
-| [`@builder.io/widgets`](../widgets/) (Gen 1)                               | Not verified (no E2E fixture)                                                                                                                                                                                                                                                                                                    |
+| [`@builder.io/widgets`](../widgets/) (Gen 1)                               | [React](../react-tests/react-vite/package.json): `react@18.2.0` + `react-dom@18.2.0`; [Next.js App Router](../react-tests/next15-app/package.json): `next@15.5.26` + `react@19.0.0` + `react-dom@19.0.0`; [Remix](../react-tests/react-remix/package.json): `@remix-run/react@1.19.3`                                            |
 | [`@builder.io/sdk-react`](./output/react/)                                 | [React](./e2e/react/package.json): `react@18.2.0` + `react-dom@18.2.0`; [Next.js App Router](./e2e/react-sdk-next-15-app/package.json): `next@15.5.26` + `react@19.0.0` + `react-dom@19.0.0`; [Remix](./e2e/remix/package.json): `@remix-run/react@2.9.2`; [Hydrogen](./e2e/hydrogen/package.json): `@shopify/hydrogen@2024.4.2` |
 | [`@builder.io/sdk-react-native`](./output/react-native/)                   | [React Native Web](./e2e/react-native-74/package.json): `react-native@0.74.2` + `react@18.2.0` + `react-dom@18.2.0` (native devices not tested)                                                                                                                                                                                  |
 | [`@builder.io/sdk-vue`](./output/vue/)                                     | [Vue](./e2e/vue/package.json): `vue@3.3.9`; [Nuxt](./e2e/nuxt/package.json): `nuxt@3.8.2`                                                                                                                                                                                                                                        |
```

**File**: `yarn.lock` (modified, +24/-235)
```diff
@@ -7279,27 +7279,27 @@ __metadata:
   languageName: unknown
   linkType: soft
 
-"@builder.io/widgets@npm:^1.2.24":
-  version: 1.2.24
-  resolution: "@builder.io/widgets@npm:1.2.24"
+"@builder.io/widgets@npm:^2.1.3":
+  version: 2.1.3
+  resolution: "@builder.io/widgets@npm:2.1.3"
   dependencies:
     "@emotion/core": ">=10"
     "@emotion/styled": ">=10"
     lodash-es: ^4.17.10
+    react-loadable: ^5.5.0
+    react-masonry-component: ^6.2.1
+    react-slick: ^0.31.0
+    tslib: ^2.1.0
+  peerDependencies:
+    "@builder.io/react": ">=5.0.11"
     next: ">=12.1.0"
     preact: ^8.4.2
     preact-compat: ^3.18.4
     preact-context: ^1.1.3
     prop-types: ^15.7.2
-    react-loadable: ^5.5.0
-    react-masonry-component: ^6.2.1
-    react-slick: ^0.28.1
-    tslib: ^1.10.0
-  peerDependencies:
-    "@builder.io/react": ">=1.1.0"
-    react: ">=16.8.0"
-    react-dom: ">=16.8.0"
-  dependenciesMeta:
+    react: ">=16.0.0-0 || ^19.0.0-rc"
+    react-dom: ">=16.0.0-0 || ^19.0.0-rc"
+  peerDependenciesMeta:
     next:
       optional: true
     preact:
@@ -7310,7 +7310,7 @@ __metadata:
       optional: true
     prop-types:
       optional: true
-  checksum: 05877ea67c9161694c4455ada30ddb29a4ea77d6c320d2f5679b23a07affacbe0cd4f08548573328141c357cc7a047b4a7546760549e8632a1fb98eab2637c20
+  checksum: 55bf3fd608d0a164ea4a345b80fb838793780243c43405bc020f16a854e88584b18837264bf001dca8917e4050a55de7cd5ad0259f111481d45fe012e0b7f371
   languageName: node
   linkType: hard
 
@@ -7770,7 +7770,7 @@ __metadata:
   resolution: "@e2e/gen1-next14-pages@workspace:packages/react-tests/next14-pages"
   dependencies:
     "@builder.io/react": "workspace:*"
-    "@builder.io/widgets": ^1.2.24
+    "@builder.io/widgets": ^2.1.3
     "@sdk/tests": "workspace:*"
     "@types/node": ^20
     "@types/react": ^18.3.3
@@ -7789,7 +7789,7 @@ __metadata:
   resolution: "@e2e/gen1-next15-app@workspace:packages/react-tests/next15-app"
   dependencies:
     "@builder.io/react": "workspace:*"
-    "@builder.io/widgets": ^1.2.24
+    "@builder.io/widgets": ^2.1.3
     "@sdk/tests": "workspace:*"
     "@types/node": ^20
     "@types/react": 19.0.0
@@ -7807,7 +7807,7 @@ __metadata:
   resolution: "@e2e/gen1-react@workspace:packages/react-tests/react-vite"
   dependencies:
     "@builder.io/react": "workspace:*"
-    "@builder.io/widgets": ^1.2.24
+    "@builder.io/widgets": ^2.1.3
     "@sdk/tests": "workspace:*"
     "@types/react": ^18.3.3
     "@types/react-dom": ^18.2.17
@@ -7824,7 +7824,7 @@ __metadata:
   resolution: "@e2e/gen1-remix@workspace:packages/react-tests/react-remix"
   dependencies:
     "@builder.io/react": "workspace:*"
-    "@builder.io/widgets": ^1.2.24
+    "@builder.io/widgets": ^2.1.3
     "@remix-run/dev": ^1.14.3
     "@remix-run/eslint-config": ^1.19.1
     "@remix-run/node": ^1.14.3
@@ -14736,13 +14736,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@next/env@npm:14.2.2":
-  version: 14.2.2
-  resolution: "@next/env@npm:14.2.2"
-  checksum: d722dfbb4e6b5572b5b16c823843dfec625c74bd263cd4c1ffaedc578805e16b818c7d27414c7e77c51a5a5fc83019513db29d310f5e14fd2fa71e555fdecc53
-  languageName: node
-  linkType: hard
-
 "@next/env@npm:14.2.25":
   version: 14.2.25
   resolution: "@next/env@npm:14.2.25"
@@ -14782,13 +14775,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@next/swc-darwin-arm64@npm:14.2.2":
-  version: 14.2.2
-  resolution: "@next/swc-darwin-arm64@npm:14.2.2"
-  conditions: os=darwin & cpu=arm64
-  languageName: node
-  linkType: hard
-
 "@next/swc-darwin-arm64@npm:14.2.25":
   version: 14.2.25
   resolution: "@next/swc-darwin-arm64@npm:14.2.25"
@@ -14810,13 +14796,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@next/swc-darwin-x64@npm:14.2.2":
-  version: 14.2.2
-  resolution: "@next/swc-darwin-x64@npm:14.2.2"
-  conditions: os=darwin & cpu=x64
-  languageName: node
-  linkType: hard
-
 "@next/swc-darwin-x64@npm:14.2.25":
   version: 14.2.25
   resolution: "@next/swc-darwin-x64@npm:14.2.25"
@@ -14838,13 +14817,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@next/swc-linux-arm64-gnu@npm:14.2.2":
-  version: 14.2.2
-  resolution: "@next/swc-linux-arm64-gnu@npm:14.2.2"
-  conditions: os=linux & cpu=arm64 & libc=glibc
-  languageName: node
-  linkType: hard
-
 "@next/swc-linux-arm64-gnu@npm:14.2.25":
   version: 14.2.25
   resolution: "@next/swc-linux-arm64-gnu@npm:14.2.25"
@@ -14866,13 +14838,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@next/swc-linux-arm64-musl@npm:14.2.2":
-  version: 14.2.2
-  resolution: "@next/swc-linux-arm64-musl@npm:14.2.2"
-  conditions: os=linux & cpu=arm64 & libc=musl
-  languageName: node
-  linkType: hard
-
 "@next/swc-linux-arm64-musl@npm:14.2.25":
   version: 14.2.25
   resolution: "@next/swc-linux-arm64-musl@npm:14.2.25"
@@ -14894,13 +14859,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@next/swc-linux-x64-gnu@npm:14.2.2":
-  version: 14.2.2
-  resolution: "@next/swc-linux-x64-gnu@npm:14.2.2"
-  condi
```

---

### Incident Patch 4: `2a9ecfb5` (2026-10-02)
**Commit Message**: Check framework matrix against installed E2E fixture versions (#4875)

Stacked on #4867.

## What
`yarn check:framework-support` now resolves every package listed in a
supported matrix row from the linked E2E fixture's `node_modules`. It
fails if the installed version differs from the documented one.

Before, it only checked that listed versions fell inside the SDK peer
ranges. Most fixtures request `^` ranges, so a `yarn.lock` bump could
silently change the tested minimum and leave the matrix stale.

The check already runs in the CI lint job after `yarn install
--immutable`, so no workflow change is needed.

## Testing
- `yarn check:framework-support` passes against the current lockfile.
- Changing `vue@3.3.9` to `3.3.8` in the matrix fails with:
`@builder.io/sdk-vue lists vue@3.3.8, but ./e2e/vue installs 3.3.9;
update the matrix`.
- Changing `@builder.io/qwik-city@1.9.1` (not a peer dependency) to
`1.9.0` also fails.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Low Risk**
> Changes are limited to a lint script, documentation, and a Playwright
assertion; no production SDK or runtime behavior is modified.
> 
> **Overv

**File**: `packages/sdks-tests/src/snippet-tests/integrating-pages.spec.ts` (modified, +5/-0)
```diff
@@ -59,6 +59,11 @@ test.describe('Integrating Pages', () => {
       );
 
       await launchEmbedderAndWaitForSdk({ path: '/', basePort, page, sdk });
+      if (sdk !== 'oldReact') {
+        await expect(
+          page.frameLocator('iframe').getByText('Welcome to the homepage.')
+        ).toBeVisible();
+      }
 
       const NEW_TEXT = 'This is a new homepage.';
       const NEW_CONTENT = {
```

**File**: `packages/sdks/README.md` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ Each version is the lowest one installed by a passing CI E2E fixture for that fr
 | [`@builder.io/sdk-qwik`](./output/qwik/)                                   | [Qwik City](./e2e/qwik-city/package.json): `@builder.io/qwik@1.9.1` + `@builder.io/qwik-city@1.9.1`                                                                                                                                                                                                                              |
 | [`@builder.io/sdk-react-nextjs`](./output/nextjs/) (RSC registration only) | [Next.js App Router](./e2e/nextjs-sdk-next-app/package.json): `next@14.2.25` + `react@18.2.0` + `react-dom@18.2.0` (Next.js 14 is [no longer supported upstream](https://nextjs.org/support-policy))                                                                                                                             |
 
-Versions are the ones CI installs from the immutable `yarn.lock`; most fixtures request `^` ranges, so recheck this table whenever the lockfile changes. Next.js 14 is [unsupported upstream](https://nextjs.org/support-policy); it is listed only for the RSC SDK until that SDK has a newer Next.js fixture. The [Android sample](../android/) is not a published SDK.
+Versions are the ones CI installs from the immutable `yarn.lock`; `yarn check:framework-support` fails if a fixture's installed version no longer matches this table, so update it whenever the lockfile changes. Next.js 14 is [unsupported upstream](https://nextjs.org/support-policy); it is listed only for the RSC SDK until that SDK has a newer Next.js fixture. The [Android sample](../android/) is not a published SDK.
 
 ## Development
 
```

**File**: `scripts/check-framework-support.mjs` (modified, +25/-1)
```diff
@@ -1,5 +1,5 @@
 import assert from 'node:assert/strict';
-import { readFileSync } from 'node:fs';
+import { existsSync, readFileSync } from 'node:fs';
 import semver from 'semver';
 
 const packages = new Map([
@@ -27,6 +27,15 @@ const packages = new Map([
 ]);
 
 const root = new URL('../', import.meta.url);
+
+// Version the fixture actually installs, found the way Node resolves it: nearest node_modules upward.
+const installedVersion = (fixtureDir, pkg) => {
+  for (let dir = fixtureDir; dir.href.startsWith(root.href); dir = new URL('../', dir)) {
+    const manifest = new URL(`node_modules/${pkg}/package.json`, dir);
+    if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, 'utf8')).version;
+  }
+};
+const matrixDir = new URL('packages/sdks/', root);
 const matrix = readFileSync(new URL('packages/sdks/README.md', root), 'utf8');
 const rows = matrix.split('\n').filter(line => line.startsWith('| [`@builder.io/'));
 const seen = new Set();
@@ -73,6 +82,21 @@ for (const row of rows) {
       );
     }
   }
+
+  for (const segment of supported.split(';')) {
+    const fixtures = [...segment.matchAll(/\]\((\.[^)]*)\/package\.json\)/g)];
+    for (const [, fixture] of fixtures) {
+      const fixtureDir = new URL(`${fixture}/`, matrixDir);
+      for (const [, pkg, version] of segment.matchAll(/`([^`]+)@(\d+\.\d+\.\d+)`/g)) {
+        const installed = installedVersion(fixtureDir, pkg);
+        assert.equal(
+          installed,
+          version,
+          `${name} lists ${pkg}@${version}, but ${fixture} installs ${installed ?? 'nothing'}; update the matrix`
+        );
+      }
+    }
+  }
 }
 
 assert.equal(seen.size, packages.size, 'Framework matrix must include every framework-facing SDK');
```

---

### Incident Patch 5: `86019dc4` (2026-10-01)
**Commit Message**: perf(sdks): faster gen2 rendering; stop mutating content during render (#4874)

- memoize processed blocks without bindings per block + locale
- resolve localized values copy-on-write (fixes wrong locale on reused
content)
- apply bindings copy-on-write instead of deep-cloning blocks
- copy content state/input defaults so state writes never reach cached
content
- build the component registry once per registration; cache filtered
registries
- node: pooled isolated-vm isolate with fresh context per eval + cached
scripts; pure state expressions skip the sandbox
- browser: compile binding functions once per code string
- react: compute Block componentRefProps once per render

## Description

taking inspiration from https://github.com/puruvj/builder-sdk-svelte,
take a performance pass at the SDK which benefits all gen2 sdks, and
maintains feature parity

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Medium Risk**
> Touches core render path, Node sandbox semantics, and intentional
breaking changes around state isolation and CSS specificity; broad SDK
surface with extensive new tests mitigates but SSR/jsCode behavior may
surprise integrators.
> 
> **Overview**
> **Faster Gen2 rendering** wit

**File**: `.changeset/fast-gen2-rendering.md` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+---
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-react": minor
+"@builder.io/sdk-react-native": minor
+"@builder.io/sdk-solid": minor
+"@builder.io/sdk-svelte": minor
+"@builder.io/sdk-vue": minor
+---
+
+Faster rendering, and rendering no longer mutates the content object:
+
+- Blocks without bindings are processed once per block and locale instead of on every render; localized values are resolved without modifying the content (fixes the wrong locale showing when the same content object is rendered with a different `locale`).
+- Bindings are applied copy-on-write instead of deep-cloning the block.
+- The component registry is built once per registration instead of on every `Content`/`Symbol` render.
+- Node: `isolated-vm` evaluations reuse a periodically recycled isolate (fresh context per evaluation) with cached scripts, and pure state expressions over plain data (e.g. `!state.open`, `state.$index + 1`) skip the sandbox; expressions that would read getters or class instances still run in it.
+- Browser: binding functions are compiled once per code string.
+- Compiled-expression and path caches are bounded and evict the oldest entry instead of clearing; the processed-block cache keeps only the latest locale per block.
+- Node: `jsCode` that sets state with `Object.assign(state, {...})` no longer throws inside `isolated-vm`, and nested state writes (`state.user.name = ...`) and `delete state.x` update root state at the full path instead of writing a stray top-level key.
+
+Behavior changes. These fix bugs, but code that relied on the old behavior will see a difference:
+
+- Content state (`data.state`, input defaults) is copied per render, so state written during a render no longer appears on the content object you passed in, and can no longer leak into a cached content object.
+- Node: writes and deletes on `context`, `builder` and `event` in `jsCode` no longer reach root state.
+- Node: function values assigned to state in `jsCode` are skipped on the server instead of throwing.
+- `set`, `setCopyOnWrite` and `unset` follow only own properties and use the same path rule: `__proto__` is never allowed, and `constructor`/`prototype` only as the final key.
+- The default `.builder-button` reset now has zero specificity (`:where(.builder-button)`), so a button's own block styles win even when a later `Content` on the page emits the reset after them. Global `button` rules in your own CSS now also apply to Builder buttons.
```

**File**: `packages/sdks-tests/src/e2e-tests/default-styles.spec.ts` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import { expect } from '@playwright/test';
 import { checkIsRN, excludeGen1, test } from '../helpers/index.js';
 
 // is a subset - if this selector is there then others would've also been added
-const DEFAULT_STYLES = `.builder-button {
+const DEFAULT_STYLES = `:where(.builder-button) {
   all: unset;
 }
 `;
```

**File**: `packages/sdks-tests/src/e2e-tests/reactivity.spec.ts` (modified, +13/-0)
```diff
@@ -22,6 +22,19 @@ test.describe('Reactive State', () => {
     await expect(page.getByText('1', { exact: true })).toBeVisible();
   });
 
+  test('updates text templates when state changes', async ({ page, packageName, sdk }) => {
+    test.fail(excludeTestFor({ rsc: true }, sdk));
+    test.fail(packageName === 'nextjs-sdk-next-app');
+
+    await page.goto('/reactive-state');
+
+    await expect(page.getByText('Template value: 0', { exact: true })).toBeVisible();
+
+    await page.getByText('Increment Number').click();
+
+    await expect(page.getByText('Template value: 1', { exact: true })).toBeVisible();
+  });
+
   test('updates deeply nested state value correctly', async ({ page, sdk }) => {
     test.fail(excludeTestFor({ rsc: true }, sdk));
     test.skip(excludeTestFor({ vue: true }, sdk), 'TO-DO: Fix this test for Vue');
```

**File**: `packages/sdks-tests/src/specs/reactive-state.ts` (modified, +11/-0)
```diff
@@ -94,6 +94,17 @@ export const REACTIVE_STATE_CONTENT = {
                       },
                     },
                   },
+                  {
+                    '@type': '@builder.io/sdk:Element',
+                    '@version': 2,
+                    id: 'builder-7c1f0e2a9b3d4c6e8f5a1b2c3d4e5f60',
+                    component: {
+                      name: 'Text',
+                      options: {
+                        text: 'Template value: {{state.reactiveValue}}',
+                      },
+                    },
+                  },
                   {
                     '@type': '@builder.io/sdk:Element',
                     '@version': 2,
```

**File**: `packages/sdks/mitosis.config.cjs` (modified, +1/-0)
```diff
@@ -853,6 +853,7 @@ module.exports = {
     },
     svelte: {
       typescript: true,
+      memoizeGetters: true,
       plugins: [
         /**
          * This plugin modifies `svelte:component` to elements to use the `svelte:element` syntax instead.
```

**File**: `packages/sdks/src/components/block/block.helpers.ts` (modified, +39/-6)
```diff
@@ -7,6 +7,7 @@ import type {
 import { evaluate } from '../../functions/evaluate/index.js';
 import { extractTextStyles } from '../../functions/extract-text-styles.js';
 import { getStyle } from '../../functions/get-style.js';
+import { isEditingOrPreviewing } from '../../functions/is-editing-or-previewing.js';
 import type { BuilderBlock } from '../../types/builder-block.js';
 import type { RepeatData } from './types.js';
 
@@ -51,6 +52,23 @@ export const getComponent = ({
   }
 };
 
+// Reused per block so repeated items keep a stable block identity across renders.
+const BLOCKS_WITHOUT_REPEAT = new WeakMap<BuilderBlock, BuilderBlock>();
+
+const getBlockWithoutRepeat = (block: BuilderBlock) => {
+  if (isEditingOrPreviewing()) {
+    const { repeat: _repeat, ...rest } = block;
+    return rest;
+  }
+  let blockWithoutRepeat = BLOCKS_WITHOUT_REPEAT.get(block);
+  if (!blockWithoutRepeat) {
+    const { repeat: _repeat, ...rest } = block;
+    blockWithoutRepeat = rest;
+    BLOCKS_WITHOUT_REPEAT.set(block, blockWithoutRepeat);
+  }
+  return blockWithoutRepeat;
+};
+
 export const getRepeatItemData = ({
   block,
   context,
@@ -62,7 +80,7 @@ export const getRepeatItemData = ({
    * we don't use `state.processedBlock` here because the processing done within its logic includes evaluating the block's bindings,
    * which will not work if there is a repeat.
    */
-  const { repeat, ...blockWithoutRepeat } = block;
+  const { repeat } = block;
 
   if (!repeat?.collection) {
     return undefined;
@@ -83,6 +101,7 @@ export const getRepeatItemData = ({
   const collectionName = repeat.collection.split('.').pop();
   const itemNameToUse =
     repeat.itemName || (collectionName ? collectionName + 'Item' : 'item');
+  const blockWithoutRepeat = getBlockWithoutRepeat(block);
 
   const repeatArray = itemsArray.map<RepeatData>((item, index) => ({
     context: {
@@ -125,17 +144,31 @@ export const provideLinkComponent = (
   return {};
 };
 
+const FILTERED_REGISTERED_COMPONENTS = new WeakMap<
+  RegisteredComponents,
+  Map<string, RegisteredComponents>
+>();
+
 export const provideRegisteredComponents = (
   block: RegisteredComponent | null | undefined,
   registeredComponents: RegisteredComponents,
   model: string
 ) => {
   if (block?.shouldReceiveBuilderProps?.builderComponents) {
-    const filteredRegisteredComponents = Object.fromEntries(
-      Object.entries(registeredComponents).filter(([_, component]) => {
-        return !checkIsComponentRestricted(component, model);
-      })
-    );
+    let byModel = FILTERED_REGISTERED_COMPONENTS.get(registeredComponents);
+    if (!byModel) {
+      byModel = new Map();
+      FILTERED_REGISTERED_COMPONENTS.set(registeredComponents, byModel);
+    }
+    let filteredRegisteredComponents = byModel.get(model);
+    if (!filteredRegisteredComponents) {
+      filteredRegisteredComponents = Object.fromEntries(
+        Object.entries(registeredComponents).filter(([_, component]) => {
+          return !checkIsComponentRestricted(component, model);
+        })
+      );
+      byModel.set(model, filteredRegisteredComponents);
+    }
     return { builderComponents: filteredRegisteredComponents };
   }
 
```

**File**: `packages/sdks/src/components/block/block.lite.tsx` (modified, +52/-1)
```diff
@@ -180,8 +180,45 @@ export default function Block(props: BlockProps) {
         : [];
     },
 
+    /**
+     * Same memoization trick as `_processedBlock`: the template reads `componentRefProps`
+     * once per prop, so without it every read re-evaluates text templates and options.
+     */
+    _componentRefProps: {
+      value: null as ComponentProps | null,
+      deps: [] as unknown[],
+    },
     get componentRefProps(): ComponentProps {
-      return {
+      const deps: unknown[] = [
+        state.processedBlock,
+        props.context.value,
+        props.context.value.rootState,
+        props.context.value.localState,
+        props.registeredComponents,
+        props.linkComponent,
+      ];
+      useTarget({
+        svelte: () => {},
+        vue: () => {},
+        angular: () => {},
+        qwik: () => {},
+        solid: () => {},
+
+        // @ts-expect-error: missing return value
+        default: () => {
+          const cached = state._componentRefProps;
+          if (
+            cached.value &&
+            cached.deps.length === deps.length &&
+            cached.deps.every((dep, index) => dep === deps[index]) &&
+            !isPreviewing()
+          ) {
+            return cached.value;
+          }
+        },
+      });
+
+      const componentRefProps: ComponentProps = {
         blockChildren: state.processedBlock.children ?? [],
         componentRef: state.blockComponent?.component,
         componentOptions: {
@@ -214,6 +251,20 @@ export default function Block(props: BlockProps) {
         includeBlockProps: state.blockComponent?.noWrap === true,
         isInteractive: !(state.blockComponent?.isRSC && TARGET === 'rsc'),
       };
+
+      useTarget({
+        svelte: () => {},
+        vue: () => {},
+        angular: () => {},
+        qwik: () => {},
+        solid: () => {},
+        default: () => {
+          state._componentRefProps.value = componentRefProps;
+          state._componentRefProps.deps = deps;
+        },
+      });
+
+      return componentRefProps;
     },
   });
 
```

**File**: `packages/sdks/src/components/content/components/styles.helpers.ts` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ export const getCss = ({
 };
 
 const DEFAULT_STYLES = `
-.builder-button {
+:where(.builder-button) {
   all: unset;
 }
 
```

---

### Incident Patch 6: `9689cbcc` (2026-09-30)
**Commit Message**: fix[sdks][set]: ENG-14025 block prototype pollution via __proto__, constructor and prototype binding keys (#4878)

**File**: `.changeset/unlucky-mugs-lie.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-react": patch
+"@builder.io/sdk-react-native": patch
+"@builder.io/sdk-solid": patch
+"@builder.io/sdk-svelte": patch
+"@builder.io/sdk-vue": patch
+---
+
+Prevent prototype pollution by ignoring `__proto__`, `constructor` and `prototype` segments in block binding keys
```

**File**: `packages/sdks/src/functions/set.test.ts` (modified, +41/-0)
```diff
@@ -17,3 +17,44 @@ test('can deeply create arrays', () => {
   set(obj, 'foo.bar.0', 'hi');
   expect((obj.foo as any).bar).toEqual(['hi']);
 });
+
+test.each([
+  '__proto__.polluted',
+  'constructor.prototype.polluted',
+  'foo.__proto__.polluted',
+  '__proto__[polluted]',
+])('does not pollute Object.prototype via %s', (path) => {
+  const obj = {};
+  set(obj, path, 'yes');
+  expect(({} as any).polluted).toBeUndefined();
+  expect((Object.prototype as any).polluted).toBeUndefined();
+});
+
+test('does not pollute Object.prototype via array path', () => {
+  set({}, ['__proto__', 'polluted'], 'yes');
+  expect(({} as any).polluted).toBeUndefined();
+});
+
+test('does not pollute the Object constructor via non-terminal constructor', () => {
+  set({}, 'constructor.polluted', 'yes');
+  expect((Object as any).polluted).toBeUndefined();
+});
+
+test('does not change the prototype via terminal __proto__', () => {
+  const obj: any = { foo: {} };
+  set(obj, 'foo.__proto__', { polluted: 'yes' });
+  expect(obj.foo.polluted).toBeUndefined();
+  expect(Object.getPrototypeOf(obj.foo)).toBe(Object.prototype);
+});
+
+test('allows terminal constructor and prototype keys as own properties', () => {
+  const obj: any = {};
+  set(obj, 'fields.constructor', 'a');
+  set(obj, 'fields.prototype', 'b');
+  expect(Object.prototype.hasOwnProperty.call(obj.fields, 'constructor')).toBe(
+    true
+  );
+  expect(obj.fields.constructor).toBe('a');
+  expect(obj.fields.prototype).toBe('b');
+  expect(({} as any).constructor).toBe(Object);
+});
```

**File**: `packages/sdks/src/functions/set.ts` (modified, +11/-0)
```diff
@@ -12,6 +12,17 @@ export const set = (obj: any, _path: string | string[], value: any) => {
     ? _path
     : (_path.toString().match(/[^.[\]]+/g) as string[]);
 
+  if (
+    !path ||
+    path.some(
+      (key, i) =>
+        key === '__proto__' ||
+        (i < path.length - 1 && (key === 'constructor' || key === 'prototype'))
+    )
+  ) {
+    return obj;
+  }
+
   path
     .slice(0, -1)
     .reduce(
```

---

### Incident Patch 7: `b5e5c6e2` (2026-09-29)
**Commit Message**: fix[gen2]: ENG-14049 prevent URL parameters from overriding API key (#4869)

**File**: `.changeset/cuddly-tomatoes-sneeze.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-react": patch
+"@builder.io/sdk-react-native": patch
+"@builder.io/sdk-solid": patch
+"@builder.io/sdk-svelte": patch
+"@builder.io/sdk-vue": patch
+---
+
+Prevent content fetch options from overriding the configured API key
```

**File**: `packages/sdks/src/functions/get-content/generate-content-url.test.ts` (modified, +32/-0)
```diff
@@ -290,6 +290,38 @@ describe('Generate Content URL', () => {
     expect(output).toMatchSnapshot();
   });
 
+  test('does not allow preview parameters to override the configured API key', () => {
+    vi.stubGlobal('window', {
+      location: {
+        search:
+          '?builder.preview=BUILDER_STUDIO&builder.apiKey=other-space&builder.userAttributes.audience=members',
+        pathname: '/reproduction',
+        host: 'www.example.com',
+      },
+    });
+    vi.stubGlobal('document', {});
+
+    try {
+      const output = generateContentUrl({ apiKey: testKey, model: testModel });
+      const outputWithOptions = generateContentUrl({
+        apiKey: testKey,
+        model: testModel,
+        options: { apiKey: 'another-space' },
+      });
+
+      expect(output.searchParams.get('apiKey')).toBe(testKey);
+      expect(outputWithOptions.searchParams.get('apiKey')).toBe(testKey);
+      expect(output.searchParams.get('preview')).toBe('BUILDER_STUDIO');
+      expect(JSON.parse(output.searchParams.get('userAttributes')!)).toEqual({
+        audience: 'members',
+        urlPath: '/reproduction',
+        host: 'www.example.com',
+      });
+    } finally {
+      vi.unstubAllGlobals();
+    }
+  });
+
   test('converts Studio boolean user attributes from query parameters', () => {
     vi.stubGlobal('window', {
       location: {
```

**File**: `packages/sdks/src/functions/get-content/generate-content-url.ts` (modified, +3/-1)
```diff
@@ -109,7 +109,9 @@ export const generateContentUrl = (options: GetContentOptions): URL => {
 
   const flattened = flatten(queryOptions);
   for (const key in flattened) {
-    url.searchParams.set(key, String(flattened[key]));
+    if (key !== 'apiKey') {
+      url.searchParams.set(key, String(flattened[key]));
+    }
   }
 
   if (Object.keys(finalUserAttributes).length > 0) {
```

---

### Incident Patch 8: `72f2bc8c` (2026-09-28)
**Commit Message**: fix[sdks][image]: ENG-13982 remove redundant presentation role (#4864)

**File**: `.changeset/heavy-foxes-drop.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@builder.io/react": patch
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-react": patch
+"@builder.io/sdk-solid": patch
+"@builder.io/sdk-svelte": patch
+"@builder.io/sdk-vue": patch
+---
+
+Remove the redundant presentation role from Image blocks with empty alt text.
```

**File**: `packages/react/src/blocks/Image.tsx` (modified, +0/-1)
```diff
@@ -346,7 +346,6 @@ class ImageComponent extends React.Component<any, { imageLoaded: boolean; load:
                   ? (typeof this.image === 'string' && this.image.split('?')[0]) || undefined
                   : undefined
               }
-              role={!this.props.altText ? 'presentation' : undefined}
               css={{
                 opacity: amp ? 1 : this.useLazyLoading && !this.state.imageLoaded ? 0 : 1,
                 transition: 'opacity 0.2s ease-in-out',
```

**File**: `packages/react/test/image.test.tsx` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ describe('Image', () => {
     const image = tree.children.find((child: any) => child.type === 'img');
 
     expect(image.props.alt).toBe('');
+    expect(image.props.role).toBeUndefined();
   });
 
   it('Shopify image url', () => {
```

**File**: `packages/sdks-tests/src/e2e-tests/blocks.spec.ts` (modified, +2/-0)
```diff
@@ -157,7 +157,9 @@ test.describe('Blocks', () => {
 
       const images = page.locator('.builder-image');
       await expect(images.first()).toHaveAttribute('alt', '');
+      await expect(images.first()).not.toHaveAttribute('role');
       await expect(images.nth(1)).toHaveAttribute('alt', 'alt text test');
+      await expect(images.nth(1)).not.toHaveAttribute('role');
     });
 
     test('Image sizes attribute', async ({ page, sdk }) => {
```

**File**: `packages/sdks-tests/src/specs/image.ts` (modified, +2/-0)
```diff
@@ -38,6 +38,7 @@ export const CONTENT = {
           options: {
             image:
               'https://cdn.builder.io/api/v1/image/assets%2Ff1a790f8c3204b3b8c5c1795aeac4660%2F7054b4049c3745a4a18a537eff0fe74b?width=982',
+            altText: '',
             backgroundSize: 'cover',
             backgroundPosition: 'top right',
             lazy: false,
@@ -243,6 +244,7 @@ export const CONTENT_2 = {
           options: {
             image:
               'https://cdn.builder.io/api/v1/image/assets%2Ff1a790f8c3204b3b8c5c1795aeac4660%2F7054b4049c3745a4a18a537eff0fe74b?width=982',
+            altText: '',
             backgroundSize: 'cover',
             backgroundPosition: 'top right',
             lazy: false,
```

**File**: `packages/sdks/src/blocks/image/image.lite.tsx` (modified, +0/-1)
```diff
@@ -101,7 +101,6 @@ export default function Image(props: ImageProps) {
           fetchpriority={props.highPriority ? 'high' : 'auto'}
           alt={props.altText || ''}
           title={props.title}
-          role={props.altText ? undefined : 'presentation'}
           css={{
             opacity: '1',
             transition: 'opacity 0.2s ease-in-out',
```

---

### Incident Patch 9: `ac687928` (2026-09-25)
**Commit Message**: fix[sdk-tests]: mock Studio refetch in personalization container e2e test (#4866)

## Description

Fixes the react-sdk-next-pages e2e failure that's blocking the Publish
SDKs PR (#4865).

**Why it fails:**
The Studio preview test added in #4863 loads the page with
builder.preview=BUILDER_STUDIO. That flag makes the SDK fetch fresh
content from the live Builder API. The test pages use a fake API key, so
the API returns a 401. The SDK then throws that error without catching
it, and the test fails.

It's not flaky. It failed on all 7 reruns.

**Fix:**
The test now intercepts that content request and returns the page's own
test content, the same way other e2e tests handle content API calls. No
SDK code changes.

**Link to JIRA ticket (if applicable):**
https://builder-io.atlassian.net/browse/...

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Low Risk**
> Only adjusts an e2e test mock; no production or SDK runtime code is
modified.
> 
> **Overview**
> The **Studio preview** e2e case in `personalization-container.spec.ts`
now **intercepts** live Builder content API calls before navigation.
With `builder.preview=BUILDER_STUDIO`, the SDK refetches from
`cdn.builder.io`; the test’s mock API ke

**File**: `packages/sdks-tests/src/e2e-tests/personalization-container.spec.ts` (modified, +6/-0)
```diff
@@ -136,6 +136,12 @@ test.describe('Personalization Container', () => {
     }
 
     test('Studio preview URL selects the variant with no cookie set', async ({ page }) => {
+      // BUILDER_STUDIO triggers a live refetch. Unmocked, the mock apiKey gets a 401 that
+      // rejects unhandled; empty results resolve to null so no content merge re-renders.
+      await page.route(/https:\/\/cdn\.builder\.io\/api\/v3\/content/, route =>
+        route.fulfill({ status: 200, json: { results: [] } })
+      );
+
       // The pre-hydration inline selector reads the cookie, which Studio cannot write on
       // this origin. Asserting the default is hidden catches it falling back to that.
       await page.goto(
```

---

### Incident Patch 10: `2587fea5` (2026-09-24)
**Commit Message**: fix[studioTab][gen2]: ENG-13049 Fix Studio tab date override for Variant Containers (#4863)

## Description

Changing the date in Builder's Studio tab does nothing to Variant
Containers on Gen 2 sites. The preview keeps showing the default variant
no matter which date you pick, so you can't check scheduled content
before it goes live.

Root Cause:
Studio sends the date two ways and Gen 2 ignores both.

1. It puts `builder.userAttributes.date` in the preview URL. The SDK
does read that, but only when building the content API request. The
Variant Container never looks at the URL.

2. It also posts a `builder.evaluate` message into the iframe. The SDK
only starts listening for those inside `setupBrowserForEditing()`, which
runs when isEditing() is true. That requires `builder.frameEditing` in
the URL, and Studio never sets it. Nothing is listening, so the message
goes nowhere.

The Variant Container reads its targeting attributes from exactly one
place, the `builder.userAttributes` cookie. Studio can't write that
cookie because it's on a different origin, and browsers block cross-site
iframe cookie writes anyway. With no date to work from, the SDK falls
back to the real current time, 

**File**: `.changeset/studio-user-attributes-targeting.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+'@builder.io/sdk-react-nextjs': patch
+'@builder.io/sdk-react-native': patch
+'@builder.io/sdk-angular': patch
+'@builder.io/sdk-svelte': patch
+'@builder.io/sdk-react': patch
+'@builder.io/sdk-solid': patch
+'@builder.io/sdk-qwik': patch
+'@builder.io/sdk-vue': patch
+---
+
+Fix Variant Containers ignoring Builder Studio targeting overrides, which are passed as `builder.userAttributes.*` query params rather than through the cookie.
```

**File**: `packages/sdks-tests/src/e2e-tests/personalization-container.spec.ts` (modified, +13/-0)
```diff
@@ -134,6 +134,19 @@ test.describe('Personalization Container', () => {
         await expect(page.getByText(TEXTS.DEFAULT_CONTENT).locator('visible=true')).toBeHidden();
       });
     }
+
+    test('Studio preview URL selects the variant with no cookie set', async ({ page }) => {
+      // The pre-hydration inline selector reads the cookie, which Studio cannot write on
+      // this origin. Asserting the default is hidden catches it falling back to that.
+      await page.goto(
+        '/personalization-container?builder.preview=BUILDER_STUDIO&builder.userAttributes.experiment=A'
+      );
+
+      await expect(page.getByText(TEXTS.EXPERIMENT_A).locator('visible=true')).toBeVisible();
+      await expect(page.getByText(TEXTS.NON_PERSONALIZED).locator('visible=true')).toBeVisible();
+      await expect(page.getByText(TEXTS.EXPERIMENT_B).locator('visible=true')).toBeHidden();
+      await expect(page.getByText(TEXTS.DEFAULT_CONTENT).locator('visible=true')).toBeHidden();
+    });
   });
 
   test('setClientUserAttributes and builder.setUserAttributes sets cookie and renders variant after the first render', async ({
```

**File**: `packages/sdks/src/blocks/personalization-container/helpers.ts` (modified, +5/-0)
```diff
@@ -7,6 +7,7 @@ import type { Target } from '../../types/targets.js';
 import {
   FILTER_WITH_CUSTOM_TARGETING_SCRIPT,
   PERSONALIZATION_SCRIPT,
+  STUDIO_USER_ATTRIBUTES_SCRIPT,
   UPDATE_VISIBILITY_STYLES_SCRIPT,
 } from './helpers/inlined-fns.js';
 import type { PersonalizationContainerProps } from './personalization-container.types.js';
@@ -16,6 +17,7 @@ export const DEFAULT_INDEX = 'default';
 const FILTER_WITH_CUSTOM_TARGETING_SCRIPT_FN_NAME = 'filterWithCustomTargeting';
 const BUILDER_IO_PERSONALIZATION_SCRIPT_FN_NAME = 'builderIoPersonalization';
 const UPDATE_VARIANT_VISIBILITY_SCRIPT_FN_NAME = 'updateVisibilityStylesScript';
+const STUDIO_USER_ATTRIBUTES_SCRIPT_FN_NAME = 'builderIoStudioUserAttributes';
 
 const PERSONALIZATION_CONTAINER_COMPONENT_NAME = 'PersonalizationContainer';
 
@@ -180,6 +182,9 @@ export const hasPersonalizationContainer = (
 export const getInitPersonalizationVariantsFnsScriptString = () => {
   return `
   (function() {
+    if (!window.${STUDIO_USER_ATTRIBUTES_SCRIPT_FN_NAME}) {
+      window.${STUDIO_USER_ATTRIBUTES_SCRIPT_FN_NAME} = ${STUDIO_USER_ATTRIBUTES_SCRIPT};
+    }
     if (!window.${FILTER_WITH_CUSTOM_TARGETING_SCRIPT_FN_NAME}) {
       window.${FILTER_WITH_CUSTOM_TARGETING_SCRIPT_FN_NAME} = ${FILTER_WITH_CUSTOM_TARGETING_SCRIPT};
     }
```

**File**: `packages/sdks/src/blocks/personalization-container/helpers/inlined-fns.ts` (modified, +27/-0)
```diff
@@ -6,6 +6,30 @@
 import type { Query, UserAttributes } from '../helpers.js';
 import { type PersonalizationContainerProps } from '../personalization-container.types.js';
 
+/**
+ * Mirrors helpers/studio-user-attributes.ts; stringification rules out sharing the code.
+ * Anything referenced from module scope becomes an undefined global at runtime.
+ */
+export function getStudioUserAttributes() {
+  const params = new URLSearchParams(window.location.search);
+
+  if (params.get('builder.preview') !== 'BUILDER_STUDIO') {
+    return {};
+  }
+
+  const prefix = 'builder.userAttributes.';
+  const attributes: Record<string, unknown> = {};
+
+  params.forEach(function (value, key) {
+    if (key.indexOf(prefix) === 0) {
+      attributes[key.slice(prefix.length)] =
+        value === 'true' ? true : value === 'false' ? false : value;
+    }
+  });
+
+  return attributes;
+}
+
 function getPersonalizedVariant(
   variants: PersonalizationContainerProps['variants'],
   blockId: string,
@@ -31,6 +55,7 @@ function getPersonalizedVariant(
   if (locale) {
     attributes.locale = locale;
   }
+  Object.assign(attributes, (window as any).builderIoStudioUserAttributes());
 
   const winningVariantIndex = variants?.findIndex(function (variant) {
     return (window as any).filterWithCustomTargeting(
@@ -213,6 +238,7 @@ export function updateVisibilityStylesScript(
     if (locale) {
       attributes.locale = locale;
     }
+    Object.assign(attributes, (window as any).builderIoStudioUserAttributes());
     const winningVariantIndex = variants?.findIndex(function (variant) {
       return (window as any).filterWithCustomTargeting(
         attributes,
@@ -236,6 +262,7 @@ export function updateVisibilityStylesScript(
   }
 }
 
+export const STUDIO_USER_ATTRIBUTES_SCRIPT = getStudioUserAttributes.toString();
 export const PERSONALIZATION_SCRIPT = getPersonalizedVariant.toString();
 export const FILTER_WITH_CUSTOM_TARGETING_SCRIPT =
   filterWithCustomTargeting.toString();
```

**File**: `packages/sdks/src/helpers/studio-user-attributes.test.ts` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import {
+  STUDIO_USER_ATTRIBUTES_SCRIPT,
+  getStudioUserAttributes as getStudioUserAttributesInline,
+} from '../blocks/personalization-container/helpers/inlined-fns';
+import { isBrowser } from '../functions/is-browser';
+import { getStudioUserAttributes } from './studio-user-attributes';
+
+vi.mock('../functions/is-browser', () => ({
+  isBrowser: vi.fn().mockReturnValue(true),
+}));
+
+const setLocationSearch = (search: string) => {
+  vi.stubGlobal('window', { location: { search } });
+};
+
+const withStudioPreview = (params: string) =>
+  '?builder.preview=BUILDER_STUDIO&' + params;
+
+describe('getStudioUserAttributes', () => {
+  afterEach(() => {
+    vi.unstubAllGlobals();
+  });
+
+  it('returns nothing outside the browser', () => {
+    vi.mocked(isBrowser).mockReturnValueOnce(false);
+
+    expect(getStudioUserAttributes()).toEqual({});
+  });
+
+  it('returns nothing when the Studio preview flag is absent', () => {
+    setLocationSearch('?builder.userAttributes.device=mobile');
+
+    expect(getStudioUserAttributes()).toEqual({});
+  });
+
+  it('returns nothing for a non-Studio preview value', () => {
+    // builder.preview=<modelName> is the normal editor preview, not Studio.
+    setLocationSearch(
+      '?builder.preview=page&builder.userAttributes.device=mobile'
+    );
+
+    expect(getStudioUserAttributes()).toEqual({});
+  });
+
+  it('extracts userAttributes params, stripping the prefix', () => {
+    setLocationSearch(
+      withStudioPreview(
+        'builder.userAttributes.device=mobile&builder.userAttributes.date=2026-09-25T18:30:00.000Z'
+      )
+    );
+
+    expect(getStudioUserAttributes()).toEqual({
+      device: 'mobile',
+      date: '2026-09-25T18:30:00.000Z',
+    });
+  });
+
+  it('ignores unrelated builder params', () => {
+    setLocationSearch(
+      withStudioPreview(
+        'builder.cachebust=true&builder.options.locale=Default&builder.userAttributes.device=tablet'
+      )
+    );
+
+    expect(getStudioUserAttributes()).toEqual({ device: 'tablet' });
+  });
+
+  it('coerces boolean-like values so they match boolean targeting rules', () => {
+    setLocationSearch(
+      withStudioPreview(
+        'builder.userAttributes.isLoggedIn=true&builder.userAttributes.isNew=false'
+      )
+    );
+
+    expect(getStudioUserAttributes()).toEqual({
+      isLoggedIn: true,
+      isNew: false,
+    });
+  });
+
+  it('leaves other values as strings', () => {
+    setLocationSearch(
+      withStudioPreview('builder.userAttributes.audienceSize=42')
+    );
+
+    expect(getStudioUserAttributes()).toEqual({ audienceSize: '42' });
+  });
+
+  it('keeps dotted attribute names flat rather than nesting them', () => {
+    // filterWithCustomTargeting does a flat userattr[property] lookup, so nesting these
+    // the way generate-content-url.ts does for the API would stop the rule matching.
+    setLocationSearch(
+      withStudioPreview('builder.userAttributes.account.plan=pro')
+    );
+
+    expect(getStudioUserAttributes()).toEqual({ 'account.plan': 'pro' });
+  });
+});
+
+describe('inlined copy of getStudioUserAttributes', () => {
+  afterEach(() => {
+    vi.unstubAllGlobals();
+  });
+
+  const searches = [
+    '',
+    '?builder.userAttributes.device=mobile',
+    '?builder.preview=page&builder.userAttributes.device=mobile',
+    withStudioPreview('builder.userAttributes.date=2026-09-25T18:30:00.000Z'),
+    withStudioPreview(
+      'builder.cachebust=true&builder.userAttributes.isLoggedIn=true&builder.userAttributes.isNew=false'
+    ),
+    withStudioPreview('builder.userAttributes.account.plan=pro'),
+  ];
+
+  it.each(searches)('matches the module helper for %s', (search) => {
+    setLocationSearch(search);
+
+    expect(getStudioUserAttributesInline()).toEqual(getStudioUserAttributes());
+  });
+
+  it('still works once stringified into the page', () => {
+    // Catches a module-scope reference, which stringifies into an undefined global.
+    setLocationSearch(
+      withStudioPreview('builder.userAttributes.date=2026-09-25T18:30:00.000Z')
+    );
+
+    const stringified = new Function(
+      'return (' + STUDIO_USER_ATTRIBUTES_SCRIPT + ')'
+    )();
+
+    expect(stringified()).toEqual({ date: '2026-09-25T18:30:00.000Z' });
+  });
+});
```

**File**: `packages/sdks/src/helpers/studio-user-attributes.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { isBrowser } from '../functions/is-browser.js';
+import type { UserAttributes } from './user-attributes.js';
+
+const STUDIO_PREVIEW_PARAM = 'builder.preview';
+const STUDIO_PREVIEW_VALUE = 'BUILDER_STUDIO';
+const USER_ATTRIBUTE_PARAM_PREFIX = 'builder.userAttributes.';
+
+const parseStudioValue = (value: string) => {
+  if (value === 'true') return true;
+  if (value === 'false') return false;
+  return value;
+};
+
+/**
+ * Studio passes its targeting overrides as query params because it cannot write the
+ * builder.userAttributes cookie on the previewed site's origin.
+ */
+export const getStudioUserAttributes = (): UserAttributes => {
+  if (!isBrowser()) {
+    return {};
+  }
+
+  const params = new URLSearchParams(window.location.search);
+
+  if (params.get(STUDIO_PREVIEW_PARAM) !== STUDIO_PREVIEW_VALUE) {
+    return {};
+  }
+
+  const attributes: UserAttributes = {};
+  params.forEach((value, key) => {
+    if (key.startsWith(USER_ATTRIBUTE_PARAM_PREFIX)) {
+      attributes[key.slice(USER_ATTRIBUTE_PARAM_PREFIX.length)] =
+        parseStudioValue(value);
+    }
+  });
+
+  return attributes;
+};
```

**File**: `packages/sdks/src/helpers/user-attributes.test.ts` (modified, +74/-1)
```diff
@@ -1,4 +1,4 @@
-import { beforeEach, describe, expect, it, vi } from 'vitest';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import { isBrowser } from '../functions/is-browser';
 import { getCookieSync, setCookie } from './cookie';
 import {
@@ -16,14 +16,30 @@ vi.mock('../functions/is-browser', () => ({
   isBrowser: vi.fn().mockReturnValue(true),
 }));
 
+// isBrowser is mocked true throughout, so a window has to exist to match.
+const setLocationSearch = (search: string) => {
+  vi.stubGlobal('window', { location: { search } });
+};
+
+const STUDIO_DATE = '2026-09-25T18:30:00.000Z';
+const STUDIO_SEARCH =
+  '?builder.preview=BUILDER_STUDIO&builder.userAttributes.date=' + STUDIO_DATE;
+
 describe('createUserAttributesService', () => {
   let service: ReturnType<typeof createUserAttributesService>;
 
   beforeEach(() => {
     vi.clearAllMocks();
+    // clearAllMocks keeps mockReturnValue, so a stubbed cookie would leak between tests.
+    vi.mocked(getCookieSync).mockReturnValue(JSON.stringify({}));
+    setLocationSearch('');
     service = createUserAttributesService();
   });
 
+  afterEach(() => {
+    vi.unstubAllGlobals();
+  });
+
   describe('setUserAttributes', () => {
     it('should set user attributes and notify subscribers', () => {
       const callback = vi.fn();
@@ -106,4 +122,61 @@ describe('createUserAttributesService', () => {
       });
     });
   });
+
+  describe('Studio preview overrides', () => {
+    it('merges Studio URL attributes over the cookie so date targeting can be previewed', () => {
+      vi.mocked(getCookieSync).mockReturnValue(
+        JSON.stringify({ locale: 'en-US' })
+      );
+      setLocationSearch(STUDIO_SEARCH);
+
+      expect(service.getUserAttributes()).toEqual({
+        locale: 'en-US',
+        date: STUDIO_DATE,
+      });
+    });
+
+    it('lets Studio attributes win over the same key in the cookie', () => {
+      vi.mocked(getCookieSync).mockReturnValue(
+        JSON.stringify({ date: '2020-01-01T00:00:00.000Z' })
+      );
+      setLocationSearch(STUDIO_SEARCH);
+
+      expect(service.getUserAttributes().date).toBe(STUDIO_DATE);
+    });
+
+    it('ignores userAttributes params when the Studio preview flag is absent', () => {
+      // Otherwise any URL could spoof targeting for a real visitor.
+      setLocationSearch('?builder.userAttributes.date=' + STUDIO_DATE);
+
+      expect(service.getUserAttributes()).toEqual({});
+    });
+
+    it('never persists Studio overrides into the cookie', () => {
+      // Persisting it would skew real targeting for the rest of the session.
+      setLocationSearch(STUDIO_SEARCH);
+
+      service.setUserAttributes({ name: 'John' });
+
+      expect(setCookie).toHaveBeenCalledWith({
+        name: 'builder.userAttributes',
+        value: JSON.stringify({ name: 'John' }),
+        canTrack: true,
+      });
+    });
+
+    it('re-applies Studio overrides when notifying subscribers', () => {
+      // A mid-session setClientUserAttributes must not clobber the preview override.
+      setLocationSearch(STUDIO_SEARCH);
+      const callback = vi.fn();
+      service.subscribeOnUserAttributesChange(callback);
+
+      service.setUserAttributes({ name: 'John' });
+
+      expect(callback).toHaveBeenCalledWith({
+        name: 'John',
+        date: STUDIO_DATE,
+      });
+    });
+  });
 });
```

**File**: `packages/sdks/src/helpers/user-attributes.ts` (modified, +18/-5)
```diff
@@ -2,6 +2,7 @@ import { TARGET } from '../constants/target.js';
 import { isBrowser } from '../functions/is-browser.js';
 import { getCookieSync, setCookie } from './cookie.js';
 import { noSerializeWrapper } from './no-serialize-wrapper.js';
+import { getStudioUserAttributes } from './studio-user-attributes.js';
 export interface UserAttributes {
   [key: string]: any;
 }
@@ -11,29 +12,41 @@ export const USER_ATTRIBUTES_COOKIE_NAME = 'builder.userAttributes';
 export function createUserAttributesService() {
   let canTrack = true;
   const subscribers = new Set<(attrs: UserAttributes) => void>();
+
+  const getCookieUserAttributes = (): UserAttributes => {
+    const cookie = getCookieSync({
+      name: USER_ATTRIBUTES_COOKIE_NAME,
+      canTrack,
+    });
+    return cookie ? JSON.parse(cookie) : {};
+  };
+
   return {
     setUserAttributes(newAttrs: UserAttributes) {
       if (!isBrowser()) {
         return;
       }
       const userAttributes: UserAttributes = {
-        ...this.getUserAttributes(),
+        ...getCookieUserAttributes(),
         ...newAttrs,
       };
       setCookie({
         name: USER_ATTRIBUTES_COOKIE_NAME,
         value: JSON.stringify(userAttributes),
         canTrack,
       });
-      subscribers.forEach((callback) => callback(userAttributes));
+      // Kept out of the cookie above so previewing never persists into a real visitor's
+      // session, but re-applied here so the site's own attributes cannot clobber it.
+      const studioAttributes = getStudioUserAttributes();
+      subscribers.forEach((callback) =>
+        callback({ ...userAttributes, ...studioAttributes })
+      );
     },
     getUserAttributes() {
       if (!isBrowser()) {
         return {};
       }
-      return JSON.parse(
-        getCookieSync({ name: USER_ATTRIBUTES_COOKIE_NAME, canTrack }) || '{}'
-      );
+      return { ...getCookieUserAttributes(), ...getStudioUserAttributes() };
     },
     subscribeOnUserAttributesChange(
       callback: (attrs: UserAttributes) => void,
```

---

### Incident Patch 11: `23d99c3d` (2026-09-18)
**Commit Message**: fix[smartling][utils]: ENG-13950 non-translatable link fields get overwritten after Smartling translation (#4860)

## Description

Fixes non-translatable link fields being overwritten with the English
URL after a Smartling translation is applied.

When a list field is localized (one array per locale) and its subfields
are marked `nonTranslatableInputs`, applying a translation rebuilds the
target locale's array from the source array. Translated text gets
patched back in, but non-translatable fields are never sent for
translation, so nothing patches them, and they silently inherit the
source value.

Anything the author had set for that locale is lost.

**Example:**

A carousel slide with a German link, before translation:
`"link": { "de-DE": "https://www.sumup.com/de-de/zahlungen-annehmen/" }`

**After:**
```
"link": {
  "Default": "https://www.sumup.com/en-gb/take-payments/",
  "de-DE":   "https://www.sumup.com/en-gb/take-payments/"
}
```
The German URL is gone and every locale points at the English page.

**Fix:**
- Added `restoreExcludedLeaves` in `translation-helpers.ts`
- Before writing the rebuilt payload to the target locale, it copies
back any value the locale already had at 

**File**: `packages/utils/src/translation-helpers.test.ts` (modified, +43/-0)
```diff
@@ -2040,3 +2040,46 @@ test('applyTranslation restores a skipped relative path into the target locale',
 
   expect((result.data as any).sibling['de-DE']).toEqual('./checkout');
 });
+
+test('applyTranslation keeps non-translatable values the target locale already had', () => {
+  const slide = (link: any) => ({
+    title: { '@type': localizedType, Default: 'Hospitality' },
+    link,
+  });
+  const content: BuilderContent = {
+    data: {
+      blocks: [
+        {
+          '@type': '@builder.io/sdk:Element',
+          id: 'builder-carousel',
+          meta: {
+            localizedTextInputs: ['slides'],
+            nonTranslatableInputs: ['slides.*.link'],
+          },
+          component: {
+            name: 'GenericCarousel',
+            options: {
+              slides: {
+                '@type': localizedType,
+                Default: [slide({ '@type': localizedType, Default: '/en-gb/take-payments/' })],
+                'de-DE': [slide({ '@type': localizedType, 'de-DE': '/de-de/zahlungen/' })],
+              },
+            },
+          },
+        },
+      ],
+    },
+  };
+
+  const translation = getTranslateableFields(content, 'en-US', 'instructions');
+  const translated: typeof translation = {};
+  Object.keys(translation).forEach(key => {
+    translated[key] = { ...translation[key], value: 'DE ' + translation[key].value };
+  });
+
+  const result = applyTranslation(content, translated, 'de-DE', 'en-US');
+  const slides = (result.data as any).blocks[0].component.options.slides['de-DE'];
+
+  expect(slides[0].link).toEqual({ '@type': localizedType, 'de-DE': '/de-de/zahlungen/' });
+  expect(slides[0].title['de-DE']).toBe('DE Hospitality');
+});
```

**File**: `packages/utils/src/translation-helpers.ts` (modified, +65/-1)
```diff
@@ -644,6 +644,62 @@ function setTranslatedLeaf({
   }
 }
 
+// Non-translatable leaves would inherit the source value from the rebuilt payload; keep what
+// the locale had. Paths mirror extraction: `#index`, `#key`, none for a LocalizedValue branch.
+function restoreExcludedLeaves(
+  next: any,
+  previous: any,
+  basePath: string,
+  locale: string,
+  excluded: Set<string> | undefined
+): any {
+  if (!excluded || next == null || previous == null) {
+    return next;
+  }
+  if (isExcludedPath(excluded, basePath)) {
+    return JSON.parse(JSON.stringify(previous));
+  }
+  if (Array.isArray(next)) {
+    if (Array.isArray(previous)) {
+      next.forEach((item, index) => {
+        next[index] = restoreExcludedLeaves(
+          item,
+          previous[index],
+          `${basePath}#${index}`,
+          locale,
+          excluded
+        );
+      });
+    }
+    return next;
+  }
+  if (typeof next !== 'object' || typeof previous !== 'object') {
+    return next;
+  }
+  if (next['@type'] === localizedType) {
+    if (previous['@type'] === localizedType && next[locale] != null && previous[locale] != null) {
+      next[locale] = restoreExcludedLeaves(
+        next[locale],
+        previous[locale],
+        basePath,
+        locale,
+        excluded
+      );
+    }
+    return next;
+  }
+  Object.keys(next).forEach(key => {
+    next[key] = restoreExcludedLeaves(
+      next[key],
+      previous[key],
+      `${basePath}#${key}`,
+      locale,
+      excluded
+    );
+  });
+  return next;
+}
+
 export function applyTranslation(
   content: BuilderContent,
   translation: TranslateableFields,
@@ -986,7 +1042,15 @@ export function applyTranslation(
             });
           });
 
-          set(options, key, { ...(existing || {}), [locale]: localeValue });
+          const merged = restoreExcludedLeaves(
+            localeValue,
+            existing?.[locale],
+            flatKey,
+            locale,
+            excludedPaths
+          );
+
+          set(options, key, { ...(existing || {}), [locale]: merged });
           markTranslated();
         });
       }
```

---

### Incident Patch 12: `6b45a4f2` (2026-09-18)
**Commit Message**: fix[sdk][image]: ENG-13713 support responsive image positions across breakpoints (#4857)

**File**: `.changeset/warm-dolls-poke.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+"@builder.io/sdk-react": patch
+"@builder.io/react": patch
+"@builder.io/sdk-angular": patch
+"@builder.io/sdk-react-nextjs": patch
+"@builder.io/sdk-qwik": patch
+"@builder.io/sdk-solid": patch
+"@builder.io/sdk-svelte": patch
+"@builder.io/sdk-vue": patch
+---
+
+Allow Image blocks to honor breakpoint-specific image positions while preserving the configured image position as a fallback.
```

**File**: `packages/react/src/blocks/Image.tsx` (modified, +6/-2)
```diff
@@ -351,7 +351,9 @@ class ImageComponent extends React.Component<any, { imageLoaded: boolean; load:
                 opacity: amp ? 1 : this.useLazyLoading && !this.state.imageLoaded ? 0 : 1,
                 transition: 'opacity 0.2s ease-in-out',
                 objectFit: this.props.backgroundSize || 'cover',
-                objectPosition: this.props.backgroundPosition || 'center',
+                objectPosition: `var(--builder-image-position, ${
+                  this.props.backgroundPosition || 'center'
+                })`,
                 ...(aspectRatio &&
                   !amp && {
                     position: 'absolute',
@@ -363,7 +365,9 @@ class ImageComponent extends React.Component<any, { imageLoaded: boolean; load:
                 ...(amp && {
                   ['& img']: {
                     objectFit: this.props.backgroundSize,
-                    objectPosition: this.props.backgroundPosition,
+                    objectPosition: `var(--builder-image-position, ${
+                      this.props.backgroundPosition || 'center'
+                    })`,
                   },
                 }),
               }}
```

**File**: `packages/react/src/components/builder-block.component.tsx` (modified, +13/-4)
```diff
@@ -184,7 +184,8 @@ export class BuilderBlock extends React.Component<
 
     const reversedNames = sizeNames.slice().reverse();
     const styles: any = {};
-    if (responsiveStyles) {
+    const isBuilderImage = block.component?.name === 'Image';
+    if (responsiveStyles || isBuilderImage) {
       const contentHasXSmallBreakpoint = Boolean(
         this.privateState.context.builderContent?.meta?.breakpoints?.xsmall
       );
@@ -194,20 +195,28 @@ export class BuilderBlock extends React.Component<
           continue;
         }
 
+        const stylesForSize = responsiveStyles?.[size];
+        const imagePosition = isBuilderImage
+          ? stylesForSize?.objectPosition || (size === 'large' ? 'initial' : undefined)
+          : undefined;
+        const responsiveStylesForSize = imagePosition
+          ? { ...stylesForSize, '--builder-image-position': imagePosition }
+          : stylesForSize;
+
         if (size === 'large') {
           if (!this.props.emailMode) {
             styles[`&.builder-block`] = Object.assign(
               {},
-              responsiveStyles[size],
+              responsiveStylesForSize,
               initialAnimationStepStyles
             );
           }
-        } else {
+        } else if (responsiveStylesForSize) {
           const sizesPerBreakpoints = getSizesForBreakpoints(
             this.privateState.context.builderContent?.meta?.breakpoints || {}
           );
           styles[`@media only screen and (max-width: ${sizesPerBreakpoints[size].max}px)`] = {
-            '&.builder-block': responsiveStyles[size],
+            '&.builder-block': responsiveStylesForSize,
           };
         }
       }
```

**File**: `packages/sdks-tests/src/e2e-tests/blocks.spec.ts` (modified, +13/-0)
```diff
@@ -137,6 +137,19 @@ test.describe('Blocks', () => {
       }
     });
 
+    test('Image position is responsive', async ({ page, sdk }) => {
+      test.skip(checkIsRN(sdk));
+
+      await page.goto('/image');
+
+      const images = page.locator('.builder-image');
+      await expect(images.first()).toHaveCSS('object-position', '0% 0%');
+      await expect(images.nth(1)).toHaveCSS('object-position', '50% 50%');
+
+      await page.setViewportSize({ width: 500, height: 720 });
+      await expect(images.first()).toHaveCSS('object-position', '100% 100%');
+    });
+
     test('Image alt attribute', async ({ page, sdk }) => {
       test.skip(checkIsRN(sdk));
 
```

**File**: `packages/sdks-tests/src/specs/image.ts` (modified, +8/-0)
```diff
@@ -63,6 +63,10 @@ export const CONTENT = {
             overflow: 'hidden',
             marginLeft: 'auto',
             maxWidth: '604px',
+            objectPosition: 'top left',
+          },
+          small: {
+            objectPosition: 'bottom right',
           },
         },
       },
@@ -265,6 +269,10 @@ export const CONTENT_2 = {
             overflow: 'hidden',
             marginLeft: 'auto',
             maxWidth: '604px',
+            objectPosition: 'top left',
+          },
+          small: {
+            objectPosition: 'bottom right',
           },
         },
       },
```

**File**: `packages/sdks/src/blocks/image/image.lite.tsx` (modified, +6/-1)
```diff
@@ -107,7 +107,12 @@ export default function Image(props: ImageProps) {
             transition: 'opacity 0.2s ease-in-out',
           }}
           style={{
-            objectPosition: props.backgroundPosition || 'center',
+            objectPosition: useTarget({
+              reactNative: props.backgroundPosition || 'center',
+              default: `var(--builder-image-position, ${
+                props.backgroundPosition || 'center'
+              })`,
+            }),
             objectFit: props.backgroundSize || 'cover',
             ...state.aspectRatioCss,
           }}
```

**File**: `packages/sdks/src/components/block/components/block-styles.lite.tsx` (modified, +8/-2)
```diff
@@ -6,7 +6,10 @@ import {
 import { TARGET } from '../../../constants/target.js';
 import type { BuilderContextInterface } from '../../../context/types.js';
 import { camelToKebabCase } from '../../../functions/camel-to-kebab-case.js';
-import { createCssClass } from '../../../helpers/css.js';
+import {
+  createCssClass,
+  getResponsiveStylesWithImagePosition,
+} from '../../../helpers/css.js';
 import { checkIsDefined } from '../../../helpers/nullable.js';
 import type { BuilderBlock } from '../../../types/builder-block.js';
 import InlinedStyles from '../../inlined-styles.lite.jsx';
@@ -39,7 +42,10 @@ export default function BlockStyles(props: BlockStylesProps) {
     get css(): string {
       const processedBlock = props.block;
 
-      const styles = processedBlock.responsiveStyles;
+      const styles = getResponsiveStylesWithImagePosition(
+        processedBlock.responsiveStyles,
+        processedBlock.component?.name === 'Image'
+      );
 
       const content = props.context.content;
       const sizesWithUpdatedBreakpoints = getSizesForBreakpoints(
```

**File**: `packages/sdks/src/components/block/components/live-edit-block-styles.lite.tsx` (modified, +8/-2)
```diff
@@ -6,7 +6,10 @@ import {
 import { TARGET } from '../../../constants/target.js';
 import { camelToKebabCase } from '../../../functions/camel-to-kebab-case.js';
 import { getProcessedBlock } from '../../../functions/get-processed-block.js';
-import { createCssClass } from '../../../helpers/css.js';
+import {
+  createCssClass,
+  getResponsiveStylesWithImagePosition,
+} from '../../../helpers/css.js';
 import { findBlockById } from '../../../helpers/find-block.js';
 import { checkIsDefined } from '../../../helpers/nullable.js';
 import type {
@@ -59,7 +62,10 @@ export default function LiveEditBlockStyles(props: LiveEditBlockStylesProps) {
     },
 
     get css(): string {
-      const styles = this.processedBlock?.responsiveStyles;
+      const styles = getResponsiveStylesWithImagePosition(
+        this.processedBlock?.responsiveStyles,
+        this.processedBlock?.component?.name === 'Image'
+      );
 
       const content = props.contextProvider.content;
       const sizesWithUpdatedBreakpoints = getSizesForBreakpoints(
```

---

### Incident Patch 13: `456c70af` (2026-09-11)
**Commit Message**: fix[smartling][utils]: ENG-13890 exclude URL, image and link fields from translation jobs (#4852)

## Description

Image links, button URLs and page links from Builder content were all
showing up as strings for Smartling to translate.

**Root Cause:**
This is a regression from #4651 (June). That PR taught the extractor to
look inside a localized list or object and send each string it finds as
its own translation unit, which was the right fix for text fields that
were previously being skipped.

The catch is that the extractor has no idea what type a field is. So
once it starts walking a payload, it picks up every string in there.
`imageUrl`, `link` and `screenImage` are strings, so off they went.

We already patched one version of this in #4826, where the same walk was
sending dropdown values like "White" and "Left". That fix relied on the
editor recording which fields are non-translatable, which only helps for
localized list fields on blocks that carry that metadata. URLs on
symbols and on model fields go through different code paths and were
never covered.

**Fix:**
Added one small check: a string is not translatable if it has no
whitespace and starts with /, http://, https:// or 

**File**: `packages/utils/src/translation-helpers.test.ts` (modified, +286/-0)
```diff
@@ -1754,3 +1754,289 @@ test('applyTranslation seeds the source when an input had nothing to translate',
   // Without the locale branch the SDK renders undefined and the rows disappear.
   expect(rows['de-DE']).toEqual(rows.Default);
 });
+
+// URLs and asset references are routing values a translator cannot produce; sending them
+// pollutes the job and lets a translator overwrite a live link.
+const assetFieldsContent = (): BuilderContent => ({
+  data: {
+    heroImage: { '@type': localizedType, Default: 'https://cdn.builder.io/api/v1/image/hero.png' },
+    intro: { '@type': localizedType, Default: 'Visit https://example.com for more' },
+    blocks: [
+      {
+        '@type': '@builder.io/sdk:Element',
+        id: 'builder-slides',
+        meta: { localizedTextInputs: ['heroLink', 'slides'] },
+        component: {
+          name: 'Carousel',
+          options: {
+            heroLink: { '@type': localizedType, Default: 'https://example.com/en-gb/hero' },
+            slides: {
+              '@type': localizedType,
+              Default: [
+                {
+                  caption: 'Food and drink',
+                  imageUrl: 'https://cdn.builder.io/api/v1/image/slide.png',
+                  link: '/en-gb/business-types/food-and-drink',
+                },
+              ],
+            },
+          },
+        },
+      },
+      {
+        '@type': '@builder.io/sdk:Element',
+        id: 'builder-symbol',
+        component: {
+          name: 'Symbol',
+          options: {
+            symbol: {
+              data: {
+                buttonUrl: { '@type': localizedType, Default: 'https://example.com/en-gb' },
+                label: { '@type': localizedType, Default: 'Get started' },
+              },
+            },
+          },
+        },
+      },
+    ],
+  },
+});
+
+test('getTranslateableFields skips url and asset values but keeps prose containing a url', () => {
+  expect(getTranslateableFields(assetFieldsContent(), 'en-GB', 'instructions')).toEqual({
+    'metadata.intro': { value: 'Visit https://example.com for more', instructions: 'instructions' },
+    'blocks.builder-slides#slides#0#caption': {
+      value: 'Food and drink',
+      instructions: 'instructions',
+    },
+    'blocks.builder-symbol.symbolInput#label': {
+      value: 'Get started',
+      instructions: 'instructions',
+    },
+  });
+});
+
+test('applyTranslation keeps skipped urls readable in the target locale', () => {
+  const result = applyTranslation(
+    assetFieldsContent(),
+    {
+      'blocks.builder-slides#slides#0#caption': { value: 'Essen und Trinken' },
+      'blocks.builder-symbol.symbolInput#label': { value: 'Jetzt starten' },
+      'metadata.intro': { value: 'DE intro' },
+    },
+    'de-DE',
+    'en-GB'
+  );
+  const data = result.data as any;
+  const options = data.blocks[0].component.options;
+  const symbolData = data.blocks[1].component.options.symbol.data;
+
+  expect(options.slides['de-DE']).toEqual([
+    {
+      caption: 'Essen und Trinken',
+      imageUrl: 'https://cdn.builder.io/api/v1/image/slide.png',
+      link: '/en-gb/business-types/food-and-drink',
+    },
+  ]);
+  expect(options.heroLink['de-DE']).toEqual('https://example.com/en-gb/hero');
+  expect(symbolData.buttonUrl['de-DE']).toEqual('https://example.com/en-gb');
+  expect(data.heroImage['de-DE']).toEqual('https://cdn.builder.io/api/v1/image/hero.png');
+});
+
+test('applyTranslation does not seed real copy that a pending job has not returned yet', () => {
+  const result = applyTranslation(assetFieldsContent(), {}, 'de-DE', 'en-GB');
+  const data = result.data as any;
+
+  expect(data.blocks[1].component.options.symbol.data.label['de-DE']).toBeUndefined();
+  expect(data.intro['de-DE']).toBeUndefined();
+  expect(data.blocks[0].component.options.slides['de-DE']).toBeUndefined();
+});
+
+test('applyTranslation does not overwrite a url already localized for the target locale', () => {
+  const content = assetFieldsContent();
+  (content.data as any).blocks[1].component.options.symbol.data.buttonUrl['de-DE'] =
+    'https://example.com/de-de';
+
+  const result = applyTranslation(content, {}, 'de-DE', 'en-GB');
+  const symbolData = (result.data as any).blocks[1].component.options.symbol.data;
+
+  expect(symbolData.buttonUrl['de-DE']).toEqual('https://example.com/de-de');
+});
+
+// A payload the url guard empties draws no response at all, so the locale branch has to
+// be seeded or the SDK resolves the whole list to undefined and the content disappears.
+const urlOnlyPayloadContent = (): BuilderContent => ({
+  data: {
+    logos: {
+      '@type': localizedType,
+      Default: [{ image: 'https://cdn.builder.io/api/v1/image/logo.png', link: '/en-gb/partners' }],
+    },
+    tiles: {
+      '@type': localizedType,
+      Default: [
+        {
+          icon: { '@type': localizedType, Default: 'https://cdn.builder.io/api/v1/image/i.png' },
+          href: { '@type': localizedType, Default: 'https:
```

**File**: `packages/utils/src/translation-helpers.ts` (modified, +77/-7)
```diff
@@ -14,6 +14,31 @@ export type TranslateableFields = {
   };
 };
 
+// A bare url or asset is routing config, never copy. Whitespace means prose
+// ("Visit https://x.com for more"), which stays translatable.
+function isNonTranslatableValue(value: string) {
+  const trimmed = value.trim();
+  if (!trimmed || /\s/.test(trimmed)) {
+    return false;
+  }
+  const lower = trimmed.toLowerCase();
+  return (
+    lower.startsWith('/') ||
+    // './x' and '../x' are clearly links. Bare 'foo/bar' is not: it looks like 'and/or'.
+    lower.startsWith('./') ||
+    lower.startsWith('../') ||
+    lower.startsWith('http://') ||
+    lower.startsWith('https://') ||
+    lower.startsWith('cdn.builder.io/') ||
+    lower.startsWith('mailto:') ||
+    lower.startsWith('tel:') ||
+    lower.startsWith('sms:') ||
+    lower.startsWith('data:') ||
+    // Bare '#' is an empty placeholder; '#anchor' looks like a hashtag, so it stays in.
+    lower === '#'
+  );
+}
+
 function unescapeStringOrObject(input: string | Record<string, any>) {
   // Check if input is a string
   if (typeof input === 'string') {
@@ -62,7 +87,7 @@ function recordValue({
       const extractedValue = value?.[sourceLocaleId] || value?.Default;
 
       // If the extracted value is a string, store it directly
-      if (typeof extractedValue === 'string') {
+      if (typeof extractedValue === 'string' && !isNonTranslatableValue(extractedValue)) {
         results[path] = {
           value: extractedValue,
           instructions,
@@ -103,6 +128,7 @@ function resolveTranslation({
   translation,
   transformedMeta,
   locale,
+  sourceLocaleId,
 }: {
   data: any;
   basePath: string;
@@ -112,6 +138,7 @@ function resolveTranslation({
   translation: any;
   transformedMeta: Record<string, string>;
   locale: string;
+  sourceLocaleId?: string;
 }) {
   if (Array.isArray(value)) {
     value.forEach((item, index) => {
@@ -124,6 +151,7 @@ function resolveTranslation({
         translation,
         transformedMeta,
         locale,
+        sourceLocaleId,
       });
     });
   } else if (typeof value === 'object' && value !== null) {
@@ -141,6 +169,16 @@ function resolveTranslation({
       } else {
         // No direct translation - check if Default value contains nested LocalizedValues
         const defaultValue = value?.Default;
+        // Restore a skipped leaf. Picking the source the same way the extractor does
+        // avoids seeding a url over prose still out for translation.
+        const skippedSource = (sourceLocaleId && value?.[sourceLocaleId]) || value?.Default;
+        if (
+          typeof skippedSource === 'string' &&
+          isNonTranslatableValue(skippedSource) &&
+          value[locale] == null
+        ) {
+          set(data, dataPath, { ...value, [locale]: skippedSource });
+        }
         if (
           Array.isArray(defaultValue) ||
           (typeof defaultValue === 'object' && defaultValue !== null)
@@ -156,6 +194,7 @@ function resolveTranslation({
             translation,
             transformedMeta,
             locale,
+            sourceLocaleId,
           });
         }
 
@@ -175,6 +214,7 @@ function resolveTranslation({
             translation,
             transformedMeta,
             locale,
+            sourceLocaleId,
           });
         }
       }
@@ -189,6 +229,7 @@ function resolveTranslation({
           translation,
           transformedMeta,
           locale,
+          sourceLocaleId,
         });
       });
     }
@@ -230,7 +271,7 @@ function extractNestedStrings(
   excluded?: Set<string>
 ) {
   if (typeof value === 'string') {
-    if (value && !isExcludedPath(excluded, basePath)) {
+    if (value && !isExcludedPath(excluded, basePath) && !isNonTranslatableValue(value)) {
       results[basePath] = { value, instructions };
     }
   } else if (Array.isArray(value)) {
@@ -250,7 +291,7 @@ function extractNestedStrings(
       const nested = value[sourceLocaleId] || value.Default;
       const nestedInstructions = value.meta?.instructions || instructions;
       if (typeof nested === 'string' && nested) {
-        if (!isExcludedPath(excluded, basePath)) {
+        if (!isExcludedPath(excluded, basePath) && !isNonTranslatableValue(nested)) {
           results[basePath] = { value: nested, instructions: nestedInstructions };
         }
       } else if (nested !== null && nested !== undefined) {
@@ -313,7 +354,7 @@ function extractLocalizedLeaves(
     const nestedInstructions = value.meta?.instructions || instructions;
     if (typeof nested === 'string') {
       // Counts even when excluded, else the caller sweeps up every string instead.
-      if (nested && !isExcludedPath(excluded, basePath)) {
+      if (nested && !isExcludedPath(excluded, basePath) && !isNonTranslatableValue(nested)) {
         results[basePath] = { value: nested, instructions: nestedInstructions };
       }
       return 1;
@@ -379,7 +420,7 @@ export function getTranslateableFields(
     if (value['@typ
```

---

### Incident Patch 14: `08321f65` (2026-09-10)
**Commit Message**: fix[gen1][symbol]: ENG-13693 Editor flickers when using symbol with slot (#4849)

## Description

Blocks you drop into a Slot are not stored as normal children. They live
on the parent Symbol block under `symbol.data.<slotName>`, which you can
see in `Slot.tsx`:
`<BuilderBlocks dataPath={`symbol.data.${name}`}
blocks={context.state[name] || []} />`

`Symbol.tsx` builds the React key for its nested BuilderComponent from a
hash of that same symbol.data object. So every keystroke changed the
slot content, which changed the hash, which changed the key. React then
threw away the whole symbol subtree and rebuilt it.

This leads to the flickering in the editor when we try to update
content.

**Fix:**
Leave block arrays out of the key while editing. Slot content renders
through `BuilderBlocks` and already updates in place when the `data`
prop changes, so the remount was not buying us anything.

Live rendering keeps the exact key it has today, so nothing changes for
published pages.

**Link to JIRA ticket (if applicable):**
https://builder-io.atlassian.net/browse/ENG-13693

**Screenshot/Clip**
Bug: https://clips.agent-native.com/r/XujJySpqNeDH
Fix: https://clips.agent-native.com/r/1kFnRc088

**File**: `.changeset/lucky-moons-listen.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@builder.io/react': patch
+---
+
+Fix: editing a block inside a Symbol's Slot no longer remounts the Symbol. Slot content lives in `symbol.data.<slotName>`, which keyed the nested `BuilderComponent`, so every keystroke rebuilt the subtree and made the Visual Editor's inline edit popup flicker.
```

**File**: `packages/react/src/blocks/Symbol.tsx` (modified, +10/-1)
```diff
@@ -11,6 +11,14 @@ import { omit } from '../functions/utils';
 
 const size = (thing: object) => Object.keys(thing).length;
 
+const isBuilderElementArray = (value: any) =>
+  Array.isArray(value) && value.some(item => item?.['@type'] === '@builder.io/sdk:Element');
+
+// Slot content lives in `symbol.data.<name>`, so keying on it remounts the symbol on every edit to
+// a block inside a slot, tearing down the node the editor has selected. Blocks update in place.
+const omitBlockValues = (data: Record<string, any>) =>
+  omit(data, ...Object.keys(data).filter(key => isBuilderElementArray(data[key])));
+
 const isShopify = Builder.isBrowser && 'Shopify' in window;
 
 const refs: Record<string, Element> = {};
@@ -113,7 +121,8 @@ class SymbolComponent extends React.Component<PropsWithChildren<SymbolProps>> {
     }
 
     let key = dynamic ? this.props.builderBlock?.id : [model, entry].join(':');
-    const dataString = data && size(data) && hash(data);
+    const keyData = data && (Builder.isEditing ? omitBlockValues(data) : data);
+    const dataString = keyData && size(keyData) && hash(keyData);
 
     if (key && dataString && dataString.length < 300) {
       key += ':' + dataString;
```

**File**: `packages/react/test/symbol-slot-remount.test.tsx` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+/**
+ * @jest-environment jsdom
+ */
+
+import * as React from 'react';
+import { render } from '@testing-library/react';
+import { Builder, builder } from '@builder.io/sdk';
+import { BuilderPage } from '../src/builder-react';
+import { block } from './functions/render-block';
+
+builder.init('null');
+
+let mountCount = 0;
+
+const MountCounter = (props: { title?: string; testid?: string }) => {
+  React.useEffect(() => {
+    mountCount++;
+  }, []);
+  return <div data-testid={props.testid || 'counter'}>{props.title}</div>;
+};
+
+Builder.registerComponent(MountCounter, {
+  name: 'MountCounter',
+  inputs: [
+    { name: 'title', type: 'text' },
+    { name: 'testid', type: 'text' },
+  ],
+});
+
+const slotChild = (title: string, id = 'builder-child-1', testid?: string) =>
+  block('MountCounter', { title, testid }, { id } as any);
+
+const symbolBlock = (opts: {
+  id?: string;
+  entry?: string;
+  children?: any[];
+  heading?: string;
+  slotName?: string;
+}) =>
+  block(
+    'Symbol',
+    {
+      symbol: {
+        model: 'symbol',
+        entry: opts.entry || 'entry-1',
+        content: {
+          id: 'sym-1',
+          data: {
+            blocks: [
+              block('Slot', { name: opts.slotName || 'children' }, { id: 'builder-slot-1' } as any),
+            ],
+          },
+        },
+        data: {
+          ...(opts.heading !== undefined && { heading: opts.heading }),
+          [opts.slotName || 'children']: opts.children ?? [slotChild('A')],
+        },
+      },
+    },
+    { id: opts.id || 'builder-symbol-1' } as any
+  );
+
+const page = (blocks: any[]) => ({ id: 'page-1', data: { blocks } });
+
+describe('symbol + slot editing (editor)', () => {
+  beforeEach(() => {
+    mountCount = 0;
+    Builder.isEditing = true;
+  });
+
+  afterEach(() => {
+    Builder.isEditing = false;
+  });
+
+  it('does not remount slot children when their options change', () => {
+    const testApi = render(<BuilderPage model="page" content={page([symbolBlock({})]) as any} />);
+
+    const nodeBefore = testApi.getByTestId('counter');
+    expect(nodeBefore).toHaveTextContent('A');
+    expect(mountCount).toBe(1);
+
+    testApi.rerender(
+      <BuilderPage
+        model="page"
+        content={page([symbolBlock({ children: [slotChild('AB')] })]) as any}
+      />
+    );
+
+    expect(testApi.getByTestId('counter')).toBe(nodeBefore);
+    expect(nodeBefore).toHaveTextContent('AB');
+    expect(mountCount).toBe(1);
+  });
+
+  it('still applies adds and removes of slot children', () => {
+    const testApi = render(<BuilderPage model="page" content={page([symbolBlock({})]) as any} />);
+    expect(testApi.getByTestId('counter')).toHaveTextContent('A');
+
+    testApi.rerender(
+      <BuilderPage
+        model="page"
+        content={
+          page([
+            symbolBlock({
+              children: [slotChild('A'), slotChild('B', 'builder-child-2', 'counter-2')],
+            }),
+          ]) as any
+        }
+      />
+    );
+    expect(testApi.getByTestId('counter-2')).toHaveTextContent('B');
+
+    testApi.rerender(
+      <BuilderPage model="page" content={page([symbolBlock({ children: [] })]) as any} />
+    );
+    expect(testApi.queryByTestId('counter')).toBeNull();
+    expect(testApi.queryByTestId('counter-2')).toBeNull();
+  });
+
+  it('still remounts when a non-slot symbol input changes', () => {
+    const testApi = render(
+      <BuilderPage model="page" content={page([symbolBlock({ heading: 'one' })]) as any} />
+    );
+    const nodeBefore = testApi.getByTestId('counter');
+    expect(mountCount).toBe(1);
+
+    testApi.rerender(
+      <BuilderPage model="page" content={page([symbolBlock({ heading: 'two' })]) as any} />
+    );
+
+    expect(testApi.getByTestId('counter')).not.toBe(nodeBefore);
+    expect(mountCount).toBe(2);
+  });
+
+  it('renders two instances of the same symbol with different slot content', () => {
+    const testApi = render(
+      <BuilderPage
+        model="page"
+        content={
+          page([
+            symbolBlock({ id: 'builder-symbol-1', children: [slotChild('first', 'c1', 'one')] }),
+            symbolBlock({ id: 'builder-symbol-2', children: [slotChild('second', 'c2', 'two')] }),
+          ]) as any
+        }
+      />
+    );
+
+    expect(testApi.getByTestId('one')).toHaveTextContent('first');
+    expect(testApi.getByTestId('two')).toHaveTextContent('second');
+  });
+});
+
+describe('symbol + slot rendering (production)', () => {
+  beforeEach(() => {
+    mountCount = 0;
+  });
+
+  it('renders slot content and reacts to data changes', () => {
+    const testApi = render(
+      <BuilderPage model="page" content={page([symbolBlock({ heading: 'one' })]) as any} />
+    );
+    expect(testApi.getByTestId('counter')).toHaveTextContent('A');
+
+    testApi.rerender(
+      <BuilderPage model="page" content={page([symbolBlock({ heading: 'two' })]) as any} />
+    );
+    expect(testApi.getByTes
```

---

### Incident Patch 15: `5604e14e` (2026-09-07)
**Commit Message**: fix[abTests][gen1]: ENG-13175 A/B Variation Hydration Mismatch on First Server Render (#4844)

## Description

When you preview a non-default A/B variation, the page briefly shows the
default variation before switching to the one you asked for. This causes
a layout shift and a React hydration error. Reloading fixes it, so it
only happens on the first visit.

**Root Cause:**
The editor's preview link carries the chosen variation in the URL as
`builder.tests.<contentId>=<variationId>`, but nothing reads it early
enough:

- The server doesn't look at it, so the HTML ships all variations.
- The inlined variants script only checks the cookie. On a first visit
there is no cookie, so it picks a variation at random, usually the
default.
- The SDK then writes the URL's variation into the cookie, and React
hydrates with that value. It no longer matches the DOM, so React
re-renders and you see the switch.

**Fix:**
Both places that choose a variation now check the URL parameter first,
then fall back to the cookie, then to the random assignment as before:

- the inlined SSR script, so the correct variation is on screen at first
paint
- `VariantsProvider`'s browser branch, so hydration agrees w

**File**: `.changeset/tricky-pugs-invite.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@builder.io/react': patch
+---
+
+Fix: A/B test variation previews no longer flash the default variation before switching. The `builder.tests.<contentId>` URL parameter is now applied when the SSR variants script selects a variation, so the first paint matches what React renders during hydration.
```

**File**: `packages/react/src/components/variants-provider.component.tsx` (modified, +51/-2)
```diff
@@ -18,6 +18,28 @@ function getData(content: BuilderContentVariation) {
   return newData;
 }
 
+// Mirrors the precedence used by the inlined variants script below, so that the DOM
+// the script produces before hydration matches what React renders while hydrating.
+function getVariantIdFromUrl(contentId: string) {
+  const search = (Builder.isBrowser && location.search) || '';
+  if (search.indexOf('builder') === -1) {
+    return null;
+  }
+  const names = ['builder.tests.' + contentId, 'builder_tests_' + contentId];
+  const entries = (search.charAt(0) === '?' ? search.substring(1) : search).split('&');
+  for (const entry of entries) {
+    const parts = entry.split('=');
+    if (names.indexOf(parts[0]) > -1) {
+      try {
+        return decodeURIComponent(parts[1] || '');
+      } catch (err) {
+        return parts[1] || null;
+      }
+    }
+  }
+  return null;
+}
+
 const variantsScript = (variantsString: string, contentId: string) =>
   `
 (function() {
@@ -58,11 +80,34 @@ const variantsScript = (variantsString: string, contentId: string) =>
     }
     return null;
   }
+  function getVariantFromUrl() {
+    var search = location.search || '';
+    if (search.indexOf('builder') === -1) {
+      return null;
+    }
+    var names = ['builder.tests.${contentId}', 'builder_tests_${contentId}'];
+    var entries = (search.charAt(0) === '?' ? search.substring(1) : search).split('&');
+    for (var i = 0; i < entries.length; i++) {
+      var parts = entries[i].split('=');
+      if (names.indexOf(parts[0]) > -1) {
+        try {
+          return decodeURIComponent(parts[1] || '');
+        } catch (err) {
+          return parts[1] || null;
+        }
+      }
+    }
+    return null;
+  }
   var cookieName = 'builder.tests.${contentId}';
   var variantInCookie = getCookie(cookieName);
   var availableIDs = variants.map(function(vr) { return vr.id }).concat('${contentId}');
   var variantId;
-  if (availableIDs.indexOf(variantInCookie) > -1) {
+  var variantInUrl = getVariantFromUrl();
+  if (availableIDs.indexOf(variantInUrl) > -1) {
+    variantId = variantInUrl;
+    setCookie(cookieName, variantId);
+  } else if (availableIDs.indexOf(variantInCookie) > -1) {
     variantId = variantInCookie;
   }
   if (!variantId) {
@@ -141,7 +186,11 @@ export const VariantsProvider = ({ initialContent, children, nonce }: VariantsPr
 
   const cookieName = `builder.tests.${initialContent.id}`;
 
-  let variantId = builder.getCookie(cookieName);
+  const variantIdFromUrl = getVariantIdFromUrl(initialContent.id!);
+
+  let variantId = allVariants.some(item => item.id === variantIdFromUrl)
+    ? variantIdFromUrl
+    : builder.getCookie(cookieName);
 
   if (!variantId && Builder.isBrowser) {
     let n = 0;
```

**File**: `packages/react/test/variants-ab-hydration.test.tsx` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+/**
+ * @jest-environment jsdom
+ * @jest-environment-options {"url": "https://example.com/?builder.tests.contentid1=variationa1"}
+ */
+jest.mock(
+  'src/functions/extract-localized-values',
+  () => ({ containsLocalizedValues: () => false, extractLocalizedValues: () => ({}) }),
+  { virtual: true }
+);
+
+import React from 'react';
+import { TextEncoder, TextDecoder } from 'util';
+
+Object.assign(global, { TextEncoder, TextDecoder });
+
+import { BuilderComponent } from '../src/components/builder-component.component';
+import { builder } from '@builder.io/sdk';
+
+builder.init('abc123');
+
+const CONTENT_ID = 'contentid1';
+const VARIATION_ID = 'variationa1';
+
+const textBlock = (text: string) => ({
+  '@type': '@builder.io/sdk:Element' as const,
+  id: 'blk-' + text,
+  component: { name: 'Text', options: { text } },
+});
+
+const content: any = {
+  id: CONTENT_ID,
+  name: 'test',
+  data: { blocks: [textBlock('CONTROL')] },
+  variations: {
+    [VARIATION_ID]: {
+      id: VARIATION_ID,
+      name: 'Variation A',
+      // Below the mocked Math.random (0.1234), so the random path never picks it.
+      testRatio: 0.05,
+      data: { blocks: [textBlock('VARIATION_A')] },
+    },
+  },
+};
+
+test('browser render honours the builder.tests url param when the cookie is unavailable', () => {
+  document.cookie = 'builder.tests.' + CONTENT_ID + '=; Max-Age=0; path=/';
+  expect(document.cookie).not.toContain(VARIATION_ID);
+
+  const { renderToString } = require('react-dom/server');
+  const html = renderToString(<BuilderComponent model="page" content={content} />);
+
+  // Must match what the inlined script put in the DOM before hydration.
+  expect(html).toContain('blk-VARIATION_A');
+  expect(html).not.toContain('blk-CONTROL');
+});
```

**File**: `packages/react/test/variants-ab-ssr.test.tsx` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+jest.mock(
+  'src/functions/extract-localized-values',
+  () => ({ containsLocalizedValues: () => false, extractLocalizedValues: () => ({}) }),
+  { virtual: true }
+);
+
+import React from 'react';
+import { renderToString } from 'react-dom/server';
+import { JSDOM } from 'jsdom';
+import { CookieJar } from 'tough-cookie';
+import { BuilderComponent } from '../src/components/builder-component.component';
+import { builder } from '@builder.io/sdk';
+
+builder.init('abc123');
+
+const CONTENT_ID = 'contentid1';
+const VARIATION_ID = 'variationa1';
+
+const textBlock = (text: string) => ({
+  '@type': '@builder.io/sdk:Element' as const,
+  id: 'blk-' + text,
+  component: { name: 'Text', options: { text } },
+});
+
+const getContent = () => ({
+  id: CONTENT_ID,
+  name: 'test',
+  data: { blocks: [textBlock('CONTROL')] },
+  variations: {
+    [VARIATION_ID]: {
+      id: VARIATION_ID,
+      name: 'Variation A',
+      // Lower than the mocked Math.random (0.1234), so the random path never
+      // picks this variation. Anything that selects it did so deliberately.
+      testRatio: 0.05,
+      data: { blocks: [textBlock('VARIATION_A')] },
+    },
+  },
+});
+
+const ssrHtml = () =>
+  renderToString(<BuilderComponent model="page" content={getContent() as any} />);
+
+/** Parses the SSR output in jsdom, which runs the inlined variants script as a browser would. */
+const runInBrowser = (html: string, { url, cookie }: { url: string; cookie?: string }) => {
+  const cookieJar = new CookieJar();
+  if (cookie) {
+    cookieJar.setCookieSync(cookie + '; Path=/', url);
+  }
+  const dom = new JSDOM('<html><body>' + html + '</body></html>', {
+    url,
+    cookieJar,
+    runScripts: 'dangerously',
+    // the inlined script runs inside this window, so it needs its own stub. 0.9999 is
+    // above every testRatio below, so the random path always lands on the control.
+    beforeParse(window) {
+      window.Math.random = () => 0.9999;
+    },
+  });
+  return dom.window.document.body.innerHTML;
+};
+
+const CONTROL_BLOCK = 'blk-CONTROL';
+const VARIATION_BLOCK = 'blk-VARIATION_A';
+
+describe('SSR a/b test variant selection', () => {
+  test('inlined variants script is syntactically valid', () => {
+    const script = ssrHtml().match(/<script id="variants-script-[^"]+">([\s\S]*?)<\/script>/);
+    expect(script).toBeTruthy();
+    expect(() => new Function(script![1])).not.toThrow();
+  });
+
+  test('builder.tests url param wins over the random assignment', () => {
+    const text = runInBrowser(ssrHtml(), {
+      url: `https://example.com/?builder.tests.${CONTENT_ID}=${VARIATION_ID}`,
+    });
+    expect(text).toContain(VARIATION_BLOCK);
+    expect(text).not.toContain(CONTROL_BLOCK);
+  });
+
+  test('url param is ignored when it is not a known variation', () => {
+    const text = runInBrowser(ssrHtml(), {
+      url: `https://example.com/?builder.tests.${CONTENT_ID}=not-a-variation`,
+    });
+    expect(text).toContain(CONTROL_BLOCK);
+    expect(text).not.toContain(VARIATION_BLOCK);
+  });
+
+  test('falls back to the cookie when no url param is present', () => {
+    const text = runInBrowser(ssrHtml(), {
+      url: 'https://example.com/',
+      cookie: `builder.tests.${CONTENT_ID}=${VARIATION_ID}`,
+    });
+    expect(text).toContain(VARIATION_BLOCK);
+    expect(text).not.toContain(CONTROL_BLOCK);
+  });
+
+  test('falls back to the random assignment with no url param and no cookie', () => {
+    const text = runInBrowser(ssrHtml(), { url: 'https://example.com/' });
+    expect(text).toContain(CONTROL_BLOCK);
+    expect(text).not.toContain(VARIATION_BLOCK);
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #4890** (2026-10-06): fix(sdks): jsCode context functions, jsCode state reactivity, and bound id in gen2 (@mrkoreye)
- **PR #4889** (2026-10-05): 📦 Publish SDKs (@builder-io-integration[bot])
- **PR #4886** (2026-10-01): ci(sdks): sign release commits by creating them through the GitHub API (@mrkoreye)
- **PR #4885** (2026-10-01): 📦 Publish SDKs (@builder-io-integration[bot])
- **PR #4884** (2026-10-05): fix[sdks][personalization]: ENG-13927 dedupe personalization and A/B helper scripts across Content components (@floating-dynamo)
- **PR #4883** (closed): [do not merge] isolated-vm CI diagnostics (@mrkoreye)
- **PR #4882** (2026-09-30): 📦 Publish SDKs (@builder-io-integration[bot])
- **PR #4880** (2026-09-30): fix(sdks): review fixes for gen2 perf pass (#4874) (@mrkoreye)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
