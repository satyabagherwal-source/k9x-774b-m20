# Forensic Learning Record (Deep Inspection): epicweb-dev/advanced-react-patterns

> **Canonical Artifact**: `07_PROJECT_LEARNING/epicweb-dev-advanced-react-patterns-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/epicweb-dev/advanced-react-patterns](https://github.com/epicweb-dev/advanced-react-patterns))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:36:14.118Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `epicweb-dev/advanced-react-patterns`
- **Description**: This is the latest advanced react patterns workshop
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3517 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `epicshop/fix-watch.js`
```
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import chokidar from 'chokidar'
import { $ } from 'execa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const here = (...p) => path.join(__dirname, ...p)

const workshopRoot = here('..')

const watchPath = path.join(workshopRoot, './exercises/*')
const watcher = chokidar.watch(watchPath, {
	ignored: /(^|[\/\\])\../, // ignore dotfiles
	persistent: true,
	ignoreInitial: true,
	depth: 2,
})

const debouncedRun = debounce(run, 200)

// Add event listeners.
watcher
	.on('addDir', path => {
		debouncedRun()
	})
	.on('unlinkDir', path => {
		// Only act if path contains two slashes (excluding the leading `./`)
		debouncedRun()
	})
	.on('error', error => console.log(`Watcher error: ${error}`))

/**
 * Simple debounce implementation
 */
function debounce(fn, delay) {
	let timer = null
	return (...args) => {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			fn(...args)
		}, delay)
	}
}

let running = false

async function run() {
	if (running) {
		console.log('still running...')
		return
	}
	running = true
	try {
		await $({
			stdio: 'inherit',
			cwd: workshopRoot,
		})`node ./scripts/fix.js`
	} catch (error) {
		throw error
	} finally {
		running = false
	}
}

console.log(`watching ${watchPath}`)

// doing this because the watcher doesn't seem to work and I don't have time
// to figure out why 🙃
console.log('Polling...')
setInterval(() => {
	run()
}, 1000)

console.log('running fix to start...')
run()

```

### Core Architecture Module: `epicshop/fix.js`
```
// This should run by node without any dependencies
// because you may need to run it without deps.

import cp from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const here = (...p) => path.join(__dirname, ...p)
const VERBOSE = false
const logVerbose = (...args) => (VERBOSE ? console.log(...args) : undefined)

const workshopRoot = here('..')
const examples = (await readDir(here('../examples'))).map(dir =>
	here(`../examples/${dir}`),
)
const exercises = (await readDir(here('../exercises')))
	.map(name => here(`../exercises/${name}`))
	.filter(filepath => fs.statSync(filepath).isDirectory())
const exerciseApps = (
	await Promise.all(
		exercises.flatMap(async exercise => {
			return (await readDir(exercise))
				.filter(dir => {
					return /(problem|solution)/.test(dir)
				})
				.map(dir => path.join(exercise, dir))
		}),
	)
).flat()
const exampleApps = (await readDir(here('../examples'))).map(dir =>
	here(`../examples/${dir}`),
)
const apps = [...exampleApps, ...exerciseApps]

const appsWithPkgJson = [...examples, ...apps].filter(app => {
	const pkgjsonPath = path.join(app, 'package.json')
	return exists(pkgjsonPath)
})

// update the package.json file name property
// to match the parent directory name + directory name
// e.g. exercises/01-goo/problem.01-great
// name: "exercises__sep__01-goo.problem__sep__01-great"

function relativeToWorkshopRoot(dir) {
	return dir.replace(`${workshopRoot}${path.sep}`, '')
}

await updatePkgNames()
await updateTsconfig()

