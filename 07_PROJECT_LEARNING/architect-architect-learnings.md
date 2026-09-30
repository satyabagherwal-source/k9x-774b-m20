# Forensic Learning Record (Deep Inspection): architect/architect

> **Canonical Artifact**: `07_PROJECT_LEARNING/architect-architect-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/architect/architect](https://github.com/architect/architect))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:35:57.936Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `architect/architect`
- **Description**: The simplest, most powerful way to build a functional web app (fwa)
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json
- **Stars / Engagement**: 2625 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.js`
```
const arc = require('@architect/eslint-config')

module.exports = [
  ...arc,
  {
    ignores: [
      '.nyc_output/',
      'coverage/',
      'node_modules/',
    ],
  },
]

```

### Core Architecture Module: `src/help/index.js`
```
let chalk = require('@architect/utils/chalk')
let d = chalk.grey
let D = chalk.grey.bold
let g = chalk.green
let G = chalk.green.bold
let b = chalk.bold

let helps = {
  help: `${G('arc [command] <options>')}

${D('Global Commands')}
  ${g('arc', G('<init|create>'), '[name or path]')} ${d('.......... initialize new arc project')}
  ${g('arc', G('help'), '<command>')} ${d('........................ get help')}
  ${g('arc', G('version'))} ${d('............................... get the current version')}
${D('Project Commands')}
  ${g('arc', G('<init|create>'))} ${d('......................... idempotently initialize project files')}
  ${g('arc', G('sandbox'))} ${d('............................... start a local arc development server')}
  ${g('arc', G('deploy'), '[direct|static|production]')} ${d('..... deploy to AWS')}
  ${g('arc', G('logs'), 'path/to/fn', '[production|destroy]')} ${d('.. manage function logs')}
  ${g('arc', G('env'))} ${d('................................... work with environment variables')}
  ${g('arc', G('destroy'))} ${d('............................... destroy your current project')}
`,

  init: `${G('arc <init|create>')} ${g('[name or path] [options]')}
Generate a new arc project at the specified path, or if run in an existing arc project, idempotently initialize any missing function directories.
When used with the ${g('--plugin')} flag, generates a new arc plugin project at the specified path instead.
When ${b('no arguments are passed')}, arc will look for an app.arc file in the local directory and idempotently initialize any resources defined in it; that is, if they do not exist, they will be created locally.
When passed a ${b('path-like argument')}, arc will create a new project in the specified path (including an app.arc project manifest file).
When passed ${b('any other argument')}, arc will create a new project with that argument as the app name in the current working directory (including an app.arc project manifest file).

${D('Options')}
  ${g(`-n${d(',')}`, '--name')} ${d('............ app name; sets `@app` in your app.arc file')}
  ${g('--no-install')} ${d('.......... do not automatically install `@architect/architect` as a dependency in the project')}
  ${g(`-p${d(',')}`)} ${g('--plugin')} ${d('.......... create a scaffolded architect plugin project')}
  ${g(`-r${d(',')}`, `--runtime ${d('......... initialize project with a specific runtime. If unspecified, will default to node. Can be one of:')}`)}
    ${d(D('node'), ',', D('js'), '..... nodejs22.x')}
    ${d(D('deno'), '.......... deno')}
    ${d(D('rb'), ',', D('ruby'), '..... ruby3.3')}
    ${d(D('python'), ',', D('py'), '... python3.13')}
  ${g(`-v${d(',')}`)} ${g('--verbose')} ${d('......... run in verbose mode')}`
  ,

  deploy: `${G('arc deploy')} ${g('[options]')}
Deploy your app, as defined in your app.arc manifest, to a CloudFormation Stack. The @app name and environment (more on this below) determine the Stack your application will deploy to. Furthermore, Stacks are unique per region therefore changing your target AWS region will change the target Stack to deploy to.
By default, this command deploys a staging version of your application to a dedicated CloudFormation Stack. By providing the ${g('-p')} or ${g('--production')} flag you can deploy to a separate production Stack.
You can target additional Stacks by using the ${g('--name')} flag; this will append the provided name to the Stack name and is a technique to create arbitrary additional deployment environments beyond staging and production.
When passed the ${g('--direct')} flag in conjunction with a path-like argument to a Lambda source directory, instead of a full CloudFormation deploy, arc will only deploy source code for the provided Lambda. This will be much faster and may be helpful when wanting to deploy small, isolated changes.

