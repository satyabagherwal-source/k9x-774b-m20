# Forensic Learning Record (Deep Inspection): founded-labs/react-native-reusables

> **Canonical Artifact**: `07_PROJECT_LEARNING/founded-labs-react-native-reusables-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/founded-labs/react-native-reusables](https://github.com/founded-labs/react-native-reusables))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:45:28.423Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `founded-labs/react-native-reusables`
- **Description**: Bringing shadcn/ui to React Native. Beautifully crafted components with Nativewind/Uniwind, open source, and almost as easy to use.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8674 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `apps/cli/src/project-manifest.ts`
```
interface FileCheck {
  name: string
  fileNames: Array<string>
  docs: string
  includes: Array<{
    content: Array<string>
    message: string
    docs: string
  }>
  stylingLibraries: Array<"nativewind" | "uniwind">
}

type CustomFileCheck = Omit<FileCheck, "fileNames"> & { defaultFileNames?: ReadonlyArray<string> }

interface FileWithContent extends FileCheck {
  content: string
}

interface MissingInclude {
  fileName: string
  content: ReadonlyArray<string>
  message: string
  docs: string
}

const CORE_DEPENDENCIES = [
  "expo",
  "react-native-reanimated",
  "react-native-safe-area-context",
  "tailwindcss-animate",
  "class-variance-authority",
  "clsx",
  "tailwind-merge"
]

const DEPENDENCIES = {
  nativewind: [...CORE_DEPENDENCIES, "nativewind"],
  uniwind: [...CORE_DEPENDENCIES, "uniwind"]
}

const DEV_DEPENDENCIES = ["tailwindcss@^3.4.14"]

const FILE_CHECKS: Array<FileCheck> = [
  {
    name: "Babel Config",
    fileNames: ["babel.config.js", "babel.config.ts"],
    docs: "https://www.nativewind.dev/docs/getting-started/installation#3-add-the-babel-preset",
    includes: [
      {
        content: ["nativewind/babel", "jsxImportSource"],
        message: "jsxImportSource or nativewind/babel is missing",
        docs: "https://www.nativewind.dev/docs/getting-started/installation#3-add-the-babel-preset"
      }
    ],
    stylingLibraries: ["nativewind"] as const
  },
  {
    name: "Metro Config",
    fileNames: ["metro.config.js", "metro.config.ts", "metro.config.cjs"],
    docs: "https://www.nativewind.dev/docs/getting-started/installation#4-create-or-modify-your-metroconfigjs",
    includes: [
      {
        content: ["withNativeWind("],
        message: "The withNativeWind function is missing",
        docs: "https://www.nativewind.dev/docs/getting-started/installation#4-create-or-modify-your-metroconfigjs"
      },
      {
        content: ["inlineRem", "16"],
        message: "The 'inlineRem: 16' is missing",
        docs: "https://reactnativereusables.com/docs/installation/manual#update-the-default-inlined-rem-value"
      }
    ],
    stylingLibraries: ["nativewind"] as const
  },
  {
    name: "Metro Config",
    fileNames: ["metro.config.js", "metro.config.ts", "metro.config.cjs"],
    docs: "https://www.nativewind.dev/docs/getting-started/installation#4-create-or-modify-your-metroconfigjs",
    includes: [
      {
        content: ["withUniwindConfig("],
        message: "The withUniwindConfig function is missing",
        docs: "https://docs.uniwind.dev/api/metro-config#metro-config-js"
      }
    ],
    stylingLibraries: ["uniwind"] as const
  },
  {
    name: "Root Layout",
    fileNames: ["app/_layout.tsx", "src/app/_layout.tsx"],
    docs: "https://reactnativereusables.com/docs/installation/manual#add-the-portal-host-to-your-root-layout", //
    includes: [
      {
        content: [".css"],
        message: "The css file import is missing",
        docs: "https://www.nativewind.dev/docs/getting-started/installation#5-import-your-css-file"
      },
      {
        content: ["<PortalHost"],
        message: "The PortalHost component is missing",
        docs: "https://reactnativereusables.com/docs/installation/manual#add-the-portal-host-to-your-root-layout"
      }
    ],
    stylingLibraries: ["nativewind", "uniwind"] as const
  }
]

