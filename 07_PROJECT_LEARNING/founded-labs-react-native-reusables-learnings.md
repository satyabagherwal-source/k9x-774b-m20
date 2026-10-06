# Forensic Learning Record (Deep Inspection): founded-labs/react-native-reusables

> **Canonical Artifact**: `07_PROJECT_LEARNING/founded-labs-react-native-reusables-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/founded-labs/react-native-reusables](https://github.com/founded-labs/react-native-reusables))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:08:31.333Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `founded-labs/react-native-reusables`
- **Description**: Bringing shadcn/ui to React Native. Beautifully crafted components with Nativewind/Uniwind, open source, and almost as easy to use.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8676 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/cli/src/utils/retry-with.ts`
```
import { Effect } from "effect"

const retryWith = <A, R, E, B>(
  fn: (input: A) => Effect.Effect<R, E, B>,
  inputs: readonly [A, ...Array<A>]
): Effect.Effect<R, E, B> =>
  inputs.slice(1).reduce((acc, input) => acc.pipe(Effect.orElse(() => fn(input))), fn(inputs[0]))

export { retryWith }

```

### Core Architecture Module: `apps/cli/src/utils/run-command.ts`
```
import { Effect } from "effect"
import { execa } from "execa"

const runCommand = (file: string, args: Array<string>, options: Parameters<typeof execa>[1]) =>
  Effect.tryPromise({
    try: () => execa(file, args, options),
    catch: (error) => new Error(`Failed to run command: ${file} ${args.join(" ")}`, { cause: String(error) })
  })

export { runCommand }

```

### Core Architecture Module: `apps/showcase/hooks/use-geist-font.tsx`
```
import { useFonts } from '@expo-google-fonts/geist/useFonts';
import { Geist_100Thin } from '@expo-google-fonts/geist/100Thin';
import { Geist_200ExtraLight } from '@expo-google-fonts/geist/200ExtraLight';
import { Geist_300Light } from '@expo-google-fonts/geist/300Light';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { Geist_800ExtraBold } from '@expo-google-fonts/geist/800ExtraBold';
import { Geist_900Black } from '@expo-google-fonts/geist/900Black';

function useGeistFont() {
  return useFonts({
    Geist_100Thin,
    Geist_200ExtraLight,
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    Geist_900Black,
  });
}

export { useGeistFont };

```

### Core Architecture Module: `apps/showcase/hooks/use-web-color-scheme-sync.ts`
```
import { colorScheme } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';

/**
 * Web only. Keeps NativeWind's color scheme (and everything derived from it, like the
 * navigation theme) in sync with the page, so the showcase can be embedded in an iframe:
 * 1. `?theme=dark|light` query param (what a host page can pass to an iframe)
 * 2. the `dark` class on <html> (toggled by a host that shares the document)
 * 3. otherwise the OS `prefers-color-scheme`, kept in sync when it changes
 */
function useWebColorSchemeSync() {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const html = document.documentElement;
    const theme = new URLSearchParams(window.location.search).get('theme');
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const hasThemeParam = theme === 'dark' || theme === 'light';

    if (hasThemeParam) {
      colorScheme.set(theme);
    } else if (!html.classList.contains('dark') && media?.matches) {
      colorScheme.set('dark');
    }

    const observer = new MutationObserver(() => {
      const next = html.classList.contains('dark') ? 'dark' : 'light';
      // NativeWind rewrites the class attribute when set, which fires this observer again.
      // Only update on a real change to avoid an infinite loop.
      if (colorScheme.get() !== next) {
        colorScheme.set(next);
      }
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });

    function onMediaChange(event: MediaQueryListEvent) {
      if (hasThemeParam) return;
      colorScheme.set(event.matches ? 'dark' : 'light');
    }
    media?.addEventListener('change', onMediaChange);

    return () => {
      observer.disconnect();
      media?.removeEventListener('change', onMediaChange);
    };
  }, []);
}

export { useWebColorSchemeSync };

```

### Core Architecture Module: `apps/showcase/lib/utils.ts`
```
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `packages/registry/src/nativewind/lib/utils.ts`
```
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `packages/registry/src/uniwind/lib/utils.ts`
```
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `apps/cli/eslint.config.mjs`
```
import { fixupPluginRules } from "@eslint/compat"
import { FlatCompat } from "@eslint/eslintrc"
import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"
import codegen from "eslint-plugin-codegen"
import _import from "eslint-plugin-import"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import sortDestructureKeys from "eslint-plugin-sort-destructure-keys"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  {
    ignores: ["**/dist", "**/build", "**/docs", "**/*.md"]
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@effect/recommended"
  ),
  {
    plugins: {
      import: fixupPluginRules(_import),
      "sort-destructure-keys": sortDestructureKeys,
      "simple-import-sort": simpleImportSort,
      codegen
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: "module"
    },

    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"]
      },

      "import/resolver": {
        typescript: {
          alwaysTryTypes: true
        }
      }
    },

    rules: {
      "codegen/codegen": "error",
      "no-fallthrough": "off",
      "no-irregular-whitespace": "off",
      "object-shorthand": "error",
      "prefer-destructuring": "off",
      "sort-imports": "off",

      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='push'] > SpreadElement.arguments",
          message: "Do not use spread arguments in Array.push"
        }
      ],

      "no-unused-vars": "off",
      "prefer-rest-params": "off",
      "prefer-spread": "off",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-unresolved": "off",
      "import/order": "off",
      "simple-import-sort/imports": "off",
      "sort-destructure-keys/sort-destructure-keys": "error",
      "deprecation/deprecation": "off",

      "@typescript-eslint/array-type": [
        "warn",
        {
          default: "generic",
          readonly: "generic"
        }
      ],

      "@typescript-eslint/member-delimiter-style": 0,
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/consistent-type-imports": "warn",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],

      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/camelcase": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/no-array-constructor": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-namespace": "off",
      "@effect/dprint": "off"
    }
  }
]

```

### Core Architecture Module: `apps/cli/scripts/copy-package-json.ts`
```
import { FileSystem, Path } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* Effect.log("[Build] Copying package.json ...")
  const json: any = yield* fs.readFileString("package.json").pipe(Effect.map(JSON.parse))
  const pkg = {
    name: json.name,
    version: json.version,
    type: json.type,
    description: json.description,
    main: "bin.cjs",
    bin: "bin.cjs",
    engines: json.engines,
    dependencies: json.dependencies,
    peerDependencies: json.peerDependencies,
    repository: json.repository,
    author: json.author,
    license: json.license,
    bugs: json.bugs,
    homepage: json.homepage,
    tags: json.tags,
    keywords: json.keywords
  }
  yield* fs.writeFileString(path.join("dist", "package.json"), JSON.stringify(pkg, null, 2))
  yield* Effect.log("[Build] Build completed.")
}).pipe(Effect.provide(NodeContext.layer))

Effect.runPromise(program).catch(console.error)

```

### Core Architecture Module: `apps/cli/src/bin.ts`
```
#!/usr/bin/env node

import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as Cli from "./cli.js"

Effect.suspend(Cli.run).pipe(
  Effect.provide(NodeContext.layer),
  Effect.catchAll((error) => {
    if (error instanceof Error) {
      Effect.logDebug(error)
      return Effect.logError(error.message)
    }
    return Effect.logError(error)
  }),
  NodeRuntime.runMain({ disableErrorReporting: true })
)

```

### Core Architecture Module: `apps/cli/src/cli.ts`
```
import { all, cwd, overwrite, path, stylingLibrary, summary, template, yes } from "@cli/contexts/cli-options.js"
import * as Add from "@cli/services/commands/add.js"
import * as Doctor from "@cli/services/commands/doctor.js"
import * as Init from "@cli/services/commands/init.js"
import { Args, Command, Prompt } from "@effect/cli"
import { Effect, pipe } from "effect"

const addArgs = Args.all({
  components: Args.text({ name: "components" }).pipe(Args.repeated)
})

const AddCommand = Command.make("add", { args: addArgs, cwd, yes, overwrite, all, path, stylingLibrary })
  .pipe(Command.withDescription("Add React Native components to your project"))
  .pipe(Command.withHandler(Add.make))

const DoctorCommand = Command.make("doctor", { cwd, summary, yes })
  .pipe(Command.withDescription("Check your project setup and diagnose issues"))
  .pipe(Command.withHandler(Doctor.make))

const InitCommand = Command.make("init", { cwd, template })
  .pipe(Command.withDescription("Initialize a new React Native project with reusables"))
  .pipe(Command.withHandler(Init.make))

const Cli = Command.make("react-native-reusables/cli", { cwd })
  .pipe(Command.withDescription("React Native Reusables CLI - A powerful toolkit for React Native development"))
  .pipe(
    Command.withHandler((options) =>
      Effect.gen(function* () {
        yield* Effect.log("React Native Reusables CLI - A powerful toolkit for React Native development")
        const choice = yield* Prompt.select({
          message: "What would you like to do?",
          choices: [
            { title: "Add a component", value: "add" },
            { title: "Inspect project configuration", value: "doctor" },
            { title: "Initialize a new project", value: "init" }
          ]
        })

        if (choice === "add") {
          yield* Add.make({
            cwd: options.cwd,
            yes: true,
            overwrite: false,
            all: false,
            path: "",
            stylingLibrary: undefined,
            args: { components: [] }
          })
        } else if (choice === "doctor") {
          yield* Doctor.make({ cwd: options.cwd, summary: false, yes: false })
        } else if (choice === "init") {
          yield* Init.make({ cwd: options.cwd, template: "" })
        }
      })
    )
  )
  .pipe(Command.withSubcommands([AddCommand, DoctorCommand, InitCommand]))

export const run = () =>
  pipe(
    process.argv,
    Command.run(Cli, {
      name: "@react-native-reusables/cli",
      version: "1.0.0"
    })
  )

```

### Core Architecture Module: `apps/cli/src/contexts/cli-options.ts`
```
import { Options } from "@effect/cli"
import { Context, Option } from "effect"

type StylingLibrary = "nativewind" | "uniwind"

class CliOptions extends Context.Tag("CommandOptions")<
  CliOptions,
  Readonly<{
    cwd: string
    yes: boolean
    stylingLibrary: StylingLibrary | undefined
  }>
>() { }

const cwd = Options.directory("cwd", { exists: "yes" }).pipe(Options.withDefault("."), Options.withAlias("c"))
const yes = Options.boolean("yes", { aliases: ["y"] })
const summary = Options.boolean("summary").pipe(Options.withAlias("s"))
const overwrite = Options.boolean("overwrite", { aliases: ["o"] })
const all = Options.boolean("all", { aliases: ["a"] })
const path = Options.text("path").pipe(Options.withDefault(""), Options.withAlias("p"))
const stylingLibrary = Options.choice("styling-library", ["nativewind", "uniwind"] as const).pipe(
  Options.optional,
  Options.map(Option.getOrUndefined),
  Options.withDescription("Override the detected styling library for this command"),
)
const template = Options.text("template").pipe(Options.withAlias("t"), Options.withDefault(""))

export { CliOptions, cwd, summary, yes, overwrite, all, path, stylingLibrary, template }
export type { StylingLibrary }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #542** (2026-06-11): **Deleted**
  *Symptoms*: Deleted

- **Issue #535** (2026-04-27): **[ BUG ] Dropdown is showing behind react native modal**
  *Symptoms*: I use Dropdown in Modal. When i open Dropdown, It shows behind Modal.  

- **Issue #526** (2026-03-30): **[ BUG ] Progress has ReanimatedError**
  *Symptoms*: 1. npx @react-native-reusables/cli@latest init 2. cd my-app 3. npx @react-native-reusables/cli@latest add progress 4. add Progress to index 5. yarn run    <img width="426" height="708" alt="Image" src="https://github.com/user-attachments/assets/ca8410c0-8c0f-4135-9378-8d65a1f746c6" />  ```  ERROR  [ReanimatedError: [Reanimated] Perhaps you are trying to pass an animated style to a non-animated component. Try creating an animated component using `createAnimatedComponent` function or use `Animated.*` components.] ```
  **Post-Mortem & Fix Analysis**:
  > Hey @gavinliu , should be fixed with latest changes. Please update your rn-primitives to v1.4.0.

- **Issue #518** (2026-05-02): **Opening a dialog from a dropdown or context menu is broken on the web**
  *Symptoms*: **Describe the bug** Having multiple components using portals open at the same time does not seem to work correctly on the web. For example, triggering an AlertDialog or Dialog from a Dropdown will cause the page to lock up as soon as the Dialog is closed. (Having a select open within a dialog also causes strange behavior, but I did not investigate that scenario as much yet).  **Reproduction** ``` <DropdownMenu>     <DropdownMenuContent>         <DropdownMenuItem onPress={() => setOpen(true)}>             <Text>Open</Text>         </DropdownMenuItem>     </DropdownMenuContent> </DropdownMenu> ``` ``` <AlertDialog open={open}>       <AlertDialogContent>           <AlertDialogHeader>               <AlertDialogTitle>Title</AlertDialogTitle>           </AlertDialogHeader>           <AlertDialogFooter className='flex flex-row justify-between'>               <AlertDialogCancel>                   <Text>Cancel</Text>               </AlertDialogCancel>           </AlertDialogFooter>       </AlertDialogContent>   </AlertDialog> ```  **Expected behavior** In this situation, clicking on the dropdown item should open the Dialog. Clicking cancel should close the dialog and allow the user to use the app like usual, including re-opening the dropdown of course.  **Actual behavior** On the web, once the dialog is closed the page locks up. A temporary workaround is to wait to open the dialog until the dropdown menu is closed (for example, using the dropdown trigger ref and calling `.close()`). 
  **Post-Mortem & Fix Analysis**:
  > https://github.com/radix-ui/themes/issues/696  I did a bit more digging, it seems like the underlying cause might be radix-ui itself.

