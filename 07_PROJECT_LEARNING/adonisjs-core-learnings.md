# Forensic Learning Record (Deep Inspection): adonisjs/core

> **Canonical Artifact**: `07_PROJECT_LEARNING/adonisjs-core-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/adonisjs/core](https://github.com/adonisjs/core))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:19:12.832Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `adonisjs/core`
- **Description**: AdonisJS is a TypeScript-first web framework for building web apps and API servers. It comes with support for testing, modern tooling, an ecosystem of official packages, and more.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 19140 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `commands/add.ts`
```
/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type CommandOptions } from '../types/ace.ts'
import { prettyPrintError } from '../src/ignitor/main.ts'
import { args, BaseCommand, flags } from '../modules/ace/main.ts'
import { type SupportedPackageManager } from '@adonisjs/assembler/types'

/**
 * The install command is used to `npm install` and `node ace configure` one or more packages
 * in one go.
 *
 * @example
 * ```
 * ace add @adonisjs/lucid
 * ace add @adonisjs/lucid @adonisjs/auth @adonisjs/session
 * ace add @adonisjs/session --dev
 * ace add vinejs --force
 * ace add edge --package-manager=pnpm
 * ```
 */
export default class Add extends BaseCommand {
  /**
   * The command name
   */
  static commandName = 'add'
  /**
   * The command description
   */
  static description =
    'Install and configure one or more AdonisJS packages. Runs npm install followed by the package configure hook'

  static help = [
    'Use this command instead of manually running npm install + configure separately.',
    'Accepts shorthand names: "vinejs" for @vinejs/vine, "edge" for edge.js.',
    '```',
    '{{ binaryName }} add @adonisjs/lucid',
    '{{ binaryName }} add @adonisjs/auth @adonisjs/session',
    '```',
  ]
  /**
   * Command options configuration
   */
  static options: CommandOptions = {
    allowUnknownFlags: true,
  }

  /**
   * Package names to install and configure
   */
  @args.spread({ description: 'Package names to install and configure', required: true })
  declare names: string[]

  /**
   * Display logs in verbose mode
   */
  @flags.boolean({ description: 'Display logs in verbose mode' })
  declare verbose?: boolean

  /**
   * Define the package manager you want to use
   */
  @flags.string({ description: 'Define the package manager you want to use' })
  declare packageManager?: SupportedPackageManager

  /**
   * Should we install the package as a dev dependency
   */
  @flags.boolean({ description: 'Should we install the package as a dev dependency', alias: 'D' })
  declare dev?: boolean

  /**
   * Forcefully overwrite existing files
   */
  @flags.boolean({ description: 'Forcefully overwrite existing files' })
  declare force?: boolean

  /**
   * Resolve the npm package name from the user-provided name
   */
  #resolveNpmPackageName(name: string): string {
    if (name === 'vinejs') {
      return '@vinejs/vine'
    }
    if (name === 'edge') {
      return 'edge.js'
    }

    return name
  }

  /**
   * Configure the package by delegating the work to the `node ace configure` command
   */
  async #configurePackage(packageName: string) {
    const flagValueArray = this.parsed.unknownFlags
      .filter((flag) => !!this.parsed.flags[flag])
      .map((flag) => [`--${flag}`, this.parsed.flags[flag].toString()])

    const configureArgs = [
      packageName,
      this.force ? '--force' : undefined,
      this.verbose ? '--verbose' : undefined,
      ...flagValueArray.flat(),
    ].filter(Boolean) as string[]

    return await this.kernel.exec('configure', configureArgs)
  }

  /**
   * Run method is invoked by ace automatically
   */
  async run() {
    const packages = this.names.map((name) => ({
      name,
      npmName: this.#resolveNpmPackageName(name),
    }))

    /**
     * Install all packages
     */
    const codemods = await this.createCodemods()
    codemods.verboseInstallOutput = !!this.verbose

    const packagesWereInstalled = await codemods.installPackages(
      packages.map((pkg) => ({ name: pkg.npmName, isDevDependency: !!this.dev })),
      this.packageManager
    )
    if (!packagesWereInstalled) {
      return
    }

    /**
     * Configure each package sequentially
     */
    const succeeded: string[] = []
    const failed: { name: string; error?: Error }[] = []

    for (const pkg of packages) {
      const { exitCode, error } = await this.#configurePackage(pkg.name)
      if (exitCode === 0) {
        succeeded.push(pkg.name)
      } else {
        failed.push({ name: pkg.name, error })
      }
    }

    /**
     * Report results
     */
    if (succeeded.length > 0) {
      const names = succeeded.map((name) => this.colors.green(name)).join(', ')
      this.logger.success(`Installed and configured ${names}`)
    }

    if (failed.length > 0) {
      this.exitCode = 1
      for (const pkg of failed) {
        this.logger.error(`Unable to configure ${this.colors.green(pkg.name)}`)
        if (pkg.error) {
          await prettyPrintError(pkg.error.cause || pkg.error)
        }
      }
    }
  }
}

```

### Core Architecture Module: `commands/codegen.ts`
```
/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseCommand } from '../modules/ace/main.ts'
import { emitRouteTypes, importAssembler } from '../src/utils.ts'

/**
 * Regenerate the contents of the ".adonisjs" directory without starting the
 * HTTP server.
 *
 * These files are otherwise generated as a side-effect of running the
 * dev-server, the test runner or creating a build. This command performs the
 * same work on its own, so the generated types can be refreshed
 * deterministically. For example, inside a CI pipeline before typechecking or
 * deploying the application.
 *
 * @example
 * ```
 * ace codegen
 * ```
 */
export default class Codegen extends BaseCommand {
  /**
   * The command name
   */
  static commandName = 'codegen'

  /**
   * The command description
   */
  static description = 'Generate TypeScript type definitions and index files for the application'

  /**
   * Help text for the command
   */
  static help = [
    'Regenerate the codegen files without starting the HTTP server.',
    '```',
    '{{ binaryName }} codegen',
    '```',
    '',
    'Use it inside a CI pipeline to keep the generated types up-to-date before',
    'typechecking or building the application, without committing them to git.',
    '```',
    'npm ci && {{ binaryName }} codegen && npm run typecheck',
    '```',
  ]

  /**
   * Log a development dependency is missing
   *
   * @param dependency - The name of the missing dependency
   */
  #logMissingDevelopmentDependency(dependency: string) {
    this.logger.error(
      [
        `Cannot find package "${dependency}"`,
        '',
        `The "${dependency}" package is a development dependency and therefore you should use the codegen command with development dependencies installed.`,
        '',
        'If you are using the codegen command inside a CI or with a deployment platform, make sure it runs after installing the development dependencies.',
      ].join('\n')
    )
  }

  /**
   * Warm up the application and return the state the codegen needs from it.
   *
   * The app is assembled the way the web environment assembles it, since the
   * generated files describe the app that serves requests. However, it is
   * created in the "warmup" mode, so it never becomes ready and none of the
   * long running side-effects registered by the providers kick in.
   */
  async #warmUpApp() {
    this.app.setEnvironment('web')
    this.app.setMode('warmup')

    await this.app.boot()
    await this.app.warmUp()

    /**
     * Commit the router, so the routes can be turned into their types and
     * handed over to the assembler
     */
    const router = await this.app.container.make('router')
    router.commit()

    await emitRouteTypes(this.app, router)

    /**
     * The routes are round tripped through JSON, because that is how the
     * dev-server hands them over to the assembler. The round trip drops the
     * handler of the routes registered using a closure and strips the
     * properties that cannot be serialized, so the assembler is given the exact
     * same shape by both the paths
     */
    return { routes: JSON.parse(JSON.stringify(router.toJSON())) }
  }

  /**
   * Generate the codegen files
   */
  async run() {
    const assembler = await importAssembler(this.app)
    if (!assembler) {
      this.#logMissingDevelopmentDependency('@adonisjs/assembler')
      this.exitCode = 1
      return
    }

    const codegen = new assembler.CodeGen(this.app.appRoot, {
      hooks: this.app.rcFile.hooks,
    })

    /**
     * Share command logger with assembler, so that CLI flags like --no-ansi has
     * similar impact for assembler logs as well.
     */
    codegen.ui.logger = this.logger

    /**
     * The app is booted from within the callback, because its preload files
     * import the index files the codegen writes before invoking it
     */
    await codegen.run(() => this.#warmUpApp())

    this.logger.success('Codegen files generated')
  }
}