${D('Options')}
  ${g(`--direct`, '<path/to/function>')} ${d('... directly deploy only provided function code and config by uploading and overwriting; optionally specify a path to one or more functions to only deploy the specified functions')}
  ${g('--dry-run')} ${d('..................... generate a CloudFormation template but do not deploy it; handy to validate CloudFormation and SAM output or to test Architect plugins')}
  ${g('--eject')} ${d('....................... generate a CloudFormation template but do not deploy it and print the `aws cloudformation` command to run to deploy it')}
  ${g(`-f${d(',')}`, `--fast`)} ${d('.................... deploy the Stack but do not wait until deployment completes')}
  ${g(`-n${d(',')}`, `--name`)} ${d(`.................... append to Stack name, i.e. ${D('--name CI')} results in a Stack name of ${D('AppNameStagingCI')}`)}
  ${g('--no-hydrate')} ${d('.................. skip hydrating functions before deploy; arc will not try to install dependencies in each of your function directories')}
  ${g(`-p${d(',')}`, `--production`)} ${d(`.............. set environment to production, i.e. ${D('--production')} results in a Stack name of ${D('AppNameProduction')}`)}
  ${g(`--prune`)} ${d('....................... delete orphaned static files from the static S3 bucket; files that are not present in the local @static directory (by default in /public) will be removed')}
  ${g(`-s${d(',')}`, `--static`)} ${d('.................. only upload static assets (by default in /public) to the static S3 bucket')}
  ${g(`-t${d(',')}`, `--tags`)} ${d('.................... add tags to Stack')}
  ${g(`-v${d(',')}`, `--verbose`)} ${d('................. print more output to console')}
  ${g(`-d${d(',')}`, `--debug`)} ${d('................... print even more output to console')}
`,

  sandbox: `${G('arc sandbox')} ${g('[options]')}
Start a local development server that emulates AWS infrastructure for your Architect application. Sandbox provides a complete local development environment that includes:

- HTTP server for your @http routes
- WebSocket server for @ws routes
- Dynalite in-memory database for @tables and @indexes
- Local event bus for @events and @queues
- Static asset serving for @static assets
- File watching and live reloading

${D('Options')}
  ${g(`-p${d(',')} --port`)} ${d('........................ port the HTTP server will listen on (default is 3333)')}
  ${g(`-h${d(',')} --host`)} ${d('........................ host the server will bind to')}
  ${g(`--disable-symlinks`)} ${d('................ do not use symlinks for shared code; use file copying instead (slower)')}
  ${g(`--disable-delete-vendor`)} ${d('........... do not delete node_modules or vendor directories upon startup')}
  ${g(`-q${d(',')} --quiet`)} ${d('....................... minimize console output during operation')}
  ${g(`-v${d(',')} --verbose`)} ${d('..................... print more detailed output during operation')}
  ${g(`-d${d(',')} --debug`)} ${d('....................... print even more detailed information for debugging')}

${D('Environment Variables')}
  ${d(`${g('ARC_DB_EXTERNAL')} ................... use an external DynamoDB tool (such as AWS NoSQL Workbench)`)}
  ${d(`${g('ARC_HTTP_PORT')}, ${g('PORT')} ............... set the HTTP server port (same as --port)`)}
  ${d(`${g('ARC_EVENTS_PORT')} ................... set the events/queues service port (default 4444)`)}
  ${d(`${g('ARC_TABLES_PORT')} ................... set the DynamoDB emulator port (default 5555)`)}
  ${d(`${g('ARC_HOST')} .......................... set the host the server will bind to`)}
  ${d(`${g('ARC_QUIET')}, ${g('QUIET')} .................. minimize console output (same as --quiet)`)}