const DEPRECATED_FROM_LIB: Array<Omit<FileCheck, "docs" | "stylingLibraries">> = [
  {
    name: "Icons",
    fileNames: ["icons/iconWithClassName.ts"],
    includes: [
      {
        content: ["iconWithClassName"],
        message: "lib/icons and its contents are deprecated. Use the new icon wrapper from components/ui/icon.",
        docs: "https://reactnativereusables.com/docs/changelog#august-2025-deprecated"
      }
    ]
  },
  {
    name: "Constants",
    fileNames: ["constants.ts"],
    includes: [
      {
        content: ["NAV_THEME"],
        message: "Usage of lib/constants for NAV_THEME is deprecated. Use lib/theme instead.",
        docs: "https://reactnativereusables.com/docs/installation/manual#configure-your-styles"
      }
    ]
  },
  {
    name: "useColorScheme",
    fileNames: ["useColorScheme.tsx"],
    includes: [
      {
        content: ["useColorScheme"],
        message: "lib/useColorScheme is deprecated. Use Nativewind's color scheme hook instead.",
        docs: "https://www.nativewind.dev/docs/api/use-color-scheme"
      }
    ]
  }
]

const DEPRECATED_FROM_UI: Array<Omit<FileCheck, "docs" | "stylingLibraries">> = [
  {
    name: "Typography",
    fileNames: ["typography.tsx"],
    includes: [
      {
        content: [
          "function H1({",
          "function H2({",
          "function H3({",
          "function H4({",
          "function P({",
          "function BlockQuote({",
          "function Code({",
          "function Lead({",
          "function Large({",
          "function Small({",
          "function Muted({"
        ],
        message:
          "Typography is deprecated. Instead, use the Text component with its variant prop (e.g. <Text variant='h1'>Title</Text>)",
        docs: "https://reactnativereusables.com/docs/components/text#typography"
      }
    ]
  }
]

// Excludes foreground colors since it is formatted differently in all 3 styling files (tailwind config, global.css, theme.ts)
const CSS_VARIABLE_NAMES = [
  "background",
  "foreground",
  "card",
  "popover",
  "primary",
  "secondary",
  "muted",
  "accent",
  "destructive",
  "border",
  "input",
  "ring",
  "radius"
]