```

### Core Architecture Module: `commands/configure.ts`
```
/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RuntimeException } from '@poppinss/utils/exception'

import { stubsRoot } from '../stubs/main.ts'
import type { CommandOptions } from '../types/ace.ts'
import { args, BaseCommand, flags } from '../modules/ace/main.ts'

/**
 * Command to configure packages after installation by running their configuration hooks.
 * Supports built-in configurations for VineJS, Edge, and health checks, or can execute
 * custom configure functions exported by packages.
 *
 * @example
 * ```
 * ace configure @adonisjs/lucid
 * ace configure vinejs
 * ace configure edge
 * ace configure health_checks
 * ace configure @adonisjs/auth --force --verbose
 * ```
 */
export default class Configure extends BaseCommand {
  /**
   * The command name
   */
  static commandName = 'configure'

  /**
   * The command description
   */
  static description =
    'Run the configure hook of an already-installed package. Use "add" command instead to both install and configure in one step'

  /**
   * Command options configuration.
   * Allows unknown flags to be passed to package configure functions.
   */
  static options: CommandOptions = {
    allowUnknownFlags: true,
  }

  /**
   * Expose all flags from the protected property "parsed" for access by package configure functions
   */
  get parsedFlags() {
    return this.parsed.flags
  }

  /**
   * Expose all arguments from the protected property "parsed" for access by package configure functions
   */
  get parsedArgs() {
    return this.parsed._
  }

  /**
   * Name of the package to configure
   */
  @args.string({ description: 'Package name' })
  declare name: string

  /**
   * Enable verbose logging during package installation and configuration
   */
  @flags.boolean({ description: 'Display logs in verbose mode', alias: 'v' })
  declare verbose?: boolean

  /**
   * Forcefully overwrite existing files during configuration
   */
  @flags.boolean({ description: 'Forcefully overwrite existing files', alias: 'f' })
  declare force?: boolean

  /**
   * The root directory path of the package's stubs.
   * Set automatically when the package exports a stubsRoot property.
   */
  declare stubsRoot: string

  /**
   * Import and return the main exports of a package.
   * Returns null if the package is not found, rethrows other errors.
   *
   * @param packageName - The name of the package to import
   * @returns The package exports or null if not found
   */
  async #getPackageSource(packageName: string) {
    try {
      const packageExports = await this.app.import(packageName)
      return packageExports
    } catch (error: any) {
      if (
        (error.code && error.code === 'ERR_MODULE_NOT_FOUND') ||
        error.message.startsWith('Cannot find module')
      ) {
        return null
      }
      throw error
    }
  }

  /**
   * Configure VineJS validation library by registering its provider in the RC file
   */
  async #configureVineJS() {
    const codemods = await this.createCodemods()
    await codemods.updateRcFile((rcFile) => {
      rcFile.addProvider('@adonisjs/core/providers/vinejs_provider')
    })
  }

  /**
   * Configure Edge template engine by registering its provider and adding view meta files
   */
  async #configureEdge() {
    const codemods = await this.createCodemods()
    await codemods.updateRcFile((rcFile) => {
      rcFile.addProvider('@adonisjs/core/providers/edge_provider')
      rcFile.addMetaFile('resources/views/**/*.edge', false)
    })
  }

  /**
   * Configure health checks feature by generating the main health file and controller
   */
  async #configureHealthChecks() {
    const codemods = await this.createCodemods()
    await codemods.makeUsingStub(stubsRoot, 'make/health/main.stub', {
      flags: this.parsed.flags,
      entity: this.app.generators.createEntity('health'),
    })
    await codemods.makeUsingStub(stubsRoot, 'make/health/controller.stub', {
      flags: this.parsed.flags,
      entity: this.app.generators.createEntity('health_checks'),
    })
  }

  /**
   * Create a codemods instance configured with command options.
   * Sets overwrite and verbose flags based on command arguments.
   */
  async createCodemods() {
    const codemods = await super.createCodemods()
    codemods.overwriteExisting = this.force === true
    codemods.verboseInstallOutput = this.verbose === true
    return codemods
  }

  /**
   * Execute the configure command. Handles built-in configurations for VineJS, Edge,
   * and health checks, or imports and executes the configure function from the specified package.
   */
  async run() {
    if (this.name === 'vinejs') {
      return this.#configureVineJS()
    }
    if (this.name === 'edge') {
      return this.#configureEdge()
    }
    if (this.name === 'health_checks') {
      return this.#configureHealthChecks()
    }

    const packageExports = await this.#getPackageSource(this.name)
    if (!packageExports) {
      this.logger.error(`Cannot find module "${this.name}". Make sure to install it`)
      this.exitCode = 1
      return
    }

    /**
     * Warn, there are not instructions to run
     */
    if (!packageExports.configure) {
      this.logger.warning(
        `Cannot configure module "${this.name}". The module does not export the configure hook`
      )
      return
    }

    /**
     * Set stubsRoot property when package exports it
     */
    if (packageExports.stubsRoot) {
      this.stubsRoot = packageExports.stubsRoot
    }

    /**
     * Run instructions
     */
    try {
      await packageExports.configure(this)
    } catch (error) {
      throw new RuntimeException(`Unable to configure package "${this.name}"`, {
        cause: error,
      })
    }
  }
}

```

### Core Architecture Module: `commands/eject.ts`
```
/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { args, BaseCommand, flags } from '../modules/ace/main.ts'
import stringHelpers from '../src/helpers/string.ts'

/**
 * Command to eject scaffolding stubs from packages to your application root.
 * This allows you to customize templates used by make commands and other
 * code generation features by copying them to your local application.
 *
 * @example
 * ```
 * ace eject make/controller
 * ace eject make/controller --pkg=@adonisjs/lucid
 * ace eject stubs/
 * ```
 */
export default class Eject extends BaseCommand {
  /**
   * The command name
   */
  static commandName = 'eject'

  /**
   * The command description
   */
  static description =
    'Copy scaffolding stubs from a package to your application for customization. Stubs are templates used by make:* commands'

  /**
   * Path to the stubs directory or a single stub file to eject
   */
  @args.string({ description: 'Path to the stubs directory or a single stub file' })
  declare stubPath: string

  /**
   * Package name to search for stubs. Defaults to @adonisjs/core
   */
  @flags.string({
    description: 'Mention package name for searching stubs',
    default: '@adonisjs/core',
  })
  declare pkg: string

  /**
   * Execute the command to eject stubs from the specified package.
   * Copies the stubs to the application root and logs success messages
   * for each ejected file.
   */
  async run() {
    const stubs = await this.app.stubs.create()
    const copied = await stubs.copy(this.stubPath, {
      pkg: this.pkg,
    })

    copied.forEach((stubPath) => {
      this.logger.success(`eject ${stringHelpers.toUnixSlash(this.app.relativePath(stubPath))}`)
    })
  }
}

```

### Core Architecture Module: `commands/env/add.ts`
```
/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type CommandOptions } from '../../types/ace.ts'
import stringHelpers from '../../src/helpers/string.ts'
import { args, BaseCommand, flags } from '../../modules/ace/main.ts'

const ALLOWED_TYPES = ['string', 'boolean', 'number', 'enum'] as const
type AllowedTypes = (typeof ALLOWED_TYPES)[number]

/**
 * Command to add a new environment variable to the application.
 * Updates .env, .env.example, and start/env.ts files with the new variable,
 * including appropriate validation schema based on the variable type.
 *
 * @example
 * ```
 * ace env:add
 * ace env:add DATABASE_URL postgres://localhost:5432/mydb
 * ace env:add API_KEY secret --type=string
 * ace env:add PORT 3333 --type=number
 * ace env:add DEBUG true --type=boolean
 * ace env:add LOG_LEVEL info --type=enum --enum-values=debug,info,warn,error
 * ```
 */
export default class EnvAdd extends BaseCommand {
  /**
   * The command name
   */
  static commandName = 'env:add'

