# Forensic Learning Record (Deep Inspection): epicweb-dev/advanced-react-patterns

> **Canonical Artifact**: `07_PROJECT_LEARNING/epicweb-dev-advanced-react-patterns-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/epicweb-dev/advanced-react-patterns](https://github.com/epicweb-dev/advanced-react-patterns))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-08T06:38:11.164Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `epicweb-dev/advanced-react-patterns`
- **Description**: This is the latest advanced react patterns workshop
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3518 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `exercises/06.state-initializers/01.problem.initial/app.tsx`
```
import { Switch } from '#shared/switch.tsx'
import { useToggle } from './toggle.tsx'

export function App() {
	// 🐨 add an initialOn option (set it to true) and get the reset callback from useToggle
	const { on, getTogglerProps } = useToggle()
	// 💣 delete this reset callback in favor of what you get from useToggle
	const reset = () => {}
	return (
		<div>
			<Switch {...getTogglerProps({ on })} />
			<hr />
			<button onClick={reset}>Reset</button>
		</div>
	)
}

```

### Core Architecture Module: `exercises/06.state-initializers/01.problem.initial/index.tsx`
```
import * as ReactDOM from 'react-dom/client'
import { App } from './app.tsx'

const rootEl = document.createElement('div')
document.body.append(rootEl)
ReactDOM.createRoot(rootEl).render(<App />)

```

### Core Architecture Module: `exercises/06.state-initializers/01.problem.initial/toggle.tsx`
```
import { useReducer } from 'react'

function callAll<Args extends Array<unknown>>(
	...fns: Array<((...args: Args) => unknown) | undefined>
) {
	return (...args: Args) => fns.forEach(fn => fn?.(...args))
}

type ToggleState = { on: boolean }
type ToggleAction = { type: 'toggle' }
// 🦺 add an action type for reset:
// 💰 | { type: 'reset'; initialState: ToggleState }

function toggleReducer(state: ToggleState, action: ToggleAction) {
	switch (action.type) {
		case 'toggle': {
			return { on: !state.on }
		}
		// 🐨 add a case for 'reset' that simply returns the "initialState"
		// which you can get from the action.
	}
}

// 🐨 We'll need to add an option for `initialOn` here (default to false)
export function useToggle() {
	// 🐨 update the initialState object to use the initialOn option
	const initialState = { on: false }
	const [state, dispatch] = useReducer(toggleReducer, initialState)
	const { on } = state

	const toggle = () => dispatch({ type: 'toggle' })

	// 🐨 add a reset function here which dispatches a 'reset' type with your
	// initialState object and calls `onReset` with the initialState.on value

	function getTogglerProps<Props>({
		onClick,
		...props
	}: {
		onClick?: React.ComponentProps<'button'>['onClick']
	} & Props) {
		return {
			'aria-checked': on,
			onClick: callAll(onClick, toggle),
			...props,
		}
	}

	return {
		on,
		// 🐨 add your reset function here.
		toggle,
		getTogglerProps,
	}
}

```

### Core Architecture Module: `exercises/06.state-initializers/01.solution.initial/app.tsx`
```
import { Switch } from '#shared/switch.tsx'
import { useToggle } from './toggle.tsx'

export function App() {
	const { on, getTogglerProps, reset } = useToggle({ initialOn: true })
	return (
		<div>
			<Switch {...getTogglerProps({ on })} />
			<hr />
			<button onClick={reset}>Reset</button>
		</div>
	)
}

```

### Core Architecture Module: `exercises/06.state-initializers/01.solution.initial/index.tsx`
```
import * as ReactDOM from 'react-dom/client'
import { App } from './app.tsx'

const rootEl = document.createElement('div')
document.body.append(rootEl)
ReactDOM.createRoot(rootEl).render(<App />)

```

### Core Architecture Module: `exercises/06.state-initializers/01.solution.initial/toggle.tsx`
```
import { useReducer } from 'react'

function callAll<Args extends Array<unknown>>(
	...fns: Array<((...args: Args) => unknown) | undefined>
) {
	return (...args: Args) => fns.forEach(fn => fn?.(...args))
}

type ToggleState = { on: boolean }
type ToggleAction =
	| { type: 'toggle' }
	| { type: 'reset'; initialState: ToggleState }

function toggleReducer(state: ToggleState, action: ToggleAction) {
	switch (action.type) {
		case 'toggle': {
			return { on: !state.on }
		}
		case 'reset': {
			return action.initialState
		}
	}
}

export function useToggle({ initialOn = false } = {}) {
	const initialState = { on: initialOn }
	const [state, dispatch] = useReducer(toggleReducer, initialState)
	const { on } = state

	const toggle = () => dispatch({ type: 'toggle' })
	const reset = () => dispatch({ type: 'reset', initialState })

	function getTogglerProps<Props>({
		onClick,
		...props
	}: {
		onClick?: React.ComponentProps<'button'>['onClick']
	} & Props) {
		return {
			'aria-checked': on,
			onClick: callAll(onClick, toggle),
			...props,
		}
	}

	return {
		on,
		reset,
		toggle,
		getTogglerProps,
	}
}