const CUSTOM_FILE_CHECKS: Record<string, CustomFileCheck> = {
  tailwindConfig: {
    name: "Tailwind Config",
    defaultFileNames: ["tailwind.config.js", "tailwind.config.ts"],
    docs: "https://reactnativereusables.com/docs/installation/manual#configure-your-styles",
    includes: [
      {
        content: ["nativewind/preset"],
        message: "The nativewind preset is missing",
        docs: "https://www.nativewind.dev/docs/getting-started/installation#2-setup-tailwind-css"
      },
      {
        content: CSS_VARIABLE_NAMES,
        message: "At least one of the color css variables is missing",
        docs: "https://reactnativereusables.com/docs/installation/manual#configure-your-styles"
      }
    ],
    stylingLibraries: ["nativewind"] as const
  },
  theme: {
    name: "Theme",
    defaultFileNames: ["lib/theme.ts"],
    docs: "https://reactnativereusables.com/docs/installation/manual#configure-your-styles",
    includes: [
      {
        content: CSS_VARIABLE_NAMES,
        message: "At least one of the color variables is missing",
        docs: "https://reactnativereusables.com/docs/installation/manual#configure-your-styles"
      },
      {
        content: ["NAV_THEME"],
        message: "The NAV_THEME is missing",
        docs: "https://reactnativereusables.com/docs/installation/manual#configure-your-styles"
      }
    ],
    stylingLibraries: ["nativewind", "uniwind"] as const
  },
  nativewindEnv: {
    name: "Nativewind Env",
    docs: "https://www.nativewind.dev/docs/getting-started/installation#7-typescript-setup-optional",
    includes: [
      {
        content: ["nativewind/types"],
        message: "The nativewind types are missing",
        docs: "https://www.nativewind.dev/docs/getting-started/installation#7-typescript-setup-optional"
      }
    ],
    stylingLibraries: ["nativewind"] as const
  },
  uniwindTypes: {
    name: "Uniwind Types",
    defaultFileNames: ["uniwind-types.d.ts"],
    docs: "https://docs.uniwind.dev/api/metro-config#dtsfile",
    includes: [
      {
        content: ["uniwind/types"],
        message: "The uniwind types are missing",
        docs: "https://docs.uniwind.dev/api/metro-config#dtsfile"
      }
    ],
    stylingLibraries: ["uniwind"] as const
  },
  utils: {
    name: "Utils",
    defaultFileNames: ["lib/utils.ts"],
    docs: "https://reactnativereusables.com/docs/installation/manual#add-a-cn-helper",
    includes: [
      {
        content: ["function cn("],
        message: "The cn fu
```

### Core Architecture Module: `apps/cli/src/services/commands/add.ts`
```
import { CliOptions, type StylingLibrary } from "@cli/contexts/cli-options.js"
import { PROJECT_MANIFEST } from "@cli/project-manifest.js"
import { Doctor } from "@cli/services/commands/doctor.js"
import { runCommand } from "@cli/utils/run-command.js"
import { Prompt } from "@effect/cli"
import { Effect, Layer } from "effect"
import { PackageManager } from "../package-manager.js"
import { ProjectConfig } from "../project-config.js"

type AddOptions = {
  cwd: string
  args: { components: Array<string> }
  yes: boolean
  overwrite: boolean
  all: boolean
  path: string
  stylingLibrary: StylingLibrary | undefined
}

class Add extends Effect.Service<Add>()("Add", {
  dependencies: [PackageManager.Default],
  effect: Effect.gen(function* () {
    const doctor = yield* Doctor
    const projectConfig = yield* ProjectConfig
    const packageManager = yield* PackageManager

    return {
      run: (options: AddOptions) =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`Add options: ${JSON.stringify(options, null, 2)}`)

          yield* projectConfig.getComponentJson() // ensure components.json config is valid and prompt if not

          const components = options.all ? PROJECT_MANIFEST.components : (options.args?.components ?? [])

          if (components.length === 0) {
            const selectedComponents = yield* Prompt.multiSelect({
              message: "Select components to add",
              choices: PROJECT_MANIFEST.components.map((component) => ({
                title: component,
                value: component
              }))
            })
            for (const component of selectedComponents) {
              components.push(component)
            }
          }

          if (components.length === 0) {
            yield* Effect.fail(new Error("No components selected."))
          }

          yield* Effect.logDebug(`Selected components: ${components.join(", ")}`)

          const stylingLibrary = yield* projectConfig.getStylingLibrary()

          const registry = stylingLibrary === "uniwind" ? "uniwind" : "nativewind"

          const baseUrl =
            process.env.INTERNAL_ENV === "development"
              ? `http://localhost:3000/local/r/${registry}`
              : `https://reactnativereusables.com/r/${registry}`

          const componentUrls = components.map((component) => {
            const lowerCaseComponent = component.toLocaleLowerCase()
            return lowerCaseComponent.startsWith("http") ? lowerCaseComponent : `${baseUrl}/${lowerCaseComponent}.json`
          })

          const shadcnOptions = toShadcnOptions(options)

          const binaryRunner = yield* packageManager.getBinaryRunner(options.cwd)

          const commandArgs = [
            ...binaryRunner.slice(1),
            "shadcn@latest",
            "add",
            ...shadcnOptions,
            ...componentUrls
          ].filter((option) => option !== undefined)

          yield* Effect.logDebug(`Running command: ${binaryRunner[0]} ${commandArgs.join(" ")}`)

          yield* runCommand(binaryRunner[0], commandArgs, {
            cwd: options.cwd,
            stdio: "inherit"
          })

          yield* doctor.run({ ...options, summary: true })
        })
    }
  })
}) {}

function make(options: AddOptions) {
  const optionsLayer = Layer.succeed(CliOptions, { ...options, yes: true }) // For the project config
  return Effect.gen(function* () {
    const add = yield* Add

    return yield* add.run(options)
  }).pipe(
    Effect.provide(Add.Default),
    Effect.provide(Doctor.Default),
    Effect.provide(ProjectConfig.Default),
    Effect.provide(optionsLayer)
  )
}

export { make }

function toShadcnOptions(options: AddOptions) {
  const shadcnOptions = []

  if (options.overwrite) {
    shadcnOptions.push("--overwrite")
  }

  if (options.yes) {
    shadcnOptions.push("--yes")
  }

  if (options.path) {
    shadcnOptions.push("--path")
    shadcnOptions.push(options.path)
  }

  return shadcnOptions
}

```

### Core Architecture Module: `apps/cli/src/services/commands/doctor.ts`
```
import { CliOptions } from "@cli/contexts/cli-options.js"
import { type CustomFileCheck, type FileCheck, type MissingInclude, PROJECT_MANIFEST } from "@cli/project-manifest.js"
import { ProjectConfig } from "@cli/services/project-config.js"
import { RequiredFilesChecker } from "@cli/services/required-files-checker.js"
import { Spinner } from "@cli/services/spinner.js"
import { runCommand } from "@cli/utils/run-command.js"
import { Prompt } from "@effect/cli"
import { FileSystem, Path } from "@effect/platform"
import { Data, Effect, Layer, Schema } from "effect"
import logSymbols from "log-symbols"

const packageJsonSchema = Schema.Struct({
  dependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  devDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String }))
})