- **Issue #516** (2026-03-14): **[ BUG ] Unused props in dropdown-menu, menubar, context-menu, select**
  *Symptoms*: <!--  ⚠️ **Important**: Issues must include a valid reproduction link. Reports without one will be automatically closed.  You can quickly create a minimal reproduction using:  ```bash npx @react-native-reusables/cli@latest init -t minimal ```  -->  **Reproduction link**: `<link>`  **Describe the bug**  Some components have unused props. It looks like `className` should be passed into `cn()` as the last override in most of the cases.  This is just my lint output, but it shows which components have unused props.  ```shell   × eslint(no-unused-vars): Parameter 'className' is declared but never used. Unused parameters should start with a '_'.     ╭─[packages/rn-reusables/src/components/dropdown-menu.tsx:38:3]  37 │ function DropdownMenuSubTrigger({  38 │   className,     ·   ────┬────     ·       ╰── 'className' is declared here  39 │   inset,     ╰────   help: Consider removing this parameter.    × eslint(no-unused-vars): Parameter 'className' is declared but never used. Unused parameters should start with a '_'.      ╭─[packages/rn-reusables/src/components/menubar.tsx:108:3]  107 │ function MenubarSubTrigger({  108 │   className,      ·   ────┬────      ·       ╰── 'className' is declared here  109 │   inset,      ╰────   help: Consider removing this parameter.    × eslint(no-unused-vars): Parameter 'overlayClassName' is declared but never used. Unused parameters should start with a '_'.      ╭─[packages/rn-reusables/src/components/menubar.tsx:173:3]  172 │   className,  173 │ 

- **Issue #511** (2026-01-20): **[ BUG ] Google Play Store URL broken on showcase**
  *Symptoms*: **Reproduction link**: https://reactnativereusables.com/showcase/links/home-screen  **Describe the bug** The Google Play Store URL on the showcase page is broken/non-functional. The showcase app no longer seems to be on Google Play Store  **Steps to reproduce the behavior:** 1. Navigate to 'https://reactnativereusables.com/showcase/links/home-screen' 2. Locate the Google Play Store link/button 3. Click on the Google Play Store link 4. See error (link says We're sorry, the requested URL was not found on this server.) 'https://play.google.com/store/apps/details?id=com.reactnativereusables.android'  **Expected behavior** The Google Play Store link should direct users to the correct app listing on the Google Play Store.  **Screenshots** <img width="1800" height="867" alt="Image" src="https://github.com/user-attachments/assets/36cb4b83-3d72-418a-8a66-3060bdc35b93" />  <img width="1800" height="912" alt="Image" src="https://github.com/user-attachments/assets/ab131243-0090-48a8-ae1e-b49f6773d90a" />  **Platform (please complete the following information):** - Type: Browser - OS: N/A (web-based issue) - Browser: [e.g. chrome, safari]  **CLI output (paste the full command output)** N/A - This is a website/documentation issue, not a CLI issue.  **Additional context** This issue appears to be specific to the showcase page and affects the Google Play Store link functionality. The link may be incorrectly formatted, pointing to a wrong URL, or missing entirely.
  **Post-Mortem & Fix Analysis**:
  > @salman-ar-sar Thanks for flagging this! There was an issue with my Google Play Console account (a D-U-N-S issue). I submitted the information they requested so it should be back up within a couple of days.
  > Back online

- **Issue #509** (2026-01-17): **[ BUG ] cli add command fails due to missing shadcn@latest when using Yarn/npx**
  *Symptoms*: ## Issue / Repro  Attempting to add a component using the React Native Reusables CLI fails because the CLI tries to invoke a shadcn@latest command that is not available in the project.  This reproduces in: - an existing React Native project - a brand-new project created by following the official installation guide exactly   - https://reactnativereusables.com/docs/installation  **Note** Other commands from CLI like `npx @react-native-reusables/cli@latest doctor` run as expected    ## Reproduction:  `npx @react-native-reusables/cli@latest add button`    ## CLI output ```bash ⋊> ~/d/w/t/my-app npx @react-native-reusables/cli@latest add button                               16:01:19 ℹ Styling Library: Nativewind yarn run v1.22.22 warning ../../../../package.json: No license field error Command "shadcn@latest" not found. info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command. [16:04:47.625] ERROR (#16): Failed to run command: yarn shadcn@latest add https://reactnativereusables.com/r/nativewind/button.json ```
  **Post-Mortem & Fix Analysis**:
  > looks like when I'm running this command manually  `npx shadcn@latest add https://reactnativereusables.com/r/nativewind/button.json`  it's working as expected.   however, this is not documented or being advised anywhere via the docs that i can find
  > Fixed in [latest release](https://github.com/founded-labs/react-native-reusables/releases/tag/cli%400.6.3) 🚀

- **Issue #507** (2026-01-17): **[ BUG ] `npx @react-native-reusables/cli@latest init -t minimal-uniwind` output says "Styling Library: Nativewind"**
  *Symptoms*: **Issue/Repro** 1. Run `npx @react-native-reusables/cli@latest init -t minimal-uniwind` 2. The CLI output will say `ℹ Styling Library: Nativewind` 3. If you continue, it does appear that it uses Uniwind, so it is probably just a small copy bug with the CLI  **Expected behavior** It should say `ℹ Styling Library: Uniwind`  **Platform:** This is reproing for me on macOS 15.7.2  **CLI output** ``` % npx @react-native-reusables/cli@latest init --log-level all -t minimal-uniwind ℹ Styling Library: Nativewind [16:39:51.063] DEBUG (#16): Init options: {   "cwd": ".",   "template": "minimal-uniwind" } [16:39:51.064] DEBUG (#16): Does package.json exist: no ? What is the name of your project? (e.g. my-app) › my-app ``` 
  **Post-Mortem & Fix Analysis**:
  > Do the full manual installation of uniwind with setup and then proceed further. Follow the docs: https://docs.uniwind.dev/ . Don't use the minimal-uniwind template.
  > This is an console log error. It does not install Nativewind. Will fix shortly.
  > Fixed in [latest release](https://github.com/founded-labs/react-native-reusables/releases/tag/cli%400.6.3) 🚀

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

### Incident Patch 1: `f7917aa8` (2026-06-19)
**Commit Message**: chore(deps): downgrade lucide-react-native to version 0.577.0 and update documentation to recommend development builds for Clerk integration

**File**: `apps/docs/components/auth-block-tabs.tsx` (modified, +8/-0)
```diff
@@ -4,10 +4,13 @@ import {
   AuthIntegrationSelect,
   useAuthIntegration,
 } from '@docs/components/auth-integration-select';
+import { Callout } from '@docs/components/callout';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@docs/components/ui/tabs';
 import * as React from 'react';
 
 export function AuthBlockTabs({ children }: React.PropsWithChildren) {
+  const [integration] = useAuthIntegration();
+
   return (
     <Tabs defaultValue="cli">
       <div className="flex items-center justify-between">
@@ -21,6 +24,11 @@ export function AuthBlockTabs({ children }: React.PropsWithChildren) {
         </TabsList>
         <AuthIntegrationSelect className="mt-px" />
       </div>
+      {integration === 'clerk' ? (
+        <Callout title="Development build recommended" type="warning">
+          To ensure all Clerk Expo features work correctly, use a development build.
+        </Callout>
+      ) : null}
       {children}
     </Tabs>
   );
```

**File**: `apps/docs/content/docs/blocks/authentication/index.mdx` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ import { ClerkLogo } from "@docs/components/clerk-logo"
 
 Select **Clerk** from the integration menu to get blocks built with Clerk authentication logic.
 
-After adding your first block, follow the [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to complete the setup.
+After adding your first block, follow the [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to complete the setup. To ensure all Clerk Expo features work correctly, use a development build.
 
 <div className="h-1"/>
 
@@ -35,4 +35,4 @@ Start a new project with all Clerk authentication blocks pre-configured using th
 
 <CommandTabs args={["init", "-t", "clerk-auth"]} />
 
-</Callout>
\ No newline at end of file
+</Callout>
```

**File**: `packages/registry/package.json` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
     "expo-linking": "~56.0.14",
     "expo-router": "~56.2.11",
     "expo-crypto": "~56.0.4",
-    "lucide-react-native": "^1.21.0",
+    "lucide-react-native": "^0.577.0",
     "nativewind": "^4.2.2",
     "react-native-reanimated": "~4.3.1",
     "react-native-safe-area-context": "5.7.0",
```

**File**: `pnpm-lock.yaml` (modified, +10/-3)
```diff
@@ -490,8 +490,8 @@ importers:
         specifier: ~56.2.11
         version: 56.2.11(@babel/core@7.29.7)(@expo/log-box@56.0.13)(@expo/metro-runtime@56.0.15)(@testing-library/dom@10.4.1)(@types/react-dom@19.1.11(@types/react@19.2.17))(@types/react@19.2.17)(expo-constants@56.0.18)(expo-font@56.0.7)(expo-linking@56.0.14)(expo@56.0.12)(react-dom@19.2.3(react@19.2.3))(react-native-gesture-handler@2.31.2(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native-reanimated@4.3.1(react-native-worklets@0.8.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native-safe-area-context@5.7.0(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native-screens@4.25.2(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native-web@0.21.2(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-native-worklets@0.8.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3)
       lucide-react-native:
-        specifier: ^1.21.0
-        version: 1.21.0(react-native-svg@15.15.4(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3)
+        specifier: ^0.577.0
+        version: 0.577.0(react-native-svg@15.15.4(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3)
       nativewind:
         specifier: ^4.2.2
         version: 4.2.5(react-native-reanimated@4.3.1(react-native-worklets@0.8.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native-safe-area-context@5.7.0(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native-svg@15.15.4(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3))(react-native@0.85.3(@babel/core@7.29.7)(@react-native/metro-config@0.85.3(@babel/core@7.29.7)(bufferutil@4.1.0)(utf-8-validate@6.0.6))(@types/react@19.2.17)(bufferutil@4.1.0)(react@19.2.3)(utf-8-validate@6.0.6))(react@19.2.3)
@@ -7557,6 +7557,13 @@ pac
```

---

### Incident Patch 2: `b0601d59` (2026-06-03)
**Commit Message**: Fix dialog overlay press on mobile web

**File**: `apps/docs/public/r/nativewind/dialog.json` (modified, +3/-5)
```diff
@@ -5,9 +5,7 @@
   "title": "Dialog",
   "author": "@mrzachnugent",
   "description": "A window overlaid on either the primary window or another dialog window, rendering the content underneath inert.",
-  "dependencies": [
-    "@rn-primitives/dialog"
-  ],
+  "dependencies": ["@rn-primitives/dialog"],
   "registryDependencies": [
     "https://reactnativereusables.com/r/nativewind/text.json",
     "https://reactnativereusables.com/r/nativewind/native-only-animated-view.json",
@@ -16,8 +14,8 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/dialog.tsx",
-      "content": "import { Icon } from '@/registry/nativewind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/nativewind/components/ui/native-only-animated-view';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport * as DialogPrimitive from '@rn-primitives/dialog';\nimport { X } from 'lucide-react-native';\nimport * as React from 'react';\nimport { Platform, Text, View, type ViewProps } from 'react-native';\nimport { FadeIn, FadeOut } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst Dialog = DialogPrimitive.Root;\n\nconst DialogTrigger = DialogPrimitive.Trigger;\n\nconst DialogPortal = DialogPrimitive.Portal;\n\nconst DialogClose = DialogPrimitive.Close;\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction DialogOverlay({\n  className,\n  children,\n  ...props\n}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {\n    children?: React.ReactNode;\n  }) {\n  return (\n    <FullWindowOverlay>\n      <DialogPrimitive.Overlay\n        className={cn(\n          'absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black/50 p-2',\n          Platform.select({\n            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',\n          }),\n          className\n        )}\n        {...props}\n        asChild={Platform.OS !== 'web'}>\n        <NativeOnlyAnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>\n          <NativeOnlyAnimatedView entering={FadeIn.delay(50)} exiting={FadeOut.duration(150)}>\n            <>{children}</>\n          </NativeOnlyAnimatedView>\n        </NativeOnlyAnimatedView>\n      </DialogPrimitive.Overlay>\n    </FullWindowOverlay>\n  );\n}\nfunction DialogContent({\n  className,\n  portalHost,\n  children,\n  ...props\n}: React.ComponentProps<typeof DialogPrimitive.Content> & {\n    portalHost?: string;\n  }) {\n  return (\n    <DialogPortal hostName={portalHost}>\n      <DialogOverlay>\n        <DialogPrimitive.Content\n          className={cn(\n            'bg-background border-border z-50 mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-4 rounded-lg border p-6 shadow-lg shadow-black/5 sm:max-w-lg',\n            Platform.select({\n              web: 'animate-in fade-in-0 zoom-in-95 duration-200',\n            }),\n            className\n          )}\n          {...props}>\n          <>{children}</>\n          <DialogPrimitive.Close\n            className={cn(\n              'absolute right-4 top-4 rounded opacity-70 active:opacity-100',\n              Platform.select({\n                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',\n              })\n            )}\n            hitSlop={12}>\n            <Icon\n              as={X}\n              className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}\n            />\n            <Text className=\"sr-only\">Close</Text>\n          </DialogPrimitive.Close>\n        </DialogPrimitive.Content>\n      </DialogOverlay>\n    </DialogPortal>\n  );\n}\n\nfunction DialogHeader({ className, ...props }: ViewProps) {\n  return (\n    <View className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />\n  );\n}\n\nfunction DialogFooter({ className, ...props }: ViewProps) {\n  return (\n    <View\n      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}\n      {...props}\n    />\n  );\n}\n\nfunction DialogTitle({\n  className,\n  ...props\n}: React.ComponentProps<typeof DialogPrimitive.Title>) {\n  return (\n    <DialogPrimitive.Title\n      className={cn('text-foreground text-lg font-semibold leading-none', className)}\n      {...props}\n    />\n  );\n}\n\nfunction DialogDescription({\n  className,\n  ...props\n}: React.ComponentProps<typeof DialogPrimitive.Description>) {\n  return (\n    <DialogPrimitive.Description\n      className={cn('text-muted-foreground text-sm', className)}\n      {...props}\n    />\n  );\n}\n\nexport {\n  Dialog,\n  DialogClose,\n  DialogContent,\n  DialogDescription,\n  DialogFooter,\n  DialogHeader,\n  DialogOverlay,\n  DialogPortal,\n  DialogTitle,\n  DialogTrigger,\n};\n",
+    
```

**File**: `apps/docs/public/r/uniwind/dialog.json` (modified, +3/-5)
```diff
@@ -5,9 +5,7 @@
   "title": "Dialog",
   "author": "@mrzachnugent",
   "description": "A window overlaid on either the primary window or another dialog window, rendering the content underneath inert.",
-  "dependencies": [
-    "@rn-primitives/dialog"
-  ],
+  "dependencies": ["@rn-primitives/dialog"],
   "registryDependencies": [
     "https://reactnativereusables.com/r/uniwind/text.json",
     "https://reactnativereusables.com/r/uniwind/native-only-animated-view.json",
@@ -16,8 +14,8 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/uniwind/components/ui/dialog.tsx",
-      "content": "import { Icon } from '@/registry/uniwind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/uniwind/components/ui/native-only-animated-view';\nimport { cn } from '@/registry/uniwind/lib/utils';\nimport * as DialogPrimitive from '@rn-primitives/dialog';\nimport { X } from 'lucide-react-native';\nimport * as React from 'react';\nimport { Platform, Text, View, type ViewProps } from 'react-native';\nimport { FadeIn, FadeOut } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst Dialog = DialogPrimitive.Root;\n\nconst DialogTrigger = DialogPrimitive.Trigger;\n\nconst DialogPortal = DialogPrimitive.Portal;\n\nconst DialogClose = DialogPrimitive.Close;\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction DialogOverlay({\n  className,\n  children,\n  ...props\n}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {\n    children?: React.ReactNode;\n  }) {\n  return (\n    <FullWindowOverlay>\n      <DialogPrimitive.Overlay\n        className={cn(\n          'absolute bottom-0 left-0 right-0 top-0 z-50 flex items-center justify-center bg-black/50 p-2',\n          Platform.select({\n            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',\n          }),\n          className\n        )}\n        {...props}\n        asChild={Platform.OS !== 'web'}>\n        <NativeOnlyAnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>\n          <NativeOnlyAnimatedView entering={FadeIn.delay(50)} exiting={FadeOut.duration(150)}>\n            <>{children}</>\n          </NativeOnlyAnimatedView>\n        </NativeOnlyAnimatedView>\n      </DialogPrimitive.Overlay>\n    </FullWindowOverlay>\n  );\n}\nfunction DialogContent({\n  className,\n  portalHost,\n  children,\n  ...props\n}: React.ComponentProps<typeof DialogPrimitive.Content> & {\n    portalHost?: string;\n  }) {\n  return (\n    <DialogPortal hostName={portalHost}>\n      <DialogOverlay>\n        <DialogPrimitive.Content\n          className={cn(\n            'bg-background border-border z-50 mx-auto flex w-full flex-col gap-4 rounded-lg border p-6 shadow-lg shadow-black/5 sm:max-w-lg',\n            Platform.select({\n              web: 'animate-in fade-in-0 zoom-in-95 web:max-w-[calc(100%-2rem)] duration-200',\n            }),\n            className\n          )}\n          {...props}>\n          <>{children}</>\n          <DialogPrimitive.Close\n            className={cn(\n              'absolute right-4 top-4 rounded opacity-70 active:opacity-100',\n              Platform.select({\n                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',\n              })\n            )}\n            hitSlop={12}>\n            <Icon\n              as={X}\n              className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}\n            />\n            <Text className=\"sr-only\">Close</Text>\n          </DialogPrimitive.Close>\n        </DialogPrimitive.Content>\n      </DialogOverlay>\n    </DialogPortal>\n  );\n}\n\nfunction DialogHeader({ className, ...props }: ViewProps) {\n  return (\n    <View className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />\n  );\n}\n\nfunction DialogFooter({ className, ...props }: ViewProps) {\n  return (\n    <View\n      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}\n      {...props}\n    />\n  );\n}\n\nfunction DialogTitle({\n  className,\n  ...props\n}: React.ComponentProps<typeof DialogPrimitive.Title>) {\n  return (\n    <DialogPrimitive.Title\n      className={cn('text-foreground text-lg font-semibold leading-none', className)}\n      {...props}\n    />\n  );\n}\n\nfunction DialogDescription({\n  className,\n  ...props\n}: React.ComponentProps<typeof DialogPrimitive.Description>) {\n  return (\n    <DialogPrimitive.Description\n      className={cn('text-muted-foreground text-sm', className)}\n      {...props}\n    />\n  );\n}\n\nexport {\n  Dialog,\n  DialogClose,\n  DialogContent,\n  DialogDescription,\n  DialogFooter,\n  DialogHeader,\n  DialogOverlay,\n  DialogPortal,\n  DialogTitle,\n  DialogTrigger,\n};\n",
+      "conten
```

**File**: `packages/registry/src/nativewind/components/ui/dialog.tsx` (modified, +17/-9)
```diff
@@ -4,7 +4,7 @@ import { cn } from '@/registry/nativewind/lib/utils';
 import * as DialogPrimitive from '@rn-primitives/dialog';
 import { X } from 'lucide-react-native';
 import * as React from 'react';
-import { Platform, Text, View, type ViewProps } from 'react-native';
+import { Platform, Text, View, type GestureResponderEvent, type ViewProps } from 'react-native';
 import { FadeIn, FadeOut } from 'react-native-reanimated';
 import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';
 
@@ -21,10 +21,20 @@ const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fr
 function DialogOverlay({
   className,
   children,
+  onPress,
   ...props
 }: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {
-    children?: React.ReactNode;
-  }) {
+  children?: React.ReactNode;
+}) {
+  const { onOpenChange } = DialogPrimitive.useRootContext();
+
+  function onOverlayPress(event: GestureResponderEvent) {
+    onPress?.(event);
+    if (event.target === event.currentTarget && !event.isDefaultPrevented()) {
+      onOpenChange(false);
+    }
+  }
+
   return (
     <FullWindowOverlay>
       <DialogPrimitive.Overlay
@@ -36,6 +46,7 @@ function DialogOverlay({
           className
         )}
         {...props}
+        onPress={Platform.select({ web: onOverlayPress, native: onPress })}
         asChild={Platform.OS !== 'web'}>
         <NativeOnlyAnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
           <NativeOnlyAnimatedView entering={FadeIn.delay(50)} exiting={FadeOut.duration(150)}>
@@ -52,8 +63,8 @@ function DialogContent({
   children,
   ...props
 }: React.ComponentProps<typeof DialogPrimitive.Content> & {
-    portalHost?: string;
-  }) {
+  portalHost?: string;
+}) {
   return (
     <DialogPortal hostName={portalHost}>
       <DialogOverlay>
@@ -102,10 +113,7 @@ function DialogFooter({ className, ...props }: ViewProps) {
   );
 }
 
-function DialogTitle({
-  className,
-  ...props
-}: React.ComponentProps<typeof DialogPrimitive.Title>) {
+function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
   return (
     <DialogPrimitive.Title
       className={cn('text-foreground text-lg font-semibold leading-none', className)}
```

**File**: `packages/registry/src/uniwind/components/ui/dialog.tsx` (modified, +17/-9)
```diff
@@ -4,7 +4,7 @@ import { cn } from '@/registry/uniwind/lib/utils';
 import * as DialogPrimitive from '@rn-primitives/dialog';
 import { X } from 'lucide-react-native';
 import * as React from 'react';
-import { Platform, Text, View, type ViewProps } from 'react-native';
+import { Platform, Text, View, type GestureResponderEvent, type ViewProps } from 'react-native';
 import { FadeIn, FadeOut } from 'react-native-reanimated';
 import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';
 
@@ -21,10 +21,20 @@ const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fr
 function DialogOverlay({
   className,
   children,
+  onPress,
   ...props
 }: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {
-    children?: React.ReactNode;
-  }) {
+  children?: React.ReactNode;
+}) {
+  const { onOpenChange } = DialogPrimitive.useRootContext();
+
+  function onOverlayPress(event: GestureResponderEvent) {
+    onPress?.(event);
+    if (event.target === event.currentTarget && !event.isDefaultPrevented()) {
+      onOpenChange(false);
+    }
+  }
+
   return (
     <FullWindowOverlay>
       <DialogPrimitive.Overlay
@@ -36,6 +46,7 @@ function DialogOverlay({
           className
         )}
         {...props}
+        onPress={Platform.select({ web: onOverlayPress, native: onPress })}
         asChild={Platform.OS !== 'web'}>
         <NativeOnlyAnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
           <NativeOnlyAnimatedView entering={FadeIn.delay(50)} exiting={FadeOut.duration(150)}>
@@ -52,8 +63,8 @@ function DialogContent({
   children,
   ...props
 }: React.ComponentProps<typeof DialogPrimitive.Content> & {
-    portalHost?: string;
-  }) {
+  portalHost?: string;
+}) {
   return (
     <DialogPortal hostName={portalHost}>
       <DialogOverlay>
@@ -102,10 +113,7 @@ function DialogFooter({ className, ...props }: ViewProps) {
   );
 }
 
-function DialogTitle({
-  className,
-  ...props
-}: React.ComponentProps<typeof DialogPrimitive.Title>) {
+function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
   return (
     <DialogPrimitive.Title
       className={cn('text-foreground text-lg font-semibold leading-none', className)}
```

---

### Incident Patch 3: `3e6332e0` (2026-02-17)
**Commit Message**: fix(cli): detect metro.config.cjs for esm projects

**File**: `apps/cli/src/project-manifest.ts` (modified, +2/-2)
```diff
@@ -56,7 +56,7 @@ const FILE_CHECKS: Array<FileCheck> = [
   },
   {
     name: "Metro Config",
-    fileNames: ["metro.config.js", "metro.config.ts"],
+    fileNames: ["metro.config.js", "metro.config.ts", "metro.config.cjs"],
     docs: "https://www.nativewind.dev/docs/getting-started/installation#4-create-or-modify-your-metroconfigjs",
     includes: [
       {
@@ -74,7 +74,7 @@ const FILE_CHECKS: Array<FileCheck> = [
   },
   {
     name: "Metro Config",
-    fileNames: ["metro.config.js", "metro.config.ts"],
+    fileNames: ["metro.config.js", "metro.config.ts", "metro.config.cjs"],
     docs: "https://www.nativewind.dev/docs/getting-started/installation#4-create-or-modify-your-metroconfigjs",
     includes: [
       {
```

**File**: `apps/cli/src/services/project-config.ts` (modified, +6/-8)
```diff
@@ -68,10 +68,9 @@ class ProjectConfig extends Effect.Service<ProjectConfig>()("ProjectConfig", {
 
     const getUniwindDtsPath = () =>
       Effect.gen(function* () {
-        const metroConfigPaths = ["metro.config.js", "metro.config.ts"].map((p) => path.join(options.cwd, p)) as [
-          string,
-          ...Array<string>
-        ]
+        const metroConfigPaths = ["metro.config.js", "metro.config.ts", "metro.config.cjs"].map((p) =>
+          path.join(options.cwd, p)
+        ) as [string, ...Array<string>]
 
         const metroContent = yield* retryWith((filePath: string) => fs.readFileString(filePath), metroConfigPaths).pipe(
           Effect.catchAll(() => Effect.succeed(null))
@@ -96,10 +95,9 @@ class ProjectConfig extends Effect.Service<ProjectConfig>()("ProjectConfig", {
           return options.stylingLibrary
         }
 
-        const metroConfigPaths = ["metro.config.js", "metro.config.ts"].map((p) => path.join(options.cwd, p)) as [
-          string,
-          ...Array<string>
-        ]
+        const metroConfigPaths = ["metro.config.js", "metro.config.ts", "metro.config.cjs"].map((p) =>
+          path.join(options.cwd, p)
+        ) as [string, ...Array<string>]
 
         const metroContent = yield* retryWith((filePath: string) => fs.readFileString(filePath), metroConfigPaths).pipe(
           Effect.catchAll(() => Effect.succeed(null))
```

---

### Incident Patch 4: `7c287b97` (2026-05-02)
**Commit Message**: chore(registry): build registry json item files

**File**: `apps/docs/public/r/nativewind/alert.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/alert.tsx",
-      "content": "import { Icon } from '@/registry/nativewind/components/ui/icon';\nimport { Text, TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport type { LucideIcon } from 'lucide-react-native';\nimport * as React from 'react';\nimport { View } from 'react-native';\n\nfunction Alert({\n  className,\n  variant,\n  children,\n  icon,\n  iconClassName,\n  ...props\n}: React.ComponentProps<typeof View> & {\n    icon: LucideIcon;\n    variant?: 'default' | 'destructive';\n    iconClassName?: string;\n  }) {\n  return (\n    <TextClassContext.Provider\n      value={cn(\n        'text-sm text-foreground',\n        variant === 'destructive' && 'text-destructive',\n        className\n      )}>\n      <View\n        role=\"alert\"\n        className={cn(\n          'bg-card border-border relative w-full rounded-lg border px-4 pb-2 pt-3.5',\n          className\n        )}\n        {...props}>\n        <View className=\"absolute left-3.5 top-3\">\n          <Icon\n            as={icon}\n            className={cn('size-4', variant === 'destructive' && 'text-destructive', iconClassName)}\n          />\n        </View>\n        {children}\n      </View>\n    </TextClassContext.Provider>\n  );\n}\n\nfunction AlertTitle({\n  className,\n  ...props\n}: React.ComponentProps<typeof Text>) {\n  return (\n    <Text\n      className={cn('mb-1 ml-0.5 min-h-4 pl-6 font-medium leading-none tracking-tight', className)}\n      {...props}\n    />\n  );\n}\n\nfunction AlertDescription({\n  className,\n  ...props\n}: React.ComponentProps<typeof Text>) {\n  const textClass = React.useContext(TextClassContext);\n  return (\n    <Text\n      className={cn(\n        'text-muted-foreground ml-0.5 pb-1.5 pl-6 text-sm leading-relaxed',\n        textClass?.includes('text-destructive') && 'text-destructive/90',\n        className\n      )}\n      {...props}\n    />\n  );\n}\n\nexport { Alert, AlertDescription, AlertTitle };\n",
+      "content": "import { Icon } from '@/registry/nativewind/components/ui/icon';\nimport { Text, TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport type { LucideIcon } from 'lucide-react-native';\nimport * as React from 'react';\nimport { View } from 'react-native';\n\nfunction Alert({\n  className,\n  variant,\n  children,\n  icon,\n  iconClassName,\n  ...props\n}: React.ComponentProps<typeof View> & React.RefAttributes<View> & {\n  icon: LucideIcon;\n  variant?: 'default' | 'destructive';\n  iconClassName?: string;\n}) {\n  return (\n    <TextClassContext.Provider\n      value={cn(\n        'text-sm text-foreground',\n        variant === 'destructive' && 'text-destructive',\n        className\n      )}>\n      <View\n        role=\"alert\"\n        className={cn(\n          'bg-card border-border relative w-full rounded-lg border px-4 pb-2 pt-3.5',\n          className\n        )}\n        {...props}>\n        <View className=\"absolute left-3.5 top-3\">\n          <Icon\n            as={icon}\n            className={cn('size-4', variant === 'destructive' && 'text-destructive', iconClassName)}\n          />\n        </View>\n        {children}\n      </View>\n    </TextClassContext.Provider>\n  );\n}\n\nfunction AlertTitle({\n  className,\n  ...props\n}: React.ComponentProps<typeof Text>) {\n  return (\n    <Text\n      className={cn('mb-1 ml-0.5 min-h-4 pl-6 font-medium leading-none tracking-tight', className)}\n      {...props}\n    />\n  );\n}\n\nfunction AlertDescription({\n  className,\n  ...props\n}: React.ComponentProps<typeof Text>) {\n  const textClass = React.useContext(TextClassContext);\n  return (\n    <Text\n      className={cn(\n        'text-muted-foreground ml-0.5 pb-1.5 pl-6 text-sm leading-relaxed',\n        textClass?.includes('text-destructive') && 'text-destructive/90',\n        className\n      )}\n      {...props}\n    />\n  );\n}\n\nexport { Alert, AlertDescription, AlertTitle };\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `apps/docs/public/r/nativewind/badge.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/badge.tsx",
-      "content": "import { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport * as Slot from '@rn-primitives/slot';\nimport { cva, type VariantProps } from 'class-variance-authority';\nimport { Platform, View } from 'react-native';\n\nconst badgeVariants = cva(\n  cn(\n    'border-border group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5',\n    Platform.select({\n      web: 'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive w-fit whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',\n    })\n  ),\n  {\n    variants: {\n      variant: {\n        default: cn(\n          'bg-primary border-transparent',\n          Platform.select({ web: '[a&]:hover:bg-primary/90' })\n        ),\n        secondary: cn(\n          'bg-secondary border-transparent',\n          Platform.select({ web: '[a&]:hover:bg-secondary/90' })\n        ),\n        destructive: cn(\n          'bg-destructive border-transparent',\n          Platform.select({ web: '[a&]:hover:bg-destructive/90' })\n        ),\n        outline: Platform.select({ web: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground' }),\n      },\n    },\n    defaultVariants: {\n      variant: 'default',\n    },\n  }\n);\n\nconst badgeTextVariants = cva('text-xs font-medium', {\n  variants: {\n    variant: {\n      default: 'text-primary-foreground',\n      secondary: 'text-secondary-foreground',\n      destructive: 'text-white',\n      outline: 'text-foreground',\n    },\n  },\n  defaultVariants: {\n    variant: 'default',\n  },\n});\n\ntype BadgeProps = React.ComponentProps<typeof View> & {\n    asChild?: boolean;\n  } & VariantProps<typeof badgeVariants>;\n\nfunction Badge({ className, variant, asChild, ...props }: BadgeProps) {\n  const Component = asChild ? Slot.View : View;\n  return (\n    <TextClassContext.Provider value={badgeTextVariants({ variant })}>\n      <Component className={cn(badgeVariants({ variant }), className)} {...props} />\n    </TextClassContext.Provider>\n  );\n}\n\nexport { Badge, badgeTextVariants, badgeVariants };\nexport type { BadgeProps };\n",
+      "content": "import { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport { Slot } from '@rn-primitives/slot';\nimport { cva, type VariantProps } from 'class-variance-authority';\nimport { Platform, View } from 'react-native';\n\nconst badgeVariants = cva(\n  cn(\n    'border-border group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5',\n    Platform.select({\n      web: 'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive w-fit whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',\n    })\n  ),\n  {\n    variants: {\n      variant: {\n        default: cn(\n          'bg-primary border-transparent',\n          Platform.select({ web: '[a&]:hover:bg-primary/90' })\n        ),\n        secondary: cn(\n          'bg-secondary border-transparent',\n          Platform.select({ web: '[a&]:hover:bg-secondary/90' })\n        ),\n        destructive: cn(\n          'bg-destructive border-transparent',\n          Platform.select({ web: '[a&]:hover:bg-destructive/90' })\n        ),\n        outline: Platform.select({ web: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground' }),\n      },\n    },\n    defaultVariants: {\n      variant: 'default',\n    },\n  }\n);\n\nconst badgeTextVariants = cva('text-xs font-medium', {\n  variants: {\n    variant: {\n      default: 'text-primary-foreground',\n      secondary: 'text-secondary-foreground',\n      destructive: 'text-white',\n      outline: 'text-foreground',\n    },\n  },\n  defaultVariants: {\n    variant: 'default',\n  },\n});\n\ntype BadgeProps = React.ComponentProps<typeof View> & React.RefAttributes<View> & {\n  asChild?: boolean;\n} & VariantProps<typeof badgeVariants>;\n\nfunction Badge({ className, variant, asChild, ...props }: BadgeProps) {\n  const Component = asChild ? Slot : View;\n  return (\n    <TextClassContext.Provider value={badgeTextVariants({ variant })}>\n      <Component className={cn(badgeVariants({ variant }), className)} {...props} />\n    </TextClassContext.Provider>\n  );\n}\n\nexport { Badge, badgeTextVariants, badgeVariants };\nexport type { BadgeProps };\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `apps/docs/public/r/nativewind/button.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/button.tsx",
-      "content": "import { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport { cva, type VariantProps } from 'class-variance-authority';\nimport { Platform, Pressable } from 'react-native';\n\nconst buttonVariants = cva(\n  cn(\n    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none',\n    Platform.select({\n      web: \"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0\",\n    })\n  ),\n  {\n    variants: {\n      variant: {\n        default: cn(\n          'bg-primary active:bg-primary/90 shadow-sm shadow-black/5',\n          Platform.select({ web: 'hover:bg-primary/90' })\n        ),\n        destructive: cn(\n          'bg-destructive active:bg-destructive/90 dark:bg-destructive/60 shadow-sm shadow-black/5',\n          Platform.select({\n            web: 'hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',\n          })\n        ),\n        outline: cn(\n          'border-border bg-background active:bg-accent dark:bg-input/30 dark:border-input dark:active:bg-input/50 border shadow-sm shadow-black/5',\n          Platform.select({\n            web: 'hover:bg-accent dark:hover:bg-input/50',\n          })\n        ),\n        secondary: cn(\n          'bg-secondary active:bg-secondary/80 shadow-sm shadow-black/5',\n          Platform.select({ web: 'hover:bg-secondary/80' })\n        ),\n        ghost: cn(\n          'active:bg-accent dark:active:bg-accent/50',\n          Platform.select({ web: 'hover:bg-accent dark:hover:bg-accent/50' })\n        ),\n        link: '',\n      },\n      size: {\n        default: cn('h-10 px-4 py-2 sm:h-9', Platform.select({ web: 'has-[>svg]:px-3' })),\n        sm: cn('h-9 gap-1.5 rounded-md px-3 sm:h-8', Platform.select({ web: 'has-[>svg]:px-2.5' })),\n        lg: cn('h-11 rounded-md px-6 sm:h-10', Platform.select({ web: 'has-[>svg]:px-4' })),\n        icon: 'h-10 w-10 sm:h-9 sm:w-9',\n      },\n    },\n    defaultVariants: {\n      variant: 'default',\n      size: 'default',\n    },\n  }\n);\n\nconst buttonTextVariants = cva(\n  cn(\n    'text-foreground text-sm font-medium',\n    Platform.select({ web: 'pointer-events-none transition-colors' })\n  ),\n  {\n    variants: {\n      variant: {\n        default: 'text-primary-foreground',\n        destructive: 'text-white',\n        outline: cn(\n          'group-active:text-accent-foreground',\n          Platform.select({ web: 'group-hover:text-accent-foreground' })\n        ),\n        secondary: 'text-secondary-foreground',\n        ghost: 'group-active:text-accent-foreground',\n        link: cn(\n          'text-primary group-active:underline',\n          Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })\n        ),\n      },\n      size: {\n        default: '',\n        sm: '',\n        lg: '',\n        icon: '',\n      },\n    },\n    defaultVariants: {\n      variant: 'default',\n      size: 'default',\n    },\n  }\n);\n\ntype ButtonProps = React.ComponentProps<typeof Pressable> & VariantProps<typeof buttonVariants>;\n\nfunction Button({ className, variant, size, ...props }: ButtonProps) {\n  return (\n    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>\n      <Pressable\n        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}\n        role=\"button\"\n        {...props}\n      />\n    </TextClassContext.Provider>\n  );\n}\n\nexport { Button, buttonTextVariants, buttonVariants };\nexport type { ButtonProps };\n",
+      "content": "import { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport { cva, type VariantProps } from 'class-variance-authority';\nimport { Platform, Pressable } from 'react-native';\n\nconst buttonVariants = cva(\n  cn(\n    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none',\n    Platform.select({\n      web: \"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0\",\n    })\n  ),\n  {\n    variants: {\n      variant: {\n        default: cn(\n          'bg-primary active:bg-primary/90 shadow-sm shadow-black/5',\n          Platform.select({ web: 'h
```

**File**: `apps/docs/public/r/nativewind/card.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/card.tsx",
-      "content": "import { Text, TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport { View } from 'react-native';\n\nfunction Card({ className, ...props }: React.ComponentProps<typeof View>) {\n  return (\n    <TextClassContext.Provider value=\"text-card-foreground\">\n      <View\n        className={cn(\n          'bg-card border-border flex flex-col gap-6 rounded-xl border py-6 shadow-sm shadow-black/5',\n          className\n        )}\n        {...props}\n      />\n    </TextClassContext.Provider>\n  );\n}\n\nfunction CardHeader({ className, ...props }: React.ComponentProps<typeof View>) {\n  return <View className={cn('flex flex-col gap-1.5 px-6', className)} {...props} />;\n}\n\nfunction CardTitle({\n  className,\n  ...props\n}: React.ComponentProps<typeof Text>) {\n  return (\n    <Text\n      role=\"heading\"\n      aria-level={3}\n      className={cn('font-semibold leading-none', className)}\n      {...props}\n    />\n  );\n}\n\nfunction CardDescription({\n  className,\n  ...props\n}: React.ComponentProps<typeof Text>) {\n  return <Text className={cn('text-muted-foreground text-sm', className)} {...props} />;\n}\n\nfunction CardContent({ className, ...props }: React.ComponentProps<typeof View>) {\n  return <View className={cn('px-6', className)} {...props} />;\n}\n\nfunction CardFooter({ className, ...props }: React.ComponentProps<typeof View>) {\n  return <View className={cn('flex flex-row items-center px-6', className)} {...props} />;\n}\n\nexport { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };\n",
+      "content": "import { Text, TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport { View } from 'react-native';\n\nfunction Card({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {\n  return (\n    <TextClassContext.Provider value=\"text-card-foreground\">\n      <View\n        className={cn(\n          'bg-card border-border flex flex-col gap-6 rounded-xl border py-6 shadow-sm shadow-black/5',\n          className\n        )}\n        {...props}\n      />\n    </TextClassContext.Provider>\n  );\n}\n\nfunction CardHeader({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {\n  return <View className={cn('flex flex-col gap-1.5 px-6', className)} {...props} />;\n}\n\nfunction CardTitle({\n  className,\n  ref,\n  ...props\n}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {\n\n  return (\n    <Text\n      ref={ref}\n      role=\"heading\"\n      aria-level={3}\n      className={cn('font-semibold leading-none', className)}\n      {...props}\n    />\n  );\n}\n\nfunction CardDescription({\n  className,\n  ...props\n}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {\n  return <Text className={cn('text-muted-foreground text-sm', className)} {...props} />;\n}\n\nfunction CardContent({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {\n  return <View className={cn('px-6', className)} {...props} />;\n}\n\nfunction CardFooter({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {\n  return <View className={cn('flex flex-row items-center px-6', className)} {...props} />;\n}\n\nexport { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `apps/docs/public/r/nativewind/forgot-password-form-clerk.json` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@
   "author": "@mrzachnugent",
   "description": "A form that sends a password reset OTP to the user's email address with Clerk integration.",
   "dependencies": [
-    "@clerk/clerk-expo"
+    "@clerk/expo"
   ],
   "registryDependencies": [
     "https://reactnativereusables.com/r/nativewind/button.json",
@@ -18,7 +18,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/blocks/clerk/forgot-password-form.tsx",
-      "content": "import { Button } from '@/registry/nativewind/components/ui/button';\nimport {\n  Card,\n  CardContent,\n  CardDescription,\n  CardHeader,\n  CardTitle,\n} from '@/registry/nativewind/components/ui/card';\nimport { Input } from '@/registry/nativewind/components/ui/input';\nimport { Label } from '@/registry/nativewind/components/ui/label';\nimport { Text } from '@/registry/nativewind/components/ui/text';\nimport { useSignIn } from '@clerk/clerk-expo';\nimport * as React from 'react';\nimport { View } from 'react-native';\n\nexport function ForgotPasswordForm() {\n  const [email, setEmail] = React.useState('');\n  const { signIn, isLoaded } = useSignIn();\n  const [error, setError] = React.useState<{ email?: string; password?: string }>({});\n\n  const onSubmit = async () => {\n    if (!email) {\n      setError({ email: 'Email is required' });\n      return;\n    }\n    if (!isLoaded) {\n      return;\n    }\n\n    try {\n      await signIn.create({\n        strategy: 'reset_password_email_code',\n        identifier: email,\n      });\n\n      // TODO: Navigate to reset password screen\n    } catch (err) {\n      // See https://go.clerk.com/mRUDrIe for more info on error handling\n      if (err instanceof Error) {\n        setError({ email: err.message });\n        return;\n      }\n      console.error(JSON.stringify(err, null, 2));\n    }\n  };\n\n  return (\n    <View className=\"gap-6\">\n      <Card className=\"border-border/0 sm:border-border shadow-none sm:shadow-sm sm:shadow-black/5\">\n        <CardHeader>\n          <CardTitle className=\"text-center text-xl sm:text-left\">Forgot password?</CardTitle>\n          <CardDescription className=\"text-center sm:text-left\">\n            Enter your email to reset your password\n          </CardDescription>\n        </CardHeader>\n        <CardContent className=\"gap-6\">\n          <View className=\"gap-6\">\n            <View className=\"gap-1.5\">\n              <Label htmlFor=\"email\">Email</Label>\n              <Input\n                id=\"email\"\n                defaultValue={email}\n                placeholder=\"m@example.com\"\n                keyboardType=\"email-address\"\n                autoComplete=\"email\"\n                autoCapitalize=\"none\"\n                onChangeText={setEmail}\n                onSubmitEditing={onSubmit}\n                returnKeyType=\"send\"\n              />\n              {error.email ? (\n                <Text className=\"text-destructive text-sm font-medium\">{error.email}</Text>\n              ) : null}\n            </View>\n            <Button className=\"w-full\" onPress={onSubmit}>\n              <Text>Reset your password</Text>\n            </Button>\n          </View>\n        </CardContent>\n      </Card>\n    </View>\n  );\n}\n",
+      "content": "import { Button } from '@/registry/nativewind/components/ui/button';\nimport {\n  Card,\n  CardContent,\n  CardDescription,\n  CardHeader,\n  CardTitle,\n} from '@/registry/nativewind/components/ui/card';\nimport { Input } from '@/registry/nativewind/components/ui/input';\nimport { Label } from '@/registry/nativewind/components/ui/label';\nimport { Text } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport { useSignIn } from '@clerk/expo';\nimport * as React from 'react';\nimport { View } from 'react-native';\n\nexport function ForgotPasswordForm() {\n  const [email, setEmail] = React.useState(\"\");\n  const { signIn, fetchStatus } = useSignIn();\n  const [error, setError] = React.useState<{ email?: string; password?: string }>({});\n\n  const onSubmit = async () => {\n    if (!email) {\n      setError({ email: 'Email is required' });\n      return;\n    }\n    if (fetchStatus === 'fetching') {\n      return;\n    }\n\n    try {\n      const { error: createError } = await signIn.create({\n        identifier: email,\n      });\n\n      if (createError) {\n        setError({ email: createError.longMessage ?? createError.message });\n        return;\n      }\n\n      const { error: sendCodeError } = await signIn.resetPasswordEmailCode.sendCode();\n\n      if (sendCodeError) {\n        setError({ email: sendCodeError.longMessage ?? sendCodeError.message });\n        return;\n      }\n\n      // TODO: Navigate to reset password screen\n    } catch (err) {\n      // See https://go.clerk.com/mRUDrIe for more info on error handling\n      setError({ email: err instanceof Error ? err.message : 'Something went wrong' });\n    }\n  };\n\n  return
```

**File**: `apps/docs/public/r/nativewind/icon.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/icon.tsx",
-      "content": "import { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport type { LucideIcon, LucideProps } from 'lucide-react-native';\nimport { cssInterop } from 'nativewind';\nimport * as React from 'react';\n\ntype IconProps = LucideProps & {\n  as: LucideIcon;\n};\n\nfunction IconImpl({ as: IconComponent, ...props }: IconProps) {\n  return <IconComponent {...props} />;\n}\n\ncssInterop(IconImpl, {\n  className: {\n    target: 'style',\n    nativeStyleToProp: {\n      height: 'size',\n      width: 'size',\n    },\n  },\n});\n\n/**\n * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.\n *\n * This component allows you to render any Lucide icon while applying utility classes\n * using `nativewind`. It avoids the need to wrap or configure each icon individually.\n *\n * @component\n * @example\n * ```tsx\n * import { ArrowRight } from 'lucide-react-native';\n * import { Icon } from '@/registry/components/ui/icon';\n *\n * <Icon as={ArrowRight} className=\"text-red-500\" size={16} />\n * ```\n *\n * @param {LucideIcon} as - The Lucide icon component to render.\n * @param {string} className - Utility classes to style the icon using Nativewind.\n * @param {number} size - Icon size (defaults to 14).\n * @param {...LucideProps} ...props - Additional Lucide icon props passed to the \"as\" icon.\n */\nfunction Icon({ as: IconComponent, className, size = 14, ...props }: IconProps) {\n  const textClass = React.useContext(TextClassContext);\n  return (\n    <IconImpl\n      as={IconComponent}\n      className={cn('text-foreground', textClass, className)}\n      size={size}\n      {...props}\n    />\n  );\n}\n\nexport { Icon };\n",
+      "content": "import { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport type { LucideIcon, LucideProps } from 'lucide-react-native';\nimport { cssInterop } from 'nativewind';\nimport * as React from 'react';\n\ntype IconProps = LucideProps & {\n  as: LucideIcon;\n} & React.RefAttributes<LucideIcon>;\n\nfunction IconImpl({ as: IconComponent, ...props }: IconProps) {\n  return <IconComponent {...props} />;\n}\n\ncssInterop(IconImpl, {\n  className: {\n    target: 'style',\n    nativeStyleToProp: {\n      height: 'size',\n      width: 'size',\n    },\n  },\n});\n\n/**\n * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.\n *\n * This component allows you to render any Lucide icon while applying utility classes\n * using `nativewind`. It avoids the need to wrap or configure each icon individually.\n *\n * @component\n * @example\n * ```tsx\n * import { ArrowRight } from 'lucide-react-native';\n * import { Icon } from '@/registry/components/ui/icon';\n *\n * <Icon as={ArrowRight} className=\"text-red-500\" size={16} />\n * ```\n *\n * @param {LucideIcon} as - The Lucide icon component to render.\n * @param {string} className - Utility classes to style the icon using Nativewind.\n * @param {number} size - Icon size (defaults to 14).\n * @param {...LucideProps} ...props - Additional Lucide icon props passed to the \"as\" icon.\n */\nfunction Icon({ as: IconComponent, className, size = 14, ...props }: IconProps) {\n  const textClass = React.useContext(TextClassContext);\n  return (\n    <IconImpl\n      as={IconComponent}\n      className={cn('text-foreground', textClass, className)}\n      size={size}\n      {...props}\n    />\n  );\n}\n\nexport { Icon };\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `apps/docs/public/r/nativewind/input.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/input.tsx",
-      "content": "import { cn } from '@/registry/nativewind/lib/utils';\nimport { Platform, TextInput } from 'react-native';\n\nfunction Input({ className, ...props }: React.ComponentProps<typeof TextInput>) {\n  return (\n    <TextInput\n      className={cn(\n        'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',\n        props.editable === false &&\n          cn(\n            'opacity-50',\n            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })\n          ),\n        Platform.select({\n          web: cn(\n            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',\n            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',\n            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'\n          ),\n          native: 'placeholder:text-muted-foreground/50',\n        }),\n        className\n      )}\n      {...props}\n    />\n  );\n}\n\nexport { Input };\n",
+      "content": "import { cn } from '@/registry/nativewind/lib/utils';\nimport { Platform, TextInput } from 'react-native';\n\nfunction Input({ className, ...props }: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {\n  return (\n    <TextInput\n      className={cn(\n        'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',\n        props.editable === false &&\n        cn(\n          'opacity-50',\n          Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })\n        ),\n        Platform.select({\n          web: cn(\n            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',\n            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',\n            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'\n          ),\n          native: 'placeholder:text-muted-foreground/50',\n        }),\n        className\n      )}\n      {...props}\n    />\n  );\n}\n\nexport { Input };\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `apps/docs/public/r/nativewind/native-only-animated-view.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/native-only-animated-view.tsx",
-      "content": "import { Platform } from 'react-native';\nimport Animated from 'react-native-reanimated';\n\n/**\n * This component is used to wrap animated views that should only be animated on native.\n * @param props - The props for the animated view.\n * @returns The animated view if the platform is native, otherwise the children.\n * @example\n * <NativeOnlyAnimatedView entering={FadeIn} exiting={FadeOut}>\n *   <Text>I am only animated on native</Text>\n * </NativeOnlyAnimatedView>\n */\nfunction NativeOnlyAnimatedView(\n  props: React.ComponentProps<typeof Animated.View>\n) {\n  if (Platform.OS === 'web') {\n    return <>{props.children as React.ReactNode}</>;\n  } else {\n    return <Animated.View {...props} />;\n  }\n}\n\nexport { NativeOnlyAnimatedView };\n",
+      "content": "import { Platform } from 'react-native';\nimport Animated from 'react-native-reanimated';\n\n/**\n * This component is used to wrap animated views that should only be animated on native.\n * @param props - The props for the animated view.\n * @returns The animated view if the platform is native, otherwise the children.\n * @example\n * <NativeOnlyAnimatedView entering={FadeIn} exiting={FadeOut}>\n *   <Text>I am only animated on native</Text>\n * </NativeOnlyAnimatedView>\n */\nfunction NativeOnlyAnimatedView(\n  props: React.ComponentProps<typeof Animated.View> & React.RefAttributes<typeof Animated.View>\n) {\n  if (Platform.OS === 'web') {\n    return <>{props.children as React.ReactNode}</>;\n  } else {\n    return <Animated.View {...props} />;\n  }\n}\n\nexport { NativeOnlyAnimatedView };\n",
       "type": "registry:ui"
     }
   ]
```

---

### Incident Patch 5: `39a0bd20` (2026-05-02)
**Commit Message**: refactor(ui): enhance prop types across multiple components by adding React.RefAttributes for improved type safety and consistency

**File**: `packages/registry/src/nativewind/components/ui/alert.tsx` (modified, +5/-5)
```diff
@@ -12,11 +12,11 @@ function Alert({
   icon,
   iconClassName,
   ...props
-}: React.ComponentProps<typeof View> & {
-    icon: LucideIcon;
-    variant?: 'default' | 'destructive';
-    iconClassName?: string;
-  }) {
+}: React.ComponentProps<typeof View> & React.RefAttributes<View> & {
+  icon: LucideIcon;
+  variant?: 'default' | 'destructive';
+  iconClassName?: string;
+}) {
   return (
     <TextClassContext.Provider
       value={cn(
```

**File**: `packages/registry/src/nativewind/components/ui/badge.tsx` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 import { TextClassContext } from '@/registry/nativewind/components/ui/text';
 import { cn } from '@/registry/nativewind/lib/utils';
-import * as Slot from '@rn-primitives/slot';
+import { Slot } from '@rn-primitives/slot';
 import { cva, type VariantProps } from 'class-variance-authority';
 import { Platform, View } from 'react-native';
 
@@ -49,12 +49,12 @@ const badgeTextVariants = cva('text-xs font-medium', {
   },
 });
 
-type BadgeProps = React.ComponentProps<typeof View> & {
-    asChild?: boolean;
-  } & VariantProps<typeof badgeVariants>;
+type BadgeProps = React.ComponentProps<typeof View> & React.RefAttributes<View> & {
+  asChild?: boolean;
+} & VariantProps<typeof badgeVariants>;
 
 function Badge({ className, variant, asChild, ...props }: BadgeProps) {
-  const Component = asChild ? Slot.View : View;
+  const Component = asChild ? Slot : View;
   return (
     <TextClassContext.Provider value={badgeTextVariants({ variant })}>
       <Component className={cn(badgeVariants({ variant }), className)} {...props} />
```

**File**: `packages/registry/src/nativewind/components/ui/button.tsx` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ const buttonTextVariants = cva(
   }
 );
 
-type ButtonProps = React.ComponentProps<typeof Pressable> & VariantProps<typeof buttonVariants>;
+type ButtonProps = React.ComponentProps<typeof Pressable> & React.RefAttributes<typeof Pressable> & VariantProps<typeof buttonVariants>;
 
 function Button({ className, variant, size, ...props }: ButtonProps) {
   return (
```

**File**: `packages/registry/src/nativewind/components/ui/card.tsx` (modified, +9/-6)
```diff
@@ -2,7 +2,7 @@ import { Text, TextClassContext } from '@/registry/nativewind/components/ui/text
 import { cn } from '@/registry/nativewind/lib/utils';
 import { View } from 'react-native';
 
-function Card({ className, ...props }: React.ComponentProps<typeof View>) {
+function Card({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
   return (
     <TextClassContext.Provider value="text-card-foreground">
       <View
@@ -16,16 +16,19 @@ function Card({ className, ...props }: React.ComponentProps<typeof View>) {
   );
 }
 
-function CardHeader({ className, ...props }: React.ComponentProps<typeof View>) {
+function CardHeader({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
   return <View className={cn('flex flex-col gap-1.5 px-6', className)} {...props} />;
 }
 
 function CardTitle({
   className,
+  ref,
   ...props
-}: React.ComponentProps<typeof Text>) {
+}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
+
   return (
     <Text
+      ref={ref}
       role="heading"
       aria-level={3}
       className={cn('font-semibold leading-none', className)}
@@ -37,15 +40,15 @@ function CardTitle({
 function CardDescription({
   className,
   ...props
-}: React.ComponentProps<typeof Text>) {
+}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
   return <Text className={cn('text-muted-foreground text-sm', className)} {...props} />;
 }
 
-function CardContent({ className, ...props }: React.ComponentProps<typeof View>) {
+function CardContent({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
   return <View className={cn('px-6', className)} {...props} />;
 }
 
-function CardFooter({ className, ...props }: React.ComponentProps<typeof View>) {
+function CardFooter({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
   return <View className={cn('flex flex-row items-center px-6', className)} {...props} />;
 }
 
```

**File**: `packages/registry/src/nativewind/components/ui/icon.tsx` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import * as React from 'react';
 
 type IconProps = LucideProps & {
   as: LucideIcon;
-};
+} & React.RefAttributes<LucideIcon>;
 
 function IconImpl({ as: IconComponent, ...props }: IconProps) {
   return <IconComponent {...props} />;
```

**File**: `packages/registry/src/nativewind/components/ui/input.tsx` (modified, +5/-5)
```diff
@@ -1,16 +1,16 @@
 import { cn } from '@/registry/nativewind/lib/utils';
 import { Platform, TextInput } from 'react-native';
 
-function Input({ className, ...props }: React.ComponentProps<typeof TextInput>) {
+function Input({ className, ...props }: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
   return (
     <TextInput
       className={cn(
         'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',
         props.editable === false &&
-          cn(
-            'opacity-50',
-            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
-          ),
+        cn(
+          'opacity-50',
+          Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
+        ),
         Platform.select({
           web: cn(
             'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
```

**File**: `packages/registry/src/nativewind/components/ui/native-only-animated-view.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import Animated from 'react-native-reanimated';
  * </NativeOnlyAnimatedView>
  */
 function NativeOnlyAnimatedView(
-  props: React.ComponentProps<typeof Animated.View>
+  props: React.ComponentProps<typeof Animated.View> & React.RefAttributes<typeof Animated.View>
 ) {
   if (Platform.OS === 'web') {
     return <>{props.children as React.ReactNode}</>;
```

**File**: `packages/registry/src/nativewind/components/ui/skeleton.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { View } from 'react-native';
 function Skeleton({
   className,
   ...props
-}: React.ComponentProps<typeof View>) {
+}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
   return <View className={cn('bg-accent animate-pulse rounded-md', className)} {...props} />;
 }
 
```

---

### Incident Patch 6: `54e82902` (2026-05-02)
**Commit Message**: fix(docs): update Clerk package references from @clerk/clerk-expo to @clerk/expo across authentication documentation and registry files

**File**: `apps/docs/content/docs/blocks/authentication/forgot-password-form.mdx` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ description: A form that sends a password reset OTP to the user's email address.
 import { BlockPreviewCard } from '@docs/components/preview-card';
 import { ForgotPasswordForm } from "@docs/components/blocks";
 import { ExternalLinks } from "@docs/components/external-links";
-import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                        
+import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                         
 import { CommandTabs } from "@docs/components/command-tabs";
 import { AuthBlockTabs, AuthBlockTabsCliContent, AuthBlockTabsManualContent } from '@docs/components/auth-block-tabs';
 import { Callout } from '@docs/components/callout';
@@ -141,7 +141,7 @@ import { Callout } from '@docs/components/callout';
         - Install the Clerk package:
 
         ```bash
-        npx expo install @clerk/clerk-expo
+        npx expo install @clerk/expo
         ```
 
         - Follow steps 2-4 of Clerk's [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to configure your app for Clerk.
```

**File**: `apps/docs/content/docs/blocks/authentication/reset-password-form.mdx` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ description: A form for resetting a password with an OTP sent via email.
 import { BlockPreviewCard } from '@docs/components/preview-card';
 import { ResetPasswordForm } from "@docs/components/blocks";
 import { ExternalLinks } from "@docs/components/external-links";
-import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                 
+import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                  
 import { CommandTabs } from "@docs/components/command-tabs";
 import { AuthBlockTabs, AuthBlockTabsCliContent, AuthBlockTabsManualContent } from '@docs/components/auth-block-tabs';
 import { Callout } from '@docs/components/callout';
@@ -142,7 +142,7 @@ import { Callout } from '@docs/components/callout';
         - Install the Clerk package:
 
         ```bash
-        npx expo install @clerk/clerk-expo
+        npx expo install @clerk/expo
         ```
 
         - Follow steps 2-4 of Clerk's [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to configure your app for Clerk.
```

**File**: `apps/docs/content/docs/blocks/authentication/sign-in-form.mdx` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ description: A form for signing in using email and password or social providers.
 import { BlockPreviewCard } from '@docs/components/preview-card';
 import { SignInForm } from "@docs/components/blocks";
 import { ExternalLinks } from "@docs/components/external-links";
-import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                                          
+import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                                           
 import { CommandTabs } from "@docs/components/command-tabs";
 import { AuthBlockTabs, AuthBlockTabsCliContent, AuthBlockTabsManualContent } from '@docs/components/auth-block-tabs';
 import { Callout } from '@docs/components/callout';
@@ -146,7 +146,7 @@ import { Callout } from '@docs/components/callout';
         - Install the Clerk package:
 
         ```bash
-        npx expo install @clerk/clerk-expo
+        npx expo install @clerk/expo
         ```
 
         - Follow steps 2-4 of Clerk's [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to configure your app for Clerk.
```

**File**: `apps/docs/content/docs/blocks/authentication/sign-up-form.mdx` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ description: A form for creating an account with email and password or social pr
 import { BlockPreviewCard } from '@docs/components/preview-card';
 import { SignUpForm } from "@docs/components/blocks";
 import { ExternalLinks } from "@docs/components/external-links";
-import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                               
+import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                
 import { CommandTabs } from "@docs/components/command-tabs";
 import { AuthBlockTabs, AuthBlockTabsCliContent, AuthBlockTabsManualContent } from '@docs/components/auth-block-tabs';
 import { Callout } from '@docs/components/callout';
@@ -145,7 +145,7 @@ import { Callout } from '@docs/components/callout';
         - Install the Clerk package:
 
         ```bash
-        npx expo install @clerk/clerk-expo
+        npx expo install @clerk/expo
         ```
 
         - Follow steps 2-4 of Clerk's [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to configure your app for Clerk.
```

**File**: `apps/docs/content/docs/blocks/authentication/social-connections.mdx` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ description: A set of buttons for authenticating through social providers.
 import { BlockPreviewCard } from '@docs/components/preview-card';
 import { SocialConnections } from "@docs/components/blocks";
 import { ExternalLinks } from "@docs/components/external-links";
-import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                    
+import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                     
 import { CommandTabs } from "@docs/components/command-tabs";
 import { AuthBlockTabs, AuthBlockTabsCliContent, AuthBlockTabsManualContent } from '@docs/components/auth-block-tabs';
 import { Callout } from '@docs/components/callout';
@@ -142,7 +142,7 @@ import { Callout } from '@docs/components/callout';
         - Install the Clerk package:
 
         ```bash
-        npx expo install @clerk/clerk-expo
+        npx expo install @clerk/expo
         ```
 
         - Follow steps 2-4 of Clerk's [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to configure your app for Clerk.
```

**File**: `apps/docs/content/docs/blocks/authentication/user-menu.mdx` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ description: A popover menu presenting options and actions for the current user.
 import { BlockPreviewCard } from '@docs/components/preview-card';
 import { UserMenu } from "@docs/components/blocks";
 import { ExternalLinks } from "@docs/components/external-links";
-import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                               
+import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                
 import { CommandTabs } from "@docs/components/command-tabs";
 import { AuthBlockTabs, AuthBlockTabsCliContent, AuthBlockTabsManualContent } from '@docs/components/auth-block-tabs';
 import { Callout } from '@docs/components/callout';
@@ -132,7 +132,7 @@ import { Callout } from '@docs/components/callout';
         - Install the Clerk package:
 
         ```bash
-        npx expo install @clerk/clerk-expo
+        npx expo install @clerk/expo
         ```
 
         - Follow steps 2-4 of Clerk's [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to configure your app for Clerk.
```

**File**: `apps/docs/content/docs/blocks/authentication/verify-email-form.mdx` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ description: A form for verifying an email address with an OTP sent via email.
 import { BlockPreviewCard } from '@docs/components/preview-card';
 import { VerifyEmailForm } from "@docs/components/blocks";
 import { ExternalLinks } from "@docs/components/external-links";
-import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                 
+import { Step, Steps } from 'fumadocs-ui/components/steps';                                                                                  
 import { CommandTabs } from "@docs/components/command-tabs";
 import { AuthBlockTabs, AuthBlockTabsCliContent, AuthBlockTabsManualContent } from '@docs/components/auth-block-tabs';
 import { Callout } from '@docs/components/callout';
@@ -143,7 +143,7 @@ import { Callout } from '@docs/components/callout';
         - Install the Clerk package:
 
         ```bash
-        npx expo install @clerk/clerk-expo
+        npx expo install @clerk/expo
         ```
 
         - Follow steps 2-4 of Clerk's [Expo quick start](https://go.clerk.com/8e6CCee#set-your-clerk-api-keys) to configure your app for Clerk.
```

**File**: `apps/docs/registry/nativewind.json` (modified, +7/-7)
```diff
@@ -657,7 +657,7 @@
           "type": "registry:component"
         }
       ],
-      "dependencies": ["@clerk/clerk-expo"],
+      "dependencies": ["@clerk/expo"],
       "registryDependencies": [
         "https://reactnativereusables.com/r/nativewind/button.json",
         "https://reactnativereusables.com/r/nativewind/card.json",
@@ -680,7 +680,7 @@
           "type": "registry:component"
         }
       ],
-      "dependencies": ["@clerk/clerk-expo"],
+      "dependencies": ["@clerk/expo"],
       "registryDependencies": [
         "https://reactnativereusables.com/r/nativewind/button.json",
         "https://reactnativereusables.com/r/nativewind/card.json",
@@ -703,7 +703,7 @@
           "type": "registry:component"
         }
       ],
-      "dependencies": ["@clerk/clerk-expo"],
+      "dependencies": ["@clerk/expo"],
       "registryDependencies": [
         "https://reactnativereusables.com/r/nativewind/button.json",
         "https://reactnativereusables.com/r/nativewind/card.json",
@@ -724,7 +724,7 @@
           "type": "registry:component"
         }
       ],
-      "dependencies": ["@clerk/clerk-expo"],
+      "dependencies": ["@clerk/expo"],
       "registryDependencies": [
         "https://reactnativereusables.com/r/nativewind/button.json",
         "https://reactnativereusables.com/r/nativewind/card.json",
@@ -745,7 +745,7 @@
           "type": "registry:component"
         }
       ],
-      "dependencies": ["@clerk/clerk-expo"],
+      "dependencies": ["@clerk/expo"],
       "registryDependencies": [
         "https://reactnativereusables.com/r/nativewind/button.json",
         "https://reactnativereusables.com/r/nativewind/card.json",
@@ -766,7 +766,7 @@
           "type": "registry:component"
         }
       ],
-      "dependencies": ["@clerk/clerk-expo"],
+      "dependencies": ["@clerk/expo"],
       "registryDependencies": [
         "https://reactnativereusables.com/r/nativewind/avatar.json",
         "https://reactnativereusables.com/r/nativewind/button.json",
@@ -787,7 +787,7 @@
           "type": "registry:component"
         }
       ],
-      "dependencies": ["@clerk/clerk-expo", "expo-auth-session", "expo-web-browser"],
+      "dependencies": ["@clerk/expo", "expo-auth-session", "expo-web-browser"],
       "registryDependencies": ["https://reactnativereusables.com/r/nativewind/button.json"]
     }
   ]
```

---

### Incident Patch 7: `70d25f44` (2026-04-05)
**Commit Message**: fix: update founded labs logo

**File**: `apps/docs/lib/FoundedLabsIcon.tsx` (modified, +9/-8)
```diff
@@ -1,14 +1,15 @@
 export default function FoundedLabsIcon() {
   return (
     <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
-      <mask id="path-1-inside-1_65_525" fill="white">
-        <path d="M11.0615 0.608953C15.1434 2.29975 17.0818 6.9795 15.391 11.0615C13.7002 15.1434 9.02049 17.0818 4.93853 15.391C0.856576 13.7002 -1.08184 9.02048 0.608964 4.93852C2.29977 0.856565 6.97951 -1.08185 11.0615 0.608953ZM13.8223 4.87602C13.1665 3.68792 11.6718 3.25519 10.4835 3.91057C10.4529 3.92748 10.4217 3.94524 10.39 3.96275C9.05454 4.69982 8.69538 6.6563 7.79175 7.88519C6.98751 8.97829 5.44949 9.21298 4.35609 8.40913C4.22466 8.31247 4.10542 8.20496 3.99928 8.08904C3.80011 7.87151 3.48013 7.77683 3.22188 7.91924C2.03368 8.57507 1.60089 10.0697 2.25643 11.258C2.91233 12.4463 4.4085 12.8779 5.59687 12.222C5.62657 12.2057 5.6567 12.1888 5.68743 12.1718C7.02305 11.4347 7.38314 9.47785 8.28695 8.24886C9.09122 7.15538 10.63 6.92107 11.7235 7.7253C11.854 7.82128 11.9719 7.92783 12.0771 8.04299C12.2767 8.26143 12.5986 8.35799 12.8577 8.21519C14.0461 7.55937 14.478 6.06442 13.8223 4.87602Z" />
-      </mask>
-      <path
-        d="M11.0615 0.608953L11.6355 -0.776866L11.0615 0.608953ZM15.391 11.0615L16.7769 11.6355L15.391 11.0615ZM4.93853 15.391L4.36451 16.7768L4.93853 15.391ZM0.608964 4.93852L-0.776856 4.3645L0.608964 4.93852ZM13.8223 4.87602L15.1356 4.15139L15.1355 4.15115L13.8223 4.87602ZM10.4835 3.91057L9.75905 2.59711L9.75861 2.59735L10.4835 3.91057ZM10.39 3.96275L9.6652 2.64949L9.66519 2.64949L10.39 3.96275ZM7.79175 7.88519L8.99997 8.77413L9.00022 8.77379L7.79175 7.88519ZM4.35609 8.40913L3.46739 9.61752L3.46759 9.61767L4.35609 8.40913ZM3.99928 8.08904L2.89293 9.10196L2.89298 9.102L3.99928 8.08904ZM3.22188 7.91924L2.49757 6.6057L2.49703 6.606L3.22188 7.91924ZM2.25643 11.258L0.943019 11.9826L0.943204 11.9829L2.25643 11.258ZM5.59687 12.222L6.32162 13.5353L6.32174 13.5353L5.59687 12.222ZM5.68743 12.1718L4.96263 10.8586L5.68743 12.1718ZM8.28695 8.24886L7.0786 7.36011L7.07855 7.36018L8.28695 8.24886ZM11.7235 7.7253L12.6125 6.5171L12.6122 6.51691L11.7235 7.7253ZM12.0771 8.04299L13.1845 7.03121L13.1844 7.03113L12.0771 8.04299ZM12.8577 8.21519L13.5818 9.52888L13.5825 9.52848L12.8577 8.21519ZM11.0615 0.608953L10.4874 1.99477C13.804 3.36855 15.379 7.17084 14.0052 10.4874L15.391 11.0615L16.7769 11.6355C18.7847 6.78816 16.4828 1.23096 11.6355 -0.776866L11.0615 0.608953ZM15.391 11.0615L14.0052 10.4874C12.6314 13.804 8.82915 15.379 5.51256 14.0052L4.93853 15.391L4.36451 16.7768C9.21183 18.7847 14.769 16.4828 16.7769 11.6355L15.391 11.0615ZM4.93853 15.391L5.51256 14.0052C2.19597 12.6314 0.621007 8.82914 1.99478 5.51255L0.608964 4.93852L-0.776856 4.3645C-2.78468 9.21182 -0.482816 14.769 4.36451 16.7768L4.93853 15.391ZM0.608964 4.93852L1.99478 5.51255C3.36856 2.19596 7.17085 0.620996 10.4874 1.99477L11.0615 0.608953L11.6355 -0.776866C6.78817 -2.78469 1.23097 -0.482827 -0.776856 4.3645L0.608964 4.93852ZM13.8223 4.87602L15.1355 4.15115C14.08 2.23889 11.6735 1.5412 9.75905 2.59711L10.4835 3.91057L11.2079 5.22404C11.67 4.96917 12.253 5.13696 12.5091 5.6009L13.8223 4.87602ZM10.4835 3.91057L9.75861 2.59735C9.73785 2.60881 9.7177 2.62013 9.70305 2.62835C9.68682 2.63746 9.67566 2.64371 9.6652 2.64949L10.39 3.96275L11.1148 5.27602C11.1361 5.26429 11.1563 5.2529 11.1713 5.24452C11.1878 5.23526 11.1985 5.22924 11.2084 5.2238L10.4835 3.91057ZM10.39 3.96275L9.66519 2.64949C8.56651 3.25587 7.97213 4.30371 7.58894 5.06544C7.13006 5.97763 6.93576 6.51724 6.58329 6.99659L7.79175 7.88519L9.00022 8.77379C9.55137 8.02424 9.98847 6.97116 10.2689 6.41363C10.6251 5.70563 10.878 5.4067 11.1148 5.27601L10.39 3.96275ZM7.79175 7.88519L6.58354 6.99625C6.26995 7.42247 5.67048 7.5137 5.24459 7.20059L4.35609 8.40913L3.46759 9.61767C5.2285 10.9123 7.70507 10.5341 8.99997 8.77413L7.79175 7.88519ZM4.35609 8.40913L5.24479 7.20074C5.19219 7.16206 5.14581 7.12001 5.10558 7.07607L3.99928 8.08904L2.89298 9.102C3.06502 9.2899 3.25713 9.46289 3.46739 9.61752L4.35609 8.40913ZM3.99928 8.08904L5.10562 7.07612C4.57133 6.49255 3.51874 6.04261 2.49757 6.6057L3.22188 7.91924L3.94618 9.23278C3.70627 9.36507 3.45984 9.37044 3.2813 9.32741C3.11277 9.2868 2.98411 9.20155 2.89293 9.10196L3.99928 8.08904ZM3.22188 7.91924L2.49703 6.606C0.584727 7.66151 -0.113182 10.0679 0.943019 11.9826L2.25643 11.258L3.56984 10.5335C3.31497 10.0715 3.48264 9.48863 3.94672 9.23248L3.22188 7.91924ZM2.25643 11.258L0.943204 11.9829C1.99965 13.8968 4.40841 14.5912 6.32162 13.5353L5.59687 12.222L4.87212 10.9088C4.40859 11.1646 3.82502 10.9958 3.56965 10.5332L2.25643 11.258ZM5.59687 12.222L6.32174 13.5353C6.33885 13.5258 6.35577 13.5164 6.37047 13.5083C6.38582 13.4997 6.39913 13.4923 6.41224 13.4851L5.68743 12.1718L4.96263 10.8586C4.94501 10.8683 4.92788 10.8778 4.91306 10.886C4.89758 10.8946 4.88458 10.9019 4.87199 10.9088L5.59687 12.222ZM5.68743 12.1718L6.41224 13.4851C7.51083 12.8788 8.1055 11.831 8.48896 11.0692C8.94815 10.1569 9.1427 9.61709 9.49536 9.13754
```

---

### Incident Patch 8: `c01bb669` (2026-03-16)
**Commit Message**: refactor(select): remove workaround for web-mobile touch handling in ScrollableSelect and Select components for cleaner code

**File**: `packages/registry/src/examples/select/scrollable-select.tsx` (modified, +1/-6)
```diff
@@ -46,14 +46,9 @@ export function ScrollableSelectPreview() {
     right: 12,
   };
 
-  // Workaround for rn-primitives/select not opening on web-mobile
-  function onTouchStart() {
-    ref.current?.open();
-  }
-
   return (
     <Select>
-      <SelectTrigger ref={ref} className="w-[180px]" onTouchStart={Platform.select({ web: onTouchStart })}>
+      <SelectTrigger ref={ref} className="w-[180px]">
         <SelectValue placeholder="Select a fruit" />
       </SelectTrigger>
       <SelectContent insets={contentInsets} className="w-[180px]">
```

**File**: `packages/registry/src/examples/select/select.tsx` (modified, +1/-6)
```diff
@@ -30,14 +30,9 @@ export function SelectPreview() {
     right: 12,
   };
 
-  // Workaround for rn-primitives/select not opening on web-mobile
-  function onTouchStart() {
-    ref.current?.open();
-  }
-
   return (
     <Select>
-      <SelectTrigger ref={ref} className="w-[180px]" onTouchStart={Platform.select({ web: onTouchStart })}>
+      <SelectTrigger ref={ref} className="w-[180px]">
         <SelectValue placeholder="Select a fruit" />
       </SelectTrigger>
       <SelectContent insets={contentInsets} className="w-[180px]">
```

---

### Incident Patch 9: `983cd67b` (2026-03-14)
**Commit Message**: refactor(icon): integrate TextClassContext into icon component for consistent styling across UI elements and generate public registry jsons

**File**: `apps/docs/public/r/nativewind/context-menu.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/context-menu.tsx",
-      "content": "import { Icon } from '@/registry/nativewind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/nativewind/components/ui/native-only-animated-view';\nimport { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport * as ContextMenuPrimitive from '@rn-primitives/context-menu';\nimport { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';\nimport * as React from 'react';\nimport {\n  Platform,\n  type StyleProp,\n  StyleSheet,\n  Text,\n  type TextProps,\n  View,\n  type ViewStyle,\n} from 'react-native';\nimport { FadeIn } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst ContextMenu = ContextMenuPrimitive.Root;\nconst ContextMenuTrigger = ContextMenuPrimitive.Trigger;\nconst ContextMenuGroup = ContextMenuPrimitive.Group;\nconst ContextMenuSub = ContextMenuPrimitive.Sub;\nconst ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;\n\nfunction ContextMenuSubTrigger({\n  className,\n  inset,\n  children,\n  iconClassName,\n  ...props\n}: ContextMenuPrimitive.SubTriggerProps &\n  React.RefAttributes<ContextMenuPrimitive.SubTriggerRef> & {\n    children?: React.ReactNode;\n    iconClassName?: string;\n    inset?: boolean;\n  }) {\n  const { open } = ContextMenuPrimitive.useSubContext();\n  const icon = Platform.OS === 'web' ? ChevronRight : open ? ChevronUp : ChevronDown;\n  return (\n    <TextClassContext.Provider\n      value={cn(\n        'text-sm select-none group-active:text-accent-foreground',\n        open && 'text-accent-foreground'\n      )}>\n      <ContextMenuPrimitive.SubTrigger\n        className={cn(\n          'active:bg-accent group flex flex-row items-center rounded-sm px-2 py-2 sm:py-1.5',\n          Platform.select({\n            web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',\n          }),\n          open && cn('bg-accent', Platform.select({ native: 'mb-1' })),\n          inset && 'pl-8'\n        )}\n        {...props}>\n        <>{children}</>\n        <Icon as={icon} className={cn('text-foreground ml-auto size-4 shrink-0', iconClassName)} />\n      </ContextMenuPrimitive.SubTrigger>\n    </TextClassContext.Provider>\n  );\n}\n\nfunction ContextMenuSubContent({\n  className,\n  ...props\n}: ContextMenuPrimitive.SubContentProps & React.RefAttributes<ContextMenuPrimitive.SubContentRef>) {\n  return (\n    <NativeOnlyAnimatedView entering={FadeIn}>\n      <ContextMenuPrimitive.SubContent\n        className={cn(\n          'bg-popover border-border overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n          Platform.select({\n            web: 'animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fade-in-0 data-[state=closed]:zoom-out-95 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin) z-50 min-w-[8rem]',\n          }),\n          className\n        )}\n        {...props}\n      />\n    </NativeOnlyAnimatedView>\n  );\n}\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction ContextMenuContent({\n  className,\n  overlayClassName,\n  overlayStyle,\n  portalHost,\n  ...props\n}: ContextMenuPrimitive.ContentProps &\n  React.RefAttributes<ContextMenuPrimitive.ContentRef> & {\n    overlayStyle?: StyleProp<ViewStyle>;\n    overlayClassName?: string;\n    portalHost?: string;\n  }) {\n  return (\n    <ContextMenuPrimitive.Portal hostName={portalHost}>\n      <FullWindowOverlay>\n        <ContextMenuPrimitive.Overlay\n          style={Platform.select({\n            web: overlayStyle ?? undefined,\n            native: overlayStyle\n              ? StyleSheet.flatten([\n                  StyleSheet.absoluteFill,\n                  overlayStyle as typeof StyleSheet.absoluteFill,\n                ])\n              : StyleSheet.absoluteFill,\n          })}\n          className={overlayClassName}>\n          <NativeOnlyAnimatedView entering={FadeIn}>\n            <TextClassContext.Provider value=\"text-popover-foreground\">\n              <ContextMenuPrimitive.Content\n                className={cn(\n                  'bg-popover border-border min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n                  Platform.select({\n                    web: cn(\n                      'animate-in fade-in-0 zoom-in-95 max-h-(--radix-context-menu-content-available-height) origin-(--radix-context-menu-content-transform-origin) z-50 cursor-default',\n                      props.side === 'bottom' && 'slide-in-from-top-2',\n                
```

**File**: `apps/docs/public/r/nativewind/dropdown-menu.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/dropdown-menu.tsx",
-      "content": "import { Icon } from '@/registry/nativewind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/nativewind/components/ui/native-only-animated-view';\nimport { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport * as DropdownMenuPrimitive from '@rn-primitives/dropdown-menu';\nimport { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';\nimport * as React from 'react';\nimport {\n  Platform,\n  type StyleProp,\n  StyleSheet,\n  Text,\n  type TextProps,\n  View,\n  type ViewStyle,\n} from 'react-native';\nimport { FadeIn } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst DropdownMenu = DropdownMenuPrimitive.Root;\n\nconst DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;\n\nconst DropdownMenuGroup = DropdownMenuPrimitive.Group;\n\nconst DropdownMenuPortal = DropdownMenuPrimitive.Portal;\n\nconst DropdownMenuSub = DropdownMenuPrimitive.Sub;\n\nconst DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;\n\nfunction DropdownMenuSubTrigger({\n  className,\n  inset,\n  children,\n  iconClassName,\n  ...props\n}: DropdownMenuPrimitive.SubTriggerProps &\n  React.RefAttributes<DropdownMenuPrimitive.SubTriggerRef> & {\n    children?: React.ReactNode;\n    iconClassName?: string;\n    inset?: boolean;\n  }) {\n  const { open } = DropdownMenuPrimitive.useSubContext();\n  const icon = Platform.OS === 'web' ? ChevronRight : open ? ChevronUp : ChevronDown;\n  return (\n    <TextClassContext.Provider\n      value={cn(\n        'text-sm select-none group-active:text-accent-foreground',\n        open && 'text-accent-foreground'\n      )}>\n      <DropdownMenuPrimitive.SubTrigger\n        className={cn(\n          'active:bg-accent group flex flex-row items-center rounded-sm px-2 py-2 sm:py-1.5',\n          Platform.select({\n            web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',\n          }),\n          open && 'bg-accent',\n          inset && 'pl-8'\n        )}\n        {...props}>\n        <>{children}</>\n        <Icon as={icon} className={cn('text-foreground ml-auto size-4 shrink-0', iconClassName)} />\n      </DropdownMenuPrimitive.SubTrigger>\n    </TextClassContext.Provider>\n  );\n}\n\nfunction DropdownMenuSubContent({\n  className,\n  ...props\n}: DropdownMenuPrimitive.SubContentProps &\n  React.RefAttributes<DropdownMenuPrimitive.SubContentRef>) {\n  return (\n    <NativeOnlyAnimatedView entering={FadeIn}>\n      <DropdownMenuPrimitive.SubContent\n        className={cn(\n          'bg-popover border-border overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n          Platform.select({\n            web: 'animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fade-in-0 data-[state=closed]:zoom-out-95 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin) z-50 min-w-[8rem]',\n          }),\n          className\n        )}\n        {...props}\n      />\n    </NativeOnlyAnimatedView>\n  );\n}\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction DropdownMenuContent({\n  className,\n  overlayClassName,\n  overlayStyle,\n  portalHost,\n  ...props\n}: DropdownMenuPrimitive.ContentProps &\n  React.RefAttributes<DropdownMenuPrimitive.ContentRef> & {\n    overlayStyle?: StyleProp<ViewStyle>;\n    overlayClassName?: string;\n    portalHost?: string;\n  }) {\n  return (\n    <DropdownMenuPrimitive.Portal hostName={portalHost}>\n      <FullWindowOverlay>\n        <DropdownMenuPrimitive.Overlay\n          style={Platform.select({\n            web: overlayStyle ?? undefined,\n            native: overlayStyle\n              ? StyleSheet.flatten([\n                  StyleSheet.absoluteFill,\n                  overlayStyle as typeof StyleSheet.absoluteFill,\n                ])\n              : StyleSheet.absoluteFill,\n          })}\n          className={overlayClassName}>\n          <NativeOnlyAnimatedView entering={FadeIn}>\n            <TextClassContext.Provider value=\"text-popover-foreground\">\n              <DropdownMenuPrimitive.Content\n                className={cn(\n                  'bg-popover border-border min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n                  Platform.select({\n                    web: cn(\n                      'animate-in fade-in-0 zoom-in-95 max-h-(--radix-context-menu-content-available-height) origin-(--radix-context-menu-content-transform-origin) z-50 cursor-default',\n                      props.si
```

**File**: `apps/docs/public/r/nativewind/icon.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/icon.tsx",
-      "content": "import { cn } from '@/registry/nativewind/lib/utils';\nimport type { LucideIcon, LucideProps } from 'lucide-react-native';\nimport { cssInterop } from 'nativewind';\n\ntype IconProps = LucideProps & {\n  as: LucideIcon;\n};\n\nfunction IconImpl({ as: IconComponent, ...props }: IconProps) {\n  return <IconComponent {...props} />;\n}\n\ncssInterop(IconImpl, {\n  className: {\n    target: 'style',\n    nativeStyleToProp: {\n      height: 'size',\n      width: 'size',\n    },\n  },\n});\n\n/**\n * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.\n *\n * This component allows you to render any Lucide icon while applying utility classes\n * using `nativewind`. It avoids the need to wrap or configure each icon individually.\n *\n * @component\n * @example\n * ```tsx\n * import { ArrowRight } from 'lucide-react-native';\n * import { Icon } from '@/registry/components/ui/icon';\n *\n * <Icon as={ArrowRight} className=\"text-red-500\" size={16} />\n * ```\n *\n * @param {LucideIcon} as - The Lucide icon component to render.\n * @param {string} className - Utility classes to style the icon using Nativewind.\n * @param {number} size - Icon size (defaults to 14).\n * @param {...LucideProps} ...props - Additional Lucide icon props passed to the \"as\" icon.\n */\nfunction Icon({ as: IconComponent, className, size = 14, ...props }: IconProps) {\n  return (\n    <IconImpl\n      as={IconComponent}\n      className={cn('text-foreground', className)}\n      size={size}\n      {...props}\n    />\n  );\n}\n\nexport { Icon };\n",
+      "content": "import { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport type { LucideIcon, LucideProps } from 'lucide-react-native';\nimport { cssInterop } from 'nativewind';\nimport * as React from 'react';\n\ntype IconProps = LucideProps & {\n  as: LucideIcon;\n};\n\nfunction IconImpl({ as: IconComponent, ...props }: IconProps) {\n  return <IconComponent {...props} />;\n}\n\ncssInterop(IconImpl, {\n  className: {\n    target: 'style',\n    nativeStyleToProp: {\n      height: 'size',\n      width: 'size',\n    },\n  },\n});\n\n/**\n * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.\n *\n * This component allows you to render any Lucide icon while applying utility classes\n * using `nativewind`. It avoids the need to wrap or configure each icon individually.\n *\n * @component\n * @example\n * ```tsx\n * import { ArrowRight } from 'lucide-react-native';\n * import { Icon } from '@/registry/components/ui/icon';\n *\n * <Icon as={ArrowRight} className=\"text-red-500\" size={16} />\n * ```\n *\n * @param {LucideIcon} as - The Lucide icon component to render.\n * @param {string} className - Utility classes to style the icon using Nativewind.\n * @param {number} size - Icon size (defaults to 14).\n * @param {...LucideProps} ...props - Additional Lucide icon props passed to the \"as\" icon.\n */\nfunction Icon({ as: IconComponent, className, size = 14, ...props }: IconProps) {\n  const textClass = React.useContext(TextClassContext);\n  return (\n    <IconImpl\n      as={IconComponent}\n      className={cn('text-foreground', textClass, className)}\n      size={size}\n      {...props}\n    />\n  );\n}\n\nexport { Icon };\n",
       "type": "registry:ui"
     }
   ]
```

**File**: `apps/docs/public/r/nativewind/menubar.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/menubar.tsx",
-      "content": "import { Icon } from '@/registry/nativewind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/nativewind/components/ui/native-only-animated-view';\nimport { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport * as MenubarPrimitive from '@rn-primitives/menubar';\nimport { Portal } from '@rn-primitives/portal';\nimport { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';\nimport * as React from 'react';\nimport {\n  Platform,\n  Pressable,\n  type StyleProp,\n  StyleSheet,\n  Text,\n  type TextProps,\n  View,\n  type ViewStyle,\n} from 'react-native';\nimport { FadeIn } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst MenubarMenu = MenubarPrimitive.Menu;\n\nconst MenubarGroup = MenubarPrimitive.Group;\n\nconst MenubarPortal = MenubarPrimitive.Portal;\n\nconst MenubarSub = MenubarPrimitive.Sub;\n\nconst MenubarRadioGroup = MenubarPrimitive.RadioGroup;\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction Menubar({\n  className,\n  value: valueProp,\n  onValueChange: onValueChangeProp,\n  ...props\n}: MenubarPrimitive.RootProps & React.RefAttributes<MenubarPrimitive.RootRef>) {\n  const id = React.useId();\n  const [value, setValue] = React.useState<string | undefined>(undefined);\n\n  function closeMenu() {\n    if (onValueChangeProp) {\n      onValueChangeProp(undefined);\n      return;\n    }\n    setValue(undefined);\n  }\n\n  return (\n    <>\n      {Platform.OS !== 'web' && (value || valueProp) ? (\n        <Portal name={`menubar-overlay-${id}`}>\n          <Pressable onPress={closeMenu} style={StyleSheet.absoluteFill} />\n        </Portal>\n      ) : null}\n      <MenubarPrimitive.Root\n        className={cn(\n          'bg-background border-border flex h-10 flex-row items-center gap-1 rounded-md border p-1 shadow-sm shadow-black/5 sm:h-9',\n          className\n        )}\n        value={value ?? valueProp}\n        onValueChange={onValueChangeProp ?? setValue}\n        {...props}\n      />\n    </>\n  );\n}\n\nfunction MenubarTrigger({\n  className,\n  ...props\n}: MenubarPrimitive.TriggerProps & React.RefAttributes<MenubarPrimitive.TriggerRef>) {\n  const { value } = MenubarPrimitive.useRootContext();\n  const { value: itemValue } = MenubarPrimitive.useMenuContext();\n\n  return (\n    <TextClassContext.Provider\n      value={cn(\n        'text-sm font-medium select-none group-active:text-accent-foreground',\n        value === itemValue && 'text-accent-foreground'\n      )}>\n      <MenubarPrimitive.Trigger\n        className={cn(\n          'group flex items-center rounded-md px-2 py-1.5 sm:py-1',\n          Platform.select({\n            web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none',\n          }),\n          value === itemValue && 'bg-accent',\n          className\n        )}\n        {...props}\n      />\n    </TextClassContext.Provider>\n  );\n}\n\nfunction MenubarSubTrigger({\n  className,\n  inset,\n  children,\n  iconClassName,\n  ...props\n}: MenubarPrimitive.SubTriggerProps &\n  React.RefAttributes<MenubarPrimitive.SubTriggerRef> & {\n    children?: React.ReactNode;\n    iconClassName?: string;\n    inset?: boolean;\n  }) {\n  const { open } = MenubarPrimitive.useSubContext();\n  const icon = Platform.OS === 'web' ? ChevronRight : open ? ChevronUp : ChevronDown;\n  return (\n    <TextClassContext.Provider\n      value={cn(\n        'text-sm select-none group-active:text-accent-foreground',\n        open && 'text-accent-foreground'\n      )}>\n      <MenubarPrimitive.SubTrigger\n        className={cn(\n          'active:bg-accent group flex flex-row items-center rounded-sm px-2 py-2 sm:py-1.5',\n          Platform.select({\n            web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',\n          }),\n          open && 'bg-accent',\n          inset && 'pl-8'\n        )}\n        {...props}>\n        <>{children}</>\n        <Icon as={icon} className={cn('text-foreground ml-auto size-4 shrink-0', iconClassName)} />\n      </MenubarPrimitive.SubTrigger>\n    </TextClassContext.Provider>\n  );\n}\n\nfunction MenubarSubContent({\n  className,\n  ...props\n}: MenubarPrimitive.SubContentProps & React.RefAttributes<MenubarPrimitive.SubContentRef>) {\n  return (\n    <NativeOnlyAnimatedView entering={FadeIn}>\n      <MenubarPrimitive.SubContent\n        className={cn(\n          'bg-popover border-border overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n          Platform.select({\n            web: 'animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fade-in-0 data-[state=closed]:zoom-o
```

**File**: `apps/docs/public/r/nativewind/select.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/nativewind/components/ui/select.tsx",
-      "content": "import { Icon } from '@/registry/nativewind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/nativewind/components/ui/native-only-animated-view';\nimport { TextClassContext } from '@/registry/nativewind/components/ui/text';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport * as SelectPrimitive from '@rn-primitives/select';\nimport { Check, ChevronDown, ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native';\nimport * as React from 'react';\nimport { Platform, ScrollView, StyleSheet, View } from 'react-native';\nimport { FadeIn, FadeOut } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\ntype Option = SelectPrimitive.Option;\n\nconst Select = SelectPrimitive.Root;\n\nconst SelectGroup = SelectPrimitive.Group;\n\nfunction SelectValue({\n  ref,\n  className,\n  ...props\n}: SelectPrimitive.ValueProps &\n  React.RefAttributes<SelectPrimitive.ValueRef> & {\n    className?: string;\n  }) {\n  const { value } = SelectPrimitive.useRootContext();\n  return (\n    <SelectPrimitive.Value\n      ref={ref}\n      className={cn(\n        'text-foreground line-clamp-1 flex flex-row items-center gap-2 text-sm',\n        !value && 'text-muted-foreground',\n        className\n      )}\n      {...props}\n    />\n  );\n}\n\nfunction SelectTrigger({\n  ref,\n  className,\n  children,\n  size = 'default',\n  ...props\n}: SelectPrimitive.TriggerProps &\n  React.RefAttributes<SelectPrimitive.TriggerRef> & {\n    children?: React.ReactNode;\n    size?: 'default' | 'sm';\n  }) {\n  return (\n    <SelectPrimitive.Trigger\n      ref={ref}\n      className={cn(\n        'border-input dark:bg-input/30 dark:active:bg-input/50 bg-background flex h-10 flex-row items-center justify-between gap-2 rounded-md border px-3 py-2 shadow-sm shadow-black/5 sm:h-9',\n        Platform.select({\n          web: 'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:hover:bg-input/50 w-fit whitespace-nowrap text-sm outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0',\n        }),\n        props.disabled && 'opacity-50',\n        size === 'sm' && 'h-8 py-2 sm:py-1.5',\n        className\n      )}\n      {...props}>\n      <>{children}</>\n      <Icon as={ChevronDown} aria-hidden={true} className=\"text-muted-foreground size-4\" />\n    </SelectPrimitive.Trigger>\n  );\n}\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction SelectContent({\n  className,\n  children,\n  position = 'popper',\n  portalHost,\n  ...props\n}: SelectPrimitive.ContentProps &\n  React.RefAttributes<SelectPrimitive.ContentRef> & {\n    className?: string;\n    portalHost?: string;\n  }) {\n  return (\n    <SelectPrimitive.Portal hostName={portalHost}>\n      <FullWindowOverlay>\n        <SelectPrimitive.Overlay style={Platform.select({ native: StyleSheet.absoluteFill })}>\n          <TextClassContext.Provider value=\"text-popover-foreground\">\n            <NativeOnlyAnimatedView className=\"z-50\" entering={FadeIn} exiting={FadeOut}>\n              <SelectPrimitive.Content\n                className={cn(\n                  'bg-popover border-border relative z-50 min-w-[8rem] rounded-md border shadow-md shadow-black/5',\n                  Platform.select({\n                    web: cn(\n                      'animate-in fade-in-0 zoom-in-95 origin-(--radix-select-content-transform-origin) max-h-52 overflow-y-auto overflow-x-hidden',\n                      props.side === 'bottom' && 'slide-in-from-top-2',\n                      props.side === 'top' && 'slide-in-from-bottom-2'\n                    ),\n                    native: 'p-1',\n                  }),\n                  position === 'popper' &&\n                    Platform.select({\n                      web: cn(\n                        props.side === 'bottom' && 'translate-y-1',\n                        props.side === 'top' && '-translate-y-1'\n                      ),\n                    }),\n                  className\n                )}\n                position={position}\n                {...props}>\n                <SelectScrollUpButton />\n                <SelectPrimitive.Viewport\n                  className={cn(\n                    'p-1',\n                    position === 'popper' &&\n                      cn(\n                        'w-full',\n                        Platform.select({\n                          web: 'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',\n                        })\n                      )\n                  )}>\n                  {children}\n                
```

**File**: `apps/docs/public/r/uniwind/context-menu.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/uniwind/components/ui/context-menu.tsx",
-      "content": "import { Icon } from '@/registry/uniwind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/uniwind/components/ui/native-only-animated-view';\nimport { TextClassContext } from '@/registry/uniwind/components/ui/text';\nimport { cn } from '@/registry/uniwind/lib/utils';\nimport * as ContextMenuPrimitive from '@rn-primitives/context-menu';\nimport { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';\nimport * as React from 'react';\nimport {\n  Platform,\n  type StyleProp,\n  StyleSheet,\n  Text,\n  type TextProps,\n  View,\n  type ViewStyle,\n} from 'react-native';\nimport { FadeIn } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst ContextMenu = ContextMenuPrimitive.Root;\nconst ContextMenuTrigger = ContextMenuPrimitive.Trigger;\nconst ContextMenuGroup = ContextMenuPrimitive.Group;\nconst ContextMenuSub = ContextMenuPrimitive.Sub;\nconst ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;\n\nfunction ContextMenuSubTrigger({\n  className,\n  inset,\n  children,\n  iconClassName,\n  ...props\n}: ContextMenuPrimitive.SubTriggerProps &\n  React.RefAttributes<ContextMenuPrimitive.SubTriggerRef> & {\n    children?: React.ReactNode;\n    iconClassName?: string;\n    inset?: boolean;\n  }) {\n  const { open } = ContextMenuPrimitive.useSubContext();\n  const icon = Platform.OS === 'web' ? ChevronRight : open ? ChevronUp : ChevronDown;\n  return (\n    <TextClassContext.Provider\n      value={cn(\n        'text-sm select-none group-active:text-accent-foreground',\n        open && 'text-accent-foreground'\n      )}>\n      <ContextMenuPrimitive.SubTrigger\n        className={cn(\n          'active:bg-accent group flex flex-row items-center justify-between rounded-sm px-2 py-2 sm:py-1.5',\n          Platform.select({\n            web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',\n          }),\n          open && cn('bg-accent', Platform.select({ native: 'mb-1' })),\n          inset && 'pl-8'\n        )}\n        {...props}>\n        <>{children}</>\n        <Icon as={icon} className={cn('text-foreground size-4 shrink-0', iconClassName)} />\n      </ContextMenuPrimitive.SubTrigger>\n    </TextClassContext.Provider>\n  );\n}\n\nfunction ContextMenuSubContent({\n  className,\n  ...props\n}: ContextMenuPrimitive.SubContentProps & React.RefAttributes<ContextMenuPrimitive.SubContentRef>) {\n  return (\n    <NativeOnlyAnimatedView entering={FadeIn}>\n      <ContextMenuPrimitive.SubContent\n        className={cn(\n          'bg-popover border-border overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n          Platform.select({\n            web: 'animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fade-in-0 data-[state=closed]:zoom-out-95 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin) z-50 min-w-[8rem]',\n          }),\n          className\n        )}\n        {...props}\n      />\n    </NativeOnlyAnimatedView>\n  );\n}\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction ContextMenuContent({\n  className,\n  overlayClassName,\n  overlayStyle,\n  portalHost,\n  ...props\n}: ContextMenuPrimitive.ContentProps &\n  React.RefAttributes<ContextMenuPrimitive.ContentRef> & {\n    overlayStyle?: StyleProp<ViewStyle>;\n    overlayClassName?: string;\n    portalHost?: string;\n  }) {\n  return (\n    <ContextMenuPrimitive.Portal hostName={portalHost}>\n      <FullWindowOverlay>\n        <ContextMenuPrimitive.Overlay\n          style={Platform.select({\n            web: overlayStyle ?? undefined,\n            native: overlayStyle\n              ? StyleSheet.flatten([\n                  StyleSheet.absoluteFill,\n                  overlayStyle as typeof StyleSheet.absoluteFill,\n                ])\n              : StyleSheet.absoluteFill,\n          })}\n          className={overlayClassName}>\n          <NativeOnlyAnimatedView entering={FadeIn}>\n            <TextClassContext.Provider value=\"text-popover-foreground\">\n              <ContextMenuPrimitive.Content\n                className={cn(\n                  'bg-popover border-border min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n                  Platform.select({\n                    web: cn(\n                      'animate-in fade-in-0 zoom-in-95 max-h-(--radix-context-menu-content-available-height) origin-(--radix-context-menu-content-transform-origin) z-50 cursor-default',\n                      props.side === 'bottom' && 'slide-in-from-top-2',\n                      p
```

**File**: `apps/docs/public/r/uniwind/dropdown-menu.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/uniwind/components/ui/dropdown-menu.tsx",
-      "content": "import { Icon } from '@/registry/uniwind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/uniwind/components/ui/native-only-animated-view';\nimport { TextClassContext } from '@/registry/uniwind/components/ui/text';\nimport { cn } from '@/registry/uniwind/lib/utils';\nimport * as DropdownMenuPrimitive from '@rn-primitives/dropdown-menu';\nimport { Check, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';\nimport * as React from 'react';\nimport {\n  Platform,\n  type StyleProp,\n  StyleSheet,\n  Text,\n  type TextProps,\n  View,\n  type ViewStyle,\n} from 'react-native';\nimport { FadeIn } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst DropdownMenu = DropdownMenuPrimitive.Root;\n\nconst DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;\n\nconst DropdownMenuGroup = DropdownMenuPrimitive.Group;\n\nconst DropdownMenuPortal = DropdownMenuPrimitive.Portal;\n\nconst DropdownMenuSub = DropdownMenuPrimitive.Sub;\n\nconst DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;\n\nfunction DropdownMenuSubTrigger({\n  className,\n  inset,\n  children,\n  iconClassName,\n  ...props\n}: DropdownMenuPrimitive.SubTriggerProps &\n  React.RefAttributes<DropdownMenuPrimitive.SubTriggerRef> & {\n    children?: React.ReactNode;\n    iconClassName?: string;\n    inset?: boolean;\n  }) {\n  const { open } = DropdownMenuPrimitive.useSubContext();\n  const icon = Platform.OS === 'web' ? ChevronRight : open ? ChevronUp : ChevronDown;\n  return (\n    <TextClassContext.Provider\n      value={cn(\n        'text-sm select-none group-active:text-accent-foreground',\n        open && 'text-accent-foreground'\n      )}>\n      <DropdownMenuPrimitive.SubTrigger\n        className={cn(\n          'active:bg-accent group flex flex-row items-center justify-between rounded-sm px-2 py-2 sm:py-1.5',\n          Platform.select({\n            web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',\n          }),\n          open && 'bg-accent',\n          inset && 'pl-8'\n        )}\n        {...props}>\n        <>{children}</>\n        <Icon as={icon} className={cn('text-foreground size-4 shrink-0', iconClassName)} />\n      </DropdownMenuPrimitive.SubTrigger>\n    </TextClassContext.Provider>\n  );\n}\n\nfunction DropdownMenuSubContent({\n  className,\n  ...props\n}: DropdownMenuPrimitive.SubContentProps &\n  React.RefAttributes<DropdownMenuPrimitive.SubContentRef>) {\n  return (\n    <NativeOnlyAnimatedView entering={FadeIn}>\n      <DropdownMenuPrimitive.SubContent\n        className={cn(\n          'bg-popover border-border overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n          Platform.select({\n            web: 'animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fade-in-0 data-[state=closed]:zoom-out-95 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin) z-50 min-w-[8rem]',\n          }),\n          className\n        )}\n        {...props}\n      />\n    </NativeOnlyAnimatedView>\n  );\n}\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction DropdownMenuContent({\n  className,\n  overlayClassName,\n  overlayStyle,\n  portalHost,\n  ...props\n}: DropdownMenuPrimitive.ContentProps &\n  React.RefAttributes<DropdownMenuPrimitive.ContentRef> & {\n    overlayStyle?: StyleProp<ViewStyle>;\n    overlayClassName?: string;\n    portalHost?: string;\n  }) {\n  return (\n    <DropdownMenuPrimitive.Portal hostName={portalHost}>\n      <FullWindowOverlay>\n        <DropdownMenuPrimitive.Overlay\n          style={Platform.select({\n            web: overlayStyle ?? undefined,\n            native: overlayStyle\n              ? StyleSheet.flatten([\n                  StyleSheet.absoluteFill,\n                  overlayStyle as typeof StyleSheet.absoluteFill,\n                ])\n              : StyleSheet.absoluteFill,\n          })}\n          className={overlayClassName}>\n          <NativeOnlyAnimatedView entering={FadeIn}>\n            <TextClassContext.Provider value=\"text-popover-foreground\">\n              <DropdownMenuPrimitive.Content\n                className={cn(\n                  'bg-popover border-border min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-lg shadow-black/5',\n                  Platform.select({\n                    web: cn(\n                      'animate-in fade-in-0 zoom-in-95 max-h-(--radix-context-menu-content-available-height) origin-(--radix-context-menu-content-transform-origin) z-50 cursor-default',\n                      props.side === 
```

**File**: `apps/docs/public/r/uniwind/icon.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   "files": [
     {
       "path": "./node_modules/@rnr/registry/src/uniwind/components/ui/icon.tsx",
-      "content": "import { cn } from '@/registry/uniwind/lib/utils';\nimport type { LucideIcon, LucideProps } from 'lucide-react-native';\nimport { withUniwind } from 'uniwind';\n\ntype IconProps = LucideProps & {\n  as: LucideIcon;\n};\n\nfunction IconImpl({ as: IconComponent, ...props }: IconProps) {\n  return <IconComponent {...props} />;\n}\n\nconst StyledIcon = withUniwind(IconImpl, {\n  size: {\n    fromClassName: 'className',\n    styleProperty: 'width',\n  },\n  color: {\n    fromClassName: 'className',\n    styleProperty: 'color',\n  },\n});\n\n/**\n * A wrapper component for Lucide icons with Uniwind `className` support via `withUniwind`.\n *\n * This component allows you to render any Lucide icon while applying utility classes\n * using `uniwind`. It avoids the need to wrap or configure each icon individually.\n *\n * @component\n * @example\n * ```tsx\n * import { ArrowRight } from 'lucide-react-native';\n * import { Icon } from '@/registry/uniwind/registry/components/ui/icon';\n *\n * <Icon as={ArrowRight} className=\"text-red-500 size-4\" />\n * ```\n *\n * @param {LucideIcon} as - The Lucide icon component to render.\n * @param {string} className - Utility classes to style the icon using Uniwind.\n * @param {number} size - Icon size (overrides the size class).\n * @param {...LucideProps} ...props - Additional Lucide icon props passed to the \"as\" icon.\n */\nfunction Icon({ as: IconComponent, className, ...props }: IconProps) {\n  return (\n    <StyledIcon as={IconComponent} className={cn('text-foreground size-5', className)} {...props} />\n  );\n}\n\nexport { Icon };\n",
+      "content": "import { TextClassContext } from '@/registry/uniwind/components/ui/text';\nimport { cn } from '@/registry/uniwind/lib/utils';\nimport type { LucideIcon, LucideProps } from 'lucide-react-native';\nimport * as React from 'react';\nimport { withUniwind } from 'uniwind';\n\ntype IconProps = LucideProps & {\n  as: LucideIcon;\n};\n\nfunction IconImpl({ as: IconComponent, ...props }: IconProps) {\n  return <IconComponent {...props} />;\n}\n\nconst StyledIcon = withUniwind(IconImpl, {\n  size: {\n    fromClassName: 'className',\n    styleProperty: 'width',\n  },\n  color: {\n    fromClassName: 'className',\n    styleProperty: 'color',\n  },\n});\n\n/**\n * A wrapper component for Lucide icons with Uniwind `className` support via `withUniwind`.\n *\n * This component allows you to render any Lucide icon while applying utility classes\n * using `uniwind`. It avoids the need to wrap or configure each icon individually.\n *\n * @component\n * @example\n * ```tsx\n * import { ArrowRight } from 'lucide-react-native';\n * import { Icon } from '@/registry/uniwind/registry/components/ui/icon';\n *\n * <Icon as={ArrowRight} className=\"text-red-500 size-4\" />\n * ```\n *\n * @param {LucideIcon} as - The Lucide icon component to render.\n * @param {string} className - Utility classes to style the icon using Uniwind.\n * @param {number} size - Icon size (overrides the size class).\n * @param {...LucideProps} ...props - Additional Lucide icon props passed to the \"as\" icon.\n */\nfunction Icon({ as: IconComponent, className, ...props }: IconProps) {\n  const textClass = React.useContext(TextClassContext);\n  return (\n    <StyledIcon as={IconComponent} className={cn('text-foreground size-5', textClass, className)} {...props} />\n  );\n}\n\nexport { Icon };\n",
       "type": "registry:ui"
     }
   ]
```

---

### Incident Patch 10: `ef652204` (2026-03-14)
**Commit Message**: fix(#516): add className prop to context menu, dropdown menu, and menubar components for better styling flexibility

**File**: `packages/registry/src/nativewind/components/ui/context-menu.tsx` (modified, +4/-3)
```diff
@@ -49,6 +49,7 @@ function ContextMenuSubTrigger({
           Platform.select({
             web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',
           }),
+          className,
           open && cn('bg-accent', Platform.select({ native: 'mb-1' })),
           inset && 'pl-8'
         )}
@@ -102,9 +103,9 @@ function ContextMenuContent({
             web: overlayStyle ?? undefined,
             native: overlayStyle
               ? StyleSheet.flatten([
-                  StyleSheet.absoluteFill,
-                  overlayStyle as typeof StyleSheet.absoluteFill,
-                ])
+                StyleSheet.absoluteFill,
+                overlayStyle as typeof StyleSheet.absoluteFill,
+              ])
               : StyleSheet.absoluteFill,
           })}
           className={overlayClassName}>
```

**File**: `packages/registry/src/nativewind/components/ui/dropdown-menu.tsx` (modified, +4/-3)
```diff
@@ -55,6 +55,7 @@ function DropdownMenuSubTrigger({
           Platform.select({
             web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',
           }),
+          className,
           open && 'bg-accent',
           inset && 'pl-8'
         )}
@@ -109,9 +110,9 @@ function DropdownMenuContent({
             web: overlayStyle ?? undefined,
             native: overlayStyle
               ? StyleSheet.flatten([
-                  StyleSheet.absoluteFill,
-                  overlayStyle as typeof StyleSheet.absoluteFill,
-                ])
+                StyleSheet.absoluteFill,
+                overlayStyle as typeof StyleSheet.absoluteFill,
+              ])
               : StyleSheet.absoluteFill,
           })}
           className={overlayClassName}>
```

**File**: `packages/registry/src/nativewind/components/ui/menubar.tsx` (modified, +1/-4)
```diff
@@ -122,6 +122,7 @@ function MenubarSubTrigger({
           Platform.select({
             web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',
           }),
+          className,
           open && 'bg-accent',
           inset && 'pl-8'
         )}
@@ -155,17 +156,13 @@ function MenubarSubContent({
 
 function MenubarContent({
   className,
-  overlayClassName,
-  overlayStyle,
   portalHost,
   align = 'start',
   alignOffset = -4,
   sideOffset = 8,
   ...props
 }: MenubarPrimitive.ContentProps &
   React.RefAttributes<MenubarPrimitive.ContentRef> & {
-    overlayStyle?: StyleProp<ViewStyle>;
-    overlayClassName?: string;
     portalHost?: string;
   }) {
   return (
```

**File**: `packages/registry/src/uniwind/components/ui/context-menu.tsx` (modified, +4/-3)
```diff
@@ -49,6 +49,7 @@ function ContextMenuSubTrigger({
           Platform.select({
             web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',
           }),
+          className,
           open && cn('bg-accent', Platform.select({ native: 'mb-1' })),
           inset && 'pl-8'
         )}
@@ -102,9 +103,9 @@ function ContextMenuContent({
             web: overlayStyle ?? undefined,
             native: overlayStyle
               ? StyleSheet.flatten([
-                  StyleSheet.absoluteFill,
-                  overlayStyle as typeof StyleSheet.absoluteFill,
-                ])
+                StyleSheet.absoluteFill,
+                overlayStyle as typeof StyleSheet.absoluteFill,
+              ])
               : StyleSheet.absoluteFill,
           })}
           className={overlayClassName}>
```

**File**: `packages/registry/src/uniwind/components/ui/dropdown-menu.tsx` (modified, +4/-3)
```diff
@@ -55,6 +55,7 @@ function DropdownMenuSubTrigger({
           Platform.select({
             web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',
           }),
+          className,
           open && 'bg-accent',
           inset && 'pl-8'
         )}
@@ -109,9 +110,9 @@ function DropdownMenuContent({
             web: overlayStyle ?? undefined,
             native: overlayStyle
               ? StyleSheet.flatten([
-                  StyleSheet.absoluteFill,
-                  overlayStyle as typeof StyleSheet.absoluteFill,
-                ])
+                StyleSheet.absoluteFill,
+                overlayStyle as typeof StyleSheet.absoluteFill,
+              ])
               : StyleSheet.absoluteFill,
           })}
           className={overlayClassName}>
```

**File**: `packages/registry/src/uniwind/components/ui/menubar.tsx` (modified, +1/-0)
```diff
@@ -122,6 +122,7 @@ function MenubarSubTrigger({
           Platform.select({
             web: 'focus:bg-accent focus:text-accent-foreground cursor-default outline-none [&_svg]:pointer-events-none',
           }),
+          className,
           open && 'bg-accent',
           inset && 'pl-8'
         )}
```

**File**: `packages/registry/src/uniwind/components/ui/select.tsx` (modified, +1/-2)
```diff
@@ -146,9 +146,8 @@ function SelectLabel({
 
 function SelectItem({
   className,
-  children,
   ...props
-}: SelectPrimitive.ItemProps & React.RefAttributes<SelectPrimitive.ItemRef>) {
+}: Omit<SelectPrimitive.ItemProps, "children"> & React.RefAttributes<SelectPrimitive.ItemRef>) {
   return (
     <SelectPrimitive.Item
       className={cn(
```

---

### Incident Patch 11: `f7891c42` (2026-03-14)
**Commit Message**: fix(#424): select scrollable component for all platforms

**File**: `apps/docs/content/docs/components/select.mdx` (modified, +21/-0)
```diff
@@ -11,6 +11,8 @@ import { Tabs, TabsContent, TabsList, TabsTrigger } from "@docs/components/ui/ta
 import { SelectPreview, ScrollableSelectPreview } from "@docs/components/examples";
 import { Step, Steps } from 'fumadocs-ui/components/steps';
 import { StylingLibraryTabs, StylingLibraryTabsNativewindContent, StylingLibraryTabsUnwindContent } from '@docs/components/styling-library-tabs';
+import { Callout } from '@docs/components/callout';
+import Link from 'next/link';
 
 <ExternalLinks
   links={[
@@ -209,6 +211,25 @@ import {
 
 #### Scrollable
 
+<Callout type="warn" title="React Native Gesture Handler Required">
+  Install {' '}<Link target="_blank" href="https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation#setup" className="hover:underline"><code className="bg-muted rounded-sm px-1 py-0.5 text-[0.813rem]">react-native-gesture-handler</code></Link>{' '}
+  to your project and add the following `NativeSelectScrollView` component to your `@/components/ui/select.tsx` file or the file using the scrollable select.
+</Callout>
+
+```tsx
+import { ScrollView } from 'react-native-gesture-handler';
+/**
+ * @platform Native only
+ * Returns the children on the web
+ */
+function NativeSelectScrollView({ className, ...props }: React.ComponentProps<typeof ScrollView>) {
+  if (Platform.OS === 'web') {
+    return <>{props.children}</>;
+  }
+  return <ScrollView className={cn('max-h-52', className)} {...props} />;
+}
+```
+
 <Tabs defaultValue="preview">
   <TabsList>
     <TabsTrigger value="preview">Preview</TabsTrigger>
```

**File**: `apps/showcase/app/_layout.tsx` (modified, +4/-1)
```diff
@@ -11,6 +11,7 @@ import * as SplashScreen from 'expo-splash-screen';
 import { StatusBar } from 'expo-status-bar';
 import { useColorScheme } from 'nativewind';
 import * as React from 'react';
+import { Platform } from 'react-native';
 import { GestureHandlerRootView } from 'react-native-gesture-handler';
 import { KeyboardProvider } from 'react-native-keyboard-controller';
 
@@ -64,7 +65,9 @@ export default function RootLayout() {
                 headerLargeTitle: true,
                 headerTitle: 'Showcase',
                 headerLargeTitleShadowVisible: false,
-                headerTransparent: true,
+                headerShadowVisible: false,
+                headerTransparent: Platform.OS === 'ios',
+
               }}
             />
           </Stack>
```

**File**: `packages/registry/src/examples/select/scrollable-select.tsx` (modified, +15/-3)
```diff
@@ -1,5 +1,4 @@
 import {
-  NativeSelectScrollView,
   Select,
   SelectContent,
   SelectGroup,
@@ -8,9 +7,11 @@ import {
   SelectTrigger,
   SelectValue,
 } from '@/registry/nativewind/components/ui/select';
+import { cn } from '@/registry/nativewind/lib/utils';
 import type { TriggerRef } from '@rn-primitives/select';
 import * as React from 'react';
 import { Platform } from 'react-native';
+import { ScrollView } from 'react-native-gesture-handler';
 import { useSafeAreaInsets } from 'react-native-safe-area-context';
 
 const fruits = [
@@ -45,14 +46,14 @@ export function ScrollableSelectPreview() {
     right: 12,
   };
 
-  // Workaround for rn-primitives/select not opening on mobile
+  // Workaround for rn-primitives/select not opening on web-mobile
   function onTouchStart() {
     ref.current?.open();
   }
 
   return (
     <Select>
-      <SelectTrigger ref={ref} className="w-[180px]" onTouchStart={onTouchStart}>
+      <SelectTrigger ref={ref} className="w-[180px]" onTouchStart={Platform.select({ web: onTouchStart })}>
         <SelectValue placeholder="Select a fruit" />
       </SelectTrigger>
       <SelectContent insets={contentInsets} className="w-[180px]">
@@ -70,3 +71,14 @@ export function ScrollableSelectPreview() {
     </Select>
   );
 }
+
+/**
+ * @platform Native only
+ * Returns the children on the web
+ */
+function NativeSelectScrollView({ className, ...props }: React.ComponentProps<typeof ScrollView>) {
+  if (Platform.OS === 'web') {
+    return <>{props.children}</>;
+  }
+  return <ScrollView className={cn('max-h-52', className)} {...props} />;
+}
\ No newline at end of file
```

**File**: `packages/registry/src/examples/select/select.tsx` (modified, +2/-2)
```diff
@@ -30,14 +30,14 @@ export function SelectPreview() {
     right: 12,
   };
 
-  // Workaround for rn-primitives/select not opening on mobile
+  // Workaround for rn-primitives/select not opening on web-mobile
   function onTouchStart() {
     ref.current?.open();
   }
 
   return (
     <Select>
-      <SelectTrigger ref={ref} className="w-[180px]" onTouchStart={onTouchStart}>
+      <SelectTrigger ref={ref} className="w-[180px]" onTouchStart={Platform.select({ web: onTouchStart })}>
         <SelectValue placeholder="Select a fruit" />
       </SelectTrigger>
       <SelectContent insets={contentInsets} className="w-[180px]">
```

**File**: `packages/registry/src/nativewind/components/ui/select.tsx` (modified, +14/-24)
```diff
@@ -5,7 +5,7 @@ import { cn } from '@/registry/nativewind/lib/utils';
 import * as SelectPrimitive from '@rn-primitives/select';
 import { Check, ChevronDown, ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native';
 import * as React from 'react';
-import { Platform, ScrollView, StyleSheet, View } from 'react-native';
+import { Platform, StyleSheet, View } from 'react-native';
 import { FadeIn, FadeOut } from 'react-native-reanimated';
 import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';
 
@@ -98,12 +98,12 @@ function SelectContent({
                     native: 'p-1',
                   }),
                   position === 'popper' &&
-                    Platform.select({
-                      web: cn(
-                        props.side === 'bottom' && 'translate-y-1',
-                        props.side === 'top' && '-translate-y-1'
-                      ),
-                    }),
+                  Platform.select({
+                    web: cn(
+                      props.side === 'bottom' && 'translate-y-1',
+                      props.side === 'top' && '-translate-y-1'
+                    ),
+                  }),
                   className
                 )}
                 position={position}
@@ -113,12 +113,12 @@ function SelectContent({
                   className={cn(
                     'p-1',
                     position === 'popper' &&
-                      cn(
-                        'w-full',
-                        Platform.select({
-                          web: 'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',
-                        })
-                      )
+                    cn(
+                      'w-full',
+                      Platform.select({
+                        web: 'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',
+                      })
+                    )
                   )}>
                   {children}
                 </SelectPrimitive.Viewport>
@@ -226,19 +226,9 @@ function SelectScrollDownButton({
   );
 }
 
-/**
- * @platform Native only
- * Returns the children on the web
- */
-function NativeSelectScrollView({ className, ...props }: React.ComponentProps<typeof ScrollView>) {
-  if (Platform.OS === 'web') {
-    return <>{props.children}</>;
-  }
-  return <ScrollView className={cn('max-h-52', className)} {...props} />;
-}
+
 
 export {
-  NativeSelectScrollView,
   Select,
   SelectContent,
   SelectGroup,
```

**File**: `packages/registry/src/new-york/components/ui/select.tsx` (modified, +13/-23)
```diff
@@ -98,12 +98,12 @@ function SelectContent({
                     native: 'p-1',
                   }),
                   position === 'popper' &&
-                    Platform.select({
-                      web: cn(
-                        props.side === 'bottom' && 'translate-y-1',
-                        props.side === 'top' && '-translate-y-1'
-                      ),
-                    }),
+                  Platform.select({
+                    web: cn(
+                      props.side === 'bottom' && 'translate-y-1',
+                      props.side === 'top' && '-translate-y-1'
+                    ),
+                  }),
                   className
                 )}
                 position={position}
@@ -113,12 +113,12 @@ function SelectContent({
                   className={cn(
                     'p-1',
                     position === 'popper' &&
-                      cn(
-                        'w-full',
-                        Platform.select({
-                          web: 'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',
-                        })
-                      )
+                    cn(
+                      'w-full',
+                      Platform.select({
+                        web: 'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',
+                      })
+                    )
                   )}>
                   {children}
                 </SelectPrimitive.Viewport>
@@ -226,19 +226,9 @@ function SelectScrollDownButton({
   );
 }
 
-/**
- * @platform Native only
- * Returns the children on the web
- */
-function NativeSelectScrollView({ className, ...props }: React.ComponentProps<typeof ScrollView>) {
-  if (Platform.OS === 'web') {
-    return <>{props.children}</>;
-  }
-  return <ScrollView className={cn('max-h-52', className)} {...props} />;
-}
+
 
 export {
-  NativeSelectScrollView,
   Select,
   SelectContent,
   SelectGroup,
```

**File**: `packages/registry/src/uniwind/components/ui/select.tsx` (modified, +12/-23)
```diff
@@ -98,12 +98,12 @@ function SelectContent({
                     native: 'p-1',
                   }),
                   position === 'popper' &&
-                    Platform.select({
-                      web: cn(
-                        props.side === 'bottom' && 'translate-y-1',
-                        props.side === 'top' && '-translate-y-1'
-                      ),
-                    }),
+                  Platform.select({
+                    web: cn(
+                      props.side === 'bottom' && 'translate-y-1',
+                      props.side === 'top' && '-translate-y-1'
+                    ),
+                  }),
                   className
                 )}
                 position={position}
@@ -113,12 +113,12 @@ function SelectContent({
                   className={cn(
                     'p-1',
                     position === 'popper' &&
-                      cn(
-                        'w-full',
-                        Platform.select({
-                          web: 'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',
-                        })
-                      )
+                    cn(
+                      'w-full',
+                      Platform.select({
+                        web: 'h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]',
+                      })
+                    )
                   )}>
                   {children}
                 </SelectPrimitive.Viewport>
@@ -226,19 +226,8 @@ function SelectScrollDownButton({
   );
 }
 
-/**
- * @platform Native only
- * Returns the children on the web
- */
-function NativeSelectScrollView({ className, ...props }: React.ComponentProps<typeof ScrollView>) {
-  if (Platform.OS === 'web') {
-    return <>{props.children}</>;
-  }
-  return <ScrollView className={cn('max-h-52', className)} {...props} />;
-}
 
 export {
-  NativeSelectScrollView,
   Select,
   SelectContent,
   SelectGroup,
```

---

### Incident Patch 12: `b4806c42` (2026-01-20)
**Commit Message**: fix(docs): add missing component for manual installtion dialog component

**File**: `apps/docs/content/docs/components/dialog.mdx` (modified, +10/-0)
```diff
@@ -91,6 +91,16 @@ import { StylingLibraryTabs, StylingLibraryTabsNativewindContent, StylingLibrary
             }
           }
           ```
+
+          ```json doc-gen:file
+          {
+            "file": "./node_modules/@rnr/registry/src/nativewind/components/ui/native-only-animated-view.tsx",
+            "codeblock": {
+              "lang": "tsx",
+              "meta": "title=\"@/components/ui/native-only-animated-view.tsx\""
+            }
+          }
+          ```
           
           ```json doc-gen:file
           {
```

---

### Incident Patch 13: `f4fa3a04` (2026-01-17)
**Commit Message**: fix(docs): update Button component to include Text

**File**: `apps/docs/content/docs/installation/index.mdx` (modified, +6/-1)
```diff
@@ -41,9 +41,14 @@ You can now start adding components to your app.
 
 ```tsx title="index.tsx"
   import { Button } from '@/components/ui/button';
+  import { Text } from '@/components/ui/text';
 
   export default function Screen() {
-    return <Button>Click me</Button>;
+    return (
+      <Button>
+        <Text>Click me</Text>
+      </Button>
+    );
   }
 ```
 
```

---

### Incident Patch 14: `f770d998` (2026-01-17)
**Commit Message**: fix(docs): update yarn command in command-tabs to use npx

**File**: `apps/docs/components/command-tabs.tsx` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ const COMMAND: Record<(typeof MANAGERS)[number], string[]> = {
   npm: ['npx'],
   bun: ['bunx', '--bun'],
   pnpm: ['pnpm', 'dlx'],
-  yarn: ['yarn'],
+  yarn: ['npx'],
   'yarn@berry': ['yarn', 'dlx'],
 };
 
```

---

### Incident Patch 15: `ed315c33` (2026-01-17)
**Commit Message**: fix(505): always prompt for components.json file creation + only prompt for tailwind config when using nativewind

**File**: `apps/cli/src/services/project-config.ts` (modified, +4/-4)
```diff
@@ -119,9 +119,7 @@ class ProjectConfig extends Effect.Service<ProjectConfig>()("ProjectConfig", {
         yield* Effect.logWarning(
           `${exists ? "Invalid components.json" : "Missing components.json"}${" (required to continue)"}`
         )
-        const agreeToWrite = options.yes
-          ? true
-          : yield* Prompt.confirm({
+        const agreeToWrite =  yield* Prompt.confirm({
               message: `Would you like to ${exists ? "update the" : "write a"} components.json file?`,
               label: { confirm: "y", deny: "n" },
               initial: true,
@@ -157,9 +155,11 @@ class ProjectConfig extends Effect.Service<ProjectConfig>()("ProjectConfig", {
                 message: "What is the name of the CSS file and path to it? (e.g. global.css or src/global.css)",
                 default: detectedCss
               })
+        
+        const stylingLibrary = yield* getStylingLibrary()
 
         const hasTailwindConfig = yield* fs.exists(path.join(options.cwd, "tailwind.config.js"))
-        const tailwindConfig =
+        const tailwindConfig = stylingLibrary === "uniwind" ? "" :
           options.yes && hasTailwindConfig
             ? "tailwind.config.js"
             : yield* Prompt.text({
```

#### Recent Merged Pull Requests:
- **PR #543** (2026-06-19): chore(deps): update dependencies across multiple packages to latest versions, including React, Expo, and related libraries (@mrzachnugent)
- **PR #541** (2026-06-19): Fix dialog overlay press on mobile web (@badabadabing)
- **PR #540** (2026-06-01): feat(docs): add figma kit details to docs (@Amirthananth)
- **PR #537** (2026-05-02): feat(#533): update clerk blocks to use clerk v3 + enhance component ref types (@mrzachnugent)
- **PR #527** (closed): fix(separator): use border instead of background for web (@ekkoitac)
- **PR #524** (2026-03-28): chore: update `rn-primitives` (@mrzachnugent)
- **PR #523** (2026-03-14): Update Expo SDK, improve scrolling, and enhance component styling library selection (@mrzachnugent)
- **PR #522** (2026-03-14): make icon color use the TextClassContext (@dgrcode)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