${D('Keyboard Shortcuts')}
${d('Sandbox registers keyboard shortcuts to help with local development (note: they are all capital letters!):')}
  ${g('S')} ${d('................................. rehydrate only src/shared')}
  ${g('V')} ${d('................................. rehydrate only src/views')}
  ${g('H')} ${d('................................. rehydrate both src/shared and src/views')}
  ${g('Ctrl+C')} ${d('........
```

### Core Architecture Module: `src/index.js`
```
#!/usr/bin/env node
let chalk = require('@architect/utils/chalk')
let _inventory = require('@architect/inventory')
let create = require('@architect/create/src/cli')
let deploy = require('@architect/deploy/src/cli')
let destroy = require('@architect/destroy/src/cli')
let env = require('@architect/env/src/cli')
let hydrate = require('@architect/hydrate/src/cli')
let logs = require('@architect/logs/src/cli')
let sandbox = require('@architect/sandbox/src/cli/arc')
let pauser = require('@architect/deploy/src/utils/pause-sandbox')

let startup = require('./startup')
let help = require('./help')
let version = require('./version')

let update = require('update-notifier-cjs')
let _pkg = require('../package.json')

let cmds = {
  create,
  init: create,
  deploy,
  destroy,
  env,
  hydrate,
  '-h': help,
  '--help': help,
  help,
  logs,
  sandbox,
  version,
}

let red = chalk.bgRed.bold.white
let yel = chalk.yellow
let dim = chalk.grey

let pretty = {
  fail (cmd, err) {
    console.log(red(`${cmd} failed!`), err && err.message ? yel(err.message) : '')
    if (err && err.message)
      console.log(dim(err.stack))
  },
  notFound (cmd) {
    console.log(dim(`Sorry, ${chalk.green.bold('arc ' + cmd)} command not found!`))
  },
}

async function main (args) {
  // Mainly here for testing
  args = args || process.argv.slice(2)

  // Set quietude
  process.env.ARC_QUIET = process.env.QUIET || args.some(a => a.includes('-quiet')) ? true : ''

  // Check for updates in a non-blocking background process
  let boxenOpts = { padding: 1, margin: 1, align: 'center', borderColor: 'green', borderStyle: 'round', dimBorder: true }
  update({ pkg: _pkg, shouldNotifyInNpmScript: true }).notify({ boxenOpts })

  let cmd = args.shift()
  let opts = args.slice(0)
  let helpFlag = opts.some(f => [ '-h', '--help' ].includes(f))

  if (cmd && !cmds[cmd]) {
    pretty.notFound(cmd)
    return false
  }
  else if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    help(opts)
  }
  else if (helpFlag) {
    help([ cmd ])
  }
  else {
    try {
      startup.env()
      let inventory = await _inventory({})
      let printBanner = ![ 'create', 'init', 'version' ].includes(cmd)
      if (printBanner) startup.banner({ cmd, inventory })
      await cmds[cmd]({ inventory })
    }
    catch (err) {
      // Unpause the Sandbox watcher
      pauser.unpause()
      pretty.fail(cmd, err)
      return false
    }
  }
  return true
}

module.exports = main

// allow direct invoke
if (require.main === module) {
  (async function () {
    let ok = await main()
    if (!ok) {
      process.exit(1)
    }
  })()
}

```

### Core Architecture Module: `src/startup/banner.js`
```
let { banner } = require('@architect/utils')
let { version: ver } = require('../../package.json')

module.exports = function runBanner ({ cmd, inventory }) {
  try {
    // Commands specified below musthave valid credetials to operate
    let needsValidCreds = [ 'deploy', 'env', 'logs' ].includes(cmd)
    banner({
      inventory,
      needsValidCreds,
      version: `Architect ${ver}`,
    })
  }
  catch (e) {
    console.log(e)
  }
}

```

### Core Architecture Module: `src/startup/env.js`
```
/**
 * Ensures the following env vars are present:
 *
 * - ARC_ENV (default 'testing')
 * - AWS_REGION (default us-west-2)
 */
module.exports = function ensureEnv () {
  // always ensure ARC_ENV + AWS_REGION
  if (!process.env.ARC_ENV) process.env.ARC_ENV = 'testing'
  if (!process.env.AWS_REGION) process.env.AWS_REGION = 'us-west-2'
}

```

### Core Architecture Module: `src/startup/index.js`
```
let env = require('./env')
let banner = require('./banner')

module.exports = {
  env,
  banner,
}

```

### Core Architecture Module: `src/version.js`
```
let chalk = require('@architect/utils/chalk')
let { version } = require('../package.json')
let path = require('path')

module.exports = function printVersion () {
  let log = (label, value) => console.log(chalk.grey(`${label.padStart(13)}:`), chalk.cyan(value))
  log('Version', `Architect ${version}`)
  log('Installed to', path.resolve(path.join(__dirname, '..')))
  log('cwd', process.cwd())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1526** (2026-09-05): **12.0.1 not published on NPM**
  *Symptoms*: 12.0.1 is in the changelog. So I assume that it should be on NPM. No? ;-)  https://www.npmjs.com/package/@architect/architect
  **Post-Mortem & Fix Analysis**:
  > Not necessarily 😄 but I just pushed a patch version up. It's live!
  > 🙏  On Sat, 5 Sept 2026, 02:22 Fil Maj, ***@***.***> wrote:  > *filmaj* left a comment (architect/architect#1526) > <https://github.com/architect/architect/issues/1526#issuecomment-5548013347> > > Not necessarily 😄 but I just pushed a patch version up. It's live! > > — > Reply to this email directly, view it on GitHub > <https://github.com/architect/architect/issues/1526?email_source=notifications&email_token=AABG464KNWCL75777M3KIQL5NNME5A5CNFSNUABFM5UWIORPF5TWS5BNNB2WEL2JONZXKZKDN5WW2ZLOOQXTKNJUHAYDCMZTGQ32M4TFMFZW63VGMF2XI2DPOKSWK5TFNZ2KYZTPN52GK4S7MNWGSY3L#issuecomment-5548013347>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/AABG464YGXEC446XE7VEBVT5NNME5AVCNFSNUABEKJSXA33TNF2G64TZHM4TONZXGM2DENZ3JFZXG5LFHM2TGNBVHEYTKNBZGSQXMAQ> > . > Triage notifications, keep track of coding agent tasks and review pull > requests on the go with GitHub Mobile for iOS > <https://github.com/notifications/mobile/ios/AABG467TCHKES65WZQA3W4L5NNME5A5CNFSNUABFM5U

- **Issue #1525** (2026-08-27): **fixed dependencies for fifo config**
  *Symptoms*: Dependencies pinned to older versions means `@queues` `fifo` and other properties are being dropped when deployed. See the [changelog.md](https://github.com/architect/architect/compare/fifo-bug?expand=1#diff-3bd14d078188074c410028847113ceae68865d0ad5b844a27183ef87fbe2fcc3) for a description.
  **Post-Mortem & Fix Analysis**:
  > ooof ya good catch! 

- **Issue #1522** (2026-07-06): **Hydrate for pnpm should use the  --node-linker=hoisted property**
  *Symptoms*: **Describe the issue** Pnpm does sym linking of sub dependencies. When deployed to AWS those will break. Using the ` --node-linker=hoisted ` option will avoid the sym links.   
  **Post-Mortem & Fix Analysis**:
  > Fixed in hydrate 6.0.2

- **Issue #1521** (2026-09-13): **type:request: [architect loop] Blocked - no ready owner issue**
  *Symptoms*: Loop pass date: 2026-02-14.\n\nBlocked after step 1.\n\nFindings:\n- Pending PRs in architect lane: none.\n- Open issues matching owner:architect + state:ready: none.\n\nDependency:\n- Need triage to assign at least one open issue to owner:architect and state:ready so the next loop can execute step 2.\n\nContract tracking:\n- Created per loop step 3 to document blocker and dependency.
  **Post-Mortem & Fix Analysis**:
  > Status (2026-02-14): blocked awaiting triage dependency. No architect-lane PRs pending review, and no open owner:architect + state:ready issue available for implementation in this pass.
  > This seems to be some kind of bot or spam. Closing.

- **Issue #1518** (2026-02-21): **@scheduled deploys fail after @architect/package@11.0.2 due to CloudFormation resource type change**
  *Symptoms*: **Describe the issue**  Deploying with Arc 12 fails with CloudFormation error after `@architect/package@11.0.2` was published. Existing stacks with `@scheduled` functions cannot be updated because the resource type changed from `AWS::Events::Rule` to `AWS::Scheduler::Schedule`.  CloudFormation does not allow changing resource types in-place.  **Steps to reproduce**  1. Have an existing Arc deployment with `@scheduled` functions (deployed with `@architect/package` < 11.0.2) 2. Deploy again using Arc 12 (which pulls `@architect/package@11.0.2` or later) 3. CloudFormation fails with:  ``` Update of resource type is not permitted. The new template modifies resource type of the following resources: [FooScheduledEvent, BarScheduledEvent, ...] ```  **Expected behavior**  Deploy should succeed, or there should be a migration path / changelog noting the breaking change.  **Additional context**  - Related PR: https://github.com/architect/package/pull/173 - Pinning to Arc 11.3.0 works (uses `@architect/package@9.x` which still generates `AWS::Events::Rule`) - Discord thread: https://discord.com/channels/880272256100601927/1079148441109790780/1461798674475520011
  **Post-Mortem & Fix Analysis**:
  > The [workaround suggested by @filmaj in Discord](https://discord.com/channels/880272256100601927/1079148441109790780/1461812639314219120) works: rename the scheduled function in the arc config. The new name causes CloudFormation to delete the old `AWS::Events::Rule` and create a new `AWS::Scheduler::Schedule` rather than attempting an in-place type change. These resources are stateless (just schedule descriptors), so renaming should be safe.  ``` @scheduled my-function-renamed   cron 0 * * * ? *   src src/scheduled/my-function ``` > Alternatively, if not using explicit `src` paths, rename both the config entry and the directory to match.  Tested with `cron` expressions. Should apply to `rate` as well since the underlying resource type change affects all `@scheduled` functions.

- **Issue #1517** (2025-12-24): **chore: move to oidc npm publishing**
  *Symptoms*: Trusted publisher already set up in https://www.npmjs.com/package/@architect/architect/access.

- **Issue #1516** (2025-12-01): **chore: update deps and node**
  *Symptoms*: wip

- **Issue #1514** (2025-09-10): **Linux  dpkg installation failed:**
  *Symptoms*: **Describe the issue**  Installation of ARCitect_1.0.0_amd64.deb using dpkg failed   **Steps to reproduce** sudo dpkg -i ./ARCitect_1.0.0_amd64.deb  (Reading database ... 0 files and directories currently installed.) Preparing to unpack ./ARCitect_1.0.0_amd64.deb ... Unpacking arcitect (1.0.0) ... dpkg: error processing archive ./ARCitect_1.0.0_amd64.deb (--install):  error creating hard link './usr/share/icons/hicolor/1024x1024/apps/arcitect.png': Invalid cross-device link Errors were encountered while processing:  ./ARCitect_1.0.0_amd64.deb **Screenshots** If applicable, add screenshots to help explain your problem   **Desktop** Please complete the following information (if appropriate):  - OS: OpenSuse  openSUSE Leap 15.6
  **Post-Mortem & Fix Analysis**:
  > Where did you get this `ARCitect_1.0.0` `deb` file? This doesn't sound like something distributed from this project?
  > IHi,  used link in installation documentation https://github.com/nfdi4plants/ARCitect/releases/tag/v1.0.0  
  > This was indeed a other project sharing same name sorry. for this

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

### Incident Patch 1: `23fb2d62` (2026-08-27)
**Commit Message**: Merge pull request #1525 from architect/fifo-bug

fixed dependencies for fifo config

**File**: `changelog.md` (modified, +16/-0)
```diff
@@ -4,6 +4,22 @@
 
 ---
 
+## [12.0.1] 2026-08-26
+
+This version bumps some of architect's sub-dependencies:
+
+- [`@architect/deploy` 7.0.0 -> 7.0.3](https://github.com/architect/deploy/blob/main/changelog.md)
+- [`@architect/inventory` ~6.0.0 -> ~6.1.0](https://github.com/architect/inventory/blob/main/changelog.md#610-2026-01-08)
+
+### Fixed
+
+- Fixed `fifo false` on an `@queues` item silently ignored making a FIFO queue instead of a standard queue
+  - `@architect/inventory` 6.1.0 made `fifo` (along with `batchSize` and `batchWindow`) a top-level `@queues` property. Version `~6.0.0` drops the property and falls back to the `true` default
+  - Setting `fifo false` in a queue's own function config did work and still works
+- `@architect/deploy` 7.0.3 pins `@architect/inventory` `~6.1.0`, so the deploy path no longer resolves its own copy of Inventory
+
+---
+
 ## [12.0.0] 2025-09-25 (Fresno Nightcrawler)
 
 Bumps all deps to next major. Notable changes:
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -29,11 +29,11 @@
   "license": "Apache-2.0",
   "dependencies": {
     "@architect/create": "7.0.0",
-    "@architect/deploy": "7.0.0",
+    "@architect/deploy": "7.0.3",
     "@architect/destroy": "6.0.0",
     "@architect/env": "6.0.0",
     "@architect/hydrate": "6.0.0",
-    "@architect/inventory": "~6.0.0",
+    "@architect/inventory": "~6.1.0",
     "@architect/logs": "7.0.0",
     "@architect/sandbox": "9.0.0",
     "@architect/utils": "~6.0.0",
```

---

### Incident Patch 2: `59dcdab8` (2026-08-26)
**Commit Message**: fixed dependencies for fifo config

**File**: `changelog.md` (modified, +16/-0)
```diff
@@ -4,6 +4,22 @@
 
 ---
 
+## [12.0.1] 2026-08-26
+
+This version bumps some of architect's sub-dependencies:
+
+- [`@architect/deploy` 7.0.0 -> 7.0.3](https://github.com/architect/deploy/blob/main/changelog.md)
+- [`@architect/inventory` ~6.0.0 -> ~6.1.0](https://github.com/architect/inventory/blob/main/changelog.md#610-2026-01-08)
+
+### Fixed
+
+- Fixed `fifo false` on an `@queues` item silently ignored making a FIFO queue instead of a standard queue
+  - `@architect/inventory` 6.1.0 made `fifo` (along with `batchSize` and `batchWindow`) a top-level `@queues` property. Version `~6.0.0` drops the property and falls back to the `true` default
+  - Setting `fifo false` in a queue's own function config did work and still works
+- `@architect/deploy` 7.0.3 pins `@architect/inventory` `~6.1.0`, so the deploy path no longer resolves its own copy of Inventory
+
+---
+
 ## [12.0.0] 2025-09-25 (Fresno Nightcrawler)
 
 Bumps all deps to next major. Notable changes:
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -29,11 +29,11 @@
   "license": "Apache-2.0",
   "dependencies": {
     "@architect/create": "7.0.0",
-    "@architect/deploy": "7.0.0",
+    "@architect/deploy": "7.0.3",
     "@architect/destroy": "6.0.0",
     "@architect/env": "6.0.0",
     "@architect/hydrate": "6.0.0",
-    "@architect/inventory": "~6.0.0",
+    "@architect/inventory": "~6.1.0",
     "@architect/logs": "7.0.0",
     "@architect/sandbox": "9.0.0",
     "@architect/utils": "~6.0.0",
```

---

### Incident Patch 3: `b833ab98` (2025-11-27)
**Commit Message**: fix: add size delta to changelog

**File**: `changelog.md` (modified, +2/-1)
```diff
@@ -10,8 +10,9 @@ Bumps all deps to next major. Notable changes:
 
 - updated all architect modules to `node22.x` and `node24.x`
 - `dynalite` upgraded to latest `leveldb`
-- vendored many stable deps into `@architect/utils` to reduce supply chain threat surface
+- vendored many stable deps into `@architect/utils` to reduce supply chain threat surface (and nasty warnings)
 - began migration to native node test runner
+- the entire `@architect/architect` package is now 23MB vs 36MB on disk so install is nicer
 
 ## [11.3.0] 2025-07-01
 
```

---

### Incident Patch 4: `26995759` (2025-11-27)
**Commit Message**: fix: updates changelog to reflect node versions 22 and 24

**File**: `changelog.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 Bumps all deps to next major. Notable changes:
 
-- updated runtime to `node20.x`, `node22.x` and `node24.x`
+- updated all architect modules to `node22.x` and `node24.x`
 - `dynalite` upgraded to latest `leveldb`
 - vendored many stable deps into `@architect/utils` to reduce supply chain threat surface
 - began migration to native node test runner
```

---

### Incident Patch 5: `a4826383` (2025-11-27)
**Commit Message**: fix: update to latest everything

**File**: `package.json` (modified, +7/-7)
```diff
@@ -28,14 +28,14 @@
   "author": "Brian LeRoux <b@brian.io>",
   "license": "Apache-2.0",
   "dependencies": {
-    "@architect/create": "7.0.0-RC.0",
-    "@architect/deploy": "7.0.0-RC.0",
-    "@architect/destroy": "6.0.0-RC.0",
-    "@architect/env": "6.0.0-RC.0",
-    "@architect/hydrate": "5.0.2-RC.0",
+    "@architect/create": "7.0.0",
+    "@architect/deploy": "7.0.0",
+    "@architect/destroy": "6.0.0",
+    "@architect/env": "6.0.0",
+    "@architect/hydrate": "6.0.0",
     "@architect/inventory": "~6.0.0",
-    "@architect/logs": "7.0.0-RC.0",
-    "@architect/sandbox": "9.0.0-RC.0",
+    "@architect/logs": "7.0.0",
+    "@architect/sandbox": "9.0.0",
     "@architect/utils": "~6.0.0",
     "@aws-lite/client": "^0.23.2",
     "update-notifier-cjs": "5.1.6"
```

---

### Incident Patch 6: `55439d7b` (2025-11-27)
**Commit Message**: fix: version tests

**File**: `package.json` (modified, +2/-2)
```diff
@@ -33,10 +33,10 @@
     "@architect/destroy": "6.0.0-RC.0",
     "@architect/env": "6.0.0-RC.0",
     "@architect/hydrate": "5.0.2-RC.0",
-    "@architect/inventory": "~6.0.0-RC.0",
+    "@architect/inventory": "~6.0.0",
     "@architect/logs": "7.0.0-RC.0",
     "@architect/sandbox": "9.0.0-RC.0",
-    "@architect/utils": "6.0.0",
+    "@architect/utils": "~6.0.0",
     "@aws-lite/client": "^0.23.2",
     "update-notifier-cjs": "5.1.6"
   },
```

---

### Incident Patch 7: `0e037371` (2025-11-27)
**Commit Message**: fix: latest utils

**File**: `package.json` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
     "@architect/inventory": "~6.0.0-RC.0",
     "@architect/logs": "7.0.0-RC.0",
     "@architect/sandbox": "9.0.0-RC.0",
-    "@architect/utils": "~6.0.0-RC.1",
+    "@architect/utils": "6.0.0",
     "@aws-lite/client": "^0.23.2",
     "update-notifier-cjs": "5.1.6"
   },
```

---

### Incident Patch 8: `966636df` (2025-11-25)
**Commit Message**: fix: version locking

**File**: `package.json` (modified, +2/-2)
```diff
@@ -33,10 +33,10 @@
     "@architect/destroy": "6.0.0-RC.0",
     "@architect/env": "6.0.0-RC.0",
     "@architect/hydrate": "5.0.2-RC.0",
-    "@architect/inventory": "6.0.0-RC.0",
+    "@architect/inventory": "~6.0.0-RC.0",
     "@architect/logs": "7.0.0-RC.0",
     "@architect/sandbox": "9.0.0-RC.0",
-    "@architect/utils": "6.0.0-RC.1",
+    "@architect/utils": "~6.0.0-RC.1",
     "@aws-lite/client": "^0.23.2",
     "update-notifier-cjs": "5.1.6"
   },
```

**File**: `test/unit/src/dependency-version-test.js` (modified, +0/-1)
```diff
@@ -21,7 +21,6 @@ test('All primary dependencies must be version locked', t => {
       t.ok(ver.startsWith('^'), `${dep} version is ok: ${ver}`)
     }
     else if (ver.match(startsWithNumber)) {
-      console.log('made it here?')
       t.pass(`${dep} version is ok: ${ver}`)
     }
     else {
```

---

### Incident Patch 9: `32a5bcbb` (2025-11-25)
**Commit Message**: fix: all rc all the time

**File**: `.github/workflows/build.yml` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ jobs:
     runs-on: ${{ matrix.os }}
     strategy:
       matrix:
-        node-version: [ 20.x, 22.x, 24.x ]
+        node-version: [ 22.x, 24.x ]
         os: [ windows-latest, ubuntu-latest, macOS-latest ]
 
     # Go
```

**File**: `package.json` (modified, +10/-10)
```diff
@@ -16,7 +16,7 @@
     "rc": "npm version prerelease --preid RC"
   },
   "engines": {
-    "node": ">=20"
+    "node": ">=22"
   },
   "repository": {
     "type": "git",
@@ -28,15 +28,15 @@
   "author": "Brian LeRoux <b@brian.io>",
   "license": "Apache-2.0",
   "dependencies": {
-    "@architect/create": "6.0.0",
-    "@architect/deploy": "5.1.1-RC.1",
-    "@architect/destroy": "5.0.1",
-    "@architect/env": "5.0.1",
-    "@architect/hydrate": "5.0.0",
-    "@architect/inventory": "~5.0.0",
-    "@architect/logs": "6.0.1",
-    "@architect/sandbox": "8.0.0-RC.2",
-    "@architect/utils": "~5.0.0",
+    "@architect/create": "7.0.0-RC.0",
+    "@architect/deploy": "7.0.0-RC.0",
+    "@architect/destroy": "6.0.0-RC.0",
+    "@architect/env": "6.0.0-RC.0",
+    "@architect/hydrate": "5.0.2-RC.0",
+    "@architect/inventory": "6.0.0-RC.0",
+    "@architect/logs": "7.0.0-RC.0",
+    "@architect/sandbox": "9.0.0-RC.0",
+    "@architect/utils": "6.0.0-RC.1",
     "@aws-lite/client": "^0.23.2",
     "update-notifier-cjs": "5.1.6"
   },
```

---

### Incident Patch 10: `e109badc` (2025-09-25)
**Commit Message**: fix: failing tests

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -4,3 +4,4 @@ dist/
 node_modules/
 old/
 package-lock.json
+.kiro
```

**File**: `changelog.md` (modified, +9/-0)
```diff
@@ -4,6 +4,15 @@
 
 ---
 
+## [12.0.0] 2025-09-25 (Fresno Nightcrawler)
+
+Bumps all deps to next major. Notable changes:
+
+- updated runtime to `node20.x`, `node22.x` and `node24.x`
+- `dynalite` upgraded to latest `leveldb`
+- vendored many stable deps into `@architect/utils` to reduce supply chain threat surface
+- began migration to native node test runner
+
 ## [11.3.0] 2025-07-01
 
 This version bumps [`@architect/sandbox` 6.0.5 -> 7.1.0](https://github.com/architect/sandbox/blob/main/changelog.md#710-2025-07-01) and includes the following changes:
```

**File**: `package.json` (modified, +9/-9)
```diff
@@ -29,19 +29,19 @@
   "license": "Apache-2.0",
   "dependencies": {
     "@architect/create": "6.0.0",
-    "@architect/deploy": "5.1.1-RC.0",
-    "@architect/destroy": "5.0.0",
-    "@architect/env": "5.0.0",
+    "@architect/deploy": "5.1.1-RC.1",
+    "@architect/destroy": "5.0.1",
+    "@architect/env": "5.0.1",
     "@architect/hydrate": "5.0.0",
-    "@architect/inventory": "5.0.0",
-    "@architect/logs": "6.0.0",
-    "@architect/sandbox": "8.0.0-RC.1",
-    "@architect/utils": "5.0.0",
-    "@aws-lite/client": "0.23.2",
+    "@architect/inventory": "~5.0.0",
+    "@architect/logs": "6.0.1",
+    "@architect/sandbox": "8.0.0-RC.2",
+    "@architect/utils": "~5.0.0",
+    "@aws-lite/client": "^0.23.2",
     "update-notifier-cjs": "5.1.6"
   },
   "devDependencies": {
-    "@architect/eslint-config": "~3.0.0",
+    "@architect/eslint-config": "3.0.0",
     "cross-env": "10.0.0",
     "eslint": "9.36.0",
     "nyc": "17.1.0",
```

**File**: `test/unit/src/dependency-version-test.js` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ test('All primary dependencies must be version locked', t => {
       t.ok(ver.startsWith('^'), `${dep} version is ok: ${ver}`)
     }
     else if (ver.match(startsWithNumber)) {
+      console.log('made it here?')
       t.pass(`${dep} version is ok: ${ver}`)
     }
     else {
```

#### Recent Merged Pull Requests:
- **PR #1525** (2026-08-27): fixed dependencies for fifo config (@ryanbethel)
- **PR #1517** (2025-12-24): chore: move to oidc npm publishing (@filmaj)
- **PR #1516** (2025-12-01): chore: update deps and node (@brianleroux)
- **PR #1513** (2025-07-02): feat: support loading seed data from .mjs and .cjs files (@filmaj)
- **PR #1510** (2025-04-06): Add ARC_DB_EXTERNAL to CLI help (@lpsinger)
- **PR #1509** (2025-04-06): chore: test against node 22 (@filmaj)
- **PR #1508** (2025-04-05): Update deps and changelog (@filmaj)
- **PR #1507** (2025-04-04): docs: update CLI help text (@filmaj)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