class PackageJsonError extends Data.TaggedError("PackageJsonError")<{
  cause?: unknown
  message?: string
}> {}

type DoctorOptions = {
  cwd: string
  summary: boolean
  yes: boolean
}

class Doctor extends Effect.Service<Doctor>()("Doctor", {
  dependencies: [RequiredFilesChecker.Default, Spinner.Default],
  effect: Effect.gen(function* () {
    const options = yield* CliOptions
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const requiredFileChecker = yield* RequiredFilesChecker
    const spinner = yield* Spinner
    const projectConfig = yield* ProjectConfig

    const stylingLibrary = yield* projectConfig.getStylingLibrary()

    if (stylingLibrary !== "unknown"){
      console.log(
        `\x1b[2m${logSymbols.info} Styling Library: ${stylingLibrary === "uniwind" ? "Uniwind" : "Nativewind"}\x1b[0m`
      )
    } 


    const checkRequiredDependencies = ({
      dependencies,
      devDependencies
    }: {
      dependencies: Array<string>
      devDependencies: Array<string>
    }) =>
      Effect.gen(function* () {
        const packageJsonExists = yield* fs.exists(path.join(options.cwd, "package.json"))
        if (!packageJsonExists) {
          return yield* Effect.fail(new PackageJsonError({ message: "A package.json was not found and is required." }))
        }

        const packageJson = yield* fs.readFileString(path.join(options.cwd, "package.json")).pipe(
          Effect.flatMap(Schema.decodeUnknown(Schema.parseJson())),
          Effect.flatMap(Schema.decodeUnknown(packageJsonSchema)),
          Effect.catchTags({
            ParseError: () => Effect.fail(new PackageJsonError({ message: "Failed to parse package.json" }))
          })
        )

        const uninstalledDependencies: Array<string> = []
        const uninstalledDevDependencies: Array<string> = []

        for (const dependency of dependencies) {
          if (
            !packageJson.dependencies?.[dependency.split("@")[0]] &&
            !packageJson.devDependencies?.[dependency.split("@")[0]]
          ) {
            uninstalledDependencies.push(dependency)
            continue
          }
          yield* Effect.logDebug(
            `${logSymbols.success} ${dependency}@${packageJson.dependencies?.[dependency.split("@")[0]]} is installed`
          )
        }

        for (const devDependency of devDependencies) {
          if (
            !packageJson.devDependencies?.[devDependency.split("@")[0]] &&
            !packageJson.dependencies?.[devDependency.split("@")[0]]
          ) {
            uninstalledDevDependencies.push(devDependency)
            continue
          }
          yield* Effect.logDebug(
            `${logSymbols.success} ${devDependency}@${packageJson.devDependencies?.[devDependency]} is installed`
          )
        }

        return { uninstalledDependencies, uninstalledDevDependencies }
      })

    const registry = stylingLibrary === "uniwind" ? "uniwind" : "nativewind"

    return {
      run: (options: DoctorOptions) =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`Doctor options: ${JSON.stringify(options, null, 2)}`)
          const { uninstalledDependencies, uninstalledDevDependencies } = yield* checkRequiredDependencies({
            dependencies: PROJECT_MANIFEST.dependencies[registry],
            devDependencies: PROJECT_MANIFEST.devDependencies
          })

          const { customFileResults, deprecatedFileResults, fileResults } = yield* requiredFileChecker.run({
            customFileChecks: PROJECT_MANIFEST.customFileChecks,
            deprecatedFromLib: PROJECT_MANIFEST.deprecatedFromLib,
            deprecatedFromUi: PROJECT_MANIFEST.deprecatedFromUi,
            fileChecks: PROJECT_MANIFEST.fileChecks,
            stylingLibrary: registry 
          })

          const result = {
            missingFiles: [...fileResults.missingFiles, ...customFileResults.missingFiles],
            uninstalledDependencies,
            uninstalledDevDependencies,
            missingIncludes: [...fileResults.missingIncludes, ...customFileResults.missingIncludes],
            deprecatedFileResults
          }

          let total = Object.values(result).reduce((sum, cat) => sum + cat.length, 0)
          if (!options.summary) {
            const dependenciesToInstall: Array<string> = []
            for (const dep of result.uninstalledDependencies) {
              const confirmsInstall = options.yes
                ? true
                : yield* Prompt.confirm({
                    message: `The ${dep} dependency is missing. Do you want to install it?`,
                    initial: true
                  })
              if (confirmsInstall) {
                if (uninstalledDependencies.includes("expo")) {
                  continue
                }
                total--
                yield* Effect.logDebug(`Adding ${dep} to dependencies to install`)
                dependenciesToInstall.push(dep)
                result.uninstalledDependencies = result.uninstalledDependencies.filter((d) => d !== dep)
              }
            }

            if (dependenciesToInstall.length > 0) {
              yield* Effect.logDebug(`Installing ${dependenciesToInstall.join(", ")}`)
              if (process.env.INTERNAL_ENV !== "development") {
                spinner.start("Installing dependencies")
                yield* runCommand("npx", ["expo", "install", ...dependenciesToInstall], {
                  cwd: options.cwd
                })
                spinner.stop()
              }
            }

            const devDependenciesToInstall: Array<string> = []
            for (const dep of result.uninstalledDevDependencies) {
              const confirmsInstall = options.yes
                ? true
                : yield* Prompt.confirm({
                    message: `The ${dep} dependency is missing. Do you want to install it?`,
                    initial: true
                  })
              if (confirmsInstall) {
                if (uninstalledDependencies.includes("expo")) {
                  continue
                }
                total--
                yield* Effect.logDebug(`Adding ${dep} to devDependencies to install`)
                devDependenciesToInstall.push(dep)
                result.uninstalledDevDependencies = result.uninstalledDevDependencies.filter((d) => d !== dep)
              }
            }

            if (devDependenciesToInstall.length > 0) {
              yield* Effect.logDebug(`Installing ${devDependenciesToInstall.join(", ")}`)
              if (process.env.INTERNAL_ENV !== "development") {
                spinner.start("Installing dev dependencies")
                yield* runCommand("npx", ["expo", "install", ...devDependenciesToInstall], {
                  cwd: options.cwd
                })
                spinner.stop()
              }
            }
          }

          if (total === 0) {
            console.log(`\x1b[2m${logSymbols.success} All checks passed.\x1b[0m\n`)
            return yield* Effect.succeed(true)
          }

          const analysis = analyzeResult(result)
          if (options.summary) {
     
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

### Incident Patch 1: `b0601d59` (2026-06-03)
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
-      "content": "import { Icon } from '@/registry/nativewind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/nativewind/components/ui/native-only-animated-view';\nimport { cn } from '@/registry/nativewind/lib/utils';\nimport * as DialogPrimitive from '@rn-primitives/dialog';\nimport { X } from 'lucide-react-native';\nimport * as React from 'react';\nimport { Platform, Text, View, type ViewProps } from 'react-native';\nimport { FadeIn, FadeOut } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst Dialog = DialogPrimitive.Root;\n\nconst DialogTrigger = DialogPrimitive.Trigger;\n\nconst DialogPortal = DialogPrimitive.Portal;\n\nconst DialogClose = DialogPrimitive.Close;\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction DialogOverlay({\n  className,\n  children,\n  ...props\n}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {\n    children?: React.ReactNode;\n  }) {\n  return (\n    <FullWindowOverlay>\n      <DialogPrimitive.Overlay\n        className={cn(\n          'absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black/50 p-2',\n          Platform.select({\n            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',\n          }),\n          className\n        )}\n        {...props}\n        asChild={Platform.OS !== 'web'}>\n        <NativeOnlyAnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>\n          <NativeOnlyAnimatedView entering={FadeIn.delay(50)} exiting={FadeOut.duration(150)}>\n            <>{children}</>\n          </NativeOnlyAnimatedView>\n        </NativeOnlyAnimatedView>\n      </DialogPrimitive.Overlay>\n    </FullWindowOverlay>\n  );\n}\nfunction DialogContent({\n  className,\n  portalHost,\n  children,\n  ...props\n}: React.ComponentProps<typeof DialogPrimitive.Content> & {\n    portalHost?: string;\n  }) {\n  return (\n    <DialogPortal hostName={portalHost}>\n      <DialogOverlay>\n        <DialogPrimitive.Content\n          className={cn(\n            'bg-background border-border z-50 mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-4 rounded-lg border p-6 shadow-lg shadow-black/5 sm:max-w-lg',\n            Platform.select({\n              web: 'animate-in fade-in-0 zoom-in-95 duration-200',\n            }),\n            className\n          )}\n          {...props}>\n          <>{children}</>\n          <DialogPrimitive.Close\n            className={cn(\n              'absolute right-4 top-4 rounded opacity-70 active:opacity-100',\n              Platform.select({\n                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',\n              })\n            )}\n            hitSlop={12}>\n            <Icon\n              as={X}\n              className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}\n            />\n            <Text className=\"sr-only\">Close</Text>\n          </DialogPrimitive.Close>\n        </DialogPrimitive.Content>\n      </DialogOverlay>\n    </DialogPortal>\n  );\n}\n\nfunction DialogHeader({ className, ...props }: ViewProps) {\n  return (\n    <View className={cn('flex flex-col gap-2 text-cente
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
-      "content": "import { Icon } from '@/registry/uniwind/components/ui/icon';\nimport { NativeOnlyAnimatedView } from '@/registry/uniwind/components/ui/native-only-animated-view';\nimport { cn } from '@/registry/uniwind/lib/utils';\nimport * as DialogPrimitive from '@rn-primitives/dialog';\nimport { X } from 'lucide-react-native';\nimport * as React from 'react';\nimport { Platform, Text, View, type ViewProps } from 'react-native';\nimport { FadeIn, FadeOut } from 'react-native-reanimated';\nimport { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';\n\nconst Dialog = DialogPrimitive.Root;\n\nconst DialogTrigger = DialogPrimitive.Trigger;\n\nconst DialogPortal = DialogPrimitive.Portal;\n\nconst DialogClose = DialogPrimitive.Close;\n\nconst FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;\n\nfunction DialogOverlay({\n  className,\n  children,\n  ...props\n}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {\n    children?: React.ReactNode;\n  }) {\n  return (\n    <FullWindowOverlay>\n      <DialogPrimitive.Overlay\n        className={cn(\n          'absolute bottom-0 left-0 right-0 top-0 z-50 flex items-center justify-center bg-black/50 p-2',\n          Platform.select({\n            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',\n          }),\n          className\n        )}\n        {...props}\n        asChild={Platform.OS !== 'web'}>\n        <NativeOnlyAnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>\n          <NativeOnlyAnimatedView entering={FadeIn.delay(50)} exiting={FadeOut.duration(150)}>\n            <>{children}</>\n          </NativeOnlyAnimatedView>\n        </NativeOnlyAnimatedView>\n      </DialogPrimitive.Overlay>\n    </FullWindowOverlay>\n  );\n}\nfunction DialogContent({\n  className,\n  portalHost,\n  children,\n  ...props\n}: React.ComponentProps<typeof DialogPrimitive.Content> & {\n    portalHost?: string;\n  }) {\n  return (\n    <DialogPortal hostName={portalHost}>\n      <DialogOverlay>\n        <DialogPrimitive.Content\n          className={cn(\n            'bg-background border-border z-50 mx-auto flex w-full flex-col gap-4 rounded-lg border p-6 shadow-lg shadow-black/5 sm:max-w-lg',\n            Platform.select({\n              web: 'animate-in fade-in-0 zoom-in-95 web:max-w-[calc(100%-2rem)] duration-200',\n            }),\n            className\n          )}\n          {...props}>\n          <>{children}</>\n          <DialogPrimitive.Close\n            className={cn(\n              'absolute right-4 top-4 rounded opacity-70 active:opacity-100',\n              Platform.select({\n                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',\n              })\n            )}\n            hitSlop={12}>\n            <Icon\n              as={X}\n              className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}\n            />\n            <Text className=\"sr-only\">Close</Text>\n          </DialogPrimitive.Close>\n        </DialogPrimitive.Content>\n      </DialogOverlay>\n    </DialogPortal>\n  );\n}\n\nfunction DialogHeader({ className, ...props }: ViewProps) {\n  return (\n    <View className={cn('flex flex-col gap-2 text-center sm:text
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

### Incident Patch 2: `3e6332e0` (2026-02-17)
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

### Incident Patch 3: `54e82902` (2026-05-02)
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

---

### Incident Patch 4: `70d25f44` (2026-04-05)
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
-        d="M11.0615 0.608953L11.6355 -0.776866L11.0615 0.608953ZM15.391 11.0615L16.7769 11.6355L15.391 11.0615ZM4.93853 15.391L4.36451 16.7768L4.93853 15.391ZM0.608964 4.93852L-0.776856 4.3645L0.608964 4.93852ZM13.8223 4.87602L15.1356 4.15139L15.1355 4.15115L13.8223 4.87602ZM10.4835 3.91057L9.75905 2.59711L9.75861 2.59735L10.4835 3.91057ZM10.39 3.96275L9.6652 2.64949L9.66519 2.64949L10.39 3.96275ZM7.79175 7.88519L8.99997 8.77413L9.00022 8.77379L7.79175 7.88519ZM4.35609 8.40913L3.46739 9.61752L3.46759 9.61767L4.35609 8.40913ZM3.99928 8.08904L2.89293 9.10196L2.89298 9.102L3.99928 8.08904ZM3.22188 7.91924L2.49757 6.6057L2.49703 6.606L3.22188 7.91924ZM2.25643 11.258L0.943019 11.9826L0.943204 11.9829L2.25643 11.258ZM5.59687 12.222L6.32162 13.5353L6.32174 13.5353L5.59687 12.222ZM5.68743 12.1718L4.96263 10.8586L5.68743 12.1718ZM8.28695 8.24886L7.0786 7.36011L7.07855 7.36018L8.28695 8.24886ZM11.7235 7.7253L12.6125 6.5171L12.6122 6.51691L11.7235 7.7253ZM12.0771 8.04299L13.1845 7.03121L13.1844 7.03113L12.0771 8.04299ZM12.8577 8.21519L13.5818 9.52888L13.5825 9.52848L12.8577 8.21519ZM11.0615 0.608953L10.4874 1.99477C13.804 3.36855 15.379 7.17084 14.0052 10.4874L15.391 11.0615L16.7769 11.6355C18.7847 6.78816 16.4828 1.23096 11.6355 -0.776866L11.0615 0.608953ZM15.391 11.0615L14.0052 10.4874C12.6314 13.804 8.82915 15.379 5.51256 14.0052L4.93853 15.391L4.36451 16.7768C9.21183 18.7847 14.769 16.4828 16.7769 11.6355L15.391 11.0615ZM4.93853 15.391L5.51256 14.0052C2.19597 12.6314 0.621007 8.82914 1.99478 5.51255L0.608964 4.93852L-0.776856 4.3645C-2.78468 9.21182 -0.482816 14.769 4.36451 16.7768L4.93853 15.391ZM0.608964 4.93852L1.99478 5.51255C3.36856 2.19596 7.17085 0.620996 10.4874 1.99477L11.0615 0.608953L11.6355 -0.776866C6.78817 -2.78469 1.23097 -0.482827 -0.776856 4.3645L0.608964 4.93852ZM13.8223 4.87602L15.1355 4.15115C14.08 2.23889 11.6735 1.5412 9.75905 2.59711L10.4835 3.91057L11.2079 5.22404C11.67 4.96917 12.253 5.13696 12.5091 5.6009L13.8223 4.87602ZM10.4835 3.91057L9.75861 2.59735C9.73785 2.60881 9.7177 2.62013 9.70305 2.62835C9.68682 2.63746 9.67566 2.64371 9.6652 2.64949L10.39 3.96275L11.1148 5.27602C11.1361 5.26429 11.1563 5.2529 11.1713 5.24452C11.1878 5.23526 11.1985 5.22924 11.2084 5.2238L10.4835 3.91057ZM10.39 3.96275L9.66519 2.64949C8.56651 3.25587 7.97213 4.30371 7.58894 5.06544C7.13006 5.97763 6.93576 6.51724 6.58329 6.99659L7.79175 7.88519L9.00022 8.77379C9.55137 8.02424 9.98847 6.97116 10.2689 6.41363C10.6251 5.70563 10.878 5.4067 11.1148 5.27601L10.39 3.96275ZM7.79175 7.88519L6.58354 6.99625C6.26995 7.42247 5.67048 7.5137 5.24459 7.20059L4.35609 8.40913L3.46759 9.61767C5.2285 10.9123 7.70507 10.5341 8.99997 8.77413L7.79175 7.88519ZM4.35609 8.40913L5.24479 7.20074C5.19219 7.16206 5.14581 7.12001 5.10558 7.07607L3.99928 8.08904L2.89298 9.102C3.06502 9.2899 3.25713 9.46289 3.
```

---

### Incident Patch 5: `c01bb669` (2026-03-16)
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

### Incident Patch 6: `ef652204` (2026-03-14)
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

---

### Incident Patch 7: `f7891c42` (2026-03-14)
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

---

### Incident Patch 8: `b4806c42` (2026-01-20)
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

### Incident Patch 9: `f4fa3a04` (2026-01-17)
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

### Incident Patch 10: `f770d998` (2026-01-17)
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