```

### Core Architecture Module: `exercises/06.state-initializers/02.problem.stability/app.tsx`
```
import { useState } from 'react'
import { Switch } from '#shared/switch.tsx'
import { useToggle } from './toggle.tsx'

export function App() {
	const [initialOn, setInitialOn] = useState(true)
	const { on, getTogglerProps, reset } = useToggle({ initialOn })
	return (
		<div>
			<button onClick={() => setInitialOn(o => !o)}>
				initialOn is: {initialOn ? 'true' : 'false'}
			</button>
			<Switch {...getTogglerProps({ on })} />
			<hr />
			<button onClick={reset}>Reset</button>
		</div>
	)
}

```

### Core Architecture Module: `exercises/06.state-initializers/02.problem.stability/index.tsx`
```
import * as ReactDOM from 'react-dom/client'
import { App } from './app.tsx'

const rootEl = document.createElement('div')
document.body.append(rootEl)
ReactDOM.createRoot(rootEl).render(<App />)

```

### Core Architecture Module: `exercises/06.state-initializers/02.problem.stability/toggle.tsx`
```
import { useReducer } from 'react'

function callAll<Args extends Array<unknown>>(
	...fns: Array<((...args: Args) => unknown) | undefined>
) {
	return (...args: Args) => fns.forEach(fn => fn?.(...args))
}

type ToggleState = { on: boolean }
type ToggleAction =
	| { type: 'toggle' }
	| { type: 'reset'; initialState: ToggleState }

function toggleReducer(state: ToggleState, action: ToggleAction) {
	switch (action.type) {
		case 'toggle': {
			return { on: !state.on }
		}
		case 'reset': {
			return action.initialState
		}
	}
}

export function useToggle({ initialOn = false } = {}) {
	// 🐨 wrap this in a useRef
	const initialState = { on: initialOn }
	// 🐨 pass the ref-ed initial state into useReducer
	const [state, dispatch] = useReducer(toggleReducer, initialState)
	const { on } = state

	const toggle = () => dispatch({ type: 'toggle' })
	// 🐨 make sure the ref-ed initial state gets passed here
	const reset = () => dispatch({ type: 'reset', initialState })

	function getTogglerProps<Props>({
		onClick,
		...props
	}: {
		onClick?: React.ComponentProps<'button'>['onClick']
	} & Props) {
		return {
			'aria-checked': on,
			onClick: callAll(onClick, toggle),
			...props,
		}
	}

	return {
		on,
		reset,
		toggle,
		getTogglerProps,
	}
}

```

### Core Architecture Module: `exercises/06.state-initializers/02.solution.stability/app.tsx`
```
import { useState } from 'react'
import { Switch } from '#shared/switch.tsx'
import { useToggle } from './toggle.tsx'

export function App() {
	const [initialOn, setInitialOn] = useState(true)
	const { on, getTogglerProps, reset } = useToggle({ initialOn })
	return (
		<div>
			<button onClick={() => setInitialOn(o => !o)}>
				initialOn is: {initialOn ? 'true' : 'false'}
			</button>
			<Switch {...getTogglerProps({ on })} />
			<hr />
			<button onClick={reset}>Reset</button>
		</div>
	)
}

```

### Core Architecture Module: `exercises/06.state-initializers/02.solution.stability/index.tsx`
```
import * as ReactDOM from 'react-dom/client'
import { App } from './app.tsx'

const rootEl = document.createElement('div')
document.body.append(rootEl)
ReactDOM.createRoot(rootEl).render(<App />)

```

### Core Architecture Module: `exercises/06.state-initializers/02.solution.stability/toggle.tsx`
```
import { useReducer, useRef } from 'react'

function callAll<Args extends Array<unknown>>(
	...fns: Array<((...args: Args) => unknown) | undefined>
) {
	return (...args: Args) => fns.forEach(fn => fn?.(...args))
}

type ToggleState = { on: boolean }
type ToggleAction =
	| { type: 'toggle' }
	| { type: 'reset'; initialState: ToggleState }

function toggleReducer(state: ToggleState, action: ToggleAction) {
	switch (action.type) {
		case 'toggle': {
			return { on: !state.on }
		}
		case 'reset': {
			return action.initialState
		}
	}
}

export function useToggle({ initialOn = false } = {}) {
	const { current: initialState } = useRef<ToggleState>({ on: initialOn })
	const [state, dispatch] = useReducer(toggleReducer, initialState)
	const { on } = state

	const toggle = () => dispatch({ type: 'toggle' })
	const reset = () => dispatch({ type: 'reset', initialState })

	function getTogglerProps<Props>({
		onClick,
		...props
	}: {
		onClick?: React.ComponentProps<'button'>['onClick']
	} & Props) {
		return {
			'aria-checked': on,
			onClick: callAll(onClick, toggle),
			...props,
		}
	}

	return {
		on,
		reset,
		toggle,
		getTogglerProps,
	}
}

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