  /**
   * The command description
   */
  static description =
    'Add a new environment variable to .env, .env.example, and its validation rule to start/env.ts'

  /**
   * Command options configuration.
   * Allows unknown flags to be passed through.
   */
  static options: CommandOptions = {
    allowUnknownFlags: true,
  }

  /**
   * Environment variable name (will be converted to SCREAMING_SNAKE_CASE)
   */
  @args.string({
    description: 'Variable name. Will be converted to screaming snake case',
    required: false,
  })
  declare name: string

  /**
   * Environment variable value
   */
  @args.string({ description: 'Variable value', required: false })
  declare value: string

  /**
   * Data type of the environment variable (string, boolean, number, enum)
   */
  @flags.string({ description: 'Type of the variable' })
  declare type: AllowedTypes

  /**
   * Allowed values for enum type variables
   */
  @flags.array({
    description: 'Allowed values for the enum type in a comma-separated list',
    default: [''],
    required: false,
  })
  declare enumValues: string[]

  /**
   * Validate that the provided type is one of the allowed types.
   *
   * @returns True if the type is valid, false otherwise
   */
  #isTypeFlagValid() {
    return ALLOWED_TYPES.includes(this.type)
  }

  /**
   * Execute the command to add a new environment variable.
   * Prompts for missing values, validates inputs, and updates all relevant files.
   */
  async run() {
    /**
     * Prompt for missing name
     */
    if (!this.name) {
      this.name = await this.prompt.ask('Enter the variable name', {
        validate: (value) => !!value,
        format: (value) => stringHelpers.snakeCase(value).toUpperCase(),
      })
    }

    /**
     * Prompt for missing value
     */
    if (!this.value) {
      this.value = await this.prompt.ask('Enter the variable value')
    }

    /**
     * Prompt for missing type
     */
    if (!this.type) {
      this.type = await this.prompt.choice('Select the variable type', ALLOWED_TYPES)
    }

    /**
     * Prompt for missing enum values if the selected env type is `enum`
     */
    if (this.type === 'enum' && !this.enumValues) {
      this.enumValues = await this.prompt.ask('Enter the enum values separated by a comma', {
        result: (value) => value.split(',').map((one) => one.trim()),
      })
    }

    /**
     * Validate inputs
     */
    if (!this.#isTypeFlagValid()) {
      this.logger.error(`Invalid type "${this.type}". Must be one of ${ALLOWED_TYPES.join(', ')}`)
      return
    }

    /**
     * Add the environment variable to the `.env` and `.env.example` files
     */
    const codemods = await this.createCodemods()
    const transformedName = stringHelpers.snakeCase(this.name).toUpperCase()
    await codemods.defineEnvVariables(
      { [transformedName]: this.value },
      { omitFromExample: [transformedName] }
    )

    /**
     * Add the environment variable to the `start/env.ts` file
     */
    const validation = {
      string: 'Env.schema.string()',
      number: 'Env.schema.number()',
      boolean: 'Env.schema.boolean()',
      enum: `Env.schema.enum(['${this.enumValues.join("','")}'] as const)`,
    }[this.type]

    await codemods.defineEnvValidations({ variables: { [transformedName]: validation } })

    this.logger.success('Environment variable added successfully')
  }
}

```

### Core Architecture Module: `commands/generate_key.ts`
```
/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/utils/string'
import { EnvEditor } from '@adonisjs/env/editor'
import { BaseCommand, flags } from '../modules/ace/main.ts'

/**
 * The generate key command is used to generate the app key
 * and write it inside the .env file.
 *
 * @example
 * ```
 * ace generate:key
 * ace generate:key --show
 * ace generate:key --force
 * ```
 */
export default class GenerateKey extends BaseCommand {
  /**
   * The command name
   */
  static commandName = 'generate:key'
  /**
   * The command description
   */
  static description =
    'Generate a cryptographically secure APP_KEY and write it to the .env file. Use --show to print without writing'

  /**
   * Display the key on the terminal, instead of writing it to .env file
   */
  @flags.boolean({
    description: 'Display the key on the terminal, instead of writing it to .env file',
  })
  declare show: boolean

  /**
   * Force update .env file in production environment
   */
  @flags.boolean({
    description: 'Force update .env file in production environment',
  })
  declare force: boolean

  async run() {
    let writeToFile = process.env.NODE_ENV !== 'production'
    if (this.force) {
      writeToFile = true
    }

    if (this.show) {
      writeToFile = false
    }

    const secureKey = string.random(32)

    if (writeToFile) {
      const editor = await EnvEditor.create(this.app.appRoot)
      editor.add('APP_KEY', secureKey, true)
      await editor.save()
      this.logger.action('add APP_KEY to .env').succeeded()
    } else {
      this.logger.log(`APP_KEY = ${secureKey}`)
    }
  }
}

```

### Core Architecture Module: `commands/list/routes.ts`
```
/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { CommandOptions } from '../../types/ace.ts'
import { args, BaseCommand, flags } from '../../modules/ace/main.ts'
import { RoutesListFormatter } from '../../src/cli_formatters/routes_list.ts'

/**
 * Command to display a list of all registered routes in the application.
 * Supports filtering by keywords, middleware, and output formatting options.
 * Routes can be displayed as a formatted list, table, or JSON.
 *
 * @example
 * ```
 * ace list:routes
 * ace list:routes user
 * ace list:routes --middleware=auth
 * ace list:routes --ignore-middleware=guest
 * ace list:routes --json
 * ace list:routes --table
 * ```
 */
export default class ListRoutes extends BaseCommand {
  /**
   * The command name
   */
  static commandName = 'list:routes'

  /**
   * The command description
   */
  static description =
    'List all registered routes with their HTTP methods, URL patterns, handlers, and middleware'

  /**
   * Command options configuration.
   * Requires the application to be started so routes are loaded.
   */
  static options: CommandOptions = {
    startApp: true,
  }

  /**
   * Keyword to match against route names, patterns, and controller names
   */
  @args.string({
    description:
      'Find routes matching the given keyword. Route name, pattern and controller name will be searched against the keyword',
    required: false,
  })
  declare match: string

  /**
   * Filter routes that include all specified middleware names
   */
  @flags.array({
    description:
      'View routes that includes all the mentioned middleware names. Use * to see routes that are using one or more middleware',
  })
  declare middleware: string[]

  /**
   * Filter routes that do not include all specified middleware names
   */
  @flags.array({
    description:
      'View routes that does not include all the mentioned middleware names. Use * to see routes that are using zero middleware',
  })
  declare ignoreMiddleware: string[]

  /**
   * Output routes as JSON format
   */
  @flags.boolean({ description: 'Get routes list as a JSON string' })
  declare json: boolean

  /**
   * Output routes as a CLI table format
   */
  @flags.boolean({ description: 'View list of routes as a table' })
  declare table: boolean

  /**
   * Output routes as JSONL (one JSON object per line), optimized for
   * machine consumption by AI agents and CLI tools
   */
  @flags.boolean({
    description: 'Get routes as JSONL, one JSON object per line (optimized for AI agents)',
  })
  declare jsonl: boolean

  /**
   * Execute the command to list application routes.
   * Creates a formatter with the specified filters and outputs routes
   * in the requested format (JSON, table, or formatted list).
   */
  async run() {
    const router = await this.app.container.make('router')
    const formatter = new RoutesListFormatter(
      router,
      this.ui,
      {},
      {
        ignoreMiddleware: this.ignoreMiddleware,
        middleware: this.middleware,
        match: this.match,
      }
    )

    /**
     * Display as JSONL (one JSON object per line).
     * Auto-selected when running inside an AI agent and no
     * explicit format flag is provided.
     */
    if (this.jsonl || (!this.json && !this.table && this.app.runningInAIAgent)) {
      const lines = await formatter.formatAsJSONL()
      for (const line of lines) {
        this.logger.log(line)
      }
      return
    }

    /**
     * Display as JSON
     */
    if (this.json) {
      this.logger.log(JSON.stringify(await formatter.formatAsJSON(), null, 2))
      return
    }

    /**
     * Display as a standard table
     */
    if (this.table) {
      const tables = await formatter.formatAsAnsiTable()
      tables.forEach((table) => {
        this.logger.log('')
        if (table.heading) {
          this.logger.log(table.heading)
          this.logger.log('')
        }
        table.table.render()
      })
      return
    }

    /**
     * Display as a list
     */
    const list = await formatter.formatAsAnsiList()
    list.forEach((item) => {
      this.logger.log('')
      if (item.heading) {
        this.logger.log(item.heading)
        this.logger.log('')
      }
      this.logger.log(item.rows.join('\n'))
    })
  }
}