async function updatePkgNames() {
	for (const file of appsWithPkgJson) {
		const pkgjsonPath = path.join(file, 'package.json')
		const pkg = JSON.parse(await fs.promises.readFile(pkgjsonPath, 'utf8'))
		pkg.name = relativeToWorkshopRoot(file).replace(/\\|\//g, '__sep__')
		const written = await writeIfNeeded(
			pkgjsonPath,
			`${JSON.stringify(pkg, null, 2)}\n`,
		)
		if (written) {
			console.log(`updated ${path.relative(process.cwd(), pkgjsonPath)}`)
		}
	}
}

async function updateTsconfig() {
	const tsconfig = {
		files: [],
		exclude: ['node_modules'],
		references: appsWithPkgJson.map(a => ({
			path: relativeToWorkshopRoot(a).replace(/\\/g, '/'),
		})),
	}
	const written = await writeIfNeeded(
		path.join(workshopRoot, 'tsconfig.json'),
		`${JSON.stringify(tsconfig, null, 2)}\n`,
		{ parser: 'json' },
	)

	if (written) {
		// delete node_modules/.cache
		const cacheDir = path.join(workshopRoot, 'node_modules', '.cache')
		if (exists(cacheDir)) {
			await fs.promises.rm(cacheDir, { recursive: true })
		}
		console.log('all fixed up')
	}
}

async function writeIfNeeded(filepath, content) {
	const oldContent = await fs.promises.readFile(filepath, 'utf8')
	if (oldContent !== content) {
		await fs.promises.writeFile(filepath, content)
	}
	return oldContent !== content
}

function exists(p) {
	if (!p) return false
	try {
		fs.statSync(p)
		return true
	} catch (error) {
		return false
	}
}

async function readDir(dir) {
	if (exists(dir)) {
		return fs.promises.readdir(dir)
	}
	return []
}

```

### Core Architecture Module: `epicshop/playwright.config.js`
```
import os from 'os'
import path from 'path'
import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PORT || '5639'
const tmpDir = path.join(
	os.tmpdir(),
	'epicshop-playwright',
	path.basename(new URL('../', import.meta.url).pathname),
)

export default defineConfig({
	workers: process.env.CI ? 1 : undefined,
	outputDir: path.join(tmpDir, 'playwright-test-output'),
	reporter: [
		[
			'html',
			{ open: 'never', outputFolder: path.join(tmpDir, 'playwright-report') },
		],
	],
	use: {
		baseURL: `http://localhost:${PORT}/`,
		trace: 'retain-on-failure',
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	webServer: {
		command: 'cd .. && npm start',
		port: Number(PORT),
		reuseExistingServer: !process.env.CI,
		stdout: 'pipe',
		stderr: 'pipe',
		env: { PORT },
	},
})

```

### Core Architecture Module: `epicshop/post-set-playground.js`
```
import fs from 'node:fs'
import path from 'node:path'

fs.writeFileSync(
	path.join(process.env.EPICSHOP_PLAYGROUND_DEST_DIR, 'tsconfig.json'),
	JSON.stringify({ extends: '../tsconfig' }, null, 2),
)

```

### Core Architecture Module: `epicshop/setup-custom.js`
```
import path from 'node:path'
import {
	getApps,
	isProblemApp,
	setPlayground,
} from '@epic-web/workshop-utils/apps.server'
import { warm } from 'epicshop/warm'
import fsExtra from 'fs-extra'

await warm()

const allApps = await getApps()
const problemApps = allApps.filter(isProblemApp)

if (!process.env.SKIP_PLAYGROUND) {
	const firstProblemApp = problemApps[0]
	if (firstProblemApp) {
		console.log('🛝  setting up the first problem app...')
		const playgroundPath = path.join(process.cwd(), 'playground')
		if (await fsExtra.exists(playgroundPath)) {
			console.log('🗑  deleting existing playground app')
			await fsExtra.remove(playgroundPath)
		}
		await setPlayground(firstProblemApp.fullPath).then(
			() => {
				console.log('✅ first problem app set up')
			},
			(error) => {
				console.error(error)
				throw new Error('❌  first problem app setup failed')
			},
		)
	}
}

```

### Core Architecture Module: `eslint.config.js`
```
import defaultConfig from '@epic-web/config/eslint'

/** @type {import("eslint").Linter.Config} */
export default [
	{ ignores: ['**/babel-standalone.js'] },
	...defaultConfig,
	{
		rules: {
			// we leave unused vars around for the exercises
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
		},
	},
]

```

### Core Architecture Module: `exercises/01.composition/01.problem.compose/index.tsx`
```
import { useState } from 'react'
import * as ReactDOM from 'react-dom/client'
import { SportDataView, allSports } from '#shared/sports.tsx'
import { type SportData, type User } from '#shared/types.tsx'

function App() {
	const [user] = useState<User>({ name: 'Kody', image: '/img/kody.png' })
	const [sportList] = useState<Array<SportData>>(() => Object.values(allSports))
	const [selectedSport, setSelectedSport] = useState<SportData | null>(null)

	return (
		<div
			id="app-root"
			style={{ ['--accent-color' as any]: selectedSport?.color ?? 'black' }}
		>
			{/*
				🐨 make Nav accept a ReactNode prop called "avatar"
				instead of a User prop called "user"
			*/}
			<Nav user={user} />
			<div className="spacer" data-size="lg" />
			{/*
				🐨 make Main accept ReactNode props called "sidebar" and "content"
				instead of the props it accepts right now.
			*/}
			<Main
				sportList={sportList}
				selectedSport={selectedSport}
				setSelectedSport={setSelectedSport}
			/>
			<div className="spacer" data-size="lg" />
			{/*
				🐨 make Footer accept a String prop called "footerMessage"
				instead of the User prop called "user"
			*/}
			<Footer user={user} />
		</div>
	)
}

// 🐨 this should accept an avatar prop that's a ReactNode
function Nav({ user }: { user: User }) {
	return (
		<nav>
			<ul>
				<li>
					<a href="#/home">Home</a>
				</li>
				<li>
					<a href="#/about">About</a>
				</li>
				<li>
					<a href="#/contact">Contact</a>
				</li>
			</ul>
			<a href="#/me" title="User Settings">
				{/* 🐨 render the avatar prop here instead of the img */}
				<img src={user.image} alt={`${user.name} profile`} />
			</a>
		</nav>
	)
}

function Main({
	// 🐨 all these props should be removed in favor of the sidebar and content props
	sportList,
	selectedSport,
	setSelectedSport,
}: {
	sportList: Array<SportData>
	selectedSport: SportData | null
	setSelectedSport: (sport: SportData) => void
}) {
	return (
		<main>
			{/* 🐨 put the sidebar and content props here */}
			<List sportList={sportList} setSelectedSport={setSelectedSport} />
			<Details selectedSport={selectedSport} />
		</main>
	)
}

function List({
	// 🐨 make this accept an array of ReactNodes called "listItems"
	// and remove the existing props
	sportList,
	setSelectedSport,
}: {
	sportList: Array<SportData>
	setSelectedSport: (sport: SportData) => void
}) {
	return (
		<div className="sport-list">
			<ul>
				{/* 🐨 render the listItems here */}
				{sportList.map(p => (
					<li key={p.id}>
						<SportListItemButton
							sport={p}
							onClick={() => setSelectedSport(p)}
						/>
					</li>
				))}
			</ul>
		</div>
	)
}

function SportListItemButton({
	sport,
	onClick,
}: {
	sport: SportData
	onClick: () => void
}) {
	return (
		<button
			className="sport-item"
			onClick={onClick}
			style={{ ['--accent-color' as any]: sport.color }}
			aria-label={sport.name}
		>
			<img src={sport.image} alt={sport.name} />
			<div className="sport-list-info">
				<strong>{sport.name}</strong>
			</div>
		</button>
	)
}

function Details({ selectedSport }: { selectedSport: SportData | null }) {
	return (
		<div className="sport-details">
			{selectedSport ? (
				<SportDataView sport={selectedSport} />
			) : (
				<div>Select a Sport</div>
			)}
		</div>
	)
}

// 🐨 make this accept a footerMessage string instead of the user
function Footer({ user }: { user: User }) {
	return (
		<footer>
			<p>{`Don't have a good day–have a great day, ${user.name}`}</p>
		</footer>
	)
}

const rootEl = document.createElement('div')
document.body.append(rootEl)
ReactDOM.createRoot(rootEl).render(<App />)

```

### Core Architecture Module: `exercises/01.composition/01.solution.compose/index.tsx`
```
import { useState } from 'react'
import * as ReactDOM from 'react-dom/client'
import { SportDataView, allSports } from '#shared/sports.tsx'
import { type SportData, type User } from '#shared/types.tsx'

function App() {
	const [user] = useState<User>({ name: 'Kody', image: '/img/kody.png' })
	const [sportList] = useState<Array<SportData>>(() => Object.values(allSports))
	const [selectedSport, setSelectedSport] = useState<SportData | null>(null)

	return (
		<div
			id="app-root"
			style={{ ['--accent-color' as any]: selectedSport?.color ?? 'black' }}
		>
			<Nav avatar={<img src={user.image} alt={`${user.name} profile`} />} />
			<div className="spacer" data-size="lg" />
			<Main
				sidebar={
					<List
						listItems={sportList.map(p => (
							<li key={p.id}>
								<SportListItemButton
									sport={p}
									onClick={() => setSelectedSport(p)}
								/>
							</li>
						))}
					/>
				}
				content={<Details selectedSport={selectedSport} />}
			/>
			<div className="spacer" data-size="lg" />
			<Footer
				footerMessage={`Don't have a good day–have a great day, ${user.name}`}
			/>
		</div>
	)
}

function Nav({ avatar }: { avatar: React.ReactNode }) {
	return (
		<nav>
			<ul>
				<li>
					<a href="#/home">Home</a>
				</li>
				<li>
					<a href="#/about">About</a>
				</li>
				<li>
					<a href="#/contact">Contact</a>
				</li>
			</ul>
			<a href="#/me" title="User Settings">
				{avatar}
			</a>
		</nav>
	)
}

function Main({
	sidebar,
	content,
}: {
	sidebar: React.ReactNode
	content: React.ReactNode
}) {
	return (
		<main>
			{sidebar}
			{content}
		</main>
	)
}

function List({ listItems }: { listItems: Array<React.ReactNode> }) {
	return (
		<div className="sport-list">
			<ul>{listItems}</ul>
		</div>
	)
}

function SportListItemButton({
	sport,
	onClick,
}: {
	sport: SportData
	onClick: () => void
}) {
	return (
		<button
			className="sport-item"
			onClick={onClick}
			style={{ ['--accent-color' as any]: sport.color }}
			aria-label={sport.name}
		>
			<img src={sport.image} alt={sport.name} />
			<div className="sport-list-info">
				<strong>{sport.name}</strong>
			</div>
		</button>
	)
}

function Details({ selectedSport }: { selectedSport: SportData | null }) {
	return (
		<div className="sport-details">
			{selectedSport ? (
				<SportDataView sport={selectedSport} />
			) : (
				<div>Select a Sport</div>
			)}
		</div>
	)
}

function Footer({ footerMessage }: { footerMessage: string }) {
	return (
		<footer>
			<p>{footerMessage}</p>
		</footer>
	)
}

const rootEl = document.createElement('div')
document.body.append(rootEl)
ReactDOM.createRoot(rootEl).render(<App />)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #139** (2026-07-28): **entry-server-filters.js generates [ERR_MODULE_NOT_FOUND]**
  *Symptoms*: Hi, I cannot open local `advanced-react-patterns` as I get `[ERR_MODULE_NOT_FOUND]`. I finished previous workshops and did no have such problem before. I tried to:  - Remove `node_modules` and `package-lock.json` and re-install - Change node 24 to node 20 - Remove the whole folder and set the app again  but I still get the very same issue.  ```sh > start > pkgmgrx --prefix ./epicshop epicshop start  …  node:internal/modules/esm/resolve:283     throw new ERR_MODULE_NOT_FOUND(           ^  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/epic-react/advanced-react-patterns/epicshop/node_modules/@epic-web/workshop-app/sentry-server-filters.js' imported from /Users/epic-react/advanced-react-patterns/epicshop/node_modules/@epic-web/workshop-app/instrument.js     at finalizeResolution (node:internal/modules/esm/resolve:283:11)     at moduleResolve (node:internal/modules/esm/resolve:952:10)     at defaultResolve (node:internal/modules/esm/resolve:1188:11)     at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:708:12)     at #cachedDefaultResolve (node:internal/modules/esm/loader:657:25)     at ModuleLoader.resolve (node:internal/modules/esm/loader:640:38)     at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:264:38)     at ModuleJob._link (node:internal/modules/esm/module_job:168:49) {   code: 'ERR_MODULE_NOT_FOUND',   url: 'file:///Users/epic-react/advanced-react-patterns/epicshop/node_modules/@epic-web/workshop-app/sentry-server-filters.j
  **Post-Mortem & Fix Analysis**:
  > Sorry about that! This should be fixed now. Please update the workshop.
  > Hi @kentcdodds  I've re-installed the workshop, but I still get the very same error. What I did:  - `rm -fr ./advanced-react-patterns` - Set it up: `npx --yes epicshop@latest add advanced-react-patterns` - and follow the steps as usual  My package.json points to `"@epic-web/workshop-utils": "^6.90.17",` which points to:  <img width="935" height="67" alt="Image" src="https://github.com/user-attachments/assets/5a1f28a2-a70a-45aa-a745-74ab4cae8e87" />  Your changes (probably) seems to be in https://github.com/epicweb-dev/type-safety/commit/fe7b2beb5e2494d882956396da1c713e62a21861#diff-7ae45ad102eab3b6d7e7896acd08c427a9b25b346470d7bc6507b6481575d519 but the build failed.  It might be a caching problem on my side. I do not know.
  > Sorry! This should be fixed now

- **Issue #138** (2026-06-27): **chore: support Node 26**
  *Symptoms*: ## Summary - Drops project-owned Node 20 engine support where present and ensures Node 26 is accepted. - Updates GitHub Actions Node setup pins to Node 26. - Updates project Docker base images and Node version files to Node 26 where present.  ## Testing - Metadata-only change generated by Kody. - JSON package files were parsed before writing. - Changed files: package.json, package-lock.json, .github/workflows/validate.yml, epicshop/Dockerfile

- **Issue #137** (2025-07-28): **Error when running setup and starting app**
  *Symptoms*: I get this error when running the setup:  > setup:custom > node ./epicshop/setup-custom.js  node:internal/modules/package_json_reader:267   throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);         ^  Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@epic-web/workshop-cli' imported from /Users/myname/git/epicdev/advanced-react-patterns/epicshop/setup-custom.js     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:267:9)     at packageResolve (node:internal/modules/esm/resolve:768:81)     at moduleResolve (node:internal/modules/esm/resolve:854:18)     at defaultResolve (node:internal/modules/esm/resolve:984:11)     at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:736:12)     at #cachedDefaultResolve (node:internal/modules/esm/loader:660:25)     at ModuleLoader.resolve (node:internal/modules/esm/loader:643:38)     at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:279:38)     at ModuleJob._link (node:internal/modules/esm/module_job:137:49) {   code: 'ERR_MODULE_NOT_FOUND' }  To bypass this I have tried to do  `cd epicshop` `npm i`  now the setup finishes successfully, but then I get this error when starting the app:  node:internal/modules/cjs/loader:1405   const err = new Error(message);               ^ Error: Cannot find module './sentry_cpu_profiler-darwin-arm64-131.node' Require stack: - /Users/myname/git/epicdev/advanced-react-patterns/epicshop/node_modules/@sentry-internal/node-cpu-profiler/l
  **Post-Mortem & Fix Analysis**:
  > My guess is that you have some configuration in your npm that prevents running post-install scripts. That would cause the first issue.  For the second issue, there's probably a version mismatch or something. Try deleting the `./epicshop/package-lock.json` (as well as `./epicshop/node_modules`) and installing again.
  > @kentcdodds Enabling post-install scripts did it for me! `npm config set ignore-scripts false` I also had to update my Node version.
  > I'm glad you worked that out!

- **Issue #136** (2025-03-08): **Fix typo in exercise 6 problem 1**
  *Symptoms*: Fixes a small typo

- **Issue #135** (2025-03-03): **small typo**
  *Symptoms*: 

- **Issue #134** (2024-10-29): **fix: tiny typo**
  *Symptoms*: Fixed a small typo while working through the workshop

- **Issue #133** (2024-10-18): **fix: add instructions for exercice 03.compound-components**
  *Symptoms*: there is no 🐨 to give some guidance on this exercice, let's fix that!
  **Post-Mortem & Fix Analysis**:
  > Thanks!

- **Issue #132** (2024-10-20): **add script to save playground**
  *Symptoms*: WIP

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

### Incident Patch 1: `30e6fe4e` (2025-12-19)
**Commit Message**: fix windows npm cache issue

**File**: `.github/workflows/validate.yml` (modified, +5/-2)
```diff
@@ -24,8 +24,11 @@ jobs:
           node-version: 20
 
       - name: ▶️ Add repo
-        run:
-          npx --yes epicshop add ${{ github.event.repository.name }} ./workshop
+        run: |
+          npx --yes epicshop@latest add ${{ github.event.repository.name }} ./workshop
+        env:
+          # Kept getting npm ECOMPROMISED errors on windows. This fixed it.
+          npm_config_cache: ${{ runner.temp }}/npm-cache
 
       - name: ʦ TypeScript
         run: npm run typecheck
```

#### Recent Merged Pull Requests:
- **PR #138** (2026-06-27): chore: support Node 26 (@kody-bot)
- **PR #136** (2025-03-08): Fix typo in exercise 6 problem 1 (@FrancescoAiello01)
- **PR #135** (2025-03-03): small typo (@bensonzachariah)
- **PR #134** (2024-10-29): fix: tiny typo (@remoun)
- **PR #133** (2024-10-18): fix: add instructions for exercice 03.compound-components (@flexbox)
- **PR #132** (closed): add script to save playground (@larissapissurno)
- **PR #131** (2024-05-27): update license file reference (@emmanuel-ferdman)
- **PR #130** (2024-04-25): fix: teeny typo (@devneill)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