```

### Core Architecture Module: `commands/make/command.ts`
```
/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { stubsRoot } from '../../stubs/main.ts'
import { args, flags } from '../../modules/ace/main.ts'
import { BaseCommand } from '../../modules/ace/main.ts'

/**
 * Command to create a new Ace command class.
 * Ace commands are CLI commands that can be executed via the `ace` binary,
 * allowing you to create custom functionality for your application's command line interface.
 *
 * @example
 * ```
 * ace make:command SendEmails
 * ace make:command ProcessPayments
 * ace make:command GenerateReports
 * ace make:command CleanupFiles
 * ```
 */
export default class MakeCommand extends BaseCommand {
  /**
   * The command name
   */
  static commandName = 'make:command'

  /**
   * The command description
   */
  static description = 'Create a new Ace CLI command class in commands/'

  /**
   * Name of the command class to create
   */
  @args.string({ description: 'Name of the command' })
  declare name: string

  /**
   * Read the contents from this file (if the flag exists) and use
   * it as the raw contents
   */
  @flags.string({ description: 'Use the contents of the given file as the generated output' })
  declare contentsFrom: string

  /**
   * Forcefully overwrite existing files
   */
  @flags.boolean({ description: 'Forcefully overwrite existing files', alias: 'f' })
  declare force: boolean

  /**
   * The stub template file to use for generating the command class
   */
  protected stubPath: string = 'make/command/main.stub'

  /**
   * Execute the command to create a new Ace command class.
   * Generates the command file with proper CLI command structure.
   */
  async run() {
    const codemods = await this.createCodemods()
    codemods.overwriteExisting = this.force === true
    await codemods.makeUsingStub(
      stubsRoot,
      this.stubPath,
      {
        flags: this.parsed.flags,
        entity: this.app.generators.createEntity(this.name),
      },
      {
        contentsFromFile: this.contentsFrom,
      }
    )
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5147** (2026-09-24): **feat: connect number helpers from @poppinss/utils**
  *Symptoms*: ### ❓ Type of change  - [ ] 🐞 Bug fix (a non-breaking change that fixes an issue) - [ ] 👌 Enhancement (improving an existing functionality like performance) - [x] ✨ New feature (a non-breaking change that adds functionality) - [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)  ### 📚 Description  Re-exports number helpers from `@poppinss/utils` as `@adonisjs/core/helpers/number`.  Methods: `clamp`, `between`, `toFinite`, `parse`.  The helpers are also registered as the Edge global `number`.  Bumps `@poppinss/utils` to `^7.1.0` so the `/number` export is available.  ### 📝 Checklist  - [ ] I have linked an issue or discussion. - [ ] I have updated the documentation accordingly.
  **Post-Mortem & Fix Analysis**:
  > Looks good to me. Thanks :)  Can you please send a PR for the docs as well?
  > > Looks good to me. Thanks :) >  > Can you please send a PR for the docs as well?  Yeah, sure

- **Issue #5146** (2026-09-13): **perf: enable faster Ace bootstrap with targeted exports**
  *Symptoms*: Hey! :wave:  Importing bootstrap primitives from `@adonisjs/core` evaluates the root entrypoint and its aggregated error namespaces. Light Ace commands therefore load modules they never use.  This PR adds coherent targeted exports:  - `@adonisjs/core/ignitor` exports `Ignitor` and `prettyPrintError` - `@adonisjs/core/generators` exports `indexEntities` - `@adonisjs/core/config` now also exports `configProvider`  All root exports remain available for backward compatibility. The `add` command also imports `prettyPrintError` directly from its owning module.  ## Measured impact  The benchmark uses the official Hypermedia starter generated with:  `npm create adonisjs@3.4.0 perf-adonis-hypermedia -- --kit=hypermedia --pkg=npm --skip-migrations`  The optimized fixture switches the generated bootstrap files, `adonisrc.ts`, Auth, and Session away from the root export. Those consumer changes will be proposed separately.  Values are wall-clock medians with `[p05, p95]`.  | Runtime | Command | Before | After | Delta | Peak RSS | | --- | --- | --- | --- | --- | --- | | Node 24.20 | `node ace --help` | 359.47 ms `[319.53, 394.04]` | 285.68 ms `[250.89, 314.37]` | -73.79 ms (-20.5%) | -10.20 MiB | | Node 26.5 | `node ace --help` | 359.86 ms `[307.99, 396.53]` | 280.98 ms `[251.82, 313.49]` | -78.88 ms (-21.9%) | -10.49 MiB | | Node 24.20 | `node ace test --help` | 360.76 ms `[323.46, 396.24]` | 293.91 ms `[256.57, 324.01]` | -66.85 ms (-18.5%) | -10.46 MiB | | Node 26.5 | `node ace test --h
  **Post-Mortem & Fix Analysis**:
  > Thanks :)

- **Issue #5145** (2026-09-01): **feat: add number helpers**
  *Symptoms*: ### ❓ Type of change  - [ ] 🐞 Bug fix (a non-breaking change that fixes an issue) - [ ] 👌 Enhancement (improving an existing functionality like performance) - [x] ✨ New feature (a non-breaking change that adds functionality) - [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)  ### 📚 Description  Adds a `number` helpers module, available as `@adonisjs/core/helpers/number`.  Methods:  - `clamp(value, min, max)` — constrain a number to the given bounds - `between(value, min, max)` — check whether a number is inside an inclusive range (bounds may be passed in either order) - `toFinite(value, fallback?)` — convert a value to a finite number, or return the fallback (default `0`) - `parse(value)` — convert a value to a finite number, or return `null` - `format(value, options?)` — format a number via `Intl.NumberFormat` (`digits`, `compact`)  The same helpers are registered as the Edge global `number`.  Unit and Edge tests cover all methods, including `format`.  ### 📝 Checklist  - [ ] I have linked an issue or discussion. - [ ] I have updated the documentation accordingly.
  **Post-Mortem & Fix Analysis**:
  > Hey! 👋🏻   Thanks for the contribution.  I think these generic number helpers would fit better in `@poppinss/utils`, alongside the existing string and other low-level utilities. Core could re-export them later if needed.  I would also remove `format`. Number formatting is locale-dependent, and hardcoding `en` bypasses the application and request locale. This behavior is already owned by `@adonisjs/i18n` through `i18n.formatNumber`.  
  > Hi! Thank you! I'll take that into account

- **Issue #5144** (2026-09-23): **chore(deps): bump adonisjs/core/.github/workflows/test.yml from 7.4.0 to 7.5.0**
  *Symptoms*: Bumps [adonisjs/core/.github/workflows/test.yml](https://github.com/adonisjs/core) from 7.4.0 to 7.5.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/adonisjs/core/releases">adonisjs/core/.github/workflows/test.yml's releases</a>.</em></p> <blockquote> <h2>Introducing the codegen command</h2> <h1><a href="https://github.com/adonisjs/core/compare/v7.4.0...v7.5.0">7.5.0</a> (2026-08-21)</h1> <h3>Features</h3> <ul> <li>add codegen command to generate application types and index files (<a href="https://redirect.github.com/adonisjs/core/issues/5136">#5136</a>) (<a href="https://github.com/adonisjs/core/commit/16343cc767c28e659a56ea4471326063c6488893">16343cc</a>)</li> </ul> <h2>What's Changed</h2> <ul> <li>feat: add codegen command to generate application types and index files by <a href="https://github.com/DavideCarvalho"><code>@​DavideCarvalho</code></a> in <a href="https://redirect.github.com/adonisjs/core/pull/5136">adonisjs/core#5136</a></li> <li>chore(deps): bump adonisjs/core/.github/workflows/test.yml from 7.3.5 to 7.4.0 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/adonisjs/core/pull/5138">adonisjs/core#5138</a></li> <li>chore(deps): bump actions/checkout from 7.0.0 to 7.0.1 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/adonisjs/core/pull/5139">adonisjs/core#5139</a></li> </ul> <h2>New 

- **Issue #5143** (2026-08-27): **`node ace codegen` does not exit when a preload resolves a service that holds a timer**
  *Symptoms*: `node ace codegen` generates its files, prints `Codegen files generated`, and then does not exit.  Reproduction: https://github.com/jakeklassen/adonis-codegen-warmup-hang  ```bash git clone https://github.com/jakeklassen/adonis-codegen-warmup-hang.git cd adonis-codegen-warmup-hang pnpm install node ace codegen ```  It is a stock `create-adonisjs` app plus `node ace add @adonisjs/transmit`, then the two things the [SSE guide](https://docs.adonisjs.com/guides/digging-deeper/server-sent-events) prescribes: `pingInterval: '30s'` in `config/transmit.ts`, and a `start/transmit.ts` preload calling `transmit.authorize(...)`. `node ace add` scaffolds `pingInterval: false`, so a stock install does not reproduce.  To measure it, read `$?` directly — piping into `head`/`tail` reports the pager's status instead:  ```bash timeout -s KILL 30 node ace codegen > /tmp/codegen.log 2>&1; echo "exit=$?" # exit=137 ```  `Application.terminate()` skips provider shutdown in warmup mode, on the basis that a warmed up app "never gets started and therefore it has nothing to tear down".  The preload resolves a service before that point: `start/transmit.ts` imports `@adonisjs/transmit/services/main`, which constructs `Transmit` and starts a refed `setInterval` for pings. It is cleared in `Transmit.shutdown()`, which does not run, so the process stays alive. The same would apply to any service resolved during warmup that holds a refed handle.  ## Environment  | | | | --- | --- | | `@adonisjs/core` | 7.5.0
  **Post-Mortem & Fix Analysis**:
  > Hey! 👋🏻   In fact, that's an issue in Transmit itself. I am going to push a fix.
  > Released as `3.0.2`! Let me know if you still have an issue 🙌🏻 
  > @RomainLanz looks good! Thanks 👍 

- **Issue #5142** (2026-08-21): **adonisjs/assembler@8.5.0 break build on core@7.4.0**
  *Symptoms*: ### Package version  7.4.0  ### Describe the bug  ### Describe the bug  `node ace build` (and plain `tsc --noEmit`) fails on a stock `adonisrc.ts` that registers the `indexEntities()` assembler hook, as soon as `@adonisjs/assembler` resolves to 8.5.0.  `@adonisjs/assembler@8.5.0` (published 2026-08-19, via adonisjs/assembler#100 — *"feat: add CodeGen to run the codegen without the dev-server"*) widened the `init` hook parent union in `src/types/hooks.d.ts`:  ```ts export type CommonHooks = {   init: DefineHook<     (parent: DevServer | TestRunner | Bundler | CodeGen, hooks: Hooks<…>, indexGenerator: IndexGenerator)       => AsyncOrSync<void>   >[] } ```  The **published type declaration** of `indexEntities()` in `@adonisjs/core` still hardcodes the old three-member union, so the hook is no longer assignable to the slot it exists to fill.  Since `@adonisjs/core` declares `"@adonisjs/assembler": "^8.0.0-next.23 || ^8.0.0"` as a peer dependency, any fresh install of a current core release pulls 8.5.0 and breaks. There is currently no combination of published versions that type-checks — Both 7.3.5 and 7.4.0 (latest) emit the narrow union.  ### Reproduction  Any AdonisJS 7 app whose `adonisrc.ts` has the default hook block:  ```ts import { indexEntities } from '@adonisjs/core' import { defineConfig } from '@adonisjs/core/app'  export default defineConfig({   hooks: {     init: [indexEntities({ transformers: { enabled: true } })],   }, }) ```  Steps:  1. `npm i @adonisjs/core@7.4.0
  **Post-Mortem & Fix Analysis**:
  > Same issue with `indexPolicies()` from `@adonisjs/bouncer` and `indexPages()` from `@adonisjs/inertia`
  > same here
  > Fixed in https://github.com/adonisjs/core/releases/tag/v7.5.0

- **Issue #5139** (2026-08-21): **chore(deps): bump actions/checkout from 7.0.0 to 7.0.1**
  *Symptoms*: Bumps [actions/checkout](https://github.com/actions/checkout) from 7.0.0 to 7.0.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/checkout/releases">actions/checkout's releases</a>.</em></p> <blockquote> <h2>v7.0.1</h2> <h2>What's Changed</h2> <ul> <li>skip running unsafe pr check if input is default by <a href="https://github.com/aiqiaoy"><code>@​aiqiaoy</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2518">actions/checkout#2518</a></li> <li>trim only ascii whitespace for branch by <a href="https://github.com/aiqiaoy"><code>@​aiqiaoy</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2521">actions/checkout#2521</a></li> <li>escape values passed to --unset by <a href="https://github.com/aiqiaoy"><code>@​aiqiaoy</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2530">actions/checkout#2530</a></li> <li>Various dependency updates</li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/actions/checkout/compare/v7...v7.0.1">https://github.com/actions/checkout/compare/v7...v7.0.1</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/actions/checkout/compare/v7...v7.0.1">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=actions/checkout&package-manager=github_ac

- **Issue #5138** (2026-08-21): **chore(deps): bump adonisjs/core/.github/workflows/test.yml from 7.3.5 to 7.4.0**
  *Symptoms*: Bumps [adonisjs/core/.github/workflows/test.yml](https://github.com/adonisjs/core) from 7.3.5 to 7.4.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/adonisjs/core/releases">adonisjs/core/.github/workflows/test.yml's releases</a>.</em></p> <blockquote> <h2>Codegen for defining Data.FlashMessages type</h2> <h1><a href="https://github.com/adonisjs/core/compare/v7.3.5...v7.4.0">7.4.0</a> (2026-08-09)</h1> <h3>Features</h3> <ul> <li>generate FlashMessages type inside the Data namespace (<a href="https://github.com/adonisjs/core/commit/22e2a39f63d4ebafc6c01763d74b51c61ccb3dc1">22e2a39</a>)</li> </ul> <h2>What's Changed</h2> <ul> <li>chore(deps): bump actions/setup-node from 6.4.0 to 7.0.0 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/adonisjs/core/pull/5130">adonisjs/core#5130</a></li> <li>chore(deps): bump actions/checkout from 6 to 7 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/adonisjs/core/pull/5127">adonisjs/core#5127</a></li> <li>chore(deps): bump adonisjs/core/.github/workflows/test.yml from 7.3.4 to 7.3.5 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/adonisjs/core/pull/5128">adonisjs/core#5128</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/adonisjs/core/compare/v7.3.5...v7.4.0">https:

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

### Incident Patch 1: `184621fc` (2026-09-23)
**Commit Message**: fix: fail the build when commands index generation fails

The toolkit never propagated the Ace kernel exit code, so a failing
`index:commands` step exited with 0. This let 7.5.1 get published
without build/commands/main.js and commands.json.

Also verify the build output in the release workflow before publishing.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `.github/workflows/release.yml` (modified, +6/-0)
```diff
@@ -41,6 +41,12 @@ jobs:
 
       - run: npm audit signatures
 
+      - name: Verify build output
+        run: |
+          npm run build
+          test -f build/commands/main.js
+          test -f build/commands/commands.json
+
       - run: npm run release -- --ci
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `toolkit/main.ts` (modified, +1/-0)
```diff
@@ -31,3 +31,4 @@ kernel.on('help', async (command, $kernel, parsed) => {
 })
 
 await kernel.handle(process.argv.splice(2))
+process.exitCode = kernel.exitCode
```

---

### Incident Patch 2: `d5be6ced` (2026-08-09)
**Commit Message**: test: fix breaking tests

**File**: `tests/index_generator.spec.ts` (modified, +4/-2)
```diff
@@ -229,7 +229,7 @@ test.group('Index generator', () => {
 
       /// <reference path=\\"./manifest.d.ts\\" />
       import type { InferData, InferVariants } from '@adonisjs/core/types/transformers'
-      import type { InferSharedProps } from '@adonisjs/inertia/types'
+      import type { InferSharedProps, InferFlashData } from '@adonisjs/inertia/types'
       import type BlogPostTransformer from '#transformers/blog/post_transformer'
       import type UserTransformer from '#transformers/user_transformer'
       import type InertiaMiddleware from '#middleware/inertia_middleware'
@@ -246,6 +246,7 @@ test.group('Index generator', () => {
           export type Variants = InferVariants<UserTransformer>
         }
         export type SharedProps = InferSharedProps<InertiaMiddleware>
+        export type FlashMessages = InferFlashData<InertiaMiddleware>
       }
       "
     `)
@@ -296,7 +297,7 @@ test.group('Index generator', () => {
 
       /// <reference path=\\"./manifest.d.ts\\" />
       import type { InferData, InferVariants } from '@adonisjs/core/types/transformers'
-      import type { InferSharedProps } from '@adonisjs/inertia/types'
+      import type { InferSharedProps, InferFlashData } from '@adonisjs/inertia/types'
       import type BlogPostTransformer from '#transformers/blog/post_transformer'
       import type UserTransformer from '#transformers/user_transformer'
       import type InertiaMiddleware from '#core/middleware/inertia_middleware'
@@ -313,6 +314,7 @@ test.group('Index generator', () => {
           export type Variants = InferVariants<UserTransformer>
         }
         export type SharedProps = InferSharedProps<InertiaMiddleware>
+        export type FlashMessages = InferFlashData<InertiaMiddleware>
       }
       "
     `)
```

---

### Incident Patch 3: `6a7f3a26` (2026-07-08)
**Commit Message**: fix: typing issues

**File**: `modules/ace/codemods.ts` (modified, +1/-1)
```diff
@@ -627,7 +627,7 @@ export class Codemods extends EventEmitter {
    */
   async installPackages(
     packages: { name: string; isDevDependency: boolean }[],
-    packageManager?: SupportedPackageManager
+    packageManager?: SupportedPackageManager | 'pnpm@6' | 'deno' | 'nub' | 'aube'
   ): Promise<boolean> {
     const transformer = await this.#getCodeTransformer()
     const appPath = this.#app.makePath()
```

---

### Incident Patch 4: `0758f84b` (2026-07-08)
**Commit Message**: fix(vine): accept File and Blob as input types for VineMultipartFile

The client sends a File or Blob (via FormData) that BodyParser converts
into a MultipartFile at the request seam. Widen the InferInput type to
reflect what a client can actually send, while keeping Infer as
MultipartFile for the validated server-side value.

**File**: `src/vine.ts` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ const isMultipartFile = vine.createRule<FileRuleValidationOptions>((file, option
  * })
  */
 export class VineMultipartFile extends BaseLiteralType<
-  MultipartFile,
+  MultipartFile | File | Blob,
   MultipartFile,
   MultipartFile
 > {
```

**File**: `tests/bindings/vinejs.spec.ts` (modified, +115/-1)
```diff
@@ -8,10 +8,15 @@
  */
 
 import vine from '@vinejs/vine'
+import supertest from 'supertest'
 import { test } from '@japa/runner'
+import { createServer } from 'node:http'
+import type { InferInput, Infer } from '@vinejs/vine/types'
+import type { MultipartFile } from '@adonisjs/bodyparser/types'
 
 import { IgnitorFactory } from '../../factories/core/ignitor.ts'
-import { MultipartFileFactory } from '../../factories/bodyparser.ts'
+import { TestUtilsFactory } from '../../factories/core/test_utils.ts'
+import { MultipartFileFactory, BodyParserMiddlewareFactory } from '../../factories/bodyparser.ts'
 
 const BASE_URL = new URL('./tmp/', import.meta.url)
 
@@ -251,4 +256,113 @@ test.group('Bindings | VineJS', (group) => {
       ])
     }
   })
+
+  test('infer File and Blob as valid input types for the file schema', ({ expectTypeOf }) => {
+    const schema = vine.object({
+      avatar: vine.file(),
+    })
+
+    /**
+     * InferInput represents what the client is allowed to send. A browser
+     * can only send a File or a Blob (via FormData), never a MultipartFile.
+     */
+    expectTypeOf<InferInput<typeof schema>['avatar']>().toEqualTypeOf<MultipartFile | File | Blob>()
+
+    /**
+     * Infer represents the validated value available on the server, which
+     * is always a MultipartFile created by the BodyParser.
+     */
+    expectTypeOf<Infer<typeof schema>['avatar']>().toEqualTypeOf<MultipartFile>()
+  })
+})
+
+test.group('Bindings | VineJS | multipart uploads over HTTP', (group) => {
+  let testUtils: ReturnType<InstanceType<typeof TestUtilsFactory>['create']>
+
+  group.each.setup(async () => {
+    const ignitor = new IgnitorFactory()
+      .merge({
+        rcFileContents: {
+          providers: [
+            () => import('../../providers/app_provider.js'),
+            () => import('../../providers/hash_provider.js'),
+            () => import('../../providers/vinejs_provider.js'),
+          ],
+        },
+      })
+      .withCoreConfig()
+      .create(BASE_URL, {
+        importer(filePath: string) {
+          return import(new URL(filePath, new URL('../', import.meta.url)).href)
+        },
+      })
+
+    testUtils = new TestUtilsFactory().create(ignitor)
+    await testUtils.app.init()
+    await testUtils.app.boot()
+    await testUtils.boot()
+  })
+
+  test('convert File and Blob sent over HTTP into MultipartFile instances', async ({ assert }) => {
+    const bodyParser = new BodyParserMiddlewareFactory().create()
+    const validator = vine.create(
+      vine.object({
+        avatar: vine.file(),
+        document: vine.file(),
+      })
+    )
+
+    let validated: Infer<typeof validator> | undefined
+    let serverError: any
+
+    /**
+     * The server parses the incoming multipart request using the BodyParser
+     * middleware and then validates it using the "vine.file" schema. This
+     * mirrors exactly what happens during a real request lifecycle.
+     */
+    const server = createServer(async (req, res) => {
+      const ctx = await testUtils.createHttpContext({ req, res })
+      try {
+        await bodyParser.handle(ctx, async () => {
+          validated = await validator.validate({
+            avatar: ctx.request.file('avatar'),
+            document: ctx.request.file('document'),
+          })
+        })
+      } catch (error) {
+        serverError = error
+      }
+      res.end('done')
+    })
+
+    /**
+     * Sending a File and a Blob over the wire the same way a browser would.
+     * A File carries a filename ("avatar.jpg"), whereas a Blob is sent without
+     * one (defaulting to "blob"), yet BodyParser converts both to a MultipartFile.
+     */
+    await supertest(server)
+      .post('/')
+      .attach('avatar', Buffer.from('hello avatar'), 'avatar.jpg')
+      .attach('document', Buffer.from('hello document'), 'blob')
+
+    assert.isUndefined(serverError)
+    assert.isDefined(validated)
+
+    /**
+     * The File uploaded under "avatar" is converted i
```

---

### Incident Patch 5: `ca9131e3` (2026-06-05)
**Commit Message**: chore: harden release workflow for supply-chain security (#5113)

**File**: `.github/dependabot.yml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+version: 2
+updates:
+  - package-ecosystem: github-actions
+    directory: /
+    schedule:
+      interval: weekly
```

**File**: `.github/workflows/checks.yml` (modified, +6/-3)
```diff
@@ -3,14 +3,17 @@ on:
   - push
   - pull_request
   - workflow_call
+permissions:
+  contents: read
+
 jobs:
   test:
-    uses: adonisjs/core/.github/workflows/test.yml@7.x
+    uses: adonisjs/core/.github/workflows/test.yml@3605cb1dc67afb14f818a3d3a7214991d262c336 # 7.x
     with:
       install-pnpm: true
 
   lint:
-    uses: adonisjs/.github/.github/workflows/lint.yml@main
+    uses: adonisjs/.github/.github/workflows/lint.yml@7eeb68b240344601ced8ef4fbe0b4dd31df0760b # main
 
   typecheck:
-    uses: adonisjs/.github/.github/workflows/typecheck.yml@main
+    uses: adonisjs/.github/.github/workflows/typecheck.yml@7eeb68b240344601ced8ef4fbe0b4dd31df0760b # main
```

**File**: `.github/workflows/release.yml` (modified, +20/-11)
```diff
@@ -1,37 +1,46 @@
 name: release
 on: workflow_dispatch
+
 permissions:
-  contents: write
-  id-token: write
+  contents: read
+
+concurrency:
+  group: release
+  cancel-in-progress: false
+
 jobs:
   checks:
+    permissions:
+      contents: read
     uses: ./.github/workflows/checks.yml
+    secrets: inherit
+
   release:
     needs: checks
     runs-on: ubuntu-latest
+    environment: npm-publish
+    permissions:
+      contents: write
+      id-token: write
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
         with:
           fetch-depth: 0
 
-      - uses: actions/setup-node@v4
+      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
         with:
           node-version: 24
+          registry-url: 'https://registry.npmjs.org'
 
       - name: git config
         run: |
           git config user.name "${GITHUB_ACTOR}"
           git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"
 
-      - name: Init npm config
-        run: npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN
-        env:
-          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
+      - run: npm install --ignore-scripts
 
-      - run: npm install
+      - run: npm audit signatures
 
       - run: npm run release -- --ci
         env:
-          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**File**: `.github/workflows/test.yml` (modified, +7/-4)
```diff
@@ -12,6 +12,9 @@ on:
         default: false
         required: false
 
+permissions:
+  contents: read
+
 jobs:
   test_linux:
     runs-on: ubuntu-latest
@@ -21,10 +24,10 @@ jobs:
 
     steps:
       - name: Checkout code
-        uses: actions/checkout@v4
+        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
 
       - name: Setup Node.js
-        uses: actions/setup-node@v4
+        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
         with:
           node-version: ${{ matrix.node-version }}
 
@@ -49,10 +52,10 @@ jobs:
 
     steps:
       - name: Checkout code
-        uses: actions/checkout@v4
+        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
 
       - name: Setup Node.js
-        uses: actions/setup-node@v4
+        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
         with:
           node-version: ${{ matrix.node-version }}
 
```

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -11,7 +11,6 @@ build
 dist
 yarn.lock
 shrinkwrap.yaml
-package-lock.json
 test/__app
 .env
 backup
```

---

### Incident Patch 6: `9c3523f2` (2026-06-05)
**Commit Message**: fix(encryption): make Legacy driver a true drop-in for old encrypter

The Legacy driver generated the IV using `randomBytes(16)` (raw binary),
but the old "@adonisjs/encryption" implementation generates the IV via
`string.random(16)` and treats it as a utf-8 string throughout its
encrypt/decrypt pipeline. As a result, values encrypted by the Legacy
driver could not be decrypted by the old encrypter, since its decrypt
path reconstructs the IV as a utf-8 string and the raw binary bytes do
not survive that round-trip.

Generate the IV as a 16-character string to match the old format exactly.
Decryption is unaffected (it reads the IV as a Buffer), so values already
encrypted by the Legacy driver continue to decrypt without migration.

Add bidirectional backward-compatibility tests (old <-> Legacy) covering
string and non-string payloads, purposes, and an IV-format invariant.

**File**: `modules/encryption/drivers/legacy.ts` (modified, +10/-2)
```diff
@@ -7,9 +7,10 @@
  * file that was distributed with this source code.
  */
 
+import string from '@poppinss/utils/string'
 import { errors } from '@boringnode/encryption'
 import { MessageBuilder, type Secret } from '@poppinss/utils'
-import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
+import { createCipheriv, createDecipheriv } from 'node:crypto'
 import { BaseDriver, Hmac, base64UrlDecode, base64UrlEncode } from '@boringnode/encryption'
 import type {
   CypherText,
@@ -117,7 +118,14 @@ export class Legacy extends BaseDriver implements EncryptionDriverContract {
       actualPurpose = purpose
     }
 
-    const iv = randomBytes(16)
+    /**
+     * The IV is a random 16-character string (not raw bytes). The old
+     * AdonisJS v6 "@adonisjs/encryption" implementation generates the IV
+     * via `string.random(16)` and treats it as a utf-8 string throughout
+     * its encrypt/decrypt pipeline. We must mirror that exactly, otherwise
+     * values encrypted here cannot be decrypted by the old encrypter.
+     */
+    const iv = string.random(16)
 
     /**
      * Use the first 32 bytes of the key for AES-256
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -83,6 +83,7 @@
   },
   "devDependencies": {
     "@adonisjs/assembler": "^8.4.0",
+    "@adonisjs/encryption": "^6.0.2",
     "@adonisjs/eslint-config": "^3.1.0",
     "@adonisjs/prettier-config": "^1.5.0",
     "@adonisjs/tsconfig": "^2.0.0",
```

**File**: `tests/encryption/legacy.spec.ts` (modified, +88/-8)
```diff
@@ -8,6 +8,7 @@
  */
 
 import { test } from '@japa/runner'
+import { Encryption } from '@adonisjs/encryption'
 import { setTimeout } from 'node:timers/promises'
 
 import type { ApplicationService } from '../../src/types.ts'
@@ -227,21 +228,31 @@ test.group('Legacy | factory', () => {
 })
 
 test.group('Legacy | backward compatibility', () => {
-  test('decrypt value encrypted with old AdonisJS v6 encryption', ({ assert }) => {
+  /**
+   * old encrypter -> Legacy driver
+   */
+  test('Legacy decrypts a value encrypted by the old AdonisJS v6 encrypter', ({ assert }) => {
     const encryption = new Legacy({ key: SECRET_KEY })
+    const oldEncryptor = new Encryption({ secret: SECRET_KEY })
 
-    const encryptedByOldSystem =
-      'WtKqAdiMsHKkm8NJ48U8elvrqqlNZF3gbPR0yHqdAEs.cGVBcldtc18tWDlzWHg0Zw.nBYFM-3atE7LnGlqIGTSybo-dv-HNPxnmmOmWzafZYA'
-    const decrypted = encryption.decrypt<string>(encryptedByOldSystem)
-
+    const decrypted = encryption.decrypt<string>(oldEncryptor.encrypt('test'))
     assert.equal(decrypted, 'test')
   })
 
-  test('decrypt value encrypted with old AdonisJS v6 encryption with purpose', ({ assert }) => {
+  test('Legacy decrypts non-string values encrypted by the old encrypter', ({ assert }) => {
+    const encryption = new Legacy({ key: SECRET_KEY })
+    const oldEncryptor = new Encryption({ secret: SECRET_KEY })
+
+    const payload = { name: 'John', roles: ['admin', 'user'], age: 30, active: true }
+    const decrypted = encryption.decrypt<typeof payload>(oldEncryptor.encrypt(payload))
+    assert.deepEqual(decrypted, payload)
+  })
+
+  test('Legacy decrypts a value encrypted by the old encrypter with a purpose', ({ assert }) => {
     const encryption = new Legacy({ key: SECRET_KEY })
+    const oldEncryptor = new Encryption({ secret: SECRET_KEY })
 
-    const encryptedByOldSystem =
-      '7xxhKUhXeeZJ-CnNNh5TFuPQ0jbkhFoaU-YEQCm-vbzC2CQUKSSlvFnNak-ZP6Nt.UURhOWQzb0Fqajh2MU9YVQ.4ktctGpLDjBPWbLMO3zF2Q38Ta8b4UWT2oRETKKp0Dw'
+    const encryptedByOldSystem = oldEncryptor.encrypt('test', undefined, 'blabla')
 
     const decrypted = encryption.decrypt<string>(encryptedByOldSystem, 'blabla')
     assert.equal(decrypted, 'test')
@@ -252,6 +263,75 @@ test.group('Legacy | backward compatibility', () => {
     const decryptedWrongPurpose = encryption.decrypt(encryptedByOldSystem, 'wrong')
     assert.isNull(decryptedWrongPurpose)
   })
+
+  /**
+   * Legacy driver -> old encrypter (the drop-in replacement guarantee)
+   */
+  test('old AdonisJS v6 encrypter decrypts a value encrypted by the Legacy driver', ({
+    assert,
+  }) => {
+    const encryption = new Legacy({ key: SECRET_KEY })
+    const oldEncryptor = new Encryption({ secret: SECRET_KEY })
+
+    const decrypted = oldEncryptor.decrypt<string>(encryption.encrypt('test'))
+    assert.equal(decrypted, 'test')
+  })
+
+  test('old encrypter decrypts non-string values encrypted by the Legacy driver', ({ assert }) => {
+    const encryption = new Legacy({ key: SECRET_KEY })
+    const oldEncryptor = new Encryption({ secret: SECRET_KEY })
+
+    const payload = { name: 'John', roles: ['admin', 'user'], age: 30, active: true }
+    const decrypted = oldEncryptor.decrypt<typeof payload>(encryption.encrypt(payload))
+    assert.deepEqual(decrypted, payload)
+  })
+
+  test('old encrypter decrypts a value encrypted by the Legacy driver with a purpose', ({
+    assert,
+  }) => {
+    const encryption = new Legacy({ key: SECRET_KEY })
+    const oldEncryptor = new Encryption({ secret: SECRET_KEY })
+
+    const encryptedByLegacy = encryption.encrypt('test', undefined, 'blabla')
+
+    assert.equal(oldEncryptor.decrypt<string>(encryptedByLegacy, 'blabla'), 'test')
+    assert.isNull(oldEncryptor.decrypt(encryptedByLegacy))
+    assert.isNull(oldEncryptor.decrypt(encryptedByLegacy, 'wrong'))
+  })
+
+  /**
+   * The IV must be encoded the exact same way by both implementations: a
+   * random 16-character string whose base64url form decodes back to 1
```

---

### Incident Patch 7: `9bf10006` (2026-03-26)
**Commit Message**: test: fix breaking tests

**File**: `tests/request_validator.spec.ts` (modified, +7/-7)
```diff
@@ -24,7 +24,7 @@ const BASE_URL = new URL('./tmp/', import.meta.url)
 
 test.group('Request validator', () => {
   test('perform validation on request data using request validator', async ({ assert }) => {
-    assert.plan(1)
+    assert.plan(2)
 
     const ignitor = new IgnitorFactory()
       .withCoreConfig()
@@ -61,7 +61,7 @@ test.group('Request validator', () => {
           {
             field: 'username',
             message: 'The username field must be defined',
-            rule: 'validations.required',
+            rule: 'required',
           },
         ])
       }
@@ -171,7 +171,7 @@ test.group('Request validator', () => {
   })
 
   test('pass metadata to validator', async ({ assert }) => {
-    assert.plan(1)
+    assert.plan(2)
 
     const ignitor = new IgnitorFactory()
       .withCoreConfig()
@@ -221,7 +221,7 @@ test.group('Request validator', () => {
   })
 
   test('use custom messages provider', async ({ assert, cleanup }) => {
-    assert.plan(1)
+    assert.plan(2)
 
     const ignitor = new IgnitorFactory()
       .withCoreConfig()
@@ -267,16 +267,16 @@ test.group('Request validator', () => {
         assert.deepEqual(error.messages, [
           {
             field: 'username',
-            message: 'The selected username is invalid',
-            rule: 'notIn',
+            message: 'The value is missing',
+            rule: 'required',
           },
         ])
       }
     }
   })
 
   test('use custom error reporter', async ({ assert, cleanup }) => {
-    assert.plan(1)
+    assert.plan(2)
 
     const ignitor = new IgnitorFactory()
       .withCoreConfig()
```

---

### Incident Patch 8: `9d7c8fc4` (2026-03-21)
**Commit Message**: fix: update validator test to use vine.create

**File**: `tests/stubs/make_validator.spec.ts` (modified, +2/-6)
```diff
@@ -49,12 +49,8 @@ test.group('Make validator', () => {
     assert.equal(destination, join(BASE_PATH, 'app/validators/post.ts'))
     assert.match(contents, new RegExp("import vine from '@vinejs/vine'"))
     assert.includeMembers(contents.split('\n'), [
-      `export const createPostValidator = vine.compile(`,
-      `  vine.object({})`,
-      `)`,
-      `export const updatePostValidator = vine.compile(`,
-      `  vine.object({})`,
-      `)`,
+      `export const createPostValidator = vine.create({})`,
+      `export const updatePostValidator = vine.create({})`,
     ])
   })
 })
```

---

### Incident Patch 9: `487246a9` (2026-03-21)
**Commit Message**: fix: replace vine.compile with vine.create in validator stub (#5082)

* fix: replace vine.compile with vine.create in validator stub

* refactor: validator creation by eliminating vine.object

Removed unnecessary vine.object wrapper from validator creation for cleaner code.

**File**: `stubs/make/validator/resource.stub` (modified, +2/-6)
```diff
@@ -13,14 +13,10 @@ import vine from '@vinejs/vine'
  * Validator to validate the payload when creating
  * a new {{ validatorName }}.
  */
-export const {{ createAction }} = vine.compile(
-  vine.object({})
-)
+export const {{ createAction }} = vine.create({})
 
 /**
  * Validator to validate the payload when updating
  * an existing {{ validatorName }}.
  */
-export const {{ updateAction }} = vine.compile(
-  vine.object({})
-)
+export const {{ updateAction }} = vine.create({})
```

---

### Incident Patch 10: `038fc87c` (2026-03-18)
**Commit Message**: fix: enable manifest explicitly

**File**: `src/assembler_hooks/index_entities.ts` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ export function indexEntities(entities: IndexEntitiesConfig = {}) {
     entities.transformers
   )
   const manifest = {
-    enabled: entities.manifest?.enabled === false ? false : transformers.enabled,
+    enabled: entities.manifest?.enabled ?? transformers.enabled,
     source: 'config',
     output: '.adonisjs/client/manifest.d.ts',
     exclude: entities.manifest?.exclude ?? [
```

**File**: `tests/index_generator.spec.ts` (modified, +35/-0)
```diff
@@ -591,4 +591,39 @@ test.group('Index generator', () => {
 
     await assert.fileNotExists('.adonisjs/client/manifest.d.ts')
   })
+
+  test('generate manifest file when explicitly enable without enabling transformers', async ({
+    assert,
+    fs,
+  }) => {
+    const cliUi = Kernel.create().ui
+    cliUi.switchMode('raw')
+
+    await fs.create('config/app.ts', '')
+    await fs.create('config/hash.ts', '')
+    await fs.create('config/auth.ts', '')
+
+    const generator = new IndexGenerator(stringHelpers.toUnixSlash(fs.basePath), cliUi.logger)
+    const indexer = indexEntities({
+      manifest: {
+        enabled: true,
+      },
+    })
+
+    indexer.run({} as any, {} as any, generator)
+    await generator.generate()
+
+    await assert.fileExists('.adonisjs/client/manifest.d.ts')
+    assert.snapshot(await fs.contents('.adonisjs/client/manifest.d.ts')).matchInline(`
+      "/**
+       * This file is automatically generated.
+       * DO NOT EDIT manually
+       */
+
+      /// <reference path=\\"../../adonisrc.ts\\" />
+      /// <reference path=\\"../../config/auth.ts\\" />
+      /// <reference path=\\"../../config/hash.ts\\" />
+      "
+    `)
+  })
 })
```

#### Recent Merged Pull Requests:
- **PR #5147** (closed): feat: connect number helpers from @poppinss/utils (@deformator852)
- **PR #5146** (2026-09-13): perf: enable faster Ace bootstrap with targeted exports (@RomainLanz)
- **PR #5145** (closed): feat: add number helpers (@deformator852)
- **PR #5144** (2026-09-23): chore(deps): bump adonisjs/core/.github/workflows/test.yml from 7.4.0 to 7.5.0 (@dependabot[bot])
- **PR #5139** (2026-08-21): chore(deps): bump actions/checkout from 7.0.0 to 7.0.1 (@dependabot[bot])
- **PR #5138** (2026-08-21): chore(deps): bump adonisjs/core/.github/workflows/test.yml from 7.3.5 to 7.4.0 (@dependabot[bot])
- **PR #5137** (closed): fix: honor configured controller directory in barrel generation (@tonycoder-hub)
- **PR #5136** (2026-08-21): feat: add codegen command to generate application types and index files (@DavideCarvalho)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
